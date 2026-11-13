// Emberfell: nine holes on a volcano at dusk. Round 6 (11 November 2026) re-lays it to a new skeleton, 5 4 4 3 4 5
// 4 3 4: three play round the outside of the cone on a broad shoulder below the rim (a kipuka of old forest with a
// live lava river beside it, a barranco, a collapsed lava tube), the 4th drops 59 m off the rim at the Notch into
// the caldera, and five play inside it, down two slumped terraces, past a lavafall, round the lava lake, into a
// cinder cone on the floor and out to an island in the lake. `words` carries each hole's card (story, form, type,
// feature, decision, miss map, tee view, ground; docs/COURSE-DESIGN.md Part 1).
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the
// line, y up from the hole's `base`, the back tee's height), from `legs` ([length, turn in degrees, + = right]).
// `place` puts it on the mountain (world.mjs): world x east, -z north. Heights come from the mountain under
// the line (scene.mjs), with `ramps` where the fairway eases down a step, plus the hole's own shapes.
// Plan data for the book (plans, profiles, sketch views), written to convert to the engine format later.
import { lineOf, lengthOf, at, YD, rnd } from './geo.mjs';

export const COURSE = {
  id: 'emberfell', name: 'Emberfell', theme: 'volcano', altFt: 3550,
  signature: { time: 'dusk', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'warm', plume: true },
  teeSets: [
    { id: 'obsidian', name: 'Obsidian', color: '#1d1b22', minDrive: 260 },
    { id: 'basalt', name: 'Basalt', color: '#3f6290', minDrive: 230 },
    { id: 'pumice', name: 'Pumice', color: '#efe8d6', minDrive: 200 },
    { id: 'ash', name: 'Ash', color: '#9a958d', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets, and
  // each hole's `tips` kept out of its tees and yards. Turning it on: put this first in teeSets and copy every
  // hole's tips.tee and tips.yards into its tees and yards under 'magma'
  tipsSet: { id: 'magma', name: 'Magma', color: '#8a2414', minDrive: 290 },
};
export const BACK = 'obsidian', FRONT = 'ash';

// the course card (docs/COURSE-DESIGN.md Part 1), round 6: the plan book prints it after the cover
export const CARD = {
  hook: 'A volcano at dusk, nothing fantastical: lava plays as water. The round climbs the shoulder outside the cone, comes over the rim at its one low saddle, the Notch, and plays down the caldera to an island in the lava lake.',
  skeleton: '5 4 4 3 4 5 4 3 4, par 36: the first course to open with a par 5. Three holes outside, the 59 m drop off the rim at the 4th, five inside. The drivable par 4 is the 5th; the long par 3 the 4th (240 yd, plays about 188); a short par 3 into a cinder cone the 8th. It finishes across a rock bridge to an island green. Against every other course it shares a par on four holes at most.',
  classics: 'Four: a Leven (5, the Terraces: the lava pool sits on the side that opens the green, and from the safe terrace the green is below the crag), a Long (6, the Lavafall: the rill crosses where the second wants to finish), a Cape (7, the Lake) and a Punchbowl (8, the Cinder Cone). The Lava Tube\'s double fairway is the course\'s own; the Crown keeps its crescent.',
  decisions: 'Four, of four kinds: 5 drivable (carry the columns or lay up on the terrace), 6 go or lay up (the rill), 7 bite off what you dare (the cape), 9 split fairway (the beach lane or the left). 5, 6 and 7 come in a row, which the rules avoid; Rhys kept the Lake\'s cape on purpose, and each asks a different shot. The Lava Tube is not a decision: its channel is the forward tees\' lane.',
  landmarks: 'The plume (seen from the Crown\'s tee, the Terraces\' landing, the Lake\'s tee and landing, the Cone\'s tee), the lavafall (the Terraces\' tee, the Lavafall\'s tee and landing), the island clubhouse (the Crown\'s tee, the Terraces\' landing, the Lake\'s landing, the Heart\'s tee and landing) and the cinder cone on the floor (the Crown\'s tee, the Terraces\' tee and landing, the Lavafall\'s tee, the Lake\'s tee straight ahead, its own tee). The one reveal is the caldera from the Crown\'s tee: from every tee and landing area on 1–3 nothing inside shows, the cone included.',
  rhythm: 'A gentle opener: wide, no carry, the river 40 m off the line at its nearest. The hardest run is 3–7; the short cone hole is the breather; the finish is a decision and the course\'s set piece. Par 4s 340, 385, 405, 430 and 455 yd; par 3s 34 yd apart plays-like, facing north-north-west and north-east. Three bends left, three right, three straight; all four quarters of the compass.',
  fairways: 'Seven par 4 and 5 fairways, seven forms: scalloped (1), funnel (2), double (3), hourglass (5), broken (6), fan (7), split (9). The check finds none alike; two match a fairway on another course, inside the budget.',
  borrowed: 'New to the register: a double fairway either side of a lava tube; a shoreline hole with a beach as the miss (the Heart); an island green with lava all round (Emberfell\'s alone); a green in an amphitheatre, the Lavafall\'s bay under the fall. Borrowed from the over-used list, all approved before the rules review: the fall as a backdrop, the tee shot off the rim, the punchbowl, the bridges, the terraces.',
  tips: 'The Magma tees, switched off in the data (COURSE.tipsSet, hole.tips): 3,795 yd, 15–40 yd behind the back tee, every spot checked for a 280–300 yd drive.',
};

// trees scattered round a point: the kipuka's old forest (ohia), tree ferns
const grove = (p, r, n, seed, h = [8, 16], rr = [2.2, 4]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: rr[0] + R() * (rr[1] - rr[0]), h: h[0] + R() * (h[1] - h[0]) }; }); };
// blocks of basalt: n round a point
const blocks = (p, r, n, seed, sz = [2, 5]) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r, s = sz[0] + R() * (sz[1] - sz[0]); return { at: [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], r: s, h: s * (0.6 + R() * 0.5) }; }); };
// lava trees: stone shells left standing where a flow engulfed a forest (they play like trees)
const lavaTrees = (p, r, n, seed) => { const R = rnd(seed); return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { at: [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], r: 0.7 + R() * 0.7, h: 1.8 + R() * 3.2, seed: Math.floor(R() * 1e4) }; }); };

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1);
  // tee spots: a number is s along the line; [s, off] a pad beside it
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) { const s = typeof v === 'number' ? v : v[0]; h.yards[k] = Math.round((len - s) / YD / 5) * 5; }
  // the tips tee (a fifth set at tour length, COURSE.tipsSet, switched off): behind the back tee, 30-50 yd on the
  // par 4s and 5s, less on the par 3s; `tips: [s, off]` in a hole's definition is its spot, s < 0
  const tp = def.tips || h.tips || (def.par === 3 ? [-14, 0] : [-36, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  // the switched-off tips tee in the engine's format (in the hole's frame, like tees); `def.tips` is its spot [s, off]
  h.tips = { tee: h.tipsPt.map(v => Math.round(v * 10) / 10), yards: h.tipsYards };
  return { ...def, ...h };
}
// an open crack (the tube's collapsed trench, a skylight) or a scarp (a flow front, open: false), along [s, off]
// points, w wide; lip: { h, toward: [s, off], run, fall } raises one side. Built by shapes.mjs makeCrack.
let cvSeed = 1;
const cv = (P, pts, w, lip, more = {}) => ({ pts: pts.map(p => P(...p)), w, seed: cvSeed++, lip: lip && { ...lip, toward: P(...lip.toward) }, ...more });

export const HOLES = [
  // 1. KIPUKA: a gentle three-shot opener along an island of old forest left when fresh lava flowed round it, a
  // live lava river far down the right. Round 6: a par 5 (the tee 120 m further back on the flow), its fairway
  // scalloped by the forest's lobes on the left and tongues of fresh flow on the right
  hole({ n: 1, name: 'Kipuka', par: 5, legs: [[345, 0], [132, -35]], place: { at: [-586, 641], heading: 75 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 22, pumice: [95, -38], ash: [150, -44] },
      // form: scalloped. A wide ribbon with the forest biting in from the left and the flow from the right, in turn
      fw: [{ e: [[50, 12, 14], [110, 26, 26], [180, 37, 35], [250, 37, 39], [320, 39, 34], [380, 33, 32], [420, 25, 22], [452, 15, 14]], wob: 6 },
        { bite: [[150, -36, 38, 28, 8], [246, 38, 36, 28, -10], [334, -34, 36, 26, 6], [404, 30, 26, 18, -8]], wob: 2.5 }],
      corridor: 22,
      cant: [[195, 290, 2.5], [320, 420, -3]],   // the drive's landing falls right toward the flow (an easy hole); the lay-up's left, toward the forest
      // the kipuka: old ground a little higher than the flows, with its forest down the left and in the corner
      forms: [{ at: P(300, -84), rx: 64, rz: 185, rot: -0.15, h: 3, label: 'the kipuka (old forest)' }],
      zones: [{ blobs: [[150, -60, 26], [205, -74, 30], [255, -72, 30], [330, -60, 34], [384, -70, 34], [430, -56, 28], [462, -48, 22]], surf: 'forest' }],
      // where the forest stops, the edge of the fresh flow: a ragged front of black lava 3 m high; on the right, two
      // tongues of the fresh flow nose in toward the fairway (raised, with a steep front)
      cracks: [cv(P, [[180, -128], [270, -142], [340, -150], [410, -120], [470, -96], [530, -90]], 0, { h: 3.2, toward: [340, -220], run: 30, fall: 20, face: 2.5 }, { open: false, jag: 6, crag: true }),
        cv(P, [[214, 84], [232, 66], [250, 62], [268, 68], [286, 88]], 0, { h: 2.4, toward: [250, 110], run: 22, fall: 14, face: 2 }, { open: false, jag: 4, crag: true }),
        cv(P, [[376, 72], [392, 56], [408, 54], [424, 64]], 0, { h: 2, toward: [400, 100], run: 18, fall: 12, face: 2 }, { open: false, jag: 4, crag: true })],
      bunkers: [{ at: P(372, 40), rx: 17, rz: 11, rot: 0.15, kind: 'cinder', job: 'catch' },
        { at: P(462, 18), rx: 8, rz: 5 }, { at: P(492, -15), rx: 7, rz: 5 }],
      green: { lobes: [[-5, 8, 8, 12, -30], [3, -6, 8, 11, -30], [6, 3, 6, 7, 0]], contour: [{ fall: -40, pct: 1.8 }, { bowl: [-6, 10], r: 11, h: 0.3 }], style: 'A kidney set from front right to back left, curled round the forest, falling 1.8% toward the front left, with a shallow bowl in the back-left lobe that gathers to a back pin: open from the right, where the bunker guards the lay-up' },
      trees: [...grove(P(160, -68), 24, 9, 10), ...grove(P(270, -72), 32, 16, 11), ...grove(P(340, -78), 36, 18, 12), ...grove(P(410, -60), 22, 9, 13), ...grove(P(490, -52), 16, 6, 14)],
      boulders: [...blocks(P(290, 50), 14, 5, 15), ...blocks(P(420, 50), 12, 4, 16)],
      vent: { at: [-175, 540], label: 'spatter vent' },
      targets: [{ name: 'The drive', at: P(240, -4) }, { name: 'The bend', at: P(352, -2) }],
      words: {
        story: 'A gentle three-shot opener down an island of old forest that fresh lava flowed round, a live lava river far down the right.',
        structure: 'scalloped: the forest and the fresh flow bite in from either side in turn',
        form: 'scalloped',
        type: 'original: a three-shot hole whose line weaves',
        feature: 'The kipuka\'s forest: a frame down the left and the corner, and an obstacle that knocks a hook down. The flow\'s tongues set the lie on the right (fresh black lava).',
        decision: 'none: one clear line, three shots down the middle',
        plays: 'The opener runs along a kipuka: an island of old ground and forest that fresh lava flowed round and left standing. The fairway lies on the kipuka, wide, its edge scalloped where the forest juts in from the left and tongues of fresh black lava nose in from the right, so the line weaves a little from shot to shot. Beyond the trees on the left, the front of the fresh flow stands as a ragged wall of black lava. Far down the right, beyond the flow, a live lava river 22 m wide runs in a channel between its own banks, from a spatter vent right of the green down toward the sea: 40–120 m off the line, nearest at the bend. The cone fills the sky ahead-left; the sea lies far below on the right. Three shots: a drive past the first tongue, a second to the bend, a short iron round the forest to a kidney green.',
        safe: 'Drive at the middle (240 m), lay up at the bend (352 m), and play a short iron in.',
        bold: 'There is no bold line: a long second can reach the corner\'s trees, so lay up.',
        miss: 'Small miss: the first cut, or a scallop\'s rough. Medium: left, the forest (knocks a ball down); right, a tongue of fresh flow (a bad lie). Big: right, past the flow, the river (a stroke and a drop); left, the flow front behind the trees. A red-cinder bunker on the right of the lay-up catches a push before the flow. Safe miss at the green: right.',
        teeView: 'Near: the flow\'s black crust either side of the tee. Middle: the fairway on the kipuka, the forest\'s lobes left, the first tongue right. Beyond: the cone ahead-left, the plume over it, the river\'s glow and the sea right. The landing area is in view.',
        ground: 'Down 10 m over 480 m. The drive\'s landing falls 2.5% right (toward the flow, on the easy hole); the lay-up 3% left, toward the forest. The one contour: the kipuka\'s 3 m rise under the left half. The green: a bowl in its back lobe.',
      },
    }),
  }),

  // 2. THE BARRANCO: straight across a deep gully carved down the flank, down 15 m to the drive and up 20 to the
  // green. Round 6: the back tee 14 m forward (405 yd), and the fairway a funnel, wide where it drops into the
  // gully and closing all the way up the climb
  hole({ n: 2, name: 'The Barranco', par: 4, legs: [[384, 0]], place: { at: [-142, 478], heading: 92 }, tips: [-14, 11],
    build: (P) => ({
      tees: { obsidian: 14, basalt: 34, pumice: [80, 42], ash: [118, 62] },
      ramps: [[108, 202], [226, 330]],
      // valley carry (12 November 2026, Rhys's pick): the gully deepened and pulled back to 150-215 m, the landing area beyond
      // it lifted level with the tee, so a drive carries the barranco or runs back to its floor
      prof: [[119, null], [128, 3.4], [150, -3.5], [174, -14], [192, -14], [214, -5], [232, 2.6], [254, 3.0], [309, 3.6], [332, null]],
      // form: funnel. Generous off the near wall, narrowing across the floor and all the way up the climb
      fw: [{ e: [[62, 13, 15], [96, 33, 31], [140, 47, 45], [190, 43, 41], [228, 36, 32], [258, 29, 27], [288, 22, 21], [318, 18, 16], [350, 14, 13], [364, 12, 11]], wob: 5.5 }],
      corridor: 18,
      cant: [[160, 280, 3]],   // the gully floor runs down-valley to the right
      bunkers: [{ strip: [[172, 62, -42], [196, 64, -40], [222, 58, -34], [250, 50, -28]], wob: 3, kind: 'cinder', job: 'catch' },
        { at: P(352, -17), rx: 8, rz: 5 }, { at: P(384, 15), rx: 7, rz: 5 },
        // a field of small ash pots across the climb in place of the one cross bunker (12 November 2026, Rhys's pick)
        ...[[290, -24], [294, 3], [297, 17], [303, -12], [307, 12], [312, -17], [315, -1], [320, 14], [324, -16], [328, 8], [332, -4]].map(([a, o], i) => ({ at: P(a, o), rx: 3.2 + (i % 3) * 0.4, rz: 2.7 + (i % 2) * 0.5, pot: true, job: 'cross' }))],
      green: { lobes: [[0, 0, 8, 17, 28], [6, 12, 6, 6, 0]], contour: [{ fall: 0, pct: 1.2 }, { tier: [3.5, 8], up: 152, h: 0.5, w: 4 }], style: 'Long and thin, set from front left to back right with a knob at the back, falling 1.8% toward the front, two tiers (the upper at the back, 0.5 m up): open from the left, where the strip bunker runs' },
      boulders: [...blocks(P(205, 74), 18, 7, 21), ...blocks(P(215, -84), 16, 6, 22)],
      targets: [{ name: 'The shelf', at: P(250, 0) }, { name: 'The gully floor', at: P(183, 0) }],
      words: {
        story: 'Down into a flood gully and up the far side, a band of black sand across the climb where the floods run.',
        structure: 'a funnel, broken near the green by a cross bunker on the climb',
        form: 'funnel',
        type: 'original: down and up across a gully',
        feature: 'The barranco: a lie-setter (the drive stops on its floor, the second is uphill) and a frame (its rock walls up and down the gully). The cross bunker is the hazard; the climb throws a weak approach back (it sets the lie).',
        decision: 'none: one clear line, to the gully floor',
        plays: 'Straight, and the interest is all in the vertical. A barranco, a deep gully that water and old floods carved down the flank, cuts across the hole: the drive drops 15 m into it, and the green sits up on the far side, 20 m above the gully floor. The fairway is a funnel: generous where it eases down the near wall, narrowing across the dry floor and all the way up the far side, so the longer the drive, the tighter the landing. A band of black ash sand runs right across the climb 75–90 m short of the green: the floods\' channel. Up the gully and down it, the walls stand steep and rocky. Down the gully on the right, 115 m off the line, a small geyser field steams on a white sinter terrace; the biggest one erupts every few minutes. The gully floor runs down-valley to the right, so the landing area leans 3% that way. The approach plays about a club longer uphill.',
        safe: 'Drive down onto the gully floor (226 m), where it is still wide, and play a club more up the hill.',
        bold: 'There is no bold line: a long drive only finds the narrow part of the funnel, on the climb.',
        miss: 'Small miss: the low side of the lean (right), or the first cut. Medium: left, a long red-cinder bunker along the fairway; right, the gully floor\'s water-worn boulders. Big: the gully\'s rock walls up and down the barranco. On the climb, the cross bunker takes the fairway from edge to edge 75–90 m short of the green. Safe miss at the green: left, along the strip.',
        teeView: 'Near: the near wall\'s lip and the rough down it. Middle: the gully floor and the fairway climbing the far side, the cross bunker a black band across it. Beyond: the green on the far rim, the geysers\' steam down the gully to the right, the cone up to the left.',
        ground: 'Down 15 m into the gully and up 20 to the green. The floor leans 3% to the right (down-valley); the climb is the one contour. The green: a back tier 0.5 m up.',
      },
    }),
  }),

  // 3. THE LAVA TUBE: a long par 4 (round 6, was the par 5 4th) up the shoulder to the foot of the rampart, over a
  // collapsed lava tube. The tube comes down from under the rampart, crosses the line under the one stretch of roof
  // that never fell (a natural bridge), then runs on down the shoulder toward the tee, its trench splitting two
  // fairways: the main one on the right for the back tees, a lane on the left (the channel) for the forward tees.
  // Rhys, round 6: not a decision ("it's not going to get you there in less shots"), but keep the two fairways
  hole({ n: 3, name: 'The Lava Tube', seedN: 4, par: 4, split: true, laneReach: 110, legs: [[285, 0], [132, -14]], place: { at: [290, 400], heading: 306 }, tips: [-50, 0],
    build: (P) => ({
      // the forward tees sit left of the trench's lower mouth and play down the channel; the back tees down the main
      // the back tee 21 m back (12 November 2026, Rhys's pick): 455 -> 480 yd
      tees: { obsidian: -21, basalt: 20, pumice: [84, -64], ash: [126, -70] },
      // table top (12 November 2026, Rhys's pick): the channel lifted onto a flow front, a 6 m face at its near end, its top
      // running back down into the approach toward the green
      forms: [{ kind: 'table', at: P(256, -74), rx: 30, rz: 78, rot: 0, p: 2.6, h: 6, face: 8, tail: 0.42, label: 'the flow front' }],
      // form: double. The main fairway right of the trench, over the bridge to the approach; the channel left of it,
      // joining the approach short of the green
      fw: [{ e: [[100, 12, 15], [146, 21, 29], [194, 24, 35], [236, 24, 40], [262, 18, 42], [282, 6, 36], [292, 13, 15], [305, 17, 13], [332, 24, 9], [362, 25, 12], [392, 19, 14], [404, 14, 12]], wob: 4.5 },
        { lobes: [[196, -80, 34, 21, -4], [246, -77, 36, 24, 2], [290, -63, 30, 22, 12], [322, -40, 24, 18, 28]], join: 16, wob: 4, seed: 61 }],
      corridor: 18,
      cant: [[196, 280, 2.5]],   // the main landing falls right, away from the trench; the channel with it, away from its left rough
      // the tube's trench: the lower piece runs up the left of the main fairway to the bridge, the upper piece goes on
      // up toward the rampart; square-ended where the roof still stands (the bridge, and the mouths), and a skylight
      // at each end where the roof has holes in it
      cracks: [cv(P, [[128, -40], [172, -40], [212, -38], [246, -32], [268, -20], [280, -9]], 17, null, { ends: 'square', depth: 14, jag: 1.6, tube: true }),
        cv(P, [[306, 11], [318, 30], [332, 54], [346, 76]], 15, null, { ends: 'square', depth: 14, jag: 1.6, tube: true })],
      skylights: [{ at: P(104, -36), r: 5 }, { at: P(362, 104), r: 4 }],
      voidLabels: [[[196, -46], 'the tube (roof fallen in)'], [[326, 44], 'the tube']],
      bridge: { s: 292, w: 28, label: 'the bridge' },
      bunkers: [{ at: P(274, 50), rx: 13, rz: 10, rot: -0.3, kind: 'cinder', job: 'target' },   // past the main landing, right: long hitters play up to it
        { at: P(398, 15), rx: 8, rz: 5 }, { at: P(430, -12), rx: 6, rz: 4.5, pot: true }],
      // the green: a long peanut set from front left to back right, along the channel's approach; from the main
      // fairway you come in across its narrow side, over the bridge and the front-right bunker
      green: { lobes: [[-4, -8, 8, 11, 32], [4, 7, 7, 10, 32]], join: 5, raise: 1.2, falseFront: true, contour: [{ fall: 10, pct: 2 }], style: 'A peanut set from front left to back right (along the channel\'s approach), pinched in the middle, raised 1.2 m with a false front, falling 2% toward the front (the false front is the feature): open from the left, the channel side; from the right you come across it, over the bunker' },
      lavaTrees: [...lavaTrees(P(170, 62), 20, 12, 41), ...lavaTrees(P(230, 72), 16, 8, 42)],
      boulders: [...blocks(P(120, 60), 16, 5, 43)],
      targets: [{ name: 'The main fairway', at: P(232, 8) }, { name: 'The channel', at: P(250, -76) }],
      words: {
        story: 'Up the shoulder over a collapsed lava tube, its trench between two fairways, to a green at the rampart\'s foot across the one stretch of roof that never fell.',
        structure: 'a double fairway either side of the trench, joined at the bridge',
        form: 'double',
        type: 'original: a double fairway (the back tees play the main one, the forward tees the channel)',
        feature: 'The tube\'s trench: the hazard (a stroke and a drop) between the two fairways, and an obstacle for the main fairway\'s second. The bridge: a helper (a topped second runs across it instead of into the trench).',
        decision: 'none: one clear line from each tee set. The back tees play the main fairway and come over the bridge; the forward tees play down the channel, with no trench to cross. (Rhys, round 6: a second fairway that gains nothing is not a choice.)',
        plays: 'A lava tube is a cave left where a flow\'s crust hardened and the lava drained away; where the roof falls in, it leaves a trench. One comes down from under the rampart and runs the length of this hole: 15 m deep, sheer-sided, dark mouths where the roof still stands. It crosses the line under the one stretch of roof that never fell, a natural bridge 28 m wide, then runs on down the shoulder toward the tee, with a fairway either side of it. The main fairway on the right is wide and leans away from the trench; the channel on the left is the forward tees\' lane. The green sits at the foot of the spatter rampart, long and angled along the channel\'s approach, raised with a false front. From the main fairway the second comes over the bridge and across the green\'s narrow side, over a bunker. The rampart\'s black wall closes the view ahead; the Notch is out of sight above it.',
        safe: 'From the back tees, drive at the main fairway (232 m), right of the trench, and play over the bridge to the middle of the green. From the forward tees, drive down the channel and play up the left.',
        bold: 'There is no bold line: the channel gains a back-tee player nothing for the carry over the trench.',
        miss: 'Small miss: the first cut, or the low side of the lean (right). Medium: right, the lava trees (stone shells of an old forest) and a red-cinder bunker past the landing. Big: left, the trench (a stroke and a drop). From the channel, a push finds the trench; its left is shoulder rough. Safe miss at the green: left and short, on the channel side.',
        teeView: 'Near: the lava trees right, the trench\'s lower mouth left. Middle: the main fairway, the trench\'s lip running up its left, the channel beyond it. Beyond: the rampart\'s wall, the cone rising right, the plume above.',
        ground: 'Up 15 m over 420 m, the shoulder rising to the rampart. The main landing leans 2.5% right, away from the trench. The one contour: the bridge\'s crown. The green: raised 1.2 m with a false front.',
      },
    }),
  }),

  // 4. THE CROWN (was the 5th): off the rim at the Notch, 59 m down to the first terrace inside the caldera
  hole({ n: 4, name: 'The Crown', seedN: 5, par: 3, legs: [[219, 0]], place: { at: [0, 0], heading: 332 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: [8, 22], pumice: [44, -20], ash: [94, -30] },
      corridor: 14,
      extraFw: [{ at: P(176, 26), rx: 18, rz: 26, rot: 0.2 }, { at: P(233, -24), rx: 14, rz: 12 }],
      bunkers: [],   // none (12 November 2026, Rhys's pick): the drop and the crescent do the work
      green: { lobes: [[-13, -1, 9, 8, -28], [13, -1, 9, 8, 28], [0, 3, 12, 9, 0]], apron: 9, contour: [{ fall: 0, pct: 1.8 }, { ridge: [[0, -8], [0, 12]], h: -0.25, w: 7 }], style: 'A wide crescent across the line, its horns reaching back toward the tee, falling 1.8% toward the front, with a swale down the middle that gathers from both horns; short grass all round' },
      boulders: [...blocks(P(140, -48), 18, 6, 51), ...blocks(P(130, 46), 16, 5, 52)],
      targets: [],
      sketch: { tee: { fov: 72, up: 30 } },
      words: {
        story: 'The reveal: off the rim at the Notch, 59 m down to the first terrace, the caldera opening beneath you.',
        structure: 'par 3: all carry, off the rim',
        form: 'par 3',
        type: 'original: the drop off the rim (an Eden is proposed for its green, see the routing questions)',
        feature: 'The drop and the reveal: a frame (the caldera opens beneath you) and the hazard (the wall\'s talus short). The short grass round the green and the pod short right are helpers: they hold a near miss at green level.',
        decision: 'none: one clear line, the drop',
        teeView: 'Near: the Notch\'s rock walls either side. Middle: the green 59 m below on the first terrace. Beyond: the whole caldera, the lake, the floor\'s rivers and crust, the cone on the floor far ahead, the far walls and the plume. The planned reveal.',
        ground: 'Down 59 m from the rim to the terrace. The green: a swale down its middle gathering from both horns.',
        plays: 'The reveal. You climb round the spatter rampart to the rim and the caldera opens beneath you: the lava lake glowing at its heart, rivers of lava and fields of glowing crust across the floor, the walls rising hundreds of metres all round, the plume and its lightning above. The tee stands on the lip of the Notch, the one low saddle in the rim, and the green is 60 m below and 240 yd away on the first terrace inside, at the foot of the wall. A long hang time; the 240 yd plays about 190. Short grass all round the green and a pod of it short and right give a safe place to miss.',
        safe: 'Club for about 190, at the middle of the green; short right is short grass.',
        bold: 'There is no bold line, only the drop.',
        miss: 'Short, the ball hits the wall\'s talus of fallen rock and stays there. Long is rough on the terrace, and past it the terrace\'s edge.',
      },
    }),
  }),

  // 5. THE TERRACES (was the 6th): a drivable par 4 along the first terrace, then down its edge to the second
  hole({ n: 5, name: 'The Terraces', seedN: 6, par: 4, legs: [[110, 0], [164, 66]], place: { at: [-160, -160], heading: 262 }, tips: [-64, -30],
    build: (P) => ({
      // round 7 (Rhys: "too short, shouldn't be able to reach the green on a par 4 with a hybrid"): the tees go back
      // and left along the floor, so the bold line over the corner is about 305 yd from the back tee (253 before): a
      // tour driver reaches the green, a 3 wood and a hybrid don't
      tees: { obsidian: [-36, -28], basalt: [-22, -15], pumice: [20, -36], ash: [92, -34] },
      ramps: [[164, 226]],
      // round 7: wider all through (the tees went back, so the forward sets' drives land on the neck at the crag)
      fw: [{ e: [[40, 13, 13], [88, 22, 24], [125, 30, 30], [160, 28, 25], [186, 20, 20], [208, 20, 21], [230, 32, 27], [252, 22, 22]], wob: 5 }],
      corridor: 16,
      cant: [[115, 200, 3]],   // the upper terrace leans toward its edge and the lower terrace
      columns: { from: [150, 40], to: [230, 120], label: 'basalt columns' },
      bunkers: [{ at: P(150, 30), rx: 15, rz: 10, rot: 0.4, kind: 'cinder', job: 'carry' }, { at: P(258, -17), rx: 8, rz: 5 }, { at: P(286, 12), rx: 7, rz: 5 }],
      green: { lobes: [[-6, 6, 7, 15, -45], [5, -3, 10, 6, -45]], apron: 5, contour: [{ fall: 45, pct: 1.8 }, { tier: [-6.4, 6.4], up: -135, h: 0.6, w: 6 }], style: 'A T turned 45°: its long bar runs from front right to back left, its stem to the front left, on the lower terrace, falling 1.8% toward the front right, the back-left end of the bar on a tier 0.6 m up (the bold green of the nine): open from the right, the bold side' },
      boulders: [...blocks(P(100, -50), 14, 5, 61)],
      targets: [{ name: 'The upper terrace', at: P(150, -4) }, { name: 'Down on the lower terrace', at: P(236, 0), bold: true }],
      boldLine: [[0, 0], [0, 0]],
      words: {
        story: 'Drive the green down a crag of basalt columns, or lay up on the terrace above it.',
        structure: 'stepping down a crag from terrace to terrace',
        form: 'hourglass',
        type: 'Leven: a short par 4 whose hazard (the lava pool) sits on the side that opens the green; from the safe terrace the green is below the crag',
        feature: 'The crag of basalt columns: an obstacle to carry on the bold line and a frame for the green below it. The lava pool at its foot: the hazard. The upper terrace\'s lean: a lie-setter.',
        decision: 'Drivable par 4: carry the columns and finish by the green (about 275 m, a driver from the back tees), or lay up on the upper terrace (150 m) and play a short iron down.',
        teeView: 'Near: the wall rising on the left. Middle: the upper terrace and its lip at the corner, the columns\' crag. Beyond: the green on the lower terrace, the pool\'s glow right of it, the lake and the floor beyond.',
        ground: 'Down 11 m, stepping off the crag. The upper terrace leans 2.4% right toward its edge. The green: a back-left tier 0.6 m up.',
        plays: 'When the caldera collapsed, its walls slumped in rings of terraces. This drivable par 4 runs along the first one, the wall rising 170 m on the left, then bends right and steps down its edge, a 12 m crag of basalt columns, to the second terrace and the green. A pool of lava lies at the foot of the crag and runs on toward the green in a long tongue, just right of the straight line to it: a drive at the green that leaks right, or comes up short on the right, finds it. The fairway eases down a gully in the edge. Where the drive stops sets the lie: the upper terrace leans 2–3% toward its edge, so a drive there kicks right toward the corner; on the way down, a downslope.',
        safe: 'Lay up on the upper terrace (150 m) with an iron and play a short iron down to the green.',
        bold: 'Drive straight at the green over the corner: carry the columns and it can finish on the lower terrace by the green.',
        miss: 'A drive that comes up short of the bold carry hits the columns and drops to their foot in broken rock. A push on the bold line finds the lava pool, which runs from the columns\' foot to within 45 m of the green (a stroke and a drop). Left is the wall\'s talus. A red-cinder bunker sits on the lip at the corner.',
      },
    }),
  }),

  // 6. THE LAVAFALL (was the 7th): a par 5 along the second terrace's ledge, past a lavafall, then down into a bay in the wall
  hole({ n: 6, name: 'The Lavafall', seedN: 7, par: 5, legs: [[262, 0], [204, -35]], place: { at: [-345, -300], heading: 282 }, tips: [-112, 0],
    build: (P) => ({
      // the long par 5 (12 November 2026, Rhys's pick): the back tee 82 m back, 510 -> 600 yd
      tees: { obsidian: -82, basalt: 22, pumice: [70, 40], ash: [110, 40] },
      ramps: [[196, 292]],
      cant: [[150, 290, -6.5]],
      // form: broken. The ledge's fairway stops at the rill; the bay's begins beyond it, wider, toward the fall
      fw: [{ e: [[60, 12, 13], [108, 21, 23], [158, 29, 27], [204, 33, 30], [238, 31, 28], [264, 26, 25], [290, 22, 21], [314, 20, 18]], wob: 5.5 },
        { e: [[356, 24, 21], [384, 33, 30], [414, 27, 24], [440, 17, 15], [452, 13, 12]], wob: 5, seed: 31 }],
      corridor: 18,
      bunkers: [{ at: P(452, -17), rx: 8, rz: 5 }, { at: P(484, 13), rx: 7, rz: 5 }, { at: P(222, 36), rx: 14, rz: 10, kind: 'cinder', job: 'target' }],
      green: { lobes: [[1, -3, 8, 15, 40], [-7, 9, 8, 5, 0]], contour: [{ fall: 0, pct: 1.8 }, { ridge: [[-6, 7], [-8, 14]], h: 0.3, w: 2.5 }], style: 'An L: a long leg from front left to back right and a wing at the back left toward the fall, falling 1.8% toward the front, a low spine walling the wing off from the leg: open from the left, where the strip bunker runs' },
      boulders: [...blocks(P(320, 70), 20, 7, 71), ...blocks(P(150, -60), 14, 4, 72)],
      targets: [{ name: 'The ledge', at: P(218, -2) }, { name: 'Short of the rill', at: P(302, 0) }, { name: 'The bay', at: P(384, 0), bold: true }],
      words: {
        story: 'Toward a lavafall whose pool spills back down the bay and across the fairway: carry the rill with the second or lay up short.',
        structure: 'broken by a lava rill on the second shot',
        form: 'broken',
        type: 'Long: a three-shot hole with a cross hazard (the rill) where the second wants to finish',
        feature: 'The lavafall: the landmark and a frame (the green reads against it). The rill: the hazard that makes the second a choice. The bay\'s wall: a helper, it backstops a long second from going on into the rubble.',
        decision: 'Go or lay up: lay up short of the rill (302 m) and pitch on, or carry it into the bay (384 m) or at the green with the second.',
        teeView: 'Near: the second terrace\'s ledge. Middle: the fairway along the ledge, its edge dropping right. Beyond: the lavafall straight ahead down the wall, its steam, the bay.',
        ground: 'Down 20 m: along the ledge, then down its end into the bay. The ledge leans 6.5% left (the strong sidehill of the nine), away from its edge. The green: a spine walls off its back wing.',
        plays: 'Lava from a vent outside the rim spills over the wall at the back of a bay and pours 420 m down it in a glowing fall, steam rising where it meets a pool of lava at the foot; the pool spills over in a rill that runs back down the bay along the wall on the left and cuts across the fairway at the foot of the ledge. The hole runs along the ledge of the second terrace toward it, then bends left and drops 18 m down the ledge\'s end into the bay, onto the crater floor. The ledge is a slumped block of the wall that rotated as it slid, so it tilts back toward the wall: the landing area leans 6.5% to the left, away from the edge, and the second is played with the ball above your feet. The fall is the landmark from the tee, straight ahead.',
        safe: 'Drive along the ledge (218 m), lay up short of the overflow at the foot of the ledge (302 m), and pitch on with a short iron; or carry it into the bay (382 m).',
        bold: 'A long second from the ledge can reach the green, but it has to carry the overflow, which cuts across 330–350 m out on a diagonal, nearest on the right.',
        miss: 'The ledge leans left, so a drive on the left half runs on toward the wall\'s foot, into the rough. Right of the ledge is the terrace\'s edge, an 18 m drop to the floor: a ball that goes over it is down on the ash, a long way below. Left of the bay the overflow runs along the fairway at the foot of the wall, then cuts across it: a stroke and a drop.',
      },
    }),
  }),

  // 7. THE LAKE (was the 8th): a par 4 cape right round the west end of the lava lake, over a blind crest. Round 6:
  // the back tee 14 m forward (385 yd), and the fairway a fan, narrow up the crest and opening beyond it, away from
  // the lake; the cape's bite stays (Rhys), so 5, 6 and 7 are decisions in a row on purpose
  hole({ n: 7, name: 'The Lake', seedN: 8, par: 4, legs: [[230, 0], [136, 65]], place: { at: [-775, -320], heading: 345 }, tips: [-6, -6],
    build: (P) => ({
      tees: { obsidian: 14, basalt: 34, pumice: [84, -40], ash: [122, -40] },
      // form: fan. Narrow up the crest's face, opening beyond it to the left, away from the lake
      fw: [{ e: [[64, 9, 11], [104, 13, 14], [150, 18, 20], [200, 26, 24], [240, 34, 24], [272, 40, 22], [305, 40, 18], [335, 32, 14], [350, 20, 11]], wob: 5 }],
      corridor: 18,
      cant: [[170, 290, -2]],   // away from the lake
      forms: [{ at: P(200, 0), rx: 90, rz: 36, rot: 0, h: 8, label: 'the crest' }, { at: P(214, -40), rx: 6, rz: 7, rot: 0, h: 1.5, label: 'the hornito' }],
      zones: [{ blobs: [[108, -62, 14], [150, -76, 18], [170, -60, 12], [210, -70, 16], [250, -66, 14], [292, -58, 12]], surf: 'sulfur' }],
      fumaroles: [[110, -60], [150, -78], [168, -60], [210, -70], [250, -66], [292, -56], [214, -40]],
      bunkers: [{ at: P(298, -40), rx: 17, rz: 11, rot: -0.4, kind: 'cinder', job: 'target' }, { at: P(346, -16), rx: 8, rz: 5 }, { at: P(378, 8), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 9, 18, -30], [-6, 12, 8, 7, 0]], contour: [{ fall: -30, pct: 2 }, { bowl: [-6, 12], r: 10, h: 0.3 }], style: 'Long and thin, set from front right to back left, a knob at the back, falling 2% toward the front left (nothing tips toward the lake) with a bowl in the knob that gathers to a back pin: open from the right, the lake side' },
      boulders: [...blocks(P(120, 50), 14, 4, 81), ...blocks(P(214, -40), 5, 7, 82)],
      targets: [{ name: 'Over the crest', at: P(252, -10) }, { name: 'Over the lake\'s corner', at: P(292, 8), bold: true }],
      words: {
        story: 'A cape round the lava lake over a blind crest, a hornito steaming on its left shoulder to aim by.',
        structure: 'a fan, cape right: narrow up the crest, opening beyond it away from the lake',
        form: 'fan',
        type: 'Cape: the lake\'s west end on a diagonal inside the corner, the more you cut off the shorter the second',
        feature: 'The hornito: the aim point for the blind drive. The crest: a lie-setter (short of it, an upslope with the green hidden). The lake: the hazard. The crest\'s lean away from the lake is a helper.',
        decision: 'Bite off what you dare: cut the corner on the right, past the lake\'s west end, for a wedge in (about 75 m left; a push finds the lava), or drive just right of the hornito over the crest for a short iron (about 115 m). It makes 5, 6 and 7 three decisions in a row, which the rules avoid: Rhys kept the cape on purpose (round 6), and the three are of different kinds (a drive at the green, a second over the rill, a carry off the tee).',
        teeView: 'Near: the floor\'s ash. Middle: the crest, blind, with the hornito steaming on its left shoulder as the marker. Beyond: the lake\'s glow right, the island and the clubhouse beyond it, the cone straight ahead on the floor.',
        ground: 'Up 8 m to the crest, down its far side to the shore. The landing leans 2% left, away from the lake. The green: a bowl in its back knob.',
        plays: 'A cape round the west end of the lava lake. The drive climbs 8 m to a crest, a blind one from the tee, and runs down its far side to where the hole bends right along the shore; the lake lies on the right the whole way, glowing in its pit 12 m down. Fumaroles steam across sulfur-yellow ground on the left, and the crest leans that way, away from the lake. On the crest\'s left shoulder a hornito, a chimney of welded spatter, steams from its cleft: from the tee it is the marker to aim just right of. The green runs along the shore. Over the crest the fairway opens out to the left, away from the lake. Bite off as much of the lake as you dare: the further right you go, the shorter the second, and the narrower the fairway.',
        safe: 'Drive just right of the hornito, over the crest (246 m), and play a short iron in.',
        bold: 'Aim right of the corner, over the rubble at the lake\'s west end: a wedge in, but anything pushed finds the lava.',
        miss: 'Right is the lake: a stroke and a drop beside where it went in. Left is the sulfur ground round the fumaroles (a bad lie) and a red-cinder bunker at the corner. A hooked drive finds the hornito\'s rock and drops among its boulders. A drive that comes up short sits on the crest\'s upslope with the green out of sight.',
      },
    }),
  }),

  // 8. THE CINDER CONE (was the 3rd, outside the rim): a par 3 up the flank of a small breached cinder cone on the
  // caldera floor (cones form inside calderas: Wizard Island in Crater Lake), the green in its crater. Round 6: it
  // stands behind the Heart's tee, between the Lake's green and the Heart, and plays north-east toward the plume.
  // Its green is exactly as designed: the breach facing the tee, the level crater floor, the true punchbowl, the ring
  hole({ n: 8, name: 'The Cinder Cone', seedN: 3, par: 3, legs: [[136, 0]], place: { at: [-894, -728], heading: 50 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 12, pumice: 28, ash: [56, -30] },
      // the cone: rim 16 m up, a breach in its front wall facing the tee, a level crater floor 8 m up and the
      // green dipping 2.5 m into it (a true punchbowl)
      cone: { at: P(136, 2), base: 80, rim: 37, rimH: 16, floor: 8, floorR: 23, breach: { toward: P(0), w: 44, lip: 8 }, label: 'the cinder cone' },
      corridor: 10,
      bunkers: [{ wrap: { from: -148, to: 148, d: 2.5, w: 6 }, job: 'ring' }],   // a ring of ash sand round the green, open only toward the breach
      green: { lobes: [[0, -6, 9, 9, 0], [-1, 7, 8, 9, 0]], join: 6, apron: 4, punch: { depth: 2.5, floor: 2.5, bank: 7 }, contour: [{ fall: 0, pct: 1.5 }], style: 'A bean straight up the line, pinched at the waist, on the crater floor and dipped 2.5 m into it: a true punchbowl, falling a gentle 1.5% toward the front (the bowl is the feature)' },
      boulders: [...blocks(P(60, 46), 16, 4, 31), ...blocks(P(40, -50), 14, 4, 32)],
      targets: [],
      words: {
        story: 'In through the breach of an old cinder cone to a green in its crater, ringed with ash sand.',
        structure: 'par 3: a green in a ring of sand',
        form: 'par 3',
        type: 'Punchbowl: a green sunk into the level crater floor whose banks feed a near miss in',
        feature: 'The cone: an obstacle (you play in through its breach) and a helper (its crater walls feed a near miss down to the green). The ring of ash sand: the hazard. A landmark from the Crown\'s tee, the Lake\'s tee and the Heart\'s.',
        decision: 'none: one clear line, up the middle of the breach',
        teeView: 'Near: the floor\'s grey ash. Middle: the cone\'s cinder flank and the breach. Beyond: the crater\'s back wall with the flag in front of it, and the plume rising behind the cone.',
        ground: 'Up 8 m to the crater floor; the green dips 2.5 m into it.',
        plays: 'Cinder cones stand all over a volcano: heaps of red and black cinder thrown up round a vent, and they rise inside calderas too, on the floor after the collapse. This one stands alone on the ash behind the Heart\'s tee; it is small and old, and its front wall broke away long ago, so it opens toward you. You hit up its cinder flank and in through the breach; inside, the crater floor runs level, then the green dips into a hollow in the middle of it, a true punchbowl. The crater\'s walls rise 8 m more behind and round it, and feed a near miss in. From the tee you see the walls and the flag, not the putting surface.',
        safe: 'Aim at the middle of the breach and take enough club to carry the lip: anything on the crater floor feeds down.',
        bold: 'There is no bold line: the crater is the target, and the only way onto the green that misses the sand is up the middle through the breach.',
        miss: 'Short, the ball lands on the cone\'s outer flank of loose cinder and runs back down it. Wide of the breach it hits the crater\'s outer wall. A ring of ash sand wraps the green 2–3 m off its edge on every side but the front. Long, it climbs the back wall and usually comes back, often into the sand.',
      },
    }),
  }),

  // 9. THE HEART: along the lake's north shore, then out across a natural rock bridge to an island in the lava
  hole({ n: 9, name: 'The Heart', par: 4, split: true, legs: [[245, 0], [146, 58]], place: { at: [-735, -718], heading: 92 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 20, pumice: [56, -38], ash: [100, -38] },
      ramps: [[262, 375]],
      // split round a tumulus (a blister of old lava) on the shore: the left lane wide and safe but longer, with the
      // bridge out of line; the beach lane along the lava shorter, straight onto the bridge
      fw: [{ e: [[60, 14, 14], [100, 22, 23], [150, 28, 29], [186, 30, 28], [200, 30, 27]], wob: 4.5 },
        { e: [[180, 34, -13], [215, 46, -13], [245, 44, -13], [268, 30, -6]], wob: 3, seed: 51 },
        { e: [[184, 0, 28], [215, 0, 31], [245, 0, 30], [268, -2, 24]], wob: 3, seed: 53 },
        { e: [[252, 23, 21], [256, 23, 21], [272, 15, 15], [295, 12, 12], [325, 12, 12], [352, 13, 13], [370, 11, 11]], wob: 4.5, seed: 57 }],
      corridor: 16,
      cant: [[140, 250, -3.5]],
      bunkers: [{ strip: [[112, -24, 35], [150, -28, 41], [200, -29, 42], [240, -29, 42], [272, -17, 30]], wob: 3, job: 'catch' }],   // the black-sand beach along the shore, 160 m between the fairway and the lava; no sand by the green (12 November 2026, Rhys's pick: the lava is enough)
      green: { lobes: [[-6, 7, 7, 9, 18], [6, 7, 7, 9, -18], [0, -6, 6, 10, 0]], join: 4, raise: 1.4, falseFront: true, contour: [{ fall: 0, pct: 1.5 }, { tier: [0, 3.25], up: 180, h: 0.4, w: 3.5 }], style: 'Two lobes across the back and a point at the front (a heart, for the Heart); raised 1.4 m with a false front; the two back lobes sit on a tier 0.4 m above the point, and the whole falls 1.5% toward the front' },
      hall: { at: [0, 0], w: 32, d: 14, h: 6, roof: 2.5, label: 'the clubhouse' },
      forms: [{ at: P(228, -7), rx: 7, rz: 11, rot: 0, h: 2.5, label: 'the tumulus' }],
      boulders: [...blocks(P(120, -54), 14, 5, 91), ...blocks(P(228, -7), 6, 8, 92)],
      targets: [{ name: 'The left lane', at: P(232, -30) }, { name: 'The beach lane', at: P(232, 15), bold: true }, { name: 'On the bridge', at: P(310, 0) }],
      boldLine: [[0, 0], [0, 0]],
      words: {
        story: 'A tumulus splits the shore fairway: the beach lane by the lava, or the long way left; then over a rock bridge to the island green.',
        structure: 'split round a tumulus, then a bridge to an island',
        form: 'split',
        type: 'original: a split fairway along the shore, then an island green',
        feature: 'The tumulus: the obstacle that splits the fairway. The black-sand beach: a helper (it catches a push before the lava). The bridge: the route to the island (its false front sets the lie). The island green: lava all round on purpose (it breaks the penalty-on-one-side rule for the finish: the bridge, the beach and the short grass short of the green are the way to play it safe).',
        decision: 'Split fairway: the beach lane (shorter, straight onto the bridge, lava 15 m right) or the left lane (wider, away from the lava, the bridge out of line).',
        teeView: 'Near: the floor\'s ash and the cone\'s flank behind. Middle: the shore fairway, the tumulus and the beach. Beyond: the island, the clubhouse on it, the lake glowing, the walls all round.',
        ground: 'Up 17 m in all: along the shore, then up the bridge to the island. The landing leans 3.5% left, away from the lava. The green: raised 1.4 m with a false front, its back lobes on a tier.',
        plays: 'The finish. The fairway runs along the north shore of the lava lake, the lake on the right, leaning 2–3% to the left, away from the lava, with a black-sand beach between it and the lava; where drives land a tumulus, a blister of old lava, splits it into a beach lane and a wider lane on the left. Then it turns right onto a natural rock bridge: a span of old lava 28 m wide with the lake flowing under it, out to an island in the middle of the lake. The bridge climbs onto the island and the green sits raised on its top, 17 m above the shore, with lava glowing on every side and the walls towering all round. Behind the green, on the island\'s high point, stands the clubhouse, built of black basalt.',
        safe: 'Take the left lane (232 m), wide and away from the lava, play onto the bridge (310 m), and pitch up to the green.',
        bold: 'Take the beach lane right of the tumulus, by the lava: from there the bridge is straight ahead, or fly the lava at the green, about 150 m, all carry.',
        miss: 'Right of the shore and either side of the bridge is the lake: a stroke and a drop. The black-sand beach catches a push before the lake. A drive at the tumulus drops among its boulders. Short of the green, the false front sends the ball back down the bridge.',
      },
    }),
  }),
];

// finishing touches that need the built line: the bold lines, and the clubhouse behind the 9th green
{
  const at_ = (h, s, o = 0) => at(h.line, s, o);
  const H = name => HOLES.find(h => h.name === name);
  H('The Terraces').boldLine = [H('The Terraces').teePts.obsidian, H('The Terraces').pin];
  H('The Lavafall').boldLine = [at_(H('The Lavafall'), 218), H('The Lavafall').pin];
  H('The Lake').boldLine = [[0, 0], H('The Lake').targets[1].at];
  H('The Heart').boldLine = [at_(H('The Heart'), 236), H('The Heart').pin];
  // the clubhouse on the island's south-east side, its long side facing the green
  const h9 = H('The Heart'), a = h9.place.heading * Math.PI / 180, dX = -346 - h9.place.at[0], dZ = -580 - h9.place.at[1];
  h9.hall.at = [dX * Math.cos(a) + dZ * Math.sin(a), -(dX * Math.sin(a) - dZ * Math.cos(a))];
}
