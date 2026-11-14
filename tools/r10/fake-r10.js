// Injected before page scripts (tools/r10/check.mjs): a fake navigator.bluetooth whose "R10" speaks the real protocol back,
// so the transport, the popover and live shots can be checked headlessly. __fakeR10.shot(n) sends a shot, .drop() a link loss.
(() => {
  if (window.__noBluetooth) return;
  const P = import('/src/r10/protocol.js');
  const F = window.__fakeR10 = { remember: !!window.__rememberFromStart, writes: 0, acks: [], env: [], connects: 0, events: [] };
  const HANDLE = 4;
  const SHOT = [0xf2, 0x01, 0x53, 0x1a, 0x51, 0x08, 0x08, 0xca, 0x3e, 0x4c, 0x12, 0x4a, 0x08, 0x2a, 0x10, 0x01,
    0x1a, 0x1d, 0x0d, 0x00, 0x00, 0x48, 0x41, 0x15, 0x9a, 0x99, 0x99, 0xbf, 0x1d, 0x00, 0x00, 0x86,
    0x42, 0x25, 0x00, 0x00, 0xa0, 0x40, 0x2d, 0x00, 0x00, 0x2f, 0x45, 0x30, 0x00, 0x38, 0x01, 0x22,
    0x14, 0x0d, 0x00, 0x00, 0x30, 0x42, 0x15, 0x00, 0x00, 0xc0, 0x3f, 0x1d, 0x00, 0x00, 0x00, 0xc0,
    0x25, 0x00, 0x00, 0x60, 0xc0, 0x2a, 0x0f, 0x08, 0xe8, 0x07, 0x10, 0xdc, 0x0b, 0x18, 0x88, 0x0e,
    0x20, 0x98, 0x11, 0x28, 0xc4, 0x13];
  const state = s => [0xf2, 0x01, 0x0b, 0x1a, 0x09, 0x08, 0x08, 0xca, 0x3e, 0x04, 0x0a, 0x02, 0x08, s];
  const rx = new EventTarget(), tx = {};
  let stream = null, connected = false;
  const device = new EventTarget();
  device.name = 'Approach R10'; device.id = 'fake';
  const later = (fn, ms = 20) => setTimeout(fn, ms);
  async function notify(bytes) { rx.value = new DataView(new Uint8Array(bytes).buffer); rx.dispatchEvent(new Event('characteristicvaluechanged')); }
  async function sendFrame(frame) { const p = await P; for (const c of p.chunkWithHandle(p.wrapCobs(frame), HANDLE)) await notify(c); }
  async function sendPb(env, type = 5043) { const p = await P; const n = env.length; await sendFrame(p.buildFrame(type, [7, 0, 0, 0, 0, 0, n, 0, 0, 0, n, 0, 0, 0, ...env])); }
  rx.startNotifications = async () => rx;
  rx.writeValueWithResponse = async b => {
    b = new Uint8Array(b.buffer ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b);
    if (b.length === 13 && b[1] === 0) {
      const p = await P; stream = new p.FrameStream();
      later(() => notify([0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, HANDLE, 0, 0]));
      const s = n => [n.length, ...new TextEncoder().encode(n)];
      later(() => sendFrame(p.buildFrame(5024, [150, 0, 0x26, 0x0E, 1, 2, 3, 4, 10, 0, 0, 2, ...s('Approach R10'), ...s('R10'), ...s('R10')])), 60);
    }
  };
  tx.writeValueWithoutResponse = async c => {
    const p = await P; F.writes++;
    c = new Uint8Array(c);
    if (c[0] !== HANDLE) { F.events.push('bad handle'); return; }
    for (const r of stream.push(c.subarray(1))) {
      if (r.error) { F.events.push('host frame error ' + r.error); continue; }
      const f = r.frame;
      if (f.type === 5000) {
        const orig = f.payload[0] | (f.payload[1] << 8); F.acks.push(orig);
        if (orig === 5024) later(() => sendFrame(p.buildFrame(5050, [4, 0xff, 0xff, 0xff, 0xff])));
      } else if (f.type === 5050) { later(() => sendFrame(p.buildAck(5050, 0))); F.events.push('host config'); }
      else if (f.type === 5043) {
        const pb = [...p.parseFragment(f.payload).data].join(',');
        if (pb === [...p.subscribeEnvelope()].join(',')) later(() => sendPb([0xf2, 0x01, 0x0a, 0x12, 0x08, 0x0a, 0x06, 0x08, 0x00, 0x12, 0x02, 0x08, 0x08], 5044));
        else if (pb === [...p.wakeEnvelope()].join(',')) { later(() => sendPb([0xb2, 0x02, 0x04, 0x22, 0x02, 0x08, 0], 5044)); later(() => sendPb(state(1)), 80); later(() => sendPb(state(2)), 160); }
        else { F.env.push(pb); later(() => sendPb([0xb2, 0x02, 0x04, 0x62, 0x02, 0x08, 0x01], 5044)); }
      }
    }
  };
  const server = { getPrimaryService: async () => ({ getCharacteristic: async u => (u.startsWith('6a4e2810') ? rx : tx) }) };
  device.gatt = {
    get connected() { return connected; },
    connect: async () => { connected = true; F.connects++; return server; },
    disconnect: () => { if (!connected) return; connected = false; later(() => device.dispatchEvent(new Event('gattserverdisconnected')), 5); },
  };
  F.shot = n => { const s = SHOT.slice(); s[13] = n; return sendPb(s); };
  F.drop = () => { connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); };
  const bt = { requestDevice: async o => { F.requests = (F.requests || []).concat([o]); if (window.__hideR10 && !o.acceptAllDevices) throw new DOMException('User cancelled the requestDevice() chooser.', 'NotFoundError'); return device; }, getDevices: window.__noGetDevices ? undefined : async () => (F.remember ? [device] : []) };
  Object.defineProperty(Navigator.prototype, 'bluetooth', { get: () => bt, configurable: true });
})();
