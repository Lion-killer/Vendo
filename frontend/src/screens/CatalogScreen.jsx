import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { registerBack } from '../backNav';
import { MIcon, Card, F_NUM, ProductImage, ScrollRow, ListPlaceholder, TOP_ACTIONS_W, QtyInput, SwipeReveal, SearchInput } from '../components/ui';
import { fmtMoney2, fmtDate, todayISO, curSymbol, DEFAULT_CURRENCY, byName } from '../i18n';
import { Z } from '../theme';
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

// Порядок товарів (#59 + #61): «без залишку — в кінець» первинний ключ, назва — вторинний.
// Тобто в межах кожної групи «в наявності»/«без залишку» товари йдуть за абеткою.
// Не мутуємо вихідний масив.
const sortProducts = (list) => list.slice().sort((a, b) =>
    (Number(a.stock) <= 0 ? 1 : 0) - (Number(b.stock) <= 0 ? 1 : 0) || byName(a, b));

// ─── Рядок товару з інлайн-степпером ──────────────────────────────────────────
const ProductRow = ({ t, p, price, qty, onAdd, priceTypes, activePriceType, ordered, recentQtys }) => {
    const { t: tr } = useTranslation();
    const noPrice = price == null; // тип вибрано, а ціни цього типу для товару немає
    const out = Number(p.stock) <= 0;
    const blocked = out || noPrice; // не можна додати: немає залишку або немає ціни
    const low = !out && Number(p.stock) < 5;
    const stockColor = out ? t.err : low ? t.warn : t.ok;
    const stockLabel = out ? tr("catalog.outOfStock") : `${p.stock}`;
    // #63: рядок «замовляного» товару, доступного до додавання, свайпається — відкриває
    // чіпи останніх кількостей цього контрагента (тап ставить кількість у поле).
    const swipeable = !blocked && recentQtys && recentQtys.length > 0;
    const row = (
        <Card t={t} style={{ padding: 12, marginBottom: 8, position: "relative" }}>
            {/* Зелена вертикальна смужка (#62) — товар цей контрагент уже замовляв. Абсолютна,
                в лівому полі картки → не забирає місця в рядка (як у замовленнях на головному). */}
            {ordered && <div title={tr("catalog.orderedBefore")} aria-label={tr("catalog.orderedBefore")} style={{ position: "absolute", left: 4, top: 8, bottom: 8, width: 4, background: t.ok, borderRadius: 2 }} />}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <ProductImage t={t} img={p.img} sku={p.sku} name={p.name} barcode={p.barcode} price={price} currency={p.currency} stock={p.stock} unit={p.unit} prices={p.prices} priceTypes={priceTypes} activePriceType={activePriceType} size={56} radius={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
                    {p.trail && p.trail.length > 0 && (
                        <div style={{ fontSize: 10.5, color: t.inkMuted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.trail.join(" › ")}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        {noPrice
                            ? <span style={{ fontSize: 12.5, fontWeight: 700, color: t.err }}>{tr("catalog.noPrice")}</span>
                            : <>
                                <span style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{fmtMoney2(price)}</span>
                                <span style={{ fontSize: 11, color: t.inkMuted }}>{curSymbol(p.currency)}{p.unit ? ` / ${p.unit}` : ""}</span>
                              </>}
                        <span style={{ fontFamily: F_NUM, fontSize: 11, color: stockColor, fontWeight: 600, marginLeft: "auto" }}>{stockLabel}</span>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", border: `1px solid ${qty > 0 ? t.ink : t.line}`, borderRadius: 10, height: 36, flexShrink: 0, opacity: blocked ? 0.4 : 1 }}>
                    <button disabled={blocked || qty <= 0} onClick={() => onAdd(p, -1)} style={{ width: 32, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: qty > 0 ? "pointer" : "default" }}>
                        <MIcon name="minus" size={15} color={qty > 0 ? t.ink : t.inkMuted} w={2} />
                    </button>
                    {blocked
                        ? <div style={{ width: 28, textAlign: "center", fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: t.inkMuted }}>{qty}</div>
                        : <QtyInput t={t} value={qty} onCommit={(v) => onAdd(p, v - qty)} min={0} width={40} fontSize={14} color={qty > 0 ? t.ink : t.inkMuted} />}
                    <button disabled={blocked} onClick={() => onAdd(p, 1)} style={{ width: 32, height: 36, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 9px 9px 0", border: "none", cursor: blocked ? "default" : "pointer" }}>
                        <MIcon name="plus" size={15} color="#fff" w={2} />
                    </button>
                </div>
            </div>
        </Card>
    );
    if (!swipeable) return row;
    // Свайп ВПРАВО відкриває панель ЛІВОРУЧ (side="left") — там, де зелена плашка (#62).
    // Фон панелі зелений (t.ok) → візуально плашка розкривається в історію кількостей.
    // Ширина під чіпи (до 3); тап ставить кількість (delta = qty чіпа − поточна).
    const revealW = Math.min(recentQtys.length, 3) * 52 + 8;
    return (
        <SwipeReveal t={t} width={revealW} side="left" panel={(close) => (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: "0 8px", background: t.ok }}>
                {recentQtys.slice(0, 3).map((r, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); onAdd(p, r.qty - qty); close(); }}
                        title={tr("catalog.orderedQtyHint", { qty: r.qty, date: fmtDate(r.date) })}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 44, height: 44, padding: "0 6px", borderRadius: 10, background: t.surface, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        <span style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700, color: t.ink }}>{r.qty}</span>
                        <span style={{ fontSize: 9.5, color: t.inkMuted, marginTop: 1 }}>{fmtDate(r.date).slice(0, 5)}</span>
                    </button>
                ))}
            </div>
        )}>
            {row}
        </SwipeReveal>
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

export const CatalogScreen = ({ t, onNav, products, categories, priceTypes = [], activePriceType, onSelectPriceType, onAddToOrder, orderItems = [], editOrderId, editNum, editDate, editCustomer, orderedProductIds = new Set(), recentQtysByProduct = new Map(), notify, connecting, offsetTop = 0 }) => {
    const { t: tr } = useTranslation();
    const [path, setPath] = useState([]);
    const [query, setQuery] = useState("");

    const root = useMemo(() => buildTree(categories, products), [categories, products]);
    const node = getNode(root, path);
    const subgroups = node.children || [];
    const sortedSubgroups = useMemo(() => subgroups.slice().sort(byName), [subgroups]); // підгрупи за назвою (#61)
    const levelProducts = node.products || [];

    const crumbs = [{ name: tr("catalog.root"), path: [] }];
    let acc = root;
    for (let i = 0; i < path.length; i++) {
        const next = (acc.children || []).find(c => c.id === path[i]);
        if (!next) break; acc = next;
        crumbs.push({ name: acc.name, path: path.slice(0, i + 1) });
    }

    const searching = query.trim().length > 0;
    // Апаратний «Назад» усередині дерева категорій — на рівень угору, а не вихід з екрана (#71).
    // Реєструємо перехоплювач лише коли заглиблені й не в режимі пошуку (тоді показано плоскі результати).
    useEffect(() => {
        if (path.length === 0 || searching) return;
        return registerBack(() => { setPath(p => p.slice(0, -1)); return true; });
    }, [path.length, searching]);
    const results = useMemo(() => searching
        ? sortProducts(flattenProducts(root).filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            (p.sku || "").toLowerCase().includes(query.toLowerCase())))
        : [], [searching, query, root]);
    const sortedLevelProducts = useMemo(() => sortProducts(levelProducts), [levelProducts]);

    const qtyOf = (p) => orderItems.find(it => it.product.id === p.id)?.qty || 0;

    // Ціна — ВИКЛЮЧНО prices[активний тип] (#57): поля price в контракті більше немає.
    // Нуль або відсутність = «немає ціни» (#45): null → товар не додається (у прайсі 1С
    // нульова ціна означає, що ціни фактично немає, а не «безкоштовно»).
    // Додавання морозить саме цю ціну (знімок) → onAddToOrder отримує товар із price типу.
    const priceOf = (p) => {
        const v = p.prices && p.prices[activePriceType];
        return (v != null && Number(v) > 0) ? v : null;
    };
    const addToOrder = (p, delta) => {
        const price = priceOf(p);
        if (price == null) { notify?.(tr("catalog.noPriceForType")); return false; }
        onAddToOrder({ ...p, price }, delta);
        return true;
    };

    // Сканування штрихкоду товару: знайти за barcode/артикулом/id і додати в замовлення.
    const handleScan = async () => {
        let code;
        try { code = await scanBarcode(tr("scanner.barcodeHint")); }
        catch (e) { notify?.(tr("common.scannerError")); return; }
        if (!code) return; // скасовано
        const norm = code.trim().toLowerCase();
        const found = (products || []).find(p =>
            [p.barcode, p.sku, p.id].filter(Boolean).some(v => String(v).toLowerCase() === norm));
        if (found) { if (addToOrder(found, 1)) notify?.(tr("catalog.added", { name: found.name })); }
        else notify?.(tr("catalog.barcodeNotFound", { code }));
    };

    const cartCount = orderItems.length;
    const cartTotal = orderItems.reduce((s, it) => s + (Number(it.product.price) || 0) * it.qty, 0);
    const currency = products?.[0]?.currency || DEFAULT_CURRENCY; // валюта пристрою (одна на каталог)

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative", overflow: "hidden" }}>
            {/* Власні дії каталогу — фіксований кластер ліворуч від глобального TopActions.
                Вирівняні через спільний TOP_ACTIONS_W; обидва зсуваються на offsetTop під
                банером помилки. Жодного резервування місця в потоці шапки. */}
            <div style={{ position: "fixed", top: `calc(max(16px, env(safe-area-inset-top)) + ${offsetTop}px)`, right: TOP_ACTIONS_W + 24, zIndex: Z.floating, display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={handleScan} aria-label={tr("a11y.scanBarcode")} style={{ width: 38, height: 38, borderRadius: 12, background: t.surface, border: `1px solid ${t.line}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontFamily: "inherit" }}>
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
                <SearchInput t={t} value={query} onChange={setQuery} placeholder={tr("catalog.searchPlaceholder")} />

                {/* Селектор типу ціни (Варіант Б): тонкий ряд чіпів під пошуком — усі типи видно
                    одразу, перемик у 1 тап. Ховається, коли доступний лише один тип. */}
                {priceTypes.length > 1 && (
                    <ScrollRow fade={t.bg} gap={6} style={{ marginTop: 10, paddingBottom: 2 }}>
                        {priceTypes.map(pt => {
                            const on = pt.id === activePriceType;
                            return (
                                <button key={pt.id} onClick={() => onSelectPriceType?.(pt.id)}
                                    style={{ flexShrink: 0, height: 30, padding: "0 13px", borderRadius: 9, border: on ? "none" : `1px solid ${t.line}`, background: on ? t.accent : "transparent", color: on ? "#fff" : t.inkSoft, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                                    {pt.name}
                                </button>
                            );
                        })}
                    </ScrollRow>
                )}

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
                        ) : results.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} price={priceOf(p)} qty={qtyOf(p)} onAdd={addToOrder} priceTypes={priceTypes} activePriceType={activePriceType} ordered={orderedProductIds.has(p.id)} recentQtys={recentQtysByProduct.get(p.id)} />)}
                    </>
                ) : (
                    <>
                        {subgroups.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "2px 4px 8px" }}>{tr("catalog.subgroups")} · {subgroups.length}</div>
                                {sortedSubgroups.map(g => <GroupRow key={g.id} t={t} node={g} onOpen={() => setPath([...path, g.id])} />)}
                            </>
                        )}
                        {levelProducts.length > 0 && (
                            <>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: `${subgroups.length > 0 ? 18 : 2}px 4px 8px` }}>{tr("catalog.products")} · {levelProducts.length}</div>
                                {sortedLevelProducts.map(p => <ProductRow key={p.id || p.sku} t={t} p={p} price={priceOf(p)} qty={qtyOf(p)} onAdd={addToOrder} priceTypes={priceTypes} activePriceType={activePriceType} ordered={orderedProductIds.has(p.id)} recentQtys={recentQtysByProduct.get(p.id)} />)}
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
                                <div style={{ fontFamily: F_NUM, fontSize: 15, fontWeight: 700 }}>{fmtMoney2(cartTotal)} {curSymbol(currency)}</div>
                            </div>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.12)", padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700 }}>{tr("catalog.toOrder")}</div>
                    </button>
                </div>
            )}
        </div>
    );
};
