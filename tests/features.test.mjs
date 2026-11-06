// Shaped course features: greens, bunkers, landforms, ponds, tee pads and rough cuts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';

// a flat mesa, a straight hole down -z
const base = (extra = {}) => ({
  par: 4, line: [[0, 0], [0, -400]], pin: [0, -380], tees: { back: [0, 0], fwd: [0, -60] },
  floor: { y: -40, relief: 0 },
  islands: [{ x: 0, z: -200, rx: 160, rz: 300, p: 4, top: 0, depth: 40, kind: 'mesa', seed: 1, relief: 0 }],
  fairways: [{ pts: [[0, -150, 18], [0, -340, 18]] }],
  ...extra,
});
const phys = s => (s === 'tee' || s === 'fringe' ? 'fairway' : s === 'void' ? 'rough' : s);
function roll(t, from, to, shot) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))), voidY: t.voidY - o.y,
  });
  const e = r.pts.at(-1).p;
  return { r, x: wx(e[0], e[2]), z: wz(e[0], e[2]) };
}
const grade = (t, x, z) => { const g = t.slopeAt(x, z); return Math.hypot(g.x, g.z) * 100; };

test('rough cuts step out from the fairway, with native desert beyond the corridor and across the carry', () => {
  const t = createTerrain(base());
  assert.equal(t.surfaceAt(0, -250), 'fairway');
  assert.equal(t.surfaceAt(19, -250), 'firstcut');
  assert.equal(t.surfaceAt(26, -250), 'rough');
  assert.equal(t.surfaceAt(60, -250), 'desert');
  assert.equal(t.surfaceAt(0, -90), 'desert', 'the carry from the back tee is native');
  assert.equal(t.surfaceAt(0, -12), 'rough', 'in front of the back tee is rough');
});

test('tee pads are raised, level and mown', () => {
  const t = createTerrain(base());
  assert.equal(t.surfaceAt(0, 0), 'tee'); assert.equal(t.surfaceAt(0, -60), 'tee');
  assert.ok(t.groundAt(0, 0) > 0.3, 'raised');
  assert.ok(grade(t, 1, -2) < 1, 'level');
  assert.equal(t.surfaceAt(0, 9), 'rough', 'a rough collar around the pad');
});

test('a false front sends a short approach back off the green; a good one holds', () => {
  const g = { x: 0, z: -380, rx: 14, rz: 12, style: 'plateau', falseFront: 0.7, pins: [[0, -382]] };
  const t = createTerrain(base({ green: g }));
  assert.equal(t.surfaceAt(0, -380), 'green');
  // a low pitch that lands on the front edge
  const short = roll(t, [0, -340], [0, -380], { Speed: 44, VLA: 24, TotalSpin: 4000 });
  const good = roll(t, [0, -340], [0, -380], { Speed: 56, VLA: 26, TotalSpin: 6500 });
  assert.notEqual(t.surfaceAt(short.x, short.z), 'green', `short one finished at z ${short.z.toFixed(1)}`);
  assert.equal(t.surfaceAt(good.x, good.z), 'green', `good one finished at z ${good.z.toFixed(1)}`);
});

test('every green style keeps its pins at 3% or less', () => {
  for (const style of ['tilt', 'tiered', 'crowned', 'plateau', 'punchbowl', 'redan', 'biarritz']) {
    const pins = style === 'biarritz' ? [[0, -370], [0, -392]] : style === 'tiered' ? [[0, -374], [0, -387]] : [[0, -380], [6, -375]];
    const t = createTerrain(base({ green: { x: 0, z: -380, rx: 15, rz: style === 'biarritz' ? 22 : 13, style, pins } }));
    for (const p of pins) assert.ok(grade(t, ...p) <= 3.05, `${style} pin ${p}: ${grade(t, ...p).toFixed(2)}%`);
  }
});

test('greens roll between the pins: steeper than the cupping areas', () => {
  const t = createTerrain(base({ green: { x: 0, z: -380, rx: 15, rz: 13, pins: [[0, -380], [6, -375]] } }));
  let steepest = 0;
  for (let u = -12; u <= 12; u += 1.5) for (let b = -10; b <= 10; b += 1.5) {
    const x = u, z = -380 - b; if (t.surfaceAt(x, z) !== 'green' || Math.hypot(x, z + 380) < 5 || Math.hypot(x - 6, z + 375) < 5) continue;
    const g = t.slopeAt(x, z); steepest = Math.max(steepest, Math.hypot(g.x, g.z) * 100);
  }
  assert.ok(steepest > 3.5, `steepest roll ${steepest.toFixed(1)}%`);
});

test('a tiered green has a real step and a biarritz a real swale', () => {
  const tiered = createTerrain(base({ green: { x: 0, z: -380, style: 'tiered' } }));
  assert.ok(tiered.groundAt(0, -387) - tiered.groundAt(0, -374) > 0.8, 'back tier sits higher');
  const bz = createTerrain(base({ green: { x: 0, z: -380, style: 'biarritz' } }));
  const mid = bz.groundAt(0, -380), front = bz.groundAt(0, -368), back = bz.groundAt(0, -392);
  assert.ok(front - mid > 0.7 && back - mid > 0.7, 'swale through the middle');
});

test('a ball that trickles into a bunker stays in it', () => {
  const t = createTerrain(base({ bunkers: [{ x: 0, z: -230, rx: 7, rz: 5, style: 'flashed' }] }));
  assert.equal(t.surfaceAt(0, -230), 'sand');
  assert.ok(t.groundAt(0, -230) < -0.6, 'a real bowl');
  const r = roll(t, [0, -206], [0, -230], { Speed: 30, VLA: 5, TotalSpin: 1500 });
  assert.equal(t.surfaceAt(r.x, r.z), 'sand', `ended at z ${r.z.toFixed(1)}`);
});

test('a speed slot adds yards to a drive that finds it', () => {
  const drive = { Speed: 140, VLA: 13, TotalSpin: 3100 };
  const flat = roll(createTerrain(base()), [0, 0], [0, -400], drive);
  const slot = createTerrain(base({ landforms: [{ type: 'step', x: 0, z: -212, length: 34, width: 36, height: 6, run: 60 }] }));
  const fast = roll(slot, [0, 0], [0, -400], drive);
  assert.ok(-fast.z > -flat.z + 8, `slot ${(-fast.z).toFixed(0)} m vs flat ${(-flat.z).toFixed(0)} m`);
});

test('ridges and side tilts move a rolling ball sideways', () => {
  const t = createTerrain(base({ landforms: [{ type: 'tilt', x: 0, z: -250, length: 120, width: 40, grade: 6 }] }));
  const r = roll(t, [0, -200], [0, -400], { Speed: 30, VLA: 4, TotalSpin: 900 });
  assert.ok(r.x < -1.5, `kicked left to x ${r.x.toFixed(1)}`);
});

test('a ball into a pond ends in the water', () => {
  const t = createTerrain(base({ water: [{ x: 0, z: -300, rx: 14, rz: 10 }] }));
  assert.equal(t.surfaceAt(0, -300), 'water');
  assert.equal(t.surfaceAt(0, -330), 'fairway', 'dry ground around it');
  const r = roll(t, [0, -202], [0, -300], { Speed: 85, VLA: 22, TotalSpin: 6500 });
  assert.equal(t.surfaceAt(r.x, r.z), 'water', `ended at z ${r.z.toFixed(1)}`);
});

// --- trees, boulders and rockfalls ---
import { createTreeField } from '../src/course/trees.js';
import { rng } from '../src/course/noise.js';
// fly a shot with rock and trees (seeded branch luck)
function flyAll(t, from, to, shot, seed = 1, trees = true) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const field = createTreeField(t.trees);
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => phys(t.surfaceAt(wx(lx, lz), wz(lx, lz))), voidY: t.voidY - o.y,
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    treeAt: trees ? (lx, ly, lz) => { const q = field.at(wx(lx, lz), o.y + ly, wz(lx, lz)); return q && q.n ? { n: [q.n[0] * c + q.n[2] * s, 0, -q.n[0] * s + q.n[2] * c] } : q; } : null,
    rng: rng(seed),
  });
  const e = r.pts.at(-1).p;
  return { r, x: wx(e[0], e[2]), z: wz(e[0], e[2]) };
}
const IRON = { Speed: 112, VLA: 18, TotalSpin: 6500 };

test('a grove of trees knocks most shots flown into it down; a shot over the top is untouched', () => {
  const t = createTerrain(base({ groves: [{ x: 0, z: -150, rx: 8, rz: 8, n: 4, type: 'cotton', s: [1.6, 1.6], seed: 3 }] }));
  assert.ok(t.trees.length >= 3, 'the grove has trees');
  const tallest = Math.max(...t.trees.map(tr => tr.y + 4.5 * tr.s + 3.6 * tr.s * 1.3));
  // a mid-height iron straight at it
  const low = { Speed: 100, VLA: 12, TotalSpin: 6000 }; // about 9 m up as it reaches the canopies
  const open = flyAll(t, [0, -60], [0, -250], low, 1, false);
  let hit = 0, short = 0;
  for (let k = 1; k <= 12; k++) { const s = flyAll(t, [0, -60], [0, -250], low, k); if (s.r.treeHits) hit++; if (s.z > open.z + 15) short++; }
  assert.ok(hit >= 8, `${hit} of 12 hit branches`);
  assert.ok(short >= 7, `${short} of 12 finished well short of the open-ground shot`);
  // a high wedge clears it
  const over = flyAll(t, [0, -60], [0, -250], { Speed: 100, VLA: 30, TotalSpin: 9000 }, 1);
  assert.ok(tallest < 20 && over.r.treeHits === 0, 'a high shot sails over');
});

test('a trunk turns a rolling ball back', () => {
  const t = createTerrain(base({ groves: [{ x: 0, z: -150, rx: 0.1, rz: 0.1, n: 1, type: 'juniper', s: [1, 1], seed: 2 }] }));
  const tr = t.trees[0];
  const s = flyAll(t, [tr.x, tr.z + 20], [tr.x, tr.z - 20], { Speed: 30, VLA: 1, TotalSpin: 300 });
  assert.ok(s.r.treeHits >= 1 || s.z > tr.z, 'it stops at or bounces off the trunk');
  assert.ok(s.z > tr.z - 0.5, `ends in front of the tree (${(s.z - tr.z).toFixed(1)} m)`);
});

test('a boulder is solid, and a rockfall heaps up toward its back with boulders over it', () => {
  const t = createTerrain(base({
    rocks: [{ type: 'boulder', x: 0, z: -200, r: 8, h: 10 }],
    rockfalls: [{ x: 60, z: -200, rx: 14, rz: 12, toward: [80, -200], height: 12, n: 20, size: [0.5, 2] }],
  }));
  const B = t.rocks.find(r => r.type === 'boulder' && r.r === 8), gy = t.groundAt(0, -200);
  assert.ok(t.solidAt(0, gy + 3, -200), 'inside the boulder is rock');
  assert.equal(t.solidAt(0, gy + 12, -200), null, 'above it is air');
  assert.ok(B);
  // a low iron straight into it stops short of it
  const s = flyAll(t, [0, -80], [0, -300], { Speed: 110, VLA: 9, TotalSpin: 5000 });
  assert.ok(s.r.rockHits >= 1 && s.z > -200, `stops in front of the boulder (${s.z.toFixed(0)})`);
  // the pile: low at the front, high at the back, native ground, boulders on it
  const front = t.groundAt(50, -200), back = t.groundAt(69, -200);
  assert.ok(back - front > 6, `rises ${(back - front).toFixed(1)} m toward the back`);
  assert.equal(t.surfaceAt(60, -200), 'desert');
  assert.ok(t.rocks.filter(r => r.type === 'boulder' && Math.hypot(r.x - 60, r.z + 200) < 15).length >= 12, 'boulders scattered over it');
});
