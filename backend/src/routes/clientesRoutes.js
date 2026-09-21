const express = require('express');

const {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  obtenerClientePorId,
  eliminarCliente,
} = require('../controllers/clientesController');

// El historial de pagos de un cliente se resuelve con el controlador de pagos
// (misma lógica de listado y orden), montado en una ruta anidada de clientes.
const { obtenerPagosDeCliente } = require('../controllers/pagosController');

const router = express.Router();

// GET /api/clientes -> lista completa de clientes.
// (Las rutas se montan en app.js con el prefijo "/api/clientes".)
// Se registra antes de "/:id": al ser una ruta exacta, Express no la confunde
// con la ruta con parámetro.
router.get('/', obtenerClientes);

// POST /api/clientes -> crea un cliente nuevo.
router.post('/', crearCliente);

// PUT /api/clientes/:id -> actualiza un cliente existente.
router.put('/:id', actualizarCliente);

// GET /api/clientes/:id/pagos -> historial de pagos del cliente (el más
// reciente primero). Se registra antes de "/:id" por claridad: son rutas de
// distinta cantidad de segmentos, así que no se confunden entre sí.
router.get('/:id/pagos', obtenerPagosDeCliente);

// GET /api/clientes/:id -> devuelve un único cliente por su _id.
router.get('/:id', obtenerClientePorId);

// DELETE /api/clientes/:id -> elimina un cliente existente.
router.delete('/:id', eliminarCliente);

module.exports = router;
