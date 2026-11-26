// Emerald Bay (blockout): the sampled bay, the course data, the tide (COURSE.rolls, the versions of 3, 5 and 9, water
// wherever the ground is below the round's sea), the sand that always plays, the sea cave's roof and the overhang.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { applyPicks } from '../src/course/versions.js';
import { HOLES, COURSE } from '../src/course/emeraldbay.js';

const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const BACK = COURSE.teeSets[0].id;
const TIDES = ['low', 'high'];
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
const phys = s => (s === 'tee' || s === 'fringe' || s === 'fairway' ? 'fairway' : s);
// the holes at a tide, each with its terrain
function atTide(tide) { applyPicks(COURSE, HOLES, { tide }); return HOLES.map(h => ({ h, T: createTerrain(h) })); }
function shoot(t, from, to, shot) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))),
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && Object.assign([n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c], n.soak ? { soak: n.soak } : {}); },
    voidY: t.voidY - o.y, wallSoak: COURSE.wallSoak, rng: () => 0.99,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}

test('nine holes, par 36 (5 3 3 5 4 4 4 3 5), four tee sets, cliffs that soak, a tide rolled each round', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [5, 3, 3, 5, 4, 4, 4, 3, 5]);
  assert.equal(COURSE.theme, 'bay'); assert.equal(COURSE.wallSoak, 0.45); assert.equal(COURSE.altFt, 0);
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['marlin', 'manta', 'turtle', 'clownfish']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.deepEqual(COURSE.rolls.map(r => r.id), ['tide']);
  assert.deepEqual(COURSE.rolls[0].options.map(o => [o.id, o.sea]), [['low', 0], ['high', 2.4]]);
  assert.deepEqual(HOLES.filter(h => h.versions).map(h => h.n), [3, 5, 9], 'the tide holes');
  for (const h of HOLES.filter(h => h.versions)) { assert.equal(h.versionBy, 'tide'); assert.deepEqual(h.versions.map(v => v.id), ['low', 'high']); }
  atTide('low'); assert.equal(HOLES.reduce((a, h) => a + h.yards[BACK], 0), 3315);
  atTide('high'); assert.equal(HOLES.reduce((a, h) => a + h.yards[BACK], 0), 3315, 'the card is the same at both tides');
});

test('the tips tee (Shark) is in the data and switched off', () => {
  for (const tide of TIDES) {
    atTide(tide).forEach(({ h, T }) => {
      assert.ok(COURSE.tipsSet.id === 'shark' && !COURSE.teeSets.some(s => s.id === 'shark'));
      assert.ok(h.tips.yards > h.yards[BACK], `${h.name} tips behind the back tee`);
      assert.ok(!('shark' in h.tees) && !('shark' in h.yards));
      assert.ok(!['fairway', 'green', 'water'].includes(T.surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T.surfaceAt(...h.tips.tee)} at ${tide} tide`);
    });
  }
});

test('tees, pins and targets at both tides: tees dry, pins on the green at 3% or less, targets on fairway, nothing overhead', () => {
  for (const tide of TIDES) {
    atTide(tide).forEach(({ h, T }) => {
      for (const [k, p] of Object.entries(h.tees)) {
        assert.equal(T.surfaceAt(...p), 'tee', `${h.name} ${k} at ${tide} tide`);
        const g = T.groundAt(...p); for (let y = 1; y < 45; y += 2) assert.ok(!T.solidAt(p[0], g + y, p[1]), `${h.name} ${k}: rock ${y} m over the tee`);
      }
      assert.equal(T.surfaceAt(...h.pin), 'green', `${h.name} pin`);
      const s = T.slopeAt(...h.pin); assert.ok(Math.hypot(s.x, s.z) <= 0.03, `${h.name} pin slope ${(Math.hypot(s.x, s.z) * 100).toFixed(1)}%`);
      for (const t of h.targets.filter(q => !q.pin)) assert.equal(T.surfaceAt(t.x, t.z), 'fairway', `${h.name}: ${t.name} at ${tide} tide`);
      assert.ok(h.targets.some(q => q.pin), `${h.name} has the green as a target`);
    });
  }
});

test('the tide: the sea level from the roll; ground below it plays as water', () => {
  const lo = atTide('low').map(({ h, T }) => ({ sea: h.sea, base: h.frame.base, T, h })), hi = atTide('high').map(({ h, T }) => ({ sea: h.sea, T, h }));
  lo.forEach((o, i) => { assert.ok(Math.abs(o.sea - (0 - o.base)) < 1e-9); assert.ok(Math.abs(hi[i].sea - o.sea - 2.4) < 1e-9); });
  // the 3rd: low tide, wet sand on the line (the tongue) you can land on and run up; high tide, all carry
  const L3 = lo[2].h.line, back = lo[2].h.tees[BACK], pin = lo[2].h.pin, n = Math.round(Math.hypot(pin[0] - back[0], pin[1] - back[1]));
  let beachLo = 0, wetHi = 0;
  for (let s = 0; s < n; s++) { const x = back[0] + (pin[0] - back[0]) * s / n, z = back[1] + (pin[1] - back[1]) * s / n; if (lo[2].T.surfaceAt(x, z) === 'beach') beachLo++; if (hi[2].T.surfaceAt(x, z) === 'water') wetHi++; }
  assert.ok(beachLo > 40, `the tongue: ${beachLo} m of wet sand on the line at low tide`);
  assert.ok(wetHi > 110, `at high tide ${wetHi} m of the line is water`);
  // every cell between the tides is wet sand or the like at low tide and water at high
  let changed = 0;
  for (let i = 0; i < 9; i++) { const { T: Tl } = lo[i], { T: Th } = hi[i], F = HOLES[i].field;
    for (let k = 0; k < 400; k++) { const x = F.x0 + ((k * 7919) % F.nx) * F.cell, z = F.z0 + ((k * 104729) % F.nz) * F.cell, g = Tl.groundAt(x, z);
      if (g < lo[i].sea - 0.2) { assert.equal(Tl.surfaceAt(x, z), 'water'); assert.equal(Th.surfaceAt(x, z), 'water'); }
      else if (g > lo[i].sea + 0.2 && g < hi[i].sea - 0.2 && Tl.surfaceAt(x, z) !== 'green') { assert.equal(Th.surfaceAt(x, z), 'water', `${HOLES[i].name} ${x},${z}`); changed++; } } }
  assert.ok(changed > 50, `${changed} sampled cells change with the tide`);
  // the 9th's island fairway: out of the water at low tide (the bold target), under the sea at high
  const isl = HOLES[8].versions.find(v => v.id === 'low').targets.find(t => t.name === 'The island');
  assert.ok(isl && isl.bold); assert.equal(lo[8].T.surfaceAt(isl.x, isl.z), 'fairway'); assert.equal(hi[8].T.surfaceAt(isl.x, isl.z), 'water');
  const hiT = HOLES[8].versions.find(v => v.id === 'high').targets;
  assert.ok(!hiT.some(t => t.name === 'The island'), 'no island target at high tide');
  assert.deepEqual(hiT.filter(t => !t.pin).map(t => t.name), ['The right fairway', 'The intermediate fairway', "The cave's mouth"], 'three shots at high tide');
});

test('sand always plays: dry sand as a waste area, wet sand as a firm beach, bunkers as sand', () => {
  const W = atTide('low');
  const count = { waste: 0, beach: 0, sand: 0 };
  for (const { h, T } of W) { const F = h.field; for (let j = 0; j < F.nz; j += 3) for (let i = 0; i < F.nx; i += 3) { const s = T.surfaceAt(F.x0 + i * F.cell, F.z0 + j * F.cell); if (s in count) count[s]++; } }
  for (const k of Object.keys(count)) assert.ok(count[k] > 20, `${k}: ${count[k]}`);
  for (const { h } of W) for (const b of h.bunkers) assert.equal(b.lie, 'sand');
});

test("the sea cave's roof over the 9th and the 7th's overhang are solid, with room under them", () => {
  const W = atTide('low');
  for (const [i, what] of [[8, "the sea cave's roof"], [6, 'the overhang']]) {
    const { T, h } = W[i], slabs = h.rocks.filter(r => r.what === what);
    assert.ok(slabs.length > 20, `${h.name}: ${slabs.length} slabs`);
    const R = slabs.reduce((a, r) => (r.y > a.y ? r : a));   // the highest underside: open ground under it
    assert.ok(T.solidAt(R.x, R.y + 2, R.z), `${what} solid`);
    const g = T.groundAt(R.x, R.z); assert.ok(R.y - g > 20, `${what}: ${(R.y - g).toFixed(0)} m of room`);
    assert.ok(!T.solidAt(R.x, g + 10, R.z), 'room under it');
  }
  // down the middle of the cave (within 12 m of the line) the roof is 30 m or more over the floor
  // the cave is on the line's last leg
  const L = W[8].h.line, [a, b] = [L[2], L[3]], dLine = r => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((r.x - a[0]) * dx + (r.z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(r.x - a[0] - dx * t, r.z - a[1] - dz * t); };
  const mid = W[8].h.rocks.filter(r => r.what === "the sea cave's roof" && dLine(r) < 12), lowest = Math.min(...mid.map(r => r.y - W[8].T.groundAt(r.x, r.z)));
  assert.ok(mid.length > 4 && lowest > 30, `the cave's roof at least ${lowest.toFixed(0)} m up down the middle`);
});

const IRON6 = { Speed: 127, VLA: 14.1, TotalSpin: 6231 };   // a tour 6 iron, about 183 yd carry
test('the club for the first target from the back tee (a tour drive, or a 6 iron to a short lay-up) hits nothing in the air, at either tide', () => {
  for (const tide of TIDES) {
    atTide(tide).forEach(({ h, T }) => {
      if (h.par === 3) return;
      const t0 = h.targets.find(q => !q.pin), to = [t0.x, t0.z], tee = h.tees[BACK];
      const far = Math.hypot(to[0] - tee[0], to[1] - tee[1]) > 190;
      const pts = shoot(T, tee, to, far ? DR : IRON6), hit = pts.find(p => p.phase === 'flight' && p.hit);
      assert.ok(!hit, `${h.name} at ${tide} tide: hit at ${hit && hit.x.toFixed(0)},${hit && hit.z.toFixed(0)}`);
    });
  }
});

test("the 7th: a driver blasted straight through the corner flies on under the cliff and hits the overhang", () => {
  const { h, T } = atTide('low')[6], t0 = h.targets.find(q => !q.pin);
  const pts = shoot(T, h.tees[BACK], [t0.x, t0.z], DR), hit = pts.find(p => p.phase === 'flight' && p.hit);
  assert.ok(hit && hit.y - T.groundAt(hit.x, hit.z) > 8, 'it hits the rock overhead, not the ground');
});

test("the 9th: water all round the island fairway at low tide; from the island's far part the flag is in sight through the cave", () => {
  const { h, T } = atTide('low')[8], isl = h.targets.find(t => t.name === 'The island');
  // walk out from the island in 24 directions: fairway, then sand or rough, then water before any other land
  for (let k = 0; k < 24; k++) {
    const a = k * Math.PI / 12; let seen = 'fairway', wet = false;
    for (let r = 2; r < 140; r += 1) { const s = T.surfaceAt(isl.x + Math.cos(a) * r, isl.z + Math.sin(a) * r); if (s === 'water') { wet = true; break; } if (s === 'fairway' && seen !== 'fairway') break; if (s !== 'fairway') seen = s; }
    assert.ok(wet, `water off the island toward ${(a * 180 / Math.PI).toFixed(0)}°`);
  }
  // the pin is in sight from the bold target (nothing of the ground or the roof across the line)
  const g0 = T.groundAt(isl.x, isl.z) + 1.6, p = h.pin, g1 = T.groundAt(...p) + 2.2, L = Math.hypot(p[0] - isl.x, p[1] - isl.z);
  for (let s = 3; s < L - 3; s++) { const t = s / L, x = isl.x + (p[0] - isl.x) * t, z = isl.z + (p[1] - isl.z) * t, y = g0 + (g1 - g0) * t; assert.ok(T.groundAt(x, z) < y && !T.solidAt(x, y, z), `the line to the flag blocked ${s} m out`); }
});

test("the 9th: from anywhere on the cave beach's fairway there is a clear shot, at the pin or into the cave's mouth", async () => {
  const { makePlayer } = await import('../tools/review/play.mjs');
  const { clear } = makePlayer(COURSE), { h, T } = atTide('low')[8], mouth = h.targets.find(t => t.name === "The cave's mouth"), inter = h.targets.find(t => t.name === 'The intermediate fairway');
  let n = 0;
  for (let z = inter.z - 45; z <= inter.z + 45; z += 4) for (let x = inter.x - 60; x <= inter.x + 50; x += 4) {
    if (T.surfaceAt(x, z) !== 'fairway' || Math.hypot(x - mouth.x, z - mouth.z) < 25) continue;
    const o = { x, z, y: T.groundAt(x, z) }; n++;
    assert.ok(clear(T, o, ...h.pin) || clear(T, o, mouth.x, mouth.z), `no way on from ${x},${z}`);
  }
  assert.ok(n > 80, `${n} spots`);
});
