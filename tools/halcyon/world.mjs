// Halcyon Ring: the station's floor in ring space, for the routing check and the plan book.
// The ring is a cylinder of radius R = 5 km (Rhys's pick, 11 November 2026), 900 m wide across its axis.
// Ring space: a = across the ring (metres east of the centre line; the rims at a = ±450), s = along the ring
// (metres north; north is spinward, up the curve toward the clubhouse). World plan coordinates follow the other
// plan tools: X = a (east), Z = -s (north is -Z).
// The curve "plays as it looks" (Rhys): each hole's ground rises by (s - s0)² / 2R along the ring from its own low
// line s0 (curveRise; the low line is at the hole's back tee, where the player stands); across the ring the floor
// is level. H(X, Z) here is height above the cylinder's floor: the rim's rise, the villa terraces (plateaus with
// eased edges), the lake's basin, the canal's cut and the 8th's valley, built from wide landforms. Pure, no DOM.
import { seDist, smooth, clamp, lerp, distLine, project } from './geo.mjs';

export const R = 5000;          // ring radius
export const HALF = 450;        // the rims, at a = ±HALF
export const WALL = 320;        // rim wall height
export const curveRise = (s, s0) => (s - s0) * (s - s0) / (2 * R);
export const toXZ = (a, s) => [a, -s];
export const toAS = (X, Z) => [X, -Z];

// the line where daylight meets the night side: the mirror band's shutters close south of it
export const TERMINATOR = 30;

// floor windows (the penalty area): superellipses in ring space (a, s)
export const WINDOWS = [
  { name: 'The Long Window', a: -179, s: 176, ra: 25, rs: 45, rot: 1.309, p: 3.2, hole: 4 },
  { name: 'The Great Window', a: 242.4, s: 1767.7, ra: 22, rs: 40, rot: -0.17, p: 3.4, hole: 9 },   // in the floor of the amphitheatre
];
// the rim glass: a band of glass 24 m wide all the way round the ring along the foot of each rim wall, flush with
// the rim's ground (9 m), where the floor's hull gives way to the glass of the walls (a penalty area, like the
// windows; Rhys, 12 November: "a full glass ring all the way around either side of the station"). Ground higher
// than the band (a villa terrace) ends in a retaining wall at its edge, `kerb` m across. The band is segmented
// like the wall: a `beam` every 120 m, on each of the wall's own ribs, carries the rib down and across the glass to
// the floor's edge (flush, `w` m wide, standing `h` proud), and a `sill` runs along the foot of the wall where the
// floor glass meets the wall glass (Rhys, 12 November, in place of the arched supports he found too busy). Both
// are part of the penalty area: a ball on them is on the glass
export const RIM = { w: 24, kerb: 3, y: 9, beam: { every: 120, w: 5, h: 0.4 }, sill: { w: 2.5, h: 1.2 } };
export const RIM_GLASS = RIM;   // the old name (routing.mjs)

// the long lake along the west side, curving up the ring at both ends (its far ends are scenery); level 3.2 m down
export const LAKE = { pts: [[-392, 690], [-391, 740], [-387, 800], [-369, 900], [-364, 980], [-378, 1060], [-389, 1180], [-384, 1400], [-384, 1800], [-384, 2300]], w: [24, 26, 34, 70, 80, 52, 30, 40, 40, 40], level: -3.2 };   // its west shore 20 m in from the rim glass, the rim walk between (12 November: it ran to the wall); the east shore where it was along the 6th; its head comes round behind the 5th green (the balcony's back wall drops into it)
// the canal: out of the lake's east bay, along the north side of the 7th, behind the 8th tee, then up the right of
// the 8th's valley to a lock at its bend, and on north-east to the aqueduct over the east terraces
export const CANAL = { pts: [[-372, 1150], [-120, 1168], [60, 1172], [118, 1170], [150, 1150], [232, 1150], [238, 1300], [236, 1450], [240, 1545], [262, 1582], [300, 1606], [440, 1640]], w: 14, lock: [240, 1545], depth: 1.6 };
export const AQUEDUCT = { from: [300, 1606], to: [440, 1640], h: 18 };

// the spoke: an A-frame foot astride the centre of the 7th, two legs 240 m apart meeting 260 m up, then one shaft
// to the hub. Its legs are solid, 34 m across at the floor; the west foot on the floor, the east one on the plinth
export const SPOKE = { a: 100, s: 1110, legs: [[-20, 1110], [220, 1110]], foot: 34, apex: 260 };   // 30 m west of the routing's, so the west foot stands below the plinth's face (height forms, 12 November)

// the clubhouse villa beyond the 9th green, on the lawn by the Great Window
export const CLUBHOUSE = { a: 72, s: 1822, w: 70, d: 34, h: 18 };
// the tram stop by the 1st tee (the round starts here; the ring tram runs along the centre of the floor)
export const TRAM = { a: 262, s: 585 };

// the 8th's valley: a tree-lined trough along the ring, its floor rising toward the valley head
export const VALLEY = { pts: [[160, 1150], [160, 1450], [200, 1560], [243, 1690]], half: 75, depth: 3.5 };

// the villa terraces and other built ground: plateaus in ring space, each a superellipse footprint (a, s, ra, rs,
// rot, p) with a top height and an eased edge of `edge` metres; applied in order, each easing the ground to its top.
// `fall: [s0, h0, s1, h1]` tilts a top along the ring (h0 at s0 to h1 at s1)
export const PLATEAUS = [
  { id: 'plaza', a: 236, s: 578, ra: 32, rs: 26, p: 3, top: 1.2, edge: 6 },                  // the tram stop's plaza (the 1st tee)
  { id: 'garden', a: 372, s: 163, ra: 44, rs: 46, p: 3, top: 6, edge: 12 },                 // the walled garden (the 2nd green)
  { id: 'e-terrace', a: 412, s: 92, ra: 30, rs: 34, p: 3, top: 12, edge: 11 },              // the 3rd tee's terrace
  { id: 'w-low', a: -340, s: 398, ra: 44, rs: 40, p: 3, top: 5, edge: 30 },                // the lowest villa terrace (the 4th green)
  { id: 'w-fall', a: -416, s: 520, ra: 40, rs: 92, p: 3, top: 36, fall: [446, 36, 610, 19], edge: 12 }, // the long lawn falling from the high terrace toward the balcony
  { id: 'w-high', a: -414, s: 421, ra: 62, rs: 25, p: 3, top: 36, edge: 8 },                // the high west terrace (the 5th tee at its north lip)
  { id: 'balcony', a: -397, s: 650, ra: 30, rs: 34, rot: 0.2, p: 2.6, top: 17, edge: 5 },  // the balcony over the rim glass (the 5th green), 8 m above it
  { id: 'falls', a: -200, s: 1114, ra: 38, rs: 26, p: 3, top: 12, edge: 10 },               // the waterfall's villa terrace (behind the 6th green; the 7th's back tee 3 m short of its east lip)
  { id: 'plinth', a: 151, s: 1122, ra: 139, rs: 96, p: 4, top: 7.5, edge: 25 },             // the spoke's plinth, a table 7.5 m up behind a grass face (the 7th's landing
  // area for the long hitter and its green, the 8th tee); its west face 170–195 m from the 7th's back tee
  { id: 'lawn', a: 100, s: 1800, ra: 110, rs: 42, p: 3, top: -1.5, edge: 12 },              // the clubhouse lawn round the window
  // the amphitheatre round the Great Window (after the lawn, so it wins): the floor sinks 8.5 m round the glass, its
  // near bank stepped for the Meridian and Horizon tees (each 3 m short of its step's lip), its far rim the
  // clubhouse lawn, level with the top tee: a par 3 across a gulf. Along the 9th's line from the back tee
  // (303, 1757): the bank from 3 to 25 m, the floor to 98 m, the far bank to 120 m, the green from 124 m
  { id: 'bowl', a: 242.4, s: 1767.7, ra: 47.5, rs: 58, rot: -0.17, p: 3, top: -8.5, edge: 22 },
  { id: 'step-m', a: 293.15, s: 1758.74, ra: 6.5, rs: 15, rot: -0.17, p: 3, top: -3, edge: 3 },    // the Meridian tee's step
  { id: 'step-h', a: 280.84, s: 1760.91, ra: 6, rs: 15, rot: -0.17, p: 3, top: -6, edge: 3 },    // the Horizon tee's step
];
const plateauM = (P, a, s) => { const d = seDist({ x: P.a, z: P.s, rx: P.ra, rz: P.rs, rot: P.rot || 0, p: P.p || 2 }, a, s); return 1 - smooth((d - 1) * Math.min(P.ra, P.rs) / P.edge + 0.5); };

// the rim: the floor rises gently toward each wall (the lowest terraces)
const rimRise = a => 9 * smooth((Math.abs(a) - 320) / 120);

const LAKE_PTS = LAKE.pts.map(([a, s]) => [a, -s]);
export function lakeAt(a, s) {   // half-width of the lake where it's nearest and the distance from its centre line
  const pr = project(LAKE_PTS, a, -s), L = LAKE.pts, n = L.length - 1;
  let acc = 0, i = 0; for (; i < n; i++) { const l = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]); if (pr.s <= acc + l) break; acc += l; }
  i = Math.min(i, n - 1); const l = Math.hypot(L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]), t = clamp((pr.s - acc) / l, 0, 1), hw = lerp(LAKE.w[i], LAKE.w[i + 1], t) / 2;
  return { d: pr.d, hw: hw * (1 + 0.08 * Math.sin(pr.s / 23) + 0.05 * Math.sin(pr.s / 9.7)) };
}
const CANAL_PTS = CANAL.pts.map(([a, s]) => [a, -s]);
export const canalD = (a, s) => distLine(CANAL_PTS, a, -s);
const VALLEY_PTS = VALLEY.pts.map(([a, s]) => [a, -s]);

// height above the cylinder's floor (no curve), at a world point
export function H(X, Z, noCanal = false) {
  const a = X, s = -Z;
  let y = rimRise(a);
  // the 8th's valley: a trough along the ring with wooded banks a few metres above the floor
  // (open at its south end: nothing before its first point, the trough deepening from there, shallowing to its head)
  { const pr = project(VALLEY_PTS, a, -s); if (pr.d < VALLEY.half + 60 && pr.s > 0.5) {
      const t = clamp(pr.s / 560, 0, 1), dep = VALLEY.depth * Math.sin(Math.PI * Math.min(1, t * 1.25)) ** 0.7 * smooth(pr.s / 60), w = smooth((pr.d - VALLEY.half + 20) / 40);
      const V = VALLEY_PTS, e0 = V.at(-2), e1 = V.at(-1), el = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
      const past = ((a - e1[0]) * (e1[0] - e0[0]) + (-s - e1[1]) * (e1[1] - e0[1])) / el;   // metres past the valley head
      y += lerp(-dep, 3.5 * smooth(pr.s / 90) * (1 - smooth((pr.d - VALLEY.half - 20) / 40)) * (1 - smooth(past / 25)), w);   // the banks end at the head
    } }
  for (const P of PLATEAUS) {
    if (Math.abs(a - P.a) > P.ra * 1.8 + P.edge || Math.abs(s - P.s) > P.rs * 1.8 + P.edge) continue;
    const m = plateauM(P, a, s); if (m > 0) y = lerp(y, P.fall ? lerp(P.fall[1], P.fall[3], clamp((s - P.fall[0]) / (P.fall[2] - P.fall[0]), 0, 1)) : P.top, m);
  }
  // the lake's basin and the canal's cut
  { const L = lakeAt(a, s); if (L.d < L.hw + 16) y = lerp(y, LAKE.level - 1.6, 1 - smooth((L.d - L.hw + 2) / 14)); }
  if (!noCanal) { const d = canalD(a, s); if (d < CANAL.w / 2 + 6) y = Math.min(y, lerp(y - CANAL.depth - 0.8, y, smooth((d - CANAL.w / 2 + 1) / 6))); }
  // the rim glass: flush at the rim's height; higher ground ends in a retaining wall at its edge, lower in a bank
  { const d = HALF - Math.abs(a) - RIM.w; if (d < RIM.kerb) y = lerp(y, RIM.y, 1 - smooth(d / RIM.kerb)); }
  return y;
}
// water: the lake (level), the canal (1.4 m below the bank either side), the falls pool by the 6th green
export function waterAt(X, Z) {
  const a = X, s = -Z;
  const L = lakeAt(a, s); if (L.d < L.hw) return { level: LAKE.level, body: 'lake' };
  const d = canalD(a, s); if (d < CANAL.w / 2) return { level: H(X, Z, true) - 1.4, body: 'canal' };
  return null;
}
export function inWindow(a, s) { for (const w of WINDOWS) if (seDist({ x: w.a, z: w.s, rx: w.ra, rz: w.rs, rot: w.rot, p: w.p }, a, s) < 1) return w;
  if (Math.abs(a) > HALF - RIM.w && Math.abs(a) <= HALF) return { name: 'the rim glass', rim: true };
  return null; }
export const windowD = w => (a, s) => (seDist({ x: w.a, z: w.s, rx: w.ra, rz: w.rs, rot: w.rot, p: w.p }, a, s) - 1) * Math.min(w.ra, w.rs);

// native ground away from the holes: parkland lawns, woods, villa gardens on the terraces, the plaza
const n2 = (x, z) => Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2.1) * Math.cos(z * 0.017 + Math.sin(x * 0.011) * 1.7);
export function nativeAt(X, Z) {
  const a = X, s = -Z;
  if (plateauM(PLATEAUS[0], a, s) > 0.5) return 'plaza';
  if (Math.abs(a) > 330) return 'garden';
  { const pr = project(VALLEY_PTS, a, -s); if (pr.d > VALLEY.half - 25 && pr.d < VALLEY.half + 55) return 'wood'; }
  if (n2(a, s) > 0.55) return 'wood';
  return 'park';
}

export const LANDMARKS = [
  { id: 'spoke', name: 'The spoke', at: [SPOKE.a, SPOKE.s], h: 600 },
  { id: 'clubhouse', name: 'The clubhouse', at: [CLUBHOUSE.a, CLUBHOUSE.s], h: CLUBHOUSE.h },
  { id: 'earth', name: 'Earth through the rim glass', rim: true },
];
