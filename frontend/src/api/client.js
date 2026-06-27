import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { logInfo, logWarn, logError } from '../logger';

// Адреса бекенду й ідентифікатор пристрою беруться з QR-коду (зберігаються в
// localStorage під час логіну). DEFAULT_API — запасний для dev/емулятора.
const DEFAULT_API = 'http://10.0.2.2:3000/api';
// Емулятор Android: хост = 10.0.2.2. Реальний пристрій — адреса з QR-коду.

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
    return headers;
};

// fetch із таймаутом — без нього недоступний бекенд висить до системного TCP-таймауту
// (~30 с) і офлайн виявляється надто пізно.
// Бойова 1С повільна й обробляє запити послідовно — одиничний запит легітимно триває
// 4–7 с, а під чергою з кількох паралельних ще більше. Таймаут має це покривати, інакше
// додаток хибно «офлайнить». 25с — стеля; реально швидше.
const TIMEOUT = 25000;
// Шлях без хоста — для компактного логу (метод + ендпоінт, без секретів у query немає).
const shortPath = (url) => { try { return new URL(url).pathname; } catch { return url; } };
const tfetch = async (url, opts = {}, timeout = TIMEOUT) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    const method = (opts.method || 'GET').toUpperCase();
    const path = shortPath(url);
    const started = Date.now();
    try {
        const res = await fetch(url, { ...opts, signal: ctrl.signal });
        const ms = Date.now() - started;
        (res.ok ? logInfo : logWarn)(`${method} ${path} → ${res.status}`, `${ms}ms`);
        return res;
    } catch (e) {
        logError(`${method} ${path} → помилка мережі`, e && e.name === 'AbortError' ? `таймаут ${timeout}ms` : String(e && e.message || e));
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
            const res = await CapacitorHttp.get({ url, headers: h(), responseType: 'blob' });
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

// id — клієнтський GUID замовлення; сервер робить upsert за ним (ідемпотентно).
// baseVersion — токен версії (як ВерсияДанных у 1С), від якої редагували: сервер виявляє
// конфлікт (409), якщо запис відтоді змінився. Відсутній baseVersion = перезаписати.
export const createOrder = async (id, orderItems, customerId, total, status = "Нове", date, baseVersion) =>
    (await tfetch(`${apiUrl()}/orders`, {
        method: 'POST',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, orderItems, customerId, total, status, date, baseVersion }),
    })).json();

export const updateOrder = async (id, orderItems, customerId, total, status, date) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, {
        method: 'PUT',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ orderItems, customerId, total, status, date }),
    })).json();

export const deleteOrder = async (id) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, { method: 'DELETE', headers: h() })).json();

// Зняти помітку на видалення (PUT із deletionMark:false; інші поля не чіпаємо).
export const restoreOrder = async (id) =>
    (await tfetch(`${apiUrl()}/orders/${id}`, {
        method: 'PUT',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ deletionMark: false }),
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
