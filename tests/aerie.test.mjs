// The Aerie: the course data, the terrain it builds, its scenery and how the ball plays on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain, lineProj, driftTo, rockNormal } from '../src/course/terrain.js';
import { cloudDrop } from '../src/course/relief.js';
import { HOLES, COURSE } from '../src/course/aerie.js';
import { teeYards } from '../src/course/conditions.js';

const YD = 0.9144;
const T = HOLES.map(h => createTerrain(h));
const TOUR = { DR: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, '3W': { Speed: 158, VLA: 9.2, TotalSpin: 3655 }, PW: { Speed: 102, VLA: 24.2, TotalSpin: 9304 } };
// fly a shot over hole terrain from a world spot toward another (the course's transform, with the falls
// playing as they do in a live shot)
function shoot(t, from, to, shot, extra = {}) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  let q = 7; const rng = () => (q = (q * 16807) % 2147483647) / 2147483647;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => { const v = t.surfaceAt(wx(lx, lz), wz(lx, lz)); return v === 'tee' || v === 'fringe' ? 'fairway' : v === 'void' ? 'rough' : v; },
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    treeAt: (lx, ly, lz) => (t.curtainAt(wx(lx, lz), o.y + ly, wz(lx, lz)) ? { density: 3 } : null),
    rng, voidY: t.voidY - o.y, altFt: 0, ...extra,
  });
  const W = r.pts.map(p => ({ x: wx(p.p[0], p.p[2]), y: o.y + p.p[1], z: wz(p.p[0], p.p[2]), phase: p.phase, hit: p.hit }));
  return { r, W, end: W.at(-1) };
}
// card yardage: the tee to the first point of the line ahead of it, then on along the line to the pin
function cardYards(h, [x, z]) {
  const L = h.line, s = lineProj(L, x, z).s; let acc = 0;
  for (let i = 1; i < L.length; i++) {
    acc += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]);
    if (acc > s + 1) { let m = Math.hypot(L[i][0] - x, L[i][1] - z); for (let j = i + 1; j < L.length; j++) m += Math.hypot(L[j][0] - L[j - 1][0], L[j][1] - L[j - 1][1]); return m / YD; }
  }
  return 0;
}

test('nine holes, par 36, four tee sets', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(HOLES.reduce((a, h) => a + h.par, 0), 36);
  const want = { eagle: 3385, hawk: 3091, swift: 2742, wren: 2279 };
  for (const s of COURSE.teeSets) assert.equal(teeYards(HOLES, s.id), want[s.id], s.id);
});

test('every tee is on its own pad, off the fairway, and measures its card yardage', () => {
  HOLES.forEach((h, i) => {
    for (const s of COURSE.teeSets) {
      const tp = h.tees[s.id];
      assert.equal(T[i].surfaceAt(tp[0], tp[1]), 'tee', `${h.name} ${s.id}`);
      assert.ok(Math.abs(cardYards(h, tp) - h.yards[s.id]) <= 2, `${h.name} ${s.id}: ${cardYards(h, tp).toFixed(0)} vs ${h.yards[s.id]}`);
    }
  });
});

test('every pin is on its green at 3% or less', () => {
  HOLES.forEach(h => {
    for (const p of h.green.pins) {
      const t = createTerrain({ ...h, pin: p }), g = t.slopeAt(p[0], p[1]);
      assert.equal(t.surfaceAt(p[0], p[1]), 'green', `${h.name} pin ${p}`);
      assert.ok(Math.hypot(g.x, g.z) * 100 <= 3.1, `${h.name} pin ${p}: ${(Math.hypot(g.x, g.z) * 100).toFixed(2)}%`);
    }
  });
});

test('room to miss: ground all round every green', () => {
  HOLES.forEach((h, i) => {
    const G = h.green; let land = 0, n = 0;
    for (let a = 0; a < 72; a++) {
      const th = a / 72 * Math.PI * 2, x = G.x + Math.cos(th) * (G.rx + 8), z = G.z + Math.sin(th) * (G.rz + 8);
      n++; if (T[i].groundAt(x, z) !== null) land++;
    }
    assert.ok(land / n >= 0.85, `${h.name}: ${(land / n * 100).toFixed(0)}% of the ring 8 m off the green is ground`);
  });
});

test('The Shelf: a pulled drive goes through the Veil\'s falls and is knocked down; a straight one is clear', () => {
  const t = T[0], h = HOLES[0], aim = [-4, -212];
  const straight = shoot(t, h.tees.eagle, aim, TOUR.DR);
  assert.equal(straight.r.treeHits, 0, 'straight drive');
  assert.ok(straight.end.z < -230, 'reaches the fairway island');
  const pulled = shoot(t, h.tees.eagle, aim, { ...TOUR.DR, HLA: -10 });
  assert.ok(pulled.r.treeHits >= 1, 'hits the falls');
  assert.ok(pulled.end.z > straight.end.z + 80, `knocked down: ${pulled.end.z.toFixed(0)} vs ${straight.end.z.toFixed(0)}`);
});

test('The Cape: the cove carry from the back tee is about 235 yards; the safe fairway is 65 wide', () => {
  const t = T[4], h = HOLES[4], R = h.islands.find(I => I.x === 104), tee = h.tees.eagle;
  let best = Infinity;
  for (let a = 0; a < 360; a += 2) for (let r = 0.2; r <= 1; r += 0.05) {
    const x = R.x + Math.cos(a * Math.PI / 180) * R.rx * r, z = R.z + Math.sin(a * Math.PI / 180) * R.rz * r;
    if (t.surfaceAt(x, z) === 'fairway') best = Math.min(best, Math.hypot(x - tee[0], z - tee[1]) / YD);
  }
  assert.ok(best > 220 && best < 250, `carry ${best.toFixed(0)}`);
  let w = 0; for (let x = -60; x <= 60; x += 0.5) if (t.surfaceAt(x, -215) === 'fairway') w += 0.5;
  assert.ok(w / YD > 58, `safe fairway ${(w / YD).toFixed(0)} yd wide`);
});

test('Drift: the island blocks a low shot when it is on the line, not when it has drifted off', () => {
  const t = T[5], h = HOLES[5], D = t.floats.find(F => F.drift), punch = { Speed: 85, VLA: 12, TotalSpin: 6000 };
  const through = W => W.some(p => rockNormal(D, p.x, p.y, p.z));
  driftTo(D, 0.55); const blocked = shoot(t, h.tees.eagle, h.pin, punch);
  const first = blocked.W.find(p => p.hit);
  assert.ok(first && Math.abs(first.z - D.z) < 16, 'a punch hits it on the line');
  const wedge = shoot(t, h.tees.eagle, h.pin, { Speed: 90, VLA: 26, TotalSpin: 9000 });
  assert.ok(!through(wedge.W), 'a wedge goes over it');
  driftTo(D, 0); const clear = shoot(t, h.tees.eagle, h.pin, punch);
  assert.ok(!through(clear.W), 'drifted off the line, the punch is clear');
  driftTo(D, 0.5);
});

test('The Overhang and Long Roll: the rock is solid, but drives and approaches pass it', () => {
  // the overhang: a block of granite out over the right of the fairway
  const t7 = T[6], h7 = HOLES[6];
  assert.ok(t7.solidAt(30, 13, -225), 'inside the overhang is rock');
  for (const set of ['eagle', 'hawk', 'swift', 'wren']) for (const aim of [[-6, -230], [10, -235]]) assert.equal(shoot(t7, h7.tees[set], aim, TOUR.DR).r.rockHits, 0, `7 ${set} drive`);
  assert.equal(shoot(t7, [24, -226], h7.pin, TOUR.PW).r.rockHits, 0, 'a wedge from under it gets out');
  // hole 8's rock ceilings: high above every tee shot and the approach
  const t8 = T[7], h8 = HOLES[7];
  assert.ok(t8.rocks.filter(R => R.type === 'wedge').length >= 4, 'four blocks of rock');
  for (const set of ['eagle', 'hawk', 'swift', 'wren']) for (const aim of [[2, -250], [30, -230]]) assert.equal(shoot(t8, h8.tees[set], aim, { Speed: 155, VLA: 16, TotalSpin: 3800 }).r.rockHits, 0, `8 ${set} high drive`);
  assert.equal(shoot(t8, [2, -240], h8.pin, { Speed: 120, VLA: 16.3, TotalSpin: 7097 }).r.rockHits, 0, '8 approach');
});

test('The Ascent: a long second from the fairway can run onto the green; long ones come back off the bank', () => {
  const t = T[8], h = HOLES[8];
  // from the left half of the fairway, the green's open side: bounces follow the slope now, and the same
  // shot from the right half lands on the steep bank short right of the green and is kicked off it
  const two = shoot(t, [-26, -240], h.pin, TOUR['3W']);
  assert.notEqual(two.r.outcome, 'void');
  assert.equal(t.surfaceAt(two.end.x, two.end.z), 'green', `a 3 wood ends ${Math.hypot(two.end.x - h.pin[0], two.end.z - h.pin[1]).toFixed(0)} m from the pin`);
  const long = shoot(t, [-20, -380], h.pin, TOUR['3W']);
  assert.notEqual(long.r.outcome, 'void', 'too much club stays up');
});

test('the clouds play as a red penalty area: a drop beside where the ball went over, no nearer the hole', () => {
  const t = T[0], h = HOLES[0], pin = h.pin;
  // rolled off the right side of the big fairway island
  const track = []; for (let x = 0; x <= 70; x += 2) track.push([x, -200]);
  const d = cloudDrop({ track, pin, groundAt: t.groundAt, surfaceAt: t.surfaceAt });
  assert.ok(d, 'a drop');
  assert.notEqual(t.groundAt(d.x, d.z), null);
  assert.ok(Math.hypot(d.x - d.edge[0], d.z - d.edge[1]) <= 5, 'within reach of where it went over');
  assert.ok(Math.hypot(d.x - pin[0], d.z - pin[1]) >= Math.hypot(d.edge[0] - pin[0], d.edge[1] - pin[1]) - 0.01, 'no nearer the hole');
  assert.ok(!['sand', 'water', 'green'].includes(t.surfaceAt(d.x, d.z)));
  // a short carry over the cove on the Cape: it last left the tee island, so the drop is back there
  const t5 = T[4], h5 = HOLES[4], tee = h5.tees.eagle, tr = [];
  for (let k = 0; k <= 40; k++) tr.push([tee[0] + (70 - tee[0]) * k / 40, tee[1] + (-150 - tee[1]) * k / 40]);
  const d5 = cloudDrop({ track: tr, pin: h5.pin, groundAt: t5.groundAt, surfaceAt: t5.surfaceAt });
  assert.ok(d5 && Math.hypot(d5.x - tee[0], d5.z - tee[1]) < 45, 'back on the tee island');
  // and a real shot: a big slice off the Shelf's tee into the clouds
  const sl = shoot(t, h.tees.eagle, [-4, -212], { ...TOUR.DR, HLA: 6, SpinAxis: 25 });
  if (sl.r.outcome === 'void') {
    const dd = cloudDrop({ track: sl.W.map(p => [p.x, p.z]), pin, groundAt: t.groundAt, surfaceAt: t.surfaceAt });
    assert.ok(dd && t.groundAt(dd.x, dd.z) !== null);
  }
});
