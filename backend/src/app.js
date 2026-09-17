require('dotenv').config();

const express = require('express');
const cors = require('cors');

const clientesRoutes = require('./routes/clientesRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({
    ok: true,
    message: 'API OK',
  });
});

// Rutas de clientes: GET /api/clientes
app.use('/api/clientes', clientesRoutes);

module.exports = app;
