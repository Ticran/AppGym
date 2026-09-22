const express = require('express');

const { login, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

/*
  Límite de intentos para el login: es el único punto de fuerza bruta del
  sistema. Contador simple en memoria por IP (suficiente para un solo admin
  y sin dependencias nuevas). Se bloquea tras MAXIMO_INTENTOS en la ventana;
  los fallos se descuentan al acertar.
*/
const MAXIMO_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000;

const intentos = new Map(); // ip -> { cantidad, inicio }

function limitarLogin(req, res, next) {
  const ahora = Date.now();
  const ip = req.ip || 'desconocida';
  const registro = intentos.get(ip);

  if (registro && ahora - registro.inicio < VENTANA_MS && registro.cantidad >= MAXIMO_INTENTOS) {
    return res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión. Esperá unos minutos e intentá nuevamente.',
    });
  }

  if (!registro || ahora - registro.inicio >= VENTANA_MS) {
    intentos.set(ip, { cantidad: 0, inicio: ahora });
  }

  req.registroLogin = intentos.get(ip);
  return next();
}

// Al fallar el login se suma el intento; al acertar se limpia la cuenta.
function registrarIntentoFallido(req) {
  if (req.registroLogin) {
    req.registroLogin.cantidad += 1;
  }
}

function envolverLogin(req, res, next) {
  limitarLogin(req, res, async () => {
    const enviarJSON = res.json.bind(res);

    // Intercepta el código de estado para saber si el login falló.
    res.json = (cuerpo) => {
      if (res.statusCode === 401) {
        registrarIntentoFallido(req);
      } else if (res.statusCode === 200) {
        intentos.delete(req.ip || 'desconocida');
      }

      return enviarJSON(cuerpo);
    };

    return login(req, res, next);
  });
}

// POST /api/auth/login -> público (única puerta de entrada).
router.post('/login', envolverLogin);

// POST /api/auth/logout -> público: borrar la cookie no expone datos.
router.post('/logout', logout);

// GET /api/auth/me -> protegido: confirma si la sesión es válida.
router.get('/me', requireAuth, me);

module.exports = router;
