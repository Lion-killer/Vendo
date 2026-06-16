import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { fetchOrders, deleteOrder } from '../api/client';
import { getLocalOrders, removeLocalOrder } from '../api/localOrders';

export const OrdersListScreen = ({ t, onNav, isOnline, refreshOrders }) => {
    const getLocalToday = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const [startDate, setStartDate] = useState(() => localStorage.getItem('orders_startDate') || getLocalToday());
    const [endDate, setEndDate] = useState(() => localStorage.getItem('orders_endDate') || getLocalToday());
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);

    useEffect(() => {
        localStorage.setItem('orders_startDate', startDate);
        localStorage.setItem('orders_endDate', endDate);
    }, [startDate, endDate]);

    const setSmartFilter = (type) => {
        const d = new Date();
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        if (type === 'today') {
            setStartDate(formatDate(d));
            setEndDate(formatDate(d));
        } else if (type === 'tomorrow') {
            d.setDate(d.getDate() + 1);
            setStartDate(formatDate(d));
            setEndDate(formatDate(d));
        } else if (type === 'last7') {
            const currentObj = new Date(d);
            const past = new Date(d);
            past.setDate(d.getDate() - 7);
            setStartDate(formatDate(past));
            setEndDate(formatDate(currentObj));
        } else if (type === 'next7') {
            const currentObj = new Date(d);
            const future = new Date(d);
            future.setDate(d.getDate() + 7);
            setStartDate(formatDate(currentObj));
            setEndDate(formatDate(future));
        }
    };

    const activeFilter = (() => {
        const d = new Date();
        const formatDate = (date) => {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };
        const today = formatDate(d);
        const tomD = new Date(d); tomD.setDate(tomD.getDate() + 1); const tomorrow = formatDate(tomD);
        const pastD = new Date(d); pastD.setDate(pastD.getDate() - 7); const last7Start = formatDate(pastD);
        const futD = new Date(d); futD.setDate(futD.getDate() + 7); const next7End = formatDate(futD);

        if (startDate === today && endDate === today) return 'today';
        if (startDate === tomorrow && endDate === tomorrow) return 'tomorrow';
        if (startDate === last7Start && endDate === today) return 'last7';
        if (startDate === today && endDate === next7End) return 'next7';
        return null;
    })();

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

            const locals = getLocalOrders();
            const filteredLocals = locals.filter(o => o.date >= startDate && o.date <= endDate);

            const merged = [...filteredLocals];
            for (const r of data) {
                if (!merged.find(m => m.num === r.num)) {
                    merged.push(r);
                }
            }
            merged.sort((a, b) => new Date(b.date) - new Date(a.date));

            setOrders(merged);
        } catch (e) {
            console.error("Помилка обробки замовлень", e);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (e, num) => {
        e.stopPropagation();
        setOrderToDelete(num);
    };

    const handleDelete = async () => {
        if (!orderToDelete) return;
        setLoading(true);
        try {
            const isLocal = String(orderToDelete).startsWith("local_");
            if (isLocal) {
                removeLocalOrder(orderToDelete);
            } else {
                removeLocalOrder(orderToDelete);
                await deleteOrder(orderToDelete);
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h2 style={{ color: t.text, fontSize: 20, fontWeight: 800, margin: 0 }}>Замовлення</h2>
                    {!isOnline && <div style={{ background: t.warning + "22", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon name="wifiOff" size={13} color={t.warning} />
                        <span style={{ color: t.warning, fontSize: 11, fontWeight: 700 }}>Офлайн</span>
                    </div>}
                </div>

                {/* Filters */}
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ color: t.textMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>З дати:</p>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: "100%", background: t.surfaceVariant, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.border}`, color: t.text, fontFamily: "inherit", outline: "none" }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ color: t.textMuted, fontSize: 10, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>По дату:</p>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: "100%", background: t.surfaceVariant, borderRadius: 10, padding: "8px 10px", border: `1px solid ${t.border}`, color: t.text, fontFamily: "inherit", outline: "none" }}
                        />
                    </div>
                </div>

                {/* Smart Filters */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 12, paddingBottom: 4, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
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
                    <button className={`smart-filter-btn ${activeFilter === 'today' ? 'active' : ''}`} onClick={() => setSmartFilter('today')}>Сьогодні</button>
                    <button className={`smart-filter-btn ${activeFilter === 'tomorrow' ? 'active' : ''}`} onClick={() => setSmartFilter('tomorrow')}>Завтра</button>
                    <button className={`smart-filter-btn ${activeFilter === 'last7' ? 'active' : ''}`} onClick={() => setSmartFilter('last7')}>Останні 7 днів</button>
                    <button className={`smart-filter-btn ${activeFilter === 'next7' ? 'active' : ''}`} onClick={() => setSmartFilter('next7')}>Наступні 7 днів</button>
                </div>
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
                        <p style={{ color: t.textMuted, fontSize: 14, fontWeight: 600, marginTop: 12 }}>За вказаний період замовлень немає</p>
                    </div>
                ) : (
                    orders.map(o => (
                        <div key={o.num} onClick={() => onNav("orders", { order: o })} style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", border: `1px solid ${t.border}`, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", boxShadow: t.cardShadow }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: t.surfaceVariant, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon name="orders" size={20} color={t.primary} />
                                </div>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <p style={{ color: t.text, fontSize: 14, fontWeight: 800, margin: 0 }}>{String(o.num).startsWith('local_') ? `Ч-${String(o.num).slice(-4)}` : o.num}</p>
                                        <span style={{ fontSize: 10, color: t.textMuted }}>{o.date}</span>
                                    </div>
                                    <p style={{ color: t.textMuted, fontSize: 12, margin: "2px 0 0", fontWeight: 600 }}>{o.client || o.customer?.name || "Невідомий клієнт"}</p>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ color: t.text, fontSize: 14, fontWeight: 900, margin: "0 0 2px" }}>{o.total}</p>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: o.sColor }}>{o.status}</span>
                                </div>
                                <button onClick={(e) => confirmDelete(e, o.num)} style={{ background: t.error + "15", border: "none", padding: 8, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: t.error, transition: "background .2s" }}>
                                    <Icon name="trash" size={18} color={t.error} />
                                </button>
                            </div>
                        </div>
                    ))
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
                        <h3 style={{ color: t.text, fontSize: 18, fontWeight: 800, textAlign: "center", margin: "0 0 8px" }}>Видалення замовлення</h3>
                        <p style={{ color: t.textMuted, fontSize: 14, textAlign: "center", margin: "0 0 24px" }}>Ви дійсно хочете видалити замовлення {orderToDelete}? Цю дію неможливо скасувати.</p>

                        <div style={{ display: "flex", gap: 12 }}>
                            <button onClick={() => setOrderToDelete(null)} style={{ flex: 1, padding: "12px", background: t.surfaceVariant, border: "none", borderRadius: 12, color: t.text, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                                Скасувати
                            </button>
                            <button onClick={handleDelete} style={{ flex: 1, padding: "12px", background: t.error, border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 12px ${t.error}66` }}>
                                Видалити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
