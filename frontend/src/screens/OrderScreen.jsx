import React, { useState, useEffect } from 'react';
import { Snackbar } from '../components/Shared';
import { MIcon, Card, F_NUM, ProductImage } from '../components/ui';
import { createOrder, updateOrder } from '../api/client';
import { saveLocalOrder, removeLocalOrder } from '../api/localOrders';

const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const OrderScreen = ({ t, isOnline, orderItems, setOrderItems, customers, refreshOrders, editOrderId, setEditOrderId, editCustomer, setEditCustomer, goToOrdersList, goToCatalog }) => {
    const customer = editCustomer || (customers.length > 0 ? customers[0] : null);
    const setCustomer = setEditCustomer;
    const [showCustPicker, setShowCustPicker] = useState(false);
    const [snack, setSnack] = useState("");
    const [loading, setLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const isMounted = React.useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    const updateQty = (idx, delta) => {
        const next = [...orderItems];
        next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
        setOrderItems(next);
        setIsDirty(true);
    };
    const removeItem = (idx) => { setOrderItems(orderItems.filter((_, i) => i !== idx)); setIsDirty(true); };
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);
    const debt = Number(customer?.debt) || 0;

    // Автозбереження чернетки
    useEffect(() => {
        if (orderItems.length === 0 || !isDirty) return;
        try {
            const orderData = {
                num: editOrderId || undefined,
                customer: customer || null,
                customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт",
                items: orderItems,
                total: `${money(total)} ₴`,
                status: "Чернетка",
                sColor: t.inkSoft,
            };
            const localId = saveLocalOrder(orderData);
            if (localId !== editOrderId) setEditOrderId(localId);
        } catch (e) { console.error("Помилка автозбереження:", e); }
    }, [orderItems, customer, editOrderId, isOnline]);

    const send = async () => {
        if (!isOnline) {
            saveLocalOrder({
                num: editOrderId || undefined, customer: customer || null, customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт", items: orderItems, total: `${money(total)} ₴`,
                status: "Очікує відправки", sColor: t.warn,
            });
            if (isMounted.current) { setSnack("Збережено для відправки офлайн"); setOrderItems([]); }
            if (goToOrdersList && isMounted.current) goToOrdersList();
            setTimeout(() => { if (isMounted.current) setSnack(""); }, 2800);
            return;
        }
        if (isMounted.current) setLoading(true);
        try {
            const isLocal = String(editOrderId).startsWith("local_");
            if (editOrderId && !isLocal) {
                await updateOrder(editOrderId, orderItems, customer?.id, total, "Відправлено");
                if (isMounted.current) setSnack("Зміни відправлено!");
            } else {
                await createOrder(orderItems, customer?.id, total, "Відправлено");
                if (isMounted.current) setSnack("Замовлення відправлено!");
            }
            if (editOrderId) removeLocalOrder(editOrderId);
            if (isMounted.current) setOrderItems([]);
            refreshOrders();
            if (goToOrdersList && isMounted.current) goToOrdersList();
        } catch (e) {
            if (isMounted.current) setSnack("Помилка відправки");
        } finally {
            if (isMounted.current) setLoading(false);
            setTimeout(() => { if (isMounted.current) setSnack(""); }, 2800);
        }
    };

    const draftLabel = editOrderId
        ? (String(editOrderId).startsWith("local_") ? `Ч-${String(editOrderId).slice(-4)} · автозбережено` : editOrderId)
        : "Нова чернетка";

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Шапка */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <button onClick={goToOrdersList} style={{ width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <MIcon name="back" size={18} color={t.ink} />
                    </button>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 44 }}>
                        <div style={{ background: t.surfaceMuted, padding: "5px 9px", borderRadius: 8, fontSize: 10.5, fontWeight: 700, color: t.inkSoft, letterSpacing: 0.4 }}>● ЧЕРНЕТКА</div>
                    </div>
                </div>
                <div style={{ fontFamily: F_NUM, fontSize: 11, color: t.inkMuted, fontWeight: 500, letterSpacing: 0.4 }}>{draftLabel}</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginTop: 2 }}>Замовлення</div>
            </div>

            {/* Клієнт */}
            <div style={{ padding: "0 16px" }}>
                <Card t={t} style={{ padding: 14 }}>
                    <button onClick={() => setShowCustPicker(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MIcon name="building" size={20} color={t.ink} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{customer?.name || "Оберіть контрагента"}</div>
                            <div style={{ fontSize: 11.5, color: t.inkSoft, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {customer?.code && <span style={{ fontFamily: F_NUM }}>{customer.code}</span>}
                                {(customer?.city || customer?.address) && <><span style={{ color: t.line }}>·</span><span>{customer.city || customer.address}</span></>}
                                {debt > 0 && <><span style={{ color: t.line }}>·</span><span style={{ color: t.err, fontWeight: 600 }}>борг {money(debt)} ₴</span></>}
                            </div>
                        </div>
                        <MIcon name="chevron" size={18} color={t.inkMuted} />
                    </button>
                    {debt > 0 && (
                        <div style={{ marginTop: 12, padding: "10px 12px", background: t.warnSoft, borderRadius: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                            <div style={{ flexShrink: 0, marginTop: 1, display: "flex" }}><MIcon name="bell" size={14} color={t.warn} /></div>
                            <div style={{ fontSize: 11.5, color: t.warn, fontWeight: 500, lineHeight: 1.4 }}>У клієнта є борг {money(debt)} ₴.</div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Позиції */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 4px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Позиції · {orderItems.length}</div>
                    <div onClick={goToCatalog} style={{ fontSize: 12, color: t.accent, fontWeight: 600, cursor: "pointer" }}>+ Додати</div>
                </div>

                {orderItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 20px", color: t.inkMuted }}>
                        <MIcon name="cart" size={40} color={t.line} />
                        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>Кошик порожній</div>
                        <button onClick={goToCatalog} style={{ marginTop: 18, padding: "10px 22px", borderRadius: 12, background: t.accent, color: "#fff", border: "none", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>Перейти в каталог</button>
                    </div>
                ) : (
                    <Card t={t}>
                        {orderItems.map((it, idx) => (
                            <div key={idx} style={{ padding: "12px 14px", borderBottom: idx < orderItems.length - 1 ? `1px solid ${t.lineSoft}` : "none" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    <ProductImage t={t} img={it.product.img} sku={it.product.sku} size={36} radius={8} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{it.product.name}</div>
                                        <div style={{ fontFamily: F_NUM, fontSize: 11, color: t.inkMuted, marginTop: 2 }}>{it.product.sku} · {money(it.product.price)} ₴{it.product.unit ? `/${it.product.unit}` : ""}</div>
                                    </div>
                                    <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700 }}>{money(it.product.price * it.qty)} ₴</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                                    <div style={{ display: "flex", alignItems: "center", border: `1px solid ${t.line}`, borderRadius: 10, height: 34, flex: 1, maxWidth: 140 }}>
                                        <button onClick={() => updateQty(idx, -1)} style={{ width: 36, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
                                            <MIcon name="minus" size={14} color={t.ink} w={2} />
                                        </button>
                                        <div style={{ flex: 1, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700 }}>{it.qty}</div>
                                        <button onClick={() => updateQty(idx, 1)} style={{ width: 36, height: 34, background: t.btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0", border: "none", cursor: "pointer" }}>
                                            <MIcon name="plus" size={14} color="#fff" w={2} />
                                        </button>
                                    </div>
                                    <div style={{ flex: 1, fontSize: 11, color: t.inkMuted }}>×{it.qty}{it.product.unit ? ` ${it.product.unit}` : ""}</div>
                                    <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }}>
                                        <MIcon name="trash" size={16} color={t.inkMuted} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </Card>
                )}
                <div style={{ height: 140 }} />
            </div>

            {/* Підсумок + відправка */}
            {orderItems.length > 0 && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.line}`, padding: "14px 16px max(16px, env(safe-area-inset-bottom))" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>До оплати</span>
                        <span style={{ fontFamily: F_NUM, fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{money(total)} ₴</span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={goToOrdersList} style={{ height: 50, padding: "0 18px", borderRadius: 12, border: `1px solid ${t.line}`, background: t.surface, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: t.ink, cursor: "pointer" }}>Зберегти</button>
                        <button onClick={send} disabled={loading} style={{ flex: 1, height: 50, borderRadius: 12, border: "none", background: t.btnBg, color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: loading ? "default" : "pointer" }}>
                            {loading ? <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 1s linear infinite" }} /> : <MIcon name="send" size={16} color="#fff" />}
                            Відправити замовлення
                        </button>
                    </div>
                </div>
            )}

            {/* Вибір контрагента */}
            {showCustPicker && (
                <div onClick={() => setShowCustPicker(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "0 auto 16px" }} />
                        <div style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Оберіть контрагента</div>
                        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                            {customers.map(c => {
                                const on = customer?.id === c.id;
                                return (
                                    <div key={c.id} onClick={() => { setCustomer(c); setIsDirty(true); setShowCustPicker(false); }} style={{ padding: "12px 8px", borderBottom: `1px solid ${t.lineSoft}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                                        <MIcon name="building" size={18} color={on ? t.accent : t.inkMuted} />
                                        <span style={{ flex: 1, fontSize: 14, fontWeight: on ? 700 : 500 }}>{c.name}</span>
                                        {on && <MIcon name="check" size={16} color={t.accent} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <Snackbar msg={snack} t={t} />
        </div>
    );
};
