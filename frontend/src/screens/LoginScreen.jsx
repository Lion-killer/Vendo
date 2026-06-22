import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { auth } from '../api/client';
import { scanQr, parseQr } from '../api/scanner';

export const LoginScreen = ({ t, onLogin }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [scanned, setScanned] = useState(false);

    const handleScan = async () => {
        setError(""); setLoading(true); setScanned(false);

        // 1) Відкриваємо камеру й читаємо QR
        let raw;
        try {
            raw = await scanQr();
        } catch (e) {
            setLoading(false);
            setError("Не вдалося відкрити сканер. Дозвольте доступ до камери.");
            return;
        }
        if (!raw) { setLoading(false); return; } // скасовано користувачем

        // 2) Парсимо вміст: GUID пристрою + (опційно) адреса бекенду
        const { deviceId, apiUrl } = parseQr(raw);
        if (apiUrl) localStorage.setItem('vendo_api_url', apiUrl);
        if (deviceId) localStorage.setItem('vendo_device_id', deviceId);

        // 3) Автентифікація за пристроєм
        try {
            const res = await auth(deviceId);
            if (res.success) {
                setLoading(false); setScanned(true);
                setTimeout(() => onLogin(res.user?.name || deviceId || "Користувач", res.token), 700);
            } else {
                throw new Error(res.message || "Пристрій не авторизовано");
            }
        } catch (e) {
            setLoading(false);
            const netErr = !e.message || /fetch|network|json|failed/i.test(e.message);
            setError(netErr ? "Помилка автентифікації. Перевірте з'єднання." : e.message);
        }
    };

    const busy = loading || scanned;

    return (
        <div style={{ flex: 1, background: t.bg, color: t.ink, display: "flex", flexDirection: "column", alignItems: "center", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", position: "relative" }}>

            <div style={{ flex: 1.2 }} />

            {/* Бренд */}
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 76, height: 76, borderRadius: 22, background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                    <Icon name="vmark" size={42} color="#fff" />
                </div>
                <h1 style={{ color: t.ink, fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.6 }}>Vendo</h1>
                <p style={{ color: t.inkMuted, fontSize: 14, margin: "6px 0 0", fontWeight: 500 }}>Система торгового представника</p>
            </div>

            <div style={{ height: 36 }} />

            {/* Картка скану QR */}
            <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 20, padding: 20, width: "100%", maxWidth: 340 }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <span style={{ color: t.inkSoft, fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>Автентифікація за QR-кодом</span>
                </div>
                <div style={{ width: "100%", aspectRatio: "1", background: t.surfaceMuted, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${scanned ? t.ok : loading ? t.accent : t.line}`, transition: "border-color .3s", position: "relative", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 42, height: 42, border: `3px solid ${t.line}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                            <span style={{ color: t.inkMuted, fontSize: 12, fontWeight: 600 }}>Сканування…</span>
                        </div>
                    ) : scanned ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.ok, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon name="check" size={28} color="#fff" />
                            </div>
                            <span style={{ color: t.ok, fontSize: 13, fontWeight: 700 }}>Підтверджено</span>
                        </div>
                    ) : (
                        <Icon name="qr" size={76} color={t.inkMuted} />
                    )}
                    {/* Кутові маркери рамки */}
                    {!busy && ["topLeft", "topRight", "bottomLeft", "bottomRight"].map(pos => (
                        <div key={pos} style={{ position: "absolute", [pos.includes("top") ? "top" : "bottom"]: 10, [pos.includes("Left") ? "left" : "right"]: 10, width: 20, height: 20, borderTop: pos.includes("top") ? `2px solid ${t.inkSoft}` : "none", borderBottom: pos.includes("bottom") ? `2px solid ${t.inkSoft}` : "none", borderLeft: pos.includes("Left") ? `2px solid ${t.inkSoft}` : "none", borderRight: pos.includes("Right") ? `2px solid ${t.inkSoft}` : "none", borderRadius: pos === "topLeft" ? "4px 0 0 0" : pos === "topRight" ? "0 4px 0 0" : pos === "bottomLeft" ? "0 0 0 4px" : "0 0 4px 0", opacity: 0.6 }} />
                    ))}
                </div>
            </div>

            {/* Помилка */}
            {error && <div style={{ marginTop: 16, background: t.errSoft, border: `1px solid ${t.err}44`, borderRadius: 12, padding: "10px 16px", color: t.err, fontSize: 13, fontWeight: 600, textAlign: "center", width: "100%", maxWidth: 340 }}>{error}</div>}

            <div style={{ flex: 1 }} />

            {/* Кнопка */}
            <button onClick={handleScan} disabled={busy} style={{ width: "100%", maxWidth: 340, height: 54, borderRadius: 14, background: busy ? t.surfaceMuted : t.accent, border: "none", cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit", transition: "background .2s" }}>
                <Icon name="qr" size={20} color={busy ? t.inkMuted : "#fff"} />
                <span style={{ color: busy ? t.inkMuted : "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 0.3 }}>
                    {loading ? "Зчитування…" : scanned ? "Успішно" : "Сканувати QR-код"}
                </span>
            </button>

            <p style={{ color: t.inkMuted, fontSize: 12, textAlign: "center", margin: "16px 0 0" }}>Відскануйте QR-код з корпоративного порталу</p>
        </div>
    );
};
