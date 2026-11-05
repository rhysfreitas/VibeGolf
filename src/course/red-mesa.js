// Red Mesa: nine holes across and between red-rock mesas, high on the plateau.
// Same format as aerie.js, plus what desert holes need (see terrain.js for the shapes):
//   line      the playing line from the back tee to the pin; tees and yardages are measured on it
//   heading   compass bearing of the hole (tee to green), for the sun and the wind
//   tees      { canyon, mesa, sage, lizard: [x, z] }; yards { same keys: card yardage }
//   floor     the canyon floor { y, relief, solid, washes, gorges }; fairways / sand painted on any ground
//   islands   kinds 'mesa' (playable top), 'rock' (cliffs and walls), plus the Aerie kinds;
//             slope { from, to } makes a ramp
//   green, bunkers, landforms, water   shaped features (features.js); green.pins are picked per round
//   rocks     arches and hoodoos the ball can hit; props: scenery placed by type
// The course builder will read and write this same shape.

export const COURSE = {
  id: 'redmesa', name: 'Red Mesa', theme: 'mesa', altFt: 5200,
  blurb: 'Nine holes across and between red-rock mesas. Miss off the top and you play it from the canyon floor.',
  voidText: ['Into the gorge', 'Ends in the gorge'],
  signature: { time: 'golden', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'mild' },
  teeSets: [
    { id: 'canyon', name: 'Canyon', color: '#b5532f', minDrive: 260 },
    { id: 'mesa', name: 'Mesa', color: '#d9a521', minDrive: 220 },
    { id: 'sage', name: 'Sage', color: '#6f9a5a', minDrive: 185 },
    { id: 'lizard', name: 'Lizard', color: '#dcc79c', minDrive: 0 },
  ],
};

/* ---------- helpers for laying out tees on the playing line ---------- */
function lineLen(L) { let s = 0; for (let i = 1; i < L.length; i++) s += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); return s; }
function along(L, d) { // point d metres along the line from its start
  for (let i = 1; i < L.length; i++) {
    const [ax, az] = L[i - 1], [bx, bz] = L[i], s = Math.hypot(bx - ax, bz - az);
    if (d <= s || i === L.length - 1) { const t = d / s; return [ax + (bx - ax) * t, az + (bz - az) * t]; }
    d -= s;
  }
  return L.at(-1);
}
const YD = 0.9144;
// forward tees: each set moves up the line by the difference in card yardage; nudge = sideways metres
function teesOn(line, yards, nudge = {}) {
  const full = lineLen(line), tees = {};
  for (const [id, y] of Object.entries(yards)) {
    const p = along(line, Math.max(0, full - y * YD));
    tees[id] = [+(p[0] + (nudge[id] || 0)).toFixed(1), +p[1].toFixed(1)];
  }
  return tees;
}
// a tee straight-line `yards` from the pin, at sideways position x (for holes measured point to point)
function teeFrom(pin, yards, x) { const d = yards * YD, dx = x - pin[0]; return [x, +(pin[1] + Math.sqrt(Math.max(0, d * d - dx * dx))).toFixed(1)]; }

/* ---------- the holes ---------- */
const L1 = [[0, 0], [-8, -165], [8, -268], [48, -350]];
const L2 = [[0, 0], [0, -120], [3, -250], [2, -375]];
const P3 = [2, -205.7];
const L4 = [[0, 0], [0, -174], [-20, -258], [-60, -322]];
const L5 = [[0, 0], [6, -185], [38, -280], [44, -370], [26, -484]];
const P6 = [0, -160];
const L7 = [[-1, -23], [-4, -160], [4, -315.5]];
const L8 = [[0, 0], [-4, -200], [8, -280], [-28, -386]];
const L9 = [[0, 0], [-4, -220], [30, -340], [-6, -462]];

export const HOLES = [
  {
    name: 'Rimrock', par: 4, heading: 4,
    yards: { canyon: 395, mesa: 355, sage: 310, lizard: 240 },
    blurb: 'A Cape along the rim: the hole bends right around a notch of canyon to a green out on a promontory. Bite off the corner for a short approach over the notch, or play safe left and come in longer. The landing area tilts toward the edge, and a miss right drops forty metres to the canyon floor.',
    line: L1, pin: [52, -352],
    tees: teesOn(L1, { canyon: 395, mesa: 355, sage: 310, lizard: 240 }, { mesa: -1, sage: -2, lizard: -2 }),
    floor: { y: -40, relief: 2.2 },
    islands: [
      { x: -45, z: -175, rx: 86, rz: 232, p: 3.2, top: 0, depth: 40, kind: 'mesa', seed: 1, relief: 1.1, trees: 70 },
      { x: 60, z: -354, rx: 34, rz: 31, p: 2.6, top: 0, depth: 40, kind: 'mesa', seed: 2, relief: 0.6, trees: 6 },
    ],
    fairways: [{ pts: [[-8, -116, 11, 11], [-8, -165, 24, 13], [-2, -220, 27, 15], [8, -266, 19, 11], [22, -294, 11, 9]] }, { pts: [[36, -330, 9, 9], [42, -338, 11, 11]] }],
    green: { x: 52, z: -352, rx: 14, rz: 12, style: 'plateau', raise: 0.9, falseFront: 0.6, side: -1.2, pins: [[52, -352], [49.9, -358.7], [55.5, -345.7], [59.2, -355]] },
    bunkers: [
      { x: 38.2, z: -361.6, rx: 6, rz: 4.5, style: 'flashed' }, { x: 41.2, z: -346.4, rx: 4.5, rz: 2.6, style: 'pot' },
      { x: 22, z: -236, rx: 9, rz: 5, rot: 0.5, style: 'flashed', toward: [0, 0] }, { x: 17, z: -284, rx: 13, rz: 7, rot: 0.3, style: 'waste' }, { x: -16, z: -293, rx: 7, rz: 4.5, style: 'flashed', toward: [0, 0] },
    ],
    landforms: [
      { type: 'tilt', x: -2, z: -225, length: 90, width: 56, grade: -4 },
      { type: 'mound', x: -32, z: -205, length: 30, width: 24, height: 1.6 },
      { type: 'swale', x: 43.6, z: -336.1, rot: 0.483 + Math.PI / 2, length: 30, width: 10, height: 0.6 },
    ],
    targets: [{ name: 'Safe left', x: -8, z: -222 }, { name: 'Bite the corner', x: 12, z: -270 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'windmill', x: 16, z: 14, rot: 0.4 }],
    glyph: 'spiral',
  },
  {
    name: 'The Chute', par: 4, heading: 82,
    yards: { canyon: 410, mesa: 370, sage: 320, lizard: 250 },
    blurb: 'Down a sandstone ramp between two plateaus into a box canyon. A hogback splits the ramp, and a steeper slot at the bottom runs a good drive on. The green is a punchbowl walled in on three sides.',
    line: L2, pin: [1, -374],
    tees: teesOn(L2, { canyon: 410, mesa: 370, sage: 320, lizard: 250 }),
    floor: { y: -32, relief: 1.4 }, floorPlay: true, // the box canyon floor is where the hole ends
    islands: [
      { x: 0, z: 32, rx: 62, rz: 76, p: 3, top: 0, depth: 32, kind: 'mesa', seed: 21, trees: 16 },
      { x: 0, z: -150, rx: 35, rz: 122, p: 3.6, top: 0, depth: 32, kind: 'mesa', seed: 22, relief: 0.5, slope: { from: [0, -42, 0], to: [0, -236, -32] }, trees: 0 },
      { x: -88, z: -170, rx: 56, rz: 178, p: 3, top: 14, depth: 46, kind: 'rock', seed: 24, trees: 10 },
      { x: 88, z: -170, rx: 56, rz: 178, p: 3, top: 16, depth: 48, kind: 'rock', seed: 25, trees: 10 },
      { x: -72, z: -380, rx: 42, rz: 72, p: 2.6, top: 12, depth: 44, kind: 'rock', seed: 26 },
      { x: 74, z: -378, rx: 42, rz: 72, p: 2.6, top: 10, depth: 42, kind: 'rock', seed: 27 },
      { x: 0, z: -442, rx: 84, rz: 44, p: 2.6, top: 13, depth: 45, kind: 'rock', seed: 28 },
    ],
    fairways: [{ pts: [[-9, -112, 8, 5], [-11, -160, 10, 5], [-9, -205, 10, 6]] }, { pts: [[9, -112, 5, 8], [11, -160, 5, 10], [9, -205, 6, 10]] }, { pts: [[1, -200, 20, 20], [2, -235, 24, 24], [3, -280, 18, 16], [2, -345, 11, 11]] }],
    green: { x: 1, z: -374, rx: 14, rz: 13, style: 'punchbowl', pins: [[1, -374], [-6, -369], [7, -379], [-4, -382]] },
    bunkers: [{ x: -16, z: -362, rx: 5, rz: 4, style: 'grass' }, { x: 17, z: -381, rx: 4.5, rz: 3.5, style: 'pot' }, { x: -18, z: -268, rx: 8, rz: 5, style: 'flashed' }],
    landforms: [
      { type: 'ridge', x: 1, z: -160, length: 110, width: 14, height: 1.3 },
      { type: 'step', x: 2, z: -222, length: 26, width: 40, height: 3, run: 12 },
    ],
    targets: [{ name: 'Down the chute', x: 2, z: -235 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'swallows', x: 0, z: -390 }],
    glyph: 'snake',
  },
  {
    name: 'Kestrel', par: 3, heading: 192,
    yards: { canyon: 225, mesa: 190, sage: 160, lizard: 120 },
    blurb: 'The big drop, to a Redan: the green is angled away from you and tilts away to the left, with a deep pot bunker front left. The safe play lands short right and feeds down onto it. Short is a sandy wash; long is boulders.',
    pin: P3,
    tees: { canyon: [0, 0], mesa: teeFrom(P3, 190, -16), sage: teeFrom(P3, 160, 15), lizard: teeFrom(P3, 120, -11) },
    floor: { y: -70, relief: 2.6, washes: [{ pts: [[-140, -160], [-50, -172], [10, -180], [70, -176], [150, -166]], w: 15 }] },
    islands: [
      { x: 0, z: 2, rx: 8, rz: 9, p: 2.2, top: 0, depth: 70, kind: 'tee', seed: 31, lip: 0.2, rail: true },
      { x: -16, z: -32.5, rx: 8, rz: 8.5, p: 2.2, top: -15, depth: 55, kind: 'tee', seed: 32, lip: 0.2 },
      { x: 15, z: -60.6, rx: 8, rz: 8.5, p: 2.2, top: -35, depth: 35, kind: 'tee', seed: 33, lip: 0.2 },
      { x: -11, z: -97, rx: 9, rz: 9, p: 2.2, top: -50, depth: 20, kind: 'tee', seed: 34, lip: 0.2 },
      { x: 0, z: -330, rx: 180, rz: 66, p: 2.6, top: 12, depth: 82, kind: 'rock', seed: 36 },
      { x: -175, z: -120, rx: 80, rz: 180, p: 2.6, top: 6, depth: 76, kind: 'rock', seed: 37 },
      { x: 180, z: -120, rx: 80, rz: 180, p: 2.6, top: 8, depth: 78, kind: 'rock', seed: 38 },
    ],
    fairways: [{ pts: [[9, -184, 8, 11], [11, -194, 8, 10]] }],
    green: { x: 2, z: -206, rx: 11, rz: 20, rot: -0.75, style: 'redan', raise: 0.3, pins: [P3, [8.8, -198.7], [-3.4, -211.8], [-7.5, -216.2]] },
    bunkers: [{ x: -10, z: -194, rx: 6, rz: 4, style: 'pot', depth: 1.8, toward: [2, -206] }, { x: 16, z: -214, rx: 3.5, rz: 5, style: 'grass' }],
    landforms: [{ type: 'mound', x: 15, z: -194, length: 18, width: 14, height: 1.2 }],
    targets: [{ name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'kestrels', x: 0, z: -110, y: -35 }, { type: 'boulders', x: 2, z: -248, w: 120, d: 14, n: 26 }],
    glyph: 'bird',
  },
  {
    name: "Needle's Eye", par: 4, heading: 250,
    yards: { canyon: 370, mesa: 335, sage: 290, lizard: 225 },
    blurb: 'Through a huge natural arch about 190 yards out, then the fairway turns left around a bunker group to a two-tier green. From the right side you can see the back tier and attack it; from the left you can\'t.',
    line: L4, pin: [-57.2, -322.9],
    tees: teesOn(L4, { canyon: 370, mesa: 335, sage: 290, lizard: 225 }),
    floor: { y: -35, relief: 2 },
    islands: [
      { x: 0, z: 22, rx: 56, rz: 70, p: 3, top: 0, depth: 35, kind: 'mesa', seed: 41, trees: 12 },
      { x: -10, z: -232, rx: 92, rz: 206, p: 3, top: 4, depth: 39, kind: 'mesa', seed: 42, slope: { from: [0, -40, 0], to: [0, -150, 4] }, trees: 50 },
    ],
    fairways: [{ pts: [[0, -108, 12, 12], [0, -174, 12, 12], [-4, -212, 14, 24], [-16, -248, 12, 24], [-32, -280, 10, 16], [-46, -303, 10, 10]] }],
    green: { x: -62, z: -327, rx: 16, rz: 13, style: 'tiered', tiers: [{ b: 1, step: 0.8 }], pins: [[-57.2, -322.9], [-69.1, -330.9], [-58.6, -334.9], [-65.4, -319.1]] },
    bunkers: [
      { x: -32, z: -240, rx: 9, rz: 6, rot: 0.5, style: 'flashed', toward: [0, -180] }, { x: -44, z: -256, rx: 6, rz: 4, rot: 0.5, style: 'flashed', toward: [0, -180] },
      { x: -74, z: -319.7, rx: 5, rz: 6, style: 'grass' }, { x: -49.6, z: -324, rx: 4, rz: 3, style: 'pot' }, { x: 19, z: -238, rx: 6, rz: 5, style: 'flashed', toward: [0, -100] },
    ],
    landforms: [
      { type: 'ridge', x: 12, z: -236, rot: -0.3, length: 50, width: 16, height: 1.4 },
      { type: 'swale', x: -52.6, z: -311.6, rot: -0.547 + Math.PI / 2, length: 34, width: 10, height: 0.7 },
    ],
    rocks: [{ type: 'arch', x: 0, z: -174, rot: 0, w: 34, h: 32, t: 9, d: 14 }],
    targets: [{ name: 'Through the arch', x: -4, z: -218 }, { name: 'Right side', x: 2, z: -246 }, { name: 'Green', pin: true }],
    drops: [],
    props: [],
    glyph: 'sun',
  },
  {
    name: 'Switchback', par: 5, heading: 348,
    yards: { canyon: 535, mesa: 485, sage: 425, lizard: 330 },
    blurb: 'A double dogleg along the foot of a long plateau wall, the fairway tilting toward the cliff. A band of desert waste crosses the second-shot zone: carry it or lay up. The crowned green sits in an alcove in the rock.',
    line: L5, pin: [26, -485],
    tees: teesOn(L5, { canyon: 535, mesa: 485, sage: 425, lizard: 330 }),
    floor: { y: 0, relief: 1.6, washes: [{ pts: [[46, 60], [42, -110], [62, -215], [84, -300], [92, -385], [80, -445], [96, -540]], w: 18 }] },
    islands: [
      { x: -82, z: -40, rx: 56, rz: 130, p: 3.4, top: 55, depth: 55, kind: 'rock', seed: 51 },
      { x: -70, z: -238, rx: 62, rz: 92, p: 3, top: 58, depth: 58, kind: 'rock', seed: 52 },
      { x: -42, z: -372, rx: 56, rz: 72, p: 3, top: 54, depth: 54, kind: 'rock', seed: 53 },
      { x: -46, z: -478, rx: 46, rz: 62, p: 2.8, top: 56, depth: 56, kind: 'rock', seed: 54 },
      { x: 22, z: -562, rx: 92, rz: 56, p: 2.8, top: 57, depth: 57, kind: 'rock', seed: 55 },
      { x: 92, z: -505, rx: 36, rz: 42, p: 2.6, top: 40, depth: 40, kind: 'rock', seed: 56 },
    ],
    fairways: [{ pts: [[1, -112, 12, 12], [5, -170, 16, 24], [18, -232, 18, 20], [34, -282, 16, 16], [38, -308, 12, 12]] }, { pts: [[43, -344, 20, 18], [44, -375, 22, 16], [38, -420, 14, 12], [33, -452, 12, 12]] }],
    green: { x: 26, z: -485, rx: 15, rz: 13, style: 'crowned', pins: [[26, -485], [20, -489], [32, -481], [24, -479]] },
    bunkers: [
      { x: 40, z: -330, rx: 28, rz: 6, rot: 0.1, style: 'waste' },
      { x: 43, z: -476, rx: 5, rz: 4, style: 'flashed' }, { x: 12, z: -495, rx: 4, rz: 3.5, style: 'pot' }, { x: -6, z: -300, rx: 6, rz: 5, style: 'flashed', toward: [5, -170] },
    ],
    landforms: [
      { type: 'tilt', x: 10, z: -215, length: 80, width: 44, grade: 4 },
      { type: 'mound', x: 58, z: -262, length: 26, width: 18, height: 1.8 },
      { type: 'ridge', x: 44, z: -405, rot: 0.2, length: 40, width: 12, height: 0.9 },
    ],
    targets: [{ name: 'Fairway', x: 9, z: -212 }, { name: 'Lay up', x: 40, z: -302 }, { name: 'Over the waste', x: 44, z: -382 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'mine', x: 0, z: -236, rot: Math.PI / 2 }],
    glyph: 'hand',
  },
  {
    name: 'Trestle', par: 3, heading: 96,
    yards: { canyon: 175, mesa: 150, sage: 130, lizard: 100 },
    blurb: 'Mesa to mesa over a deep gorge, the one true penalty on the course, to a Biarritz green split by a deep swale. Front pin: land short of the swale. Back pin: carry it. The old railroad crosses the gorge on a trestle to your right.',
    pin: P6,
    tees: { canyon: [0, 0], mesa: teeFrom(P6, 150, 3), sage: teeFrom(P6, 130, -22), lizard: [-84.5, -125] },
    floor: { y: -140, relief: 4, solid: false },
    islands: [
      { x: 0, z: 40, rx: 62, rz: 86, p: 3.2, top: 0, depth: 140, kind: 'mesa', seed: 61, trees: 14 },
      { x: -25, z: -38, rx: 18, rz: 22, p: 2.6, top: 0, depth: 140, kind: 'mesa', seed: 62, relief: 0.4 },
      { x: -20, z: -176, rx: 102, rz: 72, p: 3, top: -3, depth: 137, kind: 'mesa', seed: 63, trees: 26 },
    ],
    fairways: [{ pts: [[-2, -112, 10], [-1, -136, 14]] }],
    green: { x: 0, z: -170, rx: 13, rz: 22, rot: 0, style: 'biarritz', pins: [P6, [-3, -180], [5, -155], [4, -186]] },
    bunkers: [{ x: -18, z: -170, rx: 3, rz: 14, style: 'flashed', toward: [0, -170] }, { x: 17, z: -166, rx: 3, rz: 12, style: 'flashed', toward: [0, -170] }],
    targets: [{ name: 'Green', pin: true }],
    drops: [[0, -120], [-28, -116]],
    props: [{ type: 'trestle', x: 52, z0: 260, z1: -520, y: 1.2 }],
    glyph: 'train',
  },
  {
    name: 'Hoodoos', par: 4, heading: 10,
    yards: { canyon: 320, mesa: 295, sage: 260, lizard: 205 },
    blurb: 'A drivable par four on a bench scattered with hoodoos, capped spires that knock a ball down. Thread a gap and you can reach; the safe play is a flat layup area out to the left. The green is the most contoured on the course, with a spring pool to its right and a balanced rock beyond.',
    line: L7, pin: [-4, -318],
    tees: teesOn(L7, { canyon: 320, mesa: 295, sage: 260, lizard: 205 }),
    floor: { y: -25, relief: 1.8 },
    islands: [
      { x: 0, z: -165, rx: 88, rz: 232, p: 3, top: 0, depth: 25, kind: 'mesa', seed: 71, trees: 40 },
    ],
    fairways: [{ pts: [[-2, -100, 12, 12], [-3, -150, 18, 18], [-1, -205, 16, 20], [1, -250, 14, 14], [3, -292, 10, 10]] }, { pts: [[-40, -176, 12, 12], [-50, -200, 16, 16], [-55, -222, 12, 12]] }],
    green: { x: 4, z: -318, rx: 17, rz: 14, style: 'tiered', tiers: [{ b: 0, step: 0.6, axis: 'u' }], side: 1, pins: [[-4, -318], [10, -315], [10, -326], [9, -308]] },
    bunkers: [{ x: -12, z: -305, rx: 4.5, rz: 3.5, style: 'flashed' }, { x: -15, z: -327, rx: 4, rz: 5, style: 'grass' }],
    water: [{ x: 34, z: -312, rx: 9, rz: 7 }],
    rocks: [
      { type: 'hoodoo', x: -31, z: -176, r: 3, h: 18 }, { type: 'hoodoo', x: -9, z: -192, r: 2.6, h: 12 },
      { type: 'hoodoo', x: 15, z: -181, r: 3.2, h: 22 }, { type: 'hoodoo', x: 34, z: -203, r: 2.8, h: 15 },
      { type: 'hoodoo', x: -24, z: -217, r: 3.4, h: 25 }, { type: 'hoodoo', x: 6, z: -227, r: 2.5, h: 9 },
      { type: 'hoodoo', x: 26, z: -242, r: 3, h: 20 }, { type: 'hoodoo', x: -40, z: -246, r: 2.6, h: 14 },
      { type: 'hoodoo', x: -9, z: -259, r: 2.2, h: 7 }, { type: 'hoodoo', x: 41, z: -267, r: 2.8, h: 12 },
      { type: 'hoodoo', x: -58, z: -128, r: 3.6, h: 21 }, { type: 'hoodoo', x: 56, z: -146, r: 3, h: 16 },
      { type: 'hoodoo', x: 62, z: -292, r: 3.4, h: 19 }, { type: 'hoodoo', x: -52, z: -300, r: 2.8, h: 11 },
    ],
    targets: [{ name: 'Layup left', x: -50, z: -200 }, { name: 'Through the gap', x: 3, z: -238 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'balanced', x: 36, z: -334 }],
    glyph: 'spirals',
  },
  {
    name: 'Dry Wash', par: 4, heading: 168,
    yards: { canyon: 430, mesa: 380, sage: 330, lizard: 255 },
    blurb: 'On the canyon floor along a dry riverbed. The wash crosses the fairway twice as desert waste, a hogback splits the landing area, and the green is an Eden: back to front, deep bunkers either side of the front, and a spring pond behind it under the cottonwoods.',
    line: L8, pin: [-28, -388],
    tees: teesOn(L8, { canyon: 430, mesa: 380, sage: 330, lizard: 255 }),
    floor: { y: 0, relief: 1.5, washes: [{ pts: [[-80, -40], [-34, -104], [18, -132], [48, -190], [32, -255], [-16, -288], [-58, -318]], w: 17 }] },
    islands: [
      { x: -134, z: -210, rx: 72, rz: 320, p: 3, top: 48, depth: 48, kind: 'rock', seed: 81 },
      { x: 136, z: -210, rx: 72, rz: 320, p: 3, top: 52, depth: 52, kind: 'rock', seed: 82 },
      { x: 0, z: -560, rx: 130, rz: 60, p: 2.6, top: 50, depth: 50, kind: 'rock', seed: 83 },
    ],
    fairways: [{ pts: [[-3, -142, 16, 20], [-5, -180, 24, 24], [-2, -240, 22, 20], [2, -262, 14, 10]] }, { pts: [[0, -312, 14, 12], [-10, -345, 15, 15], [-19, -368, 11, 11]] }],
    green: { x: -28, z: -388, rx: 15, rz: 13, style: 'tilt', tilt: 2.6, pins: [[-28, -388], [-33.7, -392.4], [-22, -385.8], [-30.8, -380.7]] },
    bunkers: [{ x: -34, z: -371.2, rx: 5, rz: 4, style: 'pot', depth: 1.7 }, { x: -13.8, z: -380.1, rx: 3.6, rz: 3, style: 'pot', depth: 1.6 }],
    water: [{ x: -45, z: -405, rx: 12, rz: 9, rot: 0.3 }],
    landforms: [{ type: 'ridge', x: -5, z: -215, length: 60, width: 12, height: 1.1 }],
    targets: [{ name: 'Fairway', x: -5, z: -228 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'fossil', x: -63, z: -236, rot: Math.PI / 2 }, { type: 'cottonwoods' }, { type: 'debris' }],
    glyph: 'lizard',
  },
  {
    name: 'The Climb', par: 5, heading: 262,
    yards: { canyon: 515, mesa: 460, sage: 400, lizard: 305 },
    blurb: 'The walk home: three tiers stepping back up to the top, each shot up a level. The last rise hides the green, so the third is blind, and the plateau green has a false front: come up short and it rolls back toward the ramp. The clubhouse and a window arch wait on the summit.',
    line: L9, pin: [-6, -468],
    tees: teesOn(L9, { canyon: 515, mesa: 460, sage: 400, lizard: 305 }),
    floor: { y: 0, relief: 1.5 },
    islands: [
      { x: 0, z: -332, rx: 82, rz: 112, p: 3.2, top: 14, depth: 14, kind: 'mesa', seed: 91, trees: 30 },
      { x: 0, z: -228, rx: 26, rz: 30, p: 3, top: 0, depth: 14, kind: 'mesa', seed: 92, relief: 0.4, slope: { from: [-3, -206, 0], to: [3, -252, 14] }, trees: 0 },
      { x: -10, z: -488, rx: 76, rz: 72, p: 3, top: 32, depth: 32, kind: 'mesa', seed: 93, trees: 18 },
      { x: 6, z: -420, rx: 22, rz: 28, p: 3, top: 14, depth: 18, kind: 'mesa', seed: 94, relief: 0.4, slope: { from: [12, -400, 14], to: [1, -440, 32] }, trees: 0 },
      { x: 150, z: -260, rx: 60, rz: 230, p: 3, top: 44, depth: 44, kind: 'rock', seed: 95 },
      { x: -150, z: -240, rx: 60, rz: 230, p: 3, top: 40, depth: 40, kind: 'rock', seed: 96 },
    ],
    fairways: [{ pts: [[-1, -108, 14, 16], [-4, -160, 24, 20], [-3, -196, 12, 12]] }, { pts: [[-2, -212, 10, 10], [3, -250, 11, 11]] }, { pts: [[6, -262, 16, 22], [20, -298, 20, 18], [28, -336, 14, 14], [20, -372, 10, 10]] }, { pts: [[12, -404, 9, 9], [1, -446, 11, 11]] }],
    green: { x: -6, z: -468, rx: 15, rz: 12, style: 'plateau', raise: 1.2, falseFront: 0.6, pins: [[-6, -468], [-10, -474], [-2, -463], [-4, -476]] },
    bunkers: [
      { x: -24, z: -462, rx: 5, rz: 4, style: 'flashed' }, { x: 10, z: -476, rx: 4, rz: 3.5, style: 'pot' },
      { x: 20, z: -236, rx: 6, rz: 5, style: 'grass', toward: [0, -150] }, { x: 26, z: -418, rx: 5, rz: 6, style: 'grass', toward: [24, -330] }, { x: -2, z: -330, rx: 8, rz: 5, rot: -0.3, style: 'flashed', toward: [6, -262] },
    ],
    landforms: [{ type: 'tilt', x: 22, z: -316, length: 70, width: 50, grade: -3 }],
    targets: [{ name: 'Lower fairway', x: -3, z: -182 }, { name: 'Middle tier', x: 24, z: -316 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'clubhouse', x: 32, z: -512, rot: -0.3 }, { type: 'observatory', x: -46, z: -506 }, { type: 'windowArch', x: -15, z: -610, w: 48, h: 72, t: 14, d: 16 }],
    glyph: 'stars',
  },
];
