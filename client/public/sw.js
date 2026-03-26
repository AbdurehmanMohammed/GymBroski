/* Minimal SW so Chrome/Edge can treat the site as installable (with manifest). No offline cache. */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
