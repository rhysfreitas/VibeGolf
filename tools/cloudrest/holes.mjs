// Cloudrest, plan book round 1: golf on the sides of a misty gorge. The concept, the skeleton (par 36:
// 4 3 5 3 4 5 3 5 4), the routing ("Across the Gorge") and the nine hole cards were approved by Rhys on 15 November
// 2026 (claude/cloudrest-layout.md in the project); round 0 settled the thin air (8,500 ft), damp turf and walls that
// soak (claude/status-cloudrest.md). This file draws them: real fairway outlines from the forms, green shapes, heights,
// the four tee sets and the Pinnacle tips spot on every hole, targets.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the line,
// y up from the hole's `base`, the back tee's height). `route` turns the layout doc's world line ([x east, n north])
// into `legs` and `place`; `L(x, n)` turns a world point into the hole's frame. The height along each line follows
// the world (world.mjs), with `prof` knots [[s, dy]] added to it.
import { lineOf, lengthOf, at, headingAt, YD } from './geo.mjs';
import { LINES } from './world.mjs';

export const COURSE = {
  id: 'cloudrest', name: 'Cloudrest', theme: 'cloud', altFt: 8500, turf: 'damp', wallSoak: 0.45,
  voidText: ['Into the mist', 'Ends in the mist'],
  signature: { time: 'late afternoon', light: 'mist lifting out of the gorge, warm side light from the west, the far wall gold', wind: 'light, up the gorge', weather: 'mist lifting', temp: 'cool' },
  teeSets: [
    { id: 'summit', name: 'Summit', color: '#7b2d26', minDrive: 260 },
    { id: 'ridge', name: 'Ridge', color: '#c8962e', minDrive: 230 },
    { id: 'ledge', name: 'Ledge', color: '#2f6f6a', minDrive: 200 },
    { id: 'terrace', name: 'Terrace', color: '#e8e2d0', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'pinnacle', name: 'Pinnacle', color: '#4a4f57', minDrive: 290 },
  card: {
    hook: 'Golf on the sides of a misty gorge: two facing cliffs hung with pines, stone pinnacles standing out of the cloud between, a lived-in monastery set into the far wall. Two logics: the wall gives and the mist takes (a ball into a cliff face drops at its foot about half the time, otherwise it comes back; only a shelf\'s outer edge is penalty ground, behind a kerb that stops a ball that only runs), and the air is thin (8,500 ft: the ball flies about 10-15% further, flatter, with less curve and less wind).',
    skeleton: 'Par 36: 4 3 5 3 4 5 3 5 4, three par 3s and three par 5s. A journey, not a loop: down the western cliff (1-4), across the gorge on a ridge (5), up the eastern cliff (6-7), through the tea terraces behind the monastery (8), down three tiers to its courtyard (9). The monastery is seen from the 1st and played toward all day.',
    classics: 'Hog\'s Back (5: the ridge). Its own: the pillar green (4), the alcove (7), the switchback (9), a par 3 balcony to balcony (2). More welcome.',
    decisions: 'Three, three types: lay up or carry the notch (5), high road or low road (8), drivable par 4 (9). One in the last two holes.',
    landmarks: 'The monastery\'s golden roof (from 1, 2, 5, 6, 9); the Needle (from 3\'s green, 4, 5); the white stupa (5, 6). The reveal: the 5th tee, out on the ridge with the gorge running away both sides.',
    rhythm: 'A gentle shelf to open; a balcony; the hanging valley as a breather; the hardest holes 4-6 (the Needle, the ridge, the Stair); the alcove; the terraces; a short drop home. Par 3s 155, 180, 225; par 4s 435, 440, 510; par 5s 555, 600, 650.',
    forms: 'Six fairways, six forms: 1 fan, 3 bowl (irregular), 5 broken, 6 hourglass, 8 split (upper and lower terrace), 9 stepping stones (three tiers). A wall on one side and a drop on the other is this course\'s plain strip: only the 1st and 6th are shelves, and they differ (one falls away and is wide, one climbs a face).',
    heights: '1 fall-away along a shelf, 2 across a gulf (par 3), 3 half-pipe, 4 the drop (the only one: 18 m onto a pillar), 5 hog\'s back, 6 table top then a big climb (bold), 7 uphill to a shelf (par 3), 8 stepped: high road, low road (bold), 9 stepped, 54 m down off a knoll and three tiers (bold).',
    dials: 'One pushed on every hole: 1 width (a 62 m shelf), 2 a carry (over a cleft 50 m deep to the mist), 3 length (650 yd on the card: past real golf there), 4 green size (330 m² on a pillar), 5 width (a 40 m crest), 6 height (a 9 m face, 31 m of climb), 7 scale (the whole hole under an overhang 90 m up), 8 length (reachable: plays 505), 9 height (54 m down off a knoll and three tiers).',
    newBorrowed: 'New to the register: thin air; a hole under a rock roof; a bowl fairway; a switchback down a slope; a pillar green; a par 3 balcony to balcony; a fairway along a ridge crest. Borrowed (two): a chasm beside the fairway, a tee shot off a height (9). One thread of waterfall and one rope bridge as scenery only. No punchbowl, arch or climb to the clubhouse.',
  },
};
export const BACK = 'summit', FRONT = 'terrace';

// the layout doc's line ([x east, n north] tee, corners, pin) as a place and legs
function route(pts) {
  const b = pts.slice(1).map((p, i) => Math.atan2(p[0] - pts[i][0], p[1] - pts[i][1]) * 180 / Math.PI);
  const turn = (a, c) => ((c - a + 540) % 360) - 180;
  return { place: { at: [pts[0][0], -pts[0][1]], heading: (b[0] + 360) % 360 }, legs: pts.slice(1).map((p, i) => [Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), i ? turn(b[i - 1], b[i]) : 0]), world: pts };
}
// a world point [x east, n north] in a hole's frame
const localOf = place => (x, n) => {
  const a = place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a), dx = x - place.at[0], dz = -n - place.at[1];
  return [dx * rx + dz * rz, -(dx * fx + dz * fz)];
};
function hole(def) {
  const R = route(def.world), L = lineOf(R.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o), Lw = localOf(R.place);
  const h = def.build(P, L, len, Lw);
  h.line = L; h.len = len; h.pin = L.at(-1); h.place = R.place; h.legs = R.legs; h.L = Lw;
  if (h.green && h.green.k) h.green.lobes = h.green.lobes.map(([u, v, rx, rz, rot = 0]) => [u * h.green.k, v * h.green.k, rx * h.green.k, rz * h.green.k, rot]);
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : v.world ? Lw(...v.world) : P(v[0], v[1]);
  // card yards: along the line on a par 4 or 5; on a par 3 straight from the pad to the pin
  const yd = (v, p) => Math.round((def.par === 3 ? Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) : len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) h.yards[k] = yd(v, h.teePts[k]);
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = yd(tp, h.tipsPt);
  if (def.par !== 3 && tp[1]) { const b = h.teePts[BACK]; h.tipsYards = Math.round((h.yards[BACK] + Math.hypot(h.tipsPt[0] - b[0], h.tipsPt[1] - b[1]) / YD) / 5) * 5; }
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}
const sand = (at, rx, rz = rx, rot = 0, more = {}) => ({ at, rx, rz, rot, ...more });

export const HOLES = [
  // 1. THE OVERLOOK: from the gate house down a broad shelf on the western cliff, the wall on the right, a kerb of
  // rock and pines along the outer edge; across the gorge the monastery's roofs catch the sun
  hole({ n: 1, name: 'The Overlook', par: 4, world: LINES[0], tips: [-36, 0], shape: 'Dogleg right (34°), down a shelf',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [22, 9], ledge: [55, -10], terrace: [96, 12] },
      // a fan: 26 m out of the tee area, opening to 61 m where drives land, closing into the green
      fw: [{ e: [[112, 12, 12], [150, 18, 17], [200, 24, 23], [250, 29, 29], [290, 32, 31], [330, 34, 32], [362, 33, 30], [382, 26, 24], [394, 16, 15]], wob: 3 }],
      prof: [[0, 0], [100, -0.8], [150, -0.7], [200, 0.4], [240, 0], [len, 0]],   // an even fall to the landing area, so the tee sees it
      bunkers: [sand(P(252, 34), 8, 4.5, 0.15), sand(P(len - 14, -17), 5, 3.4, 0.4), sand(P(len + 12, 13), 4, 3, -0.3), sand(P(len - 4, 19), 3.6, 2.8, 0.2)],
      green: { k: 1, lobes: [[0, 0, 11, 15, -12], [-5, -9, 7.5, 7], [4, 10, 7, 6]], apron: 4, contour: [{ fall: 175, pct: 1.6 }, { ridge: [[-9, -7], [8, -9]], h: 0.25, w: 3 }], style: 'Long and open from the front, falling 1.6% away from you with the shelf, a low spine across its middle; sand short left, right and long right' },
      targets: [{ name: 'The fan', at: P(250, -4) }],
      words: {
        story: 'The overlook: down a broad shelf with the gorge on your left and the monastery across it.',
        plays: 'From the gate house the hole runs down a broad shelf on the western cliff, the cliff wall rising on the right, a kerb of rock and pines along the outer edge on the left and nothing beyond it but the mist. The fairway fans out to 61 m where drives land. The ground runs away all the way to the green: land the approach short and let it release. Across the gorge the monastery\'s roofs catch the late sun. A gentle opener: only a ball that flies the kerb is lost.',
        safe: 'Driver down the middle of the fan (250 m), a short iron landed short of the green.',
        bold: null,
        miss: 'Right: rough, then the wall, which gives a ball back (about half drop at its foot). Left: rough, then the kerb, which stops a ball that only runs; a ball that flies it is in the mist (a stroke and a drop). At the green: sand short left, right and long right; the safe miss is short.',
      },
      card: {
        type: 'Original (a gentle opener)', form: 'Fan', feature: 'The shelf: the wall on the right, the kerb and the drop on the left; the monastery across the gorge', job: 'The wall is a helper (it gives a ball back); the kerb a helper (it stops a runner); the monastery an aim point and a frame',
        decision: 'None: one clear line', miss: 'Small: rough either side. Medium: the wall (right) or the kerb (left). Big: over the kerb into the mist (left only). Safe miss at the green: short',
        view: 'In front the tee and the shelf falling away; in the middle the fan between the wall and the kerb; beyond, the gorge and the monastery in the far wall. The landing area shows',
        ground: 'Fall-away: the shelf runs away 12 m from tee to green, most of it in the last 100 m; the green falls away too',
        height: 'Fall-away', dial: 'Width: a 62 m shelf', shots: { tee: 'Straight, driver as hard as you like', approach: 'A short iron landed short to release' }, hazard: 'Down the left: the drop behind the kerb', surround: 'Sand short left, right and long right; a run-off at the back',
      },
    }),
  }),

  // 2. THE BALCONY: balcony to balcony across a cleft, a flag-hung rope bridge beside the line, a thread of waterfall
  // at the cleft's head; the far balcony's parapet returns a long ball
  hole({ n: 2, name: 'The Balcony', par: 3, world: LINES[1], tips: [-12, 0], shape: 'Straight, across a cleft',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [10, 4], ledge: [60, 88], terrace: [80, 84] },
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 15, 14), 4.2, 3)],
      green: { k: 1, lobes: [[0, 0, 11, 13.5, 15], [-6, 7, 6, 6]], apron: 2.5, contour: [{ fall: 0, pct: 1.9 }, { tier: [0, 3], up: 0, h: 0.35, w: 3 }], style: 'Deeper than wide, tilted 1.9% toward you, a back tier; the parapet behind it' },
      targets: [],
      words: {
        story: 'The balcony: from one ledge of the cliff to another across a cleft that goes down to the mist.',
        plays: 'All carry: from a balcony of rock to a green on another across a cleft 50 m deep to the mist, a flag-hung rope bridge beside the line and a thread of waterfall at the cleft\'s head. The far balcony\'s stone parapet returns a long ball. The forward tees play from a balcony beyond the cleft\'s head with half the carry.',
        safe: 'A mid iron to the middle of the green; long is better than short.',
        bold: null,
        miss: 'Short: the cleft (a stroke and a drop on the near side). Long: the parapet throws it back onto the balcony. Right: sand. Left: a kerb, then the gorge. The safe miss is long.',
      },
      card: {
        type: 'Original (a par 3 balcony to balcony)', form: 'Par 3', feature: 'The cleft, the rope bridge, the waterfall thread; the parapet', job: 'The cleft is the hazard (all carry); the parapet a helper (it returns a long ball); the bridge and the falls a frame',
        decision: 'None: one shot', miss: 'Small long: the parapet. Small short: the cleft. Right: sand. Safe miss: long',
        view: 'The cleft at your feet, the bridge to the left, the green on its balcony beyond with the gorge behind it and the eastern cliff in the distance',
        ground: 'Across a gulf: tee and green at about one height (244 and 240 m), the cleft between going down to the mist',
        height: 'Across a gulf (par 3)', dial: 'A carry: over a cleft 50 m deep', shots: { tee: 'A high mid iron that stops', approach: '' }, hazard: 'In front: the cleft (across)', surround: 'A parapet behind; sand right; the kerb and the drop left',
      },
    }),
  }),

  // 3. THE HANGING VALLEY: a hidden side valley, a long bowl of pasture, pines up its sides, a stream down the middle
  // then across; no cliff and no edge; the breather
  hole({ n: 3, name: 'The Hanging Valley', par: 5, world: LINES[2], tips: [-34, 0], shape: 'Dogleg left (51°), down a valley',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [25, 5], ledge: [60, -10], terrace: [115, 15] },
      // an irregular bowl: one basin from the drive to the green, wider than any fairway, following its hollow
      fw: [{ lobes: [[168, 0, 40, 28], [240, -4, 62, 54, 10], [340, 5, 62, 58, -8], [440, 0, 58, 50, 6], [530, 2, 40, 26], [568, 0, 22, 14]], join: 14, wob: 3 }],
      cross: [[60, 310, 10, 60, 0], [340, 585, 8, 72, 22]], flat: 30, fade: 46,   // a half-pipe where the drives land; by the stream the valley floor is level for 22 m either side, then its banks
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 18, -15), 5, 3.4, 0.3), sand(P(len + 12, 14), 4.5, 3, -0.2), sand(P(len - 8, 20), 3.6, 2.6, 0.5), sand(P(372, -30), 6, 3.6, 0.3), sand(P(386, 34), 5, 3.2, -0.3)],
      green: { k: 1, lobes: [[0, 0, 14, 17, 8], [-8, -10, 8, 8], [7, 11, 8, 7]], apron: 4, contour: [{ fall: 10, pct: 1.7 }, { tier: [0, 2], up: 10, h: 0.45, w: 3.5 }], style: 'Big (800 m²) and three-lobed, a tier across its middle; sand short left and long right' },
      targets: [{ name: 'The basin', at: P(255, 0) }, { name: 'Right of the stream', at: P(440, 19) }, { name: 'Left of the stream', at: P(440, -16) }],
      words: {
        story: 'The hanging valley: a hidden side valley, a breather after the cliffs.',
        plays: 'A hidden side valley: a long bowl of pasture, pines up its sides, a stream running down the middle of the second-shot ground and then across, 90 m short of the green. No cliff and no edge: the valley\'s sides feed a wide ball back. Driver into the basin, a second placed left or right of the stream (the prayer-wheel house on the right is the aim point), a pitch to a big green.',
        safe: 'Driver to the basin (255 m), a fairway wood or hybrid to either side of the stream (440 m), a wedge.',
        bold: null,
        miss: 'Wide either side: the valley\'s banks feed it back toward the fairway. In the stream: a stroke and a drop. At the green: sand short left and long right.',
      },
      card: {
        type: 'Long (a three-shotter with a cross hazard where the second wants to finish)', form: 'Bowl (irregular)', feature: 'The valley\'s banks; the stream down the middle then across; the prayer-wheel house', job: 'The banks are helpers (they feed a wide ball back); the stream a hazard (centre, then across); the prayer-wheel house an aim point',
        decision: 'None: the breather', miss: 'Small and medium: the valley\'s banks feed it back. The stream only near the middle of the second shot. Safe miss at the green: right',
        view: 'In front the valley falling away; in the middle the basin and its banks; beyond, the bend left and the pines up the valley\'s sides',
        ground: 'Half-pipe: the valley floor banked 9 m on both sides; −25 m tee to green',
        height: 'Half-pipe', dial: 'Length: 650 yd on the card (past real golf on the card; plays about 590)', shots: { tee: 'A draw round the bend, or straight', approach: 'A wedge to a big green' }, hazard: 'Down the centre, then across: the stream', surround: 'Sand short left and long right',
      },
    }),
  }),

  // 4. THE NEEDLE: from the valley's lip down 18 m to a 330 m² green on top of a lone stone pillar in the gorge
  hole({ n: 4, name: 'The Needle', par: 3, world: LINES[3], tips: [-13, -2], shape: 'Straight, down onto a pillar',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [9, 13], ledge: [24, -13], terrace: [40, 12] },
      flat: 0,   // the tee's ground and the pillar are the world's own (world.mjs needleAt)
      ceil: [[0, 0.4], [6, 0.3], [50, -9], [80, -9]],   // the valley's lip lowered: the ground falls from the tee to the edge, so the tee looks down onto the Needle
      prof: [[0, 0], [len, 0]],
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 9.4, 11.2, 20], [-3, 5, 5, 4.5]], apron: 1.2, contour: [{ fall: 0, pct: 1.5 }, { bowl: [1, 2], r: 9, h: 0.18 }], style: 'Small (330 m²) on a lone pillar, tilted gently toward the tee, a shallow dish in its middle; a rim of rock round its back half' },
      drops: [{ name: 'The drop on the Needle', at: P(len - 14, 0) }],
      targets: [],
      words: {
        story: 'The Needle: a green on top of a lone stone pillar in the gorge.',
        plays: 'From the hanging valley\'s lip the 4th drops 18 m to a small green on top of a lone stone pillar standing out of the mist, a twisted pine beside the flag. A rim of rock round the back half holds a long ball. Everything short, wide or over the rim\'s ends is in the mist: a stroke, and a drop back on the valley\'s lip.',
        safe: 'A short iron to the middle of the green; the rim forgives long.',
        bold: null,
        miss: 'Short, left, right: the mist (a stroke, and a drop back on the lip where it went over). Long: the rim of rock holds it on top. The safe miss is long.',
      },
      card: {
        type: 'Original (a pillar green)', form: 'Par 3', feature: 'The Needle: a lone pillar out of the mist, its rim of rock, the twisted pine', job: 'The pillar is the hazard (all carry, the green is the island); the rim a helper (it holds a long ball); the pine a frame',
        decision: 'None: one shot', miss: 'Everything but long is in the mist; long is held by the rim. A stroke and a drop back on the lip',
        view: 'The valley\'s lip at your feet, then the gorge; the pillar and its green below and in front, the ridge (the 5th) running away beyond it',
        ground: 'The drop: 18 m down, the course\'s only drop par 3',
        height: 'Drop (the only one)', dial: 'Green size: 330 m² on a pillar', shots: { tee: 'A short iron, high, that stops', approach: '' }, hazard: 'All round: the mist', surround: 'A rim of rock behind; the drop everywhere else',
        setPiece: 'Island green (a pillar, the theme\'s own island)',
      },
    }),
  }),

  // 5. THE BROKEN RIDGE: across the gorge along a crest of joined pinnacles; only the spine holds; a catch shelf down
  // its north side; a notch cuts it at 275 yd
  hole({ n: 5, name: 'The Broken Ridge', par: 4, world: LINES[4], tips: [-20, 0], shape: 'Dogleg left (20°), along a crest',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [22, 0], ledge: [55, 0], terrace: [92, 0] },
      flat: 0,   // the ridge is the world's own ground (world.mjs ridgeAt)
      ceil: [[0, 40], [392, 40], [420, 4.6], [len + 40, 4.6]],   // where the ridge meets the eastern cliff's foot, the ground no higher than the green (it stood 3 m over the approach)
      fw: [{ e: [[104, 13, 13], [140, 18, 18], [200, 20, 20], [238, 19, 19], [247, 13, 13]], wob: 2 }, { e: [[269, 13, 13], [285, 19, 19], [360, 20, 20], [420, 19, 19], [446, 13, 13], [456, 8, 8]], wob: 2 }],
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 15, -13), 4.5, 3.2, 0.2), sand(P(len + 6, 15), 4, 2.8, -0.4)],
      green: { k: 1, lobes: [[0, 0, 10, 13, -20], [5, 8, 6, 5.5]], apron: 3, contour: [{ fall: 200, pct: 1.8 }, { ridge: [[-8, 1], [9, -1]], h: 0.3, w: 2.8 }], style: 'At the eastern cliff\'s foot, the wall behind it; a spine across it; sand short left' },
      targets: [{ name: 'Short of the notch', at: P(210, 0) }, { name: 'Over the notch', at: P(298, 0), bold: true }],   // the lay-up 41 m short of the notch: drives that ran on into it were stuck under its far face
      words: {
        story: 'The broken ridge: across the gorge on a crest of joined pinnacles.',
        plays: 'The reveal: from a tee out on the ridge the gorge runs away on both sides. The hole crosses it along a crest of joined pinnacles, a hog\'s back about 40 m across: only the spine holds. A ball that leaks left drops 8 m to a catch shelf on the north side (a blind shot back up); the south side is the mist, behind a kerb on the flank\'s lip. A notch cuts the ridge 251-265 m out, its far side a slope of scree you can play up out of: lay up short of it, or carry it (265 m from the back tee) to the far side. The green sits at the foot of the eastern cliff.',
        safe: 'A 3 wood or hybrid to 210 m, short of the notch; a long second (about 255 m, a wood in this air).',
        bold: 'Driver over the notch (a 265 m carry, 290 m to land on the fairway beyond its scree) to 298 m, leaving about 170 m.',
        miss: 'Left: the flank, then the catch shelf 8 m down (rough, a blind shot back up). Right: the flank to the kerb; over the kerb is the mist. Short of the notch\'s far side: a rock lie in the notch, 10 m down, then a pitch up its scree. At the green: the cliff behind returns a long ball; sand short left.',
      },
      card: {
        type: 'Hog\'s Back', form: 'Broken', feature: 'The crest; the catch shelf; the notch; the kerb on the south flank', job: 'The crest is a lie-setter (it sheds a loose ball); the catch shelf a helper (it saves a ball from the mist); the notch a hazard (across); the kerb a helper',
        decision: 'Lay up or carry: short of the notch (210 m) or over it (a 265 m carry); the bold line leaves about 70 m less',
        miss: 'Small: the flanks. Medium left: the catch shelf (a blind recovery). Medium right: the kerb. Big right: the mist. Safe miss at the green: long (the wall)',
        view: 'The ridge running away from your feet, the gorge falling away both sides (the reveal), the notch a dark gap at 275 yd, the eastern cliff and the monastery beyond',
        ground: 'Hog\'s back: a crowned crest about 40 m across, the north flank down 8 m to a shelf, the south flank to the mist; +4 m tee to green',
        height: 'Hog\'s back', dial: 'Width: a 40 m crest', shots: { tee: 'Dead straight; a lay-up to a number or driver over the notch', approach: 'A long iron or wood' }, hazard: 'Across: the notch; down the right: the mist', surround: 'The cliff behind; sand short left',
      },
    }),
  }),

  // 6. THE STAIR: up the eastern cliff: a lower shelf, a 9 m rock face with a pilgrim stair cut in it, an upper
  // shelf climbing to a green by a white stupa; the wall on the right, rough then the drop on the left
  hole({ n: 6, name: 'The Stair', par: 5, world: LINES[5], tips: [-34, 0], shape: 'Dogleg right (24°), up a face',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [22, 9], ledge: [62, -10], terrace: [96, 12] },
      // an hourglass: the lower shelf wide, pinched at the foot of the face, the upper shelf opening again
      fw: [{ e: [[124, 15, 15], [160, 22, 22], [210, 25, 25], [246, 22, 22], [254, 13, 13], [262, 9, 9], [276, 8, 8], [290, 9, 9], [306, 18, 18], [360, 22, 22], [436, 22, 21], [500, 17, 16], [530, 10, 10]], wob: 3 }],
      prof: [[0, 1.8], [60, 0.2], [120, -0.5], [180, -0.5], [232, 0], [262, 0], [278, 9], [350, 8], [436, 0], [len, 0]],   // the face 262-278 m out (round 1: moved 16 m on, so a tour drive lands short of it and the longest fly it)
      bunkers: [sand(P(420, 24), 7, 4, 0.1), sand(P(len - 15, -15), 5, 3.4, 0.3), sand(P(len + 10, 13), 4, 3)],
      green: { k: 1, lobes: [[0, 0, 12, 15, -12], [6, -9, 7, 7], [-6, 10, 7, 6]], apron: 3.5, contour: [{ fall: 0, pct: 1.8 }, { tier: [0, -2], up: 0, h: 0.5, w: 3 }], style: 'By the white stupa, a front tier up to a back shelf; sand left and long right' },
      ramp: { w: 9, prof: [[0, 1.8], [60, 0.2], [120, -0.5], [180, -0.5], [232, 0], [248, 0], [300, 9], [350, 8], [436, 0]] },   // the neck: a grass ramp up the face, beside the pilgrim stair (round 1: so the hourglass is one fairway)
      targets: [{ name: 'The lower shelf', at: P(222, -2) }, { name: 'The upper shelf', at: P(420, -2) }],
      sketch: { teeDrop: -6 },
      words: {
        story: 'The Stair: up the eastern cliff, over a rock face with a pilgrim stair cut in it.',
        plays: 'Up the eastern cliff: a lower shelf, then a 9 m rock face with a pilgrim stair cut in it and a narrow grass ramp beside the stair (the hourglass\'s neck), then an upper shelf climbing to a green by a white stupa. The wall on the right gives a ball back; on the left, rough and then the drop. Drive to the lower shelf, well short of the face; a second up the face onto the upper shelf (blind from below: the stair and a flag on the lip mark the line); a pitch to the green. The longest drives can fly the face.',
        safe: 'Driver to the lower shelf (205 m), a wood or long iron up onto the upper shelf (420 m), a wedge.',
        bold: null,
        miss: 'Right: the wall (it gives). Left: rough, then the kerb and the drop. Short of the face on the second: the foot of the face, a pitch up. At the green: sand left and long right.',
      },
      card: {
        type: 'Original (a table top and a climb)', form: 'Hourglass', feature: 'The 9 m face, its pilgrim stair and the grass ramp beside it; the white stupa; the wall', job: 'The face is an obstacle (a lower landing area short of it, the longest can fly it), the ramp the way up for a running ball; the stair a marker; the stupa a landmark beside the green (never a target); the wall a helper',
        decision: 'None: one clear line, a lower landing area for the player who can\'t get up in two', miss: 'Small: rough. Medium right: the wall. Medium left: rough then the kerb. Big left: the drop. Safe miss at the green: right',
        view: 'In front the lower shelf; in the middle the face with its stair and a flag on its lip; beyond, the upper shelf climbing and the stupa',
        ground: 'Table top then a big climb: a 9 m face 262-278 m out (a grass ramp up it 18 m wide beside the stair, 248-300 m), then 6 m more to the green; +31 m tee to green',
        height: 'Table top, then a big climb (bold)', dial: 'Height: a 9 m face, 31 m of climb', shots: { tee: 'A lay-up to a number (short of the face) or a fade with the bend', approach: 'A wedge uphill' }, hazard: 'Across: the face; down the left: the drop', surround: 'Sand left and long right',
      },
    }),
  }),

  // 7. THE ALCOVE: a long iron inside a vast alcove, the rock roof 90 m overhead, painted halls along the back wall,
  // the green on a shelf at the far end
  hole({ n: 7, name: 'The Alcove', par: 3, world: LINES[6], tips: [-14, 0], shape: 'Straight, under a roof',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [12, 8], ledge: [32, -8], terrace: [58, 8] },
      flat: 0,   // the alcove's floor is the world's own
      prof: [[0, 0], [150, 0], [178, 3], [len, 3]],
      bunkers: [sand(P(len - 19, 15), 5, 3.5, 0.2), sand(P(len + 14, -12), 4.2, 3, 0.3)],
      green: { k: 1, lobes: [[0, 0, 13, 16, -8], [-7, -10, 8, 8], [7, 9, 8, 7]], apron: 3, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-6, -11], [-5, 10]], h: 0.35, w: 3 }], style: 'Big (700 m²) on a shelf 3 m up, a spine down its length; the back wall left; sand short right; the lotus pool short left' },
      targets: [],
      words: {
        story: 'The alcove: a long iron under a roof of rock 90 m up.',
        plays: 'A long iron inside a vast alcove in the eastern cliff: the rock roof 90 m overhead, painted halls along the back wall on the left, the green on a shelf at the far end, 3 m up. The wall helps on the left (it gives a ball back); a lotus pool short left; the alcove\'s open side on the right beyond the rough.',
        safe: 'A long iron or hybrid at the right half of the green.',
        bold: null,
        miss: 'Left: the back wall (it gives) and the lotus pool short. Right: rough, then the open side. Short: up the shelf\'s bank. The safe miss is right.',
      },
      card: {
        type: 'Original (a hole under a rock roof)', form: 'Par 3', feature: 'The overhang 90 m up; the back wall and its painted halls; the lotus pool', job: 'The roof is a frame (the whole hole under it); the back wall a helper; the lotus pool a hazard short left',
        decision: 'None: one shot', miss: 'Left: the wall, the pool short. Right: rough, the open side. Safe miss: right',
        view: 'The roof overhead, the halls along the back wall, the green on its shelf at the far end with the end wall behind it',
        ground: 'Uphill to a shelf: +8 m, the green 3 m up a bank at the end',
        height: 'Uphill to a shelf (par 3)', dial: 'Scale: the whole hole under an overhang 90 m up', shots: { tee: 'A long iron or hybrid, a draw off the right', approach: '' }, hazard: 'Short left: the lotus pool', surround: 'The back wall left; sand short right; the shelf\'s bank in front',
      },
    }),
  }),

  // 8. THE TEA TERRACES: a high valley behind the monastery; high road up onto the upper terrace (30 m wide), or the
  // low road on the lower terrace (55 m), a lay-up short of a pond under the terrace wall and a pitch up
  hole({ n: 8, name: 'The Tea Terraces', par: 5, world: LINES[7], tips: [-26, -22], shape: 'Dogleg left (56°), on two terraces',
    build: (P, L, len) => ({
      tees: { summit: 0, ridge: [20, -8], ledge: [55, -10], terrace: [100, -12] },
      fw: [{ e: [[112, -2, 30], [150, -2, 44], [250, -2, 52], [330, -2, 50], [366, -4, 32], [378, -4, 20]], wob: 2.5 },   // the low road: the lower terrace, right of the wall
        { e: [[168, 31, -6], [250, 34, -6], [330, 33, -6], [400, 30, -8], [450, 26, 8], [492, 13, 8], [500, 8, 6]], wob: 2 }],   // the high road: the upper terrace, left of it
      terrace: { e: [[150, -3], [400, -3], [440, 18], [530, 52]], h: 5, w: 3, s0: 150 },
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 15, 14), 4.6, 3.2, -0.2), sand(P(len + 10, -10), 3.8, 2.8, 0.3), sand(P(300, 40), 6, 4, 0)],
      green: { k: 1, lobes: [[0, 0, 11, 14, 25], [-6, 8, 6, 6]], apron: 3, contour: [{ fall: 120, pct: 1.7 }, { tier: [2, 5], up: 0, h: 0.4, w: 3 }], style: 'On the upper terrace, turned across the low road\'s approach, a back shelf; sand short right' },
      targets: [{ name: 'The lower terrace', at: P(240, 26) }, { name: 'The upper terrace', at: P(255, -20), bold: true }, { name: 'Short of the pond', at: P(348, 24) }],
      words: {
        story: 'The tea terraces: high road or low road through a valley of tea behind the monastery.',
        plays: 'A high valley of tea terraces behind the monastery. High road: carry the drive up onto the upper terrace on the left (30 m wide, 5 m up), from where the green is in view and reachable in two. Low road: the lower terrace on the right (50 m wide), then a lay-up short of a pond under the terrace wall and a pitch up to the green on the upper level. Off the upper terrace is only a drop to the lower one. No cliff edge anywhere. A pass with a flag-hung cairn beyond the green.',
        safe: 'Driver to the lower terrace (240 m), a lay-up short of the pond (348 m), a pitch up.',
        bold: 'Driver up onto the upper terrace (255 m), a wood at the green.',
        miss: 'Left of the upper terrace: tea bushes (rough). Short of the upper terrace or off its right side: the lower terrace, 5 m down. Right of the lower terrace: tea bushes. The pond under the wall on the low road\'s lay-up. At the green: sand short right.',
      },
      card: {
        type: 'Original (high road, low road)', form: 'Split (upper and lower terrace)', feature: 'The terrace wall (5 m); the tea rows; the pond under the wall; the cairn on the pass', job: 'The wall splits the hole (the decision); the tea rows a lie-setter; the pond a hazard on the low road; the cairn an aim point beyond the green',
        decision: 'High road or low road: the upper terrace (30 m wide, the green in view and reachable in two) or the lower (50 m, a lay-up short of the pond and a pitch up)',
        miss: 'Small: the other terrace. Medium: tea bushes. No penalty but the pond. Safe miss at the green: left',
        view: 'In front the valley climbing; in the middle the two terraces either side of the wall; beyond, the bend left and the pass with its cairn',
        ground: 'Stepped: two terraces 5 m apart along the line; +12 m tee to green',
        height: 'Stepped: high road, low road (bold)', dial: 'Length: reachable (plays about 505)', shots: { tee: 'A high carry up onto the terrace, or a draw down the lower', approach: 'A wood at a green, or a pitch up a bank' }, hazard: 'Diagonal: the terrace wall; the pond under it', surround: 'Sand short right; the terrace bank in front from the low road',
      },
    }),
  }),

  // 9. THE DESCENT: off a granite knoll and down three tiers zigzagging 54 m to the monastery's courtyard; safe: an iron to the first tier and
  // a wedge down; bold: driver straight at the golden roof
  hole({ n: 9, name: 'The Descent', par: 4, world: LINES[8], tips: [-82, 0], shape: 'A zigzag down three tiers',
    build: (P, L, len) => ({
      tees: { summit: -55, ridge: [14, -14], ledge: [56, 8], terrace: [96, 38] },   // the Summit tee on the knoll's lip (world.mjs KNOLL; Rhys, 16 November: too short)
      flat: 0,   // the tiers are the world's own ground (world.mjs tierAt)
      fw: [{ lobes: [[112, 2, 26, 22], [148, 14, 22, 20, 20]], join: 10, wob: 2.5 }, { lobes: [[234, -3, 30, 28], [262, -8, 22, 22, -10]], join: 10, wob: 2.5 }, { lobes: [[306, 0, 18, 14, 10]], join: 8, wob: 2 }],
      prof: [[0, 0], [len, 0]],
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 13, 15, 30], [7, -9, 8, 7], [-7, 8, 7, 7]], apron: 3.5, contour: [{ fall: 30, pct: 1.6 }, { bowl: [-1, 1], r: 10, h: 0.2 }], style: 'In the monastery\'s courtyard, walls on three sides, a gentle bowl in its middle; no sand: paving and the walls round it' },
      targets: [{ name: 'The first tier', at: P(118, 6) }, { name: 'The second tier', at: P(232, -4) }, { name: 'At the golden roof', at: L.at(-1), bold: true, pin: true }],
      words: {
        story: 'The descent: zigzag down three tiers to the monastery\'s courtyard, or drive straight at its golden roof.',
        plays: 'From a granite knoll, three tiers stepping 54 m down the eastern cliff\'s face to the monastery\'s courtyard, the golden roof straight ahead. Safe: an iron to the first tier and a wedge down (or two short irons tier by tier). Bold: driver straight at the golden roof, about 342 yd from the back tee, 54 m downhill, in thin air (a tour 5 iron finishes about 50 m short). Short or wide finishes on a tier or a ledge of rough below one, never in the mist. The courtyard walls on three sides hold everything.',
        safe: 'An iron to the first tier (173 m from the Summit tee), a wedge down to the green (or the second tier first).',
        bold: 'Driver at the golden roof: 312 m tee to pin, 54 m down.',
        miss: 'Short: a tier, or the bank below it (a downhill pitch). Wide: rough on the tiers\' ends. The courtyard walls hold anything long. Safe miss at the green: short.',
      },
      card: {
        type: 'Original (a switchback down a slope)', form: 'Stepping stones (three tiers)', feature: 'The three tiers and their banks; the courtyard walls; the golden roof', job: 'The tiers are lie-setters (a level stance on each); the walls helpers (they hold a long ball); the golden roof the aim point for the bold drive (it stands beside the green, never a target)',
        decision: 'Drivable par 4: a 312 m drive straight at the green, 54 m down, or an iron to the first tier and a wedge',
        miss: 'Small: a tier or a bank. Medium: rough on the tiers\' ends. Never the mist. Safe miss at the green: short',
        view: 'From the knoll over the top terrace the tiers step down in front, the courtyard and the golden roof below and beyond, the gorge on the right',
        ground: 'Stepped: the knoll 8 m over the top terrace, three tiers 15 m apart; −54 m tee to green',
        height: 'Stepped, a 54 m drop (bold)', dial: 'Height: 54 m down off a knoll and three tiers', shots: { tee: 'A mid iron to a number, or driver as hard as you like', approach: 'A wedge downhill' }, hazard: 'In front of each tier: the bank (across)', surround: 'Courtyard walls on three sides, paving; no sand',
      },
    }),
  }),
];
// the bold lines the plan book draws and flies: 5 over the notch, 8 up onto the terrace, 9 straight at the green
HOLES[4].boldPath = HOLES[4].targets.find(t => t.bold).at;
HOLES[7].boldPath = HOLES[7].targets.find(t => t.bold).at;
HOLES[8].boldPath = HOLES[8].pin;
HOLES[8].reliefLand = 118;   // relief.mjs reads the 9th's landing area at the first tier (its default, 229 m, falls on the second tier's bank)
