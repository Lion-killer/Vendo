// Запуск: node src/detectLang.test.mjs
import assert from 'node:assert';
import { detectLang } from './detectLang.js';

// Збережений вибір має пріоритет
assert.equal(detectLang('ru', ['en-US']), 'ru');
// Системна мова, коли збереженого немає
assert.equal(detectLang(null, ['uk-UA', 'en']), 'uk');
// Перша підтримувана зі списку
assert.equal(detectLang(null, ['fr-FR', 'ru-RU']), 'ru');
// Непідтримуване → англійська (fallback)
assert.equal(detectLang(null, ['fr-FR', 'de']), 'en');
assert.equal(detectLang(undefined, []), 'en');
// Невалідний збережений ігнорується, падаємо на системну
assert.equal(detectLang('xx', ['en']), 'en');

console.log('detectLang OK');
