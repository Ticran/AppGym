const jwt = require('jsonwebtoken');

/*
  auth.js — Autenticación de la API (JWT en cookie HttpOnly).

  Estrategia confirmada para esta fase:
  - JWT firmado con JWT_SECRET, entregado en una cookie HttpOnly.
  - SameSite=Strict: desarrollo local es same-site (localhost) y la producción
    se despliega con frontend y API bajo el mismo site/dominio. Si algún día
    el frontend se publica en otro dominio, habrá que pasar a SameSite=None
    con Secure + protección CSRF explícita (fase nueva).
  - Secure únicamente cuando la app corre en HTTPS/producción: en
    http://localhost algunos navegadores rechazan cookies Secure.
  - El middleware requireAuth es la ÚNICA pieza que valida la sesión: los
    controladores no repiten lógica de autenticación.

  Aclaración de seguridad: HttpOnly evita que JavaScript LEA la cookie
  (mitiga el robo del token por XSS), pero no impide que un XSS ejecute
  acciones autenticadas desde el navegador mientras la sesión sea válida.
*/

const NOMBRE_COOKIE = 'appgym_token';

// Horas de validez configurables (default 12: una jornada del dueño).
function horasDeExpiracion() {
  const horas = Number(process.env.AUTH_EXPIRA_HORAS);

  return horas > 0 ? horas : 12;
}

// "Secure" solo en HTTPS/producción (o si se fuerza con COOKIE_SECURE=true).
function cookieEstaSegura() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }

  return process.env.NODE_ENV === 'production';
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieEstaSegura(),
    path: '/',
    maxAge: horasDeExpiracion() * 60 * 60 * 1000,
  };
}

function obtenerSecreto() {
  return process.env.JWT_SECRET || '';
}

/*
  Comprobación al arrancar: sin estas variables la API no debe levantar,
  porque quedaría sin usuario administrador o sin secreto para firmar.
  No imprime valores, solo nombres de variables.
*/
function verificarConfiguracion() {
  const faltantes = [];

  if (!process.env.ADMIN_USERNAME) faltantes.push('ADMIN_USERNAME');
  if (!process.env.ADMIN_PASSWORD_HASH) faltantes.push('ADMIN_PASSWORD_HASH');
  if (!process.env.JWT_SECRET) faltantes.push('JWT_SECRET');

  if (faltantes.length > 0) {
    throw new Error('Faltan variables de entorno de autenticación: ' + faltantes.join(', '));
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error('Advertencia: JWT_SECRET debería tener al menos 32 caracteres.');
  }
}

/*
  Middleware de protección: valida el JWT de la cookie y continúa solo si es
  válido. Respuestas: 401 { error } para todo lo no autenticado.
*/
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[NOMBRE_COOKIE] : undefined;

  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  let payload;

  try {
    payload = jwt.verify(token, obtenerSecreto());
  } catch (error) {
    // Token malformado, firma inválida o expirado: mismo mensaje para todos
    // los casos, sin detalles técnicos.
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  const usuario = typeof payload.sub === 'string' ? payload.sub : '';

  if (usuario === '') {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  req.usuario = usuario;
  return next();
}

module.exports = {
  NOMBRE_COOKIE,
  horasDeExpiracion,
  opcionesCookie,
  cookieEstaSegura,
  verificarConfiguracion,
  requireAuth,
};
