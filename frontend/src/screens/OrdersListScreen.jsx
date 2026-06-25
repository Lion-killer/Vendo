import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { ScrollRow } from '../components/ui';
import { fetchOrders, deleteOrder } from '../api/client';
import { getLocalOrders, removeLocalOrder, saveLocalOrder } from '../api/localOrders';
import { idSet, checkOrderRefs, mergeOrders } from '../api/refs';

// Форматування дати в YYYY-MM-DD (локальний час, без зсуву UTC).
const fmtDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Швидкі пресети періоду. Орієнтація на історію замовлень + "Весь час" (#25).
// "Весь час" — навмисно широкий діапазон (бекенд фільтрує рядковим порівнянням YYYY-MM-DD).
// Підписи локалізуються за id (ordersList.<id>); тут лише ідентифікатори діапазонів.
const PRESETS = [
    { id: 'today' },
    { id: 'yesterday' },
    { id: 'last7' },
    { id: 'month' },
    { id: 'all' },
];

const presetRange = (type) => {
    const d = new Date();
    if (type === 'today') return { start: fmtDate(d), end: fmtDate(d) };
    if (type === 'yesterday') { const y = new Date(d); y.setDate(d.getDate() - 1); return { start: fmtDate(y), end: fmtDate(y) }; }
    if (type === 'last7') { const p = new Date(d); p.setDate(d.getDate() - 6); return { start: fmtDate(p), end: fmtDate(d) }; } // 7 днів включно з сьогодні
    if (type === 'month') { const f = new Date(d.getFullYear(), d.getMonth(), 1); return { start: fmtDate(f), end: fmtDate(d) }; }
    if (type === 'all') return { start: '2000-01-01', end: '2100-12-31' };
    return null;
};

const matchedPreset = (start, end) => {
    for (const p of PRESETS) {
        const r = presetRange(p.id);
        if (r && start === r.start && end === r.end) return p.id;
    }
    return null; // довільний діапазон
};

export const OrdersListScreen = ({ t, onNav, isOnline, refreshOrders, products = [], customers = [] }) => {
    const { t: tr } = useTranslation();
    const [startDate, setStartDate] = useState(() => localStorage.getItem('orders_startDate') || presetRange('last7').start);
    const [endDate, setEndDate] = useState(() => localStorage.getItem('orders_endDate') || presetRange('last7').end);
    // Поля точного вибору приховані, поки користувач не натисне "Свій період"
    // (або якщо відновлений діапазон не відповідає жодному пресету).
    const [showCustom, setShowCustom] = useState(() => !matchedPreset(
        localStorage.getItem('orders_startDate') || presetRange('last7').start,
        localStorage.getItem('orders_endDate') || presetRange('last7').end,
    ));
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    useEffect(() => {
        localStorage.setItem('orders_startDate', startDate);
        localStorage.setItem('orders_endDate', endDate);
    }, [startDate, endDate]);

    const setSmartFilter = (type) => {
        const r = presetRange(type);
        if (!r) return;
        setShowCustom(false);
        setStartDate(r.start);
        setEndDate(r.end);
    };

    const activeFilter = matchedPreset(startDate, endDate);
    const presetActive = (id) => !showCustom && activeFilter === id;

    const loadFilteredOrders = async () => {
        setLoading(true);
        try {
            let data = [];
            if (isOnline) {
                try {
                    data = await fetchOrders(startDate, endDate);
                } catch (err) {
                    console.warn("Помилка завантаження замовлень з сервера (можливо офлайн):", err);
                    // Продовжуємо з пустим data, щоб показати хоча б локальні
                }
            }

            // Локальні в межах періоду; спільне злиття (локальне виграє за id, _pending).
            const filteredLocals = getLocalOrders().filter(o => o.date >= startDate && o.date <= endDate);
            setOrders(mergeOrders(data, filteredLocals));
        } catch (e) {
            console.error("Помилка обробки замовлень", e);
        } finally {
            setLoading(false);
        }
    };

    const isDraftStatus = (o) => o?.status === "Нове";

    const handleDelete = async () => {
        if (!orderToDelete) return;
        const o = orderToDelete;
        if (o.status === "Проведено" || o.status === "Видалено") { setOrderToDelete(null); return; } // проведене/вже видалене не чіпаємо
        setLoading(true);
        try {
            if (isDraftStatus(o)) {
                // "Нове" — лише локальне; видаляємо локально (на сервері його ще немає).
                removeLocalOrder(o.id);
                if (o.num && isOnline) await deleteOrder(o.id);
            } else if (isOnline) {
                // Відправлене — помітка на видалення (бекенд/1С ставлять ПометкаУдаления)
                await deleteOrder(o.id);
                removeLocalOrder(o.id); // прибрати локальну копію, якщо була
            } else {
                // Офлайн: ставимо видалення в чергу (op:'delete') — виконається при синхронізації.
                saveLocalOrder({
                    id: o.id, num: o.num, op: 'delete', status: 'Видалено',
                    customer: o.customer || null, customerId: o.customerId || null,
                    client: o.client || o.customer?.name || tr('common.unknownClient'),
                    items: o.items || [], date: o.date, total: o.total, sColor: t.error,
                });
            }

            setOrderToDelete(null);
            await loadFilteredOrders(); // Оновлення списку
            if (refreshOrders) refreshOrders();
        } catch (err) {
            console.error("Помилка видалення", err);
        } finally {
            setLoading(false);
        }
    };

    // Завантажуємо при зміні дат або при першому рендері
    useEffect(() => {
        loadFilteredOrders();
    }, [startDate, endDate]);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: "20px", position: "relative", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: t.surface, padding: "16px 16px 12px", borderBottom: `1px solid ${t.border}`, paddingTop: "max(16px, env(safe-area-inset-top))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                    <h2 style={{ color: t.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{tr("nav.ordersList")}</h2>
                </div>

                {/* Розумні пресети + "Свій період" (точний вибір розкриває поля дат) */}
                <ScrollRow fade={t.surface} gap={8} style={{ paddingBottom: 4 }}>
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .smart-filter-btn {
                            white-space: nowrap;
                            padding: 6px 12px;
                            border-radius: 16px;
                            font-size: 11px;
                            font-weight: 700;
                            border: 1px solid ${t.border};
                            background: ${t.surfaceVariant};
                            color: ${t.text};
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            gap: 5px;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        }
                        .smart-filter-btn.active {
                            background: ${t.primary};
                            color: #fff;
                            border-color: ${t.primary};
                        }
                        .smart-filter-btn:active {
                            opacity: 0.7;
                            transform: scale(0.95);
                        }
                    `}} />
                    {PRESETS.map(p => (
                        <button key={p.id} className={`smart-filter-btn ${presetActive(p.id) ? 'active' : ''}`} onClick={() => setSmartFilter(p.id)}>{tr(`ordersList.${p.id}`)}</button>
                    ))}
                    <button className={`smart-filter-btn ${showCustom ? 'active' : ''}`} onClick={() => setShowCustom(v => !v)}>
                        <Icon name="calendar" size={13} color={showCustom ? "#fff" : t.text} /> {tr("ordersList.custom")}
                    </button>
                </ScrollRow>

                {/* Точний вибір дати — лише коли увімкнено "Свій період" */}
                {showCustom && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: t.textMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>{tr("ordersList.fromDate")}</p>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: "100%", background: t.surfaceVariant, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.border}`, color: t.text, fontFamily: "inherit", outline: "none" }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: t.textMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>{tr("ordersList.toDate")}</p>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: "100%", background: t.surfaceVariant, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.border}`, color: t.text, fontFamily: "inherit", outline: "none" }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: "40px" }}>
                        <div style={{ width: 30, height: 30, borderTop: `3px solid ${t.primary}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }} />
                    </div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <Icon name="orders" size={48} color={t.border} />
                        <p style={{ color: t.textMuted, fontSize: 14, fontWeight: 600, marginTop: 12 }}>{tr("ordersList.empty")}</p>
                    </div>
                ) : (
                    orders.map(o => {
                      const refs = (products.length > 0 && customers.length > 0)
                          ? checkOrderRefs(o, idSet(products), idSet(customers)) : { ok: true };
                      return (
                        <div key={o.id} onClick={() => onNav("orders", { order: o })} style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${o.deletionMark ? t.error + "55" : t.border}`, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: t.cardShadow, opacity: o.deletionMark ? 0.6 : 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surfaceVariant, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon name="orders" size={20} color={t.primary} />
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <p style={{ color: t.text, fontSize: 14, fontWeight: 800, margin: 0, textDecoration: o.deletionMark ? "line-through" : "none" }}>{o.num || `№${String(o.id || '').slice(0, 8)}`}</p>
                                        <span style={{ fontSize: 10, color: t.textMuted }}>{o.date}</span>
                                        {!refs.ok && <span title={tr("ordersList.tipStale")} style={{ fontSize: 9.5, fontWeight: 800, color: t.error, background: t.error + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("ordersList.badgeStale")}</span>}
                                        {o.conflict ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 800, color: t.error, background: t.error + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeConflict")}</span>
                                            : o.syncError ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 800, color: t.error, background: t.error + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeError")}</span>
                                            : o._pending && <span title={tr("ordersList.tipWaiting")} style={{ fontSize: 9.5, fontWeight: 800, color: t.textMuted, background: t.textMuted + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeWaiting")}</span>}
                                    </div>
                                    <p style={{ color: t.textMuted, fontSize: 12, margin: "2px 0 0", fontWeight: 600 }}>{o.client || o.customer?.name || tr("common.unknownClient")}</p>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ color: t.text, fontSize: 14, fontWeight: 900, margin: "0 0 2px" }}>{o.total}</p>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: o.sColor }}>{tr(`status.${o.status}`)}</span>
                                </div>
                                {(() => {
                                    const blocked = o.status === "Проведено" || o.status === "Видалено";
                                    return (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (!blocked) setOrderToDelete(o); }}
                                            title={blocked ? (o.status === "Видалено" ? tr("ordersList.tipAlreadyMarked") : tr("ordersList.tipCantDeletePosted")) : tr("ordersList.tipDelete")}
                                            style={{ background: blocked ? t.surfaceVariant : t.error + "15", border: "none", padding: 8, borderRadius: 10, cursor: blocked ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: blocked ? 0.45 : 1, transition: "background .2s" }}>
                                            <Icon name="trash" size={18} color={blocked ? t.textMuted : t.error} />
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                      );
                    })
                )}
            </div>

            {/* FAB */}
            <button
                onClick={() => onNav("orders", { newOrder: true })}
                style={{ position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, background: `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${t.primary}66`, zIndex: 10 }}
            >
                <Icon name="plus" size={24} color="#fff" />
            </button>

            {/* Delete Confirmation Modal */}
            {orderToDelete && (
                <div onClick={() => setOrderToDelete(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(2px)" }}>
                    <div onClick={(e) => e.stopPropagation()} style={{ background: t.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, boxShadow: t.cardShadow }}>
                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 24, background: t.error + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon name="trash" size={24} color={t.error} />
                            </div>
                        </div>
                        {(() => {
                            const label = orderToDelete.num || `№${String(orderToDelete.id || '').slice(0, 8)}`;
                            const draft = isDraftStatus(orderToDelete);
                            return (
                                <>
                                    <h3 style={{ color: t.text, fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>{draft ? tr("ordersList.delTitleDraft") : tr("ordersList.delTitleMark")}</h3>
                                    <p style={{ color: t.textMuted, fontSize: 14, textAlign: "center", margin: "0 0 24px" }}>
                                        {draft ? tr("ordersList.delBodyDraft", { label }) : tr("ordersList.delBodyMark", { label })}
                                    </p>
                                    <div style={{ display: "flex", gap: 12 }}>
                                        <button onClick={() => setOrderToDelete(null)} style={{ flex: 1, padding: "12px", background: t.surfaceVariant, border: "none", borderRadius: 12, color: t.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                                            {tr("common.cancel")}
                                        </button>
                                        <button onClick={handleDelete} style={{ flex: 1, padding: "12px", background: t.error, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 12px ${t.error}66` }}>
                                            {draft ? tr("ordersList.confirmDelete") : tr("ordersList.confirmMark")}
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};
