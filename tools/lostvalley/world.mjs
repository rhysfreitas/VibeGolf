// The Lost Valley, in world space (metres; x east, -z north, y above the sea). Pure, no DOM.
// A hidden valley walled in by the sheer sides of a table mountain (a tepui): V(X, Z) is the ground without the
// holes. The floor is a gentle basin shaped by control heights (an RBF, as Emberfell's shoulder), with the
// valley walls rising round it: a jungle talus, then a sheer cliff 380-470 m to the flat top. Round 3 (the new
// skeleton, 11 November 2026): the expedition camp sits on a knoll on the floor west of the river (the 1st tee);
// a ledge 27 m up the east wall carries the Nest (the 6th climbs a broad ramp of fallen rock to it from the
// south-west) and the Overlook's tee (the 7th drops off its bluff), with Nest Falls pouring onto it and its creek
// cascading off the bluff to run behind the 7th green into the river. The river starts in the plunge pool under
// the Great Falls on the north-east wall (the 9th finishes on a shelf of rock in it), cuts a short gorge through a
// rock sill (the rope bridge), braids south down the east side past the Floodplain (the 2nd), whose back channel
// crosses it, and ends in the swamp (the 5th), which drains away underground. The Bone Bluff stands in the 3rd's
// fairway and the tar seeps round the 4th green, west of the swamp. Each hole's ground follows V away from its
// line (scene.mjs).
import { clamp, smooth, lerp, distLine, project, seDist, at, lengthOf } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

const D2R = Math.PI / 180;
export const VALLEY = { c: [150, -800], rx: 910, rzN: 870, rzS: 985, floor: 400 };

// ---- the walls: the foot's radius from the centre wanders in bays and buttresses at three scales; the Great
// Falls pour down the back of a bay in the north-east wall, the ledge sits under the east wall
export function polar(X, Z) {
  const dx = X - VALLEY.c[0], dz = Z - VALLEY.c[1];
  return { th: (Math.atan2(dx, -dz) / D2R + 360) % 360, r: Math.hypot(dx, dz) };
}
const angDiff = (a, b) => ((a - b) % 360 + 540) % 360 - 180;
const bell = (th, c, w) => Math.exp(-((angDiff(th, c) / w) ** 2));
const ell = th => { const a = th * D2R; return 1 / Math.hypot(Math.sin(a) / VALLEY.rx, Math.cos(a) / (Math.cos(a) > 0 ? VALLEY.rzN : VALLEY.rzS)); };
// the bay of the Great Falls (north-east) and a few more bays the smaller falls come down
export const BAYS = [{ th: 24, w: 4, out: 70 }, { th: 300, w: 4, out: 70 }, { th: 248, w: 3.5, out: 50 }, { th: 124, w: 4, out: 60 }, { th: 335, w: 3, out: 45 }, { th: 97, w: 3, out: 40 }];
export function footR(th) {
  let r = ell(th) + 55 * noise1(th / 13, 3) + 22 * noise1(th / 4.5, 4) + 7 * noise1(th / 1.4, 5);
  for (const b of BAYS) r += b.out * bell(th, b.th, b.w);
  // the east wall behind the ledge runs fairly straight, so the ledge has a back wall
  r -= 25 * bell(th, 92, 14);
  return r;
}
// the height of the wall's top above the floor: 380-470 m, highest behind the Great Falls
export const topY = th => VALLEY.floor + 420 + 35 * noise1(th / 23, 7) + 12 * noise1(th / 6, 8) + 40 * bell(th, 30, 30);
// the wall's profile, d metres outside the foot: a jungle talus 40 m high over 70 m, then the cliff, near vertical
// with a few ledges, to the top (the lip rounded over 15 m)
function wallLift(d, th, top) {
  if (d <= 0) return 0;
  const T = 62 + 18 * noise1(th / 3, 11), tal = 42 + 8 * noise1(th / 5, 12);
  const talus = tal * Math.pow(smooth(d / T), 1.4);
  const H = top - VALLEY.floor - tal, run = H / 6.5;
  const c = clamp((d - T) / run, 0, 1);
  // ledges: two bands where the face steps back, jungle on them
  const n = 3, A = 0.82 + 0.1 * noise1(th / 4, 13), led = c + A * Math.sin(2 * Math.PI * n * c + 0.6 * noise1(th / 9, 14)) / (2 * Math.PI * n);
  return talus + H * clamp(led, 0, 1);
}

// ---- the floor: control heights (an RBF) under the holes, so each climbs or falls as planned
export const CTRL = [
  // the camp's knoll and the 1st: down off the knoll to the grove's hollow, then a little up to the green
  [-60, -1150, 414], [-150, -1180, 413], [40, -1150, 410], [155, -1152, 405], [284, -1111, 404.5],
  // the 2nd, down the floodplain beside the river to a gravel terrace
  [360, -1160, 404.5], [355, -1030, 402.5], [351, -910, 400.8], [310, -800, 399.6], [270, -686, 400.6],
  // the 3rd: over a crest and down into the bone bed's hollow
  [230, -660, 402.5], [100, -664, 404.5], [-6, -668, 399], [-60, -620, 395], [-141, -598, 391.5],
  // the 4th: up past the tar to its green
  [-120, -575, 392.5], [-26, -481, 397],
  // the 5th: off a low rise, down along the swamp's south side
  [10, -440, 403], [140, -415, 401.5], [266, -395, 400], [400, -430, 399], [489, -450, 399],
  // the ramp's foot (6) and the floor below the ledge (7's green)
  [590, -360, 400.5], [656, -822, 405], [740, -790, 405.5], [600, -860, 403],
  // the 8th: up onto the fig's knoll
  [725, -845, 405.5], [700, -960, 410], [672, -1050, 416], [654, -1110, 418.5],
  // the 9th: along the east bank and down to the pool
  [700, -1120, 419], [670, -1240, 417.5], [635, -1361, 414], [590, -1450, 411], [560, -1500, 409],
  // between the holes and away from them, so the floor doesn't swell where nothing holds it
  [150, -950, 402], [100, -1300, 404], [250, -1400, 406], [-250, -900, 402], [-350, -1250, 405], [-450, -600, 401], [-200, -300, 400],
  [150, -200, 399], [450, -200, 399], [700, -200, 400], [880, -1250, 408], [900, -400, 403], [200, -1500, 407], [-100, -1450, 405],
  [50, -800, 401], [600, -640, 401], [860, -1150, 412], [-450, -1000, 403], [380, -1300, 405],
  [0, -300, 401], [-250, -670, 394], [-300, -500, 399], [100, -560, 400.5], [-200, -800, 400],
  [-60, -150, 399], [250, -260, 401], [-400, -800, 403], [-320, -700, 399], [-250, -1050, 402], [-120, -1300, 406], [500, -1450, 409],
];
// a little smoothing (0.02 on the diagonal) so close control heights don't overshoot into hills and hollows
const SIG = 150, phi = d2 => Math.exp(-d2 / (2 * SIG * SIG)), REG = 402;
const RBFW = (() => {
  const n = CTRL.length, M = CTRL.map((a, i) => [...CTRL.map(b => phi((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) + (a === b ? 0.02 : 0)), a[2] - REG]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / row[i]);
})();
export function floorAt(X, Z) {
  let y = REG;
  for (let i = 0; i < CTRL.length; i++) { const dx = X - CTRL[i][0], dz = Z - CTRL[i][1]; if (Math.abs(dx) < 600 && Math.abs(dz) < 600) y += RBFW[i] * phi(dx * dx + dz * dz); }
  return y + 1.4 * noise2(X / 70, Z / 70, 21) + 0.5 * noise2(X / 21, Z / 21, 22);
}

// ---- the ledge: a shelf 27 m up under the east wall. Its front, the bluff, runs south to north and wanders in bays
// and prows; at its south end a broad ramp of fallen rock runs down south-west to the floor (the 6th climbs it).
// Nest Falls lands in a pool on it, and its stream runs off the bluff's lip between the 6th green and the 7th tee
export const LEDGE = { y: 432, pts: [[748, -585], [766, -640], [783, -700], [797, -760], [810, -830], [829, -900], [862, -975]], ramp: { a: [772, -628], b: [600, -372], w: 104 } };
const ledgeF = (X, Z) => {   // metres west of the bluff's lip (+ = out over the floor), and where along it
  const pr = project(LEDGE.pts, X, Z), len = lengthOf(LEDGE.pts);   // the line runs south to north, so its left (west, the floor) is -off
  // past either end, how far along the end segment carried on (negative before the start), so the ledge stops there
  const P = LEDGE.pts, ext = (a, b, sgn) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return sgn * ((X - b[0]) * dx + (Z - b[1]) * dz) / l; };
  let s = pr.s;
  if (pr.s < 0.5) s = -Math.max(0, ext(P[1], P[0], 1));
  else if (pr.s > len - 0.5) s = len + Math.max(0, ext(P.at(-2), P.at(-1), 1));
  const crag = 15 * noise1(s / 55, 31) + 7 * noise1(s / 17, 32) + 2.5 * noise1(s / 5, 33);
  return { e: -pr.off - crag, s, len };
};
// Nest Falls drops off the east wall into a pool on the ledge behind the 6th green; its stream crosses the ledge to
// the bluff's lip and spills off in a cascade, and the creek it feeds runs west along the 7th's left, round behind
// its green and on into the river
export const NEST_FALLS = { lip: [1110, -704], pool: { c: [952, -686], rx: 22, rz: 15, rot: 0.3, level: 431.6 }, stream: [[934, -686], [884, -688], [834, -690], [790, -691], [770, -692]], cascade: { top: [766, -692], foot: [750, -696] } };
export const CAMP_FALLS = NEST_FALLS;   // the old name (round 2 had it at the camp)
export const CREEK = { pts: [[748, -698], [728, -714], [709, -730], [690, -746], [671, -762], [652, -778], [637, -793], [624, -808], [615, -822], [609, -837], [604, -851], [600, -865], [602, -880], [596, -895], [580, -908], [556, -918], [530, -928], [505, -940]], w: 3.2, from: 404.4, to: 400.3 };

// ---- the river: [x, z, half-width, water level]; it starts in the plunge pool, runs through the gorge in the
// sill, braids south, bends west round the Bone Bluff and spreads into the swamp
export const POOL = { c: [492, -1582], rx: 74, rz: 50, rot: 0.35, level: 406 };
// the 9th's green stands on a shelf of rock jutting into the pool from its south-east shore, beside the outflow
export const SHELF = { c: [534, -1534], r: 19, neck: [[548, -1514], [559, -1495]], y: 407.6 };
export const GREAT_FALLS = { lip: [560, -1790], foot: [520, -1625], w: 44 };
export const RIVER = { pts: [
  [486, -1556, 8, 405.6], [482, -1505, 8, 404.6], [476, -1455, 9, 403.8], [468, -1395, 24, 403.2], [462, -1320, 38, 402.6],
  [458, -1240, 44, 402.0], [450, -1160, 42, 401.4], [444, -1080, 34, 400.8], [462, -1000, 22, 400.3], [512, -956, 18, 399.9],
  [498, -894, 17, 399.5], [470, -838, 18, 399.1], [430, -778, 20, 398.7], [400, -715, 24, 398.3]] };
// the back channel: a braid that leaves the river and crosses the 2nd about 380 m out, ending in an oxbow pond
export const BACKCH = { pts: [[462, -830], [425, -812], [385, -800], [345, -790], [305, -784], [268, -786], [238, -790]], w: 6, pond: { c: [205, -796], rx: 30, rz: 17, rot: -0.2 } };
// the gorge: where the river cuts through the sill, its walls stand sheer
export const GORGE = { from: 0.2, to: 2.6 };   // between these river points (by index, fractional)
export const BRIDGE = { a: [454, -1452], b: [498, -1447] };   // the rope bridge across the gorge, rim to rim, left of the 9th's approach
// the swamp: still water in pools between tall trees, about 1 m below the land round it, where the river ends;
// the 5th runs along its south side
// the 5th's stepping stones: two pools reaching across its second leg from the swamp, leaving a dry way round
// the right (each a rotated ellipse: centre, half-length across the line, half-width along it, rotation)
export const POOLS5 = [[305, -426, 40, 11, 1.33], [384, -446, 40, 11, 1.33]];
export const POOLS8 = POOLS5;   // the old name
export const SWAMP = { level: 397.4, blobs: [[372, -668, 52], [392, -598, 60], [342, -560, 62], [398, -540, 46], [384, -500, 48], [330, -505, 44], [296, -540, 58], [436, -530, 24]], seed: 41 };
// the tar pit: a black seep in a hollow west of the swamp; its three pools wrap the 4th green's front and right
export const TAR = { c: [-75, -522], rx: 30, rz: 19, rot: 0.85, level: 395.2, seed: 51, blobs: [[-75, -522, 26, 17, 0.85], [-61, -493, 18, 12, 1.3], [-48, -474, 13, 8, 0.8]] };
// the Bone Bluff: a sandstone outcrop 30 m high standing in the middle of the 3rd's fairway at the corner, a
// long-neck's skeleton half out of its east face, toward the tee
export const BLUFF = { c: [-6, -673], rx: 22, rz: 15, rot: 0.03, h: 30, seed: 61 };

const riverAt = (X, Z) => {   // nearest point on the river: s, offset, half-width and level there
  const P = RIVER.pts, L = P.map(p => [p[0], p[1]]), pr = project(L, X, Z);
  let acc = 0;
  for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (pr.s <= acc + l || i === P.length - 2) { const t = clamp((pr.s - acc) / l, 0, 1); return { ...pr, i: i + t, hw: lerp(P[i][2], P[i + 1][2], smooth(t)), level: lerp(P[i][3], P[i + 1][3], t) }; } acc += l; }
};
// braids: in the wide reaches the water runs in two or three channels with gravel bars between; a point is
// wet when it is near one of the channels' wandering centres
function braidWet(rp) {
  if (rp.hw < 24) return Math.abs(rp.off) < rp.hw;
  const k = (rp.hw - 24) / 28, s = rp.s;
  const C = [[0.0 + 0.35 * noise1(s / 90, 71), 0.30], [-0.62 + 0.18 * noise1(s / 70, 72), 0.16 + 0.06 * k], [0.62 + 0.18 * noise1(s / 75, 73), 0.15 + 0.07 * k]];
  return C.some(([c, w]) => Math.abs(rp.off / rp.hw - c) < w * (1 + 0.35 * noise1(s / 23 + c * 9, 74))) && Math.abs(rp.off) < rp.hw;
}
export const swampD = (X, Z) => { let d = Infinity; for (const [x, z, r] of SWAMP.blobs) d = Math.min(d, Math.hypot(X - x, Z - z) - r); return d + 14 * noise2(X / 45, Z / 45, SWAMP.seed) + 6 * noise2(X / 15, Z / 15, SWAMP.seed + 1); };
// inside the swamp, water stands in pools; between them low hummocks of mud and roots
export const swampWet = (X, Z) => swampD(X, Z) < -6 && noise2(X / 26, Z / 26, SWAMP.seed + 3) + 0.4 * noise2(X / 9, Z / 9, SWAMP.seed + 4) > -0.15 - 0.012 * Math.min(40, -swampD(X, Z));
const tarE = (X, Z) => Math.min(...TAR.blobs.map(([x, z, rx, rz, rot]) => seDist({ x, z, rx, rz, rot }, X, Z))) + 0.1 * noise2(X / 11, Z / 11, TAR.seed);
const poolE = (X, Z) => seDist({ x: POOL.c[0], z: POOL.c[1], rx: POOL.rx, rz: POOL.rz, rot: POOL.rot }, X, Z) + 0.1 * noise2(X / 14, Z / 14, 81);
// the shelf: metres inside its edge (+ inside), with the neck that joins it to the shore
const shelfIn = (X, Z) => Math.max(SHELF.r - Math.hypot(X - SHELF.c[0], Z - SHELF.c[1]) + 2.2 * noise1(Math.atan2(Z - SHELF.c[1], X - SHELF.c[0]) * 3, 82), 11 - distLine([SHELF.c, ...SHELF.neck], X, Z));
const p8E = (X, Z) => Math.min(...POOLS5.map(([x, z, rx, rz, rot]) => seDist({ x, z, rx, rz, rot }, X, Z))) + 0.1 * noise2(X / 10, Z / 10, 83);
const pondE = (P, X, Z) => seDist({ x: P.c[0], z: P.c[1], rx: P.rx, rz: P.rz, rot: P.rot }, X, Z) + 0.1 * noise2(X / 9, Z / 9, 84);
// the creek's water falls evenly from the cascade's foot to the hollow pond; the back channel's follows the floor
// down from the river into the trough, falling only
const CRK = (() => { const L = lengthOf(CREEK.pts); return { L, lv: s => lerp(CREEK.from, CREEK.to, clamp(s / L, 0, 1)) }; })();
const BCK = (() => { const L = lengthOf(BACKCH.pts), out = []; let lo = Infinity; for (let s = 0; s <= L + 2; s += 2) { const [x, z] = at(BACKCH.pts, Math.min(s, L)); lo = Math.min(lo, floorAt(x, z) - 0.5); out.push(lo); }
  return { L, end: lo, lv: s => out[Math.min(out.length - 1, Math.max(0, Math.round(s / 2)))] }; })();
const bluffE = (X, Z) => seDist({ x: BLUFF.c[0], z: BLUFF.c[1], rx: BLUFF.rx, rz: BLUFF.rz, rot: BLUFF.rot, p: 2.6 }, X, Z) + 0.16 * noise2(X / 24, Z / 24, BLUFF.seed) + 0.05 * noise2(X / 7, Z / 7, BLUFF.seed + 1);

// other table mountains standing beyond the rim, higher and further off: the far skyline
export const FAR = [[-2900, -4200, 1100, 1220], [3300, -3100, 900, 1150], [-3600, 1500, 1000, 1180], [2600, 2600, 800, 1060], [400, -5600, 1300, 1260]];
const farY = (X, Z) => { let y = -Infinity; for (const [x, z, r, top] of FAR) { const e = Math.hypot(X - x, Z - z) / r + 0.08 * noise1(Math.atan2(Z - z, X - x) * 5, x); if (e < 1.15) y = Math.max(y, top - 700 * smooth((e - 0.9) / 0.25)); } return y; };
export function V(X, Z, raw = false) {
  const { th, r } = polar(X, Z), fr = footR(th), d = r - fr;
  if (d > 600) { const top = topY(th) + 20 * noise2(X / 500, Z / 500, 9) * smooth((d - 600) / 400) - 0.03 * (d - 600); return Math.max(top, farY(X, Z)); }
  let y = floorAt(X, Z);
  // the ledge and its ramp
  const lf = ledgeF(X, Z);
  if (lf.s > -100 && lf.s < lf.len + 60 && X > 600) {
    const up = 1 - smooth((lf.e + 2) / 12), ends = smooth((lf.s + 40) / 60) * (1 - smooth((lf.s - lf.len + 10) / 40));
    y = lerp(y, LEDGE.y + 0.6 * noise2(X / 30, Z / 30, 35), up * ends);
  }
  { const R = LEDGE.ramp, pr = project([R.a, R.b], X, Z), l = Math.hypot(R.b[0] - R.a[0], R.b[1] - R.a[1]);
    // its edges wander: bays and spurs of fallen rock, the half-width 40-62 m
    const hw = R.w * (0.5 + 0.1 * noise1(pr.s / 45, 37) + 0.05 * noise1(pr.s / 14, 38)) * (1 + 0.5 * smooth((60 - pr.s) / 60)), sgn = pr.off < 0 ? 0 : 3;
    const edge = hw + 6 * noise1(pr.s / 21, 39 + sgn);
    if (pr.d < edge + 60 && pr.s > -30 && pr.s < l) { const t = Math.max(0, pr.s) / l, ry = lerp(LEDGE.y, floorAt(...R.b), smooth(t * 1.08 - 0.04)), w = 1 - smooth((pr.d - edge) / (26 + 16 * noise1(pr.s / 30, 40))); y = Math.max(y, lerp(y, ry, w)); } }
  // the walls
  if (d > -5) y += wallLift(d, th, topY(th));
  // the river: banks 1.5-2 m above the water; through the sill the gorge's walls stand sheer
  const rp = riverAt(X, Z);
  if (rp.d < rp.hw + 40 && rp.s > 0) {
    const bank = rp.level + 1.6, inG = rp.i > GORGE.from && rp.i < GORGE.to;
    const e = Math.abs(rp.off) - rp.hw;
    if (inG) { const k = 1 - smooth((e - 0.5) / 2.2); y = lerp(y, rp.level - 0.6, k); }
    else {
      const k = 1 - smooth((e - 2) / 22);
      const inner = rp.d < rp.hw ? (braidWet(rp) ? rp.level - 0.7 : rp.level + 0.35 + 0.3 * noise2(X / 12, Z / 12, 75)) : bank;
      y = lerp(y, Math.min(y, rp.d < rp.hw ? inner : bank + Math.max(0, e - 2) * 0.12), k);
    }
  }
  // the plunge pool, in a rock basin at the falls' foot, the 5th's shelf of rock standing out into it
  const pe = poolE(X, Z);
  if (pe < 1.6) y = lerp(y, POOL.level - 1.5, 1 - smooth((pe - 0.9) / 0.5));
  { const si = shelfIn(X, Z); if (si > -6 && pe < 1.8) y = lerp(y, SHELF.y + 0.3 * noise2(X / 9, Z / 9, 85), smooth((si + 6) / 6)); }
  // the creek's shallow valley, 60-80 m across, its banks about 1.3 m over the water
  { const cp = project(CREEK.pts, X, Z); if (cp.d < 60 && cp.s > 1) { const bank = CRK.lv(cp.s) + 1.3 + cp.d * 0.035; y = lerp(y, Math.min(y, bank), 1 - smooth((cp.d - 8) / 40)); } }
  // the swamp sits in a shallow basin; the tar pit in its hollow
  const sd = swampD(X, Z);
  if (sd < 20) y = lerp(y, SWAMP.level + 0.5 + 0.4 * noise2(X / 8, Z / 8, 44), 1 - smooth((sd + 4) / 24));
  const te = tarE(X, Z);
  if (te < 1.5) y = lerp(y, TAR.level - 0.5, 1 - smooth((te - 0.85) / 0.6));
  return raw ? y : cutAt(X, Z, y + standAt(X, Z));
}
// what stands up off the ground in the middle of the play: the Bone Bluff (sheer sandstone sides, a broken top,
// a skirt of fallen blocks). The holes' lines run under it (scene.mjs adds it back after the line's profile)
export function standAt(X, Z) {
  const be = bluffE(X, Z);
  if (be >= 1.25) return 0;
  return BLUFF.h * (1 - smooth((be - 0.88) / 0.24)) * (1 + 0.1 * noise2(X / 13, Z / 13, 62)) + 3 * (1 - smooth((be - 1.0) / 0.25)) * smooth((be - 0.85) / 0.15);
}
// the narrow water cut into any ground: the creek's channel, the back channel and their ponds, the 8th's pools.
// The holes' lines run over them (scene.mjs samples V raw under a line, then cuts)
export function cutAt(X, Z, y) {
  // Nest Falls' pool on the ledge and the stream from it across the ledge to the bluff's lip
  { const cp = CAMP_FALLS.pool, e = seDist({ x: cp.c[0], z: cp.c[1], rx: cp.rx, rz: cp.rz, rot: cp.rot }, X, Z); if (e < 1.6) y = lerp(y, Math.min(y, cp.level - 1.2), 1 - smooth((e - 0.9) / 0.5)); }
  { const sp = project(CAMP_FALLS.stream, X, Z); if (sp.d < 8 && sp.s > 0) y = lerp(y, Math.min(y, CAMP_FALLS.pool.level - 0.9), 1 - smooth((sp.d - 1.6) / 3)); }
  // the creek: a channel about 6 m across, 1.5 m below its banks
  { const cp = project(CREEK.pts, X, Z); if (cp.d < 14 && cp.s > 1) { const lv = CRK.lv(cp.s), bed = lv - 0.5; y = lerp(y, Math.min(y, bed), 1 - smooth((cp.d - CREEK.w + 1) / 10)); } }
  // the back channel across the 4th: water between low gravel banks, and its oxbow pond
  { const bp = project(BACKCH.pts, X, Z); if (bp.d < 30 && bp.s > 0) { const bank = BCK.lv(bp.s) + 0.9; y = lerp(y, Math.min(y, bp.d < BACKCH.w ? BCK.lv(bp.s) - 0.6 : bank + (bp.d - BACKCH.w) * 0.08), 1 - smooth((bp.d - BACKCH.w - 4) / 18)); } }
  { const e = pondE(BACKCH.pond, X, Z); if (e < 1.6) y = lerp(y, BCK.end - 0.8, 1 - smooth((e - 0.9) / 0.6)); }
  // the 5th's two pools, in shallow hollows
  { const e = p8E(X, Z); if (e < 1.6) y = lerp(y, SWAMP.level - 0.5, 1 - smooth((e - 0.9) / 0.6)); }
  return y;
}

// water and tar: where it lies and its level (null if none)
export function waterAt(X, Z) {
  if (poolE(X, Z) < 1 && shelfIn(X, Z) < 0) return { level: POOL.level, body: 'pool' };
  if (tarE(X, Z) < 1) return { level: TAR.level, body: 'tar' };
  const cp = CAMP_FALLS.pool; if (seDist({ x: cp.c[0], z: cp.c[1], rx: cp.rx, rz: cp.rz, rot: cp.rot }, X, Z) < 1) return { level: cp.level, body: 'campPool' };
  { const sp = project(CAMP_FALLS.stream, X, Z); if (sp.d < 1.8 && sp.s > 0 && sp.s < lengthOf(CAMP_FALLS.stream) - 0.5) return { level: CAMP_FALLS.pool.level - 0.3, body: 'stream' }; }
  const rp = riverAt(X, Z);
  if (rp.s > 0.5 && rp.d < rp.hw && braidWet(rp)) return { level: rp.level, body: 'river' };
  if (swampWet(X, Z)) return { level: SWAMP.level, body: 'swamp' };
  if (p8E(X, Z) < 1) return { level: SWAMP.level, body: 'swamp' };
  if (pondE(BACKCH.pond, X, Z) < 1) return { level: BCK.end, body: 'pond' };
  { const cp = project(CREEK.pts, X, Z); if (cp.d < CREEK.w * (1 + 0.2 * noise1(cp.s / 17, 91)) && cp.s > 1 && cp.s < CRK.L - 1) return { level: CRK.lv(cp.s), body: 'creek' }; }
  { const bp = project(BACKCH.pts, X, Z); if (bp.d < BACKCH.w * (1 + 0.25 * noise1(bp.s / 15, 92)) && bp.s > 0.5 && bp.s < BCK.L - 0.5) return { level: BCK.lv(bp.s), body: 'channel' }; }
  return null;
}
export const inValley = (X, Z) => { const { th, r } = polar(X, Z); return r < footR(th); };
export const wallD = (X, Z) => { const { th, r } = polar(X, Z); return r - footR(th); };
export const bluffD = bluffE;
export { riverAt, braidWet };

// what the native ground is away from the play: jungle on the talus and the ledges of the walls, bare rock on the
// faces, fern and horsetail meadow on the open floor, gravel bars in the river
export function nativeAt(X, Z) {
  const d = wallD(X, Z);
  if (d > 0 && d < 70) return 'jungle';
  if (d >= 70) return 'cliff';
  if (bluffE(X, Z) < 1.02) return 'cliff';
  const rp = riverAt(X, Z);
  if (rp.s > 0 && rp.d < rp.hw) return 'gravel';
  if (swampD(X, Z) < 0) return 'mud';
  return 'meadow';
}
