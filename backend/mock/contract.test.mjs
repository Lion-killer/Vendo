// node --test — статичні перевірки контракту (#66). openapi.json — формальний контракт,
// git зберігає його історію по релізах, тож окрема тека снапшотів не потрібна.
// Ловимо реальний режим збою: ЗЛАМНА зміна контракту без підняття minAppVersion.
//
// ponytail: евристика, не повний семантичний diff — порівнюємо набір маршрутів і
// компонентні схеми (properties/required). Інлайн-схеми в paths (напр. /health) глибоко не
// диференціюємо — цього досить, щоб змусити свідомо вирішити про minAppVersion; глибший
// diff додамо, коли знадобиться.
import { test } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..'); // корінь репозиторію (backend/mock → ..\..)

const REL = {
  openapi: 'backend/mock/openapi.json',
  api: 'backend/mock/routes/api.js',
  bsl: 'backend/1c-config/TradeUkr23/src/HTTPServices/венд_МобильноеПриложение/Ext/Module.bsl',
};

const cmpVer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
  return 0;
};
const isSemver = (s) => /^\d+\.\d+\.\d+$/.test(String(s || ''));

// minAppVersion із коду кожного бекенду (руками виставлене значення).
const minFromMock = (src) => src.match(/MIN_APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] || null;
const min1C = (src) => src.match(/Функция\s+МинимальнаяВерсияПриложения\(\)[\s\S]*?Возврат\s+"([^"]+)"/)?.[1] || null;

const read = (rel) => readFileSync(join(repo, rel), 'utf8');
const git = (args) => execSync(`git ${args}`, { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const lastTag = (() => { try { return git('describe --tags --abbrev=0').trim(); } catch { return null; } })();
const gitShow = (ref, rel) => { try { return git(`show ${ref}:${rel}`); } catch { return null; } };

// Контракт як порівнювані множини: маршрути + властивості компонентних схем.
const routeSet = (o) => new Set(Object.entries(o.paths || {}).flatMap(([p, ms]) =>
  Object.keys(ms).filter(m => ['get', 'post', 'put', 'delete', 'patch', 'head'].includes(m)).map(m => `${m.toUpperCase()} ${p}`)));
const schemaMap = (o) => {
  const r = {};
  for (const [n, s] of Object.entries(o.components?.schemas || {})) r[n] = { props: new Set(Object.keys(s.properties || {})), required: new Set(s.required || []) };
  return r;
};

// Чистий diff: old→new openapi → перелік зламних змін (порожній = сумісно вниз).
// Зламне: видалений маршрут, видалена схема, видалене поле схеми, нове обов'язкове поле.
const breakingChanges = (oldO, newO) => {
  const oldR = routeSet(oldO), newR = routeSet(newO);
  const oldS = schemaMap(oldO), newS = schemaMap(newO);
  const out = [];
  for (const rt of oldR) if (!newR.has(rt)) out.push(`видалено маршрут ${rt}`);
  for (const [name, o] of Object.entries(oldS)) {
    const n = newS[name];
    if (!n) { out.push(`видалено схему ${name}`); continue; }
    for (const p of o.props) if (!n.props.has(p)) out.push(`видалено поле ${name}.${p}`);
    for (const req of n.required) if (!o.required.has(req)) out.push(`нове обов'язкове поле запиту ${name}.${req}`);
  }
  return out;
};

// Гейт: зламали контракт → minAppVersion мусить бути вищим за поріг на минулому релізі.
// prevMin === null (поля тоді не було) → базового порогу немає, вимоги немає.
const bumpSatisfied = (breaking, prevMin, curMin) => !breaking.length || (prevMin ? cmpVer(curMin, prevMin) > 0 : true);

test('minAppVersion узгоджений між mock і 1С та валідний semver', () => {
  const mock = minFromMock(read(REL.api));
  const bsl = min1C(read(REL.bsl));
  assert.ok(mock, 'MIN_APP_VERSION не знайдено в mock api.js');
  assert.ok(bsl, 'МинимальнаяВерсияПриложения не знайдено в 1С-модулі');
  assert.ok(isSemver(mock), `mock minAppVersion не semver: ${mock}`);
  assert.equal(bsl, mock, `minAppVersion розходиться: mock=${mock}, 1С=${bsl}`);
});

test('minAppVersion не блокує поточну збірку додатка', () => {
  const min = minFromMock(read(REL.api));
  const app = JSON.parse(read('frontend/package.json')).version;
  assert.ok(cmpVer(min, app) <= 0, `minAppVersion (${min}) вищий за версію додатка (${app}) — заблокує сам додаток`);
});

// Доведення, що гейт реально ловить злам (не залежить від стану репо/тегів).
test('breakingChanges: адитивні зміни — не злам, видалення/нове-required — злам', () => {
  const base = {
    paths: { '/orders': { get: {}, post: {} } },
    components: { schemas: { Order: { properties: { id: {}, total: {} }, required: ['id'] } } },
  };
  assert.deepEqual(breakingChanges(base, base), []);
  // адитивно: новий маршрут + нове необов'язкове поле
  const additive = { paths: { ...base.paths, '/customers': { get: {} } }, components: { schemas: { Order: { properties: { id: {}, total: {}, comment: {} }, required: ['id'] } } } };
  assert.deepEqual(breakingChanges(base, additive), []);
  // зламно: прибрали маршрут, прибрали поле, зробили total обов'язковим
  const broken = { paths: { '/orders': { get: {} } }, components: { schemas: { Order: { properties: { id: {} }, required: ['id', 'total'] } } } };
  const b = breakingChanges(base, broken);
  assert.ok(b.some(x => x.includes('POST /orders')), 'не спіймано видалений маршрут');
  assert.ok(b.some(x => x.includes('Order.total')), 'не спіймано видалене поле');
  assert.ok(b.some(x => x.includes("обов'язкове")), 'не спіймано нове required');
});

test('bumpSatisfied: злам без підняття minAppVersion — не проходить', () => {
  const brk = ['видалено поле Order.total'];
  assert.equal(bumpSatisfied([], '0.1.0', '0.1.0'), true, 'без зламу вимоги немає');
  assert.equal(bumpSatisfied(brk, '0.1.0', '0.1.0'), false, 'злам + той самий minAppVersion має провалитись');
  assert.equal(bumpSatisfied(brk, '0.1.0', '0.2.0'), true, 'злам + піднятий minAppVersion — ок');
  assert.equal(bumpSatisfied(brk, null, '0.1.0'), true, 'немає попереднього порогу — вимоги немає');
});

// Живий гейт проти останнього релізу (інтеграційний; поки minAppVersion не в релізі —
// prevMin=null, тож фактично лише сигналить, а не блокує).
test('контракт проти останнього релізу: злам вимагає підняття minAppVersion', (t) => {
  const prevOpenapi = lastTag && gitShow(lastTag, REL.openapi);
  if (!prevOpenapi) { t.skip(`немає openapi на ${lastTag || '(тегів немає)'} — порівнювати ні з чим`); return; }
  const breaking = breakingChanges(JSON.parse(prevOpenapi), JSON.parse(read(REL.openapi)));
  const prevMin = minFromMock(gitShow(lastTag, REL.api) || '');
  const curMin = minFromMock(read(REL.api));
  assert.ok(bumpSatisfied(breaking, prevMin, curMin),
    `Зламна зміна контракту з ${lastTag} без підняття minAppVersion (${prevMin} → ${curMin}):\n  - ${breaking.join('\n  - ')}`);
});
