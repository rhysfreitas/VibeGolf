// Emerald Bay, plan book round 3 (24 November 2026), from Rhys's markup on round 2: forward tees on sea stacks (2, 3),
// a stack in the Sandbar and the 5th's green up on a headland, more fall on the 1st and the beaches leaning to the sea,
// and the 9th a true dogleg left round a spit with an island fairway inside it that the high tide covers.
// Round 2 (24 November 2026): the holes of layout round 3, approved by Rhys the same day
// ("Approve, go to the plan book", after asking for one hole on an inside shore: the 4th). The islands are whole and
// spread out with open water between them; the golf is on their outer shores, the 4th up B's inside wall over the
// channel, only the Drop's green inside the Maya island's horseshoe. Par 36: 5 3 3 5 4 4 4 3 5 (as approved on 15
// November; 5 3 4 5 3 4 4 3 5 would match Halcyon Ring on six holes). The tide (round 0): rolled each round like the
// pins, shown and changeable on the setup screen; the three sands; the uneven Sandbar.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the line,
// y up from the hole's `base`, the back tee's height). `route` turns the world line ([x east, n north]) into `legs`
// and `place`; `L(x, n)` turns a world point into the hole's frame. The ground is the world's own (world.mjs V).
import { lineOf, lengthOf, at, headingAt, YD } from './geo.mjs';
import { ISLAND9, smoothPoly } from './world.mjs';
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
  // the tide: rolled at random each round like the pins, shown and changeable on the setup screen; one mechanism with
  // the Labyrinth's doors (COURSE.rolls, hole.versions, hole.versionBy)
  rolls: [{ id: 'tide', name: 'Tide', options: [{ id: 'low', name: 'Low tide', sea: TIDES.low }, { id: 'high', name: 'High tide', sea: TIDES.high }] }],
  card: {
    hook: 'A warm bay of whole limestone islands with open water between them: sheer walls streaked orange and black, jungle over them, white sand and clear turquoise water at their feet. The golf runs round their outer shores on beaches, terraces and shelves. Two logics: sand is always playable and water is a stroke (cliffs give the ball back), and the tide is high or low each round (holes 3, 5 and 9 play differently).',
    skeleton: 'Par 36: 5 3 3 5 4 4 4 3 5, three par 3s and three par 5s. Five islands spread over about 1.8 by 1.6 km, the channels between them 180-290 m: up the Maya island\'s west shore (1), into its horseshoe for the Drop (2), across the channel\'s mouth (3), up B\'s inside wall over the channel (4), across to C on the Sandbar (5), through the gap between C and the Sentinel (6), round C\'s north cove (7), out to the stack (8), across the flats and through the Hong\'s cave (9).',
    classics: 'Cape (4: three coves to bite off). Short (8: a sea-stack green). Redan (3: the green falls away to the left, a bank kicks a ball on from the right). Set pieces: island green (2, an islet alone in the horseshoe\'s cove) and postage stamp (8). Its own: tees on sea stacks (2, 3), a sandbar fairway with a stack in it to a perched green (5), a slot between sheer walls (6), a beach hole under a leaning cliff (7), an island fairway the tide covers and a green out of a sea cave (9).',
    decisions: 'Four, four types: bite off what you dare (4: carry the coves and it is reachable in two), centre-line hazard (6: carry the pot in the middle of the slot or lay back short of it), drivable par 4 (7: straight across the cove), go or lay up (9: at low tide, onto the island fairway inside the dogleg and at the green through the cave).',
    landmarks: 'The sea stack and its spire (from 7, 9 and the boats; played at 8); the Sandbar\'s stack (from 4, 5 and 6); the Sentinel and its gap (from 4 and 5; played through at 6); the leaning cliff (from 6 and 8; played under at 7); the Maya island\'s horseshoe (across the water from 3 and 4; played into at 2); the Hong (across the channel from 1; played into at 9). The reveals: the cove opening below the ledge (2) and the lagoon out of the cave (9).',
    rhythm: 'A reachable par 5 to open up a quiet shore; the Drop; a par 3 the tide changes; the long shelf hole over the coves (the hardest); the Sandbar; the gap; a short beach hole; the stack; the Hong. Par 3s 145, 175 (plays about 150, 56 m down) and 220; par 4s 300, 385 and 430; par 5s 495, 565 and 600. Compass: N, WSW, ESE, N, NW, N then NW, W, SW, NNW then W.',
    forms: 'Six fairways, six forms: 1 stepping stones (a piece of fairway on each coral terrace), 4 scalloped by its coves, 5 strip (the Sandbar: the course\'s one plain strip), 6 hourglass (pinched in the slot), 7 hook round the cove (alike.mjs reads a bowl), 9 broken (the right fairway, a gap of water, the intermediate fairway; or the island fairway over the water).',
    heights: '1 stepped (bold: coral terraces stepping down 6 m twice to the beach, leaning to the channel), 2 drop (the only one: 56 m from the ledge to the islet), 3 level across the water, 4 hillside bench (bold: 9% across and up into the wall, climbing 6 m), 5 perched green (6 m up on a headland at the bar\'s end), 6 half-pipe (the slot\'s floor between walls 150 m tall, falling 5 m from the headland), 7 hillside bench (8% across, from the cliff\'s foot down to the sea), 8 uphill to a rock top, 9 perched green (4 m up on a shelf just out of the cave).',
    dials: 'One pushed on every hole: 1 length (a reachable par 5 to open), 2 height (56 m down: the course\'s one drop), 3 the tide (a sand tongue short of the green at low water), 4 one hazard\'s scale (three coves), 5 width (the bar: 42 m of grass, dry ground 100-150 m across at low tide), 6 width the other way (a slot 53 m wide between walls 150 m tall), 7 length (drivable, 270 yd straight across the cove), 8 green size (about 375 m² on a sea stack), 9 green size past anything real (about 1,400 m², perched just out of a sea cave).',
    newBorrowed: 'New to the register: the first tropical course; a tide that changes holes; a sandbar fairway; a green inside a hollow island; a sea-stack green; a beach hole under a leaning cliff; a slot between sheer walls. Borrowed (two): an island green, a postage stamp.',
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
  // 1. THE VILLAGE: from the stilt village up the Maya island's outer west shore, a terrace of salt grass and palms
  // at the foot of the wall, the beach and the open channel on the left with the Hong across the water
  hole({ n: 1, name: 'The Village', par: 5, world: LINES[0], tips: [-30, 0], shape: 'Nearly straight (right 9°), up the west shore in two steps',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [26, 8], turtle: [62, -8], clownfish: [98, 6] },
      // a fan: narrow out of the tee area, opening to 60 m where the second lands, closing into the green
      // stepping stones: a big piece of fairway on each terrace, rough on the risers between
      fw: [{ lobes: [[226, -4, 64, 27]], wob: 3 }, { lobes: [[340, -2, 38, 27]], wob: 3 }, { lobes: [[432, 0, 13, 13]], wob: 2 }],
      // a string of pots down the right, in the foot of the wall
      bunkers: [sand(P(248, -32), 9, 4.5, 0.3), sand(P(176, 25), 4.2, 3.6, 0, { kind: 'pot' }), sand(P(212, 28), 4, 3.4, 0, { kind: 'pot' }), sand(P(300, 37), 4.2, 3.6, 0, { kind: 'pot' }), sand(P(len - 16, 16), 5, 3.4, -0.4), sand(P(len - 2, -19), 4.2, 3, 0.2)],
      green: { k: 1, lobes: [[0, 0, 12, 15.5, 10], [6, -9, 8, 7.5], [-5, 9, 7.5, 7]], apron: 4, contour: [{ fall: 200, pct: 1.6 }, { ridge: [[-10, -2], [9, 2]], h: 0.28, w: 3 }], style: 'Long and open from the front, falling 1.6% toward the beach on the left, a low spine across its middle; sand short right and left' },
      targets: [{ name: 'The top terrace', at: P(232, -4) }, { name: 'The second terrace', at: P(372, -2) }],
      words: {
        story: 'The village: from the stilt fishing village down the Maya island\'s outer shore in two coral terraces, the open channel on your left.',
        plays: 'The round starts at the stilt village on the south tip of the Maya island\'s west arm. The hole runs north along the foot of the island\'s outer wall on old coral terraces of salt grass and palms, a low coral cliff to the open channel on the left with the Hong standing off across the water. The tee is on the top terrace, 16 m up; the second terrace steps down 6 m at 270 m, the third 6 m more at 390 m to a green on the beach at the island\'s north-west corner: the last terrace comes down onto a wide beach that wraps the green\'s left side and runs on past it, shelving into the channel. Each terrace leans about 4.5% toward the channel, and each step comes after the shot before lands, so you always look down onto your landing.',
        safe: 'Driver down the top terrace (232 m), a long iron to the second terrace\'s lip (372 m), a wedge down to the green.',
        bold: null,
        miss: 'Right: three pots in the foot of the wall, then jungle and rock that gives the ball back. Left: rough, then the coral cliff and the channel. At the green: sand short right and left; the beach left of it and behind it, running down to the channel.',
      },
      card: {
        type: 'Original (a reachable par 5 to open)', form: 'Stepping stones (a piece of fairway on each terrace)', feature: 'The coral terraces at the wall\'s foot; the open channel and the Hong across it', job: 'The wall is a helper (it gives a wild ball back); the pots a hazard on the right; the steps set the lies (each shot plays down); the Hong a frame',
        decision: 'None: the opener', miss: 'Small: rough on the terraces. Medium right: the pots, then jungle at the wall\'s foot; medium left: rough, then the coral cliff. Safe miss: middle',
        view: 'In front the top terrace running along the shore under the island\'s wall, the steps down beyond, the turquoise channel on the left and the Hong\'s cliffs across the water',
        ground: 'Stepped: three coral terraces, 16, 10 and 4 m up, each step 6 m down past where the shot before lands, each leaning 4.5% toward the channel',
        height: 'Stepped (bold)', dial: 'Length: a reachable par 5 to open (495 yd)', shots: { tee: 'Driver along a terrace, down onto the landing', approach: 'A long iron down a step, or a wood at the green from the top' }, hazard: 'Down the right: three pots in the wall\'s foot', surround: 'Sand short right and left; the beach left and behind, wide and shelving into the channel',
        walk: 'From the green up a cliff path over the head of the island to the ledge on the cove\'s east wall',
      },
    }),
  }),

  // 2. THE DROP: off a notch 60 m up the cove's east wall, down to a green alone on a sand islet in the middle of the
  // Maya island's horseshoe, the only hole up top
  hole({ n: 2, name: 'The Drop', par: 3, world: LINES[1], padFront: 1, tips: [-22, 0], shape: 'Straight, ledge to islet',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [0, 8], turtle: [31, 7], clownfish: [78, -13] },   // Turtle and Clownfish on sea stacks in the cove (Rhys, 24 November)
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 10.5, 13, 15], [-5, 7, 6, 6]], apron: 2.5, contour: [{ fall: 0, pct: 1.8 }, { bowl: [0, 0], r: 9, h: 0.22 }], style: 'Deeper than wide, tilted 1.8% toward the tee, a shallow dish in its middle; a ring of white sand round the islet' },
      targets: [],
      words: {
        story: 'The drop: off a ledge 60 m up the cove\'s wall to a green alone on an islet in the middle of the horseshoe.',
        plays: 'A cliff path from the 1st green climbs over the head of the island to a notch at the lip of the cove\'s east wall, 60 m up. Below, the Maya island\'s horseshoe: the white beach at its head, the cove of turquoise water, and in the middle of it a little islet with the green on it, ringed with sand. All carry, 56 m down: it plays about 25 yd shorter than the card. The tee is right at the lip: step back and the islet drops out of sight. The forward tees stand on two sea stacks in the cove, reached by ladder from a longtail: the Turtle on a tall one, 22 m up and 140 yd out, the Clownfish on a low one, 9 m up and 90 yd out.',
        safe: 'A mid iron to the middle of the green; the sand ring is the bail-out all round.',
        bold: null,
        miss: 'Short, long, either side: the sand ring round the islet, then the cove (a stroke and a drop). The safe miss is long (the islet is deepest behind the green).',
      },
      card: {
        type: 'Island green (the set piece: an islet alone in the cove)', form: 'Par 3', feature: 'The notch at the lip; the horseshoe; the islet and its sand ring; the forward tees\' sea stacks', job: 'The cove is the hazard (all carry); the sand ring a helper (it catches near misses); the horseshoe\'s walls a frame',
        decision: 'None: one shot', miss: 'Small: the sand ring. Medium: the cove. Safe miss: long',
        view: 'From the lip the cove 56 m below, the islet and its green in the middle of it, the Maya beach to the right, the horseshoe\'s west wall across the water and the bay through its mouth to the left',
        ground: 'Drop: 56 m from the ledge to the islet, the course\'s only drop par 3; 18 m from the Turtle stack, 5 m from the Clownfish',
        height: 'Drop (the only one)', dial: 'Height: 56 m down', shots: { tee: 'A mid iron that drops and stops', approach: '' }, hazard: 'All round: the cove', surround: 'A ring of white sand round the islet',
        setPiece: 'Island green (an islet alone in the horseshoe\'s cove)',
        walk: 'A longtail from the islet out through the cove\'s mouth to the east arm\'s tip (about 400 m)',
      },
    }),
  }),

  // 3. THE TONGUE: from the beach on the east arm's tip across the mouth of the channel between the Maya island and B to
  // a green on a small islet; at low tide a tongue of sand reaches back from the islet toward the tee
  hole({ n: 3, name: 'The Tongue', par: 3, world: LINES[2], tips: [-38, -4], shape: 'Straight, across the channel\'s mouth',
    build: (P, L, len) => ({
      tees: { marlin: -20, manta: [-6, 8], turtle: [10, -6], clownfish: [92, 30] },   // Clownfish on a sea stack in the channel's mouth
      bunkers: [sand(P(len + 2, -17), 4.5, 3.2, 0.2), sand(P(len + 14, 10), 4, 3, -0.4)],
      green: { k: 1, lobes: [[0, 0, 12.5, 16, 12], [-8, -9, 7.5, 7.5], [7, 10, 7.5, 6.5]], apron: 3.5, contour: [{ fall: 270, pct: 1.7 }, { tier: [3, 0], up: 90, h: 0.4, w: 3.5 }], style: 'Big (about 700 m²), a Redan: it falls away to the left, a bank on the right kicks a ball on toward the pin; sand left and long right' },
      targets: [],
      versions: [
        { id: 'low', note: 'Low tide: about 105 yd of carry from the back tee to the tongue\'s tip, then firm wet sand you can land on and run up onto the green.' },
        { id: 'high', note: 'High tide: the tongue is under the sea. All carry to the green\'s front edge (about 180 yd from the back tee); the islet\'s sand ring is still dry.' },
      ],
      words: {
        story: 'The tongue: across the channel\'s mouth to an islet, a tongue of sand running out to meet you at low tide.',
        plays: 'From the beach on the Maya island\'s east arm, across the mouth of the channel to B, to a big green on a small islet. At low tide a tongue of firm wet sand reaches 70 m back from the islet toward you: carry 105 yd to it and run the ball up. At high tide it is under the sea and the shot is all carry. The Clownfish tee is a sea stack in the channel\'s mouth, a needle of rock like Ko Tapu 16 m tall, its top mown, 100 yd from the green. The green is a Redan: it falls away to the left, and a bank on its right kicks a ball on toward a left pin.',
        safe: 'Low tide: a hybrid or long iron landed on the tongue. High tide: a long iron or hybrid at the right half, off the bank.',
        bold: null,
        miss: 'Short: the tongue (low tide, firm sand) or the sea (high tide). Long: the islet\'s sand ring, then the sea. Left: sand, then the ring. Right: the bank feeds it on. The safe miss is right.',
      },
      card: {
        type: 'Redan (a par 3 the tide changes)', form: 'Par 3', feature: 'The tongue of sand; the islet; B\'s wall across the channel; the Clownfish tee\'s sea stack', job: 'The tongue is a helper at low tide (a landing strip) and gone at high; the sea the hazard; the bank right a helper (it kicks the ball on)',
        decision: 'None: one shot (the tide decides the shot: run it up or fly it)', miss: 'Small right: the bank. Small short: the tongue (low) or the sea (high). Safe miss: right',
        view: 'The channel\'s mouth in front, the tongue (at low tide) running in to the islet, B\'s cliffs across the water and the channel opening away to the left between the two islands',
        ground: 'Level across the water: tee and green within a metre of each other',
        height: 'Level, across the water', dial: 'The tide: a sand tongue short of the green at low water', shots: { tee: 'Low: a running long iron; high: a high hybrid that stops', approach: '' }, hazard: 'In front: the sea (and the tongue at low tide)', surround: 'Sand left and long right; the islet\'s sand ring',
        walk: 'A short longtail ride across to B\'s south-west beach (about 250 m)',
      },
    }),
  }),

  // 4. THE COVES: the one hole on an inside shore (Rhys, 24 November): up a shelf on B's west wall over the channel,
  // the Maya island across the water, three coves biting in from the channel; the shelf leans 6% up into the wall
  hole({ n: 4, name: 'The Coves', par: 5, world: LINES[3], keepBeach: true, tips: [-32, -6], shape: 'Dogleg left (54°, two turns), up a shelf over the channel',
    build: (P, L, len, Lw) => ({
      tees: { marlin: -10, manta: [8, 6], turtle: [44, 8], clownfish: [82, 10] }, teeLift: { marlin: 1, manta: 0.5 },
      // scalloped: the coves bite the left edge; between the first two the land is mown in one sweep out to the shelf's
      // edge, so the bold landing on the straight line is part of the fairway (Rhys's markup on round 1)
      fw: [{ e: [[96, 12, 13], [140, 18, 20], [168, 30, 22], [188, 66, 22], [212, 86, 22], [240, 92, 24], [270, 92, 26], [298, 88, 30], [322, 80, 32], [342, 58, 30], [358, 22, 28], [384, 20, 24], [410, 20, 24], [428, 20, 26], [440, 6, 28], [460, 4, 26], [484, 8, 20], [500, 10, 10]], wob: 1.6 }],
      bunkers: [sand(P(186, 32), 8, 4.2, 0.2), sand(P(len - 15, 15), 5, 3.4, -0.3), sand(P(len + 10, -14), 4.2, 3, 0.3)],
      green: { k: 1, lobes: [[0, 0, 11.5, 14.5, -15], [6, -8, 7, 7], [-5, 8, 7, 6.5]], apron: 3.5, contour: [{ fall: 260, pct: 1.8 }, { ridge: [[-10, 10], [9, 2]], h: 0.3, w: 3 }], style: 'Turned toward the bold line, falling 1.8% to the left with the shelf, a spine across it; sand right and long left; the third cove short left' },
      targets: [{ name: 'The shelf', at: P(222, 4) }, { name: 'Between the coves', at: P(267, -72), bold: true }, { name: 'Past the second cove', at: P(400, 8) }],   // 14 m nearer the coves than in the plan book: a short hitter in the rough by the bold landing reaches it
      words: {
        story: 'The coves: up a shelf on B\'s inside wall, the channel below, three coves biting in.',
        plays: 'The long shore hole, and the one on an inside shore. It runs north up a shelf 9-15 m up B\'s west wall, leaning 9% up into the jungle bank on the right; below on the left the channel, 290 m of turquoise water, with the Maya island across it. Three coves bite in from the channel, each with a beach at its head. Skirt them along the shelf and it is three shots with no water crossed. The bold line runs straight from the tee to the green over all three coves. Near the green the shelf comes down onto a beach on the left, and on the right the water at the wall\'s foot opens into a cenote, a pool cut into the cliff with the rock leaning out over it; a sea cave runs under the fairway from the third cove\'s head to it.',
        safe: 'Driver along the shelf (222 m), a fairway wood past the second cove (428 m), a wedge.',
        bold: 'Driver over the first cove to the land between the coves, about 290 yd out (a 180 yd carry), then a 3 wood or hybrid over the second and third coves at the green (about 240 yd).',
        miss: 'Left: the coves and the channel (a stroke and a drop), or a beach at a cove\'s head. Right: the jungle bank, then the wall that gives the ball back; past the lay-up, the cenote at the wall\'s foot. At the green: sand right and long left; the third cove short left; left and long left the beach running down to the channel.',
      },
      card: {
        type: 'Cape (three coves to bite off)', form: 'Scalloped by the coves', feature: 'The three coves and their beaches; the cenote and the sea cave under the fairway; the beach left of the green; the channel and the Maya island across it; the shelf\'s lean', job: 'The coves are the hazard (and the bold line\'s reward); the bank a helper (a miss right stays up); the Maya island a frame',
        decision: 'Bite off what you dare: along the shelf (three shots, no water) or over the coves (a 290 yd drive leaves about 240: reachable in two); the bold line saves about 40 yd',
        miss: 'Small: rough on the shelf. Medium left: a cove or a beach at its head. Medium right: the jungle bank. Safe miss: right',
        view: 'In front the shelf running up the wall, the first cove biting in on the left with its beach; across the channel the Maya island\'s wall and the mouth of its horseshoe',
        ground: 'Hillside bench: 9% across, up into the wall; climbs 6 m from the tee to the green',
        height: 'Hillside bench, 9% across (bold)', dial: 'One hazard\'s scale: three coves', shots: { tee: 'A fade along the shelf, or a carry over the first cove', approach: 'A wood over two coves, or a short iron from the lay-up' }, hazard: 'Down the left: the coves and the channel', surround: 'Sand right and long left; the third cove short left; the beach left; the cenote right of the approach',
        walk: 'From the green round B\'s north end (250 m) to the 5th tee on its north point',
      },
    }),
  }),

  // 5. THE SANDBAR: from B's north point along a bar of white sand and salt grass across the open channel to C, sea on
  // both sides, to a green on the beach at the gap's mouth with the Sentinel over it
  hole({ n: 5, name: 'The Sandbar', par: 4, world: LINES[4], tips: [-28, 0], shape: 'Dogleg right (16°), along a sandbar',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [16, -6], turtle: [44, 8], clownfish: [100, -34] },
      // a strip: the bar's crown of salt grass, mown
      // the stack stands in the bar's right edge at 205 m: the fairway swells left past it
      fw: [{ e: [[60, 17, 17], [110, 21, 21], [170, 23, 21], [205, 27, 15], [240, 25, 21], [300, 21, 21], [330, 17, 19], [346, 12, 14]], wob: 1.5 }],
      bunkers: [sand(P(len - 14, 15), 4.6, 3.2, -0.3), sand(P(len + 10, -12), 4, 2.8, 0.2)],
      green: { k: 1, lobes: [[0, 0, 11, 14, 10], [-6, 8, 6.5, 6]], apron: 3.5, contour: [{ fall: 0, pct: 1.6 }, { ridge: [[-10, -11], [9, -4]], h: 0.26, w: 3 }], style: 'On the beach at the gap\'s mouth, a spine across it; sand long left and short right; the Sentinel behind' },
      targets: [{ name: 'The bar', at: P(240, -2) }],
      versions: [
        { id: 'low', note: 'Low tide: the bar\'s grass with dry sand and firm wet sand either side; the sea 60-90 m from the line.' },
        { id: 'high', note: 'High tide: the wet sand is under the sea. The channel\'s side (left) keeps salt-grass rough and dry sand to 58 m; the open sea\'s side (right) dry sand to 40 m, then the sea.' },
      ],
      words: {
        story: 'The Sandbar: a bar of white sand and salt grass across the open channel, sea on both sides.',
        plays: 'From B\'s north point a sandbar runs north-west across the open channel to island C: a crown of salt grass 42 m wide, dry sand either side and firm wet sand down to the sea at low tide. At 205 m a sea stack 28 m tall stands in the bar\'s right edge; the fairway swells left past it. Ahead the gap between C and the Sentinel, and the cliff at its mouth brought out as a low headland: the green sits up on it, 6 m over the bar, with a grass ramp up its front-right corner. At high tide the wet sand goes under: the open sea\'s side (right) is then 40 m of sand from the line; the channel\'s side keeps rough and sand to 58 m.',
        safe: 'Driver down the bar left of the stack (240 m), a short iron up onto the green.',
        bold: null,
        miss: 'Either side: sand (playable). Right: the stack at 205 m (it gives the ball back to the sand at its foot), and the sea past 40 m at high tide. Left: rough, then sand. At the green: short and left the headland\'s face, which gives the ball back to the bar; front right the ramp runs a ball up; sand long left and short right.',
      },
      card: {
        type: 'Original (a sandbar fairway with a sea stack in it, to a perched green)', form: 'Strip (a sandbar: the course\'s one plain strip)', feature: 'The bar; the sea both sides; the stack in the bar; the headland under the green; the Sentinel and the gap ahead as the aim point', job: 'The sea is the hazard (both sides, beyond dry sand); the stack an obstacle (drive left of it); the headland a frame and a lie-setter (the approach plays up); the sand bands helpers; the Sentinel an aim point',
        decision: 'None: two shots, the stack to keep left of', miss: 'Small: sand (playable). Medium right: the stack; at high tide the sea. Medium left: rough and sand. Short of the green: the headland\'s face. Safe miss: left, and short right onto the ramp',
        view: 'The bar running away across the channel between two seas, the stack standing in its right edge, C\'s cliffs and the Sentinel ahead with the dark slot of the gap between them and the headland under it',
        ground: 'Perched green: the bar level, its crown 3.3 m above low water; the green on a headland 9 m up, 6 m over the bar, a ramp up its front-right corner',
        height: 'Perched green (on a headland)', dial: 'Width: the bar 42 m of grass; dry ground 100-150 m across at low tide, 80 m at high', shots: { tee: 'Straight, left of a stack', approach: 'A short iron up onto a headland' }, hazard: 'Down both sides: the sea (beyond the sand); the stack in the right edge', surround: 'The headland\'s face short and left, a ramp front right; sand long left and short right',
        walk: 'Across the headland (30 m) to the 6th tee on its north edge',
      },
    }),
  }),

  // 6. THE GAP: from the gap's mouth through the slot between C and the Sentinel, out onto C's north beach facing the
  // open sea, the green turned left along it
  hole({ n: 6, name: 'The Gap', par: 4, world: LINES[5], tips: [-26, -30], shape: 'Dogleg left (48°), through a slot',
    build: (P, L, len) => ({
      tees: { marlin: 0, manta: [12, 6], turtle: [38, -4], clownfish: [62, 0] },
      // an hourglass: the slot's floor, pinched where the gap opens onto the beach (a pot in the middle of the neck),
      // then the beach wide beyond
      fw: [{ e: [[84, 24, 24], [100, 24, 24], [126, 10, 10], [150, 10, 10], [178, 24, 24], [205, 25, 25], [230, 26, 27], [252, 30, 32], [276, 32, 30], [300, 30, 26], [322, 20, 18], [336, 12, 12]], wob: 2 }],
      bunkers: [sand(P(205, 0), 4.2, 3.6, 0, { kind: 'pot' }), sand(P(len - 15, -14), 5, 3.4, 0.3), sand(P(len + 10, 12), 4, 3)],
      green: { k: 1, lobes: [[0, 0, 11.5, 15, -8], [-6, -9, 7.5, 7], [6, 9, 7.5, 7]], apron: 3.5, contour: [{ fall: 0, pct: 1.9 }, { tier: [0, 6], up: 0, h: 0.45, w: 3 }], style: 'On C\'s north beach, a front tier up to a back shelf; sand short left and long right; the open sea beyond' },
      targets: [{ name: 'Short of the pot', at: P(178, -4) }, { name: 'Past the pot', at: P(232, 8), bold: true }],
      words: {
        story: 'The gap: through a slot 60 m wide between sheer walls 150 m tall, out onto the beach.',
        plays: 'From the headland at its mouth, 9 m up, the hole runs north and down through the gap between C and the Sentinel: a floor of sand and salt grass about 60 m wide between walls 150 m tall, like the longtail\'s channel in the photos. Short of where the slot opens onto C\'s north beach, 205 m out, a deep pot sits in the middle of the fairway; past it the beach is wide, the open sea ahead, and the hole turns left along it to the green.',
        safe: 'A hybrid or long iron short of the pot (178 m), then a mid iron round the corner.',
        bold: 'Driver over the pot (a 210 m carry) to the slot\'s mouth (232 m): a short iron to the green with the whole of it in view.',
        miss: 'Either side in the slot: the walls give the ball back to the sand at their feet. In the middle at 205 m: the pot. Past it, right: the beach, then the sea. At the green: sand short left and long right.',
      },
      card: {
        type: 'Original (a slot between sheer walls)', form: 'Hourglass (the neck where the gap opens)', feature: 'The slot between C and the Sentinel; the pot at its exit; the open sea beyond', job: 'The walls are a frame and helpers (they give the ball back); the pot a centre-line hazard',
        decision: 'Centre-line hazard: lay back short of the pot (178 m, a mid iron round the corner) or carry it to the slot\'s mouth (232 m, a short iron with the green in view)',
        miss: 'Small: rough on the slot\'s floor. Medium: the sand at the walls\' feet. In the middle at 205 m: the pot. Safe miss: short',
        view: 'In front the slot running away between two sheer walls, a strip of sky above it and the sea at its far end',
        ground: 'Half-pipe: the slot\'s floor dishes 2 m to its middle and meets the walls; from the headland it falls 5 m through the slot to the beach',
        height: 'Half-pipe (the floor between the walls)', dial: 'Width: a slot 53 m wide between walls 150 m tall', shots: { tee: 'Straight down a corridor, to a number', approach: 'A short or mid iron left round a corner' }, hazard: 'In the middle at the neck: a deep pot', surround: 'Sand short left and long right; the beach and the sea beyond',
        walk: 'Along the beach (30 m) to the 7th tee',
      },
    }),
  }),

  // 7. THE OVERHANG: along C's outer north shore round a cove, under a cliff that leans out 40 m overhead; drivable
  // straight across the cove's mouth
  hole({ n: 7, name: 'The Overhang', par: 4, world: LINES[6], tips: [-24, 0], shape: 'Dogleg right (55°), round a cove',
    build: (P, L, len, Lw) => ({
      tees: { marlin: 0, manta: [14, 6], turtle: [30, 8], clownfish: [40, -4] },
      // a hook: the fairway wraps round the cove's head under the cliff; the straight line to the green crosses the cove
      fw: [{ lobes: [[96, -6, 40, 30], [140, -8, 40, 34, 10], [180, 2, 36, 36, 30], [222, 6, 32, 34, 6], [252, 2, 18, 17]], join: 18, wob: 3 }],
      // round 8 (Rhys's markup): one long bunker in the cliff's foot, under the overhang, 100 m of it touching the fairway
      bunkers: [{ pts: [P(136, -40), P(160, -41), P(188, -40), P(214, -39), P(236, -36)], hw: [9, 11], at: P(188, -40), rx: 10, rz: 50 }, sand(P(len - 13, -14), 4.5, 3.2, 0.2), sand(P(len + 9, 11), 4, 2.8, -0.3)],
      green: { k: 1, lobes: [[0, 0, 10.5, 13, 30], [-5, 7, 5.5, 5]], apron: 3, contour: [{ fall: 220, pct: 1.4 }, { bowl: [0, 0], r: 10, h: 0.12 }, { ridge: [[-8, 9], [7, 10]], h: 0.3, w: 2.5 }], style: 'Small (420 m²), turned toward the bold line, a shallow dish with a ridge behind; sand left and long right' },
      targets: [{ name: 'Round the corner', at: P(160, -4) }, { name: 'Across the cove', at: L.at(-1), bold: true, pin: true }],
      words: {
        story: 'The overhang: round a cove on the open sea\'s shore, under a cliff that leans out overhead.',
        plays: 'Along C\'s outer north shore, the open sea on the right. The beach rounds a cove at the foot of a cliff that leans out 40 m overhead, hung with stalactites; the green sits on the beach beyond the cove. Round the sand it is an iron and a wedge; straight across the cove\'s mouth the green is about 270 yd away, open in front.',
        safe: 'A long iron round the corner (160 m), a wedge.',
        bold: 'Driver straight across the cove at the green (about 270 yd).',
        miss: 'Right: the cove (a stroke and a drop), then the open sea; the beach leans that way, so a ball landed on the right runs on. Left: the long bunker in the cliff\'s foot, under the overhang, then the cliff, which gives a ball back. At the green: sand left and long right; the beach behind and right, out to the open sea.',
      },
      card: {
        type: 'Original (a drivable beach hole under a cliff)', form: 'Hook', feature: 'The leaning cliff and its stalactites; the cove; the open sea', job: 'The cliff is a frame and a helper (it gives a ball back); the cove the hazard (the bold line crosses it)',
        decision: 'Drivable par 4: driver across the cove (about 270 yd, the green open in front) or an iron round the sand and a wedge',
        miss: 'Small: the beach. Medium right: the cove. Medium left: the long bunker under the overhang. Safe miss: left',
        view: 'The beach running away under the leaning cliff on the left, the cove on the right with the open sea past it, the green across the cove',
        ground: 'Hillside bench: level along, the landing area leaning about 8% across from the cliff\'s foot down toward the open sea; the beach a metre or two above high water',
        height: 'Hillside bench (8% across, falling to the sea)', dial: 'Length: drivable across the cove (300 yd round, 270 straight)', shots: { tee: 'A long iron to a number, or driver over water', approach: 'A wedge' }, hazard: 'Inside the bend: the cove; outside it, the long bunker in the cliff\'s foot', surround: 'Sand left and long right; the beach behind and right',
        walk: 'Along C\'s west beach (200 m) to the point and the 8th tee',
      },
    }),
  }),

  // 8. THE STACK: a short iron from C's west point out to a flat-topped sea stack standing alone in the open bay, a
  // rock rim round its back and a spire on the rim
  hole({ n: 8, name: 'The Stack', par: 3, world: LINES[7], tips: [-26, 18], shape: 'Straight, out to a sea stack',
    build: (P, L, len) => ({
      tees: { marlin: [-15, 10], manta: [0, -6], turtle: [20, 6], clownfish: [33, -4] },   // spread out (Rhys, 25 November): about 145, 130, 110, 95
      bunkers: [],
      green: { k: 1, lobes: [[0, 0, 8.8, 11.5, 8], [-3, 5, 4.6, 4.2]], apron: 1.2, contour: [{ fall: 0, pct: 1.5 }, { bowl: [0, 2], r: 8, h: 0.16 }], style: 'Small (320 m²) on a flat-topped stack, tilted toward the tee, a shallow dish; a rim of rock round its back and the spire on it' },
      targets: [],
      words: {
        story: 'The stack: out to a green on a flat-topped sea stack standing alone in the bay.',
        plays: 'From the point at C\'s west end, out over open water to a stack in the middle of the bay, its flat top all green, a rim of rock round its back half and a spire of rock on the rim. Everything but long is the sea. The forward tees play from further out on the point.',
        safe: 'A short iron, high, to the middle: the rim holds a long ball.',
        bold: null,
        miss: 'Short, left, right: the sea. Long: the rim, which holds it.',
      },
      card: {
        type: 'Short (a sea-stack green)', form: 'Par 3', feature: 'The stack; its rim of rock; the spire', job: 'The sea is the hazard (all carry: the green is the island); the rim a helper (it holds a long ball); the spire a frame and the landmark across the bay',
        decision: 'None: one shot', miss: 'Everything but long is in the sea; long is held by the rim',
        view: 'The open bay in front, the stack and its green 130 m out with the spire behind it, the flats and the Hong beyond (the 9th)',
        ground: 'Uphill to a rock top: the green 4 m above the tee',
        height: 'Uphill to a rock top', dial: 'Green size: 320 m² on a sea stack', shots: { tee: 'A short iron, high, that stops', approach: '' }, hazard: 'All round: the sea', surround: 'A rim of rock behind; the sea everywhere else',
        setPiece: 'Postage stamp (on a sea stack)',
        walk: 'A longtail out to the tee rock',
      },
    }),
  }),

  // 9. THE HONG. Round 3 (24 November) made it a dogleg round a spit with an island fairway inside the corner that the
  // high tide covers; round 4 pushed the corner out and put a moat round the island; round 5 (below) re-laid it.
  hole({ n: 9, name: 'The Hong', par: 5, world: LINES[8], tips: [-24, 4], shape: 'Over the sea to an island, or three shots; through a cave',
    // Round 5 (Rhys, 25 November): the tee on a rock down and left in the open water, so the island is straight over
    // the sea from it; the right fairway ends short in the sea, a gap of water, then the intermediate fairway down to
    // the cave beach. Taking the right fairway it is three shots for everyone: no drive can run on to within about
    // 300 yd of the green. Only the island (a 230 yd carry onto it, the cave open from its upper part 260 yd out; gone at high tide) gets you there in two.
    build: (P, L, len, Lw) => {
      // round 6 (Rhys, 25 November): the island fairway a triangle, its point toward the tee (`ISLAND9`), and one
      // fairway from the cave's mouth up round the cave beach, the shape he drew (plan coordinates)
      const isl = ISLAND9.plan.map(p => Lw(p[0], p[1])), island = Lw(...ISLAND9.aim);   // round 7: the island's upper half, where the cave's mouth opens; from its lower part the south tower hides the flag
      const mouth = smoothPoly([[-213, 760], [-206, 773], [-196, 790], [-186, 808], [-176, 823], [-161, 832], [-146, 831], [-135, 824], [-133, 808], [-138, 791], [-144, 774], [-150, 757], [-157, 741], [-166, 731], [-178, 731], [-192, 739], [-205, 746]], 2, true).map(p => Lw(p[0], p[1]));
      return {
        tees: { marlin: 0, manta: [14, 6], turtle: [64, 4], clownfish: [102, -4] },
        // the split form: the right fairway up from the tee rock, stopping short of the sea; the intermediate fairway
        // over the gap down to the cave beach; the cave's floor mown through to the green; the island on the left
        fw: [{ e: [[136, 15, 17], [158, 24, 21], [185, 17, 27], [212, 27, 28], [238, 19, 28], [262, 26, 24]], wob: 2.5 },   // round 7: the left edge in and out
          // round 7 (Rhys's outline): the right fairway swells right over its upper half and runs on to the land's end
          { poly: [[-38, 776], [-45, 787], [-51, 797], [-45, 806], [-34, 817], [-21, 828], [-10, 835], [-2, 829], [9, 812], [23, 792], [40, 768], [51, 748], [51, 740], [48, 727], [48, 714], [50, 702], [35, 698], [5, 745]].map(p => Lw(p[0], p[1])), wob: 2.5 },
          { poly: mouth, wob: 2 },
          { e: [[414, 12, 12], [470, 13, 13], [len - 22, 11, 11]], wob: 1.5 },
          { poly: isl, wob: 2.5 }],
        bunkers: [sand(P(len - 20, -20), 4.6, 3.2, 0.3), sand(P(len + 18, 16), 4.2, 3), sand(P(len + 4, -26), 3.6, 3, 0.5)],
        green: { k: 1.2, lobes: [[0, 0, 15, 17, 8], [-9, -10, 9, 8.5], [8, 11, 9, 8]], apron: 4, contour: [{ fall: 40, pct: 1.6 }, { tier: [0, 3], up: 0, h: 0.4, w: 3.5 }], style: 'Huge (1,400 m²) on a shelf 4 m over the cave floor, a back tier, tilted toward the lagoon; sand short left, long right and left; the beach shack behind' },
        targets: [{ name: 'The right fairway', at: P(232, 2) }, { name: 'The intermediate fairway', at: Lw(-158, 790) }, { name: "The cave's mouth", at: P(452, 0) }],
        versions: [
          { id: 'low', note: 'Low tide: the island fairway is out of the water, water all round it. Carry about 230 yd of open sea onto it; from its far part, 260 yd out and more, the green is about 225 yd away straight through the cave. By the right fairway it is three shots.',
            targets: [{ name: 'The right fairway', at: P(232, 2) }, { name: 'The island', at: island, bold: true, island: true }, { name: 'The intermediate fairway', at: Lw(-158, 790) }, { name: "The cave's mouth", at: P(452, 0) }, { name: 'Through the cave', at: L.at(-1), bold: true, pin: true, second: true }] },
          { id: 'high', note: 'High tide: the island fairway is under the sea. Three shots: the right fairway, over the gap to the intermediate fairway at the cave\'s mouth, a short iron through the cave.' },
        ],
        words: {
          story: 'The Hong: over the open sea to an island fairway, or three shots by the right fairway and over a gap, then through a sea cave to a green in a hidden lagoon.',
          plays: 'A longtail takes you to the tee rock, alone in the open water. Straight ahead, low in the sea with water all round it, lies an island of salt grass in line with the dark mouth of a sea cave. To the right a spit runs up from the rock: the right fairway, which stops short in the sea; past a gap of water the intermediate fairway runs down to the cave\'s mouth. Through the cave (40 m high, mown through) the green sits on a shelf 4 m up: 1,400 m², the lagoon below it. By the right fairway it is three shots for everyone: the best drive leaves about 280 yd and can\'t run on. At low tide the island is the way in two: a 230 yd carry over open sea reaches it, but only from its far part, 260 yd out and more, is the cave open, about 225 yd straight through it. At high tide it is gone.',
          safe: 'A long iron or wood up the right fairway (about 230 m, short of the sea at its end), a mid iron over the gap to the intermediate fairway at the cave\'s mouth, a short iron through the cave.',
          bold: 'Low tide only: driver over the open sea onto the far part of the island fairway (about 285 yd out; a 230 yd carry reaches its near end, but from there the cave is hidden), then a 3 wood straight through the cave at the green (about 225 yd).',
          miss: 'Up the right fairway: dry sand on the right, the sea on the left, and the sea past its end (about 295 yd out). Going for the island: the sea all round it. Short of the cave: the cave beach\'s dry sand comes up to the intermediate fairway\'s right and far edges. Through the cave: the walls give a ball back; the roof is 40 m up. At the green: sand short left, long right and left; the lagoon left.',
        },
        card: {
          type: 'Original (an island fairway over the open sea, or three shots past a gap; a green out of a sea cave)', form: 'Broken (the right fairway, a gap of water, the intermediate fairway; or the island fairway over the water)', feature: 'The tee rock; the right fairway ending in the sea; the gap; the island and its moat; the sea cave; the lagoon', job: 'The island the bold landing (low tide only); the sea at the right fairway\'s end stops a drive running on; the gap the lay-up\'s carry; the cave an obstacle and the reveal',
          decision: 'Go or lay up (low tide): carry the open sea to the far part of the island fairway and go at the green through the cave (about 225 yd), or three shots by the right fairway; at high tide it is three shots',
          miss: 'Small: dry sand right of the right fairway. Medium: the sea on its left. Long: the sea past its end. Going for the island: the sea all round it. Safe miss: right',
          view: 'From the tee rock the island low in the water straight ahead with the cave\'s dark mouth in the Hong\'s wall beyond it, the right fairway running away on the right, the stack and its spire behind on the right',
          ground: 'Perched green: the fairways level, the cave floor level, then a 4 m bank up to the green\'s shelf',
          height: 'Perched green', dial: 'Green size past anything real: about 1,400 m², just out of a sea cave', shots: { tee: 'A carry over open sea to an island, or a club that stops short of the sea', approach: 'A wood through a cave, or a short iron' }, hazard: 'The sea: left of and past the right fairway, in the gap, round the island', surround: 'Sand short left, long right and left; the lagoon left',
          walk: 'The beach shack, 30 m beyond the green; a longtail back round to the stilt village',
        },
      };
    },
  }),
];
// the bold lines the plan book draws and flies: 4 over the first cove, 6 over the pot, 7 straight at the green, 9 onto the island
HOLES[3].boldPath = HOLES[3].targets.find(t => t.bold).at;
HOLES[5].boldPath = HOLES[5].targets.find(t => t.bold).at;
HOLES[6].boldPath = HOLES[6].pin;
HOLES[8].boldPath = HOLES[8].versions[0].targets.find(t => t.island).at;
// alike.mjs reads a hook against the straight line from tee to green, which its fairway wraps round
HOLES[6].formLine = [HOLES[6].line[0], HOLES[6].pin];
