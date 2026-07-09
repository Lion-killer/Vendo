// node --test src/customerTree.test.mjs — дерево контрагентів (#64)
import assert from 'node:assert';
import { test } from 'node:test';
import { buildCustomerTree, getCustomerNode, leavesUnder, sumDebt } from './customerTree.js';

const groups = [
  { id: 'g1', name: 'Мережі', parentId: null },
  { id: 'g2', name: 'Національні', parentId: 'g1' },
  { id: 'g3', name: 'HoReCa', parentId: null },
];
const customers = [
  { id: 'c1', name: 'АТБ', groupId: 'g2', debt: 100 },
  { id: 'c2', name: 'Сільпо', groupId: 'g2', debt: -30 },
  { id: 'c3', name: 'Кафе', groupId: 'g3', debt: 50 },
  { id: 'c4', name: 'Без папки', groupId: null, debt: 0 },
  { id: 'c5', name: 'Чужа папка', groupId: 'zzz', debt: 7 },
];

test('вкладеність: g2 під g1; сироти (null/невідома група) — у корені', () => {
  const root = buildCustomerTree(groups, customers);
  assert.deepEqual(root.children.map(c => c.id), ['g1', 'g3']);
  const g1 = root.children.find(c => c.id === 'g1');
  assert.deepEqual(g1.children.map(c => c.id), ['g2']);
  assert.deepEqual(root.customers.map(c => c.id), ['c4', 'c5']); // orphans
});

test('getCustomerNode веде по шляху', () => {
  const root = buildCustomerTree(groups, customers);
  const g2 = getCustomerNode(root, ['g1', 'g2']);
  assert.equal(g2.name, 'Національні');
  assert.deepEqual(g2.customers.map(c => c.id), ['c1', 'c2']);
});

test('leavesUnder рахує рекурсивно; sumDebt зводить борг/переплату', () => {
  const root = buildCustomerTree(groups, customers);
  const g1 = getCustomerNode(root, ['g1']);
  const leaves = leavesUnder(g1); // c1 + c2 (через g2)
  assert.deepEqual(leaves.map(c => c.id).sort(), ['c1', 'c2']);
  assert.equal(sumDebt(leaves), 70); // 100 + (-30)
});

test('порожні входи не падають', () => {
  const root = buildCustomerTree(null, null);
  assert.deepEqual(root.children, []);
  assert.equal(sumDebt(null), 0);
});
