// Emerald Bay, plan book round 1: an invented bay of limestone islands (the Krabi / Koh Phi Phi look). The concept,
// the skeleton (par 36: 5 3 3 5 4 4 4 3 5), the routing (a chain of islands wrapped once round the bay) and the nine
// hole cards were approved by Rhys on 15 November 2026 (claude/emerald-bay-layout.md in the project); round 0 settled
// the tide (rolled each round like the pins, shown and changeable on the setup screen), the three sands and an uneven
// Sandbar (claude/status-emerald-bay.md). This file draws them: fairway outlines from the forms, green shapes, the
// four tee sets and the Shark tips spot on every hole, targets, and a version for each tide on 3, 5 and 9.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the line,
// y up from the hole's `base`, the back tee's height). `route` turns the layout doc's world line ([x east, n north])
// into `legs` and `place`; `L(x, n)` turns a world point into the hole's frame. The ground is the world's own
// (world.mjs V): the islands are shaped round their holes there.
import { lineOf, lengthOf, at, headingAt, YD } from './geo.mjs';
import { LINES, TIDES } from './world.mjs';

export const COURSE = {
  id: 'emeraldbay', name: 'Emerald Bay', theme: 'bay', altFt: 0, wallSoak: 0.45,
  signature: { time: 'late morning', light: 'a high bright sun, hard shade under the cliffs, the water at its most turquoise', wind: 'light, off the sea', weather: 'clear', temp: 'hot' },
  teeSets: [
    { id: 'marlin', name: 'Marlin', color: '#1f4e79', minDrive: 260 },
    { id: 'manta', name: 'Manta', color: '#2a8c8c', minDrive: 230 },
    { id: 'turtle', name: 'Turtle', color: '#5f8f3a', minDrive: 200 },
    { id: 'clownfish', name: 'Clownfish', color: '#e8772e', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'shark', name: 'Shark', color: '#5b6670', minDrive: 290 },
  // the tide (round 0, Rhys's picks): rolled at random each round like the pins, shown and changeable on the setup
  // screen; one mechanism with the Labyrinth's doors (COURSE.rolls, hole.versions, hole.versionBy)
  rolls: [{ id: 'tide', name: 'Tide', options: [{ id: 'low', name: 'Low tide', sea: TIDES.low }, { id: 'high', name: 'High tide', sea: TIDES.high }] }],
  card: {
    hook: 'A warm bay crowded with limestone islands: sheer cliffs hung with stalactites, jungle on top, white sand and clear turquoise water below. Two logics: sand is always playable and water is a stroke (cliffs give the ball back, as on Cloudrest), and the tide is high or low each round (holes 3, 5 and 9 change with it).',
    skeleton: 'Par 36: 5 3 3 5 4 4 4 3 5, three par 3s and three par 5s. A chain of islands curled once round one bay, so most holes look across the water at others: the village island (1), headland to islet (2), islet to the big island (3), along its shore (4), the Sandbar to island C (5), over its saddle (6), round its cove (7), out to the sea stack (8), across the flats and through the sea cave into the hollow island (9).',
    classics: 'Cape (4: three coves to bite off). Alps (6: a blind second over the saddle). Set piece: island green (2, an islet ringed with sand). Its own: a sandbar fairway (5), a beach hole under a leaning cliff (7), a sea-stack green (8), a green inside a hollow island through a sea cave (9).',
    decisions: 'Three, three types: bite off what you dare (4: carry the coves and it is reachable in two), drivable par 4 (7: straight across the cove), go or lay up (9: at low tide, the cave from the flats).',
    landmarks: 'The sea stack (from 1, 4, 5, 7, 9; played at 8); the great overhang (from 4 and 5; played under at 7); the cave mouth in the hollow island (from 1, 4, 8). From the 4th you look across at 1, 7, 8 and 9 at once. The reveal: out of the cave on the 9th into the lagoon.',
    rhythm: 'A reachable par 5 to open; two par 3s over water; the long shore hole (the hardest); the Sandbar; the Saddle; a short beach hole; the stack; the lagoon. Par 3s 130, 165, 200; par 4s 320, 400, 445; par 5s 510, 545 (589 at high tide), 585.',
    forms: 'Six fairways, six forms: 1 fan (the palm valley opening to the beach), 4 scalloped by its coves (it reads as a funnel: one sweep over the land between the first two coves, closing to the green), 5 strip (the Sandbar: the course\'s one plain strip), 6 island (a doughnut round the pinnacle), 7 hook (round the cove), 9 broken (the flats, the channel, the cave beach).',
    heights: '1 half-pipe (the palm valley), 2 drop (the only one: 20 m headland to islet), 3 level across the water, 4 hillside bench, 8% across (bold), 5 level (the bar), 6 up and over the saddle (bold), 7 level (a beach), 8 uphill to a rock top, 9 dip in front (the tidal channel).',
    dials: 'One pushed on every hole: 1 length (a reachable par 5 to open), 2 a carry (headland to islet, all water), 3 the tide (a sand tongue short of the green at low water), 4 one hazard\'s scale (three coves), 5 width (the bar: 42 m of grass, wider sand at low water), 6 height (between two towers 200 m tall), 7 length (drivable across the cove), 8 green size (320 m² on a sea stack), 9 scale (through a sea cave 40 m high into a lagoon).',
    newBorrowed: 'New to the register: the first tropical course; a tide that changes holes; a sandbar fairway; a green inside a hollow island; a sea-stack green; a beach hole under a cliff. Borrowed (two): something to play through (the sea cave), a tee shot off a height (the Leap). No waterfall, bridge, punchbowl or climb to the clubhouse.',
  },
};
export const BACK = 'marlin', FRONT = 'clownfish';
export const TIDE_HOLES = [3, 5, 9];

// the layout doc's line ([x east, n north] tee, corners, pin) as a place and legs
function route(pts) {
  const b = pts.slice(1).map((p, i) => Math.atan2(p[0] - pts[i][0], p[1] - pts[i][1]) * 180 / Math.PI);
  const turn = (a, c) => ((c - a + 540) % 360) - 180;
  return { place: { at: [pts[0][0], -pts[0][1]], heading: (b[0] + 360) % 360 }, legs: pts.slice(1).map((p, i) => [Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), i ? turn(b[i - 1], b[i]) : 0]), world: pts };
}
// a world line cut short at s metres (the pin moved back along the last leg)
function cut(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, an] = pts[i], [bx, bn] = pts[i + 1], l = Math.hypot(bx - ax, bn - an);
    if (acc + l >= s) { const t = (s - acc) / l; return [...pts.slice(0, i + 1), [ax + (bx - ax) * t, an + (bn - an) * t]]; }
    acc += l;
  }
  return pts;
}
// a world point [x east, n north] in a hole's frame
const localOf = place => (x, n) => {
  const a = place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a), dx = x - place.at[0], dz = -n - place.at[1];
  return [dx * rx + dz * rz, -(dx * fx + dz * fz)];
};
const plen = P => P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
function hole(def) {
  const R = route(def.pinS ? cut(def.world, def.pinS) : def.world), L = lineOf(R.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o), Lw = localOf(R.place);
  const h = def.build(P, L, len, Lw);
  h.line = L; h.len = len; h.pin = L.at(-1); h.place = R.place; h.legs = R.legs; h.L = Lw;
  if (h.green && h.green.k) h.green.lobes = h.green.lobes.map(([u, v, rx, rz, rot = 0]) => [u * h.green.k, v * h.green.k, rx * h.green.k, rz * h.green.k, rot]);
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
  // card yards: along the line on a par 4 or 5 (from where the tee sits along it); on a par 3 straight from the pad to the pin
  const sOf = v => typeof v === 'number' ? v : v[0];
  const yd = (v, p) => Math.round((def.par === 3 ? Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) : len - sOf(v)) / YD / 5) * 5;
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) h.yards[k] = yd(v, h.teePts[k]);
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = yd(tp, h.tipsPt);
  if (def.par !== 3 && tp[1]) { const b = h.teePts[BACK]; h.tipsYards = Math.round((h.yards[BACK] + Math.hypot(h.tipsPt[0] - b[0], h.tipsPt[1] - b[1]) / YD) / 5) * 5; }
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  // a tide hole's versions: { id, targets, route (points from the back tee to the pin a hole of that tide is measured
  // along, for its card yards), note }; the plain hole is the low tide's
  if (h.versions) {
    h.versionBy = 'tide';
    for (const v of h.versions) {
      if (v.route) { const extra = plen([h.teePts[BACK], ...v.route, h.pin]) - plen([h.teePts[BACK], ...h.line.slice(1)]); v.yards = Object.fromEntries(Object.entries(h.yards).map(([k, y]) => [k, Math.round((y * YD + extra) / YD / 5) * 5])); v.tipsYards = Math.round((h.tipsYards * YD + extra) / YD / 5) * 5; }
      else { v.yards = { ...h.yards }; v.tipsYards = h.tipsYards; }
      v.targets = v.targets || h.targets;
    }
  }
  return { ...def, ...h };
}
const sand = (at, rx, rz = rx, rot = 0, more = {}) => ({ at, rx, rz, rot, ...more });

export const HOLES = [
  // 1. THE VILLAGE: from the stilt village down a valley of coconut palms between karst towers to a green on the
  // beach at the island's east end, the bay and its islands opening ahead
  hole({ n: 1, name: 'The Village', par: 5, world: LINES[0], tips: [-30, 0], shape: 'Dogleg right (39°), down a palm valley',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [28, -8], turtle: [64, 9], clownfish: [100, -4] },
      // a fan: 26 m out of the tee area, opening to 64 m where the second lands, closing into the green
      fw: [{ e: [[118, 9, 10], [170, 13, 14], [230, 20, 22], [290, 28, 30], [350, 35, 36], [400, 36, 34], [430, 26, 24], [448, 14, 13]], wob: 3 }],
      bunkers: [sand(P(258, 36), 9, 4.5, 0.3), sand(P(len - 16, -16), 5, 3.4, 0.4), sand(P(len - 2, 19), 4.2, 3, -0.2)],
      green: { k: 1, lobes: [[0, 0, 12, 15.5, -10], [-6, -9, 8, 7.5], [5, 9, 7.5, 7]], apron: 4, contour: [{ fall: 180, pct: 1.5 }, { ridge: [[-10, 2], [9, -2]], h: 0.28, w: 3 }], style: 'Long and open from the front, falling 1.5% toward the beach behind it, a low spine across its middle; sand short left and right' },
      targets: [{ name: 'The valley', at: P(240, -4) }, { name: 'Short of the green', at: P(400, -2) }],
      words: {
        story: 'The village: from the stilt fishing village down a valley of palms to a green on the beach, the bay opening ahead.',
        plays: 'The round starts at the stilt village on the west shore of the village island. The hole runs east down a valley of coconut palms between karst towers: a half-pipe, its sides feeding a loose drive back toward the middle. It bends right at 300 m and falls gently to a green on the beach at the island\'s east end, the bay and its islands opening ahead, the sea stack out in the middle. Reachable in two for a long hitter; no water in reach until the green\'s far side.',
        safe: 'Driver down the valley (240 m), a long iron short of the green (400 m), a wedge.',
        bold: null,
        miss: 'Either side: the valley\'s banks (rough under palms, then jungle) feed it back. At the green: sand short left and right; the beach behind it (dry sand, playable); the sea only past the beach on the left.',
      },
      card: {
        type: 'Original (a reachable par 5 to open)', form: 'Fan', feature: 'The palm valley and its towers; the beach behind the green', job: 'The valley\'s banks are helpers (they feed a wide ball back); the towers a frame; the beach a helper (a long ball stays dry)',
        decision: 'None: the opener', miss: 'Small: the banks feed it back. Medium: jungle under the palms. The sea only far left past the beach. Safe miss at the green: long (the beach)',
        view: 'In front the valley between two lines of karst towers; in the middle the fan; beyond, the bend right and the bay with the sea stack in it',
        ground: 'Half-pipe: the valley floor banked 15 m both sides, falling 6 m tee to green',
        height: 'Half-pipe', dial: 'Length: a reachable par 5 to open (510 yd)', shots: { tee: 'Driver, a fade with the bend', approach: 'A long iron or wood at a big green' }, hazard: 'None in play: the valley\'s banks', surround: 'Sand short left and right; the beach behind',
        walk: 'From the green along the beach to the headland (60 m), up its back to the 2nd tee',
      },
    }),
  }),

  // 2. THE LEAP: off the headland, 20 m down over open water to a green on a little islet ringed with white sand
  hole({ n: 2, name: 'The Leap', par: 3, world: LINES[1], tips: [-15, 4], shape: 'Straight, headland to islet',
    build: (P, L, len) => ({
      tees: { marlin: -2, manta: [-6, -6], turtle: [2, 7], clownfish: [50, 14] },
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 10.5, 13, 15], [-5, 7, 6, 6]], apron: 2.5, contour: [{ fall: 0, pct: 1.8 }, { bowl: [0, 0], r: 9, h: 0.22 }], style: 'Deeper than wide, tilted 1.8% toward the tee, a shallow dish in its middle; a ring of white sand round the islet' },
      targets: [],
      words: {
        story: 'The leap: off the headland, 20 m down over open water to an islet ringed with white sand.',
        plays: 'All carry: from the top of the headland, 24 m up, down over clear water to a green in the middle of a little islet. A ring of white sand round the islet catches most near misses (dry sand: playable); only a ball that misses the islet is wet. The forward tees play from a ledge of rock in the shallows below the headland, with half the carry.',
        safe: 'A mid iron to the middle of the green; the sand ring is the bail-out all round.',
        bold: null,
        miss: 'Short, long, either side: the sand ring round the islet, then the sea (a stroke and a drop). The safe miss is long (the islet is deepest behind the green).',
      },
      card: {
        type: 'Island green (the set piece: an islet ringed with sand)', form: 'Par 3', feature: 'The headland 24 m up; the islet and its sand ring', job: 'The sea is the hazard (all carry); the sand ring a helper (it catches near misses)',
        decision: 'None: one shot', miss: 'Small: the sand ring. Medium: the sea. Safe miss: long',
        view: 'The water at your feet 20 m down, the islet with its green and sand ring in front, the big island\'s cliffs beyond (the 3rd green under them)',
        ground: 'Drop: 20 m from the headland to the islet, the course\'s only drop par 3',
        height: 'Drop (the only one)', dial: 'A carry: headland to islet, all water', shots: { tee: 'A mid iron that drops and stops', approach: '' }, hazard: 'All round: the sea', surround: 'A ring of white sand round the islet',
        setPiece: 'Island green (an islet ringed with white sand)',
        walk: 'Across the islet to its east side (30 m)',
      },
    }),
  }),

  // 3. THE TONGUE: from the islet across to the big island, a green on a beach shelf under a cliff; at low tide a
  // tongue of sand reaches out from the green toward the islet
  hole({ n: 3, name: 'The Tongue', par: 3, world: LINES[2], tips: [-12, -4], shape: 'Straight, across the water',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [6, 8], turtle: [14, -6], clownfish: [100, 28] },
      bunkers: [sand(P(len + 2, -17), 4.5, 3.2, 0.2), sand(P(len + 15, 10), 4, 3, -0.4)],
      green: { k: 1, lobes: [[0, 0, 13, 16.5, 12], [-8, -9, 8, 8], [7, 10, 8, 7]], apron: 3.5, contour: [{ fall: 0, pct: 1.7 }, { tier: [0, 3], up: 0, h: 0.4, w: 3.5 }], style: 'Big (760 m²) on a beach shelf, a back tier toward the cliff, tilted toward the water; sand left and long right; the cliff behind' },
      targets: [],
      versions: [
        { id: 'low', note: 'Low tide: about 110 yd of carry from the back tee to the tongue\'s tip, then firm wet sand you can land on and run up onto the green.' },
        { id: 'high', note: 'High tide: the tongue is under the sea. All carry to the green\'s front edge (about 185 yd from the back tee); the beach either side of the green is still dry.' },
      ],
      words: {
        story: 'The tongue: across the water to a green under a cliff, a tongue of sand running out to meet you at low tide.',
        plays: 'From the far side of the islet across the water to a big green on a beach shelf at the foot of the big island, a cliff hung with stalactites behind it (it returns a long ball). At low tide a tongue of firm wet sand reaches 80 m out from the green toward the islet: carry 110 yd to it and run the ball up. At high tide the tongue is under the sea and the shot is all carry. The forward tee stands on a rock in the shallows beside the tongue\'s tip.',
        safe: 'Low tide: a hybrid or long iron landed on the tongue. High tide: a long iron or hybrid to the middle.',
        bold: null,
        miss: 'Short: the tongue (low tide, firm sand) or the sea (high tide). Long: the cliff gives it back to the beach. Left: sand, then the beach. Right: the beach. The safe miss is long.',
      },
      card: {
        type: 'Original (a par 3 the tide changes)', form: 'Par 3', feature: 'The tongue of sand; the cliff hung with stalactites behind the green', job: 'The tongue is a helper at low tide (a landing strip) and gone at high; the sea the hazard; the cliff a helper (it returns a long ball)',
        decision: 'None: one shot (the tide decides the shot: run it up or fly it)', miss: 'Small long: the cliff. Small short: the tongue (low) or the sea (high). Safe miss: long',
        view: 'The water in front, the tongue (at low tide) running in to the green, the cliff and the big island\'s towers behind; the 4th\'s shelf above to the left',
        ground: 'Level across the water: tee and green within a metre of each other',
        height: 'Level, across the water', dial: 'The tide: a sand tongue short of the green at low water', shots: { tee: 'Low: a running long iron; high: a high hybrid that stops', approach: '' }, hazard: 'In front: the sea (and the tongue at low tide)', surround: 'Sand left and long right; the cliff behind; beach either side',
        walk: 'Up the path at the cliff\'s end onto the shelf (40 m) to the 4th tee',
      },
    }),
  }),

  // 4. THE COVES: along a shelf above the bay, leaning 8% away from the water into a jungle bank; three coves bite in
  // from the left, each with a beach at its head
  hole({ n: 4, name: 'The Coves', par: 5, world: LINES[3], pinS: 510, keepBeach: true, tips: [-40, -8], shape: 'Dogleg left (45°), along a shelf',
    build: (P, L, len, Lw) => ({
      tees: { marlin: -12, manta: [6, 6], turtle: [44, -6], clownfish: [80, 6] }, teeLift: { marlin: 1.5, manta: 1 },
      // scalloped: the coves bite the left edge, the jungle bank bulges into the right between them
      // the left edge swells out between the coves (the bold landing at 212 m is the first swell) and pulls in at each
      // cove's head; the right edge does the opposite against the jungle bank, so the middle weaves
      // the land between the first and second coves is mown in one sweep from the head of the first cove round the outside
      // of the bold landing to the head of the second (Rhys's markup, 16 November), so the bold landing is part of the
      // fairway, not a lobe on it
      fw: [{ e: [[96, 12, 13], [140, 20, 24], [165, 46, 22], [185, 94, 21], [210, 112, 22], [240, 116, 26], [268, 114, 30], [295, 112, 36], [320, 104, 40], [338, 72, 34], [352, 36, 30], [370, 24, 28], [398, 24, 24], [420, 30, 26], [436, 12, 34], [452, 4, 30], [474, 10, 20], [490, 10, 10]], wob: 1.6 }],
      bunkers: [sand(P(176, 34), 8, 4.2, 0.2), sand(P(len - 15, 15), 5, 3.4, -0.3), sand(P(len + 10, -14), 4.2, 3, 0.3)],
      green: { k: 1, lobes: [[0, 0, 11.5, 14.5, -15], [6, -8, 7, 7], [-5, 8, 7, 6.5]], apron: 3.5, contour: [{ fall: 70, pct: 1.8 }, { ridge: [[-10, 10], [9, 2]], h: 0.3, w: 3 }], style: 'Turned along the bold line, falling 1.8% to the right with the shelf, a spine across it; sand right and long left; the third cove short left' },
      targets: [{ name: 'The shelf', at: P(222, 4) }, { name: 'Between the coves', at: P(312, -83), bold: true }, { name: 'Past the second cove', at: P(418, 12) }],
      words: {
        story: 'The coves: along a shelf above the bay, three coves biting in from the left.',
        plays: 'The long shore hole. From the top of the cliff behind the 3rd green the 4th runs along a shelf 12-18 m above the bay\'s east shore, leaning 8% away from the water into a jungle bank on the right. Three coves bite in from the left, each with a beach at its head as the bail-out. Skirt them along the shelf and it is three shots with no water crossed. Carry the first cove from the tee to the shelf between the first two coves, 290 yd out on the straight line, and the green is about 235 yd away over the second and third: reachable in two. From the tee you look back across the bay at the 1st, 7th, 8th and 9th at once.',
        safe: 'Driver along the shelf (222 m), a fairway wood past the second cove (418 m), a wedge.',
        bold: 'Driver over the first cove to the shelf between the coves, 290 yd out (a 190 yd carry), then a 3 wood or hybrid over the second and third coves at the green (about 235 yd).',
        miss: 'Right: the jungle bank, a ball kicks back down the lean. Left: rough, then a cove\'s beach (dry sand), then the sea (a stroke and a drop). At the green: the third cove short left, sand right and long left.',
      },
      card: {
        type: 'Cape (three coves to bite off)', form: 'Scalloped by the coves (alike.mjs reads a funnel: wide over the land between the first two coves, closing to the green)', feature: 'The three coves and their beaches; the shelf\'s lean; the jungle bank', job: 'The coves are hazards (diagonal, from the left); their beaches helpers (a dry bail-out); the bank a helper (it feeds a ball back)',
        decision: 'Bite off what you dare: along the shelf (three shots, no water) or over the coves (a 290 yd drive leaves 235: reachable in two); the bold line saves about 40 yd',
        miss: 'Small: rough. Medium left: a cove\'s beach. Big left: the sea. Right: the bank (never a penalty). Safe miss at the green: right',
        view: 'In front the shelf along the cliff top, the first cove biting in on the left with its beach; across the bay the village island, the cove on island C, the stack and the hollow island',
        ground: 'Hillside bench: 8% across, down to the right (away from the water), into the jungle bank; climbs 6 m to the corner and falls 8 m to the green',
        height: 'Hillside bench, 8% across (bold)', dial: 'One hazard\'s scale: three coves', shots: { tee: 'A draw along the shelf, or a carry over the first cove', approach: 'A wood over two coves, or a short iron from the lay-up' }, hazard: 'Down the left, diagonal: the coves', surround: 'Sand right and long left; the third cove short left',
        walk: 'From the green down to the island\'s north point (35 m) to the 5th tee',
      },
    }),
  }),

  // 5. THE SANDBAR: a bar of white sand and salt grass between two islands, sea on both sides
  hole({ n: 5, name: 'The Sandbar', par: 4, world: LINES[4], tips: [-28, 0], shape: 'Dogleg right (17°), along a sandbar',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [16, -6], turtle: [44, 8], clownfish: [100, -38] },
      // a strip: the bar's crown of salt grass, mown
      fw: [{ e: [[60, 17, 17], [110, 21, 21], [290, 21, 21], [320, 17, 19], [340, 12, 14]], wob: 1.5 }],
      bunkers: [sand(P(len - 14, 15), 4.6, 3.2, -0.3), sand(P(len + 10, -12), 4, 2.8, 0.2)],
      green: { k: 1, lobes: [[0, 0, 11, 14, 10], [-6, 8, 6.5, 6]], apron: 3.5, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-10, -11], [9, -4]], h: 0.26, w: 3 }], style: 'On island C\'s low east end, a spine across it; sand long left and short right' },
      targets: [{ name: 'The bar', at: P(236, -2) }],
      versions: [
        { id: 'low', note: 'Low tide: the bar\'s grass with dry sand and firm wet sand either side; the sea 60-90 m from the line.' },
        { id: 'high', note: 'High tide: the wet sand is under the sea. The bay\'s side (left) keeps salt-grass rough and dry sand to 58 m; the open sea\'s side (right) dry sand to 40 m, then the sea.' },
      ],
      words: {
        story: 'The sandbar: a bar of white sand and salt grass between two islands, sea on both sides.',
        plays: 'From the big island\'s north point along a bar of white sand and salt grass to island C, the open sea on the right and the bay on the left. Two straight shots: the great overhang on the next island is the aim point. At low tide the bar is wide (dry sand and firm wet sand down to the water both sides). At high tide the wet sand is under the sea: on the right only 20 m of dry sand stands between the grass and the water; on the left a band of salt-grass rough and dry sand.',
        safe: 'Driver down the bar (236 m), a short iron to the green on island C.',
        bold: null,
        miss: 'Left (the bay): rough, dry sand, wet sand (low tide), then the sea. Right (the open sea): dry sand, wet sand (low tide), then the sea; at high tide the sea is 40 m from the line. At the green: sand long left and short right.',
      },
      card: {
        type: 'Original (a sandbar fairway)', form: 'Strip (a sandbar: the course\'s one plain strip)', feature: 'The bar; the sea both sides; the overhang ahead as the aim point', job: 'The sea is the hazard (both sides, but beyond dry sand); the sand bands helpers (playable); the overhang an aim point',
        decision: 'None: two straight shots', miss: 'Small: sand (playable). Medium right at high tide: the sea. Medium left: rough and sand. Safe miss: left',
        view: 'The bar running away between two seas, island C\'s cliffs and the great overhang ahead',
        ground: 'Level: the bar\'s crown 3.3 m above low water, under a metre of fall to its edges',
        height: 'Level', dial: 'Width: the bar 42 m of grass; dry ground 100-150 m across at low tide, 80 m at high', shots: { tee: 'Dead straight', approach: 'A short iron' }, hazard: 'Down both sides: the sea (beyond the sand)', surround: 'Sand long left and short right',
        walk: 'Along island C\'s shore round to the valley mouth (25 m) to the 6th tee',
      },
    }),
  }),

  // 6. THE SADDLE: up a jungle valley and over a saddle between two limestone towers, a 30 m pinnacle in the
  // fairway, a bamboo-and-flag marker on the crest, down to a green by a mangrove creek
  hole({ n: 6, name: 'The Saddle', par: 4, world: LINES[5], tips: [-56, 0], shape: 'Dogleg left (24°), over a saddle',
    build: (P, L, len) => ({
      tees: { marlin: -24, manta: [6, 5], turtle: [42, -6], clownfish: [88, 6] },
      // an island (a doughnut): the fairway round the pinnacle, then the run down to the green
      fw: [{ e: [[100, 13, 13], [140, 24, 24], [190, 32, 32], [240, 30, 30], [275, 22, 22], [320, 24, 22], [352, 15, 14]], wob: 3 }, { bite: [[192, 0, 13, 13]], wob: 1.5 }],
      bunkers: [sand(P(258, -30), 6, 3.6, 0.2), sand(P(len - 15, -14), 5, 3.4, 0.3), sand(P(len + 10, 12), 4, 3)],
      green: { k: 1, lobes: [[0, 0, 12, 15, -8], [-6, -9, 7.5, 7], [6, 9, 7.5, 7]], apron: 3.5, contour: [{ fall: 0, pct: 1.9 }, { tier: [0, 6], up: 0, h: 0.45, w: 3 }], style: 'Below the saddle, a front tier up to a back shelf; sand short left and long right; the mangrove creek right' },
      targets: [{ name: 'Left of the pinnacle', at: P(222, -20) }, { name: 'Right of the pinnacle', at: P(222, 20) }],
      words: {
        story: 'The saddle: up a jungle valley and over a saddle between two towers, a pinnacle in the fairway.',
        plays: 'Up a jungle valley on island C and over a saddle between two limestone towers 200 m tall. A pillar of rock 30 m tall stands in the middle of the fairway where drives land: go left or right of it. Beyond it the saddle rises in a face 6.5 m tall to a level top, a bamboo-and-flag marker on its lip. From below the face the second is blind; the longest drives fly the face, and from the far half of the top (300 m out and on) the green is in sight below, by a mangrove creek.',
        safe: 'Driver left or right of the pinnacle (222 m), a mid iron down over the crest at the marker.',
        bold: null,
        miss: 'Either side: rough, then jungle up the valley\'s banks (they feed it back). Straight at the pinnacle: it gives the ball back off its foot. At the green: sand short left and long right; the mangrove creek right.',
      },
      card: {
        type: 'Alps (a blind second over the saddle)', form: 'Island (a doughnut round the pinnacle)', feature: 'The two towers; the pinnacle; the marker on the crest; the mangrove creek', job: 'The pinnacle is an obstacle (in the middle of the landing area); the saddle\'s face an obstacle (a landing area short of it, the longest can fly it); the towers a frame; the marker an aim point; the creek a hazard right of the green',
        decision: 'None: left or right of the pinnacle, both fair (left the shorter, right the better angle)', miss: 'Small: rough. Medium: jungle on the banks. Safe miss at the green: left',
        view: 'In front the valley climbing between the two towers, the pinnacle in the fairway, the saddle beyond',
        ground: 'Table top: a 6.5 m face 226-248 m out under the saddle\'s level top (to 318 m), then 6 m down to the green; +5 m tee to green',
        height: 'Table top: up and over the saddle (bold)', dial: 'Height: between two towers 200 m tall', shots: { tee: 'Either side of a pillar: a draw or a fade to a number', approach: 'A blind mid iron over a face, or a wedge down from the top' }, hazard: 'In the middle: the pinnacle', surround: 'Sand short left and long right; the creek right',
        walk: 'Down the valley\'s west mouth to the beach (40 m) to the 7th tee, under the overhang',
      },
    }),
  }),

  // 7. THE OVERHANG: a beach hole round a cove, under a cliff that leans out 40 m overhead
  hole({ n: 7, name: 'The Overhang', par: 4, world: LINES[6], tips: [-30, -8], shape: 'Dogleg right (49°), round a cove',
    build: (P, L, len, Lw) => ({
      tees: { marlin: 0, manta: [14, 6], turtle: [30, 8], clownfish: [38, -6] },
      // a hook: the fairway wraps round the cove; the line to the green crosses it
      fw: [{ lobes: [[96, -8, 42, 20], [140, -6, 40, 22, 10], [192, 4, 36, 22, 30], [238, 6, 32, 20, 6], [266, 2, 20, 14]], join: 18, wob: 3 }],
      bunkers: [sand(P(150, -32), 7, 4, 0.1), sand(P(len - 13, -14), 4.5, 3.2, 0.2), sand(P(len + 9, 11), 4, 2.8, -0.3)],
      green: { k: 1, lobes: [[0, 0, 10.5, 13, 30], [-5, 7, 5.5, 5]], apron: 3, contour: [{ fall: 220, pct: 1.4 }, { bowl: [0, 0], r: 10, h: 0.12 }, { ridge: [[-8, 9], [7, 10]], h: 0.3, w: 2.5 }], style: 'Small (420 m²), turned toward the bold line, a shallow dish, a low ridge across the back; sand left and long right; the cove short right' },
      targets: [{ name: 'Round the corner', at: P(165, -4) }, { name: 'Across the cove', at: L.at(-1), bold: true, pin: true }],
      words: {
        story: 'The overhang: a beach hole round a cove, under a cliff that leans out 40 m overhead.',
        plays: 'A short par 4 on the beach of island C\'s north shore, round a cove, under a limestone cliff that leans out 40 m over the beach along the left and hangs with stalactites. Safe: an iron along the beach to the corner and a wedge. Bold: driver straight across the cove at the green, about 290 yd, all carry to the far beach. The cliff\'s foot gives a ball back to the sand.',
        safe: 'A long iron to the corner (165 m), a wedge.',
        bold: 'Driver straight at the green across the cove: 266 m tee to pin, a carry of about 200 m to the far beach.',
        miss: 'Left: the beach under the overhang, then the cliff (it gives it back). Right of the corner: the cove\'s beach, then the cove (a stroke and a drop). At the green: sand left and long right.',
      },
      card: {
        type: 'Original (a drivable beach hole under a cliff)', form: 'Hook', feature: 'The leaning cliff and its stalactites; the cove', job: 'The cliff is a frame and a helper (it gives a ball back); the cove the hazard (the bold line crosses it)',
        decision: 'Drivable par 4: driver across the cove (about 290 yd, the green open in front) or an iron round the sand and a wedge',
        miss: 'Small left: the beach. Medium left: the cliff\'s foot. Right: the cove\'s beach, then the cove. Safe miss at the green: left',
        view: 'The beach running away under the leaning cliff on the left, the cove on the right, the green across it beyond, the sea stack out in the bay',
        ground: 'Level: a beach, a metre or two above high water',
        height: 'Level (a beach)', dial: 'Length: drivable across the cove (320 yd round, 290 straight)', shots: { tee: 'A long iron to a number, or driver over water', approach: 'A wedge' }, hazard: 'Inside the bend: the cove', surround: 'Sand left and long right; the cove short right',
        walk: 'Along the beach to the point (40 m) to the 8th tee',
      },
    }),
  }),

  // 8. THE STACK: a short iron out to a flat-topped sea stack in the middle of the bay, a rock rim round its back
  hole({ n: 8, name: 'The Stack', par: 3, world: LINES[7], tips: [-20, -6], shape: 'Straight, out to a sea stack',
    build: (P, L, len) => ({
      tees: { marlin: -6, manta: [-3, 7], turtle: [0, -6], clownfish: [4, 4] },
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 8.8, 11.5, 8], [-3, 5, 4.6, 4.2]], apron: 1.2, contour: [{ fall: 0, pct: 1.5 }, { bowl: [0, 2], r: 8, h: 0.16 }], style: 'Small (320 m²) on a flat-topped stack, tilted toward the tee, a shallow dish; a rim of rock round its back half; one twisted tree' },
      targets: [],
      words: {
        story: 'The stack: a short iron out to a flat-topped sea stack in the middle of the bay.',
        plays: 'From the point of island C a short iron out over the bay to a green on the flat top of a sea stack 8 m up, one twisted tree beside it. A rim of rock round the back half holds a long ball. Anything else is the sea. All carry from every tee: the forward tee is the spot on the point nearest the stack.',
        safe: 'A short iron to the middle of the green; long is better than short.',
        bold: null,
        miss: 'Short, left, right: the sea (a stroke, and a drop on the point). Long: the rim holds it. At low tide a ball well right finishes on the wet sand off the spit.',
      },
      card: {
        type: 'Short (a sea-stack green)', form: 'Par 3', feature: 'The stack; its rim of rock; the twisted tree', job: 'The sea is the hazard (all carry: the green is the island); the rim a helper (it holds a long ball); the tree a frame',
        decision: 'None: one shot', miss: 'Everything but long is in the sea; long is held by the rim',
        view: 'The bay in front, the stack and its green 110 m out, the tidal flats and the hollow island beyond (the 9th)',
        ground: 'Uphill to a rock top: the green 4 m above the tee',
        height: 'Uphill to a rock top', dial: 'Green size: 320 m² on a sea stack', shots: { tee: 'A short iron, high, that stops', approach: '' }, hazard: 'All round: the sea', surround: 'A rim of rock behind; the sea everywhere else',
        walk: 'A boat ride from the point to the 9th\'s tee rock (about 150 m): the longtails wait at the point',
      },
    }),
  }),

  // 9. THE HONG: across the tidal flats, over a channel, in through the sea cave and out into the hidden lagoon;
  // at high tide the flats are under water and the hole plays along the spit to the right
  hole({ n: 9, name: 'The Hong', par: 5, world: LINES[8], tips: [-22, 5], shape: 'Dogleg left (6°), through a sea cave',
    build: (P, L, len, Lw) => ({
      tees: { marlin: 0, manta: [10, -7], turtle: [18, 6], clownfish: [74, 7] },
      // broken: the flats (dry at low tide), the spit's crown along the right, the cave beach, then the cave and the green
      fw: [{ lobes: [[160, -6, 46, 26], [238, -12, 52, 32, -6], [292, -16, 30, 26]], join: 14, wob: 3 },   // the flats (water at high tide)
        { e: [[140, -2, 30], [200, -21, 68], [260, -39, 85], [300, -41, 87], [340, -35, 79], [372, -33, 74]], wob: 2 },   // the spit's crown
        { lobes: [[386, 14, 22, 44, 8]], join: 10, wob: 2 }],   // the beach at the cave's mouth
      bunkers: [sand(P(len - 15, -13), 5, 3.4, 0.3), sand(P(len + 12, 12), 4.5, 3)],
      green: { k: 1, lobes: [[0, 0, 15, 17, 8], [-9, -10, 9, 8.5], [8, 11, 9, 8]], apron: 4, contour: [{ fall: 40, pct: 1.6 }, { tier: [0, 3], up: 0, h: 0.4, w: 3.5 }], style: 'Big (850 m²) on the lagoon\'s beach, a back tier, tilted toward the lagoon; sand short left and long right; the beach shack beyond' },
      targets: [{ name: 'The flats', at: P(262, -12) }, { name: 'The cave beach', at: P(388, 12) }, { name: 'Through the cave', at: L.at(-1), bold: true, pin: true }],
      versions: [
        { id: 'low', note: 'Low tide: the flats are firm wet sand and salt grass. A good drive leaves about 255 yd through the cave to the green: go, or lay up over the channel to the beach at the cave\'s mouth (about 135 yd) and play a short iron through.' },
        { id: 'high', note: 'High tide: the flats are under water. Three shots along the spit to the right, to the beach at the cave\'s mouth, then a short iron through the cave.',
          targets: null, route: null },
      ],
      words: {
        story: 'The hong: across the tidal flats and through a sea cave into a hidden lagoon.',
        plays: 'From a rock in the shallows across the tidal flats toward the hollow island, a ring of cliffs 115 m high. A tidal channel crosses the line 330 m out, and beyond it a beach at the mouth of a sea cave 40 m high and 60 m wide through the island\'s east wall. Through the cave: the lagoon, a crescent of sand, the green and the beach-shack clubhouse. Low tide: the flats are firm sand and salt grass; from a good drive the green is about 255 yd through the cave: go, or lay up over the channel to the cave beach. High tide: the flats are under water and the hole plays three shots along the spit to the right.',
        safe: 'Low tide: driver to the flats (262 m), a short iron over the channel to the cave beach (388 m), a short iron through the cave. High tide: driver along the spit, a mid iron to the cave beach, a short iron through the cave.',
        bold: 'Low tide: driver to the flats, then a wood straight through the cave at the green (about 255 yd, the cave floor short of it firm sand).',
        miss: 'Low tide: the flats are playable sand everywhere; the channel is water. High tide: left of the spit is the sea; right is sand then the sea. In the cave: its walls give the ball back to the cave floor (sand). At the green: sand short left and long right.',
      },
      card: {
        type: 'Original (through a sea cave into a hidden lagoon)', form: 'Split (the flats lane and the spit lane), the channel across the flats', feature: 'The flats; the channel; the sea cave; the lagoon and the beach shack', job: 'The channel is a hazard (across); the cave an obstacle (thread it: its walls give the ball back); the flats a lie-setter (firm sand at low tide)',
        decision: 'Go or lay up (low tide): a wood through the cave from the flats (about 255 yd) or a short iron over the channel to the cave beach; high tide: three shots along the spit',
        miss: 'Low tide: sand everywhere but the channel. High tide: the sea left of the spit. Safe miss at the green: short (the cave floor)',
        view: 'In front the flats (or the sea at high tide) and the spit right, the hollow island\'s cliffs ahead with the dark mouth of the cave, the stack on the right',
        ground: 'Dip in front: the tidal channel 1.6 m below the flats; the cave floor and the lagoon beach level',
        height: 'Dip in front (the channel)', dial: 'Scale: through a sea cave 40 m high into a lagoon', shots: { tee: 'Driver across open flats, or along a spit', approach: 'A wood through a cave, or a short iron' }, hazard: 'Across: the channel; overhead: the cave\'s roof', surround: 'Sand short left and long right; the lagoon beyond',
        walk: 'The beach shack, 60 m beyond the green',
      },
    }),
  }),
];
// the high-tide 9th: along the spit (its crown at vc(s) right of the line) to the cave's beach
{
  const h = HOLES[8], P = (s, o = 0) => at(h.line, s, o);
  const hi = h.versions.find(v => v.id === 'high');
  hi.targets = [{ name: 'Along the spit', at: P(238, 58) }, { name: 'The cave beach', at: P(380, 28) }];
  const Lb = hi.targets.map(t => t.at), extra = Math.hypot(Lb[0][0] - h.teePts[BACK][0], Lb[0][1] - h.teePts[BACK][1]) + Math.hypot(Lb[1][0] - Lb[0][0], Lb[1][1] - Lb[0][1]) + Math.hypot(h.pin[0] - Lb[1][0], h.pin[1] - Lb[1][1]) - h.len;
  hi.yards = Object.fromEntries(Object.entries(h.yards).map(([k, y]) => [k, Math.round((y * YD + extra) / YD / 5) * 5]));
  hi.tipsYards = Math.round((h.tipsYards * YD + extra) / YD / 5) * 5;
  hi.route = Lb;
}
// the bold lines the plan book draws and flies: 4 over the first cove, 7 and 9 straight at the green
HOLES[3].boldPath = HOLES[3].targets.find(t => t.bold).at;
HOLES[6].boldPath = HOLES[6].pin;
HOLES[8].boldPath = HOLES[8].pin;
// alike.mjs reads a hook against the straight line from tee to green, which its fairway wraps round
HOLES[6].formLine = [HOLES[6].line[0], HOLES[6].pin];
