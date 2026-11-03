// Golf HORSE rules: reading shapes and heights, judging calls, turn order, and the call solver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { CLUBS } from '../src/minigames/shape-it-logic.js';
import { YD, FT, TARGETS, DIFFICULTIES, ringR, bullR, judge, shapeOk, heightOk, refApex, ringAt, matchQueue, nextActive, isOut, standing, lettersOf, solveCall, groundAt, surfaceAt, streetDist, cpuCall, swish, HOOP, callValue } from '../src/minigames/horse-logic.js';

const diff = id => DIFFICULTIES.find(d => d.id === id);
const fsim = b => simulate(b, { groundAt, flightOnly: true });
const full = b => simulate(b, { groundAt, surfaceAt });
const landing = r => { const l = (r.pts.find(p => p.phase !== 'flight') || r.pts[r.pts.length - 1]).p; return { x: l[0], z: l[2] }; };

test('targets sit at their yardage, never overlap, and the street holds the centre ones', () => {
  for (const T of TARGETS) assert.ok(Math.abs(Math.hypot(T.px, T.pz) / YD - T.yd) < 0.01);
  for (const d of DIFFICULTIES) for (let i = 0; i < TARGETS.length; i++) for (let j = i + 1; j < TARGETS.length; j++) {
    const a = TARGETS[i], b = TARGETS[j];
    assert.ok(Math.hypot(a.px - b.px, a.pz - b.pz) > ringR(a, d) + ringR(b, d) + 2, `${a.yd}/${b.yd} on ${d.id}`);
  }
  for (const T of TARGETS) assert.ok(streetDist(T.px, T.pz) < 0, `${T.yd} centre on the asphalt`);
  assert.ok(ringR(TARGETS[3], diff('beginner')) > ringR(TARGETS[3], diff('tour')) * 2);
  assert.ok(bullR(TARGETS[0], diff('pro')) < ringR(TARGETS[0], diff('pro')));
});

test('shape and height reading follow the difficulty', () => {
  assert.ok(shapeOk('draw', -2, diff('beginner')) && !shapeOk('draw', -2, diff('tour')));
  assert.ok(shapeOk('straight', 5, diff('beginner')) && !shapeOk('straight', 5, diff('pro')));
  assert.ok(shapeOk('fade', 4, diff('tour')) && !shapeOk('fade', -4, diff('beginner')));
  assert.ok(shapeOk('any', 20, diff('tour')));
  const T = TARGETS[3], ref = refApex(T);
  assert.ok(heightOk('high', ref * 1.1, ref, diff('beginner')) && !heightOk('high', ref * 1.1, ref, diff('tour')));
  assert.ok(heightOk('low', ref * 0.85, ref, diff('pro')) && !heightOk('low', ref * 0.95, ref, diff('pro')));
});

test('judge: ring, bullseye, shape and height all have to match; misses say which way', () => {
  const T = TARGETS[3], d = diff('amateur'), R = ringR(T, d), call = { ring: 3, shape: 'draw', height: 'any' };
  const at = (dx, dz) => ({ x: T.px + dx, z: T.pz + dz });
  let j = judge(call, { land: at(0, 0), axis: -6, apex: 25 }, d);
  assert.ok(j.made && j.bull && j.landedIn === 3);
  j = judge(call, { land: at(R * 0.7, 0), axis: -6, apex: 25 }, d);
  assert.ok(j.made && !j.bull);
  j = judge(call, { land: at(0, 0), axis: 3, apex: 25 }, d);
  assert.ok(!j.made && j.inRing && !j.shapeOk);
  j = judge(call, { land: at(0, -R - 3 * YD), axis: -6, apex: 25 }, d);
  assert.ok(!j.made && j.dir === 'long' && Math.abs(j.missYd - 3) < 0.3);
  j = judge(call, { land: at(0, R + 2), axis: -6, apex: 25 }, d);
  assert.equal(j.dir, 'short');
  assert.equal(ringAt(0, 30, d), null);
  assert.ok(callValue({ shape: 'draw', height: 'high' }) > callValue({ shape: 'any', height: 'any' }));
});

test('turn order: matchers follow the setter, players who spell the word are skipped', () => {
  assert.deepEqual(matchQueue(1, [0, 0, 0], 'PIG'), [2, 0]);
  assert.deepEqual(matchQueue(0, [0, 3, 1], 'PIG'), [2]);
  assert.equal(nextActive(0, [0, 3, 1], 'PIG'), 2);
  assert.equal(nextActive(2, [0, 3, 1], 'PIG'), 0);
  assert.ok(isOut(5, 'HORSE') && !isOut(4, 'HORSE'));
  assert.equal(standing([5, 2, 5], 'HORSE'), 1);
  assert.equal(lettersOf(2, 'HORSE'), 'HO');
});

test('computer calls are valid', () => {
  let s = 7; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 50; i++) { const c = cpuCall(rand); assert.ok(TARGETS[c.ring] && ['any', 'straight', 'draw', 'fade'].includes(c.shape) && ['any', 'high', 'low'].includes(c.height)); }
});

test('the ideal shot makes every kind of call on Tour', () => {
  const d = diff('tour');
  const calls = [];
  for (const T of TARGETS) calls.push({ ring: T.i, shape: 'straight', height: 'any' });
  calls.push({ ring: 1, shape: 'draw', height: 'high' }, { ring: 3, shape: 'fade', height: 'low' }, { ring: 4, shape: 'draw', height: 'low' }, { ring: 5, shape: 'fade', height: 'high' }, { ring: 6, shape: 'draw', height: 'any' });
  for (const call of calls) {
    const s = solveCall(fsim, CLUBS, TARGETS[call.ring], call), r = full(s.ball);
    const j = judge(call, { land: landing(r), axis: s.ball.SpinAxis, apex: r.apexFt * FT }, d);
    assert.ok(j.made, `${TARGETS[call.ring].yd} ${call.shape} ${call.height}: in ${j.inRing} shape ${j.shapeOk} height ${j.heightOk} miss ${j.missYd.toFixed(1)}`);
  }
});

test('a simulated amateur makes beginner calls often but not always', () => {
  let s = 3; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let made = 0, n = 0;
  for (const T of TARGETS) {
    const call = { ring: T.i, shape: 'any', height: 'any' }, sol = solveCall(fsim, CLUBS, T, call);
    for (let k = 0; k < 6; k++) {
      const b = { ...sol.ball }; b.HLA += gauss() * 3; b.SpinAxis += gauss() * 6.5; b.Speed *= 1 + gauss() * 0.03; b.VLA += gauss() * 1.8; b.TotalSpin *= 1 + gauss() * 0.1;
      const r = full(b); if (judge(call, { land: landing(r), axis: b.SpinAxis, apex: r.apexFt * FT }, diff('beginner')).made) made++; n++;
    }
  }
  assert.ok(made / n > 0.3 && made / n < 0.95, `made ${made}/${n}`);
});

test('swish: a ball dropping through the rim', () => {
  const pts = [{ p: [HOOP.x, HOOP.y + 1, HOOP.z + 0.5] }, { p: [HOOP.x, HOOP.y - 1, HOOP.z - 0.5] }];
  assert.ok(swish(pts));
  assert.ok(!swish([{ p: [HOOP.x + 3, HOOP.y + 1, HOOP.z] }, { p: [HOOP.x + 3, HOOP.y - 1, HOOP.z] }]));
});
