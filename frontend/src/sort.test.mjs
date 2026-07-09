// node --test src/sort.test.mjs — компаратор byName (#61)
import assert from 'node:assert';
import { test } from 'node:test';
import { byName } from './sort.js';

const sorted = (names) => names.map(n => ({ name: n })).sort(byName).map(o => o.name);

test('натуральний порядок чисел: Товар 10 після Товар 2', () => {
  assert.deepEqual(sorted(['Товар 10', 'Товар 2', 'Товар 1']),
    ['Товар 1', 'Товар 2', 'Товар 10']);
});

test('регістронезалежність', () => {
  assert.deepEqual(sorted(['яблуко', 'Абрикос', 'банан']),
    ['Абрикос', 'банан', 'яблуко']);
});

test('українська абетка: а < і < ї', () => {
  assert.deepEqual(sorted(['їжак', 'іній', 'абетка']),
    ['абетка', 'іній', 'їжак']);
});

test('порожні/відсутні назви не падають', () => {
  assert.doesNotThrow(() => sorted(['', 'а']));
  assert.doesNotThrow(() => [{}, { name: 'а' }].sort(byName));
});
