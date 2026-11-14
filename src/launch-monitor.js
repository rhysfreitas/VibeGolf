// Live launch-monitor link, shared by every mode. Two sources, one `shot` event:
//
// - Bluetooth (default where the browser has Web Bluetooth): the game talks to the R10 itself
//   (src/r10/ble.js over src/r10/protocol.js). Chrome and Edge on Android, Windows and Mac; Bluefy on iPhone.
// - Bridge (fallback): a small local bridge (bridge/bridge.js) accepts GSPro Open Connect shots on TCP 921
//   (what OpenLaunch Connect, gsp-r10-adapter and the Garmin E6 relays speak) and relays them over a WebSocket.
//
// Usage:
//   import { launchMonitor, mountLaunchMonitorUI } from './launch-monitor.js';
//   launchMonitor.addEventListener('shot', e => fire(e.detail));   // detail = BallData (mph, deg, rpm) + Club? + Meta
//   launchMonitor.setPlayer({ club: '7i' });                        // tells a bridge connector which club is in hand
//   launchMonitor.source                                            // 'ble' | 'bridge'
//
// Shot shape: { Speed, VLA, HLA, TotalSpin, SpinAxis (+ = right), Club?: { Speed, Path, FaceToTarget, AngleOfAttack, Loft? },
//   Meta: { source: 'ble' | 'bridge', shotNumber, spinSource, marking, timing } }. Club is absent when the
//   monitor didn't track the club (the R10 sends face, path and attack as 0.0 on slow swings).
import { R10Link, hasBluetooth, createCapture, explainBleError } from './r10/ble.js';

const KEY = 'vibegolf.lm.url';
const SRC = 'vibegolf.lm.source';
const TEE = 'vibegolf.lm.teeft';
const AUTO = 'vibegolf.lm.auto';
const DEFAULT_URL = 'ws://localhost:8921';

// GSPro club codes, used when we report the selected club back to the adapter.
const CLUB_CODES = { DR: 'DR', '3W': 'W3', HY: 'H4', '5i': 'I5', '7i': 'I7', '9i': 'I9', PW: 'PW', SW: 'SW', PT: 'PT' };

function store(get, val, key = KEY) {
  try { if (get) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { /* storage blocked */ }
  return null;
}

// ?r10debug=1 turns the raw capture on (and keeps it on across pages); ?r10debug=0 turns it off.
const DEBUG = (() => {
  try {
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('r10debug') : null;
    if (q !== null) localStorage.setItem('vibegolf.r10debug', q === '0' ? '' : '1');
    return localStorage.getItem('vibegolf.r10debug') === '1';
  } catch (e) { return false; }
})();
export const r10Capture = createCapture(DEBUG);

// Accepts a GSPro Open Connect message, a bare BallData object, or { type: 'shot', ball: {...} }.
export function parseShot(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.type === 'shot' && msg.ball) msg = { BallData: msg.ball, ClubData: msg.club };
  const opts = msg.ShotDataOptions;
  if (opts && (opts.IsHeartBeat || opts.ContainsBallData === false)) return null;
  const b = msg.BallData || (msg.Speed !== undefined ? msg : null);
  if (!b || !(+b.Speed > 0)) return null;
  const back = +b.BackSpin || 0, side = +b.SideSpin || 0;
  let total = +b.TotalSpin || Math.hypot(back, side);
  let axis = b.SpinAxis !== undefined ? +b.SpinAxis : (back ? Math.atan2(side, back) * 180 / Math.PI : 0);
  const shot = { Speed: +b.Speed, VLA: +b.VLA || 0, HLA: +b.HLA || 0, TotalSpin: total, SpinAxis: axis };
  // Club data (GSPro ClubData: Speed mph, Path, FaceToTarget, AngleOfAttack, Loft... in degrees)
  const c = msg.ClubData;
  if (c && typeof c === 'object' && (opts?.ContainsClubData !== false) && Object.keys(c).length) {
    const num = k => (c[k] === undefined || c[k] === null || c[k] === '' ? undefined : +c[k]);
    shot.Club = { Speed: num('Speed'), Path: num('Path'), FaceToTarget: num('FaceToTarget'), AngleOfAttack: num('AngleOfAttack'), Loft: num('Loft') };
    // the R10's slow-swing placeholder (face, path and attack all exactly 0) means the club wasn't tracked
    if (shot.Club.Path === 0 && shot.Club.FaceToTarget === 0 && shot.Club.AngleOfAttack === 0) delete shot.Club;
  }
  return shot;
}

// A shot relayed by the bridge, tagged with Meta (the connector sends no spin source or timing).
export function bridgeShot(msg) {
  const shot = parseShot(msg);
  if (!shot) return null;
  const n = msg.shotNumber ?? msg.ShotNumber;
  shot.Meta = { source: 'bridge', shotNumber: n === undefined || n === null ? null : +n, spinSource: null, marking: null, timing: null };
  return shot;
}

const FAULT_TEXT = {
  'not-level': 'R10 not level · level it, then swing',
  'too-hot': 'R10 too hot · let it cool in the shade',
  'signal-overload': 'R10 radar overloaded · clear reflective things from in front of it',
  unspecified: 'R10 reported a fault',
};

class LaunchMonitor extends EventTarget {
  constructor() {
    super();
    this.url = store(true) || DEFAULT_URL;
    this.bluetooth = hasBluetooth();
    const src = store(true, null, SRC);
    this.source = src === 'ble' || src === 'bridge' ? src : (this.bluetooth ? 'ble' : 'bridge');
    if (this.source === 'ble' && !this.bluetooth) this.source = 'bridge';
    this.status = 'off';          // off | connecting | bridge | ready
    this.detail = 'Not connected';
    this.needsTap = false;        // Bluetooth was on last time but this page can't reconnect without a tap
    this.notListed = false;       // the chooser closed without an R10: offer the list of every device
    this.ws = null;
    this.retry = 0;
    this.wanted = false;
    this.player = { club: 'DR', handed: 'RH' };
    const ft = parseFloat(store(true, null, TEE));
    this.teeFt = isFinite(ft) && ft > 0 ? ft : null;
    this.ble = new R10Link({ emit: (t, d) => this.onBle(t, d), log: e => r10Capture.add(e) });
    this.ble.setEnvironment(this.environment());
  }
  setStatus(status, detail) {
    this.status = status; this.detail = detail;
    if (status !== 'off') this.needsTap = false;
    r10Capture.add({ dir: 'lm', what: 'status', status, detail });
    this.dispatchEvent(new CustomEvent('status', { detail: { status, detail } }));
  }
  emitShot(shot) {
    if (this.status !== 'ready') this.setStatus('ready', this.source === 'ble' ? 'R10 ready · Bluetooth' : 'R10 ready');
    r10Capture.add({ dir: 'lm', what: 'shot', shot });
    this.dispatchEvent(new CustomEvent('shot', { detail: shot }));
  }

  // ── Bridge ──
  connect(url = this.url) {
    this.disconnect(true);
    this.source = 'bridge'; store(false, 'bridge', SRC);
    this.url = url; store(false, url); store(false, '1', AUTO); this.wanted = true;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.setStatus('off', 'That address is not a valid ws:// URL'); return; }
    this.ws = ws;
    this.setStatus('connecting', 'Connecting to the bridge…');
    ws.onopen = () => { this.retry = 0; this.setStatus('bridge', 'Bridge connected · waiting for the R10'); this.setPlayer({}); };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'status') { this.setStatus(msg.device ? 'ready' : 'bridge', msg.device ? `R10 ready · ${msg.device}` : 'Bridge connected · waiting for the R10'); return; }
      const shot = bridgeShot(msg);
      if (shot) this.emitShot(shot);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.wanted || this.source !== 'bridge') return;
      this.setStatus('off', 'Bridge not reachable · retrying');
      const wait = Math.min(15000, 1000 * 2 ** this.retry++);
      clearTimeout(this.timer); this.timer = setTimeout(() => this.wanted && this.source === 'bridge' && this.connect(this.url), wait);
    };
  }

  // ── Bluetooth ──
  // choose = true from a tap (opens the browser's chooser); false to reconnect a remembered R10 quietly;
  // 'all' from a tap lists every device nearby (for an R10 the chooser's name filter didn't show).
  connectBluetooth(choose = true) {
    if (!this.bluetooth) { this.setStatus('off', 'This browser has no Bluetooth access'); return Promise.resolve(false); }
    this.disconnect(true);
    this.source = 'ble'; store(false, 'ble', SRC); this.wanted = true;
    let p;
    try { p = choose ? this.ble.choose(choose === 'all') : this.ble.reconnect(); }   // choose() calls requestDevice before any await
    catch (e) { p = Promise.reject(e); }
    this.setStatus('connecting', choose === 'all' ? 'Pick the R10 from the list…' : choose ? 'Choose your R10…' : 'Reconnecting to the R10…');
    return p.then(ok => {
      if (ok === false) { this.wanted = false; this.needsTap = true; this.setStatus('off', 'Tap Connect R10 to link the R10 on this page'); return false; }
      store(false, '1', AUTO); this.notListed = false;
      return true;
    }, e => {
      if (choose && e && e.name === 'NotFoundError') this.notListed = true;
      this.ble.wanted = false; this.ble.teardown();
      this.onBle('error', { message: explainBleError(e) });
      return false;
    });
  }
  onBle(type, d) {
    if (this.source !== 'ble') return;
    switch (type) {
      case 'progress': this.setStatus('connecting', d.text); break;
      case 'ready': this.setStatus('ready', 'R10 ready · Bluetooth'); break;
      case 'shot': this.emitShot(d); break;
      case 'fault': this.detail = FAULT_TEXT[d.cause] || FAULT_TEXT.unspecified; this.dispatchEvent(new CustomEvent('fault', { detail: d })); this.dispatchEvent(new CustomEvent('status', { detail: { status: this.status, detail: this.detail } })); break;
      case 'state': if (d.name === 'armed' && this.status !== 'ready') this.setStatus('ready', 'R10 ready · Bluetooth'); break;
      case 'dropped': this.setStatus('connecting', 'R10 dropped · reconnecting…'); break;
      case 'error': this.wanted = false; this.setStatus('off', d.message); break;
      case 'closed': break;
      default:
    }
  }

  // The R10-to-ball distance (feet in the game, yards on the wire); null clears it.
  setTeeDistance(ft) {
    this.teeFt = isFinite(ft) && ft > 0 ? Math.round(ft * 10) / 10 : null;
    store(false, this.teeFt === null ? '' : String(this.teeFt), TEE);
    this.ble.setEnvironment(this.environment());
  }
  environment() { return this.teeFt ? { teeDistanceYd: this.teeFt / 3 } : null; }

  disconnect(quiet) {
    this.wanted = false; clearTimeout(this.timer);
    if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* already closed */ } }
    if (this.ble.device || this.ble.wanted) this.ble.disconnect();
    if (!quiet) { store(false, '0', AUTO); this.setStatus('off', 'Not connected'); }
  }
  // Called on page load: come back the way the player was connected last time.
  resume() {
    if (store(true, null, AUTO) !== '1') return;
    if (this.source === 'ble') this.connectBluetooth(false);
    else this.connect(this.url);
  }
  setPlayer(p) {
    Object.assign(this.player, p);
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'player', club: CLUB_CODES[this.player.club] || this.player.club, handed: this.player.handed }));
  }
  get live() { return this.status === 'ready' || this.status === 'bridge'; }
}

export const launchMonitor = new LaunchMonitor();

// Status pill + connection popover: `dot` and `text` show the state, `button` opens the popover.
export function mountLaunchMonitorUI({ dot, text, button, compact = false }) {
  const lm = launchMonitor;
  const pop = document.createElement('div');
  pop.className = 'lm-pop glass'; pop.hidden = true;
  const bleNote = lm.bluetooth
    ? 'Close the Garmin Golf app first: the R10 talks to one device at a time. If it won\'t connect, pair the R10 in your Bluetooth settings and try again.'
    : 'This browser can\'t use Bluetooth. On iPhone, open VibeGolf in the Bluefy browser; on a PC or Android, use Chrome or Edge. Or use the bridge.';
  pop.innerHTML = `
    <div class="lm-head"><b>Launch monitor</b><button class="lm-x" aria-label="Close">×</button></div>
    <div class="lm-seg" role="tablist"><button role="tab" data-src="ble">Bluetooth</button><button role="tab" data-src="bridge">Bridge</button></div>
    <div class="lm-pane" data-pane="ble">
      <p class="lm-note">${bleNote}</p>
      <div class="lm-row lm-row-ble"><button class="lm-go" id="lmBle"></button>
        <label class="lm-tee" title="How far the R10 sits behind the ball. Leave blank to use the R10's own setting.">R10 to ball <input id="lmTee" type="number" inputmode="decimal" min="3" max="15" step="0.5" placeholder="–"> ft</label></div>
      <p class="lm-note lm-miss" id="lmMiss" hidden>R10 not in the list? Swipe the Garmin Golf app closed (it grabs the R10 even in the background), switch the R10 off and on, and try again. <button class="lm-all" id="lmAll">Show all devices</button></p>
    </div>
    <div class="lm-pane" data-pane="bridge">
      <p class="lm-note">Start the bridge on this computer, point OpenLaunch Connect (or any GSPro connector) at it, then connect here. Setup steps are in the README.</p>
      <label class="lm-lbl" for="lmUrl">Bridge address</label>
      <div class="lm-row"><input id="lmUrl" type="text" spellcheck="false" autocomplete="off"><button class="lm-go" id="lmGo"></button></div>
    </div>
    <p class="lm-state" id="lmState"></p>
    <div class="lm-dbg" id="lmDbg" hidden><span>Capture · <b id="lmDbgN">0</b></span><button id="lmDbgSave">Save</button><button id="lmDbgCopy">Copy</button><button id="lmDbgClear">Clear</button></div>`;
  document.body.appendChild(pop);
  const $ = s => pop.querySelector(s);
  const url = $('#lmUrl'), go = $('#lmGo'), st = $('#lmState'), ble = $('#lmBle'), tee = $('#lmTee'), miss = $('#lmMiss');
  let view = lm.source;
  const render = () => {
    const s = lm.status, ready = s === 'ready';
    dot.className = 'dot ' + (ready ? 'live' : s === 'bridge' || s === 'connecting' ? 'wait' : '');
    text.textContent = compact
      ? (ready ? 'R10 live' : lm.needsTap ? 'R10 · tap' : s === 'off' ? 'R10 off' : 'R10 …')
      : ready ? 'R10 live' : s === 'bridge' ? 'Bridge on · waiting for R10' : s === 'connecting' ? 'Connecting…' : lm.needsTap ? 'R10 · tap to connect' : 'R10 offline · simulated swings';
    for (const b of pop.querySelectorAll('.lm-seg button')) b.setAttribute('aria-selected', String(b.dataset.src === view));
    for (const p of pop.querySelectorAll('.lm-pane')) p.hidden = p.dataset.pane !== view;
    const on = src => lm.wanted && lm.source === src && s !== 'off';
    go.textContent = on('bridge') ? 'Disconnect' : 'Connect';
    ble.textContent = on('ble') ? 'Disconnect' : 'Connect R10';
    ble.disabled = !lm.bluetooth;
    miss.hidden = !(lm.bluetooth && lm.notListed && !on('ble'));
    st.textContent = lm.detail;
  };
  url.value = lm.url;
  tee.value = lm.teeFt ?? '';
  button.addEventListener('click', () => { pop.hidden = !pop.hidden; if (!pop.hidden) view = lm.source; render(); });
  $('.lm-x').onclick = () => { pop.hidden = true; };
  for (const b of pop.querySelectorAll('.lm-seg button')) b.onclick = () => { view = b.dataset.src; render(); };
  go.onclick = () => { if (lm.wanted && lm.source === 'bridge' && lm.status !== 'off') lm.disconnect(); else lm.connect(url.value.trim() || DEFAULT_URL); render(); };
  ble.onclick = () => { if (lm.wanted && lm.source === 'ble' && lm.status !== 'off') lm.disconnect(); else lm.connectBluetooth(true); render(); };
  $('#lmAll').onclick = () => { lm.connectBluetooth('all'); render(); };
  tee.addEventListener('change', () => { const v = parseFloat(tee.value); lm.setTeeDistance(v); tee.value = lm.teeFt ?? ''; });
  url.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); e.stopPropagation(); });
  tee.addEventListener('keydown', e => { if (e.key === 'Enter') tee.blur(); e.stopPropagation(); });
  lm.addEventListener('status', render);
  lm.addEventListener('fault', render);
  if (r10Capture.enabled) {
    const dbg = $('#lmDbg'), n = $('#lmDbgN');
    dbg.hidden = false;
    const count = () => { n.textContent = r10Capture.count; };
    r10Capture.addEventListener('change', count); count();
    $('#lmDbgSave').onclick = () => r10Capture.save();
    $('#lmDbgCopy').onclick = () => { navigator.clipboard?.writeText(r10Capture.text()).then(() => { $('#lmDbgCopy').textContent = 'Copied'; }, () => { $('#lmDbgCopy').textContent = 'No access'; }); };
    $('#lmDbgClear').onclick = () => r10Capture.clear();
  }
  render();
  // Hand the R10 back when leaving the page, so the next page can connect at once; come back from the
  // back/forward cache the same way we came in.
  addEventListener('pagehide', () => { if (lm.source === 'ble') lm.ble.release(); });
  addEventListener('pageshow', e => { if (e.persisted) lm.resume(); });
  // reconnect automatically if the player was connected last time
  lm.resume();
  return { render };
}
