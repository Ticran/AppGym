const mongoose = require('mongoose');

const Cliente = require('../models/Cliente');
const Pago = require('../models/Pago');

/*
  pagosController.js — Lógica de los pagos mensuales (colección "pagos").

  Reglas de negocio implementadas en ESTA fase:
  - Un cliente paga una vez por mes (índice único { cliente, anio, mes }).
  - No se permiten pagos de meses futuros ni fechas de pago futuras.
  - El recargo predeterminado es 10% cuando la fecha de pago es el día 11 o
    posterior; hasta el día 10 inclusive no corresponde recargo.
  - El porcentaje de recargo puede personalizarse (por ejemplo 0 para dejarlo
    sin recargo). Si el dueño lo envía explícitamente, se respeta y nunca se
    sobrescribe con el valor predeterminado.
  - importeTotal = importeCuota + importeRecargo (lo calcula el backend).
  - No hay pagos parciales en esta fase: importePagado debe coincidir con
    importeTotal.
  - `nuevaCuotaMesSiguiente` es solo informativa: NO modifica `cuotaActual` del
    cliente (esa actualización queda para una fase posterior).

  Todas las validaciones se hacen en el backend: el frontend no es confiable.
*/

// ---------- Constantes de negocio ----------

// Hasta el día 10 inclusive no corresponde recargo; desde el 11 se aplica el
// porcentaje predeterminado.
const DIA_LIMITE_SIN_RECARGO = 10;
const PORCENTAJE_RECARGO_PREDETERMINADO = 10;

// Diferencia tolerada al comparar importes con decimales (redondeos).
const TOLERANCIA_MONETARIA = 0.01;

// Máximo de resultados que se pueden pedir con el filtro `limite`.
const MAXIMO_POR_PAGINA = 500;

// Zona horaria usada para decidir "mes actual" y "fecha de hoy". Se puede
// cambiar con la variable de entorno TZ_APP sin tocar el código; si no está
// definida se usa la de Argentina (el servidor puede estar en UTC).
const ZONA_HORARIA = process.env.TZ_APP || 'America/Argentina/Buenos_Aires';

// Campos que se pueden crear/editar desde los endpoints. `_id`, `createdAt` y
// `updatedAt` nunca se pueden modificar.
const CAMPOS_EDITABLES = [
  'cliente',
  'anio',
  'mes',
  'importeCuota',
  'porcentajeRecargo',
  'importeRecargo',
  'importePagado',
  'fechaPago',
  'estado',
  'nuevaCuotaMesSiguiente',
];

// Del pago más reciente al más antiguo.
const ORDEN_HISTORIAL = { anio: -1, mes: -1, fechaPago: -1, _id: -1 };

// ---------- Utilidades ----------

// Oculta cualquier connection string que pudiera venir dentro de un mensaje de
// error, para no filtrar credenciales en la consola.
function ocultarCredenciales(mensaje) {
  return String(mensaje).replace(/mongodb(\+srv)?:\/\/[^\s]+/g, 'mongodb://***');
}

// Redondeo monetario a 2 decimales.
function redondearADosDecimales(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// Convierte a número. Acepta números y strings numéricos ("25000.50").
// Devuelve null si el valor no es un número válido.
function aNumero(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return valor;
  }

  if (typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor.trim())) {
    return Number(valor.trim());
  }

  return null;
}

// Valida el formato "AAAA-MM-DD" y que sea una fecha real del calendario.
// (Misma regla que aplica el schema del modelo Pago.)
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

// Fecha de hoy ("AAAA-MM-DD") en la zona horaria configurada.
function obtenerFechaDeHoy() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;

  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

// Año y mes actuales en la zona horaria configurada.
function obtenerMesActual() {
  const hoy = obtenerFechaDeHoy();

  return { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
}

// Un mes posterior al mes actual no se puede registrar (no hay pagos
// adelantados). Un mes anterior sí: es un pago atrasado.
function esMesFuturo(anio, mes) {
  const actual = obtenerMesActual();

  return anio > actual.anio || (anio === actual.anio && mes > actual.mes);
}

// Porcentaje de recargo que corresponde por defecto según la fecha de pago.
function porcentajeRecargoPredeterminado(fechaPago) {
  const dia = Number(String(fechaPago).slice(8, 10));

  return dia > DIA_LIMITE_SIN_RECARGO ? PORCENTAJE_RECARGO_PREDETERMINADO : 0;
}

// ---------- Validaciones de campos ----------
// Los validadores sólo comprueban el FORMATO del valor recibido; la
// obligatoriedad de cada campo la decide el endpoint (POST exige todos los
// campos base, PUT sólo valida los que vienen en el body).

function validarCampoCliente(valor, detalles) {
  if (!mongoose.Types.ObjectId.isValid(String(valor))) {
    detalles.push('El ID de cliente es inválido');
    return false;
  }

  return true;
}

function validarCampoAnio(valor, detalles) {
  const anio = aNumero(valor);

  if (anio === null || !Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    detalles.push('El año debe ser un número entero entre 2000 y 2100');
    return false;
  }

  return true;
}

function validarCampoMes(valor, detalles) {
  const mes = aNumero(valor);

  if (mes === null || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    detalles.push('El mes debe ser un número entero entre 1 y 12');
    return false;
  }

  return true;
}

function validarCampoFechaPago(valor, detalles) {
  if (!esFechaISOValida(valor)) {
    detalles.push('La fecha de pago debe tener el formato AAAA-MM-DD y ser una fecha válida');
    return false;
  }

  return true;
}

// Valida un importe. `etiqueta` es el nombre legible que se muestra en el error.
function validarCampoImporte(valor, etiqueta, detalles, permitirCero = false) {
  const numero = aNumero(valor);

  if (numero === null) {
    detalles.push(`El ${etiqueta} debe ser un número`);
    return false;
  }

  if (permitirCero && numero < 0) {
    detalles.push(`El ${etiqueta} no puede ser negativo`);
    return false;
  }

  if (!permitirCero && numero <= 0) {
    detalles.push(`El ${etiqueta} debe ser un número mayor que 0`);
    return false;
  }

  return true;
}

// Comprueba que el pago no corresponda a un mes posterior al mes actual
// (no se permiten pagos adelantados).
function validarMesNoFuturo(anio, mes, detalles) {
  if (esMesFuturo(anio, mes)) {
    const actual = obtenerMesActual();
    detalles.push(
      `No se pueden registrar pagos de meses futuros (el mes actual es ${actual.mes}/${actual.anio})`
    );
    return false;
  }

  return true;
}

// Comprueba que la fecha de pago no sea posterior a hoy.
function validarFechaNoFutura(fechaPago, detalles) {
  if (fechaPago > obtenerFechaDeHoy()) {
    detalles.push('La fecha de pago no puede ser posterior a la fecha de hoy');
    return false;
  }

  return true;
}

// Busca un pago ya existente del mismo cliente, mes y año.
// `excluirId` se usa en la edición para no chocar con el propio pago.
function buscarPagoDuplicado(cliente, anio, mes, excluirId = null) {
  const filtro = { cliente, anio, mes };

  if (excluirId) {
    filtro._id = { $ne: excluirId };
  }

  return Pago.findOne(filtro);
}

// ---------- GET /api/pagos ----------
/*
  Devuelve los pagos almacenados, del más reciente al más antiguo.
  Filtros opcionales por query string:
    ?cliente=ID   ?anio=2026   ?mes=9   ?limite=50
  Se pueden combinar (por ejemplo ?cliente=ID&anio=2026&mes=9).
*/
async function obtenerPagos(req, res) {
  try {
    const { cliente, anio, mes, limite } = req.query;
    const detalles = [];
    const filtros = {};

    if (cliente !== undefined) {
      if (validarCampoCliente(cliente, detalles)) {
        filtros.cliente = cliente;
      }
    }

    if (anio !== undefined) {
      if (validarCampoAnio(anio, detalles)) {
        filtros.anio = aNumero(anio);
      }
    }

    if (mes !== undefined) {
      if (validarCampoMes(mes, detalles)) {
        filtros.mes = aNumero(mes);
      }
    }

    let limiteValidado = null;

    if (limite !== undefined) {
      const numeroLimite = aNumero(limite);

      if (
        numeroLimite === null ||
        !Number.isInteger(numeroLimite) ||
        numeroLimite < 1 ||
        numeroLimite > MAXIMO_POR_PAGINA
      ) {
        detalles.push(`El límite debe ser un número entero entre 1 y ${MAXIMO_POR_PAGINA}`);
      } else {
        limiteValidado = numeroLimite;
      }
    }

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    let consulta = Pago.find(filtros).sort(ORDEN_HISTORIAL);

    if (limiteValidado !== null) {
      consulta = consulta.limit(limiteValidado);
    }

    const pagos = await consulta;

    res.status(200).json(pagos);
  } catch (error) {
    console.error(`Error al obtener los pagos: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudieron obtener los pagos' });
  }
}

// ---------- GET /api/pagos/:id ----------
// Devuelve UN solo pago. Sólo lectura.
async function obtenerPagoPorId(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de pago inválido' });
    }

    const pago = await Pago.findById(id);

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.status(200).json(pago);
  } catch (error) {
    console.error(`Error al obtener el pago: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo obtener el pago' });
  }
}

// ---------- GET /api/clientes/:id/pagos ----------
/*
  Historial de pagos de un cliente, del más reciente al más antiguo.
  Reutiliza ORDEN_HISTORIAL y el modelo Pago, así que no duplica la lógica de
  listado: sólo agrega la verificación de que el cliente exista.
*/
async function obtenerPagosDeCliente(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de cliente inválido' });
    }

    const clienteExiste = await Cliente.exists({ _id: id });

    if (!clienteExiste) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const pagos = await Pago.find({ cliente: id }).sort(ORDEN_HISTORIAL);

    res.status(200).json(pagos);
  } catch (error) {
    console.error(
      `Error al obtener los pagos del cliente: ${ocultarCredenciales(error.message)}`
    );
    res.status(500).json({ error: 'No se pudieron obtener los pagos del cliente' });
  }
}

// ---------- Utilidades de entrada / salida ----------

// Un campo está "presente" cuando viene con un valor utilizable en el body.
function estaPresente(valor) {
  return valor !== undefined && valor !== null && valor !== '';
}

// Respuesta de error centralizada para este controlador: mantiene el mismo
// formato JSON que clientesController y no expone detalles internos.
function responderErrorDePago(error, res, accion, mensajeGenerico) {
  if (error.name === 'ValidationError') {
    const detalles = Object.keys(error.errors).map((campo) => error.errors[campo].message);
    console.error(`Datos inválidos al ${accion} un pago: ${detalles.join(' | ')}`);
    return res.status(400).json({ error: 'Datos inválidos', detalles });
  }

  // Tipos incompatibles con el schema (por ejemplo un ObjectId mal formado).
  if (error.name === 'CastError') {
    console.error(`Tipo inválido al ${accion} un pago: ${error.message}`);
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: [`El campo "${error.path}" tiene un valor que no corresponde al tipo esperado`],
    });
  }

  // Índice único { cliente, anio, mes }: dos peticiones simultáneas.
  if (error.code === 11000) {
    console.error('Intento de registrar un pago duplicado (mismo cliente, mes y año)');
    return res.status(409).json({ error: 'Ya existe un pago de ese cliente para ese mes y año' });
  }

  console.error(`Error al ${accion} un pago: ${ocultarCredenciales(error.message)}`);
  return res.status(500).json({ error: mensajeGenerico });
}

// ---------- POST /api/pagos ----------
/*
  Registra UN pago. Códigos: 201 creado, 400 datos inválidos, 404 cliente
  inexistente, 409 pago duplicado, 500 error interno.

  Cálculo de importes (el backend es la autoridad):
  - importeCuota: si no se envía, se toma `cuotaActual` del cliente (la cuota
    puede cambiar mes a mes, por eso se permite enviar otro valor).
  - porcentajeRecargo: si NO se envía, se aplica el valor predeterminado (10%
    desde el día 11; 0% hasta el día 10 inclusive). Si se envía, se respeta
    tal cual: así el dueño puede dejarlo en 0 o acordar otro porcentaje.
  - importeRecargo: se calcula como porcentajeRecargo% de importeCuota. Si el
    dueño lo envía, debe coincidir con ese cálculo (tolerancia de $0,01): un
    acuerdo especial se representa con importeCuota / porcentajeRecargo.
  - importeTotal: siempre importeCuota + importeRecargo.
  - importePagado: en esta fase no hay pagos parciales, por lo que debe
    coincidir con importeTotal (si no se envía, se completa solo).

  Cuota actual del cliente:
  - Si el pago corresponde al MES Y AÑO ACTUALES, se actualiza `cuotaActual`
    del cliente con el importe BASE del pago (`importeCuota`), SIN recargo.
  - Un pago atrasado de un mes anterior NO la modifica: pagar una deuda vieja
    no debe hacer retroceder la cuota vigente.
  - Si esa actualización falla, el pago ya está creado: se responde 201 con
    `advertencia` y el error queda en el log. El pago NO se elimina.
*/
async function crearPago(req, res) {
  try {
    const datos = req.body || {};
    const detalles = [];

    // Campos base obligatorios.
    const obligatorios = {
      cliente: 'El cliente es obligatorio',
      anio: 'El año es obligatorio',
      mes: 'El mes es obligatorio',
      fechaPago: 'La fecha de pago es obligatoria (formato AAAA-MM-DD)',
    };

    Object.keys(obligatorios).forEach((campo) => {
      if (!estaPresente(datos[campo])) {
        detalles.push(obligatorios[campo]);
      }
    });

    // Formato de cada campo presente.
    if (estaPresente(datos.cliente)) validarCampoCliente(datos.cliente, detalles);
    if (estaPresente(datos.anio)) validarCampoAnio(datos.anio, detalles);
    if (estaPresente(datos.mes)) validarCampoMes(datos.mes, detalles);
    if (estaPresente(datos.fechaPago)) validarCampoFechaPago(datos.fechaPago, detalles);
    if (estaPresente(datos.importeCuota)) validarCampoImporte(datos.importeCuota, 'importe de la cuota', detalles);
    if (estaPresente(datos.porcentajeRecargo)) validarCampoImporte(datos.porcentajeRecargo, 'porcentaje de recargo', detalles, true);
    if (estaPresente(datos.importeRecargo)) validarCampoImporte(datos.importeRecargo, 'importe del recargo', detalles, true);
    if (estaPresente(datos.importeTotal)) validarCampoImporte(datos.importeTotal, 'importe total', detalles);
    if (estaPresente(datos.importePagado)) validarCampoImporte(datos.importePagado, 'importe pagado', detalles);
    if (estaPresente(datos.nuevaCuotaMesSiguiente)) validarCampoImporte(datos.nuevaCuotaMesSiguiente, 'importe de la nueva cuota del mes siguiente', detalles);
    if (estaPresente(datos.estado) && datos.estado !== 'Pagado') detalles.push('El estado debe ser "Pagado"');

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    const anio = aNumero(datos.anio);
    const mes = aNumero(datos.mes);
    const fechaPago = String(datos.fechaPago).trim();

    validarMesNoFuturo(anio, mes, detalles);
    validarFechaNoFutura(fechaPago, detalles);

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // El cliente debe existir en la base.
    const cliente = await Cliente.findById(datos.cliente);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // ---------- Cálculo de importes ----------
    const importeCuota = redondearADosDecimales(
      estaPresente(datos.importeCuota) ? aNumero(datos.importeCuota) : cliente.cuotaActual
    );

    const porcentajeRecargo = redondearADosDecimales(
      estaPresente(datos.porcentajeRecargo)
        ? aNumero(datos.porcentajeRecargo)
        : porcentajeRecargoPredeterminado(fechaPago)
    );

    const importeRecargoEsperado = redondearADosDecimales(
      (importeCuota * porcentajeRecargo) / 100
    );

    let importeRecargo = importeRecargoEsperado;

    if (estaPresente(datos.importeRecargo)) {
      const importeEnviado = redondearADosDecimales(aNumero(datos.importeRecargo));

      if (Math.abs(importeEnviado - importeRecargoEsperado) > TOLERANCIA_MONETARIA) {
        detalles.push(
          `El importe del recargo no coincide con el porcentaje informado (${porcentajeRecargo}% de ${importeCuota} = ${importeRecargoEsperado})`
        );
      } else {
        importeRecargo = importeEnviado;
      }
    }

    const importeTotal = redondearADosDecimales(importeCuota + importeRecargo);

    if (estaPresente(datos.importeTotal)) {
      const totalEnviado = redondearADosDecimales(aNumero(datos.importeTotal));

      if (Math.abs(totalEnviado - importeTotal) > TOLERANCIA_MONETARIA) {
        detalles.push(
          `El importe total no coincide con la suma de la cuota y el recargo (${importeTotal})`
        );
      }
    }

    let importePagado = importeTotal;

    if (estaPresente(datos.importePagado)) {
      const pagadoEnviado = redondearADosDecimales(aNumero(datos.importePagado));

      if (Math.abs(pagadoEnviado - importeTotal) > TOLERANCIA_MONETARIA) {
        detalles.push(
          `En esta versión no se registran pagos parciales: el importe pagado debe coincidir con el importe total (${importeTotal})`
        );
      } else {
        importePagado = pagadoEnviado;
      }
    }

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // ---------- Duplicado: un pago por cliente, mes y año ----------
    const duplicado = await buscarPagoDuplicado(datos.cliente, anio, mes);

    if (duplicado) {
      return res.status(409).json({ error: 'Ya existe un pago de ese cliente para ese mes y año' });
    }

    // ---------- Creación ----------
    const pago = await Pago.create({
      cliente: datos.cliente,
      anio,
      mes,
      importeCuota,
      porcentajeRecargo,
      importeRecargo,
      importeTotal,
      importePagado,
      fechaPago,
      estado: 'Pagado',
      // La cuota del mes siguiente se guarda sólo si el dueño la informó.
      // Es un dato sugerido para el próximo mes: NO se actualiza
      // `cuotaActual` del cliente en esta fase.
      ...(estaPresente(datos.nuevaCuotaMesSiguiente)
        ? {
            nuevaCuotaMesSiguiente: redondearADosDecimales(
              aNumero(datos.nuevaCuotaMesSiguiente)
            ),
          }
        : {}),
    });

    // ---------- Cuota actual del cliente ----------
    // La cuota vigente pasa a ser el importe BASE del pago recién registrado
    // (`importeCuota`), nunca `importeTotal`: el recargo es un importe
    // extraordinario del pago y no forma parte de la cuota.
    //
    // Sólo se actualiza si el pago es del MES Y AÑO ACTUALES: registrar la
    // deuda de un mes anterior no debe hacer retroceder la cuota vigente.
    const mesActual = obtenerMesActual();

    if (anio === mesActual.anio && mes === mesActual.mes) {
      try {
        await Cliente.updateOne(
          { _id: cliente._id },
          { $set: { cuotaActual: importeCuota } },
          { runValidators: true }
        );
      } catch (errorDeCuota) {
        // El pago YA quedó registrado (es el registro del dinero y no se
        // revierte). La respuesta sigue siendo 201 y se avisa con
        // `advertencia`, para no dar a entender que el pago falló.
        console.error(
          `El pago ${pago._id} se registró, pero no se pudo actualizar la cuota actual del cliente ${cliente._id}: ${ocultarCredenciales(errorDeCuota.message)}`
        );

        return res.status(201).json({
          ...pago.toObject(),
          advertencia:
            'El pago se registró correctamente, pero no se pudo actualizar la cuota actual del cliente.',
        });
      }
    }

    res.status(201).json(pago);
  } catch (error) {
    return responderErrorDePago(error, res, 'crear', 'No se pudo crear el pago');
  }
}

// ---------- PUT /api/pagos/:id ----------
/*
  Actualización PARCIAL: sólo se aplican ($set) los campos editables que vienen
  en el body; los que no vienen quedan como estaban (igual que en
  clientesController, y se usa $set para no borrar campos sin querer).

  Integridad de los importes:
  - importeTotal siempre se recalcula como importeCuota + importeRecargo.
  - Si cambia importeCuota o porcentajeRecargo (y no se envía importeRecargo),
    el recargo se recalcula con el porcentaje resultante.
  - Si el pago ya tenía un importe de recargo distinto del cálculo porcentual,
    ese valor se conserva mientras no se toquen la cuota ni el porcentaje.
  - importePagado se mantiene igual a importeTotal (no hay pagos parciales).

  Enviar `nuevaCuotaMesSiguiente: null` borra ese dato del pago.

  Cuota actual del cliente:
  - Si el pago, DESPUÉS DE LA EDICIÓN, corresponde al MES Y AÑO ACTUALES, se
    actualiza `cuotaActual` del cliente con el importe BASE del pago
    (`importeCuota`), SIN recargo. Mover el pago a un mes o año anterior NO la
    modifica: es la misma regla que se aplica al crear un pago.
  - Si esa actualización falla, el pago ya está editado: se responde 200 con
    `advertencia` y el error queda en el log. El pago NO se revierte.
*/
async function actualizarPago(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de pago inválido' });
    }

    const pagoActual = await Pago.findById(id);

    if (!pagoActual) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    const datos = req.body || {};
    const cambios = {};

    CAMPOS_EDITABLES.forEach((campo) => {
      if (datos[campo] !== undefined) {
        cambios[campo] = datos[campo];
      }
    });

    // `nuevaCuotaMesSiguiente: null` => borrar el campo ($unset).
    const borrarNuevaCuota = cambios.nuevaCuotaMesSiguiente === null;

    if (borrarNuevaCuota) {
      delete cambios.nuevaCuotaMesSiguiente;
    }

    if (Object.keys(cambios).length === 0 && !borrarNuevaCuota) {
      return res.status(400).json({
        error: 'Datos inválidos',
        detalles: ['No se enviaron campos para actualizar'],
      });
    }

    const detalles = [];

    // ---------- Formato de los campos enviados ----------
    if (cambios.cliente !== undefined) validarCampoCliente(cambios.cliente, detalles);
    if (cambios.anio !== undefined) validarCampoAnio(cambios.anio, detalles);
    if (cambios.mes !== undefined) validarCampoMes(cambios.mes, detalles);
    if (cambios.fechaPago !== undefined) validarCampoFechaPago(cambios.fechaPago, detalles);
    if (cambios.importeCuota !== undefined) validarCampoImporte(cambios.importeCuota, 'importe de la cuota', detalles);
    if (cambios.porcentajeRecargo !== undefined) validarCampoImporte(cambios.porcentajeRecargo, 'porcentaje de recargo', detalles, true);
    if (cambios.importeRecargo !== undefined) validarCampoImporte(cambios.importeRecargo, 'importe del recargo', detalles, true);
    if (cambios.importeTotal !== undefined) validarCampoImporte(cambios.importeTotal, 'importe total', detalles);
    if (cambios.importePagado !== undefined) validarCampoImporte(cambios.importePagado, 'importe pagado', detalles);
    if (cambios.nuevaCuotaMesSiguiente !== undefined) validarCampoImporte(cambios.nuevaCuotaMesSiguiente, 'importe de la nueva cuota del mes siguiente', detalles);
    if (cambios.estado !== undefined && cambios.estado !== 'Pagado') detalles.push('El estado debe ser "Pagado"');

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // ---------- Valores que van a quedar guardados ----------
    const anio = cambios.anio !== undefined ? aNumero(cambios.anio) : pagoActual.anio;
    const mes = cambios.mes !== undefined ? aNumero(cambios.mes) : pagoActual.mes;
    const fechaPago =
      cambios.fechaPago !== undefined ? String(cambios.fechaPago).trim() : pagoActual.fechaPago;
    const idCliente = cambios.cliente !== undefined ? cambios.cliente : pagoActual.cliente;

    validarMesNoFuturo(anio, mes, detalles);
    validarFechaNoFutura(fechaPago, detalles);

    if (detalles.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', detalles });
    }

    // ---------- El cliente debe existir ----------
    if (cambios.cliente !== undefined) {
      const clienteExiste = await Cliente.exists({ _id: cambios.cliente });

      if (!clienteExiste) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
    }

    // ---------- Duplicado si cambia cliente, mes o año ----------
    if (
      cambios.cliente !== undefined ||
      cambios.anio !== undefined ||
      cambios.mes !== undefined
    ) {
      const duplicado = await buscarPagoDuplicado(idCliente, anio, mes, id);

      if (duplicado) {
        return res
          .status(409)
          .json({ error: 'Ya existe un pago de ese cliente para ese mes y año' });
      }
    }

    // ---------- Integridad de los importes ----------
    const importeCuota = redondearADosDecimales(
      cambios.importeCuota !== undefined ? aNumero(cambios.importeCuota) : pagoActual.importeCuota
    );

    const porcentajeRecargo = redondearADosDecimales(
      cambios.porcentajeRecargo !== undefined
        ? aNumero(cambios.porcentajeRecargo)
        : pagoActual.porcentajeRecargo
    );

    const recargoEsperado = redondearADosDecimales((importeCuota * porcentajeRecargo) / 100);

    let importeRecargo;

    if (cambios.importeRecargo !== undefined) {
      // El recargo enviado debe ser coherente con la cuota y el porcentaje.
      importeRecargo = redondearADosDecimales(aNumero(cambios.importeRecargo));

      if (Math.abs(importeRecargo - recargoEsperado) > TOLERANCIA_MONETARIA) {
        return res.status(400).json({
          error: 'Datos inválidos',
          detalles: [
            `El importe del recargo no coincide con el porcentaje informado (${porcentajeRecargo}% de ${importeCuota} = ${recargoEsperado})`,
          ],
        });
      }
    } else if (cambios.importeCuota !== undefined || cambios.porcentajeRecargo !== undefined) {
      // Cambió una de las bases: el recargo se recalcula con el porcentaje vigente.
      importeRecargo = recargoEsperado;
    } else {
      // No se tocaron cuota ni porcentaje: se conserva el recargo guardado.
      importeRecargo = redondearADosDecimales(pagoActual.importeRecargo);
    }

    const importeTotal = redondearADosDecimales(importeCuota + importeRecargo);

    if (cambios.importeTotal !== undefined) {
      const totalEnviado = redondearADosDecimales(aNumero(cambios.importeTotal));

      if (Math.abs(totalEnviado - importeTotal) > TOLERANCIA_MONETARIA) {
        return res.status(400).json({
          error: 'Datos inválidos',
          detalles: [
            `El importe total no coincide con la suma de la cuota y el recargo (${importeTotal})`,
          ],
        });
      }
    }

    let importePagado = importeTotal;

    if (cambios.importePagado !== undefined) {
      const pagadoEnviado = redondearADosDecimales(aNumero(cambios.importePagado));

      if (Math.abs(pagadoEnviado - importeTotal) > TOLERANCIA_MONETARIA) {
        return res.status(400).json({
          error: 'Datos inválidos',
          detalles: [
            `En esta versión no se registran pagos parciales: el importe pagado debe coincidir con el importe total (${importeTotal})`,
          ],
        });
      }

      importePagado = pagadoEnviado;
    }

    // ---------- Se fijan los valores definitivos ----------
    cambios.anio = anio;
    cambios.mes = mes;
    cambios.fechaPago = fechaPago;
    cambios.importeCuota = importeCuota;
    cambios.porcentajeRecargo = porcentajeRecargo;
    cambios.importeRecargo = importeRecargo;
    cambios.importeTotal = importeTotal;
    cambios.importePagado = importePagado;

    const actualizacion = { $set: cambios };

    if (borrarNuevaCuota) {
      actualizacion.$unset = { nuevaCuotaMesSiguiente: '' };
    }

    const pago = await Pago.findByIdAndUpdate(id, actualizacion, {
      returnDocument: 'after',
      runValidators: true,
    });

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    // ---------- Cuota actual del cliente ----------
    // Misma regla que al crear un pago: `cuotaActual` pasa a ser el importe BASE
    // (`importeCuota`, sin recargo) SÓLO si el pago, DESPUÉS DE LA EDICIÓN,
    // corresponde al MES Y AÑO ACTUALES. Mover el pago a un mes o año anterior
    // no la modifica: no se recalcula nada a partir del historial.
    const mesActual = obtenerMesActual();

    if (anio === mesActual.anio && mes === mesActual.mes) {
      try {
        await Cliente.updateOne(
          { _id: idCliente },
          { $set: { cuotaActual: importeCuota } },
          { runValidators: true }
        );
      } catch (errorDeCuota) {
        // El pago YA quedó editado (es el registro del dinero y no se revierte).
        // La respuesta sigue siendo 200 y se avisa con `advertencia`, para no dar
        // a entender que la edición falló.
        console.error(
          `El pago ${pago._id} se actualizó, pero no se pudo actualizar la cuota actual del cliente ${idCliente}: ${ocultarCredenciales(errorDeCuota.message)}`
        );

        return res.status(200).json({
          ...pago.toObject(),
          advertencia:
            'El pago se actualizó correctamente, pero no se pudo actualizar la cuota actual del cliente.',
        });
      }
    }

    res.status(200).json(pago);
  } catch (error) {
    return responderErrorDePago(error, res, 'actualizar', 'No se pudo actualizar el pago');
  }
}

// ---------- DELETE /api/pagos/:id ----------
// Elimina físicamente UN pago. No toca el cliente ni ningún otro documento.
async function eliminarPago(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID de pago inválido' });
    }

    const pago = await Pago.findByIdAndDelete(id);

    if (!pago) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.status(200).json({ message: 'Pago eliminado correctamente' });
  } catch (error) {
    console.error(`Error al eliminar un pago: ${ocultarCredenciales(error.message)}`);
    res.status(500).json({ error: 'No se pudo eliminar el pago' });
  }
}

module.exports = {
  obtenerPagos,
  obtenerPagoPorId,
  obtenerPagosDeCliente,
  crearPago,
  actualizarPago,
  eliminarPago,
};
