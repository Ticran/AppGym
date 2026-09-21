const mongoose = require('mongoose');

const Cliente = require('../models/Cliente');
// Necesario para comprobar si un cliente tiene pagos antes de eliminarlo.
const Pago = require('../models/Pago');

// Campos que se pueden editar desde el endpoint. El `_id` no está en la lista,
// así que nunca se puede modificar.
const CAMPOS_EDITABLES = [
  'nombre',
  'apellido',
  'dni',
  'telefono',
  'fechaIngreso',
  'cuotaActual',
  'fechaVencimiento',
  'estado',
];

// Oculta cualquier connection string que pudiera venir dentro de un mensaje de
// error, para no filtrar credenciales en la consola.
function ocultarCredenciales(mensaje) {
  return String(mensaje).replace(/mongodb(\+srv)?:\/\/[^\s]+/g, 'mongodb://***');
}

/*
  GET /api/clientes
  Devuelve todos los clientes almacenados en MongoDB.
  Por ahora solo lee: no inserta, edita ni elimina nada.
*/
async function obtenerClientes(req, res) {
  try {
    const clientes = await Cliente.find();
    res.status(200).json(clientes);
  } catch (error) {
    // Solo se loguea el mensaje (sin URI ni credenciales) y al cliente se le
    // devuelve un mensaje genérico, sin detalles internos.
    console.error(`Error al obtener los clientes: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudieron obtener los clientes' });
  }
}

/*
  POST /api/clientes
  Crea UN solo cliente con los datos recibidos en el body (JSON).
  Las validaciones del schema son las que deciden si los datos sirven.
*/
async function crearCliente(req, res) {
  try {
    const cliente = await Cliente.create(req.body);
    res.status(201).json(cliente);
  } catch (error) {
    // Datos que no cumplen el schema: campos requeridos faltantes, cuota <= 0,
    // estado fuera del enum o tipos incompatibles (se ven como ValidationError).
    if (error.name === 'ValidationError') {
      const detalles = Object.keys(error.errors).map((campo) => error.errors[campo].message);
      console.error(`Datos inválidos al crear un cliente: ${detalles.join(' | ')}`);
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // DNI duplicado: el índice único del schema hace que MongoDB devuelva E11000.
    if (error.code === 11000) {
      console.error('Intento de crear un cliente con un DNI ya registrado');
      return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
    }

    console.error(`Error al crear un cliente: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo crear el cliente' });
  }
}

/*
  PUT /api/clientes/:id
  Actualiza UN SOLO cliente (el del _id indicado).

  Estrategia: actualización PARCIAL. Solo se aplican ($set) los campos editables
  que vengan en el body; los que no vengan quedan como estaban. Se usa $set (y no
  un reemplazo) para no borrar campos sin querer. El _id nunca se modifica.
*/
async function actualizarCliente(req, res) {
  try {
    const { id } = req.params;

    // Formato de ObjectId de MongoDB inválido.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    const cambios = {};
    CAMPOS_EDITABLES.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        cambios[campo] = req.body[campo];
      }
    });

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({
        error: 'Datos inválidos',
        detalles: ['No se enviaron campos para actualizar'],
      });
    }

    // `new: true` devuelve el documento ya actualizado.
    // `runValidators: true` ejecuta las validaciones del schema.
    // Sin `upsert`, así que un _id inexistente no crea nada (devuelve null).
    const cliente = await Cliente.findByIdAndUpdate(
      id,
      { $set: cambios },
      { new: true, runValidators: true }
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(cliente);
  } catch (error) {
    // Datos que no cumplen el schema (cuota <= 0, estado fuera del enum...).
    if (error.name === 'ValidationError') {
      const detalles = Object.keys(error.errors).map((campo) => error.errors[campo].message);
      console.error(`Datos inválidos al actualizar un cliente: ${detalles.join(' | ')}`);
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // Tipos incompatibles con el schema (por ejemplo cuotaActual: "abc").
    if (error.name === 'CastError') {
      console.error(`Tipo inválido al actualizar un cliente: ${error.message}`);
      return res.status(400).json({
        error: 'Datos inválidos',
        detalles: [`El campo "${error.path}" tiene un valor que no corresponde al tipo esperado`],
      });
    }

    // DNI que ya pertenece a otro cliente: índice único => E11000.
    if (error.code === 11000) {
      console.error('Intento de actualizar un cliente con un DNI ya registrado');
      return res.status(409).json({ error: 'Ya existe un cliente con ese DNI' });
    }

    console.error(`Error al actualizar un cliente: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo actualizar el cliente' });
  }
}

/*
  GET /api/clientes/:id
  Devuelve UN solo cliente (el del _id indicado). Solo lectura:
  no inserta, actualiza ni elimina nada.
*/
async function obtenerClientePorId(req, res) {
  try {
    const { id } = req.params;

    // Formato de ObjectId inválido: se responde directamente, sin consultar
    // MongoDB de forma innecesaria.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    const cliente = await Cliente.findById(id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json(cliente);
  } catch (error) {
    console.error(`Error al obtener el cliente: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo obtener el cliente' });
  }
}

/*
  DELETE /api/clientes/:id
  Elimina UN SOLO cliente (el del _id indicado), SIEMPRE que no tenga pagos
  registrados: los pagos son el historial del gimnasio y no pueden quedar
  huérfanos ni borrarse en cascada. La comprobación usa Pago.exists, que se
  apoya en el índice { cliente, anio, mes }: es una consulta de existencia y
  no carga ningún pago en memoria.
*/
async function eliminarCliente(req, res) {
  try {
    const { id } = req.params;

    // Formato de ObjectId inválido: se responde directamente, sin consultar
    // MongoDB de forma innecesaria.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    // El cliente con pagos no se puede eliminar: se bloquea con 409.
    const tienePagos = await Pago.exists({ cliente: id });

    if (tienePagos) {
      console.error('Intento de eliminar un cliente con pagos registrados');
      return res.status(409).json({
        error: 'No se puede eliminar el cliente',
        detalles: ['El cliente tiene pagos registrados y no puede ser eliminado'],
      });
    }

    const cliente = await Cliente.findByIdAndDelete(id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.status(200).json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error(`Error al eliminar un cliente: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo eliminar el cliente' });
  }
}

module.exports = {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  obtenerClientePorId,
  eliminarCliente,
};
