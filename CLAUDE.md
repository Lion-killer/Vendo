# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Vendo is a mobile-first B2B order-taking app for field sales representatives (Ukrainian UI: catalog, customers, orders). It is a prototype with mock-seeded data. `backend/` is a container for interchangeable backends behind one REST contract: `backend/mock/` (a Node/Express demo API, in-memory seeded from `db.json` — the contract reference for local dev) and `backend/1c-config/` (the real 1C HTTP-service mini-config, merged into «Управление торговлей для Украины» 2.3). `frontend/` (React + Vite, wrapped with Capacitor for Android) is a separate Node project — plus `design/vendo-app.jsx`, the original single-file mockup that the `frontend/src` screens were split out from.

## Commands

Run from the project root unless noted. `start.bat` launches both servers in separate terminals (backend first, then frontend with `--host`).

**Backend — mock server** (`cd backend/mock`):
- `npm start` — start API on http://localhost:3000 (`node server.js`; no watch/reload — restart manually after edits, since `require` caches modules)
- API contract docs: **Swagger UI at http://localhost:3000/api/docs**, spec at `/api/openapi.json` (hand-maintained `backend/mock/openapi.json` — keep in sync with `routes/api.js` when the contract changes; Swagger UI loads from CDN, needs internet).
- `npm test` — unit tests via stdlib `node --test` (no deps). Pure order helpers live in `lib/orders.js` (`computeTotal`, `formatUAH`, `colorFor`, `pickLang`, `msg`); tested in `lib/orders.test.mjs`. DB-coupled code (`hydrateOrder`/`normalizeItems`) stays in `routes/api.js` and isn't unit-tested. No lint configured.
- Pure Node — no native modules/build (`express` + `cors` only). State is **in-memory**, seeded from `data/db.json` at startup; a restart resets to a clean seed (the mock deliberately doesn't persist).

**Frontend** (`cd frontend`):
- `npm run dev -- --host` — Vite dev server on http://localhost:5173 (`--host` exposes it on the LAN for device/emulator testing)
- `npm run build` — production build into `dist/`
- `npm test` — unit tests via stdlib `node --test` (`src/**/*.test.mjs`): `detectLang`, locale parity (uk/ru/en), `localOrders.newId`, `deviceData.purgeOnDeviceSwitch`. No lint configured.

If `npm run dev`/`build` fails with `'vite' is not recognized`, the `node_modules/.bin` shims are missing (e.g. after copying `node_modules` between drives) — run `npm install` to regenerate them, or invoke directly via `node node_modules/vite/bin/vite.js build`.

**Capacitor / Android**: `webDir` is `dist`, so `npm run build` before `npx cap sync`. App id `com.vendo.app`.

**Releases** (`cd frontend`): `npm run release` (or `-- patch|minor|major`; default `auto` derives the bump from conventional commits since the last tag: `!`/BREAKING → major, `feat` → minor, else patch) — bumps `package.json` (single version source; the npm `version` hook runs `scripts/sync-version.mjs` to write Android `versionName`/`versionCode` and the 1C mini-config version (`backend/1c-config/TradeUkr23/src/Configuration.xml` `<Version>`), plus `scripts/changelog.mjs` to prepend a section to root `CHANGELOG.md`), builds a signed APK (keystore `android/keystore.properties`, gitignored, auto-generated on first release — back it up), pushes the tag, creates a GitHub Release whose notes are the fresh CHANGELOG section. The app checks GitHub Releases once per session (`src/api/updates.js`, anonymous — repo is public) and shows an update button in the profile menu that opens the APK in the system browser. `__APP_VERSION__` is injected by Vite from `package.json`. The full chat-triggered procedure (docs review before build, preflight checks) lives in `.claude/skills/release/SKILL.md` — saying «випусти реліз» runs it.

## Architecture

### Backend — in-memory store (`backend/mock/routes/api.js`, `backend/mock/db.js`)
- `backend/mock/db.js` is the **in-memory store**: loads `data/db.json` at startup into arrays (`products`, `customers`, `categories`, `orders`, plus `meta.lastOrderSeq`) and exports them with lookup helpers (`productById`/`customerById`/`orderById`). Mutations live in memory; a restart re-seeds — no persistence. `db.json` is the seed fixture.
- `routes/api.js` operates on those arrays — single-threaded synchronous JS, so mutations are atomic (no transactions/locks needed). Orders keep **embedded items** (`{ productId, qty, price }`, price frozen at order time), hydrated on read.
- `POST /api/auth` is a stub that returns a fixed mock user/token; nothing validates the token.
- Endpoints: `GET /products|categories|customers`, `GET /orders` (optional `startDate`/`endDate` query filter, inclusive string compare on `YYYY-MM-DD`), `POST /orders`, `PUT /orders/:num`, `DELETE /orders/:num`.

**Order data is stored by reference, denormalized on read.** This is the key backend convention:
- An order holds `{ id, num, customerId, date, status, deletionMark, version, items }` where each item is a reference `{ productId, qty, price }`. No embedded product/customer copies.
- `hydrateOrder()` rebuilds the full object the frontend expects (`customer`, `client`, `items[].product`, `total`, `sColor`) by looking up `customers`/`products`. All GET/POST/PUT responses return hydrated orders.
- **Price is frozen per line item** (`items[].price` is a snapshot taken at order time via `normalizeItems`). `computeTotal` and the hydrated `product.price` use this stored price, so editing a product's catalog price does NOT change historical order totals. Product name/img/sku, however, are pulled live by `productId`.
- Create/update mutate the in-memory order in place (replacing items = reassign `order.items`); single-threaded JS makes it atomic.
- Order numbers come from `nextOrderNum()`, which increments `meta.lastOrderSeq` (resets on restart since in-memory). Do not revert to length-based numbering.
- `sColor` is derived from `status` via `STATUS_COLORS`; `categories.expanded` comes through as a boolean — never trust a client-sent color/flag.

When changing the order response shape, keep it compatible with what the screens read (see below), or update both sides.

### Frontend — single-component-tree, no router
- `src/App.jsx` is the orchestrator. Navigation is a `screen` string in `useState` (`login`, `dashboard`, `catalog`, `customers`, `orders`, `ordersList`) switched via `handleNav` — there is **no react-router** despite the dependency name history. The current order being built/edited lives in App state (`orderItems`, `editOrderId`, `editCustomer`) and is threaded into screens as props.
- `handleNav(screen, params)` carries intent: `{ order }` edits an existing order (loads its `items`/`customer`), `{ newOrder: true }` starts fresh, `{ keepOrder: true }` preserves the cart when bouncing Catalog↔Order.
- API layer: `src/api/client.js` (REST calls; `API_URL` is hardcoded to `http://localhost:3000/api` — change to `10.0.2.2` for Android emulator or the host LAN IP for a real device).

**Offline-first behavior** is central and spans `App.jsx` + `src/api/localOrders.js`:
- `loadData()` fetches all collections, mirrors them to **IndexedDB `vendo_data`** (`src/api/dataCache.js`; localStorage's ~5MB quota broke on large snapshots — a one-time migration from the legacy `localStorage['cached_data_v2']` runs on first load), and falls back to that cache when offline. The background 20s `fetchFromNetwork(true)` cycle toggles `isOnline`; per-collection JSON fingerprints (`collectionsFpRef`) skip setState/cache writes when nothing changed. Product images live in a separate IndexedDB `vendo_images` (`src/api/imageCache.js`).
- **Local data is device-scoped.** On QR login, `purgeOnDeviceSwitch` (`src/api/deviceData.js`) compares the scanned `vendo_device_id` with the stored one; if it changed, it wipes everything except UI prefs (`vendo_theme`/`vendo_lang`) and clears both IndexedDB caches (images + collections), so a different device's QR never loads the previous device's cached data, drafts, queue, token, or session.
- Draft/unsent orders are persisted client-side in `localStorage['vendo_local_orders']` (keyed by `num`; local-only orders get `local_<timestamp>` ids). `OrderScreen` auto-saves drafts on edit. Screens **merge** server orders with these local ones, de-duping by `num`, and the Dashboard "sync" action replays locals to the server (`createOrder`/`updateOrder`) then clears them. Status colors for local orders are assigned client-side and differ from the server's.

### Embedded help (offline)
- The user guide (`docs/user-guide/*.md` + `images/`) is the **single source**. `frontend/scripts/copy-help.mjs` (run via `predev`/`prebuild` npm hooks) copies it into `frontend/src/help/` (markdown) and `frontend/public/help-images/` (screenshots) — both **gitignored** (generated).
- `src/screens/HelpScreen.jsx` bundles the markdown via `import.meta.glob('../help/*.md', { query:'?raw', eager:true })` and renders it with `react-markdown` (v8, React-17-compatible), styled with theme tokens. Sections are sorted README→0–10→glossary; image `src` is rewritten `images/x` → `/help-images/x`; in-guide `*.md` links switch sections in-app. Opened from the profile menu ("Довідка") as a full-screen overlay (`showHelp` in `App.jsx`); hardware back closes it. Guide is uk-only for now (menu label is localized; content shows a uk-only note in ru/en).

### Theming & shared UI
- `src/theme.js` exports `LIGHT`/`DARK` token objects; `App` picks one into `t` and passes it down to every screen/component. All styling is inline `style={{...}}` using `t.*` tokens — there is no CSS framework or stylesheet (global keyframes/font are injected via a `<style>` tag in `App.jsx`). Every screen uses the same token vocabulary (`ink`/`accent`/`line`/`err`…); there is **no** legacy-alias layer anymore.
- Reusable pieces in `src/components/`: `Icon` (named SVG set used by Login/Help/Snackbar), `ui.jsx` (the main toolkit — `MIcon` icon set, `BottomNav`, `TopActions`, `Card`, `ConfirmDialog`, `ListPlaceholder`, `ScrollRow`, `ProductImage`, `SwipeToDelete`; exports `TOP_ACTIONS_W` so header buttons reserve room for the floating `TopActions`), `Shared.jsx` (`Snackbar` only).
- Shared formatters live in `src/i18n.js`: `fmtMoney`/`fmtCur`, `parseMoney` (tolerates uk/ru comma-decimals), `todayISO`, `fmtDate`, `orderNum`. Screens import these instead of redefining them.
- A floating dev toolbar (top-right in `App.jsx`) toggles dark mode and the online/offline flag for browser testing.
