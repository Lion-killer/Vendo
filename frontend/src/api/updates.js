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
