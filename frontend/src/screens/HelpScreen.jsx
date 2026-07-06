import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Z } from '../theme';

// Вбудована довідка (#доках). Контент — markdown із docs/user-guide, скопійований у
// src/help при збірці (scripts/copy-help.mjs), бандлиться як ?raw → працює офлайн.
// Скріншоти лежать у public/help-images (статика). react-markdown рендерить розділ,
// .md-посилання перехоплюються для переходу між розділами без виходу із застосунку.
const raw = import.meta.glob('../help/*.md', { query: '?raw', import: 'default', eager: true });

const sections = Object.entries(raw)
    .map(([path, content]) => {
        const name = path.split('/').pop();
        const m = content.match(/^#\s+(.+)$/m);
        return { name, title: (m ? m[1] : name).trim(), content };
    })
    .sort((a, b) => ord(a.name) - ord(b.name));

function ord(name) {
    if (name === 'README.md') return -1;          // індекс/шпаргалка — першим
    if (name === 'glossary.md') return 999;        // словничок — останнім
    const n = parseInt(name, 10);
    return Number.isNaN(n) ? 500 : n;
}

const imgUri = (src) => src && src.startsWith('images/') ? '/help-images/' + src.slice(7) : src;

export const HelpScreen = ({ t, onClose }) => {
    const { t: tr, i18n } = useTranslation();
    const [active, setActive] = useState(null); // null = список розділів

    // Стилі markdown-елементів через токени теми (єдиний вигляд із рештою застосунку).
    const md = useMemo(() => ({
        h1: (p) => <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, margin: '4px 0 14px' }}>{p.children}</h1>,
        h2: (p) => <h2 style={{ fontSize: 16.5, fontWeight: 800, margin: '22px 0 8px' }}>{p.children}</h2>,
        h3: (p) => <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: '16px 0 6px' }}>{p.children}</h3>,
        p: (p) => <p style={{ fontSize: 14.5, lineHeight: 1.6, margin: '0 0 12px', color: t.ink }}>{p.children}</p>,
        ul: (p) => <ul style={{ margin: '0 0 12px', paddingLeft: 22 }}>{p.children}</ul>,
        ol: (p) => <ol style={{ margin: '0 0 12px', paddingLeft: 22 }}>{p.children}</ol>,
        li: (p) => <li style={{ fontSize: 14.5, lineHeight: 1.55, margin: '4px 0', color: t.ink }}>{p.children}</li>,
        strong: (p) => <strong style={{ fontWeight: 700 }}>{p.children}</strong>,
        em: (p) => <em style={{ color: t.inkMuted }}>{p.children}</em>,
        code: (p) => <code style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, background: t.surfaceMuted, padding: '1px 6px', borderRadius: 6 }}>{p.children}</code>,
        blockquote: (p) => <blockquote style={{ margin: '0 0 14px', padding: '10px 14px', background: t.accentSoft, borderLeft: `3px solid ${t.accent}`, borderRadius: 8, color: t.accentInk, fontSize: 13.5 }}>{p.children}</blockquote>,
        hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${t.line}`, margin: '20px 0' }} />,
        img: (p) => <img src={imgUri(p.src)} alt={p.alt || ''} style={{ display: 'block', width: '100%', maxWidth: 360, margin: '8px auto 16px', borderRadius: 14, border: `1px solid ${t.line}` }} />,
        a: (p) => {
            const href = p.href || '';
            // Внутрішнє посилання на розділ (xxx.md) → перемикаємо розділ, не виходимо із застосунку.
            if (/\.md(#.*)?$/.test(href)) {
                const target = href.replace(/#.*$/, '').split('/').pop();
                return <a onClick={(e) => { e.preventDefault(); if (sections.some(s => s.name === target)) { setActive(target); window.scrollTo?.(0, 0); } }}
                    style={{ color: t.accent, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>{p.children}</a>;
            }
            return <a href={href} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 600 }}>{p.children}</a>;
        },
    }), [t]);

    const current = active ? sections.find(s => s.name === active) : null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: Z.panel, background: t.bg, color: t.ink, display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {/* Шапка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${t.line}`, paddingTop: 'calc(14px + env(safe-area-inset-top))' }}>
                {current && (
                    <button onClick={() => setActive(null)} aria-label={tr('a11y.back')} style={{ background: 'none', border: 'none', color: t.ink, fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>‹</button>
                )}
                <div style={{ fontSize: 17, fontWeight: 800, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {current ? current.title : tr('help.title')}
                </div>
                <button onClick={onClose} aria-label={tr('a11y.close')} style={{ background: 'none', border: 'none', color: t.inkMuted, fontSize: 26, lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>

            {/* Тіло */}
            <div style={{ flex: 1, overflowY: 'auto', padding: current ? '16px 18px 32px' : '8px 0 24px' }}>
                {current ? (
                    <>
                        {i18n.language !== 'uk' && (
                            <div style={{ margin: '0 0 14px', padding: '8px 12px', background: t.surfaceMuted, borderRadius: 8, color: t.inkMuted, fontSize: 12.5 }}>{tr('help.ukOnly')}</div>
                        )}
                        <ReactMarkdown components={md} transformImageUri={imgUri}>{current.content}</ReactMarkdown>
                    </>
                ) : (
                    sections.map(s => (
                        <button key={s.name} onClick={() => setActive(s.name)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', borderBottom: `1px solid ${t.lineSoft || t.line}`, cursor: 'pointer', fontFamily: 'inherit', color: t.ink }}>
                            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{s.title}</span>
                            <span style={{ color: t.inkMuted, fontSize: 18 }}>›</span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
