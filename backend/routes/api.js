const express = require('express');
const db = require('../db');

const router = express.Router();

// --- Підготовлені запити ---
const q = {
    products: db.prepare('SELECT id, name, sku, price, stock, unit, category, categoryId, img FROM products'),
    productById: db.prepare('SELECT id, name, sku, price, stock, unit, category, categoryId, img FROM products WHERE id = ?'),
    customers: db.prepare('SELECT id, name, code, city, contact, phone, debt, status FROM customers'),
    customerById: db.prepare('SELECT id, name, code, city, contact, phone, debt, status FROM customers WHERE id = ?'),
    categories: db.prepare('SELECT id, name, parentId, icon, count, expanded FROM categories'),
    orders: db.prepare('SELECT num, customerId, date, status FROM orders ORDER BY date DESC, num DESC'),
    orderByNum: db.prepare('SELECT num, customerId, date, status FROM orders WHERE num = ?'),
    itemsByOrder: db.prepare('SELECT productId, qty, price FROM order_items WHERE orderNum = ? ORDER BY id'),
    insertOrder: db.prepare('INSERT INTO orders (num, customerId, date, status) VALUES (@num, @customerId, @date, @status)'),
    updateOrder: db.prepare('UPDATE orders SET customerId = @customerId, status = @status WHERE num = @num'),
    deleteOrder: db.prepare('DELETE FROM orders WHERE num = ?'),
    insertItem: db.prepare('INSERT INTO order_items (orderNum, productId, qty, price) VALUES (@orderNum, @productId, @qty, @price)'),
    deleteItems: db.prepare('DELETE FROM order_items WHERE orderNum = ?'),
    getMeta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
};

// --- Допоміжні функції для замовлень ---

const STATUS_COLORS = {
    "Відправлено": "#4ECDA4",
    "Очікує відправки": "#2D9CDB",
    "Чернетка": "#F2994A"
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
    const rows = q.itemsByOrder.all(order.num);
    const items = rows.map(it => {
        const current = q.productById.get(it.productId);
        const product = current
            ? { ...current, price: it.price }
            : { id: it.productId, name: "Товар недоступний", sku: "", img: "❓", price: it.price };
        return { product, qty: it.qty };
    });
    return {
        num: order.num,
        customerId: order.customerId,
        date: order.date,
        status: order.status,
        client: customer ? customer.name : "Невідомий клієнт",
        customer,
        items,
        total: formatUAH(computeTotal(rows)),
        sColor: colorFor(order.status)
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
    res.json(q.customers.all());
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
    const { orderItems, customerId, status } = req.body;

    const create = db.transaction(() => {
        const num = nextOrderNum();
        const order = {
            num,
            customerId: customerId ?? null,
            date: new Date().toISOString().split('T')[0],
            status: status || "Відправлено"
        };
        q.insertOrder.run(order);
        normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderNum: num, ...it }));
        return order;
    });

    const order = create();
    res.json({ success: true, order: hydrateOrder(order) });
});

router.put('/orders/:num', (req, res) => {
    const { num } = req.params;
    const { orderItems, customerId, status } = req.body;

    const existing = q.orderByNum.get(num);
    if (!existing) {
        return res.status(404).json({ success: false, message: "Замовлення не знайдено" });
    }

    const update = db.transaction(() => {
        q.updateOrder.run({
            num,
            customerId: customerId ?? existing.customerId,
            status: status || existing.status
        });
        if (orderItems) {
            q.deleteItems.run(num);
            normalizeItems(orderItems).forEach(it => q.insertItem.run({ orderNum: num, ...it }));
        }
    });

    update();
    res.json({ success: true, order: hydrateOrder(q.orderByNum.get(num)) });
});

router.delete('/orders/:num', (req, res) => {
    const { num } = req.params;
    const info = q.deleteOrder.run(num);   // order_items видаляються каскадно

    if (info.changes === 0) {
        return res.status(404).json({ success: false, message: "Замовлення не знайдено" });
    }

    res.json({ success: true, message: "Замовлення видалено" });
});

module.exports = router;
