import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { registerBack } from '../backNav';
import { MIcon, Card, F_NUM, ScrollRow } from './ui';
import { fmtMoney0, curSymbol, byName } from '../i18n';
import { buildCustomerTree, getCustomerNode, leavesUnder, sumDebt } from '../customerTree';

// Пошук контрагента: назва / код / адреса / телефон / контактні особи (#11).
const matchCustomer = (c, q) => {
    const contacts = Array.isArray(c.contacts) ? c.contacts.map(p => `${p.name || ""} ${p.phone || ""}`).join(" ") : "";
    return [c.name, c.code, c.address, c.phone, c.contact, contacts].filter(Boolean).join(" ").toLowerCase().includes(q);
};

// Колонка боргу/переплати праворуч у рядку списку — ОДНА для контрагента й для папки, щоб
// вигляд не розходився: борг червоним, переплата (від'ємний борг) зеленим, нуль — тире;
// короткий підпис під сумою.
export const DebtCell = ({ t, debt, currency }) => {
    const { t: tr } = useTranslation();
    const n = Number(debt) || 0;
    return (
        <div style={{ flexShrink: 0, textAlign: "right", marginLeft: 8, minWidth: 72 }}>
            {n === 0
                ? <div style={{ fontSize: 13, color: t.inkMuted }}>—</div>
                : <>
                    <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: n > 0 ? t.err : t.ok }}>{fmtMoney0(Math.abs(n))} {curSymbol(currency)}</div>
                    <div style={{ fontSize: 9.5, color: t.inkMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.3 }}>{tr(n > 0 ? "customers.debtShort" : "customers.overpayShort")}</div>
                </>}
        </div>
    );
};

// Рядок папки: іконка + назва + к-сть клієнтів + колонка боргу (як у контрагента) + шеврон.
const GroupRow = ({ t, node, onOpen }) => {
    const { t: tr } = useTranslation();
    const leaves = leavesUnder(node);
    const debt = sumDebt(leaves);
    const cur = leaves.find(c => c.debtCurrency)?.debtCurrency; // валюта боргу — одна на відповідь
    return (
        <Card t={t} onClick={onOpen} style={{ padding: 12, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MIcon name="folder" size={22} color={t.accentInk} w={1.7} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{node.name}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 3 }}>
                        <span style={{ fontFamily: F_NUM }}>{leaves.length}</span> {tr("customers.clientsWord")}
                    </div>
                </div>
                <DebtCell t={t} debt={debt} currency={cur} />
                <MIcon name="chevron" size={18} color={t.inkMuted} />
            </div>
        </Card>
    );
};

// Спільне дерево контрагентів (#64) для екрана «Клієнти» і вибірника в замовленні.
// - query непорожній → плоский пошук по всьому дереву;
// - forceFlat (напр. фільтр «З боргом») → плоский список переданих customers;
// - інакше → навігація деревом: хлібні крихти + папки (drill-in) + контрагенти рівня.
// renderClient(customer) визначає вигляд листа (картка з боргом / рядок вибору).
export const CustomerTree = ({ t, groups = [], customers = [], query = "", forceFlat = false, renderClient, empty = null }) => {
    const { t: tr } = useTranslation();
    const [path, setPath] = useState([]);
    const q = query.trim().toLowerCase();

    const root = useMemo(() => buildCustomerTree(groups, customers), [groups, customers]);

    // Апаратний «Назад» усередині дерева папок — на рівень угору, а не вихід з екрана (#71).
    // Лише коли справді показано папки (заглиблені й не в плоскому режимі пошуку/forceFlat).
    // Хук — ДО раннього return нижче (правило хуків).
    useEffect(() => {
        if (path.length === 0 || q || forceFlat) return;
        return registerBack(() => { setPath(p => p.slice(0, -1)); return true; });
    }, [path.length, q, forceFlat]);

    // Нова папка / рівень / режим пошуку — показати список з початку (#72). Контейнер прокрутки
    // належить батьку (екран «Клієнти» і пікер у замовленні), тож від якоря йдемо вгору до
    // найближчого прокручуваного предка й скидаємо його scrollTop. Ключ по path (не по довжині —
    // сусідні папки мають однакову глибину). Хук — ДО раннього return (правило хуків).
    const scrollAnchor = useRef(null);
    useEffect(() => {
        let el = scrollAnchor.current?.parentElement;
        while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
        if (el) el.scrollTop = 0;
    }, [path.join('/'), q, forceFlat]);
    const anchor = <div ref={scrollAnchor} aria-hidden="true" style={{ height: 0 }} />;

    // Плоский режим: пошук фільтрує передані customers; forceFlat — усі (вже відфільтровані батьком).
    if (q || forceFlat) {
        const list = (q ? customers.filter(c => matchCustomer(c, q)) : customers).slice().sort(byName);
        return list.length ? <>{anchor}{list.map(renderClient)}</> : empty;
    }

    const node = getCustomerNode(root, path);
    const subgroups = (node.children || []).slice().sort(byName);
    const levelCustomers = (node.customers || []).slice().sort(byName);

    const crumbs = [{ name: tr("customers.root"), path: [] }];
    let acc = root;
    for (let i = 0; i < path.length; i++) {
        const next = (acc.children || []).find(c => c.id === path[i]);
        if (!next) break; acc = next;
        crumbs.push({ name: acc.name, path: path.slice(0, i + 1) });
    }

    return (
        <>
            {anchor}
            {path.length > 0 && (
                <ScrollRow fade={t.bg} gap={2} stickEnd={path} style={{ marginBottom: 10, paddingBottom: 2 }}>
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

            {subgroups.map(g => <GroupRow key={g.id} t={t} node={g} onOpen={() => setPath([...path, g.id])} />)}
            {levelCustomers.map(renderClient)}
            {subgroups.length === 0 && levelCustomers.length === 0 && empty}
        </>
    );
};
