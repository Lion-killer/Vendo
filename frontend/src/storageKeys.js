// Ключі localStorage — єдине джерело (#51): друкарська помилка в літералі означала б
// мовчазний баг (запис під одним ключем, читання під іншим). Без залежностей —
// імпортується будь-де, включно з `node --test` (deviceData, localOrders).
export const K = {
    token: 'vendo_token',            // bearer-токен (client.auth)
    session: 'vendo_session',        // сесія логіну (#24)
    apiUrl: 'vendo_api_url',         // адреса бекенду з QR
    deviceId: 'vendo_device_id',     // код прив'язки пристрою
    theme: 'vendo_theme',            // 'dark' | 'light'
    lang: 'vendo_lang',              // мова інтерфейсу
    priceType: 'vendo_price_type',   // вибраний тип цін у каталозі
    showNoStock: 'vendo_show_no_stock', // каталог: показувати товари без залишку (#76; типово off)
    loginNotice: 'vendo_login_notice', // i18n-ключ повідомлення на екрані входу (#40)
    lastSync: 'vendo_last_sync',     // час останньої успішної синхронізації (ms)
    localOrders: 'vendo_local_orders', // чернетки/черга замовлень
    draftSeq: 'vendo_draft_seq',     // лічильник чернеткових номерів ЧН-N
    log: 'vendo_log',                // кільцевий буфер логера
    netTimes: 'vendo_net_times',     // адаптивні таймаути per-ендпоінт
    syncHistory: 'vendo_sync_history', // історія прогонів синхронізації (#20)
    telemetryMark: 'vendo_telemetry_mark',        // маркер логу телеметрії (#42)
    telemetryNetMark: 'vendo_telemetry_net_mark', // маркер вікна таймаутів (#42)
    reqCount: 'vendo_req_count',     // лічильник запитів для телеметрії (#69), крім /health
    ordersStart: 'vendo_orders_start', // період списку замовлень
    ordersEnd: 'vendo_orders_end',
};

// Імена баз IndexedDB — не localStorage, але той самий принцип єдиного джерела.
export const IDB_DATA = 'vendo_data';
export const IDB_IMAGES = 'vendo_images';

// UI-налаштування — єдине, що переживає зміну пристрою (deviceData.purgeOnDeviceSwitch).
export const UI_PREFS = [K.theme, K.lang];
// «Очистити дані» (#34) лишає авторизацію + UI-налаштування — надмножина UI_PREFS,
// щоб обидві очистки були узгоджені з одного джерела.
export const CLEAR_KEEP = [K.token, K.deviceId, K.apiUrl, K.session, ...UI_PREFS];

// Легасі-ключі: читаються ЛИШЕ одноразовими міграціями.
export const LEGACY = {
    cachedData: 'cached_data_v2',    // → IndexedDB vendo_data (App.loadData)
    ordersStart: 'orders_startDate', // → K.ordersStart (єдині ключі без префікса vendo_)
    ordersEnd: 'orders_endDate',
};
