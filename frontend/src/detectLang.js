// Чисте визначення мови (#26) — без залежностей, щоб було тестовано окремо від i18next.
// Пріоритет: збережений ручний вибір > системні мови > англійська (fallback).
export const SUPPORTED = ['uk', 'ru', 'en'];

export const detectLang = (saved, langs) => {
  if (SUPPORTED.includes(saved)) return saved;
  for (const l of (langs && langs.length ? langs : ['en'])) {
    const two = String(l).slice(0, 2).toLowerCase();
    if (SUPPORTED.includes(two)) return two;
  }
  return 'en';
};
