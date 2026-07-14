// Знімалка скриншотів довідки (headless Chromium через Playwright).
// Джерело кадрів для docs/user-guide/images/. Детерміновано: демо-дані з мок-бекенду,
// вʼюпорт 390×844 @2x (→ 780×1688, як решта кадрів), світла тема, /health→сумісний
// (щоб банер сумісності не забруднював кадр), обхід QR-логіну демо-сесією в localStorage.
//
// Запуск (мок :3000 і Vite :5173 мають бути підняті — start.bat):
//   npm run screenshots            — усі кадри з маніфесту
//   npm run screenshots customers  — лише кадри, чиє імʼя містить «customers»
//
// Маніфест SHOTS — джерело істини. Додати кадр = один запис { file, at(page) }.
// Навігація — Playwright-локатори з авто-очікуванням (getByRole/getByText/getByPlaceholder),
// без крихких sleep. Якщо UI зміниться — правити лише відповідний at() чи хелпер тут.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'user-guide', 'images');
// Версія додатка — для стаба /health (динамічно, а не літерал: інакше стаб старіє з релізами).
const APP_VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8')).version;
const MOCK = 'http://localhost:3000/api';
const BASE = 'http://localhost:5173';
const FURSHET = 'ТОВ «Фуршет Плюс»'; // клієнт із багатою історією замовлень (демо-дані)

// Привести застосунок до чистого стану на потрібному екрані.
// mode 'app' — залогінений (демо-сесія); 'login' — екран входу (без сесії).
const reset = async (page, mode = 'app') => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('vendo_theme', 'light');
    localStorage.setItem('vendo_lang', 'uk');
    localStorage.setItem('vendo_api_url', 'http://localhost:3000/api');
    if (m === 'app') {
      localStorage.setItem('vendo_session', JSON.stringify({ user: { name: 'Демо' }, token: 'mock' }));
      localStorage.setItem('vendo_token', 'mock');
    }
  }, mode);
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (mode === 'app') await page.getByText('ВИТОРГ СЬОГОДНІ').waitFor({ timeout: 15000 });
  else await page.getByRole('button', { name: /Сканувати/ }).waitFor({ timeout: 15000 });
};

const nav = (page, label) => page.getByRole('button', { name: label, exact: false }).last().click();

const openFurshetOrder = async (page) => {
  await nav(page, 'Замовлення');
  await page.getByRole('button', { name: 'Весь час' }).click();
  await page.getByText(FURSHET).first().click();
  await page.getByText('Позиції').first().waitFor();
};

// Відкрити замовлення клієнта й зайти в каталог у контексті цього замовлення.
const openFurshetCatalog = async (page) => {
  await openFurshetOrder(page);
  await page.getByText('Додати', { exact: false }).first().click(); // + Додати → каталог
  await page.getByPlaceholder(/Пошук/).waitFor();
};

// Дочекатись, доки видимі фото товарів завантажаться (зовнішні URL — інакше кадр із порожніми
// боксами). Мʼякий таймаут: якщо частина не встигла — все одно знімаємо.
const waitImages = async (page) => {
  await page.waitForTimeout(400); // дати <img> зʼявитись у DOM
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img')].filter(i => i.getBoundingClientRect().width > 20);
    return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
  }, { timeout: 10000 }).catch(() => {});
};

// Клікнути іконкову кнопку без aria-label у шапці (напр. ⋮): найправіша серед svg-кнопок угорі.
const clickHeaderIconBtn = (page) => page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => {
    const r = b.getBoundingClientRect();
    return r.top < 140 && r.width <= 42 && b.querySelector('svg') && !b.getAttribute('aria-label');
  }).sort((a, z) => z.getBoundingClientRect().right - a.getBoundingClientRect().right);
  if (btns[0]) btns[0].click();
});

// Створити замовлення «на сьогодні» в мока — для кадру дашборда: демо-сід має статичні
// дати, тож блок «Сьогоднішні замовлення» інакше порожній. Мок in-memory: рестарт чистить,
// а номери (ЗМ-2043…) детерміновані за свіжого старту мока.
const seedTodayOrders = async () => {
  const [customers, products] = await Promise.all([
    fetch(`${MOCK}/customers`).then(r => r.json()),
    fetch(`${MOCK}/products`).then(r => r.json()),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const cust = (name) => customers.find(c => c.name.includes(name))?.id;
  const prod = (name) => products.find(p => p.name.includes(name))?.id;
  const post = (customerId, productId, qty, status) => fetch(`${MOCK}/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId, date: today, status, priceType: 'retail', orderItems: [{ productId, qty }] }),
  });
  await post(cust('Фуршет'), prod('Едам 45%'), 3, 'sent');
  await post(cust('АТБ'), prod('ультрапастеризоване'), 2, 'new');
};

const SHOTS = [
  // Каталог — кореневий рівень: групи, пошук і кнопка дій (⋮, #76).
  { file: 'catalog', at: async (page) => {
    await nav(page, 'Каталог');
    await page.getByText('ПІДГРУПИ', { exact: false }).waitFor();
  } },
  // Меню дій каталогу (⋮) — перемикач показу товарів без залишку (#76).
  { file: 'catalog-actions', at: async (page) => {
    await nav(page, 'Каталог');
    await page.getByText('ПІДГРУПИ', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Дії' }).click();
    await page.getByText('Показувати товари без залишку').waitFor();
    await page.waitForTimeout(400); // анімація шторки
  } },
  // Список замовлень — акцент на контрагенті (#75), номер і дата — допоміжні.
  { file: 'orders', at: async (page) => {
    await nav(page, 'Замовлення');
    await page.getByRole('button', { name: 'Весь час' }).click();
    await page.getByText(FURSHET).first().waitFor();
    await page.waitForTimeout(300);
  } },
  // Клієнти — папки довідника (#64), верхній рівень.
  { file: 'customers', at: async (page) => {
    await nav(page, 'Клієнти');
    await page.getByText('Роздрібні мережі').waitFor();
  } },
  // Клієнти — захід усередину папки (список клієнтів у групі HoReCa — прямі клієнти).
  { file: 'customers-groups', at: async (page) => {
    await nav(page, 'Клієнти');
    await page.getByText('HoReCa').click();
    await page.getByText('Кафе «Пузата Хата»').first().waitFor(); // клієнти всередині папки
  } },
  // Картка клієнта (нижній лист) — відкрити клієнта всередині папки.
  { file: 'customer-card', at: async (page) => {
    await nav(page, 'Клієнти');
    await page.getByText('HoReCa').click();
    await page.getByText('Кафе «Пузата Хата»').first().click();
    await page.getByText('Контактні особи').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600); // анімація відкриття картки
  } },
  // Вибір клієнта в замовленні — той самий CustomerTree (папки) у нижньому листі.
  { file: 'select-customer', at: async (page) => {
    await openFurshetOrder(page);
    await page.getByText(FURSHET).first().click();        // тап по картці клієнта → пікер
    await page.getByText('Оберіть контрагента').waitFor();
    await page.getByText('Роздрібні мережі').waitFor();   // пікер показує папки
  } },
  // Екран замовлення з кнопкою «Зберегти».
  { file: 'order-save', at: async (page) => {
    await openFurshetOrder(page);
    await page.getByRole('button', { name: 'Зберегти' }).waitFor();
  } },
  // Меню дій у замовленні (⋮) — перший пункт «Коментар» (#60).
  { file: 'action-menu', at: async (page) => {
    await openFurshetOrder(page);
    await clickHeaderIconBtn(page);
    await page.getByText('Коментар').first().waitFor();
  } },
  // Екран входу (без сесії).
  { file: 'login', pre: 'login', at: async (page) => {
    await page.getByRole('button', { name: /Сканувати/ }).waitFor();
  } },
  // Меню профілю (з пунктом «Довідка»).
  { file: 'profile-menu', at: async (page) => {
    await page.getByRole('button').filter({ hasText: /Користувач|Демо/ }).first().click();
    await page.getByText('Довідка').waitFor();
  } },
  // Каталог — пошук (синя «+», актуальний степер).
  { file: 'catalog-search', at: async (page) => {
    await nav(page, 'Каталог');
    await page.getByPlaceholder(/Пошук/).fill('сік');
    await page.getByText('ЗНАЙДЕНО', { exact: false }).waitFor();
    await waitImages(page);
  } },
  // Товар на весь екран (лайтбокс) — тап по фото товару.
  { file: 'product-fullscreen', at: async (page) => {
    await nav(page, 'Каталог');
    await page.getByPlaceholder(/Пошук/).fill('молоко');
    await page.getByText('ЗНАЙДЕНО', { exact: false }).waitFor();
    await waitImages(page);                               // фото має завантажитись, щоб лайтбокс мав картинку
    await page.locator('img').first().click();            // фото → лайтбокс
    await page.getByText(/SKU|Ціна|Артикул/).first().waitFor();
    await page.waitForTimeout(700);                       // домалювати картинку лайтбокса
  } },
  // Каталог — зелена смужка раніше замовлених (у контексті замовлення клієнта).
  // Запит «ультрапастеризоване 2.5» (крапка!) збігається лише з товаром, який клієнт
  // замовляв раніше — рядок зі смужкою гарантовано вгорі кадру (демо-каталог великий,
  // за коротким «мол» замовлений товар тонув нижче кадру).
  { file: 'catalog-ordered', at: async (page) => {
    await openFurshetCatalog(page);
    await page.getByPlaceholder(/Пошук/).fill('ультрапастеризоване 2.5');
    await page.getByText('ЗНАЙДЕНО', { exact: false }).waitFor();
    await waitImages(page);
  } },
  // Каталог — панель історії (свайп управо по зеленій смужці): кількість + дата.
  { file: 'catalog-ordered-history', at: async (page) => {
    await openFurshetCatalog(page);
    await page.getByPlaceholder(/Пошук/).fill('ультрапастеризоване 2.5');
    await page.getByText('ЗНАЙДЕНО', { exact: false }).waitFor();
    await waitImages(page);
    const box = await page.locator('div[style*="translateX"]', { hasText: 'Молоко ультрапастеризоване 2.5%' }).first().boundingBox();
    if (box) {
      const y = box.y + box.height / 2, sx = box.x + 28;
      await page.mouse.move(sx, y);
      await page.mouse.down();
      for (let d = 20; d <= 215; d += 25) await page.mouse.move(sx + d, y);
      await page.mouse.up();
    }
    await page.waitForTimeout(700); // анімація прилипання панелі
  } },
  // Головний екран — показники дня і сьогоднішні замовлення (акцент на контрагенті, #75).
  // ОСТАННІМ у маніфесті: seedTodayOrders мутує мок — щоб не проліз у кадр «Замовлення».
  { file: 'dashboard', at: async (page) => {
    await seedTodayOrders();
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('ВИТОРГ СЬОГОДНІ').waitFor();
    await page.getByText('Фуршет', { exact: false }).first().waitFor();
    await page.waitForTimeout(300);
  } },
];

const run = async () => {
  const only = process.argv.slice(2);
  const shots = only.length ? SHOTS.filter(s => only.some(o => s.file.includes(o))) : SHOTS;
  if (!shots.length) { console.error('Немає кадрів за фільтром:', only.join(', ')); process.exit(1); }

  // Передумова: сервери підняті.
  try { await fetch(`${MOCK}/health`); } catch { console.error(`Мок недоступний на ${MOCK}. Підніми бекенд (start.bat).`); process.exit(1); }
  try { await fetch(BASE); } catch { console.error(`Vite недоступний на ${BASE}. Підніми фронтенд (npm run dev).`); process.exit(1); }

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' });
  // /health → сумісний, щоб не було банера «бекенд застарілий» у кадрі; intervals (#68) —
  // щоб онлайн-індикатор ожив (без них додаток не запускає фонові цикли, включно з пінгом).
  await context.route('**/api/health', route =>
    route.request().method() === 'GET'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'ok', version: APP_VERSION, minAppVersion: '0.1.0', intervals: { syncSec: 300, pingSec: 15, telemetrySec: 900 } }) })
      : route.continue());
  const page = await context.newPage();

  let ok = 0;
  for (const shot of shots) {
    try {
      await reset(page, shot.pre === 'login' ? 'login' : 'app');
      await shot.at(page);
      await page.screenshot({ path: join(OUT, `${shot.file}.png`) });
      console.log(`✓ ${shot.file}.png`);
      ok++;
    } catch (e) {
      console.error(`✗ ${shot.file}: ${e.message}`);
    }
  }
  await browser.close();
  console.log(`Готово: ${ok}/${shots.length}`);
  if (ok < shots.length) process.exit(1);
};

run().catch(e => { console.error(e); process.exit(1); });
