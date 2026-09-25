/*
    pagos.js — Registro de pagos mensuales desde la ficha del cliente.

    Se carga ÚNICAMENTE en cliente.html, después de api.js y de clientes.js.
    Reutiliza:
    - api.js: pedirJSON / mensajeDeErrorDeAPI (URL base y manejo de fetch).
    - clientes.js: obtenerIdDesdeUrl, esFormatoIdValido, formatearPesos.

    Reglas que este formulario respeta (el backend es la autoridad):
    - Un cliente paga una vez por mes y año: el backend responde 409 si se repite.
    - No se permiten meses futuros ni fechas de pago futuras.
    - Recargo sugerido: 0% hasta el día 10 y 10% desde el día 11. Se puede
      cambiar (0% lo quita) y una modificación explícita nunca se sobrescribe.
    - No hay pagos parciales: importePagado = importeTotal.
    - `nuevaCuotaMesSiguiente` es opcional y NO modifica la cuota del cliente.
    - Nada se guarda en localStorage: la API es la fuente de verdad.
*/

// ---------- Constantes ----------

const PAGOS_MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
];

// Mismas reglas que el backend (models/Pago.js y controllers/pagosController.js).
const PAGOS_DIA_LIMITE_SIN_RECARGO = 10;
const PAGOS_PORCENTAJE_PREDETERMINADO = 10;
const PAGOS_ZONA_HORARIA = "America/Argentina/Buenos_Aires";

// ---------- Estado ----------

let pagoClienteCargado = null; // Cliente real traído de la API
let pagoEnviando = false; // Evita envíos duplicados
let pagoPorcentajeManual = false; // El dueño tocó el porcentaje a mano

// ---------- Utilidades de fecha y de números ----------

// Fecha de hoy ("AAAA-MM-DD") en la zona horaria del gimnasio. Se usa la misma
// zona que el backend para que "hoy" coincida aunque el equipo esté en otra.
function pagoFechaDeHoy() {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: PAGOS_ZONA_HORARIA,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;

    return valor("year") + "-" + valor("month") + "-" + valor("day");
}

// Mes y año actuales (números) en la zona horaria del gimnasio.
function pagoObtenerAnioYMesActuales() {
    const hoy = pagoFechaDeHoy();

    return { anio: Number(hoy.slice(0, 4)), mes: Number(hoy.slice(5, 7)) };
}

// No se permiten meses futuros (misma regla que el backend).
function pagoEsMesFuturo(anio, mes) {
    const actual = pagoObtenerAnioYMesActuales();

    return anio > actual.anio || (anio === actual.anio && mes > actual.mes);
}

// Porcentaje sugerido: 0% hasta el día 10 inclusive y 10% desde el día 11.
function pagoPorcentajePredeterminado(fechaPago) {
    const dia = Number(String(fechaPago).slice(8, 10));

    return dia > PAGOS_DIA_LIMITE_SIN_RECARGO ? PAGOS_PORCENTAJE_PREDETERMINADO : 0;
}

// Redondeo monetario a 2 decimales (igual que el backend).
function pagoRedondear(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// Convierte el texto de un input en número. Devuelve null si no es válido.
function pagoANumero(valor) {
    if (typeof valor === "number") {
        return Number.isFinite(valor) ? valor : null;
    }

    const texto = String(valor === undefined || valor === null ? "" : valor).trim();

    if (texto === "" || !/^-?\d+(\.\d+)?$/.test(texto)) {
        return null;
    }

    return Number(texto);
}

// Formatea un importe para mostrarlo. Si no se pudo calcular, muestra "—".
function pagoFormatearImporte(valor) {
    return valor === null ? "—" : formatearPesos(valor);
}

/*
    Calcula los importes del pago con la misma fórmula y el mismo redondeo que
    el backend:
      importeRecargo = importeCuota * porcentajeRecargo / 100
      importeTotal   = importeCuota + importeRecargo
    El backend vuelve a calcular y valida que coincidan (tolerancia de $0,01).
*/
function pagoCalcularImportes(importeCuota, porcentajeRecargo) {
    const cuota = pagoANumero(importeCuota);
    const porcentaje = pagoANumero(porcentajeRecargo);

    if (cuota === null || porcentaje === null) {
        return {
            importeCuota: cuota === null ? null : pagoRedondear(cuota),
            porcentajeRecargo: porcentaje,
            importeRecargo: null,
            importeTotal: null,
        };
    }

    const cuotaRedondeada = pagoRedondear(cuota);
    const importeRecargo = pagoRedondear((cuotaRedondeada * porcentaje) / 100);

    return {
        importeCuota: cuotaRedondeada,
        porcentajeRecargo: porcentaje,
        importeRecargo,
        importeTotal: pagoRedondear(cuotaRedondeada + importeRecargo),
    };
}

// ---------- Elementos del panel (cliente.html) ----------

const pagoPanel = document.getElementById("panel-pago");
const pagoFormulario = document.getElementById("formulario-pago");
const pagoBotonAbrir = document.getElementById("boton-abrir-pago");
const pagoBotonCerrar = document.getElementById("boton-cerrar-pago");
const pagoBotonCancelar = document.getElementById("boton-cancelar-pago");
const pagoBotonGuardar = document.getElementById("boton-guardar-pago");
const pagoTextoCliente = document.getElementById("pago-cliente");
const pagoTextoClienteCargando = document.getElementById("pago-cliente-cargando");
const pagoCampoMes = document.getElementById("campo-pago-mes");
const pagoCampoAnio = document.getElementById("campo-pago-anio");
const pagoCampoFecha = document.getElementById("campo-pago-fecha");
const pagoCampoCuota = document.getElementById("campo-pago-cuota");
const pagoCampoPorcentaje = document.getElementById("campo-pago-porcentaje");
const pagoCampoNuevaCuota = document.getElementById("campo-pago-nueva-cuota");
const pagoMensaje = document.getElementById("pago-mensaje");
const pagoResumenCuota = document.getElementById("resumen-pago-cuota");
const pagoResumenRecargo = document.getElementById("resumen-pago-recargo");
const pagoResumenTotal = document.getElementById("resumen-pago-total");
const pagoEtiquetaRecargo = document.getElementById("resumen-pago-etiqueta-recargo");

// ---------- Mensajes y errores ----------

// Muestra un mensaje del formulario. `tipo` es "exito" o "error".
function pagoMostrarMensaje(texto, tipo) {
    pagoMensaje.textContent = texto;
    pagoMensaje.classList.remove("aviso-pago--exito", "aviso-pago--error");

    if (texto !== "") {
        pagoMensaje.classList.add(tipo === "exito" ? "aviso-pago--exito" : "aviso-pago--error");
    }

    pagoMensaje.hidden = texto === "";
}

// Marca en rojo los campos con error y muestra su mensaje debajo.
function pagoMostrarErrores(errores) {
    const camposConError = {
        mes: { entrada: pagoCampoMes, mensaje: document.getElementById("error-pago-mes") },
        anio: { entrada: pagoCampoAnio, mensaje: document.getElementById("error-pago-anio") },
        fecha: { entrada: pagoCampoFecha, mensaje: document.getElementById("error-pago-fecha") },
        cuota: { entrada: pagoCampoCuota, mensaje: document.getElementById("error-pago-cuota") },
        porcentaje: { entrada: pagoCampoPorcentaje, mensaje: document.getElementById("error-pago-porcentaje") },
        nuevaCuota: { entrada: pagoCampoNuevaCuota, mensaje: document.getElementById("error-pago-nueva-cuota") },
    };

    Object.keys(camposConError).forEach((clave) => {
        const { entrada, mensaje } = camposConError[clave];
        const texto = errores[clave] || "";

        mensaje.textContent = texto;
        mensaje.hidden = texto === "";

        if (texto !== "") {
            entrada.setAttribute("aria-invalid", "true");
        } else {
            entrada.removeAttribute("aria-invalid");
        }
    });
}

// ---------- Selectores de mes y año ----------

// Carga los meses (1-12) y los años disponibles en los <select>.
// Años: el actual y el anterior, suficiente para el mes en curso o un mes
// atrasado del año pasado (no se agregan reglas extra sobre meses atrasados).
function pagoLlenarSelectoresDePeriodo() {
    const actual = pagoObtenerAnioYMesActuales();

    pagoCampoMes.replaceChildren();
    PAGOS_MESES.forEach((nombre, indice) => {
        const opcion = document.createElement("option");
        opcion.value = String(indice + 1);
        opcion.textContent = nombre;
        pagoCampoMes.appendChild(opcion);
    });

    pagoCampoAnio.replaceChildren();
    [actual.anio, actual.anio - 1].forEach((anio) => {
        const opcion = document.createElement("option");
        opcion.value = String(anio);
        opcion.textContent = String(anio);
        pagoCampoAnio.appendChild(opcion);
    });
}

// Con el año actual seleccionado, los meses posteriores al mes en curso quedan
// deshabilitados: no se permiten pagos de meses futuros.
function pagoActualizarMesesDisponibles() {
    const actual = pagoObtenerAnioYMesActuales();
    const anioElegido = pagoANumero(pagoCampoAnio.value);
    const esAnioActual = anioElegido === actual.anio;

    Array.from(pagoCampoMes.options).forEach((opcion) => {
        const mes = Number(opcion.value);
        opcion.disabled = esAnioActual && mes > actual.mes;
    });

    if (esAnioActual && pagoANumero(pagoCampoMes.value) > actual.mes) {
        pagoCampoMes.value = String(actual.mes);
    }
}

// ---------- Resumen de importes ----------

// Recalcula el recargo y el total mostrados a partir de la cuota y el porcentaje.
function pagoActualizarResumen() {
    const importes = pagoCalcularImportes(pagoCampoCuota.value, pagoCampoPorcentaje.value);

    pagoResumenCuota.textContent = pagoFormatearImporte(importes.importeCuota);
    pagoEtiquetaRecargo.textContent =
        importes.porcentajeRecargo === null ? "Recargo" : "Recargo (" + importes.porcentajeRecargo + "%)";
    pagoResumenRecargo.textContent = pagoFormatearImporte(importes.importeRecargo);
    pagoResumenTotal.textContent = pagoFormatearImporte(importes.importeTotal);
}

// El porcentaje sugerido depende del día de la fecha de pago. Si el dueño ya lo
// modificó a mano, su valor se respeta y no se sobrescribe.
function pagoManejarCambioDeFecha() {
    if (!pagoPorcentajeManual && /^\d{4}-\d{2}-\d{2}$/.test(pagoCampoFecha.value)) {
        pagoCampoPorcentaje.value = String(pagoPorcentajePredeterminado(pagoCampoFecha.value));
    }

    pagoActualizarResumen();
}

function pagoManejarCambioDePorcentaje() {
    pagoPorcentajeManual = true;
    pagoActualizarResumen();
}

// ---------- Formulario: preparación ----------

// Habilita o deshabilita el formulario (mientras carga el cliente o se envía).
function pagoBloquearFormulario(bloquear) {
    pagoBotonGuardar.disabled = bloquear;

    [pagoCampoMes, pagoCampoAnio, pagoCampoFecha, pagoCampoCuota, pagoCampoPorcentaje, pagoCampoNuevaCuota].forEach(
        (campo) => {
            campo.disabled = bloquear;
        }
    );
}

/*
    Deja el formulario listo para registrar un pago del cliente cargado:
    - Mes y año actuales seleccionados (no se permiten meses futuros).
    - Fecha de pago: hoy (no se permiten fechas futuras).
    - Cuota: la cuota actual real del cliente (se puede ajustar el importe de
      este mes; NO se modifica la cuota del cliente).
    - Recargo: el sugerido para la fecha de hoy (0% hasta el día 10, 10% desde
      el día 11). El dueño puede cambiarlo o ponerlo en 0.
    - Nueva cuota del mes siguiente: vacía (es opcional).
*/
function pagoPrepararFormulario() {
    const hoy = pagoFechaDeHoy();
    const actual = pagoObtenerAnioYMesActuales();

    pagoTextoCliente.textContent =
        "Cliente: " +
        pagoClienteCargado.nombre +
        " " +
        pagoClienteCargado.apellido +
        " — DNI " +
        pagoClienteCargado.dni;
    pagoTextoCliente.hidden = false;

    pagoLlenarSelectoresDePeriodo();
    pagoCampoAnio.value = String(actual.anio);
    pagoCampoMes.value = String(actual.mes);
    pagoActualizarMesesDisponibles();

    pagoCampoFecha.value = hoy;
    pagoCampoFecha.max = hoy;

    pagoCampoCuota.value = String(pagoClienteCargado.cuotaActual);

    pagoPorcentajeManual = false;
    pagoCampoPorcentaje.value = String(pagoPorcentajePredeterminado(hoy));

    pagoCampoNuevaCuota.value = "";

    pagoMostrarErrores({});
    pagoActualizarResumen();
    pagoBloquearFormulario(false);
    pagoBotonGuardar.textContent = "Registrar pago";
}

// ---------- Formulario: validaciones del frontend ----------

/*
    Valida los datos antes de enviarlos. El backend vuelve a validar todo: estas
    comprobaciones sólo evitan viajes innecesarios y ayudan al dueño.
*/
function pagoValidarFormulario() {
    const errores = {};
    const id = obtenerIdDesdeUrl();

    if (id === null || !esFormatoIdValido(id)) {
        errores.cliente = "ID de cliente inválido: no se puede registrar el pago.";
    } else if (pagoClienteCargado === null) {
        errores.cliente = "No se cargaron los datos del cliente.";
    }

    const mes = pagoANumero(pagoCampoMes.value);
    const anio = pagoANumero(pagoCampoAnio.value);

    if (mes === null || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        errores.mes = "Elegí un mes entre 1 y 12.";
    }

    if (anio === null || !Number.isInteger(anio) || anio < 2000) {
        errores.anio = "Elegí un año válido.";
    }

    if (!errores.mes && !errores.anio && pagoEsMesFuturo(anio, mes)) {
        errores.mes = "No se pueden registrar pagos de meses futuros.";
    }

    const fechaPago = pagoCampoFecha.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) {
        errores.fecha = "La fecha de pago es obligatoria.";
    } else if (fechaPago > pagoFechaDeHoy()) {
        errores.fecha = "La fecha de pago no puede ser posterior a hoy.";
    }

    const importes = pagoCalcularImportes(pagoCampoCuota.value, pagoCampoPorcentaje.value);

    if (importes.importeCuota === null || importes.importeCuota <= 0) {
        errores.cuota = "La cuota debe ser un número mayor que 0.";
    }

    if (importes.porcentajeRecargo === null || importes.porcentajeRecargo < 0) {
        errores.porcentaje = "El recargo debe ser un número mayor o igual que 0.";
    }

    const nuevaCuotaTexto = pagoCampoNuevaCuota.value.trim();

    if (nuevaCuotaTexto !== "") {
        const nuevaCuota = pagoANumero(nuevaCuotaTexto);

        if (nuevaCuota === null || nuevaCuota <= 0) {
            errores.nuevaCuota = "La nueva cuota debe ser un número mayor que 0, o quedar vacía.";
        }
    }

    return errores;
}

/*
    Arma el body del POST /api/pagos con los nombres de campos que espera el
    backend. Los importes se calculan igual que en el backend y `importePagado`
    siempre es igual al total (no hay pagos parciales).
*/
function pagoConstruirBody() {
    const importes = pagoCalcularImportes(pagoCampoCuota.value, pagoCampoPorcentaje.value);
    const nuevaCuotaTexto = pagoCampoNuevaCuota.value.trim();

    const cuerpo = {
        cliente: obtenerIdDesdeUrl(),
        anio: pagoANumero(pagoCampoAnio.value),
        mes: pagoANumero(pagoCampoMes.value),
        fechaPago: pagoCampoFecha.value,
        importeCuota: importes.importeCuota,
        porcentajeRecargo: importes.porcentajeRecargo,
        importeRecargo: importes.importeRecargo,
        importeTotal: importes.importeTotal,
        importePagado: importes.importeTotal,
        estado: "Pagado",
    };

    // El campo sólo se envía si el dueño informó una nueva cuota para el mes
    // siguiente. Es informativo: no cambia la cuota actual del cliente.
    if (nuevaCuotaTexto !== "") {
        cuerpo.nuevaCuotaMesSiguiente = pagoANumero(nuevaCuotaTexto);
    }

    return cuerpo;
}

// ---------- Apertura del panel y carga del cliente ----------

/*
    Abre el panel y pide los datos del cliente a la API para completar el
    formulario. Se consulta en cada apertura para trabajar siempre con la cuota
    actual real (la API es la fuente de verdad).
*/
async function pagoAbrirPanel() {
    pagoPanel.hidden = false;
    pagoTextoCliente.hidden = true;
    pagoTextoClienteCargando.hidden = false;
    pagoMostrarMensaje("", "exito");
    pagoBloquearFormulario(true);

    const id = obtenerIdDesdeUrl();

    if (id === null || !esFormatoIdValido(id)) {
        pagoTextoClienteCargando.hidden = true;
        pagoMostrarMensaje("ID de cliente inválido: no se puede registrar el pago.", "error");
        return;
    }

    try {
        const respuesta = await pedirJSON("GET", "/clientes/" + id);

        if (!respuesta.ok) {
            pagoTextoClienteCargando.hidden = true;
            pagoMostrarMensaje(
                respuesta.status === 404
                    ? "Cliente no encontrado. Puede que se haya eliminado."
                    : "No se pudieron obtener los datos del cliente.",
                "error"
            );
            return;
        }

        pagoClienteCargado = respuesta.datos;
        pagoTextoClienteCargando.hidden = true;
        pagoPrepararFormulario();
    } catch (error) {
        console.error("No se pudo obtener el cliente para registrar el pago:", error.message);
        pagoTextoClienteCargando.hidden = true;
        pagoMostrarMensaje("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.", "error");
    }
}

function pagoCerrarPanel() {
    pagoPanel.hidden = true;
    pagoMostrarMensaje("", "exito");
}

// ---------- Envío del pago ----------

async function pagoManejarEnvio(evento) {
    evento.preventDefault();

    // Evita envíos duplicados (doble clic o doble toque en el celular).
    if (pagoEnviando) {
        return;
    }

    const errores = pagoValidarFormulario();
    pagoMostrarErrores(errores);

    if (Object.keys(errores).length > 0) {
        pagoMostrarMensaje(errores.cliente || "Revisá los datos marcados en el formulario.", "error");
        return;
    }

    const cuerpo = pagoConstruirBody();
    const textoOriginal = pagoBotonGuardar.textContent;

    pagoEnviando = true;
    pagoBotonGuardar.disabled = true;
    pagoBotonGuardar.textContent = "Registrando...";
    pagoMostrarMensaje("", "exito");

    try {
        const respuesta = await pedirJSON("POST", "/pagos", cuerpo);

        if (respuesta.status === 201) {
            const pago = respuesta.datos;
            const detalle =
                pago && pago.mes
                    ? PAGOS_MESES[pago.mes - 1] + " " + pago.anio + " por " + formatearPesos(pago.importeTotal)
                    : "correctamente";

            // El backend actualiza `cuotaActual` del cliente con el importe base
            // del pago SÓLO si el pago es del mes y año actuales. El cliente que
            // quedó guardado para completar este formulario se mantiene igual,
            // así al reabrirlo no sigue apareciendo la cuota anterior.
            const actual = pagoObtenerAnioYMesActuales();
            const esDelMesActual = pago.anio === actual.anio && pago.mes === actual.mes;
            const cuotaActualizada = esDelMesActual && !pago.advertencia;

            if (cuotaActualizada && pagoClienteCargado) {
                pagoClienteCargado.cuotaActual = pago.importeCuota;
            }

            // Se deja el formulario listo para el próximo registro.
            pagoPrepararFormulario();

            if (pago.advertencia) {
                // El pago se registró, pero la cuota no se pudo actualizar: se
                // muestra el aviso del backend en lugar de un éxito que sería falso.
                pagoMostrarMensaje("Pago registrado " + detalle + ". " + pago.advertencia, "error");
            } else if (cuotaActualizada) {
                pagoMostrarMensaje(
                    "Pago registrado " +
                        detalle +
                        ". La cuota actual del cliente se actualizó a " +
                        formatearPesos(pago.importeCuota) +
                        ".",
                    "exito"
                );
            } else {
                pagoMostrarMensaje(
                    "Pago registrado " +
                        detalle +
                        ". La cuota actual del cliente no cambió porque el pago no es del mes actual.",
                    "exito"
                );
            }

            // El historial de la ficha escucha este evento para refrescarse
            // sin recargar la página (lo maneja historial.js).
            document.dispatchEvent(new CustomEvent("pago-registrado"));
            return;
        }

        if (respuesta.status === 409) {
            pagoMostrarMensaje(
                "Ese cliente ya tiene un pago registrado para ese mes y año. Elegí otro mes.",
                "error"
            );
            return;
        }

        if (respuesta.status === 404) {
            pagoMostrarMensaje("Cliente no encontrado. Puede que se haya eliminado.", "error");
            return;
        }

        if (respuesta.status === 400) {
            // El backend explica qué campo falló en { error, detalles }.
            pagoMostrarMensaje(mensajeDeErrorDeAPI(respuesta.datos, "Los datos enviados no son válidos."), "error");
            return;
        }

        pagoMostrarMensaje("No se pudo registrar el pago. Intentá nuevamente.", "error");
    } catch (error) {
        console.error("No se pudo registrar el pago:", error.message);
        pagoMostrarMensaje("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.", "error");
    } finally {
        pagoEnviando = false;
        pagoBotonGuardar.disabled = false;
        pagoBotonGuardar.textContent = textoOriginal;
    }
}

// ---------- Inicialización ----------

function pagoInicializar() {
    // El panel sólo existe en cliente.html.
    if (!pagoPanel || !pagoFormulario) {
        return;
    }

    const id = obtenerIdDesdeUrl();

    // Sin un id válido en la URL no tiene sentido ofrecer el registro de pago.
    if (id === null || !esFormatoIdValido(id)) {
        pagoBotonAbrir.hidden = true;
        return;
    }

    pagoBotonAbrir.addEventListener("click", pagoAbrirPanel);
    pagoBotonCerrar.addEventListener("click", pagoCerrarPanel);
    pagoBotonCancelar.addEventListener("click", pagoCerrarPanel);
    pagoFormulario.addEventListener("submit", pagoManejarEnvio);
    pagoCampoCuota.addEventListener("input", pagoActualizarResumen);
    pagoCampoPorcentaje.addEventListener("input", pagoManejarCambioDePorcentaje);
    pagoCampoFecha.addEventListener("change", pagoManejarCambioDeFecha);
    pagoCampoAnio.addEventListener("change", pagoActualizarMesesDisponibles);
}

// Este script se carga al final del body, así que el DOM ya está disponible.
pagoInicializar();
