import {
    CapacitorBarcodeScanner,
    CapacitorBarcodeScannerTypeHint,
    CapacitorBarcodeScannerAndroidScanningLibrary,
} from '@capacitor/barcode-scanner';

// Відкриває нативний сканер QR і повертає зчитаний рядок ("" якщо скасовано).
// Android: ZXing (не залежить від Google Play ML Kit-модуля, який не вантажиться
// на частині емуляторів — інакше сканер не відкривається).
export async function scanQr() {
    const res = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanInstructions: 'Наведіть камеру на QR-код',
        android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.ZXING },
    });
    return (res?.ScanResult || '').trim();
}

// Парсинг вмісту QR. Підтримувані формати:
//   • JSON: {"deviceId":"...","apiUrl":"https://.../hs/vendo","code":"..."}
//   • URL із параметрами: https://host/hs/vendo?device=GUID&code=...
//   • просто URL бекенду  → apiUrl
//   • просто рядок         → deviceId (GUID пристрою)
// code — одноразовий код прив'язки; обмінюється на bearer-токен у /auth.
export function parseQr(raw) {
    if (!raw) return {};
    try {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object' && (o.deviceId || o.device || o.apiUrl || o.url)) {
            return { deviceId: o.deviceId || o.device, apiUrl: o.apiUrl || o.url, pairingCode: o.code || o.pairingCode };
        }
    } catch (e) { /* не JSON */ }
    try {
        const u = new URL(raw);
        const dev = u.searchParams.get('device') || u.searchParams.get('deviceId');
        const api = u.searchParams.get('url') || u.searchParams.get('api');
        const code = u.searchParams.get('code') || u.searchParams.get('pairingCode');
        if (dev || api || code) return { deviceId: dev || undefined, apiUrl: api || undefined, pairingCode: code || undefined };
        return { apiUrl: raw }; // URL без параметрів — адреса бекенду
    } catch (e) { /* не URL */ }
    return { deviceId: raw }; // простий рядок — ідентифікатор пристрою
}
