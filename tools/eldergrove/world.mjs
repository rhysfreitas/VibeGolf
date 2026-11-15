// Eldergrove, in world space (metres; x east, -z north, y up). Pure, no DOM.
// An ancient forest of conifers about 100 m tall, the trunks 8-12 m across, the first branches about 60 m up; one
// colossal heart tree at the origin (60 m across, buttress roots out to about 100 m). An open meadow outside the
// forest to the west (the 1st tee stands in it); a sunlit meadow, the Glade, on a hillside north of the heart tree
// (the 5th). The brook runs from the Glade's west end past the 6th green, down the 7th's valley, across it in a little
// ravine, and on south past the 1st green. A black pool inside the 4th's bend. A fallen giant along the 3rd. The
// burnt shell of a giant round the 8th green. V(X, Z) is the ground without the holes; each hole's ground follows it
// away from its line (scene.mjs). Points below are written [x east, n north] as in claude/eldergrove-layout.md and
// turned to [X, Z = -n] by `w`.
//
// The forest's logic lives in the trees (scene.mjs gathers them): a trunk is a wall that soaks 45% of the balls
// that hit it (they drop at its foot, as on The Reclaim's facades; Rhys's pick, 14 November 2026), and the canopy
// 60 m up knocks a skied ball down. The lies: moss (plays as first cut), fern (rough), leaf litter (beach: firm, it
// runs), root (native: it kicks, a bad lie now and then).
import { clamp, smooth, lerp, project, seDist, lengthOf, at } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

export const w = p => [p[0], -p[1]];
const W = P => P.map(w);

// ---- the playing lines from the layout doc (tee, corners, pin), approved 14 November 2026
export const LINES = [
  [[-620, -520], [-400, -560], [-263, -521]],
  [[-200, -565], [310, -525]],
  [[370, -470], [400, -330], [455, -176]],
  [[440, -130], [460, 60], [355, 222]],
  [[300, 290], [100, 380], [-100, 332]],
  [[-170, 300], [-281, 219]],
  [[-330, 170], [-380, -60], [-261, -252]],
  [[-200, -300], [-27, -290]],
  [[30, -240], [-140, -150], [-89, 54]],
];
const WLINES = LINES.map(W);
export const lineD = (X, Z) => { let d = Infinity; for (const L of WLINES) d = Math.min(d, project(L, X, Z).d); return d; };

// ---- the floor: a smooth surface through control heights (Gaussian RBFs, as the other plan tools), the holes'
// heights from the layout doc along their lines (net: 1 -6, 2 +5, 3 +5, 4 +1, 5 +13, 6 -1 from the floor, 7 -8,
// 8 +7, 9 -6) and the forest floor between
function rbf(ctrl, SIG, REG) {
  const n = ctrl.length, phi = d2 => Math.exp(-d2 / (2 * SIG * SIG));
  const M = ctrl.map(a => [...ctrl.map(b => phi((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) + (a === b ? 0.03 : 0)), a[2] - REG]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const wt = M.map((row, i) => row[n] / row[i]), R = SIG * 4;
  return (x, nn) => { let y = REG; for (let i = 0; i < n; i++) { const dx = x - ctrl[i][0], dn = nn - ctrl[i][1]; if (Math.abs(dx) < R && Math.abs(dn) < R) y += wt[i] * phi(dx * dx + dn * dn); } return y; };
}
export const FLOOR = [
  // the 1st: from the meadow down a stream valley into the forest
  [-700, -520, 49], [-660, -520, 48.6], [-620, -520, 48], [-560, -531, 47.2], [-503, -541, 46.3], [-450, -551, 45.4], [-400, -560, 44.5], [-350, -546, 43.6], [-300, -532, 42.6], [-263, -521, 42],
  [-700, -430, 50], [-700, -620, 50], [-560, -455, 49.5], [-560, -615, 48.5], [-430, -480, 48], [-430, -640, 47], [-320, -455, 46], [-320, -610, 42],
  // the 2nd: the Avenue, rising to a crest at 238 m (260 yd) and running on down beyond it
  [-200, -565, 43.5], [-140, -560, 44.3], [-80, -556, 45.2], [-22, -551, 46.3], [8, -549, 48.4], [37, -546, 50.5], [66, -544, 48.4], [97, -542, 46.3], [160, -537, 46.8], [230, -531, 47.6], [310, -525, 48.5],
  [-60, -625, 45.5], [-60, -490, 47.5], [100, -610, 47], [100, -475, 49], [250, -595, 47.5], [250, -465, 49.5],
  // the 3rd: the low road on the floor, the green up on the level of the fallen giant's back
  [370, -470, 47], [376, -440, 46.8], [384, -400, 46.3], [391, -370, 46], [400, -330, 45.7], [413, -293, 45.6], [427, -254, 45.9], [441, -215, 46.3], [448, -195, 51], [455, -176, 52], [465, -150, 52.4],
  // the 4th round the pool
  [440, -130, 52], [450, -40, 51.6], [460, 60, 51.8], [425, 115, 52.2], [390, 170, 52.6], [355, 222, 53], [372, 72, 50.5], [330, 40, 51.5], [330, 120, 52], [520, 0, 51], [520, 150, 52],
  // the 5th up the Glade's hillside (it leans 9% to the south across the line)
  [300, 290, 55], [250, 312, 57], [200, 335, 59], [150, 357, 61], [100, 380, 63], [50, 368, 65], [0, 356, 66.5], [-50, 344, 67.5], [-100, 332, 68],
  [300, 390, 61], [200, 425, 65], [100, 460, 69], [0, 440, 72], [-100, 420, 74], [250, 240, 51.5], [150, 270, 55], [50, 280, 59], [-50, 270, 61],
  // the 6th (the floor round the stair tree) and the 7th down its valley, the brook on its east side
  [-170, 300, 62], [-225, 260, 61], [-281, 219, 60.5], [-330, 170, 60], [-340, 120, 59.2], [-350, 70, 58.4], [-360, 20, 57.4], [-370, -20, 56.4], [-380, -60, 55.5],
  [-350, -108, 54.6], [-322, -150, 53.8], [-290, -205, 52.6], [-261, -252, 52], [-430, 100, 63], [-440, -40, 61], [-250, 60, 61], [-245, -80, 57],
  // the 8th, up 7 m to the shelf inside the burnt shell
  [-200, -300, 50], [-150, -297, 50.5], [-100, -294, 52], [-62, -292, 54.5], [-27, -290, 57], [2, -289, 57.5],
  // the 9th, down round the heart tree to the amphitheatre at its west-north-west foot
  [30, -240, 58], [-20, -214, 57.3], [-80, -182, 56.3], [-140, -150, 55.5], [-128, -100, 54.5], [-115, -50, 53.5], [-102, 0, 52.8], [-89, 54, 52],
  // the forest floor between the holes and round about
  [-500, -400, 49.5], [-450, -300, 52], [-400, -200, 56], [-470, 0, 60], [-470, 200, 63], [-300, 350, 64], [-160, 440, 73], [100, 520, 74], [320, 460, 64], [460, 340, 58], [560, 150, 54],
  [560, -100, 51], [560, -350, 49], [460, -600, 48], [200, -660, 46], [0, -660, 45], [-200, -690, 41], [-420, -710, 44], [-660, -720, 48], [-660, -350, 51],
  [-230, -410, 47], [-80, -420, 50], [100, -420, 52], [250, -380, 51], [250, -200, 54], [150, -150, 56], [250, 0, 56], [250, 150, 56], [150, 150, 58], [-200, 120, 61],
  [-250, -90, 56], [-200, -200, 53], [-50, -330, 55], [100, -300, 56], [330, -300, 49], [-40, 40, 57], [60, 0, 60], [0, -80, 59], [0, 80, 62],
];
const floorAt = rbf(FLOOR, 58, 52);
// the forest floor's own roll: swells 40-90 m across, about a metre, and humps over old fallen trunks
export const roll = (X, Z) => 0.75 * noise2(X / 70, Z / 70, 61) + 0.35 * noise2(X / 31, Z / 31, 62) + 0.12 * noise2(X / 11, Z / 11, 63);
export function floorWorld(X, Z) { return floorAt(X, -Z) + roll(X, Z); }

// ---- the meadow west of the forest (the 1st tee stands in it) and the Glade, a sunlit meadow on the hillside
// north of the heart tree (round the 5th). Each: 1 inside, 0 under the trees, a soft ragged edge
export const meadowAt = (X, Z) => 1 - smooth((X + 592 + 22 * noise1(-Z / 55, 71) + 8 * noise1(-Z / 17, 72)) / 10);
export const GLADE = { c: w([90, 345]), rx: 255, rz: 105, rot: 8 * Math.PI / 180 };
export const gladeAt = (X, Z) => { const e = seDist({ x: GLADE.c[0], z: GLADE.c[1], rx: GLADE.rx, rz: GLADE.rz, rot: GLADE.rot, p: 2.2 }, X, Z) + 0.07 * noise2(X / 60, Z / 60, 73) + 0.03 * noise2(X / 19, Z / 19, 74); return 1 - smooth((e - 0.97) / 0.06); };
export const openAt = (X, Z) => Math.max(meadowAt(X, Z), gladeAt(X, Z));

// ---- the brook: from the Glade's west end, past the 6th green (front, then left), down the 7th's valley, across
// it in a little ravine at 87% of its line, and on south round the 1st green's back and right side. Its bed falls
// all the way (the floor under it, cut 1.2 m, never rising downstream); the water stands 0.35 m in the bed. In the
// ravine on the 7th it cuts 3.5 m deeper, 16 m across.
export const BROOK = W([[-150, 382], [-196, 330], [-235, 268], [-258, 233], [-268, 205], [-280, 170], [-292, 110], [-298, 40], [-300, -40], [-303, -110], [-294, -203],
  [-302, -262], [-296, -330], [-282, -400], [-252, -470], [-232, -520], [-246, -556], [-255, -620], [-250, -720]]);
const BROOK_LEN = lengthOf(BROOK);
export const RAVINE = { c: w([-294, -203]), half: 30, deep: 3.5 };   // at 87% of the 7th's line, so the lay-up leaves 90 yd
const BED = (() => {   // the bed's height every 2 m along the brook, never rising downstream
  const out = []; let m = Infinity;
  for (let s = 0; s <= BROOK_LEN + 2; s += 2) { const [X, Z] = at(BROOK, Math.min(s, BROOK_LEN)); m = Math.min(m, floorAt(X, -Z) - 1.2); out.push(m); }
  return out;
})();
const bedAtS = s => { const f = clamp(s / 2, 0, BED.length - 1), i = Math.floor(f); return lerp(BED[i], BED[Math.min(BED.length - 1, i + 1)], f - i); };
const brookHW = s => 2.6 + 1.6 * clamp(s / BROOK_LEN, 0, 1) + 0.6 * noise1(s / 23, 75);   // 2.6 m wide at the top, about 4 m by the 1st green
export function brookAt(X, Z) {   // { d (metres outside the water), s, bed, hw, ravine (0-1) }, or null far away
  if (X < -330 || X > -130 || Z < -400 || Z > 740) return null;
  const pr = project(BROOK, X, Z); if (pr.d > 60) return null;
  const rv = Math.exp(-((Math.hypot(X - RAVINE.c[0], Z - RAVINE.c[1]) / RAVINE.half) ** 2));
  return { d: pr.d - brookHW(pr.s) * (1 + 1.2 * rv), s: pr.s, bed: bedAtS(pr.s) - RAVINE.deep * rv, hw: brookHW(pr.s), ravine: rv };
}

// ---- the pool inside the 4th's bend: black still water about 110 x 90 m, level 50.2
export const POOL = { c: w([372, 72]), rx: 56, rz: 44, rot: -24 * Math.PI / 180, p: 2.1, level: 50.2 };
export const poolE = (X, Z) => seDist({ x: POOL.c[0], z: POOL.c[1], rx: POOL.rx, rz: POOL.rz, rot: POOL.rot, p: POOL.p }, X, Z) + 0.05 * noise2(X / 23, Z / 23, 81) + 0.02 * noise2(X / 8, Z / 8, 82);

// ---- the heart tree: a trunk 60 m across at the origin, its root mound rising toward it and its buttress roots
// radiating out to about 100 m (none toward the 9th green: the amphitheatre's roots are the 9th's own, holes.mjs)
export const HEART = { c: [0, 0], r: 30, h: 260, low: 0.55, cr: 95, roots: 104 };
const BUTTRESS = [20, 62, 105, 150, 196, 238, 345].map(a => a * Math.PI / 180);   // bearings of the big roots (not 270-330: the 9th's side)
export function heartAt(X, Z) {   // { lift, root (0-1: on a root) }
  const dx = X, dz = Z, r = Math.hypot(dx, dz); if (r > 140) return { lift: 0, root: 0 };
  const mound = 7 * (1 - smooth((r - HEART.r) / 80));
  const brg = Math.atan2(dx, -dz); let rt = 0;
  for (const b of BUTTRESS) {
    let da = Math.abs(((brg - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI); const off = da * r, wd = 6 + 3 * (1 - (r - HEART.r) / 80);
    if (r < HEART.r || r > HEART.roots + 10) continue;
    rt = Math.max(rt, Math.exp(-((off / wd) ** 2)) * (1 - smooth((r - HEART.roots + 10) / 20)));
  }
  return { lift: mound + 4.5 * rt * (1 - smooth((r - HEART.r - 40) / 60) * 0.6), root: rt };
}

// ---- the fallen giant along the left of the 3rd: its crown end (broken, the ramp up) near the tee, its root end
// toward the green, its back 28 m wide and 6 m up; the root plate stands on end at the root end
export const FALLEN = { a: w([347, -409]), b: w([407, -253]), top: 28, h: 6, ramp: 46, flank: 3.5, name: 'the fallen giant' };
export const ROOTPLATE = { c: w([392, -241]), r: 16, h: 12, t: 4, name: 'the root plate' };   // torn off to the left of the trunk's end, so the high road's wedge passes it
export function fallenAt(X, Z) {   // { lift, on (0-1: on its back), flank (0-1: on its sides) }
  const A = FALLEN.a, Bp = FALLEN.b, L = [A, Bp], len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
  const pr = project(L, X, Z); if (pr.d > FALLEN.top / 2 + 14) return { lift: 0, on: 0, flank: 0 };
  // past the root end it stops square (the plate); before the crown end the broken crown ramps down to the floor
  const ax = (Bp[0] - A[0]) / len, az = (Bp[1] - A[1]) / len, sAlong = (X - A[0]) * ax + (Z - A[1]) * az;
  if (sAlong > len + 2 || sAlong < -2) return { lift: 0, on: 0, flank: 0 };
  const hw = FALLEN.top / 2 + 1.2 * noise1(sAlong / 21, 91), e = Math.abs(pr.off) - hw;
  const ramp = smooth(sAlong / FALLEN.ramp), end = 1 - smooth((sAlong - len + 1.5) / 1.5);
  const across = e <= 0 ? 1 : 1 - smooth(e / FALLEN.flank);
  const crown = 0.35 * Math.cos(Math.PI * clamp(pr.off / (hw * 1.15), -1, 1) / 2) - 0.35;   // a gentle round back
  return { lift: (FALLEN.h + crown) * ramp * across * end, on: e <= 0 && ramp > 0.2 ? 1 : 0, flank: e > 0 && across > 0.05 ? 1 : 0, s: sAlong, off: pr.off };
}

// ---- the ground
export function V(X, Z) {
  let y = floorWorld(X, Z);
  y += heartAt(X, Z).lift;
  return wet(X, Z, y);
}
// the brook's channel and the pool's basin cut into the ground (applied to the holes' own ground too)
export function wet(X, Z, y) {
  const b = brookAt(X, Z);
  if (b && b.d < 18 + 10 * b.ravine) {
    const into = b.d, bank = into < 0 ? b.bed : b.bed + 0.35 + into * (0.55 + 0.9 * b.ravine);
    y = lerp(Math.min(y, bank), y, smooth((into - 2 - 6 * b.ravine) / (10 + 6 * b.ravine)));
  }
  const pe = poolE(X, Z);
  if (pe < 1.7) {
    const r = Math.min(POOL.rx, POOL.rz), into = (pe - 1) * r, bed = POOL.level - 1.6, bank = into < 0 ? Math.max(bed, POOL.level - 0.25 + into * 0.12) : POOL.level + 0.3 + into * 0.05;
    y = lerp(Math.min(y, bank), y, smooth((into - 6) / 26));
  }
  return y;
}
export function waterAt(X, Z) {
  if (poolE(X, Z) < 1) return { level: POOL.level, body: 'pool' };
  const b = brookAt(X, Z); if (b && b.d < 0) return { level: b.bed + 0.35, body: b.ravine > 0.3 ? 'ravine' : 'brook' };
  return null;
}

// ---- the built and grown things that belong to no one hole, in world space (the holes' own trunks are in
// holes.mjs): the burnt shell round the 8th green, the root plate, the hall's doors, the stair, the root bridge.
// Boxes { kind, at, w (across), l (along), h, rot (compass bearing of its length), soak }; rings { kind: 'shell' }
export const SHELL = { c: w([-22, -289]), r: 25, t: 3.5, h: 15, open: 270, gap: 105, name: 'the burnt shell' };   // open toward the west (the tee), the gap 105° wide
export const SITES = [
  { kind: 'plate', at: ROOTPLATE.c, r: ROOTPLATE.r, h: ROOTPLATE.h, t: ROOTPLATE.t, rot: 21 * Math.PI / 180, name: 'the root plate' },
  { kind: 'shell', at: SHELL.c, r: SHELL.r, t: SHELL.t, h: SHELL.h, open: SHELL.open, gap: SHELL.gap, name: 'the burnt shell' },
  { kind: 'doors', at: w([-62, 92]), w: 14, l: 3, h: 9, rot: 120 * Math.PI / 180, name: "the hall's doors" },
  { kind: 'bridge', at: w([-299, -150]), w: 3, l: 18, h: 1.6, rot: 90 * Math.PI / 180, name: 'the root bridge', scenery: true },
];
export const LABELS = [[w([-650, -470]), 'the meadow'], [w([90, 420]), 'the Glade'], [w([372, 72]), 'the pool'], [[0, 0], 'the heart tree'], [w([-300, 30]), 'the brook'],
  [w([-294, -203]), 'the ravine'], [w([378, -330]), 'the fallen giant'], [w([-22, -289]), 'the burnt shell']];
export { floorAt };
