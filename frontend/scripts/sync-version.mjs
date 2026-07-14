// Синхронізація версії: package.json (єдине джерело) → android/app/build.gradle
// і Configuration.xml міні-конфігурації 1С (властивість Version — видно в Конфігураторі,
// дає звірити версію бекенда з релізом додатка).
// versionName = semver як є; versionCode = MAJOR*10000 + MINOR*100 + PATCH (монотонний,
// Android вимагає зростання коду для встановлення оновлення поверх старої версії).
// Запускається npm-хуком "version" при `npm version patch|minor|major`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const [maj, min, pat] = version.split('.').map(Number);
if ([maj, min, pat].some(Number.isNaN)) {
    console.error(`sync-version: некоректна версія "${version}" у package.json`);
    process.exit(1);
}
const code = Math.max(1, maj * 10000 + min * 100 + pat);

const gradlePath = join(root, 'android', 'app', 'build.gradle');
const gradle = readFileSync(gradlePath, 'utf8');
const updated = gradle
    .replace(/versionCode \d+/, `versionCode ${code}`)
    .replace(/versionName "[^"]*"/, `versionName "${version}"`);
if (updated === gradle && !gradle.includes(`versionCode ${code}`)) {
    console.error('sync-version: не знайшов versionCode/versionName у build.gradle');
    process.exit(1);
}
writeFileSync(gradlePath, updated);
console.log(`sync-version: ${version} → versionName "${version}", versionCode ${code}`);

// Версія міні-конфігурації 1С (перший <Version> у Properties Configuration.xml).
const cfgPath = join(root, '..', 'backend', '1c-config', 'TradeUkr23', 'src', 'Configuration.xml');
const cfg = readFileSync(cfgPath, 'utf8');
const cfgUpdated = cfg.replace(/<Version>[^<]*<\/Version>/, `<Version>${version}</Version>`);
if (cfgUpdated === cfg && !cfg.includes(`<Version>${version}</Version>`)) {
    console.error('sync-version: не знайшов <Version> у Configuration.xml');
    process.exit(1);
}
writeFileSync(cfgPath, cfgUpdated);
console.log(`sync-version: 1С Configuration.xml → Version ${version}`);

// Версія бекенду в /health (#66). Configuration.xml після об'єднання з УТ версію не несе
// (Метаданные.Версия = версія УТ), тому в HTTP-модулі 1С — рядок-літерал із маркером,
// який синкаємо тут. Mock віддає версію зі свого package.json — синкаємо і його.
const bslPath = join(root, '..', 'backend', '1c-config', 'TradeUkr23', 'src', 'HTTPServices', 'венд_МобильноеПриложение', 'Ext', 'Module.bsl');
const bsl = readFileSync(bslPath, 'utf8');
const bslUpdated = bsl.replace(/Возврат "[^"]*"; \/\/ vendo-sync-version/, `Возврат "${version}"; // vendo-sync-version`);
if (bslUpdated === bsl && !bsl.includes(`Возврат "${version}"; // vendo-sync-version`)) {
    console.error('sync-version: не знайшов маркер vendo-sync-version у Module.bsl HTTP-сервісу');
    process.exit(1);
}
writeFileSync(bslPath, bslUpdated);
console.log(`sync-version: 1С Module.bsl → ВерсияБекенда "${version}"`);

const mockPkgPath = join(root, '..', 'backend', 'mock', 'package.json');
const mockPkg = JSON.parse(readFileSync(mockPkgPath, 'utf8'));
mockPkg.version = version;
writeFileSync(mockPkgPath, JSON.stringify(mockPkg, null, 2) + '\n');
console.log(`sync-version: mock package.json → version ${version}`);

// Спека OpenAPI → макет 1С (#73). Канонічний backend/mock/openapi.json → макет із запеченою
// версією релізу в info.version (щоб /openapi.json показував версію бекенда). servers НЕ
// чіпаємо — 1С-обробник (ПреобразоватьСпекуПотоком) сам підставляє відносний шлях публікації
// потоково. Порядок ключів зберігаємо (JSON.parse/​stringify у V8 тримає порядок вставки).
// Пишемо з BOM (конвенція вивантаження макетів).
const spec = JSON.parse(readFileSync(join(root, '..', 'backend', 'mock', 'openapi.json'), 'utf8').replace(/^﻿/, ''));
spec.info = spec.info || {};
spec.info.version = version;            // присвоєння наявному ключу зберігає його позицію
const specDstPath = join(root, '..', 'backend', '1c-config', 'TradeUkr23', 'src',
    'Catalogs', 'венд_МобильныеУстройства', 'Templates', 'OpenAPI', 'Ext', 'Template.txt');
writeFileSync(specDstPath, '﻿' + JSON.stringify(spec, null, 2) + '\n');
console.log('sync-version: openapi.json → макет 1С OpenAPI (version запечено)');
