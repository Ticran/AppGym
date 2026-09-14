/*
    clientes.js — Lógica de la página de Clientes (clientes.html).

    Renderiza el array global `clientes` (definido en data.js) como tabla en
    desktop y como tarjetas en mobile. Incluye el buscador, el formulario para
    agregar/editar clientes y la ficha del cliente (cliente.html).
*/

// ---------- Utilidades de formato ----------

// Formatea un número como pesos: 25000 -> "$25.000"
function formatearPesos(monto) {
    return "$" + monto.toLocaleString("es-AR");
}

// Convierte "AAAA-MM-DD" en "DD/MM/AAAA": "2026-10-10" -> "10/10/2026"
function formatearFecha(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-");
    return `${dia}/${mes}/${anio}`;
}

// ---------- Piezas reutilizables ----------

function crearEtiquetaEstado(estado) {
    const etiqueta = document.createElement("span");
    etiqueta.className = "estado estado--" + estado.toLowerCase();
    etiqueta.textContent = estado;
    return etiqueta;
}

function crearBotonAccion(etiqueta) {
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton-accion";
    boton.textContent = etiqueta;
    return boton;
}

// Crea el enlace "Ver" que lleva a la ficha del cliente.
// Se utiliza un <a> para navegación semántica entre páginas.
function crearEnlaceVer(clienteId) {
    const enlace = document.createElement("a");
    enlace.href = "cliente.html?id=" + clienteId;
    enlace.className = "boton-accion";
    enlace.textContent = "Ver";
    return enlace;
}

function crearBloqueAcciones(cliente) {
    const acciones = document.createElement("div");
    acciones.className = "acciones";

    acciones.appendChild(crearEnlaceVer(cliente.id));

    const botonEditar = crearBotonAccion("Editar");
    botonEditar.addEventListener("click", () => abrirFormularioEdicion(cliente.id));
    acciones.appendChild(botonEditar);

    return acciones;
}

// ---------- Fila de la tabla (desktop) ----------

function crearFilaCliente(cliente) {
    const fila = document.createElement("tr");

    const textos = [
        cliente.nombre,
        cliente.apellido,
        cliente.dni,
        cliente.telefono,
        formatearPesos(cliente.cuotaActual),
        formatearFecha(cliente.fechaVencimiento),
    ];

    textos.forEach((texto) => {
        const celda = document.createElement("td");
        celda.textContent = texto;
        fila.appendChild(celda);
    });

    // Estado
    const celdaEstado = document.createElement("td");
    celdaEstado.appendChild(crearEtiquetaEstado(cliente.estado));
    fila.appendChild(celdaEstado);

    // Acciones (Ver / Editar)
    const celdaAcciones = document.createElement("td");
    celdaAcciones.appendChild(crearBloqueAcciones(cliente));
    fila.appendChild(celdaAcciones);

    return fila;
}

function crearTablaClientes(lista) {
    const tabla = document.createElement("table");
    tabla.className = "tabla-clientes";

    const columnas = ["Nombre", "Apellido", "DNI", "Teléfono", "Cuota", "Vencimiento", "Estado", "Acciones"];

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
    lista.forEach((cliente) => cuerpo.appendChild(crearFilaCliente(cliente)));
    tabla.appendChild(cuerpo);

    return tabla;
}

// ---------- Tarjeta de cliente (mobile) ----------

function crearTarjetaCliente(cliente) {
    const item = document.createElement("li");
    item.className = "tarjeta-cliente";

    // Encabezado: nombre completo + estado
    const encabezado = document.createElement("div");
    encabezado.className = "tarjeta-cliente__encabezado";

    const nombre = document.createElement("h3");
    nombre.className = "tarjeta-cliente__nombre";
    nombre.textContent = cliente.nombre + " " + cliente.apellido;
    encabezado.appendChild(nombre);
    encabezado.appendChild(crearEtiquetaEstado(cliente.estado));

    item.appendChild(encabezado);

    // Datos: DNI, Teléfono, Cuota, Vencimiento
    const listaDatos = document.createElement("dl");
    listaDatos.className = "tarjeta-cliente__datos";

    const pares = [
        ["DNI", cliente.dni],
        ["Tel", cliente.telefono],
        ["Cuota", formatearPesos(cliente.cuotaActual)],
        ["Vence", formatearFecha(cliente.fechaVencimiento)],
    ];

    pares.forEach((par) => {
        const fila = document.createElement("div");
        fila.className = "tarjeta-cliente__dato";

        const termino = document.createElement("dt");
        termino.textContent = par[0];
        const definicion = document.createElement("dd");
        definicion.textContent = par[1];

        fila.append(termino, definicion);
        listaDatos.appendChild(fila);
    });

    item.appendChild(listaDatos);

    // Acciones (Ver / Editar)
    const acciones = document.createElement("div");
    acciones.className = "tarjeta-cliente__acciones";
    acciones.appendChild(crearEnlaceVer(cliente.id));

    const botonEditar = crearBotonAccion("Editar");
    botonEditar.addEventListener("click", () => abrirFormularioEdicion(cliente.id));
    acciones.appendChild(botonEditar);

    item.appendChild(acciones);

    return item;
}

// ---------- Búsqueda ----------

function obtenerTextoBusqueda() {
    const buscador = document.getElementById("buscador-clientes");
    // Sin buscador (otras páginas) la búsqueda se considera vacía.
    return buscador ? buscador.value.trim().toLowerCase() : "";
}

// Quita tildes y pasa a minúsculas para que "perez" encuentre "Pérez".
function normalizar(texto) {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

// Devuelve los clientes que coinciden por nombre, apellido o DNI.
// Búsqueda parcial, sin distinguir mayúsculas/minúsculas ni tildes.
function filtrarClientes(texto) {
    const textoBusqueda = normalizar(texto);

    return clientes.filter((cliente) => {
        const coincideConNombre = normalizar(cliente.nombre).includes(textoBusqueda);
        const coincideConApellido = normalizar(cliente.apellido).includes(textoBusqueda);
        const coincideConDni = normalizar(cliente.dni).includes(textoBusqueda);

        return coincideConNombre || coincideConApellido || coincideConDni;
    });
}

function manejarBusqueda() {
    const texto = obtenerTextoBusqueda();
    renderizarClientes(filtrarClientes(texto));
}

// ---------- Renderizado principal ----------

function renderizarClientes(lista) {
    const contenedorTabla = document.getElementById("tabla-clientes");
    const contenedorTarjetas = document.getElementById("tarjetas-clientes");
    const mensajeVacio = document.getElementById("listado-vacio");
    const mensajeSinResultados = document.getElementById("listado-sin-resultados");

    contenedorTabla.replaceChildren();
    contenedorTarjetas.replaceChildren();

    // No hay clientes cargados en absoluto.
    if (clientes.length === 0) {
        mensajeVacio.hidden = false;
        mensajeSinResultados.hidden = true;
        return;
    }

    // Hay clientes, pero ninguno coincide con la búsqueda.
    if (lista.length === 0) {
        mensajeVacio.hidden = true;
        mensajeSinResultados.hidden = false;
        return;
    }

    // Hay resultados: se muestran la tabla y las tarjetas.
    mensajeVacio.hidden = true;
    mensajeSinResultados.hidden = true;

    // Desktop: tabla
    contenedorTabla.appendChild(crearTablaClientes(lista));

    // Mobile: tarjetas
    lista.forEach((cliente) => contenedorTarjetas.appendChild(crearTarjetaCliente(cliente)));
}

// ---------- Formulario: agregar y editar cliente ----------

// Si es null el formulario crea un cliente nuevo;
// si tiene un id, edita ese cliente.
let idClienteEnEdicion = null;

function abrirFormulario() {
    idClienteEnEdicion = null;
    cambiarModoFormulario("creacion");
    limpiarFormulario();

    const panel = document.getElementById("panel-formulario");
    panel.hidden = false;
    document.getElementById("campo-nombre").focus();
}

function abrirFormularioEdicion(id) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) {
        return;
    }

    idClienteEnEdicion = id;
    cambiarModoFormulario("edicion");
    mostrarErrores({});
    cargarDatosCliente(cliente);

    document.getElementById("panel-formulario").hidden = false;
}

function cerrarFormulario() {
    idClienteEnEdicion = null;
    document.getElementById("panel-formulario").hidden = true;
    limpiarFormulario();
}

// Cambia el título y el texto del botón según el modo del formulario.
function cambiarModoFormulario(modo) {
    const esEdicion = modo === "edicion";

    document.getElementById("titulo-formulario").textContent = esEdicion ? "Editar cliente" : "Agregar cliente";
    document.getElementById("boton-guardar-cliente").textContent = esEdicion ? "Guardar cambios" : "Guardar cliente";
}

// Carga los datos de un cliente existente en los campos del formulario.
function cargarDatosCliente(cliente) {
    document.getElementById("campo-nombre").value = cliente.nombre;
    document.getElementById("campo-apellido").value = cliente.apellido;
    document.getElementById("campo-dni").value = cliente.dni;
    document.getElementById("campo-telefono").value = cliente.telefono;
    document.getElementById("campo-fechaIngreso").value = cliente.fechaIngreso;
    document.getElementById("campo-cuota").value = cliente.cuotaActual;
    document.getElementById("campo-fechaVencimiento").value = cliente.fechaVencimiento;
    document.getElementById("campo-estado").value = cliente.estado;
}

function limpiarFormulario() {
    document.getElementById("formulario-cliente").reset();
    mostrarErrores({});
}

// Lee el valor de cada campo y lo devuelve en un objeto.
function obtenerDatosFormulario() {
    return {
        nombre: document.getElementById("campo-nombre").value.trim(),
        apellido: document.getElementById("campo-apellido").value.trim(),
        dni: document.getElementById("campo-dni").value.trim(),
        telefono: document.getElementById("campo-telefono").value.trim(),
        fechaIngreso: document.getElementById("campo-fechaIngreso").value,
        cuota: Number(document.getElementById("campo-cuota").value),
        fechaVencimiento: document.getElementById("campo-fechaVencimiento").value,
        estado: document.getElementById("campo-estado").value,
    };
}

// En modo creación se comparan todos los clientes.
// En modo edición se ignora el propio cliente (su DNI sigue siendo válido).
function dniRepetido(dni) {
    const dniBuscado = dni.toLowerCase();
    return clientes.some(
        (cliente) => cliente.id !== idClienteEnEdicion && cliente.dni.toLowerCase() === dniBuscado
    );
}

// Devuelve un objeto con los errores de cada campo ({ campo: "mensaje" }).
function validarFormulario(datos) {
    const errores = {};

    if (!datos.nombre) {
        errores.nombre = "El nombre es obligatorio.";
    }

    if (!datos.apellido) {
        errores.apellido = "El apellido es obligatorio.";
    }

    if (!datos.dni) {
        errores.dni = "El DNI es obligatorio.";
    } else if (dniRepetido(datos.dni)) {
        errores.dni = "Ya existe un cliente con ese DNI.";
    }

    if (!datos.telefono) {
        errores.telefono = "El teléfono es obligatorio.";
    }

    if (!datos.fechaIngreso) {
        errores.fechaIngreso = "La fecha de ingreso es obligatoria.";
    }

    if (!datos.cuota || datos.cuota <= 0) {
        errores.cuota = "La cuota debe ser un número mayor que 0.";
    }

    if (!datos.fechaVencimiento) {
        errores.fechaVencimiento = "La fecha de vencimiento es obligatoria.";
    }

    if (datos.estado !== "Activo" && datos.estado !== "Inactivo") {
        errores.estado = "El estado debe ser Activo o Inactivo.";
    }

    return errores;
}

function mostrarErrores(errores) {
    const nombresDeCampos = ["nombre", "apellido", "dni", "telefono", "fechaIngreso", "cuota", "fechaVencimiento", "estado"];

    nombresDeCampos.forEach((campo) => {
        const entrada = document.getElementById("campo-" + campo);
        const mensaje = document.getElementById("error-" + campo);
        const hayError = Boolean(errores[campo]);

        mensaje.textContent = errores[campo] || "";
        mensaje.hidden = !hayError;

        if (hayError) {
            entrada.setAttribute("aria-invalid", "true");
        } else {
            entrada.removeAttribute("aria-invalid");
        }
    });
}

// Crea el siguiente id disponible (máximo actual + 1).
function obtenerProximoId() {
    if (clientes.length === 0) {
        return 1;
    }
    return Math.max(...clientes.map((cliente) => cliente.id)) + 1;
}

// Construye el objeto cliente con la misma estructura que los de data.js.
function crearCliente(clienteParaAgregar) {
    return {
        id: obtenerProximoId(),
        nombre: clienteParaAgregar.nombre,
        apellido: clienteParaAgregar.apellido,
        dni: clienteParaAgregar.dni,
        telefono: clienteParaAgregar.telefono,
        fechaIngreso: clienteParaAgregar.fechaIngreso,
        cuotaActual: clienteParaAgregar.cuota,
        fechaVencimiento: clienteParaAgregar.fechaVencimiento,
        estado: clienteParaAgregar.estado,
    };
}

// Actualiza los datos de un cliente existente dentro del array.
function actualizarCliente(id, datos) {
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) {
        return;
    }

    cliente.nombre = datos.nombre;
    cliente.apellido = datos.apellido;
    cliente.dni = datos.dni;
    cliente.telefono = datos.telefono;
    cliente.fechaIngreso = datos.fechaIngreso;
    cliente.cuotaActual = datos.cuota;
    cliente.fechaVencimiento = datos.fechaVencimiento;
    cliente.estado = datos.estado;
}

function manejarEnvioFormulario(evento) {
    evento.preventDefault();

    const datos = obtenerDatosFormulario();
    const errores = validarFormulario(datos);
    mostrarErrores(errores);

    if (Object.keys(errores).length > 0) {
        return;
    }

    if (idClienteEnEdicion === null) {
        clientes.push(crearCliente(datos));
    } else {
        actualizarCliente(idClienteEnEdicion, datos);
    }

    // Persiste el listado actualizado (agregar o editar).
    guardarClientes(clientes);

    cerrarFormulario();
    renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
}

// ---------- Ficha del cliente (cliente.html) ----------

// Obtiene el id de la URL (?id=3 → 3). Devuelve null si falta o no es numérico.
function obtenerIdDesdeUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const idTexto = parametros.get("id");

    if (idTexto === null) {
        return null;
    }

    const id = Number(idTexto);
    return Number.isInteger(id) ? id : null;
}

// Busca un cliente por id dentro del array global `clientes`.
function buscarClientePorId(id) {
    return clientes.find((cliente) => cliente.id === id) || null;
}

// Crea una fila <div class="ficha-detalle__fila"> con <dt> y <dd> usando DOM seguro.
// La ficha se arma con <dl>, así que cada fila va dentro de un <div>.
function crearItemFicha(etiqueta, valor) {
    const fila = document.createElement("div");
    fila.className = "ficha-detalle__fila";

    const termino = document.createElement("dt");
    termino.className = "ficha-detalle__etiqueta";
    termino.textContent = etiqueta;

    const definicion = document.createElement("dd");
    definicion.className = "ficha-detalle__valor";
    definicion.textContent = valor;

    fila.append(termino, definicion);
    return fila;
}

// Renderiza la información del cliente en la ficha.
function renderizarFicha(cliente) {
    const detalle = document.getElementById("ficha-detalle");
    const error = document.getElementById("ficha-error");
    const nombre = detalle.querySelector(".ficha-detalle__titulo");
    const lista = detalle.querySelector(".ficha-detalle__lista");

    // Limpia contenido previo
    lista.replaceChildren();
    error.hidden = true;
    detalle.hidden = false;

    // Nombre y apellido como encabezado dentro de la ficha
    nombre.textContent = cliente.nombre + " " + cliente.apellido;

    // Campos: DNI, Teléfono, Fecha de ingreso, Cuota actual, Fecha de vencimiento, Estado
    lista.appendChild(crearItemFicha("DNI", cliente.dni));
    lista.appendChild(crearItemFicha("Teléfono", cliente.telefono));
    lista.appendChild(crearItemFicha("Fecha de ingreso", formatearFecha(cliente.fechaIngreso)));
    lista.appendChild(crearItemFicha("Cuota actual", formatearPesos(cliente.cuotaActual)));
    lista.appendChild(crearItemFicha("Fecha de vencimiento", formatearFecha(cliente.fechaVencimiento)));

    // Estado con estilo visual reutilizado del listado
    const filaEstado = document.createElement("div");
    filaEstado.className = "ficha-detalle__fila";
    const etiquetaEstado = document.createElement("dt");
    etiquetaEstado.className = "ficha-detalle__etiqueta";
    etiquetaEstado.textContent = "Estado";
    const definicionEstado = document.createElement("dd");
    definicionEstado.className = "ficha-detalle__valor";
    definicionEstado.appendChild(crearEtiquetaEstado(cliente.estado));
    filaEstado.append(etiquetaEstado, definicionEstado);
    lista.appendChild(filaEstado);
}

// Muestra el mensaje "Cliente no encontrado." y oculta la ficha.
function mostrarErrorFicha() {
    const detalle = document.getElementById("ficha-detalle");
    const error = document.getElementById("ficha-error");

    detalle.hidden = true;
    error.hidden = false;
    error.querySelector(".ficha-error__mensaje").textContent = "Cliente no encontrado.";
}

// Inicializa la ficha del cliente al cargar cliente.html.
function inicializarFichaCliente() {
    // Solo corre en la página de ficha del cliente
    if (!document.getElementById("ficha-detalle")) {
        return;
    }

    const id = obtenerIdDesdeUrl();
    const cliente = id !== null ? buscarClientePorId(id) : null;

    if (cliente) {
        renderizarFicha(cliente);
    } else {
        mostrarErrorFicha();
    }
}

// ---------- Inicialización ----------

const buscador = document.getElementById("buscador-clientes");
const botonAgregar = document.getElementById("boton-agregar");
const botonCerrarFormulario = document.getElementById("boton-cerrar-formulario");
const botonCancelarFormulario = document.getElementById("boton-cancelar-formulario");
const formularioCliente = document.getElementById("formulario-cliente");

if (buscador) {
    buscador.addEventListener("input", manejarBusqueda);
}

if (botonAgregar) {
    botonAgregar.addEventListener("click", abrirFormulario);
}

if (botonCerrarFormulario) {
    botonCerrarFormulario.addEventListener("click", cerrarFormulario);
}

if (botonCancelarFormulario) {
    botonCancelarFormulario.addEventListener("click", cerrarFormulario);
}

if (formularioCliente) {
    formularioCliente.addEventListener("submit", manejarEnvioFormulario);
}

// clientes.html es la página con el listado; en otras páginas no se renderiza.
if (document.getElementById("listado-clientes")) {
    renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
}

// cliente.html es la página de ficha del cliente; en otras páginas no se inicializa.
if (document.getElementById("ficha-detalle")) {
    inicializarFichaCliente();
}