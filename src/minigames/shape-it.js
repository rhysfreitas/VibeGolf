// Shape It — fly the ball through three glowing rings that trace a shot shape.
// Rules live in shape-it-logic.js; HUD, turns and scoring feedback come from the shared kit.
// The scene is the Launch Bay (a spaceship's hangar, door open on space): the rings are flight
// gates and the map is the bay's flight-plan screen, a monitor hanging top right.

import { simulate } from '../physics.js';
import { launchMonitor } from '../launch-monitor.js';
import { createKit } from './kit.js';
import { makeToolShot, TRAJ_MUL } from './aim.js';
import { createLaunchBay, createFlightPlanMonitor, BAY } from './scenes/launch-bay.js';
import { createShotView } from '../world/shot-view.js';
import { shotShape } from '../range/shot-detail.js';
import { CLUBS, SHAPES, DIFFICULTIES, CHALLENGES, YD, clubIndex, pickShape, shapeBall, buildRings, testRings, scoreShot } from './shape-it-logic.js';

const stage = document.getElementById('stage');
const world = createLaunchBay(stage);
const { renderer, scene, camera, groundAt, surfaceAt } = world;
const sv = createShotView({ ...world, groundAt: world.safeGround }, { tracerColor: '#fff3c4' });
const VOID_Y = -60; // off the flight deck the ball drops away into space
const flySim = b => simulate(b, { groundAt, surfaceAt, voidY: VOID_Y });

const kit = createKit({
  id: 'shape-it', title: 'Shape It', accent: '#36e2ff',
  blurb: 'Fly your ball through three glowing rings that trace a shot shape: straight, draw, fade, hook, slice, high or low.',
  rules: [
    'Beginner and Amateur fly through tall <b>gates</b>: only left and right count, so start it on line and curve it through. Pro and Tour fly through <b>rings</b>, where height counts too.',
    'Each gate is <b>100</b>. Through the bright centre is <b>PERFECT</b>, worth double.',
    'All three gates: <b>SHAPE!</b> +250. All three perfect: +500.',
    'Consecutive scoring shots build a streak up to <b>×4</b>. A full miss resets it.',
    '10 shots each. The flight-plan screen (top right) shows the gates from above and from the side; tap it to aim at a spot.',
  ],
  shotsPerPlayer: 10, difficulties: DIFFICULTIES, challenges: CHALLENGES, clubs: CLUBS, idealShot: true,
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
// Beginner and Amateur: a tall gate (two light posts and a faint curtain; only left and right count)
const curtainMat = color => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  uniforms: { uColor: { value: new THREE.Color(color) }, uA: { value: 0.12 }, uTime: { value: 0 }, uPerf: { value: 0.2 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uA, uTime, uPerf;
    void main(){ float x = abs(vUv.x * 2.0 - 1.0);
      float edge = smoothstep(0.8, 1.0, x), band = 1.0 - smoothstep(uPerf * 0.9, uPerf, x);
      float scan = 0.6 + 0.4 * sin(vUv.y * 70.0 - uTime * 3.0);
      float a = uA * (0.3 + 1.6 * edge + 0.9 * band + 1.2 * smoothstep(0.93, 1.0, vUv.y)) * scan;
      vec3 c = mix(uColor, vec3(1.0, 0.78, 0.25), band * 0.7);
      gl_FragColor = vec4(c * a, 1.0); }`,
});
// the gate's line across the deck, so you can see where each one stands
const stripMat = color => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uPerf: { value: 0.2 }, uDim: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime, uPerf, uDim;
    void main(){ float x = abs(vUv.x * 2.0 - 1.0), band = 1.0 - smoothstep(uPerf * 0.9, uPerf, x);
      float across = 1.0 - smoothstep(0.2, 0.5, abs(vUv.y - 0.5));
      float chase = 0.65 + 0.35 * sin(x * 30.0 - uTime * 4.0);
      vec3 c = mix(uColor, vec3(1.0, 0.78, 0.25), band);
      gl_FragColor = vec4(c * across * chase * 0.9 * uDim, 1.0); }`,
});
function postGeo(radius, h) { // a light post whose shader bands run up it
  const g = new THREE.CylinderGeometry(radius, radius, h, 12, 1, true); g.translate(0, h / 2, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * h / 40, uv.getX(i));
  return g;
}
function makeGate(rg, i) {
  const group = new THREE.Group(), top = rg.top, pr = Math.max(0.3, rg.r * 0.04);
  const postMat = ringMat(CYAN, 1.2), bandMat = ringMat(GOLD, 0.8);
  const posts = [-1, 1].map(sx => { const m = new THREE.Mesh(postGeo(pr, top), postMat); m.position.x = sx * rg.r; m.renderOrder = 4; group.add(m); return m; });
  const bands = [-1, 1].map(sx => { const m = new THREE.Mesh(postGeo(pr * 0.35, top * 0.8), bandMat); m.position.x = sx * rg.perfect; m.renderOrder = 4; group.add(m); return m; });
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(rg.r * 2, top), curtainMat(CYAN)); curtain.position.y = top / 2; curtain.renderOrder = 3;
  curtain.material.uniforms.uPerf.value = rg.perfect / rg.r; group.add(curtain);
  const bar = new THREE.Mesh(postGeo(pr * 0.8, rg.r * 2), postMat); bar.rotation.z = -Math.PI / 2; bar.position.set(-rg.r, top, 0); bar.renderOrder = 4; group.add(bar);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(rg.r * 2, Math.max(0.8, rg.r * 0.08)).rotateX(-Math.PI / 2), stripMat(CYAN));
  strip.position.y = 0.04; strip.material.uniforms.uPerf.value = rg.perfect / rg.r; strip.renderOrder = 3; group.add(strip);
  const pads = [-1, 1].map(sx => { const m = new THREE.Mesh(new THREE.CylinderGeometry(pr * 2.6, pr * 3, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x2a3038, metalness: 0.7, roughness: 0.4, emissive: 0x0a3a48 })); m.position.set(sx * rg.r, 0.25, 0); group.add(m); return m; });
  void pads;
  // nav lights: red left, green right on the post tops, white strobes halfway up
  const lights = [[-1, 1, 0xff4a3a], [1, 1, 0x4dff7a], [-1, 0.5, 0xffffff], [1, 0.5, 0xffffff]].map(([sx, fy, c]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    sp.position.set(sx * rg.r, top * fy + (fy === 1 ? 0.6 : 0), 0); sp.scale.setScalar(Math.max(1.4, rg.r * 0.18)); sp.renderOrder = 5; group.add(sp); return sp;
  });
  group.position.set(rg.c[0], 0, rg.c[2]); group.rotation.y = Math.atan2(rg.n[0], rg.n[2]);
  scene.add(group);
  return { group, outer: posts[0], inner: bands[0], disc: curtain, strip, lights, ring: rg, gate: true, phase: i * 1.7, flash: 0, pop: 0, state: 'live', flashColor: new THREE.Color(1, 1, 1) };
}
function makeRings(list) {
  clearRings();
  list.forEach((rg, i) => {
    if (rg.kind === 'gate') { ringObjs.push(makeGate(rg, i)); return; }
    const group = new THREE.Group();
    const tube = Math.max(0.14, rg.r * 0.05);
    const outer = new THREE.Mesh(new THREE.TorusGeometry(rg.r, tube, 14, 120), ringMat(CYAN, 1.1));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(rg.perfect, tube * 0.55, 10, 80), ringMat(GOLD, 0.9));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(rg.r, 64), discMat(CYAN));
    group.add(disc, outer, inner);
    // flight-gate nav lights: red on the left, green on the right, white top and bottom
    const lights = [[-1, 0, 0xff4a3a], [1, 0, 0x4dff7a], [0, 1, 0xffffff], [0, -1, 0xffffff]].map(([ux, uy, c]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const off = rg.r + tube * 3.2; sp.position.set(ux * off, uy * off, 0); sp.scale.setScalar(Math.max(0.9, rg.r * 0.16)); sp.renderOrder = 5; group.add(sp); return sp;
    });
    group.position.set(...rg.c);
    group.quaternion.setFromUnitVectors(Z, new THREE.Vector3(...rg.n));
    group.renderOrder = 3; outer.renderOrder = inner.renderOrder = 4; disc.renderOrder = 3;
    scene.add(group);
    ringObjs.push({ group, outer, inner, disc, lights, ring: rg, phase: i * 1.7, flash: 0, pop: 0, state: 'live', flashColor: new THREE.Color(1, 1, 1) });
  });
}
function ringHit(o, perfect, at = null) {
  o.state = 'hit'; o.flash = 1; o.pop = 1;
  o.outer.material.uniforms.uFlashColor.value.set(perfect ? 0xfff2b0 : 0xffffff);
  o.outer.material.uniforms.uColor.value.set(GOLD);
  o.disc.material.uniforms.uColor.value.set(GOLD);
  if (o.strip) o.strip.material.uniforms.uColor.value.set(GOLD);
  burst(o, perfect, at);
}
function ringMiss(o) { o.state = 'miss'; o.flash = 0.8; o.outer.material.uniforms.uFlashColor.value.set(RED); }
function animateRings(dt, t) {
  for (const o of ringObjs) {
    o.flash = Math.max(0, o.flash - dt * 1.8); o.pop = Math.max(0, o.pop - dt * 2.4);
    const pulse = 1 + 0.025 * Math.sin(t * 2.2 + o.phase);
    const sc = pulse * (1 + 0.28 * Math.sin(o.pop * Math.PI));
    if (o.gate) o.group.scale.set(sc, 1, 1); // a gate swells sideways
    else { o.group.scale.setScalar(sc); o.outer.rotation.z += dt * (o.state === 'hit' ? 1.6 : 0.35); o.inner.rotation.z -= dt * 0.6; }
    for (const m of [o.outer, o.inner]) { m.material.uniforms.uTime.value = t; m.material.uniforms.uFlash.value = m === o.outer ? o.flash : o.flash * 0.6; }
    o.outer.material.uniforms.uDim.value = o.state === 'miss' ? 0.35 : 1;
    o.inner.material.uniforms.uDim.value = o.state === 'miss' ? 0.3 : 1;
    o.disc.material.uniforms.uTime.value = t;
    if (o.strip) { o.strip.material.uniforms.uTime.value = t; o.strip.material.uniforms.uDim.value = o.state === 'miss' ? 0.3 : 1 + o.flash; }
    o.disc.material.uniforms.uA.value = o.state === 'miss' ? 0.04 : 0.12 + o.flash * 0.3;
    o.lights.forEach((sp, k) => { sp.material.opacity = o.state === 'miss' ? 0.15 : k < 2 ? 0.75 + 0.25 * Math.sin(t * 2 + o.phase) : (Math.sin(t * 3.2 + o.phase + k) > 0.55 ? 1 : 0.12); });
  }
}

/* ===================== sparkles ===================== */
const sparkTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); return t; })();
const bursts = [];
function burst(o, perfect, at = null) {
  const N = perfect ? 220 : 140, rg = o.ring;
  const C = o.gate && at ? at : rg.c, R0 = o.gate ? rg.r * 0.45 : rg.r; // a gate bursts where the ball went through
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vel = [];
  const n = new THREE.Vector3(...rg.n), u = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), w = new THREE.Vector3().crossVectors(n, u);
  const c1 = new THREE.Color(perfect ? GOLD : CYAN), c2 = new THREE.Color(perfect ? 0xffffff : GOLD), tc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, onRing = i < N * 0.7;
    const rr = onRing ? R0 : rg.perfect * Math.random();
    const p = new THREE.Vector3(...C).addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr);
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

/* ===================== the flight plan (top + side) on the bay's monitor ===================== */
const fp = createFlightPlanMonitor(world);
let mapGeo = null, fpDirty = true;
// where the screen sits: under the top-right tools, the size the corner map is in other games
function fpRect() {
  const tools = kit.els.lmBtn.closest('.mg-tools').getBoundingClientRect(), vw = stage.clientWidth, vh = stage.clientHeight;
  let w = 128, h = 186;
  if (vh >= 560 && vw >= 900) { w = 170; h = 240; } else if (vw <= 760 && vw > vh) { w = 112; h = 164; }
  return { left: tools.right - 14 - w, top: tools.bottom + 14, w, h };
}
function placeMonitor() { const r = fpRect(); if (r.w !== fp.w || r.h !== fp.h) fpDirty = true; fp.layout(r); if (fpDirty) { fpDirty = false; drawMap(cur.mapShot); } }
// tap the top view: the next simulated shot goes to that spot (club, swing length and direction worked out)
renderer.domElement.addEventListener('click', e => {
  if (kit.phase !== 'aim' || !mapGeo) return;
  const h = fp.hit(e); if (!h) return;
  const M = mapGeo, px = h.x, py = h.y;
  if (py < M.y0 + M.pad || py > M.topH - M.pad) return;
  const x = (px - M.W / 2) / (M.W / 2 - M.pad) * M.latMax, d = (M.topH - M.pad - py) / (M.topH - M.y0 - M.pad * 2) * M.maxD;
  if (d > 5) kit.mapSpot(x, -d);
});
kit.on('spot', () => drawMap(cur.mapShot));
const FONT = '"Saira Semi Condensed", "Arial Narrow", sans-serif';
function drawMap(shot) {
  cur.mapShot = shot;
  const W = fp.w, H = fp.h; if (!W || !H) return;
  const g = fp.canvas.getContext('2d'), dpr = fp.canvas.width / W;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the screen: deep blue glass with a faint grid and scan lines
  g.fillStyle = '#03101b'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(54,226,255,0.06)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 12) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
  for (let y = 0; y < H; y += 12) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  const hh = 15, fh = 14, y0 = hh, y1 = H - fh;
  g.fillStyle = 'rgba(54,226,255,0.14)'; g.fillRect(0, 0, W, hh);
  g.font = `700 9px ${FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#7fe9ff';
  g.fillText('FLIGHT PLAN', 5, hh / 2 + 0.5);
  g.textAlign = 'right'; g.fillStyle = '#ffd257'; g.fillText(cur.shape ? SHAPES[cur.shape].name.toUpperCase() : '', W - 5, hh / 2 + 0.5);
  const st = cur.status || { text: 'STANDBY', color: '#7fe9ff' };
  g.fillStyle = 'rgba(54,226,255,0.08)'; g.fillRect(0, y1, W, fh);
  g.textAlign = 'center'; g.fillStyle = st.color; g.font = `700 8.5px ${FONT}`; g.fillText(st.text, W / 2, y1 + fh / 2 + 0.5);
  mapGeo = null;
  if (rings.length) {
    const ref = cur.ref, flight = p => -p[2];
    const maxD = Math.max(...ref.map(q => flight(q.p)), ...(shot ? shot.map(q => flight(q.p)) : [0])) * 1.08 + 5;
    const latMax = Math.max(12, ...rings.map(r => Math.abs(r.c[0]) + r.r), ...(shot ? shot.map(q => Math.abs(q.p[0])) : [0])) * 1.15;
    const hMax = Math.max(10, ...rings.map(r => (r.kind === 'gate' ? r.top : r.c[1] + r.r)), ...(shot ? shot.map(q => q.p[1]) : [0])) * 1.12;
    const pad = 6, topH = Math.round(y0 + (y1 - y0) * 0.56), sideY0 = topH + 4;
    const tX = x => W / 2 + x / latMax * (W / 2 - pad), tY = d => topH - pad - d / maxD * (topH - y0 - pad * 2);
    mapGeo = { W, y0, topH, pad, latMax, maxD };
    const sX = d => pad + d / maxD * (W - pad * 2), sY = h => y1 - pad - h / hMax * (y1 - sideY0 - pad * 2);
    g.strokeStyle = 'rgba(54,226,255,0.22)'; g.setLineDash([3, 4]);
    g.beginPath(); g.moveTo(tX(0), tY(0)); g.lineTo(tX(0), tY(maxD)); g.stroke();
    g.beginPath(); g.moveTo(sX(0), sY(0)); g.lineTo(sX(maxD), sY(0)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(54,226,255,0.25)'; g.beginPath(); g.moveTo(0, sideY0 - 2); g.lineTo(W, sideY0 - 2); g.stroke();
    const path = (pts, fx, fy, style, w, dash) => { g.beginPath(); pts.forEach((q, i) => { const x = fx(q), y = fy(q); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.strokeStyle = style; g.lineWidth = w; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]); };
    const refF = ref.filter((q, i) => i % 4 === 0 && q.phase === 'flight');
    path(refF, q => tX(q.p[0]), q => tY(flight(q.p)), 'rgba(54,226,255,0.55)', 1, [2, 3]);
    path(refF, q => sX(flight(q.p)), q => sY(q.p[1]), 'rgba(54,226,255,0.55)', 1, [2, 3]);
    rings.forEach((r, i) => {
      const o = ringObjs[i], c = o && o.state === 'hit' ? '#ffc23d' : o && o.state === 'miss' ? 'rgba(255,90,74,0.8)' : '#36e2ff';
      const hx = -r.n[2], hz = r.n[0], hl = Math.hypot(hx, hz) || 1;
      g.strokeStyle = c; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tX(r.c[0] - hx / hl * r.r), tY(flight(r.c) + hz / hl * r.r)); g.lineTo(tX(r.c[0] + hx / hl * r.r), tY(flight(r.c) - hz / hl * r.r)); g.stroke();
      if (r.kind === 'gate') { g.beginPath(); g.moveTo(sX(flight(r.c)), sY(0)); g.lineTo(sX(flight(r.c)), sY(r.top)); g.stroke(); }
      else { g.beginPath(); g.moveTo(sX(flight(r.c)), sY(r.c[1] - r.r)); g.lineTo(sX(flight(r.c)), sY(r.c[1] + r.r)); g.stroke(); }
    });
    if (shot && shot.length > 1) {
      path(shot, q => tX(q.p[0]), q => tY(flight(q.p)), '#fff3c4', 1.6);
      path(shot, q => sX(flight(q.p)), q => sY(Math.max(0, q.p[1])), '#fff3c4', 1.6);
      const b = shot[shot.length - 1].p;
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tX(b[0]), tY(flight(b)), 2.6, 0, 7); g.fill();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(tX(0), tY(0), 2.4, 0, 7); g.fill();
    if (kit.spot) kit.drawSpot(g, tX(kit.spot.x), tY(-kit.spot.z));
    g.fillStyle = 'rgba(127,233,255,0.75)'; g.font = `600 8px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText(`${Math.round(maxD / YD)} YD`, W - pad, y0 + 11); g.fillText('SIDE', W - pad, sideY0 + 10);
  }
  // scan lines
  g.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  fp.update();
}
function setStatus(text, color = '#7fe9ff') { cur.status = { text, color }; drawMap(cur.mapShot); }

/* ===================== game flow ===================== */
const cur = { shape: null, club: 0, ref: [], results: null, events: [], step: 0, lastShape: null, flight: null, live: false };
let diff = DIFFICULTIES[0];

kit.on('start', () => { cur.lastShape = null; sv.clearGhosts(); });
kit.on('turn', () => { world.resetShips(); newShape(); });
// simulated shots (s.ball comes from the kit, aimed down the phantom line): Ideal is the exact
// reference shot the rings were built from (it threads them dead centre with auto-aim on),
// unless the tool's club / trajectory / shape / map spot says otherwise
kit.on('hit', s => launch(s.ball, false));
kit.on('ideal', s => launch(s.ball, false, true));
kit.on('club', i => { cur.club = i; sv.address(CLUBS[i].tee); });

function newShape() {
  diff = kit.player.difficulty; // each player can play their own level
  sv.clearGhosts();
  const key = pickShape(Math.random, cur.lastShape, diff.shapes); cur.lastShape = key;
  const shape = SHAPES[key];
  const clubId = shape.clubs[Math.floor(Math.random() * shape.clubs.length)];
  const club = CLUBS[clubIndex(clubId)];
  const res = simulate(shapeBall(club, key), { groundAt: () => 0 });
  cur.status = { text: 'CLEARED FOR LAUNCH', color: '#7dffa8' };
  cur.shape = key; cur.club = cur.refClub = clubIndex(clubId); cur.ref = res.pts;
  rings = buildRings(res.pts, diff); makeRings(rings);
  // guide line through the rings (Beginner, Amateur)
  if (!guide) { guide = sv.mkLine(1.4, 0.45); guide.material.color.set(CYAN); guide.material.dashed = true; guide.material.dashSize = 2.5; guide.material.gapSize = 2.5; guide.material.defines.USE_DASH = ''; }
  if (diff.guide) {
    const arr = []; res.pts.forEach((q, i) => { if (i % 5 === 0 && q.phase === 'flight') arr.push(...q.p); });
    sv.setLine(guide, arr); guide.computeLineDistances(); guide.visible = true;
  } else guide.visible = false;
  kit.suggest({ club: cur.club, axis: shape.axis || 0 });
  const carry = Math.round(res.carry);
  kit.setPrompt(`<span class="kick">Shot shape</span><span class="big">${shape.name}</span><span class="sub">${carry} yd carry · try <b>${clubId}</b></span>`);
  sv.address(club.tee);
  const reach = r => (r.kind === 'gate' ? r.top + 1 : r.c[1] + r.r * 1.1); // keep the gate tops (or the top ring) in view
  const ang = r => reach(r) / Math.max(1, Math.hypot(r.c[0], r.c[2]));
  const top = rings.reduce((a, r) => (ang(r) > a.y ? { y: ang(r), r } : a), { y: -1, r: null }).r;
  sv.keepInView(new THREE.Vector3(top.c[0], reach(top), top.c[2]));
  drawMap(null);
}

function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// The simulated shot: the called shape with the tool's club, unless you've changed the trajectory,
// dragged the shape line, or tapped the map (then it's your shot to that spot).
const toolShot = makeToolShot(b => simulate(b, { groundAt: () => 0 }), CLUBS);
function toolBallFor(s, ideal) {
  if (s.target) return toolShot(s.target, { ...s, ideal }).ball;
  const sh = SHAPES[cur.shape], c = CLUBS[s.clubAuto ? cur.refClub : s.club], t = TRAJ_MUL[s.traj] || TRAJ_MUL.normal;
  return {
    Speed: c.Speed * (sh.speed || 1) * t.speed, VLA: (c.VLA + (sh.vla || 0)) * t.vla,
    HLA: s.axisAuto ? sh.hla : -s.axis * 0.37,         // start it out so the curve comes back (a −6.5° draw starts 2.4° right)
    TotalSpin: c.TotalSpin * (sh.spin || 1) * t.spin, SpinAxis: s.axis,
  };
}
// Hit is a simulated golfer *attempting* the shape: a decent amateur's spread, so on Beginner
// most swings find a ring or two and perfects are earned (the kit adds the miss)
kit.aimLine({ world, view: sv, sim: flySim, ideal: s => (cur.shape ? toolBallFor(s, true) : null), blockDrag: e => !!fp.hit(e) });
launchMonitor.addEventListener('shot', e => { if (kit.phase === 'aim') launch(e.detail, true); });

function launch(ball, live, ideal = false) {
  kit.phase = 'flight'; cur.ideal = ideal;
  const r = flySim(ball);
  cur.results = testRings(r.pts, rings); cur.step = 0; cur.ball = ball; cur.live = live; cur.r = r;
  cur.events = cur.results.map((res, i) => ({ i, res, t: res.t ?? Infinity, done: false })).filter(e => Number.isFinite(e.t));
  const fl = sv.fly(r);
  fl.onDone = () => setTimeout(finishShot, 700);
  kit.sfx.tone(160, { len: 0.08, vol: 0.25, type: 'triangle' }); kit.sfx.noise(0.08, 3000, 0.5);
  cur.prevZ = 0; cur.gates = 0; setStatus('IN FLIGHT', '#ffd257');
}

function fireRingEvents() {
  const fl = sv.flight; if (!fl || !cur.events.length) return;
  for (const ev of cur.events) {
    if (ev.done || fl.t < ev.t) continue;
    ev.done = true;
    const o = ringObjs[ev.i];
    if (ev.res.hit) {
      ringHit(o, ev.res.perfect, ev.res.p); kit.sfx.chime(cur.step++);
      if (ev.res.perfect) { kit.sfx.perfect(); kit.splash('PERFECT', { gold: true }); kit.stat('perfects'); }
      kit.stat('rings');
      kit.award((ev.res.perfect ? 2 : 1) * 100);
      cur.gates++; setStatus(`GATE ${ev.i + 1} ${ev.res.perfect ? 'PERFECT' : 'CLEAR'}`, ev.res.perfect ? '#ffd257' : '#7dffa8');
    } else { ringMiss(o); setStatus(`GATE ${ev.i + 1} MISSED`, '#ff7a6a'); }
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
    if (s.allPerfect) world.launchShip(); // a perfect flight plan: a ship takes off out of the bay
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
    <div class="items">${cur.results.map((r, i) => `<span>Gate ${i + 1} · ${r.hit ? `<b>${r.perfect ? 'Perfect' : 'Through'}</b>` : Number.isFinite(r.missYd) ? `missed by ${r.missYd < 10 ? r.missYd.toFixed(1) : Math.round(r.missYd)} yd` : 'not reached'}</span>`).join('')}</div>
    <div class="meta"><span>You hit <b>${hit}</b></span><span><b>${Math.round(cur.r.carry)}</b> yd ${cur.live ? '· R10' : cur.ideal ? '· Ideal' : '· Sim'}</span></div>`);
  cur.status = s.all ? { text: s.allPerfect ? 'PERFECT FLIGHT PLAN' : 'ON PLAN · ALL GATES', color: '#ffd257' } : s.rings ? { text: `${s.rings} OF 3 GATES`, color: '#7fe9ff' } : { text: 'OFF PLAN', color: '#ff7a6a' };
  drawMap(cur.r.pts);
  setTimeout(() => kit.next(), end.last ? 1600 : 2200);
}

/* ===================== loop ===================== */
let fitW = 0, fitH = 0, last = performance.now(), clock = 0;
function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sv.resizeLines(); if (guide) guide.material.resolution.set(renderer.domElement.width, renderer.domElement.height); fpDirty = true; }
function fitToScreen() { const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h || (w === fitW && h === fitH)) return; resize(); }
const refit = () => { fitToScreen(); requestAnimationFrame(fitToScreen); setTimeout(fitToScreen, 250); setTimeout(fitToScreen, 700); };
addEventListener('resize', refit); addEventListener('orientationchange', refit);
if (window.visualViewport) visualViewport.addEventListener('resize', refit);

function step(dt) {
  clock += dt;
  fireRingEvents();
  animateRings(dt, clock); animateBursts(dt);
  sv.update(dt); world.animate(clock); placeMonitor();
  // the ball pops through the door's force field
  if (sv.flight && !sv.flight.done) { const b = sv.ball.position; if (cur.prevZ > BAY.door && b.z <= BAY.door && b.y < BAY.doorTop) world.fieldRipple(b.x, b.y); cur.prevZ = b.z; }
  if (sv.flight && !sv.flight.done && Math.floor(clock * 15) !== Math.floor((clock - dt) * 15)) drawMap(sv.flight.pts.slice(0, Math.max(2, sv.flight.pts.findIndex(q => q.t > sv.flight.t))));
}
function frame(now) { const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; fitToScreen(); step(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
window.__advance = (sec, n) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (n && i % n === 0) renderer.render(scene, camera); } renderer.render(scene, camera); };
window.__shape = cur; window.__kit = kit; window.__fp = fp; window.__world = world;

resize();
sv.address(false);
document.fonts && document.fonts.ready.then(() => { fpDirty = true; });
kit.showStart();
requestAnimationFrame(t => { last = t; frame(t); });
