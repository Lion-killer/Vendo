import React, { useState, useEffect } from 'react';
import { MIcon, Card, F_NUM } from '../components/ui';
import { getLocalOrders } from '../api/localOrders';
import { mergeOrders } from '../api/refs';

// Розбір суми з рядка ("4 280 ₴" / "1 078.00 ₴") або числа → Number.
const parseMoney = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
};
const fmtMoney = (n) => n.toLocaleString('uk-UA', { maximumFractionDigits: 0 });

const initials = (name) => (name || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?";

// Відносний час останньої синхронізації ("щойно", "5 хв тому", "2 год тому", "вчора"…).
const syncLabel = (ts) => {
    if (!ts) return "ще не було";
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return "щойно";
    if (min < 60) return `${min} хв тому`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} год тому`;
    const d = Math.floor(h / 24);
    return d === 1 ? "вчора" : `${d} дн тому`;
};

export const DashboardScreen = ({ t, onNav, userName, isOnline, orders, productsCount = 0, customersCount = 0, onSync, onLogout, isDark, onToggleTheme }) => {
    const [showProfile, setShowProfile] = useState(false);

    // Раз на хвилину перемальовуємо, щоб відносний підпис синхронізації «капав»
    // ("щойно" → "1 хв тому" → …). Хвилинна гранулярність — навантаження мінімальне.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    // Локальні + серверні замовлення (спільне злиття: локальне виграє за id, _pending).
    const displayOrders = mergeOrders(orders, getLocalOrders());

    const ordersCount = displayOrders.length;
    const revenue = displayOrders.reduce((s, o) => s + parseMoney(o.total), 0);
    const avgCheck = ordersCount ? Math.round(revenue / ordersCount) : 0;

    const today = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

    const statusColor = (o) => o.sColor || (o.status === 'Видалено' ? t.err : o.status === 'Відправлено' ? t.ok : o.status === 'Нове' ? t.warn : t.inkSoft);
    const isNew = (o) => o.status === 'Нове';
    const orderNum = (o) => o.num || `№${String(o.id || '').slice(0, 8)}`;

    // Сьогоднішні замовлення (локальна дата YYYY-MM-DD) — для стрічки на головній.
    const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const todayOrders = displayOrders.filter(o => o.date === todayISO);

    // Стан синхронізації: час останньої вдалої синхронізації + локальна черга на відправку.
    const lastSync = Number(localStorage.getItem('vendo_last_sync')) || 0;
    const pendingCount = getLocalOrders().length;

    const stats = [
        {
            l: "Синхронізація",
            v: lastSync ? new Date(lastSync).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : "—",
            s: syncLabel(lastSync), icon: "sync", onClick: onSync,
        },
        {
            l: "На відправку",
            v: String(pendingCount),
            s: pendingCount ? "очікують" : "надіслано",
            icon: "send", warn: pendingCount > 0, onClick: () => onNav("ordersList"),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Верхня панель */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{initials(userName)}</div>
                    <div>
                        <div style={{ fontSize: 11, color: t.inkMuted, fontWeight: 500, textTransform: "capitalize" }}>{today}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{userName || "Користувач"}</div>
                    </div>
                </button>
                {/* Кнопки сповіщень/синхронізації/статусу — у глобальному TopActions (App) */}
            </div>

            {/* Hero: KPI дня */}
            <div style={{ margin: "12px 16px 0", borderRadius: 20, background: t.invBg, color: "#fff", padding: "18px 20px", overflow: "hidden" }}>
                <div>
                    <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>Виторг сьогодні</div>
                    <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, fontFamily: F_NUM, letterSpacing: -0.5 }}>{fmtMoney(revenue)} ₴</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 11, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14 }}>
                    {[["Замовлень", String(ordersCount)], ["Середній чек", `${fmtMoney(avgCheck)} ₴`], ["Клієнтів", String(customersCount)]].map(([l, v]) => (
                        <div key={l}>
                            <div style={{ opacity: 0.55 }}>{l}</div>
                            <div style={{ fontFamily: F_NUM, fontWeight: 600, fontSize: 16, marginTop: 1 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Основна дія */}
            <div style={{ margin: "14px 16px 0" }}>
                <button onClick={() => onNav("orders", { newOrder: true })} style={{ width: "100%", height: 54, border: "none", background: t.accent, borderRadius: 14, fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                    <MIcon name="plus" size={18} color="#fff" w={2} /> Нове замовлення
                </button>
            </div>

            {/* Швидка статистика */}
            <div style={{ margin: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {stats.map(s => (
                    <button key={s.l} onClick={s.onClick} style={{ textAlign: "left", cursor: "pointer", padding: "12px", background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, fontFamily: "inherit" }}>
                        <div style={{ marginBottom: 6, display: "flex" }}><MIcon name={s.icon} size={16} color={s.warn ? t.warn : t.inkMuted} /></div>
                        <div style={{ fontSize: 19, fontFamily: F_NUM, fontWeight: 600, color: s.warn ? t.warn : t.ink }}>{s.v}</div>
                        <div style={{ fontSize: 10.5, color: t.inkMuted, fontWeight: 500, marginTop: 1 }}>{s.l} · {s.s}</div>
                    </button>
                ))}
            </div>

            {/* Сьогоднішні замовлення — займають усю нижню область, скрол усередині */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", margin: "16px 16px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 4px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Сьогоднішні замовлення</div>
                    <div onClick={() => onNav("ordersList")} style={{ fontSize: 12, color: t.accent, fontWeight: 600, cursor: "pointer" }}>Усі →</div>
                </div>
                <Card t={t} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {todayOrders.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: t.inkMuted, fontSize: 13, padding: 24 }}>Сьогодні замовлень ще немає</div>
                    ) : (
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                        {todayOrders.map((o, i, arr) => (
                            <div key={o.id} onClick={() => onNav("orders", { order: o })} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${t.lineSoft}` : "none", cursor: "pointer", opacity: o.deletionMark ? 0.55 : 1 }}>
                                <div style={{ width: 4, alignSelf: "stretch", background: statusColor(o), borderRadius: 2, marginRight: 12 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontFamily: F_NUM, fontSize: 12, fontWeight: 600, textDecoration: o.deletionMark ? "line-through" : "none" }}>{orderNum(o)}</span>
                                        {isNew(o) && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.warn, background: t.warn + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>НОВЕ</span>}
                                        {o.conflict ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>КОНФЛІКТ</span>
                                            : o.syncError ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>ПОМИЛКА</span>
                                            : (o._pending && !isNew(o)) ? <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMuted, background: t.inkMuted + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>ОЧІКУЄ</span> : null}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.client || o.customer?.name || "Невідомий клієнт"}</div>
                                </div>
                                <div style={{ textAlign: "right", marginLeft: 10 }}>
                                    <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 600 }}>{o.total}</div>
                                    <div style={{ fontSize: 10.5, color: statusColor(o), fontWeight: 600, marginTop: 1 }}>{o.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </Card>
            </div>

            {/* Меню профілю (#47) */}
            {showProfile && (
                <div onClick={() => setShowProfile(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "0 auto 16px" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "0 4px" }}>
                            <div style={{ width: 52, height: 52, borderRadius: 16, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 18 }}>{initials(userName)}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: t.inkMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Торговий представник</div>
                                <div style={{ color: t.ink, fontSize: 17, marginTop: 2, fontWeight: 800 }}>{userName}</div>
                            </div>
                        </div>
                        {onToggleTheme && (
                            <button onClick={onToggleTheme} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                                <MIcon name="moon" size={20} color={t.ink} />
                                <span style={{ flex: 1, textAlign: "left" }}>Темна тема</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? t.accent : t.inkMuted }}>{isDark ? "Увімкнено" : "Вимкнено"}</span>
                            </button>
                        )}
                        <button onClick={() => { setShowProfile(false); onLogout && onLogout(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.errSoft, border: `1px solid ${t.err}33`, color: t.err, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit" }}>
                            <MIcon name="logout" size={20} color={t.err} /> Вийти
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};
