// Zombie Siege rules: waves, walking and fence damage, blasts, chains, tanks, scoring, aiming.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { CLUBS } from '../src/minigames/shape-it-logic.js';
import { YD, FENCE_Z, TYPES, waveSpawns, stepZombies, resolveBlast, blastPoints, multiKill, chooseTarget, solveShot, bestLane, active } from '../src/minigames/zombie-logic.js';

const Z = (type, x, z, extra = {}) => ({ id: Math.random(), type, x, z, hp: TYPES[type].hp, speed: TYPES[type].speed, alive: true, state: 'walk', wob: 0, delay: 0, ...extra });

test('waves grow, with packs, bloaters and tanks arriving on schedule', () => {
  const count = (w, t) => w.filter(z => z.type === t).length;
  const w1 = waveSpawns(1), w3 = waveSpawns(3), w4 = waveSpawns(4);
  assert.equal(count(w1, 'pack') + count(w1, 'tank') + count(w1, 'bloater'), 0);
  assert.ok(count(w3, 'tank') >= 1 && count(w3, 'pack') >= 5);
  assert.ok(w3.length > w4.length * 0.9, 'wave 3 is a horde');
  assert.ok(w4.length > w1.length);
});

test('zombies walk to the fence, then attack it', () => {
  const zs = [Z('walker', 0, -20)];
  let dmg = 0;
  for (let i = 0; i < 100; i++) dmg += stepZombies(zs, 0.1).damage;
  assert.equal(zs[0].state, 'attack');
  assert.ok(Math.abs(zs[0].z - (FENCE_Z - 1)) < 1e-6);
  assert.ok(dmg > 0);
});

test('a bloater bursts on the fence once', () => {
  const zs = [Z('bloater', 0, FENCE_Z - 1.5)];
  const out = stepZombies(zs, 1);
  assert.equal(out.damage, TYPES.bloater.burst);
  assert.equal(zs[0].alive, false);
});

test('blast radius decides who goes down; direct hits double kill points', () => {
  const zs = [Z('walker', 0, -100), Z('walker', 10 * YD, -100), Z('walker', 30 * YD, -100)];
  const res = resolveBlast({ x: 0, z: -100 }, zs, 12);
  assert.equal(res.kills.length, 2);
  assert.ok(res.direct);
  const p = blastPoints(res);
  assert.equal(p.base, 2 * 50 * 2 + 100); // doubled kills + DOUBLE
});

test('tanks take two blasts unless it is a direct hit', () => {
  const t = [Z('tank', 5 * YD, -100)];
  let r = resolveBlast({ x: 0, z: -100 }, t, 12);
  assert.equal(r.kills.length, 0); assert.equal(r.wounded.length, 1); assert.equal(t[0].hp, 1);
  r = resolveBlast({ x: 0, z: -100 }, t, 12);
  assert.equal(r.kills.length, 1);
  const t2 = [Z('tank', 0.5, -100)];
  assert.equal(resolveBlast({ x: 0, z: -100 }, t2, 12).kills.length, 1);
});

test('bloaters chain into each other', () => {
  const zs = [Z('bloater', 0, -100), Z('bloater', 6 * YD, -100), Z('walker', 13 * YD, -100), Z('walker', 40 * YD, -100)];
  const res = resolveBlast({ x: 0, z: -100 }, zs, 4);
  assert.equal(res.kills.length, 3);
  assert.equal(res.chain.length, 2);
  assert.equal(multiKill(res.kills.length).word, 'TRIPLE');
});

test('a miss reports how far outside the blast it was', () => {
  const zs = [Z('walker', 0, -100)];
  const res = resolveBlast({ x: 15 * YD, z: -100 }, zs, 12);
  assert.equal(res.kills.length, 0);
  assert.ok(Math.abs(res.missYd - 3) < 0.01);
});

test('the aim helper picks the pack and leads it', () => {
  const zs = [Z('walker', -40, -150), ...Array.from({ length: 5 }, (_, i) => Z('pack', 10 + i, -180 + i))];
  const t = chooseTarget(zs, 12, 5);
  assert.ok(t.x > 5 && t.n >= 5);
  assert.ok(t.z > -180, 'aims where the pack will be');
});

test('the shot solver carries the target distance and starts on line', () => {
  const sim = b => simulate(b, { groundAt: () => 0 });
  for (const [x, d] of [[12, 80], [12, 140], [12, 200], [46, 15], [-40, 30]]) {
    const target = { x, z: -d };
    const s = solveShot(sim, CLUBS, target);
    const r = sim(s.ball), land = r.pts.find(p => p.phase !== 'flight').p;
    const miss = Math.hypot(land[0] - target.x, land[2] - target.z);
    assert.ok(miss < 4, `${d} m: landed ${miss.toFixed(1)} m away`);
  }
});

test('the aim helper deals with zombies at the fence before a far pack', () => {
  const zs = [Z('walker', 20, FENCE_Z - 10), ...Array.from({ length: 6 }, (_, i) => Z('pack', -10 + i, -200 + i))];
  const t = chooseTarget(zs, 12, 5);
  assert.ok(t.x > 10 && t.z > FENCE_Z - 30);
});

test('airstrike lane is the busiest one', () => {
  const zs = [Z('walker', -30, -100), Z('walker', 20, -100), Z('walker', 25, -120), Z('walker', 30, -90)];
  assert.equal(bestLane(zs), 2);
  assert.equal(active(zs).length, 4);
});
