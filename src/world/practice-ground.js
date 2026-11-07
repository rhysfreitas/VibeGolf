// The Practice Ground: a floodlit tour campus at blue hour, with a city skyline glowing past
// the range. One campus holds every practice mode, each at its own station:
//   'tee'   the main tee line (Range, Bag Mapping)          ball at (0, 0)
//   'lab'   the Swing Lab, a glass studio at the right end   ball at (64, -0.4)
//   'short' the short-game tee behind the lit hedge          ball at (-80, -92)
// The world is built in campus coordinates; setStation() slides it so the active station's ball sits at the
// origin, so the range code (ball at the origin, aiming down -z) works unchanged at every station.
// The range page's world: renderer, scene, camera, sun, sunDir, setSun, groundAt, surfaceAt, flags, signs.
import { fbm, rng, sstep, GLSL_NOISE } from './stage.js';

const YD = 0.9144;
export const STATIONS = { tee: [0, 0], lab: [64, -0.4], short: [-80, -92] };
const RANGE = { x0: -62, x1: 82, z0: -1, z1: -330 };
const TEE = { x0: -50, x1: 46, z0: 10, z1: -1 };
const LAB = { x0: 60, x1: 68, z0: 6, z1: -5, h: 7.5, hb: 3.6 };
const HEDGE_X = -66;
const SG = { x0: -146, x1: -68, z0: -76, z1: -214 };
const SG_TEE = { x0: -94, x1: -68, z0: -84, z1: -98 };
const tg = (yd, x, r, flag) => ({ yd, x, z: -yd * YD, r, flag });
export const TARGETS = [tg(50, 14, 6, '#e8483b'), tg(75, -16, 7, '#f2f2ee'), tg(100, 10, 8, '#2f6fd8'), tg(125, -12, 9, '#f5c542'),
  tg(150, 16, 10, '#e8483b'), tg(175, -8, 11, '#f2f2ee'), tg(200, 20, 12, '#2f6fd8'), tg(250, -10, 13, '#f5c542')];
const pod = (yd, dx, r) => ({ yd, x: -80 + dx, z: -92 - yd * YD, r, flag: '#e8483b', pod: true });
export const PODS = [pod(30, -8, 4.5), pod(50, 10, 5.5), pod(70, -14, 6.5), pod(90, 6, 7), pod(110, -12, 8)];
const CHIP = { x: -112, z: -100, rx: 13, rz: 10 };
const BUNKERS = [[-124, -94, 4.2, 2.6], [-104, -111, 4.6, 2.4], [-121, -110, 3.4, 2.2]];
const FAIR = { x0: -24, x1: 26, z0: -185 * YD, z1: -330 };
const TOWERS = [[-66, -20], [-66, -150], [-66, -220], [-66, -290], [94, -20], [94, -95], [94, -170], [94, -245],
  [-150, -110], [-150, -185], [-40, 30], [40, 30]];
const SCREEN = { x: 10, z: -338, w: 62, h: 27, y0: 10 };
const GATE = { z: -150 * YD, x: 64 };
const GREENS = [...TARGETS, ...PODS];

export function createPracticeGround(stage, opts = {}) {
  let off = [0, 0];                      // the active station, in campus coordinates
  const ell = (x, z, E) => ((x - E.x) / E.rx) ** 2 + ((z - E.z) / E.rz) ** 2;
  const inBox = (x, z, B) => x > B.x0 && x < B.x1 && z < B.z0 && z > B.z1;
  // campus ground: flat where you play, soft mounds in the landing area, dark berms beyond the lights
  function G(x, z) {
    let h = 0;
    if (inBox(x, z, RANGE)) h += (fbm(x / 38 + 40, z / 38) - 0.47) * 1.3 * sstep(-50, -100, z);
    const side = Math.max(x - (RANGE.x1 + 26), SG.x0 - 14 - x, 0), back = Math.max(RANGE.z1 - 30 - z, 0), front = Math.max(z - 70, 0);
    const o = Math.hypot(side, back, front);
    h += sstep(0, 60, o) * (o * 0.08 + 6 * fbm(x / 70, z / 70 + 9) - 1.5);
    for (const g of GREENS) { const d = Math.hypot(x - g.x, z - g.z); if (d < g.r + 9) { const w = sstep(g.r + 9, g.r + 1.2, d); h = h * (1 - w) + w * 0.25; } }
    return h;
  }
  function S(x, z) {
    for (const g of GREENS) if (Math.hypot(x - g.x, z - g.z) < g.r) return 'green';
    if (ell(x, z, CHIP) < 1) return 'green';
    for (const [bx, bz, rx, rz] of BUNKERS) if (((x - bx) / rx) ** 2 + ((z - bz) / rz) ** 2 < 1) return 'sand';
    if (inBox(x, z, RANGE) || inBox(x, z, TEE) || inBox(x, z, SG) || (x > LAB.x0 && x < LAB.x1 && z < LAB.z0 + 2 && z > LAB.z1)) return 'fairway';
    return 'rough';
  }
  const groundAt = (x, z) => G(x + off[0], z + off[1]);
  const surfaceAt = (x, z) => S(x + off[0], z + off[1]);

  const coarse = matchMedia('(pointer: coarse)').matches || !!window.__lowq;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 2 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 9000);
  scene.fog = new THREE.Fog(0x16243d, 260, 2600);

  /* ---------- blue-hour sky: deep blue overhead, a pale band at the horizon, the city's warm glow ---------- */
  {
    const geo = new THREE.SphereGeometry(7000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vP); float e = d.y;
          vec3 zen = vec3(0.025,0.05,0.13), mid = vec3(0.07,0.14,0.30), hor = vec3(0.30,0.40,0.56);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, e)); c = mix(c, zen, smoothstep(0.14, 0.75, e));
          float city = exp(-pow(atan(d.x, -d.z) / 0.75, 2.0)) * (1.0 - smoothstep(0.0, 0.12, e));
          c += vec3(0.55,0.30,0.16) * city * 0.55;                              // sodium glow over the city
          c += vec3(0.18,0.12,0.10) * (1.0 - smoothstep(0.0, 0.06, e)) * 0.6;    // last warmth on the horizon
          vec3 q = floor(d * 420.0); float s = step(0.9965, h(q)) * smoothstep(0.18, 0.5, e);
          c += vec3(0.8,0.85,1.0) * s * 0.6;
          if (e < 0.0) c = mix(hor * 0.6, vec3(0.03,0.05,0.09), smoothstep(0.0, -0.08, e));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -10; scene.add(sky);
  }

  /* ---------- light: a cool key from the towers (shadows), very little sky light ---------- */
  const sunDir = new THREE.Vector3(-0.32, 0.86, 0.4).normalize();
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x4a6aa8, 0x101a10, 0.32); scene.add(hemi);
  { // a dim, cool environment so glossy things pick up the sky
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.background = new THREE.Color(0x1b2a48);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8a6a50, side: THREE.BackSide }));
    es.add(glow);
    scene.environment = pm.fromScene(es, 0.04).texture;
  }
  function setSun() { /* one look: blue hour */ }

  /* ---------- ground: turf lit in pools under the towers ---------- */
  // where each tower throws its light
  const poolOf = (x, z) => z > 0 ? [x * 0.5, -30] : x < -100 ? [x + 40, z - 8] : x < 0 ? [x + 26, z - 10] : [x - 30, z - 10];
  const POOLS = [ // light pools: x, z, radius, strength
    ...TOWERS.map(([x, z]) => [...poolOf(x, z), x < -100 ? 50 : 50, 0.75]),
    [0, -2, 34, 0.55], [64, 0, 18, 1.1], ...PODS.map(p => [p.x, p.z, p.r + 7, 1.0]), [CHIP.x, CHIP.z, 20, 0.9], [-80, -90, 16, 0.6],
    ...TARGETS.map(t => [t.x, t.z, t.r + 6, 0.55]), [0, -300, 70, 0.6], [SCREEN.x, SCREEN.z + 20, 40, 0.5],
  ];
  const uOff = { value: new THREE.Vector2() };
  function buildGround() {
    const N = coarse ? 260 : 340;
    const geo = new THREE.PlaneGeometry(2, 2, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const mx = u => -30 + 150 * u + 2600 * Math.sign(u) * Math.abs(u) ** 5, mz = u => -140 + 230 * u + 2400 * Math.sign(u) * Math.abs(u) ** 5;
    for (let i = 0; i < pos.count; i++) { const x = mx(pos.getX(i)), z = mz(pos.getZ(i)); pos.setXYZ(i, x, G(x, z), z); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.3 });
    const gU = GREENS.map(g => new THREE.Vector4(g.x, g.z, g.r, 0)).concat([new THREE.Vector4(CHIP.x, CHIP.z, CHIP.rx, CHIP.rz)]);
    const bU = BUNKERS.map(([x, z, rx, rz]) => new THREE.Vector4(x, z, rx, rz));
    const pU = POOLS.map(p => new THREE.Vector4(...p));
    const box = B => new THREE.Vector4(B.x0, B.x1, B.z1, B.z0);
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uOff, uG: { value: gU }, uB: { value: bU }, uP: { value: pU }, uRange: { value: box(RANGE) }, uTee: { value: box(TEE) }, uSG: { value: box(SG) }, uSGT: { value: box(SG_TEE) }, uFair: { value: box(FAIR) }, uLab: { value: new THREE.Vector4(LAB.x0, LAB.x1, LAB.z1, LAB.z0) } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform vec4 uG[${gU.length}]; uniform vec4 uB[${bU.length}]; uniform vec4 uP[${pU.length}];
        uniform vec4 uRange, uTee, uSG, uSGT, uFair, uLab; uniform vec2 uOff;
        ${GLSL_NOISE}
        float inB(vec2 p, vec4 b, float s){ return smoothstep(b.x - s, b.x + s, p.x) * (1.0 - smoothstep(b.y - s, b.y + s, p.x)) * smoothstep(b.z - s, b.z + s, p.y) * (1.0 - smoothstep(b.w - s, b.w + s, p.y)); }`)
        .replace('#include <map_fragment>', `
        vec2 p = vWPos.xz + uOff;
        float camD = length(cameraPosition - vWPos);
        float fine = mix(fb(p*3.1), 0.5, smoothstep(25.0, 90.0, camD));
        float mid = fb(p*0.18);
        vec3 rough = lin(vec3(0.20, 0.30, 0.13)) * (0.8 + 0.35*mid) * (0.85 + 0.3*fine);
        float stripe = step(0.5, fract(-p.y / 13.7));
        vec3 fair = mix(lin(vec3(0.27, 0.47, 0.19)), lin(vec3(0.33, 0.55, 0.22)), stripe) * (0.9 + 0.18*mid) * (0.92 + 0.16*fine);
        float mown = max(max(inB(p, uRange, 1.5), inB(p, uSG, 1.5)), inB(p, uTee, 0.4));
        vec3 col = mix(rough, fair, mown);
        col = mix(col, lin(vec3(0.36, 0.58, 0.24)) * (0.93 + 0.12*fine), inB(p, uFair, 2.5) * 0.35);
        float tee = max(inB(p, uTee, 0.3), inB(p, uSGT, 0.3));
        col = mix(col, lin(vec3(0.34, 0.56, 0.24)) * (0.95 + 0.1*fine), tee);
        for (int i = 0; i < ${gU.length}; i++) {
          vec4 g = uG[i]; float d;
          if (g.w > 0.0) d = (length((p - g.xy) / vec2(g.z, g.w)) - 1.0) * g.z; else d = length(p - g.xy) - g.z;
          col = mix(col, lin(vec3(0.30, 0.52, 0.19)) * (0.92 + 0.16*fine), 1.0 - smoothstep(0.6, 2.4, d));
          col = mix(col, lin(vec3(0.34, 0.60, 0.22)) * (0.95 + 0.1*vn(p*0.9)), 1.0 - smoothstep(-0.25, 0.25, d));
        }
        for (int i = 0; i < ${bU.length}; i++) {
          vec4 b = uB[i]; float d = length((p - b.xy) / b.zw);
          col = mix(col, lin(vec3(0.78, 0.70, 0.52)) * (0.92 + 0.12*fine), 1.0 - smoothstep(0.92, 1.04, d));
        }
        col = mix(col, lin(vec3(0.62, 0.65, 0.67)), inB(p, uLab, 0.05));
        // floodlight pools; dark turf between them
        float L = 0.05;
        for (int i = 0; i < ${pU.length}; i++) { vec4 q = uP[i]; float d = length(p - q.xy) / q.z; L += q.w * exp(-d*d*1.6); }
        col *= clamp(L, 0.0, 1.25);
        diffuseColor.rgb = col;`);
    };
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; root.add(mesh);
  }

  /* ---------- helpers ---------- */
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,210,0.55)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  function glow(x, y, z, size, color = 0xffe2b0, op = 0.9) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); root.add(s); return s;
  }
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o });
  const BASIC = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
  function add(geo, mat, x, y, z, { cast = true, recv = false, ry = 0 } = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; root.add(m); return m; }
  function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return { t, cv }; }
  const FONT = '"Saira Semi Condensed", "Arial Narrow", sans-serif';

  /* ---------- the city skyline, 3 to 4 km past the range ---------- */
  function buildSkyline() {
    const win = canvasTex(64, 64, (g) => {
      g.fillStyle = '#0b1220'; g.fillRect(0, 0, 64, 64);
      const R = rng(5);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const on = R(); if (on < 0.3) continue;
        g.fillStyle = on > 0.93 ? '#d8e8ff' : on > 0.75 ? '#ffe2b0' : '#f0b870'; g.globalAlpha = 0.5 + R() * 0.5;
        g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
      }
    });
    win.t.wrapS = win.t.wrapT = THREE.RepeatWrapping;
    const P = [], U = [], R = rng(11);
    const quad = (a, b, c, d, uw, vh) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(0, 0, uw, 0, uw, vh, 0, 0, uw, vh, 0, vh); };
    let x = -3600;
    while (x < 3600) {
      const w = 60 + R() * 150, core = Math.exp(-(((x - 400) / 1100) ** 2));
      const h = (50 + R() * 110) * (1 + 2.6 * core * (0.5 + R())), z = -3100 - R() * 1100, d = 40 + R() * 60;
      quad([x, -5, z], [x + w, -5, z], [x + w, h, z], [x, h, z], w / 9, h / 7);
      const sx = x < 400 ? x + w : x;                                   // the side facing the middle of the view
      quad([sx, -5, z], [sx, -5, z - d], [sx, h, z - d], [sx, h, z], d / 9, h / 7);
      if (h > 260 && R() < 0.7) { const s = glow(x + w / 2, h + 6, z, 26, 0xff3030, 0.9); s.userData.blink = R() * 6; blinkers.push(s); }
      x += w + (R() - 0.3) * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: win.t, color: 0xd8dde8, fog: false, toneMapped: false }));
    root.add(m);
  }
  const blinkers = [];

  /* ---------- light towers ---------- */
  function buildTowers() {
    const pole = M(0x5d6670, { metalness: 0.6, roughness: 0.4 }), head = M(0x2a2f36, { metalness: 0.5 }), lamp = BASIC(0xfff3da);
    for (const [x, z] of TOWERS) {
      const hgt = x < -100 ? 20 : 26, y = G(x, z);
      add(new THREE.CylinderGeometry(0.25, 0.45, hgt, 10), pole, x, y + hgt / 2, z);
      const [tx, tz] = poolOf(x, z), ry = Math.atan2(tx - x, tz - z);
      const fr = add(new THREE.BoxGeometry(5.2, 2.2, 0.5), head, x, y + hgt + 0.6, z, { ry });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.85), lamp); l.position.set(-1.9 + i * 1.27, -0.5 + j * 1.0, 0.27); fr.add(l);
      }
      const gp = new THREE.Vector3(0, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      glow(x + gp.x, y + hgt + 0.6, z + gp.z, 26, 0xffe9c4, 0.75);
    }
  }

  /* ---------- target greens: flags, glow rings, yardage signs ---------- */
  const flags = [], signs = [], rings = [];
  function signTexture(text, sub, bg = '#0e2236', fg = '#f6c25b') {
    return canvasTex(256, 160, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, 256, 160); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 240, 144);
      g.fillStyle = fg; g.textAlign = 'center'; g.font = `700 86px ${FONT}`; g.fillText(text, 128, 102);
      if (sub) { g.font = `600 22px ${FONT}`; g.fillText(sub, 128, 136); }
    }).t;
  }
  function buildGreens() {
    const poleMat = M(0xf4f1e8, { roughness: 0.5 }), poleGeo = new THREE.CylinderGeometry(0.014, 0.014, 2.3, 8); poleGeo.translate(0, 1.15, 0);
    for (const g of GREENS) {
      const y = G(g.x, g.z);
      add(poleGeo, poleMat, g.x, y, g.z);
      const fg = new THREE.PlaneGeometry(0.62, 0.42, 12, 6); fg.translate(0.31, 0, 0);
      const flag = add(fg, M(g.flag, { roughness: 0.75, side: THREE.DoubleSide, emissive: new THREE.Color(g.flag), emissiveIntensity: 0.25 }), g.x + 0.014, y + 2.07, g.z);
      flag.userData.base = Float32Array.from(fg.attributes.position.array); flag.userData.phase = (g.x * 7 + g.z) % 6;
      flags.push(flag);
      // the glow ring: lights up brighter when a ball lands on the green
      const rg = new THREE.CylinderGeometry(g.r + 1.8, g.r + 1.8, 0.2, 96, 1, true); rg.translate(0, 0.08, 0);
      const col = g.pod ? 0xffb54a : 0x3cff8a;
      const ring = add(rg, BASIC(col, { transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), g.x, y + 0.05, g.z, { cast: false });
      ring.userData = { g, base: 0.3, hit: -10 }; rings.push(ring);
      if (!g.pod) { // a lit yardage sign beside the green, facing the tee
        const side = g.x >= 0 ? 1 : -1, bx = g.x + side * (g.r + 5), bz = g.z + 2, by = G(bx, bz);
        const b = add(new THREE.PlaneGeometry(2.4, 1.5), BASIC(0xffffff, { map: signTexture(String(g.yd), 'YARDS') }), bx, by + 1.5, bz, { ry: Math.atan2(-bx, -bz) + Math.PI });
        signs.push({ board: b, text: String(g.yd) });
      }
    }
    // distance boards along the driving fairway
    for (const yd of [200, 250, 300]) for (const x of [-46, 58]) {
      const z = -yd * YD, y = G(x, z);
      add(new THREE.BoxGeometry(0.18, 3.4, 0.18), M(0x2a2f36), x - 2.6, y + 1.7, z); add(new THREE.BoxGeometry(0.18, 3.4, 0.18), M(0x2a2f36), x + 2.6, y + 1.7, z);
      const b = add(new THREE.PlaneGeometry(7, 4.4), BASIC(0xffffff, { map: signTexture(String(yd), 'YARDS') }), x, y + 4.6, z);
      signs.push({ board: b, text: String(yd) });
      glow(x, y + 4.6, z + 0.5, 14, 0xffd28a, 0.35);
    }
  }

  /* ---------- the big screen ---------- */
  const screen = canvasTex(1024, 470, () => {});
  function drawScreen(cells) {
    const g = screen.cv.getContext('2d'), W = 1024, H = 470;
    g.fillStyle = '#04070d'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#0b1a33'; g.fillRect(14, 14, W - 28, H - 28);
    g.textAlign = 'center';
    g.fillStyle = '#7fb4ff'; g.font = `600 30px ${FONT}`; g.fillText('PRACTICE GROUND  ·  LAST SHOT', W / 2, 62);
    cells.forEach(([k, v, u], i) => {
      const cx = W * (i + 0.5) / cells.length;
      g.fillStyle = '#9cc3ff'; g.font = `600 34px ${FONT}`; g.fillText(k, cx, 150);
      g.fillStyle = '#ffffff'; g.font = `700 112px ${FONT}`; g.fillText(v, cx, 300, W / cells.length - 24);
      g.fillStyle = '#9cc3ff'; g.font = `600 30px ${FONT}`; g.fillText(u, cx, 360);
    });
    g.fillStyle = '#1f6fd8'; g.fillRect(14, H - 40, W - 28, 6);
    screen.t.needsUpdate = true;
  }
  function buildScreen() {
    const { x, z, w, h, y0 } = SCREEN, y = G(x, z);
    for (const dx of [-w / 2 + 6, w / 2 - 6]) add(new THREE.BoxGeometry(1.2, y0, 1.2), M(0x39414b, { metalness: 0.5 }), x + dx, y + y0 / 2, z - 0.8);
    add(new THREE.BoxGeometry(w + 1.6, h + 1.6, 1.0), M(0x14181e, { metalness: 0.4 }), x, y + y0 + h / 2, z - 0.6);
    add(new THREE.PlaneGeometry(w, h), BASIC(0xffffff, { map: screen.t }), x, y + y0 + h / 2, z, { cast: false });
    glow(x, y + y0 + h / 2, z + 4, 110, 0x4f8cff, 0.22);
    drawScreen([['CARRY', '—', 'YD'], ['BALL', '—', 'MPH'], ['LAUNCH', '—', 'DEG'], ['SPIN', '—', 'RPM']]);
  }

  /* ---------- the main tee line: empty bays, a session after hours ---------- */
  function buildTeeLine() {
    const matGeo = new THREE.BoxGeometry(1.6, 0.03, 1.6), matMat = M(0x2c5a2a, { roughness: 0.95 }), stripMat = M(0x4d7f3a, { roughness: 0.95 });
    const divMat = M(0x1d252c, { roughness: 0.6 }), capMat = M(0x3a434c, { roughness: 0.5 });
    for (let i = -15; i <= 14; i++) {
      const x = i * 3.2; if (x > 46) continue;
      add(matGeo, matMat, x, 0.015, 0.45, { cast: false, recv: true });
      add(new THREE.BoxGeometry(0.5, 0.034, 1.6), stripMat, x + 0.35, 0.016, 0.45, { cast: false, recv: true });
      if (i !== 0 && i !== -1) { add(new THREE.BoxGeometry(0.06, 0.8, 1.2), divMat, x - 1.6, 0.4, 2.9); add(new THREE.BoxGeometry(0.08, 0.04, 1.2), capMat, x - 1.6, 0.81, 2.9, { cast: false }); }
    }
    // the Academy behind the tee line (seen from the overview only)
    add(new THREE.BoxGeometry(60, 9, 22), M(0x262c33, { roughness: 0.5 }), 0, 4.5, 35);
    add(new THREE.BoxGeometry(56, 3.2, 0.2), BASIC(0xffd59a), 0, 5.4, 23.9, { cast: false });
  }

  /* ---------- the Swing Lab ---------- */
  const lab = {};
  function buildLab() {
    const { x0, x1, z0, z1, h, hb } = LAB, cx = (x0 + x1) / 2, bx = STATIONS.lab[0], bz = STATIONS.lab[1];
    const frame = M(0xe9edf0, { roughness: 0.35, metalness: 0.2 }), dark = M(0x20262c, { roughness: 0.5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4ec, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
    // floor and grid
    const floorTex = canvasTex(512, 512, (g) => { g.fillStyle = '#5d646b'; g.fillRect(0, 0, 512, 512); g.strokeStyle = 'rgba(220,235,245,0.18)'; g.lineWidth = 2; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); } });
    floorTex.t.wrapS = floorTex.t.wrapT = THREE.RepeatWrapping; floorTex.t.repeat.set((x1 - x0) / 4, (z0 - z1) / 4);
    const fl = add(new THREE.PlaneGeometry(x1 - x0, z0 - z1).rotateX(-Math.PI / 2), M(0xffffff, { map: floorTex.t, roughness: 0.35, metalness: 0.1 }), cx, 0.012, (z0 + z1) / 2, { cast: false, recv: true });
    // target line on the floor, lit
    add(new THREE.PlaneGeometry(0.05, z0 - z1 - 1).rotateX(-Math.PI / 2), BASIC(0x6fd2ff), bx, 0.016, (bz + 1.4 + z1) / 2 - 0.3, { cast: false });
    // the pressure mat: glows warm under each foot (redrawn by the coach later)
    const mat = canvasTex(256, 256, (g) => {
      g.fillStyle = '#0d2230'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#3fa9d6'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 248);
      for (const [fx, fy, s] of [[80, 92, 1.0], [80, 168, 0.8]]) { const gr = g.createRadialGradient(fx, fy, 2, fx, fy, 44 * s); gr.addColorStop(0, 'rgba(255,220,120,1)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.75)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(fx, fy, 30 * s, 46 * s, 0, 0, 7); g.fill(); }
    });
    add(new THREE.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2), BASIC(0xffffff, { map: mat.t }), bx - 0.75, 0.018, bz, { cast: false });
    add(new THREE.BoxGeometry(1.5, 0.03, 1.5), M(0x2f5f2c, { roughness: 0.95 }), bx, 0.02, bz + 0.05, { cast: false, recv: true });
    // the canted roof: 3.6 m at the back, 7.5 m at the open front
    const L = z0 - z1, rise = h - hb, ang = Math.atan2(rise, L), len = Math.hypot(L, rise);
    const roof = add(new THREE.BoxGeometry(x1 - x0 + 0.6, 0.35, len + 0.4), dark, cx, (h + hb) / 2 + 0.18, (z0 + z1) / 2);
    roof.rotation.x = ang;
    const soffit = add(new THREE.PlaneGeometry(x1 - x0 - 0.4, len - 0.4), M(0xdfe5ea, { roughness: 0.6, emissive: new THREE.Color(0x30353a) }), cx, (h + hb) / 2 - 0.02, (z0 + z1) / 2, { cast: false });
    soffit.rotation.x = Math.PI / 2 + ang;
    for (let k = 0; k < 3; k++) { // light strips across the ceiling
      const t = 0.2 + k * 0.3, zz = z0 - L * t, yy = hb + rise * t - 0.06;
      const s = add(new THREE.PlaneGeometry(x1 - x0 - 1.2, 0.22), BASIC(0xf4fbff), cx, yy, zz, { cast: false }); s.rotation.x = Math.PI / 2 + ang;
    }
    // back wall, side glass, the front posts and lip
    add(new THREE.BoxGeometry(x1 - x0, hb, 0.25), M(0x2a3138, { roughness: 0.7 }), cx, hb / 2, z0);
    add(new THREE.PlaneGeometry(x1 - x0 - 1.0, 1.0), BASIC(0xbfe8ff, { transparent: true, opacity: 0.85 }), cx, 2.0, z0 - 0.14, { cast: false });   // a wall of light strips behind you
    for (const x of [x0, x1]) {
      const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), new THREE.Vector2(L, h), new THREE.Vector2(0, hb)]);
      const sg = new THREE.ShapeGeometry(shape); sg.rotateY(Math.PI / 2);
      const side = new THREE.Mesh(sg, glass); side.position.set(x, 0, z0); root.add(side);
      add(new THREE.BoxGeometry(0.36, h, 0.36), frame, x, h / 2, z1);
      for (let k = 1; k < 4; k++) { const zz = z0 - L * k / 4; add(new THREE.BoxGeometry(0.1, hb + rise * k / 4, 0.1), frame, x, (hb + rise * k / 4) / 2, zz); }
    }
    add(new THREE.BoxGeometry(x1 - x0 + 0.36, 0.4, 0.4), frame, cx, h - 0.2, z1);
    // a horseshoe of truss round the sides and back at 3.4 m, open toward the target, with cameras
    const arc = new THREE.CurvePath(); const pts = [];
    for (let a = -30; a <= 210; a += 5) pts.push(new THREE.Vector3(bx + 4.6 * Math.cos(a * Math.PI / 180), 3.4, bz + 4.6 * Math.sin(a * Math.PI / 180)));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.09, 6), M(0x9aa3ab, { metalness: 0.7, roughness: 0.3 }), 0, 0, 0);
    const camMat = M(0x1a1e22, { metalness: 0.5 }), led = BASIC(0x4fe0ff);
    const camAt = (x, y, z, ry) => { const c = add(new THREE.BoxGeometry(0.22, 0.16, 0.3), camMat, x, y, z, { ry }); const l = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), led); l.position.set(0, 0, 0.152); c.add(l); return c; };
    for (const a of [-30, 15, 60, 120, 165, 210]) { const r = a * Math.PI / 180, x = bx + 4.6 * Math.cos(r), z = bz + 4.6 * Math.sin(r); const c = camAt(x, 3.22, z, Math.atan2(bx - x, bz - z)); c.rotation.x = 0.35; add(new THREE.CylinderGeometry(0.02, 0.02, 3.4 + 2), M(0x9aa3ab), x, 3.4 + 1, z, { cast: false }); }
    for (const x of [x0 + 0.3, x1 - 0.3]) for (const y of [1.1, 2.9]) camAt(x, y, z1 + 0.25, Math.atan2(bx - x, bz - z1));
    // monitors on stands (the coach's screen sits where the right-hand one is)
    for (const sx of [-1, 1]) {
      const mx = bx + sx * 3.1, mz = bz - 2.8;
      add(new THREE.CylinderGeometry(0.04, 0.04, 1.2), M(0x8a939b, { metalness: 0.6 }), mx, 0.6, mz);
      add(new THREE.BoxGeometry(0.6, 0.03, 0.4), M(0x22282e), mx, 0.015, mz);
      const tv = add(new THREE.BoxGeometry(1.5, 0.86, 0.06), M(0x111418), mx, 1.62, mz, { ry: sx * -0.45 });
      const sc = canvasTex(256, 148, (g) => { g.fillStyle = '#071425'; g.fillRect(0, 0, 256, 148); g.strokeStyle = '#2f7fd8'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 256; i += 4) g.lineTo(i, 100 - 60 * Math.sin(i / 50) * Math.exp(-i / 300)); g.stroke(); g.fillStyle = '#9cc3ff'; g.font = `600 18px ${FONT}`; g.fillText(sx < 0 ? 'FACE · PATH' : 'P1 → P10', 12, 26); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.78), BASIC(0xffffff, { map: sc.t })); s.position.z = 0.032; tv.add(s);
    }
    const pl = new THREE.PointLight(0xe8f4ff, 1.4, 16, 2); pl.position.set(cx, 4.2, bz - 0.5); root.add(pl);
    glow(cx, 4.5, z1 + 1, 10, 0xd8f0ff, 0.25);
    lab.mat = mat;
  }
  // the coach's target window in the lab's lane: two tall lit poles
  const gate = { poles: [] };
  function buildGate() {
    const poleMat = M(0xdfe8ee, { roughness: 0.4 }), strip = BASIC(0x5fd0ff);
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 9, 10), poleMat); p.position.y = 4.5; p.castShadow = true; g.add(p);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 8.6, 0.26), strip); s.position.set(0, 4.5, 0.12); g.add(s);
      const rb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), BASIC(0x5fd0ff, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); rb.position.set(-sx * 0.8, 8.6, 0); g.add(rb);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x5fd0ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      sp.position.set(0, 9, 0); sp.scale.set(10, 10, 1); g.add(sp);
      root.add(g); gate.poles.push({ g, sx });
    }
    setGate(13);
  }
  function setGate(half, x = GATE.x, z = GATE.z) { for (const { g, sx } of gate.poles) g.position.set(x + sx * half, G(x + sx * half, z), z); }

  /* ---------- the short-game area ---------- */
  function buildShortGame() {
    const hedge = M(0x1f3a20, { roughness: 1 }), up = BASIC(0xffd9a0);
    for (let z = -60; z > -232; z -= 4) { add(new THREE.BoxGeometry(1.4, 1.2, 4.1), hedge, HEDGE_X, 0.6, z - 2, { recv: true }); if (Math.round(z) % 12 === 0) add(new THREE.BoxGeometry(0.2, 0.08, 0.2), up, HEDGE_X + 0.9, 0.04, z - 2, { cast: false }); }
    // lie-station plaques on the tee pad
    const plaque = (txt, x, z) => add(new THREE.PlaneGeometry(0.6, 0.24).rotateX(-1.2), BASIC(0xffffff, { map: signTexture(txt, '', '#0e2236', '#f6c25b') }), x, 0.12, z, { cast: false });
    plaque('FW', -88, -96); plaque('RGH', -86, -96); plaque('SAND', -74, -96); plaque('UP', -72, -96);
    // small pole lights over the pods
    for (const p of PODS) { const x = p.x + (p.x < -80 ? -p.r - 4 : p.r + 4), z = p.z + 3; add(new THREE.CylinderGeometry(0.1, 0.14, 9), M(0x5d6670, { metalness: 0.6 }), x, 4.5, z); add(new THREE.BoxGeometry(0.9, 0.4, 0.5), M(0x2a2f36), x, 9.1, z); glow(x, 9, z, 9, 0xffdcae, 0.7); }
  }

  /* ---------- dark tree lines round the campus ---------- */
  function buildTrees() {
    const R = rng(4), spots = [];
    for (let z = 40; z > -300; z -= 8) { spots.push([RANGE.x1 + 40 + R() * 30, z + R() * 6]); spots.push([SG.x0 - 26 - R() * 30, z + R() * 6]); }
    const geo = new THREE.IcosahedronGeometry(1, 2), mat = M(0x15241a, { roughness: 1 });
    const im = new THREE.InstancedMesh(geo, mat, spots.length * 2), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    spots.forEach(([x, z], i) => { const sc = 2.6 + R() * 2, y = G(x, z); m.compose(p.set(x, y + sc * 1.3, z), q, s.set(sc, sc * 1.25, sc)); im.setMatrixAt(i * 2, m); m.compose(p.set(x + R() * 3, y + sc * 2.2, z + R() * 3), q, s.set(sc * 0.7, sc * 0.9, sc * 0.7)); im.setMatrixAt(i * 2 + 1, m); });
    im.castShadow = true; root.add(im);
  }

  buildGround(); buildSkyline(); buildTowers(); buildGreens(); buildScreen(); buildTeeLine(); buildLab(); buildGate(); buildShortGame(); buildTrees();

  function setStation(id) {
    off = STATIONS[id] || STATIONS.tee;
    root.position.set(-off[0], 0, -off[1]); uOff.value.set(off[0], off[1]);
  }
  setStation(opts.station || 'tee');

  return {
    renderer, scene, camera, sun, sunDir, setSun, groundAt, surfaceAt, flags, signs, coarse, greens: GREENS, halfW: () => 70, RANGE_END: RANGE.z1,
    root, STATIONS, setStation, get station() { return Object.keys(STATIONS).find(k => STATIONS[k] === off) || 'tee'; },
    setGate,
    // the big screen shows your last shot; the green it landed on lights up
    showShot(r, shot) {
      drawScreen([['CARRY', String(Math.round(r.carry)), 'YD'], ['BALL', shot.Speed.toFixed(1), 'MPH'], ['LAUNCH', shot.VLA.toFixed(1) + '°', 'DEG'], ['SPIN', Math.round(shot.TotalSpin).toLocaleString(), 'RPM']]);
      const end = r.pts.at(-1).p, x = end[0] + off[0], z = end[2] + off[1];
      for (const ring of rings) if (Math.hypot(x - ring.userData.g.x, z - ring.userData.g.z) < ring.userData.g.r + 1) ring.userData.hit = performance.now() / 1000;
    },
    tick(clock) {
      const now = performance.now() / 1000;
      for (const rg of rings) { const t = now - rg.userData.hit; rg.material.opacity = rg.userData.base + (t < 4 ? 0.45 * (1 - t / 4) * (0.6 + 0.4 * Math.sin(t * 9)) : 0); }
      for (const b of blinkers) b.material.opacity = Math.sin(clock * 1.6 + b.userData.blink) > 0.6 ? 0.95 : 0.15;
    },
    animate(clock, wind = 1) {
      for (const fl of flags) {
        const p = fl.geometry.attributes.position, b = fl.userData.base, ph = fl.userData.phase;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 9 - clock * 5.5 * wind + ph) * 0.07 * x + Math.sin(x * 4 + clock * 2.3 + ph) * 0.035 * x); }
        p.needsUpdate = true; fl.geometry.computeVertexNormals();
      }
    },
    aimShadows(focus) { sun.target.position.copy(focus).setY(0); sun.position.copy(sun.target.position).addScaledVector(sunDir, 450); },
    refreshSigns() { for (const sg of signs) { sg.board.material.map.dispose(); sg.board.material.map = signTexture(sg.text, 'YARDS'); sg.board.material.needsUpdate = true; } drawScreen([['CARRY', '—', 'YD'], ['BALL', '—', 'MPH'], ['LAUNCH', '—', 'DEG'], ['SPIN', '—', 'RPM']]); },
  };
}
