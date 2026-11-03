// The zombie horde for Zombie Siege: shaped, clothed bodies with glowing eyes, drawn as shared
// instanced meshes (one draw per body part, however many zombies), animated on the CPU.
//
//   const horde = createHorde(scene, { groundAt, camera, renderer });
//   horde.add(z)  (z from zombie-logic waveSpawns) · horde.wound(id) · horde.kill(id, from)
//   per frame: horde.update(dt, t, { frozen })      · horde.clear()
//
// Models face +z (toward the fence and the tee). Limbs hang from their joint; rotation.x < 0 swings
// a limb forward. Each zombie gets its own gait: a limp, how it holds its arms, a hunch, a head loll.

import { TYPES } from './zombie-logic.js';

const CAP = 220;

/* ---------- geometry ---------- */
// merge geometries; each piece may carry a vertex colour (multiplied by the instance colour)
function merge(pieces) {
  const parts = pieces.map(([g, shade = 1]) => {
    const n = g.index ? g.toNonIndexed() : g;
    const cnt = n.attributes.position.count, col = new Float32Array(cnt * 3).fill(shade);
    return { n, cnt, col };
  });
  const total = parts.reduce((a, p) => a + p.cnt, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.n.attributes.position.array, o * 3); nor.set(p.n.attributes.normal.array, o * 3);
    if (p.n.attributes.uv) uv.set(p.n.attributes.uv.array, o * 2);
    col.set(p.col, o * 3); o += p.cnt;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const at = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; };
const capsule = (r, len, top = 0) => at(new THREE.CapsuleGeometry(r, len, 2, 7), 0, top - (len / 2 + r), 0);
function ragged(rTop, rBot, h, y, seed) { // an open, torn hem
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 10, 1, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453 % 1) * h * 1.1);
  g.computeVertexNormals(); g.translate(0, y, 0); return g;
}
function buildGeometry() {
  const G = {};
  G.thigh = merge([[capsule(0.085, 0.34)], [ragged(0.088, 0.09, 0.06, -0.48, 2), 0.9]]);
  G.shin = merge([[capsule(0.068, 0.34)], [at(new THREE.BoxGeometry(0.11, 0.07, 0.25), 0, -0.47, 0.05), 0.35]]);
  // torso: oval chest, a hunched upper back, a torn shirt hem
  const chest = at(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 12, 2), 0, 0.3, 0, 1, 1, 0.62);
  const hump = at(new THREE.SphereGeometry(0.13, 8, 6), 0, 0.53, -0.05, 1.65, 0.62, 1);
  G.torso = merge([[chest], [hump], [ragged(0.165, 0.18, 0.1, 0.0, 5)]]);
  // head: neck, skull, a slack jaw, dark sockets and mouth (the glowing eyes are separate)
  G.head = merge([
    [at(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 8), 0, 0.05, 0)],
    [at(new THREE.SphereGeometry(0.115, 11, 8), 0, 0.2, 0, 0.92, 1.08, 1)],
    [at(new THREE.BoxGeometry(0.15, 0.06, 0.12), 0, 0.1, 0.035, 1, 1, 1, 0.25), 0.92],
    [at(new THREE.SphereGeometry(0.032, 6, 4), -0.043, 0.215, 0.092), 0.12],
    [at(new THREE.SphereGeometry(0.032, 6, 4), 0.043, 0.215, 0.092), 0.12],
    [at(new THREE.BoxGeometry(0.085, 0.03, 0.03), 0, 0.128, 0.098), 0.08],
    [at(new THREE.SphereGeometry(0.06, 6, 4), 0.03, 0.29, -0.03, 1.4, 0.5, 1.3), 0.45],   // matted hair
  ]);
  G.eyes = merge([[at(new THREE.SphereGeometry(0.019, 6, 4), -0.043, 0.215, 0.112)], [at(new THREE.SphereGeometry(0.019, 6, 4), 0.043, 0.215, 0.112)]]);
  G.upperArm = merge([[capsule(0.056, 0.22)], [ragged(0.06, 0.064, 0.05, -0.2, 9), 0.9]]);
  G.foreArm = merge([[capsule(0.045, 0.2)], [at(new THREE.BoxGeometry(0.07, 0.1, 0.04), 0, -0.34, 0.01)], [at(new THREE.BoxGeometry(0.06, 0.07, 0.02), 0, -0.42, 0.02), 0.85]]);
  G.hat = merge([[at(new THREE.CylinderGeometry(0.21, 0.23, 0.015, 16), 0, 0.29, 0)], [at(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12), 0, 0.34, 0)], [at(new THREE.CylinderGeometry(0.121, 0.121, 0.025, 12), 0, 0.305, 0), 0.4]]);
  G.belly = merge([[at(new THREE.SphereGeometry(0.33, 12, 9), 0, 0.3, 0.1, 1.1, 1, 1.05)]]);
  const boils = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + 0.3, b = 0.15 + (i % 3) * 0.35, r = 0.035 + (i % 4) * 0.012;
    boils.push([at(new THREE.SphereGeometry(r, 6, 4), Math.sin(a) * 0.33 * Math.cos(b - 0.5), 0.3 + Math.sin(b - 0.5) * 0.3, 0.1 + Math.cos(a) * 0.35 * Math.cos(b - 0.5))]);
  }
  G.boils = merge(boils);
  return G;
}

/* ---------- fabric texture (greyscale: the instance colour tints it) ---------- */
function fabricTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 128, 128);
  g.globalAlpha = 0.28; g.fillStyle = '#5a5a5a';
  for (let i = 0; i < 128; i += 32) { g.fillRect(i, 0, 10, 128); g.fillRect(0, i, 128, 10); }             // a faded plaid
  g.globalAlpha = 0.18; for (let i = 16; i < 128; i += 32) { g.fillRect(i, 0, 3, 128); g.fillRect(0, i, 128, 3); }
  g.globalAlpha = 1;
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(30,24,18,${0.08 + Math.random() * 0.18})`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 9, 0, 7); g.fill(); } // grime
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(10,8,6,0.75)'; g.beginPath(); g.ellipse(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 5, 1 + Math.random() * 3, Math.random() * 3, 0, 7); g.fill(); } // holes
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
}
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv);
}

/* ---------- palettes ---------- */
const SKIN = [0x7d8f6a, 0x8a977a, 0x6f7d66, 0x9aa38a, 0x7a8670, 0x8c8a78];
const SHIRT = [0x6a2a24, 0x7a3a2a, 0x34465e, 0x9a9688, 0x3e4a32, 0x5a4636, 0x4a2a3a, 0x2e2e30];
const PANTS = [0x2e3d55, 0x3a3a3a, 0x6a5e44, 0x34507a, 0x4a4036, 0x2a3a2a];
const pick = a => a[Math.floor(Math.random() * a.length)];
const EYE = { walker: 0xffd85a, pack: 0xffc04a, tank: 0xff3a2a, bloater: 0xb6ff5a };

export function createHorde(scene, { groundAt, camera, renderer }) {
  const GEO = buildGeometry(), fabric = fabricTexture();
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, vertexColors: true, envMapIntensity: 0.2, ...opts });
  const MATS = { skin: std({}), cloth: std({ map: fabric }), pants: std({ map: fabric }), hat: std({ roughness: 1 }) };
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, fog: false, vertexColors: true });
  // part name → [geometry, material, instances per zombie]
  const DEF = {
    torso: [GEO.torso, MATS.cloth, 1], head: [GEO.head, MATS.skin, 1], upperArm: [GEO.upperArm, MATS.cloth, 2], foreArm: [GEO.foreArm, MATS.skin, 2],
    thigh: [GEO.thigh, MATS.pants, 2], shin: [GEO.shin, MATS.pants, 2], hat: [GEO.hat, MATS.hat, 1], belly: [GEO.belly, MATS.skin, 1],
    boils: [GEO.boils, glow(0xffffff), 1], eyes: [GEO.eyes, glow(0xffffff), 1],
  };
  const P = {};
  for (const [k, [g, m, n]] of Object.entries(DEF)) {
    const im = new THREE.InstancedMesh(g, m, CAP * n);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
    im.castShadow = ['torso', 'head', 'thigh', 'belly'].includes(k); // the big parts are enough for a shadow
    const zero = new THREE.Matrix4().makeScale(0, 0, 0), c = new THREE.Color(1, 1, 1);
    for (let i = 0; i < CAP * n; i++) { im.setMatrixAt(i, zero); im.setColorAt(i, c); }
    im.count = 0; scene.add(im); P[k] = { im, n };
  }
  // eye glints that stay a few pixels wide at any distance: pairs of eyes in the dark
  const gPos = new Float32Array(CAP * 2 * 3), gCol = new Float32Array(CAP * 2 * 3);
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3)); gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  const glints = new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 4.2 * renderer.getPixelRatio(), sizeAttenuation: false, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  glints.frustumCulled = false; glints.renderOrder = 6; scene.add(glints);

  const list = new Map(); const free = []; let hi = 0;
  const slot = () => (free.length ? free.pop() : hi++);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function clearSlot(s) { for (const { im, n } of Object.values(P)) for (let k = 0; k < n; k++) im.setMatrixAt(s * n + k, ZERO); for (let k = 0; k < 2; k++) gPos.set([0, -999, 0], (s * 2 + k) * 3); }

  function add(z) {
    const type = z.type, r = Math.random;
    const h = {
      z, s: slot(), type,
      skin: new THREE.Color(type === 'bloater' ? 0x9aae58 : pick(SKIN)),
      shirt: new THREE.Color(type === 'tank' ? pick([0x2a2a30, 0x3a2e26, 0x34405a]) : pick(SHIRT)),
      pants: new THREE.Color(type === 'tank' ? 0x2e3a52 : pick(PANTS)),
      hat: new THREE.Color(0xb09a5a).offsetHSL(0, 0, (r() - 0.5) * 0.15),
      eye: new THREE.Color(EYE[type]),
      hasHat: type === 'walker' && r() < 0.28,
      base: TYPES[type].scale * (type === 'pack' ? 0.86 + r() * 0.1 : type === 'tank' ? 1 : 0.94 + r() * 0.12),
      limp: r() < 0.45 ? (r() < 0.5 ? -1 : 1) : 0,            // which leg drags
      arms: type === 'tank' ? 2 : Math.floor(r() * 3),          // 0 both reaching · 1 one reaching · 2 dangling
      hunch: 0.15 + r() * 0.25 + (type === 'tank' ? 0.15 : 0),
      ph: r() * 6.28, loll: (r() - 0.5) * 0.6, twitch: 0, stumble: 0,
      wound: 0, dead: null, rise: z.grave ? 0 : -1, yaw: (r() - 0.5) * 0.3,
    };
    if (h.type === 'bloater') h.shirt.copy(h.skin);
    for (const c of [h.skin, h.shirt, h.pants]) c.multiplyScalar(1.35); // a touch brighter so they read under moonlight
    list.set(z.id, h);
    return h;
  }
  function remove(id) { const h = list.get(id); if (!h) return; clearSlot(h.s); free.push(h.s); list.delete(id); }
  function clear() { for (const id of [...list.keys()]) remove(id); free.length = 0; hi = 0; for (const { im } of Object.values(P)) im.count = 0; }
  function wound(id) { const h = list.get(id); if (h) h.wound = 1; }
  function kill(id, from) {
    const h = list.get(id); if (!h || h.dead) return;
    const z = h.z, dx = z.x - from.x, dz = z.z - from.z, d = Math.hypot(dx, dz) || 1, power = Math.max(4, 16 - d * 0.8);
    h.dead = { vx: dx / d * power, vy: 6 + Math.random() * 6, vz: dz / d * power, sx: (Math.random() - 0.5) * 10, sz: (Math.random() - 0.5) * 10, rx: 0, rz: 0, y: 0, t: 0, landed: false };
  }

  /* ---------- skeleton ---------- */
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), L = new THREE.Matrix4();
  const M = { root: new THREE.Matrix4(), hips: new THREE.Matrix4(), torso: new THREE.Matrix4(), head: new THREE.Matrix4(), a: new THREE.Matrix4(), b: new THREE.Matrix4() };
  function joint(out, parent, px, py, pz, rx, ry, rz, sx = 1, sy = 1, sz = 1) { e.set(rx, ry, rz, 'YXZ'); q.setFromEuler(e); L.compose(v.set(px, py, pz), q, sc.set(sx, sy, sz)); return out.multiplyMatrices(parent, L); }
  const put = (part, k, m) => P[part].im.setMatrixAt(k, m);
  const col = new THREE.Color(), FROZEN = new THREE.Color(0x7ad0ff), HURT = new THREE.Color(0xff2a1a);
  function tinted(base, h, frozen, t) {
    col.copy(base);
    if (h.wound) col.lerp(HURT, 0.35 + 0.25 * Math.sin(t * 8));
    if (frozen && !h.dead) col.lerp(FROZEN, 0.55);
    return col;
  }

  function update(dt, t, { frozen = false } = {}) {
    const H = innerHeight, tanF = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    for (const [id, h] of list) {
      const z = h.z, s = h.s;
      if (z.delay > 0 && !h.dead) { clearSlot(s); continue; }
      const T = h.type, tank = T === 'tank', bloat = T === 'bloater';
      let x = z.x, y = groundAt(z.x, z.z), zz = z.z;
      // keep far zombies a readable size on a phone screen
      const d = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - zz);
      const px = 1.8 * h.base * H / (2 * tanF * d), S = h.base * Math.min(1.6, Math.max(1, 11 / px)); // far ones grow a little to stay readable; the eye glints do the rest
      const still = frozen && !h.dead;
      if (!still) h.ph += dt * (tank ? 4 : 5.2) * (z.speed / 1.4);
      const ph = h.ph;
      // pose (radians): defaults are a shambling walk
      let hipY = 0.93, hipRoll = 0, torsoX = h.hunch, torsoZ = 0, headX = 0.1, headZ = h.loll, rootRX = 0, rootRZ = 0;
      const legs = [0, 0], knees = [0, 0], arms = [[0, 0, 0], [0, 0, 0]]; // [shoulder x, shoulder z, elbow]
      if (h.dead) {
        const D = h.dead; D.t += dt;
        if (!D.landed) { D.vy -= 22 * dt; D.y += D.vy * dt; D.rx += D.sx * dt; D.rz += D.sz * dt; z.x += D.vx * dt; z.z += D.vz * dt; if (D.y <= 0 && D.vy < 0) { D.landed = true; D.y = 0; D.rx = Math.PI / 2 * Math.sign(D.rx || 1); D.rz *= 0.2; } }
        else D.y -= dt * 0.35;
        x = z.x; zz = z.z; y = groundAt(x, zz) + D.y + (D.landed ? 0.12 : 0); rootRX = D.rx; rootRZ = D.rz;
        const fl = D.landed ? 0 : 1;
        arms[0] = [-1.2 + Math.sin(t * 17) * 1.2 * fl, -0.5, -0.4]; arms[1] = [-1.0 + Math.cos(t * 15) * 1.2 * fl, 0.5, -0.4];
        legs[0] = Math.sin(t * 13) * 0.6 * fl; legs[1] = -Math.sin(t * 13) * 0.6 * fl; knees[0] = knees[1] = 0.4;
        if (D.t > 3.6) { remove(id); continue; }
      } else if (z.state === 'attack') {
        const c = ph * 2.1;
        torsoX = 0.38 + Math.sin(c) * 0.1; headX = -0.1 + Math.sin(c + 1) * 0.15;
        arms[0] = [-1.7 + Math.sin(c) * 0.6, -0.15, -0.5 - Math.max(0, Math.sin(c)) * 0.6];
        arms[1] = [-1.7 + Math.cos(c) * 0.6, 0.15, -0.5 - Math.max(0, Math.cos(c)) * 0.6];
        knees[0] = knees[1] = 0.25; legs[0] = legs[1] = -0.1;
      } else {
        for (let i = 0; i < 2; i++) {
          const p = ph + i * Math.PI, dragging = h.limp === (i ? 1 : -1);
          legs[i] = -Math.sin(p) * (dragging ? 0.22 : 0.5);
          knees[i] = dragging ? 0.08 : Math.max(0, Math.sin(p + 1.3)) * 0.85 + 0.08;
        }
        hipY = 0.93 - (h.limp ? Math.max(0, Math.sin(ph * (h.limp > 0 ? 1 : -1))) * 0.06 : 0) + Math.abs(Math.sin(ph)) * 0.025;
        hipRoll = h.limp * Math.sin(ph) * 0.06 + Math.sin(ph) * 0.03;
        torsoZ = Math.sin(ph) * 0.07 - hipRoll * 0.8;
        headZ = h.loll + Math.sin(ph * 0.31 + h.yaw * 9) * 0.22;
        headX = 0.1 + Math.sin(ph * 0.5) * 0.06;
        const sway = Math.sin(ph * 0.5) * 0.14;
        if (h.arms === 0) { arms[0] = [-1.35 + sway, -0.05, -0.15]; arms[1] = [-1.3 - sway, 0.05, -0.2]; }
        else if (h.arms === 1) { arms[0] = [-0.15 + Math.sin(ph) * 0.25, -0.12, -0.1]; arms[1] = [-1.4 + sway, 0.05, -0.25]; }
        else { arms[0] = [Math.sin(ph) * 0.35, -0.1, -0.25]; arms[1] = [-Math.sin(ph) * 0.35, 0.1, -0.25]; torsoX += 0.12; headZ *= 1.4; headX = 0.3; }
        // now and then: a stumble, or a twitch of the head
        if (!still) {
          if (h.stumble <= 0 && Math.random() < dt * 0.05) h.stumble = 0.8;
          if (h.twitch <= 0 && Math.random() < dt * 0.25) h.twitch = 0.25;
          h.stumble = Math.max(0, h.stumble - dt); h.twitch = Math.max(0, h.twitch - dt);
        }
        if (h.stumble > 0) { const k = Math.sin(h.stumble / 0.8 * Math.PI); torsoX += k * 0.45; arms[0][0] -= k * 0.5; arms[1][0] -= k * 0.4; hipY -= k * 0.06; }
        if (h.twitch > 0) headZ += Math.sin(h.twitch * 60) * 0.25;
        // clawing up out of a grave
        if (h.rise >= 0) {
          h.rise += dt; const u = Math.min(1, h.rise / 2.4), ease = 1 - Math.pow(1 - u, 2);
          y -= (1 - ease) * 1.9; torsoX += (1 - ease) * 0.5;
          arms[0] = [-2.7 + Math.sin(t * 7) * 0.4 * (1 - u), -0.2, -0.3]; arms[1] = [-2.6 + Math.cos(t * 6) * 0.4 * (1 - u), 0.2, -0.3];
          if (u >= 1) h.rise = -1;
        }
      }
      if (still) { /* frozen mid-step: keep the pose of the moment */ }
      h.wound = h.wound ? 1 : 0;

      // body proportions per type
      const tw = tank ? 1.45 : 1, th = tank ? 1.12 : 1;
      joint(M.root, M.a.identity(), x, y, zz, rootRX, h.yaw * (h.dead ? 0 : 1), rootRZ, S, S, S);
      joint(M.hips, M.root, 0, hipY, 0, 0, 0, hipRoll);
      joint(M.torso, M.hips, 0, 0, 0, torsoX, 0, torsoZ, tw, th, tank ? 1.35 : bloat ? 1.1 : 1);
      put('torso', s, M.torso);
      // head (undo the torso's stretch so it isn't squashed)
      joint(M.head, M.hips, 0, 0, 0, torsoX, 0, torsoZ); joint(M.head, M.head, 0, 0.6 * th, tank ? 0.04 : 0, headX, 0, headZ, tank ? 1.1 : 1, tank ? 1.1 : 1, tank ? 1.1 : 1);
      put('head', s, M.head); put('eyes', s, M.head);
      put('hat', s, h.hasHat ? M.head : ZERO);
      put('belly', s, bloat ? M.torso : ZERO); put('boils', s, bloat ? M.torso : ZERO);
      // arms hang from the shoulders
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, [ax, az, el] = arms[i];
        joint(M.a, M.hips, 0, 0, 0, torsoX, 0, torsoZ);
        joint(M.a, M.a, side * 0.22 * tw, 0.54 * th, 0, ax, 0, az + side * (bloat ? 0.35 : 0.08), tank ? 1.5 : 1, tank ? 1.1 : 1, tank ? 1.5 : 1);
        put('upperArm', s * 2 + i, M.a);
        joint(M.b, M.a, 0, -0.33, 0, el, 0, 0);
        put('foreArm', s * 2 + i, M.b);
      }
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        joint(M.a, M.hips, side * 0.1 * (tank ? 1.3 : 1), 0, 0, legs[i], 0, side * 0.03, tank ? 1.35 : 1, 1, tank ? 1.35 : 1);
        put('thigh', s * 2 + i, M.a);
        joint(M.b, M.a, 0, -0.46, 0, knees[i], 0, 0);
        put('shin', s * 2 + i, M.b);
      }
      // colours (tinted when hurt or frozen)
      P.torso.im.setColorAt(s, tinted(h.shirt, h, frozen, t)); P.belly.im.setColorAt(s, tinted(h.skin, h, frozen, t));
      P.head.im.setColorAt(s, tinted(h.skin, h, frozen, t)); P.hat.im.setColorAt(s, tinted(h.hat, h, frozen, t));
      for (let i = 0; i < 2; i++) { P.upperArm.im.setColorAt(s * 2 + i, tinted(h.shirt, h, frozen, t)); P.foreArm.im.setColorAt(s * 2 + i, tinted(h.skin, h, frozen, t)); P.thigh.im.setColorAt(s * 2 + i, tinted(h.pants, h, frozen, t)); P.shin.im.setColorAt(s * 2 + i, tinted(h.pants, h, frozen, t)); }
      const pulse = 0.65 + 0.35 * Math.sin(t * 3 + h.ph);
      P.boils.im.setColorAt(s, col.setRGB(0.6 * pulse, 1.0 * pulse, 0.25 * pulse));
      const eyeOn = h.dead ? Math.max(0, 1 - h.dead.t * 2) : frozen ? 0.5 : 1;
      P.eyes.im.setColorAt(s, col.copy(h.eye).multiplyScalar(eyeOn * 1.6));
      // glints: the eyes, and a bloater's belly glow
      v.set(0, 0.215, 0.12).applyMatrix4(M.head); gPos.set([v.x, v.y, v.z], s * 6);
      col.copy(h.eye).multiplyScalar(eyeOn * (frozen ? 0.5 : 1)); gCol.set([col.r, col.g, col.b], s * 6);
      if (bloat && !h.dead) { v.set(0, 0.3, 0.42).applyMatrix4(M.torso); gPos.set([v.x, v.y, v.z], s * 6 + 3); gCol.set([0.4 * pulse, 0.9 * pulse, 0.2 * pulse], s * 6 + 3); }
      else gPos.set([0, -999, 0], s * 6 + 3);
    }
    for (const { im, n } of Object.values(P)) { im.count = hi * n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    gGeo.setDrawRange(0, hi * 2); gGeo.attributes.position.needsUpdate = true; gGeo.attributes.color.needsUpdate = true;
  }

  return { add, remove, clear, wound, kill, update, get: id => list.get(id), has: id => list.has(id), get size() { return list.size; } };
}
