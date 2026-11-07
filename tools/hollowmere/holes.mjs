// Hollowmere, all nine holes: a DRAFT for the plan book. One world frame for the whole course (metres;
// x east, -z north; y up, 0 = the surface at the mine entrance), because four holes share one cavern.
// Engine hole format (islands with slopes, floor with gorges, fairways, green, bunkers, water, rivers,
// rocks) plus: words for the plan book, `marks` (what the engine doesn't build yet: skylights, falls,
// lanterns, crystals, glowworms, mushrooms, the trestle, stalactites) and `roof` (the cavern roof's
// height over the hole, for the profiles). HALLS outline the caverns: outside them is rock.

const cap = (a, b, w, y0, y1, o = {}) => {   // a floor island along a hall from a to b, sloping y0 -> y1
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, rx: w / 2, rz: len / 2 + w * 0.3, rot: Math.atan2(-dx, dz), top: Math.max(y0, y1), depth: 200,
    kind: 'rough', seed: Math.round(Math.abs(a[0] * 7 + a[1] * 3)) % 97 + 1, trees: 0, p: 2.2, slope: { from: [a[0], a[1], y0], to: [b[0], b[1], y1] }, ...o };
};
const pad = (x, z, top, seed, r = 8) => ({ x, z, rx: r * 0.85, rz: r, top, depth: 60, kind: 'tee', seed, trees: 0 });
const isl = (x, z, rx, rz, top, o = {}) => ({ x, z, rx, rz, top, depth: 200, kind: 'rough', seed: Math.round(Math.abs(x * 3 + z)) % 89 + 2, trees: 0, ...o });
// stalagmites along a line from a to b: [s along it, offset to its right, r, h]
const forest = (a, b, list) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, rx = -uz, rz = ux;
  return list.map(([sv, o, rr, hh]) => [a[0] + ux * sv + rx * o, a[1] + uz * sv + rz * o, rr, hh]); };
// cave landforms: a crest you can't see over, a rimstone terrace step, a cant toward trouble
const crest = (x, z, from, length, width, height) => ({ type: 'mound', x, z, from, length, width, height });
const terrace = (x, z, from, height, width = 120, run = 400) => ({ type: 'step', x, z, from, length: 9, width, height, run });
const cant = (x, z, from, grade, length, width) => ({ type: 'tilt', x, z, from, grade, length, width });
const stalagmites = (pts) => pts.map(([x, z, r, h]) => ({ type: 'hoodoo', x, z, r: r * 1.3, h, cap: 0, taper: true }));

// the Hollow: one great cavern, the chasm in its middle, an inlet under the falls and a fissure to the east
export const C = [175, -1200];
const c = (dx, dz) => [C[0] + dx, C[1] + dz];
export const HOLLOW = {
  floorY: -66, roofY: 55,
  gorges: [
    { x: C[0], z: C[1], rx: 140, rz: 100, rot: 0.1 },                 // the chasm: the Deep
    { x: c(70, -140)[0], z: c(70, -140)[1], rx: 48, rz: 44, rot: 0.3 }, // the inlet under the falls
    { x: c(205, 40)[0], z: c(205, 40)[1], rx: 92, rz: 13, rot: -0.04, p: 2.6 }, // the fissure the trestle spans
  ],
  skylight: { x: c(118, -150)[0], z: c(118, -150)[1], r: 42 },
  falls: { pts: [c(58, -106), c(78, -97), c(98, -100)], top: 55 },
};
const hollowFloor = { y: HOLLOW.floorY, relief: 2.5, solid: true, gorges: HOLLOW.gorges };
export const caveFloor = y => ({ y, relief: 2.5, solid: true, gorges: HOLLOW.gorges });
const hollowMarks = [
  { type: 'skylight', ...HOLLOW.skylight, label: 'the Great Shaft: open sky' },
  { type: 'falls', pts: HOLLOW.falls.pts, top: HOLLOW.falls.top, label: 'the falls, 120 m to the rim and on into the Deep' },
  { type: 'deep', x: C[0], z: C[1], label: 'THE DEEP' },
];

export const HALLS = [
  // holes 1-3: down from the mine entrance (roof: the cavern roof's height; foot: where its walls meet the floor)
  { a: [0, 40], b: [20, -230], w: 150, roof: 55, foot: -46 }, { a: [20, -230], b: [80, -390], w: 170, roof: 55, foot: -46 },
  { e: [120, -455], rx: 115, rz: 120, roof: 32, foot: -58 },
  { a: [175, -505], b: [160, -790], w: 160, roof: 18, foot: -66 }, { a: [160, -790], b: [0, -960], w: 200, roof: 18, foot: -66 },
  // the Hollow, its north-west bay and the geode pocket
  { e: C, rx: 405, rz: 335, p: 2.6, roof: 55, foot: -66 }, { e: c(-320, -95), rx: 105, rz: 95, roof: 40, foot: -66 }, { e: c(-190, -250), rx: 45, rz: 40, roof: 2, foot: -60 },
  // the glowworm grotto and the climb to the cenote
  { a: [440, -915], b: [565, -760], w: 125, roof: 12, foot: -66 }, { a: [565, -760], b: [490, -585], w: 125, roof: 12, foot: -66 },
  { a: [470, -565], b: [405, -385], w: 120, roof: 30, foot: -50 }, { a: [405, -385], b: [255, -255], w: 120, roof: 30, foot: -50 }, { e: [250, -250], rx: 75, rz: 75, roof: 30, foot: -50 },
];
// sky over the course: the cenote and the skylights (the rest is roof)
export const SKY = [{ x: 250, z: -250, r: 68, name: 'the cenote' }, { x: 138, z: -532, r: 16, name: 'first light' }, { x: 152, z: -805, r: 11, name: 'a pinhole' }, { ...HOLLOW.skylight, name: 'the Great Shaft' }];

export const LANDMARKS = [
  { id: 'adit', name: 'The mine entrance', short: 'Mine entrance', x: 0, z: 30 },
  { id: 'falls', name: 'The falls and the Great Shaft', short: 'The falls', x: c(80, -100)[0], z: c(80, -100)[1] },
  { id: 'cenote', name: 'The cenote', short: 'Cenote light', x: 250, z: -250 },
  { id: 'geode', name: 'The geode', short: 'Geode glow', x: c(-190, -250)[0], z: c(-190, -250)[1] },
];

export const COURSE = {
  name: 'Hollowmere', tees: [
    { id: 'eagle', name: 'Eagle', color: '#2f5fa8' }, { id: 'hawk', name: 'Hawk', color: '#f2efe6' },
    { id: 'swift', name: 'Swift', color: '#c94a3a' }, { id: 'wren', name: 'Wren', color: '#e0b84a' }],
};

export const HOLES = [
  /* 1 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Adit', par: 4, shape: 'Off a ledge, bends right',
    line: [[0, 0], [10, -215], [72, -358]],
    tees: { eagle: [0, 0], hawk: [-6, -34], swift: [-20, -78], wren: [-22, -122] },
    islands: [
      isl(0, 10, 36, 20, 0), cap([2, -10], [8, -135], 110, 0, -25, { kind: 'rough' }),
      cap([8, -135], [14, -215], 130, -25, -28), cap([14, -215], [74, -372], 140, -28, -34),
      pad(0, 0, 0.6, 3), isl(-6, -34, 9, 9, -4.6), pad(-6, -34, -4, 4), isl(-20, -78, 9, 9, -13.6), pad(-20, -78, -13, 5), isl(-22, -122, 9, 9, -22.6), pad(-22, -122, -22, 6),
    ],
    fairways: [{ pts: [[4, -140, 26], [8, -200, 36], [18, -250, 34], [40, -300, 26], [58, -335, 18]] }],
    green: { x: 74, z: -362, rx: 16, rz: 14, style: 'tilt', tilt: 1.5, raise: 3.2, falseFront: 0.6, apron: 9, runoff: true, from: [20, -250], pins: [[76, -364], [68, -356], [80, -370], [70, -368]] },
    bunkers: [{ x: 44, z: -196, rx: 9, rz: 5, style: 'flashed', toward: [0, 0] }, { x: 56, z: -370, rx: 5, rz: 4, style: 'flashed', toward: [74, -362] }, { x: 92, z: -350, rx: 4, rz: 3, style: 'pot' }],
    landforms: [cant(12, -190, [8, -135], -3, 110, 110), { type: 'swale', x: 30, z: -270, from: [14, -215], length: 80, width: 50, height: 1.2 }],
    roof: { y: 55 },
    marks: [
      { type: 'adit', x: 0, z: 30, label: 'timber-framed mine entrance, daylight behind you' },
      { type: 'text', x: -40, z: -95, label: 'breakdown slope: 25 m down' },
      { type: 'lanterns', pts: [[-34, -40], [-30, -120], [-24, -200], [-10, -270], [20, -330], [50, -390]], label: 'lanterns on old props' },
      { type: 'rails', pts: [[-60, -10], [-52, -150], [-40, -260], [0, -400]], label: 'old cart rails along the wall' },
    ],
    idea: 'Into the dark, off the ledge',
    play: 'You tee off from a ledge at the mine entrance, daylight behind you, and drive out over a 25 m drop into the first hall: the ball hangs in the lantern light for a long time. Below, a slope of fallen roof blocks (rough) runs down to a fairway canted gently right, into the bend. The approach climbs back up a little to a green on a flowstone mound with a soft false front, so a short approach rolls back off. Wide and friendly: it plays much shorter than the card.',
    features: ['Tee ledge 25 m above the landing area: the big opener', 'Breakdown slope below the tee (rough), carried by any decent drive', 'Fairway canted right, into the bend; bunker at the corner', 'Green on a flowstone mound 3 m up, soft false front', 'Lanterns on old mine props down the left', 'Roof 55 m over the tee, 85 m over the fairway'],
  },
  /* 2 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Mirror Lake', par: 3, shape: 'Steeply downhill over water',
    line: [[0, 0], [138, -532]],
    tees: { eagle: [104, -382], hawk: [108, -398], swift: [114, -420], wren: [124, -448] },
    islands: [
      isl(104, -376, 16, 14, -30, { kind: 'rough' }), pad(104, -382, -29.4, 21), isl(108, -400, 9, 8, -33.6), pad(108, -398, -33, 22),
      isl(116, -422, 10, 10, -37), pad(114, -420, -36.4, 23), isl(124, -450, 10, 10, -45), pad(124, -448, -44.4, 24),
      isl(122, -470, 80, 75, -52), isl(146, -530, 30, 24, -50), isl(190, -480, 26, 55, -50, { rot: 0.2, slope: { from: [176, -440, -45], to: [190, -520, -50] } }),
    ],
    fairways: [{ pts: [[180, -470, 16], [178, -505, 14]] }],
    water: [{ x: 120, z: -478, rx: 46, rz: 40, rot: 0.2, depth: 2.5 }],
    green: { x: 140, z: -534, rx: 14, rz: 12, style: 'crowned', raise: 2.6, apron: 8, runoff: true, pins: [[140, -534], [134, -528], [146, -540], [134, -540]] },
    bunkers: [{ x: 124, z: -548, rx: 4, rz: 3, style: 'pot' }],
    roof: { y: 32 },
    marks: [
      { type: 'skylight', x: 138, z: -532, r: 16, label: 'first light: a sunbeam on the green' },
      { type: 'lanterns', pts: [[176, -450], [196, -500], [176, -540]], label: 'lanterns along the shore' },
      { type: 'stalactites', pts: [[90, -470, 62], [110, -440, 60], [150, -455, 66]], label: 'stalactites over the lake, 60–66 m up' },
    ],
    idea: 'Over the still water',
    play: 'From a flowstone ledge 22 m above the lake, a short iron drops onto a crowned green on a point, lit by the first sunbeam. It plays a club less than the yardage. The lake reflects the shaft of light. Bail out right onto the shore, which slopes down toward the green and leaves an easy chip; the forward tees step down the ledge.',
    features: ['Tee ledge 22 m above the lake; the shot falls 18 m to the green', 'Carry 120 yd over water from the back tee', 'Crowned green on a point, raised 2.5 m, lit from a skylight', 'Shore bail-out right, sloping toward the green', 'Forward tees on lower shelves of the ledge', 'Stalactites over the lake, well above the shot'],
  },
  /* 3 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Stalagmite Forest', par: 5, shape: 'Dogleg left: down the terraces, up the slope',
    line: [[0, 0], [165, -778], [-8, -948]],
    tees: { eagle: [184, -522], hawk: [178, -556], swift: [158, -600], wren: [190, -650] },
    islands: [
      cap([184, -505], [165, -790], 120, -46, -52), cap([165, -790], [-10, -962], 150, -52, -26),
      pad(184, -522, -45.8, 31), pad(178, -556, -46.2, 32), pad(158, -600, -46.7, 33), pad(190, -650, -48.2, 34),
    ],
    fairways: [{ pts: [[178, -620, 28], [172, -700, 34], [176, -770, 30]] }, { pts: [[196, -790, 22], [172, -842, 28], [120, -880, 28], [60, -912, 26], [10, -935, 18]] }],
    rocks: stalagmites(forest([165, -778], [-8, -948], [[22, -14, 2.2, 9], [30, 8, 1.6, 6], [38, -24, 2.6, 12], [46, 16, 1.8, 7], [52, -4, 2.0, 10], [62, 22, 2.4, 11],
      [66, -18, 1.5, 5], [74, 4, 1.7, 8], [82, -26, 2.1, 9], [88, 14, 1.9, 7], [96, -8, 2.8, 13], [104, 24, 1.6, 6], [112, -16, 2.2, 9], [118, 6, 1.8, 7]])),
    rivers: [{ pts: [[226, -560], [234, -690], [228, -800], [196, -870], [150, -930]], w: 9, depth: 1.6 }],
    green: { x: -8, z: -952, rx: 15, rz: 13, style: 'tiered', tiers: [{ b: 5, step: 0.6 }], apron: 6, runoff: true, from: [80, -900], pins: [[-6, -954], [-14, -946], [-2, -960], [-16, -958]] },
    bunkers: [{ x: 186, z: -760, rx: 7, rz: 4, style: 'flashed', toward: [184, -522] }, { x: 14, z: -930, rx: 5, rz: 4, style: 'flashed', toward: [-8, -952] }, { x: -24, z: -966, rx: 4, rz: 3, style: 'pot' }],
    landforms: [terrace(176, -672, [184, -522], 2, 600, 2000), terrace(174, -727, [184, -522], 2, 600, 2000), terrace(171, -777, [184, -522], 2, 600, 2000)],
    roof: { y: 18 },
    marks: [
      { type: 'skylight', x: 152, z: -805, r: 11, label: 'a pinhole of light over the stalagmites' },
      { type: 'lanterns', pts: [[214, -590], [210, -680], [214, -780], [170, -880], [80, -960]], label: 'lanterns on the safe side' },
      { type: 'text', x: 70, z: -790, label: 'stalagmite forest, 5–13 m tall' },
      { type: 'text', x: 128, z: -700, label: 'rimstone terraces: three 2 m steps' },
      { type: 'text', x: 40, z: -1000, label: 'the hall opens into the Hollow: first sight of the falls' },
    ],
    idea: 'Thread it or go round',
    play: 'Down, then up. The drive falls onto rimstone terraces: three 2 m steps like rice paddies, so where you stop decides the lie (just short of a step leaves the ball above your feet on a downslope). Then the hole turns left and climbs 26 m up a slope of fallen blocks. The direct line threads a forest of stalagmites growing up the slope and can get you home in two; the safe way swings right around them on a lit path and leaves a wedge. The green sits on a ledge at the top, where the hall opens out and you look down into the Hollow and see the falls for the first time.',
    features: ['The drive falls 12 m down three rimstone terraces', 'The second climbs 26 m up the breakdown slope: it plays a club longer', 'A forest of stalagmites up the slope, 5–13 m tall: solid', 'The safe line swings right around the forest', 'A stream down the right off the tee (water)', 'Two-tier green on a ledge 34 m above the Hollow floor'],
  },
  /* 4 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Rim', par: 4, shape: 'Downhill dogleg left, canted toward the Deep',
    line: [[0, 0], c(-200, 22), c(-330, -92)],
    tees: { eagle: c(-172, 255), hawk: c(-182, 222), swift: c(-205, 180), wren: c(-218, 130) },
    floor: hollowFloor,
    islands: [isl(...c(-172, 262), 30, 14, -31), cap(c(-174, 246), c(-190, 150), 100, -31, -50, { kind: 'rough' }),
      cap(c(-190, 150), c(-205, 20), 120, -50, -52), cap(c(-205, 20), c(-332, -96), 120, -52, -49),
      pad(...c(-172, 255), -30.4, 41), isl(...c(-182, 222), 9, 9, -36.4), pad(...c(-182, 222), -35.8, 42), isl(...c(-205, 180), 9, 9, -44.6), pad(...c(-205, 180), -44, 43), pad(...c(-218, 130), -49.4, 44),
      isl(...c(-300, 70), 52, 62, 30, { kind: 'rock', depth: 300 })],
    landforms: [cant(...c(-198, 80), c(-188, 150), -5, 170, 120)],
    fairways: [{ pts: [[...c(-188, 140), 30], [...c(-196, 80), 40], [...c(-205, 20), 44], [...c(-230, -30), 36], [...c(-280, -70), 28]] }],
    green: { x: c(-332, -96)[0], z: c(-332, -96)[1], rx: 16, rz: 14, style: 'tilt', tilt: 2, raise: 2.4, apron: 8, runoff: true, from: c(-230, -30), pins: [c(-330, -96), c(-338, -88), c(-326, -104), c(-344, -100)] },
    bunkers: [{ x: c(-250, 18)[0], z: c(-250, 18)[1], rx: 7, rz: 5, style: 'flashed', toward: c(-172, 255) }, { x: c(-345, -76)[0], z: c(-345, -76)[1], rx: 5, rz: 4, style: 'flashed', toward: c(-332, -96) }],
    rocks: stalagmites([[...c(-152, 40), 2.4, 10], [...c(-148, 0), 1.8, 7]]),
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'text', x: c(-300, 70)[0], z: c(-300, 70)[1], label: 'cave wall\n(floor to roof)' },
      { type: 'text', x: c(-120, 120)[0], z: c(-120, 120)[1], label: 'fairway cants 5% toward the Deep' },
      { type: 'crystals', pts: [c(-372, -120), c(-360, -140), c(-300, -150)], label: 'crystal veins in the bay walls' },
      { type: 'lanterns', pts: [c(-230, 200), c(-245, 120), c(-262, 40), c(-290, -40)], label: 'lanterns along the wall' },
    ],
    idea: 'Along the edge of the Deep',
    play: 'The view of the course. You step out onto a ledge 20 m above the Hollow: the chasm opens on your right, the falls pour into it ahead, and holes 5 to 7 sit across it in the distance. The drive drops onto a fairway that runs north along the rim and cants toward the Deep, so a ball that lands on the right half keeps rolling right. Then the hole turns left around a nose of cave wall and climbs a little to a green on a shelf in a quiet bay. Bail away from the Deep and the wall blocks the green, so the drive has to be long enough to see around the corner.',
    features: ['Tee ledge 20 m above the fairway', 'The Deep all down the right, 40–70 m from the fairway', 'Fairway cants 5% toward the Deep: aim left of where you want to finish', 'A nose of cave wall inside the corner, floor to roof', 'Green on a shelf 2.5 m up, tilted toward you', 'The falls ahead across the chasm; roof 85 m over the tee'],
  },
  /* 5 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Geode', par: 3, shape: 'Steeply uphill, into a crystal pocket',
    line: [[0, 0], c(-190, -248)],
    tees: { eagle: c(-298, -150), hawk: c(-288, -162), swift: c(-270, -178), wren: c(-252, -196) },
    floor: hollowFloor,
    islands: [isl(...c(-294, -154), 26, 24, -50), cap(c(-284, -166), c(-212, -234), 64, -50, -38, { kind: 'rough' }), isl(...c(-192, -248), 30, 26, -38, { kind: 'rough' }),
      pad(...c(-298, -150), -49.4, 51), pad(...c(-288, -162), -49.4, 52), pad(...c(-270, -178), -47.8, 53), pad(...c(-252, -196), -45.4, 54)],
    green: { x: c(-190, -250)[0], z: c(-190, -250)[1], rx: 15, rz: 12, style: 'plateau', raise: 2.2, falseFront: 0.9, apron: 8, runoff: true, pins: [c(-190, -250), c(-184, -256), c(-193, -255), c(-182, -246)] },
    bunkers: [{ x: c(-205, -232)[0], z: c(-205, -232)[1], rx: 5, rz: 3, style: 'flashed', toward: c(-190, -250) }, { x: c(-172, -258)[0], z: c(-172, -258)[1], rx: 3.5, rz: 3, style: 'pot', sand: 'crystal' }],
    roof: { y: 2 },
    marks: [
      { type: 'crystals', pts: [c(-220, -280), c(-200, -292), c(-175, -290), c(-155, -270), c(-150, -245), c(-158, -222)], label: 'the geode: crystal walls all round the back' },
      { type: 'stalactites', pts: [[...c(-200, -270), 22], [...c(-170, -262), 20]], label: 'crystal stalactites over the back, 20–22 m up' },
      { type: 'text', x: c(-150, -210)[0], z: c(-150, -210)[1], label: 'looking back from the green: the Hollow and the falls' },
    ],
    idea: 'Into the jewel box',
    play: 'Straight up into the jewel box. A short iron climbs 13 m up a flowstone slope to a green on a mound in a pocket of the north wall, lined with crystal. From the tee you see the flag and the glow, not the putting surface. It plays a club longer, and the front of the green is a false front: come up short and the ball rolls back down the slope. Long is crystal wall, and a ball off it comes back at speed.',
    features: ['Green 13 m above the tee, on a flowstone mound: you see the flag, not the surface', 'False front: short rolls back down the slope', 'Crystal walls round the back and sides: hard, lively rebounds', 'Crystal sand in the back pot bunker', 'From the green: the whole Hollow and the falls below'],
  },
  /* 6 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Falls', par: 4, shape: 'Cape dogleg right, downhill across the inlet',
    line: [[0, 0], c(-20, -205), c(152, -114)],
    tees: { eagle: c(-198, -212), hawk: c(-178, -214), swift: c(-150, -218), wren: c(-112, -230) },
    floor: hollowFloor,
    islands: [isl(...c(-204, -214), 22, 20, -42), cap(c(-200, -212), c(-20, -208), 84, -42, -45), cap(c(-20, -208), c(95, -224), 56, -45, -48),
      cap(c(95, -224), c(140, -168), 44, -48, -54, { kind: 'rough' }), isl(...c(156, -112), 32, 28, -54),
      pad(...c(-198, -212), -41.4, 61), pad(...c(-178, -214), -41.8, 62), pad(...c(-150, -218), -42.3, 63), pad(...c(-112, -230), -43, 64)],
    landforms: [crest(...c(10, -207), c(-112, -230), 26, 70, 2.5)],
    fairways: [{ pts: [[...c(-110, -214), 30], [...c(-40, -206), 42], [...c(20, -205), 44], [...c(70, -212), 36], [...c(112, -200), 30]] }, { pts: [[...c(140, -172), 18], [...c(150, -142), 16]] }],
    green: { x: c(154, -112)[0], z: c(154, -112)[1], rx: 15, rz: 13, style: 'tilt', tilt: 1.5, apron: 7, runoff: true, from: c(-20, -205), pins: [c(154, -112), c(148, -106), c(160, -118), c(150, -120)] },
    bunkers: [{ x: c(132, -126)[0], z: c(132, -126)[1], rx: 5, rz: 4, style: 'flashed', toward: c(154, -112) }, { x: c(174, -98)[0], z: c(174, -98)[1], rx: 4, rz: 3, style: 'pot' }],
    groves: [{ x: c(186, -132)[0], z: c(186, -132)[1], r: 14, n: 8, kind: 'jungle' }],
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'jungle', x: c(186, -132)[0], z: c(186, -132)[1], r: 16, label: 'a small jungle under the shaft' },
      { type: 'stalactites', pts: [[...c(30, -178), -13, 1], [...c(62, -160), -15, 1], [...c(92, -144), -14, 1], [...c(118, -130), -12, 1]], label: 'stalactites over the hero line, tips 30–33 m above the gallery' },
      { type: 'text', x: c(58, -124)[0], z: c(58, -124)[1], label: 'the inlet: carry it, or go round' },
      { type: 'text', x: c(-110, -262)[0], z: c(-110, -262)[1], label: 'gallery ledge, 20 m above the floor' },
    ],
    idea: 'Across the inlet, beside the falls',
    play: 'The drive runs east along a gallery ledge high on the north wall, over a gentle crest that hides the landing area from the tee (a lantern on the crest shows the line). Then the hole turns right around the inlet, a bite of the chasm with the falls pouring into it from the Great Shaft. The hero second plays downhill, 9 m down across 110 yd of open air under a fringe of stalactites, with the falls pouring in just to the right. The safe way goes left round the top of the inlet and down a ramp to a lay-up, then a wedge. The green sits on a ledge beside the falls, lit by the shaft, with a small jungle under the light.',
    features: ['A gallery ledge 20 m above the Hollow floor', 'A crest on the drive: blind landing, lantern on the line', 'The hero second: downhill 9 m over 110 yd of the inlet', 'Stalactites over the hero line: a high shot can clip them', 'Safe way round the top and down a ramp to a lay-up', 'Green on a ledge beside the falls, in the shaft of sunlight; a small jungle under the opening (plays as trees)'],
  },
  /* 7 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Trestle', par: 5, shape: 'S-bend over the fissure, down the terraces',
    line: [[0, 0], c(232, -20), c(196, 150), c(262, 272)],
    tees: { eagle: c(200, -205), hawk: c(206, -170), swift: c(220, -135), wren: c(240, -95) },
    floor: hollowFloor,
    islands: [cap(c(200, -215), c(232, -20), 90, -52, -49), cap(c(214, 84), c(244, 240), 90, -49, -49), isl(...c(262, 276), 34, 30, -49),
      cap(c(250, -30), c(326, -40), 50, -49, -49), cap(c(326, -40), c(310, 110), 54, -49, -49), cap(c(310, 110), c(244, 170), 54, -49, -49),
      pad(...c(200, -205), -51.4, 71), pad(...c(206, -170), -50.8, 72), pad(...c(220, -135), -50.3, 73), pad(...c(240, -95), -49.6, 74)],
    landforms: [terrace(...c(213, 102), c(214, 62), 2.5, 200, 260), terrace(...c(211, 150), c(214, 62), 2.5, 200, 210), terrace(...c(222, 206), c(214, 62), 2, 200, 160)],
    fairways: [{ pts: [[...c(210, -120), 30], [...c(228, -60), 40], [...c(236, -10), 38]] }, { pts: [[...c(214, 70), 32], [...c(198, 130), 38], [...c(214, 190), 34], [...c(244, 240), 26]] },
      { pts: [[...c(326, -40), 26], [...c(338, 20), 24], [...c(334, 70), 24], [...c(310, 110), 26]] }],
    green: { x: c(262, 274)[0], z: c(262, 274)[1], rx: 16, rz: 13, style: 'redan', side: 1.5, apron: 7, runoff: true, from: c(214, 190), pins: [c(262, 274), c(256, 268), c(270, 280), c(254, 280)] },
    bunkers: [{ x: c(250, 70)[0], z: c(250, 70)[1], rx: 6, rz: 4, style: 'flashed', toward: c(200, -205) }, { x: c(244, 290)[0], z: c(244, 290)[1], rx: 6, rz: 4, style: 'flashed', toward: c(262, 274) }, { x: c(282, 260)[0], z: c(282, 260)[1], rx: 4, rz: 3, style: 'pot' }],
    roof: { y: HOLLOW.roofY },
    marks: [
      ...hollowMarks,
      { type: 'trestle', pts: [c(214, 12), c(212, 68)], label: 'the old rail trestle over the fissure' },
      { type: 'rails', pts: [c(150, -260), c(214, -60), c(214, 120), c(330, 330)], label: 'cart rails' },
      { type: 'text', x: c(330, -40)[0], z: c(330, -40)[1], label: 'safe: round the end of the fissure' },
      { type: 'text', x: c(160, 150)[0], z: c(160, 150)[1], label: 'rimstone terraces: three steps down to the green' },
    ],
    idea: 'Over the trestle or round the end',
    play: 'A three-shotter down the east side of the Hollow, climbing gently to a shelf north of the fissure, a slot of open air 25 m wide running in from the chasm. Second shot: carry it beside the old rail trestle onto a staircase of rimstone terraces that steps 7 m down to the green, or play round the far end of the fissure along the east wall and come down a ramp for a longer third. On the terraces, where the ball stops matters: on a flat tread or on a step with the ball below your feet. The green is a redan, kicking right to left, on the bottom terrace.',
    features: ['The fissure: 25 m wide, a carry of 30–40 yd on the hero line', 'Three rimstone terraces after the fissure, 7 m down in all', 'The old rail trestle spans it (scenery)', 'Safe route round the fissure\'s east end and down a ramp', 'An S-bend: right, then left', 'Redan green kicking right to left'],
  },
  /* 8 ---------------------------------------------------------------------------------------------- */
  {
    name: 'Glowworm Grotto', par: 4, shape: 'Short dogleg right, up over a blind crest',
    line: [[0, 0], [556, -772], [505, -600]],
    tees: { eagle: [452, -908], hawk: [470, -886], swift: [488, -862], wren: [512, -832] },
    islands: [cap([440, -915], [565, -760], 110, -57, -50), cap([565, -760], [495, -590], 110, -50, -40),
      pad(452, -908, -56, 81), pad(470, -886, -55, 82), pad(488, -862, -54, 83), pad(512, -832, -52.6, 84)],
    landforms: [crest(540, -792, [452, -908], 34, 100, 3.4), { type: 'ridge', x: 532, z: -680, from: [556, -772], length: 60, width: 26, height: 1.6 }],
    fairways: [{ pts: [[500, -846, 28], [528, -810, 34], [550, -770, 32], [540, -720, 26], [522, -665, 22]] }],
    green: { x: 504, z: -598, rx: 14, rz: 13, style: 'punchbowl', apron: 6, runoff: true, from: [540, -720], pins: [[504, -598], [498, -604], [510, -592], [498, -592]] },
    bunkers: [{ x: 575, z: -790, rx: 7, rz: 4, style: 'flashed', toward: [452, -908] }, { x: 520, z: -612, rx: 4, rz: 3, style: 'pot' }],
    groves: [{ x: 528, z: -745, r: 14, n: 6, kind: 'mushroom' }, { x: 482, z: -818, r: 12, n: 5, kind: 'mushroom' }, { x: 556, z: -690, r: 10, n: 4, kind: 'mushroom' }],
    roof: { y: 12 },
    marks: [
      { type: 'glowworms', poly: [[440, -930], [600, -790], [560, -600], [470, -580], [430, -760]], label: 'glowworm ceiling, 55–70 m up' },
      { type: 'mushrooms', pts: [[528, -745, 14], [482, -818, 12], [556, -690, 10]], label: 'giant glowing mushrooms (play as trees)' },
      { type: 'lanterns', pts: [[490, -620], [520, -620], [505, -580]], label: 'lanterns round the green' },
    ],
    idea: 'Under the stars, underground',
    play: 'The darkest hole: a short par 4 under a ceiling of glowworms that looks like a night sky. The drive climbs to a crest you cannot see over (the glow of the mushrooms beyond shows the line), and the fairway bends right around a stand of giant glowing mushrooms. Cut the corner over them and you have a flick; miss into them and they knock the ball down like trees. The approach plays up a ridge-backed fairway to a punchbowl green ringed by lanterns that gathers anything close.',
    features: ['Glowworm ceiling 55–70 m up', 'A blind crest on the drive, 3.5 m high', 'Giant glowing mushrooms inside the corner: they play as trees', 'A cut over the mushrooms leaves 80 yd', 'Uphill 14 m tee to green; a punchbowl green ringed by lanterns'],
  },
  /* 9 ---------------------------------------------------------------------------------------------- */
  {
    name: 'The Cenote', par: 4, shape: 'Uphill dogleg left, up onto the collapse cone', corridor: 60,
    line: [[0, 0], [402, -386], [252, -256]],
    tees: { eagle: [476, -575], hawk: [466, -545], swift: [452, -505], wren: [440, -470] },
    islands: [cap([470, -580], [405, -385], 110, -40, -28), cap([405, -385], [262, -262], 110, -28, -16),
      isl(250, -252, 64, 64, -16), pad(476, -575, -39.3, 91), pad(466, -545, -37.5, 92), pad(452, -505, -35, 93), pad(440, -470, -33, 94)],
    landforms: [{ type: 'mound', x: 252, z: -254, rot: 0.8, length: 125, width: 125, height: 11 }],
    fairways: [{ pts: [[462, -520, 28], [440, -460, 34], [410, -400, 34], [372, -350, 28], [320, -305, 24]] }],
    water: [{ x: 292, z: -214, rx: 16, rz: 12, rot: 0.5, depth: 2.5 }],
    green: { x: 246, z: -260, rx: 16, rz: 14, style: 'tiered', tiers: [{ b: 5, step: 0.7 }], apron: 8, runoff: true, from: [330, -310], pins: [[246, -260], [240, -254], [252, -268], [240, -266]] },
    bunkers: [{ x: 386, z: -350, rx: 8, rz: 4, style: 'flashed', toward: [476, -575] }, { x: 226, z: -270, rx: 5, rz: 4, style: 'flashed', toward: [246, -260] }],
    roof: { y: 30, open: { x: 250, z: -250, r: 68 } },
    marks: [
      { type: 'skylight', x: 250, z: -250, r: 68, label: 'the cenote: open sky, walls 35 m to the rim' },
      { type: 'falls', pts: [[296, -196], [306, -208], [312, -222]], top: 25, label: 'falls pour in from the rim' },
      { type: 'clubhouse', x: 210, z: -320, label: 'clubhouse on the rim above' },
      { type: 'ferns', pts: [[226, -206, 10], [205, -238, 8]], label: 'vines and ferns under the rim' },
      { type: 'text', x: 300, z: -300, label: 'the collapse cone: 11 m up' },
    ],
    idea: 'Back into the light',
    play: 'The climb home. The drive goes up a rising hall, and the fairway bends left at the top where daylight starts to show. The approach plays up out of the dark into the cenote, a round sinkhole open to the sky, onto the cone of rubble that fell when its roof collapsed: the green sits near the top of the cone, so anything short runs back down. Vines hang down the walls and a waterfall pours in from the rim into a pool at the foot of the cone, right. The clubhouse looks down from the rim.',
    features: ['Uphill 33 m tee to green: the longest-playing hole', 'Dogleg left at the top of the hall', 'The approach climbs onto the collapse cone, from shadow into full daylight', 'Short runs back down the cone', 'A pool at the foot of the cone, right, fed by falls from the rim', 'Two-tier green under open sky; clubhouse on the rim above'],
  },
];
// fairway widths above are roughly half-widths drawn generously; trim them to 55-65 m landing areas
HOLES.forEach(h => (h.fairways || []).forEach(f => f.pts.forEach(p => { p[2] = Math.round(p[2] * 0.75); })));
