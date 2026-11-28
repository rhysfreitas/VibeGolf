// The hub (app.html): a top frame that stays loaded for the whole session and owns the links that must not
// drop between pages (the R10 now; the cameras later). The game's own pages load inside it, in a
// full-window frame from the same origin, and reach the link through src/launch-monitor.js, which finds
// `__vibegolfHub` above it and passes everything through (HubLink). Nothing here changes how a page plays.
import { launchMonitor, r10Capture } from './launch-monitor.js';

const frame = document.getElementById('game');

if (window.top !== window) {
  // a hub inside a hub (or inside anything else) would hold a second link: be the page instead
  location.replace('index.html');
} else {
  window.__vibegolfHub = { launchMonitor, capture: r10Capture, version: 1 };

  // Which page to open: app.html#course.html?c=aerie comes back to the page it was on (a reload, a bookmark).
  const PAGE = /^[a-z0-9-]+\.html(?:[?#][^\s]*)?$/i;
  const start = () => {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { h = ''; }
    return PAGE.test(h) && !/^app\.html/i.test(h) ? h : 'index.html';
  };

  frame.addEventListener('load', () => {
    let w, l;
    try { w = frame.contentWindow; l = w.location; void l.pathname; } catch (e) { return; }   // not ours: leave it
    const page = l.pathname.split('/').pop() || 'index.html';
    if (page === 'app.html') { w.location.replace('index.html'); return; }   // never a hub in the hub
    history.replaceState(null, '', `${location.pathname}${location.search}#${page}${l.search}${l.hash}`);
    document.title = w.document.title || 'VibeGolf';
    r10Capture.add({ dir: 'hub', what: 'page', page: page + l.search });
    try { w.focus(); } catch (e) { /* keys still reach it after a tap */ }
  });
  frame.src = start();

  // The hub's link is the only one: come back the way the player was connected last time (no tap where
  // the browser remembers the R10), and hand the R10 back only when the hub itself goes.
  launchMonitor.resume();
  addEventListener('pagehide', () => { if (launchMonitor.source === 'ble') launchMonitor.ble.release(); });
  addEventListener('pageshow', e => { if (e.persisted) launchMonitor.resume(); });
}
