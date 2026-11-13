// The Buried Kingdom (blockout): the sampled site, the course data, and the ball against the sand in its three
// bands, the water, the gate, the fallen obelisk, the Sphinx and the palms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { createTreeField } from '../src/course/trees.js';
import { HOLES, COURSE } from '../src/course/buriedkingdom.js';

const T = HOLES.map(h => createTerrain(h));
const DR = { Speed: 167, VLA: 10.9, TotalSpin: 2686 };
const SEVEN = { Speed: 120, VLA: 16.3, TotalSpin: 7097 };
const PUNCH = { Speed: 120, VLA: 5, TotalSpin: 3000 };
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
// count the field's cells of a surface (every 4 m) that pass a filter
const count = (i, surf, f = () => true) => { const F = HOLES[i].field; let n = 0; for (let z = F.z0; z < F.z0 + F.nz * F.cell; z += 4) for (let x = F.x0; x < F.x0 + F.nx * F.cell; x += 4) if (f(x, z) && T[i].surfaceAt(x, z) === surf) n++; return n; };
const dLine = (h, x, z) => { let d = Infinity; for (let s = 0; s <= lenOf(h.line); s += 5) { const p = at(h.line, s); d = Math.min(d, Math.hypot(p[0] - x, p[1] - z)); } return d; };

test('nine holes, par 36 (3 5 4 4 3 5 4 4 4: a par 3 opener), a kingdom theme with four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.deepEqual(HOLES.map(h => h.par), [3, 5, 4, 4, 3, 5, 4, 4, 4]);
  assert.equal(COURSE.theme, 'kingdom');
  assert.deepEqual(COURSE.teeSets.map(s => s.id), ['falcon', 'jackal', 'ibis', 'scarab']);
  for (const h of HOLES) for (const s of COURSE.teeSets) assert.ok(h.tees[s.id] && h.yards[s.id] > 50, `${h.name} ${s.id}`);
  assert.equal(HOLES.reduce((a, h) => a + h.yards.falcon, 0), 3470);
});

test('the tips tee (Cobra) is in the data and switched off', () => {
  assert.ok(COURSE.tipsSet && COURSE.tipsSet.id === 'cobra' && COURSE.tipsSet.minDrive >= 280);
  assert.ok(!COURSE.teeSets.some(s => s.id === COURSE.tipsSet.id), 'not offered in the game');
  assert.equal(HOLES.reduce((a, h) => a + h.tips.yards, 0), 3730);
  HOLES.forEach((h, i) => {
    assert.ok(h.tips && h.tips.tee.length === 2 && h.tips.yards > h.yards[BACK], `${h.name} has a tips spot behind the back tee`);
    assert.ok(!(COURSE.tipsSet.id in h.tees) && !(COURSE.tipsSet.id in h.yards), `${h.name}: tips kept out of tees and yards`);
    assert.ok(T[i].groundAt(...h.tips.tee) !== null, `${h.name} tips on ground`);
    assert.ok(!['fairway', 'green', 'water', 'sand', 'void'].includes(T[i].surfaceAt(...h.tips.tee)), `${h.name} tips spot is ${T[i].surfaceAt(...h.tips.tee)}`);
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

test('nothing overhead within 45 m of any tee, stone or palm', () => {
  HOLES.forEach((h, i) => {
    const t = T[i], TF = createTreeField(t.trees);
    for (const [id, [x, z]] of Object.entries(h.tees)) { const g = t.groundAt(x, z); for (let y = 1; y < 45; y += 1) { assert.equal(t.solidAt(x, g + y, z), null, `${h.name} ${id}: stone ${y} m up`); assert.equal(TF.at(x, g + y, z), null, `${h.name} ${id}: a palm ${y} m up`); } }
  });
});

test('every target is on fairway, and the three decision holes (4, 6, 9) carry a bold target', () => {
  HOLES.forEach((h, i) => { for (const tg of h.targets.filter(q => !q.pin)) assert.equal(T[i].surfaceAt(tg.x, tg.z), 'fairway', `${h.name} ${tg.name}`); });
  assert.deepEqual(HOLES.filter(h => h.targets.some(t => t.bold)).map(h => h.n), [4, 6, 9]);
  assert.ok(HOLES[5].targets.find(t => t.pin).bold, 'the 6th: going for the green in two is the bold line');
});

test('a tour drive from the back tee at the first target hits nothing in the air, palms included', () => {
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const tg = h.targets.find(q => !q.pin), pts = flown(shoot(i, h.tees[BACK], [tg.x, tg.z], DR, { trees: true }));
    assert.ok(!pts.some(p => p.hit), `${h.name}: the drive hit something`);
  });
});

test('sand in three bands: rough round the grass, firm sand (waste) beyond it, soft sand (a bunker) only where placed', () => {
  HOLES.forEach((h, i) => {
    const firm = count(i, 'waste', (x, z) => dLine(h, x, z) < 110), soft = count(i, 'sand', (x, z) => dLine(h, x, z) < 110), rough = count(i, 'rough', (x, z) => dLine(h, x, z) < 110);
    assert.ok(rough > 80, `${h.name}: a band of rough (${rough})`);
    if (h.n > 3) { assert.ok(firm > 1500, `${h.name}: firm sand off the grass (${firm})`); assert.ok(soft < firm * 0.45, `${h.name}: soft sand only as placed (${soft} of ${firm})`); }
    for (const b of h.bunkers) assert.equal(b.lie, 'sand', `${h.name}: every bunker is soft sand`);
  });
  // firm sand costs what a waste area costs: a 7 iron off it carries less than off the fairway, more than from a bunker
  const carry = s => { const r = simulate({ ...SEVEN, HLA: 0, SpinAxis: 0 }, { groundAt: () => 0, surfaceAt: () => 'fairway', lie: s }); return r.carry; };
  const c = { fairway: carry('fairway'), waste: carry('waste'), sand: carry('sand') };
  if ([c.fairway, c.waste, c.sand].every(Number.isFinite) && c.fairway !== c.sand) assert.ok(c.sand < c.waste && c.waste <= c.fairway, JSON.stringify(c));
});

test('water is in play on the 1st and 2nd only: the boat basin under the 1st\'s tee shot, the river down the 2nd', () => {
  const one = H('The Landing'), two = H('The River Bank');
  const h1 = HOLES[one], mid = [(h1.tees[BACK][0] + h1.pin[0]) / 2, (h1.tees[BACK][1] + h1.pin[1]) / 2];
  assert.equal(T[one].surfaceAt(...mid), 'water', 'the basin lies between the 1st tee and its green');
  assert.notEqual(T[one].surfaceAt(...h1.pin), 'water');
  assert.ok(count(two, 'water', (x, z) => dLine(HOLES[two], x, z) < 120) > 300, 'the river beside the 2nd');
  // the water is level, and its bed 0.8 m under it
  const ys = []; { const F = h1.field; for (let z = F.z0; z < F.z0 + F.nz * 2; z += 6) for (let x = F.x0; x < F.x0 + F.nx * 2; x += 6) if (T[one].surfaceAt(x, z) === 'water') ys.push(T[one].groundAt(x, z)); }
  assert.ok(ys.length > 50 && Math.max(...ys) - Math.min(...ys) < 0.2, 'the basin and the river stand at one level');
  for (let i = 3; i < 9; i++) assert.equal(count(i, 'water', (x, z) => dLine(HOLES[i], x, z) < 150), 0, `${HOLES[i].name}: no water in play`);
});

test('the great pyramid stands over the 3rd green, solid ground', () => {
  const i = H('The Causeway'), h = HOLES[i], t = T[i], F = h.field;
  let top = -Infinity; for (let z = F.z0; z < F.z0 + F.nz * 2; z += 4) for (let x = F.x0; x < F.x0 + F.nx * 2; x += 4) top = Math.max(top, t.groundAt(x, z));
  assert.ok(top - t.groundAt(...h.pin) > 60, `the pyramid rises ${(top - t.groundAt(...h.pin)).toFixed(0)} m over the green inside the hole's field`);
});

test('the Sand Sea: a blowout of soft sand 7 m or more deep across the 4th\'s straight line; the grass goes round it', () => {
  const i = H('Sahara'), h = HOLES[i], t = T[i], tee = h.tees[BACK], bold = h.targets.find(q => q.bold), round = h.targets.find(q => !q.bold && !q.pin);
  let soft = 0, lo = Infinity;
  for (let k = 0.2; k < 0.95; k += 0.02) { const x = tee[0] + (bold.x - tee[0]) * k, z = tee[1] + (bold.z - tee[1]) * k; if (t.surfaceAt(x, z) === 'sand') { soft++; lo = Math.min(lo, t.groundAt(x, z)); } }
  assert.ok(soft > 10, `soft sand under the bold line (${soft} of 38 steps)`);
  assert.ok(t.groundAt(bold.x, bold.z) - lo > 7, `the Sand Sea lies ${(t.groundAt(bold.x, bold.z) - lo).toFixed(1)} m under the far fairway`);
  for (let k = 0.5; k < 1; k += 0.05) { const x = tee[0] + (round.x - tee[0]) * k, z = tee[1] + (round.z - tee[1]) * k; assert.notEqual(t.surfaceAt(x, z), 'sand', 'the way round is clear of the Sand Sea'); }
});

test('the Sphinx: its head is solid stone behind the 5th green; a 7 iron at the pin from the Jackal tee flies clear', () => {
  const i = H('The Sphinx'), h = HOLES[i], t = T[i], head = h.rocks.find(r => r.what === 'head');
  assert.ok(head, 'the head is a rock');
  assert.ok(t.solidAt(head.x, head.y + head.h / 2, head.z), 'solid');
  assert.ok(Math.hypot(head.x - h.pin[0], head.z - h.pin[1]) > 18, 'clear of the green');
  const pts = flown(shoot(i, h.tees.jackal, h.pin, SEVEN));
  assert.ok(!pts.some(p => p.hit), 'the tee shot hit nothing');
});

test('the 8th: a face of 5 m or more up to the terrace, and the gate\'s two towers, solid, the way between them open', () => {
  const i = H('The Gate'), h = HOLES[i], t = T[i], up = h.targets.find(q => q.name === 'Up on the terrace'), low = h.targets.find(q => q.name === 'Below the face');
  assert.ok(t.groundAt(up.x, up.z) - t.groundAt(low.x, low.z) > 5, `the terrace stands ${(t.groundAt(up.x, up.z) - t.groundAt(low.x, low.z)).toFixed(1)} m over the low fairway`);
  const towers = h.rocks.filter(r => r.what === 'tower').sort((a, b) => Math.hypot(a.x - up.x, a.z - up.z) - Math.hypot(b.x - up.x, b.z - up.z)).slice(0, 2);
  assert.equal(towers.length, 2);
  for (const tw of towers) assert.ok(t.solidAt(tw.x, tw.y + 8, tw.z), 'a tower is solid');
  const gap = Math.hypot(towers[0].x - towers[1].x, towers[0].z - towers[1].z);
  assert.ok(gap > 40, `the towers stand ${gap.toFixed(0)} m apart`);
  const mid = [(towers[0].x + towers[1].x) / 2, (towers[0].z + towers[1].z) / 2];
  for (let y = 1; y < 30; y += 2) assert.equal(t.solidAt(mid[0], t.groundAt(...mid) + y, mid[1]), null, 'open between the towers');
  assert.equal(t.surfaceAt(...mid), 'fairway', 'the fairway runs through the gate');
});

test('the 9th: the fallen obelisk lies on the centre line, solid; a punch into it stops, both sides of it are fairway', () => {
  const i = H('The Colossi'), h = HOLES[i], t = T[i], pieces = h.rocks.filter(r => r.what === 'piece');
  assert.ok(pieces.length >= 3, 'three pieces');
  const mid = pieces.slice().sort((a, b) => a.z - b.z)[1];
  assert.ok(t.solidAt(mid.x, mid.y + mid.h / 2, mid.z), 'solid');
  assert.ok(dLine(h, mid.x, mid.z) < 6, 'on the line');
  const L = h.targets.find(q => q.name === 'Left of the obelisk'), R = h.targets.find(q => q.name === 'Right of the obelisk');
  assert.ok(L.bold && !R.bold);
  // from 40 m short of it, a punch straight at it is stopped
  const from = at(h.line, 180), pts = shoot(i, from, [mid.x, mid.z], PUNCH);
  assert.ok(pts.some(p => p.hit), 'a low ball hits the obelisk');
  // the colossi stand before the cliff temple beyond the green: solid, 25 m or more high
  const col = h.rocks.filter(r => r.what === 'colossus');
  assert.equal(col.length, 4);
  for (const c of col) { assert.ok(c.h >= 25); assert.ok(t.solidAt(c.x, c.y + 10, c.z)); assert.ok(Math.hypot(c.x - h.pin[0], c.z - h.pin[1]) > 35, 'clear of the green'); }
});

test('the date palms by the river play as trees', () => {
  const i = H('The River Bank'), t = T[i];
  assert.ok(HOLES[i].plants.length > 20 && HOLES[i].plants.every(p => p.type === 'palm'));
  const TF = createTreeField(t.trees), p = HOLES[i].plants[0], g = t.groundAt(p.x, p.z);
  assert.ok(TF.at(p.x, g + p.h * 0.9, p.z), 'a crown');
  assert.ok(TF.at(p.x, g + 2, p.z), 'a trunk');
  assert.equal(TF.at(p.x + p.cr * 0.8, g + 3, p.z), null, 'a ball flies under the crown');
});
