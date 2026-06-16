# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TradeRep is a mobile-first B2B order-taking app for field sales representatives (Ukrainian UI: catalog, customers, orders). It is a prototype with mock-seeded data. Two independent Node projects — `backend/` (Express API over SQLite) and `frontend/` (React + Vite, wrapped with Capacitor for Android) — plus `design/trade-rep-app.jsx`, the original single-file mockup that the `frontend/src` screens were split out from.

## Commands

Run from the project root unless noted. `start.bat` launches both servers in separate terminals (backend first, then frontend with `--host`).

**Backend** (`cd backend`):
- `npm start` — start API on http://localhost:3000 (`node server.js`; no watch/reload — restart manually after edits, since `require` caches modules)
- No tests or lint configured.
- Uses `better-sqlite3` (native module). After a Node major-version change or moving `node_modules` between machines, run `npm install` / `npm rebuild better-sqlite3` to rebuild the binary.
- To reset the database to seed state, stop the server and delete `data/traderep.db` (and any `-wal`/`-shm` files); it re-seeds from `data/db.json` on next start.

**Frontend** (`cd frontend`):
- `npm run dev -- --host` — Vite dev server on http://localhost:5173 (`--host` exposes it on the LAN for device/emulator testing)
- `npm run build` — production build into `dist/`
- No tests or lint configured.

If `npm run dev`/`build` fails with `'vite' is not recognized`, the `node_modules/.bin` shims are missing (e.g. after copying `node_modules` between drives) — run `npm install` to regenerate them, or invoke directly via `node node_modules/vite/bin/vite.js build`.

**Capacitor / Android**: `webDir` is `dist`, so `npm run build` before `npx cap sync`. App id `com.traderep.app`.

## Architecture

### Backend — SQLite API (`backend/routes/api.js`, `backend/db.js`)
- `backend/db.js` owns the database: opens `data/traderep.db` (`better-sqlite3`, WAL mode, foreign keys on), creates the schema, and **seeds once from `data/db.json` if the DB is empty**. `db.json` is now only a seed fixture, not the live store — runtime reads/writes go to SQLite. Tables: `products`, `customers`, `categories`, `orders`, `order_items` (FK → `orders` with `ON DELETE CASCADE`), `meta` (key/value, holds `lastOrderSeq`).
- `routes/api.js` uses prepared statements (`q.*`) and is synchronous (`better-sqlite3` has no async API — and because each statement runs to completion, concurrent requests are effectively serialized, so there are no lost-update races).
- `POST /api/auth` is a stub that returns a fixed mock user/token; nothing validates the token.
- Endpoints: `GET /products|categories|customers`, `GET /orders` (optional `startDate`/`endDate` query filter, inclusive string compare on `YYYY-MM-DD`), `POST /orders`, `PUT /orders/:num`, `DELETE /orders/:num`.

**Order data is normalized in storage, denormalized on read.** This is the key backend convention:
- Stored across `orders` + `order_items` as references: `{ num, customerId, date, status }` and `{ orderNum, productId, qty, price }`. No embedded product/customer copies.
- `hydrateOrder()` rebuilds the full object the frontend expects (`customer`, `client`, `items[].product`, `total`, `sColor`) by querying `customers`/`products`. All GET/POST/PUT responses return hydrated orders.
- **Price is frozen per line item** (`order_items.price` is a snapshot taken at order time via `normalizeItems`). `computeTotal` and the hydrated `product.price` use this stored price, so editing a product's catalog price does NOT change historical order totals. Product name/img/sku, however, are pulled live by `productId`.
- Create/update of an order run inside a `db.transaction(...)` so the order row and its items commit atomically (and replacing items = `deleteItems` + re-insert).
- Order numbers come from `nextOrderNum()`, which increments the persistent `meta.lastOrderSeq` (never reused after deletes). Do not revert to length-based numbering.
- `sColor` is derived from `status` via `STATUS_COLORS`; `categories.expanded` is stored as 0/1 and cast back to boolean on read — never trust a client-sent color/flag.

When changing the order response shape, keep it compatible with what the screens read (see below), or update both sides.

### Frontend — single-component-tree, no router
- `src/App.jsx` is the orchestrator. Navigation is a `screen` string in `useState` (`login`, `dashboard`, `catalog`, `customers`, `orders`, `ordersList`) switched via `handleNav` — there is **no react-router** despite the dependency name history. The current order being built/edited lives in App state (`orderItems`, `editOrderId`, `editCustomer`) and is threaded into screens as props.
- `handleNav(screen, params)` carries intent: `{ order }` edits an existing order (loads its `items`/`customer`), `{ newOrder: true }` starts fresh, `{ keepOrder: true }` preserves the cart when bouncing Catalog↔Order.
- API layer: `src/api/client.js` (REST calls; `API_URL` is hardcoded to `http://localhost:3000/api` — change to `10.0.2.2` for Android emulator or the host LAN IP for a real device).

**Offline-first behavior** is central and spans `App.jsx` + `src/api/localOrders.js`:
- `loadData()` fetches all collections, mirrors them to `localStorage['cached_data']`, and falls back to that cache when offline. A background `pingServer()` (HEAD `/products`) every 15s toggles `isOnline` and reloads on reconnect.
- Draft/unsent orders are persisted client-side in `localStorage['traderep_local_orders']` (keyed by `num`; local-only orders get `local_<timestamp>` ids). `OrderScreen` auto-saves drafts on edit. Screens **merge** server orders with these local ones, de-duping by `num`, and the Dashboard "sync" action replays locals to the server (`createOrder`/`updateOrder`) then clears them. Status colors for local orders are assigned client-side and differ from the server's.

### Theming & shared UI
- `src/theme.js` exports `LIGHT`/`DARK` token objects; `App` picks one into `t` and passes it down to every screen/component. All styling is inline `style={{...}}` using `t.*` tokens — there is no CSS framework or stylesheet (global keyframes/font are injected via a `<style>` tag in `App.jsx`).
- Reusable pieces in `src/components/`: `Icon` (named SVG set), `Shared.jsx` (`BottomNav`, `Snackbar`, `Badge` stock indicator, `PhoneFrame`).
- A floating dev toolbar (top-right in `App.jsx`) toggles dark mode and the online/offline flag for browser testing.
