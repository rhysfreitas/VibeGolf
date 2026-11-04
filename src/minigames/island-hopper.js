// Island Hopper — hop island to island above the clouds without falling in.
// Rules: island-logic.js. HUD, turns, scoring feedback: the shared kit (survival-run mode).

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createSkyIslands } from './scenes/sky-islands.js';
import { createShotView } from '../world/shot-view.js';
import { CLUBS } from './shape-it-logic.js';
import { YD, LIVES, VOID_Y, DIFFICULTIES, CHALLENGES, BANDS, band, startIsland, makeOptions, resolveHop, solveHop, distYd, padRadius, teeSpot } from './island-logic.js';
import { amateurMiss } from './aim.js';

const stage = document.getElementById('stage');
const world = createSkyIslands(stage);
const { renderer, scene, camera } = world;
// stand a little higher and further back than usual so you can see over your island's edge to the targets below
const sv = createShotView({ ...world, groundAt: world.safeGround }, { tracerColor: '#fff3c4', stance: { back: 6, up: 4.2, ballAt: 0.86 } });

const kit = createKit({
  id: 'island-hopper', title: 'Island Hopper', accent: '#6dffb0', mode: 'run', idealShot: true, clubs: CLUBS,
  blurb: 'Hop from island to island above the clouds. Farther islands score more, but miss and the clouds take your ball.',
  rules: [
    'Each hop offers three islands: <b>Short</b> 100, <b>Mid</b> 200, <b>Long</b> 350.',
    'Stop on the glowing pad for <b>PERFECT</b>: double points.',
    'You have <b>3 lives</b>. A ball in the clouds costs one. Hops in a row build your streak.',
    'After each hop you play on from the front of the island you landed on. Islands shrink the further you go.',
    'Tap an island or the map to pick your target.',
  ],
  difficulties: DIFFICULTIES, challenges: CHALLENGES,
  summary: p => `${p.stats.hops || 0} hops · longest ${Math.round(p.stats.bestHop || 0)} yd`,
});

/* ===================== HUD extras: lives + map ===================== */
const livesEl = document.createElement('div'); livesEl.className = 'ih-lives glass';
document.getElementById('mg').appendChild(livesEl);
function renderLives() { livesEl.innerHTML = `<span class="lbl">Lives</span>${Array.from({ length: LIVES }, (_, i) => `<i class="${i < G.lives ? 'on' : ''}">●</i>`).join('')}<span class="ih-hop">Island <b>${G.hop + 1}</b></span>`; }
const mapWrap = document.createElement('div'); mapWrap.className = 'ih-map glass';
mapWrap.innerHTML = '<canvas aria-label="Island map. Tap an island to aim at it."></canvas>';
document.querySelector('#mg .mg-tr').appendChild(mapWrap);
const mapCv = mapWrap.querySelector('canvas');
const BCOL = { short: '#6dffb0', mid: '#36e2ff', long: '#ffc23d', start: '#a9bcc2' };
const MAPYD = 260;
function mapXY(x, z, W, H) { const k = (H - 14) / (MAPYD * YD); return [W / 2 + (x - G.from.x) * k, H - 8 - (G.from.z - z) * k]; }
function drawMap() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = mapCv.clientWidth, H = mapCv.clientHeight;
  if (!W || !H || !G.current) return;
  if (mapCv.width !== Math.round(W * dpr)) { mapCv.width = Math.round(W * dpr); mapCv.height = Math.round(H * dpr); }
  const g = mapCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(190,205,215,0.12)'; g.fillRect(0, 0, W, H);
  const k = (H - 14) / (MAPYD * YD);
  g.font = '600 8.5px "Saira Semi Condensed", sans-serif'; g.fillStyle = 'rgba(242,239,230,0.45)';
  for (const yd of [100, 200]) { const y = H - 8 - yd * YD * k; g.fillRect(3, y, W - 6, 0.6); g.fillText(yd, 4, y - 2); }
  for (const I of [G.current, ...G.options]) {
    const [x, y] = mapXY(I.x, I.z, W, H);
    g.fillStyle = I === G.current ? 'rgba(169,188,194,0.55)' : I === G.target ? BCOL[I.band] : BCOL[I.band] + '99';
    g.beginPath(); g.arc(x, y, Math.max(3, I.r * k), 0, 7); g.fill();
    if (I === G.target) { g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, Math.max(4, I.r * k) + 2, 0, 7); g.stroke(); }
  }
  if (G.track && G.track.length > 1) { g.strokeStyle = '#fff3c4'; g.lineWidth = 1.4; g.beginPath(); G.track.forEach((p, i) => { const [x, y] = mapXY(p[0] + G.from.x, p[2] + G.from.z, W, H); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  const [bx, by] = mapXY(G.from.x, G.from.z, W, H); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by, 2.4, 0, 7); g.fill();
  if (kit.spot) { const [sx, sy] = mapXY(G.from.x + kit.spot.x, G.from.z + kit.spot.z, W, H); kit.drawSpot(g, sx, sy); }
}
mapCv.addEventListener('click', e => {
  if (kit.phase !== 'aim') return;
  const r = mapCv.getBoundingClientRect(), W = r.width, H = r.height;
  let best = null, bd = Infinity;
  for (const I of G.options) { const [x, y] = mapXY(I.x, I.z, W, H), d = Math.hypot(x - (e.clientX - r.left), y - (e.clientY - r.top)) - Math.max(3, I.r * (H - 14) / (MAPYD * YD)); if (d < bd) { bd = d; best = I; } }
  if (best && bd < 10) { selectTarget(best); return; }
  // anywhere else: the next simulated shot goes to that spot
  const k = (H - 14) / (MAPYD * YD), x = (e.clientX - r.left - W / 2) / k, z = -(H - 8 - (e.clientY - r.top)) / k;
  if (-z > 5) kit.mapSpot(x, z);
});
kit.on('spot', () => drawMap());
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || kit.phase !== 'aim') return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  // pick the option whose centre is closest to the tap ray
  let best = null, bd = Infinity; const p = new THREE.Vector3();
  for (const I of G.options) { p.set(I.x - G.from.x, I.y - G.from.y + 2, I.z - G.from.z); const d = ray.ray.distanceToPoint(p) / Math.max(1, p.length() * 0.06); if (d < bd) { bd = d; best = I; } }
  if (best && bd < 6) selectTarget(best);
});

/* ===================== state ===================== */
const G = { lives: LIVES, hop: 0, clean: 0, from: { x: 0, y: 0, z: 0 }, current: null, currentObj: null, options: [], optionObjs: [], target: null, solve: null, track: null, shot: null };
let diff = DIFFICULTIES[0];

function optLabel(I) { const b = band(I.band); return [String(b.points), `${b.name} · ${Math.round(distYd(G.from, I))} yd`]; }
function spawnOptions(rise) {
  G.options = makeOptions(G.from, G.hop, diff, Math.random, [G.current]);
  G.optionObjs = G.options.map(I => world.addIsland(I, { labelText: optLabel(I), rise: rise ? 70 + Math.random() * 30 : 0 }));
  G.target = G.options.find(I => I.band === 'mid') || G.options[0];
}
function resetRun() {
  for (const o of [...world.islands]) world.removeIsland(o, false);
  diff = kit.player.difficulty;
  Object.assign(G, { lives: LIVES, hop: 0, clean: 0, from: { x: 0, y: 0, z: 0 }, track: null });
  world.setOrigin(new THREE.Vector3());
  G.current = startIsland(diff); G.currentObj = world.addIsland(G.current, { pad: false });
  spawnOptions(false);
  sv.address(false); renderLives();
}

/* ===================== aiming ===================== */
const solveCache = new Map();
function solveFor(I) {
  if (!solveCache.has(I.id)) solveCache.set(I.id, solveHop(simulate, CLUBS, G.from, I, [G.current, ...G.options]));
  return solveCache.get(I.id);
}
function selectTarget(I) { G.target = I; kit.sfx.tick(); renderPrompt(); }
function renderPrompt() {
  const I = G.target; if (!I) return;
  G.solve = solveFor(I); kit.setClub(G.solve.club, true);
  const b = band(I.band), dy = I.y - G.from.y;
  kit.setPrompt(`<span class="kick">Hop to</span><span class="big" style="color:${BCOL[I.band]}">${b.name} · ${b.points}</span>
    <span class="sub">${Math.round(distYd(G.from, I))} yd${Math.abs(dy) > 2 ? ` · ${dy > 0 ? '↑' : '↓'}${Math.round(Math.abs(dy))} m` : ''} · try <b>${CLUBS[G.solve.club].id}</b>${G.solve.k < 0.97 ? ` <small>${Math.round(G.solve.k * 100)}%</small>` : ''}</span>
    <span class="ih-opts">${G.options.map(o => `<button data-opt="${o.id}" class="${o === I ? 'on' : ''}" style="--c:${BCOL[o.band]}">${band(o.band).name}</button>`).join('')}</span>`);
  kit.els.prompt.querySelectorAll('[data-opt]').forEach(btn => btn.onclick = () => selectTarget(G.options.find(o => o.id === +btn.dataset.opt)));
  const top = I; sv.keepInView(new THREE.Vector3(top.x - G.from.x, top.y - G.from.y + 8, top.z - G.from.z));
  drawMap();
}

/* ===================== shots ===================== */
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// simulated shots: the tool's club, trajectory and shape, to the island (or a spot tapped on the map)
function toolSolve(s) {
  const plain = s.clubAuto && s.axisAuto && s.traj === 'normal' && !s.target;
  if (plain) return G.solve;
  const I = s.target ? { x: G.from.x + s.target.x, z: G.from.z + s.target.z } : G.target;
  return solveHop(simulate, CLUBS, G.from, I, [G.current, ...G.options], { club: s.clubAuto ? null : s.club, traj: s.traj, axis: s.axis });
}
kit.on('hit', s => { const sol = G.target && toolSolve(s); if (sol) launch(amateurMiss(sol.ball), 'Sim'); });
kit.on('ideal', s => { const sol = G.target && toolSolve(s); if (sol) launch({ ...sol.ball }, 'Ideal'); });
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, 'R10'); });

function launch(ball, src) {
  kit.phase = 'flight';
  const r = simulate(ball, { groundAt: world.groundAt, voidY: VOID_Y });
  G.shot = { r, src };
  const fl = sv.fly(r);
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
  fl.onDone = () => setTimeout(resolveShot, 500);
}

function resolveShot() {
  const r = G.shot.r, res = resolveHop(r.pts, r.outcome, G.from, G.current, G.options);
  G.track = r.pts.filter((_, i) => i % 6 === 0).map(q => q.p);
  const pl = kit.player;
  if (res.kind === 'hop') {
    const b = band(res.island.band);
    if (res.pad) { kit.splash('PERFECT', { gold: true, sub: `${b.name} hop` }); kit.sfx.perfect(); kit.stat('pads'); }
    else kit.splash(b.id === 'long' ? 'LONG HOP!' : 'HOP!', { gold: b.id === 'long' });
    kit.sfx.chime(b.id === 'short' ? 0 : b.id === 'mid' ? 1 : 2);
    kit.award(res.points);
    G.hop++; G.clean++;
    kit.stat('hops'); if (b.id === 'long') kit.stat('longHops'); kit.statMax('cleanRun', G.clean); kit.statMax('bestHop', res.yd);
    kit.endShot(true);
    showResult(res);
    hopTo(res);
    return;
  }
  if (res.kind === 'stayed') {
    kit.toast('Stayed on your island · no life lost', 1800);
    kit.sfx.miss(); kit.endShot(false); showResult(res);
    setTimeout(() => { sv.address(false); kit.next(); }, 1500);
    return;
  }
  // into the clouds
  G.lives--; G.clean = 0; renderLives();
  sv.ball.visible = false;
  if (res.rolledOff) kit.soClose(0, 'rolled off the edge');
  else if (res.missYd < 8) kit.soClose(Math.max(0.1, res.missYd));
  kit.splash('INTO THE CLOUDS', { sub: G.lives ? `${G.lives} ${G.lives === 1 ? 'life' : 'lives'} left` : 'Out of lives' });
  kit.sfx.tone(300, { len: 0.9, vol: 0.2, type: 'triangle', slide: 0.3 });
  kit.endShot(false); showResult(res);
  if (G.lives <= 0) { kit.finishRun(); setTimeout(() => kit.next(), 3000); }
  else setTimeout(() => { sv.address(false); kit.next(); }, 1800);
}

function showResult(res) {
  const shotPts = kit.player.shotPts, r = G.shot.r;
  const line = res.kind === 'hop' ? `<span><b>${band(res.island.band).name} hop</b> · ${Math.round(res.yd)} yd${res.pad ? ' · <b>on the pad</b>' : ''}</span>`
    : res.kind === 'stayed' ? '<span>Stayed on your island</span>'
    : `<span>Into the clouds${res.rolledOff ? ' · rolled off the edge' : Number.isFinite(res.missYd) ? ` · ${res.missYd < 10 ? res.missYd.toFixed(1) : Math.round(res.missYd)} yd from ${band(res.island.band).name.toLowerCase()}` : ''}</span>`;
  kit.showResult(`
    <div class="top"><span class="lbl">${kit.player.name} · ${G.shot.src}</span><span class="pts ${shotPts ? '' : 'zero'}">${shotPts ? '+' + shotPts : '0'}</span></div>
    <div class="items">${line}</div>
    <div class="meta"><span>Island <b>${G.hop + 1}</b></span><span><b>${Math.round(r.carry)}</b> yd carry</span></div>`);
}

// Fly to the island: slide the world so the ball's resting spot becomes the new origin.
const tween = { on: false, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3() };
function hopTo(res) {
  const keep = res.island;
  setTimeout(() => {
    sv.address(false); sv.ball.visible = false;
    // the old island and the islands you didn't pick drop into the clouds
    for (const o of [G.currentObj, ...G.optionObjs]) if (o && o.I !== keep) world.removeIsland(o);
    const keptObj = G.optionObjs.find(o => o.I === keep);
    if (keptObj) { keptObj.group.remove(keptObj.pad, keptObj.beacon, keptObj.label); keptObj.pad = keptObj.beacon = keptObj.label = null; }
    G.current = keep; G.currentObj = keptObj; G.options = []; G.optionObjs = [];
    // walk to the front of the island for the next shot
    const t = teeSpot(keep);
    tween.from.copy(world.origin); tween.to.set(t.x, t.y, t.z); tween.t = 0; tween.on = true;
  }, 1300);
}
function stepTween(dt) {
  if (!tween.on) return;
  tween.t = Math.min(1, tween.t + dt / 1.6);
  const e = tween.t < 0.5 ? 2 * tween.t * tween.t : 1 - Math.pow(-2 * tween.t + 2, 2) / 2;
  world.setOrigin(tween.from.clone().lerp(tween.to, e));
  if (tween.t >= 1) {
    tween.on = false;
    G.from = { x: tween.to.x, y: tween.to.y, z: tween.to.z }; G.track = null; solveCache.clear();
    sv.address(false); renderLives();
    spawnOptions(true);
    setTimeout(() => kit.next(), 1500); // after the new islands rise
  }
}

/* ===================== run flow ===================== */
kit.on('runStart', () => resetRun());
kit.on('turn', () => { renderPrompt(); kit.setShotLabel(`Island ${G.hop + 1} · ${'●'.repeat(G.lives)}${'○'.repeat(LIVES - G.lives)}`); });

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0, mapT = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); drawMap(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

function step(dt) {
  clock += dt;
  stepTween(dt);
  world.animate(clock, dt);
  sv.update(dt);
  if (sv.flight && !sv.flight.done) { mapT -= dt; if (mapT <= 0) { mapT = 1 / 12; G.track = sv.flight.pts.slice(0, Math.max(2, sv.flight.pts.findIndex(q => q.t > sv.flight.t))).filter((_, i) => i % 6 === 0).map(q => q.p); drawMap(); } }
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__ih = G; window.__kit = kit;

resize();
sv.address(false);
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
