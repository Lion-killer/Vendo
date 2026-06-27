# Vendo

Мобільний застосунок для торгових представників (B2B) — каталог товарів, контрагенти та оформлення замовлень «у полі». Український інтерфейс, **offline-first** логіка, збірка під Android через Capacitor.

Один REST-контракт має **дві реалізації бекенду**:
- **`backend/`** — демо-сервер (Node + Express + SQLite) для розробки; авторизація імітована, дані сідяться з фікстури.
- **`1c-config/`** — бойова інтеграція: міні-конфігурація 1С (HTTP-сервіс), що **об'єднується з «Управление торговлей для Украины» 2.3**. Реальна авторизація (одноразовий код → bearer-токен), реальні номенклатура/ціни/залишки/контрагенти/замовлення.

## Стек

| Частина | Технології |
|---|---|
| **Demo backend** | Node.js + Express 5, SQLite (`better-sqlite3`) |
| **1C backend** | HTTP-сервіс 1С (BSL), УТ для України 2.3, платформа 8.3.x (режим сумісності 8.2.13) |
| **Frontend** | React 17, Vite 8, i18next (uk/ru/en), inline-стилі (без CSS-фреймворку) |
| **Mobile** | Capacitor 8 (Android): App, Filesystem, Share, BarcodeScanner |

## Структура

```
Vendo/
├─ backend/                # демо REST API над SQLite
│  ├─ server.js            # точка входу (порт 3000)
│  ├─ db.js                # схема SQLite + одноразовий сід із db.json
│  ├─ routes/api.js        # ендпоінти (prepared statements)
│  ├─ openapi.json         # контракт (Swagger UI на /api/docs)
│  └─ data/db.json         # сід-фікстура
├─ 1c-config/src/          # міні-конфігурація 1С (XML-вивантаження)
│  └─ HTTPServices/венд_МобильноеПриложение/   # HTTP-сервіс: /auth, /products, /orders…
├─ frontend/               # React + Vite (+ Android-проект Capacitor)
│  └─ src/
│     ├─ App.jsx           # оркестратор: навігація, стан, offline/sync-логіка
│     ├─ api/              # REST-клієнт, локальна черга, кеш зображень, історія sync
│     ├─ screens/          # login, dashboard, catalog, customers, order, ordersList
│     ├─ components/       # Icon, ProductImage, ErrorBoundary, LogPanel, SyncHistoryPanel…
│     ├─ logger.js         # журнал роботи + надсилання логу («Поділитися»)
│     ├─ i18n.js, locales/ # локалізація uk/ru/en
│     └─ theme.js          # токени світлої/темної теми
├─ design/                 # початковий single-file мокап
└─ start.bat               # запуск backend + frontend (Windows)
```

## Запуск (демо-бекенд)

Потрібен Node.js 18+.

### Швидкий старт (Windows)
```bat
start.bat
```
Підніме backend (http://localhost:3000) і frontend (http://localhost:5173).

### Вручну
```bash
cd backend && npm install && npm start      # API на :3000, контракт на /api/docs
cd frontend && npm install && npm run dev -- --host
```
При першому запуску `db.js` сідить `data/vendo.db` із `data/db.json`.

### Збірка та Android
```bash
cd frontend
npm run build          # → dist/
npx cap sync android   # синхронізувати веб-збірку + нативні плагіни в Android-проект
```
> Адреса бекенду й ідентифікатор пристрою беруться з **QR-коду** при вході (зберігаються в `localStorage`). Запасна адреса для емулятора — `10.0.2.2` ([`src/api/client.js`](frontend/src/api/client.js)).

## API

Базовий шлях: `/api` (демо) або `…/hs/vendo` (1С). Повний контракт — `backend/openapi.json` (Swagger UI на `/api/docs`).

| Метод | Шлях | Опис |
|---|---|---|
| `POST` | `/auth` | Обмін одноразового коду прив'язки на bearer-токен (1С); у демо — стаб |
| `GET`/`HEAD` | `/health` | Дешева перевірка доступності (без авторизації) |
| `GET` | `/products` | Номенклатура (ціна за типом цін, залишок за складом, штрихкод, фото) |
| `GET` | `/products/{id}/image` | Бінарне фото товару (`?v=` — інвалідація кешу) |
| `GET` | `/categories` | Категорії |
| `GET` | `/customers` | Контрагенти пристрою (адреса/телефон/контактні особи/борг) |
| `GET` | `/orders` | Замовлення за період (`?startDate=&endDate=`), скоуп за контрагентами пристрою |
| `POST` | `/orders` | Upsert замовлення за клієнтським GUID (ідемпотентно) |
| `PUT` | `/orders/{id}` | Оновити замовлення (за GUID) |
| `DELETE` | `/orders/{id}` | Помітка на видалення |

Авторизація: заголовки `X-Device-Id` + `X-Auth-Token` (Authorization платформа 1С перехоплює для ІБ). Мова відповіді — за `Accept-Language`.

## Особливості архітектури

- **Дві реалізації одного контракту.** Демо-Node і 1С-сервіс віддають однаковий JSON; замовлення зберігаються нормалізовано (посилання), а на віддачі гідратуються (товари/клієнт/сума).
- **Ідентичність за GUID.** Клієнтський GUID замовлення = посилання документа в 1С → ідемпотентний upsert офлайн-черги.
- **Offline-first.** Дані кешуються (`localStorage` + IndexedDB для фото); фонова синхронізація кожні 20 с; чернетки/правки/видалення/відновлення складаються в локальну чергу й відсилаються кнопкою синхронізації.
- **Розв'язання колізій.** Оптимістична конкуренція за `ВерсияДанных` (409 + `serverState`), діалог «перезаписати / взяти серверне», заборона редагувати/видаляти проведене, версія-гард на видалення/відновлення. Деталі — [issue #33](https://github.com/Lion-killer/Vendo/issues/33).
- **Діагностика.** Журнал роботи додатку з надсиланням розробнику через «Поділитися» (zip); історія синхронізацій (прогони + per-order результат); `ErrorBoundary` замість «білого екрана».
- **Локалізація** uk/ru/en (автовизначення + ручне перемикання), формати дат/чисел/валюти.

## Скидання демо-бази

Зупиніть backend і видаліть файли БД — пересіються з `db.json`:
```bash
rm backend/data/vendo.db backend/data/vendo.db-wal backend/data/vendo.db-shm
```
