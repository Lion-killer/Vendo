import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MIcon, Card, F_NUM, ProductImage, ScrollRow, ListPlaceholder, TOP_ACTIONS_W, QtyInput } from '../components/ui';
import { fmtMoney, fmtDate, todayISO } from '../i18n';
import { scanBarcode } from '../api/scanner';

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
    return { id: "", name: "", children: roots, products: orphans };
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
const money = (n) => fmtMoney(n, { minimumFractionDigits: 2 });

// ─── Рядок товару з інлайн-степпером ──────────────────────────────────────────
const ProductRow = ({ t, p, qty, onAdd }) => {
    const { t: tr } = useTranslation();
    const out = Number(p.stock) <= 0;
    const low = !out && Number(p.stock) < 5;
    const stockColor = out ? t.err : low ? t.warn : t.ok;
    const stockLabel = out ? tr("catalog.outOfStock") : `${p.stock}`;
    return (
        <Card t={t} style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <ProductImage t={t} img={p.img} sku={p.sku} name={p.name} barcode={p.barcode} price={p.price} stock={p.stock} unit={p.unit} size={56} radius={10} />
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
                    {out
                        ? <div style={{ width: 28, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: t.inkMuted }}>{qty}</div>
                        : <QtyInput t={t} value={qty} onCommit={(v) => onAdd(p, v - qty)} min={0} width={40} fontSize={14} color={qty > 0 ? t.ink : t.inkMuted} />}
                    <button disabled={out} onClick={() => onAdd(p, 1)} style={{ width: 32, height: 36, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0", border: "none", cursor: out ? "default" : "pointer" }}>
                        <MIcon name="plus" size={15} color="#fff" w={2} />
                    </button>
                </div>
            </div>
        </Card>
    );
};

const GroupRow = ({ t, node, onOpen }) => {
    const { t: tr } = useTranslation();
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
                        {subCount > 0 && <span>{subCount} {tr("catalog.subgroupsWord")} · </span>}
                        <span style={{ fontFamily: F_NUM }}>{prodCount}</span> {tr("catalog.productsWord")}
                    </div>
                </div>
                <MIcon name="chevron" size={18} color={t.inkMuted} />
            </div>
        </Card>
    );
};

export const CatalogScreen = ({ t, onNav, products, categories, onAddToOrder, orderItems = [], editOrderId, editNum, editDate, editCustomer, isOnline, notify, connecting, offsetTop = 0 }) => {
    const { t: tr } = useTranslation();
    const [path, setPath] = useState([]);
    const [query, setQuery] = useState("");

    const root = useMemo(() => buildTree(categories, products), [categories, products]);
    const node = getNode(root, path);
    const subgroups = node.children || [];
    const levelProducts = node.products || [];

    const crumbs = [{ name: tr("catalog.root"), path: [] }];
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

    // Сканування штрихкоду товару: знайти за barcode/артикулом/id і додати в замовлення.
    const handleScan = async () => {
        let code;
        try { code = await scanBarcode(); }
        catch (e) { notify?.(tr("common.scannerError")); return; }
        if (!code) return; // скасовано
        const norm = code.trim().toLowerCase();
        const found = (products || []).find(p =>
            [p.barcode, p.sku, p.id].filter(Boolean).some(v => String(v).toLowerCase() === norm));
        if (found) { onAddToOrder(found, 1); notify?.(tr("catalog.added", { name: found.name })); }
        else notify?.(tr("catalog.barcodeNotFound", { code }));
    };

    const cartCount = orderItems.length;
    const cartTotal = orderItems.reduce((s, it) => s + (Number(it.product.price) || 0) * it.qty, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Власні дії каталогу — фіксований кластер ліворуч від глобального TopActions.
                Вирівняні через спільний TOP_ACTIONS_W; обидва зсуваються на offsetTop під
                банером помилки. Жодного резервування місця в потоці шапки. */}
            <div style={{ position: "fixed", top: `calc(max(16px, env(safe-area-inset-top)) + ${offsetTop}px)`, right: TOP_ACTIONS_W + 24, zIndex: 1500, display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={handleScan} aria-label="Сканувати штрихкод" style={{ width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" }}>
                    <MIcon name="barcode" size={18} color={t.ink} />
                </button>
                <button onClick={() => onNav("orders", { keepOrder: true })} style={{ padding: "0 12px", height: 38, borderRadius: 12, background: t.accent, color: "#fff", display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    <MIcon name="cart" size={16} color="#fff" /> {cartCount}
                </button>
            </div>

            {/* Шапка */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 12px", background: t.bg }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 22, height: 38 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>{tr("nav.catalog")}</div>
                </div>

                {/* Пошук по всьому дереву */}
                <div style={{ background: t.surface, border: `1px solid ${searching ? t.accent : t.line}`, borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                    <MIcon name="search" size={18} color={searching ? t.accent : t.inkMuted} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr("catalog.searchPlaceholder")}
                        style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "inherit", fontSize: 14, color: t.ink }} />
                    {searching && <div onClick={() => setQuery("")} style={{ cursor: "pointer", display: "flex" }}><MIcon name="x" size={17} color={t.inkMuted} /></div>}
                </div>

                {/* Контекст замовлення */}
                {(editCustomer || editOrderId) && (
                    <div onClick={() => onNav("orders", { keepOrder: true })} style={{ marginTop: 10, background: t.accentSoft, border: `1px solid ${t.accent}22`, borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <MIcon name="cart" size={16} color={t.accentInk} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.accentInk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{editNum ? `${tr("catalog.orderCtx", { id: editNum })} · ${fmtDate(editDate || todayISO())}` : tr("dashboard.newOrder")}</div>
                            {editCustomer?.name && <div style={{ fontSize: 11.5, color: t.accentInk, fontWeight: 600, opacity: 0.85, marginTop: 2 }}>{editCustomer.name}</div>}
                        </div>
                    </div>
                )}

                {/* Хлібні крихти */}
                {!searching && (
                    <ScrollRow fade={t.bg} gap={2} stickEnd={path} style={{ marginTop: 12, paddingBottom: 2 }}>
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
                    </ScrollRow>
                )}
            </div>

            {/* Тіло */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
                {searching ? (
                    <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "4px 4px 8px" }}>{tr("catalog.found", { count: results.length })}</div>
                        {results.length === 0 ? (
                            <ListPlaceholder loading={connecting && (products || []).length === 0} t={t}>
                                <MIcon name="search" size={36} color={t.line} />
                                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{tr("common.nothing")}</div>
                            </ListPlaceholder>
                        ) : results.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} qty={qtyOf(p)} onAdd={onAddToOrder} />)}
                    </>
                ) : (
                    <>
                        {subgroups.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "2px 4px 8px" }}>{tr("catalog.subgroups")} · {subgroups.length}</div>
                                {subgroups.map(g => <GroupRow key={g.id} t={t} node={g} onOpen={() => setPath([...path, g.id])} />)}
                            </>
                        )}
                        {levelProducts.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: `${subgroups.length > 0 ? 18 : 2}px 4px 8px` }}>{tr("catalog.products")} · {levelProducts.length}</div>
                                {levelProducts.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} qty={qtyOf(p)} onAdd={onAddToOrder} />)}
                            </>
                        )}
                        {subgroups.length === 0 && levelProducts.length === 0 && (
                            <ListPlaceholder loading={connecting && (products || []).length === 0} t={t}>
                                <MIcon name="grid" size={36} color={t.line} />
                                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{tr("catalog.empty")}</div>
                            </ListPlaceholder>
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
                                <div style={{ fontSize: 11, opacity: 0.6 }}>{tr("catalog.positions", { count: cartCount })}</div>
                                <div style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{money(cartTotal)} ₴</div>
                            </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{tr("catalog.toOrder")}</div>
                    </button>
                </div>
            )}
        </div>
    );
};
