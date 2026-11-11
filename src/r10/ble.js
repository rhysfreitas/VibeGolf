// Thin Web Bluetooth transport for the R10. Everything protocol lives in ./protocol.js; this file only
// finds the device, opens GATT, moves bytes and reconnects. Keep it thin: a native wrapper (Capacitor) can
// swap in a native BLE plugin by writing another ~100-line file with the same surface.
//
//   const link = new R10Link({ emit(type, detail), log(entry) });
//   link.choose()      from a tap: the browser's device chooser, then connect
//   link.reconnect()   no tap needed: a device chosen earlier on this page, or one getDevices() remembers
//   link.disconnect()  stop and don't come back
//   link.setEnvironment({ teeDistanceYd })
// Events: progress {text}, ready, shot (game shape), fault, state, dropped, error {message}, closed.
import { R10Session, SERVICE, CHAR_RX, CHAR_TX, NAME_PREFIX } from './protocol.js';

export const hasBluetooth = () => typeof navigator !== 'undefined' && !!(navigator.bluetooth && navigator.bluetooth.requestDevice);

const READY_TIMEOUT = 15000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const withTimeout = (p, ms, msg) => Promise.race([p, sleep(ms).then(() => { throw Object.assign(new Error(msg), { name: 'TimeoutError' }); })]);

// Plain words for what went wrong.
export function explainBleError(e) {
  const m = `${e && e.name} ${e && e.message}`.toLowerCase();
  if (e && e.name === 'NotFoundError') return m.includes('cancel') || m.includes('chosen') ? 'No R10 chosen' : 'No R10 found. Is it switched on and nearby?';
  if (e && e.name === 'SecurityError') return 'Tap Connect R10 to pick your R10';
  if (m.includes('auth') || m.includes('encrypt') || m.includes('pair') || m.includes('bond')) return 'The R10 needs pairing. Pair it in your Bluetooth settings, then tap Connect R10 again';
  if (e && e.name === 'TimeoutError') return e.message;
  if (m.includes('unsupported') || m.includes('not supported')) return 'This browser can\'t do that over Bluetooth';
  return 'Couldn\'t reach the R10. Is it on, and is the Garmin Golf app closed?';
}

export class R10Link {
  constructor({ emit, log }) {
    this.emit = emit; this.log = log || (() => {});
    this.device = null; this.session = null; this.wanted = false; this.ready = false;
    this.recent = new Map();                      // shot numbers seen, kept across reconnects (resends)
    this.env = null; this.retry = 0; this.q = Promise.resolve(); this.gen = 0;
    this.onDrop = this.onDrop.bind(this);
  }

  // Must be called straight from a tap: no await before requestDevice.
  choose() {
    this.wanted = true;
    const req = navigator.bluetooth.requestDevice({ filters: [{ namePrefix: NAME_PREFIX }], optionalServices: [SERVICE] });
    this.emit('progress', { text: 'Choose your R10…' });
    return req.then(d => this.use(d)).then(() => this.open());
  }

  async reconnect() {
    this.wanted = true;
    if (!this.device && navigator.bluetooth.getDevices) {
      try { const ds = await navigator.bluetooth.getDevices(); const d = ds.find(x => (x.name || '').startsWith(NAME_PREFIX)) || (ds.length === 1 ? ds[0] : null); if (d) this.use(d); } catch (e) { /* not allowed here */ }
    }
    if (!this.device) { this.wanted = false; return false; }
    await this.open();
    return true;
  }

  use(device) {
    if (this.device && this.device !== device) this.device.removeEventListener('gattserverdisconnected', this.onDrop);
    this.device = device;
    device.removeEventListener('gattserverdisconnected', this.onDrop);
    device.addEventListener('gattserverdisconnected', this.onDrop);
    this.log({ dir: 'ble', what: 'device', name: device.name || '' });
  }

  async open() {
    const gen = ++this.gen;
    this.ready = false;
    this.emit('progress', { text: 'Connecting to the R10…' });
    const server = await withTimeout(this.device.gatt.connect(), 15000, 'The R10 didn\'t answer. Is it on and in range?');
    if (gen !== this.gen) return;
    this.emit('progress', { text: 'R10 connected · setting up…' });
    const svc = await server.getPrimaryService(SERVICE);
    const rx = await svc.getCharacteristic(CHAR_RX), tx = await svc.getCharacteristic(CHAR_TX);
    if (gen !== this.gen) return;
    const session = this.session = new R10Session({
      send: c => this.write(tx, c, false),
      register: b => this.write(rx, b, true),
      emit: (t, d) => { if (this.session === session) this.onSession(t, d); },
      log: e => this.log(e),
    }, { recent: this.recent });
    session.setEnvironment(this.env);
    rx.addEventListener('characteristicvaluechanged', ev => {
      if (this.session !== session) return;
      const v = ev.target.value;
      try { session.receive(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); } catch (e) { this.log({ dir: 'rx', what: 'receive-error', error: e.message }); }
    });
    await rx.startNotifications();
    this.log({ dir: 'ble', what: 'notifications-on' });
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (this.session !== session || this.ready) return;
      this.log({ dir: 'ble', what: 'watchdog', phase: session.phase });
      this.fail(new Error(session.phase === 'registering'
        ? 'The R10 connected but won\'t talk. Close the Garmin Golf app (the R10 takes one connection), then tap Connect R10'
        : 'The R10 stopped mid setup. Tap Connect R10 to try again'));
    }, READY_TIMEOUT);
    await session.start();
  }

  // GATT allows one operation at a time, so writes queue. Data goes without response; REGISTER with.
  write(ch, bytes, withResponse) {
    this.q = this.q.then(() => {
      if (withResponse) return ch.writeValueWithResponse ? ch.writeValueWithResponse(bytes) : ch.writeValue(bytes);
      return ch.writeValueWithoutResponse ? ch.writeValueWithoutResponse(bytes) : ch.writeValue(bytes);
    }).catch(e => this.log({ dir: 'tx', what: 'write-error', error: e.message }));
    return this.q;
  }

  onSession(type, d) {
    if (type === 'ready') { this.ready = true; this.retry = 0; clearTimeout(this.watchdog); }
    if (type === 'handshake') this.emit('progress', { text: 'R10 connected · waking the radar…' });
    if (type === 'error') { this.fail(new Error(d.message)); return; }
    this.emit(type, d);
  }

  fail(e) {
    const message = explainBleError(e);
    this.log({ dir: 'ble', what: 'error', name: e && e.name, error: e && e.message });
    this.wanted = false; this.teardown();
    this.emit('error', { message });
  }

  onDrop() {
    this.log({ dir: 'ble', what: 'disconnected' });
    this.session = null; this.ready = false; clearTimeout(this.watchdog);
    if (!this.wanted) return;
    this.emit('dropped', {});
    const wait = Math.min(15000, 1000 * 2 ** this.retry++);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (this.wanted) this.open().catch(e => { this.log({ dir: 'ble', what: 'reconnect-failed', error: e.message }); if (this.wanted) this.onDrop(); }); }, wait);
  }

  setEnvironment(env) { this.env = env; if (this.session) this.session.setEnvironment(env); }

  teardown() {
    this.gen++; clearTimeout(this.timer); clearTimeout(this.watchdog);
    this.session = null; this.ready = false;
    try { if (this.device && this.device.gatt.connected) this.device.gatt.disconnect(); } catch (e) { /* already gone */ }
  }

  // Stop for good (the player pressed Disconnect, or picked the bridge).
  disconnect() { this.wanted = false; this.teardown(); this.emit('closed', {}); }

  // Free the R10 for the next page (pagehide). The caller remembers whether to come back.
  release() { this.wanted = false; this.teardown(); }
}

// ── Raw capture for debugging (?r10debug=1) ──
// Frames and decoded messages, both ways. Messages carrying the device's identity (5024 device info, FIT,
// file and auth frames) are logged by type and length only, and raw chunks only once the session is up.
const CAP_KEY = 'vibegolf.r10capture', CAP_MAX = 1500;
export function createCapture(enabled) {
  let items = [];
  if (enabled) { try { items = JSON.parse(localStorage.getItem(CAP_KEY) || '[]'); } catch (e) { items = []; } }
  let dirty = false, timer = null;
  const flush = () => { timer = null; if (!dirty) return; dirty = false; try { localStorage.setItem(CAP_KEY, JSON.stringify(items)); } catch (e) { /* full */ } };
  const page = typeof location !== 'undefined' ? location.pathname.split('/').pop() || 'index.html' : '';
  const cap = new EventTarget();
  Object.assign(cap, {
    enabled,
    add(entry) {
      if (!enabled) return;
      items.push({ at: new Date().toISOString(), page, ...entry });
      if (items.length > CAP_MAX) items.splice(0, items.length - CAP_MAX);
      try { console.debug('[r10]', entry); } catch (e) { /* no console */ }
      dirty = true; if (!timer) timer = setTimeout(flush, 1500);
      cap.dispatchEvent(new Event('change'));
    },
    text() {
      return JSON.stringify({ app: 'VibeGolf R10 capture', made: new Date().toISOString(), agent: typeof navigator !== 'undefined' ? navigator.userAgent : '', entries: items }, null, 1);
    },
    save() {
      const blob = new Blob([cap.text()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `r10-capture-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
    clear() { items = []; dirty = true; flush(); cap.dispatchEvent(new Event('change')); },
  });
  Object.defineProperty(cap, 'count', { get: () => items.length });
  return cap;
}
