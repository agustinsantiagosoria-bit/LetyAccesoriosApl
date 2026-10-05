// ====== BRAZO OFFLINE: SERVICE WORKER PARA GESTIÓN SIN INTERNET ======

// IMPORTANTE: subir este número cada vez que cambies index.html, app.js o db.js
const CACHE_NAME = "LetyAccesoriosCache-v6";

// Solo archivos propios. Si uno falla, falla la instalación completa (addAll es atómico),
// por eso NO van URLs externas ni archivos que no existan.
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./js/db.js",
    "./js/app.js",
    "./js/lucide.min.js",
    "./logo.png"
];

// 1. Instalación: guarda los archivos esenciales
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // cache: "reload" evita que el navegador entregue copias viejas de su caché HTTP
            .then((cache) => cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: "reload" }))))
            .then(() => self.skipWaiting())
    );
});

// 2. Activación: borra cachés de versiones anteriores
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((nombres) => Promise.all(
                nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
            ))
            .then(() => self.clients.claim())
    );
});

// 3. Fetch: archivos propios y fuentes de Google. Devuelve lo guardado y lo actualiza en segundo plano
self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const esMismoOrigen = url.origin === self.location.origin;
    const esFuente = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
    if (!esMismoOrigen && !esFuente) return;   // cualquier otra cosa sale directo a la red

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => {
            const guardado = await cache.match(event.request);

            const desdeRed = fetch(event.request)
                .then((resp) => {
                    if (resp && (resp.ok || resp.type === "opaque")) {
                        cache.put(event.request, resp.clone());
                    }
                    return resp;
                })
                .catch(() => null);

            if (guardado) {
                event.waitUntil(desdeRed);   // refresca la copia sin hacer esperar a la persona
                return guardado;
            }

            const resp = await desdeRed;
            if (resp) return resp;

            // Sin red y sin copia guardada
            if (event.request.mode === "navigate") return cache.match("./index.html");
            return new Response("", { status: 503, statusText: "Sin conexión" });
        })
    );
});