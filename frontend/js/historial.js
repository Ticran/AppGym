/*
    historial.js — Historial de pagos del cliente (cliente.html).

    Se carga ÚNICAMENTE en cliente.html, después de api.js, clientes.js y pagos.js.
    Reutiliza:
    - api.js: pedirJSON / mensajeDeErrorDeAPI.
    - clientes.js: obtenerIdDesdeUrl, esFormatoIdValido, formatearPesos,
      formatearFecha, crearBotonAccion.
    - pagos.js: PAGOS_MESES, pagoANumero, pagoCalcularImportes,
      pagoFormatearImporte, pagoFechaDeHoy, pagoObtenerAnioYMesActuales,
      pagoEsMesFuturo, pagoPorcentajePredeterminado.

    Reglas (el backend es la autoridad):
    - El historial se obtiene de GET /api/clientes/:id/pagos (más reciente primero).
    - Editar un pago usa PUT /api/pagos/:id (actualización parcial) y NO cambia
      el cliente asociado al pago: el pago pertenece a la ficha consultada.
    - Eliminar usa DELETE /api/pagos/:id, siempre con confirmación previa.
    - No hay pagos parciales: importePagado = importeTotal.
    - Editar un pago NO modifica la cuota actual del cliente.
    - Nada se guarda en localStorage: la API es la fuente de verdad.
*/

// ---------- Estado ----------

let historialIdCliente = null;
let historialPagos = []; // Último listado recibido de la API
let historialEliminando = false; // Evita eliminaciones duplicadas
let historialPagoEnEdicion = null; // Pago abierto en el modal de edición
let historialEditando = false; // Evita envíos duplicados de la edición

// ---------- Elementos ----------

const historialSeccion = document.getElementById("historial-pagos");
const historialTabla = document.getElementById("historial-tabla");
const historialCards = document.getElementById("historial-cards");
const historialCargando = document.getElementById("historial-cargando");
const historialVacio = document.getElementById("historial-vacio");
const historialError = document.getElementById("historial-error");
const historialMensaje = document.getElementById("historial-mensaje");

const modalEliminarPago = document.getElementById("modal-eliminar-pago");
const textoEliminarPago = document.getElementById("modal-eliminar-pago-texto");
const botonEliminarPagoCancelar = document.getElementById("modal-eliminar-pago-cancelar");
const botonEliminarPagoConfirmar = document.getElementById("modal-eliminar-pago-confirmar");

const modalEditarPago = document.getElementById("modal-editar-pago");
const formularioEditarPago = document.getElementById("formulario-editar-pago");
const botonCerrarEdicionPago = document.getElementById("boton-cerrar-edicion-pago");
const botonCancelarEdicionPago = document.getElementById("boton-cancelar-edicion-pago");
const botonGuardarEdicionPago = document.getElementById("boton-guardar-edicion-pago");
const editarCampoMes = document.getElementById("campo-editar-pago-mes");
const editarCampoAnio = document.getElementById("campo-editar-pago-anio");
const editarCampoFecha = document.getElementById("campo-editar-pago-fecha");
const editarCampoCuota = document.getElementById("campo-editar-pago-cuota");
const editarCampoPorcentaje = document.getElementById("campo-editar-pago-porcentaje");
const editarCampoNuevaCuota = document.getElementById("campo-editar-pago-nueva-cuota");
const editarMensaje = document.getElementById("editar-pago-mensaje");
const editarResumenCuota = document.getElementById("resumen-editar-pago-cuota");
const editarResumenRecargo = document.getElementById("resumen-editar-pago-recargo");
const editarResumenTotal = document.getElementById("resumen-editar-pago-total");

// ---------- Mensajes y estados ----------

// Muestra un mensaje del historial (por ejemplo, tras editar o eliminar). `tipo` es "exito" o "error".
function historialMostrarMensaje(texto, tipo) {
    historialMensaje.textContent = texto;
    historialMensaje.classList.remove("aviso-pago--exito", "aviso-pago--error");

    if (texto !== "") {
        historialMensaje.classList.add(tipo === "exito" ? "aviso-pago--exito" : "aviso-pago--error");
    }

    historialMensaje.hidden = texto === "";
}

// Muestra uno de los estados fijos del panel: "cargando", "vacio", "error" o "listado".
function historialMostrarEstado(estado) {
    historialCargando.hidden = estado !== "cargando";
    historialVacio.hidden = estado !== "vacio";
    historialError.hidden = estado !== "error";
    historialTabla.hidden = estado !== "listado";
    historialCards.hidden = estado !== "listado";
}

// Texto "Septiembre 2026" a partir del pago.
function historialNombrePeriodo(pago) {
    return PAGOS_MESES[pago.mes - 1] + " " + pago.anio;
}

// Descripción del recargo de un pago: "Sin recargo" o "$2.000 (10%)".
function historialTextoRecargo(pago) {
    if (pago.porcentajeRecargo === 0) {
        return "Sin recargo";
    }

    return formatearPesos(pago.importeRecargo) + " (" + pago.porcentajeRecargo + "%)";
}

// ---------- Carga del historial ----------

/*
    Pide a la API los pagos del cliente y renderiza el historial.
    La API ya devuelve los pagos del más reciente al más antiguo
    (orden { anio: -1, mes: -1, fechaPago: -1 } en el backend), pero por
    consistencia se vuelve a validar que el orden sea descendente.
*/
async function historialCargar() {
    if (historialIdCliente === null) {
        return;
    }

    historialMostrarEstado("cargando");
    historialMostrarMensaje("", "exito");

    try {
        const respuesta = await pedirJSON("GET", "/clientes/" + historialIdCliente + "/pagos");

        if (!respuesta.ok) {
            historialMostrarEstado("error");

            if (respuesta.status === 404) {
                historialMostrarMensaje("El cliente ya no existe. Puede que se haya eliminado.", "error");
            } else {
                historialMostrarMensaje(
                    mensajeDeErrorDeAPI(respuesta.datos, "No se pudieron cargar los pagos."),
                    "error"
                );
            }

            return;
        }

        const pagos = Array.isArray(respuesta.datos) ? respuesta.datos : [];

        // El backend ya ordena del más reciente al más antiguo; se re-verifica
        // por si la respuesta viniera en otro orden.
        pagos.sort((a, b) => {
            if (a.anio !== b.anio) {
                return b.anio - a.anio;
            }

            return b.mes - a.mes;
        });

        historialPagos = pagos;

        if (historialPagos.length === 0) {
            historialMostrarEstado("vacio");
            return;
        }

        historialRenderizar();
        historialMostrarEstado("listado");
    } catch (error) {
        console.error("No se pudieron cargar los pagos del cliente:", error.message);
        historialMostrarEstado("error");
        historialMostrarMensaje(
            "No se pudo conectar con el servidor. Verificá que el backend esté corriendo.",
            "error"
        );
    }
}

// ---------- Eliminación de un pago ----------

function historialAbrirModalEliminar(pago) {
    textoEliminarPago.textContent =
        "¿Eliminar el pago de " +
        historialNombrePeriodo(pago) +
        " por " +
        formatearPesos(pago.importeTotal) +
        "? Esta acción no se puede deshacer.";

    historialPagoEnEdicion = pago;
    botonEliminarPagoConfirmar.textContent = "Eliminar";
    botonEliminarPagoConfirmar.disabled = false;

    if (modalEliminarPago && typeof modalEliminarPago.showModal === "function") {
        modalEliminarPago.showModal();
    }
}

function historialCerrarModalEliminar() {
    if (modalEliminarPago && typeof modalEliminarPago.close === "function") {
        modalEliminarPago.close();
    }

    historialPagoEnEdicion = null;
}

// Confirma la eliminación del pago mostrado en el modal.
async function historialConfirmarEliminar() {
    if (historialEliminando || historialPagoEnEdicion === null) {
        return;
    }

    const pago = historialPagoEnEdicion;

    historialEliminando = true;
    botonEliminarPagoConfirmar.disabled = true;
    botonEliminarPagoConfirmar.textContent = "Eliminando...";

    try {
        const respuesta = await pedirJSON("DELETE", "/pagos/" + pago._id);

        historialCerrarModalEliminar();

        if (respuesta.status === 200) {
            historialMostrarMensaje(
                "Pago de " + historialNombrePeriodo(pago) + " eliminado correctamente.",
                "exito"
            );
            await historialCargar();
            return;
        }

        if (respuesta.status === 404) {
            historialMostrarMensaje(
                "El pago ya no existía. Se actualizó el historial.",
                "error"
            );
            await historialCargar();
            return;
        }

        historialMostrarMensaje(
            mensajeDeErrorDeAPI(respuesta.datos, "No se pudo eliminar el pago."),
            "error"
        );
    } catch (error) {
        console.error("No se pudo eliminar el pago:", error.message);
        historialCerrarModalEliminar();
        historialMostrarMensaje(
            "No se pudo conectar con el servidor. Verificá que el backend esté corriendo.",
            "error"
        );
    } finally {
        historialEliminando = false;
    }
}


// El pago tiene informada una nueva cuota para el mes siguiente.
function historialTieneNuevaCuota(pago) {
    return pago.nuevaCuotaMesSiguiente !== undefined && pago.nuevaCuotaMesSiguiente !== null;
}

function historialCrearAcciones(pago) {
    const acciones = document.createElement("div");
    acciones.className = "acciones";

    const botonEditar = crearBotonAccion("Editar");
    botonEditar.addEventListener("click", () => historialAbrirModalEditar(pago));
    acciones.appendChild(botonEditar);

    const botonEliminar = crearBotonAccion("Eliminar");
    botonEliminar.addEventListener("click", () => historialAbrirModalEliminar(pago));
    acciones.appendChild(botonEliminar);

    return acciones;
}

// Fila de la tabla (desktop).
function historialCrearFila(pago) {
    const fila = document.createElement("tr");

    const textos = [
        historialNombrePeriodo(pago),
        formatearFecha(pago.fechaPago),
        formatearPesos(pago.importeCuota),
        historialTextoRecargo(pago),
        formatearPesos(pago.importeTotal),
        formatearPesos(pago.importePagado),
        historialTieneNuevaCuota(pago) ? formatearPesos(pago.nuevaCuotaMesSiguiente) : "—",
    ];

    textos.forEach((texto) => {
        const celda = document.createElement("td");
        celda.textContent = texto;
        fila.appendChild(celda);
    });

    const celdaAcciones = document.createElement("td");
    celdaAcciones.appendChild(historialCrearAcciones(pago));
    fila.appendChild(celdaAcciones);

    return fila;
}

// Tarjeta de pago (mobile y tablet).
function historialCrearTarjeta(pago) {
    const item = document.createElement("li");
    item.className = "historial-pago";

    const encabezado = document.createElement("div");
    encabezado.className = "historial-pago__encabezado";

    const periodo = document.createElement("h3");
    periodo.className = "historial-pago__periodo";
    periodo.textContent = historialNombrePeriodo(pago);
    encabezado.appendChild(periodo);

    const total = document.createElement("span");
    total.className = "historial-pago__total";
    total.textContent = formatearPesos(pago.importeTotal);
    encabezado.appendChild(total);

    item.appendChild(encabezado);

    const listaDatos = document.createElement("dl");
    listaDatos.className = "historial-pago__datos";

    const pares = [
        ["Fecha de pago", formatearFecha(pago.fechaPago)],
        ["Cuota", formatearPesos(pago.importeCuota)],
        ["Recargo", historialTextoRecargo(pago)],
        ["Total", formatearPesos(pago.importeTotal)],
        ["Pagado", formatearPesos(pago.importePagado)],
        ["Nueva cuota", historialTieneNuevaCuota(pago) ? formatearPesos(pago.nuevaCuotaMesSiguiente) : "—"],
    ];

    pares.forEach((par) => {
        const fila = document.createElement("div");
        fila.className = "historial-pago__dato";

        const termino = document.createElement("dt");
        termino.textContent = par[0];
        fila.appendChild(termino);

        const descripcion = document.createElement("dd");
        descripcion.textContent = par[1];
        fila.appendChild(descripcion);

        listaDatos.appendChild(fila);
    });

    item.appendChild(listaDatos);
    item.appendChild(historialCrearAcciones(pago));

    return item;
}

// Dibuja el listado actual (historialPagos) en la tabla y en las tarjetas.
function historialRenderizar() {
    historialTabla.replaceChildren();
    historialCards.replaceChildren();

    const tabla = document.createElement("table");
    tabla.className = "tabla-clientes historial-pagos__tabla-interna";

    const columnas = [
        "Mes",
        "Fecha de pago",
        "Cuota",
        "Recargo",
        "Total",
        "Pagado",
        "Nueva cuota",
        "Acciones",
    ];

    const cabecera = document.createElement("thead");
    const filaCabecera = document.createElement("tr");
    columnas.forEach((texto) => {
        const celda = document.createElement("th");
        celda.scope = "col";
        celda.textContent = texto;
        filaCabecera.appendChild(celda);
    });
    cabecera.appendChild(filaCabecera);
    tabla.appendChild(cabecera);

    const cuerpo = document.createElement("tbody");
    historialPagos.forEach((pago) => {
        cuerpo.appendChild(historialCrearFila(pago));
    });
    tabla.appendChild(cuerpo);

    historialTabla.appendChild(tabla);

    historialPagos.forEach((pago) => {
        historialCards.appendChild(historialCrearTarjeta(pago));
    });
}

// ---------- Edición de un pago ----------

// Marca los campos con error dentro del modal de edición.
function historialMostrarErroresEdicion(errores) {
    const camposConError = {
        mes: { entrada: editarCampoMes, mensaje: document.getElementById("error-editar-pago-mes") },
        anio: { entrada: editarCampoAnio, mensaje: document.getElementById("error-editar-pago-anio") },
        fecha: { entrada: editarCampoFecha, mensaje: document.getElementById("error-editar-pago-fecha") },
        cuota: { entrada: editarCampoCuota, mensaje: document.getElementById("error-editar-pago-cuota") },
        porcentaje: { entrada: editarCampoPorcentaje, mensaje: document.getElementById("error-editar-pago-porcentaje") },
        nuevaCuota: { entrada: editarCampoNuevaCuota, mensaje: document.getElementById("error-editar-pago-nueva-cuota") },
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

// Muestra el mensaje del modal de edición. `tipo` es "exito" o "error".
function historialMostrarMensajeEdicion(texto, tipo) {
    editarMensaje.textContent = texto;
    editarMensaje.classList.remove("aviso-pago--exito", "aviso-pago--error");

    if (texto !== "") {
        editarMensaje.classList.add(tipo === "exito" ? "aviso-pago--exito" : "aviso-pago--error");
    }

    editarMensaje.hidden = texto === "";
}

// Resumen de importes del modal de edición (misma fórmula que el backend).
function historialActualizarResumenEdicion() {
    const importes = pagoCalcularImportes(editarCampoCuota.value, editarCampoPorcentaje.value);

    editarResumenCuota.textContent = pagoFormatearImporte(importes.importeCuota);
    editarResumenRecargo.textContent = pagoFormatearImporte(importes.importeRecargo);
    editarResumenTotal.textContent = pagoFormatearImporte(importes.importeTotal);
}

// Meses: llenar el <select> y deshabilitar los futuros si el año es el actual.
function historialLlenarMesesEdicion() {
    editarCampoMes.replaceChildren();

    PAGOS_MESES.forEach((nombre, indice) => {
        const opcion = document.createElement("option");
        opcion.value = String(indice + 1);
        opcion.textContent = nombre;
        editarCampoMes.appendChild(opcion);
    });

    historialActualizarMesesDisponiblesEdicion();
}

function historialActualizarMesesDisponiblesEdicion() {
    const actual = pagoObtenerAnioYMesActuales();
    const anioElegido = pagoANumero(editarCampoAnio.value);
    const esAnioActual = anioElegido === actual.anio;

    Array.from(editarCampoMes.options).forEach((opcion) => {
        const mes = Number(opcion.value);
        opcion.disabled = esAnioActual && mes > actual.mes;
    });

    if (esAnioActual && pagoANumero(editarCampoMes.value) > actual.mes) {
        editarCampoMes.value = String(actual.mes);
    }
}

// Años: el actual, el anterior y los del pago que se edita (por si es más viejo).
function historialLlenarAniosEdicion(pago) {
    const actual = pagoObtenerAnioYMesActuales();
    const anios = new Set([actual.anio, actual.anio - 1, pago.anio, pago.anio - 1]);

    editarCampoAnio.replaceChildren();

    Array.from(anios)
        .filter((anio) => anio >= 2000)
        .sort((a, b) => b - a)
        .forEach((anio) => {
            const opcion = document.createElement("option");
            opcion.value = String(anio);
            opcion.textContent = String(anio);
            editarCampoAnio.appendChild(opcion);
        });
}

// Abre el modal de edición con los datos actuales del pago.
function historialAbrirModalEditar(pago) {
    historialPagoEnEdicion = pago;

    historialLlenarAniosEdicion(pago);
    historialLlenarMesesEdicion();

    editarCampoAnio.value = String(pago.anio);
    editarCampoMes.value = String(pago.mes);
    historialActualizarMesesDisponiblesEdicion();
    editarCampoMes.value = String(pago.mes);

    editarCampoFecha.value = pago.fechaPago;
    editarCampoFecha.max = pagoFechaDeHoy();

    editarCampoCuota.value = String(pago.importeCuota);
    editarCampoPorcentaje.value = String(pago.porcentajeRecargo);
    editarCampoNuevaCuota.value =
        pago.nuevaCuotaMesSiguiente === undefined || pago.nuevaCuotaMesSiguiente === null
            ? ""
            : String(pago.nuevaCuotaMesSiguiente);

    historialMostrarErroresEdicion({});
    historialMostrarMensajeEdicion("", "exito");
    historialActualizarResumenEdicion();

    botonGuardarEdicionPago.textContent = "Guardar cambios";
    botonGuardarEdicionPago.disabled = false;

    if (modalEditarPago && typeof modalEditarPago.showModal === "function") {
        modalEditarPago.showModal();
    }
}

function historialCerrarModalEditar() {
    if (modalEditarPago && typeof modalEditarPago.close === "function") {
        modalEditarPago.close();
    }

    historialPagoEnEdicion = null;
}

// Validaciones del frontend para la edición (el backend vuelve a validar todo).
function historialValidarEdicion() {
    const errores = {};
    const pago = historialPagoEnEdicion;

    if (pago === null) {
        return { general: "No se cargaron los datos del pago." };
    }

    const mes = pagoANumero(editarCampoMes.value);
    const anio = pagoANumero(editarCampoAnio.value);

    if (mes === null || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        errores.mes = "Elegí un mes entre 1 y 12.";
    }

    if (anio === null || !Number.isInteger(anio) || anio < 2000) {
        errores.anio = "Elegí un año válido.";
    }

    if (!errores.mes && !errores.anio && pagoEsMesFuturo(anio, mes)) {
        errores.mes = "No se pueden registrar pagos de meses futuros.";
    }

    const fechaPago = editarCampoFecha.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) {
        errores.fecha = "La fecha de pago es obligatoria.";
    } else if (fechaPago > pagoFechaDeHoy()) {
        errores.fecha = "La fecha de pago no puede ser posterior a hoy.";
    }

    const importes = pagoCalcularImportes(editarCampoCuota.value, editarCampoPorcentaje.value);

    if (importes.importeCuota === null || importes.importeCuota <= 0) {
        errores.cuota = "La cuota debe ser un número mayor que 0.";
    }

    if (importes.porcentajeRecargo === null || importes.porcentajeRecargo < 0) {
        errores.porcentaje = "El recargo debe ser un número mayor o igual que 0.";
    }

    const nuevaCuotaTexto = editarCampoNuevaCuota.value.trim();

    if (nuevaCuotaTexto !== "") {
        const nuevaCuota = pagoANumero(nuevaCuotaTexto);

        if (nuevaCuota === null || nuevaCuota <= 0) {
            errores.nuevaCuota = "La nueva cuota debe ser un número mayor que 0, o quedar vacía.";
        }
    }

    return errores;
}

/*
    Arma el body del PUT /api/pagos/:id.

    - El cliente del pago NUNCA se envía: no se puede cambiar el cliente
      asociado desde la ficha.
    - Se envían los campos editables con valores coherentes (el backend
      recalcula y valida); `importeTotal` no es editable en el backend, así
      que no se envía.
    - `importePagado` siempre es igual al total (no hay pagos parciales).
    - Si la nueva cuota queda vacía, se envía `null` para borrar el dato.
*/
function historialConstruirBodyEdicion() {
    const importes = pagoCalcularImportes(editarCampoCuota.value, editarCampoPorcentaje.value);
    const nuevaCuotaTexto = editarCampoNuevaCuota.value.trim();

    return {
        anio: pagoANumero(editarCampoAnio.value),
        mes: pagoANumero(editarCampoMes.value),
        fechaPago: editarCampoFecha.value,
        importeCuota: importes.importeCuota,
        porcentajeRecargo: importes.porcentajeRecargo,
        importeRecargo: importes.importeRecargo,
        importePagado: importes.importeTotal,
        nuevaCuotaMesSiguiente: nuevaCuotaTexto === "" ? null : pagoANumero(nuevaCuotaTexto),
    };
}

// Guarda los cambios del pago en edición mediante PUT /api/pagos/:id.
async function historialManejarEnvioEdicion(evento) {
    evento.preventDefault();

    // Evita envíos duplicados (doble clic o doble toque en el celular).
    if (historialEditando) {
        return;
    }

    const pago = historialPagoEnEdicion;

    if (pago === null) {
        return;
    }

    const errores = historialValidarEdicion();
    historialMostrarErroresEdicion(errores);

    if (Object.keys(errores).length > 0) {
        historialMostrarMensajeEdicion(
            errores.general || "Revisá los datos marcados en el formulario.",
            "error"
        );
        return;
    }

    const cuerpo = historialConstruirBodyEdicion();
    const textoOriginal = botonGuardarEdicionPago.textContent;

    historialEditando = true;
    botonGuardarEdicionPago.disabled = true;
    botonGuardarEdicionPago.textContent = "Guardando...";
    historialMostrarMensajeEdicion("", "exito");

    try {
        const respuesta = await pedirJSON("PUT", "/pagos/" + pago._id, cuerpo);

        if (respuesta.ok) {
            historialCerrarModalEditar();
            historialMostrarMensaje(
                "Pago de " + historialNombrePeriodo(respuesta.datos) + " actualizado correctamente.",
                "exito"
            );
            await historialCargar();
            return;
        }

        if (respuesta.status === 409) {
            historialMostrarMensajeEdicion(
                "El cliente ya tiene un pago registrado para el mes y año elegidos.",
                "error"
            );
            return;
        }

        if (respuesta.status === 404) {
            historialMostrarMensajeEdicion(
                "El pago ya no existe. Puede que se haya eliminado.",
                "error"
            );
            return;
        }

        if (respuesta.status === 400) {
            historialMostrarMensajeEdicion(
                mensajeDeErrorDeAPI(respuesta.datos, "Los datos enviados no son válidos."),
                "error"
            );
            return;
        }

        historialMostrarMensajeEdicion("No se pudo actualizar el pago. Intentá nuevamente.", "error");
    } catch (error) {
        console.error("No se pudo actualizar el pago:", error.message);
        historialMostrarMensajeEdicion(
            "No se pudo conectar con el servidor. Verificá que el backend esté corriendo.",
            "error"
        );
    } finally {
        historialEditando = false;
        botonGuardarEdicionPago.disabled = false;
        botonGuardarEdicionPago.textContent = textoOriginal;
    }
}

// ---------- Inicialización ----------

function historialInicializar() {
    // El panel sólo existe en cliente.html.
    if (!historialSeccion) {
        return;
    }

    const id = obtenerIdDesdeUrl();

    // Sin un id válido en la URL no hay historial que mostrar (misma regla que pagos.js).
    if (id === null || !esFormatoIdValido(id)) {
        historialSeccion.hidden = true;
        return;
    }

    historialIdCliente = id;

    // Eliminación: confirmación con el <dialog> nativo (igual que en clientes.html).
    botonEliminarPagoConfirmar.addEventListener("click", historialConfirmarEliminar);

    if (botonEliminarPagoCancelar) {
        botonEliminarPagoCancelar.addEventListener("click", () => {
            historialPagoEnEdicion = null;
        });
    }

    // Al cerrar el <dialog> por cualquier vía (Esc, cancelar), se limpia el estado.
    if (modalEliminarPago) {
        modalEliminarPago.addEventListener("close", () => {
            historialPagoEnEdicion = null;
        });
    }

    // Edición: apertura, cierre y envío.
    botonCerrarEdicionPago.addEventListener("click", historialCerrarModalEditar);
    botonCancelarEdicionPago.addEventListener("click", historialCerrarModalEditar);
    formularioEditarPago.addEventListener("submit", historialManejarEnvioEdicion);

    if (modalEditarPago) {
        modalEditarPago.addEventListener("close", () => {
            historialPagoEnEdicion = null;
        });
    }

    editarCampoAnio.addEventListener("change", historialActualizarMesesDisponiblesEdicion);
    editarCampoCuota.addEventListener("input", historialActualizarResumenEdicion);
    editarCampoPorcentaje.addEventListener("input", historialActualizarResumenEdicion);
    editarCampoFecha.addEventListener("change", historialActualizarResumenEdicion);

    // Cuando se registra un pago nuevo desde pagos.js, el historial se refresca
    // sin recargar la página.
    document.addEventListener("pago-registrado", historialCargar);

    historialCargar();
}

// Este script se carga al final del body, así que el DOM ya está disponible.
historialInicializar();



