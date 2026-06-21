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

    return (
        <div style={{ flex: 1, background: `linear-gradient(160deg, ${t.primaryDark} 0%, ${t.primary} 55%, ${t.secondary}55 100%)`, display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 28px 40px", position: "relative", overflow: "hidden" }}>
            {/* Background circles */}
            <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ position: "absolute", bottom: -60, left: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

            {/* Logo area */}
            <div style={{ marginTop: 60, textAlign: "center", zIndex: 1 }}>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                    <Icon name="box" size={40} color="#fff" />
                </div>
                <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -.5 }}>Vendo</h1>
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, margin: "6px 0 0", fontWeight: 500 }}>Система торгового представника</p>
            </div>

            <div style={{ flex: 1 }} />

            {/* QR Frame */}
            <div style={{ zIndex: 1, background: "rgba(255,255,255,0.10)", borderRadius: 24, padding: 24, backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", width: "100%", maxWidth: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>Автентифікація за QR-кодом</span>
                </div>
                <div style={{ width: "100%", aspectRatio: "1", background: scanned ? t.secondary + "33" : "rgba(0,0,0,0.25)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${scanned ? t.secondary : "rgba(255,255,255,0.3)"}`, transition: "all .3s", position: "relative", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 40, height: 40, border: `3px solid rgba(255,255,255,0.2)`, borderTopColor: t.secondary, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Сканування...</span>
                        </div>
                    ) : scanned ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 50, height: 50, borderRadius: "50%", background: t.secondary, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon name="check" size={26} color="#fff" />
                            </div>
                            <span style={{ color: t.secondary, fontSize: 12, fontWeight: 700 }}>Підтверджено!</span>
                        </div>
                    ) : (
                        <Icon name="qr" size={80} color="rgba(255,255,255,0.5)" />
                    )}
                    {/* Corner marks */}
                    {!loading && !scanned && ["topLeft", "topRight", "bottomLeft", "bottomRight"].map(pos => (
                        <div key={pos} style={{ position: "absolute", [pos.includes("top") ? "top" : "bottom"]: 8, [pos.includes("Left") ? "left" : "right"]: 8, width: 20, height: 20, borderTop: pos.includes("top") ? "2px solid rgba(255,255,255,0.6)" : "none", borderBottom: pos.includes("bottom") ? "2px solid rgba(255,255,255,0.6)" : "none", borderLeft: pos.includes("Left") ? "2px solid rgba(255,255,255,0.6)" : "none", borderRight: pos.includes("Right") ? "2px solid rgba(255,255,255,0.6)" : "none", borderRadius: pos === "topLeft" ? "4px 0 0 0" : pos === "topRight" ? "0 4px 0 0" : pos === "bottomLeft" ? "0 0 0 4px" : "0 0 4px 0" }} />
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && <div style={{ marginTop: 16, background: t.error + "22", border: `1px solid ${t.error}44`, borderRadius: 12, padding: "10px 16px", color: t.error, fontSize: 13, fontWeight: 600, textAlign: "center", zIndex: 1, width: "100%", maxWidth: 320 }}>{error}</div>}

            <div style={{ flex: 1 }} />

            {/* Button */}
            <button onClick={handleScan} disabled={loading || scanned} style={{ marginBottom: 20, width: "100%", maxWidth: 320, height: 54, borderRadius: 16, background: loading || scanned ? "rgba(255,255,255,0.2)" : t.secondary, border: "none", cursor: loading || scanned ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit", transition: "all .2s", boxShadow: loading || scanned ? "none" : "0 4px 20px rgba(0,0,0,0.25)", zIndex: 1 }}>
                <Icon name="qr" size={20} color="#fff" />
                <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: .3 }}>
                    {loading ? "Зчитування..." : scanned ? "Успішно!" : "Сканувати QR-код"}
                </span>
            </button>

            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, textAlign: "center", zIndex: 1, marginBottom: 0 }}>Відскануйте QR-код з корпоративного порталу</p>
        </div>
    );
};
