import { Capacitor } from '@capacitor/core';
import { u8ToBase64 } from '../logger';

// Файл → системний діалог «Поділитися» (#88). Той самий шлях, що й для архіву логу:
// пишемо в кеш застосунку, беремо file-URI через наш FileProvider і віддаємо Share.
// У браузері (dev) діалогу з файлом немає — просто завантажуємо файл.
// Повертає 'share' або 'download'; помилки кидає далі (викликач показує снек).
export const shareFile = async (blob, fileName, title) => {
    if (!Capacitor.isNativePlatform()) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return 'download';
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Без encoding → Filesystem трактує data як base64 і пише байти.
    await Filesystem.writeFile({ path: fileName, data: u8ToBase64(bytes), directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, files: [uri] });
    return 'share';
};
