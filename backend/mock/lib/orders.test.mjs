import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { convertPrice, computeTotal, pickLang, msg, verLt } = require('./orders.js');

test('computeTotal: підсумок по зафіксованих цінах', () => {
    assert.equal(computeTotal([{ qty: 2, price: 10 }, { qty: 3, price: 5 }]), 35);
    assert.equal(computeTotal([]), 0);
    // price відсутній → 0, не NaN
    assert.equal(computeTotal([{ qty: 4 }]), 0);
    // дробові ціни
    assert.equal(computeTotal([{ qty: 6, price: 42.5 }]), 255);
});

test('convertPrice: конверсія між валютами, округлення до 2 знаків', () => {
    // та сама валюта → без змін
    assert.equal(convertPrice(100, '980', '980'), 100);
    // 415 грн → USD (курс 41.5) = 10.00
    assert.equal(convertPrice(415, '840', '980'), 10);
    // округлення до копійок
    assert.equal(convertPrice(100, '840', '980'), 2.41);
    // невідома валюта → курс 1 (фолбек), без падіння
    assert.equal(convertPrice(100, 'XXX', '980'), 100);
});

test('pickLang: з Accept-Language, fallback en', () => {
    assert.equal(pickLang({ headers: { 'accept-language': 'uk-UA,uk;q=0.9' } }), 'uk');
    assert.equal(pickLang({ headers: { 'accept-language': 'ru-RU' } }), 'ru');
    assert.equal(pickLang({ headers: { 'accept-language': 'fr-FR' } }), 'en'); // непідтримувана
    assert.equal(pickLang({ headers: {} }), 'en');
});

test('msg: переклад за мовою запиту, fallback en, далі ключ', () => {
    const ru = { headers: { 'accept-language': 'ru' } };
    const fr = { headers: { 'accept-language': 'fr' } };
    assert.equal(msg(ru, 'notFound'), 'Заказ не найден');
    assert.equal(msg(fr, 'notFound'), 'Order not found'); // fallback en
    assert.equal(msg(ru, 'неіснуючий'), 'неіснуючий'); // невідомий ключ → сам ключ
});

test('verLt: semver a<b для хард-гейта (#66)', () => {
    assert.equal(verLt('0.16.0', '0.17.0'), true);
    assert.equal(verLt('0.17.0', '0.17.0'), false); // рівні — не менше
    assert.equal(verLt('1.0.0', '0.17.0'), false);
    assert.equal(verLt('0.2.0', '0.10.0'), true);    // числове, не лексикографічне
    assert.equal(verLt('v0.1.0', '0.1.1'), true);    // толерує префікс v
    assert.equal(verLt('0.1', '0.1.0'), false);      // короткі добиваються нулями
});
