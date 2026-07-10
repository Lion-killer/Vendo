// Випуск релізу одною командою: npm run release [-- patch|minor|major|auto] (типово auto).
//
//   0. auto: тип із conventional-комітів від останнього тега
//      (`!`/BREAKING CHANGE → major; є feat → minor; інакше patch)
//   1. npm version <type>   — bump у package.json + sync build.gradle + CHANGELOG.md
//                             (хук "version") + коміт + git-тег vX.Y.Z (вимагає чистого дерева)
//   2. gradle assembleRelease — веб-збірка (таска buildFrontend) + підписаний APK
//   3. git push --follow-tags
//   4. gh release create vX.Y.Z <apk> — нотатки = свіжа секція CHANGELOG.md
//
// Підпис: android/vendo-release.keystore + android/keystore.properties (поза git).
// При першому запуску keystore генерується автоматично (keytool із JDK) — ЗРОБИ БЕКАП:
// втрата keystore = нові APK не встановляться поверх старих (інший підпис).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });
const sh = (cmd) => execSync(cmd, { cwd: root }).toString().trim();

// JDK потрібен і keytool'у, і gradle'у. Якщо JAVA_HOME не задано — беремо вбудований
// в Android Studio (JBR); execSync успадковує process.env, тож gradle його побачить.
if (!process.env.JAVA_HOME) {
    const jbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
    if (existsSync(join(jbr, 'bin'))) process.env.JAVA_HOME = jbr;
}
const keytool = process.env.JAVA_HOME ? `"${join(process.env.JAVA_HOME, 'bin', 'keytool')}"` : 'keytool';

let type = process.argv[2] || 'auto';
if (!['patch', 'minor', 'major', 'auto'].includes(type)) {
    console.error(`release: невідомий тип "${type}" (patch|minor|major|auto)`);
    process.exit(1);
}

// auto: тип релізу з conventional-комітів від останнього тега.
if (type === 'auto') {
    let lastTag = '';
    try { lastTag = sh('git describe --tags --abbrev=0'); } catch { /* перший реліз */ }
    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const log = sh(`git log ${range} --no-merges --pretty=%B`);
    const subjects = sh(`git log ${range} --no-merges --pretty=%s`).split('\n').filter(Boolean);
    if (!subjects.length) {
        console.error(`release: немає комітів від ${lastTag} — нічого релізити`);
        process.exit(1);
    }
    type = /^[a-z]+(\([^)]*\))?!:/m.test(log) || /BREAKING CHANGE/.test(log) ? 'major'
        : subjects.some(s => /^feat[(!:]/.test(s)) ? 'minor' : 'patch';
    console.log(`release: auto → ${type} (${subjects.length} коміт(ів) від ${lastTag || 'початку'})`);
}

// Keystore: створити при першому релізі, далі перевикористовується.
const ksFile = join(androidDir, 'vendo-release.keystore');
const ksProps = join(androidDir, 'keystore.properties');
if (!existsSync(ksFile)) {
    const pw = randomBytes(24).toString('base64url');
    console.log('release: keystore не знайдено — генерую новий (keytool із JDK)…');
    run(`${keytool} -genkeypair -v -keystore "${ksFile}" -alias vendo -keyalg RSA -keysize 2048 -validity 10000 -storepass "${pw}" -keypass "${pw}" -dname "CN=Vendo"`);
    writeFileSync(ksProps, `storeFile=../vendo-release.keystore\nstorePassword=${pw}\nkeyAlias=vendo\nkeyPassword=${pw}\n`);
    console.log('\n⚠️  ЗРОБИ БЕКАП android/vendo-release.keystore і android/keystore.properties');
    console.log('   (поза git; втрата = оновлення не встановляться поверх старих APK)\n');
}

// 1. Bump версії. npm version у підкаталозі репо НЕ комітить і не тегує (шукає .git
// поряд із package.json), тож git-частину робимо явно; хук "version" при цьому
// відпрацьовує (sync-version + changelog + git add їхніх файлів).
if (sh('git status --porcelain')) {
    console.error('release: робоче дерево брудне — закоміть або прибери зміни');
    process.exit(1);
}
run(`npm version ${type} --no-git-tag-version`);
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); // свіжа, після bump
const tag = `v${version}`;
run('git add package.json package-lock.json');
run(`git commit -m "release: ${tag}"`);
run(`git tag -a ${tag} -m "Vendo ${tag}"`); // анотований — його бачить і --follow-tags

// 2. Збірка підписаного APK (buildFrontend усередині збере і веб).
const gradlew = `"${join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')}"`;
run(`${gradlew} assembleRelease`, androidDir);
const apkSrc = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
if (!existsSync(apkSrc)) {
    console.error('release: не знайдено підписаний app-release.apk — перевір signingConfig');
    process.exit(1);
}
// Локальні копії APK — в окремому каталозі releases/ (gitignored), а не в корені frontend/:
// канонічне сховище — GitHub Releases, тут лише архів збірок.
const releasesDir = join(root, 'releases');
mkdirSync(releasesDir, { recursive: true });
const apk = join(releasesDir, `vendo-${tag}.apk`);
copyFileSync(apkSrc, apk);

// 3–4. Пуш і реліз на GitHub; нотатки — свіжа секція CHANGELOG.md (згенерована хуком version).
run('git push origin main');
run(`git push origin ${tag}`); // тег явно — не покладаємось на --follow-tags
const changelog = readFileSync(join(root, '..', 'CHANGELOG.md'), 'utf8');
const section = changelog.match(/## v[\s\S]*?(?=\n## v|$)/)?.[0] || '';
const notesFile = join(root, '.release-notes.md');
writeFileSync(notesFile, section.replace(/^## .*\n/, '')); // заголовок = назва релізу, в нотатках зайвий
try {
    run(`gh release create ${tag} "${apk}" --title "Vendo ${tag}" --notes-file "${notesFile}"`);
} finally {
    rmSync(notesFile, { force: true });
}
console.log(`\nreleased: ${tag} → https://github.com/Lion-killer/Vendo/releases/tag/${tag}`);
