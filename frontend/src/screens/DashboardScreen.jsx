import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Snackbar } from '../components/Shared';
import { createOrder, updateOrder } from '../api/client';
import { getLocalOrders, removeLocalOrder } from '../api/localOrders';

export const DashboardScreen = ({ t, onNav, userName, isOnline, orders, refreshOrders, onLogout }) => {
    const [syncing, setSyncing] = useState(false);
    const [snack, setSnack] = useState("");
    const [showProfile, setShowProfile] = useState(false);

    const doSync = async () => {
        if (!isOnline) {
            setSnack("Немає підключення");
            setTimeout(() => setSnack(""), 2500);
            return;
        }
        setSyncing(true);
        try {
            const locals = getLocalOrders();
            // Синхронізуємо і чернетки, і ті що очікують відправки
            for (const o of locals) {
                const isLocal = String(o.num).startsWith("local_");
                let numericTotal = 0;
                if (typeof o.total === 'string') {
                    numericTotal = parseFloat(o.total.replace(/[^\\d.-]/g, ''));
                } else {
                    numericTotal = o.total;
                }

                if (!isLocal && o.num) {
                    await updateOrder(o.num, o.items, o.customerId, numericTotal, "Відправлено");
                } else {
                    await createOrder(o.items, o.customerId, numericTotal, "Відправлено");
                }
                removeLocalOrder(o.num);
            }
            if (refreshOrders) refreshOrders();
            setSnack("Синхронізацію завершено");
        } catch (e) {
            console.error("Sync error:", e);
            setSnack("Помилка синхронізації");
        } finally {
            setSyncing(false);
            setTimeout(() => setSnack(""), 2500);
        }
    };

    // Об'єднуємо локальні і серверні замовлення, усуваючи дублікати за номером
    const displayOrders = (() => {
        const locals = getLocalOrders();
        const merged = [...locals];
        for (const r of orders) {
            if (!merged.find(m => m.num === r.num)) {
                merged.push(r);
            }
        }
        return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
    })();

    const totalOrdersCount = displayOrders.length;
    const unsentOrdersCount = displayOrders.filter(o => o.status === 'Чернетка' || o.status === 'Очікує відправки').length;

    const cards = [
        { id: "catalog", icon: "catalog", label: "Номенклатура", sub: "1 248 позицій", color: t.primary, bg: t.chip },
        { id: "customers", icon: "clients", label: "Контрагенти", sub: "34 клієнти", color: t.secondary, bg: t.secondary + "18" },
        { id: "ordersList", icon: "orders", label: "Замовлення", sub: `${totalOrdersCount} всього${unsentOrdersCount > 0 ? ` · ${unsentOrdersCount} нових` : ''}`, color: t.tertiary, bg: t.tertiary + "18" },
        { id: "sync", icon: "sync", label: "Синхронізація", sub: "Опції", color: "#9C27B0", bg: "#9C27B018" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: "20px", position: "relative", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primary} 100%)`, padding: "20px 20px 28px", paddingTop: "max(20px, env(safe-area-inset-top))" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <button onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon name="user" size={22} color="#fff" />
                        </div>
                        <div>
                            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, margin: 0, fontWeight: 600, letterSpacing: .8, textTransform: "uppercase" }}>Торговий представник</p>
                            <p style={{ color: "#fff", fontSize: 16, margin: 0, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>{userName}<Icon name="chevronDown" size={16} color="rgba(255,255,255,0.7)" /></p>
                        </div>
                    </button>
                    <button onClick={doSync} style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}>
                            <Icon name="sync" size={20} color="#fff" />
                        </div>
                    </button>
                </div>
                {/* Stats row */}
                <div style={{ display: "flex", gap: 8 }}>
                    {[["Маршрут", "Київ-Північ"], ["Дата", new Date().toLocaleDateString('uk-UA')], ["Відвідано", "5/12"]].map(([l, v]) => (
                        <div key={l} style={{ flex: 1, background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, margin: "0 0 2px", fontWeight: 600, letterSpacing: .5 }}>{l}</p>
                            <p style={{ color: "#fff", fontSize: 12, margin: 0, fontWeight: 800 }}>{v}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Offline banner */}
            {!isOnline && (
                <div style={{ background: t.warning + "22", borderBottom: `1px solid ${t.warning}44`, padding: "8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name="wifiOff" size={16} color={t.warning} />
                    <span style={{ color: t.warning, fontSize: 12, fontWeight: 700 }}>Офлайн-режим · Дані можуть бути застарілими</span>
                </div>
            )}

            {/* Cards grid */}
            <div style={{ flex: 1, padding: "20px 16px 8px", overflowY: "auto" }}>
                <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", margin: "0 4px 12px" }}>Швидкий доступ</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {cards.map(card => (
                        <button key={card.id} onClick={() => card.id !== "sync" ? onNav(card.id) : doSync()} style={{ background: t.surface, borderRadius: 20, padding: "18px 16px", border: `1px solid ${t.border}`, cursor: "pointer", textAlign: "left", boxShadow: t.cardShadow, transition: "transform .15s", fontFamily: "inherit" }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                                <Icon name={card.icon} size={22} color={card.color} />
                            </div>
                            <p style={{ color: t.text, fontSize: 14, fontWeight: 800, margin: "0 0 3px", lineHeight: 1.2 }}>{card.label}</p>
                            <p style={{ color: t.textMuted, fontSize: 11, margin: 0, fontWeight: 600 }}>{card.sub}</p>
                        </button>
                    ))}
                </div>

                {/* Recent orders */}
                <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", margin: "24px 4px 12px" }}>Останні замовлення</p>

                {displayOrders.slice(0, 3).map(o => (
                    <div key={o.num} onClick={() => onNav("orders", { order: o })} style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.border}`, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: t.cardShadow }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: t.surfaceVariant, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon name="orders" size={18} color={t.primary} />
                            </div>
                            <div>
                                <p style={{ color: t.text, fontSize: 13, fontWeight: 700, margin: 0 }}>{String(o.num).startsWith('local_') ? `Ч-${String(o.num).slice(-4)}` : o.num}</p>
                                <p style={{ color: t.textMuted, fontSize: 11, margin: 0, fontWeight: 500 }}>{o.client || o.customer?.name || "Невідомий клієнт"}</p>
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <p style={{ color: t.text, fontSize: 13, fontWeight: 800, margin: 0 }}>{o.total}</p>
                            <span style={{ fontSize: 10, fontWeight: 700, color: o.sColor }}>{o.status}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ position: "absolute", bottom: 16, left: 20, right: 20 }}>
                <button onClick={() => onNav("orders", { newOrder: true })} style={{ width: "100%", height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 4px 20px ${t.primary}44`, fontFamily: "inherit" }}>
                    <Icon name="plus" size={20} color="#fff" />
                    <span style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: .3 }}>Нове замовлення</span>
                </button>
            </div>
            {/* Profile sheet */}
            {showProfile && (
                <div onClick={() => setShowProfile(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.border, margin: "0 auto 16px" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "0 4px" }}>
                            <div style={{ width: 52, height: 52, borderRadius: 16, background: t.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon name="user" size={26} color={t.primary} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ color: t.textMuted, fontSize: 11, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Торговий представник</p>
                                <p style={{ color: t.text, fontSize: 17, margin: "2px 0 0", fontWeight: 800 }}>{userName}</p>
                            </div>
                        </div>
                        <button onClick={() => { setShowProfile(false); onLogout && onLogout(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.error + "15", border: `1px solid ${t.error}33`, color: t.error, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit" }}>
                            <Icon name="logout" size={20} color={t.error} />
                            Вийти
                        </button>
                    </div>
                </div>
            )}

            <Snackbar msg={snack} t={t} />
        </div>
    );
};
