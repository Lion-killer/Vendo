// Чисті хелпери пристроїв (#85) — без доступу до стора, тому юніт-тестуються.
// Дзеркалять поведінку 1С (довідник венд_МобильныеУстройства + регістр
// венд_ТелеметрияУстройств): прив'язка кодом, хеш токена, глибина історії, чистка
// телеметрії за строком зберігання.
const { randomUUID, createHash } = require('crypto');

// Режими обробки замовлення (#65) — ті самі літерали, що в 1С (РежимыОбработкиЗаказа).
const ORDER_MODES = ['create', 'post', 'post_sale'];

// Секретний токен: два GUID без дефісів (~256 біт), як НовыйТокен() у 1С.
const newToken = () => (randomUUID() + randomUUID()).replace(/-/g, '');

// У стані зберігається ЛИШЕ хеш — сам токен клієнт отримує один раз (як у 1С).
const hashToken = (token) => createHash('sha256').update(String(token), 'utf8').digest('base64');

// Одноразовий код прив'язки: короткий, читається з екрана, без плутаних символів.
const newPairingCode = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I/O/0/1
    let code = '';
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
};

// Токен із заголовків: X-Auth-Token (основний) або Authorization: Bearer (фолбек) —
// той самий порядок, що в 1С (там Authorization перехоплює платформа).
const tokenFromHeaders = (headers = {}) => {
    const raw = String(headers['x-auth-token'] || headers['authorization'] || '').trim();
    return /^bearer /i.test(raw) ? raw.slice(7).trim() : raw;
};

// Список доступу пристрою → Set рядків або null.
// ponytail: null (порожній список) = БЕЗ обмеження, тобто «все». У 1С порожня ТЧ дає
// порожній результат (В ИЕРАРХИИ по пустому набору), але там списки заповнює оператор
// при заведенні картки; у моці свіжостворений пристрій, який не бачить нічого, читався б
// як зламаний стенд. Розбіжність не видно в контракті — фільтрація не виходить у відповідь.
const accessSet = (ids) => (Array.isArray(ids) && ids.length ? new Set(ids.map(String)) : null);
const allowed = (set, id) => !set || set.has(String(id));

// Доступ «в ієрархії» — як у 1С, де в ТЧ лежить УЗАГАЛЬНЕНЕ посилання: у списку може
// стояти сам елемент або група (категорія товарів / папка контрагентів), і тоді доступне
// все, що під нею, на будь-якій глибині. Повертає предикат (id, groupId) → доступно.
// groups — плоский список вузлів { id, parentId }.
const treeFilter = (refs, groups) => {
    const set = accessSet(refs);
    if (!set) return () => true; // порожній список = без обмеження
    const parent = new Map((groups || []).map(g => [String(g.id), g.parentId == null ? null : String(g.parentId)]));
    // Підйом по ланцюжку батьків; seen страхує від циклу в зіпсованих демо-даних.
    const underAllowedGroup = (groupId) => {
        const seen = new Set();
        let cur = groupId == null ? null : String(groupId);
        while (cur !== null && !seen.has(cur)) {
            if (set.has(cur)) return true;
            seen.add(cur);
            cur = parent.has(cur) ? parent.get(cur) : null;
        }
        return false;
    };
    return (id, groupId) => set.has(String(id)) || underAllowedGroup(groupId);
};

// Нижня межа історії замовлень (YYYY-MM-DD): глибина з картки пристрою, інакше —
// налаштування стенду. Як у 1С: кап діє НЕЗАЛЕЖНО від фільтра клієнта.
const historyStart = (device, defaultDays, nowMs = Date.now()) => {
    const days = Number(device?.historyDays) > 0 ? Number(device.historyDays) : Number(defaultDays);
    if (!(days > 0)) return null; // 0/не задано ніде — без обмеження
    return new Date(nowMs - days * 86400000).toISOString().slice(0, 10);
};

// Чистка історії телеметрії за строком зберігання (#53-подібно): прибираємо записи,
// старші за keepDays, АЛЕ лишаємо останній запис кожного пристрою — інакше список
// пристроїв спорожніє для тих, хто давно не виходив на зв'язок.
const pruneTelemetry = (list, keepDays, nowMs = Date.now()) => {
    const days = Number(keepDays);
    if (!(days > 0) || !Array.isArray(list)) return list || [];
    const cutoff = new Date(nowMs - days * 86400000).toISOString();
    const newest = new Map(); // deviceId → найсвіжіший at
    for (const e of list) {
        const prev = newest.get(e.deviceId);
        if (!prev || String(e.at) > prev) newest.set(e.deviceId, String(e.at));
    }
    return list.filter(e => String(e.at) >= cutoff || String(e.at) === newest.get(e.deviceId));
};

module.exports = {
    ORDER_MODES, newToken, hashToken, newPairingCode, tokenFromHeaders,
    accessSet, allowed, treeFilter, historyStart, pruneTelemetry,
};
