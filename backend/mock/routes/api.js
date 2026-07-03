const express = require('express');
const { randomUUID } = require('crypto');
const store = require('../db');

const router = express.Router();

// Чисті хелпери (кольори статусів, локалізація, формат суми, підрахунок) — у lib/orders.js,
// щоб їх можна було юніт-тестувати без БД (#21).
const { colorFor, msg, formatUAH, computeTotal } = require('../lib/orders');

// --- Допоміжні функції для замовлень ---

// Нормалізуємо вхідні позиції до { productId, qty, price }.
// Ціну ФІКСУЄМО на момент замовлення (snapshot): подальша зміна прайсу в каталозі
// не впливає на вже оформлені замовлення. Підтримуємо новий ({ productId, price })
// і старий ({ product: { id, price } }) формати.
const normalizeItems = (orderItems) => (orderItems || [])
    .map(it => {
        const productId = it.productId ?? it.product?.id;
        const current = productId != null ? store.productById(productId) : null;
        const price = it.price ?? it.product?.price ?? (current ? current.price : 0);
        return { productId, qty: it.qty, price };
    })
    .filter(it => it.productId != null);

// "Гідратація": з нормалізованих рядків (посилання + зафіксована ціна) будуємо
// повний об'єкт, який очікує фронтенд. Назва/іконка/sku — актуальні за productId,
// ціна — snapshot із замовлення.
const hydrateOrder = (order) => {
    const customer = order.customerId != null ? store.customerById(order.customerId) : null;
    const items = (order.items || []).map(it => {
        const current = store.productById(it.productId);
        const product = current
            ? { ...current, price: it.price }
            : { id: it.productId, name: "Товар недоступний", sku: "", img: "❓", price: it.price };
        return { product, qty: it.qty };
    });
    // Помічене на видалення показуємо окремим статусом "Видалено" (реальний статус
    // лишається для логіки; deletionMark теж віддаємо).
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
        customer: customer || null,
        items,
        total: formatUAH(computeTotal(order.items || [])),
        sColor: colorFor(displayStatus)
    };
};

// Стійка генерація номера через лічильник (ніколи не повторюється після видалень).
const nextOrderNum = () => {
    store.meta.lastOrderSeq += 1;
    return `ЗМ-${store.meta.lastOrderSeq}`;
};

// --- Роути ---

router.post('/auth', (req, res) => {
    // Імітація автентифікації (QR код в дизайні не передавав паролі)
    res.json({ success: true, user: { name: "Олексій К.", role: "sales_rep" }, token: "mock_token_123" });
});

// GET/HEAD /health — найдешевша перевірка доступності. Без авторизації: лише підтверджує,
// що процес живий. Використовується клієнтом для online-пінгу.
router.head('/health', (req, res) => res.status(200).end());
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// POST /telemetry (#42) — снапшот стану пристрою. У 1С пишеться в періодичний регістр
// відомостей; мок лише тримає останній снапшот у пам'яті й логує в консоль.
// Відповідь несе requestLog: якщо оператор запросив повний лог — додаток надішле
// позачерговий снапшот із полем log; отримання лога гасить прапорець.
router.post('/telemetry', (req, res) => {
    const b = req.body || {};
    store.telemetry.last = { ...b, deviceId: req.headers['x-device-id'] || null, receivedAt: new Date().toISOString() };
    console.log(`telemetry: v${b.version || '?'} ${b.model || '?'} queue=${b.pendingOrders ?? '?'}` +
        (b.log ? ` errors=${b.logErrors ?? 0} log=${b.log.length}b` : ''));
    if (b.log) store.telemetry.requestLog = false; // лог отримано — запит виконано
    res.json({ ok: true, requestLog: store.telemetry.requestLog });
});

router.get('/products', (req, res) => {
    res.json(store.products);
});

// GET /products/:id/image — у 1С повертає Номенклатура.ОсновноеИзображение (бінарно).
// Демо не зберігає бінарних зображень (img — емодзі/URL), тож завжди 404 — як 1С за
// відсутності зображення. Існує для сумісності контракту.
router.get('/products/:id/image', (req, res) => {
    res.status(404).end();
});

router.get('/categories', (req, res) => {
    res.json(store.categories);
});

router.get('/customers', (req, res) => {
    res.json(store.customers);
});

router.get('/orders', (req, res) => {
    const { startDate, endDate } = req.query;
    let orders = [...store.orders]
        .sort((a, b) => (b.date.localeCompare(a.date)) || (String(b.num).localeCompare(String(a.num))))
        .map(hydrateOrder);

    if (startDate) orders = orders.filter(o => o.date >= startDate);
    if (endDate) orders = orders.filter(o => o.date <= endDate);

    res.json(orders);
});

router.post('/orders', (req, res) => {
    const { id: clientId, orderItems, customerId, status, date, baseVersion } = req.body;

    const id = clientId || randomUUID();
    const existing = store.orderById(id);

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

    // Замовлення без контрагента не приймаємо (як 1С: ЗаказПокупателя без Контрагент —
    // некоректний документ). При upsert існуючого контрагент може прийти з нього.
    if ((customerId ?? existing?.customerId) == null) {
        return res.status(400).json({ success: false, message: msg(req, 'noCustomer') });
    }

    const version = randomUUID(); // новий токен версії при кожному записі (імітує ВерсияДанных)
    const items = normalizeItems(orderItems);

    // Upsert за GUID: повторна відправка тієї ж чернетки (той самий id) не дублює
    // (ідемпотентність offline-черги, #6). num присвоюється раз і не змінюється.
    let order;
    if (existing) {
        existing.customerId = customerId ?? existing.customerId;
        existing.status = status || existing.status;
        existing.date = date || existing.date;
        existing.version = version;
        existing.items = items;
        order = existing;
    } else {
        order = {
            id,
            num: nextOrderNum(),
            customerId: customerId ?? null,
            date: date || new Date().toISOString().split('T')[0],
            status: status || "Відправлено",
            deletionMark: false,
            version,
            items,
        };
        store.orders.push(order);
    }

    res.json({ success: true, order: hydrateOrder(order) });
});

router.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderItems, customerId, status, date, deletionMark } = req.body;

    const existing = store.orderById(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    existing.customerId = customerId ?? existing.customerId;
    existing.status = status || existing.status;
    existing.date = date || existing.date;
    existing.version = randomUUID();
    if (orderItems) existing.items = normalizeItems(orderItems);
    // Зняття/встановлення помітки на видалення (напр. "Зняти помітку").
    if (deletionMark !== undefined) existing.deletionMark = !!deletionMark;

    res.json({ success: true, order: hydrateOrder(existing) });
});

// Видалити повністю можна лише нове (невідправлене) замовлення. Відправлене/проведене
// НЕ видаляємо, а ставимо помітку на видалення (як ПометкаУдаления в 1С) — лишається
// в списку до фізичного вилучення в обліковій системі.
router.delete('/orders/:id', (req, res) => {
    const { id } = req.params;
    const existing = store.orderById(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    // Проведене замовлення не можна видалити/позначити з додатку (спершу розпроводять у 1С).
    if (existing.status === "Проведено") {
        return res.status(409).json({ success: false, message: msg(req, 'cantDeletePosted') });
    }

    if (existing.status === "Нове") {
        const i = store.orders.indexOf(existing);
        if (i >= 0) store.orders.splice(i, 1);
        return res.json({ success: true, deleted: true, message: msg(req, 'deleted') });
    }

    // Відправлене — помітка на видалення (як ПометкаУдаления в 1С).
    existing.deletionMark = true;
    existing.version = randomUUID();
    res.json({ success: true, marked: true, order: hydrateOrder(existing), message: msg(req, 'marked') });
});

module.exports = router;
