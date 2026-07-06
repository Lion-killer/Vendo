import React from 'react';
import { logError } from './logger';
import { useLogSend } from './useLogSend';
import { LIGHT, DARK, F_UI, F_NUM } from './theme';
import { K } from './storageKeys';

// Остання лінія оборони: ловить будь-яку помилку рендера й показує екран замість
// білого. Стилі беруть токени теми (як решта застосунку), але імпорт theme.js
// безпечний — це чисті константи без побічних ефектів, тож boundary лишається надійним
// навіть коли інші модулі ламаються.
const resolveTheme = () => {
    const saved = (() => { try { return localStorage.getItem(K.theme); } catch { return null; } })();
    if (saved === 'dark') return DARK;
    if (saved === 'light') return LIGHT;
    const prefersDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return prefersDark ? DARK : LIGHT;
};

// Екран збою. Функціональний компонент — щоб користуватись спільним хуком useLogSend
// (та сама логіка надсилання, що й у журналі помилок). i18n свідомо НЕ використовуємо:
// екран має лишатись надійним, навіть якщо зламана локалізація.
const SEND_MSG = {
    server: 'Лог надіслано розробнику',
    share: 'Лог відкрито для надсилання',
    clipboard: 'Лог скопійовано в буфер — надішліть розробнику',
    fail: 'Не вдалося надіслати лог',
};
const ErrorFallback = ({ error }) => {
    const t = resolveTheme();
    const { state, send, sending } = useLogSend('Збій додатку (ErrorBoundary)');
    const msg = SEND_MSG[state];
    const btn = { width: '100%', height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', background: t.bg, color: t.ink, fontFamily: F_UI, textAlign: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: 22, background: t.errSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, marginBottom: 20 }}>⚠️</div>

            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>Сталася помилка</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.5, color: t.inkMuted, maxWidth: 320, marginBottom: 18 }}>
                Додаток зустрів несподівану ситуацію. Надішліть лог розробнику — це допоможе швидко виправити.
            </div>

            <div style={{ width: '100%', maxWidth: 340, padding: '12px 14px', borderRadius: 12, background: t.surfaceMuted, border: `1px solid ${t.line}`, color: t.inkMuted, fontFamily: F_NUM, fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word', textAlign: 'left', marginBottom: 24 }}>
                {String((error && error.message) || error).slice(0, 240)}
            </div>

            <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={send} disabled={sending} style={{ ...btn, background: t.accent, color: '#fff', opacity: sending ? 0.6 : 1 }}>
                    {sending ? 'Надсилаю…' : 'Надіслати лог розробнику'}
                </button>
                <button onClick={() => window.location.reload()} style={{ ...btn, background: t.surfaceMuted, color: t.ink, border: `1px solid ${t.line}` }}>
                    Перезапустити додаток
                </button>
            </div>

            {msg && (
                <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 600, color: state === 'fail' ? t.err : t.ok }}>{msg}</div>
            )}
        </div>
    );
};

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        logError('ErrorBoundary', `${error && error.stack ? error.stack : error}\n${info && info.componentStack ? info.componentStack : ''}`);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return <ErrorFallback error={this.state.error} />;
    }
}
