// Генерація CHANGELOG.md (корінь репо): розділ нової версії з conventional-комітів
// від останнього тега. Викликається npm-хуком "version" (після bump, до коміту) —
// нова версія вже в package.json, тож розділ потрапляє в реліз-коміт.
//
// Погодження перед публікацією: `--draft` друкує чернетку розділу (без запису).
// Якщо існує frontend/.changelog-draft.md (погоджений/відредагований текст) —
// у розділ іде ВІН, а не автогенерація; файл після цього видаляється.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BACKEND_FULL } from '../src/contract.js'; // #66 — мінімальний бекенд релізу, з коду

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(root, '..', 'CHANGELOG.md');
const draftPath = join(root, '.changelog-draft.md');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const sh = (cmd) => execSync(cmd, { cwd: root }).toString().trim();
let lastTag = '';
try { lastTag = sh('git describe --tags --abbrev=0'); } catch { /* тегів ще немає */ }
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const subjects = sh(`git log ${range} --no-merges --pretty=%s`).split('\n').filter(Boolean);

// Групування: feat → «Нове», fix → «Виправлення», решта → «Інше».
// Префікс type(scope): прибирається; scope лишається підказкою в дужках.
const groups = { 'Нове': [], 'Виправлення': [], 'Інше': [] };
for (const s of subjects) {
    const m = s.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/);
    if (!m) { groups['Інше'].push(s); continue; }
    const [, type, scope, desc] = m;
    const line = scope ? `${desc} (${scope})` : desc;
    if (type === 'feat') groups['Нове'].push(line);
    else if (type === 'fix') groups['Виправлення'].push(line);
    else groups['Інше'].push(line);
}

// Тіло розділу (без заголовка версії — він додається при записі).
let generated = '';
if (!lastTag) {
    // Перший реліз: не вивалювати всю історію (сотні комітів) — один підсумковий рядок.
    generated = '- Перший реліз Vendo.\n';
} else {
    for (const [title, items] of Object.entries(groups)) {
        if (!items.length) continue;
        generated += `### ${title}\n\n${items.map(i => `- ${i}`).join('\n')}\n\n`;
    }
}

// --draft: показати чернетку для погодження і вийти (нічого не писати).
if (process.argv.includes('--draft')) {
    process.stdout.write(generated);
    process.exit(0);
}

// Погоджений текст (якщо є) перемагає автогенерацію.
const approved = existsSync(draftPath) ? readFileSync(draftPath, 'utf8').trim() + '\n' : null;
const date = new Date().toISOString().slice(0, 10);
// Маркер вимог контракту (#66) — з коду (contract.js), невидимий у markdown. Йде в нотатки
// релізу; додаток парсить його з тіла релізу для гейта сумісності. Не у --draft (нижче).
const contractMarker = `<!-- vendo-contract: ${JSON.stringify({ minBackend: BACKEND_FULL })} -->`;
const section = `## v${version} — ${date}\n\n` + (approved ?? generated).trimEnd() + '\n\n' + contractMarker + '\n';

const header = '# Changelog\n\nІсторія версій Vendo. Генерується з комітів при релізі (`npm run release`).\n';
const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : header;
// Нова секція одразу після заголовка (найсвіжіша зверху).
const body = existing.startsWith(header)
    ? header + '\n' + section + existing.slice(header.length)
    : header + '\n' + section + '\n' + existing;
writeFileSync(changelogPath, body);
rmSync(draftPath, { force: true }); // чернетка використана — прибрати
console.log(`changelog: v${version} — ${approved ? 'погоджений текст' : `автогенерація, ${subjects.length} коміт(ів)`} від ${lastTag || 'початку'}`);
