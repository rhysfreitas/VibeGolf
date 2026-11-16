// Cloudrest (blockout): the sampled gorge, the course data, and the ball on the cliffs: open air down to the mist, the
// walls that soak, the kerbs, thin air and damp turf, the Needle, the Broken Ridge and its notch, the Stair's face
// and ramp, the alcove's roof, the tea terraces and the Descent's tiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES, COURSE } from '../src/course/cloudrest.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const H = name => HOLES.findIndex(h => h.name === name);
const lenOf = L => L.reduce((a, p, k) => k ? a + Math.hypot(p[0] - L[k - 1][0], p[1] - L[k - 1][1]) : 0, 0);
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
const phys = s => s === 'tee' || s === 'fringe' || s === 'fairway' ? 'damp' : s === 'void' ? 'rough' : s;   // COURSE.turf 'damp'
// fly a shot from a spot straight at a point, with the rocks and the walls solid, at 8,500 ft
function shoot(i, from, to, shot, { rng = () => 0.99 } = {}) {
  const t = T[i], o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))),
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && Object.assign([n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c], n.soak ? { soak: n.soak } : {}); },
    voidY: t.voidY - o.y, altFt: COURSE.altFt, wallSoak: COURSE.wallSoak, rng,
  });
  return { r, pts: r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase })) };
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const BACK = COURSE.teeSets[0].id;

test('nine holes, par 36 (4 3 5 3 4 5 3 5 4), the gorge with four tee sets, thin air, damp turf, walls that soak', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [4, 3, 5, 3, 4, 5, 3, 5, 4]);
  assert.equal(COURSE.theme, 'cloud');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['summit', 'ridge', 'ledge', 'terrace']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.summit, 0), 3690);
  assert.equal(COURSE.altFt, 8500); assert.equal(COURSE.turf, 'damp'); assert.equal(COURSE.wallSoak, 0.45);
  const sea = simulate({ ...DR, HLA: 0, SpinAxis: 0 }, { groundAt: () => 0, flightOnly: true }).carry, here = simulate({ ...DR, HLA: 0, SpinAxis: 0 }, { groundAt: () => 0, flightOnly: true, altFt: COURSE.altFt }).carry;
  assert.ok(here / sea > 1.1 && here / sea < 1.15, `a tour drive carries ${((here / sea - 1) * 100).toFixed(0)}% further`);
});

test('the tips tee (Pinnacle) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'pinnacle' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  HOLES.forEach((h, i) => {
    assert.ok(h.tips.yards > h.yards[BACK], `${h.name} has a tips spot behind the back tee`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    assert.ok(T[i].groundAt(...h.tips.tee) !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
  });
});

test('card yardages: down the line from the back tee, straight to the pin on the par 3s', () => {
  HOLES.forEach(h => {
    const [tx, tz] = h.tees[BACK];
    if (h.par === 3) { const d = Math.hypot(tx - h.pin[0], tz - h.pin[1]) / 0.9144; assert.ok(Math.abs(d - h.yards[BACK]) < 4, `${h.name}: ${d.toFixed(0)} vs ${h.yards[BACK]}`); return; }
    const len = lenOf(h.line), [ax, az] = h.line[0], [bx, bz] = h.line[1], l = Math.hypot(bx - ax, bz - az), s = ((tx - ax) * (bx - ax) + (tz - az) * (bz - az)) / l;
    assert.ok(Math.abs((len - s) / 0.9144 - h.yards[BACK]) < 4, `${h.name}: ${((len - s) / 0.9144).toFixed(0)} vs ${h.yards[BACK]}`);
  });
});

test('every tee is on a pad, every pin on its green at 3% or less', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) {
      assert.ok(t.groundAt(x, z) !== null, `${h.name} ${id} tee on ground`);
      assert.equal(t.surfaceAt(x, z), 'tee', `${h.name} ${id} is a tee pad`);
    }
    const [px, pz] = h.pin;
    assert.equal(t.surfaceAt(px, pz), 'green', `${h.name} pin on its green`);
    const sl = t.slopeAt(px, pz, 1); assert.ok(Math.hypot(sl.x, sl.z) <= 0.031, `${h.name} pin ${(Math.hypot(sl.x, sl.z) * 100).toFixed(1)}%`);
  });
});

test('nothing overhead within 45 m of any tee; the alcove\'s roof 80 m or more over the 7th, and solid', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: rock ${y} m up`); }
  });
  const i = H('The Alcove'), h = HOLES[i], [x, z] = h.tees[BACK], g = T[i].groundAt(x, z);
  let roof = null; for (let y = 45; y < 140 && roof === null; y += 1) if (T[i].solidAt(x, g + y, z)) roof = y;
  assert.ok(roof !== null && roof >= 80, `the roof over the Summit tee (${roof} m up)`);
  const pts = flown(shoot(i, h.tees[BACK], h.pin, { Speed: 150, VLA: 35, TotalSpin: 4500 }).pts);
  assert.ok(Math.max(...pts.map(p => p.y - g)) < roof + 2, 'a skied driver goes no higher than the roof');
});

test('every target is on fairway; the decisions: over the notch (5), the high road (8), the green (9)', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [5, 8, 9]);
  assert.ok(HOLES[H('The Descent')].targets.find(t => t.pin).bold, 'the 9th: driver at the green');
});

test('a tee shot from the back tee at the first target (driver, or a fairway wood to a lay-up) hits nothing in the air and finishes on ground', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), d = Math.hypot(tg.x - h.tees[BACK][0], tg.z - h.tees[BACK][1]);
    const { r, pts } = shoot(i, h.tees[BACK], [tg.x, tg.z], d < 235 ? { Speed: 140, VLA: 11.5, TotalSpin: 3800 } : DR);   // the 5th lays up short of the notch
    assert.ok(!flown(pts).some(p => p.hit), `${h.name}: the drive hit something`);
    assert.notEqual(r.outcome, 'void', `${h.name}: the drive went into the mist`);
  });
});

test('the mist: open air past the outer edges and in the cleft; a ball that flies the kerb is gone, one that only runs stops', () => {
  const two = H('The Balcony'), h2 = HOLES[two];
  const [tx, tz] = h2.tees[BACK], d = Math.hypot(h2.pin[0] - tx, h2.pin[1] - tz);
  let air = 0; for (let k = 10; k < 90; k++) if (T[two].groundAt(tx + (h2.pin[0] - tx) * k / 100, tz + (h2.pin[1] - tz) * k / 100) === null) air++;
  assert.ok(air > 40, `the 2nd crosses the cleft (${air} of 80 points over open air)`);
  // the 1st: balls rolled toward the left edge at 4-12 m/s stop at the kerb
  const one = 0, h1 = HOLES[one];
  for (const v of [4, 8, 12]) for (const s of [200, 280]) {
    let o = -10; while (o > -90 && T[one].surfaceAt(...at(h1.line, s, o)) !== 'desert' && T[one].groundAt(...at(h1.line, s, o)) !== null) o -= 1;
    const from = at(h1.line, s, o + 14), to = at(h1.line, s, o - 40), { r } = shoot(one, from, to, { Speed: v / 0.44704, VLA: 0.2, TotalSpin: 200 });
    assert.notEqual(r.outcome, 'void', `a ball rolled at ${v} m/s from 14 m stops before the mist (s ${s})`);
  }
  // and a drive hooked hard left on the 1st carries over it into the mist
  const { r } = shoot(one, h1.tees[BACK], at(h1.line, 240, -95), DR);
  assert.equal(r.outcome, 'void', 'a drive that flies the edge is in the mist');
});

test('the wall gives: drives into the 1st\'s cliff drop at its foot about half the time, otherwise come back; none go to the mist', () => {
  const i = 0, h = HOLES[i];
  let hit = 0, foot = 0, mist = 0;
  for (let k = 0; k < 24; k++) {
    let q = 99991 + k * 7919; const rng = () => { q = (q + 0x6D2B79F5) | 0; let r = Math.imul(q ^ (q >>> 15), 1 | q); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };   // mulberry32
    const { r, pts } = shoot(i, at(h.line, 40), at(h.line, 200, 55 + (k % 5) * 3), { Speed: 150, VLA: 12, TotalSpin: 3000 }, { rng });
    if (r.outcome === 'void') { mist++; continue; }
    if (!r.rockHits) continue; hit++;
    const end = pts.at(-1), g0 = T[i].groundAt(end.x, end.z); let near = false;
    for (let a = 0; a < 6.28 && !near; a += 0.39) for (let d = 1; d <= 10 && !near; d += 1) { const g = T[i].groundAt(end.x + Math.cos(a) * d, end.z + Math.sin(a) * d); if (g !== null && g > g0 + 8) near = true; }
    if (near) foot++;   // within 10 m of the face
  }
  assert.equal(mist, 0, 'none into the mist');
  assert.ok(hit >= 15, `the drives hit the wall (${hit} of 24)`);
  assert.ok(foot >= 3 && foot <= hit - 2, `some drop at its foot, some come back (${foot} of ${hit})`);
});

test('the Needle: a green on a pillar ringed by open air, 18 m below the tee; a short iron finds it', () => {
  const i = H('The Needle'), h = HOLES[i], t = T[i], g = t.groundAt(...h.pin);
  assert.ok(t.groundAt(...h.tees[BACK]) - g > 15, 'the drop');
  let ring = 0; for (let a = 0; a < 6.28; a += 0.4) if (t.groundAt(h.pin[0] + Math.cos(a) * 34, h.pin[1] + Math.sin(a) * 34) === null) ring++;
  assert.ok(ring >= 10, `open air round the pillar but for the ridge's root (${ring} of 16)`);
  const { r, pts } = shoot(i, h.tees[BACK], h.pin, { Speed: 98, VLA: 22, TotalSpin: 8000 });
  const end = pts.at(-1);
  assert.notEqual(r.outcome, 'void', 'a short iron stays on the pillar');
  assert.ok(Math.hypot(end.x - h.pin[0], end.z - h.pin[1]) < 25, `and finishes by the flag (${Math.hypot(end.x - h.pin[0], end.z - h.pin[1]).toFixed(0)} m off)`);
});

test('the Broken Ridge: open air both sides of the crest, the notch 9 m deep across it, the catch shelf below its north side', () => {
  const i = H('The Broken Ridge'), h = HOLES[i], t = T[i];
  for (const s of [150, 350]) { assert.equal(t.groundAt(...at(h.line, s, 75)), null, `open air right at ${s} m`); assert.equal(t.groundAt(...at(h.line, s, -85)), null, `open air left at ${s} m`); }
  const crest = t.groundAt(...at(h.line, 230)), notch = t.groundAt(...at(h.line, 258));
  assert.ok(crest - notch > 7, `the notch ${(crest - notch).toFixed(1)} m deep`);
  const shelf = t.groundAt(...at(h.line, 180, -40));
  assert.ok(shelf !== null && t.groundAt(...at(h.line, 180)) - shelf > 5, 'the catch shelf below the crest on the left');
});

test('the Stair: a 9 m face across the shelf, a grass ramp up it on the line', () => {
  const i = H('The Stair'), h = HOLES[i], t = T[i];
  const face = t.groundAt(...at(h.line, 280, 22)) - t.groundAt(...at(h.line, 260, 22));
  assert.ok(face > 7, `the face beside the ramp rises ${face.toFixed(1)} m`);
  let steep = 0; for (let s = 248; s < 300; s += 2) steep = Math.max(steep, (t.groundAt(...at(h.line, s + 2)) - t.groundAt(...at(h.line, s))) / 2);
  assert.ok(steep < 0.36, `the ramp is ${Math.round(steep * 100)}% at its steepest`);
});

test('the tea terraces: the upper terrace 5 m over the lower, the pond under the wall', () => {
  const i = H('The Tea Terraces'), h = HOLES[i], t = T[i];
  const up = h.targets.find(q => q.bold), lo = h.targets.find(q => q.name === 'The lower terrace');
  assert.ok(t.groundAt(up.x, up.z) - t.groundAt(lo.x, lo.z) > 3.5, 'the high road is up a terrace');
  let wet = 0; const F = h.field; for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 3) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 3) if (t.surfaceAt(x, z) === 'water') wet++;
  assert.ok(wet > 15, 'the pond');
});

test('the Descent: three tiers 45 m down to the courtyard, no sand by the green, the courtyard paved', () => {
  const i = H('The Descent'), h = HOLES[i], t = T[i];
  const tee = t.groundAt(...h.tees[BACK]), green = t.groundAt(...h.pin);
  assert.ok(tee - green > 40, `${(tee - green).toFixed(0)} m down`);
  assert.equal(h.bunkers.length, 0);
  const t1 = h.targets[0], t2 = h.targets[1];
  assert.ok(tee - t.groundAt(t1.x, t1.z) > 12 && t.groundAt(t1.x, t1.z) - t.groundAt(t2.x, t2.z) > 12, 'each tier a step down');
});
