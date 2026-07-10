const express = require('express');
const { randomUUID } = require('crypto');
const store = require('../db');

const router = express.Router();

// Чисті хелпери (кольори статусів, локалізація, формат суми, підрахунок) — у lib/orders.js,
// щоб їх можна було юніт-тестувати без БД (#21).
const { msg, computeTotal, MOCK_CURRENCY, convertPrice, PRICE_TYPES, verLt } = require('../lib/orders');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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
    // Статус — дротовий ідентифікатор (#48): new|sent|posted|deleted. Помічене на
    // видалення показуємо як deleted (реальний статус лишається для логіки; deletionMark
    // теж віддаємо). Текст і колір статусу — справа клієнта (локалі/тема), не контракту.
    const displayStatus = order.deletionMark ? "deleted" : order.status;
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
        total: computeTotal(order.items || []), // число (контракт #35); фронт форматує сам
        currency: order.currency || '980',      // заморожена валюта замовлення; старі → грн
        priceType: order.priceType || null, // тип цін замовлення — як збережено, без підстановок (#57)
        comment: order.comment ?? null, // коментар до замовлення (#60; → 1С Заказ.Комментарий)
    };
};

// Стійка генерація номера через лічильник (ніколи не повторюється після видалень).
const nextOrderNum = () => {
    store.meta.lastOrderSeq += 1;
    return `ЗМ-${store.meta.lastOrderSeq}`;
};

// Валідація позицій (контракт, як у 1С): позиція без productId або з невідомим товаром —
// 400 на весь запит, а НЕ мовчазний пропуск рядка (інакше документ створюється неповним).
// Повертає true, якщо відповідь-помилку вже надіслано.
const rejectInvalidItems = (req, res, orderItems) => {
    for (const it of (orderItems || [])) {
        const productId = it.productId ?? it.product?.id;
        if (productId == null) {
            res.status(400).json({ success: false, message: msg(req, 'noProductId') });
            return true;
        }
        if (!store.productById(productId)) {
            res.status(400).json({ success: false, message: msg(req, 'productNotFound').replace('%1', String(productId)) });
            return true;
        }
    }
    return false;
};

// --- Роути ---

router.post('/auth', (req, res) => {
    // Імітація автентифікації (QR код в дизайні не передавав паролі)
    res.json({ success: true, user: { name: "Олексій К.", role: "sales_rep" }, token: "mock_token_123" });
});

// Сумісність (#66): version — версія релізу бекенду (package.json, синкається
// sync-version.mjs); minAppVersion — мінімальний додаток, який бекенд ще обслуговує
// (руками, росте лише при зламній зміні контракту).
const BACKEND_VERSION = require('../package.json').version;
const MIN_APP_VERSION = '0.1.0';
// #68: інтервали фонових циклів додатка (секунди). Фронт хардкодів не має — без цих
// значень цикли не запускаються; 0 = цикл вимкнено. В 1С — група «Интервалы приложения»
// у «Налаштуваннях сервісу».
const APP_INTERVALS = { syncSec: 300, pingSec: 15, telemetrySec: 900 };

// GET/HEAD /health — найдешевша перевірка доступності. Без авторизації: лише підтверджує,
// що процес живий. Використовується клієнтом для online-пінгу.
router.head('/health', (req, res) => res.status(200).end());
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), version: BACKEND_VERSION, minAppVersion: MIN_APP_VERSION, intervals: APP_INTERVALS }));

// #66 Хард-гейт сумісності: застарілий додаток (X-App-Version < minAppVersion) → 426,
// щоб він не бив по змінених ендпоінтах і не падав тихо. Реєструється ПІСЛЯ /health і /auth
// (лишаються відкритими: додаток має прочитати minAppVersion, вхід — дізнатися стан).
// /telemetry теж відкритий — застряглий старий пристрій має звітувати. Заголовок відсутній
// (веб/dev/curl) → пропускаємо: гейт лише коли версія відома й точно менша.
router.use((req, res, next) => {
    const appVer = req.get('X-App-Version');
    if (req.path !== '/telemetry' && appVer && verLt(appVer, MIN_APP_VERSION)) {
        return res.status(426).json({ error: 'app_too_old', minAppVersion: MIN_APP_VERSION, appVersion: appVer });
    }
    next();
});

// POST /telemetry (#42) — снапшот стану пристрою. У 1С пишеться в періодичний регістр
// відомостей; мок лише тримає останній снапшот у пам'яті й логує в консоль.
// Відповідь несе requestLog: якщо оператор запросив повний лог — додаток надішле
// позачерговий снапшот із полем log; отримання лога гасить прапорець.
router.post('/telemetry', (req, res) => {
    const b = req.body || {};
    store.telemetry.last = { ...b, deviceId: req.headers['x-device-id'] || null, receivedAt: new Date().toISOString() };
    console.log(`telemetry: v${b.version || '?'} ${b.model || '?'} queue=${b.pendingOrders ?? '?'} net=${b.netErrors ?? 0} req=${b.requests ?? 0}` +
        (b.log ? ` errors=${b.logErrors ?? 0} log=${b.log.length}b` : ''));
    if (b.log) store.telemetry.requestLog = false; // лог отримано — запит виконано
    res.json({ ok: true, requestLog: store.telemetry.requestLog });
});

// Доступні типи цін пристрою (для селектора в каталозі). factor не віддаємо.
router.get('/price-types', (req, res) => {
    res.json(PRICE_TYPES.map(t => ({ id: t.id, name: t.name, default: !!t.default })));
});

router.get('/products', (req, res) => {
    // Ціни переведені у валюту пристрою (як 1С конвертує з валюти прайсу); currency —
    // числовий код ISO. prices — ціна за КОЖНИМ доступним типом цін (клієнт перемикає без
    // дозавантаження); окремого поля price немає (#57) — тип вибирає клієнт.
    // ?ids=<id,id,…> (#56) — лише вказані товари (точкове оновлення після синхронізації);
    // невідомі id мовчки відкидаються, без ids — весь каталог.
    const idsParam = String(req.query.ids || '');
    const wanted = idsParam ? new Set(idsParam.split(',').filter(Boolean)) : null;
    res.json(store.products.filter(p => !wanted || wanted.has(String(p.id))).map(p => {
        const prices = {};
        for (const t of PRICE_TYPES) prices[t.id] = convertPrice(round2(p.price * t.factor));
        const { price: _basePrice, ...rest } = p; // базова price лишається seed-даними, у контракт не йде
        return { ...rest, prices, currency: MOCK_CURRENCY };
    }));
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

// GET /customer-groups (#64) — папки контрагентів (плоско, parentId), як /categories для
// товарів. Фронт будує з них дерево (customer.groupId → батько). У 1С — Контрагенты з ЭтоГруппа.
router.get('/customer-groups', (req, res) => {
    res.json(store.customerGroups);
});

router.get('/customers', (req, res) => {
    // Борг — в управлінській валюті (зведений залишок), не у валюті прайсу. debtCurrency
    // підписує його явно; у моці управлінська валюта = грн ("980").
    res.json(store.customers.map(c => ({ ...c, debtCurrency: '980' })));
});

// GET /customers/:id/ordered-products (#62) — GUID товарів, які контрагент замовляв за всю
// історію (не обмежену глибиною, як /orders). У 1С джерело — обороти регістра
// ЗаказыПокупателей (лише проведені документи); mock без регістрів наближає це як distinct
// productId із непомічених на видалення замовлень контрагента.
router.get('/customers/:id/ordered-products', (req, res) => {
    const { id } = req.params;
    if (!store.customerById(id)) {
        return res.status(404).json({ success: false, message: msg(req, 'customerNotFound').replace('%1', String(id)) });
    }
    const ids = new Set();
    for (const o of store.orders) {
        if (o.deletionMark || o.customerId !== id) continue;
        for (const it of (o.items || [])) if (it.productId != null) ids.add(String(it.productId));
    }
    res.json([...ids]);
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
    const { id: clientId, orderItems, customerId, status, date, baseVersion, priceType, comment } = req.body;

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

    // Замовлення без контрагента не приймаємо — як 1С: ЗаказПокупателя без Контрагент
    // некоректний. «Не вказано» і «не знайдено» розрізняємо (друге — з id для діагностики).
    // При upsert контрагент може прийти з наявного документа.
    const effCustomerId = customerId ?? existing?.customerId;
    if (effCustomerId == null) {
        return res.status(400).json({ success: false, message: msg(req, 'noCustomer') });
    }
    if (!store.customerById(effCustomerId)) {
        return res.status(400).json({ success: false, message: msg(req, 'customerNotFound').replace('%1', String(effCustomerId)) });
    }
    // Нове замовлення без типу цін не приймаємо (#57): клієнт зобов'язаний передати вибір —
    // жодних серверних підстановок «типу за замовчуванням».
    if (!existing && !priceType) {
        return res.status(400).json({ success: false, message: msg(req, 'noPriceType') });
    }
    if (rejectInvalidItems(req, res, orderItems)) return;

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
        if (comment !== undefined) existing.comment = comment; // коментар (#60)
        order = existing;
    } else {
        order = {
            id,
            num: nextOrderNum(),
            customerId: customerId ?? null,
            date: date || new Date().toISOString().split('T')[0],
            status: status || "sent",
            deletionMark: false,
            version,
            items,
            currency: MOCK_CURRENCY, // валюта пристрою на момент створення (заморожується)
            priceType, // вибраний тип цін (обов'язковий для нового, #57)
            comment: comment ?? null, // коментар до замовлення (#60)
        };
        store.orders.push(order);
    }

    res.json({ success: true, order: hydrateOrder(order) });
});

router.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderItems, customerId, status, date, deletionMark, comment } = req.body;

    const existing = store.orderById(id);
    if (!existing) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    // Невідомий контрагент при оновленні — 400, а не битий документ.
    if (customerId != null && !store.customerById(customerId)) {
        return res.status(400).json({ success: false, message: msg(req, 'customerNotFound').replace('%1', String(customerId)) });
    }
    if (orderItems && rejectInvalidItems(req, res, orderItems)) return;

    existing.customerId = customerId ?? existing.customerId;
    existing.status = status || existing.status;
    existing.date = date || existing.date;
    existing.version = randomUUID();
    if (orderItems) existing.items = normalizeItems(orderItems);
    // Зняття/встановлення помітки на видалення (напр. "Зняти помітку").
    if (deletionMark !== undefined) existing.deletionMark = !!deletionMark;
    if (comment !== undefined) existing.comment = comment; // коментар (#60)

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
    if (existing.status === "posted") {
        return res.status(409).json({ success: false, message: msg(req, 'cantDeletePosted') });
    }

    if (existing.status === "new") {
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
