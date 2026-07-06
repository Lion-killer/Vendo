import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSyncHistory, clearSyncHistory } from '../api/syncHistory';
import { ListPlaceholder, ConfirmDialog } from './ui';
import { Z } from '../theme';
import { msgText, localeTag } from '../i18n';

// Історія прогонів синхронізації (#20): список запусків doSync (час + підсумок), розгортання
// per-order, фільтр «лише з помилками», перехід у замовлення для вирішення конфлікту, очистка.
const REL = (iso, tr) => {
    try {
        const min = Math.floor((Date.now() - new Date(iso)) / 60000);
        if (min < 1) return tr('sync.justNow');
        if (min < 60) return tr('sync.minAgo', { count: min });
        const h = Math.floor(min / 60);
        if (h < 24) return tr('sync.hourAgo', { count: h });
        return new Date(iso).toLocaleString(localeTag()); // формат за мовою застосунку, не системи (#50)
    } catch { return iso; }
};

export const SyncHistoryPanel = ({ t, onClose, onOpenOrder }) => {
    const { t: tr } = useTranslation();
    const [onlyErrors, setOnlyErrors] = useState(false);
    const [expanded, setExpanded] = useState({}); // індекс прогону -> розгорнуто
    const [confirmClear, setConfirmClear] = useState(false);

    const runs = getSyncHistory().slice().reverse(); // найновіші зверху
    const shown = onlyErrors ? runs.filter(r => (r.failed || 0) + (r.conflict || 0) > 0) : runs;

    const resultColor = (res) => res === 'sent' ? t.ok : res === 'conflict' ? t.warn : res === 'skipped' ? t.inkMuted : t.err;
    const resultIcon = (res) => res === 'sent' ? '✓' : res === 'conflict' ? '⚠' : res === 'skipped' ? '⤼' : '✗';
    const chip = (color, label) => <span style={{ fontSize: 11.5, fontWeight: 800, color, background: color + '1A', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>{label}</span>;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: Z.panel, background: t.bg, color: t.ink, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Шапка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${t.line}`, paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
                <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{tr('syncHist.title')}</div>
                <button onClick={() => setOnlyErrors(v => !v)} style={{ background: onlyErrors ? t.errSoft : t.surfaceMuted, border: `1px solid ${t.line}`, color: onlyErrors ? t.err : t.ink, borderRadius: 10, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {onlyErrors ? tr('syncHist.all') : tr('syncHist.onlyErrors')}
                </button>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.inkMuted, fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* Список прогонів */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px' }}>
                {shown.length === 0 ? (
                    <ListPlaceholder loading={false} t={t}><div style={{ fontSize: 14 }}>{tr('syncHist.empty')}</div></ListPlaceholder>
                ) : shown.map((run, i) => {
                    const isOpen = !!expanded[i];
                    return (
                        <div key={i} style={{ borderBottom: `1px solid ${t.lineSoft || t.line}`, padding: '10px 0' }}>
                            <button onClick={() => setExpanded(e => ({ ...e, [i]: !e[i] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: t.ink, padding: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'left' }}>{REL(run.t, tr)}</span>
                                {run.sent ? chip(t.ok, '↑' + run.sent) : null}
                                {run.conflict ? chip(t.warn, '⚠' + run.conflict) : null}
                                {run.failed ? chip(t.err, '✗' + run.failed) : null}
                                {run.skipped ? chip(t.inkMuted, '⤼' + run.skipped) : null}
                                <span style={{ color: t.inkMuted, fontSize: 13 }}>{isOpen ? '▾' : '▸'}</span>
                            </button>
                            {isOpen && (run.items || []).map((it, j) => {
                                const canOpen = (it.result === 'conflict' || it.result === 'failed') && it.id;
                                return (
                                    <div key={j} onClick={canOpen ? () => onOpenOrder && onOpenOrder(it.id) : undefined}
                                        style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 0 6px 8px', cursor: canOpen ? 'pointer' : 'default' }}>
                                        <span style={{ color: resultColor(it.result), fontWeight: 800, fontSize: 13, minWidth: 14 }}>{resultIcon(it.result)}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{it.label} · <span style={{ color: t.inkMuted, fontWeight: 500 }}>{tr('syncHist.op_' + it.op)}</span></div>
                                            {it.message && <div style={{ fontSize: 11.5, color: t.inkMuted, wordBreak: 'break-word' }}>{msgText(it.message)}</div>}
                                        </div>
                                        {canOpen && <span style={{ color: t.accent, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{tr('syncHist.open')} ›</span>}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Очистити */}
            {runs.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.line}`, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
                    <button onClick={() => setConfirmClear(true)} style={{ width: '100%', height: 44, borderRadius: 12, background: t.surfaceMuted, color: t.err, border: `1px solid ${t.line}`, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{tr('syncHist.clear')}</button>
                </div>
            )}

            {confirmClear && (
                <ConfirmDialog t={t} icon="trash"
                    title={tr('syncHist.title')} body={tr('syncHist.clearConfirm')}
                    confirmLabel={tr('syncHist.clear')} cancelLabel={tr('common.cancel')}
                    onConfirm={() => { clearSyncHistory(); onClose(); }}
                    onCancel={() => setConfirmClear(false)} />
            )}
        </div>
    );
};
