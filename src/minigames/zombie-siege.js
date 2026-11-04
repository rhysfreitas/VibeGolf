// Zombie Siege — zombies shamble toward your fence; your ball explodes where it lands.
// Rules: zombie-logic.js. HUD, turns, scoring feedback: the shared kit (survival-run mode).

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createDeadFarm } from './scenes/dead-farm.js';
import { createHorde } from './zombie-horde.js';
import { createAmbience } from './night-ambience.js';
import { createShotView } from '../world/shot-view.js';
import { CLUBS } from './shape-it-logic.js';
import {
  YD, FENCE_Z, FENCE_HP, WAVE_TIMEOUT, DIFFICULTIES, CHALLENGES, TYPES, POINTS, CRATES, LANES, CHAIN_YD,
  waveSpawns, stepZombies, active, resolveBlast, blastPoints, chooseTarget, solveShot, makeCrate, crateGrabYd, bestLane, fieldHalf,
} from './zombie-logic.js';
import { makeToolShot } from './aim.js';

const stage = document.getElementById('stage');
const world = createDeadFarm(stage);
const { renderer, scene, camera, groundAt } = world;
// stand a little taller with a slightly longer lens, so the field reads at night instead of squeezing into the horizon
const sv = createShotView(world, { tracerColor: '#ffd59a', stance: { back: 5.5, up: 2.4, ballAt: 0.95, fov: 38 } });

const kit = createKit({
  id: 'zombie-siege', title: 'Zombie Siege', accent: '#9dff5a', mode: 'run', idealShot: true, clubs: CLUBS,
  blurb: 'The horde is walking out of the corn toward your fence. Your ball explodes where it lands. Keep them off the fence as long as you can.',
  rules: [
    'Difficulty only changes your <b>blast radius</b>. Zombies always walk at the same steady pace.',
    'Land within 2 yd of a zombie for a <b>DIRECT HIT</b>: double points. <b>DOUBLE</b>, <b>TRIPLE</b> and <b>MASSACRE</b> (5+) score bonuses.',
    'Tanks take two blasts. Bloaters burst and take out anything nearby.',
    'Land near a glowing crate to grab it: <b>repair</b>, <b>freeze</b> or <b>airstrike</b>.',
    'Tap the field or the map to pick a target. Your score is kills plus time survived.',
  ],
  difficulties: DIFFICULTIES, challenges: CHALLENGES,
  summary: p => `wave ${p.stats.wave || 1} · ${p.stats.kills || 0} kills · ${fmtTime(p.stats.time || 0)}`,
});
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ===================== zombies and night sounds ===================== */
const horde = createHorde(scene, { groundAt, camera, renderer });
const amb = createAmbience(() => kit.sfx.on);
world.onThunder = d => amb.thunder(d);
world.onSpark = () => amb.crackle();

/* ===================== effects ===================== */
const sparkTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const fx = [];
function particles(at, { n = 120, colors = [0xffb040, 0xff5a20], speed = 14, up = 10, size = 1.4, life = 1.4, gravity = 14, additive = true } = {}) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [], c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    pos.set([at.x, at.y + 0.3, at.z], i * 3);
    const a = Math.random() * 6.28, sp = speed * (0.3 + Math.random());
    vel.push(new THREE.Vector3(Math.cos(a) * sp, up * (0.4 + Math.random()), Math.sin(a) * sp));
    c.setHex(colors[Math.floor(Math.random() * colors.length)]); col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive });
  const p = new THREE.Points(geo, m); p.frustumCulled = false; p.renderOrder = 5; scene.add(p);
  fx.push({ kind: 'pts', obj: p, vel, age: 0, life, gravity, size });
}
const flash = new THREE.PointLight(0xffa040, 0, 220, 1.4); scene.add(flash);
let flashT = 0, shake = 0;
const ringGeo = new THREE.RingGeometry(0.92, 1, 64).rotateX(-Math.PI / 2);
function explosion(at, radiusM, { big = true } = {}) {
  // fireball
  const fb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb050, transparent: true, depthWrite: false, toneMapped: false }));
  fb.position.copy(at); scene.add(fb); fx.push({ kind: 'ball', obj: fb, age: 0, life: 1.0, r: Math.max(4, radiusM * 0.55) });
  // a quick column of fire and smoke so the blast reads from the tee
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1, 1, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a30, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  col.geometry.translate(0, 0.5, 0); col.position.copy(at); scene.add(col); fx.push({ kind: 'col', obj: col, age: 0, life: 0.8, r: Math.max(2.5, radiusM * 0.3), h: big ? 18 : 9 });
  // shockwave ring on the ground: exactly the blast radius, so you can see what it covered
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  ring.position.set(at.x, groundAt(at.x, at.z) + 0.15, at.z); ring.renderOrder = 4; scene.add(ring); fx.push({ kind: 'ring', obj: ring, age: 0, life: 1.1, r: radiusM });
  // scorch mark
  const sc = new THREE.Mesh(new THREE.CircleGeometry(Math.max(1.5, radiusM * 0.35), 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0e0c0a, transparent: true, opacity: 0.7, depthWrite: false }));
  sc.position.set(at.x, groundAt(at.x, at.z) + 0.05, at.z); scene.add(sc); fx.push({ kind: 'scorch', obj: sc, age: 0, life: 14 });
  particles(at, { n: big ? 180 : 70, speed: Math.max(8, radiusM * 0.9), up: 14, size: big ? 2.6 : 1.4 });
  particles(at, { n: 70, colors: [0x3a2c20, 0x5a4630], speed: Math.max(6, radiusM * 0.6), up: 14, size: 1.2, life: 1.8, additive: false });
  flash.position.set(at.x, at.y + 4, at.z); flash.intensity = big ? 14 : 6; flashT = 0.5;
  world.flashFog(at, big ? 1.6 : 0.8);
  // at night a blast leaves a little fire burning for a few seconds
  world.addFire(at.x + (Math.random() - 0.5) * 2, at.z + (Math.random() - 0.5) * 2, { life: big ? 7 : 4, size: big ? 0.9 : 0.6, rate: big ? 34 : 20, glowSize: big ? 5 : 3 });
  shake = Math.max(shake, big ? 0.35 : 0.15);
  kit.sfx.boom();
}
function goo(at) { particles(at, { n: 26, colors: [0x7aff3a, 0x3ab020, 0x9aff6a], speed: 5, up: 6, size: 0.7, life: 1.1, gravity: 16 }); }
function animateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.age += dt; const u = f.age / f.life;
    if (f.kind === 'pts') {
      const p = f.obj.geometry.attributes.position, drag = Math.exp(-1.8 * dt);
      for (let k = 0; k < f.vel.length; k++) { const v = f.vel[k]; v.multiplyScalar(drag); v.y -= f.gravity * dt; let y = p.getY(k) + v.y * dt; if (y < 0.05) { y = 0.05; v.y *= -0.2; v.x *= 0.6; v.z *= 0.6; } p.setXYZ(k, p.getX(k) + v.x * dt, y, p.getZ(k) + v.z * dt); }
      p.needsUpdate = true; f.obj.material.opacity = Math.max(0, 1 - u * u); f.obj.material.size = f.size * (1 - 0.4 * u);
    } else if (f.kind === 'ball') { f.obj.scale.setScalar(f.r * (0.3 + 1.2 * Math.sqrt(Math.min(1, u * 1.6)))); f.obj.material.opacity = Math.max(0, 1 - u) * 0.9; f.obj.material.color.setHSL(0.08 - 0.06 * u, 1, 0.6 - 0.35 * u); }
    else if (f.kind === 'col') { const e = Math.min(1, u * 3); f.obj.scale.set(f.r * (0.6 + 0.6 * u), f.h * e, f.r * (0.6 + 0.6 * u)); f.obj.material.opacity = Math.max(0, 1 - u) * 0.8; }
    else if (f.kind === 'ring') { f.obj.scale.setScalar(f.r * Math.min(1, 0.2 + u * 2.2)); f.obj.material.opacity = u < 0.45 ? 0.95 : Math.max(0, 0.95 * (1 - (u - 0.45) / 0.55)); }
    else if (f.kind === 'scorch') f.obj.material.opacity = 0.7 * Math.max(0, 1 - Math.max(0, u - 0.6) / 0.4);
    if (u >= 1) { scene.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); fx.splice(i, 1); }
  }
  if (flashT > 0) { flashT -= dt; flash.intensity *= Math.exp(-7 * dt); } else flash.intensity = 0;
}

/* ===================== crates ===================== */
const CRATE_COL = { repair: 0x6dff6d, freeze: 0x6ae0ff, airstrike: 0xff5a4a };
function makeCrateObj(c) {
  const g = new THREE.Group();
  const bx = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: 0x6a5232, roughness: 0.9 }));
  bx.position.y = 0.55; bx.castShadow = true; g.add(bx);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.22, 1.44), new THREE.MeshBasicMaterial({ color: CRATE_COL[c.kind], toneMapped: false })); band.position.y = 0.6; g.add(band);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: CRATE_COL[c.kind], transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  beam.position.y = 15; g.add(beam);
  g.position.set(c.x, groundAt(c.x, c.z), c.z); scene.add(g);
  c.obj = g; c.beam = beam; return g;
}

/* ===================== state ===================== */
const G = {
  zombies: [], crates: [], wave: 0, waveT: 0, nextWaveIn: 0, hp: FENCE_HP, time: 0, running: false,
  frozen: 0, target: null, custom: null, solve: null, solveKey: '', lastBlast: null, land: null, airstrike: null, over: false,
};
let blastYd = 12;
const reticle = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, toneMapped: false }));
const reticleDot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20).rotateX(-Math.PI / 2), reticle.material.clone());
// a glowing beacon over the target, so the aim point reads from the tee at 250 yd
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
beacon.geometry.translate(0, 0.5, 0);
const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 4), new THREE.MeshBasicMaterial({ color: 0xffc860, toneMapped: false })); chevron.rotation.x = Math.PI;
reticle.renderOrder = reticleDot.renderOrder = 7; scene.add(reticle, reticleDot, beacon, chevron); reticle.visible = reticleDot.visible = beacon.visible = chevron.visible = false;

function resetRun() {
  horde.clear(); G.zombies = [];
  for (const c of G.crates) scene.remove(c.obj); G.crates = [];
  Object.assign(G, { wave: 0, waveT: 0, nextWaveIn: 2.5, hp: FENCE_HP, time: 0, running: true, frozen: 0, custom: null, lastBlast: null, land: null, airstrike: null, over: false });
  world.setFenceDamage(0); renderFence();
  blastYd = kit.player.difficulty.blastYd;
  sv.address(false);
  kit.setShotLabel('Get ready');
}
function startWave() {
  G.wave++; G.waveT = 0;
  const list = waveSpawns(G.wave);
  for (const z of list) { G.zombies.push(z); horde.add(z); }
  amb.bell();
  kit.statMax('wave', G.wave);
  kit.splash(`WAVE ${G.wave}`, { sub: G.wave % 3 === 0 ? 'Horde incoming' : `${list.length} zombies` });
  kit.sfx.tone(110, { len: 0.9, vol: 0.25, type: 'sawtooth', slide: 0.6 });
  if (G.wave >= 2 && G.crates.filter(c => c.alive).length < 2 && (G.wave === 2 || Math.random() < 0.6)) {
    const c = makeCrate(); G.crates.push(c); makeCrateObj(c);
    kit.toast(`Supply crate dropped · <b>${CRATES[c.kind].name}</b> at ${Math.round(-c.z / YD)} yd`, 2600);
  }
}

/* ===================== HUD extras: fence bar + map ===================== */
const fenceBar = document.createElement('div'); fenceBar.className = 'zs-fence glass';
fenceBar.innerHTML = '<span class="lbl">Fence</span><span class="zs-bar"><i></i></span><b class="num">100%</b>';
document.getElementById('mg').appendChild(fenceBar);
function renderFence() {
  const f = Math.max(0, G.hp) / FENCE_HP;
  fenceBar.querySelector('i').style.width = (f * 100).toFixed(1) + '%';
  fenceBar.querySelector('b').textContent = Math.ceil(f * 100) + '%';
  fenceBar.dataset.level = f > 0.6 ? 'ok' : f > 0.3 ? 'warn' : 'bad';
}
const mapWrap = document.createElement('div'); mapWrap.className = 'zs-map glass';
mapWrap.innerHTML = '<canvas aria-label="Field map. Tap to pick a target."></canvas>';
document.querySelector('#mg .mg-tr').appendChild(mapWrap);
const mapCv = mapWrap.querySelector('canvas');
const MAP = { xMax: 66, zMax: 290 };
const ZCOL = { walker: '#b8c8a0', pack: '#e8d26a', tank: '#ff6a5a', bloater: '#9dff5a' };
function mapXY(x, z, W, H) { return [W / 2 + x / MAP.xMax * (W / 2 - 4), H - 6 - (-z / (MAP.zMax * YD)) * (H - 12)]; }
function drawMap() {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = mapCv.clientWidth, H = mapCv.clientHeight;
  if (!W || !H) return;
  if (mapCv.width !== Math.round(W * dpr)) { mapCv.width = Math.round(W * dpr); mapCv.height = Math.round(H * dpr); }
  const g = mapCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(60,56,40,0.35)'; g.fillRect(0, 0, W, H);
  g.font = '600 8.5px "Saira Semi Condensed", sans-serif'; g.fillStyle = 'rgba(232,220,192,0.55)'; g.textAlign = 'left';
  for (let yd = 50; yd <= 250; yd += 50) { const [, y] = mapXY(0, -yd * YD, W, H); g.fillRect(3, y, W - 6, 0.6); g.fillText(yd, 4, y - 2); }
  const [, fy] = mapXY(0, FENCE_Z, W, H); g.fillStyle = '#c8a070'; g.fillRect(2, fy, W - 4, 2);
  // the field's funnel toward the fence
  g.strokeStyle = 'rgba(232,220,192,0.35)'; g.lineWidth = 1;
  for (const sd of [-1, 1]) { g.beginPath(); for (let zz = FENCE_Z - 1; zz >= -265; zz -= 5) { const [x, y] = mapXY(sd * (fieldHalf(zz) + 4), zz, W, H); zz === FENCE_Z - 1 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  // reticle
  if (G.target && kit.phase === 'aim') { const [tx, ty] = mapXY(G.target.x, G.target.z, W, H); const rr = blastYd * YD / MAP.xMax * (W / 2 - 4); g.strokeStyle = '#ffb040'; g.lineWidth = 1.3; g.beginPath(); g.arc(tx, ty, Math.max(3, rr), 0, 7); g.stroke(); }
  for (const c of G.crates) if (c.alive) { const [x, y] = mapXY(c.x, c.z, W, H); g.fillStyle = '#' + CRATE_COL[c.kind].toString(16).padStart(6, '0'); g.fillRect(x - 3, y - 3, 6, 6); }
  for (const z of active(G.zombies)) { const [x, y] = mapXY(z.x, z.z, W, H); g.fillStyle = G.frozen > 0 ? '#9ae8ff' : ZCOL[z.type]; g.beginPath(); g.arc(x, y, z.type === 'tank' ? 2.8 : 2, 0, 7); g.fill(); }
  if (sv.flight && !sv.flight.done) { const [x, y] = mapXY(sv.ball.position.x, sv.ball.position.z, W, H); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  if (G.lastBlast && G.lastBlast.age < 2.5) { const [x, y] = mapXY(G.lastBlast.x, G.lastBlast.z, W, H); g.strokeStyle = `rgba(255,208,128,${1 - G.lastBlast.age / 2.5})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, Math.max(3, blastYd * YD / MAP.xMax * (W / 2 - 4)), 0, 7); g.stroke(); }
  g.fillStyle = '#fff'; const [bx, by] = mapXY(0, 0, W, H); g.beginPath(); g.arc(bx, by, 2.2, 0, 7); g.fill();
}
mapCv.addEventListener('click', e => {
  if (kit.phase !== 'aim') return;
  const r = mapCv.getBoundingClientRect(), W = r.width, H = r.height, px = e.clientX - r.left, py = e.clientY - r.top;
  const x = (px - W / 2) / (W / 2 - 4) * MAP.xMax, z = -((H - 6 - py) / (H - 12)) * MAP.zMax * YD;
  setCustomTarget(x, Math.min(FENCE_Z - 4, z));
});
// tap the field to aim
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || kit.phase !== 'aim') return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  if (p && p.z < FENCE_Z - 4) setCustomTarget(p.x, p.z);
});
function setCustomTarget(x, z) { G.custom = { x, z, n: 0 }; updateTarget(true); kit.sfx.tick(); }

/* ===================== aiming help ===================== */
const flat = b => simulate(b, { groundAt: () => 0 });
let targetT = 0;
function updateTarget(force) {
  if (G.custom) G.target = G.custom;
  else {
    const t = chooseTarget(G.zombies, blastYd, G.solve ? G.solve.flightTime : 5.5);
    if (t) G.target = t;
  }
  if (!G.target) { kit.setPrompt('<span class="kick">Target</span><span class="big">Waiting…</span><span class="sub">The horde is coming</span>'); return; }
  const key = `${Math.round(G.target.x / 2)}:${Math.round(G.target.z / 2)}`;
  if (force || key !== G.solveKey) { G.solveKey = key; G.solve = solveShot(flat, CLUBS, G.target); kit.setClub(G.solve.club, true); }
  const d = Math.hypot(G.target.x, G.target.z) / YD, lat = G.target.x / YD;
  const what = G.custom ? 'Your spot' : G.target.n >= 5 ? `Pack ×${G.target.n}` : G.target.n > 1 ? `${G.target.n} zombies` : 'Closest';
  kit.setPrompt(`<span class="kick">Target</span><span class="big">${what}</span><span class="sub">${Math.round(d)} yd${Math.abs(lat) >= 1 ? ` · ${Math.round(Math.abs(lat))} ${lat < 0 ? 'L' : 'R'}` : ''} · try <b>${CLUBS[G.solve.club].id}</b>${G.solve.k < 0.97 ? ` <small>${Math.round(G.solve.k * 100)}%</small>` : ''}</span>`);
}

/* ===================== shots ===================== */
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// simulated shots: the tool's club, trajectory and shape, to the target (or a spot tapped on the map)
const toolShot = makeToolShot(flat, CLUBS);
kit.on('hit', s => { const t = s.target || G.target; if (t) launch(toolShot(t, s).ball, 'Sim'); });
kit.on('ideal', s => { const t = s.target || G.target; if (t) launch(toolShot(t, s).ball, 'Ideal'); });
kit.on('club', () => {});
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, 'R10'); });

function launch(ball, src) {
  kit.phase = 'flight'; reticle.visible = reticleDot.visible = beacon.visible = chevron.visible = false;
  const r = simulate(ball, { groundAt, surfaceAt: world.surfaceAt });
  const li = r.pts.findIndex(p => p.phase !== 'flight');
  const pts = r.pts.slice(0, (li < 0 ? r.pts.length - 1 : li) + 1);   // it explodes on landing
  const fl = sv.fly({ ...r, pts });
  G.shot = { src, carry: r.carry };
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
  fl.onLand = () => {
    const p = fl.pts[fl.pts.length - 1].p, at = new THREE.Vector3(p[0], groundAt(p[0], p[2]), p[2]);
    sv.ball.visible = false;
    blast(at);
  };
}

function blast(at) {
  const R = blastYd * YD;
  explosion(at, R);
  G.lastBlast = { x: at.x, z: at.z, age: 0 };
  const res = resolveBlast({ x: at.x, z: at.z }, G.zombies, blastYd);
  (G.log = G.log || []).push({ tx: G.target && Math.round(G.target.x), tz: G.target && Math.round(G.target.z), lx: Math.round(at.x), lz: Math.round(at.z), k: res.kills.length, near: Math.round(res.nearestYd), src: G.shot.src }); // for tuning
  const pts = blastPoints(res);
  for (const z of res.kills) killZombie(z, at);
  for (const z of res.wounded) horde.wound(z.id);
  // bloater chain bursts get their own little booms
  res.chain.filter(z => z.type === 'bloater').forEach((z, i) => setTimeout(() => explosion(new THREE.Vector3(z.x, 0.8, z.z), CHAIN_YD * YD * 0.7, { big: false }), 180 + i * 140));
  let total = 0;
  if (pts.base > 0) total += kit.award(pts.base);
  if (res.direct && res.kills.length) { kit.splash('DIRECT HIT', { gold: true, sub: pts.multi ? pts.multi.word : '' }); kit.stat('directHits'); }
  else if (pts.multi) kit.splash(pts.multi.word, { big: pts.multi.word === 'MASSACRE', gold: pts.multi.word === 'MASSACRE' });
  if (pts.multi) { if (pts.multi.word === 'MASSACRE') kit.stat('massacres'); if (pts.multi.word !== 'DOUBLE') kit.stat('triples'); }
  if (res.chain.length) kit.stat('chains');
  kit.stat('kills', res.kills.length);
  if (!res.kills.length && !res.wounded.length && Number.isFinite(res.missYd) && res.missYd < 10) kit.soClose(Math.max(0.1, res.missYd));
  // crates
  let crate = null;
  for (const c of G.crates) if (c.alive && Math.hypot(c.x - at.x, c.z - at.z) <= crateGrabYd(blastYd) * YD) { crate = c; break; }
  if (crate) { grabCrate(crate); total += kit.award(POINTS.crate); }
  const scored = res.kills.length > 0 || res.wounded.length > 0 || !!crate;
  kit.endShot(scored);
  const shotPts = kit.player.shotPts;
  kit.showResult(`
    <div class="top"><span class="lbl">${kit.player.name} · ${G.shot.src}</span><span class="pts ${shotPts ? '' : 'zero'}">${shotPts ? '+' + shotPts : '0'}</span></div>
    <div class="items">
      <span><b>${res.kills.length}</b> ${res.kills.length === 1 ? 'kill' : 'kills'}${res.chain.length ? ` · <b>${res.chain.length}</b> by bloater` : ''}${res.wounded.length ? ` · <b>${res.wounded.length}</b> tank hit` : ''}</span>
      ${res.direct && res.kills.length ? '<span><b>Direct hit</b> · points doubled</span>' : ''}
      ${pts.multi ? `<span><b>${pts.multi.word}</b> +${pts.multi.bonus}</span>` : ''}
      ${crate ? `<span><b>${CRATES[crate.kind].name}</b> grabbed</span>` : ''}
      ${!scored && Number.isFinite(res.nearestYd) ? `<span>Nearest zombie ${Math.round(res.nearestYd)} yd away</span>` : ''}
    </div>
    <div class="meta"><span>Blast <b>${blastYd} yd</b></span><span><b>${Math.round(G.shot.carry)}</b> yd carry</span></div>`);
  setTimeout(() => { if (!G.over) { kit.next(); sv.address(false); G.custom = null; updateTarget(true); } }, 1400);
}

function killZombie(z, from) {
  if (!horde.has(z.id)) return;
  horde.kill(z.id, from);
  goo(new THREE.Vector3(z.x, 1.2, z.z));
}

function grabCrate(c) {
  c.alive = false; scene.remove(c.obj); kit.stat('crates'); kit.sfx.star();
  if (c.kind === 'repair') { G.hp = Math.min(FENCE_HP, G.hp + CRATES.repair.hp); world.setFenceDamage(1 - G.hp / FENCE_HP); renderFence(); kit.splash('REPAIRED', { sub: `Fence +${CRATES.repair.hp}%` }); }
  if (c.kind === 'freeze') { G.frozen = CRATES.freeze.seconds; kit.splash('FREEZE', { sub: `${CRATES.freeze.seconds} seconds` }); kit.sfx.tone(2600, { len: 0.6, vol: 0.12, slide: 0.5 }); }
  if (c.kind === 'airstrike') {
    const lane = bestLane(G.zombies); G.airstrike = { lane, t: -1.2, n: 0 };
    kit.splash('AIRSTRIKE', { sub: ['Left', 'Centre', 'Right'][lane] + ' lane' });
    kit.sfx.tone(900, { len: 1.1, vol: 0.12, type: 'sawtooth', slide: 0.3 });
  }
}
function stepAirstrike(dt) {
  const A = G.airstrike; if (!A) return;
  A.t += dt;
  const [a, b] = LANES[A.lane], cx = Math.max(-50, Math.min(50, (Math.max(a, -60) + Math.min(b, 60)) / 2));
  while (A.t > A.n * 0.16 && A.n < 9) {
    const z = FENCE_Z - 20 - A.n * 28, at = new THREE.Vector3(cx + (Math.random() - 0.5) * 12, 0.5, z);
    explosion(at, 14, { big: A.n % 3 === 0 });
    A.n++;
  }
  if (A.n >= 9 && !A.done) {
    A.done = true;
    const hit = active(G.zombies).filter(z => z.x >= a && z.x < b);
    let pts = 0;
    for (const z of hit) { z.alive = false; killZombie(z, new THREE.Vector3(z.x + (Math.random() - 0.5) * 4, 0, z.z + 2)); pts += TYPES[z.type].points; }
    if (pts) kit.award(pts);
    kit.stat('kills', hit.length);
    if (hit.length) kit.toast(`Airstrike · <b>${hit.length}</b> down`, 1800);
    setTimeout(() => { G.airstrike = null; }, 1500);
  }
}

/* ===================== run flow ===================== */
kit.on('start', () => {});
kit.on('runStart', () => resetRun());
kit.on('turn', () => { sv.address(false); updateTarget(true); });

function stepGame(dt) {
  if (!G.running || G.over || kit.phase === 'setup' || kit.phase === 'over') return;
  G.time += dt; kit.player.stats.time = G.time;
  if (G.frozen > 0) G.frozen -= dt;
  // waves
  if (G.nextWaveIn > 0) { G.nextWaveIn -= dt; if (G.nextWaveIn <= 0) startWave(); }
  else {
    G.waveT += dt;
    const left = G.zombies.filter(z => z.alive).length;
    if (left === 0 && G.wave > 0) {
      const bonus = POINTS.wavePer * G.wave; kit.award(bonus);
      kit.splash(`WAVE ${G.wave} CLEARED`, { sub: `+${bonus}` }); kit.sfx.fanfare();
      G.nextWaveIn = 4;
    } else if (G.waveT > WAVE_TIMEOUT) G.nextWaveIn = 0.01;
  }
  const out = stepZombies(G.zombies, dt, { frozen: G.frozen > 0 });
  for (const id of out.bursts) { const z = G.zombies.find(q => q.id === id); explosion(new THREE.Vector3(z.x, 0.8, z.z), 6, { big: false }); killZombie(z, new THREE.Vector3(z.x, 0, z.z - 2)); }
  if (out.damage > 0) { G.hp -= out.damage; world.setFenceDamage(1 - Math.max(0, G.hp) / FENCE_HP); renderFence(); if (Math.random() < dt * 3) kit.sfx.noise(0.12, 500, 0.15); }
  stepAirstrike(dt);
  const left = G.zombies.filter(z => z.alive).length;
  kit.setShotLabel(G.wave ? `Wave ${G.wave} · ${left} left · ${fmtTime(G.time)}` : 'Get ready');
  if (G.hp <= 0) fenceFalls();
  // keep the target fresh while aiming
  targetT -= dt; if (kit.phase === 'aim' && targetT <= 0) { targetT = 0.5; updateTarget(false); }
}
function fenceFalls() {
  G.over = true; G.running = false; G.hp = 0; renderFence(); world.setFenceDamage(1);
  const secs = Math.floor(G.time), bonus = secs * POINTS.perSecond;
  kit.award(bonus);
  kit.splash('THE FENCE FALLS', { big: true, sub: `Survived ${fmtTime(secs)} · +${bonus}` });
  kit.sfx.tone(90, { len: 1.6, vol: 0.35, type: 'sawtooth', slide: 0.4 });
  kit.finishRun();
  setTimeout(() => kit.next(), 3200);
}

/* ===================== zombie animation ===================== */
function animateZombies(dt, t) {
  horde.update(dt, t, { frozen: G.frozen > 0 });
  const live = active(G.zombies); let nearest = Infinity; for (const z of live) nearest = Math.min(nearest, FENCE_Z - z.z);
  amb.update(dt, { count: live.length, nearest });
  for (const c of G.crates) if (c.alive && c.beam) { c.beam.material.opacity = 0.18 + 0.12 * Math.sin(t * 3 + c.id); c.obj.rotation.y += dt * 0.6; }
}

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0, mapT = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); drawMap(); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

function step(dt) {
  clock += dt;
  stepGame(dt);
  animateZombies(dt, clock); animateFx(dt);
  if (G.lastBlast) G.lastBlast.age += dt;
  // reticle on the ground at the target, blast-sized
  const showRet = kit.phase === 'aim' && G.target;
  reticle.visible = reticleDot.visible = beacon.visible = chevron.visible = !!showRet;
  if (showRet) {
    const R = blastYd * YD, y = groundAt(G.target.x, G.target.z) + 0.2;
    reticle.position.set(G.target.x, y, G.target.z); reticle.scale.setScalar(R * (1 + 0.04 * Math.sin(clock * 4)));
    reticleDot.position.set(G.target.x, y, G.target.z); reticleDot.scale.setScalar(Math.max(0.6, R * 0.08));
    const d = camera.position.distanceTo(reticle.position), k = Math.max(1, d / 60);   // stays readable far away
    beacon.position.set(G.target.x, y, G.target.z); beacon.scale.set(k, 10 * k, k);
    chevron.position.set(G.target.x, y + 10 * k + 1.2 * k + Math.sin(clock * 3) * 0.4 * k, G.target.z); chevron.scale.setScalar(k); chevron.rotation.y += 0.03;
  }
  // the address view stays fixed (the whole field is in it); it only follows the ball in flight
  sv.update(dt); world.animate(clock);
  if (shake > 0) { shake = Math.max(0, shake - dt * 0.9); camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  mapT -= dt; if (mapT <= 0) { mapT = 1 / 12; drawMap(); }
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__zs = G; window.__kit = kit; window.__horde = horde; window.__world = world;

resize();
sv.address(false);
document.fonts && document.fonts.ready.then(() => world.refreshSigns && world.refreshSigns());
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
