// Woodson Range — driving range mode.
import { simulate, airDensity, DEFAULT_COEF } from '../physics.js';
import { launchMonitor, mountLaunchMonitorUI } from '../launch-monitor.js';

THREE.ColorManagement.legacyMode = false; // hex colours below are sRGB
/* ===================== physics (pure, portable) ===================== */

/* ===================== world definition ===================== */
const CLUBS = [
  // TrackMan PGA Tour averages: ball speed mph, launch deg, spin rpm
  { id: 'DR', name: 'Driver',  Speed: 167, VLA: 10.9, TotalSpin: 2686, tee: true },
  { id: '3W', name: '3 wood',  Speed: 158, VLA: 9.2,  TotalSpin: 3655, tee: true },
  { id: 'HY', name: 'Hybrid',  Speed: 146, VLA: 10.2, TotalSpin: 4437 },
  { id: '5i', name: '5 iron',  Speed: 132, VLA: 12.1, TotalSpin: 5361 },
  { id: '7i', name: '7 iron',  Speed: 120, VLA: 16.3, TotalSpin: 7097 },
  { id: '9i', name: '9 iron',  Speed: 109, VLA: 20.4, TotalSpin: 8647 },
  { id: 'PW', name: 'Pitching wedge', Speed: 102, VLA: 24.2, TotalSpin: 9304 },
  { id: 'SW', name: 'Sand wedge', Speed: 76, VLA: 31, TotalSpin: 9800 },
];
const GREENS = [ // target greens: yards downrange, lateral metres, radius metres, flag colour
  { yd: 60,  x: 9,   r: 7.5,  flag: '#e8483b' },
  { yd: 90,  x: -11, r: 9,    flag: '#f2f2ee' },
  { yd: 120, x: 7,   r: 10,   flag: '#2f6fd8' },
  { yd: 150, x: -9,  r: 11,   flag: '#f5c542' },
  { yd: 175, x: 13,  r: 11.5, flag: '#e8483b' },
  { yd: 200, x: -4,  r: 12.5, flag: '#f2f2ee' },
  { yd: 235, x: 15,  r: 13,   flag: '#2f6fd8' },
  { yd: 270, x: -10, r: 14,   flag: '#f5c542' },
].map(g => ({ ...g, z: -g.yd * 0.9144 }));
const RANGE_END = -335;
const halfW = z => 34 + 0.085 * Math.max(0, -z);

function hash2(i, j) { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.03 + 17, z * 2.03 + 5) * 0.25 + vnoise(x * 4.1 + 3, z * 4.1 + 11) * 0.125 + vnoise(x * 8.3, z * 8.3 + 7) * 0.0625; }
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function outside(x, z) {
  const side = Math.max(Math.abs(x) - (halfW(z) + 34), 0);
  const back = Math.max(RANGE_END - 20 - z, 0);
  const front = Math.max(z - 45, 0);
  return Math.hypot(side, back, front);
}
function groundAt(x, z) {
  const out = outside(x, z);
  let h = (fbm(x / 38 + 40, z / 38) - 0.47) * 1.6 * sstep(-45, -95, z);   // gentle mounds in the landing area
  const k = sstep(0, 80, out);
  if (k > 0) h += k * (out * 0.11 + 9 * fbm(x / 85, z / 85 + 9) - 2.5);      // hills that wrap the range
  if (out > 260) h += sstep(260, 1100, out) * 150 * fbm(x / 420 + 3, z / 420 + 7);
  h += 190 * Math.exp(-((x + 380) ** 2 + (z + 2100) ** 2) / (2 * 280 * 280)); // the big granite dome on the horizon
  for (const g of GREENS) {
    const d = Math.hypot(x - g.x, z - g.z);
    if (d < g.r + 12) { const w = sstep(g.r + 12, g.r + 1.5, d); h = h * (1 - w) + w * (0.32 + 0.012 * (z - g.z)); }
  }
  return h;
}
function surfaceAt(x, z) {
  for (const g of GREENS) if (Math.hypot(x - g.x, z - g.z) < g.r) return 'green';
  return (Math.abs(x) < halfW(z) && z < 10 && z > RANGE_END) ? 'fairway' : 'rough';
}

/* ===================== renderer / scene ===================== */
const coarse = matchMedia('(pointer: coarse)').matches || !!window.__lowq;
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 2 : 1.75));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 9000);
const fog = new THREE.Fog(0xb9c7cf, 350, 3400);
scene.fog = fog;

const sky = new THREE.Sky();
sky.scale.setScalar(8000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 5.5; skyU.rayleigh.value = 1.4; skyU.mieCoefficient.value = 0.004; skyU.mieDirectionalG.value = 0.82;

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
const SB = 95;
Object.assign(sun.shadow.camera, { left: -SB, right: SB, top: SB, bottom: -SB, near: 1, far: 900 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a5a32, 0.35);
scene.add(hemi);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envSky = new THREE.Sky(); envSky.scale.setScalar(1000); envScene.add(envSky);
let envRT = null;
const sunDir = new THREE.Vector3();

const SUNS = {
  morning: { elev: 14, az: -70, color: 0xffe2c0, int: 2.0, exp: 0.66, fog: 0xc6d0d4, hemi: 0.4 },
  midday:  { elev: 58, az: 35,  color: 0xfff7ea, int: 2.4, exp: 0.5,  fog: 0xbfcfdb, hemi: 0.45 },
  golden:  { elev: 9,  az: 62,  color: 0xffc58c, int: 2.3, exp: 0.7,  fog: 0xd7c8b4, hemi: 0.3 },
};
function setSun(key) {
  const s = SUNS[key];
  sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - s.elev), THREE.MathUtils.degToRad(s.az));
  skyU.sunPosition.value.copy(sunDir);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = skyU[k].value;
  envSky.material.uniforms.sunPosition.value.copy(sunDir);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  sun.color.set(s.color); sun.intensity = s.int;
  hemi.intensity = s.hemi;
  renderer.toneMappingExposure = s.exp;
  fog.color.set(s.fog);
  state.sunKey = key;
  sunUniform.value.copy(sunDir);
}
const sunUniform = { value: new THREE.Vector3(0, 1, 0) };

/* ---------- ground ---------- */
function buildGround() {
  const N = coarse ? 260 : 340;
  const geo = new THREE.PlaneGeometry(2, 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const mapX = u => 115 * u + 2600 * Math.sign(u) * Math.abs(u) ** 5;
  const mapZ = u => -150 + 210 * u + 2350 * Math.sign(u) * Math.abs(u) ** 5;
  for (let i = 0; i < pos.count; i++) {
    const x = mapX(pos.getX(i)), z = mapZ(pos.getZ(i));
    pos.setXYZ(i, x, groundAt(x, z), z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, envMapIntensity: 0.55 });
  const greenU = { value: GREENS.map(g => new THREE.Vector4(g.x, g.z, g.r, 0)) };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGreens = greenU;
    sh.uniforms.uEnd = { value: RANGE_END };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWN;
uniform vec4 uGreens[${GREENS.length}];
uniform float uEnd;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fb(vec2 p){ return vn(p)*0.5 + vn(p*2.07+3.1)*0.25 + vn(p*4.13+7.7)*0.125 + vn(p*8.4+1.3)*0.0625; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }`)
      .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float fine = mix(fb(p.xz*3.1), 0.5, smoothstep(25.0, 90.0, camD));       // blade-scale grain, fades with distance
float mid = fb(p.xz*0.18);
float big = fb(p.xz*0.025 + 4.0);
// mown fairway with cross-range stripes
float hw = 34.0 + 0.085*max(0.0, -p.z);
float edgeN = (fb(p.xz*0.06)-0.5)*7.0;
float inFair = (1.0 - smoothstep(hw - 1.5 + edgeN, hw + 1.5 + edgeN, abs(p.x))) * smoothstep(uEnd - 6.0, uEnd + 6.0, p.z) * (1.0 - smoothstep(8.0, 14.0, p.z));
float stripe = step(0.5, fract(-p.z / 15.0));
vec3 fairA = lin(vec3(0.38, 0.56, 0.21)), fairB = lin(vec3(0.31, 0.49, 0.17));
vec3 fair = mix(fairB, fairA, stripe) * (0.88 + 0.22*mid) * (0.9 + 0.2*fine);
vec3 rough = mix(lin(vec3(0.24, 0.39, 0.13)), lin(vec3(0.33, 0.42, 0.17)), big) * (0.78 + 0.35*mid) * (0.8 + 0.4*fine);
vec3 col = mix(rough, fair, inFair);
// target greens: putting surface + collar
for (int i = 0; i < ${GREENS.length}; i++) {
  vec4 g = uGreens[i];
  float d = length(p.xz - g.xy);
  float collar = 1.0 - smoothstep(g.z + 0.6, g.z + 2.4, d);
  float putt = 1.0 - smoothstep(g.z - 0.25, g.z + 0.25, d);
  vec3 gc = lin(vec3(0.36, 0.6, 0.22)) * (0.94 + 0.12*vn(p.xz*0.9)) * (0.97 + 0.06*fine);
  vec3 cc = lin(vec3(0.33, 0.54, 0.19)) * (0.92 + 0.16*fine);
  col = mix(col, cc, collar);
  col = mix(col, gc, putt);
}
// dry hills: golden grass, chaparral, granite on the steep faces
float hill = smoothstep(1.2, 9.0, p.y);
vec3 dry = mix(lin(vec3(0.62, 0.53, 0.33)), lin(vec3(0.5, 0.45, 0.27)), mid);
vec3 scrub = lin(vec3(0.25, 0.29, 0.15)) * (0.8 + 0.4*fine);
vec3 hc = mix(dry, scrub, smoothstep(0.42, 0.62, fb(p.xz*0.045 + 9.0)));
float steep = 1.0 - smoothstep(0.62, 0.85, vWN.y);
hc = mix(hc, lin(vec3(0.56, 0.53, 0.48)) * (0.8 + 0.4*mid), steep * smoothstep(0.35, 0.6, fb(p.xz*0.08)));
col = mix(col, hc, hill);
diffuseColor.rgb = col;
`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/* ---------- trees & boulders ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0; return (s >>> 8) / 16777216; }; }
function buildTrees() {
  const R = rng(7);
  const spots = [];
  const tryAdd = (x, z, s) => { if (surfaceAt(x, z) !== 'rough') return; if (Math.abs(x) < halfW(z) + 8 && z > RANGE_END) return; for (const q of spots) if ((q.x - x) ** 2 + (q.z - z) ** 2 < (q.s * 4) ** 2) return; spots.push({ x, z, s }); };
  for (let z = 30; z > RANGE_END - 60; z -= 7) {
    for (const side of [-1, 1]) {
      const base = halfW(z) + 14 + R() * 26;
      tryAdd(side * base, z + R() * 5, 0.8 + R() * 0.7);
      if (R() < 0.6) tryAdd(side * (base + 12 + R() * 30), z + R() * 6, 0.8 + R() * 0.8);
    }
  }
  for (let i = 0; i < 1400; i++) {
    const x = (R() - 0.5) * 900, z = 80 - R() * 820;
    const o = outside(x, z);
    if (o > 6 && o < 340 && fbm(x / 70, z / 70) > 0.5) tryAdd(x, z, 0.7 + R() * 0.8);
  }
  for (let i = 0; i < 60; i++) tryAdd((R() - 0.5) * 2 * (halfW(RANGE_END) + 40), RANGE_END - 18 - R() * 50, 1 + R() * 0.6);

  const blobGeo = new THREE.IcosahedronGeometry(1, 3);
  { const p = blobGeo.attributes.position, nr = blobGeo.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + (hash2(Math.round(v.x * 50), Math.round(v.y * 50 + v.z * 30)) - 0.5) * 0.3; p.setXYZ(i, v.x * n, v.y * n * 0.82, v.z * n); v.normalize(); nr.setXYZ(i, v.x, v.y, v.z); } } // lumpy shape, soft (spherical) normals
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.28, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const blobsPer = 5;
  const canopy = new THREE.InstancedMesh(blobGeo, new THREE.MeshStandardMaterial({ roughness: 0.92, envMapIntensity: 0.5 }), spots.length * blobsPer);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  const greens = [0x3f5a28, 0x4a6230, 0x354f24, 0x56692f, 0x435d2c];
  let k = 0;
  spots.forEach((t, i) => {
    const y = groundAt(t.x, t.z) - 0.3, s = t.s * 4.2, h = 2.2 * t.s + R() * 1.4;
    m.compose(ps.set(t.x, y, t.z), q.identity(), sc.set(t.s * 1.1, h + 1.5, t.s * 1.1)); trunks.setMatrixAt(i, m);
    const base = greens[Math.floor(R() * greens.length)];
    for (let b = 0; b < blobsPer; b++) {
      const a = R() * Math.PI * 2, rr = b === 0 ? 0 : s * (0.35 + R() * 0.35);
      const bs = s * (b === 0 ? 0.85 : 0.5 + R() * 0.3);
      q.setFromEuler(new THREE.Euler(R() * 0.5, R() * 6.28, R() * 0.5));
      m.compose(ps.set(t.x + Math.cos(a) * rr, y + h + bs * 0.55 + (b === 0 ? bs * 0.3 : R() * s * 0.4), t.z + Math.sin(a) * rr), q, sc.set(bs, bs * (0.7 + R() * 0.25), bs));
      canopy.setMatrixAt(k, m);
      c.set(base).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.08, (R() - 0.5) * 0.06); canopy.setColorAt(k, c);
      k++;
    }
  });
  canopy.castShadow = canopy.receiveShadow = true; trunks.castShadow = true;
  scene.add(canopy, trunks);

  // granite boulders on the hillsides
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + (hash2(Math.round(v.x * 40) + 3, Math.round(v.y * 40 - v.z * 25)) - 0.5) * 0.35; p.setXYZ(i, v.x * n, v.y * n * 0.7, v.z * n); } rockGeo.computeVertexNormals(); }
  const rocks = []; const RR = rng(23);
  for (let i = 0; i < 2600 && rocks.length < 420; i++) {
    const x = (RR() - 0.5) * 1100, z = 60 - RR() * 900, o = outside(x, z);
    if (o > 25 && o < 420 && fbm(x / 55 + 5, z / 55) > 0.56) rocks.push({ x, z, s: 0.8 + RR() ** 2 * 4 });
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, envMapIntensity: 0.6 }), rocks.length);
  rocks.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(RR(), RR() * 6.28, RR()));
    m.compose(ps.set(r.x, groundAt(r.x, r.z) + r.s * 0.15, r.z), q, sc.set(r.s * (1 + RR() * 0.5), r.s, r.s)); rockMesh.setMatrixAt(i, m);
    c.setRGB(0.55, 0.52, 0.47).offsetHSL(0, 0, (RR() - 0.5) * 0.12); rockMesh.setColorAt(i, c);
  });
  rockMesh.castShadow = rockMesh.receiveShadow = true;
  scene.add(rockMesh);
}

/* ---------- flags, signs, tee line, range balls ---------- */
const flags = [], signs = [];
function signTexture(text, sub) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = '#163a2c'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = '#f1eee3'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 144);
  g.fillStyle = '#f1eee3'; g.textAlign = 'center';
  g.font = '700 86px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(text, 128, 102);
  g.font = '600 22px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(sub, 128, 136);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function buildProps() {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.014, 0.014, 2.3, 8); poleGeo.translate(0, 1.15, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.9 });
  for (const g of GREENS) {
    const y = groundAt(g.x, g.z);
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(g.x, y, g.z); pole.castShadow = true; scene.add(pole);
    const fg = new THREE.PlaneGeometry(0.62, 0.42, 12, 6); fg.translate(0.31, 0, 0);
    const fm = new THREE.MeshStandardMaterial({ color: g.flag, roughness: 0.75, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(fg, fm); flag.position.set(g.x + 0.014, y + 2.07, g.z); flag.castShadow = true;
    flag.userData.base = Float32Array.from(fg.attributes.position.array); flag.userData.phase = hash2(g.yd, 3) * 6;
    scene.add(flag); flags.push(flag);
    // yardage board beside the green, facing the tee
    const side = g.x >= 0 ? 1 : -1, bx = g.x + side * (g.r + 4.5), bz = g.z + 2;
    const by = groundAt(bx, bz);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.25), new THREE.MeshStandardMaterial({ map: signTexture(String(g.yd), 'YARDS'), roughness: 0.8 }));
    signs.push({ board, text: String(g.yd) });
    board.position.set(bx, by + 1.35, bz); board.rotation.y = Math.atan2(-bx, -bz) + Math.PI; board.castShadow = true; scene.add(board);
    for (const dx of [-0.75, 0.75]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), postMat); post.position.set(bx + Math.cos(board.rotation.y) * dx, by + 0.7, bz - Math.sin(board.rotation.y) * dx); post.castShadow = true; scene.add(post); }
  }
  // hitting line: synthetic turf mats with bays either side
  const matGeo = new THREE.BoxGeometry(1.5, 0.03, 1.5);
  const matMat = new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.95 });
  const myMat = new THREE.MeshStandardMaterial({ color: 0x3c6b31, roughness: 0.95 });
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x51803d, roughness: 0.95 });
  for (let i = -6; i <= 6; i++) {
    const mm = new THREE.Mesh(matGeo, i === 0 ? myMat : matMat); mm.position.set(i * 3.2, 0.015, 0.45); mm.receiveShadow = true; scene.add(mm);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.034, 1.5), stripMat); st.position.set(i * 3.2 + 0.35, 0.016, 0.45); st.receiveShadow = true; scene.add(st);
    if (i !== 0) { // range buckets
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.26, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2b4d7a, roughness: 0.6, side: THREE.DoubleSide }));
      b.position.set(i * 3.2 - 1.1, 0.13, 1.1); b.castShadow = true; scene.add(b);
    }
  }
  const divGeo = new THREE.BoxGeometry(0.06, 0.9, 1.2), divMat = new THREE.MeshStandardMaterial({ color: 0x24302a, roughness: 0.8 });
  for (let i = -6; i <= 5; i++) { if (i === 0 || i === -1) continue; const d = new THREE.Mesh(divGeo, divMat); d.position.set(i * 3.2 + 1.6, 0.45, 1.2); d.castShadow = true; scene.add(d); }

  // range balls scattered across the landing area
  const R = rng(91), balls = [];
  const bands = [[50, 120, 260], [110, 190, 520], [180, 250, 330], [240, 300, 120]];
  for (const [a, b, n] of bands) for (let i = 0; i < n; i++) {
    const z = -(a + (b - a) * R()) * 0.9144, x = (R() + R() + R() - 1.5) * halfW(z) * 0.95;
    balls.push([x, z]);
  }
  const bg = new THREE.IcosahedronGeometry(0.0225, 1);
  const bm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.4 }), balls.length);
  const m = new THREE.Matrix4();
  balls.forEach((b, i) => { m.makeTranslation(b[0], (b[2] ?? groundAt(b[0], b[1])) + 0.02, b[1]); bm.setMatrixAt(i, m); });
  bm.castShadow = true;
  scene.add(bm);
}

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
const tracerColor = club => state.tracer === 'club' ? CLUB_COLORS[club] : state.tracer;
function makeTracer(club) {
  const mk = (w, o) => { const mat = new THREE.LineMaterial({ color: new THREE.Color(tracerColor(club)), linewidth: w, transparent: true, opacity: o, depthWrite: false, toneMapped: false }); const l = new THREE.Line2(new THREE.LineGeometry(), mat); l.frustumCulled = false; l.renderOrder = 2; l.visible = false; scene.add(l); return l; };
  const t = { core: mk(3, 1), glow: mk(10, 0.3), club };
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
    tr.core.material.linewidth = i === 0 ? 3 : 2; tr.glow.material.linewidth = i === 0 ? 10 : 6;
  });
}
function clearTracers() { while (tracers.length) disposeTracer(tracers.pop()); apexDot.visible = false; $('tagApex').hidden = true; }
function recolorTracers() { tracers.forEach(t => { const c = tracerColor(t.club); t.core.material.color.set(c); t.glow.material.color.set(c); }); }
function setTracerPts(t, arr) { if (arr.length < 6) return; t.core.geometry.setPositions(arr); t.glow.geometry.setPositions(arr); t.core.visible = t.glow.visible = true; }
function resizeLines() { const w = renderer.domElement.width, h = renderer.domElement.height; for (const t of tracers) { t.core.material.resolution.set(w, h); t.glow.material.resolution.set(w, h); } }
const apexDot = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
apexDot.visible = false; apexDot.renderOrder = 3; scene.add(apexDot);

/* ===================== state ===================== */
const state = {
  club: 4, shotData: null, variance: true, tempF: 72, altFt: 1430, lift: 1, drag: 1,
  camMode: 'tracer', sunKey: 'golden', tracer: TRACERS[1], tracerKeep: 10, sound: true, pending: null,
  flight: null, t: 0, phase: 'idle', restTimer: 0, shots: [], seq: 0,
};
function loadClub(i) { const c = CLUBS[i]; state.club = i; state.shotData = { Speed: c.Speed, VLA: c.VLA, HLA: 0, TotalSpin: c.TotalSpin, SpinAxis: 0 }; syncSliders(); renderClubs(); placeBallAtAddress(); launchMonitor.setPlayer({ club: c.id }); }

/* ===================== UI ===================== */
const $ = id => document.getElementById(id);
function renderClubs() {
  const wrap = $('clubs');
  if (!wrap.children.length) CLUBS.forEach((c, i) => { const b = document.createElement('button'); b.className = 'club'; b.textContent = c.id; b.title = c.name; b.onclick = () => { if (state.phase === 'idle') loadClub(i); }; wrap.appendChild(b); });
  [...wrap.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.club)));
  $('vClub').textContent = CLUBS[state.club].name;
}
const SL = [
  ['sSpeed', 'oSpeed', v => v.toFixed(1) + ' mph', 'Speed'], ['sVla', 'oVla', v => v.toFixed(1) + '°', 'VLA'],
  ['sHla', 'oHla', v => Math.abs(v).toFixed(1) + '° ' + (v < 0 ? 'L' : v > 0 ? 'R' : ''), 'HLA'],
  ['sSpin', 'oSpin', v => Math.round(v).toLocaleString() + ' rpm', 'TotalSpin'], ['sAxis', 'oAxis', v => Math.abs(v).toFixed(1) + '° ' + (v < 0 ? 'L' : v > 0 ? 'R' : ''), 'SpinAxis'],
];
function syncSliders() { for (const [s, o, f, k] of SL) { $(s).value = state.shotData[k]; $(o).textContent = f(+state.shotData[k]); } }
for (const [s, o, f, k] of SL) $(s).addEventListener('input', e => { state.shotData[k] = +e.target.value; $(o).textContent = f(+e.target.value); });
const envFmt = () => {
  $('oTemp').textContent = state.tempF + '°F'; $('oAlt').textContent = state.altFt.toLocaleString() + ' ft';
  const rho = airDensity(state.tempF, state.altFt); $('oRho').textContent = `Air density ${rho.toFixed(3)} kg/m³, ${((1 - rho / 1.2041) * 100).toFixed(1)}% thinner than sea level at 68°F.`;
  $('oLift').textContent = '×' + state.lift.toFixed(2); $('oDrag').textContent = '×' + state.drag.toFixed(2);
};
for (const [s, k] of [['sTemp', 'tempF'], ['sAlt', 'altFt'], ['sLift', 'lift'], ['sDrag', 'drag']]) { $(s).value = state[k]; $(s).addEventListener('input', e => { state[k] = +e.target.value; envFmt(); }); }
$('sVar').addEventListener('change', e => state.variance = e.target.checked);
$('btnReset').onclick = () => loadClub(state.club);
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => setCam(b.dataset.cam));
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
  $(other).hidden = true; $('btn' + other[0].toUpperCase() + other.slice(1)).setAttribute('aria-expanded', 'false');
  p.hidden = !open; $('btn' + id[0].toUpperCase() + id.slice(1)).setAttribute('aria-expanded', String(open));
  if (open && id === 'session') drawSession();
}
$('btnAdjust').onclick = () => togglePanel('adjust');
$('btnSession').onclick = () => togglePanel('session');
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => togglePanel(b.dataset.close));
$('hit').onclick = () => swing();
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space' || e.key === 'h' || e.key === 'H') { e.preventDefault(); swing(); }
  else if (/^[1-8]$/.test(e.key) && state.phase === 'idle') loadClub(+e.key - 1);
  else if (e.key === 'c' || e.key === 'C') { const order = ['tracer', 'auto', 'follow', 'top']; setCam(order[(order.indexOf(state.camMode) + 1) % order.length]); }
  else if (e.key === 'x' || e.key === 'X') clearTracers();
});
let toastT = 0; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

const yd = v => Math.round(v);
function lr(v, unit = '') { const a = Math.abs(v); if (a < 0.5) return '0' + unit; return `${a.toFixed(a < 10 ? 1 : 0)}${unit} <span class="${v < 0 ? 'L' : 'R'}">${v < 0 ? 'L' : 'R'}</span>`; }
function showReadout(r, shot, partial) {
  $('vCarry').innerHTML = (partial ? '—' : yd(r.carry)) + '<small>yd</small>';
  $('vSrc').textContent = state.flight && state.flight.live ? 'R10' : 'Sim';
  $('vTotal').innerHTML = partial ? '—' : yd(r.totalDown) + '<small>yd</small>';
  $('vOff').innerHTML = partial ? '—' : lr(r.offline);
  $('vApex').innerHTML = Math.round(r.apexFt) + '<small>ft</small>';
  $('vDesc').innerHTML = r.descent.toFixed(0) + '<small>°</small>';
  $('vHang').innerHTML = r.flightTime.toFixed(1) + '<small>s</small>';
  $('vSpd').innerHTML = shot.Speed.toFixed(1) + '<small>mph</small>';
  $('vVla').innerHTML = shot.VLA.toFixed(1) + '<small>°</small>';
  $('vHla').innerHTML = lr(shot.HLA, '°');
  $('vSpin').innerHTML = Math.round(shot.TotalSpin).toLocaleString() + '<small>rpm</small>';
  $('vAxis').innerHTML = lr(shot.SpinAxis, '°');
}

/* ---------- session panel ---------- */
function drawSession() {
  const cv = $('disp'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const maxYd = Math.max(140, ...state.shots.map(s => s.r.totalDown)) + 25;
  const sx = W / 2, sy = H - 26, k = (H - 50) / maxYd;
  g.font = '500 20px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.textAlign = 'left';
  for (let d = 50; d < maxYd; d += 50) {
    const y = sy - d * k; g.strokeStyle = 'rgba(214,226,205,0.13)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, y); g.lineTo(W - 16, y); g.stroke();
    g.fillStyle = 'rgba(163,181,156,0.85)'; g.fillText(d + ' yd', 18, y - 6);
  }
  g.strokeStyle = 'rgba(245,197,66,0.5)'; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx, 20); g.stroke(); g.setLineDash([]);
  const cols = ['#ff8f6b', '#ffd36e', '#c5e478', '#7fe0b0', '#7fd3ff', '#9fa8ff', '#e09cff', '#ff9cc8'];
  state.shots.forEach((s, i) => {
    const last = i === state.shots.length - 1;
    const x = sx + s.r.offline * k * 1.6, y = sy - s.r.totalDown * k;
    const lx = sx + s.r.carryOffline * k * 1.6, ly = sy - s.r.carry * k;
    g.strokeStyle = 'rgba(241,238,227,0.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, ly); g.lineTo(x, y); g.stroke();
    g.fillStyle = cols[s.club]; g.globalAlpha = last ? 1 : 0.75; g.beginPath(); g.arc(x, y, last ? 9 : 6, 0, 7); g.fill(); g.globalAlpha = 1;
    if (last) { g.strokeStyle = '#f1eee3'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 13, 0, 7); g.stroke(); }
  });
  g.fillStyle = 'rgba(163,181,156,0.85)'; g.textAlign = 'right'; g.fillText('lateral ×1.6', W - 18, H - 6);
  // gapping
  const by = {};
  state.shots.forEach(s => { (by[s.club] ||= []).push(s.r); });
  const keys = Object.keys(by).map(Number).sort((a, b) => a - b);
  $('gapping').innerHTML = keys.length ? `<table class="gap"><thead><tr><th>Club</th><th>Shots</th><th>Carry</th><th>Total</th><th>Spread</th></tr></thead><tbody>${keys.map(c => { const a = by[c], m = f => a.reduce((s, r) => s + f(r), 0) / a.length; const off = a.map(r => r.offline); const spread = a.length > 1 ? Math.max(...off) - Math.min(...off) : 0; return `<tr><td>${CLUBS[c].id}</td><td>${a.length}</td><td>${yd(m(r => r.carry))}</td><td>${yd(m(r => r.totalDown))}</td><td>${a.length > 1 ? yd(spread) : '—'}</td></tr>`; }).join('')}</tbody></table>` : '<p class="empty">Hit a few shots to build your gapping.</p>';
  $('shotList').innerHTML = state.shots.length ? state.shots.slice().reverse().slice(0, 30).map(s => `<div class="shot"><span class="n">#${s.n}</span><span class="c">${CLUBS[s.club].id}</span><span>${yd(s.r.carry)} <span class="n">carry</span></span><span>${yd(s.r.totalDown)}</span><span>${lr(s.r.offline)}</span></div>`).join('') : '';
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
function realSwing(base) {
  if (!state.variance) return { ...base };
  const s = { ...base };
  const strike = Math.random();
  const face = gauss() * 1.9, path = gauss() * 2.4;
  s.HLA = base.HLA + face * 0.8 + path * 0.2;
  s.SpinAxis = base.SpinAxis + (face - path) * 1.9 + gauss() * 1.5;
  s.Speed = base.Speed * (1 + gauss() * 0.012);
  s.VLA = base.VLA + gauss() * 0.9;
  s.TotalSpin = base.TotalSpin * (1 + gauss() * 0.07);
  if (strike < 0.08) { s.Speed *= 0.93; s.VLA -= 2.5; s.TotalSpin *= 0.78; }          // thin
  else if (strike < 0.13) { s.Speed *= 0.9; s.VLA += 2; s.TotalSpin *= 1.15; }       // heavy
  return s;
}
function placeBallAtAddress() {
  const tee = CLUBS[state.club].tee;
  teePeg.visible = tee;
  teePeg.position.set(0, 0.03 + 0.025 * (tee ? 1 : 0), 0);
  ball.position.set(0, (tee ? 0.045 : 0.03) + BALL_RADIUS, 0);
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
window.WoodsonRange = { receiveShot: msg => { const b = msg.BallData || msg; if (b.Speed > 0) receiveShot({ Speed: +b.Speed, VLA: +b.VLA, HLA: +(b.HLA || 0), TotalSpin: +b.TotalSpin, SpinAxis: +(b.SpinAxis || 0) }); } };

function swing() { if (state.phase !== 'idle') return; initAudio(); launch(realSwing(state.shotData), false); }

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
  $('hit').disabled = true;
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
  state.shots.push({ n: state.seq, club: state.club, r, shot: f.shot });
  showReadout(r, f.shot, false);
  const end = r.pts.at(-1).p;
  restDisc.position.set(end[0], end[1] + 0.03, end[2]); restDisc.visible = true;
  $('tagRest').innerHTML = `<b>${yd(r.totalDown)}</b> total`; $('tagRest').hidden = false;
  if (!$('session').hidden) drawSession();
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
const ADDRESS = { pos: new THREE.Vector3(0, 1.0, 4.2), look: new THREE.Vector3(0, -9.5, -150), fov: 40 };
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function hfovToV(hdeg) { const a = camera.aspect; return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hdeg) / 2) / a)); }
function baseFov(v) { // keep at least ~62° horizontal on portrait screens
  return Math.max(v, Math.min(78, hfovToV(62)));
}
function cameraTarget(dt) {
  const f = state.flight, mode = state.camMode, bp = ball.position;
  let pos = ADDRESS.pos.clone(), look = ADDRESS.look.clone(), fov = ADDRESS.fov, k = 2.2;
  const flying = state.phase === 'flight' || state.phase === 'rest';
  if (mode === 'tracer') {
    // fixed, high behind the bay: the whole flight stays in frame and the tracers stack up
    pos.set(0, 2.6, 14); look.set(0, 5, -150); fov = 40; k = 3;
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
  step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
window.__advance = (sec) => { for (let i = 0; i < sec * 30; i++) step(1 / 30); renderer.render(scene, camera); }; // test hook
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
        state.phase = 'idle'; $('hit').disabled = false; placeBallAtAddress();
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
  updateCamera(dt);
  // shadow box follows what the camera is looking at
  const focus = state.phase === 'idle' && state.camMode !== 'top' ? tmp.set(0, 0, -50) : tmp.copy(camState.look).lerp(camera.position, 0.35);
  focus.y = 0;
  sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 450);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); resizeLines();
  ADDRESS.pos.set(0, 1.0, 4.2);
}
addEventListener('resize', resize);

/* ===================== boot ===================== */
buildGround(); buildTrees(); buildProps();
setSun('golden');
resize();
envFmt(); renderClubs(); loadClub(4);
camState.pos.copy(ADDRESS.pos); camState.look.copy(ADDRESS.look); camState.fov = baseFov(ADDRESS.fov);
requestAnimationFrame(t => { last = t; frame(t); });
// opening shot so the range lands on something live
if (!window.__lowq) setTimeout(() => { if (state.phase === 'idle') launch(realSwing(state.shotData), false); }, 900);
document.fonts && document.fonts.ready.then(() => { for (const sg of signs) { sg.board.material.map.dispose(); sg.board.material.map = signTexture(sg.text, 'YARDS'); sg.board.material.needsUpdate = true; } });
