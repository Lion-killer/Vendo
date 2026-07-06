// Офлайн-кеш зображень товарів у IndexedDB (вимога клієнта — усі фото мають бути доступні
// офлайн). Ключ — відносний шлях ендпоінта ("/products/{id}/image"), значення — Blob.
// Стратегія: cache-first (швидко й офлайн); промах → мережа → запис у кеш.

import { IDB_IMAGES } from '../storageKeys';

const DB_NAME = IDB_IMAGES;
const STORE = 'imgs';
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

export async function idbGet(key) {
  const s = await store('readonly');
  return new Promise((res) => { const r = s.get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
}

export async function idbPut(key, blob) {
  const s = await store('readwrite');
  return new Promise((res) => { const r = s.put(blob, key); r.onsuccess = () => res(true); r.onerror = () => res(false); });
}

// Розбір шляху "/products/{id}/image?v=XXX" → { base, ver }. Ключ кешу — base (один запис
// на товар), у записі тримаємо ver — тож зміна версії зображення інвалідовує кеш без
// розростання (старий blob перезаписується новим, а не накопичується під новим ключем).
function parsePath(path) {
  const qi = path.indexOf('?');
  if (qi < 0) return { base: path, ver: '' };
  const m = /[?&]v=([^&]*)/.exec(path);
  return { base: path.slice(0, qi), ver: m ? m[1] : '' };
}

// Повертає blob-URL зображення. Якщо в кеші є запис із ТАКОЮ Ж версією — віддаємо його
// (швидко/офлайн). Інакше тягнемо з мережі й оновлюємо кеш. Якщо мережа недоступна —
// фолбек на останній кешований blob (хай застарілий), щоб офлайн усе одно щось показати.
export async function loadCachedImage(path, fetchRaw) {
  const { base, ver } = parsePath(path);
  let rec = null;
  try { rec = await idbGet(base); } catch (e) { /* немає IndexedDB — лишаємось на мережі */ }
  if (rec && rec.ver === ver && rec.blob) return URL.createObjectURL(rec.blob);

  const blob = await fetchRaw(path);
  if (blob) {
    try { await idbPut(base, { ver, blob }); } catch (e) { /* кеш недоступний — не критично */ }
    return URL.createObjectURL(blob);
  }
  // Офлайн/помилка: краще показати останнє кешоване (хай інша версія), ніж нічого.
  if (rec && rec.blob) return URL.createObjectURL(rec.blob);
  return null;
}

// Повне очищення кешу зображень (для кнопки «Очистити дані», #34). Закриваємо з'єднання
// й видаляємо всю БД — наступний доступ відкриє її заново.
export function clearImageCache() {
  try {
    if (dbPromise) { dbPromise.then(db => { try { db.close(); } catch (e) {} }); dbPromise = null; }
    if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase(DB_NAME);
  } catch (e) { /* ігноруємо — не критично */ }
}

// Проактивне кешування всіх переданих шляхів (фонове, послідовне). Пропускаємо ті, що вже
// в кеші з актуальною версією; решту (нові або зі зміненим фото) — перекешовуємо.
export async function prefetchImages(paths, fetchRaw) {
  for (const p of paths) {
    try {
      const { base, ver } = parsePath(p);
      const rec = await idbGet(base);
      if (rec && rec.ver === ver) continue;   // актуальна версія вже є
      const blob = await fetchRaw(p);
      if (blob) await idbPut(base, { ver, blob });
    } catch (e) { /* пропускаємо проблемний шлях, не валимо весь prefetch */ }
  }
}
