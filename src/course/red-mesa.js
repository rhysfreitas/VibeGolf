// Red Mesa: nine holes across and between red-rock mesas, high on the plateau.
// Same format as aerie.js, plus what desert holes need (see terrain.js for the shapes):
//   line      the playing line from the back tee to the pin; tees and yardages are measured on it
//   heading   compass bearing of the hole (tee to green), for the sun and the wind
//   tees      { canyon, mesa, sage, lizard: [x, z] }; yards { same keys: card yardage }
//   floor     the canyon floor { y, relief, solid, washes, gorges }; fairways / sand painted on any ground
//   islands   kinds 'mesa' (playable top, rough unless painted), 'rock' (cliffs and walls), plus the
//             Aerie kinds; slope { from, to } makes a ramp
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
const L1 = [[0, 0], [-4, -130], [-8, -250], [-6, -361]];
const L2 = [[0, 0], [0, -120], [3, -250], [2, -375]];
const P3 = [2, -205.7];
const L4 = [[0, 0], [0, -174], [-6, -260], [-12, -338.5]];
const L5 = [[0, 0], [6, -185], [38, -280], [44, -370], [26, -484]];
const P6 = [0, -160];
const L7 = [[0, 0], [-4, -160], [4, -315.5]];
const L8 = [[0, 0], [-6, -200], [5, -393]];
const L9 = [[0, 0], [-4, -220], [4, -350], [-6, -470.8]];

export const HOLES = [
  {
    name: 'Rimrock', par: 4, heading: 4,
    yards: { canyon: 395, mesa: 355, sage: 310, lizard: 240 },
    blurb: 'A gentle opener along the top of the first mesa. The rim runs down the right: anything that leaks that way drops forty metres to the canyon floor, and you play it from there.',
    line: L1, pin: [-5, -361],
    tees: teesOn(L1, { canyon: 395, mesa: 355, sage: 310, lizard: 240 }, { mesa: -1, sage: -2, lizard: -2 }),
    floor: { y: -40, relief: 2.2 },
    islands: [
      { x: -45, z: -175, rx: 86, rz: 232, p: 3.2, top: 0, depth: 40, kind: 'mesa', seed: 1, relief: 1.1, green: { x: -7, z: -358, r: 15 }, bunkers: [[-24, -350, 4.4], [8, -341, 3.4]], trees: 70 },
    ],
    fairways: [{ pts: [[-1, -42, 12], [-4, -130, 18], [-7, -232, 17], [-8, -330, 13]] }],
    sand: [[-27, -258, 6], [10, -238, 5]],
    targets: [{ name: 'Fairway', x: -6, z: -232 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'windmill', x: 16, z: 14, rot: 0.4 }],
    glyph: 'spiral',
  },
  {
    name: 'The Chute', par: 4, heading: 82,
    yards: { canyon: 410, mesa: 370, sage: 320, lizard: 250 },
    blurb: 'Down a broad sandstone ramp between two plateaus into a box canyon. The drive runs downhill, and the green is walled in on three sides: a long approach kicks back off the rock.',
    line: L2, pin: [3, -377],
    tees: teesOn(L2, { canyon: 410, mesa: 370, sage: 320, lizard: 250 }),
    floor: { y: -32, relief: 1.4 },
    islands: [
      { x: 0, z: 32, rx: 62, rz: 76, p: 3, top: 0, depth: 32, kind: 'mesa', seed: 21, trees: 16 },
      { x: 0, z: -150, rx: 35, rz: 122, p: 3.6, top: 0, depth: 32, kind: 'mesa', seed: 22, relief: 0.5, slope: { from: [0, -42, 0], to: [0, -236, -32] }, trees: 0 },
      { x: 0.6, z: -146.5, rx: 8, rz: 9, top: -16.9, depth: 2, kind: 'tee', seed: 23, lip: 0.3 },
      { x: -88, z: -170, rx: 56, rz: 178, p: 3, top: 14, depth: 46, kind: 'rock', seed: 24, trees: 10 },
      { x: 88, z: -170, rx: 56, rz: 178, p: 3, top: 16, depth: 48, kind: 'rock', seed: 25, trees: 10 },
      { x: -72, z: -380, rx: 42, rz: 72, p: 2.6, top: 12, depth: 44, kind: 'rock', seed: 26 },
      { x: 74, z: -378, rx: 42, rz: 72, p: 2.6, top: 10, depth: 42, kind: 'rock', seed: 27 },
      { x: 0, z: -442, rx: 84, rz: 44, p: 2.6, top: 13, depth: 45, kind: 'rock', seed: 28 },
      { x: 0, z: -374, rx: 22, rz: 21, top: -31.4, depth: 3, kind: 'green', seed: 29, lip: 0.6, green: { x: 1, z: -374, r: 14 }, bunkers: [[-15, -364, 4]] },
    ],
    fairways: [{ pts: [[0, -45, 13], [0, -120, 20], [2, -200, 22], [3, -262, 20], [2, -345, 12]] }],
    targets: [{ name: 'Down the chute', x: 2, z: -235 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'swallows', x: 0, z: -390 }],
    glyph: 'snake',
  },
  {
    name: 'Kestrel', par: 3, heading: 192,
    yards: { canyon: 225, mesa: 190, sage: 160, lizard: 120 },
    blurb: 'The big drop. The tee is on top of a spire seventy metres above a green on the canyon floor, so it plays about fifty yards shorter than the card. Short is a sandy wash; long is boulders against the far wall.',
    pin: P3,
    tees: { canyon: [0, 0], mesa: teeFrom(P3, 190, -16), sage: teeFrom(P3, 160, 15), lizard: teeFrom(P3, 120, -11) },
    floor: { y: -70, relief: 2.6, washes: [{ pts: [[-140, -160], [-50, -172], [10, -180], [70, -176], [150, -166]], w: 15 }] },
    islands: [
      { x: 0, z: 2, rx: 8, rz: 9, p: 2.2, top: 0, depth: 70, kind: 'tee', seed: 31, lip: 0.2, rail: true },
      { x: -16, z: -32.5, rx: 8, rz: 8.5, p: 2.2, top: -15, depth: 55, kind: 'tee', seed: 32, lip: 0.2 },
      { x: 15, z: -60.6, rx: 8, rz: 8.5, p: 2.2, top: -35, depth: 35, kind: 'tee', seed: 33, lip: 0.2 },
      { x: -11, z: -97, rx: 9, rz: 9, p: 2.2, top: -50, depth: 20, kind: 'tee', seed: 34, lip: 0.2 },
      { x: 2, z: -207, rx: 25, rz: 23, top: -69.5, depth: 3, kind: 'green', seed: 35, lip: 0.6, green: { x: 2, z: -206, r: 15 }, bunkers: [[17, -196, 3.6]] },
      { x: 0, z: -330, rx: 180, rz: 66, p: 2.6, top: 12, depth: 82, kind: 'rock', seed: 36 },
      { x: -175, z: -120, rx: 80, rz: 180, p: 2.6, top: 6, depth: 76, kind: 'rock', seed: 37 },
      { x: 180, z: -120, rx: 80, rz: 180, p: 2.6, top: 8, depth: 78, kind: 'rock', seed: 38 },
    ],
    fairways: [{ pts: [[2, -186, 9], [2, -192, 13]] }],
    targets: [{ name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'kestrels', x: 0, z: -110, y: -35 }, { type: 'boulders', x: 2, z: -248, w: 120, d: 14, n: 26 }],
    glyph: 'bird',
  },
  {
    name: "Needle's Eye", par: 4, heading: 250,
    yards: { canyon: 370, mesa: 335, sage: 290, lizard: 225 },
    blurb: 'A huge natural arch spans the fairway about 190 yards out. A normal drive flies straight through; only a very high or very wide one clips the rock and drops short.',
    line: L4, pin: [-12, -339],
    tees: teesOn(L4, { canyon: 370, mesa: 335, sage: 290, lizard: 225 }),
    floor: { y: -35, relief: 2 },
    islands: [
      { x: 0, z: 22, rx: 56, rz: 70, p: 3, top: 0, depth: 35, kind: 'mesa', seed: 41, trees: 12 },
      { x: -10, z: -232, rx: 92, rz: 206, p: 3, top: 4, depth: 39, kind: 'mesa', seed: 42, slope: { from: [0, -40, 0], to: [0, -150, 4] }, green: { x: -14, z: -341, r: 15 }, bunkers: [[-31, -331, 4.5], [2, -352, 3.8]], trees: 50 },
    ],
    fairways: [{ pts: [[0, -46, 13], [0, -120, 18], [0, -174, 13], [-3, -215, 17], [-8, -290, 16], [-12, -318, 12]] }],
    sand: [[19, -238, 6]],
    rocks: [{ type: 'arch', x: 0, z: -174, rot: 0, w: 34, h: 32, t: 9, d: 14 }],
    targets: [{ name: 'Through the arch', x: -2, z: -218 }, { name: 'Green', pin: true }],
    drops: [],
    props: [],
    glyph: 'sun',
  },
  {
    name: 'Switchback', par: 5, heading: 348,
    yards: { canyon: 535, mesa: 485, sage: 425, lizard: 330 },
    blurb: 'Along the foot of a long plateau wall: right, then left, hugging the cliff the whole way, with a dry wash on the right. The green is tucked into an alcove in the rock.',
    line: L5, pin: [27, -486],
    tees: teesOn(L5, { canyon: 535, mesa: 485, sage: 425, lizard: 330 }),
    floor: { y: 0, relief: 1.6, washes: [{ pts: [[46, 60], [42, -110], [62, -215], [84, -300], [92, -385], [80, -445], [96, -540]], w: 18 }] },
    islands: [
      { x: -82, z: -40, rx: 56, rz: 130, p: 3.4, top: 55, depth: 55, kind: 'rock', seed: 51 },
      { x: -70, z: -238, rx: 62, rz: 92, p: 3, top: 58, depth: 58, kind: 'rock', seed: 52 },
      { x: -42, z: -372, rx: 56, rz: 72, p: 3, top: 54, depth: 54, kind: 'rock', seed: 53 },
      { x: -46, z: -478, rx: 46, rz: 62, p: 2.8, top: 56, depth: 56, kind: 'rock', seed: 54 },
      { x: 22, z: -562, rx: 92, rz: 56, p: 2.8, top: 57, depth: 57, kind: 'rock', seed: 55 },
      { x: 92, z: -505, rx: 36, rz: 42, p: 2.6, top: 40, depth: 40, kind: 'rock', seed: 56 },
      { x: 26, z: -486, rx: 24, rz: 22, top: 0.55, depth: 3, kind: 'green', seed: 57, lip: 0.7, green: { x: 26, z: -485, r: 15 }, bunkers: [[42, -476, 4]] },
    ],
    fairways: [{ pts: [[1, -42, 13], [5, -150, 18], [20, -232, 17], [38, -285, 17], [44, -372, 18], [35, -445, 14]] }],
    sand: [[-6, -300, 5.5], [58, -350, 5]],
    targets: [{ name: 'Fairway', x: 9, z: -212 }, { name: 'Layup', x: 44, z: -382 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'mine', x: 0, z: -236, rot: Math.PI / 2 }],
    glyph: 'hand',
  },
  {
    name: 'Trestle', par: 3, heading: 96,
    yards: { canyon: 175, mesa: 150, sage: 130, lizard: 100 },
    blurb: 'Mesa to mesa over a deep gorge: the one true penalty on the course. Short or wide is gone, with a drop on the green side. The old railroad crosses the gorge on a trestle to your right.',
    pin: P6,
    tees: { canyon: [0, 0], mesa: teeFrom(P6, 150, 3), sage: teeFrom(P6, 130, -22), lizard: [-84.5, -125] },
    floor: { y: -140, relief: 4, solid: false },
    islands: [
      { x: 0, z: 40, rx: 62, rz: 86, p: 3.2, top: 0, depth: 140, kind: 'mesa', seed: 61, trees: 14 },
      { x: -25, z: -38, rx: 18, rz: 22, p: 2.6, top: 0, depth: 140, kind: 'mesa', seed: 62, relief: 0.4 },
      { x: -20, z: -176, rx: 102, rz: 72, p: 3, top: -3, depth: 137, kind: 'mesa', seed: 63, green: { x: 0, z: -161, r: 15 }, bunkers: [[-16, -150, 4], [14, -172, 3.6]], trees: 26 },
    ],
    fairways: [{ pts: [[-2, -112, 10], [-1, -140, 14]] }],
    targets: [{ name: 'Green', pin: true }],
    drops: [[0, -120], [-28, -116]],
    props: [{ type: 'trestle', x: 52, z0: 260, z1: -520, y: 1.2 }],
    glyph: 'train',
  },
  {
    name: 'Hoodoos', par: 4, heading: 10,
    yards: { canyon: 345, mesa: 310, sage: 270, lizard: 210 },
    blurb: 'A short par four on a bench scattered with hoodoos, capped spires that knock a ball down. Pick a gap. The green sits beside a balanced rock that looks like it should fall.',
    line: L7, pin: [4, -316],
    tees: teesOn(L7, { canyon: 345, mesa: 310, sage: 270, lizard: 210 }),
    floor: { y: -25, relief: 1.8 },
    islands: [
      { x: 0, z: -165, rx: 88, rz: 232, p: 3, top: 0, depth: 25, kind: 'mesa', seed: 71, green: { x: 4, z: -318, r: 14 }, bunkers: [[-12, -306, 4]], trees: 40 },
    ],
    fairways: [{ pts: [[0, -42, 12], [-3, -150, 18], [0, -250, 18], [3, -296, 12]] }],
    rocks: [
      { type: 'hoodoo', x: -31, z: -176, r: 3, h: 18 }, { type: 'hoodoo', x: -9, z: -192, r: 2.6, h: 12 },
      { type: 'hoodoo', x: 15, z: -181, r: 3.2, h: 22 }, { type: 'hoodoo', x: 34, z: -203, r: 2.8, h: 15 },
      { type: 'hoodoo', x: -24, z: -217, r: 3.4, h: 25 }, { type: 'hoodoo', x: 6, z: -227, r: 2.5, h: 9 },
      { type: 'hoodoo', x: 26, z: -242, r: 3, h: 20 }, { type: 'hoodoo', x: -40, z: -246, r: 2.6, h: 14 },
      { type: 'hoodoo', x: -9, z: -259, r: 2.2, h: 7 }, { type: 'hoodoo', x: 41, z: -267, r: 2.8, h: 12 },
      { type: 'hoodoo', x: -58, z: -128, r: 3.6, h: 21 }, { type: 'hoodoo', x: 56, z: -146, r: 3, h: 16 },
      { type: 'hoodoo', x: 62, z: -292, r: 3.4, h: 19 }, { type: 'hoodoo', x: -52, z: -300, r: 2.8, h: 11 },
    ],
    targets: [{ name: 'Short of the spires', x: -3, z: -150 }, { name: 'Through the gap', x: 3, z: -238 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'balanced', x: 26, z: -326 }],
    glyph: 'spirals',
  },
  {
    name: 'Dry Wash', par: 4, heading: 168,
    yards: { canyon: 430, mesa: 380, sage: 330, lizard: 255 },
    blurb: 'On the canyon floor along a dry riverbed. The wash snakes across the fairway twice, and the second shot has to carry the second crossing. Look for the fossil ribcage in the left wall.',
    line: L8, pin: [6, -395],
    tees: teesOn(L8, { canyon: 430, mesa: 380, sage: 330, lizard: 255 }),
    floor: { y: 0, relief: 1.5, washes: [{ pts: [[-80, -40], [-34, -104], [18, -132], [48, -190], [32, -255], [-16, -288], [-58, -318]], w: 17 }] },
    islands: [
      { x: -134, z: -210, rx: 72, rz: 320, p: 3, top: 48, depth: 48, kind: 'rock', seed: 81 },
      { x: 136, z: -210, rx: 72, rz: 320, p: 3, top: 52, depth: 52, kind: 'rock', seed: 82 },
      { x: 0, z: -560, rx: 130, rz: 60, p: 2.6, top: 50, depth: 50, kind: 'rock', seed: 83 },
      { x: 5, z: -397, rx: 24, rz: 22, top: 0.55, depth: 3, kind: 'green', seed: 84, lip: 0.7, green: { x: 5, z: -396, r: 15 }, bunkers: [[-11, -384, 4], [20, -404, 3.4]] },
    ],
    fairways: [{ pts: [[-1, -42, 15], [-5, -150, 22], [-4, -240, 20], [2, -362, 14]] }],
    targets: [{ name: 'Fairway', x: -5, z: -228 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'fossil', x: -63, z: -236, rot: Math.PI / 2 }, { type: 'cottonwoods' }, { type: 'debris' }],
    glyph: 'lizard',
  },
  {
    name: 'The Climb', par: 5, heading: 262,
    yards: { canyon: 515, mesa: 460, sage: 400, lizard: 305 },
    blurb: 'The walk home: three tiers stepping back up to the top, each shot up a level, so it plays longer than the card. The green sits on the summit by the clubhouse, a window arch framing the sun behind it.',
    line: L9, pin: [-6, -472],
    tees: teesOn(L9, { canyon: 515, mesa: 460, sage: 400, lizard: 305 }),
    floor: { y: 0, relief: 1.5 },
    islands: [
      { x: 0, z: -332, rx: 82, rz: 112, p: 3.2, top: 14, depth: 14, kind: 'mesa', seed: 91, trees: 30 },
      { x: -2, z: -228, rx: 26, rz: 30, p: 3, top: 0, depth: 14, kind: 'mesa', seed: 92, relief: 0.4, slope: { from: [-2, -206, 0], to: [-2, -252, 14] }, trees: 0 },
      { x: -10, z: -482, rx: 76, rz: 72, p: 3, top: 32, depth: 32, kind: 'mesa', seed: 93, green: { x: -6, z: -472, r: 15 }, bunkers: [[-24, -462, 4.4], [10, -484, 3.6]], trees: 18 },
      { x: -3, z: -398, rx: 22, rz: 28, p: 3, top: 14, depth: 18, kind: 'mesa', seed: 94, relief: 0.4, slope: { from: [-3, -378, 14], to: [-3, -420, 32] }, trees: 0 },
      { x: 150, z: -260, rx: 60, rz: 230, p: 3, top: 44, depth: 44, kind: 'rock', seed: 95 },
      { x: -150, z: -240, rx: 60, rz: 230, p: 3, top: 40, depth: 40, kind: 'rock', seed: 96 },
    ],
    fairways: [{ pts: [[-1, -45, 15], [-4, -150, 20], [-2, -200, 12], [-2, -250, 12], [2, -300, 18], [3, -368, 13], [-3, -420, 10], [-5, -448, 12]] }],
    targets: [{ name: 'Lower fairway', x: -3, z: -182 }, { name: 'Middle tier', x: 2, z: -322 }, { name: 'Green', pin: true }],
    drops: [],
    props: [{ type: 'clubhouse', x: 32, z: -512, rot: -0.3 }, { type: 'observatory', x: -46, z: -506 }, { type: 'windowArch', x: -15, z: -610, w: 48, h: 72, t: 14, d: 16 }],
    glyph: 'stars',
  },
];
