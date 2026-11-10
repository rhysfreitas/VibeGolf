// Rimeholm, plan book round 1: nine holes on a glacier in the far north, played at night under the aurora.
// Packed-snow fairways that run, powder rough, crevasses and a moulin that swallow a wild ball (open air),
// hot springs that keep the greens alive (warm moss in a ring of steam), a longship under the frozen lake and
// a woolly mammoth in a valley wall. Each hole is written in its own frame (metres; tee at the origin, the
// hole runs toward -z, x is right of the line, y up from the hole's `base`, the back tee's height), from
// `legs` ([length, turn in degrees, + = right]). `place` puts it on the glacier: world x east, -z north.
// Plan data for the book (plans, profiles, sketch views), written to convert to the engine format later.
import { lineOf, lengthOf, at, YD, rnd, headingAt } from './geo.mjs';

export const COURSE = {
  id: 'rimeholm', name: 'Rimeholm', theme: 'ice', altFt: 1200,
  signature: { time: 'night', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'cold', aurora: true },
  teeSets: [
    { id: 'mammoth', name: 'Mammoth', color: '#2f5fa8', minDrive: 260 },
    { id: 'raven', name: 'Raven', color: '#f2efe6', minDrive: 230 },
    { id: 'lynx', name: 'Lynx', color: '#c94a3a', minDrive: 200 },
    { id: 'hare', name: 'Hare', color: '#e0b84a', minDrive: 0 },
  ],
};

// stunted spruce round the hot springs and down the lower valley: n trees scattered round a point
const grove = (p, r, n, seed, h = [6, 11]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: 1.6 + R() * 1.4, h: h[0] + R() * (h[1] - h[0]) }; }); };
// erratic boulders: n round a point
const erratics = (p, r, n, seed, sz = [2, 6]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r, s = sz[0] + R() * (sz[1] - sz[0]); return { at: [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], r: s, h: s * (0.7 + R() * 0.5) }; }); };

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1);
  // tee spots: a number is s along the line; [s, off] a pad beside it
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) { const s = typeof v === 'number' ? v : v[0]; h.yards[k] = Math.round((len - s) / YD / 5) * 5; }
  return { ...def, ...h };
}
// a crevasse along [s, off] points, w wide; lip: { h, toward: [s, off], run, fall } raises one side.
// open: false makes it a scarp (a jagged step with no slit). Built by shapes.mjs makeCrack.
let cvSeed = 1;
const cv = (P, pts, w, lip, more = {}) => ({ pts: pts.map(p => P(...p)), w, seed: cvSeed++, lip: lip && { ...lip, toward: P(...lip.toward) }, ...more });

export const HOLES = [
  // 1. THE ICE GATE: out of the mouth of an ice cave, off a ledge 30 m down to a fairway bending right
  hole({ n: 1, name: 'The Ice Gate', par: 4, legs: [[240, 0], [126, 30]], base: 130, place: { heading: 4 },
    build: (P) => ({
      tees: { mammoth: 0, raven: 20, lynx: [80, -48], hare: [118, -46] },
      prof: [[0, 0], [24, 0], [100, -25], [170, -28.5], [240, -29.5], [366, -30]],
      cant: [[150, 330, 2]],
      fw: [{ e: [[92, 14, 14], [120, 22, 26], [175, 30, 28], [205, 28, 21], [245, 24, 30], [275, 16, 18], [300, 13, 15], [330, 18, 22], [352, 14, 15]], wob: 6 }],
      cracks: [cv(P, [[166, 50], [190, 44], [214, 47], [240, 54]], 7, { h: 3, toward: [200, 100], run: 10, fall: 10 }),
        cv(P, [[184, 70], [210, 66], [236, 74]], 4, { h: 2, toward: [210, 110], run: 8, fall: 8 })],
      voidLabels: [[[204, 47], 'crevasse']],
      corridor: 22, steep: 'ice',
      cave: { s0: -46, s1: 22, w: 34, h: 58, roof: 47, label: 'the ice cave' },
      sketch: { tee: { back: 22, fov: 72 } },
      forms: [{ at: P(262, 66), rx: 50, rz: 15, rot: 0.55, h: 7, surf: 'ice', label: 'ice ridge' }],
      green: { lobes: [[-3, -8, 10, 9, 25], [-3, 9, 10, 9, -25], [3, 0, 9, 12, 0]], tilt: { side: -1, pct: 1.5 }, style: 'A kidney wrapped round the hot spring on its left, leaning 1.5% toward it, on a low shelf' },
      water: [{ at: P(372, -34), rx: 16, rz: 13, spring: true, label: 'the first hot spring' }],
      bunkers: [{ at: P(334, 26), rx: 9, rz: 6 }, { at: P(386, 20), rx: 7, rz: 5 }],
      boulders: [...erratics(P(196, -62), 18, 6, 11), ...erratics(P(150, 58), 14, 4, 12)],
      trees: [...grove(P(392, -52), 14, 6, 13)],
      targets: [{ name: 'The corner', at: P(240, -6) }],
      words: {
        plays: 'The back tees stand in the mouth of an ice cave: you hit out of blue darkness and the glacier opens up below, the aurora over it. The ledge drops 30 m to a wide fairway of packed snow that bends right round a low ice ridge. It runs: a drive that lands on the slope can roll out a long way. The green sits on a shelf by the first hot spring, steam drifting over it.',
        safe: 'Drive at the corner (240 m) and play a short iron to the green.',
        bold: 'Cut the corner over the ice ridge on the right: a shorter second, but the ridge kicks a short drive into the powder.',
        miss: 'Left is powder and a field of boulders. Right, where drives land, a crevasse bites in, its far lip raised 3 m in a jagged ice wall; past it, the ice ridge.',
      },
    }),
  }),

  // 2. THE HOT SPRINGS: up four steaming travertine terraces, a dogleg left, pools down the right
  hole({ n: 2, name: 'The Hot Springs', par: 4, legs: [[205, 0], [133, -34]], base: 99, place: { heading: 60, walk: [70, 10] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 20, lynx: [62, 42], hare: [98, 42] },
      prof: [[0, 0], [85, 0], [105, 3.5], [150, 3.5], [170, 7], [222, 7], [242, 10.5], [282, 10.5], [302, 14], [338, 14.5]],
      cant: [[60, 300, 1.5]], rims: true,
      fw: [{ e: [[58, 16, 16], [85, 24, 24], [130, 30, 24], [175, 28, 21], [205, 34, 22], [240, 26, 20], [275, 18, 18], [300, 20, 16], [326, 13, 13]], wob: 5.5 }],
      corridor: 18, steep: 'travertine',
      green: { lobes: [[0, -4, 11, 10, 0], [2, 13, 12, 10, 12]], join: 6, tier: { s: 340, h: 0.9 }, style: 'A peanut along the line, pinched at the waist, two tiers on the top terrace (the upper at the back)' },
      water: [{ at: P(126, 52), rx: 24, rz: 15, label: 'warm pool' }, { at: P(194, 50), rx: 22, rz: 14, label: 'warm pool' },
        { at: P(262, 44), rx: 20, rz: 13, label: 'warm pool' }, { at: P(312, 40), rx: 14, rz: 10 }],
      bunkers: [{ at: P(214, -36), rx: 12, rz: 7, rot: -0.3 }, { at: P(322, -22), rx: 8, rz: 6 }],
      boulders: [...erratics(P(150, -64), 16, 5, 21)],
      trees: [...grove(P(230, -66), 16, 7, 22), ...grove(P(90, 70), 12, 4, 23)],
      targets: [{ name: 'The second terrace', at: P(200, 4) }],
      words: {
        plays: 'The hole climbs a hillside of white travertine, the mineral terraces a hot spring builds, in four steps of about 3.5 m. Warm blue pools steam on the shelves down the right, and the fairway leans 1.5% toward them. Where the ball stops sets the lie: on a shelf it is flat, short of a step it is uphill. The green sits on the top terrace in two tiers.',
        safe: 'Drive to the second terrace (200 m), at the bend, and play up to the green.',
        bold: 'Drive over the bend on the left to the third terrace: a wedge in, but a powder bunker sits in the corner.',
        miss: 'Right is the pools: a stroke and a drop. Left is powder and spruce on the slope.',
      },
    }),
  }),

  // 3. THE LONGSHIP: a par 3 off a moraine bluff over the frozen lake, a longship under the ice
  hole({ n: 3, name: 'The Longship', par: 3, legs: [[151, 0]], base: 115, place: { heading: 102, walk: [60, 40] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 12, lynx: 26, hare: [56, -54] },
      prof: [[0, 0], [16, 0], [50, -13.5], [151, -13.5]],
      corridor: 10, steep: 'rock',
      lake: { at: P(90, 12), rx: 50, rz: 40, y: -14.2, label: 'the frozen lake' },
      lead: { pts: [P(60, -12), P(82, 14), P(106, 46)], w: 8, label: 'open water' },
      longship: { at: P(90, 8), len: 28, beam: 6, rot: 0.55, label: 'the longship (under the ice)' },
      green: { lobes: [[-12, -3, 8, 7, -30], [12, -3, 8, 7, 30], [0, 3, 10, 8, 0]], raise: 1.6, falseFront: true, style: 'A crescent across the line, its horns reaching toward the tee round a pot bunker; raised 1.6 m with a false front down to the ice' },
      extraFw: [{ at: P(108, -56), rx: 14, rz: 26 }],
      bunkers: [{ at: P(162, -18), rx: 7, rz: 5 }, { at: P(145, 0), rx: 5, rz: 3.5 }],
      boulders: [...erratics(P(20, -40), 16, 5, 31), ...erratics(P(40, 44), 14, 4, 32)],
      targets: [],
      words: {
        plays: 'From a bluff of moraine 14 m above the lake. Under the clear ice of the line lies a Viking longship, lit faintly from below. The ice is fast: a ball that lands on it skates on toward the shore. A lead of open black water runs across part of the carry. The green sits up on the far shore with a false front, so a shot that comes up short rolls back onto the ice.',
        safe: 'Play to the left shore, on the short grass round the lake, and chip on.',
        bold: 'Carry it all the way to the green, over the lead.',
        miss: 'Into the lead is a stroke and a drop. Short on the ice skates on toward the false front and back.',
      },
    }),
  }),

  // 4. THE CREVASSE FIELD: a par 5 S-bend through crevasses, down into a trough, then up two ramps
  hole({ n: 4, name: 'The Crevasse Field', par: 5, legs: [[190, 0], [160, 24], [144, -30]], base: 102, place: { heading: 128, walk: [70, 30] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 24, lynx: [72, -42], hare: [112, -42] },
      prof: [[0, 0], [28, 0], [110, -8], [195, -8], [245, 0], [262, 2.5], [285, 0.5], [330, 1.5], [390, 8], [494, 8]],
      cant: [[250, 400, 1.5]],
      fw: [{ e: [[68, 18, 18], [100, 26, 24], [150, 30, 28], [190, 30, 30], [225, 28, 26], [270, 24, 22], [320, 26, 24], [355, 22, 24], [385, 16, 20], [398, 10, 12]], wob: 6 },
        { e: [[436, 14, 16], [456, 18, 20], [482, 13, 13]], wob: 3 }],
      extraFw: [{ at: P(420, 44), rx: 14, rz: 30, rot: -0.1 }],
      corridor: 20, steep: 'ice',
      cracks: [cv(P, [[108, 44], [140, 56], [172, 72]], 6, { h: 2.5, toward: [150, 140] }), cv(P, [[128, 62], [160, 74], [198, 96]], 7, { h: 3, toward: [170, 150] }),
        cv(P, [[98, 74], [124, 84], [150, 102]], 5, { h: 2, toward: [130, 150] }),
        cv(P, [[248, -44], [282, -50], [318, -52]], 8, { h: 3, toward: [290, -120] }), cv(P, [[276, -66], [310, -70], [344, -78]], 6, { h: 2.5, toward: [310, -140] }),
        cv(P, [[408, -76], [413, -42], [420, -8], [426, 26]], 12, { h: 4, toward: [450, 0], run: 90, fall: 20, end: 40 }, { jag: 3.5 })],
      voidLabels: [[[150, 74], 'crevasses'], [[300, -66], 'crevasses'], [[418, -20], 'the last crevasse']],
      arch: { a: [...P(404, -46), 0], b: [...P(434, -44), 0], h: 9, w: 7, t: 3, label: 'ice bridge' },
      sketch: { green: { back: 100, off: 8 }, land: { eye: 7 } },
      cliffs: [{ at: P(538, -4), rx: 70, rz: 20, rot: -0.1, h: 22, surf: 'ice', label: 'ice cliff' }],
      green: { lobes: [[0, -3, 9, 14, 0], [-10, 8, 10, 6, 0]], tilt: { front: 1, pct: 2 }, style: 'An L: a long front leg and a wing at the back left, tilted 2% toward the front, on the shelf under the ice cliff' },
      bunkers: [{ at: P(470, -22), rx: 9, rz: 6 }],
      boulders: [...erratics(P(220, 62), 16, 5, 41)],
      targets: [{ name: 'The trough', at: P(205, -4) }, { name: 'Short of the crevasse', at: P(378, 4) }],
      words: {
        plays: 'The fairway weaves through a field of crevasses. The drive drops 8 m into a snow trough; from there two ramps climb with a blind crest between them, and the second leg leans away from the crevasses on its left. A last crevasse 12 m wide cuts across the line short of the green, and its far side is a shelf 4 m higher: a jagged ice face you play up onto. An ice bridge arches over its left end, and the way round on the right climbs a ramp onto the shelf. The green sits on the shelf under an ice cliff.',
        safe: 'Drive into the trough, lay up short of the last crevasse (390 m), and pitch over it, or play round its right end.',
        bold: 'From a good drive, a fairway wood over the last crevasse to the green in two.',
        miss: 'Right of the first leg and left of the second, a miss falls into a crevasse: a stroke and a drop back on the line it went in. An approach that comes up short hits the shelf\'s face and drops into the last one.',
      },
    }),
  }),

  // 5. THE SERACS: a drivable par 4 off the lip of the icefall, through a gap in the ice pillars
  hole({ n: 5, name: 'The Seracs', par: 4, legs: [[274, 0]], base: 112, place: { heading: 176, walk: [70, -40] },
    build: (P) => {
      const S = [[150, -14, 4, 16], [162, -26, 5, 22], [176, -13, 4.5, 18], [190, -30, 5, 24], [200, -16, 4, 15], [212, -40, 6, 20], [170, -42, 5, 19],
        [150, -38, 4, 14], [222, -24, 4, 13], [186, -50, 4, 16], [156, 13, 4, 15], [172, 16, 5, 20], [188, 11, 4, 17], [204, 17, 4.5, 14], [216, 10, 3.5, 12]];
      return {
        tees: { mammoth: 0, raven: 14, lynx: [92, -36], hare: [130, -24] },
        prof: [[0, 0], [10, 0], [68, -28], [105, -30.5], [150, -31.2], [172, -31.8], [274, -35]],
        fw: [{ e: [[96, -24, 58], [130, -24, 68], [170, -25, 72], [200, -24, 70], [230, -14, 54], [246, -2, 30]], wob: 5.5 },
          { e: [[224, 12, 10], [242, 16, 16], [262, 14, 14]], wob: 3 }],
        cracks: [cv(P, [[158, -120], [163, -40], [157, 10], [166, 100]], 0, { h: 3.5, toward: [120, 0], run: 55, fall: 25, face: 2.5 }, { open: false, jag: 5 })],
        corridor: 22, steep: 'ice',
        seracs: S.map(([s, o, r, hh], i) => ({ at: P(s, o), r, h: hh, seed: 500 + i })),
        green: { lobes: [[0, 0, 7, 19, 28], [6, 12, 7, 6, 0]], tier: { s: 268, h: 0.9 }, style: 'Long and thin, set diagonally from front left to back right, with a knob at the back; two tiers, the lower at the front' },
        bunkers: [{ at: P(256, -21), rx: 8, rz: 6 }, { at: P(284, 17), rx: 7, rz: 5 }],
        boulders: [...erratics(P(120, -60), 18, 6, 51)],
        targets: [{ name: 'Right of the seracs', at: P(195, 36) }],
        boldNote: 'the gap in the seracs, on the line',
        words: {
          plays: 'The tee stands on the lip of the icefall, looking straight down on the hole 35 m below. The landing area is two benches split by a jagged ice scarp, 3.5 m high, that zigzags right across the hole: a drive that runs over it drops to the lower bench. A stand of seracs, tall pillars of ice, guards the straight line to the green, with a gap about 15 m wide on the line itself.',
          safe: 'Drive right of the seracs onto the wide bench (195 m) and pitch in.',
          bold: 'Drive through the gap: from this height a good drive can run up onto the green.',
          miss: 'Into the seracs, the ball hits the ice and drops dead at their feet in broken ice. Left of them is powder and boulders.',
        },
      };
    },
  }),

  // 6. THE FROZEN FALLS: a blind par 3 up to a shelf above a frozen waterfall
  hole({ n: 6, name: 'The Frozen Falls', par: 3, legs: [[165, 0]], base: 76, place: { heading: 222, walk: [60, 30] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 12, lynx: 28, hare: [50, -34] },
      prof: [[0, 0], [20, 0], [96, 1.5], [108, 3], [127, 17], [138, 18], [165, 18]],
      corridor: 12, steep: 'rock',
      falls: { s0: 104, s1: 130, off: [-34, 34], label: 'the frozen falls' },
      sketch: { green: { back: 30 } },
      rubble: [{ at: P(100, 0), rx: 70, rz: 9, label: 'broken ice at the foot' }],
      green: { lobes: [[-7, -3, 8, 8, 0], [7, -3, 8, 8, 0], [0, 6, 8, 8, 0], [0, 0, 6, 6, 0]], crown: 0.5, apron: 12, style: 'A three-leaf clover, gently crowned, with short grass all round it on the shelf' },
      bunkers: [{ at: P(184, 12), rx: 6, rz: 5 }],
      boulders: [...erratics(P(60, 46), 16, 5, 61), ...erratics(P(70, -50), 14, 4, 62)],
      targets: [],
      words: {
        plays: 'The green sits on a shelf 18 m up, above a waterfall frozen solid as it fell: a cascade of ice down the face you hit over. You can\'t see the putting surface from the tee, only the lip and the steam rising off the green behind it. Short grass runs all round the green on the shelf, so a near miss stays up.',
        safe: 'Take one more club than the yardage and aim at the steam.',
        bold: 'There is no bold line: the shelf is the only target.',
        miss: 'Short, the ball hits the ice face and drops 18 m back to its foot into broken ice. Long is a bunker and the snow behind.',
      },
    }),
  }),

  // 7. THE MOULIN: a par 4 cape right round a great meltwater shaft, up to a crest and down to a Redan
  hole({ n: 7, name: 'The Moulin', par: 4, legs: [[200, 0], [184, 40]], base: 93, place: { heading: 262, walk: [60, -20] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 22, lynx: [70, -50], hare: [110, -50] },
      prof: [[0, 0], [50, 0], [195, 8.5], [232, 11], [262, 8], [330, 0], [384, -2]],
      cant: [[232, 340, -1.5]],
      fw: [{ e: [[68, 22, 14], [100, 32, 20], [150, 36, 17], [170, 36, 14], [190, 34, 17], [215, 30, 20], [245, 26, 20], [280, 22, 24], [320, 24, 26], [350, 20, 22], [372, 14, 15]], wob: 5.5 }],
      cracks: [cv(P, [[255, -46], [290, -50], [330, -44]], 6, { h: 3, toward: [290, -100], run: 10, fall: 8 }),
        cv(P, [[150, 106], [138, 146]], 4, { h: 2, toward: [120, 130] }), cv(P, [[188, 106], [204, 150]], 5, { h: 2, toward: [220, 130] }), cv(P, [[212, 84], [248, 108]], 4, { h: 1.5, toward: [240, 90] })],
      voidLabels: [[[292, -50], 'crevasse']],
      corridor: 18, steep: 'ice',
      moulin: { at: P(170, 66), r: 42, label: 'the moulin' },
      green: { lobes: [[0, 0, 8, 19, -40], [-7, 10, 8, 7, 0]], redan: 2.5, style: 'A Redan: long, set diagonally from front right to back left, and falling away 2.5% that way' },
      bunkers: [{ at: P(394, -20), rx: 9, rz: 6 }, { at: P(368, 20), rx: 8, rz: 5 }],
      boulders: [...erratics(P(150, -60), 16, 6, 71)],
      targets: [{ name: 'Left of the crest', at: P(205, -12) }, { name: 'Over the moulin', at: P(268, 6), bold: true }],
      boldLine: [[0, 0], P(290)],
      words: {
        plays: 'A moulin is a shaft that meltwater bores down through a glacier: here a round pit 84 m across, glowing blue far down. The fairway capes round its left side, climbing 11 m to a crest where the drives land, then falls 13 m round the pit to a Redan green. From short of the crest the green is hidden. The second leg leans away from the pit.',
        safe: 'Drive left, up to the crest (205 m), and play the second blind over it.',
        bold: 'Carry the near side of the moulin (about 210 m) onto the second leg: a shorter, open shot in.',
        miss: 'Right is the moulin: open air, a stroke and a drop, with cracks splitting off it into the snow. Left of the second leg, a crevasse with a raised lip waits for a hook.',
      },
    }),
  }),

  // 8. THE MAMMOTH: a par 5 dogleg left along an esker, down a valley step, to a true punchbowl
  hole({ n: 8, name: 'The Mammoth', par: 5, legs: [[262, 0], [213, -36]], base: 90, place: { heading: 252, walk: [70, 40] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 22, lynx: [66, -44], hare: [108, -44] },
      prof: [[0, 0], [262, -2], [300, -3], [336, -14], [388, -14], [442, -5], [475, -5]],
      cant: [[40, 290, -2]],
      esker: { s0: -30, s1: 300, w: 84, h: 7, fall: 30, label: 'the esker' },
      walls: [{ side: -1, s0: 250, s1: 540, off: 84, h: 32, bank: 22, label: 'the valley wall' }, { side: 1, s0: 270, s1: 540, off: 100, h: 24, bank: 26 }],
      fw: [{ e: [[68, 18, 18], [110, 26, 24], [160, 28, 28], [210, 30, 26], [250, 28, 22], [280, 22, 20], [298, 16, 16]], wob: 5.5 },
        { e: [[344, 30, 1], [380, 36, 2], [415, 32, 1], [436, 22, 2]], wob: 4.5 },
        { e: [[346, -19, 38], [385, -18, 46], [425, -17, 44], [450, -15, 30]], wob: 4.5 }],
      cracks: [cv(P, [[336, 11], [365, 7], [395, 11], [425, 8], [442, 10]], 6, { h: 3, toward: [390, -20], run: 30, fall: 10, end: 25 })],
      voidLabels: [[[400, 10], 'the split']],
      corridor: 20, steep: 'ice',
      mammoth: { at: P(436, -86), face: 1, label: 'the mammoth (in the ice)' },
      sketch: { green: { back: 75, off: -22, eye: 12 } },
      green: { lobes: [[-3, -2, 10, 8, 30], [8, 7, 9, 8, 30]], join: 6, punch: { depth: 3.5, floor: 4, bank: 12 }, style: 'A bean set diagonally, in a true punchbowl: the ground runs level, then the green sits 3.5 m down in a hollow whose short-grass banks feed the ball in' },
      bunkers: [{ at: P(352, -26), rx: 11, rz: 7 }, { at: P(250, 30), rx: 10, rz: 6 }],
      boulders: [...erratics(P(330, 20), 20, 8, 81), ...erratics(P(160, -64), 14, 4, 82)],
      trees: [...grove(P(390, 70), 16, 7, 83), ...grove(P(470, 64), 12, 5, 84)],
      targets: [{ name: 'The esker', at: P(245, -4) }, { name: 'The high side', at: P(392, -14) }, { name: 'The low side', at: P(412, 26), bold: true }],
      words: {
        plays: 'The drive runs along the broad back of an esker, a long ridge a river under the ice left behind, leaning 2% into the dogleg. The second drops 11 m down a valley step to the valley floor, where a long crevasse splits the fairway in two: the left side rides 3 m up on the crevasse\'s lip, wide and flat, with a view down into the green; the right side is lower and narrower but runs 15 m closer. In the valley wall on the left a woolly mammoth lies frozen in the ice, its tusks breaking out near the green. The last 100 m rises to level ground, then the green sits down in a true punchbowl.',
        safe: 'Drive along the esker (245 m), lay up on the high side (about 390 m), and pitch into the bowl.',
        bold: 'Lay up on the low side, closer but narrower, or take on the bowl in two: anything near it feeds in.',
        miss: 'Off the esker the ball runs down its side into powder. Between the two halves of the second leg is the crevasse. Left of it all is the valley wall: a wall of ice that drops a ball dead at its foot.',
      },
    }),
  }),

  // 9. THE AURORA HALL: a sidehill climb of 38 m up two ramps to the longhouse
  hole({ n: 9, name: 'The Aurora Hall', par: 4, legs: [[215, 6], [160, -12]], base: 82, place: { heading: 358, walk: [60, 110] },
    build: (P) => ({
      tees: { mammoth: 0, raven: 22, lynx: [64, 46], hare: [104, 48] },
      prof: [[0, 0], [30, 0], [150, 15], [195, 17], [308, 33], [330, 34.5], [342, 38], [375, 38.5]],
      cant: [[30, 320, 3]],
      walls: [{ side: -1, s0: -40, s1: 460, off: 66, h: 22, bank: 32, label: 'the ridge' }],
      fw: [{ e: [[66, 18, 20], [95, 24, 28], [140, 26, 32], [180, 28, 30], [210, 30, 26], [240, 26, 24], [270, 20, 22], [300, 18, 20], [328, 13, 15]], wob: 5.5 }],
      cracks: [cv(P, [[252, -47], [278, -53], [306, -47]], 5, { h: 3, toward: [280, -100], run: 10, fall: 10 })],
      voidLabels: [[[280, -52], 'crevasse']],
      corridor: 22, steep: 'rock',
      green: { lobes: [[0, 8, 16, 7, 0], [0, -2, 8, 9, 0]], apron: 6, style: 'A T: wide across the back below the hall, narrower at the front; raised, with a false front' },
      hall: { at: P(418, 2), w: 58, d: 18, h: 7, roof: 9, label: 'the hall (clubhouse)' },
      bunkers: [{ at: P(236, -34), rx: 12, rz: 7 }, { at: P(320, -22), rx: 8, rz: 6 }],
      boulders: [...erratics(P(120, 60), 18, 5, 91)],
      trees: [...grove(P(260, 66), 14, 5, 92)],
      targets: [{ name: 'The first ramp', at: P(205, -4) }],
      words: {
        plays: 'The finish climbs 38 m across the side of a ridge to the hall, a Norse longhouse of timber and stone lit gold, with carved heads on its gables. The fairway climbs in two ramps and leans 3% toward the low side on the right. The green is raised with a false front. The aurora is brightest straight overhead.',
        safe: 'Drive up the left half of the first ramp (205 m) and let the lean bring it back; then a club more for the climb.',
        bold: 'Drive over the left-hand bunker to the foot of the second ramp for a shorter, flatter second.',
        miss: 'Left climbs into the ridge\'s rocks and powder, and a crevasse with a raised lip cuts along the second ramp. Right is the low side: powder and the odd spruce, but a clear shot back.',
      },
    }),
  }),
];

// place the holes on the glacier: hole 1's back tee at the origin; each next back tee a short walk from the
// last green ([metres, bearing relative to the last hole's final heading]), turned to its own compass heading
{
  let pos = [0, 0], prevEnd = null;
  for (const h of HOLES) {
    if (prevEnd) {
      const [d, rel] = h.place.walk || [60, 0], b = (prevEnd.heading + rel) * Math.PI / 180;
      pos = [prevEnd.at[0] + Math.sin(b) * d, prevEnd.at[1] - Math.cos(b) * d];
    }
    h.place.at = pos;
    const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
    const [x, z] = h.pin, end = headingAt(h.line, h.len - 1) * 180 / Math.PI;
    prevEnd = { at: [pos[0] + x * rx + (-z) * fx, pos[1] + x * rz + (-z) * fz], heading: h.place.heading + end };
  }
}
