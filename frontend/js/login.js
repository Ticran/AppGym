/*
    login.js — Inicio de sesión del dueño del gimnasio.

    Envía las credenciales a POST /api/auth/login. El backend valida contra
    las variables de entorno (hash bcrypt) y entrega la cookie de sesión
    HttpOnly: este script NO maneja tokens.

    - Mensaje SIEMPRE genérico para credenciales incorrectas.
    - Estado de carga y prevención de doble envío.
    - Éxito: redirige al dashboard (la cookie viaja sola a partir de ahora).
*/

const formularioLogin = document.getElementById("formulario-login");
const campoUsuario = document.getElementById("campo-usuario");
const campoContrasena = document.getElementById("campo-contrasena");
const mensajeLogin = document.getElementById("login-mensaje");
const botonIngresar = document.getElementById("boton-ingresar");

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
