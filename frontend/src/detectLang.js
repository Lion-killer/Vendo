// Чисте визначення мови (#26) — без залежностей, щоб було тестовано окремо від i18next.
// Пріоритет: збережений ручний вибір > системні мови > англійська (fallback).
// Порядок = порядок кнопок у перемикачі мов (меню профілю); для detectLang не значущий.
export const SUPPORTED = ['uk', 'en', 'ru'];

export const detectLang = (saved, langs) => {
  if (SUPPORTED.includes(saved)) return saved;
  for (const l of (langs && langs.length ? langs : ['en'])) {
    const two = String(l).slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(two)) return two;
  }
  return 'en';
};
