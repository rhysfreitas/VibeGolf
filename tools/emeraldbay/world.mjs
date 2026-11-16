// Emerald Bay, in world space (metres; X east, Z south (= -north), y up above LOW WATER). Pure, no DOM.
// An invented bay of limestone islands (the Krabi / Koh Phi Phi look): sheer karst with jungle on top, white sand,
// clear water. The chain of holes wraps once round the bay (claude/emerald-bay-layout.md, approved 15 November 2026).
// Points are written [x east, n north] as in the layout doc and turned to [X, Z = -n] by `w`.
//
// The tide (round 0, Rhys's picks 16 November 2026): the ground never moves; the sea stands at TIDES.low (0) or
// TIDES.high (2.4 m) for the whole round. Anything below the sea is water. Intertidal sand (tag 'wet') is firm wet
// sand when it is dry.
//
// Plan book round 1 (16 November 2026): the three play islands are shaped round their holes.
//   A, the village island: the 1st runs down a palm valley between karst towers (a half-pipe) from the stilt village
//     to a beach at the island's east end, under the headland the 2nd tees off.
//   B, the big island: the 3rd's green on a beach shelf under a low cliff; the 4th along a shelf 12-18 m up the
//     island's west side, leaning away from the bay into a jungle bank, three coves biting in from the left; the 5th
//     tees off its southern point onto the Sandbar.
//   C: the Sandbar lands on its low east end (the 5th green); the 6th climbs a jungle valley over a saddle between
//     two towers, a pinnacle in the fairway; the 7th rounds a cove on the north shore under a leaning cliff; the 8th
//     tees off the point toward the stack.
// The rest (the islet, the stack, the 9th's flats, spit, creek, cave and lagoon) is round 0's ground.
import { clamp, smooth, lerp, project, seDist, at, profileFn, lengthOf } from './geo.mjs';

export const TIDES = { low: 0, high: 2.4 };
export const HW = TIDES.high;
export const w = p => [p[0], -p[1]];
const W = P => P.map(w);

// ---- the playing lines from the layout doc (tee, corners, pin), approved 15 November 2026
export const LINES = [
  [[60, 200], [320, 310], [496, 257]],
  [[570, 290], [698, 369]],
  [[720, 400], [884, 482]],
  [[930, 500], [1050, 720], [970, 993]],
  [[960, 1000], [780, 1030], [616, 1112]],
  [[590, 1150], [400, 1190], [215, 1150]],
  [[230, 1040], [360, 1010], [435, 870]],
  [[475, 842], [520, 740]],
  [[600, 600], [360, 700], [131, 765]],
];
export const WLINES = LINES.map(W);
export const onLine = (k, s, off = 0) => at(WLINES[k], s, off);
export const lineD = (X, Z) => { let d = Infinity; for (const L of WLINES) d = Math.min(d, project(L, X, Z).d); return d; };
const LEN = WLINES.map(lengthOf);
// a point's place along a hole's line (s, and off + right of travel), carried on straight past either end
export function lineCoord(k, X, Z) {
  const L = WLINES[k], p = project(L, X, Z);
  const ext = (a, b, base, s0) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return { s: s0 + ((X - base[0]) * dx + (Z - base[1]) * dz) / l, off: (dx * (Z - base[1]) - dz * (X - base[0])) / l }; };
  if (p.s <= 0.01) return ext(L[0], L[1], L[0], 0);
  if (p.s >= LEN[k] - 0.01) return ext(L.at(-2), L.at(-1), L.at(-1), LEN[k]);
  return p;
}

// value noise in [-1, 1]
const h1 = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise1(t, seed = 0) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(h1(i, seed), h1(i + 1, seed), u); }
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}
const se = (x, n, rx, ry, rot = 0, p = 2.2) => ({ x, z: -n, rx, rz: ry, rot: rot * Math.PI / 180, p });
const tw = (x, n, r, top, seed = 1) => ({ X: x, Z: -n, r, top, seed });
const twL = (k, s, off, r, top, seed = 1) => { const [X, Z] = onLine(k, s, off); return { X, Z, r, top, seed }; };
const kn = P => profileFn(P);

// ---- the play islands' ground inside their coasts
// A: the 1st's palm valley (a half-pipe: banks either side of a level floor falling gently to the beach), the headland
const P1 = kn([[-60, 11], [0, 10], [90, 8.5], [150, 7.7], [240, 6.6], [282, 6.3], [400, 4.6], [470, 3.8], [530, 3.2]]);
export const HEADLAND = (() => { const [X, Z] = onLine(1, -12, 0); return { X, Z, r: 16, top: 24 }; })();   // the 2nd tee at its lip, so it sees the islet below
function landA(X, Z) {
  const c = lineCoord(0, X, Z), o = Math.abs(c.off);
  let y = P1(c.s) + 1.6 * (1 - Math.exp(-((o / 14) ** 2))) + 14 * smooth((o - 30) / 70) + 10 * smooth((o - 100) / 70) + 1.2 * noise2(X / 40, Z / 40, 3) * smooth((o - 18) / 30);   // a swale down the floor, then the banks
  y = Math.min(y, 34 + 4 * noise2(X / 70, Z / 70, 4));
  const dh = Math.hypot(X - HEADLAND.X, Z - HEADLAND.Z);
  if (dh < HEADLAND.r + 10) y = Math.max(y, HEADLAND.top * (1 - smooth((dh - HEADLAND.r) / 6)));
  return y;
}
// B: the 4th's shelf. Climbs 12 -> 18 m to the corner and eases to 10 at the green, falling to the 5th tee's point;
// across it leans 8% down to the right (away from the bay; the land between the coves rises on toward the west
// cliffs, so the bold line sees over the shelf), then the jungle bank climbs to the karst. A low cliff
// (the shelf's edge) stands behind the 3rd green, which sits on a beach shelf at about 4.5 m.
const P4 = kn([[-60, 12], [0, 12], [120, 13.6], [220, 15], [260, 15.2], [320, 14.2], [400, 13], [470, 12.4], [510, 12], [532, 8.5], [552, 5.6], [600, 4.5]]);
const PIN3 = w([884, 482]);
function landB(X, Z) {
  const c = lineCoord(3, X, Z), o = c.off;
  let y = P4(c.s) - 0.08 * clamp(o, -95, 40) * (1 - smooth((c.s - 500) / 40)) + 48 * smooth((o - 44) / 95) + 26 * smooth((o - 150) / 120) + 0.8 * noise2(X / 35, Z / 35, 31) * smooth((Math.abs(o) - 50) / 30);
  if (o < -40) y += 0.6 * noise2(X / 20, Z / 20, 32);
  const d3 = Math.hypot(X - PIN3[0], Z - PIN3[1]);
  if (d3 < 40) { const low = 4.6 + 0.4 * smooth((d3 - 10) / 16); y = Math.min(y, lerp(low, y, smooth((d3 - 27) / 3.5))); }
  return y;
}
// C: a jungle massif (40-60 m) with lowlands cut into it: the 5th green on the east end, the 6th's valley and saddle,
// the 7th's strip round the cove, the point
const P6 = kn([[-70, 5], [-24, 5], [0, 5.2], [110, 7.6], [200, 9.6], [226, 10.6], [248, 17.4], [318, 16.3], [324, 15.9], [352, 11.2], [383, 10], [420, 6.5], [450, 5], [520, 4]]);   // the saddle a table top: a 6.5 m face 226-248 m out, level over the top to 318
const PIN5 = w([616, 1112]), PIN7 = w([435, 870]), TEE8 = w([475, 842]);
function landC(X, Z) {
  let y = 46 + 12 * noise2(X / 90, Z / 90, 41) + 5 * noise2(X / 30, Z / 30, 42);
  const d5 = Math.hypot(X - PIN5[0], Z - PIN5[1]); y = Math.min(y, 4.3 + 0.3 * Math.max(0, d5 - 55));
  const c5 = lineCoord(4, X, Z); if (c5.s > 150 && c5.s < 420) y = Math.min(y, 3.4 + 1.0 * smooth((c5.s - 250) / 110) + 0.3 * Math.max(0, Math.abs(c5.off) - 50));
  const c6 = lineCoord(5, X, Z);
  if (c6.s > -90 && c6.s < 560) y = Math.min(y, P6(c6.s) + 36 * smooth((Math.abs(c6.off) - 30) / 70) + 0.7 * noise2(X / 25, Z / 25, 43));
  const c7 = lineCoord(6, X, Z);
  // the 7th: a beach strip round the cove; on the left the massif's face (the overhang) from its tee to the corner
  if (c7.s > -60 && c7.s < 340 && (c7.off > -56 || c7.s > OVER.s1)) y = Math.min(y, 4.4 + 0.5 * noise2(X / 30, Z / 30, 44) + 0.012 * Math.max(0, c7.off - 30) + 0.35 * Math.max(0, -c7.off - (c7.s > OVER.s1 ? 46 : 56)));
  const dp = Math.min(Math.hypot(X - PIN7[0], Z - PIN7[1]), Math.hypot(X - TEE8[0], Z - TEE8[1]) + 10); y = Math.min(y, 4.4 + 0.35 * Math.max(0, dp - 45));
  return y;
}
// the 7th's leaning cliff: a wall along its left, 90 m tall, leaning out 40 m over the beach at the top
export const OVER = { k: 6, s0: -30, s1: 205, foot: -50, lip: -10, top: 92 };
function overhangWall(X, Z) {
  const c = lineCoord(6, X, Z);
  if (c.s < OVER.s0 - 30 || c.s > OVER.s1 + 30 || c.off > OVER.foot + 2 || c.off < OVER.foot - 26) return null;
  const end = smooth((c.s - OVER.s0 + 30) / 30) * smooth((OVER.s1 + 30 - c.s) / 30);
  return { y: lerp(4.5, OVER.top + 6 * noise2(X / 30, Z / 30, 46), smooth((OVER.foot + 2 - c.off) / 3) * end), t: 'karst' };
}
// the overhang's underside over (X, Z), absolute metres, or null: the face leans out from its foot to its lip
export function overhangAt(X, Z) {
  const c = lineCoord(6, X, Z);
  if (c.s < OVER.s0 || c.s > OVER.s1 || c.off < OVER.foot || c.off > OVER.lip) return null;
  const t = (c.off - OVER.foot) / (OVER.lip - OVER.foot), end = Math.min(1, (c.s - OVER.s0) / 25, (OVER.s1 - c.s) / 25);
  return 4.5 + 58 * t + (1 - end) * 40;
}

// the 4th's coves, [s, inner edge's off, along] in its line's frame: each bites in from the sea on the left as far as
// its inner edge, so the bold line (tee to green, straight) crosses all three
const COVES4 = [[122, -44, 44], [342, -50, 40], [452, -13, 24]];
export const COVES = COVES4.map(([s, inner, ra]) => { const rc = 80, off = inner - rc, [X, Z] = onLine(3, s, off), [X2, Z2] = onLine(3, s + 1, off); return { X, Z, ra, rc, ux: X2 - X, uz: Z2 - Z, s, off, inner }; });
const coveIn = (X, Z) => { let best = -Infinity; for (const c of COVES) { const dx = X - c.X, dz = Z - c.Z, a = dx * c.ux + dz * c.uz, b = -dx * c.uz + dz * c.ux, e = Math.hypot(a / c.ra, b / c.rc); best = Math.max(best, (1 - e) * Math.min(c.ra, c.rc)); } return best; };
export const COVE7 = se(316, 946, 80, 40, 40, 2.1);   // the 7th's cove

// ---- islands: a coast (a union of superellipses, minus cove bites), beaches where listed ([x, n, r, w]: sand w m
// wide outside the coast within r of the point), the ground inside (`land`), karst towers on top. A karst island
// (`top`) is a sheer wall at the coast with jungle on top.
export const ISLANDS = [
  { id: 'A', name: 'the village island', seed: 11, se: [se(250, 240, 300, 182, 6, 2.4), se(505, 258, 74, 66, 0, 2.2), se(566, 298, 48, 32, 30, 2.6)],
    beaches: [[530, 230, 75, 26], [-50, 200, 110, 26], [300, 55, 110, 16], [430, 420, 60, 14]], land: landA,
    towers: [twL(0, 50, -122, 48, 128), twL(0, 190, -128, 58, 158, 2), twL(0, 330, -112, 44, 118, 3), twL(0, 40, 128, 50, 140, 4), twL(0, 175, 132, 64, 175, 5), twL(0, 300, 118, 46, 132, 6), tw(160, 410, 40, 105, 7), tw(30, 320, 42, 96, 8)] },
  { id: 'I', name: 'the islet', seed: 21, se: [se(704, 382, 52, 42, 30)], beaches: [[704, 382, 200, 13]], wob: 0.03,
    land: (X, Z) => { const d = seDist(se(704, 382, 52, 42, 30), X, Z); return 3.2 + 1.0 * smooth((1 - d) / 0.4); } },
  { id: 'B', name: 'the big island', seed: 31, se: [se(1018, 740, 168, 318, -6, 2.3), se(900, 505, 62, 44, 30, 2.2), se(955, 985, 70, 50, 20, 2.2)], bites: coveIn,
    beaches: [[870, 470, 60, 22], [930, 1020, 70, 22], ...COVES.map(c => { const [X, Z] = onLine(3, c.s, c.inner - 6); return [X, -Z, c.ra * 1.1, 16]; })], land: landB,
    towers: [tw(1135, 600, 78, 232), tw(1150, 860, 68, 192, 2), tw(1110, 470, 58, 164, 3), tw(1095, 1005, 42, 150, 4), tw(1002, 466, 34, 112, 5), tw(1185, 730, 50, 170, 6)] },
  { id: 'C', name: 'island C', seed: 41, se: [se(380, 1098, 330, 196, -4, 2.3), se(445, 925, 66, 88, 15, 2.3), se(652, 1102, 92, 58, 10, 2.2), se(474, 848, 20, 14, 30, 2.2)], bites: (X, Z) => (1 - seDist(COVE7, X, Z)) * 46,
    beaches: [[700, 1060, 70, 22], [700, 1150, 70, 20], [316, 946, 100, 20], [440, 850, 50, 18], [150, 1050, 80, 16]], land: landC,
    towers: [twL(5, 212, -86, 46, 205, 1), twL(5, 218, 88, 44, 196, 2), tw(395, 1262, 56, 200, 3), tw(150, 1205, 64, 165, 4), tw(560, 1238, 42, 140, 5), tw(110, 1110, 34, 120, 6), tw(500, 990, 40, 135, 7)] },
  // the sea stack: the 8th green on its flat top
  { id: 'stack', name: 'the sea stack', seed: 51, se: [se(520, 740, 21, 19, 10, 2.6)], beaches: [], top: 8, wob: 0.08, topFlat: true },
  // scenery: islands all round the bay and out to sea (karst, sheer)
  ...[[880, 260, 60, 50, 150], [1250, 250, 90, 70, 210], [760, 1280, 80, 60, 170], [1000, 1300, 70, 90, 230], [-90, 520, 70, 60, 150],
    [-60, 1100, 90, 80, 190], [620, 1430, 120, 70, 210], [180, -40, 90, 60, 160], [690, 60, 70, 60, 180], [1350, 1000, 70, 120, 240],
    [330, 560, 26, 22, 70], [790, 610, 30, 26, 90], [1260, 640, 40, 50, 150], [950, 1180, 30, 28, 100], [260, 900, 22, 26, 95],
    [-260, 800, 110, 80, 230], [1500, 500, 120, 90, 220], [400, -200, 140, 70, 200], [800, 1550, 110, 80, 240], [1100, 80, 80, 60, 170]]
    .map(([x, n, rx, ry, top], i) => ({ id: 's' + i, seed: 60 + i, se: [se(x, n, rx, ry, i * 37)], beaches: i % 3 === 0 ? [[x, n - ry, rx, 14]] : [], top, wob: 0.09 })),
];

// ---- the tide holes' own ground, in each line's frame (round 0)
const L3 = WLINES[2], L5 = WLINES[4], L9 = WLINES[8];
// 3 The Tongue: a tongue of sand from short of the green back toward the islet, under the sea at high water
export const TONGUE = { s0: 95, s1: 178, hw: 27 };
function tongue(X, Z) {
  const p = project(L3, X, Z); if (p.s < TONGUE.s0 - 40 || p.s > TONGUE.s1 + 20) return null;
  const t = clamp((p.s - TONGUE.s0) / (TONGUE.s1 - TONGUE.s0), 0, 1), hw = 4 + (TONGUE.hw - 4) * smooth(t / 0.55);
  const yc = 0.5 + 1.7 * smooth(t);
  const tip = p.s < TONGUE.s0 ? TONGUE.s0 - p.s : 0, o = Math.hypot(Math.abs(p.off) > hw ? Math.abs(p.off) - hw : 0, tip);
  const yi = yc - 0.6 * Math.min(1, (p.off / hw) ** 2);
  const y = o > 0 ? lerp(yi, -6, smooth(o / 30)) : yi;
  return y < -5.5 ? null : { y, t: 'wet' };
}
// the rock the 3rd's forward tee stands on, in the shallows beside the tongue's tip
export const TURTLE_ROCK = { s: 100, off: 28, r: 10, top: 5.5 };

// 5 The Sandbar (Rhys's pick: uneven): 42 m of salt grass, the open sea's side (north, off > 0) narrow, the bay's side
// a band of salt-grass rough and more dry sand, so at high water the sea is inside a medium miss on one side only
export const BAR = { s0: 30, s1: 300, fw: 21, north: { sand: 40, wet: 68 }, south: { rough: 40, sand: 58, wet: 86 } };
function sandbar(X, Z) {
  const p = project(L5, X, Z); if (p.s < BAR.s0 - 40 || p.s > BAR.s1 + 40) return null;
  const end = smooth((p.s - (BAR.s0 - 40)) / 40) * smooth(((BAR.s1 + 40) - p.s) / 40);
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

// 9 The Hong: the tee rock, the tidal flats, the spit (to the right, north), the creek across the line short of the
// cave, the beach at the cave mouth, the cave through the hollow island's east wall, the lagoon and its beach.
export const TEEROCK = { s: -4, off: 0, r: 22, top: 6.5 };
export const FLATS = { s: 200, off: -50, rs: 240, ro: 150 };
// the spit keeps well south of the sea stack (the 8th green has the sea all round at both tides): narrow on its north
// side until it is past the stack, then wide (dry ground to a medium miss and beyond where the drives land)
export const SPIT = { vc: profileFn([[-10, 2], [80, 6], [140, 14], [200, 44], [260, 62], [300, 64], [370, 56], [410, 44]]), crest: 22,
  north: s => { const k = smooth((s - 150) / 60); return { rough: 14 + 36 * k, sand: 20 + 42 * k, wet: 30 + 58 * k }; }, south: { sand: 34, wet: 55 } };
export const CREEK = { pts: [[330, 10], [344, -8], [356, -40], [352, -95], [336, -160], [306, -230]], hw: 9, bed: -1.6 };
export const CAVEBEACH = { s0: 360, s1: 412, o0: -40, o1: 80, y: 3.0 };
export const HOLLOW = { outer: se(40, 760, 176, 190, 0, 2.4), inner: se(60, 750, 112, 120, 0, 2.3), lagoon: se(20, 728, 100, 75, -8, 2.2), top: 115 };
export const CAVE = { s0: 388, s1: 462, hw: 30, floor: 3.0, roof: 43 };
const creekL = CREEK.pts.map(([s, o]) => at(L9, s, o));
function hong(X, Z) {
  const p = project(L9, X, Z), out = [];
  const fe = Math.hypot((p.s - FLATS.s) / FLATS.rs, (p.off - FLATS.off) / FLATS.ro);
  const fn = smooth((SPIT.vc(p.s) - 8 - p.off) / 20);
  if (fe < 1.25 && fn > 0) out.push({ y: lerp(-3, lerp(1.35 + 0.25 * noise2(X / 25, Z / 25, 12) + 0.08 * Math.sin(p.s * 0.9 + p.off * 0.3), -2.5, smooth((fe - 0.92) / 0.33)), fn), t: 'wet' });
  if (p.s > -40 && p.s < 430) {
    const d = p.off - SPIT.vc(p.s), o = Math.abs(d), wob = 3 * noise1(p.s / 30, d > 0 ? 14 : 15);
    const end = smooth((p.s + 40) / 30);
    let y, t;
    if (o <= SPIT.crest) { y = 3.3 - 0.3 * (o / SPIT.crest) ** 2; t = 'grass'; }
    else if (d > 0) {
      const { rough, sand, wet } = SPIT.north(p.s), rw = rough + wob, sw = sand + wob, ww = wet + wob;
      if (o <= rw) { y = lerp(3.0, 2.85, (o - SPIT.crest) / (rw - SPIT.crest)) + 0.2 * noise2(X / 6, Z / 6, 13); t = 'rough'; }
      else if (o <= sw) { y = lerp(2.85, 2.5, (o - rw) / (sw - rw)); t = 'sand'; }
      else if (o <= ww) { y = lerp(2.4, 0.2, (o - sw) / (ww - sw)); t = 'wet'; }
      else { y = lerp(0.2, -6, smooth((o - ww) / 40)); t = 'sea'; }
    } else {
      const { sand, wet } = SPIT.south, sw = sand + wob, ww = wet + wob;
      if (o <= sw) { y = lerp(2.95, 2.5, (o - SPIT.crest) / (sw - SPIT.crest)); t = 'sand'; }
      else if (o <= ww) { y = lerp(2.4, 1.3, (o - sw) / (ww - sw)); t = 'wet'; }
      else { y = lerp(1.3, -6, smooth((o - ww) / 40)); t = 'sea'; }
    }
    y = lerp(-6, y, end); if (y > -5.5) out.push({ y, t });
  }
  if (p.s > CAVEBEACH.s0 - 25 && p.s < CAVEBEACH.s1 + 20 && p.off > CAVEBEACH.o0 - 25 && p.off < CAVEBEACH.o1 + 25) {
    const e = Math.max(CAVEBEACH.s0 - p.s, CAVEBEACH.o0 - p.off, p.off - CAVEBEACH.o1, 0);
    out.push({ y: lerp(CAVEBEACH.y, 1.2, smooth(e / 20)), t: e > 6 ? 'wet' : 'sand' });
  }
  const tr = at(L9, TEEROCK.s, TEEROCK.off), dr = Math.hypot(X - tr[0], Z - tr[1]);
  if (dr < TEEROCK.r + 4) out.push({ y: TEEROCK.top * smooth((TEEROCK.r + 4 - dr) / 4), t: dr < TEEROCK.r ? 'grass' : 'karst' });
  if (!out.length) return null;
  let best = out[0]; for (const q of out) if (q.y > best.y) best = q;
  const c = project(creekL, X, Z);
  if (c.d < CREEK.hw + 7 && c.s > 0) {
    const yc = lerp(CREEK.bed, best.y, smooth((c.d - CREEK.hw + 3) / 10));
    if (yc < best.y) best = { y: yc, t: c.d < CREEK.hw ? 'sea' : best.t };
  }
  return best;
}
function hollow(X, Z) {
  const H = HOLLOW, ro = seDist(H.outer, X, Z), ri = seDist(H.inner, X, Z);
  const a = Math.atan2(Z - H.outer.z, X - H.outer.x), wob = 1 + 0.04 * noise1(a * 5, 71);
  if (ro > 1.12 * wob) return null;
  const p = project(L9, X, Z);
  const inCave = p.s > CAVE.s0 && p.s < CAVE.s1 && Math.abs(p.off) < CAVE.hw * (0.85 + 0.15 * Math.cos(Math.PI * (p.s - CAVE.s0) / (CAVE.s1 - CAVE.s0)));
  if (ri < 1) {
    const rl = seDist(H.lagoon, X, Z);
    if (rl < 1) return { y: lerp(-3, 1.0, smooth((rl - 0.75) / 0.25)), t: 'sea' };
    const y = lerp(1.0, 3.4, smooth((rl - 1) / 0.18));
    return { y, t: y > HW ? (rl > 1.3 ? 'grass' : 'sand') : 'wet' };
  }
  if (inCave) return { y: CAVE.floor, t: 'sand', cave: true };
  if (ro < wob) return { y: H.top + 6 * noise2(X / 40, Z / 40, 72), t: ro < wob * 0.93 ? 'jungle' : 'karst' };
  return { y: lerp(H.top, -4, smooth((ro / wob - 1) / 0.12)), t: 'karst' };
}
// the cave's roof over (X, Z), absolute metres, or null
export function caveRoofAt(X, Z) {
  const p = project(L9, X, Z);
  if (p.s < CAVE.s0 || p.s > CAVE.s1 || Math.abs(p.off) > CAVE.hw + 6) return null;
  const a = Math.min(1, (p.s - CAVE.s0) / 8, (CAVE.s1 - p.s) / 8);
  return CAVE.roof - 6 * (1 - a) - 8 * smooth((Math.abs(p.off) - CAVE.hw * 0.6) / (CAVE.hw * 0.4));
}
// anything overhead at (X, Z): the cave's roof or the 7th's overhang (absolute height of the underside), or null
export const roofAt = (X, Z) => caveRoofAt(X, Z) ?? overhangAt(X, Z);

// ---- the ground: the highest of everything, the sea bed below it all
function coastDist(I, X, Z) {
  let r = Infinity, R = 0;
  for (const o of I.se) { const d = seDist(o, X, Z); if (d < r) { r = d; R = (o.rx + o.rz) / 2; } }
  const o = I.se[0], a = Math.atan2(Z - o.z, X - o.x);
  const wob = 1 + (I.wob ?? 0.04) * noise1(a * 4.3 + 10, I.seed) + (I.wob ?? 0.04) * 0.5 * noise1(a * 13, I.seed + 3);
  let dIn = (1 - r / wob) * Math.min(R, 160);
  if (I.bites) dIn = Math.min(dIn, -I.bites(X, Z));
  return dIn;
}
function beachW(I, X, Z) {
  let bw = 0;
  for (const [x, n, r, b] of I.beaches || []) { const d = Math.hypot(X - x, Z + n); if (d < r * 1.3) bw = Math.max(bw, b * (1 - smooth((d - r * 0.8) / (r * 0.5)))); }
  return bw * (0.8 + 0.3 * noise2(X / 40, Z / 40, I.seed + 7));
}
function islandAt(I, X, Z) {
  const dIn = coastDist(I, X, Z);
  if (dIn < -95) return null;
  if (I.top) {
    if (dIn >= 0) {
      if (I.topFlat) { const back = smooth((Z - STACK.Z) / 6), rim = STACK.rim * back * (1 - smooth((dIn - 1.5) / 2.5)); return { y: I.top * smooth(dIn / 1.5) + (dIn > 1.2 ? rim : 0), t: dIn < 3.5 && back > 0.5 ? 'karst' : 'grass' }; }
      return { y: I.top * smooth(dIn / 3) + (dIn > 3 ? 4 * noise2(X / 30, Z / 30, I.seed) : 0), t: dIn > 3 ? 'jungle' : 'karst' };
    }
    const bw = beachW(I, X, Z);
    if (bw > 1 && -dIn < bw) { const y = lerp(3.0, -0.8, smooth(-dIn / bw)); return { y, t: y > HW ? 'sand' : 'wet' }; }
    if (-dIn - bw > 45) return null;
    return { y: lerp(bw > 1 ? -0.8 : -2, -7, smooth((-dIn - bw) / 40)), t: 'sea' };
  }
  let g;
  const bw = beachW(I, X, Z);
  if (dIn >= 0) {
    const y = I.land(X, Z);
    g = { y: bw > 1 ? lerp(Math.min(y, 3.4), y, smooth(dIn / 10)) : y, t: dIn < 4 && y > 5 && bw <= 1 ? 'karst' : 'jungle' };
  } else if (bw > 1 && -dIn < bw) { const y = lerp(3.2, -0.8, smooth(-dIn / bw)); g = { y, t: y > HW ? 'sand' : 'wet' }; }
  else if (-dIn - bw < 50) g = { y: lerp(bw > 1 ? -0.8 : -2.5, -7, smooth((-dIn - bw) / 45)), t: 'sea' };
  else return null;
  for (const T of I.towers || []) {
    const d = Math.hypot(X - T.X, Z - T.Z) / (T.r * (1 + 0.12 * noise1(Math.atan2(Z - T.Z, X - T.X) * 3, T.seed)));
    if (d < 1.05) { const y = lerp(g.y, T.top + 6 * noise2(X / 25, Z / 25, T.seed + 50), smooth((1.05 - d) / 0.08)); if (y > g.y) g = { y, t: d < 0.97 ? 'jungle' : 'karst' }; }
  }
  return g;
}
// the 2nd's forward tees: a ledge of rock in the shallows below the headland, beside the line
export const LEDGE2 = (() => { const [X, Z] = onLine(1, 50, 14); return { X, Z, r: 9, top: 4.5 }; })();
// the stack's rim: a lip of rock round its back (south) half that holds a long ball
export const STACK = { X: 520, Z: -740, rim: 1.6, spire: { X: 517, Z: -722, r: 6.5, top: 40 } };   // and a spire on the rim's back edge: the landmark seen across the bay
// the 6th's pinnacle: a 30 m pillar of rock in the middle of the fairway at the half-way point
export const PINNACLE = (() => { const [X, Z] = onLine(5, 192, 0); return { X, Z, r: 6.5, h: 30 }; })();

// V(X, Z): { y, t } where t is what the ground is made of: 'sea' (sea bed), 'wet' (intertidal sand), 'sand' (dry
// sand), 'grass', 'rough', 'jungle' (jungle floor), 'karst' (rock), and cave: true inside the sea cave (a roof overhead)
export function V(X, Z) {
  const bay = smooth((Math.hypot(X - 640, Z + 720) - 330) / 320);   // the bay's floor is shallow white sand
  let best = { y: lerp(-3.8, -9, bay) + 1.2 * noise2(X / 140, Z / 140, 90), t: 'sea' };
  const take = q => { if (q && q.y > best.y) best = q; };
  for (const I of ISLANDS) {
    const o = I.se[0], R = Math.max(o.rx, o.rz) + 200;
    if (Math.abs(X - o.x) > R + 260 || Math.abs(Z - o.z) > R + 260) continue;
    take(islandAt(I, X, Z));
  }
  take(overhangWall(X, Z));
  take(tongue(X, Z));
  const tr = at(L3, TURTLE_ROCK.s, TURTLE_ROCK.off), dt = Math.hypot(X - tr[0], Z - tr[1]);
  if (dt < TURTLE_ROCK.r + 5) take({ y: TURTLE_ROCK.top * smooth((TURTLE_ROCK.r + 5 - dt) / 5), t: dt < TURTLE_ROCK.r ? 'grass' : 'karst' });
  const dl = Math.hypot(X - LEDGE2.X, Z - LEDGE2.Z);
  if (dl < LEDGE2.r + 4) take({ y: LEDGE2.top * smooth((LEDGE2.r + 4 - dl) / 4), t: dl < LEDGE2.r ? 'grass' : 'karst' });
  take(sandbar(X, Z));
  take(hong(X, Z));
  const h = hollow(X, Z);
  if (h && (h.cave || seDist(HOLLOW.inner, X, Z) < 1)) best = h; else take(h);
  const ds = Math.hypot(X - STACK.spire.X, Z - STACK.spire.Z);
  if (ds < STACK.spire.r + 1.5) take({ y: lerp(8, STACK.spire.top + 2 * noise2(X / 4, Z / 4, 55), smooth((STACK.spire.r + 1.5 - ds) / 1.5)), t: 'karst' });
  const dp = Math.hypot(X - PINNACLE.X, Z - PINNACLE.Z);
  if (dp < PINNACLE.r + 2) take({ y: best.y + PINNACLE.h * smooth((PINNACLE.r + 1.5 - dp) / 1.5), t: 'karst' });
  return best;
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
  ...[[-18, 175, 0], [-6, 205, 20], [6, 232, -10], [-38, 222, 10], [-30, 250, 30], [12, 160, -20], [-48, 190, 5]].map(([x, n, r], i) => ({ kind: 'stilt', name: i === 0 ? 'stilt village' : null, at: w([x, n]), w: 9, l: 12, h: 6, rot: r * Math.PI / 180 })),
  { kind: 'jetty', at: w([18, 196]), w: 3, l: 40, h: 1.6, rot: 75 * Math.PI / 180 },
  ...[[-30, 160, 40], [40, 175, 80], [-55, 235, 10], [605, 230, 120], [80, 760, 30], [-10, 700, 60], [840, 450, 15]].map(([x, n, r], i) => ({ kind: 'longtail', name: i === 3 ? 'longtails' : null, at: w([x, n]), w: 2, l: 13, h: 1.2, rot: r * Math.PI / 180, water: true })),
  { kind: 'shack', name: 'beach shack', at: w([92, 800]), w: 14, l: 20, h: 6, rot: -20 * Math.PI / 180 },
  { kind: 'marker', name: 'crest marker', at: onLine(5, 252, -6), w: 1, l: 1, h: 6, rot: 0 },
  { kind: 'tree', name: 'twisted tree', at: w([528, 732]), w: 4, l: 4, h: 9, rot: 0 },
];
export const LABELS = [
  [w([0, 205]), 'stilt village'], [w([300, 330]), 'palm valley'], [w([566, 298]), 'the headland'], [w([704, 382]), 'the islet'],
  [w([800, 440]), 'the tongue'], [w([1100, 640]), 'karst'], [w([870, 880]), 'the coves'], [w([840, 1030]), 'the Sandbar'],
  [w([420, 1215]), 'the saddle'], [w([300, 975]), 'the cove'], [w([520, 740]), 'the sea stack'], [w([470, 650]), 'tidal flats'],
  [w([20, 728]), 'the lagoon'], [w([235, 735]), 'sea cave'],
];
