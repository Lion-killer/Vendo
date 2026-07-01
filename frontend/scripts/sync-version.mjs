// Синхронізація версії: package.json (єдине джерело) → android/app/build.gradle.
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
