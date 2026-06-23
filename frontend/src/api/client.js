// Адреса бекенду й ідентифікатор пристрою беруться з QR-коду (зберігаються в
// localStorage під час логіну). DEFAULT_API — запасний для dev/емулятора.
const DEFAULT_API = 'http://10.0.2.2:3000/api';
// Емулятор Android: хост = 10.0.2.2. Реальний пристрій — адреса з QR-коду.

const apiUrl = () => localStorage.getItem('vendo_api_url') || DEFAULT_API;
const deviceId = () => localStorage.getItem('vendo_device_id') || '';

// Заголовки із X-Device-Id (за яким 1С-бекенд фільтрує дані пристрою).
const h = (extra = {}) => {
    const headers = { ...extra };
    const d = deviceId();
    if (d) headers['X-Device-Id'] = d;
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

export const auth = async (devId) => {
    const res = await tfetch(`${apiUrl()}/auth`, {
        method: 'POST',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ deviceId: devId || deviceId() }),
    });
    return res.json();
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

export const createOrder = async (orderItems, customerId, total, status = "Нове", date) =>
    (await tfetch(`${apiUrl()}/orders`, {
        method: 'POST',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ orderItems, customerId, total, status, date }),
    })).json();

export const updateOrder = async (num, orderItems, customerId, total, status, date) =>
    (await tfetch(`${apiUrl()}/orders/${num}`, {
        method: 'PUT',
        headers: h({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ orderItems, customerId, total, status, date }),
    })).json();

export const deleteOrder = async (num) =>
    (await tfetch(`${apiUrl()}/orders/${num}`, { method: 'DELETE', headers: h() })).json();

// Зняти помітку на видалення (PUT із deletionMark:false; інші поля не чіпаємо).
export const restoreOrder = async (num) =>
    (await tfetch(`${apiUrl()}/orders/${num}`, {
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
