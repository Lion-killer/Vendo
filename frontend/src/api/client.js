import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { logInfo, logWarn, logError } from '../logger';

// Адреса бекенду береться з QR-коду (зберігається в localStorage під час логіну).
// Пріоритет: QR (localStorage) → VITE_API_URL (.env, dev-дефолт) → хардкод-фолбек.
// Підказки для емулятора (10.0.2.2) і реального пристрою (LAN IP) — у README.
const DEFAULT_API = import.meta.env.VITE_API_URL || 'http://10.0.2.2:3000/api';

const apiUrl = () => localStorage.getItem('vendo_api_url') || DEFAULT_API;
const deviceId = () => localStorage.getItem('vendo_device_id') || '';
const token = () => localStorage.getItem('vendo_token') || '';

// Заголовки: X-Device-Id — ідентифікатор пристрою (за ним 1С фільтрує дані),
// Authorization: Bearer — секретний токен (видається в /auth в обмін на код прив'язки).
const h = (extra = {}) => {
    const headers = { ...extra };
    const d = deviceId();
    if (d) headers['X-Device-Id'] = d;
    // Токен носимо в X-Auth-Token, а НЕ в Authorization: заголовок Authorization 1С
    // перехоплює для автентифікації до ІБ (Bearer там → 401 ще до обробника сервісу).
    const tk = token();
    if (tk) headers['X-Auth-Token'] = tk;
    // #26: мова інтерфейсу → бекенд локалізує message-рядки (uk/ru/en).
    const lang = localStorage.getItem('vendo_lang');
    if (lang) headers['Accept-Language'] = lang;
    // #42: пасивна телеметрія — 1С тротльовано оновлює активність/версію пристрою.
    if (typeof __APP_VERSION__ !== 'undefined') headers['X-App-Version'] = __APP_VERSION__;
    return headers;
};

// #40: 401 на запит, надісланий із ПОТОЧНИМ токеном, означає що токен відкликано на
// сервері (перегенерація коду прив'язки) — детермінований сигнал «пристрій відв'язано».
// 401 від запиту зі старим токеном (гонка при перелогіні) ігнорується. App реєструє
// обробник, який виводить на екран входу.
let onAuthReject = null;
export const setOnAuthReject = (fn) => { onAuthReject = fn; };
const maybeAuthReject = (sentToken) => {
    if (sentToken && sentToken === token() && onAuthReject) onAuthReject();
};

// fetch із таймаутом — без нього недоступний бекенд висить до системного TCP-таймауту
// (~30 с) і офлайн виявляється надто пізно.
// Таймаут АДАПТИВНИЙ, per-ендпоінт: бойова 1С відповідає легітимно довго (велика
// історія замовлень — TTFB 20+ с), і фіксована стеля обривала такі запити назавжди.
// Запас = остання успішна TTFB × 3 (не менше базових 25 с, не більше 120 с); після
// таймауту оцінка піднімається до чинного таймауту — наступна спроба дістає більше
// часу (25 → 75 → 120 с), а успіх калібрує оцінку назад до реальної швидкості.
// Оцінки переживають перезапуск (localStorage; чистяться разом з даними пристрою).
const TIMEOUT = 25000;      // базовий (він же мінімум)
const TIMEOUT_MAX = 120000; // стеля — довше не чекаємо ніколи
const TIMES_KEY = 'vendo_net_times';
const netTimes = (() => { try { return JSON.parse(localStorage.getItem(TIMES_KEY)) || {}; } catch { return {}; } })();
const saveNetTimes = () => { try { localStorage.setItem(TIMES_KEY, JSON.stringify(netTimes)); } catch { /* не критично */ } };
const timeoutFor = (path) => Math.min(Math.max(TIMEOUT, (netTimes[path] || 0) * 3), TIMEOUT_MAX);
// Шлях без хоста — для компактного логу (метод + ендпоінт, без секретів у query немає).
const shortPath = (url) => { try { return new URL(url).pathname; } catch { return url; } };
const tfetch = async (url, opts = {}, timeout) => {
    const method = (opts.method || 'GET').toUpperCase();
    const path = shortPath(url);
    const limit = timeout || timeoutFor(path); // явний аргумент (пінг) не адаптується
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), limit);
    const started = Date.now();
    try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        const ms = Date.now() - started;
        if (!timeout) { netTimes[path] = ms; saveNetTimes(); }
        (res.ok ? logInfo : logWarn)(`${method} ${path} → ${res.status}`, `${ms}ms`);
        // authReject:false — запит не бере участі в детекторі відв'язки (#40): 401 такого
        // запиту може означати не відкликаний токен, а відсутнє право на метод у 1С
        // (телеметрія на старішій конфігурації) — з сесії за це не викидаємо.
        if (res.status === 401 && opts.authReject !== false) maybeAuthReject(opts.headers && opts.headers['X-Auth-Token']);
        return res;
    } catch (e) {
        const aborted = e && e.name === 'AbortError';
        if (aborted && !timeout) { netTimes[path] = limit; saveNetTimes(); } // ескалація на наступну спробу
        logError(`${method} ${path} → помилка мережі`, aborted ? `таймаут ${limit}ms` : String(e && e.message || e));
        throw e;
    } finally {
        clearTimeout(id);
    }
};

// Обмін одноразового коду прив'язки на bearer-токен. Токен зберігаємо локально —
// далі ним підписуються всі запити (див. h()). На цьому етапі токена ще немає,
// тому Authorization не шлемо.
export const auth = async (devId, pairingCode) => {
    const res = await tfetch(`${apiUrl()}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(devId ? { 'X-Device-Id': devId } : {}) },
        body: JSON.stringify({ deviceId: devId || deviceId(), pairingCode }),
    });
    const data = await res.json();
    if (data.success && data.token) localStorage.setItem('vendo_token', data.token);
    return data;
};

export const fetchProducts = async () =>
    (await tfetch(`${apiUrl()}/products`, { headers: h() })).json();

export const fetchCustomers = async () =>
    (await tfetch(`${apiUrl()}/customers`, { headers: h() })).json();

export const fetchCategories = async () =>
    (await tfetch(`${apiUrl()}/categories`, { headers: h() })).json();

// Доступні типи цін пристрою (для селектора в каталозі): [{ id, name, default }].
export const fetchPriceTypes = async () =>
    (await tfetch(`${apiUrl()}/price-types`, { headers: h() })).json();

// Завантажити захищене бінарне зображення за відносним шляхом API (напр. поле Product.img
// = "/products/{id}/image") і повернути blob-URL для <img src>. Заголовки (X-Device-Id +
// bearer) додаються, бо ендпоінт захищений і голий <img src> не пройшов би. null — якщо
// немає (404). Викликач має зробити URL.revokeObjectURL(url) при розмонтуванні.
export const fetchAuthedBlob = async (relPath) => {
    const blob = await fetchAuthedBlobRaw(relPath);
    return blob ? URL.createObjectURL(blob) : null;
};

// base64 → Blob (для бінарних відповідей CapacitorHttp на нативі).
const base64ToBlob = (b64, type) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'application/octet-stream' });
};

// Сирий Blob (для кешу в IndexedDB — imageCache). null при помилці/404.
// На нативі (CapacitorHttp) патчений fetch НЕ повертає коректний blob для бінарних
// відповідей, тому беремо нативний CapacitorHttp.get з responseType:'blob' (base64) і
// конвертуємо. У вебі/dev — звичайний fetch.
export const fetchAuthedBlobRaw = async (relPath) => {
    try {
        const url = `${apiUrl()}${relPath}`;
        if (Capacitor.isNativePlatform()) {
            const headers = h();
            const res = await CapacitorHttp.get({ url, headers, responseType: 'blob' });
            if (res.status === 401) maybeAuthReject(headers['X-Auth-Token']);
            if (res.status < 200 || res.status >= 300 || !res.data) return null;
            const ct = res.headers && (res.headers['Content-Type'] || res.headers['content-type']);
            return base64ToBlob(res.data, ct);
        }
        const res = await tfetch(url, { headers: h() });
        if (!res.ok) return null;
        return await res.blob();
    } catch (e) {
        return null;
    }
};

// Основне зображення товару за id (зручний шорткат над fetchAuthedBlob).
export const fetchProductImage = (id) => fetchAuthedBlob(`/products/${id}/image`);

export const fetchOrders = async (startDate, endDate) => {
    let url = `${apiUrl()}/orders`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += `?${params.toString()}`;
    return (await tfetch(url, { headers: h() })).json();
};

// Позиції на дріт у нормалізованому вигляді { productId, qty, price } (ціна-snapshot):
// бекенду не потрібен повний обʼєкт товару (name/img/stock), а 1С читає плоскі ключі.
// Толерує старий формат черги ({ product: {...}, qty }) — чернетки, збережені до оновлення.
const wireItems = (orderItems) => (orderItems || []).map(it => ({
    productId: it.productId ?? it.product?.id,
    qty: it.qty,
    price: it.price ?? it.product?.price ?? 0,
}));

// id — клієнтський GUID замовлення; сервер робить upsert за ним (ідемпотентно).
// baseVersion — токен версії (як ВерсияДанных у 1С), від якої редагували: сервер виявляє
// конфлікт (409), якщо запис відтоді змінився. Відсутній baseVersion = перезаписати.
// deletionMark=false — зняти помітку видалення при upsert (для «перезаписати моє» над
// видаленим на сервері). Якщо не передано — помітку не чіпаємо.
export const createOrder = async (id, orderItems, customerId, total, status = "Нове", date, baseVersion, deletionMark, priceType) =>
    (await tfetch(`${apiUrl()}/orders`, {
        method: 'POST',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, orderItems: wireItems(orderItems), customerId, total, status, date, baseVersion, ...(deletionMark === false ? { deletionMark: false } : {}), ...(priceType ? { priceType } : {}) }),
    })).json();

export const updateOrder = async (id, orderItems, customerId, total, status, date, priceType) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, {
        method: 'PUT',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ orderItems: wireItems(orderItems), customerId, total, status, date, ...(priceType ? { priceType } : {}) }),
    })).json();

// baseVersion — токен версії на момент, коли додаток бачив замовлення: 1С виявляє
// конфлікт (409), якщо помітку/вміст відтоді змінили (видалення/відновлення теж міняють
// ВерсияДанных). Відсутній baseVersion = беззастережно (force).
export const deleteOrder = async (id, baseVersion) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, {
        method: 'DELETE',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ baseVersion }),
    })).json();

// Зняти помітку на видалення (PUT із deletionMark:false; інші поля не чіпаємо).
export const restoreOrder = async (id, baseVersion) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, {
        method: 'PUT',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ deletionMark: false, baseVersion }),
    })).json();

// #42: снапшот телеметрії (стан пристрою; опційно лог). Відповідь: { ok, requestLog }.
// authReject:false — телеметрія допоміжна: її 401 (немає права на метод у старішій 1С)
// не повинен викидати користувача з сесії, як це робить 401 основних даних (#40).
export const postTelemetry = async (payload) =>
    (await tfetch(`${apiUrl()}/telemetry`, {
        method: 'POST',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        authReject: false,
    })).json();

// Найдешевший пінг доступності: HEAD /health (без авторизації, без БД, без тіла) —
// 1С-шаблон /health має окремий HEAD-метод (HealthHead → порожній 200), Node теж.
export const pingServer = async () => {
    try {
        const res = await tfetch(`${apiUrl()}/health`, { method: 'HEAD' }, 5000);
        return res.ok;
    } catch (e) {
        return false;
    }
};
