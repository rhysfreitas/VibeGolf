// The Lost Valley, plan book round 3: nine holes in a hidden valley walled in by the cliffs of a table mountain,
// golden afternoon after rain, re-laid to a new skeleton (Rhys's pick, 11 November 2026: par 37, 4 5 4 3 5 4 3 4 5).
// The round starts at the expedition camp on a knoll on the valley floor, loops the floor (the cycad grove, the
// braided river's floodplain, the Bone Bluff, the tar pit, the swamp), climbs a ramp of fallen rock to a ledge on the
// east wall mid-round (the 6th), drops off its bluff (the 7th: the first view of the valley from above), climbs the
// Strangler's knoll (the 8th, drivable) and finishes down the east bank on a shelf of rock in the plunge pool under
// the Great Falls (the 9th, a reachable par 5).
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the
// line, y up from the hole's `base`, the back tee's height), from `legs` ([length, turn in degrees, + = right]).
// `place` puts it in the valley (world.mjs): world x east, -z north. Heights come from the valley under the line
// (scene.mjs) plus the hole's own shapes. Plan data for the book (plans, profiles, sketch views), written to
// convert to the engine format later. Each hole carries its hole card (`card`, docs/COURSE-DESIGN.md Part 1) and
// the course its course card (`COURSE.card`).
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
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets;
  // turning it on is putting it first there and copying each hole's tips.tee and tips.yards into tees and yards
  tipsSet: { id: 'brachio', name: 'Brachio', color: '#5b4a3a', minDrive: 290 },
  // the course card (docs/COURSE-DESIGN.md Part 1)
  card: {
    hook: 'A valley where time stopped, walled in by the sheer cliffs of a table mountain. Its one rule: the animals are scenery and never in play; tar plays as water and the river\'s gravel bars as bunkers.',
    skeleton: 'Par 37: 4 5 4 3 5 4 3 4 5, the first par 37 and the first with three par 5s. Opens from the camp on the valley floor with a gentle par 4 round the giant. The big climb is mid-round (the 6th, +32 m up a ramp to the east ledge), the big drop straight after it (the 7th, a par 3 off the ledge\'s bluff, the reveal), the drivable par 4 is the 8th, and the round finishes with a reachable par 5 down to a shelf green under the Great Falls, the landmark it has been walking toward. No climb to finish.',
    classics: 'Long (2: 610 yd, the burn across the line three times), Short (4: a postage stamp ringed by tar), Eden (7: a green tilted hard from back to front, bunkers short left and right, the creek long), Leven (8: the hazard on the side that opens the green, which hides behind the fig\'s buttress from the safe side). All four are new to the register.',
    decisions: 'Four, each a different type: centre-line hazard (3, the Bone Bluff), the long way round (5, the stepping stones or the dry way), drivable (8, under the root arch), go or lay up (9, the shelf in two). Never three in a row; one in the last two. The 1st and 2nd have one clear line, which suits the opening.',
    landmarks: 'The Great Falls (tees 1, 6, 8 and 9, the 8th and 9th landing areas); the east ledge and Nest Falls (tees 5 and 6, the 5th landing area, below from the 8th); the Strangler on its knoll (tees 1 and 7, the 1st landing area, the 8th tee); the Bone Bluff (the 2nd approach, the 3rd tee). The reveal: the 7th tee, the first look at the whole valley from above.',
    rhythm: 'A gentle opener (a half-pipe round the giant, no forced carry, no penalty ground near). A long three-shotter next. The hardest run is 5 to 7 (the swamp, the climb, the drop off the ledge). The 8th is the breather and the risk, and the 9th finishes on the course\'s set piece. Par 4s 300, 370, 395, 425; par 3s 115 and 215; par 5s 490 (reachable), 535 (two routes), 610 (three shots over the burn).',
    newBorrowed: 'New to the register: the biggest climb in the middle of the round; a finish under the landmark the round walks toward; stepping-stone fairway; a tar pit. Borrowed from the over-used list: the waterfall backdrop (the Great Falls behind the 9th), the tee shot off a ledge (the 7th), something to play under (the root arch), a relic (the skeletons), a bridge (the rope bridge, a landmark only): five, over the budget of two; all five were approved in round 2.',
    forms: 'Par 4s and 5s, as alike.mjs measures them (12 November): 1 scalloped (drawn as a fan into a big elbow), 2 stepping stones (three pieces between the burn\'s crossings), 3 island (the bluff in the fairway), 5 split (two stepping stones beside the dry way), 6 funnel, 8 split, 9 scalloped. Five forms, none more than twice or twice running, no plain strips, no two alike.',
    // the height forms and the dials (Rhys's picks, 12 November 2026: docs/COURSE-DESIGN.md "Elevation and height forms", "Dials")
    heights: 'Every form once: 1 half-pipe, 2 stepped, 3 crest and run, 4 level across the tar, 5 hog\'s back, 6 hillside bench (and the big climb), 7 the drop par 3, 8 table top, 9 fall-away. Bold: 2, 6 and 8. No plain holes, no tee shot off a height. Landing areas lean from about 1.5% (1) to 9% (6).',
    dials: 'One pushed on every hole: 1 the bend (70°), 2 the length (610 yd), 3 the bunker count (nine dig pits), 4 the green (a 320 m² postage stamp), 5 the width (an 80 m causeway), 6 the height (31 m up on a 9% bench), 7 the height (26 m down), 8 a carry (the table\'s face, 190 m), 9 the green past real golf (about 1,300 m² in two parts). Set pieces: the postage stamp (4) and the burn (2).',
  },
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
  // the tips tee (COURSE.tipsSet, switched off): behind the back tee, about 35-40 yd on the par 4s and 5s, 15 on the
  // par 3s. Written as [s, off] with s < 0; carried as tips: { tee: [x, z], yards } in the hole's frame, out of
  // tees and yards until the set is turned on
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}

export const HOLES = [
  // 1. CYCAD GROVE: the opener, off the camp's knoll, a dogleg right round a colossal monkey-puzzle standing at the
  // inside of the corner. A fan of fairway that opens past the tree; a waste of sand and river gravel 160 m down
  // the outside (left)
  hole({ n: 1, name: 'Cycad Grove', par: 4, legs: [[215, 0], [124, 70]], place: { at: [-60, -1150], heading: 88 }, tips: [-24, 0], shape: 'Dogleg right',
    build: (P) => ({
      tees: { titan: 0, rex: 18, raptor: [60, 34], compy: [100, 36] },
      // a fan: narrow off the tee, opening past the giant toward the green
      // dials: the bend, 70° round the giant. A fan: narrow off the tee, opening into a big elbow at the corner (on the
      // outside, where every drive that doesn't lay up finishes), then the short second leg to the green
      fw: [{ e: [[50, 9, 9], [110, 14, 15], [160, 20, 18], [196, 26, 15]], wob: 4.5 },
        { lobes: [[222, -20, 32, 24, -70], [232, -4, 22, 18, 0]], join: 12, wob: 3, seed: 17 },
        { e: [[236, 18, 15], [270, 19, 16], [305, 17, 15], [325, 14, 12], [334, 11, 9]], wob: 4, seed: 19 }],
      corridor: 18,
      // a half-pipe: the fairway lies in an old channel between two levees, banked up both sides (2.4 m at 30 m off),
      // level across the middle, so a ball off the line is fed back toward it
      cross: [[100, 300, 3.2, 28]],
      // the giant: a monkey-puzzle 56 m tall, branches from 7 m up, its crown 26 m across, at the inside of the corner
      giant: { at: P(194, 32), h: 56, r: 13, low: 0.12, label: 'the giant monkey-puzzle' },
      trees: [...grove(P(194, 32), 16, 14, 26, 'cycad').filter(t => Math.hypot(t.x - P(194, 32)[0], t.z - P(194, 32)[1]) > 6),
        ...stand(P(150, 62), 26, 22, 21, [['cycad', 0.55], ['fern', 0.35], ['conifer', 0.1]]), ...stand(P(300, 66), 22, 14, 22, [['cycad', 0.5], ['fern', 0.5]]),
        ...stand(P(200, -92), 24, 12, 24, [['fern', 0.5], ['conifer', 0.5]]), ...stand(P(372, -34), 18, 8, 23, [['cycad', 0.6], ['fern', 0.4]])],
      // the waste: 160 m of sand and gravel down the outside of the dogleg, touching the fairway's left edge
      bunkers: [{ strip: [[95, 24, -13], [140, 40, -19], [185, 50, -24], [205, 46, -26]], wob: 4, waste: true, job: 'catch' },
        { at: P(240, -62), rx: 22, rz: 13, rot: 1.2, waste: true, job: 'through the corner' },
        { at: P(325, 17), rx: 8, rz: 5 }, { at: P(355, -12), rx: 6, rz: 4.5 }],
      green: { lobes: [[1, 2, 10.5, 13.5, 30], [-7, -10, 7, 7, 30]], contour: [{ fall: 0, pct: 1.5 }, { tier: [1.5, 6], up: 180, h: 0.4, w: 5 }], style: 'A pear set from front left to back right, its small lobe at the front left, falling 1.5% toward the front, the back half on a tier 0.4 m up: from the left side of the fairway you play down its length, from the right across it' },
      boulders: [...blocks(P(120, -64), 12, 3, 25)],
      targets: [{ name: 'The elbow', at: P(218, -14) }],
      words: {
        story: 'The giant: a monkey-puzzle older than anything else on the floor, standing alone at the inside of the corner.',
        plays: 'The opener, from the expedition\'s camp on a knoll on the valley floor: tents, a hut on stilts, the cook fire. Ahead the floor runs east to the river, the Strangler stands on its knoll beyond it, and far up the valley to the left the Great Falls pour off the wall. The hole falls gently off the knoll between two old levees and turns hard right, 70°, round a monkey-puzzle 56 m tall: a bare trunk under a flat crown of spiny layered boughs, standing at the inside of the corner with a ring of cycads round its foot. The drive leg is narrow and opens into a big elbow at the corner; a drive that runs straight on goes through into a sandy waste. From the elbow it is a short iron to a two-tier green.',
        safe: 'Lay up to the elbow (about 215 m): the landing area is widest there and the green is a short iron round the corner.',
        bold: null,
        miss: 'Right, the giant\'s boughs and the cycad grove knock a ball down. Straight on through the corner, a sandy waste. Left of the drive leg, the long waste. Nothing here costs a stroke.',
      },
      card: {
        type: 'Original', form: 'Fan into a big elbow at the corner (alike.mjs reads it as scalloped)', feature: 'The giant monkey-puzzle at the inside of the corner', job: 'Aim point (play at its left edge) and frame; its low boughs knock down a ball that cuts the corner',
        decision: 'None: lay up to the elbow, or fade a driver round the giant',
        miss: 'Small: the levees feed it back. Medium: the waste through the corner or down the left, the grove on the right. Big: deep in the cycads. Safe miss at the green: short and left',
        view: 'In front the narrow drive leg between the levees; in the middle the giant at the corner and the waste beyond it; the landing area shows',
        ground: 'Half-pipe: off the camp\'s knoll, about 9 m down, between two old levees that bank up 3 m at 28 m either side, so a small miss is fed back; the landing area nearly level across; a two-tier green, the upper 0.4 m up at the back',
        height: 'Half-pipe', dial: 'The bend: 70°, round the giant (the edge of real golf)', shots: { tee: 'A fade round the giant, or a lay-up to the elbow', approach: 'A short iron, high, that stops on the right tier' }, hazard: 'Down a side and through the corner: the waste', surround: 'Bunkers',
      },
    }),
  }),

  // 2. THE FLOODPLAIN: a true three-shot par 5, 610 yd down the braided river's floodplain, bending right, in steps
  // down and up the river terraces; the back channel is a burn that crosses the line three times
  hole({ n: 2, name: 'The Floodplain', par: 5, legs: [[333, 0], [225, 18]], place: { at: [362.9, -1243], heading: 182 }, tips: [-20, 0], shape: 'Dogleg right',
    build: (P) => ({
      tees: { titan: 0, rex: 26, raptor: [90, 34], compy: [150, 36] },
      // dials: the length (610 yd; a very long hole is wide). The upper terrace wide for the drive, the lower terrace
      // between the burn's first two crossings, the slot between its second and third, and the green's terrace
      fw: [{ e: [[60, 16, 16], [110, 24, 24], [160, 30, 30], [210, 36, 34], [260, 40, 38], [300, 38, 36], [328, 32, 32]], wob: 5 },
        { e: [[352, 26, 30], [385, 32, 34], [420, 28, 30], [455, 26, 26], [476, 22, 22]], wob: 4, seed: 39 },
        { e: [[490, 14, 22], [505, 22, 24], [522, 20, 20], [536, 13, 13], [546, 10, 10]], wob: 4, seed: 41 }],
      corridor: 20,
      cant: [[170, 373, 3]],   // away from the river, down to the right, from the drive to the bend
      // stepped: the tee and the drive on the upper river terrace, a 4 m bank down at the bend to the lower terrace
      // by the burn (the lay-up), and a 3.8 m bank up past the burn's third crossing to the green's terrace
      prof: [[0, 0], [329, -0.3], [347, -4.3], [487, -4.3], [505, -0.5], [563, -0.5]],
      // a hog's back down the first leg, kicking a drive off the line away from it
      forms: [{ at: P(258, 0), rx: 16, rz: 50, rot: 0, h: 1.4, label: 'hog\'s back' }],
      bunkers: [{ at: P(548, 16), rx: 7, rz: 5 }, { at: P(574, -15), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 7.5, 15, -40], [-7.5, 9.5, 7.5, 5.5, 0]], raise: 1.0, falseFront: true, contour: [{ fall: 0, pct: 2 }], style: 'An L: a long leg from front right to back left and a wing at the back left, raised 1 m on a gravel terrace with a false front, falling 2% toward the front (the false front is the feature): open from the right, away from the river' },
      trees: [...stand(P(233, 72), 24, 10, 41, [['conifer', 0.5], ['broad', 0.5]]), ...stand(P(383, 84), 24, 10, 42, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(541, 58), 16, 5, 43, 'conifer')],
      boulders: [...blocks(P(493, -54), 12, 4, 44)],
      targets: [{ name: 'The drive', at: P(255, 4) }, { name: 'Short of the burn', at: P(398, 8) }, { name: 'Between the burns', at: P(458, 2) }],
      words: {
        story: 'The burn: the back channel, a narrow creek that leaves the river and crosses the hole three times before it reaches the oxbow pond.',
        plays: 'A true three-shotter, 610 yd down the braided river\'s floodplain. The river runs down the left in two or three channels between banks of gravel and sand, wide and shallow, and long-necks wade it a hundred metres off the fairway. The tee and the drive are on the upper river terrace, wide and dry. At the bend a 4 m bank drops to the lower terrace, and the back channel is a burn that crosses the line three times: just under the bank, on a diagonal across the lower terrace, and at the foot of the bank up to the green\'s terrace. The green is raised 1 m on the terrace with a false front.',
        safe: 'Drive on the upper terrace (255 m), lay up short of the diagonal (398 m, about 160 m to go), and pitch over the third crossing up to the green.',
        bold: null,
        miss: 'Left is the river: the bars play as bunkers, the channels as water (a stroke and a drop). A huge drive runs down the bank toward the first crossing; a second that runs on finds the second or third. Short of the green, the false front and the burn below it.',
      },
      card: {
        type: 'Long', form: 'Broken, in three pieces between the burn\'s crossings (alike.mjs reads it as stepping stones)', feature: 'The back channel across the hole', job: 'Hazard, set where the second shot wants to finish; the river\'s gravel bars set the lie on the left',
        decision: 'None for the gate (three full shots), but the second chooses: short of the diagonal, or carry it into the slot between the burns (about 90 m to go)',
        miss: 'Small: off the hog\'s back into the first cut, the low right side of the lean. Medium: the gravel bars on the left, the trees on the right. Big: the river on the left, and the burn across the line (penalty across, and on the left only). Safe miss at the green: right and short of the bank',
        view: 'In front the wide upper terrace and the hog\'s back; in the middle the bend and the drop to the lower terrace; beyond, the floodplain and the Bone Bluff in the distance. The landing area shows',
        ground: 'Stepped: the tee and the drive on the upper river terrace, level; a 4 m bank down at the bend to the lower terrace, where the burn runs; a 3.8 m bank up to the green\'s terrace; the drive leans 3% away from the river; the green raised 1 m with a false front',
        height: 'Stepped', dial: 'The length: 610 yd (the edge of real golf); a very long hole is wide', shots: { tee: 'Driver, as hard as you like', approach: 'A full wedge over the burn and up the bank' }, hazard: 'Diagonal: the burn crosses the line three times', surround: 'A tight run-off: the false front back down the bank', setPiece: 'The burn',
      },
    }),
  }),

  // 3. THE BONE BED: bending left round the Bone Bluff, which stands in the middle of the fairway at the corner with a
  // long-neck's skeleton in its face; the green below in the bone bed's hollow, inside a ring of sand
  hole({ n: 3, name: 'The Bone Bed', par: 4, legs: [[240, 0], [149, -30]], place: { at: [230, -660], heading: 272 }, tips: [-28, -30], shape: 'Dogleg left',
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [66, 34], compy: [104, 36] },
      // up to the bluff, then a lane each side of it (left: inside the corner, the short way that opens the green;
      // right: wide and safe, round the outside), joining again past it
      fw: [{ e: [[60, 14, 14], [100, 22, 21], [150, 30, 28], [190, 42, 46], [212, 44, 50]], wob: 5 },
        { e: [[208, 50, -12], [230, 54, -14], [252, 50, -12], [264, 36, -6]], wob: 4, seed: 43 },
        { e: [[208, -12, 52], [232, -14, 58], [256, -10, 56], [266, 0, 48]], wob: 3, seed: 45 },
        { e: [[256, 30, 38], [280, 26, 28], [310, 20, 21], [345, 15, 15], [372, 12, 12]], wob: 5, seed: 47 }],
      corridor: 18,
      cant: [[200, 270, -3]],   // past the bluff the ground falls left into the hollow
      // the crest: the drive climbs over it; the second plays down into the bone bed's hollow
      forms: [{ at: P(130, 0), rx: 80, rz: 34, rot: 0, h: 2.5, label: 'the crest' }],
      // the green inside a ring of sand, open at the front left, where the left lane comes in
      // dials: the bunker count. The bone bed's dig pits: nine small sunk pits where the bones were dug out, round the
      // bluff's foot and down the left lane (the bold side), with the ring round the green and the carry bunker
      bunkers: [{ ring: { inner: 3.5, outer: 10, gap: -30, gapW: 46 }, job: 'surround' }, { at: P(222, -64), rx: 12, rz: 17, rot: 0.2, job: 'carry' },
        ...[[172, -24, 4.5, 3.5], [184, 6, 4, 3.5], [196, -38, 4, 3.2], [212, -26, 4.2, 3.5], [226, -44, 3.8, 3.2], [240, -24, 4.4, 3.6], [252, -40, 3.8, 3.2], [204, 30, 4, 3.4], [262, 22, 4.2, 3.4]].map(([a, o, rx, rz], i) => ({ at: P(a, o), rx, rz, rot: i * 0.7, pot: true, job: 'dig pit' }))],
      green: { lobes: [[0, -2, 8.8, 13, 28], [3, 9.5, 7.4, 7, 0]], contour: [{ fall: 0, pct: 1.5 }, { bowl: [3, 10], r: 12, h: 0.28 }], style: 'A bean set from front left to back right, falling 1.5% toward the front, with a bowl in its back half that gathers to a back pin, the whole green inside a ring of sand with one way in, from the front left' },
      trees: [...stand(P(120, 62), 20, 8, 71, [['broad', 0.5], ['fern', 0.5]]), ...stand(P(250, -86), 22, 10, 72, [['fern', 0.6], ['broad', 0.4]]), ...stand(P(330, 64), 22, 8, 73, [['conifer', 0.6], ['broad', 0.4]])],
      skeleton: { label: 'the skeleton' },
      targets: [{ name: 'Right of the bluff', at: P(232, 44) }, { name: 'Left of the bluff', at: P(222, -28), bold: true }],
      words: {
        story: 'The bluff: a sandstone outcrop standing in the fairway at the corner, a long-neck\'s skeleton showing in its face toward the tee.',
        plays: 'The Bone Bluff stands right in the middle of the fairway at the corner, a sandstone outcrop 30 m high and 45 m long, and the rain has worn its face back until a long-neck\'s skeleton showed through, half out of the rock: its spine curving along the face toward you, ribs like a ship\'s timbers, the long neck reaching up the stone. The drive climbs over a gentle crest, then the fairway splits round the bluff. The left lane runs inside the corner, narrower, with a bunker and the scree of the bone bed on its left, and from it the green\'s way in opens straight ahead. The right lane is wide and safe round the outside, but short of the rock\'s far end the green hides behind it: from there the second is blind over the bluff\'s shoulder, and it comes in across the ring of sand. Past the bluff the hole bends left and falls into the bone bed\'s hollow, where the green sits inside a ring of sand with one way in, from the front left.',
        safe: 'Right of the bluff (232 m), on the right half of its lane: from there the green shows past the rock\'s shoulder and the approach crosses the corner of the sand. A drive that drifts to the left half of the lane is stuck behind the bluff (it stands 29 m) and has to chip out round it.',
        bold: 'Left of the bluff (222 m), inside the corner, threading the dig pits: a short iron straight in through the ring\'s opening.',
        miss: 'At the bluff, the rock: a ball off its face drops at the foot in the scrub. Round its foot and down the left lane, the dig pits. Left of the left lane, the carry bunker, then scree and tree ferns. Right of the right lane, broadleaves. Round the green, sand everywhere but the front left.',
      },
      card: {
        type: 'Original', form: 'Island (the bluff in the middle of the fairway)', feature: 'The Bone Bluff in the middle of the fairway, a skeleton in its face', job: 'Obstacle and aim point; the frame for the tee shot',
        decision: 'Centre-line hazard: left of the bluff is shorter, sees the green and comes in through the ring\'s opening, with a bunker and scree on its left; right is wider and safe, but short of the rock\'s far end the second is blind and crosses the sand',
        miss: 'Small: the edge of either lane. Medium: the carry bunker or the scree left, the broadleaves right, the scrub at the bluff\'s foot. Big: deep in the tree ferns. No penalty ground. Safe miss at the green: front left, through the opening',
        view: 'In front the crest; in the middle the bluff and its skeleton splitting the fairway; beyond, the far wall over the hollow. Both lanes show either side of the rock. From the right lane the green is behind the rock (one of the nine\'s blind shots, on purpose)',
        ground: 'Crest and run: over a low crest, then about 11 m down into the hollow; past the bluff the ground falls left; a bowl in the green\'s back half',
        height: 'Crest and run', dial: 'The bunker count: nine dig pits round the bluff and down the left lane, the ring and the carry bunker (a field)', shots: { tee: 'A draw into the left lane, or a straight one to the right', approach: 'A run-up through the ring\'s gap (from the left), or blind over the bluff\'s shoulder (from the right)' }, hazard: 'The centre: the bluff', surround: 'Bunkers: the ring of sand',
      },
    }),
  }),

  // 4. THE TAR PIT: a short iron over a tar seep that wraps the green's front and right, a great horned skull and
  // ribs in it; the way round is left. No sand: the tar is the hazard (a Short, dressed in tar)
  hole({ n: 4, name: 'The Tar Pit', par: 3, legs: [[133, 0]], place: { at: [-120, -575], heading: 135 }, tips: [12, 0], shape: 'One shot',
    build: (P) => ({
      // dials: the green, a postage stamp (about 300 m²) 115 yd from the back tee, the tar ringing it but for the left
      tees: { titan: [26, -8], rex: [32, -13], raptor: [42, -17], compy: [62, -22] },
      corridor: 12,
      // the safe way round: short grass left of the pit, up to the green's left side
      extraFw: [{ at: P(86, -28), rx: 20, rz: 30, rot: 0.15 }],
      bunkers: [],
      green: { lobes: [[0, 0, 8.4, 11.2, -20]], apron: 3, contour: [{ fall: 0, pct: 1.8 }], style: 'A big peanut set from front right to back left, pinched in the middle, falling 1.5% toward the front with a low spine across the waist that splits the two lobes: the front-right lobe hangs over the tar' },
      trees: [...stand(P(56, 46), 18, 8, 31, [['cycad', 0.6], ['fern', 0.4]]), ...grove(P(166, -42), 16, 4, 32, 'broad')],
      bones: { label: 'the tar pit' },
      sketch: { green: { back: 48, off: -26 } },
      targets: [],
      words: {
        story: 'The pit: a great horned skull and a ribcage standing out of the tar in front of the green, the first thing you see from the tee.',
        plays: 'A tar seep: oil rising through the ground, its lighter parts gone into the air, left black pools that never quite set. They bubble slowly and give off a faint shimmer, and animals that wandered in long ago are still in them: a great horned skull, half sunk, and the arch of a ribcage stand out of the largest pool in front of the green. A postage stamp, 115 yd from the back tee: a green of about 320 m², the smallest on the course, with tar close in front of it, right of it and behind it. The left is a bank down to short grass, the only bail-out. No sand: the tar is the hazard, and it plays like water.',
        safe: 'At the middle of the green, a wedge with height; if in doubt, the left half, where a miss runs down the bank to the short grass.',
        bold: 'At a pin by the right edge, over the tar.',
        miss: 'In the tar: a stroke and a drop. Short, right or long is tar. Left is the bank and the short grass, a chip back up.',
      },
      card: {
        type: 'Short: a postage stamp ringed by tar instead of sand', form: 'None (par 3)', feature: 'The tar pit and its skull and ribs', job: 'Hazard, and the frame for the green; the skull is the aim point for the front-right pin',
        decision: 'None: a par 3 with one bail-out, left',
        miss: 'Small: the fringe. Medium: the bank and short grass on the left. Big: the tar, short, right and long. Safe miss: left',
        view: 'In front the meadow falling to the pit; in the middle the skull and ribs in the tar, and the small green in its ring of tar behind them; beyond, the swamp\'s trees and the far east wall. The green shows',
        ground: 'Level across the tar: the green about 3 m above the tee, the tar in a pit a few metres below it; one fall, 1.8% to the front',
        height: 'Level par 3, across the tar', dial: 'The green: a postage stamp, about 320 m², 115 yd (the edge of real golf)', shots: { tee: null, approach: 'A wedge, high, that stops' }, hazard: 'All round but the left: the tar', surround: 'The tar, and a bank to short grass on the left', setPiece: 'Postage stamp',
      },
    }),
  }),

  // 5. THE SWAMP: a par 5 dogleg left along the swamp's south side; round the corner two of its pools reach across the
  // second leg, so the direct way hops two big stones of fairway between them and the dry way swings round the right
  hole({ n: 5, name: 'The Swamp', par: 5, legs: [[260, 0], [230, -24]], place: { at: [10, -440], heading: 100 }, tips: [-24, 12], shape: 'Dogleg left',
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [70, 32], compy: [112, 34] },
      // the drive's fairway, then two stones between the pools, the approach, and round the right the dry way
      // dials: the width. The causeway is 80 m wide where the drive lands, crowned, the swamp down its left
      fw: [{ e: [[60, 16, 16], [100, 26, 26], [150, 36, 36], [195, 41, 40], [235, 42, 38], [262, 34, 30], [284, 18, 12]], wob: 5 },
        { lobes: [[345, -6, 22, 21, 0]], wob: 3, seed: 51 },
        { lobes: [[423, -6, 21, 21, 0]], wob: 3, seed: 53 },
        { e: [[466, 14, 14], [478, 13, 13]], wob: 3, seed: 55 },
        { e: [[268, -14, 40], [300, -34, 66], [340, -42, 74], [380, -42, 74], [420, -36, 66], [448, -22, 50], [466, -8, 30]], wob: 4.5, seed: 57 }],
      corridor: 14,
      cant: [[180, 262, 3]],   // away from the swamp, toward the dry side
      // a hog's back: the drive's fairway is a causeway of dry ground, crowned (2.2 m down at 30 m off), shedding a
      // ball off either shoulder
      cross: [[150, 300, -2.2, 30]],
      // a low bank along the dry way's left edge, between it and the pools: it holds the dry way level and stops a
      // ball running off it toward the water (a helper)
      forms: [{ at: P(370, 30), rx: 8, rz: 80, rot: -0.42, h: 1.3, label: 'the bank' },
        // collection hollows round the green instead of bunkers: back right and short left
        { at: P(500, 22), rx: 9, rz: 11, rot: 0.3, h: -1.3, label: 'hollow' }, { at: P(474, -20), rx: 8, rz: 9, h: -1.1, label: 'hollow' }],
      // the cross bunker: a band of sand right across the approach and the dry way's end; a catch bunker at the drive
      bunkers: [{ strip: [[450, 10, 40], [456, 12, 44], [462, 10, 40]], wob: 2, job: 'cross' }, { at: P(250, -46), rx: 15, rz: 11, rot: 0.4, job: 'catch' }],
      green: { lobes: [[0, 8, 15, 7, 8], [0, -3, 7, 12, 0]], join: 4, contour: [{ fall: 0, pct: 1.5 }, { bowl: [8, 9], r: 10, h: 0.3 }], style: 'A T: a bar across the back and a stem toward you, falling 1.5% toward the front, with a bowl in the right end of the bar that gathers to a back-right pin: open from the stem, past the cross bunker' },
      // the swamp's cypresses stand in the water and on the hummocks; a few broadleaves on the dry ground
      swampTrees: { n: 160, seed: 81 },
      trees: [...stand(P(330, 110), 22, 8, 82, [['broad', 0.6], ['fern', 0.4]]), ...grove(P(120, 60), 20, 6, 83, 'conifer')],
      targets: [{ name: 'The drive', at: P(240, 4) }, { name: 'The dry way', at: P(372, 56) }, { name: 'The stepping stones', at: P(346, -6), bold: true }],
      words: {
        story: 'The stepping stones: round the corner the swamp\'s black pools reach right across the fairway, leaving two islands of fairway between them.',
        plays: 'Where the river runs out of slope it spreads into a swamp: still black water in pools between hummocks of mud and roots, tall cypresses standing in it on buttressed trunks, mist lying low over it even in the afternoon. The drive is to a causeway of dry ground along its south side, about 80 m wide where it lands and crowned, so a drive off the crown runs down one shoulder or the other; it leans 3% away from the water. Round the corner the swamp reaches right across the second leg in two long pools, and the fairway goes on as two big islands between them: the direct way hops from one to the next, straight at the green. The dry way swings round the right on firm ground, longer, and a band of sand crosses both ways short of the green. Hollows, not bunkers, round the green.',
        safe: 'Drive to the corner (240 m), play round the right on the dry way (372 m), carry the cross bunker and pitch on.',
        bold: 'From the corner, over the first pool to the first stone (346 m), or a big second over both pools at the green.',
        miss: 'Left is the swamp: water is a stroke and a drop, the hummocks a muddy lie among the trees. Between the stones, the pools. Short of the green, the cross bunker; round it, the hollows.',
      },
      card: {
        type: 'Original', form: 'Split: two stepping stones, each 42 m or more, beside the dry way (alike.mjs reads it as a split)', feature: 'Two pools of the swamp across the second leg', job: 'Hazard on the direct way; the stones set where the lay-up stops; a low bank between the pools and the dry way is a helper, holding a ball out of the water',
        decision: 'The long way round: the stones are shorter and straight at the green with water between and left; the dry way round the right is longer and has no water',
        miss: 'Small: off the crown down a shoulder. Medium: the catch bunker and the hummocks on the left, the broadleaves right, the cross bunker, the hollows. Big: the swamp and the pools, on the left and on the direct way only. Safe miss at the green: right, into the hollow',
        view: 'In front the drive\'s fairway along the swamp; in the middle the cypresses standing in the water at the corner; beyond, the east ledge and Nest Falls on the far wall. The landing area shows; the stones open up from the corner',
        ground: 'Hog\'s back: a causeway of dry ground, crowned 2.2 m over 30 m either side, leaning 3% away from the swamp; about 3 m down to the swamp\'s edge; a bowl in the green\'s back right, hollows round it',
        height: 'Hog\'s back', dial: 'The width: an 80 m causeway where the drive lands (the edge of real golf)', shots: { tee: 'Dead straight, on the crown', approach: 'A long iron or wood over the pools (bold), or a pitch from the dry way' }, hazard: 'Diagonal: the pools across the second leg', surround: 'Collection hollows',
      },
    }),
  }),

  // 6. THE NEST: the climb, mid-round, up a broad ramp of fallen rock to the ledge on the east wall; a step of rock 4 m
  // high crosses the ramp, broken down on the right; Nest Falls pours down the wall behind the green and the
  // pterosaurs nest on the cliff above
  hole({ n: 6, name: 'The Nest', par: 4, legs: [[361, 0]], place: { at: [590, -360], heading: 35 }, tips: [-34, 6], shape: 'Sidehill climb',
    build: (P) => ({
      tees: { titan: 0, rex: 20, raptor: [62, 36], compy: [100, 40] },
      // a funnel: generous below the step, closing all the way up to the ledge
      fw: [{ e: [[55, 38, 36], [100, 44, 42], [150, 44, 42], [190, 40, 38], [215, 30, 28], [245, 25, 24], [280, 19, 19], [315, 14, 14], [342, 11, 11]], wob: 4.5 }],
      corridor: 16,
      cant: [[130, 300, -9]],   // the strong sidehill of the nine: the ramp falls away to the left, toward the open valley
      // the step: a band of rock right across the ramp, the ground flattened either side of it; on the right its face
      // breaks down into a rubble slope you can run a ball up
      step: { s: 211, h: 4, face: 3.2, from: 110, to: 330, gap: [34, 70], label: 'the step' },
      bunkers: [{ at: P(150, -50), rx: 18, rz: 12, rot: -0.3, job: 'catch' }, { at: P(344, 2), rx: 5, rz: 4, pot: true }, { at: P(378, -14), rx: 7, rz: 4.5 }],
      green: { lobes: [[-6, -3, 8.5, 11, 30], [4, 6, 9.5, 8, -20], [6, -7, 6, 6, 0]], join: 5, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-12, -7], [-6, 9]], h: 0.28, w: 3 }], style: 'A crescent curled round a pot bunker at the front, its horns toward you, on the ledge just above the ramp\'s head, falling 1.6% toward the front with a spine running from the left horn to the back: open from the left' },
      trees: [...stand(P(150, 66), 22, 8, 91, [['fern', 0.5], ['broad', 0.5]]), ...stand(P(290, -60), 18, 6, 92, [['cycad', 0.6], ['fern', 0.4]])],
      targets: [{ name: 'Over the step', at: P(240, 4) }],
      words: {
        story: 'The step: a band of rock right across the ramp, the climb\'s first real rise, with the falls and the nests ahead above it.',
        plays: 'Halfway round, the climb: up a broad ramp of fallen rock and soil that a landslide spread down from the east wall, to the ledge 27 m above the floor. The ramp is the strongest sidehill on the course: it falls 6% to the left, away from the wall, so the second is played with the ball below your feet. About 210 m up, a step of rock 4 m high runs right across the ramp, its face toward you; on the right it has broken down into a slope of rubble. Below the step the fairway is wide; above it the ramp narrows all the way to the ledge. The green sits on the ledge just above the ramp\'s head, curled round a pot bunker, Nest Falls roaring down the wall into its pool behind it and its stream running past the back of the green to the lip, the pterosaurs\' nests on the cliff above and the birds wheeling over the green. The climb makes it play about a club longer.',
        safe: 'Carry the step on the right half (240 m) and let the slope bring it back; take a club more.',
        bold: null,
        miss: 'Short of the step, a blind second up the face (a ball into the face drops at its foot). Left, the slope runs a ball into the big bunker below the step, and past it the ramp\'s steep edge. Right, jungle at the wall\'s foot. Short of the green, the pot bunker in its crescent.',
      },
      card: {
        type: 'Original', form: 'Funnel', feature: 'The step of rock across the ramp', job: 'Lie-setter (above it a flat stance, below it a blind second) and obstacle; the catch bunker on the low side is a helper, stopping a ball before the ramp\'s edge',
        decision: 'None: one clear line, over the step on the right half',
        miss: 'Small: the low left side of the sidehill. Medium: the catch bunker left, the jungle right, short of the step. Big: off the ramp\'s left edge. No penalty ground. Safe miss at the green: left of the pot',
        view: 'In front the wide ramp; in the middle the step\'s face across it; beyond, the ledge, Nest Falls and the cliff above. The landing area beyond the step shows over its face from the back tee',
        ground: 'Hillside bench: the big climb, about 31 m up the ramp, and across the landing area it leans 9% down to the left (the strong sidehill of the nine), the low side soft (rough, then the catch bunker); a spine across the green',
        height: 'Hillside bench, and the big climb', dial: 'The height: 31 m up, on a 9% bench', shots: { tee: 'A fade into the slope', approach: 'From a hanging lie, the ball above the feet' }, hazard: 'Across: the step', surround: 'A drop: the ledge falls away left of the green',
      },
    }),
  }),

  // 7. THE OVERLOOK: a par 3 off the ledge's bluff, 27 m down to a green on the floor tilted hard from back to front,
  // bunkers short left and right, the creek from Nest Falls running down the left and round behind it (an Eden). The
  // first look at the whole valley from above
  hole({ n: 7, name: 'The Overlook', par: 3, legs: [[197, 0]], place: { at: [788, -723], heading: 310 }, flat: 8, fade: 30, shape: 'One shot, down off the bluff',
    build: (P) => ({
      // the back tees on the ledge at the lip; the forward tees on the floor at the bluff's foot
      tees: { titan: 0, rex: [2, 16], raptor: [52, 8], compy: [84, -6] },
      corridor: 14,
      // short grass round the right of the green, the safe side
      extraFw: [{ at: P(186, 26), rx: 16, rz: 22, rot: 0.2 }],
      bunkers: [{ at: P(174, -16), rx: 7, rz: 5, rot: 0.3 }, { at: P(178, 15), rx: 6, rz: 4.5, pot: true }],
      green: { lobes: [[-5, 2.5, 11.2, 15, -20], [7.5, -3.8, 10, 11.2, 10], [0, 12.5, 7.5, 6.2, 0]], join: 5, apron: 4, contour: [{ fall: 0, pct: 2.4 }], style: 'A wide kidney set square to the tee, tilted hard from back to front (2.4%, the Eden\'s slope), with bunkers short left and short right: above the hole every putt is fast' },
      trees: [...stand(P(110, -70), 20, 10, 101, [['fern', 0.6], ['broad', 0.4]]), ...stand(P(250, -10), 22, 8, 102, [['broad', 0.5], ['fern', 0.5]]), ...stand(P(130, 60), 18, 6, 103, [['cycad', 0.5], ['fern', 0.5]])],
      boulders: [...blocks(P(30, -30), 14, 6, 105, [3, 7]), ...blocks(P(36, 40), 12, 5, 106, [3, 6])],
      spire: { at: P(70, -34), h: 25, label: 'the spire (the pterosaur)' },   // its top just over the lip, a quarter of the way into the tee view (was P(58, -52), 40 m: at the frame's edge)
      targets: [],
      words: {
        story: 'The overlook: the first time the round sees the whole valley from above, from a tee on the lip of the ledge.',
        plays: 'Up to now the round has seen the valley from its floor. From the ledge\'s lip the whole of it opens below: the river braiding north toward the Great Falls on the right, the swamp steaming in the sun, the herds on the plain, the camp\'s smoke, the walls rising sheer all round with falls pouring off them. On the first tee shot here a big crested pterosaur launches off the rock spire just left of the tee and glides out below you. Beside the tee on the right stands the expedition\'s lookout, a timber platform on stilts at the lip with a telescope and the flag. The green is 27 m down on the floor, tilted hard from back to front, with a bunker short left and a pot short right. The creek that Nest Falls feeds spills off the bluff beside you, runs down the left, and curls round behind the green on its way to the river.',
        safe: 'A club less than the yardage (the drop takes about 30 yd off) at the middle of the green; a miss right finds short grass.',
        bold: 'At a back pin: long is the creek.',
        miss: 'Long or long left, the creek (a stroke and a drop). Short left and short right, the bunkers. Right, short grass and a bank. Above the hole every putt runs.',
      },
      card: {
        type: 'Eden', form: 'None (par 3)', feature: 'The drop off the bluff, and the creek from Nest Falls', job: 'The view (the course\'s reveal); the creek is the hazard long and left, the Eden\'s estuary',
        decision: 'None: a par 3',
        miss: 'Small: the fringe, the short grass right. Medium: the bunkers short left and right, the bank right. Big: the creek, long and left (penalty on one side only). Safe miss: right',
        view: 'In front the lip and the drop; in the middle the green on the floor and the creek curling round it; beyond, the whole valley, the Strangler on its knoll and, on the right of the frame, the Great Falls. The lookout beside the tee on the right. The green shows (check the lip in a tee render)',
        ground: 'Drop par 3 (the course\'s one): about 26 m down off the ledge; a big green, about 810 m², tilted hard from back to front',
        height: 'Drop par 3', dial: 'The height: 26 m down off the ledge', shots: { tee: null, approach: 'A long iron, high, to a big tilted green' }, hazard: 'Behind: the creek long and left', surround: 'Bunkers, short left and short right',
      },
    }),
  }),

  // 8. THE STRANGLER: a drivable par 4 up onto a knoll, a colossal strangler fig whose buttress roots arch over the
  // right of the fairway: the bold drive threads under the arch, the safe line goes round to the left, where the green
  // hides behind the root's foot (a Leven)
  hole({ n: 8, name: 'The Strangler', par: 4, legs: [[274, 0]], place: { at: [725, -845], heading: 345 }, flat: 80, fade: 46, hold: true, shape: 'Straight, drivable',
    build: (P) => ({
      tees: { titan: 0, rex: 14, raptor: [52, 36], compy: [92, 40] },
      // two ways: straight up the middle and under the arch, or a branch of fairway out left round the fig's foot
      fw: [{ e: [[52, 13, 13], [88, 22, 20], [125, 26, 22], [160, 24, 22], [195, 21, 21], [222, 22, 24], [240, 23, 23], [254, 18, 18], [264, 12, 12]], wob: 4.5 },
        { e: [[112, 26, 2], [140, 56, -14], [170, 80, -40], [198, 88, -48], [220, 82, -50], [238, 68, -52]], wob: 4, seed: 33 }],
      // a table top: the knoll's flank climbs 4 m to 150 m, then a 6 m bank (165-187 m) up onto a level top 90 m wide
      // (34 m left of the line to 58 m right) with the fig and the green on it; the left branch runs along its foot
      prof: [[0, 0], [150, 4], [290, 4]],
      table: { s0: 176, s1: 310, L: -34, R: 58, h: 6, face: 22 },
      corridor: 16,
      cant: [[110, 210, 2.5]],   // the knoll's flank falls right, toward the arch side and the green's open side
      // the fig right of the line at 240 m: its trunk, a canopy 68 m across, and the root arch spanning from the
      // trunk 52 m across the fairway to a buttress foot 18 m left of the line, 17 m clear under its crown
      strangler: { trunk: P(240, 34), r: 8, h: 58, canopy: 34, arch: { foot: P(232, -18), crown: 17, t: 3.5 }, label: 'the Strangler' },
      bunkers: [{ at: P(160, 26), rx: 15, rz: 10, rot: 0.3, job: 'target' }, { at: P(256, -16), rx: 7, rz: 5 }, { at: P(284, 12), rx: 6, rz: 4.5 }],
      green: { lobes: [[-4.1, 3.3, 6.6, 13, -45], [4.9, -4.9, 6.6, 5.7, 0]], apron: 5, contour: [{ fall: 45, pct: 1.6 }, { tier: [-5, 5.7], up: -135, h: 0.55, w: 4 }], style: 'Long and thin, set at 45° from front right to back left, with a knob at the front right, falling 1.8% toward the front right, its back-left end on a shelf 0.6 m up (the bold green of the nine): open from the right, from under the arch' },
      trees: [...stand(P(110, -56), 20, 8, 61, [['broad', 0.5], ['conifer', 0.5]]), ...stand(P(262, -58), 18, 6, 62, [['fern', 0.5], ['broad', 0.5]])],
      targets: [{ name: 'Round the left', at: P(195, -66) }, { name: 'Under the arch', at: P(248, 2), bold: true }],
      words: {
        story: 'The arch: a buttress root of a colossal strangler fig arching right across the fairway short of the green.',
        plays: 'A strangler fig starts life as a seed in a tree\'s crown and sends roots down round its host until they meet the ground, fuse and take over; this one is colossal, 58 m tall, its host long gone. It stands on a table top the hole climbs to: the knoll\'s flank rises 4 m, then a 6 m bank (165–187 m from the Titan tee) lifts onto a level top 90 m wide, with the expedition\'s survey pole on the lip. The fig stands right of the line on the top, 35 m short of a small green, and one of its buttress roots arches 52 m across the fairway to a foot 18 m left of the line, 17 m clear under its crown. The bold drive flies the bank and threads under the arch. The safe line takes a branch of fairway out left, along the table\'s foot, and from there the green hides behind the bank and the buttress. Behind you, the ledge you have just come down; ahead, the Great Falls.',
        safe: 'An iron out onto the left branch (195 m), along the table\'s foot, and a wedge up the bank over the buttress.',
        bold: 'Driver at the green: fly the bank (about 190 m) and run under the arch onto the top; a high one hits the root.',
        miss: 'Short of the bank, the face stops it below the top. The fig\'s canopy knocks a ball down; its root is solid. A bunker on the right where an iron lands. The green is small.',
      },
      card: {
        type: 'Leven', form: 'Split (the main line under the arch, a branch round the left)', feature: 'The Strangler\'s root arch', job: 'Obstacle (under or round), the frame for the bold drive, and the mound that hides the green from the safe side',
        decision: 'Drivable par 4: under the arch at the green (300 yd from the Titan tee), or an iron round the left and a wedge over the buttress',
        miss: 'Small: the first cut either side. Medium: the target bunker right, the canopy, the trees left. Big: deep in the broadleaves. No penalty ground. Safe miss at the green: front right, under the arch',
        view: 'In front the knoll\'s flank and the face of the table with the survey pole on its lip; in the middle the fig and its arch over the top; beyond, the Great Falls up the valley. The arch and the left branch both show; the top itself doesn\'t',
        ground: 'Table top: up the knoll\'s flank 4 m, then a 6 m bank (165–187 m from the Titan tee) onto a level top 90 m wide, the fig and the green on it, the survey pole on the lip; the top leans 2.5% right; a shelf on the green\'s back left',
        height: 'Table top', dial: 'A carry: the table\'s face, about 190 m from the Titan tee, 80% of a long drive, never forced (lay up below it)', shots: { tee: 'A high carry over the face', approach: 'Blind over the buttress (from below), or a pitch from the top' }, hazard: 'In front of the green: the buttress', surround: 'A bank that feeds, from under the arch',
      },
    }),
  }),

  // 9. THE PLUNGE POOL: a reachable par 5 down the east bank toward the Great Falls, bending left, to a green on a
  // shelf of rock out in the pool, the falls straight behind it. Big bunkers bite in from alternate sides
  hole({ n: 9, name: 'The Plunge Pool', par: 5, legs: [[250, 0], [198, -15]], place: { at: [700, -1120], heading: 345 }, shape: 'Dogleg left, down to the pool',
    build: (P) => ({
      tees: { titan: 0, rex: 22, raptor: [68, 36], compy: [108, 38] },
      // one fairway, scalloped: big bunkers bite in from the left, the right, then the left again
      fw: [{ e: [[60, 26, 26], [120, 36, 36], [200, 40, 38], [260, 38, 36], [320, 34, 32], [370, 26, 24], [405, 16, 15], [425, 11, 11]], wob: 3.5 },
        { bite: [[132, -34, 26, 24], [222, 38, 30, 26], [316, -32, 24, 24]], wob: 2 }],
      corridor: 18,
      cant: [[180, 280, -2.5], [330, 400, 2]],   // the drive leans left (toward the river side), the lay-up back to the right
      // a fall-away: gently down the bank to the neck, then 5 m down over the last 60 m to the shelf in the pool
      prof: [[0, 0], [240, -0.6], [300, -3.5], [388, -7.7], [436, -11.4], [460, -11.5]],
      bunkers: [{ at: P(132, -30), rx: 20, rz: 22, job: 'carry' }, { at: P(222, 33), rx: 21, rz: 26, job: 'target' }, { at: P(316, -34), rx: 17, rz: 21, rot: -0.26, job: 'approach' },
        { at: P(452, 18), rx: 5, rz: 4 }],
      // dials: the green, past anything real: about 1,300 m² filling the shelf, in two parts across a spine of rock (the
      // near part by the neck, the far part out on the point over the pool)
      green: { lobes: [[2, -2, 12, 13, 10], [-23, 4, 12, 13, -20], [-10, 14, 10, 8.5, 0], [-10, -7, 9, 6.5, 0]], join: 5, apron: 4, raise: 0.4, contour: [{ fall: 60, pct: 1.6 }, { ridge: [[-10, -14], [-11, 20]], h: 0.5, w: 2.6 }], style: 'A clover of three lobes filling a shelf of rock that juts out into the pool, falling 1.6% toward the front right, away from the water (flatter: the second may be a long one, the pool close): short grass round its right side, the neck you come in on' },
      trees: [...stand(P(150, 80), 22, 10, 111, [['broad', 0.6], ['fern', 0.4]]), ...stand(P(300, 72), 20, 8, 112, [['fern', 0.6], ['broad', 0.4]]), ...grove(P(90, -86), 16, 5, 113, 'conifer')],
      boulders: [...blocks(P(222, 72), 12, 5, 114, [2, 5]), ...blocks(P(470, 30), 10, 5, 115, [2, 5])],
      targets: [{ name: 'The drive', at: P(240, -8) }, { name: 'The neck', at: P(376, 0) }], goGreen: true,   // go or lay up: the Green is the bold target (engine: Green marked bold)
      words: {
        story: 'The shelf: a tongue of rock out into the plunge pool, the green on it, the Great Falls coming down behind.',
        plays: 'Home, toward the Great Falls: they pour off the valley\'s north-east wall 420 m in one leap into a deep pool at the foot, and the round has been walking toward them. The 9th runs nearly level along the east bank from the Strangler\'s knoll, the river and its gorge off to the left, big bunkers biting in from one side then the other, then falls steadily, 11 m, round the corner to the pool. The green fills a shelf of rock that juts out into the pool from its south-east shore: about 1,300 m², twice anything on a real course, in two parts across a spine of rock, the near part by the neck and the far part out on the point over the water. The falls are straight behind it, spray drifting across it. The way on is the neck, short grass from the right. Left of the approach the rope bridge spans the gorge where the river leaves the pool.',
        safe: 'Drive to the corner (240 m), lay up on the neck (376 m, about 80 yd in) and pitch down onto the near part.',
        bold: 'Reach it in two: a long second down to the shelf, the pool left and long; the part you land on decides the putt.',
        miss: 'Left of the approach, the gorge and the pool: a stroke and a drop. Long, the pool. Right of the green, short grass and rock. In the fairway, the three big bunkers. On the green, the spine between its two parts.',
      },
      card: {
        type: 'Original', form: 'Scalloped', feature: 'The shelf green in the plunge pool, the Great Falls behind', job: 'Hazard (the pool left and long) and the frame for the whole hole; the bunkers set the line',
        decision: 'Go or lay up: the green only opens from the neck; a long second over the pool\'s edge reaches it in two',
        miss: 'Small: the first cut, the lean. Medium: the three bunkers, the trees right. Big: the gorge and the pool, left and long (penalty on one side only). Safe miss at the green: right, the neck',
        view: 'In front the fairway falling away; in the middle the bunkers biting in; beyond, the Great Falls at the end of the hole (from the tee the lower half fits the frame). The landing area shows',
        ground: 'Fall-away: nearly level along the east bank to the drive, then 11 m down to the shelf, 3 m of it in the last 60 m, so the green sits below you with the pool beyond; the drive leans left, the lay-up back right; a green in two parts across a 0.5 m spine',
        height: 'Fall-away', dial: 'The green, past real golf: about 1,300 m² in two parts across a spine of rock', shots: { tee: 'A draw round the corner', approach: 'A long iron or wood down to the shelf (the go), or a downhill pitch from the neck' }, hazard: 'Behind: the pool, long and left', surround: 'Water: the pool',
      },
    }),
  }),
];

// finishing touches that need the built line: the bold lines
{
  const at_ = (h, s, o = 0) => at(h.line, s, o);
  HOLES[2].boldLine = [[0, 0], at_(HOLES[2], 300, -10)];
  HOLES[4].boldLine = [[0, 0], HOLES[4].pin];
  HOLES[7].boldLine = [[0, 0], HOLES[7].pin];
}
