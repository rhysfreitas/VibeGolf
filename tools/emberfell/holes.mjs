// Emberfell, plan book round 1: nine holes on a volcano at dusk. Four play round the outside of the cone on a
// broad shoulder below the rim (a kipuka of old forest with a live lava river beside it, a barranco, a cinder
// cone, a collapsed lava tube), the 5th drops 62 m off the rim at the Notch into the caldera, and four play
// inside it, down two slumped terraces, past a lavafall, round the lava lake and out to an island in it.
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
};
export const BACK = 'obsidian', FRONT = 'ash';

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
  // the spot for a future tips tee (a fifth set at tour length): behind the back tee, 30-50 yd on the par 4s
  // and 5s, less on the par 3s; [s, off] with s < 0. Plan only until the tee set exists
  const tp = def.tips || h.tips || (def.par === 3 ? [-14, 0] : [-36, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  return { ...def, ...h };
}
// an open crack (the tube's collapsed trench, a skylight) or a scarp (a flow front, open: false), along [s, off]
// points, w wide; lip: { h, toward: [s, off], run, fall } raises one side. Built by shapes.mjs makeCrack.
let cvSeed = 1;
const cv = (P, pts, w, lip, more = {}) => ({ pts: pts.map(p => P(...p)), w, seed: cvSeed++, lip: lip && { ...lip, toward: P(...lip.toward) }, ...more });

export const HOLES = [
  // 1. KIPUKA: along an island of old forest left when fresh lava flowed round it, a live lava river down the right
  hole({ n: 1, name: 'Kipuka', par: 4, legs: [[225, 0], [132, -35]], place: { at: [-470, 610], heading: 75 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 20, pumice: [78, -38], ash: [118, -40] },
      fw: [{ e: [[60, 14, 14], [95, 22, 22], [150, 28, 27], [200, 32, 27], [240, 30, 25], [275, 22, 23], [305, 17, 18], [335, 13, 14]], wob: 6 }],
      corridor: 20,
      cant: [[150, 290, -3]],
      // the kipuka: old ground a little higher than the flows, with its forest down the left and in the corner
      forms: [{ at: P(205, -82), rx: 62, rz: 150, rot: -0.2, h: 3, label: 'the kipuka (old forest)' }],
      zones: [{ blobs: [[110, -62, 26], [160, -70, 36], [215, -72, 38], [262, -58, 30], [300, -50, 24], [335, -46, 18]], surf: 'forest' }],
      // where the forest stops, the edge of the fresh flow: a ragged front of black lava 3 m high
      cracks: [cv(P, [[80, -128], [150, -142], [220, -150], [290, -120], [350, -96], [410, -90]], 0, { h: 3.2, toward: [220, -220], run: 30, fall: 20, face: 2.5 }, { open: false, jag: 6, crag: true })],
      bunkers: [{ at: P(234, 38), rx: 18, rz: 11, rot: 0.15, kind: 'cinder', job: 'catch' },
        { at: P(342, 18), rx: 8, rz: 5 }, { at: P(372, -15), rx: 7, rz: 5 }],
      green: { lobes: [[-5, 8, 8, 12, -30], [3, -6, 8, 11, -30], [6, 3, 6, 7, 0]], contour: [{ fall: -40, pct: 1.8 }, { bowl: [-6, 10], r: 11, h: 0.3 }], style: 'A kidney set from front right to back left, curled round the forest, falling 1.8% toward the front left, with a shallow bowl in the back-left lobe that gathers to a back pin: open from the right, where the bunker guards the fairway' },
      trees: [...grove(P(150, -72), 32, 16, 11), ...grove(P(220, -78), 36, 18, 12), ...grove(P(290, -60), 22, 9, 13), ...grove(P(370, -52), 16, 6, 14)],
      boulders: [...blocks(P(170, 48), 14, 5, 15), ...blocks(P(300, 50), 12, 4, 16)],
      vent: { at: [-175, 540], label: 'spatter vent' },
      targets: [{ name: 'The bend', at: P(232, -2) }],
      words: {
        plays: 'The opener runs along a kipuka: an island of old ground and forest that fresh lava flowed round and left standing. The fairway lies on the kipuka, its forest down the left and in the corner, and beyond the trees the front of a fresh flow, a ragged wall of black lava. Down the right a live lava river, 22 m wide, runs in a channel between its own banks, from a spatter vent right of the green down toward the sea: 45–75 m off the line, closest at the bend. The cone fills the sky ahead-left; the sea lies far below on the right. The landing area leans 3% to the left, toward the forest, so the right half of the fairway, by the bunker, is the place to be. Gentle and wide: it shows what lava does to a ball before anything asks much of you.',
        safe: 'Drive at the bend (232 m), short of the forest in the corner, and play a short iron in.',
        bold: 'Cut the corner over the forest\'s edge: a wedge in, but the trees catch anything short.',
        miss: 'Right is fresh black lava (a bad lie) and past it the river: a stroke and a drop. A big red-cinder bunker sits on the right where drives land, to catch a push before it gets there. Left is the forest, which knocks a ball down.',
      },
    }),
  }),

  // 2. THE BARRANCO: straight across a deep gully carved down the flank, down 15 m to the drive and up 20 to the green
  hole({ n: 2, name: 'The Barranco', par: 4, legs: [[384, 0]], place: { at: [-142, 478], heading: 92 }, tips: [-34, 32],
    build: (P) => ({
      tees: { obsidian: 0, basalt: 20, pumice: [64, 40], ash: [102, 40] },
      ramps: [[108, 202], [226, 330]],
      fw: [{ e: [[62, 14, 14], [100, 22, 22], [150, 27, 28], [195, 30, 29], [230, 29, 29], [262, 24, 24], [292, 19, 19], [325, 19, 18], [358, 14, 13]], wob: 5.5 }],
      corridor: 18,
      cant: [[160, 280, 3]],   // the gully floor runs down-valley to the right
      bunkers: [{ strip: [[170, 44, -28], [192, 49, -30], [215, 51, -31], [240, 46, -28]], wob: 3, kind: 'cinder', job: 'catch' },
        { at: P(352, -17), rx: 8, rz: 5 }, { at: P(384, 15), rx: 7, rz: 5 }, { at: P(312, 22), rx: 9, rz: 6, kind: 'cinder', job: 'approach' }],
      green: { lobes: [[0, 0, 8, 17, 28], [6, 12, 6, 6, 0]], contour: [{ fall: 0, pct: 1.2 }, { tier: [3.5, 8], up: 152, h: 0.5, w: 4 }], style: 'Long and thin, set from front left to back right with a knob at the back, falling 1.8% toward the front, two tiers (the upper at the back, 0.5 m up): open from the left, where the strip bunker runs' },
      boulders: [...blocks(P(205, 70), 18, 7, 21), ...blocks(P(215, -80), 16, 6, 22)],
      targets: [{ name: 'The gully floor', at: P(212, 2) }],
      words: {
        plays: 'Straight, and the interest is all in the vertical. A barranco, a deep gully that water and old floods carved down the flank, cuts across the hole: the drive drops 15 m into it, and the green sits up on the far side, 20 m above the gully floor. The fairway eases down the near wall, runs across the dry floor and pinches as it climbs the far side. Up the gully and down it, the walls stand steep and rocky. Down the gully on the right, 115 m off the line, a small geyser field steams on a white sinter terrace; the biggest one erupts every few minutes. The gully floor runs down-valley to the right, so the landing area leans 3% that way. The approach plays about a club longer uphill.',
        safe: 'Drive down onto the gully floor (212 m) and play a club more up the hill.',
        bold: 'A long drive carries the floor and stops on the climb: a shorter second, but from a slope.',
        miss: 'Left on the gully floor a long red-cinder bunker runs along the fairway. Off the fairway the gully floor is water-worn boulders and its walls are rock. Short of the green the climb throws a weak approach back down.',
      },
    }),
  }),

  // 3. THE CINDER CONE: a par 3 up the flank of a small breached cinder cone, the green in its crater
  hole({ n: 3, name: 'The Cinder Cone', par: 3, legs: [[136, 0]], place: { at: [270, 512], heading: 20 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 12, pumice: 28, ash: [56, -30] },
      // the cone: rim 16 m up, a breach in its front wall facing the tee, a level crater floor 8 m up and the
      // green dipping 2.5 m into it (a true punchbowl)
      cone: { at: P(136, 2), base: 80, rim: 37, rimH: 16, floor: 8, floorR: 23, breach: { toward: P(0), w: 44, lip: 8 }, label: 'the cinder cone' },
      corridor: 10,
      bunkers: [{ at: P(116, -14), rx: 5, rz: 4, pot: true }, { at: P(152, 15), rx: 4.5, rz: 4, pot: true }],
      green: { lobes: [[0, -6, 9, 9, 0], [-1, 7, 8, 9, 0]], join: 6, apron: 4, punch: { depth: 2.5, floor: 2.5, bank: 7 }, contour: [{ fall: 0, pct: 1.5 }], style: 'A bean straight up the line, pinched at the waist, on the crater floor and dipped 2.5 m into it: a true punchbowl, falling a gentle 1.5% toward the front (the bowl is the feature)' },
      boulders: [...blocks(P(60, 46), 16, 4, 31), ...blocks(P(40, -50), 14, 4, 32)],
      targets: [],
      words: {
        plays: 'Cinder cones stand all over a volcano\'s flanks: heaps of red and black cinder thrown up round a vent. This one is small and old, and its front wall broke away long ago, so it opens toward you. You hit up its cinder flank and in through the breach; inside, the crater floor runs level, then the green dips into a hollow in the middle of it, a true punchbowl. The crater\'s walls rise 8 m more behind and round it, and feed a near miss in. From the tee you see the walls and the flag, not the putting surface.',
        safe: 'Aim at the middle of the breach and take enough club to carry the lip: anything on the crater floor feeds down.',
        bold: 'There is no bold line: the crater is the target.',
        miss: 'Short, the ball lands on the cone\'s outer flank of loose cinder and runs back down it. Wide of the breach it hits the crater\'s outer wall. Long, it climbs the back wall and usually comes back.',
      },
    }),
  }),

  // 4. THE LAVA TUBE: a par 5 S-bend over a collapsed lava tube, a natural bridge carrying the fairway across
  hole({ n: 4, name: 'The Lava Tube', par: 5, legs: [[200, 0], [160, -50], [134, 40]], place: { at: [403, 246], heading: 300 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 22, pumice: [70, 46], ash: [110, 46] },
      fw: [{ e: [[60, 14, 14], [100, 22, 24], [150, 26, 30], [195, 32, 32], [235, 30, 26], [275, 24, 22], [305, 17, 17], [322, 13, 13], [338, 13, 13], [352, 17, 17], [385, 24, 22], [420, 22, 22], [452, 16, 17], [478, 12, 12]], wob: 5 }],
      corridor: 20,
      cant: [[345, 430, -7]],   // the second landing: a sidehill off the cone's flank, falling left
      // a hog's back down the first leg: a spine that kicks a drive off the line away from it
      forms: [{ at: P(178, 0), rx: 17, rz: 60, rot: 0, h: 1.8, label: 'hog\'s back' }],
      // the tube's trench, square-ended where the roof still stands (the bridge between the two pieces, and the
      // tube mouths), and two skylights where the roof has holes in it further along
      cracks: [cv(P, [[333, 15], [329, 45], [334, 72], [331, 86]], 17, null, { ends: 'square', depth: 14, jag: 1.6, tube: true }),
        cv(P, [[331, -15], [334, -55], [330, -92], [333, -122]], 15, null, { ends: 'square', depth: 14, jag: 1.6, tube: true })],
      skylights: [{ at: P(332, 104), r: 5 }, { at: P(333, -150), r: 4 }],
      voidLabels: [[[331, 75], 'the tube (roof fallen in)'], [[332, -70], 'the tube']],
      bridge: { s: 330, w: 28, label: 'the bridge' },
      bunkers: [{ at: P(220, 38), rx: 17, rz: 12, rot: -0.3, kind: 'cinder', job: 'target' }, { at: P(386, -31), rx: 13, rz: 9, kind: 'cinder', job: 'approach' },
        { at: P(478, -19), rx: 8, rz: 5 }, { at: P(504, 13), rx: 7, rz: 5 }],
      green: { lobes: [[-2, -7, 9, 9, 0], [4, 8, 8, 9, 0]], join: 5, raise: 1.2, falseFront: true, contour: [{ fall: 10, pct: 2 }], style: 'A peanut set a little from front left to back right, pinched in the middle, raised 1.2 m with a false front, falling 2% toward the front (the false front is the feature): open from the left, where the lay-up bunker sits' },
      lavaTrees: [...lavaTrees(P(170, -58), 22, 14, 41), ...lavaTrees(P(250, -52), 16, 8, 42)],
      boulders: [...blocks(P(130, 60), 16, 5, 43)],
      targets: [{ name: 'The corner', at: P(215, -6) }, { name: 'Over the bridge', at: P(385, 2) }],
      boldLine: [[0, 0], [0, 0]],   // set below: from the corner straight to the green
      words: {
        plays: 'A lava tube is a cave left where a flow\'s crust hardened and the lava drained away; where the roof falls in, it leaves a trench. One runs down the shoulder right across this hole: 15 m deep, sheer-sided, with dark tube mouths at both ends where the roof still stands. One stretch of roof never fell, a natural bridge 28 m wide, and the fairway runs across it. The hole bends left round a stand of lava trees, crosses the bridge and bends right up the last slope below the Notch, climbing 13 m in all, with the spatter rampart that hides the Notch standing behind the green. The cone rises steeply on the right the whole way, and past the bridge the fairway runs along its flank: the lay-up area leans 7% to the left, the strongest side slope on the course, so the third is played with the ball above your feet.',
        safe: 'Drive to the corner (215 m), lay up across the bridge (385 m), and pitch up to the green.',
        bold: 'From a good drive, a fairway wood straight at the green, carrying the trench where it is open, about 245 m.',
        miss: 'Into the trench is a stroke and a drop back on the side it went in. Left of the first leg the lava trees, stone shells of an old forest, knock a ball about. A red-cinder bunker waits right of the corner and another left of the lay-up.',
      },
    }),
  }),

  // 5. THE CROWN: off the rim at the Notch, 62 m down to the first terrace inside the caldera
  hole({ n: 5, name: 'The Crown', par: 3, legs: [[219, 0]], place: { at: [0, 0], heading: 332 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: [8, 22], pumice: [44, -20], ash: [94, -30] },
      corridor: 14,
      extraFw: [{ at: P(176, 26), rx: 18, rz: 26, rot: 0.2 }, { at: P(233, -24), rx: 14, rz: 12 }],
      bunkers: [{ at: P(195, -20), rx: 8, rz: 5 }, { at: P(241, 10), rx: 9, rz: 5 }],
      green: { lobes: [[-13, -1, 9, 8, -28], [13, -1, 9, 8, 28], [0, 3, 12, 9, 0]], apron: 9, contour: [{ fall: 0, pct: 1.8 }, { ridge: [[0, -8], [0, 12]], h: -0.25, w: 7 }], style: 'A wide crescent across the line, its horns reaching back toward the tee, falling 1.8% toward the front, with a swale down the middle that gathers from both horns; short grass all round' },
      boulders: [...blocks(P(140, -48), 18, 6, 51), ...blocks(P(130, 46), 16, 5, 52)],
      targets: [],
      sketch: { tee: { fov: 72, up: 30 } },
      words: {
        plays: 'The reveal. You climb round the spatter rampart to the rim and the caldera opens beneath you: the lava lake glowing at its heart, rivers of lava and fields of glowing crust across the floor, the walls rising hundreds of metres all round, the plume and its lightning above. The tee stands on the lip of the Notch, the one low saddle in the rim, and the green is 60 m below and 240 yd away on the first terrace inside, at the foot of the wall. A long hang time; the 240 yd plays about 190. Short grass all round the green and a pod of it short and right give a safe place to miss.',
        safe: 'Club for about 190, at the middle of the green; short right is short grass.',
        bold: 'There is no bold line, only the drop.',
        miss: 'Short, the ball hits the wall\'s talus of fallen rock and stays there. Long is rough on the terrace, and past it the terrace\'s edge.',
      },
    }),
  }),

  // 6. THE TERRACES: a drivable par 4 along the first terrace, then down its edge to the second
  hole({ n: 6, name: 'The Terraces', par: 4, legs: [[110, 0], [164, 66]], place: { at: [-160, -160], heading: 262 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 14, pumice: [52, -30], ash: [92, -34] },
      ramps: [[164, 226]],
      fw: [{ e: [[52, 13, 13], [88, 20, 22], [125, 25, 26], [160, 24, 22], [186, 14, 14], [208, 15, 16], [230, 24, 24], [252, 20, 20]], wob: 5 }],
      corridor: 16,
      cant: [[115, 200, 3]],   // the upper terrace leans toward its edge and the lower terrace
      columns: { from: [150, 40], to: [230, 120], label: 'basalt columns' },
      bunkers: [{ at: P(150, 30), rx: 15, rz: 10, rot: 0.4, kind: 'cinder', job: 'carry' }, { at: P(258, -17), rx: 8, rz: 5 }, { at: P(286, 12), rx: 7, rz: 5 }],
      green: { lobes: [[-6, 6, 7, 15, -45], [5, -3, 10, 6, -45]], apron: 5, contour: [{ fall: 45, pct: 1.8 }, { tier: [-6.4, 6.4], up: -135, h: 0.6, w: 6 }], style: 'A T turned 45°: its long bar runs from front right to back left, its stem to the front left, on the lower terrace, falling 1.8% toward the front right, the back-left end of the bar on a tier 0.6 m up (the bold green of the nine): open from the right, the bold side' },
      boulders: [...blocks(P(100, -50), 14, 5, 61)],
      targets: [{ name: 'The upper terrace', at: P(150, -4) }, { name: 'Down on the lower terrace', at: P(236, 0), bold: true }],
      boldLine: [[0, 0], [0, 0]],
      words: {
        plays: 'When the caldera collapsed, its walls slumped in rings of terraces. This drivable par 4 runs along the first one, the wall rising 170 m on the left, then bends right and steps down its edge, a 12 m crag of basalt columns, to the second terrace and the green. A pool of lava lies at the foot of the crag, just right of the straight line to the green: a drive at the green that leaks right finds it. The fairway eases down a gully in the edge. Where the drive stops sets the lie: the upper terrace leans 2–3% toward its edge, so a drive there kicks right toward the corner; on the way down, a downslope.',
        safe: 'Lay up on the upper terrace (150 m) with an iron and play a short iron down to the green.',
        bold: 'Drive straight at the green over the corner: carry the columns and it can finish on the lower terrace by the green.',
        miss: 'A drive that comes up short of the bold carry hits the columns and drops to their foot in broken rock. Left is the wall\'s talus. A red-cinder bunker sits on the lip at the corner.',
      },
    }),
  }),

  // 7. THE LAVAFALL: a par 5 along the second terrace's ledge, past a lavafall, then down into a bay in the wall
  hole({ n: 7, name: 'The Lavafall', par: 5, legs: [[262, 0], [204, -35]], place: { at: [-345, -300], heading: 282 }, tips: [-30, 32],
    build: (P) => ({
      tees: { obsidian: 0, basalt: 22, pumice: [70, 40], ash: [110, 40] },
      ramps: [[196, 292]],
      cant: [[150, 290, -6.5]],
      fw: [{ e: [[60, 14, 14], [100, 22, 24], [150, 28, 28], [200, 31, 30], [238, 31, 29], [262, 26, 26], [285, 15, 15], [305, 17, 17], [340, 25, 26], [380, 27, 26], [418, 19, 18], [445, 14, 14]], wob: 5.5 }],
      corridor: 18,
      bunkers: [{ strip: [[318, 44, -27], [345, 49, -29], [375, 50, -30], [405, 43, -26]], wob: 3, kind: 'cinder', job: 'catch' },
        { at: P(452, -17), rx: 8, rz: 5 }, { at: P(484, 13), rx: 7, rz: 5 }, { at: P(222, 36), rx: 14, rz: 10, kind: 'cinder', job: 'target' }],
      green: { lobes: [[1, -3, 8, 15, 40], [-7, 9, 8, 5, 0]], contour: [{ fall: 0, pct: 1.8 }, { ridge: [[-6, 7], [-8, 14]], h: 0.3, w: 2.5 }], style: 'An L: a long leg from front left to back right and a wing at the back left toward the fall, falling 1.8% toward the front, a low spine walling the wing off from the leg: open from the left, where the strip bunker runs' },
      boulders: [...blocks(P(320, 70), 20, 7, 71), ...blocks(P(150, -60), 14, 4, 72)],
      targets: [{ name: 'The ledge', at: P(218, -2) }, { name: 'The bay', at: P(382, 0) }],
      words: {
        plays: 'Lava from a vent outside the rim spills over the wall at the back of a bay and pours 420 m down it in a glowing fall, steam rising where it meets a pool of lava at the foot. The hole runs along the ledge of the second terrace toward it, then bends left and drops 18 m down the ledge\'s end into the bay, onto the crater floor. Off to the right, below the terraces, the Spill, a lava river from a vent below the terraces, runs across the floor to the lake. The ledge is a slumped block of the wall that rotated as it slid, so it tilts back toward the wall: the landing area leans 6.5% to the left, away from the edge, and the second is played with the ball above your feet. The fall is the hole\'s landmark from the tee, straight ahead; the green sits in the bay 120 m from the pool.',
        safe: 'Drive along the ledge (218 m), play down into the bay (382 m) and pitch on.',
        bold: 'A long second from the ledge can reach the green: the fairway runs down off the end of the ledge, and the bay floor is wide.',
        miss: 'The ledge leans left, so a drive on the left half runs on toward the wall\'s foot, into the rough. Right of the ledge is the terrace\'s edge, an 18 m drop to the floor: a ball that goes over it is down on the ash, a long way below. Left of the bay a long red-cinder bunker runs along the fairway, and past it the wall\'s talus.',
      },
    }),
  }),

  // 8. THE LAKE: a par 4 cape right round the west end of the lava lake, over a blind crest
  hole({ n: 8, name: 'The Lake', par: 4, legs: [[230, 0], [136, 65]], place: { at: [-775, -320], heading: 345 }, tips: [-30, 34],
    build: (P) => ({
      tees: { obsidian: 0, basalt: 20, pumice: [70, -40], ash: [110, -40] },
      fw: [{ e: [[60, 14, 14], [100, 22, 22], [150, 28, 24], [200, 30, 24], [240, 28, 22], [272, 22, 20], [310, 18, 16], [345, 14, 13]], wob: 5.5 }],
      corridor: 18,
      cant: [[170, 290, -2]],   // away from the lake
      forms: [{ at: P(200, 0), rx: 90, rz: 36, rot: 0, h: 8, label: 'the crest' }],
      zones: [{ blobs: [[108, -62, 14], [150, -76, 18], [170, -60, 12], [210, -70, 16], [250, -66, 14], [292, -58, 12]], surf: 'sulfur' }],
      fumaroles: [[110, -60], [150, -78], [168, -60], [210, -70], [250, -66], [292, -56]],
      bunkers: [{ at: P(250, -33), rx: 17, rz: 11, rot: -0.4, kind: 'cinder', job: 'target' }, { at: P(346, -16), rx: 8, rz: 5 }, { at: P(378, 8), rx: 7, rz: 5 }],
      green: { lobes: [[0, 0, 9, 18, -30], [-6, 12, 8, 7, 0]], contour: [{ fall: -30, pct: 2 }, { bowl: [-6, 12], r: 10, h: 0.3 }], style: 'Long and thin, set from front right to back left, a knob at the back, falling 2% toward the front left (nothing tips toward the lake) with a bowl in the knob that gathers to a back pin: open from the right, the lake side' },
      boulders: [...blocks(P(120, 50), 14, 4, 81)],
      targets: [{ name: 'Over the crest', at: P(246, -6) }],
      boldLine: [[0, 0], [0, 0]],
      words: {
        plays: 'A cape round the west end of the lava lake. The drive climbs 8 m to a crest, a blind one from the tee, and runs down its far side to where the hole bends right along the shore; the lake lies on the right the whole way, glowing in its pit 12 m down. Fumaroles steam across sulfur-yellow ground on the left, and the crest leans that way, away from the lake. The green runs along the shore. Bite off as much of the lake as you dare: the further right you go, the shorter the second.',
        safe: 'Drive left of the line over the crest (246 m) and play a short iron in.',
        bold: 'Aim right of the corner and carry the lake\'s west end: a wedge in, if it gets over.',
        miss: 'Right is the lake: a stroke and a drop beside where it went in. Left is the sulfur ground round the fumaroles (a bad lie) and a red-cinder bunker at the corner. A drive that comes up short sits on the crest\'s upslope with the green out of sight.',
      },
    }),
  }),

  // 9. THE HEART: along the lake's north shore, then out across a natural rock bridge to an island in the lava
  hole({ n: 9, name: 'The Heart', par: 4, legs: [[245, 0], [146, 58]], place: { at: [-735, -718], heading: 92 },
    build: (P) => ({
      tees: { obsidian: 0, basalt: 20, pumice: [56, -38], ash: [100, -38] },
      ramps: [[262, 375]],
      fw: [{ e: [[60, 14, 14], [100, 22, 23], [150, 28, 29], [200, 30, 28], [235, 29, 27], [256, 23, 21], [272, 15, 15], [295, 12, 12], [325, 12, 12], [352, 13, 13], [370, 11, 11]], wob: 4.5 }],
      corridor: 16,
      cant: [[140, 240, -3]],
      bunkers: [{ at: P(222, 43), rx: 15, rz: 9, rot: 0.3, kind: 'cinder', job: 'catch' }, { at: P(376, -15), rx: 6, rz: 4.5, pot: true }, { at: P(412, 13), rx: 6, rz: 4.5, pot: true }],
      green: { lobes: [[-6, 7, 7, 9, 18], [6, 7, 7, 9, -18], [0, -6, 6, 10, 0]], join: 4, raise: 1.4, falseFront: true, contour: [{ fall: 0, pct: 1.5 }, { tier: [0, 3.25], up: 180, h: 0.4, w: 3.5 }], style: 'Two lobes across the back and a point at the front (a heart, for the Heart); raised 1.4 m with a false front; the two back lobes sit on a tier 0.4 m above the point, and the whole falls 1.5% toward the front' },
      hall: { at: [0, 0], w: 32, d: 14, h: 6, roof: 2.5, label: 'the clubhouse' },
      boulders: [...blocks(P(120, -54), 14, 5, 91)],
      targets: [{ name: 'The shore', at: P(236, -4) }, { name: 'On the bridge', at: P(310, 0) }],
      boldLine: [[0, 0], [0, 0]],
      words: {
        plays: 'The finish. The fairway runs along the north shore of the lava lake, the lake on the right, leaning 2–3% to the left, away from the lava, then turns right onto a natural rock bridge: a span of old lava 28 m wide with the lake flowing under it, out to an island in the middle of the lake. The bridge climbs onto the island and the green sits raised on its top, 17 m above the shore, with lava glowing on every side (on both sides of the bridge and all round the island) and the walls towering all round. Behind the green, on the island\'s high point, stands the clubhouse, built of black basalt.',
        safe: 'Drive along the shore (236 m), play onto the bridge (310 m), and pitch up to the green.',
        bold: 'From the shore, fly the lava straight at the green: about 150 m, all carry.',
        miss: 'Right of the shore and either side of the bridge is the lake: a stroke and a drop. A red-cinder bunker on the right of the landing area catches a push before it reaches the lava. Short of the green, the false front sends the ball back down the bridge.',
      },
    }),
  }),
];

// finishing touches that need the built line: the bold lines, and the clubhouse behind the 9th green
{
  const at_ = (h, s, o = 0) => at(h.line, s, o);
  HOLES[3].boldLine = [at_(HOLES[3], 215), HOLES[3].pin];
  HOLES[5].boldLine = [[0, 0], HOLES[5].pin];
  HOLES[7].boldLine = [[0, 0], at_(HOLES[7], 300)];
  HOLES[8].boldLine = [at_(HOLES[8], 236), HOLES[8].pin];
  // the clubhouse on the island's south-east side, its long side facing the green
  const h9 = HOLES[8], a = h9.place.heading * Math.PI / 180, dX = -346 - h9.place.at[0], dZ = -580 - h9.place.at[1];
  h9.hall.at = [dX * Math.cos(a) + dZ * Math.sin(a), -(dX * Math.sin(a) - dZ * Math.cos(a))];
}
