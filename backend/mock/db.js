const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// In-memory мок-стор. Сід із db.json при старті, мутації — в пам'яті; на рестарті
// чистий сід (мок навмисно не персистить). Жодних залежностей/нативних модулів.
// Замовлення нормалізовані: посилання на товар/контрагента + зафіксована ціна per-рядок
// (snapshot), items вбудовані в запис. Гідратація — на віддачі (routes/api.js).
const SEED_FILE = path.join(__dirname, 'data', 'db.json');
const seed = fs.existsSync(SEED_FILE) ? JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) : {};

const products = (seed.products || []).map(p => ({
    id: p.id, name: p.name, sku: p.sku ?? null, barcode: p.barcode ?? null,
    price: p.price ?? 0, stock: p.stock ?? 0, unit: p.unit ?? null,
    category: p.category ?? null, categoryId: p.categoryId ?? null, img: p.img ?? null,
}));

const customers = (seed.customers || []).map(c => ({
    id: c.id, name: c.name, code: c.code ?? null, address: c.address ?? null,
    contact: c.contact ?? null, phone: c.phone ?? null,
    contacts: c.contacts ?? undefined, debt: c.debt ?? 0, status: c.status ?? null,
    groupId: c.groupId ?? null, // папка-батько в довіднику (#64); null = корінь
}));

// Папки контрагентів (#64) — плоский список із parentId, як categories для товарів.
const customerGroups = (seed.customerGroups || []).map(g => ({
    id: g.id, name: g.name, parentId: g.parentId ?? null,
}));

const categories = (seed.categories || []).map(c => ({
    id: c.id, name: c.name, parentId: c.parentId ?? null, icon: c.icon ?? null,
    count: c.count ?? 0, expanded: !!c.expanded,
}));

const orders = (seed.orders || []).map(o => ({
    id: o.id, num: o.num ?? null, customerId: o.customerId ?? null,
    date: o.date, status: o.status, deletionMark: !!o.deletionMark,
    version: o.version ?? randomUUID(), comment: o.comment ?? null,
    items: (o.items || []).map(it => ({
        productId: it.productId ?? it.product?.id ?? null,
        qty: it.qty, price: it.price ?? it.product?.price ?? 0,
    })),
}));

// Лічильник номерів (ЗМ-N): із сіду або з найбільшого наявного, мінімум 2025.
const maxSeq = (seed.orders || []).reduce((max, o) => {
    const m = /^ЗМ-(\d+)$/.exec(o.num || '');
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
}, 2025);
const meta = { lastOrderSeq: seed.meta?.lastOrderSeq ?? maxSeq };

// Телеметрія (#42): requestLog — прапорець «запросити повний лог» (в 1С живе на пристрої,
// тут — у сіді для тестування UI); last — останній прийнятий снапшот (лише для дебагу).
const telemetry = { requestLog: !!seed.telemetry?.requestLog, last: null };

console.log('In-memory store seeded from db.json');

module.exports = {
    products, customers, categories, customerGroups, orders, meta, telemetry,
    productById: (id) => products.find(p => p.id === id) || null,
    customerById: (id) => customers.find(c => c.id === id) || null,
    orderById: (id) => orders.find(o => o.id === id) || null,
};
