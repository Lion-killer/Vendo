import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntries, clearLog } from '../logger';
import { useLogSend } from '../useLogSend';

// Панель журналу: показує записи логу (за замовчуванням лише помилки/попередження),
// дає надіслати лог розробнику (sendLog: API → файл+«Поділитися» → текст → буфер) і
// очистити. Модальне накладання поверх усього застосунку.
const LEVEL_LABEL = { server: 'sendLog_server', share: 'sendLog_share', clipboard: 'sendLog_clipboard', fail: 'sendLog_fail' };

export const LogPanel = ({ t, onClose }) => {
    const { t: tr } = useTranslation();
    const [all, setAll] = useState(false);
    const [entries] = useState(() => getEntries().slice().reverse()); // найновіші зверху
    const { state: sendState, send: doSend, sending } = useLogSend('Надсилання з журналу помилок');

    const shown = all ? entries : entries.filter(e => e.level !== 'info');
    const doClear = () => { clearLog(); onClose(); };

    const lvlColor = (lvl) => lvl === 'error' ? t.err : lvl === 'warn' ? t.warn : t.inkMuted;
    const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(); } catch { return iso; } };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: t.bg, color: t.ink, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Шапка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${t.line}`, paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
                <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{tr('log.title')}</div>
                <button onClick={() => setAll(a => !a)} style={{ background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.ink, borderRadius: 10, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {all ? tr('log.onlyErrors') : tr('log.showAll')}
                </button>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.inkMuted, fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* Дії */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>
                <button onClick={doSend} disabled={sending} style={{ flex: 1, height: 46, borderRadius: 12, background: t.accent, color: '#fff', border: 'none', fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: sending ? 0.6 : 1 }}>
                    {sending ? tr('log.sending') : tr('profile.sendLog')}
                </button>
                <button onClick={doClear} style={{ width: 46, height: 46, borderRadius: 12, background: t.surfaceMuted, color: t.err, border: `1px solid ${t.line}`, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }} title={tr('log.clear')}>🗑</button>
            </div>
            {LEVEL_LABEL[sendState] && (
                <div style={{ padding: '0 16px 8px', fontSize: 13, fontWeight: 600, color: sendState === 'fail' ? t.err : t.ok }}>
                    {tr(`profile.${LEVEL_LABEL[sendState]}`)}
                </div>
            )}

            {/* Список */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
                {shown.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: t.inkMuted, fontSize: 14 }}>{tr('log.empty')}</div>
                ) : shown.map((e, i) => (
                    <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${t.lineSoft || t.line}` }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: lvlColor(e.level), minWidth: 44 }}>{e.level}</span>
                            <span style={{ fontSize: 11, color: t.inkMuted, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtTime(e.t)}</span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3, wordBreak: 'break-word' }}>{e.msg}</div>
                        {e.data !== undefined && (
                            <div style={{ fontSize: 11.5, color: t.inkMuted, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace", wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{e.data}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
