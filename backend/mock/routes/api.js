const express = require('express');
const { randomUUID } = require('crypto');
const store = require('../db');

const router = express.Router();

// Чисті хелпери (кольори статусів, локалізація, формат суми, підрахунок) — у lib/orders.js,
// щоб їх можна було юніт-тестувати без БД (#21).
const { msg, computeTotal, MOCK_CURRENCY, convertPrice, PRICE_TYPES, verLt } = require('../lib/orders');
// #85: пристрої — прив'язка, токен, доступи, історія телеметрії (дзеркало 1С).
const { hashToken, newToken, tokenFromHeaders, accessSet, allowed, treeFilter, historyStart, pruneTelemetry } = require('../lib/devices');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// --- Пристрій запиту ---

const deviceIdFrom = (req) => String(req.get('X-Device-Id') || req.query.device || '').trim();

// Пристрій ЛИШЕ за дійсним токеном: знайдено за X-Device-Id, не заблоковано, спарено
// і SHA-256 пред'явленого токена збігається зі збереженим (як ОпределитьУстройство у 1С).
const authDevice = (req) => {
    const dev = store.deviceById(deviceIdFrom(req));
    if (!dev || dev.blocked || !dev.tokenHash) return null;
    const token = tokenFromHeaders(req.headers);
    if (!token || hashToken(token) !== dev.tokenHash) return null;
    return dev;
};

// Валюта пристрою (#35): картка → налаштування стенду → env-фолбек.
const deviceCurrency = (dev) => dev?.currencyId || store.settings.currency || MOCK_CURRENCY;

// Типи цін, доступні пристрою (порожній список у картці = всі).
const devicePriceTypes = (dev) => {
    const set = accessSet(dev?.priceTypeIds);
    return PRICE_TYPES.filter(t => allowed(set, t.id));
};

// Товари/контрагенти пристрою. У списку доступу може стояти як сам елемент, так і
// категорія/папка — тоді доступне все, що під нею (як В ИЕРАРХИИ у 1С). Порожній
// список — без обмеження (див. lib/devices.js).
const deviceProducts = (dev) => {
    const ok = treeFilter(dev?.productIds, store.categories);
    return store.products.filter(p => ok(p.id, p.categoryId));
};
const deviceCustomers = (dev) => {
    const ok = treeFilter(dev?.customerIds, store.customerGroups);
    return store.customers.filter(c => ok(c.id, c.groupId));
};
// Чи доступний пристрою конкретний контрагент (замовлення скоупляться тим самим списком).
const customerAllowed = (dev, id) => {
    if (id == null) return false;
    const c = store.customerById(id);
    return !!c && treeFilter(dev?.customerIds, store.customerGroups)(c.id, c.groupId);
};

// Гілки дерева, потрібні для видимих елементів: самі вузли + усі їхні предки
// (інакше фронт не побудує дерево — категорія без батька провисає).
const withAncestors = (nodes, usedIds) => {
    const byId = new Map(nodes.map(n => [String(n.id), n]));
    const keep = new Set();
    for (const id of usedIds) {
        let cur = byId.get(String(id));
        while (cur && !keep.has(String(cur.id))) {
            keep.add(String(cur.id));
            cur = cur.parentId != null ? byId.get(String(cur.parentId)) : null;
        }
    }
    return nodes.filter(n => keep.has(String(n.id)));
};

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

// POST /auth — { deviceId, pairingCode }: обмін одноразового коду прив'язки на токен
// (#85, як AuthPost у 1С). У стані лишається лише SHA-256 токена; код після успіху
// гаситься — повторно ним не прив'язатись. Заблокований/невідомий пристрій → 401.
router.post('/auth', (req, res) => {
    const id = String(req.body?.deviceId || deviceIdFrom(req) || '').trim();
    const code = String(req.body?.pairingCode || '').trim();

    const dev = store.deviceById(id);
    if (!dev) return res.status(401).json({ success: false, message: msg(req, 'deviceUnknown') });
    if (dev.blocked) return res.status(401).json({ success: false, message: msg(req, 'deviceBlocked') });
    if (!code || !dev.pairingCode || code.toUpperCase() !== String(dev.pairingCode).toUpperCase()) {
        return res.status(401).json({ success: false, message: msg(req, 'badPairingCode') });
    }

    const token = newToken();
    dev.tokenHash = hashToken(token);
    dev.pairingCode = ''; // одноразовий
    store.save();

    const manager = store.managers.find(m => m.id === dev.managerId);
    res.json({ success: true, user: { name: manager ? manager.name : dev.name, role: 'sales_rep' }, token });
});

// Сумісність (#66): version — версія релізу бекенду (package.json, синкається
// sync-version.mjs); minAppVersion — мінімальний додаток, який бекенд ще обслуговує
// (руками, росте лише при зламній зміні контракту).
const BACKEND_VERSION = require('../package.json').version;
const MIN_APP_VERSION = '0.1.0';
// #68: інтервали фонових циклів додатка (секунди). Фронт хардкодів не має — без цих
// значень цикли не запускаються; 0 = цикл вимкнено. В 1С — група «Интервалы приложения»
// у «Налаштуваннях сервісу»; тут — налаштування стенду, редаговані в адмінці (#85).
const minAppVersion = () => store.settings.minAppVersion || MIN_APP_VERSION;
const appIntervals = () => ({
    syncSec: store.settings.syncSec, pingSec: store.settings.pingSec, telemetrySec: store.settings.telemetrySec,
});

// GET/HEAD /health — найдешевша перевірка доступності. Без авторизації: лише підтверджує,
// що процес живий. Використовується клієнтом для online-пінгу.
router.head('/health', (req, res) => res.status(200).end());
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString(), version: BACKEND_VERSION, minAppVersion: minAppVersion(), intervals: appIntervals() }));

// #66 Хард-гейт сумісності: застарілий додаток (X-App-Version < minAppVersion) → 426,
// щоб він не бив по змінених ендпоінтах і не падав тихо. Реєструється ПІСЛЯ /health і /auth
// (лишаються відкритими: додаток має прочитати minAppVersion, вхід — дізнатися стан).
// /telemetry теж відкритий — застряглий старий пристрій має звітувати. Заголовок відсутній
// (веб/dev/curl) → пропускаємо: гейт лише коли версія відома й точно менша.
router.use((req, res, next) => {
    const appVer = req.get('X-App-Version');
    if (req.path !== '/telemetry' && appVer && verLt(appVer, minAppVersion())) {
        return res.status(426).json({ error: 'app_too_old', minAppVersion: minAppVersion(), appVersion: appVer });
    }
    next();
});

// #85 Гейт пристрою: далі проходять лише запити з дійсним токеном спареного й
// незаблокованого пристрою. Заблокований/видалений пристрій або відкликаний токен → 401,
// і додаток за цим сигналом виходить на екран входу (#40) — сценарій, який на моці
// раніше не відтворювався взагалі. Реєструється ПІСЛЯ /auth і /health (ті лишаються
// відкритими), але ДО решти — включно з /telemetry (як TelemetryPost у 1С).
router.use((req, res, next) => {
    const dev = authDevice(req);
    if (!dev) return res.status(401).json({ success: false, message: msg(req, 'unauthorized') });
    req.device = dev;
    next();
});

// POST /telemetry (#42) — снапшот стану пристрою. Як у 1С, кожен снапшот лягає в ІСТОРІЮ
// з міткою часу (там — періодичний регістр, тут — журнал store.telemetry), а не затирає
// попередній (#85). Відповідь несе requestLog: якщо оператор запросив повний лог — додаток
// надішле позачерговий снапшот із полем log; отримання лога гасить прапорець.
router.post('/telemetry', (req, res) => {
    const b = req.body || {};
    const dev = req.device;
    store.telemetry.push({
        deviceId: dev.id, at: new Date().toISOString(),
        version: b.version ?? null, model: b.model ?? null, os: b.os ?? null,
        lastSyncAt: b.lastSyncAt ?? null,
        pendingOrders: b.pendingOrders ?? null, netErrors: b.netErrors ?? 0, requests: b.requests ?? 0,
        log: b.log ?? null, logErrors: b.logErrors ?? 0,
    });
    console.log(`telemetry: ${dev.name || dev.id} v${b.version || '?'} ${b.model || '?'} queue=${b.pendingOrders ?? '?'} net=${b.netErrors ?? 0} req=${b.requests ?? 0}` +
        (b.log ? ` errors=${b.logErrors ?? 0} log=${b.log.length}b` : ''));
    if (b.log && dev.requestLog) dev.requestLog = false; // лог отримано — запит виконано
    pruneHistory();
    store.save();
    res.json({ ok: true, requestLog: dev.requestLog });
});

// Чистка історії телеметрії за строком зберігання — при старті й не частіше разу на добу
// (як ОчиститьУстаревшуюТелеметрию у 1С). Експортується для планувальника в server.js.
let lastPrune = 0;
const pruneHistory = (force = false) => {
    if (!force && Date.now() - lastPrune < 86400000) return 0;
    lastPrune = Date.now();
    const before = store.telemetry.length;
    const kept = pruneTelemetry(store.telemetry, store.settings.telemetryKeepDays);
    if (kept.length !== before) {
        store.telemetry.length = 0;
        for (const e of kept) store.telemetry.push(e);
        store.save();
        console.log(`telemetry: прибрано застарілих записів: ${before - kept.length}`);
    }
    return before - kept.length;
};

// Доступні типи цін пристрою (для селектора в каталозі). factor не віддаємо.
router.get('/price-types', (req, res) => {
    // Якщо тип «за замовчуванням» відрізали доступом — основним стає перший доступний
    // (у 1С список типів пристрою теж віддається основним уперед).
    const types = devicePriceTypes(req.device);
    const hasDefault = types.some(t => t.default);
    res.json(types.map((t, i) => ({ id: t.id, name: t.name, default: hasDefault ? !!t.default : i === 0 })));
});

router.get('/products', (req, res) => {
    // Ціни переведені у валюту пристрою (як 1С конвертує з валюти прайсу); currency —
    // числовий код ISO. prices — ціна за КОЖНИМ доступним типом цін (клієнт перемикає без
    // дозавантаження); окремого поля price немає (#57) — тип вибирає клієнт.
    // ?ids=<id,id,…> (#56) — лише вказані товари (точкове оновлення після синхронізації);
    // невідомі id мовчки відкидаються, без ids — весь каталог.
    const idsParam = String(req.query.ids || '');
    const wanted = idsParam ? new Set(idsParam.split(',').filter(Boolean)) : null;
    const currency = deviceCurrency(req.device);
    const types = devicePriceTypes(req.device);
    res.json(deviceProducts(req.device).filter(p => !wanted || wanted.has(String(p.id))).map(p => {
        const prices = {};
        for (const t of types) prices[t.id] = convertPrice(round2(p.price * t.factor), currency);
        const { price: _basePrice, ...rest } = p; // базова price лишається seed-даними, у контракт не йде
        return { ...rest, prices, currency };
    }));
});

// GET /products/:id/image — у 1С повертає Номенклатура.ОсновноеИзображение (бінарно).
// Демо не зберігає бінарних зображень (img — емодзі/URL), тож завжди 404 — як 1С за
// відсутності зображення. Існує для сумісності контракту.
router.get('/products/:id/image', (req, res) => {
    res.status(404).end();
});

// Категорії звужуються під доступні товари (як у 1С, де дерево будується з
// Номенклатура.Родитель відібраних товарів): без обмеження — весь довідник.
router.get('/categories', (req, res) => {
    if (!accessSet(req.device.productIds)) return res.json(store.categories);
    const used = deviceProducts(req.device).map(p => p.categoryId).filter(id => id != null);
    res.json(withAncestors(store.categories, used));
});

// GET /customer-groups (#64) — папки контрагентів (плоско, parentId), як /categories для
// товарів. Фронт будує з них дерево (customer.groupId → батько). У 1С — Контрагенты з ЭтоГруппа.
router.get('/customer-groups', (req, res) => {
    if (!accessSet(req.device.customerIds)) return res.json(store.customerGroups);
    const used = deviceCustomers(req.device).map(c => c.groupId).filter(id => id != null);
    res.json(withAncestors(store.customerGroups, used));
});

router.get('/customers', (req, res) => {
    // Борг — в управлінській валюті (зведений залишок), не у валюті прайсу. debtCurrency
    // підписує його явно; у моці управлінська валюта = грн ("980").
    res.json(deviceCustomers(req.device).map(c => ({ ...c, debtCurrency: '980' })));
});

// GET /customers/:id/ordered-products (#62) — GUID товарів, які контрагент замовляв за всю
// історію (не обмежену глибиною, як /orders). У 1С джерело — обороти регістра
// ЗаказыПокупателей (лише проведені документи); mock без регістрів наближає це як distinct
// productId із непомічених на видалення замовлень контрагента.
router.get('/customers/:id/ordered-products', (req, res) => {
    const { id } = req.params;
    // Недоступний пристрою контрагент — так само «не знайдено» (не підтверджуємо існування).
    if (!customerAllowed(req.device, id)) {
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
    const { endDate } = req.query;
    // Скоуп пристрою: замовлення його контрагентів і не глибше ГлубинаИсторииЗаказов —
    // кап діє НЕЗАЛЕЖНО від фільтра клієнта (як ЗаказыУстройства в 1С; без нього повна
    // історія — десятки МБ на запит).
    const custSet = accessSet(req.device.customerIds);
    const minStart = historyStart(req.device, store.settings.historyDays);
    const startDate = [req.query.startDate, minStart].filter(Boolean).sort().pop();

    let orders = store.orders
        .filter(o => allowed(custSet, o.customerId))
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
    if (!customerAllowed(req.device, effCustomerId)) {
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
            currency: deviceCurrency(req.device), // валюта пристрою на момент створення (заморожується)
            priceType, // вибраний тип цін (обов'язковий для нового, #57)
            comment: comment ?? null, // коментар до замовлення (#60)
        };
        store.orders.push(order);
    }

    store.save();
    res.json({ success: true, order: hydrateOrder(order) });
});

router.put('/orders/:id', (req, res) => {
    const { id } = req.params;
    const { orderItems, customerId, status, date, deletionMark, comment } = req.body;

    const existing = store.orderById(id);
    // Чуже (поза скоупом пристрою) замовлення для нього просто не існує.
    if (!existing || !customerAllowed(req.device, existing.customerId)) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    // Невідомий контрагент при оновленні — 400, а не битий документ.
    if (customerId != null && !customerAllowed(req.device, customerId)) {
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

    store.save();
    res.json({ success: true, order: hydrateOrder(existing) });
});

// Видалити повністю можна лише нове (невідправлене) замовлення. Відправлене/проведене
// НЕ видаляємо, а ставимо помітку на видалення (як ПометкаУдаления в 1С) — лишається
// в списку до фізичного вилучення в обліковій системі.
router.delete('/orders/:id', (req, res) => {
    const { id } = req.params;
    const existing = store.orderById(id);
    if (!existing || !customerAllowed(req.device, existing.customerId)) {
        return res.status(404).json({ success: false, message: msg(req, 'notFound') });
    }

    // Проведене замовлення не можна видалити/позначити з додатку (спершу розпроводять у 1С).
    if (existing.status === "posted") {
        return res.status(409).json({ success: false, message: msg(req, 'cantDeletePosted') });
    }

    if (existing.status === "new") {
        const i = store.orders.indexOf(existing);
        if (i >= 0) store.orders.splice(i, 1);
        store.save();
        return res.json({ success: true, deleted: true, message: msg(req, 'deleted') });
    }

    // Відправлене — помітка на видалення (як ПометкаУдаления в 1С).
    existing.deletionMark = true;
    existing.version = randomUUID();
    store.save();
    res.json({ success: true, marked: true, order: hydrateOrder(existing), message: msg(req, 'marked') });
});

module.exports = router;
module.exports.pruneHistory = pruneHistory; // для планувальника чистки в server.js
