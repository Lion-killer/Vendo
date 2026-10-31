import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MIcon, BottomSheet } from './ui';
import { byName, todayISO } from '../i18n';
import { K } from '../storageKeys';
import { fetchPriceFile } from '../api/client';
import { shareFile } from '../api/shareFile';
import { logWarn } from '../logger';

// Параметри прайса (#88): формат, тип цін, групи. Файл формує сервер і він одразу йде
// в системний діалог «Поділитися». Вибір запам'ятовується — наступного разу не перевибирати.

// Дерево з пласких categories (parentId) — той самий принцип, що в каталозі, але без товарів.
const buildTree = (categories) => {
    const byId = new Map();
    (categories || []).forEach(c => byId.set(c.id, { id: c.id, name: c.name, parentId: c.parentId || '', children: [] }));
    const roots = [];
    byId.forEach(n => { if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId).children.push(n); else roots.push(n); });
    const sortRec = (list) => { list.sort(byName); list.forEach(n => sortRec(n.children)); return list; };
    return sortRec(roots);
};
const subtreeIds = (node, acc = []) => { acc.push(node.id); node.children.forEach(c => subtreeIds(c, acc)); return acc; };

// На сервер шлемо лише ВЕРХНІ вибрані вузли: нащадки й так потраплять (В ИЕРАРХИИ),
// а короткий список — менше тіло запиту й зрозуміліший журнал.
const topMost = (nodes, selected, out = []) => {
    nodes.forEach(n => {
        if (selected.has(n.id)) out.push(n.id);
        else topMost(n.children, selected, out);
    });
    return out;
};

const loadOpts = () => { try { return JSON.parse(localStorage.getItem(K.priceOpts)) || {}; } catch { return {}; } };

const Row = ({ t, node, depth, selected, expanded, onToggle, onExpand }) => {
    const on = selected.has(node.id);
    const open = expanded.has(node.id);
    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', paddingLeft: depth * 18 }}>
                {node.children.length > 0 ? (
                    <button onClick={() => onExpand(node.id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', transform: open ? 'rotate(90deg)' : 'none' }}>
                        <MIcon name="chevron" size={18} color={t.inkMuted} />
                    </button>
                ) : <span style={{ width: 18 }} />}
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={on} onChange={() => onToggle(node)} style={{ accentColor: t.accent, width: 18, height: 18 }} />
                    <span style={{ color: t.ink, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
                </label>
            </div>
            {open && node.children.map(c => (
                <Row key={c.id} t={t} node={c} depth={depth + 1} selected={selected} expanded={expanded} onToggle={onToggle} onExpand={onExpand} />
            ))}
        </>
    );
};

export const PriceSheet = ({ t, categories, priceTypes = [], activePriceType, onClose, notify }) => {
    const { t: tr } = useTranslation();
    const saved = loadOpts();
    const tree = useMemo(() => buildTree(categories), [categories]);
    const [format, setFormat] = useState(saved.format === 'xlsx' ? 'xlsx' : 'pdf');
    const [priceType, setPriceType] = useState(() => {
        const ids = priceTypes.map(p => p.id);
        if (saved.priceType && ids.indexOf(saved.priceType) !== -1) return saved.priceType;
        if (activePriceType && ids.indexOf(activePriceType) !== -1) return activePriceType;
        return ids[0] || '';
    });
    const [selected, setSelected] = useState(() => new Set(Array.isArray(saved.categories) ? saved.categories : []));
    const [expanded, setExpanded] = useState(() => new Set());
    const [busy, setBusy] = useState(false);

    const all = selected.size === 0; // порожній вибір = весь доступний каталог
    const toggle = (node) => setSelected(prev => {
        const next = new Set(prev);
        const turnOn = !next.has(node.id);
        subtreeIds(node).forEach(id => { if (turnOn) next.add(id); else next.delete(id); });
        return next;
    });
    const expand = (id) => setExpanded(prev => { const next = new Set(prev); if (!next.delete(id)) next.add(id); return next; });

    const build = async () => {
        setBusy(true);
        try {
            const ids = topMost(tree, selected);
            const blob = await fetchPriceFile({ format, priceType, categories: ids });
            const name = (priceTypes.find(p => p.id === priceType) || {}).name || '';
            // Пробіли й службові символи в імені файлу месенджери показують криво.
            const safe = String(name).replace(/[\\/:*?"<>|\s]+/g, '_');
            const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
            const fileName = `${tr('price.fileName')}${safe ? '_' + safe : ''}_${todayISO()}.${ext}`;
            await shareFile(blob, fileName, tr('price.title'));
            // Запам'ятовуємо лише вдалий вибір — інакше збережемо параметри, що не працюють.
            try { localStorage.setItem(K.priceOpts, JSON.stringify({ format, priceType, categories: ids })); } catch { /* квота */ }
            onClose();
        } catch (e) {
            logWarn('Прайс: формування не вдалося', String(e && e.message || e));
            if (notify) notify(tr('price.failed', { error: String(e && e.message || e) }));
            setBusy(false);
        }
    };

    const fmtBtn = (active) => ({ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${active ? t.accent : t.line}`, background: active ? t.accent + '18' : t.surfaceMuted, color: active ? t.accent : t.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' });

    return (
        <BottomSheet t={t} onClose={busy ? () => { } : onClose} sheetStyle={{ maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ color: t.ink, fontSize: 17, fontWeight: 800, margin: '0 0 14px' }}>{tr('price.title')}</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button onClick={() => setFormat('pdf')} style={fmtBtn(format === 'pdf')}>PDF</button>
                <button onClick={() => setFormat('xlsx')} style={fmtBtn(format === 'xlsx')}>Excel</button>
            </div>

            <label style={{ color: t.inkMuted, fontSize: 12, fontWeight: 700 }}>{tr('price.priceType')}</label>
            <select value={priceType} onChange={(e) => setPriceType(e.target.value)}
                style={{ width: '100%', padding: 10, marginTop: 6, marginBottom: 14, borderRadius: 10, border: `1px solid ${t.line}`, background: t.surfaceMuted, color: t.ink, fontSize: 14, fontFamily: 'inherit' }}>
                {priceTypes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ color: t.inkMuted, fontSize: 12, fontWeight: 700 }}>{tr('price.groups')}</label>
                <button onClick={() => setSelected(new Set())} disabled={all}
                    style={{ background: 'none', border: 'none', padding: 0, color: all ? t.inkMuted : t.accent, fontSize: 12, fontWeight: 700, cursor: all ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                    {tr('price.allGroups')}
                </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 120, border: `1px solid ${t.line}`, borderRadius: 10, padding: '4px 10px', marginBottom: 6 }}>
                {tree.length === 0
                    ? <div style={{ color: t.inkMuted, fontSize: 13, padding: '10px 0' }}>{tr('price.noGroups')}</div>
                    : tree.map(n => <Row key={n.id} t={t} node={n} depth={0} selected={selected} expanded={expanded} onToggle={toggle} onExpand={expand} />)}
            </div>
            <div style={{ color: t.inkMuted, fontSize: 12, marginBottom: 14 }}>
                {all ? tr('price.hintAll') : tr('price.hintSelected', { count: topMost(tree, selected).length })}
            </div>

            <button onClick={build} disabled={busy || !priceType}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: busy || !priceType ? t.line : t.accent, color: '#fff', fontWeight: 800, fontSize: 15, cursor: busy || !priceType ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {busy ? tr('price.building') : tr('price.build')}
            </button>
        </BottomSheet>
    );
};
