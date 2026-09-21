/*
    api.js — Punto único de acceso al backend para el frontend.

    Centraliza:
    - La URL base de la API (si cambia el host del backend, se cambia SOLO acá).
    - Las peticiones fetch con JSON.
    - La lectura de las respuestas y de los errores ({ error, detalles }).

    Se carga ANTES de los scripts de cada página (clientes.html y cliente.html).
    No guarda nada: la API sigue siendo la fuente de verdad.
*/

// URL base de la API (incluye el prefijo /api).
const API_BASE_URL = "http://localhost:3000/api";

// Arma la URL completa de un recurso: urlDeAPI("/pagos") -> "http://localhost:3000/api/pagos".
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

/*
    Hace una petición a la API y devuelve SIEMPRE { ok, status, datos }.
    - `cuerpo` se envía como JSON sólo si se pasa (undefined => sin body).
    - Si no hay conexión o el backend está apagado, el error se propaga para
      que cada página muestre su propio mensaje ("no se pudo conectar...").
*/
async function pedirJSON(metodo, ruta, cuerpo) {
    const opciones = { method: metodo, headers: {} };

    if (cuerpo !== undefined) {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(cuerpo);
    }

    const respuesta = await fetch(urlDeAPI(ruta), opciones);

    let datos = null;

    try {
        datos = await respuesta.json();
    } catch (error) {
        // Respuesta sin cuerpo JSON (por ejemplo un 500 sin detalle): no rompe.
        datos = null;
    }

    return { ok: respuesta.ok, status: respuesta.status, datos };
}
