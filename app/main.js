// VibeGolf for Windows: an Electron shell round the hub (app.html). Stage B of claude/brief-pc-app.md.
//
// - Serves its own copy of the game from vibegolf://game/ (secure, so Bluetooth and cameras work; one fixed
//   origin, so saved data survives updates). The copy comes with the installer and is updated from GitHub
//   (lib/updater.js), file by file; a new copy is served from the next start ("Update ready, restart").
// - Opens the hub, which keeps the R10 link across every page. Nothing in the game is forked: the same
//   pages, the same launch-monitor code (src/r10/ble.js unchanged).
// - Answers the game's Bluetooth request itself (lib/r10-pick.js): the remembered R10 with no chooser, the
//   app's own chooser otherwise; at start it reconnects the remembered R10 with no tap.
// - Camera and microphone for the game's own origin only; outside links open in the normal browser; the PC
//   stays awake on play pages; F11 full screen; the window remembers its size and display.
'use strict';
const { app, BrowserWindow, protocol, session, shell, Menu, powerSaveBlocker, screen, dialog, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { createStore, readJSON, writeJSON } = require('./lib/site-store');
const { update } = require('./lib/updater');
const { decide, forChooser } = require('./lib/r10-pick');
const { restore } = require('./lib/window-state');
const { isPlayPage, pageOf } = require('./lib/pages');
const { mimeOf } = require('./lib/mime');

const SCHEME = 'vibegolf', HOST = 'game', ORIGIN = `${SCHEME}://${HOST}`;
const REPO = 'rhysfreitas/VibeGolf';
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);

// Test hooks (scripts/smoke.mjs): a throwaway data folder and Chromium's fake camera.
if (process.env.VIBEGOLF_USER_DATA) app.setPath('userData', process.env.VIBEGOLF_USER_DATA);
if (process.env.VIBEGOLF_TEST === '1') app.commandLine.appendSwitch('use-fake-device-for-media-stream');

// Two copies would fight over the R10: a second launch brings this one forward.
if (!app.requestSingleInstanceLock()) { app.quit(); return; }

const USER = () => app.getPath('userData');
const SETTINGS = () => path.join(USER(), 'settings.json');
let settings = {};
const save = () => { try { writeJSON(SETTINGS(), settings); } catch (e) { log({ what: 'settings-error', error: e.message }); } };
function log(entry) {
  try { fs.appendFileSync(path.join(USER(), 'app.log'), `${new Date().toISOString()} ${JSON.stringify(entry)}\n`); } catch (e) { /* no log */ }
  if (process.env.VIBEGOLF_LOG) console.log('[app]', JSON.stringify(entry));
}
const ours = url => typeof url === 'string' && url.startsWith(`${ORIGIN}/`);

let win = null, store = null, serving = null, readySha = null;

// ── The game's files ──
function serve() {
  protocol.handle(SCHEME, async req => {
    const u = new URL(req.url);
    if (u.host !== HOST) return new Response('Not found', { status: 404 });
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const root = path.resolve(serving.dir), file = path.resolve(root, `.${rel}`);
    if (!file.startsWith(root + path.sep)) return new Response('Not found', { status: 404 });
    try {
      const buf = await fs.promises.readFile(file);
      return new Response(buf, { headers: { 'content-type': mimeOf(file), 'cache-control': 'no-cache' } });
    } catch (e) { return new Response('Not found', { status: 404 }); }
  });
}

// ── The window ──
function createWindow() {
  const st = restore(settings.window, screen.getAllDisplays());
  win = new BrowserWindow({
    ...st.bounds, minWidth: 640, minHeight: 360, backgroundColor: '#101c22', title: 'VibeGolf', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  if (st.maximized) win.maximize();
  if (st.fullscreen) win.setFullScreen(true);
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    settings.window = { bounds: win.getNormalBounds(), maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
    save();
  });
  win.on('closed', () => { win = null; setAwake(false); });

  const wc = win.webContents;
  // Nothing but the game loads in the window; everything else opens in the normal browser.
  const outside = (e, url) => { if (!ours(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } };
  wc.on('will-navigate', outside);
  wc.on('will-frame-navigate', d => { if (!ours(d.url)) { d.preventDefault(); if (/^https?:/.test(d.url)) shell.openExternal(d.url); } });
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // The PC stays awake while a play page is open in the hub's frame.
  wc.on('did-frame-navigate', (e, url, code, status, isMainFrame) => {
    if (isMainFrame || !ours(url)) return;
    setAwake(isPlayPage(url));
    log({ what: 'page', page: pageOf(url) });
  });
  wc.on('render-process-gone', (e, d) => { log({ what: 'renderer-gone', reason: d.reason }); if (d.reason !== 'clean-exit') loadHub(); });
  wc.on('did-finish-load', () => { autoConnect(); if (readySha) showUpdateNote(); });
  wireBluetooth(wc);
  loadHub();
}

function loadHub(page) {
  const q = settings.debug === true ? '?r10debug=1' : settings.debug === false ? '?r10debug=0' : '';
  win.loadURL(`${ORIGIN}/app.html${q}${page ? `#${page}` : ''}`);
}
// Moves inside the hub's frame keep the link up; reloading the hub itself drops it for a moment.
const inHub = code => win && win.webContents.executeJavaScript(`(() => { const f = document.getElementById('game'); if (!f) return; ${code} })()`).catch(() => {});
const frameGo = page => inHub(`f.src = ${JSON.stringify(page)};`);
const frameBack = () => inHub('f.contentWindow.history.back();');
const frameReload = () => inHub('f.contentWindow.location.reload();');

let blocker = null;
global.__vg = { awake: () => blocker !== null, settings: () => settings, serving: () => serving };
function setAwake(on) {
  if (on && blocker === null) blocker = powerSaveBlocker.start('prevent-display-sleep');
  else if (!on && blocker !== null) { powerSaveBlocker.stop(blocker); blocker = null; }
}

// ── The R10 ──
// The game asks through Web Bluetooth (navigator.bluetooth.requestDevice); Electron hands the choice to us.
let bt = null, nextMode = 'tap', chooser = null;
function wireBluetooth(wc) {
  wc.on('select-bluetooth-device', (event, list, cb) => {
    event.preventDefault();
    if (!bt) {
      bt = { mode: nextMode, started: Date.now(), list: [], cb };
      nextMode = 'tap';
      bt.timer = setInterval(stepBluetooth, 400);
      log({ what: 'bt-request', mode: bt.mode, remembered: !!(settings.r10 && settings.r10.id) });
    }
    bt.cb = cb; bt.list = list;
    stepBluetooth();
  });
  // Windows may ask to pair the first time. The R10 pairs with a plain confirm.
  wc.session.setBluetoothPairingHandler((d, cb) => {
    log({ what: 'bt-pair', kind: d.pairingKind });
    if (d.pairingKind === 'confirm') cb({ confirmed: true });
    else if (d.pairingKind === 'confirmPin') {
      dialog.showMessageBox(win, { type: 'question', buttons: ['Pair', 'Cancel'], defaultId: 0, cancelId: 1, title: 'Pair the R10', message: 'Pair with the R10?', detail: `Check that the code matches: ${d.pin}` })
        .then(r => cb({ confirmed: r.response === 0 }));
    } else cb({ confirmed: false });
  });
}
function stepBluetooth() {
  if (!bt) return;
  const d = decide(bt.list, { mode: bt.mode, remembered: settings.r10 && settings.r10.id, started: bt.started });
  if (d.pick) finishBluetooth(d.pick);
  else if (d.cancel) finishBluetooth('');
  else if (d.ask) openChooser();
}
function finishBluetooth(id) {
  const b = bt; if (!b) return;
  bt = null; clearInterval(b.timer); closeChooser();
  if (id) { const dev = b.list.find(x => x.deviceId === id); settings.r10 = { id, name: (dev && dev.deviceName) || '' }; save(); }
  log({ what: 'bt-pick', mode: b.mode, picked: !!id, name: id && settings.r10 ? settings.r10.name : '', seen: b.list.length });
  b.cb(id);
}
// The app's chooser: lists what the scan finds (R10s first), like Chrome's.
function openChooser() {
  if (chooser) { chooser.webContents.send('chooser:list', forChooser(bt.list)); return; }
  chooser = new BrowserWindow({
    parent: win, modal: true, width: 420, height: 380, resizable: false, minimizable: false, maximizable: false, title: 'Connect the R10',
    backgroundColor: '#101c22', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'chooser-preload.js'), contextIsolation: true, sandbox: true },
  });
  chooser.setMenu(null);
  chooser.loadFile(path.join(__dirname, 'chooser.html'));
  chooser.once('ready-to-show', () => { chooser.show(); if (bt) chooser.webContents.send('chooser:list', forChooser(bt.list)); });
  chooser.on('closed', () => { chooser = null; if (bt) finishBluetooth(''); });
}
function closeChooser() { if (chooser) { const c = chooser; chooser = null; c.destroy(); } }
ipcMain.on('chooser:pick', (e, id) => { if (bt && bt.list.some(d => d.deviceId === id)) finishBluetooth(id); });
ipcMain.on('chooser:cancel', () => finishBluetooth(''));

// No tap at start: when the game says the R10 was connected last time but the page can't reconnect by
// itself (it reads `needsTap`), the app presses Connect R10 for it (as a user gesture) and picks the
// remembered R10 silently. If it isn't on, the game shows Connect R10 as usual after AUTO_WAIT.
function autoConnect() {
  if (!(settings.r10 && settings.r10.id)) return;
  setTimeout(async () => {
    if (!win) return;
    nextMode = 'auto';
    const r = await win.webContents.executeJavaScript(
      "(() => { const lm = window.__vibegolfHub && window.__vibegolfHub.launchMonitor; if (!lm || lm.source !== 'ble' || !lm.needsTap) return 'skip'; lm.connectBluetooth(true); return 'go'; })()", true,
    ).catch(e => `error ${e.message}`);
    if (r !== 'go') nextMode = 'tap';
    log({ what: 'auto-connect', result: r });
  }, 2500);
}

// ── Updates ──
async function runUpdate(fromMenu = false) {
  try {
    const r = await update({ fetch: (u, o) => net.fetch(u, o), repo: REPO, serving, store, log });
    log({ what: 'update', ...r });
    if (r.status === 'ready') { readySha = r.sha; showUpdateNote(); }
    if (fromMenu && r.status === 'current') dialog.showMessageBox(win, { type: 'info', message: 'VibeGolf is up to date.', detail: `Game ${serving.version.sha.slice(0, 7)}` });
  } catch (e) {
    log({ what: 'update-error', error: e.message });
    if (fromMenu) dialog.showMessageBox(win, { type: 'warning', message: 'Couldn\'t check for an update.', detail: e.message });
  }
}
// A small note over the hub (not inside the game's pages): Update ready · Restart.
function showUpdateNote() {
  if (!win) return;
  win.webContents.executeJavaScript(`(() => {
    if (document.getElementById('vgUpdate')) return;
    const d = document.createElement('div'); d.id = 'vgUpdate';
    d.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:10;display:flex;gap:10px;align-items:center;padding:8px 10px 8px 14px;background:rgba(14,26,32,.9);border:1px solid rgba(245,197,66,.5);border-radius:10px;color:#f2efe6;font:500 14px "Segoe UI",system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35)';
    d.innerHTML = '<span>Update ready</span><button id="vgRestart" style="appearance:none;border:0;border-radius:7px;padding:6px 12px;background:#f5c542;color:#2a2206;font:600 13px inherit;cursor:pointer">Restart</button><button id="vgLater" aria-label="Later" style="appearance:none;border:0;background:none;color:#a9bcc2;font-size:18px;cursor:pointer">×</button>';
    document.body.appendChild(d);
    d.querySelector('#vgRestart').onclick = () => window.vibegolfApp && window.vibegolfApp.restart();
    d.querySelector('#vgLater').onclick = () => d.remove();
  })()`).catch(() => {});
}
function relaunch() { app.relaunch(); app.quit(); }
ipcMain.on('app:restart', relaunch);
ipcMain.on('test:inject', e => { let s = ''; try { if (process.env.VIBEGOLF_TEST_INJECT) s = fs.readFileSync(process.env.VIBEGOLF_TEST_INJECT, 'utf8'); } catch (err) { /* none */ } e.returnValue = s; });
ipcMain.handle('app:info', () => ({ app: app.getVersion(), game: serving.version.sha, date: serving.version.date, source: serving.source, ready: readySha }));

// ── Menu (Alt shows it; the game keeps its plain-letter keys) ──
function buildMenu() {
  const tpl = [
    { label: 'VibeGolf', submenu: [
      { label: 'Home', accelerator: 'Ctrl+Shift+H', click: () => frameGo('index.html') },
      { label: 'Back', accelerator: 'Alt+Left', click: frameBack },
      { label: 'Reload page', accelerator: 'Ctrl+R', click: frameReload },
      { type: 'separator' },
      { label: 'Check for updates', click: () => runUpdate(true) },
      { label: 'Restart', click: relaunch },
      { type: 'separator' },
      { role: 'quit' },
    ] },
    { label: 'View', submenu: [
      { label: 'Full screen', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
    ] },
    { label: 'R10', submenu: [
      { label: 'R10 capture (r10debug)', type: 'checkbox', checked: settings.debug === true, click: m => { settings.debug = m.checked; save(); loadHub(); } },
      { label: 'Forget my R10', click: () => { delete settings.r10; save(); dialog.showMessageBox(win, { type: 'info', message: 'The app will ask which R10 to use next time.' }); } },
    ] },
    { label: 'Help', submenu: [
      { label: 'Developer tools', accelerator: 'Ctrl+Shift+I', click: () => win && win.webContents.toggleDevTools() },
      { label: 'Open the log folder', click: () => shell.openPath(USER()) },
      { label: 'VibeGolf on GitHub', click: () => shell.openExternal(`https://github.com/${REPO}`) },
      { label: 'About VibeGolf', click: () => dialog.showMessageBox(win, { type: 'info', title: 'About VibeGolf', message: `VibeGolf ${app.getVersion()}`,
        detail: `Game ${serving.version.sha.slice(0, 7)} (${serving.version.date ? serving.version.date.slice(0, 10) : '?'}, ${serving.source === 'bundled' ? 'from the installer' : 'downloaded'})${readySha ? `\nUpdate ready: ${readySha.slice(0, 7)}` : ''}\nElectron ${process.versions.electron}` }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

// ── Start ──
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.whenReady().then(() => {
  settings = readJSON(SETTINGS()) || {};
  store = createStore({ bundled: app.isPackaged ? path.join(process.resourcesPath, 'site') : path.join(__dirname, 'site'), sitesDir: path.join(USER(), 'sites') });
  serving = store.choose();
  log({ what: 'start', app: app.getVersion(), game: serving.version.sha, source: serving.source });
  try { store.prune(serving.source === 'downloaded' ? serving.dir : null); } catch (e) { log({ what: 'prune-error', error: e.message }); }
  serve();
  // The game's own origin gets camera, microphone, full screen and the rest; nothing else gets anything.
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(ours((details && details.requestingUrl) || wc.getURL())));
  ses.setPermissionCheckHandler((wc, perm, origin) => typeof origin === 'string' && origin.startsWith(ORIGIN));
  ses.setDevicePermissionHandler(d => typeof d.origin === 'string' && d.origin.startsWith(ORIGIN));
  buildMenu();
  createWindow();
  if (process.env.VIBEGOLF_NO_UPDATE !== '1') setTimeout(runUpdate, 8000);
});
