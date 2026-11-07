// The Practice Ground: the range and the coach, on one floodlit night campus.
import { simulate, airDensity, DEFAULT_COEF } from '../physics.js';
import { createSimTool } from '../sim-tool.js';
import { toolBall, landOf, bearingOf, turnBall, turnPts, aimTurn } from '../minigames/aim.js';
import { createAimLine } from '../aim-line.js';
import { launchMonitor, mountLaunchMonitorUI, parseShot } from '../launch-monitor.js';
import { STANCE, stanceView } from '../stance.js';
import { CLUB_DELIVERY, deliveryFromBall, renderShotDetail } from './shot-detail.js';
import { CLUBS } from '../world/clubs.js';
import { createPracticeGround } from '../world/practice-ground.js';
import { FAULTS, applyFault } from '../coach/faults.js';
import { createCoachUI } from './coach-ui.js';
import { recordDrive } from '../drives.js';

THREE.ColorManagement.legacyMode = false; // hex colours below are sRGB
/* ===================== world (shared with the mini games) ===================== */
const stage = document.getElementById('stage');
// one night campus, a station per mode (the tee line, the Swing Lab, the short-game tee)
const world = createPracticeGround(stage);
window.__world = world; // test hook
const { renderer, scene, camera, sun, sunDir, groundAt, surfaceAt, flags, signs, coarse } = world;
function setSun(key) { world.setSun(key); state.sunKey = key; }

/* ---------- ball, tee, shadow, tracers, markers ---------- */
const BALL_RADIUS = 0.02135;
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 0.9 }));
ball.castShadow = true; scene.add(ball);
const teePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0025, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.5 }));
scene.add(teePeg);
const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);

const ringGeo = new THREE.RingGeometry(0.85, 1, 40); ringGeo.rotateX(-Math.PI / 2);
const landRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf1eee3, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
const restDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf5c542, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
landRing.visible = restDisc.visible = false; scene.add(landRing, restDisc);

/* ---------- shot tracers ---------- */
// Every shot leaves a tracer. The newest is bright; older ones fade back but stay on screen
// so you can read dispersion the way a Toptracer bay shows it.
const TRACERS = ['#ff5a36', '#f5c542', '#7fd3ff', '#f1eee3', 'club'];
const CLUB_COLORS = ['#ff6b4a', '#ff9f43', '#ffd36e', '#c5e478', '#7fe0b0', '#7fd3ff', '#9fa8ff', '#e09cff'];
const tracers = []; // newest first: { core, glow, club, apex }
const PR = () => renderer.getPixelRatio(); // line widths are in device pixels
const tracerColor = club => state.tracer === 'club' ? CLUB_COLORS[club] : state.tracer;
function makeTracer(club) {
  const mk = (w, o) => { const mat = new THREE.LineMaterial({ color: new THREE.Color(tracerColor(club)), linewidth: w, transparent: true, opacity: o, depthWrite: false, toneMapped: false }); const l = new THREE.Line2(new THREE.LineGeometry(), mat); l.frustumCulled = false; l.renderOrder = 2; l.visible = false; scene.add(l); return l; };
  const t = { core: mk(2.6 * PR(), 1), glow: mk(7 * PR(), 0.3), club };
  tracers.unshift(t);
  trimTracers();
  resizeLines();
  return t;
}
function disposeTracer(t) { for (const l of [t.core, t.glow]) { scene.remove(l); l.geometry.dispose(); l.material.dispose(); } }
function trimTracers() {
  while (tracers.length > state.tracerKeep) disposeTracer(tracers.pop());
  tracers.forEach((tr, i) => {
    const f = i === 0 ? 1 : Math.max(0.16, 0.6 * (1 - i / Math.max(2, state.tracerKeep)));
    tr.core.material.opacity = f; tr.glow.material.opacity = (i === 0 ? 0.3 : 0.12) * f;
    tr.core.material.linewidth = (i === 0 ? 2.6 : 1.8) * PR(); tr.glow.material.linewidth = (i === 0 ? 7 : 4) * PR();
  });
}
function clearTracers() { while (tracers.length) disposeTracer(tracers.pop()); apexDot.visible = false; $('tagApex').hidden = true; }
function recolorTracers() { tracers.forEach(t => { const c = tracerColor(t.club); t.core.material.color.set(c); t.glow.material.color.set(c); }); }
// Three.js caches a line's segment count the first time it draws it, so a tracer that grows
// every frame would stay frozen at its first few points. Clear the cache after each update.
function setLinePositions(line, arr) { line.geometry.setPositions(arr); line.geometry._maxInstanceCount = undefined; }
function setTracerPts(t, arr) { if (arr.length < 6) return; setLinePositions(t.core, arr); setLinePositions(t.glow, arr); t.core.visible = t.glow.visible = true; }
function resizeLines() { const w = renderer.domElement.width, h = renderer.domElement.height; for (const t of tracers) { t.core.material.resolution.set(w, h); t.glow.material.resolution.set(w, h); } }
const apexDot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
apexDot.visible = false; apexDot.renderOrder = 3; scene.add(apexDot);

/* ===================== state ===================== */
const state = {
  club: 4, shotData: null, variance: true, tempF: 72, altFt: 1430, lift: 1, drag: 1,
  camMode: 'tracer', sunKey: 'golden', tracer: TRACERS[1], tracerKeep: 10, sound: true, pending: null,
  flight: null, t: 0, phase: 'idle', restTimer: 0, shots: [], seq: 0,
};
function loadClub(i) { const c = CLUBS[i]; state.club = i; state.custom = false; state.shotData = { Speed: c.Speed, VLA: c.VLA, HLA: 0, TotalSpin: c.TotalSpin, SpinAxis: 0 }; syncSliders(); renderClubs(); placeBallAtAddress(); launchMonitor.setPlayer({ club: c.id }); if (typeof refreshAim === 'function') refreshAim(); }

/* ===================== UI ===================== */
const $ = id => document.getElementById(id);
function renderClubs() {
  $('vClub').textContent = CLUBS[state.club].name;
  if (tool) { tool.suggest({ club: state.club }); tool.setClub(state.club); customNote.hidden = !state.custom; }
}
// The simulated-shot tool: club, Normal / Punch / Stinger, a shape line, Ideal (exact) and Hit
// (natural misses). Moving an exact-number slider in Settings overrides it until you pick a club.
const customNote = document.createElement('p'); customNote.className = 'st-note'; customNote.hidden = true;
customNote.innerHTML = 'Using your exact numbers from Settings. <a href="#" style="color:var(--flag)">Back to club averages</a>';
customNote.querySelector('a').onclick = e => { e.preventDefault(); loadClub(state.club); };
const tool = createSimTool($('hitbar'), {
  clubs: CLUBS, auto: false, autoDistance: false, extra: customNote, faults: FAULTS,
  onChange: s => { if (state.phase === 'idle' && s.club !== state.club) loadClub(s.club); refreshAim(); },
  onShot: s => { if (s.club !== state.club && state.phase === 'idle') loadClub(s.club); swing(s); },
});
const SL = [
  ['sSpeed', 'oSpeed', v => v.toFixed(1) + ' mph', 'Speed'], ['sVla', 'oVla', v => v.toFixed(1) + '°', 'VLA'],
  ['sHla', 'oHla', v => Math.abs(v).toFixed(1) + '° ' + (v < 0 ? 'L' : v > 0 ? 'R' : ''), 'HLA'],
  ['sSpin', 'oSpin', v => Math.round(v).toLocaleString() + ' rpm', 'TotalSpin'], ['sAxis', 'oAxis', v => Math.abs(v).toFixed(1) + '° ' + (v < 0 ? 'L' : v > 0 ? 'R' : ''), 'SpinAxis'],
];
function syncSliders() { for (const [s, o, f, k] of SL) { $(s).value = state.shotData[k]; $(o).textContent = f(+state.shotData[k]); } }
for (const [s, o, f, k] of SL) $(s).addEventListener('input', e => { state.shotData[k] = +e.target.value; $(o).textContent = f(+e.target.value); state.custom = true; customNote.hidden = false; refreshAim(); });
const envFmt = () => {
  $('oTemp').textContent = state.tempF + '°F'; $('oAlt').textContent = state.altFt.toLocaleString() + ' ft';
  const rho = airDensity(state.tempF, state.altFt); $('oRho').textContent = `Air density ${rho.toFixed(3)} kg/m³, ${((1 - rho / 1.2041) * 100).toFixed(1)}% thinner than sea level at 68°F.`;
  $('oLift').textContent = '×' + state.lift.toFixed(2); $('oDrag').textContent = '×' + state.drag.toFixed(2);
};
for (const [s, k] of [['sTemp', 'tempF'], ['sAlt', 'altFt'], ['sLift', 'lift'], ['sDrag', 'drag']]) { $(s).value = state[k]; $(s).addEventListener('input', e => { state[k] = +e.target.value; envFmt(); refreshAim(); }); }
$('btnReset').onclick = () => loadClub(state.club);
document.querySelectorAll('[data-sun]').forEach(b => b.onclick = () => { setSun(b.dataset.sun); document.querySelectorAll('[data-sun]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
TRACERS.forEach(c => {
  const b = document.createElement('button'); b.className = 'sw';
  b.style.background = c === 'club' ? `conic-gradient(${CLUB_COLORS.join(',')})` : c;
  b.setAttribute('aria-label', c === 'club' ? 'Colour tracers by club' : 'Tracer colour'); b.title = c === 'club' ? 'Colour by club' : '';
  b.setAttribute('aria-pressed', String(c === state.tracer));
  b.onclick = () => { state.tracer = c; recolorTracers(); [...$('tracerSw').children].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  $('tracerSw').appendChild(b);
});
$('sKeep').value = state.tracerKeep;
$('sKeep').addEventListener('change', e => { state.tracerKeep = +e.target.value; trimTracers(); });
for (const id of ['btnClear', 'btnClear2']) $(id).onclick = () => { clearTracers(); toast('Tracers cleared'); };
$('sound').onclick = e => { state.sound = !state.sound; e.currentTarget.setAttribute('aria-pressed', String(state.sound)); if (audio.ctx) audio.amb.gain.setTargetAtTime(state.sound ? 0.022 : 0, audio.ctx.currentTime, 0.3); };
function togglePanel(id) {
  const other = id === 'adjust' ? 'session' : 'adjust';
  const p = $(id), open = p.hidden;
  if (open) closeDetail();
  $(other).hidden = true; $('btn' + other[0].toUpperCase() + other.slice(1)).setAttribute('aria-expanded', 'false');
  p.hidden = !open; $('btn' + id[0].toUpperCase() + id.slice(1)).setAttribute('aria-expanded', String(open));
  if (open && id === 'session') requestAnimationFrame(drawSession);
}
$('btnAdjust').onclick = () => togglePanel('adjust');
$('btnSession').onclick = () => togglePanel('session');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => togglePanel(b.dataset.close));
// tapping the range closes an open sheet; tapping the readout shows the extra numbers
renderer.domElement.addEventListener('pointerdown', () => { for (const id of ['adjust', 'session']) if (!$(id).hidden) togglePanel(id); closeDetail(); });
$('readout').addEventListener('click', () => ($('detail').hidden ? openDetail() : closeDetail()));
// portrait nudge (phones only; dismissible)
const portraitPhone = matchMedia('(orientation: portrait) and (pointer: coarse)');
let rotateDismissed = false;
const syncRotate = () => { $('rotate').hidden = rotateDismissed || !portraitPhone.matches; };
portraitPhone.addEventListener?.('change', syncRotate); syncRotate();
$('rotateOk').onclick = () => { rotateDismissed = true; syncRotate(); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.key === 'h' || e.key === 'H') { e.preventDefault(); tool.shoot(false); }
  else if (/^[1-8]$/.test(e.key) && state.phase === 'idle') loadClub(+e.key - 1);
  else if (e.key === 'x' || e.key === 'X') clearTracers();
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && state.phase === 'idle' && !state.custom) { e.preventDefault(); takeAim(); aim.yaw = clampYaw(aim.yaw + (e.key === 'ArrowLeft' ? -0.5 : 0.5)); drawAim(); }
});
let toastT = 0; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

const yd = v => Math.round(v);
function lr(v, unit = '') { const a = Math.abs(v); if (a < 0.5) return '0' + unit; return `${a.toFixed(a < 10 ? 1 : 0)}${unit} <span class="${v < 0 ? 'L' : 'R'}">${v < 0 ? 'L' : 'R'}</span>`; }
// Standard readout: the numbers you glance at after every swing. Tap it for the full detail.
function showReadout(r, shot, partial) {
  const c = shot.Club, measured = c && +c.Speed > 0;
  const clubSpd = measured ? +c.Speed : shot.Speed / CLUB_DELIVERY[CLUBS[state.club].id].smash;
  $('vCarry').innerHTML = (partial ? '—' : yd(r.carry)) + '<small>yd</small>';
  $('vSrc').textContent = state.flight && state.flight.live ? 'R10' : 'Sim';
  $('vTotal').innerHTML = partial ? '—' : yd(r.totalDown) + '<small>yd</small>';
  $('vOff').innerHTML = partial ? '—' : lr(r.offline);
  $('vSpd').innerHTML = shot.Speed.toFixed(1) + '<small>mph</small>';
  $('vClubSpd').innerHTML = (measured ? '' : '≈') + clubSpd.toFixed(1) + '<small>mph</small>';
  $('vVla').innerHTML = shot.VLA.toFixed(1) + '<small>°</small>';
  $('vSpin').innerHTML = Math.round(shot.TotalSpin).toLocaleString() + '<small>rpm</small>';
}

/* ---------- shot detail sheet ---------- */
let detailIdx = -1; // index into state.shots, -1 = latest
function showDetail(i = detailIdx) {
  const n = state.shots.length;
  if (!n) { $('detailBody').innerHTML = '<p class="empty">Hit a shot to see its club, launch and spin numbers.</p>'; $('dTitle').textContent = 'Shot detail'; $('dPrev').disabled = $('dNext').disabled = true; return; }
  const idx = i < 0 || i >= n ? n - 1 : i; detailIdx = idx === n - 1 ? -1 : idx;
  const rec = state.shots[idx];
  $('dTitle').textContent = `Shot ${rec.n} of ${state.shots[n - 1].n}`;
  $('detailBody').innerHTML = renderShotDetail(rec, CLUBS[rec.club].name, CLUBS[rec.club].id);
  $('dPrev').disabled = idx === 0; $('dNext').disabled = idx === n - 1;
}
function openDetail(i) {
  for (const id of ['adjust', 'session']) if (!$(id).hidden) togglePanel(id);
  detailIdx = i ?? -1; $('detail').hidden = false; showDetail();
}
function closeDetail() { $('detail').hidden = true; }
$('shotList').addEventListener('click', e => { const b = e.target.closest('.shot'); if (b) openDetail(+b.dataset.i); });
$('dPrev').onclick = () => { const n = state.shots.length; showDetail((detailIdx < 0 ? n - 1 : detailIdx) - 1); };
$('dNext').onclick = () => { const n = state.shots.length; showDetail((detailIdx < 0 ? n - 1 : detailIdx) + 1); };
document.querySelector('[data-close="detail"]').onclick = closeDetail;

/* ---------- session panel ---------- */
function drawSession() {
  // Size the canvas to its box; draw downrange to the right when the box is wide (landscape).
  const cv = $('disp'), dpr = Math.min(devicePixelRatio || 1, 2);
  const cw = Math.max(120, cv.clientWidth), ch = Math.max(120, cv.clientHeight);
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
  const wide = cw > ch * 1.1;
  const maxYd = Math.max(140, ...state.shots.map(s => s.r.totalDown)) + 25;
  const maxLat = Math.max(20, ...state.shots.map(s => Math.abs(s.r.offline)), ...state.shots.map(s => Math.abs(s.r.carryOffline))) * 1.25;
  const pad = 14, along = (wide ? cw : ch) - pad * 2 - 30, across = (wide ? ch : cw) - pad * 2;
  const k = along / maxYd, kl = Math.min(k * 2, across / 2 / maxLat); // lateral can be stretched up to 2x so spread reads
  const P = (d, l) => wide ? [pad + 22 + d * k, ch / 2 + l * kl] : [cw / 2 + l * kl, ch - pad - 22 - d * k];
  g.font = '500 12px "Saira Semi Condensed", "Arial Narrow", sans-serif';
  for (let d = 50; d < maxYd; d += 50) {
    const [x0, y0] = P(d, -maxLat), [x1, y1] = P(d, maxLat);
    g.strokeStyle = 'rgba(214,226,205,0.13)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.fillStyle = 'rgba(163,181,156,0.85)'; g.textAlign = wide ? 'center' : 'left';
    if (wide) g.fillText(d + ' yd', x0, ch - 4); else g.fillText(d + ' yd', 4, y0 - 4);
  }
  const [ax, ay] = P(0, 0), [tx, ty] = P(maxYd, 0);
  g.strokeStyle = 'rgba(245,197,66,0.5)'; g.setLineDash([5, 7]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#f1eee3'; g.beginPath(); g.arc(ax, ay, 3, 0, 7); g.fill();
  state.shots.forEach((s, i) => {
    const last = i === state.shots.length - 1;
    const [x, y] = P(s.r.totalDown, s.r.offline), [lx, ly] = P(s.r.carry, s.r.carryOffline);
    g.strokeStyle = 'rgba(241,238,227,0.2)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke();
    g.fillStyle = CLUB_COLORS[s.club]; g.globalAlpha = last ? 1 : 0.8; g.beginPath(); g.arc(x, y, last ? 5.5 : 4, 0, 7); g.fill(); g.globalAlpha = 1;
    if (last) { g.strokeStyle = '#f1eee3'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8.5, 0, 7); g.stroke(); }
  });
  g.fillStyle = 'rgba(163,181,156,0.85)'; g.textAlign = 'right';
  if (kl / k > 1.05) g.fillText(`lateral ×${(kl / k).toFixed(1)}`, cw - 6, 14);
  if (!state.shots.length) { g.textAlign = 'center'; g.fillStyle = 'rgba(241,238,227,0.7)'; g.font = '500 14px "Hanken Grotesk", sans-serif'; g.fillText('Hit a few shots to see your dispersion', cw / 2, ch / 2 - 18); }
  // gapping
  const by = {};
  state.shots.forEach(s => { (by[s.club] ||= []).push(s.r); });
  const keys = Object.keys(by).map(Number).sort((a, b) => a - b);
  $('gapping').innerHTML = keys.length ? `<table class="gap"><thead><tr><th>Club</th><th>Shots</th><th>Carry</th><th>Total</th><th>Spread</th></tr></thead><tbody>${keys.map(c => { const a = by[c], m = f => a.reduce((s, r) => s + f(r), 0) / a.length; const off = a.map(r => r.offline); const spread = a.length > 1 ? Math.max(...off) - Math.min(...off) : 0; return `<tr><td>${CLUBS[c].id}</td><td>${a.length}</td><td>${yd(m(r => r.carry))}</td><td>${yd(m(r => r.totalDown))}</td><td>${a.length > 1 ? yd(spread) : '—'}</td></tr>`; }).join('')}</tbody></table>` : '<p class="empty">Hit a few shots to build your gapping.</p>';
  $('shotList').innerHTML = state.shots.length ? state.shots.map((s, i) => [s, i]).reverse().slice(0, 30).map(([s, i]) => `<button class="shot" data-i="${i}" title="Shot detail"><span class="n">#${s.n}</span><span class="c">${CLUBS[s.club].id}</span><span>${yd(s.r.carry)} <span class="n">carry</span></span><span>${yd(s.r.totalDown)}</span><span>${lr(s.r.offline)}</span></button>`).join('') : '';
}

/* ===================== audio ===================== */
const audio = { ctx: null };
// a live shot can arrive before any tap; browsers only let audio start after one
addEventListener('pointerdown', () => { if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume(); }, { passive: true });
function initAudio() {
  if (audio.ctx) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); audio.ctx = ctx;
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const amb = ctx.createGain(); amb.gain.value = 0; src.connect(lp).connect(amb).connect(ctx.destination); src.start();
    amb.gain.setTargetAtTime(state.sound ? 0.022 : 0, ctx.currentTime, 0.8);
    audio.amb = amb; audio.noise = buf;
  } catch (e) { audio.ctx = null; }
}
function strikeSound(club, quality) {
  const ctx = audio.ctx; if (!ctx || !state.sound) return;
  const t = ctx.currentTime, wood = CLUBS[club].tee;
  const n = ctx.createBufferSource(); n.buffer = audio.noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = wood ? 3600 : 2600; bp.Q.value = wood ? 1.4 : 0.9;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.8 * quality, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + (wood ? 0.16 : 0.09));
  n.connect(bp).connect(hp).connect(g).connect(ctx.destination); n.start(t, Math.random()); n.stop(t + 0.25);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(wood ? 1650 : 980, t); o.frequency.exponentialRampToValueAtTime(wood ? 900 : 380, t + 0.06);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(wood ? 0.5 : 0.65, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + (wood ? 0.22 : 0.08));
  o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
}
function thudSound(gain) {
  const ctx = audio.ctx; if (!ctx || !state.sound || gain < 0.02) return;
  const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = audio.noise;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * 2.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  n.connect(lp).connect(g).connect(ctx.destination); n.start(t, Math.random()); n.stop(t + 0.2);
}

/* ===================== shots ===================== */
function gauss(R = Math.random) { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// Simulated club delivery to go with a simulated ball (tour smash and attack angle per club).
function simClub(ball, face, path, smashMul = 1) {
  const def = CLUB_DELIVERY[CLUBS[state.club].id];
  const clubSpeed = ball.Speed / (def.smash * smashMul);
  return { Speed: clubSpeed, Path: path, FaceToTarget: face, AngleOfAttack: def.aoa + (state.variance ? gauss() * 1.1 : 0) };
}
function realSwing(base, variance = true) {
  state.variance = variance;
  if (!variance) { const s = { ...base }; const d = deliveryFromBall(s); s.Club = simClub(s, d.face, d.path); return s; }
  const s = { ...base };
  const strike = Math.random();
  const face = gauss() * 1.9, path = gauss() * 2.4;
  s.HLA = base.HLA + face * 0.8 + path * 0.2;
  s.SpinAxis = base.SpinAxis + (face - path) * 1.9 + gauss() * 1.5;
  s.Speed = base.Speed * (1 + gauss() * 0.012);
  s.VLA = base.VLA + gauss() * 0.9;
  s.TotalSpin = base.TotalSpin * (1 + gauss() * 0.07);
  let smashMul = 1 + gauss() * 0.006;
  if (strike < 0.08) { s.Speed *= 0.93; s.VLA -= 2.5; s.TotalSpin *= 0.78; smashMul = 0.93; }          // thin
  else if (strike < 0.13) { s.Speed *= 0.9; s.VLA += 2; s.TotalSpin *= 1.15; smashMul = 0.9; }        // heavy
  s.Club = simClub({ Speed: s.Speed / smashMul }, base.HLA + face, base.HLA + path, 1); // same club speed, worse strike
  s.Club.Speed = base.Speed / CLUB_DELIVERY[CLUBS[state.club].id].smash * (1 + gauss() * 0.01);
  return s;
}
function placeBallAtAddress() {
  const tee = CLUBS[state.club].tee;
  teePeg.visible = tee;
  teePeg.position.set(0, 0.03 + 0.025 * (tee ? 1 : 0), 0);
  ball.position.set(0, (tee ? 0.045 : 0.03) + BALL_RADIUS, 0);
  addrBall.copy(ball.position);
  ball.scale.setScalar(1); ball.visible = true;
}

// Real shots from the R10 (via the bridge) arrive here. A shot that lands while the last
// one is still in the air waits its turn.
function receiveShot(shot) {
  initAudio();
  if (state.phase === 'idle') launch(shot, true); else state.pending = shot;
}
launchMonitor.addEventListener('shot', e => receiveShot(e.detail));
mountLaunchMonitorUI({ dot: $('lmDot'), text: $('lmText'), button: $('lmBtn') });
window.PracticeGround = window.WoodsonRange = { receiveShot: msg => { const shot = parseShot(msg); if (shot) receiveShot(shot); } };

// the ball for a simulated shot: your exact numbers, or the club's average at the tool's swing
// length with its trajectory and shape (started out so the curve comes back toward the target line)
function toolBase(s) {
  if (state.custom) return { ...state.shotData };
  return toolBall(CLUBS[state.club], s.pct / 100, -s.axis * 0.37, s);
}
// a swing fault (coaching practice without an R10) bends the shot after the natural misses
function swing(s = { ...tool.settings, ideal: false }) { if (state.phase !== 'idle') return; initAudio(); launch(applyFault(realSwing(aimedBase(s).ball, !s.ideal), s.fault, CLUBS[state.club].id), false); }

/* ---------- the phantom aim line (src/aim-line.js) ---------- */
// The next simulated shot's flight, dashed. Drag it left or right in the view to aim (that turns
// auto-aim off); with auto-aim on it lands on the centre line. Your exact numbers from Settings
// fly as they are.
const rangeSim = b => simulate(b, { tempF: state.tempF, altFt: state.altFt, coef: { clScale: state.lift, cd0: DEFAULT_COEF.cd0 * state.drag, cdS: DEFAULT_COEF.cdS * state.drag, cdLow: DEFAULT_COEF.cdLow * state.drag }, surfaceAt, groundAt });
const aimLine = createAimLine(world);
const aim = { yaw: 0, base: null, turned: null, t: 0 };
const clampYaw = v => Math.max(-45, Math.min(45, v));
function aimBaseFor(s) {
  const b = toolBase(s), key = [b.Speed, b.VLA, b.HLA, b.TotalSpin, b.SpinAxis, state.tempF, state.altFt, state.lift, state.drag].map(v => (+v || 0).toFixed(3)).join(',');
  if (!aim.base || aim.base.key !== key) { const r = rangeSim(b), l = landOf(r); aim.base = { key, ball: b, r, b0: bearingOf(l[0], l[2]) }; }
  return aim.base;
}
function aimedBase(s) {
  const B = aimBaseFor(s), dd = state.custom ? 0 : aimTurn(B.b0, { autoAim: s.autoAim, yawDeg: aim.yaw, targetDeg: 0 });
  return { B, dd, ball: dd ? turnBall(B.ball, dd) : { ...B.ball } };
}
function takeAim() { if (tool.autoAim) { aim.yaw = 0; tool.setAutoAim(false); } }
function drawAim(fast = false) {
  if (state.phase !== 'idle') { aimLine.hide(); return; }
  const s = tool.settings, { B, dd, ball: b } = aimedBase(s);
  let pts = B.r.pts;
  if (Math.abs(dd) >= 0.01) {
    if (fast) pts = turnPts(B.r.pts, dd);
    else { const k = `${B.key}|${dd.toFixed(2)}`; if (!aim.turned || aim.turned.k !== k) aim.turned = { k, pts: rangeSim(b).pts }; pts = aim.turned.pts; }
  }
  const y0 = ball.position.y, li = pts.findIndex(q => q.phase !== 'flight'), end = li < 0 ? pts.length - 1 : li, arr = [];
  for (let i = 0; i < end; i += 2) { const q = pts[i]; arr.push(q.p[0], q.p[1] + y0 * Math.max(0, 1 - q.t * 4), q.p[2]); }
  arr.push(...pts[end].p);
  aimLine.show(arr, pts[end].p);
}
function refreshAim() { clearTimeout(aim.t); aim.t = setTimeout(() => drawAim(false), 0); }
{
  let y0 = 0;
  aimLine.onDrag({ enabled: () => state.phase === 'idle' && !state.custom, start: () => { takeAim(); y0 = aim.yaw; }, move: d => { aim.yaw = clampYaw(y0 + d); drawAim(true); }, end: () => drawAim() });
}

function launch(shot, live) {
  placeBallAtAddress();
  const coef = { clScale: state.lift, cd0: DEFAULT_COEF.cd0 * state.drag, cdS: DEFAULT_COEF.cdS * state.drag, cdLow: DEFAULT_COEF.cdLow * state.drag };
  const startY = ball.position.y;
  const r = simulate(shot, { tempF: state.tempF, altFt: state.altFt, coef, surfaceAt, groundAt });
  r.pts.forEach(p => p.p[1] += startY * Math.max(0, 1 - p.t * 4)); // start off the tee/mat, blend to true ground quickly
  const landIdx = r.pts.findIndex(p => p.phase !== 'flight');
  r.landIdx = landIdx < 0 ? r.pts.length - 1 : landIdx;
  const apex = r.pts.reduce((b, p, i) => p.p[1] > b.y ? { y: p.p[1], t: p.t, i } : b, { y: -1, t: 0, i: 0 });
  r.apexT = apex.t; r.apexIdx = apex.i;
  state.flight = { r, shot, live, tracer: makeTracer(state.club), bounced: 0, sampled: [], apexShown: false };
  apexDot.visible = false; $('tagApex').hidden = true;
  state.t = 0; state.phase = 'flight'; state.restTimer = 0;
  tool.setEnabled(false); aimLine.hide();
  landRing.visible = restDisc.visible = false; $('tagLand').hidden = $('tagRest').hidden = true;
  showReadout(r, shot, true);
  strikeSound(state.club, shot.Speed / CLUBS[state.club].Speed > 0.95 ? 1 : 0.7);
  camState.cut = true;
  const lp = r.pts[r.landIdx].p, d = new THREE.Vector3(lp[0], 0, lp[2]).normalize();
  camState.landCam = { at: new THREE.Vector3(lp[0], lp[1], lp[2]), dir: d, side: lp[0] > 0 ? -1 : 1 };
}

function finishShot() {
  const f = state.flight, r = f.r;
  state.seq++;
  state.shots.push({ n: state.seq, club: state.club, r, shot: f.shot, live: !!f.live });
  if (!$('detail').hidden && detailIdx < 0) showDetail();
  $('shotCount').textContent = state.shots.length === 1 ? '1 shot' : state.shots.length + ' shots';
  showReadout(r, f.shot, false);
  const end = r.pts.at(-1).p;
  restDisc.position.set(end[0], end[1] + 0.03, end[2]); restDisc.visible = true;
  $('tagRest').innerHTML = `<b>${yd(r.totalDown)}</b> total`; $('tagRest').hidden = false;
  if (!$('session').hidden) drawSession();
  if (coachUI.active) coachUI.shot(f.shot, CLUBS[state.club].id);
  if (world.showShot) world.showShot(r, f.shot);
  if (CLUBS[state.club].id === 'DR') recordDrive(r.total); // course tee suggestions
}

function samplePos(r, t, out) {
  const pts = r.pts; let lo = 0, hi = pts.length - 1;
  if (t >= pts[hi].t) { out.set(...pts[hi].p); return hi; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], f = (t - a.t) / ((b.t - a.t) || 1);
  out.set(a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f, a.p[2] + (b.p[2] - a.p[2]) * f);
  return lo;
}

/* ===================== cameras ===================== */
const camState = { pos: new THREE.Vector3(0, 1.3, 2.7), look: new THREE.Vector3(0, 6, -120), fov: 42, cut: false, landCam: null, topLook: new THREE.Vector3() };
function setCam(mode) {
  state.camMode = mode; camState.cut = true;
  document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === mode)));
}
// Standing over the ball: ball at the bottom centre of the screen (see src/stance.js).
const ADDRESS = { pos: new THREE.Vector3(0, 1.6, 3.2), look: new THREE.Vector3(0, -9, -100), fov: STANCE.fov };
const FWD = new THREE.Vector3(0, 0, -1), addrBall = new THREE.Vector3(0, 0.05, 0);
function stance() { return stanceView(addrBall, FWD, baseFov(STANCE.fov)); }
function updateAddress() { const v = stance(); ADDRESS.pos.copy(v.pos); ADDRESS.look.copy(v.look); }
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function hfovToV(hdeg) { const a = camera.aspect; return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hdeg) / 2) / a)); }
function baseFov(v) { // keep at least ~62° horizontal on portrait screens
  return Math.max(v, Math.min(78, hfovToV(62)));
}
function cameraTarget(dt) {
  const f = state.flight, mode = state.camMode, bp = ball.position;
  updateAddress();
  let pos = ADDRESS.pos.clone(), look = ADDRESS.look.clone(), fov = ADDRESS.fov, k = 2.2;
  const flying = state.phase === 'flight' || state.phase === 'rest';
  if (mode === 'tracer') {
    // fixed behind the ball: a window onto the range that doesn't follow the ball up or down
    look.copy(stance().look); k = 3;
  } else if (mode === 'top') {
    const far = Math.max(150, ...state.shots.slice(-12).map(s => s.r.totalDown * 0.9144), f ? -f.r.pts.at(-1).p[2] : 0);
    const cz = -far * 0.5;
    pos.set(0, far * 1.15 + 30, cz + 40); look.set(0, 0, cz - 5); fov = 42; k = 1.6;
  } else if (!flying || !f) {
    // address view
  } else {
    const r = f.r;
    const landT = r.pts[r.landIdx].t;
    let m = mode;
    if (mode === 'auto') m = (state.t > Math.max(r.apexT, landT * 0.62) || state.phase === 'rest') ? 'landing' : 'tee';
    if (m === 'tee') {
      const dist = Math.max(10, bp.distanceTo(ADDRESS.pos));
      look.copy(ADDRESS.look).lerp(bp, 0.6); look.y = Math.min(look.y, bp.y * 0.7);
      fov = THREE.MathUtils.clamp(2 * THREE.MathUtils.radToDeg(Math.atan(75 / dist)), 24, ADDRESS.fov);
      k = 5;
    } else if (m === 'follow') {
      const vel = tmp2.copy(bp).sub(camState.prevBall || bp); vel.y = 0;
      const dir = vel.lengthSq() > 1e-4 ? vel.normalize() : tmp2.set(0, 0, -1);
      pos.copy(bp).addScaledVector(dir, -16).add(tmp.set(0, 5.5 + bp.y * 0.12, 0));
      pos.y = Math.max(pos.y, groundAt(pos.x, pos.z) + 2);
      look.copy(bp).addScaledVector(dir, 14); fov = 48; k = 3;
    } else if (m === 'landing') {
      const L = camState.landCam;
      const side = new THREE.Vector3(-L.dir.z, 0, L.dir.x).multiplyScalar(L.side);
      pos.copy(L.at).addScaledVector(L.dir, 26).addScaledVector(side, 13);
      pos.y = groundAt(pos.x, pos.z) + 2.6;
      look.copy(bp); look.y = Math.max(bp.y, L.at.y + 0.4);
      if (state.phase === 'flight' && bp.y > L.at.y + 3) look.lerp(L.at, 0.3);
      fov = 34; k = 4;
    }
  }
  return { pos, look, fov: mode === 'top' ? fov : baseFov(fov), k };
}
function updateCamera(dt) {
  const t = cameraTarget(dt);
  const snapMode = camState.cut;
  const inLanding = state.camMode === 'auto' && state.flight && state.phase !== 'idle' && (state.t > Math.max(state.flight.r.apexT, state.flight.r.pts[state.flight.r.landIdx].t * 0.62) || state.phase === 'rest');
  if (inLanding && !camState.wasLanding) camState.cut = true; // broadcast cut to the landing camera
  camState.wasLanding = inLanding;
  const a = camState.cut ? 1 : 1 - Math.exp(-t.k * dt);
  const posA = camState.cut ? 1 : 1 - Math.exp(-(state.camMode === 'tee' || (state.camMode === 'auto' && !inLanding) ? 0 : t.k * 0.6) * dt);
  if (state.phase === 'idle' || state.camMode === 'top' || state.camMode === 'follow' || state.camMode === 'tracer') camState.pos.lerp(t.pos, camState.cut ? 1 : 1 - Math.exp(-t.k * 0.6 * dt));
  else camState.pos.lerp(t.pos, posA);
  camState.look.lerp(t.look, a);
  camState.fov += (t.fov - camState.fov) * (camState.cut ? 1 : 1 - Math.exp(-t.k * 0.8 * dt));
  camState.cut = false;
  camera.position.copy(camState.pos); camera.lookAt(camState.look);
  if (Math.abs(camera.fov - camState.fov) > 1e-3) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
  void snapMode;
}

/* ===================== frame loop ===================== */
function projectTag(el, v) {
  tmp.copy(v).project(camera);
  if (tmp.z > 1 || tmp.z < -1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible';
  el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * innerWidth}px, ${(-tmp.y * 0.5 + 0.5) * innerHeight - 8}px) translate(-50%, -100%)`;
}
let last = performance.now(), clock = 0;
const flagWind = 1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (fitToScreen() && !$('session').hidden) drawSession();
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// test hooks: step the sim; pass everyFrame=N to render every Nth step like real play
window.__advance = (sec, everyFrame) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (everyFrame && i % everyFrame === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
function step(dt) {
  clock += dt;
  const f = state.flight;
  camState.prevBall = camState.prevBall || new THREE.Vector3(); camState.prevBall.copy(ball.position);
  if (f && (state.phase === 'flight' || state.phase === 'rest')) {
    const r = f.r;
    if (state.phase === 'flight') {
      state.t += dt;
      const idx = samplePos(r, state.t, ball.position);
      // tracer: flight portion only (plus first bounce), every ~2 samples
      const upto = Math.min(idx, r.landIdx);
      const arr = f.sampled; arr.length = 0;
      for (let i = 0; i <= upto; i += 3) arr.push(r.pts[i].p[0], r.pts[i].p[1], r.pts[i].p[2]);
      if (idx <= r.landIdx) arr.push(ball.position.x, ball.position.y, ball.position.z);
      setTracerPts(f.tracer, arr);
      if (!f.apexShown && idx >= r.apexIdx && r.apexIdx > 0) {
        f.apexShown = true; const ap = r.pts[r.apexIdx].p;
        apexDot.position.set(ap[0], ap[1], ap[2]); apexDot.visible = true;
        $('tagApex').innerHTML = `<b>${Math.round(r.apexFt)}</b> ft`; $('tagApex').hidden = false; camState.apexTag = apexDot.position.clone();
      }
      if (idx >= r.landIdx && !landRing.visible) {
        const lp = r.pts[r.landIdx].p; landRing.position.set(lp[0], lp[1] + 0.03, lp[2]); landRing.visible = true; landRing.userData.t0 = clock;
        $('tagLand').innerHTML = `<b>${yd(r.carry)}</b> carry`; $('tagLand').hidden = false; camState.landTag = new THREE.Vector3(lp[0], lp[1] + 0.05, lp[2]);
        const camD = camera.position.distanceTo(ball.position); thudSound(Math.min(1, 35 / camD) * 0.6);
      }
      if (state.t >= r.pts.at(-1).t) { state.phase = 'rest'; state.restTimer = 0; finishShot(); }
    } else {
      state.restTimer += dt;
      if (state.restTimer > 3.0) {
        state.phase = 'idle'; tool.setEnabled(true); placeBallAtAddress(); refreshAim();
        $('tagLand').hidden = $('tagRest').hidden = $('tagApex').hidden = true; apexDot.visible = false;
        if (state.camMode !== 'top') camState.cut = false;
        if (state.pending) { const p = state.pending; state.pending = null; launch(p, true); }
      }
    }
  }
  // ball visibility scale: keep a ~2px minimum footprint at range
  const camD = camera.position.distanceTo(ball.position);
  const pxPerM = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camD);
  ball.scale.setScalar(Math.max(1, 1.6 / (BALL_RADIUS * 2 * pxPerM)));
  // ball shadow projected along the sun
  const gy = groundAt(ball.position.x, ball.position.z);
  const hgt = Math.max(0, ball.position.y - gy);
  ballShadow.position.set(ball.position.x - sunDir.x / sunDir.y * hgt, 0, ball.position.z - sunDir.z / sunDir.y * hgt);
  ballShadow.position.y = groundAt(ballShadow.position.x, ballShadow.position.z) + 0.012;
  const bs = BALL_RADIUS * 3.2 * ball.scale.x * (1 + hgt * 0.02);
  ballShadow.scale.set(bs, bs, 1); ballShadow.material.opacity = Math.max(0, 0.75 - hgt / 40) * (state.phase === 'idle' ? 0 : 1);
  // markers
  if (landRing.visible) { const s = THREE.MathUtils.clamp(camera.position.distanceTo(landRing.position) * 0.012, 0.6, 3.5); landRing.scale.setScalar(s * (1 + Math.max(0, 0.6 - (clock - landRing.userData.t0)) * 1.5)); }
  if (restDisc.visible) restDisc.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(restDisc.position) * 0.006, 0.25, 2.2));
  if (!$('tagLand').hidden && camState.landTag) projectTag($('tagLand'), camState.landTag);
  if (apexDot.visible) apexDot.scale.setScalar(Math.max(0.05, camera.position.distanceTo(apexDot.position) * 0.0035));
  if (!$('tagApex').hidden && camState.apexTag) projectTag($('tagApex'), camState.apexTag);
  if (!$('tagRest').hidden) projectTag($('tagRest'), tmp2.copy(restDisc.position).add(tmp.set(0, 0.2, 0)));
  // flags
  for (const fl of flags) {
    const p = fl.geometry.attributes.position, b = fl.userData.base, ph = fl.userData.phase;
    for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 9 - clock * 5.5 * flagWind + ph) * 0.07 * x + Math.sin(x * 4 + clock * 2.3 + ph) * 0.035 * x); }
    p.needsUpdate = true; fl.geometry.computeVertexNormals();
  }
  if (world.tick) world.tick(clock);
  updateCamera(dt);
  // shadow box follows what the camera is looking at
  const focus = state.phase === 'idle' && state.camMode !== 'top' ? tmp.set(0, 0, -50) : tmp.copy(camState.look).lerp(camera.position, 0.35);
  focus.y = 0;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 450);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  fitW = w; fitH = h;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); resizeLines();
  updateAddress();
}
// Fit the renderer to the screen. Phones (iOS especially) fire 'resize' on rotation before
// the new layout is measurable, so besides the events we compare the real size every frame
// and re-fit the moment it changes. That keeps the scene from staying stretched or squashed.
let fitW = 0, fitH = 0;
function fitToScreen() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h || (w === fitW && h === fitH)) return false;
  fitW = w; fitH = h; resize(); return true;
}
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);
if (window.ResizeObserver) new ResizeObserver(refit).observe(stage);
addEventListener('resize', refit);

/* ===================== practice modes: Range, Coaching, Short game ===================== */
// The range opens on the practice menu (unless the address says ?mode=…). Coaching mounts the
// coach (src/range/coach-ui.js) over the same range; Range is the free range as before.
const coachUI = createCoachUI({
  clubName: id => (CLUBS.find(c => c.id === id) || {}).name || id,
  currentClub: () => CLUBS[state.club].id,
  // a lesson that needs another club (driver, an iron) picks it up
  setClub: id => { const i = CLUBS.findIndex(c => c.id === id); if (i >= 0) { loadClub(i); if (tool) tool.setClub(i); } },
});
window.__coachUI = coachUI; // test hook
const MODE_KEY = 'vibegolf.practice';
function setMode(mode) {
  state.mode = mode;
  coachUI.setActive(mode === 'coach');
  if (world.setStation) world.setStation(mode === 'coach' ? 'lab' : mode === 'short' ? 'short' : 'tee');
  $('practice').hidden = true;
  $('btnPractice').textContent = mode === 'coach' ? 'Coaching' : 'Practice';
  document.querySelectorAll('.pr-card').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  try { localStorage.setItem(MODE_KEY, mode); { const q = new URLSearchParams(location.search); q.set('mode', mode); history.replaceState(null, '', `?${q}`); } } catch (e) { /* storage blocked */ }
}
function openPractice() {
  const s = coachUI.summary(), box = $('prSum');
  box.hidden = !s || (!s.worked.length && !s.skill);
  if (s && s.worked.length) {
    const names = s.worked.map(w => `${w.name.toLowerCase()}${w.progress != null ? ` (${Math.round(w.progress * 100)}% of the way)` : ''}`);
    box.innerHTML = `<b>This session:</b> ${s.shots} shots with the coach, worked on ${names.join(', ')}.${s.cue ? ` <b>Cue to keep:</b> ${s.cue}.` : ''}`;
  } else if (s && s.skill) box.innerHTML = '';
  if (s && s.skill) box.innerHTML += `${box.innerHTML ? ' ' : ''}<b>Learning:</b> ${s.skill.name}, ${Math.round(s.skill.meter * 100)}% to the goal${s.skill.passed ? ' (learned)' : ''}.`;
  $('practice').hidden = false;
}
document.querySelectorAll('.pr-card[data-mode]').forEach(b => { b.onclick = () => { if (!b.disabled) setMode(b.dataset.mode); }; });
$('btnPractice').onclick = openPractice;
{
  const q = new URLSearchParams(location.search).get('mode');
  if (q === 'coach' || q === 'range') setMode(q); else { setMode('range'); openPractice(); }
  // ?mode=coach&skill=shape.draw opens that lesson
  const sq = new URLSearchParams(location.search).get('skill');
  if (q === 'coach' && sq) setTimeout(() => coachUI.learn(sq), 0);
}

/* ===================== boot ===================== */
setSun('golden');
resize();
envFmt(); renderClubs(); loadClub(4);
updateAddress(); camState.pos.copy(ADDRESS.pos); camState.look.copy(ADDRESS.look); camState.fov = baseFov(ADDRESS.fov);
requestAnimationFrame(t => { last = t; frame(t); });
document.fonts && document.fonts.ready.then(() => world.refreshSigns());
