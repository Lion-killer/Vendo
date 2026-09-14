import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// Лог запитів dev-сервера — щоб у спільному вікні (start.ps1) було видно активність
// і фронтенду, і бекенду. Формат підписаний джерелом, як у моці: "чч:хх:сс [web] …".
// Модулі й HMR-службовку навмисно пропускаємо: одне завантаження сторінки — це сотні
// запитів на /src/*.jsx і /node_modules/.vite/deps, і корисні рядки в них тонуть.
// Помилки (>=400) показуємо завжди, навіть якщо це модуль.
const requestLog = () => ({
  name: 'vendo-request-log',
  apply: 'serve',
  configureServer(server) {
    // ?import/?raw — теж модулі (так vite тягне, наприклад, розділи довідки з src/help).
    const module = (url) => url.startsWith('/@') || url.startsWith('/node_modules/')
      || /\.(m?jsx?|tsx?|css|map)(\?|$)/.test(url) || /[?&](import|raw|url|worker)\b/.test(url);
    server.middlewares.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        if (res.statusCode < 400 && module(req.url || '')) return;
        const time = new Date().toTimeString().slice(0, 8);
        console.log(`${time} [web] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
      });
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), requestLog()],
  // Версія застосунку з package.json (єдине джерело) — доступна в коді як __APP_VERSION__.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
