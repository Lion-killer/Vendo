// Дані в localStorage прив'язані до КОДУ ПРИСТРОЮ. Якщо сканують QR іншого пристрою
// (новий код ≠ збережений) — стираємо все, крім UI-налаштувань (тема/мова), щоб дані
// попереднього пристрою (кеш, чернетки, чергу, токен, сесію) не завантажились.
// Без імпортів → тестується через `node --test`.
export const DEVICE_PRESERVE = ['vendo_theme', 'vendo_lang'];

// Повертає true, якщо стирання відбулось (пристрій справді змінився). Перший вхід
// (немає збереженого коду) і повторний скан того самого пристрою нічого не стирають.
export const purgeOnDeviceSwitch = (newDeviceId, storage) => {
    if (!storage) return false;
    const prev = storage.getItem('vendo_device_id');
    if (!newDeviceId || !prev || prev === newDeviceId) return false;
    Object.keys(storage).forEach(k => { if (!DEVICE_PRESERVE.includes(k)) storage.removeItem(k); });
    return true;
};
