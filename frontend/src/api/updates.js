// Перевірка оновлень застосунку: анонімний GitHub Releases API (репозиторій публічний,
// токен не потрібен; ліміт 60 запитів/год з IP — перевіряємо раз за сесію).
// APK відкривається в системному браузері: він сам качає і пропонує встановити,
// тож у застосунку не потрібні ні дозволи на встановлення, ні стрімінг файлів.
const RELEASES_LATEST = "https://api.github.com/repos/Lion-killer/Vendo/releases/latest";

// Порівняння semver-рядків: -1 (a<b) / 0 / 1. Нечислові сегменти → 0.
export const cmpVer = (a, b) => {
    const pa = String(a).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
    }
    return 0;
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
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
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
    const { registerPlugin } = await import('@capacitor/core');
    await registerPlugin('ApkInstaller').openInstallSettings();
}

// → { version, notes, url } якщо на GitHub є новіша версія, інакше null. Помилки мережі → null.
export async function checkForUpdate(current) {
    if (cached !== undefined) return cached;
    try {
        const res = await fetch(RELEASES_LATEST, { headers: { Accept: "application/vnd.github+json" } });
        if (!res.ok) return (cached = null);
        const rel = await res.json();
        const version = String(rel.tag_name || "").replace(/^v/, "");
        if (!version || cmpVer(current, version) >= 0) return (cached = null);
        const apk = (rel.assets || []).find(a => a.name?.endsWith(".apk"));
        cached = { version, notes: rel.body || "", url: apk?.browser_download_url || rel.html_url };
    } catch {
        cached = null; // офлайн/помилка — мовчки без оновлення (перевіриться в наступній сесії)
    }
    return cached;
}
