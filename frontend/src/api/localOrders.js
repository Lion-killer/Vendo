import { normalizeOrder } from '../status.js';
import { todayISO } from '../dates.js';
import { K } from '../storageKeys.js';

const STORAGE_KEY = K.localOrders;

// GUID для локальної ідентичності замовлення (узгоджено з 1С/бекендом, ідемпотентна
// синхронізація). Фолбек — якщо crypto.randomUUID недоступний (старий Android WebView).
export const newId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

// Простий чернетковий номер для нового замовлення до синхронізації (ЧН-N, лічильник у
// localStorage). Сервер при синхронізації присвоїть власний ЗМ-номер — це лише для показу.
export const nextDraftNum = () => {
    const seq = (parseInt(localStorage.getItem(K.draftSeq) || '0', 10) || 0) + 1;
    localStorage.setItem(K.draftSeq, String(seq));
    return `ЧН-${seq}`;
};

// Сума замовлення: число (контракт #35), форматується при показі. Коерсія Number —
// стійкість до рядкових qty/price зі старих чернеток.
export const orderTotal = (items = []) =>
    items.reduce((s, it) => s + (Number(it.product?.price) || 0) * (Number(it.qty) || 0), 0);

// Канонічні поля запису замовлення в чергу/чернетку — ЄДИНА форма для всіх місць
// збереження (автосейв, «Зберегти», вихід з екрана, гілки видалення/відновлення/конфлікту
// в обох екранах). Раніше збиралися незалежно в 4 місцях і встигли розійтися.
// Envelope-поля (op/status/baseVersion/conflict/serverState/syncError/deletionMark)
// доклеює викликач через spread ПІСЛЯ; `unknownClient` — локалізований фолбек назви
// (щоб шар сховища не тягнув i18n).
export const orderRecordFields = ({ customer, client, items = [], date, currency, priceType, comment, total, unknownClient = '' }) => ({
    customer: customer || null,
    customerId: customer?.id || null,
    client: client || customer?.name || unknownClient,
    items,
    date,
    total: total != null ? total : orderTotal(items),
    currency,
    priceType: priceType || undefined, // тип цін замовлення (→ 1С Заказ.ТипЦен); "" → undefined
    comment: comment ?? '',             // ЗАВЖДИ рядок (навіть ""), інакше очищення губиться в JSON (#60)
});

export const getLocalOrders = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        // normalizeOrder: черга могла бути записана старою версією (укр. статуси, sColor) — #48.
        return data ? JSON.parse(data).map(normalizeOrder) : [];
    } catch (e) {
        console.error("Помилка читання localStorage", e);
        return [];
    }
};

export const saveLocalOrder = (order) => {
    const orders = getLocalOrders();
    // Нове локальне замовлення отримує GUID; num присвоїть сервер при синхронізації.
    if (!order.id) order.id = newId();
    if (!order.date) order.date = todayISO(); // локальна дата, не UTC (#50)

    const existingIndex = orders.findIndex(o => o.id === order.id);
    if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
        orders.unshift(order);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    return order.id;
};

// Позначити запис помилкою синхронізації (лишається в черзі для повторної спроби).
// conflict=true — серверну версію змінили після правок (оптимістична конкуренція).
export const setLocalOrderError = (id, message, conflict = false, serverState = null) => {
    const orders = getLocalOrders();
    const i = orders.findIndex(o => o.id === id);
    if (i >= 0) {
        orders[i].syncError = message || 'syncErr.generic'; // ключ i18n — переклад при показі (#49)
        orders[i].conflict = !!conflict;
        orders[i].serverState = serverState; // 'posted'|'deleted'|'edited' — для діалогу вирішення
        orders[i].syncAttempts = (orders[i].syncAttempts || 0) + 1;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
};

export const removeLocalOrder = (id) => {
    const orders = getLocalOrders();
    const newOrders = orders.filter(o => o.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
};

export const getLocalOrder = (id) => {
    const orders = getLocalOrders();
    return orders.find(o => o.id === id) || null;
};
