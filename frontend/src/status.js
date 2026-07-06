// Статуси замовлення — дротові ідентифікатори контракту (#48): бекенд віддає й приймає
// саме їх; відображуваний текст — локалі (`status.<id>`), колір — statusColor (тема).
export const STATUS = {
    NEW: "new",        // ще не відправлене (чернетка/локальне, у 1С не існує)
    SENT: "sent",      // прийняте бекендом, не проведене
    POSTED: "posted",  // проведене в 1С — лише перегляд
    DELETED: "deleted",// помічене на видалення
};

// Легасі-значення (до #48 контракт віддавав українські рядки; вони ж могли лишитися
// в кеші IndexedDB і локальній черзі localStorage). Нормалізуємо на входах даних.
const LEGACY = {
    "Нове": STATUS.NEW,
    "Відправлено": STATUS.SENT,
    "Проведено": STATUS.POSTED,
    "Видалено": STATUS.DELETED,
};
export const normalizeStatus = (s) => LEGACY[s] || s;
// Нормалізація замовлення з будь-якого джерела (сервер/кеш/локальна черга).
// sColor більше не використовується (колір — лише з теми) — прибираємо, щоб не тягнувся.
export const normalizeOrder = (o) => {
    if (!o) return o;
    const status = normalizeStatus(o.status);
    if (status === o.status && o.sColor === undefined) return o;
    const { sColor: _sColor, ...rest } = o; // rest-omit: викидаємо sColor зі старих записів
    return { ...rest, status };
};

// Колір статусу — ЄДИНЕ джерело (тільки токени теми, ніяких hex/значень із бекенду).
export const statusColor = (o, t) =>
    (o?.deletionMark || o?.status === STATUS.DELETED) ? t.err
        : o?.status === STATUS.POSTED ? t.inkSoft
        : o?.status === STATUS.SENT ? t.ok
        : o?.status === STATUS.NEW ? t.warn
        : t.inkMuted;
// М'який фон статусу (чипи) — семантичні Soft-токени замість hex-суфіксів прозорості.
export const statusBg = (o, t) =>
    (o?.deletionMark || o?.status === STATUS.DELETED) ? t.errSoft
        : o?.status === STATUS.POSTED ? t.surfaceMuted
        : o?.status === STATUS.SENT ? t.okSoft
        : o?.status === STATUS.NEW ? t.warnSoft
        : t.surfaceMuted;
