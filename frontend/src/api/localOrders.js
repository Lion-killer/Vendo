const STORAGE_KEY = 'vendo_local_orders';

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
    const seq = (parseInt(localStorage.getItem('vendo_draft_seq') || '0', 10) || 0) + 1;
    localStorage.setItem('vendo_draft_seq', String(seq));
    return `ЧН-${seq}`;
};

export const getLocalOrders = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Помилка читання localStorage", e);
        return [];
    }
};

export const saveLocalOrder = (order) => {
    const orders = getLocalOrders();
    // Нове локальне замовлення отримує GUID; num присвоїть сервер при синхронізації.
    if (!order.id) order.id = newId();
    if (!order.date) order.date = new Date().toISOString().split('T')[0];

    const existingIndex = orders.findIndex(o => o.id === order.id);
    if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
        orders.unshift(order);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    return order.id;
};

export const updateLocalOrderStatus = (id, status) => {
    const orders = getLocalOrders();
    const existingIndex = orders.findIndex(o => o.id === id);

    if (existingIndex >= 0) {
        orders[existingIndex].status = status;
        const color = status === "Нове" ? "#F2994A" : "#F2C94C";
        orders[existingIndex].sColor = color;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
};

// Позначити запис помилкою синхронізації (лишається в черзі для повторної спроби).
// conflict=true — серверну версію змінили після правок (оптимістична конкуренція).
export const setLocalOrderError = (id, message, conflict = false, serverState = null) => {
    const orders = getLocalOrders();
    const i = orders.findIndex(o => o.id === id);
    if (i >= 0) {
        orders[i].syncError = message || "Помилка";
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
