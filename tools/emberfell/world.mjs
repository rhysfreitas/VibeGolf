// Emberfell's volcano, in world space (metres; x east, -z north, y above the sea). Pure, no DOM.
// V(X, Z) is the mountain without the holes: a broad shoulder outside the cone where holes 1-4 play, the cone's
// upper slopes rising round it to the caldera rim, the Notch (a low saddle in the rim, the 5th tee), and inside
// the caldera wall, the slumped terraces stepping down it, the crater floor, the lava lake in its pit and the
// island in the lake. Each hole's ground follows V away from its line (scene.mjs), so the holes and the
// mountain always agree. Lava (the lake, the river on the 1st, the pool under the lavafall) is level and plays
// like water. Everything here is the plan data's shared ground; the holes add their own local shapes.
import { clamp, smooth, lerp, distLine, project, rnd, seDist } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

const D2R = Math.PI / 180;
// the caldera: centre, rim radius, and the Notch (the 5th tee) on the rim due south of the centre
export const CAL = { c: [0, -1500], r: 1500, notch: [0, 0], notchY: 1098, t1: 1042, t2: 1030, floor: 1012 };
export const SEA = { y: 0, coast: 7600 };   // the coast, metres south of the Notch

// bearing from the caldera's centre (degrees, 0 = north, 180 = the Notch) and distance
export function polar(X, Z) {
  const dx = X - CAL.c[0], dz = Z - CAL.c[1];
  return { th: (Math.atan2(dx, -dz) / D2R + 360) % 360, r: Math.hypot(dx, dz) };
}
const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d; };
const bell = (th, c, w) => Math.exp(-((angDiff(th, c) / w) ** 2));

// the rim: its radius wanders, and a bay at 213° pushes it out (the lavafall pours down the back of the bay);
// its crest is lowest at the Notch and rises to the summit, about 1,520 m, on the far side
const BAY = { th: 214, w: 8, out: 210 };
const rimN = th => 38 * noise1(th / 9, 3) + 18 * noise1(th / 3.1, 4);
export function rimR(th) {
  const pin = Math.exp(-((angDiff(th, 180) / 4) ** 2));
  return CAL.r + rimN(th) * (1 - pin) + BAY.out * bell(th, BAY.th, BAY.w);
}
export function crestY(th) {
  const dl = Math.abs(angDiff(th, 180)) * D2R;
  const lift = 420 * (1 - Math.exp(-((dl / 0.45) ** 2)));
  const rough = (34 * noise1(th / 7, 11) + 14 * noise1(th / 2.3, 12)) * (1 - Math.exp(-((dl / 0.14) ** 2)));
  // the Notch is a narrow V: its shoulders rise 70-90 m within 100-150 m either side, so from the shoulder
  // outside you see the gap's walls, not the caldera through it
  const gate = 92 * (1 - Math.exp(-((dl / 0.05) ** 2))) * Math.exp(-((dl / 0.13) ** 2));
  return CAL.notchY + lift + gate + rough + 40 * bell(th, 352, 22);
}

// inside: the levels under the wall. Two terraces slumped off the wall near the Notch (T1 and T2), only between
// about 160° and 205°; elsewhere the wall drops straight to the floor
const W1 = th => 240 * Math.exp(-(((Math.max(0, Math.abs(angDiff(th, 190)) - 10)) / 5) ** 2)) - 52 * bell(th, 192, 5);   // T1 inner edge (metres in from the rim)
const W2 = th => 360 * Math.exp(-(((Math.max(0, Math.abs(angDiff(th, 192)) - 16)) / 4) ** 2));
// where a terrace ends, its edge wanders across the slope instead of running straight down it
const thW = (th, d) => th + 2.6 * noise1(d / 26, 95) + 1.1 * noise1(d / 8, 96);    // T2 inner edge
// a terrace edge wanders at three scales: bays and prows, crags, teeth
const edgeN = (th, s) => 16 * noise1(th / 2.2, s) + 7 * noise1(th / 0.75, s + 1) + 2.5 * noise1(th / 0.22, s + 2);
function wallFoot(th, top) { return 55 + 0.2 * (crestY(th) - top); }

// the lava lake: a pit in the crater floor, and the island in it (the 9th's green and the clubhouse). The neck is
// the rock bridge out to the island: a natural span the fairway runs across, lava flowing under it
// round 2: the lake grows south and east, up under the second terrace's edge below the 7th, and the island sits
// deeper in it; its north shore by the 9th stays where it was
export const LAKE = { level: 1000, seed: 7, blobs: [[-750, -522, 18], [-722, -540, 26], [-690, -560, 38], [-625, -566, 74], [-535, -570, 92], [-430, -570, 96], [-345, -590, 94], [-265, -604, 58],
  [-575, -515, 66], [-470, -505, 72], [-360, -510, 74], [-250, -540, 72], [-175, -590, 62], [-150, -650, 48], [-215, -668, 40]] };
export const ISLAND = { c: [-384, -588], rx: 84, rz: 54, rot: 0.3, top: 1022, seed: 8 };   // round 7: top 1027 -> 1022, so the neck climbs onto it
export const NECK = { pts: [[-488, -706], [-432, -616]], w: 28 };
// metres outside the lake's shore (negative over the lava)
export const lakeD = (X, Z) => { let d = Infinity; for (const [x, z, r] of LAKE.blobs) { const e = Math.hypot(X - x, Z - z) - r; d = d === Infinity ? e : Math.min(d, e) - 0.08 * Math.max(0, 30 - Math.abs(d - e)); } return d + 7 * noise2(X / 40, Z / 40, LAKE.seed) + 3 * noise2(X / 12, Z / 12, LAKE.seed + 1); };
const islE = (X, Z) => seDist({ x: ISLAND.c[0], z: ISLAND.c[1], rx: ISLAND.rx, rz: ISLAND.rz, rot: ISLAND.rot }, X, Z) + 0.1 * noise2(X / 18, Z / 18, ISLAND.seed);
const neckD = (X, Z) => distLine(NECK.pts, X, Z) - NECK.w / 2 - 2.5 * noise1(project(NECK.pts, X, Z).s / 7, 5);

// the barranco: a deep gully carved down the outer flank, across the 2nd. Round 6: its head starts at z 360 (it was
// 262), below the Lava Tube's trench, so the 3rd's channel fairway sits on the shoulder above it
export const BARRANCO = { pts: [[48, 360], [52, 420], [70, 560], [80, 760], [110, 1100], [140, 1500]], depth: 16, floor: 34, wall: 62 };
// lava rivers, each in a channel sunk between its own levees, its surface following the ground down it. The 1st's
// (outside, from the spatter vent toward the sea; round 2 a third wider), the Spill (from a vent on the caldera
// floor below the terraces, past the 6th's green into the lake) and the Northern flow (from a
// vent far across the floor into the lake's east end)
export const RIVERS = [
  { name: 'the lava river', pts: [[-175, 540], [-238, 618], [-305, 658], [-371, 676], [-446, 708], [-526, 758], [-616, 828], [-716, 908], [-826, 998], [-946, 1098]], w: 22, levee: 4, sink: 4, len: 760 },
  { name: 'the Spill', pts: [[-30, -322], [-108, -352], [-170, -374], [-235, -394], [-292, -406], [-330, -434]], w: 17, levee: 2.6, sink: 3, len: 360, inside: true },
  { name: 'the overflow', pts: [[-878,-230],[-828,-191],[-789,-214],[-744,-235],[-707,-251],[-683,-265],[-669,-284],[-667,-309],[-669,-334],[-670,-362],[-667,-400],[-663,-441]], w: 9, levee: 1.2, sink: 1.8, len: 408, inside: true },   // round 4: the lavafall's pool spills back down the 7th's bay along the wall and across its fairway on the second shot
  { name: 'the northern flow', pts: [[-60, -1010], [-92, -940], [-122, -870], [-150, -790], [-172, -720], [-190, -672]], w: 18, levee: 2.8, sink: 3, len: 380, inside: true },
];
export const RIVER = RIVERS[0];
const riverP = (R, X, Z) => project(R.pts, X, Z);
export const riverCut = (X, Z) => { let y = 0; for (const R of RIVERS) { const rp = riverP(R, X, Z), half = R.w / 2; if (rp.d < half + 24 && rp.s > 0.5) y += R.levee * Math.exp(-(((rp.d - half - 3) / 6) ** 2)) - R.sink * (1 - smooth((rp.d - half + 2) / 4)); } return y; };
// crust fields: lobes of fresh black lava crusted over, glowing at the seams (native ground; raised a metre or two
// with steep fronts). Kept 40 m or more off the fairways
export const CRUSTS = [
  { pts: [[-40, -1060], [-80, -960], [-120, -880], [-160, -800], [-200, -740], [-235, -700]], w: 120 },   // round the northern flow
  { pts: [[-30, -320], [-108, -352], [-190, -385], [-265, -410]], w: 60 },                                 // round the Spill
  { pts: [[280, -700], [150, -680], [20, -655], [-100, -640]], w: 110 },                                   // the east floor
  { pts: [[-720, -1040], [-650, -950], [-600, -890]], w: 90 },                                             // north-west, behind the 9th
  { pts: [[-990, -540], [-930, -470]], w: 50 },                                                            // the bay, west of the 8th
  { pts: [[280, -230], [180, -262], [90, -296]], w: 60 },                                                  // the terraces east of the Notch
];
const crustD = (X, Z) => { let d = Infinity; for (const C of CRUSTS) { const pr = project(C.pts, X, Z); d = Math.min(d, pr.d - C.w / 2 * (1 + 0.32 * noise2(X / 34, Z / 34, 101) + 0.12 * noise2(X / 11, Z / 11, 103))); } return d; };
// the geyser field on the barranco's floor below the 2nd: sinter aprons round three geysers, mud pots, steam
// the vents the inside rivers come from: small spatter cones glowing at the mouth
export const VENTS = [{ at: [-30, -322], r: 20, h: 9 }, { at: [-60, -1010], r: 26, h: 12 }];
export const GEYSERS = [{ at: [66, 600], r: 26, erupt: 34 }, { at: [78, 652], r: 20 }, { at: [61, 704], r: 22 }];
const sinterD = (X, Z) => { let d = Infinity; for (const g of GEYSERS) d = Math.min(d, Math.hypot(X - g.at[0], Z - g.at[1]) - g.r * (1 + 0.25 * noise2(X / 7, Z / 7, 111))); return d; };

// the outer shoulder: a gentle bench round the Notch, falling to the sea. A few control heights shape it under
// the holes (the 1st runs down a little, the 4th climbs to the Notch)
export const RAMPART = { r: 100, h: 50, from: 92, to: 222 };
export const CTRL = [[-470, 610, 1084], [-168, 451, 1076], [-142, 478, 1077], [242, 491, 1081], [270, 512, 1081], [325, 362, 1082],
  [403, 246, 1083], [230, 146, 1088], [80, 201, 1093], [-46, 155, 1098], [-40, 60, 1100], [-600, 380, 1082], [560, 470, 1076], [-150, 760, 1074], [250, 720, 1072]];
const SIG = 170, phi = d2 => Math.exp(-d2 / (2 * SIG * SIG));
const regional = (r, rr) => 1098 - 0.03 * Math.max(0, r - rr) - 0.11 * Math.max(0, r - rr - 900) - 0.06 * Math.max(0, r - rr - 2600);
// Gaussian RBF through the control heights (their difference from the regional slope), solved once
const RBFW = (() => {
  const n = CTRL.length, A = CTRL.map(a => CTRL.map(b => phi((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2))), y = CTRL.map(([x, z, h]) => { const p = polar(x, z); return h - regional(p.r, rimR(p.th)); });
  for (let i = 0; i < n; i++) A[i][i] += 1e-6;
  // Gaussian elimination
  const M = A.map((row, i) => [...row, y[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
})();
function shoulder(X, Z, r, rr) {
  let y = regional(r, rr);
  for (let i = 0; i < CTRL.length; i++) y += RBFW[i] * phi((X - CTRL[i][0]) ** 2 + (Z - CTRL[i][1]) ** 2);
  // old flow lobes: a few metres of swell across the bench
  y += 2.2 * noise2(X / 80, Z / 80, 21) + 0.8 * noise2(X / 23, Z / 23, 22);
  return y;
}
// a smooth maximum (union of two surfaces with the join filled over k metres)
const smax = (a, b, k) => { const t = clamp(0.5 + 0.5 * (a - b) / k, 0, 1); return lerp(b, a, t) + k * t * (1 - t); };

export function V(X, Z) {
  const { th, r } = polar(X, Z), rr = rimR(th), H = crestY(th);
  if (r >= rr) {
    // outside: the cone's upper slope (about 29°, with gullies) meets the shoulder in a smooth join
    const gul = 11 * noise1(th / 3.4, 31) * smooth((r - rr) / 80);
    const cone = H - 0.55 * (r - rr) + gul;
    let y = smax(shoulder(X, Z, r, rr), cone, 22);
    // the barranco, a gully cut into the shoulder (deepening downhill), with steep walls
    const bp = project(BARRANCO.pts, X, Z), bd = Math.abs(bp.off) - BARRANCO.floor / 2 - 3 * noise1(bp.s / 30, 41);
    if (bd < BARRANCO.wall + 10 && bp.s > 0) {
      const dep = BARRANCO.depth * smooth((bp.s - 20) / 90) * (1 + bp.s / 1600);
      y -= dep * (1 - smooth(bd / BARRANCO.wall));
    }
    // the rampart: a crescent of welded spatter 40 m high curving round the outside of the Notch, so from
    // the holes outside you see its wall, not the caldera through the gap; the walk to the 5th tee goes round
    // its west end
    { const R = RAMPART, dx = X - CAL.notch[0], dz = Z - CAL.notch[1], dn = Math.hypot(dx, dz);
      if (dn < R.r + 70 && dn > 20) {
        const bn = (Math.atan2(dx, -dz) / D2R + 360) % 360, hh = R.h * smooth((bn - R.from) / 22) * (1 - smooth((bn - R.to) / 18)) * (1 + 0.12 * noise1(bn / 9, 61));
        const off = dn - R.r - 9 * noise1(bn / 14, 62), prof = Math.exp(-((off / (off < 0 ? 22 : 30)) ** 2));
        y += hh * prof * (1 + 0.08 * noise2(X / 9, Z / 9, 63));
      } }
    // the lava river's channel: levees either side, the lava sunk between them
    y += riverCut(X, Z);
    // sinter: the geysers' pale aprons, built up in low steps round each vent
    for (const g of GEYSERS) { const d = Math.hypot(X - g.at[0], Z - g.at[1]); if (d < g.r * 1.3) y += 1.6 * (1 - smooth(d / (g.r * 1.2))) + 0.9 * Math.exp(-((d / 3) ** 2)); }
    return y;
  }
  // inside the rim
  const d = rr - r, t1 = W1(th), t2 = W2(th);
  // the level the wall comes down to: T1, T2 or the floor
  let top = CAL.floor;
  if (t1 > 60) top = CAL.t1; else if (t2 > 60) top = CAL.t2;
  const wf = wallFoot(th, top);
  if (d < wf) {
    // the crest meets the outside as it is there (at the Notch, the shoulder comes right up to it)
    const a = th * D2R, Xr = CAL.c[0] + rr * Math.sin(a), Zr = CAL.c[1] - rr * Math.cos(a), Hc = smax(shoulder(Xr, Zr, rr, rr), H, 22);
    const t = d / wf, buttress = 4 * t * (1 - t) * (10 * noise1(th / 0.9, 51) + 5 * noise1(th / 0.3, 52));
    return top + (Hc - top) * Math.pow(1 - t, 2.2) + buttress;
  }
  let y = CAL.floor;
  // the terraces, each edge a craggy drop of 12 m (T1 to T2) and 18 m (T2 to the floor)
  const e1 = t1 + edgeN(th, 61), e2 = Math.max(t2, t1 + 40) + edgeN(th, 71);
  if (t2 > 40) y = lerp(CAL.floor, CAL.t2, 1 - smooth((d - e2 + 6) / 12));
  if (t1 > 40) y = lerp(y, CAL.t1, 1 - smooth((d - e1 + 4) / 9));
  // the wall's talus runs out over the level below it; the floor and terraces roll a little, falling gently
  // toward the centre
  y += 1.6 * noise2(X / 60, Z / 60, 81) + 0.6 * noise2(X / 17, Z / 17, 82) - 0.004 * Math.max(0, d - Math.max(e1, e2, wf) - 40);
  // the inside rivers' channels, their vents, and the crust fields' lobes (a raised front of fresh lava)
  y += riverCut(X, Z);
  for (const v of VENTS) { const dv = Math.hypot(X - v.at[0], Z - v.at[1]) / v.r; if (dv < 1) y += v.h * (1 - dv * dv) * (dv > 0.35 ? 1 : 0.5 + 0.5 * dv / 0.35); }
  { const cd = crustD(X, Z); if (cd < 6) y += 1.6 * (1 - smooth((cd + 6) / 12)) + 0.5 * noise2(X / 6, Z / 6, 102) * (cd < 0 ? 1 : 0); }
  // the lava lake's pit: a steep rim about 11 m down to the lava over 20 m; the island rises out of it,
  // joined to the north shore by the neck
  const ld = lakeD(X, Z);
  if (ld < 30) {
    const pit = 1 - smooth((ld + 2) / 22);
    y = lerp(y, LAKE.level - 1.5, pit);
    const ie = islE(X, Z);
    const nd = neckD(X, Z);
    const isl = Math.max(1 - smooth((ie - 0.75) / 0.45), 1 - smooth(nd / 9));
    const iy = lerp(1003, ISLAND.top + 2.5 * (1 - Math.min(1, ie)), smooth((1 - ie) / 0.3));
    // round 7: the neck climbs all the way to the island's top (it stopped 9 m short, so the 9th's green stood on an 11 m
    // wall of rock and a short approach dropped back to its foot: +2.2 a hole for the forward tees in the gate)
    if (isl > 0) y = lerp(y, nd < ie * 30 ? lerp(1012, ISLAND.top + 1, smooth(project(NECK.pts, X, Z).s / 104)) : iy, isl);
  }
  return y;
}

// lava: where it lies and its level (null if none). The lake, the river between its levees, the pool under the fall
export const POOL = { c: [-905, -250], rx: 36, rz: 26, rot: 0.9, level: 1009 };
// lava pools: under the lavafall, and (round 2) at the foot of the 5th's basalt columns, right of the corner.
// Round 7 (Rhys: "a little larger for a little more risk if you go for it"): the Terraces' pool grows, and a
// second lobe runs on from it toward the green along the right of the bold line (`more`: ellipses joined to it)
export const POOLS = [POOL, { c: [-263, -247], rx: 25, rz: 15, rot: 0.6, level: 1027.4, more: [{ c: [-289, -265], rx: 24, rz: 11, rot: 0.38 }] }];
// the lavafall: from a lip on the bay's crest down the wall into the pool; the plume's vent, far across the caldera
export const FALL = { top: [-985, -140], foot: [-905, -250], w: 22 };
export const VENT = { at: [180, -2350], r: 120, h: 60 };
export function lavaAt(X, Z) {
  if (lakeD(X, Z) < 0 && islE(X, Z) > 1 && neckD(X, Z) > 0) return { level: LAKE.level, body: 'lake' };
  for (const R of RIVERS) { const rp = riverP(R, X, Z); if (rp.s > 0.5 && rp.s < R.len && rp.d < R.w / 2 - 0.5) { const c = riverPt(R, rp.s); return { level: V(...c) + 0.6, body: 'river', c }; } }   // c: the channel's centre (a hole's ground can differ from V there: scene.mjs levels the lava to it)
  for (const P of POOLS) {
    const n = 0.12 * noise2(X / 9, Z / 9, 3);
    for (const E of [P, ...(P.more || [])]) if (seDist({ x: E.c[0], z: E.c[1], rx: E.rx, rz: E.rz, rot: E.rot }, X, Z) + n < 1) return { level: P.level, body: 'pool' };
  }
  return null;
}
function riverPt(R, s) { // a point on a river's centreline
  let acc = 0; const P = R.pts;
  for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (s <= acc + l) { const t = (s - acc) / l; return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; } acc += l; }
  return P.at(-1);
}

// what the native ground is, away from the play: fresh black lava on the shoulder, red cinder on the cone, grey
// ash inside the caldera, rubble at the foot of the walls, sulfur round the fumaroles (holes add their own)
export function nativeAt(X, Z) {
  const { th, r } = polar(X, Z), rr = rimR(th);
  if (r >= rr) {
    const conePart = crestY(th) - 0.55 * (r - rr) > (1098 - 0.03 * (r - rr)) + 2;
    if (sinterD(X, Z) < 0) return 'sinter';
    return conePart ? 'cinder' : 'flow';
  }
  const d = rr - r, top = W1(th) > 60 ? CAL.t1 : W2(th) > 60 ? CAL.t2 : CAL.floor, wf = wallFoot(th, top);
  if (d < wf * 0.92) return 'rock';
  if (d < wf + 25 + 10 * noise1(th / 1.1, 91)) return 'rubble';
  if (crustD(X, Z) < 0) return 'crust';
  return 'ash';
}
export const INSIDE = (X, Z) => { const { th, r } = polar(X, Z); return r < rimR(th); };
