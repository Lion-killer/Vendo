// Запуск: node --test (з frontend/)
import { test } from 'node:test';
import assert from 'node:assert';
import { newId } from './localOrders.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('newId: валідний UUID v4', () => {
    assert.match(newId(), UUID);
});

test('newId: фолбек (без crypto.randomUUID) теж валідний і унікальний', () => {
    const orig = globalThis.crypto?.randomUUID;
    if (globalThis.crypto) globalThis.crypto.randomUUID = undefined;
    try {
        const a = newId(), b = newId();
        assert.match(a, UUID);
        assert.match(b, UUID);
        assert.notEqual(a, b);
    } finally {
        if (globalThis.crypto) globalThis.crypto.randomUUID = orig;
    }
});
