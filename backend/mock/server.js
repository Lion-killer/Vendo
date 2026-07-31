const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Підключення роутів API
app.use('/api', apiRoutes);

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
});
