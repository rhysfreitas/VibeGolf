// Halcyon Ring, plan book round 1 (11 November 2026): nine holes inside a ring space station, a pristine garden
// colony. Rhys's picks: R = 5 km; the curve plays as it looks; floor windows are glass and a penalty area (like
// water: a stroke and a drop beside where the ball crossed); the ball flies as on Earth; par 35, 4 3 4 5 3 4 4 5 3;
// tees Zenith, Meridian, Horizon, Nadir, the Kingfisher tips; decisions on 4, 7 and 8; classics Double Plateau (1),
// Eden (2), Road (3), Leven (7), Channel (8); landmarks the spoke, Earth through the rim glass and the clubhouse,
// the reveal the Great Window from the 9th tee; late light with the air handling's spinward breeze. He approved the
// routing check ("move on to the next steps"), with three fixes found drawing it: the 9th moved 45 m north (the
// Great Window had overlapped the 8th green), the canal runs up the right of the 8th's valley (so the Channel is a
// second fairway beyond it) and the 8th tee moved 25 m up (it sat on the canal).
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x right of the line)
// from `legs` ([length, turn in degrees, + = right]); `place` puts it on the floor (world.mjs: X = a east, -Z = s
// north). Fairway pieces (`fw`) are the plan tools' ribbons `{ e }`, free shapes `{ lobes }` and cut-outs `{ bite }`
// (shapes.mjs makeFairway); greens are lobes in the green's frame with a designed `contour`; `cant` leans the ground
// across the line ([s0, s1, %], + falls right); `forms` are mounds and hollows ([at, rx, rz, h], h < 0 a hollow);
// `ramps` raise the ground along the line ([s0, s1, metres]); `walls` and `villas` are solid. Each hole carries its
// hole card (`card`) and the words for the book (`words`), the course its course card (`COURSE.card`),
// docs/COURSE-DESIGN.md Part 1.
import { lineOf, lengthOf, at, YD, rnd } from './geo.mjs';
import { makeFairway } from './shapes.mjs';

export const COURSE = {
  id: 'halcyon', name: 'Halcyon Ring', theme: 'ring', altFt: 0,
  signature: { time: 'evening', light: 'late, the mirror band dimming', wind: 'spinward breeze (air handling)', weather: 'clear', temp: 'mild' },
  teeSets: [
    { id: 'zenith', name: 'Zenith', color: '#1f3b5c', minDrive: 260 },
    { id: 'meridian', name: 'Meridian', color: '#c9a24a', minDrive: 230 },
    { id: 'horizon', name: 'Horizon', color: '#e8e4da', minDrive: 200 },
    { id: 'nadir', name: 'Nadir', color: '#8fb3c9', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'kingfisher', name: 'Kingfisher', color: '#1d7fa6', minDrive: 290 },
  ring: { R: 5000, width: 900 },
  card: {
    hook: 'Parkland golf inside a wheel in orbit: lawns, woods, lakes and white villas on terraces, the floor climbing up the ring ahead and behind, Earth through the glass of the rims, and a band of glass in the floor along the foot of each rim wall, segmented by beams that carry the wall\'s ribs across it, with a sill where it meets the wall. Its one rule: a floor window is a penalty area (glass; a ball on it takes a stroke and a drop beside where it crossed). The ball flies as on Earth, and the curve plays as it looks. "Wind" is the air handling\'s steady spinward breeze.',
    skeleton: 'Par 35: 4 3 4 5 3 4 4 5 3, the first par 35, the first with three par 3s and the first par-3 finish. Opens gently up the curve toward the day/night line. The big climb is the 4th (+26 m to the west terraces, in three terraces), the big drop the 5th (−15 m off the terraces to the balcony), the drivable par 4 the 7th (up onto a table), the long par 3 the 5th, the reachable par 5 the 8th. Finishes level across the Great Window to the clubhouse: a par 3 across a gulf over the signature hazard, a finish no course has used.',
    classics: 'Double Plateau (1), Short (2, the postage stamp; it was an Eden until its green shrank), Road (3), Leven (7), Channel (8). All five new to the register.',
    setPieces: 'Two, both never used: the postage stamp (2: 115 yd up into the walled garden to a 290 m² green, the wall 4 m behind it) and the church pews (3: nine rungs of sand between clipped box ridges, a formal parterre on a diagonal into the pinch).',
    dials: 'One pushed on every hole, none the same way twice: 1 width (a 90 m lawn), 2 green size (290 m²), 3 bunker count (eleven), 4 one hazard\'s scale (the Long Window, about 4,000 m²), 5 par 3 length (230 yd), 6 height (a 10% bench), 7 green size past real golf (about 1,400 m²: the one hole past it), 8 par 5 length (490 yd, reachable), 9 bunker count (none). spread.mjs finds no cluster.',
    heights: 'One height form a hole, none twice: half-pipe (1), uphill par 3 (2), tee drop (3), stepped (4), drop par 3 (5), hillside bench (6), table top (7), perched green (8), par 3 across a gulf (9). Bold: 4, 6, 7.',
    shots: 'Tee shots: driver hard (1), a lay-up to a number (3), a fade (4), a draw (6), a high carry (7), dead straight (8). Approaches: run-up (1, 3), full wedge (2), long wood or iron (4, 5, 8), hanging lie (6), blind over a marker (7), high carry that stops (9). Hazards: diagonal (3, 4, 8), a side (1, 5, 6), all round (2), centre (7), across (9).',
    decisions: 'Three, each a different type: bite off the Long Window (4), drivable up the table top round the spoke (7), go for the green in two or lay up at the canal (8). One in the last two holes. The rest have one clear line.',
    landmarks: 'The spoke (tees 5, 6 and 7, the 4th\'s second leg): an A-frame foot astride the 7th rising out of the top of the frame to the hub. Earth through the rim glass (tees 2, 3, 4, 5, 7 and 9). The clubhouse, high on the curve ahead (tees 5, 6, 8 and 9, the 4th\'s second leg), played to at the end. The reveal: the 9th tee, up out of the 8th\'s valley, the Great Window spread below with the stars through it.',
    rhythm: 'A gentle opener (a fan, no penalty ground near, the night side climbing ahead). The hardest run is 4 to 7 (the cape over the Long Window and the climb, the long par 3 to the balcony, the long par 4 by the lake, the drivable 7th). The 8th is the breather and a choice, and the 9th finishes on the set piece. Par 4s 310, 380, 430, 455; par 3s 115, 230, 150; par 5s 545 (a cape and a climb) and 490 (a valley and a canal, reachable).',
    newBorrowed: 'New to the register: a par 3 level across a floor window sunk in an amphitheatre; a postage stamp in a walled garden; church pews as a parterre; a table top under a spoke; a 1,400 m² green; a green on a balcony over the rim glass (a band of glass round the ring at the foot of each wall, segmented by the wall\'s ribs); a spoke\'s foot as a centre-line hazard; a hole along the day/night line; a canal with a lock beside the second shot; a par-3 finish; a curve you can see rise. Borrowed from the over-used list, three (one over the two allowed): a waterfall (off a villa terrace behind the 6th green), one bridge (the footbridge over the canal on the 8th) and terraces to play up (the 4th\'s three, picked 12 November for its height form).',
    forms: 'Par 4s and 5s: 1 fan, 3 hourglass, 4 hook, 6 scalloped, 7 island (the spoke\'s foot in the fairway), 8 split (the Channel: a second lane over the canal, reached by a footbridge). Six forms, none twice, no plain strips; alike.mjs finds no pair alike.',
  },
};
export const BACK = 'zenith', FRONT = 'nadir';

// trees by kind: lime (avenue trees), plane (big parkland trees), yew (clipped garden yews), poplar (tall columns),
// willow (by the water)
const SIZE = { lime: [[16, 21], [4.5, 6]], plane: [[20, 27], [7, 10]], yew: [[4, 6], [1.6, 2.4]], poplar: [[22, 28], [2.4, 3.4]], willow: [[10, 14], [6, 8]] };
const grove = (p, r, n, seed, kind = 'plane') => { const R = rnd(seed), [hh, rr] = SIZE[kind]; return Array.from({ length: n }, () => {
  const a = R() * 6.283, d = Math.sqrt(R()) * r; return { kind, x: p[0] + Math.cos(a) * d, z: p[1] + Math.sin(a) * d, r: rr[0] + R() * (rr[1] - rr[0]), h: hh[0] + R() * (hh[1] - hh[0]) }; }); };
const row = (P, s0, s1, step, off, kind, seed = 1) => { const R = rnd(seed), [hh, rr] = SIZE[kind], out = [];
  for (let s = s0; s <= s1; s += step) { const [x, z] = P(s, typeof off === 'function' ? off(s) : off); out.push({ kind, x, z, r: rr[0] + R() * (rr[1] - rr[0]) * 0.5, h: hh[0] + R() * (hh[1] - hh[0]) * 0.5, keep: true }); }
  return out; };

function hole(def) {
  const L = lineOf(def.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o);
  const h = def.build(P, L, len);
  h.line = L; h.len = len; h.pin = L.at(-1);
  h.teePts = {}; h.yards = {};
  // a forward tee written [s, off] goes on its own pad beside the fairway: pushed out until it is 13 m clear of it
  const fd = makeFairway(L, h.fw || []), clear = p => { let c = Infinity; for (let a = 0; a < 6.283; a += 0.3) for (let r = 0; r < 13; r += 1) if (fd(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) < 0) c = Math.min(c, r); return c >= 13; };
  for (const [k, v] of Object.entries(h.tees)) {
    if (typeof v !== 'number') { let off = v[1]; while (!clear(P(v[0], off)) && Math.abs(off) < 90) off += Math.sign(off) * 1; v[1] = off; }
    h.teePts[k] = typeof v === 'number' ? P(v) : P(v[0], v[1]);
    // on a par 3 the yardage is the straight line to the pin (a forward tee may sit well off the line)
    h.yards[k] = Math.round((def.par === 3 ? Math.hypot(h.teePts[k][0] - L.at(-1)[0], h.teePts[k][1] - L.at(-1)[1]) : len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  }
  // the tips tee (COURSE.tipsSet, switched off): behind the back tee, 34 m on the par 4s and 5s, 14 m on the par
  // 3s unless the hole says; carried as tips: { tee: [x, z], yards } in the hole's frame, out of tees and yards
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}

// a green's lobes scaled about its centre (the dials: green sizes spread from about 290 to 1,300 m²)
const sc = (lobes, k) => lobes.map(([u, b, rx, rz, r]) => [u * k, b * k, rx * k, rz * k, r]);
// church pews: rungs of sand across a diagonal band from a to b (each [s, off]), grass ridges between them
const pews = (P, a, b, n, len, wid) => { const out = [];
  const A = P(...a), B = P(...b), ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ at: [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], rx: wid / 2, rz: len / 2, rot: ang, job: 'pews', pew: true }); }
  return out; };

const P4 = () => ({ zenith: 0, meridian: 18, horizon: [62, 26], nadir: [104, 28] });
const P4L = () => ({ zenith: 0, meridian: 18, horizon: [62, -26], nadir: [104, -28] });

export const HOLES = [
  // 1. THE PROMENADE: from the tram stop's plaza, up the curve toward the dusk line; a fan between the promenade's
  // lime avenue (left) and a sunken lawn (right), to a double plateau green
  hole({ n: 1, name: 'The Promenade', par: 4, legs: [[225, 0], [122, 20]], place: { at: [236, -560], heading: 180 }, shape: 'Dogleg right',
    build: (P) => ({
      tees: P4(),
      // the dial: the widest fairway on the course, a lawn 85 m across where drives land
      fw: [{ e: [[38, 14, 14], [100, 28, 30], [160, 41, 43], [215, 45, 46], [262, 46, 46], [300, 42, 40], [325, 32, 28], [341, 16, 14]], wob: 4 }],
      cant: [[160, 290, -2]],
      pipe: [[-40, 290, 9.5, 60]],   // the promenade: a half-pipe between two grassed embankments 9.5 m high
      forms: [{ at: P(150, 88), rx: 22, rz: 52, h: -1.8, label: 'the sunken lawn' }],
      trees: [...row(P, 30, 320, 17, s => -62 - Math.max(0, s - 220) * 0.12, 'lime', 11), ...row(P, 40, 300, 17, -76, 'lime', 12),
        ...grove(P(385, 10), 26, 12, 13, 'plane'), ...grove(P(205, 92), 20, 7, 14, 'plane')],
      bunkers: [{ at: P(328, -18), rx: 7, rz: 5 }, { at: P(356, 15), rx: 6, rz: 4.5 }],
      green: { lobes: [[-5, -9, 9.5, 10, -15], [5, 9, 9.5, 10, -15], [0, 0, 7, 6.5, -15]], join: 6, contour: [{ fall: 0, pct: 1.1 }, { bowl: [0, 0], r: 10, h: 0.45 }],
        style: 'A Double Plateau (about 670 m²): two shelves, front left and back right, about 0.5 m above a low middle that gathers a near miss; the whole green falls 1.2% toward the front' },
      villas: [{ at: P(40, 70), w: 30, l: 18, h: 9, rot: 0 }, { at: P(-10, -95), w: 26, l: 16, h: 6, rot: 0, label: 'the tram stop' }],
      targets: [{ name: 'Down the promenade', at: P(240, 4) }],
      words: {
        story: 'Up the curve from the tram stop toward the dusk line: the floor ahead climbs into the night side, its villas lighting up.',
        plays: 'The round starts on the plaza by the ring tram\'s stop. The hole runs south down the promenade, the widest fairway on the course, a lawn about 90 m across where drives land, sunk between two grassed embankments that rise 9.5 m either side, the lime avenue along the top of the left one. Ahead the ring floor climbs into the night side: lawns, woods and white villas going up the curve into the dusk, their windows lighting. The fairway fans out past 200 m and bends a little right to a Double Plateau green.',
        safe: 'Down the promenade at about 240 m: anywhere on the lawn; a drive off line runs back down the banks toward the middle.',
        bold: null,
        miss: 'Left, up the embankment to the limes, the villa gardens behind. Right, up the other bank to the sunken lawn. Nothing here costs a stroke.',
      },
      card: {
        type: 'Double Plateau', form: 'Fan: from the plaza\'s neck, opening to about 90 m where drives land, the widest fairway on the course',
        feature: 'The Double Plateau green: two shelves about 0.5 m up with a low middle', job: 'Lie-setter for the approach (which shelf, which pin) and a helper: the low middle gathers a near miss',
        decision: 'None: driver as hard as you like, then a run-up into the open front of the green',
        miss: 'Small: first cut or the foot of a bank (it feeds the ball back). Medium: up the banks, the limes left, the sunken lawn right. Big: the villa gardens beyond. No penalty ground. Safe miss at the green: short, into the low middle',
        view: 'In front the plaza\'s neck and the lawn opening between its banks; in the middle the fairway rising gently with the curve, the limes along the left bank\'s top; beyond, the ring floor climbing into the night side, villa lights coming on up the curve. The landing area shows',
        ground: 'A half-pipe: the line rises about 10 m with the curve (2–5% where drives land) between embankments 9.5 m high 60 m out, which feed a loose drive back; the green on a shelf levelled into the curve; the Double Plateau green (about 670 m²)',
        dial: 'Width: the widest fairway on the course, about 74 m on average, 90 m where drives land (the edge of real golf)', height: 'Half-pipe', shots: { tee: 'Driver as hard as you like', approach: 'A run-up into the open front' }, hazard: 'Down a side (the banks, the limes, the sunken lawn)', surround: 'A tight mown run-off',
      },
    }),
  }),

  // 2. THE WALLED GARDEN: an Eden on a villa's walled garden up on the east terraces, the rim glass behind
  hole({ n: 2, name: 'The Walled Garden', par: 3, legs: [[151, 0]], place: { at: [215, -175], heading: 95 }, shape: 'One shot', tips: [30, 0],
    build: (P) => ({
      // the postage stamp: 115 yd to a green of about 290 m² inside the garden's walls, the back wall 4 m behind it
      tees: { zenith: 46, meridian: 52, horizon: [57, -13], nadir: [62, 14] },
      forms: [{ at: P(176, 0), rx: 4, rz: 34, h: -2.4, label: 'the ha-ha' }],
      walls: [{ a: P(166, -40), b: P(166, 40), h: 3.2, label: 'the garden wall' }, { a: P(108, -44), b: P(166, -40), h: 3.2 }, { a: P(108, 44), b: P(166, 40), h: 3.2 }],
      trees: [...row(P, 116, 172, 7, -36, 'yew', 21), ...row(P, 116, 172, 7, 36, 'yew', 22), ...grove(P(60, -60), 18, 6, 23, 'plane'), ...grove(P(60, 62), 16, 5, 24, 'plane')],
      villas: [{ at: P(206, 4), w: 34, l: 18, h: 10, rot: 0, label: 'the garden\'s villa' }],
      bunkers: [{ at: P(140, -12), rx: 5, rz: 4 }, { at: P(140, 12), rx: 5.5, rz: 4 }, { at: P(156, -12), rx: 3.5, rz: 3, pot: true }],
      green: { lobes: sc([[0, 0, 12, 10, 10], [-7, 4, 6, 6, 0]], 0.86), join: 4, contour: [{ fall: 0, pct: 2.2 }],
        style: 'The postage stamp (about 290 m²): tilted 2.2% from back to front, two bunkers short and a pot front left, the garden wall 4 m behind' },
      targets: [],
      words: {
        story: 'A villa\'s walled garden on the east terraces, the green on its top lawn under the rim glass.',
        plays: 'A full wedge up into a villa\'s walled garden, 5 m above the tee, to the smallest green on the course: about 290 m², ringed by two bunkers short and a pot front left, with the garden\'s white back wall 4 m behind it. Clipped yews line the side walls, the villa stands beyond, and above it the rim\'s glass climbs out of the frame with Earth in it.',
        safe: 'The middle of the green, below the hole: it tilts toward you, and a ball long plays off the wall.',
        bold: null,
        miss: 'Short left and short right, the bunkers; the pot front left. Long, the wall: a ball hits it and comes back (it is solid, 3.2 m high), sometimes onto the green, sometimes into the collar. Off the sides, the yews.',
      },
      card: {
        type: 'Short (the postage stamp)', form: '-',
        feature: 'The postage stamp in the walled garden, and the wall 4 m behind it', job: 'Hazard (bunkers all round a tiny green) and a helper of a kind: the back wall stops a long ball',
        decision: 'None',
        miss: 'Small: the collar, or the front tilt sending a short ball back off. Medium: the two bunkers short, the pot front left, the yews either side. Big: over the wall into the ha-ha beyond (no penalty, a blind pitch back); the rim glass is 60 m past the green. Safe miss: short and centre',
        view: 'In front the lawn falling to a gravel walk; in the middle the tiny green on the garden\'s top lawn, its bunkers round it; beyond, the white back wall, the villa, and Earth through the rim glass',
        ground: 'Uphill to a shelf: 5 m up onto the garden\'s top lawn; the green tilted 2.2% from back to front, about 290 m², bunkers short left and right and a pot front left',
        dial: 'Green size: about 290 m², the smallest on the course (the edge of real golf); 115 yd', height: 'Uphill par 3 to a shelf', shots: { tee: '-', approach: 'A full wedge' }, hazard: 'All round (bunkers, the pot, the wall)', surround: 'Bunkers, and the wall behind', setPiece: 'Postage stamp',
      },
    }),
  }),

  // 3. THE TERMINATOR: along the line where day meets night, off the east terrace; an hourglass pinched between a
  // night-side garden wall and a sunken lawn, to a Road green with a villa wall hard behind
  hole({ n: 3, name: 'The Terminator', par: 4, legs: [[240, 0], [153, -20]], place: { at: [400, -90], heading: 270 }, shape: 'Dogleg left', tips: [-17, 0],
    build: (P) => ({
      tees: P4(),
      fw: [{ e: [[50, 22, 22], [110, 30, 31], [170, 31, 31], [232, 29, 30], [262, 13, 12], [286, 12, 13], [312, 22, 24], [360, 20, 20], [382, 12, 12]], wob: 3 }],
      cant: [[150, 260, 3]],
      forms: [{ at: P(276, 33), rx: 15, rz: 26, h: -1.6, label: 'the sunken lawn' }],
      walls: [{ a: P(408, -30), b: P(411, 32), h: 3.0 }],   // (the wall at the pinch is gone: the pews make it)
      villas: [{ at: P(205, -62), w: 26, l: 18, h: 9, rot: 10, label: 'lit villas, the night side' }, { at: P(258, -66), w: 22, l: 16, h: 8, rot: -5 }, { at: P(432, 2), w: 34, l: 20, h: 10, rot: 0 }],
      trees: [...grove(P(150, 70), 22, 8, 31, 'plane'), ...row(P, 120, 230, 22, -46, 'poplar', 32), ...grove(P(330, 58), 16, 5, 33, 'plane')],
      // the church pews: nine rungs of sand 18 m long, grass ridges of clipped box between, on a diagonal from 46 m left
      // of the line at 222 m to 8 m left at 300 m, so the longer the drive the more of the pinch they take
      bunkers: [...pews(P, [222, -46], [300, -8], 9, 18, 4.5), { at: P(378, -7), rx: 3.5, rz: 3, pot: true }, { at: P(394, 15), rx: 6, rz: 4 }],
      green: { lobes: sc([[0, 0, 10, 17, 40], [5, -9, 7, 6, 0]], 0.88), join: 5, contour: [{ fall: 0, pct: 1.8 }],
        style: 'A Road green (about 420 m²): long and fairly narrow, set 40° across the line, falling 1.8% toward the front, a deep pot at its front left and the villa wall hard behind (one of the flatter greens: the pot and the wall are its feature)' },
      targets: [{ name: 'Short of the pews', at: P(222, 8) }],
      words: {
        story: 'Along the line where day meets night: the left of the fairway in the dusk, lit villa gardens beyond; the right in the last light.',
        plays: 'Off the east terrace, 12 m down to the floor, heading west along the line where the mirror band\'s shutters close: to the left the floor climbs the curve into the night side, its villas lit; to the right it is still evening. Far ahead, past the green, the west rim\'s glass and Earth. The fairway is wide to 235 m, then pinches between the church pews and a sunken lawn: nine rungs of sand between clipped box ridges, a formal parterre on a diagonal from the left rough into the pinch, so the longer the drive the more of them it has to clear. Then the hole bends left to a Road green set across the line, a pot at its front and a villa wall close behind.',
        safe: 'Short of the pews at about 220 m, right of centre: the lean is 3% to the right, away from the night side, and from the right the green opens along its length.',
        bold: null,
        miss: 'Left, the pews (sand, and a stance between box ridges), then the lit villas\' gardens. Right, the sunken lawn. At the green: the pot front left, the wall behind (a ball off it bounces back into the rough); the safe miss is short right.',
      },
      card: {
        type: 'Road', form: 'Hourglass: wide off the terrace, pinched at 262–286 m between the church pews and a sunken lawn, then on to the green',
        feature: 'The church pews: nine rungs of sand 18 m long between clipped box ridges, on a diagonal into the pinch; a villa wall hard behind the green', job: 'Hazard (diagonal: the longer the drive, the more of the pinch they take) and a lie-setter (a ball in them sits between ridges); the wall behind the green, with the Road\'s pot in front',
        decision: 'None: one clear line, laid up short of the pews to a number',
        miss: 'Small: first cut, either side. Medium: the pews left, the sunken lawn right. Big: beyond the pews into the night side\'s gardens. No penalty ground. Safe miss at the green: short right; the deep pot front left and the wall behind',
        view: 'In front the terrace\'s lip and the wide first half; in the middle the pews\' rungs and ridges on the left, the pinch beyond, the light changing across it; beyond, the west rim\'s glass with Earth, and the night side to the left climbing the curve',
        ground: 'A tee drop: off the east terrace about 12 m down to the floor; the landing area leans 3% right away from the night side; the Road green (about 420 m²), long and narrow across the line, one of the flatter greens',
        dial: 'Bunker count: eleven (the pews\' nine rungs and two at the green)', height: 'Tee drop', shots: { tee: 'A lay-up to a number (short of the pews)', approach: 'A run-up to the Road green' }, hazard: 'Diagonal (the pews)', surround: 'Bunkers (the pot), the wall behind', setPiece: 'Church pews',
      },
    }),
  }),

  // 4. THE LONG WINDOW: a cape round a floor window along the inside of the first leg, then a climb in two broad
  // steps to the lowest west terrace
  hole({ n: 4, name: 'The Long Window', par: 5, legs: [[220, 0], [278, 55]], place: { at: [-30, -75], heading: 285 }, shape: 'Dogleg right (cape)', tips: [-28, 18],
    build: (P) => ({
      tees: P4L(),
      fw: [{ lobes: [[78, -8, 36, 19, 0], [140, -26, 44, 26, 0], [198, -44, 36, 30, 20], [252, -28, 40, 28, 52]], join: 16, wob: 4 },
        { e: [[258, 20, 24], [290, 26, 26], [340, 22, 24], [400, 20, 22], [450, 16, 18], [482, 11, 12]], wob: 4, seed: 41 }],
      cant: [[150, 250, -3]],
      ramps: [[300, 322, 5], [380, 402, 5]],   // the banks between the terraces
      levels: [[235, 295], [327, 375], [407, 452]],   // three garden terraces, each level, the curve's rise taken up in the banks
      bunkers: [{ at: P(214, -82), rx: 15, rz: 11, job: 'catch' }, { at: P(432, 24), rx: 14, rz: 8, job: 'approach' }, { at: P(486, -15), rx: 6, rz: 4.5 }, { at: P(492, 14), rx: 5, rz: 4 }],
      trees: [...grove(P(232, -90), 26, 11, 41, 'plane'), ...grove(P(110, -62), 20, 6, 42, 'plane'), ...row(P, 300, 470, 24, -48, 'poplar', 43)],
      villas: [{ at: P(540, 10), w: 36, l: 20, h: 10, rot: 0 }, { at: P(470, 62), w: 24, l: 16, h: 8, rot: 0 }],
      green: { lobes: [[0, 0, 11, 14, -15], [-5, 10, 9, 8, 0]], join: 5, raise: 1, falseFront: true, contour: [{ fall: 0, pct: 1.4 }, { tier: [0, 4], up: 180, h: 0.4, w: 5 }],
        style: 'A pear on the lowest villa terrace, raised 1 m with a false front, falling 2% toward the front, a back tier 0.45 m up' },
      targets: [{ name: 'The corner', at: P(206, -38) }, { name: 'Over the window', at: P(290, 0), bold: true }, { name: 'The middle terrace', at: P(365, -2) }],
      boldLine: [[0, 0], P(290, 0)],
      words: {
        story: 'A cape round the Long Window: the floor opens on the stars along the inside of the first leg, and the hole climbs to the west terraces.',
        plays: 'The floor window lies along the right of the first leg, 90 m of glass in a white stone frame with the stars passing under it. The fairway wraps round its far end, its inside edge falling gently toward the glass, then turns right and climbs three level garden terraces, banks of 7–8 m between them, to a green raised on the lowest villa terrace. Up the curve ahead, from the second leg, the spoke and the clubhouse.',
        safe: 'The corner (about 210 m), left of centre: the window is 35 yd right of the line there, and the fairway leans 3% left, away from it. Then up the second leg in two.',
        bold: 'Carry the window (about 240 yd from the Zenith tee) onto the second leg: 26 yd closer, and a second that can reach the green\'s front.',
        miss: 'Right, the window (a stroke and a drop beside where the ball crossed), the bold line only. Left, the corner bunker and a stand of planes. Short of the green, its false front.',
      },
      card: {
        type: 'Cape', form: 'Hook: the fairway wraps round the window\'s far end, its inside edge sloping toward the glass',
        feature: 'The Long Window, 90 m of floor glass along the inside of the first leg', job: 'Hazard (the cape\'s carry, a penalty area) and aim point (its far end, a white frame)',
        decision: 'Bite off what you dare: carry the window (about 240 yd from the Zenith tee) onto the second leg, 26 yd closer and a second that can reach the green\'s front, or play the left half to the corner (the window 35 yd right of the line) and three shots',
        miss: 'Small: first cut left, or the low inside of the hook. Medium: the planes left, the corner bunker. Big: the window right (penalty, the bold line only). Safe miss at the green: left',
        view: 'In front the fairway and the window\'s near end at the right; in the middle the corner and the second leg climbing; beyond, the terraces and the west rim\'s glass, and up the curve, from the second leg, the spoke and the clubhouse',
        ground: 'Stepped: a climb of about 26 m in three level garden terraces with banks of 7–8 m between (about 35%), the curve\'s rise taken up in the banks; the landing area leans 3% left, away from the window; the green raised on the lowest villa terrace with a false front',
        dial: 'One hazard\'s scale: the Long Window, 90 m of glass, about 4,000 m²', height: 'Stepped (and a big climb)', shots: { tee: 'A fade round the cape', approach: 'A long wood up onto the terraces' }, hazard: 'Diagonal (the window)', surround: 'A drop (the perched green\'s false front)',
      },
    }),
  }),

  // 5. THE BALCONY: down off the high west terrace over two terrace steps to a green on a stone balcony standing out
  // over the rim glass
  hole({ n: 5, name: 'The Balcony', par: 3, legs: [[212, 0]], place: { at: [-395, -438], heading: 0 }, shape: 'One shot', tips: [-14, 0],
    build: (P) => ({
      tees: { zenith: 0, meridian: 12, horizon: [32, -6], nadir: [62, -6] },   // down the long lawn, its middle (off it the banks hide the green)
      bunkers: [{ at: P(198, 15), rx: 5, rz: 4 }],
      trees: [...row(P, 40, 150, 12, 34, 'yew', 51), ...grove(P(95, 58), 16, 5, 52, 'plane'), ...grove(P(250, 40), 14, 4, 53, 'poplar')],
      villas: [{ at: P(-30, 34), w: 30, l: 18, h: 10, rot: 0, label: 'villas on the high terrace' }, { at: P(110, 70), w: 26, l: 16, h: 9, rot: 0 }],
      green: { lobes: [[0, 0, 10, 15, 25], [4, -9, 7, 6, 0]], join: 5, contour: [{ fall: 90, pct: 1.6 }, { tier: [0, 7], up: 180, h: 0.4, w: 5 }],
        style: 'Angled left to right on the balcony, falling 2% toward the terrace bank on the right, a back tier 0.4 m up' },
      targets: [],
      words: {
        story: 'Down off the villa terraces to a green on a balcony out over the rim glass, Earth turning beyond it.',
        plays: 'From the lip of the high west terrace, 36 m up, the shot plays down over the long lawn falling from it to a green on a stone balcony standing out over the rim glass, the band of glass that runs all the way round the ring at the foot of each rim wall, segmented by beams that carry the wall\'s ribs across it, with a sill where it meets the wall. Left, the wall\'s glass climbs out of the frame with Earth in it; behind the green the head of the long lake, which curves away up the ring with the spoke and the clubhouse beyond.',
        safe: 'The right half: the green falls toward the terrace bank, and the bank sends a ball back on.',
        bold: null,
        miss: 'Left, off the balcony\'s edge onto the rim glass 8 m below (a stroke and a drop). Right, the terrace bank, which feeds a ball back toward the green. Short, the long lawn runs a ball on down. Long, off the balcony\'s back wall into the lake (a stroke and a drop).',
      },
      card: {
        type: 'Original (a long par 3)', form: '-',
        feature: 'The balcony: a stone platform standing out over the rim glass, the band of glass along the foot of the west wall, segmented by the wall\'s ribs', job: 'Hazard (left falls off the balcony onto the rim glass, a penalty area) and frame (the rim wall\'s glass and Earth beside)',
        decision: 'None',
        miss: 'Small: the collar. Medium: right, the terrace bank, which feeds a ball back (a helper); short, the long lawn, which runs a ball on. Big: left, off the balcony onto the glass; long, into the lake behind (both penalties). Safe miss: right',
        view: 'From the high terrace\'s lip (the forward tees down the long lawn): below, the balcony standing out over the rim glass; to the left the band of glass and its beams running away up the ring along the wall\'s foot, the wall\'s glass and Earth above; ahead, the head of the long lake behind the green and up the curve the spoke and the clubhouse',
        ground: 'Down about 15 m: 19 m off the high terrace to the balcony, 8 m above the rim glass, the curve giving back 4; the green angled left to right, falling 2% toward the terrace bank, with one tier',
        dial: 'Par 3 length: 230 yd, the longest par 3 (the edge of real golf)', height: 'Drop par 3 (the course\'s one)', shots: { tee: '-', approach: 'A long iron or wood' }, hazard: 'Down a side (the rim glass left)', surround: 'The rim glass left and the lake behind (penalties), drops off the balcony',
      },
    }),
  }),

  // 6. THE LAKE: north along the long lake, its bays biting in from the left and bunkers from the right, to a green
  // under a villa terrace with a waterfall
  hole({ n: 6, name: 'The Long Lake', par: 4, legs: [[245, 0], [171, 28]], place: { at: [-350, -690], heading: 12 }, shape: 'Dogleg right', tips: [-28, 12],
    build: (P) => ({
      tees: P4(),
      fw: [{ e: [[50, 26, 26], [110, 32, 32], [200, 32, 32], [260, 30, 30], [330, 26, 26], [380, 22, 22], [407, 14, 14]], wob: 3 }, { bite: [[125, -34, 32, 26], [196, 30, 30, 24], [318, -28, 26, 22]], wob: 2 }],
      water: [{ at: P(125, -50), rx: 16, rz: 30 }, { at: P(318, -46), rx: 16, rz: 26 }, { at: P(438, -36), rx: 9, rz: 8, label: 'the falls pool' }],
      cant: [[180, 290, 8.5]],   // the bench: the low side right, away from the lake, into the catch bunker
      bunkers: [{ at: P(196, 15), rx: 11, rz: 15, job: 'catch' }, { at: P(395, 15), rx: 6, rz: 4 }],
      trees: [...grove(P(170, -64), 12, 4, 61, 'willow'), ...grove(P(270, -58), 10, 3, 62, 'willow'), ...row(P, 120, 340, 22, 72, 'poplar', 63), ...grove(P(360, 66), 18, 6, 64, 'plane')],
      villas: [{ at: P(452, -8), w: 34, l: 18, h: 9, rot: -28, label: 'the villa terrace and its falls' }],
      falls: [{ at: P(436, -28), w: 9, h: 12 }],
      green: { lobes: [[0, 0, 10, 15, -20], [-7, -7, 7, 8, 0]], join: 5, contour: [{ fall: 270, pct: 1.2 }, { ridge: [[-9, -10], [9, -8]], h: -0.25, w: 3 }],
        style: 'Long and angled to the left, falling 1.3% toward the lake, a swale across its front third; the terrace bank behind' },
      targets: [{ name: 'Between the bays', at: P(236, -6) }],
      words: {
        story: 'Along the long lake that curves up the ring at both ends, to a green under a villa terrace\'s waterfall.',
        plays: 'North along the lake\'s east shore: the water curves away up the ring ahead, rising into the distance, with the spoke beyond it. Two of the lake\'s bays bite into the fairway from the left, bunkers from the right, so the line weaves. Where drives land the fairway is a bench cut along the slope, falling 10% to the right, away from the lake and into a catch bunker: the ball is above or below your feet for the second. At the end the hole turns right to a green under a villa terrace; a waterfall drops off the terrace into a pool left of the green.',
        safe: 'Between the bays at about 235 m, a little left of centre: a draw holds the high side; anything else runs right, away from the water.',
        bold: null,
        miss: 'Left, the lake (a stroke and a drop), past the bays\' reeds. Right, the catch bunker, then poplars. At the green: long and right is the terrace bank (it holds a ball); long left, the falls pool.',
      },
      card: {
        type: 'Original (a long par 4)', form: 'Scalloped: the lake\'s bays bite in from the left, a bunker from the right, alternating down the hole',
        feature: 'The lake and the waterfall off the villa terrace behind the green', job: 'Hazard (the lake on the left) and frame (the waterfall); the terrace bank behind the green is a backstop (helper)',
        decision: 'None: one clear line, weaving between the bays',
        miss: 'Small: first cut, a bay\'s shore grass. Medium: the catch bunker right, the reeds left. Big: the lake left (penalty, one side only; the right has room). Safe miss at the green: right and long, against the terrace bank',
        view: 'In front a lawn down to the shore; in the middle the fairway weaving between the bays; beyond, the lake curving up the ring into the distance with the spoke above it, the rim walk on its far shore and the rim glass beyond, and the villa terrace and its falls',
        ground: 'A hillside bench: up the curve about 12 m along the shore, and 10% across where drives land, down to the right, away from the lake, into a wide first cut and the catch bunker; the green falls 1.3% toward the lake with a swale across its front third',
        dial: 'Height: a hillside bench, 10% across where drives land', height: 'Hillside bench', shots: { tee: 'A draw that holds the high side', approach: 'From a hanging lie' }, hazard: 'Down a side (the lake)', surround: 'Water (the falls pool)',
      },
    }),
  }),

  // 7. THE SPOKE: drivable between the spoke's legs: its west foot stands in the fairway, the green on its plinth
  hole({ n: 7, name: 'The Spoke', par: 4, legs: [[283, 0]], place: { at: [-170, -1110], heading: 90 }, shape: 'Straight',
    build: (P, L, len) => ({
      tees: { zenith: 0, meridian: 18, horizon: [55, 24], nadir: [92, 26] },   // the forward tees right of the line, so the spoke's foot doesn't stand between them and the landing area
      fw: [{ e: [[30, 14, 14], [80, 24, 24], [125, 44, 42], [158, 46, 44], [182, 34, 34], [205, 40, 42], [240, 30, 32], [270, 20, 22]], wob: 3 }, { bite: [[150, 0, 20, 23]], wob: 1.5 }],
      cant: [[150, 260, 2.5]],
      forms: [{ at: P(236, 34), rx: 10, rz: 8, h: 2.2, label: 'the plinth\'s mound' }],
      feet: [{ at: P(150, 0), w: 34, h: 120, label: 'the spoke\'s west foot' }, { at: P(390, 0), w: 34, h: 120, label: 'its east foot' }],
      villas: [{ at: P(197, -27), w: 2, l: 2, h: 6, rot: 0, label: 'the lip marker' }],
      bunkers: [{ at: P(256, 27), rx: 7, rz: 4.5 }],
      trees: [...grove(P(205, 72), 22, 8, 71, 'plane'), ...grove(P(110, 64), 16, 5, 72, 'plane')],
      // past real golf: one lawn of a green under the A-frame, about 1,300 m², split by a 0.5 m tier into a front and a back
      green: { lobes: sc([[0, 0, 12, 13, 0], [-7, -7, 8, 7, 0], [6, 9, 8, 7, 0]], 1.45), join: 7, contour: [{ fall: 0, pct: 1.2 }, { tier: [0, 3], up: 180, h: 0.5, w: 6 }, { bowl: [-11, -12], r: 9, h: 0.3 }],
        style: 'Past real golf: one lawn of about 1,400 m² on the plinth under the A-frame, split by a 0.5 m tier into a front and a back shelf, falling 1.2% toward the front, a bowl on the front shelf, a bunker front right' },
      targets: [{ name: 'Below the face', at: P(130, 28) }, { name: 'At the green', at: P(len - 2, -3), bold: true }],
      boldLine: [[0, 0], P(240, -38)],   // left of the west foot (it stands on the line from 133 to 167 m), up onto the plinth
      words: {
        story: 'Drivable between the spoke\'s legs: up onto the spoke\'s plinth, a table 7.5 m up with the biggest green in the game on it, under the A-frame.',
        plays: 'Off the waterfall\'s terrace, 12 m down to the floor. The spoke\'s west foot, 34 m across, stands in the middle of the fairway 133–167 m out and rises out of the top of the frame toward the hub; behind it a grass face climbs 7.5 m onto the plinth, a white marker on its lip. On the plinth, level for 85 m: one lawn of a green, about 1,400 m² under the A-frame, split by a tier into a front and a back. The canal runs down the left, the far rim\'s glass and Earth beyond.',
        safe: 'Below the face, right of the foot (about 145 yd): a pitch up the face, blind, over the lip marker to the green.',
        bold: 'Carry the face (about 215 yd from the Zenith tee) left or right of the foot onto the plinth: the green is in reach, about 280 m from the tee.',
        miss: 'Into the foot (a ball off it drops at its base). Short of the face: the ball runs back down it to the floor. Left, the canal (a stroke and a drop), past the left lane. Right, planes. On the green: the wrong shelf, a long putt over the tier.',
      },
      card: {
        type: 'Leven', form: 'Island: one fairway with the spoke\'s west foot as the hole in it',
        feature: 'The spoke\'s west foot, 34 m across, below a 7.5 m table; the green on the table, about 1,400 m²', job: 'Obstacle (centre-line) and landmark; the face is a hazard for the short drive and the lip marker an aim point',
        decision: 'Drivable up the table top: carry the face (about 215 yd from Zenith) left or right of the foot and the green is in reach; or lay up below the face and pitch up blind over the marker',
        miss: 'Small: first cut either side. Medium: the face (it sends the ball back down), a plane grove right. Big: the canal left (penalty). On the green: the wrong shelf',
        view: 'From the terrace\'s lip: in front the floor and the spoke\'s west foot astride the line; in the middle the grass face and the marker on its lip; beyond, the plinth\'s top, the green between the legs and Earth through the east rim glass; the foot rises out of the top of the frame',
        ground: 'A table top: off the waterfall terrace 12 m down to the floor, the lay-up area round the foot nearly level, then a grass face 7.5 m high from 165 to 197 m out (about 25%) and the plinth\'s top level for 85 m; the green about 1,400 m², split by a 0.5 m tier into a front and a back shelf',
        dial: 'Green size, past real golf: one lawn of about 1,400 m²', height: 'Table top', shots: { tee: 'A high carry up onto the plinth', approach: 'Blind, over the lip marker (from below the face)' }, hazard: 'Centre (the spoke\'s foot)', surround: 'A feeding bank (the bowl on the front shelf)',
      },
    }),
  }),

  // 8. THE AQUEDUCT: up the tree-lined valley toward the clubhouse, the canal up its right side; the Channel is a
  // second fairway beyond the canal that shortens the hole
  hole({ n: 8, name: 'The Aqueduct', par: 5, legs: [[265, 0], [182, 15]], place: { at: [160, -1195], heading: 0 }, shape: 'Dogleg right', tips: [-30, 0],
    build: (P) => ({
      tees: P4L(),
      // the dial: 490 yd, reachable in two over the canal
      fw: [{ e: [[50, 20, 22], [130, 28, 30], [230, 30, 32], [300, 28, 22], [350, 24, 18], [395, 20, 17], [420, 15, 14], [433, 10, 10]], wob: 4 },
        { lobes: [[322, 86, 46, 21, 0], [384, 72, 30, 17, 12]], join: 12, wob: 3, seed: 83 }],
      cant: [[180, 280, -2.5]],
      bunkers: [{ at: P(388, -24), rx: 14, rz: 9, job: 'approach' }, { at: P(436, -14), rx: 5.5, rz: 4 }, { at: P(441, 13), rx: 4.5, rz: 3.5 }],
      trees: [...row(P, 40, 380, 20, -82, 'plane', 81), ...row(P, 40, 260, 20, 100, 'plane', 82), ...grove(P(150, -100), 22, 9, 84, 'plane'), ...grove(P(415, -70), 20, 7, 85, 'plane')],
      bridge: { a: P(300, 46), b: P(300, 66), label: 'the footbridge' },
      green: { lobes: sc([[0, 0, 12, 14, 30], [-5, 10, 8, 7, 0]], 0.9), join: 5, contour: [{ fall: 0, pct: 1.2 }, { tier: [0, 7], up: 180, h: 0.35, w: 3 }],
        style: 'On a shelf levelled into the valley head (about 490 m²), deep and angled, falling 1.2% toward the front, a back tier 0.35 m up' },
      targets: [{ name: 'Up the valley', at: P(240, -4) }, { name: 'Short of the green', at: P(345, -6) }, { name: 'Over the canal', at: P(330, 84), bold: true }],
      boldLine: [P(240, -4), P(330, 84)],
      words: {
        story: 'Up a tree-lined valley toward the clubhouse, the canal up its right side and through a lock at the bend; the aqueduct carries it on over the terraces.',
        plays: 'Up the valley the ring\'s curve becomes a climb: the floor rises 5% where drives land and more toward the valley head. Planes line both banks; the canal runs up the right side to a lock, then turns away across the terraces on an aqueduct. Beyond it, on the right, lies the Channel: a second fairway that cuts the corner. At 490 yd the green is in reach in two from a good drive.',
        safe: 'Up the valley (240 m), then short of the green on the main fairway (about 345 m): a full pitch up to the green\'s shelf.',
        bold: 'Go for the green in two (about 230 yd from a good drive), or carry the canal onto the Channel fairway: a short pitch over the canal\'s top to the green.',
        miss: 'Left, the valley\'s planes. Right of the main fairway, the canal (a stroke and a drop), past 15 m of rough. Short of the green, the approach bunker left.',
      },
      card: {
        type: 'Channel', form: 'Split: the main fairway up the valley, and a second lane out across the canal on the right that shortens the hole (the Channel)',
        feature: 'The canal and its lock, up the right of the valley', job: 'Hazard (a penalty area between the two fairways) and aim point (the lock\'s white gates at the bend)',
        decision: 'Go or lay up: 490 yd, so a good drive leaves the green in reach in two; or carry the canal to the Channel fairway; or stay on the main fairway short of the green and pitch up in three',
        miss: 'Small: first cut, the valley\'s lower banks. Medium: the planes up both banks. Big: the canal (penalty) right of the main fairway, on the second shot. Safe miss at the green: short, below the valley head',
        view: 'In front the valley floor and its planes either side; in the middle the main fairway climbing, the canal and the footbridge on the right; beyond, high on the curve, the clubhouse',
        ground: 'A perched green: a climb of about 12 m, mostly the curve itself (5% where drives land), the green on a shelf levelled into the valley head; the landing area leans 2.5% left; about 490 m², deep and angled, a back tier',
        dial: 'Par 5 length: 490 yd, reachable in two (the edge of real golf)', height: 'Perched green', shots: { tee: 'Dead straight up the valley', approach: 'A long wood for the green in two' }, hazard: 'Diagonal (the canal)', surround: 'Bunkers',
      },
    }),
  }),

  // 9. THE GREAT WINDOW: up out of the valley onto a terrace, and below it the Great Window, the clubhouse beyond
  hole({ n: 9, name: 'The Great Window', par: 3, legs: [[137, 0]], place: { at: [303, -1757], heading: 280 }, shape: 'One shot',
    build: (P) => ({
      tees: { zenith: 0, meridian: [12, -5], horizon: [24, 5], nadir: [70, -72] },   // Zenith on the rim, Meridian and Horizon on steps down the amphitheatre's near bank (each 3 m short of its lip), Nadir on the south rim
      padL: 3,
      bunkers: [],   // the dial: no bunker; the window and the amphitheatre do the work
      trees: [...grove(P(150, 60), 16, 5, 91, 'plane'), ...grove(P(60, -70), 14, 4, 92, 'plane')],
      villas: [{ at: P(238, 24), w: 70, l: 34, h: 18, rot: 6, clubhouse: true, label: 'the clubhouse' }],
      green: { lobes: [[0, 0, 15, 11, 0], [9, 5, 7, 7, 0]], join: 5, contour: [{ fall: 0, pct: 1.2 }, { ridge: [[-12, 6], [12, 6]], h: 0.3, w: 3 }],
        style: 'Wide and fairly shallow on the clubhouse lawn, on the amphitheatre\'s far rim, falling 1.2% toward the window, a ridge across its back' },
      targets: [],
      words: {
        story: 'Up out of the valley to the rim of an amphitheatre, and there in its floor: the Great Window, stars and Earth through the glass, the clubhouse on the far rim.',
        plays: 'From the rim of a sunken amphitheatre: its floor 8.5 m down, the Great Window set in it, 44 m of glass along the line with the stars and the Earth passing under it. The green is on the far rim, level with the tee, on the clubhouse lawn, the white clubhouse behind. No bunker anywhere: the window and the bowl do the work.',
        safe: 'The middle of the green, or long: long is the clubhouse lawn.',
        bold: null,
        miss: 'Short: into the bowl, and shorter, the window (a stroke and a drop). A ball that lands on the far bank comes back down into the bowl. Long, the lawn. The forward tees step down the near bank; the Nadir tee plays from the south rim across the bowl\'s corner, missing the glass.',
      },
      card: {
        type: 'Original (a par 3 across a gulf over the signature hazard)', form: '-',
        feature: 'The Great Window in the floor of an amphitheatre 8.5 m deep, 44 m across the line', job: 'Hazard (the carry, a penalty area: 91 yd from Zenith, 78 from Meridian, 65 from Horizon) and the reveal',
        decision: 'None: the finish is the set piece, one line',
        miss: 'Small: the collar. Medium: the far bank (back down into the bowl), the lawn long. Big: short, the window (penalty). Safe miss: long',
        view: 'From the amphitheatre\'s rim, its edge 3 m in front: in front the bowl and the glass in its floor, the stars and Earth turning under it; in the middle the far bank and the green on the rim; beyond, the clubhouse and the ring floor climbing on',
        ground: 'A par 3 across a gulf: tee and green level on the rims of an amphitheatre 8.5 m deep, the forward tees on steps down its near bank; the green wide and fairly shallow, falling 1.2% toward the window, a ridge across its back',
        dial: 'Bunker count: none (the window and the amphitheatre do the work)', height: 'Par 3 across a gulf', shots: { tee: '-', approach: 'A high carry that stops' }, hazard: 'Across (the window)', surround: 'A drop back into the bowl',
      },
    }),
  }),
];
