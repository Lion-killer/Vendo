const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Ліміт тіла піднято: телеметрія возить повний лог додатка (#42), а адмінка — правки
// демо-даних; типові express-ні 100 kb для цього замалі.
app.use(express.json({ limit: '5mb' }));

// Лог запитів. Обидва сервери тепер живуть в одному вікні (start.ps1), тому рядок
// підписаний джерелом і часом — інакше в спільній стрічці не зрозуміти, хто відповідав.
// LOG_REQUESTS=0 вимикає (наприклад, коли шумить пінг пристрою раз на 15 с).
const hhmmss = () => new Date().toTimeString().slice(0, 8);
app.use((req, res, next) => {
    if (process.env.LOG_REQUESTS === '0') return next();
    const started = Date.now();
    // Пишемо на finish, а не одразу: інакше не видно ні коду відповіді, ні тривалості.
    res.on('finish', () => console.log(
        `${hhmmss()} [api] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`));
    next();
});

// Підключення роутів API
app.use('/api', apiRoutes);

// Адмінка стенду (#85): JSON-API + одна сторінка. Обидва — лише з локальної машини
// (стенд публікується тунелем; перевірка всередині adminRoutes).
app.use('/admin/api', adminRoutes);
app.use('/admin', adminRoutes.localOnly, express.static(path.join(__dirname, 'public')));

// Документація контракту: OpenAPI-специфікація + Swagger UI (#28).
// UI вантажиться з CDN — без npm-залежностей; підходить для демо/розробки.
//
// #79: адресу першого сервера підставляємо з самого запиту, а не віддаємо як у файлі.
// Інакше при публікації моку назовні (тунель для тестування APK, демо замовнику)
// «Try it out» б'є в localhost браузера того, хто відкрив сторінку. Так само робить
// 1С-обробник (#73). Файл openapi.json лишається канонічним джерелом контракту —
// підміна лише на віддачі; читаємо щоразу, щоб правки спеки не вимагали перезапуску.
app.get('/api/openapi.json', (req, res) => {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'openapi.json'), 'utf8'));
    // За проксі беремо X-Forwarded-*: у Host там уже внутрішня адреса. Список через
    // кому (ланцюжок проксі) — перший елемент і є те, що бачив клієнт.
    const first = (v) => String(v || '').split(',')[0].trim();
    const proto = first(req.get('x-forwarded-proto')) || req.protocol;
    const host = first(req.get('x-forwarded-host')) || req.get('host');
    if (spec.servers && spec.servers[0] && host) spec.servers[0].url = `${proto}://${host}/api`;
    res.json(spec);
});
app.get('/api/docs', (req, res) => res.type('html').send(`<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vendo API — контракт</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: './openapi.json', dom_id: '#swagger', deepLinking: true });
  </script>
</body>
</html>`));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
    console.log(`API docs (Swagger UI): http://localhost:${PORT}/api/docs`);
    console.log(`Admin panel: http://localhost:${PORT}/admin`);

    // Чистка історії телеметрії за строком зберігання: при старті й раз на добу,
    // як робить 1С (ОчиститьУстаревшуюТелеметрию). Таймер unref — не тримає процес.
    apiRoutes.pruneHistory(true);
    const daily = setInterval(() => apiRoutes.pruneHistory(true), 86400000);
    if (daily.unref) daily.unref();
});
