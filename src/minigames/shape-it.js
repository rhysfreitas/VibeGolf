// Shape It — fly the ball through three glowing rings that trace a shot shape.
// Rules live in shape-it-logic.js; HUD, turns and scoring feedback come from the shared kit.

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { createSunsetMesa } from './scenes/sunset-mesa.js';
import { createShotView } from '../world/shot-view.js';
import { shotShape } from '../range/shot-detail.js';
import { CLUBS, SHAPES, DIFFICULTIES, CHALLENGES, YD, clubIndex, pickShape, shapeBall, buildRings, testRings, scoreShot } from './shape-it-logic.js';

const stage = document.getElementById('stage');
const world = createSunsetMesa(stage);
const { renderer, scene, camera, groundAt, surfaceAt } = world;
const sv = createShotView(world, { tracerColor: '#fff3c4' });

const kit = createKit({
  id: 'shape-it', title: 'Shape It', accent: '#36e2ff',
  blurb: 'Fly your ball through three glowing rings that trace a shot shape: straight, draw, fade, hook, slice, high or low.',
  rules: [
    'Each ring is <b>100</b>. Through the bright centre is <b>PERFECT</b>, worth double.',
    'All three rings: <b>SHAPE!</b> +250. All three perfect: +500.',
    'Consecutive scoring shots build a streak up to <b>×4</b>. A full miss resets it.',
    '10 shots each. The map shows where the rings are, from above and from the side.',
  ],
  shotsPerPlayer: 10, difficulties: DIFFICULTIES, challenges: CHALLENGES, clubs: CLUBS,
});

/* ===================== rings ===================== */
const ringMat = (color, base = 1) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 1, 1) }, uBase: { value: base }, uDim: { value: 1 } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    uniform float uTime, uFlash, uBase, uDim; uniform vec3 uColor, uFlashColor;
    void main(){
      float band = 0.55 + 0.45 * smoothstep(0.35, 0.5, abs(fract(vUv.x * 18.0 - uTime * 0.9) - 0.5) * 2.0);
      float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
      vec3 col = uColor * (0.55 + 0.9 * rim) * band * uBase * uDim;
      col = mix(col, uFlashColor * 2.2, uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const discMat = color => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 0.12 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uA, uTime;
    void main(){ float r = length(vUv - 0.5) * 2.0; float a = uA * (smoothstep(0.55, 1.0, r) + 0.25 * (1.0 - smoothstep(0.0, 0.36, r)));
      a *= 0.8 + 0.2 * sin(uTime * 3.0 - r * 8.0); gl_FragColor = vec4(uColor * a, 1.0); }`,
});

const CYAN = 0x36e2ff, GOLD = 0xffc23d, RED = 0xff5a4a;
let rings = [], ringObjs = [], guide = null;
const Z = new THREE.Vector3(0, 0, 1);
function clearRings() {
  for (const o of ringObjs) { scene.remove(o.group); o.group.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); }
  ringObjs = []; if (guide) guide.visible = false;
}
function makeRings(list) {
  clearRings();
  list.forEach((rg, i) => {
    const group = new THREE.Group();
    const tube = Math.max(0.14, rg.r * 0.05);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(rg.r, tube, 14, 120), ringMat(CYAN, 1.1));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(rg.perfect, tube * 0.55, 10, 80), ringMat(GOLD, 0.9));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rg.r, 64), discMat(CYAN));
    group.add(disc, outer, inner);
    group.position.set(...rg.c);
    group.quaternion.setFromUnitVectors(Z, new THREE.Vector3(...rg.n));
    group.renderOrder = 3; outer.renderOrder = inner.renderOrder = 4; disc.renderOrder = 3;
    scene.add(group);
    ringObjs.push({ group, outer, inner, disc, ring: rg, phase: i * 1.7, flash: 0, pop: 0, state: 'live', flashColor: new THREE.Color(1, 1, 1) });
  });
}
function ringHit(o, perfect) {
  o.state = 'hit'; o.flash = 1; o.pop = 1;
  o.outer.material.uniforms.uFlashColor.value.set(perfect ? 0xfff2b0 : 0xffffff);
  o.outer.material.uniforms.uColor.value.set(GOLD);
  o.disc.material.uniforms.uColor.value.set(GOLD);
  burst(o, perfect);
}
function ringMiss(o) { o.state = 'miss'; o.flash = 0.8; o.outer.material.uniforms.uFlashColor.value.set(RED); }
function animateRings(dt, t) {
  for (const o of ringObjs) {
    o.flash = Math.max(0, o.flash - dt * 1.8); o.pop = Math.max(0, o.pop - dt * 2.4);
    const pulse = 1 + 0.025 * Math.sin(t * 2.2 + o.phase);
    o.group.scale.setScalar(pulse * (1 + 0.28 * Math.sin(o.pop * Math.PI)));
    o.outer.rotation.z += dt * (o.state === 'hit' ? 1.6 : 0.35);
    o.inner.rotation.z -= dt * 0.6;
    for (const m of [o.outer, o.inner]) { m.material.uniforms.uTime.value = t; m.material.uniforms.uFlash.value = m === o.outer ? o.flash : o.flash * 0.6; }
    o.outer.material.uniforms.uDim.value = o.state === 'miss' ? 0.35 : 1;
    o.inner.material.uniforms.uDim.value = o.state === 'miss' ? 0.3 : 1;
    o.disc.material.uniforms.uTime.value = t;
    o.disc.material.uniforms.uA.value = o.state === 'miss' ? 0.04 : 0.12 + o.flash * 0.3;
  }
}

/* ===================== sparkles ===================== */
const sparkTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); return t; })();
const bursts = [];
function burst(o, perfect) {
  const N = perfect ? 220 : 140, rg = o.ring;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const n = new THREE.Vector3(...rg.n), u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
  const c1 = new THREE.Color(perfect ? GOLD : CYAN), c2 = new THREE.Color(perfect ? 0xffffff : GOLD), tc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, onRing = i < N * 0.7;
    const rr = onRing ? rg.r : rg.perfect * Math.random();
    const p = new THREE.Vector3(...rg.c).addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr);
    pos.set([p.x, p.y, p.z], i * 3);
    const out = new THREE.Vector3().addScaledVector(u, Math.cos(a)).addScaledVector(w, Math.sin(a));
    const sp = (onRing ? 4 : 2) + Math.random() * (perfect ? 9 : 6);
    vel.push(out.multiplyScalar(sp).addScaledVector(n, (Math.random() - 0.3) * 5).add(new THREE.Vector3(0, Math.random() * 3, 0)));
    tc.copy(c1).lerp(c2, Math.random()); col.set([tc.r, tc.g, tc.b], i * 3);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: Math.max(0.5, rg.r * 0.09), map: sparkTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat); pts.renderOrder = 6; pts.frustumCulled = false; scene.add(pts);
  bursts.push({ pts, vel, age: 0, life: perfect ? 1.9 : 1.4, size: mat.size });
}
function animateBursts(dt) {
  for (let b = bursts.length - 1; b >= 0; b--) {
    const B = bursts[b]; B.age += dt;
    const p = B.pts.geometry.attributes.position, drag = Math.exp(-2.2 * dt);
    for (let i = 0; i < B.vel.length; i++) { const v = B.vel[i]; v.multiplyScalar(drag); v.y -= 4 * dt; p.setXYZ(i, p.getX(i) + v.x * dt, p.getY(i) + v.y * dt, p.getZ(i) + v.z * dt); }
    p.needsUpdate = true;
    const u = B.age / B.life; B.pts.material.opacity = Math.max(0, 1 - u * u); B.pts.material.size = B.size * (1 - 0.5 * u);
    if (u >= 1) { scene.remove(B.pts); B.pts.geometry.dispose(); B.pts.material.dispose(); bursts.splice(b, 1); }
  }
}

/* ===================== the map (top + side) ===================== */
const mapWrap = document.createElement('div'); mapWrap.className = 'si-map glass';
mapWrap.innerHTML = '<canvas aria-label="Ring map from above and from the side"></canvas>';
kit.els.play.parentElement.querySelector('.mg-tr').appendChild(mapWrap);
const mapCv = mapWrap.querySelector('canvas');
function drawMap(shot) {
  const dpr = Math.min(devicePixelRatio || 1, 2), W = mapCv.clientWidth, H = mapCv.clientHeight;
  if (!W || !H) return;
  if (mapCv.width !== Math.round(W * dpr)) { mapCv.width = Math.round(W * dpr); mapCv.height = Math.round(H * dpr); }
  const g = mapCv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!rings.length) return;
  const ref = cur.ref, flight = p => -p[2];
  const maxD = Math.max(...ref.map(q => flight(q.p)), ...(shot ? shot.map(q => flight(q.p)) : [0])) * 1.08 + 5;
  const latMax = Math.max(12, ...rings.map(r => Math.abs(r.c[0]) + r.r), ...(shot ? shot.map(q => Math.abs(q.p[0])) : [0])) * 1.15;
  const hMax = Math.max(10, ...rings.map(r => r.c[1] + r.r), ...(shot ? shot.map(q => q.p[1]) : [0])) * 1.12;
  const pad = 6, topH = Math.round(H * 0.56), sideY0 = topH + 4;
  // top view: downrange goes up the panel
  const tX = x => W / 2 + x / latMax * (W / 2 - pad), tY = d => topH - pad - d / maxD * (topH - pad * 2);
  // side view: downrange goes left → right
  const sX = d => pad + d / maxD * (W - pad * 2), sY = h => H - pad - h / hMax * (H - sideY0 - pad * 2);
  g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(0, 0, W, topH); g.fillRect(0, sideY0, W, H - sideY0);
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.setLineDash([3, 4]);
  g.beginPath(); g.moveTo(tX(0), tY(0)); g.lineTo(tX(0), tY(maxD)); g.stroke();
  g.beginPath(); g.moveTo(sX(0), sY(0)); g.lineTo(sX(maxD), sY(0)); g.stroke(); g.setLineDash([]);
  const path = (pts, fx, fy, style, w, dash) => { g.beginPath(); pts.forEach((q, i) => { const x = fx(q), y = fy(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = style; g.lineWidth = w; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
  const refF = ref.filter((q, i) => i % 4 === 0 && q.phase === 'flight');
  path(refF, q => tX(q.p[0]), q => tY(flight(q.p)), 'rgba(54,226,255,0.35)', 1, [2, 3]);
  path(refF, q => sX(flight(q.p)), q => sY(q.p[1]), 'rgba(54,226,255,0.35)', 1, [2, 3]);
  rings.forEach((r, i) => {
    const o = ringObjs[i], col = o && o.state === 'hit' ? '#ffc23d' : o && o.state === 'miss' ? 'rgba(255,90,74,0.7)' : '#36e2ff';
    // ring seen from above: a segment across the path; from the side: a vertical segment
    const hx = -r.n[2], hz = r.n[0], hl = Math.hypot(hx, hz) || 1;
    g.strokeStyle = col; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(tX(r.c[0] - hx / hl * r.r), tY(flight(r.c) - hz / hl * r.r * -1)); g.lineTo(tX(r.c[0] + hx / hl * r.r), tY(flight(r.c) + hz / hl * r.r * -1)); g.stroke();
    g.beginPath(); g.moveTo(sX(flight(r.c)), sY(r.c[1] - r.r)); g.lineTo(sX(flight(r.c)), sY(r.c[1] + r.r)); g.stroke();
  });
  if (shot && shot.length > 1) {
    path(shot, q => tX(q.p[0]), q => tY(flight(q.p)), '#fff3c4', 1.6);
    path(shot, q => sX(flight(q.p)), q => sY(Math.max(0, q.p[1])), '#fff3c4', 1.6);
    const b = shot[shot.length - 1].p;
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tX(b[0]), tY(flight(b)), 2.6, 0, 7); g.fill();
  }
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tX(0), tY(0), 2.4, 0, 7); g.fill();
  g.fillStyle = 'rgba(178,180,196,0.9)'; g.font = '600 9px "Saira Semi Condensed", sans-serif'; g.textAlign = 'right';
  g.fillText(`${Math.round(maxD / YD)} yd`, W - pad, 12); g.fillText('SIDE', W - pad, sideY0 + 11);
}

/* ===================== game flow ===================== */
const cur = { shape: null, club: 0, ref: [], results: null, events: [], step: 0, lastShape: null, flight: null, live: false };
let diff = DIFFICULTIES[0];

kit.on('start', ({ difficulty }) => { diff = difficulty; cur.lastShape = null; sv.clearGhosts(); });
kit.on('turn', () => newShape());
kit.on('hit', () => swing());
kit.on('club', i => { cur.club = i; sv.address(CLUBS[i].tee); });

function newShape() {
  sv.clearGhosts();
  const key = pickShape(Math.random, cur.lastShape); cur.lastShape = key;
  const shape = SHAPES[key];
  const clubId = shape.clubs[Math.floor(Math.random() * shape.clubs.length)];
  const club = CLUBS[clubIndex(clubId)];
  const res = simulate(shapeBall(club, key), { groundAt: () => 0 });
  cur.shape = key; cur.club = clubIndex(clubId); cur.ref = res.pts;
  rings = buildRings(res.pts, diff); makeRings(rings);
  // guide line through the rings (Beginner, Amateur)
  if (!guide) { guide = sv.mkLine(1.4, 0.45); guide.material.color.set(CYAN); guide.material.dashed = true; guide.material.dashSize = 2.5; guide.material.gapSize = 2.5; guide.material.defines.USE_DASH = ''; }
  if (diff.guide) {
    const arr = []; res.pts.forEach((q, i) => { if (i % 5 === 0 && q.phase === 'flight') arr.push(...q.p); });
    sv.setLine(guide, arr); guide.computeLineDistances(); guide.visible = true;
  } else guide.visible = false;
  kit.setClub(cur.club, true);
  const carry = Math.round(res.carry);
  kit.setPrompt(`<span class="kick">Shot shape</span><span class="big">${shape.name}</span><span class="sub">${carry} yd carry · try <b>${clubId}</b></span>`);
  sv.address(club.tee);
  const top = rings.reduce((a, r) => (r.c[1] + r.r > a.y ? { y: r.c[1] + r.r, r } : a), { y: -1, r: null }).r;
  sv.keepInView(new THREE.Vector3(top.c[0], top.c[1] + top.r * 1.1, top.c[2]));
  drawMap(null);
}

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function swing() {
  // a simulated golfer trying the shape with the chosen club
  const b = shapeBall(CLUBS[cur.club], cur.shape);
  // a decent amateur's spread: on Beginner most swings find a ring or two, perfects are earned
  b.HLA += gauss() * 3.0; b.SpinAxis += gauss() * 6.5; b.Speed *= 1 + gauss() * 0.03; b.VLA += gauss() * 1.8; b.TotalSpin *= 1 + gauss() * 0.1;
  launch(b, false);
}
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, true); });

function launch(ball, live) {
  kit.phase = 'flight';
  const r = simulate(ball, { groundAt, surfaceAt });
  cur.results = testRings(r.pts, rings); cur.step = 0; cur.ball = ball; cur.live = live; cur.r = r;
  cur.events = cur.results.map((res, i) => ({ i, res, t: res.t ?? Infinity, done: false })).filter(e => Number.isFinite(e.t));
  const fl = sv.fly(r);
  fl.onDone = () => setTimeout(finishShot, 700);
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
}

function fireRingEvents() {
  const fl = sv.flight; if (!fl || !cur.events.length) return;
  for (const ev of cur.events) {
    if (ev.done || fl.t < ev.t) continue;
    ev.done = true;
    const o = ringObjs[ev.i];
    if (ev.res.hit) {
      ringHit(o, ev.res.perfect); kit.sfx.chime(cur.step++);
      if (ev.res.perfect) { kit.sfx.perfect(); kit.splash('PERFECT', { gold: true }); kit.stat('perfects'); }
      kit.stat('rings');
      kit.award((ev.res.perfect ? 2 : 1) * 100);
    } else ringMiss(o);
  }
}

function finishShot() {
  // rings the ball never reached also count as misses
  cur.results.forEach((res, i) => { if (!res.hit && ringObjs[i].state === 'live') ringMiss(ringObjs[i]); });
  const s = scoreShot(cur.results);
  if (s.all) {
    const pts = kit.award(s.bonus);
    kit.splash(s.allPerfect ? 'PERFECT SHAPE' : 'SHAPE!', { gold: s.allPerfect, big: true, sub: `+${pts}` });
    kit.sfx.fanfare(); kit.stat('fullShapes'); if (SHAPES[cur.shape].curve) kit.stat('curveShapes');
    ringObjs.forEach(o => { o.flash = 1; o.pop = 1; });
  } else if (!s.rings) {
    const near = cur.results.filter(r => r.near).sort((a, b) => a.missYd - b.missYd)[0];
    if (near) kit.soClose(Math.max(0.1, near.missYd)); else kit.sfx.miss();
  }
  const pl = kit.player;
  const shotPts = pl.shotPts;
  const end = kit.endShot(s.rings > 0);
  const hit = shotShape(cur.ball.HLA || 0, cur.ball.SpinAxis || 0);
  kit.showResult(`
    <div class="top"><span class="lbl">${SHAPES[cur.shape].name} · ${pl.name}</span><span class="pts ${shotPts ? '' : 'zero'}">${shotPts ? '+' + shotPts : '0'}</span></div>
    <div class="items">${cur.results.map((r, i) => `<span>Ring ${i + 1} · ${r.hit ? `<b>${r.perfect ? 'Perfect' : 'Through'}</b>` : Number.isFinite(r.missYd) ? `missed by ${r.missYd < 10 ? r.missYd.toFixed(1) : Math.round(r.missYd)} yd` : 'not reached'}</span>`).join('')}</div>
    <div class="meta"><span>You hit <b>${hit}</b></span><span><b>${Math.round(cur.r.carry)}</b> yd ${cur.live ? '· R10' : ''}</span></div>`);
  drawMap(cur.r.pts);
  setTimeout(() => kit.next(), end.last ? 1600 : 2200);
}

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); if (guide) guide.material.resolution.set(renderer.domElement.width, renderer.domElement.height); drawMap(sv.flight && sv.flight.done ? cur.r.pts : null); }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

function step(dt) {
  clock += dt;
  fireRingEvents();
  animateRings(dt, clock); animateBursts(dt);
  sv.update(dt); world.animate(clock);
  if (sv.flight && !sv.flight.done && Math.floor(clock * 15) !== Math.floor((clock - dt) * 15)) drawMap(sv.flight.pts.slice(0, Math.max(2, sv.flight.pts.findIndex(q => q.t > sv.flight.t))));
}
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__shape = cur; window.__kit = kit;

resize();
sv.address(false);
document.fonts && document.fonts.ready.then(() => world.refreshSigns && world.refreshSigns());
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
