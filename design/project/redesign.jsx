// === TradeRep — поточні екрани (baseline, спрощено) ============================
const T_OLD = {
  bg: "#F4F6FB", surface: "#FFFFFF", surfaceVariant: "#E8EDF7",
  primary: "#1A4B8C", primaryDark: "#0D3166", primaryLight: "#2E6BC4",
  secondary: "#00897B", tertiary: "#FF8F00",
  text: "#0D1B2E", textSecondary: "#5A6A80", textMuted: "#8FA0B8",
  border: "#D0DAF0", error: "#C0392B", success: "#1B8B5E", warning: "#D4860A",
  cardShadow: "0 2px 12px rgba(26,75,140,0.10)",
  chip: "#E3EAF8", chipText: "#1A4B8C", statusBar: "#0D3166",
};

// === TradeRep — пропонований редизайн ==========================================
// Нова мова: спокійний нейтральний фон, один акцентний колір (індиго),
// крупніша типографіка для роботи в полі, чіткі hit-targets ≥48px,
// семантичні статуси, менше градієнтів, більше "повітря".
const LIGHT = {
  bg: "#F7F7F5",
  surface: "#FFFFFF",
  surfaceMuted: "#EFEEE9",
  ink: "#15161B",
  inkSoft: "#5A5C66",
  inkMuted: "#9A9CA6",
  line: "#E5E4DE",
  lineSoft: "#EFEEE9",
  accent: "#3A4FE0",      // основний акцент
  accentSoft: "#EAEDFC",
  accentInk: "#1F2BA3",
  ok: "#1F8F58",
  okSoft: "#E2F1E8",
  warn: "#B5610A",
  warnSoft: "#FBEED8",
  err: "#C0392B",
  errSoft: "#FBE5E0",
  vip: "#8B5A00",
  vipSoft: "#F6E9D3",
  invBg: "#15161B",       // інверсний контейнер (hero / плаваючі смуги)
  btnBg: "#15161B",       // основні залиті кнопки
  statusInk: "#000000",   // іконки статус-бару
};

const DARK = {
  bg: "#121317",
  surface: "#1C1D24",
  surfaceMuted: "#262732",
  ink: "#F3F3F1",
  inkSoft: "#A6A8B2",
  inkMuted: "#73757F",
  line: "#2D2E38",
  lineSoft: "#24252D",
  accent: "#7B88FF",
  accentSoft: "#23264A",
  accentInk: "#AEB6FF",
  ok: "#3DC982",
  okSoft: "#16301F",
  warn: "#E59A38",
  warnSoft: "#33270F",
  err: "#EE6B57",
  errSoft: "#341A16",
  vip: "#E0AC4A",
  vipSoft: "#322811",
  invBg: "#262834",
  btnBg: "#7B88FF",
  statusInk: "#F3F3F1",
};

const ThemeCtx = React.createContext(LIGHT);

// Темна тема · варіант 2 — вищий контраст: помітно світліші картки,
// яскравіші бордери й більший розрив між фоном і поверхнею, щоб елементи не зливались.
const DARK2 = {
  bg: "#0E0F14",
  surface: "#1F212B",
  surfaceMuted: "#2C2E3A",
  ink: "#F5F5F3",
  inkSoft: "#B2B4BF",
  inkMuted: "#80828D",
  line: "#3A3C4A",
  lineSoft: "#2C2E3A",
  accent: "#8893FF",
  accentSoft: "#2A2E58",
  accentInk: "#BAC1FF",
  ok: "#46D08A",
  okSoft: "#173620",
  warn: "#ECA34A",
  warnSoft: "#392A12",
  err: "#F0715D",
  errSoft: "#3B1D18",
  vip: "#E6B454",
  vipSoft: "#382C12",
  invBg: "#2E3143",
  btnBg: "#8893FF",
  statusInk: "#F5F5F3",
};

const useT = () => React.useContext(ThemeCtx);
// Світла тема за замовчуванням; всередині кожного екрана `const T_NEW = useT()`
// перекриває цю константу значенням із контексту (для темної теми).
const T_NEW = LIGHT;

const F_NEW = `'Inter', -apple-system, system-ui, sans-serif`;
const F_NUM = `'IBM Plex Mono', ui-monospace, monospace`;

// ─── shared mini icons (тонкі stroke, geometric)
const MIcon = ({ d, size = 20, color = "currentColor", w = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const ICON = {
  home: <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4a3.5 3.5 0 0 1 0 7"/><path d="M22 20a6 6 0 0 0-4-5.65"/></>,
  doc: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  minus: <><path d="M5 12h14"/></>,
  chevron: <><path d="M9 6l6 6-6 6"/></>,
  back: <><path d="M15 6l-6 6 6 6"/></>,
  cart: <><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2.5l2 12h12l2-9H6"/></>,
  send: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>,
  sync: <><path d="M21 12a9 9 0 0 1-15.5 6.3M3 12a9 9 0 0 1 15.5-6.3"/><path d="M21 4v5h-5M3 20v-5h5"/></>,
  wifi: <><path d="M5 12.5a11 11 0 0 1 14 0"/><path d="M2 9a16 16 0 0 1 20 0"/><path d="M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="0.7" fill="currentColor"/></>,
  wifiOff: <><path d="M1 1l22 22"/><path d="M16.7 11.1A11 11 0 0 1 19 12.5"/><path d="M5 12.5a11 11 0 0 1 5.2-2.4"/><path d="M10.7 5.1A16 16 0 0 1 22.5 9"/><path d="M2 9a16 16 0 0 1 4.7-2.9"/><path d="M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="20" r="0.7" fill="currentColor"/></>,
  bell: <><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  check: <><path d="M5 12l5 5L20 7"/></>,
  filter: <><path d="M4 5h16M7 12h10M10 19h4"/></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="2.5"/></>,
  building: <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 21V14h6v7"/><path d="M9 7h.01M13 7h.01M9 11h.01M13 11h.01"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>,
  trend: <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  route: <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H9a4 4 0 0 0-4 4v0"/></>,
  qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M21 14v7h-7v-3M14 17h3"/></>,
  barcode: <><path d="M3 5v14M6 5v14M9 5v14M13 5v14M17 5v14M21 5v14"/></>,
  star: <><polygon points="12 3 14.5 9 21 9.5 16 14 17.5 21 12 17.5 6.5 21 8 14 3 9.5 9.5 9"/></>,
  more: <><circle cx="12" cy="6" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18" r="1.4" fill="currentColor"/></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
  x: <><path d="M6 6l12 12M18 6L6 18"/></>,
  home2: <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
};

// ─── Phone shell: simple 393×852 frame ──────────────────────────────────────────
const Phone = ({ children, bg = "#fff", label }) => {
  const T_NEW = useT();
  return (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
    {label && <div style={{ fontFamily: F_NUM, fontSize: 11, color: "#777", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>}
    <div style={{
      width: 393, height: 852, background: bg, borderRadius: 48, overflow: "hidden", position: "relative",
      boxShadow: "0 0 0 11px #1B1C22, 0 0 0 12px #2A2B33, 0 30px 60px rgba(0,0,0,0.18)",
      fontFamily: F_NEW, color: T_NEW.ink,
    }}>
      {/* Dynamic island */}
      <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 120, height: 34, background: "#000", borderRadius: 20, zIndex: 50 }} />
      {/* Status bar */}
      <div style={{ height: 54, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 28px 6px", fontSize: 14, fontWeight: 600 }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <MIcon d={ICON.wifi} size={14} color={T_NEW.statusInk} />
          <svg width="22" height="11" viewBox="0 0 22 11" fill={T_NEW.statusInk}><rect x="0" y="0" width="18" height="11" rx="3" fill="none" stroke={T_NEW.statusInk} strokeWidth="1"/><rect x="2" y="2" width="13" height="7" rx="1.5"/></svg>
        </span>
      </div>
      {children}
    </div>
  </div>
  );
};

// =====================================================================
// CURRENT (baseline) — спрощений рендер існуючих екранів
// =====================================================================
const OldDashboard = () => {
  const cards = [
    { label: "Номенклатура", sub: "1 248 позицій", color: T_OLD.primary, bg: T_OLD.chip },
    { label: "Контрагенти", sub: "34 клієнти", color: T_OLD.secondary, bg: T_OLD.secondary + "18" },
    { label: "Замовлення", sub: "7 активних", color: T_OLD.tertiary, bg: T_OLD.tertiary + "18" },
    { label: "Синхронізація", sub: "12 год тому", color: "#9C27B0", bg: "#9C27B018" },
  ];
  return (
    <Phone bg={T_OLD.bg} label="Поточний — Dashboard">
      <div style={{ background: `linear-gradient(135deg, ${T_OLD.primaryDark}, ${T_OLD.primary})`, padding: "16px 20px 24px", color: "#fff", fontFamily: "Nunito, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: "rgba(255,255,255,0.2)" }}/>
            <div>
              <div style={{ fontSize: 10, opacity: 0.65, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Торговий представник</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Дмитро К.</div>
            </div>
          </div>
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 11 }}/>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["Маршрут","Київ-Північ"],["Дата","04.03"],["Відвідано","5/12"]].map(([l,v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 10, opacity: 0.55, fontWeight: 600 }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "16px 14px", fontFamily: "Nunito, sans-serif" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T_OLD.textSecondary, letterSpacing: 0.8, textTransform: "uppercase", margin: "4px 4px 10px" }}>Швидкий доступ</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background: T_OLD.surface, borderRadius: 18, padding: "16px 14px", border: `1px solid ${T_OLD.border}`, boxShadow: T_OLD.cardShadow }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: c.bg, marginBottom: 10 }}/>
              <div style={{ fontSize: 13, fontWeight: 800, color: T_OLD.text }}>{c.label}</div>
              <div style={{ fontSize: 11, color: T_OLD.textMuted, fontWeight: 600 }}>{c.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T_OLD.textSecondary, letterSpacing: 0.8, textTransform: "uppercase", margin: "20px 4px 10px" }}>Останні замовлення</div>
        {[
          ["ЗМ-2024","ТОВ Фуршет Плюс","4 280 ₴","Відправлено", T_OLD.success],
          ["ЗМ-2023","ФОП Петренко","1 950 ₴","Чернетка", T_OLD.textMuted],
          ["ЗМ-2022","АТБ-Маркет","8 640 ₴","Підтверджено", T_OLD.primary],
        ].map(([n,c,t,s,col]) => (
          <div key={n} style={{ background: T_OLD.surface, borderRadius: 14, padding: "12px 14px", border: `1px solid ${T_OLD.border}`, marginBottom: 7, display: "flex", justifyContent: "space-between", boxShadow: T_OLD.cardShadow }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: T_OLD.surfaceVariant }}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 11, color: T_OLD.textMuted }}>{c}</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: col }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", bottom: 90, left: 16, right: 16 }}>
        <div style={{ height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${T_OLD.primary}, ${T_OLD.secondary})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>+ Нове замовлення</div>
      </div>
      {/* Bottom nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 78, background: "#fff", borderTop: `1px solid ${T_OLD.border}`, display: "flex", paddingBottom: 18 }}>
        {["Головна","Товари","Клієнти","Замовлення"].map((l,i) => (
          <div key={l} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "Nunito, sans-serif" }}>
            <div style={{ width: 44, height: 28, borderRadius: 14, background: i === 0 ? T_OLD.chip : "transparent" }}/>
            <div style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? T_OLD.primary : T_OLD.textMuted }}>{l}</div>
          </div>
        ))}
      </div>
    </Phone>
  );
};

const OldCatalog = () => (
  <Phone bg={T_OLD.bg} label="Поточний — Catalog">
    <div style={{ background: T_OLD.surface, padding: "12px 14px 0", borderBottom: `1px solid ${T_OLD.border}`, fontFamily: "Nunito, sans-serif" }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, color: T_OLD.text }}>Номенклатура</div>
      <div style={{ background: T_OLD.surfaceVariant, borderRadius: 13, padding: "9px 14px", height: 38, display: "flex", alignItems: "center", color: T_OLD.textMuted, fontSize: 13, marginBottom: 10 }}>
        🔍 Пошук товару...
      </div>
      <div style={{ display: "flex", gap: 6, paddingBottom: 10, overflow: "hidden" }}>
        {["Всі","Молочні","Хлібобулочні","Напої"].map((f,i) => (
          <span key={f} style={{ background: i === 0 ? T_OLD.primary : T_OLD.chip, color: i === 0 ? "#fff" : T_OLD.chipText, padding: "5px 13px", borderRadius: 18, fontSize: 12, fontWeight: 700 }}>{f}</span>
        ))}
      </div>
    </div>
    <div style={{ padding: "8px 0", fontFamily: "Nunito, sans-serif" }}>
      {[
        { icon: "🥛", n: "Молочні продукти", c: 24, expand: true },
        { icon: "🍞", n: "Хлібобулочні", c: 18 },
        { icon: "🥤", n: "Напої", c: 31 },
      ].map(cat => (
        <div key={cat.n}>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 18px", gap: 12 }}>
            <div style={{ fontSize: 22 }}>{cat.icon}</div>
            <div style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{cat.n}</div>
            <div style={{ background: T_OLD.chip, color: T_OLD.chipText, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{cat.c}</div>
            <div style={{ fontSize: 14, color: T_OLD.textMuted }}>{cat.expand ? "▼" : "▶"}</div>
          </div>
          {cat.expand && [
            { name: "Молоко ультрапастеризоване 2.5%", sku: "ML-001", price: "42.50 ₴", stock: 284, img: "🥛" },
            { name: "Масло вершкове 82%", sku: "MB-002", price: "98.00 ₴", stock: 56, img: "🧈" },
            { name: "Сир твердий Едам 45%", sku: "CH-003", price: "189.00 ₴", stock: 12, img: "🧀" },
          ].map(p => (
            <div key={p.sku} style={{ background: T_OLD.surface, borderRadius: 14, padding: "10px 12px", margin: "0 12px 7px", border: `1px solid ${T_OLD.border}`, display: "flex", gap: 10, alignItems: "center", boxShadow: T_OLD.cardShadow }}>
              <div style={{ width: 48, height: 48, background: T_OLD.surfaceVariant, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{p.img}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 10.5, color: T_OLD.textMuted, marginTop: 1 }}>Арт: {p.sku}</div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 4 }}>
                  <span style={{ color: T_OLD.primary, fontSize: 13, fontWeight: 800 }}>{p.price}</span>
                  <span style={{ background: (p.stock < 20 ? T_OLD.warning : T_OLD.success) + "22", color: p.stock < 20 ? T_OLD.warning : T_OLD.success, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 18 }}>
                    {p.stock < 20 ? `${p.stock} (мало)` : p.stock}
                  </span>
                </div>
              </div>
              <div style={{ color: T_OLD.textMuted }}>›</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </Phone>
);

const OldOrder = () => (
  <Phone bg={T_OLD.bg} label="Поточний — Замовлення">
    <div style={{ background: T_OLD.surface, padding: "12px 14px", borderBottom: `1px solid ${T_OLD.border}`, fontFamily: "Nunito, sans-serif" }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>Нове замовлення</div>
      <div style={{ background: T_OLD.surfaceVariant, borderRadius: 13, padding: "10px 12px", border: `1.5px solid ${T_OLD.border}`, display: "flex", gap: 9, alignItems: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: T_OLD.chip }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: T_OLD.textMuted, textTransform: "uppercase" }}>Контрагент</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>ТОВ "Фуршет Плюс"</div>
        </div>
        <div style={{ color: T_OLD.textMuted }}>▼</div>
      </div>
    </div>
    <div style={{ padding: "10px 12px", fontFamily: "Nunito, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", margin: "0 4px 8px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T_OLD.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 }}>Товари</span>
        <span style={{ background: T_OLD.chip, color: T_OLD.chipText, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>3 поз.</span>
      </div>
      {[
        { n: "Молоко ультрапастеризоване 2.5%", sku: "ML-001", img: "🥛", qty: 10, p: "425.00 ₴" },
        { n: "Масло вершкове 82%", sku: "MB-002", img: "🧈", qty: 4, p: "392.00 ₴" },
        { n: "Вода мінеральна 1.5л", sku: "WA-001", img: "💧", qty: 24, p: "432.00 ₴" },
      ].map(it => (
        <div key={it.sku} style={{ background: T_OLD.surface, borderRadius: 14, padding: "10px 13px", marginBottom: 7, border: `1px solid ${T_OLD.border}`, boxShadow: T_OLD.cardShadow }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <div style={{ fontSize: 26 }}>{it.img}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{it.n}</div>
              <div style={{ fontSize: 10.5, color: T_OLD.textMuted, marginTop: 2 }}>{it.sku}</div>
            </div>
            <div style={{ color: T_OLD.error, fontSize: 14 }}>🗑</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", background: T_OLD.surfaceVariant, borderRadius: 11, overflow: "hidden" }}>
              <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: T_OLD.primary, fontSize: 16, fontWeight: 800 }}>−</div>
              <div style={{ width: 28, textAlign: "center", fontSize: 14, fontWeight: 800 }}>{it.qty}</div>
              <div style={{ width: 32, height: 32, background: T_OLD.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800 }}>+</div>
            </div>
            <span style={{ color: T_OLD.primary, fontSize: 14, fontWeight: 800 }}>{it.p}</span>
          </div>
        </div>
      ))}
    </div>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px 22px", background: T_OLD.surface, borderTop: `1px solid ${T_OLD.border}`, fontFamily: "Nunito, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T_OLD.textSecondary }}>Сума замовлення:</span>
        <span style={{ color: T_OLD.primary, fontSize: 21, fontWeight: 900 }}>1 249.00 ₴</span>
      </div>
      <div style={{ height: 50, borderRadius: 14, background: `linear-gradient(135deg, ${T_OLD.primary}, ${T_OLD.secondary})`, color: "#fff", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        ✈ Відправити замовлення
      </div>
    </div>
  </Phone>
);

// =====================================================================
// REDESIGN — нова мова
// =====================================================================
const Card = ({ children, style = {} }) => {
  const T_NEW = useT();
  return <div style={{ background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, borderRadius: 16, ...style }}>{children}</div>;
};

const NewBottomNav = ({ active = "home" }) => {
  const T_NEW = useT();
  const tabs = [
    { id: "home", label: "Головна", icon: ICON.home },
    { id: "grid", label: "Каталог", icon: ICON.grid },
    { id: "users", label: "Клієнти", icon: ICON.users },
    { id: "doc", label: "Замовлення", icon: ICON.doc },
  ];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 84, background: T_NEW.surface, borderTop: `1px solid ${T_NEW.line}`, display: "flex", paddingBottom: 22 }}>
      {tabs.map(t => (
        <div key={t.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <div style={{ color: active === t.id ? T_NEW.accent : T_NEW.inkMuted }}>
            <MIcon d={t.icon} size={22} w={active === t.id ? 1.9 : 1.5} />
          </div>
          <div style={{ fontSize: 10.5, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? T_NEW.accent : T_NEW.inkMuted }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
};

// === NEW DASHBOARD ===
const NewDashboard = () => {
  const T_NEW = useT();
  const orders = [
    { num: "ЗМ-2024", client: "ТОВ Фуршет Плюс", total: "4 280", status: "Відправлено", color: T_NEW.ok },
    { num: "Ч-0023", client: "ФОП Петренко В.М.", total: "1 950", status: "Чернетка", color: T_NEW.inkSoft, draft: true },
    { num: "ЗМ-2022", client: "АТБ-Маркет, Дніпро", total: "8 640", status: "Підтверджено", color: T_NEW.accent },
  ];
  return (
    <Phone bg={T_NEW.bg} label="Редизайн — Головна">
      {/* Top bar */}
      <div style={{ padding: "8px 22px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: T_NEW.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>ДК</div>
          <div>
            <div style={{ fontSize: 11, color: T_NEW.inkMuted, fontWeight: 500 }}>Понеділок, 28 квітня</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Дмитро Кравчук</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <MIcon d={ICON.bell} size={18} color={T_NEW.ink} />
            <div style={{ position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 4, background: T_NEW.err }}/>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon d={ICON.sync} size={18} color={T_NEW.ink} />
          </div>
        </div>
      </div>

      {/* Today summary hero */}
      <div style={{ margin: "12px 16px 0", borderRadius: 20, background: T_NEW.invBg, color: "#fff", padding: "18px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>Виторг сьогодні</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, fontFamily: F_NUM, letterSpacing: -0.5 }}>23 480 ₴</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>+18% до минулого тижня</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 10px", fontSize: 11, fontWeight: 600 }}>
            <span style={{ color: "#7DDB9F" }}>●</span> Онлайн
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 11, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14 }}>
          <div>
            <div style={{ opacity: 0.55 }}>Замовлень</div>
            <div style={{ fontFamily: F_NUM, fontWeight: 600, fontSize: 16, marginTop: 1 }}>5</div>
          </div>
          <div>
            <div style={{ opacity: 0.55 }}>Середній чек</div>
            <div style={{ fontFamily: F_NUM, fontWeight: 600, fontSize: 16, marginTop: 1 }}>4 696 ₴</div>
          </div>
          <div>
            <div style={{ opacity: 0.55 }}>Клієнтів</div>
            <div style={{ fontFamily: F_NUM, fontWeight: 600, fontSize: 16, marginTop: 1 }}>5</div>
          </div>
        </div>
      </div>

      {/* Primary action */}
      <div style={{ margin: "14px 16px 0" }}>
        <button style={{ width: "100%", height: 54, border: "none", background: T_NEW.accent, borderRadius: 14, fontFamily: F_NEW, fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <MIcon d={ICON.plus} size={18} color="#fff" w={2} /> Нове замовлення
        </button>
      </div>

      {/* Quick stats */}
      <div style={{ margin: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {[
          { l: "Каталог", v: "1 248", s: "позицій", icon: ICON.grid },
          { l: "Клієнти", v: "34", s: "активні", icon: ICON.users },
          { l: "Чернетки", v: "2", s: "не відпр.", icon: ICON.doc, warn: true },
        ].map(s => (
          <Card key={s.l} style={{ padding: "12px 12px" }}>
            <div style={{ color: s.warn ? T_NEW.warn : T_NEW.inkMuted, marginBottom: 6 }}>
              <MIcon d={s.icon} size={16} color={s.warn ? T_NEW.warn : T_NEW.inkMuted} />
            </div>
            <div style={{ fontSize: 19, fontFamily: F_NUM, fontWeight: 600, color: s.warn ? T_NEW.warn : T_NEW.ink }}>{s.v}</div>
            <div style={{ fontSize: 10.5, color: T_NEW.inkMuted, fontWeight: 500, marginTop: 1 }}>{s.l} · {s.s}</div>
          </Card>
        ))}
      </div>

      {/* Recent orders */}
      <div style={{ margin: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 4px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Останні замовлення</div>
          <div style={{ fontSize: 12, color: T_NEW.accent, fontWeight: 600 }}>Усі →</div>
        </div>
        <Card>
          {orders.map((o, i) => (
            <div key={o.num} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: i < orders.length - 1 ? `1px solid ${T_NEW.lineSoft}` : "none" }}>
              <div style={{ width: 4, alignSelf: "stretch", background: o.color, borderRadius: 2, marginRight: 12 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: F_NUM, fontSize: 12, fontWeight: 600 }}>{o.num}</span>
                  {o.draft && <span style={{ fontSize: 9.5, fontWeight: 700, color: T_NEW.inkSoft, background: T_NEW.surfaceMuted, padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>ЧЕРНЕТКА</span>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{o.client}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 600 }}>{o.total} ₴</div>
                <div style={{ fontSize: 10.5, color: o.color, fontWeight: 600, marginTop: 1 }}>{o.status}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div style={{ height: 100 }}/>
      <NewBottomNav active="home" />
    </Phone>
  );
};

// === NEW CATALOG — довільна вкладеність груп (drill-down + breadcrumbs + пошук) ===
// Дерево номенклатури будь-якої глибини. Вузол може містити підгрупи (children)
// та/або товари (products) одночасно.
const CATALOG_TREE = {
  name: "Каталог",
  children: [
    {
      name: "Молочні продукти",
      // мішаний рівень: є і підгрупи, і власні «популярні» товари
      products: [
        { name: "Молоко ультрапастеризоване 2.5%", sku: "ML-001", price: "42.50", stock: 284, unit: "л", inOrder: 10 },
        { name: "Вершки 10% 500мл", sku: "ML-031", price: "63.00", stock: 92, unit: "пл" },
      ],
      children: [
        {
          name: "Сири",
          children: [
            { name: "Тверді сири", products: [
              { name: "Сир твердий Едам 45%", sku: "CH-003", price: "189.00", stock: 12, unit: "кг", low: true },
              { name: "Сир Гауда 48%", sku: "CH-008", price: "212.00", stock: 34, unit: "кг" },
              { name: "Сир Пармезан витриманий", sku: "CH-021", price: "498.00", stock: 6, unit: "кг", low: true },
            ]},
            { name: "М'які та розсольні", products: [
              { name: "Сир Моцарела 45%", sku: "CH-014", price: "164.00", stock: 48, unit: "кг" },
              { name: "Сир Фета 50%", sku: "CH-017", price: "178.00", stock: 0, unit: "кг", out: true },
            ]},
            { name: "Плавлені", products: [
              { name: "Сир плавлений Вершковий", sku: "CH-030", price: "44.00", stock: 120, unit: "шт" },
            ]},
          ],
        },
        {
          name: "Масло та спреди",
          products: [
            { name: "Масло вершкове 82%", sku: "MB-002", price: "98.00", stock: 56, unit: "пач", inOrder: 4 },
            { name: "Масло селянське 73%", sku: "MB-005", price: "72.00", stock: 88, unit: "пач" },
          ],
        },
        {
          name: "Йогурти та десерти",
          products: [
            { name: "Йогурт натуральний 1кг", sku: "ML-022", price: "67.50", stock: 132, unit: "шт" },
            { name: "Сметана 20% 400г", sku: "ML-014", price: "58.00", stock: 0, unit: "пач", out: true },
          ],
        },
      ],
    },
    {
      name: "Бакалія",
      children: [
        { name: "Крупи", children: [
          { name: "Рис", products: [{ name: "Рис довгозернистий 1кг", sku: "GR-001", price: "54.00", stock: 210, unit: "пач" }] },
          { name: "Гречка", products: [{ name: "Гречка ядриця 800г", sku: "GR-006", price: "61.00", stock: 175, unit: "пач" }] },
        ]},
        { name: "Олія та соуси", products: [
          { name: "Олія соняшникова 1л", sku: "OL-001", price: "76.00", stock: 240, unit: "пл" },
        ]},
      ],
    },
    {
      name: "Напої",
      children: [
        { name: "Вода", children: [
          { name: "Газована", products: [{ name: "Вода мінеральна газ. 1.5л", sku: "WA-001", price: "18.00", stock: 512, unit: "пл" }] },
          { name: "Негазована", products: [{ name: "Вода негаз. 1.5л", sku: "WA-004", price: "17.00", stock: 480, unit: "пл" }] },
        ]},
        { name: "Соки", products: [
          { name: "Сік яблучний 1л", sku: "JU-001", price: "52.00", stock: 88, unit: "пл" },
        ]},
      ],
    },
  ],
};

// recursive helpers
const countProducts = (node) => {
  let n = node.products ? node.products.length : 0;
  if (node.children) node.children.forEach(c => { n += countProducts(c); });
  return n;
};
const getNode = (path) => {
  let node = CATALOG_TREE;
  for (const idx of path) node = node.children[idx];
  return node;
};
const flattenProducts = (node, trail = []) => {
  let out = [];
  if (node.products) node.products.forEach(p => out.push({ ...p, trail }));
  if (node.children) node.children.forEach(c => { out = out.concat(flattenProducts(c, [...trail, c.name])); });
  return out;
};

const ProductRow = ({ p }) => {
  const T_NEW = useT();
  const qty = p.inOrder || 0;
  const stockColor = p.out ? T_NEW.err : p.stock < 5 ? T_NEW.warn : T_NEW.ok;
  const stockLabel = p.out ? "немає" : `${p.stock}`;
  return (
    <Card style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {/* Картинка */}
        <div style={{
          width: 56, height: 56, borderRadius: 10, flexShrink: 0,
          background: `repeating-linear-gradient(135deg, ${T_NEW.surfaceMuted} 0 6px, ${T_NEW.bg} 6px 12px)`,
          border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: F_NUM, fontSize: 9, color: T_NEW.inkMuted,
        }}>{p.sku}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Найменування */}
          <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
          {p.trail && p.trail.length > 0 && (
            <div style={{ fontSize: 10.5, color: T_NEW.inkMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {p.trail.join(" › ")}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            {/* Ціна */}
            <span style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{p.price}</span>
            <span style={{ fontSize: 11, color: T_NEW.inkMuted }}>₴ / {p.unit}</span>
            {/* Залишок */}
            <span style={{ fontFamily: F_NUM, fontSize: 11, color: stockColor, fontWeight: 600, marginLeft: "auto" }}>{stockLabel}</span>
          </div>
        </div>

        {/* Кількість — завжди степпер, 0 якщо не в замовленні */}
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${qty > 0 ? T_NEW.ink : T_NEW.line}`, borderRadius: 10, height: 36, flexShrink: 0, opacity: p.out ? 0.4 : 1 }}>
          <div style={{ width: 32, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: qty > 0 ? T_NEW.ink : T_NEW.inkMuted }}>
            <MIcon d={ICON.minus} size={15} color={qty > 0 ? T_NEW.ink : T_NEW.inkMuted} w={2} />
          </div>
          <div style={{ width: 28, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: qty > 0 ? T_NEW.ink : T_NEW.inkMuted }}>{qty}</div>
          <div style={{ width: 32, height: 36, background: T_NEW.btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0" }}>
            <MIcon d={ICON.plus} size={15} color="#fff" w={2} />
          </div>
        </div>
      </div>
    </Card>
  );
};

const GroupRow = ({ node, onOpen }) => {
  const T_NEW = useT();
  const subCount = node.children ? node.children.length : 0;
  const prodCount = countProducts(node);
  return (
    <Card style={{ padding: 12, marginBottom: 8, cursor: "pointer" }}>
      <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: T_NEW.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MIcon d={ICON.folder} size={22} color={T_NEW.accentInk} w={1.7} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{node.name}</div>
          <div style={{ fontSize: 11.5, color: T_NEW.inkMuted, marginTop: 2 }}>
            {subCount > 0 && <span>{subCount} підгруп · </span>}
            <span style={{ fontFamily: F_NUM }}>{prodCount}</span> товарів
          </div>
        </div>
        <MIcon d={ICON.chevron} size={18} color={T_NEW.inkMuted} />
      </div>
    </Card>
  );
};

const NewCatalog = () => {
  const T_NEW = useT();
  // стартуємо на 1 рівень углиб, щоб одразу показати breadcrumbs + мішаний рівень
  const [path, setPath] = React.useState([0]);
  const [query, setQuery] = React.useState("");

  const node = getNode(path);
  const subgroups = node.children || [];
  const products = node.products || [];

  // breadcrumb names
  const crumbs = [{ name: "Каталог", path: [] }];
  let acc = CATALOG_TREE;
  path.forEach((idx, i) => {
    acc = acc.children[idx];
    crumbs.push({ name: acc.name, path: path.slice(0, i + 1) });
  });

  const searching = query.trim().length > 0;
  const results = searching
    ? flattenProducts(CATALOG_TREE).filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <Phone bg={T_NEW.bg} label="Редизайн — Каталог (вкладеність)">
      {/* Sticky header */}
      <div style={{ padding: "8px 16px 12px", background: T_NEW.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Каталог</div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon d={ICON.barcode} size={18} color={T_NEW.ink} />
            </div>
            <div style={{ padding: "0 12px", height: 38, borderRadius: 12, background: T_NEW.accent, color: "#fff", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13 }}>
              <MIcon d={ICON.cart} size={16} color="#fff" /> 3
            </div>
          </div>
        </div>

        {/* Search — наскрізний по всьому дереву */}
        <div style={{ background: T_NEW.surface, border: `1px solid ${searching ? T_NEW.accent : T_NEW.line}`, borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, height: 44 }}>
          <MIcon d={ICON.search} size={18} color={searching ? T_NEW.accent : T_NEW.inkMuted} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук по всьому каталогу…"
            style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: F_NEW, fontSize: 14, color: T_NEW.ink }}
          />
          {searching && (
            <div onClick={() => setQuery("")} style={{ cursor: "pointer", display: "flex" }}>
              <MIcon d={ICON.x} size={17} color={T_NEW.inkMuted} />
            </div>
          )}
        </div>

        {/* Order context bar */}
        <div style={{ marginTop: 10, background: T_NEW.accentSoft, border: `1px solid ${T_NEW.accent}22`, borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <MIcon d={ICON.cart} size={16} color={T_NEW.accentInk} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T_NEW.accentInk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Замовлення №132 від 01.02.2026 (Чернетка)</div>
            <div style={{ fontSize: 11.5, color: T_NEW.accentInk, fontWeight: 600, opacity: 0.85, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>ТОВ «Фуршет»</div>
          </div>
        </div>

        {/* Breadcrumbs — навігація по рівнях вкладеності */}
        {!searching && (
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 12, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  {i > 0 && <div style={{ color: T_NEW.inkMuted, padding: "0 2px", display: "flex" }}><MIcon d={ICON.chevron} size={13} color={T_NEW.inkMuted} /></div>}
                  <div
                    onClick={() => !isLast && setPath(c.path)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, cursor: isLast ? "default" : "pointer",
                      padding: "4px 8px", borderRadius: 8,
                      background: isLast ? T_NEW.btnBg : "transparent",
                      color: isLast ? "#fff" : T_NEW.accent,
                      fontSize: 12.5, fontWeight: isLast ? 700 : 600,
                    }}
                  >
                    {i === 0 && <MIcon d={ICON.home2} size={13} color={isLast ? "#fff" : T_NEW.accent} />}
                    {c.name}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "0 16px" }}>
        {searching ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "4px 4px 8px" }}>
              Знайдено: {results.length}
            </div>
            {results.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: T_NEW.inkMuted }}>
                <MIcon d={ICON.search} size={36} color={T_NEW.line} />
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Нічого не знайдено</div>
              </div>
            ) : results.map(p => <ProductRow key={p.sku} p={p} />)}
          </>
        ) : (
          <>
            {/* Підгрупи */}
            {subgroups.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "2px 4px 8px" }}>
                  Підгрупи · {subgroups.length}
                </div>
                {subgroups.map((g, i) => (
                  <GroupRow key={g.name} node={g} onOpen={() => setPath([...path, i])} />
                ))}
              </>
            )}

            {/* Товари цього рівня */}
            {products.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: `${subgroups.length > 0 ? 18 : 2}px 4px 8px` }}>
                  Товари · {products.length}
                </div>
                {products.map(p => <ProductRow key={p.sku} p={p} />)}
              </>
            )}
          </>
        )}
        <div style={{ height: 170 }} />
      </div>

      {/* Floating action: go to order */}
      <div style={{ position: "absolute", bottom: 100, left: 16, right: 16 }}>
        <div style={{ background: T_NEW.invBg, color: "#fff", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <MIcon d={ICON.cart} size={18} color="#fff" />
            <div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>3 позиції</div>
              <div style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>1 249.00 ₴</div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
            До замовлення →
          </div>
        </div>
      </div>
      <NewBottomNav active="grid" />
    </Phone>
  );
};

// === NEW ORDER ===
const NewOrder = () => {
  const T_NEW = useT();
  const items = [
    { n: "Молоко ультрапастеризоване 2.5%", sku: "ML-001", qty: 10, unit: "л", price: 42.50 },
    { n: "Масло вершкове 82%", sku: "MB-002", qty: 4, unit: "пач", price: 98.00 },
    { n: "Вода мінеральна 1.5л", sku: "WA-001", qty: 24, unit: "пл", price: 18.00 },
  ];
  return (
    <Phone bg={T_NEW.bg} label="Редизайн — Замовлення">
      {/* Header with back + draft pill */}
      <div style={{ padding: "8px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MIcon d={ICON.back} size={18} color={T_NEW.ink} />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{ background: T_NEW.surfaceMuted, padding: "5px 9px", borderRadius: 8, fontSize: 10.5, fontWeight: 700, color: T_NEW.inkSoft, letterSpacing: 0.4 }}>● ЧЕРНЕТКА</div>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: T_NEW.surface, border: `1px solid ${T_NEW.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon d={ICON.more} size={18} color={T_NEW.ink} />
            </div>
          </div>
        </div>

        <div style={{ fontFamily: F_NUM, fontSize: 11, color: T_NEW.inkMuted, fontWeight: 500, letterSpacing: 0.4 }}>Ч-0023 · автозбережено 2 хв тому</div>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Замовлення</div>
      </div>

      {/* Customer card */}
      <div style={{ padding: "0 16px" }}>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: T_NEW.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MIcon d={ICON.building} size={20} color={T_NEW.ink} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>ТОВ «Фуршет Плюс»</div>
              <div style={{ fontSize: 11.5, color: T_NEW.inkSoft, marginTop: 2, display: "flex", gap: 6 }}>
                <span style={{ fontFamily: F_NUM }}>К-00142</span>
                <span style={{ color: T_NEW.line }}>·</span>
                <span>Київ</span>
                <span style={{ color: T_NEW.line }}>·</span>
                <span style={{ color: T_NEW.err, fontWeight: 600 }}>борг 12 500 ₴</span>
              </div>
            </div>
            <MIcon d={ICON.chevron} size={18} color={T_NEW.inkMuted} />
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: T_NEW.warnSoft, borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }}><MIcon d={ICON.bell} size={14} color={T_NEW.warn} /></div>
            <div style={{ fontSize: 11.5, color: T_NEW.warn, fontWeight: 500, lineHeight: 1.4 }}>
              У клієнта є борг. Тип ціни <b>Дрібнооптова</b> — застосовано до всіх позицій.
            </div>
          </div>
        </Card>
      </div>

      {/* Items list */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 4px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Позиції · 3</div>
          <div style={{ fontSize: 12, color: T_NEW.accent, fontWeight: 600 }}>+ Додати</div>
        </div>
        <Card>
          {items.map((it, i) => (
            <div key={it.sku} style={{ padding: "12px 14px", borderBottom: i < items.length - 1 ? `1px solid ${T_NEW.lineSoft}` : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `repeating-linear-gradient(135deg, ${T_NEW.surfaceMuted} 0 4px, ${T_NEW.bg} 4px 8px)`, border: `1px solid ${T_NEW.line}`, flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{it.n}</div>
                  <div style={{ fontFamily: F_NUM, fontSize: 11, color: T_NEW.inkMuted, marginTop: 2 }}>{it.sku} · {it.price.toFixed(2)} ₴/{it.unit}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700 }}>{(it.qty * it.price).toFixed(2)} ₴</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${T_NEW.line}`, borderRadius: 10, height: 34, flex: 1, maxWidth: 140 }}>
                  <div style={{ width: 36, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: T_NEW.ink }}>
                    <MIcon d={ICON.minus} size={14} color={T_NEW.ink} w={2} />
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700 }}>{it.qty}</div>
                  <div style={{ width: 36, height: 34, background: T_NEW.btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0" }}>
                    <MIcon d={ICON.plus} size={14} color="#fff" w={2} />
                  </div>
                </div>
                <div style={{ flex: 1, fontSize: 11, color: T_NEW.inkMuted }}>×{it.qty} {it.unit}</div>
                <div style={{ color: T_NEW.inkMuted, padding: 6 }}>
                  <MIcon d={ICON.trash} size={16} color={T_NEW.inkMuted} />
                </div>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Summary + send (sticky) */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T_NEW.surface, borderTop: `1px solid ${T_NEW.line}`, padding: "14px 16px 26px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>До оплати</span>
          <span style={{ fontFamily: F_NUM, fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>1 249.00 ₴</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ height: 50, padding: "0 18px", borderRadius: 12, border: `1px solid ${T_NEW.line}`, background: T_NEW.surface, fontFamily: F_NEW, fontSize: 13, fontWeight: 600, color: T_NEW.ink }}>
            Зберегти
          </button>
          <button style={{ flex: 1, height: 50, borderRadius: 12, border: "none", background: T_NEW.btnBg, color: "#fff", fontFamily: F_NEW, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <MIcon d={ICON.send} size={16} color="#fff" /> Відправити замовлення
          </button>
        </div>
      </div>
    </Phone>
  );
};

// === NEW CLIENTS — список контрагентів (маршрут / борг / VIP) ===================
const CLIENTS = [
  { name: "ТОВ «Фуршет Плюс»", code: "К-00142", city: "Київ", debt: "12 500", vip: true, last: { sum: "4 280", when: "вчора" } },
  { name: "АТБ-Маркет", code: "К-00098", city: "Дніпро", last: { sum: "8 640", when: "2 дні тому" } },
  { name: "ТОВ «Маркет Експрес»", code: "К-00188", city: "Бровари", isNew: true },
  { name: "Сільпо №14", code: "К-00076", city: "Львів", vip: true, last: { sum: "15 200", when: "тиждень тому" } },
  { name: "ФОП Петренко В.М.", code: "К-00211", city: "Київ", draft: true, last: { sum: "1 950", when: "чернетка" } },
  { name: "ФОП Коваль О.І.", code: "К-00203", city: "Ірпінь", debt: "3 200", last: { sum: "2 100", when: "3 дні тому" } },
];

const ClientRow = ({ c }) => {
  const T_NEW = useT();
  return (
    <Card style={{ padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Аватар */}
        <div style={{ width: 46, height: 46, borderRadius: 12, background: T_NEW.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <MIcon d={ICON.building} size={21} color={T_NEW.inkSoft} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
            {c.vip && <MIcon d={ICON.star} size={13} color={T_NEW.vip} w={1.8} />}
          </div>
          <div style={{ fontSize: 11.5, color: T_NEW.inkMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: F_NUM }}>{c.code}</span>
            <span style={{ color: T_NEW.line }}>·</span>
            <span>{c.city}</span>
          </div>
          {/* Пілли стану */}
          <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            {c.vip && <Pill bg={T_NEW.vipSoft} fg={T_NEW.vip}>VIP</Pill>}
            {c.debt && <Pill bg={T_NEW.errSoft} fg={T_NEW.err}>Борг {c.debt} ₴</Pill>}
            {c.isNew && <Pill bg={T_NEW.okSoft} fg={T_NEW.ok}>Новий</Pill>}
            {c.draft && <Pill bg={T_NEW.surfaceMuted} fg={T_NEW.inkSoft}>Є чернетка</Pill>}
          </div>
        </div>

        {/* Останнє замовлення */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {c.last ? (
            <>
              <div style={{ fontFamily: F_NUM, fontSize: 13.5, fontWeight: 700, color: c.draft ? T_NEW.inkSoft : T_NEW.ink }}>{c.last.sum} ₴</div>
              <div style={{ fontSize: 10.5, color: T_NEW.inkMuted, marginTop: 2 }}>{c.last.when}</div>
            </>
          ) : (
            <div style={{ fontSize: 10.5, color: T_NEW.inkMuted }}>немає{"\n"}замовлень</div>
          )}
          <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end" }}>
            <MIcon d={ICON.chevron} size={16} color={T_NEW.inkMuted} />
          </div>
        </div>
      </div>
    </Card>
  );
};

const Pill = ({ children, bg, fg }) => (
  <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: "2px 7px", borderRadius: 6, letterSpacing: 0.2, whiteSpace: "nowrap" }}>{children}</span>
);

const NewClients = () => {
  const T_NEW = useT();
  const [filter, setFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const filters = [
    { id: "all", label: "Усі", n: CLIENTS.length },
    { id: "debt", label: "З боргом", n: CLIENTS.filter(c => c.debt).length },
    { id: "vip", label: "VIP", n: CLIENTS.filter(c => c.vip).length },
  ];
  let list = CLIENTS;
  if (filter === "debt") list = CLIENTS.filter(c => c.debt);
  if (filter === "vip") list = CLIENTS.filter(c => c.vip);
  if (query.trim()) list = list.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.code.toLowerCase().includes(query.toLowerCase()));

  return (
    <Phone bg={T_NEW.bg} label="Редизайн — Клієнти">
      {/* Header */}
      <div style={{ padding: "8px 16px 12px", background: T_NEW.bg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Клієнти</div>
            <div style={{ fontSize: 11.5, color: T_NEW.inkMuted, marginTop: 2 }}>
              <span style={{ fontFamily: F_NUM }}>{CLIENTS.length}</span> контрагентів
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T_NEW.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MIcon d={ICON.plus} size={20} color="#fff" w={2} />
          </div>
        </div>

        {/* Search */}
        <div style={{ background: T_NEW.surface, border: `1px solid ${query ? T_NEW.accent : T_NEW.line}`, borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, height: 44 }}>
          <MIcon d={ICON.search} size={18} color={query ? T_NEW.accent : T_NEW.inkMuted} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук клієнта або коду…"
            style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: F_NEW, fontSize: 14, color: T_NEW.ink }} />
          {query && <div onClick={() => setQuery("")} style={{ cursor: "pointer", display: "flex" }}><MIcon d={ICON.x} size={17} color={T_NEW.inkMuted} /></div>}
        </div>

        {/* Segmented filter */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {filters.map(f => {
            const on = filter === f.id;
            return (
              <div key={f.id} onClick={() => setFilter(f.id)} style={{
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10,
                background: on ? T_NEW.btnBg : T_NEW.surface, border: `1px solid ${on ? T_NEW.btnBg : T_NEW.line}`,
                color: on ? "#fff" : T_NEW.inkSoft, fontSize: 12.5, fontWeight: 600,
              }}>
                {f.label}
                <span style={{ fontFamily: F_NUM, fontSize: 11, fontWeight: 700, color: on ? "rgba(255,255,255,0.7)" : T_NEW.inkMuted }}>{f.n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "0 16px", height: 568, overflowY: "auto" }}>
        {list.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: T_NEW.inkMuted }}>
            <MIcon d={ICON.users} size={36} color={T_NEW.line} />
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Нічого не знайдено</div>
          </div>
        ) : list.map(c => <ClientRow key={c.code} c={c} />)}
        <div style={{ height: 16 }} />
      </div>

      <NewBottomNav active="users" />
    </Phone>
  );
};

// =====================================================================
// ANALYSIS — текстова панель з оцінками поточного дизайну
// =====================================================================
const issues = [
  {
    cat: "Візуальна ієрархія",
    items: [
      { p: "Скрізь градієнт primary→secondary (header, FAB, кнопки) — він конкурує з контентом і робить інтерфейс «святковим», а не робочим.", v: "Нейтральне полотно (#F7F7F5) + один темний/акцентний контейнер для головного KPI. Градієнти прибрати." },
      { p: "Усі тексти жирні (700–900). Немає різниці між заголовком і підписом — все «кричить».", v: "Шкала: 22/700 → 15/600 → 13/600 → 11/500. Числа → IBM Plex Mono для табличного вирівнювання." },
      { p: "Дрібний кеглі — назви товарів 12.5px, статуси 10–11px. Незручно в полі (рукавичка/яскраве сонце).", v: "Мінімум 13.5px для тіла, 11px для метаданих. Hit-targets ≥ 44px (кнопки +/− у каталозі сьогодні 36px)." },
    ],
  },
  {
    cat: "Кольорова система",
    items: [
      { p: "8+ акцентних кольорів (primary, secondary, tertiary, фіолетовий 9C27B0 для синхронізації, ще error/success/warning) — без чіткої семантики.", v: "1 акцент (індиго) + 4 семантичні (ok/warn/err/vip). 'Синхронізація' — звичайна іконка, не окремий бренд-колір." },
      { p: "Темний хедер з градієнтом займає ~120px на головній — це 14% екрану під декорацію.", v: "Інверсний контейнер показує KPI дня (виторг, прогрес маршруту), а не просто аватар + дата." },
    ],
  },
  {
    cat: "Інформаційна архітектура",
    items: [
      { p: "Dashboard не показує головного. «Швидкий доступ» (4 картки) лише дублює нижню навігацію.", v: "Hero з KPI дня (виторг, замовлення, середній чек) + одна основна дія 'Нове замовлення'. Картки-дублікати прибрано." },
      { p: "Каталог: щоб додати товар, треба зайти на детальний екран → вибрати тип ціни → ввести кількість → повернутись. 4 кліки на позицію.", v: "Інлайн-степпер +/− прямо в списку. Тип ціни — 1 раз на рівні замовлення (з підказки про борг клієнта)." },
      { p: "«Контекст замовлення» в каталозі — це pill 'Додаємо в: Нове замовлення', легко пропустити.", v: "Прикріплена смужка з №чернетки, клієнтом і поточною сумою. Тап — назад до замовлення." },
      { p: "Каталог плаский: фіксовані чіпси (Молочні/Хліб/Напої) + акордеон на 1 рівень. Реальна номенклатура (1С/ERP) — дерево довільної глибини, яка тут не вміщається.", v: "Drill-down: тап по групі → вглиб, хлібні крихти (Каталог›Молочні›Сири) для стрибка на будь-який рівень, кнопка 'Назад'. Вузол може мати і підгрупи, і товари одночасно. Наскрізний пошук по всьому дереву з показом шляху до кожної позиції." },
    ],
  },
  {
    cat: "Стани й зворотний зв'язок",
    items: [
      { p: "Чернетка невидна на головній — той самий вигляд, що й 'Підтверджено'. Колір статусу читається лише по тексту.", v: "Кольорова смужка зліва + явний пілл 'ЧЕРНЕТКА'. Префікс Ч- замість ЗМ- для незакритих." },
      { p: "Офлайн-індикатор — маленький жовтий банер, легко не помітити при поганому зв'язку.", v: "Точка-індикатор у правому верхньому куті завжди видима, статус-чип у hero-картці." },
      { p: "QR-логін: емодзі-аватари товарів (🥛🧈) виглядають як playground, не B2B.", v: "Плейсхолдери з артикулом і смугастою заливкою (місце під реальне фото з ERP)." },
    ],
  },
  {
    cat: "Типографіка",
    items: [
      { p: "Nunito — округлий, дитячий шрифт. Не пасує B2B-додатку торгового представника.", v: "Inter для UI + IBM Plex Mono для чисел/SKU/дат (легше сканувати в таблицях)." },
    ],
  },
];

const Analysis = () => {
  const T_NEW = useT();
  return (
  <div style={{ width: 720, fontFamily: F_NEW, color: T_NEW.ink, padding: 32, background: T_NEW.surface, borderRadius: 20, border: `1px solid ${T_NEW.line}` }}>
    <div style={{ fontFamily: F_NUM, fontSize: 11, color: T_NEW.inkMuted, letterSpacing: 1, textTransform: "uppercase" }}>Design Review</div>
    <h1 style={{ fontSize: 30, fontWeight: 700, margin: "6px 0 8px", letterSpacing: -0.6 }}>TradeRep — аналіз і пропозиції</h1>
    <p style={{ fontSize: 14, color: T_NEW.inkSoft, lineHeight: 1.55, margin: 0 }}>
      Поточний UI працює, але має декоративний шар, який заважає польовій роботі: забагато градієнтів, емодзі замість зображень товарів, дрібні кеглі та слабка ієрархія. Нижче — конкретні проблеми й що пропоную натомість. Артборди праворуч показують Dashboard, Catalog та екран Замовлення в новій мові.
    </p>

    <div style={{ marginTop: 28 }}>
      {issues.map(group => (
        <div key={group.cat} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.accent, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>{group.cat}</div>
          {group.items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "12px 0", borderTop: `1px solid ${T_NEW.lineSoft}` }}>
              <div>
                <div style={{ fontSize: 10.5, fontFamily: F_NUM, color: T_NEW.err, fontWeight: 600, letterSpacing: 0.4, marginBottom: 4 }}>ПРОБЛЕМА</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: T_NEW.ink }}>{it.p}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontFamily: F_NUM, color: T_NEW.ok, fontWeight: 600, letterSpacing: 0.4, marginBottom: 4 }}>ПРОПОНУЮ</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: T_NEW.ink }}>{it.v}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>

    {/* Tokens overview */}
    <div style={{ marginTop: 32, padding: 20, background: T_NEW.bg, borderRadius: 14, border: `1px solid ${T_NEW.line}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T_NEW.accent, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 14 }}>Нова палітра</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { c: T_NEW.bg, n: "bg" },
          { c: T_NEW.surface, n: "surface" },
          { c: T_NEW.surfaceMuted, n: "muted" },
          { c: T_NEW.ink, n: "ink", dark: true },
          { c: T_NEW.inkSoft, n: "ink/soft", dark: true },
          { c: T_NEW.accent, n: "accent", dark: true },
          { c: T_NEW.ok, n: "ok", dark: true },
          { c: T_NEW.warn, n: "warn", dark: true },
          { c: T_NEW.err, n: "err", dark: true },
        ].map(s => (
          <div key={s.n} style={{ width: 96, padding: 10, borderRadius: 10, background: s.c, border: `1px solid ${T_NEW.line}` }}>
            <div style={{ height: 28, marginBottom: 6 }}/>
            <div style={{ fontSize: 10.5, fontFamily: F_NUM, fontWeight: 600, color: s.dark ? "#fff" : T_NEW.ink }}>{s.n}</div>
            <div style={{ fontSize: 9.5, fontFamily: F_NUM, color: s.dark ? "rgba(255,255,255,0.6)" : T_NEW.inkMuted, marginTop: 2 }}>{s.c}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

// =====================================================================
// CANVAS
// =====================================================================
const App = () => (
  <DesignCanvas title="TradeRep — Аналіз і пропозиції" subtitle="Поточний дизайн ↔ редизайн. Клік на артборд — фокус-режим.">
    <DCSection id="analysis" title="Аналіз поточного дизайну">
      <DCArtboard id="review" label="Design review" width={720} height={1200}>
        <Analysis />
      </DCArtboard>
    </DCSection>

    <DCSection id="current" title="Поточний дизайн (baseline)">
      <DCArtboard id="old-dash" label="Dashboard" width={393} height={852}><OldDashboard /></DCArtboard>
      <DCArtboard id="old-cat" label="Каталог" width={393} height={852}><OldCatalog /></DCArtboard>
      <DCArtboard id="old-ord" label="Замовлення" width={393} height={852}><OldOrder /></DCArtboard>
    </DCSection>

    <DCSection id="redesign" title="Пропонований редизайн">
      <DCArtboard id="new-dash" label="Головна" width={393} height={852}><NewDashboard /></DCArtboard>
      <DCArtboard id="new-cat" label="Каталог · дерево груп" width={393} height={852}><NewCatalog /></DCArtboard>
      <DCArtboard id="new-cli" label="Клієнти" width={393} height={852}><NewClients /></DCArtboard>
      <DCArtboard id="new-ord" label="Замовлення · чернетка" width={393} height={852}><NewOrder /></DCArtboard>
    </DCSection>

    <DCSection id="dark" title="Темна тема · варіант 1">
      <DCArtboard id="dk-dash" label="Головна · dark" width={393} height={852}><ThemeCtx.Provider value={DARK}><NewDashboard /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="dk-cat" label="Каталог · dark" width={393} height={852}><ThemeCtx.Provider value={DARK}><NewCatalog /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="dk-cli" label="Клієнти · dark" width={393} height={852}><ThemeCtx.Provider value={DARK}><NewClients /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="dk-ord" label="Замовлення · dark" width={393} height={852}><ThemeCtx.Provider value={DARK}><NewOrder /></ThemeCtx.Provider></DCArtboard>
    </DCSection>

    <DCSection id="dark2" title="Темна тема · варіант 2 (вищий контраст)">
      <DCArtboard id="d2-dash" label="Головна · dark 2" width={393} height={852}><ThemeCtx.Provider value={DARK2}><NewDashboard /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="d2-cat" label="Каталог · dark 2" width={393} height={852}><ThemeCtx.Provider value={DARK2}><NewCatalog /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="d2-cli" label="Клієнти · dark 2" width={393} height={852}><ThemeCtx.Provider value={DARK2}><NewClients /></ThemeCtx.Provider></DCArtboard>
      <DCArtboard id="d2-ord" label="Замовлення · dark 2" width={393} height={852}><ThemeCtx.Provider value={DARK2}><NewOrder /></ThemeCtx.Provider></DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
