// Cloudrest, in world space (metres; x east, -z north, y up). Pure, no DOM.
// A misty green gorge running north-south: the western cliff where the round starts (shelves 1, 2 and 4's tee, the
// hanging valley of the 3rd cut back into it), the eastern cliff with the monastery in its face (the 6th climbs it,
// the 7th runs under a vast overhang, the 8th is a high valley of tea terraces behind, the 9th steps down to the
// monastery's courtyard). Between them, open air down to the mist (150 m): stone pinnacles stand out of it, one of
// them the Needle (the 4th green), and the Broken Ridge (the 5th) crosses it on a crest of joined pinnacles.
// Points below are written [x east, n north] as in claude/cloudrest-layout.md and turned to [X, Z = -n] by `w`.
//
// The course's logic (Rhys's picks, 15 November 2026): the wall gives and the mist takes. A ball into a cliff face
// drops at its foot 45% of the time (COURSE.wallSoak), otherwise it comes back; only a shelf's outer edge is penalty
// ground, behind a kerb of rock and pines that stops a ball that only runs. The air is thin (8,500 ft).
//
// V(X, Z) is the ground without the holes and without the walls and kerbs (liftAt adds those after the holes' grounds
// are blended, so a wall stays sheer); null over open air (the gorge, the cleft, below the mist).
import { clamp, smooth, lerp, project, seDist, lengthOf, at, inPoly } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

export const w = p => [p[0], -p[1]];
const W = P => P.map(w);
export const MIST = 150;   // the top of the mist; open air below it

// ---- the playing lines from the layout doc (tee, corners, pin), approved 15 November 2026
export const LINES = [
  [[-560, 760], [-470, 560], [-500, 379]],
  [[-470, 320], [-329, 235]],
  [[-330, 170], [-460, -80], [-332, -365]],
  [[-290, -420], [-158, -471]],
  [[-110, -480], [120, -430], [316, -308]],
  [[380, -250], [360, 0], [461, 280]],
  [[480, 300], [682, 340]],
  [[720, 400], [700, 660], [483, 778]],
  [[480, 840], [390, 740], [470, 650], [408, 588]],
];
export const WLINES = LINES.map(W);
export const lineD = (X, Z) => { let d = Infinity; for (const L of WLINES) d = Math.min(d, project(L, X, Z).d); return d; };
// a point s metres along hole k's line, off metres to the right of travel (world [X, Z])
export const onLine = (k, s, off = 0) => at(WLINES[k], s, off);

// ---- the gorge: everything east of the western edge and west of the eastern edge is open air, but for the ridge
// and the pinnacles. Each edge is a list of [x, n] from north to south; a kerb of rock and pines runs along it.
export const WEST_EDGE = [[-520, 1150], [-508, 900], [-516, 780], [-482, 690], [-443, 600], [-430, 520], [-443, 440], [-452, 385], [-425, 350], [-372, 312],
  [-340, 286], [-312, 262], [-296, 232], [-284, 180], [-262, 100], [-252, 0], [-286, -110], [-318, -200], [-292, -300], [-246, -380], [-244, -412], [-238, -446], [-210, -520],
  [-160, -660], [-130, -950]];
export const EAST_EDGE = [[350, 1150], [348, 950], [318, 820], [305, 700], [292, 600], [300, 520], [345, 420], [380, 320], [372, 220], [345, 120], [318, 0],
  [312, -120], [300, -240], [292, -300], [285, -360], [230, -520], [150, -760], [120, -950]];
const edgeX = (E, n) => { if (n >= E[0][1]) return E[0][0]; for (let i = 0; i < E.length - 1; i++) if (n >= E[i + 1][1]) return lerp(E[i + 1][0], E[i][0], (n - E[i + 1][1]) / (E[i][1] - E[i + 1][1])); return E.at(-1)[0]; };
const WEW = W(WEST_EDGE), EEW = W(EAST_EDGE);
export const inGorge = (X, Z) => { const n = -Z; return X > edgeX(WEST_EDGE, n) && X < edgeX(EAST_EDGE, n); };

// the cleft on the 2nd: cut back into the western cliff from the gorge, across the line from tee to green (88 m
// of it at the line), its head 70 m right of the line with a thread of waterfall; the tee balcony on its far side,
// the green balcony on its near side, a forward balcony beyond its head with half the carry
const L2 = LINES[1], d2 = Math.hypot(L2[1][0] - L2[0][0], L2[1][1] - L2[0][1]), f2 = [(L2[1][0] - L2[0][0]) / d2, (L2[1][1] - L2[0][1]) / d2], l2 = [-f2[1], f2[0]];   // left of travel (to the gorge)
const P2 = (s, o) => [L2[0][0] + f2[0] * s + l2[0] * o, L2[0][1] + f2[1] * s + l2[1] * o];
export const CLEFT = [P2(18, 110), P2(132, 110), P2(118, 0), P2(98, -58), P2(84, -70), P2(64, -70), P2(52, -58), P2(30, 0)];
export const CLEFT_HEAD = P2(74, -72);
const CLEFTW = W(CLEFT);
export const inCleft = (X, Z) => inPoly(CLEFTW, X, Z);

// ---- the pinnacles: stone pillars hung with pines standing out of the mist [x, n, r, top]. The Needle carries the
// 4th green (a lone pillar 190 m up, a rim of rock round its back half); the rest are scenery, 45 m or more off
// every line (sample.mjs checks)
export const NEEDLE = { c: [-158, -471], r: 22, top: 190, rim: 1.6 };
export const PINNACLES = [
  [-360, 640, 26, 236], [-330, 470, 20, 214], [-180, 330, 28, 258], [-140, 150, 34, 285], [-190, -40, 24, 218], [-40, -250, 30, 246], [40, -290, 18, 202],
  [180, -580, 28, 232], [20, -640, 34, 262], [90, 70, 42, 300], [210, 300, 30, 262], [150, 560, 36, 292], [0, 820, 44, 305], [-250, 860, 28, 242], [240, 760, 24, 222],
  [80, -120, 26, 228], [230, -150, 22, 212], [-60, 480, 30, 270], [70, 360, 22, 236], [-90, 640, 26, 250], [200, 980, 34, 280], [-300, 1000, 30, 258],
  [-200, -620, 22, 214], [120, -760, 30, 240], [260, 40, 20, 208],
];
function pillar(X, Z, x, n, r, top, seed) {
  const dx = X - x, dz = Z + n, d = Math.hypot(dx, dz); if (d > r * 1.6 + 12) return null;
  const a = Math.atan2(dz, dx), rr = r * (1 + 0.16 * noise1(a * 2.2 + seed, seed) + 0.07 * noise1(a * 7 + seed * 3, seed + 1));
  if (d > rr + 1.5) return null;
  const crown = 3.5 * (1 - (d / rr) ** 2) + 1.2 * noise2(X / 9, Z / 9, seed);   // a rounded, broken top
  const y = top + crown - (d > rr ? (d - rr) * 30 : 0);
  return y < MIST ? null : y;
}
export function needleAt(X, Z) {
  const [x, n] = NEEDLE.c, dx = X - x, dz = Z + n, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
  const rr = NEEDLE.r * (1 + 0.06 * noise1(a * 3, 31)); if (d > rr + 1.5) return null;
  // the top levelled for the green; the rim of rock round its back half (away from the tee, to the east-south-east)
  const back = Math.cos(a - Math.atan2(51, 132));   // +1 straight on from the tee
  const rim = d > rr - 4.5 && back > -0.05 ? NEEDLE.rim * smooth((d - rr + 4.5) / 2) * smooth((back + 0.05) / 0.3) : 0;
  return NEEDLE.top + rim - (d > rr ? (d - rr) * 30 : 0);
}
export function pinnacleAt(X, Z) {
  const nd = needleAt(X, Z); if (nd !== null) return nd;
  let best = null;
  for (const [i, p] of PINNACLES.entries()) { const y = pillar(X, Z, p[0], p[1], p[2], p[3], 40 + i); if (y !== null && (best === null || y > best)) best = y; }
  return best;
}

// ---- the Broken Ridge (the 5th): a crest of joined pinnacles across the gorge, from beside the Needle to the
// eastern cliff's foot. Along it: a crowned spine about 40 m across (only the spine holds); a catch shelf 8 m down
// its north side (real ground, a shot back up); its south side a steep flank to a kerb, then the mist. A notch cuts
// it 251-265 m from the 5th's back tee: a V of rock 10 m deep.
export const RIDGE = W([[-140, -486], [-110, -480], [120, -430], [316, -308], [345, -290]]);
const RIDGE_S0 = Math.hypot(30, 6);   // the 5th's back tee sits this far along it
export const NOTCH = { s0: 251, s1: 265, depth: 10, scree: 34 };
const ridgeCrest = s => { const t = s - RIDGE_S0; return 190 + 4 * smooth(t / 470) + 0.8 * noise1(t / 37, 51); };
export function ridgeAt(X, Z) {   // { y, part: 'spine'|'flank'|'shelf'|'kerb'|'notch' } or null
  const pr = project(RIDGE, X, Z), len = lengthOf(RIDGE); if (pr.s < 0.5 || pr.s > len - 0.5 || pr.d > 75) return null;
  const t = pr.s - RIDGE_S0, off = pr.off, c = ridgeCrest(pr.s);
  const half = 22 + 2.5 * noise1(t / 41, 52);                                  // the spine's half width
  const sh0 = 30 + 3 * noise1(t / 33, 53), sh1 = 58 + 5 * noise1(t / 47, 54);   // the catch shelf (north, off < 0)
  const so = 36 + 3 * noise1(t / 29, 55);                                      // the south flank's lip
  const endN = smooth((t + 26) / 12) * (1 - smooth((t - 470) / 14));            // the shelf runs only along the play
  let y, part;
  const a = Math.abs(off);
  if (a <= half) { y = c - 0.0026 * off * off; part = 'spine'; }
  else if (off > 0) {   // south: a steep flank to the lip, a kerb on it, then the mist
    if (off > so + 3) return null;
    const ft = (off - half) / (so - half); y = c - 0.0026 * half * half - 15 * Math.pow(clamp(ft, 0, 1), 1.4); part = 'flank';
    if (off > so) { y += 1.7 * Math.sin(Math.PI * clamp((off - so) / 3, 0, 1)); part = 'kerb'; }
  } else {               // north: a flank down to the catch shelf, then a kerb and the mist
    const yTop = c - 0.0026 * half * half, ySh = c - 8 - 0.04 * (a - sh0);
    if (a > sh1 * endN + (1 - endN) * (half + 8) + 3) return null;
    if (a < sh0) { y = lerp(yTop, c - 8, smooth((a - half) / (sh0 - half))); part = 'flank'; }
    else { y = ySh; part = 'shelf'; }
    const lip = endN > 0.5 ? sh1 : half + 8;
    if (a > lip) { y += 1.7 * Math.sin(Math.PI * clamp((a - lip) / 3, 0, 1)); part = 'kerb'; }
  }
  // the notch: a V of rock across the whole ridge
  const nm = (NOTCH.s0 + NOTCH.s1) / 2 + RIDGE_S0, nw = (NOTCH.s1 - NOTCH.s0) / 2 + 6;
  // its near face steep, its far side a slope of scree about 30% that a ball in it can play up (round 1: from a sheer
  // far face the gate's player was stuck in the notch)
  const dn = pr.s - nm;
  if (dn < 0 && -dn < nw) { const k = 1 + dn / nw; y -= NOTCH.depth * smooth(k * 1.4); if (k > 0.25) part = 'notch'; }
  else if (dn >= 0 && dn < NOTCH.scree) { const k = 1 - dn / NOTCH.scree, d = NOTCH.depth * (dn < nw * 0.3 ? 1 : smooth(k * 1.15)); y -= d; if (d > 2.5) part = 'notch'; }
  // pinnacles joined along it: knobs of rock beyond the play, on the flanks
  return { y, part, off, s: t };
}

// ---- the massif: a smooth surface through control heights (Gaussian RBFs, as the other plan tools), the holes'
// heights from the layout doc along their lines, the uplands behind the walls, the hanging valley's sides
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
// heights along each line (absolute, from the layout doc: 1st 260 -> 248; 2nd 244 -> 240; 3rd 236 -> 211; 4th tee 208;
// 6th 194 -> 229; 7th 231 -> 237; 8th 250 -> 262; 9th 262 -> 217 in three tiers)
const along = (k, pts) => pts.map(([s, y, off = 0]) => { const p = at(LINES[k].map(q => [q[0], q[1]]), s, -off); return [p[0], p[1], y]; });   // [x, n] frame: off + = right of travel
export const FLOOR = [
  // the 1st: down a broad shelf on the western cliff, the ground running away into the green
  ...along(0, [[-60, 261], [0, 260], [80, 258.5], [160, 256.5], [240, 254.5], [300, 253], [350, 250.5], [403, 248], [440, 247]]),
  ...along(0, [[0, 262, 30], [200, 257, 30], [380, 250, 30], [0, 259, -30], [200, 254, -30], [380, 247, -30]]),
  // the 2nd: balcony to balcony
  ...along(1, [[-30, 245], [0, 244], [20, 243.5], [150, 240.5], [165, 240], [185, 239.5]]),
  // the 3rd: the hanging valley, its floor along the line, its sides rising
  ...along(2, [[-20, 236.5], [0, 236], [100, 234], [200, 231], [282, 228], [380, 223], [480, 216], [560, 212], [594, 211], [620, 210.5]]),
  ...along(2, [[60, 246, 70], [200, 242, 75], [330, 238, 80], [460, 230, 75], [570, 224, 60], [60, 246, -70], [200, 242, -75], [330, 237, -80], [460, 229, -75], [570, 222, -60]]),
  ...along(2, [[150, 262, 140], [350, 256, 150], [500, 246, 130], [150, 250, -140], [330, 247, -135]]),
  // the 4th's tee on the valley's lip
  [-290, -420, 208], [-275, -435, 207], [-305, -400, 209],
  // the eastern cliff's foot (the 5th green) and the 6th: a lower shelf, the face, the upper shelf climbing to the stupa
  [316, -308, 194], [300, -330, 193.5], [330, -290, 194],
  ...along(5, [[-40, 194], [0, 194], [120, 194.5], [245, 195.5], [300, 198], [360, 203], [420, 213], [500, 222], [548, 229], [575, 230]]),   // the face (9 m, a step that blends back by 420 m) is the hole's prof
  // the 7th under the overhang
  ...along(6, [[-15, 229], [0, 229], [100, 231], [170, 232.5], [206, 235], [225, 236]]),   // the green's shelf (3 m) is the hole's prof
  // the 8th: the tea terraces in a high valley behind the monastery
  ...along(7, [[-30, 249.5], [0, 250], [130, 252], [261, 255], [380, 258], [508, 262], [540, 263]]),
  // the 9th: its tee on the top terrace (the tiers themselves are tierAt)
  [480, 840, 262], [520, 860, 263], [440, 860, 262],
  // the western upland behind the 1st's wall, between and round the western holes
  [-640, 800, 300], [-620, 600, 304], [-610, 420, 300], [-560, 300, 286], [-520, 200, 270], [-560, 60, 268], [-560, -120, 262], [-520, -300, 250], [-440, -460, 236],
  [-360, -520, 222], [-320, -470, 212], [-700, 300, 300], [-720, -100, 285], [-470, 260, 252], [-420, 210, 250], [-380, -460, 216],
  // the eastern upland: above the 6th's wall, the rib over the alcove, round the 8th's valley and the 9th's slope
  [470, -330, 214], [480, -150, 222], [470, 50, 240], [560, -50, 252], [600, 150, 262], [560, 230, 250], [640, 240, 252], [740, 260, 258], [780, 360, 262],
  [600, 380, 262], [520, 390, 262], [800, 520, 266], [800, 700, 272], [620, 560, 258], [600, 860, 270], [380, 900, 266], [700, 860, 274], [560, 720, 258],
  [430, 470, 236], [360, 470, 226], [330, 560, 220], [880, 300, 280], [880, 600, 290],
];
const massifRaw = rbf(FLOOR, 62, 250);
export const roll = (X, Z) => 0.9 * noise2(X / 63, Z / 63, 61) + 0.35 * noise2(X / 23, Z / 23, 62);
export const massif = (X, Z) => massifRaw(X, -Z) + roll(X, Z);

// ---- the 9th's slope: three tiers stepping down the eastern cliff's face toward the monastery, 15 m each
// (262 -> 247 -> 232 -> 217), each a level band across the slope with a steep grass bank below it
export const DESCENT = { x0: 335, x1: 530, n0: 560, n1: 880, banks: [[700, 247, 232], [626, 232, 217]], bankW: 22 };
// the first bank's middle line ([x, n]); the high side (the tee, the 8th green) north-east of it. Plan book round 1:
// moved from n 772 to the tee's lip, since from 80 m back on a level tier nothing below the bank was in view
export const LIP1 = [[360, 884], [428, 873], [453, 840], [468, 826.6], [467.4, 811], [451, 785], [435, 766], [452, 749], [490, 744], [545, 752]];
const LIP1W = W(LIP1), LIP1S = -Math.sign(project(LIP1W, 480, -840).off);   // + on the low side
export function tierAt(X, Z) {   // { y, k (0 outside, 1 inside the zone) }
  const n = -Z, D = DESCENT;
  const k = smooth((X - D.x0) / 30) * (1 - smooth((X - D.x1) / 30)) * smooth((n - D.n0) / 25) * (1 - smooth((n - D.n1) / 25));
  if (k <= 0) return { y: 0, k: 0 };
  const wob = n + 6 * noise1(X / 47, 71) + 2 * noise1(X / 13, 72);   // the banks wander across the slope
  let y = 262 + 0.006 * (n - 772);
  { const pr = project(LIP1W, X, Z), dl = LIP1S * pr.off + 1.5 * noise1(pr.s / 41, 73); y = lerp(y, 247 + 0.008 * (dl - D.bankW / 2), smooth(dl / D.bankW + 0.5)); }
  for (const [nb, hi, lo] of D.banks) { const t = smooth((nb - wob) / D.bankW + 0.5); y = lerp(y, lo + 0.008 * (nb - D.bankW / 2 - n), t); }
  return { y, k };
}

// ---- the 9th's back tee: a granite knoll behind the top terrace, 8 m up. Rhys after his first round (16 November
// 2026): the Descent played too short (a tour 5 iron reached the green from the old Summit tee: 287 yd straight and
// 45 m down at 8,500 ft). The Summit tee moved 55 m back up the line onto the knoll's lip, the tips on its top: from
// level ground that far back the first tier would be out of sight, from 8 m up it is as in view as before.
export const KNOLL = { s0: -52, s1: -100, b: 17, top: 270.5, face: 7 };
const K9 = (() => { const [a, b] = LINES[8], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return { o: a, u: [(a[0] - b[0]) / l, (a[1] - b[1]) / l] }; })();
export function knollAt(X, Z) {   // the knoll's height, or null outside it
  const n = -Z, dx = X - K9.o[0], dn = n - K9.o[1], along = dx * K9.u[0] + dn * K9.u[1], across = -dx * K9.u[1] + dn * K9.u[0];
  const K = KNOLL, a0 = -K.s0, a1 = -K.s1, mid = (a0 + a1) / 2, ha = (a1 - a0) / 2;
  const ex = Math.abs(along - mid) - ha, ez = Math.abs(across) - K.b;
  const sd = Math.hypot(Math.max(ex, 0), Math.max(ez, 0)) + Math.min(Math.max(ex, ez), 0) + 1.6 * noise2(X / 11, Z / 11, 81);
  if (sd > K.face) return null;
  return { y: K.top + 0.25 * noise2(X / 17, Z / 17, 82), k: 1 - smooth(sd / K.face) };
}

// ---- the ground (without walls and kerbs): null over open air
export function V(X, Z) {
  if (inGorge(X, Z) || inCleft(X, Z)) {
    const r = ridgeAt(X, Z); if (r) return r.y;
    return pinnacleAt(X, Z);
  }
  let y = massif(X, Z);
  const t = tierAt(X, Z); if (t.k > 0) y = lerp(y, t.y, t.k);
  const kn = knollAt(X, Z); if (kn && kn.y > y) y = lerp(y, kn.y, kn.k);
  return y;
}
export const voidAt = (X, Z) => V(X, Z) === null;

// ---- walls: cliff faces rising from the shelves (the wall gives: a ball into one drops at its foot 45% of the
// time, otherwise it comes back). Each is a polyline in world space with the high side to its right, a height and a
// slope beyond its top. Built from the holes' lines (an offset polyline) or written out.
function offsetLine(k, s0, s1, off, step = 10) {
  // an offset polyline with its normal averaged over 45 m either side, so it never loops on the inside of a bend
  const L = WLINES[k], len = lengthOf(L), P = [];
  const ext = s => { if (s >= 0 && s <= len) return at(L, s); const a = s < 0 ? L[0] : L.at(-1), b = s < 0 ? L[1] : L.at(-2), l = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(a[0] - b[0]) / l, (a[1] - b[1]) / l], d = s < 0 ? -s : s - len; return [a[0] + u[0] * d, a[1] + u[1] * d]; };
  for (let s = s0; s <= s1 + 0.01; s += step) {
    let fx = 0, fz = 0, cx = 0, cz = 0, n = 0;
    for (let t = -45; t <= 45; t += 5) { const a = ext(s + t - 2), b = ext(s + t + 2), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; fx += (b[0] - a[0]) / l; fz += (b[1] - a[1]) / l; const c = ext(s + t); cx += c[0]; cz += c[1]; n++; }
    const fl = Math.hypot(fx, fz), ux = fx / fl, uz = fz / fl, c = ext(s);
    // right of travel in the world frame (x east, z south): (-uz, ux)
    P.push([c[0] - uz * off, c[1] + ux * off]);
  }
  return P;
}
export const WALLS = [
  { name: "the western cliff behind the 1st", P: offsetLine(0, -90, 420, 38), h: 46, back: 0.35, jag: 4 },
  { name: "the balcony's rock (the 2nd tee)", P: [[-520, -360], [-500, -298], [-485, -280]], h: 30, back: 0.3, jag: 3 },
  { name: "the eastern cliff behind the 5th green", P: W([[332, -352], [349, -312], [360, -282]]), h: 26, back: 0.3, jag: 3 },
  { name: "the eastern cliff beside the 6th", P: offsetLine(5, -30, 520, 46), h: 24, back: 0.25, jag: 4 },
  { name: "the alcove's back wall (north of the 7th)", P: offsetLine(6, -40, 236, -34).reverse(), h: 92, back: 0.2, jag: 5, thick: 26 },
  { name: "the alcove's end (behind the 7th green)", P: W([[704, 288], [712, 330], [708, 372]]), h: 90, back: 0.2, jag: 4, thick: 30 },
];
for (const wl of WALLS) wl.len = lengthOf(wl.P);
// the alcove's roof: an overhang of rock 90 m over the floor, from the back wall out past the hole's south edge
export const ROOF = { hole: 6, s0: -20, s1: 230, off0: -40, off1: 58, under: 232 + 90, name: "the alcove's roof" };
export function roofOver(X, Z) {   // the roof's underside over (X, Z), or null
  const pr = project(WLINES[6], X, Z), s = pr.s + (pr.s <= 0.01 ? -Math.hypot(X - WLINES[6][0][0], Z - WLINES[6][0][1]) : 0);
  if (s < ROOF.s0 || s > ROOF.s1 || pr.off < ROOF.off0 || pr.off > ROOF.off1 + 6 * noise1(s / 31, 81)) return null;
  return ROOF.under + 6 * noise2(X / 40, Z / 40, 82) + 0.04 * (pr.off - ROOF.off0) * 0;
}
// the lift a wall adds at (X, Z), and whether the point is on a face (steep rock)
export function wallLift(X, Z) {
  let y = 0, face = false;
  for (const wl of WALLS) {
    const pr = project(wl.P, X, Z); if (pr.d > 260 || pr.off < -2) continue;
    const endK = smooth(pr.s / 22) * (1 - smooth((pr.s - wl.len + 22) / 22));
    if (endK <= 0) continue;
    const jag = wl.jag * (noise1(pr.s / 23, 90) + 0.5 * noise1(pr.s / 7, 91));   // the face wanders at two scales
    const o = pr.off - jag; if (o < -2) continue;
    if (wl.thick && o > wl.thick + 14) continue;   // a fin of rock (the alcove's walls), not the edge of a plateau
    const up = (wl.h * smooth(o / 2.5) + wl.back * Math.max(0, o - 2.5) * (1 - smooth((o - 120) / 80))) * (wl.thick ? 1 - smooth((o - wl.thick) / 12) : 1);
    if (o > -1 && o < 3.5) face = true;
    y = Math.max(y, up * endK);
  }
  return { y, face };
}
// kerbs: a lip of rock 1.6 m high and 3 m across along every outer edge (the gorge's two edges and the cleft), so a
// ball that only runs toward the drop stops; pines grow on it. 0..1 across it, or 0
export function kerbAt(X, Z) {
  let d = Infinity;
  const n = -Z, ex = X - edgeX(WEST_EDGE, n), ee = edgeX(EAST_EDGE, n) - X;
  if (ex < 0 && ex > -12) d = Math.min(d, project(WEW, X, Z).d);
  if (ee < 0 && ee > -12) d = Math.min(d, project(EEW, X, Z).d);
  if (Math.abs(X - CLEFT_HEAD[0]) < 200 && Math.abs(Z + CLEFT_HEAD[1]) < 200 && !inCleft(X, Z)) d = Math.min(d, project([...CLEFTW, CLEFTW[0]], X, Z).d);
  if (d > 3.2) return 0;
  for (const k of [1, 3]) if (project(WLINES[k], X, Z).d < 16) return 0;   // none across a par 3's carry (it hid the green)
  for (const F of FRONTS) { const dx = X - F.p[0], dz = Z - F.p[1], r = Math.hypot(dx, dz); if (r < F.r && (dx * F.u[0] + dz * F.u[1]) > -6) return 0; }
  return Math.sin(Math.PI * clamp(d / 3.2, 0, 1));
}
export const KERB_H = 1.6;
// in front of a green no kerb (it would hide the flag from the approach): the pin and the way back to the tee
const FRONTS = WLINES.map(L => { const p = L.at(-1), q = L.at(-2), l = Math.hypot(q[0] - p[0], q[1] - p[1]); return { p, u: [(q[0] - p[0]) / l, (q[1] - p[1]) / l], r: 48 }; });
export function liftAt(X, Z) { const wl = wallLift(X, Z), k = kerbAt(X, Z); return { y: wl.y + KERB_H * k, face: wl.face, kerb: k > 0.15 }; }

// ---- water: the stream down the hanging valley (the 3rd), the lotus pool in the alcove (the 7th), the pond under
// the tea terrace wall (the 8th). Each with a level; the stream falls in steps
const strm = s => onLine(2, s[0], s[1]);
export const STREAM = { P: [[200, -44], [250, -26], [300, -8], [350, -2], [400, 3], [445, 2], [478, 8], [505, 32], [530, 62], [560, 96]].map(strm), w: 3.2 };
export const LOTUS = { c: onLine(6, 120, -20), rx: 15, rz: 10, rot: 0.3, level: 231.4 };
export const POND = { c: onLine(7, 392, 14), rx: 18, rz: 11, rot: -0.2, level: 255.4 };
export function waterAt(X, Z, ground = null) {
  const pr = project(STREAM.P, X, Z);
  if (pr.d < STREAM.w / 2 + 0.6 * noise1(pr.s / 9, 92) && pr.s > 1) return { level: (ground ?? 0) - 0.7, body: 'stream' };
  for (const P of [LOTUS, POND]) if (seDist({ x: P.c[0], z: P.c[1], rx: P.rx, rz: P.rz, rot: P.rot }, X, Z) + 0.05 * noise2(X / 7, Z / 7, 93) < 1) return { level: P.level, body: P === LOTUS ? 'lotus' : 'pond' };
  return null;
}
// the stream's channel and the ponds' basins, cut into the ground
export function wet(X, Z, y) {
  if (y === null) return y;
  const pr = project(STREAM.P, X, Z);
  if (pr.d < 9 && pr.s > 0.5 && pr.s < lengthOf(STREAM.P) - 0.5) y -= 1.2 * (1 - smooth((pr.d - STREAM.w / 2) / 5));
  for (const P of [LOTUS, POND]) { const e = seDist({ x: P.c[0], z: P.c[1], rx: P.rx, rz: P.rz, rot: P.rot }, X, Z); if (e < 1.8) { const into = (e - 1) * Math.min(P.rx, P.rz); y = lerp(Math.min(y, into < 0 ? P.level - 1.2 : P.level + 0.25 + into * 0.08), y, smooth((into - 2) / 10)); } }
  return y;
}

// ---- the built and sacred things, in world space. Boxes { kind, at: [X, Z], w (across), l (along its bearing),
// h, rot (compass bearing of its length, radians), solid }. Sacred things stand beside the holes, never in play.
const bx = (kind, p, wd, l, h, brg, more = {}) => ({ kind, at: w(p), w: wd, l, h, rot: brg * Math.PI / 180, ...more });
const lp = (k, s, off) => { const q = onLine(k, s, off); return [q[0], -q[1]]; };   // [x, n] of a point by a hole's line
export const SITES = [
  bx('gatehouse', lp(0, -26, -14), 14, 10, 9, 156, { solid: true, name: 'the gate house' }),
  bx('bridge', P2(52, 40), 3, 92, 1, 121 + 90, { name: 'the rope bridge', scenery: true }),
  bx('wheel', lp(2, 330, 46), 8, 8, 7, 200, { solid: true, name: 'the prayer-wheel house' }),
  bx('pine', [NEEDLE.c[0] + 6, NEEDLE.c[1] + 9], 3, 3, 9, 0, { name: 'the twisted pine', tree: true }),
  bx('stupa', lp(5, 520, 34), 12, 12, 16, 0, { solid: true, name: 'the white stupa' }),
  bx('stair', lp(5, 270, -14), 4, 16, 9, 345, { name: 'the pilgrim stair', scenery: true }),
  bx('halls', lp(6, 80, -30), 6, 110, 26, 79, { name: 'the painted halls', scenery: true }),
  bx('cairn', lp(7, 500, 45), 5, 5, 6, 0, { solid: true, name: 'the cairn and its flags' }),
  // the monastery set into the eastern cliff's face, its courtyard the 9th green's surround
  bx('hall', [372, 548], 34, 24, 26, 215, { solid: true, name: 'the golden hall', roof: 'gold' }),
  bx('hall', [326, 584], 22, 16, 18, 200, { solid: true, name: 'the guesthouse (the clubhouse)', roof: 'red' }),
  bx('hall', [340, 500], 26, 18, 22, 190, { solid: true, name: 'the bell tower', roof: 'red' }),
  bx('hall', [310, 470], 18, 14, 16, 180, { solid: true, name: 'the lamp hall', roof: 'red' }),
  bx('wall', [386, 566], 1.6, 58, 3.2, 126, { solid: true, name: "the courtyard's back wall" }),
  bx('wall', [433, 584], 1.6, 40, 3.2, 35, { solid: true, name: "the courtyard's south-east wall" }),
  bx('wall', [376, 612], 1.6, 40, 3.2, 35, { solid: true, name: "the courtyard's north-west wall" }),
  // the 2nd green's parapet: a stone wall along the far balcony's edge that returns a long ball
  bx('wall', P2(188, 8), 1.4, 46, 1.8, 121 + 90, { solid: true, name: "the balcony's parapet" }),
];
export const LABELS = [[w([-430, 640]), 'the gorge'], [w(CLEFT_HEAD), 'the cleft'], [w([-420, 0]), 'the hanging valley'], [w(NEEDLE.c), 'the Needle'],
  [w([100, -420]), 'the Broken Ridge'], [w([372, 548]), 'the monastery'], [w([600, 320]), 'the alcove'], [w([640, 560]), 'the tea terraces']];
export { edgeX };
