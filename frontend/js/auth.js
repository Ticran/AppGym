/*
    auth.js — Protección de páginas y cierre de sesión (frontend).

    La protección REAL está en el backend (requireAuth): este script solo
    evita mostrar la interfaz a quien no tiene sesión, y agrega el botón
    "Cerrar sesión" a la navegación existente.

    Se incluye en index.html, clientes.html y cliente.html DESPUÉS de api.js.
    Al cargar, consulta GET /api/auth/me:
    - 200  -> hay sesión: se muestra el botón "Cerrar sesión".
    - 401  -> api.js redirige al login.
    - error de red -> también se envía al login (la app no funciona sin API).
*/

async function authVerificarSesion() {
    try {
        const respuesta = await pedirJSON("GET", "/auth/me");

        if (respuesta.status !== 200) {
            redirigirALogin();
            return null;
        }

        return respuesta.datos.usuario;
    } catch (error) {
        console.error("No se pudo verificar la sesión:", error.message);
        redirigirALogin();
        return null;
    }
}

// Agrega "Cerrar sesión" como último ítem de la lista de navegación.
function authAgregarBotonLogout() {
    const lista = document.querySelector(".navegacion__lista");

    if (!lista || document.getElementById("enlace-logout")) {
        return;
    }

    const item = document.createElement("li");
    item.className = "navegacion__item";

    const enlace = document.createElement("a");
    enlace.className = "navegacion__enlace";
    enlace.href = "#";
    enlace.id = "enlace-logout";
    enlace.textContent = "Cerrar sesión";

    enlace.addEventListener("click", async (evento) => {
        evento.preventDefault();

        // Deshabilita mientras se procesa para evitar cierres duplicados.
        if (enlace.getAttribute("aria-disabled") === "true") {
            return;
        }

        enlace.setAttribute("aria-disabled", "true");
        enlace.textContent = "Cerrando...";

        try {
            await pedirJSON("POST", "/auth/logout");
        } catch (error) {
            // Aunque falle la llamada, la cookie local se borra igual abajo.
            console.error("No se pudo cerrar la sesión:", error.message);
        }

        window.location.href = "login.html";
    });

    item.appendChild(enlace);
    lista.appendChild(item);
}

// Verifica la sesión y agrega el logout si es válida.
async function authInicializar() {
    const usuario = await authVerificarSesion();

    if (usuario !== null) {
        authAgregarBotonLogout();
    }
}

authInicializar();
