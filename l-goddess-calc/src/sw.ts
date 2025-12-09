/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
const CACHE_NAME = "grc-cache-v1";
const ASSETS = [
  "/",            // vite preview pode servir de outra forma; ok se falhar
  "/index.html",
  // O Vite renomeia assets com hash; este SW é simples.
  // Para produção séria, considerar VitePWA ou Workbox.
];

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(()=>{})
  );
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event: FetchEvent) => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      // cache first for GET only
      if (req.method === "GET") {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
      }
      return res;
    }).catch(() => cached || new Response('', { status: 504, statusText: 'Gateway Timeout' })))
  );
});
