// Mannequin lessons (data only, no Three.js): one per cause in conditions.js. Each is a "you"
// swing written as changes to the base swing in mannequin.js, plus the camera, the moment to
// pause on, the body part to light up and one sentence of caption. The goal is the base swing.
//
//   you.over:   scalar keys at the ten P positions (pelvis, chest, shift, drop, side, bend,
//               heel, knee, lookUp, stance, thrust)
//   you.impact: [shaft lean toward the target °, face open °] at the ball
//   you.keys:   { P index: { H: hands [x,y,z], d: grip→head direction, f: face direction } }
//   you.yaw:    the whole swing turned (° , − = aimed right)
//   readout:    the number to show at impact: loft | path | attack | face (null: none, the picture says it)
//   inset:      a 2D picture instead of the mannequin (grip lessons)

// moments to loop and pause on
export const MODES = {
  impact: { type: 'loop', a: 0.5, b: 0.82, speed: 0.16, holdAt: 0.7, hold: 1.4 },
  down: { type: 'loop', a: 0.45, b: 0.8, speed: 0.16, holdAt: 0.6, hold: 1.4 },
  through: { type: 'loop', a: 0.6, b: 0.86, speed: 0.14, holdAt: 0.765, hold: 1.4 },
  top: { type: 'loop', a: 0.3, b: 0.62, speed: 0.14, holdAt: 0.47, hold: 1.6 },
  takeaway: { type: 'loop', a: 0, b: 0.8, speed: 0.22, holdAt: 0.15, hold: 1.4, rest: 0.8 },
  setup: { type: 'loop', a: 0, b: 0.82, speed: 0.3, holdAt: 0.7, hold: 1.2, rest: 1.6 },
  full: { type: 'full', speed: 0.27, holdAt: 0.7, hold: 1.4 },
};

const FLIP_WEIGHT = {
  over: { pelvis: [0, 12, 28, 45, 22, 5, -16, -35, -60, -85], chest: [0, 32, 68, 92, 66, 42, 5, -40, -75, -105], shift: [0, -0.015, -0.025, -0.03, 0, 0, -0.01, 0.02, 0.07, 0.1], side: [6, 5, 3, 0, 10, 15, 21, 18, 12, 9], heel: [0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.6, 0.9] },
  impact: [-2, 3], keys: { 5: { H: [-0.19, 0.95, 0.3], d: [-0.82, -0.4, 0.35] }, 7: { H: [0.2, 0.86, 0.33], d: [0.72, 0.62, 0.22] } },
};
const OTT_DOWN = { 4: { H: [-0.24, 1.15, 0.34], d: [-0.45, 0.82, 0.2] }, 5: { H: [-0.12, 0.98, 0.36], d: [-0.85, 0.28, 0.42] }, 7: { H: [0.3, 0.93, 0.17], d: [0.9, 0.15, -0.4] } };
const OTT_CHEST = [0, 32, 68, 92, 42, 15, -25, -60, -86, -110];
const STALL = { pelvis: [0, 12, 28, 45, 25, 10, -8, -30, -60, -85], chest: [0, 32, 68, 92, 70, 48, 5, -35, -75, -105] };

export const LESSONS = {
  'flip-weight': { title: 'Weight hangs back', caption: 'The weight stays on the back foot, so the hands stall and the clubhead passes them.', cam: 'panel', mode: 'impact', highlight: 'hips', readout: 'loft', you: FLIP_WEIGHT, goal: { impact: [10, 0] } },
  'flip-cast': {
    title: 'Casting from the top', caption: 'The wrists unhinge early, so the clubhead overtakes the hands before the ball.', cam: 'panel', mode: 'impact', highlight: 'wrists', readout: 'loft',
    you: { impact: [-2, 2], keys: { 4: { H: [-0.3, 1.1, 0.26], d: [-0.8, 0.5, 0.1] }, 5: { H: [-0.17, 0.93, 0.3], d: [-0.8, -0.45, 0.3] }, 7: { H: [0.22, 0.87, 0.3], d: [0.72, 0.6, 0.2] } } },
    goal: { impact: [10, 0] },
  },
  'ballpos-fwd': { title: 'Ball too far forward', caption: 'With the ball forward the club bottoms out early and arrives adding loft.', cam: 'panel', mode: 'setup', highlight: 'feet', readout: 'loft', you: { over: { stance: [-0.09, -0.09, -0.09, -0.09, -0.09, -0.09, -0.09, -0.09, -0.09, -0.09] }, impact: [-1, 2] }, goal: { impact: [9, 0] } },
  'ballpos-back': {
    title: 'Ball too far back', caption: 'With the ball back the club arrives steep and still swinging out to the right.', cam: 'panel', mode: 'setup', highlight: 'feet', readout: 'path',
    you: { over: { stance: [0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09] }, impact: [14, -2], keys: { 5: { H: [-0.12, 0.93, 0.24], d: [-0.95, 0.1, -0.25] }, 7: { H: [0.3, 0.9, 0.24], d: [0.94, 0.1, 0.22] } } },
    goal: { impact: [8, 0] },
  },
  'setup-weight': { title: 'Weight set on the trail side', caption: 'Starting on the back foot, the weight never gets forward to the lead side.', cam: 'panel', mode: 'setup', highlight: 'hips', readout: 'attack', you: { over: { shift: [-0.04, -0.05, -0.05, -0.05, 0, 0.03, 0.04, 0.07, 0.1, 0.12], side: [10, 8, 5, 2, 10, 13, 17, 14, 12, 9] }, impact: [4, 0] }, goal: {} },
  'aim-left': { title: 'Lined up left for the slice', caption: 'The body aims left to allow for the slice, which swings the path further left still.', cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path', you: { yaw: 6 }, goal: {} },
  'aim-body': { title: 'Lined up off target', caption: 'The swing is fine. The body is aimed right, so the whole swing goes right.', cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path', you: { yaw: -6 }, goal: {} },
  'ott-shoulders': { title: 'Shoulders start the downswing', caption: 'The shoulders spin open first and throw the club outside the plane, then across the ball.', cam: 'dtlPanel', mode: 'down', highlight: 'shoulders', readout: 'path', plane: true, you: { over: { chest: OTT_CHEST }, impact: [6, 3], keys: OTT_DOWN }, goal: { impact: [6, 0] } },
  'ott-inside': {
    title: 'Takeaway too far inside', caption: 'The club whips behind you early, then loops over the top to get back.', cam: 'dtlPanel', mode: 'takeaway', highlight: 'hands', readout: 'path', plane: true,
    you: { over: { chest: OTT_CHEST }, impact: [6, 3], keys: { 1: { H: [-0.3, 0.86, 0.2], d: [-0.85, 0.05, -0.5] }, 2: { H: [-0.45, 1.08, 0.05], d: [-0.45, 0.75, -0.5] }, ...OTT_DOWN } },
    goal: { impact: [6, 0] },
  },
  'ott-weight': { title: 'Weight stays back', caption: 'The weight never moves forward, so the shoulders open to get the club down.', cam: 'panel', mode: 'down', highlight: 'hips', readout: 'path', you: { over: { chest: OTT_CHEST, shift: [0, -0.015, -0.025, -0.03, -0.03, -0.02, -0.01, 0.02, 0.06, 0.1] }, impact: [4, 3], keys: OTT_DOWN }, goal: { impact: [6, 0] } },
  'stuck-hips': { title: 'Hips stall', caption: 'The hips stop turning, the arms swing past the body and the club goes out to the right.', cam: 'dtlPanel', mode: 'down', highlight: 'hips', readout: 'path', plane: true, you: { over: STALL, impact: [10, -2], keys: { 4: { H: [-0.34, 1.05, 0.2], d: [-0.6, 0.6, -0.5] }, 5: { H: [-0.2, 0.88, 0.24], d: [-0.95, -0.05, -0.3] }, 7: { H: [0.28, 0.9, 0.28], d: [0.92, 0.15, 0.28] } } }, goal: {} },
  'stuck-shoulder': { title: 'Trail shoulder drops', caption: 'The trail shoulder dips and the club drops under the plane, swinging out to the right.', cam: 'dtlPanel', mode: 'down', highlight: 'shoulders', readout: 'path', plane: true, you: { over: { side: [6, 5, 3, 0, 14, 20, 24, 18, 13, 9], bend: [40, 40, 38, 36, 40, 42, 41, 34, 22, 6] }, impact: [8, 0], keys: { 5: { H: [-0.18, 0.86, 0.26], d: [-0.95, -0.1, -0.25] }, 7: { H: [0.28, 0.9, 0.26], d: [0.93, 0.15, 0.22] } } }, goal: {} },
  'open-rotation': { title: "Forearms don't rotate", caption: 'The face never turns over: at halfway through, the toe should point up.', cam: 'through', mode: 'through', highlight: 'arms', readout: 'face', you: { impact: [8, 6], keys: { 7: { f: [0.75, 0.2, 0.6] } } }, goal: {} },
  'open-grip': { title: 'Weak grip', caption: 'Turn the lead hand until two or three knuckles show.', inset: 'weak', cam: 'close', mode: 'impact', readout: 'face', you: { impact: [8, 5] }, goal: {} },
  'open-wrist': { title: 'Cupped wrist at the top', caption: 'A cupped lead wrist opens the face at the top, and it stays open to the ball.', cam: 'dtlPanel', mode: 'top', highlight: 'wrists', readout: 'face', you: { impact: [8, 5], keys: { 3: { f: [0.05, 0.15, 1] } } }, goal: {} },
  'closed-body': { title: 'Body stalls, hands flip', caption: 'The body stops and the hands roll the face over through the ball.', cam: 'panel', mode: 'impact', highlight: 'hips', readout: 'face', you: { over: STALL, impact: [6, -6], keys: { 7: { H: [0.25, 0.88, 0.3], d: [0.9, 0.25, 0.2], f: [-0.5, 0.2, -0.85] } } }, goal: {} },
  'closed-grip': { title: 'Strong grip', caption: 'Turn the hands back until two or three knuckles show.', inset: 'strong', cam: 'close', mode: 'impact', readout: 'face', you: { impact: [8, -5] }, goal: {} },
  'steep-dive': { title: 'Diving at the ball', caption: 'The head and chest drop toward the ball, so the club chops down steeply.', cam: 'dtlPanel', mode: 'impact', highlight: 'head', readout: 'attack', you: { over: { drop: [0, 0, 0.005, 0.01, 0.05, 0.07, 0.08, 0.05, 0.02, -0.04], bend: [40, 40, 38, 36, 41, 44, 45, 38, 24, 6] }, impact: [12, 0], keys: { 5: { H: [-0.13, 0.95, 0.36], d: [-0.8, 0.45, 0.4] } } }, goal: {} },
  'thin-extension': { title: 'Early extension', caption: 'The hips push toward the ball and the body stands up, lifting the club.', cam: 'dtlPanel', mode: 'impact', highlight: 'hips', readout: null, you: { over: { thrust: [0, 0, 0, 0, 0.03, 0.06, 0.09, 0.1, 0.08, 0.05], bend: [40, 40, 38, 36, 35, 32, 29, 24, 18, 6], drop: [0, 0, 0.005, 0.01, 0.01, 0, -0.02, -0.02, -0.02, -0.04] }, impact: [6, 0], keys: { 5: { H: [-0.15, 1.02, 0.3] }, 7: { H: [0.28, 0.97, 0.3] } } }, goal: {} },
  'thin-standup': { title: 'Standing up', caption: 'The chest rises early and the arms pull in, so the club meets the ball high.', cam: 'dtlPanel', mode: 'impact', highlight: 'shoulders', readout: 'attack', you: { over: { bend: [40, 40, 38, 36, 36, 32, 27, 22, 16, 6], drop: [0, 0, 0.005, 0.01, 0, -0.02, -0.04, -0.04, -0.04, -0.04] }, impact: [6, -1], keys: { 5: { H: [-0.15, 1.04, 0.24] }, 7: { H: [0.28, 0.97, 0.12] } } }, goal: {} },
};

// ---------------- Learn a skill (skills.js) ----------------
// Each skill key is a lesson: "you" is a typical swing (your normal one, or the usual miss), the
// goal is the skill's swing. The numbers on screen are read off the mannequin.
const ten = v => Array(10).fill(v);
const DRAW = { yaw: -3, impact: [8, -2] };
const FADE = { yaw: 2, impact: [8, 2], keys: { 5: { H: [-0.14, 0.96, 0.32], d: [-0.94, 0.16, 0.19] }, 7: { H: [0.3, 0.92, 0.19], d: [0.95, 0.125, -0.145] } } };
const COMPRESS = { impact: [14, 0], over: { shift: [0, -0.015, -0.025, -0.03, 0.05, 0.085, 0.1, 0.12, 0.13, 0.14] } };
const DRIVER = { impact: [-6, 0], over: { stance: ten(-0.24), side: [12, 11, 9, 6, 15, 20, 24, 19, 14, 9] }, keys: { 5: { H: [-0.175, 0.925, 0.3], d: [-0.965, -0.05, 0.025] } } };
const SHORT_FINISH = { 8: { H: [0.5, 1.0, 0.25], d: [0.85, 0.5, -0.15] } };
const LOW = { impact: [15, 0], over: { stance: ten(0.08) }, keys: SHORT_FINISH };
const HIGH = { impact: [3, 0], over: { stance: ten(-0.06), side: [8, 7, 5, 2, 10, 13, 17, 15, 13, 10] } };
const NINE = { over: { pelvis: [0, 12, 28, 30, 18, -10, -38, -58, -80, -100], chest: [0, 32, 68, 72, 60, 36, -15, -52, -90, -124] }, keys: { 3: { H: [-0.42, 1.14, 0.17], d: [-0.2, 0.88, -0.42], f: [0.35, 0.3, 0.88] }, ...SHORT_FINISH } };
const TEN30 = { over: { pelvis: [0, 12, 28, 37, 18, -10, -38, -58, -80, -100], chest: [0, 32, 68, 82, 62, 36, -15, -52, -90, -124] }, keys: { 3: { H: [-0.38, 1.27, 0.15], d: [0.38, 0.39, -0.31], f: [0.28, 0.45, 0.82] } } };
const SPEED_TURN = { over: { pelvis: [0, 13, 30, 52, 20, -12, -42, -62, -84, -104], chest: [0, 34, 74, 106, 70, 38, -18, -56, -94, -128] } };
const SPEED_GROUND = { over: { knee: [0, 0, 0, 0.05, 0.25, 0.35, 0.3, 0.45, 0.55, 0.6], drop: [0, 0, 0.005, 0.02, 0.05, 0.04, 0, -0.01, -0.01, -0.04] } };
const sk = (title, caption, you, goal, o) => ({ title, caption, you, goal, cam: 'panel', mode: 'impact', ...o });

Object.assign(LESSONS, {
  'skill-draw-setup': sk('Set up a touch right', 'Feet and body a few degrees right of the target, the face at the target.', {}, DRAW, { cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path' }),
  'skill-draw-path': sk('Swing out to the right', 'The club comes from inside and swings out toward right field through the ball.', {}, DRAW, { cam: 'dtlPanel', mode: 'down', highlight: 'hands', readout: 'path', plane: true }),
  'skill-draw-face': sk('Face closed to the path', 'At impact the face points left of the path but right of the target: it starts right and curves back.', {}, DRAW, { cam: 'close', mode: 'impact', readout: 'face' }),
  'skill-fade-setup': sk('Set up a touch left', 'Feet and body a few degrees left of the target, the face at the target.', {}, FADE, { cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path' }),
  'skill-fade-path': sk('Swing across to the left', 'The club swings left through the ball, along the line of your feet.', {}, FADE, { cam: 'dtlPanel', mode: 'down', highlight: 'hands', readout: 'path', plane: true }),
  'skill-fade-face': sk('Face open to the path', 'At impact the face points right of the path but left of the target: it starts left and curves back.', {}, FADE, { cam: 'close', mode: 'impact', readout: 'face' }),
  'skill-compress-pressure': sk('Pressure forward', 'Before the arms come down, the pressure moves into the lead foot.', {}, COMPRESS, { mode: 'down', highlight: 'hips', readout: 'attack' }),
  'skill-compress-hands': sk('Hands ahead at impact', 'The hands lead the clubhead into the ball, taking loft off and squeezing the ball.', {}, COMPRESS, { mode: 'impact', highlight: 'hands', readout: 'loft' }),
  'skill-compress-low': sk('Low point past the ball', 'The club is still going down when it meets the ball and bottoms out in front of it: ball, then turf.', FLIP_WEIGHT, COMPRESS, { cam: 'dtlPanel', mode: 'impact', highlight: 'hips', readout: 'attack' }),
  'skill-driver-setup': sk('Ball forward, tee it high', 'The ball sits off the lead heel, teed so half of it is above the face.', {}, DRIVER, { mode: 'setup', highlight: 'feet', readout: 'attack' }),
  'skill-driver-tilt': sk('Tilt away from the target', 'The spine leans away a little at address and keeps that tilt through the ball.', {}, DRIVER, { mode: 'impact', highlight: 'shoulders', readout: 'attack' }),
  'skill-driver-up': sk('Up through the ball', 'The club passes its low point before the ball and meets it on the way up.', {}, DRIVER, { cam: 'panel', mode: 'impact', highlight: 'hands', readout: 'attack' }),
  'skill-low-setup': sk('Ball back, hands ahead', 'The ball moves back an inch or two, the hands stay ahead of it: less loft at impact.', {}, LOW, { mode: 'setup', highlight: 'feet', readout: 'loft' }),
  'skill-low-impact': sk('Hold the angle through it', 'The hands stay ahead through impact, so the face keeps its lower loft.', {}, LOW, { mode: 'impact', highlight: 'wrists', readout: 'loft' }),
  'skill-low-finish': sk('Short, low finish', 'The arms stop around chest height: a shorter, quieter finish adds less spin.', {}, LOW, { mode: 'through', highlight: 'arms', readout: null }),
  'skill-high-setup': sk('Ball forward', 'The ball moves forward an inch, so the club arrives with more loft.', {}, HIGH, { mode: 'setup', highlight: 'feet', readout: 'loft' }),
  'skill-high-impact': sk('Let the club release', 'Less forward shaft lean: the clubhead catches up to the hands and adds loft.', {}, HIGH, { mode: 'impact', highlight: 'wrists', readout: 'loft' }),
  'skill-high-finish': sk('Full, high finish', 'Keep the speed through the ball all the way to a high, balanced finish.', {}, HIGH, { mode: 'full', highlight: 'arms', readout: null }),
  'skill-line-aim': sk('Aim the face first', 'Set the face at the target, then set your feet and body square to it.', LESSONS['aim-body'].you, {}, { cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path' }),
  'skill-straight-aim': sk('Aim at the target', 'Square the feet and body to the target: no more aiming left to allow for the slice.', LESSONS['aim-left'].you, {}, { cam: 'top', mode: 'setup', highlight: 'feet', readout: 'path' }),
  'skill-line-top': sk('Square at the top', 'A flat lead wrist at the top keeps the face square, so it needs no fixing on the way down.', LESSONS['open-wrist'].you, {}, { cam: 'dtlPanel', mode: 'top', highlight: 'wrists', readout: 'face' }),
  'skill-line-body': sk('The body squares it', 'Keep turning through the ball: the body brings the face back square, not the hands.', LESSONS['closed-body'].you, {}, { mode: 'impact', highlight: 'hips', readout: 'face' }),
  'skill-centre-posture': sk('Keep your posture', 'The hips stay back and the chest stays over the ball until it has gone.', LESSONS['thin-extension'].you, {}, { cam: 'dtlPanel', mode: 'impact', highlight: 'hips', readout: null }),
  'skill-centre-finish': sk('Balanced finish', 'Finish tall on the lead foot. If you can hold it, the strike was centred.', FLIP_WEIGHT, {}, { mode: 'full', highlight: 'feet', readout: null }),
  'skill-pattern-tempo': sk('Tempo, not effort', 'Start down smoothly with the arms dropping, the same way every time.', LESSONS['ott-shoulders'].you, {}, { cam: 'dtlPanel', mode: 'down', highlight: 'shoulders', readout: 'path', plane: true }),
  'skill-wedge-nine': sk("Back to 9 o'clock", 'The lead arm stops level with the ground. Same turn, same pace through.', {}, NINE, { mode: 'top', highlight: 'arms', readout: null }),
  'skill-wedge-ten30': sk('Back to 10:30', 'The lead arm stops halfway between level and the top. Same pace through.', {}, TEN30, { mode: 'top', highlight: 'arms', readout: null }),
  'skill-wedge-full': sk('A full turn', 'The same full turn every time, at the same pace.', {}, {}, { mode: 'full', highlight: 'shoulders', readout: null, show: { goalSolid: 1 } }),
  'skill-wedge-through': sk('Same tempo through', 'The club speeds up through the ball whatever the length. Never slow down into it.', {}, NINE, { mode: 'full', highlight: 'arms', readout: null }),
  'skill-speed-turn': sk('A bigger turn', 'Turn the shoulders further going back, the lead arm still long.', {}, SPEED_TURN, { mode: 'top', highlight: 'shoulders', readout: null }),
  'skill-speed-ground': sk('Ground pressure', 'Sit into the ground as you start down, then push up through it as you unwind.', {}, SPEED_GROUND, { mode: 'down', highlight: 'feet', readout: null }),
});

// drills the mannequin can demonstrate
export const DRILL_DEMOS = { 'Impact hold': 'impactHold', 'Pump drill': 'pump' };

// what a readout number is called and how it's written
export const READOUTS = {
  loft: { label: 'Loft', fmt: v => `${Math.round(v)}°` },
  path: { label: 'Path', fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}°` },
  attack: { label: 'Attack', fmt: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}°` },
  face: { label: 'Face', fmt: v => (Math.abs(v) < 0.5 ? '0°' : `${Math.round(Math.abs(v))}° ${v > 0 ? 'open' : 'shut'}`) },
};

export const lessonFor = id => (id && LESSONS[id]) || null;
