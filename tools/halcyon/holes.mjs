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
    hook: 'Parkland golf inside a wheel in orbit: lawns, woods, lakes and white villas on terraces, the floor climbing up the ring ahead and behind, Earth through the glass of the rims. Its one rule: a floor window is a penalty area (glass; a ball on it takes a stroke and a drop beside where it crossed). The ball flies as on Earth, and the curve plays as it looks. "Wind" is the air handling\'s steady spinward breeze.',
    skeleton: 'Par 35: 4 3 4 5 3 4 4 5 3, the first par 35, the first with three par 3s and the first par-3 finish. Opens gently up the curve toward the day/night line. The big climbs are the 4th (+27 m to the west terraces) and the 8th (+21 m, mostly the curve itself, up the valley), the big drop the 5th (−22 m off the terraces to the balcony), the drivable par 4 the 7th, the long par 3 the 5th. Finishes across the Great Window to the clubhouse: a par 3 over the signature hazard, a finish no course has used.',
    classics: 'Double Plateau (1), Eden (2), Road (3), Leven (7), Channel (8). All five new to the register.',
    decisions: 'Three, each a different type: bite off the Long Window (4), drivable round the spoke (7), go or lay up at the canal (8). One in the last two holes. The rest have one clear line.',
    landmarks: 'The spoke (tees 5, 6 and 7, the 4th\'s second leg): an A-frame foot astride the 7th rising out of the top of the frame to the hub. Earth through the rim glass (tees 2, 3, 4, 5, 7 and 9). The clubhouse, high on the curve ahead (tees 5, 6, 8 and 9, the 4th\'s second leg), played to at the end. The reveal: the 9th tee, up out of the 8th\'s valley, the Great Window spread below with the stars through it.',
    rhythm: 'A gentle opener (a fan, no penalty ground near, the night side climbing ahead). The hardest run is 4 to 7 (the cape over the Long Window and the climb, the long par 3 to the balcony, the long par 4 by the lake, the drivable 7th). The 8th is the breather and a choice, and the 9th finishes on the set piece. Par 4s 310, 380, 430, 455; par 3s 165, 230, 150; par 5s 545 (a cape and a climb) and 560 (a valley and a canal).',
    newBorrowed: 'New to the register: a par 3 across a floor window; a green on a balcony over the rim glass; a spoke\'s foot as a centre-line hazard; a hole along the day/night line; a canal with a lock beside the second shot; a par-3 finish; a curve you can see rise. Borrowed from the over-used list, two: a waterfall (off a villa terrace behind the 6th green) and one bridge (the footbridge over the canal on the 8th).',
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
    h.yards[k] = Math.round((len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  }
  // the tips tee (COURSE.tipsSet, switched off): behind the back tee, 34 m on the par 4s and 5s, 14 m on the par
  // 3s unless the hole says; carried as tips: { tee: [x, z], yards } in the hole's frame, out of tees and yards
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = Math.round((len - tp[0]) / YD / 5) * 5;
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  return { ...def, ...h };
}

const P4 = () => ({ zenith: 0, meridian: 18, horizon: [62, 26], nadir: [104, 28] });
const P4L = () => ({ zenith: 0, meridian: 18, horizon: [62, -26], nadir: [104, -28] });

export const HOLES = [
  // 1. THE PROMENADE: from the tram stop's plaza, up the curve toward the dusk line; a fan between the promenade's
  // lime avenue (left) and a sunken lawn (right), to a double plateau green
  hole({ n: 1, name: 'The Promenade', par: 4, legs: [[225, 0], [122, 20]], place: { at: [236, -560], heading: 180 }, shape: 'Dogleg right',
    build: (P) => ({
      tees: P4(),
      fw: [{ e: [[38, 9, 9], [100, 13, 15], [160, 20, 24], [215, 28, 31], [262, 33, 35], [300, 33, 30], [325, 24, 20], [341, 14, 12]], wob: 4 }],
      cant: [[160, 290, -3.6]],
      forms: [{ at: P(150, 62), rx: 26, rz: 52, h: -1.8, label: 'the sunken lawn' }],
      trees: [...row(P, 30, 320, 17, s => -47 - Math.max(0, s - 220) * 0.12, 'lime', 11), ...row(P, 40, 300, 17, -62, 'lime', 12),
        ...grove(P(385, 10), 26, 12, 13, 'plane'), ...grove(P(205, 92), 20, 7, 14, 'plane')],
      bunkers: [{ at: P(328, -18), rx: 7, rz: 5 }, { at: P(356, 15), rx: 6, rz: 4.5 }],
      green: { lobes: [[-8, -6, 9, 10, -25], [8, 8, 9, 10, -25]], join: 6, contour: [{ fall: 0, pct: 1.1 }, { bowl: [0, 1], r: 12, h: 0.45 }],
        style: 'A Double Plateau: two shelves, front left and back right, about 0.5 m above a low middle that gathers a near miss; the whole green falls 1.2% toward the front' },
      villas: [{ at: P(40, 70), w: 30, l: 18, h: 9, rot: 0 }, { at: P(-10, -95), w: 26, l: 16, h: 6, rot: 0, label: 'the tram stop' }],
      targets: [{ name: 'Right half', at: P(240, 12) }],
      words: {
        story: 'Up the curve from the tram stop toward the dusk line: the floor ahead climbs into the night side, its villas lighting up.',
        plays: 'The round starts on the plaza by the ring tram\'s stop. The hole runs south along the promenade, its lime avenue down the left, and ahead the ring floor climbs into the night side: lawns, woods and white villas going up the curve into the dusk, their windows lighting. The fairway starts narrow between the avenue and a sunken lawn and fans out past 200 m, bending a little right to a Double Plateau green.',
        safe: 'The right half at about 240 m: the fairway leans 3% left toward the avenue, and from the right the green\'s low middle is open.',
        bold: null,
        miss: 'Left, the avenue\'s limes and the villa gardens behind. Right, the sunken lawn (a hollow with a grass bank). Nothing here costs a stroke.',
      },
      card: {
        type: 'Double Plateau', form: 'Fan: narrow between the lime avenue and the sunken lawn, opening past 200 m toward the green',
        feature: 'The Double Plateau green: two shelves about 0.5 m up with a low middle', job: 'Lie-setter for the approach (which shelf, which pin) and a helper: the low middle gathers a near miss',
        decision: 'None: one clear line, down the right half for the open front of the green',
        miss: 'Small: first cut, or the avenue\'s grass verge left. Medium: the limes left, the sunken lawn right. Big: the villa gardens beyond the avenue. No penalty ground. Safe miss at the green: short, into the low middle',
        view: 'In front the fan\'s narrow neck and the avenue; in the middle the fairway rising gently with the curve; beyond, the ring floor climbing ahead into the night side, villa lights coming on up the curve. The landing area shows',
        ground: 'Up the curve about 11 m: the ring floor itself rising ahead (2–5% where drives land), the green on a shelf levelled into it; the landing area leans 3% left toward the avenue, so the right half has the angle; the Double Plateau green',
      },
    }),
  }),

  // 2. THE WALLED GARDEN: an Eden on a villa's walled garden up on the east terraces, the rim glass behind
  hole({ n: 2, name: 'The Walled Garden', par: 3, legs: [[151, 0]], place: { at: [215, -175], heading: 95 }, shape: 'One shot',
    build: (P) => ({
      tees: { zenith: 0, meridian: 9, horizon: [24, -13], nadir: [32, 14] },
      forms: [{ at: P(173, 0), rx: 4, rz: 34, h: -2.4, label: 'the ha-ha' }],
      walls: [{ a: P(181, -42), b: P(181, 42), h: 3.2 }, { a: P(108, -44), b: P(181, -42), h: 3.2 }, { a: P(108, 44), b: P(181, 42), h: 3.2 }],
      trees: [...row(P, 116, 172, 7, -36, 'yew', 21), ...row(P, 116, 172, 7, 36, 'yew', 22), ...grove(P(60, -60), 18, 6, 23, 'plane'), ...grove(P(60, 62), 16, 5, 24, 'plane')],
      villas: [{ at: P(206, 4), w: 34, l: 18, h: 10, rot: 0, label: 'the garden\'s villa' }],
      bunkers: [{ at: P(137, -14), rx: 6, rz: 4.5 }, { at: P(137, 14), rx: 6.5, rz: 4.5 }],
      green: { lobes: [[0, 0, 12, 10, 10], [-7, 4, 6, 6, 0]], join: 5, contour: [{ fall: 0, pct: 2.5 }],
        style: 'An Eden: a broad green tilted 2.5% from back to front, the two bunkers short left and short right, the ha-ha long' },
      targets: [],
      words: {
        story: 'A villa\'s walled garden on the east terraces, the green on its top lawn under the rim glass.',
        plays: 'Across a gravel walk and up onto the garden\'s top lawn, 7 m above the tee. White walls close the garden on three sides with clipped yews along them, the villa stands beyond the back wall, and above it the rim\'s glass climbs out of the frame with Earth in it. The green tilts toward you; the ha-ha, a sunken ditch with a stone face, runs across behind it.',
        safe: 'The middle of the green: anything above the hole is a fast putt down the tilt.',
        bold: null,
        miss: 'Short left and short right, the two bunkers. Long, into the ha-ha (no penalty, but a blind pitch back up the tilt). Off the sides, the yews.',
      },
      card: {
        type: 'Eden', form: '-',
        feature: 'The garden wall and its ha-ha', job: 'Frame (the green reads against the white wall and the rim glass); the ha-ha long is the hazard',
        decision: 'None',
        miss: 'Small: the collar, or the green\'s front tilt sending a short ball back off. Medium: the two bunkers short left and short right, the clipped yews either side. Big: long, into the ha-ha (a sunken ditch, a hard pitch back up; no penalty). Safe miss: short',
        view: 'In front the lawn falling to a gravel walk; in the middle the green on the garden\'s top lawn, its two bunkers; beyond, the white wall, the villa, and Earth through the rim glass',
        ground: 'Up 7 m onto the terrace; the green tilted 2.5% from back to front (the Eden), bunkers short left and right',
      },
    }),
  }),

  // 3. THE TERMINATOR: along the line where day meets night, off the east terrace; an hourglass pinched between a
  // night-side garden wall and a sunken lawn, to a Road green with a villa wall hard behind
  hole({ n: 3, name: 'The Terminator', par: 4, legs: [[240, 0], [153, -20]], place: { at: [400, -90], heading: 270 }, shape: 'Dogleg left',
    build: (P) => ({
      tees: P4(),
      fw: [{ e: [[50, 22, 22], [110, 30, 31], [170, 31, 31], [232, 29, 30], [262, 13, 12], [286, 12, 13], [312, 22, 24], [360, 20, 20], [382, 12, 12]], wob: 3 }],
      cant: [[150, 260, 3]],
      forms: [{ at: P(276, 33), rx: 15, rz: 26, h: -1.6, label: 'the sunken lawn' }],
      walls: [{ a: P(248, -23), b: P(302, -24), h: 2.6 }, { a: P(408, -30), b: P(411, 32), h: 3.0 }],
      villas: [{ at: P(205, -62), w: 26, l: 18, h: 9, rot: 10, label: 'lit villas, the night side' }, { at: P(258, -66), w: 22, l: 16, h: 8, rot: -5 }, { at: P(432, 2), w: 34, l: 20, h: 10, rot: 0 }],
      trees: [...grove(P(150, 70), 22, 8, 31, 'plane'), ...row(P, 120, 230, 22, -46, 'poplar', 32), ...grove(P(330, 58), 16, 5, 33, 'plane')],
      bunkers: [{ at: P(378, -7), rx: 3.5, rz: 3, pot: true }, { at: P(394, 15), rx: 6, rz: 4 }],
      green: { lobes: [[0, 0, 10, 17, 40], [5, -9, 7, 6, 0]], join: 5, contour: [{ fall: 0, pct: 1.8 }],
        style: 'A Road green: long and fairly narrow, set 40° across the line, falling 1.8% toward the front, a deep pot at its front left and the villa wall hard behind (one of the flatter greens: the pot and the wall are its feature)' },
      targets: [{ name: 'Short of the pinch', at: P(232, 6) }],
      words: {
        story: 'Along the line where day meets night: the left of the fairway in the dusk, lit villa gardens beyond; the right in the last light.',
        plays: 'Off the east terrace, 10 m down to the floor, heading west along the line where the mirror band\'s shutters close: to the left the floor climbs the curve into the night side, its villas lit; to the right it is still evening. Far ahead, past the green, the west rim\'s glass and Earth. The fairway is wide to 235 m, then pinches between a night-side garden wall and a sunken lawn, and bends left to a Road green set across the line, a pot at its front and a villa wall close behind.',
        safe: 'Short of the pinch at about 230 m, right of centre: the lean is 3% to the right, away from the night side, and from the right the green opens along its length.',
        bold: null,
        miss: 'Left, the garden wall and the lit villas\' gardens. Right, the sunken lawn. At the green: the pot front left, the wall behind (a ball off it bounces back into the rough); the safe miss is short right.',
      },
      card: {
        type: 'Road', form: 'Hourglass: wide off the terrace, pinched at 262–286 m between the night side\'s garden wall and a sunken lawn, then on to the green',
        feature: 'A garden wall at the pinch and a villa wall hard behind the green', job: 'Obstacle (the pinch\'s left side) and hazard (the wall behind the green, with the Road\'s pot in front)',
        decision: 'None: one clear line, laid up short of the pinch',
        miss: 'Small: first cut, either side. Medium: the garden left, the sunken lawn right. Big: beyond the garden wall left. No penalty ground. Safe miss at the green: short right; the deep pot front left and the wall behind',
        view: 'In front the terrace\'s lip and the wide first half; in the middle the pinch between the wall and the lawn, the light changing across it; beyond, the west rim\'s glass with Earth, and the night side to the left climbing the curve',
        ground: 'Off the east terrace, about 10 m down to the floor; the landing area leans 3% right away from the night side; the contour that matters is the pinch\'s crest; the green set at an angle, one of the flatter greens, with a deep pot at its front and the villa wall behind',
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
      ramps: [[310, 360, 5.5], [390, 440, 5.5]],
      bunkers: [{ at: P(214, -82), rx: 15, rz: 11, job: 'catch' }, { at: P(418, 27), rx: 14, rz: 8, job: 'approach' }, { at: P(486, -15), rx: 6, rz: 4.5 }, { at: P(492, 14), rx: 5, rz: 4 }],
      trees: [...grove(P(232, -90), 26, 11, 41, 'plane'), ...grove(P(110, -62), 20, 6, 42, 'plane'), ...row(P, 300, 470, 24, -48, 'poplar', 43)],
      villas: [{ at: P(540, 10), w: 36, l: 20, h: 10, rot: 0 }, { at: P(470, 62), w: 24, l: 16, h: 8, rot: 0 }],
      green: { lobes: [[0, 0, 11, 14, -15], [-5, 10, 9, 8, 0]], join: 5, raise: 1, falseFront: true, contour: [{ fall: 0, pct: 1.4 }, { tier: [0, 4], up: 180, h: 0.4, w: 5 }],
        style: 'A pear on the lowest villa terrace, raised 1 m with a false front, falling 2% toward the front, a back tier 0.45 m up' },
      targets: [{ name: 'The corner', at: P(206, -38) }, { name: 'Over the window', at: P(290, 0), bold: true }, { name: 'Below the terraces', at: P(410, -4) }],
      boldLine: [[0, 0], P(290, 0)],
      words: {
        story: 'A cape round the Long Window: the floor opens on the stars along the inside of the first leg, and the hole climbs to the west terraces.',
        plays: 'The floor window lies along the right of the first leg, 90 m of glass in a white stone frame with the stars passing under it. The fairway wraps round its far end, its inside edge falling gently toward the glass, then turns right and climbs in two broad steps to a green raised on the lowest villa terrace. Up the curve ahead, from the second leg, the spoke and the clubhouse.',
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
        ground: 'A climb of about 25 m: the curve (10 m), two broad steps up the second leg and the terrace; the landing area leans 3% left, away from the window; the green raised on the lowest villa terrace with a false front',
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
        plays: 'From the lip of the high west terrace, 36 m up, the shot plays down over the long lawn falling from it to a green on a stone balcony standing out over the strip of rim glass at the foot of the west wall. Left, the wall\'s glass climbs out of the frame with Earth in it; ahead, the long lake curves away up the ring with the spoke and the clubhouse beyond.',
        safe: 'The right half: the green falls toward the terrace bank, and the bank sends a ball back on.',
        bold: null,
        miss: 'Left, off the balcony\'s edge onto the rim glass 10 m below (a stroke and a drop). Right, the terrace bank, which feeds a ball back toward the green. Short, the long lawn runs a ball on down. Long, a 4 m drop into the gardens.',
      },
      card: {
        type: 'Original (a long par 3)', form: '-',
        feature: 'The balcony: a stone platform standing out over the strip of rim glass at the foot of the west wall', job: 'Hazard (left falls off the balcony onto the rim glass, a penalty area) and frame (the rim wall\'s glass and Earth beside)',
        decision: 'None',
        miss: 'Small: the collar. Medium: right, the terrace bank, which feeds a ball back (a helper); short, the long lawn, which runs a ball on. Big: left, off the balcony (penalty); long, a drop into the gardens. Safe miss: right',
        view: 'From the high terrace\'s lip (the forward tees down the long lawn): below, the balcony standing out over the rim glass; to the left the rim wall\'s glass and Earth; ahead, the long lake and up the curve the spoke and the clubhouse',
        ground: 'Down about 22 m: 26 m off the high terrace to the balcony, the curve giving back 4; the green angled left to right, falling 2% toward the terrace bank, with one tier',
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
      cant: [[180, 290, 6]],
      bunkers: [{ at: P(196, 15), rx: 11, rz: 15, job: 'catch' }, { at: P(395, 15), rx: 6, rz: 4 }],
      trees: [...grove(P(170, -64), 12, 4, 61, 'willow'), ...grove(P(270, -58), 10, 3, 62, 'willow'), ...row(P, 120, 340, 22, 72, 'poplar', 63), ...grove(P(360, 66), 18, 6, 64, 'plane')],
      villas: [{ at: P(452, -8), w: 34, l: 18, h: 9, rot: -28, label: 'the villa terrace and its falls' }],
      falls: [{ at: P(436, -28), w: 9, h: 12 }],
      green: { lobes: [[0, 0, 10, 15, -20], [-7, -7, 7, 8, 0]], join: 5, contour: [{ fall: 270, pct: 1.2 }, { ridge: [[-9, -10], [9, -8]], h: -0.25, w: 3 }],
        style: 'Long and angled to the left, falling 1.3% toward the lake, a swale across its front third; the terrace bank behind' },
      targets: [{ name: 'Between the bays', at: P(236, -6) }],
      words: {
        story: 'Along the long lake that curves up the ring at both ends, to a green under a villa terrace\'s waterfall.',
        plays: 'North along the lake\'s east shore: the water curves away up the ring ahead, rising into the distance, with the spoke beyond it. Two of the lake\'s bays bite into the fairway from the left, bunkers from the right, so the line weaves. The landing area leans 6% to the right, away from the lake and into a catch bunker. At the end the hole turns right to a green under a villa terrace; a waterfall drops off the terrace into a pool left of the green.',
        safe: 'Between the bays at about 235 m, a little left of centre: the lean takes the ball right, away from the water.',
        bold: null,
        miss: 'Left, the lake (a stroke and a drop), past the bays\' reeds. Right, the catch bunker, then poplars. At the green: long and right is the terrace bank (it holds a ball); long left, the falls pool.',
      },
      card: {
        type: 'Original (a long par 4)', form: 'Scalloped: the lake\'s bays bite in from the left, a bunker from the right, alternating down the hole',
        feature: 'The lake and the waterfall off the villa terrace behind the green', job: 'Hazard (the lake on the left) and frame (the waterfall); the terrace bank behind the green is a backstop (helper)',
        decision: 'None: one clear line, weaving between the bays',
        miss: 'Small: first cut, a bay\'s shore grass. Medium: the catch bunker right, the reeds left. Big: the lake left (penalty, one side only; the right has room). Safe miss at the green: right and long, against the terrace bank',
        view: 'In front a lawn down to the shore; in the middle the fairway weaving between the bays; beyond, the lake curving up the ring into the distance with the spoke above it, and the villa terrace and its falls',
        ground: 'Up the curve about 14 m along the shore (the lake follows the curve, rising with it), to the green below the terrace; the landing area leans 6% right, away from the lake and into the catch bunker (the course\'s strong sidehill); the green falls 1.3% toward the lake with a swale across its front third',
      },
    }),
  }),

  // 7. THE SPOKE: drivable between the spoke's legs: its west foot stands in the fairway, the green on its plinth
  hole({ n: 7, name: 'The Spoke', par: 4, legs: [[283, 0]], place: { at: [-170, -1110], heading: 90 }, shape: 'Straight',
    build: (P, L, len) => ({
      tees: { zenith: 0, meridian: 18, horizon: [55, 24], nadir: [92, 26] },   // the forward tees right of the line, so the spoke's foot doesn't stand between them and the landing area
      fw: [{ e: [[30, 14, 14], [90, 24, 24], [150, 46, 44], [185, 50, 48], [210, 44, 42], [240, 30, 32], [270, 20, 22]], wob: 3 }, { bite: [[182, 0, 20, 23]], wob: 1.5 }],
      cant: [[150, 260, 2.5]],
      forms: [{ at: P(256, 19), rx: 10, rz: 8, h: 2.2, label: 'the plinth\'s mound' }],
      feet: [{ at: P(180, 0), w: 34, h: 120, label: 'the spoke\'s west foot' }, { at: P(420, 0), w: 34, h: 120, label: 'its east foot' }],
      bunkers: [{ at: P(268, 15), rx: 7, rz: 4.5 }],
      trees: [...grove(P(205, 72), 22, 8, 71, 'plane'), ...grove(P(110, 64), 16, 5, 72, 'plane')],
      green: { lobes: [[0, 0, 12, 13, 0], [-7, -7, 8, 7, 0]], join: 5, contour: [{ fall: 0, pct: 1.2 }, { bowl: [-7, -8], r: 9, h: 0.3 }],
        style: 'Round-shouldered on the spoke\'s plinth, its front open on the left, a bunker front right, falling 1.6% toward the front with a bowl that gathers to one pin' },
      targets: [{ name: 'Right of the foot', at: P(212, 30) }, { name: 'At the green', at: P(len - 2, -3), bold: true }],
      boldLine: [[0, 0], P(250, -40)],
      words: {
        story: 'Drivable between the spoke\'s legs: its west foot stands in the fairway, the green on the plinth under the A-frame.',
        plays: 'Off the waterfall\'s terrace, 8 m down. The spoke\'s west foot, 34 m across, stands in the middle of the fairway 180 m out and rises out of the top of the frame toward the hub; its east foot stands beyond the green, the two meeting 260 m up. The green sits on the plinth between them, its front open on the left. The canal runs down the left, the far rim\'s glass and Earth beyond the green.',
        safe: 'Right of the foot (about 210 m): wide and safe, but a mound on the plinth hides the green and the pitch comes in over the front-right bunker.',
        bold: 'Left of the foot along the canal: about 280 m to the green\'s open front, a running shot from the left.',
        miss: 'Into the foot (a ball off it drops at its base). Left, the canal (a stroke and a drop), the bold side only. Right, planes. At the green: the bunker front right; the safe miss is short left.',
      },
      card: {
        type: 'Leven', form: 'Island: one fairway with the spoke\'s west foot as the hole in it',
        feature: 'The spoke\'s west foot, 34 m across, rising out of the top of the frame to the hub', job: 'Obstacle (centre-line) and landmark; with the mound on the plinth it hides the green from the safe side',
        decision: 'Drivable: left of the foot, along the canal, the green opens (about 280 m to the front, a running shot); right of the foot is wide and safe, but the mound hides the green and leaves a pitch over a bunker',
        miss: 'Small: first cut either side. Medium: right, a plane grove; left, the canal\'s grass bank. Big: the canal left (penalty, the bold side only). Safe miss at the green: short left',
        view: 'In front the fairway; in the middle the spoke\'s west foot astride it, the canal glinting left; beyond, the green on the plinth between the legs and Earth through the east rim glass; the foot rises out of the top of the frame',
        ground: 'Off the waterfall terrace about 8 m down to the floor; the landing areas lean 2% right; the green on the spoke\'s plinth, its front open on the left, a mound guarding its right',
      },
    }),
  }),

  // 8. THE AQUEDUCT: up the tree-lined valley toward the clubhouse, the canal up its right side; the Channel is a
  // second fairway beyond the canal that shortens the hole
  hole({ n: 8, name: 'The Aqueduct', par: 5, legs: [[265, 0], [245, 20]], place: { at: [160, -1195], heading: 0 }, shape: 'Dogleg right', tips: [-30, 0],
    build: (P) => ({
      tees: P4L(),
      fw: [{ e: [[50, 20, 22], [130, 28, 30], [230, 30, 32], [300, 28, 22], [360, 24, 18], [420, 22, 18], [470, 16, 15], [490, 10, 10]], wob: 4 },
        { lobes: [[322, 86, 46, 21, 0], [384, 72, 30, 17, 12]], join: 12, wob: 3, seed: 83 }],
      cant: [[180, 280, -2.5]],
      bunkers: [{ at: P(440, -24), rx: 14, rz: 9, job: 'approach' }, { at: P(492, -15), rx: 6, rz: 4.5 }, { at: P(498, 14), rx: 5, rz: 4 }],
      trees: [...row(P, 40, 420, 20, -82, 'plane', 81), ...row(P, 40, 260, 20, 100, 'plane', 82), ...grove(P(150, -100), 22, 9, 84, 'plane'), ...grove(P(470, -70), 20, 7, 85, 'plane')],
      bridge: { a: P(300, 46), b: P(300, 66), label: 'the footbridge' },
      green: { lobes: [[0, 0, 11, 15, 10], [5, 10, 9, 7, 0]], join: 5, contour: [{ fall: 0, pct: 1.4 }, { tier: [0, 3], up: 180, h: 0.45, w: 5 }],
        style: 'On a shelf levelled into the valley head, falling 2% toward the front, a back tier 0.5 m up' },
      targets: [{ name: 'Up the valley', at: P(240, -4) }, { name: 'Short of the bend', at: P(368, -6) }, { name: 'Over the canal', at: P(330, 84), bold: true }],
      boldLine: [P(240, -4), P(330, 84)],
      words: {
        story: 'Up a tree-lined valley toward the clubhouse, the canal up its right side and through a lock at the bend; the aqueduct carries it on over the terraces.',
        plays: 'Up the valley the ring\'s curve becomes a climb: the floor rises 5% where drives land and 10% at the valley head. Planes line both banks; the canal runs up the right side to a lock at the bend, then turns away across the terraces on an aqueduct. Beyond it, on the right, lies the Channel: a second fairway that cuts the corner. The clubhouse stands high on the curve ahead.',
        safe: 'Up the valley (240 m), then short of the bend on the main fairway (about 370 m): a full pitch up to the green\'s shelf.',
        bold: 'From the drive, carry the canal onto the Channel fairway (about 190 yd): it leaves a short pitch over the canal\'s top to the green.',
        miss: 'Left, the valley\'s planes. Right of the main fairway, the canal (a stroke and a drop), past 15 m of rough. Short of the green, the approach bunker left. Long, 45 m past the green, the Great Window (a penalty area).',
      },
      card: {
        type: 'Channel', form: 'Double: the main fairway up the valley, and a second fairway out across the canal on the right that shortens the hole',
        feature: 'The canal and its lock, up the right of the valley', job: 'Hazard (a penalty area between the two fairways) and aim point (the lock\'s white gates at the bend)',
        decision: 'Go or lay up: carry the canal with the second (about 190 yd from a good drive) to the Channel fairway, leaving a short pitch to the green, or stay on the main fairway, short of the bend, and pitch up in three',
        miss: 'Small: first cut, the valley\'s lower banks. Medium: the planes up both banks. Big: the canal (penalty) right of the main fairway, on the second shot; a long approach runs on 45 m to the Great Window. Safe miss at the green: short, below the valley head',
        view: 'In front the valley floor and its planes either side; in the middle the main fairway climbing, the canal and the footbridge on the right; beyond, high on the curve, the clubhouse',
        ground: 'A climb of about 27 m, mostly the curve itself: the valley floor rises with the ring (5% where drives land, 10% at the head; the green on a shelf levelled into it); the landing area leans 2.5% left; a back tier',
      },
    }),
  }),

  // 9. THE GREAT WINDOW: up out of the valley onto a terrace, and below it the Great Window, the clubhouse beyond
  hole({ n: 9, name: 'The Great Window', par: 3, legs: [[137, 0]], place: { at: [303, -1757], heading: 280 }, shape: 'One shot',
    build: (P) => ({
      tees: { zenith: 0, meridian: [12, -5], horizon: [24, 5], nadir: [50, -38] },   // the upper three each on its own step, 3 m short of its lip
      padL: 3,
      bunkers: [{ at: P(150, -15), rx: 7, rz: 5 }],
      trees: [...grove(P(150, 60), 16, 5, 91, 'plane'), ...grove(P(60, -70), 14, 4, 92, 'plane')],
      villas: [{ at: P(238, 24), w: 70, l: 34, h: 18, rot: 6, clubhouse: true, label: 'the clubhouse' }],
      green: { lobes: [[0, 0, 15, 11, 0], [9, 5, 7, 7, 0]], join: 5, contour: [{ fall: 0, pct: 1.5 }, { ridge: [[-12, 6], [12, 6]], h: 0.3, w: 3 }],
        style: 'Wide and fairly shallow on the clubhouse lawn, falling 1.5% toward the window, a ridge across its back' },
      targets: [],
      words: {
        story: 'Up out of the valley onto a terrace, and there below it: the Great Window, stars and Earth through the floor, the clubhouse beyond.',
        plays: 'Up out of the 8th\'s valley onto the top of three stepped terraces, 10 m above the clubhouse lawn, each tee at its step\'s lip: the first sight of the Great Window, 56 m of floor glass straight across the line, the stars and the Earth passing under it. Beyond it the green on the lawn, the white clubhouse behind, and the ring floor climbing on past it.',
        safe: 'The middle of the green, or long: long is the clubhouse lawn.',
        bold: null,
        miss: 'Short, the window (a stroke and a drop). Long left, a bunker; long right, the lawn. The Nadir tee plays from the floor by the window\'s south-east corner, a 60 yd carry.',
      },
      card: {
        type: 'Original (a short par 3 over the signature hazard)', form: '-',
        feature: 'The Great Window, 56 m across the line', job: 'Hazard (the carry, a penalty area; 118 yd from the Zenith tee, 60 from the Nadir) and the reveal',
        decision: 'None: the finish is the set piece, one line',
        miss: 'Small: the collar. Medium: a bunker long left, the clubhouse lawn long. Big: short, the window (penalty). Safe miss: long',
        view: 'From the top terrace 10 m up, its lip 3 m in front (a tee set back from a lip would see none of the glass): in front the glass with the stars and Earth turning under it; in the middle the green on the clubhouse lawn; beyond, the clubhouse villa and the ring floor climbing on',
        ground: 'Down about 12 m from the top terrace to the green, the forward tees on the lower steps (7 and 4 m); the green wide and fairly shallow, falling 1.5% toward the window, a ridge across its back',
      },
    }),
  }),
];
