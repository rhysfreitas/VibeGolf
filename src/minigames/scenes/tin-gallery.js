// The Tin Gallery — the Carnival Booth scene. You stand inside a giant antique tin shooting gallery
// on a sunny late afternoon: a bulb-lit arch over the counter, a plank stage floor, rows of painted
// plywood waves rocking side to side, gears turning on striped side walls, tin cans on a shelf,
// spinning bullseye boards, a rail of tin ducks, the prize bell on a striped frame, and a painted
// sky backdrop with a cut-out sun on a stick. The real fairground shows beyond the walls: a Ferris
// wheel, a big top, a carousel, a wooden coaster, stalls, bunting and balloons.
//
// API: setLayout(lay) · setCansDown(down) · knockCan(i) · hitBoard(i) · setDuck(i, down) · ringBell()
//      setAim(point|null) · setLead(x|null) · confetti(p) · animate(clock, dt, { ducksDown })

import { createStage, fbm, rng, sstep, GLSL_NOISE, terrainMesh } from '../../world/stage.js';
import { ROWS, duckX } from '../carnival-logic.js';

const GAL = { x: 56, z0: 8, z1: -232 }; // the gallery floor
const COL = { red: '#c8322a', cream: '#f3e6c4', gold: '#e2b24a', blue: '#2f6fb0', navy: '#1d3354', green: '#2f7a4a' };

function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
const stripes = (a, b, n = 8, vertical = true) => canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; if (vertical) g.fillRect(i * w / n, 0, w / n + 1, h); else g.fillRect(0, i * h / n, w, h / n + 1); }
  // decades of wear (art pass 1): chipped paint showing grey primer and wood, rust spots, grime low down
  let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 45; i++) { g.fillStyle = rr() < 0.6 ? 'rgba(150,140,124,0.7)' : 'rgba(120,84,52,0.65)'; g.beginPath(); g.ellipse(rr() * w, rr() * h, 0.8 + rr() * 2.5, 0.6 + rr() * 1.6, rr() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(110,60,30,${0.15 + rr() * 0.2})`; g.beginPath(); g.ellipse(rr() * w, rr() * h, 2 + rr() * 6, 2 + rr() * 6, 0, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(60,45,30,0)'); gr.addColorStop(1, 'rgba(60,45,30,0.22)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });

export function createTinGallery(container) {
  const st = createStage(container, {
    // art pass 1: a lower, warmer late-afternoon sun from behind you (long shadows down the planks), and a
    // warm haze that softens the fairground so the gallery stands out
    turbidity: 4.5, rayleigh: 1.9, mie: 0.006, mieG: 0.84, elev: 12, az: 32,
    sunColor: 0xffc48a, sunInt: 2.6, exposure: 0.62, hemiSky: 0xb6cdf0, hemiGround: 0x6a5238, hemiInt: 0.45,
    fogColor: 0xe8d8bf, fogNear: 220, fogFar: 1500, shadowBox: 120,
  });
  const { scene } = st;
  const R = rng(321), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color(), eu = new THREE.Euler();
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...o });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const shadowed = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  const redStripe = stripes(COL.red, COL.cream, 8), blueStripe = stripes(COL.navy, COL.cream, 10);

  /* ---------------- ground: plank stage inside, fairground grass outside ---------------- */
  const inGal = (x, z) => Math.abs(x) < GAL.x && z < GAL.z0 && z > GAL.z1;
  function groundAt(x, z) {
    const out = Math.max(Math.abs(x) - 260, -z - 520, z - 120, 0);
    return out > 0 ? sstep(0, 160, out) * (8 + 30 * fbm(x / 180, z / 180)) : 0;
  }
  const surfaceAt = () => 'fairway';
  const geo = terrainMesh(groundAt, { N: st.coarse ? 200 : 260, nearX: 160, farX: 2600, nearZ: 300, farZ: 2600, cz: -110 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <map_fragment>', `
vec3 p = vWPos; float camD = length(cameraPosition - p);
float far = smoothstep(30.0, 140.0, camD);
float inside = step(abs(p.x), ${GAL.x.toFixed(1)}) * step(p.z, ${GAL.z0.toFixed(1)}) * step(${GAL.z1.toFixed(1)}, p.z);
// planks run downrange: 0.9 m boards, staggered butt joints, a warm painted stage
float px = max(0.01, camD * 0.0012);
float board = floor(p.x / 0.9), u = fract(p.x / 0.9);
float joint = fract((p.z + h21(vec2(board, 3.0)) * 6.0) / 6.0);
float seam = max(1.0 - smoothstep(0.0, 0.02 + px, min(u, 1.0 - u)), 1.0 - smoothstep(0.0, 0.004 + px * 0.2, min(joint, 1.0 - joint)));
vec3 wood = mix(lin(vec3(0.6, 0.42, 0.26)), lin(vec3(0.5, 0.34, 0.2)), h21(vec2(board, floor((p.z + h21(vec2(board, 3.0)) * 6.0) / 6.0))));
wood *= 0.85 + 0.25 * mix(fb(vec2(p.x * 8.0, p.z * 0.4)), 0.5, far);
wood = mix(wood, wood * 0.45, seam * (1.0 - far * 0.8));
// a painted centre stripe and lane marks every 25 yd
float yd = -p.z / 0.9144;
float lane = (1.0 - smoothstep(0.1, 0.1 + px, abs(p.x))) * step(5.0, -p.z);
float mark = (1.0 - smoothstep(0.0, 0.25 + px, abs(mod(yd + 12.5, 25.0) - 12.5))) * step(20.0, yd) * step(yd, 240.0) * step(abs(p.x), 50.0);
wood = mix(wood, lin(vec3(0.9, 0.82, 0.62)), max(lane * 0.7, mark * 0.4) * (1.0 - far * 0.5));
// outside: trampled grass and dirt paths
vec3 grass = mix(lin(vec3(0.36, 0.5, 0.22)), lin(vec3(0.3, 0.42, 0.18)), fb(p.xz * 0.05)) * (0.8 + 0.3 * mix(fb(p.xz * 1.8), 0.5, far));
vec3 dirt = lin(vec3(0.55, 0.45, 0.32)) * (0.85 + 0.2 * fb(p.xz * 0.9));
float path = smoothstep(0.55, 0.62, fb(p.xz * 0.012 + 4.0));
vec3 outside = mix(grass, dirt, path * 0.8);
outside = mix(outside, lin(vec3(0.32, 0.4, 0.22)) * (0.8 + 0.3 * fb(p.xz * 0.01)), smoothstep(1.0, 10.0, p.y));
diffuseColor.rgb = mix(outside, wood, inside);
float rough = mix(0.95, 0.7, inside);
`);
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  /* ---------------- bulbs (one instanced mesh; chase patterns) ---------------- */
  const bulbs = [];
  const addBulbs = (pts, group = 0) => pts.forEach((p, k) => bulbs.push({ p, k, group }));
  const lineBulbs = (a, b, n, group) => addBulbs(Array.from({ length: n }, (_, i) => { const f = n > 1 ? i / (n - 1) : 0; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }), group);

  /* ---------------- the counter and the arch ---------------- */
  for (const sx of [-1, 1]) {
    const counter = new THREE.Group(); counter.position.set(sx * 6.5, 0, -1.4); scene.add(counter);
    const top = new THREE.Mesh(B(9, 0.16, 1.4), std(0x7a4a2a, { roughness: 0.55 })); top.position.y = 1.1; counter.add(top);
    const front = new THREE.Mesh(B(9, 1.02, 0.08), new THREE.MeshStandardMaterial({ map: redStripe, roughness: 0.8 })); front.position.set(0, 0.51, -0.66); counter.add(front);
    const trim = new THREE.Mesh(B(9.1, 0.08, 0.12), std(0xe2b24a, { metalness: 0.5, roughness: 0.4 })); trim.position.set(0, 1.0, -0.7); counter.add(trim);
    shadowed(counter);
  }
  const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), std(0x2f6a3a, { roughness: 1 })); mat2.rotation.x = -Math.PI / 2; mat2.position.set(0, 0.012, 0.2); mat2.receiveShadow = true; scene.add(mat2);
  // the arch: striped posts, a marquee beam with bulb letters
  const ARCH = { z: -22, x: 17, h: 15 };
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(2.2, ARCH.h, 2.2), new THREE.MeshStandardMaterial({ map: redStripe, roughness: 0.7 }));
    post.position.set(sx * ARCH.x, ARCH.h / 2, ARCH.z); scene.add(shadowed(post));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), std(0xe2b24a, { metalness: 0.6, roughness: 0.35 })); cap.position.set(sx * ARCH.x, ARCH.h + 1.2, ARCH.z); scene.add(cap);
    lineBulbs([sx * (ARCH.x - 1.15), 0.8, ARCH.z + 1.15], [sx * (ARCH.x - 1.15), ARCH.h - 0.6, ARCH.z + 1.15], 18, 0);
  }
  const marquee = new THREE.Group(); marquee.position.set(0, ARCH.h - 1.6, ARCH.z); scene.add(marquee);
  const beam = new THREE.Mesh(B(ARCH.x * 2, 3.6, 1.2), std(0x7a2620, { roughness: 0.6 })); marquee.add(shadowed(beam));
  const signTex = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#7a2620'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e2b24a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffe9b0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 84px "Rye", "Cormorant SC", Georgia, serif'; g.shadowColor = '#ffb040'; g.shadowBlur = 14;
    g.fillText('SHOOTING  GALLERY', w / 2, h / 2 + 4);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(ARCH.x * 2 - 1, 3.2), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.5, roughness: 0.6 })); sign.position.z = 0.61; marquee.add(sign);
  lineBulbs([-ARCH.x + 0.6, ARCH.h + 0.35, ARCH.z + 0.65], [ARCH.x - 0.6, ARCH.h + 0.35, ARCH.z + 0.65], 34, 1);
  lineBulbs([-ARCH.x + 0.6, ARCH.h - 3.55, ARCH.z + 0.65], [ARCH.x - 0.6, ARCH.h - 3.55, ARCH.z + 0.65], 34, 1);
  // plush prizes hanging inside the arch
  const plushCols = [0xd96a8a, 0x6aa8d9, 0xe0c060, 0x8ad08a, 0xb08ad9];
  const plush = (x, y, z, s, c) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g);
    const m = std(c, { roughness: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), m); body.scale.set(1, 1.15, 0.9); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 10), m); head.position.y = 0.75; g.add(head);
    for (const ex of [-0.26, 0.26]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m); ear.position.set(ex, 1.07, 0); g.add(ear); }
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), std(0xf3e6c4, { roughness: 1 })); snout.position.set(0, 0.7, 0.33); g.add(snout);
    for (const ex of [-0.13, 0.13]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), std(0x111111, { roughness: 0.3 })); eye.position.set(ex, 0.85, 0.33); g.add(eye); }
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), std(0xeeeeee)); string.position.y = 1.6; g.add(string);
    return shadowed(g);
  };
  const plushies = [];
  [-1, 1].forEach(sx => [0, 1, 2].forEach(k => plushies.push(plush(sx * (ARCH.x - 3.2 - k * 2.4), ARCH.h - 5.2 - k * 0.6, ARCH.z + 0.6, 1.2 - k * 0.2, plushCols[(k + (sx > 0 ? 2 : 0)) % 5]))));

  /* ---------------- side walls with gears, bunting over the top ---------------- */
  const wallMat = new THREE.MeshStandardMaterial({ map: stripes(COL.red, COL.cream, 16), roughness: 0.9, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const len = ARCH.z - GAL.z1 - 4, wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 5), wallMat);
    wall.position.set(sx * GAL.x, 2.5, (ARCH.z + GAL.z1 + 4) / 2); wall.rotation.y = sx * Math.PI / 2; wall.receiveShadow = true; scene.add(wall);
    for (let z = ARCH.z - 4; z > GAL.z1 + 4; z -= 16) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 7, 8), std(0xe2b24a, { metalness: 0.4, roughness: 0.5 })); post.position.set(sx * GAL.x, 3.5, z); scene.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), std(0xc8322a, { roughness: 0.5 })); ball.position.set(sx * GAL.x, 7.2, z); scene.add(ball);
      addBulbs([[sx * (GAL.x - 0.3), 5.2, z]], 2);
    }
  }
  const gears = [];
  const gear = (x, y, z, r, dir) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
    const wheel = new THREE.Group(); g.add(wheel);
    const m = std(0x8a6a3a, { metalness: 0.5, roughness: 0.45 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.35, 28), m); disc.rotation.x = Math.PI / 2; wheel.add(disc);
    const n = Math.round(r * 7); for (let i = 0; i < n; i++) { const t = new THREE.Mesh(B(0.35, r * 0.28, 0.35), m); const a = i / n * Math.PI * 2; t.position.set(Math.cos(a) * (r + 0.1), Math.sin(a) * (r + 0.1), 0); t.rotation.z = a - Math.PI / 2; wheel.add(t); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.5, 14), std(0xe2b24a, { metalness: 0.7, roughness: 0.3 })); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(B(r * 1.7, 0.18, 0.4), m); s.rotation.z = i * Math.PI / 4; wheel.add(s); }
    gears.push({ wheel, dir }); shadowed(g);
  };
  gear(-GAL.x + 0.5, 3.0, -34, 2.2, 1); gear(-GAL.x + 0.5, 2.0, -40.4, 1.4, -1.6);
  gear(GAL.x - 0.5, 3.0, -46, 2.4, -1); gear(GAL.x - 0.5, 1.9, -52.8, 1.3, 1.8);
  // bunting strung across the gallery
  const flagGeo = new THREE.BufferGeometry(); flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.45, 0, 0, 0.45, 0, 0, 0, -0.9, 0], 3)); flagGeo.computeVertexNormals();
  const flags = [];
  const bunting = (a, b, sag) => { const n = Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.3); for (let i = 0; i <= n; i++) { const f = i / n; flags.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - sag * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f, Math.atan2(b[0] - a[0], b[2] - a[2])]); } };
  for (const sx of [-1, 1]) for (let z = ARCH.z - 4; z > GAL.z1 + 20; z -= 16) bunting([sx * GAL.x, 7.0, z], [sx * GAL.x, 7.0, z - 16], 1.2); // along the wall tops
  for (const sx of [-1, 1]) bunting([sx * ARCH.x, ARCH.h + 1.6, ARCH.z], [sx * GAL.x, 7.2, ARCH.z - 4], 1);
  const flagM = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), flags.length);
  const fc = [0xc8322a, 0xe2b24a, 0x2f6fb0, 0xf3e6c4, 0x2f7a4a];
  flags.forEach(([x, y, z, a], i) => { q.setFromEuler(eu.set(0, a + Math.PI / 2, 0)); m4.compose(ps.set(x, y, z), q, sc.set(1, 1, 1)); flagM.setMatrixAt(i, m4); flagM.setColorAt(i, col.set(fc[i % fc.length])); });
  scene.add(flagM);

  /* ---------------- painted plywood waves (they rock side to side) ---------------- */
  const waveTex = canvasTex(1024, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const crest = (y0, fill, edge) => {
      g.beginPath(); g.moveTo(0, h); g.lineTo(0, y0);
      for (let x = 0; x <= w; x += 4) { const ph = x / w * Math.PI * 2 * 8; g.lineTo(x, y0 - Math.abs(Math.sin(ph)) * 34 - Math.max(0, Math.sin(ph * 1 + 1.2)) * 8); }
      g.lineTo(w, h); g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = edge; g.lineWidth = 5; g.stroke();
    };
    crest(70, '#2f6fb0', '#f3f0e8'); crest(96, '#1d4f88', '#cfe0f0');
    g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, 80 + Math.random() * 40, 14, 3);
  }, { repeat: [1, 1] });
  waveTex.wrapS = THREE.RepeatWrapping;
  const waveMat = new THREE.MeshStandardMaterial({ map: waveTex, transparent: true, alphaTest: 0.4, roughness: 0.6, side: THREE.DoubleSide });
  const waves = [];
  for (const [z, h, ph, y0 = 0] of [[-62, 1.6, 0], [-64.5, 1.1, 1.6], [-104, 2.0, 0.8], [-131, 2.6, 2.2], [-133.5, 1.8, 0.4], [-188, 2.2, 0.3], [ROWS.ducks.z + 0.9, 1.3, 1.2, ROWS.ducks.rail - 1.9]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(GAL.x * 2 + 8, h * 2), waveMat.clone()); w.material.map = waveTex.clone(); w.material.map.needsUpdate = true; w.material.map.repeat.set(GAL.x / 14, 1);
    w.position.set(0, y0 + h, z); w.castShadow = true; scene.add(w); waves.push({ w, ph, base: 0 });
  }

  /* ---------------- targets ---------------- */
  const targets = new THREE.Group(); scene.add(targets);
  // tin cans on a shelf
  const C = ROWS.cans;
  const shelf = new THREE.Group(); scene.add(shelf);
  const plank = new THREE.Mesh(B(64, 0.3, 4.6), std(0x7a5232, { roughness: 0.75 })); plank.position.set(0, C.shelf - 0.15, C.z); shelf.add(plank);
  for (let x = -30; x <= 30; x += 10) for (const dz of [-1.9, 1.9]) { const leg = new THREE.Mesh(B(0.3, C.shelf - 0.3, 0.3), std(0x5a3a22)); leg.position.set(x, (C.shelf - 0.3) / 2, C.z + dz); shelf.add(leg); }
  shadowed(shelf);
  const labels = [['BEANS', '#c8322a', '#f3e6c4'], ['PEACHES', '#e88a2a', '#fff2d0'], ['CORN', '#2f7a4a', '#f6e27a'], ['PEAS', '#1d4f88', '#e8f0d0'], ['SOUP', '#8a2a2a', '#f3e6c4']];
  const canTex = ([word, bg, fg]) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.fillRect(0, 26, w, 10); g.fillRect(0, h - 36, w, 10);
    for (let k = 0; k < 2; k++) { const cx = w * (0.25 + k * 0.5); g.fillStyle = fg; g.beginPath(); g.ellipse(cx, h / 2, 100, 60, 0, 0, 7); g.fill(); g.fillStyle = bg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 ${word.length > 5 ? 40 : 54}px "Rye", Georgia, serif`; g.fillText(word, cx, h / 2 + 2); }
  });
  const tinMat = std(0xc9ccd0, { metalness: 0.85, roughness: 0.3 });
  const cans = C.xs.map((x, i) => {
    const g = new THREE.Group(); g.position.set(x, C.shelf, C.z); targets.add(g);
    const inner = new THREE.Group(); g.add(inner);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(C.r, C.r, C.h, 32, 1, true), new THREE.MeshStandardMaterial({ map: canTex(labels[i % labels.length]), metalness: 0.25, roughness: 0.45 }));
    body.position.y = C.h / 2; body.rotation.y = R() * 6; inner.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(C.r, C.r, 0.08, 32), tinMat); lid.position.y = C.h; inner.add(lid);
    for (const y of [0.06, C.h - 0.06]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(C.r, 0.07, 6, 32), tinMat); rim.rotation.x = Math.PI / 2; rim.position.y = y; inner.add(rim); }
    for (const y of [C.h * 0.33, C.h * 0.66]) { const rib = new THREE.Mesh(new THREE.TorusGeometry(C.r * 1.005, 0.035, 4, 32), tinMat); rib.rotation.x = Math.PI / 2; rib.position.y = y; inner.add(rib); }
    shadowed(g);
    return { g, inner, down: false, anim: null };
  });
  // bullseye boards on posts (they spin when hit)
  const Bd = ROWS.boards;
  const boardTex = canvasTex(512, 512, (g, w) => {
    const rings = ['#f3e6c4', '#c8322a', '#f3e6c4', '#c8322a', '#f3e6c4', '#c8322a'];
    rings.forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, w / 2, w / 2 * (1 - k / rings.length * (1 - Bd.bull) ), 0, 7); g.fill(); });
    g.fillStyle = '#e2b24a'; g.beginPath(); g.arc(w / 2, w / 2, w / 2 * Bd.bull, 0, 7); g.fill();
    g.strokeStyle = '#3a2416'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, 7); g.stroke();
  });
  const boards = Bd.xs.map(x => {
    const g = new THREE.Group(); g.position.set(x, 0, Bd.z); targets.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, Bd.cy, 10), std(0x6a4a2a)); post.position.y = Bd.cy / 2; g.add(post);
    const spin = new THREE.Group(); spin.position.y = Bd.cy; g.add(spin);
    const face = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 48), [std(0x8a5a2a), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.6 }), std(0x8a5a2a)]);
    face.rotation.x = Math.PI / 2; face.rotation.y = Math.PI / 2; spin.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), std(0xe2b24a, { metalness: 0.6, roughness: 0.35 })); rim.position.z = 0.16; spin.add(rim);
    shadowed(g);
    return { g, spin, face, rim, anim: 0 };
  });
  // tin ducks on a rail
  const D = ROWS.ducks;
  const duckShape = new THREE.Shape();
  { const w = 1, h = 1; // unit duck, facing +x (the way they glide), scaled per difficulty
    duckShape.moveTo(-0.5 * w, 0.18 * h);
    duckShape.bezierCurveTo(-0.55 * w, 0.55 * h, -0.2 * w, 0.62 * h, 0.08 * w, 0.55 * h);    // back
    duckShape.bezierCurveTo(0.05 * w, 0.75 * h, 0.12 * w, 1.0 * h, 0.3 * w, 1.0 * h);          // neck to crown
    duckShape.bezierCurveTo(0.45 * w, 1.0 * h, 0.5 * w, 0.88 * h, 0.48 * w, 0.8 * h);
    duckShape.lineTo(0.6 * w, 0.76 * h); duckShape.lineTo(0.47 * w, 0.7 * h);                  // beak
    duckShape.bezierCurveTo(0.42 * w, 0.6 * h, 0.32 * w, 0.55 * h, 0.4 * w, 0.42 * h);
    duckShape.bezierCurveTo(0.46 * w, 0.2 * h, 0.3 * w, 0.0, 0.0, 0.0);
    duckShape.bezierCurveTo(-0.3 * w, 0.0, -0.45 * w, 0.05 * h, -0.5 * w, 0.18 * h);
  }
  const duckGeo = new THREE.ExtrudeGeometry(duckShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 14 });
  duckGeo.translate(0, 0, -0.04);
  const duckTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f2c832'; g.fillRect(0, 0, w, h);
    // shape space x [-0.5, 0.6] → u, y [0, 1] → v (set via the material's map offset/repeat)
    const X = x => (x + 0.5) / 1.1 * w, Y = y => h - y * h;
    g.fillStyle = '#e28a1a'; g.beginPath(); g.moveTo(X(0.47), Y(0.82)); g.lineTo(X(0.62), Y(0.76)); g.lineTo(X(0.47), Y(0.68)); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(0.33), Y(0.85), 12, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(X(0.35), Y(0.85), 6, 0, 7); g.fill();
    g.strokeStyle = '#d8a420'; g.lineWidth = 6; g.beginPath(); g.moveTo(X(-0.35), Y(0.4)); g.quadraticCurveTo(X(-0.1), Y(0.62), X(0.15), Y(0.38)); g.stroke(); // wing
    // the centre target (the perfect zone) at the middle of the hit ellipse
    const cx = X(0.0), cy = Y(0.5), rr = 0.32 * 0.5 * w / 1.1 * 1.1;
    for (const [k, c] of [[1, '#c8322a'], [0.62, '#f3e6c4'], [0.3, '#c8322a']]) { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, rr * k * 1.4, 0, 7); g.fill(); }
  });
  duckTex.repeat.set(1 / 1.1, 1); duckTex.offset.set(0.5 / 1.1, 0);
  const duckMat = new THREE.MeshStandardMaterial({ map: duckTex, metalness: 0.3, roughness: 0.45 });
  const railY = D.rail;
  const rail = new THREE.Mesh(B(D.x1 - D.x0 + 8, 0.25, 0.25), std(0x5a5e66, { metalness: 0.8, roughness: 0.3 })); rail.position.set(0, railY, D.z); scene.add(rail);
  // the painted sea wall the duck rail runs along (the ball stops against it)
  const seaTex = canvasTex(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f86c8'); gr.addColorStop(1, '#173c6a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 5; row++) { g.strokeStyle = `rgba(240,248,255,${0.5 - row * 0.07})`; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= w; x += 6) { const y = 30 + row * 48 + Math.sin(x / 40 + row) * 9; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    const fish = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, 26 * s, 13 * s, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x - 22 * s, y); g.lineTo(x - 42 * s, y - 14 * s); g.lineTo(x - 42 * s, y + 14 * s); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 14 * s, y - 3 * s, 3.5 * s, 0, 7); g.fill(); };
    for (let i = 0; i < 9; i++) fish(60 + i * 110, 80 + (i % 3) * 55, 0.9 + (i % 2) * 0.4, ['#f2c832', '#e88a2a', '#c8322a'][i % 3]);
    g.strokeStyle = '#5a3a22'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(108, D.rail), new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.85 })); sea.position.set(0, D.rail / 2, D.z - 1.5); sea.receiveShadow = true; scene.add(sea);
  for (let x = -50; x <= 50; x += 20) { const brace = new THREE.Mesh(B(0.5, D.rail + 1, 0.5), std(0x5a3a22)); brace.position.set(x, (D.rail + 1) / 2, D.z - 2.2); scene.add(brace); }
  for (const sx of [-1, 1]) { // sheds hide the ducks as they loop round
    const SH = D.rail + 8;
    const shed = new THREE.Group(); shed.position.set(sx * (D.x1 + 3.5), 0, D.z); scene.add(shed);
    const box = new THREE.Mesh(B(7, SH, 5), new THREE.MeshStandardMaterial({ map: blueStripe, roughness: 0.8 })); box.position.y = SH / 2; shed.add(box);
    const roofS = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), std(0xc8322a, { roughness: 0.6 })); roofS.position.y = SH + 1.5; roofS.rotation.y = Math.PI / 4; shed.add(roofS);
    shadowed(shed);
  }
  const ducks = Array.from({ length: D.n }, () => {
    const g = new THREE.Group(); g.position.set(0, railY, D.z); targets.add(g);
    const hinge = new THREE.Group(); g.add(hinge);
    const body = new THREE.Mesh(duckGeo, duckMat); body.position.y = 0; hinge.add(body);
    const stick = new THREE.Mesh(B(0.04, 0.35, 0.04), std(0x5a5e66, { metalness: 0.8 })); stick.position.y = -0.1; hinge.add(stick);
    shadowed(g);
    return { g, hinge, flip: 0, down: false };
  });
  // the prize bell on a striped frame
  const L = ROWS.bell;
  const bellFrame = new THREE.Group(); bellFrame.position.set(L.x, 0, L.z); scene.add(bellFrame);
  const FH = L.cy + 8;
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(B(1.4, FH, 1.4), new THREE.MeshStandardMaterial({ map: redStripe, roughness: 0.7 })); p.position.set(sx * 9, FH / 2, 0); bellFrame.add(p); lineBulbs([L.x + sx * 9, 1, L.z + 0.75], [L.x + sx * 9, FH - 0.5, L.z + 0.75], 16, 3); }
  const bar = new THREE.Mesh(B(20, 1.2, 1.4), std(0x7a2620)); bar.position.y = FH; bellFrame.add(bar);
  lineBulbs([L.x - 9.5, FH + 0.8, L.z + 0.75], [L.x + 9.5, FH + 0.8, L.z + 0.75], 18, 3);
  const bellSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.MeshStandardMaterial({ map: canvasTex(512, 110, (g, w, h) => { g.fillStyle = '#1d3354'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e2b24a'; g.lineWidth = 6; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#ffe9b0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 56px "Rye", Georgia, serif'; g.fillText('RING THE BELL', w / 2, h / 2 + 3); }), emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 }));
  bellSign.position.set(0, FH + 2.6, 0.2); bellFrame.add(bellSign);
  const yoke = new THREE.Group(); yoke.position.y = FH - 0.6; bellFrame.add(yoke);
  const bellPts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; bellPts.push(new THREE.Vector2(0.15 + 0.75 * Math.pow(t, 1.6) + (t > 0.85 ? (t - 0.85) * 0.7 : 0), 1 - t)); }
  const bellGeo = new THREE.LatheGeometry(bellPts, 32); bellGeo.translate(0, -1, 0);
  const brass = std(0xd8a84a, { metalness: 0.95, roughness: 0.25 });
  const bellMesh = new THREE.Mesh(bellGeo, brass); bellMesh.material.side = THREE.DoubleSide; yoke.add(bellMesh);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1, 6), std(0x3a3a3a, { metalness: 0.8 })); yoke.add(chain);
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), std(0x3a3a3a, { metalness: 0.8 })); yoke.add(clapper);
  shadowed(bellFrame);
  let bellSwing = 0, bellFlash = 0;
  // painted sky backdrop with a cut-out sun on a stick
  const back = new THREE.Group(); back.position.set(0, 0, GAL.z1 + 2); scene.add(back);
  const skyTex = canvasTex(1024, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7fb6e8'); gr.addColorStop(1, '#cfe6f2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (const [cx, cy, s] of [[120, 110, 1], [380, 70, 0.8], [640, 130, 1.1], [880, 80, 0.9], [520, 220, 0.7], [220, 230, 0.6]]) for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + (k - 2) * 34 * s, cy + (k % 2) * -14 * s, (30 + (k % 3) * 10) * s, 0, 7); g.fill(); }
    g.strokeStyle = '#5a3a22'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18);
  });
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(GAL.x * 2 - 4, 34), new THREE.MeshStandardMaterial({ map: skyTex, roughness: 0.9 })); backdrop.position.y = 17; back.add(backdrop);
  for (const sx of [-1, 1]) { const brace = new THREE.Mesh(B(0.5, 34, 0.5), std(0x5a3a22)); brace.position.set(sx * (GAL.x - 6), 17, -1.5); brace.rotation.x = 0.2; back.add(brace); }
  const sunCut = new THREE.Group(); sunCut.position.set(-26, 22, 0.6); back.add(sunCut);
  const sunTex = canvasTex(256, 256, (g, w) => { g.translate(w / 2, w / 2); g.fillStyle = '#f6c43a'; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(-14, -70); g.lineTo(0, -122); g.lineTo(14, -70); g.fill(); } g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill(); g.fillStyle = '#c87a1a'; g.beginPath(); g.arc(-22, -12, 7, 0, 7); g.arc(22, -12, 7, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#c87a1a'; g.beginPath(); g.arc(0, 8, 30, 0.2, Math.PI - 0.2); g.stroke(); });
  const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: sunTex, transparent: true, alphaTest: 0.3, roughness: 0.6, emissive: 0x332200 })); sunCut.add(sunDisc);
  const sunStick = new THREE.Mesh(B(0.35, 24, 0.2), std(0x5a3a22)); sunStick.position.y = -14; sunCut.add(sunStick);

  /* ---------------- the fairground beyond the walls ---------------- */
  // Ferris wheel
  const FW = new THREE.Group(); FW.position.set(-96, 0, -300); FW.rotation.y = 0.3; scene.add(FW);
  const fwR = 34, fwH = fwR + 8, wheel = new THREE.Group(); wheel.position.y = fwH; FW.add(wheel);
  const fwMat = std(0xf3e6c4, { metalness: 0.4, roughness: 0.4 });
  for (const zz of [-1.5, 1.5]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(fwR, 0.35, 6, 64), fwMat); ring.position.z = zz; wheel.add(ring); }
  const NG = 16, gondolas = [];
  for (let i = 0; i < NG; i++) {
    const a = i / NG * Math.PI * 2;
    const spoke = new THREE.Mesh(B(0.25, fwR, 0.25), fwMat); spoke.position.set(Math.cos(a) * fwR / 2, Math.sin(a) * fwR / 2, 0); spoke.rotation.z = a - Math.PI / 2; wheel.add(spoke);
    const gd = new THREE.Mesh(B(3, 2.6, 2.6), std([0xc8322a, 0x2f6fb0, 0xe2b24a, 0x2f7a4a][i % 4], { roughness: 0.5 })); gd.position.set(Math.cos(a) * fwR, Math.sin(a) * fwR - 2, 0); wheel.add(gd); gondolas.push({ gd, a });
  }
  for (const sx of [-1, 1]) for (const zz of [-4, 4]) { const leg = new THREE.Mesh(B(0.8, fwH * 1.1, 0.8), std(0x9a9ea6, { metalness: 0.6, roughness: 0.4 })); leg.position.set(sx * 12, fwH / 2, zz); leg.rotation.z = -sx * 0.27; FW.add(leg); }
  // big top
  const top = new THREE.Group(); top.position.set(140, 0, -270); scene.add(top);
  const tentTex = stripes(COL.red, COL.cream, 24);
  const tWall = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 10, 32, 1, true), new THREE.MeshStandardMaterial({ map: tentTex, roughness: 0.9, side: THREE.DoubleSide })); tWall.position.y = 5; top.add(tWall);
  const tRoof = new THREE.Mesh(new THREE.ConeGeometry(33, 22, 32, 1, true), new THREE.MeshStandardMaterial({ map: tentTex, roughness: 0.9, side: THREE.DoubleSide })); tRoof.position.y = 21; top.add(tRoof);
  const tPole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 6), std(0xe2b24a)); tPole.position.y = 35; top.add(tPole);
  const tFlag = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.4), std(0xe2b24a, { side: THREE.DoubleSide })); tFlag.position.set(2, 37.5, 0); top.add(tFlag);
  shadowed(top);
  // carousel
  const caro = new THREE.Group(); caro.position.set(104, 0, -116); scene.add(caro);
  const cBase = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 1.2, 28), std(0xe2b24a, { roughness: 0.5 })); cBase.position.y = 0.6; caro.add(cBase);
  const cRoof = new THREE.Mesh(new THREE.ConeGeometry(13, 6, 28), new THREE.MeshStandardMaterial({ map: blueStripe, roughness: 0.7 })); cRoof.position.y = 9.5; caro.add(cRoof);
  const cSpin = new THREE.Group(); caro.add(cSpin);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), std(0xe2b24a, { metalness: 0.6 })); pole.position.set(Math.cos(a) * 9, 4, Math.sin(a) * 9); cSpin.add(pole); const horse = new THREE.Mesh(B(0.6, 1.2, 2.2), std([0xf3e6c4, 0x8a5a3a, 0x2a2a2a][i % 3], { roughness: 0.5 })); horse.position.set(Math.cos(a) * 9, 3, Math.sin(a) * 9); horse.rotation.y = -a; cSpin.add(horse); }
  shadowed(caro);
  // wooden coaster
  const coaster = new THREE.Group(); coaster.position.set(-118, 0, -150); coaster.rotation.y = 0.25; scene.add(coaster);
  const cpts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; cpts.push(new THREE.Vector3(-60 + 120 * t, 8 + 22 * Math.pow(Math.sin(t * Math.PI * 2.5), 2) * (1 - t * 0.4), Math.sin(t * Math.PI * 2) * 8)); }
  const ccurve = new THREE.CatmullRomCurve3(cpts);
  const track = new THREE.Mesh(new THREE.TubeGeometry(ccurve, 200, 0.5, 6, false), std(0x8a6a4a)); coaster.add(track);
  const cposts = new THREE.InstancedMesh(B(0.35, 1, 0.35), std(0x9a7a5a), 60);
  for (let i = 0; i < 60; i++) { const p = ccurve.getPoint(i / 59); m4.compose(ps.set(p.x, p.y / 2, p.z), q.identity(), sc.set(1, p.y, 1)); cposts.setMatrixAt(i, m4); }
  coaster.add(cposts); shadowed(coaster);
  // striped stalls round the outside
  const stallTex = [stripes(COL.red, COL.cream, 10), stripes(COL.navy, COL.cream, 10), stripes(COL.green, COL.cream, 10)];
  for (let i = 0; i < 14; i++) {
    const sx = i % 2 ? 1 : -1, z = -10 - (i >> 1) * 32 - R() * 8, x = sx * (70 + R() * 18);
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(s);
    const box = new THREE.Mesh(B(7, 3.4, 5), std(0xf3e6c4, { roughness: 0.8 })); box.position.y = 1.7; s.add(box);
    const roofT = new THREE.Mesh(new THREE.ConeGeometry(5.6, 3.6, 4), new THREE.MeshStandardMaterial({ map: stallTex[i % 3], roughness: 0.8 })); roofT.position.y = 5.2; roofT.rotation.y = Math.PI / 4; s.add(roofT);
    shadowed(s);
  }
  // trees round the edge of the fair
  const tr = [];
  for (let i = 0; i < 160; i++) { const a = R() * Math.PI * 2, rr = 200 + R() * 140, x = Math.cos(a) * rr * 0.9, z = -140 + Math.sin(a) * rr; if (z > 40) continue; tr.push([x, z, 5 + R() * 4]); }
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), tr.length);
  tr.forEach(([x, z, s], i) => { m4.compose(ps.set(x, groundAt(x, z) + s * 1.3, z), q.identity(), sc.set(s, s * 1.1, s)); canopy.setMatrixAt(i, m4); canopy.setColorAt(i, col.setRGB(0.22, 0.38, 0.16).offsetHSL((R() - 0.5) * 0.05, 0, (R() - 0.5) * 0.08)); });
  scene.add(canopy);
  // balloons drifting up
  const balloons = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); scene.add(g);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), std([0xc8322a, 0xe2b24a, 0x2f6fb0, 0xd96a8a, 0x2f7a4a][i % 5], { roughness: 0.35 })); b.scale.y = 1.2; g.add(b);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 3), std(0xeeeeee)); s.position.y = -2.4; g.add(s);
    balloons.push({ g, x: (R() - 0.5) * 300, z: -40 - R() * 300, y: R() * 80, v: 1.2 + R() * 1.2 });
  }

  /* ---------------- bulbs: build the instanced mesh now everything has added theirs ---------------- */
  const bulbM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbs.length);
  bulbs.forEach((b, i) => { m4.makeTranslation(...b.p); bulbM.setMatrixAt(i, m4); bulbM.setColorAt(i, col.set(0xffd890)); });
  scene.add(bulbM);
  // a warm halo round every bulb (one points draw), so they read as lit in the low sun
  { const hp = new Float32Array(bulbs.length * 3); bulbs.forEach((b, i) => hp.set(b.p, i * 3));
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    const ht = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { srgb: false });
    scene.add(new THREE.Points(hg, new THREE.PointsMaterial({ map: ht, color: 0xffc070, size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))); }
  // Ferris wheel bulbs ride with the wheel
  const fwBulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }), 64);
  for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; m4.makeTranslation(Math.cos(a) * fwR, Math.sin(a) * fwR, 1.9); fwBulbs.setMatrixAt(i, m4); }
  wheel.add(fwBulbs);

  /* ---------------- markers: where you're aiming, and the lead on the ducks ---------------- */
  const aimMark = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 4), basic(0xffd84a, { transparent: true, opacity: 0.85 })); aimMark.rotation.x = Math.PI; aimMark.visible = false; scene.add(aimMark);
  const leadTex = canvasTex(128, 128, (g, w) => { g.strokeStyle = 'rgba(255,240,180,0.95)'; g.lineWidth = 7; g.setLineDash([12, 9]); g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 8, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,240,180,0.9)'; g.beginPath(); g.arc(w / 2, w / 2, 7, 0, 7); g.fill(); });
  const lead = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: leadTex, transparent: true, depthWrite: false, toneMapped: false })); lead.visible = false; lead.position.set(0, railY + D.h / 2, D.z + 0.6); scene.add(lead);
  let aimPos = null;

  /* ---------------- confetti ---------------- */
  const bursts = [];
  function confetti(p, n = 160, spread = 6) {
    const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3), vel = [];
    const cs = [0xc8322a, 0xe2b24a, 0x2f6fb0, 0xf3e6c4, 0x2f7a4a, 0xd96a8a].map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) { pos.set([p[0], p[1], p[2]], i * 3); const c = cs[i % cs.length]; colr.set([c.r, c.g, c.b], i * 3); const a = R() * 6.283, e = R() * 1.2; vel.push([Math.cos(a) * Math.cos(e) * spread * (0.5 + R()), 4 + R() * spread * 1.4, Math.sin(a) * Math.cos(e) * spread * (0.5 + R())]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
    const m = new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, depthWrite: false });
    const P = new THREE.Points(g, m); P.frustumCulled = false; scene.add(P); bursts.push({ P, vel, t: 0 });
  }

  /* ---------------- API ---------------- */
  let lay = null;
  function setLayout(L2) {
    lay = L2;
    cans.forEach((c, i) => { const s = L2.cans[i].r / C.r; c.g.scale.setScalar(s); });
    boards.forEach((b, i) => { const R2 = L2.boards[i].R; b.spin.scale.setScalar(R2); });
    ducks.forEach(d => { d.hinge.scale.set(L2.ducks.w / 1.1, L2.ducks.h, L2.ducks.w * 0.6); });
    const br = L2.bell.r; bellMesh.scale.setScalar(br); bellMesh.position.y = 0; yoke.position.y = L.cy + 0.5 * br; clapper.position.y = -br * 1.02;
    const cl = FH - 0.6 - yoke.position.y; chain.scale.y = Math.max(0.1, cl); chain.position.y = cl / 2;
    lead.scale.setScalar(L2.ducks.h * 0.85);
  }
  function setCansDown(down) { cans.forEach((c, i) => { c.down = !!down[i]; c.anim = null; c.inner.rotation.set(0, 0, 0); c.inner.position.set(0, 0, 0); c.g.visible = !c.down; }); }
  function knockCan(i, from) {
    const c = cans[i]; if (!c) return;
    c.down = true; c.anim = { t: 0, side: from && from[0] < c.g.position.x ? 1 : -1, spin: (R() - 0.5) * 2 };
  }
  function restockCans() { cans.forEach(c => { c.down = false; c.anim = { t: 0, up: true }; c.g.visible = true; }); }
  function hitBoard(i) { if (boards[i]) boards[i].anim = 1; }
  function setDuck(i, down) { if (ducks[i]) ducks[i].down = down; }
  function ringBell() { bellSwing = 1; bellFlash = 2.5; confetti([L.x, L.cy, L.z + 2], 260, 8); }

  const api = {
    ...st, groundAt, surfaceAt, setLayout, setCansDown, knockCan, restockCans, hitBoard, setDuck, ringBell, confetti,
    setAim(p) { aimPos = p; aimMark.visible = !!p; },
    setLead(x) { lead.visible = x !== null && x !== undefined; if (lead.visible) lead.position.x = x; },
    animate(clock, dt, { ducksDown = [] } = {}) {
      // bulbs chase
      for (let i = 0; i < bulbs.length; i++) {
        const b = bulbs[i], on = b.group === 3 && bellFlash > 0 ? (Math.floor(clock * 14 + b.k) % 2 ? 1.8 : 0.3) : (Math.floor(clock * 3 - b.k * 0.5) % 3 === 0 ? 1.4 : 0.75);
        bulbM.setColorAt(i, col.set(0xffd890).multiplyScalar(on));
      }
      bulbM.instanceColor.needsUpdate = true;
      // waves rock, gears turn, the wheel and carousel go round
      waves.forEach(w => { w.w.position.x = Math.sin(clock * 0.9 + w.ph) * 2.2; w.w.rotation.z = Math.sin(clock * 0.9 + w.ph + 0.6) * 0.012; });
      gears.forEach(g => { g.wheel.rotation.z += dt * 0.6 * g.dir; });
      wheel.rotation.z = clock * 0.06; gondolas.forEach(g => { g.gd.rotation.z = -wheel.rotation.z; });
      cSpin.rotation.y = clock * 0.35; cSpin.children.forEach((o, k) => { if (k % 2) o.position.y = 3 + Math.sin(clock * 2 + k) * 0.6; });
      tFlag.rotation.y = Math.sin(clock * 2) * 0.3;
      sunCut.position.y = 21 + Math.sin(clock * 0.25) * 4; sunDisc.rotation.z = Math.sin(clock * 0.4) * 0.15;
      plushies.forEach((p, k) => { p.rotation.z = Math.sin(clock * 1.1 + k) * 0.06; });
      balloons.forEach(b => { b.y += b.v * dt; if (b.y > 110) { b.y = 0; b.x = (R() - 0.5) * 300; } b.g.position.set(b.x + Math.sin(clock * 0.3 + b.z) * 4, b.y + 4, b.z); });
      // cans fall off the back of the shelf / pop back up
      for (const c of cans) {
        if (!c.anim) continue; c.anim.t += dt;
        if (c.anim.up) { const u = Math.min(1, c.anim.t / 0.5); c.inner.position.y = -C.h * (1 - u) * (1 - u); c.inner.rotation.set(0, 0, 0); if (u >= 1) c.anim = null; continue; }
        const u = c.anim.t;
        c.inner.rotation.x = -Math.min(Math.PI / 2, u * 4.5); c.inner.rotation.z = c.anim.side * Math.min(0.6, u * 1.4) + c.anim.spin * u;
        c.inner.position.z = -Math.min(3.5, u * 6); c.inner.position.y = u < 0.25 ? u * 2 : Math.max(-C.shelf - 0.2, 0.5 - (u - 0.25) * (u - 0.25) * 28);
        if (u > 1.4) { c.anim = null; c.g.visible = false; }
      }
      // boards spin when hit
      for (const b of boards) { if (b.anim > 0) { b.anim = Math.max(0, b.anim - dt * 0.8); b.spin.rotation.y = (1 - b.anim) * Math.PI * 4 * (1 - b.anim * 0.0); if (b.anim === 0) b.spin.rotation.y = 0; } }
      // ducks glide along the rail; hit ones lie flat until they loop round
      if (lay) ducks.forEach((d, i) => {
        const x = duckX(lay.ducks, i, clock); d.g.position.x = x;
        d.down = !!ducksDown[i];
        d.flip += ((d.down ? 1 : 0) - d.flip) * Math.min(1, dt * (d.down ? 7 : 3));
        d.hinge.rotation.x = -d.flip * Math.PI / 2;
        d.g.visible = x > lay.ducks.x0 + 0.5 && x < lay.ducks.x1 - 0.5;
      });
      // the bell swings and rings
      bellSwing *= Math.exp(-0.6 * dt); bellFlash = Math.max(0, bellFlash - dt);
      yoke.rotation.z = Math.sin(clock * 5) * 0.35 * bellSwing; clapper.position.x = Math.sin(clock * 5 - 1) * 0.6 * bellSwing * (lay ? lay.bell.r : 1);
      // markers
      if (aimPos) { aimMark.position.set(aimPos.x, aimPos.y + 1.6 + Math.sin(clock * 4) * 0.35, aimPos.z); aimMark.rotation.y = clock * 1.5; const k = 0.6 + Math.hypot(aimPos.x, aimPos.z) / 120; aimMark.scale.setScalar(k); }
      lead.material.opacity = 0.75 + 0.25 * Math.sin(clock * 5);
      // confetti
      for (let k = bursts.length - 1; k >= 0; k--) {
        const b = bursts[k]; b.t += dt; const P = b.P.geometry.attributes.position;
        for (let i = 0; i < b.vel.length; i++) { const v = b.vel[i]; v[0] *= Math.exp(-1.5 * dt); v[2] *= Math.exp(-1.5 * dt); v[1] = Math.max(-2.5, v[1] - 9 * dt); P.array[i * 3] += (v[0] + Math.sin(clock * 6 + i) * 0.4) * dt; P.array[i * 3 + 1] = Math.max(0.05, P.array[i * 3 + 1] + v[1] * dt); P.array[i * 3 + 2] += v[2] * dt; }
        P.needsUpdate = true; b.P.material.opacity = Math.max(0, 1 - b.t / 4);
        if (b.t > 4) { scene.remove(b.P); b.P.geometry.dispose(); b.P.material.dispose(); bursts.splice(k, 1); }
      }
    },
    refreshSigns() { /* fonts arrive late: canvases already drew with fallbacks; fine */ },
  };
  return api;
}
