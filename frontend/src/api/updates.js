// Перевірка оновлень застосунку: анонімний GitHub Releases API (репозиторій публічний,
// токен не потрібен; ліміт 60 запитів/год з IP — перевіряємо раз за сесію).
// APK відкривається в системному браузері: він сам качає і пропонує встановити,
// тож у застосунку не потрібні ні дозволи на встановлення, ні стрімінг файлів.
// Список релізів (не /latest): щоб показати чейнджлоги ВСІХ пропущених версій, а не лише
// найновішої (користувач міг оновлюватися через кілька версій).
// @capacitor/core — статичний (client.js його однаково тягне в основний чанк); динамічним
// лишається лише те, що справді код-спліт (filesystem — потрібен тільки на нативі).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { cmpVer } from '../contract.js'; // з розширенням — файл ганяється й у node --test

export { cmpVer }; // жив тут історично; переїхав у contract.js (чистий — потрібен changelog.mjs у ноді)

const RELEASES_LIST = "https://api.github.com/repos/Lion-killer/Vendo/releases?per_page=30";

// Маркер вимог контракту в нотатках релізу (#66), напр.
// <!-- vendo-contract: {"minBackend":"0.17.0"} --> — вшиває changelog.mjs із коду.
const parseContractReq = (body) => {
    const m = String(body || "").match(/<!--\s*vendo-contract:\s*(\{[\s\S]*?\})\s*-->/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
};

let cached; // одна перевірка за сесію (undefined = ще не питали, null = оновлення немає)

// Повноекранний промпт оновлення показуємо раз за сесію —
// повернення на головний екран не дублює його.
let promptShown = false;
export const isUpdatePromptShown = () => promptShown;
export const markUpdatePromptShown = () => { promptShown = true; };

// Успішно завантажений APK цієї сесії — щоб повторна спроба (після надання
// дозволу на встановлення) не перекачувала 35+ МБ.
let downloaded = null; // { version, path }

// Нативне завантаження APK із прогресом і запуск системного встановлення.
// onProgress(0..100). Повертає:
//  'installing' — системний діалог встановлення відкрито;
//  'permission' — немає дозволу «встановлення невідомих застосунків» (APK уже
//                 завантажено; відкрий налаштування через openInstallSettings і повтори);
//  'web'        — не натив (браузер): відкрито URL, більше нічого не робимо.
// Помилки мережі/файлової системи кидаються виключенням.
export async function downloadAndInstall(update, onProgress) {
    if (!Capacitor.isNativePlatform()) {
        window.open(update.url, '_blank');
        return 'web';
    }
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const Installer = registerPlugin('ApkInstaller');

    if (!downloaded || downloaded.version !== update.version) {
        const path = `vendo-update-${update.version}.apk`;
        let sub;
        try {
            if (onProgress) {
                sub = await Filesystem.addListener('progress', e => {
                    if (e.contentLength > 0) onProgress(Math.min(100, Math.round(e.bytes / e.contentLength * 100)));
                });
            }
            const res = await Filesystem.downloadFile({ url: update.url, path, directory: Directory.Cache, progress: !!onProgress });
            downloaded = { version: update.version, path: res.path };
        } finally {
            if (sub) sub.remove();
        }
    } else if (onProgress) {
        onProgress(100); // файл уже в кеші з попередньої спроби
    }

    const { allowed } = await Installer.canInstall();
    if (!allowed) return 'permission';
    await Installer.install({ path: downloaded.path });
    return 'installing';
}

// Системні налаштування «встановлення невідомих застосунків» для цього застосунку.
export async function openInstallSettings() {
    await registerPlugin('ApkInstaller').openInstallSettings();
}

// Чистий відбір: масив релізів GitHub + встановлена версія → { version, notes, url } або null.
// notes — зшиті чейнджлоги ВСІХ версій, новіших за current (найновіша зверху); один
// пропущений реліз — нотатки як є, кілька — кожна із заголовком «## vX.Y.Z».
export function pickUpdate(list, current) {
    const newer = (Array.isArray(list) ? list : [])
        .map(r => ({ ...r, ver: String(r.tag_name || "").replace(/^v/, "") }))
        .filter(r => r.ver && !r.draft && !r.prerelease && cmpVer(current, r.ver) < 0)
        .sort((a, b) => cmpVer(b.ver, a.ver));
    if (newer.length === 0) return null;
    const target = newer[0]; // найновіша — її і встановлюємо
    const apk = (target.assets || []).find(a => a.name?.endsWith(".apk"));
    const notes = newer.length === 1
        ? (newer[0].body || "").trim()
        : newer.map(r => `## v${r.ver}\n\n${(r.body || "").trim()}`).join("\n\n");
    // req (#66) — вимоги контракту релізу з маркера; гейт «needsBackend» рахує App реактивно
    // від поточного /health (щоб не кешувати стан до логіну, коли бекенд ще невідомий).
    const req = parseContractReq(target.body);
    return { version: target.ver, notes, url: apk?.browser_download_url || target.html_url, req };
}

// → { version, notes, url, req } якщо є новіша версія, інакше null. Помилки мережі → null.
export async function checkForUpdate(current) {
    if (cached !== undefined) return cached;
    try {
        const res = await fetch(RELEASES_LIST, { headers: { Accept: "application/vnd.github+json" } });
        if (!res.ok) return (cached = null);
        cached = pickUpdate(await res.json(), current);
    } catch {
        cached = null; // офлайн/помилка — мовчки без оновлення (перевіриться в наступній сесії)
    }
    return cached;
}
