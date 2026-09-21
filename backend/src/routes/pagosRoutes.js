const express = require('express');

const {
  obtenerPagos,
  obtenerPagoPorId,
  crearPago,
  actualizarPago,
  eliminarPago,
} = require('../controllers/pagosController');

const router = express.Router();

// GET /api/pagos -> lista de pagos, con filtros opcionales por query string
// (?cliente=ID, ?anio=2026, ?mes=9, ?limite=50). Orden: del más reciente al más antiguo.
// (Las rutas se montan en app.js con el prefijo "/api/pagos".)
// Se registra antes de "/:id": al ser una ruta exacta, Express no la confunde
// con la ruta con parámetro.
router.get('/', obtenerPagos);

// POST /api/pagos -> registra un pago nuevo.
router.post('/', crearPago);

// PUT /api/pagos/:id -> actualiza un pago existente (parcial).
router.put('/:id', actualizarPago);

// GET /api/pagos/:id -> devuelve un único pago por su _id.
router.get('/:id', obtenerPagoPorId);

// DELETE /api/pagos/:id -> elimina un pago existente.
router.delete('/:id', eliminarPago);

module.exports = router;
