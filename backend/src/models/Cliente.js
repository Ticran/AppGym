const mongoose = require('mongoose');

/*
  Cliente.js — Modelo de Mongoose para los clientes del gimnasio.

  Refleja la estructura que ya usa el frontend (frontend/js/data.js):
  nombre, apellido, dni, telefono, fechaIngreso, cuotaActual,
  fechaVencimiento y estado.

  Notas:
  - Las fechas se guardan como String en formato "AAAA-MM-DD", igual que en
    el frontend, para no cambiar el formato que la aplicación ya utiliza.
  - No se define un campo `id` numérico propio: se usa el `_id` que genera
    MongoDB/Mongoose automáticamente.
  - No se agregan timestamps ni campos extra.
*/

// Únicos valores válidos para el campo estado (igual que en el frontend).
const ESTADOS_VALIDOS = ['Activo', 'Inactivo'];

const clienteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
  },
  apellido: {
    type: String,
    required: [true, 'El apellido es obligatorio'],
    trim: true,
  },
  dni: {
    type: String,
    required: [true, 'El DNI es obligatorio'],
    unique: true,
    trim: true,
  },
  telefono: {
    type: String,
    required: [true, 'El teléfono es obligatorio'],
    trim: true,
  },
  fechaIngreso: {
    type: String,
    required: [true, 'La fecha de ingreso es obligatoria'],
    trim: true,
  },
  cuotaActual: {
    type: Number,
    required: [true, 'La cuota es obligatoria'],
    // El `min` de Mongoose es inclusivo (aceptaría 0), por eso se valida
    // aparte que el valor sea estrictamente mayor que 0, igual que el frontend.
    validate: {
      validator: (valor) => valor > 0,
      message: 'La cuota debe ser un número mayor que 0',
    },
  },
  fechaVencimiento: {
    type: String,
    required: [true, 'La fecha de vencimiento es obligatoria'],
    trim: true,
  },
  estado: {
    type: String,
    required: [true, 'El estado es obligatorio'],
    enum: {
      values: ESTADOS_VALIDOS,
      message: 'El estado debe ser "Activo" o "Inactivo"',
    },
  },
});

// Se exporta el modelo para poder usarlo desde los controllers.
// Mongoose va a usar la colección "clientes" en MongoDB.
module.exports = mongoose.model('Cliente', clienteSchema);
