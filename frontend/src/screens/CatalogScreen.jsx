import React, { useState, useMemo } from 'react';
import { MIcon, Card, F_NUM, ProductImage } from '../components/ui';

// ─── Побудова дерева з пласких categories (parentId) + products (categoryId) ───
function buildTree(categories, products) {
    const byId = new Map();
    (categories || []).forEach(c => byId.set(c.id, { id: c.id, name: c.name, parentId: c.parentId || "", children: [], products: [] }));
    const roots = [];
    byId.forEach(node => {
        if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
        else roots.push(node);
    });
    const orphans = [];
    (products || []).forEach(p => {
        const node = p.categoryId && byId.has(p.categoryId) ? byId.get(p.categoryId) : null;
        if (node) node.products.push(p); else orphans.push(p);
    });
    return { id: "", name: "Каталог", children: roots, products: orphans };
}
const countProducts = (node) => {
    let n = node.products ? node.products.length : 0;
    if (node.children) node.children.forEach(c => { n += countProducts(c); });
    return n;
};
const getNode = (root, path) => {
    let node = root;
    for (const id of path) {
        const next = (node.children || []).find(c => c.id === id);
        if (!next) break; node = next;
    }
    return node;
};
const flattenProducts = (node, trail = []) => {
    let out = [];
    if (node.products) node.products.forEach(p => out.push({ ...p, trail }));
    if (node.children) node.children.forEach(c => { out = out.concat(flattenProducts(c, [...trail, c.name])); });
    return out;
};
const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Рядок товару з інлайн-степпером ──────────────────────────────────────────
const ProductRow = ({ t, p, qty, onAdd }) => {
    const out = Number(p.stock) <= 0;
    const low = !out && Number(p.stock) < 5;
    const stockColor = out ? t.err : low ? t.warn : t.ok;
    const stockLabel = out ? "немає" : `${p.stock}`;
    return (
        <Card t={t} style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <ProductImage t={t} img={p.img} sku={p.sku} size={56} radius={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    {p.trail && p.trail.length > 0 && (
                        <div style={{ fontSize: 10.5, color: t.inkMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.trail.join(" › ")}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <span style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{money(p.price)}</span>
                        <span style={{ fontSize: 11, color: t.inkMuted }}>₴{p.unit ? ` / ${p.unit}` : ""}</span>
                        <span style={{ fontFamily: F_NUM, fontSize: 11, color: stockColor, fontWeight: 600, marginLeft: "auto" }}>{stockLabel}</span>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${qty > 0 ? t.ink : t.line}`, borderRadius: 10, height: 36, flexShrink: 0, opacity: out ? 0.4 : 1 }}>
                    <button disabled={out || qty <= 0} onClick={() => onAdd(p, -1)} style={{ width: 32, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: qty > 0 ? "pointer" : "default" }}>
                        <MIcon name="minus" size={15} color={qty > 0 ? t.ink : t.inkMuted} w={2} />
                    </button>
                    <div style={{ width: 28, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: qty > 0 ? t.ink : t.inkMuted }}>{qty}</div>
                    <button disabled={out} onClick={() => onAdd(p, 1)} style={{ width: 32, height: 36, background: t.btnBg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0", border: "none", cursor: out ? "default" : "pointer" }}>
                        <MIcon name="plus" size={15} color="#fff" w={2} />
                    </button>
                </div>
            </div>
        </Card>
    );
};

const GroupRow = ({ t, node, onOpen }) => {
    const subCount = node.children ? node.children.length : 0;
    const prodCount = countProducts(node);
    return (
        <Card t={t} style={{ padding: 12, marginBottom: 8, cursor: "pointer" }}>
            <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MIcon name="folder" size={22} color={t.accentInk} w={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{node.name}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 2 }}>
                        {subCount > 0 && <span>{subCount} підгруп · </span>}
                        <span style={{ fontFamily: F_NUM }}>{prodCount}</span> товарів
                    </div>
                </div>
                <MIcon name="chevron" size={18} color={t.inkMuted} />
            </div>
        </Card>
    );
};

export const CatalogScreen = ({ t, onNav, products, categories, onAddToOrder, orderItems = [], editOrderId, editCustomer, isOnline }) => {
    const [path, setPath] = useState([]);
    const [query, setQuery] = useState("");

    const root = useMemo(() => buildTree(categories, products), [categories, products]);
    const node = getNode(root, path);
    const subgroups = node.children || [];
    const levelProducts = node.products || [];

    const crumbs = [{ name: "Каталог", path: [] }];
    let acc = root;
    for (let i = 0; i < path.length; i++) {
        const next = (acc.children || []).find(c => c.id === path[i]);
        if (!next) break; acc = next;
        crumbs.push({ name: acc.name, path: path.slice(0, i + 1) });
    }

    const searching = query.trim().length > 0;
    const results = useMemo(() => searching
        ? flattenProducts(root).filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.sku || "").toLowerCase().includes(query.toLowerCase()))
        : [], [searching, query, root]);

    const qtyOf = (p) => orderItems.find(it => it.product.id === p.id)?.qty || 0;
    const cartCount = orderItems.length;
    const cartTotal = orderItems.reduce((s, it) => s + (Number(it.product.price) || 0) * it.qty, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Шапка */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 12px", background: t.bg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Каталог</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginRight: 44 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MIcon name="barcode" size={18} color={t.ink} />
                        </div>
                        <button onClick={() => onNav("orders", { keepOrder: true })} style={{ padding: "0 12px", height: 38, borderRadius: 12, background: t.accent, color: "#fff", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            <MIcon name="cart" size={16} color="#fff" /> {cartCount}
                        </button>
                    </div>
                </div>

                {/* Пошук по всьому дереву */}
                <div style={{ background: t.surface, border: `1px solid ${searching ? t.accent : t.line}`, borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                    <MIcon name="search" size={18} color={searching ? t.accent : t.inkMuted} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук по всьому каталогу…"
                        style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "inherit", fontSize: 14, color: t.ink }} />
                    {searching && <div onClick={() => setQuery("")} style={{ cursor: "pointer", display: "flex" }}><MIcon name="x" size={17} color={t.inkMuted} /></div>}
                </div>

                {/* Контекст замовлення */}
                {(editCustomer || editOrderId) && (
                    <div onClick={() => onNav("orders", { keepOrder: true })} style={{ marginTop: 10, background: t.accentSoft, border: `1px solid ${t.accent}22`, borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <MIcon name="cart" size={16} color={t.accentInk} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.accentInk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editOrderId ? `Замовлення ${editOrderId} (Чернетка)` : "Нове замовлення (Чернетка)"}</div>
                            {editCustomer?.name && <div style={{ fontSize: 11.5, color: t.accentInk, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{editCustomer.name}</div>}
                        </div>
                    </div>
                )}

                {/* Хлібні крихти */}
                {!searching && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 12, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
                        {crumbs.map((c, i) => {
                            const isLast = i === crumbs.length - 1;
                            return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                                    {i > 0 && <div style={{ color: t.inkMuted, padding: "0 2px", display: "flex" }}><MIcon name="chevron" size={13} color={t.inkMuted} /></div>}
                                    <div onClick={() => !isLast && setPath(c.path)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: isLast ? "default" : "pointer", padding: "4px 8px", borderRadius: 8, background: isLast ? t.btnBg : "transparent", color: isLast ? "#fff" : t.accent, fontSize: 12.5, fontWeight: isLast ? 700 : 600 }}>
                                        {i === 0 && <MIcon name="home" size={13} color={isLast ? "#fff" : t.accent} />}
                                        {c.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Тіло */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
                {searching ? (
                    <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "4px 4px 8px" }}>Знайдено: {results.length}</div>
                        {results.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "48px 20px", color: t.inkMuted }}>
                                <MIcon name="search" size={36} color={t.line} />
                                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Нічого не знайдено</div>
                            </div>
                        ) : results.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} qty={qtyOf(p)} onAdd={onAddToOrder} />)}
                    </>
                ) : (
                    <>
                        {subgroups.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "2px 4px 8px" }}>Підгрупи · {subgroups.length}</div>
                                {subgroups.map(g => <GroupRow key={g.id} t={t} node={g} onOpen={() => setPath([...path, g.id])} />)}
                            </>
                        )}
                        {levelProducts.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: `${subgroups.length > 0 ? 18 : 2}px 4px 8px` }}>Товари · {levelProducts.length}</div>
                                {levelProducts.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} qty={qtyOf(p)} onAdd={onAddToOrder} />)}
                            </>
                        )}
                        {subgroups.length === 0 && levelProducts.length === 0 && (
                            <div style={{ textAlign: "center", padding: "48px 20px", color: t.inkMuted }}>
                                <MIcon name="grid" size={36} color={t.line} />
                                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Порожньо</div>
                            </div>
                        )}
                    </>
                )}
                <div style={{ height: cartCount > 0 ? 96 : 16 }} />
            </div>

            {/* Плаваюча смуга «До замовлення» */}
            {cartCount > 0 && (
                <div style={{ position: "absolute", bottom: 12, left: 16, right: 16 }}>
                    <button onClick={() => onNav("orders", { keepOrder: true })} style={{ width: "100%", background: t.invBg, color: "#fff", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <MIcon name="cart" size={18} color="#fff" />
                            <div style={{ textAlign: "left" }}>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>{cartCount} {cartCount === 1 ? "позиція" : "позицій"}</div>
                                <div style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{money(cartTotal)} ₴</div>
                            </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>До замовлення →</div>
                    </button>
                </div>
            )}
        </div>
    );
};
