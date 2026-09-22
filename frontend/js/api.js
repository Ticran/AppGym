/*
    api.js — Punto único de acceso al backend para el frontend.

    Centraliza:
    - La URL base de la API (si cambia el host del backend, se cambia SOLO acá).
    - Las peticiones fetch con JSON y credenciales (cookie de sesión HttpOnly).
    - La lectura de las respuestas y de los errores ({ error, detalles }).
    - El manejo central de 401: si el backend rechaza la sesión, se redirige
      al login desde UN solo lugar (las páginas no repiten esa lógica).

    Se carga ANTES de los scripts de cada página.
    No guarda nada: la API sigue siendo la fuente de verdad.
*/

// URL base de la API (incluye el prefijo /api).
// Es RELATIVA a propósito: el frontend se sirve desde el mismo origen que la
// API (Express), así la misma línea funciona en desarrollo
// (http://localhost:3000) y en producción (https://dominio), sin cambiar código.
const API_BASE_URL = "/api";

// Arma la URL completa de un recurso: urlDeAPI("/pagos") -> "/api/pagos".
function urlDeAPI(ruta) {
    return API_BASE_URL + ruta;
}

// Traduce el error de la API ({ error, detalles }) a un texto entendible.
// Si la respuesta no trae ese formato, devuelve el mensaje por defecto.
function mensajeDeErrorDeAPI(datos, mensajePorDefecto) {
    if (datos !== null && typeof datos === "object" && typeof datos.error === "string" && datos.error !== "") {
        if (Array.isArray(datos.detalles) && datos.detalles.length > 0) {
            return datos.error + ": " + datos.detalles.join(" ");
        }

        return datos.error;
    }

    return mensajePorDefecto;
}

// Envía al usuario al login (protección de interfaz; la real está en el backend).
function redirigirALogin() {
    if (!window.location.pathname.endsWith("/login.html")) {
        window.location.href = "login.html";
    }
}

/*
    Hace una petición a la API y devuelve SIEMPRE { ok, status, datos }.
    - `cuerpo` se envía como JSON sólo si se pasa (undefined => sin body).
    - `credentials: "include"` envía la cookie de sesión en cada pedido.
    - Un 401 redirige al login (excepto en el propio login, donde el
      formulario muestra el mensaje sin recargar).
    - Si no hay conexión o el backend está apagado, el error se propaga para
      que cada página muestre su propio mensaje ("no se pudo conectar...").
*/
async function pedirJSON(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {}, credentials: "include" };

    if (cuerpo !== undefined) {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }

    const respuesta = await fetch(urlDeAPI(ruta), opciones);

    if (respuesta.status === 401 && ruta !== "/auth/login") {
        redirigirALogin();
    }

    let datos = null;

    try {
        datos = await respuesta.json();
    } catch (error) {
        // Respuesta sin cuerpo JSON (por ejemplo un 500 sin detalle): no rompe.
        datos = null;
    }

    return { ok: respuesta.ok, status: respuesta.status, datos };
}
