// Cloudrest (global THREE), blockout: what COURSE.cloud holds (world space) put into a hole's frame (hole.frame) and
// drawn. The gorge's ground from its height maps (mountain grass, scrub, rock, the kerbs, the tea rows, the courtyard's
// paving) in the ground shader's CLOUD branch, a cliff face down to the mist wherever the ground ends over open air,
// the mist itself (a sheet at 150 m with a thinner layer above it), the stream and the two pools as water sheets, the
// pines as dark cones, the monastery and the sacred things as plain boxes under red and gold roofs, and the alcove's
// roof as slabs of rock. The ball's side of it (the ground, the rocks, the surfaces) is in the course module and
// terrain.js; everything here is drawn only. The art pass comes later.
import { unpackHeights } from './field-code.js';

export const TYPES = new Set();   // nothing for main.js's buildTrees to leave to us (the pines are scenery, drawn here)
const GAP = -32768;
const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
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
// the paint byte: 0 rough, 1 scrub, 2 rock, 3 kerb, 4 tea, 5 paving, 6 sand, 8 water, 10 mown, 255 open air
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, CLOUD) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B sand, A grass length (rough about 0.55; rock, kerb, paving 0).
// B: R scrub, G tea rows, B paving, A the kerbs
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee'), cS = C.indexOf('sand');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f; else if (c === cS) w[4] += f;
      if (m === 1) w[5] += f; if (m === 4) w[6] += f; if (m === 5) w[7] += f; if (m === 3) w[8] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[4] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[6]) * 255 * mown); b[o + 2] = Math.round(Math.min(1, own[7]) * 255 * mown); b[o + 3] = Math.round(Math.min(1, own[8]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#8a877e', rough: '#5b7a3e', fairway: '#6fa34a', fringe: '#7aae50', green: '#8fcb5e', tee: '#86b456', sand: '#e0d3a8', water: '#4a7f92', void: '#e8ecef' };
  return (x, z) => { const s = T.surfaceAt(x, z), m = matAt(hole, x, z); if (s === 'rough' && m === 4) return '#4f7a35'; if (s === 'desert' && m === 5) return '#cbbf9f'; return C[s] || C.rough; };
}
// what a lie is called, from the paint under the ball: native is rock, a kerb or paving; rough is mountain grass,
// scrub or the tea rows
export function lieName(hole, x, z, lie) {
  const m = matAt(hole, x, z);
  if (lie === 'rough') return m === 1 ? 'Scrub' : m === 4 ? 'Tea' : 'Rough';
  return m === 3 ? 'Kerb' : m === 5 ? 'Paving' : 'Rock';
}

/* ---------- shapes made once ---------- */
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const cone = new THREE.ConeGeometry(1, 1, 8, 3, true); cone.translate(0, 0.5, 0);
  { const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), r = 1 + 0.18 * Math.sin(y * 18) * (1 - y); p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); } cone.computeVertexNormals(); }
  const trunk = new THREE.CylinderGeometry(0.5, 0.8, 1, 6, 1, true); trunk.translate(0, 0.5, 0);
  for (const g of [cone, trunk]) g.userData.keep = true;
  return (SHAPES = { cone, trunk });
}
const mapOf = M => { if (!M.hDec) { M.hDec = dec(M.h, Int16Array); if (M.pred) unpackHeights(M.hDec, M.nx); M.mDec = dec(M.m, Uint8Array); } return M; };

export function buildCloud(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const gnd = (x, z) => T.groundAt(x, z);
  const MY = LY(E.mist);
  const rockK = lin([74, 76, 70]), rockD = lin([60, 62, 58]);

  // ---- the ground from the 10 m and 40 m maps: this hole's field where it has one (so the edges meet the playfield),
  // drawn in the ground shader (aW: x scrub, y tea, z another hole's mown ground, w rock); open air left out, and a
  // face of rock dropped from every edge over it to below the mist
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 1 ? 1 : 0, m === 4 ? 1 : 0, m === 10 ? 1 : 0, m === 2 || m === 3 ? 1 : 0];
  const split = (Vt, idx, k, k1, k2, k3) => { if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); };
  const Faces = batch(), Wtr = batch(), water = lin([58, 84, 92]);
  const face = (p, q, k) => { const d = MY - 12; Faces.quad(p, q, [q[0], d, q[2]], [p[0], d, p[2]], k); };
  const drawMap = (M, skip, st, sink) => {
    const ni = Math.floor((M.nx - 1) / st), nj = Math.floor((M.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), gap = new Uint8Array((ni + 1) * (nj + 1)), wet = new Uint8Array((ni + 1) * (nj + 1)), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = M.x0 + I * M.cell, Z = M.z0 + J * M.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, raw = M.hDec[J * M.nx + I], m = M.mDec[J * M.nx + I];
      Wx.set([X, Z], k * 2);
      if (raw === GAP) { gap[k] = 1; Vt.set([x, MY - 12, z], k * 3); continue; }
      let y = LY(raw / M.scale + M.y0); wet[k] = m === 8 ? 1 : 0;
      if (inField(x, z) && !wet[k]) { const g = gnd(x, z); if (g !== null) y = g; }
      Vt.set([x, y - sink, z], k * 3); Wt.set(wOf(m), k * 4);
    }
    const idx = [], P = p => [Vt[p * 3], Vt[p * 3 + 1], Vt[p * 3 + 2]];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1, q = [k, k1, k2, k3];
      if (skip(q, Vt, Wx)) continue;
      const g = q.map(p => gap[p]), n = g.reduce((s, v) => s + v, 0);
      if (n === 0) { split(Vt, idx, k, k1, k2, k3); if (q.some(p => wet[p])) { const lv = Math.min(...q.filter(p => wet[p]).map(p => Vt[p * 3 + 1])) + sink - 0.05, Q = p => [Vt[p * 3], lv, Vt[p * 3 + 2]]; Wtr.quad(Q(k), Q(k2), Q(k3), Q(k1), water); } continue; }
      if (n === 4) continue;
      // an edge over open air: the ground's triangle that has all three corners, and faces down from the edge
      if (n === 1) { const tri = [[k, k2, k3], [k, k3, k1], [k, k2, k1], [k1, k2, k3]].find(t => t.every(p => !gap[p])); if (tri) idx.push(...tri); }
      const ring = [k, k1, k3, k2];
      for (let e = 0; e < 4; e++) { const p = ring[e], o = ring[(e + 1) % 4]; if (!gap[p] && !gap[o] && (gap[ring[(e + 2) % 4]] || gap[ring[(e + 3) % 4]])) face(P(o), P(p), (i + j) % 2 ? rockK : rockD); }
      for (let e = 0; e < 4; e++) { const p = ring[e]; if (gap[p]) continue; const o = ring[(e + 1) % 4], b2 = ring[(e + 3) % 4]; if (gap[o] && gap[b2]) { const A = P(p); face([A[0] - 1.5, A[1], A[2]], [A[0] + 1.5, A[1], A[2]], rockD); face([A[0], A[1], A[2] + 1.5], [A[0], A[1], A[2] - 1.5], rockK); } }
    }
    group.add(groundMesh(Vt, Wt, idx));
  };
  const WM = mapOf(E.world), FM = mapOf(E.far);
  drawMap(WM, q => false && q, coarse ? 2 : 1, 0.3);
  const ix0 = WM.x0 + 30, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 30, iz0 = WM.z0 + 30, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 30;
  drawMap(FM, (q, Vt, Wx) => q.every(p => Wx[p * 2] > ix0 && Wx[p * 2] < ix1 && Wx[p * 2 + 1] > iz0 && Wx[p * 2 + 1] < iz1), coarse ? 2 : 1, 0.8);
  // the field's own edges over open air, at its 2 m cells (the 10 m map's faces are too coarse up close)
  if (Fd) {
    const nanAt = (i, j) => i < 0 || j < 0 || i >= Fd.nx || j >= Fd.nz || Number.isNaN(Fd.h[j * Fd.nx + i]);
    const yAt = (i, j) => Fd.h[j * Fd.nx + i];
    for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) {
      if (nanAt(i, j)) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell, y = yAt(i, j), c = Fd.cell / 2, k = (i + j) % 2 ? rockK : rockD;
      if (nanAt(i + 1, j)) face([x + c, y, z + c], [x + c, y, z - c], k);
      if (nanAt(i - 1, j)) face([x - c, y, z - c], [x - c, y, z + c], k);
      if (nanAt(i, j + 1)) face([x - c, y, z + c], [x + c, y, z + c], k);
      if (nanAt(i, j - 1)) face([x + c, y, z - c], [x - c, y, z - c], k);
    }
  }
  { const m = Faces.mesh(vc({ flatShading: true, side: THREE.DoubleSide }), false); if (m) group.add(m); }
  // the stream and the pools inside the field: a sheet 0.8 m over the bed on every cell that plays as water
  if (Fd) {
    const cW = Fd.codes.indexOf('water');
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const ks = [j * Fd.nx + i, j * Fd.nx + i + 1, (j + 1) * Fd.nx + i, (j + 1) * Fd.nx + i + 1];
      if (!ks.some(k => Fd.s[k] === cW)) continue;
      const x0 = Fd.x0 + i * Fd.cell, z0 = Fd.z0 + j * Fd.cell, ys = [[x0, z0], [x0 + Fd.cell, z0], [x0, z0 + Fd.cell], [x0 + Fd.cell, z0 + Fd.cell]].map((p, q) => Fd.s[ks[q]] === cW ? T.groundAt(...p) + 0.8 : null).filter(v => v !== null);
      const lv = Math.min(...ys) - 0.03;
      Wtr.quad([x0, lv, z0], [x0, lv, z0 + Fd.cell], [x0 + Fd.cell, lv, z0 + Fd.cell], [x0 + Fd.cell, lv, z0], water);
    }
  }
  { const m = Wtr.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0, envMapIntensity: 1.2 }), false); if (m) { m.renderOrder = 1; group.add(m); } }

  // ---- the mist: a sheet at its top over the whole gorge, a thinner layer drifting a few metres above it
  {
    const R = 5200, g = new THREE.PlaneGeometry(R * 2, R * 2, 1, 1); g.rotateX(-Math.PI / 2);
    const sheet = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 1, metalness: 0, emissive: 0x6f6a62, emissiveIntensity: 0.35 }));
    sheet.position.set(cx, MY, cz); sheet.receiveShadow = true; group.add(sheet);
    const veil = new THREE.Mesh(g.clone(), new THREE.MeshBasicMaterial({ color: 0xf6f2ea, transparent: true, opacity: 0.45, depthWrite: false }));
    veil.position.set(cx, MY + 7, cz); veil.renderOrder = 2; group.add(veil);
  }

  // ---- the built things: plain boxes, the halls under pitched roofs (gold for the golden hall, red for the rest)
  {
    const B = batch(), white = lin([232, 226, 214]), whiteD = lin([196, 190, 178]), stone = lin([176, 168, 152]), stoneD = lin([140, 134, 122]), gold = lin([214, 168, 58]), goldD = lin([168, 128, 40]), red = lin([162, 58, 40]), redD = lin([120, 40, 28]), wood = lin([110, 84, 60]);
    const box3 = (x, z, y0, w, l, h, r, k, kd, taper = 1) => {
      const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r);
      const P = (su, sv, top) => { const t = top ? taper : 1; return [x + (ux * su * w / 2 + vx * sv * l / 2) * t, top ? y0 + h : y0, z + (uz * su * w / 2 + vz * sv * l / 2) * t]; };
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let f = 0; f < 4; f++) { const p = c[f], q = c[(f + 1) % 4]; B.quad(P(...p, 0), P(...p, 1), P(...q, 1), P(...q, 0), f % 2 ? k : kd); }
      B.quad(P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), P(1, -1, 1), kd);
    };
    const pitched = (x, z, y0, w, l, r, k, kd) => {   // a roof with deep eaves, the ridge along its length
      const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), e = 1.18, rh = Math.min(w, l) * 0.34;
      const P = (su, sv, dy) => [x + ux * su * w / 2 * e + vx * sv * l / 2 * e, y0 + dy, z + uz * su * w / 2 * e + vz * sv * l / 2 * e];
      B.quad(P(-1, -1, -0.6), P(-1, 1, -0.6), P(0, 1, rh), P(0, -1, rh), k); B.quad(P(1, 1, -0.6), P(1, -1, -0.6), P(0, -1, rh), P(0, 1, rh), kd);
      B.tri(P(-1, -1, -0.6), P(0, -1, rh), P(1, -1, -0.6), kd); B.tri(P(1, 1, -0.6), P(0, 1, rh), P(-1, 1, -0.6), kd);
    };
    for (const o of E.sites) {
      const [x, z] = L(...o.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue;
      const y = LY(o.y), r = o.rot - a;
      if (o.kind === 'hall') { box3(x, z, y - 1, o.w, o.l, o.h + 1, r, white, whiteD); pitched(x, z, y + o.h, o.w, o.l, r, o.roof === 'gold' ? gold : red, o.roof === 'gold' ? goldD : redD); }
      else if (o.kind === 'gatehouse' || o.kind === 'wheel') { box3(x, z, y - 0.5, o.w, o.l, o.h + 0.5, r, white, whiteD); pitched(x, z, y + o.h, o.w, o.l, r, red, redD); }
      else if (o.kind === 'stupa') { box3(x, z, y - 0.5, o.w, o.l, o.h * 0.45, r, white, whiteD, 0.8); box3(x, z, y + o.h * 0.45, o.w * 0.45, o.l * 0.45, o.h * 0.55, r, gold, goldD, 0.05); }
      else if (o.kind === 'cairn') box3(x, z, y - 0.5, o.w, o.l, o.h, r, stone, stoneD, 0.3);
      else if (o.kind === 'wall') box3(x, z, y - 0.5, o.w, o.l, o.h + 0.5, r, stone, stoneD);
      else if (o.kind === 'stair') box3(x, z, y - 9, o.w, o.l, 9.5, r, stone, stoneD);
      else if (o.kind === 'halls') { box3(x, z, y - 1, o.w, o.l, o.h * 0.6, r, white, whiteD); pitched(x, z, y + o.h * 0.6 - 1, o.w, o.l, r, red, redD); }
      else if (o.kind === 'pine') { /* the twisted pine: drawn with the pines below */ }
      else if (o.kind === 'bridge') {   // the rope bridge: planks sagging across the cleft, a rope either side
        const vx = Math.sin(r), vz = -Math.cos(r), ux = Math.cos(r), uz = Math.sin(r), N = 18, pts = [];
        for (let k = 0; k <= N; k++) { const t = k / N - 0.5; pts.push([x + vx * t * o.l, y - 7 * (1 - 4 * t * t) + 0.5, z + vz * t * o.l]); }
        for (let k = 0; k < N; k++) { const p = pts[k], q = pts[k + 1]; B.quad([p[0] - ux, p[1], p[2] - uz], [p[0] + ux, p[1], p[2] + uz], [q[0] + ux, q[1], q[2] + uz], [q[0] - ux, q[1], q[2] - uz], wood); }
      }
    }
    // the alcove's roof: slabs of dark rock 80-90 m over the play
    for (const R of E.roof.boxes) { const [x, z] = L(...R.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue; box3(x, z, LY(R.y), R.w, R.l, R.h, R.rot - a, rockD, lin([86, 82, 76])); }
    const m = B.mesh(vc({ flatShading: true, side: THREE.DoubleSide })); if (m) group.add(m);
  }

  // ---- the pines: dark cones on short trunks, everywhere the plan put them within reach of this hole
  {
    const near = [], R2 = (coarse ? 1400 : 1900) ** 2;
    for (const t of E.pines) { const [x, z] = L(t[0], t[1]); if ((x - cx) ** 2 + (z - cz) ** 2 > R2) continue; near.push({ x, z, y: LY(t[2]), h: t[3], r: t[4] }); }
    const nd = E.sites.find(o => o.kind === 'pine'); if (nd) { const [x, z] = L(...nd.at); near.push({ x, z, y: LY(nd.y), h: nd.h, r: 3.2 }); }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    const cones = new THREE.InstancedMesh(S.cone, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), near.length);
    const trunks = new THREE.InstancedMesh(S.trunk, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }), near.length);
    near.forEach((t, k) => {
      cones.setMatrixAt(k, M.compose(new THREE.Vector3(t.x, t.y + t.h * 0.22, t.z), Q.setFromAxisAngle(up, hash(t.x, t.z) * 6.28), new THREE.Vector3(t.r, t.h * 0.8, t.r)));
      const v = 0.8 + 0.4 * hash(t.x * 2, t.z); cones.setColorAt(k, C.setRGB(...lin([40 * v, 66 * v, 44 * v])));
      trunks.setMatrixAt(k, M.compose(new THREE.Vector3(t.x, t.y - 0.5, t.z), Q.identity(), new THREE.Vector3(t.r * 0.18, t.h * 0.3, t.r * 0.18)));
    });
    cones.castShadow = true; cones.receiveShadow = true; trunks.castShadow = true;
    group.add(cones, trunks);
  }
  return { trees: [], anims: [] };
}
