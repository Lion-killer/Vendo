import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fetchAuthedBlobRaw } from '../api/client';
import { loadCachedImage } from '../api/imageCache';
import { F_NUM, F_UI, Z } from '../theme';
import { curSymbol, fmtMoney } from '../i18n';

// Горизонтальний ряд із прихованим скролом і підказками-градієнтами на краях:
// тінь зліва/справа зʼявляється лише коли є куди гортати (чіпи фільтра, хлібні крихти).
// fade — колір фону-підкладки (для коректного згасання в прозорість потрібен 6-знач. hex).
// stickEnd — прокрутити в кінець при зміні вмісту (актуально для хлібних крихт: видно поточний вузол).
export const ScrollRow = ({ children, fade, gap = 8, stickEnd = false, style = {} }) => {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const update = () => {
    const el = ref.current; if (!el) return;
    setEdge({ l: el.scrollLeft > 2, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  };
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (stickEnd) el.scrollLeft = el.scrollWidth;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); };
  }, [children, stickEnd]);
  const mask = (side) => ({ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: 26, pointerEvents: 'none', background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${fade}, ${fade}00)` });
  return (
    <div style={{ position: 'relative', ...style }}>
      <div ref={ref} style={{ display: 'flex', gap, overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>{children}</div>
      {edge.l && <div style={mask('left')} />}
      {edge.r && <div style={mask('right')} />}
    </div>
  );
};

// ─── Тонкі stroke-іконки (геометричні) ─────────────────────────────────────────
export const MIcon = ({ name, size = 20, color = "currentColor", w = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {ICON[name]}
  </svg>
);

export const ICON = {
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4a3.5 3.5 0 0 1 0 7" /><path d="M22 20a6 6 0 0 0-4-5.65" /></>,
  doc: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  back: <><path d="M15 6l-6 6 6 6" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M3 4h2.5l2 12h12l2-9H6" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></>,
  sync: <><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3" /><path d="M21 4v5h-5M3 20v-5h5" /></>,
  wifi: <><path d="M5 12.5a11 11 0 0 1 14 0" /><path d="M2 9a16 16 0 0 1 20 0" /><path d="M8.5 16a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="0.7" fill="currentColor" /></>,
  wifiOff: <><path d="M1 1l22 22" /><path d="M16.7 11.1A11 11 0 0 1 19 12.5" /><path d="M5 12.5a11 11 0 0 1 5.2-2.4" /><path d="M10.7 5.1A16 16 0 0 1 22.5 9" /><path d="M2 9a16 16 0 0 1 4.7-2.9" /><path d="M8.5 16a6 6 0 0 1 7 0" /><circle cx="12" cy="20" r="0.7" fill="currentColor" /></>,
  bell: <><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  check: <><path d="M5 12l5 5L20 7" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="2.5" /></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M9 21V14h6v7" /><path d="M9 7h.01M13 7h.01M9 11h.01M13 11h.01" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
  route: <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h7a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H9a4 4 0 0 0-4 4v0" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3M21 14v7h-7v-3M14 17h3" /></>,
  barcode: <><path d="M3 5v14M6 5v14M9 5v14M13 5v14M17 5v14M21 5v14" /></>,
  star: <><polygon points="12 3 14.5 9 21 9.5 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.5 9.5 9" /></>,
  more: <><circle cx="12" cy="6" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="18" r="1.4" fill="currentColor" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
  message: <><path d="M21 11.5a8.38 8.38 0 0 1-11.9 7.6L3 21l1.9-6.1A8.38 8.38 0 1 1 21 11.5z" /></>,
};

// Ширина плаваючого кластера TopActions (2×38 + gap 8) — екрани з власними кнопками
// в шапці резервують це місце справа, щоб не наїхати на нього. Єдине джерело правди.
export const TOP_ACTIONS_W = 84;

// ─── Зум-зображення: pinch + панорамування + подвійний тап + колесо (#30) ──────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ZoomImage = ({ src, alt }) => {
  const sc = React.useRef(1), tx = React.useRef(0), ty = React.useRef(0);
  const ptrs = React.useRef(new Map());
  const lastD = React.useRef(0);
  const [, force] = React.useReducer(x => x + 1, 0);
  const reset = () => { tx.current = 0; ty.current = 0; };

  const down = e => { e.currentTarget.setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); lastD.current = 0; };
  const move = e => {
    if (!ptrs.current.has(e.pointerId)) return;
    const prev = ptrs.current.get(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    if (pts.length >= 2) {                                   // pinch
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastD.current) { sc.current = clamp(sc.current * d / lastD.current, 1, 5); if (sc.current === 1) reset(); }
      lastD.current = d;
    } else if (sc.current > 1) {                             // панорамування
      tx.current += e.clientX - prev.x; ty.current += e.clientY - prev.y;
    }
    force();
  };
  const up = e => { ptrs.current.delete(e.pointerId); lastD.current = 0; };
  const dbl = () => { if (sc.current > 1) { sc.current = 1; reset(); } else sc.current = 2.5; force(); };
  const wheel = e => { e.preventDefault(); sc.current = clamp(sc.current - e.deltaY * 0.002, 1, 5); if (sc.current === 1) reset(); force(); };

  return (
    <img src={src} alt={alt || ""} draggable={false}
      onClick={e => e.stopPropagation()} onDoubleClick={dbl} onWheel={wheel}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{
        maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12,
        touchAction: "none", userSelect: "none", cursor: sc.current > 1 ? "grab" : "zoom-in",
        transform: `translate(${tx.current}px, ${ty.current}px) scale(${sc.current})`,
        transition: ptrs.current.size ? "none" : "transform .15s",
      }} />
  );
};

// ─── Єдиний лайтбокс фото на весь застосунок ──────────────────────────────────
// Один екземпляр (хост <Lightbox/> у App) — однаковий вигляд для каталогу й замовлення.
// Відкривається імперативно openLightbox(дані), закривається closeLightbox(); зокрема
// апаратний «назад» закриває його перед навігацією (App перевіряє isLightboxOpen).
let lbData = null;
const lbListeners = new Set();
export const openLightbox = (data) => { lbData = data; lbListeners.forEach(f => f()); };
export const closeLightbox = () => { if (lbData === null) return false; lbData = null; lbListeners.forEach(f => f()); return true; };
export const isLightboxOpen = () => lbData !== null;

export const Lightbox = () => {
  const { t: tr } = useTranslation();
  const [data, setData] = useState(lbData);
  useEffect(() => {
    const f = () => setData(lbData);
    lbListeners.add(f);
    return () => { lbListeners.delete(f); };
  }, []);
  if (!data) return null;
  const { src, status, name, sku, barcode, price, currency, stock, unit, prices, priceTypes, activePriceType } = data;
  const label = { color: "rgba(255,255,255,0.5)" };
  // Каталог передає всі типи цін пристрою (#47) — показуємо перелік «Тип: ціна», активний
  // виділено, 0/відсутня — «немає ціни». Один тип або фото з замовлення — один рядок «Ціна».
  const showTypeList = Array.isArray(priceTypes) && priceTypes.length > 1 && prices;
  return createPortal(
    <div onClick={closeLightbox} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: Z.lightbox, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
      {src
        ? <ZoomImage src={src} alt={sku} />
        : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "rgba(255,255,255,0.82)", textAlign: "center", padding: 24, maxWidth: "82%" }}>
            {/* Заглушка в стилі додатка (#47): «вантажиться» — три крапки, як у мініатюрі
                рядка; «не встановлено» — монохромний гліф image. Без емодзі. */}
            <div style={{ width: 88, height: 88, borderRadius: 22, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {status === "pending"
                ? <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.6)" }} />)}
                  </div>
                : <MIcon name="image" size={38} color="rgba(255,255,255,0.45)" w={1.6} />}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {status === "pending" ? tr("lightbox.loading") : tr("lightbox.noImage")}
            </div>
            {status === "pending" && <div style={{ fontSize: 13, opacity: 0.7 }}>{tr("lightbox.loadingHint")}</div>}
          </div>}
      <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} aria-label={tr("a11y.close")}
        style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", right: 16, width: 40, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <MIcon name="x" size={22} color="#fff" />
      </button>
      {name && <div style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", left: 16, right: 64, color: "#fff", fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>}
      {(sku || barcode || price != null || stock != null || showTypeList) && <div style={{ position: "fixed", bottom: "max(24px, env(safe-area-inset-bottom))", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.85)", fontFamily: F_NUM, fontSize: 12, display: "flex", flexDirection: "column", gap: 3 }}>
        {showTypeList
          ? priceTypes.map(pt => {
              const v = prices[pt.id];
              const has = v != null && Number(v) > 0; // 0 = немає ціни (#45)
              const on = pt.id === activePriceType;
              return <span key={pt.id} style={{ fontWeight: on ? 700 : 400, color: on ? "#fff" : "rgba(255,255,255,0.85)" }}>
                <span style={label}>{pt.name}: </span>{has ? <>{fmtMoney(v, { minimumFractionDigits: 2 })} {curSymbol(currency)}</> : tr("lightbox.noPrice")}
              </span>;
            })
          : price != null && <span><span style={label}>{tr("lightbox.price")}: </span>{fmtMoney(price, { minimumFractionDigits: 2 })} {curSymbol(currency)}</span>}
        {stock != null && <span><span style={label}>{tr("lightbox.stock")}: </span>{stock}{unit ? ` ${unit}` : ""}</span>}
        {sku && <span><span style={label}>{tr("lightbox.sku")}: </span>{sku}</span>}
        {barcode && <span><span style={label}>{tr("lightbox.barcode")}: </span>{barcode}</span>}
      </div>}
    </div>,
    document.body
  );
};

// ─── Фото товару з fallback на плейсхолдер; тап відкриває спільний лайтбокс (#30) ──
// prices/priceTypes/activePriceType — опційні (каталог, #47): лайтбокс покаже всі типи цін.
export const ProductImage = ({ t, img, sku, name, barcode, price, currency, stock, unit, prices, priceTypes, activePriceType, size = 56, radius = 10 }) => {
  const [err, setErr] = React.useState(false);
  // img-шлях виду "/products/{id}/image" — захищений ендпоінт: вантажимо blob із заголовками.
  // Звичайний URL/емодзі-фолбек використовуємо напряму.
  const isApi = typeof img === "string" && img.charAt(0) === "/";
  const [blobSrc, setBlobSrc] = React.useState(null);
  React.useEffect(() => {
    setErr(false); setBlobSrc(null);
    if (!isApi) return;
    let alive = true, url = null;
    loadCachedImage(img, fetchAuthedBlobRaw).then(u => {
      if (!alive) { if (u) URL.revokeObjectURL(u); return; }
      url = u; setBlobSrc(u);
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [img]);
  const src = isApi ? blobSrc : img;
  const show = src && !err;
  // Сервер каже, що фото Є (непорожній img-шлях), але blob ще немає → "вантажиться/не
  // завантажилось" (три крапки), а не "фото немає" (артикул). Так розрізняємо ці стани.
  const pending = isApi && !show && !err;
  // Стан для лайтбокса: є фото / ще вантажиться (в черзі) / немає. Клік відкриває лайтбокс
  // ЗАВЖДИ — навіть без фото, щоб показати причину (в черзі / не встановлено).
  const status = show ? "ok" : pending ? "pending" : "none";
  return (
    <div onClick={(e) => { e.stopPropagation(); openLightbox({ src, status, name, sku, barcode, price, currency, stock, unit, prices, priceTypes, activePriceType }); }} style={{
      width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden",
      border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center",
      // Фото є: білий фон (показ) або нейтральний (вантажиться). Фото немає: діагональна штриховка.
      background: show ? "#fff" : pending ? t.surfaceMuted : `repeating-linear-gradient(135deg, ${t.surfaceMuted} 0 6px, ${t.bg} 6px 12px)`,
      cursor: show ? "zoom-in" : "pointer",
    }}>
      {show
        ? <img src={src} alt={sku || ""} loading="lazy" onError={() => setErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : pending
          // Фото існує, але ще не показане (вантажиться або не вдалося) — три статичні
          // крапки, без анімації. НЕ артикул-плейсхолдер.
          ? <div style={{ display: "flex", gap: Math.max(2, size * 0.05) }}>
              {[0, 1, 2].map(i => <span key={i} style={{ width: Math.max(3, size * 0.07), height: Math.max(3, size * 0.07), borderRadius: "50%", background: t.inkMuted, opacity: 0.6 }} />)}
            </div>
          : <span style={{ fontFamily: F_NUM, fontSize: size > 44 ? 9 : 8, color: t.inkMuted }}>{sku}</span>}
    </div>
  );
};

// ─── Індикатор онлайн/офлайн у стилі іконок-кнопок (bell/sync) ─────────────────
// floating=true — фіксований у правому верхньому куті (для екранів без шапки з іконками).
// Стани (пріоритет згори вниз):
//   connecting — перше завантаження без кешу (wifi, жовтий пульс) → "Підключення…"
//   offline    — пінг HEAD /health не проходить (wifiOff, червоний) → "Офлайн"
//   syncing    — онлайн + ІДЕ активна відправка черги (doSync); wifi, жовтий пульс →
//                "Синхронізація". Саме обмін, а не "є невідправлене": непорожню чергу
//                показує червона крапка на кнопці синку + бейджі в списку (інакше
//                чернетки/застряглі замовлення тримали б вічний жовтий).
//   online     — онлайн, обмін не йде (wifi, зелений) → "Онлайн"
export const OnlineIndicator = ({ t, online, connecting, syncing, floating }) => {
  const { t: tr } = useTranslation();
  const state = connecting ? "connecting" : !online ? "offline" : syncing ? "syncing" : "online";
  const icon = state === "offline" ? "wifiOff" : "wifi";
  const iconColor = state === "offline" ? t.err : state === "online" ? t.ok : t.warn;
  const label = tr(`net.${state}`);
  const animate = state === "connecting" || state === "syncing";
  return (
    <div aria-label={label} style={{
      position: floating ? "fixed" : "relative",
      ...(floating ? { top: "max(16px, env(safe-area-inset-top))", right: 16, zIndex: 1500, pointerEvents: "none" } : {}),
      width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <div style={{ display: "flex", animation: animate ? "pulse 1.8s ease-in-out infinite" : "none" }}>
        <MIcon name={icon} size={18} color={iconColor} />
      </div>
    </div>
  );
};

// ─── Плаваючий кластер верхніх дій (на всіх екранах): сповіщення, синхронізація, статус ──
export const TopActions = ({ t, online, connecting, syncing, pending = 0, onSync, offsetTop = 0 }) => {
  const { t: tr } = useTranslation();
  const btn = { width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  return (
    <div style={{ position: "fixed", top: `calc(max(16px, env(safe-area-inset-top)) + ${offsetTop}px)`, right: 16, zIndex: Z.floating, display: "flex", gap: 8 }}>
      <button onClick={onSync} aria-label={tr("a11y.sync")} style={{ ...btn, position: "relative", cursor: "pointer", fontFamily: "inherit" }}>
        <div style={{ animation: syncing ? "spin 1s linear infinite" : "none", display: "flex" }}><MIcon name="sync" size={18} color={t.ink} /></div>
        {pending > 0 && <div style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 4, background: t.err }} />}
      </button>
      <OnlineIndicator t={t} online={online} connecting={connecting} syncing={syncing} />
    </div>
  );
};

// ─── Свайп-вліво відкриває кнопку видалення (підтвердження по натисканню) ─────────
// Тягнемо рядок вліво → з-під нього виїжджає червона кнопка «Видалити». Сам свайп НЕ
// видаляє — лише відкриває; видалення спрацьовує тільки по натисканню кнопки. Тап по
// відкритому рядку (або свайп назад) — закриває. Вертикальний скрол не блокуємо (pan-y).
export const SwipeToDelete = ({ children, onDelete, t, disabled = false, label }) => {
  const { t: tr } = useTranslation();
  const lbl = label || tr("common.delete"); // дефолт локалізований (#49)
  const REVEAL = 92, OPEN_AT = 40;
  const [dx, setDx] = useState(0);            // 0 — закрито, -REVEAL — відкрито
  const [dragging, setDragging] = useState(false);
  const s = useRef(null);
  const dxRef = useRef(0);
  const armed = useRef(false);                // ковтнути синтетичний click одразу після свайпу
  if (disabled) return children;
  const setX = (v) => { dxRef.current = v; setDx(v); };
  const down = (e) => { s.current = { x: e.clientX, y: e.clientY, base: dxRef.current, on: false }; };
  const move = (e) => {
    if (!s.current) return;
    const ddx = e.clientX - s.current.x, ddy = e.clientY - s.current.y;
    if (!s.current.on) {
      if (Math.abs(ddx) > 8 && Math.abs(ddx) > Math.abs(ddy)) { s.current.on = true; setDragging(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
      else if (Math.abs(ddy) > 8) { s.current = null; return; } // вертикальний скрол
      else return;
    }
    setX(Math.max(-REVEAL, Math.min(0, s.current.base + ddx)));
  };
  const up = () => {
    const on = s.current && s.current.on; s.current = null; setDragging(false);
    if (!on) return;
    setX(dxRef.current <= -OPEN_AT ? -REVEAL : 0); // прилипання: відкрито / закрито
    armed.current = true; setTimeout(() => { armed.current = false; }, 250);
  };
  const open = dx <= -OPEN_AT;
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Кнопку показуємо лише коли рядок відкривають/тягнуть — у закритому стані її
          немає взагалі (щоб червоне не проступало під рядками). */}
      {dx < 0 && (
        <button onClick={(e) => { e.stopPropagation(); setX(0); onDelete && onDelete(); }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: REVEAL, background: t.err, color: "#fff", border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700 }}>
          <MIcon name="trash" size={16} color="#fff" />
          {lbl}
        </button>
      )}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => { if (armed.current) { armed.current = false; e.stopPropagation(); e.preventDefault(); return; } if (open) { e.stopPropagation(); e.preventDefault(); setX(0); } }}
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? "none" : "transform .2s ease", touchAction: "pan-y", position: "relative", background: t.surface }}>
        {children}
      </div>
    </div>
  );
};

// ─── Базова картка ──────────────────────────────────────────────────────────────
export const Card = ({ children, style = {}, t, ...rest }) => (
  <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, ...style }} {...rest}>
    {children}
  </div>
);

// ─── Стан списку: спінер ЛИШЕ коли даних немає взагалі й триває завантаження;
// інакше — порожній стан (children: іконка + текст). Єдине правило для всіх екранів. ──
export const ListPlaceholder = ({ loading, t, children }) => (
  <div style={{ textAlign: "center", padding: "44px 20px", color: t.inkMuted }}>
    {loading
      ? <div style={{ width: 30, height: 30, border: `3px solid ${t.line}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
      : children}
  </div>
);

// ─── Нижній лист (модальна шторка знизу) — єдиний стиль для меню й вибірників ──────
// Скрим t.overlay + картка з радіусом угорі та «ручкою». Внутрішні відступи можна
// перекрити через sheetStyle. Клік по скриму закриває; клік усередині — ні.
export const BottomSheet = ({ t, onClose, zIndex = Z.sheet, sheetStyle, children }) => (
  <div onClick={onClose} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))", ...sheetStyle }}>
      <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "0 auto 16px" }} />
      {children}
    </div>
  </div>
);

// ─── Діалог підтвердження у стилі додатка (замість нативного window.confirm) ───────
export const ConfirmDialog = ({ t, icon = "trash", danger = true, title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  const { t: tr } = useTranslation();
  confirmLabel = confirmLabel || tr("common.ok");     // локалізовані дефолти (#49)
  cancelLabel = cancelLabel || tr("common.cancel");
  return (
  <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: Z.dialog, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(2px)" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: t.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, boxShadow: "0 16px 40px rgba(0,0,0,0.3)", fontFamily: F_UI }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: (danger ? t.err : t.accent) + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MIcon name={icon} size={24} color={danger ? t.err : t.accent} />
        </div>
      </div>
      {title && <h3 style={{ color: t.ink, fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>{title}</h3>}
      {body && <p style={{ color: t.inkMuted, fontSize: 14, lineHeight: 1.45, textAlign: "center", margin: "0 0 24px" }}>{body}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: 12, background: t.surfaceMuted, border: `1px solid ${t.line}`, borderRadius: 12, color: t.ink, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: 12, background: danger ? t.err : t.accent, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
  );
};

// ─── Пілл стану (VIP / борг / новий…) ─────────────────────────────────────────
export const Pill = ({ children, bg, fg }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: "2px 7px", borderRadius: 6, letterSpacing: 0.2, whiteSpace: "nowrap" }}>{children}</span>
);

// Поле кількості з ручним вводом: тап по числу відкриває цифрову клавіатуру телефона,
// значення комітиться на blur/Enter (не на кожне натискання). Чернетка-рядок дозволяє
// тимчасово порожнє поле під час набору; порожнє/менше min → min. Виділяє текст при
// фокусі — набране число одразу замінює старе. Для швидкого вводу великих кількостей
// (напр. 1000) замість наклацування кнопками −/+.
export const QtyInput = ({ t, value, onCommit, min = 1, width = 46, fontSize = 13.5, color, style = {} }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => {
    const n = parseInt(draft, 10);
    const v = isNaN(n) || n < min ? min : n;
    setDraft(String(v));
    if (v !== value) onCommit(v);
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      style={{ width, textAlign: "center", fontFamily: F_NUM, fontSize, fontWeight: 700, color: color || t.ink, background: "transparent", border: "none", outline: "none", padding: 0, ...style }}
    />
  );
};

// ─── Нижня навігація ─────────────────────────────────────────────────────────
// Мапа екранів застосунку → вкладки редизайну (підпис локалізується через i18n-ключ).
const TABS = [
  { id: "dashboard", icon: "home" },
  { id: "catalog", icon: "grid" },
  { id: "customers", icon: "users" },
  { id: "ordersList", icon: "doc" },
];

export const BottomNav = ({ active, onNav, t }) => {
  const { t: tr } = useTranslation();
  return (
  <div style={{ height: "calc(58px + env(safe-area-inset-bottom))", background: t.surface, borderTop: `1px solid ${t.line}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom)", flexShrink: 0 }}>
    {TABS.map(tab => {
      const on = active === tab.id;
      return (
        <button key={tab.id} onClick={() => onNav(tab.id)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <MIcon name={tab.icon} size={22} w={on ? 1.9 : 1.5} color={on ? t.accent : t.inkMuted} />
          <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? t.accent : t.inkMuted }}>{tr(`nav.${tab.id}`)}</span>
        </button>
      );
    })}
  </div>
  );
};

export { F_NUM };
