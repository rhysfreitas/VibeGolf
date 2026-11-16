// The Labyrinth, plan book round 1: the whole maze as one world. Every wall (the outer wall, each hole's chambers and
// corridors, the rest of the maze), the floor and the landforms each hole names on its card, the water, the wall tops
// that are ground (the 8th's tee wall, the 9th's outer wall and the breach). Pure, no DOM.
//
// World frame: X east, Z south (the layout doc's (x, y north) is [x, -y] here), metres; y up. A wall is a prism:
// a footprint of four points, a bottom and a top height, an optional `shift` of the top (a lean), a `kind` (stone,
// ivy, door, tower, lintel, low, parapet) and `soak` (Rhys's picks, 16 November 2026: bare stone 0.45, ivy 0.8).
// `GROUND` lists the wall tops that are played on (they are ground, not walls).
import { at, project, rnd, inPoly, smooth, clamp, lerp, lengthOf } from './geo.mjs';

export const P = ([x, y]) => [x, -y];
export const SUN = { az: 255, el: 10 };                          // low evening sun from the west-south-west
export const SOAK = { stone: 0.45, ivy: 0.8, low: 0.6, door: 0, lintel: 0.45, tower: 0.45, bank: 0, parapet: 0 };
export const WATER = 11;                                         // the cistern's water

// the lines of play from the layout doc ([x east, y north] tee, corners, pin), in the world frame; the Elbow and the
// Two Doors have two versions (A, then B)
export const LINES = {
  1: [[80, 80], [230, 330], [204, 512]], 2: [[250, 580], [666, 590]],
  3: [[730, 540], [730, 330], [867, 322]], '3B': [[730, 540], [730, 330], [593, 322]],
  4: [[930, 350], [900, 560], [1006, 695]], 5: [[968, 740], [812, 760]], 6: [[720, 820], [560, 900], [499, 1007]],
  7: [[470, 1070], [385, 1160]], '7B': [[470, 1070], [545, 1160]], 8: [[420, 1215], [607, 1228]],
  9: [[670, 1305], [980, 1305], [1184, 1211]],
};
export const LW = Object.fromEntries(Object.entries(LINES).map(([k, L]) => [k, L.map(P)]));
export const TOWER = { at: [767, 794], half: 22, h: 120 };

export function leg(a, b) { const L = [a, b]; return { L, len: Math.hypot(b[0] - a[0], b[1] - a[1]), P: (s, off) => at(L, s, off) }; }
const legL = (a, b) => leg(P(a), P(b));
const box = (F, s0, s1, o0, o1, y0, y1, o = {}) => ({ pts: [F.P(s0, o0), F.P(s1, o0), F.P(s1, o1), F.P(s0, o1)], y0, y1, kind: 'stone', ...o });

// ---- the floor ------------------------------------------------------------------------------------------------
// the maze floor: about 12 m in the south, rising to about 20 in the north, gently heaved
const heave = (x, y) => 1.2 * Math.sin(x / 140 + 0.7) * Math.sin(y / 170 + 1.3) + 0.6 * Math.sin((x + y) / 95);
export const baseAt = (x, y) => 12 + 8 * smooth((y - 300) / 900) + heave(x, y);
const F1a = legL(...LINES[1].slice(0, 2)), F2 = legL(...LINES[2]), F3a = legL(...LINES[3].slice(0, 2));
const F3L = legL(LINES[3][1], LINES[3][2]), F3R = legL(LINES['3B'][1], LINES['3B'][2]);
const F4a = legL(LINES[4][0], LINES[4][1]), F4b = legL(LINES[4][1], LINES[4][2]);
const L6 = LW[6], L9 = LW[9], L4 = LW[4];
export const FRAMES = { F1a, F2, F3a, F3L, F3R, F4a, F4b };
// a point against a leg, its line carried on past both ends: { s, off (+ right) } (layout x, y)
export const legAt = (F, x, y) => { const [[ax, az], [bx, bz]] = F.L, ux = (bx - ax) / F.len, uz = (bz - az) / F.len, dx = x - ax, dz = -y - az; return { s: dx * ux + dz * uz, off: dz * ux - dx * uz }; };
const inF = (F, x, y, s0, s1, o0, o1) => { const p = legAt(F, x, y); return p.s >= s0 && p.s <= s1 && p.off >= o0 && p.off <= o1; };
const box2 = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

// the 4th: the causeway along its line (crowned: only the middle holds), three stepping stones inside the bend, the
// green's platform, everything else in the chamber water
export const STONES = [{ at: [975, 482], r: 20 }, { at: [1000, 560], r: 23 }, { at: [1030, 630], r: 18 }];
export const CISTERN = { x1: 1065, y0: 388, y1: 735, west: -42 };
const inCistern = (x, y) => { if (y < CISTERN.y0 || y > CISTERN.y1 || x > CISTERN.x1 || (x < 986 && y > 684)) return false; return project(L4, x, -y).off > CISTERN.west; };
function cisternAt(x, y) {
  const p = project(L4, x, -y), green = Math.hypot(x - 1006, y - 695);
  let h = WATER - 0.8;
  if (Math.abs(p.off) < 36 && p.s < lengthOf(L4) - 10) h = Math.max(h, 14.6 - 3.2 * Math.min(1, Math.abs(p.off) / 32) ** 1.5 - (p.off > 32 ? (p.off - 32) * 0.9 : 0));
  if (p.off <= -32 && p.s < lengthOf(L4) - 10) h = Math.max(h, 11.4 + 0.15 * Math.sin(x / 9) * Math.sin(y / 11));   // the shoulder and the strip to the west wall: rough
  for (const st of STONES) { const d = Math.hypot(x - st.at[0], y - st.at[1]); if (d < st.r + 3) h = Math.max(h, 12.8 - 0.5 * (d / st.r) ** 2 - (d > st.r ? (d - st.r) * 0.8 : 0)); }
  if (green < 32) h = Math.max(h, 13.5 - (green > 27 ? (green - 27) * 0.7 : 0));
  return h;
}

// the 6th: the terrace's face across the hole (7 m over 16 m) on a line square to its second leg, 11 m into it
const T6 = (() => { const c = at(L6, 190, 0), d = [L6[2][0] - L6[1][0], L6[2][1] - L6[1][1]], l = Math.hypot(...d); return { c, u: [d[0] / l, d[1] / l] }; })();
export const terraceT = (X, Z) => (X - T6.c[0]) * T6.u[0] + (Z - T6.c[1]) * T6.u[1];   // metres past the face's foot
// the 9th: the height along its line (the wall top, sagging toward the breach; the rubble at the breach's head; two
// steps down the ramp; the green outside at 21)
export const PROF9 = [[-60, 52], [150, 52], [370, 46], [394, 40], [440, 40], [460, 32], [490, 32], [508, 24], [520, 22], [560, 21.5]];
export const prof9 = s => { const K = PROF9; if (s <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], (s - K[i][0]) / (K[i + 1][0] - K[i][0])); return K.at(-1)[1]; };
export const WALLTOP = (x, y) => (x >= 600 && x <= 1060 && y >= 1275 && y <= 1335) || (x >= 960 && x <= 1060 && y >= 1225 && y <= 1335);
export const BREACH = [[1060, 1335], [1060, 1225], [1110, 1150], [1170, 1150], [1260, 1150], [1260, 1335]];
// the 8th: its tee wall's top (52) and the two stair blocks for the forward tees (40, 32); its sunken court (24)
export const W8 = { x0: 384, x1: 424, y0: 1195, y1: 1275, top: 52 };
export const STAIRS8 = [{ x0: 424, x1: 462, y0: 1208, y1: 1238, top: 40 }, { x0: 462, x1: 494, y0: 1212, y1: 1242, top: 32 }];
export const COURT8 = { x0: 424, x1: 700, y0: 1195, y1: 1275, floor: 24, pool: { at: [572, 1204], r: 11 } };
// the 5th: the dry moat across the court, the tower's stepped plinth
export const MOAT = { x0: 905, x1: 935, depth: 6 };
// the 6th: overgrown wall stubs 3 m high jutting into its first leg from alternate sides: [s, off0, off1] (- left)
export const STUBS6 = [[62, -50, -25], [112, 25, 52], [158, -52, -27]];
// the 7th: the two alcoves in the great wall, each 30 m wide, their floors a shelf 2.5 m over the forecourt
export const ALCOVES = [{ x: 385, door: 'A' }, { x: 545, door: 'B' }].map(a => ({ ...a, x0: a.x - 20, x1: a.x + 20, y0: 1145, y1: 1184 }));

// The floor at a layout point (no walls). `walls` are separate prisms; the wall tops that are played are here.
export function groundXY(x, y) {
  // the wall tops played on, and the 8th's stair blocks
  if (x >= W8.x0 && x <= W8.x1 && y >= W8.y0 && y <= W8.y1) return W8.top;
  for (const b of STAIRS8) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.top;
  if (WALLTOP(x, y)) { const p = project(L9, x, -y); return prof9(p.s) - 0.025 * clamp(p.off, -28, 28) * (1 - smooth((p.s - 330) / 40)); }
  if (inPoly(BREACH, x, y)) {                                    // the breach: the 9th's steps near its line, rubble slopes away from it
    const p = project(L9, x, -y), on = prof9(p.s), d = Math.max(0, Math.abs(p.off) - 30);
    const out = x > 1170 || y > 1335 ? 20 : baseAt(x, y);
    return lerp(on, out, smooth(d / 45)) + (d > 0 ? 1.4 * Math.sin(x * 0.19) * Math.sin(y * 0.23) * smooth(d / 20) : 0);
  }
  if (x > 1170 || y > 1335 || x < -60 || y < -60) return 20 + 1.5 * Math.sin(x / 90) * Math.sin(y / 110);   // outside the maze: open meadow
  // the 1st: the forecourt's half-pipe, the first court
  if (x >= 0 && x <= 336 && y >= 0 && y <= 306) { const d = Math.abs(project(F1a.L, x, -y).off); return 11.5 + 0.9 * (d / 12) ** 1.3 * (1 - smooth((d - 60) / 30)) + 3.5 * smooth((d - 35) / 45) + 0.4 * heave(x, y); }
  if (x >= 0 && x <= 342 && y > 306 && y <= 548) return 12.4 + 0.6 * heave(x, y);
  // the 2nd: the corridor, level, the landing area leaning 2.2% to the right
  if (inF(F2, x, y, -65, 470, -41, 41)) { const p = legAt(F2, x, y); return 13 - 0.03 * clamp(p.off, -31, 31) * smooth((p.s - 120) / 40) * (1 - smooth((p.s - 330) / 40)) + (p.s > 432 ? 6 * Math.min(1, (p.s - 432) / 16) : 0); }
  // the 3rd: the Elbow's corridors (level), the courts behind its low walls
  if (inF(F3a, x, y, -12, 250, -40, 40)) { const p = legAt(F3a, x, y); return 13.5 + 0.04 * clamp(p.off, -30, 30) * smooth((p.s - 60) / 40) * (1 - smooth((p.s - 200) / 25)); }
  // the second legs: level, the green perched on a dais 4.5 m up at the end (banks 100-120 m along the leg)
  for (const F of [F3L, F3R]) if (inF(F, x, y, -40, 175, -40, 40)) { const p = legAt(F, x, y); return 13.5 + 4.5 * smooth((p.s - 100) / 20); }
  if (box2(770, 360, 875, 445)(x, y) || box2(585, 360, 690, 445)(x, y)) return 13.9 + 0.5 * heave(x, y);
  // the 4th: the vestibule and the cistern
  if (box2(905, 296, 1075, 388)(x, y)) return 13.6;
  if (inCistern(x, y)) return cisternAt(x, y);
  // the 5th: the tower court, the moat, the plinth
  if (box2(700, 690, 980, 850)(x, y)) {
    const t = TOWER, dx = Math.max(0, Math.abs(x - t.at[0]) - t.half), dy = Math.max(0, Math.abs(y - t.at[1]) - t.half), dt = Math.hypot(dx, dy);
    if (dt < 7) return 14 + 3 * (1 - dt / 7);
    if (x > MOAT.x0 - 6 && x < MOAT.x1 + 6) { const e = Math.min(x - MOAT.x0, MOAT.x1 - x); return 14 - MOAT.depth * smooth((e + 6) / 9); }
    return 14;
  }
  // the 6th's garden (the terrace on its second leg; its top runs to y 1045, then a bank down to the forecourt)
  if (box2(450, 760, 700, 1060)(x, y)) {
    const t = terraceT(x, -y), top = 7 * smooth(t / 16) * (1 - smooth((y - 1045) / 13));
    const q = project(L6, x, -y), lean = q.s < 200 ? 0.05 * clamp(q.off, -35, 35) * smooth((q.s - 40) / 30) * (1 - smooth(t / 16)) : 0;
    return 15 + lean + 0.6 * heave(x, y) * (1 - smooth((y - 1030) / 20)) + top + 1.5 * smooth((y - 1045) / 13);
  }
  // the 7th's forecourt (level at 16.5, steps up to the alcoves' shelf from y 1127)
  if (box2(320, 1040, 700, 1145)(x, y)) return 16.5 + 0.25 * heave(x, y) * (1 - smooth((y - 1110) / 15)) + (y > 1127 ? 5 * smooth((y - 1127) / 18) : 0);
  for (const a of ALCOVES) if (x >= a.x0 && x <= a.x1 && y >= a.y0 - 1 && y <= a.y1) return 21.5;
  // the 8th's sunken court: its banks gather to the green
  if (x >= COURT8.x0 && x <= COURT8.x1 && y >= COURT8.y0 && y <= COURT8.y1) {
    const e = Math.min(x - COURT8.x0, COURT8.x1 - x, y - COURT8.y0, COURT8.y1 - y), pool = Math.hypot(x - COURT8.pool.at[0], y - COURT8.pool.at[1]);
    return COURT8.floor + 6 * (1 - smooth(e / 30)) - (pool < COURT8.pool.r + 3 ? 1.6 * (1 - smooth((pool - COURT8.pool.r + 3) / 6)) : 0);
  }
  return baseAt(x, y);
}
export const floorAt = (X, Z) => groundXY(X, -Z);
// what the world says about the ground's surface, before any hole's mown ground
export function worldSurface(X, Z) {
  const x = X, y = -Z;
  if (inCistern(x, y) && cisternAt(x, y) < WATER) return 'water';
  if (Math.hypot(x - COURT8.pool.at[0], y - COURT8.pool.at[1]) < COURT8.pool.r) return 'water';
  if (inPoly(BREACH, x, y)) { const p = project(L9, x, -y); if (p.s > 370 && p.s < 398) return 'rubble'; if (Math.abs(p.off) > 32) return 'rubble'; }
  return 'native';
}

// ---- the walls ------------------------------------------------------------------------------------------------
// a run of wall between two layout points, `t` thick, `h` over the floor there (or a fixed `top`); dressed: pieces
// 9-24 m long whose tops vary, some broken; `low`: [[s0, s1, h]] stretches fallen to h
function run(F, s0, s1, o0, o1, h, o = {}) {
  const out = [], r = rnd(o.seed || Math.round(s0 * 7 + o0 * 13 + 101));
  let s = s0;
  while (s < s1 - 0.5) {
    const len = Math.min(s1 - s, o.plain ? s1 - s : 9 + r() * 15), mid = s + len / 2, c = F.P(mid, (o0 + o1) / 2);
    let hh = o.plain ? h : h * (0.82 + 0.18 * r());
    for (const [a, b, hl] of o.low || []) if (mid > a && mid < b) hh = hl * (0.85 + 0.15 * r());
    const base = groundXY(c[0], -c[1]), top = o.top ?? base + hh;
    const kind = o.kind || (o.ivy && r() < 0.75 ? 'ivy' : 'stone');
    out.push(box(F, s, s + len, o0, o1, Math.min(base, o.top ?? base) - 3, top - (!o.plain && r() < 0.3 ? 2 + r() * 4 : 0), { kind, soak: SOAK[kind] ?? 0.45, top: 'grass' }));
    s += len;
  }
  return out;
}
const wallL = (a, b, t, h, o = {}) => { const F = legL(a, b); return run(F, 0, F.len, -t / 2, t / 2, h, o); };

let _W = null;
export function walls() {
  if (_W) return _W;
  const W = [], add = a => { for (const p of a) W.push(p); };
  // the outer wall, 60 m thick, its top at 52 (the north wall's top is the 9th's fairway); the gate behind the 1st tee
  const out = (x0, y0, x1, y1, o = {}) => W.push({ pts: [P([x0, y0]), P([x1, y0]), P([x1, y1]), P([x0, y1])], y0: 8, y1: o.top ?? 52, kind: 'ivy', soak: SOAK.ivy, top: 'grass', ...o });
  out(-60, -60, 40, 0); out(130, -60, 1170, 0); out(28, -64, 40, 4, { top: 60, kind: 'stone' }); out(130, -64, 142, 4, { top: 60, kind: 'stone' });
  out(-60, 0, 0, 1335); out(-60, 1275, 600, 1335); out(1110, 0, 1170, 1150);
  // the north wall's top (600-1060) and the corner bastion are ground; draw them as walls with the ground's top, and
  // the parapets along both edges (1.6 m: they keep a running ball on)
  W.push({ pts: [P([600, 1275]), P([1060, 1275]), P([1060, 1335]), P([600, 1335])], y0: 8, y1: 'ground', kind: 'ivy', soak: SOAK.ivy, top: 'grass', ground: true });
  W.push({ pts: [P([960, 1225]), P([1060, 1225]), P([1060, 1275]), P([960, 1275])], y0: 8, y1: 'ground', kind: 'ivy', soak: SOAK.ivy, top: 'grass', ground: true });
  for (const [y0, y1, x0, x1] of [[1275, 1277, 640, 960], [1333, 1335, 640, 1040], [1225, 1227, 960, 1030]]) {
    const F = legL([x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]);
    for (let s = 0; s < F.len; s += 10) { const c = F.P(s + 5, 0), g = groundXY(c[0], -c[1]); W.push(box(F, s, s + 10, -1, 1, g - 1, g + 1.6, { kind: 'parapet', soak: 0, top: null })); }
  }
  {
    const F = legL([960, 1226], [960, 1276]);   // the parapet down the bastion's west side
    for (let s = 0; s < F.len; s += 10) { const c = F.P(s + 5, 0), g = groundXY(c[0], -c[1]); W.push(box(F, s, s + 10, -1, 1, g - 1, g + 1.6, { kind: 'parapet', soak: 0, top: null })); }
  }

  // ---- the 1st: the forecourt, the inner gate, the first court ----
  add(wallL([336, 0], [336, 306], 12, 30, { ivy: true, seed: 11 }));
  add(wallL([0, 306], [181, 306], 16, 28, { ivy: true, seed: 12 })); add(wallL([253, 306], [342, 306], 16, 28, { ivy: true, seed: 13 }));
  const gw = legL([0, 306], [342, 306]);
  W.push(box(gw, 181, 195, -10, 10, 9, 62, { kind: 'stone', soak: SOAK.stone, top: 'grass' }), box(gw, 239, 253, -10, 10, 9, 62, { kind: 'stone', soak: SOAK.stone, top: 'grass' }));
  W.push(box(gw, 195, 239, -10, 10, 52, 62, { kind: 'lintel', soak: SOAK.lintel }));
  const dl = legL([195, 316], [192, 334]), dr = legL([239, 316], [242, 334]);
  W.push(box(dl, 0, 18, -1, 1, 11, 52, { kind: 'door', soak: 0 }), box(dr, 0, 18, -1, 1, 11, 52, { kind: 'door', soak: 0 }));
  add(wallL([342, 314], [342, 548], 12, 35, { ivy: true, seed: 14 }));
  add(wallL([0, 544], [196, 544], 12, 46, { ivy: true, seed: 15 }));

  // ---- the 2nd: the Long Corridor (Rhys's pick D: 60 m, dressed, two stretches of the north wall fallen to 14 m) ----
  add(run(F2, -55, 450, -41, -31, 60, { seed: 21, low: [[-60, 30, 34], [42, 128, 14], [150, 205, 46], [262, 335, 14]], ivy: true }));
  add(run(F2, -55, -28, 31, 41, 60, { seed: 22, low: [[-60, 40, 30]] }));
  W.push(box(F2, -28, 2, 31, 41, 53, 73, { kind: 'lintel', soak: SOAK.lintel }));
  add(run(F2, 2, 450, 31, 41, 60, { seed: 23, ivy: true }));
  add(run(F2, -65, -55, -41, 41, 60, { seed: 24 }));
  { const lean = 12 * Math.PI / 180, sh = 60 * Math.tan(lean), u = [(F2.L[1][0] - F2.L[0][0]) / F2.len, (F2.L[1][1] - F2.L[0][1]) / F2.len];
    W.push({ ...box(F2, 450, 464, -41, 41, 10, 73.5), kind: 'bank', soak: 0, lean: 12, shift: [-u[0] * sh, -u[1] * sh], top: 'grass' }); }

  // ---- the 3rd: the Elbow (round 0's design, Rhys's picks): both inside corners low with a court behind ----
  add(run(F3a, -12, 70, -40, -30, 58, { seed: 31, ivy: true })); add(run(F3a, -12, 70, 30, 40, 58, { seed: 32 }));
  const low = (F, s0, s1, o0, o1, seed) => { const r = rnd(seed); for (let s = s0; s < s1 - 0.5; s += 7) W.push(box(F, s, Math.min(s1, s + 7), o0, o1, 12, 13.5 + 8 + r() * 5, { kind: r() < 0.5 ? 'ivy' : 'stone', soak: SOAK.low, top: 'grass', lowwall: true })); };
  low(F3a, 70, 182, -40, -30, 35); low(F3a, 70, 182, 30, 40, 36);
  add(wallL([560, 286], [905, 286], 10, 58, { ivy: true, seed: 34 }));
  low(F3L, 38, 90, -40, -30, 37); low(F3R, 38, 90, 30, 40, 38);
  add(run(F3L, 90, 165, -40, -30, 58, { seed: 39, ivy: true })); add(run(F3R, 90, 165, 30, 40, 58, { seed: 40, ivy: true }));
  add(run(F3L, 160, 172, -40, 40, 58, { seed: 41 })); add(run(F3R, 160, 172, -40, 40, 58, { seed: 42 }));
  add(run(F3L, 90, 98, -140, -40, 50, { seed: 43, ivy: true })); add(run(F3R, 90, 98, 40, 140, 50, { seed: 44, ivy: true }));
  add(run(F3a, 62, 70, -140, -40, 50, { seed: 45, ivy: true })); add(run(F3a, 62, 70, 40, 140, 50, { seed: 46, ivy: true }));
  for (const [F, k] of [[F3L, 'A'], [F3R, 'B']]) {
    W.push(box(F, 30, 38, -40, -24, 10, 71.5, { kind: 'stone', soak: SOAK.stone, top: 'grass' }), box(F, 30, 38, 24, 40, 10, 71.5, { kind: 'stone', soak: SOAK.stone, top: 'grass' }));
    W.push(box(F, 30, 38, -24, 24, 53.5, 63.5, { kind: 'lintel', soak: SOAK.lintel }));
    // the door: a slab across the mouth when shut, slid into its posts when open (only in its version)
    W.push(box(F, 33, 35, -24, 24, 13.5, 53.5, { kind: 'door', soak: 0, only: k === 'A' ? 'B' : 'A', hole: 3 }));
  }

  // ---- the 4th: the vestibule, the cistern's walls (the west one lower, so the tower shows over it) ----
  add(run(F4a, 30, 215, -52, -42, 38, { seed: 51, ivy: true })); add(run(F4b, -12, 128, -52, -42, 42, { seed: 52, ivy: true }));
  add(wallL([1070, 300], [1070, 770], 10, 46, { ivy: true, seed: 53 }));
  add(wallL([985, 765], [1075, 765], 10, 46, { ivy: true, seed: 54 }));
  // the cistern's south side: a broken arcade, 4-6 m, so the tee sees the water
  { const F = legL([880, 384], [1066, 384]); const r = rnd(55); for (let s = 0; s < F.len; s += 12) { const c = F.P(s + 1.5, 0); if (Math.abs(project(L4, ...c).off) < 34) continue; W.push(box(F, s, s + 3, -3, 3, 12, 14 + 2 + r() * 3, { kind: 'low', soak: SOAK.low, top: 'grass', lowwall: true, pier: true })); } }
  add(wallL([905, 296], [905, 384], 10, 50, { seed: 56 }));

  // ---- the 5th: the tower court, a doorway behind the tee, the tower ----
  add(wallL([700, 690], [980, 690], 10, 50, { ivy: true, seed: 61 }));
  add(wallL([980, 690], [980, 728], 10, 50, { seed: 62 })); add(wallL([980, 752], [980, 850], 10, 50, { seed: 63 }));
  W.push(box(legL([980, 728], [980, 752]), 0, 24, -5, 5, 62, 72, { kind: 'lintel', soak: SOAK.lintel }));
  add(wallL([700, 850], [980, 850], 10, 50, { ivy: true, seed: 64 }));
  add(wallL([700, 690], [700, 790], 10, 50, { seed: 65 }));
  { const t = TOWER, x0 = t.at[0] - t.half, x1 = t.at[0] + t.half, y0 = t.at[1] - t.half, y1 = t.at[1] + t.half;
    W.push({ pts: [P([x0, y1]), P([x1, y1]), P([x1, y0]), P([x0, y0])], y0: 10, y1: 14 + 96, kind: 'tower', soak: SOAK.tower, top: null, shrink: 3 });
    W.push({ pts: [P([x0 + 6, y1 - 6]), P([x1 - 6, y1 - 6]), P([x1 - 6, y0 + 6]), P([x0 + 6, y0 + 6])], y0: 14 + 96, y1: 14 + 120, kind: 'tower', soak: SOAK.tower, top: null, shrink: 5 }); }

  // ---- the 6th's garden: its walls, the overgrown wall stubs (3 m) that bite in from alternate sides ----
  add(wallL([450, 760], [700, 760], 10, 44, { ivy: true, seed: 71 }));
  add(wallL([450, 760], [450, 1040], 10, 44, { ivy: true, seed: 72 }));
  add(wallL([320, 1040], [450, 1040], 10, 40, { ivy: true, seed: 75 })); add(wallL([320, 1040], [320, 1170], 10, 44, { ivy: true, seed: 76 }));
  add(wallL([700, 850], [700, 1100], 10, 40, { ivy: true, seed: 73 }));
  add(wallL([700, 1100], [700, 1195], 10, 40, { ivy: true, seed: 74 }));
  { const F6a = legL(LINES[6][0], LINES[6][1]);
    for (const [sc, o0, o1] of STUBS6) { const c = F6a.P(sc, (o0 + o1) / 2), g = groundXY(c[0], -c[1]); W.push(box(F6a, sc - 1.5, sc + 1.5, o0, o1, g - 1, g + 3, { kind: 'low', soak: SOAK.low, top: 'grass', lowwall: true })); } }

  // ---- the 7th: the great wall with the two alcoves (walls on three sides), their doors ----
  const W7 = (x0, x1) => add(run(legL([x0, 1170], [x1, 1170]), 0, x1 - x0, -25, 25, 45, { ivy: true, seed: 82 + x0 }));
  W7(330, 365); W7(405, 525); W7(565, 700);
  for (const a of ALCOVES) {
    add(run(legL([a.x0, 1184], [a.x1, 1184]), 0, 40, 0, -11, 45, { ivy: true, seed: 90 + a.x }));      // the alcove's back
    W.push(box(legL([a.x0, 1145], [a.x1, 1145]), 0, 40, 1, -3, 61.5, 67, { kind: 'lintel', soak: SOAK.lintel }));
    W.push(box(legL([a.x0, 1144], [a.x1, 1144]), 0, 40, 0.8, -0.8, 21.5, 61.5, { kind: 'door', soak: 0, only: a.door === 'A' ? 'B' : 'A', hole: 7 }));
  }

  // ---- the 8th: the tee wall (its top is ground), the court's walls ----
  W.push({ pts: [P([W8.x0, W8.y1]), P([W8.x1, W8.y1]), P([W8.x1, W8.y0]), P([W8.x0, W8.y0])], y0: 10, y1: W8.top, kind: 'ivy', soak: SOAK.ivy, top: 'grass', ground: true });
  for (const b of STAIRS8) W.push({ pts: [P([b.x0, b.y1]), P([b.x1, b.y1]), P([b.x1, b.y0]), P([b.x0, b.y0])], y0: 20, y1: b.top, kind: 'stone', soak: SOAK.stone, top: 'grass', ground: true });
  add(wallL([700, 1195], [700, 1275], 10, 30, { ivy: true, seed: 101 }));

  // ---- the rest of the maze: cells of 110 m, walls 26-58 m (lower in a band along the sightlines to the tower) ----
  const keep = [[[0, 0], [348, 0], [348, 556], [0, 556]], [[180, 520], [720, 520], [720, 640], [180, 640]], [[550, 280], [1080, 280], [1080, 560], [550, 560]],
    [[840, 280], [1080, 280], [1080, 750], [840, 750]], [[690, 680], [1000, 680], [1000, 860], [690, 860]], [[440, 750], [710, 750], [710, 1200], [440, 1200]],
    [[320, 1140], [710, 1140], [710, 1280], [320, 1280]], [[310, 1030], [710, 1030], [710, 1200], [310, 1200]], [[590, 1210], [1180, 1210], [1180, 1340], [590, 1340]], [[1050, 1100], [1180, 1100], [1180, 1340], [1050, 1340]]];
  const band = (a, b, w) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l * w, ny = (b[0] - a[0]) / l * w; return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]; };
  const sight = [band([80, 80], [767, 794], 30), band([250, 580], [767, 794], 22), band([480, 585], [767, 794], 22), band([420, 1215], [767, 794], 40)];
  const clear = (a, b, K) => { for (let t = 0; t <= 1; t += 0.05) { const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t); for (const k of K) if (inPoly(k, x, y)) return false; } return true; };
  const r = rnd(7), C = 110;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 12; j++) {
    const x0 = i * C, y0 = j * C;
    for (const [a, b] of [[[x0, y0], [Math.min(1110, x0 + C), y0]], [[x0, y0], [x0, Math.min(1275, y0 + C)]]]) {
      if (r() < 0.28 || b[0] - a[0] + b[1] - a[1] < 20) continue;
      if (!clear(a, b, keep)) continue;
      const lowSight = !clear(a, b, sight), h = lowSight ? 14 + r() * 8 : 26 + r() * 32;
      add(wallL(a, b, 10, h, { seed: i * 31 + j * 7 + 1, ivy: r() < 0.6 }));
    }
  }
  // ground-topped walls take their top from the ground
  for (const w of W) if (w.y1 === 'ground') w.y1 = Math.max(...w.pts.map(p => floorAt(p[0], p[1])));
  _W = W;
  return W;
}
// the walls for one version of a two-version hole (the other version's shut door is left out)
export const wallsFor = (ver = {}) => walls().filter(w => !w.only || (ver[w.hole] || 'A') === w.only);

// the outside of the maze is open meadow; FAR lists it for drawing
export const MAZE = { x0: -60, y0: -60, x1: 1170, y1: 1335 };
export { F1a, F2, F3a, F3L, F3R, F4a, F4b };
