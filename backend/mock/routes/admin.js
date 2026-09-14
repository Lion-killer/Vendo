const express = require('express');
const { randomUUID } = require('crypto');
const store = require('../db');
const { ORDER_MODES, newPairingCode, pruneTelemetry } = require('../lib/devices');
const { PRICE_TYPES } = require('../lib/orders');

// Адмінка демо-стенду (#85): керування пристроями, телеметрія, правка демо-даних.
// Дзеркалить те, що оператор робить у 1С у довіднику венд_МобильныеУстройства.
const router = express.Router();

// --- Доступ ---
// Стенд публікується тунелем назовні, тому адмінка відповідає ЛИШЕ на локальні запити.
// Трьох ознак разом достатньо, бо ssh -R приносить запити з тунелю теж із 127.0.0.1:
// адреса сокета локальна, Host — localhost, і немає proxy-заголовків (їх додає тунель).
// ADMIN_ALLOW_REMOTE=1 — свідомий виняток для стенду на віддаленій машині.
const LOCAL_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const isLocal = (req) => {
    if (!LOCAL_IPS.includes(req.socket.remoteAddress || '')) return false;
    if (req.get('x-forwarded-for') || req.get('x-forwarded-host') || req.get('x-forwarded-proto')) return false;
    const host = String(req.get('host') || '').split(':')[0].toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
};
const localOnly = (req, res, next) => {
    if (process.env.ADMIN_ALLOW_REMOTE === '1' || isLocal(req)) return next();
    res.status(403).json({ error: 'admin_local_only', message: 'Адмінка доступна лише з локальної машини' });
};
router.use(localOnly);

// --- Демо-дані ---

// Колекції, які адмінка редагує напряму. devices мають власні роути (нижче):
// тут вони теж є, але поля прив'язки з тіла запиту вирізаються.
const COLLECTIONS = {
    products: store.products, customers: store.customers, categories: store.categories,
    customerGroups: store.customerGroups, orders: store.orders,
    warehouses: store.warehouses, currencies: store.currencies, managers: store.managers,
    devices: store.devices,
};
// Рантайм-стан прив'язки правиться тільки службовими роутами, не редактором таблиць.
const PROTECTED = ['tokenHash', 'pairingCode'];
const strip = (body) => { const b = { ...body }; for (const k of PROTECTED) delete b[k]; return b; };

const collection = (req, res) => {
    const list = COLLECTIONS[req.params.name];
    if (!list) res.status(404).json({ error: 'unknown_collection' });
    return list || null;
};
// id порівнюємо рядками: categories мають числові id, решта — GUID.
const findIn = (list, id) => list.find(x => String(x.id) === String(id));

router.get('/collection/:name', (req, res) => {
    const list = collection(req, res);
    if (list) res.json(list);
});

router.post('/collection/:name', (req, res) => {
    const list = collection(req, res);
    if (!list) return;
    const item = { ...strip(req.body || {}) };
    if (item.id == null || item.id === '') item.id = randomUUID();
    if (findIn(list, item.id)) return res.status(409).json({ error: 'duplicate_id' });
    list.push(item);
    store.save();
    res.json(item);
});

router.put('/collection/:name/:id', (req, res) => {
    const list = collection(req, res);
    if (!list) return;
    const item = findIn(list, req.params.id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    Object.assign(item, strip(req.body || {}), { id: item.id }); // id незмінний
    if (list === store.devices && item.blocked) item.tokenHash = null; // блокування відкликає токен
    store.save();
    res.json(item);
});

router.delete('/collection/:name/:id', (req, res) => {
    const list = collection(req, res);
    if (!list) return;
    const i = list.findIndex(x => String(x.id) === String(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'not_found' });
    const [removed] = list.splice(i, 1);
    // Разом із пристроєм прибираємо його історію телеметрії (як ОчиститьСостояние у 1С).
    if (list === store.devices) {
        const kept = store.telemetry.filter(e => e.deviceId !== removed.id);
        store.telemetry.length = 0;
        for (const e of kept) store.telemetry.push(e);
    }
    store.save();
    res.json({ ok: true });
});

// --- Пристрої: прив'язка й запит логу ---

// Новий код прив'язки. Токен ВІДКЛИКАЄТЬСЯ (як у 1С при перегенерації) — застосунок на
// наступному запиті отримає 401 і вийде на екран входу (#40).
router.post('/devices/:id/pairing-code', (req, res) => {
    const dev = store.deviceById(req.params.id);
    if (!dev) return res.status(404).json({ error: 'not_found' });
    dev.pairingCode = newPairingCode();
    dev.tokenHash = null;
    store.save();
    res.json({ code: dev.pairingCode });
});

router.post('/devices/:id/request-log', (req, res) => {
    const dev = store.deviceById(req.params.id);
    if (!dev) return res.status(404).json({ error: 'not_found' });
    dev.requestLog = req.body?.requestLog !== false;
    store.save();
    res.json({ requestLog: dev.requestLog });
});

// Історія снапшотів пристрою, найсвіжіші першими. Лог у список не тягнемо (важкий) —
// віддаємо його довжину; повний текст — окремим запитом за індексом.
router.get('/devices/:id/telemetry', (req, res) => {
    const list = store.telemetry
        .filter(e => e.deviceId === String(req.params.id))
        .map((e, i) => ({ ...e, i, log: undefined, logSize: e.log ? e.log.length : 0 }))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res.json(list);
});

router.get('/devices/:id/telemetry/:i/log', (req, res) => {
    const e = store.telemetry.filter(x => x.deviceId === String(req.params.id))[Number(req.params.i)];
    if (!e || !e.log) return res.status(404).type('text/plain').send('лог не надсилався');
    res.type('text/plain; charset=utf-8').send(e.log);
});

// --- Стан стенду ---

router.get('/state', (req, res) => {
    // Зріз останніх снапшотів по пристроях — те, що 1С показує колонками списку пристроїв.
    const last = new Map();
    for (const e of store.telemetry) {
        const prev = last.get(e.deviceId);
        if (!prev || String(e.at) > String(prev.at)) last.set(e.deviceId, e);
    }
    res.json({
        devices: store.devices.map(d => ({
            ...d, tokenHash: undefined, paired: !!d.tokenHash,
            last: last.get(d.id) ? { ...last.get(d.id), log: undefined, logSize: last.get(d.id).log?.length || 0 } : null,
        })),
        warehouses: store.warehouses, currencies: store.currencies, managers: store.managers,
        priceTypes: PRICE_TYPES.map(t => ({ id: t.id, name: t.name })),
        orderModes: ORDER_MODES,
        settings: store.settings,
        counts: {
            products: store.products.length, customers: store.customers.length,
            categories: store.categories.length, customerGroups: store.customerGroups.length,
            orders: store.orders.length, telemetry: store.telemetry.length,
        },
    });
});

router.put('/settings', (req, res) => {
    const b = req.body || {};
    // Інтервали: 0 — валідне значення («цикл вимкнено», #68), тому просто числа.
    for (const k of ['syncSec', 'pingSec', 'telemetrySec', 'historyDays', 'telemetryKeepDays']) {
        if (b[k] !== undefined) store.settings[k] = Math.max(0, Number(b[k]) || 0);
    }
    if (b.minAppVersion) store.settings.minAppVersion = String(b.minAppVersion).trim();
    if (b.currency) store.settings.currency = String(b.currency).trim();
    store.save();
    res.json(store.settings);
});

// Чистка історії телеметрії руками (та сама логіка, що за розкладом).
router.post('/telemetry/prune', (req, res) => {
    const before = store.telemetry.length;
    const kept = pruneTelemetry(store.telemetry, store.settings.telemetryKeepDays);
    store.telemetry.length = 0;
    for (const e of kept) store.telemetry.push(e);
    store.save();
    res.json({ removed: before - kept.length });
});

// «Завантажити дані за замовчуванням» — стан видаляється, повертається сід db.json
// (разом із пристроями: демо-пристрій отримує назад свій код прив'язки із сіду).
router.post('/reset', (req, res) => {
    store.resetToSeed();
    res.json({ ok: true });
});

module.exports = router;
module.exports.localOnly = localOnly; // тим же обмеженням закриваємо статику адмінки
