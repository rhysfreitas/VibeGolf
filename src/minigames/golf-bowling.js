// Golf Bowling — ten frames down the runner rug of a giant toy room. Fly the ball into the
// pocket: its speed and the angle it comes in at decide how the pins go. Rules + pin action: bowling-logic.js. Scene: scenes/toy-room.js.
// HUD, turns and feedback: the shared kit (manual turns, so each player bowls a whole frame).

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createToyRoom } from './scenes/toy-room.js';
import { createShotView } from '../world/shot-view.js';
import * as BL from './bowling-logic.js';
const { YD, CLUBS, DIFFICULTIES, CHALLENGES, ALL_PINS, SHAPES, FRAMES } = BL;

const stage = document.getElementById('stage');
const world = createToyRoom(stage);
const { renderer, scene, camera, groundAt, surfaceAt } = world;
const sv = createShotView(world, { tracerColor: '#ffe39a', stance: { back: 6, up: 2.6, ballAt: 0.93, fov: 36 } });

const kit = createKit({
  id: 'golf-bowling', title: 'Golf Bowling', accent: '#ee5a3c', mode: 'manual', idealShot: true, clubs: CLUBS,
  multiplier: false,
  badge: p => { const r = p.strikeRun || 0; return { text: r > 3 ? `X×${r}` : 'X'.repeat(Math.max(1, r)), level: r ? Math.min(4, r + 1) : 1 }; },
  blurb: 'Ten frames of bowling down the hallway rug of a giant toy room. Fly the ball into the pins: the harder it comes in, the bigger the crash.',
  rules: [
    '<b>Fly it into the pocket</b>, just off the head pin, below the tops of the pins. Speed makes the pins explode: a low, hot punch hits hardest. A ball that lands short rolls in weakly.',
    '<b>Shape counts</b>, like a hook in bowling: a draw curving into the 1-3 pocket (or a fade into the 1-2) carries more pins than a straight ball, which tends to get knocked off line and leave one standing. Straight on the nose usually leaves a split.',
    'Real bowling scoring: a <b>strike</b> scores 10 plus your next two balls, a <b>spare</b> 10 plus your next one. Ten frames, and a bonus ball or two in the 10th.',
    'No R10? The simulated-shot button (bottom left) picks a club, Punch or Stinger, and a shape you drag left or right. A longer club is hit as a low punch.',
    'Difficulty sets the lane length (85, 110, 130 or 150 yd). Beginner gets bumpers and a guide line; Tour has heavier pins.',
  ],
  difficulties: DIFFICULTIES, challenges: CHALLENGES,
  summary: p => `${p.stats.strikes || 0} strike${p.stats.strikes === 1 ? '' : 's'} · ${p.stats.spares || 0} spare${p.stats.spares === 1 ? '' : 's'}`,
});
const G = { frame: 0 };
let shown = [];          // the pins on the deck right now
let shot = null;

/* ===================== the score sheet (top centre) ===================== */
const sheet = document.createElement('div'); sheet.className = 'bw-sheet'; document.body.appendChild(sheet);
function renderSheet() {
  const p = kit.player; if (!p) { sheet.hidden = true; return; }
  sheet.hidden = false;
  const sc = BL.score(p.frames);
  sheet.innerHTML = `<div class="bw-hd"><span class="nm">${esc(p.name)}</span><span class="ln">${p.difficulty.lane} YD LANE</span></div><div class="bw-fr">` +
    [...Array(FRAMES)].map((_, i) => {
      const fr = p.frames[i] || [], mk = BL.marks(fr, i), boxes = i === FRAMES - 1 ? 3 : 2;
      return `<div class="f ${i === G.frame ? 'cur' : ''} ${i === FRAMES - 1 ? 'ten' : ''}"><span class="n">${i + 1}</span><span class="bx">${[...Array(boxes)].map((_, k) => `<i class="${mk[k] === 'X' ? 'x' : mk[k] === '/' ? 'sp' : ''} ${k === 0 && p.splits[i] ? 'split' : ''}">${mk[k] || ''}</i>`).join('')}</span><b>${sc.cum[i] ?? ''}</b></div>`;
    }).join('') + `</div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// the classic pin diagram: 7-8-9-10 at the back, the head pin at the front
const pinDiag = up => `<span class="bw-pins">${[[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]].map(r => `<span>${r.map(n => `<i class="${up.includes(n) ? 'on' : ''}"></i>`).join('')}</span>`).join('')}</span>`;
const pinNames = s => s.slice().sort((a, b) => a - b).join('–');

/* ===================== aiming ===================== */
// The suggested shot is a draw flown into the pocket at about chest height on the pins. Simulated
// and ideal shots use the simulated-shot tool's club, trajectory and shape, so you can try a low
// punch against a wedge, or a draw against a straight ball, without the R10.
const flightOf = b => simulate(b, { groundAt: () => 0, flightOnly: true }).pts;
const SUGG_AXIS = SHAPES[0].axis; // a draw: curves into the 1-3 pocket like a right-hander's hook
const bases = new Map(), lines = new Map();
function baseFor(d, club, axis, traj) { // swing effort for this lane, club, shape and trajectory
  const key = `${d.id}|${club}|${axis}|${traj}`;
  if (!bases.has(key)) bases.set(key, BL.solveInto(flightOf, CLUBS, { L: d.lane * YD, x: axis > 0 ? -1.5 : 1.5, axis, traj, club }));
  return bases.get(key);
}
function aimFor(up, d, s = null) {
  const axis = s ? s.axis : SUGG_AXIS, traj = s ? s.traj : 'normal';
  const sugg = baseFor(d, null, SUGG_AXIS, 'normal').club, club = s && !s.clubAuto ? s.club : sugg, b = baseFor(d, club, axis, traj), c = b.cross;
  const lk = `${d.id}|${club}|${axis}|${traj}|${BL.pinList(up)}`;
  if (!lines.has(lk)) lines.set(lk, BL.bestLine(up, { L: d.lane * YD, pinMass: d.pinMass, slope: c.slope, speed: c.speed, h: Math.max(0.5, c.y), descent: c.descent }));
  const x = lines.get(lk), sol = BL.solveInto(flightOf, CLUBS, { L: d.lane * YD, x, axis, traj, club, k: b.k });
  return { ...sol, x, sugg };
}

let sol = null;
function refresh() {
  const p = kit.player, d = p.difficulty, f = G.frame;
  const fr = p.frames[f] || (p.frames[f] = []);
  if (BL.freshRack(fr, f)) p.up = ALL_PINS.slice();
  if (Math.abs(world.L - d.lane * YD) > 0.01) { world.setLane(d); shown = []; }
  if (BL.pinList(shown) !== BL.pinList(p.up)) { world.setPins(p.up, { drop: true }); shown = p.up.slice(); rackSound(); }
  sol = aimFor(p.up, d); kit.suggest({ club: sol.sugg, axis: SUGG_AXIS });
  world.setGuide(d.guide ? sol.x : null, sol.cross.slope); kit.refreshAim();
  kit.setShotLabel(`Frame ${f + 1} · Ball ${fr.length + 1}`);
  const full = p.up.length === 10, how = sol.club < sol.sugg || sol.k < 0.8 ? ' punch' : sol.k < 0.97 ? ' ¾' : ''; // below full, the sim hits it lower and flatter
  kit.setPrompt(`<span class="kick">Frame ${f + 1} · Ball ${fr.length + 1}</span>
    <span class="bw-row"><span class="big">${full ? `${d.lane} <small>yd</small>` : `${p.up.length} <small>pin${p.up.length === 1 ? '' : 's'} left</small>`}</span>${pinDiag(p.up)}</span>
    <span class="sub">${full ? 'Fly it into the pocket' : p.splits[f] ? 'A split: clip one into the other' : 'Pick up the spare'} · <b>${CLUBS[sol.club].id}</b>${how} draw</span>`);
  renderSheet();
}

/* ===================== shots ===================== */
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// simulated shots: the kit aims them (auto-aim flies into the pocket, otherwise down your aim line)
kit.aimLine({ world, view: sv, sim: b => simulate(b, { groundAt, surfaceAt, flightOnly: true }), ideal: s => (kit.player && kit.player.up ? aimFor(kit.player.up, kit.player.difficulty, s).ball : null) });
kit.on('hit', s => launch(s.ball, 'Sim'));
kit.on('ideal', s => launch(s.ball, 'Ideal'));
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, 'R10'); });

function launch(ball, src) {
  kit.phase = 'flight';
  const p = kit.player, d = p.difficulty, L = d.lane * YD;
  const r0 = simulate(ball, { groundAt, surfaceAt, flightOnly: true });
  const res = BL.bowl(r0.pts, p.up, { L, pinMass: d.pinMass, bumpers: d.bumpers, seed: (Math.random() * 1e9) | 0 });
  // off the rug the ball rolls on the floorboards, a rug's thickness lower
  const pts = res.ballPts.map(q => ({ t: q.t, phase: q.phase, p: [q.p[0], q.p[1] + (q.phase === 'flight' ? 0 : groundAt(q.p[0], q.p[2])), q.p[2]] }));
  let apexI = 0; pts.forEach((q, i) => { if (q.phase === 'flight' && q.p[1] > pts[apexI].p[1]) apexI = i; });
  const landI = pts.findIndex(q => q.phase !== 'flight');
  const landT = landI < 0 ? pts[pts.length - 1].t : pts[landI].t, apexT = pts[apexI].t;
  const clacks = Object.values(res.tracks).map(tr => tr[0][0]).sort((a, b) => a - b);
  shot = { res, src, before: p.up.slice(), done: false, apexT, landT, dDur: Math.max(1.1, landT - apexT + 0.6), clacks, ci: 0, rolled: false, carryYd: res.landing ? Math.hypot(res.landing.x, res.landing.z) / YD : null };
  world.playPins(res.tracks);
  const fl = sv.fly({ pts });
  fl.onLand = () => { kit.sfx.noise(0.12, 380, 0.35); const rollLen = (res.contactT ?? res.endT) - landT; if (rollLen > 0.3) kit.sfx.noise(Math.min(3, rollLen), 150, 0.22, 0.08); };
  fl.onDone = () => setTimeout(resolve, 450);
  kit.sfx.tone(180, { len: 0.06, vol: 0.2, type: 'triangle' }); kit.sfx.noise(0.06, 3500, 0.4);
  dollyOut = false;
}

function resolve() {
  if (!shot || shot.done) return; shot.done = true;
  const p = kit.player, d = p.difficulty, f = G.frame, fr = p.frames[f], res = shot.res;
  const n = res.down.length, fresh = shot.before.length === 10;
  fr.push(n); p.up = res.standing.slice();
  const sc = BL.score(p.frames), delta = sc.total - p.score;
  const strike = fresh && n === 10, spare = !fresh && !res.standing.length, split = fresh && !strike && BL.isSplit(res.standing);
  if (fresh) { p.splitOpen = split; if (split) p.splits[f] = true; }
  if (delta > 0) kit.award(delta);
  if (strike) {
    p.strikeRun = (p.strikeRun || 0) + 1; kit.stat('strikes'); kit.statMax('strikeRun', p.strikeRun);
    const boom = res.contact && res.contact.speed * 2.237 >= 45;
    kit.splash(BL.strikeWord(p.strikeRun), { gold: true, big: true, sub: boom ? 'Pins exploded!' : delta ? `+${delta}` : '' }); kit.sfx.perfect(); setTimeout(() => kit.sfx.fanfare(), 250);
  } else {
    if (fresh) p.strikeRun = 0;
    if (spare) { kit.stat('spares'); if (p.splitOpen) kit.stat('splitPicks'); kit.splash(p.splitOpen ? 'SPLIT CONVERTED' : 'SPARE', { gold: p.splitOpen, big: p.splitOpen, sub: `+${delta}` }); kit.sfx.chime(2); setTimeout(() => kit.sfx.chime(4), 120); }
    else if (split) { const nm = BL.splitName(res.standing); kit.splash(nm ? nm.toUpperCase() : 'SPLIT', { sub: pinNames(res.standing) + ' split' }); kit.sfx.close(); }
    else if (!n) { kit.toast(res.reason === 'short' ? 'Stopped short of the pins' : 'Missed the pins', 1600); kit.sfx.miss(); }
    else if (n >= 7 && fresh) kit.sfx.chime(1);
  }
  const done = BL.frameDone(fr, f);
  if (done) {
    const mark = fr[0] === 10 || fr[0] + (fr[1] || 0) >= 10;
    p.markRun = mark ? (p.markRun || 0) + 1 : 0; kit.statMax('markRun', p.markRun);
    if (!mark && f < FRAMES - 1 && fr[0] + fr[1] === 9) setTimeout(() => kit.soClose('1 pin left'), strike || spare ? 0 : 500);
  }
  kit.endShot(strike);
  const left = res.standing.length;
  const ct = res.contact, mph = ct ? Math.round(ct.speed * 2.237) : 0, ang = ct ? Math.round(Math.abs(ct.angle)) : 0;
  const how = ct ? `${ct.y > 0.4 ? 'Flew in' : 'Rolled in'} at ${mph} mph${ang >= 1 ? ` · ${ang}° angle` : ''}${res.bumped ? ' · off the bumper' : ''}`
    : res.reason === 'short' ? 'Stopped short' : res.reason === 'over' ? 'Flew over the pins' : 'Missed the pins';
  kit.showResult(`
    <div class="top"><span class="lbl">${esc(p.name)} · ${shot.src}</span><span class="pts ${delta ? '' : 'zero'}">${delta ? '+' + delta : '0'}</span></div>
    <div class="items"><span><b>${n} pin${n === 1 ? '' : 's'}</b>${strike ? ' · strike' : spare ? ' · spare' : left && left < 10 ? ` · ${pinNames(res.standing)} left` : ''}</span>
      <span>${how}</span></div>
    <div class="meta"><span>Frame <b>${f + 1}</b></span><span>Total <b>${sc.total}</b></span></div>`);
  renderSheet();
  if (!done && !BL.freshRack(fr, f)) setTimeout(() => { aimFor(p.up, d); aimFor(p.up, d, kit.tool.settings); }, 60); // work out the spare line while the result shows
  // sweep the deck, then the next ball (same frame) or the next frame
  setTimeout(() => {
    const rerack = !done && BL.freshRack(fr, f), keep = done || rerack ? [] : p.up;
    world.sweep(keep); shown = keep.slice(); sweepSound();
    const after = f => { const wait = () => (world.busy ? setTimeout(wait, 80) : f()); setTimeout(wait, 600); }; // once the sweep has finished
    after(() => {
      shot = null; dollyOut = true;
      if (!done) { kit.turnTo(kit.current, { announce: false }); return; }
      let i = kit.current + 1;
      if (i >= kit.players.length) { i = 0; G.frame++; }
      if (G.frame >= FRAMES) { kit.finishGame(); return; }
      kit.turnTo(i, { announce: kit.players.length > 1, sub: `Frame ${G.frame + 1}` });
    });
  }, strike || spare || split ? 1900 : 1500);
}

/* ===================== turns ===================== */
kit.on('start', ({ players }) => {
  players.forEach(p => Object.assign(p, { frames: [], splits: [], up: ALL_PINS.slice(), strikeRun: 0, markRun: 0, splitOpen: false }));
  G.frame = 0; shot = null; dollyOut = true;
  kit.turnTo(0, { announce: players.length > 1, sub: 'Frame 1' });
});
kit.on('turn', () => { sv.address(false); refresh(); });
kit.on('end', () => { sheet.hidden = true; });

/* ===================== sounds ===================== */
function clack(v = 1) { kit.sfx.noise(0.07, 2200 + Math.random() * 1600, 0.32 * v); kit.sfx.tone(700 + Math.random() * 700, { len: 0.05, vol: 0.06 * v, type: 'triangle' }); }
function rackSound() { for (let i = 0; i < 10; i++) setTimeout(() => clack(0.4), 380 + i * 45); }
function sweepSound() { kit.sfx.tone(160, { len: 0.12, vol: 0.12, type: 'square' }); setTimeout(() => kit.sfx.noise(0.5, 700, 0.12), 400); }
let birdT = 6;
function ambience(dt) { // birds in the garden now and then
  birdT -= dt; if (birdT > 0) return; birdT = 7 + Math.random() * 9;
  const f0 = 2600 + Math.random() * 900, n = 2 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) kit.sfx.tone(f0 * (1 + (i % 2) * 0.12), { t: i * 0.13, len: 0.09, vol: 0.025, slide: 1.25 });
}

/* ===================== camera: glide down the lane to watch the pins ===================== */
// One camera: it stands over the ball, and once the shot turns over at its apex it glides down
// the lane to a spot just short of the deck, then glides back for the next ball.
let dolly = 0, dollyOut = true;
const dPos = new THREE.Vector3(), dLook = new THREE.Vector3(), p0 = new THREE.Vector3(), l0 = new THREE.Vector3(), dir = new THREE.Vector3();
const smooth = u => { u = Math.max(0, Math.min(1, u)); return u * u * u * (u * (u * 6 - 15) + 10); };
function applyDolly(dt) {
  if (shot && sv.flight && !dollyOut) dolly = Math.max(dolly, smooth((sv.flight.t - shot.apexT) / shot.dDur));
  else if (dollyOut) dolly = Math.max(0, dolly - dt / 1.1);
  if (dolly <= 0) { sv.tracerFade(0); return; }
  const L = world.L, k = dollyOut ? smooth(dolly) : dolly;
  dPos.set(0, 9.5, -L + 36); dLook.set(0, 3, -L - 7);
  p0.copy(camera.position); camera.getWorldDirection(dir); l0.copy(p0).addScaledVector(dir, 60);
  camera.position.lerpVectors(p0, dPos, k); l0.lerp(dLook, k); camera.lookAt(l0);
  sv.tracerFade(Math.min(1, k * 1.4) * 0.85);
}

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);
function stepFrame(dt) {
  clock += dt; sv.update(dt); world.animate(clock, dt); applyDolly(dt); ambience(dt);
  if (shot && sv.flight) {
    const t = sv.flight.t; world.posePins(t);
    while (shot.ci < shot.clacks.length && shot.clacks[shot.ci] <= t) { clack(shot.ci === 0 ? 1.4 : 1); shot.ci++; }
  }
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); stepFrame(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { stepFrame(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__kit = kit; window.__world = world; window.__state = G;

resize();
sv.address(false);
world.setLane(DIFFICULTIES[0]); world.setPins(ALL_PINS); shown = ALL_PINS.slice();
sheet.hidden = true;
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
