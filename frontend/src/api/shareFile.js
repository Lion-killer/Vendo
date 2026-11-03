import { Capacitor } from '@capacitor/core';

// Файл → системний діалог «Поділитися» (#88, #89).
// На нативі файл уже лежить у кеші застосунку (його туди записав Filesystem.downloadFile),
// тож лишається взяти file-URI через наш FileProvider і віддати Share — жодного байта
// через JS не проходить.
// У браузері (dev) діалогу з файлом немає — просто завантажуємо Blob.
// Повертає 'share' або 'download'.
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
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    // Файл качався в Directory.Cache під цим же іменем — беремо його URI звідти.
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, files: [uri] });
    return 'share';
};
