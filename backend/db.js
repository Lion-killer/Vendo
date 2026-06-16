const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'data', 'vendo.db');
const SEED_FILE = path.join(__dirname, 'data', 'db.json');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');   // кращий конкурентний доступ читання/запису
db.pragma('foreign_keys = ON');

// --- Схема ---
db.exec(`
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        sku TEXT,
        price REAL NOT NULL DEFAULT 0,
        stock INTEGER NOT NULL DEFAULT 0,
        unit TEXT,
        category TEXT,
        img TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        city TEXT,
        contact TEXT,
        phone TEXT,
        debt REAL NOT NULL DEFAULT 0,
        status TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        count INTEGER NOT NULL DEFAULT 0,
        expanded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
        num TEXT PRIMARY KEY,
        customerId INTEGER,
        date TEXT NOT NULL,
        status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderNum TEXT NOT NULL,
        productId INTEGER,
        qty INTEGER NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (orderNum) REFERENCES orders(num) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_orderNum ON order_items(orderNum);

    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );
`);

// --- Одноразовий сід із db.json (лише якщо БД порожня) ---
const seedIfEmpty = () => {
    const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
    if (count > 0) return;
    if (!fs.existsSync(SEED_FILE)) return;

    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

    const insertProduct = db.prepare(
        `INSERT INTO products (id, name, sku, price, stock, unit, category, img)
         VALUES (@id, @name, @sku, @price, @stock, @unit, @category, @img)`
    );
    const insertCustomer = db.prepare(
        `INSERT INTO customers (id, name, code, city, contact, phone, debt, status)
         VALUES (@id, @name, @code, @city, @contact, @phone, @debt, @status)`
    );
    const insertCategory = db.prepare(
        `INSERT INTO categories (id, name, icon, count, expanded)
         VALUES (@id, @name, @icon, @count, @expanded)`
    );
    const insertOrder = db.prepare(
        `INSERT INTO orders (num, customerId, date, status) VALUES (@num, @customerId, @date, @status)`
    );
    const insertItem = db.prepare(
        `INSERT INTO order_items (orderNum, productId, qty, price) VALUES (@orderNum, @productId, @qty, @price)`
    );
    const setMeta = db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);

    const seedAll = db.transaction(() => {
        (seed.products || []).forEach(p => insertProduct.run(p));
        (seed.customers || []).forEach(c => insertCustomer.run(c));
        (seed.categories || []).forEach(c => insertCategory.run({ ...c, expanded: c.expanded ? 1 : 0 }));
        (seed.orders || []).forEach(o => {
            insertOrder.run({ num: o.num, customerId: o.customerId ?? null, date: o.date, status: o.status });
            (o.items || []).forEach(it => insertItem.run({
                orderNum: o.num,
                productId: it.productId ?? it.product?.id ?? null,
                qty: it.qty,
                price: it.price ?? it.product?.price ?? 0
            }));
        });

        const maxSeq = (seed.orders || []).reduce((max, o) => {
            const m = /^ЗМ-(\d+)$/.exec(o.num || '');
            return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 2025);
        const seq = seed.meta?.lastOrderSeq ?? maxSeq;
        setMeta.run('lastOrderSeq', String(seq));
    });

    seedAll();
    console.log('SQLite seeded from db.json');
};

seedIfEmpty();

module.exports = db;
