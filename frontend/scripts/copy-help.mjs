// Копіює канонічну довідку (docs/user-guide) у frontend для бандлінгу:
//   *.md            → src/help/         (імпортуються як ?raw, рендеряться react-markdown)
//   images/*.png    → public/help-images/ (статика, доступна офлайн у Capacitor)
// Канон лишається в docs/ (зручно для GitHub); ці копії — згенеровані, в .gitignore.
// Запускається автоматично через npm pre-хуки (predev/prebuild).
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');                       // frontend/
const srcGuide = join(root, '..', 'docs', 'user-guide');
const destMd = join(root, 'src', 'help');
const destImg = join(root, 'public', 'help-images');

rmSync(destMd, { recursive: true, force: true });
rmSync(destImg, { recursive: true, force: true });
mkdirSync(destMd, { recursive: true });
mkdirSync(destImg, { recursive: true });

for (const f of readdirSync(srcGuide)) {
    if (f.endsWith('.md')) cpSync(join(srcGuide, f), join(destMd, f));
}
cpSync(join(srcGuide, 'images'), destImg, { recursive: true });

console.log(`help: скопійовано .md → src/help, images → public/help-images`);
