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
const P3 = [-3, -212];
const L4 = [[0, 0], [0, -174], [-20, -258], [-60, -322]];
const L5 = [[0, 0], [6, -185], [38, -280], [44, -370], [26, -484]];
const P6 = [0, -160];
const L7 = [[-1, -23], [-6, -180], [18, -312]];
const L8 = [[0, 0], [-4, -200], [8, -290], [22, -412]];
const L9 = [[0, 0], [-4, -220], [30, -340], [-6, -462]];

export const HOLES = [
  {
    name: 'Rimrock', par: 4, heading: 4,
    yards: { canyon: 395, mesa: 355, sage: 310, lizard: 240 },
    blurb: 'A Cape along the rim: the hole bends right around a notch of canyon to a green out on a promontory. Bite off the corner for a short approach over the notch, or play safe left and come in longer. The fairway steps down a low ledge toward the edge, a house-sized boulder sits off the left of the landing area, and a miss right drops forty metres to the canyon floor.',
    line: L1, pin: [52, -352],
    tees: { ...teesOn(L1, { canyon: 395, mesa: 355, sage: 310, lizard: 240 }, { mesa: -1, sage: -2 }), lizard: [14, -151] },
    floor: { y: -40, relief: 2.2 },
    islands: [
      { x: -45, z: -175, rx: 86, rz: 232, p: 3.2, top: 0, depth: 40, kind: 'mesa', seed: 1, relief: 1.1, trees: 70 },
      { x: 60, z: -354, rx: 34, rz: 31, p: 2.6, top: 0, depth: 40, kind: 'mesa', seed: 2, relief: 0.6, trees: 6 },
      // more to look at: outcrops on the mesa top to the left, near and far
      { x: -112, z: -128, rx: 16, rz: 26, rot: 0.3, p: 2.6, top: 9, depth: 49, kind: 'rock', seed: 3 },
      { x: -100, z: -292, rx: 13, rz: 15, p: 2.4, top: 16, depth: 56, kind: 'rock', seed: 4 },
      { x: -150, z: -420, rx: 34, rz: 22, rot: -0.4, p: 3, top: 30, depth: 70, kind: 'rock', seed: 5 },
    ],
    fairways: [{ pts: [[-8, -116, 11, 11], [-8, -165, 24, 13], [-2, -220, 27, 15], [8, -266, 19, 11], [22, -294, 11, 9]] }, { pts: [[36, -330, 9, 9], [42, -338, 11, 11]] }],
    green: { x: 52, z: -352, rx: 14, rz: 12, style: 'plateau', raise: 0.9, falseFront: 0.6, side: -1.2, pins: [[52, -352], [49.9, -358.7], [55.5, -345.7], [59.2, -355]] },
    bunkers: [
      { x: 38.2, z: -361.6, rx: 6, rz: 4.5, style: 'flashed' }, { x: 41.2, z: -346.4, rx: 4.5, rz: 2.6, style: 'pot' },
      { x: 22, z: -236, rx: 9, rz: 5, rot: 0.5, style: 'flashed', toward: [0, 0] }, { x: 17, z: -284, rx: 13, rz: 7, rot: 0.3, style: 'waste' }, { x: -16, z: -293, rx: 7, rz: 4.5, style: 'flashed', toward: [0, 0] },
    ],
    landforms: [
      { type: 'tilt', x: -2, z: -225, length: 90, width: 56, grade: -4 },
      // a low ledge across the landing area: safe left stays up top; the corner side is a level lower
      { type: 'step', x: 0, z: -246, rot: 0.785, length: 8, width: 150, height: 1.8, run: 400 },
      { type: 'swale', x: 43.6, z: -336.1, rot: 0.483 + Math.PI / 2, length: 30, width: 10, height: 0.6 },
    ],
    // a house-sized boulder off the left of the landing area, with rock spilled around its foot
    rocks: [
      { type: 'boulder', x: -50, z: -207, r: 11, h: 15, rot: 0.5, pe: 3.2 },
      // spires down on the canyon floor to the right, their tops just over the rim
      { type: 'hoodoo', x: 96, z: -150, r: 4.2, h: 42 }, { type: 'hoodoo', x: 114, z: -178, r: 5, h: 50 }, { type: 'hoodoo', x: 103, z: -207, r: 3.6, h: 37 },
      { type: 'hoodoo', x: 130, z: -236, r: 4.6, h: 46 }, { type: 'hoodoo', x: 94, z: -262, r: 3.4, h: 33 },
    ],
    rockfalls: [{ x: -45, z: -207, rx: 14, rz: 12, toward: [-56, -208], height: 2.6, n: 26, size: [0.4, 2] }],
    targets: [{ name: 'Safe left', x: -8, z: -222 }, { name: 'Bite the corner', x: 12, z: -270 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'windmill', x: 16, z: 14, rot: 0.4 }],
    glyph: 'spiral',
  },
  {
    name: 'The Chute', par: 4, heading: 82,
    yards: { canyon: 410, mesa: 370, sage: 320, lizard: 260 },
    blurb: 'Down a sandstone ramp into a box canyon that opens up at the fork. A grove of cottonwoods splits the landing area: left of it, a wide plateau a few metres up with rock spilling down its face; right, the lower fairway with a speed slot. A dry wash crosses short of the green where the canyon walls are cut back. The green falls from a rockfall on the left toward a pot bunker on the right.',
    line: L2, pin: [1, -374],
    tees: { ...teesOn(L2, { canyon: 410, mesa: 370, sage: 320 }), lizard: [46, -146] },
    floor: { y: -32, relief: 1.4, washes: [{ pts: [[-170, -358], [-110, -345], [-60, -330], [-20, -326], [20, -322], [70, -315], [120, -312], [170, -318]], w: 10 }] },
    floorPlay: true, // the box canyon floor is where the hole ends
    islands: [
      { x: 0, z: 32, rx: 62, rz: 76, p: 3, top: 0, depth: 32, kind: 'mesa', seed: 21, trees: 16 },
      { x: 0, z: -150, rx: 70, rz: 122, p: 3.6, top: 0, depth: 32, kind: 'mesa', seed: 22, relief: 0.5, slope: { from: [0, -42, 0], to: [0, -236, -32] }, trees: 0 },
      // the canyon walls: narrow by the tee, cut well back around the fork, open where the wash crosses
      { x: -88, z: -43, rx: 56, rz: 52, p: 5, top: 14, depth: 46, kind: 'rock', seed: 24, trees: 6 },
      { x: -138, z: -198, rx: 56, rz: 103, p: 5, top: 14, depth: 46, kind: 'rock', seed: 241, trees: 6 },
      { x: -84, z: -430, rx: 42, rz: 47, p: 4, top: 12, depth: 44, kind: 'rock', seed: 26 },
      { x: 88, z: -36, rx: 56, rz: 44, p: 5, top: 16, depth: 48, kind: 'rock', seed: 25, trees: 6 },
      { x: 122, z: -186, rx: 56, rz: 106, p: 5, top: 16, depth: 48, kind: 'rock', seed: 251, trees: 6 },
      { x: 74, z: -400, rx: 42, rz: 54, p: 4, top: 10, depth: 42, kind: 'rock', seed: 27 },
      { x: 0, z: -442, rx: 84, rz: 44, p: 2.6, top: 13, depth: 45, kind: 'rock', seed: 28 },
      // the upper plateau, left of the grove: rises out of the ramp and stays about 4 m above the lower fairway
      { x: -48, z: -195, rx: 31, rz: 100, p: 3.2, top: -29, depth: 10, kind: 'mesa', seed: 29, relief: 0.4, slope: { from: [-48, -110, -7.5], to: [-48, -236, -29] }, trees: 0 },
      // the forward tee's low plateau on the right, where the canyon widens
      { x: 46, z: -146, rx: 14, rz: 24, p: 3, top: -14, depth: 12, kind: 'mesa', seed: 30, relief: 0.2, slope: { from: [46, -122, -11.5], to: [46, -170, -18] }, trees: 0 },
    ],
    fairways: [
      { pts: [[0, -112, 12, 12], [2, -160, 14, 16], [6, -205, 12, 20], [10, -250, 12, 22], [8, -292, 14, 18], [4, -318, 12, 12]] }, // lower
      { pts: [[-30, -122, 8, 8], [-42, -160, 14, 14], [-48, -210, 18, 16], [-46, -255, 16, 14], [-38, -288, 10, 9]] },             // upper plateau
      { pts: [[1, -338, 10, 10], [1, -352, 11, 11]] },                                                                         // between the wash and the green
    ],
    green: { x: 1, z: -374, rx: 14, rz: 13, style: 'tilt', tilt: 0.6, side: -2.1, raise: -0.3, mound: 1.2, pins: [[1, -374], [-6, -369], [7, -379], [-4, -381]] },
    bunkers: [{ x: -16, z: -360, rx: 5, rz: 4, style: 'grass' }, { x: 17, z: -381, rx: 4.5, rz: 3.5, style: 'pot' }, { x: -66, z: -250, rx: 6, rz: 4.5, style: 'flashed' }],
    landforms: [
      { type: 'step', x: 12, z: -226, length: 22, width: 24, height: 2.5, run: 12 }, // the speed slot, right side only
    ],
    groves: [{ x: -15, z: -231, rx: 5, rz: 24, n: 8, type: 'cotton', s: [1.2, 1.7], seed: 5 }],
    rockfalls: [
      { x: -14, z: -165, rx: 30, rz: 4.5, toward: [-28, -165], height: 2.6, n: 22, size: [0.35, 1.3] }, // spilled down the plateau's face
      { x: -14, z: -277, rx: 16, rz: 4.5, toward: [-28, -277], height: 2.6, n: 14, size: [0.35, 1.3] },
      { x: -28, z: -392, rx: 15, rz: 14, toward: [-44, -404], height: 30, n: 70, size: [0.3, 3.2] },     // the rockfall behind the green
    ],
    targets: [{ name: 'Lower right', x: 12, z: -262 }, { name: 'Upper plateau', x: -46, z: -232 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'swallows', x: 0, z: -390 }],
    glyph: 'snake',
  },
  {
    name: 'Kestrel', par: 3, heading: 192,
    yards: { canyon: 225, mesa: 190, sage: 160, lizard: 120 },
    blurb: 'The big drop, to a big Redan angled away from you, with wide short-grass runoffs around it. The wash snakes in to the front left of the green and plays like a greenside bunker; a big bunker sits back right. Short of the wash is a fairway to bail out to. Every tee sits right at the lip of its ledge, so you see the whole shot below you. On the mesa behind, a great arch.',
    pin: P3,
    tees: { canyon: teeFrom(P3, 225, 0), mesa: teeFrom(P3, 190, -16), sage: teeFrom(P3, 160, 15), lizard: teeFrom(P3, 120, -11) },
    // short pads at the very front of each ledge, so the drop and the green are in view from the ball
    teePads: { canyon: { l: 7 }, mesa: { l: 7 }, sage: { l: 7 }, lizard: { l: 7 } },
    floor: { y: -70, relief: 2.6, washes: [{ pts: [[-140, -158], [-80, -166], [-42, -176], [-22, -186], [-2, -190], [22, -184], [60, -178], [150, -168]], w: 13 }] },
    islands: [
      { x: 0, z: 1.2, rx: 8, rz: 9, p: 2.2, top: 0, depth: 70, kind: 'tee', seed: 31, lip: 0.2, rail: true },
      { x: -16, z: -31.8, rx: 8, rz: 8.5, p: 2.2, top: -15, depth: 55, kind: 'tee', seed: 32, lip: 0.2 },
      { x: 15, z: -59.8, rx: 8, rz: 8.5, p: 2.2, top: -35, depth: 35, kind: 'tee', seed: 33, lip: 0.2 },
      { x: -11, z: -95.1, rx: 9, rz: 9, p: 2.2, top: -50, depth: 20, kind: 'tee', seed: 34, lip: 0.2 },
      { x: 0, z: -330, rx: 180, rz: 66, p: 2.6, top: 12, depth: 82, kind: 'rock', seed: 36 },
      { x: -175, z: -120, rx: 80, rz: 180, p: 2.6, top: 6, depth: 76, kind: 'rock', seed: 37 },
      { x: 180, z: -120, rx: 80, rz: 180, p: 2.6, top: 8, depth: 78, kind: 'rock', seed: 38 },
    ],
    // a fairway to bail out to, widening from the forward ledge to the wash
    fairways: [{ pts: [[18, -104, 3, 3], [10, -126, 14, 22], [0, -148, 30, 40], [-3, -158, 34, 44]] }],
    green: { x: -3, z: -212, rx: 16, rz: 25, rot: -0.85, style: 'redan', raise: 0.3, apron: 16, runoff: true, pins: [[-3, -212], [7, -204], [-10, -221], [3, -225]] },
    bunkers: [{ x: 30, z: -238, rx: 12, rz: 8, rot: -0.6, style: 'flashed' }],
    targets: [{ name: 'Green', pin: true }, { name: 'Bail out short', x: 4, z: -140 }],
    drops: [],
    rocks: [{ type: 'arch', x: 70, z: -310, rot: 0, w: 150, h: 68, t: 22, d: 26, crown: 0.6, flare: 16 }],
    props: [{ type: 'kestrels', x: 0, z: -110, y: -35 }, { type: 'boulders', x: 2, z: -262, w: 120, d: 14, n: 26 }],
    glyph: 'bird',
  },
  {
    name: "Needle's Eye", par: 4, heading: 250,
    yards: { canyon: 370, mesa: 335, sage: 290, lizard: 235 },
    blurb: 'Through a massive double arch about 190 yards out, then the fairway turns left around a bunker group to a two-tier green. From the right side you can see the back tier and attack it; from the left you can\'t.',
    line: L4, pin: [-57.2, -322.9],
    tees: { ...teesOn(L4, { canyon: 370, mesa: 335, sage: 290 }), lizard: [53, -156] },
    teePads: { lizard: { rot: -0.26 } }, // the forward tee plays through the small arch to the right side
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
    rocks: [
      // a massive arch: thick weathered legs flaring into buttresses, a thinner span, rubble at its feet
      { type: 'arch', x: 0, z: -174, rot: 0, w: 34, h: 32, t: 16, d: 22, crown: 0.58, flare: 11, fh: 20 },
      // and a smaller arch springing from its right foot: a double arch (the forward tee plays through it)
      { type: 'arch', x: 44, z: -196, rot: -0.75, w: 22, h: 24, t: 8, d: 11, crown: 0.7, flare: 6 },
    ],
    rockfalls: [
      { x: -48, z: -174, rx: 13, rz: 9, toward: [-30, -174], height: 6, n: 22, size: [0.4, 2.4] },
      { x: 50, z: -166, rx: 10, rz: 8, toward: [34, -172], height: 5, n: 16, size: [0.4, 2] },
    ],
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
    tees: { ...teesOn(L5, { canyon: 535, mesa: 485 }), sage: [20.3, -101.7], lizard: [32, -190] },
    floor: { y: 0, relief: 1.6, washes: [{ pts: [[46, 60], [42, -110], [62, -215], [84, -300], [92, -385], [80, -445], [96, -540]], w: 18 }] },
    islands: [
      { x: -82, z: -40, rx: 56, rz: 130, p: 3.4, top: 55, depth: 55, kind: 'rock', seed: 51 },
      { x: -70, z: -238, rx: 62, rz: 92, p: 3, top: 58, depth: 58, kind: 'rock', seed: 52 },
      { x: -42, z: -372, rx: 56, rz: 72, p: 3, top: 54, depth: 54, kind: 'rock', seed: 53 },
      { x: -46, z: -478, rx: 46, rz: 62, p: 2.8, top: 56, depth: 56, kind: 'rock', seed: 54 },
      { x: 22, z: -562, rx: 92, rz: 56, p: 2.8, top: 57, depth: 57, kind: 'rock', seed: 55 },
      { x: 92, z: -505, rx: 36, rz: 42, p: 2.6, top: 40, depth: 40, kind: 'rock', seed: 56 },
    ],
    fairways: [{ pts: [[1, -112, 12, 12], [5, -170, 16, 10], [18, -232, 18, 20], [34, -282, 16, 16], [38, -308, 12, 12]] }, { pts: [[43, -344, 20, 18], [44, -375, 22, 16], [38, -420, 14, 12], [33, -452, 12, 12]] }],
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
    blurb: 'A drivable par four with nothing in between: a table rock the size of a house blocks the straight line, with a few small spires to its right. Go for the receiving fairway in front of the green, around or over the rock, or lay up on the raised fairway plateau to the left, with a huge bunker below its left edge. Miss either and you are in the native desert. The two forward tees sit on their own plateau, just below the fairway one.',
    line: L7, pin: [18, -312], corridor: 0, // no rough down the middle: miss the targets and you are in the native
    tees: { ...teesOn(L7, { canyon: 320, mesa: 295 }), sage: [-33, -80], lizard: [-31, -128] },
    floor: { y: -25, relief: 1.8 },
    islands: [
      { x: -12, z: -165, rx: 104, rz: 232, p: 3, top: 0, depth: 25, kind: 'mesa', seed: 71, trees: 40 },
      // the forward tees' plateau, just lower than the fairway plateau
      { x: -33, z: -91, rx: 12, rz: 44, p: 3.2, top: 3.5, depth: 29, kind: 'mesa', seed: 72, relief: 0.2, trees: 0 },
      // the raised fairway plateau
      { x: -50, z: -212, rx: 26, rz: 77, p: 3.2, top: 5.5, depth: 31, kind: 'mesa', seed: 73, relief: 0.4, trees: 0 },
    ],
    fairways: [
      { pts: [[-46, -152, 10, 10], [-50, -178, 18, 18], [-52, -225, 19, 19], [-48, -265, 15, 15], [-42, -282, 9, 9]] }, // the plateau
      { pts: [[22, -250, 12, 12], [26, -270, 18, 18], [26, -290, 16, 16]] },                                             // receiving fairway
    ],
    green: { x: 23, z: -320, rx: 20, rz: 14, rot: 0.15, style: 'tiered', tiers: [{ b: 0, step: 0.6, axis: 'u' }], side: 1, apron: 10, runoff: true, pins: [[18, -312], [30, -318], [12, -324], [34, -327]] },
    bunkers: [
      { x: -92, z: -180, rx: 16, rz: 120, style: 'flashed', toward: [-50, -200] }, // the huge fairway bunker below the plateau's left edge
      { x: -29, z: -300, rx: 12, rz: 24, style: 'flashed', toward: [23, -320] },   // front left of the green
    ],
    rocks: [
      // the blocker: a table rock, a broad block on a short column, and a few small spires to its right
      { type: 'hoodoo', x: -2, z: -205, r: 8, h: 17, cap: 9 },
      { type: 'boulder', x: -2, z: -205, r: 21, h: 13, pe: 4, rot: 0.3, y: 15 },
      { type: 'hoodoo', x: 34, z: -201, r: 2, h: 10 }, { type: 'hoodoo', x: 34, z: -224, r: 2.2, h: 13 }, { type: 'hoodoo', x: 55, z: -214, r: 1.8, h: 8 },
    ],
    targets: [{ name: 'Upper plateau', x: -50, z: -215 }, { name: 'Go for it', x: 24, z: -268 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'balanced', x: 66, z: -352 }],
    glyph: 'spirals',
  },
  {
    name: 'Dry Wash', par: 4, heading: 168,
    yards: { canyon: 450, mesa: 400, sage: 345, lizard: 225 },
    blurb: 'On the canyon floor, where a waterfall pours off the left wall and becomes a river. It swings right across the front of the landing area and back left across the second shot, then runs along the left wall and out of the canyon past the green. The green is an Eden, back to front, with a big bunker short right.',
    line: L8, pin: [22, -412],
    tees: { ...teesOn(L8, { canyon: 450, mesa: 400, sage: 345 }), lizard: [-45, -226] },
    floor: { y: 0, relief: 1.5 },
    // the river: from the foot of the falls, right across the landing area, back left, then along the wall and out
    rivers: [{ pts: [[-58, -108], [-38, -110], [-18, -117], [4, -127], [24, -139], [44, -155], [54, -172], [52, -192], [46, -210], [36, -229], [22, -247], [6, -263], [-8, -277], [-24, -292], [-38, -305], [-48, -320], [-52, -342], [-52, -372], [-52, -405], [-51, -440], [-50, -470], [-58, -500], [-84, -532]], w: 12 }],
    islands: [
      { x: -134, z: -200, rx: 72, rz: 270, p: 3, top: 48, depth: 48, kind: 'rock', seed: 81 },
      { x: 136, z: -210, rx: 72, rz: 320, p: 3, top: 52, depth: 52, kind: 'rock', seed: 82 },
      { x: 45, z: -560, rx: 85, rz: 60, p: 2.6, top: 50, depth: 50, kind: 'rock', seed: 83 },
    ],
    fairways: [{ pts: [[-3, -150, 16, 14], [-5, -185, 24, 20], [-2, -230, 22, 16], [0, -250, 14, 8]] }, { pts: [[4, -305, 13, 12], [9, -338, 15, 15], [15, -372, 12, 12]] }],
    green: { x: 22, z: -412, rx: 16, rz: 14, style: 'tilt', tilt: 2.2, apron: 12, runoff: true, pins: [[22, -412], [16, -418], [28, -406], [25, -420]] },
    bunkers: [{ x: 50, z: -360, rx: 13, rz: 10, rot: 0.5, style: 'flashed', toward: [22, -412] }],
    landforms: [{ type: 'ridge', x: -5, z: -205, length: 50, width: 12, height: 1.1 }],
    targets: [{ name: 'Fairway', x: -5, z: -215 }, { name: 'Lay up', x: 8, z: -335 }, { name: 'Green', pin: true }],
    drops: [],
    props: [
      { type: 'waterfall', x: -62, z: -108, rot: Math.PI / 2, w: 22, back: 80 },
      { type: 'fossil', x: -63, z: -236, rot: Math.PI / 2 }, { type: 'cottonwoods' },
    ],
    glyph: 'lizard',
  },
  {
    name: 'The Climb', par: 5, heading: 262,
    yards: { canyon: 515, mesa: 460, sage: 400, lizard: 305 },
    blurb: 'The walk home: three tiers stepping back up to the top, each shot up a level. The last rise hides the green, so the third is blind, and the plateau green has a false front: come up short and it rolls back toward the ramp. The clubhouse and a window arch wait on the summit.',
    line: L9, pin: [-6, -468],
    tees: { ...teesOn(L9, { canyon: 515, mesa: 460 }), sage: [-25.9, -105.8], lizard: [18.5, -193.4] },
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
