// The Woodson Range environment: sky, light, ground, trees, boulders, target greens, hitting bays.
// Shared by the driving range and every range-based mini game. Each game picks the pieces it wants.
//
//   const world = createRangeWorld(stage, { greens: [], bays: false });
//   world.renderer / scene / camera / sun / sunDir / setSun / groundAt / surfaceAt
//   world.animate(clock)  — flags wave;   world.aimShadows(focus) — keep sharp shadows near the action

export const CLUBS = [
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

export const DEFAULT_GREENS = [ // target greens: yards downrange, lateral metres, radius metres, flag colour
  { yd: 60,  x: 9,   r: 7.5,  flag: '#e8483b' },
  { yd: 90,  x: -11, r: 9,    flag: '#f2f2ee' },
  { yd: 120, x: 7,   r: 10,   flag: '#2f6fd8' },
  { yd: 150, x: -9,  r: 11,   flag: '#f5c542' },
  { yd: 175, x: 13,  r: 11.5, flag: '#e8483b' },
  { yd: 200, x: -4,  r: 12.5, flag: '#f2f2ee' },
  { yd: 235, x: 15,  r: 13,   flag: '#2f6fd8' },
  { yd: 270, x: -10, r: 14,   flag: '#f5c542' },
].map(g => ({ ...g, z: -g.yd * 0.9144 }));

export function createRangeWorld(stage, opts = {}) {
  const { bays = true, rangeBalls = true } = opts;
  const greens = opts.greens ?? DEFAULT_GREENS;
  // the ground shader needs at least one green; a far-away zero-size one draws nothing
  const shaderGreens = greens.length ? greens : [{ x: 1e5, z: 1e5, r: 0 }];
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
    for (const g of greens) {
      const d = Math.hypot(x - g.x, z - g.z);
      if (d < g.r + 12) { const w = sstep(g.r + 12, g.r + 1.5, d); h = h * (1 - w) + w * (0.32 + 0.012 * (z - g.z)); }
    }
    return h;
  }
  function surfaceAt(x, z) {
    for (const g of greens) if (Math.hypot(x - g.x, z - g.z) < g.r) return 'green';
    return (Math.abs(x) < halfW(z) && z < 10 && z > RANGE_END) ? 'fairway' : 'rough';
  }

  const coarse = matchMedia('(pointer: coarse)').matches || !!window.__lowq;
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
    const greenU = { value: shaderGreens.map(g => new THREE.Vector4(g.x, g.z, g.r, 0)) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGreens = greenU;
      sh.uniforms.uEnd = { value: RANGE_END };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
  varying vec3 vWPos; varying vec3 vWN;
  uniform vec4 uGreens[${shaderGreens.length}];
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
  for (int i = 0; i < ${greens.length}; i++) {
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
    for (const g of greens) {
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
    if (!bays) { addRangeBalls(); return; }
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

    addRangeBalls();
  }
  function addRangeBalls() {
    if (!rangeBalls) return;
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

  buildGround(); buildTrees(); buildProps();
  return {
    renderer, scene, camera, sun, sunDir, setSun, groundAt, surfaceAt, flags, signs, coarse, greens, halfW, RANGE_END,
    // wave the flags
    animate(clock, wind = 1) {
      for (const fl of flags) {
        const p = fl.geometry.attributes.position, b = fl.userData.base, ph = fl.userData.phase;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 9 - clock * 5.5 * wind + ph) * 0.07 * x + Math.sin(x * 4 + clock * 2.3 + ph) * 0.035 * x); }
        p.needsUpdate = true; fl.geometry.computeVertexNormals();
      }
    },
    // the sun's shadow box follows the action so nearby shadows stay crisp
    aimShadows(focus) { sun.target.position.copy(focus).setY(0); sun.position.copy(sun.target.position).addScaledVector(sunDir, 450); },
    // redraw yardage boards once web fonts have loaded
    refreshSigns() { for (const sg of signs) { sg.board.material.map.dispose(); sg.board.material.map = signTexture(sg.text, 'YARDS'); sg.board.material.needsUpdate = true; } },
  };
}
