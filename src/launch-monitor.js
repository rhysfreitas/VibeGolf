// Live launch-monitor link, shared by every mode.
//
// The browser can't talk to the R10 or open raw TCP, so a small local bridge (bridge/bridge.js)
// accepts GSPro Open Connect shots on TCP 921 — the protocol OpenLaunch Connect, gsp-r10-adapter
// and the Garmin E6 relays already speak — and relays them here over a WebSocket.
//
// Usage:
//   import { launchMonitor, mountLaunchMonitorUI } from './launch-monitor.js';
//   launchMonitor.addEventListener('shot', e => fire(e.detail));   // detail = BallData (mph, deg, rpm)
//   launchMonitor.setPlayer({ club: '7i' });                        // tells the adapter which club is in hand

const KEY = 'aerie.lm.url';
const DEFAULT_URL = 'ws://localhost:8921';

// GSPro club codes, used when we report the selected club back to the adapter.
const CLUB_CODES = { DR: 'DR', '3W': 'W3', HY: 'H4', '5i': 'I5', '7i': 'I7', '9i': 'I9', PW: 'PW', SW: 'SW', PT: 'PT' };

function store(get, val, key = KEY) {
  try { if (get) return localStorage.getItem(key); localStorage.setItem(key, val); } catch (e) { /* storage blocked */ }
  return null;
}
const AUTO = 'aerie.lm.auto';

// Accepts a GSPro Open Connect message, a bare BallData object, or { type: 'shot', ball: {...} }.
export function parseShot(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.type === 'shot' && msg.ball) msg = { BallData: msg.ball };
  const opts = msg.ShotDataOptions;
  if (opts && (opts.IsHeartBeat || opts.ContainsBallData === false)) return null;
  const b = msg.BallData || (msg.Speed !== undefined ? msg : null);
  if (!b || !(+b.Speed > 0)) return null;
  const back = +b.BackSpin || 0, side = +b.SideSpin || 0;
  let total = +b.TotalSpin || Math.hypot(back, side);
  let axis = b.SpinAxis !== undefined ? +b.SpinAxis : (back ? Math.atan2(side, back) * 180 / Math.PI : 0);
  return { Speed: +b.Speed, VLA: +b.VLA || 0, HLA: +b.HLA || 0, TotalSpin: total, SpinAxis: axis };
}

class LaunchMonitor extends EventTarget {
  constructor() {
    super();
    this.url = store(true) || DEFAULT_URL;
    this.status = 'off';          // off | connecting | bridge | ready
    this.detail = 'Not connected';
    this.ws = null;
    this.retry = 0;
    this.wanted = false;
    this.player = { club: 'DR', handed: 'RH' };
  }
  setStatus(status, detail) { this.status = status; this.detail = detail; this.dispatchEvent(new CustomEvent('status', { detail: { status, detail } })); }
  connect(url = this.url) {
    this.disconnect(true);
    this.url = url; store(false, url); store(false, '1', AUTO); this.wanted = true;
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.setStatus('off', 'That address is not a valid ws:// URL'); return; }
    this.ws = ws;
    this.setStatus('connecting', 'Connecting to the bridge…');
    ws.onopen = () => { this.retry = 0; this.setStatus('bridge', 'Bridge connected · waiting for the R10'); this.setPlayer({}); };
    ws.onmessage = ev => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === 'status') { this.setStatus(msg.device ? 'ready' : 'bridge', msg.device ? `R10 ready · ${msg.device}` : 'Bridge connected · waiting for the R10'); return; }
      const shot = parseShot(msg);
      if (shot) { if (this.status !== 'ready') this.setStatus('ready', 'R10 ready'); this.dispatchEvent(new CustomEvent('shot', { detail: shot })); }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.wanted) return;
      this.setStatus('off', 'Bridge not reachable · retrying');
      const wait = Math.min(15000, 1000 * 2 ** this.retry++);
      clearTimeout(this.timer); this.timer = setTimeout(() => this.wanted && this.connect(this.url), wait);
    };
  }
  disconnect(quiet) {
    this.wanted = false; clearTimeout(this.timer);
    if (this.ws) { const w = this.ws; this.ws = null; try { w.close(); } catch (e) { /* already closed */ } }
    if (!quiet) { store(false, '0', AUTO); this.setStatus('off', 'Not connected'); }
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
  const pop = document.createElement('div');
  pop.className = 'lm-pop glass'; pop.hidden = true;
  pop.innerHTML = `
    <div class="lm-head"><b>Launch monitor</b><button class="lm-x" aria-label="Close">×</button></div>
    <p class="lm-note">Start the bridge on this computer, point OpenLaunch Connect (or any GSPro connector) at it, then connect here. Setup steps are in the README.</p>
    <label class="lm-lbl" for="lmUrl">Bridge address</label>
    <div class="lm-row"><input id="lmUrl" type="text" spellcheck="false" autocomplete="off"><button class="lm-go" id="lmGo"></button></div>
    <p class="lm-state" id="lmState"></p>`;
  document.body.appendChild(pop);
  const url = pop.querySelector('#lmUrl'), go = pop.querySelector('#lmGo'), st = pop.querySelector('#lmState');
  const render = () => {
    const s = launchMonitor.status;
    dot.className = 'dot ' + (s === 'ready' ? 'live' : s === 'bridge' || s === 'connecting' ? 'wait' : '');
    text.textContent = compact ? (s === 'ready' ? 'R10 live' : s === 'off' ? 'R10 off' : 'R10 …')
      : s === 'ready' ? 'R10 live' : s === 'bridge' ? 'Bridge on · waiting for R10' : s === 'connecting' ? 'Connecting…' : 'R10 offline · simulated swings';
    go.textContent = launchMonitor.wanted ? 'Disconnect' : 'Connect';
    st.textContent = launchMonitor.detail;
  };
  url.value = launchMonitor.url;
  button.addEventListener('click', () => { pop.hidden = !pop.hidden; render(); });
  pop.querySelector('.lm-x').onclick = () => { pop.hidden = true; };
  go.onclick = () => { if (launchMonitor.wanted) launchMonitor.disconnect(); else launchMonitor.connect(url.value.trim() || DEFAULT_URL); render(); };
  url.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); e.stopPropagation(); });
  launchMonitor.addEventListener('status', render);
  render();
  // reconnect automatically if the player was connected last time
  if (store(true, null, AUTO) === '1') launchMonitor.connect(launchMonitor.url);
  return { render };
}
