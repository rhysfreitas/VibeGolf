// The Lost Valley, plan book round 1: nine holes in a hidden valley walled in by the cliffs of a table mountain,
// golden afternoon after rain. The round starts and ends at the expedition camp on a ledge 30 m up the south wall:
// the 1st drops off its bluff onto the valley floor, 2-8 wander the floor (the cycad grove, the tar pit, the
// braided river, the plunge pool under the Great Falls, the Strangler, the Bone Bluff, the swamp), and the 9th
// climbs a broad ramp back up to the ledge beside Camp Falls.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the
// line, y up from the hole's `base`, the back tee's height), from `legs` ([length, turn in degrees, + = right]).
// `place` puts it in the valley (world.mjs): world x east, -z north. Heights come from the valley under the line
// (scene.mjs) plus the hole's own shapes. Plan data for the book (plans, profiles, sketch views), written to
// convert to the engine format later.
import { lineOf, lengthOf, at, YD, rnd } from './geo.mjs';

export const COURSE = {
  id: 'lostvalley', name: 'The Lost Valley', theme: 'jungle', altFt: 1320,
  signature: { time: 'afternoon', light: 'golden, after rain', wind: 'calm', weather: 'clearing', temp: 'warm', mist: true },
  teeSets: [
    { id: 'titan', name: 'Titan', color: '#2f3a26', minDrive: 260 },
    { id: 'rex', name: 'Rex', color: '#a3432a', minDrive: 230 },
    { id: 'raptor', name: 'Raptor', color: '#d8b25a', minDrive: 200 },
    { id: 'compy', name: 'Compy', color: '#9cc879', minDrive: 0 },
  ],
};
export const BACK = 'titan', FRONT = 'compy';

// trees scattered round a point, of one kind: cycad, fern (tree fern), conifer (monkey-puzzle), broad (broadleaf),
// cypress (swamp cypress, standing in the water)
const SIZE = { cycad: [[2.6, 4.5], [1.6, 2.6]], fern: [[6, 10], [2.2, 3.4]], conifer: [[24, 38], [4.5, 7]], broad: [[14, 24], [6, 10]], cypress: [[18, 28], [4, 6.5]] };
const grove = (p, r, n, seed, kind = 'broad') => { const R = rnd(seed), [hh, rr] = SIZE[kind]; return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { kind, x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: rr[0] + R() * (rr[1] - rr[0]), h: hh[0] + R() * (hh[1] - hh[0]) }; }); };
// a mixed stand: mostly one kind with the others under it
const stand = (p, r, n, seed, kinds) => kinds.flatMap(([k, f], i) => grove(p, r, Math.max(1, Math.round(n * f)), seed * 7 + i, k));
// sandstone boulders: n round a point
const blocks = (p, r, n, seed, sz = [2, 5]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r, s = sz[0] + R() * (sz[1] - sz[0]); return { at: [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], r: s, h: s * (0.6 + R() * 0.5) }; }); };

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1);
  // tee spots: a number is s along the line; [s, off] a pad beside it
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) { const s = typeof v === 'number' ? v : v[0]; h.yards[k] = Math.round((len - s) / YD / 5) * 5; }
  // the spot for a future tips tee (a fifth set at tour length): behind the back tee, about 35-40 yd on the par 4s
  // and 5s, 15 on the par 3s; [s, off] with s < 0. Plan only until the tee set exists
  const tp = def.tips || h.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  return { ...def, ...h };
}

export const HOLES = [
  // 1. THE OVERLOOK: off the bluff by the camp, 28 m down to the valley floor, dogleg right
  hole({ n: 1, name: 'The Overlook', par: 4, legs: [[245, 0], [130, 45]], place: { at: [-80, 5], heading: 12 }, flat: 8, fade: 30,
    build: (P) => ({
      tees: { titan: 0, rex: 18, raptor: [96, 40], compy: [134, 48] },
      fw: [{ e: [[78, 15, 15], [110, 22, 24], [160, 26, 30], [205, 30, 33], [245, 32, 30], [275, 30, 22], [310, 20, 17], [345, 14, 13]], wob: 5.5 }],
      corridor: 18,
      cant: [[150, 300, 3]],   // the landing area falls to the right, toward the corner and the green's open side
      // inside the corner: a stand of tree ferns and cycads the bold drive carries, with a big bunker in front of it
      trees: [...stand(P(250, 58), 26, 18, 11, [['fern', 0.6], ['cycad', 0.4]]), ...stand(P(330, 46), 16, 8, 12, [['fern', 0.5], ['broad', 0.2], ['cycad', 0.3]]),
        ...grove(P(120, -70), 22, 5, 13, 'conifer'), ...grove(P(210, -88), 26, 6, 14, 'broad')],
      bunkers: [{ at: P(228, 40), rx: 17, rz: 12, rot: 0.4, job: 'carry' }, { at: P(346, -16), rx: 7, rz: 5 }, { at: P(368, -14), rx: 6, rz: 4.5 }],
      green: { lobes: [[-4, 7, 7, 12, -32], [4, -5, 8, 10, -32], [7, 4, 5, 6, 0]], contour: [{ fall: -40, pct: 1.8 }, { bowl: [-4, 9], r: 11, h: 0.3 }], style: 'A kidney set from front right to back left, its waist pinched by a bunker on the left, falling 1.8% toward the front left, with a shallow bowl in the back-left lobe that gathers to a back pin: open from the right, the bold side' },
      boulders: [...blocks(P(64, 40), 16, 6, 15, [3, 7]), ...blocks(P(70, -40), 14, 5, 16, [3, 6])],
      spire: { at: P(70, -36), h: 38, label: 'the spire (the pterosaur)' },
      targets: [{ name: 'The floor', at: P(238, -6) }],
      words: {
        plays: 'The opener, from a bluff beside the expedition camp, 30 m up the valley\'s south wall. The whole valley opens below you: the braided river, the swamp steaming in the sun, the herd grazing on the plain far ahead-left, the walls rising sheer all round with falls pouring off them. On the round\'s very first shot a big crested pterosaur launches off the rock spire just left of the tee and glides out below you, banking slowly away toward the herd. The drive carries the bluff\'s jungle-clad face onto the floor; the fairway bends right round a stand of tree ferns and cycads, and the landing area falls 3% to the right, so a drive feeds round toward the corner. Wide and generous.',
        safe: 'Drive down onto the floor (238 m), left of the tree ferns, and play a short iron in.',
        bold: 'Cut the corner over the tree ferns: a wedge in, but the bunker in front of them catches a drive that comes up short.',
        miss: 'Short off the tee is the bluff\'s face: jungle and rock, a hard lie well below. Right is the tree-fern stand, which knocks a ball down. Left is open fern meadow.',
      },
    }),
  }),

  // 2. CYCAD GROVE: dogleg left between stands of cycads and tree ferns, the fairway canting toward them, 8 m down
  hole({ n: 2, name: 'Cycad Grove', par: 4, legs: [[232, 0], [134, -40]], place: { at: [110, -350], heading: 350 }, tips: [-30, 30],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [66, 36], compy: [106, 42] },
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 27, 29], [200, 26, 32], [238, 28, 30], [268, 22, 23], [300, 16, 17], [338, 13, 14]], wob: 5 }],
      corridor: 18,
      cant: [[150, 290, -3]],   // toward the grove: the high right side gets the angle into the green
      // the groves: cycads in the corner (inside the dogleg, left) and a long stand of tree ferns down the right
      trees: [...stand(P(200, -64), 32, 30, 21, [['cycad', 0.55], ['fern', 0.35], ['conifer', 0.1]]), ...stand(P(275, -58), 24, 16, 22, [['cycad', 0.5], ['fern', 0.5]]),
        ...stand(P(150, 66), 28, 14, 23, [['fern', 0.6], ['broad', 0.4]]), ...stand(P(330, 50), 20, 8, 24, [['fern', 0.5], ['conifer', 0.5]])],
      bunkers: [{ strip: [[176, 45, -26], [200, 50, -28], [226, 51, -28], [250, 47, -25]], wob: 3, job: 'catch' },
        { at: P(342, 17), rx: 8, rz: 5 }, { at: P(372, -13), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 7, 17, 30], [-5, -9, 6, 6, 0]], contour: [{ fall: 0, pct: 1.5 }, { tier: [1.5, 5], up: 180, h: 0.5, w: 4 }], style: 'Long and thin, set from front left to back right with a knob at the front left, falling 1.5% toward the front, two tiers (the upper at the back, 0.5 m up): open from the right, where the strip bunker guards the fairway' },
      boulders: [...blocks(P(120, -60), 12, 3, 25)],
      targets: [{ name: 'The corner', at: P(234, 6) }],
      words: {
        plays: 'Between groves of cycads and tree ferns: plants from before the flowers, stout trunks topped with stiff sprays of fronds, the tree ferns standing taller round them. The hole bends left round the cycads in the corner, and the landing area leans toward them, 3% down to the left, so a drive in the middle drifts left and the right half, high and by the strip bunker, has the angle in. It falls 8 m from tee to green into a shallow hollow.',
        safe: 'Drive to the right half of the corner (234 m), where the cant brings it back to the middle, and play a mid iron in.',
        bold: 'Hug the left and the cant runs it toward the corner for a shorter second, but too far left is in the cycads.',
        miss: 'Left is the grove, which knocks a ball down among the trunks. Right, a long sandy strip bunker runs beside the fairway where drives land, then tree ferns.',
      },
    }),
  }),

  // 3. THE TAR PIT: a par 3 over a bubbling tar seep, old bones jutting from it; the way round is left
  hole({ n: 3, name: 'The Tar Pit', par: 3, legs: [[137, 0]], place: { at: [60, -715], heading: 95 },
    build: (P) => ({
      tees: { titan: 0, rex: 10, raptor: 24, compy: [50, -24] },
      corridor: 12,
      // the safe way round: short grass left of the pit, up to the green's left side
      extraFw: [{ at: P(88, -26), rx: 20, rz: 28, rot: 0.15 }],
      bunkers: [{ at: P(118, -16), rx: 5, rz: 4, pot: true }, { at: P(150, 13), rx: 6, rz: 4 }],
      green: { lobes: [[3.5, -7, 9.5, 10, -38], [-4.5, 7, 9, 10, -38]], join: 5, apron: 4, contour: [{ fall: 0, pct: 1.5 }, { ridge: [[-7, -4], [7, 4]], h: 0.25, w: 2.6 }], style: 'A peanut set from front right to back left, pinched in the middle, falling 1.6% toward the front with a low spine across the waist that splits the two lobes: the front-right lobe sits just past the pit' },
      trees: [...stand(P(60, 46), 18, 8, 31, [['cycad', 0.6], ['fern', 0.4]]), ...grove(P(170, -42), 16, 4, 32, 'broad')],
      bones: { at: [140, -698], label: 'the tar pit' },
      sketch: { green: { back: 48, off: -26 } },
      targets: [],
      words: {
        plays: 'A tar seep: oil rising through the ground, its lighter parts gone into the air, left a black pool that never quite sets. It bubbles slowly and gives off a faint shimmer, and animals that wandered in long ago are still in it: ribs and a horned skull jut from the surface. The green sits just beyond it, a little uphill. The pit plays like water.',
        safe: 'Aim left of the pit, at the short grass left of the green, and chip on.',
        bold: 'Straight at the front-right lobe over the pit: about 125 m to carry it.',
        miss: 'In the pit: a stroke and a drop. A pot bunker sits short left of the green, where the safe line comes in, and another long right. The green leans 6 m above the tee, so a short shot comes back.',
      },
    }),
  }),

  // 4. THE FLOODPLAIN: a par 5 S-bend along the braided river, sandbars as bunkers, the herd crossing beside it
  hole({ n: 4, name: 'The Floodplain', par: 5, legs: [[205, 0], [165, 28], [142, -18]], place: { at: [220, -760], heading: 5 }, tips: [-32, 34],
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [70, -34], compy: [112, -36] },
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 28, 27], [195, 31, 30], [230, 30, 25], [265, 28, 18], [300, 22, 20], [335, 25, 22], [370, 26, 23], [405, 24, 22], [440, 16, 15], [480, 12, 13]], wob: 5.5 }],
      corridor: 20,
      cant: [[190, 290, -3], [340, 430, -4]],   // away from the river: down to the left at the bend and the lay-up
      // a hog's back down the first leg, kicking a drive off the line away from it
      forms: [{ at: P(185, 0), rx: 16, rz: 58, rot: 0, h: 1.7, label: 'hog\'s back' }],
      // the gravel terrace the green sits on: the line climbs onto it over the last 90 m
      bunkers: [{ at: P(232, -38), rx: 18, rz: 12, rot: 0.2, job: 'catch' }, { strip: [[330, -6, 44], [352, -6, 50], [378, -8, 49], [402, -8, 43]], wob: 2.5, job: 'approach' },
        { at: P(480, -16), rx: 7, rz: 5 }, { at: P(508, 14), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 7, 15, 40], [7, 10, 7, 5, 0]], raise: 1.0, falseFront: true, contour: [{ fall: 0, pct: 2 }], style: 'An L: a long leg from front left to back right and a wing at the back right, raised 1 m on the gravel terrace with a false front, falling 2% toward the front (the false front is the feature): open from the left, away from the river\'s bank bunker' },
      trees: [...stand(P(120, -64), 22, 10, 41, [['conifer', 0.5], ['broad', 0.5]]), ...stand(P(300, -70), 24, 10, 42, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(470, -50), 16, 5, 43, 'conifer')],
      boulders: [...blocks(P(410, 54), 12, 4, 44)],
      targets: [{ name: 'The bend', at: P(232, 2) }, { name: 'The lay-up', at: P(392, -2) }],
      words: {
        plays: 'Along the braided river: it runs down the right in two or three channels between banks of gravel and sand, wide and shallow, and the long-necks cross it here, wading slowly from the east meadows to the gravel bars, a hundred metres off the fairway. The hole bends right with the river, then left onto a gravel terrace where the green sits, raised. It dips 4 m to the shallows on the second leg and climbs 8 m to the green. A hog\'s back down the first leg throws a drive off the middle, and from the bend on the fairway leans away from the river, 3% at the bend and 4% at the lay-up, down to the left.',
        safe: 'Drive to the bend (232 m), lay up short of the climb (392 m), and pitch up to the green.',
        bold: 'From a good drive, a long second at the green, up the terrace: the false front sends a weak one back.',
        miss: 'Right is the river: the sandbars play as bunkers, the channels as water (a stroke and a drop). A big bunker on the left catches a pulled drive before the trees, and a long one runs along the river\'s bank on the right of the lay-up.',
      },
    }),
  }),

  // 5. THE PLUNGE POOL: a par 3 down off the sill to a green on a rock shelf beside the pool under the Great Falls
  hole({ n: 5, name: 'The Plunge Pool', par: 3, legs: [[197, 0]], place: { at: [395, -1330], heading: 10 },
    build: (P) => ({
      tees: { titan: 0, rex: [10, -16], raptor: [34, 16], compy: [74, -20] },
      corridor: 14,
      extraFw: [{ at: P(168, -24), rx: 18, rz: 22, rot: 0.1 }],
      bunkers: [{ at: P(184, -20), rx: 7, rz: 5 }, { at: P(212, -12), rx: 8, rz: 4.5 }],
      green: { lobes: [[-9, 3, 8, 8, -20], [7, -4, 8, 8, 0], [1, 9, 7, 7, 20]], join: 5, apron: 5, raise: 1.6, contour: [{ fall: -60, pct: 1.6 }], style: 'A clover of three lobes on a shelf of rock raised 1.6 m beside the pool, falling 1.6% toward the front left, away from the water (flatter: a long iron in, the pool close): short grass round its left side' },
      trees: [...stand(P(120, -60), 22, 10, 51, [['fern', 0.6], ['broad', 0.4]])],
      boulders: [...blocks(P(150, 38), 12, 6, 52, [2, 4]), ...blocks(P(222, 26), 10, 5, 53, [2, 5])],
      targets: [],
      sketch: { tee: { up: 18 } },
      words: {
        plays: 'The Great Falls pour off the valley\'s north-east wall, 420 m in one leap, into a deep round pool at the foot. The 5th plays down from the sill, the ridge of rock that holds the pool in, to a green on a shelf of rock beside the pool, 10 m below the tee. Spray drifts across the green and the noise is everywhere. The river leaves the pool through a gorge cut in the sill; the walk to the 6th crosses it on the expedition\'s rope bridge.',
        safe: 'Play to the left half of the green; short and left is short grass.',
        bold: 'At a pin on the right lobe, beside the water.',
        miss: 'Right and long is the pool: a stroke and a drop. Short is the sill\'s rocky slope. The green is raised on its shelf, so a ball that runs off the right goes in.',
      },
    }),
  }),

  // 6. THE STRANGLER: a drivable par 4 up onto a knoll, a colossal strangler fig whose buttress roots arch over
  // the right of the fairway: the bold drive threads under the arch, the safe line goes round to the left
  hole({ n: 6, name: 'The Strangler', par: 4, legs: [[274, 0]], place: { at: [560, -1480], heading: 175 },
    build: (P) => ({
      tees: { titan: 0, rex: 14, raptor: [52, 36], compy: [92, 40] },
      // two ways: straight up the middle and under the arch, or a branch of fairway out left round the fig's foot
      fw: [{ e: [[52, 13, 13], [88, 22, 20], [125, 26, 22], [160, 24, 22], [195, 21, 21], [222, 22, 24], [240, 23, 23], [254, 18, 18], [264, 12, 12]], wob: 4.5 },
        { e: [[112, 26, 2], [140, 54, -12], [170, 74, -26], [198, 80, -34], [220, 72, -40], [238, 58, -44]], wob: 4, seed: 33 }],
      corridor: 16,
      cant: [[110, 210, 2.5]],   // the knoll's flank falls right, toward the arch side and the green's open side
      // the fig right of the line at 240 m: its trunk, a canopy 68 m across, and the root arch spanning from the
      // trunk 52 m across the fairway to a buttress foot 18 m left of the line, 17 m clear under its crown
      strangler: { trunk: P(240, 34), r: 8, h: 58, canopy: 34, arch: { foot: P(232, -18), crown: 17, t: 3.5 }, label: 'the Strangler' },
      bunkers: [{ at: P(160, 26), rx: 15, rz: 10, rot: 0.3, job: 'target' }, { at: P(256, -16), rx: 7, rz: 5 }, { at: P(284, 12), rx: 6, rz: 4.5 }],
      green: { lobes: [[-5, 4, 8, 16, -45], [6, -6, 8, 7, 0]], apron: 5, contour: [{ fall: 45, pct: 1.6 }, { tier: [-6, 7], up: -135, h: 0.55, w: 5 }], style: 'Long and thin, set at 45° from front right to back left, with a knob at the front right, falling 1.8% toward the front right, its back-left end on a shelf 0.6 m up (the bold green of the nine): open from the right, from under the arch' },
      trees: [...stand(P(110, -56), 20, 8, 61, [['broad', 0.5], ['conifer', 0.5]]), ...stand(P(270, 46), 18, 6, 62, [['fern', 0.5], ['broad', 0.5]])],
      targets: [{ name: 'Round the left', at: P(192, -52) }, { name: 'Under the arch', at: P(248, 2), bold: true }],
      words: {
        plays: 'A strangler fig starts life as a seed in a tree\'s crown and sends roots down round its host until they meet the ground, fuse and take over; this one is colossal, 58 m tall, its host long gone. It stands on the knoll the hole climbs, 10 m up from the tee, right of the line 35 m short of the green, and one of its buttress roots arches 52 m across the fairway to a foot 18 m left of the line, 17 m clear under its crown. The bold drive goes straight at the green and threads under the arch; the safe line takes a branch of fairway out left, round the root\'s foot.',
        safe: 'An iron out onto the left branch (192 m), clear of the root\'s foot, and a wedge in from the left.',
        bold: 'Driver at the green, under the arch: a low drive runs under it and up the knoll, a high one hits the root.',
        miss: 'The fig\'s canopy knocks a ball down; its root is solid. A bunker on the right where an iron lands. The knoll throws a short approach back.',
      },
    }),
  }),

  // 7. THE BONE BED: a cape right down to the river's bend, the Bone Bluff on the left with a skeleton in its face
  hole({ n: 7, name: 'The Bone Bed', par: 4, legs: [[240, 0], [150, 25]], place: { at: [620, -1180], heading: 182 }, tips: [-32, -22],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [66, -34], compy: [104, -36] },
      fw: [{ e: [[60, 14, 14], [100, 22, 21], [150, 28, 24], [200, 31, 24], [232, 32, 25], [258, 28, 24], [280, 23, 22], [310, 19, 20], [345, 15, 15], [372, 12, 12]], wob: 5.5 }],
      corridor: 18,
      cant: [[190, 290, -3.5]],   // away from the river: the landing area over the crest falls to the left
      // the crest: the drive climbs over it, blind, and the second plays down 20 m to the bend
      forms: [{ at: P(150, 0), rx: 80, rz: 34, rot: 0, h: 3, label: 'the crest' }],
      bunkers: [{ at: P(222, -40), rx: 16, rz: 11, rot: -0.3, job: 'target' }, { at: P(372, -15), rx: 7, rz: 5 }, { at: P(395, 12), rx: 6, rz: 4.5 }],
      green: { lobes: [[0, -2, 8.5, 13, 28], [3, 9, 7.5, 7, 0]], contour: [{ fall: 0, pct: 1.5 }, { bowl: [3, 9], r: 10, h: 0.3 }], style: 'A bean set from front left to back right, falling 1.8% toward the front (nothing tips toward the river), with a bowl in its back half that gathers to a back pin: open from the left, where the bunker guards the landing area' },
      trees: [...stand(P(120, 62), 20, 8, 71, [['broad', 0.5], ['fern', 0.5]]), ...stand(P(300, -60), 22, 8, 72, [['conifer', 0.6], ['broad', 0.4]])],
      skeleton: { label: 'the skeleton' },
      targets: [{ name: 'Over the crest', at: P(236, -6) }],
      words: {
        plays: 'The Bone Bluff stands on the left, a sandstone outcrop 34 m high, and the rain has worn its face back over the ages until a long-neck\'s skeleton showed through, half out of the rock: its spine curving along the face, ribs like a ship\'s timbers, the long neck reaching up the stone. The drive climbs over a blind crest past the bluff, onto a landing area that leans 3.5% to the left, away from the river; the hole then bends right and falls 20 m to a green beside the river\'s bend. Down the right the whole way the river curves round the hole, and the bold drive bites off its bend. Far off across the valley, at the edge of the herd on the plain, the hunter is sometimes there, still, watching.',
        safe: 'Drive left of the line over the crest (236 m) and play down to the green.',
        bold: 'Aim right of the corner over the river\'s bend: a wedge in if it carries.',
        miss: 'Right is the river: a stroke and a drop. Left of the landing area, a bunker, then the scrub at the foot of the bluff. A drive short of the crest sits on its upslope with the green out of sight.',
      },
    }),
  }),

  // 8. THE SWAMP: a par 5 dogleg left through a misty swamp of tall cypresses standing in still water
  hole({ n: 8, name: 'The Swamp', par: 5, legs: [[290, 0], [222, -40]], place: { at: [480, -720], heading: 180 },
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [70, -32], compy: [112, -34] },
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 27, 26], [190, 26, 24], [225, 30, 27], [260, 31, 28], [292, 26, 24], [325, 20, 21], [360, 22, 23], [400, 25, 24], [440, 19, 19], [475, 14, 15], [500, 12, 12]], wob: 6 }],
      corridor: 14,
      cant: [[200, 300, -3.5]],   // away from the swamp, toward the dry side
      // a speed slot down the second leg: the ground feeds a running ball toward the green
      forms: [{ at: P(420, 0), rx: 14, rz: 60, rot: 0, h: -0.9, label: 'speed slot' }],
      bunkers: [{ at: P(250, -42), rx: 16, rz: 12, rot: 0.4, job: 'catch' }, { at: P(395, 34), rx: 15, rz: 9, rot: -0.3, job: 'approach' }, { at: P(500, -15), rx: 7, rz: 5 }, { at: P(522, 14), rx: 6, rz: 4.5 }],
      green: { lobes: [[0, 8, 15, 7, 8], [0, -3, 7, 12, 0]], join: 4, contour: [{ fall: 0, pct: 1.5 }, { bowl: [8, 9], r: 10, h: 0.3 }], style: 'A T: a bar across the back and a stem toward you, falling 1.5% toward the front, with a bowl in the right end of the bar that gathers to a back-right pin: open from the left, the dry side' },
      // the swamp's cypresses stand in the water and on the hummocks; a few broadleaves on the dry ground
      swampTrees: { n: 160, seed: 81 },
      trees: [...stand(P(330, -70), 26, 10, 82, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(470, 52), 20, 6, 83, 'conifer')],
      targets: [{ name: 'Between the pools', at: P(250, -4) }, { name: 'Round the corner', at: P(395, 0) }],
      words: {
        plays: 'Where the river runs out of slope it spreads into a swamp: still black water in pools between hummocks of mud and roots, tall cypresses standing in it on buttressed trunks, mist lying low over it even in the afternoon. The fairway runs down its east edge and weaves between pools that reach in from the right; the landing area leans 3.5% to the left, away from the water, toward the dry ground. Then the hole bends left, out of the swamp, down a slot that runs a ball on toward the green. It falls 4 m.',
        safe: 'Keep left: drive between the pools on the left half (250 m), play round the corner (395 m), and pitch on.',
        bold: 'Carry the pool that reaches across from the right at about 215 m and the slot can run a second to the green.',
        miss: 'Right is the swamp: water is a stroke and a drop, the hummocks a muddy lie among the trees. Left of the landing area a bunker catches a pull before the broadleaves.',
      },
    }),
  }),

  // 9. THE NEST: a sidehill climb up the broad ramp to the camp's ledge, beside Camp Falls, the pterosaurs nesting
  // on the cliff above
  hole({ n: 9, name: 'The Nest', par: 4, legs: [[366, 0]], place: { at: [680, -170], heading: 240 }, tips: [-34, -8],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [62, 36], compy: [100, 42] },
      fw: [{ e: [[62, 14, 14], [100, 22, 22], [150, 29, 26], [195, 32, 27], [235, 29, 24], [270, 22, 20], [300, 16, 16], [330, 14, 14], [352, 12, 12]], wob: 5 }],
      corridor: 16,
      cant: [[130, 300, 6]],   // the strong sidehill of the nine: the ramp falls away from the cliff, to the right
      bunkers: [{ at: P(222, 42), rx: 18, rz: 12, rot: 0.3, job: 'catch' }, { at: P(354, 2), rx: 5, rz: 4, pot: true }, { at: P(378, -14), rx: 7, rz: 4.5 }],
      green: { lobes: [[-6, -3, 8.5, 11, 30], [4, 6, 9.5, 8, -20], [6, -7, 6, 6, 0]], join: 5, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-12, -7], [-6, 9]], h: 0.28, w: 3 }], style: 'A crescent curled round a pot bunker at the front, its horns toward you, on the ledge\'s lip, falling 1.8% toward the front with a spine running from the left horn to the back: open from the left' },
      trees: [...stand(P(160, -62), 22, 8, 91, [['fern', 0.5], ['broad', 0.5]]), ...stand(P(280, 52), 18, 6, 92, [['cycad', 0.6], ['fern', 0.4]])],
      camp: { label: 'the camp' },
      targets: [{ name: 'The ramp', at: P(232, -6) }],
      words: {
        plays: 'Home: up the broad ramp of fallen rock and soil that climbs the valley wall to the camp\'s ledge, 30 m above the floor. The ramp is the strongest sidehill on the course: it falls 6% away from the cliff, to the right, so the second is played with the ball above your feet, and a big bunker on the right catches what runs off. The green sits on the ledge\'s lip beside the pool where Camp Falls lands, the falls roaring down the wall behind it and the pterosaurs\' nests on the cliff above, the birds wheeling over the green. Behind it, the camp: canvas tents, a hut on stilts, a cook fire. The climb makes it play about a club longer.',
        safe: 'Drive up the left half of the ramp (232 m) and let the slope bring it back to the middle; take a club more.',
        bold: 'Hug the cliff side for the flatter lie and the better angle in, with the jungle at the cliff\'s foot waiting.',
        miss: 'Left is the jungle on the wall\'s talus, a lost ball as often as not. Right, the slope runs a ball into the big bunker where the ramp falls away, and past it the ramp\'s steep edge. Short of the green, the pot bunker in its crescent.',
      },
    }),
  }),
];

// finishing touches that need the built line: the bold lines
{
  const at_ = (h, s, o = 0) => at(h.line, s, o);
  HOLES[0].boldLine = [[0, 0], HOLES[0].pin];
  HOLES[5].boldLine = [[0, 0], HOLES[5].pin];
  HOLES[6].boldLine = [[0, 0], at_(HOLES[6], 300, 6)];
}
