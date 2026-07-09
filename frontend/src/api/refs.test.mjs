// node --test src/api/refs.test.mjs — recentQtysForCustomer (#63)
import assert from 'node:assert';
import { test } from 'node:test';
import { recentQtysForCustomer } from './refs.js';

const O = (id, customerId, date, items, extra = {}) => ({ id, customerId, date, items, ...extra });
const I = (productId, qty) => ({ productId, qty });

test('до 3 останніх замовлень, найновіші перші', () => {
  const orders = [
    O('a', 'c1', '2026-06-01', [I('p', 8)]),
    O('b', 'c1', '2026-06-20', [I('p', 12)]),
    O('c', 'c1', '2026-06-10', [I('p', 10)]),
    O('d', 'c1', '2026-05-01', [I('p', 5)]), // 4-те найстаріше — відсікається
  ];
  const m = recentQtysForCustomer(orders, 'c1', 3);
  assert.deepEqual(m.get('p'), [
    { qty: 12, date: '2026-06-20' },
    { qty: 10, date: '2026-06-10' },
    { qty: 8, date: '2026-06-01' },
  ]);
});

test('інший контрагент і видалені — не рахуються', () => {
  const orders = [
    O('a', 'c1', '2026-06-20', [I('p', 9)]),
    O('b', 'c2', '2026-06-21', [I('p', 99)]),           // інший контрагент
    O('c', 'c1', '2026-06-22', [I('p', 77)], { deletionMark: true }), // видалене
  ];
  assert.deepEqual(recentQtysForCustomer(orders, 'c1', 3).get('p'), [{ qty: 9, date: '2026-06-20' }]);
});

test('кілька рядків того самого товару в замовленні — сумуються в один запис', () => {
  const orders = [O('a', 'c1', '2026-06-20', [I('p', 3), I('p', 4)])];
  assert.deepEqual(recentQtysForCustomer(orders, 'c1', 3).get('p'), [{ qty: 7, date: '2026-06-20' }]);
});

test('толерує старий формат позиції ({ product:{id} }) і без контрагента', () => {
  const orders = [O('a', 'c1', '2026-06-20', [{ product: { id: 'p' }, qty: 6 }])];
  assert.deepEqual(recentQtysForCustomer(orders, 'c1', 3).get('p'), [{ qty: 6, date: '2026-06-20' }]);
  assert.equal(recentQtysForCustomer(orders, null, 3).size, 0);
});
