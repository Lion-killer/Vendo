// Запуск: node src/locales/parity.test.mjs
// Гарантує, що uk/ru/en мають однаковий набір ключів (немає пропущених перекладів — #26).
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = (l) => JSON.parse(readFileSync(join(here, `${l}.json`), 'utf8'));

// Плоский набір шляхів ключів. Плюрал-суфікси (_one/_few/_many/_other) згортаємо до базового
// ключа — правила множини в мовах різні (uk/ru мають few/many, en лише one/other).
const keys = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const base = k.replace(/_(one|few|many|two|other|zero)$/, '');
    const path = prefix ? `${prefix}.${base}` : base;
    if (v && typeof v === 'object') keys(v, path, out);
    else out.add(path);
  }
  return out;
};

const uk = keys(load('uk')), ru = keys(load('ru')), en = keys(load('en'));
const diff = (a, b) => [...a].filter(x => !b.has(x));

assert.deepEqual(diff(uk, ru), [], `ru пропускає ключі: ${diff(uk, ru)}`);
assert.deepEqual(diff(uk, en), [], `en пропускає ключі: ${diff(uk, en)}`);
assert.deepEqual(diff(ru, uk), [], `uk пропускає ключі (є в ru): ${diff(ru, uk)}`);
assert.deepEqual(diff(en, uk), [], `uk пропускає ключі (є в en): ${diff(en, uk)}`);

console.log(`locales parity OK (${uk.size} keys × 3)`);
