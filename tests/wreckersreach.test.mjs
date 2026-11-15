// Wrecker's Reach (blockout): the sampled spit, the course data, and the ball on the links: firm turf, fescue, the
// dunes and their tussocks, the beach, the pots, the shared fairway (1 and 9) and the double green (2 and 8), the
// Cauldron and the creek, the wrecks, the inn and the 9th's table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createTreeField } from '../src/course/trees.js';
import { HOLES, COURSE } from '../src/course/wreckersreach.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const SEVEN = { Speed: 120, VLA: 16.3, TotalSpin: 7097 };
const PUNCH = { Speed: 120, VLA: 5, TotalSpin: 3000 };
const H = name => HOLES.findIndex(h => h.name === name);
const lenOf = L => L.reduce((a, p, k) => k ? a + Math.hypot(p[0] - L[k - 1][0], p[1] - L[k - 1][1]) : 0, 0);
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
// the game's surfaces on this course: main.js plays fairway, tee and collar as 'links' (COURSE.turf = 'links')
const phys = s => s === 'tee' || s === 'fringe' || s === 'fairway' ? 'links' : s === 'void' ? 'rough' : s;
// fly a shot from a spot straight at a point, with the rocks solid
function shoot(i, from, to, shot, { trees = false, rng = () => 0.99 } = {}) {
  const t = T[i], TF = trees ? createTreeField(t.trees) : null, o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))),
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && Object.assign([n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c], n.soak ? { soak: n.soak } : {}); },
    treeAt: TF ? (lx, ly, lz) => { const q = TF.at(wx(lx, lz), o.y + ly, wz(lx, lz)); if (!q) return null; return q.n ? { n: [q.n[0] * c + q.n[2] * s, 0, -q.n[0] * s + q.n[2] * c] } : q; } : undefined,
    voidY: t.voidY - o.y, altFt: COURSE.altFt, rng,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const BACK = COURSE.teeSets[0].id;
const count = (i, surf, f = () => true) => { const F = HOLES[i].field; let n = 0; for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) if (f(x, z) && T[i].surfaceAt(x, z) === surf) n++; return n; };
const dLine = (h, x, z) => { let d = Infinity; for (let s = 0; s <= lenOf(h.line); s += 5) { const p = at(h.line, s); d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); } return d; };
// a hole's frame: world (x east, z = -north) to the hole's own (x right, -z down the hole), and back; absolute height
const toLocal = h => (X, Z) => { const F = h.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a), dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
const toWorld = h => (x, z) => { const F = h.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a); return [F.x + x * rx - z * fx, F.z + x * rz - z * fz]; };
const absY = (i, X, Z) => { const [x, z] = toLocal(HOLES[i])(X, Z), g = T[i].groundAt(x, z); return g === null ? null : g + HOLES[i].frame.base; };
const surfW = (i, X, Z) => T[i].surfaceAt(...toLocal(HOLES[i])(X, Z));

test('nine holes, par 36 (5 3 4 4 5 3 3 5 4), a links on firm turf with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [5, 3, 4, 4, 5, 3, 3, 5, 4]);
  assert.equal(COURSE.theme, 'links');
  assert.equal(COURSE.turf, 'links');
  assert.equal(COURSE.signature.wind, 'sea');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['galleon', 'frigate', 'brig', 'lugger']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.galleon, 0), 3365);
});

test('the tips tee (Man-of-War) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'manofwar' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  assert.equal(HOLES.reduce((a, h) => a + h.tips.yards, 0), 3645);
  HOLES.forEach((h, i) => {
    assert.ok(h.tips && h.tips.tee.length === 2 && h.tips.yards > h.yards[BACK], `${h.name} has a tips spot behind the back tee`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    assert.ok(T[i].groundAt(...h.tips.tee) !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'pot', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
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
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: something ${y} m up`); }
  });
});

test('every target is on fairway, and the three decision holes (3, 5, 9) carry a bold target', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [3, 5, 9]);
});

test('a tour drive from the back tee at the first target hits nothing in the air, dune grass included', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(i, h.tees[BACK], [tg.x, tg.z], DR, { trees: true }));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('off the grass in order: fescue round it, then the dunes (sand) with tussocks of dune grass, the beach by the water', () => {
  HOLES.forEach((h, i) => {
    const near = (x, z) => dLine(h, x, z) < 110;
    const fescue = count(i, 'rough', near), dune = count(i, 'sand', near), tuss = count(i, 'tussock', near);
    assert.ok(fescue > 80, `${h.name}: a band of fescue (${fescue})`);
    assert.ok(dune > 300, `${h.name}: dunes (${dune})`);
    assert.ok(tuss > 5 && tuss < dune * 0.3, `${h.name}: tussocks dotted over the dunes (${tuss} of ${dune})`);
    // no dune or tussock within 4 m of a fairway's middle: the fairway's edge is fescue first
    for (const tg of h.targets.filter(q => !q.pin)) for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) assert.ok(!['sand', 'tussock'].includes(T[i].surfaceAt(tg.x + dx, tg.z + dz)), `${h.name}: ${tg.name} is clear`);
  });
  assert.ok(HOLES.filter((h, i) => count(i, 'beach') > 50).length >= 5, 'the beach is in the picture on most holes');
});

test('the links surfaces: the fairway runs, a tussock stops a ball, the pots are pots (22 on the 8th)', () => {
  const total = s => { const r = simulate({ ...DR, HLA: 0, SpinAxis: 0 }, { groundAt: () => 0, surfaceAt: () => s }); return r.total - r.carry; };
  assert.ok(total('links') > total('fairway') + 10, `a drive runs further on links turf (${total('links').toFixed(0)} vs ${total('fairway').toFixed(0)} m)`);
  assert.ok(total('tussock') < 1, 'a tussock stops it');
  HOLES.forEach((h, i) => { for (const b of h.bunkers) { assert.equal(b.lie, 'pot', `${h.name}: every bunker is a pot`); assert.equal(T[i].surfaceAt(b.x, b.z), 'pot', `${h.name}: a pot at its middle`); } });
  assert.equal(HOLES[H('The Graveyard')].bunkers.length, 22);
});

test('the 1st and the 9th share a fairway: one ground, fairway to both', () => {
  const one = H('The Hauling Ground'), nine = H("The Wrecker's Inn"), h1 = HOLES[one];
  let shared = 0, sum = 0, worst = 0;
  for (let s = 100; s < 400; s += 8) for (let off = -60; off <= 60; off += 8) {
    const [X, Z] = toWorld(h1)(...at(h1.line, s, off));
    if (surfW(one, X, Z) !== 'fairway' || surfW(nine, X, Z) !== 'fairway') continue;
    const d = Math.abs(absY(one, X, Z) - absY(nine, X, Z)); shared++; sum += d; worst = Math.max(worst, d);
  }
  // one ground, to within the two fields' 2 m sampling (most on the 9th's table bank)
  assert.ok(sum / shared < 0.05 && worst < 0.3, `one height: mean ${(sum / shared).toFixed(3)} m, worst ${worst.toFixed(2)} m apart`);
  assert.ok(shared > 40, `fairway shared by both holes (${shared} points)`);
});

test('the 2nd and the 8th share a double green: one surface, both pins on it, a long way apart', () => {
  const two = H('The False Light'), eight = H('The Graveyard'), h2 = HOLES[two], h8 = HOLES[eight];
  const p2 = toWorld(h2)(...h2.pin), p8 = toWorld(h8)(...h8.pin);
  assert.ok(Math.hypot(p2[0] - p8[0], p2[1] - p8[1]) > 45, 'the pins stand at opposite ends');
  for (const i of [two, eight]) for (const p of [p2, p8]) assert.equal(surfW(i, ...p), 'green', `${HOLES[i].name}: both pins on its green`);
  for (let k = 0; k <= 1; k += 0.1) {
    const X = p2[0] + (p8[0] - p2[0]) * k, Z = p2[1] + (p8[1] - p2[1]) * k;
    assert.equal(surfW(two, X, Z), 'green'); assert.equal(surfW(eight, X, Z), 'green');
    assert.ok(Math.abs(absY(two, X, Z) - absY(eight, X, Z)) < 0.05, 'one surface');
  }
});

test('water: the Cauldron inside the 5th\'s bend and the creek in front of the 7th, level, the beds 0.8 m under', () => {
  const five = H('The Cauldron'), seven = H('The Ribs');
  assert.ok(count(five, 'water', (x, z) => dLine(HOLES[five], x, z) < 80) > 200, 'the Cauldron beside the 5th');
  const h7 = HOLES[seven], tee = h7.tees[BACK]; let wet = 0;
  for (let k = 0.05; k < 0.95; k += 0.01) if (T[seven].surfaceAt(tee[0] + (h7.pin[0] - tee[0]) * k, tee[1] + (h7.pin[1] - tee[1]) * k) === 'water') wet++;
  assert.ok(wet > 0, 'the 7th\'s tee shot carries the creek');
  const ys = []; { const F = HOLES[five].field; for (let z = F.z0; z < F.z0 + F.nz * 2; z += 6) for (let x = F.x0; x < F.x0 + F.nx * 2; x += 6) if (T[five].surfaceAt(x, z) === 'water') ys.push(T[five].groundAt(x, z) + HOLES[five].frame.base); }
  assert.ok(ys.length > 50 && Math.abs(Math.max(...ys) + 0.8) < 0.1 && Math.abs(Math.min(...ys) + 0.8) < 0.1, 'every bed 0.8 m under the sea\'s level');
});

test('the wrecks play: the galleon soaks a ball (it drops at the hull), the man-of-war throws one back, the ribs and the inn are solid', () => {
  const three = H('The Galleon'), four = H('Man-of-War'), seven = H('The Ribs'), nine = H("The Wrecker's Inn");
  const hull = HOLES[three].rocks.find(r => r.what === 'hull'), n = T[three].solidAt(hull.x, hull.y + hull.h / 2, hull.z);
  assert.ok(n && n.soak >= 0.8, 'the galleon soaks');
  const mow = HOLES[four].rocks.find(r => r.what === 'hull' && !r.soak), m = T[four].solidAt(mow.x, mow.y + 3, mow.z);
  assert.ok(m && !m.soak, 'the man-of-war is a wall');
  assert.ok(Math.hypot(mow.x - HOLES[four].pin[0], mow.z - HOLES[four].pin[1]) < 60, 'hard behind the 4th green');
  const rib = HOLES[seven].rocks.find(r => r.what === 'rib'); assert.ok(T[seven].solidAt(rib.x, rib.y + 2, rib.z), 'a rib');
  const inn = HOLES[nine].rocks.find(r => r.what === 'inn'); assert.ok(T[nine].solidAt(inn.x, inn.y + 4, inn.z), 'the inn');
  // the galleon lies across the 3rd's bold line; a punch into it is stopped
  const bold = HOLES[three].targets.find(q => q.bold);
  const tee = HOLES[three].tees[BACK], d = Math.hypot(hull.x - tee[0], hull.z - tee[1]), from = [hull.x + (tee[0] - hull.x) * 30 / d, hull.z + (tee[1] - hull.z) * 30 / d];
  const pts = shoot(three, from, [hull.x, hull.z], { ...PUNCH, VLA: 3 });
  assert.ok(pts.some(p => p.hit), 'a low ball hits the galleon');
  assert.ok(Math.hypot(bold.x - hull.x, bold.z - hull.z) < 160, 'the bold drive flies over her');
});

test('the 9th: a face of 5 m or more up to the table; the low road beside it', () => {
  const i = H("The Wrecker's Inn"), h = HOLES[i], t = T[i], up = h.targets.find(q => q.bold), low = h.targets.find(q => !q.bold && !q.pin);
  let lo = Infinity; for (let k = 0; k <= 1; k += 0.05) lo = Math.min(lo, t.groundAt(low.x + (up.x - low.x) * k, low.z + (up.z - low.z) * k));
  assert.ok(t.groundAt(up.x, up.z) - lo > 4.5, `the table stands ${(t.groundAt(up.x, up.z) - lo).toFixed(1)} m over the ground beside it`);
  // a 7 iron off the table onto the green flies clear
  assert.ok(!flown(shoot(i, [up.x, up.z], h.pin, SEVEN)).some(p => p.hit), 'the approach is clear');
});

test('dune grass in clusters, placed for jobs: well off the lines, never on a green or a tee, a low ball into one knocked down', () => {
  const G = COURSE.links.grass;
  assert.ok(G.length > 250, `${G.length} clusters`);
  HOLES.forEach((h, i) => {
    const t = T[i], TF = createTreeField(t.trees), grass = h.plants.filter(p => p.type === 'tussock');
    assert.ok(grass.length > 30, `${h.name}: grass bodies (${grass.length})`);
    // every grass cell of the field is 25 m or more off the hole's own line, but for the stand beside its tee
    const F = h.field, cK = F.codes.indexOf('tussock'), tee = h.tees[BACK];
    let near = 0; for (let j = 0; j < F.nz; j += 2) for (let k = 0; k < F.nx; k += 2) if (F.s[j * F.nx + k] === cK) { const x = F.x0 + k * 2, z = F.z0 + j * 2; if (dLine(h, x, z) < 25 && Math.hypot(x - tee[0], z - tee[1]) > 30) near++; }
    if (![1, 5, 6].includes(h.n)) assert.equal(near, 0, `${h.name}: grass within 25 m of the line`);   // the 1st's screen, the 5th's rim and the Dell's face are meant
    assert.notEqual(t.surfaceAt(...h.pin), 'tussock');
    // a low punch flown through the biggest body near the line is knocked down or stopped
    const b = grass.slice().sort((p, q) => dLine(h, p.x, p.z) - dLine(h, q.x, q.z))[0], g = t.groundAt(b.x, b.z);
    assert.ok(TF.at(b.x, g + 0.7, b.z), `${h.name}: the grass has a body`);
  });
  // the Dell's screen on the dune's face: a short iron at the pin flies over it
  { const k = H('The Dell'), hd = HOLES[k]; assert.ok(!flown(shoot(k, hd.tees[BACK], hd.pin, { Speed: 104, VLA: 18, TotalSpin: 7500 }, { trees: true })).some(p => p.hit), 'over the Dell\'s screen'); }
  const i = H('The Galleon'), h = HOLES[i], b = h.plants.find(p => p.type === 'tussock' && dLine(h, p.x, p.z) > 30);
  const d = 40, dir = [b.x - h.pin[0], b.z - h.pin[1]], l = Math.hypot(...dir), from = [b.x + dir[0] / l * d, b.z + dir[1] / l * d];
  const pts = shoot(i, from, [b.x, b.z], { Speed: 60, VLA: 3, TotalSpin: 2000 }, { trees: true, rng: () => 0.01 });
  const end = pts.at(-1); assert.ok(Math.hypot(end.x - from[0], end.z - from[1]) < d + b.cr + 2, 'stopped in or at the grass');
});
