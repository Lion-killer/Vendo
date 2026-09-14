// Юніт-тести чистих хелперів пристроїв (#85). Без сервера й без стора.
import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { hashToken, newToken, newPairingCode, tokenFromHeaders, accessSet, allowed, treeFilter, historyStart, pruneTelemetry } =
    require('./devices.js');

test('токен: унікальний, хеш детермінований і не дорівнює токену', () => {
    const a = newToken(), b = newToken();
    assert.notEqual(a, b);
    assert.equal(hashToken(a), hashToken(a));
    assert.notEqual(hashToken(a), hashToken(b));
    assert.notEqual(hashToken(a), a);
});

test('код прив\'язки: 6 символів без плутаних 0/O/1/I', () => {
    for (let i = 0; i < 50; i++) {
        const code = newPairingCode();
        assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
    }
});

test('токен із заголовків: X-Auth-Token пріоритетніший, Bearer зрізається', () => {
    assert.equal(tokenFromHeaders({ 'x-auth-token': 'abc' }), 'abc');
    assert.equal(tokenFromHeaders({ authorization: 'Bearer xyz' }), 'xyz');
    assert.equal(tokenFromHeaders({ 'x-auth-token': 'abc', authorization: 'Bearer xyz' }), 'abc');
    assert.equal(tokenFromHeaders({}), '');
});

test('доступи: порожній список = без обмеження, заповнений — лише свої', () => {
    assert.equal(accessSet([]), null);
    assert.equal(accessSet(undefined), null);
    assert.ok(allowed(null, 'будь-що'));
    const set = accessSet(['a', 'b']);
    assert.ok(allowed(set, 'a'));
    assert.ok(!allowed(set, 'c'));
    assert.ok(allowed(accessSet([1, 2]), '1'), 'id порівнюються рядками (числові категорії)');
});

test('доступ у ієрархії: посилання на групу відкриває всіх нащадків', () => {
    const groups = [{ id: 'g1', parentId: null }, { id: 'g2', parentId: 'g1' }, { id: 'g3', parentId: null }];

    const byGroup = treeFilter(['g1'], groups);
    assert.ok(byGroup('p1', 'g1'), 'елемент самої групи');
    assert.ok(byGroup('p2', 'g2'), 'вкладена група теж під доступом');
    assert.ok(!byGroup('p3', 'g3'), 'сусідня гілка недоступна');
    assert.ok(!byGroup('p4', null), 'елемент поза групами недоступний');

    const byItem = treeFilter(['p4'], groups);
    assert.ok(byItem('p4', null), 'у списку може стояти сам елемент');
    assert.ok(!byItem('p1', 'g1'));

    assert.ok(treeFilter([], groups)('будь-що', 'будь-де'), 'порожній список — без обмеження');

    // Цикл у зіпсованих демо-даних не має вішати підйом по батьках.
    const cyclic = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }];
    assert.equal(treeFilter(['інше'], cyclic)('x', 'a'), false);
});

test('глибина історії: картка перекриває стенд, 0 скрізь = без обмеження', () => {
    const now = Date.parse('2026-08-01T12:00:00Z');
    assert.equal(historyStart({ historyDays: 10 }, 30, now), '2026-07-22');
    assert.equal(historyStart({ historyDays: 0 }, 30, now), '2026-07-02', 'без значення в картці — стендове');
    assert.equal(historyStart({ historyDays: 0 }, 0, now), null);
});

test('чистка телеметрії: старе прибирається, останній снапшот пристрою лишається', () => {
    const now = Date.parse('2026-08-01T00:00:00Z');
    const at = (days) => new Date(now - days * 86400000).toISOString();
    const list = [
        { deviceId: 'A', at: at(100) }, // старе, але єдине для A → лишається
        { deviceId: 'B', at: at(90) },  // старе, у B є свіжіше → прибирається
        { deviceId: 'B', at: at(40) },  // теж старе й теж не останнє → прибирається
        { deviceId: 'B', at: at(1) },   // свіже
    ];
    const kept = pruneTelemetry(list, 30, now);
    assert.deepEqual(kept.map(e => e.at), [at(100), at(1)]);
    assert.equal(pruneTelemetry(list, 0, now).length, 4, 'строк 0 = не чистити');
});
