import React from 'react';
import { Icon } from './Icon';

export const PhoneFrame = ({ children, t, isDark }) => (
    <div style={{
        width: '100vw',
        height: '100vh',
        background: t.bg,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Nunito', 'Roboto', sans-serif",
    }}>
        {/* Status bar */}
        <div style={{ background: t.statusBar, height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
            {/* Time and network icons skipped for native app, but kept for web preview */}
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: .3 }}>9:41</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Icon name="wifi" size={15} color="#fff" />
                <svg width="16" height="12" viewBox="0 0 24 16" fill="#fff"><rect x="0" y="2" width="4" height="12" rx="1" /><rect x="6" y="5" width="4" height="9" rx="1" /><rect x="12" y="2" width="4" height="12" rx="1" /><rect x="18" y="0" width="5" height="14" rx="1" opacity=".3" /></svg>
            </div>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" }}>
            {children}
        </div>
    </div>
);

export const BottomNav = ({ active, onNav, t }) => {
    const tabs = [
        { id: "dashboard", icon: "home", label: "Головна" },
        { id: "catalog", icon: "catalog", label: "Товари" },
        { id: "customers", icon: "clients", label: "Клієнти" },
        { id: "ordersList", icon: "orders", label: "Замовлення" },
    ];
    return (
        <div style={{ position: "sticky", bottom: 0, background: t.navBg, borderTop: `1px solid ${t.navBorder}`, display: "flex", zIndex: 10, paddingBottom: "env(safe-area-inset-bottom)" }}>
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => onNav(tab.id)} style={{ flex: 1, border: "none", background: "none", cursor: "pointer", padding: "8px 4px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all .2s" }}>
                    <div style={{ width: 48, height: 32, borderRadius: 16, background: active === tab.id ? t.chip : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .2s" }}>
                        <Icon name={tab.icon} size={20} color={active === tab.id ? t.primary : t.textMuted} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active === tab.id ? 700 : 500, color: active === tab.id ? t.primary : t.textMuted, letterSpacing: .2 }}>{tab.label}</span>
                </button>
            ))}
        </div>
    );
};

export const Snackbar = ({ msg, t }) => msg ? (
    <div style={{ position: "absolute", bottom: 100, left: 16, right: 16, background: t.text, color: t.bg, borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, boxShadow: t.cardShadow, zIndex: 100, animation: "slideUp .3s ease" }}>
        <Icon name="check" size={16} color={t.secondary} />{msg}
    </div>
) : null;

export const Badge = ({ stock, t }) => {
    const color = stock === 0 ? t.error : stock < 20 ? t.warning : t.success;
    const label = stock === 0 ? "Немає" : stock < 20 ? `${stock} (мало)` : stock;
    return <span style={{ background: color + "22", color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{label}</span>;
};
