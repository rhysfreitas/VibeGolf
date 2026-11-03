// Sunset Mesa — the Shape It scene. A mown fairway along the top of a red-rock mesa, cliffs
// dropping to a desert valley, buttes on the horizon and a pink-violet sunset behind the range.

import { createStage, fbm, rng, sstep, hash2, GLSL_NOISE, terrainMesh, signTexture } from '../../world/stage.js';

const YD = 0.9144;

export function createSunsetMesa(container) {
  const st = createStage(container, {
    turbidity: 10, rayleigh: 4, mie: 0.01, mieG: 0.88, elev: 2.2, az: 150,
    sunColor: 0xffa66b, sunInt: 2.1, exposure: 0.78, hemiSky: 0xd8b8e8, hemiGround: 0x7a4a32, hemiInt: 0.5,
    fogColor: 0xe0958a, fogNear: 450, fogFar: 4000,
  });
  const { scene, renderer } = st;

  // ---- terrain ----
  const MESA_END = -360;                                   // far rim of the mesa top
  const halfW = z => 50 + 0.05 * Math.max(0, -z) + 8 * (fbm(z / 90, 3) - 0.5); // mesa half-width
  const rimDist = (x, z) => {                              // >0 = metres beyond the mesa edge
    const side = Math.abs(x) - halfW(z);
    const back = MESA_END - z, front = z - 40;
    return Math.max(side, back, front);
  };
  function groundAt(x, z) {
    const r = rimDist(x, z);
    let h = 1.0 * (fbm(x / 45 + 7, z / 45) - 0.5) * sstep(-30, -80, z);           // gentle swales on top
    if (r > -6) {
      const drop = sstep(-6, 24, r + 6 * (fbm(x / 20, z / 20) - 0.5));
      h = h * (1 - drop) - drop * (150 + 30 * fbm(x / 140, z / 140));             // cliffs down to the valley
      // ledges in the cliff face
      if (r > 0 && r < 40) h += 10 * Math.sin(r * 0.35) * (1 - drop) * 0.5;
    }
    // valley floor rolls; buttes and distant mesas rise out of it
    const d = Math.hypot(x, z + 300);
    if (d > 420) {
      const far = sstep(420, 1400, d);
      const butte = Math.pow(sstep(0.58, 0.66, fbm(x / 520 + 11, z / 520 + 3)), 1) * (120 + 160 * far);
      h += butte * sstep(300, 600, r);
    }
    h += 260 * Math.exp(-((x - 900) ** 2 + (z + 2600) ** 2) / (2 * 420 * 420));   // big mesa on the horizon
    return h;
  }
  const surfaceAt = (x, z) => (rimDist(x, z) < -10 && Math.abs(x) < halfW(z) * 0.6 && z < 8 ? 'fairway' : rimDist(x, z) < 0 ? 'rough' : 'rough');

  const geo = terrainMesh(groundAt, { N: st.coarse ? 260 : 340, nearX: 140, farX: 3200, nearZ: 260, farZ: 3200, cz: -170 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, envMapIntensity: 0.55 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;' + GLSL_NOISE)
      .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float fine = mix(fb(p.xz*3.0), 0.5, smoothstep(25.0, 90.0, camD));
float mid = fb(p.xz*0.15);
// mown fairway down the middle of the mesa top
float hw = (50.0 + 0.05*max(0.0, -p.z)) * 0.6;
float edgeN = (fb(p.xz*0.05)-0.5)*8.0;
float onTop = smoothstep(-8.0, -2.0, p.y);
float inFair = (1.0 - smoothstep(hw - 2.0 + edgeN, hw + 2.0 + edgeN, abs(p.x))) * smoothstep(-370.0, -350.0, p.z) * (1.0 - smoothstep(6.0, 12.0, p.z)) * onTop;
float stripe = step(0.5, fract(-p.z / 14.0));
vec3 fair = mix(lin(vec3(0.33,0.52,0.2)), lin(vec3(0.4,0.6,0.24)), stripe) * (0.9 + 0.18*mid) * (0.92 + 0.16*fine);
vec3 desert = mix(lin(vec3(0.72,0.56,0.36)), lin(vec3(0.62,0.5,0.3)), mid) * (0.82 + 0.3*fine);
desert = mix(desert, lin(vec3(0.42,0.44,0.24)) * (0.8+0.4*fine), smoothstep(0.55, 0.7, fb(p.xz*0.09)) * 0.75);   // scrub
vec3 col = mix(desert, fair, inFair);
// red rock cliffs with horizontal strata where the ground is steep
float steep = 1.0 - smoothstep(0.55, 0.82, vWN.y);
float strata = 0.5 + 0.5*sin(p.y*0.55 + fb(p.xz*0.03)*5.0 + fb(vec2(p.x+p.z, p.y)*0.15)*2.0);
vec3 rock = mix(lin(vec3(0.66,0.3,0.18)), lin(vec3(0.82,0.48,0.3)), strata) * (0.82 + 0.25*fb(vec2(p.x+p.z, p.y)*0.08));
rock = mix(rock, lin(vec3(0.48,0.2,0.13)), smoothstep(0.6, 0.8, fb(vec2(p.x*0.4+p.z*0.4, p.y*0.05))) * 0.6);   // desert varnish streaks
col = mix(col, rock, steep);
// valley floor: warmer, dustier
col = mix(col, mix(lin(vec3(0.78,0.5,0.32)), lin(vec3(0.64,0.4,0.26)), mid) * (0.9 + 0.2*fine), smoothstep(-60.0, -120.0, p.y) * (1.0 - steep));
diffuseColor.rgb = col;
`);
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  // ---- props: tee box, distance flags, junipers, saguaros, boulders ----
  const R = rng(17), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
  const tee = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 4), new THREE.MeshStandardMaterial({ color: 0x4f8a3a, roughness: 0.95 }));
  tee.position.set(0, 0.0, 0.8); tee.receiveShadow = true; scene.add(tee);
  for (const dx of [-2, 2]) { const tm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.4 })); tm.position.set(dx, 0.07, -0.8); scene.add(tm); }

  const flags = [], signs = [];
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8); poleGeo.translate(0, 1.6, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.5 });
  [50, 100, 150, 200, 250, 300].forEach((yd, i) => {
    const z = -yd * YD, x = (i % 2 ? 1 : -1) * (halfW(z) * 0.55 + 6);
    const y = groundAt(x, z);
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.set(x, y, z); pole.castShadow = true; scene.add(pole);
    const fg = new THREE.PlaneGeometry(1.0, 0.65, 12, 6); fg.translate(0.5, 0, 0);
    const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0xff7a3c, roughness: 0.75, side: THREE.DoubleSide }));
    flag.position.set(x + 0.03, y + 2.85, z); flag.userData.base = Float32Array.from(fg.attributes.position.array); flag.userData.phase = i * 1.3;
    flag.castShadow = true; scene.add(flag); flags.push(flag);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: signTexture(String(yd), 'YARDS', { bg: '#5a2618', fg: '#fbe9d6' }), roughness: 0.8 }));
    board.position.set(x + (x > 0 ? 2.2 : -2.2), y + 1.4, z); board.rotation.y = Math.atan2(-board.position.x, -board.position.z) + Math.PI; board.castShadow = true; scene.add(board);
    signs.push({ board, text: String(yd) });
  });

  // junipers: dark rounded shrubs along the mesa edges and scattered on top
  const shrubs = [];
  for (let i = 0; i < 2600 && shrubs.length < 260; i++) {
    const z = 30 - R() * 420, x = (R() - 0.5) * 2 * (halfW(z) + 10), r = rimDist(x, z);
    if (r > -1 || (Math.abs(x) < halfW(z) * 0.6 + 4 && z < 10 && z > -360)) continue;
    if (Math.hypot(x, z) < 12) continue;
    if (r < -18 && R() < 0.6) continue;
    shrubs.push({ x, z, s: 0.6 + R() * 1.1 });
  }
  const blob = new THREE.IcosahedronGeometry(1, 2);
  { const p = blob.attributes.position, nr = blob.attributes.normal; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + (hash2(Math.round(v.x * 50), Math.round(v.y * 50 + v.z * 30)) - 0.5) * 0.35; p.setXYZ(i, v.x * n, v.y * n * 0.75, v.z * n); v.normalize(); nr.setXYZ(i, v.x, v.y, v.z); } }
  const shrubMesh = new THREE.InstancedMesh(blob, new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.4 }), shrubs.length * 2);
  let k = 0;
  shrubs.forEach(s => {
    const y = groundAt(s.x, s.z);
    for (let b = 0; b < 2; b++) {
      const bs = s.s * (b ? 0.7 : 1.1) * 1.4;
      m4.compose(ps.set(s.x + (b ? R() - 0.5 : 0) * s.s, y + bs * 0.5, s.z + (b ? R() - 0.5 : 0) * s.s), q.setFromEuler(new THREE.Euler(0, R() * 6, 0)), sc.set(bs, bs * 0.8, bs));
      shrubMesh.setMatrixAt(k, m4); c.set(0x3d4a2a).offsetHSL((R() - 0.5) * 0.04, (R() - 0.5) * 0.1, (R() - 0.5) * 0.06); shrubMesh.setColorAt(k, c); k++;
    }
  });
  shrubMesh.castShadow = shrubMesh.receiveShadow = true; scene.add(shrubMesh);

  // saguaros: trunk plus one or two arms
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.8 });
  const trunkGeo = new THREE.CapsuleGeometry ? new THREE.CapsuleGeometry(0.32, 1, 4, 10) : new THREE.CylinderGeometry(0.32, 0.32, 1, 10);
  const parts = [];
  for (let i = 0; i < 400 && parts.length < 150; i++) {
    const z = 20 - R() * 400, x = (R() - 0.5) * 2 * halfW(z), r = rimDist(x, z);
    if (r > -4 || r < -30 || Math.abs(x) < halfW(z) * 0.6 + 8) continue;
    const H = 4 + R() * 4, y = groundAt(x, z);
    parts.push([x, y + H / 2, z, 1, H, 0]);
    const arms = 1 + (R() < 0.5);
    for (let a = 0; a < arms; a++) {
      const sd = a ? -1 : 1, ay = y + H * (0.45 + R() * 0.2), ah = H * (0.25 + R() * 0.15), off = 0.75;
      parts.push([x + sd * off * 0.6, ay, z, 0.75, 0.9, sd * Math.PI / 2]);        // elbow
      parts.push([x + sd * off, ay + ah / 2, z, 0.75, ah, 0]);                       // upright arm
    }
  }
  const cactus = new THREE.InstancedMesh(trunkGeo, cactusMat, parts.length);
  parts.forEach((pp, i) => { m4.compose(ps.set(pp[0], pp[1], pp[2]), q.setFromEuler(new THREE.Euler(0, 0, pp[5])), sc.set(pp[3], pp[4], pp[3])); cactus.setMatrixAt(i, m4); });
  cactus.castShadow = true; scene.add(cactus);

  // boulders: red sandstone, more of them near the rim
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const n = 1 + (hash2(Math.round(v.x * 40) + 3, Math.round(v.y * 40 - v.z * 25)) - 0.5) * 0.4; p.setXYZ(i, v.x * n, v.y * n * 0.65, v.z * n); } rockGeo.computeVertexNormals(); }
  const rocks = [];
  for (let i = 0; i < 3000 && rocks.length < 300; i++) {
    const z = 30 - R() * 430, x = (R() - 0.5) * 2 * (halfW(z) + 30), r = rimDist(x, z);
    if (r > 6 || (Math.abs(x) < halfW(z) * 0.6 + 4 && r < -5)) continue;
    rocks.push({ x, z, s: 0.5 + R() ** 2 * 3 });
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, envMapIntensity: 0.5 }), rocks.length);
  rocks.forEach((r, i) => { m4.compose(ps.set(r.x, groundAt(r.x, r.z) + r.s * 0.1, r.z), q.setFromEuler(new THREE.Euler(R(), R() * 6, R())), sc.set(r.s * (1 + R() * 0.5), r.s, r.s)); rockMesh.setMatrixAt(i, m4); c.setRGB(0.62, 0.32, 0.2).offsetHSL(0, 0, (R() - 0.5) * 0.1); rockMesh.setColorAt(i, c); });
  rockMesh.castShadow = rockMesh.receiveShadow = true; scene.add(rockMesh);

  return {
    ...st, groundAt, surfaceAt, flags,
    animate(clock) {
      for (const fl of flags) {
        const p = fl.geometry.attributes.position, b = fl.userData.base, ph = fl.userData.phase;
        for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(x * 6 - clock * 4.5 + ph) * 0.08 * x + Math.sin(x * 3 + clock * 2 + ph) * 0.04 * x); }
        p.needsUpdate = true; fl.geometry.computeVertexNormals();
      }
    },
    refreshSigns() { for (const s of signs) { s.board.material.map.dispose(); s.board.material.map = signTexture(s.text, 'YARDS', { bg: '#5a2618', fg: '#fbe9d6' }); s.board.material.needsUpdate = true; } },
  };
}
