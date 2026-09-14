// Інтеграційні тести гейта пристрою (#85): прив'язка кодом, блокування, фільтрація даних.
// Піднімають справжній express на ефемерному порту й ходять по HTTP — саме те, що робить
// додаток. VENDO_NO_PERSIST=1 (виставляється до першого require стора) вимикає запис
// db.state.json, тож тести не лишають слідів у робочій теці.
process.env.VENDO_NO_PERSIST = '1';

import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const store = require('../db.js');
const api = require('./api.js');

const DEVICE = store.devices[0].id;
let base, server, token;

const call = (path, opts = {}) => fetch(base + path, opts);
const auth = (extra = {}) => ({ 'X-Device-Id': DEVICE, 'X-Auth-Token': token, ...extra });

before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', api);
    server = app.listen(0);
    await new Promise(r => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

test('прив\'язка: невірний код — 401, вірний — токен, повторний — 401 (одноразовий)', async () => {
    const dev = store.deviceById(DEVICE);
    dev.pairingCode = 'ABC123';
    dev.tokenHash = null;

    const bad = await call('/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: DEVICE, pairingCode: 'ЖОДЕН' }),
    });
    assert.equal(bad.status, 401);

    const ok = await call('/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: DEVICE, pairingCode: 'abc123' }), // регістр не важливий
    });
    assert.equal(ok.status, 200);
    const data = await ok.json();
    assert.ok(data.token, 'токен не видано');
    token = data.token;

    const again = await call('/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: DEVICE, pairingCode: 'abc123' }),
    });
    assert.equal(again.status, 401, 'код прив\'язки має гаситись після використання');
});

test('невідомий пристрій і запит без токена — 401', async () => {
    assert.equal((await call('/products')).status, 401);
    assert.equal((await call('/products', { headers: { 'X-Device-Id': 'no-such-device', 'X-Auth-Token': token } })).status, 401);
    assert.equal((await call('/products', { headers: auth({ 'X-Auth-Token': 'wrong-token' }) })).status, 401);
    assert.equal((await call('/products', { headers: auth() })).status, 200);
});

test('/health і /auth лишаються відкритими без токена', async () => {
    const h = await call('/health');
    assert.equal(h.status, 200);
    const body = await h.json();
    assert.ok(body.intervals && body.minAppVersion, 'health має нести intervals і minAppVersion');
});

test('блокування пристрою — 401 на наступному запиті (сценарій відв\'язки #40)', async () => {
    const dev = store.deviceById(DEVICE);
    dev.blocked = true;
    assert.equal((await call('/products', { headers: auth() })).status, 401);
    dev.blocked = false;
    assert.equal((await call('/products', { headers: auth() })).status, 200);
});

test('фільтрація за пристроєм: товари, категорії, типи цін, контрагенти', async () => {
    const dev = store.deviceById(DEVICE);
    const all = await (await call('/products', { headers: auth() })).json();
    assert.ok(all.length > 1);

    const one = all[0];
    dev.productIds = [one.id];
    const filtered = await (await call('/products', { headers: auth() })).json();
    assert.deepEqual(filtered.map(p => p.id), [one.id]);

    // Посилання на КАТЕГОРІЮ відкриває всі її товари (як В ИЕРАРХИИ у 1С).
    const cat = one.categoryId;
    dev.productIds = [cat];
    const byCategory = await (await call('/products', { headers: auth() })).json();
    const expected = store.products.filter(p => String(p.categoryId) === String(cat)).map(p => p.id);
    assert.ok(expected.length > 1, 'для перевірки потрібна категорія з кількома товарами');
    assert.deepEqual(byCategory.map(p => p.id).sort(), expected.sort());

    dev.productIds = [one.id];
    const cats = await (await call('/categories', { headers: auth() })).json();
    assert.ok(cats.length < store.categories.length, 'категорії мають звузитись під доступні товари');
    assert.ok(cats.some(c => String(c.id) === String(one.categoryId)), 'категорія доступного товару має лишитись');

    dev.priceTypeIds = ['wholesale'];
    const types = await (await call('/price-types', { headers: auth() })).json();
    assert.deepEqual(types.map(t => t.id), ['wholesale']);
    assert.ok(types[0].default, 'єдиний доступний тип стає основним');
    const priced = await (await call('/products', { headers: auth() })).json();
    assert.deepEqual(Object.keys(priced[0].prices), ['wholesale']);

    const someCustomer = store.customers[0].id;
    dev.customerIds = [someCustomer];
    const custs = await (await call('/customers', { headers: auth() })).json();
    assert.deepEqual(custs.map(c => c.id), [someCustomer]);
    const orders = await (await call('/orders', { headers: auth() })).json();
    assert.ok(orders.every(o => o.customerId === someCustomer), 'замовлення скоупляться тими ж контрагентами');

    dev.productIds = []; dev.priceTypeIds = []; dev.customerIds = [];
});

test('глибина історії обмежує замовлення незалежно від фільтра клієнта', async () => {
    const dev = store.deviceById(DEVICE);
    const all = await (await call('/orders?startDate=1900-01-01', { headers: auth() })).json();
    assert.ok(all.length > 0);

    dev.historyDays = 1;
    const capped = await (await call('/orders?startDate=1900-01-01', { headers: auth() })).json();
    assert.ok(capped.length < all.length, 'кап глибини має відрізати старі замовлення');
    dev.historyDays = 0;
});

test('телеметрія: снапшот лягає в історію, запит логу гаситься отриманим логом', async () => {
    const dev = store.deviceById(DEVICE);
    dev.requestLog = true;
    const before = store.telemetry.length;

    const r1 = await call('/telemetry', {
        method: 'POST', headers: auth({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ version: '9.9.9', model: 'TEST', pendingOrders: 2 }),
    });
    assert.equal((await r1.json()).requestLog, true, 'без логу прапорець лишається');

    const r2 = await call('/telemetry', {
        method: 'POST', headers: auth({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ version: '9.9.9', log: 'рядок логу', logErrors: 1 }),
    });
    assert.equal((await r2.json()).requestLog, false, 'лог отримано — запит виконано');
    assert.equal(store.telemetry.length, before + 2, 'снапшоти мають накопичуватись, а не затирати один одного');
});
