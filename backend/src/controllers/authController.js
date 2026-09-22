const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const {
  NOMBRE_COOKIE,
  horasDeExpiracion,
  opcionesCookie,
} = require('../middleware/auth');

/*
  authController.js — Login / logout / estado de sesión del administrador.

  Diseño:
  - UN único administrador, definido por variables de entorno:
    ADMIN_USERNAME y ADMIN_PASSWORD_HASH (bcrypt). La contraseña nunca viaja
    en claro ni se guarda en el código: solo su hash.
  - Login correcto => se firma un JWT y se entrega en cookie HttpOnly.
  - Los mensajes de error del login son SIEMPRE genéricos: no se revela si
    falló el usuario o la contraseña.
  - Logout => se borra la cookie (el token deja de enviarse). Al ser JWT
    stateless no hay revocación inmediata del token residual, mitigado con
    expiración corta; es el trade-off aceptado para un único admin.
*/

// Credenciales del administrador (solo lectura de variables de entorno).
function credencialesAdmin() {
  return {
    usuario: process.env.ADMIN_USERNAME || '',
    hash: process.env.ADMIN_PASSWORD_HASH || '',
  };
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { usuario, contrasena } = req.body || {};

    // Campos obligatorios: se responde igual que las credenciales incorrectas
    // para no dar información sobre cuál campo falló.
    if (typeof usuario !== 'string' || typeof contrasena !== 'string' || usuario === '' || contrasena === '') {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const admin = credencialesAdmin();

    const usuarioCorrecto = usuario === admin.usuario;
    // bcrypt.compare es constante en tiempo respecto del hash; se ejecuta
    // aunque el usuario sea incorrecto para no filtrar por tiempo de respuesta.
    const claveCorrecta = await bcrypt.compare(contrasena, admin.hash || 'sin-hash');

    if (!usuarioCorrecto || !claveCorrecta) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Payload mínimo: solo el nombre del administrador. Nada de datos sensibles.
    const token = jwt.sign({ sub: usuario }, process.env.JWT_SECRET, {
      expiresIn: horasDeExpiracion() + 'h',
    });

    res.cookie(NOMBRE_COOKIE, token, opcionesCookie());

    return res.status(200).json({
      message: 'Sesión iniciada correctamente',
      usuario,
    });
  } catch (error) {
    console.error('Error en el login:', error.message);
    return res.status(500).json({ error: 'No se pudo iniciar la sesión' });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  // Borrar la cookie con las MISMAS opciones para que el navegador la elimine.
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());

  return res.status(200).json({ message: 'Sesión cerrada correctamente' });
}

// GET /api/auth/me
function me(req, res) {
  // Llega acá sólo si requireAuth validó la cookie.
  return res.status(200).json({ usuario: req.usuario });
}

module.exports = {
  login,
  logout,
  me,
};
