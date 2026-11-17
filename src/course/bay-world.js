// Emerald Bay (global THREE), blockout: what COURSE.bay holds (world space) put into a hole's frame (hole.frame) and
// drawn. The bay's ground from its height maps (salt grass, the jungle floor, dry and wet sand, limestone) in the
// ground shader's BAY branch, which also tints whatever is under the round's sea (uBSea: turquoise in the shallows,
// deep blue further out); the sea as one sheet at the round's level (hole.sea, from the tide: versions.js); the sea
// cave's roof and the 7th's overhang as slabs of rock; the stilt village, the jetty, the longtails, the beach shack and
// the crest marker as plain shapes; palms as instanced trunks under flat crowns, kept off the lines of play. The
// ball's side of it (the ground, the rocks, the surfaces, the tide) is in the course module, terrain.js and
// versions.js; everything here is drawn only. The art pass comes later.
import { unpackHeights } from './field-code.js';

export const TYPES = new Set();   // nothing for main.js's buildTrees to leave to us (the palms are scenery, drawn here)
export const U = { uBSea: { value: 0 } };
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
// the paint byte: 0 salt grass, 1 jungle, 2 rock, 3 dry sand, 4 wet sand, 6 bunker sand, 8 water (at low tide), 10 mown
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, BAY) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B bunker sand, A grass length (rough about 0.55; sand and rock 0).
// B: R jungle, G dry sand, B wet sand, A rock. Under the sea the shader tints it by depth, so the tide needs no paint.
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
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG && m === 0) w[2] += f; else if (c === cS) w[4] += f;
      if (m === 1) w[5] += f; if (m === 3) w[6] += f; if (m === 4 || m === 8) w[7] += f; if (m === 2) w[8] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[4] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[6]) * 255 * mown); b[o + 2] = Math.round(Math.min(1, own[7]) * 255 * mown); b[o + 3] = Math.round(Math.min(1, own[8]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces (so it shows the round's tide)
export function mapPaint(T, hole) {
  const C = { desert: '#a9a59a', rough: '#7c8f4e', fairway: '#6fb04a', fringe: '#7aba50', green: '#8fd05e', tee: '#86b456', sand: '#f2ecd8', waste: '#e9e0c6', beach: '#cdbf98', water: '#3fa7b0' };
  return (x, z) => { const s = T.surfaceAt(x, z); if (s === 'rough' && matAt(hole, x, z) === 1) return '#3f6a2c'; return C[s] || C.rough; };
}
// what a rough lie is called, from the paint under the ball: the jungle floor or salt grass
export function lieName(hole, x, z) { return matAt(hole, x, z) === 1 ? 'Jungle' : 'Rough'; }

/* ---------- shapes made once ---------- */
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const crown = new THREE.ConeGeometry(1, 1, 7, 1, true); crown.translate(0, -0.5, 0); crown.rotateX(Math.PI);   // a flat, drooping umbrella of fronds
  { const p = crown.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = 1 + 0.22 * Math.sin(a * 7); p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); } crown.computeVertexNormals(); }
  const trunk = new THREE.CylinderGeometry(0.2, 0.32, 1, 6, 1, true); trunk.translate(0, 0.5, 0);
  for (const g of [crown, trunk]) g.userData.keep = true;
  return (SHAPES = { crown, trunk });
}
const mapOf = M => { if (!M.hDec) { M.hDec = dec(M.h, Int16Array); if (M.pred) unpackHeights(M.hDec, M.nx); M.mDec = dec(M.m, Uint8Array); } return M; };
// distance from (X, Z) to the nearest line of play or tee, world space
function playD(E, X, Z) {
  let d = Infinity;
  for (const P of E.play) {
    for (let i = 0; i < P.line.length - 1; i++) {
      const [ax, az] = P.line[i], [bx, bz] = P.line[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((X - ax) * dx + (Z - az) * dz) / L2));
      d = Math.min(d, Math.hypot(X - ax - dx * t, Z - az - dz * t));
    }
    for (const t of P.tees) d = Math.min(d, Math.hypot(X - t[0], Z - t[1]));
  }
  return d;
}

export function buildBay(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LV = (vx, vz) => [vx * rx + vz * rz, -(vx * fx + vz * fz)];
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const SEA = Number.isFinite(hole.sea) ? hole.sea : LY(0);
  U.uBSea.value = SEA;
  const gnd = (x, z) => T.groundAt(x, z);

  // ---- the ground from the 10 m and 40 m maps: this hole's field where it has one (so the edges meet the playfield),
  // drawn in the ground shader (aW: x jungle, y sand (1 dry, 0.5 wet), z another hole's mown ground, w rock)
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = true; return m;
  };
  const wOf = m => [m === 1 ? 1 : 0, m === 3 ? 1 : m === 4 ? 0.5 : 0, m === 10 ? 1 : 0, m === 2 ? 1 : 0];
  const split = (Vt, idx, k, k1, k2, k3) => { if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); };
  const drawMap = (M, skip, st, sink) => {
    const ni = Math.floor((M.nx - 1) / st), nj = Math.floor((M.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = M.x0 + I * M.cell, Z = M.z0 + J * M.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = M.mDec[J * M.nx + I];
      Wx.set([X, Z], k * 2);
      let y = LY(M.hDec[J * M.nx + I] / M.scale + M.y0);
      if (inField(x, z)) { const g = gnd(x, z); if (g !== null) y = g; }
      Vt.set([x, y - sink, z], k * 3); Wt.set(wOf(m), k * 4);
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if (skip([k, k1, k2, k3], Wx)) continue;
      split(Vt, idx, k, k1, k2, k3);
    }
    group.add(groundMesh(Vt, Wt, idx));
  };
  const WM = mapOf(E.world), FM = mapOf(E.far);
  drawMap(WM, () => false, coarse ? 2 : 1, 0.3);
  const ix0 = WM.x0 + 30, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 30, iz0 = WM.z0 + 30, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 30;
  drawMap(FM, (q, Wx) => q.every(p => Wx[p * 2] > ix0 && Wx[p * 2] < ix1 && Wx[p * 2 + 1] > iz0 && Wx[p * 2 + 1] < iz1), 1, 0.8);

  // ---- the sea: one sheet at the round's level, clear (the shader colours what is under it), with the sky's sheen
  {
    const R = 7000, g = new THREE.PlaneGeometry(R * 2, R * 2, 1, 1); g.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x2b8f98, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.3 }));
    sea.position.set(cx, SEA, cz); sea.renderOrder = 1; sea.receiveShadow = true; group.add(sea);
  }

  // ---- the built things: plain shapes
  const rockK = lin([150, 146, 136]), rockD = lin([112, 108, 100]);
  {
    const B = batch(), wood = lin([128, 96, 64]), woodD = lin([98, 72, 48]), thatch = lin([170, 140, 86]), thatchD = lin([138, 110, 64]), white = lin([226, 222, 210]), hullC = lin([70, 110, 150]), red = lin([186, 60, 44]);
    const box3 = (x, z, y0, w, l, h, r, k, kd, taper = 1) => {
      const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r);
      const P = (su, sv, top) => { const t = top ? taper : 1; return [x + (ux * su * w / 2 + vx * sv * l / 2) * t, top ? y0 + h : y0, z + (uz * su * w / 2 + vz * sv * l / 2) * t]; };
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let f = 0; f < 4; f++) { const p = c[f], q = c[(f + 1) % 4]; B.quad(P(...p, 0), P(...p, 1), P(...q, 1), P(...q, 0), f % 2 ? k : kd); }
      B.quad(P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), P(1, -1, 1), kd);
    };
    const pitched = (x, z, y0, w, l, r, k, kd) => {
      const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), e = 1.2, rh = Math.min(w, l) * 0.42;
      const P = (su, sv, dy) => [x + ux * su * w / 2 * e + vx * sv * l / 2 * e, y0 + dy, z + uz * su * w / 2 * e + vz * sv * l / 2 * e];
      B.quad(P(-1, -1, -0.5), P(-1, 1, -0.5), P(0, 1, rh), P(0, -1, rh), k); B.quad(P(1, 1, -0.5), P(1, -1, -0.5), P(0, -1, rh), P(0, 1, rh), kd);
      B.tri(P(-1, -1, -0.5), P(0, -1, rh), P(1, -1, -0.5), kd); B.tri(P(1, 1, -0.5), P(0, 1, rh), P(-1, 1, -0.5), kd);
    };
    const HW = LY(E.tides.high);
    for (const o of E.sites) {
      const [x, z] = L(...o.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue;
      const y = LY(o.y), r = o.rot - a;
      if (o.kind === 'stilt') {   // a house on stilts over the water: posts, a deck above high water, a thatched roof
        const deck = Math.max(y, HW) + 1.6;
        for (const [su, sv] of [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]]) { const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r); box3(x + ux * su * o.w + vx * sv * o.l, z + uz * su * o.w + vz * sv * o.l, y - 1, 0.35, 0.35, deck - y + 1, r, woodD, woodD); }
        box3(x, z, deck, o.w, o.l, 0.3, r, wood, woodD); box3(x, z, deck + 0.3, o.w * 0.85, o.l * 0.85, 2.6, r, wood, woodD); pitched(x, z, deck + 2.9, o.w * 0.85, o.l * 0.85, r, thatch, thatchD);
      } else if (o.kind === 'shack') { box3(x, z, y - 0.5, o.w, o.l, o.h * 0.6 + 0.5, r, white, lin([200, 196, 184])); pitched(x, z, y + o.h * 0.6, o.w, o.l, r, thatch, thatchD); }
      else if (o.kind === 'jetty') {
        const deck = Math.max(y, HW) + 1.2, vx = Math.sin(r), vz = -Math.cos(r);
        box3(x, z, deck, o.w, o.l, 0.25, r, wood, woodD);
        for (let t = -0.5; t <= 0.5; t += 0.125) box3(x + vx * t * o.l, z + vz * t * o.l, deck - 6, 0.3, 0.3, 6, r, woodD, woodD);
      } else if (o.kind === 'longtail') {   // a long, narrow boat riding at the tide's level, a raised prow
        const sy = Math.max(SEA, y) - 0.1;
        box3(x, z, sy - 0.4, o.w, o.l, 0.9, r, hullC, lin([50, 80, 112]), 0.9);
        const vx = Math.sin(r), vz = -Math.cos(r); box3(x + vx * o.l * 0.45, z + vz * o.l * 0.45, sy + 0.4, 0.5, 1.2, 1.4, r, red, red, 0.4);
      } else if (o.kind === 'marker') { box3(x, z, y - 0.3, 0.5, 0.5, o.h + 0.3, r, white, white); box3(x, z, y + o.h - 1.2, 0.9, 0.9, 1.2, r, red, red); }
      else if (o.kind === 'tree') { box3(x, z, y - 0.3, 0.8, 0.8, o.h * 0.7, r + 0.4, woodD, woodD, 0.5); box3(x + 1.5, z, y + o.h * 0.55, 5, 4, 2.4, r, lin([52, 88, 44]), lin([40, 70, 36]), 0.6); }
    }
    // the sea cave's roof and the 7th's overhang: the slabs the ball meets, the cave's built up to the island's top
    for (const R of E.roof) {
      const [x, z] = L(...R.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue;
      const [ux, uz] = LV(R.a[0], R.a[1]), r = Math.atan2(uz, ux);
      box3(x, z, LY(R.y), R.w, R.d, R.what === 'cave' ? 115 - R.y : R.h, r, rockK, rockD);
    }
    const m = B.mesh(vc({ flatShading: true, side: THREE.DoubleSide })); if (m) group.add(m);
  }

  // ---- palms: on the jungle and the dry sand of the 10 m map within reach of the hole, 28 m or more off every line
  // of play and tee, leaning a little toward the sea
  {
    const near = [], R2 = (coarse ? 1100 : 1500) ** 2, step = coarse ? 3 : 2;
    for (let j = 0; j < WM.nz; j += step) for (let i = 0; i < WM.nx; i += step) {
      const m = WM.mDec[j * WM.nx + i]; if (m !== 1 && m !== 3) continue;
      const X = WM.x0 + (i + hash(i, j) - 0.5) * WM.cell, Z = WM.z0 + (j + hash(j, i) - 0.5) * WM.cell;
      if (hash(i * 3.1, j * 1.7) > (m === 1 ? 0.55 : 0.18)) continue;
      const [x, z] = L(X, Z); if ((x - cx) ** 2 + (z - cz) ** 2 > R2) continue;
      if (playD(E, X, Z) < 28) continue;
      const y = inField(x, z) ? gnd(x, z) : LY(WM.hDec[j * WM.nx + i] / WM.scale + WM.y0);
      if (y === null || y < SEA + 0.4) continue;
      if (inField(x, z) && T.surfaceAt(x, z) !== 'rough' && T.surfaceAt(x, z) !== 'waste') continue;
      near.push({ x, z, y, h: 11 + 9 * hash(X, Z), r: 3.4 + 1.6 * hash(Z, X), lean: 0.18 * hash(X * 2, Z), dir: hash(Z * 3, X) * 6.28 });
    }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color(), tilt = new THREE.Quaternion(), ax = new THREE.Vector3();
    const crowns = new THREE.InstancedMesh(S.crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), near.length);
    const trunks = new THREE.InstancedMesh(S.trunk, new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.95 }), near.length);
    near.forEach((t, k) => {
      ax.set(Math.cos(t.dir), 0, Math.sin(t.dir)); tilt.setFromAxisAngle(ax, t.lean);
      const top = new THREE.Vector3(0, t.h, 0).applyQuaternion(tilt);
      trunks.setMatrixAt(k, M.compose(new THREE.Vector3(t.x, t.y - 0.3, t.z), tilt, new THREE.Vector3(1.2, t.h, 1.2)));
      crowns.setMatrixAt(k, M.compose(new THREE.Vector3(t.x + top.x, t.y + top.y - 0.3, t.z + top.z), Q.setFromAxisAngle(up, hash(t.x, t.z) * 6.28), new THREE.Vector3(t.r, t.r * 0.45, t.r)));
      const v = 0.8 + 0.4 * hash(t.x * 2, t.z); crowns.setColorAt(k, C.setRGB(...lin([62 * v, 112 * v, 48 * v])));
    });
    crowns.castShadow = true; crowns.receiveShadow = true; trunks.castShadow = true;
    group.add(crowns, trunks);
  }
  return { trees: [], anims: [] };
}
