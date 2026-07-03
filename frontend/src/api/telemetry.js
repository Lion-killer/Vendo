// Телеметрія пристрою (#42): снапшоти стану в бекенд (в 1С — періодичний регістр
// відомостей, у списку пристроїв оператор бачить зріз останніх). Fire-and-forget:
// офлайн чи помилка відправки нічого не ламають, черги телеметрії немає.
//
// Лог їде РАЗОМ зі снапшотом і лише коли є що казати: з попереднього успішного
// відправлення з'явилися нові помилки (дедуплікація за маркером у localStorage),
// або оператор явно запросив повний лог (requestLog у відповіді).
import { getEntries, buildReport } from '../logger';
import { getLocalOrders } from './localOrders';
import { postTelemetry } from './client';

const MARK_KEY = 'vendo_telemetry_mark'; // t останнього запису журналу, покритого відправленим логом

// Мережеві таймаути — штатний офлайн польового додатка, помилками НЕ вважаються
// (інакше колонка «Помилки» в УТ була б ненульова в кожного агента щодня).
// «помилка мережі» — стабільний маркер таких записів у client.js (tfetch).
const isRealError = (e) => e.level === 'error' && String(e.msg).indexOf('помилка мережі') === -1;

const newErrorsSince = (mark) => getEntries().filter(e => isRealError(e) && (!mark || e.t > mark));

// Модель/ОС із User-Agent: на Android WebView UA містить "…; <модель> Build/…".
const deviceInfo = () => {
    const ua = navigator.userAgent;
    const m = /;\s*([^;)]+)\s+Build\//.exec(ua);
    const os = /Android\s([\d.]+)/.exec(ua);
    return { model: m ? m[1].trim() : 'web', os: os ? `Android ${os[1]}` : (navigator.platform || '') };
};

let inFlight = false; // не накладати снапшоти (retryFullLog викликає send рекурсивно)

// Надіслати снапшот. fullLog=true — позачерговий із повним логом (запит оператора).
export const sendTelemetry = async (fullLog = false) => {
    if (!navigator.onLine || (inFlight && !fullLog)) return;
    inFlight = true;
    try {
        const mark = localStorage.getItem(MARK_KEY) || '';
        const errs = newErrorsSince(mark);
        const withLog = fullLog || errs.length > 0;
        const lastMs = Number(localStorage.getItem('vendo_last_sync'));
        const payload = {
            version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
            ...deviceInfo(),
            lastSyncAt: lastMs ? new Date(lastMs).toISOString() : null,
            pendingOrders: getLocalOrders().length,
            ...(withLog ? { log: buildReport(fullLog ? 'запит оператора' : 'нові помилки'), logErrors: errs.length } : {}),
        };
        const res = await postTelemetry(payload);
        if (!res || res.ok !== true) return;
        if (withLog) {
            const entries = getEntries();
            if (entries.length) localStorage.setItem(MARK_KEY, entries[entries.length - 1].t);
        }
        if (res.requestLog && !fullLog) await sendTelemetry(true);
    } catch { /* тихо: наступний снапшот за розкладом */ }
    finally { inFlight = false; }
};
