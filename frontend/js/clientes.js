/*
    clientes.js — Lógica de la página de Clientes (clientes.html).

    Renderiza el array global `clientes` (definido en este archivo) como tabla en
    desktop y como tarjetas en mobile. Incluye el buscador, el formulario para
    agregar/editar clientes y la ficha del cliente (cliente.html).
*/

// ---------- Estado ----------

// Listado de clientes en memoria. MongoDB es la fuente de verdad: se llena con
// la API (cargarClientesDesdeAPI) y NO se persiste en localStorage.
const clientes = [];

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

// Identificador de un cliente según su origen:
// el backend usa el _id de MongoDB; los datos viejos de localStorage, un id numérico.
function identificarCliente(cliente) {
    return cliente._id !== undefined ? cliente._id : cliente.id;
}

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

    acciones.appendChild(crearEnlaceVer(identificarCliente(cliente)));

    const botonEditar = crearBotonAccion("Editar");
    botonEditar.addEventListener("click", () => abrirFormularioEdicion(identificarCliente(cliente)));
    acciones.appendChild(botonEditar);

    const botonEliminar = crearBotonAccion("Eliminar");
    botonEliminar.addEventListener("click", () =>
        abrirModalEliminar(
            identificarCliente(cliente),
            cliente.nombre + " " + cliente.apellido
        )
    );
    acciones.appendChild(botonEliminar);

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
    acciones.appendChild(crearEnlaceVer(identificarCliente(cliente)));

    const botonEditar = crearBotonAccion("Editar");
    botonEditar.addEventListener("click", () => abrirFormularioEdicion(identificarCliente(cliente)));
    acciones.appendChild(botonEditar);

    const botonEliminar = crearBotonAccion("Eliminar");
    botonEliminar.addEventListener("click", () =>
        abrirModalEliminar(
            identificarCliente(cliente),
            cliente.nombre + " " + cliente.apellido
        )
    );
    acciones.appendChild(botonEliminar);

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

// Mientras la carga desde la API esté fallando no hay datos válidos que filtrar.
let errorAlCargarClientes = false;

function manejarBusqueda() {
    if (errorAlCargarClientes) {
        return;
    }

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
    // El id puede ser el _id de MongoDB (string) o el id numérico de datos viejos.
    const cliente = clientes.find((c) => identificarCliente(c) === id);
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
    mostrarAvisoFormulario("");
}

// Muestra u oculta el aviso general del formulario (errores no ligados a un campo).
function mostrarAvisoFormulario(mensaje) {
    const aviso = document.getElementById("error-formulario");

    if (aviso) {
        aviso.textContent = mensaje;
        aviso.hidden = mensaje === "";
    }
}

// Muestra u oculta el aviso de éxito del listado (se ve tras cerrar el formulario).
function mostrarAvisoExito(mensaje) {
    const aviso = document.getElementById("aviso-exito-listado");

    if (aviso) {
        aviso.textContent = mensaje;
        aviso.hidden = mensaje === "";
    }
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
        (cliente) => identificarCliente(cliente) !== idClienteEnEdicion && cliente.dni.toLowerCase() === dniBuscado
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

// Construye el body del PUT con los nombres de propiedades del modelo de MongoDB.
// El formulario usa "cuota"; el backend espera "cuotaActual".
function construirBodyCliente(datos) {
    return {
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        fechaIngreso: datos.fechaIngreso,
        cuotaActual: datos.cuota,
        fechaVencimiento: datos.fechaVencimiento,
        estado: datos.estado,
    };
}

// Reemplaza en la lista local el cliente con los datos devueltos por la API.
function aplicarClienteActualizado(clienteActualizado) {
    const indice = clientes.findIndex(
        (cliente) => identificarCliente(cliente) === identificarCliente(clienteActualizado)
    );

    if (indice !== -1) {
        clientes[indice] = clienteActualizado;
    }
}

// Evita envíos duplicados mientras la petición PUT está en curso.
let guardandoCliente = false;

async function manejarEnvioFormulario(evento) {
    evento.preventDefault();

    if (guardandoCliente) {
        return;
    }

    const datos = obtenerDatosFormulario();
    const errores = validarFormulario(datos);
    mostrarErrores(errores);
    mostrarAvisoFormulario("");

    if (Object.keys(errores).length > 0) {
        return;
    }

    // Creación: el backend es la fuente de verdad (POST /api/clientes).
    if (idClienteEnEdicion === null) {
        await crearClienteEnAPI(datos);
        return;
    }

    // Edición: el backend es la fuente de verdad. PUT con el _id de MongoDB (string).
    guardandoCliente = true;
    const boton = document.getElementById("boton-guardar-cliente");
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
        const respuesta = await fetch(API_URL_CLIENTES + "/" + idClienteEnEdicion, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(construirBodyCliente(datos)),
        });

        if (respuesta.status === 400) {
            const cuerpo = await respuesta.json().catch(() => ({}));
            const detalles = Array.isArray(cuerpo.detalles) ? cuerpo.detalles.join(" ") : "";
            mostrarAvisoFormulario(detalles || "Datos inválidos.");
            return;
        }

        if (respuesta.status === 404) {
            mostrarAvisoFormulario("Cliente no encontrado.");
            return;
        }

        if (respuesta.status === 409) {
            mostrarErrores({ dni: "Ya existe un cliente con ese DNI." });
            return;
        }

        if (!respuesta.ok) {
            mostrarAvisoFormulario("No se pudo actualizar el cliente.");
            return;
        }

        const clienteActualizado = await respuesta.json();

        // La edición queda registrada en MongoDB: NO se escribe en localStorage.
        aplicarClienteActualizado(clienteActualizado);
        cerrarFormulario();
        renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
        mostrarAvisoExito("Cliente actualizado correctamente.");
    } catch (error) {
        // Falla de red o backend apagado: detalle técnico solo en consola.
        console.error("No se pudo actualizar el cliente:", error.message);
        mostrarAvisoFormulario("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.");
    } finally {
        guardandoCliente = false;
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
}

// Crea el cliente en MongoDB mediante POST /api/clientes.
// El backend es la fuente de verdad: NO se escribe en localStorage.
async function crearClienteEnAPI(datos) {
    guardandoCliente = true;
    const boton = document.getElementById("boton-guardar-cliente");
    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try {
        const respuesta = await fetch(API_URL_CLIENTES, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(construirBodyCliente(datos)),
        });

        if (respuesta.status === 400) {
            const cuerpo = await respuesta.json().catch(() => ({}));
            const detalles = Array.isArray(cuerpo.detalles) ? cuerpo.detalles.join(" ") : "";
            mostrarAvisoFormulario(detalles || "Datos inválidos.");
            return;
        }

        if (respuesta.status === 409) {
            mostrarErrores({ dni: "Ya existe un cliente con ese DNI." });
            return;
        }

        if (!respuesta.ok) {
            mostrarAvisoFormulario("No se pudo crear el cliente.");
            return;
        }

        const clienteCreado = await respuesta.json();

        // Se agrega el documento devuelto por la API (con su _id de MongoDB).
        clientes.push(clienteCreado);
        cerrarFormulario();
        renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
        mostrarAvisoExito("Cliente creado correctamente.");
    } catch (error) {
        // Falla de red o backend apagado: detalle técnico solo en consola.
        console.error("No se pudo crear el cliente:", error.message);
        mostrarAvisoFormulario("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.");
    } finally {
        guardandoCliente = false;
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
}

// ---------- Ficha del cliente (cliente.html) ----------

// Obtiene el id de la URL como string (?id=6aab... → "6aab...").
// Devuelve null si falta el parámetro. El _id de MongoDB NO se convierte a número.
function obtenerIdDesdeUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const idTexto = parametros.get("id");

    return idTexto !== null && idTexto !== "" ? idTexto : null;
}

// Comprueba que el id tenga el formato de un ObjectId de MongoDB (24 caracteres hexadecimales).
function esFormatoIdValido(id) {
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
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

// Muestra un mensaje de error de la ficha y oculta el detalle.
function mostrarErrorFicha(mensaje) {
    const detalle = document.getElementById("ficha-detalle");
    const error = document.getElementById("ficha-error");
    const cargando = document.getElementById("ficha-cargando");

    detalle.hidden = true;

    if (cargando) {
        cargando.hidden = true;
    }

    error.hidden = false;
    error.querySelector(".ficha-error__mensaje").textContent = mensaje;
}

// Obtiene un cliente desde la API y renderiza su ficha (cliente.html).
// Estados: cargando / cliente encontrado / no encontrado (404) /
// id inválido (400) / backend apagado o error de red / error inesperado.
async function inicializarFichaCliente() {
    // Solo corre en la página de ficha del cliente
    const detalle = document.getElementById("ficha-detalle");

    if (!detalle) {
        return;
    }

    const cargando = document.getElementById("ficha-cargando");
    const id = obtenerIdDesdeUrl();

    // Sin id en la URL o con formato inválido: no se consulta el backend.
    if (id === null) {
        mostrarErrorFicha("Cliente no encontrado.");
        return;
    }

    if (!esFormatoIdValido(id)) {
        mostrarErrorFicha("ID de cliente inválido.");
        return;
    }

    if (cargando) {
        cargando.hidden = false;
    }

    try {
        const respuesta = await fetch(API_URL_CLIENTES + "/" + id);

        if (!respuesta.ok) {
            if (respuesta.status === 404) {
                mostrarErrorFicha("Cliente no encontrado.");
            } else if (respuesta.status === 400) {
                mostrarErrorFicha("ID de cliente inválido.");
            } else {
                mostrarErrorFicha("No se pudo obtener el cliente.");
            }
            return;
        }

        const cliente = await respuesta.json();

        if (cliente === null || typeof cliente !== "object") {
            mostrarErrorFicha("Cliente no encontrado.");
            return;
        }

        if (cargando) {
            cargando.hidden = true;
        }

        renderizarFicha(cliente);
    } catch (error) {
        // Falla de red o backend apagado: detalle técnico solo en consola.
        console.error("No se pudo obtener el cliente:", error.message);
        mostrarErrorFicha("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.");
    }
}

// ---------- Carga de clientes desde la API ----------

// Endpoint del backend que devuelve todos los clientes.
const API_URL_CLIENTES = "http://localhost:3000/api/clientes";

// Muestra u oculta un mensaje de estado del listado.
function mostrarMensaje(id, visible) {
    const mensaje = document.getElementById(id);

    if (mensaje) {
        mensaje.hidden = !visible;
    }
}

// Pide los clientes al backend y los muestra en el listado.
// Los datos recibidos NO se guardan en localStorage: la API es la fuente
// de datos de esta página.
async function cargarClientesDesdeAPI() {
    errorAlCargarClientes = false;
    mostrarMensaje("listado-cargando", true);
    mostrarMensaje("listado-vacio", false);
    mostrarMensaje("listado-error", false);

    try {
        const respuesta = await fetch(API_URL_CLIENTES);

        // Error HTTP (4xx / 5xx): se corta antes de intentar leer el JSON.
        if (!respuesta.ok) {
            throw new Error("Respuesta HTTP " + respuesta.status);
        }

        const datos = await respuesta.json();
        const lista = Array.isArray(datos) ? datos : [];

        // Los clientes del backend pasan a ser la lista que ya usan el
        // buscador, la tabla y las tarjetas. No se modifican los documentos.
        clientes.length = 0;
        lista.forEach((cliente) => clientes.push(cliente));

        mostrarMensaje("listado-cargando", false);
        renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
    } catch (error) {
        // Detalle técnico solo para depuración en consola.
        console.error("No se pudieron cargar los clientes:", error.message);

        errorAlCargarClientes = true;

        document.getElementById("tabla-clientes").replaceChildren();
        document.getElementById("tarjetas-clientes").replaceChildren();

        mostrarMensaje("listado-cargando", false);
        mostrarMensaje("listado-vacio", false);
        mostrarMensaje("listado-sin-resultados", false);
        mostrarMensaje("listado-error", true);
    }
}

// ---------- Eliminación de clientes ----------

let idClienteAEliminar = null;
let eliminandoCliente = false;

// Muestra el modal de confirmación con los datos del cliente a eliminar.
function abrirModalEliminar(id, nombreApellido) {
    idClienteAEliminar = id;

    const texto = document.getElementById("modal-eliminar-texto");
    const botonConfirmar = document.getElementById("modal-eliminar-confirmar");
    const modal = document.getElementById("modal-eliminar");

    if (texto) {
        texto.textContent = "¿Eliminar el cliente " + nombreApellido + "? Esta acción no se puede deshacer.";
    }

    if (botonConfirmar) {
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = "Eliminar";
    }

    if (modal && typeof modal.showModal === "function") {
        modal.showModal();
    }
}

// Muestra un mensaje en el aviso del listado (éxito o error de eliminación).
function mostrarMensajeListado(mensaje) {
    const aviso = document.getElementById("aviso-exito-listado");

    if (aviso) {
        aviso.textContent = mensaje;
        aviso.hidden = mensaje === "";
    }
}

// Quita del array local un cliente por su identificador (si está).
function quitarClienteDeLaLista(id) {
    const indice = clientes.findIndex((cliente) => identificarCliente(cliente) === id);

    if (indice !== -1) {
        clientes.splice(indice, 1);
    }
}

// Elimina un cliente en MongoDB mediante DELETE /api/clientes/:id.
async function eliminarClienteEnAPI(id) {
    eliminandoCliente = true;
    const botonConfirmar = document.getElementById("modal-eliminar-confirmar");
    const textoOriginal = botonConfirmar ? botonConfirmar.textContent : "Eliminar";

    if (botonConfirmar) {
        botonConfirmar.disabled = true;
        botonConfirmar.textContent = "Eliminando...";
    }

    try {
        const respuesta = await fetch(API_URL_CLIENTES + "/" + id, { method: "DELETE" });

        if (respuesta.status === 404) {
            // Ya no existe (por ejemplo, eliminado en otra pestaña): se quita de la vista.
            quitarClienteDeLaLista(id);
            renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
            mostrarMensajeListado("El cliente no fue encontrado. Puede que ya se haya eliminado.");
            return;
        }

        if (respuesta.status === 400) {
            mostrarMensajeListado("ID de cliente inválido.");
            return;
        }

        if (!respuesta.ok) {
            mostrarMensajeListado("No se pudo eliminar el cliente.");
            return;
        }

        // 200: el backend confirma el borrado definitivo en MongoDB.
        quitarClienteDeLaLista(id);
        renderizarClientes(filtrarClientes(obtenerTextoBusqueda()));
        mostrarMensajeListado("Cliente eliminado correctamente.");
    } catch (error) {
        // Falla de red o backend apagado: detalle técnico solo en consola.
        console.error("No se pudo eliminar el cliente:", error.message);
        mostrarMensajeListado("No se pudo conectar con el servidor. Verificá que el backend esté corriendo.");
    } finally {
        eliminandoCliente = false;

        if (botonConfirmar) {
            botonConfirmar.disabled = false;
            botonConfirmar.textContent = textoOriginal;
        }
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

// Wiring del modal de eliminación.
const modalEliminar = document.getElementById("modal-eliminar");
const botonEliminarCancelar = document.getElementById("modal-eliminar-cancelar");
const botonEliminarConfirmar = document.getElementById("modal-eliminar-confirmar");

if (botonEliminarCancelar) {
    botonEliminarCancelar.addEventListener("click", () => {
        idClienteAEliminar = null;

        if (modalEliminar && typeof modalEliminar.close === "function") {
            modalEliminar.close();
        }
    });
}

if (botonEliminarConfirmar) {
    botonEliminarConfirmar.addEventListener("click", async () => {
        // Protección anti-doble envío: el DELETE se ejecuta una sola vez.
        if (eliminandoCliente || idClienteAEliminar === null) {
            return;
        }

        const id = idClienteAEliminar;
        idClienteAEliminar = null;

        if (modalEliminar && typeof modalEliminar.close === "function") {
            modalEliminar.close();
        }

        await eliminarClienteEnAPI(id);
    });
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

// clientes.html es la página con el listado; en otras páginas no se consulta.
if (document.getElementById("listado-clientes")) {
    cargarClientesDesdeAPI();
}

// cliente.html es la página de ficha del cliente; en otras páginas no se inicializa.
if (document.getElementById("ficha-detalle")) {
    inicializarFichaCliente();
}