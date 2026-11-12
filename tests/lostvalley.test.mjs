// The Lost Valley (blockout): the sampled valley, the course data, and the ball against the water, the tar, the
// bluff, the trees and the Strangler's root arch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createTreeField } from '../src/course/trees.js';
import { HOLES, COURSE } from '../src/course/lostvalley.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const SEVEN = { Speed: 120, VLA: 16.3, TotalSpin: 7097 };
const H = name => HOLES.findIndex(h => h.name === name);
const lenOf = L => L.reduce((a, p, k) => k ? a + Math.hypot(p[0] - L[k - 1][0], p[1] - L[k - 1][1]) : 0, 0);
const at = (L, s, off = 0) => { let acc = 0; for (let i = 1; i < L.length; i++) { const [ax, az] = L[i - 1], [bx, bz] = L[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= s || i === L.length - 1) { const t = (s - acc) / l, dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off]; } acc += l; } };
// fly a shot from a spot straight at a point, with the rocks solid and (when asked) the trees in play
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
const BACK = COURSE.teeSets[0].id;

test('nine holes, par 37 (4 5 4 3 5 4 3 4 5), a valley theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [4, 5, 4, 3, 5, 4, 3, 4, 5]);
  assert.equal(COURSE.theme, 'valley');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['titan', 'rex', 'raptor', 'compy']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.titan, 0), 3395);
});

test('the tips tee (Brachio) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'brachio' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  assert.equal(HOLES.reduce((a, h) => a + h.tips.yards, 0), 3670);
  HOLES.forEach((h, i) => {
    assert.ok(h.tips && h.tips.tee.length === 2 && h.tips.yards > h.yards[BACK], `${h.name} has a tips spot behind the back tee`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    assert.ok(T[i].groundAt(...h.tips.tee) !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'sand', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
  });
});

test('card yardages are measured down the line from the back tee', () => {
  HOLES.forEach(h => {
    const len = lenOf(h.line), [tx, tz] = h.tees[BACK], [ax, az] = h.line[0], [bx, bz] = h.line[1], l = Math.hypot(bx - ax, bz - az), s = ((tx - ax) * (bx - ax) + (tz - az) * (bz - az)) / l;
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

test('nothing overhead within 45 m of any tee, rock or tree', () => {
  HOLES.forEach((h, i) => {
    const t = T[i], TF = createTreeField(t.trees);
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) { assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: rock ${y} m up`); assert.equal(TF.at(x, g + y, z), null, `${h.name} ${id}: a tree ${y} m up`); } }
  });
});

test('every target is on fairway, and the four decision holes (3, 5, 8, 9) carry a bold target', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [3, 5, 8, 9]);
  // the 9th's choice (go or lay up) is the Green, marked bold; the neck is the lay-up
  assert.ok(HOLES[8].targets.some(t => t.name === 'The neck'));
});

test('a tour drive from the back tee at the first target hits nothing in the air, trees included', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(i, h.tees[BACK], [tg.x, tg.z], DR, { trees: true }));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('bunkers: pale sand by the greens and the 1st\'s long waste; the river\'s gravel bars play as bunkers', () => {
  const kinds = new Set();
  HOLES.forEach((h, i) => { for (const b of h.bunkers) kinds.add(b.lie); });
  assert.ok(kinds.has('sand') && kinds.has('waste'), [...kinds].join(','));
  // the 2nd runs down the floodplain beside the river: somewhere left of its line is a gravel bar (sand) by the water
  const i = H('The Floodplain'), F = HOLES[i].field; let bar = 0;
  for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) if (T[i].surfaceAt(x, z) === 'sand' && !HOLES[i].bunkers.some(b => Math.hypot(b.x - x, b.z - z) < 40)) bar++;
  assert.ok(bar > 20, `gravel bars by the river (${bar})`);
});

test('water and tar play as water: the tar round the 4th, the swamp\'s pools on the 5th, the pool round the 9th\'s shelf', () => {
  const wet = (i, f = () => true) => { const F = HOLES[i].field; let n = 0; for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) if (f(x, z) && T[i].surfaceAt(x, z) === 'water') n++; return n; };
  const tar = H('The Tar Pit'), sw = H('The Swamp'), pp = H('The Plunge Pool');
  assert.ok(wet(tar, (x, z) => Math.hypot(x - HOLES[tar].pin[0], z - HOLES[tar].pin[1]) < 60) > 30, 'tar by the 4th green');
  assert.notEqual(T[tar].surfaceAt(...HOLES[tar].pin), 'water');
  assert.ok(wet(sw) > 200, 'the swamp and its pools on the 5th');
  assert.ok(wet(pp, (x, z) => Math.hypot(x - HOLES[pp].pin[0], z - HOLES[pp].pin[1]) < 80) > 100, 'the plunge pool round the shelf');
  // the pool is level
  const F = HOLES[pp].field, ys = [];
  for (let z = F.z0; z < F.z0 + F.nz * 2; z += 6) for (let x = F.x0; x < F.x0 + F.nx * 2; x += 6) if (Math.hypot(x - HOLES[pp].pin[0], z - HOLES[pp].pin[1]) < 70 && T[pp].surfaceAt(x, z) === 'water') ys.push(T[pp].groundAt(x, z));
  ys.sort((a, b) => a - b); assert.ok(ys.length > 20 && ys[Math.floor(ys.length * 0.9)] - ys[Math.floor(ys.length * 0.1)] < 1, 'the pool is level');
});

test('the Bone Bluff stands 25 m or more in the 3rd\'s fairway at the corner, its top rock, both lanes round it fairway', () => {
  const i = H('The Bone Bed'), h = HOLES[i], t = T[i];
  const right = h.targets.find(q => q.name === 'Right of the bluff'), left = h.targets.find(q => q.name === 'Left of the bluff');
  const mid = [(right.x + left.x) / 2, (right.z + left.z) / 2];
  let top = -Infinity, at0 = null;
  for (let dx = -20; dx <= 20; dx += 2) for (let dz = -30; dz <= 30; dz += 2) { const g = t.groundAt(mid[0] + dx, mid[1] + dz); if (g > top) { top = g; at0 = [mid[0] + dx, mid[1] + dz]; } }
  assert.ok(top - t.groundAt(right.x, right.z) > 25, `the bluff stands ${(top - t.groundAt(right.x, right.z)).toFixed(1)} m`);
  assert.ok(['desert'].includes(t.surfaceAt(...at0)), `its top is ${t.surfaceAt(...at0)}`);
  // a drive at the bluff hits its face and stays at its foot
  const pts = shoot(i, h.tees[BACK], at0, DR), end = pts.at(-1);
  assert.ok(Math.hypot(end.x - at0[0], end.z - at0[1]) < 60 && end.y < top - 10, 'a drive into the bluff ends at its foot');
});

test('the 1st\'s giant monkey-puzzle plays: a drive through its crown is knocked down', () => {
  const i = H('Cycad Grove'), h = HOLES[i], t = T[i], g = t.trees.find(q => q.type === 'giant');
  assert.ok(g && g.h > 50 && g.cr > 10, 'the giant');
  const clear = flown(shoot(i, h.tees[BACK], [g.x, g.z], DR)).at(-1), hit = shoot(i, h.tees[BACK], [g.x, g.z], { ...DR, VLA: 14 }, { trees: true, rng: () => 0.01 });
  assert.ok(hit.some(p => p.hit) || Math.hypot(hit.at(-1).x - h.tees[BACK][0], hit.at(-1).z - h.tees[BACK][1]) < Math.hypot(clear.x - h.tees[BACK][0], clear.z - h.tees[BACK][1]) - 20, 'the crown stops a ball flown into it');
});

test('the Strangler: its root arch is solid over the 8th, a driver under it flies clear, and its trunk stops a ball', () => {
  const i = H('The Strangler'), h = HOLES[i], t = T[i];
  const roots = h.rocks.filter(r => r.root);
  assert.ok(roots.length >= 10, 'the arch as wedges');
  const mid = roots[Math.floor(roots.length * 0.4)], ym = (mid.from[2] + mid.to[2]) / 2, xm = (mid.from[0] + mid.to[0]) / 2, zm = (mid.from[1] + mid.to[1]) / 2;
  assert.ok(t.solidAt(xm, ym, zm), 'the root is solid');
  const g = t.groundAt(xm, zm); assert.ok(ym - g > 8, `room under the arch (${(ym - g).toFixed(1)} m)`);
  const under = h.targets.find(q => q.name === 'Under the arch');
  const pts = flown(shoot(i, h.tees[BACK], [under.x, under.z], { Speed: 160, VLA: 9, TotalSpin: 2500 }, { trees: true }));
  assert.ok(!pts.some(p => p.hit), 'a driver under the arch flies clear');
  const fig = t.trees.find(q => q.type === 'fig'); assert.ok(fig && fig.tr >= 6 && fig.cr >= 30, 'the fig');
  const TF = createTreeField(t.trees); assert.ok(TF.at(fig.x + fig.tr * 0.5, fig.y + 5, fig.z)?.n, 'its trunk is solid');
});

test('the hut at the camp and the lookout on the ledge are solid and off the lines', () => {
  const huts = HOLES.flatMap((h, i) => h.rocks.filter(r => r.hut).map(r => ({ r, i })));
  assert.ok(huts.some(q => /lookout/.test(q.r.hut)), 'the lookout');
  for (const { r, i } of huts) {
    assert.ok(T[i].solidAt(r.x, r.y + 3, r.z), `${r.hut} is solid`);
    let d = Infinity; const L = HOLES[i].line; for (let s = 0; s < lenOf(L); s += 4) { const p = at(L, s); d = Math.min(d, Math.hypot(p[0] - r.x, p[1] - r.z)); }
    assert.ok(d > 20, `${r.hut} is ${d.toFixed(0)} m off the line`);
  }
});

test('a pitch at the 9th\'s shelf from the neck lay-up holds the green', () => {
  const i = H('The Plunge Pool'), h = HOLES[i], neck = h.targets.find(q => q.name === 'The neck');
  let best = null;
  for (let sp = 40; sp <= 90; sp += 2) { const e = shoot(i, [neck.x, neck.z], h.pin, { Speed: sp, VLA: 30, TotalSpin: 9000 }).at(-1), d = Math.hypot(e.x - h.pin[0], e.z - h.pin[1]); if (!best || d < best.d) best = { d, e }; }
  assert.ok(best.d < 12, `the best pitch finishes ${best.d.toFixed(1)} m from the pin`);
  assert.notEqual(T[i].surfaceAt(best.e.x, best.e.z), 'water');
});
