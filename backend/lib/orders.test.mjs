import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { colorFor, formatUAH, computeTotal, pickLang, msg } = require('./orders.js');

test('computeTotal: підсумок по зафіксованих цінах', () => {
    assert.equal(computeTotal([{ qty: 2, price: 10 }, { qty: 3, price: 5 }]), 35);
    assert.equal(computeTotal([]), 0);
    // price відсутній → 0, не NaN
    assert.equal(computeTotal([{ qty: 4 }]), 0);
    // дробові ціни
    assert.equal(computeTotal([{ qty: 6, price: 42.5 }]), 255);
});

test('formatUAH: 2 знаки + розділювач тисяч + символ', () => {
    assert.equal(formatUAH(255), '255.00 ₴');
    assert.equal(formatUAH(1134), '1 134.00 ₴');
    assert.equal(formatUAH(1234567.5), '1 234 567.50 ₴');
    assert.equal(formatUAH(0), '0.00 ₴');
});

test('colorFor: відомі статуси + фолбек', () => {
    assert.equal(colorFor('Нове'), '#F2994A');
    assert.equal(colorFor('Проведено'), '#8A8C96');
    assert.equal(colorFor('Видалено'), '#C0392B');
    assert.equal(colorFor('казна-що'), '#F2C94C'); // фолбек
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
