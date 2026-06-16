const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Підключення роутів API
app.use('/api', apiRoutes);

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
});
