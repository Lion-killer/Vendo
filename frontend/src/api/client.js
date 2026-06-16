const API_URL = 'http://localhost:3000/api';
// Якщо використовувати Android Емулятор, треба замінити `localhost` на `10.0.2.2`. 
// Для реального пристрою - IP адреса комп'ютера (напр., `192.168.1.x`).

export const auth = async () => {
    const res = await fetch(`${API_URL}/auth`, { method: 'POST' });
    return res.json();
};

export const fetchProducts = async () => {
    const res = await fetch(`${API_URL}/products`);
    return res.json();
};

export const fetchCustomers = async () => {
    const res = await fetch(`${API_URL}/customers`);
    return res.json();
};

export const fetchOrders = async (startDate, endDate) => {
    let url = `${API_URL}/orders`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    const res = await fetch(url);
    return res.json();
};

export const createOrder = async (orderItems, customerId, total, status = "Чернетка") => {
    const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderItems, customerId, total, status })
    });
    return res.json();
};

export const fetchCategories = async () => {
    const res = await fetch(`${API_URL}/categories`);
    return res.json();
};

export const updateOrder = async (num, orderItems, customerId, total, status) => {
    const res = await fetch(`${API_URL}/orders/${num}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderItems, customerId, total, status })
    });
    return res.json();
};

export const deleteOrder = async (num) => {
    const res = await fetch(`${API_URL}/orders/${num}`, {
        method: 'DELETE'
    });
    return res.json();
};

export const pingServer = async () => {
    try {
        const res = await fetch(`${API_URL}/products`, { method: 'HEAD' });
        return res.ok;
    } catch (e) {
        return false;
    }
};
