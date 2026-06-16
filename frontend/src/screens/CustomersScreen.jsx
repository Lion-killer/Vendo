import React, { useState } from 'react';
import { Icon } from '../components/Icon';

export const CustomersScreen = ({ t, customers }) => {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));

    if (selected) return <CustomerDetail t={t} customer={selected} onBack={() => setSelected(null)} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "env(safe-area-inset-top)", overflow: "hidden" }}>
            <div style={{ background: t.surface, padding: "16px 16px 0", borderBottom: `1px solid ${t.border}` }}>
                <h2 style={{ color: t.text, fontSize: 18, fontWeight: 800, margin: "0 0 12px" }}>Контрагенти</h2>
                <div style={{ background: t.surfaceVariant, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Icon name="search" size={18} color={t.textMuted} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук контрагента..." style={{ flex: 1, border: "none", background: "none", outline: "none", color: t.text, fontSize: 14, fontFamily: "inherit", fontWeight: 500 }} />
                    {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 18 }}>×</button>}
                </div>
                <div style={{ display: "flex", gap: 8, paddingBottom: 12, overflowX: "auto", scrollbarWidth: "none" }}>
                    {["Всі", "Активні", "VIP", "Борг"].map((f, i) => (
                        <span key={f} style={{ flexShrink: 0, background: i === 0 ? t.primary : t.chip, color: i === 0 ? t.onPrimary : t.chipText, padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{f}</span>
                    ))}
                </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                {filtered.map(c => (
                    <div key={c.id} onClick={() => setSelected(c)} style={{ background: t.surface, borderRadius: 16, padding: "14px 16px", marginBottom: 8, cursor: "pointer", border: `1px solid ${t.border}`, boxShadow: t.cardShadow }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: c.status === "vip" ? t.tertiary + "22" : t.chip, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon name="building" size={22} color={c.status === "vip" ? t.tertiary : t.primary} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <p style={{ color: t.text, fontSize: 13, fontWeight: 800, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                                    {c.status === "vip" && <span style={{ background: t.tertiary + "22", color: t.tertiary, fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 6, letterSpacing: .5 }}>VIP</span>}
                                </div>
                                <p style={{ color: t.textMuted, fontSize: 11, margin: "2px 0 0", fontWeight: 500 }}>{c.code} · {c.city}</p>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                                {c.debt > 0 ? <span style={{ background: t.error + "18", color: t.error, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, display: "block" }}>−{c.debt.toLocaleString()} ₴</span> : <span style={{ background: t.success + "18", color: t.success, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, display: "block" }}>✓ Без боргу</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CustomerDetail = ({ t, customer, onBack }) => (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingTop: "env(safe-area-inset-top)", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg, ${t.primaryDark} 0%, ${t.primary} 100%)`, padding: "16px 20px 24px" }}>
            <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                <Icon name="chevronLeft" size={20} color="#fff" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="building" size={28} color="#fff" />
                </div>
                <div>
                    <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{customer.name}</h2>
                    <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: "4px 0 0" }}>{customer.code} · {customer.city}</p>
                </div>
            </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {[
                { icon: "user", label: "Контактна особа", value: customer.contact },
                { icon: "phone", label: "Телефон", value: customer.phone },
                { icon: "mapPin", label: "Місто", value: customer.city },
            ].map(row => (
                <div key={row.label} style={{ background: t.surface, borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, border: `1px solid ${t.border}` }}>
                    <Icon name={row.icon} size={20} color={t.primary} />
                    <div>
                        <p style={{ color: t.textMuted, fontSize: 11, margin: 0, fontWeight: 600 }}>{row.label}</p>
                        <p style={{ color: t.text, fontSize: 14, margin: "2px 0 0", fontWeight: 700 }}>{row.value}</p>
                    </div>
                </div>
            ))}
            <div style={{ background: customer.debt > 0 ? t.error + "18" : t.success + "18", borderRadius: 14, padding: "16px", border: `1px solid ${customer.debt > 0 ? t.error + "33" : t.success + "33"}`, marginBottom: 16 }}>
                <p style={{ color: t.textMuted, fontSize: 11, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>Поточний борг</p>
                <p style={{ color: customer.debt > 0 ? t.error : t.success, fontSize: 24, fontWeight: 900, margin: 0 }}>{customer.debt > 0 ? `−${customer.debt.toLocaleString()} ₴` : "Без боргу"}</p>
            </div>
            <div style={{ background: t.surface, borderRadius: 14, padding: "14px 16px", border: `1px solid ${t.border}` }}>
                <p style={{ color: t.textSecondary, fontSize: 12, fontWeight: 700, margin: "0 0 12px" }}>Останні замовлення</p>
                {["ЗМ-2021 · 3 420 ₴", "ЗМ-1998 · 8 900 ₴", "ЗМ-1975 · 1 200 ₴"].map((o, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 2 ? `1px solid ${t.border}` : "none" }}>
                        <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{o.split("·")[0]}</span>
                        <span style={{ color: t.primary, fontSize: 13, fontWeight: 700 }}>{o.split("·")[1]}</span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);
