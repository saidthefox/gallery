// rescued.art service worker — installable + offline shell.
// IMPORTANT: the live feed (Worker + Apps Script) is always fetched from the
// network, so the gallery never shows stale art. Bump CACHE on any asset change.
const CACHE = 'rescued-art-v1';
const SHELL = [
  '/', '/gallery/', '/rent/', '/visit/',
  '/assets/core.css', '/assets/gallery.js', '/assets/config.js',
  '/icon-192.png', '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Live data + images: always go to the network (never cache the feed).
  const liveHosts = ['workers.dev', 'script.google.com', 'googleusercontent.com', 'drive.google.com'];
  if (liveHosts.some(h => url.hostname.includes(h))) return; // default browser fetch

  // Same-origin static: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
