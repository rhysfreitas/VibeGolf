// The session recorder: live shots kept per session, with trust, results, coach notes and feel tags.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder, STORE_KEY, GAP_MS, MAX_SHOTS } from '../src/recorder.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
const shot = (extra = {}) => ({ Speed: 120, VLA: 16.3, HLA: 0.5, TotalSpin: 7097, SpinAxis: 1,
  Club: { Speed: 90, Path: 0.5, FaceToTarget: 0.9, AngleOfAttack: -4.3 }, Meta: { source: 'ble', shotNumber: 7, spinSource: 'estimated', marking: 'plain', timing: null }, ...extra });

test('live shots from the launch monitor are recorded with the club, the mode and the trust checks', () => {
  let t = 1e12; const store = mem(), rec = createRecorder({ storage: store, now: () => t });
  const lm = new EventTarget(); let club = '7i', mode = 'coach';
  rec.attach(lm, { mode: () => mode, club: () => club });
  const s = shot(); lm.dispatchEvent(new CustomEvent('shot', { detail: s }));
  const r = rec.get(rec.idOf(s));
  assert.equal(r.club, '7i'); assert.equal(r.mode, 'coach'); assert.equal(r.practice, true); assert.equal(r.live, true);
  assert.equal(r.ball.Speed, 120); assert.equal(r.clubData.Path, 0.5); assert.equal(r.meta.shotNumber, 7);
  assert.deepEqual(r.trust, { club: null, spin: 'use', spinWhy: [] });
  // the flight and the coach's read join the same record
  rec.result(s, { carry: 162.4, total: 171 }); rec.note(s, { coach: [{ type: 'read', id: 'flip' }] });
  assert.equal(rec.get(r.id).result.carry, 162.4); assert.equal(rec.get(r.id).coach[0].id, 'flip');
  // and it's saved
  assert.equal(JSON.parse(store.getItem(STORE_KEY)).sessions[0].shots.length, 1);
  // a placeholder club shows in the trust result
  const bad = shot({ Club: { Speed: 1, Path: 1, FaceToTarget: 1, AngleOfAttack: 1 } }); t += 1000;
  lm.dispatchEvent(new CustomEvent('shot', { detail: bad }));
  assert.equal(rec.get(rec.idOf(bad)).trust.club, 'same');
});

test('feel tags are optional and can be cleared', () => {
  const rec = createRecorder({ storage: mem(), now: () => 1e12 }), s = shot(), id = rec.capture(s, { club: '7i' });
  assert.equal(rec.get(id).feel, null);
  rec.tag(id, 'fat'); assert.equal(rec.get(id).feel, 'fat');
  rec.tag(s, 'nonsense'); assert.equal(rec.get(id).feel, null);
});

test('sessions break on a new mode or after a long gap, and the store survives a reload', () => {
  let t = 1e12; const store = mem(), rec = createRecorder({ storage: store, now: () => t }); let mode = 'range';
  rec.setContext({ mode: () => mode, club: () => 'DR' });
  rec.capture(shot()); t += 60e3; rec.capture(shot());
  mode = 'course'; t += 60e3; rec.capture(shot());
  t += GAP_MS + 1; rec.capture(shot());
  assert.deepEqual(rec.sessions.map(s => [s.mode, s.shots.length]), [['range', 2], ['course', 1], ['course', 1]]);
  assert.equal(rec.sessions[1].shots[0].practice, false, 'course shots do not feed your numbers');
  // a new page starts a new session on top of what was saved
  const again = createRecorder({ storage: store, now: () => t + 1000 }); again.setContext({ mode: 'course', club: () => 'DR' });
  again.capture(shot());
  assert.equal(again.sessions.length, 4);
});

test('simulated shots are only kept when asked for, and the oldest sessions go past the cap', () => {
  let t = 1e12; const store = mem();
  const rec = createRecorder({ storage: store, now: () => t });
  assert.equal(rec.capture(shot(), { live: false }), null);
  const sim = createRecorder({ storage: mem(), now: () => t, recordSim: true });
  assert.ok(sim.get(sim.capture(shot(), { live: false })).live === false);
  for (let i = 0; i < MAX_SHOTS + 10; i++) { t += i % 500 === 0 ? GAP_MS + 1 : 1000; rec.capture(shot(), { club: '7i' }); }
  assert.ok(rec.shots.length <= MAX_SHOTS);
  const out = JSON.parse(rec.exportJSON());
  assert.equal(out.app, 'VibeGolf'); assert.equal(out.kind, 'sessions'); assert.ok(out.sessions.length >= 1);
});
