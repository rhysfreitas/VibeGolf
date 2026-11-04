// The simulated-shot tool's solver (src/minigames/aim.js): club · Normal / Punch / Stinger · shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { solveCustom, amateurMiss, makeToolShot } from '../src/minigames/aim.js';
import { CLUBS } from '../src/minigames/shape-it-logic.js';

const sim = b => simulate(b, { groundAt: () => 0 });
const T = { x: 6, z: -140 };

test('every club / trajectory / shape combination lands on the spot', () => {
  for (const traj of ['normal', 'punch', 'stinger']) for (const axis of [-14, 0, 12]) {
    const s = solveCustom(sim, CLUBS, T, { traj, axis });
    assert.ok(Math.hypot(s.land.x - T.x, s.land.z - T.z) < 2, `${traj} ${axis}: lands ${s.land.x.toFixed(1)}, ${s.land.z.toFixed(1)}`);
  }
});

test('a punch and a stinger fly lower than a normal shot with the same club', () => {
  const apex = traj => { const s = solveCustom(sim, CLUBS, T, { club: 3, traj }); return sim(s.ball).apexFt; };
  const n = apex('normal'), p = apex('punch'), st = apex('stinger');
  assert.ok(p < n * 0.8 && st < p, `apex normal ${n.toFixed(0)} · punch ${p.toFixed(0)} · stinger ${st.toFixed(0)} ft`);
});

test('a draw starts right of the target and curves back; a fade the other way', () => {
  const d = solveCustom(sim, CLUBS, T, { axis: -14 }), f = solveCustom(sim, CLUBS, T, { axis: 14 }), bearing = Math.atan2(T.x, -T.z) * 180 / Math.PI;
  assert.ok(d.ball.HLA > bearing + 1 && f.ball.HLA < bearing - 1, `draw HLA ${d.ball.HLA.toFixed(1)}, fade ${f.ball.HLA.toFixed(1)}`);
});

test('a club you pick is used; Auto picks the shortest club that gets there', () => {
  assert.equal(solveCustom(sim, CLUBS, T, { club: 1 }).club, 1);
  const auto = solveCustom(sim, CLUBS, T).club;
  assert.ok(auto > 1, 'auto picks something shorter than a 3 wood for 153 yd');
});

test('Hit misses like a decent amateur; Ideal is exact', () => {
  const shot = makeToolShot(sim, CLUBS), s = { club: 0, clubAuto: true, traj: 'normal', axis: 0 };
  const ideal = shot(T, { ...s, ideal: true }).ball, again = shot(T, { ...s, ideal: true }).ball;
  assert.deepEqual(ideal, again);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hla = []; for (let i = 0; i < 400; i++) hla.push(amateurMiss(ideal, rnd).HLA - ideal.HLA);
  const sd = Math.sqrt(hla.reduce((a, v) => a + v * v, 0) / hla.length);
  assert.ok(sd > 2.4 && sd < 3.6, `start direction σ ${sd.toFixed(2)}°`);
});
