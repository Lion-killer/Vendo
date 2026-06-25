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

export default i18n;
