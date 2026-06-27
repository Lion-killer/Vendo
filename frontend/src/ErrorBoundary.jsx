import React from 'react';
import { logError, sendLog } from './logger';

// Остання лінія оборони: ловить будь-яку помилку рендера й показує екран замість
// білого. Самодостатній — не залежить від теми/i18n/даних, бо спрацьовує саме тоді,
// коли щось із цього зламане. Стилі вшиті інлайн.
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, sending: false, sent: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        logError('ErrorBoundary', `${error && error.stack ? error.stack : error}\n${info && info.componentStack ? info.componentStack : ''}`);
    }

    send = async () => {
        this.setState({ sending: true, sent: null });
        const via = await sendLog('Збій додатку (ErrorBoundary)');
        this.setState({ sending: false, sent: via || 'fail' });
    };

    render() {
        if (!this.state.error) return this.props.children;
        const { sending, sent } = this.state;
        const msg = {
            server: 'Лог надіслано розробнику ✓',
            share: 'Лог відкрито для надсилання ✓',
            clipboard: 'Лог скопійовано в буфер — надішліть розробнику',
            fail: 'Не вдалося надіслати лог',
        }[sent];
        const btn = { width: '100%', padding: '14px', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', marginTop: 10 };
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#0f1115', color: '#e6e8eb', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Сталася помилка</div>
                <div style={{ fontSize: 13.5, color: '#9aa0a6', maxWidth: 340, marginBottom: 8 }}>
                    Додаток зустрів несподівану ситуацію. Надішліть лог розробнику — це допоможе швидко виправити.
                </div>
                <div style={{ fontSize: 11.5, color: '#6b7177', maxWidth: 340, wordBreak: 'break-word', marginBottom: 16, fontFamily: 'monospace' }}>
                    {String(this.state.error && this.state.error.message || this.state.error).slice(0, 200)}
                </div>
                <div style={{ width: '100%', maxWidth: 340 }}>
                    <button onClick={this.send} disabled={sending} style={{ ...btn, background: '#3b82f6', color: '#fff', opacity: sending ? 0.6 : 1 }}>
                        {sending ? 'Надсилаю…' : 'Надіслати лог розробнику'}
                    </button>
                    <button onClick={() => window.location.reload()} style={{ ...btn, background: '#23262d', color: '#e6e8eb' }}>
                        Перезапустити додаток
                    </button>
                    {msg && <div style={{ marginTop: 14, fontSize: 13, color: sent === 'fail' ? '#f87171' : '#34d399' }}>{msg}</div>}
                </div>
            </div>
        );
    }
}
