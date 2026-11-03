// Dead farm at night — the Zombie Siege scene. A moonlit field with chalk yard lines and your
// fence just ahead (sandbags, barbed wire, burning barrels), floodlights cutting beams through
// rolling ground fog, a cornfield the horde walks out of, a family graveyard they climb out of,
// a sagging barn and silo, an abandoned farmhouse, an overturned pickup with its headlights on,
// a burning tractor, a windmill, jack-o'-lanterns, a sparking power line, a far church steeple,
// bats across the moon and distant lightning.
//
// Extra API for the game: addFire(x, z, opts) · flashFog(pos, k) · onThunder(delay) · onSpark()

import { createStage, fbm, rng, sstep, hash2, GLSL_NOISE, terrainMesh, signTexture } from '../../world/stage.js';
import { FENCE_Z, YD, GRAVEYARD } from '../zombie-logic.js';

const NPOOL = 12; // warm light pools (barrels, fires, headlights) painted onto the ground and fog

function radialTex(stops, size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

export function createDeadFarm(container) {
  const st = createStage(container, {
    turbidity: 2, rayleigh: 0.5, mie: 0.003, mieG: 0.8, elev: 35, az: 330, // moonlight from high behind your left shoulder (no glare off the field)
    sunColor: 0x8aa2d8, sunInt: 0.55, exposure: 1.0, hemiSky: 0x24304e, hemiGround: 0x0a0a0e, hemiInt: 0.36,
    fogColor: 0x0b1018, fogNear: 100, fogFar: 1200, shadowBox: 110,
  });
  const { scene, renderer, sunDir } = st;
  st.sky.visible = false; scene.environment = null;
  scene.fog = new THREE.FogExp2(0x0a0e16, 0.0023);
  const R = rng(66), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, ...o });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
  const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.5)'], [0.55, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']]);
  const glowSprite = (c, s, o = {}) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, ...o })); sp.scale.setScalar(s); return sp; };
  const woodDark = std(0x3a2e24), wood = std(0x56463a), metal = std(0x3a3c40, { metalness: 0.5, roughness: 0.55 }), rust = std(0x4a2e1e, { metalness: 0.3, roughness: 0.8 });

  /* ---------------- light pools (shared by the ground and fog shaders) ---------------- */
  const pools = Array.from({ length: NPOOL }, () => ({ v: new THREE.Vector4(0, 0, 1, 0), c: new THREE.Color(0, 0, 0), base: 0, flick: 0 }));
  const poolU = { uPool: { value: pools.map(p => p.v) }, uPoolC: { value: pools.map(p => p.c) } };
  let poolN = 0;
  const addPool = (x, z, r, k, c, flick = 0.25) => { const p = pools[poolN++]; p.v.set(x, z, r, k); p.c.set(c); p.base = k; p.flick = flick; return p; };
  const GLSL_POOLS = `
uniform vec4 uPool[${NPOOL}]; uniform vec3 uPoolC[${NPOOL}];
vec3 poolLight(vec2 p){ vec3 a = vec3(0.0); for (int i = 0; i < ${NPOOL}; i++){ vec4 q = uPool[i]; vec2 d = p - q.xy; a += uPoolC[i] * q.w * exp(-dot(d, d) / (q.z * q.z)); } return a; }`;

  /* ---------------- night sky: stars, the moon, drifting clouds, lightning ---------------- */
  const moonDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 3.6), THREE.MathUtils.degToRad(163)); // a big moon rising over the far ridge
  const skyU = { uMoon: { value: moonDir }, uT: { value: 0 }, uFlash: { value: 0 }, uFlashDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uMoon, uFlashDir; uniform float uT, uFlash;
${GLSL_NOISE}
float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(vec3(0.03, 0.04, 0.065), vec3(0.004, 0.006, 0.014), smoothstep(-0.02, 0.55, h));
  c += vec3(0.05, 0.035, 0.02) * exp(-max(h, 0.0) * 28.0) * smoothstep(-0.08, 0.0, h);       // a far town's glow on the horizon
  // stars
  vec3 sp = d * 260.0, cell = floor(sp); float r = h31(cell);
  float star = step(0.982, r) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5)) * smoothstep(0.03, 0.2, h);
  star *= 0.6 + 0.4 * sin(uT * (2.0 + r * 5.0) + r * 40.0);
  c += vec3(0.85, 0.9, 1.0) * star * (0.4 + 0.6 * fract(r * 91.0));
  // moon: a pale disc with dark seas and a wide halo
  float a = acos(clamp(dot(d, uMoon), -1.0, 1.0));
  vec2 mp = vec2(dot(d, normalize(cross(uMoon, vec3(0.0, 1.0, 0.0)))), d.y - uMoon.y) * 28.0;
  float disc = smoothstep(0.052, 0.047, a), seas = fb(mp * 0.8 + 3.0);
  vec3 moon = vec3(1.0, 0.84, 0.66) * (0.66 + 0.42 * smoothstep(0.35, 0.7, seas));
  c = mix(c, moon * 2.2, disc);
  c += vec3(0.55, 0.55, 0.62) * (exp(-a * 11.0) * 0.25 + exp(-a * 3.0) * 0.06);
  // clouds: a slow-moving layer, silver near the moon, lit from inside by lightning
  vec2 cp = d.xz / max(d.y + 0.06, 0.04) * 0.55 + vec2(uT * 0.004, uT * 0.0015);
  float cl = smoothstep(0.42, 0.78, fb(cp * 1.3) * 0.75 + fb(cp * 3.7 + 9.0) * 0.25) * smoothstep(-0.02, 0.1, h);
  vec3 cloud = vec3(0.025, 0.03, 0.045) + vec3(0.45, 0.5, 0.62) * exp(-a * 5.0) * 0.5;
  float fl = uFlash * exp(-acos(clamp(dot(d, uFlashDir), -1.0, 1.0)) * 2.2);
  cloud += vec3(0.7, 0.72, 0.9) * fl * 2.0;
  c += vec3(0.25, 0.27, 0.36) * fl * 0.4;
  c = mix(c, cloud, cl * 0.88);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);

  /* ---------------- ground: flat field, low hills around it ---------------- */
  const CORN = [-258, -335];
  function groundAt(x, z) {
    let h = 0.35 * (fbm(x / 30 + 3, z / 30) - 0.5);
    const out = Math.max(Math.abs(x) - 85, -360 - z, z - 40, 0);
    if (out > 0) h += sstep(0, 120, out) * (6 + 40 * fbm(x / 160, z / 160 + 4)) + out * 0.04;
    return h;
  }
  const surfaceAt = () => 'rough';
  const inGrave = (x, z) => x > GRAVEYARD.x[0] - 3 && x < GRAVEYARD.x[1] + 3 && z > GRAVEYARD.z[0] - 3 && z < GRAVEYARD.z[1] + 3;
  const geo = terrainMesh(groundAt, { N: st.coarse ? 240 : 300, nearX: 140, farX: 2600, nearZ: 230, farZ: 2600, cz: -160 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, poolU, { uFlood: { value: floodU } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform vec4 uFlood[4];\nfloat gChalk;' + GLSL_NOISE + GLSL_POOLS)
      .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float fine = mix(fb(p.xz*2.6), 0.5, smoothstep(20.0, 80.0, camD));
float mid = fb(p.xz*0.12), big = fb(p.xz*0.02 + 7.0);
vec3 grass = mix(lin(vec3(0.32,0.3,0.21)), lin(vec3(0.24,0.26,0.18)), mid) * (0.78 + 0.42*fine);
vec3 dirt = lin(vec3(0.36,0.29,0.21)) * (0.8 + 0.35*fine);
vec3 c = mix(grass, dirt, smoothstep(0.55, 0.72, fb(p.xz*0.07)) * 0.8);
// ploughed rows under the corn, and fresh dirt in the graveyard
float corn = smoothstep(${CORN[0] + 6}.0, ${CORN[0] - 4}.0, p.z) * (1.0 - smoothstep(85.0, 95.0, abs(p.x)));
c = mix(c, dirt * (0.75 + 0.35*step(0.5, fract(p.x/1.4))), corn);
float gy = step(${GRAVEYARD.x[0] - 2}.0, p.x) * step(p.x, ${GRAVEYARD.x[1] + 2}.0) * step(${GRAVEYARD.z[0] - 2}.0, p.z) * step(p.z, ${GRAVEYARD.z[1] + 2}.0);
c = mix(c, dirt * (0.6 + 0.3 * fb(p.xz * 1.7)), gy * 0.85);
// chalk yard lines every 25 yd and a dashed centre line
float yd = -p.z / 0.9144;
float fade = 1.0 - smoothstep(120.0, 420.0, camD);
float lineW = 0.32 / 0.9144 * (1.0 + camD/120.0);
float onField = step(abs(p.x), 62.0) * step(30.0, yd) * step(yd, 290.0) * (1.0 - gy);
float yl = (1.0 - smoothstep(0.0, lineW, abs(mod(yd + 12.5, 25.0) - 12.5))) * onField * (0.55 + 0.45*fb(p.xz*0.6));
float cl = (1.0 - smoothstep(0.12, 0.12 + 0.02*camD, abs(p.x))) * step(0.5, fract(yd / 4.0)) * onField * 0.7;
c = mix(c, lin(vec3(0.82,0.82,0.76)), max(yl, cl) * fade);
gChalk = max(yl, cl * 0.6) * (1.0 - smoothstep(200.0, 420.0, camD));
c = mix(c, lin(vec3(0.16,0.17,0.12)) * (0.8 + 0.3*big), smoothstep(1.5, 8.0, p.y));
diffuseColor.rgb = c;
`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * poolLight(vWPos.xz) * 1.1 + vec3(0.07, 0.08, 0.075) * gChalk;\nfor (int i = 0; i < 4; i++){ vec2 fd = vWPos.xz - uFlood[i].xy; totalEmissiveRadiance += diffuseColor.rgb * vec3(0.75, 0.8, 1.0) * 2.4 * uFlood[i].w * exp(-dot(fd, fd) / (uFlood[i].z * uFlood[i].z)); }');
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  /* ---------------- fence (with damage stages), sandbags, barbed wire ---------------- */
  const fence = new THREE.Group(); scene.add(fence);
  const pickets = [];
  const postTops = [];
  for (let x = -60; x <= 60; x += 3) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodDark); post.position.set(x, 0.5, FENCE_Z); post.castShadow = true; fence.add(post); postTops.push(x);
  }
  for (const y of [0.3, 0.78]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(120, 0.1, 0.06), woodDark); rail.position.set(0, y, FENCE_Z + 0.06); rail.castShadow = true; fence.add(rail); }
  const picketGeo = new THREE.BoxGeometry(0.1, 0.85, 0.03); picketGeo.translate(0, 0.425, 0);
  for (let x = -59.6; x <= 59.6; x += 0.42) {
    const pk = new THREE.Mesh(picketGeo, R() < 0.5 ? wood : woodDark);
    pk.position.set(x, 0, FENCE_Z - 0.05); pk.rotation.z = (R() - 0.5) * 0.06; pk.scale.y = 0.85 + R() * 0.25; pk.castShadow = true;
    pk.userData = { order: R(), tilt: (R() - 0.5) * 1.6 };
    fence.add(pk); pickets.push(pk);
  }
  pickets.sort((a, b) => a.userData.order - b.userData.order);
  function setFenceDamage(f) { // 0 = intact, 1 = broken
    pickets.forEach((p, i) => { const t = i / pickets.length; p.visible = t >= f * 0.75; p.rotation.x = t < f ? p.userData.tilt * 0.4 : 0; });
  }
  // sandbag walls piled against the fence on your side
  const bagGeo = new THREE.SphereGeometry(0.5, 10, 6); bagGeo.scale(0.62, 0.2, 0.3);
  const bags = [];
  for (const cx of [-50, -33, -17, 0, 17, 33, 50]) {
    const n = 4 + Math.floor(R() * 3);
    for (let layer = 0; layer < 3; layer++) for (let i = 0; i < n - layer; i++) bags.push([cx + (i - (n - layer - 1) / 2) * 0.62 + (R() - 0.5) * 0.08, 0.1 + layer * 0.19, FENCE_Z + 0.55 + (R() - 0.5) * 0.06, (R() - 0.5) * 0.15]);
  }
  const bagMesh = new THREE.InstancedMesh(bagGeo, std(0x7a6a4a, { roughness: 1 }), bags.length);
  bags.forEach(([x, y, z, r], i) => { q.setFromEuler(new THREE.Euler(0, r, 0)); m4.compose(ps.set(x, y, z), q, sc.set(1, 1, 1)); bagMesh.setMatrixAt(i, m4); col.setRGB(0.48, 0.42, 0.3).offsetHSL(0, 0, (R() - 0.5) * 0.08); bagMesh.setColorAt(i, col); });
  bagMesh.castShadow = bagMesh.receiveShadow = true; scene.add(bagMesh);
  // barbed wire coils on the field side
  const wirePts = [];
  for (let x = -58; x < 58; x += 0.05) { const a = x * 5.2, r = 0.42; const p0 = [x, 0.45 + Math.sin(a) * r, FENCE_Z - 3 + Math.cos(a) * r]; const a1 = (x + 0.05) * 5.2; wirePts.push(...p0, x + 0.05, 0.45 + Math.sin(a1) * r, FENCE_Z - 3 + Math.cos(a1) * r); }
  const wireGeo = new THREE.BufferGeometry(); wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x6a6e74 })));
  for (let x = -58; x <= 58; x += 4) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), metal); s.position.set(x, 0.55, FENCE_Z - 3); s.rotation.z = (R() - 0.5) * 0.2; scene.add(s); }

  /* ---------------- fire: barrels, the tractor, and fires left by blasts ---------------- */
  const FIRE_CAP = 900;
  const fPos = new Float32Array(FIRE_CAP * 3), fLife = new Float32Array(FIRE_CAP), fSize = new Float32Array(FIRE_CAP), fVel = new Float32Array(FIRE_CAP * 3), fMax = new Float32Array(FIRE_CAP);
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3)); fGeo.setAttribute('aLife', new THREE.BufferAttribute(fLife, 1)); fGeo.setAttribute('aSize', new THREE.BufferAttribute(fSize, 1));
  const fireMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMap: { value: glowTex }, uScale: { value: 300 } },
    vertexShader: 'attribute float aLife; attribute float aSize; varying float vL; uniform float uScale; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z * (0.5 + 0.7 * aLife); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uMap; varying float vL; void main(){ if (vL <= 0.0) discard; vec4 t = texture2D(uMap, gl_PointCoord); vec3 c = mix(vec3(0.5, 0.06, 0.0), mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.85, 0.45), smoothstep(0.65, 1.0, vL)), smoothstep(0.0, 0.5, vL)); gl_FragColor = vec4(c * t.a * vL * 1.4, 1.0); }',
  });
  const firePts = new THREE.Points(fGeo, fireMat); firePts.frustumCulled = false; firePts.renderOrder = 5; scene.add(firePts);
  // smoke: slow dark puffs (normal blending)
  const SM_CAP = 260, smPos = new Float32Array(SM_CAP * 3), smLife = new Float32Array(SM_CAP), smSize = new Float32Array(SM_CAP), smVel = new Float32Array(SM_CAP * 3);
  const smGeo = new THREE.BufferGeometry(); smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3)); smGeo.setAttribute('aLife', new THREE.BufferAttribute(smLife, 1)); smGeo.setAttribute('aSize', new THREE.BufferAttribute(smSize, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: glowTex }, uScale: { value: 300 } },
    vertexShader: 'attribute float aLife; attribute float aSize; varying float vL; uniform float uScale; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z * (2.2 - 1.2 * aLife); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform sampler2D uMap; varying float vL; void main(){ if (vL <= 0.0) discard; float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(vec3(0.03, 0.03, 0.035), a * vL * 0.55); }',
  });
  const smokePts = new THREE.Points(smGeo, smokeMat); smokePts.frustumCulled = false; smokePts.renderOrder = 4; scene.add(smokePts);
  let fHead = 0, smHead = 0;
  function emit(x, y, z, s, rise) {
    const i = fHead = (fHead + 1) % FIRE_CAP;
    fPos.set([x + (R() - 0.5) * s * 0.6, y, z + (R() - 0.5) * s * 0.6], i * 3); fVel.set([(R() - 0.5) * 0.4, rise * (0.7 + R() * 0.6), (R() - 0.5) * 0.4], i * 3);
    fMax[i] = 0.5 + R() * 0.5; fLife[i] = 1; fSize[i] = s * (0.7 + R() * 0.6);
  }
  function puff(x, y, z, s) {
    const i = smHead = (smHead + 1) % SM_CAP;
    smPos.set([x, y, z], i * 3); smVel.set([0.3 + (R() - 0.5) * 0.4, 1.2 + R() * 0.8, (R() - 0.5) * 0.4], i * 3); smLife[i] = 1; smSize[i] = s * (0.8 + R() * 0.5);
  }
  const fires = []; // { x, y, z, rate, size, rise, smoke, life, pool, glow }
  const dynPools = [];
  function addFire(x, z, { y = groundAt(x, z) + 0.1, rate = 26, size = 0.9, rise = 1.6, smoke = 0, life = Infinity, pool = null, glowSize = 4 } = {}) {
    const g = glowSprite(0xff7a2a, glowSize, { opacity: 0.7 }); g.position.set(x, y + size * 0.6, z); scene.add(g);
    const f = { x, y, z, rate, size, rise, smoke, life, acc: 0, smokeAcc: 0, pool, glow: g, glowSize, age: 0 };
    if (!pool && life !== Infinity) { const p = dynPools.find(dp => !dp.busy) || dynPools[0]; p.busy = f; f.pool = p.pool; p.pool.v.set(x, z, 7, 0); p.pool.c.set(0xff6a20); p.pool.base = 1.1; p.pool.flick = 0.45; f.dyn = p; }
    fires.push(f); return f;
  }
  // three pool slots for fires left by blasts
  for (let i = 0; i < 3; i++) dynPools.push({ busy: null, pool: addPool(0, 0, 1, 0, 0xff6a20) });
  // burning barrels along your side of the fence
  const barrelGeo = new THREE.CylinderGeometry(0.32, 0.3, 0.9, 12); barrelGeo.translate(0, 0.45, 0);
  for (const bx of [-46, -24, 24, 46]) {
    const z = FENCE_Z + 2.2, y = groundAt(bx, z);
    const b = new THREE.Mesh(barrelGeo, rust); b.position.set(bx, y, z); b.castShadow = true; scene.add(b);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 6, 16), basic(0xff7a30)); rim.rotation.x = Math.PI / 2; rim.position.set(bx, y + 0.9, z); scene.add(rim);
    addFire(bx, z, { y: y + 0.85, rate: 30, size: 0.55, rise: 1.4, pool: addPool(bx, z, 7, 1.2, 0xff7a2a, 0.35), glowSize: 3.2 });
  }

  // a kerosene lantern on a crate beside you
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.6), wood); crate.position.set(6.5, 0.3, -10.5); crate.rotation.y = 0.4; crate.castShadow = true; scene.add(crate);
  const lanBody = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 10), basic(0xffc070)); lanBody.position.set(6.5, 0.75, -10.5); scene.add(lanBody);
  const lanTop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 10), metal); lanTop.position.set(6.5, 0.94, -10.5); scene.add(lanTop);
  const yardGlow = glowSprite(0xffb060, 2.6); yardGlow.position.set(6.5, 0.78, -10.5); scene.add(yardGlow);
  const yardPool = addPool(6.5, -10.5, 4, 0.9, 0xffb060, 0.12);
  for (const [x, z, r] of [[7.6, -10, 0.2], [5.6, -11.4, -0.3]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), woodDark); b.position.set(x, 0.2, z); b.rotation.y = r; scene.add(b); }

  // odds and ends in the yard: a stack of old tyres, a wheelbarrow, a pitchfork against the fence
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.17, 8, 18), std(0x141414)); t.rotation.x = Math.PI / 2; t.position.set(-7.5 + (R() - 0.5) * 0.1, 0.17 + i * 0.3, -10.8); t.castShadow = true; scene.add(t); }
  const barrow = new THREE.Group(); barrow.position.set(-4.2, 0, -8.6); barrow.rotation.y = 0.9; scene.add(barrow);
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.35, 4, 1, true), std(0x3a4a3a, { metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide })); tray.rotation.y = Math.PI / 4; tray.scale.set(1, 1, 1.5); tray.position.y = 0.55; barrow.add(tray);
  const bw = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 14), std(0x111111)); bw.position.set(0, 0.24, 0.85); bw.rotation.y = Math.PI / 2; barrow.add(bw);
  for (const sx of [-0.25, 0.25]) { const hd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.5), woodDark); hd.position.set(sx, 0.5, -0.45); hd.rotation.x = -0.25; barrow.add(hd); }
  const fork = new THREE.Group(); fork.position.set(2.2, 0, FENCE_Z + 0.35); fork.rotation.x = -0.32; scene.add(fork);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6), wood); shaft.position.y = 0.8; fork.add(shaft);
  for (const x of [-0.08, 0, 0.08]) { const tn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 4), metal); tn.position.set(x, 1.75, 0); fork.add(tn); }

  /* ---------------- floodlights: real spot lights, beams in the fog, one dying ---------------- */
  const floods = [];
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(0xd8e4ff) }, uK: { value: 1 } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; uniform vec3 uC; uniform float uK; void main(){ gl_FragColor = vec4(uC * 0.1 * uK * pow(vY, 0.9), 1.0); }',
  });
  const floodU = []; // aim points light the fog
  function flood(x, z, aim, H = 22) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, H, 8), metal); pole.position.set(x, H / 2, z); pole.castShadow = true; scene.add(pole);
    const head = new THREE.Group(); head.position.set(x, H, z); head.lookAt(aim[0], 0, aim[1]); scene.add(head);
    head.add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 0.3), metal));
    const lamps = [];
    for (let c = 0; c < 3; c++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9), basic(0xf2f6ff)); l.position.set(-0.85 + c * 0.85, 0, 0.16); head.add(l); lamps.push(l); }
    const gl = glowSprite(0xdfe8ff, 9); gl.position.set(x, H, z); scene.add(gl);
    const dir = new THREE.Vector3(aim[0] - x, -H, aim[1] - z), len = dir.length();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, len * 0.22, len, 20, 1, true), beamMat.clone()); beam.geometry.translate(0, -len / 2, 0); beam.position.set(x, H, z);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()); scene.add(beam);
    const L = new THREE.SpotLight(0xcfdcff, 6, 420, 0.24, 0.55, 1.0); L.position.set(x, H, z); L.target.position.set(aim[0], 0, aim[1]); scene.add(L, L.target);
    const f = { L, lamps, gl, beam, base: 6, aim, flicker: false }; floods.push(f);
    floodU.push(new THREE.Vector4(aim[0], aim[1], len * 0.2, 1));
    return f;
  }
  flood(-58, FENCE_Z + 3, [-20, -50]); flood(58, FENCE_Z + 3, [24, -98]);
  flood(-72, -140, [-16, -165], 24); flood(74, -150, [26, -232], 24).flicker = true;

  /* ---------------- rolling ground fog, lit by the floodlights and fires ---------------- */
  const fogU = { uT: { value: 0 }, uFlood: { value: floodU }, uFlash: { value: new THREE.Vector4(0, 0, 0, 0) }, uSky: { value: 0 }, ...poolU };
  const fogMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: fogU,
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uT, uSky; uniform vec4 uFlood[4]; uniform vec4 uFlash;
      ${GLSL_NOISE}
      ${GLSL_POOLS}
      void main(){
        vec2 p = vW.xz * 0.03 + vec2(uT * 0.025, uT * 0.009);
        float n = fb(p + fb(p * 0.55 - uT * 0.012) * 1.4);
        float far = smoothstep(-18.0, -75.0, vW.z);                         // clear at the fence, rolling in beyond it
        float corn = smoothstep(-180.0, -260.0, vW.z);
        float wisp = smoothstep(0.32 - 0.1 * corn, 0.76, n);
        float dens = wisp * (0.26 + 0.24 * corn) * far;
        float camD = length(vW - cameraPosition);
        dens *= 1.0 - smoothstep(190.0, 360.0, camD);                      // never piles up into a band on the horizon
        vec3 c = vec3(0.05, 0.06, 0.085);                                 // moonlit: paler than the ground so it reads
        for (int i = 0; i < 4; i++){ vec2 d = vW.xz - uFlood[i].xy; c += vec3(0.16, 0.17, 0.21) * uFlood[i].w * exp(-dot(d, d) / (uFlood[i].z * uFlood[i].z)); }
        c += poolLight(vW.xz) * 0.2;
        vec2 fd = vW.xz - uFlash.xy; c += vec3(0.5, 0.25, 0.08) * uFlash.w * exp(-dot(fd, fd) / 900.0);
        c += vec3(0.08, 0.09, 0.12) * uSky;
        gl_FragColor = vec4(c, dens);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  for (const [y, s] of [[0.35, 1], [0.95, 1.15], [1.6, 1.3], [2.4, 1.5]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500).rotateX(-Math.PI / 2), fogMat); f.position.set(0, y, -250); f.scale.setScalar(s); f.renderOrder = 3; scene.add(f);
  }

  // fog banks: soft camera-facing patches drifting low across the field. Flat layers vanish when seen
  // edge-on from the tee; these read at any angle, and pick up the floodlights and fires.
  const NPUFF = st.coarse ? 70 : 90;
  const puffGeo = new THREE.InstancedBufferGeometry(); puffGeo.index = new THREE.PlaneGeometry(1, 1).index;
  { const pl = new THREE.PlaneGeometry(1, 1); puffGeo.setAttribute('position', pl.attributes.position); puffGeo.setAttribute('uv', pl.attributes.uv); }
  const pOff = new Float32Array(NPUFF * 3), pSz = new Float32Array(NPUFF * 2), pSeed = new Float32Array(NPUFF), puffs = [];
  for (let i = 0; i < NPUFF; i++) {
    const z = -26 - Math.pow(R(), 0.8) * 250, thick = z < -170 ? 1.3 : 1;
    puffs.push({ x: (R() - 0.5) * 170, y: 0.6 + R() * 1.6, z, v: 0.6 + R() * 0.9 });
    pSz.set([(16 + R() * 22) * thick, (4 + R() * 4) * thick], i * 2); pSeed[i] = R() * 50;
  }
  puffGeo.setAttribute('aOff', new THREE.InstancedBufferAttribute(pOff, 3)); puffGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(pSz, 2)); puffGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(pSeed, 1));
  puffGeo.instanceCount = NPUFF;
  const puffMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: fogU,
    vertexShader: `attribute vec3 aOff; attribute vec2 aSize; attribute float aSeed; varying vec2 vUv; varying vec3 vW; varying float vSeed, vCam;
      void main(){ vUv = uv; vW = aOff; vSeed = aSeed; vec4 mv = viewMatrix * vec4(aOff, 1.0); vCam = -mv.z;
        mv.xy += position.xy * aSize; mv.y += aSize.y * 0.3; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vW; varying float vSeed, vCam; uniform float uT, uSky; uniform vec4 uFlood[4]; uniform vec4 uFlash;
      ${GLSL_NOISE}
      ${GLSL_POOLS}
      void main(){
        vec2 q = (vUv - 0.5) * 2.0;
        float edge = (1.0 - smoothstep(0.35, 1.0, length(q * vec2(1.0, 1.15)))) * smoothstep(-1.0, -0.55, q.y);
        float n = fb(vUv * vec2(3.0, 1.4) + vec2(vSeed + uT * 0.02, vSeed * 0.7));
        float a = edge * smoothstep(0.28, 0.7, n) * 0.34;
        a *= smoothstep(18.0, 45.0, vCam) * (1.0 - smoothstep(260.0, 380.0, vCam));
        vec3 c = vec3(0.06, 0.07, 0.095);
        for (int i = 0; i < 4; i++){ vec2 d = vW.xz - uFlood[i].xy; c += vec3(0.2, 0.21, 0.26) * uFlood[i].w * exp(-dot(d, d) / (uFlood[i].z * uFlood[i].z * 1.6)); }
        c += poolLight(vW.xz) * 0.25;
        vec2 fd = vW.xz - uFlash.xy; c += vec3(0.6, 0.3, 0.1) * uFlash.w * exp(-dot(fd, fd) / 1200.0);
        c += vec3(0.12, 0.13, 0.17) * uSky;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const puffMesh = new THREE.Mesh(puffGeo, puffMat); puffMesh.frustumCulled = false; puffMesh.renderOrder = 3; scene.add(puffMesh);
  function stepPuffs(dt) {
    for (let i = 0; i < NPUFF; i++) { const p = puffs[i]; p.x += p.v * dt; if (p.x > 95) p.x -= 190; pOff.set([p.x, groundAt(p.x, p.z) + p.y, p.z], i * 3); }
    puffGeo.attributes.aOff.needsUpdate = true;
  }

  /* ---------------- barn and silo (a lantern in the hayloft) ---------------- */
  const barnRed = std(0x4a201c, { roughness: 0.95 }), roofMat = std(0x232220, { roughness: 0.9 });
  const barn = new THREE.Group(); barn.position.set(-78, groundAt(-78, -95), -95); barn.rotation.y = 0.35; scene.add(barn);
  const bodyB = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 22), barnRed); bodyB.position.y = 4.5; bodyB.castShadow = bodyB.receiveShadow = true; barn.add(bodyB);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-8.6, 0); roofShape.lineTo(0, 6.5); roofShape.lineTo(8.6, 0); roofShape.lineTo(-8.6, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 23, bevelEnabled: false }), roofMat); roof.position.set(0, 9, -11.5); roof.rotation.z = 0.04; roof.castShadow = true; barn.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 6.5), std(0x120c0a, { roughness: 1 })); door.position.set(0, 3.25, 11.02); barn.add(door);
  const loft = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.2), basic(0xffa040)); loft.position.set(0, 10.2, 11.03); barn.add(loft);
  for (const [x, r] of [[0, 0.5], [0, -0.5]]) { const bd = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 0.06), woodDark); bd.position.set(x, 10.2, 11.08); bd.rotation.z = r; barn.add(bd); }
  const loftGlow = glowSprite(0xff9a40, 7, { opacity: 0.6 }); loftGlow.position.set(0, 10.2, 11.5); barn.add(loftGlow);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 18, 20), std(0x4d4a44, { roughness: 0.8, metalness: 0.2 })); silo.position.set(-98, 9, -118); silo.castShadow = true; scene.add(silo);
  const sdome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), silo.material); sdome.position.set(-98, 18, -118); scene.add(sdome);

  /* ---------------- abandoned farmhouse (boarded up, one window lit) ---------------- */
  const house = new THREE.Group(); house.position.set(86, groundAt(86, -70), -70); house.rotation.y = -Math.PI / 2 + 0.25; scene.add(house);
  const hBody = new THREE.Mesh(new THREE.BoxGeometry(14, 7.5, 10), std(0x6a665c)); hBody.position.y = 3.75; hBody.castShadow = hBody.receiveShadow = true; house.add(hBody);
  const hrs = new THREE.Shape(); hrs.moveTo(-7.6, 0); hrs.lineTo(0, 4.2); hrs.lineTo(7.6, 0); hrs.lineTo(-7.6, 0);
  const hRoof = new THREE.Mesh(new THREE.ExtrudeGeometry(hrs, { depth: 11, bevelEnabled: false }), roofMat); hRoof.position.set(0, 7.5, -5.5); hRoof.rotation.z = -0.03; house.add(hRoof);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), std(0x3a2a24)); chim.position.set(4, 10.5, 0); house.add(chim);
  const porch = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 3), wood); porch.position.set(0, 0.15, 6.5); house.add(porch);
  const pRoof = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.2, 3.4), roofMat); pRoof.position.set(0, 3.2, 6.6); pRoof.rotation.z = 0.06; house.add(pRoof);
  for (const x of [-6.5, -2, 2, 6.5]) { const pc = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), wood); pc.position.set(x, 1.6, 8); house.add(pc); }
  const boarded = (x, y, lit) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6), lit ? basic(0xff9a3a) : std(0x0c0c0e)); w.position.set(x, y, 5.02); house.add(w);
    for (const r of [0.6, -0.5, 0.1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.05), woodDark); b.position.set(x, y + r * 0.4, 5.06); b.rotation.z = r; house.add(b); }
    return w;
  };
  boarded(-4, 2.4); boarded(4, 2.4); boarded(-4, 5.6); const litWin = boarded(4, 5.6, true);
  const hDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), std(0x1a120c)); hDoor.position.set(0, 1.45, 5.02); house.add(hDoor);
  const porchLamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), basic(0xffd08a)); porchLamp.position.set(1.2, 2.7, 5.2); house.add(porchLamp);
  const porchGlow = glowSprite(0xffb060, 4); porchGlow.position.copy(porchLamp.position); house.add(porchGlow);
  house.updateMatrixWorld(true);
  const pw = new THREE.Vector3(1.2, 0, 7).applyMatrix4(house.matrixWorld), porchPool = addPool(pw.x, pw.z, 8, 0.9, 0xffb060, 0);
  const winGlow = glowSprite(0xff9a3a, 3.5, { opacity: 0.6 }); winGlow.position.set(4, 5.6, 5.4); house.add(winGlow);

  /* ---------------- overturned pickup, headlights still on ---------------- */
  const truck = new THREE.Group(); truck.position.set(-30, groundAt(-30, -108) + 1.2, -108); truck.rotation.set(0, 0.75, Math.PI / 2 - 0.06); truck.scale.setScalar(1.22); scene.add(truck);
  const paint = std(0x5a2420, { metalness: 0.4, roughness: 0.5 });
  const tb = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 5.4), paint); tb.position.y = 0.2; tb.castShadow = true; truck.add(tb);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.9), paint); cab.position.set(0, 1.05, 0.6); truck.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.5, 1.4), std(0x0e1216, { metalness: 0.7, roughness: 0.15 })); glass.position.set(0, 1.15, 0.6); truck.add(glass);
  const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14); wheelG.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1.05, 1.8], [1.05, 1.8], [-1.05, -1.7], [1.05, -1.7]]) { const w = new THREE.Mesh(wheelG, std(0x111111)); w.position.set(x, -0.25, z); truck.add(w); }
  const lightsT = [];
  for (const x of [-0.65, 0.65]) { const hl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), basic(0xfff2c8)); hl.position.set(x, 0.3, 2.71); truck.add(hl); lightsT.push(hl); }
  truck.updateMatrixWorld(true);
  const hlDir = new THREE.Vector3(0, 0, 1).transformDirection(truck.matrixWorld).setY(0).normalize();
  for (const x of [-0.65, 0.65]) {
    const o = new THREE.Vector3(x, 0.3, 2.75).applyMatrix4(truck.matrixWorld);
    const g = glowSprite(0xfff0c0, 2.4); g.position.copy(o); scene.add(g);
    const len = 26, bm = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 3.5, len, 14, 1, true), beamMat.clone()); bm.material.uniforms.uC.value.set(0xfff0c0); bm.material.uniforms.uK.value = 0.7;
    bm.geometry.translate(0, -len / 2, 0); bm.position.copy(o); bm.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), hlDir.clone().setY(-0.04).normalize()); scene.add(bm);
  }
  const tp = new THREE.Vector3(-30, 0, -108).addScaledVector(hlDir, 12);
  addPool(tp.x, tp.z, 9, 1.0, 0xfff0c8, 0.03);

  /* ---------------- burning tractor ---------------- */
  const tractor = new THREE.Group(); const TR = [36, -185]; tractor.position.set(TR[0], groundAt(TR[0], TR[1]), TR[1]); tractor.rotation.y = -0.6; scene.add(tractor);
  const trGreen = std(0x2a3a22, { roughness: 0.7, metalness: 0.2 }), charred = std(0x161412);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 2.6), charred); hood.position.set(0, 1.4, 1.2); hood.castShadow = true; tractor.add(hood);
  const tbody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.6), trGreen); tbody.position.set(0, 1.3, -0.8); tractor.add(tbody);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), charred); seat.position.set(0, 2.0, -0.9); tractor.add(seat);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), metal); stack.position.set(0.4, 2.5, 1.8); tractor.add(stack);
  const bigW = new THREE.CylinderGeometry(1.0, 1.0, 0.5, 18); bigW.rotateZ(Math.PI / 2);
  const smW = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14); smW.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(bigW, std(0x101010)); w.position.set(sx * 1.05, 1.0, -0.9); tractor.add(w); const f = new THREE.Mesh(smW, std(0x101010)); f.position.set(sx * 0.8, 0.5, 2.0); tractor.add(f); }
  const trFireY = groundAt(TR[0], TR[1]) + 2.0;
  addFire(TR[0] + 0.6, TR[1] - 0.6, { y: trFireY, rate: 70, size: 1.6, rise: 2.4, smoke: 6, pool: addPool(TR[0], TR[1], 14, 1.4, 0xff6a20, 0.45), glowSize: 12 });
  const trLight = new THREE.PointLight(0xff7a30, 3, 60, 1.5); trLight.position.set(TR[0], trFireY + 1.5, TR[1]); scene.add(trLight);

  /* ---------------- the graveyard (some of them climb out of it) ---------------- */
  const gx0 = GRAVEYARD.x[0] - 3, gx1 = GRAVEYARD.x[1] + 3, gz0 = GRAVEYARD.z[0] - 3, gz1 = GRAVEYARD.z[1] + 3;
  const stones = [];
  for (let x = GRAVEYARD.x[0]; x <= GRAVEYARD.x[1]; x += 2.6) for (let z = GRAVEYARD.z[0]; z <= GRAVEYARD.z[1]; z += 2.4) if (R() < 0.8) stones.push([x + (R() - 0.5) * 0.6, z + (R() - 0.5) * 0.4]);
  const stoneGeo = new THREE.BoxGeometry(0.75, 1.0, 0.16); stoneGeo.translate(0, 0.45, 0);
  const capGeo = new THREE.CylinderGeometry(0.375, 0.375, 0.16, 12, 1, false, 0, Math.PI); capGeo.rotateX(Math.PI / 2); capGeo.rotateZ(Math.PI / 2); capGeo.translate(0, 0.95, 0);
  const stoneMat = std(0x6a6c6e, { roughness: 1 });
  const stoneM = new THREE.InstancedMesh(stoneGeo, stoneMat, stones.length), capM = new THREE.InstancedMesh(capGeo, stoneMat, stones.length);
  stones.forEach(([x, z], i) => { q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.35, (R() - 0.5) * 0.4, (R() - 0.5) * 0.3)); const s = 0.8 + R() * 0.5; m4.compose(ps.set(x, groundAt(x, z) - 0.05, z), q, sc.set(s, s, s)); stoneM.setMatrixAt(i, m4); capM.setMatrixAt(i, m4); col.setRGB(0.42, 0.43, 0.44).offsetHSL(0, 0, (R() - 0.5) * 0.12); stoneM.setColorAt(i, col); capM.setColorAt(i, col); });
  stoneM.castShadow = capM.castShadow = true; scene.add(stoneM, capM);
  // low iron fence round the plot, with a gate gap facing you
  const ironPts = [];
  const rail = (ax, az, bx, bz) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.35); for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; ironPts.push(x, groundAt(x, z), z, x, groundAt(x, z) + 1.1, z); } ironPts.push(ax, groundAt(ax, az) + 1.0, az, bx, groundAt(bx, bz) + 1.0, bz, ax, groundAt(ax, az) + 0.3, az, bx, groundAt(bx, bz) + 0.3, bz); };
  rail(gx0, gz0, gx1, gz0); rail(gx0, gz0, gx0, gz1); rail(gx1, gz0, gx1, gz1); rail(gx0, gz1, (gx0 + gx1) / 2 - 1.5, gz1); rail((gx0 + gx1) / 2 + 1.5, gz1, gx1, gz1);
  const ironGeo = new THREE.BufferGeometry(); ironGeo.setAttribute('position', new THREE.Float32BufferAttribute(ironPts, 3));
  scene.add(new THREE.LineSegments(ironGeo, new THREE.LineBasicMaterial({ color: 0x1a1a1c })));
  // a stone angel, two crosses, and an eerie green lantern at the gate
  const angel = new THREE.Group(); angel.position.set((gx0 + gx1) / 2, groundAt((gx0 + gx1) / 2, GRAVEYARD.z[0]), GRAVEYARD.z[0] - 1); scene.add(angel);
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), stoneMat); ped.position.y = 0.6; angel.add(ped);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 10), stoneMat); robe.position.y = 2.1; angel.add(robe);
  const ahead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), stoneMat); ahead.position.set(0, 3.15, 0.05); angel.add(ahead);
  for (const s of [-1, 1]) { const wg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.7), stoneMat); wg.position.set(s * 0.35, 2.6, -0.3); wg.rotation.z = s * 0.35; angel.add(wg); }
  angel.traverse(o => { if (o.isMesh) o.castShadow = true; });
  for (const [x, z] of [[GRAVEYARD.x[0] + 2, GRAVEYARD.z[1] - 1], [GRAVEYARD.x[1] - 3, GRAVEYARD.z[0] + 3]]) {
    const y = groundAt(x, z), v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 0.2), stoneMat), h = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.2), stoneMat);
    v.position.set(x, y + 0.9, z); h.position.set(x, y + 1.35, z); v.rotation.z = h.rotation.z = 0.12; scene.add(v, h);
  }
  const lanX = (gx0 + gx1) / 2 + 2, lanZ = gz1 + 0.4;
  const lanPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), std(0x1a1a1a)); lanPost.position.set(lanX, groundAt(lanX, lanZ) + 0.8, lanZ); scene.add(lanPost);
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.32, 0.25), basic(0x9aff9a)); lantern.position.set(lanX, groundAt(lanX, lanZ) + 1.75, lanZ); scene.add(lantern);
  const lanGlow = glowSprite(0x7aff8a, 5); lanGlow.position.copy(lantern.position); scene.add(lanGlow);
  const lanPool = addPool(lanX, lanZ, 9, 0.8, 0x5aff7a, 0.2);

  /* ---------------- scarecrow (eyes that glow) ---------------- */
  const scare = new THREE.Group(); scare.position.set(64, 0, -150); scene.add(scare);
  const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), woodDark); sPost.position.y = 1.7; scare.add(sPost);
  const sArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), woodDark); sArm.rotation.z = Math.PI / 2; sArm.position.y = 2.6; scare.add(sArm);
  const sCoat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 7), std(0x2a241e, { roughness: 1 })); sCoat.position.y = 2.1; scare.add(sCoat);
  const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), std(0x6a5230, { roughness: 1 })); sHead.position.y = 3.1; scare.add(sHead);
  const sHat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 10), roofMat); sHat.position.y = 3.5; scare.add(sHat);
  for (const x of [-0.11, 0.11]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), basic(0xff3a1a, { fog: false })); e.position.set(x, 3.15, 0.28); scare.add(e); }
  const scareGlow = glowSprite(0xff3a1a, 1.6, { fog: false }); scareGlow.position.set(0, 3.15, 0.35); scare.add(scareGlow);
  scare.rotation.y = 0.3; scare.traverse(o => { if (o.isMesh) o.castShadow = true; });

  /* ---------------- windmill ---------------- */
  const mill = new THREE.Group(); const MW = [72, -232]; mill.position.set(MW[0], groundAt(MW[0], MW[1]), MW[1]); mill.rotation.y = 0.5; scene.add(mill);
  const legG = new THREE.BoxGeometry(0.16, 16.5, 0.16);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(legG, metal); l.position.set(sx * 1.1, 8, sz * 1.1); l.rotation.set(-sz * 0.07, 0, sx * 0.07); mill.add(l); }
  for (const y of [4, 8, 12]) { const w = 1.1 * (1 - y / 18) + 0.1; for (const r of [0, Math.PI / 2]) { const br = new THREE.Mesh(new THREE.BoxGeometry(w * 2.2, 0.08, 0.08), metal); br.position.y = y; br.rotation.y = r; mill.add(br); } }
  const hub = new THREE.Group(); hub.position.set(0, 16.4, 0.6); mill.add(hub);
  for (let i = 0; i < 14; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.8, 0.04), metal); bl.geometry.translate(0, 1.6, 0); bl.rotation.z = i / 14 * Math.PI * 2; bl.rotation.y = 0.3; hub.add(bl); }
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.2, 2.6), metal); vane.position.set(0, 16.4, -1.8); mill.add(vane);

  /* ---------------- hay bales and jack-o'-lanterns ---------------- */
  const hay = [[-62, -60], [-66, -63], [-58, -68], [60, -40], [62, -44], [-40, -175], [-44, -178], [48, -120], [20, -60], [-12, -150], [66, -98]];
  const hayGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 14); hayGeo.rotateZ(Math.PI / 2); hayGeo.translate(0, 0.75, 0);
  const hayM = new THREE.InstancedMesh(hayGeo, std(0x8a7444, { roughness: 1 }), hay.length);
  hay.forEach(([x, z], i) => { q.setFromEuler(new THREE.Euler(0, R() * 3, 0)); m4.compose(ps.set(x, groundAt(x, z), z), q, sc.set(1, 1, 1)); hayM.setMatrixAt(i, m4); });
  hayM.castShadow = hayM.receiveShadow = true; scene.add(hayM);
  const faceTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = '#ffb040'; g.shadowColor = '#ff7a10'; g.shadowBlur = 8;
    const tri = (pts) => { g.beginPath(); g.moveTo(...pts[0]); pts.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); g.fill(); };
    tri([[34, 30], [48, 10], [58, 30]]); tri([[70, 30], [80, 10], [94, 30]]); tri([[58, 38], [64, 30], [70, 38]]);
    g.beginPath(); g.moveTo(26, 42); for (let i = 0; i <= 8; i++) g.lineTo(26 + i * 9.5, i % 2 ? 58 : 46); g.lineTo(102, 42); g.quadraticCurveTo(64, 50, 26, 42); g.fill();
    return new THREE.CanvasTexture(cv);
  })();
  const pumpkins = [];
  [-57, -42, -27, -12, 3, 18, 33, 48].forEach(x => pumpkins.push([x, FENCE_Z, 1.0, 0.24]));          // on fence posts
  hay.slice(0, 7).forEach(([x, z], i) => { if (i % 2 === 0) pumpkins.push([x, z, 1.5, 0.32]); });
  pumpkins.push([-22, FENCE_Z + 2.4, 0, 0.3], [21, FENCE_Z + 2.6, 0, 0.34], [-5, FENCE_Z + 3, 0, 0.26]);
  const pkGeo = new THREE.SphereGeometry(1, 14, 10); { const p = pkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x); const k = 1 + 0.06 * Math.cos(a * 8); p.setXYZ(i, x * k, p.getY(i) * 0.78, z * k); } pkGeo.computeVertexNormals(); }
  const pkM = new THREE.InstancedMesh(pkGeo, std(0xc0601a, { roughness: 0.7, emissive: 0x401400 }), pumpkins.length);
  const faceM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), pumpkins.length);
  const pkGlowPos = [];
  pumpkins.forEach(([x, z, h, s], i) => {
    const y = groundAt(x, z) + h + s * 0.78, yaw = Math.atan2(-x, 3.2 - z) + (R() - 0.5) * 0.4; // face the tee, roughly
    q.setFromEuler(new THREE.Euler(0, yaw, 0)); m4.compose(ps.set(x, y, z), q, sc.set(s, s, s)); pkM.setMatrixAt(i, m4);
    const fx = x + Math.sin(yaw) * s * 1.01, fz = z + Math.cos(yaw) * s * 1.01;
    m4.compose(ps.set(fx, y, fz), q, sc.set(s, s, s)); faceM.setMatrixAt(i, m4);
    pkGlowPos.push(fx, y, fz);
  });
  pkM.castShadow = true; scene.add(pkM, faceM);
  const pkGlowGeo = new THREE.BufferGeometry(); pkGlowGeo.setAttribute('position', new THREE.Float32BufferAttribute(pkGlowPos, 3));
  const pkGlow = new THREE.Points(pkGlowGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xff8a2a, size: 2.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  scene.add(pkGlow);

  /* ---------------- bare dead trees ---------------- */
  const barkMat = std(0x241e1a, { roughness: 1 });
  const limb = new THREE.CylinderGeometry(0.5, 1, 1, 5); limb.translate(0, 0.5, 0);
  const limbs = [];
  const tree = (x, z, s) => {
    const y = groundAt(x, z), h = (5 + R() * 4) * s;
    limbs.push([x, y, z, 0.35 * s, h, 0, 0, R() * 6]);
    const n = 3 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const by = y + h * (0.45 + R() * 0.5), len = h * (0.35 + R() * 0.35), a = R() * 6.28, tilt = 0.6 + R() * 0.6;
      limbs.push([x, by, z, 0.14 * s, len, tilt, a, 0]);
      if (R() < 0.6) { const ex = x + Math.sin(tilt) * Math.cos(a) * len * 0.7, ez = z + Math.sin(tilt) * Math.sin(a) * len * 0.7, ey = by + Math.cos(tilt) * len * 0.7; limbs.push([ex, ey, ez, 0.07 * s, len * 0.6, tilt + 0.4, a + (R() - 0.5), 0]); }
    }
  };
  for (let i = 0; i < 60; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (70 + R() * 70), z = 20 - R() * 380; if (Math.hypot(x + 78, z + 95) < 25 || Math.hypot(x + 98, z + 118) < 10 || Math.hypot(x - 86, z + 70) < 16 || Math.hypot(x - MW[0], z - MW[1]) < 6) continue; tree(x, z, 0.8 + R() * 0.7); }
  for (let i = 0; i < 25; i++) tree((R() - 0.5) * 220, -345 - R() * 60, 1 + R() * 0.6);
  tree(GRAVEYARD.x[1] + 1, GRAVEYARD.z[0] - 3, 1.3);
  const trees = new THREE.InstancedMesh(limb, barkMat, limbs.length);
  limbs.forEach((L, i) => { q.setFromEuler(new THREE.Euler(L[5] * Math.sin(L[6]), L[7], L[5] * Math.cos(L[6]))); m4.compose(ps.set(L[0], L[1], L[2]), q, sc.set(L[3], L[4], L[3])); trees.setMatrixAt(i, m4); });
  trees.castShadow = true; scene.add(trees);

  /* ---------------- cornfield ---------------- */
  const stalkGeo = new THREE.ConeGeometry(0.22, 1, 4, 1); stalkGeo.translate(0, 0.5, 0);
  const stalks = [];
  for (let z = CORN[0]; z > CORN[1]; z -= 1.15) for (let x = -88; x <= 88; x += 1.4) { if (R() < 0.12 || inGrave(x, z)) continue; stalks.push([x + (R() - 0.5) * 0.5, z + (R() - 0.5) * 0.6, 1.9 + R() * 0.9]); }
  const corn = new THREE.InstancedMesh(stalkGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), stalks.length);
  stalks.forEach((s, i) => { q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.18, R() * 6, (R() - 0.5) * 0.18)); m4.compose(ps.set(s[0], groundAt(s[0], s[1]) - 0.1, s[1]), q, sc.set(1, s[2], 1)); corn.setMatrixAt(i, m4); col.setRGB(0.25, 0.22, 0.14).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.1, (R() - 0.5) * 0.1); corn.setColorAt(i, col); });
  corn.receiveShadow = true; scene.add(corn);

  /* ---------------- power line with a sparking transformer ---------------- */
  const PL = []; for (let z = 20; z >= -420; z -= 44) PL.push([96 + Math.sin(z * 0.01) * 4, z]);
  const plPts = [];
  PL.forEach(([x, z], i) => {
    const y = groundAt(x, z), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 11, 6), woodDark); pole.position.set(x, y + 5.5, z); pole.rotation.z = (R() - 0.5) * 0.08; scene.add(pole);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), woodDark); bar.position.set(x, y + 10.4, z); scene.add(bar);
    if (i) { const [px, pz] = PL[i - 1], py = groundAt(px, pz); for (const o of [-1.0, 0, 1.0]) for (let k = 0; k < 12; k++) { const a = k / 12, b = (k + 1) / 12, sag = t => 1.6 * 4 * t * (1 - t); plPts.push(px + o + (x - px) * a, py + 10.5 + (y - py) * a - sag(a), pz + (z - pz) * a, px + o + (x - px) * b, py + 10.5 + (y - py) * b - sag(b), pz + (z - pz) * b); } }
  });
  const plGeo = new THREE.BufferGeometry(); plGeo.setAttribute('position', new THREE.Float32BufferAttribute(plPts, 3));
  scene.add(new THREE.LineSegments(plGeo, new THREE.LineBasicMaterial({ color: 0x0a0a0c })));
  const TX = PL[3], txY = groundAt(TX[0], TX[1]) + 8.6;
  const transformer = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 10), metal); transformer.position.set(TX[0] - 0.5, txY, TX[1]); scene.add(transformer);
  const sparkGlow = glowSprite(0x9ad8ff, 10, { opacity: 0 }); sparkGlow.position.set(TX[0] - 0.5, txY + 0.6, TX[1]); scene.add(sparkGlow);
  const SPK = 60, spkPos = new Float32Array(SPK * 3), spkVel = new Float32Array(SPK * 3); let spkT = 0;
  const spkGeo = new THREE.BufferGeometry(); spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3));
  const sparks = new THREE.Points(spkGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xcfeaff, size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);

  /* ---------------- the church steeple on the far ridge ---------------- */
  const church = new THREE.Group(); church.position.set(-110, groundAt(-110, -500), -500); church.rotation.y = 0.4; scene.add(church);
  const cMat = std(0x1c1c22, { roughness: 1 });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 20), cMat); nave.position.y = 4; church.add(nave);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 4), cMat); tower.position.set(0, 8, 11); church.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 11, 4), cMat); spire.position.set(0, 21.5, 11); spire.rotation.y = Math.PI / 4; church.add(spire);
  const cWin = glowSprite(0xffb060, 3.5, { fog: false, opacity: 0.7 }); cWin.position.set(0, 12, 13.2); church.add(cWin);

  /* ---------------- crows on the fence, bats across the moon ---------------- */
  const crowMat = std(0x0c0c0e, { roughness: 0.6 });
  const crows = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group(), x = -50 + R() * 100;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), crowMat); body.scale.set(1, 0.9, 1.6); c.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), crowMat); head.position.set(0, 0.1, 0.15); c.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), std(0x2a2620)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.1, 0.24); c.add(beak);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.18), crowMat); tail.position.set(0, 0.02, -0.2); tail.rotation.x = 0.4; c.add(tail);
    c.position.set(x, 0.92, FENCE_Z + 0.06); c.rotation.y = R() * Math.PI * 2; c.userData = { head, ph: R() * 6 };
    scene.add(c); crows.push(c);
  }
  const batTex = (() => {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const g = cv.getContext('2d'); g.fillStyle = '#000';
    g.beginPath(); g.moveTo(32, 12); g.quadraticCurveTo(20, 2, 2, 8); g.quadraticCurveTo(10, 14, 8, 22); g.quadraticCurveTo(18, 16, 24, 22); g.quadraticCurveTo(28, 18, 32, 24);
    g.quadraticCurveTo(36, 18, 40, 22); g.quadraticCurveTo(46, 16, 56, 22); g.quadraticCurveTo(54, 14, 62, 8); g.quadraticCurveTo(44, 2, 32, 12); g.fill();
    return new THREE.CanvasTexture(cv);
  })();
  const bats = [];
  for (let i = 0; i < 7; i++) { const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: batTex, fog: false, depthWrite: false, transparent: true })); b.visible = false; scene.add(b); bats.push({ s: b, ph: R() * 6, off: new THREE.Vector3((R() - 0.5) * 50, (R() - 0.5) * 30, (R() - 0.5) * 20) }); }
  let batT = 6, batRun = null;

  /* ---------------- lit yardage signs every 50 yd (both sides, sized to read from the tee) ---------------- */
  const signs = [];
  [50, 100, 150, 200, 250].forEach(yd => {
    for (const side of [-1, 1]) {
      // spread by angle from the tee so near signs never hide far ones, and clear of the side panels
      const z = -yd * YD, ang = { 50: 24, 100: 20, 150: 16.5, 200: 14, 250: 12 }[yd] * Math.PI / 180;
      const x = side * Math.tan(ang) * (-z + 5.5), d = Math.hypot(x, z), k = 0.8 + d / 150, y = groundAt(x, z);
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(-x, 4 - z); g.scale.setScalar(k); scene.add(g);
      for (const px of [-1.1, 1.1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), woodDark); post.position.set(px, 1.3, -0.05); g.add(post); }
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.75), new THREE.MeshBasicMaterial({ map: signTexture(String(yd), 'YARDS', { bg: '#1e1612', fg: '#ffd9a0' }), toneMapped: false, color: 0xb8b0a0 }));
      board.position.y = 2.3; g.add(board);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.25), basic(0xffe0b0)); lamp.position.set(0, 3.3, 0.25); g.add(lamp);
      const lg = glowSprite(0xffc070, 2.2, { opacity: 0.55 }); lg.position.set(0, 3.25, 0.4); g.add(lg);
      signs.push({ board, text: String(yd) });
    }
  });

  /* ---------------- animation ---------------- */
  let lastClock = 0, nextBolt = 14 + R() * 12, bolt = null, sparkNext = 9 + R() * 10;
  const hemiBase = st.hemi.intensity;
  const api = {
    ...st, groundAt, surfaceAt, setFenceDamage, crows, addFire,
    onThunder: null, onSpark: null,
    flashFog(at, k) { fogU.uFlash.value.set(at.x, at.z, 0, Math.max(fogU.uFlash.value.w, k)); },
    animate(clock) {
      const dt = Math.min(0.1, Math.max(0, clock - lastClock)); lastClock = clock;
      skyU.uT.value = clock; fogU.uT.value = clock;
      stepPuffs(dt);
      fogU.uFlash.value.w *= Math.exp(-5 * dt);
      for (const c of crows) { c.userData.head.position.y = 0.1 + 0.02 * Math.max(0, Math.sin(clock * 3 + c.userData.ph * 3)); c.rotation.y += Math.sin(clock * 0.5 + c.userData.ph) * 0.002; }
      // the far floodlight is on its last legs
      for (const f of floods) {
        const k = f.flicker ? (hash2(Math.floor(clock * 12), 7) < 0.16 ? 0.12 : hash2(Math.floor(clock * 3), 9) < 0.08 ? 0.5 : 1) : 1;
        f.L.intensity = f.base * k; f.lamps.forEach(l => l.material.color.setScalar(0.25 + 0.75 * k)); f.gl.material.opacity = k; f.beam.material.uniforms.uK.value = k;
        floodU[floods.indexOf(f)].w = k;
      }
      // pools and fires flicker
      for (const p of pools) if (p.base) p.v.w = p.base * (1 - p.flick * (0.5 + 0.5 * Math.sin(clock * 11 + p.v.x) * Math.sin(clock * 7.3 + p.v.y)));
      porchPool.v.w = hash2(Math.floor(clock * 9), 4) < 0.12 ? 0.1 : 0.9; porchLamp.material.color.setScalar(porchPool.v.w > 0.5 ? 1 : 0.2); porchGlow.material.opacity = porchPool.v.w;
      litWin.material.color.setRGB(1, 0.6, 0.23).multiplyScalar(0.7 + 0.3 * Math.sin(clock * 1.3) * Math.sin(clock * 2.9));
      loft.material.color.setRGB(1, 0.62, 0.25).multiplyScalar(0.55 + 0.3 * Math.sin(clock * 9) * Math.sin(clock * 5.1));
      lanPool.v.w = 0.6 + 0.25 * Math.sin(clock * 1.7); lanGlow.material.opacity = 0.6 + 0.3 * Math.sin(clock * 1.7);
      trLight.intensity = 2.6 + 1.0 * Math.sin(clock * 13) * Math.sin(clock * 7.7);
      for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i]; f.age += dt;
        const fade = f.life === Infinity ? 1 : Math.max(0, 1 - f.age / f.life);
        f.acc += f.rate * fade * dt; while (f.acc >= 1) { f.acc--; emit(f.x, f.y, f.z, f.size, f.rise); }
        if (f.smoke) { f.smokeAcc += f.smoke * dt; while (f.smokeAcc >= 1) { f.smokeAcc--; puff(f.x, f.y + f.size, f.z, f.size * 2.2); } }
        f.glow.scale.setScalar(f.glowSize * (0.85 + 0.15 * Math.sin(clock * 13 + i)) * (0.3 + 0.7 * fade)); f.glow.material.opacity = 0.7 * fade;
        if (f.dyn) f.pool.v.w = f.pool.base * fade * (0.8 + 0.2 * Math.sin(clock * 15));
        if (fade <= 0) { scene.remove(f.glow); f.glow.material.dispose(); if (f.dyn) { f.dyn.busy = null; f.pool.base = 0; f.pool.v.w = 0; } fires.splice(i, 1); }
      }
      for (let i = 0; i < FIRE_CAP; i++) { if (fLife[i] <= 0) continue; fLife[i] -= dt / fMax[i]; fPos[i * 3] += fVel[i * 3] * dt; fPos[i * 3 + 1] += fVel[i * 3 + 1] * dt; fPos[i * 3 + 2] += fVel[i * 3 + 2] * dt; }
      fGeo.attributes.position.needsUpdate = true; fGeo.attributes.aLife.needsUpdate = true; fGeo.attributes.aSize.needsUpdate = true;
      for (let i = 0; i < SM_CAP; i++) { if (smLife[i] <= 0) continue; smLife[i] -= dt / 4.5; smPos[i * 3] += smVel[i * 3] * dt; smPos[i * 3 + 1] += smVel[i * 3 + 1] * dt; smPos[i * 3 + 2] += smVel[i * 3 + 2] * dt; }
      smGeo.attributes.position.needsUpdate = true; smGeo.attributes.aLife.needsUpdate = true; smGeo.attributes.aSize.needsUpdate = true;
      const pr = renderer.getPixelRatio(), hpx = renderer.domElement.height; fireMat.uniforms.uScale.value = smokeMat.uniforms.uScale.value = hpx * 0.6 / pr * pr;
      // windmill
      hub.rotation.z = clock * (0.8 + 0.4 * Math.sin(clock * 0.13));
      // the transformer sparks now and then
      sparkNext -= dt;
      if (sparkNext <= 0) {
        sparkNext = 12 + R() * 16; spkT = 0.7; sparks.visible = true;
        for (let i = 0; i < SPK; i++) { spkPos.set([TX[0] - 0.5, txY + 0.6, TX[1]], i * 3); const a = R() * 6.28, s = 2 + R() * 6; spkVel.set([Math.cos(a) * s, 2 + R() * 5, Math.sin(a) * s], i * 3); }
        api.onSpark && api.onSpark();
      }
      if (spkT > 0) {
        spkT -= dt; for (let i = 0; i < SPK; i++) { spkVel[i * 3 + 1] -= 14 * dt; for (let k = 0; k < 3; k++) spkPos[i * 3 + k] += spkVel[i * 3 + k] * dt; }
        spkGeo.attributes.position.needsUpdate = true; sparkGlow.material.opacity = spkT > 0.4 ? (hash2(Math.floor(clock * 30), 2) < 0.5 ? 1 : 0.2) : spkT * 2;
        if (spkT <= 0) { sparks.visible = false; sparkGlow.material.opacity = 0; }
      }
      // bats cross the moon every so often
      batT -= dt;
      if (batT <= 0 && !batRun) { batRun = { t: 0, from: new THREE.Vector3().copy(moonDir).multiplyScalar(900).add(new THREE.Vector3(-400, -40, 0)), to: new THREE.Vector3().copy(moonDir).multiplyScalar(900).add(new THREE.Vector3(420, 60, 0)) }; bats.forEach(b => { b.s.visible = true; }); }
      if (batRun) {
        batRun.t += dt / 9; const p = new THREE.Vector3().lerpVectors(batRun.from, batRun.to, batRun.t);
        bats.forEach((b, i) => { b.s.position.copy(p).add(b.off).add(new THREE.Vector3(Math.sin(clock * 1.3 + i) * 8, Math.sin(clock * 2 + i * 2) * 5, 0)); b.s.scale.set(14, 7 * (0.35 + 0.65 * Math.abs(Math.sin(clock * 14 + b.ph))), 1); });
        if (batRun.t >= 1) { batRun = null; batT = 25 + R() * 25; bats.forEach(b => { b.s.visible = false; }); }
      }
      // distant lightning: a couple of flickers lighting the clouds, thunder a moment later
      nextBolt -= dt;
      if (nextBolt <= 0 && !bolt) {
        const az = (R() - 0.5) * 2.2; skyU.uFlashDir.value.set(Math.sin(az), 0.12 + R() * 0.1, -Math.cos(az)).normalize();
        bolt = { t: 0, seq: [0, 0.08, 0.18, 0.32].map(s => s + R() * 0.03) }; nextBolt = 24 + R() * 26;
        api.onThunder && api.onThunder(1.4 + R() * 1.8);
      }
      let flash = 0;
      if (bolt) {
        bolt.t += dt; for (const s of bolt.seq) { const u = bolt.t - s; if (u >= 0 && u < 0.07) flash = Math.max(flash, 1 - u / 0.07); }
        if (bolt.t > 0.6) bolt = null;
      }
      skyU.uFlash.value = flash; fogU.uSky.value = flash * 0.5; st.hemi.intensity = hemiBase + flash * 1.4;
    },
    refreshSigns() { for (const s of signs) { s.board.material.map.dispose(); s.board.material.map = signTexture(s.text, 'YARDS', { bg: '#1e1612', fg: '#ffd9a0' }); s.board.material.needsUpdate = true; } },
  };
  return api;
}
