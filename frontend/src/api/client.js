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
    const tk = token();
    if (tk) headers['Authorization'] = `Bearer ${tk}`;
    return headers;
};

// fetch із таймаутом — без нього недоступний бекенд висить до системного TCP-таймауту
// (~30 с) і офлайн виявляється надто пізно.
const TIMEOUT = 8000;
const tfetch = (url, opts = {}, timeout = TIMEOUT) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeout);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
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

export const pingServer = async () => {
    try {
        const res = await tfetch(`${apiUrl()}/products`, { method: 'HEAD', headers: h() }, 5000);
        return res.ok;
    } catch (e) {
        return false;
    }
};
