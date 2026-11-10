// The Reclaim (blockout): the sampled ground, the course data, and the ball against the city.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES, COURSE } from '../src/course/reclaim.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
// fly a shot from a spot straight at a point, with the city's buildings, towers and the El solid
function shoot(t, from, to, shot, solid = t.solidAt) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: () => 'fairway',
    solidAt: (lx, ly, lz) => { const n = solid(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt: 0, rand: () => 0.99,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const hitAny = pts => pts.some(p => p.hit);

test('nine holes, par 36, a city theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(HOLES.reduce((a, h) => a + h.par, 0), 36);
  assert.equal(COURSE.theme, 'city');
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
});

test('card yardages are measured down the line', () => {
  HOLES.forEach(h => {
    let len = 0; for (let i = 1; i < h.line.length; i++) len += Math.hypot(h.line[i][0] - h.line[i - 1][0], h.line[i][1] - h.line[i - 1][1]);
    // from the back tee, which can sit a little way down the line (the Station's was moved up to make it a pitch)
    const [tx, tz] = h.tees.spire, [ax, az] = h.line[0], [bx, bz] = h.line[1], l = Math.hypot(bx - ax, bz - az);
    len -= Math.max(0, ((tx - ax) * (bx - ax) + (tz - az) * (bz - az)) / l);
    assert.ok(Math.abs(len / 0.9144 - h.yards.spire) < 4, `${h.name}: ${(len / 0.9144).toFixed(0)} vs ${h.yards.spire}`);
  });
});

test('every tee is on open ground, no tee on a fairway, every pin on its green at 3% or less', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) {
      const g = t.groundAt(x, z); assert.ok(g !== null, `${h.name} ${id} tee on ground`);
      assert.equal(t.solidAt(x, g + 1.5, z), null, `${h.name} ${id}: nothing solid on the tee`);
      assert.equal(t.surfaceAt(x, z), 'tee', `${h.name} ${id} is a tee pad`);
    }
    const [px, pz] = h.pin;
    assert.equal(t.surfaceAt(px, pz), 'green', `${h.name} pin on its green`);
    const sl = t.slopeAt(px, pz); assert.ok(Math.hypot(sl.x, sl.z) <= 0.03 + 1e-9, `${h.name} pin ${(Math.hypot(sl.x, sl.z) * 100).toFixed(1)}%`);
  });
});

test('nothing overhead within 45 m of any tee', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: solid ${y} m up`); }
  });
});

test('every target is on fairway', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
});

test('a tour drive from the back tee at the first target hits nothing in the air', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(T[i], h.tees.spire, [tg.x, tg.z], DR));
    assert.ok(!hitAny(pts), `${h.name}: the drive hit something`);
  });
});

test('the Atrium: a drive down the bold line flies through the open lobby; a skied one hits the floors above', () => {
  const i = HOLES.findIndex(h => h.name === 'The Atrium'), h = HOLES[i], tg = h.targets.find(q => q.name === 'Through the Atrium');
  const pts = flown(shoot(T[i], h.tees.spire, [tg.x, tg.z], DR));
  assert.ok(!hitAny(pts), 'the bold drive passes through');
  const hiShot = flown(shoot(T[i], h.tees.spire, [tg.x, tg.z], { Speed: 160, VLA: 24, TotalSpin: 5200 }));
  assert.ok(hitAny(hiShot), 'a skied drive hits the floors above the lobby');
});

test('the El: the fallen tower lies across the second leg, a blind ridge 9 m or more over the fairway', () => {
  const i = 0, h = HOLES[i], t = T[i];
  const line = h.line, a = line[1], b = line[2], u = [(b[0] - a[0]), (b[1] - a[1])], L = Math.hypot(...u);
  const at = s => [a[0] + u[0] / L * (s - 232), a[1] + u[1] / L * (s - 232)];
  const crest = t.groundAt(...at(290)), before = t.groundAt(...at(250));
  assert.ok(crest - before > 9, `the ridge stands ${(crest - before).toFixed(1)} m`);
});

test('the Stadium: a sinkhole short of the green is open air, with short grass between it and the green', () => {
  const i = HOLES.findIndex(h => h.name === 'The Stadium'), h = HOLES[i], t = T[i];
  assert.equal(t.groundAt(0, -124), null, 'the sinkhole');
  assert.equal(t.surfaceAt(0, -124), 'void');
  const gap = [150, 152, 154, 156].map(s => t.surfaceAt(0, -s));
  assert.ok(gap.every(s => s === 'fairway' || s === 'fringe'), `between: ${gap}`);
});

test('the Rift is open air beside the climb; the water on the Bridge and Riverside is water', () => {
  const r = HOLES.findIndex(h => h.name === 'The Rift');
  let open = 0; for (let x = -90; x < -40; x += 2) if (T[r].groundAt(x, -240) === null) open++;
  assert.ok(open > 5, 'the rift');
  const b = HOLES.findIndex(h => h.name === 'The Bridge');
  let wet = 0; for (let x = -260; x < 0; x += 4) for (let z = -500; z < 0; z += 8) if (T[b].surfaceAt(x, z) === 'water') wet++;
  assert.ok(wet > 20, 'the river by the Bridge');
});

test('a building facade can soak a ball', () => {
  const t = T[0], R = t.rocks.find(r => r.type === 'box' && r.soak);
  assert.ok(R, 'a building is solid');
  const n = t.solidAt(R.x + Math.cos(R.rot) * (R.w / 2 - 0.2), R.y + 3, R.z + Math.sin(R.rot) * (R.w / 2 - 0.2));
  assert.ok(n && n.soak > 0, 'its wall soaks');
});

test('a ball landing on a roof comes down at the foot of the nearest wall', () => {
  const t = T[0], R = t.rocks.find(r => r.type === 'box' && r.soak);
  const n = t.solidAt(R.x, R.y + R.h - 0.1, R.z);
  assert.ok(n && n[1] === 0 && n.soak === 1, 'pushed off the roof, dropped at the wall');
});
