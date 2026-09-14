/*
    main.js — Lógica del Dashboard (index.html).

    Paso 2: las tarjetas y secciones se construyen a partir de datos
    simulados. En pasos posteriores estos valores se calcularán a partir
    de los clientes guardados en localStorage.
*/

// ---------- Datos simulados ----------

const tarjetas = [
    { valor: 84, esMonto: false, tipo: "activos", etiqueta: "Clientes activos" },
    { valor: 1250000, esMonto: true, tipo: "pagos", etiqueta: "Pagos del mes" },
    { valor: 7, esMonto: false, tipo: "deuda", etiqueta: "Clientes con deuda" },
    { valor: 12, esMonto: false, tipo: "vencimientos", etiqueta: "Vencen próximamente" },
];

const ultimosPagos = [
    { nombre: "Juan Pérez", monto: 25000 },
    { nombre: "María Gómez", monto: 22000 },
    { nombre: "Pedro López", monto: 30000 },
    { nombre: "Ana Fernández", monto: 18000 },
    { nombre: "Carlos Ruiz", monto: 25000 },
];

const proximosVencimientos = [
    { nombre: "Juan Pérez", fecha: "05/09/2026" },
    { nombre: "Carlos Gómez", fecha: "07/09/2026" },
    { nombre: "Ana López", fecha: "10/09/2026" },
    { nombre: "María Gómez", fecha: "10/09/2026" },
    { nombre: "Pedro López", fecha: "12/09/2026" },
];

// ---------- Utilidades ----------

// Formatea un número como pesos: 25000 -> "$25.000"
function formatearPesos(monto) {
    return "$" + monto.toLocaleString("es-AR");
}

// ---------- Tarjetas principales ----------

function renderizarTarjetas() {
    const contenedor = document.getElementById("tarjetas");

    tarjetas.forEach((tarjeta) => {
        const valor = tarjeta.esMonto ? formatearPesos(tarjeta.valor) : tarjeta.valor;

        const articulo = document.createElement("article");
        articulo.className = "tarjeta tarjeta--" + tarjeta.tipo;
        articulo.innerHTML = `
            <p class="tarjeta__valor">${valor}</p>
            <p class="tarjeta__etiqueta">${tarjeta.etiqueta}</p>
        `;

        contenedor.appendChild(articulo);
    });
}

// ---------- Últimos pagos ----------

function renderizarUltimosPagos() {
    const lista = document.getElementById("lista-ultimos-pagos");

    ultimosPagos.forEach((pago) => {
        const item = document.createElement("li");
        item.className = "item-lista";
        item.innerHTML = `
            <span class="item-lista__nombre">${pago.nombre}</span>
            <span class="item-lista__valor">${formatearPesos(pago.monto)}</span>
        `;

        lista.appendChild(item);
    });
}

// ---------- Próximos vencimientos ----------

function renderizarProximosVencimientos() {
    const lista = document.getElementById("lista-proximos-vencimientos");

    proximosVencimientos.forEach((vencimiento) => {
        const item = document.createElement("li");
        item.className = "item-lista";
        item.innerHTML = `
            <span class="item-lista__nombre">${vencimiento.nombre}</span>
            <span class="item-lista__valor">${vencimiento.fecha}</span>
        `;

        lista.appendChild(item);
    });
}

// ---------- Inicialización ----------

renderizarTarjetas();
renderizarUltimosPagos();
renderizarProximosVencimientos();