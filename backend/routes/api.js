const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = express.Router();

// --- Підготовлені запити ---
const q = {
    products: db.prepare('SELECT id, name, sku, barcode, price, stock, unit, category, categoryId, img FROM products'),
    productById: db.prepare('SELECT id, name, sku, barcode, price, stock, unit, category, categoryId, img FROM products WHERE id = ?'),
    customers: db.prepare('SELECT id, name, code, address, contact, phone, contacts, debt, status FROM customers'),
    customerById: db.prepare('SELECT id, name, code, address, contact, phone, contacts, debt, status FROM customers WHERE id = ?'),
    categories: db.prepare('SELECT id, name, parentId, icon, count, expanded FROM categories'),
    orders: db.prepare('SELECT id, num, customerId, date, status, deletionMark, version FROM orders ORDER BY date DESC, num DESC'),
    orderById: db.prepare('SELECT id, num, customerId, date, status, deletionMark, version FROM orders WHERE id = ?'),
    itemsByOrder: db.prepare('SELECT productId, qty, price FROM order_items WHERE orderId = ? ORDER BY id'),
    insertOrder: db.prepare('INSERT INTO orders (id, num, customerId, date, status, version) VALUES (@id, @num, @customerId, @date, @status, @version)'),
    updateOrder: db.prepare('UPDATE orders SET customerId = @customerId, status = @status, date = @date, version = @version WHERE id = @id'),
    deleteOrder: db.prepare('DELETE FROM orders WHERE id = ?'),
    markOrderDeletion: db.prepare('UPDATE orders SET deletionMark = 1, version = @version WHERE id = @id'),
    setOrderDeletion: db.prepare('UPDATE orders SET deletionMark = @mark, version = @version WHERE id = @id'),
    insertItem: db.prepare('INSERT INTO order_items (orderId, productId, qty, price) VALUES (@orderId, @productId, @qty, @price)'),
    deleteItems: db.prepare('DELETE FROM order_items WHERE orderId = ?'),
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
};

// --- Допоміжні функції для замовлень ---

const STATUS_COLORS = {
    "Нове": "#F2994A",
    "Відправлено": "#4ECDA4",
    "Проведено": "#8A8C96",
    "Видалено": "#C0392B"
};
const colorFor = (status) => STATUS_COLORS[status] || "#F2C94C";

// --- Локалізація message-рядків (#26): мова з Accept-Language (uk/ru/en, fallback en) ---
const MESSAGES = {
    conflict: { uk: "Замовлення змінили на сервері після ваших правок", ru: "Заказ изменили на сервере после ваших правок", en: "The order was changed on the server after your edits" },
    notFound: { uk: "Замовлення не знайдено", ru: "Заказ не найден", en: "Order not found" },
    cantDeletePosted: { uk: "Проведене замовлення не можна видалити", ru: "Проведённый заказ нельзя удалить", en: "A posted order cannot be deleted" },
    deleted: { uk: "Замовлення видалено", ru: "Заказ удалён", en: "Order deleted" },
    marked: { uk: "Помічено на видалення", ru: "Помечено на удаление", en: "Marked for deletion" }
};
const pickLang = (req) => {
    const raw = String(req.headers['accept-language'] || '').toLowerCase();
    return ['uk', 'ru', 'en'].find(l => raw.includes(l)) || 'en';
};
const msg = (req, key) => (MESSAGES[key] || {})[pickLang(req)] || (MESSAGES[key] || {}).en || key;

const formatUAH = (n) => `${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;

// Нормалізуємо вхідні позиції до { productId, qty, price }.
// Ціну ФІКСУЄМО на момент замовлення (snapshot): подальша зміна прайсу в каталозі
// не впливає на вже оформлені замовлення. Підтримуємо новий ({ productId, price })
// і старий ({ product: { id, price } }) формати.
const normalizeItems = (orderItems) => (orderItems || [])
    .map(it => {
        const productId = it.productId ?? it.product?.id;
        const current = productId != null ? q.productById.get(productId) : null;
        const price = it.price ?? it.product?.price ?? (current ? current.price : 0);
        return { productId, qty: it.qty, price };
    })
    .filter(it => it.productId != null);

const computeTotal = (items) => items.reduce((sum, it) => sum + (it.price || 0) * it.qty, 0);

// "Гідратація": з нормалізованих рядків (посилання + зафіксована ціна) будуємо
// повний об'єкт, який очікує фронтенд. Назва/іконка/sku — актуальні за productId,
// ціна — snapshot із замовлення.
const hydrateOrder = (order) => {
    const customer = order.customerId != null ? q.customerById.get(order.customerId) || null : null;
    const rows = q.itemsByOrder.all(order.id);
    const items = rows.map(it => {
        const current = q.productById.get(it.productId);
        const product = current
            ? { ...current, price: it.price }
            : { id: it.productId, name: "Товар недоступний", sku: "", img: "❓", price: it.price };
        return { product, qty: it.qty };
    });
    // Помічене на видалення показуємо окремим статусом "Видалено" (реальний статус
    // лишається в БД для логіки; deletionMark теж віддаємо).
    const displayStatus = order.deletionMark ? "Видалено" : order.status;
    return {
        id: order.id,
        num: order.num,
        customerId: order.customerId,
        date: order.date,
        status: displayStatus,
        deletionMark: !!order.deletionMark,
        version: order.version, // токен версії (як ВерсияДанных у 1С) — для виявлення конфліктів
        client: customer ? customer.name : "Невідомий клієнт",
        customer,
        items,
        total: formatUAH(computeTotal(rows)),
        sColor: colorFor(displayStatus)
    };
};

// Стійка генерація номера через персистентний лічильник meta.lastOrderSeq
// (ніколи не повторюється після видалень).
const nextOrderNum = () => {
    const row = q.getMeta.get('lastOrderSeq');
    const seq = (row ? parseInt(row.value, 10) : 2025) + 1;
    q.setMeta.run('lastOrderSeq', String(seq));
    return `ЗМ-${seq}`;
};

// --- Роути ---

router.post('/auth', (req, res) => {
    // Імітація автентифікації (QR код в дизайні не передавав паролі)
    res.json({ success: true, user: { name: "Олексій К.", role: "sales_rep" }, token: "mock_token_123" });
});

// GET/HEAD /health — найдешевша перевірка доступності. Без авторизації й без звернень
// до БД: лише підтверджує, що процес живий. Використовується клієнтом для online-пінгу.
router.head('/health', (req, res) => res.status(200).end());
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.get('/products', (req, res) => {
    res.json(q.products.all());
});

// GET /products/:id/image — у 1С повертає Номенклатура.ОсновноеИзображение (бінарно).
// Демо не зберігає бінарних зображень (img — емодзі/URL), тож завжди 404 — як 1С за
// відсутності зображення. Існує для сумісності контракту.
router.get('/products/:id/image', (req, res) => {
    res.status(404).end();
});

router.get('/categories', (req, res) => {
    res.json(q.categories.all().map(c => ({ ...c, expanded: !!c.expanded })));
});

router.get('/customers', (req, res) => {
    res.json(q.customers.all().map(c => ({
        ...c,
        contacts: c.contacts ? JSON.parse(c.contacts) : undefined
    })));
});

router.get('/orders', (req, res) => {
    let orders = q.orders.all().map(hydrateOrder);
    const { startDate, endDate } = req.query;

    if (startDate) {
        orders = orders.filter(o => o.date >= startDate);
    }
    if (endDate) {
        orders = orders.filter(o => o.date <= endDate);
    }

    res.json(orders);
});

router.post('/orders', (req, res) => {
    const { id: clientId, orderItems, customerId, status, date, baseVersion } = req.body;

    const id = clientId || randomUUID();
    const existing = q.orderById.get(id);

    // Виявлення конфлікту (оптимістична конкуренція): якщо клієнт редагував від певної
    // версії (baseVersion — як ВерсияДанных у 1С), а на сервері запис відтоді змінився —
    // НЕ перезаписуємо мовчки. Відсутній baseVersion = «перезаписати» (нове/свідомий force).
    if (existing && baseVersion != null && String(existing.version) !== String(baseVersion)) {
        return res.status(409).json({
            success: false, conflict: true,
            message: msg(req, 'conflict'),
            order: hydrateOrder(existing)
        });
    }

    // Upsert за GUID: повторна відправка тієї ж чернетки (той самий id) не дублює
    // (ідемпотентність offline-черги, #6). num присвоюється раз і не змінюється.
    const upsert = db.transaction(() => {
        const version = randomUUID(); // новий токен версії при кожному записі (імітує ВерсияДанных)
        if (existing) {
            q.updateOrder.run({
                id,
                customerId: customerId ?? existing.customerId,
                status: status || existing.status,
                date: date || existing.date,
                version
            });
            q.deleteItems.run(id);
        } else {
            q.insertOrder.run({
                id,
                num: nextOrderNum(),
                customerId: customerId ?? null,
                date: date || new Date().toISOString().split('T')[0],
                status: status || "Відправлено",
                version
            });
        }
        normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderId: id, ...it }));
    });

    upsert();
    res.json({ success: true, order: hydrateOrder(q.orderById.get(id)) });
});

router.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderItems, customerId, status, date, deletionMark } = req.body;

    const existing = q.orderById.get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    const update = db.transaction(() => {
        const version = randomUUID();
        q.updateOrder.run({
            id,
            customerId: customerId ?? existing.customerId,
            status: status || existing.status,
            date: date || existing.date,
            version
        });
        if (orderItems) {
            q.deleteItems.run(id);
            normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderId: id, ...it }));
        }
        // Зняття/встановлення помітки на видалення (напр. "Зняти помітку").
        if (deletionMark !== undefined) {
            q.setOrderDeletion.run({ id, mark: deletionMark ? 1 : 0, version });
        }
    });

    update();
    res.json({ success: true, order: hydrateOrder(q.orderById.get(id)) });
});

// Видалити повністю можна лише нове (невідправлене) замовлення. Відправлене/проведене
// НЕ видаляємо, а ставимо помітку на видалення (як ПометкаУдаления в 1С) — лишається
// в списку до фізичного вилучення в обліковій системі.
router.delete('/orders/:id', (req, res) => {
    const { id } = req.params;
    const existing = q.orderById.get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    // Проведене замовлення не можна видалити/позначити з додатку (спершу розпроводять у 1С).
    if (existing.status === "Проведено") {
        return res.status(409).json({ success: false, message: msg(req, 'cantDeletePosted') });
    }

    if (existing.status === "Нове") {
        q.deleteOrder.run(id);   // order_items видаляються каскадно
        return res.json({ success: true, deleted: true, message: msg(req, 'deleted') });
    }

    // Відправлене — помітка на видалення (як ПометкаУдаления в 1С).
    q.markOrderDeletion.run({ id, version: randomUUID() });
    res.json({ success: true, marked: true, order: hydrateOrder(q.orderById.get(id)), message: msg(req, 'marked') });
});

module.exports = router;
