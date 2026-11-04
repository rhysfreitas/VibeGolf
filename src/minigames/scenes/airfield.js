// The Airfield — the Wedge Ladder scene. A vintage airstrip at sunrise: you hit from the grass at
// the runway threshold, and each rung of the ladder is a landing zone painted across the runway
// with a giant runway-style number. The rung you're on glows and its edge lights come on. Around it:
// a control tower with a turning beacon, hangars, a biplane by the tee, a windsock, taxiway-style
// yardage signs and hot-air balloons drifting in the morning haze. The runway is dead flat, so the
// numbers are true carries.
//
// API: setBands(diff, rung, best) · markLanding(x, z, ok) · clearMarks() · animate(clock, dt)

import { createStage, fbm, rng, sstep, GLSL_NOISE, terrainMesh } from '../../world/stage.js';
import { YD, LATERAL_YD } from '../wedge-logic.js';

const RW = LATERAL_YD * YD;   // runway half-width (m)
const RZ0 = 18, RZ1 = -420;    // runway from behind you to far downrange

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}
const glowTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);

export function createAirfield(container) {
  const st = createStage(container, {
    turbidity: 6, rayleigh: 2.2, mie: 0.006, mieG: 0.85, elev: 6, az: 200,
    sunColor: 0xffc890, sunInt: 1.9, exposure: 0.58, hemiSky: 0xb8c4ec, hemiGround: 0x6a5a40, hemiInt: 0.5,
    fogColor: 0xe6cdb8, fogNear: 260, fogFar: 1700, shadowBox: 130,
  });
  const { scene } = st;
  const R = rng(77), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const glow = (c, s, o = {}) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, ...o })); sp.scale.setScalar(s); return sp; };

  /* ---------------- ground: runway, taxiway, apron, dewy grass ---------------- */
  function groundAt(x, z) {
    const out = Math.max(Math.abs(x) - 300, -z - 700, z - 160, 0);
    return out > 0 ? sstep(0, 220, out) * (14 + 50 * fbm(x / 260, z / 260)) : 0;
  }
  const surfaceAt = (x, z) => (Math.abs(x) < RW + 1 && z < RZ0 && z > RZ1 ? 'fairway' : 'rough');
  const geo = terrainMesh(groundAt, { N: st.coarse ? 200 : 260, nearX: 170, farX: 2600, nearZ: 300, farZ: 2600, cz: -120 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <map_fragment>', `
vec3 p = vWPos; float camD = length(cameraPosition - p);
float far = smoothstep(30.0, 140.0, camD), px = max(0.02, camD * 0.0014);
float fine = mix(fb(p.xz * 2.4), 0.5, far);
// grass: dewy, mown in wide stripes along the runway
vec3 grass = mix(lin(vec3(0.34, 0.48, 0.2)), lin(vec3(0.28, 0.42, 0.17)), step(0.5, fract(p.x / 8.0)) * (1.0 - far * 0.6));
grass *= 0.8 + 0.35 * fine; grass *= 0.85 + 0.3 * fb(p.xz * 0.03);
// runway: weathered asphalt with patches, tyre marks, edge lines, centreline dashes, threshold keys
float onRW = step(abs(p.x), ${RW.toFixed(2)}) * step(p.z, ${RZ0.toFixed(1)}) * step(${RZ1.toFixed(1)}, p.z);
vec3 asph = lin(vec3(0.27, 0.27, 0.29)) * (0.75 + 0.45 * fine) * (0.85 + 0.3 * fb(p.xz * 0.06 + 2.0));
asph *= 1.0 - 0.25 * smoothstep(0.55, 0.7, fb(vec2(p.x * 0.25, p.z * 0.02) + 5.0)) * (1.0 - smoothstep(4.0, 9.0, abs(p.x))); // tyre-darkened touchdown lanes
float edge = 1.0 - smoothstep(0.25, 0.25 + px, abs(abs(p.x) - ${(RW - 1).toFixed(2)}));
float centre = (1.0 - smoothstep(0.2, 0.2 + px, abs(p.x))) * step(0.45, fract(p.z / 12.0)) * step(p.z, -26.0);
float keys = step(10.0, p.z) * step(p.z, 16.0) * step(0.5, fract((p.x + ${RW.toFixed(2)}) / 3.0)) * step(abs(p.x), ${(RW - 2.5).toFixed(2)});
float paint = max(max(edge, centre), keys) * (0.75 + 0.25 * fb(p.xz * 3.0));
vec3 rw = mix(asph, lin(vec3(0.9, 0.9, 0.86)), paint * (1.0 - far * 0.3));
// taxiway and apron to the hangars (right) and the tower (left)
float taxi = step(${RW.toFixed(1)}, p.x) * step(p.x, 95.0) * step(abs(p.z + 70.0), 7.0) + step(55.0, p.x) * step(p.x, 110.0) * step(-135.0, p.z) * step(p.z, -20.0);
taxi = min(1.0, taxi) * (1.0 - onRW);
float taxiLine = (1.0 - smoothstep(0.15, 0.15 + px, abs(p.z + 70.0))) * step(${RW.toFixed(1)}, p.x) * step(p.x, 60.0);
vec3 tx = mix(asph * 1.05, lin(vec3(0.85, 0.7, 0.2)), taxiLine);
vec3 c = mix(mix(grass, tx, taxi), rw, onRW);
c = mix(c, lin(vec3(0.25, 0.32, 0.18)) * (0.8 + 0.3 * fb(p.xz * 0.01)), smoothstep(1.0, 12.0, p.y));
diffuseColor.rgb = c;
float rough = mix(mix(0.95, 0.85, taxi), 0.8, onRW);
`);
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  // the runway number at the threshold, stretched lengthwise like the real thing
  const numTex = (text, colr = 'rgba(240,240,232,0.92)') => canvasTex(256, 256, (g, w, h) => { g.fillStyle = colr; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 200px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(text, w / 2, h / 2 + 10); });
  const decal = (tex, w, l, opacity = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 })); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m; };

  /* ---------------- landing bands (one per rung; rebuilt per player's difficulty) ---------------- */
  const bandGroup = new THREE.Group(); scene.add(bandGroup);
  const bandU = []; let bands = [];
  const bandMat = (k) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uState: { value: 0 }, uOn: { value: 0 }, uLen: { value: 1 }, uW: { value: RW * 2 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uState, uOn, uLen, uW;
      void main(){
        // uState: 0 ahead (white), 1 reached (green), 2 the rung you're on (amber, glowing)
        vec3 cWhite = vec3(0.92, 0.92, 0.88), cGreen = vec3(0.35, 0.95, 0.5), cAmber = vec3(1.0, 0.72, 0.25);
        vec3 c = uState > 1.5 ? cAmber : uState > 0.5 ? cGreen : cWhite;
        float along = vUv.y * uLen, toEnd = min(along, uLen - along);
        float bar = 1.0 - smoothstep(0.55, 0.75, toEnd);                     // the band's two edge bars
        float side = 1.0 - smoothstep(0.0, 0.6, min(vUv.x, 1.0 - vUv.x) * uW);
        float chev = step(0.5, fract(vUv.x * uW / 3.0 + vUv.y * uLen / 3.0 - uT * 0.8 * uOn)) * 0.5; // a slow chase across the live band
        float fill = 0.1 + 0.12 * uOn + chev * 0.08 * uOn;
        float a = max(bar * (0.85 + 0.15 * uOn), max(side * 0.5, fill)) * (uOn > 0.5 ? 0.75 + 0.25 * sin(uT * 3.0) : 0.55);
        gl_FragColor = vec4(c * (1.0 + 0.9 * uOn), a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  // runway edge lights: a row each side every 20 m (dim), plus the live band's own lights
  const edgeLights = []; for (let z = RZ0 - 6; z > RZ1; z -= 20) for (const sx of [-1, 1]) edgeLights.push([sx * (RW + 0.6), z]);
  const NROW = Math.floor((RW * 2) / 2.2) + 1, NBL = NROW * 2; // the live band: a row of lights across each edge (green near, red far)
  const lightGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const elM = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), edgeLights.length);
  edgeLights.forEach(([x, z], i) => { m4.makeTranslation(x, 0.35, z); elM.setMatrixAt(i, m4); elM.setColorAt(i, col.set(0xfff2d0).multiplyScalar(0.7)); });
  scene.add(elM);
  const elPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 5), std(0x9a9a9a), edgeLights.length);
  edgeLights.forEach(([x, z], i) => { m4.makeTranslation(x, 0.17, z); elPost.setMatrixAt(i, m4); }); scene.add(elPost);
  const blM = new THREE.InstancedMesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NBL); blM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(blM);
  const blGlows = Array.from({ length: NBL }, () => { const g = glow(0xffb040, 1.6, { opacity: 0.8 }); scene.add(g); return g; });
  const floatNum = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false, fog: false })); scene.add(floatNum);
  let live = null;
  function setBands(diff, rung, best) {
    // rebuild if the ladder changed (another player's difficulty)
    const key = diff.id;
    if (bandGroup.userData.key !== key) {
      bandGroup.userData.key = key;
      for (const b of bands) { bandGroup.remove(b.g); b.g.traverse(o => { if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } o.geometry && o.geometry.dispose(); }); }
      bands = diff.rungs.map((yd, i) => {
        const g = new THREE.Group(); g.position.set(0, 0.03, -yd * YD); bandGroup.add(g);
        const len = diff.band * 2 * YD;
        const m = bandMat(); m.uniforms.uLen.value = len;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(RW * 2 - 0.4, len), m); plane.rotation.x = -Math.PI / 2; plane.renderOrder = 2; g.add(plane);
        const num = decal(numTex(String(yd)), 7, 14 + yd * 0.12, 0.9); num.position.set(-RW * 0.55, 0.01, 0); num.renderOrder = 3; g.add(num);
        const num2 = num.clone(); num2.position.x = RW * 0.55; g.add(num2);
        return { g, m, yd, len };
      });
    }
    bands.forEach((b, i) => {
      b.m.uniforms.uState.value = i === rung ? 2 : i <= best ? 1 : 0;
      b.m.uniforms.uOn.value = i === rung ? 1 : 0;
      b.g.visible = true;
    });
    // the live band's lights: at both ends of the band, both sides of the runway
    const b = bands[rung]; live = b;
    let k = 0;
    for (const end of [1, -1]) for (let j = 0; j < NROW; j++) {
      const x = -RW + j * (RW * 2 / (NROW - 1)), z = b.g.position.z + end * b.len / 2;
      m4.compose(ps.set(x, 0.5, z), q.identity(), sc.set(1.3, 1.3, 1.3)); blM.setMatrixAt(k, m4); blGlows[k].position.set(x, 0.6, z);
      blGlows[k].material.color.set(end > 0 ? 0x5aff7a : 0xff4a3a); blGlows[k].userData = { near: end > 0, j }; k++;
    }
    blM.instanceMatrix.needsUpdate = true;
    // the target number floats over the zone
    const d = Math.abs(b.g.position.z) + 6;
    floatNum.material.map && floatNum.material.map.dispose();
    floatNum.material.map = numTex(String(b.yd), '#ffc04a'); floatNum.material.needsUpdate = true;
    floatNum.position.set(0, 1.6 + d * 0.012, b.g.position.z); floatNum.scale.setScalar(2 + d * 0.05);
  }

  /* ---------------- landing pins ---------------- */
  const marks = [];
  function markLanding(x, z, ok) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), std(0xeeeeee)); pole.position.y = 0.8; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), basic(ok ? 0x5aff8a : 0xff7a3a, { side: THREE.DoubleSide })); flag.geometry.translate(0.35, 0, 0); flag.position.y = 1.4; g.add(flag);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 28), basic(ok ? 0x5aff8a : 0xff7a3a, { transparent: true, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    g.userData = { t: 0, flag, ring }; marks.push(g);
    while (marks.length > 6) { const o = marks.shift(); scene.remove(o); }
  }
  function clearMarks() { while (marks.length) scene.remove(marks.pop()); }

  /* ---------------- yardage signs (taxiway style) along the left edge ---------------- */
  const signTex = t => canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2c31a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#f2c31a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 84px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(t, w / 2, h / 2 + 4); });
  for (let yd = 40; yd <= 130; yd += 10) {
    const z = -yd * YD, s = 1 + yd / 90, g = new THREE.Group(); g.position.set(-RW - 4, 0, z); g.rotation.y = Math.atan2(RW + 4, 6 - z) * 0.8; g.scale.setScalar(s); scene.add(g);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), new THREE.MeshBasicMaterial({ map: signTex(String(yd)), toneMapped: false, color: 0xcccccc })); panel.position.y = 1.0; g.add(panel);
    const box = new THREE.Mesh(B(2.1, 1.1, 0.25), std(0x222222)); box.position.set(0, 1.0, -0.14); g.add(box);
    for (const lx of [-0.8, 0.8]) { const leg = new THREE.Mesh(B(0.08, 0.5, 0.08), std(0x888888)); leg.position.set(lx, 0.25, -0.14); g.add(leg); }
    shadowed(g);
  }

  /* ---------------- control tower with a turning beacon ---------------- */
  const tower = new THREE.Group(); tower.position.set(-78, 0, -82); scene.add(tower);
  const conc = std(0xd8d0c0, { roughness: 0.9 });
  const shaft = new THREE.Mesh(B(7, 18, 7), conc); shaft.position.y = 9; tower.add(shaft);
  for (let y = 3; y < 17; y += 3.5) { const w = new THREE.Mesh(B(7.05, 0.8, 1.6), std(0x2a3440, { metalness: 0.5, roughness: 0.2 })); w.position.set(0, y, 2.8); tower.add(w); }
  const deck = new THREE.Mesh(B(11, 0.6, 11), conc); deck.position.y = 18.3; tower.add(deck);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a48, metalness: 0.6, roughness: 0.15, emissive: 0x3a2a10, emissiveIntensity: 0.6 })); cab.position.y = 20.6; tower.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.6, 8), conc); cabRoof.position.y = 22.9; tower.add(cabRoof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), std(0xaa2222)); mast.position.y = 25; tower.add(mast);
  const beacon = new THREE.Group(); beacon.position.y = 27.2; tower.add(beacon);
  const bG = glow(0x6aff8a, 6), bW = glow(0xffffff, 6); bG.position.x = 0.4; bW.position.x = -0.4; beacon.add(bG, bW);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10), basic(0xeaffea)); beacon.add(lens);
  shadowed(tower);
  // windsock
  const sock = new THREE.Group(); sock.position.set(-RW - 9, 0, -36); scene.add(sock);
  const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), std(0xdddddd)); sPole.position.y = 3; sock.add(sPole);
  const sockSegs = [];
  for (let i = 0; i < 5; i++) { const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.5 - i * 0.07, 0.5 - (i + 1) * 0.07, 0.8, 12, 1, true), std(i % 2 ? 0xffffff : 0xff6a1a, { side: THREE.DoubleSide, roughness: 0.7 })); seg.rotation.z = Math.PI / 2; seg.position.set(0.4 + i * 0.8, 5.8, 0); sock.add(seg); sockSegs.push(seg); }
  sock.rotation.y = -0.9; shadowed(sock);

  /* ---------------- hangars ---------------- */
  const corrugated = canvasTex(256, 64, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? '#9aa0a4' : '#c4c8ca'; g.fillRect(x, 0, 8, h); } });
  corrugated.wrapS = THREE.RepeatWrapping; corrugated.repeat.set(10, 1);
  for (const [x, z, n] of [[86, -46, '1'], [88, -110, '2']]) {
    const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = -Math.PI / 2; scene.add(h);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 30, 24, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ map: corrugated, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide }));
    shell.rotation.z = Math.PI / 2; shell.rotation.y = Math.PI / 2; h.add(shell);
    const backW = new THREE.Mesh(new THREE.CircleGeometry(12, 24, 0, Math.PI), std(0x8a8e92, { side: THREE.DoubleSide })); backW.position.z = -15; h.add(backW);
    const dark = new THREE.Mesh(new THREE.CircleGeometry(11.5, 24, 0, Math.PI), std(0x14161a)); dark.position.z = 12; h.add(dark);
    const numP = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: numTex(n, '#f2efe6'), transparent: true, roughness: 0.6 })); numP.position.set(0, 8.5, 15.05); h.add(numP);
    const lamp = glow(0xffd080, 3, { opacity: 0.8 }); lamp.position.set(0, 10.5, 15.3); h.add(lamp);
    shadowed(h);
  }

  /* ---------------- a biplane parked by the tee ---------------- */
  const plane = new THREE.Group(); plane.position.set(15, 0, -27); plane.rotation.y = 2.3; scene.add(plane);
  const red = std(0xb8262a, { roughness: 0.45 }), cream = std(0xf1e6c8, { roughness: 0.5 }), dark = std(0x222222, { roughness: 0.6 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.25, 6.5, 10), red); fus.rotation.x = Math.PI / 2; fus.position.set(0, 1.8, -0.6); plane.add(fus);
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.6, 1.0, 14), dark); cowl.rotation.x = Math.PI / 2; cowl.position.set(0, 1.8, 3.0); plane.add(cowl);
  for (const y of [1.2, 3.0]) { const wing = new THREE.Mesh(B(9, 0.12, 1.5), y > 2 ? cream : red); wing.position.set(0, y, 1.6); plane.add(wing); }
  for (const x of [-3.2, -1, 1, 3.2]) { const strut = new THREE.Mesh(B(0.06, 1.8, 0.06), dark); strut.position.set(x, 2.1, 1.6); plane.add(strut); }
  const tailH = new THREE.Mesh(B(3, 0.08, 0.9), cream); tailH.position.set(0, 2.0, -3.6); plane.add(tailH);
  const tailV = new THREE.Mesh(B(0.08, 1.2, 1), red); tailV.position.set(0, 2.6, -3.7); plane.add(tailV);
  for (const x of [-0.9, 0.9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, 2.2); plane.add(w); const leg = new THREE.Mesh(B(0.06, 1.1, 0.06), dark); leg.position.set(x * 0.7, 0.95, 2.2); leg.rotation.z = x > 0 ? -0.35 : 0.35; plane.add(leg); }
  const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8), dark); tw.rotation.z = Math.PI / 2; tw.position.set(0, 0.2, -3.6); plane.add(tw);
  const prop = new THREE.Group(); prop.position.set(0, 1.8, 3.55); plane.add(prop);
  const blade = new THREE.Mesh(B(0.18, 2.6, 0.06), std(0x6a4a2a, { roughness: 0.5 })); prop.add(blade);
  shadowed(plane);

  /* ---------------- trees, fence and hills round the field ---------------- */
  const tr = [];
  for (let i = 0; i < 220; i++) { const side = R() < 0.5 ? -1 : 1, x = side * (120 + R() * 160), z = 60 - R() * 600; if (Math.hypot(x + 78, z + 82) < 16) continue; tr.push([x, z, 4 + R() * 5]); }
  for (let i = 0; i < 80; i++) tr.push([(R() - 0.5) * 500, -470 - R() * 150, 5 + R() * 5]);
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), tr.length);
  tr.forEach(([x, z, s], i) => { m4.compose(ps.set(x, groundAt(x, z) + s * 1.4, z), q.identity(), sc.set(s, s * 1.2, s)); canopy.setMatrixAt(i, m4); canopy.setColorAt(i, col.setRGB(0.2, 0.32, 0.14).offsetHSL((R() - 0.5) * 0.05, 0, (R() - 0.5) * 0.08)); });
  canopy.castShadow = true; scene.add(canopy);
  // a low perimeter fence
  const fence = new THREE.InstancedMesh(B(0.12, 1.3, 0.12), std(0x8a8a8a), 120);
  let fi = 0; for (let z = 40; z > -560 && fi < 120; z -= 10) for (const sx of [-1, 1]) if (fi < 120) { m4.makeTranslation(sx * 110, 0.65, z); fence.setMatrixAt(fi++, m4); }
  scene.add(fence);

  /* ---------------- hot-air balloons in the sunrise ---------------- */
  const stripeTex = (a, b) => canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * w / 12, 0, w / 12 + 1, h); } });
  const balloons = [[-140, 90, -560, '#d8342a', '#f2c31a', 1], [120, 60, -640, '#2a6ad8', '#f2efe6', 0.85], [30, 140, -820, '#2fa060', '#f2c31a', 0.9]].map(([x, y, z, a, b, s]) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s * 1.6); scene.add(g);
    const env = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), new THREE.MeshStandardMaterial({ map: stripeTex(a, b), roughness: 0.6 })); env.scale.y = 1.2; g.add(env);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.2, 4, 16, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(a, b), roughness: 0.6, side: THREE.DoubleSide })); neck.position.y = -10.5; g.add(neck);
    const basket = new THREE.Mesh(B(1.6, 1.3, 1.6), std(0x8a6a3a)); basket.position.y = -15; g.add(basket);
    const flame = glow(0xffa040, 3, { opacity: 0 }); flame.position.y = -12.5; g.add(flame);
    return { g, flame, x, y, ph: R() * 6 };
  });

  /* ---------------- animate ---------------- */
  return {
    ...st, groundAt, surfaceAt, setBands, markLanding, clearMarks,
    animate(clock, dt) {
      for (const b of bands) b.m.uniforms.uT.value = clock;
      // the live band's lights pulse in sequence toward the band
      if (live) for (let k = 0; k < NBL; k++) { const u = blGlows[k].userData, on = 0.6 + 0.4 * Math.sin(clock * 4 + (u.j || 0) * 0.5); blM.setColorAt(k, col.set(u.near ? 0x5aff7a : 0xff4a3a).multiplyScalar(1 + on)); blGlows[k].material.opacity = 0.45 + 0.45 * on; }
      floatNum.position.y += Math.sin(clock * 2) * 0.004;
      if (blM.instanceColor) blM.instanceColor.needsUpdate = true;
      beacon.rotation.y = clock * 2.4;
      prop.rotation.z = clock * 0.6;
      sockSegs.forEach((s, i) => { s.position.y = 5.8 - i * i * 0.04 + Math.sin(clock * 3 + i) * 0.04; s.rotation.y = Math.sin(clock * 2.2 + i * 0.7) * 0.12 * i; });
      balloons.forEach(b => { b.g.position.x = b.x + clock * 0.6; b.g.position.y = b.y + Math.sin(clock * 0.2 + b.ph) * 4; const burn = Math.sin(clock * 0.7 + b.ph) > 0.85; b.flame.material.opacity = burn ? 0.9 : Math.max(0, b.flame.material.opacity - dt * 2); });
      for (const m of marks) { m.userData.t += dt; const u = Math.min(1, m.userData.t * 2.5); m.userData.ring.scale.setScalar(1 + u * 2.5); m.userData.ring.material.opacity = 1 - u * 0.75; m.userData.flag.rotation.y = Math.sin(clock * 3 + m.position.x) * 0.3; }
    },
  };
}
