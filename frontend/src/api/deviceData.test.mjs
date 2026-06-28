// Запуск: node --test (з frontend/)
import { test } from 'node:test';
import assert from 'node:assert';
import { purgeOnDeviceSwitch } from './deviceData.js';

// Фейк localStorage: дані — власні поля, методи — у прототипі (щоб Object.keys бачив лише дані).
function FakeStorage(init) { Object.assign(this, init); }
FakeStorage.prototype.getItem = function (k) { return k in this ? this[k] : null; };
FakeStorage.prototype.setItem = function (k, v) { this[k] = String(v); };
FakeStorage.prototype.removeItem = function (k) { delete this[k]; };

const base = () => new FakeStorage({
    vendo_device_id: 'DEV-A', vendo_token: 'tok', vendo_session: 's',
    cached_data_v2: '{}', vendo_local_orders: '[]', vendo_sync_history: '[]',
    vendo_theme: 'dark', vendo_lang: 'uk',
});

test('інший пристрій → стирає все, крім теми/мови', () => {
    const s = base();
    assert.equal(purgeOnDeviceSwitch('DEV-B', s), true);
    assert.deepEqual(Object.keys(s).sort(), ['vendo_lang', 'vendo_theme']);
    assert.equal(s.vendo_theme, 'dark');
    assert.equal(s.vendo_lang, 'uk');
});

test('той самий пристрій → нічого не чіпає', () => {
    const s = base();
    assert.equal(purgeOnDeviceSwitch('DEV-A', s), false);
    assert.equal(s.vendo_token, 'tok');
    assert.equal(s.cached_data_v2, '{}');
});

test('перший вхід (немає збереженого коду) → нічого не стирає', () => {
    const s = new FakeStorage({ vendo_theme: 'light' });
    assert.equal(purgeOnDeviceSwitch('DEV-A', s), false);
    assert.equal(s.vendo_theme, 'light');
});

test('порожній новий код → нічого не стирає (захист від кривого QR)', () => {
    const s = base();
    assert.equal(purgeOnDeviceSwitch('', s), false);
    assert.equal(s.vendo_token, 'tok');
    assert.equal(purgeOnDeviceSwitch(undefined, s), false);
    assert.equal(s.vendo_token, 'tok');
});
