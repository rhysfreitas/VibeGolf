// The island study (17 November 2026). Rhys on the blockout: the islands didn't look or feel like his photos (Maya
// Bay from the beach and from the air, Koh Hong's streaked wall over its lagoon, the longtail between sheer walls,
// Krabi's domed islets joined by sandbars), because round 1 cut valleys through them. His picks: the big islands stay
// whole; most of the golf at their foot (shelves with a side lean, like the 4th and 7th), up top only a par 3 dropping
// down; through the rock only the sea cave and one natural gap; the Sandbar kept.
//
// One big island (the Massif) built that way, in world space (X east, Z south, y above low water), to agree the look
// before any hole is re-laid: a horseshoe of jungle domes round a cove opening south with a white beach at its head,
// sheer walls from the sea (a dark notch at the waterline), a shelf along the east side 11-16 m up leaning to the sea,
// a ledge 70 m up the cove's west wall, a gap 30 m wide between the west arm and a tower, a sandbar at low tide out to
// a domed islet, a stack, and more islands out in the bay. Pure, no DOM.
import { clamp, smooth, lerp, seDist } from '../geo.mjs';

const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}
const fbm = (x, z, seed, oct = 4) => { let a = 0, f = 1, w = 0.5; for (let o = 0; o < oct; o++) { a += w * noise2(x * f, z * f, seed + o * 17); f *= 2.03; w *= 0.5; } return a; };
const W = (x, n) => [x, -n];                                   // plan [x east, n north] -> world [X, Z]
const se = (x, n, rx, rn, rot = 0, p = 2.2) => ({ x, z: -n, rx, rz: rn, rot: rot * Math.PI / 180, p });
// signed distance (m, negative inside) to a superellipse, roughly
const sdSE = (o, X, Z) => (seDist(o, X, Z) - 1) * Math.min(o.rx, o.rz);

export const TIDES = { low: 0, high: 2.4 };
// ---- land: the Massif (two arms and a body round the cove), the gap's tower, the islet, the stack, far islands
const MASSIF = [se(-230, 380, 150, 330, 8, 2.4), se(225, 350, 165, 310, -8, 2.4), se(0, 650, 410, 200, 0, 2.5)];
export const COVE = se(0, 300, 140, 255, 0, 2.2);              // cut out of the massif: the cove, open to the south
export const GAP = se(-395, 430, 15, 420, 3, 5);               // a slot of sea 30 m wide between the west arm and the tower
const TOWER = se(-505, 430, 100, 175, 5, 2.6);
const ISLET = se(430, -130, 115, 92, 20, 2.2);
export const STACK = { X: -130, Z: 150, r: 24, top: 88 };
const FAR = [
  { o: se(-760, -420, 130, 95, 30, 2.3), peaks: [[-760, -420, 120, 140]] },
  { o: se(880, 420, 170, 120, -20, 2.3), peaks: [[860, 430, 150, 170], [960, 380, 90, 120]] },
  { o: se(-980, 980, 230, 160, 10, 2.4), peaks: [[-1010, 990, 180, 220], [-880, 900, 120, 160]] },
  { o: se(1450, -650, 190, 120, -10, 2.3), peaks: [[1450, -650, 160, 150]] },
  { o: se(-1700, -200, 260, 150, 0, 2.3), peaks: [[-1700, -180, 220, 190]] },
  { o: se(250, 1600, 380, 200, 0, 2.4), peaks: [[150, 1600, 260, 260], [420, 1620, 200, 230]] },
  { o: se(2200, 900, 300, 180, 0, 2.4), peaks: [[2200, 900, 260, 210]] },
];
// the domes: [x, n, r, h]
// peaks above the massif's body: [x, n, r, h]
const PEAKS = [[-265, 290, 150, 60], [-235, 520, 170, 95], [-120, 715, 180, 110], [95, 730, 160, 75], [265, 560, 150, 70],
  [245, 270, 130, 45], [330, 700, 120, 55], [-340, 660, 110, 40], [0, 820, 150, 60], [-160, 400, 90, 35], [170, 470, 100, 40], [-60, 600, 90, 30]];
const TOWER_PEAKS = [[-505, 450, 120, 60], [-500, 320, 80, 30]];
const ISLET_PEAKS = [[440, -125, 70, 50], [380, -150, 40, 25]];

// beaches: [x, n, rx, rn, rot]: inside one the shore is sand instead of a wall
export const BEACHES = [se(0, 545, 150, 60, 0, 2), se(392, 575, 46, 34, -20, 2), se(345, -95, 60, 40, -40, 2), se(520, -95, 55, 45, 30, 2), se(-95, 190, 40, 50, 20, 2)];
// the sandbar: from the east arm's south tip to the islet
export const BAR = { a: W(240, 40), b: W(375, -95) };

// ---- the play pieces
// H1, the Shelf (par 4 along the east arm's outer side): a bench 11-16 m up, 60 m wide, leaning 6% to the sea
export const SHELF = { n0: 70, n1: 590, d0: 6, d1: 72 };
const shelfY = n => lerp(13, 16, smooth((n - 80) / 220)) - 4.5 * smooth((n - 360) / 200);
// the east arm's east coast at a given n (scanning in from the sea), kept in a table
const EAST = new Map();
function eastCoast(n) {
  const k = Math.round(n / 4) * 4; if (EAST.has(k)) return EAST.get(k);
  let x = 700; while (x > 150 && Math.min(...MASSIF.map(o => sdSE(o, x, -k))) + 9 * fbm(x / 70, -k / 70, 3, 3) + 1.2 * noise2(x / 13, -k / 13, 9) > 0) x -= 1;
  EAST.set(k, x); return x;
}
// H2, the Drop (par 3): a ledge 70 m up the cove's west wall, to a beach green at the cove's head
export const LEDGE = { X: -152, Z: -432, r: 13, y: 70, dx: 0.84, dz: -0.54 };   // dx, dz: the way the notch opens (toward the green)
export const DROP_GREEN = { X: -15, Z: -520, y: 3.6 };
// H3, the Sandbar (par 4): the east arm's south point, across the bar to the islet's beach
export const POINT = { X: 228, Z: -55, r: 16, y: 9 };

function segD(a, b, X, Z) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz, t = clamp(((X - a[0]) * dx + (Z - a[1]) * dz) / L2, 0, 1);
  return { d: Math.hypot(X - a[0] - dx * t, Z - a[1] - dz * t), t, off: (dx * (Z - a[1]) - dz * (X - a[0])) / Math.sqrt(L2) };
}
// a dome: a rounded top falling to steep flanks (about 60 degrees at their steepest); domes add into ridges and saddles
// a tower of karst: a rounded, lumpy top over flanks that steepen to near vertical toward its foot
const dome = (pk, X, Z) => { const t = Math.hypot(X - pk[0], Z + pk[1]) / pk[2]; return t >= 1.7 ? 0 : pk[3] * Math.exp(-2 * t * t); };
const domes = (P, X, Z) => { let m = 0; for (const pk of P) m = Math.max(m, dome(pk, X, Z)); return m; };

// the coast: signed distance to the land (negative inside), with a ragged edge
export function coast(X, Z) {
  let sd = Math.min(...MASSIF.map(o => sdSE(o, X, Z)));
  sd = Math.max(sd, -sdSE(COVE, X, Z));
  const rag = 9 * fbm(X / 70, Z / 70, 3, 3) + 1.2 * noise2(X / 13, Z / 13, 9);
  sd += rag;
  sd = Math.max(sd, -(sdSE(GAP, X, Z)));                        // the gap stays open: no ragging into it
  const tw = sdSE(TOWER, X, Z) + 7 * fbm(X / 50, Z / 50, 5, 2), il = sdSE(ISLET, X, Z) + 7 * fbm(X / 50, Z / 50, 6, 2);
  return { sd: Math.min(sd, Math.max(tw, -sdSE(GAP, X, Z)), il), massif: sd, tower: tw, islet: il };
}
const beachW = (X, Z) => { let w = 0; for (const b of BEACHES) w = Math.max(w, 1 - smooth((seDist(b, X, Z) - 0.8) / 0.4)); return w; };

// the ground. t: 'water' (below low water), 'wet' (between the tides), 'sand' (dry beach), 'jungle', and the play's
// 'fairway', 'green', 'tee', 'rough' (the shelf's salt grass); rock is read from the slope when sampled
export function V(X, Z) {
  const C = coast(X, Z), bw = beachW(X, Z);
  const [x, n] = [X, -Z];
  // far islands
  let farY = -Infinity;
  for (const F of FAR) { const sd = sdSE(F.o, X, Z) + 10 * fbm(X / 80, Z / 80, 11, 2); if (sd < 0) { const wl = 40 + 60 * smooth((noise2(X / 120, Z / 120, 12) + 0.3) / 1.2), cl = wl * smooth(-sd / 4) + 1.2 * Math.max(0, -sd - 4), top = 0.6 * Math.max(...F.peaks.map(p => p[3])) + 0.45 * domes(F.peaks.map(p => [p[0], p[1], p[2] * 1.3, p[3]]), X, Z) + 18 * fbm(X / 60, Z / 60, 13, 3); farY = Math.max(farY, Math.min(cl, top)); } }
  // the sea bed: white sand shallows by the beaches and in the cove, coral patches, deep blue off the walls
  const dOut = Math.max(0, C.sd), inCove = 1 - smooth((seDist(COVE, X, Z) - 0.9) / 0.35);
  const shallow = Math.max(bw, inCove * 0.9), near = 4 + 80 * shallow;
  let bed = -(0.6 + 0.5 * noise2(X / 30, Z / 30, 21)) - 26 * smooth((dOut - near) / (60 + 120 * shallow)) - 3 * smooth(dOut / 12) * (1 - shallow);
  bed -= inCove * (1.6 + 2.6 * smooth((dOut - 30) / 140) + 2.0 * smooth((300 - n) / 260));   // the cove: turquoise over sand, deepening to its mouth
  bed -= 3.2 * smooth((fbm(X / 35, Z / 35, 22, 3) - 0.05) / 0.25) * smooth(dOut / 25);   // coral heads: darker patches in the turquoise
  // the sandbar: a dry crest above high water down its middle, wet sand either side, shallows beyond
  const sb = segD(BAR.a, BAR.b, X, Z), barW = 30 + 8 * noise2(sb.t * 6, 1, 23);
  if (sb.d < barW + 70) bed = Math.max(bed, lerp(3.0, 0.6, smooth((sb.d - 9) / (barW - 9))) - 2.5 * smooth((sb.d - barW) / 70));
  if (C.sd > 0 && farY === -Infinity) return { y: bed, t: bed < 0 ? 'water' : bed < 2.4 ? 'wet' : 'sand', bar: sb.d < barW + 2 };
  if (C.sd > 0) return { y: farY, t: 'jungle', far: true };
  // land
  const dIn = -C.sd;
  const isIslet = C.islet < 0 && C.islet <= C.massif, isTower = C.tower < 0 && C.tower <= C.massif;
  const P = isIslet ? ISLET_PEAKS : isTower ? TOWER_PEAKS : PEAKS;
  // a sheer wall from the sea (30-90 m, lower on the islet), then a steep jungle slope up to the massif's body
  // (90-140 m), and the towers standing out of it; the canopy's lumps over all of it
  const wall = isIslet ? 22 + 20 * smooth((noise2(X / 60, Z / 60, 34) + 0.3) / 1.2) : 60 + 120 * smooth((noise2(X / 120, Z / 120, 34) + 0.25) / 1.1);
  const body = (isIslet ? 55 : isTower ? 175 : 150) + (isIslet ? 15 : 55) * fbm(X / 150, Z / 150, 38, 3) + 18 * fbm(X / 60, Z / 60, 31, 3);
  const climb = wall * smooth(dIn / 3.5) + (1.7 + 0.5 * noise2(X / 80, Z / 80, 39)) * Math.max(0, dIn - 3);
  let y = Math.max(6, Math.min(climb, body + domes(P, X, Z)));
  y += 2.8 * fbm(X / 10, Z / 10, 33, 2) * smooth(dIn / 6);
  let t = 'jungle';
  // beaches: the shore comes down to the sand, jungle behind
  if (bw > 0) {
    const by = 0.5 + dIn * 0.062 + 0.4 * noise2(X / 25, Z / 25, 36), back = by + Math.max(0, dIn - 42) * 0.55;
    const yb = Math.min(y, dIn < 42 ? by : back);
    y = lerp(y, yb, bw);
    if (bw > 0.5 && y < 3.4) t = y < 2.4 ? 'wet' : 'sand';
  }
  // the shelf (H1): the east arm's outer side, cut to a bench leaning toward the sea (e: metres in from the east
  // coast at this n), the wall climbing behind
  if (!isIslet && !isTower && n > SHELF.n0 - 40 && n < SHELF.n1 + 40) {
    const e = eastCoast(n) - x;
    if (e > -5 && e < SHELF.d1 + 30) {
      const ends = smooth((n - SHELF.n0 + 40) / 40) * (1 - smooth((n - SHELF.n1) / 40));
      const ys = shelfY(n) + 0.06 * (e - 30) + 0.5 * noise2(X / 30, Z / 30, 37);
      const inner = smooth((e - SHELF.d1) / 26);              // the climb behind the bench
      y = lerp(y, Math.min(y, lerp(ys, Math.max(y, ys), inner)), ends);
      if (ends > 0.6 && e < SHELF.d1 && y < ys + 1) t = 'rough';
    }
  }
  // the ledge (H2): a level pad cut into the cove's west wall, open to the cove: a notch from the pad out to the face
  { const sg = segD([LEDGE.X, LEDGE.Z], [LEDGE.X + 70 * LEDGE.dx, LEDGE.Z + 70 * LEDGE.dz], X, Z), half = LEDGE.r + 4 * sg.t;
    if (sg.d < half + 16) { const k = 1 - smooth((sg.d - half) / 16); y = lerp(y, Math.min(y, LEDGE.y + (sg.t === 0 ? 0 : 0.3)), k); if (sg.d < LEDGE.r && sg.t < 0.6 && y > LEDGE.y - 1) t = 'rough'; } }
  // the point (H3's tee)
  const dp = Math.hypot(X - POINT.X, Z - POINT.Z);
  if (dp < POINT.r + 25) { const k = 1 - smooth((dp - POINT.r) / 25); y = lerp(y, Math.min(y, POINT.y), k); if (dp < POINT.r + 4) t = 'rough'; }
  return { y, t, dIn, beach: bw };
}

// ---- the holes, as lines in world space with their pieces
const shelfLine = () => { const pts = []; for (let n = 120; n <= 530; n += 30) pts.push([eastCoast(n) - 36, -n]); return pts; };   // the shelf's middle, north from the tee
export const HOLES = [
  { n: 1, name: 'The Shelf', par: 5, line: shelfLine(), fw: 30, story: 'Along a bench in the island\'s outer wall, leaning to the sea, the jungle wall climbing on your left.' },
  { n: 2, name: 'The Drop', par: 3, line: [[LEDGE.X + 3, LEDGE.Z + 3], [DROP_GREEN.X, DROP_GREEN.Z]], fw: 0, story: 'Off a ledge 70 m up the cove\'s wall to a green on the beach at its head.' },
  { n: 3, name: 'The Sandbar', par: 4, line: [[258, -24], [330, 52], [470, 158]], fw: 34, story: 'Off the point and along the sandbar to the islet\'s beach; at high water the bar is a strip.' },
];
// longtails, for the look: [X, Z, heading degrees]
export const BOATS = [[-30, -330, 20], [40, -290, 200], [-60, -250, 75], [-395, -150, 5], [-385, -60, 185], [150, 120, 130], [520, -40, 250], [-200, 250, 300]];
