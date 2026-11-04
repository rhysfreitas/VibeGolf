// App shell: makes the site installable and playable offline once visited.
// The service worker is network-first, so a fresh push to GitHub shows up on the next load.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  // updateViaCache: 'none' makes the browser check sw.js itself on every load, never a cached copy
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* offline support is optional */ }));
  // when a new service worker takes over (after a push that changed it), reload once so this page is fresh too
  const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
