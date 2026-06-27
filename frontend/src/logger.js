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

// Спроба вивантажити лог на бекенд (основний транспорт). Не через client.js — щоб
// уникнути циклічного імпорту; токен/адресу беремо з localStorage. На нативі шлемо через
// CapacitorHttp (як решта запитів) — інакше кастомні заголовки + JSON ловлять CORS-
// preflight у WebView і POST стабільно падає, через що API ніколи не спрацьовував.
const postToServer = async () => {
    const base = localStorage.getItem('vendo_api_url');
    if (!base || !navigator.onLine) return false;
    const headers = { 'Content-Type': 'application/json' };
    const dev = localStorage.getItem('vendo_device_id'); if (dev) headers['X-Device-Id'] = dev;
    const tok = localStorage.getItem('vendo_token'); if (tok) headers['X-Auth-Token'] = tok;
    const url = `${base}/logs`;
    const body = payload();
    try {
        const { Capacitor, CapacitorHttp } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
            const res = await CapacitorHttp.post({ url, headers, data: body });
            return res.status >= 200 && res.status < 300;
        }
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), 10000);
        const res = await fetch(url, {
            method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal,
        }).finally(() => clearTimeout(id));
        return res.ok;
    } catch { return false; }
};

// Uint8Array → base64 (для запису бінарного файлу через Filesystem). Чанками, щоб не
// впертись у ліміт аргументів String.fromCharCode на великих масивах.
const u8ToBase64 = (bytes) => {
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
};

// Запасне (коли API недоступний): системне «Поділитися». На нативі пакуємо лог у ZIP і
// ділимось файлом (надійно, компактно — месенджери приймають .zip; текст застосунки
// інколи обрізають). Якщо щось пішло не так — ділимось текстом. Динамічні імпорти не
// валять веб-збірку, якщо плагіна немає.
const shareReport = async (text) => {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
        try {
            const { zipSync, strToU8 } = await import('fflate');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipped = zipSync({ [`vendo-log-${stamp}.txt`]: strToU8(text) }, { level: 6 });
            const { Filesystem, Directory } = await import('@capacitor/filesystem');
            const fileName = `vendo-log-${Date.now()}.zip`;
            // Без encoding → Filesystem трактує data як base64 і пише байти.
            await Filesystem.writeFile({ path: fileName, data: u8ToBase64(zipped), directory: Directory.Cache });
            const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
            const { Share } = await import('@capacitor/share');
            await Share.share({ title: 'Vendo log', text: 'Лог Vendo (архів)', files: [uri] });
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
