/*
    navegacion.js — Navegación móvil (menú hamburguesa).

    Abre y cierra el menú con JavaScript. En desktop el sidebar está
    siempre visible, por lo que este script no tiene efecto allí.
*/

const botonMenu = document.getElementById("boton-menu");
const navegacion = document.getElementById("navegacion");

if (botonMenu && navegacion) {
    botonMenu.addEventListener("click", () => {
        const menuAbierto = navegacion.classList.toggle("navegacion--abierto");

        botonMenu.setAttribute("aria-expanded", String(menuAbierto));
        botonMenu.setAttribute("aria-label", menuAbierto ? "Cerrar menú" : "Abrir menú");
    });
}