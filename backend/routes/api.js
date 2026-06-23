const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');

const router = express.Router();

// --- Підготовлені запити ---
const q = {
    products: db.prepare('SELECT id, name, sku, price, stock, unit, category, categoryId, img FROM products'),
    productById: db.prepare('SELECT id, name, sku, price, stock, unit, category, categoryId, img FROM products WHERE id = ?'),
    customers: db.prepare('SELECT id, name, code, address, contact, phone, contacts, debt, status FROM customers'),
    customerById: db.prepare('SELECT id, name, code, address, contact, phone, contacts, debt, status FROM customers WHERE id = ?'),
    categories: db.prepare('SELECT id, name, parentId, icon, count, expanded FROM categories'),
    orders: db.prepare('SELECT id, num, customerId, date, status, deletionMark FROM orders ORDER BY date DESC, num DESC'),
    orderById: db.prepare('SELECT id, num, customerId, date, status, deletionMark FROM orders WHERE id = ?'),
    itemsByOrder: db.prepare('SELECT productId, qty, price FROM order_items WHERE orderId = ? ORDER BY id'),
    insertOrder: db.prepare('INSERT INTO orders (id, num, customerId, date, status) VALUES (@id, @num, @customerId, @date, @status)'),
    updateOrder: db.prepare('UPDATE orders SET customerId = @customerId, status = @status, date = @date WHERE id = @id'),
    deleteOrder: db.prepare('DELETE FROM orders WHERE id = ?'),
    markOrderDeletion: db.prepare('UPDATE orders SET deletionMark = 1 WHERE id = @id'),
    setOrderDeletion: db.prepare('UPDATE orders SET deletionMark = @mark WHERE id = @id'),
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

router.get('/products', (req, res) => {
    res.json(q.products.all());
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
    const { id: clientId, orderItems, customerId, status, date } = req.body;

    // Upsert за GUID: повторна відправка тієї ж локальної чернетки (той самий id)
    // не створює дубль (ідемпотентність offline-черги, #6). num присвоюється раз
    // і не змінюється; клієнтський id (UUID) лишається ідентичністю.
    const upsert = db.transaction(() => {
        const id = clientId || randomUUID();
        const existing = q.orderById.get(id);
        if (existing) {
            q.updateOrder.run({
                id,
                customerId: customerId ?? existing.customerId,
                status: status || existing.status,
                date: date || existing.date
            });
            q.deleteItems.run(id);
        } else {
            q.insertOrder.run({
                id,
                num: nextOrderNum(),
                customerId: customerId ?? null,
                date: date || new Date().toISOString().split('T')[0],
                status: status || "Відправлено"
            });
        }
        normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderId: id, ...it }));
        return id;
    });

    const id = upsert();
    res.json({ success: true, order: hydrateOrder(q.orderById.get(id)) });
});

router.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderItems, customerId, status, date, deletionMark } = req.body;

    const existing = q.orderById.get(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: "Замовлення не знайдено" });
    }

    const update = db.transaction(() => {
        q.updateOrder.run({
            id,
            customerId: customerId ?? existing.customerId,
            status: status || existing.status,
            date: date || existing.date
        });
        if (orderItems) {
            q.deleteItems.run(id);
            normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderId: id, ...it }));
        }
        // Зняття/встановлення помітки на видалення (напр. "Зняти помітку").
        if (deletionMark !== undefined) {
            q.setOrderDeletion.run({ id, mark: deletionMark ? 1 : 0 });
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
        return res.status(404).json({ success: false, message: "Замовлення не знайдено" });
    }

    // Проведене замовлення не можна видалити/позначити з додатку (спершу розпроводять у 1С).
    if (existing.status === "Проведено") {
        return res.status(409).json({ success: false, message: "Проведене замовлення не можна видалити" });
    }

    if (existing.status === "Нове") {
        q.deleteOrder.run(id);   // order_items видаляються каскадно
        return res.json({ success: true, deleted: true, message: "Замовлення видалено" });
    }

    // Відправлене — помітка на видалення (як ПометкаУдаления в 1С).
    q.markOrderDeletion.run({ id });
    res.json({ success: true, marked: true, order: hydrateOrder(q.orderById.get(id)), message: "Помічено на видалення" });
});

module.exports = router;
