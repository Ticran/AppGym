const mongoose = require('mongoose');

/*
  Cliente.js — Modelo de Mongoose para los clientes del gimnasio.

  Refleja la estructura que ya usa el frontend (frontend/js/data.js):
  nombre, apellido, dni, telefono, fechaIngreso, cuotaActual y estado.

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
  // El DNI es OPCIONAL y su unicidad se resuelve con el índice único PARCIAL
  // definido más abajo (dni_unico_informado). Un `unique: true` simple creaba
  // el índice `dni_1`, que también cubría los DNI vacíos ("") y ausentes
  // (null) y bloqueaba el alta de un segundo cliente sin DNI (E11000).
  dni: {
    type: String,
    trim: true,
  },
  telefono: {
    type: String,
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
  estado: {
    type: String,
    required: [true, 'El estado es obligatorio'],
    enum: {
      values: ESTADOS_VALIDOS,
      message: 'El estado debe ser "Activo" o "Inactivo"',
    },
  },
});

/*
  Índice único PARCIAL para el DNI (reemplaza al índice simple que generaba
  `unique: true`, llamado `dni_1` en la base).

  El DNI es opcional: pueden existir muchos clientes sin DNI. El índice simple
  también cubre los valores vacíos ("") y ausentes (null), por lo que el alta
  de un segundo cliente sin DNI fallaba con E11000 ("Ya existe un cliente con
  ese DNI").

  El índice parcial sólo indexa DNI INFORMADOS (cadenas no vacías):
  - clientes sin DNI ("", null o campo ausente) quedan FUERA del índice y
    pueden ser tantos como haga falta;
  - un DNI real informado sigue siendo único en toda la colección.

  Nota de migración: Mongoose nunca borra índices existentes por su cuenta.
  El índice viejo `dni_1` debe eliminarse a mano (dropIndex) después de
  desplegar este cambio; no borra datos de clientes. Mientras siga existiendo
  `dni_1`, los DNI vacíos siguen bloqueados por ese índice anterior.
*/
clienteSchema.index(
  { dni: 1 },
  {
    unique: true,
    name: 'dni_unico_informado',
    // Sólo entran al índice los DNI informados: cadenas de tipo string
    // estrictamente mayores que "" en el orden BSON (es decir, no vacías).
    // "", null y campo ausente no matchean y por eso no generan duplicados.
    partialFilterExpression: { dni: { $type: 'string', $gt: '' } },
  }
);

// Se exporta el modelo para poder usarlo desde los controllers.
// Mongoose va a usar la colección "clientes" en MongoDB.
module.exports = mongoose.model('Cliente', clienteSchema);
