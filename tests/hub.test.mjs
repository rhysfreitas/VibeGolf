// The hub's pass-through (src/launch-monitor.js HubLink): a page inside app.html uses the hub's link.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HubLink } from '../src/launch-monitor.js';

function fakeReal() {
  const r = new EventTarget();
  Object.assign(r, {
    source: 'ble', status: 'ready', detail: 'R10 ready · Bluetooth', needsTap: false, notListed: false, bluetooth: true,
    url: 'ws://localhost:8921', teeFt: 7, wanted: true, player: { club: 'DR', handed: 'RH' }, live: true, calls: [],
    connect(u) { this.calls.push(['connect', u]); }, connectBluetooth(c) { this.calls.push(['ble', c]); return Promise.resolve(true); },
    disconnect(q) { this.calls.push(['disconnect', q]); }, setTeeDistance(f) { this.calls.push(['tee', f]); },
    environment() { return { teeDistanceYd: 7 / 3 }; }, setPlayer(p) { this.calls.push(['player', p]); }, resume() { this.calls.push(['resume']); },
  });
  r.emit = (type, detail) => r.dispatchEvent(new CustomEvent(type, { detail }));
  return r;
}

test('a page inside the hub gets the hub\'s shots, status and faults, as copies', () => {
  const real = fakeReal(), win = new EventTarget(), lm = new HubLink(real, win);
  const got = [];
  for (const t of ['shot', 'status', 'fault']) lm.addEventListener(t, e => got.push([t, e.detail]));
  const shot = { Speed: 120, VLA: 14, HLA: -1, TotalSpin: 6000, SpinAxis: 3, Meta: { source: 'ble', shotNumber: 4 } };
  real.emit('shot', shot); real.emit('status', { status: 'ready', detail: 'R10 ready' }); real.emit('fault', { cause: 'not-level' });
  assert.deepEqual(got.map(g => g[0]), ['shot', 'status', 'fault']);
  assert.deepEqual(got[0][1], shot);
  assert.notEqual(got[0][1], shot, 'a copy, not the hub\'s object');
  assert.equal(lm.hubbed, true);
  assert.equal(lm.status, 'ready'); assert.equal(lm.live, true); assert.equal(lm.teeFt, 7); assert.equal(lm.source, 'ble');
});

test('the page\'s listeners leave the hub when it goes, and come back from the bfcache', () => {
  const real = fakeReal(), win = new EventTarget(), lm = new HubLink(real, win);
  let n = 0; lm.addEventListener('shot', () => n++);
  real.emit('shot', { Speed: 100 }); assert.equal(n, 1);
  win.dispatchEvent(new Event('pagehide'));
  real.emit('shot', { Speed: 100 }); assert.equal(n, 1, 'no shot reaches a page that has gone');
  const back = new Event('pageshow'); back.persisted = true; win.dispatchEvent(back);
  real.emit('shot', { Speed: 100 }); assert.equal(n, 2);
  lm.attach(); real.emit('shot', { Speed: 100 }); assert.equal(n, 3, 'attaching twice doesn\'t double shots');
});

test('the popover\'s actions go to the hub\'s link; resume is the hub\'s own', async () => {
  const real = fakeReal(), lm = new HubLink(real, new EventTarget());
  assert.equal(await lm.connectBluetooth(true), true);
  lm.connect('ws://x:1'); lm.disconnect(); lm.setTeeDistance(8); lm.setPlayer({ club: '7i' }); lm.resume();
  assert.deepEqual(real.calls, [['ble', true], ['connect', 'ws://x:1'], ['disconnect', undefined], ['tee', 8], ['player', { club: '7i' }]]);
  assert.deepEqual(lm.environment(), { teeDistanceYd: 7 / 3 });
});

test('outside a hub the page keeps its own link', async () => {
  const { launchMonitor } = await import('../src/launch-monitor.js');
  assert.equal(launchMonitor.hubbed, undefined);
  assert.equal(typeof launchMonitor.connectBluetooth, 'function');
});
