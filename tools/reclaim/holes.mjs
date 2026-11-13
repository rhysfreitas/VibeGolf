// The Reclaim, plan book draft 1: nine holes through a city that nature has taken back, about twenty years
// after everyone left. Misty overcast morning. Each hole is written in its own frame (metres; tee at the
// origin, the hole runs toward -z, x is right of the line, y up from the hole's `base`), from `legs`
// ([length, turn in degrees, + = right]). `place` puts the hole in the city: its back tee's world spot and
// compass heading. World: x east, -z north; heights are absolute (the riverside street is 0).
// This is plan data for the book (plans, profiles, sketch views), written to convert to the engine format
// later: islands/landforms/fairways/green/bunkers/water/rocks/groves/props.
import { lineOf, lengthOf, at, project, headingAt, YD, rnd } from './geo.mjs';

export const COURSE = {
  id: 'reclaim', name: 'The Reclaim', theme: 'city', altFt: 300,
  signature: { time: 'morning', wind: 'light', windFrom: 'random', weather: 'overcast', temp: 'cool', mist: true },
  teeSets: [
    { id: 'spire', name: 'Spire', color: '#2f5fa8', minDrive: 260 },
    { id: 'brick', name: 'Brick', color: '#f2efe6', minDrive: 230 },
    { id: 'ivy', name: 'Ivy', color: '#c94a3a', minDrive: 200 },
    { id: 'moss', name: 'Moss', color: '#e0b84a', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets,
  // and each hole's `tips` kept out of its tees and yards. Turning it on: put this first in teeSets and copy every
  // hole's tips.tee and tips.yards into its tees and yards under 'girder'
  tipsSet: { id: 'girder', name: 'Girder', color: '#3b4148', minDrive: 290 },
};

// a tree stand (in play): n trees scattered round a point
const grove = (p, r, n, seed, h = [9, 16]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: 3 + R() * 3, h: h[0] + R() * (h[1] - h[0]) }; }); };
const yawOf = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1);
  // tee spots: a number is s along the line; [s, off] a pad beside it
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) { const s = typeof v === 'number' ? v : v[0]; h.yards[k] = Math.round((len - s) / YD / 5) * 5; }
  // the tips tee (switched off): `tips: [s, off]`, s behind the back tee; its card adds the distance behind it
  const tp = def.tips || h.tips;
  if (tp) {
    const [s, o] = tp, p = P(s, o), b = h.teePts[COURSE.teeSets[0].id];
    h.tipsPt = p; h.tipsYards = h.yards[COURSE.teeSets[0].id] + Math.round(Math.hypot(p[0] - b[0], p[1] - b[1]) / YD);
  }
  return { ...def, ...h };
}

export const HOLES = [
  // 1. THE EL: off the platform of the elevated line, down to the boulevard, round a collapsed block
  hole({ n: 1, name: 'The El', par: 4, legs: [[232, 0], [134, 32]], place: { at: [-180, -320], heading: 8 }, base: 0, tips: [-24, -4],
    build: (P) => ({
      tees: { spire: 0, brick: 28, ivy: [62, 36], moss: [100, 38] },
      prof: [[0, 0], [110, 0], [170, 1.5], [260, 0.5], [366, 0]],
      fairway: [{ e: [[70, 14, 14], [110, 20, 22], [160, 24, 30], [215, 30, 26], [245, 22, 18], [275, 20, 24], [320, 22, 20], [352, 16, 14]] }],
      corridor: 20,
      green: { rx: 15, rz: 18, lobes: [[2, -4, 9, 13, -25], [-7, 9, 9, 6, -10]], join: 3, pins: [[-6, 8], [6, -6], [2, -9]], engine: { style: 'tilt', tilt: 1.5, shape: [{ tier: [-3, 4], up: 217, h: 0.4, w: 4 }] }, style: 'a kidney turned back-left, tilted back to front' },
      bunkers: [{ at: P(238, 30), rx: 15, rz: 6, rot: 0.15 }, { at: P(352, -17), rx: 4, rz: 3.5, style: 'pot' }],
      // a skyscraper fell across the second leg: its body lies on its side off the right, its broken top
      // end buried in a grassed rubble ridge 11 m high across the fairway, low (3 m) at the left by the El
      ridge: { s: 290, len: 36, h: 11, low: 3, lowOff: -34, fullOff: -6, label: 'the fallen tower' },
      fallen: { a: P(278, 190), b: P(292, 28), w: 30, h: 30, label: 'the fallen tower (on its side)' },
      chunks: [{ a: [...P(286, 18), 7], b: [...P(296, 8), 13], w: 12, t: 3 }, { a: [...P(284, -6), 6], b: [...P(292, -14), 10], w: 10, t: 2.5 }],
      sketch: { land: { up: 4 }, extra: [{ title: 'Hole 1: the fallen tower across the second leg, from the left of the landing area', from: [250, -24, 6], to: [292, 40, 12], fov: 62 }] },
      // Proposal (round 4): the station platform runs on 24 m further back, for the tips tee
      platform: [{ at: P(2, -4), w: 16, d: 70, y: 12, rot: 0, label: 'El station platform' }],
      el: [{ pts: [P(-40, -16), P(20, -16), P(80, -40), P(205, -40)], y: 12, w: 9, broken: true, label: 'the El' }],
      wrecks: [{ type: 'bus', at: P(150, -56), rot: 0.2 }, { type: 'car', at: P(120, 38), rot: 1.2 }, { type: 'car', at: P(300, -40), rot: 2.6 },
        { type: 'car', at: P(196, 41), rot: 0.1 }],
      trees: [...grove(P(232, 64), 18, 5, 11), ...grove(P(366 + 0, -36), 12, 3, 12)],
      buildings: [
        // left, beyond the El
        { at: P(60, -88), w: 40, d: 70, h: 46, broken: true }, { at: P(150, -92), w: 44, d: 60, h: 64, broken: true },
        { at: P(240, -96), w: 40, d: 70, h: 38, broken: true },
        // right of the first leg
        { at: P(40, 76), w: 36, d: 60, h: 34, broken: true }, { at: P(130, 78), w: 40, d: 64, h: 52, broken: true, vines: true },
        // round the green
        { at: P(395, 10), w: 70, d: 30, h: 28, broken: true }, { at: P(330, 78), w: 40, d: 50, h: 42, broken: true },
      ],
      cant: [[150, 290, 3]],   // the boulevard falls toward the corner
      targets: [{ name: 'Past the El', at: P(226, -6) }, { name: 'Round the low end', at: P(262, -14) }],
      words: {
        plays: 'Tee off the broken platform of the elevated line, 12 m above the boulevard. The track runs on down the left on its girders and ends in mid-air, a carriage hanging off the break. Round the bend a skyscraper lies on its side across the street: its body off to the right, its broken top end buried in a ridge of grassed rubble 11 m high. The green is out of sight behind it.',
        safe: 'Drive at the end of the El, 225 m, and play the second blind over the ridge (the corner map shows the line).',
        bold: 'Drive long and left toward the ridge\'s low end by the El (260 m): from there you can see the flag.',
        miss: 'Left is under the El, among the columns, cars and a bus. Right runs into the fallen tower\'s body and its rubble.',
      },
    }),
  }),

  // 2. THE ATRIUM: a dogleg left round a gutted office tower whose lower floors are blown out
  hole({ n: 2, name: 'The Atrium', par: 4, legs: [[200, 0], [148, -85]], place: { at: [-10, -690], heading: 32 }, base: 0, tips: [-35, 0],
    build: (P, L) => {
      // Drivable through the lobby (Rhys, 11 November): the dogleg turns 85° (it was 62°), so the green sits straight
      // behind the tower, 283 yd from the back tee, and the tower's nave points at it. A great drive from the back tee
      // runs up the mown courtyard onto the green; the forward tees play the corner. The 6th is the nine's other
      // drivable par 4 (a running shot up an apron); here it's a thread through the lobby and up 9 m, a different shot.
      const land = L.at(-1), dir = Math.atan2(land[0], -land[1]);
      const along = d => [Math.sin(dir) * d, -Math.cos(dir) * d];
      const c = along(168);
      const Lo = lineOf([[200, 0], [148, -62]]), Q = (s, o = 0) => at(Lo, s, o), landO = Q(290), dirO = Math.atan2(landO[0], -landO[1]);
      const alongO = d => [Math.sin(dirO) * d, -Math.cos(dirO) * d];
      // a free shape centred on the bold line `d` metres out, as [s, off] on the hole's line
      const onBold = (d, ra, rc) => { const p = along(d), r = project(L, p[0], p[1]); return [r.s, r.off, ra, rc, (dir - headingAt(L, r.s)) * 180 / Math.PI]; };
      return {
        // the city was laid round the old hole (62° dogleg): its line, pin and buildings, so the blocks don't reshuffle
        cityLine: Lo, cityPin: Lo.at(-1),
        cityOcc: [{ at: alongO(168), w: 46, d: 40, rot: dirO }, { at: Q(350, 40), w: 60, d: 26 }, { at: Q(378, -10), w: 30, d: 70, rot: 0.5 }, { at: Q(272, -98), w: 50, d: 30 },
          { at: P(80, 70), w: 40, d: 60 }, { at: P(170, 84), w: 40, d: 56 }, { at: P(60, -66), w: 30, d: 50 }],
        tees: { spire: 0, brick: 22, ivy: 48, moss: [78, 34] },
        prof: [[0, 0], [130, 0], [205, 3], [250, 5], [348, 8]],
        // the subway under the avenue caved in: a trench 7 m deep down the first leg's landing area
        sketch: { extra: [{ title: 'Hole 2: the tunnel cave-in under the first leg, from its lip', from: [126, 14, 3], to: [200, 0, -5] }] },
        trench: { s0: 140, s1: 236, depth: 7, w: 62, ramp: 26, bank: 9, label: 'the tunnel cave-in' },
        // the courtyard between the lobby and the green, mown as an approach so a great drive through the nave runs up
        fairway: [{ e: [[60, 16, 18], [110, 22, 28], [170, 26, 30], [205, 26, 30], [235, 20, 28], [270, 18, 22], [300, 22, 24], [336, 15, 15]] }, { lobes: [onBold(212, 22, 13), onBold(244, 20, 12)], join: 14, wob: 2 }],
        corridor: 18,
        green: { rx: 14, rz: 17, lobes: [[0, 0, 10, 16, 30], [-7, 4, 7, 6, 0], [4, -8, 5, 5, 0]], join: 3, pins: [[5, 8], [-4, -7], [-6, 4]], engine: { style: 'tiered', shape: [], tiers: [{ b: -3.5, step: 0.6 }], falseFront: 0.5 }, style: 'two tiers on a long green turned back-right, old fountain steps as a false front' },
        bunkers: [{ at: P(332, -20), rx: 4.5, rz: 3.5, style: 'pot' }, { at: [8, -232], rx: 14, rz: 7, rot: -0.3 }],   // in the trench floor past the corner (where it was before the turn; P(208, 32) now sits on the bank)
        rubble: [{ at: P(214, 14), rx: 30, rz: 22, rot: -0.4, h: 2.5, label: 'rubble ramp' }],
        buildings: [
          { at: c, w: 46, d: 40, rot: dir, h: 92, broken: true, open: 44, cols: 4, colsX: [-20, -10, 10, 20], name: 'the Atrium', label: 'the Atrium (open to 44 m)' },
          // the block it stands on: the courtyard walls left of the second leg and behind the green
          { at: P(350, 40), w: 60, d: 26, h: 34, broken: true, vines: true }, { at: P(378, -10), w: 30, d: 70, rot: 0.5, h: 48, broken: true },
          { at: [along(150)[0] - Math.cos(dir) * 58, along(150)[1] - Math.sin(dir) * 58], w: 50, d: 30, rot: dir, h: 26, broken: true },   // the courtyard's far side, beside the tower
          // right of the first leg
          { at: P(80, 70), w: 40, d: 60, h: 40, broken: true }, { at: P(170, 84), w: 40, d: 56, h: 58, broken: true },
          { at: P(45, -84), w: 30, d: 50, h: 30, broken: true },   // set back off the straight line from the back tee
        ],
        wrecks: [{ type: 'car', at: P(140, -30), rot: 0.4 }, { type: 'car', at: P(180, 34), rot: 1.9 }, { type: 'car', at: P(286, 34), rot: 0.8 }],
        trees: [...grove(P(300, 46), 18, 5, 21), ...grove(P(110, 44), 10, 3, 22)],
        targets: [{ name: 'The corner', at: P(204, 8) }, { name: 'Drive it through the Atrium', at: land, pin: true, bold: true }],
        boldLine: [[0, 0], land],
        words: {
          plays: 'A gutted office tower stands in the inside of the dogleg. Its lower eleven floors are blown out to the columns, a lobby 44 m high whose 18 m nave points straight at the green. Under the first leg the subway tunnel caved in, leaving a trench 7 m deep where the drives land; the street climbs out of it up a rubble ramp to a courtyard green set on old fountain steps.',
          safe: 'Drive down the right into the trench (190 m) and play a mid iron up the second leg, round the tower.',
          bold: 'Drive the green: 283 yd straight down the nave from the back tee, over the El and 9 m up. A great drive runs up the mown courtyard onto the green; a good one leaves a pitch. From the forward tees the lobby still cuts the corner into the courtyard. (The nine\'s second drivable par 4 with the 6th, kept on purpose: here you thread a lobby and carry a rise, there you run it up an apron.)',
          miss: 'Pulled or hit low, the ball hits the tower\'s columns, its facade or the El\'s deck and drops into the rubble at the foot. Through the corner: a bunker in the trench floor. Right of the first leg: wrecks and a block of offices.',
        },
      };
    },
  }),

  // 3. THE STATION: a par 3 into the concourse of a collapsed subway station
  hole({ n: 3, name: 'The Station', par: 3, legs: [[151, 0]], place: { at: [230, -770], heading: 82 }, base: 8, tips: [4, 0],
    build: (P) => ({
      tees: { spire: 28, brick: 38, ivy: 50, moss: 62 },
      prof: [[0, 0], [151, 0]],
      pit: { at: P(128), rx: 62, rz: 76, rot: 0, depth: 10, bank: 14, label: 'the cave-in' },
      ramp: { from: P(40, 46), to: P(110, 40), w: 26, label: 'the station stairs' },  // a way down on the right
      corridor: 10,
      green: { rx: 15, rz: 14, lobes: [[0, -1, 14, 10, 0], [-8, 6, 8, 7, 0]], join: 3, pins: [[-8, 6], [9, 0], [2, -6]], engine: { style: 'punchbowl', shape: [] }, style: 'a kidney across the line, in a punchbowl on the concourse floor' },
      fairway: [[95, 140, 34, 22]],
      bunkers: [{ at: P(146, -21), rx: 7, rz: 9 }],
      water: [{ at: P(176), rx: 46, rz: 7, y: -10.4, label: 'flooded tracks' }],
      rubble: [{ at: P(70, -34), rx: 22, rz: 26, h: 2, label: 'fallen street' }],
      roof: [{ at: P(186), w: 110, d: 22, y: 6, t: 1.2, label: 'concourse roof (what is left)' }],
      columns: [P(110, -40), P(110, 40), P(150, -44), P(150, 44), P(190, -46), P(190, 30)].map(p => ({ at: p, h: 12, r: 0.6 })),
      buildings: [{ at: P(20, -70), w: 40, d: 40, h: 44, broken: true }, { at: P(130, -110), w: 60, d: 40, h: 30, broken: true },
        { at: P(240, 30), w: 80, d: 34, h: 54, broken: true, vines: true }, { at: P(100, 110), w: 70, d: 40, h: 36, broken: true }],
      wrecks: [{ type: 'car', at: P(18, 26), rot: 1.4 }],
      trees: [...grove(P(84, 52), 10, 3, 31, [6, 10])],
      targets: [],
      words: {
        plays: 'The street fell into the station below. The green sits 10 m down on the concourse floor, in a bowl of broken paving that feeds a near miss toward it, with the flooded tracks behind and what is left of the roof hanging over them.',
        safe: 'The bank short-right is the old station stairs: a soft way down for a short shot.',
        bold: 'None: it is all one shot, about two clubs less than the yardage.',
        miss: 'Long is in the flooded tracks. Left catches the steep broken bank of the cave-in.',
      },
    }),
  }),

  // 4. BROKEN TOWER: an S-bend par 5 under the top of a skyscraper that snapped and fell across the street
  hole({ n: 4, name: 'Broken Tower', par: 5, legs: [[180, 0], [160, -34], [158, 42]], place: { at: [430, -860], heading: 112 }, base: 8, tips: [6, 0],
    build: (P) => {
      const stump = P(132, 64), prop = P(150, -64);
      return {
        // the reachable par 5 (12 November 2026, Rhys's pick): the back tee 41 m down the street, 545 -> 500 yd
        tees: { spire: 41, brick: 64, ivy: 88, moss: [120, 40] },
        prof: [[0, 0], [300, 0.5], [352, 3.5], [366, 6.5], [380, 5], [430, 7], [498, 10]],
        // Proposal (round 4): an hourglass, the bottle. Wide where the drive and the lay-up land on the second leg, pinched
        // to under 20 m where rubble heaps either side of the crest leave one gap over it, wide again in the hill park
        fairway: [{ e: [[50, 12, 12], [90, 17, 19], [150, 24, 25], [205, 26, 28], [255, 27, 33], [300, 30, 40], [328, 24, 30], [346, 10, 12], [362, 8, 8], [382, 10, 9], [400, 24, 22], [438, 30, 25], [470, 21, 22], [488, 14, 14]], wob: 1.2 }],
        corridor: 18,
        green: { rx: 16, rz: 19, lobes: [[0, 0, 8, 18, 45], [-5, 4, 6, 6, 0]], join: 4, pins: [[6, 7], [-6, -7], [-5, 5]], engine: { style: 'plateau', raise: 0.3, falseFront: 0.6, shape: [{ bowl: [6, 7], r: 9, h: 0.25 }] }, style: 'a long diagonal on the floor slab of a gutted pavilion, 2.2 m up; broken steps make a false front' },
        // the pavilion's ground floor: a raised slab in the hill park, broken steps up its front, a few columns left
        sketch: { tee: { up: 26, fov: 68 }, extra: [{ title: 'Hole 4: the green on the pavilion floor, from the third-shot landing', from: [430, -8, 4], to: [498, 0, 1], fov: 50 }] },
        podium: { w: 50, d: 54, h: 2.2, front: 10, label: 'the pavilion floor' },
        columns: [[-22, -24], [22, -24], [-22, -2], [22, 6], [-10, -26], [12, -26]].map(([u, v], i) => ({ rel: [u, v], h: [14, 9, 6, 11, 4, 13][i], r: 0.8 })),
        bunkers: [{ at: P(176, -30), rx: 15, rz: 7, rot: 0.2 }, { at: P(272, 33), rx: 14, rz: 7 }, { at: P(470, 22), rx: 9, rz: 6 }, { at: P(486, -20), rx: 5, rz: 4, style: 'pot' }],
        rubble: [{ at: P(130, 40), rx: 22, rz: 28, h: 4, label: 'debris from the break' }, { at: P(362, 0), rx: 70, rz: 13, rot: 0.08, h: 0, label: 'the rubble crest' },
          // the bottle's neck: heaps of the tower's rubble either side of the gap over the crest
          { at: P(364, -30), rx: 16, rz: 22, rot: 0.2, h: 6, label: 'rubble heap' }, { at: P(358, 32), rx: 17, rz: 24, rot: -0.15, h: 7, label: 'rubble heap' }],
        crest: { at: P(362), length: 26, width: 140, height: 4 },
        span: { a: [stump[0], stump[1], 72], b: [prop[0], prop[1], 44], w: 30, t: 12, label: 'the fallen top of the tower' },
        buildings: [
          { at: stump, w: 34, d: 34, h: 72, broken: 'snap', name: 'the tower', label: 'the tower (snapped at 72 m)' },
          { at: prop, w: 44, d: 44, h: 44, broken: true, name: 'the prop', label: 'the block that holds it up' },
          { at: P(60, 70), w: 40, d: 50, h: 40, broken: true }, { at: P(40, -70), w: 40, d: 60, h: 30, broken: true },
          { at: P(250, -76), w: 40, d: 70, h: 36, broken: true, vines: true }, { at: P(240, 84), w: 50, d: 60, h: 62, broken: true },
          { at: P(330, 76), w: 40, d: 40, h: 24, broken: true },
        ],
        wrecks: [{ type: 'car', at: P(100, -30), rot: 0.3 }, { type: 'bus', at: P(212, 40), rot: 1.0 }, { type: 'car', at: P(300, -34), rot: 2.0 }],
        trees: [...grove(P(366, -34), 9, 4, 45, [8, 13]), ...grove(P(357, 36), 10, 4, 46, [8, 13]), ...grove(P(470, -50), 30, 10, 41, [10, 18]), ...grove(P(500, 50), 26, 8, 42, [10, 18]), ...grove(P(420, 50), 14, 4, 43), ...grove(P(320, -50), 14, 4, 44)],
        targets: [{ name: 'Under the span', at: P(252, -4) }, { name: 'Short of the gap', at: P(322, 4) }, { name: 'Through the gap', at: P(418), bold: true }],
        words: {
          plays: 'A skyscraper snapped at the 18th floor. Its top fell across the street and lies propped on the block opposite, a slanting span 44 to 72 m up that you drive under. Then the street bends left and climbs a crest of rubble to the hill park, where the green sits on the floor slab of a gutted pavilion among wild trees, a few columns still standing round it.',
          safe: 'Drive under the span to the second leg and lay up in the wide part short of the crest, then play a blind iron up the hill.',
          bold: 'Thread the second through the gap between the rubble heaps on the crest, 20 m wide, for a pitch to the pavilion green.',
          miss: 'The tower\'s stump and its debris on the right, wrecks on the left, trees round the green.',
        },
      };
    },
  }),

  // 5. THE STADIUM: a par 3 from the broken upper deck down to the overgrown pitch
  hole({ n: 5, name: 'The Stadium', par: 3, legs: [[178, 0]], place: { at: [955, -735], heading: 186 }, base: -10, tips: [-24, 0],
    build: (P) => ({
      tees: { spire: 0, brick: [14, -6], ivy: [32, 8], moss: [52, -10] },
      prof: [[0, 28], [178, 0]],
      // an earthquake brought down most of the stands: only the east side keeps its tiers; behind the green the
      // north stand slumped into the bowl as rubble, which rolls on into the back of the green as a second tier
      stadium: { at: P(122), rx: 42, rz: 62, p: 3, stand: 48, h: 28, open: { s: [0, 60], w: 30 }, damage: [[-150, 70]] },
      rolls: 0.4,
      sketch: { green: { back: 85 }, extra: [{ title: 'Hole 5: the rubbled north stand, the two-tier green and the sinkhole', from: [96, 26, 12], to: [176, -4, -1], fov: 60 }] },
      greenTier: { s: 184, h: 1.1, roll: 0.2 },
      sinkhole: { at: P(124), rx: 26, rz: 18, label: 'the sinkhole' },
      corridor: 0,
      green: { rx: 18, rz: 19, lobes: [[0, -5, 13, 11, 0], [2, 8, 11, 10, 10]], join: 6, pins: [[0, 8], [-6, -3], [7, -1]], engine: { style: 'tiered', shape: [], tiers: [{ b: 4, step: 0.6 }] }, style: 'a pear in two tiers: the back tier is the north stand\'s rubble, rolling' },
      fairway: [[95, 168, 40]],
      bunkers: [{ at: P(166, -18), rx: 8, rz: 6 }, { at: P(186, 14), rx: 9, rz: 5 }],
      poles: [P(60, -62), P(60, 62), P(186, -62), P(186, 62)].map((p, i) => ({ at: p, h: 46, lean: i === 3 ? 14 : 0 })),
      trees: [...grove(P(110, -30), 8, 3, 51, [6, 10]), ...grove(P(130, 30), 6, 2, 52, [6, 9])],
      targets: [],
      words: {
        plays: 'The stadium sits in a bowl below the street, and an earthquake brought most of it down. You tee from what is left of the south stand\'s upper deck, 28 m above the pitch. Only the east side still has its tiers; the north stand slumped into the bowl as rubble, and the back of the green rolls up onto it as a second tier. A sinkhole 50 m across has opened in the pitch short of the green, with 17 m of short grass between it and the front edge.',
        safe: 'Play to the front tier: anything past the sinkhole stays on the pitch. A short shot can go round either side of it.',
        bold: 'Two clubs less than the yardage at a back pin, up on the rubble tier.',
        miss: 'Short is the sinkhole (a drop beside it); long climbs the rubble and runs back; wide right sits in the tiers.',
      },
    }),
  }),

  // 6. THE SQUARE: a drivable par 4 across an overgrown city square, with the El behind it
  hole({ n: 6, name: 'The Square', par: 4, legs: [[274, 0]], place: { at: [790, -430], heading: 224 }, base: 14, tips: [-28, 0],
    build: (P) => ({
      tees: { spire: 0, brick: 22, ivy: [50, 30], moss: [88, 32] },
      prof: [[0, 0], [120, 1], [200, 2], [240, 5], [274, 6]],
      cant: [[140, 240, 3]],   // the square leans right, away from the fountain, toward the lay-up
      // Proposal (round 4): an apron from the right lane up to the green's front right, so a drive can run on
      fairway: [{ e: [[64, 12, 16], [110, 16, 32], [160, 21, 42], [212, 16, 46]] }, [200, 236, 36, 30], { lobes: [[244, 20, 16, 11, -30], [254, 12, 9, 7, -30]], join: 6, wob: 1.5 }],
      extraFw: [{ at: P(215, 34), rx: 22, rz: 26 }],
      corridor: 22,
      green: { rx: 14, rz: 16, lobes: [[0, 0, 10, 16, 30], [-6, -5, 7, 7, 0], [5, -6, 6, 6, 0]], join: 4, pins: [[5, 8], [-6, -5], [5, -6]], engine: { style: 'plateau', raise: 0.9, falseFront: 0.4, tilt: 1.4, shape: [{ ridge: [[0, -12], [0, -4]], h: 0.3, w: 2.2 }] }, style: 'a long green turned back-right, raised on the old plaza steps, tilted to the front' },
      bunkers: [{ at: P(258, 18), rx: 8, rz: 5 }, { at: P(286, -10), rx: 9, rz: 5 }],
      water: [{ at: P(222, -16), rx: 24, rz: 22, y: 3.5, rim: true, label: 'the fountain' }],
      trees: [...grove(P(120, -54), 34, 14, 61, [12, 20]), ...grove(P(150, 66), 30, 10, 62, [12, 20]), ...grove(P(250, -50), 14, 5, 63)],
      buildings: [{ at: P(60, -110), w: 80, d: 40, h: 40, broken: true }, { at: P(170, -118), w: 60, d: 50, h: 70, broken: true, vines: true },
        { at: P(100, 118), w: 80, d: 40, h: 34, broken: true }, { at: P(220, 120), w: 60, d: 40, h: 52, broken: true }, { at: P(320, 10), w: 90, d: 26, h: 30, broken: true }],
      el: [{ pts: [P(305, 170), P(305, -55)], y: 14, w: 9, broken: true, label: 'the El behind the green' }],
      wrecks: [{ type: 'car', at: P(36, -34), rot: 0.5 }],
      targets: [{ name: 'Lay-up right', at: P(200, 30) }, { name: 'Run it on from the right', at: P(248, 16), bold: true }],
      words: {
        plays: 'A city square gone wild: stands of big trees down both sides, the old fountain in front-left of a green raised on the plaza steps, and the El on its girders behind.',
        safe: 'Lay up right of the fountain, 180 to 200 m, for a straight-in wedge.',
        bold: 'Drive it: 250 m carry over the fountain\'s front-left corner to reach the green.',
        miss: 'The trees knock a wide drive down; the fountain catches the bold one that comes up short.',
      },
    }),
  }),

  // 7. THE BRIDGE: off the broken end of the expressway ramp, along the river to the suspension bridge
  hole({ n: 7, name: 'The Bridge', par: 5, legs: [[262, 0], [250, -30]], place: { at: [690, -160], heading: 262 }, base: 2, tips: [-68, 0],
    build: (P) => ({
      // the long par 5 (12 November 2026, Rhys's pick): the back tee 46 m up the expressway ramp, 560 -> 610 yd
      tees: { spire: -46, brick: 26, ivy: [72, -34], moss: [118, -36] },
      teeY: { spire: 13 },   // on the ramp's deck, which climbs away behind the hole (14 m at -70, 10 m at its end)
      prof: [[0, 10], [40, 10], [110, 0], [512, 0]],
      // the quake cracked the riverside street and tipped its slab: raised on the river side, falling 3% to the
      // right, its broken river-side edge a 5 m drop just past the rough
      cant: [[90, 390, 3]],
      sketch: { extra: [{ title: 'Hole 7: the tipped slab and its broken edge, from the raised side', from: [175, -38, 3.5], to: [300, -72, -5], fov: 60 }] },
      slabEdge: { s0: 80, s1: 385, off: -54, drop: 5, label: 'the slab\'s broken edge (5 m)' },
      fairway: [{ e: [[90, 16, 16], [140, 24, 26], [200, 30, 32], [250, 26, 24], [290, 20, 22], [340, 26, 24], [372, 20, 18]] }, { e: [[440, 16, 18], [475, 22, 22], [504, 15, 15]] }],
      corridor: 18,
      green: { rx: 16, rz: 17, lobes: [[0, 0, 9, 19, -35], [-4, -8, 6, 6, 0]], join: 4, pins: [[-6, 8], [6, -10], [-6, -4]], engine: { style: 'redan', shape: [] }, style: 'a Redan, long, running right to left by the north tower' },
      bunkers: [{ at: P(246, 33), rx: 15, rz: 7, rot: 0.1 }, { at: P(456, -20), rx: 12, rz: 6 }, { at: P(494, 20), rx: 8, rz: 6 }],
      inlet: { pts: [P(392, -120), P(400, -60), P(408, -10), P(410, 14)], w: 48, y: -1, label: 'where the bank fell in' },
      ramp: { from: P(-70, 0), to: P(-6, 0), w: 22, y: [14, 10], label: 'the expressway ramp' },  // ends flush behind the back tee
      bridgeDeck: { a: P(415, -60), b: P(440, -170), w: 20, label: 'the fallen span' },
      bridge: { a: P(478, -98), b: P(470, -262), h: 78, label: 'the bridge' },
      buildings: [{ at: P(80, 80), w: 60, d: 50, h: 20, broken: true, label: 'warehouses' }, { at: P(180, 86), w: 70, d: 50, h: 16, broken: true },
        { at: P(300, 86), w: 50, d: 60, h: 26, broken: true, vines: true }, { at: P(430, 90), w: 60, d: 50, h: 18, broken: true }, { at: P(560, 40), w: 40, d: 60, h: 34, broken: true }],
      wrecks: [{ type: 'car', at: P(150, -40), rot: 0.3 }, { type: 'bus', at: P(330, 40), rot: 2.8 }, { type: 'car', at: P(460, -22), rot: 1.0 }],
      trees: [...grove(P(220, 56), 14, 4, 71), ...grove(P(380, 50), 16, 5, 72)],
      targets: [{ name: 'Riverside', at: P(250, -6) }, { name: 'Short of the inlet', at: P(362, 6) }, { name: 'Over the inlet', at: P(452) }],
      words: {
        plays: 'Tee off the broken end of the riverside expressway ramp, 10 m up, and play along the river toward the suspension bridge. The quake tipped the street\'s slab: it falls 3% to the right, away from the water, and its raised river-side edge breaks off in a 5 m drop just past the rough. The bridge\'s middle span fell into the river, and where it hit, the bank broke away into an inlet that cuts across the second leg. The green sits under the north tower.',
        safe: 'Lay up short of the inlet (360 m) and pitch over it, or go round its end on the right on the strip of rubble.',
        bold: 'Carry the inlet with the second, about 190 m from a good drive, to the green by the north tower.',
        miss: 'Left goes over the slab\'s broken edge to a lie 5 m down, then the river (a stroke and a drop). Right is the warehouses and their loading yards; the sidehill feeds a fade that way.',
      },
    }),
  }),

  // 8. RIVERSIDE: from the waterline, round a dock basin, up to a green on the old wharf
  hole({ n: 8, name: 'Riverside', par: 4, legs: [[130, 0], [204.9, 22.1]], place: { at: [220, 40], heading: 286 }, base: 0, tips: [-35, 0],
    build: (P, L) => {
      // Proposal (round 4): a hook round the dock basin. The playing line now runs straight across the basin's
      // corner to the same pin; the fairway wraps round the basin on the left. Everything that stays is placed
      // from the old line (Q), so it doesn't move; `so` gives a hole-frame point as [s, off] on the new line.
      const Q = (s, o = 0) => at(lineOf([[228, 0], [120, 40]]), s, o), so = p => { const r = project(L, p[0], p[1]); return [r.s, r.off]; };
      const lobe = (p, ra, rc, rot = 0) => [...so(p), ra, rc, rot];
      return {
        cityLine: lineOf([[228, 0], [120, 40]]),
        tees: { spire: 0, brick: 24, ivy: [58, -34], moss: [96, -34] },
        prof: [[0, 0], [130, 0.4], [215, 3], [288, 6], [334.9, 8]],
        cant: [[140, 265, -2, -60, 25]],   // the quay leans gently away from the basin (high on the water side) across the fairway: the hole asks a lot already
        fairway: [{ lobes: [lobe([-3, -80], 30, 15), lobe([-6, -140], 36, 23), lobe([-12, -205], 40, 31, -4), lobe([-16, -238], 30, 32, 30),
          lobe([18, -262], 30, 24, 50), lobe([44, -284], 28, 21, 40), lobe([66, -304], 18, 14, 30)], join: 18, wob: 3 }],
        corridor: 18,
        green: { from: Q(228), rx: 15, rz: 16, lobes: [[0, 0, 9, 16, -25], [8, -4, 7, 7, 0], [7, 8, 6, 6, 0]], join: 3, pins: [[-5, 9], [8, -4], [-3, -5]], engine: { style: 'tilt', tilt: 1.5, side: 1, shape: [] }, style: 'a long green turned back-left on the wharf, the drop to the water on its right' },
        bunkers: [{ at: Q(338, -19), rx: 9, rz: 4, rot: 0.4, style: 'grass' }, { at: [-48, -238], rx: 13, rz: 7, rot: 0.2 }],
        water: [{ at: Q(203, 99), rx: 68, rz: 46, rot: 0.5, p: 3, y: -1, label: 'the dock basin' },
],
        wharf: { from: Q(240, 30), to: Q(360, 30), y: 8, label: 'the wharf wall' },
        cranes: [Q(320, 60), Q(380, 30)].map(p => ({ at: p, h: 38 })),
        buildings: [{ at: Q(300, -70), w: 50, d: 40, h: 18, broken: true }, { at: Q(390, -10), w: 30, d: 60, h: 22, broken: true, label: 'wharf sheds' }],
        wrecks: [{ type: 'car', at: Q(120, -40), rot: 0.2 }, { type: 'boat', at: Q(170, 80), rot: 0.9 }],
        trees: [...grove(Q(260, -46), 16, 5, 81)],
        targets: [{ name: 'Round the basin', at: [-14, -212] }, { name: 'Bite off the basin', at: [8, -247], bold: true }],
        words: {
          plays: 'You start down at the waterline on an old quay. The dock basin sits inside the bend on the right, and the fairway hooks round it to a green on the wharf, 8 m up, with the wall dropping to the water on its right. The straight line to the flag crosses the basin\'s corner.',
          safe: 'Drive left, wide of the basin, to the bend (210 m) and play a mid iron round the corner and up to the wharf.',
          bold: 'Cut the corner: drive along the basin\'s edge (about 250 m) to the far side of the hook for a wedge. The more you cut off, the more water you carry.',
          miss: 'Right is the basin all the way; the quay leans gently away from it. Left is rough, the old quay, then the river.',
        },
      };
    },
  }),

  // 9. THE RIFT: up a heaved street beside a chasm to the leaning clubhouse
  hole({ n: 9, name: 'The Rift', par: 4, legs: [[250, 0], [143, 12]], place: { at: [-60, 40], heading: 318 }, base: 2, tips: [-25, 25],
    build: (P) => ({
      tees: { spire: 0, brick: 22, ivy: [56, 36], moss: [96, 38] },
      prof: [[0, 0], [130, 5], [150, 10], [262, 16], [282, 21], [393, 28]],
      cant: [[60, 330, 3]],               // the slab falls to the right, away from the rift
      // Proposal (round 4): a fan. Narrow at the foot of the climb, squeezed between the rift and the rubble, it opens
      // as the heaved slab flattens out into the old civic plaza at the top: the further up you drive, the more room
      fairway: [{ e: [[70, 11, 13], [120, 13, 16], [175, 17, 21], [225, 20, 26], [255, 24, 30], [290, 30, 36], [325, 36, 40], [355, 32, 36], [374, 22, 22], [383, 14, 14]], wob: 1.4 }],
      corridor: 16,
      green: { rx: 15, rz: 17, lobes: [[0, -3, 11, 10, 0], [1, 10, 8, 8, 10]], join: 6, pins: [[1, 11], [-6, -5], [6, -4]], engine: { style: 'plateau', raise: 0.4, falseFront: 0.6, tilt: 1.5, shape: [] }, style: 'a pear up the line on a level shelf at the top, false front' },
      bunkers: [{ at: P(250, 39), rx: 14, rz: 7, rot: -0.1 }, { at: P(376, 20), rx: 8, rz: 5 }],
      rift: { pts: [P(50, -64), P(140, -58), P(240, -56), P(330, -64), P(380, -84)], w: 26, label: 'THE RIFT' },
      terraces: [{ s: 140, label: 'broken pavement step' }, { s: 272, label: 'second step' }],
      rubble: [{ at: P(180, 62), rx: 16, rz: 44, h: 3 }, { at: P(326, 70), rx: 14, rz: 30, h: 3 }],
      buildings: [
        { at: P(432, -6), w: 60, d: 34, h: 30, broken: false, lean: { dir: 'back', deg: 9 }, tower: { h: 30, w: 10 }, name: 'the clubhouse', label: 'the clubhouse (leaning)' },
        { at: P(120, 84), w: 40, d: 60, h: 36, broken: true }, { at: P(230, 92), w: 40, d: 70, h: 48, broken: true, vines: true },
        { at: P(340, 84), w: 40, d: 50, h: 26, broken: true }, { at: P(100, -120), w: 50, d: 60, h: 44, broken: true }, { at: P(290, -126), w: 60, d: 60, h: 60, broken: true },
      ],
      wrecks: [{ type: 'car', at: P(110, 40), rot: 0.6 }, { type: 'car', at: P(214, 34), rot: 1.8 }],
      trees: [...grove(P(400, 46), 12, 4, 91), ...grove(P(300, -36), 8, 2, 92, [7, 11])],
      targets: [{ name: 'First terrace', at: P(232, 4) }, { name: 'Top terrace', at: P(300, 4) }],
      words: {
        plays: 'The street tore open over the collapsed tunnel below and one side heaved up. You climb the tilted slab with the rift on your left, over two broken steps of pavement, to a green at the foot of the clubhouse, an old civic building that leans back on its foundations under its clock tower.',
        safe: 'Drive down the right half; the slab falls away from the rift, toward the buildings, so it never kicks you in. Second shot plays a club or two up the hill.',
        bold: 'A long drive up the left side reaches the top terrace and a level lie for a short iron.',
        miss: 'Left is the rift: open air, a drop beside where it went in. Right is rubble at the foot of the buildings.',
      },
    }),
  }),
];

// the city's landmarks (world), seen from other holes
export const LANDMARKS = [
  { id: 'el', name: 'The El', hole: 1 }, { id: 'tower', name: 'Broken Tower', hole: 4 }, { id: 'stadium', name: 'The Stadium', hole: 5 },
  { id: 'bridge', name: 'The bridge', hole: 7 }, { id: 'clock', name: 'The clock tower', hole: 9 },
];
