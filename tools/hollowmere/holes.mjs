// Hollowmere, all nine holes (draft 3, after the first blockout markups). One world frame for the whole
// course (metres; x east, -z north; y up, 0 = the surface at the mine entrance), because four holes share
// one cavern. Engine hole format (islands with slopes, floor with gorges, fairways, green, bunkers, water,
// rivers, rocks, groves) plus: words for the plan book, `marks` (scenery cave-world.js draws: skylights,
// falls, lanterns, crystals, glowworms, the trestle, stalactites, the geode...), `streams` (water that runs
// downhill: split into level river pools below), and `roof` (the cavern roof over the hole, for the
// profiles). HALLS outline the caverns: outside them is rock.
// Rules from the markups: holes play on the cave floor, not on plateaus (drop-offs only where they mean
// something: the ledge tees, the Deep, the fissure, the terraces); a big miss finds stalagmite stands,
// glowing mushrooms or rubble at the wall's foot; forward tees sit off the fairways.
import { createTerrain } from '../../src/course/terrain.js';

const cap = (a, b, w, y0, y1, o = {}) => {   // a floor island along a hall from a to b, sloping y0 -> y1
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, rx: w / 2, rz: len / 2 + w * 0.3, rot: Math.atan2(-dx, dz), top: Math.max(y0, y1), depth: 200,
    kind: 'rough', seed: Math.round(Math.abs(a[0] * 7 + a[1] * 3)) % 97 + 1, trees: 0, p: 2.2, slope: { from: [a[0], a[1], y0], to: [b[0], b[1], y1] }, ...o };
};
const pad = (x, z, top, seed, r = 8) => ({ x, z, rx: r * 0.85, rz: r, top, depth: 60, kind: 'tee', seed, trees: 0 });
const isl = (x, z, rx, rz, top, o = {}) => ({ x, z, rx, rz, top, depth: 200, kind: 'rough', seed: Math.round(Math.abs(x * 3 + z)) % 89 + 2, trees: 0, ...o });
const yaw = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
// a point along a polyline, s metres from its start, pushed `off` metres to the right of travel
function at(line, s, off = 0) {
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (s <= l || i === line.length - 2) { const ux = (bx - ax) / l, uz = (bz - az) / l; return [ax + ux * s - uz * off, az + uz * s + ux * off]; }
    s -= l;
  }
}
// a seeded scatter (the same every run)
const rnd = seed => { let t = seed * 9301 + 49297; return () => ((t = (t * 9301 + 49297) % 233280) / 233280); };
// a stand of stalagmites around a point: solid, tapering cones that stop a big miss (n of them, spread m)
const stand = ([x, z], n, spread, seed, hmin = 5, hmax = 15) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * spread, h = hmin + R() * (hmax - hmin);
  return { type: 'hoodoo', x: x + Math.cos(a) * d, z: z + Math.sin(a) * d, r: 0.9 + h * 0.14 + R() * 0.6, h, cap: 0, taper: true }; }); };
// a floor-to-roof flowstone column (a stalactite and stalagmite grown together)
const column = ([x, z], r, h = 160) => ({ type: 'hoodoo', x, z, r, h, cap: 0, column: true });
// giant glowing mushrooms: they play as trees
const shrooms = ([x, z], r, n) => ({ x, z, r, n, kind: 'mushroom' });
const bunker = (p, a, b, rx, rz, o = {}) => ({ x: p[0], z: p[1], rx, rz, rot: yaw(a, b), style: 'flashed', ...o });
// cave landforms: a crest you can't see over, a rimstone terrace step, a cant toward trouble, rolls
const crest = (x, z, from, length, width, height) => ({ type: 'mound', x, z, from, length, width, height });
const terrace = (x, z, from, height, width = 120, run = 400, length = 15) => ({ type: 'step', x, z, from, length, width, height, run }); // a rimstone bank, not a cliff
const cant = (x, z, from, grade, length, width) => ({ type: 'tilt', x, z, from, grade, length, width });
const roll = (x, z, length, width, height, rot = 0) => ({ type: 'mound', x, z, rot, length, width, height });
const swale = (x, z, from, length, width, height) => ({ type: 'swale', x, z, from, length, width, height });

// the Hollow: one great cavern, the chasm in its middle, an inlet under the falls, a fissure to the east
// and a gorge carrying the stream off hole 3's ledge into the Deep
export const C = [175, -1200];
const c = (dx, dz) => [C[0] + dx, C[1] + dz];
export const HOLLOW = {
  floorY: -66, roofY: 55,
  gorges: [
    { x: C[0], z: C[1], rx: 140, rz: 100, rot: 0.1 },                 // the chasm: the Deep
    { x: c(70, -140)[0], z: c(70, -140)[1], rx: 48, rz: 44, rot: 0.3 }, // the inlet under the falls
    { x: c(205, 40)[0], z: c(205, 40)[1], rx: 92, rz: 13, rot: -0.04, p: 2.6 }, // the fissure the trestle spans
    { x: 72, z: -1062, rx: 8, rz: 62, rot: -0.38, p: 2.4 },            // the stream gorge from hole 3's falls to the Deep
    // the inlet opens into the Deep: three necks over the crescent of ground that stood between them (6-29 m wide)
    { x: 267.2, z: -1286, rx: 38, rz: 17.3, rot: 0.356, p: 2 }, { x: 231.5, z: -1292.2, rx: 23.1, rz: 13.4, rot: 0.221, p: 2 }, { x: 205.1, z: -1302.4, rx: 40.5, rz: 18.5, rot: 0.096, p: 2 },
  ],
  // the Great Shaft: an opening into a second cavern above, lit by its own skylight; the falls pour from it
  skylight: { x: c(118, -150)[0], z: c(118, -150)[1], r: 50, upper: { h: 60, r: 115, sky: 20 } },
  // a curtain of water round the shaft's west lip, from the upper cavern down into the Deep
  falls: { pts: [c(91, -121), c(87, -124), c(84, -128), c(82, -132), c(80, -137), c(79, -142), c(78, -147), c(78, -151), c(78, -156), c(80, -161), c(81, -166)], top: 112 }, // over the inlet, so all of it falls into the Deep
};
const hollowFloor = { y: HOLLOW.floorY, relief: 3.2, solid: true, gorges: HOLLOW.gorges };
export const caveFloor = y => ({ y, relief: 2.5, solid: true, gorges: HOLLOW.gorges });
const hollowMarks = [
  { type: 'skylight', ...HOLLOW.skylight, label: 'the Great Shaft: up into a cavern above' },
  { type: 'falls', pts: HOLLOW.falls.pts, top: HOLLOW.falls.top, label: 'the falls, from the upper cavern into the Deep' },
  { type: 'deep', x: C[0], z: C[1], label: 'THE DEEP' },
];

export const HALLS = [
  // holes 1-3: down from the mine entrance (roof: the cavern roof's height; foot: where its walls meet the floor)
  { a: [0, 40], b: [20, -230], w: 150, roof: 72, foot: -50 }, { a: [20, -230], b: [80, -390], w: 170, roof: 62, foot: -50 },
  { e: [120, -455], rx: 115, rz: 120, roof: 32, foot: -60 },
  { a: [175, -505], b: [160, -790], w: 160, roof: 18, foot: -70 }, { a: [160, -790], b: [0, -960], w: 200, roof: 18, foot: -70 },
  // the Hollow, its north-west bay and the geode pocket
  { e: C, rx: 405, rz: 335, p: 2.6, roof: 55, foot: -80 },
  // the vault over the Deep: the roof soars away, a vast dome you can't see the top of
  { e: C, rx: 370, rz: 305, rot: 0.1, roof: 270, foot: -80, wall: 230 }, { e: c(-320, -95), rx: 105, rz: 95, roof: 40, foot: -80 }, { e: c(-200, -238), rx: 42, rz: 38, roof: 2, foot: -80 },
  // the glowworm grotto, the cenote chamber, the climb from the grotto, the cenote
  { a: [440, -915], b: [565, -760], w: 125, roof: 12, foot: -70 }, { a: [565, -760], b: [490, -585], w: 125, roof: 12, foot: -70 },
  { a: [490, -585], b: [432, -470], w: 80, roof: 20, foot: -50 },
  { e: [360, -392], rx: 150, rz: 130, roof: 60, foot: -42 }, { e: [250, -250], rx: 90, rz: 90, roof: 72, foot: -42, wall: 70 }, // the cenote's chamber: a dome closing in over the pool
  { a: [442, -508], b: [386, -340], w: 110, roof: 60, foot: -42 },           // the Cenote's tee ledge, high in the chamber
  // side passages and fissures: offshoots into the dark that make it a cave network (no play in them)
  { a: [-50, -60], b: [-120, -90], w: 26, roof: 30, foot: -50 }, { a: [70, -280], b: [150, -250], w: 22, roof: 40, foot: -50 },
  { a: [-40, -905], b: [-115, -868], w: 44, roof: 10, foot: -70 },            // hole 3's side bay, where its stream rises
  { a: [230, -640], b: [300, -610], w: 20, roof: 10, foot: -70 }, { a: [70, -560], b: [10, -600], w: 26, roof: 25, foot: -70 },
  { e: c(-418, 30), rx: 46, rz: 34, rot: 0.5, roof: 30, foot: -80 }, { e: c(-462, 56), rx: 30, rz: 22, rot: 0.65, roof: 18, foot: -80 }, { e: c(-494, 74), rx: 17, rz: 12, rot: 0.7, roof: 6, foot: -80 }, // tapering off west { a: c(390, -60), b: c(460, -40), w: 24, roof: 30, foot: -80 }, { a: c(120, 330), b: c(150, 400), w: 28, roof: 20, foot: -80 },
  { a: [600, -700], b: [660, -720], w: 22, roof: 0, foot: -70 }, { a: [420, -290], b: [480, -250], w: 22, roof: 30, foot: -42 },
  { a: [262, -236], b: [370, -258], w: 52, roof: 30, foot: -40 },           // the Cenote's left side, where the stream runs down
  { a: [362, -262], b: [392, -206], w: 34, roof: 14, foot: -40 },           // the cavern the stream runs off into
  { a: [392, -206], b: [446, -190], w: 22, roof: 4, foot: -40 }, { a: [392, -206], b: [404, -150], w: 18, roof: 2, foot: -40 },
  // side caverns, round 3: the crystal cave off the 1st, the stalagmite cave behind the 3rd green, two off the
  // north wall of the Hollow by the 6th, two off the outside of the grotto's bend, and the rimstone recess
  // in the wall behind the 4th green
  { e: [-104, -250], rx: 54, rz: 40, rot: 0.2, roof: 28, foot: -50 }, { a: [-140, -262], b: [-196, -280], w: 22, roof: 8, foot: -50 },
  { e: [-62, -956], rx: 42, rz: 30, rot: 0.1, roof: 26, foot: -70 }, { e: [-112, -962], rx: 34, rz: 24, roof: 18, foot: -70 }, { a: [-130, -964], b: [-190, -980], w: 22, roof: 6, foot: -70 },
  { e: c(-92, -350), rx: 42, rz: 30, rot: -0.3, roof: 30, foot: -80 }, { e: c(-112, -392), rx: 26, rz: 20, roof: 16, foot: -80 }, { a: c(-114, -400), b: c(-150, -450), w: 16, roof: 4, foot: -80 },
  { e: c(32, -352), rx: 34, rz: 26, rot: 0.3, roof: 24, foot: -80 }, { a: c(40, -370), b: c(60, -420), w: 16, roof: 6, foot: -80 },
  { e: [626, -858], rx: 38, rz: 28, rot: -0.6, roof: 10, foot: -70 }, { a: [650, -872], b: [706, -904], w: 18, roof: -10, foot: -70 },
  { e: [640, -764], rx: 36, rz: 26, rot: 0.2, roof: 10, foot: -70 }, { a: [664, -760], b: [720, -746], w: 16, roof: -10, foot: -70 },
  { a: c(-356, -116), b: c(-418, -152), w: 56, roof: 34, foot: -80 },
];
// sky over the course: the cenote and the skylights (the rest is roof)
// the cenote: a ragged hole in its domed roof, over the back of the pool, hung with vines
export const SKY = [{ x: 224, z: -254, r: 30, name: 'the cenote', cenote: { vines: true } }, { x: 138, z: -532, r: 16, name: 'first light' }, { x: 152, z: -805, r: 11, name: 'a pinhole' }, { ...HOLLOW.skylight, name: 'the Great Shaft' }];

export const LANDMARKS = [
  { id: 'adit', name: 'The mine entrance', short: 'Mine entrance', x: 0, z: 30 },
  { id: 'falls', name: 'The falls and the Great Shaft', short: 'The falls', x: c(98, -106)[0], z: c(98, -106)[1] },
  { id: 'cenote', name: 'The cenote', short: 'Cenote light', x: 250, z: -250 },
  { id: 'geode', name: 'The geode', short: 'Geode glow', x: c(-180, -262)[0], z: c(-180, -262)[1] },
];

export const COURSE = {
  name: 'Hollowmere', tees: [
    { id: 'eagle', name: 'Eagle', color: '#2f5fa8' }, { id: 'hawk', name: 'Hawk', color: '#f2efe6' },
    { id: 'swift', name: 'Swift', color: '#c94a3a' }, { id: 'wren', name: 'Wren', color: '#e0b84a' }],
};

const L1 = [[0, 0], [10, -215], [72, -358]];
const L3 = [[0, 0], [165, -778], [-8, -948]], L3b = [[165, -778], [-8, -948]];
const L4 = [c(-172, 255), c(-200, 22), c(-330, -92)], L4b = [c(-200, 22), c(-330, -92)];
const L5 = [c(-298, -150), c(-190, -248)];
const L6 = [c(-198, -212), c(-20, -205), c(152, -114)];
const L7 = [c(200, -205), c(232, -20), c(196, 150), c(262, 272)];
const L8 = [[452, -908], [556, -772], [505, -600]];
const L9 = [[421, -479], [385, -321], [246, -260]];
// hole 9's fin with its eyelet: across the direct line from the tee to the green, 155 m out. c is the eyelet; ax
// runs from it away from the fairway, into the inside of the dogleg and on into the wall
const FIN = { c: [333, -369], ax: [-0.782, -0.626] }, finAt = u => [FIN.c[0] + FIN.ax[0] * u, FIN.c[1] + FIN.ax[1] * u];
const FINROT = Math.atan2(FIN.ax[1], FIN.ax[0]);

// the 5th's geode: the rim of its lower half (mounds on an arc round the back and sides of the green) and
// the upper half standing on end behind it
const GEODE = (() => {
  const G = c(-190, -250), F = c(-298, -150), l = Math.hypot(G[0] - F[0], G[1] - F[1]), d = [(G[0] - F[0]) / l, (G[1] - F[1]) / l];
  const rim = [];
  for (let a = -105; a <= 105; a += 26.25) {
    const t = a * Math.PI / 180, ca = Math.cos(t), sa = Math.sin(t), dx = d[0] * ca - d[1] * sa, dz = d[0] * sa + d[1] * ca;
    rim.push({ type: 'mound', x: G[0] + dx * 25, z: G[1] + dz * 25, rot: 0, length: 17, width: 17, height: 8.5 - 2.5 * Math.abs(a) / 105 });
  }
  return { rim, back: [G[0] + d[0] * 36, G[1] + d[1] * 36], across: Math.atan2(d[0], -d[1]) };
})();

// the knoll the 6th tees off, beside the 5th green: a natural rise, no cliff (shared by both holes)
const KNOLL6 = { type: 'mound', x: c(-204, -214)[0], z: c(-204, -214)[1], from: c(-118, -222), length: 120, width: 74, height: 14.5 };

export const HOLES = [
  /* 1 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Adit', par: 4, shape: 'Off a ledge, bends right',
    targets: [{ name: 'Fairway', x: 12, z: -222 }, { name: 'Bite the corner', x: 22, z: -258 }],
    line: L1,
    tees: { eagle: [0, 0], hawk: [-6, -34], swift: [-20, -78], wren: [-22, -122] },
    islands: [
      isl(0, 10, 36, 20, 0), cap([2, -10], [8, -135], 110, 0, -25, { kind: 'rough' }),
      cap([8, -135], [14, -215], 130, -25, -28), cap([14, -215], [74, -372], 140, -28, -34),
      pad(0, 0, 0.6, 3), isl(-6, -34, 9, 9, -4.6), pad(-6, -34, -4, 4), isl(-20, -78, 9, 9, -13.6), pad(-20, -78, -13, 5), isl(-22, -122, 9, 9, -22.6), pad(-22, -122, -22, 6),
    ],
    fairways: [{ pts: [[4, -140, 26], [8, -200, 36], [18, -250, 34], [40, -300, 26], [58, -335, 18]] }],
    green: { x: 74, z: -362, rx: 16, rz: 14, style: 'tilt', tilt: 1.5, raise: 3.2, falseFront: 0.6, apron: 9, runoff: true, from: [20, -250], pins: [[76, -364], [68, -356], [80, -370], [70, -368]] },
    bunkers: [{ x: 44, z: -196, rx: 9, rz: 5, style: 'flashed', toward: [0, 0] },
      bunker(at(L1, 232, -30), L1[1], L1[2], 7, 15), bunker(at(L1, 346, -27), L1[1], L1[2], 8, 11),
      { x: 56, z: -370, rx: 5, rz: 4, style: 'flashed', toward: [74, -362] }, { x: 92, z: -350, rx: 4, rz: 3, style: 'pot' }, { x: 90, z: -378, rx: 6, rz: 5, style: 'flashed', toward: [74, -362] }],
    landforms: [cant(12, -190, [8, -135], -3, 110, 110), swale(30, -270, [14, -215], 80, 50, 1.2), roll(-30, -250, 50, 40, 2.4), roll(55, -250, 40, 36, 1.8)],
    groves: [shrooms(at(L1, 302, -46), 11, 6), shrooms(at(L1, 170, 52), 9, 4)],
    rocks: [...stand(at(L1, 200, -52), 7, 9, 11), ...stand(at(L1, 270, 55), 6, 8, 12), ...stand(at(L1, 120, 54), 5, 7, 13, 4, 10)],
    roof: { y: 55 },
    // an ore cart on the rails: it rolls between shots, along the wall and into the crystal cave, and a ball
    // that hits it bounces off
    cart: { route: [[-58, -40], [-52, -150], [-47, -205], [-66, -224], [-92, -242], [-122, -258], [-146, -267]] },
    marks: [
      { type: 'adit', x: 0, z: 30, label: 'timber-framed mine entrance, daylight behind you' },
      { type: 'text', x: -40, z: -95, label: 'breakdown slope: 25 m down' },
      { type: 'lanterns', pts: [[-34, -40], [-30, -120], [-24, -200], [20, -330], [50, -390]], label: 'lanterns on old props' },
      { type: 'rails', pts: [[-60, -10], [-52, -150], [-47, -205], [-40, -260], [0, -400]], label: 'old cart rails along the wall, a cart on them' },
      { type: 'rails', pts: [[-47, -205], [-66, -224], [-92, -242], [-122, -258], [-150, -268]], label: 'a branch into the crystal cave' },
      { type: 'crystalcave', x: -108, z: -252, r: 58, label: 'the crystal cave: crystals over the floor, walls and roof' },
      { type: 'mushrooms', pts: [[...at(L1, 302, -46), 11]], label: 'glowing mushrooms left (play as trees)' },
      { type: 'crystals', pts: [[-58, -230], [-50, -300], [96, -300]], label: 'crystal seams in the walls' },
    ],
    idea: 'Into the dark, off the ledge',
    play: 'You tee off from a ledge at the mine entrance, daylight behind you, and drive out over a 25 m drop into the first hall: the ball hangs in the lantern light for a long time. Below, a slope of fallen roof blocks (rough) runs down to a fairway canted gently right, into the bend, with a bunker on each side of the landing area. Miss wide and you are among stalagmites or under the glowing mushrooms on the left. The approach climbs back up a little to a green on a flowstone mound with a soft false front and bunkers left and right.',
    features: ['Tee ledge 25 m above the landing area: the big opener', 'Bunkers both sides of the landing area; glowing mushrooms beyond the left one', 'Stands of stalagmites beyond the rough: a big miss is blocked', 'Fairway canted right, into the bend', 'Green on a flowstone mound 3 m up, bunkers left and right', 'Roof 55 m over the tee, 85 m over the fairway'],
  },
  /* 2 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Mirror Lake', par: 3, shape: 'Steeply downhill over water',
    targets: [{ name: 'Bail out right', x: 178, z: -500 }],
    line: [[104, -382], [138, -532]],
    tees: { eagle: [104, -382], hawk: [108, -398], swift: [114, -420], wren: [124, -448] },
    floor: { ...caveFloor(-53), relief: 1.2 },
    islands: [
      isl(104, -376, 16, 14, -30, { kind: 'rough' }), pad(104, -382, -29.4, 21), isl(108, -400, 9, 8, -33.6), pad(108, -398, -33, 22),
      isl(116, -422, 10, 10, -37), pad(114, -420, -36.4, 23), isl(124, -450, 10, 10, -45), pad(124, -448, -44.4, 24),
    ],
    landforms: [roll(146, -532, 70, 60, 4.5), roll(186, -480, 110, 50, 6, 0.2)],
    fairways: [{ pts: [[180, -470, 16], [178, -505, 14]] }],
    water: [{ x: 120, z: -478, rx: 50, rz: 42, rot: 0.2, depth: 2.5 }],
    green: { x: 140, z: -534, rx: 14, rz: 12, style: 'crowned', raise: 1.4, apron: 8, runoff: true, pins: [[140, -534], [134, -528], [146, -540], [134, -540]] },
    bunkers: [{ x: 124, z: -548, rx: 4, rz: 3, style: 'pot' }],
    rocks: [...stand([62, -470], 9, 12, 21, 6, 22), ...stand([70, -520], 6, 9, 22, 5, 16), ...stand([196, -548], 5, 7, 23, 4, 12)],
    roof: { y: 32 },
    marks: [
      { type: 'skylight', x: 138, z: -532, r: 16, label: 'first light: a sunbeam on the green' },
      { type: 'lanterns', pts: [[176, -450], [196, -500], [176, -540]], label: 'lanterns along the shore' },
      { type: 'stalactites', pts: [[90, -470, 62], [110, -440, 60], [150, -455, 66]], label: 'stalactites over the lake, 60–66 m up' },
      { type: 'hang', pts: [[70, -440, 26, 4], [60, -480, 34, 5], [85, -515, 22, 3.5], [180, -430, 24, 4], [200, -520, 30, 4.5], [160, -575, 20, 3]], label: 'curtains of stalactites over the banks' },
      { type: 'crystals', pts: [[40, -470], [46, -430], [52, -520], [205, -440], [210, -560]], label: 'crystal along the walls' },
      { type: 'text', x: 50, z: -500, label: 'stalagmites on the far bank' },
    ],
    idea: 'Over the still water',
    play: 'From a flowstone ledge 22 m above the lake, a short iron drops onto a crowned green on a point, lit by the first sunbeam. It plays a club less than the yardage. The lake reflects the shaft of light, curtains of stalactites hang over the banks, stalagmites crowd the far shore and crystal glints in the walls. Bail out right onto the shore, which slopes down toward the green and leaves an easy chip; the forward tees step down the ledge.',
    features: ['Tee ledge 22 m above the lake; the shot falls 20 m to the green', 'Carry 120 yd over water from the back tee', 'Crowned green on a point, lit from a skylight', 'Shore bail-out right, sloping toward the green', 'Stalactite curtains, stalagmites and crystal all round the lake (scenery)'],
  },
  /* 3 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Stalagmite Forest', par: 5, shape: 'Dogleg left: down the terraces, up the slope',
    targets: [{ name: 'Down the terraces', x: 172, z: -712 }, { name: 'Lay up right', x: 168, z: -846 }, { name: 'Thread the stalagmites', x: 72, z: -906 }],
    line: [[184, -522], [165, -778], [-8, -948]],
    tees: { eagle: [184, -522], hawk: [204, -556], swift: [150, -600], wren: [212, -646] },
    // on the cave floor (no slabs: their edges stood as cliffs beside the 2nd green): down the terraces, then
    // one wide ramp from wall to wall up to the ledge the green sits on
    floor: caveFloor(-46), islands: [],
    fairways: [{ pts: [[178, -620, 28], [172, -700, 34], [176, -770, 30]] }, { pts: [[196, -790, 22], [172, -842, 28], [120, -880, 28], [60, -912, 26], [10, -935, 18]] }],
    rocks: [...stand(at(L3b, 30, -16), 4, 6, 31, 7, 18), ...stand(at(L3b, 70, -24), 5, 7, 32, 8, 20), ...stand(at(L3b, 100, 2), 4, 6, 33, 6, 16), ...stand(at(L3b, 128, -18), 4, 6, 34, 7, 18),
      ...stand([232, -620], 6, 8, 35, 5, 14), ...stand([120, -660], 6, 8, 36, 5, 14), ...stand([102, -770], 5, 7, 37),
      // the cave off behind the green, thick with stalagmites
      ...stand([-58, -958], 6, 12, 301, 12, 26), ...stand([-104, -964], 6, 11, 302, 14, 28), ...stand([-148, -972], 5, 9, 303, 10, 20)],
    streams: [{ pts: [[-56, -905], [-44, -930], [-36, -965], [-10, -990], [18, -998]], w: 8, depth: 1.4 }],
    rivers: [{ pts: [[226, -560], [234, -690], [228, -800], [196, -870]], w: 9, depth: 1.6 }],
    green: { x: -8, z: -952, rx: 15, rz: 13, style: 'tiered', tiers: [{ b: 5, step: 0.6 }], apron: 6, runoff: true, from: [80, -900], pins: [[-6, -954], [-14, -946], [-2, -960], [-16, -958]] },
    bunkers: [{ x: 186, z: -760, rx: 7, rz: 4, style: 'flashed', toward: [184, -522] }, bunker(at(L3b, 150, 36), L3b[0], L3b[1], 8, 18), { x: 14, z: -930, rx: 5, rz: 4, style: 'flashed', toward: [-8, -952] }, { x: -24, z: -966, rx: 4, rz: 3, style: 'pot' }],
    landforms: [terrace(176, -672, [184, -522], 2, 600, 2000), terrace(174, -727, [184, -522], 2, 600, 2000), terrace(171, -777, [184, -522], 2, 600, 2000),
      { type: 'step', x: 84, z: -870, from: [165, -790], length: 220, width: 320, height: -26, run: 60 }],
    roof: { y: 18 },
    marks: [
      { type: 'hang', pts: [[-52, -950, 12, 2.4], [-80, -966, 15, 2.8], [-108, -956, 13, 2.4], [-134, -972, 9, 2], [-70, -944, 8, 1.8]], label: 'the stalagmite cave: stalactites to meet them' },
      { type: 'skylight', x: 152, z: -805, r: 11, label: 'a pinhole of light over the stalagmites' },
      { type: 'lanterns', pts: [[214, -590], [210, -680], [214, -780], [170, -880], [80, -960]], label: 'lanterns on the safe side' },
      { type: 'falls', pts: [[16, -996], [22, -999], [28, -1002]], top: -33, label: 'the stream falls off the ledge, down its gorge into the Deep' },
      { type: 'text', x: 70, z: -790, label: 'stalagmite forest, 6–20 m tall' },
      { type: 'text', x: -96, z: -878, label: 'side bay: the stream rises here' },
      { type: 'text', x: 128, z: -700, label: 'rimstone terraces: three 2 m steps' },
      { type: 'text', x: 40, z: -1030, label: 'the hall opens into the Hollow: first sight of the falls' },
    ],
    idea: 'Thread it or go round',
    play: 'Down, then up. The drive falls onto rimstone terraces: three 2 m steps like rice paddies, so where you stop decides the lie. Then the hole turns left and climbs 26 m up a slope of fallen blocks. The direct line threads a forest of tall stalagmites growing up the slope and can get you home in two; the safe way swings right around them past a long bunker and leaves a wedge. A stream rises in a side bay left of the green, runs round the back of it and falls off the ledge, down a gorge into the Deep.',
    features: ['The drive falls 12 m down three rimstone terraces', 'The second climbs 26 m up the breakdown slope: it plays a club longer', 'A forest of stalagmites up the slope, 6–20 m tall: solid', 'The safe line swings right, past a long bunker', 'A stream behind the green that falls off the ledge into the Deep (water)', 'Two-tier green on a ledge 34 m above the Hollow floor'],
  },
  /* 4 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Rim', par: 4, shape: 'Downhill dogleg left, canted toward the Deep',
    targets: [{ name: 'Fairway', x: c(-200, 40)[0], z: c(-200, 40)[1] }, { name: 'Bite the corner', x: c(-222, 0)[0], z: c(-222, 0)[1] }],
    line: L4,
    tees: { eagle: c(-172, 255), hawk: c(-182, 222), swift: c(-205, 180), wren: c(-238, 126) },
    floor: hollowFloor,
    islands: [isl(...c(-172, 262), 30, 14, -31), cap(c(-174, 246), c(-188, 140), 110, -31, -64, { kind: 'rough' }),
      pad(...c(-172, 255), -30.4, 41), isl(...c(-182, 222), 9, 9, -39), pad(...c(-182, 222), -38.4, 42), isl(...c(-205, 180), 9, 9, -52), pad(...c(-205, 180), -51.4, 43),
      isl(...c(-330, 70), 82, 62, 75, { kind: 'rock', depth: 300 })],
    // the rimstone pools set into a recess in the wall behind the green: four steps up, a glowing pool on each
    landforms: [terrace(...c(-360.5, -114.5), c(-332, -96), -2.2, 80, 400, 3), terrace(...c(-368.9, -119.9), c(-332, -96), -2.2, 80, 400, 3), terrace(...c(-377.3, -125.3), c(-332, -96), -2.2, 80, 400, 3), terrace(...c(-385.7, -130.8), c(-332, -96), -2.2, 80, 400, 3), cant(...c(-198, 80), c(-188, 150), -5, 170, 120), roll(...c(-150, 60), 60, 40, 3), roll(...c(-240, 120), 50, 40, 2.5), swale(...c(-262, -40), c(-205, 20), 60, 30, 1.2)],
    fairways: [{ pts: [[...c(-188, 140), 30], [...c(-196, 80), 40], [...c(-205, 20), 44], [...c(-230, -30), 36], [...c(-280, -70), 28]] }],
    water: [{ x: c(-364.7, -117.2)[0], z: c(-364.7, -117.2)[1], rx: 15, rz: 3.6, from: c(-332, -96), depth: 0.6 }, { x: c(-373.1, -122.6)[0], z: c(-373.1, -122.6)[1], rx: 14, rz: 3.6, from: c(-332, -96), depth: 0.6 }, { x: c(-381.5, -128.1)[0], z: c(-381.5, -128.1)[1], rx: 13, rz: 3.6, from: c(-332, -96), depth: 0.6 }, { x: c(-389.9, -133.5)[0], z: c(-389.9, -133.5)[1], rx: 12, rz: 3.6, from: c(-332, -96), depth: 0.6 }],
    green: { x: c(-332, -96)[0], z: c(-332, -96)[1], rx: 16, rz: 14, style: 'tilt', tilt: 2, raise: 2.4, apron: 8, runoff: true, from: c(-230, -30), pins: [c(-330, -96), c(-338, -88), c(-326, -104), c(-344, -100)] },
    bunkers: [{ x: c(-250, 18)[0], z: c(-250, 18)[1], rx: 7, rz: 5, style: 'flashed', toward: c(-172, 255) },
      bunker(at(L4b, 112, -30), L4b[0], L4b[1], 11, 30, { depth: 1.4 }), { x: c(-345, -76)[0], z: c(-345, -76)[1], rx: 5, rz: 4, style: 'flashed', toward: c(-332, -96) }],
    rocks: [...stand(at(L4, 210, 50), 8, 10, 41, 6, 18), ...stand(at(L4, 120, 52), 5, 8, 42), ...stand(at(L4, 300, -44), 4, 6, 43), ...stand(c(-150, -60), 6, 8, 44, 6, 16)],
    groves: [shrooms(at(L4, 330, 45), 10, 5)],
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'text', x: c(-310, 70)[0], z: c(-310, 70)[1], label: 'cave wall\n(floor to roof)' },
      { type: 'text', x: c(-120, 120)[0], z: c(-120, 120)[1], label: 'fairway cants 5% toward the Deep' },
      { type: 'text', x: c(-310, -10)[0], z: c(-310, -10)[1], label: 'the big bunker' },
      { type: 'gours', pts: [c(-364.7, -117.2), c(-373.1, -122.6), c(-381.5, -128.1), c(-389.9, -133.5)], from: c(-332, -96), label: 'rimstone pools stepping up a recess behind the green' },
      { type: 'crystals', pts: [c(-372, -120), c(-360, -140), c(-390, -90)], label: 'crystal veins in the bay walls' },
      { type: 'lanterns', pts: [c(-230, 200), c(-245, 120), c(-262, 40), c(-290, -40)], label: 'lanterns along the wall' },
    ],
    idea: 'Along the edge of the Deep',
    play: 'The view of the course. You step out onto a ledge 33 m above the Hollow: the chasm opens on your right, the falls pour through the Great Shaft from a cavern above into the Deep, and holes 5 to 7 sit across it in the distance. The drive drops down the breakdown slope onto the cave floor along the rim, which cants toward the Deep, so a ball on the right half keeps rolling right. Then the hole turns left around a nose of cave wall to a green on a shelf in a quiet bay, with a huge bunker all down the left of the approach.',
    features: ['Tee ledge 33 m above the fairway', 'The Deep all down the right, 40–70 m from the fairway', 'Fairway cants 5% toward the Deep: aim left of where you want to finish', 'A nose of cave wall inside the corner, floor to roof', 'A huge bunker down the left of the approach', 'Green on a shelf 2.5 m up, tilted toward you'],
  },
  /* 5 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Geode', par: 3, shape: 'Steeply uphill, into a broken-open geode',
    line: L5,
    tees: { eagle: c(-298, -150), hawk: c(-276, -142), swift: c(-262, -158), wren: c(-232, -186) },
    floor: hollowFloor,
    // the geode, cracked open: the green sits in its lower half, a rim of crystal-lined rock round the back
    // and sides that turns a ball back toward the green; the upper half stands on end behind it
    islands: [isl(...GEODE.back, 26, 6, -2, { kind: 'rock', depth: 300, rot: GEODE.across })], // the upper half's shell, as tall as its face
    landforms: [{ type: 'mound', x: c(-192, -246)[0], z: c(-192, -246)[1], from: c(-298, -150), length: 120, width: 96, height: 13 }, KNOLL6, ...GEODE.rim],
    green: { x: c(-190, -250)[0], z: c(-190, -250)[1], rx: 15, rz: 12, style: 'punchbowl', apron: 6, from: c(-298, -150), pins: [c(-190, -250), c(-184, -256), c(-193, -255), c(-182, -246)] },
    bunkers: [{ x: c(-205, -232)[0], z: c(-205, -232)[1], rx: 5, rz: 3, style: 'flashed', toward: c(-190, -250) }, { x: c(-172, -258)[0], z: c(-172, -258)[1], rx: 3.5, rz: 3, style: 'pot', sand: 'crystal' }],
    groves: [shrooms(at(L5, 96, 32), 9, 5), shrooms(at(L5, 64, -36), 8, 4)],
    rocks: [...stand(at(L5, 40, 40), 5, 7, 51), ...stand(at(L5, 110, -34), 4, 6, 52, 5, 12)],
    roof: { y: 2 },
    marks: [
      { type: 'geode', x: c(-190, -250)[0], z: c(-190, -250)[1], r: 25, from: c(-298, -150), back: { x: GEODE.back[0], z: GEODE.back[1], w: 23, h: 25, y0: 3 }, label: 'the geode, cracked open: the green in its lower half, the upper half on end behind' },
      { type: 'crystals', pts: [at(L5, 30, -48), at(L5, 55, -50), at(L5, 80, -48), at(L5, 30, 50), at(L5, 60, 52), at(L5, 90, 50), at(L5, 115, 46)], label: 'crystals scattered along both walls' },
      { type: 'mushrooms', pts: [[...at(L5, 96, 32), 9], [...at(L5, 64, -36), 8]], label: 'glowing mushrooms (play as trees)' },
      { type: 'stalactites', pts: [[...c(-200, -270), 22], [...c(-170, -262), 20]], label: 'crystal stalactites over the back, 20–22 m up' },
      { type: 'text', x: c(-150, -210)[0], z: c(-150, -210)[1], label: 'looking back from the green: the Hollow and the falls' },
    ],
    idea: 'Into the jewel box',
    play: 'Straight up into the jewel box. A short iron climbs 13 m up a flowstone mound to a green set right against a geode that has been broken open: a shell of rock behind the green, its inside packed with crystal. Crystals glint along both walls on the way and glowing mushrooms crowd either side of the slope. From the tee you see the flag and the glow, not the putting surface; short rolls back down the false front, and long is crystal wall.',
    features: ['Green 13 m above the tee, on a flowstone mound: you see the flag, not the surface', 'False front: short rolls back down the slope', 'A broken-open geode right behind the green: crystal walls, floor to roof', 'Glowing mushrooms both sides of the slope (play as trees)', 'Crystals along both walls; nothing in the way off the tee'],
  },
  /* 6 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Falls', par: 4, shape: 'Cape dogleg right, across the inlet',
    targets: [{ name: 'Safe left', x: c(0, -208)[0], z: c(0, -208)[1] }],
    line: L6,
    tees: { eagle: c(-198, -212), hawk: c(-176, -238), swift: c(-146, -240), wren: c(-112, -248) },
    floor: hollowFloor,
    islands: [],
    landforms: [KNOLL6, crest(...c(10, -207), c(-112, -230), 26, 70, 2.5), roll(...c(-60, -250), 60, 40, 3), roll(...c(60, -238), 50, 30, 2.2), swale(...c(-30, -205), c(-110, -214), 60, 30, 1)],
    fairways: [{ pts: [[...c(-110, -214), 30], [...c(-40, -206), 42], [...c(20, -205), 44], [...c(70, -212), 36], [...c(112, -200), 30]] }, { pts: [[...c(140, -172), 18], [...c(150, -142), 16]] }],
    green: { x: c(154, -112)[0], z: c(154, -112)[1], rx: 15, rz: 13, style: 'tilt', tilt: 1.5, raise: 1.6, apron: 7, runoff: true, from: c(-20, -205), pins: [c(154, -112), c(148, -106), c(160, -118), c(150, -120)] },
    bunkers: [bunker(at(L6, 230, -34), L6[0], L6[1], 8, 20), { x: c(132, -126)[0], z: c(132, -126)[1], rx: 5, rz: 4, style: 'flashed', toward: c(154, -112) }, { x: c(174, -98)[0], z: c(174, -98)[1], rx: 4, rz: 3, style: 'pot' }],
    groves: [{ x: c(186, -132)[0], z: c(186, -132)[1], r: 14, n: 8, kind: 'jungle' }, shrooms(at(L6, 150, -48), 10, 5)],
    rocks: [{ type: 'arch', x: c(-100, -300)[0], z: c(-100, -300)[1], rot: 0.25, y: -67.5, w: 26, h: 24, t: 10, d: 9, crown: 0.7 }, // an eyelet for looks against the south wall
      ...stand(at(L6, 110, 46), 6, 8, 61), ...stand(at(L6, 200, -52), 6, 9, 62, 6, 18), ...stand(c(90, -232), 5, 7, 63)],
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'jungle', x: c(186, -132)[0], z: c(186, -132)[1], r: 16, label: 'a small jungle under the shaft' },
      { type: 'stalactites', pts: [[...c(16, -186), -34, 1, 9], [...c(40, -174), -36, 1, 10], [...c(62, -168), -33, 1, 8], [...c(24, -158), -30, 1, 7]], label: 'giant stalactites over the hero line: a high shot clips them' },
      { type: 'text', x: c(58, -124)[0], z: c(58, -124)[1], label: 'the inlet: carry it, or go round' },
      { type: 'text', x: c(-150, -262)[0], z: c(-150, -262)[1], label: 'tee on a rock ledge, 12 m up' },
    ],
    idea: 'Across the inlet, beside the falls',
    play: 'From a knoll 14 m up beside the geode, the drive runs down onto the Hollow floor, over a gentle crest that hides the landing area (a lantern on the crest shows the line). Then the hole turns right around the inlet, a bite of the chasm with the falls pouring into it through the Great Shaft from the cavern above. The hero second carries 110 yd of open air under giant stalactites: a high shot can clip them. The safe way goes left round the top of the inlet to a lay-up, then a wedge. The green sits beside the falls in the shaft of sunlight.',
    features: ['Tee on a knoll 14 m above the floor', 'A crest on the drive: blind landing, lantern on the line', 'The hero second: 110 yd over the inlet', 'Giant stalactites over the hero line: a high shot clips them', 'Safe way round the top of the inlet', 'Green beside the falls in the shaft of sunlight; a small jungle under the opening (plays as trees)'],
  },
  /* 7 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Trestle', par: 5, shape: 'S-bend over the fissure, down the terraces',
    targets: [{ name: 'Fairway', x: c(236, -10)[0], z: c(236, -10)[1] }, { name: 'Over the trestle', x: c(206, 140)[0], z: c(206, 140)[1] }, { name: 'Round the end', x: c(334, 60)[0], z: c(334, 60)[1] }],
    line: L7,
    tees: { eagle: c(200, -205), hawk: c(178, -160), swift: c(173, -118), wren: c(184, -74) },
    floor: hollowFloor,
    islands: [],
    landforms: [terrace(...c(213, 102), c(214, 62), 2.5, 420, 260), terrace(...c(211, 150), c(214, 62), 2.5, 420, 210), terrace(...c(222, 206), c(214, 62), 2, 420, 160),
      roll(...c(250, -60), 60, 40, 2.5), roll(...c(300, 20), 50, 40, 2), swale(...c(228, -120), c(200, -205), 70, 30, 1.2)],
    fairways: [{ pts: [[...c(210, -120), 30], [...c(228, -60), 40], [...c(236, -10), 38]] }, { pts: [[...c(214, 70), 32], [...c(198, 130), 38], [...c(214, 190), 34], [...c(244, 240), 26]] },
      { pts: [[...c(326, -40), 26], [...c(338, 20), 24], [...c(334, 70), 24], [...c(310, 110), 26]] }],
    green: { x: c(262, 274)[0], z: c(262, 274)[1], rx: 16, rz: 13, style: 'redan', side: 1.5, apron: 7, runoff: true, from: c(214, 190), pins: [c(262, 274), c(256, 268), c(270, 280), c(254, 280)] },
    bunkers: [bunker(at(L7, 150, 34), L7[0], L7[1], 7, 22), { x: c(250, 70)[0], z: c(250, 70)[1], rx: 6, rz: 4, style: 'flashed', toward: c(200, -205) }, bunker(at(L7, 330, -34), L7[2], L7[3], 7, 20),
      { x: c(244, 290)[0], z: c(244, 290)[1], rx: 6, rz: 4, style: 'flashed', toward: c(262, 274) }, { x: c(282, 260)[0], z: c(282, 260)[1], rx: 4, rz: 3, style: 'pot' }],
    rocks: [column(c(224, -158), 6, 128), ...stand(at(L7, 120, -50), 6, 8, 71), ...stand(at(L7, 212, -34), 5, 11, 75, 14, 26), ...stand(at(L7, 280, 48), 6, 9, 72, 6, 18), ...stand(c(150, 200), 6, 9, 73), ...stand(c(300, 220), 5, 8, 74)],
    groves: [shrooms(c(176, 40), 10, 5)],
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'trestle', pts: [c(214, 12), c(212, 68)], label: 'the old rail trestle over the fissure' },
      { type: 'stack', x: c(262, 274)[0], z: c(262, 274)[1], from: c(214, 190), r0: 10, r1: 34, label: 'stacked fallen rock on the bank in front of the green' },
      { type: 'rails', pts: [c(150, -260), c(214, -60), c(214, 120), c(330, 330)], label: 'cart rails' },
      { type: 'text', x: c(262, -160)[0], z: c(262, -160)[1], label: 'a flowstone column splits the tees' },
      { type: 'text', x: c(330, -40)[0], z: c(330, -40)[1], label: 'safe: round the end of the fissure' },
      { type: 'text', x: c(160, 150)[0], z: c(160, 150)[1], label: 'rimstone terraces: three steps down to the green' },
    ],
    idea: 'Over the trestle or round the end',
    play: 'A three-shotter down the east side of the Hollow, on the cave floor. From the back tee a floor-to-roof flowstone column stands just right of the line, so the drive has to start left of it. Second shot: carry the fissure beside the old rail trestle onto a staircase of rimstone terraces that steps 7 m down to the green, or play round the far end of the fissure for a longer third. Long bunkers line the landing areas; stalagmite stands catch the big misses. The green is a redan on the bottom terrace.',
    features: ['A flowstone column in front of the back tee: start it left', 'The fissure: 25 m wide, a carry of 30–40 yd on the hero line', 'Three rimstone terraces after the fissure, 7 m down in all', 'The old rail trestle spans it (scenery)', 'Long bunkers lining both landing areas', 'Redan green kicking right to left'],
  },
  /* 8 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Glowworm Grotto', par: 4, shape: 'Short dogleg right, up over a blind crest',
    targets: [{ name: 'Fairway', x: 546, z: -776 }],
    line: L8,
    tees: { eagle: [452, -908], hawk: [489, -899], swift: [509, -876], wren: [540, -856] },
    // on the grotto floor, rising gently all the way (no slabs, no edges): 7 m along the first leg, 10 m up the second
    floor: caveFloor(-57), islands: [],
    landforms: [{ type: 'step', x: 503, z: -840, from: [452, -908], length: 170, width: 300, height: -7, run: 400 }, { type: 'step', x: 530, z: -686, from: [556, -772], length: 180, width: 300, height: -10, run: 60 },
      crest(540, -792, [452, -908], 34, 100, 3.4), { type: 'ridge', x: 532, z: -680, from: [556, -772], length: 60, width: 26, height: 1.6 }],
    fairways: [{ pts: [[500, -846, 28], [528, -810, 34], [550, -770, 32], [540, -720, 26], [522, -665, 22]] }],
    green: { x: 504, z: -598, rx: 14, rz: 13, style: 'punchbowl', apron: 6, runoff: true, from: [540, -720], pins: [[504, -598], [498, -604], [510, -592], [498, -592]] },
    bunkers: [{ x: 575, z: -790, rx: 7, rz: 4, style: 'flashed', toward: [452, -908] }, bunker(at(L8, 120, -32), L8[0], L8[1], 7, 18), { x: 520, z: -612, rx: 4, rz: 3, style: 'pot' }],
    groves: [shrooms([514, -733], 12, 6), shrooms([482, -818], 12, 5), shrooms([556, -690], 10, 4), shrooms(at(L8, 260, 56), 10, 5), shrooms([598, -830], 10, 5)],
    rocks: [column([467.4, -863.1], 5.5, 74), { type: 'arch', x: 590, z: -700, rot: 1.1, y: -48.3, w: 16, h: 14, t: 7, d: 7, crown: 0.7 } /* an eyelet for looks */, ...stand([590, -730], 5, 7, 81), ...stand([466, -640], 5, 7, 82)],
    roof: { y: 12 },
    marks: [
      { type: 'glowworms', poly: [[420, -940], [610, -800], [600, -640], [540, -570], [460, -570], [420, -760]], dense: true, label: 'a ceiling of glowworms, thick as a night sky' },
      { type: 'mushrooms', pts: [[514, -733, 12], [482, -818, 12], [556, -690, 10], [598, -830, 10]], label: 'giant glowing mushrooms (play as trees)' },
      { type: 'lanterns', pts: [[490, -620], [520, -620], [505, -580]], label: 'lanterns round the green' },
      { type: 'text', x: 430, z: -880, label: 'a flowstone column splits the tees' },
    ],
    idea: 'Under the stars, underground',
    play: 'The darkest hole, under a ceiling so thick with glowworms it lights the grotto blue-green like a night sky. From the back tee a flowstone column pinches the drive. The drive climbs to a crest you cannot see over (the glow of the mushrooms beyond shows the line), and the fairway bends right around a stand of giant glowing mushrooms. Cut the corner over them and you have a flick; miss into them and they knock the ball down like trees. The approach plays up a ridge-backed fairway to a punchbowl green ringed by lanterns.',
    features: ['A dramatic glowworm ceiling, 55–70 m up', 'A flowstone column in front of the back tee', 'A blind crest on the drive, 3.5 m high', 'Giant glowing mushrooms inside the corner and beyond the rough: they play as trees', 'Uphill 14 m tee to green; a punchbowl green ringed by lanterns'],
  },
  /* 9 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Cenote', par: 4, shape: 'Drivable dogleg right: through the eyelet, up into the cenote', corridor: 46,
    targets: [{ name: 'Safe round the fin', x: 384, z: -330 }],
    line: L9,
    tees: { eagle: [421, -479], hawk: [404, -452], swift: [436, -426], wren: [372, -401] },
    floor: { y: -24, relief: 1.2, solid: true, gorges: [...HOLLOW.gorges, { x: 404, z: -168, rx: 6, rz: 24, rot: 0.2, p: 2.4 }] },
    islands: [
      isl(424, -486, 26, 22, -10), cap([420, -466], [398, -372], 100, -10, -23, { kind: 'rough' }),
      // the fin across the direct line, floor to roof, with the eyelet in it: a short end toward the fairway,
      // a long one into the inside of the dogleg and the wall
      isl(...finAt(-24), 8, 8, 70, { kind: 'rock', depth: 300, rot: FINROT, p: 2.4 }), isl(...finAt(64), 46, 8, 70, { kind: 'rock', depth: 300, rot: FINROT, p: 2.4 }),
      pad(421, -479, -9.4, 91),
    ],
    // the eyelet: open from the floor, so you see straight through it to the green
    rocks: [{ type: 'arch', x: FIN.c[0], z: FIN.c[1], rot: FINROT, y: -25, w: 34, h: 52, t: 14, d: 14, crown: 2.6 },
      ...stand([470, -392], 6, 9, 91), ...stand([424, -268], 5, 8, 92)],
    // the climb into the cenote: one ramp from wall to wall, so nothing beside the fairway or green falls
    // away, up to a level floor round the green and its pool
    landforms: [{ type: 'step', x: 318, z: -292, from: [385, -321], length: 100, width: 340, height: -14, run: 220 }],
    fairways: [{ pts: [[410, -410, 22], [403, -380, 30], [393, -345, 30], [378, -318, 28], [348, -304, 28], [310, -290, 26], [276, -275, 24]] }],
    // one pool round the back and left of the green, level with it, fed by the falls; it spills down the left
    // of the fairway in a cascade and runs off into a side cavern
    streams: [{ pts: [[280, -243], [298, -248], [318, -254], [338, -259], [356, -260], [370, -246], [382, -226], [394, -204], [404, -180]], w: 7, depth: 1.2 },
      { pts: [[354, -262], [368, -268], [384, -274], [400, -279]], w: 9, depth: 1.2 }], // a reach of water out along the left of the corner
    water: [{ x: 194, z: -251, rx: 14, rz: 15, depth: 1.8 }, { x: 178, z: -250, rx: 11, rz: 17, depth: 1.8 }],
    rivers: [{ pts: [[216, -282], [212, -273], [209, -264], [209, -254], [212, -245], [217, -237], [224, -230], [233, -226], [242, -223], [252, -223], [261, -226], [269, -231], [276, -238], [280, -247]], w: 16, depth: 1.6 }], // the pool: one channel round the back and left of the green, at one level
    green: { x: 246, z: -260, rx: 15, rz: 14, style: 'tilt', tilt: 1.0, raise: 0.6, apron: 6, runoff: true, from: [348, -304], pins: [[246, -260], [240, -266], [252, -254], [241, -254]] },
    bunkers: [bunker([420, -337], L9[0], L9[1], 7, 16), { x: 268, z: -282, rx: 6, rz: 4, style: 'flashed', toward: [246, -260] }],
    roof: { y: 60, open: { x: 224, z: -254, r: 30 } },
    marks: [
      { type: 'skylight', x: 224, z: -254, r: 30, label: 'the cenote: a hole in the domed roof, hung with vines' },
      { type: 'falls', through: true, pts: [[198.6, -244.8], [197.6, -248.4], [197.1, -252.1], [197.1, -255.9], [197.6, -259.6], [198.6, -263.2]], label: 'the falls, in through the hole into the back of the pool' },
      { type: 'text', x: 316, z: -392, label: 'the fin and its eyelet: the bold line to the green' },
      { type: 'text', x: 400, z: -236, label: 'the stream runs off into a side cavern' },
    ],
    idea: 'Through the eye, into the light',
    play: 'The finish. From high tees on a ledge at the top of the chamber, the green is in reach: the bold line flies straight at it through an eyelet in a rock fin that stands across the inside of the corner, floor to roof, and on up into the cenote under the open sky. The safe way drops down the slope of fallen blocks to the floor, bends right round the end of the fin and climbs a wide, level-sided ramp to the green. The falls tumble down the cenote\'s planted terraces into a pool round the back and left of the green, level with it; the pool spills down the left of the fairway in a cascade that runs off into a side cavern.',
    features: ['Drivable from the high back tee: through the eyelet in the fin', 'The safe way: down the breakdown slope, right round the end of the fin, up the ramp', 'A pool round the back and left of the green, level with it, fed by falls down the terraces', 'The cascade down the left of the fairway runs off into a side cavern (water)', 'The end of the hole climbs out of the dark into the open cenote', 'Clubhouse on the rim above'],
  },
];
// fairway widths above are roughly half-widths drawn generously; trim them to 55-65 m landing areas
HOLES.forEach(h => (h.fairways || []).forEach(f => f.pts.forEach(p => { p[2] = Math.round(p[2] * 0.75); })));
// streams run downhill: split each into level pools along the ground, a few metres of fall apart
HOLES.forEach(h => {
  if (!h.streams) return;
  const T = createTerrain({ ...h, rivers: [], streams: undefined, line: h.line, pin: h.green.pins[0] });
  const g = (x, z) => T.groundAt(x, z) ?? (h.floor ? h.floor.y : 0);
  for (const S of h.streams) {
    const P = []; // the line every 4 m
    for (let i = 0; i < S.pts.length - 1; i++) { const [ax, az] = S.pts[i], [bx, bz] = S.pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4); for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
    P.push(S.pts.at(-1));
    let seg = [P[0]], top = g(...P[0]);
    for (let i = 1; i < P.length; i++) {
      seg.push(P[i]);
      if (top - g(...P[i]) > 3.5 || i === P.length - 1) { if (seg.length > 1) (h.rivers = h.rivers || []).push({ pts: seg, w: S.w, depth: S.depth }); seg = [P[i]]; top = g(...P[i]); }
    }
  }
});
