// Каскад сумісності (#66) — на semver-версіях релізів: фронт і бекенд релізяться разом
// під однією версією (sync-version.mjs), тож версія бекенду з /health і є точкою відліку.
// Кожна сторона декларує СВІЙ поріг для іншої:
//  • BACKEND_FULL (тут, руками) — мінімальна версія бекенду для повної функціональності;
//  • minAppVersion (у /health, руками на бекенді) — мінімальний додаток, який бекенд ще
//    обслуговує; росте лише при зламній зміні контракту.
// Новіший бекенд + старіший додаток = сумісно (обмеження природні — старий додаток нових
// фіч не знає).
// Файл чистий (без залежностей) — його імпортує changelog.mjs у ноді.

// Бампати до ПОТОЧНОЇ версії package.json тим самим комітом, що додає залежність від
// нового endpoint'а. Деплої існують лише з релізів, тож жоден бекенд не звітує версію
// з проміжку між релізами — «поточна dev-версія» завжди коректний поріг.
export const BACKEND_FULL = '0.19.0'; // #68 intervals у /health (виходять у 0.19.0) — без них фонові цикли не працюють

// Порівняння semver-рядків: -1 (a<b) / 0 / 1. Толерує префікс v; нечислові сегменти → 0.
export const cmpVer = (a, b) => {
    const pa = String(a).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) < (pb[i] || 0) ? -1 : 1;
    }
    return 0;
};

// Каскад: відповідь /health + власна версія додатка → стан сумісності.
// Викликати ЛИШЕ коли health відомий (онлайн) — офлайн-null дав би хибне «обмеження».
// Бекенд без поля version (стара збірка, до #66) → "0" → старіший за все → limited.
export const checkCompat = (health, appVersion) => {
    const limited = cmpVer(health?.version || '0', BACKEND_FULL) < 0;
    const needsAppUpdate = !!health?.minAppVersion && cmpVer(appVersion, health.minAppVersion) < 0;
    return { ok: !limited && !needsAppUpdate, limited, needsAppUpdate };
};

// Інтервали фонових циклів (#68) — ЄДИНЕ джерело: /health.intervals. Фронт власних
// умолчань не має: null (бекенд поля не віддає — стара збірка) → жоден цикл не
// запускається; 0/некоректне значення → відповідний цикл вимкнено.
export const parseIntervals = (health) => {
    const i = health?.intervals;
    if (!i || typeof i !== 'object') return null;
    const sec = (v) => (Number.isFinite(+v) && +v > 0 ? Math.floor(+v) : 0);
    return { syncSec: sec(i.syncSec), pingSec: sec(i.pingSec), telemetrySec: sec(i.telemetrySec) };
};

