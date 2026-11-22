
// ============================================================================
// LETY ACCESORIOS - IndexedDB v2
// Esquema local preparado para unidades flexibles y futura sincronizacion.
// No reemplaza aun la logica de ventas de app.js: esa migracion va despues.
// ============================================================================

const DB_NAME = "LetyAccesoriosRealDB";
const DB_VERSION = 2;

let db = null;
let dbListo = null;

function asegurarDBLista() {
    if (db) return Promise.resolve(db);
    if (!dbListo) dbListo = inicializarDB().catch(error => {
        dbListo = null;
        throw error;
    });
    return dbListo;
}

dbListo = asegurarDBLista();

const STORES = {
    insumos: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["nombre", "nombre", { unique: false }],
            ["activo", "activo", { unique: false }]
        ]
    },
    productos: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["nombre", "nombre", { unique: false }],
            ["activo", "activo", { unique: false }]
        ]
    },
    ventas: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["fecha", "fecha", { unique: false }],
            ["activa", "activa", { unique: false }]
        ]
    },
    proveedores: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["nombre", "nombre", { unique: false }]
        ]
    },
    insumoProveedores: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["insumoId", "insumoId", { unique: false }],
            ["proveedorId", "proveedorId", { unique: false }]
        ]
    },
    compras: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["fecha", "fecha", { unique: false }],
            ["proveedorId", "proveedorId", { unique: false }]
        ]
    },
    detalleCompras: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["compraId", "compraId", { unique: false }],
            ["insumoId", "insumoId", { unique: false }]
        ]
    },
    productoInsumos: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["productoId", "productoId", { unique: false }],
            ["insumoId", "insumoId", { unique: false }]
        ]
    },
    ordenesProduccion: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["fecha", "fecha", { unique: false }],
            ["productoId", "productoId", { unique: false }],
            ["estado", "estado", { unique: false }]
        ]
    },
    detalleConsumoProduccion: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["ordenProduccionId", "ordenProduccionId", { unique: false }],
            ["insumoId", "insumoId", { unique: false }]
        ]
    },
    detalleVentas: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["ventaId", "ventaId", { unique: false }],
            ["productoId", "productoId", { unique: false }]
        ]
    },
    movimientosStock: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["insumoId", "insumoId", { unique: false }],
            ["productoId", "productoId", { unique: false }],
            ["fecha", "fecha", { unique: false }],
            ["tipo", "tipo", { unique: false }]
        ]
    },
    dispositivos: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["ultimoUso", "ultimoUso", { unique: false }]
        ]
    },
    operacionesPendientes: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["uidOperacion", "uidOperacion", { unique: true }],
            ["estado", "estado", { unique: false }],
            ["creadoEn", "creadoEn", { unique: false }]
        ]
    },
    configuracion: {
        indexes: [
            ["uid", "uid", { unique: true }],
            ["clave", "clave", { unique: true }]
        ]
    }
};

function nuevoUid() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return "uid-" + Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function crearAlmacen(database, nombre, definicion) {
    const store = database.objectStoreNames.contains(nombre)
        ? null
        : database.createObjectStore(nombre, { keyPath: "id", autoIncrement: true });

    const objectStore = store || null;
    if (objectStore) {
        for (const [indexName, keyPath, options] of definicion.indexes) {
            if (!objectStore.indexNames.contains(indexName)) {
                objectStore.createIndex(indexName, keyPath, options);
            }
        }
    }
}

function asegurarIndicesEnAlmacenesExistentes(transaction) {
    for (const [nombre, definicion] of Object.entries(STORES)) {
        if (!transaction.objectStoreNames.contains(nombre)) continue;
        const store = transaction.objectStore(nombre);
        for (const [indexName, keyPath, options] of definicion.indexes) {
            if (!store.indexNames.contains(indexName)) {
                store.createIndex(indexName, keyPath, options);
            }
        }
    }
}

function migrarRegistrosExistentes(transaction) {
    // Migracion aditiva: conserva los IDs numericos existentes y agrega UID.
    // No interpreta el antiguo campo "factor" como conversion de unidades,
    // porque en la version anterior tenia otro significado.
    for (const nombre of ["insumos", "productos", "ventas"]) {
        if (!transaction.objectStoreNames.contains(nombre)) continue;

        const store = transaction.objectStore(nombre);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) return;

            const registro = cursor.value;
            let modificado = false;

            if (!registro.uid) {
                registro.uid = nuevoUid();
                modificado = true;
            }

            if (registro.esquemaVersion !== 2) {
                registro.esquemaVersion = 2;
                modificado = true;
            }

            if (nombre === "insumos") {
                if (!registro.unidadControl) {
                    const esMetro = registro.unidad === "xM";
                    registro.unidadControl = {
                        dimension: esMetro ? "longitud" : "cantidad",
                        unidadBase: esMetro ? "m" : "unidad",
                        simbolo: esMetro ? "m" : "u",
                        precision: esMetro ? 3 : 0
                    };
                    modificado = true;
                }

                if (!Array.isArray(registro.presentacionesCompra)) {
                    registro.presentacionesCompra = [];
                    modificado = true;
                }

                if (registro.stockUnidadBase == null) {
                    registro.stockUnidadBase = Number(registro.stock) || 0;
                    modificado = true;
                }

                // Se conserva el valor historico, pero no se usa como factor
                // de conversion en el nuevo modelo.
                if (registro.factor != null && registro.factorLegado == null) {
                    registro.factorLegado = registro.factor;
                    modificado = true;
                }
            }

            if (nombre === "productos" && !registro.modalidadProduccion) {
                // Requiere revision manual: no se puede inferir si el articulo
                // se fabrica antes o despues de recibir el pedido.
                registro.modalidadProduccion = "revisar_modalidad";
                modificado = true;
            }

            if (modificado) cursor.update(registro);
            cursor.continue();
        };
    }
}

function inicializarDB() {
    return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) {
            reject(new Error("Este navegador no admite IndexedDB."));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            const transaction = event.target.transaction;

            for (const [nombre, definicion] of Object.entries(STORES)) {
                if (!database.objectStoreNames.contains(nombre)) {
                    const store = database.createObjectStore(nombre, {
                        keyPath: "id",
                        autoIncrement: true
                    });

                    for (const [indexName, keyPath, options] of definicion.indexes) {
                        store.createIndex(indexName, keyPath, options);
                    }
                }
            }

            asegurarIndicesEnAlmacenesExistentes(transaction);
            migrarRegistrosExistentes(transaction);
        };

        request.onsuccess = (event) => {
            db = event.target.result;

            db.onversionchange = () => {
                db.close();
                db = null;
                dbListo = null;
                console.warn("La base local se cerro para permitir una actualizacion.");
            };

            db.onerror = (event) => {
                console.error("Error interno de IndexedDB:", event.target.error);
            };

            console.info(`IndexedDB ${DB_NAME} v${DB_VERSION} conectada.`);
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("No se pudo abrir IndexedDB:", event.target.error);
            reject(event.target.error);
        };

        request.onblocked = () => {
            console.warn("La actualizacion esta bloqueada por otra pestaña abierta. Cerrala y reintenta.");
        };
    });
}

async function obtenerDB() {
    if (db && db.objectStoreNames) return db;
    return await asegurarDBLista();
}

function validarAlmacen(storeName) {
    if (!Object.prototype.hasOwnProperty.call(STORES, storeName)) {
        throw new Error(`Almacen no permitido o inexistente: ${storeName}`);
    }
}

async function guardarRegistro(storeName, objeto) {
    validarAlmacen(storeName);
    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const registro = structuredClone(objeto);

        if (!registro.uid) registro.uid = nuevoUid();
        registro.esquemaVersion = DB_VERSION;
        registro.actualizadoEn = new Date().toISOString();

        const request = store.put(registro);
        let idGuardado;

        request.onsuccess = () => {
            idGuardado = request.result;
        };

        tx.oncomplete = () => resolve({
            id: idGuardado,
            uid: registro.uid
        });
        tx.onerror = () => reject(tx.error || new Error("No se pudo guardar el registro."));
        tx.onabort = () => reject(tx.error || new Error("La operacion fue cancelada."));
    });
}

async function obtenerTodosLosRegistros(storeName) {
    validarAlmacen(storeName);
    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function obtenerRegistroPorId(storeName, id) {
    validarAlmacen(storeName);
    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);

        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}

async function obtenerRegistroPorUid(storeName, uid) {
    validarAlmacen(storeName);
    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).index("uid").get(uid);

        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}

async function eliminarRegistro(storeName, id) {
    validarAlmacen(storeName);
    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(id);

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error("No se pudo eliminar."));
        tx.onabort = () => reject(tx.error || new Error("La eliminacion fue cancelada."));
    });
}

// IMPORTANTE: el callback debe encolar todas las operaciones IndexedDB
// de forma sincrona. No usar await dentro del callback: IndexedDB puede
// cerrar la transaccion cuando no quedan operaciones pendientes.
async function ejecutarTransaccionDB(storeNames, callback) {
    const nombres = Array.isArray(storeNames) ? storeNames : [storeNames];
    nombres.forEach(validarAlmacen);

    const database = await obtenerDB();

    return new Promise((resolve, reject) => {
        const tx = database.transaction(nombres, "readwrite");
        let resultado;

        try {
            resultado = callback(
                Object.fromEntries(nombres.map(nombre => [nombre, tx.objectStore(nombre)])),
                tx
            );

            if (resultado && typeof resultado.then === "function") {
                tx.abort();
                reject(new Error("El callback de una transaccion IndexedDB no puede ser async."));
                return;
            }
        } catch (error) {
            tx.abort();
            reject(error);
            return;
        }

        tx.oncomplete = () => resolve(resultado);
        tx.onerror = () => reject(tx.error || new Error("Error en la transaccion."));
        tx.onabort = () => reject(tx.error || new Error("Transaccion cancelada."));
    });
}

// Convierte una cantidad desde una presentacion/unidad de compra a la unidad base.
// Ejemplo: 2 rollos x 100 cm = 200 cm. El factor expresa unidades base
// contenidas en UNA unidad de la presentacion seleccionada.
function convertirAUnidadBase(cantidad, factorAUnidadBase) {
    const valor = Number(cantidad);
    const factor = Number(factorAUnidadBase);

    if (!Number.isFinite(valor) || valor < 0) {
        throw new Error("La cantidad debe ser un numero mayor o igual a cero.");
    }
    if (!Number.isFinite(factor) || factor <= 0) {
        throw new Error("El factor de conversion debe ser mayor que cero.");
    }

    return valor * factor;
}

function calcularCostoPorUnidadBase(precioCompra, cantidadPresentacion, factorAUnidadBase = 1) {
    const precio = Number(precioCompra);
    const cantidad = convertirAUnidadBase(cantidadPresentacion, factorAUnidadBase);

    if (!Number.isFinite(precio) || precio < 0 || cantidad <= 0) {
        throw new Error("Precio o presentacion de compra invalidos.");
    }

    return precio / cantidad;
}

// Registra una operacion local para sincronizar mas adelante.
// La sincronizacion real con el servidor se implementara en otra etapa.
async function encolarOperacion(tipoEntidad, entidadUid, accion, datos) {
    const uidOperacion = nuevoUid();
    return await guardarRegistro("operacionesPendientes", {
        uidOperacion,
        tipoEntidad,
        entidadUid,
        accion,
        datos: structuredClone(datos),
        estado: "pendiente",
        creadoEn: new Date().toISOString(),
        intentos: 0
    });
}

window.addEventListener("online", () => {
    console.info("Conexion recuperada. Las operaciones pendientes podran sincronizarse.");
});
