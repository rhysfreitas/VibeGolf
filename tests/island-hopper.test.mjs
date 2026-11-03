// Island Hopper rules: island options, landings, pads, falls, and the hop solver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { CLUBS } from '../src/minigames/shape-it-logic.js';
import { YD, DIFFICULTIES, BANDS, startIsland, makeOptions, groundAt, islandAt, resolveHop, solveHop, padRadius, distYd, VOID_Y } from '../src/minigames/island-logic.js';

const diff = id => DIFFICULTIES.find(d => d.id === id);
function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0; return (s >>> 8) / 16777216; }; }
const local = (islands, from) => (x, z) => { const v = groundAt(islands, x + from.x, z + from.z); return v === null ? null : v - from.y; };
const fly = (ball, islands, from) => simulate(ball, { groundAt: local(islands, from), voidY: VOID_Y });

test('three options: short, mid, long, in their distance bands, never overlapping', () => {
  for (let s = 1; s < 40; s++) {
    const cur = startIsland(diff('amateur')), from = { x: 0, y: 0, z: 0 };
    const opts = makeOptions(from, s % 12, diff('amateur'), rng(s), [cur]);
    assert.equal(opts.length, 3);
    opts.forEach((I, i) => {
      const b = BANDS[i], yd = distYd(from, I);
      assert.ok(yd >= b.yd[0] - 0.01 && yd <= b.yd[1] + 0.01, `${b.id} at ${yd.toFixed(0)} yd`);
    });
    const all = [cur, ...opts];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].z - all[j].z) > all[i].r + all[j].r);
  }
});

test('islands shrink as the run goes on', () => {
  const a = makeOptions({ x: 0, y: 0, z: 0 }, 0, diff('pro'), rng(3));
  const b = makeOptions({ x: 0, y: 0, z: 0 }, 10, diff('pro'), rng(3));
  assert.ok(b[1].r < a[1].r);
});

test('the ideal hop rests on its island, usually on the pad', () => {
  let pads = 0, n = 0;
  for (let s = 1; s <= 12; s++) {
    const cur = startIsland(diff('beginner')), from = { x: 0, y: 0, z: 0 };
    const opts = makeOptions(from, 0, diff('beginner'), rng(s * 7), [cur]), islands = [cur, ...opts];
    for (const I of opts) {
      const sol = solveHop(simulate, CLUBS, from, I, islands);
      const r = fly(sol.ball, islands, from);
      const res = resolveHop(r.pts, r.outcome, from, cur, opts);
      assert.equal(res.kind, 'hop', `seed ${s} ${I.band}: ${res.kind}`);
      assert.equal(res.island, I);
      n++; if (res.pad) pads++;
    }
  }
  assert.ok(pads / n >= 0.8, `pad rate ${pads}/${n}`);
});

test('a short ball falls into the clouds and reports the miss', () => {
  const cur = startIsland(diff('pro')), from = { x: 0, y: 0, z: 0 };
  const opts = makeOptions(from, 0, diff('pro'), rng(11), [cur]), islands = [cur, ...opts];
  const sol = solveHop(simulate, CLUBS, from, opts[2], islands);
  const r = fly({ ...sol.ball, Speed: sol.ball.Speed * 0.8 }, islands, from);
  const res = resolveHop(r.pts, r.outcome, from, cur, opts);
  if (res.kind === 'fall') assert.ok(Number.isFinite(res.missYd));
  else assert.notEqual(res.island, opts[2]);
});

test('a dribble stays on your own island', () => {
  const cur = startIsland(diff('beginner')), from = { x: 0, y: 0, z: 0 };
  const opts = makeOptions(from, 0, diff('beginner'), rng(5), [cur]);
  const r = fly({ Speed: 12, VLA: 20, HLA: 0, TotalSpin: 3000, SpinAxis: 0 }, [cur, ...opts], from);
  assert.equal(resolveHop(r.pts, r.outcome, from, cur, opts).kind, 'stayed');
});

test('pad size and points', () => {
  const I = { r: 20 }; assert.ok(Math.abs(padRadius(I) - 4.4) < 1e-9);
  assert.deepEqual(BANDS.map(b => b.points), [100, 200, 350]);
  assert.ok(islandAt([startIsland(diff('pro'))], 0, -4));
});

test('the next tee is on the front of the island you landed on', async () => {
  const { teeSpot, islandAt } = await import('../src/minigames/island-logic.js');
  const I = { id: 99, band: 'mid', x: 10, y: -5, z: -120, r: 15, seed: 2 };
  const t = teeSpot(I);
  assert.ok(t.z < I.z && islandAt([I], t.x, t.z) === I);
});
