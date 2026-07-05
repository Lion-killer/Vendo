// Тести апдейтера (cmpVer, pickUpdate) — стандартний node --test, без залежностей.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cmpVer, pickUpdate } from './updates.js';

test('cmpVer: порівняння semver', () => {
    assert.equal(cmpVer('1.0.0', '1.0.0'), 0);
    assert.equal(cmpVer('1.0.0', '1.0.1'), -1);
    assert.equal(cmpVer('1.2.0', '1.10.0'), -1); // числове, не лексикографічне
    assert.equal(cmpVer('2.0.0', '1.9.9'), 1);
    assert.equal(cmpVer('v1.2.3', '1.2.3'), 0);  // толерує префікс v (git-тег)
    assert.equal(cmpVer('1.2', '1.2.0'), 0);     // короткі версії добиваються нулями
    assert.equal(cmpVer('0.0.0', '0.1.0'), -1);
});

const rel = (ver, body, extra = {}) => ({
    tag_name: `v${ver}`, body,
    assets: [{ name: `vendo-v${ver}.apk`, browser_download_url: `https://x/${ver}.apk` }],
    html_url: `https://x/rel/${ver}`, ...extra,
});
// GitHub віддає найновіші зверху; список навмисно перемішаний — pickUpdate має відсортувати.
const LIST = [rel('0.9.0', '### Нове\n- кількість з клавіатури'), rel('0.10.0', '### Нове\n- валюти'), rel('0.8.0', '### Нове\n- старе')];

test('pickUpdate: зшиває всі версії, новіші за встановлену (найновіша зверху)', () => {
    const u = pickUpdate(LIST, '0.8.0');
    assert.equal(u.version, '0.10.0');            // ціль — найновіша
    assert.equal(u.url, 'https://x/0.10.0.apk');  // APK найновішої
    assert.ok(u.notes.indexOf('## v0.10.0') < u.notes.indexOf('## v0.9.0')); // 0.10.0 перед 0.9.0
    assert.match(u.notes, /валюти/);
    assert.match(u.notes, /кількість з клавіатури/);
    assert.doesNotMatch(u.notes, /старе/);        // 0.8.0 = встановлена, не включаємо
});

test('pickUpdate: один пропущений реліз — без заголовка версії', () => {
    const u = pickUpdate(LIST, '0.9.0');
    assert.equal(u.version, '0.10.0');
    assert.equal(u.notes, '### Нове\n- валюти'); // як є, без «## v»
});

test('pickUpdate: немає новіших / чернетки й пре-релізи ігноруються', () => {
    assert.equal(pickUpdate(LIST, '0.10.0'), null);
    assert.equal(pickUpdate(LIST, '1.0.0'), null);
    const drafty = [rel('0.11.0', 'x', { draft: true }), rel('0.12.0', 'y', { prerelease: true })];
    assert.equal(pickUpdate(drafty, '0.10.0'), null);
    assert.equal(pickUpdate([], '0.10.0'), null);
});
