// node --test src/contract.test.mjs — версійний каскад сумісності (#66) + інтервали (#68)
import assert from 'node:assert';
import { test } from 'node:test';
import { BACKEND_FULL, checkCompat, parseIntervals } from './contract.js';

const APP = '9.9.9'; // свідомо вище за будь-який minAppVersion у тестах

test('бекенд на рівні BACKEND_FULL і новіший → ok', () => {
  assert.equal(checkCompat({ version: BACKEND_FULL, minAppVersion: '0.1.0' }, APP).ok, true);
  // Старий додаток + новіший бекенд (приклад із задачі: фронт 0.1.0 / бекенд 0.1.6) — сумісно.
  const r = checkCompat({ version: '99.0.0', minAppVersion: '0.1.0' }, '0.2.0');
  assert.equal(r.ok, true);
  assert.equal(r.limited, false);
});

test('бекенд старіший за BACKEND_FULL → обмеження, не блок', () => {
  const r = checkCompat({ version: '0.0.1', minAppVersion: '0.1.0' }, APP);
  assert.equal(r.ok, false);
  assert.equal(r.limited, true);
  assert.equal(r.needsAppUpdate, false);
});

test('старий бекенд без поля version → обмеження (безпечний дефолт)', () => {
  assert.equal(checkCompat({ status: 'ok' }, APP).limited, true);
  assert.equal(checkCompat(null, APP).limited, true);
});

test('додаток старіший за minAppVersion бекенду → оновіть додаток', () => {
  const r = checkCompat({ version: '99.0.0', minAppVersion: '2.0.0' }, '1.0.0');
  assert.equal(r.ok, false);
  assert.equal(r.needsAppUpdate, true);
});

test('parseIntervals: бекенд без intervals (стара збірка) → null, циклів немає', () => {
  assert.equal(parseIntervals({ status: 'ok', version: '0.18.0' }), null);
  assert.equal(parseIntervals(null), null);
  assert.equal(parseIntervals({ intervals: 'garbage' }), null);
});

test('parseIntervals: валідні значення проходять, дробові обрізаються', () => {
  assert.deepEqual(
    parseIntervals({ intervals: { syncSec: 300, pingSec: '15', telemetrySec: 900.9 } }),
    { syncSec: 300, pingSec: 15, telemetrySec: 900 });
});

test('parseIntervals: 0/відсутнє/сміття у полі → 0 (цикл вимкнено), решта живе', () => {
  assert.deepEqual(
    parseIntervals({ intervals: { syncSec: 0, pingSec: -5, telemetrySec: 'abc' } }),
    { syncSec: 0, pingSec: 0, telemetrySec: 0 });
  assert.deepEqual(
    parseIntervals({ intervals: { pingSec: 15 } }),
    { syncSec: 0, pingSec: 15, telemetrySec: 0 });
});

