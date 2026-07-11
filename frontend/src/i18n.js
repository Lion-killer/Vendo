import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './locales/uk.json';
import ru from './locales/ru.json';
import en from './locales/en.json';
import { SUPPORTED, detectLang } from './detectLang';
import { K } from './storageKeys';

// #26: три мови — українська (типова система), російська, англійська (fallback).
// Визначення мови — у чистому detectLang.js (тестовано окремо).
export { SUPPORTED, detectLang };
const LOCALE_TAG = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };

const initial = detectLang(
  typeof localStorage !== 'undefined' ? localStorage.getItem(K.lang) : null,
  typeof navigator !== 'undefined' ? (navigator.languages || [navigator.language]) : []
);

i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk }, ru: { translation: ru }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React сам екранує
});

// Ручна зміна мови (з налаштувань) — персистимо й перемикаємо без перезавантаження.
export const setLang = (lng) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(K.lang, lng);
  i18n.changeLanguage(lng);
};

// Повідомлення синхронізації (#49): клієнтські причини зберігаються КЛЮЧЕМ i18n у
// локальній черзі/історії (перекладаються поточною мовою при показі); серверні message
// приходять уже локалізованим текстом (Accept-Language) — віддаємо як є.
export const msgText = (m) => (m && i18n.exists(m) ? i18n.t(m) : m);

// BCP-47 тег для Intl (дати/числа/валюта) під поточну мову.
export const localeTag = () => LOCALE_TAG[i18n.language] || 'uk-UA';
export const fmtMoney = (n, opts = {}) => (Number(n) || 0).toLocaleString(localeTag(), { maximumFractionDigits: 2, ...opts });

// #35 Валюта. Бекенд віддає числовий код ISO 4217 ("980"=грн, "840"=USD…); символ беремо
// з мапи, невідома валюта показується самим кодом. Один рядок на нову валюту — без
// залежностей (stdlib-способу «980 → ₴» немає; Intl знає лише буквені коди).
const CUR_SYMBOL = { '980': '₴', '840': '$', '978': '€', '826': '£', '985': 'zł', '392': '¥' };
export const DEFAULT_CURRENCY = '980';
export const curSymbol = (code) => CUR_SYMBOL[String(code)] || String(code ?? '');
// Сума + символ валюти. code — числовий ISO-код; за замовчуванням грн (старі дані без валюти).
export const fmtCur = (n, code = DEFAULT_CURRENCY, opts = {}) => `${fmtMoney(n, opts)} ${curSymbol(code)}`;

// Дві канонічні форми сум — щоб опції форматування жили ЛИШЕ тут, а не по екранах (раніше
// кожен екран мав свою обгортку, і формат боргу встиг розійтися). fmtMoney2 — суми документів
// і ціни (рівно 2 знаки); fmtMoney0 — агрегати й борг (без копійок); fmtCur2 — сума + валюта.
export const fmtMoney2 = (n) => fmtMoney(n, { minimumFractionDigits: 2 });
export const fmtMoney0 = (n) => fmtMoney(n, { maximumFractionDigits: 0 });
export const fmtCur2 = (n, code) => fmtCur(n, code, { minimumFractionDigits: 2 });

// ─── Спільні форматери замовлень (раніше дублювалися по екранах) ───────────────
// Сума з рядка ("1 078,00 ₴") або числа → Number. Стійко до пробілів-роздільників і
// коми як десяткового (uk/ru-локалі) — інакше "1 078,00" перетворилось би на 107800.
export const parseMoney = (v) => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
// Локальна дата YYYY-MM-DD (без зсуву UTC).
export { dateISO, todayISO } from './dates.js'; // чисті дата-хелпери (див. dates.js, #50)
// YYYY-MM-DD → DD.MM.YYYY (для показу).
export const fmtDate = (iso) => iso ? String(iso).split('-').reverse().join('.') : '';
// Людський лейбл замовлення: номер документа або короткий №<id>.
export const orderNum = (o) => (o && o.num) ? o.num : (o && o.id ? `№${String(o.id).slice(0, 8)}` : '');
// Порядок за назвою (#61) — чистий компаратор (див. sort.js, тестується окремо).
export { byName } from './sort.js';

export default i18n;
