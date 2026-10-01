/*
    login.js — Inicio de sesión del dueño del gimnasio.

    Envía las credenciales a POST /api/auth/login. El backend valida contra
    las variables de entorno (hash bcrypt) y entrega la cookie de sesión
    HttpOnly: este script NO maneja tokens.

    - Mensaje SIEMPRE genérico para credenciales incorrectas.
    - Estado de carga y prevención de doble envío.
    - Éxito: redirige al dashboard (la cookie viaja sola a partir de ahora).

    Además, al cargar la página se REUTILIZA la sesión existente: si el usuario
    ya está autenticado, no tiene sentido mostrarle el formulario otra vez.
    Esa comprobación usa la autenticación que YA existe (GET /api/auth/me,
    requireAuth + JWT en cookie HttpOnly, credentials: "include"), sin guardar
    nada en el navegador y sin tocar el login manual.
*/

const formularioLogin = document.getElementById("formulario-login");
const campoUsuario = document.getElementById("campo-usuario");
const campoContrasena = document.getElementById("campo-contrasena");
const mensajeLogin = document.getElementById("login-mensaje");
const botonIngresar = document.getElementById("boton-ingresar");
const panelLogin = document.querySelector(".panel-login");
const atribucionLogin = document.querySelector(".atribucion-login");
const mensajeCargando = document.querySelector(".login-carga");

// Tiempo máximo que la tarjeta queda oculta mientras se comprueba la sesión.
// Si la API no responde, el formulario se muestra igual: la pantalla nunca
// queda vacía por una comprobación que es sólo un extra.
const LOGIN_MAXIMO_ESPERA_COMPROBACION_MS = 4000;

let loginEnviando = false;

function loginMostrarMensaje(texto) {
    mensajeLogin.textContent = texto;
    mensajeLogin.hidden = texto === "";
}

function loginMostrarErrores(errores) {
    const campos = [
        { entrada: campoUsuario, mensaje: document.getElementById("error-usuario"), clave: "usuario" },
        { entrada: campoContrasena, mensaje: document.getElementById("error-contrasena"), clave: "contrasena" },
    ];

    campos.forEach(({ entrada, mensaje, clave }) => {
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

/*
    Muestra u oculta la tarjeta del login. Se oculta sólo durante la
    comprobación de sesión, para no mostrar el formulario y saltar al
    Dashboard un instante después.
*/
function loginMostrarPanel(visible) {
    if (panelLogin && atribucionLogin && mensajeCargando) {
        panelLogin.hidden = !visible;
        atribucionLogin.hidden = !visible;
        mensajeCargando.hidden = visible;
    }
}

/*
    Comprueba si YA hay una sesión válida antes de mostrar el formulario.
    Reutiliza la autenticación existente (GET /api/auth/me con la cookie
    HttpOnly); no crea sesiones, cookies ni tokens nuevos.

    - 200 -> hay sesión: se redirige al Dashboard (misma ruta que usa el login
      correcto) y el formulario no se muestra nunca.
    - 401 -> no hay sesión activa: NO es un error de esta pantalla, así que no
      se muestra ningún mensaje y el formulario aparece normalmente.
      api.js no redirige al login cuando se está en login.html, por eso este
      401 no puede provocar un loop de redirecciones.
    - Fallo de red u otro estado -> se muestra el formulario igual (el login
      manual sigue siendo el camino normal).
*/
async function loginComprobarSesionExistente() {
    loginMostrarPanel(false);

    const temporizadorPanel = setTimeout(
        () => loginMostrarPanel(true),
        LOGIN_MAXIMO_ESPERA_COMPROBACION_MS
    );

    let haySesionActiva = false;

    try {
        const respuesta = await pedirJSON("GET", "/auth/me");
        haySesionActiva = respuesta.status === 200;
    } catch (error) {
        console.error("No se pudo comprobar la sesión existente:", error.message);
    }

    clearTimeout(temporizadorPanel);

    if (haySesionActiva) {
        // Misma ruta de destino que después de un login correcto.
        window.location.href = "index.html";
        return;
    }

    loginMostrarPanel(true);
}

async function loginManejarEnvio(evento) {
    evento.preventDefault();

    // Evita envíos duplicados (doble clic o doble toque).
    if (loginEnviando) {
        return;
    }

    const usuario = campoUsuario.value.trim();
    const contrasena = campoContrasena.value;
    const errores = {};

    if (usuario === "") {
        errores.usuario = "Ingresá tu usuario.";
    }

    if (contrasena === "") {
        errores.contrasena = "Ingresá tu contraseña.";
    }

    loginMostrarErrores(errores);

    if (Object.keys(errores).length > 0) {
        return;
    }

    const textoOriginal = botonIngresar.textContent;

    loginEnviando = true;
    botonIngresar.disabled = true;
    botonIngresar.textContent = "Ingresando...";
    loginMostrarMensaje("");

    try {
        const respuesta = await pedirJSON("POST", "/auth/login", { usuario, contrasena });

        if (respuesta.status === 200) {
            // La cookie de sesión ya quedó instalada por el backend.
            window.location.href = "index.html";
            return;
        }

        // 401 (credenciales incorrectas), 429 (demasiados intentos) u otro:
        // siempre mensaje en el formulario, sin recargar.
        loginMostrarMensaje(
            mensajeDeErrorDeAPI(respuesta.datos, "Usuario o contraseña incorrectos.")
        );
    } catch (error) {
        console.error("No se pudo iniciar la sesión:", error.message);
        loginMostrarMensaje(
            "No se pudo conectar con el servidor. Verificá que el backend esté corriendo."
        );
    } finally {
        loginEnviando = false;
        botonIngresar.disabled = false;
        botonIngresar.textContent = textoOriginal;
    }
}

formularioLogin.addEventListener("submit", loginManejarEnvio);

// Si ya hay sesión válida, se entra al Dashboard y no se muestra el login.
loginComprobarSesionExistente();
