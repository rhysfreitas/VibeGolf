// Emerald Bay, in world space (metres; X east, Z south (= -north), y up above LOW WATER). Pure, no DOM.
// Plan book round 2 (24 November 2026): the bay of layout round 3 (tools/emeraldbay/r3, approved by Rhys the same
// day with the 4th moved to the inside): whole limestone islands spread over about 1.8 by 1.6 km with open water
// between every pair, the golf on their outer shores, the 4th up B's inside wall over the channel, only the Drop's
// green inside the Maya island's horseshoe. Points are written [x east, n north] and turned to [X, Z = -n] by `w`.
//
// The tide (round 0): the ground never moves; the sea stands at TIDES.low (0) or TIDES.high (2.4 m) for the round.
// Anything below the sea is water; intertidal sand (tag 'wet') is firm wet sand while it is dry.
//
// Each island is a whole massif (as in the island study): a ragged coast from superellipses, sheer walls from the
// sea, a steep jungle climb to a lumpy body and rounded summits. The golf sits on FLATS added at an island's foot (a
// strip along a line at its own height, leaning across, with a beach running down to the sea or a sheer edge), and
// on the tide holes' own ground (the 3rd's tongue, the Sandbar, the 9th's flats and spit), drawn in each line's frame.
import { clamp, smooth, lerp, project, seDist, at, lengthOf } from './geo.mjs';

export const TIDES = { low: 0, high: 2.4 };
export const HW = TIDES.high;
export const w = p => [p[0], -p[1]];
const W = P => P.map(w);

// ---- the playing lines (tee, corners, pin), layout round 3
export const LINES = [
  [[-484, -140], [-508, 45], [-500, 312]],             // 1 The Village: up the Maya island's outer west shore
  [[160.67, -40.95], [10, -95]],                        // 2 The Drop: off the ledge to the islet in the cove
  [[420, -345], [596, -385]],                           // 3 The Tongue: across the channel's mouth to an islet
  [[804, -102], [870, 60], [872, 240], [790, 370]],     // 4 The Coves: up the shelf on B's inside wall
  [[1075, 465], [905, 640], [838, 772]],                // 5 The Sandbar: across the channel to C
  [[833, 800], [833, 1000], [735, 1116]],               // 6 The Gap: between C and the Sentinel
  [[668, 1122], [545, 1042], [425, 1090]],              // 7 The Overhang: round the cove on C's north shore
  [[318, 915], [224, 842]],                             // 8 The Stack
  [[107, 566], [-30, 800], [-163, 766], [-300, 742]],   // 9 The Hong: from the tee rock up the right fairway, over a gap to the cave beach, through the cave; the island on the left. Round the spit (the long way), then through the cave; the island inside
];
export const WLINES = LINES.map(W);
export const onLine = (k, s, off = 0) => at(WLINES[k], s, off);
export const lineD = (X, Z) => { let d = Infinity; for (const L of WLINES) d = Math.min(d, project(L, X, Z).d); return d; };
const LEN = WLINES.map(lengthOf);
// a point's place along a hole's line (s, and off + right of travel), carried on straight past either end
export function lineCoord(k, X, Z) {
  const L = WLINES[k], p = project(L, X, Z);
  const ext = (a, b, base, s0) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return { s: s0 + ((X - base[0]) * dx + (Z - base[1]) * dz) / l, off: (dx * (Z - base[1]) - dz * (X - base[0])) / l, d: p.d }; };
  if (p.s <= 0.01) return ext(L[0], L[1], L[0], 0);
  if (p.s >= LEN[k] - 0.01) return ext(L.at(-2), L.at(-1), L.at(-1), LEN[k]);
  return p;
}

// ---- noise
const h1 = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise1(t, seed = 0) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(h1(i, seed), h1(i + 1, seed), u); }
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}
const fbm = (x, z, seed, oct = 4) => { let a = 0, f = 1, wt = 0.5; for (let o = 0; o < oct; o++) { a += wt * noise2(x * f, z * f, seed + o * 17); f *= 2.03; wt *= 0.5; } return a; };
const se = (x, n, rx, rn, rot = 0, p = 2.2) => ({ x, z: -n, rx, rz: rn, rot: rot * Math.PI / 180, p });
const sdSE = (o, X, Z) => (seDist(o, X, Z) - 1) * Math.min(o.rx, o.rz);
const segQ = (a, b, X, Z) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = clamp(((X - a[0]) * dx + (Z - a[1]) * dz) / L2, 0, 1); return { d: Math.hypot(X - a[0] - dx * t, Z - a[1] - dz * t), t }; };

// ---- the islands: massif = superellipses unioned, cut = taken out; peaks [x, n, r, h] over the body; wall: the sheer
// wall from the sea [lo, hi]; body: the massif's level under its summits [base, swing]
export const ISLANDS = {
  A: { name: 'the Maya island', massif: [se(-300, -40, 160, 300, 4, 2.4), se(300, -40, 165, 300, -4, 2.4), se(0, 260, 470, 150, 0, 2.5)], cut: [se(0, -170, 175, 255, 0, 2.2)],
    peaks: [[-300, 40, 150, 110], [-290, -200, 120, 80], [300, 0, 150, 100], [300, -210, 110, 70], [0, 300, 180, 120], [-200, 280, 120, 70], [210, 290, 120, 80]], wall: [70, 170], body: [150, 50] },
  // B: a shallow bight bitten out of its west side, so the 4th's shelf bows inland and its straight line runs out over the coves
  B: { name: 'the Shelf island', massif: [se(980, 180, 200, 300, -4, 2.4)], cut: [se(770, 150, 135, 285, 0, 2.2)], peaks: [[1010, 60, 140, 100], [1000, 300, 150, 120], [990, 430, 90, 60]], wall: [60, 150], body: [140, 45] },
  C: { name: 'the Overhang island', massif: [se(565, 920, 235, 150, 3, 2.4), se(785, 912, 45, 98, 0, 2.6)], cut: [se(540, 1078, 72, 58, 0, 2)], peaks: [[470, 930, 140, 90], [680, 900, 120, 80]], wall: [60, 150], body: [140, 40] },
  S: { name: 'the Sentinel', massif: [se(935, 920, 75, 95, -6, 2.6), se(880, 925, 35, 105, 0, 2.6)], cut: [], peaks: [[935, 920, 80, 70]], wall: [110, 170], body: [180, 20] },
  // D, the Hong: hollow round its lagoon, its east wall 85-95 m thick where the cave runs through it
  D: { name: 'the Hong', massif: [se(-420, 800, 230, 210, 0, 2.3)], cut: [se(-378, 790, 125, 100, 10, 2.1)], peaks: [[-510, 905, 110, 60], [-350, 655, 100, 45], [-570, 725, 90, 50]], wall: [60, 140], body: [130, 35] },
};
const KEYS = Object.keys(ISLANDS);
// the 6th's gap: the slot between C's east end and the Sentinel, kept open
export const GAP = { a: w([830, 790]), b: w([835, 1100]) };
// small islands: [the Drop's islet (the 2nd green, alone in the cove), the Tongue islet (the 3rd green), the cay (the 9th tee)]
export const ISLETS = [
  { name: 'the Drop islet', o: se(10, -95, 36, 30, 0, 2), y: 3.6, beach: 12 },
  { name: 'the Tongue islet', o: se(600, -385, 48, 36, 10, 2), y: 3.4, beach: 14 },
  { name: 'the cay', o: se(176, 756, 50, 32, 10, 2), y: 3.2, beach: 14 },
  // the 9th's tee: a rock in the open water south-west of the cay (Rhys, 25 November: the tee moved down and left)
  { name: 'the tee rock', o: se(116, 556, 34, 30, 0, 2), y: 6.5, beach: 8 },
];
// far islands round the horizon
const FAR = [
  { o: se(-1400, -200, 260, 160, 10, 2.3), peaks: [[-1400, -200, 220, 190]] },
  { o: se(1750, 100, 220, 150, -20, 2.3), peaks: [[1750, 100, 200, 170]] },
  { o: se(1400, 1600, 300, 180, 0, 2.4), peaks: [[1350, 1600, 260, 220], [1550, 1550, 160, 150]] },
  { o: se(-1200, 1550, 280, 160, 15, 2.4), peaks: [[-1200, 1550, 240, 200]] },
  { o: se(2400, 800, 320, 180, 0, 2.4), peaks: [[2400, 800, 280, 200]] },
  { o: se(-2200, 700, 300, 180, 0, 2.4), peaks: [[-2200, 700, 260, 220]] },
];

// ---- the flats: the golf's ground at the islands' foot. line [x, n]..., hw half width, y [y0, y1] along it, lean
// (rise per m toward +off, right of travel), edge 'beach' (runs down to the sea) or 'wall' (a sheer drop); sand: all beach
export const FLATS = [
  // 1: the stilt village at the west arm's south tip, then the terrace along the Maya island's outer west shore
  { id: 'vtip', line: [[-380, -330], [-470, -250]], hw: 30, y: [3.4, 4], lean: 0, edge: 'beach' },
  { id: 'west', line: [[-480, -250], [-512, 45], [-498, 340]], hw: 72, y: [16, 16.5], lean: 0.045, edge: 'beach', seaSide: -1, steps: [[382, -6, 16], [500, -6, 16]] },   // old coral terraces stepping down to the beach: the tee high by the village
  // the cove's head beach (the Maya beach): sand only, nothing played on it
  { id: 'head', line: [[-120, 75], [0, 95], [120, 75]], hw: 40, y: [3.2, 3.2], lean: 0, edge: 'beach', sand: true },
  // 3: the beach on the east arm's south tip
  { id: 'etip', line: [[320, -330], [425, -348]], hw: 30, y: [3.4, 3.6], lean: 0, edge: 'beach' },
  // 4: B's south-west beach (the tee), then the shelf up B's west wall over the channel (the one inside hole): from
  // the channel's sheer edge (7-8 m) leaning 6% up into the wall, 12 m at the line; coves bite in from the channel
  { id: 'bsw', line: [[840, -150], [805, -95]], hw: 30, y: [4, 6], lean: 0, edge: 'beach' },
  { id: 'shelf', line: [[800, -120], [836, 60], [840, 240], [766, 392]], hw: 74, y: [8.5, 15], lean: 0.09, edge: 'wall' },
  // 5: B's north point (the tee); C's south-east beach at the gap's mouth (the green)
  { id: 'bnorth', line: [[980, 515], [1088, 456]], hw: 32, y: [5, 4.5], lean: 0, edge: 'beach' },
  { id: 'gapmouth', line: [[880, 770], [800, 778]], hw: 36, y: [3.4, 3.6], lean: 0, edge: 'beach' },
  // 6: the gap's floor between C and the Sentinel, out onto C's north beach
  { id: 'gapfloor', line: [[830, 785], [832, 958]], hw: 34, y: [9.0, 4.3], lean: 0, edge: 'beach', land: true, pipe: 2.2, pipeW: 18 },   // a half-pipe: the floor dishes 2.2 m to its middle
  { id: 'gapfloor2', line: [[832, 958], [835, 1100]], hw: 34, y: [4.3, 4.0], lean: 0, edge: 'beach', land: true, pipe: 2.2, pipeW: 18 },   // and on out of the slot, level with the exit
  { id: 'gapexit', line: [[833, 960], [833, 1000], [740, 1110]], hw: 40, y: [4.2, 4.0], lean: 0, edge: 'beach', land: true, pipe: 2.2, pipeW: 18 },   // the floor carries on out of the slot to C's north beach
  { id: 'cnorth', line: [[835, 1100], [720, 1118], [640, 1112]], hw: 40, y: [4.6, 4.0], lean: -0.03, edge: 'beach' },   // falls toward the open sea on the right
  // 7: the beach round C's north cove under the leaning cliff (wide under the overhang), on to C's north-west beach
  { id: 'ccove', line: [[650, 1112], [600, 1060], [540, 1035], [480, 1052], [420, 1092]], hw: 34, y: [4.4, 4.6], lean: -0.035, edge: 'beach' },   // falls toward the cove and the sea on the right
  // 8: C's west point
  { id: 'cwest', line: [[400, 1080], [335, 990], [312, 898]], hw: 30, y: [4, 5], lean: 0, edge: 'beach' },
  // 9: the beach at the cave mouth and the cave's sand floor through the Hong's east wall; the lagoon's crescent
  { id: 'cavebeach', line: [[-166, 766], [-188, 762], [-268, 748]], hw: 26, y: [3.0, 3.1], lean: 0, edge: 'beach' },
  { id: 'lagoon', line: [[-272, 776], [-298, 742], [-318, 706]], hw: 34, y: [7.4, 7.4], lean: 0, edge: 'beach', land: true, bank: 0.5 },   // a perched shelf of sand and roots on the lagoon's east side, 4 m over the cave floor
];
const FLATW = FLATS.map(f => ({ ...f, P: W(f.line), L: lengthOf(W(f.line)) }));

// ---- the 2nd's tees: a notch at the lip 60 m up the cove's east wall (Marlin, Manta), and a rock in the shallows by
// the wall's foot for the forward tees, open toward the islet
export const LEDGE = { x: 160.67, n: -40.95, y: 60 };

// ---- the 3rd's tongue: firm sand reaching back from the islet toward the tee, under the sea at high water
const L3 = WLINES[2], L5 = WLINES[4], L4 = WLINES[3], L9 = WLINES[8];
export const TONGUE = { s0: LEN[2] - 92, s1: LEN[2] - 26, hw: 27 };
function tongue(X, Z) {
  const p = project(L3, X, Z); if (p.s < TONGUE.s0 - 40 || p.s > TONGUE.s1 + 20) return null;
  const t = clamp((p.s - TONGUE.s0) / (TONGUE.s1 - TONGUE.s0), 0, 1), hw = 4 + (TONGUE.hw - 4) * smooth(t / 0.55);
  const yc = 0.5 + 1.7 * smooth(t), tip = p.s < TONGUE.s0 ? TONGUE.s0 - p.s : 0, o = Math.hypot(Math.abs(p.off) > hw ? Math.abs(p.off) - hw : 0, tip);
  const yi = yc - 0.6 * Math.min(1, (p.off / hw) ** 2), y = o > 0 ? lerp(yi, -6, smooth(o / 30)) : yi;
  return y < -5.5 ? null : { y, t: 'wet' };
}
// the rock the 3rd's forward tee stands on, in the shallows beside the tongue's tip
// (the 3rd's forward tee stands on a sea stack: STACKS below)

// ---- the 4th's coves, [s, inner edge's off, along] in its line's frame: each bites in from the channel on the left as
// far as its inner edge, so the straight line from the back tee to the green crosses all three; a beach at each head
const COVES4 = [[122, -40, 42], [388, -28, 34], [452, -8, 24]];
export const COVES = COVES4.map(([s, inner, ra]) => { const rc = 80, off = inner - rc, [X, Z] = onLine(3, s, off), [X2, Z2] = onLine(3, s + 1, off); return { X, Z, ra, rc, ux: X2 - X, uz: Z2 - Z, s, off, inner }; });
const coveE = (X, Z) => { let e = Infinity; for (const c of COVES) { const dx = X - c.X, dz = Z - c.Z, a = dx * c.ux + dz * c.uz, b = -dx * c.uz + dz * c.ux; e = Math.min(e, Math.hypot(a / c.ra, b / c.rc) * (1 + 0.05 * noise1(Math.atan2(b, a) * 3, 61))); } return e; };

// ---- the Sandbar (round 0, Rhys's pick: uneven): 42 m of salt grass; the open sea's side (right of the line, off > 0)
// narrow, the channel's side a band of salt-grass rough and more dry sand, so at high water the sea is inside a medium
// miss on one side only
export const BAR = { s0: 26, s1: LEN[4] - 10, fw: 21, north: { sand: 40, wet: 68 }, south: { rough: 40, sand: 58, wet: 86 } };
function sandbar(X, Z) {
  const p = project(L5, X, Z); if (p.s < BAR.s0 - 40 || p.s > BAR.s1 + 40) return null;
  const end = smooth(((BAR.s1 + 40) - p.s) / 40);
  const o = Math.abs(p.off), N = p.off > 0, wob = 3 * noise1(p.s / 35, N ? 4 : 5);
  let y, t;
  if (o <= BAR.fw) { y = 3.3 - 0.35 * (o / BAR.fw) ** 2; t = 'grass'; }
  else if (N) {
    const { sand, wet } = BAR.north, sw = sand + wob, ww = wet + wob;
    if (o <= sw) { y = lerp(2.95, 2.5, (o - BAR.fw) / (sw - BAR.fw)); t = 'sand'; }
    else if (o <= ww) { y = lerp(2.4, 0, (o - sw) / (ww - sw)); t = 'wet'; }
    else { y = lerp(0, -6, smooth((o - ww) / 50)); t = 'sea'; }
  } else {
    const { rough, sand, wet } = BAR.south, rw = rough + wob, sw = sand + wob, ww = wet + wob;
    if (o <= rw) { y = lerp(2.95, 2.8, (o - BAR.fw) / (rw - BAR.fw)) + 0.25 * noise2(X / 6, Z / 6, 9); t = 'rough'; }
    else if (o <= sw) { y = lerp(2.8, 2.5, (o - rw) / (sw - rw)); t = 'sand'; }
    else if (o <= ww) { y = lerp(2.4, 0, (o - sw) / (ww - sw)); t = 'wet'; }
    else { y = lerp(0, -6, smooth((o - ww) / 50)); t = 'sea'; }
  }
  if (end < 1) y = lerp(-6, y, end);
  return y < -5.5 ? null : { y, t };
}

// ---- the 9th: the tee rock alone in the open water; the right fairway's land running up from it and stopping short
// in the sea; a gap of water; the cave beach, one piece of land from the north tower's foot round to the south tower's
// with the sea cave in its back wall; the island fairway inside the dogleg; the lagoon through the cave.
// Round 6 (Rhys, 25 November: "round more of the areas and make them feel more natural sand bar areas into the water
// rather than a drop off"): every piece of the 9th's land is a waterline at low water with sand inside it (wet below
// the high-water mark, then dry) and grass inside that, and outside it a sandbar that shelves away under the sea
// (`shelf`: 3 m down over 45 m, then on down to the bed over 120 m), so no edge drops off. The cave beach follows his
// red line; the island is a triangle (narrow toward the tee, wide further out), low enough that the high tide covers it,
// ringed with sand and with water all round it at low tide; a channel (his blue) between it and the right fairway.
const chaikin = (P, it = 3, closed = false) => {
  let Q = P;
  for (let i = 0; i < it; i++) {
    const R = [], n = closed ? Q.length : Q.length - 1;
    for (let j = 0; j < n; j++) { const a = Q[j], b = Q[(j + 1) % Q.length]; R.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); }
    Q = closed ? R : [Q[0], ...R, Q[Q.length - 1]];
  }
  return Q;
};
export const smoothPoly = chaikin;
const polyD = (P, X, Z, closed) => { let d = Infinity; const n = closed ? P.length : P.length - 1; for (let j = 0; j < n; j++) d = Math.min(d, segQ(P[j], P[(j + 1) % P.length], X, Z).d); return d; };
const inPoly = (P, X, Z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > Z) !== (zj > Z) && X < (xj - xi) * (Z - zi) / (zj - zi) + xi) c = !c; } return c; };
// the sea floor outside a waterline: e metres out, over the bed gy; `drop` m down over `run` m, then on to the bed
const shelf = (e, gy, drop = 3, run = 45) => e <= run ? -drop * smooth(e / run) : lerp(-drop, Math.min(gy, -drop), smooth((e - run) / 120));
// a beach: a metres in from the waterline, g metres short of the grass (wet to the high-water mark over `wet` m, then dry)
const beach = (a, g, wet = 8, top = 2.95) => a < wet ? { y: HW * a / wet, t: 'wet' } : { y: lerp(HW + 0.05, top, clamp((a - wet) / Math.max(1, a - wet + g), 0, 1)), t: 'sand' };
// the cave beach's waterline (Rhys's red line), north to south, and the side closing it through the towers and the cave
export const CAVELAND = {
  shore: W(chaikin([[-216, 893], [-196, 894], [-173, 892], [-152, 883], [-136, 869], [-124, 853], [-115, 835], [-111, 816], [-115, 800], [-124, 789], [-134, 776], [-142, 761], [-149, 745], [-155, 728], [-159, 711], [-163, 694], [-168, 680], [-178, 668], [-194, 662], [-213, 657], [-240, 654]])),
  wall: W([[-240, 654], [-234, 700], [-224, 738], [-221, 770], [-225, 810], [-229, 860], [-216, 893]]),
  wet: 8, dry: 4, rough: 4,
};
CAVELAND.poly = [...CAVELAND.shore, ...CAVELAND.wall.slice(1, -1)];
function caveLand(X, Z, gy) {
  const C = CAVELAND, d = polyD(C.shore, X, Z, false), a = (inPoly(C.poly, X, Z) ? d : -d) + 2.5 * noise2(X / 16, Z / 16, 91);
  if (a < 0) return a > -170 ? { y: shelf(-a, gy), t: 'sea' } : null;
  const g = C.wet + C.dry + C.rough;
  if (a < C.wet + C.dry) return beach(a, C.wet + C.dry - a, C.wet);
  if (a < g) return { y: 2.97, t: 'rough' };
  return { y: 3.0 + 0.3 * smooth((a - g) / 30) * smooth(polyD(C.wall, X, Z, false) / 25), t: 'grass' };   // level with the cave's floor where it meets the wall
}
// the island fairway: a triangle with its point toward the tee rock (Rhys: "you get rewarded a little more as you hit
// longer"), 1.5 m up (under the sea at high water), rough 3 m round it, sand 12 m round that, then the moat
// a convex polygon (counter-clockwise or not) with its corners rounded to radius r: the outline, every few metres
const roundPoly = (P, r, step = 3) => {
  const n = P.length, ar = P.reduce((s, p, i) => s + p[0] * P[(i + 1) % n][1] - P[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1, out = [];
  // the polygon inset by r: each edge moved in, neighbours intersected
  const edge = i => { const a = P[i], b = P[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L * ar, nz = dx / L * ar; return { a: [a[0] + nx * r, a[1] + nz * r], d: [dx, dz], nx, nz }; };
  const E = P.map((_, i) => edge(i)), I = [];
  for (let i = 0; i < n; i++) { const e1 = E[(i + n - 1) % n], e2 = E[i], den = e1.d[0] * e2.d[1] - e1.d[1] * e2.d[0], t = ((e2.a[0] - e1.a[0]) * e2.d[1] - (e2.a[1] - e1.a[1]) * e2.d[0]) / den; I.push({ c: [e1.a[0] + e1.d[0] * t, e1.a[1] + e1.d[1] * t], n1: [-e1.nx, -e1.nz], n2: [-e2.nx, -e2.nz] }); }
  for (let i = 0; i < n; i++) {
    const { c, n1, n2 } = I[i], a1 = Math.atan2(n1[1], n1[0]); let a2 = Math.atan2(n2[1], n2[0]), da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const k = Math.max(2, Math.ceil(Math.abs(da) * r / step));
    for (let j = 0; j <= k; j++) { const a = a1 + da * j / k; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
    const nx = I[(i + 1) % n].c, L = Math.hypot(nx[0] - c[0], nx[1] - c[1]), m = Math.floor(L / step);
    for (let j = 1; j < m; j++) out.push([c[0] + n2[0] * r + (nx[0] - c[0]) * j / m, c[1] + n2[1] * r + (nx[1] - c[1]) * j / m]);
  }
  return out;
};
export const ISLAND9 = { tri: [[-70, 710], [-102, 776], [-135, 705]], plan: null, top: 1.5, rough: 3, sand: 12 };
ISLAND9.plan = roundPoly(ISLAND9.tri, 10);
ISLAND9.core = W(ISLAND9.plan);
ISLAND9.centre = [ISLAND9.plan.reduce((s, p) => s + p[0], 0) / ISLAND9.plan.length, ISLAND9.plan.reduce((s, p) => s + p[1], 0) / ISLAND9.plan.length];
function island9(X, Z, gy) {
  const I = ISLAND9, d = polyD(I.core, X, Z, true), e = (inPoly(I.core, X, Z) ? -d : d) + 2 * noise2(X / 14, Z / 14, 71);
  if (e < 0) return { y: I.top + 0.2 * smooth(-e / 14), t: 'grass', island9: true };
  if (e < I.rough) return { y: I.top - 0.05 * e, t: 'rough', island9: true };
  const shore = I.rough + I.sand;
  if (e < shore) return { y: lerp(I.top - 0.2, 0, smooth((e - I.rough) / I.sand)), t: 'wet', island9: true };
  return e - shore < 150 ? { y: shelf(e - shore, gy, 2.2, 16), t: 'sea' } : null;
}
// the right fairway's land: grass down its line (`hw` each side), dry sand narrow on the left and wide on the right,
// a beach round it; its ends rounded (`r0` at the tee rock, `r1` at the far end, which lies `tail` m past the line's end)
export const RIGHT9 = (() => { const line = [[84, 610], [-30, 800]], P = W(line); return { line, P, L: lengthOf(P), hw: 30, narrow: 4, dry: 44, wet: 8, s0: 4, tail: 27, r0: 28, r1: 34, g0: 12, g1: 4, rg: 16 }; })();
// a rounded box in (s, off): left half-width wl, right wr, from s0 to s1, corners of radius r; < 0 inside
const rbox = (s, off, s0, s1, wl, wr, r) => { const dl = off < 0 ? -off - (wl - r) : off - (wr - r), da = Math.max(s0 + r - s, s - (s1 - r)); return Math.hypot(Math.max(dl, 0), Math.max(da, 0)) + Math.min(Math.max(dl, da), 0) - r; };
function right9(X, Z, gy) {
  const R = RIGHT9, q = project(R.P, X, Z), s = q.s, off = q.off;
  const wr = R.hw + R.narrow + R.dry * smooth((s - 30) / 60) + R.wet, wl = R.hw + R.narrow + R.wet, r = s < R.L / 2 ? R.r0 : R.r1;
  const a = -rbox(s, off, R.s0, R.L + R.tail, wl, wr, r) + 3 * noise1(s / 30, off > 0 ? 14 : 15);
  if (a < 0) return a > -170 ? { y: shelf(-a, gy), t: 'sea' } : null;
  const dg = rbox(s, off, R.s0 + R.g0, R.L + R.g1, R.hw, R.hw, R.rg);
  if (dg < 0) return -dg < R.hw * 0.25 ? { y: 3.0, t: 'rough' } : { y: 3.3 - 0.3 * Math.min(1, (off / R.hw) ** 2), t: 'grass' };
  return beach(a, dg, R.wet);
}
// the channel between the island and the right fairway (Rhys's blue): kept clear water, 2.4 m deep along its middle
export const CHANNEL9 = W([[-80, 800], [-66, 760], [-52, 722], [-36, 680]]);
function land9(X, Z, gy) {
  let best = null;
  for (const q of [caveLand(X, Z, gy), island9(X, Z, gy), right9(X, Z, gy)]) if (q && (!best || q.y > best.y)) best = q;
  return best;
}
export const CAVE = (() => { const a = project(L9, ...w([-190, 762])).s, b = project(L9, ...w([-266, 749])).s; return { s0: a - 2, s1: b + 2, hw: 28, floor: 3.0, roof: 42 }; })();
// the cave's roof over (X, Z), absolute metres, or null
export function caveRoofAt(X, Z) {
  const p = project(L9, X, Z);
  if (p.s < CAVE.s0 || p.s > CAVE.s1 || Math.abs(p.off) > CAVE.hw + 6) return null;
  const a = Math.min(1, (p.s - CAVE.s0) / 8, (CAVE.s1 - p.s) / 8);
  return CAVE.roof - 6 * (1 - a) - 8 * smooth((Math.abs(p.off) - CAVE.hw * 0.6) / (CAVE.hw * 0.4));
}
const inCave = (X, Z) => { const p = project(L9, X, Z); return p.s > CAVE.s0 && p.s < CAVE.s1 && Math.abs(p.off) < CAVE.hw * (0.85 + 0.15 * Math.cos(Math.PI * (p.s - CAVE.s0) / (CAVE.s1 - CAVE.s0))); };

// ---- the 7th's leaning cliff: C's face along the left of the cove's head beach leans out over it, from its foot 50 m
// left of the line to its lip 10 m left, 92 m up. Under it the massif is cut back to the foot and the beach runs in.
export const OVER = { k: 6, s0: 40, s1: 232, foot: -50, lip: -10, top: 92 };
export function overhangAt(X, Z) {
  const c = lineCoord(6, X, Z);
  if (c.s < OVER.s0 || c.s > OVER.s1 || c.off < OVER.foot || c.off > OVER.lip) return null;
  const t = (c.off - OVER.foot) / (OVER.lip - OVER.foot), end = Math.min(1, (c.s - OVER.s0) / 25, (OVER.s1 - c.s) / 25);
  return 4.5 + 58 * t + (1 - end) * 40;
}
const underOver = (X, Z) => { const c = lineCoord(6, X, Z); return c.s > OVER.s0 - 10 && c.s < OVER.s1 + 10 && c.off > OVER.foot - 4 && c.off < 0; };
// anything overhead at (X, Z): the cave's roof or the overhang (absolute height of the underside), or null
export const roofAt = (X, Z) => caveRoofAt(X, Z) ?? overhangAt(X, Z);

// ---- the stack: the 8th green on its flat top, a rim of rock round its back half that holds a long ball, and a
// spire on the rim's back edge, the landmark seen across the bay
export const STACK = { X: 224, Z: -842, r: 24, top: 9, rim: 1.6, spire: { X: 212, Z: -831, r: 6.5, top: 40 } };

// ---- the massifs
function islandSD(I, X, Z) {
  let sd = Math.min(...I.massif.map(o => sdSE(o, X, Z)));
  for (const c of I.cut) sd = Math.max(sd, -sdSE(c, X, Z));
  return sd + 9 * fbm(X / 70, Z / 70, 3, 3) + 1.2 * noise2(X / 13, Z / 13, 9);
}
const dome = (pk, X, Z) => { const t = Math.hypot(X - pk[0], Z + pk[1]) / pk[2]; return t >= 1.7 ? 0 : pk[3] * Math.exp(-2 * t * t); };
const domes = (P, X, Z) => { let m = 0; for (const pk of P) m = Math.max(m, dome(pk, X, Z)); return m; };
function massifY(I, X, Z, dIn, key) {
  const wall = I.wall[0] + (I.wall[1] - I.wall[0]) * smooth((noise2(X / 120, Z / 120, 34 + key) + 0.25) / 1.1);
  const body = I.body[0] + I.body[1] * fbm(X / 150, Z / 150, 38 + key, 3) + 18 * fbm(X / 60, Z / 60, 31, 3);
  const climb = wall * smooth(dIn / 3.5) + (1.7 + 0.5 * noise2(X / 80, Z / 80, 39)) * Math.max(0, dIn - 3);
  return Math.max(6, Math.min(climb, body + domes(I.peaks, X, Z))) + 2.8 * fbm(X / 10, Z / 10, 33, 2) * smooth(dIn / 6);
}

// the tide holes' own ground in the sea at (X, Z), or null: the tongue, the Sandbar
const tideBits = (X, Z) => { const a = tongue(X, Z), b = sandbar(X, Z); return a && (!b || a.y > b.y) ? a : b; };

// V(X, Z): { y, t } where t is what the ground is made of: 'sea' (sea bed), 'wet' (intertidal sand), 'sand' (dry
// sand), 'grass', 'rough', 'jungle' (jungle floor), 'karst' (rock), and cave: true inside the sea cave (roof overhead)
function V0(X, Z) {
  // the massifs, with the gap, the cave and the overhang kept open
  let best = null;
  for (let k = 0; k < KEYS.length; k++) { const I = ISLANDS[KEYS[k]], sd = islandSD(I, X, Z); if (!best || sd < best.sd) best = { sd, I, k, id: KEYS[k] }; }
  const gp = segQ(GAP.a, GAP.b, X, Z);
  if ((best.id === 'C' || best.id === 'S') && gp.d < 26 && gp.t > 0.02 && gp.t < 0.98) best.sd = Math.max(best.sd, 26 - gp.d);
  const cave = best.id === 'D' && inCave(X, Z);
  if (cave) best.sd = Math.max(best.sd, 8);
  if (best.id === 'C' && underOver(X, Z)) best.sd = Math.max(best.sd, 6);
  // the flats and islets
  let fl = null;
  for (const f of FLATW) { const q = project(f.P, X, Z), sd = q.d - f.hw + 5 * noise2(X / 40, Z / 40, 41); if (sd < 0 && (!fl || sd < fl.sd)) fl = { f, q, sd }; }
  if (!fl && underOver(X, Z)) { const f = FLATW.find(q => q.id === 'ccove'); fl = { f, q: project(f.P, X, Z), sd: -6 }; }
  let isl = null;
  for (const I of ISLETS) { const sd = sdSE(I.o, X, Z) + 3 * noise2(X / 20, Z / 20, 43); if (sd < I.beach && (!isl || sd < isl.sd)) isl = { I, sd }; }
  // the sea bed: turquoise over sand by beaches, in the cove and the lagoon and on the flats; coral patches; deep blue
  // off the walls and in the open channels
  const landSD = Math.min(best.sd, fl ? fl.sd : Infinity, isl ? isl.sd : Infinity), dOut = Math.max(0, landSD);
  const inCove = 1 - smooth((seDist(ISLANDS.A.cut[0], X, Z) - 0.9) / 0.35), inLag = 1 - smooth((seDist(ISLANDS.D.cut[0], X, Z) - 0.9) / 0.3);
  const shallow = Math.max(inCove * 0.9, inLag, fl && fl.f.edge === 'beach' ? 1 - smooth(fl.sd / 60) : 0, isl ? 1 - smooth(isl.sd / 60) : 0);
  const near = 4 + 70 * shallow;
  let bed = -(0.6 + 0.5 * noise2(X / 30, Z / 30, 21)) - 24 * smooth((dOut - near) / (60 + 120 * shallow)) - 3 * smooth(dOut / 12) * (1 - shallow);
  bed -= (inCove + inLag) * (1.4 + 2.2 * smooth((dOut - 30) / 120));
  const tf = 0;
  bed -= 2.6 * smooth((fbm(X / 35, Z / 35, 22, 3) - 0.05) / 0.25) * smooth(dOut / 25) * (1 - tf);
  // far islands
  for (const F of FAR) {
    const sd = sdSE(F.o, X, Z) + 10 * fbm(X / 80, Z / 80, 11, 2);
    if (sd < 0) { const wl = 40 + 60 * smooth((noise2(X / 120, Z / 120, 12) + 0.3) / 1.2), cl = wl * smooth(-sd / 4) + 1.2 * Math.max(0, -sd - 4), top = 0.6 * Math.max(...F.peaks.map(p => p[3])) + 0.45 * domes(F.peaks.map(p => [p[0], p[1], p[2] * 1.3, p[3]]), X, Z) + 18 * fbm(X / 60, Z / 60, 13, 3); return { y: Math.min(cl, top), t: 'jungle', far: true }; }
  }
  // the stack: a flat top with a rim round its back half, sheer sides, the spire on the rim
  const dSt = Math.hypot(X - STACK.X, Z - STACK.Z);
  const dsp = Math.hypot(X - STACK.spire.X, Z - STACK.spire.Z);
  if (dsp < STACK.spire.r + 1.5) return { y: lerp(STACK.top, STACK.spire.top + 2 * noise2(X / 4, Z / 4, 55), smooth((STACK.spire.r + 1.5 - dsp) / 1.5)), t: 'karst' };
  if (dSt < STACK.r + 4) {
    const k = 1 - smooth((dSt - STACK.r) / 4), back = smooth(((STACK.X - X) * 0.6 + (Z - STACK.Z) * 0.8 + 2) / 6);   // the back: away from the 8th tee (south-west)
    const rim = STACK.rim * back * smooth((dSt - STACK.r + 5) / 3.5);
    return { y: lerp(bed, STACK.top + rim, k), t: dSt < STACK.r - 3 ? 'grass' : 'karst' };
  }
  // the massif's ground (a flat's inner edge: the wall climbs from the flat)
  const mY = best.sd < 0 ? massifY(best.I, X, Z, -best.sd, best.k) : null;
  // the 2nd's notch: a pad cut into the cove's east wall at the lip, open toward the islet
  { const lz = -LEDGE.n, o = ISLETS[0].o, dx = o.x - LEDGE.x, dz = o.z - lz, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, q = segQ([LEDGE.x - ux * 30, lz - uz * 30], [LEDGE.x + ux * 60, lz + uz * 60], X, Z);
    if (mY !== null && q.d < 34) { const k = 1 - smooth((q.d - 16) / 18); if (mY > LEDGE.y) return { y: lerp(mY, LEDGE.y, k), t: q.d < 16 && q.t * 90 < 40 ? 'grass' : 'karst', ledge: true }; } }
  // a flat
  if (fl) {
    const f = fl.f, s = fl.q.s; let fy = lerp(f.y[0], f.y[1], smooth(s / f.L)) + (f.peak ? (f.peak - f.y[0]) * Math.sin(Math.PI * clamp(s / f.L, 0, 1)) : 0) + f.lean * fl.q.off + (f.pipe ? 0 : 0.4 * noise2(X / 30, Z / 30, 37));   // a slot's floor is swept smooth
    for (const [s0, dh, sw] of f.steps || []) fy += dh * smooth((s - s0 + sw / 2) / sw);
    if (f.pipe) fy += f.pipe * Math.min(1, (fl.q.off / (f.pipeW || f.hw)) ** 2);
    const edge = -fl.sd;                                       // metres in from the flat's own edge
    let y = fy, t = f.sand ? 'sand' : 'grass';
    const sea = best.sd > 0 ? smooth((best.sd - 12) / 30) : 0;   // the side away from the island: a flat meets its wall with no beach between
    if (f.land) { if (sea > 0.3) { const by = 0.4 + edge * (f.bank || 0.2); if (by < fy) { y = by; t = by < HW ? 'wet' : 'sand'; } } }   // land: grass across, a short beach only where it meets open water
    else if (f.seaSide) { if (Math.sign(fl.q.off) === f.seaSide) { if (fy > 6) { if (edge < 5) { y = lerp(-1, fy, smooth((edge - 0.5) / 4)); t = 'karst'; } } else { const by = 0.4 + edge * 0.16; if (by < fy) { y = by; t = by < HW ? 'wet' : 'sand'; } } } }   // a terrace at a wall's foot: grass to the wall, a beach on its sea side (a low coral cliff where it stands high)
    else if (f.edge === 'beach') { const by = 0.4 + edge * 0.075 + (1 - sea) * 20; if (by < fy) { y = by; t = by < HW ? 'wet' : 'sand'; } else if (f.sand) y = Math.min(fy, by); }
    else { const dropY = lerp(-4, fy, smooth((edge - 1) / 3)); if (dropY < y && sea > 0.5) y = dropY; }
    if (f.id === 'shelf') { const e = coveE(X, Z); if (e < 1.16) { const cy = lerp(-4 + 2 * noise2(X / 15, Z / 15, 62), 2.7, smooth((e - 0.62) / 0.36)); const yy = e < 1 ? cy : lerp(cy, y, smooth((e - 1) / 0.16)); if (yy < y) { y = yy; t = y < 0 ? 'sea' : y < HW ? 'wet' : e < 1.02 ? 'sand' : 'karst'; } } }
    if (mY !== null && !cave) { y = Math.max(y, Math.min(mY, fy + (mY - fy) * smooth((-best.sd - 2) / 3))); if (y > fy + 1.5) t = y > fy + 6 ? 'karst' : 'jungle'; }
    if (t === 'sea' || (t === 'wet' && y < 0)) t = 'sea';
    const tb = tideBits(X, Z); if (tb && tb.y > y && !cave) return tb;
    return { y, t, flat: f.id, cave: cave || undefined };
  }
  // an islet: a low top ringed with sand
  if (isl) { const e = -isl.sd + isl.I.beach; const y = Math.min(isl.I.y, 0.4 + e * 0.12); const tb = tideBits(X, Z); if (tb && tb.y > y) return tb; return { y, t: y < 0 ? 'sea' : y < HW ? 'wet' : y < isl.I.y - 0.3 ? 'sand' : 'grass', islet: isl.I.name }; }
  if (mY !== null) return { y: mY, t: -best.sd < 5 && mY > 6 ? 'karst' : 'jungle', island: best.id };
  // the tide holes' own ground in the sea: the tongue, the Sandbar, the spit, the creek
  let g = { y: bed, t: bed < 0 ? 'sea' : bed < HW ? 'wet' : 'sand' };
  const take = q => { if (q && q.y > g.y) g = q; };
  take(tongue(X, Z));
  take(sandbar(X, Z));
  if (g.t === 'wet' && g.y < 0) g.t = 'sea';
  return { ...g, tidal: tf > 0.5 || undefined };
}
// ---- sea stacks (the Ko Tapu look: a narrow pinnacle standing in the water): [hole, s, off] in that hole's frame,
// r the top's radius, top its height. Tee stacks carry a flat grassed top for a tee pad; the Sandbar's is a hazard.
export const STACKS = [
  { name: 'the Drop\'s Turtle stack', k: 1, s: 31, off: 7, r: 8, top: 22, tee: 'turtle' },
  { name: 'the Drop\'s Clownfish stack', k: 1, s: 78, off: -13, r: 8, top: 9, tee: 'clownfish' },
  { name: 'the Tongue\'s Clownfish stack', k: 2, s: 92, off: 30, r: 9, top: 16, tee: 'clownfish' },
  { name: 'the Sandbar stack', k: 4, s: 205, off: 23, r: 7, top: 28 },
].map(st => { const [X, Z] = onLine(st.k, st.s, st.off); return { ...st, X, Z }; });
// ---- the 5th's headland: the cliff brought out round the green, so the green sits up on it (9 m, 6 m over the
// bar's crown) with a face on its left and its front, and a grassy ramp up its front-right corner from the bar
export const HEAD5 = { o: se(852, 786, 56, 46, 0, 2.4), top: 9, ramp: { s0: LEN[4] - 96, s1: LEN[4] - 40, off: 21, hw: 8 } };
function headland(X, Z) {
  const sd = sdSE(HEAD5.o, X, Z) + 2 * noise2(X / 14, Z / 14, 81);
  let y = sd < 0 ? HEAD5.top : sd < 4 ? lerp(HEAD5.top, 0, smooth(sd / 4)) : -Infinity, t = sd < -2 ? 'grass' : 'karst';
  const c = lineCoord(4, X, Z), R = HEAD5.ramp;
  if (c.s > R.s0 - 10 && c.s < R.s1 + 10 && Math.abs(c.off - R.off) < R.hw + 6) {
    const yr = lerp(3.2, HEAD5.top, smooth((c.s - R.s0) / (R.s1 - R.s0))) - 3 * smooth((Math.abs(c.off - R.off) - R.hw) / 6);
    if (yr > y) { y = yr; t = 'grass'; }
  }
  return y > -Infinity ? { y, t } : null;
}
export function V(X, Z) {
  let g = V0(X, Z);
  if (g.far) return g;
  const h = headland(X, Z);
  if (h && h.y > g.y) g = { ...g, y: h.y, t: h.t, flat: 'headland' };
  // the 9th's land (round 6): the cave beach, the island and the right fairway's land, each shelving into the sea
  { const q = land9(X, Z, g.y); if (q && q.y > g.y) g = { ...g, ...q, cave: g.cave }; }
  if (g.y < 0) { const d = polyD(CHANNEL9, X, Z, false); if (d < 16) g = { ...g, y: Math.min(g.y, lerp(-2.4, g.y, smooth((d - 5) / 11))), t: 'sea' }; }
  for (const st of STACKS) {
    const d = Math.hypot(X - st.X, Z - st.Z);
    if (d < st.r + 2.5) { const y = lerp(st.top, Math.min(g.y, -1), smooth((d - st.r + 0.5) / 3)); if (y > g.y) g = { y, t: st.tee && d < st.r - 1.5 ? 'grass' : 'karst', stack: st.name }; }
  }
  return g;
}

// what the ground plays as at a tide: water under the sea, firm wet sand where intertidal sand is dry
export function surfaceAt(X, Z, tide = 'low') {
  const g = V(X, Z), sea = TIDES[tide];
  if (g.y < sea) return { ...g, s: 'water', depth: sea - g.y };
  const s = { wet: 'wetsand', sea: 'wetsand', sand: 'drysand', grass: 'grass', rough: 'rough', jungle: 'jungle', karst: 'rock' }[g.t];
  return { ...g, s };
}

// ---- the built things and the life (scenery), world [X, Z]
export const SITES = [
  ...[[-360, -370, 20], [-345, -395, 40], [-325, -360, 0], [-390, -395, 10], [-300, -385, 30], [-410, -360, -10], [-372, -420, 25]].map(([x, n, r], i) => ({ kind: 'stilt', name: i === 0 ? 'stilt village' : null, at: w([x, n]), w: 9, l: 12, h: 6, rot: r * Math.PI / 180 })),
  { kind: 'jetty', at: w([-350, -345]), w: 3, l: 40, h: 1.6, rot: 15 * Math.PI / 180 },
  ...[[-300, -420, 40], [-420, -410, 80], [0, -200, 10], [60, -120, 160], [600, 100, 340], [620, -150, 170], [120, 700, 250], [100, 500, 60], [-100, 600, 300], [760, 700, 100]].map(([x, n, r], i) => ({ kind: 'longtail', name: i === 4 ? 'longtails' : null, at: w([x, n]), w: 2, l: 13, h: 1.2, rot: r * Math.PI / 180, water: true })),
  { kind: 'shack', name: 'beach shack', at: w([-318, 690]), w: 14, l: 20, h: 6, rot: -10 * Math.PI / 180 },
  { kind: 'marker', name: 'coves marker', at: onLine(3, 312, -60), w: 1, l: 1, h: 6, rot: 0 },
  { kind: 'tree', name: 'twisted tree', at: [STACK.spire.X + 4, STACK.spire.Z - 10], w: 4, l: 4, h: 9, rot: 0 },
];
export const LABELS = [
  [w([-380, -370]), 'stilt village'], [w([-560, 40]), 'the west terrace'], [w([0, 95]), 'the Maya beach'], [w([10, -95]), 'the islet'],
  [w([600, -385]), 'the Tongue islet'], [w([600, 120]), 'the channel'], [w([760, 220]), 'the coves'], [w([960, 600]), 'the Sandbar'],
  [w([835, 940]), 'the gap'], [w([935, 920]), 'the Sentinel'], [w([540, 1080]), 'the cove'], [w([224, 842]), 'the sea stack'],
  [w([-400, 800]), 'the lagoon'], [w([-70, 818]), 'the gap'], [w([150, 548]), 'the tee rock'], [w([-228, 755]), 'sea cave'],
];
