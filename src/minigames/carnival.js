// Carnival Booth — a life-size tin shooting gallery. Knock down cans, spin bullseye boards, flip the
// ducks gliding along their rail and ring the prize bell. Tickets win a plush.
// Rules: carnival-logic.js. Scene: scenes/tin-gallery.js. HUD, turns, scoring feedback: the shared kit.

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createShotView } from '../world/shot-view.js';
import { CLUBS } from './shape-it-logic.js';
import { createCalliope } from './calliope.js';
import { YD, SHOTS, DIFFICULTIES, CHALLENGES, ROWS, ROW_IDS, PRIZES, layout, duckX, duckLap, findHit, bounceOff, scoreHit, aimPoint, solveAim, prizeFor, nextPrize } from './carnival-logic.js';
import { amateurMiss } from './aim.js';

// the painted signs use a carnival typeface: give it a moment to arrive before drawing them
if (document.fonts) await Promise.race([document.fonts.load('40px "Rye"'), new Promise(r => setTimeout(r, 1500))]).catch(() => {});
const { createTinGallery } = await import('./scenes/tin-gallery.js');

const stage = document.getElementById('stage');
const world = createTinGallery(stage);
const { renderer, scene, camera, groundAt, surfaceAt } = world;
const sv = createShotView(world, { tracerColor: '#fff3c4', stance: { back: 4.5, up: 1.6, ballAt: 0.94, fov: 40 } });
const music = createCalliope(() => kit.sfx.on);

const kit = createKit({
  id: 'carnival-booth', title: 'Carnival Booth', accent: '#ffcf4a', shotsPerPlayer: SHOTS, idealShot: true, clubs: CLUBS,
  blurb: 'Step right up! Knock down tin cans, spin the bullseye boards, flip the ducks and ring the prize bell. Tickets win a plush.',
  rules: [
    `Cans <b>${ROWS.cans.points}</b> · boards <b>${ROWS.boards.points}</b> · ducks <b>${ROWS.ducks.points}</b> · the bell <b>${ROWS.bell.points}</b>. Bullseyes and dead-centre ducks are worth double.`,
    'The ducks glide along their rail, so aim ahead of them. On Beginner a marker shows where.',
    'Knock down every can for a row bonus. Hits in a row build a streak up to <b>×4</b>.',
    `${SHOTS} shots each. Pick a row under the prompt (or tap one). Tickets win a small, medium or giant plush.`,
  ],
  difficulties: DIFFICULTIES, challenges: CHALLENGES,
  summary: p => `${prizeFor(p.score).name}`,
});

/* ===================== prize board (under the tools) ===================== */
const bear = (s, c) => `<svg width="${s}" height="${s * 1.15}" viewBox="0 0 40 46" aria-hidden="true"><g fill="${c}"><circle cx="9" cy="8" r="6"/><circle cx="31" cy="8" r="6"/><circle cx="20" cy="16" r="12"/><ellipse cx="20" cy="35" rx="13" ry="11"/></g><circle cx="15.5" cy="14" r="1.8" fill="#222"/><circle cx="24.5" cy="14" r="1.8" fill="#222"/><ellipse cx="20" cy="20" rx="4.5" ry="3.4" fill="#f3e6c4"/><circle cx="20" cy="19" r="1.4" fill="#222"/></svg>`;
const prizeEl = document.createElement('div'); prizeEl.className = 'cb-prize glass';
prizeEl.innerHTML = `<div class="lbl">Tickets</div><div class="tix"><span data-p="tix">0</span></div>
  <div class="cb-shelf">${bear(14, '#d96a8a')}${bear(20, '#6aa8d9')}${bear(28, '#e0c060')}</div>
  <div class="cb-bar"><i data-p="bar"></i></div><div class="cb-next" data-p="next"></div>`;
document.querySelector('#mg .mg-tr').appendChild(prizeEl);
const PE = {}; prizeEl.querySelectorAll('[data-p]').forEach(e => { PE[e.dataset.p] = e; });
const shelf = [...prizeEl.querySelectorAll('.cb-shelf svg')];
function renderPrize() {
  const p = kit.player; if (!p) return;
  const t = p.score, nx = nextPrize(t), cur = prizeFor(t), prev = cur.min;
  PE.tix.textContent = t.toLocaleString();
  shelf.forEach((s, i) => s.classList.toggle('on', t >= PRIZES[i + 1].min));
  PE.bar.style.width = nx ? `${Math.round((t - prev) / (nx.min - prev) * 100)}%` : '100%';
  PE.next.textContent = nx ? `${(nx.min - t).toLocaleString()} to ${nx.name.toLowerCase()}` : 'Giant plush won!';
}

/* ===================== state ===================== */
const G = { row: 'cans', cans: [], ducksDown: [], duckLap: [], rows: [], shot: null, sol: null, aim: null, lay: null, solveKey: '' };
let clock = 0;
const fsim = b => simulate(b, { groundAt, flightOnly: true });
const state = () => ({ cansDown: G.cans[kit.current] || [], ducksDown: G.ducksDown, t0: clock });

function solveNow(s = null) { // s: the simulated-shot tool's settings (club, trajectory, shape)
  const o = s ? { club: s.clubAuto ? null : s.club, traj: s.traj, axis: s.axis } : {};
  const lay = G.lay; let aim = aimPoint(G.row, lay, state(), clock), sol = solveAim(fsim, CLUBS, aim, o);
  if (G.row === 'ducks') { aim = aimPoint('ducks', lay, state(), clock, sol.timeToTarget); sol = solveAim(fsim, CLUBS, aim, o); }
  return { aim, sol };
}
function refreshAim() {
  const { aim, sol } = solveNow(); G.aim = aim; G.sol = sol;
  kit.setClub(sol.club, true);
  world.setAim(G.row === 'ducks' ? null : aim);
  renderPromptUI();
}
function renderPromptUI() {
  const R = ROWS[G.row], c = CLUBS[G.sol.club];
  kit.setPrompt(`<span class="kick">Target</span><span class="big">${R.name} <small>${R.yd} yd</small></span>
    <span class="sub">${ROWS[G.row].points} tickets${G.row === 'ducks' ? ' · aim ahead' : ''} · try <b>${c.id}</b>${G.sol.k < 0.97 ? ` <small>${Math.round(G.sol.k * 100)}%</small>` : ''}</span>
    <span class="cb-rows">${ROW_IDS.map(id => `<button data-row="${id}" class="${id === G.row ? 'on' : ''}"><b>${ROWS[id].name}</b><small>${ROWS[id].yd}</small></button>`).join('')}</span>`);
  kit.els.prompt.querySelectorAll('[data-row]').forEach(b => b.onclick = () => pickRow(b.dataset.row));
}
function pickRow(id) { if (kit.phase !== 'aim' || id === G.row) return; G.row = id; kit.sfx.tick(); refreshAim(); }

// tap a row in the scene
const anchors = () => ({ cans: [0, ROWS.cans.shelf + 2.5, ROWS.cans.z], boards: [0, ROWS.boards.cy, ROWS.boards.z], ducks: [0, ROWS.ducks.rail + 3, ROWS.ducks.z], bell: [0, ROWS.bell.cy, ROWS.bell.z] });
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || kit.phase !== 'aim') return;
  const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3();
  let best = null, bd = Infinity;
  for (const [id, p] of Object.entries(anchors())) { v.set(...p).project(camera); const dy = Math.abs((1 - v.y) / 2 * r.height - (e.clientY - r.top)); if (dy < bd) { bd = dy; best = id; } }
  if (best && bd < 60) pickRow(best);
});

/* ===================== shots ===================== */
kit.on('hit', s => { const { sol } = solveNow(s); launch(amateurMiss(sol.ball), 'Sim'); });
kit.on('ideal', s => { const { sol } = solveNow(s); launch({ ...sol.ball }, 'Ideal'); });
kit.on('club', i => { sv.address(CLUBS[i].tee); });
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, 'R10'); });

function launch(ball, src) {
  kit.phase = 'flight'; world.setAim(null); world.setLead(null);
  const r = simulate(ball, { groundAt, surfaceAt });
  const { hit, near } = findHit(r.pts, G.lay, state());
  const shown = hit ? { ...r, pts: bounceOff(r.pts, hit) } : r;
  G.shot = { r, hit, near, ball, src, fired: false, pts: 0 };
  const fl = sv.fly(shown);
  fl.onDone = () => setTimeout(finishShot, hit ? 900 : 600);
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
}

const WORD = { cans: 'CLANK!', boards: 'THWACK!', ducks: 'QUACK!', bell: 'DING DING DING!' };
function fireHit() {
  const S = G.shot, h = S.hit, pi = kit.current, p = kit.player; S.fired = true;
  const pts = kit.award(scoreHit(h)); S.pts += pts;
  (G.rows[pi] = G.rows[pi] || new Set()).add(h.kind); kit.statMax('rows', G.rows[pi].size);
  if (h.kind !== 'bell') world.confetti(h.p, 50, 3);
  if (h.kind === 'cans') {
    G.cans[pi][h.i] = true; world.knockCan(h.i, h.p);
    kit.sfx.tone(1180, { len: 0.25, vol: 0.18, type: 'square' }); kit.sfx.tone(1730, { len: 0.35, vol: 0.12, type: 'triangle' }); kit.sfx.noise(0.12, 5000, 0.4);
    kit.splash(WORD.cans, { sub: `+${pts}` });
    if (G.cans[pi].every(Boolean)) {
      setTimeout(() => { const b = kit.award(200); S.pts += b; kit.stat('canRows'); kit.splash('ROW CLEARED!', { gold: true, big: true, sub: `+${b}` }); kit.sfx.fanfare(); renderPrize(); }, 900);
      setTimeout(() => { G.cans[pi] = G.cans[pi].map(() => false); if (kit.current === pi) world.restockCans(); }, 2600);
    }
  } else if (h.kind === 'boards') {
    world.hitBoard(h.i); kit.sfx.tone(140, { len: 0.18, vol: 0.35, type: 'triangle' }); kit.sfx.noise(0.1, 900, 0.5);
    if (h.perfect) { kit.stat('bulls'); kit.sfx.perfect(); kit.splash('BULLSEYE!', { gold: true, sub: `+${pts}` }); } else kit.splash(WORD.boards, { sub: `+${pts}` });
  } else if (h.kind === 'ducks') {
    G.ducksDown[h.i] = true; G.duckLap[h.i] = duckLap(G.lay.ducks, h.i, clock);
    kit.stat('ducks'); kit.sfx.tone(900, { len: 0.12, vol: 0.2, type: 'square', slide: 1.3 }); kit.sfx.tone(600, { len: 0.2, vol: 0.15, type: 'sawtooth', slide: 0.7 });
    if (h.perfect) { kit.stat('duckCenters'); kit.sfx.perfect(); kit.splash('DEAD CENTRE!', { gold: true, sub: `+${pts}` }); } else kit.splash(WORD.ducks, { sub: `+${pts}` });
  } else {
    world.ringBell(); kit.stat('bells'); kit.sfx.fanfare();
    [0, 0.45, 0.9].forEach(t => setTimeout(() => [[880, 0.2], [1320, 0.12], [1760, 0.08], [2350, 0.05]].forEach(([f, v]) => kit.sfx.tone(f, { len: 1.6, vol: v, type: 'sine' })), t * 1000));
    kit.splash(WORD.bell, { gold: true, big: true, sub: `+${pts}` });
  }
  renderPrize();
}

function finishShot() {
  const S = G.shot, p = kit.player;
  if (!S.hit) {
    if (S.near.kind && S.near.yd < 3) kit.soClose(Math.max(0.1, S.near.yd), ROWS[S.near.kind].name.toLowerCase().replace(/s$/, ''));
    else kit.sfx.miss();
  }
  const end = kit.endShot(!!S.hit);
  const h = S.hit, what = h ? (h.kind === 'cans' ? 'Knocked down a can' : h.kind === 'boards' ? (h.perfect ? 'Bullseye!' : 'Hit a board') : h.kind === 'ducks' ? (h.perfect ? 'Duck, dead centre!' : 'Flipped a duck') : 'Rang the bell!') : 'Missed';
  const carry = Math.round(S.r.carry);
  kit.showResult(`
    <div class="top"><span class="lbl">${p.name} · ${S.src}</span><span class="pts ${S.pts ? '' : 'zero'}">${S.pts ? '+' + S.pts : '0'}</span></div>
    <div class="items"><span><b>${what}</b></span><span>${p.score.toLocaleString()} tickets · ${prizeFor(p.score).name}</span></div>
    <div class="meta"><span><b>${carry}</b> yd carry</span><span>${S.near.kind && !h ? `${S.near.yd < 10 ? S.near.yd.toFixed(1) : Math.round(S.near.yd)} yd off the ${ROWS[S.near.kind].name.toLowerCase()}` : ''}</span></div>`);
  renderPrize();
  setTimeout(() => kit.next(), end.last ? 1600 : 2000);
}

/* ===================== turns ===================== */
kit.on('start', ({ players }) => {
  G.cans = players.map(() => ROWS.cans.xs.map(() => false)); G.rows = players.map(() => new Set());
  G.ducksDown = Array(ROWS.ducks.n).fill(false); G.duckLap = Array(ROWS.ducks.n).fill(0);
});
kit.on('turn', ({ player, index }) => {
  G.lay = layout(player.difficulty); world.setLayout(G.lay); world.setCansDown(G.cans[index]);
  sv.address(false);
  refreshAim(); renderPrize();
});

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now();
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

let leadT = 0;
function step(dt) {
  clock += dt;
  // ducks that were knocked flat pop back up once they've looped round
  if (G.lay) for (let i = 0; i < G.ducksDown.length; i++) if (G.ducksDown[i] && duckLap(G.lay.ducks, i, clock) > G.duckLap[i]) G.ducksDown[i] = false;
  if (G.shot && G.shot.hit && !G.shot.fired && sv.flight && sv.flight.t >= G.shot.hit.t) fireHit();
  // Beginner: show where to aim ahead of the duck (updated a few times a second)
  if (kit.phase === 'aim' && G.row === 'ducks' && G.lay && G.sol) {
    leadT -= dt;
    if (leadT <= 0) { leadT = 0.1; const a = aimPoint('ducks', G.lay, state(), clock, G.sol.timeToTarget); world.setLead(kit.player.difficulty.lead ? a.x : null); }
  } else world.setLead(null);
  sv.update(dt);
  world.animate(clock, dt, { ducksDown: G.ducksDown });
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__cb = G; window.__kit = kit; window.__world = world;

resize();
sv.address(false);
G.lay = layout(DIFFICULTIES[0]); world.setLayout(G.lay);
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
