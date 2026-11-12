// Halcyon Ring: the station's floor in ring space, for the routing check and (later) the plan book.
// The ring is a cylinder of radius R = 5 km (Rhys's pick, 11 November 2026), 900 m wide across its axis.
// Ring space: a = across the ring (metres east of the centre line; the rims at a = ±450), s = along the ring
// (metres north; north is spinward, up the curve toward the clubhouse). World plan coordinates follow the other
// plan tools: X = a (east), Z = -s (north is -Z).
// The curve "plays as it looks" (Rhys): each hole's ground rises by (s - s0)² / 2R along the ring from its own low
// line s0 (curveRise); across the ring the floor is level. h (heightAt) is height above the cylinder's floor:
// terraces, valleys, basins, built from wide landforms. Pure, no DOM.
import { seDist, profileFn, smooth, clamp } from './geo.mjs';

export const R = 5000;          // ring radius
export const HALF = 450;        // the rims, at a = ±HALF
export const WALL = 320;        // rim wall height
export const curveRise = (s, s0) => (s - s0) * (s - s0) / (2 * R);
export const toXZ = (a, s) => [a, -s];
export const toAS = (X, Z) => [X, -Z];

// the line where daylight meets the night side: the mirror band's shutters close south of it
export const TERMINATOR = 30;

// villa terraces rising toward each rim, with spurs and bays along the ring (height above the floor)
const westTerr = profileFn([[400, 6], [470, 36], [560, 40], [690, 18], [760, 12], [900, 14], [1200, 16], [1500, 22], [1900, 20]]);
const eastTerr = profileFn([[0, 22], [120, 24], [200, 18], [500, 14], [900, 16], [1400, 20], [1700, 26], [1900, 26]]);
export function terraceH(a, s) {
  if (a < 0) return westTerr(s) * smooth((-a - 300) / 130);
  return eastTerr(s) * smooth((a - 300) / 130);
}

// floor windows (the penalty area): superellipses in ring space
export const WINDOWS = [
  { name: 'The Long Window', a: -179, s: 176, ra: 25, rs: 45, rot: 1.309, p: 3.2, hole: 4 },
  { name: 'The Great Window', a: 221, s: 1726, ra: 33, rs: 55, rot: 0.17, p: 3.4, hole: 9 },
];
// the rim glass strip at the foot of the west wall by the 5th's balcony (seen through, not in play: the balcony
// stands over it, and a ball that goes left falls to the rim walk below, a penalty area)
export const RIM_GLASS = { a0: -450, a1: -428, s0: 590, s1: 710 };

// the long lake along the west side, curving up the ring at both ends (its far ends are scenery)
export const LAKE = { pts: [[-418, 720], [-405, 820], [-385, 920], [-392, 1030], [-400, 1150], [-418, 1400], [-415, 1800], [-405, 2300]], w: [44, 70, 90, 80, 70, 50, 52, 48] };
// the canal: out of the lake's east bay, along the north side of the 7th, then up the 8th's valley in two pounds
// with a lock between, crossing the 8th's second shot on a diagonal; the aqueduct carries it on over the valley head
export const CANAL = { pts: [[-360, 1150], [-120, 1155], [60, 1158], [88, 1200], [92, 1470], [150, 1545], [211, 1581], [290, 1606], [440, 1640]], w: 14, lock: [196, 1574] };
export const AQUEDUCT = { from: [300, 1609], to: [440, 1640], h: 18 };

// the spoke: an A-frame foot astride the centre of the 7th, two legs 240 m apart meeting 260 m up, then one shaft
// to the hub. Its legs are solid, 34 m across at the floor
export const SPOKE = { a: 130, s: 1110, legs: [[10, 1110], [250, 1110]], foot: 34, apex: 260 };

// the clubhouse villa beyond the 9th green, on the low terrace by the Great Window
export const CLUBHOUSE = { a: 75, s: 1778, w: 70, d: 34, h: 18 };
// the tram stop by the 1st tee (the round starts here; the ring tram runs along the centre of the floor)
export const TRAM = { a: 262, s: 585 };

// the 8th's valley: a tree-lined trough along the ring, its floor rising toward the valley head
export const VALLEY = { pts: [[160, 1150], [160, 1440], [205, 1560], [243, 1680]], half: 75, depth: [10, 8, 3, 0] };

export const LANDMARKS = [
  { id: 'spoke', name: 'The spoke', at: [SPOKE.a, SPOKE.s], h: 600 },
  { id: 'clubhouse', name: 'The clubhouse', at: [CLUBHOUSE.a, CLUBHOUSE.s], h: CLUBHOUSE.h },
  { id: 'earth', name: 'Earth through the rim glass', rim: true },
];

export function inWindow(a, s) { for (const w of WINDOWS) if (seDist({ x: w.a, z: w.s, rx: w.ra, rz: w.rs, rot: w.rot, p: w.p }, a, s) < 1) return w; return null; }
