import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { Badge, Snackbar } from '../components/Shared';

export const CatalogScreen = ({ t, onNav, products, categories, onAddToOrder, orderItemsCount = 0, editOrderId, editCustomer }) => {
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState(new Set([1]));
    const [selected, setSelected] = useState(null);
    const [snack, setSnack] = useState("");
    const snackTimeoutRef = useRef(null);

    useEffect(() => {
        return () => {
            if (snackTimeoutRef.current) {
                clearTimeout(snackTimeoutRef.current);
            }
        };
    }, []);

    const toggle = (id) => {
        const s = new Set(expanded);
        s.has(id) ? s.delete(id) : s.add(id);
        setExpanded(s);
    };

    const filtered = search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())) : null;

    if (selected) return <ProductDetailScreen t={t} product={selected} onBack={() => setSelected(null)} onAdd={(p, q) => {
        onAddToOrder(p, q);
        setSelected(null);
        onNav("orders");
    }} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "env(safe-area-inset-top)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ background: t.surface, padding: "16px 16px 0", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800, margin: 0 }}>Номенклатура</h2>
                    {orderItemsCount > 0 && (
                        <button onClick={() => onNav("orders")} style={{ background: t.primary + "15", border: "none", padding: "6px 12px", borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: t.primary }}>
                            <Icon name="cart" size={18} color={t.primary} />
                            <span style={{ fontSize: 12, fontWeight: 800 }}>{orderItemsCount}</span>
                        </button>
                    )}
                </div>
                <div style={{ background: t.surfaceVariant, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Icon name="search" size={18} color={t.textMuted} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук товару..." style={{ flex: 1, border: "none", background: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit", fontWeight: 500 }} />
                    {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 18, lineHeight: 1 }}>×</button>}
                </div>
                {/* Current order info */}
                <div style={{ paddingBottom: 12, display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary, whiteSpace: "nowrap" }}>Додаємо в:</span>
                    <span style={{ background: t.chip, color: t.primary, padding: "6px 14px", borderRadius: 14, fontSize: 13, fontWeight: 800, flex: 1, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {editOrderId ? `Зам. №${editOrderId} - ${editCustomer?.name || 'Клієнт'}` : (editCustomer ? `Нове зам. - ${editCustomer.name}` : `Нове замовлення`)}
                    </span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {filtered ? (
                    <div style={{ padding: "0 12px" }}>
                        {filtered.map(p => <ProductRow key={p.id} p={p} t={t} onSelect={() => setSelected(p)} />)}
                        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "40px 20px", color: t.textMuted }}>
                            <Icon name="search" size={40} color={t.border} />
                            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>Нічого не знайдено</p>
                        </div>}
                    </div>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id}>
                            <button onClick={() => toggle(cat.id)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit" }}>
                                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                                <span style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: 700, textAlign: "left" }}>{cat.name}</span>
                                <span style={{ background: t.chip, color: t.chipText, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, marginRight: 6 }}>{cat.count}</span>
                                <Icon name={expanded.has(cat.id) ? "chevronDown" : "chevronRight"} size={18} color={t.textMuted} />
                            </button>
                            {expanded.has(cat.id) && (
                                <div style={{ padding: "0 12px 8px" }}>
                                    {products.filter(p => p.category === cat.name).map(p => <ProductRow key={p.id} p={p} t={t} onSelect={() => setSelected(p)} />)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <Snackbar msg={snack} t={t} />
        </div>
    );
};

const ProductRow = ({ p, t, onSelect }) => (
    <div onClick={onSelect} style={{ background: t.surface, borderRadius: 16, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: t.surfaceVariant, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{p.img}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: t.text, fontSize: 13, fontWeight: 700, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
            <p style={{ color: t.textMuted, fontSize: 11, margin: "0 0 5px", fontWeight: 500 }}>Арт: {p.sku}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: t.primary, fontSize: 14, fontWeight: 800 }}>{p.price.toFixed(2)} ₴</span>
                <Badge stock={p.stock} t={t} />
            </div>
        </div>
        <Icon name="chevronRight" size={18} color={t.textMuted} />
    </div>
);

const ProductDetailScreen = ({ t, product, onBack, onAdd }) => {
    const [qty, setQty] = useState(1);
    const [priceType, setPriceType] = useState(0);
    const prices = ["Роздрібна", "Дрібнооптова", "Оптова"];
    const priceVals = [product.price, product.price * 0.92, product.price * 0.85];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "env(safe-area-inset-top)", overflow: "hidden" }}>
            {/* Header image area */}
            <div style={{ background: `linear-gradient(160deg, ${t.primary}22 0%, ${t.surfaceVariant} 100%)`, padding: "16px 20px 0", position: "relative" }}>
                <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 12, background: t.surface, border: `1px solid ${t.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Icon name="chevronLeft" size={20} color={t.text} />
                </button>
                <div style={{ width: "100%", height: 180, background: t.surface, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, marginBottom: 0, border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                    {product.img}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0", paddingBottom: "20px" }}>
                {/* Title */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800, margin: 0, flex: 1, lineHeight: 1.3 }}>{product.name}</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <span style={{ background: t.chip, color: t.chipText, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 10 }}>Арт: {product.sku}</span>
                    <Badge stock={product.stock} t={t} />
                </div>

                {/* Price type selector */}
                <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase", marginBottom: 8 }}>Тип ціни</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                    {prices.map((p, i) => (
                        <button key={i} onClick={() => setPriceType(i)} style={{ flex: 1, padding: "8px 4px", borderRadius: 12, border: `1.5px solid ${priceType === i ? t.primary : t.border}`, background: priceType === i ? t.chip : "none", cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                            <p style={{ color: priceType === i ? t.primary : t.textSecondary, fontSize: 10, fontWeight: 700, margin: "0 0 3px" }}>{p}</p>
                            <p style={{ color: priceType === i ? t.primary : t.text, fontSize: 13, fontWeight: 800, margin: 0 }}>{priceVals[i].toFixed(2)} ₴</p>
                        </button>
                    ))}
                </div>

                {/* Qty */}
                <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase", marginBottom: 8 }}>Кількість</p>
                <div style={{ display: "flex", alignItems: "center", gap: 0, background: t.surfaceVariant, borderRadius: 16, padding: 4, marginBottom: 20 }}>
                    <button onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 48, height: 48, borderRadius: 13, background: qty === 1 ? t.border : t.surface, border: "none", cursor: qty === 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: qty > 1 ? t.cardShadow : "none", transition: "all .2s" }}>
                        <Icon name="minus" size={20} color={qty === 1 ? t.textMuted : t.primary} />
                    </button>
                    <span style={{ flex: 1, textAlign: "center", color: t.text, fontSize: 24, fontWeight: 800 }}>{qty}</span>
                    <button onClick={() => setQty(qty + 1)} style={{ width: 48, height: 48, borderRadius: 13, background: t.primary, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${t.primary}44` }}>
                        <Icon name="plus" size={20} color="#fff" />
                    </button>
                </div>

                {/* Summary */}
                <div style={{ background: t.surfaceVariant, borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: t.textSecondary, fontSize: 13, fontWeight: 600 }}>Сума:</span>
                    <span style={{ color: t.primary, fontSize: 22, fontWeight: 900 }}>{(priceVals[priceType] * qty).toFixed(2)} ₴</span>
                </div>
            </div>

            <div style={{ padding: "12px 20px 20px", background: t.bg, borderTop: `1px solid ${t.border}` }}>
                <button onClick={() => onAdd(product, qty)} style={{ width: "100%", height: 54, borderRadius: 16, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 4px 20px ${t.primary}44`, fontFamily: "inherit" }}>
                    <Icon name="cart" size={20} color="#fff" />
                    <span style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: .3 }}>Додати до замовлення</span>
                </button>
            </div>
        </div>
    );
};
