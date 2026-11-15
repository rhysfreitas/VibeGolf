// The Labyrinth, round 0: the maze round the 1st, 2nd and 3rd holes, for the tee-view sketches and the wall and
// door numbers. Not the plan book's full wall plan (that comes after Rhys's answers): the walls on and beside the
// lines of play from claude/labyrinth-layout.md, the tower, and a coarse fill of the rest of the maze so the skyline
// reads. Pure, no DOM.
//
// World frame: X east, Z south (Z = -north), metres; y up. The layout doc's (x, y north) is [x, -y] here.
// A wall is a prism: a footprint of four points, a bottom and a top height, an optional `shift` of the top (a lean),
// a `kind` (stone, ivy, door, tower, rubble, lintel), and `soak`.
import { at, project, rnd, inPoly, smooth, clamp, lerp, lengthOf } from './geo.mjs';

export const P = ([x, y]) => [x, -y];                         // layout doc point -> world
export const SUN = { az: 255, el: 10 };                       // compass bearing toward the sun, degrees above level
export const FLOOR = 12;                                      // the maze floor's mean height

// the lines of play (layout doc), in the world frame
export const LINES = {
  1: [[80, 80], [230, 330], [204, 512]].map(P),
  2: [[250, 580], [666, 590]].map(P),
  3: [[720, 540], [730, 330], [867, 322]].map(P),             // the Elbow, left (east door open)
  '3R': [[720, 540], [730, 330], [593, 338]].map(P),          // the Elbow, right (west door open)
};

// one leg of a line as a frame: P(s, off) with off + to the right of travel
function leg(a, b) {
  const L = [a, b], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return { L, len, P: (s, off) => at(L, s, off) };
}
const box = (F, s0, s1, o0, o1, y0, y1, o = {}) => ({ pts: [F.P(s0, o0), F.P(s1, o0), F.P(s1, o1), F.P(s0, o1)], y0, y1, kind: 'stone', soak: 0.45, ...o });

// A run of wall along a leg from s0 to s1, between offsets o0 and o1, h metres over the floor. Plain: one block.
// Dressed (variant B): pieces 9-24 m long whose tops vary (0.78-1.0 of h), broken tops, and notches high up that let
// the low sun through in shafts (`notch`: [[s0, s1, depth as a share of h]]). Ivy where `ivy` is set.
function run(F, s0, s1, o0, o1, h, o = {}) {
  const base = o.base ?? FLOOR, kind = o.ivy ? 'ivy' : 'stone', out = [];
  if (!o.dress) { out.push(box(F, s0, s1, o0, o1, base - 2, base + h, { kind, soak: o.soak ?? (o.ivy ? 0.75 : 0.45), top: 'grass' })); return out; }
  const r = rnd(o.seed || Math.round(s0 * 7 + o0 * 13 + 101));
  let s = s0;
  while (s < s1 - 0.5) {
    const len = Math.min(s1 - s, 9 + r() * 15), mid = s + len / 2;
    let hh = h * (0.78 + 0.22 * r());
    for (const [a, b, d] of o.notch || []) if (mid > a && mid < b) hh = h * (1 - d) * (0.92 + 0.08 * r());
    if (o.low) for (const [a, b, hl] of o.low) if (mid > a && mid < b) hh = hl * (0.85 + 0.15 * r());
    out.push(box(F, s, s + len, o0, o1, base - 2, base + hh, { kind: o.ivy && r() < 0.8 ? 'ivy' : 'stone', soak: o.soak ?? (o.ivy ? 0.75 : 0.45), top: 'grass' }));
    // a broken top: a lower stub on the far half of some pieces
    if (r() < 0.35) out.at(-1).y1 -= 2 + r() * 5;
    s += len;
  }
  return out;
}

// ---- the floor ----------------------------------------------------------------------------------------------
// gently heaved (the layout: 9-15 m), level inside the two corridors, the forecourt banked up either side of the
// 1st's first leg (its half-pipe), and the Elbow's fallen corner a rubble heap
const heave = (X, Z) => 1.8 * Math.sin(X / 140 + 0.7) * Math.sin(Z / 170 + 1.3) + 1.0 * Math.sin((X - Z) / 95);
const F1a = leg(LINES[1][0], LINES[1][1]), F1b = leg(LINES[1][1], LINES[1][2]);
const F2 = leg(LINES[2][0], LINES[2][1]);
const F3a = leg(LINES[3][0], LINES[3][1]), F3L = leg(LINES[3][1], LINES[3][2]), F3R = leg(LINES['3R'][1], LINES['3R'][2]);
const CORR2 = [F2.P(-60, -45), F2.P(470, -45), F2.P(470, 45), F2.P(-60, 45)];
const CORR3 = [F3a.P(-60, -45), F3a.P(260, -45), F3a.P(260, 45), F3a.P(-60, 45)];
const LEG3L = [F3L.P(-40, -45), F3L.P(175, -45), F3L.P(175, 45), F3L.P(-40, 45)];
const LEG3R = [F3R.P(-40, -45), F3R.P(175, -45), F3R.P(175, 45), F3R.P(-40, 45)];
const FORE = [P([0, 0]), P([330, 0]), P([330, 298]), P([0, 298])];

// the Elbow's inside corners: on each side of leg 1, the last 130 m of wall has crumbled to 9-14 m, and so has the
// first stretch of each leg 2's inside (north) wall; behind them a court of rough ground (the bold drive flies over
// both low walls and the court). A ball that hits a low wall drops at its foot on the tee side.
const ruinAt = () => null;
export function floorAt(X, Z) {
  let y = FLOOR + heave(X, Z);
  const flat = (poly, y0) => { if (inPoly(poly, X, Z)) y = y0; };
  flat(CORR2, FLOOR + 0.5); flat(CORR3, FLOOR + 1); flat(LEG3L, FLOOR + 1); flat(LEG3R, FLOOR + 1);
  if (inPoly(FORE, X, Z)) {                                    // the forecourt's half-pipe: banks either side
    const p = project(F1a.L, X, Z), d = Math.abs(p.off);
    y = FLOOR - 1 + 7 * smooth((d - 38) / 55) + 0.6 * heave(X, Z);
  }
  const r = ruinAt(X, Z); if (r !== null) y = Math.max(y, FLOOR + 1 + r);
  return y;
}

// ---- what's mown (round 0: schematic, for the views only; the plan book draws the real outlines) -----------------
export const GREENS = {
  1: { at: LINES[1][2], rx: 16, rz: 13 }, 2: { at: LINES[2][1], rx: 12, rz: 16 },
  3: { at: LINES[3][2], rx: 12, rz: 12.5 }, '3R': { at: LINES['3R'][2], rx: 12, rz: 12.5 },
};
export const TEES = { 1: LINES[1][0], 2: LINES[2][0], 3: LINES[3][0] };
function fwHalf(h, s) {
  if (h === 1) return s < 45 ? 0 : s < 266 ? lerp(26, 40, smooth((s - 45) / 120)) - 22 * Math.exp(-(((s - 266) / 18) ** 2)) : s < 300 ? 18 : s < 430 ? 34 : 22;
  if (h === 2) return s < 22 || s > 400 ? 0 : 25;
  return s < 30 ? 0 : 25;                                       // the Elbow's legs
}
export function paintAt(X, Z, version = 'L') {
  for (const k of [1, 2, 3, '3R']) {
    if ((k === 3 && version !== 'L') || (k === '3R' && version !== 'R')) continue;
    const g = GREENS[k], dx = X - g.at[0], dz = Z - g.at[1];
    if ((dx / g.rx) ** 2 + (dz / g.rz) ** 2 < 1) return 'green';
    if ((dx / (g.rx + 3)) ** 2 + (dz / (g.rz + 3)) ** 2 < 1) return 'fringe';
  }
  for (const [k, t] of Object.entries(TEES)) if (Math.abs(X - t[0]) < 6 && Math.abs(Z - t[1]) < 7) return 'tee';
  if (ruinAt(X, Z) !== null && ruinAt(X, Z) > 1.5) return 'rubble';
  const legs = [[1, LINES[1]], [2, LINES[2]], [3, version === 'L' ? LINES[3] : LINES['3R']]];
  for (const [h, L] of legs) {
    const p = project(L, X, Z), w = fwHalf(h, p.s), len = lengthOf(L);
    if (p.s > len - 2) continue;
    if (w && Math.abs(p.off) < w) return 'fairway';
    if (w && Math.abs(p.off) < w + 6) return 'rough';
  }
  return 'native';
}

// ---- the walls ----------------------------------------------------------------------------------------------
// variant 'plain': the layout's numbers as plain blocks (60 m corridors); 'dressed': the same footprints with the
// heights varied, broken tops and notches for the light. `door`: which of the Elbow's mouths is open ('L' or 'R').
export function walls(variant = 'dressed', door = 'L') {
  const D = variant !== 'plain', LOW = variant === 'low', BRK = variant === 'broken', W = [];
  const add = a => { for (const p of a) W.push(p); };
  // the outer wall, 60 m thick, about 40 m over the floor (its top grassed); the gate through it behind the 1st tee
  const out = (a, b, c, d, h = 40) => W.push({ pts: [P(a), P(b), P(c), P(d)], y0: FLOOR - 3, y1: FLOOR + h, kind: 'ivy', top: 'grass', soak: 0.75 });
  out([-60, -60], [40, -60], [40, 0], [-60, 0]); out([130, -60], [1230, -60], [1230, 0], [130, 0]);
  out([-60, 0], [0, 0], [0, 1400], [-60, 1400]); out([1170, 0], [1230, 0], [1230, 1400], [1170, 1400]);
  out([-60, 1340], [1230, 1340], [1230, 1400], [-60, 1400]);
  // the outer gate's posts, a little taller
  out([28, -64], [40, -64], [40, 4], [28, 4], 48); out([130, -64], [142, -64], [142, 4], [130, 4], 48);

  // ---- the 1st: the forecourt, the inner gate, the first court ----
  const fEast = leg(P([336, 0]), P([336, 314]));
  add(run(fEast, 0, 314, -6, 6, 30, { dress: D, ivy: true, seed: 11 }));
  // the inner gate's wall: 28 m, with gate towers 50 m either side of an opening 36 m wide and 40 m high (a lintel
  // over it, 40-50 m); the doors stand open into the first court
  const gw = leg(P([0, 306]), P([342, 306]));                   // runs east; right of travel = south
  const g0 = 192, g1 = 228;
  add(run(gw, 0, g0 - 14, -8, 8, 28, { dress: D, ivy: true, seed: 12 }));
  add(run(gw, g1 + 14, 342, -8, 8, 28, { dress: D, ivy: true, seed: 13 }));
  W.push(box(gw, g0 - 14, g0, -10, 10, FLOOR - 2, FLOOR + 50, { kind: 'stone', top: 'grass' }));
  W.push(box(gw, g1, g1 + 14, -10, 10, FLOOR - 2, FLOOR + 50, { kind: 'stone', top: 'grass' }));
  W.push(box(gw, g0, g1, -10, 10, FLOOR + 40, FLOOR + 50, { kind: 'lintel' }));
  // the door leaves, 18 m wide, 40 m high, 2 m thick, swung open against the court's side of the towers
  const dl = leg(P([g0, 316]), P([g0 - 3, 334])), dr = leg(P([g1, 316]), P([g1 + 3, 334]));
  W.push(box(dl, 0, 18, -1, 1, FLOOR, FLOOR + 40, { kind: 'door' })); W.push(box(dr, 0, 18, -1, 1, FLOOR, FLOOR + 40, { kind: 'door' }));
  // the first court: its east wall, and its north wall west of the 2nd's corridor (whose south wall stands behind
  // the 1st green: the first inner wall)
  const cEast = leg(P([336, 314]), P([336, 548]));
  add(run(cEast, 0, 234, -6, 6, 50, { dress: D, seed: 14, ivy: true }));
  add(run(leg(P([0, 544]), P([190, 544])), 0, 190, -6, 6, 50, { dress: D, seed: 15, ivy: true }));

  // ---- the 2nd: the Long Corridor, walls 60 m high and 62 m apart (faces 31 m either side of the line) ----
  const notchN = D ? [[95, 120, 0.42], [250, 268, 0.5]] : [], notchS = D ? [[170, 192, 0.45], [330, 345, 0.38]] : [];
  const lowN = D ? [[-60, 40, 34], [140, 205, 46]] : null, lowS = D ? [[-60, 40, 30]] : null;
  const H2 = LOW ? 36 : 60;                                    // variant C: side walls 30-36 m, the end wall still 60
  const lowC = LOW ? [[-60, 470, 36]] : null;
  // variant D: two stretches of the north wall fallen to about 14 m, where the tower shows over them (from the tee
  // through the first, s 42-128; from the landing area through the second, s 262-335)
  const lowD = BRK ? [[-60, 30, 34], [42, 128, 14], [150, 205, 46], [262, 335, 14]] : null;
  add(run(F2, -55, 450, -41, -31, H2, { dress: D, seed: 21, notch: LOW ? [[95, 120, 0.35], [250, 268, 0.4]] : BRK ? [] : notchN, low: lowD || lowC || lowN, ivy: true }));     // north (left)
  // south (right): a doorway from the first court beside the tee (s -28..2), and the gap at the green's right-back
  // into the head of the Elbow (s 425..450)
  add(run(F2, -55, -28, 31, 41, H2, { dress: D, seed: 22, low: lowC || lowS }));
  W.push(box(F2, -28, 2, 31, 41, FLOOR + 30, FLOOR + H2, { kind: 'lintel' }));
  add(run(F2, 2, 450, 31, 41, H2, { dress: D, seed: 23, notch: LOW ? [[170, 192, 0.35]] : notchS, low: lowC, ivy: D }));
  add(run(F2, -65, -55, -41, 41, H2, { dress: D, seed: 24 }));                                            // west end
  // the end wall behind the green: bare dressed stone, leaning in 12 degrees, 34 m behind the pin
  {
    const lean = 12 * Math.PI / 180, h = 60, sh = h * Math.tan(lean), u = [(F2.L[1][0] - F2.L[0][0]) / F2.len, (F2.L[1][1] - F2.L[0][1]) / F2.len];
    W.push({ ...box(F2, 450, 464, -41, 41, FLOOR - 2, FLOOR + 0.5 + h), kind: 'bank', soak: 0, lean: 12, shift: [-u[0] * sh, -u[1] * sh], top: 'grass' });
  }

  // ---- the 3rd: the Elbow (walls about 30 m either side), its corner at (730, 330), mouths east and west ----
  // leg 1: both side walls stand 58 m for 80 m, then crumble to 9-14 m to the corner (seen from the tee as a step
  // down on both sides, the gate towers and their doors standing above the low walls at the end)
  // (its head is the 2nd's corridor's south wall, just behind the tee; a stair in the end wall's flank between them)
  add(run(F3a, -12, 80, -40, -30, 58, { dress: D, seed: 31, ivy: true }));                 // east, standing
  add(run(F3a, -12, 80, 30, 40, 58, { dress: D, seed: 32 }));                              // west, standing
  const low = (F, s0, s1, o0, o1, seed) => { const r = rnd(seed); for (let s = s0; s < s1 - 0.5; s += 7) W.push(box(F, s, Math.min(s1, s + 7), o0, o1, FLOOR - 1, FLOOR + 1 + 8 + r() * 5, { kind: r() < 0.5 ? 'ivy' : 'stone', soak: 0.6, top: 'grass' })); };
  low(F3a, 80, 182, -40, -30, 35); low(F3a, 80, 182, 30, 40, 36);
  // the outer corner: leg 2's far (south) wall runs right across the end of leg 1
  add(run(leg(P([560, 302]), P([905, 290])), 0, 345, 0, 10, 58, { dress: D, seed: 34, ivy: true }));
  // leg 2 east and west: the inside (north) walls low from the mouth to s = 90, then standing; the end walls
  low(F3L, 38, 90, -40, -30, 37); low(F3R, 38, 90, 30, 40, 38);
  add(run(F3L, 90, 165, -40, -30, 58, { dress: D, seed: 39, ivy: true }));
  add(run(F3R, 90, 165, 30, 40, 58, { dress: D, seed: 40, ivy: true }));
  add(run(F3L, 160, 172, -40, 40, 58, { dress: D, seed: 41 }));
  add(run(F3R, 160, 172, -40, 40, 58, { dress: D, seed: 42 }));
  // the courts' far walls (standing): behind the low walls the court is about 100 m square
  add(run(F3L, 90, 98, -140, -40, 50, { dress: D, seed: 43, ivy: true }));
  add(run(F3R, 90, 98, 40, 140, 50, { dress: D, seed: 44, ivy: true }));
  add(run(F3a, 72, 80, -140, -40, 50, { dress: D, seed: 45, ivy: true }));
  add(run(F3a, 72, 80, 40, 140, 50, { dress: D, seed: 46, ivy: true }));
  // the gate towers at the two mouths (58 m, a lintel at 40): one door open (slid into its posts), one shut
  for (const [F, k] of [[F3L, 'L'], [F3R, 'R']]) {
    W.push(box(F, 30, 38, -40, -24, FLOOR - 2, FLOOR + 58, { kind: 'stone', top: 'grass' }));
    W.push(box(F, 30, 38, 24, 40, FLOOR - 2, FLOOR + 58, { kind: 'stone', top: 'grass' }));
    W.push(box(F, 30, 38, -24, 24, FLOOR + 40, FLOOR + 50, { kind: 'lintel' }));
    // open: the door has slid into the posts (open leaves swung back along leg 2 stood 40 m tall right where the bold
    // drive comes in over the low wall: walls.mjs found it); shut: a slab across the opening
    if (door !== k) W.push(box(F, 33, 35, -24, 24, FLOOR, FLOOR + 40, { kind: 'door', soak: 0 }));
  }

  // ---- the tower in its court (about 44 m square at its base, 120 m tall), the court's walls ----
  W.push({ pts: [P([745, 816]), P([789, 816]), P([789, 772]), P([745, 772])], y0: FLOOR - 2, y1: FLOOR + 96, kind: 'tower', top: null, shrink: 3 });
  W.push({ pts: [P([751, 810]), P([783, 810]), P([783, 778]), P([751, 778])], y0: FLOOR + 96, y1: FLOOR + 120, kind: 'tower', top: null, shrink: 5 });

  // ---- a coarse fill of the rest of the maze, so the skyline reads (not the plan: the plan book draws it) ----
  const r = rnd(7), keep = [CORR2, CORR3, LEG3L, LEG3R, FORE,
    [P([-10, 290]), P([350, 290]), P([350, 560]), P([-10, 560])], [P([680, 690]), P([900, 690]), P([900, 860]), P([680, 860])],
    [P([780, 370]), P([1060, 370]), P([1060, 730]), P([780, 730])],
    [P([560, 280]), P([910, 280]), P([910, 480]), P([560, 480])]];
  // round 0 keeps the sightlines to the tower open through the fill (the plan book designs them)
  const band = (a, b, w = 18) => { const A = P(a), B = P(b), l = Math.hypot(B[0] - A[0], B[1] - A[1]), nx = -(B[1] - A[1]) / l * w, nz = (B[0] - A[0]) / l * w;
    return [[A[0] + nx, A[1] + nz], [B[0] + nx, B[1] + nz], [B[0] - nx, B[1] - nz], [A[0] - nx, A[1] - nz]]; };
  keep.push(band([300, 600], [767, 794]), band([520, 600], [767, 794]), band([120, 120], [767, 794], 24));
  const clear = (a, b) => { for (let t = 0; t <= 1; t += 0.1) { const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t); for (const k of keep) if (inPoly(k, x, z)) return false; } return true; };
  const C = 110;
  for (let i = 0; i < 11; i++) for (let j = 0; j < 12; j++) {
    const x0 = i * C, y0 = j * C;
    for (const [a, b] of [[[x0, y0], [x0 + C, y0]], [[x0, y0], [x0, y0 + C]]]) {
      if (r() < 0.3) continue;
      const A = P(a), B = P(b); if (!clear(A, B)) continue;
      const F = leg(A, B), h = 26 + r() * 34;
      add(run(F, 0, C, -5, 5, h, { dress: true, seed: i * 31 + j * 7 + 1, ivy: r() < 0.6 }));
    }
  }
  return W;
}

// pins and the open door's green, for the views
export function flags(version = 'L') { return [GREENS[1].at, GREENS[2].at, version === 'L' ? GREENS[3].at : GREENS['3R'].at]; }
export { leg, F1a, F1b, F2, F3a, F3L, F3R };
