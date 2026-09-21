require('dotenv').config();

const express = require('express');
const cors = require('cors');

const clientesRoutes = require('./routes/clientesRoutes');
const pagosRoutes = require('./routes/pagosRoutes');

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

// Rutas de pagos: GET /api/pagos
app.use('/api/pagos', pagosRoutes);

module.exports = app;
