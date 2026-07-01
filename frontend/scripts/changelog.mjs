// Генерація CHANGELOG.md (корінь репо): розділ нової версії з conventional-комітів
// від останнього тега. Викликається npm-хуком "version" (після bump, до коміту) —
// нова версія вже в package.json, тож розділ потрапляє в реліз-коміт.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(root, '..', 'CHANGELOG.md');
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

const date = new Date().toISOString().slice(0, 10);
let section = `## v${version} — ${date}\n`;
if (!lastTag) {
    // Перший реліз: не вивалювати всю історію (сотні комітів) — один підсумковий рядок.
    section += '\n- Перший реліз Vendo.\n';
} else {
    for (const [title, items] of Object.entries(groups)) {
        if (!items.length) continue;
        section += `\n### ${title}\n\n${items.map(i => `- ${i}`).join('\n')}\n`;
    }
}

const header = '# Changelog\n\nІсторія версій Vendo. Генерується з комітів при релізі (`npm run release`).\n';
const existing = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf8') : header;
// Нова секція одразу після заголовка (найсвіжіша зверху).
const body = existing.startsWith(header)
    ? header + '\n' + section + existing.slice(header.length)
    : header + '\n' + section + '\n' + existing;
writeFileSync(changelogPath, body);
console.log(`changelog: v${version} — ${subjects.length} коміт(ів) від ${lastTag || 'початку'}`);
