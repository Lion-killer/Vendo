const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Стор мок-стенду. Дані живуть у пам'яті, але тепер ПЕРЕЖИВАЮТЬ перезапуск (#85):
//   data/db.json       — еталонний сід, у git, у рантаймі НЕ переписується;
//   data/db.state.json — робочий стан (gitignore), пишеться після кожної мутації.
// При старті читається стан, якщо він є, інакше сід. Адмінка вміє видалити стан
// («Завантажити дані за замовчуванням») і повернутися до сіду.
//
// Замовлення нормалізовані: посилання на товар/контрагента + зафіксована ціна per-рядок
// (snapshot), items вбудовані в запис. Гідратація — на віддачі (routes/api.js).
const SEED_FILE = path.join(__dirname, 'data', 'db.json');
const STATE_FILE = path.join(__dirname, 'data', 'db.state.json');

// Посилання на масиви стабільні (routes/* тримають їх у замиканнях), тому
// перезавантаження наповнює ті самі об'єкти, а не підмінює їх.
const products = [], customers = [], customerGroups = [], categories = [], orders = [];
const devices = [], warehouses = [], currencies = [], managers = [], telemetry = [];
const meta = { lastOrderSeq: 0 };
const settings = {};

// Умолчання налаштувань стенду — дзеркалять значення 1С (ManagerModule довідника
// пристроїв). Інтервали: 0 = цикл у додатку вимкнено (#68), тому 0 тут — валідне значення.
const DEFAULT_SETTINGS = {
    syncSec: 300, pingSec: 15, telemetrySec: 900,
    minAppVersion: '0.1.0',
    currency: '980',          // валюта стенду; картка пристрою може перекрити
    historyDays: 30,          // глибина історії замовлень за умовчанням
    telemetryKeepDays: 30,    // строк зберігання історії телеметрії
};

const fill = (arr, items) => { arr.length = 0; for (const it of items) arr.push(it); };

const normalize = (raw) => {
    fill(products, (raw.products || []).map(p => ({
        id: p.id, name: p.name, sku: p.sku ?? null, barcode: p.barcode ?? null,
        price: p.price ?? 0, stock: p.stock ?? 0, unit: p.unit ?? null,
        category: p.category ?? null, categoryId: p.categoryId ?? null, img: p.img ?? null,
    })));

    fill(customers, (raw.customers || []).map(c => ({
        id: c.id, name: c.name, code: c.code ?? null, address: c.address ?? null,
        contact: c.contact ?? null, phone: c.phone ?? null,
        contacts: c.contacts ?? undefined, debt: c.debt ?? 0, status: c.status ?? null,
        groupId: c.groupId ?? null, // папка-батько в довіднику (#64); null = корінь
    })));

    // Папки контрагентів (#64) — плоский список із parentId, як categories для товарів.
    fill(customerGroups, (raw.customerGroups || []).map(g => ({
        id: g.id, name: g.name, parentId: g.parentId ?? null,
    })));

    fill(categories, (raw.categories || []).map(c => ({
        id: c.id, name: c.name, parentId: c.parentId ?? null, icon: c.icon ?? null,
        count: c.count ?? 0, expanded: !!c.expanded,
    })));

    fill(orders, (raw.orders || []).map(o => ({
        id: o.id, num: o.num ?? null, customerId: o.customerId ?? null,
        date: o.date, status: o.status, deletionMark: !!o.deletionMark,
        version: o.version ?? randomUUID(), comment: o.comment ?? null,
        currency: o.currency ?? null, priceType: o.priceType ?? null,
        items: (o.items || []).map(it => ({
            productId: it.productId ?? it.product?.id ?? null,
            qty: it.qty, price: it.price ?? it.product?.price ?? 0,
        })),
    })));

    // Прості таблиці стенду (#85): у 1С це довідники УТ, тут — плоскі {id, name}.
    fill(warehouses, (raw.warehouses || []).map(w => ({ id: w.id, name: w.name })));
    fill(currencies, (raw.currencies || []).map(c => ({ id: String(c.id), name: c.name })));
    fill(managers, (raw.managers || []).map(m => ({ id: m.id, name: m.name })));

    // Пристрої — за зразком довідника венд_МобильныеУстройства. tokenHash/pairingCode —
    // рантайм-стан прив'язки (у 1С він у ХранилищеОбщихНастроек, не в елементі довідника).
    fill(devices, (raw.devices || []).map(d => ({
        id: String(d.id), name: d.name ?? '',
        warehouseId: d.warehouseId ?? null, currencyId: d.currencyId ? String(d.currencyId) : null,
        managerId: d.managerId ?? null,
        historyDays: d.historyDays ?? 0, orderMode: d.orderMode || 'create',
        blocked: !!d.blocked,
        customerIds: d.customerIds || [], productIds: d.productIds || [], priceTypeIds: d.priceTypeIds || [],
        pairingCode: d.pairingCode ?? '', tokenHash: d.tokenHash ?? null, requestLog: !!d.requestLog,
    })));

    // Історія телеметрії — плоский журнал снапшотів (аналог періодичного регістра).
    fill(telemetry, (Array.isArray(raw.telemetry) ? raw.telemetry : []).filter(e => e && e.at));

    // Лічильник номерів (ЗМ-N): із файлу або з найбільшого наявного, мінімум 2025.
    const maxSeq = orders.reduce((max, o) => {
        const m = /^ЗМ-(\d+)$/.exec(o.num || '');
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 2025);
    meta.lastOrderSeq = raw.meta?.lastOrderSeq ?? maxSeq;

    Object.assign(settings, DEFAULT_SETTINGS, raw.settings || {});
};

const snapshot = () => ({
    products, customers, customerGroups, categories, orders,
    warehouses, currencies, managers, devices, telemetry, meta, settings,
});

// Запис стану дебаунситься: серія мутацій в одному запиті дає один запис на диск.
// unref — таймер не тримає процес живим при Ctrl+C.
let saveTimer = null;
const flush = () => {
    saveTimer = null;
    if (process.env.VENDO_NO_PERSIST === '1') return; // тести не залишають db.state.json
    try { fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot(), null, 2), 'utf8'); }
    catch (e) { console.error('state save failed:', e.message); }
};
const save = () => {
    if (saveTimer) return;
    saveTimer = setTimeout(flush, 200);
    if (saveTimer.unref) saveTimer.unref();
};

const load = (preferState = true) => {
    const file = preferState && fs.existsSync(STATE_FILE) ? STATE_FILE : SEED_FILE;
    normalize(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
    return file;
};

// «Завантажити дані за замовчуванням»: стан видаляється, читається сід.
const resetToSeed = () => {
    try { fs.unlinkSync(STATE_FILE); } catch (e) { /* стану могло й не бути */ }
    load(false);
    save(); // одразу фіксуємо чистий стан, щоб рестарт не залежав від наявності файлу
};

const loadedFrom = load();
console.log(`In-memory store seeded from ${path.basename(loadedFrom)}`);

module.exports = {
    products, customers, categories, customerGroups, orders,
    warehouses, currencies, managers, devices, telemetry, meta, settings,
    save, resetToSeed, snapshot, STATE_FILE,
    productById: (id) => products.find(p => p.id === id) || null,
    customerById: (id) => customers.find(c => c.id === id) || null,
    orderById: (id) => orders.find(o => o.id === id) || null,
    deviceById: (id) => devices.find(d => d.id === String(id)) || null,
};
