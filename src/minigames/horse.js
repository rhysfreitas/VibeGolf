// Golf HORSE — call a shot on the scoreboard, make it, and make everyone else copy it.
// Rules: horse-logic.js. Scene: scenes/cul-de-sac.js. HUD, turns, scoring feedback: the shared kit
// in 'manual' mode (this file decides who plays next and when the game ends).

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { amateurMiss } from './aim.js';
import { createCulDeSac } from './scenes/cul-de-sac.js';
import { createShotView } from '../world/shot-view.js';
import { CLUBS } from './shape-it-logic.js';
import * as H from './horse-logic.js';

const { TARGETS, YD, FT, TEE_H } = H;
const stage = document.getElementById('stage');
const world = createCulDeSac(stage);
const { renderer, scene, camera } = world;
// stand a little taller than usual: the bay is up on the garage roof and the targets are on the street
const sv = createShotView(world, { tracerColor: '#fff3c4', stance: { back: 7, up: 2.2, ballAt: 0.9, fov: 36 } });

const G = { word: 'HORSE', setter: 0, role: 'set', call: { ring: 3, shape: 'any', height: 'any' }, queue: [], matchers: 0, stumped: 0, calls: 0, landings: [], shot: null, sol: null, busy: false };

const kit = createKit({
  id: 'horse', title: 'Golf HORSE', accent: '#ff8a2a', mode: 'manual', idealShot: true, clubs: CLUBS, board: false,
  blurb: 'Call your shot on the scoreboard: a target, a shape and a height. Make it, and everyone else has to copy it or take a letter.',
  rules: [
    'The setter calls a <b>target ring</b>, a <b>shape</b> (straight, draw or fade) and a <b>height</b> (high or low), or leaves them on Any.',
    'Make your own call and everyone else must match it. <b>Miss your call</b> and the call passes on, no letters.',
    'Land in the ring with the right shape and height to <b>MATCH</b>. The bright centre is a <b>PERFECT MATCH</b>.',
    'Miss a match and take a letter. Spell the word and you\'re out. Last one standing wins.',
    'Difficulty sets each player\'s ring size and how clearly a shape has to show. Playing alone? Dusty from down the street joins in.',
  ],
  difficulties: H.DIFFICULTIES, challenges: H.CHALLENGES,
  minPlayers: 2, cpu: { name: 'Dusty', diff: 'amateur' },
  options: [{ id: 'word', label: 'Play to', def: 'HORSE', choices: [{ id: 'HORSE', label: 'HORSE' }, { id: 'PIG', label: 'PIG · quick game' }] }],
  rankBy: (a, b) => (a.letters || 0) - (b.letters || 0) || (b.outAt ?? 1e9) - (a.outAt ?? 1e9) || b.score - a.score,
  summary: p => (p.letters ? `${G.word.slice(0, p.letters)}${p.letters >= G.word.length ? ' · out' : ''}` : 'no letters'),
});

/* ===================== the scoreboard (HUD) ===================== */
const hb = document.createElement('div'); hb.className = 'hb'; hb.hidden = true;
hb.innerHTML = `
  <div class="hb-top">
    <div class="hb-cell"><span class="hb-lbl">TARGET</span><span class="hb-val"><button class="arr" data-b="prev" aria-label="Closer target">◀</button><button class="hb-yd led" data-b="yd" aria-label="Target"></button><button class="arr" data-b="next" aria-label="Farther target">▶</button></span><span class="hb-line" data-b="ring"></span></div>
    <div class="hb-cell"><span class="hb-lbl">SHAPE</span><button class="tog hb-txt led" data-b="shape"></button><span class="hb-line" data-b="shapeLine"></span></div>
    <div class="hb-cell"><span class="hb-lbl">HEIGHT</span><button class="tog hb-txt led" data-b="height"></button><span class="hb-line" data-b="heightLine"></span></div>
  </div>
  <div class="hb-status led" data-b="status"></div>
  <div class="hb-players" data-b="players"></div>`;
document.getElementById('mg').appendChild(hb);
const HB = {}; hb.querySelectorAll('[data-b]').forEach(el => { HB[el.dataset.b] = el; });
const canEdit = () => G.role === 'set' && kit.phase === 'aim' && kit.player && !kit.player.cpu;
const cycle = (arr, v, d = 1) => arr[(arr.indexOf(v) + d + arr.length) % arr.length];
function changeCall(patch) { if (!canEdit()) return; Object.assign(G.call, patch); kit.sfx.tick(); hb.classList.remove('flip'); void hb.offsetWidth; hb.classList.add('flip'); refresh(); }
HB.prev.onclick = () => changeCall({ ring: (G.call.ring + TARGETS.length - 1) % TARGETS.length });
HB.next.onclick = () => changeCall({ ring: (G.call.ring + 1) % TARGETS.length });
HB.yd.onclick = () => changeCall({ ring: (G.call.ring + 1) % TARGETS.length });
HB.shape.onclick = () => changeCall({ shape: cycle(H.SHAPE_CALLS, G.call.shape) });
HB.height.onclick = () => changeCall({ height: cycle(H.HEIGHT_CALLS, G.call.height) });

const setterName = () => kit.players[G.setter] ? kit.players[G.setter].name : '';
const callText = (c = G.call) => [String(TARGETS[c.ring].yd), c.shape !== 'any' ? H.SHAPE_NAMES[c.shape] : '', c.height !== 'any' ? H.HEIGHT_NAMES[c.height] : ''].filter(Boolean).join(' · ');
function renderBoard() {
  const p = kit.player; if (!p) return;
  const T = TARGETS[G.call.ring], d = p.difficulty;
  hb.classList.toggle('edit', canEdit());
  HB.yd.textContent = T.yd; HB.yd.style.color = T.color;
  HB.ring.textContent = T.hoop ? 'THE HOOP' : T.name.toUpperCase();
  HB.ring.style.color = T.color;
  HB.shape.textContent = H.SHAPE_NAMES[G.call.shape];
  HB.shapeLine.textContent = G.call.shape === 'straight' ? `AXIS ±${d.straight}°` : G.call.shape === 'any' ? '' : `CURVE ${d.curve}°+`;
  HB.height.textContent = H.HEIGHT_NAMES[G.call.height];
  const hl = H.heightLine(G.call.height, T, d);
  HB.heightLine.textContent = hl ? `APEX ${G.call.height === 'high' ? '≥' : '≤'} ${Math.round(hl / FT)} FT` : '';
  HB.status.textContent = p.cpu && G.role === 'set' ? `${p.name} is calling…` : G.role === 'set' ? (canEdit() ? `${p.name}: call your shot` : `${p.name} calls it`) : `${p.name}: match ${setterName()}`;
  const ps = kit.players;
  HB.players.className = 'hb-players' + (ps.length < 2 ? ' one' : ps.length > 2 ? ' many' : '');
  HB.players.innerHTML = ps.map((q, i) => `<div class="hb-p ${i === kit.current ? 'cur' : ''} ${i === G.setter ? 'set' : ''} ${H.isOut(q.letters || 0, G.word) ? 'out' : ''}" data-p="${i}"><span class="nm">${esc(q.name)}</span><span class="lt">${[...G.word].map((ch, k) => `<i class="${k < (q.letters || 0) ? 'on' : ''}">${ch}</i>`).join('')}</span></div>`).join('');
  world.setBoard({
    yd: T.yd, color: T.color, shape: H.SHAPE_NAMES[G.call.shape], height: H.HEIGHT_NAMES[G.call.height],
    status: G.role === 'set' ? `${p.name} calls it` : `match ${setterName()}`,
    rows: ps.map((q, i) => ({ name: q.name, letters: q.letters || 0, word: G.word, cur: i === kit.current })),
  });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function stampLetter(i) { const el = [...HB.players.querySelectorAll(`[data-p="${i}"] .lt i.on`)].pop(); if (el) el.classList.add('stamp'); }

/* ===================== map: the street from above ===================== */
const mapWrap = document.createElement('div'); mapWrap.className = 'ho-map glass';
mapWrap.innerHTML = '<canvas aria-label="Street map. Tap a target to call it."></canvas>';
document.querySelector('#mg .mg-tr').appendChild(mapWrap);
const mapCv = mapWrap.querySelector('canvas');
const MAPYD = 262;
const mapK = H_ => (H_ - 12) / (MAPYD * YD);
const mapXY = (x, z, W, H_) => { const k = mapK(H_); return [W / 2 + x * k, H_ - 6 + z * k]; };
function drawMap() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = mapCv.clientWidth, Hh = mapCv.clientHeight;
  if (!W || !Hh || !kit.player) return;
  if (mapCv.width !== Math.round(W * dpr)) { mapCv.width = Math.round(W * dpr); mapCv.height = Math.round(Hh * dpr); }
  const g = mapCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
  const k = mapK(Hh);
  g.fillStyle = 'rgba(70,110,60,0.35)'; g.fillRect(0, 0, W, Hh);
  // asphalt: straight + bulb
  g.fillStyle = 'rgba(30,32,38,0.9)';
  const [sx0, sy0] = mapXY(-H.STREET.half, 6, W, Hh), [sx1, sy1] = mapXY(H.STREET.half, H.STREET.end, W, Hh);
  g.fillRect(sx0, sy1, sx1 - sx0, sy0 - sy1);
  const [bx, by] = mapXY(0, H.STREET.end, W, Hh); g.beginPath(); g.arc(bx, by, H.STREET.bulbR * k, 0, 7); g.fill();
  const d = kit.player.difficulty;
  for (const T of TARGETS) {
    const [x, y] = mapXY(T.px, T.pz, W, Hh), r = Math.max(2.5, H.ringR(T, d) * k);
    g.strokeStyle = T.color; g.lineWidth = T.i === G.call.ring ? 2.2 : 1.1; g.globalAlpha = T.i === G.call.ring ? 1 : 0.75;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
    if (T.i === G.call.ring) { g.fillStyle = T.color + '44'; g.fill(); }
    g.globalAlpha = 1;
  }
  for (const L of G.landings) { const [x, y] = mapXY(L.x, L.z, W, Hh); g.fillStyle = L.made ? '#fff3c4' : '#ff6a5a'; g.beginPath(); g.arc(x, y, 2.4, 0, 7); g.fill(); }
  if (G.track && G.track.length > 1) { g.strokeStyle = '#fff3c4'; g.lineWidth = 1.2; g.beginPath(); G.track.forEach((p, i) => { const [x, y] = mapXY(p[0], p[2], W, Hh); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  const [tx, ty] = mapXY(0, 0, W, Hh); g.fillStyle = '#fff'; g.beginPath(); g.arc(tx, ty, 2.4, 0, 7); g.fill();
  if (kit.spot) { const [sx, sy] = mapXY(kit.spot.x, kit.spot.z, W, Hh); kit.drawSpot(g, sx, sy); }
}
mapCv.addEventListener('click', e => {
  if (kit.phase !== 'aim' || kit.player.cpu) return;
  const r = mapCv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  let best = null, bd = Infinity;
  for (const T of TARGETS) { const [x, y] = mapXY(T.px, T.pz, r.width, r.height), dd = Math.hypot(x - px, y - py); if (dd < bd) { bd = dd; best = T; } }
  // on a ring: call it (when it's your call); anywhere else: the next simulated shot goes to that spot
  if (best && bd < 9 && canEdit()) { changeCall({ ring: best.i }); return; }
  const k = mapK(r.height), x = (px - r.width / 2) / k, z = (py - (r.height - 6)) / k;
  if (-z > 5) kit.mapSpot(x, z);
});
kit.on('spot', () => drawMap());
// tap a ring in the scene to call it
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || !canEdit()) return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  let best = null, bd = Infinity; const p = new THREE.Vector3();
  for (const T of TARGETS) { p.set(T.px, -TEE_H + 2, T.pz); const dd = ray.ray.distanceToPoint(p) / Math.max(1, p.length() * 0.05); if (dd < bd) { bd = dd; best = T; } }
  if (best && bd < 5) changeCall({ ring: best.i });
});

/* ===================== aiming ===================== */
const fsim = b => simulate(b, { groundAt: world.groundAt, flightOnly: true });
const solveCache = new Map();
function solveFor(call) {
  const key = `${call.ring}|${call.shape}|${call.height}`;
  if (!solveCache.has(key)) solveCache.set(key, H.solveCall(fsim, CLUBS, TARGETS[call.ring], call));
  return solveCache.get(key);
}
function renderPrompt() {
  const p = kit.player; if (!p) return;
  G.sol = solveFor(G.call); kit.suggest({ club: G.sol.club, axis: G.sol.ball.SpinAxis || 0 });
  const T = TARGETS[G.call.ring];
  const kick = p.cpu ? `${esc(p.name)} is up` : G.role === 'set' ? 'Call your shot' : `Match ${esc(setterName())}`;
  const sub = p.cpu ? (G.role === 'set' ? 'Calling a shot…' : 'Watch and learn') : G.role === 'set' ? `Make it to set it · try <b>${CLUBS[G.sol.club].id}</b>${G.sol.k < 0.97 ? ` <small>${Math.round(G.sol.k * 100)}%</small>` : ''}` : `Miss and take a letter · try <b>${CLUBS[G.sol.club].id}</b>${G.sol.k < 0.97 ? ` <small>${Math.round(G.sol.k * 100)}%</small>` : ''}`;
  kit.setPrompt(`<span class="kick">${kick}</span><span class="big" style="color:${T.color}">${esc(callText())}</span><span class="sub">${sub}</span>`);
}
function refresh() { world.setCalled(G.call.ring); renderBoard(); renderPrompt(); drawMap(); }

/* ===================== shots ===================== */
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function attempt() { return amateurMiss(G.sol.ball); } // a decent amateur attempting the call (the CPU swings this)
// simulated shots: the call's own shot, unless the tool's club / trajectory / shape / map spot says otherwise
function toolSolve(s) {
  if (s.clubAuto && s.axisAuto && s.traj === 'normal' && !s.target) return G.sol;
  const T = s.target ? { px: s.target.x, pz: s.target.z } : TARGETS[G.call.ring];
  return H.solveCall(fsim, CLUBS, T, G.call, { club: s.clubAuto ? null : s.club, traj: s.traj, axis: s.axis });
}
kit.on('hit', s => { if (G.sol) launch(amateurMiss(toolSolve(s).ball), 'Sim'); });
kit.on('ideal', s => { if (G.sol) launch({ ...toolSolve(s).ball }, 'Ideal'); });
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim' && !kit.player.cpu) launch(e.detail, 'R10'); });

function launch(ball, src) {
  kit.phase = 'flight'; renderBoard();
  const r = simulate(ball, { groundAt: world.groundAt, surfaceAt: world.surfaceAt });
  G.shot = { r, ball, src, resolved: false };
  const fl = sv.fly(r);
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
  const lp = (r.pts.find(q => q.phase !== 'flight') || r.pts[r.pts.length - 1]).p;
  G.shot.land = { x: lp[0], z: lp[2] };
  fl.onLand = () => {
    // Topgolf style: whatever ring the ball lands in lights up, called or not
    const hit = H.ringAt(lp[0], lp[2], kit.player.difficulty);
    if (hit) { world.lightRing(hit.T.i, { bull: hit.d <= H.bullR(hit.T, kit.player.difficulty) }); kit.sfx.chime(hit.T.i === G.call.ring ? 3 : 1); }
    world.markLanding(lp[0], lp[2], hit ? hit.T.color : 0xffffff);
    setTimeout(resolve, 1500);
  };
  fl.onDone = () => setTimeout(resolve, 300);
}

function resolve() {
  const S = G.shot; if (!S || S.resolved) return; S.resolved = true;
  const p = kit.player, i = kit.current, d = p.difficulty, r = S.r;
  const j = H.judge(G.call, { land: S.land, axis: S.ball.SpinAxis || 0, apex: r.apexFt * FT }, d);
  G.landings.push({ ...S.land, made: j.made });
  G.track = r.pts.filter((_, k) => k % 6 === 0).map(q => q.p);
  const val = H.callValue(G.call), curve = G.call.shape === 'draw' || G.call.shape === 'fade', tall = G.call.height !== 'any';
  if (H.swish(r.pts)) { world.swish(); kit.award(H.POINTS.swish); setTimeout(() => kit.splash('SWISH!', { gold: true, big: true, sub: 'Nothing but net' }), 900); kit.sfx.fanfare(); }
  const T = TARGETS[G.call.ring];
  if (j.made) {
    kit.award(val * (j.bull ? H.POINTS.perfect : 1));
    if (j.bull) kit.stat('bulls');
    if (curve) kit.stat('curves');
    if (tall) kit.stat('heights');
    if (T.hoop) kit.stat('hoops');
  } else if (j.landedIn === 6) kit.stat('hoops');
  if (G.role === 'set') {
    if (j.made) {
      kit.stat('calls'); G.calls++;
      kit.splash('CALLED IT!', { gold: j.bull, sub: j.bull ? 'Bullseye' : callText() });
      j.bull ? kit.sfx.perfect() : kit.sfx.chime(2);
      kit.endShot(true); showResult(j);
      G.queue = H.matchQueue(i, letters(), G.word); G.matchers = G.queue.length; G.stumped = 0;
      setTimeout(() => { G.role = 'match'; turn(G.queue[0], `match ${p.name}'s shot`); }, 2600);
    } else {
      missFeedback(j);
      kit.splash('NO GOOD', { sub: whyMissed(j) });
      kit.endShot(false); showResult(j);
      const nx = H.nextActive(i, letters(), G.word);
      setTimeout(() => { kit.toast(`The call passes to <b>${esc(kit.players[nx].name)}</b>`, 1800); G.setter = nx; G.role = 'set'; G.landings = []; world.clearMarks(); turn(nx, 'your call'); }, 2600);
    }
    return;
  }
  // matching
  if (j.made) {
    kit.stat('matches');
    kit.splash(j.bull ? 'PERFECT MATCH' : 'MATCHED', { gold: j.bull, big: j.bull });
    j.bull ? kit.sfx.perfect() : kit.sfx.chime(2);
    kit.endShot(true); showResult(j);
  } else {
    p.letters = (p.letters || 0) + 1;
    const ch = G.word[p.letters - 1], out = H.isOut(p.letters, G.word);
    missFeedback(j);
    kit.splash(ch, { big: true, sub: `${p.name}: ${G.word.slice(0, p.letters)}${out ? ' · OUT' : ''}` });
    kit.sfx.tone(140, { len: 0.5, vol: 0.3, type: 'square', slide: 0.6 }); kit.sfx.noise(0.25, 2500, 0.25);
    kit.endShot(false); showResult(j);
    kit.award(H.POINTS.stump, { to: G.setter }); kit.stat('stumps', 1, G.setter); G.stumped++;
    if (out) p.outAt = G.calls;
    renderBoard(); stampLetter(i);
    if (out) setTimeout(() => { kit.splash('OUT', { sub: `${p.name} spelled ${G.word}` }); kit.sfx.miss(); }, 1300);
  }
  G.queue.shift();
  setTimeout(() => {
    if (H.standing(letters(), G.word) <= 1) { endGame(); return; }
    if (G.queue.length) { turn(G.queue[0], `match ${setterName()}'s shot`); return; }
    if (G.matchers > 1 && G.stumped === G.matchers) { kit.stat('stumpAll', 1, G.setter); kit.toast(`<b>${esc(setterName())}</b> stumped everyone!`, 2200); }
    else if (G.matchers === 1 && G.stumped === 1) kit.stat('stumpAll', 1, G.setter);
    if (G.calls >= H.MAX_CALLS) { endGame(); return; }
    G.role = 'set'; G.landings = []; world.clearMarks();
    turn(G.setter, 'made it · call again');
  }, j.made ? 2200 : 3000);
}
const letters = () => kit.players.map(q => q.letters || 0);
function whyMissed(j) {
  if (!j.inRing) return j.missYd < 10 ? `${j.missYd.toFixed(1)} yd ${j.dir}` : `${Math.round(j.missYd)} yd ${j.dir}`;
  if (!j.shapeOk) return `${H.SHAPE_NAMES[j.shape]}, not ${H.SHAPE_NAMES[G.call.shape].toLowerCase()}`;
  if (!j.heightOk) return G.call.height === 'high' ? 'Not high enough' : 'Not low enough';
  return '';
}
function missFeedback(j) {
  if (!j.inRing && j.missYd < 4) kit.soClose(Math.max(0.1, j.missYd), j.dir);
  else if (j.inRing) kit.toast(`Right ring · ${whyMissed(j).toLowerCase()}`, 2000);
}
function showResult(j) {
  const S = G.shot, r = S.r, p = kit.player, T = TARGETS[G.call.ring], pts = p.shotPts;
  const tick = ok => (ok ? '<b class="ok">✓</b>' : '<b class="no">✗</b>');
  const landed = j.landedIn >= 0 ? TARGETS[j.landedIn] : null;
  const rows = [
    `<span>${tick(j.inRing)} ${j.inRing ? `In the ${T.hoop ? 'Hoop' : T.yd}${j.bull ? ' · <b>bullseye</b>' : ''}` : landed ? `In the ${landed.hoop ? 'Hoop' : landed.yd}, not the ${T.hoop ? 'Hoop' : T.yd}` : `${j.missYd < 10 ? j.missYd.toFixed(1) : Math.round(j.missYd)} yd ${j.dir}`}</span>`,
  ];
  if (G.call.shape !== 'any') rows.push(`<span>${tick(j.shapeOk)} ${H.SHAPE_NAMES[j.shape]} <small>${(S.ball.SpinAxis || 0) > 0 ? '+' : ''}${(S.ball.SpinAxis || 0).toFixed(1)}° axis</small></span>`);
  if (G.call.height !== 'any') rows.push(`<span>${tick(j.heightOk)} Apex ${Math.round(r.apexFt)} ft <small>need ${G.call.height === 'high' ? '≥' : '≤'} ${Math.round(H.heightLine(G.call.height, T, p.difficulty) / FT)}</small></span>`);
  kit.showResult(`
    <div class="top"><span class="lbl">${esc(p.name)} · ${S.src}</span><span class="pts ${pts ? '' : 'zero'}">${pts ? '+' + pts : '0'}</span></div>
    <div class="items">${rows.join('')}</div>
    <div class="meta"><span><b>${Math.round(Math.hypot(S.land.x, S.land.z) / YD)}</b> yd carry</span><span><b>${Math.round(r.apexFt)}</b> ft apex</span></div>`);
}

/* ===================== turn flow ===================== */
let cpuT = [];
function turn(i, sub) { kit.turnTo(i, { sub }); }
kit.on('turn', ({ player: p }) => {
  cpuT.forEach(clearTimeout); cpuT = [];
  sv.address(false); G.track = null;
  world.setRings(p.difficulty);
  kit.setShotLabel(G.role === 'set' ? (p.cpu ? 'Calling' : 'Your call') : `Matching ${setterName()}`);
  refresh();
  if (!p.cpu) return;
  // the computer: calls something, thinks about it, swings like a decent amateur
  if (G.role === 'set') cpuT.push(setTimeout(() => { G.call = H.cpuCall(); kit.sfx.tick(); hb.classList.remove('flip'); void hb.offsetWidth; hb.classList.add('flip'); refresh(); kit.toast(`<b>${esc(p.name)}</b> calls ${esc(callText())}`, 2200); }, 1300));
  cpuT.push(setTimeout(() => { if (kit.player === p && kit.phase === 'cpu') launch(attempt(), 'CPU'); }, G.role === 'set' ? 3600 : 2200));
});
kit.on('start', ({ players, options }) => {
  G.word = H.WORDS[options.word] || 'HORSE';
  players.forEach(q => { q.letters = 0; q.outAt = undefined; });
  Object.assign(G, { setter: 0, role: 'set', call: { ring: 3, shape: 'any', height: 'any' }, queue: [], matchers: 0, stumped: 0, calls: 0, landings: [], track: null });
  world.clearMarks(); hb.hidden = false;
  turn(0, 'you call the first shot');
});
function endGame() {
  const ps = kit.players, standingNow = ps.map((q, i) => ({ q, i })).filter(o => !H.isOut(o.q.letters || 0, G.word));
  const win = standingNow.sort((a, b) => (a.q.letters || 0) - (b.q.letters || 0) || b.q.score - a.q.score)[0];
  if (win && !(win.q.letters)) kit.stat('cleanWin', 1, win.i);
  cpuT.forEach(clearTimeout); hb.hidden = true;
  kit.finishGame();
}
kit.on('end', () => { hb.hidden = true; });

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0, mapT = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); drawMap(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

function step(dt) {
  clock += dt;
  world.animate(clock, dt);
  sv.update(dt);
  if (sv.flight && !sv.flight.done) { mapT -= dt; if (mapT <= 0) { mapT = 1 / 12; G.track = sv.flight.pts.slice(0, Math.max(2, sv.flight.pts.findIndex(q => q.t > sv.flight.t))).filter((_, k) => k % 6 === 0).map(q => q.p); drawMap(); } }
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__horse = G; window.__kit = kit; window.__world = world;

resize();
sv.address(false);
world.setRings(H.DIFFICULTIES[0]); world.setCalled(3);
world.setBoard({ yd: 150, color: TARGETS[3].color, shape: 'Any', height: 'Any', status: 'Golf HORSE', rows: [] });
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
