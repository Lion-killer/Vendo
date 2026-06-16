const STORAGE_KEY = 'traderep_local_orders';

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
    const existingIndex = orders.findIndex(o => o.num === order.num);

    if (existingIndex >= 0) {
        orders[existingIndex] = { ...orders[existingIndex], ...order };
    } else {
        // Якщо це нове локальне замовлення і немає num, генеруємо його
        if (!order.num) {
            order.num = `local_${Date.now()}`;
        }
        // За замовчуванням дата - сьогодні, якщо не вказано
        if (!order.date) {
            order.date = new Date().toISOString().split('T')[0];
        }
        orders.unshift(order);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    return order.num; // Повертаємо ID для подальшого використання
};

export const updateLocalOrderStatus = (num, status) => {
    const orders = getLocalOrders();
    const existingIndex = orders.findIndex(o => o.num === num);

    if (existingIndex >= 0) {
        orders[existingIndex].status = status;
        const color = status === "Чернетка" ? "#F2994A" : (status === "Очікує відправки" ? "#2D9CDB" : "#F2C94C");
        orders[existingIndex].sColor = color;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
};

export const removeLocalOrder = (num) => {
    const orders = getLocalOrders();
    const newOrders = orders.filter(o => o.num !== num);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrders));
};

export const getLocalOrder = (num) => {
    const orders = getLocalOrders();
    return orders.find(o => o.num === num) || null;
};
