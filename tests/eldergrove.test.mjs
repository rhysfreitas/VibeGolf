// Eldergrove (blockout): the sampled forest floor, the course data, and the ball among the giants: trunks that soak,
// crowns far overhead, the forest lies, the fallen giant's high road and the sentinel, the pool and the brook, the
// Stair's decks, the burnt shell and the heart tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createTreeField } from '../src/course/trees.js';
import { HOLES, COURSE } from '../src/course/eldergrove.js';

const T = HOLES.map(h => createTerrain(h));
const TF = T.map(t => createTreeField(t.trees));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const H = name => HOLES.findIndex(h => h.name === name);
const lenOf = L => L.reduce((a, p, k) => k ? a + Math.hypot(p[0] - L[k - 1][0], p[1] - L[k - 1][1]) : 0, 0);
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
const phys = s => s === 'tee' || s === 'fringe' ? 'fairway' : s === 'void' ? 'rough' : s;
// fly a shot from a spot straight at a point, with the rocks and the trees solid
function shoot(i, from, to, shot, { trees = true, rng = () => 0.99 } = {}) {
  const t = T[i], o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))),
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && Object.assign([n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c], n.soak ? { soak: n.soak } : {}); },
    treeAt: trees ? (lx, ly, lz) => { const q = TF[i].at(wx(lx, lz), o.y + ly, wz(lx, lz)); if (!q) return null; return q.n ? { n: [q.n[0] * c + q.n[2] * s, 0, -q.n[0] * s + q.n[2] * c], soak: q.soak } : q; } : undefined,
    voidY: t.voidY - o.y, altFt: COURSE.altFt, rng,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const BACK = COURSE.teeSets[0].id;

test('nine holes, par 36 (4 5 4 4 4 3 5 3 4), the forest with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [4, 5, 4, 4, 4, 3, 5, 3, 4]);
  assert.equal(COURSE.theme, 'grove');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['redwood', 'cedar', 'rowan', 'hazel']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.redwood, 0), 3465);
});

test('the tips tee (Ironwood) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'ironwood' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  assert.equal(HOLES.reduce((a, h) => a + h.tips.yards, 0), 3770);
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
      const g = t.groundAt(x, z); assert.ok(g !== null, `${h.name} ${id} tee on ground`);
      assert.equal(t.surfaceAt(x, z), 'tee', `${h.name} ${id} is a tee pad`);
    }
    const [px, pz] = h.pin;
    assert.equal(t.surfaceAt(px, pz), 'green', `${h.name} pin on its green`);
    const sl = t.slopeAt(px, pz, 1); assert.ok(Math.hypot(sl.x, sl.z) <= 0.031, `${h.name} pin ${(Math.hypot(sl.x, sl.z) * 100).toFixed(1)}%`);
  });
});

test('nothing overhead within 45 m of any tee: no rock, no trunk, no crown', () => {
  HOLES.forEach((h, i) => {
    const t = T[i];
    for (const [id, [x, z]] of Object.entries(h.tees)) {
      const g = t.groundAt(x, z);
      for (let y = 1; y < 45; y += 1) { assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: rock ${y} m up`); assert.equal(TF[i].at(x, g + y, z), null, `${h.name} ${id}: a tree ${y} m up`); }
    }
  });
});

test('every target is on fairway; the decisions: the high road (3), over the water (4), the Brook in two (7), the left lane (9)', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [3, 4, 7, 9]);
  assert.ok(HOLES[H('The Brook')].targets.find(t => t.pin).bold, 'the 7th goes for the green in two');
});

test('a tour drive from the back tee at the first target hits no trunk, crown or rock', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(i, h.tees[BACK], [tg.x, tg.z], DR));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('the giants: every one near the play a tree body whose trunk soaks, its crown 50 m or more up; a ball into a trunk drops at its foot about half the time', () => {
  HOLES.forEach((h, i) => {
    const giants = T[i].trees.filter(t => t.type === 'redwood');
    assert.ok(giants.length > 40, `${h.name}: giants (${giants.length})`);
    for (const t of giants) { assert.equal(t.soak, 0.45); assert.ok(t.h * t.low > 50, `${h.name}: a crown ${(t.h * t.low).toFixed(0)} m up`); }
  });
  // the gate on the 1st: drives fired into the left gate tree, 20 times
  const i = 0, h = HOLES[i], gate = T[i].trees.filter(t => t.type === 'redwood').sort((a, b) => Math.hypot(a.x + 27, a.z + 110) - Math.hypot(b.x + 27, b.z + 110))[0];
  let hit = 0, foot = 0;
  for (let k = 0; k < 20; k++) {
    let q = 1234567 + k * 7919; const rng = () => { q = (q + 0x6D2B79F5) | 0; let r = Math.imul(q ^ (q >>> 15), 1 | q); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };   // mulberry32
    const pts = shoot(i, h.tees[BACK], [gate.x, gate.z], { Speed: 150, VLA: 9, TotalSpin: 2800 }, { rng });
    if (!pts.some(p => p.hit)) continue; hit++;
    const end = pts.at(-1), d = Math.hypot(end.x - gate.x, end.z - gate.z);
    if (d < gate.tr + 12) foot++;
  }
  assert.ok(hit >= 15, `the drives hit the gate tree (${hit} of 20)`);
  assert.ok(foot >= 4 && foot <= hit - 3, `some drop at its foot, some come back (${foot} of ${hit})`);
});

test('the forest lies: moss (first cut), fern (rough), leaf litter (beach) and root (native) round every hole', () => {
  HOLES.forEach((h, i) => {
    const n = { firstcut: 0, rough: 0, beach: 0 }, F = h.field;
    for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) { const s = T[i].surfaceAt(x, z); if (s in n) n[s]++; }
    for (const [s, c] of Object.entries(n)) assert.ok(c > 60, `${h.name}: ${s} (${c})`);
  });
  const total = s => { const r = simulate({ ...DR, HLA: 0, SpinAxis: 0 }, { groundAt: () => 0, surfaceAt: () => s }); return r.total - r.carry; };
  assert.ok(total('beach') > total('rough') + 5, 'a ball runs on in the leaf litter, not in the fern');
});

test('the fallen giant: the high road on its back 4 m or more over the low road, the sentinel standing in the low road', () => {
  const i = H('The Fallen Giant'), h = HOLES[i], hi = h.targets.find(t => t.bold), lo = h.targets.find(t => t.name === 'The low road');
  assert.ok(T[i].groundAt(hi.x, hi.z) - T[i].groundAt(lo.x, lo.z) > 4, `the high road ${T[i].groundAt(hi.x, hi.z).toFixed(1)} m against ${T[i].groundAt(lo.x, lo.z).toFixed(1)}`);
  const sentinel = T[i].trees.find(t => t.type === 'redwood' && t.tr > 6 && Math.hypot(t.x - at(h.line, 214, 5)[0], t.z - at(h.line, 214, 5)[1]) < 8);
  assert.ok(sentinel, 'a giant 214 m out at the low road\'s left edge');
  // and the high road's approach is about 30 m shorter
  assert.ok(Math.hypot(lo.x - h.pin[0], lo.z - h.pin[1]) - Math.hypot(hi.x - h.pin[0], hi.z - h.pin[1]) > 25);
});

test('water: the pool in the 4th\'s bend and the brook across the 7th, both a stroke and a drop', () => {
  const four = H('The Mirror'), seven = H('The Brook');
  const ov = HOLES[four].targets.find(t => t.bold), tee = HOLES[four].tees[BACK];
  let wet = 0; for (let k = 1; k < 120; k++) { const x = tee[0] + (ov.x - tee[0]) * k / 120, z = tee[1] + (ov.z - tee[1]) * k / 120; if (T[four].surfaceAt(x, z) === 'water') wet++; }
  assert.ok(wet >= 6, `the 4th's bold line carries the pool's corner (${wet} of 119 points on water)`);
  const h7 = HOLES[seven], len = lenOf(h7.line);
  let brook = false; for (let s = len * 0.75; s < len * 0.95; s += 2) for (let off = -12; off <= 12; off += 2) if (T[seven].surfaceAt(...at(h7.line, s, off)) === 'water') brook = true;
  assert.ok(brook, 'the brook crosses the 7th short of its green');
});

test('the Stair: its tees on decks 25 m (Redwood) and 12 m (Cedar) up, the floor under them drawn, the stair tree beside them', () => {
  const i = H('The Stair'), h = HOLES[i], t = T[i];
  const below = (x, z) => { let lo = Infinity; for (let a = 0; a < 6.28; a += 0.4) { const g = t.groundAt(x + Math.cos(a) * 14, z + Math.sin(a) * 14); if (g !== null) lo = Math.min(lo, g); } return lo; };
  const [rx, rz] = h.tees.redwood, [cx, cz] = h.tees.cedar;
  assert.ok(t.groundAt(rx, rz) - below(rx, rz) > 22, 'the Redwood deck stands about 25 m over the floor');
  assert.ok(t.groundAt(cx, cz) - below(cx, cz) > 9, 'the Cedar deck about 12 m');
  assert.ok(h.deckFloor && h.deckFloor.length > 40, 'the floor under the decks is in the data for drawing');
  assert.ok(COURSE.grove.decks.length === 3 && COURSE.grove.limbs.length === 3 && COURSE.grove.stairs.length === 1, 'three decks on three limbs, one stair');
  // 150 yd from 25 m up plays about two clubs short: a gap wedge (140 yd on the flat) lands by the green
  const pts = shoot(i, h.tees.redwood, h.pin, { Speed: 88, VLA: 28, TotalSpin: 9500 }), first = pts.find(p => p.phase !== 'flight');
  assert.ok(!flown(pts).some(p => p.hit), 'nothing in the way from the deck');
  assert.ok(first && Math.hypot(first.x - h.pin[0], first.z - h.pin[1]) < 20, `a wedge from 25 m up lands by the green (${first && Math.hypot(first.x - h.pin[0], first.z - h.pin[1]).toFixed(0)} m off)`);
});

test('the burnt shell round the 8th green and the root plate are rocks that soak', () => {
  const eight = H('The Hollow'), three = H('The Fallen Giant');
  const walls = HOLES[eight].rocks.filter(r => r.what === "the shell's wall");
  assert.ok(walls.length >= 12 && walls.every(r => r.soak === 0.45));
  assert.ok(HOLES[three].rocks.some(r => r.what === 'the root plate' && r.soak > 0.5));
});

test('the Hall: the centre root plays as root, the heart tree stands behind the 9th green', () => {
  const i = H('The Hall'), h = HOLES[i], len = lenOf(h.line);
  let root = 0; for (let s = 180; s < 270; s += 6) if (T[i].surfaceAt(...at(h.line, s, 0)) === 'desert') root++;
  assert.ok(root >= 8, `the root down the middle (${root})`);
  const heart = T[i].trees.find(t => t.type === 'heart');
  assert.ok(heart && heart.tr === 30, 'the heart tree, 60 m across');
  const d = Math.hypot(heart.x - h.pin[0], heart.z - h.pin[1]);
  assert.ok(d > 40 && d < 140, `the green at its foot (${d.toFixed(0)} m from its middle)`);
  assert.ok(len > 380);
});
