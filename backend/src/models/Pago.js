const mongoose = require('mongoose');

/*
  Pago.js — Modelo de Mongoose para los pagos mensuales del gimnasio.

  Decisiones de diseño de esta fase:
  - `cliente` es una referencia (ObjectId) a la colección "clientes". No se
    embebe el cliente dentro del pago: el historial crece mes a mes y cada pago
    se lista, edita y elimina de forma independiente.
  - `anio` y `mes` son números (no una fecha) porque el sistema razona por mes
    calendario, que es exactamente lo que se anota en el cuaderno del gimnasio.
  - `fechaPago` se guarda como String "AAAA-MM-DD", igual que las fechas del
    modelo Cliente, para no cambiar el formato que ya usa la aplicación.
  - Los importes se redondean a 2 decimales para evitar errores de precisión
    monetaria (por ejemplo 0.1 + 0.2 = 0.30000000000000004).
  - Se agregan fechas de auditoría con `timestamps: true`. El modelo Cliente no
    las tiene, pero el historial de pagos sí necesita saber cuándo se registró y
    cuándo se editó cada pago.
  - Índice único compuesto { cliente, anio, mes }: garantiza EN LA BASE DE DATOS
    que un cliente no pueda tener dos pagos del mismo mes y año, incluso si dos
    peticiones simultáneas pasan la comprobación previa del controlador.
  - Este modelo NO modifica nada del modelo Cliente ni de la colección
    "clientes": es una colección nueva ("pagos") y aditiva.
*/

// Único estado válido por ahora: todo pago registrado es un pago efectivamente
// cobrado. No hay pagos parciales ni pagos pendientes en esta fase.
const ESTADOS_VALIDOS = ['Pagado'];

// Redondea a 2 decimales (redondeo monetario).
function redondearADosDecimales(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// Valida el formato "AAAA-MM-DD" y que sea una fecha real del calendario
// (rechaza, por ejemplo, "2026-02-30" o "2026-13-01").
function esFechaISOValida(valor) {
  if (typeof valor !== 'string') {
    return false;
  }

  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());

  if (!coincidencia) {
    return false;
  }

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

// Valida que sea un número entero (mes y año no admiten decimales).
function esEntero(valor) {
  return typeof valor === 'number' && Number.isInteger(valor);
}

const pagoSchema = new mongoose.Schema(
  {
    cliente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: [true, 'El cliente es obligatorio'],
    },
    anio: {
      type: Number,
      required: [true, 'El año es obligatorio'],
      validate: {
        validator: (valor) => esEntero(valor) && valor >= 2000 && valor <= 2100,
        message: 'El año debe ser un número entero entre 2000 y 2100',
      },
    },
    mes: {
      type: Number,
      required: [true, 'El mes es obligatorio'],
      min: [1, 'El mes debe estar entre 1 y 12'],
      max: [12, 'El mes debe estar entre 1 y 12'],
      validate: {
        validator: esEntero,
        message: 'El mes debe ser un número entero entre 1 y 12',
      },
    },
    // Importe base de la cuota correspondiente a ese mes. Puede diferir de la
    // cuota actual del cliente: es el valor que rige para el mes pagado.
    importeCuota: {
      type: Number,
      required: [true, 'El importe de la cuota es obligatorio'],
      set: redondearADosDecimales,
      validate: {
        validator: (valor) => valor > 0,
        message: 'El importe de la cuota debe ser un número mayor que 0',
      },
    },
    // Porcentaje de recargo aplicado (0 = sin recargo).
    porcentajeRecargo: {
      type: Number,
      required: [true, 'El porcentaje de recargo es obligatorio'],
      set: redondearADosDecimales,
      min: [0, 'El porcentaje de recargo no puede ser negativo'],
    },
    importeRecargo: {
      type: Number,
      required: [true, 'El importe del recargo es obligatorio'],
      set: redondearADosDecimales,
      min: [0, 'El importe del recargo no puede ser negativo'],
    },
    // Campo derivado: importeCuota + importeRecargo. Lo calcula el controlador.
    importeTotal: {
      type: Number,
      required: [true, 'El importe total es obligatorio'],
      set: redondearADosDecimales,
      validate: {
        validator: (valor) => valor > 0,
        message: 'El importe total debe ser un número mayor que 0',
      },
    },
    importePagado: {
      type: Number,
      required: [true, 'El importe pagado es obligatorio'],
      set: redondearADosDecimales,
      validate: {
        validator: (valor) => valor > 0,
        message: 'El importe pagado debe ser un número mayor que 0',
      },
    },
    fechaPago: {
      type: String,
      required: [true, 'La fecha de pago es obligatoria'],
      trim: true,
      validate: {
        validator: esFechaISOValida,
        message: 'La fecha de pago debe tener el formato AAAA-MM-DD y ser una fecha válida',
      },
    },
    estado: {
      type: String,
      required: [true, 'El estado es obligatorio'],
      enum: {
        values: ESTADOS_VALIDOS,
        message: 'El estado debe ser "Pagado"',
      },
      default: 'Pagado',
    },
    // Opcional: nueva cuota propuesta para el mes siguiente. En esta fase es
    // solo informativa: NO modifica `cuotaActual` del cliente.
    nuevaCuotaMesSiguiente: {
      type: Number,
      set: redondearADosDecimales,
      validate: {
        validator: (valor) => valor > 0,
        message: 'La nueva cuota del mes siguiente debe ser un número mayor que 0',
      },
    },
  },
  { timestamps: true }
);

// Un cliente no puede tener dos pagos para el mismo mes y año.
pagoSchema.index(
  { cliente: 1, anio: 1, mes: 1 },
  { unique: true, name: 'cliente_anio_mes_unico' }
);

// Se exporta el modelo para poder usarlo desde los controllers.
// Mongoose va a usar la colección "pagos" en MongoDB.
module.exports = mongoose.model('Pago', pagoSchema);
