import { useState, useEffect, useRef } from "react";

// ─── THEME ────────────────────────────────────────────────────────────────────
const LIGHT = {
  bg: "#F4F6FB",
  surface: "#FFFFFF",
  surfaceVariant: "#E8EDF7",
  primary: "#1A4B8C",
  primaryDark: "#0D3166",
  primaryLight: "#2E6BC4",
  onPrimary: "#FFFFFF",
  secondary: "#00897B",
  onSecondary: "#FFFFFF",
  tertiary: "#FF8F00",
  text: "#0D1B2E",
  textSecondary: "#5A6A80",
  textMuted: "#8FA0B8",
  border: "#D0DAF0",
  error: "#C0392B",
  success: "#1B8B5E",
  warning: "#D4860A",
  cardShadow: "0 2px 12px rgba(26,75,140,0.10)",
  navBg: "#FFFFFF",
  navBorder: "#E0E8F5",
  statusBar: "#0D3166",
  chip: "#E3EAF8",
  chipText: "#1A4B8C",
  overlay: "rgba(13,27,46,0.45)",
};

const DARK = {
  bg: "#0A1628",
  surface: "#141E32",
  surfaceVariant: "#1C2A42",
  primary: "#4A90D9",
  primaryDark: "#2E6BC4",
  primaryLight: "#6BAAE8",
  onPrimary: "#FFFFFF",
  secondary: "#26C6B6",
  onSecondary: "#001F1C",
  tertiary: "#FFB300",
  text: "#E8EDF8",
  textSecondary: "#8FA8CE",
  textMuted: "#4A6080",
  border: "#243048",
  error: "#FF6B6B",
  success: "#4ECDA4",
  warning: "#FFB300",
  cardShadow: "0 2px 16px rgba(0,0,0,0.40)",
  navBg: "#0F1C30",
  navBorder: "#1E2E48",
  statusBar: "#060F1E",
  chip: "#1C2A42",
  chipText: "#6BAAE8",
  overlay: "rgba(0,0,0,0.65)",
};

// ─── ICONS (SVG inline) ───────────────────────────────────────────────────────
const Icon = ({ name, size = 22, color = "currentColor", style = {} }) => {
  const paths = {
    qr: <><rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke={color} strokeWidth="1.8"/><rect x="5" y="5" width="3" height="3" fill={color}/><rect x="16" y="5" width="3" height="3" fill={color}/><rect x="5" y="16" width="3" height="3" fill={color}/><line x1="14" y1="14" x2="14" y2="21" stroke={color} strokeWidth="1.8"/><line x1="14" y1="14" x2="21" y2="14" stroke={color} strokeWidth="1.8"/><rect x="17" y="17" width="4" height="4" fill={color}/></>,
    sync: <><path d="M4 12a8 8 0 018-8 8 8 0 016.32 3.13" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/><path d="M20 12a8 8 0 01-8 8 8 8 0 01-6.32-3.13" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/><polyline points="20,4 20,8 16,8" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="4,20 4,16 8,16" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    home: <><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H14v-5h-4v5H4a1 1 0 01-1-1V9.5z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    catalog: <><rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.8"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="none" stroke={color} strokeWidth="1.8"/></>,
    clients: <><circle cx="9" cy="7" r="4" fill="none" stroke={color} strokeWidth="1.8"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    orders: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="17" x2="12" y2="17" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></>,
    minus: <><line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></>,
    search: <><circle cx="11" cy="11" r="7" fill="none" stroke={color} strokeWidth="1.8"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    chevronLeft: <><polyline points="15 18 9 12 15 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    wifi: <><path d="M5 12.55a11 11 0 0114.08 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M1.42 9a16 16 0 0121.16 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M8.53 16.11a6 6 0 016.95 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill={color}/></>,
    wifiOff: <><line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a11 11 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill={color}/></>,
    check: <><polyline points="20 6 9 17 4 12" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    cart: <><circle cx="9" cy="21" r="1.5" fill={color}/><circle cx="20" cy="21" r="1.5" fill={color}/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    moon: <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    sun: <><circle cx="12" cy="12" r="5" fill="none" stroke={color} strokeWidth="1.8"/><line x1="12" y1="1" x2="12" y2="3" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></>,
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></>,
    box: <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    user: <><circle cx="12" cy="8" r="4" fill="none" stroke={color} strokeWidth="1.8"/><path d="M4 20v-1a8 8 0 0116 0v1" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    phone: <><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 8.09A16 16 0 0015.91 17l.55-.55a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><polyline points="22 6 12 13 2 6" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    trash: <><polyline points="3 6 5 6 21 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/><path d="M19 6l-1 14H6L5 6" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>,
    info: <><circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.8"/><line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="1" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 22V12h6v10M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>,
    mapPin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" fill="none" stroke={color} strokeWidth="1.8"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} xmlns="http://www.w3.org/2000/svg">
      {paths[name] || null}
    </svg>
  );
};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id:1, name:"Молоко ультрапастеризоване 2.5%", sku:"ML-001", price:42.50, stock:284, unit:"л", category:"Молочні продукти", img:"🥛" },
  { id:2, name:"Масло вершкове 82%", sku:"MB-002", price:98.00, stock:56, unit:"пач", category:"Молочні продукти", img:"🧈" },
  { id:3, name:"Сир твердий Едам 45%", sku:"CH-003", price:189.00, stock:12, unit:"кг", category:"Молочні продукти", img:"🧀" },
  { id:4, name:"Хліб білий формовий", sku:"BR-001", price:28.00, stock:0, unit:"шт", category:"Хлібобулочні", img:"🍞" },
  { id:5, name:"Батон нарізний 400г", sku:"BR-002", price:22.50, stock:145, unit:"шт", category:"Хлібобулочні", img:"🥖" },
  { id:6, name:"Вода мінеральна 1.5л", sku:"WA-001", price:18.00, stock:512, unit:"пл", category:"Напої", img:"💧" },
  { id:7, name:"Сік яблучний 1л", sku:"JU-001", price:52.00, stock:88, unit:"пл", category:"Напої", img:"🧃" },
];

const CUSTOMERS = [
  { id:1, name:"ТОВ \"Фуршет Плюс\"", code:"К-00142", city:"Київ", contact:"Іваненко Олег", phone:"+380 67 123 4567", debt:12500, status:"active" },
  { id:2, name:"ФОП Петренко В.М.", code:"К-00218", city:"Харків", contact:"Петренко Василь", phone:"+380 50 987 6543", debt:0, status:"active" },
  { id:3, name:"ТОВ \"АТБ-Маркет\"", code:"К-00305", city:"Дніпро", contact:"Коваленко Н.О.", phone:"+380 63 456 7890", debt:3200, status:"active" },
  { id:4, name:"Супермаркет \"Сільпо\"", code:"К-00401", city:"Одеса", contact:"Мороз Ірина", phone:"+380 44 321 0987", debt:0, status:"vip" },
  { id:5, name:"ТОВ \"Billa Україна\"", code:"К-00488", city:"Львів", contact:"Шевченко Т.Г.", phone:"+380 32 234 5678", debt:7800, status:"active" },
];

const CATEGORIES = [
  { id:1, name:"Молочні продукти", icon:"🥛", count:24, expanded:false },
  { id:2, name:"Хлібобулочні", icon:"🍞", count:18, expanded:false },
  { id:3, name:"Напої", icon:"🥤", count:31, expanded:false },
  { id:4, name:"М'ясні вироби", icon:"🥩", count:15, expanded:false },
  { id:5, name:"Кондитерські", icon:"🍰", count:22, expanded:false },
];

const ORDER_ITEMS_INIT = [
  { product: PRODUCTS[0], qty: 10 },
  { product: PRODUCTS[1], qty: 4 },
  { product: PRODUCTS[5], qty: 24 },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const PhoneFrame = ({ children, t, isDark }) => (
  <div style={{
    width: 393,
    minHeight: 852,
    background: t.bg,
    borderRadius: 44,
    overflow: "hidden",
    position: "relative",
    boxShadow: "0 30px 80px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 10px #1a1a2e, 0 0 0 11px #2a2a3e",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Nunito', 'Roboto', sans-serif",
  }}>
    {/* Status bar */}
    <div style={{ background: t.statusBar, height: 44, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", flexShrink:0 }}>
      <span style={{ color:"#fff", fontSize:13, fontWeight:700, letterSpacing:.3 }}>9:41</span>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <Icon name="wifi" size={15} color="#fff"/>
        <svg width="16" height="12" viewBox="0 0 24 16" fill="#fff"><rect x="0" y="2" width="4" height="12" rx="1"/><rect x="6" y="5" width="4" height="9" rx="1"/><rect x="12" y="2" width="4" height="12" rx="1"/><rect x="18" y="0" width="5" height="14" rx="1" opacity=".3"/></svg>
      </div>
    </div>
    {/* Content */}
    <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", scrollbarWidth:"none" }}>
      {children}
    </div>
  </div>
);

const BottomNav = ({ active, onNav, t }) => {
  const tabs = [
    { id:"dashboard", icon:"home", label:"Головна" },
    { id:"catalog", icon:"catalog", label:"Товари" },
    { id:"customers", icon:"clients", label:"Клієнти" },
    { id:"orders", icon:"orders", label:"Замовлення" },
  ];
  return (
    <div style={{ position:"sticky", bottom:0, background:t.navBg, borderTop:`1px solid ${t.navBorder}`, display:"flex", zIndex:10, boxShadow:`0 -4px 20px rgba(0,0,0,0.08)` }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onNav(tab.id)} style={{ flex:1, border:"none", background:"none", cursor:"pointer", padding:"8px 4px 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, transition:"all .2s" }}>
          <div style={{ width:48, height:32, borderRadius:16, background: active===tab.id ? t.chip : "transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}>
            <Icon name={tab.icon} size={20} color={active===tab.id ? t.primary : t.textMuted}/>
          </div>
          <span style={{ fontSize:10, fontWeight: active===tab.id ? 700:500, color: active===tab.id ? t.primary : t.textMuted, letterSpacing:.2 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const Snackbar = ({ msg, t }) => msg ? (
  <div style={{ position:"absolute", bottom:80, left:16, right:16, background:t.text, color:t.bg, borderRadius:12, padding:"12px 16px", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:10, boxShadow:t.cardShadow, zIndex:100, animation:"slideUp .3s ease" }}>
    <Icon name="check" size={16} color={t.secondary}/>{msg}
  </div>
) : null;

const Badge = ({ stock, t }) => {
  const color = stock === 0 ? t.error : stock < 20 ? t.warning : t.success;
  const label = stock === 0 ? "Немає" : stock < 20 ? `${stock} (мало)` : stock;
  return <span style={{ background: color+"22", color, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:20 }}>{label}</span>;
};

// ─── SCREEN 1: LOGIN ──────────────────────────────────────────────────────────
const LoginScreen = ({ t, onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scanned, setScanned] = useState(false);

  const handleScan = () => {
    setError(""); setLoading(true); setScanned(false);
    setTimeout(() => { setLoading(false); setScanned(true); }, 1800);
    setTimeout(() => onLogin(), 2600);
  };

  return (
    <div style={{ minHeight:"100%", background:`linear-gradient(160deg, ${t.primaryDark} 0%, ${t.primary} 55%, ${t.secondary}55 100%)`, display:"flex", flexDirection:"column", alignItems:"center", padding:"32px 28px 40px", position:"relative", overflow:"hidden" }}>
      {/* Background circles */}
      <div style={{ position:"absolute", top:-80, right:-80, width:260, height:260, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }}/>
      <div style={{ position:"absolute", bottom:-60, left:-60, width:200, height:200, borderRadius:"50%", background:"rgba(255,255,255,0.04)" }}/>

      {/* Logo area */}
      <div style={{ marginTop:40, textAlign:"center", zIndex:1 }}>
        <div style={{ width:80, height:80, borderRadius:24, background:"rgba(255,255,255,0.15)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", border:"1px solid rgba(255,255,255,0.2)", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
          <Icon name="box" size={40} color="#fff"/>
        </div>
        <h1 style={{ color:"#fff", fontSize:26, fontWeight:800, margin:0, letterSpacing:-.5 }}>TradeRep</h1>
        <p style={{ color:"rgba(255,255,255,0.65)", fontSize:14, margin:"6px 0 0", fontWeight:500 }}>Система торгового представника</p>
      </div>

      {/* QR Frame */}
      <div style={{ marginTop:40, zIndex:1, background:"rgba(255,255,255,0.10)", borderRadius:24, padding:24, backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.15)", width:"100%", maxWidth:280, boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <span style={{ color:"rgba(255,255,255,0.85)", fontSize:13, fontWeight:600 }}>Автентифікація за QR-кодом</span>
        </div>
        <div style={{ width:"100%", aspectRatio:"1", background: scanned ? t.secondary+"33" : "rgba(0,0,0,0.25)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", border:`2px dashed ${scanned ? t.secondary : "rgba(255,255,255,0.3)"}`, transition:"all .3s", position:"relative", overflow:"hidden" }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <div style={{ width:40, height:40, border:`3px solid rgba(255,255,255,0.2)`, borderTopColor:t.secondary, borderRadius:"50%", animation:"spin 1s linear infinite" }}/>
              <span style={{ color:"rgba(255,255,255,0.7)", fontSize:12 }}>Сканування...</span>
            </div>
          ) : scanned ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <div style={{ width:50, height:50, borderRadius:"50%", background:t.secondary, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="check" size={26} color="#fff"/>
              </div>
              <span style={{ color:t.secondary, fontSize:12, fontWeight:700 }}>Підтверджено!</span>
            </div>
          ) : (
            <Icon name="qr" size={80} color="rgba(255,255,255,0.5)"/>
          )}
          {/* Corner marks */}
          {!loading && !scanned && ["topLeft","topRight","bottomLeft","bottomRight"].map(pos => (
            <div key={pos} style={{ position:"absolute", [pos.includes("top")?"top":"bottom"]:8, [pos.includes("Left")?"left":"right"]:8, width:20, height:20, borderTop: pos.includes("top")?"2px solid rgba(255,255,255,0.6)":"none", borderBottom: pos.includes("bottom")?"2px solid rgba(255,255,255,0.6)":"none", borderLeft: pos.includes("Left")?"2px solid rgba(255,255,255,0.6)":"none", borderRight: pos.includes("Right")?"2px solid rgba(255,255,255,0.6)":"none", borderRadius: pos==="topLeft"?"4px 0 0 0":pos==="topRight"?"0 4px 0 0":pos==="bottomLeft"?"0 0 0 4px":"0 0 4px 0" }}/>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <div style={{ marginTop:12, background:t.error+"22", border:`1px solid ${t.error}44`, borderRadius:12, padding:"10px 16px", color:t.error, fontSize:13, fontWeight:600, textAlign:"center", zIndex:1 }}>{error}</div>}

      {/* Button */}
      <button onClick={handleScan} disabled={loading || scanned} style={{ marginTop:24, width:"100%", maxWidth:280, height:54, borderRadius:16, background: loading || scanned ? "rgba(255,255,255,0.2)" : t.secondary, border:"none", cursor: loading||scanned?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontFamily:"inherit", transition:"all .2s", boxShadow: loading||scanned?"none":"0 4px 20px rgba(0,0,0,0.25)", zIndex:1 }}>
        <Icon name="qr" size={20} color="#fff"/>
        <span style={{ color:"#fff", fontSize:15, fontWeight:700, letterSpacing:.3 }}>
          {loading ? "Зчитування..." : scanned ? "Успішно!" : "Сканувати QR-код"}
        </span>
      </button>

      <p style={{ marginTop:16, color:"rgba(255,255,255,0.45)", fontSize:12, textAlign:"center", zIndex:1 }}>Відскануйте QR-код з корпоративного порталу</p>
    </div>
  );
};

// ─── SCREEN 2: DASHBOARD ─────────────────────────────────────────────────────
const DashboardScreen = ({ t, onNav, userName, isOnline }) => {
  const [syncing, setSyncing] = useState(false);
  const [snack, setSnack] = useState("");

  const doSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setSnack("Синхронізацію завершено"); setTimeout(()=>setSnack(""),2500); }, 2000);
  };

  const cards = [
    { id:"catalog", icon:"catalog", label:"Номенклатура", sub:"1 248 позицій", color:t.primary, bg:t.chip },
    { id:"customers", icon:"clients", label:"Контрагенти", sub:"34 клієнти", color:t.secondary, bg:t.secondary+"18" },
    { id:"orders", icon:"orders", label:"Замовлення", sub:"7 активних", color:t.tertiary, bg:t.tertiary+"18" },
    { id:"sync", icon:"sync", label:"Синхронізація", sub:"12 год тому", color:"#9C27B0", bg:"#9C27B018" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:`linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primary} 100%)`, padding:"20px 20px 28px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:42, height:42, borderRadius:14, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon name="user" size={22} color="#fff"/>
            </div>
            <div>
              <p style={{ color:"rgba(255,255,255,0.65)", fontSize:11, margin:0, fontWeight:600, letterSpacing:.8, textTransform:"uppercase" }}>Торговий представник</p>
              <p style={{ color:"#fff", fontSize:16, margin:0, fontWeight:800 }}>{userName}</p>
            </div>
          </div>
          <button onClick={doSync} style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}>
              <Icon name="sync" size={20} color="#fff"/>
            </div>
          </button>
        </div>
        {/* Stats row */}
        <div style={{ display:"flex", gap:8 }}>
          {[["Маршрут","Київ-Північ"],["Дата","04.03.2026"],["Відвідано","5/12"]].map(([l,v]) => (
            <div key={l} style={{ flex:1, background:"rgba(255,255,255,0.12)", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
              <p style={{ color:"rgba(255,255,255,0.55)", fontSize:10, margin:"0 0 2px", fontWeight:600, letterSpacing:.5 }}>{l}</p>
              <p style={{ color:"#fff", fontSize:12, margin:0, fontWeight:800 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div style={{ background:t.warning+"22", borderBottom:`1px solid ${t.warning}44`, padding:"8px 20px", display:"flex", alignItems:"center", gap:8 }}>
          <Icon name="wifiOff" size={16} color={t.warning}/>
          <span style={{ color:t.warning, fontSize:12, fontWeight:700 }}>Офлайн-режим · Дані можуть бути застарілими</span>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ flex:1, padding:"20px 16px 8px", overflowY:"auto" }}>
        <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, letterSpacing:.8, textTransform:"uppercase", margin:"0 4px 12px" }}>Швидкий доступ</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {cards.map(card => (
            <button key={card.id} onClick={() => card.id !== "sync" ? onNav(card.id) : doSync()} style={{ background:t.surface, borderRadius:20, padding:"18px 16px", border:`1px solid ${t.border}`, cursor:"pointer", textAlign:"left", boxShadow:t.cardShadow, transition:"transform .15s", fontFamily:"inherit" }}>
              <div style={{ width:44, height:44, borderRadius:14, background:card.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                <Icon name={card.icon} size={22} color={card.color}/>
              </div>
              <p style={{ color:t.text, fontSize:14, fontWeight:800, margin:"0 0 3px", lineHeight:1.2 }}>{card.label}</p>
              <p style={{ color:t.textMuted, fontSize:11, margin:0, fontWeight:600 }}>{card.sub}</p>
            </button>
          ))}
        </div>

        {/* Recent orders */}
        <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, letterSpacing:.8, textTransform:"uppercase", margin:"24px 4px 12px" }}>Останні замовлення</p>
        {[
          { num:"ЗМ-2024", client:"ТОВ Фуршет Плюс", total:"4 280 ₴", status:"Відправлено", sColor:t.success },
          { num:"ЗМ-2023", client:"ФОП Петренко", total:"1 950 ₴", status:"Чернетка", sColor:t.textMuted },
          { num:"ЗМ-2022", client:"АТБ-Маркет", total:"8 640 ₴", status:"Підтверджено", sColor:t.primary },
        ].map(o => (
          <div key={o.num} onClick={() => onNav("orders")} style={{ background:t.surface, borderRadius:16, padding:"14px 16px", border:`1px solid ${t.border}`, marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", boxShadow:t.cardShadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:t.surfaceVariant, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Icon name="orders" size={18} color={t.primary}/>
              </div>
              <div>
                <p style={{ color:t.text, fontSize:13, fontWeight:700, margin:0 }}>{o.num}</p>
                <p style={{ color:t.textMuted, fontSize:11, margin:0, fontWeight:500 }}>{o.client}</p>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ color:t.text, fontSize:13, fontWeight:800, margin:0 }}>{o.total}</p>
              <span style={{ fontSize:10, fontWeight:700, color:o.sColor }}>{o.status}</span>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position:"sticky", bottom:0, padding:"8px 20px 12px", background:t.bg }}>
        <button onClick={() => onNav("orders")} style={{ width:"100%", height:52, borderRadius:16, background:`linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:`0 4px 20px ${t.primary}44`, fontFamily:"inherit" }}>
          <Icon name="plus" size={20} color="#fff"/>
          <span style={{ color:"#fff", fontSize:15, fontWeight:800, letterSpacing:.3 }}>Нове замовлення</span>
        </button>
      </div>
      <Snackbar msg={snack} t={t}/>
    </div>
  );
};

// ─── SCREEN 3: CATALOG ───────────────────────────────────────────────────────
const CatalogScreen = ({ t, onNav, onAddToOrder }) => {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(new Set([1]));
  const [selected, setSelected] = useState(null);
  const [snack, setSnack] = useState("");

  const toggle = (id) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const filtered = search ? PRODUCTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) : null;

  if (selected) return <ProductDetailScreen t={t} product={selected} onBack={() => setSelected(null)} onAdd={(p,q) => { onAddToOrder(p,q); setSnack(`${p.name.slice(0,20)}… додано`); setSelected(null); setTimeout(()=>setSnack(""),2500); }}/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header */}
      <div style={{ background:t.surface, padding:"16px 16px 0", borderBottom:`1px solid ${t.border}` }}>
        <h2 style={{ color:t.text, fontSize:18, fontWeight:800, margin:"0 0 12px" }}>Номенклатура</h2>
        <div style={{ background:t.surfaceVariant, borderRadius:14, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Icon name="search" size={18} color={t.textMuted}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук товару..." style={{ flex:1, border:"none", background:"none", outline:"none", color:t.text, fontSize:14, fontFamily:"inherit", fontWeight:500 }}/>
          {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:t.textMuted, fontSize:18, lineHeight:1 }}>×</button>}
        </div>
        {/* Filter chips */}
        <div style={{ display:"flex", gap:8, paddingBottom:12, overflowX:"auto", scrollbarWidth:"none" }}>
          {["Всі","Молочні","Хлібобулочні","Напої"].map((f,i) => (
            <span key={f} style={{ flexShrink:0, background: i===0?t.primary:t.chip, color: i===0?t.onPrimary:t.chipText, padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer" }}>{f}</span>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"8px 0" }}>
        {filtered ? (
          <div style={{ padding:"0 12px" }}>
            {filtered.map(p => <ProductRow key={p.id} p={p} t={t} onSelect={()=>setSelected(p)}/>)}
            {filtered.length === 0 && <div style={{ textAlign:"center", padding:"40px 20px", color:t.textMuted }}>
              <Icon name="search" size={40} color={t.border}/>
              <p style={{ marginTop:12, fontSize:14, fontWeight:600 }}>Нічого не знайдено</p>
            </div>}
          </div>
        ) : (
          CATEGORIES.map(cat => (
            <div key={cat.id}>
              <button onClick={() => toggle(cat.id)} style={{ width:"100%", background:"none", border:"none", cursor:"pointer", padding:"12px 20px", display:"flex", alignItems:"center", gap:12, fontFamily:"inherit" }}>
                <span style={{ fontSize:24 }}>{cat.icon}</span>
                <span style={{ flex:1, color:t.text, fontSize:15, fontWeight:700, textAlign:"left" }}>{cat.name}</span>
                <span style={{ background:t.chip, color:t.chipText, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10, marginRight:6 }}>{cat.count}</span>
                <Icon name={expanded.has(cat.id) ? "chevronDown":"chevronRight"} size={18} color={t.textMuted}/>
              </button>
              {expanded.has(cat.id) && (
                <div style={{ padding:"0 12px 8px" }}>
                  {PRODUCTS.filter(p => p.category === cat.name).map(p => <ProductRow key={p.id} p={p} t={t} onSelect={()=>setSelected(p)}/>)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <Snackbar msg={snack} t={t}/>
    </div>
  );
};

const ProductRow = ({ p, t, onSelect }) => (
  <div onClick={onSelect} style={{ background:t.surface, borderRadius:16, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
    <div style={{ width:52, height:52, borderRadius:14, background:t.surfaceVariant, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, flexShrink:0 }}>{p.img}</div>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ color:t.text, fontSize:13, fontWeight:700, margin:"0 0 2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</p>
      <p style={{ color:t.textMuted, fontSize:11, margin:"0 0 5px", fontWeight:500 }}>Арт: {p.sku}</p>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ color:t.primary, fontSize:14, fontWeight:800 }}>{p.price.toFixed(2)} ₴</span>
        <Badge stock={p.stock} t={t}/>
      </div>
    </div>
    <Icon name="chevronRight" size={18} color={t.textMuted}/>
  </div>
);

// ─── SCREEN 4: PRODUCT DETAIL ─────────────────────────────────────────────────
const ProductDetailScreen = ({ t, product, onBack, onAdd }) => {
  const [qty, setQty] = useState(1);
  const [priceType, setPriceType] = useState(0);
  const prices = ["Роздрібна","Дрібнооптова","Оптова"];
  const priceVals = [product.price, product.price*0.92, product.price*0.85];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      {/* Header image area */}
      <div style={{ background:`linear-gradient(160deg, ${t.primary}22 0%, ${t.surfaceVariant} 100%)`, padding:"16px 20px 0", position:"relative" }}>
        <button onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:t.surface, border:`1px solid ${t.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
          <Icon name="chevronLeft" size={20} color={t.text}/>
        </button>
        <div style={{ width:"100%", height:180, background:t.surface, borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80, marginBottom:0, border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
          {product.img}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 0" }}>
        {/* Title */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <h2 style={{ color:t.text, fontSize:18, fontWeight:800, margin:0, flex:1, lineHeight:1.3 }}>{product.name}</h2>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <span style={{ background:t.chip, color:t.chipText, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:10 }}>Арт: {product.sku}</span>
          <Badge stock={product.stock} t={t}/>
        </div>

        {/* Price type selector */}
        <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>Тип ціни</p>
        <div style={{ display:"flex", gap:6, marginBottom:20 }}>
          {prices.map((p,i) => (
            <button key={i} onClick={() => setPriceType(i)} style={{ flex:1, padding:"8px 4px", borderRadius:12, border:`1.5px solid ${priceType===i?t.primary:t.border}`, background: priceType===i?t.chip:"none", cursor:"pointer", fontFamily:"inherit", transition:"all .2s" }}>
              <p style={{ color: priceType===i?t.primary:t.textSecondary, fontSize:10, fontWeight:700, margin:"0 0 3px" }}>{p}</p>
              <p style={{ color: priceType===i?t.primary:t.text, fontSize:13, fontWeight:800, margin:0 }}>{priceVals[i].toFixed(2)} ₴</p>
            </button>
          ))}
        </div>

        {/* Qty */}
        <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", marginBottom:8 }}>Кількість</p>
        <div style={{ display:"flex", alignItems:"center", gap:0, background:t.surfaceVariant, borderRadius:16, padding:4, marginBottom:20 }}>
          <button onClick={()=>setQty(Math.max(1,qty-1))} style={{ width:48, height:48, borderRadius:13, background:qty===1?t.border:t.surface, border:"none", cursor:qty===1?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: qty>1?t.cardShadow:"none", transition:"all .2s" }}>
            <Icon name="minus" size={20} color={qty===1?t.textMuted:t.primary}/>
          </button>
          <span style={{ flex:1, textAlign:"center", color:t.text, fontSize:24, fontWeight:800 }}>{qty}</span>
          <button onClick={()=>setQty(qty+1)} style={{ width:48, height:48, borderRadius:13, background:t.primary, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 12px ${t.primary}44` }}>
            <Icon name="plus" size={20} color="#fff"/>
          </button>
        </div>

        {/* Summary */}
        <div style={{ background:t.surfaceVariant, borderRadius:16, padding:"14px 16px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:t.textSecondary, fontSize:13, fontWeight:600 }}>Сума:</span>
          <span style={{ color:t.primary, fontSize:22, fontWeight:900 }}>{(priceVals[priceType]*qty).toFixed(2)} ₴</span>
        </div>
      </div>

      <div style={{ padding:"12px 20px 16px", background:t.bg }}>
        <button onClick={() => onAdd(product, qty)} style={{ width:"100%", height:54, borderRadius:16, background:`linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow:`0 4px 20px ${t.primary}44`, fontFamily:"inherit" }}>
          <Icon name="cart" size={20} color="#fff"/>
          <span style={{ color:"#fff", fontSize:15, fontWeight:800, letterSpacing:.3 }}>Додати до замовлення</span>
        </button>
      </div>
    </div>
  );
};

// ─── SCREEN 5: CUSTOMERS ─────────────────────────────────────────────────────
const CustomersScreen = ({ t }) => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = CUSTOMERS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));

  if (selected) return <CustomerDetail t={t} customer={selected} onBack={()=>setSelected(null)}/>;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:t.surface, padding:"16px 16px 0", borderBottom:`1px solid ${t.border}` }}>
        <h2 style={{ color:t.text, fontSize:18, fontWeight:800, margin:"0 0 12px" }}>Контрагенти</h2>
        <div style={{ background:t.surfaceVariant, borderRadius:14, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <Icon name="search" size={18} color={t.textMuted}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук контрагента..." style={{ flex:1, border:"none", background:"none", outline:"none", color:t.text, fontSize:14, fontFamily:"inherit", fontWeight:500 }}/>
          {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:t.textMuted, fontSize:18 }}>×</button>}
        </div>
        <div style={{ display:"flex", gap:8, paddingBottom:12 }}>
          {["Всі","Активні","VIP","Борг"].map((f,i) => (
            <span key={f} style={{ background: i===0?t.primary:t.chip, color: i===0?t.onPrimary:t.chipText, padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer" }}>{f}</span>
          ))}
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"12px" }}>
        {filtered.map(c => (
          <div key={c.id} onClick={()=>setSelected(c)} style={{ background:t.surface, borderRadius:16, padding:"14px 16px", marginBottom:8, cursor:"pointer", border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:14, background: c.status==="vip"?t.tertiary+"22":t.chip, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon name="building" size={22} color={c.status==="vip"?t.tertiary:t.primary}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <p style={{ color:t.text, fontSize:13, fontWeight:800, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</p>
                  {c.status==="vip" && <span style={{ background:t.tertiary+"22", color:t.tertiary, fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:6, letterSpacing:.5 }}>VIP</span>}
                </div>
                <p style={{ color:t.textMuted, fontSize:11, margin:"2px 0 0", fontWeight:500 }}>{c.code} · {c.city}</p>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                {c.debt > 0 ? <span style={{ background:t.error+"18", color:t.error, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:8, display:"block" }}>−{c.debt.toLocaleString()} ₴</span> : <span style={{ background:t.success+"18", color:t.success, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:8, display:"block" }}>✓ Без боргу</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CustomerDetail = ({ t, customer, onBack }) => (
  <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
    <div style={{ background:`linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primary} 100%)`, padding:"16px 20px 24px" }}>
      <button onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:"rgba(255,255,255,0.15)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
        <Icon name="chevronLeft" size={20} color="#fff"/>
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:56, height:56, borderRadius:18, background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Icon name="building" size={28} color="#fff"/>
        </div>
        <div>
          <h2 style={{ color:"#fff", fontSize:16, fontWeight:800, margin:0, lineHeight:1.3 }}>{customer.name}</h2>
          <p style={{ color:"rgba(255,255,255,0.65)", fontSize:13, margin:"4px 0 0" }}>{customer.code} · {customer.city}</p>
        </div>
      </div>
    </div>
    <div style={{ flex:1, overflowY:"auto", padding:16 }}>
      {[
        { icon:"user", label:"Контактна особа", value:customer.contact },
        { icon:"phone", label:"Телефон", value:customer.phone },
        { icon:"mapPin", label:"Місто", value:customer.city },
      ].map(row => (
        <div key={row.label} style={{ background:t.surface, borderRadius:14, padding:"14px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:12, border:`1px solid ${t.border}` }}>
          <Icon name={row.icon} size={20} color={t.primary}/>
          <div>
            <p style={{ color:t.textMuted, fontSize:11, margin:0, fontWeight:600 }}>{row.label}</p>
            <p style={{ color:t.text, fontSize:14, margin:"2px 0 0", fontWeight:700 }}>{row.value}</p>
          </div>
        </div>
      ))}
      <div style={{ background:customer.debt>0?t.error+"18":t.success+"18", borderRadius:14, padding:"16px", border:`1px solid ${customer.debt>0?t.error+"33":t.success+"33"}`, marginBottom:16 }}>
        <p style={{ color:t.textMuted, fontSize:11, margin:"0 0 4px", fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>Поточний борг</p>
        <p style={{ color:customer.debt>0?t.error:t.success, fontSize:24, fontWeight:900, margin:0 }}>{customer.debt>0?`−${customer.debt.toLocaleString()} ₴`:"Без боргу"}</p>
      </div>
      <div style={{ background:t.surface, borderRadius:14, padding:"14px 16px", border:`1px solid ${t.border}` }}>
        <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, margin:"0 0 12px" }}>Останні замовлення</p>
        {["ЗМ-2021 · 3 420 ₴","ЗМ-1998 · 8 900 ₴","ЗМ-1975 · 1 200 ₴"].map((o,i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom: i<2?`1px solid ${t.border}`:"none" }}>
            <span style={{ color:t.text, fontSize:13, fontWeight:600 }}>{o.split("·")[0]}</span>
            <span style={{ color:t.primary, fontSize:13, fontWeight:700 }}>{o.split("·")[1]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── SCREEN 6: ORDER ─────────────────────────────────────────────────────────
const OrderScreen = ({ t, isOnline, orderItems, setOrderItems }) => {
  const [customer, setCustomer] = useState(CUSTOMERS[0]);
  const [showCustPicker, setShowCustPicker] = useState(false);
  const [snack, setSnack] = useState("");

  const updateQty = (idx, delta) => {
    const next = [...orderItems];
    next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
    setOrderItems(next);
  };
  const removeItem = (idx) => setOrderItems(orderItems.filter((_,i)=>i!==idx));
  const total = orderItems.reduce((s,it) => s + it.product.price * it.qty, 0);

  const send = () => {
    setSnack(isOnline ? "Замовлення відправлено!" : "Збережено для відправки офлайн");
    setTimeout(() => setSnack(""), 2800);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", position:"relative" }}>
      {/* Header */}
      <div style={{ background:t.surface, padding:"16px 16px 12px", borderBottom:`1px solid ${t.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <h2 style={{ color:t.text, fontSize:18, fontWeight:800, margin:0 }}>Нове замовлення</h2>
          {!isOnline && <div style={{ background:t.warning+"22", borderRadius:8, padding:"3px 10px", display:"flex", alignItems:"center", gap:5 }}>
            <Icon name="wifiOff" size={13} color={t.warning}/>
            <span style={{ color:t.warning, fontSize:11, fontWeight:700 }}>Офлайн</span>
          </div>}
        </div>

        {/* Customer selector */}
        <button onClick={()=>setShowCustPicker(true)} style={{ width:"100%", background:t.surfaceVariant, borderRadius:14, padding:"12px 14px", border:`1.5px solid ${t.border}`, cursor:"pointer", display:"flex", alignItems:"center", gap:10, fontFamily:"inherit" }}>
          <div style={{ width:36, height:36, borderRadius:11, background:t.chip, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Icon name="building" size={18} color={t.primary}/>
          </div>
          <div style={{ flex:1, textAlign:"left" }}>
            <p style={{ color:t.textMuted, fontSize:10, margin:0, fontWeight:700, textTransform:"uppercase", letterSpacing:.5 }}>Контрагент</p>
            <p style={{ color:t.text, fontSize:13, margin:"2px 0 0", fontWeight:700 }}>{customer.name}</p>
          </div>
          <Icon name="chevronDown" size={18} color={t.textMuted}/>
        </button>
      </div>

      {/* Items */}
      <div style={{ flex:1, overflowY:"auto", padding:"12px 12px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"0 4px" }}>
          <p style={{ color:t.textSecondary, fontSize:12, fontWeight:700, margin:0, textTransform:"uppercase", letterSpacing:.6 }}>Товари</p>
          <span style={{ background:t.chip, color:t.chipText, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:10 }}>{orderItems.length} поз.</span>
        </div>

        {orderItems.map((item, idx) => (
          <div key={idx} style={{ background:t.surface, borderRadius:16, padding:"12px 14px", marginBottom:8, border:`1px solid ${t.border}`, boxShadow:t.cardShadow }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:28 }}>{item.product.img}</span>
              <div style={{ flex:1 }}>
                <p style={{ color:t.text, fontSize:13, fontWeight:700, margin:0, lineHeight:1.3 }}>{item.product.name}</p>
                <p style={{ color:t.textMuted, fontSize:11, margin:"3px 0 0" }}>{item.product.sku}</p>
              </div>
              <button onClick={()=>removeItem(idx)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                <Icon name="trash" size={16} color={t.error}/>
              </button>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", background:t.surfaceVariant, borderRadius:12, overflow:"hidden" }}>
                <button onClick={()=>updateQty(idx,-1)} style={{ width:36, height:36, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name="minus" size={16} color={t.primary}/>
                </button>
                <span style={{ width:32, textAlign:"center", color:t.text, fontSize:15, fontWeight:800 }}>{item.qty}</span>
                <button onClick={()=>updateQty(idx,1)} style={{ width:36, height:36, background:t.primary, border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Icon name="plus" size={16} color="#fff"/>
                </button>
              </div>
              <span style={{ color:t.primary, fontSize:15, fontWeight:800 }}>{(item.product.price * item.qty).toFixed(2)} ₴</span>
            </div>
          </div>
        ))}

        {orderItems.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 20px" }}>
            <Icon name="cart" size={48} color={t.border}/>
            <p style={{ color:t.textMuted, fontSize:14, fontWeight:600, marginTop:12 }}>Кошик порожній</p>
          </div>
        )}
      </div>

      {/* Total + send */}
      <div style={{ padding:"12px 16px 16px", background:t.surface, borderTop:`1px solid ${t.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ color:t.textSecondary, fontSize:14, fontWeight:700 }}>Сума замовлення:</span>
          <span style={{ color:t.primary, fontSize:22, fontWeight:900 }}>{total.toFixed(2)} ₴</span>
        </div>
        <button onClick={send} disabled={orderItems.length===0} style={{ width:"100%", height:54, borderRadius:16, background: orderItems.length===0?"#ccc":`linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border:"none", cursor:orderItems.length>0?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", gap:10, boxShadow: orderItems.length>0?`0 4px 20px ${t.primary}44`:"none", fontFamily:"inherit" }}>
          <Icon name="send" size={18} color="#fff"/>
          <span style={{ color:"#fff", fontSize:15, fontWeight:800 }}>Відправити замовлення</span>
        </button>
      </div>

      {/* Customer picker modal */}
      {showCustPicker && (
        <div onClick={()=>setShowCustPicker(false)} style={{ position:"absolute", inset:0, background:t.overlay, zIndex:50, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:t.surface, borderRadius:"24px 24px 0 0", padding:"20px 16px" }}>
            <div style={{ width:40, height:4, borderRadius:2, background:t.border, margin:"0 auto 16px" }}/>
            <h3 style={{ color:t.text, fontSize:16, fontWeight:800, margin:"0 0 12px" }}>Оберіть контрагента</h3>
            {CUSTOMERS.map(c => (
              <div key={c.id} onClick={()=>{setCustomer(c);setShowCustPicker(false);}} style={{ padding:"12px 8px", borderBottom:`1px solid ${t.border}`, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
                <Icon name="building" size={18} color={customer.id===c.id?t.primary:t.textMuted}/>
                <span style={{ color:t.text, fontSize:14, fontWeight: customer.id===c.id?800:600 }}>{c.name}</span>
                {customer.id===c.id && <Icon name="check" size={16} color={t.primary} style={{ marginLeft:"auto" }}/>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Snackbar msg={snack} t={t}/>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [screen, setScreen] = useState("login");
  const [isOnline, setIsOnline] = useState(true);
  const [orderItems, setOrderItems] = useState(ORDER_ITEMS_INIT);
  const t = isDark ? DARK : LIGHT;

  const handleLogin = () => setScreen("dashboard");
  const handleNav = (s) => setScreen(s);
  const handleAddToOrder = (product, qty) => {
    setOrderItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id);
      if (existing >= 0) { const n=[...prev]; n[existing]={...n[existing],qty:n[existing].qty+qty}; return n; }
      return [...prev, { product, qty }];
    });
  };

  const isLoggedIn = screen !== "login";

  return (
    <div style={{ minHeight:"100vh", background:`linear-gradient(135deg, #0D1B2E 0%, #1A3A6E 50%, #0A2E2A 100%)`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"30px 16px 30px", gap:20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        button { -webkit-tap-highlight-color: transparent; }
      `}</style>

      {/* Top controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:16, padding:"8px 16px", backdropFilter:"blur(10px)", border:"1px solid rgba(255,255,255,0.15)" }}>
          <span style={{ color:"#fff", fontSize:15, fontWeight:800, letterSpacing:-.3 }}>✦ TradeRep UI Kit</span>
        </div>

        {/* Screen selector */}
        <div style={{ display:"flex", gap:6, background:"rgba(255,255,255,0.08)", borderRadius:16, padding:5, backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.12)", flexWrap:"wrap", justifyContent:"center" }}>
          {[["login","Логін"],["dashboard","Дашборд"],["catalog","Каталог"],["customers","Клієнти"],["orders","Замовлення"]].map(([id,label]) => (
            <button key={id} onClick={()=>setScreen(id)} style={{ padding:"6px 14px", borderRadius:11, border:"none", cursor:"pointer", background: screen===id?"#fff":"none", color: screen===id?"#1A4B8C":"rgba(255,255,255,0.7)", fontWeight:700, fontSize:12, fontFamily:"Nunito,sans-serif", transition:"all .2s" }}>{label}</button>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setIsDark(!isDark)} style={{ width:40, height:40, borderRadius:12, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon name={isDark?"sun":"moon"} size={18} color="#fff"/>
          </button>
          <button onClick={()=>setIsOnline(!isOnline)} style={{ height:40, padding:"0 14px", borderRadius:12, background: isOnline?"rgba(0,137,123,0.3)":"rgba(192,57,43,0.3)", border:`1px solid ${isOnline?"rgba(0,137,123,0.5)":"rgba(192,57,43,0.5)"}`, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
            <Icon name={isOnline?"wifi":"wifiOff"} size={15} color={isOnline?"#4ECDA4":"#FF6B6B"}/>
            <span style={{ color:isOnline?"#4ECDA4":"#FF6B6B", fontSize:12, fontWeight:700, fontFamily:"Nunito,sans-serif" }}>{isOnline?"Онлайн":"Офлайн"}</span>
          </button>
        </div>
      </div>

      {/* Phone */}
      <PhoneFrame t={t} isDark={isDark}>
        <div style={{ display:"flex", flexDirection:"column", height:"100%", minHeight: screen==="login"?760:undefined }}>
          {screen === "login" && <LoginScreen t={t} onLogin={handleLogin}/>}
          {screen !== "login" && (
            <>
              <div style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
                {screen === "dashboard" && <DashboardScreen t={t} onNav={handleNav} userName="Марченко О.В." isOnline={isOnline}/>}
                {screen === "catalog" && <CatalogScreen t={t} onNav={handleNav} onAddToOrder={handleAddToOrder}/>}
                {screen === "customers" && <CustomersScreen t={t}/>}
                {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} orderItems={orderItems} setOrderItems={setOrderItems}/>}
              </div>
              <BottomNav active={screen} onNav={handleNav} t={t}/>
            </>
          )}
        </div>
      </PhoneFrame>

      <p style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontFamily:"Nunito,sans-serif", fontWeight:600, textAlign:"center" }}>Material 3 · Android · Ukrainian Locale · © 2026</p>
    </div>
  );
}
