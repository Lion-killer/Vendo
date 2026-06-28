import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import uk from './locales/uk.json';
import ru from './locales/ru.json';
import en from './locales/en.json';
import { SUPPORTED, detectLang } from './detectLang';

// #26: три мови — українська (типова система), російська, англійська (fallback).
// Визначення мови — у чистому detectLang.js (тестовано окремо).
export { SUPPORTED, detectLang };
const LOCALE_TAG = { uk: 'uk-UA', ru: 'ru-RU', en: 'en-US' };

const initial = detectLang(
  typeof localStorage !== 'undefined' ? localStorage.getItem('vendo_lang') : null,
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
  if (typeof localStorage !== 'undefined') localStorage.setItem('vendo_lang', lng);
  i18n.changeLanguage(lng);
};

// BCP-47 тег для Intl (дати/числа/валюта) під поточну мову.
export const localeTag = () => LOCALE_TAG[i18n.language] || 'uk-UA';
export const fmtMoney = (n, opts = {}) => (Number(n) || 0).toLocaleString(localeTag(), { maximumFractionDigits: 2, ...opts });
// Гривня — символ той самий у всіх мовах; локаль впливає лише на групування цифр.
export const fmtCur = (n, opts = {}) => `${fmtMoney(n, opts)} ₴`;

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
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// YYYY-MM-DD → DD.MM.YYYY (для показу).
export const fmtDate = (iso) => iso ? String(iso).split('-').reverse().join('.') : '';
// Людський лейбл замовлення: номер документа або короткий №<id>.
export const orderNum = (o) => (o && o.num) ? o.num : (o && o.id ? `№${String(o.id).slice(0, 8)}` : '');

export default i18n;
