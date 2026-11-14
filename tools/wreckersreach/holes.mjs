// Wrecker's Reach, plan book round 1: the first true links. Nine holes on a spit of dunes on a ship-graveyard
// coast, age of sail only, in a storm clearing. The routing, the skeleton (par 36: 5 3 4 4 5 3 3 5 4) and the nine
// hole cards were approved by Rhys on 13 November 2026 (claude/wreckers-reach-layout.md in the project); this file
// draws them: real fairway outlines from the forms, green shapes, the pots, heights, tee sets and tips spots.
// No special rule: firm running turf, a strong sea wind, sod-faced pots. Off the fairway: a band of fescue (cheap),
// then the dunes (pale sand with tussocks of dune grass: a sand lie between them, a hack out in one), then the
// beach (firm wet sand that runs). The sea, the lagoon, the Cauldron and the creek are the only penalty ground.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the
// line, y up from the hole's `base`, the back tee's height). `route` turns the layout doc's world line ([x east,
// n north]) into `legs` and `place`; `L(x, n)` turns a world point into the hole's frame. The height along each
// line follows the world's floor (world.mjs), with `prof` knots [[s, dy]] added to it.
import { lineOf, lengthOf, at, headingAt, YD } from './geo.mjs';
import { LINES, SHARED_FW, GALLEON } from './world.mjs';

export const COURSE = {
  id: 'wreckersreach', name: "Wrecker's Reach", theme: 'links', altFt: 30, turf: 'links',
  signature: { time: 'late afternoon', light: 'a storm clearing: dark squalls out to sea, sun shafts on the dunes, a bright wet beach', wind: 'Sea wind (14-20 mph) from the south-west, steady', weather: 'clearing', temp: 'cool' },
  teeSets: [
    { id: 'galleon', name: 'Galleon', color: '#1d2e4a', minDrive: 260 },
    { id: 'frigate', name: 'Frigate', color: '#8c2f1e', minDrive: 230 },
    { id: 'brig', name: 'Brig', color: '#ece6d4', minDrive: 200 },
    { id: 'lugger', name: 'Lugger', color: '#2f7f8c', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'manofwar', name: 'Man-of-War', color: '#b8862b', minDrive: 290 },
  card: {
    hook: 'A true links on a spit where a sandbar has been taking ships for centuries. No special rule: firm running turf (a drive runs about 35 yd), a strong steady sea wind, sod-faced pots that cost about a shot. The wrecks are the walls, the markers and the backstops. The dunes are pale sand with tussocks of dune grass; the sea, the lagoon, the Cauldron and the creek are the only penalty ground.',
    skeleton: 'Par 36: 5 3 4 4 5 3 3 5 4, the first with three par 3s and three par 5s. Out and back: north up the spit to the point (1-5), home along the lagoon (6-9). A par 5 opener on a fairway shared with the 9th; a long par 3 early (the 2nd, 205 yd, to a double green it shares with the 8th); back-to-back par 3s (6, 7); home into the wind on the long 8th and the table-top 9th.',
    classics: 'Bottle and a Road green (4), Cape (5), Dell (6). Set pieces: the shared double green (2 and 8), the shared fairway (1 and 9); and two of the brief\'s own: a field of 22 pots (8), a blind shot over a dune (6).',
    decisions: 'Three, each a different type: a drivable par 4 (3: over the galleon), bite off what you dare (5: two cuts across the Cauldron\'s corners, reachable in two), high road or low road (9: onto the table or beside it). Never two in a row; one in the last two holes.',
    landmarks: 'The beacon tower on the point (seen from 1 to 5); the false light, a wreckers\' lantern on the dune behind the double green (2, 3, 8); the galleon\'s stern castle (2, 3, 4); the Wrecker\'s Inn (8, 9). The reveal: the 5th tee, where the point, the Cauldron and the open sea come into view at once.',
    rhythm: 'A gentle downwind opener on the widest fairway of the nine. The hardest run is 4 and 5 (465 yd across the wind, then round the Cauldron). The back-to-back par 3s are the breather. Home into the wind on the 580 yd 8th through the pots and the table-top 9th. Par 3s 135, 165, 205; par 4s 330, 430, 465; par 5s 515, 540, 580.',
    forms: 'Six fairways, six forms: 1 funnel, 3 broken, 4 hourglass, 5 hook, 8 scalloped, 9 fan. A dune ridge beside every fairway, each doing a different job.',
    heights: 'Low on purpose: 1 crest and run, 2 uphill to a low table, 3 valley carry (bold), 4 half-pipe, 5 fall-away, 6 blind over a 9 m dune, 7 the drop (the only one), 8 level (the pots are the hole), 9 table top (bold).',
    dials: 'One pushed on every hole: 1 width (a 90 m fairway, and the shared field beside it), 2 green size (a 2,200 m² double green: past real golf), 3 length (330 yd, drivable), 4 length (465 yd across the wind), 5 bend (125° clockwise round the rim), 6 green hidden in a hollow, 7 a carry (all the way over the creek), 8 bunker count (22 pots: past real golf), 9 height (a 5.5 m face onto a dune table).',
    newBorrowed: 'New to the register: a shared double green; a shared fairway; a hole clockwise round a rim; back-to-back par 3s; a long par 3 early; a field of pots; a Dell; three par 5s and three par 3s; firm links turf. Borrowed (one): relics in the ground (the wrecks). No waterfall, bridge, chasm, punchbowl, ledge tee shot or climb to the clubhouse.',
  },
};
export const BACK = 'galleon', FRONT = 'lugger';

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
// a world bearing (degrees) as a form's `rot` in the hole's frame (its rx then lies along that bearing)
const rotOf = (place, bearing) => (bearing - place.heading - 90) * Math.PI / 180;

function hole(def) {
  const R = route(def.world), L = lineOf(R.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o), Lw = localOf(R.place);
  const h = def.build(P, L, len, Lw, b => rotOf(R.place, b));
  h.line = L; h.len = len; h.pin = L.at(-1); h.place = R.place; h.legs = R.legs; h.L = Lw;
  if (h.green && h.green.k) h.green.lobes = h.green.lobes.map(([u, v, rx, rz, rot = 0]) => [u * h.green.k, v * h.green.k, rx * h.green.k, rz * h.green.k, rot]);
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : v.world ? Lw(...v.world) : P(v[0], v[1]);
  // card yards: along the line on a par 4 or 5; on a par 3 straight from the pad to the pin (a pad beside the line)
  const yd = (v, p) => Math.round((def.par === 3 ? Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) : len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) h.yards[k] = yd(v, h.teePts[k]);
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = yd(tp, h.tipsPt);
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}
// the shared fairway's outline in a hole's frame
const shared = Lw => ({ poly: SHARED_FW.map(([X, Z]) => Lw(X, -Z)), wob: 2.5, shared: true });
// pots: small (3-5 m), sunk, a steep sod face toward the green
const pot = (at, r = 2.7, more = {}) => ({ at, rx: r, rz: r * 1.1, pot: true, ...more });

export const HOLES = [
  // 1. THE HAULING GROUND: out from the inn across the ground where the fishing boats are pulled up
  hole({ n: 1, name: 'The Hauling Ground', par: 5, world: LINES[0], tips: [-34, 0], shape: 'Straight, north up the spit',
    build: (P, L, len, Lw) => ({
      tees: { galleon: 0, frigate: [20, 10], brig: [64, -28], lugger: [118, 58] },
      // a funnel: 90 m wide off the tee, closing between the dunes all the way to the green; the shared field (the
      // 9th's way home) lies against its right side
      fw: [{ e: [[74, 30, 30], [112, 45, 45], [165, 46, 44], [215, 42, 41], [265, 36, 34], [320, 31, 28], [380, 25, 24], [430, 20, 19], [462, 14, 14], [480, 10, 10]], wob: 3.5 }, shared(Lw)],
      corridor: 11,
      cant: [[120, 330, 1.8]],   // leans a little right, toward the shared field
      // the low ridge at 235 yd: carry it and run on down the far side
      forms: [{ at: P(215, -6), rx: 52, rz: 30, h: 4.2, label: 'the ridge' }],
      prof: [[0, 0], [200, 0], [262, -1], [340, -1.2], [420, 0], [len, 0]],
      bunkers: [pot(P(298, 31)), pot(P(392, -21), 2.9), pot(P(len - 21, -13), 2.6)],
      green: { lobes: [[0, 0, 12, 15.5, -8], [-5, 10, 7.5, 6, 0]], apron: 4, contour: [{ fall: 10, pct: 1.7 }, { ridge: [[-10, -9], [8, -3]], h: 0.24, w: 2.6 }], style: 'A pear open at the front, falling 1.7% toward you with a low spine across its middle; short grass runs off tight on every side, so the pitch-and-run is the shot' },
      grass: [{ at: P(130, -75), r: 30, d: 0.08 }, { at: P(130, 70), r: 25, d: 0.1 }],
      targets: [{ name: 'The ridge', at: P(218, -4) }, { name: 'The lay-up', at: P(410, 2) }],
      words: {
        story: 'The hauling ground: out from the inn past the luggers pulled up on the sand, down a fairway the 9th comes home on.',
        plays: 'A gentle opener with the wind behind. From beside the Wrecker\'s Inn the fairway is 90 m wide off the tee, and on the right it opens into the shared field the 9th comes home down, so there is room everywhere. It closes between the dunes all the way in. A low ridge crosses at 235 yd: carry it and the firm turf runs the ball 40 yd on down the far side. Three pots only, none where a drive lands. The green is a pear with tight short grass all round it: pitch it short and let it run.',
        safe: 'Driver at the ridge (218 m) and let it run on down the far side, a long second to the lay-up (410 m), a pitch-and-run.',
        bold: null,
        miss: 'Left, the fescue then the dunes and the luggers on the hauling ground. Right, the shared field: a fine lie, a worse angle, a row of dune grass to play over. At the green, the one pot front left.',
      },
      card: {
        type: 'Original (a gentle opener)', form: 'Funnel', feature: 'The ridge at 235 yd; the shared field beside the fairway; the luggers on the hauling ground', job: 'The ridge is a helper (carry it and run on) and a lie-setter (short of it, an upslope); the shared field is room; the luggers are a frame for the left',
        decision: 'None: one wide line, the width is the point', miss: 'Small: fescue left, the shared field right. Medium: the dunes left, the screen of dune grass right. Big: the hauling ground and the luggers far left. No penalty ground. Safe miss at the green: short',
        view: 'In front the inn\'s corner and the wide fairway; in the middle the ridge across it and the dunes closing in; beyond, the beacon on the point far up the coast. The landing area shows',
        ground: 'Crest and run: level to the ridge (4 m) at 235 yd, then running down 1 m more beyond it; leaning 1.8% right; +3 m to the green',
        height: 'Crest and run', dial: 'Width: a 90 m fairway, and the shared field beside it (the edge of real golf)', shots: { tee: 'Driver as hard as you like, downwind', approach: 'A pitch-and-run onto a green with tight run-offs' }, hazard: 'Across: the ridge (a helper)', surround: 'A tight mown run-off', setPiece: 'Shared fairway (with the 9th)',
      },
    }),
  }),

  // 2. THE FALSE LIGHT: a long iron run up onto one end of the double green, the lantern behind as the aim point
  hole({ n: 2, name: 'The False Light', par: 3, world: LINES[1], tips: [-14, 0], shape: 'One shot, uphill',
    build: (P, L, len, Lw) => ({
      tees: { galleon: 0, frigate: [12, -5], brig: [38, 9], lugger: [64, -8] },
      corridor: 12,
      prof: [[0, 0], [100, 0.3], [150, -0.5], [len, 0]],
      green: { shared: true, apron: 4 },
      // mown apron short left; a bank behind (in world space: north of the green) that feeds back; the false
      // light's dune behind to the left
      extraFw: [{ at: P(len - 26, -16), rx: 13, rz: 17, rot: 0.4 }],
      forms: [{ world: [38, 773], rx: 30, rz: 9, bearing: 95, h: 2.4, label: 'the bank' }, { world: [-8, 778], rx: 26, rz: 22, h: 5.5, label: 'the false light\'s dune' }],
      bunkers: [pot(P(len - 24, 16), 2.6), pot(P(len - 33, 10), 2.4)],
      grass: [{ world: [-8, 778], r: 18, d: 0.45 }],
      targets: [],
      words: {
        story: 'The false light: a wreckers\' lantern on a post on the dune behind the green, hung to lure ships onto the bar.',
        plays: 'A long iron, 205 yd, uphill onto the west end of the double green the 8th comes into from the other side. The wreckers\' lantern on the dune behind is the aim point. The ground runs up the last 40 m to a low table: land it short on the apron and let it run up. Two pots short right, a bank behind that feeds a long ball back. Land on the 8th\'s half and you have a 40 m putt over a swale.',
        safe: 'A long iron short and left, onto the apron, running up.',
        bold: 'At a back pin, carried most of the way.',
        miss: 'Short right, two pots. Short left, the apron: an easy chip. Long, the bank feeds it back. Right, onto the 8th\'s half: the long putt over the swale.',
      },
      card: {
        type: 'Original (a long par 3 early)', form: 'None (par 3)', feature: 'The double green; the false light on its dune', job: 'The lantern is the aim point; the bank behind is a helper; the double green is the set piece',
        decision: 'None: a par 3', miss: 'Small: the apron, the bank. Medium: the pots short right. Big: the dunes left. No penalty ground. Safe miss: short left',
        view: 'In front the fescue and the rise; in the middle the green\'s west end and its two pots; beyond, the lantern on its dune and the green running away right toward the 8th. The flag shows',
        ground: 'Uphill to a low table: +4 m, most of it in the last 40 m; the 2nd\'s half falls 1.6% toward the tee',
        height: 'Uphill par 3, to a low table', dial: 'Green size: a 2,200 m² double green with two flags (past real golf)', shots: { tee: null, approach: 'A long iron landed short and run up' }, hazard: 'In front of the green: two pots short right', surround: 'A bank that feeds', setPiece: 'Shared green (with the 8th)',
      },
    }),
  }),

  // 3. THE GALLEON: a galleon on her side in a sandy hollow across the fairway; drivable over her deck
  hole({ n: 3, name: 'The Galleon', par: 4, world: LINES[2], tips: [-30, 0], shape: 'Dogleg right over the hollow', layUp: true,
    build: (P, L, len, Lw, rot) => {
      const pin = L.at(-1), dl = Math.hypot(...pin), D = t => [pin[0] * t / dl, pin[1] * t / dl];   // the direct line, tee to pin
      return {
        tees: { galleon: 0, frigate: [16, 9], brig: [48, -15], lugger: [86, 46] },
        // broken: the near fairway to the hollow's lip, the far fairway beyond the galleon running to the green
        fw: [{ e: [[62, 22, 22], [100, 30, 31], [140, 32, 33], [165, 30, 31], [180, 25, 24], [190, 15, 15]], wob: 2.8 },
          { lobes: [[238, 13, 22, 31, 0], [262, 5, 19, 23, 0], [284, 0, 12, 13, 0]], join: 10, wob: 2.5 }],
        corridor: 10,
        // the hollow: 6 m down, right across both lines, the galleon lying in it
        forms: [{ world: [-80, 1004], rx: 62, rz: 19, bearing: GALLEON.bearing, h: -8, p: 2.8, sand: true, label: 'the hollow' }],
        bunkers: [pot(P(len - 13, -12), 2.5), pot(P(len + 11, -8), 2.4), pot(P(len + 5, 13), 2.4)],
        green: { lobes: [[0, 0, 9, 12, 18], [4, -6, 5.5, 5, 0]], apron: 3, contour: [{ fall: 30, pct: 1.8 }, { tier: [-2, 5], up: 190, h: 0.35, w: 4 }], style: 'Small and set from front right to back left, open from the front right (where the bold drive runs in), falling 1.8% toward that opening with a shelf at the back; three pots round its left and back' },
        grass: [{ world: [-60, 1028], r: 12, d: 0.55 }, { world: [-118, 1024], r: 18, d: 0.5 }, { world: [-48, 990], r: 14, d: 0.45 }],
        stands: [{ world: [-52, 1027], rx: 3.5, rz: 3.5, h: 1.9, job: 'marker: the far side of the hollow' }],
        boldPath: D(236), reliefLand: 236,
        targets: [{ name: 'The lay-up', at: P(172, -4) }, { name: 'Over the galleon', at: D(236), bold: true }],
        words: {
          story: 'The galleon: she came ashore on her side, and the sand built a hollow round her.',
          plays: 'A galleon lies on her side in a sandy hollow 6 m deep right across the fairway, her stern castle at the east end. The safe way is a lay-up to the hollow\'s lip, about 200 yd, then a full wedge over her. The bold way is straight at the stern castle: carry about 240 yd over the deck and the firm far fairway runs the ball on toward a small green ringed by three pots, open from the front right. Tee to pin is 312 yd direct. Find the hull and the ball drops at its foot in the hollow.',
          safe: 'Lay up to the lip (172 m), then a full wedge over the galleon.',
          bold: 'Carry the stern castle (about 240 yd) and run up to or onto the green.',
          miss: 'Into the hollow: a sand lie 6 m down, a pitch up over the lip. Into the hull: it drops at the foot. Right of the far fairway, the dunes. At the green, three pots left and long; the front right is open.',
        },
        card: {
          type: 'Original (a drivable par 4)', form: 'Broken (the hollow across it)', feature: 'The galleon on her side and her hollow', job: 'An obstacle to carry and a hazard (the hollow); the stern castle is the aim point for the bold line',
          decision: 'Drivable par 4: carry the deck (about 240 yd) to the far fairway for a pitch or a putt, or lay up short (about 200 yd) for a full wedge over her',
          miss: 'Small: fescue. Medium: the hollow (a sand lie, never a stroke), the hull (drops at its foot), the pots by the green. Big: the dunes. No penalty ground. Safe miss at the green: front right',
          view: 'In front the near fairway; in the middle the galleon\'s hull across the hollow, the stern castle on the line; beyond, the far fairway and the flag. Both lines show',
          ground: 'Valley carry: the near fairway at 12-13 m and the far fairway at 13-14, the hollow 6 m down between them; +2 m to the green',
          height: 'Valley carry', dial: 'Length: 330 yd, drivable', shots: { tee: 'A high carry over the deck (bold), or a lay-up to a number', approach: 'A full wedge over the hull, or a pitch-and-run' }, hazard: 'Across: the hollow and the galleon', surround: 'Bunkers: three pots',
        },
      };
    },
  }),

  // 4. MAN-OF-WAR: up a dune valley that feeds, through a neck, to a Road green with a man-of-war's hull behind it
  hole({ n: 4, name: 'Man-of-War', par: 4, world: LINES[3], tips: [-28, -24], shape: 'Dogleg left up the dune valley', tight: true,
    build: (P, L, len) => {
      const eh = headingAt(L, len - 1);
      return {
        tees: { galleon: 0, frigate: [40, 12], brig: [70, 0], lugger: [110, 0] },
        // an hourglass: wide short of the neck, 34 m beyond it, then wide again where the forward tees land
        fw: [{ e: [[126, 27, 28], [160, 33, 34], [192, 30, 31], [205, 16, 15], [215, 14, 13], [229, 17, 17], [240, 18, 19], [250, 21, 22], [262, 22, 22], [330, 22, 23], [380, 18, 18], [405, 13, 13], [416, 9, 9]], wob: 2.6 }],
        corridor: 10,
        // the half-pipe: dune banks 4 m up either side that feed a loose drive back
        cross: [[140, 405, 4.2, 42]],
        prof: [[0, 1.4], [40, 1.2], [95, 0], [len, 0]],   // the tees a little up, so the valley floor shows
        // the neck: a dune nose from each side
        forms: [{ at: P(208, 31), rx: 16, rz: 13, h: 3.2, label: 'the neck' }, { at: P(214, -30), rx: 15, rz: 12, h: 3 }],
        bunkers: [pot(P(199, 22), 2.6), pot(P(214, -18), 2.6), pot(P(len - 21, -12), 2.8, { depth: 2 })],
        green: { k: 0.94, lobes: [[0, 0, 13, 17, -22], [-6, 10, 8, 7, 0], [8, -9, 7, 6, 0]], apron: 3, contour: [{ fall: 40, pct: 1.6 }, { tier: [-3, 4], up: 160, h: 0.5, w: 5 }], style: 'A Road green, long and set at an angle from front right to back left, a deep pot eating its front left and the man-of-war\'s hull hard behind; falling 1.6% toward the front right, with a tier 0.5 m up across its back: run it in from the right' },
        props: [{ kind: 'hull', at: P(len + 22, -4), w: 12, l: 64, h: 10, rot: eh + Math.PI / 2, wall: true, label: 'the man-of-war' }],
        grass: [{ at: P(140, -46), r: 22, d: 0.35 }, { at: P(140, 46), r: 22, d: 0.35 }, { at: P(300, -42), r: 24, d: 0.38 }, { at: P(300, 42), r: 24, d: 0.3 }],
        targets: [{ name: 'Short of the neck', at: P(186, 4) }, { name: 'The approach', at: P(330, 2) }],
        words: {
          story: 'The man-of-war: a ship of the line driven up the beach in a gale, her hull now the wall behind the green.',
          plays: 'The longest par 4 of the nine, 465 yd up a dune valley with the wind across from the left and a little behind. The valley\'s banks rise 4 m either side and feed a loose drive back down. At about 225 yd two dune noses and a pot on each side pinch the fairway to a neck: short of it is 65 m wide; beyond it 34 m, and 40 yd closer. Then a long iron run in from the right to a Road green: set at an angle, a deep pot eating its front left, and the man-of-war\'s hull hard behind, so a long approach banks off the planking.',
          safe: 'Lay back short of the neck (186 m) and play a long iron or a wood in from the right.',
          bold: 'Thread the neck for 40 yd less and a mid iron in.',
          miss: 'Off the fairway, the banks feed it back toward the fescue. At the neck, a pot either side. At the green, the deep pot front left; long, off the hull and back onto the green or just short of it.',
        },
        card: {
          type: 'Bottle, and a Road green', form: 'Hourglass', feature: 'The dune valley and the man-of-war\'s hull', job: 'The banks are helpers (they feed a drive back); the hull is a helper behind the green (a long approach banks off it) and the frame',
          decision: 'None formally (the bottle is in the shape: lay back or thread it, 40 yd)', miss: 'Small: fescue on the banks. Medium: the neck\'s pots, the dunes up the banks. Big: over the valley\'s crest. No penalty ground. Safe miss at the green: right',
          view: 'In front the valley floor between its banks; in the middle the neck and its pots; beyond, the hull across the end of the valley. The landing area shows',
          ground: 'Half-pipe: a dune valley banked 4 m on both sides; +4 m to the green',
          height: 'Half-pipe', dial: 'Length: 465 yd, across the wind (the edge of real golf)', shots: { tee: 'Straight, to a number short of the neck, or threaded', approach: 'A long iron run in from the right, or banked off the hull' }, hazard: 'In the neck: two pots either side, and the deep pot at the green', surround: 'The wall: the hull behind; a deep pot in front',
        },
      };
    },
  }),

  // 5. THE CAULDRON: clockwise round the point with a tidal pool inside the bend
  hole({ n: 5, name: 'The Cauldron', par: 5, world: LINES[4], tips: [-30, 30], shape: 'Right round the point (125°)', flat: 16, fade: 28,
    build: (P, L, len, Lw) => ({
      tees: { galleon: 0, frigate: [18, -9], brig: [58, -36], lugger: [98, -44] },
      // a hook: the fairway wraps the Cauldron clockwise; a landing lobe on the inside of the first bend for the cut
      fw: [{ e: [[60, 22, 24], [105, 30, 36], [140, 30, 30], [180, 27, 24], [230, 28, 22], [270, 30, 25], [300, 32, 18], [350, 31, 14], [410, 27, 15], [445, 18, 15], [462, 11, 11]], wob: 3 },
        { lobes: [[236, 22, 26, 17, 0]], join: 12, wob: 2.5 }],
      corridor: 10,
      // the fall-away into the green: land short
      prof: [[0, 4.6], [12, 3.6], [42, 0], [398, 0], [412, 0.5], [len, -1.1]],
      bunkers: [pot(P(len - 26, 15), 2.6)],
      green: { lobes: [[0, 0, 10.5, 15, 12], [-5, 9, 6.5, 6, 0]], apron: 5, contour: [{ fall: 180, pct: 1.4 }, { bowl: [-4, 7], r: 10, h: 0.25 }], style: 'Set along the line of the last leg, falling 1.4% away from you toward the back (land it short and let it release), a bowl at the back left; a tussock stand behind it frames it against the sky' },
      grass: [{ world: [38, 1670], r: 82, d: 0.7, soft: 14, rim: true }, { at: P(len + 26, -2), r: 12, d: 0.55 }],
      stands: [{ at: P(len + 24, 4), rx: 6, rz: 4, h: 1.8, job: 'frame behind the green' }],
      targets: [{ name: 'Round the rim', at: P(222, -14) }, { name: 'Over the corner', at: P(236, 24), bold: true }, { name: 'The lay-up', at: P(412, -10) }],
      words: {
        story: 'The Cauldron: a tidal pool inside the point, a frigate sunk in it to her masts.',
        plays: 'The reveal: from the 5th tee the point, the Cauldron and the open sea come into view at once, the beacon tower on the left. The hole runs clockwise round the point, 515 yd, with the tidal pool inside the bend and the beach outside it. A fade follows the rim. Two cuts across the pool\'s corners each save 30 to 40 yd, and taken together they make it reachable in two: the drive over its north-west corner to the lobe of fairway inside the first bend, the second over its north-east corner with the frigate\'s masts as the aim point. Round the rim it is three shots with no water in play. The ground falls away into the green: land short.',
        safe: 'Round the rim (222 m), along it to the lay-up over the crest (404 m), a wedge in landed short.',
        bold: 'The drive over the pool\'s north-west corner (236 m), then a wood over the north-east corner at the masts.',
        miss: 'Inside, the Cauldron: a stroke and a drop. Outside, fescue, the dunes and the beach: always playable. At the green, a pot short right; over it, the tussocks behind.',
      },
      card: {
        type: 'Cape', form: 'Hook', feature: 'The Cauldron and the frigate\'s masts in it; the beacon on the point', job: 'The pool is the hazard on the inside; the masts are the aim point for the second cut; the beach outside is room; the beacon is the landmark',
        decision: 'Bite off what you dare: each cut across a corner saves 30-40 yd and both make it reachable in two; round the rim it is three safe shots',
        miss: 'Small: fescue. Medium: the dunes outside, the rim\'s beach inside. Big: the Cauldron, inside only (penalty on one side). Safe miss: outside, to the left',
        view: 'From the tee: in front the first leg; in the middle the Cauldron and the frigate\'s masts, the point and the beacon on the left; beyond, the open sea. The pool and the cut show from the tee, the second cut from the landing area',
        ground: 'Fall-away: level round the rim, then falling 3 m over the last 60 m into the green (-3 m in all)',
        height: 'Fall-away', dial: 'Bend: 125° clockwise round the rim of the point (past the edge of real golf)', shots: { tee: 'A fade along the rim, or a carry over the corner', approach: 'A wood over the second corner, or a wedge landed short to release' }, hazard: 'Diagonal: the pool inside the bend', surround: 'A fall-away; a pot short right',
      },
    }),
  }),

  // 6. THE DELL: blind over a 9 m dune to a green hidden in the hollow behind it
  hole({ n: 6, name: 'The Dell', par: 3, world: LINES[5], tips: [-14, 0], shape: 'One shot, blind over the dune',
    build: (P, L, len) => ({
      tees: { galleon: 0, frigate: [9, 5], brig: [28, -7], lugger: [50, 6] },
      corridor: 12,
      forms: [{ at: P(84, 0), rx: 44, rz: 17, h: 8.6, p: 2.2, label: 'the dune' },
        // the hollow's banks on three sides, a gap at the back
        { at: P(len - 2, -25), rx: 9, rz: 24, h: 3 }, { at: P(len - 2, 25), rx: 9, rz: 24, h: 3 }, { at: P(len + 23, -15), rx: 12, rz: 8, h: 3 }, { at: P(len + 23, 15), rx: 12, rz: 8, h: 3 }],
      green: { lobes: [[0, 0, 13, 16, 8], [-6, -9, 7, 6, 0]], apron: 4, contour: [{ fall: 0, pct: 1.3 }, { bowl: [3, 4], r: 12, h: 0.28 }], style: 'Wide and generous in the hollow, falling 1.3% toward the dune with a shallow bowl in the middle: the banks on three sides gather a ball in; a mown gap at the back' },
      props: [{ kind: 'mast', at: P(84, -3), r: 0.45, h: 13, label: 'the mast on the dune', marker: true }],
      grass: [{ at: P(84, -40), r: 22, d: 0.65 }, { at: P(84, 40), r: 22, d: 0.65 }, { at: P(84, 0), r: 16, d: 0.25 }, { at: P(len, -40), r: 16, d: 0.55 }, { at: P(len, 40), r: 16, d: 0.55 }],
      targets: [],
      words: {
        story: 'The Dell: the green hides in a hollow behind a dune, and all you have is the mast on its crest.',
        plays: 'The first of two par 3s in a row. 165 yd, blind over a dune 9 m high that stands across the line about half way. A ship\'s mast stuck in its crest is the line. The green is in the hollow behind, wide and generous, and its banks gather a ball in on three sides; a mown gap at the back lets a long one through. Dense dune grass round both ends of the dune keeps the green hidden from the tee.',
        safe: 'Take one more club than it looks, straight over the mast.',
        bold: null,
        miss: 'Short, into the dune\'s face: dune grass and sand. Left or right of the hollow, the banks bring it back down. Long through the gap: fescue behind.',
      },
      card: {
        type: 'Dell', form: 'None (par 3)', feature: 'The dune and the hollow; the mast on the crest', job: 'The dune is the obstacle; the mast is the marker; the hollow\'s banks are helpers',
        decision: 'None: a par 3', miss: 'Small: the banks gather it. Medium: the dune\'s face, the gap at the back. Big: the dune grass beyond the banks. No penalty ground. Safe miss: long, through the gap',
        view: 'In front the fescue rising to the dune\'s face; in the middle the crest and the mast; beyond, nothing of the green (blind on purpose), the lagoon\'s far shore on the left. The mast marks the line',
        ground: 'Blind over a 9 m dune: tee 12 m, the crest 21, the green 10 in its hollow (-2 m)',
        height: 'Par 3 over a dune (blind)', dial: 'Green hidden in a hollow (a Dell)', shots: { tee: null, approach: 'A blind mid iron over a marker' }, hazard: 'Across: the dune', surround: 'A bowl: banks on three sides',
      },
    }),
  }),

  // 7. THE RIBS: down off a dune top across the tidal creek to a green inside a brig's ribs
  hole({ n: 7, name: 'The Ribs', par: 3, world: LINES[6], tips: [-12, 0], shape: 'One shot, downhill over the creek',
    build: (P, L, len) => {
      const eh = headingAt(L, len - 1), pin = L.at(-1), ribs = [];
      for (let k = -5; k <= 5; k++) {   // the brig's ribs: an arc of timbers round the back of the green
        const a = eh + k * 0.24, R = 19, x = pin[0] + Math.sin(a) * R, z = pin[1] - Math.cos(a) * R;
        ribs.push({ kind: 'rib', x, z, w: 0.8, l: 1.6, h: 6.8 - Math.abs(k) * 0.42, rot: a + Math.PI / 2, label: k === 0 ? 'the brig\'s ribs' : null });
      }
      return {
        tees: { galleon: 0, frigate: [7, -5], brig: { world: [150, 1310] }, lugger: { world: [170, 1301] } },
        corridor: 12,
        prof: [[0, 2.2], [14, 1.6], [34, 0], [len, 0]],
        bunkers: [pot(P(len - 17, -10), 2.5)],
        green: { lobes: [[0, 0, 11, 14, -15], [4, 8, 6.5, 5.5, 0]], apron: 3, contour: [{ fall: 0, pct: 1.2 }, { ridge: [[-7, 10], [7, 7]], h: 0.14, w: 3.4 }], style: 'Inside the ribs, falling 1.4% toward the creek, a low spine across it; the ribs behind kick a long ball back on' },
        props: ribs.map(r => ({ ...r, at: [r.x, r.z] })),
        grass: [{ at: P(16, -26), r: 14, d: 0.5 }, { at: P(16, 26), r: 14, d: 0.5 }],
        targets: [],
        words: {
          story: 'The ribs: all that is left of a brig is her keel and her ribs, standing round the green like a fence.',
          plays: 'The second par 3 in a row and the only drop: 135 yd down 8 m from a dune top, across the tidal creek, to a green inside a brig\'s ribs. From the back tees it is all carry over the water. The ribs stand round the back of the green and kick a long ball back on. The forward tees play from the near bank round the creek\'s end, with no carry at all. A pot short left.',
          safe: 'A short iron at the middle; long is fine, the ribs bring it back.',
          bold: null,
          miss: 'Short, the creek: a stroke and a drop. Short left, the pot. Long, off the ribs; through a gap between them, fescue and dune.',
        },
        card: {
          type: 'Original (a short par 3, the drop)', form: 'None (par 3)', feature: 'The creek and the brig\'s ribs', job: 'The creek is the hazard in front; the ribs are a helper behind (a backstop)',
          decision: 'None: a par 3', miss: 'Small: the ribs, the fringe. Medium: the pot, the bank above the creek. Big: the creek, in front only (penalty on one side). Safe miss: long',
          view: 'From the dune top: in front the drop; in the middle the creek and the green inside the ribs; beyond, the lagoon and the Strand. All of it shows',
          ground: 'The drop (the only one): tee 17 m, the creek at sea level, the green 9 m (-8 m)',
          height: 'Drop par 3', dial: 'A carry: all the way over the creek from the back tees', shots: { tee: null, approach: 'A high short iron that carries the creek' }, hazard: 'In front of the green: the creek', surround: 'The wall: the ribs behind',
        },
      };
    },
  }),

  // 8. THE GRAVEYARD: home into the wind through 22 pots, each scoured round a keel, an anchor or a spar
  hole({ n: 8, name: 'The Graveyard', par: 5, world: LINES[7], tips: [-28, 28], shape: 'Dogleg right, home along the lagoon',
    build: (P, L, len) => {
      // six clusters biting from alternate sides (- left, the lagoon's side; + right): [s, side, count]
      const CL = [[150, -1, 4], [207, 1, 4], [270, -1, 4], [332, 1, 4], [398, -1, 3], [456, 1, 2]], pots = [];
      const RELIC = ['a keel', 'an anchor', 'a spar'];
      for (const [s0, sd, n] of CL) for (let i = 0; i < n; i++) pots.push(pot(P(s0 + i * 8.5, sd * (17 + (i % 2) * 6 + (i === n - 1 ? 3 : 0))), 2.4 + 0.5 * ((i * 7 + s0) % 3) / 2, { relic: RELIC[(i + s0) % 3] }));
      pots.push(pot(P(len - 26, 13), 2.6, { relic: 'a spar' }));
      return {
        tees: { galleon: 0, frigate: [22, -10], brig: [72, 42], lugger: [128, 50] },
        // scalloped: the pots' scours bite in from alternate sides, so the line weaves
        fw: [{ e: [[70, 24, 24], [115, 30, 36], [200, 31, 44], [300, 33, 43], [380, 36, 36], [440, 32, 31], [485, 25, 25], [512, 17, 17], [524, 11, 11]], wob: 3 },
          { bite: [[162, -37, 24, 11, 0], [219, 37, 24, 11, 0], [282, -37, 24, 11, 0], [344, 37, 24, 11, 0], [406, -35, 19, 10, 0], [460, 33, 15, 9, 0]], wob: 2 }],
        corridor: 10,
        bunkers: pots,
        green: { shared: true, apron: 4 },
        grass: [{ at: P(420, 60), r: 30, d: 0.3 }],
        targets: [{ name: 'The drive', at: P(226, -4) }, { name: 'The second', at: P(404, 13) }],
        words: {
          story: 'The graveyard: where the bar breaks up what comes ashore, every pot scoured round a keel, an anchor or a spar.',
          plays: 'Home into the wind, 580 yd through 22 pots. They lie in six groups biting in from alternate sides, so the line weaves: the drive left of the right-hand group, the second right of the left-hand one, a pitch up to the east end of the double green. Each pot is sunk, sod-faced and costs about a shot. Down the left is the Strand, the lagoon\'s firm beach: a ball on it runs like a road, and the lagoon is 40 m beyond it. Three placed shots, each to a number; not reachable.',
          safe: 'The drive to the left of the second group (226 m), the second to the right of the fifth (404 m), a pitch.',
          bold: null,
          miss: 'In a pot: out sideways or a short way forward. Left, fescue, then the Strand (it runs), then the lagoon. Right, the dunes. At the green, a pot short right; long, the 2nd\'s half of the double green.',
        },
        card: {
          type: 'Original (a field of pots)', form: 'Scalloped', feature: 'The 22 pots and the timbers in them; the Strand', job: 'The pots are the hazard and they set every line; the timbers mark them; the Strand is a helper (a road)',
          decision: 'None: three placed shots, each to a number', miss: 'Small: fescue. Medium: a pot, the Strand (left), the dunes (right). Big: the lagoon, far left only. Safe miss at the green: left',
          view: 'In front the fairway weaving between the groups of pots, their sod faces and grass eyebrows; in the middle the Strand and the lagoon on the left; beyond, the double green and the false light on its dune. The landing area shows',
          ground: 'Level: the pots are the hole; +5 m in all, most of it on the last leg',
          height: 'Level (the pots are the hole)', dial: 'Bunker count: 22 pots (past real golf)', shots: { tee: 'A draw away from the right-hand pots, into the wind', approach: 'A lay-up to a number, then a pitch' }, hazard: 'Down both sides in turn: the pots', surround: 'Bunkers: one pot short right', setPiece: 'Shared green (with the 2nd)',
        },
      };
    },
  }),

  // 9. THE WRECKER'S INN: onto the dune table (the high road) or beside it (the low road), home to the inn
  hole({ n: 9, name: 'The Wrecker\'s Inn', par: 4, world: LINES[8], tips: [-32, 0], shape: 'Dogleg left, over the table', mown: 0.5,
    build: (P, L, len, Lw) => {
      const eh = headingAt(L, len - 1);
      return {
        tees: { galleon: 0, frigate: [20, 9], brig: [62, -13], lugger: [110, -32] },
        // a fan: narrow off the tee, opening over the table and beside it (the low road), into the shared field
        fw: [{ e: [[70, 15, 16], [110, 18, 20], [160, 24, 25], [195, 32, 30], [230, 50, 30], [262, 72, 34], [292, 70, 38], [325, 52, 42], [356, 34, 32], [376, 20, 20]], wob: 3 }, shared(Lw)],
        corridor: 10,
        // the table: a 5.5 m face across the line 205-225 m out, a level top, the low road beside it on the left
        table: { s0: 212, s1: 302, L: -24, R: 36, h: 5.5, face: 20 },
        bunkers: [pot(P(len - 18, 17), 2.6), pot(P(len - 6, 23), 2.5)],
        green: { k: 1.02, lobes: [[0, 0, 13, 18, -6], [-6, -10, 9, 7, 0]], apron: 5, contour: [{ fall: 0, pct: 1.5 }, { tier: [3, 6], up: 175, h: 0.4, w: 5 }], style: 'Big and open at the front, its long axis down the line from the table, falling 1.5% toward you with a shelf at the back; two pots right; the inn\'s yard wall behind' },
        props: [{ kind: 'wall', at: P(len + 26, 0), w: 1, l: 64, h: 1.4, rot: eh + Math.PI / 2, soak: 0.3, label: 'the inn\'s yard wall' },
          { kind: 'bell', at: P(224, 7), r: 0.35, h: 4.5, label: 'the bell', marker: true }],
        stands: [{ at: P(224, 14), rx: 3.2, rz: 3.2, h: 1.8, job: 'marker: the lip beside the bell' }],
        grass: [{ at: P(150, 40), r: 26, d: 0.45 }, { at: P(150, -40), r: 26, d: 0.3 }],
        boldPath: P(258, 4),
        targets: [{ name: 'The low road', at: P(246, -54) }, { name: 'The high road', at: P(258, 4), bold: true }],
        words: {
          story: 'The Wrecker\'s Inn: built from a stern castle hauled up the beach, at the end of the round and the start of it.',
          plays: 'Home into the wind, 430 yd. A dune table stands across the line about 225 yd out, its face 5.5 m high, a ship\'s bell on a post on the lip. Carry the face (about 245 yd) for the high road: a flat lie, the view of the green and the green\'s long axis in front of you; the longest drives run off the back of the table down to wedge range. Or take the low road beside it on the left, easier to hit, and play a blind mid iron over the table\'s shoulder. The last 100 yd is the shared field the 1st plays out on. A big green, open at the front, two pots right, the inn\'s yard wall behind.',
          safe: 'The low road (246 m, left of the table), then a blind mid iron over its shoulder.',
          bold: 'Over the face at the bell (about 245 yd) to the table top (258 m): a short iron down the green\'s length.',
          miss: 'Into the face: it stops on the grass bank, a pitch up. Right of the table, the dunes. Left of the low road, fescue and dune. At the green, two pots right; long, off the yard wall.',
        },
        card: {
          type: 'Original', form: 'Fan', feature: 'The dune table and the bell on its lip; the inn', job: 'The table is the lie-setter (on top a flat lie and the view, beside it a blind shot); the bell is the marker; the yard wall is a backstop; the inn is the frame for the finish',
          decision: 'High road, low road: carry the face (about 245 yd) for a flat lie and the green\'s length, or lay up beside it for an easier drive and a blind mid iron',
          miss: 'Small: fescue, the face\'s bank. Medium: the dunes right of the table, the pots at the green. Big: the dunes. No penalty ground. Safe miss at the green: short',
          view: 'In front the fairway narrowing to the table; in the middle the face across the line with the bell on its lip, the low road opening left of it; beyond, the inn\'s roof and the 1st\'s fairway. The face, the lip and the bell show (a table top with a marker: not blind); the low road\'s second is the nine\'s other blind shot',
          ground: 'Table top: the fairway at 11 m, a 5.5 m face 205-225 m out onto a level top, falling off its back into the shared field; the green at 8 m (-4 m in all)',
          height: 'Table top', dial: 'Height: a 5.5 m face onto a dune table', shots: { tee: 'A high carry onto the table, or a lay-up beside it', approach: 'A short iron from the top, or a blind mid iron from the low road' }, hazard: 'Across: the table\'s face', surround: 'Bunkers right; the wall behind', setPiece: 'Shared fairway (with the 1st)',
        },
      };
    },
  }),
];

// the bold lines (the direct line on the 3rd, the cut on the 5th, onto the table on the 9th), and the lines the
// review tools read a hole on where its form isn't on the playing line
{
  HOLES[2].boldLine = [[0, 0], HOLES[2].boldPath];
  HOLES[2].reliefLine = [[0, 0], HOLES[2].boldPath, HOLES[2].pin];   // the valley carry is on the bold line
  HOLES[4].boldLine = [[0, 0], at(HOLES[4].line, 236, 24)];
  HOLES[8].boldLine = [[0, 0], HOLES[8].boldPath];
}
