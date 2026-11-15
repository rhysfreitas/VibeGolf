// Wrecker's Reach (global THREE), blockout: what COURSE.links holds (world space) put into a hole's frame
// (hole.frame) and drawn. The spit from its height maps (the dunes, the fescue, the beaches, the mainland and the far
// shore) in the ground shader's LINKS branch, the sea, the lagoon, the Cauldron and the creek as one sheet at sea
// level, the built things and wrecks as plain shapes (the Wrecker's Inn, the luggers, the galleon on her side with her
// stern castle and mizzen stump, the man-of-war's hull, the brig's ribs, the yard wall, the frigate's masts in the
// Cauldron, the false light, the bell and the beacon tower on the point), and tussocks of dune grass: one tuft on
// every cell of the field the ball plays as 'tussock' (what you see is what stops the ball), scattered on the dunes
// beyond. The ball's side of it (the rocks, the surfaces) is in the course module and terrain.js; everything here is
// drawn only. The art pass comes later.
import { unpackHeights } from './field-code.js';

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
// the paint byte: 0 dune sand, 1 fescue, 2 beach, 3 wreck timber, 4 stone, 5 dune grass, 6 pot sand, 8 water,
// 10 mown ground
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, LINKS) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B sand (the dunes, the pots, under the tussocks), A grass length
// (fescue). B: R beach, G under a tussock, B wreck timber, A stone
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee'), cS = C.indexOf('sand'), cP = C.indexOf('pot'), cK = C.indexOf('tussock'), cB = C.indexOf('beach');
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
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f; else if (c === cS || c === cP || c === cK) w[3] += f;
      if (c === cB) w[4] += f; if (c === cK) w[5] += f; if (m === 3) w[6] += f; if (m === 4) w[7] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[3] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[4]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 2] = Math.round(Math.min(1, own[6]) * 255 * mown); b[o + 3] = Math.round(Math.min(1, own[7]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T) {
  const C = { desert: '#6d6559', rough: '#a8a35e', firstcut: '#86a04c', fairway: '#7aa84a', fringe: '#84b250', green: '#8fcb5e', tee: '#86b456', sand: '#e9dfc2', pot: '#d8c99c', tussock: '#8f9a58', beach: '#b9ab8c', water: '#3c6876', void: '#15110f' };
  return (x, z) => C[T.surfaceAt(x, z)] || C.sand;
}
// what a native lie is called, from the paint under the ball (the wrecks' footprints and stone are 'desert')
export function lieName(hole, x, z) { return matAt(hole, x, z) === 3 ? 'Wreck' : 'Stone'; }

/* ---------- shapes made once ---------- */
export const TYPES = new Set(['tussock']);   // the clusters' bodies (they play); main.js's buildTrees leaves them to this file
let SHAPES = null;
// a clump of dune grass (marram), drawn as four crossed cards round its middle, each carrying a painted fountain of
// about 150 long blades (texture below): dense and dark at the base, arching out and over to straw tips, combed
// toward +x (the instance turns it to lean downwind). About 1.5 m tall and 2.6 m across at unit scale. Cheap (8
// triangles a clump) and dense, which a few dozen modelled blades never were.
function grassTexture() {
  const W = 512, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); let r = 91; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const col = (t, k) => { const a = [58, 64, 30], m = [118, 126, 62], s = k ? [218, 198, 128] : [170, 176, 96]; const q = t < 0.4 ? a.map((v, i) => v + (m[i] - v) * t / 0.4) : m.map((v, i) => v + (s[i] - v) * (t - 0.4) / 0.6); return `rgb(${q.map(Math.round).join(',')})`; };
  for (let pass = 0; pass < 2; pass++) for (let b = 0; b < 160; b++) {
    const side = rand() * 2 - 1, out = Math.abs(side), x0 = W / 2 + side * W * 0.16 * Math.sqrt(rand()), len = H * (0.55 + 0.42 * rand()) * (1 - 0.25 * out);
    const lean = side * (0.15 + 1.1 * out) + 0.25, straw = rand() < 0.5, wid = 2.2 + 3.2 * rand();
    const pts = []; let px = x0, py = H, ang = lean * 0.35;
    for (let k = 0; k <= 8; k++) { pts.push([px, py]); const t = k / 8; ang += lean * 0.11 * (0.6 + 1.6 * t); px += Math.sin(ang) * len / 8; py -= Math.cos(ang) * len / 8; }
    for (let k = 0; k < 8; k++) { const t = (k + 0.5) / 8; x.strokeStyle = col(pass ? t : t * 0.8, straw); x.lineWidth = wid * (1 - 0.8 * t); x.lineCap = 'round'; x.beginPath(); x.moveTo(...pts[k]); x.lineTo(...pts[k + 1]); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
function clumpCards() {
  const pos = [], nor = [], uv = [], n = 4, w = 1.3, h = 1.55;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI, ca = Math.cos(a) * w, sa = Math.sin(a) * w, lean = 0.35 * h;
    const A = [-ca, -0.05, -sa], B = [ca, -0.05, sa], C = [ca + lean, h, sa], D = [-ca + lean, h, -sa];
    for (const [v, t] of [[A, [0, 0]], [B, [1, 0]], [C, [1, 1]], [A, [0, 0]], [C, [1, 1]], [D, [0, 1]]]) { pos.push(...v); nor.push(0.15, 0.97, 0.15); uv.push(...t); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.userData.keep = true; return g;
}
function shapes() {
  if (SHAPES) return SHAPES;
  const post = new THREE.CylinderGeometry(0.7, 1, 1, 8); post.translate(0, 0.5, 0); post.userData.keep = true;
  const tex = grassTexture(), mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
  return (SHAPES = { post, clump: clumpCards(), grassMat: mat, grassDepth: depth });
}

export function buildLinks(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;

  // ---- the spit from the 10 m map: this hole's field where it has one (so the edges meet the playfield), drawn in
  // the ground shader (aW: x fescue, y beach, z another hole's mown ground, w stone)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 1 ? 1 : 0, m === 2 ? 1 : 0, m === 10 ? 1 : 0, m === 4 || m === 3 ? 1 : 0];
  const split = (Vt, idx, k, k1, k2, k3) => { if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); };
  {
    const st = coarse ? 2 : 1, ni = Math.floor((WM.nx - 1) / st), nj = Math.floor((WM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)); const m = WM.mDec[J * WM.nx + I], wet = m === 8;
      if (inField(x, z) && !wet) { const g = T.groundAt(x, z); if (g !== null) y = g; }
      Vt.set([x, wet ? y - 0.9 : y - 0.3, z], k * 3); Wt.set(wOf(m), k * 4);
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if ([k, k1, k2, k3].every(q => inPlay(Vt[q * 3], Vt[q * 3 + 2]))) continue;
      split(Vt, idx, k, k1, k2, k3);
    }
    group.add(groundMesh(Vt, Wt, idx));
  }
  // ---- out past it: the sea, the lagoon, the mainland and the far shore, from the 60 m map
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); FM.mDec = dec(FM.m, Uint8Array); }
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 40, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 40, iz0 = WM.z0 + 40, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 40;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = FM.mDec[J * FM.nx + I];
      Vt.set([x, LY(FM.hDec[J * FM.nx + I] / FM.scale + FM.y0) - (m === 8 ? 1.6 : 0.6), z], k * 3); Wx.set([X, Z], k * 2); Wt.set(wOf(m), k * 4);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; split(Vt, idx, k, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }

  // ---- the sea, the lagoon, the Cauldron and the creek: one sheet at sea level (every bed is drawn under it)
  {
    const g = new THREE.PlaneGeometry(19000, 19000); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x35596a, roughness: 0.2, metalness: 0, envMapIntensity: 1 }));
    m.position.set(cx, LY(E.level) - 0.03, cz); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }

  // ---- the built things and the wrecks as plain shapes. A box: w across, l along (rot: the compass direction of
  // l), from y up h; `tk` tapers the top. Posts and masts as cylinders, leaning toward the east by `lean` degrees
  const B = batch(), timber = lin([92, 80, 66]), timberD = lin([62, 54, 46]), stone = lin([150, 144, 132]), stoneD = lin([118, 112, 102]), plaster = lin([214, 206, 188]), slate = lin([70, 72, 78]), hullC = lin([58, 48, 40]);
  const block = (X, Z, y, w, l, h, rot, k, tk = 1, dy = 0, kt = k) => {
    const [x, z] = L(X, Z), r = rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), y0 = LY(y) + dy, y1 = y0 + h;
    const P = (su, sv, t) => [x + (ux * su * w / 2 + vx * sv * l / 2) * (t ? tk : 1), t ? y1 : y0, z + (uz * su * w / 2 + vz * sv * l / 2) * (t ? tk : 1)];
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let f = 0; f < 4; f++) { const p = c[f], q = c[(f + 1) % 4]; B.quad(P(...p, 0), P(...p, 1), P(...q, 1), P(...q, 0), f % 2 ? k : k.map(v => v * 0.86)); }
    B.quad(P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), P(1, -1, 1), kt);
  };
  const roof = (X, Z, y, w, l, h, rot, k) => {   // a pitched roof along l
    const [x, z] = L(X, Z), r = rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), y0 = LY(y);
    const P = (su, sv, up) => [x + ux * su * w / 2 + vx * sv * l / 2, y0 + up, z + uz * su * w / 2 + vz * sv * l / 2];
    B.quad(P(-1.08, -1.04, 0), P(-1.08, 1.04, 0), P(0, 1.04, h), P(0, -1.04, h), k); B.quad(P(1.08, 1.04, 0), P(1.08, -1.04, 0), P(0, -1.04, h), P(0, 1.04, h), k.map(v => v * 0.8));
    B.tri(P(-1, -1, 0), P(0, -1, h), P(1, -1, 0), plaster); B.tri(P(1, 1, 0), P(0, 1, h), P(-1, 1, 0), plaster);
  };
  const posts = [];
  for (const P of E.built) {
    const [X, Z] = P.at;
    if (P.kind === 'inn') { block(X, Z, P.y, P.w, P.l, P.h * 0.62, P.rot, plaster); roof(X, Z, P.y + P.h * 0.62, P.w, P.l, P.h * 0.38, P.rot, slate); block(X, Z, P.y, P.w * 0.5, P.l * 0.3, P.h * 1.15, P.rot, stone, 0.9, 0, stoneD); }   // a stern castle hauled up the beach: a tall stone-and-timber end on it
    else if (P.kind === 'lugger') { block(X, Z, P.y, P.w, P.l, P.h * 0.6, P.rot, timber, 1.25); block(X, Z, P.y, P.w * 0.5, P.l * 0.92, P.h * 0.9, P.rot, timberD, 1); }
    else if (P.kind === 'hull') {
      if (P.sunk) continue;
      // on her side: the curved bottom toward the sky as a battered block, darker planking
      block(X, Z, P.y, P.w, P.l, P.h * 0.55, P.rot, hullC, 1.05); block(X, Z, P.y, P.w * 0.86, P.l * 0.94, P.h, P.rot, hullC.map(v => v * 1.2), 0.7, 0, timber);
    }
    else if (P.kind === 'castle') { block(X, Z, P.y, P.w, P.l, P.h * 0.7, P.rot, hullC.map(v => v * 1.1), 0.96); block(X, Z, P.y, P.w * 0.8, P.l * 0.7, P.h, P.rot, timber, 0.85, 0, timberD); }
    else if (P.kind === 'wall') block(X, Z, P.y, P.w, P.l, P.h, P.rot, stone, 0.9, 0, stoneD);
    else if (P.kind === 'rib') block(X, Z, P.y, P.w, P.l, P.h, P.rot, timberD, 0.6);
    else posts.push(P);
  }
  { const m = B.mesh(vc({ flatShading: true })); if (m) group.add(m); }
  // posts, masts and the beacon tower (instanced cylinders)
  if (posts.length) {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), ax = new THREE.Vector3();
    const pm = new THREE.InstancedMesh(S.post, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), posts.length);
    const colOf = { mast: 0x51463a, lantern: 0x3d342c, bell: 0x3d342c, beacon: 0xb3aa98 };
    posts.forEach((P, i) => {
      const [x, z] = L(...P.at), lean = (P.lean || 0) * Math.PI / 180;
      // a lean tips the top toward the east (as the course module's wedge does): east in this frame is L(X + 1) - L(X)
      const [ex, ez] = L(P.at[0] + 1, P.at[1]);
      Q.setFromAxisAngle(ax.set(ez - z, 0, -(ex - x)).normalize(), lean);
      pm.setMatrixAt(i, M.compose(new THREE.Vector3(x, LY(P.y), z), Q, new THREE.Vector3(P.r, P.h, P.r)));
      pm.setColorAt(i, new THREE.Color(colOf[P.kind] ?? 0x51463a));
      if (P.kind === 'beacon') {   // a lantern room on top
        const top = new THREE.Mesh(new THREE.CylinderGeometry(P.r * 0.6, P.r * 0.75, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.6, emissive: 0x6a4a1a, emissiveIntensity: 0.6 }));
        top.position.set(x, LY(P.y) + P.h + 2, z); top.castShadow = true; group.add(top);
      }
    });
    pm.castShadow = true; pm.receiveShadow = true; group.add(pm);
  }

  // ---- dune grass: a clump on every field cell that plays as 'tussock' (what you see is what stops the ball), the
  // clusters out past the field from COURSE.links.grass, and an eyebrow of small clumps along the top edge of every
  // pot (drawn only). Each clump leans downwind of the prevailing sea wind (from the south-west).
  {
    const near = [], far = [], brow = [];
    const L0 = L(0, 0), Le = L(Math.SQRT1_2, -Math.SQRT1_2), lean = Math.atan2(-(Le[1] - L0[1]), Le[0] - L0[0]);   // downwind (toward the north-east) in this frame
    const line = hole.line, dLine = (x, z) => { let d = Infinity; for (let i = 1; i < line.length; i++) { const [ax, az] = line[i - 1], [bx, bz] = line[i], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return d; };
    if (Fd) {
      const cK = Fd.codes.indexOf('tussock');
      for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) {
        if (Fd.s[j * Fd.nx + i] !== cK) continue;
        const x = Fd.x0 + i * Fd.cell + (hash(i, j) - 0.5) * 1.1, z = Fd.z0 + j * Fd.cell + (hash(j, i) - 0.5) * 1.1, g = T.groundAt(x, z);
        if (g === null) continue;
        const dl = dLine(x, z); if (coarse && dl > 70 && (i + j) % 2) continue;
        (dl < (coarse ? 70 : 110) ? near : far).push([x, g - 0.06, z, 1.25 + 0.4 * hash(i + 3, j), 1.15 + 0.3 * hash(i, j + 5)]);
      }
    }
    // clusters whose middle is outside the field: filled with clumps on a 2.2 m grid over their ellipse
    const wy = (X, Z) => { const fx = Math.max(0, Math.min(WM.nx - 1.001, (X - WM.x0) / WM.cell)), fz = Math.max(0, Math.min(WM.nz - 1.001, (Z - WM.z0) / WM.cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      return (wH(i, j) * (1 - u) + wH(i + 1, j) * u) * (1 - v) + (wH(i, j + 1) * (1 - u) + wH(i + 1, j + 1) * u) * v; };
    for (const [X, Z, rx, rz, rot] of E.grass || []) {
      const [cx0, cz0] = L(X, Z); if (inField(cx0, cz0) || Math.hypot(cx0 - cx, cz0 - cz) > (coarse ? 520 : 800)) continue;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      const st = coarse ? 3.6 : 3; for (let u = -rx; u <= rx; u += st) for (let v = -rz; v <= rz; v += st) {
        if ((u / rx) ** 2 + (v / rz) ** 2 > 0.9) continue;
        const Xp = X + u * ca - v * sa + (hash(u + X, v) - 0.5), Zp = Z + u * sa + v * ca + (hash(v, u + Z) - 0.5), [x, z] = L(Xp, Zp);
        far.push([x, LY(wy(Xp, Zp)) - 0.36, z, 1.55 + 0.4 * hash(Xp, Zp), 1.2 + 0.3 * hash(Zp, Xp)]);
      }
    }
    // eyebrows on the pots: small clumps along the higher half of each rim, just outside it
    for (const b of hole.bunkers || []) {
      if (b.lie !== 'pot' || !b.outline) continue;
      const O = b.outline, ys = O.map(p => T.groundAt(p[0], p[1]) ?? 0), mean = ys.reduce((a, v) => a + v, 0) / ys.length;
      let acc = 0;
      for (let i = 0; i < O.length; i++) { const p = O[i], q = O[(i + 1) % O.length]; acc += Math.hypot(q[0] - p[0], q[1] - p[1]); if (acc < 1.3) continue; acc = 0;
        if (ys[i] <= mean + 0.05) continue;
        const ox = p[0] - b.x, oz = p[1] - b.z, ol = Math.hypot(ox, oz) || 1, x = p[0] + ox / ol * 0.7, z = p[1] + oz / ol * 0.7, g = T.groundAt(x, z);
        if (g !== null) brow.push([x, g - 0.05, z, 0.45 + 0.15 * hash(x, z), 0.5 + 0.2 * hash(z, x)]); }
    }
    const put = (geo, list, shadow) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geo, S.grassMat, list.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
      list.forEach(([x, y, z, r, h], i) => {
        m.setMatrixAt(i, M.compose(new THREE.Vector3(x, y, z), Q.setFromAxisAngle(up, lean + (hash(x, z) - 0.5) * 0.7), new THREE.Vector3(r, h, r)));
        const t = hash(z * 1.3, x * 0.7); m.setColorAt(i, C.setRGB(0.85 + 0.25 * t, 0.88 + 0.2 * t, 0.82 + 0.12 * hash(x * 3, z)));
      });
      m.castShadow = shadow; m.receiveShadow = true; group.add(m);
      if (shadow) m.customDepthMaterial = S.grassDepth;   // the blades' shadow, not the cards'
    };
    put(S.clump, near, !coarse);
    put(S.clump, brow, false);
    put(S.clump, far, false);
  }
  return { trees: [], anims: [] };
}
