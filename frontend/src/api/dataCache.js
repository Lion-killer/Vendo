// Кеш колекцій (products/categories/customers/orders) в IndexedDB. Раніше жив у
// localStorage ('cached_data_v2') і впирався в його ліміт ~5 МБ: великий знімок кидав
// QuotaExceeded, а синхронний JSON.stringify великих даних фризив UI кожен цикл.
// IndexedDB зберігає об'єкти без stringify (structured clone) і пише асинхронно.
// Патерн той самий, що в imageCache.js (кеш зображень у сусідній базі vendo_images).

const DB_NAME = 'vendo_data';
const STORE = 'kv';
let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('no-idb')); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function store(mode) {
    return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
}

export async function dataGet(key) {
    try {
        const s = await store('readonly');
        return await new Promise((res) => { const r = s.get(key); r.onsuccess = () => res(r.result ?? null); r.onerror = () => res(null); });
    } catch (e) { return null; }
}

export async function dataPut(key, value) {
    try {
        const s = await store('readwrite');
        return await new Promise((res) => { const r = s.put(value, key); r.onsuccess = () => res(true); r.onerror = () => res(false); });
    } catch (e) { return false; }
}

// Повне очищення (кнопка «Очистити дані» #34 і purge при зміні пристрою): закриваємо
// з'єднання й видаляємо базу — наступний доступ відкриє її заново.
export function clearDataCache() {
    try {
        if (dbPromise) { dbPromise.then(db => { try { db.close(); } catch (e) { } }); dbPromise = null; }
        if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB_NAME);
    } catch (e) { /* не критично */ }
}
