// Hollowmere (blockout): the caverns (cave.js), the course data, and the ball against the roof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createCave, hallDepth } from '../src/course/cave.js';
import { HOLES, COURSE } from '../src/course/hollowmere.js';

const T = HOLES.map(h => createTerrain(h));
// fly a shot from the back tee straight at a point, with the cave's rock solid
function shoot(t, from, to, shot, solid = t.solidAt) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: () => 'fairway',
    solidAt: (lx, ly, lz) => { const n = solid(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt: 0,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}

test('nine holes, par 36, a cave theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(HOLES.reduce((a, h) => a + h.par, 0), 36);
  assert.equal(COURSE.theme, 'cave');
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
});

test('cave.js: hall depth, the roof, open sky and solid rock', () => {
  const C = createCave({ halls: [{ a: [0, 0], b: [0, -200], w: 100, roof: 50, foot: -10 }], sky: [{ x: 0, z: -150, r: 12 }], wall: 30 });
  assert.equal(hallDepth(C.halls[0], 0, -100), 50);
  assert.ok(hallDepth(C.halls[0], 80, -100) < 0);
  assert.ok(Math.abs(C.ceilingAt(0, -60) - 50) < 6, 'the roof over the middle of the hall');
  assert.ok(C.ceilingAt(45, -60) < C.ceilingAt(20, -60), 'the roof curves down into the walls');
  assert.equal(C.ceilingAt(0, -150), null, 'no roof under the opening');
  assert.ok(C.solidAt(0, 60, -60), 'above the roof is rock');
  assert.equal(C.solidAt(0, 20, -60), null, 'the hall is open');
  let n = null; for (let x = 20; x < 80 && !n; x += 0.5) n = C.solidAt(x, 0, -60);
  assert.ok(n && n[0] < 0, 'a wall pushes back into the hall');
  assert.ok(n.soak > 0 && n.soak < 1, 'and soaks up some balls');
  assert.equal(C.solidAt(0, 80, -150), null, 'open to the sky');
  const S = createCave({ halls: C.halls, stalactites: [{ x: 0, z: -60, y: 25, r: 3 }] });
  assert.ok(S.solidAt(0.5, 30, -60), 'a stalactite is solid');
  assert.equal(S.solidAt(0.5, 20, -60), null, 'below its tip is open');
});

test('every tee and green has ground, with the roof at least 45 m over every tee', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) {
      const g = t.groundAt(x, z); assert.ok(g !== null, `${h.name} ${id} tee on ground`);
      const c = t.cave.ceilingAt(x, z); assert.ok(c === null || c - g >= 45, `${h.name} ${id}: roof ${c && (c - g).toFixed(1)} m up`);
      assert.equal(t.solidAt(x, g + 2, z), null, `${h.name} ${id}: the tee is in open cave`);
    }
    for (const [px, pz] of h.green.pins) {
      const g = t.groundAt(px, pz);
      assert.ok(g !== null && t.surfaceAt(px, pz) === 'green', `${h.name} pin on its green`);
      const sl = t.slopeAt(px, pz); assert.ok(Math.hypot(sl.x, sl.z) <= 0.03 + 1e-9, `${h.name} pin at 3% or less`);
    }
  });
});

test('normal drives clear the roof and walls; a skied wedge stays under the roof', () => {
  const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
  HOLES.forEach((h, i) => {
    if (h.par === 3 || i === 8) return; // the 9th is drivable: tested through its eyelet below
    // the roof and walls only: stalagmite stands through a dogleg are meant to catch a drive that runs on
    const W = shoot(T[i], h.tees.eagle, h.line[1], DR, T[i].cave.solidAt);
    assert.ok(!W.some(p => p.hit && p.phase === 'flight'), `${h.name}: the drive hits nothing overhead`);
  });
  // a skied wedge under the low roof of the geode pocket (hole 5) is knocked back down by the rock
  const t = T[4], h = HOLES[4], W = shoot(t, h.tees.eagle, h.pin, { Speed: 70, VLA: 70, TotalSpin: 9000 });
  const top = Math.max(...W.map(p => p.y)), roof = t.cave.ceilingAt(h.pin[0] * 0.3, h.pin[1] * 0.3);
  assert.ok(roof === null || top <= roof + 1, `stays under the roof (${top.toFixed(1)} vs ${roof?.toFixed(1)})`);
});

test('the Cenote is drivable through the eyelet in its fin; the fin stops a drive that misses the window', () => {
  const t = T[8], h = HOLES[8], DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
  const W = shoot(t, h.tees.eagle, h.pin, DR);
  assert.ok(!W.some(p => p.hit && p.phase === 'flight'), 'straight at the green: through the window');
  const land = W.find(p => p.phase !== 'flight') || W.at(-1), d = Math.hypot(land.x - h.pin[0], land.z - h.pin[1]);
  assert.ok(d < 45, `lands near the green (${d.toFixed(0)} m away)`);
  // a low drive meets the sill under the window and never gets past the fin
  const fin = h.rocks.find(r => r.type === 'arch'), reach = Math.hypot(fin.x - h.tees.eagle[0], fin.z - h.tees.eagle[1]);
  const low = shoot(t, h.tees.eagle, h.pin, { Speed: 150, VLA: 4, TotalSpin: 2400 });
  assert.ok(low.every(p => Math.hypot(p.x - h.tees.eagle[0], p.z - h.tees.eagle[1]) < reach + 4), 'a low drive is stopped by the fin');
});

test('the hero line on the Falls clips a stalactite; the Deep is open air', () => {
  const t = T[5];
  for (const S of t.cave.stalactites) assert.ok(t.solidAt(S.x, S.y + 1, S.z), 'stalactite tips are solid');
  const h = HOLES[5], deep = h.floor.gorges[0];
  assert.equal(t.groundAt(deep.x, deep.z), null, 'the chasm has no bottom');
});

test('the Adit\'s ore cart is solid where it stands, and rolls on between shots', () => {
  const t = T[0]; assert.ok(t.cart, 'the 1st has a cart');
  const P = t.cart.pose(), g = t.groundAt(P.x, P.z);
  assert.ok(t.solidAt(P.x, g + 0.8, P.z), 'a ball at the cart hits it');
  assert.equal(t.solidAt(P.x, g + 3, P.z), null, 'over it is open');
  const s0 = t.cart.s; let r = 0.1; t.cart.next(() => (r = (r + 0.37) % 1));
  assert.ok(Math.abs(t.cart.s - s0) >= 20, 'it moves on');
});
