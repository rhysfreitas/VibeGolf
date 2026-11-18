// Emerald Bay, layout round 2 (17 November 2026): the routing redone on whole islands. Rhys on the island study:
// "way way more like what I was thinking ... redo the course". Pure, no DOM.
//
// World space: X east, Z south (Z = -n), y above low water; points written [x east, n north] and turned by W().
// Built like the study (tools/emeraldbay/study/island.mjs): each island is a whole massif, a ragged coast from
// superellipses, sheer walls from the sea, a steep jungle climb to a lumpy body and rounded summits. The golf sits on
// FLATS added at an island's foot: a strip of land along a line (half width hw), at its own height (y0 -> y1 along
// it, leaning across), with a beach edge running down to the sea or a sheer edge (a shelf). Where a flat meets its
// island the wall climbs from the flat, not from the sea.
//
// The bay (south to north): A, the Maya island, a horseshoe whose cove opens north into the bay (holes 1-3 inside
// it); B to the east (the 4th's shelf on its west wall); C to the north with the Sentinel standing off its east end
// (the 6th through the gap between them, the 7th round a cove under its leaning south cliff); D to the west, the hollow
// island (the 9th in through its sea cave to the lagoon); the stack in the middle of the bay (the 8th); a sandbar from
// B to C (the 5th); tidal flats between the stack and D.
import { clamp, smooth, lerp, seDist } from '../geo.mjs';

const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}
const fbm = (x, z, seed, oct = 4) => { let a = 0, f = 1, w = 0.5; for (let o = 0; o < oct; o++) { a += w * noise2(x * f, z * f, seed + o * 17); f *= 2.03; w *= 0.5; } return a; };
export const W = (x, n) => [x, -n];
const se = (x, n, rx, rn, rot = 0, p = 2.2) => ({ x, z: -n, rx, rz: rn, rot: rot * Math.PI / 180, p });
const sdSE = (o, X, Z) => (seDist(o, X, Z) - 1) * Math.min(o.rx, o.rz);
export const TIDES = { low: 0, high: 2.4 };

function seg(a, b, X, Z) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = clamp(((X - a[0]) * dx + (Z - a[1]) * dz) / L2, 0, 1);
  return { d: Math.hypot(X - a[0] - dx * t, Z - a[1] - dz * t), t, off: (dx * (Z - a[1]) - dz * (X - a[0])) / Math.sqrt(L2) };
}
// a polyline in world space: distance, arc length, signed offset (+ right of travel)
export function onPoly(P, X, Z) {
  let best = { d: Infinity }, acc = 0;
  for (let i = 1; i < P.length; i++) { const q = seg(P[i - 1], P[i], X, Z), L = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (q.d < best.d) best = { d: q.d, s: acc + q.t * L, off: q.off }; acc += L; }
  best.len = acc; return best;
}
export const polyLen = P => P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
export function along(P, s, off = 0) {
  let acc = 0;
  for (let i = 1; i < P.length; i++) { const [ax, az] = P[i - 1], [bx, bz] = P[i], L = Math.hypot(bx - ax, bz - az); if (acc + L >= s || i === P.length - 1) { const t = (s - acc) / L, dx = (bx - ax) / L, dz = (bz - az) / L; return [ax + dx * L * t - dz * off, az + dz * L * t + dx * off]; } acc += L; }
}
const Wp = P => P.map(p => W(...p));

// ---- the islands. massif: superellipses unioned; cut: taken out (A's cove, D's lagoon); peaks above the body:
// [x, n, r, h]; wall: the sheer wall from the sea [lo, hi]; body: the massif's level under its summits
export const ISLANDS = {
  A: { name: 'the Maya island', massif: [se(-300, 40, 160, 300, -4, 2.4), se(300, 40, 165, 300, 4, 2.4), se(0, -260, 470, 150, 0, 2.5)], cut: [se(0, 170, 175, 255, 0, 2.2)],
    peaks: [[-300, -40, 150, 110], [-290, 200, 120, 80], [300, 0, 150, 100], [300, 210, 110, 70], [0, -300, 180, 120], [-200, -280, 120, 70], [210, -290, 120, 80]], wall: [70, 170], body: [150, 50] },
  B: { name: 'the Shelf island', massif: [se(700, 690, 210, 330, 6, 2.4)], cut: [], peaks: [[730, 560, 140, 100], [740, 820, 150, 120], [690, 960, 100, 60]], wall: [60, 150], body: [140, 45] },
  C: { name: 'the Overhang island', massif: [se(-100, 1075, 315, 150, -3, 2.4)], cut: [se(-115, 925, 95, 55, 0, 2)], peaks: [[-220, 1090, 150, 90], [60, 1070, 130, 80]], wall: [60, 150], body: [140, 40] },
  S: { name: 'the Sentinel', massif: [se(335, 1110, 75, 95, 6, 2.6)], cut: [], peaks: [[335, 1110, 80, 70]], wall: [110, 170], body: [180, 20] },
  D: { name: 'the Hong', massif: [se(-440, 665, 215, 205, 0, 2.3)], cut: [se(-455, 665, 112, 100, 10, 2.1)], peaks: [[-520, 760, 110, 60], [-400, 520, 100, 45], [-580, 590, 90, 50]], wall: [60, 140], body: [130, 35] },
};
// the 6th's gap: the slot between C's east end and the Sentinel (kept open), with a floor of sand and grass
export const GAP = { a: W(237, 960), b: W(240, 1260), floorHW: 32 };
// the 9th's sea cave through D's east wall, and the stack in the bay
export const CAVE = { a: W(-215, 640), b: W(-345, 650), hw: 28, roof: 42 };
export const STACK = { X: -20, Z: -712, r: 24, top: 9, rim: 3 };
// small islands
export const ISLETS = [
  { name: 'the Drop islet', o: se(18, 34, 36, 32, 0, 2), y: 3.6, beach: 12 },   // the 2nd's green, in A's cove
  { name: 'the cay', o: se(45, 628, 40, 28, 10, 2), y: 3.2, beach: 14 },        // the 9th tee, in the bay
];
const FAR = [
  { o: se(-1300, -200, 260, 160, 10, 2.3), peaks: [[-1300, -200, 220, 190]] },
  { o: se(1300, 200, 220, 150, -20, 2.3), peaks: [[1300, 200, 200, 170]] },
  { o: se(1200, 1500, 300, 180, 0, 2.4), peaks: [[1150, 1500, 260, 220], [1350, 1450, 160, 150]] },
  { o: se(-1100, 1500, 280, 160, 15, 2.4), peaks: [[-1100, 1500, 240, 200]] },
  { o: se(200, -1100, 300, 170, 0, 2.4), peaks: [[200, -1100, 260, 210]] },
  { o: se(2200, 800, 320, 180, 0, 2.4), peaks: [[2200, 800, 280, 200]] },
  { o: se(-2100, 700, 300, 180, 0, 2.4), peaks: [[-2100, 700, 260, 220]] },
];

// ---- the flats: the golf's ground at the islands' foot. line [x, n]..., hw half width, y [y0, y1] along it,
// lean (rise per m toward +off, i.e. right of travel), edge: 'beach' (runs down to the sea) or 'wall' (a sheer drop)
export const FLATS = [
  // 1: the terrace inside the cove's west arm, from the stilt village at the mouth to the beach at its head
  { id: 'cove', island: 'A', line: [[-150, 400], [-120, 250], [-110, 90], [-70, -30]], hw: 62, y: [3.8, 4.6], lean: 0.02, edge: 'beach' },
  { id: 'head', island: 'A', line: [[-120, -55], [0, -75], [120, -55]], hw: 45, y: [3.2, 3.2], lean: 0, edge: 'beach' },
  // 3: the beach under the cove's east wall
  { id: 'eastbeach', island: 'A', line: [[150, 30], [175, 170], [175, 300]], hw: 34, y: [3.2, 3.4], lean: 0, edge: 'beach' },
  // A's east point, round to the crossing for the 4th
  { id: 'point', island: 'A', line: [[230, 360], [330, 395], [420, 380]], hw: 30, y: [3.4, 4], lean: 0, edge: 'beach' },
  // 4: B's south-west beach (the tee), then the shelf along B's west wall, 11-16 m up, leaning 8% away from the bay
  { id: 'bsw', island: 'B', line: [[480, 360], [445, 420]], hw: 30, y: [4, 6], lean: 0, edge: 'beach' },
  { id: 'shelf', island: 'B', line: [[445, 440], [432, 640], [440, 840], [458, 955]], hw: 52, y: [11, 12], lean: -0.08, edge: 'wall', peak: 16 },
  // 5: B's north-west point (the 5th tee) and C's east beach, by the gap's mouth (its green)
  { id: 'bpoint', island: 'B', line: [[610, 1015], [655, 1050]], hw: 32, y: [5, 4.5], lean: 0, edge: 'beach' },
  { id: 'cbeach', island: 'C', line: [[300, 930], [240, 940]], hw: 36, y: [3.4, 3.6], lean: 0, edge: 'beach' },
  // 6: the gap's floor between C and the Sentinel, and the beach beyond on C's north side
  { id: 'gapfloor', island: 'C', line: [[238, 950], [240, 1110], [235, 1265]], hw: 34, y: [3.8, 4.6], lean: 0, edge: 'beach' },
  { id: 'cnorth', island: 'C', line: [[235, 1265], [110, 1250], [-30, 1250]], hw: 40, y: [4.2, 3.6], lean: 0.015, edge: 'beach' },
  // 7: the beach round C's south shore under the leaning cliff, to C's south point (the 8th tee)
  { id: 'csouth', island: 'C', line: [[-300, 900], [-200, 935], [-120, 965], [-40, 950], [30, 875]], hw: 34, y: [3.4, 3.8], lean: 0.02, edge: 'beach' },
  { id: 'cpoint', island: 'C', line: [[40, 870], [15, 815]], hw: 34, y: [5, 6], lean: 0, edge: 'beach' },
  // 9: the spit to the right at high tide, the beach at the cave mouth, the lagoon's crescent
  { id: 'spit', island: null, line: [[60, 735], [-60, 760], [-200, 735]], hw: 18, y: [2.8, 3.0], lean: 0, edge: 'beach' },
  { id: 'cavebeach', island: 'D', line: [[-185, 630], [-225, 640], [-350, 650]], hw: 32, y: [3.0, 3.2], lean: 0, edge: 'beach' },   // and the cave's sand floor
  { id: 'lagoon', island: 'D', line: [[-420, 600], [-470, 588], [-520, 605]], hw: 30, y: [3.0, 3.2], lean: 0, edge: 'beach' },
];
const FLATW = FLATS.map(f => ({ ...f, P: Wp(f.line), L: polyLen(Wp(f.line)) }));
// tidal flats between the cay and the cave: firm sand just above low water, under the sea at high
export const TIDAL = { o: se(-90, 630, 160, 55, 4, 2.2) };

// ---- the coast of one island (signed distance, negative inside), its massif's own coast, and the land
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
const KEYS = Object.keys(ISLANDS);
// t: 'water', 'wet' (between the tides), 'sand' (dry beach), 'jungle', 'flat' (a flat's grass: salt grass, palms)
export function V(X, Z) {
  // the massifs
  let best = null;
  for (let k = 0; k < KEYS.length; k++) { const I = ISLANDS[KEYS[k]], sd = islandSD(I, X, Z); if (!best || sd < best.sd) best = { sd, I, k, id: KEYS[k] }; }
  // the gap stays open between C and the Sentinel
  const gp = seg(GAP.a, GAP.b, X, Z);
  if ((best.id === 'C' || best.id === 'S') && gp.d < 26 && gp.t > 0.02 && gp.t < 0.98) best.sd = Math.max(best.sd, 26 - gp.d);
  // the cave: a slot through D's east wall (its roof is rock over it, drawn and played separately)
  const cv = seg(CAVE.a, CAVE.b, X, Z);
  if (best.id === 'D' && cv.d < CAVE.hw && cv.t > 0 && cv.t < 1) best.sd = Math.max(best.sd, CAVE.hw - cv.d);
  // the flats
  let fl = null;
  for (const f of FLATW) { const q = onPoly(f.P, X, Z), sd = q.d - f.hw + 5 * noise2(X / 40, Z / 40, 41); if (sd < 0 && (!fl || sd < fl.sd)) fl = { f, q, sd }; else if (!fl && sd < 30 && (!fl || sd < fl.sd)) fl = fl || null; }
  // islets
  let isl = null;
  for (const I of ISLETS) { const sd = sdSE(I.o, X, Z) + 3 * noise2(X / 20, Z / 20, 43); if (sd < I.beach && (!isl || sd < isl.sd)) isl = { I, sd }; }
  const dSt = Math.hypot(X - STACK.X, Z - STACK.Z);
  // the sea bed: turquoise over sand in A's cove, by beaches and on the tidal flats; coral; deep blue off the walls
  const landSD = Math.min(best.sd, fl ? fl.sd : Infinity, isl ? isl.sd : Infinity);
  const dOut = Math.max(0, landSD);
  const inCove = 1 - smooth((seDist(ISLANDS.A.cut[0], X, Z) - 0.9) / 0.35), inLag = 1 - smooth((seDist(ISLANDS.D.cut[0], X, Z) - 0.9) / 0.3);
  const shallow = Math.max(inCove * 0.9, inLag, fl && fl.f.edge === 'beach' ? 1 - smooth(fl.sd / 60) : 0, isl ? 1 - smooth(isl.sd / 60) : 0);
  const near = 4 + 70 * shallow;
  let bed = -(0.6 + 0.5 * noise2(X / 30, Z / 30, 21)) - 24 * smooth((dOut - near) / (60 + 120 * shallow)) - 3 * smooth(dOut / 12) * (1 - shallow);
  bed -= (inCove + inLag) * (1.4 + 2.2 * smooth((dOut - 30) / 120));
  bed -= 2.6 * smooth((fbm(X / 35, Z / 35, 22, 3) - 0.05) / 0.25) * smooth(dOut / 25) * (1 - smooth((seDist(TIDAL.o, X, Z) - 0.8) / 0.3));
  // the tidal flats and the sandbar (B's north-west point to C's east beach)
  const tf = 1 - smooth((seDist(TIDAL.o, X, Z) - 0.8) / 0.3);
  if (tf > 0) bed = lerp(bed, 1.1 + 0.5 * noise2(X / 25, Z / 25, 44) - 1.2 * Math.max(0, -cv.off) * 0, tf);
  const bar = onPoly(Wp([[600, 1060], [420, 1045], [300, 950]]), X, Z), barW = 34 + 8 * noise2(bar.s / 40, 1, 23);
  if (bar.d < barW + 70) bed = Math.max(bed, lerp(3.1, 0.6, smooth((bar.d - 18) / (barW - 18))) - 2.5 * smooth((bar.d - barW) / 70));
  // far islands
  let farY = -Infinity;
  for (const F of FAR) { const sd = sdSE(F.o, X, Z) + 10 * fbm(X / 80, Z / 80, 11, 2); if (sd < 0) { const wl = 40 + 60 * smooth((noise2(X / 120, Z / 120, 12) + 0.3) / 1.2), cl = wl * smooth(-sd / 4) + 1.2 * Math.max(0, -sd - 4), top = 0.6 * Math.max(...F.peaks.map(p => p[3])) + 0.45 * domes(F.peaks.map(p => [p[0], p[1], p[2] * 1.3, p[3]]), X, Z) + 18 * fbm(X / 60, Z / 60, 13, 3); farY = Math.max(farY, Math.min(cl, top)); } }
  if (farY > -Infinity) return { y: farY, t: 'jungle', far: true };
  // the stack: a flat top with a rim round its back, sheer sides
  if (dSt < STACK.r + 4) { const k = 1 - smooth((dSt - STACK.r) / 4); return { y: lerp(bed, STACK.top + (dSt > STACK.r - 5 && (Z - STACK.Z) < 0 ? STACK.rim * smooth((dSt - STACK.r + 5) / 4) : 0), k), t: dSt < STACK.r - 2 ? 'flat' : 'jungle', stack: true }; }
  // the massif's ground (for the flats' inner edges: the wall climbs from the flat)
  const mY = best.sd < 0 ? massifY(best.I, X, Z, -best.sd, best.k) : null;
  // the 2nd's ledge: a pad cut into the cove's head wall, open toward the islet
  { const lx = LEDGE.x, lz = -LEDGE.n, dx = 16 - lx, dz = -30 - lz, L = Math.hypot(dx, dz), q = seg([lx, lz], [lx + dx / L * 60, lz + dz / L * 60], X, Z);
    if (mY !== null && q.d < 30) { const k = 1 - smooth((q.d - 12) / 18); if (mY > LEDGE.y) return { y: lerp(mY, LEDGE.y, k), t: q.d < 12 && q.t < 0.5 ? 'flat' : 'jungle', ledge: true }; } }
  // a flat
  if (fl) {
    const f = fl.f, s = fl.q.s, fy = lerp(f.y[0], f.y[1], smooth(s / f.L)) + (f.peak ? (f.peak - f.y[0]) * Math.sin(Math.PI * clamp(s / f.L, 0, 1)) : 0) + f.lean * fl.q.off + 0.4 * noise2(X / 30, Z / 30, 37);
    const edge = -fl.sd;                                   // metres in from the flat's own edge
    let y = fy, t = 'flat';
    const sea = best.sd > 0 ? smooth((best.sd - 12) / 30) : 0;   // the side away from the island: a flat meets its wall with no beach between
    if (f.edge === 'beach') { const by = 0.4 + edge * 0.075 + (1 - sea) * 20; if (by < fy) { y = by; t = by < 2.4 ? 'wet' : 'sand'; } }
    else if (sea < 0.5 && edge < 8) y = fy;
    if (mY !== null) { y = Math.max(y, Math.min(mY, fy + (mY - fy) * smooth((-best.sd - 2) / 3))); if (y > fy + 1.5) t = 'jungle'; }
    return { y, t, flat: f.id };
  }
  // an islet: a low top ringed with sand
  if (isl) { const e = -isl.sd + isl.I.beach; const y = Math.min(isl.I.y, 0.4 + e * 0.12); return { y, t: y < 2.4 ? 'wet' : y < isl.I.y - 0.3 ? 'sand' : 'flat', islet: isl.I.name }; }
  if (mY !== null) return { y: mY, t: 'jungle', island: best.id };
  return { y: bed, t: bed < 0 ? 'water' : bed < 2.4 ? 'wet' : 'sand', bar: bar.d < barW, tidal: tf > 0.5 };
}

// ---- the nine, schematic: tee, corners, pin ([x, n]), as the plan book will refine them
export const LEDGE = { x: 72, n: -132, y: 62 };    // the 2nd tee, up the cove's head wall
export const HOLES = [
  { n: 1, name: 'The Village', par: 5, line: [[-150, 440], [-122, 170], [-75, -25]] },
  { n: 2, name: 'The Drop', par: 3, line: [[LEDGE.x, LEDGE.n], [16, 30]] },
  { n: 3, name: 'The Tongue', par: 3, line: [[28, 66], [165, 195]] },
  { n: 4, name: 'The Coves', par: 5, line: [[455, 420], [430, 640], [440, 840], [458, 950]] },
  { n: 5, name: 'The Sandbar', par: 4, line: [[645, 1050], [420, 1042], [272, 942]] },
  { n: 6, name: 'The Gap', par: 4, line: [[255, 915], [240, 1110], [120, 1250]] },
  { n: 7, name: 'The Overhang', par: 4, line: [[-235, 912], [-120, 962], [22, 868]] },
  { n: 8, name: 'The Stack', par: 3, line: [[10, 832], [-20, 712]] },
  { n: 9, name: 'The Hong', par: 5, line: [[45, 628], [-110, 622], [-280, 645], [-460, 600]] },
];
