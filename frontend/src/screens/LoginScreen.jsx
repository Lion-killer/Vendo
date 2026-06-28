import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { auth } from '../api/client';
import { scanQr, parseQr } from '../api/scanner';
import { clearImageCache } from '../api/imageCache';
import { purgeOnDeviceSwitch } from '../api/deviceData';

export const LoginScreen = ({ t, onLogin, onOpenHelp }) => {
    const { t: tr } = useTranslation();
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
            setError(tr("login.errScanner"));
            return;
        }
        if (!raw) { setLoading(false); return; } // скасовано користувачем

        // 2) Парсимо вміст: GUID пристрою + (опційно) адреса бекенду + код прив'язки
        const { deviceId, apiUrl, pairingCode } = parseQr(raw);

        // Зміна пристрою: якщо сканують QR ІНШОГО пристрою — стираємо всі дані попереднього
        // (кеш, чернетки, чергу, історію, токен, сесію) + кеш фото. Чужі дані не вантажаться.
        if (purgeOnDeviceSwitch(deviceId, localStorage)) clearImageCache();

        if (apiUrl) localStorage.setItem('vendo_api_url', apiUrl);
        if (deviceId) localStorage.setItem('vendo_device_id', deviceId);

        // 3) Обмін коду прив'язки на токен
        try {
            const res = await auth(deviceId, pairingCode);
            if (res.success) {
                setLoading(false); setScanned(true);
                setTimeout(() => onLogin(res.user?.name || deviceId || tr("common.user"), res.token), 700);
            } else {
                throw new Error(res.message || tr("login.errUnauthorized"));
            }
        } catch (e) {
            setLoading(false);
            const netErr = !e.message || /fetch|network|json|failed/i.test(e.message);
            setError(netErr ? tr("login.errAuth") : e.message);
        }
    };

    const busy = loading || scanned;

    return (
        <div style={{ flex: 1, background: t.bg, color: t.ink, display: "flex", flexDirection: "column", alignItems: "center", padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))", position: "relative" }}>

            <div style={{ flex: 1.2 }} />

            {/* Бренд */}
            <div style={{ textAlign: "center" }}>
                <img src="/app-icon.png" alt="Vendo" width={76} height={76} style={{ display: "block", borderRadius: 22, margin: "0 auto 18px" }} />
                <h1 style={{ color: t.ink, fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.6 }}>Vendo</h1>
                <p style={{ color: t.inkMuted, fontSize: 14, margin: "6px 0 0", fontWeight: 500 }}>{tr("login.subtitle")}</p>
            </div>

            <div style={{ height: 36 }} />

            {/* Картка скану QR */}
            <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 20, padding: 20, width: "100%", maxWidth: 340 }}>
                <div style={{ width: "100%", aspectRatio: "1", background: t.surfaceMuted, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", border: `2px dashed ${scanned ? t.ok : loading ? t.accent : t.line}`, transition: "border-color .3s", position: "relative", overflow: "hidden" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 42, height: 42, border: `3px solid ${t.line}`, borderTopColor: t.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                            <span style={{ color: t.inkMuted, fontSize: 12, fontWeight: 600 }}>{tr("login.scanning")}</span>
                        </div>
                    ) : scanned ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: t.ok, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon name="check" size={28} color="#fff" />
                            </div>
                            <span style={{ color: t.ok, fontSize: 13, fontWeight: 700 }}>{tr("login.confirmed")}</span>
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
                    {loading ? tr("login.reading") : scanned ? tr("login.success") : tr("login.scan")}
                </span>
            </button>

            <p style={{ color: t.inkMuted, fontSize: 12, textAlign: "center", margin: "16px 0 0" }}>{tr("login.hint")}</p>

            {/* Довідка — помітний акцент для нового агента (до сканування QR) */}
            {onOpenHelp && (
                <div style={{ width: "100%", maxWidth: 340, marginTop: 18, textAlign: "center" }}>
                    <div style={{ color: t.inkMuted, fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{tr("login.firstTime")}</div>
                    <button onClick={onOpenHelp} style={{ width: "100%", height: 48, borderRadius: 14, background: t.accentSoft, border: `1.5px solid ${t.accent}55`, color: t.accentInk, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit", fontSize: 14.5, fontWeight: 700 }}>
                        <Icon name="info" size={19} color={t.accentInk} /> {tr("login.help")}
                    </button>
                </div>
            )}
        </div>
    );
};
