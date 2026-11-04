// Wedge Ladder rules: judging landings, climbing and dropping, points, and the ideal shot per rung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { solveShot } from '../src/minigames/aim.js';
import { YD, CLUBS, DIFFICULTIES, LATERAL_YD, judge, step, points, rungPoints } from '../src/minigames/wedge-logic.js';

const diff = id => DIFFICULTIES.find(d => d.id === id);
const at = (yd, xYd = 0) => ({ x: xYd * YD, z: -yd * YD });

test('judge: bands, perfects, long/short and off the runway', () => {
  const d = diff('amateur');
  let j = judge(at(60.4), d, 2); assert.ok(j.inBand && j.perfect);
  j = judge(at(64), d, 2); assert.ok(j.inBand && !j.perfect);
  j = judge(at(66.5), d, 2); assert.ok(!j.inBand && j.dir === 'long' && Math.abs(j.missYd - 1.5) < 1e-6);
  j = judge(at(52), d, 2); assert.equal(j.dir, 'short');
  j = judge(at(60, LATERAL_YD + 4), d, 2); assert.ok(!j.inBand && !j.onRunway && j.dir === 'right');
  assert.ok(judge(at(67), diff('beginner'), 2).inBand && !judge(at(63), diff('tour'), 2).inBand);
});

test('the ladder: climb on hits, drop on misses, hold the top', () => {
  assert.deepEqual(step(0, false, 6), { rung: 0, dropped: false });
  assert.equal(step(2, true, 6).rung, 3);
  assert.equal(step(3, false, 6).rung, 2);
  const top = step(5, true, 6); assert.ok(top.rung === 5 && top.held && !top.climbed);
});

test('points grow with the rung, double for a perfect, bonus at the top', () => {
  const d = diff('amateur'), n = d.rungs.length;
  assert.equal(points(0, { inBand: true, perfect: false }, n), rungPoints(0));
  assert.ok(points(4, { inBand: true, perfect: false }, n) > points(1, { inBand: true, perfect: false }, n));
  assert.equal(points(2, { inBand: true, perfect: true }, n), rungPoints(2) * 2);
  assert.ok(points(n - 1, { inBand: true, perfect: false }, n) > rungPoints(n - 1));
  assert.equal(points(3, { inBand: false }, n), 0);
});

test('the ideal shot lands in the perfect window on every rung', () => {
  const sim = b => simulate(b, { groundAt: () => 0, surfaceAt: () => 'fairway' });
  const d = diff('tour');
  d.rungs.forEach((yd, i) => {
    const s = solveShot(sim, CLUBS, { x: 0, z: -yd * YD }), r = sim(s.ball);
    const l = r.pts.find(p => p.phase !== 'flight').p;
    const j = judge({ x: l[0], z: l[2] }, d, i);
    assert.ok(j.perfect, `${yd} yd: landed ${j.yd.toFixed(1)}`);
  });
});
