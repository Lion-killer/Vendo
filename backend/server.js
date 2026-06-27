const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Підключення роутів API
app.use('/api', apiRoutes);

// Документація контракту: OpenAPI-специфікація + Swagger UI (#28).
// UI вантажиться з CDN — без npm-залежностей; підходить для демо/розробки.
app.get('/api/openapi.json', (req, res) => res.sendFile(path.join(__dirname, 'openapi.json')));
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
