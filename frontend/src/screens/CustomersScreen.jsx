import React, { useState } from 'react';
import { MIcon, Card, F_NUM } from '../components/ui';

const money = (n) => (Number(n) || 0).toLocaleString('uk-UA', { maximumFractionDigits: 0 });

// Картка клієнта (нижня шторка) — деталі + контактні особи.
const ClientCard = ({ t, c, onClose }) => {
    const debt = Number(c.debt) || 0;
    // Кілька контактних осіб (#11) — поки бекенд віддає одну; підтримуємо й масив c.contacts.
    const contacts = Array.isArray(c.contacts) ? c.contacts
        : (c.contact || c.phone) ? [{ name: c.contact || "Контактна особа", phone: c.phone }] : [];
    const Field = ({ label, value, tel }) => value ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${t.lineSoft}` }}>
            <span style={{ fontSize: 12.5, color: t.inkMuted, flexShrink: 0 }}>{label}</span>
            {tel
                ? <a href={`tel:${value}`} style={{ fontSize: 13.5, fontWeight: 600, color: t.accent, textAlign: "right", fontFamily: F_NUM, textDecoration: "none" }}>{value}</a>
                : <span style={{ fontSize: 13.5, fontWeight: 600, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value}</span>}
        </div>
    ) : null;

    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 120, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "12px 16px max(20px, env(safe-area-inset-bottom))", maxHeight: "85vh", overflowY: "auto" }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "4px auto 16px" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <MIcon name="building" size={22} color={t.inkSoft} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{c.name}</div>
                        {debt !== 0 && <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, color: debt > 0 ? t.err : t.ok }}>{debt > 0 ? `Борг ${money(debt)} ₴` : `Переплата ${money(-debt)} ₴`}</div>}
                    </div>
                </div>

                <div style={{ marginTop: 8 }}>
                    <Field label="Код" value={c.code} />
                    <Field label="Найменування" value={c.name} />
                    <Field label="Адреса" value={c.address} />
                    <Field label="Телефон" value={c.phone} tel />
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase", margin: "18px 0 8px" }}>Контактні особи</div>
                {contacts.length === 0 ? (
                    <div style={{ fontSize: 13, color: t.inkMuted, paddingBottom: 8 }}>Не вказано</div>
                ) : contacts.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: i < contacts.length - 1 ? `1px solid ${t.lineSoft}` : "none" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || "Контактна особа"}</span>
                        {p.phone && <a href={`tel:${p.phone}`} style={{ fontSize: 13, fontWeight: 600, color: t.accent, fontFamily: F_NUM, textDecoration: "none", flexShrink: 0 }}>{p.phone}</a>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClientRow = ({ t, c, onClick }) => {
    const debt = Number(c.debt) || 0;
    return (
        <Card t={t} onClick={onClick} style={{ padding: 12, marginBottom: 8, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: t.surfaceMuted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <MIcon name="building" size={21} color={t.inkSoft} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={{ fontFamily: F_NUM }}>{c.code}</span>
                        {c.address && <><span style={{ color: t.line }}>·</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address}</span></>}
                    </div>
                    {(c.phone || c.contact) && (
                        <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap", alignItems: "center" }}>
                            {c.contact && <span style={{ fontSize: 11, color: t.inkSoft }}>{c.contact}</span>}
                            {c.phone && <span style={{ fontSize: 11, color: t.inkSoft, fontFamily: F_NUM }}>{c.phone}</span>}
                        </div>
                    )}
                </div>
                {/* Колонка боргу/переплати: борг — червоним, переплата (від'ємний борг) — зеленим */}
                <div style={{ flexShrink: 0, textAlign: "right", marginLeft: 8, minWidth: 72 }}>
                    {debt > 0 ? (
                        <>
                            <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: t.err }}>{money(debt)} ₴</div>
                            <div style={{ fontSize: 9.5, color: t.inkMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.3 }}>борг</div>
                        </>
                    ) : debt < 0 ? (
                        <>
                            <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 700, color: t.ok }}>{money(-debt)} ₴</div>
                            <div style={{ fontSize: 9.5, color: t.inkMuted, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.3 }}>переплата</div>
                        </>
                    ) : (
                        <div style={{ fontSize: 13, color: t.inkMuted }}>—</div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export const CustomersScreen = ({ t, customers = [], isOnline }) => {
    const [filter, setFilter] = useState("all");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(null);

    const withDebt = customers.filter(c => (Number(c.debt) || 0) > 0);
    const filters = [
        { id: "all", label: "Усі", n: customers.length },
        { id: "debt", label: "З боргом", n: withDebt.length },
    ];

    let list = filter === "debt" ? withDebt : customers;
    if (query.trim()) {
        const q = query.toLowerCase();
        // Пошук за назвою, кодом, адресою, телефоном і контактними особами (#11).
        list = list.filter(c => {
            const contacts = Array.isArray(c.contacts)
                ? c.contacts.map(p => `${p.name || ""} ${p.phone || ""}`).join(" ") : "";
            return [c.name, c.code, c.address, c.phone, c.contact, contacts]
                .filter(Boolean).join(" ").toLowerCase().includes(q);
        });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Шапка */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 12px", background: t.bg }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
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
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук: назва, код, адреса, телефон…"
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
                ) : list.map(c => <ClientRow key={c.id || c.code} t={t} c={c} onClick={() => setSelected(c)} />)}
                <div style={{ height: 16 }} />
            </div>

            {selected && <ClientCard t={t} c={selected} onClose={() => setSelected(null)} />}
        </div>
    );
};
