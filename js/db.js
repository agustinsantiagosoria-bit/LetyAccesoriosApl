// ====== MOTOR DE BASE DE DATOS LOCAL REAL - LETY ACCESORIOS ======

const DB_NAME = "LetyAccesoriosRealDB";
const DB_VERSION = 1;
let db = null;

function inicializarDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const database = e.target.result;

            // 1. INSUMOS: Almacena el material base y un array de precios por proveedor
            if (!database.objectStoreNames.contains("insumos")) {
                database.createObjectStore("insumos", { keyPath: "id", autoIncrement: true });
            }

            // 2. PRODUCTOS: Guarda el accesorio, stock, margen y el array de insumos utilizados (receta)
            if (!database.objectStoreNames.contains("productos")) {
                database.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
            }

            // 3. VENTAS: Historial de tickets consolidados con fecha, método de pago y desglose de artículos
            if (!database.objectStoreNames.contains("ventas")) {
                database.createObjectStore("ventas", { keyPath: "id", autoIncrement: true });
            }
            console.log("🌸 Estructura SQLite/IndexedDB real configurada.");
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            console.log("✅ Base de datos real conectada.");
            resolve(db);
        };

        request.onerror = (e) => {
            console.error("❌ Error en IndexedDB:", e.target.error);
            reject(e.target.error);
        };
    });
}
// ====== OPERACIONES DE ESCRITURA Y CONSULTAS AVANZADAS ======

// Guarda o actualiza cualquier elemento (Insumo, Producto o Venta)
function guardarRegistro(storeName, objeto) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Base de datos no inicializada.");
        const tx = db.transaction([storeName], "readwrite");
        const request = tx.objectStore(storeName).put(objeto);

        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// Retorna el listado completo cargado por el usuario
function obtenerTodosLosRegistros(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Base de datos no inicializada.");
        const transaction = db.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Elimina de forma definitiva por ID de la base de datos local
function eliminarRegistro(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Base de datos no inicializada.");
        const tx = db.transaction([storeName], "readwrite");
        tx.objectStore(storeName).delete(id);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

// Promesa global: app.js espera a que la base esté abierta antes de leer datos
const dbListo = inicializarDB();
dbListo.catch(err => console.error("Error al iniciar base de datos real:", err));

