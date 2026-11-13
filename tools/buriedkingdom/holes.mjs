// The Buried Kingdom, plan book round 1: nine holes through an invented Egyptian site half-buried in drifted sand,
// in blazing late-morning light. The routing, the skeleton (par 36: 3 5 4 4 3 5 4 4 4) and the nine hole cards were
// approved by Rhys on 13 November 2026 (claude/buried-kingdom-layout.md in the project); this file draws them:
// real fairway outlines from the forms, green shapes, bunkers, heights, tee sets and tips spots.
// Three zones in order: the river (1-3), the plateau (4-6), the cliffs (7-9). Off the grass is sand in three bands:
// rough 8-15 m round every fairway and green, then firm wind-packed sand (the lie "Sand": it plays as the game's
// waste area, Rhys's pick), and soft dunes only as placed features (the lie "Dune": a bunker).
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the
// line, y up from the hole's `base`, the back tee's height). `route` turns the layout doc's world line ([x east,
// n north]) into `legs` and `place`. Heights along the line are drawn with `prof` (scene.mjs).
import { lineOf, lengthOf, at, YD, rnd } from './geo.mjs';

export const COURSE = {
  id: 'buriedkingdom', name: 'The Buried Kingdom', theme: 'kingdom', altFt: 250,
  signature: { time: 'late morning', light: 'blazing: hard sun, deep blue sky, short shadows, heat shimmer', wind: 'light, off the river (from the west)', weather: 'clear', temp: 'hot' },
  teeSets: [
    { id: 'falcon', name: 'Falcon', color: '#1f3f73', minDrive: 260 },
    { id: 'jackal', name: 'Jackal', color: '#262626', minDrive: 230 },
    { id: 'ibis', name: 'Ibis', color: '#f4f1e6', minDrive: 200 },
    { id: 'scarab', name: 'Scarab', color: '#2f9c84', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'cobra', name: 'Cobra', color: '#c2912e', minDrive: 290 },
  card: {
    hook: 'Golf through a kingdom the desert has swallowed. One logic: off the grass is sand in three bands (a little rough, then firm sand that plays like a waste area, soft dunes only where they are placed). You always find your ball: water is in play on the 1st and 2nd only.',
    skeleton: 'Par 36: 3 5 4 4 3 5 4 4 4, the first course to open with a par 3. The river (1-3), the plateau (4-6), the cliffs (7-9). No drop par 3, no climb to the clubhouse: the round ends downhill in the cliff temple\'s forecourt, at the expedition camp.',
    classics: 'Sahara (4: the blowout across the straight line), Lion\'s Mouth (5: a pit in the mouth of a horseshoe green), Hog\'s Back (6: a dune\'s crest). Set pieces: the lion\'s mouth (5) and a skyline green (6).',
    decisions: 'Three, each a different type: the long way round (4: over the Sand Sea or round it on grass), go or lay up (6: over the crest\'s blowout in two), centre-line hazard (9: left or right of the fallen obelisk). Never two in a row.',
    landmarks: 'The great pyramid, its top still cased in white (from 1 to 6); the Sphinx\'s head (4, 5, 6); the river\'s green line (back from 3, and from 4 and 6); the colossi (the 8th\'s terrace, the 9th). The reveal: the 4th tee, where the plateau opens.',
    rhythm: 'A gentle opener across the boat basin. The hardest run is 4 to 6 (the Sand Sea, the long par 3, the dune crest). The short 7th is the breather. The longest par 4 on any course, downhill, with the decision, to finish. Par 3s 145 and 200; par 4s 335, 385, 410, 435, 470; par 5s 500 and 590.',
    forms: 'Seven fairways, seven forms: 2 scalloped, 3 funnel, 4 hook, 6 broken, 7 a wide strip (on purpose: its interest is the lean), 8 fan, 9 island.',
    heights: 'No form twice: 1 level across a gulf, 2 dip in front, 3 a ramp (the causeway is the ramp), 4 valley carry, 5 uphill to a shelf, 6 hog\'s back to a perched green, 7 hillside bench off a 20 m tee, 8 table top, 9 fall-away. Bold: 4, 7 and 8.',
    dials: 'One pushed on every hole: 1 green size (about 950 m²), 2 length (590 yd), 3 width (36 m where the back tee\'s drive lands, soft both sides), 4 one hazard\'s scale (an 8,000 m² blowout: the hole past real golf), 5 green shape (a horseshoe round a pit), 6 green size (about 370 m² on the skyline), 7 bunker count (seven spoil pits), 8 height (a 6.5 m face), 9 length (470 yd).',
    newBorrowed: 'New to the register: a par 3 opener; a tee shot across still water with a beach; a causeway to play along; a dune-crest fairway; a skyline green; an amphitheatre green; a par 4 over 465 yd; no drop par 3. Borrowed (two): a relic in the ground (the Sphinx), one thing to play through (the 8th\'s gate).',
  },
};
export const BACK = 'falcon', FRONT = 'scarab';

// the layout doc's line ([x east, n north] tee, corners, pin) as a place and legs
function route(pts) {
  const b = pts.slice(1).map((p, i) => Math.atan2(p[0] - pts[i][0], p[1] - pts[i][1]) * 180 / Math.PI);
  const turn = (a, c) => ((c - a + 540) % 360) - 180;
  return { place: { at: [pts[0][0], -pts[0][1]], heading: (b[0] + 360) % 360 }, legs: pts.slice(1).map((p, i) => [Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), i ? turn(b[i - 1], b[i]) : 0]), world: pts };
}
// date palms: n round a point (tall bare trunks under a small crown: a ball flies under most of it)
const palms = (p, r, n, seed) => { const R = rnd(seed); return Array.from({ length: n }, () => { const a = R() * 6.283, d = Math.sqrt(R()) * r; return { kind: 'palm', x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: 2.6 + R() * 1.4, h: 13 + R() * 8 }; }); };
const blocks = (p, r, n, seed, sz = [1.5, 3.5]) => { const R = rnd(seed); return Array.from({ length: n }, () => { const a = R() * 6.283, d = Math.sqrt(R()) * r, s = sz[0] + R() * (sz[1] - sz[0]); return { at: [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], r: s, h: s * (0.6 + R() * 0.5) }; }); };

function hole(def) {
  const R = route(def.world), L = lineOf(R.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1); h.place = R.place; h.legs = R.legs;
  // a green's `k` scales its lobes about the pin (the outline is drawn first, then sized to the card's area)
  if (h.green.k) h.green.lobes = h.green.lobes.map(([u, v, rx, rz, rot = 0]) => [u * h.green.k, v * h.green.k, rx * h.green.k, rz * h.green.k, rot]);
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  // card yards: along the line on a par 4 or 5; on a par 3 straight from the pad to the pin (a pad beside the line)
  const yd = (v, p) => Math.round((def.par === 3 ? Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) : len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) h.yards[k] = yd(v, h.teePts[k]);
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = yd(tp, h.tipsPt);
  // a tips spot well off the line (the 8th's, beside the lip) is measured through the back tee
  if (def.par !== 3 && Math.abs(tp[1] || 0) > 10) { const b = h.teePts[BACK]; h.tipsYards = Math.round((h.yards[BACK] + Math.hypot(h.tipsPt[0] - b[0], h.tipsPt[1] - b[1]) / YD) / 5) * 5; }
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}

export const HOLES = [
  // 1. THE LANDING: you step off the boat. A mid iron from the old jetty across the royal boat basin to a big green
  // on the far quay; the beach round the basin's south-east is the bail-out and the forward tees' way in
  hole({ n: 1, name: 'The Landing', par: 3, world: [[0, 0], [131, 19]], tips: [-13, 0], shape: 'One shot, across the basin', hold: true,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: [9, 5], ibis: [51, 66], scarab: [86, 65] },
      corridor: 12,
      prof: [[0, 0], [60, 0], [len, 0.5]],
      // short grass on the quay in front of the green and round its right, toward the beach
      extraFw: [{ at: P(len - 10, 16), rx: 15, rz: 17, rot: 0.3 }],
      bunkers: [{ at: P(len + 24, -9), rx: 9, rz: 5, rot: 0.5 }],
      green: { k: 0.92, lobes: [[-1, 2, 14.5, 18.5, -22], [9, -11, 9.5, 9, 0], [-9, 14, 8, 7, 0]], join: 6, apron: 4, contour: [{ fall: 60, pct: 1.4 }, { tier: [-3, 7], up: 200, h: 0.45, w: 6 }], style: 'The biggest green of the nine, a long bean set from front right to back left on the quay, falling 1.4% toward the front right (the beach), its back-left third on a tier 0.45 m up: a front-right pin is a short iron at the beach, a back-left pin is over the corner of the basin' },
      trees: [...palms(P(len + 34, 14), 14, 7, 11), ...palms(P(len + 6, -44), 12, 5, 12)],
      targets: [],
      words: {
        story: 'The landing: you step off the boat at the old jetty and play across the royal boat basin to the far quay.',
        plays: 'The round starts on the river. From the old jetty the tee shot is a mid iron across the royal boat basin, a square of still water between stone quays 6 m high, to the biggest green on the course on the far quay. Date palms stand behind the flag and over them, far up on the plateau, the great pyramid\'s white top. The basin is short and left; round its south-east corner the quay has fallen in and the sand runs down to the water as a beach: that is the bail-out, right of the green, and the forward tees play from it with no carry at all.',
        safe: 'A mid iron at the middle of the green; if in doubt, right: the beach is firm sand and a chip.',
        bold: 'At a back-left pin on the tier, over the basin\'s corner.',
        miss: 'Short or left is the basin: a stroke and a drop. Right is the beach: firm sand, the ball may run down toward the water. Long is a dune bunker under the palms.',
      },
      card: {
        type: 'Original', form: 'None (par 3)', feature: 'The boat basin and its beach', job: 'Hazard (short and left) and the bail-out (the beach, right); the pyramid\'s white top behind the flag is the frame',
        decision: 'None: a gentle opener', miss: 'Small: the fringe and the quay\'s short grass. Medium: the beach right, the bunker long. Big: the basin, short and left (penalty on one side only). Safe miss: right',
        view: 'In front the jetty and the water; in the middle the far quay and the green; beyond, the palms and the pyramid\'s white top on the skyline. The green shows',
        ground: 'Level across a gulf: tee and green on quays about 6 m over the basin\'s water; the green falls 1.4% to the front right, a tier at the back left',
        height: 'Level, across a gulf', dial: 'The green: about 950 m² (the edge of real golf)', shots: { tee: null, approach: 'A high mid iron' }, hazard: 'Across: the basin', surround: 'The beach (firm sand)',
      },
    }),
  }),

  // 2. THE RIVER BANK: a true three-shotter along the river through the palm groves to the valley temple
  hole({ n: 2, name: 'The River Bank', par: 5, world: [[160, 90], [215, 380], [151, 616]], tips: [-36, 0], shape: 'Dogleg left',
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 28, ibis: [78, 52], scarab: [128, 64] },
      // scalloped: groves and old irrigation basins bite in from alternate sides, so the line weaves
      fw: [{ e: [[62, 22, 22], [110, 42, 42], [200, 49, 49], [300, 49, 49], [390, 46, 46], [455, 37, 37], [500, 24, 24], [524, 16, 16]], wob: 3.5 },
        { bite: [[150, -50, 34, 38], [248, 52, 36, 40], [346, -50, 34, 38], [438, 49, 30, 36]], wob: 2 }],
      corridor: 12,
      cant: [[110, 470, -2.2]],   // a little down to the left, toward the river (Rhys, 13 November)
      // gently up the bank; the dry canal in front of the green is a hollow 3 m deep
      prof: [[0, 0], [150, 0.3], [295, 0.7], [440, 1.5], [486, 1.6], [504, -1.7], [520, 1.7], [len, 2]],
      bunkers: [{ at: P(248, 52), rx: 37, rz: 31, job: 'target' }, { at: P(438, 49), rx: 33, rz: 26, job: 'approach' }],
      green: { k: 1.14, lobes: [[0, 1, 9.5, 14.5, 24], [5, 10, 6.5, 6, 0]], contour: [{ fall: 20, pct: 1.8 }, { tier: [0, 8], up: 180, h: 0.35, w: 6 }], style: 'A pear set from front left to back right, falling 1.8% toward the front, its back third on a tier 0.35 m up: the canal\'s hollow in front gathers anything short' },
      trees: [...palms(P(150, -50), 24, 18, 21), ...palms(P(346, -52), 24, 18, 22), ...palms(P(60, 60), 16, 7, 23), ...palms(P(520, -44), 14, 7, 24), ...palms(P(300, 76), 16, 6, 25), ...palms(P(len + 30, 30), 14, 6, 26)],
      targets: [{ name: 'The drive', at: P(232, -8) }, { name: 'The lay-up', at: P(400, 2) }],
      words: {
        story: 'The river bank: palm groves and the old irrigation works, with the valley temple at the end of it.',
        plays: 'A true three-shotter, 590 yd north along the river to the valley temple. The fairway is wide but nothing on it is straight: a palm grove bites in from the left, an old irrigation basin drifted full of soft sand from the right, a second grove from the left where the river bulges in behind 35 m of rough at the corner, and a second basin from the right where the lay-up wants to stop. The whole of it leans a little (2.2%) toward the river. A dry canal crosses in front of the green as a hollow 3 m deep, mown, that gathers anything short. The temple\'s pylon stands behind the green.',
        safe: 'Drive left of the first basin (232 m), lay up to a full wedge short of the second (400 m) and pitch over the canal.',
        bold: null,
        miss: 'Left, a grove: the palms knock a ball down, and beyond the second grove at the corner is the river (a stroke and a drop). Right, the basins: a dune lie. Short of the green, the canal\'s hollow: an uphill chip.',
      },
      card: {
        type: 'Long', form: 'Scalloped', feature: 'The groves and the drifted irrigation basins, biting in from alternate sides', job: 'Hazards that set the line of each shot; the canal\'s hollow is a helper; the lean toward the river makes the groves\' side the low side',
        decision: 'None: three full shots, each with a side to favour', miss: 'Small: the first cut, the low right side. Medium: a grove left, a basin right, the hollow. Big: the river, beyond the corner\'s grove on the left only. Safe miss at the green: short, in the hollow',
        view: 'In front the fairway between the first grove and the bank; in the middle the first basin on the right; beyond, the corner, and the pyramid\'s top over the palms. The landing area shows',
        ground: 'Dip in front: nearly level along the bank (+2 m in all: a river plain has no height), leaning 2.2% toward the river, then a hollow 3 m deep in front of the green',
        height: 'Dip in front', dial: 'The length: 590 yd (the edge of real golf)', shots: { tee: 'A draw round the first grove', approach: 'A lay-up to a number, then a full wedge over the hollow' }, hazard: 'Diagonal: groves and basins from alternate sides', surround: 'A collection hollow',
      },
    }),
  }),

  // 3. THE CAUSEWAY: dead straight up the processional way from the valley temple to the pyramid
  hole({ n: 3, name: 'The Causeway', par: 4, world: [[200, 652], [598, 656]], tips: [-30, 0], shape: 'Straight, uphill', tight: true, hold: true,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 10, ibis: [32, -30], scarab: [70, -58] },
      // a funnel: wide in the temple court, closing all the way up the causeway (it rewards laying back)
      fw: [{ e: [[74, 33, 33], [120, 35, 35], [170, 32, 32], [205, 27, 27], [222, 22, 22], [240, 18, 18], [300, 16, 16], [350, 13, 13], [376, 10, 10]], wob: 2.2 }],
      corridor: 9,
      // the causeway is the ramp: 22 m up in 400 m, its deck 2 m over the sand either side, kerb stones along its edges
      prof: [[0, 0], [70, 1.2], [len, 22]],
      deck: { h: 2, bank: 7, kerb: 0.35, from: 150 },
      bunkers: [],
      green: { lobes: [[0, 0, 11, 15.5, 0], [-7, 10, 7, 6, 0]], apron: 4, contour: [{ fall: 0, pct: 2.0 }, { bowl: [-5, 9], r: 11, h: 0.28 }], style: 'Square to the causeway with a wing at the back left, falling 2% toward the front, a shallow bowl in the wing: the pyramid\'s foot behind it is a bank of drifted sand that feeds a long ball back' },
      // the drift at the pyramid's foot: a bank behind the green that feeds
      forms: [{ at: P(len + 24, 0), rx: 34, rz: 9, rot: 0, h: 2.6, label: 'the drift' },
        // dunes drifted over the kerbs from alternate sides, so the deck rolls: high left, high right, high left
        { at: P(150, -46), rx: 40, rz: 56, rot: 0.25, h: 3.3, label: 'a dune' }, { at: P(256, 36), rx: 36, rz: 54, rot: -0.2, h: 3.6, label: 'a dune' }, { at: P(336, -31), rx: 31, rz: 44, rot: 0.15, h: 3.2, label: 'a dune' }],
      trees: [...palms(P(40, 52), 14, 6, 31), ...palms(P(20, -60), 12, 5, 32)],
      targets: [{ name: 'The court\'s end', at: P(212, 0) }],
      words: {
        story: 'The causeway: the processional way from the valley temple up to the pyramid, still the only way up.',
        plays: 'Dead straight up the processional way. The causeway climbs 22 m off the river plain to the pyramid in one even ramp, its deck 2 m over the sand on either side, kerb stones along both edges. It is wide in the temple\'s court and closes all the way up: 36 m where the Falcon tee\'s drive lands, 26 m at the green. Three dunes have drifted over the kerbs from alternate sides, so the deck rolls under you: high on the left in the court, high on the right where the Falcon drive lands, high on the left again on the approach, each about 2 m at the fairway\'s edge and nothing on the centre line. A running ball that drifts is turned back by the kerb; one that flies it drops 2 m to firm sand, a lie and never a stroke. No bunker. The great pyramid fills the sky behind the green, 30 m past the flag, sand drifted against its foot.',
        safe: 'Lay back to the court\'s end (212 m), where it is still about 50 m wide, and take one more club for the climb.',
        bold: null,
        miss: 'Off either side, 2 m down on firm sand: a pitch back up, the green above you. Long, the drift at the pyramid\'s foot rolls it back. Looking back from the green: the river\'s green line.',
      },
      card: {
        type: 'Original', form: 'Funnel', feature: 'The causeway itself: a raised deck with kerbs, the pyramid\'s face behind the green', job: 'Lie-setter (on it or 2 m below it); the kerbs and the drift at the pyramid\'s foot are helpers; the pyramid is the frame and the backstop',
        decision: 'None: one line; how far up the funnel is the only choice', miss: 'Small: held by the kerb. Medium: off the deck, 2 m down on firm sand. Big: the same, further off. No penalty ground, no bunker. Safe miss at the green: long',
        view: 'In front the temple court; in the middle the causeway narrowing up the frame; beyond, the pyramid, its top out of the frame. The landing area shows',
        ground: 'The causeway is the ramp: +22 m at an even 6%, 2 m over the sand; three dunes drifted over it lift one edge about 2 m (left at 150 m, right at 256, left at 336)',
        height: 'Ramp up (plain, for a reason: the causeway is the ramp)', dial: 'The width: 36 m where the back tee\'s drive lands, firm sand both sides (the tight fairway of the nine)', shots: { tee: 'Dead straight; a 3 wood for most', approach: 'A mid iron uphill, a club more' }, hazard: 'Down both sides: the drop off the deck', surround: 'A feeding bank: the drift at the pyramid\'s foot',
      },
    }),
  }),

  // 4. SAHARA: the reveal. The grass hooks round the Sand Sea; the straight line to the green crosses it
  hole({ n: 4, name: 'Sahara', par: 4, world: [[640, 590], [795, 545], [862, 367]], tips: [-30, -6], shape: 'Dogleg right round the Sand Sea', hold: true,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 16, ibis: [44, -34], scarab: [70, -44] },
      // a hook: the fairway wraps the blowout's north and east; the far fairway runs out to the blowout's rim, 80 m wide
      fw: [{ lobes: [[106, -6, 36, 23, 0], [152, -10, 34, 27, 18], [200, 2, 34, 30, 0], [246, 12, 40, 38, 0], [284, 10, 36, 40, 0], [322, 2, 22, 15, 0]], join: 20, wob: 3.5 }],
      corridor: 11,
      prof: [[0, 0], [160, 0.4], [300, 1.3], [len, 2]],
      cant: [[120, 300, 2.5]],   // the grass leans a little toward the blowout
      forms: [{ at: P(158, -46), rx: 30, rz: 62, rot: 0.5, h: 4.2, label: 'a dune' }, { at: P(252, -34), rx: 36, rz: 50, rot: 0.1, h: 3.6, label: 'a dune' }, { at: P(306, 42), rx: 25, rz: 33, rot: -0.3, h: 2.6, label: 'a dune' }],
      bunkers: [{ at: P(len - 30, -16), rx: 9, rz: 12, rot: -0.2 }],
      green: { k: 1.065, lobes: [[0, 0, 11.5, 16, 28], [-6, -11, 7, 6.5, 0]], apron: 7, contour: [{ fall: 45, pct: 1.7 }, { tier: [2, 5], up: -150, h: 0.4, w: 5 }], style: 'Set from front left to back right, open from the right (the Sand Sea side) and guarded on the left by a dune bunker, falling 1.7% toward the front right with a shelf at the back left; a tight run-off all round' },
      trees: [],
      targets: [{ name: 'Round on the grass', at: P(196, 0) }, { name: 'Over the Sand Sea', at: P(268, 36), bold: true }],
      words: {
        story: 'The Sand Sea: where the plateau opens, a blowout of soft sand the size of a city block lies between you and the green.',
        plays: 'The reveal. From the 4th tee the plateau opens: dunes in long ridges to the horizon, the great pyramid over your left shoulder, the Sphinx\'s head on the skyline to the right, and straight in front the Sand Sea, a blowout 9 m deep and 8,000 m² across, bigger than anything on a real course. The grass hooks round its north and east rim, between dunes: one banked round the outside of the corner, one whose shoulder lies across the left of the far fairway, a low one beyond the bold landing. The straight line to the green crosses it: carry about 215 yd of soft sand to a far fairway 80 m wide and you have a wedge into the open side of the green. Round on the grass is safe all the way and leaves about 170 yd over a dune bunker.',
        safe: 'Round on the grass to the corner (196 m): no sand to carry, a mid iron left over the dune bunker.',
        bold: 'Over the Sand Sea (carry about 215 yd from the Falcon tee) to the far fairway: about 105 yd left, the green open.',
        miss: 'Short on the bold line, the ball rolls to the blowout\'s floor: a dune lie 9 m down, not a penalty. Left of the safe line, dunes and firm sand. Round the green, short grass that runs a ball away.',
      },
      card: {
        type: 'Sahara', form: 'Hook', feature: 'The Sand Sea, a blowout of soft sand', job: 'Hazard on the straight line; the aim is its far rim',
        decision: 'The long way round: over the blowout is about 40 yd shorter and opens the green, with a 9 m deep dune lie for a short one; round on grass has no carry and leaves 170 yd over a bunker',
        miss: 'Small: the first cut. Medium: firm sand left, the bunker by the green. Big: the blowout\'s floor (a lie, never a stroke). No penalty ground. Safe miss at the green: right',
        view: 'In front the tee\'s dune and the near fairway; in the middle the Sand Sea and the far fairway beyond its rim; beyond, the dune sea. Both lines show',
        ground: 'Valley carry on the bold line: level tee and far fairway at 31 m, the blowout\'s floor 9 m below between them; the safe line is level along its length, leaning 2.8% toward the blowout, with a dune banked 4 m round the outside of the corner and a dune shoulder lifting the far fairway about 2 m on its left; +2 m to the green',
        height: 'Valley carry', dial: 'One hazard\'s scale, past real golf: an 8,000 m² blowout', shots: { tee: 'A high carry (bold), or a fade round the rim', approach: 'A wedge to the open side, or a mid iron over the dune bunker' }, hazard: 'Diagonal: the blowout across the straight line', surround: 'A tight run-off', setPiece: null,
      },
    }),
  }),

  // 5. THE SPHINX: a long iron up to a horseshoe green between the paws, a pit in its mouth, the head over it
  hole({ n: 5, name: 'The Sphinx', par: 3, world: [[885, 315], [765, 177]], tips: [-16, 0], shape: 'One shot, uphill', hold: true,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: [18, 6], ibis: [46, -12], scarab: [82, -15] },
      corridor: 12,
      prof: [[0, 0], [105, 0.6], [140, 2.8], [158, 6.6], [len, 7]],
      // the paws: two long banks either side of the green that feed a near miss in
      forms: [{ at: P(len - 9, -29), rx: 6.5, rz: 27, h: 3.4, p: 3, stone: true, label: 'a paw' }, { at: P(len - 9, 29), rx: 6.5, rz: 27, h: 3.4, p: 3, stone: true, label: 'a paw' }],
      // the pit in the lion's mouth
      bunkers: [{ at: P(len - 15, 0), rx: 4.2, rz: 6.5, pot: true }],
      green: { k: 0.815, lobes: [[0, 5, 20, 9.5, 0], [-15, -8, 7, 14.5, 0], [15, -8, 7, 14.5, 0]], join: 4, wob: 1.2, apron: 3, contour: [{ fall: 0, pct: 1.5 }, { bowl: [0, 7], r: 14, h: 0.25 }], style: 'A horseshoe between the paws, open toward the tee, a real pit in its mouth: three pin areas, the left arm, the right arm and the back, the back gathering a little' },
      trees: [],
      targets: [],
      words: {
        story: 'The Sphinx: it lies facing you, half buried, and the green is between its paws.',
        plays: 'A long iron, 200 yd, up 7 m to a shelf between the Sphinx\'s paws. It lies facing the tee, sand drifted to its shoulders, the head 25 m over the green. The green is a horseshoe open toward you, with a real pit in its mouth: a pin on the left arm, the right arm or across the back makes three different shots. The paws are two long banks that feed a near miss in from either side, and the chest stops a long one. Short left or short right is firm sand below the shelf.',
        safe: 'At the back of the horseshoe, over the pit: anything a little long comes back off the chest.',
        bold: 'At a pin on one arm, with the pit beside it.',
        miss: 'In the pit: a dune lie, steep, below the green. Wide, the paw\'s bank kicks it in or holds it up on the far side. Short, firm sand under the shelf and a pitch up.',
      },
      card: {
        type: 'Lion\'s Mouth', form: 'None (par 3)', feature: 'The Sphinx: paws, chest and head', job: 'The paws are helpers (banks that feed), the chest a backstop, the head the aim point and the frame (25 m over the green: about 50 px from the tee)',
        decision: 'None: a par 3; the pin decides the shot', miss: 'Small: fed in by a paw. Medium: the pit, the firm sand short. Big: beyond a paw. No penalty ground. Safe miss: long',
        view: 'In front the firm sand rising; in the middle the shelf, the paws and the flag; beyond, the Sphinx\'s head against the sky. The green\'s front and the flag show',
        ground: 'Uphill to a shelf: +7 m, most of it in the last 45 m; the paws 3.4 m high either side; the green falls 1.5% to the front',
        height: 'Uphill par 3, to a shelf', dial: 'The green\'s shape: a horseshoe round a pit', shots: { tee: null, approach: 'A long iron or hybrid that carries the pit' }, hazard: 'In front of the green: the pit', surround: 'Feeding banks: the paws', setPiece: 'Lion\'s mouth',
      },
    }),
  }),

  // 6. HOG'S BACK: straight down a dune's knife crest to a small green perched on the skyline
  hole({ n: 6, name: 'Hog\'s Back', par: 5, world: [[820, 110], [790, -150], [704, -326]], tips: [-36, 0], shape: 'Dogleg right along the crest', hold: true, endFade: 16,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 22, ibis: 44, scarab: [96, -38] },
      // broken: the crest's fairway, a blowout across it, then a short neck up to the green
      fw: [{ e: [[72, 15, 15], [130, 22, 22], [200, 24, 23], [262, 23, 25], [320, 23, 22], [352, 18, 18]], wob: 2.5 },
        { e: [[404, 17, 17], [424, 16, 16], [440, 12, 12]], wob: 2, seed: 61 }],
      corridor: 9,
      // the crest: crowned, 5.5 m down at 38 m either side; up 4 m along it, a dip at the blowout, then 5.5 m up to the green
      cross: [[50, 432, -5.5, 38]],
      prof: [[0, 0], [120, 2.4], [262, 4], [352, 3.6], [380, 2.6], [410, 3.6], [428, 5], [447, 9], [len + 12, 9]],
      bunkers: [{ at: P(378, 0), rx: 38, rz: 25, rot: 0.34, depth: 3, job: 'cross' }],
      green: { k: 1.03, lobes: [[0, 0, 8.8, 12.2, 14], [-4, 8, 5, 4.5, 0]], apron: 3, contour: [{ fall: 0, pct: 1.6 }], style: 'The smallest green of the nine, an egg on the crest with nothing behind it but sky, falling 1.6% toward the front: the dune drops away on three sides' },
      trees: [],
      targets: [{ name: 'The spine', at: P(244, 0) }, { name: 'Short of the blowout', at: P(336, 0) }], goGreen: true,
      words: {
        story: 'The hog\'s back: a single great dune, and the hole plays along its knife crest to a green on the skyline.',
        plays: 'Straight down the crest of one great dune, 500 yd, bending right with it. Only the spine holds a ball: the fairway is 45 m wide and crowned, and a loose drive is shed down a flank, 4 to 6 m, to firm sand and a pitch back up. About 85 yd short of the green a blowout has cut through the crest. Past it a neck of grass climbs to the smallest green on the course, perched 9 m over the tee on the skyline with nothing behind it; the dune falls away on three sides. From the crest the Sphinx\'s head is behind you to the right and the river\'s green line far off to the west.',
        safe: 'Drive down the spine (244 m), lay up short of the blowout (336 m) and wedge on.',
        bold: 'Go in two: a long second over the blowout to a 370 m² green on the skyline.',
        miss: 'Off the crest either side: 4 to 6 m down on firm sand, a blind pitch back. In the blowout: a dune lie. Over the green: down the dune\'s back, a long way.',
      },
      card: {
        type: 'Hog\'s Back', form: 'Broken (the blowout across the crest)', feature: 'The dune\'s crest', job: 'Lie-setter: on the spine a level stance, off it a pitch from 5 m below; the crown itself is the hazard',
        decision: 'Go or lay up: reachable in two for a long hitter, over the blowout to a small skyline green with drops on three sides; the lay-up leaves a wedge',
        miss: 'Small: the fairway\'s shoulder. Medium: shed down a flank to firm sand, or the blowout. Big: the foot of the dune. No penalty ground. Safe miss at the green: short, on the neck',
        view: 'In front the crest running away; in the middle the spine narrowing to the blowout; beyond, the green on the skyline. The landing area shows',
        ground: 'Hog\'s back to a perched green: the crest crowned 5.5 m over 38 m either side, rising 4 m along the hole, then 5.5 m up in the last 30 m to the green (+9 m in all)',
        height: 'Hog\'s back, perched green', dial: 'The green: about 370 m² on the skyline (small; the edge of real golf)', shots: { tee: 'Dead straight, down the spine', approach: 'A wedge up to the skyline, or a wood over the blowout' }, hazard: 'In front of the green: the blowout across the crest', surround: 'A drop on three sides', setPiece: 'Skyline green',
      },
    }),
  }),

  // 7. THE QUARRY: off the plateau's lip, 20 m down to a fairway benched along the quarry's spoil slope
  hole({ n: 7, name: 'The Quarry', par: 4, world: [[735, -400], [870, -415], [1039, -390]], tips: [-26, -4], shape: 'Dogleg left along the bench', hold: true, flat: 46, fade: 44,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: [9, -11], ibis: [80, -24], scarab: [118, -44] },
      // a wide strip, on purpose: the hole's interest is the 9% lean and the seven pits along its low edge
      fw: [{ e: [[100, 25, 25], [140, 30, 30], [200, 31, 31], [250, 30, 30], [278, 24, 24], [290, 17, 17]], wob: 2.2 }],
      corridor: 10,
      // off the lip: 20 m down inside 90 m, then the bench level for 80 m and climbing 6 m into the green
      prof: [[0, 0], [7, -0.2], [62, -17.5], [96, -20], [176, -20], [250, -18], [284, -15], [len, -14]],
      cant: [[104, 286, 9]],   // 9% down to the right, toward the quarry
      // seven spoil pits along the low edge
      bunkers: [...[[128, 33, 6, 4.5], [152, 38, 5, 5.5], [177, 37, 6.5, 4.5], [203, 39, 5, 5], [228, 37, 6, 5.5], [252, 36, 5.5, 4.5], [274, 31, 5, 4.5]].map(([s, o, rx, rz], i) => ({ at: P(s, o), rx, rz, rot: i * 0.6, pot: true, job: 'spoil pit' }))],
      green: { lobes: [[0, 0, 9.5, 13.5, -24], [6, 8, 6.5, 5.5, 0]], apron: 3, contour: [{ fall: 80, pct: 2.0 }, { ridge: [[5, -11], [10, 7]], h: 0.3, w: 2.6 }], style: 'Set from front right to back left along the slope, so it opens from the high (left) side of the fairway, falling 2% toward the quarry with a spine down its right side; the quarry\'s cut back wall behind kicks a long ball down onto it' },
      trees: [],
      boulders: [...blocks(P(150, 60), 14, 5, 71, [1.5, 3]), ...blocks(P(240, 62), 14, 5, 72, [1.5, 3])],
      targets: [{ name: 'The high side', at: P(226, -12) }],
      words: {
        story: 'The quarry: where the kingdom\'s stone was cut, an obelisk still lying unfinished in the pit.',
        plays: 'The breather, and the drop. From the plateau\'s lip the tee shot falls 20 m to a fairway benched along the quarry\'s spoil slope: 60 m wide where drives land, and leaning 9% to the right, toward the pit. Seven spoil pits along the low edge catch a ball before it reaches the quarry floor, which is firm sand and a pitch back up, never a penalty. The unfinished obelisk lying in the quarry is the aim point: start it there and let it draw into the slope. The bench climbs 6 m into a green set along the hill, open from the high side; the quarry\'s cut back wall stands behind it.',
        safe: 'A draw that holds the slope, to the high side (226 m), and a short iron from a hanging lie.',
        bold: null,
        miss: 'Right, the slope takes it to a spoil pit (a dune lie) or past them to the quarry floor (firm sand, 8 m down). Left, the plateau\'s slope: firm sand above the fairway, the ball above your feet. Long, the back wall kicks it down.',
      },
      card: {
        type: 'Original', form: 'A wide strip, on purpose', feature: 'The spoil slope and its seven pits; the unfinished obelisk in the quarry', job: 'Lie-setter (every second shot hangs) and catch bunkers that save a ball from the floor (helpers); the obelisk is the aim point; the back wall a backstop',
        decision: 'None: not drivable (the climb and the green\'s angle), one line', miss: 'Small: runs to the low half. Medium: a spoil pit, the high side\'s sand. Big: the quarry floor (a pitch up, never a stroke). No penalty ground. Safe miss at the green: left and long',
        view: 'From the lip: in front the drop; in the middle the bench and its pits, the obelisk in the quarry right of it; beyond, the green under the back wall and the wadi\'s cliffs. The first 80 m under the lip are hidden; the landing area shows',
        ground: 'Hillside bench off a 20 m tee: the bench level where drives land, then climbing 6 m; 9% down to the right; the low side soft (pits, then firm sand)',
        height: 'Hillside bench', dial: 'The bunker count: seven spoil pits along the low side (a field)', shots: { tee: 'A draw into the slope', approach: 'A short iron from a hanging lie, the ball below your feet' }, hazard: 'Down a side: the pits and the quarry', surround: 'Bunkers below, the wall behind',
      },
    }),
  }),

  // 8. THE GATE: up the wadi floor and onto a temple terrace through the ruined gateway
  hole({ n: 8, name: 'The Gate', par: 4, world: [[1035, -440], [1100, -665], [1091, -805]], tips: [-14, 14], shape: 'Dogleg right, up onto the terrace', hold: true, mown: 0.5, flat: 60, fade: 40,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 40, ibis: [74, -30], scarab: [86, 30] },
      // a fan: tight in the wadi, through the gate, wide on the terrace
      fw: [{ e: [[72, 10, 10], [112, 15, 15], [156, 21, 21], [198, 24, 24], [218, 24, 24], [232, 21, 21], [252, 33, 33], [286, 37, 37], [322, 30, 30], [350, 19, 19], [362, 12, 12]], wob: 2.2 }],
      corridor: 10,
      // the wadi floor dips a metre to the face's foot; the terrace is a table 6.5 m up, its face 217 m out
      prof: [[0, 0], [120, -0.5], [205, -1], [len + 40, -1]],
      cant: [[90, 196, 2.2]],   // the wadi floor leans a little to the right, toward its dry bed
      table: { s0: 217, s1: len + 62, L: -68, R: 68, h: 6.5, face: 21 },
      gate: { s: 229, off: 25.5, w: 9, l: 8, h: 22 },
      bunkers: [{ at: P(168, -28), rx: 12, rz: 16, rot: -0.2, job: 'catch' }],
      green: { k: 1.02, lobes: [[0, 0, 10.5, 15, 22], [-6, 9, 7, 6, 0]], apron: 6, contour: [{ fall: 30, pct: 1.6 }, { tier: [-2, 6], up: 200, h: 0.4, w: 5 }], style: 'Set from front left to back right on the terrace, falling 1.6% toward the front with a shelf across the back; short grass runs off the back toward the terrace\'s edge' },
      trees: [],
      boulders: [...blocks(P(120, 44), 12, 5, 81, [1.5, 3.5]), ...blocks(P(150, -52), 12, 5, 82, [1.5, 3.5])],
      targets: [{ name: 'Up on the terrace', at: P(246, 0) }, { name: 'Below the face', at: P(165, 0) }],
      words: {
        story: 'The gate: a ruined gateway on the lip of a temple terrace, its two towers still standing.',
        plays: 'Up the wadi between its rock walls and onto a temple terrace. The terrace\'s face crosses the hole 217 m out, 6.5 m high, grass up it, and on its lip stands the ruined gateway: two towers 22 m tall, 42 m of fairway between them, the marker for the drive. Carry the face (about 245 yd from the Falcon tee) between the towers and the terrace is wide and flat, with a short iron left. Come up short and you are on the lower landing area with a blind mid iron up through the gate. The fairway is tight in the wadi and fans out on top: one line, and the reward is for length.',
        safe: 'Below the face (165 m, a clear 40 m short of its foot) if the carry is out of reach: the lower fairway is 44 m wide, then a mid iron up through the gate.',
        bold: 'Carry the face between the towers (the lip is 228 m out; aim 246 m) for a flat lie and a short iron.',
        miss: 'Into the face: it stops below the top, on grass. Wide of the gate, a tower: solid, the ball drops at its foot. Left in the wadi, a dune bunker; beyond it scree at the wall\'s foot. Long at the green, short grass toward the terrace\'s back edge.',
      },
      card: {
        type: 'Original (an Alps turned on its side: the blind shot is the second, from below)', form: 'Fan', feature: 'The terrace\'s face and the gateway\'s two towers', job: 'The face is the lie-setter (on top a flat stance and a short iron, below a blind mid iron); the towers are the marker on the lip and an obstacle for a wide drive',
        decision: 'None: one line; the reward is for length', miss: 'Small: the first cut. Medium: the face, the wadi\'s bunker, a tower\'s foot. Big: the scree under the walls. No penalty ground. Safe miss at the green: short',
        view: 'In front the wadi floor between its walls; in the middle the face across the hole with the two towers on its lip; beyond, the cliffs. The face, the lip and the towers show; the top itself doesn\'t (a table top with a marker: not blind). The second from below is one of the nine\'s blind shots',
        ground: 'Table top: the wadi floor nearly level for 205 m, then a 6.5 m face inside 21 m onto a terrace level to the green and beyond (+5.5 m in all)',
        height: 'Table top', dial: 'The height: a 6.5 m face across the fairway', shots: { tee: 'A high carry between the towers', approach: 'A short iron from the top, or a blind mid iron from below' }, hazard: 'Across: the face', surround: 'A tight run-off behind',
      },
    }),
  }),

  // 9. THE COLOSSI: the longest par 4, down the wadi into the temple forecourt under four seated colossi
  hole({ n: 9, name: 'The Colossi', par: 4, world: [[1110, -850], [1330, -930], [1507, -847]], tips: [-30, 16], shape: 'Dogleg left, down to the forecourt', hold: true, flat: 60, fade: 40,
    build: (P, L, len) => ({
      tees: { falcon: 0, jackal: 24, ibis: [64, 34], scarab: [104, 42] },
      // an island: one fairway with the fallen obelisk lying in the middle of it at the corner; 25 m left of it, 40 m right
      fw: [{ e: [[72, 16, 16], [130, 24, 27], [190, 29, 41], [236, 31, 48], [282, 27, 41], [330, 22, 27], [380, 18, 19], [406, 14, 14], [416, 10, 10]], wob: 2.5 },
        { bite: [[236, 0, 31, 6.5, 0]], wob: 0.8 }],
      corridor: 10,
      obelisk: { s0: 207, s1: 265, t: 4 },
      // gently down the wadi, then the forecourt falls away: 4 m in the last 45 m
      prof: [[0, 0], [234, -3], [330, -5], [372, -6], [414, -9.7], [len + 20, -10]],
      cant: [[150, 300, -2.6]],   // the wadi's floor leans left, toward the wall
      // the forecourt's banks: left of the green and behind it
      forms: [{ at: P(len + 6, -27), rx: 9, rz: 26, rot: 0.25, h: 2.6, label: 'the bank' }, { at: P(len + 27, 2), rx: 24, rz: 8, h: 2.4, label: 'the bank' }],
      bunkers: [{ at: P(len - 27, 17), rx: 10, rz: 13, rot: 0.2 }],
      green: { k: 1.04, lobes: [[0, 0, 12.5, 19.5, 13], [-8, 9, 8, 7, 0]], apron: 4, contour: [{ fall: 190, pct: 1.3 }, { bowl: [-7, 11], r: 11, h: 0.28 }], style: 'Long and deep, its axis toward the left lane, falling 1.3% away from you toward the back (land it short and let it release), a bowl in the back left under the forecourt\'s bank: from the right lane the approach crosses a dune bunker' },
      trees: [],
      boulders: [...blocks(P(150, -56), 12, 5, 91, [1.5, 3.5]), ...blocks(P(300, 62), 12, 5, 92, [1.5, 3.5])],
      targets: [{ name: 'Right of the obelisk', at: P(244, 27) }, { name: 'Left of the obelisk', at: P(266, -18), bold: true }, { name: 'Short of the forecourt', at: P(352, 0) }],
      words: {
        story: 'The colossi: four seated kings 30 m tall at the cliff temple\'s door, and a fallen obelisk in the fairway on the way down to them.',
        plays: 'The longest par 4 on any course, 470 yd, and downhill: off the terrace\'s back edge, down the wadi and round to the left into the cliff temple\'s forecourt, where four seated colossi 30 m tall watch the last green and the expedition\'s camp stands beside it. At the corner a fallen obelisk lies in the middle of the fairway in three pieces. Left of it the lane is 25 m wide under the wadi\'s wall, and from there you play down the length of the green. Right of it is 40 m wide, and the approach comes in across a dune bunker. The forecourt falls away 4 m to the green: land the long second short and let it run. Banks left of the green and behind it feed a ball back.',
        safe: 'Right of the obelisk (244 m): room to miss, then a long iron landed short of the bunker\'s line.',
        bold: 'Left of the obelisk (240 m), under the wall: shorter, and the green\'s whole length in front of you.',
        miss: 'On the obelisk: solid, the ball stops beside it on grass. Left of the left lane, scree under the wall. Right, firm sand. At the green: the bunker front right; left and long, the banks bring it back.',
      },
      card: {
        type: 'Original', form: 'Island (the obelisk in the middle of the fairway)', feature: 'The fallen obelisk; the colossi and the forecourt', job: 'The obelisk is the obstacle that splits the drive; the forecourt\'s fall-away and banks are helpers; the colossi are the frame for the finish',
        decision: 'Centre-line hazard: left of the obelisk is 25 m wide under the wall, shorter, with the green\'s long axis; right is 40 m wide with the approach across a dune bunker',
        miss: 'Small: the first cut, the wrong lane. Medium: beside the obelisk, the scree left, firm sand right, the bunker. Big: under the wall. No penalty ground. Safe miss at the green: long or left, into a bank',
        view: 'In front the wadi falling away; in the middle the obelisk\'s pieces in the fairway at the corner; beyond, the wadi\'s far wall (the colossi come into view from the landing area). Both lanes show',
        ground: 'Fall-away: 3 m down to the corner, then the forecourt falls 4 m in the last 45 m to a green that runs away from you (-10 m in all); banks left and behind',
        height: 'Fall-away', dial: 'The length: 470 yd, the longest par 4 on any course (past the edge of real golf, downhill)', shots: { tee: 'A draw, to one side of the obelisk', approach: 'A long iron landed short, running on' }, hazard: 'The centre: the fallen obelisk', surround: 'Feeding banks',
      },
    }),
  }),
];

// the bold lines, and the line the height form is read on where it isn't the playing line
{
  HOLES[3].boldLine = [[0, 0], at(HOLES[3].line, 268, 36)];
  HOLES[3].reliefLine = [[0, 0], at(HOLES[3].line, 268, 36), HOLES[3].pin];   // the valley carry is on the bold line
  HOLES[3].formLine = [[0, 0], HOLES[3].pin];   // a hook is read against the straight line to the green, which the fairway wraps round
  HOLES[8].boldLine = [[0, 0], at(HOLES[8].line, 240, -20)];
}
