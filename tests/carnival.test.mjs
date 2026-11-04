// Carnival Booth rules: target layout, hit detection on cans/boards/ducks/bell, bounce-off, aiming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { CLUBS } from '../src/minigames/shape-it-logic.js';
import { YD, DIFFICULTIES, ROWS, ROW_IDS, layout, duckX, findHit, bounceOff, scoreHit, aimPoint, solveAim, prizeFor, nextPrize } from '../src/minigames/carnival-logic.js';

const diff = id => DIFFICULTIES.find(d => d.id === id);
const flat = () => 0;
const fsim = b => simulate(b, { groundAt: flat, flightOnly: true });
const full = b => simulate(b, { groundAt: flat, surfaceAt: () => 'fairway' });
// a straight line of points from a to b over `dur` seconds
const line = (a, b, dur = 1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const f = i / n; return { t: f * dur, p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], phase: 'flight' }; });

test('rows sit at their yardages and shrink with difficulty', () => {
  for (const id of ROW_IDS) assert.ok(Math.abs(-ROWS[id].z / YD - ROWS[id].yd) < 0.01);
  const b = layout(diff('beginner')), t = layout(diff('tour'));
  assert.ok(b.cans[0].r > t.cans[0].r * 2 && b.bell.r > t.bell.r * 2);
});

test('ducks glide steadily and loop round', () => {
  const D = layout(diff('amateur')).ducks;
  assert.ok(Math.abs(duckX(D, 0, 1) - duckX(D, 0, 0) - D.speed) < 1e-9);
  for (let t = 0; t < 200; t += 3.7) for (let i = 0; i < D.n; i++) { const x = duckX(D, i, t); assert.ok(x >= D.x0 && x < D.x1); }
});

test('findHit: cans, boards (bullseye), ducks (moving) and the bell', () => {
  const lay = layout(diff('amateur')), st = { cansDown: [], ducksDown: [], t0: 0 };
  const c = lay.cans[2];
  let r = findHit(line([0, 3, 0], [c.x, c.y0 + 2, c.z - 5]), lay, st);
  assert.equal(r.hit.kind, 'cans'); assert.equal(r.hit.i, 2);
  st.cansDown[2] = true;                                          // a can that's down can't be hit again
  r = findHit(line([0, 3, 0], [c.x, c.y0 + 2, c.z - 5]), lay, st);
  assert.notEqual(r.hit && r.hit.kind, 'cans');
  const b = lay.boards[lay.boards.length - 1];
  r = findHit(line([0, 30, 0], [b.x, b.cy, b.z - 1]).map(q => q), { ...lay, cans: [] }, { t0: 0 });
  assert.equal(r.hit.kind, 'boards'); assert.ok(r.hit.perfect);
  const D = lay.ducks, tc = 2, xAt = duckX(D, 1, 10 + tc);
  r = findHit(line([xAt, D.y0 + D.h / 2, D.z + 20], [xAt, D.y0 + D.h / 2, D.z - 20], tc * 2), { ...lay, cans: [], boards: [] }, { t0: 10, ducksDown: [] });
  assert.equal(r.hit.kind, 'ducks'); assert.equal(r.hit.i, 1); assert.ok(r.hit.perfect);
  r = findHit(line([0, 30, 0], [0, lay.bell.cy, lay.bell.z - 2]), { ...lay, cans: [], boards: [], ducks: { ...D, n: 0 } }, { t0: 0 });
  assert.equal(r.hit.kind, 'bell');
  r = findHit(line([0, 40, 0], [60, 40, -300]), lay, { t0: 0 });   // sails over everything
  assert.equal(r.hit, null);
});

test('scoring and prizes', () => {
  assert.equal(scoreHit({ kind: 'boards', perfect: true }), ROWS.boards.points * 2);
  assert.equal(scoreHit({ kind: 'cans', perfect: false }), ROWS.cans.points);
  assert.ok(ROWS.cans.points < ROWS.boards.points && ROWS.boards.points < ROWS.ducks.points && ROWS.ducks.points < ROWS.bell.points);
  assert.equal(prizeFor(0).id, 'none'); assert.equal(prizeFor(900).id, 'medium'); assert.equal(nextPrize(900).id, 'giant'); assert.equal(nextPrize(99999), null);
});

test('bounceOff stops the ball at the target and drops it to the floor', () => {
  const pts = line([0, 10, 0], [0, 5, -100], 4);
  const out = bounceOff(pts, { t: 2, p: [0, 7.5, -50] });
  assert.ok(out.every(q => q.p[2] >= -50.5));
  assert.equal(out[out.length - 1].phase, 'roll'); assert.ok(Math.abs(out[out.length - 1].p[1]) < 1e-9);
});

test('the ideal shot hits every row (ducks led by the flight time)', () => {
  for (const d of [diff('amateur'), diff('tour')]) {
    const lay = layout(d);
    for (const row of ROW_IDS) {
      const now = 17.3, st = { cansDown: [], ducksDown: [], t0: now };
      let aim = aimPoint(row, lay, st, now), sol = solveAim(fsim, CLUBS, aim);
      if (row === 'ducks') { aim = aimPoint(row, lay, st, now, sol.timeToTarget); sol = solveAim(fsim, CLUBS, aim); }
      const { hit } = findHit(full(sol.ball).pts, lay, st);
      assert.ok(hit && hit.kind === row, `${d.id} ${row}: hit ${hit && hit.kind}`);
    }
  }
});
