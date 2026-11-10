// Rimeholm (blockout): the sampled glacier, the course data, and the ball against the ice.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES, COURSE } from '../src/course/rimeholm.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
// fly a shot from a spot straight at a point, with the seracs, boulders, the hall and the ice cave solid
function shoot(t, from, to, shot, surf = (x, z) => 'fairway') {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => surf(wx(lx, lz), wz(lx, lz)),
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt: 1200, rand: () => 0.99,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');

test('nine holes, par 36, an ice theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(HOLES.reduce((a, h) => a + h.par, 0), 36);
  assert.equal(COURSE.theme, 'ice');
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
});

test('card yardages are measured down the line', () => {
  HOLES.forEach(h => {
    let len = 0; for (let i = 1; i < h.line.length; i++) len += Math.hypot(h.line[i][0] - h.line[i - 1][0], h.line[i][1] - h.line[i - 1][1]);
    assert.ok(Math.abs(len / 0.9144 - h.yards.mammoth) < 4, `${h.name}: ${(len / 0.9144).toFixed(0)} vs ${h.yards.mammoth}`);
  });
});

test('every tee is on a pad, every pin on its green at 3% or less', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) {
      const g = t.groundAt(x, z); assert.ok(g !== null, `${h.name} ${id} tee on ground`);
      assert.equal(t.solidAt(x, g + 1.5, z), null, `${h.name} ${id}: nothing solid on the tee`);
      assert.equal(t.surfaceAt(x, z), 'tee', `${h.name} ${id} is a tee pad`);
    }
    const [px, pz] = h.pin;
    assert.equal(t.surfaceAt(px, pz), 'green', `${h.name} pin on its green`);
    const sl = t.slopeAt(px, pz, 1); assert.ok(Math.hypot(sl.x, sl.z) <= 0.031, `${h.name} pin ${(Math.hypot(sl.x, sl.z) * 100).toFixed(1)}%`);
  });
});

test('nothing overhead within 45 m of any tee (the ice cave roof over the 1st is higher)', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: solid ${y} m up`); }
  });
  const t = T[0], [x, z] = HOLES[0].tees.mammoth, g = t.groundAt(x, z);
  let roof = false; for (let y = 45; y < 70; y += 1) if (t.solidAt(x, g + y, z)) roof = true;
  assert.ok(roof, 'the ice cave has a roof over the back tee');
});

test('every target is on fairway', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
});

test('a tour drive from the back tee at the first target hits nothing in the air', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(T[i], h.tees.mammoth, [tg.x, tg.z], DR));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('bunkers: black sand by the greens, powder out in the fairways', () => {
  const kinds = new Set();
  HOLES.forEach((h, i) => { for (const b of h.bunkers) { const s = T[i].surfaceAt(b.x, b.z); if (s === 'sand' || s === 'powder') kinds.add(s); } });
  assert.ok(kinds.has('sand') && kinds.has('powder'), [...kinds].join(','));
});

test('the moulin on the 7th is open air; the lake on the 3rd is ice with open water short of the green', () => {
  const i7 = HOLES.findIndex(h => h.name === 'The Moulin'), t7 = T[i7];
  let air = 0; for (let s = 200; s < 360; s += 4) for (let off = -60; off <= 80; off += 4) { const [x, z] = at(HOLES[i7].line, s, off); if (t7.groundAt(x, z) === null) air++; }
  assert.ok(air > 20, `the moulin opens (${air} points of open air)`);
  const i3 = HOLES.findIndex(h => h.name === 'The Longship'), t3 = T[i3], L = HOLES[i3].line;
  const seen = new Set(); for (let s = 40; s < 140; s += 2) for (let off = -30; off <= 40; off += 2) seen.add(t3.surfaceAt(...at(L, s, off)));
  assert.ok(seen.has('ice') && seen.has('water'), [...seen].join(','));
});

test('lake ice runs: a ball rolls a long way on it', () => {
  const i3 = HOLES.findIndex(h => h.name === 'The Longship'), t3 = T[i3];
  let from = null; for (let s = 50; s < 110 && !from; s += 2) for (let off = -30; off <= 0 && !from; off += 2) { const p = at(HOLES[i3].line, s, off); if (t3.surfaceAt(...p) === 'ice') from = p; }
  assert.ok(from, 'found the ice');
  const pts = shoot(t3, from, [from[0], from[1] - 50], { Speed: 15, VLA: 2, TotalSpin: 200 }, () => 'ice');
  const last = pts.at(-1), roll = Math.hypot(last.x - from[0], last.z - from[1]);
  const pts2 = shoot(t3, from, [from[0], from[1] - 50], { Speed: 15, VLA: 2, TotalSpin: 200 }, () => 'fairway');
  const roll2 = Math.hypot(pts2.at(-1).x - from[0], pts2.at(-1).z - from[1]);
  assert.ok(roll > roll2 * 1.5, `ice ${roll.toFixed(1)} m vs fairway ${roll2.toFixed(1)} m`);
});
