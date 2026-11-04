// Network-first service worker: always try the network (so new pushes appear immediately),
// fall back to the last cached copy when offline. Our own files are fetched with cache: 'no-cache',
// which asks the server every time (a cheap "not modified" when nothing changed) instead of letting
// the browser reuse its copy for up to 10 minutes, which is how long GitHub Pages lets it.
const CACHE = 'vibegolf-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !url.hostname.endsWith('fonts.googleapis.com') && !url.hostname.endsWith('fonts.gstatic.com')) return;
  const own = url.origin === location.origin;
  e.respondWith(
    fetch(own ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
  );
});
