import React, { useState, useEffect } from 'react';
import { MIcon, Card, F_NUM, ProductImage } from '../components/ui';
import { saveLocalOrder, removeLocalOrder, getLocalOrder } from '../api/localOrders';
import { restoreOrder, deleteOrder } from '../api/client';
import { idSet } from '../api/refs';

const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export const OrderScreen = ({ t, isOnline, locked = false, date = null, status = "Нове", num = null, baseVersion = null, pushDate, notify, onCopy, markHandled, orderItems, setOrderItems, customers, products = [], refreshOrders, editOrderId, setEditOrderId, editCustomer, setEditCustomer, goToOrdersList, goToCatalog }) => {
    // Лейбл: номер документа, якщо є; інакше короткий №<id>.
    const orderLabel = (o) => (o && o.num) ? o.num : (o && o.id ? `№${String(o.id).slice(0, 8)}` : "");
    // Набір GUID наявних товарів — для позначення «зниклих» позицій (видалених на бекенді).
    const prodIds = idSet(products);
    const productMissing = (p) => products.length > 0 && p?.id != null && !prodIds.has(p.id);
    const customerMissing = !!(customers.length > 0 && editCustomer?.id && !idSet(customers).has(editCustomer.id));
    // Конфлікт: серверну версію змінили після наших правок (позначено під час doSync).
    const conflicted = !!(editOrderId && getLocalOrder(editOrderId)?.conflict);
    const statusColor = status === "Видалено" ? t.err : status === "Проведено" ? t.inkSoft : status === "Відправлено" ? t.ok : t.warn;
    const customer = editCustomer; // без фолбеку: не вибрано — показуємо плейсхолдер
    const setCustomer = setEditCustomer;
    const [showCustPicker, setShowCustPicker] = useState(false);
    const [custQuery, setCustQuery] = useState("");
    const [showMenu, setShowMenu] = useState(false);

    // Пошук контрагента по назві / адресі / телефону / коду (для великих списків).
    const custQ = custQuery.trim().toLowerCase();
    const filteredCustomers = custQ
        ? customers.filter(c => [c.name, c.address, c.phone, c.code].filter(Boolean).join(" ").toLowerCase().includes(custQ))
        : customers;
    const closeCustPicker = () => { setShowCustPicker(false); setCustQuery(""); };
    const [isDirty, setIsDirty] = useState(false);
    const [orderDate, setOrderDate] = useState(date || todayISO());

    const isMounted = React.useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    // Синхронізуємо дату при відкритті іншого замовлення (prop змінюється без розмонтування).
    useEffect(() => { setOrderDate(date || todayISO()); }, [date]);

    const updateQty = (idx, delta) => {
        const next = [...orderItems];
        next[idx] = { ...next[idx], qty: Math.max(1, next[idx].qty + delta) };
        setOrderItems(next);
        setIsDirty(true);
    };
    const removeItem = (idx) => { setOrderItems(orderItems.filter((_, i) => i !== idx)); setIsDirty(true); };
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);
    const debt = Number(customer?.debt) || 0;

    // Автозбереження невідправленого замовлення (проведене не чіпаємо — лише перегляд)
    useEffect(() => {
        if (locked || orderItems.length === 0 || !isDirty) return;
        try {
            // Правка відправленого замовлення лишається "Відправлено" (черга на оновлення);
            // нове — "Нове". doSync зробить upsert із цим статусом.
            const queueStatus = status === "Відправлено" ? "Відправлено" : "Нове";
            const orderData = {
                id: editOrderId || undefined,
                num: num || undefined,
                customer: customer || null,
                customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт",
                items: orderItems,
                date: orderDate,
                total: `${money(total)} ₴`,
                status: queueStatus,
                sColor: queueStatus === "Відправлено" ? t.ok : t.warn,
                baseVersion: queueStatus === "Відправлено" ? baseVersion : undefined,
            };
            const localId = saveLocalOrder(orderData);
            if (localId !== editOrderId) setEditOrderId(localId);
        } catch (e) { console.error("Помилка автозбереження:", e); }
    }, [orderItems, customer, editOrderId, orderDate, isOnline]);

    // Явне збереження (кнопка «Зберегти») — не залежить від isDirty, тож працює
    // і коли товари додані з каталогу (минаючи зміни безпосередньо в цьому екрані).
    const saveDraft = () => {
        if (!locked && orderItems.length > 0) {
            const queueStatus = status === "Відправлено" ? "Відправлено" : "Нове";
            const savedId = saveLocalOrder({
                id: editOrderId || undefined, num: num || undefined, customer: customer || null, customerId: customer?.id || null,
                client: customer?.name || "Невідомий клієнт", items: orderItems, date: orderDate,
                total: `${money(total)} ₴`, status: queueStatus, sColor: queueStatus === "Відправлено" ? t.ok : t.warn,
                baseVersion: queueStatus === "Відправлено" ? baseVersion : undefined,
            });
            markHandled?.(); // App не дублюватиме збереження на виході
            notify?.(`Збережено ${orderLabel({ num, id: savedId })} · ${orderDate.split("-").reverse().join(".")}`);
        }
        if (isMounted.current) setOrderItems([]);
        if (goToOrdersList) goToOrdersList();
    };

    // Команда «Скопіювати» — копія в нове замовлення (товари/контрагент лишаються).
    const handleCopy = () => {
        setShowMenu(false);
        onCopy?.();
    };

    // Команда «Видалити»: "Нове" → видаляємо локально; "Відправлено" → помітка на видалення;
    // "Проведено"/"Видалено" — недоступно.
    const handleDeleteOrder = async () => {
        setShowMenu(false);
        if (status === "Проведено" || status === "Видалено") return;
        const isNew = status === "Нове";
        try {
            if (isNew) {
                if (editOrderId) removeLocalOrder(editOrderId);
            } else if (!isOnline) {
                // Офлайн: ставимо видалення в чергу (op:'delete') — doSync виконає при синхронізації.
                saveLocalOrder({
                    id: editOrderId, num: num || undefined, op: 'delete', status: 'Видалено',
                    customer: customer || null, customerId: customer?.id || null,
                    client: customer?.name || "Невідомий клієнт", items: orderItems, date: orderDate,
                    total: `${money(total)} ₴`, sColor: t.err,
                });
            } else {
                await deleteOrder(editOrderId); // бекенд/1С ставлять помітку на видалення
            }
            markHandled?.();
            if (isMounted.current) setOrderItems([]);
            refreshOrders?.();
            notify?.(isNew ? `Видалено ${orderLabel({ num, id: editOrderId })}`
                : !isOnline ? `Видалення в черзі (офлайн) · ${orderLabel({ num, id: editOrderId })}`
                : `Помічено на видалення ${orderLabel({ num, id: editOrderId })}`);
            if (goToOrdersList) goToOrdersList();
        } catch (e) {
            notify?.("Не вдалося видалити");
        }
    };

    // Команда «Зняти помітку видалення» — лише для статусу "Видалено".
    const handleUnmark = async () => {
        setShowMenu(false);
        if (status !== "Видалено" || !editOrderId) return;
        try {
            await restoreOrder(editOrderId);
            markHandled?.();
            refreshOrders?.();
            notify?.(`Помітку знято · ${orderLabel({ num, id: editOrderId })}`);
            if (goToOrdersList) goToOrdersList();
        } catch (e) {
            notify?.("Не вдалося зняти помітку");
        }
    };

    // Розв'язання конфлікту: «перезаписати моє» — гасимо базу версії й помилку, наступна
    // синхронізація перезапише сервер (force); «взяти серверне» — викидаємо локальну правку.
    const resolveOverwrite = () => {
        saveLocalOrder({ id: editOrderId, baseVersion: null, conflict: false, syncError: "" });
        markHandled?.();
        notify?.("Ваша версія перезапише сервер при наступній синхронізації");
        if (goToOrdersList) goToOrdersList();
    };
    const resolveTakeServer = () => {
        removeLocalOrder(editOrderId);
        markHandled?.();
        refreshOrders?.();
        notify?.("Взято серверну версію");
        if (goToOrdersList) goToOrdersList();
    };

    // Підпис біля заголовка: номер документа або №<id> для автозбереженого; для зовсім
    // нового — порожньо (заголовок «Замовлення» вже все каже).
    const subLabel = num || (editOrderId ? `№${String(editOrderId).slice(0, 8)}` : "");

    // Дата замовлення (YYYY-MM-DD → DD.MM.YYYY) для режиму перегляду.
    const displayDate = orderDate.split("-").reverse().join(".");

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Шапка — компактна (максимум місця під позиції) */}
            <div style={{ padding: "max(12px, env(safe-area-inset-top)) 16px 8px" }}>
                {/* Рядок 1: назад + статус */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <button onClick={goToOrdersList} style={{ width: 36, height: 36, borderRadius: 11, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <MIcon name="back" size={18} color={t.ink} />
                    </button>
                    <div style={{ background: statusColor + "22", padding: "5px 9px", borderRadius: 8, fontSize: 10.5, fontWeight: 700, color: statusColor, letterSpacing: 0.4 }}>● {String(status).toUpperCase()}</div>
                </div>
                {/* Рядок 2: заголовок + номер + дата + меню — в одну стрічку */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
                        <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: -0.4 }}>Замовлення</div>
                        {subLabel && <span style={{ fontFamily: F_NUM, fontSize: 11.5, color: t.inkMuted, fontWeight: 600, letterSpacing: 0.3 }}>{subLabel}</span>}
                    </div>
                    <div style={{ flex: 1 }} />
                    {locked
                        ? <span style={{ fontFamily: F_NUM, fontSize: 11.5, color: t.inkMuted }}>{displayDate}</span>
                        : <input type="date" value={orderDate} onChange={e => { setOrderDate(e.target.value); pushDate?.(e.target.value); setIsDirty(true); }}
                            style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 8, padding: "4px 8px", fontSize: 11, color: t.ink, fontFamily: "inherit", outline: "none" }} />}
                    <button onClick={() => setShowMenu(true)} style={{ width: 34, height: 34, borderRadius: 10, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        <MIcon name="more" size={18} color={t.ink} />
                    </button>
                </div>
            </div>

            {/* Меню команд замовлення (kebab) */}
            {showMenu && (
                <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "12px 12px max(16px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "4px auto 12px" }} />
                        <button onClick={handleCopy} style={{ width: "100%", height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: "none", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: t.ink, textAlign: "left" }}>
                            <MIcon name="doc" size={20} color={t.ink} /> Скопіювати
                        </button>
                        <button onClick={handleUnmark} disabled={status !== "Видалено"} style={{ width: "100%", height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: "none", border: "none", borderRadius: 12, cursor: status === "Видалено" ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: status === "Видалено" ? t.ink : t.inkMuted, textAlign: "left", opacity: status === "Видалено" ? 1 : 0.5 }}>
                            <MIcon name="check" size={20} color={status === "Видалено" ? t.ink : t.inkMuted} /> Зняти помітку видалення
                        </button>
                        {(() => {
                            const canDelete = status === "Нове" || status === "Відправлено";
                            return (
                                <button onClick={handleDeleteOrder} disabled={!canDelete} style={{ width: "100%", height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", background: "none", border: "none", borderRadius: 12, cursor: canDelete ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: canDelete ? t.err : t.inkMuted, textAlign: "left", opacity: canDelete ? 1 : 0.5 }}>
                                    <MIcon name="trash" size={20} color={canDelete ? t.err : t.inkMuted} /> {status === "Нове" ? "Видалити" : "Помітити на видалення"}
                                </button>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Банер конфлікту синхронізації */}
            {conflicted && (
                <div style={{ margin: "0 16px 12px", padding: "12px 14px", background: t.errSoft, border: `1px solid ${t.err}44`, borderRadius: 12 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ flexShrink: 0, marginTop: 1, display: "flex" }}><MIcon name="bell" size={15} color={t.err} /></div>
                        <div style={{ fontSize: 12.5, color: t.err, fontWeight: 600, lineHeight: 1.4 }}>Замовлення змінили на сервері після ваших правок. Оберіть, яку версію лишити.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button onClick={resolveOverwrite} style={{ flex: 1, height: 38, borderRadius: 10, background: t.err, color: "#fff", border: "none", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Перезаписати моє</button>
                        <button onClick={resolveTakeServer} style={{ flex: 1, height: 38, borderRadius: 10, background: t.surface, color: t.ink, border: `1px solid ${t.line}`, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Взяти серверне</button>
                    </div>
                </div>
            )}

            {/* Клієнт */}
            <div style={{ padding: "0 16px" }}>
                <Card t={t} style={{ padding: 14 }}>
                    <button onClick={() => { if (!locked) setShowCustPicker(true); }} disabled={locked} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: locked ? "default" : "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <MIcon name="building" size={20} color={t.ink} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 700, color: customerMissing ? t.err : t.ink }}>{customer?.name || "Оберіть контрагента"}</div>
                            <div style={{ fontSize: 11.5, color: t.inkSoft, marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {customerMissing && <span style={{ color: t.err, fontWeight: 700 }}>клієнта видалено на сервері</span>}
                                {customer?.code && <span style={{ fontFamily: F_NUM }}>{customer.code}</span>}
                                {customer?.address && <><span style={{ color: t.line }}>·</span><span>{customer.address}</span></>}
                                {debt > 0 && <><span style={{ color: t.line }}>·</span><span style={{ color: t.err, fontWeight: 600 }}>борг {money(debt)} ₴</span></>}
                            </div>
                        </div>
                        {!locked && <MIcon name="chevron" size={18} color={t.inkMuted} />}
                    </button>
                </Card>
            </div>

            {/* Позиції */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 4px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>Позиції · {orderItems.length}</div>
                    {!locked && <div onClick={goToCatalog} style={{ fontSize: 12, color: t.accent, fontWeight: 600, cursor: "pointer" }}>+ Додати</div>}
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
                            <div key={idx} style={{ padding: "8px 12px", borderBottom: idx < orderItems.length - 1 ? `1px solid ${t.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                                <ProductImage t={t} img={it.product.img} sku={it.product.sku} size={32} radius={7} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: productMissing(it.product) ? t.err : t.ink }}>{it.product.name}{productMissing(it.product) ? " · недоступний" : ""}</div>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
                                        <div style={{ flex: 1, minWidth: 0, fontFamily: F_NUM, fontSize: 10.5, color: t.inkMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.product.sku} · {money(it.product.price)} ₴{it.product.unit ? `/${it.product.unit}` : ""}</div>
                                        <div style={{ flexShrink: 0, fontFamily: F_NUM, fontSize: 11, fontWeight: 700, color: t.ink, whiteSpace: "nowrap" }}>{money(it.product.price * it.qty)} ₴</div>
                                    </div>
                                </div>
                                {locked ? (
                                    <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: t.inkSoft, flexShrink: 0, minWidth: 28, textAlign: "right" }}>{it.qty}</div>
                                ) : (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${t.line}`, borderRadius: 9, height: 30, flexShrink: 0 }}>
                                            <button onClick={() => updateQty(idx, -1)} style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer" }}>
                                                <MIcon name="minus" size={13} color={t.ink} w={2} />
                                            </button>
                                            <div style={{ minWidth: 24, textAlign: "center", fontFamily: F_NUM, fontSize: 13.5, fontWeight: 700 }}>{it.qty}</div>
                                            <button onClick={() => updateQty(idx, 1)} style={{ width: 30, height: 30, background: t.btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 8px 8px 0", border: "none", cursor: "pointer" }}>
                                                <MIcon name="plus" size={13} color="#fff" w={2} />
                                            </button>
                                        </div>
                                        <button onClick={() => removeItem(idx)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", flexShrink: 0 }}>
                                            <MIcon name="trash" size={15} color={t.inkMuted} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </Card>
                )}
                <div style={{ height: 96 }} />
            </div>

            {/* Підсумок + збереження — в один рядок (компактна нижня панель) */}
            {!locked && orderItems.length > 0 && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.line}`, padding: "10px 16px max(12px, env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: t.inkMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>До оплати</div>
                        <div style={{ fontFamily: F_NUM, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.1 }}>{money(total)} ₴</div>
                    </div>
                    <button onClick={saveDraft} style={{ flex: 1, height: 46, borderRadius: 12, border: "none", background: t.accent, color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                        <MIcon name="check" size={16} color="#fff" w={2} /> Зберегти
                    </button>
                </div>
            )}

            {/* Проведене замовлення: підсумок без дій */}
            {locked && orderItems.length > 0 && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: t.surface, borderTop: `1px solid ${t.line}`, padding: "14px 16px max(16px, env(safe-area-inset-bottom))", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Сума</span>
                    <span style={{ fontFamily: F_NUM, fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{money(total)} ₴</span>
                </div>
            )}

            {/* Вибір контрагента */}
            {showCustPicker && (
                <div onClick={closeCustPicker} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "0 auto 16px" }} />
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 12px" }}>
                            <span style={{ fontSize: 16, fontWeight: 700 }}>Оберіть контрагента</span>
                            <span style={{ fontSize: 11, color: t.inkMuted, fontFamily: F_NUM }}>{filteredCustomers.length} із {customers.length}</span>
                        </div>
                        {/* Пошук по назві / адресі / телефону */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: t.surfaceMuted, border: `1px solid ${t.line}`, borderRadius: 12, marginBottom: 12 }}>
                            <MIcon name="search" size={18} color={t.inkMuted} />
                            <input autoFocus value={custQuery} onChange={e => setCustQuery(e.target.value)} placeholder="Назва, адреса, телефон…"
                                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", fontFamily: "inherit", fontSize: 14, color: t.ink }} />
                            {custQuery && <div onClick={() => setCustQuery("")} style={{ cursor: "pointer", display: "flex" }}><MIcon name="x" size={17} color={t.inkMuted} /></div>}
                        </div>
                        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
                            {filteredCustomers.length === 0 && (
                                <div style={{ padding: "24px 8px", textAlign: "center", color: t.inkMuted, fontSize: 13 }}>Нічого не знайдено</div>
                            )}
                            {filteredCustomers.map(c => {
                                const on = customer?.id === c.id;
                                const sub = [c.code, c.address, c.phone].filter(Boolean).join(" · ");
                                return (
                                    <div key={c.id} onClick={() => { setCustomer(c); setIsDirty(true); closeCustPicker(); }} style={{ padding: "11px 8px", borderBottom: `1px solid ${t.lineSoft}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                                        <MIcon name="building" size={18} color={on ? t.accent : t.inkMuted} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 14, fontWeight: on ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                                            {sub && <div style={{ fontSize: 11, color: t.inkMuted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
                                        </div>
                                        {on && <MIcon name="check" size={16} color={t.accent} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
