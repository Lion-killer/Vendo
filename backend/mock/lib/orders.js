// Чисті хелпери замовлень (без залежності від стора) — щоб їх можна було юніт-тестувати.
// Гідратація/нормалізація лишаються в routes/api.js, бо потребують доступу до in-memory стора.

// Локалізація message-рядків (#26): мова з Accept-Language (uk/ru/en, fallback en).
const MESSAGES = {
    conflict: { uk: "Замовлення змінили на сервері після ваших правок", ru: "Заказ изменили на сервере после ваших правок", en: "The order was changed on the server after your edits" },
    notFound: { uk: "Замовлення не знайдено", ru: "Заказ не найден", en: "Order not found" },
    noCustomer: { uk: "Не вказано контрагента", ru: "Не указан контрагент", en: "Customer is required" },
    noPriceType: { uk: "Не вказано тип цін замовлення", ru: "Не указан тип цен заказа", en: "Order price type is required" },
    customerNotFound: { uk: "Контрагента не знайдено в базі (id: %1)", ru: "Контрагент не найден в базе (id: %1)", en: "Customer not found (id: %1)" },
    noProductId: { uk: "Позиція замовлення без ідентифікатора товару (productId)", ru: "Позиция заказа без идентификатора товара (productId)", en: "Order item has no product id (productId)" },
    productNotFound: { uk: "Товар не знайдено в базі (id: %1)", ru: "Товар не найден в базе (id: %1)", en: "Product not found (id: %1)" },
    cantDeletePosted: { uk: "Проведене замовлення не можна видалити", ru: "Проведённый заказ нельзя удалить", en: "A posted order cannot be deleted" },
    deleted: { uk: "Замовлення видалено", ru: "Заказ удалён", en: "Order deleted" },
    marked: { uk: "Помічено на видалення", ru: "Помечено на удаление", en: "Marked for deletion" }
};
const pickLang = (req) => {
    const raw = String(req.headers['accept-language'] || '').toLowerCase();
    return ['uk', 'ru', 'en'].find(l => raw.includes(l)) || 'en';
};
const msg = (req, key) => (MESSAGES[key] || {})[pickLang(req)] || (MESSAGES[key] || {}).en || key;

// Сума по нормалізованих рядках { qty, price }. Ціна — зафіксований snapshot.
const computeTotal = (items) => items.reduce((sum, it) => sum + (it.price || 0) * it.qty, 0);

// #35 Мультивалютність. Контракт: бекенд віддає числа + числовий код валюти (ISO 4217,
// напр. "980"=грн, "840"=USD); форматує лише фронтенд. Валюта одна на пристрій.
// Мок імітує 1С-конверсію: ціни в db.json — у базовій валюті (грн), а /products віддає
// їх переведеними у валюту пристрою (MOCK_CURRENCY). Фліп MOCK_CURRENCY=840 → каталог у $.
const BASE_CURRENCY = '980';                             // валюта цін у db.json
const MOCK_CURRENCY = process.env.MOCK_CURRENCY || '980'; // валюта пристрою
// Курс = скільки базової валюти (грн) за 1 одиницю валюти. Тільки для демо конверсії.
const RATES = { '980': 1, '840': 41.5, '978': 45, '826': 52 };
const convertPrice = (amount, toCode = MOCK_CURRENCY, fromCode = BASE_CURRENCY) => {
    const from = RATES[String(fromCode)] ?? 1, to = RATES[String(toCode)] ?? 1;
    return Math.round(((Number(amount) || 0) * from / to) * 100) / 100;
};

// Типи цін пристрою: мок імітує «доступні типи цін із налаштувань пристрою». factor —
// множник до базової (роздрібної) ціни з db.json (внутрішнє, у контракт НЕ віддається;
// у 1С це різні прайси РегистрСведений.ЦеныНоменклатуры). Один тип — default.
const PRICE_TYPES = [
    { id: 'retail', name: 'Роздрібна', default: true, factor: 1 },
    { id: 'wholesale', name: 'Оптова', factor: 0.9 },
    { id: 'promo', name: 'Акційна', factor: 0.8 },
];
module.exports = { MESSAGES, pickLang, msg, computeTotal, BASE_CURRENCY, MOCK_CURRENCY, convertPrice, PRICE_TYPES };
