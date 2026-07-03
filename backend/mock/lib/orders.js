// Чисті хелпери замовлень (без залежності від стора) — щоб їх можна було юніт-тестувати.
// Гідратація/нормалізація лишаються в routes/api.js, бо потребують доступу до in-memory стора.

const STATUS_COLORS = {
    "Нове": "#F2994A",
    "Відправлено": "#4ECDA4",
    "Проведено": "#8A8C96",
    "Видалено": "#C0392B"
};
const colorFor = (status) => STATUS_COLORS[status] || "#F2C94C";

// Локалізація message-рядків (#26): мова з Accept-Language (uk/ru/en, fallback en).
const MESSAGES = {
    conflict: { uk: "Замовлення змінили на сервері після ваших правок", ru: "Заказ изменили на сервере после ваших правок", en: "The order was changed on the server after your edits" },
    notFound: { uk: "Замовлення не знайдено", ru: "Заказ не найден", en: "Order not found" },
    noCustomer: { uk: "Не вибрано контрагента", ru: "Не выбран контрагент", en: "Customer is required" },
    cantDeletePosted: { uk: "Проведене замовлення не можна видалити", ru: "Проведённый заказ нельзя удалить", en: "A posted order cannot be deleted" },
    deleted: { uk: "Замовлення видалено", ru: "Заказ удалён", en: "Order deleted" },
    marked: { uk: "Помічено на видалення", ru: "Помечено на удаление", en: "Marked for deletion" }
};
const pickLang = (req) => {
    const raw = String(req.headers['accept-language'] || '').toLowerCase();
    return ['uk', 'ru', 'en'].find(l => raw.includes(l)) || 'en';
};
const msg = (req, key) => (MESSAGES[key] || {})[pickLang(req)] || (MESSAGES[key] || {}).en || key;

const formatUAH = (n) => `${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;

// Сума по нормалізованих рядках { qty, price }. Ціна — зафіксований snapshot.
const computeTotal = (items) => items.reduce((sum, it) => sum + (it.price || 0) * it.qty, 0);

module.exports = { STATUS_COLORS, colorFor, MESSAGES, pickLang, msg, formatUAH, computeTotal };
