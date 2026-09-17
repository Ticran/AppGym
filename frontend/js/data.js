/*
    data.js — Datos iniciales de clientes y persistencia en localStorage.

    - `clientesIniciales` es la semilla: los clientes ficticios que se usan la
      primera vez que se ejecuta la aplicación (o si los datos guardados son
      inválidos). Es el único lugar donde se definen datos de clientes.
    - `clientes` es el array global que usa toda la aplicación: contiene los
      datos persistidos en localStorage si son válidos, o la semilla si no lo son.
    - Fechas en formato "AAAA-MM-DD" (ISO) para facilitar su uso con JS.
    - estado solo puede ser "Activo" o "Inactivo".
    - La variable global `clientes` queda disponible en las páginas porque
      data.js se carga antes que los demás scripts.
*/

const clientesIniciales = [
    {
        id: 1,
        nombre: "Juan",
        apellido: "Pérez",
        dni: "38123456",
        telefono: "358-4012345",
        fechaIngreso: "2025-03-10",
        cuotaActual: 25000,
        fechaVencimiento: "2026-10-10",
        estado: "Activo",
    },
    {
        id: 2,
        nombre: "María",
        apellido: "Gómez",
        dni: "40223344",
        telefono: "358-4123456",
        fechaIngreso: "2025-06-18",
        cuotaActual: 22000,
        fechaVencimiento: "2026-09-05",
        estado: "Activo",
    },
    {
        id: 3,
        nombre: "Pedro",
        apellido: "López",
        dni: "35567890",
        telefono: "358-4234567",
        fechaIngreso: "2025-01-25",
        cuotaActual: 30000,
        fechaVencimiento: "2026-09-07",
        estado: "Activo",
    },
    {
        id: 4,
        nombre: "Ana",
        apellido: "Fernández",
        dni: "42011223",
        telefono: "358-4345678",
        fechaIngreso: "2026-02-02",
        cuotaActual: 18000,
        fechaVencimiento: "2026-10-10",
        estado: "Activo",
    },
    {
        id: 5,
        nombre: "Carlos",
        apellido: "Ruiz",
        dni: "39123345",
        telefono: "358-4456789",
        fechaIngreso: "2024-11-12",
        cuotaActual: 35000,
        fechaVencimiento: "2026-08-10",
        estado: "Inactivo",
    },
    {
        id: 6,
        nombre: "Laura",
        apellido: "Díaz",
        dni: "41124456",
        telefono: "358-4567890",
        fechaIngreso: "2025-09-01",
        cuotaActual: 20000,
        fechaVencimiento: "2026-09-10",
        estado: "Activo",
    },
    {
        id: 7,
        nombre: "Martín",
        apellido: "Sánchez",
        dni: "33099887",
        telefono: "358-4678901",
        fechaIngreso: "2024-05-30",
        cuotaActual: 28000,
        fechaVencimiento: "2026-09-25",
        estado: "Activo",
    },
    {
        id: 8,
        nombre: "Sofía",
        apellido: "Álvarez",
        dni: "42556677",
        telefono: "358-4789012",
        fechaIngreso: "2026-04-14",
        cuotaActual: 15000,
        fechaVencimiento: "2026-10-10",
        estado: "Activo",
    },
    {
        id: 9,
        nombre: "Diego",
        apellido: "Romero",
        dni: "37889900",
        telefono: "358-4890123",
        fechaIngreso: "2025-08-20",
        cuotaActual: 32000,
        fechaVencimiento: "2026-11-10",
        estado: "Activo",
    },
    {
        id: 10,
        nombre: "Valentina",
        apellido: "Torres",
        dni: "43557788",
        telefono: "358-4901234",
        fechaIngreso: "2026-06-25",
        cuotaActual: 27000,
        fechaVencimiento: "2026-12-10",
        estado: "Inactivo",
    },
];

// ---------- Persistencia (localStorage) ----------

// Clave única donde se guarda el listado de clientes.
const CLAVE_CLIENTES = "gymManager_clientes";

// Comprueba que un objeto tenga una estructura razonable de cliente.
function esClienteValido(cliente) {
    if (cliente === null || typeof cliente !== "object" || Array.isArray(cliente)) {
        return false;
    }

    return (
        typeof cliente.id === "number" &&
        typeof cliente.nombre === "string" &&
        typeof cliente.apellido === "string" &&
        typeof cliente.dni === "string" &&
        typeof cliente.telefono === "string" &&
        typeof cliente.fechaIngreso === "string" &&
        typeof cliente.cuotaActual === "number" &&
        typeof cliente.fechaVencimiento === "string" &&
        (cliente.estado === "Activo" || cliente.estado === "Inactivo")
    );
}

// Comprueba que el valor leído sea un array de clientes válidos.
function esListaDeClientesValida(datos) {
    return Array.isArray(datos) && datos.every(esClienteValido);
}

// Devuelve los clientes guardados en localStorage.
// Devuelve null si no hay nada guardado, si el JSON es inválido,
// si no es un array o si la estructura de los clientes no es válida.
function cargarClientes() {
    let guardado;

    try {
        guardado = localStorage.getItem(CLAVE_CLIENTES);
    } catch (error) {
        // localStorage no disponible (por ejemplo, bloqueado por el navegador).
        return null;
    }

    if (guardado === null) {
        return null;
    }

    let datos;
    try {
        datos = JSON.parse(guardado);
    } catch (error) {
        // El contenido guardado no es JSON válido.
        return null;
    }

    return esListaDeClientesValida(datos) ? datos : null;
}

// Guarda el listado completo de clientes.
function guardarClientes(lista) {
    try {
        localStorage.setItem(CLAVE_CLIENTES, JSON.stringify(lista));
    } catch (error) {
        // Si no se puede guardar (por ejemplo, almacenamiento lleno),
        // la aplicación sigue funcionando con los datos en memoria.
    }
}

// ---------- Estado inicial ----------

// Si hay datos persistidos válidos se usan esos; si no, la semilla.
const clientesGuardados = cargarClientes();
const clientes = clientesGuardados !== null ? clientesGuardados : clientesIniciales;

// Primera ejecución (o datos corruptos): la semilla queda guardada como estado válido.
if (clientesGuardados === null) {
    guardarClientes(clientes);
}