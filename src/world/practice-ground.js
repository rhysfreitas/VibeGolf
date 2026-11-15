// The Practice Ground: a floodlit tour campus in the dusk afterglow, with a city skyline glowing past the range.
// One campus holds every practice mode, each at its own station:
//   'tee'   the main tee line (Range, Bag Mapping)          ball at (0, 0)
//   'lab'   the Swing Lab, a glass studio at the right end   ball at (64, -0.4)
//   'short' the short-game tee behind the lit hedge          ball at (-80, -92)
// The world is built in campus coordinates; setStation() slides it so the active station's ball sits at the
// origin, so the range code (ball at the origin, aiming down -z) works unchanged at every station.
// The range page's world: renderer, scene, camera, sun, sunDir, setSun, groundAt, surfaceAt, flags, signs.
// Art pass 1 (tools/practice/art-brief.md, Rhys's picks: tour campus, real tour greens, the dusk afterglow, all the
// details): an afterglow sky with lit cloud streaks, the floods' pools on dusk-dim turf, mowing stripes and a grass
// tee with divot strips, target greens with fringes and bunkers, range balls, bay props, LED masts with faint beams
// and moths, layered tree belts, a layered skyline with a lit-crown tower, the ball picker cart and a passing plane.
import { fbm, rng, sstep, GLSL_NOISE } from './stage.js';

const YD = 0.9144;
export const STATIONS = { tee: [0, 0], lab: [64, -0.4], short: [-80, -92] };
const RANGE = { x0: -62, x1: 82, z0: -1, z1: -330 };
const TEE = { x0: -50, x1: 46, z0: 10, z1: -1 };
const GT = { x0: -50, x1: 46, z0: -0.6, z1: -9.5 };          // the grass tee in front of the mats (divot strips)
const LAB = { x0: 60, x1: 68, z0: 6, z1: -5, h: 7.5, hb: 3.6 };
const HEDGE_X = -66;
const SG = { x0: -146, x1: -68, z0: -76, z1: -214 };
const SG_TEE = { x0: -94, x1: -68, z0: -84, z1: -98 };
const tg = (yd, x, r, flag, bk) => ({ yd, x, z: -yd * YD, r, flag, bk });
// target greens; bk: bunkers as [angle° (0 = the tee side, + = right), size]
export const TARGETS = [tg(50, 14, 6, '#e8483b', [[-45, 2.2]]), tg(75, -16, 7, '#f2f2ee', [[50, 2.4]]),
  tg(100, 10, 8, '#2f6fd8', [[-40, 2.6], [95, 2.2]]), tg(125, -12, 9, '#f5c542', [[45, 2.8]]),
  tg(150, 16, 10, '#e8483b', [[-35, 3.0], [100, 2.4]]), tg(175, -8, 11, '#f2f2ee', [[40, 3.1], [-100, 2.4]]),
  tg(200, 20, 12, '#2f6fd8', [[-30, 3.3], [90, 2.8]]), tg(250, -10, 13, '#f5c542', [[-45, 3.6], [40, 3.4]])];
const pod = (yd, dx, r) => ({ yd, x: -80 + dx, z: -92 - yd * YD, r, flag: '#e8483b', pod: true });
export const PODS = [pod(30, -8, 4.5), pod(50, 10, 5.5), pod(70, -14, 6.5), pod(90, 6, 7), pod(110, -12, 8)];
const CHIP = { x: -112, z: -100, rx: 13, rz: 10 };
// bunkers as [x, z, rx, rz]: the short-game area's three, then each target green's
const BUNKERS = [[-124, -94, 4.2, 2.6], [-104, -111, 4.6, 2.4], [-121, -110, 3.4, 2.2]];
for (const t of TARGETS) for (const [a, k] of t.bk) {
  const r = a * Math.PI / 180, side = Math.abs(Math.sin(r)), rx = k * (1.6 - 0.6 * side), rz = k * (1 + 0.6 * side);
  const d = t.r + 1.2 + Math.max(rx, rz) * 0.85;
  BUNKERS.push([t.x + Math.sin(r) * d, t.z + Math.cos(r) * d, rx, rz]);
}
const FAIR = { x0: -24, x1: 26, z0: -185 * YD, z1: -330 };
const TOWERS = [[-66, -20], [-66, -150], [-66, -220], [-66, -290], [94, -20], [94, -95], [94, -170], [94, -245],
  [-150, -110], [-150, -185], [-40, 30], [40, 30]];
const SCREEN = { x: 10, z: -338, w: 62, h: 27, y0: 10 };
const GATE = { z: -150 * YD, x: 64 };
const GREENS = [...TARGETS, ...PODS];
const SUNSET = [-0.24, -1];                     // where the sun went down: ahead and a little left, behind the city

export function createPracticeGround(stage, opts = {}) {
  let off = [0, 0];                      // the active station, in campus coordinates
  const ell = (x, z, E) => ((x - E.x) / E.rx) ** 2 + ((z - E.z) / E.rz) ** 2;
  const inBox = (x, z, B) => x > B.x0 && x < B.x1 && z < B.z0 && z > B.z1;
  // campus ground: flat where you play, soft mounds in the landing area, dark berms beyond the lights
  function G(x, z) {
    let h = 0;
    if (inBox(x, z, RANGE)) h += (fbm(x / 38 + 40, z / 38) - 0.47) * 1.3 * sstep(-50, -100, z);
    const side = Math.max(x - (RANGE.x1 + 26), SG.x0 - 14 - x, 0), back = Math.max(RANGE.z1 - 30 - z, 0) * 0.25, front = Math.max(z - 70, 0);
    const o = Math.hypot(side, back, front);
    h += sstep(0, 60, o) * (o * 0.08 + 6 * fbm(x / 70, z / 70 + 9) - 1.5);
    for (const g of GREENS) { const d = Math.hypot(x - g.x, z - g.z); if (d < g.r + 9) { const w = sstep(g.r + 9, g.r + 1.2, d); h = h * (1 - w) + w * 0.25; } }
    for (let i = 3; i < BUNKERS.length; i++) { const [bx, bz, rx, rz] = BUNKERS[i], e = ((x - bx) / rx) ** 2 + ((z - bz) / rz) ** 2; if (e < 1.3) h -= 0.32 * sstep(1.3, 0.55, e); }
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
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 9000);
  scene.fog = new THREE.Fog(0x4c4a66, 300, 2800);
  const uTime = { value: 0 }, uPx = { value: 400 };

  /* ---------- the afterglow: indigo overhead, a pink-orange band where the sun went down, the earth's shadow behind ---------- */
  {
    const geo = new THREE.SphereGeometry(7000, 64, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSet: { value: new THREE.Vector2(...SUNSET).normalize() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec2 uSet;
        ${GLSL_NOISE}
        void main(){
          vec3 d = normalize(vP); float e = d.y;
          vec2 hz = normalize(d.xz + 1e-5); float a = dot(hz, uSet);           // 1 toward the sunset, -1 behind
          float az = atan(d.x, -d.z);
          float toward = pow(a * 0.5 + 0.5, 2.2);
          // the blue: indigo at the zenith, softer blue-violet lower down
          vec3 zen = vec3(0.045,0.065,0.19), mid = vec3(0.17,0.19,0.40), low = vec3(0.34,0.33,0.52);
          vec3 c = mix(low, mid, smoothstep(0.02, 0.22, e)); c = mix(c, zen, smoothstep(0.2, 0.85, e));
          // the afterglow band: orange at the horizon, pink, then lavender, strongest toward the sunset
          vec3 glow = mix(vec3(1.0,0.56,0.30), vec3(0.92,0.46,0.48), smoothstep(0.0, 0.07, e));
          glow = mix(glow, vec3(0.52,0.42,0.66), smoothstep(0.06, 0.2, e));
          float band = (1.0 - smoothstep(0.0, 0.26, e)) * (0.25 + 0.75 * toward);
          c = mix(c, glow, band * 0.9);
          // behind: the earth's shadow (blue-grey) under the faint pink belt of Venus
          float behind = pow(max(-a, 0.0), 1.5);
          c = mix(c, vec3(0.20,0.21,0.34), behind * (1.0 - smoothstep(0.0, 0.07, e)) * 0.8);
          c += vec3(0.20,0.10,0.14) * behind * exp(-pow((e - 0.1) / 0.04, 2.0)) * 0.7;
          // thin streaks of cloud low in the glow, lit pink-gold underneath, violet-grey away from it
          float n = fb(vec2(az * 3.2, e * 34.0)) * 0.7 + fb(vec2(az * 9.0 + 4.0, e * 70.0)) * 0.3;
          float cl = smoothstep(0.56, 0.74, n) * smoothstep(0.015, 0.05, e) * (1.0 - smoothstep(0.12, 0.24, e));
          vec3 lit = mix(vec3(0.40,0.30,0.46), vec3(1.0,0.62,0.45), toward);
          c = mix(c, lit * (0.85 + 0.3 * (1.0 - smoothstep(0.03, 0.15, e))), cl * 0.8);
          // the city's glow just above the skyline, the first stars high up away from the glow
          float city = exp(-pow((az + 0.1) / 0.9, 2.0)) * (1.0 - smoothstep(0.0, 0.05, e));
          c += vec3(0.5,0.28,0.14) * city * 0.25;
          vec3 q = floor(d * 380.0); float s = step(0.9975, h21(q.xy + q.z * 17.0)) * smoothstep(0.32, 0.7, e) * (1.0 - toward * 0.8);
          c += vec3(0.8,0.85,1.0) * s * 0.55;
          if (e < 0.0) c = mix(c, vec3(0.10,0.10,0.16), smoothstep(0.0, -0.05, e));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat); sky.renderOrder = -10; scene.add(sky);
  }

  /* ---------- light: the masts behind the tee are the key (shadows fall downrange); the dusk sky fills ---------- */
  const sunDir = new THREE.Vector3(-0.28, 0.74, 0.62).normalize();
  const sun = new THREE.DirectionalLight(0xffeedd, 0.58);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 1, far: 900 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x8e8cc4, 0x1a2414, 0.36); scene.add(hemi);
  { // a dusky environment so glossy things pick up the glow ahead and the blue above
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.background = new THREE.Color(0x2c3058);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0xb07a68, side: THREE.BackSide }));
    glow.position.set(0, -6, -4); es.add(glow);
    scene.environment = pm.fromScene(es, 0.04).texture;
  }
  function setSun() { /* one look: the dusk afterglow */ }

  /* ---------- ground: turf lit in pools under the masts ---------- */
  // where each mast throws its light
  const poolOf = (x, z) => z > 0 ? [x * 0.5, -30] : x < -100 ? [x + 40, z - 8] : x < 0 ? [x + 26, z - 10] : [x - 30, z - 10];
  const POOLS = [ // light pools: x, z, radius, strength
    ...TOWERS.map(([x, z]) => [...poolOf(x, z), z > 0 ? 44 : 50, z > 0 ? 0.55 : 0.75]),
    [0, 1, 26, 0.45], [-26, 1, 22, 0.3], [26, 1, 22, 0.3], [64, 0, 18, 1.1],
    ...PODS.map(p => [p.x, p.z, p.r + 7, 0.95]), [CHIP.x, CHIP.z, 20, 0.9], [-80, -90, 16, 0.6],
    ...TARGETS.map(t => [t.x, t.z, t.r + 7, 0.85]), [0, -300, 70, 0.5], [SCREEN.x, SCREEN.z + 20, 40, 0.5],
  ];
  const uOff = { value: new THREE.Vector2() };
  const cartPool = new THREE.Vector4(0, 0, 1, 0);
  const poolL = (x, z) => { let L = 0.17; for (const [px, pz, r, w] of POOLS) { const d = Math.hypot(x - px, z - pz) / r; L += w * Math.exp(-d * d * 1.6); } return Math.min(L, 1.25); };
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
    const box = B => new THREE.Vector4(B.x0, B.x1, B.z1, B.z0);
    // the static pools baked into a 2 m map over the campus (outside it the turf is dusk-dim); the cart's pool is added live
    const LM = { x0: -230, z0: -480, w: 400, h: 570, n: 2 }, lw = LM.w / LM.n, lh = LM.h / LM.n, ld = new Uint8Array(lw * lh * 4);
    for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) { const k = (j * lw + i) * 4; ld[k] = Math.round(poolL(LM.x0 + (i + 0.5) * LM.n, LM.z0 + (j + 0.5) * LM.n) / 1.25 * 255); ld[k + 3] = 255; }
    const lmap = new THREE.DataTexture(ld, lw, lh, THREE.RGBAFormat); lmap.magFilter = lmap.minFilter = THREE.LinearFilter; lmap.needsUpdate = true;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uLmap: { value: lmap }, uLbox: { value: new THREE.Vector4(LM.x0, LM.z0, LM.w, LM.h) }, uCart: { value: cartPool }, uOff, uG: { value: gU }, uB: { value: bU }, uRange: { value: box(RANGE) }, uTee: { value: box(TEE) }, uGT: { value: box(GT) }, uSG: { value: box(SG) }, uSGT: { value: box(SG_TEE) }, uFair: { value: box(FAIR) }, uLab: { value: new THREE.Vector4(LAB.x0, LAB.x1, LAB.z1, LAB.z0) } });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform vec4 uG[${gU.length}]; uniform vec4 uB[${bU.length}]; uniform sampler2D uLmap; uniform vec4 uLbox, uCart;
        uniform vec4 uRange, uTee, uGT, uSG, uSGT, uFair, uLab; uniform vec2 uOff;
        ${GLSL_NOISE}
        float inB(vec2 p, vec4 b, float s){ return smoothstep(b.x - s, b.x + s, p.x) * (1.0 - smoothstep(b.y - s, b.y + s, p.x)) * smoothstep(b.z - s, b.z + s, p.y) * (1.0 - smoothstep(b.w - s, b.w + s, p.y)); }`)
        .replace('#include <map_fragment>', `
        vec2 p = vWPos.xz + uOff;
        float camD = length(cameraPosition - vWPos);
        float nearF = 1.0 - smoothstep(5.0, 28.0, camD);
        float fine = mix(fb(p*3.1), 0.5, smoothstep(25.0, 90.0, camD));
        float blades = mix(0.5, vn(p*41.0)*0.6 + vn(p*97.0)*0.4, nearF);
        float mid = fb(p*0.18), big = vn(p*0.035);
        vec3 rough = lin(vec3(0.15, 0.24, 0.10)) * (0.72 + 0.42*mid) * (0.85 + 0.3*fine) * (0.82 + 0.36*blades);
        // mowing: stripes across the line every 9 m, a faint diagonal cross-cut, blades and clumps close to
        float st = smoothstep(-0.7, 0.7, sin(p.y * 0.349 + 0.6));
        float cc = smoothstep(-0.4, 0.4, sin((p.x + p.y) * 0.31));
        vec3 fair = mix(lin(vec3(0.23, 0.38, 0.17)), lin(vec3(0.28, 0.45, 0.21)), st*0.62 + cc*0.14) * (0.9 + 0.16*mid + 0.08*big) * (0.92 + 0.16*fine) * (0.84 + 0.32*blades);
        vec2 pw = p + (vec2(vn(p*0.045), vn(p*0.045 + 9.0)) - 0.5) * 9.0;     // the mown edge wanders
        float mown = max(max(inB(pw, uRange, 1.5), inB(pw, uSG, 1.5)), inB(p, uTee, 0.4));
        vec3 col = mix(rough, fair, mown);
        col = mix(col, col * 1.06, inB(p, uFair, 3.0) * 0.6);
        // the picker's tracks: faint darker lanes through the far landing area
        float trk = abs(fract(p.x / 6.5 + 0.12 * sin(p.y * 0.021)) - 0.5);
        col *= 1.0 - 0.06 * (1.0 - smoothstep(0.0, 0.03, trk)) * inB(p, uRange, 2.0) * smoothstep(-70.0, -130.0, p.y);
        // tee boxes, and the grass tee in front of the mats with lines of divots where players hit
        float tee = max(inB(p, uTee, 0.3), inB(p, uSGT, 0.3));
        col = mix(col, lin(vec3(0.27, 0.43, 0.19)) * (0.94 + 0.12*fine) * (0.86 + 0.28*blades), tee);
        float gt = inB(p, uGT, 0.25);
        if (gt > 0.001) {
          col = mix(col, lin(vec3(0.27, 0.43, 0.19)) * (0.93 + 0.12*fine) * (0.86 + 0.28*blades), gt);
          vec2 cs = vec2(0.25, 0.4), id = floor(p / cs), f = fract(p / cs) - 0.5;
          float row = exp(-pow(mod(p.y + 30.0, 2.3) - 1.15, 2.0) * 2.6);
          float has = step(1.0 - (0.03 + 0.3 * row), h21(id));
          vec2 jit = vec2(h21(id + 7.3), h21(id + 3.1)) - 0.5;
          float dv = has * (1.0 - smoothstep(0.6, 1.0, length((f - jit * 0.3) / vec2(0.15, 0.17)))) * 0.8;
          vec3 soil = mix(lin(vec3(0.22, 0.19, 0.12)), lin(vec3(0.46, 0.43, 0.31)), step(0.6, h21(id + 1.7)));
          float farD = smoothstep(6.0, 16.0, camD);
          col = mix(col, soil, dv * gt * (1.0 - farD));
          col = mix(col, col * 0.9 + soil * 0.06, gt * farD * 0.4);
        }
        // target greens: a fringe ring, the putting surface mown in a check; the chipping green
        for (int i = 0; i < ${gU.length}; i++) {
          vec4 g = uG[i]; float d;
          if (g.w > 0.0) d = (length((p - g.xy) / vec2(g.z, g.w)) - 1.0) * g.z; else d = length(p - g.xy) - g.z;
          if (d > 6.0) continue;
          col = mix(col, lin(vec3(0.25, 0.44, 0.19)) * (0.92 + 0.16*fine) * (0.9 + 0.2*blades), 1.0 - smoothstep(0.8, 2.2, d));
          float chk = abs(step(0.5, fract((p.x - g.x) / 3.2)) - step(0.5, fract((p.y - g.y) / 3.2)));
          col = mix(col, mix(lin(vec3(0.29, 0.51, 0.22)), lin(vec3(0.33, 0.56, 0.25)), chk) * (0.95 + 0.1*vn(p*0.9)) * (0.93 + 0.14*blades), 1.0 - smoothstep(-0.2, 0.2, d));
        }
        // bunkers: pale sand with a darker grass lip
        for (int i = 0; i < ${bU.length}; i++) {
          vec4 b = uB[i]; float d = length((p - b.xy) / b.zw);
          if (d > 1.6) continue;
          col *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.18, abs(d - 1.08)));
          col = mix(col, lin(vec3(0.80, 0.72, 0.54)) * (0.9 + 0.12*fine + 0.06*vn(p*7.0)) * (0.92 + 0.1 * smoothstep(0.3, 1.0, d)), 1.0 - smoothstep(0.92, 1.03, d));
        }
        col = mix(col, lin(vec3(0.62, 0.65, 0.67)), inB(p, uLab, 0.05));
        // floodlight pools on dusk-dim turf
        vec2 lu = (p - uLbox.xy) / uLbox.zw;
        float L = (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) ? texture2D(uLmap, lu).r * 1.25 : 0.17;
        float cd = length(p - uCart.xy) / uCart.z; L += uCart.w * exp(-cd*cd*1.6);
        col *= clamp(L, 0.0, 1.25);
        diffuseColor.rgb = col;`);
    };
    const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.userData.keep = true; root.add(mesh);
  }

  /* ---------- helpers ---------- */
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,210,0.55)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  function sprite(x, y, z, size, color = 0xffe2b0, op = 0.9) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(x, y, z); s.scale.setScalar(size); root.add(s); return s;
  }
  // static glows are points in one draw (built at the end): x, y, z, size (m), colour, opacity, blink phase (0 = steady)
  const GLOWS = [];
  const glow = (x, y, z, size, color = 0xffe2b0, op = 0.9, blink = 0) => GLOWS.push([x, y, z, size, new THREE.Color(color), op, blink]);
  const mats = new Map();
  const matKey = (t, c, o) => t + c + Object.entries(o).map(([k, v]) => k + ':' + (v && v.isTexture ? v.uuid : v && v.isColor ? v.getHex() : v)).join(',');
  const M = (c, o = {}) => { const k = matKey('S', c, o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...o })); return mats.get(k); };
  const BASIC = (c, o = {}) => { const k = matKey('B', c, o); if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o })); return mats.get(k); };
  function add(geo, mat, x, y, z, { cast = true, recv = false, ry = 0 } = {}) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = recv; root.add(m); return m; }
  function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return { t, cv }; }
  const FONT = '"Saira Semi Condensed", "Arial Narrow", sans-serif';
  // geometries into one (non-indexed; position, normal, uv), each with its own matrix
  function mergeGeos(list) {
    const P = [], N = [], U = [], C = [], v = new THREE.Vector3(), nm = new THREE.Matrix3();
    let withColor = false;
    for (const it of list) if (it.color) withColor = true;
    for (const { geo, m, color } of list) {
      const g = geo.index ? geo.toNonIndexed() : geo, p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      nm.getNormalMatrix(m);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); P.push(v.x, v.y, v.z);
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); N.push(v.x, v.y, v.z); } else N.push(0, 1, 0);
        U.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
        if (withColor) { const c = color || new THREE.Color(1, 1, 1); C.push(c.r, c.g, c.b); }
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    if (withColor) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    return out;
  }
  const mat4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

  /* ---------- the city skyline: three depths of towers 2.6 to 4.6 km out, one tall tower with a lit crown ---------- */
  const facade = canvasTex(256, 256, (g) => {
    g.fillStyle = '#0c101b'; g.fillRect(0, 0, 256, 256);
    const R = rng(5);
    for (let y = 0; y < 16; y++) {
      const kind = R(), floor = kind < 0.14 ? 'office' : kind < 0.36 ? 'dark' : 'home';
      for (let x = 0; x < 16; x++) {
        let on = R();
        if (floor === 'office') { g.fillStyle = R() < 0.85 ? '#cfe0ff' : '#9fb4d8'; g.globalAlpha = 0.55 + R() * 0.3; }
        else if (floor === 'dark') { if (on > 0.12) continue; g.fillStyle = '#ffd08a'; g.globalAlpha = 0.6; }
        else { if (on < 0.58) continue; g.fillStyle = on > 0.9 ? '#ffe6b8' : on > 0.7 ? '#ffd08a' : '#f0aa62'; g.globalAlpha = 0.5 + R() * 0.5; }
        g.fillRect(x * 16 + 4, y * 16 + 5, 8, 7);
      }
    }
    g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.fillRect(0, 0, 4, 4);       // a white corner for lit bands
  });
  facade.t.wrapS = facade.t.wrapT = THREE.RepeatWrapping;
  function buildSkyline() {
    const P = [], U = [], C = [], R = rng(11);
    const solid = (a, b, c, d, col) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) { U.push(0.006, 0.994); C.push(col, col * 0.95, col * 0.82); } };
    const quad = (a, b, c, d, u0, uw, vh, col) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(u0, 0, u0 + uw, 0, u0 + uw, vh, u0, 0, u0 + uw, vh, u0, vh); for (let i = 0; i < 6; i++) C.push(col * 0.5, col * 0.48, col * 0.55); };
    const tower = (x, w, h, z, d, col) => {
      const u0 = Math.floor(R() * 16) / 16;
      quad([x, -5, z], [x + w, -5, z], [x + w, h, z], [x, h, z], u0, w / 54, h / 56, col);       // 16 windows a tile: 3.4 m bays, 3.5 m floors
      const sx = x + w / 2 < 0 ? x + w : x;                                                       // the side facing the middle of the view
      quad([sx, -5, z], [sx, -5, z - d], [sx, h, z - d], [sx, h, z], u0 + 0.5, d / 54, h / 56, col * 0.7);
      if (h > 250 && R() < 0.75) glow(x + w / 2, h + 5, z, 30, 0xff3030, 0.95, 1 + R() * 6);
      if (h > 180 && R() < 0.35) solid([x, h - 3, z + 0.5], [x + w, h - 3, z + 0.5], [x + w, h, z + 0.5], [x, h, z + 0.5], 1.6);   // a lit crown band
    };
    for (const [z0, zr, hk, dim] of [[-4100, 600, 0.8, 0.55], [-3400, 500, 1.0, 0.78], [-2700, 400, 0.75, 1.0]]) {
      let x = -4200;
      while (x < 4200) {
        const w = 50 + R() * 140, core = Math.exp(-(((x + 250) / 1300) ** 2));
        const h = (50 + R() * 120) * (1 + 3.0 * core * (0.4 + R())) * hk;
        tower(x, w, h, z0 - R() * zr, 30 + R() * 50, dim * (0.85 + R() * 0.3));
        x += w + (R() - 0.25) * 40;
      }
    }
    // the landmark: a slender tower left of the screen from the tee, its crown lit, a beacon on the spire
    const LX = -330, LZ = -3150;
    for (let k = 0; k < 6; k++) { const w0 = 70 - k * 9, y0 = k * 72, y1 = y0 + 72; quad([LX - w0 / 2, y0 - 5, LZ], [LX + w0 / 2, y0 - 5, LZ], [LX + w0 / 2, y1, LZ], [LX - w0 / 2, y1, LZ], 0.25, w0 / 54, 72 / 56, 0.95); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: facade.t, vertexColors: true, fog: false, toneMapped: false }));
    m.userData.keep = true; root.add(m);
    // the crown: a ring of light at the top, a lit lantern under the spire, the spire and its beacon
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(17, 19, 26, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false, toneMapped: false, side: THREE.DoubleSide }));
    crown.position.set(LX, 445, LZ); crown.userData.keep = true; root.add(crown);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 9, 90, 8), new THREE.MeshBasicMaterial({ color: 0x1a2030, fog: false }));
    spire.position.set(LX, 503, LZ); spire.userData.keep = true; root.add(spire);
    glow(LX, 445, LZ + 20, 120, 0xffd9a0, 0.5); glow(LX, 552, LZ, 34, 0xff3030, 0.95, 2.2);
  }

  /* ---------- light masts: slim poles, gridded LED heads aimed at their pools, faint beams, moths ---------- */
  const ledTex = canvasTex(128, 64, (g) => {
    g.fillStyle = '#20252c'; g.fillRect(0, 0, 128, 64);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const x = 6 + i * 20, y = 5 + j * 19, gr = g.createRadialGradient(x + 8, y + 8, 1, x + 8, y + 8, 10);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#fff3d8'); gr.addColorStop(1, '#c9b38a'); g.fillStyle = gr; g.fillRect(x, y, 16, 16);
    }
  });
  const HEADS = [];
  function buildTowers() {
    const pole = M(0x6b7682, { metalness: 0.6, roughness: 0.4 }), frame = M(0x22282f, { metalness: 0.5 }), lamp = BASIC(0xffffff, { map: ledTex.t });
    const beams = [];
    for (const [x, z] of TOWERS) {
      const hgt = x < -100 ? 20 : 26, y = G(x, z), top = y + hgt + 0.6;
      add(new THREE.CylinderGeometry(0.22, 0.42, hgt, 10), pole, x, y + hgt / 2, z);
      add(new THREE.BoxGeometry(5.6, 0.18, 0.18), pole, x, top - 1.5, z, { ry: Math.atan2(...poolOf(x, z).map((v, i) => v - [x, z][i])) });
      const [tx, tz] = poolOf(x, z), ry = Math.atan2(tx - x, tz - z), dist = Math.hypot(tx - x, tz - z), tilt = Math.atan2(hgt, dist);
      const fr = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.2, 0.4), frame); fr.position.set(x, top, z); fr.rotation.set(0, 0, 0); fr.rotation.order = 'YXZ'; fr.rotation.y = ry; fr.rotation.x = tilt * 0.9; fr.castShadow = true; root.add(fr);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.0), lamp); l.position.z = 0.21; fr.add(l);
      const gp = new THREE.Vector3(0, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      glow(x + gp.x, top, z + gp.z, 18, 0xffe9c4, 0.55);
      HEADS.push([x + gp.x, top, z + gp.z]);
      // a faint cone of light from the head to its pool
      const len = Math.hypot(dist, hgt), cg = new THREE.CylinderGeometry(0.9, dist * 0.42, len, 18, 1, true);
      cg.translate(0, -len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(tx - x, -hgt, tz - z).normalize());
      beams.push({ geo: cg, m: new THREE.Matrix4().compose(new THREE.Vector3(x + gp.x, top, z + gp.z), q, new THREE.Vector3(1, 1, 1)) });
    }
    const bm = new THREE.Mesh(mergeGeos(beams), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec2 vUv; varying vec3 vN, vV; void main(){ float edge = pow(abs(dot(vN, vV)), 1.6); float a = 0.085 * pow(vUv.y, 1.6) * edge; gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, 1.0); }',
    }));
    bm.userData.keep = true; bm.renderOrder = 2; root.add(bm);
  }
  // moths: points circling the heads nearest the tee line
  function buildMoths() {
    const near = HEADS.filter(([x, , z]) => z > -40), n = near.length * 26, P = [], A = [], R = rng(17);
    for (const [x, y, z] of near) for (let i = 0; i < 26; i++) { P.push(x, y - 1.2, z); A.push(1 + R() * 3.5, 0.6 + R() * 1.6, R() * 6.283, (R() - 0.5) * 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aM', new THREE.Float32BufferAttribute(A, 4));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime, uPx },
      vertexShader: `attribute vec4 aM; uniform float uTime, uPx; varying float vA;
        void main(){ float t = uTime * aM.y + aM.z;
          vec3 p = position + vec3(cos(t) * aM.x, aM.w + sin(t * 1.7) * 0.8, sin(t * 1.3) * aM.x * 0.7);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float px = 0.05 * uPx / -mv.z; gl_PointSize = clamp(px, 1.2, 4.0); vA = (0.5 + 0.5 * sin(t * 7.0)) * clamp(px * 3.0, 0.35, 1.0); }`,
      fragmentShader: 'varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * (1.0 - r) * vA, 1.0); }',
    }));
    pts.frustumCulled = false; pts.userData.keep = true; root.add(pts); void n;
  }

  /* ---------- target greens: flags, glow rings (they flash when a ball lands), yardage signs ---------- */
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
      const flag = add(fg, new THREE.MeshStandardMaterial({ color: g.flag, roughness: 0.75, side: THREE.DoubleSide, emissive: new THREE.Color(g.flag), emissiveIntensity: 0.3 }), g.x + 0.014, y + 2.07, g.z);
      flag.userData.base = Float32Array.from(fg.attributes.position.array); flag.userData.phase = (g.x * 7 + g.z) % 6; flag.userData.keep = true;
      flags.push(flag);
      // the glow ring: dark until a ball lands on the green, then it flashes
      const rg = new THREE.CylinderGeometry(g.r + 1.8, g.r + 1.8, 0.2, 96, 1, true); rg.translate(0, 0.08, 0);
      const col = g.pod ? 0xffb54a : 0x3cff8a;
      const ring = add(rg, new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), g.x, y + 0.05, g.z, { cast: false });
      ring.userData = { g, base: 0, hit: -10, keep: true }; ring.visible = false; rings.push(ring);
      if (!g.pod) { // a lit yardage sign beside the green, facing the tee
        const side = g.x >= 0 ? 1 : -1, bx = g.x + side * (g.r + 5), bz = g.z + 2, by = G(bx, bz);
        const b = add(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, map: signTexture(String(g.yd), 'YARDS') }), bx, by + 1.5, bz, { ry: Math.atan2(-bx, -bz) + Math.PI });
        b.userData.keep = true; signs.push({ board: b, text: String(g.yd) });
        add(new THREE.BoxGeometry(0.08, 1.0, 0.08), M(0x2a2f36), bx, by + 0.4, bz);
      }
    }
    // distance boards along the driving fairway
    for (const yd of [200, 250, 300]) for (const x of [-46, 58]) {
      const z = -yd * YD, y = G(x, z);
      add(new THREE.BoxGeometry(0.18, 3.4, 0.18), M(0x2a2f36), x - 2.6, y + 1.7, z); add(new THREE.BoxGeometry(0.18, 3.4, 0.18), M(0x2a2f36), x + 2.6, y + 1.7, z);
      const b = add(new THREE.PlaneGeometry(7, 4.4), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, map: signTexture(String(yd), 'YARDS') }), x, y + 4.6, z);
      b.userData.keep = true; signs.push({ board: b, text: String(yd) });
      glow(x, y + 4.6, z + 0.5, 14, 0xffd28a, 0.3);
    }
  }

  /* ---------- range balls: white specks over the landing areas, brightest in the pools ---------- */
  function buildBalls() {
    const R = rng(23), n = coarse ? 1300 : 1800, P = [], L = [];
    let k = 0;
    while (P.length / 3 < n && k++ < n * 20) {
      const yd = 25 + R() * 260, z = -yd * YD;
      const wid = 22 + yd * 0.18, x = 8 + (R() + R() + R() - 1.5) * wid * 1.1;
      // more balls between 90 and 210 yd, fewer short and very long, a few around the greens
      const w = Math.exp(-(((yd - 150) / 75) ** 2)) * 0.85 + 0.15;
      if (R() > w || !inBox(x, z, RANGE) || x < -58 || x > 78) continue;
      P.push(x, G(x, z) + 0.022, z); L.push(poolL(x, z));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aL', new THREE.Float32BufferAttribute(L, 1));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uPx },
      vertexShader: `attribute float aL; uniform float uPx; varying float vA, vL;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float px = 0.043 * uPx / -mv.z; gl_PointSize = clamp(px, 1.2, 14.0); vA = clamp(0.1 + px * 1.4, 0.0, 1.0) * smoothstep(320.0, 60.0, -mv.z); vL = aL; }`,
      fragmentShader: 'varying float vA, vL; void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard; float sh = 0.75 + 0.35 * (0.5 - q.y); gl_FragColor = vec4(vec3(0.95, 0.95, 0.92) * sh * (0.45 + 0.75 * vL), vA * (1.0 - smoothstep(0.75, 1.0, r))); }',
    }));
    pts.userData.keep = true; root.add(pts);
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
    const s = add(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, map: screen.t }), x, y + y0 + h / 2, z, { cast: false });
    s.userData.keep = true;
    sprite(x, y + y0 + h / 2, z + 4, 110, 0x4f8cff, 0.2);
    drawScreen([['CARRY', '—', 'YD'], ['BALL', '—', 'MPH'], ['LAUNCH', '—', 'DEG'], ['SPIN', '—', 'RPM']]);
  }

  /* ---------- the main tee line: mats, dividers, your bay's props, a few pyramids left in other bays ---------- */
  const matTex = canvasTex(256, 256, (g) => {
    const R = rng(31);
    g.fillStyle = '#2b5a2a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(10,30,10,0.18)' : 'rgba(120,170,90,0.14)'; g.fillRect(R() * 256, R() * 256, 1, 2 + R() * 3); }
    g.fillStyle = '#3f7a36'; g.fillRect(150, 0, 70, 256);                                            // the hitting strip
    for (let i = 0; i < 2200; i++) { g.fillStyle = R() < 0.6 ? 'rgba(20,45,18,0.2)' : 'rgba(150,200,110,0.15)'; g.fillRect(150 + R() * 70, R() * 256, 1, 2 + R() * 3); }
    const wr = g.createRadialGradient(185, 128, 2, 185, 128, 34); wr.addColorStop(0, 'rgba(190,200,150,0.35)'); wr.addColorStop(1, 'rgba(190,200,150,0)'); g.fillStyle = wr; g.fillRect(140, 80, 90, 96);   // the worn spot
    g.strokeStyle = 'rgba(235,235,220,0.55)'; g.lineWidth = 3; g.strokeRect(4, 4, 248, 248);
    g.fillStyle = '#111'; g.beginPath(); g.arc(185, 128, 5, 0, 7); g.fill();                          // the rubber tee
  });
  const bagTex = canvasTex(64, 128, (g) => { g.fillStyle = '#16233d'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#e9e6dc'; g.fillRect(0, 28, 64, 10); g.fillRect(0, 96, 64, 5); g.fillStyle = '#c23a33'; g.fillRect(0, 40, 64, 4); });
  function buildTeeLine() {
    const matMat = M(0xffffff, { map: matTex.t, roughness: 0.95 }), divMat = M(0x1d252c, { roughness: 0.6 }), capMat = M(0x3a434c, { roughness: 0.5 });
    const trayMat = M(0x1f3d2a, { roughness: 0.6 }), ballMat = M(0xf2f2ee, { roughness: 0.35 });
    const R = rng(41), ball = new THREE.IcosahedronGeometry(0.0214, 1), tray = new THREE.CylinderGeometry(0.2, 0.26, 0.06, 4).rotateY(Math.PI / 4);
    const pyramid = (x, z, list) => {           // a plastic tray with a pyramid of balls on it
      add(tray, trayMat, x, 0.06, z, { cast: false, recv: true });
      for (let l = 0; l < 4; l++) { const k = 4 - l; for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) list.push({ geo: ball, m: mat4(x + (i - (k - 1) / 2) * 0.043, 0.11 + l * 0.035, z + (j - (k - 1) / 2) * 0.043) }); }
    };
    const balls = [];
    for (let i = -15; i <= 14; i++) {
      const x = i * 3.2; if (x > 46) continue;
      add(new THREE.BoxGeometry(1.6, 0.03, 1.6), matMat, x, 0.015, 0.45, { cast: false, recv: true });
      if (i !== 0 && i !== -1) { add(new THREE.BoxGeometry(0.06, 0.8, 1.2), divMat, x - 1.6, 0.4, 2.9); add(new THREE.BoxGeometry(0.08, 0.04, 1.2), capMat, x - 1.6, 0.81, 2.9, { cast: false }); }
      if (i !== 0 && R() < 0.22) pyramid(x - 1.05, 1.0, balls);
    }
    // your bay: a pyramid by the mat, alignment sticks on the turf, a bag on its stand
    pyramid(-1.0, 0.95, balls);
    for (const [x, z0, z1, c] of [[0.36, -0.45, -1.95, 0xff7a1a], [-0.84, 1.1, -0.45, 0xf2d230]]) {
      const len = Math.abs(z1 - z0);
      add(new THREE.CylinderGeometry(0.0055, 0.0055, len, 6).rotateX(Math.PI / 2), M(c, { roughness: 0.4, emissive: new THREE.Color(c), emissiveIntensity: 0.15 }), x, 0.008, (z0 + z1) / 2, { cast: false });
    }
    { // the bag on its stand, right of the mat, leaning back
      const bx = -2.3, bz = 2.3, lean = -0.3, parts = [], sh = [];
      const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.9, 14), M(0xffffff, { map: bagTex.t, roughness: 0.6 }));
      bag.position.set(bx, 0.52, bz); bag.rotation.x = lean; bag.castShadow = true; root.add(bag);
      for (const s of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.008, 0.8, 5), m: mat4(bx + s * 0.13, 0.36, bz - 0.2, 0.42, 0, s * 0.08) });
      for (let k = 0; k < 9; k++) {           // shafts and heads above the bag's mouth
        const a = k / 9 * 6.283, rx = Math.cos(a) * 0.07, rz = Math.sin(a) * 0.07, up = 0.28 + (k % 3) * 0.06;
        const top = new THREE.Vector3(rx, 0.45 + up, rz).applyAxisAngle(new THREE.Vector3(1, 0, 0), lean).add(new THREE.Vector3(bx, 0.52, bz));
        sh.push({ geo: new THREE.CylinderGeometry(0.006, 0.006, up + 0.1, 5), m: mat4(top.x, top.y - up * 0.5, top.z, lean) });
        parts.push({ geo: new THREE.BoxGeometry(k < 3 ? 0.07 : 0.05, k < 3 ? 0.06 : 0.04, k < 3 ? 0.11 : 0.03), m: mat4(top.x, top.y + 0.02, top.z, lean, a) });
      }
      const p = new THREE.Mesh(mergeGeos(parts), M(0x2c3036, { metalness: 0.6, roughness: 0.35 })); p.castShadow = true; root.add(p);
      const s = new THREE.Mesh(mergeGeos(sh), M(0x9aa2aa, { metalness: 0.8, roughness: 0.3 })); root.add(s);
    }
    const bm = new THREE.Mesh(mergeGeos(balls), ballMat); bm.castShadow = true; root.add(bm);
    // the Academy behind the tee line (seen from the overview only): dark timber and a band of lit glass
    add(new THREE.BoxGeometry(60, 9, 22), M(0x262c33, { roughness: 0.5 }), 0, 4.5, 35);
    add(new THREE.BoxGeometry(56, 3.2, 0.2), BASIC(0xb8875a), 0, 5.4, 23.9, { cast: false });
    for (let x = -27; x <= 27; x += 2.25) add(new THREE.BoxGeometry(0.14, 3.3, 0.3), M(0x2a2420), x, 5.4, 23.85, { cast: false });
    add(new THREE.BoxGeometry(64, 0.5, 26), M(0x5a4430, { roughness: 0.8 }), 0, 9.2, 35);
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
    add(new THREE.PlaneGeometry(x1 - x0, z0 - z1).rotateX(-Math.PI / 2), M(0xffffff, { map: floorTex.t, roughness: 0.35, metalness: 0.1 }), cx, 0.012, (z0 + z1) / 2, { cast: false, recv: true });
    // target line on the floor, lit
    add(new THREE.PlaneGeometry(0.05, z0 - z1 - 1).rotateX(-Math.PI / 2), BASIC(0x6fd2ff), bx, 0.016, (bz + 1.4 + z1) / 2 - 0.3, { cast: false });
    // the pressure mat: glows warm under each foot (redrawn by the coach later)
    const mat = canvasTex(256, 256, (g) => {
      g.fillStyle = '#0d2230'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#3fa9d6'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 248);
      for (const [fx, fy, s] of [[80, 92, 1.0], [80, 168, 0.8]]) { const gr = g.createRadialGradient(fx, fy, 2, fx, fy, 44 * s); gr.addColorStop(0, 'rgba(255,220,120,1)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.75)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(fx, fy, 30 * s, 46 * s, 0, 0, 7); g.fill(); }
    });
    const pm = add(new THREE.PlaneGeometry(1.9, 1.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, map: mat.t }), bx - 0.75, 0.018, bz, { cast: false });
    pm.userData.keep = true;
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
      const side = new THREE.Mesh(sg, glass); side.position.set(x, 0, z0); side.userData.keep = true; root.add(side);
      add(new THREE.BoxGeometry(0.36, h, 0.36), frame, x, h / 2, z1);
      for (let k = 1; k < 4; k++) { const zz = z0 - L * k / 4; add(new THREE.BoxGeometry(0.1, hb + rise * k / 4, 0.1), frame, x, (hb + rise * k / 4) / 2, zz); }
    }
    add(new THREE.BoxGeometry(x1 - x0 + 0.36, 0.4, 0.4), frame, cx, h - 0.2, z1);
    // a horseshoe of truss round the sides and back at 3.4 m, open toward the target, with cameras
    const pts = [];
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
    sprite(cx, 4.5, z1 + 1, 10, 0xd8f0ff, 0.25);
    lab.mat = mat;
  }
  // the coach's target window in the lab's lane: two tall lit poles
  const gate = { poles: [] };
  function buildGate() {
    const poleMat = M(0xdfe8ee, { roughness: 0.4 }), strip = BASIC(0x5fd0ff);
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.userData.keep = true;
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
    for (let z = -60; z > -232; z -= 4) { add(new THREE.BoxGeometry(1.4, 1.2, 4.1), hedge, HEDGE_X, 0.6, z - 2, { recv: true }); if (Math.round(z) % 12 === 0) { add(new THREE.BoxGeometry(0.2, 0.08, 0.2), up, HEDGE_X + 0.9, 0.04, z - 2, { cast: false }); glow(HEDGE_X + 0.9, 0.5, z - 2, 2.2, 0xffd9a0, 0.5); } }
    // lie-station plaques on the tee pad
    const plaque = (txt, x, z) => { const p = add(new THREE.PlaneGeometry(0.6, 0.24).rotateX(-1.2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, map: signTexture(txt, '', '#0e2236', '#f6c25b') }), x, 0.12, z, { cast: false }); p.userData.keep = true; };
    plaque('FW', -88, -96); plaque('RGH', -86, -96); plaque('SAND', -74, -96); plaque('UP', -72, -96);
    // small pole lights over the pods
    for (const p of PODS) { const x = p.x + (p.x < -80 ? -p.r - 4 : p.r + 4), z = p.z + 3; add(new THREE.CylinderGeometry(0.1, 0.14, 9), M(0x6b7682, { metalness: 0.6 }), x, 4.5, z); add(new THREE.BoxGeometry(0.9, 0.4, 0.5), M(0x22282f), x, 9.1, z); glow(x, 9, z, 8, 0xffdcae, 0.6); }
  }

  /* ---------- tree belts round the campus: pines and broadleaves in layers, a low belt across the far end ---------- */
  function buildTrees() {
    const R = rng(4), spots = [];
    const put = (x, z, s, kind) => spots.push([x, z, s, kind]);
    for (let z = 60; z > -330; z -= 7) {
      put(RANGE.x1 + 34 + R() * 18, z + R() * 5, 0.9 + R() * 0.5, R() < 0.45);
      put(RANGE.x1 + 58 + R() * 26, z + R() * 5, 1.0 + R() * 0.6, R() < 0.55);
      if (z < -40) { put(SG.x0 - 22 - R() * 16, z + R() * 5, 0.9 + R() * 0.5, R() < 0.45); put(SG.x0 - 46 - R() * 26, z + R() * 5, 1.0 + R() * 0.6, R() < 0.55); }
    }
    for (let z = -40; z < 60; z += 7) put(HEDGE_X - 18 - R() * 30, z, 0.9 + R() * 0.5, R() < 0.5);
    for (let x = -190; x < 220; x += 11) if (R() < 0.7) put(x + R() * 6, -380 - R() * 50, 0.45 + R() * 0.3, R() < 0.6);
    // a pine: trunk and three cones; a broadleaf: trunk and three lumpy crowns (both about 14 m at scale 1)
    const pine = mergeGeos([{ geo: new THREE.CylinderGeometry(0.22, 0.3, 4, 6), m: mat4(0, 2, 0) },
      { geo: new THREE.ConeGeometry(2.6, 5, 8), m: mat4(0, 5.5, 0) }, { geo: new THREE.ConeGeometry(2.0, 4.4, 8), m: mat4(0, 8.4, 0) }, { geo: new THREE.ConeGeometry(1.3, 4, 8), m: mat4(0, 11.4, 0) }]);
    const broad = mergeGeos([{ geo: new THREE.CylinderGeometry(0.25, 0.35, 5, 6), m: mat4(0, 2.5, 0) },
      { geo: new THREE.IcosahedronGeometry(3.4, 1), m: mat4(0, 8, 0, 0, 0, 0, 1, 0.85, 1) }, { geo: new THREE.IcosahedronGeometry(2.6, 1), m: mat4(2.2, 9.6, 0.8) }, { geo: new THREE.IcosahedronGeometry(2.4, 1), m: mat4(-1.8, 10.2, -1.0) }]);
    const mat = M(0xffffff, { roughness: 1 }), mq = new THREE.Matrix4(), c = new THREE.Color();
    for (const [geo, isPine] of [[pine, true], [broad, false]]) {
      const list = spots.filter(s => s[3] === isPine), im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, z, s], i) => {
        im.setMatrixAt(i, mq.compose(new THREE.Vector3(x, G(x, z) - 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6.28, 0)), new THREE.Vector3(s, s * (0.9 + R() * 0.3), s)));
        im.setColorAt(i, c.setHSL(isPine ? 0.38 + R() * 0.04 : 0.31 + R() * 0.05, 0.28 + R() * 0.12, isPine ? 0.045 + R() * 0.02 : 0.055 + R() * 0.025));
      });
      im.castShadow = true; im.userData.keep = true; root.add(im);
    }
  }

  /* ---------- the ball picker cart, crawling across the far range with its lamps on ---------- */
  const cart = new THREE.Group();
  function buildCart() {
    const body = [], cage = [], gang = [];
    body.push({ geo: new THREE.BoxGeometry(1.3, 0.55, 2.0), m: mat4(0, 0.65, 0) }, { geo: new THREE.BoxGeometry(1.2, 0.35, 0.8), m: mat4(0, 1.05, -0.55) });
    for (const [x, z] of [[-0.62, -0.7], [0.62, -0.7], [-0.62, 0.7], [0.62, 0.7]]) body.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12).rotateZ(Math.PI / 2), m: mat4(x, 0.3, z) });
    for (const x of [-0.62, 0.62]) for (const z of [-0.95, 0.45]) cage.push({ geo: new THREE.BoxGeometry(0.05, 1.3, 0.05), m: mat4(x, 1.55, z) });
    for (const z of [-0.95, -0.55, -0.15, 0.25, 0.45]) cage.push({ geo: new THREE.BoxGeometry(1.29, 0.05, 0.05), m: mat4(0, 2.2, z) });
    for (const x of [-0.62, -0.2, 0.2, 0.62]) cage.push({ geo: new THREE.BoxGeometry(0.04, 0.04, 1.45), m: mat4(x, 2.2, -0.25) });
    for (let i = -1; i <= 1; i++) gang.push({ geo: new THREE.CylinderGeometry(0.28, 0.28, 1.25, 10).rotateZ(Math.PI / 2), m: mat4(i * 1.3, 0.28, 2.5) });
    gang.push({ geo: new THREE.BoxGeometry(3.9, 0.06, 0.06), m: mat4(0, 0.58, 2.5) }, { geo: new THREE.BoxGeometry(0.06, 0.06, 1.4), m: mat4(0, 0.5, 1.6) });
    for (const [list, c, o] of [[body, 0xd9d5c8, { roughness: 0.6 }], [cage, 0x30363c, { metalness: 0.6, roughness: 0.4 }], [gang, 0x3d6b3a, { roughness: 0.7 }]]) {
      const m = new THREE.Mesh(mergeGeos(list), new THREE.MeshStandardMaterial({ color: c, ...o })); m.castShadow = true; cart.add(m);
    }
    // its lamps: two headlights and an amber beacon on the cage
    const P = [-0.4, 0.75, -1.02, 0.4, 0.75, -1.02, 0, 2.3, -0.25], C = [1, 0.95, 0.85, 1, 0.95, 0.85, 1, 0.6, 0.15], S = [2.4, 2.4, 2.6], B = [0, 0, 1];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1)); geo.setAttribute('aBlink', new THREE.Float32BufferAttribute(B, 1));
    const lamps = new THREE.Points(geo, glowMaterial(4.0)); lamps.frustumCulled = false; cart.add(lamps);
    cart.userData.keep = true; root.add(cart);
  }
  const cartAt = t => [12 + 52 * Math.sin(t * 0.045), -232 * YD + 16 * Math.sin(t * 0.017)];
  function moveCart(t) {
    const [x, z] = cartAt(t), [x2, z2] = cartAt(t + 0.5);
    cart.position.set(x, G(x, z), z); cart.rotation.y = Math.atan2(x - x2, z - z2);
    const fx = (x2 - x), fz = (z2 - z), l = Math.hypot(fx, fz) || 1;
    cartPool.set(x + fx / l * 7, z + fz / l * 7, 8, 0.45);
  }

  /* ---------- a plane crossing the sky now and then, its strobes blinking ---------- */
  const plane = new THREE.Group();
  function buildPlane() {
    const P = [-12, 0, 0, 12, 0, 0, 0, 0, 8, 0, 2, -6], C = [1, 0.2, 0.2, 0.2, 1, 0.4, 1, 1, 1, 1, 0.3, 0.3], S = [30, 30, 40, 26], B = [0, 0, 3, 5];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1)); geo.setAttribute('aBlink', new THREE.Float32BufferAttribute(B, 1));
    const pts = new THREE.Points(geo, glowMaterial(9.0)); pts.frustumCulled = false; plane.add(pts);
    plane.userData.keep = true; root.add(plane);
  }
  function movePlane(t) { const k = ((t + 40) % 150) / 150; plane.position.set(-7000 + 14000 * k, 700 + 120 * Math.sin(k * 3), -5200 + 1400 * k); plane.visible = k > 0.05 && k < 0.95; }

  /* ---------- glows as points: one draw for every static glow (masts, boards, beacons) ---------- */
  function glowMaterial(blinkRate = 1.6) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime, uPx },
      vertexShader: `attribute vec3 aCol; attribute float aSize, aBlink; uniform float uTime, uPx; varying vec3 vC;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          float px = aSize * uPx / -mv.z; gl_PointSize = clamp(px, 2.0, 700.0);
          float b = aBlink > 0.0 ? (sin(uTime * ${blinkRate.toFixed(2)} + aBlink) > 0.6 ? 1.0 : 0.12) : 1.0;
          vC = aCol * b * clamp(px / 2.0, 0.3, 1.0); }`,
      fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = exp(-r * r * 9.0) * 0.9 + (1.0 - smoothstep(0.25, 1.0, r)) * 0.35; gl_FragColor = vec4(vC * a, 1.0); }',
    });
  }
  function buildGlows() {
    const P = [], C = [], S = [], B = [];
    for (const [x, y, z, s, c, op, b] of GLOWS) { P.push(x, y, z); C.push(c.r * op, c.g * op, c.b * op); S.push(s * 0.55); B.push(b); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('aCol', new THREE.Float32BufferAttribute(C, 3)); geo.setAttribute('aSize', new THREE.Float32BufferAttribute(S, 1)); geo.setAttribute('aBlink', new THREE.Float32BufferAttribute(B, 1));
    const pts = new THREE.Points(geo, glowMaterial()); pts.frustumCulled = false; pts.userData.keep = true; pts.renderOrder = 3; root.add(pts);
  }

  /* ---------- merge the static meshes by material: a few draws instead of hundreds ---------- */
  function mergeStatic() {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), groups = new Map(), drop = [];
    root.traverse(o => {
      if (o === root) return;
      for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
      if (!o.isMesh || o.isInstancedMesh || o.material.transparent || o.material.isShaderMaterial) return;
      const k = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      if (!groups.has(k)) groups.set(k, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, list: [] });
      groups.get(k).list.push({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
      drop.push(o);
    });
    for (const o of drop) { if (o.children.length) for (const c of [...o.children]) { if (!drop.includes(c)) { o.remove(c); root.add(c); } } o.parent.remove(o); }
    for (const { mat, cast, recv, list } of groups.values()) { const m = new THREE.Mesh(mergeGeos(list), mat); m.castShadow = cast; m.receiveShadow = recv; root.add(m); }
  }

  buildGround(); buildSkyline(); buildTowers(); buildMoths(); buildGreens(); buildBalls(); buildScreen(); buildTeeLine(); buildLab(); buildGate(); buildShortGame(); buildTrees(); buildCart(); buildPlane(); buildGlows();
  mergeStatic();
  moveCart(0); movePlane(0);

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
      uTime.value = clock;
      uPx.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      for (const rg of rings) { const t = now - rg.userData.hit, o = t < 4 ? 0.6 * (1 - t / 4) * (0.6 + 0.4 * Math.sin(t * 9)) : 0; rg.material.opacity = o; rg.visible = o > 0.005; }
      moveCart(clock); movePlane(clock);
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
