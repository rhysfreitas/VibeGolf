// Halcyon Ring (blockout): the sampled holes on the ring, the course data, and the ball against the glass (floor
// windows and the rim glass play as water), the lake, the rim walls, the spoke's feet, villas and trees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createTreeField } from '../src/course/trees.js';
import { HOLES, COURSE } from '../src/course/halcyon.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const NINE = { Speed: 109, VLA: 20.4, TotalSpin: 8647 };
const H = name => HOLES.findIndex(h => h.name === name);
const BACK = COURSE.teeSets[0].id;
const lenOf = L => L.reduce((a, p, k) => k ? a + Math.hypot(p[0] - L[k - 1][0], p[1] - L[k - 1][1]) : 0, 0);
const dec = b64 => Uint8Array.from(Buffer.from(b64, 'base64'));
const paintAt = (i, x, z) => { const F = HOLES[i].field; F.mD = F.mD || dec(F.m); const ii = Math.round((x - F.x0) / F.cell), jj = Math.round((z - F.z0) / F.cell); return F.mD[jj * F.nx + ii]; };
function shoot(i, from, to, shot, { trees = false, rng = () => 0.99 } = {}) {
  const t = T[i], o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const TF = trees ? createTreeField(t.trees) : null;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => { const sf = t.surfaceAt(wx(lx, lz), wz(lx, lz)); return sf === 'tee' || sf === 'fringe' ? 'fairway' : sf === 'void' ? 'rough' : sf; },
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    treeAt: TF ? (lx, ly, lz) => { const q = TF.at(wx(lx, lz), o.y + ly, wz(lx, lz)); if (!q) return null; return q.n ? { n: [q.n[0] * c + q.n[2] * s, 0, -q.n[0] * s + q.n[2] * c] } : q; } : undefined,
    voidY: t.voidY - o.y, altFt: COURSE.altFt, rng,
  });
  return r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), hit: p.hit, phase: p.phase }));
}
const flown = pts => pts.filter(p => p.phase === 'flight');
const cells = (i, f) => { const F = HOLES[i].field, out = []; for (let z = F.z0; z < F.z0 + (F.nz - 1) * F.cell; z += 4) for (let x = F.x0; x < F.x0 + (F.nx - 1) * F.cell; x += 4) if (f(x, z)) out.push([x, z]); return out; };

test('nine holes, par 35 (4 3 4 5 3 4 4 5 3), a ring theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [4, 3, 4, 5, 3, 4, 4, 5, 3]);
  assert.equal(COURSE.theme, 'ring');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['zenith', 'meridian', 'horizon', 'nadir']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.zenith, 0), 3105);
  assert.equal(COURSE.ring.R, 5000);
});

test('the tips tee (Kingfisher) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'kingfisher' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  assert.equal(HOLES.reduce((a, h) => a + h.tips.yards, 0), 3330);
  HOLES.forEach((h, i) => {
    assert.ok(h.tips.yards > h.yards[BACK], `${h.name}: the tips play longer`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    assert.ok(T[i].groundAt(...h.tips.tee) !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'sand', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
  });
});

test('card yardages are measured down the line from the back tee', () => {
  HOLES.forEach(h => {
    const len = lenOf(h.line), [tx, tz] = h.tees[BACK], [ax, az] = h.line[0], [bx, bz] = h.line[1], l = Math.hypot(bx - ax, bz - az), s = ((tx - ax) * (bx - ax) + (tz - az) * (bz - az)) / l;
    assert.ok(Math.abs((len - s) / 0.9144 - h.yards[BACK]) < 5, `${h.name}: ${((len - s) / 0.9144).toFixed(0)} vs ${h.yards[BACK]}`);
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

test('the ring\'s curve is in each hole: the ground rises along the ring ahead of the 1st, about (s - s0)² / 2R', () => {
  // the 1st plays up the ring (south): its green sits higher than its tee by the floor's rise plus the curve
  const i = H('The Promenade'), h = HOLES[i], d = lenOf(h.line), curve = d * d / (2 * COURSE.ring.R);
  assert.ok(curve > 8 && curve < 14, `the curve over the 1st: ${curve.toFixed(1)} m`);
  assert.ok(T[i].groundAt(...h.pin) - T[i].groundAt(...h.tees[BACK]) > 6, 'the 1st climbs');
});

test('nothing overhead within 45 m of any tee, rock or tree', () => {
  HOLES.forEach((h, i) => {
    const t = T[i], TF = createTreeField(t.trees);
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) { assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: rock ${y} m up`); assert.equal(TF.at(x, g + y, z), null, `${h.name} ${id}: a tree ${y} m up`); } }
  });
});

test('every target is on fairway (the 7th\'s bold one on its green: drivable), and the decision holes are 4, 7 and 8', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.ok(['fairway', ...(tg.bold ? ['green'] : [])].includes(T[i].surfaceAt(tg.x, tg.z)), `${h.name} ${tg.name} is ${T[i].surfaceAt(tg.x, tg.z)}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [4, 7, 8]);
});

test('a tour drive from the back tee at the first target hits nothing in the air, trees included', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(i, h.tees[BACK], [tg.x, tg.z], DR, { trees: true }));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('the glass plays as water, flush with the floor: the Long Window (4), the Great Window (9), the rim glass by the 5th', () => {
  const glass = i => cells(i, (x, z) => T[i].surfaceAt(x, z) === 'water' && paintAt(i, x, z) === 7);
  const lw = glass(H('The Long Window')), gw = glass(H('The Great Window')), rim = glass(H('The Balcony'));
  assert.ok(lw.length > 150, `the Long Window (${lw.length} cells)`);
  assert.ok(gw.length > 100, `the Great Window (${gw.length})`);
  assert.ok(rim.length > 100, `the rim glass by the 5th (${rim.length})`);
  // flush: the glass lies at the floor round it, not in a pit (water's bed is 0.8 m down; glass isn't)
  const i = H('The Great Window'), t = T[i];
  let worst = 0;
  for (const [x, z] of gw) for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (t.surfaceAt(x + dx, z + dz) !== 'water') worst = Math.max(worst, Math.abs(t.groundAt(x + dx, z + dz) - t.groundAt(x, z)));
  assert.ok(worst < 0.6, `the window's glass meets the lawn round it (step ${worst.toFixed(2)} m)`);
  // the 9th plays across it: the window lies on the line between the tee and the green
  const h = HOLES[i], mid = [(h.tees[BACK][0] + h.pin[0]) / 2, (h.tees[BACK][1] + h.pin[1]) / 2];
  assert.equal(t.surfaceAt(...mid), 'water', 'the Great Window on the 9th\'s line');
  // and a 9-iron at the pin carries it
  const end = shoot(i, h.tees[BACK], h.pin, NINE).at(-1);
  assert.notEqual(t.surfaceAt(end.x, end.z), 'water', 'a 9-iron carries the window');
});

test('the lake plays as water on the 6th, and behind the 5th green', () => {
  const six = H('The Long Lake'), five = H('The Balcony');
  assert.ok(cells(six, (x, z) => T[six].surfaceAt(x, z) === 'water' && paintAt(six, x, z) === 8).length > 300, 'the lake along the 6th');
  const h = HOLES[five], [px, pz] = h.pin; let wet = false;
  for (let d = 10; d < 60; d += 2) if (T[five].surfaceAt(px, pz - d) === 'water' && paintAt(five, px, pz - d) === 8) { wet = true; break; }
  assert.ok(wet, 'the lake\'s head behind the 5th green');
});

test('the rim wall stops a ball: a drive at the west wall from the 5th tee hits it and drops', () => {
  const i = H('The Balcony'), h = HOLES[i], wall = h.rocks.filter(r => r.rimWall);
  assert.ok(wall.length > 0, 'the 5th has the west rim wall in its field');
  const w = wall[0], pts = shoot(i, h.tees[BACK], [w.x, w.z], DR);
  assert.ok(pts.some(p => p.hit), 'the drive hits the wall');
});

test('the spoke\'s feet stand on the 7th and are solid; a drive straight at the west foot hits it', () => {
  const i = H('The Spoke'), h = HOLES[i], feet = h.rocks.filter(r => r.spoke);
  assert.equal(feet.length, 2);
  const f = feet[0], pts = shoot(i, h.tees[BACK], [f.from[0], f.from[1]], DR);
  assert.ok(pts.some(p => p.hit), 'the drive hits the foot');
});

test('the church pews: nine rungs and more bunkers on the 3rd; no bunker on the 9th', () => {
  assert.ok(HOLES[H('The Terminator')].bunkers.length >= 10, `${HOLES[H('The Terminator')].bunkers.length}`);
  assert.equal(HOLES[H('The Great Window')].bunkers.length, 0);
});

test('villas and garden walls are solid; the 2nd\'s garden wall stands behind its green', () => {
  const i = H('The Walled Garden'), h = HOLES[i], walls = h.rocks.filter(r => r.wall);
  assert.ok(walls.length >= 2, 'the garden walls');
  assert.ok(h.rocks.some(r => r.villa), 'the garden\'s villa');
  const w = walls.reduce((a, r) => Math.hypot(r.x - h.pin[0], r.z - h.pin[1]) < Math.hypot(a.x - h.pin[0], a.z - h.pin[1]) ? r : a);
  assert.ok(Math.hypot(w.x - h.pin[0], w.z - h.pin[1]) < 40, 'a wall near the green');
  const g = T[i].groundAt(w.x, w.z); assert.ok(T[i].solidAt(w.x, g + 1.5, w.z), 'the wall is solid');
});
