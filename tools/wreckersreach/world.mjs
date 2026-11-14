// Wrecker's Reach, in world space (metres; x east, -z north, y above mean sea level). Pure, no DOM.
// A spit of dunes on an invented coast where a sandbar has been taking ships for centuries: the sea to the west,
// the lagoon to the east, the point to the north, the mainland and the Wrecker's Inn to the south. V(X, Z) is the
// ground without the holes; each hole's ground follows it away from its line (scene.mjs). Points below are written
// [x east, n north] as in claude/wreckers-reach-layout.md and turned to [X, Z = -n] by `w`.
//
// The links logic lives here, once, so two holes that share ground share it exactly: the floor (the dune slacks the
// fairways lie in, rumpled with humps and hollows), the dunes between the holes (sand with tussocks of dune grass),
// the beaches (firm wet sand), the water (the sea, the lagoon, the Cauldron and the creek, all one sheet at sea
// level), the shared fairway of the 1st and 9th, the double green of the 2nd and 8th, and the wrecks.
import { clamp, smooth, lerp, project, seDist, lengthOf } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

export const w = p => [p[0], -p[1]];
const W = P => P.map(w);
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- the playing lines from the layout doc (tee, corners, pin), for the dune mask; the 9th slides 40 m north
// (tee, corner and green together) so the walk from the 8th green is about 97 m, not 137 (the brief's ask)
export const LINES = [
  [[-40, 60], [-45, 300], [-61, 553]],
  [[-85, 590], [28, 739]],
  [[-40, 805], [-110, 950], [-81, 1088]],
  [[-85, 1140], [-40, 1330], [-98, 1552]],
  [[-85, 1600], [-70, 1720], [70, 1790], [177, 1629]],
  [[185, 1570], [164, 1421]],
  [[160, 1365], [242, 1273]],
  [[245, 1215], [250, 970], [91, 733]],
  [[120, 640], [70, 380], [75, 252]],
];
const WLINES = LINES.map(W);

// ---- the coast: one outline round the land (the spit and the mainland), clockwise from the south-west; the sea is
// west and north of it, the lagoon east of the spit, open to the sea past the point
export const COAST = W([[-292, -500], [-286, 0], [-292, 300], [-284, 640], [-292, 1000], [-286, 1300], [-290, 1520], [-274, 1660], [-236, 1780], [-160, 1858],
  [-70, 1893], [30, 1888], [130, 1856], [222, 1795], [292, 1704], [330, 1600], [344, 1450], [338, 1250], [346, 1050], [338, 880], [352, 760],
  [430, 690], [620, 640], [900, 610], [1400, 600], [1400, -500]]);
export const SEA_LEVEL = 0;
const coastRaw = (X, Z) => {
  let d = Infinity, inside = false;
  for (let i = 0, j = COAST.length - 1; i < COAST.length; j = i++) {
    const [ax, az] = COAST[j], [bx, bz] = COAST[i], dx = bx - ax, dz = bz - az, t = clamp(((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(X - ax - dx * t, Z - az - dz * t));
    if ((az > Z) !== (bz > Z) && X < (bx - ax) * (Z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside ? d : -d;
};
// metres inland from the waterline (negative out in the water), the line wandering in bays and spits
export const coastD = (X, Z) => coastRaw(X, Z) + 7 * noise2(X / 140, Z / 140, 5) + 2.5 * noise2(X / 37, Z / 37, 6);
// the sea side (west and round the point) has a foredune; the lagoon side doesn't
const seaSide = (X, Z) => smooth((-X - 150) / 60) + smooth((-Z - 1740) / 60) * smooth((-X + 260) / 80) > 0.5;

// ---- the Cauldron: a tidal pool inside the 5th's bend, a frigate's masts standing in it
export const CAULDRON = { c: w([38, 1670]), rx: 64, rz: 46, rot: -14 * Math.PI / 180, p: 2.3, name: 'the Cauldron' };
// its mouth: a tongue of the pool reaching north-east toward the 5th's last leg, so the second cut crosses water
CAULDRON.mouth = { c: w([90, 1704]), rx: 19, rz: 12, rot: -32 * Math.PI / 180 };
export const cauldronE = (X, Z) => {
  const m = CAULDRON.mouth, r = Math.min(CAULDRON.rx, CAULDRON.rz);
  const dMain = (seDist({ x: CAULDRON.c[0], z: CAULDRON.c[1], rx: CAULDRON.rx, rz: CAULDRON.rz, rot: CAULDRON.rot, p: CAULDRON.p }, X, Z) - 1) * r;
  const dMouth = (seDist({ x: m.c[0], z: m.c[1], rx: m.rx, rz: m.rz, rot: m.rot }, X, Z) - 1) * m.rz;
  const k = 8, t = clamp(0.5 + 0.5 * (dMouth - dMain) / k, 0, 1), d = lerp(dMouth, dMain, t) - k * t * (1 - t);
  return 1 + d / r + 0.05 * noise2(X / 26, Z / 26, 11) + 0.02 * noise2(X / 9, Z / 9, 12);
};
// ---- the creek: a tidal channel from the lagoon reaching west across the 7th, ending 8 m west of its line
export const CREEK = W([[352, 1324], [292, 1331], [240, 1321], [204, 1327], [168, 1329]]);
const CREEK_LEN = lengthOf(CREEK);
export function creekD(X, Z) {   // metres outside the channel's water (negative in it); far away: Infinity
  if (X < 140 || X > 380 || Z > -1290 || Z < -1365) return Infinity;
  const pr = project(CREEK, X, Z), u = clamp(pr.s / CREEK_LEN, 0, 1);
  const hw = lerp(10, 3.2, smooth(u)) + 1.2 * noise1(pr.s / 13, 17), end = pr.s >= CREEK_LEN - 0.01 ? 1 : 0;
  return end ? Math.hypot(pr.d, 0) - hw * 0.6 : pr.d - hw;
}

// ---- the floor: the dune slacks the holes lie in, a smooth surface through control heights (Gaussian RBFs, as the
// Lost Valley's and the Buried Kingdom's), with the holes' rough heights from the layout doc along their lines
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
  // the 1st (from beside the inn) and the shared fairway with the 9th
  [-40, 60, 8], [-42, 150, 8.2], [-44, 240, 8.5], [-46, 320, 8.8], [-50, 400, 9.6], [-56, 480, 10.4], [-61, 553, 11],
  [20, 240, 8.3], [45, 320, 8.8], [75, 252, 8], [60, 200, 7.9], [85, 330, 9.2], [14, 111, 8.5], [-110, 165, 7.5],
  // the 9th
  [120, 640, 12], [110, 580, 11.6], [100, 520, 11.2], [92, 470, 11], [82, 420, 10.8], [72, 380, 10.2],
  // the 2nd up to the double green (the 8th's half too)
  [-85, 590, 10], [-55, 630, 10.8], [-25, 670, 11.8], [5, 710, 13], [28, 739, 14], [60, 737, 14], [91, 733, 14],
  // the 3rd, the 4th
  [-40, 805, 12], [-60, 860, 12.4], [-85, 900, 12.6], [-110, 950, 13], [-100, 995, 13], [-92, 1040, 13.4], [-81, 1088, 14],
  [-85, 1140, 11], [-75, 1185, 11.2], [-62, 1240, 11.6], [-40, 1330, 12.5], [-55, 1400, 13.2], [-75, 1470, 13.8], [-98, 1552, 15],
  // the 5th round the point, and the Cauldron's hollow
  [-85, 1600, 13], [-75, 1660, 12.6], [-70, 1720, 12.2], [-20, 1745, 11.8], [20, 1765, 11.5], [70, 1790, 11.2], [112, 1742, 11.4], [140, 1690, 11.6], [160, 1660, 10.8], [177, 1629, 10],
  [38, 1670, 4], [-5, 1698, 6.5], [88, 1652, 6.5], [30, 1630, 6], [125, 1680, 10.6], [140, 1650, 10.4], [-30, 1640, 5], [-52, 1625, 6], [-62, 1606, 9], [-150, 1720, 10],
  // the 6th, the 7th (a dune-top tee, the creek, the green by the lagoon), the 8th along the lagoon
  [185, 1570, 12], [178, 1520, 12], [170, 1470, 11.2], [164, 1421, 10],
  [160, 1365, 17], [178, 1346, 13], [200, 1322, 4.5], [224, 1296, 7.8], [242, 1273, 9],
  [245, 1215, 7.5], [246, 1150, 7.2], [248, 1080, 7.4], [250, 970, 8.4], [210, 910, 10.2], [170, 850, 11.6], [130, 790, 13],
  // between the holes (the dunes stand on these), the sea side and the lagoon side
  [60, 850, 12], [80, 1000, 12], [130, 1100, 12], [150, 1250, 12], [80, 1300, 12.5], [30, 1450, 13], [40, 1550, 12], [-20, 1200, 12], [-10, 950, 12.5], [0, 790, 13],
  [170, 700, 12], [220, 620, 10], [250, 500, 9], [170, 450, 9.5], [-150, 300, 10], [-150, 700, 11], [-160, 1100, 11], [-160, 1500, 11], [-130, 1700, 10],
  [300, 1500, 5], [300, 1300, 5], [290, 1100, 5.5], [290, 900, 5.5], [290, 760, 6],
  // the mainland south and east
  [400, 500, 8], [600, 400, 8], [800, 300, 8], [500, 200, 8], [300, 250, 8.5], [200, 100, 8], [100, 0, 7.5], [-100, -50, 8], [0, -150, 7], [300, -100, 7], [-200, -150, 9],
];
const floorAt = rbf(FLOOR, 72, 10);

// ---- the shared fairway (the 1st and the 9th): the 1st's own fairway paints its west half, this outline the east
// half the 9th comes home down; a broken row of dune grass stands between the halves
export const SHARED_FW = W([[-6, 210], [25, 222], [55, 268], [95, 270], [108, 300], [104, 326], [92, 340], [60, 344], [34, 336], [12, 320], [-4, 290]]);
// ---- the double green (the 2nd and the 8th): one surface, two flags, about 105 x 40 m. Lobes in world space
// [x, n, rx (east), rn (north), rot (degrees, + clockwise)]; its height is DGREEN.datum plus its contour (dgContour)
export const DGREEN = { lobes: [[27, 741, 19.5, 14.5, -12], [59, 737.5, 18, 12, 0], [91, 733.5, 19, 14.5, 12]], join: 6, wob: 1.4, datum: 14,
  pins: { 2: w([28, 739]), 8: w([91, 733]) }, name: 'the double green' };
export function dgE(X, Z) {   // metres outside the double green (negative inside)
  const n = -Z; let d = Infinity;
  for (const [cx, cn, rx, rn, rot] of DGREEN.lobes) {
    const a = rot * Math.PI / 180, dx = X - cx, dn = n - cn, u = dx * Math.cos(a) - dn * Math.sin(a), v = dx * Math.sin(a) + dn * Math.cos(a);
    const di = (Math.hypot(u / rx, v / rn) - 1) * Math.min(rx, rn);
    if (d === Infinity) d = di; else { const k = DGREEN.join, t = clamp(0.5 + 0.5 * (di - d) / k, 0, 1); d = lerp(di, d, t) - k * t * (1 - t); }
  }
  return d + DGREEN.wob * noise2(X / 7, Z / 7, 31);
}
// the contour: the 2nd's (west) half falls 1.6% toward the 2nd tee, the 8th's (east) half 1.6% toward the 8th's
// approach, a swale 0.3 m deep between them (the 40 m putt over it)
export function dgContour(X, Z) {
  const n = -Z, wE = smooth((X - 40) / 30);
  const hw = -((X - 26) * -0.60 + (n - 742) * -0.80) * 0.016, he = -((X - 92) * 0.56 + (n - 733) * 0.83) * 0.016;
  return lerp(hw, he, wE) - 0.32 * Math.exp(-(((X - 58) / 7) ** 2));
}

// ---- stands of dune grass placed on purpose: islands in the play (the screen down the middle of the shared
// fairway, islands on fairway edges and in the carries) and marker stands; { c, rx, rz, rot (degrees), h: how
// tall the clumps stand (m), job }
export const STANDS = [
  // the screen between the shared fairway's halves: a broken row, gaps of 12-16 m
  ...[[16, 232], [20, 262], [24, 293], [30, 322]].map(([x, n], i) => ({ c: w([x, n]), rx: 4.2, rz: 7 + 2 * (i % 2), rot: 12, h: 1.4, job: 'screen' })),
];

// ---- the dunes: sand with tussocks, hummocky crests 5-10 m over the slacks, between the holes (never within about
// 30 m of a playing line, never on the shared fairway or the double green), rising into the foredune on the sea side
const lineD = (X, Z) => { let d = Infinity; for (const L of WLINES) d = Math.min(d, project(L, X, Z).d); return d; };
const polyIn = (P, X, Z) => { let inside = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i]; if ((az > Z) !== (bz > Z) && X < (bx - ax) * (Z - az) / (bz - az) + ax) inside = !inside; } return inside; };
const polyDist = (P, X, Z) => { let d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, t = clamp(((X - ax) * dx + (Z - az) * dz) / (dx * dx + dz * dz), 0, 1); d = Math.min(d, Math.hypot(X - ax - dx * t, Z - az - dz * t)); } return polyIn(P, X, Z) ? -d : d; };
export const sharedD = (X, Z) => polyDist(SHARED_FW, X, Z);
export function clearD(X, Z) {   // metres from the nearest ground kept clear of dunes
  return Math.min(lineD(X, Z), Math.max(0, sharedD(X, Z)) + 4, Math.max(0, dgE(X, Z)) + 6);
}
function duneShape(X, Z) {
  const n = -Z;
  const r1 = 1 - Math.abs(noise2(X / 64, n / 64, 41)), r2 = 1 - Math.abs(noise2(X / 29, n / 29, 42)), b = noise2(X / 47, n / 47, 43);
  return 0.62 * r1 * r1 + 0.28 * r2 * r2 + 0.18 * b - 0.18;   // about 0..1: crests, hummocks and a few blowouts
}
export function duneAt(X, Z, cd = coastD(X, Z)) {
  const m = smooth((clearD(X, Z) - 28) / 62) * smooth((cd - 55) / 55);
  if (m <= 0) return 0;
  const n = -Z, south = 1 - 0.45 * smooth((-n + 40) / 120), A = (7.5 + 2.5 * noise2(X / 220, n / 220, 44)) * south;
  return m * A * duneShape(X, Z);
}
// the foredune on the sea side: a crest 60-90 m in from the waterline
const foredune = (X, Z, cd) => seaSide(X, Z) ? (6.5 + 2 * noise1(-Z / 90, 45)) * Math.exp(-(((cd - 78 - 12 * noise1(-Z / 140, 46)) / 30) ** 2)) : 0;

// humps and hollows 15-40 m across on all the low ground (the rumpled links fairway), about 0.4 m high
export const rumple = (X, Z) => 0.24 * noise2(X / 15, Z / 15, 51) + 0.13 * noise2(X / 26, Z / 26, 52) + 0.05 * noise2(X / 7.5, Z / 7.5, 53);

// ---- the ground. raw: without the dunes (the floor the holes follow along their lines)
export function floorWorld(X, Z) { return floorAt(X, -Z) + rumple(X, Z); }
export function V(X, Z, raw = false) {
  const cd = coastD(X, Z);
  let y = floorWorld(X, Z);
  if (!raw) y += duneAt(X, Z, cd) + foredune(X, Z, cd);
  return wet(X, Z, y, cd);
}
// the beaches and the water cut into the ground: the coast, the Cauldron and the creek
export function wet(X, Z, y, cd = coastD(X, Z)) {
  // the beach: firm wet sand rising 0.05 a metre from the waterline for about 45 m, then up into the land
  if (cd < 120) {
    const beach = cd < 0 ? Math.max(-2.2, 0.35 + cd * 0.12) : 0.35 + cd * 0.052;
    // the sea side rises into its foredune; the lagoon side runs up gently off the Strand (a ball on it runs on)
    y = seaSide(X, Z) ? lerp(beach, y, smooth((cd - 38) / 44)) : lerp(beach, y, smooth((cd - 22) / 66));
  }
  const ce = cauldronE(X, Z);
  if (ce < 1.6) {   // the pool: a rim of beach about 8 m wide, then the bank up to the hole's ground
    const r = Math.min(CAULDRON.rx, CAULDRON.rz), into = (ce - 1) * r;   // metres outside the water's edge
    const pool = into < 0 ? Math.max(-1.6, 0.35 + into * 0.15) : 0.35 + into * 0.12;
    y = lerp(Math.min(y, pool), y, smooth((into - 7) / 30));
  }
  const kd = creekD(X, Z);
  if (kd < 30) { const bank = kd < 0 ? Math.max(-1.2, 0.3 + kd * 0.25) : 0.3 + kd * 0.38; y = lerp(Math.min(y, bank), y, smooth((kd - 4) / 22)); }
  return y;
}
export function waterAt(X, Z) {
  if (coastD(X, Z) < 0) return { level: SEA_LEVEL, body: -X > 250 || -Z > 1750 && X < 250 ? 'sea' : 'lagoon' };
  if (cauldronE(X, Z) < 1) return { level: SEA_LEVEL, body: 'cauldron' };
  if (creekD(X, Z) < 0) return { level: SEA_LEVEL, body: 'creek' };
  return null;
}
// the beaches: firm wet sand from the waterline up to about 40 m in (the Strand on the lagoon side), and the
// Cauldron's rim
export function beachAt(X, Z) {
  const cd = coastD(X, Z); if (cd >= 0 && cd < 40 + 6 * noise2(X / 30, Z / 30, 61)) return true;
  const ce = cauldronE(X, Z), r = Math.min(CAULDRON.rx, CAULDRON.rz); if (ce >= 1 && (ce - 1) * r < 7 + 2 * noise2(X / 11, Z / 11, 62)) return true;
  return false;
}

// ---- tussocks of dune grass on the dune sand: big separate clumps (about 1-1.5 m tall), crowding the crests and
// thinning down the faces, bare pale sand between. A jittered grid of possible clumps 3.2 m apart; each is kept by
// the density there. density: a base that rises on the crests, times the holes' zones (scene.mjs passes them in)
export const TUSSOCK_CELL = 3.2;
export function tussockDensity(X, Z, zones = []) {
  const crest = smooth((duneAt(X, Z) - 1.5) / 6);
  let d = 0.14 + 0.3 * crest;
  for (const g of zones) { const k = 1 - smooth((Math.hypot(X - g.c[0], Z - g.c[1]) - g.r) / (g.soft ?? 12)); if (k > 0) d = lerp(d, g.d, k); }
  return clamp(d, 0, 0.85);
}
// the clump at (X, Z), if any: { x, z, r }
export function tussockAt(X, Z, densAt) {
  const S = TUSSOCK_CELL, i0 = Math.floor(X / S), j0 = Math.floor(Z / S);
  for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
    const cx = (i + 0.2 + 0.6 * hash(i, j)) * S, cz = (j + 0.2 + 0.6 * hash(j, i + 7)) * S, r = 0.65 + 0.65 * hash(i + 3, j + 5);
    if (Math.hypot(X - cx, Z - cz) > r) continue;
    if (hash(i * 1.7 + 11, j * 1.3 + 4) < densAt(cx, cz)) return { x: cx, z: cz, r };
  }
  return null;
}

// ---- the built things and the wrecks that belong to no one hole (the holes' own props are in holes.mjs), in world space, for the plans, the sketches and the emitter. Boxes
// { kind, at, w (across), l (along its length), h, rot (compass bearing of its length), y (its foot above the
// ground), soak (the chance a hit kills the ball so it drops at the foot) }
const box = (kind, at, ww, l, h, bearing = 0, more = {}) => ({ kind, at: w(at), w: ww, l, h, rot: bearing * Math.PI / 180, ...more });
export const GALLEON = { c: [-100, 1000], bearing: 76, l: 48 };   // on her side across the 3rd's hollow, stern to the east
const gal = (d, b = GALLEON.bearing) => { const a = b * Math.PI / 180; return [GALLEON.c[0] + Math.sin(a) * d, GALLEON.c[1] + Math.cos(a) * d]; };
export const SITES = [
  // the Wrecker's Inn: built from a stern castle hauled up the beach, beside the 1st tee; its yard wall
  box('inn', [14, 111], 30, 44, 12, 80, { name: "the Wrecker's Inn", soak: 0.6 }),
  // the hauling ground: fishing luggers pulled up west of the 1st
  box('lugger', [-112, 150], 3.4, 10, 2.4, 300, { name: 'the luggers' }), box('lugger', [-121, 166], 3.2, 9, 2.2, 290), box('lugger', [-104, 181], 3.4, 10, 2.4, 312),
  // the false light: a wreckers' lantern on a post on the dune behind the double green
  { kind: 'lantern', at: w([-8, 775]), r: 0.4, h: 7, name: 'the false light' },
  // the galleon on her side in the 3rd's hollow: the hull lying across it, the stern castle at her east end and the
  // stump of her mizzen mast; the hull soaks a ball so it drops at its foot (never keeps it)
  box('hull', gal(-4), 9, 40, 6.5, GALLEON.bearing, { name: 'the galleon', soak: 0.8 }),
  box('castle', gal(19), 12, 11, 14, GALLEON.bearing, { soak: 0.8 }),
  { kind: 'mast', at: w(gal(16)), r: 0.55, h: 29, lean: 14, name: null },
  // the frigate sunk in the Cauldron: her masts stand out of the water (the aim point for the cut)
  { kind: 'mast', at: w([58, 1690]), r: 0.6, h: 30, name: "the frigate's masts" }, { kind: 'mast', at: w([74, 1684]), r: 0.55, h: 26 }, { kind: 'mast', at: w([88, 1678]), r: 0.5, h: 20, lean: -8 },
  box('hull', [73, 1685], 9, 40, 2.2, 107, { sunk: true }),
  // the beacon tower on the point
  { kind: 'beacon', at: w([-106, 1784]), r: 4.2, h: 26, name: 'the beacon' },
];
export const LABELS = [[w([-300, 900]), 'the sea'], [w([600, 1150]), 'the lagoon'], [w([38, 1670]), 'the Cauldron'], [w([-60, 1870]), 'the point'], [w([300, 1060]), 'the Strand'],
  [w([268, 1338]), 'the creek'], [w([-118, 168]), 'the hauling ground'], [w([14, 111]), "the Wrecker's Inn"], [w([-110, 1784]), 'the beacon'], [w([60, 300]), 'the shared fairway'],
  [w([58, 738]), 'the double green'], [w([-215, 700]), 'the foredune']];
export { lineD, polyIn, polyDist, floorAt };
