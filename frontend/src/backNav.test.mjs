import { test } from 'node:test';
import assert from 'node:assert';
import { registerBack, runBack } from './backNav.js';

test('runBack без перехоплювачів → false', () => {
  assert.equal(runBack(), false);
});

test('перехоплювач ловить «Назад» і після відписки більше не ловить', () => {
  let n = 0;
  const off = registerBack(() => { n++; return true; });
  assert.equal(runBack(), true);
  assert.equal(n, 1);
  off();
  assert.equal(runBack(), false);
  assert.equal(n, 1); // після off() не викликається
});

test('LIFO: останній зареєстрований ловить першим і поглинає', () => {
  const calls = [];
  const offOuter = registerBack(() => { calls.push('outer'); return true; });
  const offInner = registerBack(() => { calls.push('inner'); return true; });
  assert.equal(runBack(), true);
  assert.deepEqual(calls, ['inner']); // зовнішній не викликано — вкладений поглинув
  offInner(); offOuter();
});

test('перехоплювач, що повертає false, пропускає «Назад» далі', () => {
  const calls = [];
  const offFirst = registerBack(() => { calls.push('first'); return true; });
  const offSkip = registerBack(() => { calls.push('skip'); return false; });
  assert.equal(runBack(), true);
  assert.deepEqual(calls, ['skip', 'first']); // skip повернув false → дійшли до first
  offFirst(); offSkip();
  assert.equal(runBack(), false); // обидва відписані
});
