// Emberfell (blockout): the sampled volcano, the course data, and the ball against the lava and the rock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES, COURSE } from '../src/course/emberfell.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const SEVEN = { Speed: 120, VLA: 16.3, TotalSpin: 7097 };
const H = name => HOLES.findIndex(h => h.name === name);
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
// fly a shot from a spot straight at a point, with the boulders, lava trees and the clubhouse solid
function shoot(t, from, to, shot) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => { const sf = t.surfaceAt(wx(lx, lz), wz(lx, lz)); return sf === 'tee' || sf === 'fringe' ? 'fairway' : sf === 'void' ? 'rough' : sf; },
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt: COURSE.altFt, rand: () => 0.99,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const BACK = COURSE.teeSets[0].id;

test('nine holes, par 36 (5 4 4 3 4 5 4 3 4), an ember theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [5, 4, 4, 3, 4, 5, 4, 3, 4]);
  assert.equal(COURSE.theme, 'ember');
  assert.equal(COURSE.teeSets.length, 4);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
});

test('the tips tee is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'magma' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  HOLES.forEach((h, i) => {
    assert.ok(h.tips && h.tips.tee.length === 2 && h.tips.yards > h.yards[BACK], `${h.name} has a tips spot behind the back tee`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    const g = T[i].groundAt(...h.tips.tee); assert.ok(g !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
  });
});

test('card yardages are measured down the line from the back tee', () => {
  HOLES.forEach(h => {
    let len = 0; for (let i = 1; i < h.line.length; i++) len += Math.hypot(h.line[i][0] - h.line[i - 1][0], h.line[i][1] - h.line[i - 1][1]);
    const [tx, tz] = h.tees[BACK], [ax, az] = h.line[0], [bx, bz] = h.line[1], l = Math.hypot(bx - ax, bz - az), s = ((tx - ax) * (bx - ax) + (tz - az) * (bz - az)) / l;
    assert.ok(Math.abs((len - s) / 0.9144 - h.yards[BACK]) < 4, `${h.name}: ${((len - s) / 0.9144).toFixed(0)} vs ${h.yards[BACK]}`);
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

test('nothing overhead within 45 m of any tee', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: solid ${y} m up`); }
  });
});

test('every target is on fairway, and the bold ones are marked', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.ok(HOLES.filter(h => h.targets.some(t => t.bold)).length >= 2, 'decision holes carry a bold target');
});

test('a tour drive from the back tee at the first target hits nothing in the air', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(T[i], h.tees[BACK], [tg.x, tg.z], DR));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('bunkers: ash-grey sand by the greens, red scoria out in the fairways', () => {
  const kinds = new Set();
  HOLES.forEach((h, i) => { for (const b of h.bunkers) { const s = T[i].surfaceAt(b.x, b.z); if (s === 'sand' || s === 'waste') kinds.add(s); } });
  assert.ok(kinds.has('sand') && kinds.has('waste'), [...kinds].join(','));
});

test('lava plays as water: the lake by the 9th, the Terraces\' pool, the lavafall\'s pool and the 1st\'s river', () => {
  const lavaNear = (i, test) => { const F = HOLES[i].field; for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) if (test(x, z) && T[i].surfaceAt(x, z) === 'water') return true; return false; };
  const heart = H('The Heart'), terr = H('The Terraces'), fall = H('The Lavafall'), kip = H('Kipuka');
  assert.ok(lavaNear(heart, () => true), 'the lava lake by the 9th');
  // the Terraces' pool (round 7: grown, a tongue running on toward the green) lies right of the bold line, short of the green
  const L5 = HOLES[terr], pin = L5.pin;
  assert.ok(lavaNear(terr, (x, z) => { const t = (x * pin[0] + z * pin[1]) / (pin[0] ** 2 + pin[1] ** 2), off = (x * pin[1] - z * pin[0]) / Math.hypot(...pin); return t > 0.45 && t < 0.85 && Math.abs(off) < 30; }), 'the pool lies along the bold line');
  assert.notEqual(T[terr].surfaceAt(...pin), 'water');
  assert.ok(lavaNear(fall, () => true), 'the lavafall\'s pool or its overflow');
  const L1 = HOLES[kip]; assert.ok(lavaNear(kip, (x, z) => x > 30), 'the lava river right of the 1st');
  // the lava's surface is level and flat across the lake
  const F = HOLES[heart]; let ys = [];
  for (let z = F.field.z0; z < F.field.z0 + F.field.nz * 2; z += 6) for (let x = F.field.x0; x < F.field.x0 + F.field.nx * 2; x += 6) if (T[heart].surfaceAt(x, z) === 'water') { const g = T[heart].groundAt(x, z); if (g !== null) ys.push(g); }
  ys.sort((a, b) => a - b); assert.ok(ys.length > 50 && ys[Math.floor(ys.length * 0.9)] - ys[Math.floor(ys.length * 0.1)] < 1.5, 'the lake is level');
});

test('the Lava Tube: its trench is open air, the bridge carries the line, and the channel is a fairway of its own', () => {
  const i = H('The Lava Tube'), h = HOLES[i], t = T[i];
  let open = 0; const F = h.field;
  for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 3) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 3) if (t.groundAt(x, z) === null) open++;
  assert.ok(open > 100, `the trench is open air (${open} samples)`);
  // the line crosses the trench at the bridge: solid ground every metre of it
  let bridge = true; for (let s = 270; s < 315; s += 1) { const p = at(h.line, s); if (t.groundAt(...p) === null) bridge = false; }
  assert.ok(bridge, 'the bridge carries the line');
  const ch = h.targets.find(q => q.name === 'The channel'); assert.ok(ch && t.surfaceAt(ch.x, ch.z) === 'fairway', 'the channel fairway');
  assert.ok(!h.targets.some(q => q.bold), 'not a decision hole (Rhys, round 6): no bold target');
});

test('the clubhouse on the island is solid; a 7 iron at the 9th green flies clear of it', () => {
  const i = H('The Heart'), h = HOLES[i], t = T[i], hall = h.rocks.find(r => r.type === 'box' && r.soak === 0.45);
  assert.ok(hall, 'the clubhouse');
  const g = t.groundAt(hall.x, hall.z); assert.ok(t.solidAt(hall.x, g + 2, hall.z), 'solid');
  const from = at(h.line, Math.max(0, (h.line.reduce((a, p, k) => k ? a + Math.hypot(p[0] - h.line[k - 1][0], p[1] - h.line[k - 1][1]) : 0, 0)) - 140));
  const pts = flown(shoot(t, from, h.pin, SEVEN)); assert.ok(!pts.some(p => p.hit), 'clear of the clubhouse');
});
