// Guarda la app en el iPhone para que funcione sin conexión.
// Siempre responde con la copia guardada y, si hay internet, la actualiza
// por detrás: los cambios se ven la siguiente vez que se abre.

const CACHE = "locales-v2";
const ARCHIVOS = [
  "./",
  "index.html",
  "estilos.css",
  "buscador.js",
  "app.js",
  "locales.json",
  "manifest.webmanifest",
  "icono-180.png",
  "icono-192.png",
  "icono-512.png",
];

self.addEventListener("install", evento => {
  evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys()
      .then(nombres => Promise.all(nombres.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || new URL(peticion.url).origin !== location.origin) return;

  const deRed = fetch(peticion).then(respuesta => {
    if (respuesta.ok) {
      const copia = respuesta.clone();
      caches.open(CACHE).then(cache => cache.put(peticion, copia));
    }
    return respuesta;
  });

  evento.respondWith(
    caches.match(peticion, { ignoreSearch: true }).then(guardada => {
      if (guardada) {
        evento.waitUntil(deRed.catch(() => {}));
        return guardada;
      }
      return deRed;
    })
  );
});
