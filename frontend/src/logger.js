// Логер додатку: кільцевий буфер останніх подій у localStorage (переживає краш і
// перезапуск), глобальні обробники помилок і відправка логу розробнику.
// Призначення — щоб після збою у полі можна було надіслати конкретні події, а не
// «нічого не працює». Транспорт: основний — POST /logs на бекенд; запасний (коли
// сервера/мережі немає) — системне «Поділитися»; останній — буфер обміну.

const KEY = 'vendo_log';
const MAX = 300; // кільцевий буфер: тримаємо лише останні MAX записів

const read = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};
// Ротація 1: кільцевий буфер за кількістю (MAX) — у log(). Ротація 2: за обсягом —
// якщо localStorage переповнений (QuotaExceeded), скидаємо старшу половину й повторюємо,
// щоб лог не «застигав» мовчки на старих подіях.
const write = (arr) => {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); return; } catch { /* квота */ }
    try { localStorage.setItem(KEY, JSON.stringify(arr.slice(-Math.ceil(arr.length / 2)))); } catch { /* здаємось */ }
};

// Безпечно скорочуємо великі значення, щоб лог не роздувся (тіла відповідей тощо).
const trim = (v) => {
    if (v == null) return v;
    let s;
    try { s = typeof v === 'string' ? v : JSON.stringify(v); } catch { s = String(v); }
    return s.length > 1000 ? s.slice(0, 1000) + `…(+${s.length - 1000})` : s;
};

export const log = (level, msg, data) => {
    const arr = read();
    arr.push({ t: new Date().toISOString(), level, msg: String(msg), data: data === undefined ? undefined : trim(data) });
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    write(arr);
};

export const logInfo = (msg, data) => log('info', msg, data);
export const logWarn = (msg, data) => log('warn', msg, data);
export const logError = (msg, data) => log('error', msg, data);

export const getEntries = () => read();
export const clearLog = () => write([]);

// Контекст пристрою — щоб розробник бачив, звідки лог.
const context = () => ({
    time: new Date().toISOString(),
    apiUrl: localStorage.getItem('vendo_api_url') || '',
    deviceId: localStorage.getItem('vendo_device_id') || '',
    lang: localStorage.getItem('vendo_lang') || '',
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    appVersion: (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'),
});

// Повний текстовий звіт (контекст + події) — те, що йде розробнику.
export const buildReport = (note) => {
    const ctx = context();
    const head = [
        `Vendo log — ${ctx.time}`,
        note ? `Причина: ${note}` : null,
        `Пристрій: ${ctx.deviceId}  API: ${ctx.apiUrl}  online: ${ctx.online}  lang: ${ctx.lang}`,
        ctx.userAgent,
        '─'.repeat(40),
    ].filter(Boolean).join('\n');
    const body = read().map(e =>
        `${e.t} [${e.level}] ${e.msg}${e.data !== undefined ? '  ' + e.data : ''}`
    ).join('\n');
    return head + '\n' + body;
};

// Структурований payload для серверного вивантаження.
const payload = (note) => ({ context: context(), note: note || '', entries: read() });

// Спроба вивантажити лог на бекенд (основний транспорт). Окремий fetch (не через
// client.js), щоб уникнути циклічного імпорту; токен/адресу беремо з localStorage.
const postToServer = async () => {
    const base = localStorage.getItem('vendo_api_url');
    if (!base || !navigator.onLine) return false;
    const headers = { 'Content-Type': 'application/json' };
    const dev = localStorage.getItem('vendo_device_id'); if (dev) headers['X-Device-Id'] = dev;
    const tok = localStorage.getItem('vendo_token'); if (tok) headers['X-Auth-Token'] = tok;
    try {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(`${base}/logs`, {
            method: 'POST', headers, body: JSON.stringify(payload()), signal: ctrl.signal,
        }).finally(() => clearTimeout(id));
        return res.ok;
    } catch { return false; }
};

// Запасне: системне «Поділитися». На нативі спершу формуємо лог-ФАЙЛ і ділимось ним
// (надійніше за text — застосунки не обрізають великий вміст), інакше — текстом.
// Динамічні імпорти — не валять веб-збірку, якщо плагін недоступний.
// ponytail: ділимось .txt, без zip — текст і так малий; додати архівацію (jszip), якщо
// лог почне сягати мегабайтів і месенджери відмовлятимуться приймати .txt.
const shareReport = async (text) => {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
        try {
            const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
            const fileName = `vendo-log-${Date.now()}.txt`;
            await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
            const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
            const { Share } = await import('@capacitor/share');
            await Share.share({ title: 'Vendo log', files: [uri] });
            return true;
        } catch { /* падаємо на текстовий шаринг нижче */ }
    }
    try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: 'Vendo log', text });
        return true;
    } catch { return false; }
};

// Надіслати лог: сервер → діалог «Поділитися». Повертає спосіб, що спрацював, або null.
export const sendLog = async (note) => {
    logInfo('Запит на надсилання логу', note);
    if (await postToServer()) return 'server';
    if (await shareReport(buildReport(note))) return 'share';
    return null;
};

// Глобальні обробники — ловлять усе, що не спіймали try/catch чи ErrorBoundary.
let installed = false;
export const installGlobalHandlers = () => {
    if (installed) return;
    installed = true;
    window.addEventListener('error', (e) => {
        logError('window.onerror', `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason;
        logError('unhandledrejection', r && r.stack ? r.stack : String(r));
    });
    logInfo('Старт додатку', context());
};
