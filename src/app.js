// App shell: makes the site installable and playable offline once visited.
// The service worker is network-first, so a fresh push to GitHub shows up on the next load.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ }));
}
