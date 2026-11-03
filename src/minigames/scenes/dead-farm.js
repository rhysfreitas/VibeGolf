// Dead farm at dusk — the Zombie Siege scene. A dead-grass field with chalk yard lines, your
// fence just ahead, a sagging barn and silo, bare trees, a cornfield the horde walks out of,
// a blood-orange moon, ground fog, crows on the fence and floodlights (one of them flickers).

import { createStage, fbm, rng, sstep, hash2, GLSL_NOISE, terrainMesh, signTexture } from '../../world/stage.js';
import { FENCE_Z, YD } from '../zombie-logic.js';

export function createDeadFarm(container) {
  const st = createStage(container, {
    turbidity: 12, rayleigh: 1.1, mie: 0.02, mieG: 0.9, elev: 1.2, az: 205,
    sunColor: 0xff9466, sunInt: 1.9, exposure: 0.72, hemiSky: 0x8f8cb0, hemiGround: 0x3e3628, hemiInt: 1.0,
    fogColor: 0x59605c, fogNear: 140, fogFar: 1150,
  });
  const { scene } = st;
  const R = rng(66), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();

  // ---- ground: flat field, low hills around it ----
  const CORN = [-258, -335];
  function groundAt(x, z) {
    let h = 0.35 * (fbm(x / 30 + 3, z / 30) - 0.5);
    const out = Math.max(Math.abs(x) - 85, -360 - z, z - 40, 0);
    if (out > 0) h += sstep(0, 120, out) * (6 + 40 * fbm(x / 160, z / 160 + 4)) + out * 0.04;
    return h;
  }
  const surfaceAt = () => 'rough';
  const geo = terrainMesh(groundAt, { N: st.coarse ? 240 : 300, nearX: 140, farX: 2600, nearZ: 230, farZ: 2600, cz: -160 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, envMapIntensity: 0.4 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE)
      .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float fine = mix(fb(p.xz*2.6), 0.5, smoothstep(20.0, 80.0, camD));
float mid = fb(p.xz*0.12), big = fb(p.xz*0.02 + 7.0);
vec3 grass = mix(lin(vec3(0.46,0.42,0.26)), lin(vec3(0.36,0.36,0.21)), mid) * (0.78 + 0.42*fine);
vec3 dirt = lin(vec3(0.4,0.32,0.22)) * (0.8 + 0.35*fine);
vec3 c = mix(grass, dirt, smoothstep(0.55, 0.72, fb(p.xz*0.07)) * 0.8);
// ploughed rows under the corn
float corn = smoothstep(${CORN[0] + 6}.0, ${CORN[0] - 4}.0, p.z) * (1.0 - smoothstep(85.0, 95.0, abs(p.x)));
c = mix(c, dirt * (0.75 + 0.35*step(0.5, fract(p.x/1.4))), corn);
// chalk yard lines every 25 yd and a dashed centre line
float yd = -p.z / 0.9144;
float fade = 1.0 - smoothstep(120.0, 420.0, camD);
float lineW = 0.32 / 0.9144 * (1.0 + camD/120.0);
float onField = step(abs(p.x), 62.0) * step(30.0, yd) * step(yd, 290.0);
float yl = (1.0 - smoothstep(0.0, lineW, abs(mod(yd + 12.5, 25.0) - 12.5))) * onField * (0.55 + 0.45*fb(p.xz*0.6));
float cl = (1.0 - smoothstep(0.12, 0.12 + 0.02*camD, abs(p.x))) * step(0.5, fract(yd / 4.0)) * onField * 0.7;
c = mix(c, lin(vec3(0.82,0.82,0.76)), max(yl, cl) * fade);
// hills: darker, scrubby
c = mix(c, lin(vec3(0.2,0.2,0.14)) * (0.8 + 0.3*big), smoothstep(1.5, 8.0, p.y));
diffuseColor.rgb = c;
`);
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  // ---- moon ----
  const moonTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128); gr.addColorStop(0, 'rgba(255,170,90,0.9)'); gr.addColorStop(0.36, 'rgba(255,120,60,0.35)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#ffb070'; g.beginPath(); g.arc(128, 128, 44, 0, 7); g.fill();
    for (let i = 0; i < 40; i++) { const a = i * 2.4, r = 30 * Math.sqrt(i / 40); g.fillStyle = `rgba(200,100,55,${0.05 + 0.08 * ((i * 7) % 5) / 5})`; g.beginPath(); g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 5 + (i % 4) * 2, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, transparent: true, toneMapped: false }));
  moon.position.set(-520, 320, -2600); moon.scale.set(900, 900, 1); scene.add(moon);

  // ---- fence (with damage stages) ----
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a5641, roughness: 1 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 1 });
  const fence = new THREE.Group(); scene.add(fence);
  const pickets = [];
  for (let x = -60; x <= 60; x += 3) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), woodDark); post.position.set(x, 0.5, FENCE_Z); post.castShadow = true; fence.add(post);
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
    pickets.forEach((p, i) => {
      const t = i / pickets.length;
      p.visible = t >= f * 0.75;
      p.rotation.x = t < f ? p.userData.tilt * 0.4 : 0;
    });
  }

  // ---- crows on the fence ----
  const crowMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 });
  const crows = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group(), x = -50 + R() * 100;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), crowMat); body.scale.set(1, 0.9, 1.6); c.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), crowMat); head.position.set(0, 0.1, 0.15); c.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0x2a2620 })); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.1, 0.24); c.add(beak);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.18), crowMat); tail.position.set(0, 0.02, -0.2); tail.rotation.x = 0.4; c.add(tail);
    c.position.set(x, 0.92, FENCE_Z + 0.06); c.rotation.y = R() * Math.PI * 2; c.userData = { head, ph: R() * 6 };
    scene.add(c); crows.push(c);
  }

  // ---- barn and silo ----
  const barnRed = new THREE.MeshStandardMaterial({ color: 0x5a2420, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.9 });
  const barn = new THREE.Group(); barn.position.set(-78, groundAt(-78, -95), -95); barn.rotation.y = 0.35; scene.add(barn);
  const bodyB = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 22), barnRed); bodyB.position.y = 4.5; bodyB.castShadow = bodyB.receiveShadow = true; barn.add(bodyB);
  const roofShape = new THREE.Shape(); roofShape.moveTo(-8.6, 0); roofShape.lineTo(0, 6.5); roofShape.lineTo(8.6, 0); roofShape.lineTo(-8.6, 0);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 23, bevelEnabled: false }), roofMat); roof.position.set(0, 9, -11.5); roof.rotation.z = 0.04; roof.castShadow = true; barn.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(6, 6.5), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 })); door.position.set(0, 3.25, 11.02); barn.add(door);
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 18, 20), new THREE.MeshStandardMaterial({ color: 0x5d5a52, roughness: 0.8, metalness: 0.2 })); silo.position.set(-98, 9, -118); silo.castShadow = true; scene.add(silo);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), silo.material); dome.position.set(-98, 18, -118); scene.add(dome);

  // ---- scarecrow ----
  const scare = new THREE.Group(); scare.position.set(64, 0, -150); scene.add(scare);
  const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 6), woodDark); sPost.position.y = 1.7; scare.add(sPost);
  const sArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), woodDark); sArm.rotation.z = Math.PI / 2; sArm.position.y = 2.6; scare.add(sArm);
  const sCoat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 7), new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 1 })); sCoat.position.y = 2.1; scare.add(sCoat);
  const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 })); sHead.position.y = 3.1; scare.add(sHead);
  const sHat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 10), roofMat); sHat.position.y = 3.5; scare.add(sHat);
  scare.traverse(o => { if (o.isMesh) o.castShadow = true; });

  // ---- bare dead trees ----
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x2e2822, roughness: 1 });
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
  for (let i = 0; i < 60; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (70 + R() * 70), z = 20 - R() * 380; if (Math.hypot(x + 78, z + 95) < 25 || Math.hypot(x + 98, z + 118) < 10) continue; tree(x, z, 0.8 + R() * 0.7); }
  for (let i = 0; i < 25; i++) tree((R() - 0.5) * 220, -345 - R() * 60, 1 + R() * 0.6);
  const trees = new THREE.InstancedMesh(limb, barkMat, limbs.length);
  limbs.forEach((L, i) => { q.setFromEuler(new THREE.Euler(L[5] * Math.sin(L[6]), L[7], L[5] * Math.cos(L[6]))); m4.compose(ps.set(L[0], L[1], L[2]), q, sc.set(L[3], L[4], L[3])); trees.setMatrixAt(i, m4); });
  trees.castShadow = true; scene.add(trees);

  // ---- cornfield ----
  const stalkGeo = new THREE.ConeGeometry(0.22, 1, 4, 1); stalkGeo.translate(0, 0.5, 0);
  const stalks = [];
  for (let z = CORN[0]; z > CORN[1]; z -= 1.15) for (let x = -88; x <= 88; x += 1.4) { if (R() < 0.12) continue; stalks.push([x + (R() - 0.5) * 0.5, z + (R() - 0.5) * 0.6, 1.9 + R() * 0.9]); }
  const corn = new THREE.InstancedMesh(stalkGeo, new THREE.MeshStandardMaterial({ roughness: 1, envMapIntensity: 0.3 }), stalks.length);
  stalks.forEach((s, i) => { q.setFromEuler(new THREE.Euler((R() - 0.5) * 0.18, R() * 6, (R() - 0.5) * 0.18)); m4.compose(ps.set(s[0], groundAt(s[0], s[1]) - 0.1, s[1]), q, sc.set(1, s[2], 1)); corn.setMatrixAt(i, m4); col.setRGB(0.55, 0.46, 0.27).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.1, (R() - 0.5) * 0.12); corn.setColorAt(i, col); });
  corn.receiveShadow = true; scene.add(corn);

  // ---- yard flags every 50 yd ----
  const signs = [];
  [50, 100, 150, 200, 250].forEach((yd, i) => {
    for (const side of [-1, 1]) {
      const x = side * 64, z = -yd * YD, y = groundAt(x, z);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), woodDark); post.position.set(x, y + 1.2, z); post.castShadow = true; scene.add(post);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: signTexture(String(yd), 'YARDS', { bg: '#2a201a', fg: '#e8dcc0' }), roughness: 0.9 }));
      board.position.set(x - side * 0.1, y + 2.2, z); board.rotation.y = Math.atan2(-x, -z) + Math.PI; scene.add(board); signs.push({ board, text: String(yd) });
    }
  });

  // ---- floodlights (one flickers) ----
  const lamps = [];
  for (const [x, z] of [[-58, FENCE_Z + 4], [58, FENCE_Z + 4], [66, -120]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 14, 8), new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.7, metalness: 0.4 })); pole.position.set(x, 7, z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff1c8, toneMapped: false })); head.position.set(x, 14, z); head.lookAt(x * 0.2, 0, z - 80); scene.add(head);
    const L = new THREE.SpotLight(0xffe2b0, 4, 320, 0.75, 0.55, 1.0); L.position.set(x, 14, z); L.target.position.set(x * 0.15, 0, z - 90); scene.add(L, L.target);
    lamps.push({ head, L, base: 4 });
  }

  // ---- ground fog ----
  const fogMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0x8a948c) } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec3 vW; uniform float uT; uniform vec3 uC;
      ${GLSL_NOISE}
      void main(){ vec2 p = vW.xz * 0.025 + vec2(uT * 0.02, uT * 0.007);
        float n = fb(p + fb(p * 0.6 + uT * 0.01));
        float a = smoothstep(0.42, 0.78, n) * 0.28 * (1.0 - smoothstep(250.0, 700.0, length(vW.xz)));
        gl_FragColor = vec4(lin(uC), a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  for (const y of [0.5, 1.4]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), fogMat); f.position.set(0, y, -250); f.renderOrder = 1; scene.add(f); }

  return {
    ...st, groundAt, surfaceAt, setFenceDamage, crows,
    animate(clock) {
      fogMat.uniforms.uT.value = clock;
      for (const c of crows) { c.userData.head.position.y = 0.1 + 0.02 * Math.max(0, Math.sin(clock * 3 + c.userData.ph * 3)); c.rotation.y += Math.sin(clock * 0.5 + c.userData.ph) * 0.002; }
      // the far floodlight flickers like it's on its last legs
      const f = lamps[2], flick = hash2(Math.floor(clock * 14), 7) < 0.18 ? 0.15 : 1;
      f.L.intensity = f.base * flick; f.head.material.color.setScalar(flick > 0.5 ? 1 : 0.3);
    },
    refreshSigns() { for (const s of signs) { s.board.material.map.dispose(); s.board.material.map = signTexture(s.text, 'YARDS', { bg: '#2a201a', fg: '#e8dcc0' }); s.board.material.needsUpdate = true; } },
  };
}
