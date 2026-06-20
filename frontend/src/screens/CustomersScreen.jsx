import React, { useState } from 'react';
import { MIcon, Card, Pill, F_NUM } from '../components/ui';

const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });

const ClientRow = ({ t, c }) => {
    const debt = Number(c.debt) || 0;
    return (
        <Card t={t} style={{ padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MIcon name="building" size={21} color={t.inkSoft} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={{ fontFamily: F_NUM }}>{c.code}</span>
                        {(c.city || c.address) && <><span style={{ color: t.line }}>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.city || c.address}</span></>}
                    </div>
                    {(debt > 0 || c.phone || c.contact) && (
                        <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
                            {debt > 0 && <Pill bg={t.errSoft} fg={t.err}>Борг {money(debt)} ₴</Pill>}
                            {c.contact && <span style={{ fontSize: 11, color: t.inkSoft }}>{c.contact}</span>}
                            {c.phone && <span style={{ fontSize: 11, color: t.inkSoft, fontFamily: F_NUM }}>{c.phone}</span>}
                        </div>
                    )}
                </div>
                <MIcon name="chevron" size={16} color={t.inkMuted} />
            </div>
        </Card>
    );
};

export const CustomersScreen = ({ t, customers = [], isOnline }) => {
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");

    const withDebt = customers.filter(c => (Number(c.debt) || 0) > 0);
    const filters = [
        { id: "all", label: "Усі", n: customers.length },
        { id: "debt", label: "З боргом", n: withDebt.length },
    ];

    let list = filter === "debt" ? withDebt : customers;
    if (query.trim()) list = list.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.code || "").toLowerCase().includes(query.toLowerCase()));

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Шапка */}
            <div style={{ padding: "max(8px, env(safe-area-inset-top)) 16px 12px", background: t.bg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Клієнти</div>
                        <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 2 }}>
                            <span style={{ fontFamily: F_NUM }}>{customers.length}</span> контрагентів
                        </div>
                    </div>
                </div>

                {/* Пошук */}
                <div style={{ background: t.surface, border: `1px solid ${query ? t.accent : t.line}`, borderRadius: 12, padding: "0 14px", display: "flex", alignItems: "center", gap: 10, height: 44 }}>
                    <MIcon name="search" size={18} color={query ? t.accent : t.inkMuted} />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук клієнта або коду…"
                        style={{ flex: 1, border: "none", outline: "none", background: "none", fontFamily: "inherit", fontSize: 14, color: t.ink }} />
                    {query && <div onClick={() => setQuery("")} style={{ cursor: "pointer", display: "flex" }}><MIcon name="x" size={17} color={t.inkMuted} /></div>}
                </div>

                {/* Сегментований фільтр */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {filters.map(f => {
                        const on = filter === f.id;
                        return (
                            <div key={f.id} onClick={() => setFilter(f.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: on ? t.btnBg : t.surface, border: `1px solid ${on ? t.btnBg : t.line}`, color: on ? "#fff" : t.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
                                {f.label}
                                <span style={{ fontFamily: F_NUM, fontSize: 11, fontWeight: 700, color: on ? "rgba(255,255,255,0.7)" : t.inkMuted }}>{f.n}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Список */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
                {list.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "48px 20px", color: t.inkMuted }}>
                        <MIcon name="users" size={36} color={t.line} />
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Нічого не знайдено</div>
                    </div>
                ) : list.map(c => <ClientRow key={c.id || c.code} t={t} c={c} />)}
                <div style={{ height: 16 }} />
            </div>
        </div>
    );
};
