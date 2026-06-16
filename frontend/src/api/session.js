// Збереження сесії логіну (#24). Дозволяє пропускати екран автентифікації при
// повторному запуску. Зараз тримає mock-дані (ім'я, роль, токен); сумісно з
// майбутньою real-auth за GUID мобільного пристрою (#4).
const STORAGE_KEY = 'traderep_session';

export const getSession = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Помилка читання сесії", e);
        return null;
    }
};

export const saveSession = (session) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (e) {
        console.error("Помилка збереження сесії", e);
    }
};

export const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
};
