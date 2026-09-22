/*
    main.js — Lógica del Dashboard (index.html).

    Las tarjetas y los paneles se calculan con datos REALES de la API (MongoDB
    es la fuente de verdad). No se usa localStorage ni datos simulados: si la
    API falla se muestra un mensaje de error, nunca un valor inventado.

    Se carga ÚNICAMENTE en index.html, después de api.js y de auth.js. Reutiliza:
    - api.js: pedirJSON (cookie de sesión, 401 centralizado) y mensajeDeErrorDeAPI.

    Solicitudes de esta página (3, en paralelo, sin N+1):
    1. GET /api/clientes                 -> tarjetas de clientes y nombres.
    2. GET /api/pagos?anio=AAAA&mes=M    -> "Cuotas pendientes" y "Cobrado este mes".
       (El backend filtra por año y mes: no se descarga el historial completo.)
    3. GET /api/pagos?limite=5           -> panel "Últimos pagos".

    Definiciones de esta fase:
    - Clientes activos: clientes con estado "Activo".
    - Cuotas pendientes: clientes ACTIVOS sin ningún pago registrado para el mes
      y año actuales. NO es deuda acumulada ni morosidad: los clientes inactivos
      no se cuentan y los meses anteriores no se consideran.
    - Cobrado este mes: suma de `importePagado` de los pagos del mes y año
      actuales. Incluye pagos de clientes ya eliminados: es dinero cobrado.
*/

// ---------- Constantes ----------

// Misma zona horaria que el backend (controllers/pagosController.js) para que
// el "mes actual" coincida aunque el equipo esté en otra zona.
const DASHBOARD_ZONA_HORARIA = "America/Argentina/Buenos_Aires";

// Tope de nombres que muestra el panel "Pendientes de pago".
const DASHBOARD_MAXIMO_PENDIENTES = 5;

// ---------- Utilidades ----------

// Formatea un número como pesos: 25000 -> "$25.000"
function formatearPesos(monto) {
    return "$" + monto.toLocaleString("es-AR");
}

// Convierte "AAAA-MM-DD" en "DD/MM/AAAA": "2026-09-22" -> "22/09/2026"
function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-");
    return `${dia}/${mes}/${anio}`;
}

// Redondeo monetario a 2 decimales (misma regla que el backend).
function redondearADosDecimales(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

// Año y mes actuales (números) en la zona horaria del gimnasio. Es la ÚNICA
// función de fecha de esta página y usa el mismo criterio que el backend.
function dashboardAnioYMesActuales() {
    const partes = new Intl.DateTimeFormat("en-US", {
        timeZone: DASHBOARD_ZONA_HORARIA,
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date());

    const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;

    return { anio: Number(valor("year")), mes: Number(valor("month")) };
}

// ---------- Referencias del DOM ----------

const dashboardTarjetas = document.getElementById("tarjetas");
const dashboardColumnas = document.getElementById("columnas-dashboard");
const dashboardCargando = document.getElementById("dashboard-cargando");
const dashboardError = document.getElementById("dashboard-error");
const dashboardListaUltimosPagos = document.getElementById("lista-ultimos-pagos");
const dashboardUltimosPagosVacio = document.getElementById("ultimos-pagos-vacio");
const dashboardListaPendientes = document.getElementById("lista-pendientes");
const dashboardPendientesVacio = document.getElementById("pendientes-vacio");

// ---------- Cálculo de métricas ----------

// Clientes con estado "Activo".
function dashboardClientesActivos(clientes) {
    return clientes.filter((cliente) => cliente.estado === "Activo");
}

// Clientes activos SIN pago registrado en el mes y año actuales.
// Los pagos de clientes ya eliminados no coinciden con ningún _id, así que no
// afectan este cálculo (solo suman al dinero cobrado).
function dashboardPendientesDePago(clientes, pagosDelMes) {
    const idsQuePagaron = new Set(pagosDelMes.map((pago) => String(pago.cliente)));

    return dashboardClientesActivos(clientes).filter(
        (cliente) => !idsQuePagaron.has(String(cliente._id))
    );
}

// Suma de importePagado de los pagos del mes actual, redondeada a 2 decimales.
function dashboardCobradoDelMes(pagosDelMes) {
    const total = pagosDelMes.reduce((suma, pago) => suma + Number(pago.importePagado), 0);

    return redondearADosDecimales(total);
}

// ---------- Tarjetas principales ----------

function dashboardRenderizarTarjetas(activos, pendientes, cobrado) {
    const datos = [
        { valor: String(activos), tipo: "activos", etiqueta: "Clientes activos" },
        { valor: String(pendientes), tipo: "pendientes", etiqueta: "Cuotas pendientes" },
        { valor: formatearPesos(cobrado), tipo: "pagos", etiqueta: "Cobrado este mes" },
    ];

    dashboardTarjetas.innerHTML = "";

    datos.forEach((dato) => {
        const articulo = document.createElement("article");
        articulo.className = "tarjeta tarjeta--" + dato.tipo;
        articulo.innerHTML = `
            <p class="tarjeta__valor">${dato.valor}</p>
            <p class="tarjeta__etiqueta">${dato.etiqueta}</p>
        `;

        dashboardTarjetas.appendChild(articulo);
    });
}

// ---------- Panel "Últimos pagos" ----------

// Nombre completo del cliente de un pago. Si el cliente fue eliminado se usa
// una etiqueta neutra: no se inventa ningún nombre.
function dashboardNombreDelPago(pago, clientesPorId) {
    const cliente = clientesPorId.get(String(pago.cliente));

    if (!cliente) {
        return "Cliente eliminado";
    }

    return `${cliente.nombre} ${cliente.apellido}`;
}

function dashboardRenderizarUltimosPagos(pagos, clientesPorId) {
    const hayPagos = pagos.length > 0;

    dashboardListaUltimosPagos.innerHTML = "";
    dashboardListaUltimosPagos.hidden = !hayPagos;
    dashboardUltimosPagosVacio.hidden = hayPagos;

    pagos.forEach((pago) => {
        const item = document.createElement("li");
        item.className = "item-lista";

        const nombre = document.createElement("span");
        nombre.className = "item-lista__nombre";
        nombre.textContent = dashboardNombreDelPago(pago, clientesPorId);

        const valores = document.createElement("div");
        valores.className = "item-lista__valores";

        const importe = document.createElement("span");
        importe.className = "item-lista__valor";
        importe.textContent = formatearPesos(Number(pago.importePagado));

        const fecha = document.createElement("span");
        fecha.className = "item-lista__valor";
        fecha.textContent = formatearFecha(String(pago.fechaPago));

        valores.appendChild(importe);
        valores.appendChild(fecha);

        item.appendChild(nombre);
        item.appendChild(valores);

        dashboardListaUltimosPagos.appendChild(item);
    });
}

// ---------- Panel "Pendientes de pago" ----------

function dashboardRenderizarPendientes(pendientes) {
    const mostrados = pendientes.slice(0, DASHBOARD_MAXIMO_PENDIENTES);
    const hayPendientes = mostrados.length > 0;

    dashboardListaPendientes.innerHTML = "";
    dashboardListaPendientes.hidden = !hayPendientes;
    dashboardPendientesVacio.hidden = hayPendientes;

    mostrados.forEach((cliente) => {
        const item = document.createElement("li");
        item.className = "item-lista";

        const nombre = document.createElement("span");
        nombre.className = "item-lista__nombre";
        nombre.textContent = `${cliente.nombre} ${cliente.apellido}`;

        item.appendChild(nombre);
        dashboardListaPendientes.appendChild(item);
    });
}

// ---------- Estados del Dashboard ----------

function dashboardMostrarError(mensaje) {
    dashboardCargando.hidden = true;
    dashboardTarjetas.hidden = true;
    dashboardColumnas.hidden = true;

    dashboardError.textContent = mensaje;
    dashboardError.hidden = false;
}

function dashboardMostrarContenido() {
    dashboardCargando.hidden = true;
    dashboardError.hidden = true;
    dashboardTarjetas.hidden = false;
    dashboardColumnas.hidden = false;
}

// ---------- Carga de datos ----------

async function dashboardCargar() {
    const { anio, mes } = dashboardAnioYMesActuales();

    try {
        const respuestas = await Promise.all([
            pedirJSON("GET", "/clientes"),
            pedirJSON("GET", "/pagos?anio=" + anio + "&mes=" + mes),
            pedirJSON("GET", "/pagos?limite=5"),
        ]);

        const [respuestaClientes, respuestaPagosDelMes, respuestaUltimosPagos] = respuestas;

        // 401: api.js ya redirige al login (mecanismo centralizado). No se
        // muestra el error para no parpadear con un aviso que no corresponde.
        if (respuestas.some((respuesta) => respuesta.status === 401)) {
            return;
        }

        const fallo = respuestas.find(
            (respuesta) => !respuesta.ok || !Array.isArray(respuesta.datos)
        );

        // Error de la API: se avisa y no se muestra ningún dato. Nunca se
        // reemplaza por valores simulados.
        if (fallo) {
            dashboardMostrarError(
                mensajeDeErrorDeAPI(fallo.datos, "No se pudieron cargar los datos del Dashboard.")
            );
            return;
        }

        const clientes = respuestaClientes.datos;
        const pagosDelMes = respuestaPagosDelMes.datos;
        const pendientes = dashboardPendientesDePago(clientes, pagosDelMes);

        dashboardRenderizarTarjetas(
            dashboardClientesActivos(clientes).length,
            pendientes.length,
            dashboardCobradoDelMes(pagosDelMes)
        );

        // Los nombres se resuelven con el listado ya obtenido (sin N+1).
        const clientesPorId = new Map(clientes.map((cliente) => [String(cliente._id), cliente]));

        dashboardRenderizarUltimosPagos(respuestaUltimosPagos.datos, clientesPorId);
        dashboardRenderizarPendientes(pendientes);

        dashboardMostrarContenido();
    } catch (error) {
        // Sin conexión o backend apagado: tampoco se inventan datos.
        console.error("No se pudieron cargar los datos del Dashboard:", error.message);
        dashboardMostrarError("No se pudieron cargar los datos del Dashboard.");
    }
}

// ---------- Inicialización ----------

dashboardCargar();