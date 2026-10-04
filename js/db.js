// ====== MOTOR DE BASE DE DATOS LOCAL (IndexedDB) FOR LETY ACCESORIOS ======

const DB_NAME = "LetyAccesoriosDB";
const DB_VERSION = 1;
let db = null;

// Método de inicialización asíncrona de IndexedDB
function inicializarDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Se ejecuta la primera vez que se abre la app o si sube la versión
        request.onupgradeneeded = (e) => {
            const database = e.target.result;

            // 1. Almacén para los Materiales / Insumos
            if (!database.objectStoreNames.contains("insumos")) {
                database.createObjectStore("insumos", { keyPath: "id", autoIncrement: true });
            }

            // 2. Almacén para el Catálogo de Productos Terminados
            if (!database.objectStoreNames.contains("productos")) {
                database.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
            }

            // 3. Almacén para el Historial de Pedidos y Ventas
            if (!database.objectStoreNames.contains("ventas")) {
                database.createObjectStore("ventas", { keyPath: "id", autoIncrement: true });
            }
            console.log(" Stores creados con éxito en IndexedDB.");
        };

        request.onsuccess = async (e) => {
            db = e.target.result;
            console.log(" Base de datos local conectada correctamente.");
            
            // Verificación inteligente: Si no hay registros, inyectamos la simulación
            try {
                const insumosExistentes = await obtenerTodosLosRegistros("insumos");
                if (insumosExistentes.length === 0) {
                    await cargarSimulacionInicial();
                }
            } catch (err) {
                console.warn("Verificando primer inicio de la app...", err);
            }
            
            resolve(db);
        };


        request.onerror = (e) => {
            console.error("❌ Error abriendo IndexedDB:", e.target.error);
            reject(e.target.error);
        };
    });
}
// ====== OPERACIONES GENERALES DE ESCRITURA Y LECTURA DE SQLite LOCAL ======

// Función genérica para guardar o actualizar un registro en cualquier almacén
function guardarRegistro(storeName, objeto) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("La base de datos no está inicializada.");

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.put(objeto); // .put guarda si es nuevo o actualiza si ya tiene un ID existente

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Función genérica para obtener el listado completo de cualquier tabla
function obtenerTodosLosRegistros(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("La base de datos no está inicializada.");

        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Función genérica para eliminar registros usando su identificador único (ID)
function eliminarRegistro(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("La base de datos no está inicializada.");

        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Autoejecución al cargar el archivo de script para dejar el canal activo
inicializarDB().catch(err => {
    console.error("No se pudo iniciar el canal de datos local:", err);
});
// ====== INYECCIÓN AUTOMATIZADA DE DATOS INICIALES DE PRUEBA ======

async function cargarSimulacionInicial() {
    console.log("🌸 Simulando registros iniciales para poblar la aplicación...");

    // 1. Cargar materiales de muestra en la tabla de insumos
    const insumosMuestra = [
        { nombre: "Cuentas Corazón Rosa", precio: 1.50, stock: "150", distribuidora: "Gemas S.A. (+$2)" },
        { nombre: "Hilo Nylon 0.5mm", precio: 8.00, stock: "220", distribuidora: "Mercería Lety (+$0.50)" },
        { nombre: "Argollas Oro 6mm", precio: 3.50, stock: "400", distribuidora: "Metales Pro (+$1)" },
        { nombre: "Cordón Elástico Rosa", precio: 5.00, stock: "2", distribuidora: "Once Insumos (Alerta)" },
        { nombre: "Arguilas Oro", precio: 4.00, stock: "10", distribuidora: "Centro Distribuidora (Alerta)" }
    ];

    for (const insumo of insumosMuestra) {
        await guardarRegistro("insumos", insumo);
    }

    // 2. Cargar catálogo inicial de productos de producción
    const productosMuestra = [
        { nombre: "Pulsera Corazón Rosa", costo: 60.00, precioVenta: 150.00, stock: 20 },
        { nombre: "Aretes Flores Pastel", costo: 45.00, precioVenta: 120.00, stock: 15 },
        { nombre: "Collar Luna Dorada", costo: 110.00, precioVenta: 250.00, stock: 8 }
    ];

    for (const prod of productosMuestra) {
        await guardarRegistro("productos", prod);
    }

    // 3. Cargar historial inicial de tickets asentados en caja de Junio
    const ventasMuestra = [
        { total: 150.00, estado: "completado", activa: true, fecha: "2026-06-15T14:30:00.000Z" },
        { total: 120.00, estado: "pendiente", activa: true, fecha: "2026-06-16T11:15:00.000Z" },
        { total: 180.00, estado: "completado", activa: true, fecha: "2026-06-18T18:45:00.000Z" }
    ];

    for (const venta of ventasMuestra) {
        await guardarRegistro("ventas", venta);
    }

    console.log("✅ Datos simulados cargados con éxito en el almacenamiento local.");
}
// ====== SISTEMA AUTOMÁTICO DE REBAJA DE STOCK POR COMPRA ======

async function procesarDescuentoDeInsumos(nombreProducto, cantidadVendida) {
    if (!db) return;

    // 1. Traer todos los materiales guardados en IndexedDB
    const todosLosInsumos = await obtenerTodosLosRegistros("insumos");

    // 2. Mapeo inteligente de recetas físicas
    // Buscamos si el insumo coincide con el nombre del producto vendido para simular el consumo
    for (const insumo of todosLosInsumos) {
        if (nombreProducto.toLowerCase().includes("corazón") && insumo.nombre.toLowerCase().includes("corazón")) {
            // Ejemplo: Cada pulsera de corazón consume 5 cuentas por unidad terminada
            let stockActual = parseFloat(insumo.stock) || 0;
            insumo.stock = Math.max(0, stockActual - (5 * cantidadVendida)).toString();
            await guardarRegistro("insumos", insumo);
        }
        else if (nombreProducto.toLowerCase().includes("collar") && insumo.nombre.toLowerCase().includes("nylon")) {
            // Ejemplo: Cada collar consume 2 metros de hilo de nylon
            let stockActual = parseFloat(insumo.stock) || 0;
            insumo.stock = Math.max(0, stockActual - (2 * cantidadVendida)).toString();
            await guardarRegistro("insumos", insumo);
        }
    }
}
// ====== EVENTO PARA ASENTAR TICKET Y DESCONTAR MATERIALES EN LOTE ======

async function ejecutarNuevaVentaSimulada() {
    // 1. Simular la venta fija basada en las tarjetas de la maqueta (Foto 1)
    // En una versión final, acá capturarías el producto seleccionado de un formulario
    const nombreProductoVendido = "Pulsera Corazón Rosa";
    const cantidadACobrar = 1; 
    const precioUnitario = 150.00;

    const nuevaVentaFisica = {
        total: (precioUnitario * cantidadACobrar),
        estado: "completado",
        activa: true,
        fecha: new Date().toISOString()
    };

    try {
        // 2. Guardar la factura de mostrador en el historial de IndexedDB
        await guardarRegistro("ventas", nuevaVentaFisica);

        // 3. Ejecutar la rebaja automática de insumos (Cuentas, Nylon, etc.)
        await procesarDescuentoDeInsumos(nombreProductoVendido, cantidadACobrar);

        // 4. Refrescar de forma viva todas las tablas Excel y las alertas del Dashboard
        await actualizarTablasYPaneles();

        alert(`🌸 ¡Venta Registrada! Se cobraron $${nuevaVentaFisica.total} MXN y se actualizaron los materiales en stock.`);
        console.log(" Ticket cerrado. Inventario actualizado correctamente.");

    } catch (error) {
        console.error("❌ Error al cerrar la transacción de mostrador:", error);
        alert("No se pudo procesar la venta en el almacenamiento local.");
    }
}

// ====== CONEXIÓN CON EL BOTÓN NARANJA PASTEL DE REGISTRO ======

document.addEventListener("DOMContentLoaded", () => {
    // Buscamos el botón de 'Registrar Nueva Venta' para asociarle la lógica automatizada
    setTimeout(() => {
        const botones = document.querySelectorAll("button");
        botones.forEach(btn => {
            if (btn.innerText.includes("Registrar Nueva Venta")) {
                btn.setAttribute("onclick", "ejecutarNuevaVentaSimulada()");
            }
        });
    }, 500);
});
