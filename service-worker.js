// ====== BRAZO OFFLINE: SERVICE WORKER PARA GESTIÓN SIN INTERNET ======

const CACHE_NAME = "LetyAccesoriosCache-v5";


// Listado de archivos esenciales que el teléfono memorizará de forma local
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./js/db.js",
    "./js/app.js",
    "./js/lucide.min.js",
    "./images/logo.png",
    // Librerías externas cacheadas automáticamente por seguridad móvil
    "https://tailwindcss.com",
    "https://unpkg.com",
    "https://googleapis.com"
];

// 1. Evento de instalación: Se dispara la primera vez que se abre la app
self.addEventListener("install", (event) => {
    console.log(" Memoria Offline: Instalando Service Worker...");
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log(" Memoria Offline: Guardando pantallas y scripts en el dispositivo...");
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            // Forzar a que el Service Worker se active de inmediato sin esperar
            return self.skipWaiting();
        })
    );
});
// 2. Evento de activación: Limpia cualquier versión vieja de caché en el dispositivo
self.addEventListener("activate", (event) => {
    console.log(" Memoria Offline: Service Worker Activo.");
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log(" Memoria Offline: Eliminando caché antiguo...", cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Evento Fetch: Intercepta las solicitudes y sirve los archivos desde el almacenamiento local
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Si el archivo está en la memoria del teléfono, lo devuelve de inmediato
            if (cachedResponse) {
                return cachedResponse;
            }
            // Si no está (como una petición nueva), intenta ir a buscarlo a internet
            return fetch(event.request).catch(() => {
                console.warn(" Solicitud fallida y sin caché disponible para:", event.request.url);
            });
        })
    );
});
