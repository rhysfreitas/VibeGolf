// Emerald Bay, in world space (metres; X east, Z south (= -north), y up above LOW WATER). Pure, no DOM.
// An invented bay of limestone islands (the Krabi / Koh Phi Phi look): sheer karst with jungle on top, white sand,
// clear water. The chain of holes wraps once round the bay (claude/emerald-bay-layout.md, approved 15 November 2026).
// Points are written [x east, n north] as in the layout doc and turned to [X, Z = -n] by `w`.
//
// The tide: the ground never moves; the sea stands at TIDES.low (0) or TIDES.high (2.4 m) for the whole round.
// Anything below the sea is water. Intertidal sand (tag 'wet') is firm wet sand when it is dry.
//
// Round 0 (16 November 2026): the island outlines are still schematic, except where the tide holes (3, 5, 9) need
// their ground drawn properly: the Tongue, the Sandbar's section, the 9th's flats, creek, spit, cave and lagoon.
import { clamp, smooth, lerp, project, seDist, at, profileFn } from './geo.mjs';

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

// value noise in [-1, 1]
const h1 = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise1(t, seed = 0) { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(h1(i, seed), h1(i + 1, seed), u); }
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}

// ---- islands. A superellipse (or a union of them) with a wandering coast; `beach` is the width of sand outside the
// coast (0 = rock straight into the sea), `land(X, Z, dIn)` the ground inside (dIn: metres in from the coast).
// A karst island has `top`: a sheer wall at the coast, jungle on top.
const se = (x, n, rx, ry, rot = 0, p = 2.2) => ({ x, z: -n, rx, rz: ry, rot: rot * Math.PI / 180, p });
function coastDist(I, X, Z) {
  let r = Infinity, R = 0;
  for (const o of I.se) { const d = seDist(o, X, Z); if (d < r) { r = d; R = (o.rx + o.rz) / 2; } }
  const o = I.se[0], a = Math.atan2(Z - o.z, X - o.x);
  const wob = 1 + (I.wob ?? 0.05) * noise1(a * 4.3 + 10, I.seed) + (I.wob ?? 0.05) * 0.5 * noise1(a * 13, I.seed + 3);
  return { dIn: (1 - r / wob) * R, a };
}
const beachW = (I, a) => typeof I.beach === 'function' ? I.beach(a) : Math.max(0, I.beach * (0.6 + 0.6 * noise1(a * 5 + 3, I.seed + 7)));

// karst towers stood on the play islands: [x, n, r, top]
const tower = (x, n, r, top, seed = 1) => ({ X: x, Z: -n, r, top, seed });

export const ISLANDS = [
  { id: 'A', name: 'the village island', seed: 11, se: [se(270, 235, 255, 180, 8), se(560, 296, 48, 30, 25)], beach: 26,
    land: (X, Z, d) => 3 + 7 * smooth(d / 45) + 2 * noise2(X / 60, Z / 60, 3),
    towers: [tower(250, 360, 55, 140), tower(330, 140, 70, 170), tower(130, 330, 40, 110), tower(470, 150, 45, 120), tower(560, 300, 34, 24)] },
  { id: 'I', name: 'the islet', seed: 21, se: [se(700, 380, 42, 36, 30)], beach: 13, wob: 0.03,
    land: (X, Z, d) => 3 + 1.2 * smooth(d / 12) },
  { id: 'B', name: 'the big island', seed: 31, se: [se(1010, 720, 210, 330, -4)], beach: 22,
    land: (X, Z, d) => { const low = smooth(Math.hypot(X - 950, Z + 1000) / 140); return 3 + (2 + 12 * smooth((d - 22) / 6)) * low + 1.2 * (1 - low) * smooth(d / 30); },
    towers: [tower(1130, 600, 80, 230), tower(1150, 860, 70, 190), tower(1080, 1010, 50, 150), tower(1110, 450, 60, 160)] },
  { id: 'C', name: 'island C', seed: 41, se: [se(390, 1090, 330, 200, -4), se(432, 965, 68, 95, 15)], beach: 24,
    land: (X, Z, d) => 3.2 + 4 * smooth(d / 80) + 1.5 * noise2(X / 50, Z / 50, 5),
    towers: [tower(410, 1265, 60, 200), tower(395, 1105, 42, 200), tower(380, 1250, 40, 180), tower(150, 1200, 70, 160), tower(560, 1240, 45, 140), tower(350, 1000, 26, 110)] },
  // the sea stack: the 8th green on its flat top
  { id: 'stack', name: 'the sea stack', seed: 51, se: [se(520, 740, 21, 19, 10, 2.6)], beach: 0, top: 8, wob: 0.08 },
  // scenery: islands all round the bay and out to sea (karst, sheer)
  ...[[880, 260, 60, 50, 150], [1250, 250, 90, 70, 210], [760, 1280, 80, 60, 170], [1000, 1300, 70, 90, 230], [-90, 520, 70, 60, 150],
    [-60, 1100, 90, 80, 190], [620, 1430, 120, 70, 210], [180, -40, 90, 60, 160], [690, 60, 70, 60, 180], [1350, 1000, 70, 120, 240],
    [330, 560, 26, 22, 70], [790, 610, 30, 26, 90], [1260, 640, 40, 50, 150], [950, 1180, 30, 28, 100], [260, 900, 30, 34, 120]]
    .map(([x, n, rx, ry, top], i) => ({ id: 's' + i, seed: 60 + i, se: [se(x, n, rx, ry, i * 37)], beach: i % 3 === 0 ? 14 : 0, top, wob: 0.09 })),
];

// ---- the tide holes' own ground, in each line's frame (s along, off + right of travel)
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

// 5 The Sandbar: a crown of salt grass with dry white sand either side and firm wet sand below that. North (the open
// sea, off > 0) is narrow; south (the bay side) carries a band of salt-grass rough and more dry sand, so that at high
// water the dry ground runs out past a medium miss on one side (the penalty-ground Must).
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
export const FLATS = { s: 200, off: -50, rs: 240, ro: 150 };          // an ellipse in the 9th's line frame
// the spit keeps well south of the sea stack (the 8th's green has the sea all round at both tides): narrow on its north
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
  // the flats
  const fe = Math.hypot((p.s - FLATS.s) / FLATS.rs, (p.off - FLATS.off) / FLATS.ro);
  const fn = smooth((SPIT.vc(p.s) - 8 - p.off) / 20);
  if (fe < 1.25 && fn > 0) out.push({ y: lerp(-3, lerp(1.35 + 0.25 * noise2(X / 25, Z / 25, 12) + 0.08 * Math.sin(p.s * 0.9 + p.off * 0.3), -2.5, smooth((fe - 0.92) / 0.33)), fn), t: 'wet' });
  // the spit
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
  // the beach at the cave mouth
  if (p.s > CAVEBEACH.s0 - 25 && p.s < CAVEBEACH.s1 + 20 && p.off > CAVEBEACH.o0 - 25 && p.off < CAVEBEACH.o1 + 25) {
    const e = Math.max(CAVEBEACH.s0 - p.s, CAVEBEACH.o0 - p.off, p.off - CAVEBEACH.o1, 0);
    out.push({ y: lerp(CAVEBEACH.y, 1.2, smooth(e / 20)), t: e > 6 ? 'wet' : 'sand' });
  }
  // the tee rock
  const tr = at(L9, TEEROCK.s, TEEROCK.off), dr = Math.hypot(X - tr[0], Z - tr[1]);
  if (dr < TEEROCK.r + 4) out.push({ y: TEEROCK.top * smooth((TEEROCK.r + 4 - dr) / 4), t: dr < TEEROCK.r ? 'grass' : 'rock' });
  if (!out.length) return null;
  let best = out[0]; for (const q of out) if (q.y > best.y) best = q;
  // the creek, cut through whatever is there
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
  if (ro < wob) return { y: H.top + 6 * noise2(X / 40, Z / 40, 72), t: 'karst' };
  return { y: lerp(H.top, -4, smooth((ro / wob - 1) / 0.12)), t: 'karst' };
}

// ---- the ground: the highest of everything, the sea bed below it all
function islandAt(I, X, Z) {
  const { dIn, a } = coastDist(I, X, Z);
  if (I.top) {
    if (dIn >= 0) return { y: I.top * smooth(dIn / 3) + (dIn > 3 ? 4 * noise2(X / 30, Z / 30, I.seed) : 0), t: dIn > 3 ? 'jungle' : 'karst' };
    const bw = beachW(I, a);
    if (bw > 0 && -dIn < bw) { const y = lerp(3.0, -0.8, smooth(-dIn / bw)); return { y, t: y > HW ? 'sand' : 'wet' }; }
    if (-dIn - bw > 45) return null;
    return { y: lerp(bw > 0 ? -0.8 : -2, -7, smooth((-dIn - bw) / 40)), t: 'sea' };
  }
  let g;
  if (dIn >= 0) {
    g = { y: I.land(X, Z, dIn), t: dIn > 25 ? 'jungle' : 'rough' };
    for (const T of I.towers || []) {
      const d = Math.hypot(X - T.X, Z - T.Z) / (T.r * (1 + 0.12 * noise1(Math.atan2(Z - T.Z, X - T.X) * 3, T.seed)));
      if (d < 1.05) { const y = lerp(g.y, T.top, smooth((1.05 - d) / 0.08)); if (y > g.y) g = { y, t: d < 0.97 ? 'jungle' : 'karst' }; }
    }
  } else {
    const bw = beachW(I, a);
    if (-dIn < bw) { const y = lerp(3.0, -0.8, smooth(-dIn / bw)); g = { y, t: y > HW ? 'sand' : 'wet' }; }
    else if (-dIn - bw < 50) g = { y: lerp(-0.8, -7, smooth((-dIn - bw) / 45)), t: 'sea' };
    else return null;
  }
  return g;
}

// V(X, Z): { y, t } where t is what the ground is made of: 'sea' (sea bed), 'wet' (intertidal sand), 'sand' (dry
// sand), 'grass', 'rough', 'jungle', 'karst' (rock), and cave: true inside the sea cave (a roof overhead)
export function V(X, Z) {
  // the bay's floor is shallow white sand (turquoise water); it deepens outside the ring of islands
  const bay = smooth((Math.hypot(X - 640, Z + 720) - 330) / 320);
  let best = { y: lerp(-3.8, -9, bay) + 1.2 * noise2(X / 140, Z / 140, 90), t: 'sea' };
  const take = q => { if (q && q.y > best.y) best = q; };
  for (const I of ISLANDS) {
    const o = I.se[0], R = Math.max(o.rx, o.rz) * 1.5 + 60;
    if (Math.abs(X - o.x) > R + 400 || Math.abs(Z - o.z) > R + 400) continue;
    take(islandAt(I, X, Z));
  }
  take(tongue(X, Z));
  const tr = at(L3, TURTLE_ROCK.s, TURTLE_ROCK.off), dt = Math.hypot(X - tr[0], Z - tr[1]);
  if (dt < TURTLE_ROCK.r + 5) take({ y: TURTLE_ROCK.top * smooth((TURTLE_ROCK.r + 5 - dt) / 5), t: dt < TURTLE_ROCK.r ? 'grass' : 'karst' });
  take(sandbar(X, Z));
  take(hong(X, Z));
  const h = hollow(X, Z);
  if (h && (h.cave || h.t === 'sea' || h.t === 'wet' || h.t === 'sand' || h.t === 'grass')) { if (h.cave || seDist(HOLLOW.inner, X, Z) < 1) best = h; else take(h); }
  else take(h);
  return best;
}

// what the ground plays as at a tide: water under the sea, firm wet sand where intertidal sand is dry
export function surfaceAt(X, Z, tide = 'low') {
  const g = V(X, Z), sea = TIDES[tide];
  if (g.y < sea) return { ...g, s: 'water', depth: sea - g.y };
  const s = { wet: 'wetsand', sea: 'wetsand', sand: 'drysand', grass: 'grass', rough: 'rough', jungle: 'jungle', karst: 'rock' }[g.t];
  return { ...g, s };
}
