import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MIcon, ScrollRow, ListPlaceholder, ConfirmDialog } from '../components/ui';
import { orderNum, fmtDate as fmtDmy } from '../i18n';
import { deleteOrder } from '../api/client';
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

export const OrdersListScreen = ({ t, onNav, isOnline, refreshOrders, products = [], customers = [], orders: appOrders = [], connecting }) => {
    const { t: tr } = useTranslation();
    const [startDate, setStartDate] = useState(() => localStorage.getItem('orders_startDate') || presetRange('last7').start);
    const [endDate, setEndDate] = useState(() => localStorage.getItem('orders_endDate') || presetRange('last7').end);
    // Поля точного вибору приховані, поки користувач не натисне "Свій період"
    // (або якщо відновлений діапазон не відповідає жодному пресету).
    const [showCustom, setShowCustom] = useState(() => !matchedPreset(
        localStorage.getItem('orders_startDate') || presetRange('last7').start,
        localStorage.getItem('orders_endDate') || presetRange('last7').end,
    ));
    // Сидуємо вже відомими замовленнями (з App + локальні, у межах періоду), щоб при
    // переході екран не блимав порожнім спінером, поки повільний сервер відповідає.
    const inRange = (o) => o.date >= startDate && o.date <= endDate;
    const [orders, setOrders] = useState(() =>
        mergeOrders(appOrders.filter(inRange), getLocalOrders().filter(inRange)));
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

    // Список будуємо ПОВНІСТЮ з App-стану (фонова 20-с синхронізація) + локальні, фільтр
    // за датою клієнтсько. Жодних власних мережевих викликів — як решта екранів.
    const recompute = () => setOrders(mergeOrders(appOrders.filter(inRange), getLocalOrders().filter(inRange)));

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
                if (o.num && isOnline) await deleteOrder(o.id, o.version);
            } else if (isOnline) {
                // Відправлене — помітка на видалення (бекенд/1С ставлять ПометкаУдаления)
                const r = await deleteOrder(o.id, o.version);
                // Конфлікт версій → у чергу як конфлікт (банер при відкритті), не «успіх».
                if (r && r.conflict) {
                    saveLocalOrder({
                        id: o.id, num: o.num, op: 'delete', status: 'Видалено', baseVersion: o.version,
                        conflict: true, serverState: r.serverState || null, syncError: r.message || "Конфлікт",
                        customer: o.customer || null, customerId: o.customerId || null,
                        client: o.client || o.customer?.name || tr('common.unknownClient'),
                        items: o.items || [], date: o.date, total: o.total, sColor: t.err,
                    });
                    setOrderToDelete(null); recompute(); return;
                }
                removeLocalOrder(o.id); // прибрати локальну копію, якщо була
            } else {
                // Офлайн: ставимо видалення в чергу (op:'delete') — виконається при синхронізації.
                saveLocalOrder({
                    id: o.id, num: o.num, op: 'delete', status: 'Видалено', baseVersion: o.version,
                    customer: o.customer || null, customerId: o.customerId || null,
                    client: o.client || o.customer?.name || tr('common.unknownClient'),
                    items: o.items || [], date: o.date, total: o.total, sColor: t.err,
                });
            }

            setOrderToDelete(null);
            recompute(); // миттєво відображаємо локальну зміну
            if (refreshOrders) refreshOrders(); // App перечитає сервер у фоні → appOrders оновиться
        } catch (err) {
            console.error("Помилка видалення", err);
        } finally {
            setLoading(false);
        }
    };

    // Перерахунок списку при зміні App-замовлень або періоду (клієнтська фільтрація).
    useEffect(() => {
        recompute();
    }, [appOrders, startDate, endDate]);

    // Чіп пресета періоду (інлайн-стилі, як сегментований фільтр на інших екранах).
    const chip = (active) => ({
        whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 16, fontSize: 11, fontWeight: 700,
        border: `1px solid ${active ? t.accent : t.line}`, background: active ? t.accent : t.surfaceMuted,
        color: active ? "#fff" : t.ink, cursor: "pointer", display: "inline-flex", alignItems: "center",
        gap: 5, fontFamily: "inherit",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: "20px", position: "relative", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: t.surface, padding: "16px 16px 12px", borderBottom: `1px solid ${t.line}`, paddingTop: "max(16px, env(safe-area-inset-top))" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                    <h2 style={{ color: t.ink, fontSize: 20, fontWeight: 700, margin: 0 }}>{tr("nav.ordersList")}</h2>
                </div>

                {/* Розумні пресети + "Свій період" (точний вибір розкриває поля дат) */}
                <ScrollRow fade={t.surface} gap={8} style={{ paddingBottom: 4 }}>
                    {PRESETS.map(p => (
                        <button key={p.id} style={chip(presetActive(p.id))} onClick={() => setSmartFilter(p.id)}>{tr(`ordersList.${p.id}`)}</button>
                    ))}
                    <button style={chip(showCustom)} onClick={() => setShowCustom(v => !v)}>
                        <MIcon name="calendar" size={13} color={showCustom ? "#fff" : t.ink} /> {tr("ordersList.custom")}
                    </button>
                </ScrollRow>

                {/* Точний вибір дати — лише коли увімкнено "Свій період" */}
                {showCustom && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: t.inkMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>{tr("ordersList.fromDate")}</p>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: "100%", background: t.surfaceMuted, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.line}`, color: t.ink, fontFamily: "inherit", outline: "none" }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ color: t.inkMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>{tr("ordersList.toDate")}</p>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: "100%", background: t.surfaceMuted, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.line}`, color: t.ink, fontFamily: "inherit", outline: "none" }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px" }}>
                {orders.length === 0 ? (
                    <ListPlaceholder loading={connecting && appOrders.length === 0} t={t}>
                        <MIcon name="doc" size={48} color={t.line} />
                        <p style={{ color: t.inkMuted, fontSize: 14, fontWeight: 600, marginTop: 12 }}>{tr("ordersList.empty")}</p>
                    </ListPlaceholder>
                ) : (
                    orders.map(o => {
                      const refs = (products.length > 0 && customers.length > 0)
                          ? checkOrderRefs(o, idSet(products), idSet(customers)) : { ok: true };
                      return (
                        <div key={o.id} onClick={() => onNav("orders", { order: o })} style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${o.deletionMark ? t.err + "55" : t.line}`, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", opacity: o.deletionMark ? 0.6 : 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <MIcon name="doc" size={20} color={t.accent} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <p style={{ color: t.ink, fontSize: 14, fontWeight: 700, margin: 0, textDecoration: o.deletionMark ? "line-through" : "none" }}>{orderNum(o)}</p>
                                        <span style={{ fontSize: 10, color: t.inkMuted }}>{fmtDmy(o.date)}</span>
                                        {!refs.ok && <span title={tr("ordersList.tipStale")} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("ordersList.badgeStale")}</span>}
                                        {o.conflict ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeConflict")}</span>
                                            : o.syncError ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeError")}</span>
                                            : o._pending && <span title={tr("ordersList.tipWaiting")} style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMuted, background: t.inkMuted + "1A", padding: "1px 6px", borderRadius: 6 }}>{tr("dashboard.badgeWaiting")}</span>}
                                    </div>
                                    <p style={{ color: t.inkMuted, fontSize: 12, margin: "2px 0 0", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.client || o.customer?.name || tr("common.unknownClient")}</p>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ color: t.ink, fontSize: 14, fontWeight: 700, margin: "0 0 2px", whiteSpace: "nowrap" }}>{o.total}</p>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: o.sColor }}>{tr(`status.${o.status}`)}</span>
                                </div>
                                {(() => {
                                    const blocked = o.status === "Проведено" || o.status === "Видалено";
                                    return (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); if (!blocked) setOrderToDelete(o); }}
                                            title={blocked ? (o.status === "Видалено" ? tr("ordersList.tipAlreadyMarked") : tr("ordersList.tipCantDeletePosted")) : tr("ordersList.tipDelete")}
                                            style={{ background: blocked ? t.surfaceMuted : t.err + "15", border: "none", padding: 8, borderRadius: 10, cursor: blocked ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: blocked ? 0.45 : 1, transition: "background .2s" }}>
                                            <MIcon name="trash" size={18} color={blocked ? t.inkMuted : t.err} />
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
                style={{ position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, background: t.accent, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 20px ${t.accent}66`, zIndex: 10 }}
            >
                <MIcon name="plus" size={24} color="#fff" w={2} />
            </button>

            {/* Підтвердження видалення/помітки — спільний діалог застосунку */}
            {orderToDelete && (() => {
                const label = orderNum(orderToDelete);
                const draft = isDraftStatus(orderToDelete);
                return (
                    <ConfirmDialog t={t} icon="trash"
                        title={draft ? tr("ordersList.delTitleDraft") : tr("ordersList.delTitleMark")}
                        body={draft ? tr("ordersList.delBodyDraft", { label }) : tr("ordersList.delBodyMark", { label })}
                        confirmLabel={draft ? tr("ordersList.confirmDelete") : tr("ordersList.confirmMark")}
                        cancelLabel={tr("common.cancel")}
                        onConfirm={handleDelete}
                        onCancel={() => setOrderToDelete(null)} />
                );
            })()}
        </div>
    );
};
