require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const clientesRoutes = require('./routes/clientesRoutes');
const pagosRoutes = require('./routes/pagosRoutes');
const authRoutes = require('./routes/authRoutes');
const { requireAuth, verificarConfiguracion } = require('./middleware/auth');

const app = express();

verificarConfiguracion();

/*
  CORS explícito por entorno:
  - Desarrollo: orígenes locales permitidos con credenciales (la cookie es
    same-site: localhost front y back comparten site aunque cambie el puerto).
    Se admiten 5173 (Vite/Live Server), 5500 (Live Server) y 8080.
  - Producción: CORS_ORIGEN con el único dominio válido (frontend y API
    publicados bajo el mismo site/dominio). Sin CORS_ORIGEN y sin entorno de
    desarrollo no se permite ningún origen con credenciales.
*/
function construirOrigenes() {
  if (process.env.CORS_ORIGEN) {
    return process.env.CORS_ORIGEN.split(',').map((origen) => origen.trim());
  }

  if (process.env.NODE_ENV !== 'production') {
    return [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ];
  }

  return [];
}

app.use(
  cors({
    origin: construirOrigenes(),
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Health-check público: no expone datos de la aplicación.
app.get('/api', (req, res) => {
  res.json({
    ok: true,
    message: 'API OK',
  });
});

// Autenticación: login, logout y me (me requiere sesión válida).
app.use('/api/auth', authRoutes);

// Rutas de datos: protegidas por el middleware requireAuth. Sin sesión
// válida, TODOS los endpoints de clientes y pagos responden 401.
app.use('/api/clientes', requireAuth, clientesRoutes);
app.use('/api/pagos', requireAuth, pagosRoutes);

module.exports = app;
