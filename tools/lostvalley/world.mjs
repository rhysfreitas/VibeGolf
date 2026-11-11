// The Lost Valley, in world space (metres; x east, -z north, y above the sea). Pure, no DOM.
// A hidden valley walled in by the sheer sides of a table mountain (a tepui): V(X, Z) is the ground without the
// holes. The floor is a gentle basin shaped by control heights (an RBF, as Emberfell's shoulder), with the
// valley walls rising round it: a jungle talus, then a sheer cliff 380-470 m to the flat top. On the south wall a
// ledge 30 m up holds the expedition camp (the 1st tee and the 9th green), with Camp Falls pouring onto it and a
// broad ramp down its east end. The river starts in the plunge pool under the Great Falls on the north-east
// wall (the 5th), cuts a short gorge through a rock sill (the rope bridge), braids south down the east side,
// bends west round the Bone Bluff (the 7th) and ends in the swamp (the 8th), which drains away underground. The
// tar pit (the 3rd) is a seep on the west side. Each hole's ground follows V away from its line (scene.mjs).
import { clamp, smooth, lerp, distLine, project, seDist, at, lengthOf } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

const D2R = Math.PI / 180;
export const VALLEY = { c: [150, -800], rx: 910, rzN: 870, rzS: 985, floor: 400 };

// ---- the walls: the foot's radius from the centre wanders in bays and buttresses at three scales; the Great
// Falls pour down the back of a bay in the north-east wall, the camp sits under the south wall
export function polar(X, Z) {
  const dx = X - VALLEY.c[0], dz = Z - VALLEY.c[1];
  return { th: (Math.atan2(dx, -dz) / D2R + 360) % 360, r: Math.hypot(dx, dz) };
}
const angDiff = (a, b) => ((a - b) % 360 + 540) % 360 - 180;
const bell = (th, c, w) => Math.exp(-((angDiff(th, c) / w) ** 2));
const ell = th => { const a = th * D2R; return 1 / Math.hypot(Math.sin(a) / VALLEY.rx, Math.cos(a) / (Math.cos(a) > 0 ? VALLEY.rzN : VALLEY.rzS)); };
// the bay of the Great Falls (north-east) and a few more bays the smaller falls come down
export const BAYS = [{ th: 24, w: 4, out: 70 }, { th: 300, w: 4, out: 70 }, { th: 248, w: 3.5, out: 50 }, { th: 112, w: 4, out: 60 }, { th: 335, w: 3, out: 45 }];
export function footR(th) {
  let r = ell(th) + 55 * noise1(th / 13, 3) + 22 * noise1(th / 4.5, 4) + 7 * noise1(th / 1.4, 5);
  for (const b of BAYS) r += b.out * bell(th, b.th, b.w);
  // the south wall behind the camp runs fairly straight, so the ledge has a back wall
  r -= 35 * bell(th, 180, 14);
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
  // the bluff's foot under the camp
  [-90, -90, 403], [120, -110, 402], [330, -130, 401],
  // the 1st's landing and green; the 2nd falls 8 m to the grove's hollow; the 3rd climbs past the tar pit
  [-30, -235, 402], [80, -305, 403], [110, -350, 403], [70, -578, 398], [-33, -665, 395], [60, -715, 395.5], [196, -703, 401],
  // the 4th: down to the shallows on the second leg, up the gravel terrace to the green
  [220, -760, 401], [238, -964, 400], [328, -1103, 397.5], [345, -1185, 401], [364, -1240, 405],
  // the sill across the head of the valley: the 5th tee on its west part, the 6th tee on its east part
  [395, -1330, 417.5], [425, -1420, 413], [429, -1524, 407.8], [400, -1580, 409], [470, -1500, 409], [600, -1470, 414], [660, -1500, 414],
  // the Strangler's knoll (6), the crest on the 7th, then down to the river's bend
  [575, -1345, 419], [590, -1210, 424], [620, -1170, 423], [618, -1020, 426], [612, -940, 419], [540, -830, 404],
  // the swamp's east side (8), the ramp's foot (9)
  [480, -720, 402], [500, -560, 399.5], [490, -410, 399], [623, -260, 398.5], [680, -170, 400],
  // between the 4th and the sill, so the floor doesn't swell where nothing holds it
  [200, -1150, 402], [240, -1300, 404], [120, -1050, 401], [290, -1420, 407], [100, -1250, 403], [60, -920, 400],
  // away from the holes: the west plain, the north-west meadows, the east meadows
  [-450, -500, 402], [-430, -1100, 405], [-80, -1300, 404], [150, -1550, 408], [900, -700, 405], [880, -1250, 408], [820, -400, 403],
];
const SIG = 150, phi = d2 => Math.exp(-d2 / (2 * SIG * SIG)), REG = 402;
const RBFW = (() => {
  const n = CTRL.length, M = CTRL.map((a, i) => [...CTRL.map(b => phi((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) + (a === b ? 1e-6 : 0)), a[2] - REG]);
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

// ---- the camp's ledge: a shelf 30 m up under the south wall. Its front, the bluff, wanders in bays and prows;
// at its east end a broad ramp runs down to the floor (the 9th climbs it). Camp Falls lands in a pool on it
export const LEDGE = { y: 430, pts: [[-300, 20], [-150, -14], [0, -40], [150, -30], [260, -22], [318, -12]], back: 190, ramp: { a: [330, 12], b: [690, -175], w: 104 } };
const ledgeF = (X, Z) => {   // metres north of the bluff's lip (+ = out over the floor), and where along it
  const pr = project(LEDGE.pts, X, Z), e = pr.off * -1;   // the line runs west to east, so its left (north) is -off
  const crag = 15 * noise1(pr.s / 55, 31) + 7 * noise1(pr.s / 17, 32) + 2.5 * noise1(pr.s / 5, 33);
  return { e: -pr.off - crag, s: pr.s, len: lengthOf(LEDGE.pts) };
};
export const CAMP_FALLS = { lip: [205, 215], pool: { c: [200, 92], rx: 30, rz: 20, rot: 0.2, level: 431 }, cascade: [[196, 66], [190, -24]], stream: [[190, -36], [214, -100], [250, -160], [282, -220], [300, -262]] };

// ---- the river: [x, z, half-width, water level]; it starts in the plunge pool, runs through the gorge in the
// sill, braids south, bends west round the Bone Bluff and spreads into the swamp
export const POOL = { c: [484, -1570], rx: 56, rz: 40, rot: 0.3, level: 406 };
export const GREAT_FALLS = { lip: [560, -1790], foot: [520, -1625], w: 44 };
export const RIVER = { pts: [
  [486, -1556, 8, 405.6], [482, -1505, 8, 404.6], [476, -1455, 9, 403.8], [468, -1395, 24, 403.2], [462, -1320, 38, 402.6],
  [458, -1240, 44, 402.0], [450, -1160, 42, 401.4], [444, -1080, 34, 400.8], [470, -1000, 22, 400.3], [536, -952, 18, 399.9],
  [520, -890, 17, 399.5], [470, -838, 18, 399.1], [430, -778, 20, 398.7], [400, -715, 24, 398.3]] };
// the gorge: where the river cuts through the sill, its walls stand sheer
export const GORGE = { from: 0.2, to: 2.6 };   // between these river points (by index, fractional)
export const BRIDGE = { a: [450, -1478], b: [512, -1468] };   // the rope bridge across the gorge, rim to rim
// the swamp: still water in pools between tall trees, about 1 m below the land round it; the fairway on the 8th
// weaves between the pools
export const SWAMP = { level: 397.4, blobs: [[372, -668, 52], [392, -598, 60], [342, -560, 62], [398, -520, 46], [378, -468, 60], [336, -436, 50], [296, -520, 58], [436, -506, 24]], seed: 41 };
// the tar pit: a black seep in a hollow on the 3rd, a little below the ground round it
export const TAR = { c: [140, -698], rx: 30, rz: 19, rot: 0.15, level: 394.8, seed: 51 };
// the Bone Bluff: a sandstone outcrop on the 7th's left, 34 m high, a long-neck's skeleton half out of its face
export const BLUFF = { c: [735, -1010], rx: 62, rz: 46, rot: -1.2, h: 34, seed: 61 };

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
const tarE = (X, Z) => seDist({ x: TAR.c[0], z: TAR.c[1], rx: TAR.rx, rz: TAR.rz, rot: TAR.rot }, X, Z) + 0.12 * noise2(X / 11, Z / 11, TAR.seed);
const bluffE = (X, Z) => seDist({ x: BLUFF.c[0], z: BLUFF.c[1], rx: BLUFF.rx, rz: BLUFF.rz, rot: BLUFF.rot, p: 2.6 }, X, Z) + 0.16 * noise2(X / 24, Z / 24, BLUFF.seed) + 0.05 * noise2(X / 7, Z / 7, BLUFF.seed + 1);

// other table mountains standing beyond the rim, higher and further off: the far skyline
export const FAR = [[-2900, -4200, 1100, 1220], [3300, -3100, 900, 1150], [-3600, 1500, 1000, 1180], [2600, 2600, 800, 1060], [400, -5600, 1300, 1260]];
const farY = (X, Z) => { let y = -Infinity; for (const [x, z, r, top] of FAR) { const e = Math.hypot(X - x, Z - z) / r + 0.08 * noise1(Math.atan2(Z - z, X - x) * 5, x); if (e < 1.15) y = Math.max(y, top - 700 * smooth((e - 0.9) / 0.25)); } return y; };
export function V(X, Z) {
  const { th, r } = polar(X, Z), fr = footR(th), d = r - fr;
  if (d > 600) { const top = topY(th) + 20 * noise2(X / 500, Z / 500, 9) * smooth((d - 600) / 400) - 0.03 * (d - 600); return Math.max(top, farY(X, Z)); }
  let y = floorAt(X, Z);
  // the camp's ledge and its ramp
  const lf = ledgeF(X, Z);
  if (lf.s > -1 && lf.s < lf.len + 1 && Z > -120) {
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
  // the Bone Bluff: sheer sandstone sides, a broken top
  const be = bluffE(X, Z);
  if (be < 1.25) y += BLUFF.h * (1 - smooth((be - 0.88) / 0.24)) * (1 + 0.1 * noise2(X / 13, Z / 13, 62)) + 6 * (1 - smooth((be - 1.0) / 0.25)) * smooth((be - 0.85) / 0.15);
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
  // the plunge pool, in a rock basin at the falls' foot
  const pe = seDist({ x: POOL.c[0], z: POOL.c[1], rx: POOL.rx, rz: POOL.rz, rot: POOL.rot }, X, Z) + 0.1 * noise2(X / 14, Z / 14, 81);
  if (pe < 1.6) y = lerp(y, POOL.level - 1.5, 1 - smooth((pe - 0.9) / 0.5));
  // the swamp sits in a shallow basin; the tar pit in its hollow
  const sd = swampD(X, Z);
  if (sd < 20) y = lerp(y, SWAMP.level + 0.5 + 0.4 * noise2(X / 8, Z / 8, 44), 1 - smooth((sd + 4) / 24));
  const te = tarE(X, Z);
  if (te < 1.5) y = lerp(y, TAR.level - 0.5, 1 - smooth((te - 0.85) / 0.6));
  return y;
}

// water and tar: where it lies and its level (null if none)
export function waterAt(X, Z) {
  if (seDist({ x: POOL.c[0], z: POOL.c[1], rx: POOL.rx, rz: POOL.rz, rot: POOL.rot }, X, Z) + 0.1 * noise2(X / 14, Z / 14, 81) < 1) return { level: POOL.level, body: 'pool' };
  if (tarE(X, Z) < 1) return { level: TAR.level, body: 'tar' };
  const cp = CAMP_FALLS.pool; if (seDist({ x: cp.c[0], z: cp.c[1], rx: cp.rx, rz: cp.rz, rot: cp.rot }, X, Z) < 1) return { level: cp.level, body: 'campPool' };
  const rp = riverAt(X, Z);
  if (rp.s > 0.5 && rp.d < rp.hw && braidWet(rp)) return { level: rp.level, body: 'river' };
  if (swampWet(X, Z)) return { level: SWAMP.level, body: 'swamp' };
  // Camp Falls' stream: a narrow channel from the cascade's foot into the swamp
  const sp = project(CAMP_FALLS.stream, X, Z);
  if (sp.d < 3.2 + 2 * noise1(sp.s / 30, 91) && sp.s > 2 && sp.s < lengthOf(CAMP_FALLS.stream) - 2) return { level: V(X, Z) + 0.3, body: 'stream' };
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
