import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MIcon, Card, F_NUM, ConfirmDialog } from '../components/ui';
import { localeTag, fmtMoney as fmtCurLocale, fmtCur, parseMoney, todayISO, orderNum, setLang, SUPPORTED, curSymbol, DEFAULT_CURRENCY } from '../i18n';
import { getLocalOrders } from '../api/localOrders';
import { mergeOrders } from '../api/refs';
import ReactMarkdown from 'react-markdown';
import { checkForUpdate, isUpdatePromptShown, markUpdatePromptShown, downloadAndInstall, openInstallSettings } from '../api/updates';

// Версія з package.json, вшита Vite'ом на збірці (define у vite.config.js).
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

const fmtMoney = (n) => fmtCurLocale(n, { maximumFractionDigits: 0 });

const initials = (name) => (name || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?";

// Відносний час останньої синхронізації ("щойно", "5 хв тому", "2 год тому", "вчора"…).
const syncLabel = (ts, tr) => {
    if (!ts) return tr("sync.never");
    const min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return tr("sync.justNow");
    if (min < 60) return tr("sync.minAgo", { count: min });
    const h = Math.floor(min / 60);
    if (h < 24) return tr("sync.hourAgo", { count: h });
    const d = Math.floor(h / 24);
    return d === 1 ? tr("sync.yesterday") : tr("sync.dayAgo", { count: d });
};

export const DashboardScreen = ({ t, onNav, userName, isOnline, orders, products = [], productsCount = 0, customersCount = 0, onSync, onLogout, isDark, onToggleTheme, onOpenLog, hasErrors, onClearData, onOpenSyncHistory, onOpenHelp }) => {
    const { t: tr, i18n } = useTranslation();
    const [showProfile, setShowProfile] = useState(false);
    const [clearConfirm, setClearConfirm] = useState(null); // {body} коли відкрито діалог очистки

    // Перевірка оновлень (#37): раз за сесію, у фоні; офлайн/помилка — мовчки null.
    // Знайдене оновлення показуємо повноекранним промптом із чейнджлогом (раз за сесію);
    // кнопка в меню профілю лишається для «пізніше».
    const [update, setUpdate] = useState(null);
    const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
    // Фази встановлення: null (пропозиція) → downloading → installing (системний діалог)
    // або permission (немає дозволу «невідомі джерела») / error.
    const [updPhase, setUpdPhase] = useState(null);
    const [updProgress, setUpdProgress] = useState(0);
    useEffect(() => {
        checkForUpdate(APP_VERSION).then(u => {
            setUpdate(u);
            if (u && !isUpdatePromptShown()) {
                markUpdatePromptShown();
                setShowUpdatePrompt(true);
            }
        }).catch(() => { });
    }, []);

    const startUpdate = async () => {
        setUpdPhase('downloading');
        setUpdProgress(0);
        try {
            const r = await downloadAndInstall(update, setUpdProgress);
            if (r === 'permission') setUpdPhase('permission');
            else if (r === 'installing') setUpdPhase('installing');
            else { setUpdPhase(null); setShowUpdatePrompt(false); } // web-фолбек: URL відкрито
        } catch (e) {
            setUpdPhase('error');
        }
    };

    // Раз на хвилину перемальовуємо, щоб відносний підпис синхронізації «капав»
    // ("щойно" → "1 хв тому" → …). Хвилинна гранулярність — навантаження мінімальне.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(id);
    }, []);

    // Локальні + серверні замовлення (спільне злиття: локальне виграє за id, _pending).
    const displayOrders = mergeOrders(orders, getLocalOrders());

    const today = new Date().toLocaleDateString(localeTag(), { weekday: 'long', day: 'numeric', month: 'long' });

    const statusColor = (o) => o.sColor || (o.status === 'Видалено' ? t.err : o.status === 'Відправлено' ? t.ok : o.status === 'Нове' ? t.warn : t.inkSoft);
    const isNew = (o) => o.status === 'Нове';

    // Сьогоднішні замовлення (локальна дата YYYY-MM-DD) — для стрічки й KPI «сьогодні».
    const todayOrders = displayOrders.filter(o => o.date === todayISO());

    // KPI «сьогодні» рахуємо саме з сьогоднішніх (без помічених на видалення) — щоб
    // виторг/к-сть узгоджувалися зі списком нижче.
    const liveToday = todayOrders.filter(o => !o.deletionMark && o.status !== 'Видалено');
    const ordersCount = liveToday.length;
    // Виторг/чек — тільки по замовленнях у валюті пристрою (чужі валюти не змішуємо, #35).
    const deviceCurrency = products?.[0]?.currency || DEFAULT_CURRENCY;
    const sameCur = liveToday.filter(o => (o.currency || DEFAULT_CURRENCY) === deviceCurrency);
    const revenue = sameCur.reduce((s, o) => s + parseMoney(o.total), 0);
    const avgCheck = sameCur.length ? Math.round(revenue / sameCur.length) : 0;

    // Стан синхронізації: час останньої вдалої синхронізації + локальна черга на відправку.
    const lastSync = Number(localStorage.getItem('vendo_last_sync')) || 0;
    const pendingCount = getLocalOrders().length;

    const stats = [
        {
            l: tr("dashboard.sync"),
            v: lastSync ? new Date(lastSync).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' }) : "—",
            s: syncLabel(lastSync, tr), icon: "sync", onClick: onSync,
        },
        {
            l: tr("dashboard.toSend"),
            v: String(pendingCount),
            s: pendingCount ? tr("dashboard.pending") : tr("dashboard.sent"),
            icon: "send", warn: pendingCount > 0, onClick: () => onNav("ordersList"),
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Верхня панель */}
            <div style={{ padding: "max(16px, env(safe-area-inset-top)) 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button onClick={() => setShowProfile(true)} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{initials(userName)}</div>
                    <div>
                        <div style={{ fontSize: 11, color: t.inkMuted, fontWeight: 500, textTransform: "capitalize" }}>{today}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: t.ink }}>{userName || tr("common.user")}</div>
                    </div>
                </button>
                {/* Кнопки сповіщень/синхронізації/статусу — у глобальному TopActions (App) */}
            </div>

            {/* Hero: KPI дня */}
            <div style={{ margin: "12px 16px 0", borderRadius: 20, background: t.invBg, color: "#fff", padding: "18px 20px", overflow: "hidden" }}>
                <div>
                    <div style={{ fontSize: 11, opacity: 0.55, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.8 }}>{tr("dashboard.revenueToday")}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4, fontFamily: F_NUM, letterSpacing: -0.5 }}>{fmtMoney(revenue)} {curSymbol(deviceCurrency)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 11, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14 }}>
                    {[[tr("dashboard.orders"), String(ordersCount)], [tr("dashboard.avgCheck"), `${fmtMoney(avgCheck)} ${curSymbol(deviceCurrency)}`], [tr("dashboard.clients"), String(customersCount)]].map(([l, v]) => (
                        <div key={l}>
                            <div style={{ opacity: 0.55 }}>{l}</div>
                            <div style={{ fontFamily: F_NUM, fontWeight: 600, fontSize: 16, marginTop: 1 }}>{v}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Основна дія */}
            <div style={{ margin: "14px 16px 0" }}>
                <button onClick={() => onNav("orders", { newOrder: true })} style={{ width: "100%", height: 54, border: "none", background: t.accent, borderRadius: 14, fontFamily: "inherit", fontSize: 15, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
                    <MIcon name="plus" size={18} color="#fff" w={2} /> {tr("dashboard.newOrder")}
                </button>
            </div>

            {/* Швидка статистика */}
            <div style={{ margin: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {stats.map(s => (
                    <button key={s.l} onClick={s.onClick} style={{ textAlign: "left", cursor: "pointer", padding: "12px", background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, fontFamily: "inherit" }}>
                        <div style={{ marginBottom: 6, display: "flex" }}><MIcon name={s.icon} size={16} color={s.warn ? t.warn : t.inkMuted} /></div>
                        <div style={{ fontSize: 19, fontFamily: F_NUM, fontWeight: 600, color: s.warn ? t.warn : t.ink }}>{s.v}</div>
                        <div style={{ fontSize: 10.5, color: t.inkMuted, fontWeight: 500, marginTop: 1 }}>{s.l} · {s.s}</div>
                    </button>
                ))}
            </div>

            {/* Сьогоднішні замовлення — займають усю нижню область, скрол усередині */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", margin: "16px 16px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 4px 8px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.inkMuted, letterSpacing: 0.8, textTransform: "uppercase" }}>{tr("dashboard.todayOrders")}</div>
                    <div onClick={() => onNav("ordersList")} style={{ fontSize: 12, color: t.accent, fontWeight: 600, cursor: "pointer" }}>{tr("common.all")}</div>
                </div>
                <Card t={t} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {todayOrders.length === 0 ? (
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: t.inkMuted, padding: 24, gap: 12 }}>
                            <MIcon name="doc" size={40} color={t.line} />
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{tr("dashboard.empty")}</div>
                        </div>
                    ) : (
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                        {todayOrders.map((o, i, arr) => (
                            <div key={o.id} onClick={() => onNav("orders", { order: o })} style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: i < arr.length - 1 ? `1px solid ${t.lineSoft}` : "none", cursor: "pointer", opacity: o.deletionMark ? 0.55 : 1 }}>
                                <div style={{ width: 4, alignSelf: "stretch", background: statusColor(o), borderRadius: 2, marginRight: 12 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontFamily: F_NUM, fontSize: 12, fontWeight: 600, textDecoration: o.deletionMark ? "line-through" : "none" }}>{orderNum(o)}</span>
                                        {isNew(o) && <span style={{ fontSize: 9.5, fontWeight: 700, color: t.warn, background: t.warn + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>{tr("dashboard.badgeNew")}</span>}
                                        {o.conflict ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>{tr("dashboard.badgeConflict")}</span>
                                            : o.syncError ? <span title={o.syncError} style={{ fontSize: 9.5, fontWeight: 700, color: t.err, background: t.err + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>{tr("dashboard.badgeError")}</span>
                                            : (o._pending && !isNew(o)) ? <span style={{ fontSize: 9.5, fontWeight: 700, color: t.inkMuted, background: t.inkMuted + "22", padding: "1px 6px", borderRadius: 4, letterSpacing: 0.4 }}>{tr("dashboard.badgeWaiting")}</span> : null}
                                    </div>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.client || o.customer?.name || tr("common.unknownClient")}</div>
                                </div>
                                <div style={{ textAlign: "right", marginLeft: 10 }}>
                                    <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 600 }}>{fmtCur(parseMoney(o.total), o.currency, { minimumFractionDigits: 2 })}</div>
                                    <div style={{ fontSize: 10.5, color: statusColor(o), fontWeight: 600, marginTop: 1 }}>{tr(`status.${o.status}`)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    )}
                </Card>
            </div>

            {/* Повноекранний промпт оновлення (#37): версія + чейнджлог релізу при старті */}
            {showUpdatePrompt && update && (
                <div style={{ position: "fixed", inset: 0, background: t.bg, zIndex: 300, display: "flex", flexDirection: "column", padding: "max(24px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
                        <div style={{ width: 72, height: 72, borderRadius: 22, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <MIcon name="download" size={34} color={t.accent} />
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 16, color: t.ink }}>{tr("profile.updateTitle")}</div>
                        <div style={{ fontFamily: F_NUM, fontSize: 14, color: t.inkMuted, marginTop: 4 }}>Vendo v{APP_VERSION} → v{update.version}</div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "18px 0", padding: "0 6px", fontSize: 14, lineHeight: 1.55, color: t.ink }}>
                        <ReactMarkdown components={{
                            h3: ({ children }) => <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, color: t.inkMuted, margin: "14px 0 6px" }}>{children}</div>,
                            ul: ({ children }) => <ul style={{ margin: 0, paddingLeft: 20 }}>{children}</ul>,
                            li: ({ children }) => <li style={{ margin: "4px 0" }}>{children}</li>,
                            p: ({ children }) => <p style={{ margin: "6px 0" }}>{children}</p>,
                        }}>{update.notes}</ReactMarkdown>
                    </div>
                    {updPhase === 'downloading' && (
                        <div style={{ flexShrink: 0 }}>
                            <div style={{ height: 8, borderRadius: 4, background: t.surfaceMuted, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${updProgress}%`, background: t.accent, borderRadius: 4, transition: "width .3s" }} />
                            </div>
                            <div style={{ textAlign: "center", marginTop: 10, fontSize: 13.5, fontWeight: 600, color: t.inkMuted, fontFamily: F_NUM }}>
                                {tr("profile.updDownloading", { percent: updProgress })}
                            </div>
                        </div>
                    )}
                    {updPhase === 'installing' && (
                        <div style={{ flexShrink: 0, textAlign: "center", fontSize: 14, color: t.inkMuted, padding: "0 8px" }}>
                            {tr("profile.updInstalling")}
                            <button onClick={() => { setShowUpdatePrompt(false); setUpdPhase(null); }} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
                                {tr("profile.updateLater")}
                            </button>
                        </div>
                    )}
                    {updPhase === 'permission' && (
                        <div style={{ flexShrink: 0 }}>
                            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: t.warn, background: t.warn + "18", border: `1px solid ${t.warn}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                                {tr("profile.updNoPermission")}
                            </div>
                            <button onClick={() => openInstallSettings()} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                {tr("profile.updOpenSettings")}
                            </button>
                            <button onClick={startUpdate} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.accent, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
                                {tr("profile.updRetry")}
                            </button>
                        </div>
                    )}
                    {updPhase === 'error' && (
                        <div style={{ flexShrink: 0 }}>
                            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: t.err, background: t.err + "18", border: `1px solid ${t.err}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                                {tr("profile.updError")}
                            </div>
                            <button onClick={startUpdate} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                {tr("profile.updRetry")}
                            </button>
                            <button onClick={() => { setShowUpdatePrompt(false); setUpdPhase(null); }} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
                                {tr("profile.updateLater")}
                            </button>
                        </div>
                    )}
                    {!updPhase && (
                        <>
                            <button onClick={startUpdate} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                                {tr("profile.update", { version: update.version })}
                            </button>
                            <button onClick={() => setShowUpdatePrompt(false)} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6, flexShrink: 0 }}>
                                {tr("profile.updateLater")}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Меню профілю (#47) */}
            {showProfile && (
                <div onClick={() => setShowProfile(false)} style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: "24px 24px 0 0", padding: "20px 16px", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                        <div style={{ width: 40, height: 4, borderRadius: 2, background: t.line, margin: "0 auto 16px" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "0 4px" }}>
                            <div style={{ width: 52, height: 52, borderRadius: 16, background: t.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: 18 }}>{initials(userName)}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ color: t.inkMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5 }}>{tr("profile.role")}</div>
                                <div style={{ color: t.ink, fontSize: 17, marginTop: 2, fontWeight: 800 }}>{userName}</div>
                            </div>
                        </div>
                        {/* Оновлення (#37): відкриваємо APK у системному браузері — він сам качає і пропонує встановити */}
                        {update && (
                            <button onClick={() => { setShowProfile(false); setUpdPhase(null); setShowUpdatePrompt(true); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.accentSoft, border: `1px solid ${t.accent}55`, color: t.accent, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                                <MIcon name="download" size={20} color={t.accent} />
                                <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.update", { version: update.version })}</span>
                            </button>
                        )}
                        {/* Перемикач мови (#26): ручний вибір, негайне застосування без перезавантаження */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ color: t.inkMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .5, margin: "0 4px 6px" }}>{tr("lang.title")}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                {SUPPORTED.map(lng => {
                                    const on = i18n.language === lng;
                                    return (
                                        <button key={lng} onClick={() => setLang(lng)} style={{ flex: 1, height: 44, borderRadius: 12, background: on ? t.btnBg : t.surfaceMuted, border: `1px solid ${on ? t.btnBg : t.line}`, color: on ? "#fff" : t.ink, fontSize: 13, fontWeight: on ? 700 : 600, cursor: "pointer", fontFamily: "inherit" }}>
                                            {tr(`lang.${lng}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {onToggleTheme && (
                            <button onClick={onToggleTheme} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                                <MIcon name="moon" size={20} color={t.ink} />
                                <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.darkTheme")}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? t.accent : t.inkMuted }}>{isDark ? tr("profile.on") : tr("profile.off")}</span>
                            </button>
                        )}
                        <button onClick={() => { setShowProfile(false); onOpenSyncHistory && onOpenSyncHistory(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                            <MIcon name="sync" size={20} color={t.ink} />
                            <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.openSyncHistory")}</span>
                        </button>
                        <button onClick={() => { setShowProfile(false); onOpenLog && onOpenLog(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                            <MIcon name="send" size={20} color={t.ink} />
                            <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.openLog")}</span>
                            {hasErrors && <span style={{ width: 9, height: 9, borderRadius: "50%", background: t.err }} />}
                        </button>
                        <button onClick={() => { setShowProfile(false); onOpenHelp && onOpenHelp(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                            <MIcon name="info" size={20} color={t.ink} />
                            <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.openHelp")}</span>
                        </button>
                        {onClearData && (
                            <button onClick={() => {
                                const pending = getLocalOrders().length;
                                setClearConfirm({ body: pending > 0 ? tr("profile.clearDataPending", { count: pending }) : tr("profile.clearDataConfirm") });
                            }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "0 14px", fontFamily: "inherit", marginBottom: 10 }}>
                                <MIcon name="trash" size={20} color={t.ink} />
                                <span style={{ flex: 1, textAlign: "left" }}>{tr("profile.clearData")}</span>
                            </button>
                        )}
                        <button onClick={() => { setShowProfile(false); onLogout && onLogout(); }} style={{ width: "100%", height: 50, borderRadius: 14, background: t.errSoft, border: `1px solid ${t.err}33`, color: t.err, fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit" }}>
                            <MIcon name="logout" size={20} color={t.err} /> {tr("profile.logout")}
                        </button>
                        <div style={{ textAlign: "center", marginTop: 12, fontSize: 11.5, color: t.inkMuted, fontFamily: F_NUM }}>Vendo v{APP_VERSION}</div>
                    </div>
                </div>
            )}

            {clearConfirm && (
                <ConfirmDialog t={t} icon="trash"
                    title={tr("profile.clearData")} body={clearConfirm.body}
                    confirmLabel={tr("profile.clearData")} cancelLabel={tr("common.cancel")}
                    onConfirm={() => { setClearConfirm(null); setShowProfile(false); onClearData && onClearData(); }}
                    onCancel={() => setClearConfirm(null)} />
            )}
        </div>
    );
};
