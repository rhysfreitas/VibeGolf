// The Lost Valley (global THREE): what COURSE.valley holds (world space) put into a hole's frame (hole.frame) and
// drawn. A blockout, ahead of its art pass: the valley floor and the table mountain's walls from the height maps
// (sandstone faces in the ground shader's VALLEY branch, jungle on the talus), the far mesas on the skyline, the water
// (the braided river, the swamp's pools, the creek, the plunge pool) and the tar, the Great Falls and the ribbon
// falls off the walls with their mist, the trees (cycads, tree ferns, monkey-puzzles and the giant, broadleaves, swamp
// cypresses, the Strangler and its root arch), the camp and the lookout, the rope bridge, the bones in the Bone Bluff
// and the tar pit, and the animals (long-necks, small plant-eaters, the hunter, pterosaurs wheeling over the east
// wall). The ball's side of it (boulders, the spire, the arch, the hut, the trees) is in the course module, terrain.js
// and trees.js; everything here is drawn only.
import { rng, fbm } from './noise.js';
import { unpackHeights } from './field-code.js';
import { makeFlight } from './ptero-flight.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
export const TYPES = new Set(['cycad', 'fern', 'conifer', 'giant', 'broad', 'cypress', 'fig']);
function batch() {
  const pos = [], col = [];
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k[0], k[1], k[2]); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const mesh = (mat, shadow = true) => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  return { tri, quad, mesh };
}
// the paint byte: 0 meadow, 1 jungle floor, 2 rock, 3 rubble, 4 mud, 5 gravel, 6 the camp's trodden ground, 7 tar,
// 8 water, 9 the bluff's rock, 10 (world map only) a hole's mown ground
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, VALLEY) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B bunker (sand 1, waste and the gravel bars 0.5), A grass length
// B: R jungle floor, G mud (1; the camp's trodden ground 0.5), B river gravel, A rock and rubble
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f;
      if (m === 1) w[3] += f; else if (m === 4) w[4] += f; else if (m === 6) w[4] += f * 0.5; else if (m === 5) w[5] += f; else if (m === 2 || m === 3 || m === 9) w[6] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'sand', 'waste', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = 0; a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else {
      const bar = s === 'sand' && matAt(hole, x, z) === 5;
      a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = s === 'sand' && !bar ? 255 : s === 'waste' || bar ? 128 : 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255;
    }
    const mown = ['green', 'fringe', 'tee', 'fairway', 'sand', 'waste'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[3]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[4]) * 255 * mown);
    b[o + 2] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 3] = Math.round(Math.min(1, own[6]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#5f7a3a', rough: '#4d7a2e', firstcut: '#5a8a36', fairway: '#6fa843', fringe: '#79b44a', green: '#8acb5c', tee: '#80b052', sand: '#e6dcbc', waste: '#c9bc98', water: '#3f7f8c', void: '#15110f' };
  const M = { 1: '#34502a', 2: '#7d6c66', 3: '#8a7b70', 4: '#5a4a32', 5: '#a9a291', 6: '#8a7454', 7: '#121010', 9: '#7d6c66' };
  return (x, z) => { const s = T.surfaceAt(x, z), m = matAt(hole, x, z); if (s === 'water' && m === 7) return M[7]; if (s === 'sand' && m === 5) return M[5]; if (s === 'desert' && M[m]) return M[m]; return C[s] || '#5f7a3a'; };
}
// what a native lie is called, from the paint under the ball
export function lieName(hole, x, z) { return { 0: 'Meadow', 1: 'Jungle', 2: 'Rock', 3: 'Rubble', 4: 'Mud', 5: 'Gravel', 6: 'Camp', 9: 'Rock' }[matAt(hole, x, z)] || 'Meadow'; }
// tar or water at a point (the toast)
export const isTar = (hole, x, z) => matAt(hole, x, z) === 7;

/* ---------- textures and shapes made once ---------- */
let TEX = null;
function makeTextures() {
  const glow = stops => { const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); for (const [t, c] of stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  // a waterfall: white streaks of falling water over a darker sheet, tiling down (v)
  const fall = (() => {
    const W = 128, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), R = rng(23);
    g.fillStyle = 'rgba(190,210,215,0.55)'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { const x = R() * W, w = 1 + R() * 4, y = R() * H, l = 30 + R() * 140, a = 0.25 + R() * 0.6; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; for (const oy of [-H, 0, H]) g.fillRect(x, y + oy, w, l); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  return {
    fall,
    mist: glow([[0, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(245,248,250,0.3)'], [1, 'rgba(240,244,248,0)']]),
    fire: glow([[0, 'rgba(255,230,160,1)'], [0.35, 'rgba(255,140,40,0.7)'], [1, 'rgba(200,60,0,0)']]),
  };
}
const lump = (seed, detail = 1, amp = 0.4) => { const geo = new THREE.IcosahedronGeometry(1, detail), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + seed, p.getZ(i) * 2 + p.getY(i)) - 0.5) * amp * 2; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); } geo.computeVertexNormals(); return geo; };
let SH = null;
function shapes() {
  if (SH) return SH;
  const keep = g => { g.userData.keep = true; return g; };
  const trunk = keep(new THREE.CylinderGeometry(0.75, 1, 1, 5, 1, true).translate(0, 0.5, 0));
  // a frond crown: blades radiating from a point, arching up then out and down (cycads, tree ferns)
  const crown = (n, droop) => { const pos = [], R = rng(n * 7 + droop * 10);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R() * 0.3, up = 0.35 + R() * 0.4, ca = Math.cos(a), sa = Math.sin(a), wa = 0.11;
      const P = t => [ca * t, (up * t - droop * t * t) , sa * t], A = P(0), B = P(0.55), C = P(1);
      const side = (p, w) => [[p[0] - sa * w, p[1], p[2] + ca * w], [p[0] + sa * w, p[1], p[2] - ca * w]];
      const [b1, b2] = side(B, wa), [c1, c2] = side(C, 0.02);
      pos.push(...A, ...b1, ...b2, ...b1, ...c1, ...c2, ...b1, ...c2, ...b2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return keep(g); };
  const disc = keep(new THREE.CylinderGeometry(1, 0.85, 0.22, 11).translate(0, 0, 0));
  const blob = keep(lump(3, 0, 0.18));   // 20 faces: thousands of these on the talus
  const cone = keep(new THREE.ConeGeometry(1, 1, 9).translate(0, 0.5, 0));
  return (SH = { trunk, cycad: crown(14, 0.55), fern: crown(11, 0.9), disc, blob, cone });
}

/* ---------- the Overlook's pterosaur: a giant crested pterosaur, about 12 m across the wings ---------- */
// root at its feet (its position and heading from ptero-flight.js); body, neck, a long beak and a crest swept back;
// each wing a shoulder joint (flap, fold down and forward) holding the arm's membrane and a wrist joint holding the
// long outer membrane, which folds back along the arm when it perches
function pteranodon() {
  const skin = new THREE.MeshStandardMaterial({ color: 0x7a6452, roughness: 0.85 });
  // the wing membranes glow warm where the low sun comes through them
  const memb = new THREE.MeshStandardMaterial({ color: 0xb08660, roughness: 0.8, side: THREE.DoubleSide, emissive: 0x6a3212, emissiveIntensity: 0.55 });
  const crestM = new THREE.MeshStandardMaterial({ color: 0x9c3a20, roughness: 0.7 }), beakM = new THREE.MeshStandardMaterial({ color: 0xcbb48a, roughness: 0.6 });
  const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.name = 'ptero';
  const body = new THREE.Group(); body.position.y = 0.9; body.scale.setScalar(1.6); root.add(body);   // 1.6 x a Pteranodon
  const add = (geo, mat, pos, rot, g = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(1, 10, 8).scale(0.32, 0.34, 0.75), skin, [0, 0, 0.1]);
  add(new THREE.CylinderGeometry(0.1, 0.14, 0.75, 6), skin, [0, 0.28, -0.62], [-0.75, 0, 0]);
  const head = new THREE.Group(); head.position.set(0, 0.55, -0.95); body.add(head);
  add(new THREE.SphereGeometry(0.17, 8, 6), skin, [0, 0, 0], null, head);
  add(new THREE.ConeGeometry(0.12, 1.35, 6), beakM, [0, -0.05, -0.72], [-Math.PI / 2 - 0.08, 0, 0], head);
  add(new THREE.ConeGeometry(0.11, 1.05, 4).scale(0.35, 1, 1.6), crestM, [0, 0.22, 0.48], [Math.PI / 2 + 0.55, 0, 0], head);
  for (const sx of [-0.14, 0.14]) add(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 5), skin, [sx, -0.3, 0.75], [0.9, 0, 0]);
  const tri = (pts, mat, g) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  const wings = [-1, 1].map(sg => {
    const shoulder = new THREE.Group(); shoulder.position.set(sg * 0.24, 0.12, -0.35); body.add(shoulder);
    tri([[0, 0, 0], [sg * 1.35, 0.05, -0.05], [sg * 1.35, 0, 0.55], [0, 0, 0], [sg * 1.35, 0, 0.55], [sg * 0.05, -0.1, 0.95]], memb, shoulder);
    add(new THREE.CylinderGeometry(0.05, 0.07, 1.35, 5), skin, [sg * 0.68, 0.03, -0.03], [0, 0, Math.PI / 2], shoulder);
    const wrist = new THREE.Group(); wrist.position.set(sg * 1.35, 0.05, -0.05); shoulder.add(wrist);
    tri([[0, 0, 0], [sg * 2.25, 0.1, 0.62], [sg * 0.05, 0, 0.6]], memb, wrist);
    add(new THREE.CylinderGeometry(0.025, 0.05, 2.3, 4), skin, [sg * 1.12, 0.05, 0.3], [0, sg * -0.27, Math.PI / 2], wrist);
    return { sg, shoulder, wrist };
  });
  return { root, body, head, wings };
}
function poseModel(M, s) {
  M.root.position.set(s.p[0], s.p[1], s.p[2]);
  M.root.rotation.set(s.pitch, s.yaw, s.bank);
  M.body.position.y = 1.45 * (0.35 + 0.65 * s.fold) - 0.4 * s.crouch;
  M.head.rotation.x = -0.25 * s.fold;   // head held up on the perch
  for (const W of M.wings) {
    W.shoulder.rotation.set(0, W.sg * 0.55 * s.fold, W.sg * (s.flap - 1.25 * s.fold));
    W.wrist.rotation.set(0, -W.sg * 2.75 * s.fold, 0);
  }
}

export function buildValley(hole, T, box, E, hi, { group, coarse, groundMat, rockMat, sunDir = null, perch = true }) {
  if (!TEX) TEX = makeTextures();
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const R = rng(hi * 131 + 7), trees = [], anims = [];
  let ptero = null;
  const far = coarse ? 1900 : 2800;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x1d3733, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.92, envMapIntensity: 0.3 });
  const tarMat = new THREE.MeshStandardMaterial({ color: 0x0a0907, roughness: 0.42, metalness: 0, envMapIntensity: 0.25 });
  const Bw = batch(), Bt = batch();   // water, tar

  // ---- the valley and the walls, from the 10 m map: this hole's field where it has one (so the edges meet the
  // playfield). Drawn in the ground shader (aW: x jungle, y mud, z gravel, w rock), so the faces get the sandstone
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  // the valley's ground at a point in this hole's frame, from the 10 m map (null off it)
  const worldFloor = (x, z) => { const X = F.x + x * rx - z * fx, Z = F.z + x * rz - z * fz, i = Math.round((X - WM.x0) / WM.cell), j = Math.round((Z - WM.z0) / WM.cell); return i < 0 || j < 0 || i >= WM.nx || j >= WM.nz ? null : LY(wH(i, j)); };
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  {
    const st = coarse ? 2 : 1, ni = Math.floor((WM.nx - 1) / st), nj = Math.floor((WM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Mk = new Uint8Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)); const m = WM.mDec[J * WM.nx + I];
      const wet = m === 7 || m === 8;
      if (inField(x, z) && !wet) { const g = T.groundAt(x, z); if (g !== null) y = g; }
      Vt.set([x, wet ? y - 0.9 : y - 0.3, z], k * 3); Mk[k] = m;
      Wt.set([m === 1 ? 1 : 0, m === 4 || wet ? 1 : 0, m === 5 ? 1 : 0, m === 2 || m === 3 || m === 9 ? 1 : 0], k * 4);
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      const xs = [Vt[k * 3], Vt[k1 * 3], Vt[k2 * 3], Vt[k3 * 3]], zs = [Vt[k * 3 + 2], Vt[k1 * 3 + 2], Vt[k2 * 3 + 2], Vt[k3 * 3 + 2]];
      if (xs.every((x, q) => inPlay(x, zs[q]))) continue;
      const wv = [k, k1, k2, k3].filter(q => Mk[q] === 7 || Mk[q] === 8);
      if (wv.length >= 2) {   // water or tar: a flat sheet at its level (the ground is drawn under it)
        const ly = wv.reduce((s, q) => s + Vt[q * 3 + 1], 0) / wv.length + 0.9, P = q => [Vt[q * 3], ly, Vt[q * 3 + 2]];
        (wv.some(q => Mk[q] === 7) ? Bt : Bw).quad(P(k), P(k2), P(k3), P(k1), [1, 1, 1]);
      }
      // split each cell along its flatter diagonal, so the rim of a 400 m wall doesn't saw-tooth
      if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3);
    }
    group.add(groundMesh(Vt, Wt, idx));
  }
  // ---- out past the walls: the table mountain's top and the far mesas, from the 50 m map
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); }
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 30, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 30, iz0 = WM.z0 + 30, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 30;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, yw = FM.hDec[J * FM.nx + I] / FM.scale + FM.y0;
      Vt.set([x, LY(yw) - 1, z], k * 3); Wx.set([X, Z], k * 2);
      Wt.set([fbm(X / 400, Z / 400) > 0.45 ? 1 : 0.4, 0, 0, 0], k * 4);   // the top: dark scrub and bog over black rock
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }

  // ---- the near water and tar: the field's water cells as a sheet at the level (rivers and the creek follow their slope)
  if (Fd && Fd.ready) {
    const cw = Fd.codes.indexOf('water'), Hh = Fd.h;
    if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, ks = [k, k + 1, k + Fd.nx + 1, k + Fd.nx], w = ks.filter(q => Fd.s[q] === cw);
      if (!w.length) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell;
      if (!(x > box.x0 - 40 && x < box.x1 + 40 && z > box.z0 - 40 && z < box.z1 + 40)) continue;
      const mean = w.reduce((s, q) => s + Hh[q], 0) / w.length + 0.8, Y = q => (Fd.s[q] === cw ? Hh[q] + 0.8 : mean), c = Fd.cell;
      (w.some(q => Fd.mDec[q] === 7) ? Bt : Bw).quad([x, Y(ks[0]), z], [x, Y(ks[3]), z + c], [x + c, Y(ks[2]), z + c], [x + c, Y(ks[1]), z], [1, 1, 1]);
    }
  }
  for (const [B, mat] of [[Bw, waterMat], [Bt, tarMat]]) { const m = B.mesh(mat, false); if (m) { m.renderOrder = 1; group.add(m); } }

  // ---- the falls: a sheet off each lip, free-falling to the foot, with mist where it lands
  const fallMats = [];
  for (const Fl of E.falls) {
    const P0 = Fl.pts[0], P1 = Fl.pts.at(-1), [x0, z0] = L(P0[0], P0[1]), [x1, z1] = L(P1[0], P1[1]);
    if (!near(x0, z0, far * 1.6)) continue;
    const yTop = LY(P0[2]) + 1, yFoot = LY(P1[2]), n = Fl.big ? 30 : 16, dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    const pos = [], uv = [];
    for (let i = 0; i < n; i++) {
      const pt = t => { const k = Math.pow(t, Fl.big ? 0.7 : 0.85), y = yTop - (yTop - yFoot) * t, hx = x0 + dx * k * (Fl.big ? 0.9 : 1), hz = z0 + dz * k * (Fl.big ? 0.9 : 1); return [hx, Math.max(y, LY(Fl.pts[Math.round(t * (Fl.pts.length - 1))][2]) + 2), hz]; };
      const t0 = i / n, t1 = (i + 1) / n, p = pt(t0), q = pt(t1), w0 = Fl.w / 2 * (0.75 + 0.5 * t0), w1 = Fl.w / 2 * (0.75 + 0.5 * t1);
      const A = [p[0] - nx * w0, p[1], p[2] - nz * w0], B = [p[0] + nx * w0, p[1], p[2] + nz * w0], C = [q[0] + nx * w1, q[1], q[2] + nz * w1], D = [q[0] - nx * w1, q[1], q[2] - nz * w1];
      const v0 = t0 * (yTop - yFoot) / 40, v1 = t1 * (yTop - yFoot) / 40;
      pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(0, v0, Fl.w / 30, v0, Fl.w / 30, v1, 0, v0, Fl.w / 30, v1, 0, v1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const tex = TEX.fall.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true, color: 0xf2f6f6 });
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; group.add(m); fallMats.push([tex, Fl.big ? 0.9 : 0.6]);
    // mist at the foot
    const nm = Fl.big ? 7 : 2;
    for (let s = 0; s < nm; s++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, transparent: true, depthWrite: false, opacity: Fl.big ? 0.55 : 0.35 })); const sz = (Fl.big ? 60 : 14) + s * (Fl.big ? 22 : 6); sp.scale.set(sz, sz * 0.7, 1); sp.position.set(x1 + (R() - 0.5) * Fl.w, yFoot + 4 + s * (Fl.big ? 12 : 4), z1 + (R() - 0.5) * Fl.w); sp.renderOrder = 3; group.add(sp); }
  }
  anims.push((dt, t) => { for (const [tex, v] of fallMats) tex.offset.y = t * v; });
  // mist lying low over the river and the swamp after the rain
  { const WM2 = WM, spots = [];
    for (let j = 0; j < WM2.nz; j += 6) for (let i = 0; i < WM2.nx; i += 6) { const m = WM2.mDec[j * WM2.nx + i]; if (m !== 8 && m !== 4) continue; const X = WM2.x0 + i * WM2.cell, Z = WM2.z0 + j * WM2.cell, [x, z] = L(X, Z); if (!near(x, z, far) || inPlay(x, z)) continue; spots.push([x, LY(wH(i, j)) + 3, z]); }
    for (const [x, y, z] of spots.filter((_, k) => k % 2 === 0).slice(0, coarse ? 36 : 90)) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, transparent: true, depthWrite: false, opacity: 0.22 })); const sz = 50 + R() * 50; sp.scale.set(sz * 1.6, sz * 0.35, 1); sp.position.set(x, y, z); group.add(sp); } }

  // ---- trees: the hole's own (they play: hole.plants, main.js puts them in the tree field) and the rest of the
  // valley's in view (drawn here; returned so they play too where a wild ball reaches them)
  const list = [];
  const ownKey = new Set((hole.plants || []).map(p => `${Math.round(p.x)},${Math.round(p.z)}`));
  for (const p of hole.plants || []) list.push({ ...p, y: T.groundAt(p.x, p.z) ?? 0 });
  for (const [X, Z, y, kind, r, hh, low] of E.trees) {
    const [x, z] = L(X, Z); if (!near(x, z, coarse ? 1300 : far * 0.75) || ownKey.has(`${Math.round(x)},${Math.round(z)}`) || inField(x, z)) continue;
    const t = { x, z, y: LY(y), type: kind, h: hh, cr: r, low, tr: kind === 'giant' ? 1.6 : kind === 'conifer' ? 0.7 : 0.5, s: hh / 10, r: ((X * 7.3 + Z * 3.1) % 1 + 1) % 1 }; list.push(t); trees.push(t);
  }
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }), leaf = new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const parts = { trunk: [], cycad: [], fern: [], disc: [], blob: [], cone: [] }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const put = (k, x, y, z, sx, sy, sz, ry = 0, col = null, rxx = 0, rzz = 0) => { e.set(rxx, ry, rzz); q.setFromEuler(e); m4.compose(pv.set(x, y, z), q, sv.set(sx, sy, sz)); parts[k].push([m4.clone(), col]); };
  const G = { cycad: [0x3e5a22, 0x4a6626], fern: [0x3f6a2a, 0x4c7a2e], conifer: [0x27401f, 0x30492a], giant: [0x24391c, 0x2c4422], broad: [0x34552a, 0x416130, 0x4c6a2c], cypress: [0x46582c, 0x55663a], fig: [0x2f4f25, 0x3a5c2a] };
  const pick = (k, rr) => new THREE.Color(G[k][Math.floor(rr * G[k].length) % G[k].length]).offsetHSL((rr - 0.5) * 0.03, 0, (rr - 0.5) * 0.06);
  for (const t of list) {
    const H = t.h, cr = t.cr, y0 = t.y, rr = t.r ?? 0.5, ry = rr * 6.28, low = t.low ?? 0.35;
    if (t.type === 'cycad') { put('trunk', t.x, y0 - 0.2, t.z, cr * 0.22, H * 0.5, cr * 0.22, ry); put('cycad', t.x, y0 + H * 0.48, t.z, cr, cr * 0.9, cr, ry, pick('cycad', rr)); }
    else if (t.type === 'fern') { put('trunk', t.x, y0 - 0.2, t.z, 0.22, H * 0.86, 0.22, ry, null, (rr - 0.5) * 0.15); put('fern', t.x, y0 + H * 0.86, t.z, cr, cr * 0.8, cr, ry, pick('fern', rr)); }
    else if (t.type === 'conifer' || t.type === 'giant') {   // a monkey-puzzle: a tall bare trunk, a flat-topped dome of branch tiers
      const tr = t.tr ?? 0.7; put('trunk', t.x, y0 - 0.3, t.z, tr, H * 0.97, tr, ry);
      // the crown: a broad, flat-topped dome of upturned branches, ragged at its edge, sparse branch whorls under it
      const top = y0 + H, dome = H * (1 - low);
      put('blob', t.x, top - dome * 0.16, t.z, cr, dome * 0.17, cr * 0.94, ry, pick(t.type, rr));
      put('blob', t.x + Math.cos(ry) * cr * 0.2, top - dome * 0.05, t.z + Math.sin(ry) * cr * 0.2, cr * 0.7, dome * 0.12, cr * 0.66, ry + 1, pick(t.type, (rr + 0.4) % 1));
      for (let k = 0; k < (t.type === 'giant' ? 4 : 2); k++) { const aa = ry + k * 2.3, yy = top - dome * (0.42 + 0.2 * k), w = cr * (0.45 - 0.06 * k); put('blob', t.x + Math.cos(aa) * w * 0.6, yy, t.z + Math.sin(aa) * w * 0.6, w, dome * 0.07, w * 0.8, aa, pick(t.type, (rr + k * 0.3) % 1)); }
    }
    else if (t.type === 'cypress') { put('cone', t.x, y0 - 0.8, t.z, (t.tr ?? 0.9) * 2.4, 3, (t.tr ?? 0.9) * 2.4, ry); put('trunk', t.x, y0, t.z, t.tr ?? 0.9, H * 0.8, t.tr ?? 0.9, ry);
      for (let k = 0; k < 3; k++) put('blob', t.x + Math.cos(ry + k * 2.1) * cr * 0.3, y0 + H * (0.55 + k * 0.14), t.z + Math.sin(ry + k * 2.1) * cr * 0.3, cr * (0.75 - k * 0.12), H * 0.12, cr * (0.75 - k * 0.12), ry, pick('cypress', (rr + k * 0.37) % 1)); }
    else if (t.type === 'fig') {   // the Strangler: a trunk of fused roots, buttresses, a vast spreading crown
      const tr = t.tr ?? 8;
      for (let k = 0; k < 7; k++) { const aa = ry + k * 0.9, d = k ? tr * 0.55 : 0, rw = k ? tr * 0.42 : tr * 0.7; put('trunk', t.x + Math.cos(aa) * d, y0 - 0.5, t.z + Math.sin(aa) * d, rw, H * (k ? 0.5 + 0.1 * (k % 3) : 0.78), rw, aa, null, Math.cos(aa) * (k ? 0.08 : 0), Math.sin(aa) * (k ? 0.08 : 0)); }
      for (let k = 0; k < 9; k++) { const aa = ry + k * 0.7, d = k ? cr * (0.35 + 0.35 * ((k * 0.37) % 1)) : 0; put('blob', t.x + Math.cos(aa) * d, y0 + H * (0.68 + 0.12 * ((k * 0.53) % 1)), t.z + Math.sin(aa) * d, cr * (k ? 0.48 : 0.62), H * 0.13, cr * (k ? 0.48 : 0.62), aa, pick('fig', (k * 0.29) % 1)); }
    }
    else {   // a broadleaf: a trunk under heavy clumps (three close by, two far off)
      const tr = t.tr ?? 0.6; put('trunk', t.x, y0 - 0.3, t.z, tr, H * 0.75, tr, ry);
      const nb = near(t.x, t.z, 700) ? 3 : 2;
      for (let k = 0; k < nb; k++) { const aa = ry + k * 1.7, d = k ? cr * 0.45 : 0, w = cr * (k ? 0.62 : 0.8); put('blob', t.x + Math.cos(aa) * d, y0 + H * (low + (1 - low) * (0.45 + 0.15 * (k % 2))), t.z + Math.sin(aa) * d, w, (H * (1 - low)) * 0.42, w, aa, pick('broad', (rr + k * 0.31) % 1)); }
    }
  }
  for (const [k, items] of Object.entries(parts)) {
    if (!items.length) continue;
    const im = new THREE.InstancedMesh(S[k], k === 'trunk' ? bark : leaf, items.length);
    items.forEach(([mm, col], i) => { im.setMatrixAt(i, mm); if (k !== 'trunk') im.setColorAt(i, col || new THREE.Color(0x3a5a28)); });
    im.castShadow = true; im.receiveShadow = true; group.add(im);
  }

  // ---- the spire on the 7th: a slender column of the walls' sandstone, tapering, its beds stepping in and out, the
  // pterosaur perched on top (the hoodoo the ball hits is in the module; mesa-world skips drawing it)
  for (const [X, Z, y, r, top] of E.spires) {
    const [x, z] = L(X, Z); if (!near(x, z, far)) continue;
    const g = new THREE.CylinderGeometry(r * 0.55, r * 1.25, top + 3, 7, 14).translate(0, (top + 3) / 2, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i), n = 1 + 0.22 * Math.sin(yy * 0.55 + 1.3) * (fbm(yy * 0.2, 4) > 0.5 ? 1 : 0.4) + 0.2 * (fbm(p.getX(i) * 0.5 + yy * 0.1, p.getZ(i) * 0.5) - 0.5); p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); }
    g.computeVertexNormals(); const n4 = p.count; g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n4 * 4).map((_, i) => (i % 4 === 3 ? 1 : 0)), 4)); g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(n4), 1));
    const m = new THREE.Mesh(g, rockMat); m.position.set(x, LY(y) - 1, z); m.castShadow = m.receiveShadow = true; group.add(m);
    // the Overlook's pterosaur, perched until the round's first tee shot on the 7th sends it off (main.js keeps the
    // once-a-round flag; a hole built after it has flown gets an empty spire)
    if (perch && !ptero) {
      const feet = [x, LY(y) + top + 2, z], model = pteranodon();
      const floor = (qx, qz) => { if (inField(qx, qz)) { const g = T.groundAt(qx, qz); if (g !== null) return g; } return worldFloor(qx, qz); };
      ptero = { model, feet, flight: null, t: 0, atTee: Math.hypot(x, z) < 160, launch() { if (this.flight) return; this.flight = makeFlight({ perch: feet, floor }); this.t = 0; } };
      poseModel(model, makeFlight({ perch: feet }).at(0));
      group.add(model.root);
      anims.push(dt => { if (!ptero.flight) return; ptero.t += Math.min(dt, 0.1); const s = ptero.flight.at(ptero.t); if (s.gone) { model.root.visible = false; return; } poseModel(model, s); });
    }
  }
  const Br = batch();   // wood, canvas, bone and built things, one merged mesh
  // ---- the Strangler's root arch: a buttress root arching right across the fairway, and lesser roots beside it
  for (const A of E.arches) {
    const [ax, az] = L(A.a[0], A.a[1]); if (!near(ax, az, far)) continue;
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24, [X, Z] = [A.a[0] + (A.b[0] - A.a[0]) * t, A.a[1] + (A.b[1] - A.a[1]) * t], [x, z] = L(X, Z); const yb = LY(A.a[2] + (A.b[2] - A.a[2]) * t), lift = A.crown * Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.85; pts.push(new THREE.Vector3(x, yb + lift + A.t / 2 - (t < 0.06 || t > 0.94 ? 2.5 : 0), z)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 48, A.t * 0.62, 9, false), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 0.6, p.getY(i) * 0.6 + p.getZ(i) * 0.4) - 0.5) * 0.5; const c = curve.getPointAt(Math.min(1, Math.max(0, Math.floor(i / 10) / 48))); p.setXYZ(i, c.x + (p.getX(i) - c.x) * n * 1.25, c.y + (p.getY(i) - c.y) * n, c.z + (p.getZ(i) - c.z) * n * 1.25); }
    g.computeVertexNormals();
    const rm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x6b5c4a, roughness: 0.95 })); rm.castShadow = rm.receiveShadow = true; group.add(rm);
    for (let k = 0; k < 3; k++) {   // lesser roots, arching low from the trunk
      const off = (k - 1) * 9 + 4, sp = pts.map((v, i) => { const t = i / 24; return new THREE.Vector3(v.x + off * 0.3, v.y - A.crown * 0.6 * Math.sin(Math.PI * t) * (0.5 + k * 0.15) - 1, v.z + off); }).slice(0, 12 + k * 3);
      const gg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 20, A.t * 0.25, 6, false); const mm = new THREE.Mesh(gg, rm.material); mm.castShadow = true; group.add(mm);
    }
  }
  // ---- the camp and the lookout: canvas tents, the mess fly, huts on stilts, the cook fire, crates, flags
  const canvas = lin([196, 182, 150]), wood = lin([104, 80, 56]), roofK = lin([92, 84, 60]);
  for (const c of E.camp) {
    const [x, z] = L(...c.at); if (!near(x, z, far)) continue;
    const y = footY(x, z, LY(c.y)), ang = (c.rot || 0) - a, ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v, h) => [x + u * ca - v * sa, y + h, z + u * sa + v * ca];
    if (c.kind === 'tent') { const w = c.w / 2, l = c.l / 2, h = c.h; Br.quad(P(-w, -l, 0), P(0, -l, h), P(0, l, h), P(-w, l, 0), canvas); Br.quad(P(w, l, 0), P(0, l, h), P(0, -l, h), P(w, -l, 0), canvas); Br.tri(P(-w, -l, 0), P(w, -l, 0), P(0, -l, h), lin([170, 156, 126])); Br.tri(P(w, l, 0), P(-w, l, 0), P(0, l, h), lin([170, 156, 126])); }
    else if (c.kind === 'fly') { const w = c.w / 2, l = c.l / 2; Br.quad(P(-w, -l, c.h), P(w, -l, c.h + 0.6), P(w, l, c.h + 0.6), P(-w, l, c.h), canvas); Br.quad(P(-w, l, c.h), P(w, l, c.h + 0.6), P(w, -l, c.h + 0.6), P(-w, -l, c.h), canvas); for (const [u, v] of [[-w, -l], [w, -l], [w, l], [-w, l]]) { const b = P(u, v, 0); Br.quad([b[0] - 0.08, b[1], b[2]], [b[0] + 0.08, b[1], b[2]], [b[0] + 0.08, b[1] + c.h + 0.3, b[2]], [b[0] - 0.08, b[1] + c.h + 0.3, b[2]], wood); } }
    else if (c.kind === 'hut') {
      const w = c.w / 2, l = c.l / 2, s = c.stilt, h = c.h;
      for (const [u, v] of [[-w, -l], [w, -l], [w, l], [-w, l]]) { const b = P(u * 0.9, v * 0.9, -0.5), t = P(u * 0.9, v * 0.9, s); for (const [du, dv] of [[0.15, 0], [0, 0.15]]) Br.quad([b[0] - du, b[1], b[2] - dv], [b[0] + du, b[1], b[2] + dv], [t[0] + du, t[1], t[2] + dv], [t[0] - du, t[1], t[2] - dv], wood); }
      const box = [[-w, -l], [w, -l], [w, l], [-w, l]];
      Br.quad(P(-w, -l, s), P(-w, l, s), P(w, l, s), P(w, -l, s), wood);
      for (let k = 0; k < 4; k++) { const [u0, v0] = box[k], [u1, v1] = box[(k + 1) % 4]; Br.quad(P(u0, v0, s), P(u1, v1, s), P(u1, v1, s + h), P(u0, v0, s + h), wood); Br.quad(P(u1, v1, s), P(u0, v0, s), P(u0, v0, s + h), P(u1, v1, s + h), wood); }
      Br.quad(P(-w - 0.5, -l - 0.5, s + h), P(0, -l - 0.5, s + h + 1.4), P(0, l + 0.5, s + h + 1.4), P(-w - 0.5, l + 0.5, s + h), roofK); Br.quad(P(w + 0.5, l + 0.5, s + h), P(0, l + 0.5, s + h + 1.4), P(0, -l - 0.5, s + h + 1.4), P(w + 0.5, -l - 0.5, s + h), roofK);
    }
    else if (c.kind === 'crates') { for (let k = 0; k < 4; k++) { const u = (k % 2) * 1.1 - 0.5, v = Math.floor(k / 2) * 1.1 - 0.5, hh = k === 3 ? 1.9 : 0.9, b = k === 3 ? 0.9 : 0; for (const [p0, p1] of [[[u, v], [u + 1, v]], [[u + 1, v], [u + 1, v + 1]], [[u + 1, v + 1], [u, v + 1]], [[u, v + 1], [u, v]]]) Br.quad(P(...p0, b), P(...p1, b), P(...p1, hh), P(...p0, hh), lin([130, 104, 70])); Br.quad(P(u, v, hh), P(u, v + 1, hh), P(u + 1, v + 1, hh), P(u + 1, v, hh), lin([140, 112, 76])); } }
    else if (c.kind === 'flag') { const b = P(0, 0, 0); Br.quad([b[0] - 0.07, b[1], b[2]], [b[0] + 0.07, b[1], b[2]], [b[0] + 0.07, b[1] + c.h, b[2]], [b[0] - 0.07, b[1] + c.h, b[2]], wood);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6, 6, 1), new THREE.MeshStandardMaterial({ color: 0xb0302a, side: THREE.DoubleSide, roughness: 0.8 })); fl.position.set(b[0] + 1.3, b[1] + c.h - 0.9, b[2]); group.add(fl);
      const fp = fl.geometry.attributes.position, base = Float32Array.from(fp.array); anims.push((dt, t) => { for (let i = 0; i < fp.count; i++) { const u = base[i * 3] + 1.3; fp.setZ(i, Math.sin(t * 4 + u * 2.2) * 0.18 * u); } fp.needsUpdate = true; }); }
    else if (c.kind === 'fire') { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.fire, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sp.scale.set(2.2, 2.6, 1); sp.position.set(x, y + 0.9, z); group.add(sp); anims.push((dt, t) => { const f = 1 + 0.12 * Math.sin(t * 13) + 0.08 * Math.sin(t * 29); sp.scale.set(2.2 * f, 2.6 * f, 1); });
      const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.mist, transparent: true, depthWrite: false, opacity: 0.3, color: 0xd8d4cc })); smoke.scale.set(8, 26, 1); smoke.position.set(x + 1, y + 14, z); group.add(smoke); }
  }
  // ---- the rope bridge across the gorge: plank deck sagging between the rims, hand ropes above it
  if (E.bridge) {
    const [ax, az] = L(E.bridge.a[0], E.bridge.a[1]), [bx, bz] = L(E.bridge.b[0], E.bridge.b[1]);
    if (near(ax, az, far)) {
      const ay = LY(E.bridge.a[2]) + 0.4, by = LY(E.bridge.b[2]) + 0.4, dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l * 0.9, nz = dx / l * 0.9, n = 22, sag = l * 0.09;
      const Pt = (t, side, up) => { const y = ay + (by - ay) * t - sag * 4 * t * (1 - t) + up; return [ax + dx * t + nx * side, y, az + dz * t + nz * side]; };
      for (let i = 0; i < n; i++) { const t0 = (i + 0.1) / n, t1 = (i + 0.9) / n; Br.quad(Pt(t0, -1, 0), Pt(t1, -1, 0), Pt(t1, 1, 0), Pt(t0, 1, 0), lin([120, 92, 62])); Br.quad(Pt(t0, 1, 0), Pt(t1, 1, 0), Pt(t1, -1, 0), Pt(t0, -1, 0), lin([96, 74, 50])); }
      const rope = lin([150, 128, 92]);
      for (const side of [-1.1, 1.1]) for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; Br.quad(Pt(t0, side, 1.05), Pt(t1, side, 1.05), Pt(t1, side, 1.15), Pt(t0, side, 1.15), rope); Br.quad(Pt(t1, side, 1.05), Pt(t0, side, 1.05), Pt(t0, side, 1.15), Pt(t1, side, 1.15), rope); if (i % 3 === 0) Br.quad(Pt(t0, side, 0), Pt(t0 + 0.004, side, 0), Pt(t0 + 0.004, side, 1.1), Pt(t0, side, 1.1), rope); }
    }
  }
  // ---- the bones: the long-neck in the Bone Bluff's face, toward the tee; the horned skull and ribs in the tar
  const bone = lin([222, 210, 182]);
  const tube = (P0, P1, r, k = bone) => { const d = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]], l = Math.hypot(...d) || 1, s = [-d[2] / l * r, 0, d[0] / l * r]; Br.quad([P0[0] - s[0], P0[1], P0[2] - s[2]], [P1[0] - s[0], P1[1], P1[2] - s[2]], [P1[0] + s[0], P1[1], P1[2] + s[2]], [P0[0] + s[0], P0[1], P0[2] + s[2]], k); Br.quad([P0[0], P0[1] - r, P0[2]], [P1[0], P1[1] - r, P1[2]], [P1[0], P1[1] + r, P1[2]], [P0[0], P0[1] + r, P0[2]], k); };
  if (E.bones) {
    const Bb = E.bones.bluff, [bx, bz] = L(...Bb.c);
    if (near(bx, bz, far)) {
      const [tx, tz] = L(...Bb.toward), ux = tx - bx, uz = tz - bz, ul = Math.hypot(ux, uz), dx = ux / ul, dz = uz / ul, sx = -dz, sz = dx;
      const face = Math.min(Bb.rx, Bb.rz) * 0.98, base = LY(Bb.y);
      const spine = t => { const along = (t - 0.5) * Bb.rx * 1.7; return [bx + dx * (face + 0.4) + sx * along, base + 9 + 8 * Math.sin(t * Math.PI) - 3 * t, bz + dz * (face + 0.4) + sz * along]; };
      for (let i = 0; i < 18; i++) tube(spine(i / 18), spine((i + 1) / 18), 0.45);
      for (let i = 3; i < 13; i++) { const p = spine(i / 18); for (const side of [-1, 1]) tube(p, [p[0] + dx * 0.6, p[1] - 4.2, p[2] + dz * 0.6 + side * 0.02], 0.22); }
      const nk = spine(0); tube(nk, [nk[0] - sx * 6, nk[1] + 9, nk[2] - sz * 6], 0.35); tube([nk[0] - sx * 6, nk[1] + 9, nk[2] - sz * 6], [nk[0] - sx * 7.5, nk[1] + 9.5, nk[2] - sz * 7.5], 0.7);
      const tl = spine(1); tube(tl, [tl[0] + sx * 10, tl[1] - 5, tl[2] + sz * 10], 0.25);
    }
    const Tb = E.bones.tar, [qx, qz] = L(...Tb.c);
    if (near(qx, qz, far)) {
      const y = LY(Tb.level) + 0.1, [tx, tz] = L(...Tb.toward), dl = Math.hypot(tx - qx, tz - qz), dx = (tx - qx) / dl, dz = (tz - qz) / dl, sx = -dz, sz = dx;
      for (let k = 0; k < 6; k++) { const c = [qx - dx * (k * 1.6 + 3), y, qz - dz * (k * 1.6 + 3)], w = 2.2 - k * 0.12; for (let i = 0; i < 6; i++) { const a0 = i / 6 * Math.PI, a1 = (i + 1) / 6 * Math.PI; tube([c[0] + sx * Math.cos(a0) * w, y + Math.sin(a0) * w * 1.1, c[2] + sz * Math.cos(a0) * w], [c[0] + sx * Math.cos(a1) * w, y + Math.sin(a1) * w * 1.1, c[2] + sz * Math.cos(a1) * w], 0.14); } }
      const sk = [qx + dx * 1.5, y + 0.5, qz + dz * 1.5];   // the skull: frill, brow horns and a nose horn toward the tee
      for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI, a1 = (i + 1) / 8 * Math.PI; tube([sk[0] + sx * Math.cos(a0) * 2.4, sk[1] + Math.sin(a0) * 2, sk[2] + sz * Math.cos(a0) * 2.4], [sk[0] + sx * Math.cos(a1) * 2.4, sk[1] + Math.sin(a1) * 2, sk[2] + sz * Math.cos(a1) * 2.4], 0.3); }
      tube(sk, [sk[0] + dx * 2.4, sk[1] - 0.2, sk[2] + dz * 2.4], 0.6);
      for (const side of [-0.7, 0.7]) tube([sk[0] + dx * 1.2 + sx * side, sk[1] + 0.6, sk[2] + dz * 1.2 + sz * side], [sk[0] + dx * 2.6 + sx * side * 1.4, sk[1] + 2.4, sk[2] + dz * 2.6 + sz * side * 1.4], 0.16);
      tube([sk[0] + dx * 2.2, sk[1] + 0.2, sk[2] + dz * 2.2], [sk[0] + dx * 2.8, sk[1] + 1, sk[2] + dz * 2.8], 0.14);
    }
  }
  { const m = Br.mesh(vc({ roughness: 0.9, side: THREE.DoubleSide })); if (m) group.add(m); }

  // ---- the animals: long-necks grazing and wading, small plant-eaters drinking, the hunter, pterosaurs and nests
  const hide = { longneck: lin([112, 104, 86]), small: lin([138, 120, 88]), hunter: lin([92, 74, 58]) };
  const Ba = batch();
  const box3 = (c, u, v, w, k, ry, B = Ba) => {   // a box centred c, half sizes u (along), v (up), w (across), turned ry
    const ca = Math.cos(ry), sa = Math.sin(ry), P = (p, q, r) => [c[0] + p * sa + r * ca, c[1] + q, c[2] - p * ca + r * sa], f = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([p, q, r]) => P(p * u, q * v, r * w));
    for (const [i0, i1, i2, i3] of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [1, 2, 6, 5], [0, 4, 7, 3]]) B.quad(f[i0], f[i1], f[i2], f[i3], k);
  };
  const birds = [];
  for (const A of E.life) {
    const [x, z] = L(...A.at); if (!near(x, z, far * 1.1)) continue;
    const ry = A.dir - a, ca = Math.cos(ry), sa = Math.sin(ry), fwd = (d, up = 0) => [x + sa * d, 0, z - ca * d];
    if (A.kind === 'longneck' || A.kind === 'small' || A.kind === 'hunter') {
      const s = A.len / (A.kind === 'longneck' ? 24 : A.kind === 'small' ? 6.5 : 12), k = hide[A.kind];
      const y = (A.wade ? LY(A.y) - 1.2 : footY(x, z, LY(A.y)));
      if (A.kind === 'longneck') {
        const leg = 4.6 * s, bh = 2.8 * s;
        box3([x, y + leg + bh * 0.5, z], 4.6 * s, bh * 0.55, 1.9 * s, k, ry);
        for (const [p, r] of [[3, 1.3], [3, -1.3], [-3, 1.3], [-3, -1.3]]) { const c = fwd(p * s); box3([c[0] + ca * r * s, y + leg / 2, c[2] + sa * r * s], 0.55 * s, leg / 2 + 0.3, 0.55 * s, k, ry); }
        const up = A.browse ? 1 : A.drink ? -0.4 : 0.6, nb = fwd(4.4 * s), nl = 8.5 * s;
        for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, c0 = [nb[0] + sa * nl * 0.5 * t0, y + leg + bh * 0.7 + nl * up * 0.8 * t0, nb[2] - ca * nl * 0.5 * t0], c1 = [nb[0] + sa * nl * 0.5 * t1, y + leg + bh * 0.7 + nl * up * 0.8 * t1, nb[2] - ca * nl * 0.5 * t1]; box3([(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2], 0.8 * s, Math.max(0.6 * s, Math.abs(c1[1] - c0[1]) / 2 + 0.3), (0.7 - t0 * 0.25) * s, k, ry); if (i === 5) box3([c1[0] + sa * 0.6 * s, c1[1], c1[2] - ca * 0.6 * s], 0.9 * s, 0.45 * s, 0.45 * s, k, ry); }
        const tb = fwd(-4.4 * s); for (let i = 0; i < 5; i++) { const t = i / 5; box3([tb[0] - sa * 9 * s * (t + 0.1), y + leg + bh * 0.3 - 2.5 * s * t, tb[2] + ca * 9 * s * (t + 0.1)], 1.1 * s, (0.6 - t * 0.45) * s, (0.6 - t * 0.45) * s, k, ry); }
      } else {   // a biped: hind legs, a level body, the tail out behind and a head forward
        const leg = (A.kind === 'hunter' ? 2.4 : 1.4) * s * (A.kind === 'small' ? 4.6 / 4.6 : 1), bh = (A.kind === 'hunter' ? 1.3 : 0.8) * s;
        box3([x, y + leg + bh * 0.5, z], 2.2 * s, bh * 0.5, 0.75 * s, k, ry);
        for (const r of [0.45, -0.45]) box3([x + ca * r * s, y + leg / 2, z + sa * r * s], 0.35 * s, leg / 2 + 0.2, 0.3 * s, k, ry);
        const hd = fwd(2.8 * s); box3([hd[0], y + leg + bh * (A.drink ? -0.3 : 1.1), hd[2]], (A.kind === 'hunter' ? 1.2 : 0.6) * s, 0.45 * s, 0.4 * s, k, ry);
        const tl = fwd(-3.6 * s); box3([tl[0], y + leg + bh * 0.4, tl[2]], 1.8 * s, 0.25 * s, 0.25 * s, k, ry);
      }
    } else if (A.kind === 'ptero') {
      const y = LY(A.y), g = new THREE.BufferGeometry(), sp = A.span / 2;
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -1.2, -sp, 0.3, 0.3, 0, 0, 0.6, 0, 0, -1.2, 0, 0, 0.6, sp, 0.3, 0.3, 0, 0.1, -1.4, 0, 0.1, -2.6, 0, -0.1, -1.6], 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x5a4636, side: THREE.DoubleSide, roughness: 0.9 })); group.add(m);
      const rad = 40 + (A.span * 9) % 50, ph = A.dir, w = 0.05 + ((A.at[0] * 0.01) % 0.04);
      birds.push({ m, x, y, z, rad, ph, w });
    } else if (A.kind === 'nest') { const y = LY(A.y); box3([x, y, z], 2.4, 0.5, 2.4, lin([84, 70, 50]), 0); }
  }
  { const m = Ba.mesh(vc({ roughness: 0.95 })); if (m) group.add(m); }
  if (birds.length) anims.push((dt, t) => { for (const b of birds) { const an = b.ph + t * b.w * 6; b.m.position.set(b.x + Math.cos(an) * b.rad, b.y + Math.sin(t * 0.3 + b.ph) * 6, b.z + Math.sin(an) * b.rad); b.m.rotation.set(0, -an, Math.sin(t * 1.4 + b.ph) * 0.25); } });

  return { trees, anims, ptero };
}
