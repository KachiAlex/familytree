/* African Family Tree service worker.
   - Static shell: cache-first (JS/CSS/fonts/images from the build)
   - API calls (/api/*): network-only — tree data must never be stale-cached
   - Everything else: network-first with cache fallback */

const CACHE = 'ft-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache API responses

  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/static/') ||
      /\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|ico|json)$/.test(url.pathname) ||
      url.pathname === '/' || url.pathname === '/index.html');

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetched = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
        return cached || fetched;
      })
    );
    return;
  }

  // Navigations and other GETs: network first, fall back to cached shell
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match('/index.html'))
    )
  );
});
