/* Service worker for Drum Tab Maker.
   Bump VERSION whenever the cached assets change. */
const VERSION = 'v1';
const CACHE = `drumtab-${VERSION}`;

const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so updates show up, cache as offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', res.clone());
        }
        return res;
      } catch {
        return (
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        );
      }
    })());
    return;
  }

  // Static assets: cache first, then network with background refresh.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then(async (res) => {
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    }).catch(() => null);

    return cached || (await network) || new Response('Offline', { status: 503 });
  })());
});
