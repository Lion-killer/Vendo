import React, { useState, useEffect } from 'react';
import { Icon } from '../components/Icon';
import { Snackbar } from '../components/Shared';
import { createOrder, updateOrder } from '../api/client';
import { saveLocalOrder, updateLocalOrderStatus, removeLocalOrder } from '../api/localOrders';

export const OrderScreen = ({ t, isOnline, orderItems, setOrderItems, customers, refreshOrders, editOrderId, setEditOrderId, editCustomer, setEditCustomer, goToOrdersList, goToCatalog }) => {
    const customer = editCustomer || (customers.length > 0 ? customers[0] : null);
    const setCustomer = setEditCustomer;
    const [showCustPicker, setShowCustPicker] = useState(false);
    const [snack, setSnack] = useState("");
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const isMounted = React.useRef(true);
    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const updateQty = (idx, delta) => {
        const next = [...orderItems];
        next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
        setOrderItems(next);
        setIsDirty(true);
    };
    const removeItem = (idx) => {
        setOrderItems(orderItems.filter((_, i) => i !== idx));
        setIsDirty(true);
    };
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);

    // Автозбереження змін (чернетка)
    useEffect(() => {
        if (orderItems.length === 0 || !isDirty) return;

        try {
            const totalStr = `${Number(total).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ")} ₴`;
            const orderData = {
                num: editOrderId || undefined,
                customer: customer || null,
                customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт",
                items: orderItems,
                total: totalStr,
                status: "Чернетка",
                sColor: "#F2994A"
            };

            const localId = saveLocalOrder(orderData);
            if (localId !== editOrderId) {
                setEditOrderId(localId);
            }
        } catch (e) {
            console.error("Помилка автозбереження:", e);
        }
    }, [orderItems, customer, editOrderId, isOnline]);

    const send = async () => {
        if (!isOnline) {
            const totalStr = `${Number(total).toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ")} ₴`;
            const orderData = {
                num: editOrderId || undefined,
                customer: customer || null,
                customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт",
                items: orderItems,
                total: totalStr,
                status: "Очікує відправки",
                sColor: "#2D9CDB"
            };
            saveLocalOrder(orderData);

            if (isMounted.current) setSnack("Збережено для відправки офлайн");
            if (isMounted.current) setOrderItems([]);
            if (goToOrdersList) {
                if (isMounted.current) goToOrdersList();
            }
            setTimeout(() => { if (isMounted.current) setSnack(""); }, 2800);
            return;
        }

        if (isMounted.current) setLoading(true);
        try {
            const isLocal = String(editOrderId).startsWith("local_");
            // При відправленні замовлення міняємо статус на "Відправлено"
            if (editOrderId && !isLocal) {
                await updateOrder(editOrderId, orderItems, customer?.id, total, "Відправлено");
                if (isMounted.current) setSnack("Зміни відправлено!");
            } else {
                await createOrder(orderItems, customer?.id, total, "Відправлено");
                if (isMounted.current) setSnack("Замовлення відправлено!");
            }

            if (editOrderId) {
                removeLocalOrder(editOrderId);
            }

            if (isMounted.current) setOrderItems([]);
            refreshOrders();
            if (goToOrdersList) {
                if (isMounted.current) goToOrdersList();
            }
        } catch (e) {
            if (isMounted.current) setSnack("Помилка відправки");
        } finally {
            if (isMounted.current) setLoading(false);
            setTimeout(() => { if (isMounted.current) setSnack(""); }, 2800);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "env(safe-area-inset-top)", position: "relative", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: t.surface, padding: "16px 16px 12px", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800, margin: 0 }}>{editOrderId ? (String(editOrderId).startsWith("local_") ? `Чернетка Ч-${String(editOrderId).slice(-4)}` : `Замовлення ${editOrderId}`) : "Нове замовлення"}</h2>
                    {!isOnline && <div style={{ background: t.warning + "22", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                        <Icon name="wifiOff" size={13} color={t.warning} />
                        <span style={{ color: t.warning, fontSize: 11, fontWeight: 700 }}>Офлайн</span>
                    </div>}
                </div>

                {/* Customer selector */}
                <button onClick={() => setShowCustPicker(true)} style={{ width: "100%", background: t.surfaceVariant, borderRadius: 14, padding: "12px 14px", border: `1.5px solid ${t.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "inherit" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: t.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name="building" size={18} color={t.primary} />
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                        <p style={{ color: t.textMuted, fontSize: 10, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Контрагент</p>
                        <p style={{ color: t.text, fontSize: 13, margin: "2px 0 0", fontWeight: 700 }}>{customer?.name || "Не вибрано"}</p>
                    </div>
                    <Icon name="chevronDown" size={18} color={t.textMuted} />
                </button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 12px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" }}>
                    <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: .6 }}>Товари</p>
                    <span style={{ background: t.chip, color: t.chipText, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{orderItems.length} поз.</span>
                </div>

                {orderItems.map((item, idx) => (
                    <div key={idx} style={{ background: t.surface, borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 28 }}>{item.product.img}</span>
                            <div style={{ flex: 1 }}>
                                <p style={{ color: t.text, fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{item.product.name}</p>
                                <p style={{ color: t.textMuted, fontSize: 11, margin: "3px 0 0" }}>{item.product.sku}</p>
                            </div>
                            <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                                <Icon name="trash" size={16} color={t.error} />
                            </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", background: t.surfaceVariant, borderRadius: 12, overflow: "hidden" }}>
                                <button onClick={() => updateQty(idx, -1)} style={{ width: 36, height: 36, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon name="minus" size={16} color={t.primary} />
                                </button>
                                <span style={{ width: 32, textAlign: "center", color: t.text, fontSize: 15, fontWeight: 800 }}>{item.qty}</span>
                                <button onClick={() => updateQty(idx, 1)} style={{ width: 36, height: 36, background: t.primary, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <Icon name="plus" size={16} color="#fff" />
                                </button>
                            </div>
                            <span style={{ color: t.primary, fontSize: 15, fontWeight: 800 }}>{(item.product.price * item.qty).toFixed(2)} ₴</span>
                        </div>
                    </div>
                ))}

                {orderItems.length > 0 && (
                    <button onClick={goToCatalog} style={{ width: "100%", padding: "12px", borderRadius: 12, background: t.surfaceVariant, border: `1px dashed ${t.primary}`, color: t.primary, fontWeight: 700, cursor: "pointer", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
                        <Icon name="plus" size={16} color={t.primary} />
                        Додати ще товари
                    </button>
                )}

                {orderItems.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <Icon name="cart" size={48} color={t.border} />
                        <p style={{ color: t.textMuted, fontSize: 14, fontWeight: 600, marginTop: 12 }}>Кошик порожній</p>
                        <button onClick={goToCatalog} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 20, background: t.primary, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            Перейти в каталог
                        </button>
                    </div>
                )}
            </div>

            {/* Total + send */}
            <div style={{ padding: "12px 16px 24px", background: t.surface, borderTop: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ color: t.textSecondary, fontSize: 14, fontWeight: 700 }}>Сума замовлення:</span>
                    <span style={{ color: t.primary, fontSize: 22, fontWeight: 900 }}>{total.toFixed(2)} ₴</span>
                </div>
                <button onClick={send} disabled={orderItems.length === 0 || loading} style={{ width: "100%", height: 54, borderRadius: 16, background: orderItems.length === 0 ? "#ccc" : `linear-gradient(135deg, ${t.primary}, ${t.secondary})`, border: "none", cursor: orderItems.length > 0 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: orderItems.length > 0 ? `0 4px 20px ${t.primary}44` : "none", fontFamily: "inherit" }}>
                    {loading ? <div style={{ width: 20, height: 20, borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> : <Icon name="send" size={18} color="#fff" />}
                    <span style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>Відправити замовлення</span>
                </button>
            </div>

            {/* Customer picker modal */}
            {showCustPicker && (
                <div onClick={() => setShowCustPicker(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "env(safe-area-inset-bottom)" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.border, margin: "0 auto 16px" }} />
                        <h3 style={{ color: t.text, fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Оберіть контрагента</h3>
                        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                            {customers.map(c => (
                                <div key={c.id} onClick={() => { setCustomer(c); setIsDirty(true); setShowCustPicker(false); }} style={{ padding: "12px 8px", borderBottom: `1px solid ${t.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                                    <Icon name="building" size={18} color={customer?.id === c.id ? t.primary : t.textMuted} />
                                    <span style={{ color: t.text, fontSize: 14, fontWeight: customer?.id === c.id ? 800 : 600 }}>{c.name}</span>
                                    {customer?.id === c.id && <Icon name="check" size={16} color={t.primary} style={{ marginLeft: "auto" }} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <Snackbar msg={snack} t={t} />
        </div>
    );
};
