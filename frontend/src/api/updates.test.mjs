// Тест порівняння версій апдейтера (cmpVer) — стандартний node --test, без залежностей.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmpVer } from './updates.js';

test('cmpVer: порівняння semver', () => {
    assert.equal(cmpVer('1.0.0', '1.0.0'), 0);
    assert.equal(cmpVer('1.0.0', '1.0.1'), -1);
    assert.equal(cmpVer('1.2.0', '1.10.0'), -1); // числове, не лексикографічне
    assert.equal(cmpVer('2.0.0', '1.9.9'), 1);
    assert.equal(cmpVer('v1.2.3', '1.2.3'), 0);  // толерує префікс v (git-тег)
    assert.equal(cmpVer('1.2', '1.2.0'), 0);     // короткі версії добиваються нулями
    assert.equal(cmpVer('0.0.0', '0.1.0'), -1);
});
