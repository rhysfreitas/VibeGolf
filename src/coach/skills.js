// Coaching range: Learn a skill. Pure (no DOM, no Three.js). See docs/COACHING.md.
//
// You pick a skill (and its option: draw or fade, high or low). The mannequin shows its two or
// three keys, then you hit in fours. Each shot is scored against the skill's goal numbers. After
// every four shots with the skill's club, the coach reads what's in the way (the first of the
// skill's blockers that holds) and shows its lesson, or says you're on track. 3 of 4 in the goal
// = learned for now, then a test: 5 of the next 8. After the test it stays open-ended: the meter
// keeps tracking and the coach still reads every four shots. Only something urgent (a shank, a
// run of fat shots) interrupts; other faults wait for Watch mode.
//
//   const s = createSkillCoach({ skill: 'shape', option: 'draw', club: '7i', stockMs })
//   s.addShot(shot, clubId) -> events: wrongClub | tick | read | learned | test | passed | retest | urgent
//   s.state · s.meter · s.series · s.goals()

import { shotMetrics, RULES } from './coach-logic.js';
import { windowsFor as physicsWindows } from './windows.js';
import { simulate } from '../physics.js';

export const SKILL_WINDOW = 4;   // shots per read
export const LEARN_NEED = 3;     // of 4 in the goal: learned for now
export const TEST_SHOTS = 8;     // the test: this many shots ...
export const TEST_NEED = 5;      // ... with this many in the goal

const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
const IRONS = ['5i', '7i', '9i', 'PW'];

// peak height (ft) and carry (yd) of the shot, from the flight model
export function flightOf(shot) {
  const r = simulate({ Speed: +shot.Speed || 0, VLA: +shot.VLA || 0, HLA: 0, TotalSpin: +shot.TotalSpin || 0, SpinAxis: 0 }, { flightOnly: true });
  return { peak: r.apexFt, carry: r.carry };
}
export const peakFt = shot => flightOf(shot).peak;
// a shot's metrics plus its peak height and carry
export function skillMetrics(shot, club) { return { ...shotMetrics(shot, club), ...flightOf(shot) }; }
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };

// a goal: { key, label, unit, lo, hi, tol, club: true if it needs club data from the R10,
// soft: true if it scores but doesn't decide "in the goal" (the R10's face and path scatter
// 2–4° shot to shot, too much to require on every shot; tools/coach/skill-check.mjs) }
const G = (key, label, unit, lo, hi, tol, club = false, soft = false) => ({ key, label, unit, lo, hi, tol, club, soft });
const soft = g => ({ ...g, soft: true });
// a blocker: what's in the way, its test over a window of metrics, the cue and lesson
const B = (id, headline, sub, cue, lesson, test) => ({ id, headline, sub, cue, lesson, test });

// stock flight for the club: your own normal shots when there are four, else the club's window
function stockOf(ctx) {
  const ms = ctx.stockMs || [];
  if (ms.length >= 4) return { launch: median(ms.map(m => m.launch)), peak: median(ms.map(m => m.peak)), spin: median(ms.map(m => m.spin)), carry: median(ms.map(m => m.carry)), clubSpeed: median(ms.map(m => m.clubSpeed)), axis: median(ms.map(m => m.axis)), dir: median(ms.map(m => m.dir)), own: true };
  const w = ctx.w, f = flightOf({ Speed: w.clubSpeed * w.smashRef, VLA: w.launchC, TotalSpin: w.spinC });
  return { launch: w.launchC, peak: f.peak, spin: w.spinC, carry: f.carry, clubSpeed: w.clubSpeed, axis: 0, dir: 0, own: false };
}
// the middle of your recent pattern (for Tighten your pattern)
const centreOf = (ms, key) => (ms.length >= 4 ? median(ms.slice(-8).map(m => m[key])) : 0);
const WEDGE_LEN = { nine: 0.7, ten30: 0.85, full: 1 };
// Take the curve out: how much curve is allowed on the side you curve it (70% of your usual,
// at least 5°) and over on the other side (7°). Shot to shot the curve scatters about ±6° even
// when the average is right, so a goal of half the curve couldn't be met 3 times in 4: one
// that's met 3 times in 4 means the average has come down to about a third.
// +1 = the slice side (spin axis right).
const curveSide = o => (o === 'slice' ? 1 : -1);
const curveLim = (o, ctx) => Math.max(5, curveSide(o) * stockOf(ctx).axis * 0.7);
export const CURVE_OVER = 7;

export const SKILLS = {
  shape: {
    id: 'shape', name: 'Shape it', blurb: 'Draw or fade on demand: start it on one side, curve it back.',
    options: [{ id: 'draw', name: 'Draw' }, { id: 'fade', name: 'Fade' }],
    clubs: null, defaultClub: '7i',
    title: o => (o === 'draw' ? 'Hit a draw' : 'Hit a fade'),
    sub: o => (o === 'draw' ? 'Start it right of the target and curve it back: the path out to the right, the face between the path and the target.' : 'Start it left of the target and curve it back: the path across to the left, the face between the path and the target.'),
    cue: o => (o === 'draw' ? 'Aim right, swing out, toe over' : 'Aim left, swing left, hold the face'),
    keys: o => (o === 'draw'
      ? [{ title: 'Set up a touch right', lesson: 'skill-draw-setup' }, { title: 'Swing out to the right', lesson: 'skill-draw-path' }, { title: 'Face closed to the path', lesson: 'skill-draw-face' }]
      : [{ title: 'Set up a touch left', lesson: 'skill-fade-setup' }, { title: 'Swing across to the left', lesson: 'skill-fade-path' }, { title: 'Face open to the path', lesson: 'skill-fade-face' }]),
    goals: (o) => (o === 'draw'
      ? [G('dir', 'Start line', '°', -0.5, 5, 3), G('axis', 'Curve (spin axis)', '°', -14, -2, 4), soft(G('path', 'Path', '°', 2, 7, 3)), soft(G('ftp', 'Face to path', '°', -5, -1.5, 2.5))]
      : [G('dir', 'Start line', '°', -5, 0.5, 3), G('axis', 'Curve (spin axis)', '°', 2, 14, 4), soft(G('path', 'Path', '°', -7, -2, 3)), soft(G('ftp', 'Face to path', '°', 1.5, 5, 2.5))]),
    blockers: o => (o === 'draw' ? [
      B('pathLeft', "The path isn't out to the right yet", 'With the path still left, the ball has nothing to curve back across.', 'Swing out toward right field', 'skill-draw-path', ms => mean(ms.map(m => m.path)) < 1.5),
      B('tooHooky', "It's hooking: too much face", 'The face is shutting well past the path, so it starts left or curves too far.', 'Hold the face a touch longer', 'closed-body', ms => mean(ms.map(m => m.ftp)) < -6 || mean(ms.map(m => m.dir)) < -1.5),
      B('faceOpen', "The face isn't closing to the path", 'The path is right, but the face matches it, so the ball pushes instead of drawing.', 'Toe over through the ball', 'skill-draw-face', ms => mean(ms.map(m => m.ftp)) > -1),
    ] : [
      B('pathRight', "The path isn't across to the left yet", 'With the path still right, the ball has nothing to curve back across.', 'Swing left through the ball', 'skill-fade-path', ms => mean(ms.map(m => m.path)) > -1.5),
      B('tooSlicey', "It's slicing: too much face", 'The face is far open to the path, so it starts right or curves too far.', 'Let the face square up a little', 'open-rotation', ms => mean(ms.map(m => m.ftp)) > 6 || mean(ms.map(m => m.dir)) > 1.5),
      B('faceClosed', "The face isn't staying open to the path", 'The path is left, but the face matches it, so the ball pulls instead of fading.', 'Hold the face, quiet hands', 'skill-fade-face', ms => mean(ms.map(m => m.ftp)) < 1),
    ]),
  },
  compress: {
    id: 'compress', name: 'Compress your irons', blurb: 'Ball first, then turf: hands ahead, less loft, a solid strike.',
    options: null, clubs: IRONS, defaultClub: '7i',
    title: () => 'Compress your irons', sub: () => 'Hit down on it with the hands ahead: less loft at impact, the ball first, then the turf.',
    cue: () => 'Hands ahead, chest over the ball',
    keys: () => [{ title: 'Pressure forward', lesson: 'skill-compress-pressure' }, { title: 'Hands ahead at impact', lesson: 'skill-compress-hands' }, { title: 'Low point past the ball', lesson: 'skill-compress-low' }],
    goals: (o, ctx) => { const w = ctx.w; return [soft(G('aoa', 'Attack', '°', w.aoa[0] - 1.5, (w.aoa[0] + w.aoa[1]) / 2, 2, true)), G('spinLoft', 'Spin loft', '°', w.spinLoft - 7, w.spinLoft - 1.5, 3), G('smash', 'Smash', '', w.smashMin, w.smashRef + 0.05, 0.06)]; },
    blockers: () => [
      B('flip', 'The club is adding loft', 'The clubhead passes the hands before the ball, so it arrives with too much loft and spin.', 'Hands ahead at impact', 'flip-cast', (ms, ctx) => mean(ms.map(m => m.spinLoft)) > ctx.w.spinLoft + 2.5),
      B('weightBack', "Pressure isn't getting forward", 'The weight stays back, so the club bottoms out early and catches the ball on the way up.', 'Pressure into the lead foot first', 'flip-weight', (ms, ctx) => ms.some(m => m.hasClub) && mean(ms.map(m => m.aoa)) > (ctx.w.aoa[0] + ctx.w.aoa[1]) / 2 + 0.5),
      B('strike', "Contact isn't solid yet", 'The ball comes off slow: the low point is moving, so some catch the turf first.', 'Ball first, then turf', 'skill-compress-low', (ms, ctx) => mean(ms.map(m => m.smash)) < ctx.w.smashMin - 0.02),
    ],
  },
  driverUp: {
    id: 'driverUp', name: 'Hit up on the driver', blurb: 'An upward strike: higher launch and less spin for more carry.',
    options: null, clubs: ['DR'], defaultClub: 'DR',
    title: () => 'Hit up on the driver', sub: () => 'Ball forward, tee it up and tilt away, so the club meets the ball on the way up: higher launch, less spin.',
    cue: () => 'Tee high, tilt away, swing up',
    keys: () => [{ title: 'Ball forward, tee it high', lesson: 'skill-driver-setup' }, { title: 'Tilt away from the target', lesson: 'skill-driver-tilt' }, { title: 'Up through the ball', lesson: 'skill-driver-up' }],
    goals: (o, ctx) => { const w = ctx.w; return [G('aoa', 'Attack', '°', 1.5, 5.5, 2, true), G('launch', 'Launch', '°', w.launchC + 1, w.launchC + 5, 2.5), G('spin', 'Spin', 'rpm', w.spinC * 0.72, w.spinC * 1.0, w.spinC * 0.25)]; },
    blockers: () => [
      B('down', "You're still hitting down on it", 'The club is still descending at the ball, which launches it low with extra spin.', 'Ball off the lead heel, tee it high', 'skill-driver-setup', (ms, ctx) => (ms.some(m => m.hasClub) ? mean(ms.map(m => m.aoa)) < 1 : mean(ms.map(m => m.launch)) < ctx.w.launchC)),
      B('noTilt', 'The launch is still low', 'The strike is going up, but the spine moves toward the target, which takes the launch back off.', 'Stay tilted through impact', 'skill-driver-tilt', (ms, ctx) => mean(ms.map(m => m.launch)) < ctx.w.launchC + 1),
      B('spin', 'Too much spin', 'The ball climbs and stalls: the strike is low on the face or the loft is adding up.', 'Strike it a touch higher on the face', 'skill-driver-up', (ms, ctx) => mean(ms.map(m => m.spin)) > ctx.w.spinC),
    ],
  },
  flight: {
    id: 'flight', name: 'Flight it high or low', blurb: 'Knockdowns and high soft shots, against your normal flight.',
    options: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }],
    clubs: ['5i', '7i', '9i', 'PW', 'SW', 'HY'], defaultClub: '7i', needsStock: true,
    title: o => (o === 'low' ? 'Hit it low' : 'Hit it high'),
    sub: o => (o === 'low' ? 'A knockdown: ball back, hands ahead and a shorter finish. It launches lower and peaks well below your normal shot.' : 'A high, soft shot: ball forward, let the club release and finish high. It launches higher and peaks above your normal shot.'),
    cue: o => (o === 'low' ? 'Ball back, hands ahead, short finish' : 'Ball forward, release it, finish high'),
    keys: o => (o === 'low'
      ? [{ title: 'Ball back, hands ahead', lesson: 'skill-low-setup' }, { title: 'Hold the angle through it', lesson: 'skill-low-impact' }, { title: 'Short, low finish', lesson: 'skill-low-finish' }]
      : [{ title: 'Ball forward', lesson: 'skill-high-setup' }, { title: 'Let the club release', lesson: 'skill-high-impact' }, { title: 'Full, high finish', lesson: 'skill-high-finish' }]),
    hints: o => (o === 'low' ? [['Launch', '3–9° below normal'], ['Peak height', 'under ¾ of normal'], ['Start line', 'within 4°']] : [['Launch', '3–9° above normal'], ['Peak height', '15%+ above normal'], ['Start line', 'within 4°']]),
    goals: (o, ctx) => { const s = stockOf(ctx); return o === 'low'
      ? [G('launch', 'Launch', '°', s.launch - 9, s.launch - 3, 3), G('peak', 'Peak height', 'ft', s.peak * 0.4, s.peak * 0.75, s.peak * 0.2), G('dir', 'Start line', '°', -4, 4, 4)]
      : [G('launch', 'Launch', '°', s.launch + 3, s.launch + 9, 3), G('peak', 'Peak height', 'ft', s.peak * 1.15, s.peak * 1.7, s.peak * 0.2), G('dir', 'Start line', '°', -4, 4, 4)]; },
    blockers: o => (o === 'low' ? [
      B('launchHigh', 'It still launches like your normal shot', 'The ball needs to start lower: move it back and keep the hands ahead to take loft off.', 'Ball back, hands ahead', 'skill-low-setup', (ms, ctx) => mean(ms.map(m => m.launch)) > stockOf(ctx).launch - 3),
      B('climbs', 'It starts low, then climbs', 'The launch is down, but a long, fast finish adds spin, so the ball climbs anyway.', 'Shorter, quieter finish', 'skill-low-finish', (ms, ctx) => mean(ms.map(m => m.peak)) > stockOf(ctx).peak * 0.75),
    ] : [
      B('launchLow', 'It still launches like your normal shot', 'The ball needs to start higher: move it forward and let the club release, so it arrives with more loft.', 'Ball forward, release it', 'skill-high-setup', (ms, ctx) => mean(ms.map(m => m.launch)) < stockOf(ctx).launch + 3),
      B('peaksLow', "It doesn't climb", 'The launch is up, but the ball needs a full, high finish to keep the speed and spin that carry it up.', 'Finish high', 'skill-high-finish', (ms, ctx) => mean(ms.map(m => m.peak)) < stockOf(ctx).peak * 1.15),
    ]),
  },
  line: {
    id: 'line', name: 'Start it on your line', blurb: 'Face control: start every ball within a degree or two of the target.',
    options: null, clubs: null, defaultClub: '7i',
    title: () => 'Start it on your line', sub: () => 'The face sets most of the start line. Aim it first, keep it square at the top, and let the body turn it back to the ball.',
    cue: () => 'Face at the target, then the feet',
    keys: () => [{ title: 'Aim the face first', lesson: 'skill-line-aim' }, { title: 'Square at the top', lesson: 'skill-line-top' }, { title: 'The body squares it', lesson: 'skill-line-body' }],
    goals: () => [G('dir', 'Start line', '°', -1.5, 1.5, 3), soft(G('face', 'Face', '°', -2, 2, 3))],
    blockers: () => [
      B('aimed', "You're lined up off target", 'Every ball starts the same way off line with the face and path agreeing: the setup is aimed there.', 'Face at the target, then the feet', 'aim-body', ms => Math.abs(mean(ms.map(m => m.dir))) >= 2 && Math.abs(mean(ms.map(m => m.ftp))) <= 2 && sd(ms.map(m => m.dir)) < 2),
      B('faceRight', 'The face is open at impact', 'It starts right because the face arrives open: often a cupped wrist at the top.', 'Flat lead wrist at the top', 'open-wrist', ms => mean(ms.map(m => m.dir)) > 1.5),
      B('faceLeft', 'The face is shut at impact', 'It starts left because the face arrives closed: the hands are rolling it over.', 'Body turns, hands stay quiet', 'closed-body', ms => mean(ms.map(m => m.dir)) < -1.5),
      B('both', 'It starts both ways', "The face isn't the same twice: some open, some shut.", 'Same grip pressure, body leads', 'skill-line-body', ms => sd(ms.map(m => m.dir)) >= 2),
    ],
  },
  centre: {
    id: 'centre', name: 'Find the centre', blurb: 'A solid strike: the most ball speed for your club speed, every time.',
    options: null, clubs: null, defaultClub: '7i',
    title: () => 'Find the centre', sub: () => 'Ball speed comes from the strike. Keep your posture, find the same low point and you hit the middle more often.',
    cue: () => 'Keep your chest over the ball',
    keys: () => [{ title: 'Keep your posture', lesson: 'skill-centre-posture' }, { title: 'Same low point', lesson: 'skill-compress-low' }, { title: 'Balanced finish', lesson: 'skill-centre-finish' }],
    goals: (o, ctx) => { const w = ctx.w; return [G('smash', 'Smash', '', w.smashMin, w.smashRef + 0.05, 0.06), G('launch', 'Launch', '°', w.launch[0] - 1, w.launch[1] + 1, 3)]; },
    blockers: () => [
      B('fat', 'It catches the turf first', 'The club bottoms out behind the ball: the head and chest are dropping toward it.', 'Stay tall through the ball', 'steep-dive', (ms, ctx) => ms.filter(m => RULES.fat.test(m, ctx.w)).length >= 2),
      B('thin', 'It catches the ball thin', 'The club meets the ball high: the body stands up through impact.', 'Keep your hips back', 'thin-extension', (ms, ctx) => ms.filter(m => RULES.thin.test(m, ctx.w)).length >= 2),
      B('mixed', 'Contact is all over the face', 'Speed off the face changes shot to shot: the posture and low point are moving.', 'Keep your chest over the ball', 'skill-centre-posture', (ms, ctx) => mean(ms.map(m => m.smash)) < ctx.w.smashMin || sd(ms.map(m => m.smash)) > 0.04),
    ],
  },
  wedges: {
    id: 'wedges', name: 'Wedge distance control', blurb: "Three swing lengths with your wedges, each to its own number.",
    options: [{ id: 'nine', name: "9 o'clock" }, { id: 'ten30', name: '10:30' }, { id: 'full', name: 'Full' }],
    clubs: ['PW', 'SW', '9i'], defaultClub: 'PW', needsStock: true,
    title: o => `Wedges: ${o === 'nine' ? "9 o'clock" : o === 'ten30' ? '10:30' : 'full'} swings`,
    sub: o => (o === 'full' ? 'The same full swing every time, for the same carry.' : `Swing back until the lead arm points at ${o === 'nine' ? "9 o'clock" : '10:30'}, then through at the same pace. The length sets the distance, not the effort.`),
    cue: o => (o === 'full' ? 'Same length, same tempo' : 'Length sets distance, same tempo'),
    keys: o => [{ title: o === 'full' ? 'A full turn' : `Back to ${o === 'nine' ? "9 o'clock" : '10:30'}`, lesson: o === 'nine' ? 'skill-wedge-nine' : o === 'ten30' ? 'skill-wedge-ten30' : 'skill-wedge-full' }, { title: 'Same tempo through', lesson: 'skill-wedge-through' }, { title: 'Ball first', lesson: 'skill-compress-low' }],
    hints: o => [['Carry', o === 'full' ? 'your full carry ±4 yd' : `${Math.round(WEDGE_LEN[o] * 100)}% of full ±4 yd`]],
    goals: (o, ctx) => { const t = stockOf(ctx).carry * WEDGE_LEN[o]; return [G('carry', 'Carry', 'yd', t - 4, t + 4, 6)]; },
    blockers: o => [
      B('strike', "Contact isn't solid", 'Distance control starts with the strike: a heavy one comes up short whatever the length.', 'Ball first, then turf', 'skill-compress-low', (ms, ctx) => mean(ms.map(m => m.smash)) < ctx.w.smashMin - 0.04),
      B('spread', "The carries don't match", 'The same swing is going different distances: the length or the pace is changing.', 'Same length, same tempo', o === 'nine' ? 'skill-wedge-nine' : o === 'ten30' ? 'skill-wedge-ten30' : 'skill-wedge-full', ms => sd(ms.map(m => m.carry)) > 5),
      B('long', "They're flying long", 'The swing is longer or faster than the number needs.', 'Shorter backswing, same tempo', 'skill-wedge-through', (ms, ctx) => mean(ms.map(m => m.carry)) > stockOf(ctx).carry * WEDGE_LEN[o] + 4),
      B('short', "They're coming up short", 'The club slows into the ball: it should speed up through it.', 'Accelerate through the ball', 'skill-wedge-through', (ms, ctx) => mean(ms.map(m => m.carry)) < stockOf(ctx).carry * WEDGE_LEN[o] - 4),
    ],
  },
  straight: {
    id: 'straight', name: 'Take the curve out', blurb: 'Less of your usual slice or hook, starting on the target line.',
    options: [{ id: 'slice', name: 'Less slice' }, { id: 'hook', name: 'Less hook' }],
    clubs: null, defaultClub: '7i', needsStock: true,
    title: o => (o === 'slice' ? 'Take the slice out' : 'Take the hook out'),
    sub: o => (o === 'slice'
      ? 'A slice is a path across the ball to the left with the face open to it. Swing more from the inside and let the face close, and the curve comes down: aim at the target, not left of it.'
      : 'A hook is a path out to the right with the face shut to it. Turn through so the arms stop racing past the body and hold the face, and the curve comes down: aim at the target, not right of it.'),
    cue: o => (o === 'slice' ? 'Arms drop first, toe up after impact' : 'Chest keeps turning, quiet hands'),
    keys: o => (o === 'slice'
      ? [{ title: 'Aim at the target', lesson: 'skill-straight-aim' }, { title: 'Arms drop first', lesson: 'ott-shoulders' }, { title: 'Let the face close', lesson: 'open-rotation' }]
      : [{ title: 'Aim at the target', lesson: 'skill-line-aim' }, { title: 'Keep turning through', lesson: 'stuck-hips' }, { title: 'Hold the face', lesson: 'closed-body' }]),
    hints: () => [['Curve', 'well under your usual'], ['Start line', 'within 3° of the target']],
    goals: (o, ctx) => { const L = curveLim(o, ctx), k = curveSide(o), lo = k > 0 ? -CURVE_OVER : -L, hi = k > 0 ? L : CURVE_OVER;
      return [G('axis', 'Curve (spin axis)', '°', lo, hi, 4), G('dir', 'Start line', '°', -3, 3, 3), soft(G('ftp', 'Face to path', '°', lo / 1.9, hi / 1.9, 2.5))]; },
    // over-doing it comes first: a hook that starts left isn't "still aiming left"
    blockers: o => (o === 'slice' ? [
      B('overdone', "It's hooking now", 'Too much: the face is closing past the path. Ease off the rotation a little.', 'Body turns, hands stay quiet', 'closed-body', ms => mean(ms.map(m => m.axis)) <= -6),
      B('aimed', "You're still aiming left for it", 'The ball starts left because the setup allows for the slice. Aim at the target and let the new swing straighten it.', 'Face and feet at the target', 'aim-left', ms => mean(ms.map(m => m.dir)) <= -2.5),
      B('pathLeft', 'The path is still across the ball', 'The club comes from outside the line, so even a square face curves right.', 'Arms drop first, shoulders stay closed', 'ott-shoulders', ms => mean(ms.map(m => m.path)) <= -3),
      B('faceOpen', 'The face is still open to the path', 'The path is better, but the face arrives open to it, so it still curves right.', 'Toe up after impact', 'open-rotation', ms => mean(ms.map(m => m.ftp)) >= 3),
    ] : [
      B('overdone', "It's slicing now", 'Too much: the face is staying open past the path. Let it release a little.', 'Toe up after impact', 'open-rotation', ms => mean(ms.map(m => m.axis)) >= 6),
      B('aimed', "You're still aiming right for it", 'The ball starts right because the setup allows for the hook. Aim at the target and let the new swing straighten it.', 'Face and feet at the target', 'aim-body', ms => mean(ms.map(m => m.dir)) >= 2.5),
      B('pathRight', 'The path is still out to the right', 'The arms race past a stalled body, so the club swings out and the face shuts.', 'Chest keeps turning to the target', 'stuck-hips', ms => mean(ms.map(m => m.path)) >= 3.5),
      B('faceClosed', 'The face is still shut to the path', 'The path is better, but the hands roll the face over, so it still curves left.', 'Quiet hands, body turns', 'closed-body', ms => mean(ms.map(m => m.ftp)) <= -3),
    ]),
  },
  pattern: {
    id: 'pattern', name: 'Tighten your pattern', blurb: 'One shape, one miss: the same face to path and start line shot after shot.',
    options: null, clubs: null, defaultClub: '7i',
    title: () => 'Tighten your pattern', sub: () => 'Good players miss one way. Keep the face and path the same shot to shot, so your curve and start line repeat.',
    cue: () => 'Same tempo, body leads',
    keys: () => [{ title: 'Same setup every time', lesson: 'skill-line-aim' }, { title: 'Tempo, not effort', lesson: 'skill-pattern-tempo' }, { title: 'The body leads the arms', lesson: 'skill-line-body' }],
    goals: (o, ctx) => { const f = centreOf(ctx.recent, 'ftp'), d = centreOf(ctx.recent, 'dir'); const a = centreOf(ctx.recent, 'axis'); return [G('dir', 'Start line', '°', d - 2.5, d + 2.5, 3), G('axis', 'Curve (spin axis)', '°', a - 4.5, a + 4.5, 4), soft(G('ftp', 'Face to path', '°', f - 2, f + 2, 3))]; },
    blockers: () => [
      B('twoWay', 'It misses both ways', 'Some curve left, some right: the face is turning a different amount each time.', 'Same grip pressure, body leads', 'skill-line-body', ms => ms.some(m => m.ftp > 2) && ms.some(m => m.ftp < -2)),
      B('face', 'The face changes more than the path', 'Your path repeats but the face does not: the hands are doing the squaring.', 'Quiet hands, body turns', 'closed-body', ms => sd(ms.map(m => m.face)) > sd(ms.map(m => m.path)) + 0.5),
      B('path', 'The path changes shot to shot', 'The downswing starts differently each time: sometimes the arms, sometimes the shoulders.', 'Smooth start down, arms drop first', 'ott-shoulders', ms => sd(ms.map(m => m.path)) > 2.5),
    ],
  },
  speed: {
    id: 'speed', name: 'Add speed', blurb: 'More club speed, with a strike that holds up.',
    options: null, clubs: null, defaultClub: 'DR', needsStock: true,
    title: () => 'Add speed', sub: () => 'Speed comes from a bigger turn and letting the club go, not from the arms. Aim for a few mph more with the strike still solid.',
    cue: () => 'Bigger turn, let it go',
    keys: () => [{ title: 'A bigger turn', lesson: 'skill-speed-turn' }, { title: 'Ground pressure', lesson: 'skill-speed-ground' }, { title: 'Let it go through', lesson: 'skill-high-finish' }],
    hints: () => [['Club speed', '4%+ above normal'], ['Smash', 'holds up']],
    goals: (o, ctx) => { const v = stockOf(ctx).clubSpeed, w = ctx.w; return [G('clubSpeed', 'Club speed', 'mph', v * 1.04, v * 1.3, v * 0.04), G('smash', 'Smash', '', w.smashMin - 0.03, w.smashRef + 0.05, 0.06)]; },
    blockers: () => [
      B('strike', 'The strike is slipping', 'The swing is faster, but the ball comes off the face slower: speed you can control first.', 'Ninety per cent, hit the middle', 'skill-centre-posture', (ms, ctx) => mean(ms.map(m => m.smash)) < ctx.w.smashMin - 0.03),
      B('slow', "The speed isn't up yet", 'The arms are doing the work. Turn more going back and push off the ground to unwind.', 'Bigger turn, let it go', 'skill-speed-turn', (ms, ctx) => mean(ms.map(m => m.clubSpeed)) < stockOf(ctx).clubSpeed * 1.04),
    ],
  },
};
export const SKILL_ORDER = ['shape', 'straight', 'compress', 'driverUp', 'flight', 'line', 'centre', 'wedges', 'pattern', 'speed'];
export const skillKey = (skill, option) => (option ? `${skill}.${option}` : skill);

// how close one shot is to the goals: 1 inside every window, less the further out it is
export function scoreShot(m, goals) {
  const parts = goals.filter(g => !g.club || m.hasClub).map(g => {
    const v = m[g.key], out = v < g.lo ? g.lo - v : v > g.hi ? v - g.hi : 0;
    return { key: g.key, value: v, inside: out === 0, score: out === 0 ? 1 : Math.max(0, 1 - out / g.tol) };
  });
  return { parts, score: mean(parts.map(p => p.score)), inside: parts.filter((p, i) => !goals.filter(g => !g.club || m.hasClub)[i].soft).every(p => p.inside) };
}

// the choice of club: the skill's own, else the one you're holding if it allows it
export function clubFor(skill, current) {
  const S = SKILLS[skill]; if (!S.clubs) return current || S.defaultClub;
  return S.clubs.includes(current) ? current : S.defaultClub;
}

/* ---------------- a lesson session ---------------- */
export function createSkillCoach({ skill, option = null, club, stockMs = [], windowsFor = physicsWindows } = {}) {
  const S = SKILLS[skill]; if (!S) throw new Error(`no skill ${skill}`);
  const opt = option || (S.options ? S.options[0].id : null);
  // skills measured against your own normal shots start with four of them, unless the session has them
  const own = stockMs.filter(m => m.club === club).slice(-8);
  const st = { phase: S.needsStock && own.length < 4 ? 'baseline' : 'learn', base: own.length >= 4 ? own : [], ms: [], scores: [], all: [], test: null, passed: false, sinceRead: 0, best: 0 };
  const speedFrom = () => (st.ms.length ? st.ms : st.base.length ? st.base : [{ clubSpeed: 0 }]);
  const wOf = () => windowsFor(club, median(speedFrom().map(m => m.clubSpeed)));
  const ctx = () => ({ w: wOf(), stockMs: st.base, recent: [...st.base, ...st.ms] });
  const goals = () => S.goals(opt, ctx());

  function addShot(shot, clubId) {
    if (clubId !== club) return [{ type: 'wrongClub', want: club }];
    const m = skillMetrics(shot, clubId), ev = [];
    if (st.phase === 'baseline') {
      st.base.push(m);
      ev.push({ type: 'tick', phase: 'baseline', count: st.base.length, inside: false, score: 0, parts: [] });
      if (st.base.length >= SKILL_WINDOW) { st.phase = 'learn'; ev.push({ type: 'baseline', stock: stockOf(ctx()), goals: goals() }); }
      return ev;
    }
    const sc = scoreShot(m, goals());
    st.ms.push(m); st.scores.push(sc); st.all.push({ m, ...sc }); st.sinceRead++;
    const w = ctx().w;
    // urgent: a shank, or three of the last four heavy
    if (RULES.shank.test(m, w)) ev.push({ type: 'urgent', id: 'shank' });
    else if (st.ms.length >= 4 && st.ms.slice(-4).filter(x => RULES.fat.test(x, w)).length >= 3 && !st.fatSaid) { st.fatSaid = true; ev.push({ type: 'urgent', id: 'fat' }); }
    ev.push({ type: 'tick', inside: sc.inside, score: sc.score, parts: sc.parts, phase: st.phase, count: st.phase === 'test' ? st.test.n + 1 : st.sinceRead });
    if (st.phase === 'test') {
      const T = st.test; T.n++; if (sc.inside) T.in++;
      if (T.in >= TEST_NEED) { st.phase = 'open'; st.passed = true; st.sinceRead = 0; ev.push({ type: 'passed', in: T.in, of: T.n }); }
      else if (T.n - T.in > TEST_SHOTS - TEST_NEED) { st.phase = 'learn'; st.sinceRead = 0; ev.push({ type: 'retest', in: T.in, of: T.n, read: readNow() }); }
      return ev;
    }
    if (st.sinceRead < SKILL_WINDOW) return ev;
    st.sinceRead = 0;
    const last = st.scores.slice(-SKILL_WINDOW), inN = last.filter(s => s.inside).length;
    st.best = Math.max(st.best, meter());
    if (st.phase === 'learn' && inN >= LEARN_NEED) { st.phase = 'test'; st.test = { n: 0, in: 0 }; ev.push({ type: 'learned', in: inN }); return ev; }
    ev.push({ type: 'read', in: inN, ...readNow() });
    return ev;
  }
  // what's in the way over the last four (null: nothing in the way, keep going)
  function readNow() {
    const win = st.ms.slice(-SKILL_WINDOW), c = ctx();
    const b = S.blockers(opt).find(x => x.test(win, c)) || null;
    return { blocker: b, meter: meter(), goals: goals(), means: Object.fromEntries(goals().map(g => [g.key, mean(win.map(m => m[g.key]))])) };
  }
  // the meter: how close the last four are to the goal, 0 to 1
  function meter() { const s = st.scores.slice(-SKILL_WINDOW); return s.length ? mean(s.map(x => x.score)) : 0; }

  return {
    addShot, readNow, meter,
    goals, get skill() { return S; }, get option() { return opt; }, get club() { return club; },
    get phase() { return st.phase; }, get test() { return st.test; }, get passed() { return st.passed; }, get baseCount() { return st.base.length; },
    get series() { return st.all.map(a => a.score); }, get shots() { return st.all; }, get best() { return st.best; },
    title: () => S.title(opt), sub: () => S.sub(opt), cue: () => S.cue(opt), keys: () => S.keys(opt),
    stock: () => stockOf(ctx()),
  };
}
