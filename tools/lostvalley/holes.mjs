// The Lost Valley, plan book round 2: nine holes in a hidden valley walled in by the cliffs of a table mountain,
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
  // 1. THE OVERLOOK: off the bluff by the camp, 28 m down to the valley floor, dogleg right. The creek from Camp
  // Falls crosses the landing area on a diagonal, nearest in the corner, so the fairway comes in two pieces
  hole({ n: 1, name: 'The Overlook', par: 4, legs: [[245, 0], [130, 45]], place: { at: [-80, 5], heading: 12 }, flat: 8, fade: 30,
    build: (P) => ({
      tees: { titan: 0, rex: 18, raptor: [64, 40], compy: [106, 46] },
      // short of the creek, its right edge cut back where the water comes in; then beyond it, up to the green
      fw: [{ e: [[78, 15, 15], [110, 22, 24], [160, 30, 30], [200, 36, 26], [228, 38, 18], [248, 32, 10], [262, 16, 2]], wob: 4.5 },
        { e: [[282, 6, 26], [296, 18, 28], [316, 21, 18], [345, 14, 13]], wob: 4, seed: 19 }],
      corridor: 18,
      cant: [[150, 255, -4.5]],   // the landing area leans away from the creek, to the left: the high right side has the angle
      // over the creek in the corner: a stand of tree ferns and cycads the bold drive must carry as well
      trees: [...stand(P(262, 70), 22, 16, 11, [['fern', 0.6], ['cycad', 0.4]]), ...stand(P(330, 50), 16, 8, 12, [['fern', 0.5], ['broad', 0.2], ['cycad', 0.3]]),
        ...grove(P(120, -70), 22, 5, 13, 'conifer'), ...grove(P(210, -88), 26, 6, 14, 'broad')],
      // a fallen giant lies across the creek in the corner, the walk's footbridge
      log: { a: P(212, 50), b: P(234, 74), r: 1.7, label: 'the fallen giant' },
      bunkers: [{ at: P(346, -16), rx: 7, rz: 5 }, { at: P(368, -14), rx: 6, rz: 4.5 }],
      green: { lobes: [[-4, 7, 7, 12, -32], [4, -5, 8, 10, -32], [7, 4, 5, 6, 0]], contour: [{ fall: -40, pct: 1.8 }, { bowl: [-4, 9], r: 11, h: 0.3 }], style: 'A kidney set from front right to back left, its waist pinched by a bunker on the left, falling 1.8% toward the front left, with a shallow bowl in the back-left lobe that gathers to a back pin: open from the right, the creek side' },
      boulders: [...blocks(P(64, 40), 16, 6, 15, [3, 7]), ...blocks(P(70, -40), 14, 5, 16, [3, 6])],
      spire: { at: P(70, -36), h: 38, label: 'the spire (the pterosaur)' },
      targets: [{ name: 'Short of the creek', at: P(232, -8) }],
      words: {
        story: 'The creek: water from Camp Falls, run down off the ledge, crossing the valley floor below you on a diagonal.',
        plays: 'The opener, from a bluff beside the expedition camp, 30 m up the valley\'s south wall. The whole valley opens below you: the braided river, the swamp steaming in the sun, the herd grazing on the plain far ahead-left, the walls rising sheer all round with falls pouring off them. On the round\'s very first shot a big crested pterosaur launches off the rock spire just left of the tee and glides out below you, banking slowly away toward the herd. Below the bluff the creek that Camp Falls feeds winds across the floor, and it cuts the hole in two: it comes in from the right, nearest in the corner, and crosses the line about 268 m out on a diagonal, a channel 6 m wide between low banks, with a fallen giant lying across it in the corner. The landing area short of it leans to the left, away from the water.',
        safe: 'A drive down the left half, short of the creek (232 m), and a mid iron over it.',
        bold: 'Cut the corner: carry the creek where it comes in on the right, and the tree ferns over it, for a wedge in.',
        miss: 'Short off the tee is the bluff\'s face: jungle and rock, a hard lie well below. A drive that runs too far goes in the creek (a stroke and a drop). Right of the corner, the tree ferns knock a ball down. Left is open fern meadow.',
      },
    }),
  }),

  // 2. CYCAD GROVE: dogleg left, a colossal monkey-puzzle in the middle of the fairway at the corner splitting it
  // in two, a ring of cycads round its foot; a waste bunker the length of the hole down the right
  hole({ n: 2, name: 'Cycad Grove', par: 4, legs: [[232, 0], [134, -40]], place: { at: [110, -350], heading: 350 }, tips: [-30, 30],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [66, 36], compy: [106, 42] },
      // one fairway to the tree, then two lanes round it: the left one inside the corner, short and tight; the
      // right one wide, longer, beside the waste
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 30, 30], [192, 38, 36], [206, 30, 30]], wob: 4.5 },
        { e: [[196, 46, -12], [225, 46, -14], [252, 40, -12], [280, 30, -2]], wob: 3.5, seed: 27 },
        { e: [[196, -12, 46], [225, -14, 48], [258, -10, 40], [286, 6, 30]], wob: 3.5, seed: 29 },
        { e: [[276, 22, 20], [300, 18, 18], [338, 13, 14]], wob: 4, seed: 31 }],
      corridor: 18,
      cant: [[140, 205, -3]],   // toward the grove, before the tree: the right side is high
      // the giant: a monkey-puzzle 56 m tall, branches from 7 m up, its crown 28 m across, at the corner on the line
      giant: { at: P(232, 0), h: 56, r: 13, low: 0.12, label: 'the giant monkey-puzzle' },
      trees: [...grove(P(232, 0), 16, 14, 26, 'cycad').filter(t => Math.hypot(t.x - P(232, 0)[0], t.z - P(232, 0)[1]) > 6),
        ...stand(P(205, -78), 30, 26, 21, [['cycad', 0.55], ['fern', 0.35], ['conifer', 0.1]]), ...stand(P(290, -60), 22, 14, 22, [['cycad', 0.5], ['fern', 0.5]]),
        ...stand(P(330, 50), 20, 8, 24, [['fern', 0.5], ['conifer', 0.5]])],
      // the waste: 150 m of sand and gravel down the right of the fairway and the right lane
      bunkers: [{ strip: [[96, -26, 44], [140, -33, 54], [190, -40, 62], [226, -50, 66], [250, -46, 58]], wob: 4, waste: true, job: 'catch' },
        { at: P(342, 17), rx: 8, rz: 5 }, { at: P(372, -13), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 7, 17, 30], [-5, -9, 6, 6, 0]], contour: [{ fall: 0, pct: 1.5 }, { tier: [1.5, 5], up: 180, h: 0.5, w: 4 }], style: 'Long and thin, set from front left to back right with a knob at the front left, falling 1.5% toward the front, two tiers (the upper at the back, 0.5 m up): from the left lane you play down its length, from the right lane across it' },
      boulders: [...blocks(P(120, -60), 12, 3, 25)],
      targets: [{ name: 'The right lane', at: P(232, 30) }, { name: 'The left lane', at: P(236, -28), bold: true }],
      words: {
        story: 'The giant: a monkey-puzzle older than anything else on the floor, standing alone in the fairway at the corner.',
        plays: 'Between groves of cycads and tree ferns: plants from before the flowers, stout trunks topped with stiff sprays of fronds. At the corner of the dogleg, right in the middle of the fairway, stands a monkey-puzzle 56 m tall, a bare trunk under a flat crown of spiny layered boughs, a ring of cycads round its foot. It splits the fairway in two. The left lane runs inside the corner, tight to the grove, and is shorter, playing straight down the green\'s length; the right lane is wider and longer, beside a waste of sand and river gravel that runs 150 m down the whole right side, and from it the green sits across you. Before the tree the fairway leans 3% to the left, toward the grove.',
        safe: 'Take the right lane (232 m), clear of the waste, and a mid iron across the green.',
        bold: 'The left lane (236 m), between the tree and the grove: a short iron straight down the green.',
        miss: 'At the tree: its boughs and the cycads knock a ball down. Left of the left lane is the grove. Right is the waste, a long sandy lie, then tree ferns.',
      },
    }),
  }),

  // 3. THE TAR PIT: a par 3 over a tar seep that wraps the green's front and right, a great horned skull and
  // ribs in it; the way round is left. No sand: the tar is the hazard
  hole({ n: 3, name: 'The Tar Pit', par: 3, legs: [[137, 0]], place: { at: [60, -715], heading: 95 },
    build: (P) => ({
      tees: { titan: 0, rex: 10, raptor: 24, compy: [50, -24] },
      corridor: 12,
      // the safe way round: short grass left of the pit, up to the green's left side
      extraFw: [{ at: P(88, -28), rx: 20, rz: 30, rot: 0.15 }],
      bunkers: [],
      green: { lobes: [[3.5, -7, 9.5, 10, -38], [-4.5, 7, 9, 10, -38]], join: 5, apron: 4, contour: [{ fall: 0, pct: 1.5 }, { ridge: [[-7, -4], [7, 4]], h: 0.25, w: 2.6 }], style: 'A peanut set from front right to back left, pinched in the middle, falling 1.6% toward the front with a low spine across the waist that splits the two lobes: the front-right lobe hangs over the tar' },
      trees: [...stand(P(60, 46), 18, 8, 31, [['cycad', 0.6], ['fern', 0.4]]), ...grove(P(170, -42), 16, 4, 32, 'broad')],
      bones: { at: [140, -698], label: 'the tar pit' },
      sketch: { green: { back: 48, off: -26 } },
      targets: [],
      words: {
        story: 'The pit: a great horned skull and a ribcage standing out of the tar in front of the green, the first thing you see from the tee.',
        plays: 'A tar seep: oil rising through the ground, its lighter parts gone into the air, left black pools that never quite set. They bubble slowly and give off a faint shimmer, and animals that wandered in long ago are still in them: a great horned skull, half sunk, and the arch of a ribcage stand out of the largest pool in front of the green. The tar wraps the green\'s front and right in three pools; the left is open, short grass running up to the green\'s left side. No sand: the tar is the hazard, and it plays like water.',
        safe: 'Aim left of the pit, at the short grass left of the green, and chip on.',
        bold: 'Straight at the front-right lobe over the tar: about 125 m to carry it, tar short and right.',
        miss: 'In the tar: a stroke and a drop. Right of the green the third pool waits for a push. The green sits 6 m above the tee, so a short shot comes back.',
      },
    }),
  }),

  // 4. THE FLOODPLAIN: a par 5 S-bend along the braided river; a back channel leaves the river and crosses the
  // hole on a diagonal about 300 m out, into an oxbow pond on the left, so the fairway comes in two
  hole({ n: 4, name: 'The Floodplain', par: 5, legs: [[205, 0], [165, 28], [142, -18]], place: { at: [220, -760], heading: 5 }, tips: [-32, 34],
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [70, -34], compy: [112, -36] },
      // up to the channel (its left edge cut back where the water comes nearest), then beyond it to the terrace
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 28, 27], [195, 31, 30], [230, 30, 27], [258, 26, 26], [280, 12, 24], [296, 2, 14]], wob: 5 },
        { e: [[328, 26, 2], [348, 26, 10], [372, 26, 22], [405, 24, 22], [440, 16, 15], [480, 12, 13]], wob: 5, seed: 41 }],
      corridor: 20,
      cant: [[190, 280, -3], [350, 430, -4]],   // away from the river: down to the left at the bend and the lay-up
      // a hog's back down the first leg, kicking a drive off the line away from it
      forms: [{ at: P(185, 0), rx: 16, rz: 58, rot: 0, h: 1.7, label: 'hog\'s back' }],
      bunkers: [{ at: P(480, -16), rx: 7, rz: 5 }, { at: P(508, 14), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 7, 15, 40], [7, 10, 7, 5, 0]], raise: 1.0, falseFront: true, contour: [{ fall: 0, pct: 2 }], style: 'An L: a long leg from front left to back right and a wing at the back right, raised 1 m on the gravel terrace with a false front, falling 2% toward the front (the false front is the feature): open from the left, away from the river' },
      trees: [...stand(P(120, -64), 22, 10, 41, [['conifer', 0.5], ['broad', 0.5]]), ...stand(P(250, -100), 24, 10, 42, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(470, -50), 16, 5, 43, 'conifer')],
      boulders: [...blocks(P(410, 54), 12, 4, 44)],
      targets: [{ name: 'The bend', at: P(232, 2) }, { name: 'Over the channel', at: P(392, -2) }],
      words: {
        story: 'The back channel: the river\'s braids spill one arm across the floodplain, and it crosses the hole into an oxbow pond.',
        plays: 'Along the braided river: it runs down the right in two or three channels between banks of gravel and sand, wide and shallow, and the long-necks cross it here, wading slowly from the east meadows to the gravel bars, a hundred metres off the fairway. Its gravel bars are the bunkers here: there is no other sand until the green. The hole bends right with the river, then left onto a gravel terrace where the green sits, raised. About 300 m out a back channel leaves the river and cuts across the hole on a diagonal, nearest on the left, into an oxbow pond: the fairway stops short of it and starts again beyond. A hog\'s back down the first leg throws a drive off the middle, and from the bend on the fairway leans away from the river.',
        safe: 'Drive to the bend (232 m), play over the channel to the lay-up (392 m), and pitch up to the green.',
        bold: 'A long drive down the right, where the channel is furthest, leaves a long second over it at the green, up the terrace: the false front sends a weak one back.',
        miss: 'Right is the river: the sandbars play as bunkers, the channels as water (a stroke and a drop). A big drive that runs out on the left finds the back channel or the pond. Left of the first leg, trees.',
      },
    }),
  }),

  // 5. THE PLUNGE POOL: a par 3 down off the sill to a green on a rock shelf beside the pool under the Great Falls
  hole({ n: 5, name: 'The Plunge Pool', par: 3, legs: [[197, 0]], place: { at: [395, -1330], heading: 10 },
    build: (P) => ({
      tees: { titan: 0, rex: [10, -16], raptor: [34, 16], compy: [74, -20] },
      corridor: 14,
      extraFw: [{ at: P(168, -24), rx: 18, rz: 22, rot: 0.1 }],
      bunkers: [{ at: P(184, -22), rx: 6, rz: 4.5 }],
      green: { lobes: [[-9, 3, 8, 8, -20], [7, -4, 8, 8, 0], [1, 9, 7, 7, 20]], join: 5, apron: 4, raise: 0.4, contour: [{ fall: -60, pct: 1.6 }], style: 'A clover of three lobes filling a shelf of rock that juts out into the pool, falling 1.6% toward the front left, away from the water (flatter: a long iron in, the pool close): short grass round its left side' },
      trees: [...stand(P(120, -60), 22, 10, 51, [['fern', 0.6], ['broad', 0.4]])],
      boulders: [...blocks(P(150, 38), 12, 6, 52, [2, 4]), ...blocks(P(222, 26), 10, 5, 53, [2, 5])],
      targets: [],
      sketch: { tee: { up: 18 } },
      words: {
        story: 'The shelf: a tongue of rock out into the plunge pool, the green on it, the Great Falls coming down behind.',
        plays: 'The Great Falls pour off the valley\'s north-east wall, 420 m in one leap, into a deep round pool at the foot. The 5th plays down from the sill, the ridge of rock that holds the pool in, to a green on a shelf of rock that juts out into the pool, water on three sides, 10 m below the tee, the falls straight behind it. Spray drifts across the green and the noise is everywhere. The river leaves the pool through a gorge cut in the sill; the walk to the 6th crosses it on the expedition\'s rope bridge.',
        safe: 'Play to the left half of the green; short and left is the neck, short grass.',
        bold: 'At a pin on the right lobe, beside the water.',
        miss: 'Right, long and front-right is the pool: a stroke and a drop. Short is the sill\'s rocky slope. The way on is the shelf\'s neck, short grass from the left, with a little bunker in it.',
      },
    }),
  }),

  // 6. THE STRANGLER: a drivable par 4 up onto a knoll, a colossal strangler fig whose buttress roots arch over
  // the right of the fairway: the bold drive threads under the arch, the safe line goes round to the left
  hole({ n: 6, name: 'The Strangler', par: 4, legs: [[274, 0]], place: { at: [560, -1480], heading: 175 }, flat: 80, fade: 46, hold: true,
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

  // 7. THE BONE BED: a cape right down to the river's bend, the Bone Bluff standing in the middle of the fairway at
  // the corner with a skeleton in its face; the green inside a ring of sand
  hole({ n: 7, name: 'The Bone Bed', par: 4, legs: [[240, 0], [150, 25]], place: { at: [620, -1180], heading: 182 }, tips: [-32, -22],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [66, -34], compy: [104, -36] },
      // up to the bluff, then a lane each side of it (left: wide, safe, blind; right: along the river, the short
      // way), joining again past it
      fw: [{ e: [[60, 14, 14], [100, 22, 21], [150, 30, 28], [178, 44, 40], [190, 36, 30]], wob: 5 },
        { e: [[180, 74, -40], [210, 76, -42], [240, 72, -40], [262, 56, -26]], wob: 4, seed: 43 },
        { e: [[180, -6, 50], [210, -6, 54], [236, -8, 56], [258, -2, 46]], wob: 3, seed: 45 },
        { e: [[252, 34, 30], [280, 24, 22], [310, 19, 20], [345, 15, 15], [372, 12, 12]], wob: 5, seed: 47 }],
      corridor: 18,
      cant: [[200, 270, -3]],   // eases the fall to the river; the left lane still leans toward the bluff
      // the crest: the drive climbs over it, and the second plays down 20 m to the bend
      forms: [{ at: P(140, 0), rx: 80, rz: 34, rot: 0, h: 2.5, label: 'the crest' }],
      // the green inside a ring of sand, open at the front left, where the left lane comes in
      bunkers: [{ ring: { inner: 3.5, outer: 10, gap: -30, gapW: 46 }, job: 'surround' }],
      green: { lobes: [[0, -2, 8.5, 13, 28], [3, 9, 7.5, 7, 0]], contour: [{ fall: 0, pct: 1.5 }, { bowl: [3, 9], r: 10, h: 0.3 }], style: 'A bean set from front left to back right, falling 1.5% toward the front (nothing tips toward the river), with a bowl in its back half that gathers to a back pin, the whole green inside a ring of sand with one way in, from the front left' },
      trees: [...stand(P(120, 62), 20, 8, 71, [['broad', 0.5], ['fern', 0.5]]), ...stand(P(300, -64), 22, 8, 72, [['conifer', 0.6], ['broad', 0.4]])],
      skeleton: { label: 'the skeleton' },
      targets: [{ name: 'Left of the bluff', at: P(226, -56) }, { name: 'Right of the bluff', at: P(222, 24), bold: true }],
      words: {
        story: 'The bluff: a sandstone outcrop standing in the fairway at the corner, a long-neck\'s skeleton showing in its face toward the tee.',
        plays: 'The Bone Bluff stands right in the middle of the fairway at the corner, a sandstone outcrop 30 m high and 30 m across, and the rain has worn its face back over the ages until a long-neck\'s skeleton showed through, half out of the rock: its spine curving along the face toward you, ribs like a ship\'s timbers, the long neck reaching up the stone. The drive climbs over a gentle crest, then the fairway splits round the bluff: the left lane is wide and safe but the green is out of sight behind the rock from most of it; the right lane runs between the bluff and the river and opens the green up, the short way. Past the bluff the hole bends right and falls 20 m to a green beside the river\'s bend, set inside a ring of sand with one way in, from the front left.',
        safe: 'Drive left of the bluff (226 m) and play down to the green, over the corner of the sand.',
        bold: 'Right of the bluff (222 m), between the rock and the river: the green opens up and the way in from the front left is straight ahead.',
        miss: 'Right is the river: a stroke and a drop. At the bluff, the rock: a ball off its face drops at the foot in the scrub. Long left of the left lane, broadleaves. Round the green, sand everywhere but the front left.',
      },
    }),
  }),

  // 8. THE SWAMP: a par 5 dogleg left down the swamp's dry east edge; round the corner the swamp's pools reach right
  // across the second leg, so the bold way hops from island to island of fairway over them, and the safe way goes
  // round the left on the dry ground; a cross bunker before the green
  hole({ n: 8, name: 'The Swamp', par: 5, legs: [[290, 0], [222, -40]], place: { at: [480, -720], heading: 180 },
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [70, -32], compy: [112, -34] },
      // the drive's fairway, then the stepping stones between the pools, and round the left the dry way
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 27, 26], [190, 27, 25], [225, 31, 27], [252, 30, 24], [266, 16, 8]], wob: 5 },
        { e: [[290, 14, 18], [312, 18, 20], [334, 14, 14]], wob: 3.5, seed: 51 },
        { e: [[366, 16, 18], [384, 20, 20], [400, 16, 15]], wob: 3.5, seed: 53 },
        { e: [[432, 18, 16], [460, 19, 19], [485, 14, 15], [500, 12, 12]], wob: 4, seed: 55 },
        { e: [[262, 64, -24], [300, 70, -34], [350, 70, -36], [400, 58, -30], [436, 40, -14]], wob: 4.5, seed: 57 }],
      corridor: 14,
      cant: [[180, 260, -3.5]],   // away from the swamp, toward the dry side
      // the cross bunker: a band of sand right across the last stepping stone's end and the dry way
      bunkers: [{ strip: [[408, 46, 26], [418, 50, 28], [426, 48, 26]], wob: 2, job: 'cross' }, { at: P(250, -46), rx: 15, rz: 11, rot: 0.4, job: 'catch' },
        { at: P(500, -15), rx: 7, rz: 5 }, { at: P(522, 14), rx: 6, rz: 4.5 }],
      green: { lobes: [[0, 8, 15, 7, 8], [0, -3, 7, 12, 0]], join: 4, contour: [{ fall: 0, pct: 1.5 }, { bowl: [8, 9], r: 10, h: 0.3 }], style: 'A T: a bar across the back and a stem toward you, falling 1.5% toward the front, with a bowl in the right end of the bar that gathers to a back-right pin: open from the stem, past the cross bunker' },
      // the swamp's cypresses stand in the water and on the hummocks; a few broadleaves on the dry ground
      swampTrees: { n: 160, seed: 81 },
      trees: [...stand(P(330, -96), 22, 8, 82, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(470, 52), 20, 6, 83, 'conifer')],
      targets: [{ name: 'The drive', at: P(236, -4) }, { name: 'The dry way', at: P(372, -44) }, { name: 'The stepping stones', at: P(384, 0), bold: true }],
      words: {
        story: 'The stepping stones: round the corner the swamp\'s black pools reach right across the fairway, leaving islands of fairway between them.',
        plays: 'Where the river runs out of slope it spreads into a swamp: still black water in pools between hummocks of mud and roots, tall cypresses standing in it on buttressed trunks, mist lying low over it even in the afternoon. The drive runs down its dry east edge, leaning 3.5% to the left, away from the water. Round the corner the swamp reaches right across the second leg in two long pools, and the fairway goes on as islands between them: the bold way hops from one to the next, straight at the green. The safe way goes round the left on the dry ground, longer, and a band of sand crosses both ways short of the last island.',
        safe: 'Drive to the corner (236 m), play round the left on the dry way (372 m), carry the cross bunker and pitch on.',
        bold: 'From the corner, over the first pool to the middle island (384 m), or a big second straight down the stones at the green.',
        miss: 'Right is the swamp: water is a stroke and a drop, the hummocks a muddy lie among the trees. Between the islands, the pools. Short of the green, the cross bunker.',
      },
    }),
  }),

  // 9. THE NEST: a sidehill climb up the broad ramp to the camp's ledge, Camp Falls behind the green, the pterosaurs
  // nesting on the cliff above. A step of rock 4 m high crosses the ramp, broken down on the right
  hole({ n: 9, name: 'The Nest', par: 4, legs: [[366, 0]], place: { at: [680, -170], heading: 240 }, tips: [-34, -8],
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [62, 36], compy: [100, 42] },
      fw: [{ e: [[62, 14, 14], [100, 22, 22], [150, 29, 26], [184, 30, 24], [196, 24, 18]], wob: 4.5 },
        { e: [[206, 32, 28], [235, 30, 25], [270, 22, 20], [300, 16, 16], [330, 14, 14], [352, 12, 12]], wob: 5, seed: 59 }],
      corridor: 16,
      cant: [[130, 300, 6]],   // the strong sidehill of the nine: the ramp falls away from the cliff, to the right
      // the step: a band of rock right across the ramp, the ground flattened either side of it; on the right its face
      // breaks down into a rubble slope you can run a ball up
      step: { s: 201, h: 4, face: 3.2, from: 110, to: 330, gap: [34, 70], label: 'the step' },
      bunkers: [{ at: P(150, 46), rx: 18, rz: 12, rot: 0.3, job: 'catch' }, { at: P(354, 2), rx: 5, rz: 4, pot: true }, { at: P(378, -14), rx: 7, rz: 4.5 }],
      green: { lobes: [[-6, -3, 8.5, 11, 30], [4, 6, 9.5, 8, -20], [6, -7, 6, 6, 0]], join: 5, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-12, -7], [-6, 9]], h: 0.28, w: 3 }], style: 'A crescent curled round a pot bunker at the front, its horns toward you, on the ledge\'s lip, falling 1.6% toward the front with a spine running from the left horn to the back: open from the left' },
      trees: [...stand(P(150, -62), 22, 8, 91, [['fern', 0.5], ['broad', 0.5]]), ...stand(P(280, 56), 18, 6, 92, [['cycad', 0.6], ['fern', 0.4]])],
      camp: { label: 'the camp' },
      targets: [{ name: 'Over the step', at: P(234, -6) }],
      words: {
        story: 'The step: a band of rock right across the ramp, the climb\'s first real rise, with the falls and the nests ahead above it.',
        plays: 'Home: up the broad ramp of fallen rock and soil that climbs the valley wall to the camp\'s ledge, 30 m above the floor. About 200 m up, a step of rock 4 m high runs right across the ramp, its face standing toward you; on the right it has broken down into a slope of rubble. Carry it and the ball sits on the upper shelf; come up short and you play the second blind, up and over the face. The ramp is the strongest sidehill on the course: it falls 6% away from the cliff, to the right, so the second is played with the ball above your feet. The green sits on the ledge\'s lip, Camp Falls roaring down the wall into its pool behind and left of it, its stream running off the lip past the back of the green, the pterosaurs\' nests on the cliff above, the birds wheeling over the green. Behind it, the camp: canvas tents, a hut on stilts, a cook fire. The climb makes it play about a club longer.',
        safe: 'Carry the step on the left half (234 m) and let the slope bring it back; take a club more.',
        bold: 'Hug the cliff side for the flatter lie and the better angle in, with the jungle at the cliff\'s foot waiting.',
        miss: 'Short of the step, a blind second up the face (a ball into the face drops at its foot). Left is the jungle on the wall\'s talus, a lost ball as often as not. Right, the slope runs a ball into the big bunker below the step, and past it the ramp\'s steep edge. Short of the green, the pot bunker in its crescent.',
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
