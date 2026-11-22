
const CACHE_NAME = "LetyAccesoriosCache-v8";

const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./images/logo.png",
    "./js/db.js",
    "./js/app.js",
    "./js/lucide.min.js",
    "./js/resumen.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        const resultados = await Promise.allSettled(
            ASSETS_TO_CACHE.map(async (ruta) => {
                const respuesta = await fetch(ruta, { cache: "reload" });

                if (!respuesta.ok) {
                    throw new Error(`${ruta}: HTTP ${respuesta.status}`);
                }

                await cache.put(ruta, respuesta);
            })
        );

        resultados.forEach((resultado, indice) => {
            if (resultado.status === "rejected") {
                console.warn(
                    "No se pudo precargar:",
                    ASSETS_TO_CACHE[indice],
                    resultado.reason
                );
            }
        });

        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const nombres = await caches.keys();

        await Promise.all(
            nombres
                .filter(nombre =>
                    nombre.startsWith("LetyAccesoriosCache-") &&
                    nombre !== CACHE_NAME
                )
                .map(nombre => caches.delete(nombre))
        );

        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    const esMismoOrigen = url.origin === self.location.origin;

    const esFuenteGoogle =
        url.hostname === "fonts.googleapis.com" ||
        url.hostname === "fonts.gstatic.com";

    if (!esMismoOrigen && !esFuenteGoogle) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const respuestaEnCache = await cache.match(event.request);

        if (respuestaEnCache) {
            return respuestaEnCache;
        }

        try {
            const respuestaRed = await fetch(event.request);

            if (respuestaRed && respuestaRed.ok) {
                await cache.put(event.request, respuestaRed.clone());
            }

            return respuestaRed;

        } catch (error) {

            if (event.request.mode === "navigate") {
                const paginaOffline = await cache.match("./index.html");

                if (paginaOffline) return paginaOffline;
            }

            return new Response(
                "Recurso no disponible sin conexión",
                {
                    status: 503,
                    statusText: "Service Unavailable",
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8"
                    }
                }
            );
        }
    })());
});
