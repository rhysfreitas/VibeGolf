// Course play mode: The Aerie, Red Mesa (course.html?c=redmesa) and any course in the same format.
import { simulate } from '../physics.js';
import { launchMonitor, mountLaunchMonitorUI } from '../launch-monitor.js';
import { hash2, fbm, rng, sstep, islandF, edgeRadius, islandH, prepIsland, createTerrain } from './terrain.js';
import { featureOutline } from './features.js';
import { createTreeField } from './trees.js';
import { cloudDrop } from './relief.js';
import { TIMES, WINDS, WEATHER, TEMPS, WIND_FROM, rollWind, holeWind, windVector, windInShot, skyAngles, suggestTee, teeYards } from './conditions.js';
import { recentDrives, recordDrive } from '../drives.js';
import { recorder } from '../recorder.js';
import { createLiveQueue } from '../live-queue.js';
import { keepAwake } from '../wake.js';
import { attachAdaptiveRes } from '../adaptive-res.js';
import { packRound, readRound, describeRound } from './round-save.js';
import { createMinimap } from './minimap.js';
import { createSimTool } from '../sim-tool.js';
import { cumulusBanks, skyPines, clumpGeo, clumpMat } from '../world/sky-art.js';
import { TRAJ_MUL } from '../minigames/aim.js';
import { attachAimDrag } from '../aim-line.js';
import { STANCE, stanceView } from '../stance.js';

THREE.ColorManagement.legacyMode = false;

const COURSES = { aerie: './aerie.js', redmesa: './red-mesa.js', aerie2: './aerie.js', hollowmere: './hollowmere.js', reclaim: './reclaim.js', rimeholm: './rimeholm.js', emberfell: './emberfell.js' };
const CID = COURSES[new URLSearchParams(location.search).get('c')] ? new URLSearchParams(location.search).get('c') : 'aerie';
const { COURSE, HOLES, LANDMARKS } = await import(COURSES[CID]);
const CAVE = COURSE.theme === 'cave'; // underground: built like Red Mesa (floor, playfield, rocks), under a roof
// a ruined city (The Reclaim): ground from a sampled field, built like Red Mesa's playfield, the city drawn by city-world.js
const CITY = COURSE.theme === 'city';
// a glacier at night (Rimeholm): a sampled field like The Reclaim's, snow and ice, the aurora; ice-world.js draws it
const ICE = COURSE.theme === 'ice';
// a volcano at dusk (Emberfell): a sampled field like Rimeholm's, black lava, red cinder, grey ash, lava that plays as water; volcano-world.js draws it
const VOLC = COURSE.theme === 'volcano';
const FIELD = CITY || ICE || VOLC;   // ground from a sampled field
const MESA = COURSE.theme === 'mesa' || CAVE || FIELD;
const DESERT = MESA && !FIELD; // the red-rock colours (fog, the ground shader's native earth)
const REDROCK = DESERT && !CAVE; // Red Mesa itself: its art (junipers, talus, ragged far mesas)
// a sky course drawn from shaped ground (features, a painted surface), like Red Mesa's playfield
const SHAPED = !MESA && !!COURSE.shaped;
const MW = MESA || SHAPED ? await import('./mesa-world.js') : null;
const CW = CAVE ? await import('./cave-world.js') : null;
const CTW = CITY ? await import('./city-world.js') : null;
const IW = ICE ? await import('./ice-world.js') : null;
const VW = VOLC ? await import('./volcano-world.js') : null;
const SP = SHAPED ? await import('./sky-props.js') : null;
const VOID_TEXT = COURSE.voidText || ['Into the clouds', 'Ends in the clouds'];
document.title = COURSE.name;

/* ===================== the course ===================== */
// World units are metres; each hole has its own frame with the tee near the origin and play heading -z.
const M_PER_YD = 0.9144;
const CLUBS = [
  { id: 'DR', name: 'Driver', Speed: 167, VLA: 10.9, TotalSpin: 2686, tee: true },
  { id: '3W', name: '3 wood', Speed: 158, VLA: 9.2, TotalSpin: 3655, tee: true },
  { id: 'HY', name: 'Hybrid', Speed: 146, VLA: 10.2, TotalSpin: 4437 },
  { id: '5i', name: '5 iron', Speed: 132, VLA: 12.1, TotalSpin: 5361 },
  { id: '7i', name: '7 iron', Speed: 120, VLA: 16.3, TotalSpin: 7097 },
  { id: '9i', name: '9 iron', Speed: 109, VLA: 20.4, TotalSpin: 8647 },
  { id: 'PW', name: 'Pitching wedge', Speed: 102, VLA: 24.2, TotalSpin: 9304 },
  { id: 'SW', name: 'Sand wedge', Speed: 76, VLA: 31, TotalSpin: 9800 },
];
const POWERS = [{ k: 1, label: 'Full' }, { k: 0.8, label: '¾' }, { k: 0.6, label: '½' }, { k: 0.4, label: '¼' }, { k: 0.26, label: 'Chip' }];


/* ---------- the hole's ground (shared with the physics; see terrain.js) ---------- */
let HOLE = null, ISL = [], T = null;
const groundAt = (x, z) => T.groundAt(x, z);
const islandAt = (x, z) => T.islandAt(x, z);
const surfaceAt = (x, z) => T.surfaceAt(x, z);
const physSurface = (x, z) => { const s = surfaceAt(x, z); return s === 'tee' || s === 'fringe' ? 'fairway' : s === 'void' ? 'rough' : s; };
// what each lie is called, and its colour in the readout
const LIE_NAMES = { tee: 'Tee', fairway: 'Fairway', fringe: 'Fringe', firstcut: 'First cut', rough: 'Rough', desert: CAVE ? 'Cave floor' : CITY ? 'Street' : ICE ? 'Snow' : VOLC ? 'Lava rock' : MESA ? 'Native' : 'Rough', sand: 'Bunker', waste: VOLC ? 'Scoria' : 'Waste area', water: VOLC ? 'Lava' : 'Water', green: 'Green', ice: 'Ice', powder: 'Powder' };
const lieColor = l => (l === 'rough' || l === 'desert' || l === 'waste' ? 'var(--warn)' : l === 'sand' || l === 'powder' ? 'var(--sand)' : l === 'water' ? 'var(--bad)' : 'var(--ok)');

/* ---------- conditions and tees (set on the round setup screen) ---------- */
const TEE_SETS = COURSE.teeSets || [{ id: 'tee', name: 'Tees', color: '#f5c542', minDrive: 0 }];
const cond = { ...COURSE.signature, tee: TEE_SETS[Math.min(1, TEE_SETS.length - 1)].id };
let windRoll = rollWind(cond), wind = { mph: 0, from: 0 }, windVec = { x: 0, z: 0 };
const teeOf = h => (h.tees ? h.tees[cond.tee] || Object.values(h.tees)[0] : h.tee);
const yardsOf = h => (typeof h.yards === 'number' ? h.yards : h.yards[cond.tee]);
const tempF = () => TEMPS[cond.temp]?.f ?? 72;

/* ===================== renderer / scene ===================== */
const coarse = matchMedia('(pointer: coarse)').matches || !!window.__lowq;
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 2 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 12000);
const FOG_COLOR = new THREE.Color(0xbfd0dc);
scene.fog = new THREE.Fog(FOG_COLOR, 320, 4200);
const sky = new THREE.Sky(); sky.scale.setScalar(10000); scene.add(sky);
const skyU = sky.material.uniforms;
const sunDir = new THREE.Vector3(0, 1, 0);
const sun = new THREE.DirectionalLight(0xffd9b0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
const SB = MESA ? 150 : 120; Object.assign(sun.shadow.camera, { left: -SB, right: SB, top: SB, bottom: -SB, near: 1, far: 1600 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x6a7a68, 0.45); scene.add(hemi);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
// stars for night rounds
const stars = (() => {
  const R = rng(77), n = 1600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, e = Math.asin(R() * 0.97 + 0.03); pos.set([Math.cos(a) * Math.cos(e) * 6000, Math.sin(e) * 6000, Math.sin(a) * Math.cos(e) * 6000], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  p.visible = false; p.renderOrder = -2; scene.add(p); return p;
})();
// Light for the round's time of day and weather, with the sun placed for this hole's heading.
// (The Aerie's morning is the light it always had.)
function lightPreset() {
  const t = cond.time, w = cond.weather;
  const L = {
    morning: { sun: 0xffd9b0, si: 2.4, hs: 0xd6e8ff, hg: 0x6a7a68, hi: 0.45, exp: 0.6, turb: 4, ray: 1.6, mie: 0.005, fog: DESERT ? 0xd8c2ae : 0xbfd0dc },
    midday: { sun: 0xfff3e2, si: 2.7, hs: 0xd8e8ff, hg: 0x7a6a58, hi: 0.55, exp: 0.5, turb: 3, ray: 1.1, mie: 0.004, fog: DESERT ? 0xd6cbbf : 0xc4d4e0 },
    golden: { sun: 0xffa45c, si: 2.8, hs: 0xe8c8b0, hg: 0x7a5442, hi: 0.42, exp: 0.62, turb: 6.5, ray: 2.6, mie: 0.009, fog: DESERT ? 0xdcab84 : 0xe2c0a0 },
    night: { sun: 0x9fb4ff, si: 0.55, hs: 0x31436a, hg: 0x1a1612, hi: 0.4, exp: 0.9, turb: 1.5, ray: 0.4, mie: 0.003, fog: 0x0e1626 },
  }[t] || {};
  const P = { ...L, near: MESA ? 420 : 320, far: MESA ? 5200 : 4200 };
  // in the caverns: no sky, a dim cool fill, dark air; the light comes from lanterns and the sun through the roof
  // the glacier by night: moonlight off the snow, a teal-green cast from the aurora, clear dark air
  if (ICE && t === 'night') return { ...P, sun: 0xa9bcff, si: 0.75, hs: 0x48699a, hg: 0x1c2640, hi: 0.6, exp: 0.88, fog: w === 'overcast' ? 0x1a2230 : 0x0d1828, near: w === 'overcast' ? 200 : 600, far: w === 'overcast' ? 2200 : 6000 };
  if (ICE) { P.fog = w === 'overcast' ? 0xb8c2cc : 0xc8d6e4; }
  // the volcano at dusk: a low red sun through the ash, a violet sky, warm light thrown up off the lava, smoky air
  if (VOLC && t === 'golden') return { ...P, sun: 0xff7038, si: 2.1, hs: 0x8a7290, hg: 0x5a2a18, hi: 0.55, exp: 0.66, turb: 9, ray: 3.4, mie: 0.014, fog: w === 'overcast' ? 0x5a4644 : 0x8a6058, near: w === 'overcast' ? 300 : 700, far: w === 'overcast' ? 3000 : 7000 };
  if (VOLC) { P.fog = t === 'night' ? 0x1a0e0c : 0x9a8278; P.far = 7000; }
  if (CAVE) return { ...P, si: 0, hs: 0x5c6880, hg: 0x221f1b, hi: 0.5, exp: 1.05, fog: 0x080a0d, near: 120, far: 1700 };
  // Red Mesa's golden hour: a deep blue sky over a warm horizon, the low sun raking the walls, cool blue in the shadows, red bounce
  if (REDROCK && t === 'golden' && w === 'clear') Object.assign(P, { sun: 0xffa255, si: 3.3, hs: 0x9db4dc, hg: 0x8a4a30, hi: 0.5, exp: 0.6, turb: 2.4, ray: 3.0, mie: 0.004, fog: 0xe2b58e, near: 600, far: 6000 });
  if (!MESA && t === 'morning' && w === 'clear') Object.assign(P, { sun: 0xffc48a, si: 3.0, hs: 0xb8cdea, hg: 0xd9d2c4, hi: 0.62, exp: 0.6, turb: 2.6, ray: 1.9, mie: 0.005, fog: 0xece6da, near: 700, far: 5600 });
  if (w === 'haze') { P.turb += 5; P.si *= 0.82; P.hi *= 1.15; P.near *= 0.55; P.far *= 0.6; }
  if (CITY && w === 'haze' && t !== 'night') { P.fog = 0xd2cdbf; P.near = 70; P.far = 1500; P.turb = 7; P.ray = 1.2; P.si = 2.6; P.hi = 0.5; }
  if (CITY && w === 'clear' && t !== 'night') { P.near = 160; P.far = 2600; }
  if (w === 'overcast') { P.turb = 14; P.ray = 0.5; P.si *= 0.32; P.hi *= 1.9; P.near *= 0.5; P.far *= 0.5; P.fog = t === 'night' ? 0x0c1018 : DESERT ? 0xa89c92 : CITY ? 0xb4b8b6 : 0xa9b0b6; P.exp *= 1.05; }
  return P;
}
function applySky(heading = 0) {
  const T0 = TIMES[cond.time] || TIMES.morning, P = lightPreset();
  const a = skyAngles(T0.sunAz, T0.sunEl, MESA ? heading : 333);
  sunDir.setFromSphericalCoords(1, a.polar, a.azimuth);
  const skySun = T0.night ? new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(96), skyAngles(300, 0, MESA ? heading : 333).azimuth) : sunDir;
  skyU.turbidity.value = P.turb; skyU.rayleigh.value = P.ray; skyU.mieCoefficient.value = P.mie; skyU.mieDirectionalG.value = 0.85;
  skyU.sunPosition.value.copy(skySun);
  sun.color.set(P.sun); sun.intensity = P.si;
  hemi.color.set(P.hs); hemi.groundColor.set(P.hg); hemi.intensity = P.hi;
  renderer.toneMappingExposure = P.exp;
  FOG_COLOR.set(P.fog); scene.fog.near = P.near; scene.fog.far = P.far;
  scene.fog.color.copy(FOG_COLOR); // THREE.Fog copies its colour when it's made, so FOG_COLOR alone never reached it (every course played under the default pale fog until the art passes)
  if (ICE) { sky.visible = !T0.night; scene.background = T0.night ? FOG_COLOR : null; iceU.uMoon.value.copy(sunDir); }
  if (CAVE) { sky.visible = false; scene.background = FOG_COLOR; sun.castShadow = false; stars.visible = false; scene.environment = null; ball.material.emissive.set(0xa8c4d0); ball.material.emissiveIntensity = 0.35; return; }
  sun.shadow.radius = cond.weather === 'overcast' ? 6 : 1;
  stars.visible = !!T0.night && cond.weather !== 'overcast';
  // the city in mist: under an overcast the sky is the fog itself, so the towers fade into it
  if (CITY) { const misty = cond.weather === 'overcast' && !T0.night; sky.visible = !misty; scene.background = misty ? FOG_COLOR : null;
    if (cityClouds) { cityClouds.visible = !T0.night && cond.weather !== 'overcast'; cityClouds.material.uniforms.uCov.value = cond.weather === 'overcast' ? 0.95 : cond.weather === 'haze' ? 0.47 : 0.36; cityClouds.material.uniforms.uSun.value = sunDir; cityClouds.material.uniforms.uHaze.value.set(P.fog); } }
  if (CITY && cond.weather === 'overcast' && !T0.night) { scene.fog.near = 60; scene.fog.far = 900; }
  ball.material.emissive.set(T0.night ? 0xbfe8ff : 0x000000); ball.material.emissiveIntensity = T0.night ? 1.4 : 0;
  // image-based light from the same sky
  const es = new THREE.Scene(), s2 = new THREE.Sky(); s2.scale.setScalar(1000); es.add(s2);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = skyU[k].value;
  s2.material.uniforms.sunPosition.value.copy(skySun);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(es, 0.02); scene.environment = envRT.texture;
  s2.material.dispose(); s2.geometry.dispose();
  if (cloudMats) cloudMats.forEach(m => { m.uniforms.uSun.value = sunDir; });
}
const clockU = { value: 0 };

/* ---------- cloud sea ---------- */
const FOG_GLSL_V = `
#include <fog_pars_vertex>
`;
function cloudLayer(y, scale, alpha, speed) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: sunDir }, uA: { value: alpha }, uS: { value: scale }, uV: { value: speed } }]),
    vertexShader: `varying vec3 vW; ${FOG_GLSL_V}
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `varying vec3 vW; uniform float uT, uA, uS, uV; uniform vec3 uSun;
      #include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      float fb(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s += a*vn(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
      void main(){
        vec2 p = vW.xz * uS + vec2(uT*uV, uT*uV*0.4);
        float n = fb(p + fb(p*0.5 + uT*0.01)*1.6);
        float a = smoothstep(0.3, 0.6, n) * uA;
        // cumulus tops seen from above: bright where they bulge toward the sun, blue-grey in the folds between
        vec2 sd = normalize(uSun.xz + 1e-4) * 0.08;
        float bulge = clamp((n - fb(p + sd + fb((p + sd)*0.5 + uT*0.01)*1.6)) * 4.0 + 0.55, 0.0, 1.0);
        float lit = mix(0.55, 1.0, bulge) * (0.85 + 0.15*smoothstep(0.45, 0.85, fb(p*1.7 + 3.0)));
        vec3 col = mix(vec3(0.66,0.72,0.8), vec3(1.0,0.95,0.88), lit) * (0.88 + 0.18*uSun.y);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1).rotateX(-Math.PI / 2), mat);
  m.position.y = y; m.renderOrder = -1; scene.add(m);
  return mat;
}
const cloudMats = MESA ? [] : [cloudLayer(-300, 0.0016, 1.0, 1.0), cloudLayer(-190, 0.0028, 0.6, 1.8)];
// The Reclaim: big cumulus overhead, seen from below, fading into the haze toward the horizon
const cityClouds = CITY ? (() => {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uSun: { value: sunDir }, uCov: { value: 0.5 }, uHaze: { value: new THREE.Color(0xd2cdbf) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vW; uniform float uT, uCov; uniform vec3 uSun, uHaze;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      float fb(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s += a*vn(p); p = p*2.07 + 3.1; a *= 0.5; } return s; }
      float dens(vec2 p){ float n = fb(p + vec2(vn(p*0.5), vn(p*0.5+7.3))*0.5) + 0.35*vn(p*0.3); return smoothstep(1.06-uCov, 1.16-uCov, n*0.9); }
      void main(){
        vec2 p = vW.xz * 0.0024 + vec2(uT*0.004, uT*0.0016);
        float d = dens(p), thick = dens(p*0.55 + 11.0) * d;              // the heart of a big cloud is thicker, its base darker
        vec2 sd = normalize(uSun.xz + 1e-4) * 0.05;
        float lit = clamp(1.0 - dens(p + sd) * 0.8, 0.0, 1.0);           // the edge toward the sun catches it
        vec3 base = vec3(0.6,0.62,0.66), top = vec3(1.0,0.98,0.94);
        vec3 col = mix(top, base, smoothstep(0.2, 0.95, d * (0.55 + 0.45*thick)) * (1.0 - 0.6*lit));
        col *= 0.75 + 0.25*smoothstep(0.0, 0.5, uSun.y);
        float dist = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(2500.0, 7500.0, dist);
        col = mix(col, uHaze, smoothstep(1500.0, 7000.0, dist)*0.85);
        gl_FragColor = vec4(col, d * fade * 0.96);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000, 1, 1).rotateX(Math.PI / 2), mat);
  m.position.y = 900; m.renderOrder = -1; m.frustumCulled = false; scene.add(m);
  return m;
})() : null;

/* ---------- materials ---------- */
const islandMat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, envMapIntensity: 0.6 });
const holeDirU = { value: new THREE.Vector2(0, -1) };
const surf2U = { value: null };
// Rimeholm: the moon's direction, the wind (for the sastrugi), and warm pools of light from the braziers and
// cairns, drawn in the ground shader (no real lights)
const iceU = { uMoon: { value: new THREE.Vector3(0.5, 0.6, 0.5) }, uWind: { value: new THREE.Vector2(0.6, 0.8) }, uPools: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uPoolN: { value: 0 } };
const surfU = { uSurf: { value: null }, uSurfMin: { value: new THREE.Vector2() }, uSurfSize: { value: new THREE.Vector2(1, 1) }, uFloorY: { value: -1e4 } };
islandMat.onBeforeCompile = sh => {
  sh.uniforms.uDir = holeDirU; Object.assign(sh.uniforms, surfU);
  if (MESA) sh.defines = { ...(sh.defines || {}), MESA: '' };
  if (CITY) sh.defines = { ...(sh.defines || {}), CITY: '' };
  if (ICE) { sh.defines = { ...(sh.defines || {}), ICE: '' }; sh.uniforms.uSurf2 = surf2U; Object.assign(sh.uniforms, iceU); }
  if (VOLC) { sh.defines = { ...(sh.defines || {}), VOLC: '' }; sh.uniforms.uSurf2 = surf2U; sh.uniforms.uClock = clockU; }
  if (CAVE) sh.defines = { ...(sh.defines || {}), CAVE: '' };
  if (SHAPED) sh.defines = { ...(sh.defines || {}), PAINT: '' };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aW; attribute float aDepth; varying vec4 vW4; varying float vDepth; varying vec3 vWPos; varying vec3 vWN;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW4 = aW; vDepth = aDepth; vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec4 vW4; varying float vDepth; varying vec3 vWPos; varying vec3 vWN; uniform vec2 uDir;
uniform sampler2D uSurf; uniform vec2 uSurfMin, uSurfSize; uniform float uFloorY;
#ifdef ICE
uniform sampler2D uSurf2; uniform vec3 uMoon; uniform vec2 uWind; uniform vec4 uPools[24]; uniform int uPoolN;
#endif
#ifdef VOLC
uniform sampler2D uSurf2; uniform float uClock; float vGlow = 0.0;
#endif
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fb(vec2 p){ return vn(p)*0.5 + vn(p*2.07+3.1)*0.25 + vn(p*4.13+7.7)*0.125 + vn(p*8.4+1.3)*0.0625; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
float strataLine(float y){ return smoothstep(0.0, 0.25, abs(fract(y*0.11) - 0.5)); }`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef VOLC
totalEmissiveRadiance += vec3(1.0, 0.32, 0.07) * vGlow;
#endif
#ifdef ICE
for (int i = 0; i < 24; i++) { if (i >= uPoolN) break; vec4 L = uPools[i]; float d = length(vWPos.xz - L.xy); float f = 1.0 - smoothstep(0.0, L.z, d); totalEmissiveRadiance += vec3(1.0, 0.6, 0.28) * f * f * L.w * diffuseColor.rgb; }
#endif`)
    .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float fine = mix(fb(p.xz*3.0), 0.5, smoothstep(20.0, 80.0, camD));
float mid = fb(p.xz*0.17);
float along = dot(p.xz, uDir);
float stripe = step(0.5, fract(along / 12.0));
vec3 rough = mix(lin(vec3(0.2,0.37,0.13)), lin(vec3(0.28,0.42,0.16)), mid) * (0.8 + 0.4*fine);
#ifndef MESA
rough = mix(lin(vec3(0.24,0.32,0.12)), lin(vec3(0.34,0.38,0.15)), mid) * (0.74 + 0.5*fine);   // the Aerie: longer, darker, a little golden
#endif
vec3 fair = mix(lin(vec3(0.3,0.5,0.17)), lin(vec3(0.38,0.58,0.21)), stripe) * (0.9 + 0.18*mid) * (0.92 + 0.16*fine);
#ifndef MESA
fair = mix(lin(vec3(0.36,0.58,0.2)), lin(vec3(0.44,0.66,0.25)), stripe) * (0.92 + 0.14*mid) * (0.94 + 0.12*fine);
#endif
vec3 grn = lin(vec3(0.36,0.61,0.24)) * (0.95 + 0.1*vn(p.xz*0.8)) * (0.97 + 0.06*fine);
#ifndef MESA
grn = lin(vec3(0.3,0.56,0.25)) * (0.97 + 0.06*vn(p.xz*0.8)) * (0.98 + 0.04*fine);
#endif
vec3 sand = lin(vec3(0.86,0.79,0.62)) * (0.92 + 0.12*fine);
#ifdef MESA
// Red Mesa: painted surfaces from the hole's texture over scrub (mesa tops) or bare red earth (floor)
vec2 st = (p.xz - uSurfMin) / uSurfSize;
float inTex = step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
vec4 sf = mix(vec4(0.0), texture2D(uSurf, clamp(st, 0.0, 1.0)), inTex);
#ifndef ICE
// native ground: scrub and red earth on the mesa tops, bare red earth on the canyon floor
vec3 scrub = mix(lin(vec3(0.5,0.42,0.28)), lin(vec3(0.6,0.47,0.31)), mid) * (0.8 + 0.4*fine);
scrub = mix(scrub, lin(vec3(0.68,0.42,0.27)), smoothstep(0.45, 0.75, fb(p.xz*0.06)) * 0.7);
vec3 dirt = mix(lin(vec3(0.66,0.4,0.25)), lin(vec3(0.76,0.52,0.33)), mid) * (0.85 + 0.3*fine);
#if !defined(CAVE) && !defined(CITY) && !defined(ICE)
// red earth under sagebrush: silver-green scrub in patches, slickrock showing through, darker cryptobiotic crust
scrub = mix(lin(vec3(0.62,0.38,0.24)), lin(vec3(0.7,0.46,0.3)), mid) * (0.82 + 0.34*fine);
scrub = mix(scrub, lin(vec3(0.5,0.52,0.42)), smoothstep(0.42, 0.7, fb(p.xz*0.09 + 4.0)) * 0.55);
scrub = mix(scrub, lin(vec3(0.82,0.62,0.46)), smoothstep(0.62, 0.8, fb(p.xz*0.025 + 9.0)) * 0.6);
scrub = mix(scrub, lin(vec3(0.38,0.26,0.19)), smoothstep(0.6, 0.85, vn(p.xz*0.7)) * 0.35);
dirt = mix(lin(vec3(0.68,0.4,0.25)), lin(vec3(0.78,0.5,0.32)), mid) * (0.85 + 0.3*fine);
dirt = mix(dirt, lin(vec3(0.84,0.62,0.44)), smoothstep(0.55, 0.8, fb(p.xz*0.04 + 2.0)) * 0.5);
#endif
#ifdef CAVE
// a cave: damp mud and broken stone off the play, darker on the floor
scrub = mix(lin(vec3(0.34,0.3,0.26)), lin(vec3(0.42,0.37,0.31)), mid) * (0.75 + 0.45*fine);
dirt = mix(lin(vec3(0.22,0.2,0.18)), lin(vec3(0.3,0.27,0.23)), mid) * (0.8 + 0.35*fine);
#endif
#ifdef CITY
// a city gone to grass: cracked asphalt, grass and weeds up the cracks, broken concrete on the steep banks
float crack = 1.0 - smoothstep(0.0, 0.045, abs(fb(p.xz*0.21) - 0.5));
float crack2 = 1.0 - smoothstep(0.0, 0.035, abs(vn(p.xz*0.37 + 3.0) - 0.5));
scrub = mix(lin(vec3(0.35,0.34,0.31)), lin(vec3(0.44,0.42,0.38)), mid) * (0.82 + 0.3*fine);
scrub = mix(scrub, lin(vec3(0.4,0.36,0.28)), smoothstep(0.5, 0.75, fb(p.xz*0.13 + 9.0)) * 0.35);   // dust and leaf litter
scrub = mix(scrub, lin(vec3(0.28,0.37,0.18)), max(crack, crack2) * 0.85);
scrub = mix(scrub, lin(vec3(0.3,0.4,0.2)), smoothstep(0.5, 0.78, fb(p.xz*0.05)) * 0.7);
dirt = scrub;
#endif
#endif
#if defined(VOLC)
// Emberfell: uSurf R mown (fairway, tee), G grass (green 1, collar 0.5), B ash-grey sand, A grass length (rough 0.55);
// uSurf2 R red cinder (native 0.7, scoria waste 1), G grey ash (rubble 0.5), B glow (crust 1, the lava's light on
// its shores 0..0.5), A sulfur (1) or sinter (0.5). Native ground is fresh black lava: ropy, rusting in patches
vec4 s2 = mix(vec4(0.0), texture2D(uSurf2, clamp(st, 0.0, 1.0)), inTex);
float rope = 0.5 + 0.5*sin(dot(p.xz, vec2(0.9,0.4))*2.6 + fb(p.xz*0.2)*8.0);
vec3 col = mix(lin(vec3(0.085,0.08,0.085)), lin(vec3(0.15,0.14,0.14)), mid) * (0.72 + 0.5*fine) * (0.9 + 0.14*rope*(1.0 - smoothstep(20.0, 70.0, camD)));
col = mix(col, lin(vec3(0.19,0.11,0.08)), smoothstep(0.55, 0.8, fb(p.xz*0.03 + 5.0)) * 0.35);
vec3 cinder = mix(lin(vec3(0.36,0.12,0.07)), lin(vec3(0.48,0.19,0.1)), mid) * (0.8 + 0.35*fine);
vec3 ash = mix(lin(vec3(0.4,0.38,0.35)), lin(vec3(0.5,0.48,0.44)), mid) * (0.85 + 0.25*fine);
col = mix(col, cinder, smoothstep(0.3, 0.65, s2.r));
col = mix(col, ash, smoothstep(0.3, 0.7, s2.g) * mix(0.55, 1.0, smoothstep(0.6, 0.9, s2.g)));
col = mix(col, mix(lin(vec3(0.82,0.8,0.74)), lin(vec3(0.9,0.88,0.82)), mid), smoothstep(0.3, 0.45, s2.a) * (1.0 - smoothstep(0.6, 0.8, s2.a)));   // sinter
col = mix(col, mix(lin(vec3(0.72,0.64,0.22)), lin(vec3(0.86,0.8,0.4)), fine), smoothstep(0.7, 0.95, s2.a));                                  // sulfur
float crust = smoothstep(0.75, 0.95, s2.b);
col = mix(col, lin(vec3(0.035,0.03,0.03)) * (0.8 + 0.4*fine), crust);
vec3 mrough = mix(lin(vec3(0.24,0.3,0.12)), lin(vec3(0.3,0.36,0.14)), mid) * (0.74 + 0.46*fine);
vec3 mfair = mix(lin(vec3(0.3,0.46,0.16)), lin(vec3(0.37,0.53,0.19)), stripe) * (0.9 + 0.16*mid) * (0.93 + 0.14*fine);
vec3 asand = lin(vec3(0.5,0.48,0.45)) * (0.9 + 0.14*fine) * (0.95 + 0.05*sin(p.x*3.0 + p.z*1.7));
vec3 scoria = mix(lin(vec3(0.42,0.15,0.08)), lin(vec3(0.56,0.23,0.12)), fine) * (0.9 + 0.15*vn(p.xz*6.0));
col = mix(col, mrough, smoothstep(0.12, 0.5, sf.a));
col = mix(col, mfair, sf.r); col = mix(col, grn, sf.g); col = mix(col, asand, smoothstep(0.35, 0.75, sf.b));
col = mix(col, scoria, smoothstep(0.82, 0.98, s2.r));
// steep faces: basalt in flows a few metres thick, red clinker between them
float rw = max(vW4.w, 1.0 - smoothstep(0.45, 0.65, vWN.y));
float vband = fb(vec2(p.y*0.2, (p.x+p.z)*0.004)), layer = fract(p.y*0.17 + fb(p.xz*0.01)*2.0);
vec3 rock = mix(lin(vec3(0.11,0.1,0.1)), lin(vec3(0.2,0.18,0.17)), vband);
rock = mix(rock, lin(vec3(0.3,0.13,0.08)), smoothstep(0.82, 0.92, layer) * 0.8);
rock *= 0.8 + 0.3*fine;
col = mix(col, rock, rw);
diffuseColor.rgb = col;
// glow: the crust's seams, and the lava's light thrown on its shores
float seamV = 1.0 - smoothstep(0.0, 0.05, abs(fb(p.xz*0.32) - 0.5));
vGlow = crust * seamV * (0.55 + 0.45*sin(uClock*0.8 + fb(p.xz*0.1)*10.0)) * 1.6;
float shore = min(s2.b, 0.5) * 2.0 * (1.0 - crust);
vGlow += shore * shore * 0.12 * (0.85 + 0.15*sin(uClock*1.3 + p.x*0.05));
#elif defined(ICE)
// Rimeholm: snow and ice. uSurf: R packed snow (fairways, tees), G grass (green 1, its collar 0.5), B black sand,
// A rough (powder, 0.55); uSurf2: R lake ice, G bare rock, B powder bunker, A travertine
vec4 s2 = mix(vec4(0.0), texture2D(uSurf2, clamp(st, 0.0, 1.0)), inTex);
// the snow's shape: drifts tens of metres across and sastrugi (wind-carved ridges a few metres long, lined up
// with the wind), each with a face lit by the moon and a blue shadow behind it; glints close by
vec2 wd = normalize(uWind + vec2(1e-4)), mz = normalize(uMoon.xz + vec2(1e-4));
vec2 wp = vec2(dot(p.xz, wd), dot(p.xz, vec2(-wd.y, wd.x)));
float drift = fb(p.xz*0.045 + 3.0), dA = fb(p.xz*0.022 + 1.7), dB = fb((p.xz + mz*4.0)*0.022 + 1.7);
vec3 snowLit = lin(vec3(0.86,0.9,0.96)), snowShade = lin(vec3(0.5,0.6,0.78));
vec3 snow = mix(lin(vec3(0.8,0.85,0.93)), snowLit, drift) * (0.95 + 0.07*fine);
snow = mix(snow, snowShade, clamp((dA - dB)*9.0, 0.0, 1.0) * 0.55);                                      // the lee of each drift
snow = mix(snow, snowLit * 1.06, clamp((dB - dA)*9.0, 0.0, 1.0) * 0.35);
float nearS = 1.0 - smoothstep(30.0, 110.0, camD);
if (nearS > 0.0) {   // sastrugi only close by
float sa = vn(vec2(wp.x*0.3, wp.y*1.6)) + 0.5*vn(vec2(wp.x*0.7 + 3.0, wp.y*3.4)), sb = vn(vec2((wp.x*0.3) + dot(mz, wd)*0.12, wp.y*1.6 + dot(mz, vec2(-wd.y, wd.x))*0.9)) + 0.5*vn(vec2(wp.x*0.7 + 3.0 + dot(mz, wd)*0.28, wp.y*3.4 + dot(mz, vec2(-wd.y, wd.x))*1.9));
float ridge = smoothstep(0.55, 1.05, sa);
snow = mix(snow, snowShade, clamp((sa - sb)*2.2, 0.0, 1.0) * ridge * nearS * 0.75);                   // sastrugi
snow = mix(snow, snowLit * 1.1, clamp((sb - sa)*2.2, 0.0, 1.0) * ridge * nearS * 0.45);
}
snow = mix(snow, lin(vec3(0.68,0.77,0.9)), smoothstep(0.55, 0.85, fb(p.xz*0.012)) * 0.3);               // wind-scoured blue patches
float glint = step(0.9965, h21(floor(p.xz*9.0) + floor(dot(normalize(cameraPosition - p), vec3(3.1, 1.7, 2.3))*4.0))) * (1.0 - smoothstep(6.0, 28.0, camD));
snow += vec3(glint) * 0.9;
vec3 powderR = mix(lin(vec3(0.9,0.93,0.98)), lin(vec3(0.97,0.98,1.0)), mid) * (0.9 + 0.12*fine);         // soft rough: brighter, lumpier
vec3 packed = mix(lin(vec3(0.78,0.84,0.92)), lin(vec3(0.84,0.89,0.96)), stripe) * (0.95 + 0.06*mid);    // groomed fairway, mown in stripes
packed *= 0.96 + 0.05*step(0.5, fract(dot(p.xz, vec2(-uDir.y, uDir.x))*1.4));                            // the groomer's corduroy
vec3 col = snow;
col = mix(col, powderR, smoothstep(0.12, 0.5, sf.a) * (1.0 - smoothstep(0.75, 1.0, sf.a)));
col = mix(col, packed, sf.r);
vec3 collar = mix(lin(vec3(0.3,0.5,0.22)), lin(vec3(0.34,0.55,0.25)), mid) * (0.9 + 0.12*fine);
vec3 putt = lin(vec3(0.33,0.6,0.27)) * (0.95 + 0.1*vn(p.xz*0.8)) * (0.97 + 0.06*fine);
if (sf.g > 0.04 && sf.g < 0.47) {
vec3 moss = mix(lin(vec3(0.42,0.5,0.26)), lin(vec3(0.6,0.52,0.3)), fb(p.xz*0.4)) * (0.85 + 0.2*fine);   // warm moss round the greens and pools
col = mix(col, moss, smoothstep(0.08, 0.26, sf.g) * (1.0 - smoothstep(0.38, 0.46, sf.g)) * smoothstep(0.3, 0.6, fb(p.xz*0.9 + 4.0) + 0.25));
}
col = mix(col, collar, smoothstep(0.33, 0.46, sf.g)); col = mix(col, putt, smoothstep(0.6, 0.95, sf.g));
vec3 blacks = lin(vec3(0.13,0.12,0.12)) * (0.85 + 0.25*fine) * (0.95 + 0.05*sin(p.x*3.0 + p.z*1.7));
col = mix(col, blacks, smoothstep(0.35, 0.75, sf.b));
vec3 pwd = lin(vec3(0.97,0.98,1.0)) * (0.92 + 0.1*fine) * (0.96 + 0.04*sin(p.x*2.1 - p.z*2.7));
col = mix(col, pwd, smoothstep(0.35, 0.75, s2.b));
vec3 lakeI = mix(lin(vec3(0.16,0.26,0.36)), lin(vec3(0.3,0.44,0.56)), fb(p.xz*0.08)) ;
lakeI = mix(lakeI, lin(vec3(0.75,0.85,0.92)), (1.0 - smoothstep(0.0, 0.03, abs(fb(p.xz*0.07) - 0.5))) * 0.8);  // cracks in the ice
lakeI = mix(lakeI, snow, smoothstep(0.55, 0.8, fb(p.xz*0.05 + 7.0)) * 0.5);                             // snow drifted over it
col = mix(col, lakeI, s2.r);
vec3 trav = mix(lin(vec3(0.82,0.75,0.6)), lin(vec3(0.9,0.84,0.7)), mid) * (0.85 + 0.2*fine);
col = mix(col, trav, s2.a);
vec3 bare = mix(lin(vec3(0.2,0.2,0.22)), lin(vec3(0.3,0.3,0.32)), mid) * (0.8 + 0.3*fine);
col = mix(col, bare, s2.g);
// steep faces: blue glacial ice in layers half a metre to two metres thick, white near the top, deepening below;
// or black basalt in columns where the paint says rock (Svartifoss), snow on the ledges
float rw = max(vW4.w, 1.0 - smoothstep(0.5, 0.68, vWN.y));
if (rw > 0.003) {   // faces only: the column pattern is the costly part, so flat ground skips it
float band = fb(vec2(p.y*0.22, (p.x+p.z)*0.004)), layer = smoothstep(0.35, 0.5, abs(fract(p.y*0.55 + fb(p.xz*0.05)*1.5) - 0.5));
vec3 rock = mix(lin(vec3(0.3,0.5,0.68)), lin(vec3(0.6,0.76,0.86)), band) * (0.88 + 0.16*layer);
rock = mix(rock, lin(vec3(0.12,0.26,0.42)), smoothstep(0.5, 0.8, fb(vec2((p.x+p.z)*0.2, p.y*0.05))) * 0.6);
vec2 cq = p.xz*1.25, ci = floor(cq), cf = fract(cq); float c1 = 8.0, c2 = 8.0; vec2 cid = ci;
for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)), o = vec2(h21(ci + g), h21(ci + g + 17.0)); float d = length(g + o - cf); if (d < c1) { c2 = c1; c1 = d; cid = ci + g; } else if (d < c2) c2 = d; }
float joint = 1.0 - smoothstep(0.02, 0.09, c2 - c1);
vec3 dark = mix(lin(vec3(0.1,0.1,0.11)), lin(vec3(0.2,0.2,0.22)), h21(cid)) * (0.85 + 0.25*fine);
dark *= 1.0 - 0.6*joint;
dark *= 0.9 + 0.12*step(0.93, fract(p.y*0.7 + h21(cid)*3.0));
rock = mix(rock, dark, smoothstep(0.25, 0.6, s2.g));
rock *= (0.85 + 0.2*fine);
col = mix(col, rock, rw);
}
diffuseColor.rgb = col;
#else
vec3 col = mix(scrub, dirt, 1.0 - step(uFloorY + 4.0, p.y));
// grass by length: rough (dry, tufted), first cut, then the mown surfaces
vec3 mrough = mix(lin(vec3(0.42,0.44,0.22)), lin(vec3(0.5,0.5,0.26)), mid) * (0.72 + 0.5*fine);
vec3 mcut = mix(lin(vec3(0.33,0.46,0.18)), lin(vec3(0.38,0.5,0.2)), mid) * (0.88 + 0.2*fine);
vec3 mfair = mix(lin(vec3(0.33,0.52,0.18)), lin(vec3(0.41,0.6,0.22)), stripe) * (0.9 + 0.18*mid) * (0.92 + 0.16*fine);
vec3 msand = lin(vec3(0.9,0.74,0.56)) * (0.9 + 0.14*fine) * (0.94 + 0.06*sin(p.x*3.0 + p.z*1.7));
#ifdef CAVE
// underground turf: no mower stripes, mossy and darker, so the lit pools of the green and the landing area
// glow and the rest falls away into the dark
mrough = mix(lin(vec3(0.2,0.25,0.12)), lin(vec3(0.27,0.3,0.15)), mid) * (0.7 + 0.5*fine);
mcut = mix(lin(vec3(0.23,0.32,0.13)), lin(vec3(0.27,0.36,0.15)), mid) * (0.85 + 0.25*fine);
mfair = mix(lin(vec3(0.25,0.38,0.14)), lin(vec3(0.3,0.42,0.16)), mid) * (0.9 + 0.2*fine);
#endif
#if !defined(CAVE) && !defined(CITY)
// Red Mesa: red silica sand in the bunkers, ripples in the washes
msand = mix(lin(vec3(0.8,0.5,0.33)), lin(vec3(0.86,0.6,0.42)), mid) * (0.9 + 0.14*fine) * (0.94 + 0.06*sin(p.x*3.0 + p.z*1.7));
#endif
col = mix(col, mrough, smoothstep(0.12, 0.5, sf.a));
col = mix(col, mcut, smoothstep(0.7, 0.95, sf.a));
col = mix(col, mfair, sf.r); col = mix(col, grn, sf.g); col = mix(col, msand, smoothstep(0.35, 0.75, sf.b));
// red sandstone: strata, pale bands and dark desert varnish down the faces
float band = fb(vec2(p.y*0.16, (p.x+p.z)*0.003));
float steep = 1.0 - abs(vWN.y);
#if !defined(CAVE) && !defined(CITY)
// Navajo sandstone: rust to salmon in thick sets, pale bleached bands, fine cross-bedding inside each set,
// a harder pale caprock along the rim with a shadowed lip under it, and desert varnish streaking down from
// the pour-offs (strongest near the top, fading down the face, never a full-height stripe)
float setY = p.y*0.09 + fb(p.xz*0.004)*1.5;
vec3 rock = mix(lin(vec3(0.66,0.29,0.16)), lin(vec3(0.8,0.43,0.25)), band);
rock = mix(rock, lin(vec3(0.85,0.55,0.38)), smoothstep(0.55, 0.8, fb(vec2(setY*2.0, (p.x-p.z)*0.006))) * 0.6);
rock = mix(rock, lin(vec3(0.9,0.8,0.66)), smoothstep(0.7, 0.86, fb(vec2(p.y*0.35, (p.x+p.z)*0.004))) * 0.65);
float xb = abs(fract((p.y + (p.x*0.6 + p.z*0.8) * (0.35 + 0.25*sin(floor(setY)*2.7))) * 0.9) - 0.5);
rock *= 0.92 + 0.08*smoothstep(0.0, 0.12, xb);
float rimD = vDepth;
float cap = (1.0 - smoothstep(2.5, 5.5, rimD)) * step(0.5, vW4.w);
rock = mix(rock, lin(vec3(0.82,0.62,0.46)), cap * 0.75);
rock *= 1.0 - 0.35 * smoothstep(4.5, 6.0, rimD) * (1.0 - smoothstep(6.0, 9.0, rimD)) * step(0.5, vW4.w);
float pour = smoothstep(0.5, 0.82, fb(vec2((p.x+p.z)*0.16, 3.0)));
float runs = smoothstep(0.35, 0.75, fb(vec2((p.x+p.z)*0.55, p.y*0.015)));
float varnish = pour * runs * (1.0 - smoothstep(8.0, 30.0 + 40.0*pour, rimD)) * steep * step(0.5, vW4.w);
varnish = max(varnish, smoothstep(0.62, 0.85, fb(vec2((p.x+p.z)*0.3, p.y*0.02))) * steep * 0.45);
rock = mix(rock, lin(vec3(0.17,0.09,0.06)), varnish * 0.75);
rock *= (0.82 + 0.18*fine) * (0.92 + 0.08*strataLine(p.y));
#else
vec3 rock = mix(lin(vec3(0.6,0.25,0.14)), lin(vec3(0.8,0.43,0.24)), band);
rock = mix(rock, lin(vec3(0.86,0.64,0.44)), smoothstep(0.6, 0.78, fb(vec2(p.y*0.45, (p.x-p.z)*0.008))) * 0.55);
float varnish = smoothstep(0.42, 0.78, fb(vec2((p.x+p.z)*0.22, p.y*0.012))) * steep;
rock = mix(rock, lin(vec3(0.2,0.1,0.07)), varnish * 0.7);
rock *= (0.8 + 0.2*fine) * (0.9 + 0.1*strataLine(p.y));
#endif
#ifdef CAVE
// limestone: grey, banded, with pale flowstone running down the faces
rock = mix(lin(vec3(0.42,0.4,0.37)), lin(vec3(0.58,0.55,0.5)), band);
rock = mix(rock, lin(vec3(0.78,0.72,0.6)), smoothstep(0.55, 0.8, fb(vec2((p.x+p.z)*0.25, p.y*0.02))) * steep * 0.6);
rock *= (0.8 + 0.2*fine) * (0.9 + 0.1*strataLine(p.y));
#endif
#ifdef CITY
rock = mix(lin(vec3(0.34,0.33,0.31)), lin(vec3(0.44,0.43,0.4)), band) * (0.8 + 0.25*fine);
rock = mix(rock, lin(vec3(0.27,0.34,0.18)), smoothstep(0.45, 0.72, fb(p.xz*0.3 + p.y*0.2)) * 0.65);
#endif
float rw = max(vW4.w, 1.0 - smoothstep(0.42, 0.62, vWN.y));
col = mix(col, rock, rw);
diffuseColor.rgb = col;
#endif
#else
vec3 col = rough;
#ifdef PAINT
// a shaped sky course: surfaces from the hole's paint texture (first cut a shade lighter than rough)
vec2 st = (p.xz - uSurfMin) / uSurfSize;
float inTex = step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
vec4 sf = mix(vec4(0.0), texture2D(uSurf, clamp(st, 0.0, 1.0)), inTex);
vec3 cut = mix(lin(vec3(0.26,0.43,0.16)), lin(vec3(0.32,0.48,0.19)), mid) * (0.88 + 0.2*fine);
col = mix(col, cut, smoothstep(0.7, 0.95, sf.a) * (1.0 - sf.r));
col = mix(col, fair, sf.r); col = mix(col, grn, sf.g); col = mix(col, sand, smoothstep(0.35, 0.75, sf.b));
#else
col = mix(col, fair, vW4.x);
col = mix(col, grn, vW4.y);
col = mix(col, sand, vW4.z);
#endif
// rock: pale sandstone with vertical water streaks, strata and moss on ledges
float ang = atan(p.z, p.x);
float streak = fb(vec2(p.x*0.35 + p.z*0.35, p.y*0.02));
float strata = 0.5 + 0.5*sin(p.y*0.45 + fb(p.xz*0.05)*6.0);
vec3 rock = mix(lin(vec3(0.8,0.74,0.63)), lin(vec3(0.6,0.55,0.47)), streak);
rock = mix(rock, lin(vec3(0.85,0.7,0.5)), smoothstep(0.45, 0.8, fb(vec2(p.y*0.07, (p.x+p.z)*0.002))) * 0.6);   // amber bands
rock *= 0.86 + 0.14*strata;
float frac = 1.0 - smoothstep(0.0, 0.035, abs(fb(vec2(ang*7.0 + p.y*0.004, 1.3)) - 0.5));                    // vertical fractures
rock *= 1.0 - 0.45*frac;
rock = mix(rock, lin(vec3(0.3,0.27,0.24)), smoothstep(0.55, 0.75, fb(vec2(p.x*0.9+p.z*0.9, p.y*0.015))) * 0.6);
float moss = clamp(smoothstep(0.35, 0.75, vWN.y) + (1.0 - smoothstep(1.5, 7.0, vDepth)) * 0.9, 0.0, 1.0) * smoothstep(0.35, 0.6, fb(p.xz*0.3 + p.y*0.2));
moss = max(moss, 1.0 - smoothstep(0.5, 3.0, vDepth));
rock = mix(rock, lin(vec3(0.24,0.36,0.15)) * (0.8+0.4*fine), moss);
rock *= mix(1.0, 0.42, smoothstep(10.0, 140.0, vDepth));
col = mix(col, rock, vW4.w);
diffuseColor.rgb = col;
#endif
`);
};

/* ---------- island mesh ---------- */
function buildIsland(I, detail, group, trees) {
  const N = detail.seg;
  let rings = [0, 0.08, 0.17, 0.27, 0.38, 0.5, 0.6, 0.7, 0.78, 0.85, 0.9, 0.94, 0.97, 0.99, 1];
  if (MESA && Math.max(I.rx, I.rz) > 45) { const n = Math.min(40, Math.round(Math.max(I.rx, I.rz) / 6)); rings = Array.from({ length: n }, (_, i) => Math.pow(i / (n - 1), 0.8)).filter(r => r < 0.95).concat([0.97, 0.99, 1]); }
  if (MESA) return buildMesa(I, N, rings, group, trees);
  const K = detail.side;
  const D = I.depth;
  const rows = rings.length + K;
  const pos = new Float32Array((N + 1) * rows * 3), aW = new Float32Array((N + 1) * rows * 4), aD = new Float32Array((N + 1) * rows);
  const R = rng(I.seed * 977 + 13);
  const lean = [(R() - 0.5) * 0.25, (R() - 0.5) * 0.25];
  let vi = 0;
  const rimY = [];
  for (let j = 0; j <= N; j++) {
    const th = (j / N) * Math.PI * 2;
    const e = edgeRadius(I, th);
    let ry = 0;
    for (let r = 0; r < rings.length; r++) {
      const s = rings[r] * 0.999;
      const x = I.x + (e.x - I.x) * s, z = I.z + (e.z - I.z) * s;
      const f = islandF(I, x, z);
      let y = islandH(I, x, z, Math.min(f, 1));
      if (SHAPED && I.playable && T.topAt(x, z)?.I === I) { const g = T.groundAt(x, z); if (g !== null) y = s < 0.96 ? g - 1.5 : g; }
      if (I.dome) y += I.dome * (1 - s * s);
      pos.set([x, y, z], vi * 3);
      const sf = I.playable ? surfaceAt(x, z) : 'rough';
      aW.set([sf === 'fairway' || sf === 'tee' ? 1 : 0, sf === 'green' ? 1 : 0, sf === 'sand' ? 1 : 0, 0], vi * 4);
      aD[vi] = 0; vi++; ry = y;
    }
    rimY[j] = ry;
    // underside: tapered, fluted columns
    const arc = th * Math.max(I.rx, I.rz);
    for (let k = 1; k <= K; k++) {
      const t = Math.pow(k / K, 1.35), d = t * D;
      let taper = Math.pow(Math.max(0, 1 - t), 0.75);
      if (I.form === 'pillar') taper = t < 0.82 ? 1 - 0.14 * t : (1 - 0.115) * Math.pow(Math.max(0, (1 - t) / 0.18), 0.6);   // sheer sides, rounded off at the foot
      else if (I.form === 'stepped') { const st = Math.min(3, Math.floor(t * 4)); taper = Math.max(0, (1 - st * 0.22) * (1 - 0.1 * (t * 4 - st)) * (t > 0.9 ? (1 - t) / 0.1 : 1)); } // benches
      if (k === 1) taper = 1.035;
      const flute = 1 + 0.16 * (fbm(arc / 9 + I.seed, d / 45) - 0.5) * 2 + 0.06 * Math.sin(d * 0.12 + th * 5 + I.seed);
      const sc = taper * (k === 1 ? 1 : flute);
      const cx = I.x + lean[0] * d, cz = I.z + lean[1] * d;
      const x = cx + (e.x - I.x) * sc, z = cz + (e.z - I.z) * sc;
      pos.set([x, ry - d - (k === 1 ? 0.8 : 0), z], vi * 3);
      aW.set([0, 0, 0, 1], vi * 4); aD[vi] = d + (k === 1 ? 0.8 : 0); vi++;
    }
  }
  const idx = [];
  for (let j = 0; j < N; j++) for (let r = 0; r < rows - 1; r++) {
    const a = j * rows + r, b = (j + 1) * rows + r, c = a + 1, d = b + 1;
    idx.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aW', new THREE.BufferAttribute(aW, 4));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(aD, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, islandMat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.island = I;
  group.add(mesh);
  // hanging vines + moss strands from the rim
  const vines = [], nV = Math.round(N * 0.45);
  for (let i = 0; i < nV; i++) {
    const th = R() * Math.PI * 2, e = edgeRadius(I, th), j = Math.round(th / (Math.PI * 2) * N);
    const len = 3 + R() * R() * 22, ox = (e.x - I.x), oz = (e.z - I.z), ol = Math.hypot(ox, oz) || 1;
    const x0 = e.x + ox / ol * 0.6, z0 = e.z + oz / ol * 0.6, y0 = rimY[j] - 0.6;
    const sway = (R() - 0.5) * 1.2;
    vines.push(x0, y0, z0, x0 + ox / ol * 0.4 + sway * 0.5, y0 - len * 0.5, z0 + oz / ol * 0.4, x0 + ox / ol * 0.4 + sway * 0.5, y0 - len * 0.5, z0 + oz / ol * 0.4, x0 + ox / ol * 0.2 + sway, y0 - len, z0 + oz / ol * 0.2);
  }
  const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.Float32BufferAttribute(vines, 3));
  group.add(new THREE.LineSegments(vg, vineMat));
  // waterfalls
  for (const th of I.falls || []) group.add(makeFall(I, th));
  // trees on rough ground
  const want = I.trees ?? (I.kind === 'rough' ? 4 : I.playable ? 5 : Math.round(I.rx * I.rz / 140));
  let placed = 0;
  for (let t = 0; t < want * 12 && placed < want; t++) {
    const th = R() * Math.PI * 2, s = 0.35 + R() * 0.55, e = edgeRadius(I, th);
    const x = I.x + (e.x - I.x) * s, z = I.z + (e.z - I.z) * s;
    if (I.playable && surfaceAt(x, z) !== 'rough') continue;
    if (I.playable && I.kind !== 'rough' && islandF(I, x, z) < 0.86) continue;
    if (I.kind === 'tee' && Object.values(HOLE.tees || { t: HOLE.tee }).some(t => Math.hypot(x - t[0], z - t[1]) < 12 || (Math.abs(x - t[0]) < 10 && z > t[1] - 4))) continue; // keep the tees and the camera behind them clear
    trees.push({ x, y: (SHAPED && I.playable ? T.groundAt(x, z) : null) ?? groundAt2(I, x, z), z, s: (I.playable ? 0.9 : 1.2) + R() * 0.8, type: R() < 0.62 ? 'pine' : 'oak', r: R() });
    placed++;
  }
}
const groundAt2 = (I, x, z) => islandH(I, x, z, Math.min(1, islandF(I, x, z)));
// Red Mesa: a top like the Aerie's, then cliff walls straight down to the canyon floor, with
// ledges where the strata step and a talus skirt at the foot
// the hole's playing surface (a finer grid, see mesa-world.js) covers island tops inside this box
let playBox = null;
const LEVELS = MESA && !CAVE && !FIELD; // Red Mesa: the playfield draws each cliff's levels to the island's outline
const inBox = (x, z) => playBox && x > playBox.x0 && x < playBox.x1 && z > playBox.z0 && z < playBox.z1;
const playMat = islandMat.clone(); playMat.onBeforeCompile = islandMat.onBeforeCompile; playMat.polygonOffset = true; playMat.polygonOffsetFactor = -1; playMat.polygonOffsetUnits = -2;
function buildMesa(I, N, rings, group, trees) {
  const K = coarse ? 9 : 12, rows = rings.length + K;
  const pos = new Float32Array((N + 1) * rows * 3), aW = new Float32Array((N + 1) * rows * 4), aD = new Float32Array((N + 1) * rows);
  const R = rng(I.seed * 977 + 13), RT = rng(I.seed * 131 + 7); // RT: talus only, so the trees (which play) keep their places
  let vi = 0;
  for (let j = 0; j <= N; j++) {
    const th = (j / N) * Math.PI * 2, e0 = edgeRadius(I, th);
    // the far mesas and buttes: a ragged rim (bays, points, a spall here and there), never a ruled line
    const e = I.ragged ? (() => { const k = 1 + (fbm(th * 3.2 + I.seed, 0.5) - 0.5) * 0.22 + (fbm(th * 11 + I.seed * 2, 1.7) - 0.5) * 0.09; return { x: I.x + (e0.x - I.x) * k, z: I.z + (e0.z - I.z) * k }; })() : e0;
    let ry = 0;
    for (const rr of rings) {
      const sc = rr * 0.999, x = I.x + (e.x - I.x) * sc, z = I.z + (e.z - I.z) * sc;
      let y = islandH(I, x, z, Math.min(islandF(I, x, z), 1));
      if (CAVE) { const g = T.groundAt(x, z); if (g !== null && y > g) y = g; } // terraces lower the ground: the rim comes down with it
      // Red Mesa: inside the play box the playfield draws the top and ends on this outline at the shaped
      // ground's height (ramps, greens, tilts), so the wall's top edge takes that height too
      // (where another island's ground lies over this rim, the wall stays under it: a neck joining two mesas)
      else if (LEVELS && rr === 1 && inBox(x, z)) { const g = T.groundAt(x, z); if (g !== null) y = T.topAt(x, z)?.I === I ? g : Math.min(y, g - 0.3); }
      pos.set([x, y, z], vi * 3); aW.set([0, 0, 0, 0], vi * 4); aD[vi] = 0; vi++; ry = y;
    }
    const ox = e.x - I.x, oz = e.z - I.z, ol = Math.hypot(ox, oz) || 1, nx = ox / ol, nz = oz / ol;
    const fx = e.x + nx * 5, fz = e.z + nz * 5;
    let bottom = T.floor ? (T.inGorge(fx, fz) ? T.floor.y - 120 : T.floorShape(fx, fz)) : I.top - I.depth;
    if (bottom === null || bottom > ry - 0.5) bottom = ry - 1.5;
    const H = ry - bottom, pad = H < 4, talus = Math.min(10, H * 0.16), arc = th * Math.max(I.rx, I.rz);
    for (let k = 1; k <= K; k++) {
      const t = k / K, y = pad ? ry - (H + 1.5) * t : ry - 0.6 - (H + 1.2) * Math.pow(t, 1.1);
      let off = pad ? t * 1.5 : (fbm(arc / 14 + I.seed, y / 7) - 0.5) * 3.2 + (k === 1 ? 0.3 : 0);
      if (!pad && t > 0.75) off += Math.pow((t - 0.75) / 0.25, 1.6) * talus;
      pos.set([e.x + nx * off, y, e.z + nz * off], vi * 3);
      aW.set([0, 0, 0, pad ? 0 : 1], vi * 4); aD[vi] = ry - y; vi++;
    }
    // Red Mesa: blocks fallen from the face, heaped at the foot (scenery; the ground there is native)
    if (talusPts && !pad && H > 6 && bottom > (T.floor ? T.floor.y - 60 : -1e9) && RT() < (I.ragged ? 0.35 : 0.8)) {
      const n = 1 + Math.floor(RT() * Math.min(4, H / 10));
      for (let q = 0; q < n; q++) { const d = talus + 1 + RT() * (4 + H * 0.12), s = 0.5 + Math.pow(RT(), 2) * Math.min(3.2, H * 0.05) * (I.ragged ? 2.5 : 1);
        const x = e.x + nx * d + (RT() - 0.5) * 6, z = e.z + nz * d + (RT() - 0.5) * 6, g = I.ragged ? bottom : T.groundAt(x, z);
        if (g !== null && g < ry - 3 && (I.ragged || (surfaceAt(x, z) === 'desert' && T.fairwayD(x, z) > 10 + s * 2))) talusPts.push([x, g, z, s, RT()]); } // only on native ground, clear of the short grass
    }
  }
  const idx = [], inPlay = i => playBox && I.playable && pos[i * 3] > playBox.x0 + 3 && pos[i * 3] < playBox.x1 - 3 && pos[i * 3 + 2] > playBox.z0 + 3 && pos[i * 3 + 2] < playBox.z1 - 3;
  for (let j = 0; j < N; j++) for (let r = 0; r < rows - 1; r++) {
    const a = j * rows + r, b = (j + 1) * rows + r;
    if (r < rings.length - 1 && inPlay(a) && inPlay(b) && inPlay(a + 1) && inPlay(b + 1)) continue; // the playfield draws this top
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aW', new THREE.BufferAttribute(aW, 4)); geo.setAttribute('aDepth', new THREE.BufferAttribute(aD, 1));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, islandMat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.island = I; group.add(mesh);
  // junipers and pinyons on the rough
  const want = I.trees ?? (I.playable ? 0 : Math.round(I.rx * I.rz / 900));
  let placed = 0;
  for (let t = 0; t < want * 14 && placed < want; t++) {
    const th = R() * Math.PI * 2, sc = Math.sqrt(R()) * 0.93, e = edgeRadius(I, th);
    const x = I.x + (e.x - I.x) * sc, z = I.z + (e.z - I.z) * sc;
    if (I.playable) { const sf = surfaceAt(x, z); if ((sf !== 'rough' && sf !== 'desert') || T.fairwayD(x, z) < 10) continue; if (Object.values(HOLE.tees || {}).some(tt => Math.hypot(x - tt[0], z - tt[1]) < 14)) continue; if (HOLE.pinPos && Math.hypot(x - HOLE.pinPos.x, z - HOLE.pinPos.z) < 22) continue; }
    trees.push({ x, y: (I.playable ? groundAt(x, z) : null) ?? groundAt2(I, x, z), z, s: 0.8 + R() * 0.9, type: R() < 0.7 ? 'juniper' : 'pinyon', r: R() });
    placed++;
  }
}
const vineMat = new THREE.LineBasicMaterial({ color: 0x2f4a22, transparent: true, opacity: 0.85 });

const fallMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: clockU }]),
  vertexShader: `varying vec2 vUv; ${FOG_GLSL_V}
    void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
  fragmentShader: `varying vec2 vUv; uniform float uT;
    #include <fog_pars_fragment>
    float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
    void main(){
      float x = vUv.x, y = 1.0 - vUv.y;
      float edge = smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x);
      float s = vn(vec2(x*18.0, y*3.0 - uT*2.2)) * 0.6 + vn(vec2(x*40.0, y*7.0 - uT*3.1)) * 0.4;
      float spread = mix(1.0, 0.0, smoothstep(0.35, 1.0, y));
      float a = edge * (0.35 + 0.55*s) * mix(1.0, 0.0, smoothstep(0.55, 1.0, y)) * (0.6 + 0.4*spread);
      vec3 col = mix(vec3(0.86,0.92,0.95), vec3(1.0), s);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`,
});
function makeFall(I, th, width) {
  const e = edgeRadius(I, th), ox = e.x - I.x, oz = e.z - I.z, ol = Math.hypot(ox, oz);
  const nx = ox / ol, nz = oz / ol, W = width || 5 + I.seed % 3, L = width ? 230 : 170;
  const geo = new THREE.PlaneGeometry(W, L, 1, 24);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = (L / 2 - y) / L; // 0 at top
    const out = 1.2 + t * t * 26, w = 1 + t * 1.6;
    p.setXYZ(i, p.getX(i) * w, -t * L, out);
  }
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, fallMat);
  const y0 = groundAt2(I, I.x + ox * 0.98, I.z + oz * 0.98);
  m.position.set(e.x, y0 + 0.2, e.z);
  m.rotation.y = Math.atan2(nx, nz);
  m.renderOrder = 1;
  return m;
}

/* ---------- trees ---------- */
const coneGeo = new THREE.ConeGeometry(1, 1, 9, 1); coneGeo.translate(0, 0.5, 0);
const blobGeo = new THREE.IcosahedronGeometry(1, 2);
{ const p = blobGeo.attributes.position, nr = blobGeo.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + (hash2(Math.round(v.x * 50), Math.round(v.y * 50 + v.z * 30)) - 0.5) * 0.3; p.setXYZ(i, v.x * n, v.y * n * 0.8, v.z * n); v.normalize(); nr.setXYZ(i, v.x, v.y, v.z); } }
const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 6); trunkGeo.translate(0, 0.5, 0);
// Red Mesa's junipers and pinyons use the same faceted clumps as the Aerie's pines (clumpGeo, clumpMat from sky-art.js)
const foliageMat = new THREE.MeshStandardMaterial({ roughness: 0.92, envMapIntensity: 0.5 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });
function buildTrees(list, group) {
  list = list.filter(t => t.type !== 'mushroom'); // cave-world.js draws the giant mushrooms (they still play)
  if (!MESA) return skyPines(list, group);
  const pines = list.filter(t => t.type === 'pine'), oaks = list.filter(t => t.type !== 'pine');
  const cones = new THREE.InstancedMesh(coneGeo, foliageMat, pines.length * (ICE ? 6 : 3));
  const NB = REDROCK ? 6 : 4, blobs = new THREE.InstancedMesh(REDROCK ? clumpGeo : blobGeo, REDROCK ? clumpMat : foliageMat, oaks.length * NB);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  const R = rng(list.length * 31 + 7);
  let k = 0, ti = 0;
  for (const t of pines) {
    const H = 7 * t.s + 4 * t.r, Wd = 2.2 * t.s;
    m.compose(ps.set(t.x, t.y - 0.3, t.z), q.identity(), sc.set(t.s, H * 0.4, t.s)); trunks.setMatrixAt(ti++, m);
    for (let i = 0; i < 3; i++) {
      const y0 = t.y + H * (0.18 + i * 0.22), w = Wd * (1 - i * 0.26), h = H * (0.5 - i * 0.08);
      q.setFromEuler(new THREE.Euler(0, R() * 6, 0));
      m.compose(ps.set(t.x, y0, t.z), q, sc.set(w, h, w)); cones.setMatrixAt(k, m);
      c.set(0x2c4a2a).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.08, (R() - 0.5) * 0.06 + i * 0.015); cones.setColorAt(k, c); k++;
      if (ICE) { m.compose(ps.set(t.x, y0 + h * 0.3, t.z), q, sc.set(w * 0.78, h * 0.55, w * 0.78)); cones.setMatrixAt(k, m); c.set(0xe4ebf4).offsetHSL(0, 0, (R() - 0.5) * 0.04); cones.setColorAt(k, c); k++; }   // snow on the boughs
    }
  }
  k = 0;
  for (const t of oaks) {
    const shape = { oak: [2.5, 3, 1], juniper: [0.5, 1.5, 0.6], pinyon: [1.2, 1.9, 0.7], cotton: [4.5, 3.6, 1.4] }[t.type] || [2.5, 3, 1];
    const H = shape[0] * t.s, s = shape[1] * t.s;
    m.compose(ps.set(t.x, t.y - 0.3, t.z), q.identity(), sc.set(t.s * shape[2], H + 1.2, t.s * shape[2])); trunks.setMatrixAt(ti++, m);
    const pal = CITY ? [0x2f4a20, 0x3a5726, 0x46622c] : VOLC ? [0x26401f, 0x2f4a24, 0x3a5228] : REDROCK && t.type !== 'cotton' ? [0x3e4c34, 0x4a5a3a, 0x3a4a33] : { juniper: [0x3a4a30, 0x445436, 0x34432e], pinyon: [0x3d5230, 0x48593a, 0x3a4c2c], cotton: [0x7c8c3a, 0x8f9a44, 0x6e8034] }[t.type] || [0x3f5a28, 0x4a6230, 0x56692f];
    const base = pal[Math.floor(R() * 3)];
    if (REDROCK) { // a juniper or pinyon: an irregular crown of small faceted clumps, lopsided
      const lean = R() * 6.28;
      for (let b = 0; b < NB; b++) {
        const a = R() * 6.28, rr = b === 0 ? 0 : s * (0.25 + R() * 0.45), bs = s * (b === 0 ? 0.7 : 0.38 + R() * 0.3);
        m.compose(ps.set(t.x + Math.cos(a) * rr + Math.cos(lean) * s * 0.15, t.y + H * (0.55 + R() * 0.6) + bs * 0.4, t.z + Math.sin(a) * rr + Math.sin(lean) * s * 0.15), q.setFromEuler(new THREE.Euler(R() * 0.8, R() * 6, R() * 0.5)), sc.set(bs, bs * (0.7 + R() * 0.4), bs));
        blobs.setMatrixAt(k, m); c.set(base).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.08, (R() - 0.5) * 0.07); blobs.setColorAt(k, c); k++;
      }
      continue;
    }
    for (let b = 0; b < 4; b++) {
      const a = R() * 6.28, rr = b === 0 ? 0 : s * (0.35 + R() * 0.3), bs = s * (b === 0 ? 0.8 : 0.5 + R() * 0.25);
      m.compose(ps.set(t.x + Math.cos(a) * rr, t.y + H + bs * 0.6 + R() * s * 0.3, t.z + Math.sin(a) * rr), q.setFromEuler(new THREE.Euler(R() * 0.4, R() * 6, 0)), sc.set(bs, bs * 0.75, bs));
      blobs.setMatrixAt(k, m); c.set(base).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.08, (R() - 0.5) * 0.06); blobs.setColorAt(k, c); k++;
    }
  }
  for (const im of [cones, blobs, trunks]) { im.castShadow = true; im.receiveShadow = true; if (im.count) group.add(im); }
}

/* ---------- cloud puffs ---------- */
const puffTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); const R = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 128 + (R() - 0.5) * 120, y = 140 + (R() - 0.5) * 60, r = 30 + R() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
})();
// banks of cumulus standing on the cloud sea (the Aerie's horizon): a flat, shadowed base, billows piled up
// into a lit, sharp-edged crown. Four variants in one atlas (rows of 256 px), drawn mirrored or not, so the ring of
// banks round the horizon is one mesh: one draw, tinted per bank by vertex colour toward the haze and the sun.
/* ---------- hole build ---------- */
let holeGroup = null, pinMesh = null, flagMesh = null, cupMesh = null;
const poleGeo = new THREE.CylinderGeometry(0.014, 0.014, 2.3, 8); poleGeo.translate(0, 1.15, 0);
let mesaCtx = null, skyCtx = null, greenLight = null, treeField = null;
let mirror = null; // the cave's mirror pond (makeMirror), if the hole has one
let talusPts = null; // Red Mesa: where blocks have fallen at the foot of the walls (filled while the islands build)
function holeBox(h) { // the area the hole is played over (paint texture, near floor, map view)
  const pts = [...Object.values(h.tees || { t: h.tee }), h.pin || [h.pinPos.x, h.pinPos.z], ...(h.line || [])];
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  return { x0: Math.min(...xs) - 150, x1: Math.max(...xs) + 150, z0: Math.min(...zs) - 140, z1: Math.max(...zs) + 120 };
}
function buildHole(h) {
  if (holeGroup) { scene.remove(holeGroup); holeGroup.traverse(o => { if (o.geometry && o.geometry !== coneGeo && o.geometry !== blobGeo && o.geometry !== clumpGeo && o.geometry !== trunkGeo && o.geometry !== poleGeo && !o.geometry.userData.keep) o.geometry.dispose(); }); }
  if (surfU.uSurf.value) { surfU.uSurf.value.dispose(); surfU.uSurf.value = null; }
  HOLE = h; holeGroup = new THREE.Group(); scene.add(holeGroup);
  // today's pin: one of the green's pin positions, picked per round
  if (h.green && h.green.pins) h.pin = h.green.pins[(state.pinPick || [])[HOLES.indexOf(h)] ?? 0];
  T = createTerrain(h); ISL = T.ISL;
  h.tee = teeOf(h);
  const pin = h.pin || ISL.find(I => I.kind === 'green').pin;
  h.pinPos = new THREE.Vector3(pin[0], groundAt(pin[0], pin[1]), pin[1]);
  wind = holeWind(windRoll, HOLES.indexOf(h)); windVec = windVector(wind, h.heading ?? 0);
  applySky(h.heading ?? 0);
  const trees = [];
  talusPts = REDROCK ? [] : null;
  const box = holeBox(h); playBox = MESA ? box : null;
  if (surf2U.value) { surf2U.value.dispose(); surf2U.value = null; }
  if (MESA || SHAPED) { // paint texture first: the island shader reads it
    const tex = ICE ? (() => { const [a, b] = IW.surfaceTextures(T, h, box, coarse ? 1.1 : 0.75, COURSE.ice); surf2U.value = b; return a; })() : VOLC ? (() => { const [a, b] = VW.surfaceTextures(T, h, box, coarse ? 1.1 : 0.75); surf2U.value = b; return a; })() : MW.surfaceTexture(T, h, box, coarse ? 1.1 : 0.75);
    surfU.uSurf.value = tex; surfU.uSurfMin.value.set(box.x0, box.z0); surfU.uSurfSize.value.set(box.x1 - box.x0, box.z1 - box.z0); surfU.uFloorY.value = T.floor ? T.floor.y : -1e4;
  }
  for (const I of ISL) buildIsland(I, { seg: MESA ? Math.min(coarse ? 200 : 280, Math.max(96, Math.round(Math.max(I.rx, I.rz) * 1.6))) : coarse ? 120 : 160, side: coarse ? 22 : 30 }, holeGroup, trees);
  const R = rng(h.par * 101 + yardsOf(h));
  const a = new THREE.Vector2(h.tee[0], h.tee[1]), b = new THREE.Vector2(h.pinPos.x, h.pinPos.z);
  const segDist = (x, z) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(new THREE.Vector2(x, z).sub(a).dot(ab) / ab.lengthSq(), 0, 1); return new THREE.Vector2(x, z).distanceTo(a.clone().addScaledVector(ab, t)); };
  if (MESA) {
    if (!CAVE && !FIELD) for (const I of MW.decoMesas(h, T, h.pinPos, coarse)) buildIsland(I, { seg: Math.max(40, Math.min(90, Math.round(I.rx * 0.6))), side: 10 }, holeGroup, trees);
    if (!FIELD) MW.buildFloor(T, box, islandMat, coarse, holeGroup, true, { gorgeEdge: CAVE });
    MW.buildPlayfield(T, box, playMat, coarse, holeGroup, { steepFine: CAVE || FIELD, snapEdges: CAVE || FIELD, levels: LEVELS, keepSteep: FIELD });
    MW.buildWater(T, holeGroup);
    if (!ICE && !VOLC) MW.buildRocks(T, h, islandMat, holeGroup);   // ice-world.js and volcano-world.js draw their own rocks
    if (CAVE) mesaCtx = CW.buildCave(h, T, box, { group: holeGroup, coarse, sunDir });
    else if (ICE) { mesaCtx = IW.buildIce(h, T, box, COURSE.ice, HOLES.indexOf(h), { group: holeGroup, coarse, groundMat: playMat, rockMat: islandMat, sunDir, night: !!TIMES[cond.time]?.night }); trees.push(...mesaCtx.trees);
      iceU.uWind.value.set(windVec.x, windVec.z); if (iceU.uWind.value.lengthSq() < 1e-4) iceU.uWind.value.set(0.6, 0.8);
      iceU.uPoolN.value = Math.min(24, mesaCtx.pools.length); mesaCtx.pools.slice(0, 24).forEach((q, i) => iceU.uPools.value[i].set(...q)); }
    else if (VOLC) { mesaCtx = VW.buildVolcano(h, T, box, COURSE.volc, HOLES.indexOf(h), { group: holeGroup, coarse }); trees.push(...mesaCtx.trees); }
    else if (CITY) { mesaCtx = CTW.buildCity(h, T, box, COURSE.city, HOLES.indexOf(h), { group: holeGroup, coarse, groundMat: playMat, sunDir, beams: cond.weather !== 'overcast' && cond.time !== 'night' }); trees.push(...mesaCtx.trees); }
    else {
      MW.talus(talusPts, coarse, holeGroup); talusPts = null;
      MW.scatterShrubs(T, box, coarse, holeGroup, { red: true });
      trees.push(...MW.cottonwoodSpots(T, h));
      mesaCtx = MW.buildProps(h, T, h.tees ? Object.values(h.tees)[0] : h.tee, islandMat, holeGroup, { life: true });
    }
  } else {
    // decorative spires around the hole, kept clear of the corridor
    const deco = [];
    for (let i = 0; i < 400 && deco.length < (coarse ? 26 : 38); i++) {
      const ang = R() * Math.PI * 2, rad = 160 + Math.pow(R(), 0.8) * 1700;
      const x = b.x * 0.5 + Math.cos(ang) * rad, z = b.y * 0.5 + Math.sin(ang) * rad;
      if (segDist(x, z) < 120 + rad * 0.05) continue;
      const size = 18 + R() * 55 + rad * 0.03;
      if (deco.some(d => Math.hypot(d.x - x, d.z - z) < (d.rx + size) * 1.3)) continue;
      const top = -70 + R() * 200 + (rad > 900 ? R() * 250 : 0);
      const fr = R(), form = SHAPED ? (fr < 0.45 ? 'pillar' : fr < 0.65 ? 'stepped' : 'carrot') : 'carrot';
      deco.push(prepIsland({ x, z, rx: size, rz: size * (0.7 + R() * 0.6), rot: R() * 3, top, depth: size * (form === 'pillar' ? 4 + R() * 4 : 3 + R() * 4), kind: 'deco', seed: 100 + i, falls: R() < 0.25 ? [R() * 6.28] : [], form }));
    }
    for (const I of deco) buildIsland(I, { seg: rad2seg(I), side: 18 }, holeGroup, trees);
    if (SHAPED) { // the shaped playing surface over the island tops, ponds, and the floating scenery
      MW.buildPlayfield(T, box, playMat, coarse, holeGroup, { steepFine: CAVE });
      MW.buildWater(T, holeGroup);
      skyCtx = { group: holeGroup, trees, island: buildIsland, fall: makeFall, prepIsland, edgeRadius, buildTrees, mat: islandMat, T, anims: [], glow: [] };
      SP.buildSkyProps(h, skyCtx, LANDMARKS || {});
      { const pc = MW.buildProps({ ...h, props: h.props || [] }, T, h.tee, islandMat, holeGroup, { glyphs: false, life: 'sky' }); skyCtx.anims.push(...pc.anims); }
    }
    // cloud puffs drifting between islands
    for (let i = 0; i < (coarse ? 40 : 70); i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.35 + R() * 0.45, fog: true }));
      const ang = R() * 6.28, rad = 60 + R() * 1400;
      const x = b.x * 0.5 + Math.cos(ang) * rad, z = b.y * 0.5 + Math.sin(ang) * rad;
      if (segDist(x, z) < 50) continue;
      const s = 60 + R() * 220; sp.scale.set(s, s * 0.45, 1);
      sp.position.set(x, -60 - R() * 180 + (rad > 700 ? R() * 120 : 0), z); sp.userData.v = 0.6 + R(); holeGroup.add(sp);
    }
    // banks of cumulus standing up off the cloud sea all round the horizon (no fog: they are the far haze, tinted toward it)
    if (SHAPED) {
      holeGroup.add(cumulusBanks({ cx: b.x * 0.5, cz: b.y * 0.5, sunDir, haze: FOG_COLOR, n: coarse ? 22 : 34, R }));
      // a few wisps at island height, off the line of play and clear of the tee
      for (let i = 0, made = 0; i < 200 && made < (coarse ? 8 : 14); i++) {
        const ang = R() * 6.28, rad = 120 + R() * 700, x = b.x * 0.5 + Math.cos(ang) * rad, z = b.y * 0.5 + Math.sin(ang) * rad;
        if (segDist(x, z) < 110 || Math.hypot(x - a.x, z - a.y) < 160) continue;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0.4 + R() * 0.35, fog: true }));
        const s = 50 + R() * 110; sp.scale.set(s, s * 0.4, 1); sp.position.set(x, -40 + R() * 90, z); sp.userData.v = 0.8 + R() * 1.2; holeGroup.add(sp); made++;
      }
    }
    mesaCtx = SHAPED ? skyCtx : null;
  }
  trees.push(...T.trees);
  buildTrees(trees, holeGroup);
  treeField = createTreeField(trees); // every tree plays
  // pin, flag, cup, tee markers (every set, in its colour)
  const pp = h.pinPos;
  pinMesh = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 })); pinMesh.position.copy(pp); pinMesh.castShadow = true; holeGroup.add(pinMesh);
  const fg = new THREE.PlaneGeometry(0.62, 0.42, 12, 6); fg.translate(0.31, 0, 0);
  flagMesh = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.75, side: THREE.DoubleSide, emissive: 0xf5c542, emissiveIntensity: TIMES[cond.time]?.night ? 0.5 : 0 }));
  flagMesh.position.set(pp.x + 0.014, pp.y + 2.07, pp.z); flagMesh.userData.base = Float32Array.from(fg.attributes.position.array); flagMesh.castShadow = true; holeGroup.add(flagMesh);
  cupMesh = new THREE.Mesh(new THREE.CircleGeometry(0.054, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b0f0c })); cupMesh.position.set(pp.x, pp.y + 0.006, pp.z); holeGroup.add(cupMesh);
  // two markers on the front of each set's pad, turned with it
  const teeKeys = Object.keys(h.tees || { tee: 0 });
  for (const set of TEE_SETS) {
    const P = T.features.tees[teeKeys.indexOf(h.tees ? set.id : 'tee')]; if (!P) continue;
    for (const du of [-3.2, 3.2]) {
      const tm = ICE ? new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.34, 6).translate(0, 0.09, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(set.color).lerp(new THREE.Color(0x4a3a2c), 0.55), roughness: 0.85 }))   // a carved wooden post, stained the set's colour
        : new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: set.color, roughness: 0.4 }));
      const tx = P.x + du * P.c + 2.2 * P.s, tz = P.z + du * P.s - 2.2 * P.c, gy = groundAt(tx, tz); if (gy === null) continue;
      tm.position.set(tx, gy + 0.08, tz); holeGroup.add(tm);
    }
  }
  // night: the green is lit
  if (greenLight) { scene.remove(greenLight, greenLight.target); greenLight = null; }
  if (TIMES[cond.time]?.night) {
    greenLight = new THREE.SpotLight(0xfff1d6, 3.2, 120, 0.55, 0.6, 1.2); greenLight.position.set(pp.x + 14, pp.y + 34, pp.z + 18); greenLight.target.position.copy(pp); scene.add(greenLight, greenLight.target);
  }
  if (CAVE && mesaCtx) CW.bakeLights(holeGroup, mesaCtx.baked); // the cave's lanterns, beams and glows, baked into the meshes
  mirror = null;
  if (CAVE) { // the biggest pond still enough to mirror the cave (Mirror Lake, the grotto's pools): one planar reflection
    let best = null; holeGroup.traverse(o => { const W = o.userData.pond; if (W && (!best || W.rx * W.rz > best.userData.pond.rx * best.userData.pond.rz)) best = o; });
    if (best && best.userData.pond.rx * best.userData.pond.rz > 900) mirror = makeMirror(best);
  }
  const dir = new THREE.Vector2(pp.x - h.tee[0], pp.z - h.tee[1]).normalize(); holeDirU.value.copy(dir);
  // plan view for the corner map
  const shapeOf = I => {
    const rim = [], fair = [];
    for (let j = 0; j < 64; j++) { const e = edgeRadius(I, j / 64 * Math.PI * 2); rim.push([e.x, e.z]); fair.push([I.x + (e.x - I.x) * 0.8, I.z + (e.z - I.z) * 0.8]); }
    return { kind: I.kind, top: I.slope ? Math.max(I.slope.from[2], I.slope.to[2]) : I.top, rim, fair: I.kind === 'fairway' ? fair : null, green: I.green || null, bunkers: I.bunkers || [] };
  };
  minimap.setHole({
    tee: h.tee, pin: [pp.x, pp.z],
    shapes: ISL.map(shapeOf).sort((p, q) => p.top - q.top),
    floor: T.floor ? (T.floor.solid ? 'floor' : 'void') : null,
    fairways: h.fairways || [], sand: h.sand || [], washes: T.floor ? T.floor.washes : [], rivers: T.features.rivers.map(V => ({ pts: V.line, w: V.w })),
    rocks: T.rocks.map(r => ({ type: r.type, x: r.x, z: r.z, r: r.type === 'arch' ? r.ao : r.capR, rot: r.rot || 0, d: r.d || 0, ai: r.ai || 0 })),
    fit: h.line ? [...Object.values(h.tees).map(t => (Array.isArray(t) ? t : [t.x, t.z])), [pp.x, pp.z]] : null,
    // a city course: the map is painted from the ground's surfaces, with the buildings in dark grey
    paint: ICE ? IW.mapPaint(T, h) : VOLC ? VW.mapPaint(T, h) : CITY ? (() => { const blds = T.rocks.filter(r => r.type === 'box' && r.soak), C = { desert: '#77746d', rough: '#3d6a2b', firstcut: '#4c7d33', fairway: '#5e9a3a', fringe: '#6aa844', green: '#7cc65b', tee: '#86b85e', sand: '#e8d29a', waste: '#c9b98a', water: '#3f7f95', void: '#15110f' };
      return (x, z) => { for (const r of blds) { const dx = x - r.x, dz = z - r.z; if (Math.abs(dx * r.c + dz * r.s) < r.w / 2 && Math.abs(-dx * r.s + dz * r.c) < r.d / 2) return '#3b3a37'; } return C[T.surfaceAt(x, z)] || '#77746d'; }; })() : null,
    feat: { greens: T.features.greens.map(G => featureOutline(G, 'green')), bunkers: T.features.bunkers.map(B => featureOutline(B, 'bunker', 24)), tees: T.features.tees.map(t => featureOutline(t, 'tee')), water: T.features.water.map(W => featureOutline(W, 'water')) },
  });
}
const rad2seg = I => Math.max(48, Math.min(96, Math.round(I.rx * 1.3)));

/* ---------- ball, shadow, tracer, markers ---------- */
const BALL_RADIUS = 0.02135;
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 0.9 }));
ball.castShadow = true; scene.add(ball);
const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
const ringGeo = new THREE.RingGeometry(0.86, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const aimRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8fdc8a, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, toneMapped: false }));
const aimFill = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8fdc8a, transparent: true, opacity: 0.16, depthWrite: false, depthTest: false, toneMapped: false }));
aimRing.renderOrder = aimFill.renderOrder = 5;
const restDot = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2efe6, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, toneMapped: false }));
restDot.renderOrder = 6;
scene.add(aimRing, aimFill, restDot);
function mkLine(color, w, o, dashed) {
  const mat = new THREE.LineMaterial({ color: new THREE.Color(color), linewidth: w * renderer.getPixelRatio(), transparent: true, opacity: o, depthWrite: false, toneMapped: false, dashed: !!dashed, dashSize: 3, gapSize: 2.5 });
  if (dashed) mat.defines.USE_DASH = '';
  const l = new THREE.Line2(new THREE.LineGeometry(), mat); l.frustumCulled = false; l.renderOrder = 4; l.visible = false; scene.add(l); return l;
}
const previewArc = mkLine('#f2efe6', 1.6, 0.55, true);
const tracerCore = mkLine('#f5c542', 2.6, 1), tracerGlow = mkLine('#f5c542', 8, 0.25);
const oldTracers = [];
// Three.js caches a line's segment count the first time it draws it; clear that after each
// update or growing tracers (and changing preview arcs) stay frozen at their first length.
function setLine(l, arr) { if (arr.length < 6) { l.visible = false; return; } l.geometry.setPositions(arr); l.geometry._maxInstanceCount = undefined; if (l.material.dashed) l.computeLineDistances(); l.visible = true; }
function resizeLines() { const w = renderer.domElement.width, h = renderer.domElement.height; [previewArc, tracerCore, tracerGlow, ...oldTracers].forEach(l => l.material.resolution.set(w, h)); }

/* ===================== corner map ===================== */
const minimap = createMinimap(document.getElementById('minimap'));
// the corner map doubles as the only view switch: tap for the whole hole, tap again to return
// tap a spot on the corner map to aim there (club and swing length follow); ⤢ shows the whole hole
document.getElementById('mmExpand').addEventListener('click', e => { e.stopPropagation(); setCam(state.cam === 'map' ? 'tv' : 'map'); });
document.getElementById('minimap').addEventListener('click', e => {
  if (state.phase !== 'address') return;
  const r = e.currentTarget.getBoundingClientRect(), w = minimap.toWorld(e.clientX - r.left, e.clientY - r.top);
  if (!w) return;
  const p = new THREE.Vector3(w[0], groundAt(w[0], w[1]) ?? state.ball.y, w[1]);
  if (p.distanceTo(state.ball) < 3) return;
  state.aimCustom = p.clone(); aimAt(p);
});
function groundTrack(W, upto) { const out = []; for (let i = 0; i <= upto; i += 8) out.push({ x: W[i].w.x, z: W[i].w.z }); out.push({ x: W[upto].w.x, z: W[upto].w.z }); return out; }
let mmFrame = 0;
function drawMinimap() {
  const wrap = document.getElementById('minimapWrap');
  const show = !!HOLE && state.phase !== 'intro' && state.phase !== 'setup' && document.getElementById('card').hidden;
  wrap.classList.toggle('active', state.cam === 'map');
  if (show && wrap.hidden) { wrap.hidden = false; minimap.resize(); }
  wrap.hidden = !show;
  if (!show || (mmFrame++ & 1)) return; // ~30 fps is plenty
  const f = state.flight, flying = state.phase === 'flight' && f;
  let live = null, lo = 0;
  if (flying) { while (lo < f.W.length - 1 && f.W[lo + 1].t <= state.t) lo++; live = groundTrack(f.W, lo); }
  minimap.draw({
    ball: flying ? { x: ball.position.x, z: ball.position.z } : { x: state.ball.x, z: state.ball.z },
    ballVisible: ball.visible || state.phase === 'holed',
    aim: state.phase === 'address' ? state.previewAim : null,
    tracks: state.tracks, live,
  });
}

/* ===================== game state ===================== */
const state = {
  holeIdx: 0, strokes: 0, scores: [], ball: new THREE.Vector3(), lie: 'tee', yaw: 0, camYaw: 0, aimPoint: null,
  club: 0, k: 1, target: 0, tracks: [], previewAim: null, aimCustom: null, phase: 'intro', cam: 'tv', sound: true,
  flight: null, t: 0, restTimer: 0, preview: null, lastShot: null, puttAnim: null, flyT: 0, lastLie: null,
};
const $ = id => document.getElementById(id);
// the simulated-shot tool: club (Auto = the suggestion), Normal / Punch / Stinger, shape, Ideal / Hit
const lieLine = document.createElement('p'); lieLine.className = 'st-note'; lieLine.id = 'pvLie';
const tool = createSimTool($('simMount'), {
  clubs: CLUBS, extra: lieLine,
  note: 'Tap the course or the corner map to aim at a spot; drag the dashed line left or right to fine-tune. Your R10 shots fly as you hit them.',
  onChange: () => { if (state.phase === 'address') applyTool(); },
  seedPct: () => state.k * 100, // auto-aim handing over: keep the swing length it picked
  onShot: s => swing(s),
});
const yd = m => Math.round(m / M_PER_YD);

function dirFromYaw(y) { return new THREE.Vector3(Math.sin(y), 0, -Math.cos(y)); }
function rightFromYaw(y) { return new THREE.Vector3(Math.cos(y), 0, Math.sin(y)); }
function toWorld(origin, yaw, lx, ly, lz, out) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return out.set(origin.x + lx * c - lz * s, origin.y + ly, origin.z + lx * s + lz * c);
}
// physics runs in the shot's own frame (ball at origin, aim along -z)
function shotFrame(origin, yaw, live = false) { // live: the real shot, trees and all (previews fly clear)
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => origin.x + lx * c - lz * s, wz = (lx, lz) => origin.z + lx * s + lz * c;
  const cupRel = HOLE.pinPos.clone().sub(origin);
  const solid = T.rocks.length || T.cave ? (lx, ly, lz) => { const n = T.solidAt(wx(lx, lz), origin.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; } : null;
  return {
    groundAt: (lx, lz) => { const g = groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - origin.y; },
    surfaceAt: (lx, lz) => physSurface(wx(lx, lz), wz(lx, lz)),
    solidAt: solid,
    treeAt: live && (treeField?.count || T.curtains.length) ? (lx, ly, lz) => {
      const X = wx(lx, lz), Z = wz(lx, lz), Y = origin.y + ly;
      if (T.curtains.length && T.curtainAt(X, Y, Z)) return { density: 3 }; // a waterfall knocks it down
      const r = treeField && treeField.count ? treeField.at(X, Y, Z) : null; if (!r || !r.n) return r;
      const n = r.n; return { n: [n[0] * c + n[2] * s, 0, -n[0] * s + n[2] * c] };
    } : null,
    cup: { x: cupRel.x * c + cupRel.z * s, z: -cupRel.x * s + cupRel.z * c },
    voidY: T.voidY - origin.y,
    wind: windInShot(windVec, yaw), altFt: COURSE.altFt || 0, tempF: tempF(),
  };
}
function lieAdjust(shot, lie) {
  const s = { ...shot };
  if (lie === 'firstcut') { s.Speed *= 0.98; s.TotalSpin *= 0.88; s.VLA += 0.3; }
  else if (lie === 'rough') { s.Speed *= 0.94; s.TotalSpin *= 0.7; s.VLA += 0.8; }
  else if (lie === 'sand') { s.Speed *= 0.86; s.TotalSpin *= 0.65; s.VLA += 2; }
  else if (lie === 'waste') { s.Speed *= 0.94; s.TotalSpin *= 0.78; s.VLA += 0.6; }
  else if (lie === 'desert') { s.Speed *= 0.9; s.TotalSpin *= 0.62; s.VLA += 1; }
  else if (lie === 'powder') { s.Speed *= 0.78; s.TotalSpin *= 0.55; s.VLA += 3; }   // soft snow: the ball sits down in it
  return s;
}
// the slope under the ball, as the golfer stands: along the aim (+ = uphill) and across it (+ = rising to
// the right, which puts the ball above a right-hander's feet), in degrees
function lieSlope() {
  if (!T || state.lie === 'tee' || state.lie === 'green') return { up: 0, side: 0 };
  const g = T.slopeAt(state.ball.x, state.ball.z), sy = Math.sin(state.yaw), cy = Math.cos(state.yaw);
  const deg = v => Math.atan(v) * 180 / Math.PI;
  return { up: deg(g.x * sy - g.z * cy), side: deg(g.x * cy + g.z * sy) };
}
// the shot as the lie lets it come off: surface, slope (uphill launches higher, ball above the feet pulls
// left, below pushes right), and in native desert sometimes a bad lie. luck=false for previews.
function lieShot(raw, luck = true) {
  const s = lieAdjust(raw, state.lie), L = lieSlope();
  if (Math.abs(L.up) > 0.6) { s.VLA = Math.max(1.5, s.VLA + 0.8 * L.up); s.TotalSpin *= 1 + 0.015 * L.up; }
  if (Math.abs(L.side) > 0.6) { s.HLA -= 0.35 * L.side; s.SpinAxis -= 0.7 * L.side; }
  if (luck && state.lie === 'desert' && !window.__noVar && Math.random() < 0.4) { s.Speed *= 0.82 + 0.1 * Math.random(); s.HLA += gauss() * 2.5; s.TotalSpin *= 0.7; state.badLie = true; }
  return s;
}
function clubShot(ci, pk) { return clubShotK(ci, POWERS[pk].k); }
function clubShotK(ci, k) { // k: swing length, fraction of full
  const c = CLUBS[ci];
  return { Speed: c.Speed * k, VLA: c.VLA + (1 - k) * 7, HLA: 0, TotalSpin: c.TotalSpin * (0.65 + 0.35 * k), SpinAxis: 0 };
}
const carryCache = new Map();
function carryFor(ci, pk, dy) { return carryForK(ci, POWERS[pk].k, dy); }
function carryForK(ci, k, dy, env) { // metres of carry to land at height dy relative to the ball
  // env: { headZ (wind along the shot, m/s; + = into you), altFt, tempF, lie }; default = this course now
  const E = env || { headZ: state.headZ || 0, altFt: COURSE.altFt || 0, tempF: tempF(), lie: state.lie };
  const key = ci + ':' + k.toFixed(3) + ':' + Math.round(dy) + ':' + E.lie + ':' + E.headZ.toFixed(1) + ':' + E.altFt + ':' + E.tempF;
  if (carryCache.has(key)) return carryCache.get(key);
  const g = Math.round(dy);
  // fly through open air and read off where the descending ball passes the target's height
  const r = simulate(lieAdjust(clubShotK(ci, k), E.lie), { groundAt: (x, z) => (Math.hypot(x, z) < 6 ? 0 : null), voidY: Math.min(g, 0) - 40, altFt: E.altFt, tempF: E.tempF, wind: { x: 0, z: E.headZ } });
  let v = 0, apexSeen = false;
  for (let i = 1; i < r.pts.length; i++) {
    const a = r.pts[i - 1].p, b = r.pts[i].p;
    if (b[1] < a[1]) apexSeen = true;
    if (apexSeen && a[1] >= g && b[1] < g) { const f = (a[1] - g) / (a[1] - b[1]); v = Math.hypot(a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f); break; }
  }
  carryCache.set(key, v); return v;
}
function suggest(distM, dy) { // pick club + swing length whose carry best matches the target
  let best = null;
  const allowDriver = state.lie === 'tee';
  for (let ci = 0; ci < CLUBS.length; ci++) {
    if (ci === 0 && !allowDriver) continue;
    for (let pk = 0; pk < POWERS.length; pk++) {
      if (pk > 0 && ci < 5) continue; // partial swings only with short irons and wedges
      const c = carryFor(ci, pk, dy);
      // a target higher than this club can climb (under a rim): prefer the most lofted full swing
      const err = c <= 0 ? 1e6 - ci * 10 + pk : Math.abs(c - distM) + (pk > 0 ? 2 : 0) + (c < distM ? 1.5 : 0);
      if (!best || err < best.err) best = { ci, pk, err };
    }
  }
  return best;
}

// the swing length (fraction of full) that carries club ci to distM at height dy
function kFor(ci, distM, dy) {
  if (carryForK(ci, 1, dy) <= distM) return 1;
  let lo = 0.2, hi = 1;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (carryForK(ci, m, dy) > distM) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

/* ---------- targets & aim ---------- */
function targetPoint(i) {
  const t = HOLE.targets[i];
  return t.pin ? HOLE.pinPos.clone() : new THREE.Vector3(t.x, groundAt(t.x, t.z) ?? state.ball.y, t.z);
}
function availableTargets() { // only those still ahead of the ball
  const pinD = state.ball.distanceTo(HOLE.pinPos);
  return HOLE.targets.map((t, i) => ({ t, i, p: targetPoint(i) })).filter(o => o.t.pin || (o.p.distanceTo(HOLE.pinPos) < pinD - 15 && o.p.distanceTo(state.ball) > 25));
}
// aiming at a spot (a target, a tap on the course or the map) turns you to face it; dragging the
// aim line afterwards (or the arrow keys) swings the shot without turning the view
function aimAt(p, autoClub = true) {
  const d = p.clone().sub(state.ball); d.y = 0;
  state.yaw = state.camYaw = Math.atan2(d.x, -d.z); state.aimPoint = p.clone();
  state.headZ = windInShot(windVec, state.yaw).z;
  if (autoClub) {
    const dist = Math.hypot(d.x, d.z), dy = (p.y - state.ball.y);
    const s = suggest(dist, dy); state.sugg = s.ci; state.suggK = kFor(s.ci, dist, dy);
    state.aimDist = dist; state.aimDy = dy;
    tool.suggest({ club: s.ci });
    // aiming by hand: set the swing length that gets your club there (you can change it on the bar)
    const t = tool.settings;
    if (!t.autoAim) tool.setPct((t.clubAuto ? state.suggK : kFor(t.club, dist, dy)) * 100, { silent: true });
  }
  applyTool();
}
// The simulated-shot tool: Auto plays the suggested club. With auto-aim the swing length is
// whatever reaches your target; without it, it's the tool's bar (set for you when you pick a
// target or tap a spot). Trajectory and shape change the ball itself.
function applyTool() {
  const s = tool.settings;
  state.club = s.clubAuto ? (state.sugg ?? state.club) : s.club;
  state.k = !s.autoAim ? s.pct / 100 : s.clubAuto ? (state.suggK ?? 1) : kFor(state.club, state.aimDist || 0, state.aimDy || 0);
  updatePreview(); renderPlan();
}
function planShot() {
  const s = tool.settings, b = clubShotK(state.club, state.k), t = TRAJ_MUL[s.traj] || TRAJ_MUL.normal;
  return { Speed: b.Speed * t.speed, VLA: b.VLA * t.vla, HLA: -s.axis * 0.37, TotalSpin: b.TotalSpin * t.spin, SpinAxis: s.axis };
}
function selectTarget(i) { state.target = i; state.aimCustom = null; aimAt(targetPoint(i)); }

/* ---------- preview ---------- */
let pvTimer = 0;
// Auto-aim: turn the shot so it lands right on the spot you're aiming at, curve and all.
function landLocal(r) { const li = r.pts.findIndex(p => p.phase !== 'flight'); let k = li; if (k < 0) { k = r.pts.findIndex((p, i) => i > 10 && p.p[1] < 0); if (k < 0) k = r.pts.length - 1; } return r.pts[k].p; }
function updatePreview() {
  if (pvTimer) return; // at most one preview per 30 ms (it reads the latest aim when it runs, so a drag stays smooth)
  pvTimer = setTimeout(() => {
    pvTimer = 0;
    let fr = shotFrame(state.ball, state.yaw);
    let r = simulate(lieShot(planShot(), false), fr);
    if (tool.autoAim && state.aimPoint) {
      const want = Math.atan2(state.aimPoint.x - state.ball.x, -(state.aimPoint.z - state.ball.z));
      for (let it = 0; it < 2; it++) {
        const l = landLocal(r), off = Math.atan2(l[0], -l[2]), err = Math.atan2(Math.sin(want - state.yaw - off), Math.cos(want - state.yaw - off));
        if (Math.abs(err) < 0.0005) break;
        state.yaw += err; fr = shotFrame(state.ball, state.yaw); r = simulate(lieShot(planShot(), false), fr);
      }
    }
    state.preview = r;
    const pts = r.pts, li = pts.findIndex(p => p.phase !== 'flight');
    const arr = [], tmpV = new THREE.Vector3();
    const end = li < 0 ? pts.length - 1 : li;
    for (let i = 0; i <= end; i += 6) { toWorld(state.ball, state.yaw, pts[i].p[0], pts[i].p[1], pts[i].p[2], tmpV); arr.push(tmpV.x, tmpV.y, tmpV.z); }
    setLine(previewArc, arr);
    let landW;
    if (li >= 0) landW = toWorld(state.ball, state.yaw, ...pts[li].p, new THREE.Vector3());
    else { // never landed: mark where it passes the ball's height
      let k = pts.findIndex((p, i) => i > 10 && p.p[1] < 0); if (k < 0) k = pts.length - 1;
      landW = toWorld(state.ball, state.yaw, ...pts[k].p, new THREE.Vector3());
    }
    const surf = r.outcome === 'void' ? 'void' : surfaceAt(landW.x, landW.z);
    const endW = toWorld(state.ball, state.yaw, ...pts.at(-1).p, new THREE.Vector3());
    const restSurf = r.outcome === 'void' ? 'void' : r.outcome === 'holed' ? 'holed' : surfaceAt(endW.x, endW.z);
    const col = { fairway: 0x8fdc8a, fringe: 0x8fdc8a, firstcut: 0xb8dc8a, tee: 0x8fdc8a, green: 0x8fdc8a, rough: 0xf5c542, desert: 0xf5a142, waste: 0xf5a142, sand: 0xe8d29a, water: 0xff7b6b, void: 0xff7b6b, holed: 0x8fdc8a }[restSurf] ?? 0xf5c542;
    aimRing.material.color.set(col); aimFill.material.color.set(col);
    const carryM = Math.hypot(pts[end].p[0], pts[end].p[2]);
    const latSd = Math.max(1.5, carryM * 0.05), depSd = Math.max(1.5, carryM * 0.045);
    for (const m of [aimRing, aimFill]) { m.position.copy(landW); m.position.y += 0.05; m.scale.set(latSd * 1.4, 1, depSd * 1.4); m.rotation.y = -state.yaw; m.visible = state.phase === 'address'; }
    restDot.position.copy(endW); restDot.position.y += 0.05; restDot.visible = state.phase === 'address' && r.outcome !== 'void';
    state.previewAim = { land: landW.clone(), rest: r.outcome === 'void' ? null : endW.clone(), color: '#' + new THREE.Color(col).getHexString(), lat: latSd * 1.4, dep: depSd * 1.4 };
    state.previewLand = landW;
    const names = { ...LIE_NAMES, void: VOID_TEXT[1].replace('Ends in', 'In'), holed: 'In the hole' };
    const carryYd = Math.round(r.carry);
    $('pvText').innerHTML = r.outcome === 'void'
      ? `<b style="color:var(--bad)">${carryYd > 0 && r.landed ? carryYd + ' carry · ' : ''}${VOID_TEXT[1]}</b>`
      : `${carryYd} carry · ${yd(Math.hypot(endW.x - state.ball.x, endW.z - state.ball.z))} total · <b style="color:${lieColor(restSurf)}">${names[restSurf]}</b>`;
    $('pvDot').style.background = '#' + new THREE.Color(col).getHexString();
  }, 30);
}

/* ===================== UI ===================== */
function renderPlan() {
  const tw = $('targets');
  const av = availableTargets();
  tw.innerHTML = '';
  av.forEach(o => {
    const b = document.createElement('button'); b.className = 'tgt';
    const d = Math.hypot(o.p.x - state.ball.x, o.p.z - state.ball.z), dy = o.p.y - state.ball.y;
    b.innerHTML = `<b>${o.t.name}</b><span>${yd(d)} yd${Math.abs(dy) > 2 ? ` · ${dy > 0 ? '↑' : '↓'}${Math.round(Math.abs(dy))} m` : ''}</span>`;
    b.setAttribute('aria-pressed', String(!state.aimCustom && state.target === o.i));
    b.onclick = () => { if (state.phase === 'address') selectTarget(o.i); };
    tw.appendChild(b);
  });
  if (state.rimDrop && state.phase === 'address') {
    const b = document.createElement('button'); b.className = 'tgt drop';
    b.innerHTML = `<b>Back up top</b><span>+1 stroke</span>`;
    b.onclick = () => { if (state.phase !== 'address' || !state.rimDrop) return; state.strokes++; state.ball.copy(state.rimDrop); state.lie = surfaceAt(state.ball.x, state.ball.z); state.rimDrop = null; toast('Back up top', '+1. Dropped beside where it went over the rim.', 2600); nextLie(); };
    tw.appendChild(b);
  }
  if (state.aimCustom) { const b = document.createElement('button'); b.className = 'tgt'; b.setAttribute('aria-pressed', 'true'); b.innerHTML = `<b>Your spot</b><span>${yd(Math.hypot(state.aimCustom.x - state.ball.x, state.aimCustom.z - state.ball.z))} yd</span>`; tw.appendChild(b); }
  const lieNames = { tee: 'Tee box', fairway: 'Fairway', fringe: 'Fringe', firstcut: 'First cut −2%', rough: 'Rough −6%', sand: 'Bunker −14%', waste: 'Waste area −6%', desert: (CAVE ? 'Cave floor' : MESA ? 'Native' : 'Rough') + ' −10%', green: 'Green' };
  const pct = state.k < 0.995 ? ` · ${Math.round(state.k * 100)}%` : '';
  const L = lieSlope(), slopeTxt = [Math.abs(L.up) >= 2 ? `${L.up > 0 ? 'uphill' : 'downhill'} ${Math.round(Math.abs(L.up))}°` : '', Math.abs(L.side) >= 2 ? `ball ${L.side > 0 ? 'above' : 'below'} feet` : ''].filter(Boolean).join(', ');
  $('pvLie').textContent = `${CLUBS[state.club].name}${pct} · Lie: ${lieNames[state.lie] || state.lie}${slopeTxt ? ' · ' + slopeTxt : ''}`;
  $('vClub').textContent = CLUBS[state.club].name + pct;
  if (state.lastSentClub !== state.club) { state.lastSentClub = state.club; launchMonitor.setPlayer({ club: CLUBS[state.club].id }); }
}
// "plays like": the card yardage after the climb or drop to the green and the course's altitude and
// temperature, from the flight model (a 7 iron's carry; wind is shown separately)
function playsLike(h) {
  const ty = groundAt(h.tee[0], h.tee[1]), dy = h.pinPos.y - ty, y = yardsOf(h);
  const sea = { headZ: 0, altFt: 0, tempF: 72, lie: 'fairway' }, here = { headZ: 0, altFt: COURSE.altFt || 0, tempF: tempF(), lie: 'fairway' };
  const flatSea = carryForK(4, 1, 0, sea), flatHere = carryForK(4, 1, 0, here);
  const dyc = Math.min(dy, 16), drop = carryForK(4, 1, dyc, here);
  const elev = drop > 0 && Math.abs(dyc) > 0.5 ? (flatHere - drop) * (dy / dyc) : 0;
  return { yards: Math.round(y * flatSea / flatHere + elev / M_PER_YD), dy };
}
function renderHoleCard() {
  const h = HOLE, n = state.holeIdx + 1, y = yardsOf(h);
  $('hName').textContent = h.name;
  const pl = h.playsLike;
  $('hMeta').textContent = `Hole ${n} · Par ${h.par} · ${y} yd` + (pl && Math.abs(pl.yards - y) >= 4 ? ` · plays ${pl.yards}` : '');
  $('hStroke').textContent = state.phase === 'holed' ? state.strokes : state.strokes + 1;
  const d = Math.hypot(HOLE.pinPos.x - state.ball.x, HOLE.pinPos.z - state.ball.z);
  $('hPin').innerHTML = state.lie === 'green' ? Math.round(d / 0.3048) + '<small>ft</small>' : yd(d) + '<small>yd</small>';
}
function lr(v, unit = '') { const a = Math.abs(v); if (a < 0.5) return '0' + unit; return `${a.toFixed(a < 10 ? 1 : 0)}${unit} <span class="${v < 0 ? 'L' : 'R'}">${v < 0 ? 'L' : 'R'}</span>`; }
function showReadout(r, shot, res) {
  $('vCarry').innerHTML = (r.landed ? Math.round(r.carry) : '—') + '<small>yd</small>';
  $('vTotal').innerHTML = r.outcome === 'void' ? '—' : Math.round(r.total) + '<small>yd</small>';
  $('vOff').innerHTML = lr(r.offline);
  $('vApex').innerHTML = Math.round(r.apexFt) + '<small>ft</small>';
  $('vSpd').innerHTML = shot.Speed.toFixed(1) + '<small>mph</small>';
  $('vVla').innerHTML = shot.VLA.toFixed(1) + '<small>°</small>';
  $('vSpin').innerHTML = Math.round(shot.TotalSpin).toLocaleString() + '<small>rpm</small>';
  $('vAxis').innerHTML = lr(shot.SpinAxis, '°');
  $('vRes').innerHTML = res || '—';
}
let toastT = 0;
function toast(title, msg, ms = 2600) { const t = $('toast'); t.innerHTML = `<b>${title}</b>${msg || ''}`; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function setPhaseUI() {
  const onGreen = state.phase === 'putt';
  $('swingUI').hidden = onGreen || state.phase === 'holed' || state.phase === 'rolling'; $('putt').hidden = !(onGreen || state.phase === 'rolling');
  tool.setEnabled(state.phase === 'address');
  $('puttBtn').disabled = state.phase !== 'putt';
  $('dock').style.visibility = state.phase === 'intro' || state.phase === 'setup' ? 'hidden' : 'visible';
  $('holeCard').style.visibility = state.phase === 'setup' ? 'hidden' : 'visible';
  $('targetsBox').hidden = state.phase !== 'address';
  if (state.phase !== 'address' && tool.isOpen) tool.open(false);

  $('skip').hidden = state.phase !== 'intro';
  $('setup').hidden = state.phase !== 'setup';
  $('intro').hidden = state.phase !== 'intro';
  renderHoleCard();
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
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 340; bp.Q.value = 0.4;
    const amb = ctx.createGain(); amb.gain.value = 0; src.connect(bp).connect(amb).connect(ctx.destination); src.start();
    amb.gain.setTargetAtTime(state.sound ? 0.05 : 0, ctx.currentTime, 1);
    audio.amb = amb; audio.noise = buf;
  } catch (e) { audio.ctx = null; }
}
function strikeSound(wood, q) {
  const ctx = audio.ctx; if (!ctx || !state.sound) return;
  const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = audio.noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = wood ? 3600 : 2600; bp.Q.value = wood ? 1.4 : 0.9;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.8 * q, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + (wood ? 0.16 : 0.09));
  n.connect(bp).connect(hp).connect(g).connect(ctx.destination); n.start(t, Math.random()); n.stop(t + 0.25);
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(wood ? 1650 : 980, t); o.frequency.exponentialRampToValueAtTime(wood ? 900 : 380, t + 0.06);
  const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(wood ? 0.5 : 0.65, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + (wood ? 0.22 : 0.08));
  o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.3);
}
function tick(freq, len, vol) {
  const ctx = audio.ctx; if (!ctx || !state.sound) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + len + 0.05);
}

/* ===================== swings ===================== */
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function realSwing(base) {
  const s = { ...base }, face = gauss() * 1.5, path = gauss() * 2.0, strike = Math.random();
  if (window.__noVar) return { ...base, HLA: 0, SpinAxis: 0 };
  s.HLA = (base.HLA || 0) + face * 0.8 + path * 0.2;
  s.SpinAxis = (base.SpinAxis || 0) + (face - path) * 1.6 + gauss() * 1.2;
  s.Speed = base.Speed * (1 + gauss() * 0.012);
  s.VLA = base.VLA + gauss() * 0.9;
  s.TotalSpin = base.TotalSpin * (1 + gauss() * 0.07);
  if (strike < 0.07) { s.Speed *= 0.93; s.VLA -= 2.5; s.TotalSpin *= 0.78; }
  else if (strike < 0.12) { s.Speed *= 0.9; s.VLA += 2; s.TotalSpin *= 1.15; }
  return s;
}
// Live launch-monitor entry point (GSPro Open Connect v1 BallData). A local bridge can call this per shot.
// Real shots from the R10 arrive through the bridge (see src/launch-monitor.js).
// On the green the app putts for you, since the R10 doesn't read putts well.
// A real swing that arrives a moment early (the last ball still flying or settling) is held and played as
// soon as the next lie is ready; on the hole's flyover it ends the flyover and plays.
const liveQ = createLiveQueue({
  ready: () => state.phase === 'address', canHold: () => state.phase === 'flight' || state.phase === 'rest', play: shot => launch(shot),
  onHold: () => toast('Swing received', 'It plays when the ball is ready.', 2200),
  onDrop: (s, why) => { if (why === 'too-early') toast('Swing not counted', 'It came before the ball was ready.', 2400); else if (state.phase === 'putt' || state.phase === 'rolling') toast('On the green', 'Tap Putt to putt.', 2000); },
});
function receiveShot(shot) { initAudio(); if (state.phase === 'intro') endIntro(); liveQ.push(shot); }
keepAwake();
// every live shot goes in the session record (My game's On the course tab)
recorder.attach(launchMonitor, { page: 'course', mode: 'course', club: () => CLUBS[state.club].id });
launchMonitor.addEventListener('shot', e => receiveShot(e.detail));
mountLaunchMonitorUI({ dot: document.getElementById('lmDot'), text: document.getElementById('lmText'), button: document.getElementById('lmBtn'), compact: true });
window.Aerie = { receiveShot(msg) { const b = msg.BallData || msg; if (b.Speed > 0) receiveShot({ Speed: +b.Speed, VLA: +b.VLA, HLA: +(b.HLA || 0), TotalSpin: +b.TotalSpin, SpinAxis: +(b.SpinAxis || 0) }); } };

function swing(s = { ideal: false }) { if (state.phase !== 'address') return; initAudio(); launch(s.ideal ? planShot() : realSwing(planShot())); }
function launch(raw) {
  state.badLie = false;
  const shot = lieShot(raw);
  if (state.badLie) toast('Bad lie', 'It sat down in the scrub.', 1800);
  const fr = shotFrame(state.ball, state.yaw, true);
  const r = simulate(shot, fr);
  const W = r.pts.map(p => ({ t: p.t, phase: p.phase, w: toWorld(state.ball, state.yaw, p.p[0], p.p[1], p.p[2], new THREE.Vector3()) }));
  const lift = state.lie === 'tee' ? 0.045 : 0.0;
  W.forEach(p => { p.w.y += lift * Math.max(0, 1 - p.t * 4); });
  const li = W.findIndex(p => p.phase !== 'flight');
  r.landIdx = li < 0 ? W.length - 1 : li;
  r.apexT = W.reduce((b, p) => p.w.y > b.y ? { y: p.w.y, t: p.t } : b, { y: -1e9, t: 0 }).t;
  state.flight = { r, shot, raw, W, from: state.ball.clone(), fromLie: state.lie, arr: [], aim: state.previewLand ? state.previewLand.clone() : null, k: state.k };
  state.t = 0; state.phase = 'flight'; state.strokes++;
  for (const m of [aimRing, aimFill, restDot]) m.visible = false; previewArc.visible = false;
  oldTracers.forEach(l => { l.material.opacity *= 0.5; });
  setPhaseUI();
  showReadout({ ...r, carry: 0, landed: false, outcome: 'void', total: 0 }, shot, '…');
  strikeSound(CLUBS[state.club].tee, 1);
  camState.cut = true; camState.landCut = false;
  const lp = W[r.landIdx].w;
  camState.landAt = lp.clone(); camState.landDir = lp.clone().sub(state.ball).setY(0).normalize();
}

function finishShot() {
  const f = state.flight, r = f.r, end = f.W.at(-1).w;
  let res = '';
  if (r.outcome === 'holed') {
    state.tracks.push(groundTrack(f.W, f.W.length - 1));
    state.ball.copy(HOLE.pinPos); res = '<span style="color:var(--ok)">Holed</span>';
    recordCourseShot(f, r, HOLE.pinPos, 'holed');
    holeOut(); showReadout(r, f.shot, res); return;
  }
  if (r.outcome === 'void') {
    state.strokes++; state.rimDrop = null; // penalty
    // a red penalty area: drop within two club lengths of where it last left an island, no nearer the
    // hole (relief.js); if there's nowhere, play again from where it was hit
    const rd = cloudDrop({ track: f.W.map(p => [p.w.x, p.w.z]), pin: [HOLE.pinPos.x, HOLE.pinPos.z], groundAt, surfaceAt });
    const drop = rd ? new THREE.Vector3(rd.x, groundAt(rd.x, rd.z), rd.z) : f.from.clone();
    const isPrev = !rd || drop.distanceTo(f.from) < 1;
    state.ball.copy(drop); state.lie = isPrev ? f.fromLie : surfaceAt(drop.x, drop.z);
    toast(VOID_TEXT[0], `+1 penalty. ${isPrev ? 'Replaying from where you hit it.' : 'Dropping beside where it went over.'}`, 3200);
    res = '<span style="color:var(--bad)">Void +1</span>';
  } else {
    state.ball.copy(end); state.lie = surfaceAt(end.x, end.z);
    res = `<span style="color:${lieColor(state.lie)}">${LIE_NAMES[state.lie] || state.lie}</span>`;
    state.rimDrop = null;
    if (state.lie === 'water') { // a stroke, and a drop beside where it went in, no nearer the hole
      state.strokes++;
      let entry = f.from.clone();
      for (let i = f.W.length - 1; i >= 0; i--) { const p = f.W[i].w, sf = surfaceAt(p.x, p.z); if (sf !== 'water' && sf !== 'void' && groundAt(p.x, p.z) !== null) { entry = p.clone(); break; } }
      const back = new THREE.Vector3(f.from.x - entry.x, 0, f.from.z - entry.z);
      const drop = back.lengthSq() > 9 ? entry.clone().add(back.setLength(3)) : f.from.clone();
      drop.y = groundAt(drop.x, drop.z) ?? f.from.y;
      state.ball.copy(drop); state.lie = surfaceAt(drop.x, drop.z); if (state.lie === 'water') { state.ball.copy(f.from); state.lie = f.fromLie; }
      toast('In the water', '+1. Dropping beside where it went in.', 3000);
      res = `<span style="color:var(--bad)">${VOLC ? 'Lava' : 'Water'} +1</span>`;
    }
    if (HOLE.pinPos.y - end.y > 12) { // under a rim it can't climb: offer a drop back up where it went over (+1)
      for (let i = f.W.length - 1; i >= 0; i--) {
        const p = f.W[i].w, g = groundAt(p.x, p.z), I = islandAt(p.x, p.z);
        if (g === null || g < end.y + 8 || !I || I.kind === 'rock' || surfaceAt(p.x, p.z) === 'desert') continue;
        const back = new THREE.Vector3(f.from.x - p.x, 0, f.from.z - p.z).setLength(4).add(p);
        const gb = groundAt(back.x, back.z); if (gb === null) continue;
        state.rimDrop = back.setY(gb); break;
      }
    }
    if (f.fromLie === 'tee' && state.club === 0 && r.landed) recordDrive(Math.hypot(end.x - f.from.x, end.z - f.from.z) / M_PER_YD);
    if (r.treeHits && T.curtains.length && f.W.some(p => T.curtainAt(p.w.x, p.w.y, p.w.z))) toast('Through the falls', 'The water knocked it down.', 2200);
    else if (r.treeHits) toast('In the trees', '', 1600);
    else if (r.rockHits && T.rocks.length) toast('Off the rock', '', 1600);
  }
  showReadout(r, f.shot, res);
  recordCourseShot(f, r, end, state.lie);
  state.tracks.push(groundTrack(f.W, f.W.length - 1));
  // keep this shot's tracer as a faint ghost
  const ghost = mkLine('#f5c542', 1.6, 0.35); setLine(ghost, f.arr.slice()); oldTracers.push(ghost); resizeLines();
  while (oldTracers.length > 3) { const o = oldTracers.shift(); scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  nextLie();
}
// the shot's place in the round, for My game's On the course tab: where it was hit from, where it
// ended up, and the miss against where you aimed (the aim line's landing spot), along and across the line
function recordCourseShot(f, r, end, restLie) {
  if (!recorder.idOf(f.raw)) return;
  const yd = m => Math.round(m / M_PER_YD * 10) / 10, pin = HOLE.pinPos;
  const land = f.W[r.landIdx].w, c = { course: COURSE.id, hole: state.holeIdx + 1, par: HOLE.par, stroke: state.strokes,
    fromLie: f.fromLie, fromPin: yd(Math.hypot(pin.x - f.from.x, pin.z - f.from.z)), restLie: r.outcome === 'void' ? 'void' : restLie,
    toPin: yd(Math.hypot(pin.x - end.x, pin.z - end.z)), carry: Math.round(r.carry * 10) / 10, swing: Math.round((f.k || 1) * 100) };
  if (f.aim) { // + = long / right of where you aimed
    const ax = f.aim.x - f.from.x, az = f.aim.z - f.from.z, L = Math.hypot(ax, az) || 1, ux = ax / L, uz = az / L;
    const dx = land.x - f.aim.x, dz = land.z - f.aim.z;
    c.aimYd = yd(L); c.long = yd(dx * ux + dz * uz); c.right = yd(dx * -uz + dz * ux);
  }
  recorder.course(f.raw, c);
}
// a rough check that a normal shot from a to b isn't blocked by rock or a rise in the ground: an arc that
// peaks at about a ninth of the distance (4-32 m) over the straight line between them
function flightClear(a, b) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), apex = Math.min(32, Math.max(4, d / 9));
  for (let t = 0.06; t < 0.95; t += 0.04) {
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, y = a.y + (b.y - a.y) * t + 4 * apex * t * (1 - t);
    const g = groundAt(x, z); if (g != null && g > y) return false;
    if (T.solidAt && T.solidAt(x, y, z)) return false;
  }
  return true;
}
function nextLie() {
  carryCache.clear(); saveRound();
  if (SHAPED && skyCtx?.drifts?.length) SP.moveDrifts(skyCtx);
  if (CAVE && T.cart) T.cart.next(); // the ore cart rolls on between shots
  if (state.lie === 'green' || (state.lie === 'fringe' && state.ball.distanceTo(HOLE.pinPos) < 22)) { startPutting(); return; }
  state.phase = 'address'; state.aimCustom = null;
  if (liveQ.pending) setTimeout(() => liveQ.flush(), 400);
  const av = availableTargets();
  // default: the first target the player can actually reach, else the pin
  const reach = carryFor(state.lie === 'tee' ? 0 : 1, 0, 0);
  const pinO = av.find(o => o.t.pin), flat = o => Math.hypot(o.p.x - state.ball.x, o.p.z - state.ball.z);
  const clear = o => flightClear(state.ball, o.p);
  // the pin when it's in reach and nothing stands in the way; else the first target in the hole's order, skipping one
  // that would only be a short shot (under 60% of reach) when a further one is also in reach and clear
  const ok = av.filter(o => !o.t.pin && flat(o) < reach * 1.02 && clear(o));
  let pick = pinO && flat(pinO) < reach * 0.9 && clear(pinO) ? pinO
    : (ok.find(o => flat(o) >= reach * 0.6) || ok.reduce((a, o) => (!a || flat(o) > flat(a) ? o : a), null) || pinO);
  state.target = pick ? pick.i : HOLE.targets.length - 1;
  placeBall();
  selectTarget(state.target);
  setPhaseUI();
}
function placeBall() { ball.position.copy(state.ball); ball.position.y += BALL_RADIUS + (state.lie === 'tee' ? 0.045 : 0.003); ball.visible = true; }

/* ---------- putting ---------- */
const MAKE = [[2, 0.99], [3, 0.96], [4, 0.88], [5, 0.77], [6, 0.66], [8, 0.5], [10, 0.4], [15, 0.23], [20, 0.15], [30, 0.07], [40, 0.045], [60, 0.025], [90, 0.01]];
function makeProb(ft) { if (ft <= MAKE[0][0]) return MAKE[0][1]; for (let i = 1; i < MAKE.length; i++) if (ft <= MAKE[i][0]) { const [a, pa] = MAKE[i - 1], [b, pb] = MAKE[i]; return pa + (pb - pa) * (ft - a) / (b - a); } return 0.008; }
// read the putt off the green: how much it breaks, up or down, and whether it crosses a tier
function puttRead(from, to) {
  const d = new THREE.Vector3(to.x - from.x, 0, to.z - from.z), L = d.length() || 1; d.divideScalar(L);
  const right = { x: -d.z, z: d.x }, h0 = groundAt(from.x, from.z) ?? from.y, h1 = groundAt(to.x, to.z) ?? to.y;
  let cross = 0, tier = 0; const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = from.x + d.x * L * t, z = from.z + d.z * L * t, g = T.slopeAt(x, z, 0.4);
    cross += (g.x * right.x + g.z * right.z) / (n + 1);
    const h = groundAt(x, z); if (h !== null) tier = Math.max(tier, Math.abs(h - (h0 + (h1 - h0) * t)));
  }
  const grade = (h1 - h0) / L * 100, brk = cross * 100; // % uphill (+) and % rising to the right
  let k = 1 / (1 + 0.13 * Math.abs(brk));
  if (grade < -0.5) k *= Math.max(0.7, 1 + 0.07 * grade);
  if (tier > 0.3) k *= 0.62;
  const words = [Math.abs(brk) > 0.8 ? `breaks ${brk > 0 ? 'left' : 'right'}` : 'straight', grade > 0.8 ? 'uphill' : grade < -0.8 ? 'downhill' : '', tier > 0.3 ? 'across a tier' : ''].filter(Boolean);
  return { k, words, hard: (1 - k) };
}
function startPutting() {
  state.phase = 'putt'; placeBall(); saveRound();
  const ft = state.ball.distanceTo(HOLE.pinPos) / 0.3048;
  if ($('gimme').checked && ft <= 3) { state.strokes++; toast('Gimme', 'Picked up and counted.'); holeOut(); return; }
  $('puttDist').innerHTML = (ft < 10 ? ft.toFixed(1) : Math.round(ft)) + '<small>ft</small>';
  state.read = puttRead(state.ball, HOLE.pinPos);
  $('puttOdds').textContent = `${state.read.words.join(', ')[0].toUpperCase()}${state.read.words.join(', ').slice(1)} · tour make rate ${Math.round(makeProb(ft) * state.read.k * 100)}%`;
  for (const m of [aimRing, aimFill, restDot]) m.visible = false; previewArc.visible = false;
  setPhaseUI();
}
function putt() {
  if (state.phase !== 'putt') return; initAudio();
  const from = state.ball.clone(), to = HOLE.pinPos.clone(), dist = from.distanceTo(to), ft = dist / 0.3048;
  const rd = state.read || { k: 1, hard: 0 };
  const made = Math.random() < makeProb(ft) * rd.k;
  let end;
  if (made) end = to.clone();
  else {
    const leftover = Math.max(0.35, (0.4 + Math.abs(gauss()) * 0.9 + ft * 0.045) * 0.3048 * (1 + 1.6 * rd.hard));
    const dir = to.clone().sub(from).setY(0).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
    const long = Math.random() < 0.6 ? 1 : -1;
    end = to.clone().addScaledVector(dir, long * leftover * 0.8).addScaledVector(side, gauss() * leftover * 0.6);
    if (long < 0) end = to.clone().addScaledVector(dir, -leftover * 0.9).addScaledVector(side, gauss() * leftover * 0.5);
    end.y = groundAt(end.x, end.z) ?? to.y;
  }
  state.strokes++;
  state.puttAnim = { from, end, made, t: 0, dur: Math.min(4, 1.1 + Math.sqrt(dist) * 0.55) };
  state.phase = 'rolling'; setPhaseUI();
  tick(520, 0.06, 0.35);
}

/* ---------- hole flow ---------- */
function holeOut() {
  state.phase = 'holed'; ball.visible = false;
  state.scores[state.holeIdx] = state.strokes;
  if (state.holeIdx === HOLES.length - 1) clearRound(); else saveRound(true);
  const diff = state.strokes - HOLE.par;
  const word = state.strokes === 1 ? 'Hole in one' : ({ '-3': 'Albatross', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Double bogey' }[diff] || `+${diff}`);
  toast(word, `${state.strokes} strokes on ${HOLE.name}`, 2800);
  tick(220, 0.12, 0.6); setTimeout(() => tick(180, 0.15, 0.5), 90);
  setPhaseUI();
  setTimeout(() => showCard(true), 2400);
}
function showCard(afterHole) {
  const rows = HOLES.map((h, i) => { const s = state.scores[i]; const d = s != null ? s - h.par : null; return `<tr><td>${i + 1}</td><td class="nm">${h.name}</td><td>${yardsOf(h)}</td><td>${h.par}</td><td class="${d < 0 ? 'u' : d > 0 ? 'o' : ''}">${s ?? '—'}</td></tr>`; }).join('');
  const played = state.scores.filter(s => s != null), parPlayed = HOLES.filter((h, i) => state.scores[i] != null).reduce((a, h) => a + h.par, 0);
  const tot = played.reduce((a, b) => a + b, 0), rel = tot - parPlayed;
  $('scTable').innerHTML = `<thead><tr><th>Hole</th><th></th><th>Yds</th><th>Par</th><th>Score</th></tr></thead><tbody>${rows}<tr><td></td><td class="nm">Total</td><td>${HOLES.reduce((a, h) => a + yardsOf(h), 0)}</td><td>${HOLES.reduce((a, h) => a + h.par, 0)}</td><td class="${rel < 0 ? 'u' : rel > 0 ? 'o' : ''}">${played.length ? tot + ` (${rel === 0 ? 'E' : rel > 0 ? '+' + rel : rel})` : '—'}</td></tr></tbody>`;
  const last = state.holeIdx === HOLES.length - 1 && afterHole;
  const set = TEE_SETS.find(t => t.id === cond.tee);
  $('cardSub').textContent = (afterHole ? `Hole ${state.holeIdx + 1} complete` : 'Scorecard') + (TEE_SETS.length > 1 ? ` · ${set.name} tees` : '');
  $('cardTitle').textContent = last ? 'Round complete' : COURSE.name;
  $('cardNext').textContent = last ? 'Play again' : 'Next hole';
  $('cardNext').hidden = !afterHole;
  $('card').hidden = false;
}
$('cardNext').onclick = () => { $('card').hidden = true; if (state.holeIdx === HOLES.length - 1) { state.scores = []; openSetup(); } else startHole(state.holeIdx + 1); };
$('cardClose').onclick = () => { $('card').hidden = true; };
$('btnCard').onclick = () => showCard(false);

function startHole(i) {
  state.holeIdx = i; state.strokes = 0; state.rimDrop = null; state.tracks = []; state.previewAim = null;
  oldTracers.forEach(o => { scene.remove(o); o.geometry.dispose(); o.material.dispose(); }); oldTracers.length = 0;
  tracerCore.visible = tracerGlow.visible = false;
  buildHole(HOLES[i]);
  carryCache.clear(); HOLE.playsLike = playsLike(HOLE);
  state.ball.set(HOLE.tee[0], groundAt(HOLE.tee[0], HOLE.tee[1]), HOLE.tee[1]); state.lie = 'tee';
  placeBall();
  const pl = HOLE.playsLike, y = yardsOf(HOLE);
  $('iMeta').textContent = `Hole ${i + 1} · Par ${HOLE.par} · ${y} yd` + (Math.abs(pl.yards - y) >= 4 ? ` · plays ${pl.yards}` : '') + (Math.abs(pl.dy) > 6 ? ` · ${pl.dy > 0 ? '↑' : '↓'}${Math.round(Math.abs(pl.dy))} m` : '');
  $('iName').textContent = HOLE.name; $('iText').textContent = HOLE.blurb;
  state.phase = 'intro'; state.flyT = 0; setupFlyover();
  setPhaseUI();
  showReadout({ landed: false, carry: 0, total: 0, outcome: 'void', offline: 0, apexFt: 0 }, { Speed: 0, VLA: 0, TotalSpin: 0, SpinAxis: 0 }, '—');
  ['vCarry', 'vTotal', 'vOff', 'vApex', 'vSpd', 'vVla', 'vSpin', 'vAxis'].forEach(id => $(id).innerHTML = '—');
}
function endIntro() { if (state.phase !== 'intro') return; state.phase = 'address'; camState.cut = true; nextLie(); }
$('skip').onclick = endIntro;

/* ===================== cameras ===================== */
const camState = { pos: new THREE.Vector3(0, 30, 60), look: new THREE.Vector3(0, 0, -200), fov: 50, cut: true, landCut: false, landAt: null, landDir: null };
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let fly = null;
function setupFlyover() {
  const t0 = new THREE.Vector3(HOLE.tee[0], groundAt(HOLE.tee[0], HOLE.tee[1]) ?? 0, HOLE.tee[1]), p = HOLE.pinPos, d = p.clone().sub(t0).setY(0), L = d.length(); d.normalize();
  const side = new THREE.Vector3(-d.z, 0, d.x);
  const mid = t0.clone().lerp(p, 0.5);
  fly = {
    pts: [t0.clone().addScaledVector(d, -55).add(new THREE.Vector3(0, 32, 0)).addScaledVector(side, -20),
          mid.clone().addScaledVector(side, -L * 0.35).add(new THREE.Vector3(0, 70 + L * 0.08, 0)),
          p.clone().addScaledVector(d, 50).addScaledVector(side, 35).add(new THREE.Vector3(0, 28, 0))],
    looks: [t0.clone().addScaledVector(d, L * 0.45).setY(t0.y + (p.y - t0.y) * 0.45 - 10), mid.clone().setY(mid.y - 20), p.clone().setY(p.y - 2)],
    dur: Math.min(9, 5.5 + L / 160),
  };
  fly.curve = new THREE.CatmullRomCurve3(fly.pts); fly.lookCurve = new THREE.CatmullRomCurve3(fly.looks);
}
function hfovToV(h) { return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(h) / 2) / camera.aspect)); }
const baseFov = v => Math.max(v, Math.min(80, hfovToV(64)));
function setCam(m) { state.cam = m; camState.cut = true; document.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === m))); }
function holeBounds() {
  const b = new THREE.Box3();
  if (HOLE.line) { for (const p of [...Object.values(HOLE.tees), [HOLE.pinPos.x, HOLE.pinPos.z]]) b.expandByPoint(tmp.set(p[0] - 45, groundAt(p[0], p[1]) ?? 0, p[1] - 20)).expandByPoint(tmp.set(p[0] + 45, groundAt(p[0], p[1]) ?? 0, p[1] + 20)); return b; }
  for (const I of ISL) b.expandByPoint(tmp.set(I.x - I.rx, I.top, I.z - I.rz)).expandByPoint(tmp.set(I.x + I.rx, I.top, I.z + I.rz));
  return b;
}
function camTarget(dt) {
  if (window.__pose) { const p = window.__pose; return { pos: new THREE.Vector3(...p.pos), look: new THREE.Vector3(...p.look), fov: p.fov || 50, k: 3, hard: true }; } // screenshot hook
  const ph = state.phase, bp = ball.position;
  const yawDir = dirFromYaw(state.camYaw); // the way you're facing (the aim line can swing off it)
  let pos, look, fov = 50, k = 3, hard = false;
  if (ph === 'setup' && fly) {
    state.flyT += dt;
    const e = 0.08 + 0.08 * (1 - Math.cos(state.flyT * 0.05)) ;
    return { pos: fly.curve.getPoint(e), look: fly.lookCurve.getPoint(Math.min(1, e + 0.25)), fov: 52, k, hard: true };
  }
  if (ph === 'intro' && fly) {
    state.flyT += dt;
    const u = Math.min(1, state.flyT / fly.dur), e = u * u * (3 - 2 * u);
    pos = fly.curve.getPoint(e); look = fly.lookCurve.getPoint(Math.min(1, e * 1.05)); fov = 52; hard = true;
    if (u >= 1) endIntro();
    return { pos, look, fov, k, hard };
  }
  if (state.cam === 'map' && ph !== 'flight') {
    const b = holeBounds(), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    const span = Math.max(sz.z, sz.x / Math.max(0.5, camera.aspect)) * (camera.aspect < 1 ? 1.05 : 0.88) + 40;
    const sh = span * (camera.aspect < 1 ? 0.3 : 0.14); // lift the hole above the dock
    pos = new THREE.Vector3(c.x, c.y + span * 1.35, c.z + span * 0.32 + sh); look = new THREE.Vector3(c.x, c.y - 8, c.z - span * 0.03 + sh);
    return { pos, look, fov: 46, k: 2.5 };
  }
  if (ph === 'flight' || ph === 'rest') {
    const f = state.flight, r = f.r;
    const landT = f.W[r.landIdx].t;
    if (state.cam === 'chase' || state.cam === 'map') {
      const v = tmp2.copy(bp).sub(camState.prevBall || bp).setY(0);
      const dir = v.lengthSq() > 1e-4 ? v.normalize() : yawDir;
      pos = bp.clone().addScaledVector(dir, -15).add(tmp.set(0, 5 + Math.max(0, bp.y - (groundAt(bp.x, bp.z) ?? bp.y)) * 0.1, 0));
      look = bp.clone().addScaledVector(dir, 12); fov = 50; k = 3;
      return { pos, look, fov, k };
    }
    const landing = state.t > Math.max(r.apexT, landT * 0.6) || ph === 'rest';
    if (landing && r.outcome !== 'void' && camState.landAt) {
      if (!camState.landCut) { camState.landCut = true; camState.cut = true; }
      const L = camState.landAt, d = camState.landDir, side = new THREE.Vector3(-d.z, 0, d.x);
      // hang in the air short of the landing spot, off to one side, so the cliff and the drop read
      pos = L.clone().addScaledVector(d, -32).addScaledVector(side, (f.r.offline > 0 ? -1 : 1) * 16); pos.y = L.y + 9;
      look = bp.clone().lerp(L, ph === 'rest' ? 0 : 0.35); look.y = Math.max(look.y, L.y + 0.3); fov = 40; k = 4;
      return { pos, look, fov, k };
    }
    // from where you stood, watching it go: the view stays put (it doesn't follow the ball up or down)
    const sv = stanceView(f.from, yawDir, baseFov(STANCE.fov), { groundAt });
    pos = sv.pos; look = sv.look; fov = STANCE.fov; k = 4;
    return { pos, look, fov, k, posHold: true };
  }
  if (ph === 'putt' || ph === 'rolling' || ph === 'holed') {
    const d = HOLE.pinPos.clone().sub(state.ball).setY(0); let L = d.length();
    if (L > 0.3) { d.normalize(); camState.puttDir = d.clone(); } else { d.copy(camState.puttDir || dirFromYaw(state.yaw)); L = 3; }
    // standing behind the putt, reading the line to the hole
    const sv = stanceView(state.ball, d, baseFov(STANCE.fov), { back: 2.2, up: 1.35, ballAt: 0.84, groundAt });
    return { pos: sv.pos, look: sv.look, fov: STANCE.fov, k: 2.5 };
  }
  // address: standing over the ball, looking down the aim line (ball at the bottom centre)
  const sv = stanceView(state.ball, yawDir, baseFov(STANCE.fov), { groundAt });
  camState.addressLook = sv.look.clone();
  return { pos: sv.pos, look: sv.look, fov: STANCE.fov, k: 3 };
}
function updateCamera(dt) {
  const t = camTarget(dt);
  const fov = t.hard ? baseFov(t.fov) : (state.cam === 'map' && state.phase !== 'flight' ? t.fov : baseFov(t.fov));
  if (camState.cut || t.hard) { camState.pos.copy(t.pos); camState.look.copy(t.look); camState.fov = fov; }
  else {
    if (!t.posHold) camState.pos.lerp(t.pos, 1 - Math.exp(-t.k * 0.7 * dt)); else camState.pos.copy(t.pos);
    camState.look.lerp(t.look, 1 - Math.exp(-t.k * dt));
    camState.fov += (fov - camState.fov) * (1 - Math.exp(-t.k * dt));
  }
  camState.cut = false;
  camera.position.copy(camState.pos); camera.lookAt(camState.look);
  if (Math.abs(camera.fov - camState.fov) > 1e-3) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
}
if (!camState.addressLook) camState.addressLook = new THREE.Vector3(0, -10, -100);

/* ---------- tap to aim ---------- */
const ray = new THREE.Raycaster(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (tool.isOpen) { tool.open(false); return; }
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || state.phase !== 'address') return;
  const r = renderer.domElement.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const hits = ray.intersectObjects(holeGroup.children.filter(o => o.userData.island && o.userData.island.playable), false);
  let p = hits.length ? hits[0].point : null;
  if (!p) { const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -state.ball.y); p = ray.ray.intersectPlane(pl, new THREE.Vector3()); }
  if (!p || p.distanceTo(state.ball) < 3) return;
  state.aimCustom = p.clone(); aimAt(p);
});
// drag the dashed aim line left or right (or use the arrow keys); either turns auto-aim off
function nudge(d) { if (state.phase !== 'address') return; if (tool.autoAim) tool.setAutoAim(false); state.yaw += d; updatePreview(); renderPlan(); }
{
  let y0 = 0;
  attachAimDrag(renderer, camera, {
    enabled: () => state.phase === 'address' && state.cam !== 'map',
    start: () => { if (tool.autoAim) tool.setAutoAim(false); y0 = state.yaw; },
    move: d => { state.yaw = y0 + d * Math.PI / 180; updatePreview(); },
    end: () => { updatePreview(); renderPlan(); },
  });
}
$('puttBtn').onclick = putt;
$('readout').addEventListener('click', () => $('readout').classList.toggle('more'));
// portrait nudge (phones only; dismissible)
const portraitPhone = matchMedia('(orientation: portrait) and (pointer: coarse)');
let rotateDismissed = false;
const syncRotate = () => { $('rotate').hidden = rotateDismissed || !portraitPhone.matches; };
portraitPhone.addEventListener?.('change', syncRotate); syncRotate();
$('rotateOk').onclick = () => { rotateDismissed = true; syncRotate(); };
$('sound').onclick = e => { state.sound = !state.sound; e.currentTarget.setAttribute('aria-pressed', String(state.sound)); e.currentTarget.classList.toggle('off', !state.sound); if (audio.ctx) audio.amb.gain.setTargetAtTime(state.sound ? 0.05 : 0, audio.ctx.currentTime, 0.3); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); if (state.phase === 'intro') endIntro(); else if (state.phase === 'putt') putt(); else tool.shoot(false); }
  else if (e.key === 'ArrowLeft') nudge(-0.006); else if (e.key === 'ArrowRight') nudge(0.006);
  else if (/^[1-8]$/.test(e.key) && state.phase === 'address') { tool.setClub(+e.key - 1); applyTool(); }
  else if (e.key === 'm' || e.key === 'M') setCam(state.cam === 'map' ? 'tv' : 'map');
});

/* ===================== frame loop ===================== */
function projectTag(el, v) {
  tmp.copy(v).project(camera);
  if (tmp.z > 1 || tmp.z < -1) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible';
  const px = Math.min(innerWidth - 60, Math.max(60, (tmp.x * 0.5 + 0.5) * innerWidth)), py = Math.max(el.offsetHeight + 54, (-tmp.y * 0.5 + 0.5) * innerHeight - 10);
  el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`;
}
let last = performance.now(), clock = 0;
function step(dt) {
  clock += dt; clockU.value = clock; cloudMats.forEach(m => m.uniforms.uT.value = clock); if (cityClouds) cityClouds.material.uniforms.uT.value = clock;
  camState.prevBall = (camState.prevBall || new THREE.Vector3()).copy(ball.position);
  const f = state.flight;
  if (state.phase === 'flight') {
    state.t += dt;
    const W = f.W; let lo = 0, hi = W.length - 1;
    if (state.t >= W[hi].t) lo = hi; else { while (hi - lo > 1) { const m = (lo + hi) >> 1; if (W[m].t <= state.t) lo = m; else hi = m; } }
    const a = W[lo], b = W[Math.min(lo + 1, W.length - 1)], u = b.t > a.t ? (state.t - a.t) / (b.t - a.t) : 0;
    ball.position.lerpVectors(a.w, b.w, Math.min(1, u)); ball.position.y += BALL_RADIUS;
    const upto = Math.min(lo, f.r.landIdx), arr = f.arr; arr.length = 0;
    for (let i = 0; i <= upto; i += 3) arr.push(W[i].w.x, W[i].w.y, W[i].w.z);
    if (lo <= f.r.landIdx) arr.push(ball.position.x, ball.position.y, ball.position.z);
    setLine(tracerCore, arr); setLine(tracerGlow, arr);
    if (lo >= f.r.landIdx && $('tagLand').hidden && f.r.landed) { $('tagLand').innerHTML = `<b>${Math.round(f.r.carry)}</b> carry`; $('tagLand').hidden = false; camState.landTag = W[f.r.landIdx].w.clone(); tick(140, 0.1, 0.25); }
    if (state.t >= W.at(-1).t) { state.phase = 'rest'; state.restTimer = 0; if (f.r.outcome === 'void') ball.visible = false; }
  } else if (state.phase === 'rest') {
    state.restTimer += dt;
    if (state.restTimer > (f.r.outcome === 'void' ? 0.8 : 2.2)) { $('tagLand').hidden = true; tracerCore.visible = tracerGlow.visible = false; finishShot(); }
  } else if (state.phase === 'rolling') {
    const pa = state.puttAnim; pa.t += dt;
    const u = Math.min(1, pa.t / pa.dur), e = 1 - Math.pow(1 - u, 2.2);
    ball.position.lerpVectors(pa.from, pa.end, e); ball.position.y = (groundAt(ball.position.x, ball.position.z) ?? pa.end.y) + BALL_RADIUS;
    if (u >= 1) {
      state.ball.copy(pa.end);
      if (pa.made) { ball.position.y -= 0.06; tick(300, 0.08, 0.6); holeOut(); }
      else { toast('Missed', `${(pa.end.distanceTo(HOLE.pinPos) / 0.3048).toFixed(1)} ft left`, 1600); startPutting(); }
    }
  }
  // ball footprint, shadow
  const camD = camera.position.distanceTo(ball.position);
  const pxPerM = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camD);
  ball.scale.setScalar(Math.max(1, 1.6 / (BALL_RADIUS * 2 * pxPerM)));
  const gy = groundAt(ball.position.x, ball.position.z);
  if (gy !== null && ball.visible) {
    const hgt = Math.max(0, ball.position.y - gy);
    const sx = ball.position.x - sunDir.x / sunDir.y * hgt, sz = ball.position.z - sunDir.z / sunDir.y * hgt, sgy = groundAt(sx, sz);
    ballShadow.visible = sgy !== null;
    if (sgy !== null) { ballShadow.position.set(sx, sgy + 0.012, sz); const bs = BALL_RADIUS * 3.2 * ball.scale.x * (1 + hgt * 0.02); ballShadow.scale.set(bs, bs, 1); ballShadow.material.opacity = Math.max(0, 0.75 - hgt / 40); }
  } else ballShadow.visible = false;
  // aim marker size stays readable
  if (aimRing.visible) { const s = THREE.MathUtils.clamp(camera.position.distanceTo(aimRing.position) * 0.004, 0.2, 1.4); restDot.scale.setScalar(s * 0.9); }
  if (!$('tagLand').hidden && camState.landTag) projectTag($('tagLand'), camState.landTag);
  // flag
  if (flagMesh) { const p = flagMesh.geometry.attributes.position, b = flagMesh.userData.base; const wf = 0.6 + Math.min(1.6, wind.mph / 8); for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, (Math.sin(x * 9 - clock * 5.5 * wf) * 0.07 * x + Math.sin(x * 4 + clock * 2.3 * wf) * 0.035 * x) / Math.sqrt(wf)); } p.needsUpdate = true; flagMesh.geometry.computeVertexNormals(); }
  // drifting puffs; desert props
  if (holeGroup && !MESA) for (const o of holeGroup.children) if (o.isSprite) o.position.x += o.userData.v * dt;
  if (mesaCtx) { const wv = { ...windVec, mph: wind.mph }; for (const f of mesaCtx.anims) f(dt, clock, wv); }
  if (flagMesh) flagMesh.rotation.y = wind.mph > 0.5 ? Math.atan2(windVec.z, windVec.x) * -1 : 0;
  updateWindHud();
  if (state.phase === 'address' && HOLE && HOLE.pinPos.y - state.ball.y > 7) { const t = $('tagPin'); if (t.hidden) t.hidden = false; t.innerHTML = `⚑ <b>${yd(Math.hypot(HOLE.pinPos.x - state.ball.x, HOLE.pinPos.z - state.ball.z))}</b> · ↑${Math.round(HOLE.pinPos.y - state.ball.y)} m`; projectTag(t, tmp2.copy(HOLE.pinPos).add(tmp.set(0, 2.6, 0))); }
  else if (!$('tagPin').hidden) $('tagPin').hidden = true;
  drawMinimap();
  for (const g of oldTracers) g.visible = state.cam === 'map' && g.geometry.attributes.instanceStart && g.geometry.attributes.instanceStart.count > 1;
  updateCamera(dt);
  const focus = tmp.copy(camState.look).lerp(camera.position, 0.4);
  if (state.phase === 'address' || state.phase === 'putt') focus.copy(state.ball).addScaledVector(dirFromYaw(state.yaw), 60);
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 600);
}
/* ---------- a mirror on still water (caves): the scene rendered from below the waterline, only when the view moves ---------- */
const mirrorRT = new THREE.WebGLRenderTarget(512, 256, { encoding: THREE.sRGBEncoding }); // already tone-mapped (r147 tone-maps into targets too), stored sRGB so the darks keep their steps
function makeMirror(mesh) {
  const level = mesh.position.y, cam = new THREE.PerspectiveCamera(), tm = new THREE.Matrix4();
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true, toneMapped: false,
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), { tMirror: { value: mirrorRT.texture }, uTM: { value: tm }, uT: { value: 0 }, uDeep: { value: new THREE.Color(0x0c2228) } }), // not merge(): it clones, which would cut the target and the matrix loose
    vertexShader: `uniform mat4 uTM; varying vec4 vUv4; varying vec3 vW; ${FOG_GLSL_V}
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vUv4 = uTM * w; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D tMirror; uniform float uT; uniform vec3 uDeep; varying vec4 vUv4; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 rip = vec2(sin(vW.x*0.9 + uT*1.3) + sin(vW.z*1.3 - uT*0.9), cos(vW.z*0.8 + uT*1.1) + sin(vW.x*1.7 + uT*0.7)) * 0.0025;  // drips and slow ripples
        vec4 uv = vUv4; uv.xy += rip * uv.w;
        vec3 refl = texture2DProj(tMirror, uv).rgb;
        float fres = 0.55 + 0.45 * pow(1.0 - clamp(normalize(cameraPosition - vW).y, 0.0, 1.0), 3.0);
        gl_FragColor = vec4(mix(uDeep, refl, fres), 0.96);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }` });
  mesh.material = mat; mesh.receiveShadow = false;
  return { mesh, level, cam, tm, mat, pos: new THREE.Vector3(1e9, 0, 0), quat: new THREE.Quaternion(), age: 0, clip: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -level)] };
}
function updateMirror(dt) {
  const M = mirror; if (!M) return;
  M.mat.uniforms.uT.value += dt;
  M.age++;
  const moved = M.pos.distanceToSquared(camera.position) > 0.0004 || 1 - Math.abs(M.quat.dot(camera.quaternion)) > 1e-7;
  if (!moved && M.age < 90) return; // a still view keeps its reflection (re-drawn now and then for anything that moves)
  M.age = 0; M.pos.copy(camera.position); M.quat.copy(camera.quaternion);
  // the camera reflected in the water's plane: position, view direction and up all mirrored
  const L = M.level, cp = camera.position, dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  M.cam.fov = camera.fov; M.cam.aspect = camera.aspect; M.cam.near = camera.near; M.cam.far = camera.far; M.cam.updateProjectionMatrix();
  M.cam.position.set(cp.x, 2 * L - cp.y, cp.z); M.cam.up.set(up.x, -up.y, up.z);
  M.cam.lookAt(cp.x + dir.x, 2 * L - (cp.y + dir.y), cp.z + dir.z); M.cam.updateMatrixWorld();
  M.tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(M.cam.projectionMatrix).multiply(M.cam.matrixWorldInverse);
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); if (mirrorRT.width !== Math.round(sz.x / 2)) mirrorRT.setSize(Math.round(sz.x / 2), Math.round(sz.y / 2));
  M.mesh.visible = false; const clip = renderer.clippingPlanes; renderer.clippingPlanes = M.clip;     // nothing under the water in the reflection
  renderer.setRenderTarget(mirrorRT); renderer.render(scene, M.cam); renderer.setRenderTarget(null);
  renderer.clippingPlanes = clip; M.mesh.visible = true;
}
// frames running long (a night course on a phone): draw fewer pixels rather than drop frames (adaptive-res.js)
const adaptRes = window.__lowq ? null : attachAdaptiveRes(renderer, scene, () => resize());
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); if (adaptRes && !document.hidden) adaptRes.tick(now - last); last = now; fitToScreen(); step(dt); updateMirror(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
// test hooks: step the sim; pass everyFrame=N to render every Nth step like real play
window.__advance = (sec, everyFrame) => { for (let i = 0; i < sec * 30; i++) { step(1 / 30); if (everyFrame && i % everyFrame === 0) { updateMirror(1 / 30); renderer.render(scene, camera); } } updateMirror(1 / 30); renderer.render(scene, camera); };
window.__state = state; window.__startHole = i => startHole(i); window.__scene = scene;

function resize() { const w = stage.clientWidth, h = stage.clientHeight; fitW = w; fitH = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); resizeLines(); minimap.resize(); }
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

/* ===================== wind on the hole card ===================== */
function updateWindHud() {
  const el = $('windStat'); if (!el) return;
  if (!HOLE || wind.mph < 0.5) { el.hidden = !HOLE || cond.wind === 'calm'; $('hWind').innerHTML = 'Calm'; return; }
  el.hidden = false;
  const airDeg = (wind.from + 180 - (HOLE.heading ?? 0)) - THREE.MathUtils.radToDeg(state.camYaw);
  $('hWind').innerHTML = `<i class="warrow" style="transform:rotate(${airDeg.toFixed(0)}deg)">↑</i>${Math.round(wind.mph)}<small>mph</small>`;
}

/* ===================== round setup: tees and conditions ===================== */
const TEE_KEY = `vibegolf.course.${CID}.tee`;
// The round in progress is saved after every stroke (round-save.js) and offered back on the setup screen.
const ROUND_KEY = `vibegolf.course.${CID}.round`;
function saveRound(holed = false) {
  if (!HOLE || state.phase === 'setup') return;
  try { localStorage.setItem(ROUND_KEY, JSON.stringify(packRound({ courseId: CID, cond, windRoll, pinPick: state.pinPick, scores: state.scores, holeIdx: state.holeIdx, strokes: state.strokes, ball: [state.ball.x, state.ball.y, state.ball.z], lie: state.lie, holed }))); } catch (e) { /* storage off */ }
}
function clearRound() { try { localStorage.removeItem(ROUND_KEY); } catch (e) { /* storage off */ } }
function savedRound() { try { return readRound(localStorage.getItem(ROUND_KEY), { id: CID, holes: HOLES.length, teeIds: TEE_SETS.map(t => t.id) }); } catch (e) { return null; } }
function resumeRound(r) {
  Object.assign(cond, r.cond); cond.teeChosen = true;
  try { localStorage.setItem(TEE_KEY, cond.tee); } catch (e) { /* storage off */ }
  $('setup').hidden = true; windRoll = r.windRoll; state.scores = r.scores.slice(); state.pinPick = r.pinPick.slice();
  startHole(r.holed ? r.holeIdx + 1 : r.holeIdx); initAudio();
  if (r.holed) return;                       // holed out before leaving: the next hole from its tee
  const g = groundAt(r.ball[0], r.ball[2]);
  state.strokes = r.strokes;
  if (g !== null) { state.ball.set(r.ball[0], g, r.ball[2]); state.lie = r.lie; }   // else the ground has changed: back on the tee, strokes kept
  placeBall(); endIntro();
}
function openSetup() {
  state.phase = 'setup'; state.flyT = 0;
  const sugg = suggestTee(TEE_SETS, recentDrives());
  let saved = null; try { saved = localStorage.getItem(TEE_KEY); } catch (e) { /* storage off */ }
  if (!TEE_SETS.some(t => t.id === cond.tee) || !cond.teeChosen) cond.tee = TEE_SETS.some(t => t.id === saved) ? saved : sugg.id;
  if (!HOLE || state.holeIdx !== 0) { state.holeIdx = 0; buildHole(HOLES[0]); setupFlyover(); }
  for (const m of [aimRing, aimFill, restDot]) m.visible = false; previewArc.visible = false; ball.visible = false;
  $('suTitle').textContent = COURSE.name; $('suBlurb').textContent = COURSE.blurb || '';
  $('suAlt').textContent = COURSE.altFt ? `${COURSE.altFt.toLocaleString()} ft up: the ball carries a little farther here.` : '';
  const teesBox = $('suTees'); teesBox.innerHTML = '';
  $('suTeeRow').hidden = TEE_SETS.length < 2;
  for (const t of TEE_SETS) {
    const b = document.createElement('button'); b.className = 'suTee'; b.setAttribute('aria-pressed', String(cond.tee === t.id));
    b.innerHTML = `<i style="background:${t.color}"></i><b>${t.name}</b><span>${teeYards(HOLES, t.id).toLocaleString()} yd</span>${t.id === sugg.id ? '<em>Suggested</em>' : ''}`;
    b.onclick = () => { cond.tee = t.id; cond.teeChosen = true; openSetup(); };
    teesBox.appendChild(b);
  }
  $('suTeeNote').textContent = sugg.guessed ? 'No drives saved yet, so this is a guess. Hit a few drivers on the range or the course and it will suggest from them.' : `From your recent drives (median ${sugg.median} yd).`;
  const seg = (id, opts, key) => {
    const box = $(id); box.innerHTML = '';
    for (const [k, o] of Object.entries(opts)) { const b = document.createElement('button'); b.textContent = o.label; b.setAttribute('aria-pressed', String(cond[key] === k)); b.onclick = () => { cond[key] = k; openSetup(); }; box.appendChild(b); }
  };
  seg('suTime', TIMES, 'time'); seg('suWind', WINDS, 'wind'); seg('suWeather', WEATHER, 'weather'); seg('suTemp', TEMPS, 'temp');
  const from = $('suFrom'); from.innerHTML = WIND_FROM.map(([v, l]) => `<option value="${v}"${String(cond.windFrom) === String(v) ? ' selected' : ''}>${v === 'random' ? 'Any direction' : 'From the ' + l}</option>`).join('');
  from.disabled = cond.wind === 'calm';
  from.onchange = () => { cond.windFrom = from.value === 'random' ? 'random' : +from.value; };
  applySky(HOLES[0].heading ?? 0);
  setPhaseUI();
  const sv = savedRound(), rb = $('suResume');
  rb.hidden = !sv; if (sv) { rb.textContent = 'Resume · ' + describeRound(sv, HOLES.map(h => h.par)); rb.onclick = () => resumeRound(sv); }
  $('setup').hidden = false;
}
$('suSig').onclick = () => { Object.assign(cond, COURSE.signature); openSetup(); };
$('suGo').onclick = () => {
  try { localStorage.setItem(TEE_KEY, cond.tee); } catch (e) { /* storage off */ }
  $('setup').hidden = true; windRoll = rollWind(cond); state.scores = [];
  state.pinPick = HOLES.map(h => (h.green && h.green.pins && !window.__noVar ? Math.floor(Math.random() * h.green.pins.length) : 0));
  startHole(0); initAudio();
};

/* ===================== boot ===================== */
resize();
$('cName').textContent = COURSE.name;
openSetup();
renderPlan();
requestAnimationFrame(t => { last = t; frame(t); });
