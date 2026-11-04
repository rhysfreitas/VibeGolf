// Wedge Ladder — climb a ladder of carry distances with your wedges, on a vintage airstrip at sunrise.
// Rules: wedge-logic.js. Scene: scenes/airfield.js. HUD, turns, scoring feedback: the shared kit.

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createAirfield } from './scenes/airfield.js';
import { createShotView } from '../world/shot-view.js';
import { solveShot, makeToolShot } from './aim.js';
import { YD, SHOTS, CLUBS, DIFFICULTIES, CHALLENGES, judge, step, points } from './wedge-logic.js';

const stage = document.getElementById('stage');
const world = createAirfield(stage);
const { renderer, scene, camera, groundAt, surfaceAt } = world;
const sv = createShotView(world, { tracerColor: '#fff3c4', stance: { back: 8, up: 4.5, ballAt: 0.92, fov: 36 } });

const kit = createKit({
  id: 'wedge-ladder', title: 'Wedge Ladder', accent: '#f2c31a', shotsPerPlayer: SHOTS, idealShot: true, clubs: CLUBS,
  blurb: 'Climb the ladder of landing zones down the runway. Land in the lit zone to climb a rung, miss and you drop one.',
  rules: [
    'Land your ball in the <b>lit zone</b> to climb to the next rung. Miss and you drop one.',
    'Landing within about a yard of the number is a <b>PERFECT</b>, worth double. Higher rungs are worth more, and the top rung pays a bonus every time you hold it.',
    'Distance is the carry to where the ball first lands, measured straight down the runway (it\'s flat, so these are true carries).',
    `${SHOTS} shots each. Climbs in a row build a streak up to <b>×4</b>. Difficulty sets the rungs and how wide each zone is.`,
  ],
  difficulties: DIFFICULTIES, challenges: CHALLENGES,
  summary: p => `Top rung ${p.difficulty.rungs[p.best || 0]} yd`,
});

/* ===================== the flight board (ladder HUD) ===================== */
const board = document.createElement('div'); board.className = 'wl-board';
document.querySelector('#mg .mg-tr').appendChild(board);
// The rows are 10 yd apart, so a thin runway strip beside them doubles as a top-down map:
// each row lines up with its landing zone, and your recent landings show as dots.
function renderBoard(flipRow = -1) {
  const p = kit.player; if (!p) return;
  const rungs = p.difficulty.rungs, cur = p.rung || 0, best = p.best || 0;
  board.innerHTML = `<div class="hd"><span>LADDER</span><span>${cur + 1}/${rungs.length}</span></div><div class="wl-body"><canvas class="wl-strip"></canvas><div class="wl-rows">` +
    rungs.map((yd, i) => i).reverse().map(i => `<div class="wl-row ${i === cur ? 'cur' : i <= best ? 'done' : ''} ${i === best && best > 0 ? 'best' : ''} ${i === flipRow ? 'flip' : ''}"><span>${rungs[i]} YD</span><span class="st">${i === cur ? 'NOW' : i <= best ? 'CLR' : '–'}</span></div>`).join('') + '</div></div>';
  drawStrip();
}
let stripGeo = null;
// tap the board: the next simulated shot goes to that distance (rows are 10 yd apart; on the runway strip, that side too)
board.addEventListener('click', e => {
  const body = e.target.closest('.wl-body'), cv = board.querySelector('.wl-strip'); if (!body || !cv || kit.phase !== 'aim' || !stripGeo) return;
  const r = cv.getBoundingClientRect(), M = stripGeo, yd = M.top - (e.clientY - r.top - M.y0) / M.step * 10;
  const lat = e.target === cv ? (e.clientX - r.left - M.W / 2) / (M.W / 2 - 3) * 22 : 0; // sideways only on the strip itself
  if (yd > 5) kit.mapSpot(lat * YD, -yd * YD);
});
kit.on('spot', () => drawStrip());
function drawStrip() {
  const p = kit.player, cv = board.querySelector('.wl-strip'), rowsEl = board.querySelector('.wl-rows'); if (!p || !cv || !rowsEl) return;
  const rows = [...rowsEl.children]; if (!rows.length) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = rowsEl.clientHeight;
  cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rungs = p.difficulty.rungs, top = rungs[rungs.length - 1];
  const y0 = rows[0].offsetTop - rowsEl.offsetTop + rows[0].offsetHeight / 2, step = rows.length > 1 ? (rows[1].offsetTop - rows[0].offsetTop) : 18;
  const yOf = yd => y0 + (top - yd) / 10 * step;
  stripGeo = { y0, step, top, W };
  g.fillStyle = '#2a2d33'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(240,240,232,0.5)'; for (let y = 2; y < H; y += 7) g.fillRect(W / 2 - 0.5, y, 1, 3);
  const d = p.difficulty, yd = rungs[p.rung];
  g.fillStyle = 'rgba(242,195,26,0.45)'; g.fillRect(0, yOf(yd + d.band), W, yOf(yd - d.band) - yOf(yd + d.band));
  (p.landings || []).slice(-6).forEach((L, k, a) => { g.globalAlpha = 0.45 + 0.55 * (k + 1) / a.length; g.fillStyle = L.ok ? '#5aff8a' : '#ff7a3a'; g.beginPath(); g.arc(W / 2 + Math.max(-1, Math.min(1, L.x / 22)) * (W / 2 - 3), Math.max(3, Math.min(H - 3, yOf(L.yd))), 2.6, 0, 7); g.fill(); });
  g.globalAlpha = 1;
  if (kit.spot) kit.drawSpot(g, W / 2 + Math.max(-1, Math.min(1, kit.spot.x / YD / 22)) * (W / 2 - 3), Math.max(3, Math.min(H - 3, yOf(-kit.spot.z / YD))));
}

/* ===================== aiming ===================== */
const sim = b => simulate(b, { groundAt, surfaceAt });
const cache = new Map();
function solveRung(yd) { if (!cache.has(yd)) cache.set(yd, solveShot(sim, CLUBS, { x: 0, z: -yd * YD })); return cache.get(yd); }
let sol = null;
function refresh() {
  const p = kit.player, d = p.difficulty, yd = d.rungs[p.rung];
  sol = solveRung(yd); kit.setClub(sol.club, true);
  world.setBands(d, p.rung, p.best);
  kit.setPrompt(`<span class="kick">Rung ${p.rung + 1} of ${d.rungs.length}</span><span class="big">${yd} <small>yd</small></span>
    <span class="sub">Land within ±${d.band} yd · try <b>${CLUBS[sol.club].id}</b>${sol.k < 0.97 ? ` <small>${Math.round(sol.k * 100)}%</small>` : ''}</span>`);
  renderBoard();
}

/* ===================== shots ===================== */
// simulated shots: the tool's club, trajectory and shape, to the rung (or a spot tapped on the board)
const toolShot = makeToolShot(sim, CLUBS);
const rungTarget = () => ({ x: 0, z: -kit.player.difficulty.rungs[kit.player.rung] * YD });
// the kit aims simulated shots (auto-aim, or down your aim line) and adds Hit's miss
kit.aimLine({ world, view: sv, sim, ideal: s => (kit.player ? toolShot(s.target || rungTarget(), { ...s, ideal: true }).ball : null) });
kit.on('hit', s => launch(s.ball, 'Sim'));
kit.on('ideal', s => launch(s.ball, 'Ideal'));
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, 'R10'); });

let shot = null;
function launch(ball, src) {
  kit.phase = 'flight';
  const r = simulate(ball, { groundAt, surfaceAt });
  const lp = (r.pts.find(q => q.phase !== 'flight') || r.pts[r.pts.length - 1]).p;
  shot = { r, src, land: { x: lp[0], z: lp[2] }, done: false };
  const fl = sv.fly(r);
  fl.onLand = () => { const p = kit.player, j = judge(shot.land, p.difficulty, p.rung); shot.j = j; world.markLanding(lp[0], lp[2], j.inBand); if (j.inBand) kit.sfx.chime(p.rung); setTimeout(resolve, 700); };
  fl.onDone = () => setTimeout(resolve, 200);
  kit.sfx.tone(180, { len: 0.06, vol: 0.2, type: 'triangle' }); kit.sfx.noise(0.06, 3500, 0.4);
}

function resolve() {
  if (!shot || shot.done) return; shot.done = true;
  const p = kit.player, d = p.difficulty, n = d.rungs.length, i = p.rung;
  const j = shot.j || judge(shot.land, d, i);
  const pts = j.inBand ? kit.award(points(i, j, n)) : 0;
  const mv = step(i, j.inBand, n);
  if (j.inBand) {
    kit.stat('climbs'); p.climbRun = (p.climbRun || 0) + 1; kit.statMax('climbRun', p.climbRun);
    if (j.perfect) { kit.stat('perfects'); kit.sfx.perfect(); }
    if (mv.rung === n - 1 && !p.reachedTop) { p.reachedTop = true; kit.stat('top'); }
    kit.splash(j.perfect ? 'PERFECT' : mv.held ? 'HOLD!' : mv.rung === n - 1 ? 'TOP RUNG!' : 'CLIMB!', { gold: j.perfect || mv.rung === n - 1, big: mv.rung === n - 1 && !mv.held, sub: `+${pts}` });
  } else {
    p.climbRun = 0;
    if (j.missYd <= 3) kit.soClose(Math.max(0.1, j.missYd), j.dir);
    else kit.sfx.miss();
    if (mv.dropped) { kit.sfx.tone(520, { len: 0.18, vol: 0.18, type: 'triangle', slide: 0.7 }); setTimeout(() => kit.sfx.tone(360, { len: 0.25, vol: 0.16, type: 'triangle', slide: 0.7 }), 160); kit.toast(`Down a rung · ${d.rungs[mv.rung]} yd`, 1600); }
  }
  (p.landings = p.landings || []).push({ yd: j.yd, x: shot.land.x / YD, ok: j.inBand });
  const before = i; p.rung = mv.rung; p.best = Math.max(p.best || 0, p.rung);
  const end = kit.endShot(j.inBand);
  const sign = j.off > 0 ? '+' : '';
  kit.showResult(`
    <div class="top"><span class="lbl">${p.name} · ${shot.src}</span><span class="pts ${pts ? '' : 'zero'}">${pts ? '+' + pts : '0'}</span></div>
    <div class="items"><span><b>${j.yd.toFixed(1)} yd</b> carry · ${sign}${j.off.toFixed(1)} yd ${j.off > 0 ? 'long' : 'short'}${j.onRunway ? '' : ' · off the runway'}</span>
      <span>${j.inBand ? (mv.held ? `Held the top · ${d.rungs[p.rung]} yd` : `Up to ${d.rungs[p.rung]} yd`) : mv.dropped ? `Down to ${d.rungs[p.rung]} yd` : `Still on ${d.rungs[p.rung]} yd`}</span></div>
    <div class="meta"><span>Target <b>${d.rungs[before]}</b> ±${d.band}</span><span>Best <b>${d.rungs[p.best]}</b> yd</span></div>`);
  renderBoard(p.rung);
  setTimeout(() => kit.next(), end.last ? 1600 : 1900);
}

/* ===================== turns ===================== */
kit.on('start', ({ players }) => { players.forEach(p => { p.rung = 0; p.best = 0; p.climbRun = 0; p.reachedTop = false; p.landings = []; }); world.clearMarks(); });
kit.on('turn', () => { sv.address(false); refresh(); });

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);
function stepFrame(dt) { clock += dt; sv.update(dt); world.animate(clock, dt); }
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); stepFrame(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { stepFrame(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__kit = kit; window.__world = world;

resize();
sv.address(false);
world.setBands(DIFFICULTIES[0], 0, 0);
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
