// Base stage for themed mini game scenes: renderer, camera, physical sky, sun with shadows,
// sky-lit environment and fog. A scene module builds its terrain and props on top of this.
//
//   const st = createStage(container, { elev: 4, az: 60, turbidity: 8, ... });
//   st.renderer / scene / camera / sun / sunDir / hemi / coarse; st.aimShadows(focus)

export function createStage(container, skyOpts = {}) {
  THREE.ColorManagement.legacyMode = false;
  const S = {
    turbidity: 5, rayleigh: 1.5, mie: 0.005, mieG: 0.82, elev: 30, az: 40,
    sunColor: 0xfff2e0, sunInt: 2.3, exposure: 0.6, hemiSky: 0xcfe3ff, hemiGround: 0x5a5a32, hemiInt: 0.35,
    fogColor: 0xc0ccd4, fogNear: 300, fogFar: 3600, shadowBox: 95, ...skyOpts,
  };
  const coarse = matchMedia('(pointer: coarse)').matches || !!window.__lowq;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 2 : 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = S.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 12000);
  scene.fog = new THREE.Fog(S.fogColor, S.fogNear, S.fogFar);

  const sky = new THREE.Sky(); sky.scale.setScalar(10000); scene.add(sky);
  const U = sky.material.uniforms;
  U.turbidity.value = S.turbidity; U.rayleigh.value = S.rayleigh; U.mieCoefficient.value = S.mie; U.mieDirectionalG.value = S.mieG;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - S.elev), THREE.MathUtils.degToRad(S.az));
  U.sunPosition.value.copy(sunDir);

  const sun = new THREE.DirectionalLight(S.sunColor, S.sunInt);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 2048 : 4096, coarse ? 2048 : 4096);
  const B = S.shadowBox;
  Object.assign(sun.shadow.camera, { left: -B, right: B, top: B, bottom: -B, near: 1, far: 1400 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(S.hemiSky, S.hemiGround, S.hemiInt); scene.add(hemi);

  { // image-based light from the same sky
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), s2 = new THREE.Sky(); s2.scale.setScalar(1000); es.add(s2);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) s2.material.uniforms[k].value = U[k].value;
    s2.material.uniforms.sunPosition.value.copy(sunDir);
    scene.environment = pm.fromScene(es, 0.02).texture;
  }

  return {
    renderer, scene, camera, sun, sunDir, hemi, coarse, sky,
    aimShadows(focus) { sun.target.position.copy(focus).setY(0); sun.position.copy(sun.target.position).addScaledVector(sunDir, 600); },
  };
}

// small shared helpers for scene builders
export function hash2(i, j) { let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, z) { return vnoise(x, z) * 0.5 + vnoise(x * 2.03 + 17, z * 2.03 + 5) * 0.25 + vnoise(x * 4.1 + 3, z * 4.1 + 11) * 0.125 + vnoise(x * 8.3, z * 8.3 + 7) * 0.0625; }
export function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0; return (s >>> 8) / 16777216; }; }
export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// GLSL noise helpers for ground shaders
export const GLSL_NOISE = `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fb(vec2 p){ return vn(p)*0.5 + vn(p*2.07+3.1)*0.25 + vn(p*4.13+7.7)*0.125 + vn(p*8.4+1.3)*0.0625; }
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }`;

// Terrain mesh with a radially stretched grid (dense near the play area, sparse far away).
export function terrainMesh(groundAt, { N = 300, nearX = 120, farX = 2800, nearZ = 220, farZ = 2600, cz = -150 } = {}) {
  const geo = new THREE.PlaneGeometry(2, 2, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const mx = u => nearX * u + farX * Math.sign(u) * Math.abs(u) ** 5;
  const mz = u => cz + nearZ * u + farZ * Math.sign(u) * Math.abs(u) ** 5;
  for (let i = 0; i < pos.count; i++) { const x = mx(pos.getX(i)), z = mz(pos.getZ(i)); pos.setXYZ(i, x, groundAt(x, z), z); }
  geo.computeVertexNormals();
  return geo;
}

// Canvas texture for signs and boards.
export function signTexture(text, sub, { bg = '#163a2c', fg = '#f1eee3' } = {}) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 240, 144);
  g.fillStyle = fg; g.textAlign = 'center';
  g.font = '700 86px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(text, 128, 102);
  if (sub) { g.font = '600 22px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(sub, 128, 136); }
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
