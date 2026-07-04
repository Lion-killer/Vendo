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

const MARK_KEY = 'vendo_telemetry_mark';      // t останнього запису, покритого відправленим логом
const NET_MARK_KEY = 'vendo_telemetry_net_mark'; // t останнього снапшота — для лічильника таймаутів

// «помилка мережі» — стабільний маркер мережевих збоїв (таймаут/Failed to fetch) у client.js.
// Мережеві таймаути НЕ вважаються справжніми помилками (штатний офлайн польового додатка,
// інакше «Помилки» була б червона в кожного щодня) — але й не ховаються зовсім: їх рахує
// ОКРЕМИЙ лічильник netErrors (колонка «Таймаути»), щоб стійкі мережеві негаразди (повільний
// сервер/битий канал) були видні оператору, не змішуючись зі збоями самого додатка.
const isNetError = (e) => e.level === 'error' && String(e.msg).indexOf('помилка мережі') !== -1;
const isRealError = (e) => e.level === 'error' && !isNetError(e);

const newSince = (mark, pred) => getEntries().filter(e => pred(e) && (!mark || e.t > mark));

// Модель/ОС із User-Agent: на Android WebView UA містить "…; <модель> Build/…".
// До моделі доклеюється фізична роздільна здатність екрану (CSS-розмір × DPR,
// напр. "1080×2400" — як у налаштуваннях дисплея) — для розбору проблем верстки
// на конкретних екранах. Окреме поле в регістрі телеметрії не потрібне: оператор
// бачить це в колонці «Модель».
const deviceInfo = () => {
    const ua = navigator.userAgent;
    const m = /;\s*([^;)]+)\s+Build\//.exec(ua);
    const os = /Android\s([\d.]+)/.exec(ua);
    // Фолбек на вьюпорт: у вбудованих webview screen.* буває 0×0.
    const dpr = window.devicePixelRatio || 1;
    const scr = Math.round((window.screen.width || window.innerWidth) * dpr)
        + '×' + Math.round((window.screen.height || window.innerHeight) * dpr);
    return { model: `${m ? m[1].trim() : 'web'} (${scr})`, os: os ? `Android ${os[1]}` : (navigator.platform || '') };
};

let inFlight = false; // не накладати снапшоти (retryFullLog викликає send рекурсивно)

// Надіслати снапшот. fullLog=true — позачерговий із повним логом (запит оператора).
export const sendTelemetry = async (fullLog = false) => {
    if (!navigator.onLine || (inFlight && !fullLog)) return;
    inFlight = true;
    try {
        const mark = localStorage.getItem(MARK_KEY) || '';
        const errs = newSince(mark, isRealError);
        // Таймаути — за вікно від попереднього снапшота (свій маркер): показує ПОТОЧНИЙ
        // стан каналу, а не накопичення за всю сесію.
        const netMark = localStorage.getItem(NET_MARK_KEY) || '';
        const netErrs = newSince(netMark, isNetError);
        const withLog = fullLog || errs.length > 0;
        const lastMs = Number(localStorage.getItem('vendo_last_sync'));
        const payload = {
            version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
            ...deviceInfo(),
            lastSyncAt: lastMs ? new Date(lastMs).toISOString() : null,
            pendingOrders: getLocalOrders().length,
            netErrors: netErrs.length, // мережеві таймаути за вікно (окремо від logErrors)
            ...(withLog ? { log: buildReport(fullLog ? 'запит оператора' : 'нові помилки'), logErrors: errs.length } : {}),
        };
        const res = await postTelemetry(payload);
        if (!res || res.ok !== true) return;
        const entries = getEntries();
        if (entries.length) {
            const lastT = entries[entries.length - 1].t;
            if (withLog) localStorage.setItem(MARK_KEY, lastT); // лог покрив журнал до цієї точки
            localStorage.setItem(NET_MARK_KEY, lastT);          // вікно таймаутів — до цього снапшота
        }
        if (res.requestLog && !fullLog) await sendTelemetry(true);
    } catch { /* тихо: наступний снапшот за розкладом */ }
    finally { inFlight = false; }
};
