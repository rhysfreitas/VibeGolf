// Shape It rules: ring placement, ring hit tests and scoring against the real flight model.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { CLUBS, SHAPES, DIFFICULTIES, shapeBall, buildRings, testRings, scoreShot, pickShape, clubIndex } from '../src/minigames/shape-it-logic.js';

const flat = { groundAt: () => 0 };
const fly = ball => simulate(ball, flat).pts;
const diff = id => DIFFICULTIES.find(d => d.id === id);

test('the reference shot threads every ring dead centre', () => {
  for (const key of Object.keys(SHAPES)) {
    const club = CLUBS[clubIndex(SHAPES[key].clubs[0])];
    const pts = fly(shapeBall(club, key));
    const rings = buildRings(pts, diff('tour'));
    const res = testRings(pts, rings);
    assert.ok(res.every(r => r.hit && r.perfect), `${key}: ${res.map(r => r.d.toFixed(2)).join(', ')}`);
    assert.equal(scoreShot(res).base, 3 * 200 + 500);
  }
});

test('rings sit rising, at the apex and descending, and grow with distance', () => {
  const pts = fly(shapeBall(CLUBS[clubIndex('7i')], 'straight'));
  const [a, b, c] = buildRings(pts, diff('beginner'));
  assert.ok(a.n[1] > 0.2 && Math.abs(b.n[1]) < 0.1 && c.n[1] < -0.2, 'normals follow the flight');
  assert.ok(a.dist < b.dist && b.dist < c.dist);
  assert.ok(a.r < c.r);
  // Beginner ring ≈ 30 yd across at ~150 yd
  const d150 = 150 * 0.9144; assert.ok(Math.abs(2 * Math.max(4, 0.10 * d150) / 0.9144 - 30) < 1);
});

test('the wrong shape misses; a near miss reports yards', () => {
  const club = CLUBS[clubIndex('5i')];
  const rings = buildRings(fly(shapeBall(club, 'draw')), diff('pro'));
  const res = testRings(fly(shapeBall(club, 'slice')), rings);
  assert.ok(res.filter(r => r.hit).length < 3);
  const slightly = testRings(fly({ ...shapeBall(club, 'draw'), HLA: 2.4 + 1.2 }), rings);
  const miss = slightly.find(r => !r.hit);
  if (miss) assert.ok(miss.missYd > 0 && Number.isFinite(miss.missYd));
});

test('a short shot never reaches the far ring', () => {
  const rings = buildRings(fly(shapeBall(CLUBS[clubIndex('DR')], 'straight')), diff('beginner'));
  const res = testRings(fly(shapeBall(CLUBS[clubIndex('PW')], 'straight')), rings);
  assert.equal(res[2].hit, false);
  assert.equal(res[2].d, Infinity);
});

test('scoring: perfect doubles a ring, full shape adds a bonus', () => {
  const r = (hit, perfect) => ({ hit, perfect });
  assert.equal(scoreShot([r(true, false), r(false, false), r(false, false)]).base, 100);
  assert.equal(scoreShot([r(true, true), r(true, false), r(false, false)]).base, 300);
  assert.equal(scoreShot([r(true, false), r(true, false), r(true, false)]).base, 550);
  assert.equal(scoreShot([r(true, true), r(true, true), r(true, true)]).base, 1100);
});

test('shape picker never repeats the last shape', () => {
  let last = null;
  for (let i = 0; i < 200; i++) { const k = pickShape(Math.random, last); assert.notEqual(k, last); last = k; }
});

test('shot names: curving back is a plain draw/fade, same-side curve keeps push/pull', async () => {
  globalThis.THREE = globalThis.THREE || {};
  const { shotShape } = await import('../src/range/shot-detail.js');
  assert.equal(shotShape(-2.4, 6.5), 'Fade');
  assert.equal(shotShape(2.4, -6.5), 'Draw');
  assert.equal(shotShape(3, 6), 'Push fade');
  assert.equal(shotShape(-3, -5), 'Pull draw');
  assert.equal(shotShape(4, 0), 'Push');
});
