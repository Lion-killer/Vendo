import React from 'react';
import { F_NUM } from '../theme';

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
};

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

// ─── Фото товару з fallback на плейсхолдер + lightbox на повний екран (#30) ─────
export const ProductImage = ({ t, img, sku, size = 56, radius = 10 }) => {
  const [err, setErr] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const show = img && !err;
  return (
    <>
      <div onClick={show ? (e) => { e.stopPropagation(); setOpen(true); } : undefined} style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: "hidden",
        border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center",
        background: show ? "#fff" : `repeating-linear-gradient(135deg, ${t.surfaceMuted} 0 6px, ${t.bg} 6px 12px)`,
        cursor: show ? "zoom-in" : "default",
      }}>
        {show
          ? <img src={img} alt={sku || ""} loading="lazy" onError={() => setErr(true)}
              style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <span style={{ fontFamily: F_NUM, fontSize: size > 44 ? 9 : 8, color: t.inkMuted }}>{sku}</span>}
      </div>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}>
          <ZoomImage src={img} alt={sku} />
          <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} aria-label="Закрити"
            style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", right: 16, width: 40, height: 40, borderRadius: 20, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <MIcon name="x" size={22} color="#fff" />
          </button>
          {sku && <div style={{ position: "fixed", bottom: "max(24px, env(safe-area-inset-bottom))", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.7)", fontFamily: F_NUM, fontSize: 12 }}>{sku}</div>}
        </div>
      )}
    </>
  );
};

// ─── Індикатор онлайн/офлайн у стилі іконок-кнопок (bell/sync) ─────────────────
// floating=true — фіксований у правому верхньому куті (для екранів без шапки з іконками).
export const OnlineIndicator = ({ t, online, connecting, floating }) => {
  // Стан передає сама іконка: connecting (wifi, жовте миготіння-«серцебиття») → online (wifi) → offline (wifiOff).
  const icon = online || connecting ? "wifi" : "wifiOff";
  const iconColor = connecting ? t.warn : online ? t.ok : t.err;
  const label = connecting ? "Підключення…" : online ? "Онлайн" : "Офлайн";
  return (
    <div aria-label={label} style={{
      position: floating ? "fixed" : "relative",
      ...(floating ? { top: "max(8px, env(safe-area-inset-top))", right: 12, zIndex: 1500, pointerEvents: "none" } : {}),
      width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <div style={{ display: "flex", animation: connecting ? "pulse 1.8s ease-in-out infinite" : "none" }}>
        <MIcon name={icon} size={18} color={iconColor} />
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

// ─── Пілл стану (VIP / борг / новий…) ─────────────────────────────────────────
export const Pill = ({ children, bg, fg }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: "2px 7px", borderRadius: 6, letterSpacing: 0.2, whiteSpace: "nowrap" }}>{children}</span>
);

// ─── Нижня навігація ─────────────────────────────────────────────────────────
// Мапа екранів застосунку → вкладки редизайну.
const TABS = [
  { id: "dashboard", label: "Головна", icon: "home" },
  { id: "catalog", label: "Каталог", icon: "grid" },
  { id: "customers", label: "Клієнти", icon: "users" },
  { id: "ordersList", label: "Замовлення", icon: "doc" },
];

export const BottomNav = ({ active, onNav, t }) => (
  <div style={{ height: 84, background: t.surface, borderTop: `1px solid ${t.line}`, display: "flex", paddingBottom: 22, flexShrink: 0 }}>
    {TABS.map(tab => {
      const on = active === tab.id;
      return (
        <button key={tab.id} onClick={() => onNav(tab.id)}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <MIcon name={tab.icon} size={22} w={on ? 1.9 : 1.5} color={on ? t.accent : t.inkMuted} />
          <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, color: on ? t.accent : t.inkMuted }}>{tab.label}</span>
        </button>
      );
    })}
  </div>
);

export { F_NUM };
