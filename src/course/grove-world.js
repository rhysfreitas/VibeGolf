// Eldergrove (global THREE), blockout: what COURSE.grove holds (world space) put into a hole's frame (hole.frame) and
// drawn. The forest floor from its height maps (leaf litter, fern, moss, the meadow and the Glade, the fallen giant's
// bark) in the ground shader's GROVE branch, the brook and the pool as water sheets, every giant as a tapered trunk
// under a crown far overhead (instanced), the heart tree with its buttresses, the root plate and the burnt shell, and
// the Stair's decks on their limbs with the stair round the trunk. Out past the plan's forest, more trunks to the
// mist. The ball's side of it (the tree bodies, the rocks, the surfaces) is in the course module, terrain.js and
// trees.js; everything here is drawn only. The art pass comes later.
import { unpackHeights } from './field-code.js';

export const TYPES = new Set(['redwood', 'heart', 'snag']);   // main.js's buildTrees leaves these to us (they still play)
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
// the paint byte: 0 leaf litter, 1 fern, 2 moss, 3 root, 4 bark, 5 meadow, 6 sand, 8 water, 9 a deck, 10 mown
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, GROVE) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B sand, A grass length (fern about 0.55, moss 1; leaf litter 0).
// B: R meadow, G root, B bark, A the water's edge (wet moss)
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cM = C.indexOf('firstcut'), cT = C.indexOf('tee'), cS = C.indexOf('sand'), cW = C.indexOf('water');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f; else if (c === cM) w[3] += f; else if (c === cS) w[4] += f;
      if (m === 5) w[5] += f; if (m === 3) w[6] += f; if (m === 4) w[7] += f; if (c === cW) w[8] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[4] * 255); a[o + 3] = Math.min(255, (own[0] + own[1] + own[3]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[6]) * 255 * mown); b[o + 2] = Math.round(Math.min(1, own[7]) * 255 * mown); b[o + 3] = Math.round(Math.min(1, own[8] * 2.5) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#6f5b45', rough: '#55753a', firstcut: '#7f9c43', fairway: '#6fa34a', fringe: '#7aae50', green: '#8fcb5e', tee: '#86b456', sand: '#d8c9a0', beach: '#7c6247', water: '#3c6876', void: '#15110f' };
  return (x, z) => { const s = T.surfaceAt(x, z); if (s === 'rough' && matAt(hole, x, z) === 5) return '#86a352'; return C[s] || C.beach; };
}
// what a lie is called, from the paint under the ball: native is root or bark, rough is fern or the meadow
export function lieName(hole, x, z, lie) {
  const m = matAt(hole, x, z);
  if (lie === 'rough') return m === 5 ? 'Meadow' : 'Fern';
  return m === 4 ? 'Bark' : 'Root';
}
// the ground the playfield draws: under a deck, the floor (the deck itself is grown wood, drawn on its limb)
export function drawTerrain(T, hole) {
  const D = hole.deckFloor; if (!D || !D.length) return T;
  const F = hole.field, M = new Map(); for (const [i, j, y] of D) M.set(j * F.nx + i, y);
  const fl = (i, j) => M.get(j * F.nx + i);
  const groundAt = (x, z) => {
    const fx = (x - F.x0) / F.cell, fz = (z - F.z0) / F.cell, i = Math.floor(fx), j = Math.floor(fz);
    const c = [fl(i, j), fl(i + 1, j), fl(i, j + 1), fl(i + 1, j + 1)];
    if (c.every(v => v === undefined)) return T.groundAt(x, z);
    // a cell touching a deck: the floor's heights where it has them, the field's elsewhere
    const g = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([a, b], k) => c[k] ?? T.groundAt(F.x0 + a * F.cell, F.z0 + b * F.cell));
    const u = fx - i, v = fz - j;
    return (g[0] * (1 - u) + g[1] * u) * (1 - v) + (g[2] * (1 - u) + g[3] * u) * v;
  };
  return { ...T, groundAt };
}

/* ---------- shapes made once ---------- */
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  // a giant's trunk: unit radius at the foot narrowing to 0.42 at the top, flared over its lowest 6%, unit height
  const trunk = new THREE.CylinderGeometry(0.42, 1, 1, 14, 6, true); trunk.translate(0, 0.5, 0);
  { const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = 1 + 0.55 * Math.max(0, 1 - y / 0.06) ** 2, a = Math.atan2(p.getZ(i), p.getX(i)), lobe = 1 + 0.12 * Math.abs(Math.cos(a * 2.5)) * Math.max(0, 1 - y / 0.1); p.setX(i, p.getX(i) * f * lobe); p.setZ(i, p.getZ(i) * f * lobe); } trunk.computeVertexNormals(); }
  // a crown: an old conifer's, tiers of drooping boughs stacked up a spire (unit radius at its widest, unit height
  // from its lowest bough to its tip), the outline crownR; three of them so neighbours differ, and a plain one far off
  const crowns = [0, 1, 2].map(v => coniferGeo(9, 10, v, true)), crownFar = coniferGeo(4, 6, 3, false);
  const step = new THREE.BoxGeometry(1, 1, 1); step.translate(0, 0.5, 0);
  for (const g of [trunk, ...crowns, crownFar, step]) g.userData.keep = true;
  return (SHAPES = { trunk, crowns, crownFar, step });
}
// the outline of a conifer's crown: u from its lowest bough (0) to its tip (1) -> radius as a share of the widest,
// from a sixth of the way up to past half way (an old tree's crown is a column more than a cone), then the spire;
// the shafts of sun go by it too
export const crownR = u => u < 0 || u > 1 ? 0 : u < 0.15 ? 0.85 + u : u < 0.55 ? 1 - 0.15 * (u - 0.15) / 0.4 : 0.85 * Math.pow((1 - u) / 0.45, 0.8);
// tiers of boughs: each a ragged, drooping skirt (a cone, its rim jittered, with a shallow underside so from below it
// reads as a mass of foliage), lighter toward the top; vertex colours (the instance colour multiplies them)
function coniferGeo(N, seg, v, under) {
  const pos = [], col = [], tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let q = 0; q < 3; q++) col.push(k, k * 1.02, k * 0.98); };
  for (let k = 0; k < N; k++) {
    const ub = k / N * 0.86, ua = Math.min(1, ub + 0.26 + 0.04 * hash(k, v)), R = crownR(ub + 0.05) * (0.88 + 0.22 * hash(v * 3 + k, 1.7)) + 0.04;
    const ox = (hash(k * 1.3, v) - 0.5) * 0.16, oz = (hash(v, k * 1.9) - 0.5) * 0.16, rot = hash(k, v + 4) * 6.28;
    const rim = [...Array(seg)].map((_, q) => { const an = rot + q / seg * Math.PI * 2, j = 0.78 + 0.4 * hash(q * 2.1 + k, v * 5.3 + q); return [ox + Math.cos(an) * R * j, ub - 0.025 * j + (hash(q, k + v) - 0.5) * 0.03, oz + Math.sin(an) * R * j]; });
    const apex = [ox * 0.5, ua, oz * 0.5], bot = [ox, ub + 0.07, oz], lit = 0.72 + 0.3 * (ub + ua) / 2;
    for (let q = 0; q < seg; q++) { const A = rim[q], B = rim[(q + 1) % seg]; tri(A, apex, B, lit * (0.9 + 0.2 * hash(q, k * 7 + v))); if (under) tri(B, bot, A, 0.42); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// a limb: rings along a quadratic curve from A through K to B, radius r0 to r1, flared where it leaves the trunk
function limbGeo(A, K, B, r0, r1) {
  const N = 16, S = 10, pos = [], idx = [], P = t => A.map((v, i) => (1 - t) * (1 - t) * v + 2 * (1 - t) * t * K[i] + t * t * B[i]);
  for (let s = 0; s <= N; s++) {
    const t = s / N, p = P(t), q = P(Math.min(1, t + 0.02)), o = P(Math.max(0, t - 0.02)), d = new THREE.Vector3(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
    const u = new THREE.Vector3(0, 1, 0).cross(d).normalize(), v = d.clone().cross(u).normalize(), r = (r0 + (r1 - r0) * t) * (1 + 0.6 * Math.max(0, 1 - t / 0.2) ** 2);
    for (let k = 0; k < S; k++) { const a = k / S * Math.PI * 2, c = Math.cos(a) * r, sn = Math.sin(a) * r * (0.75 + 0.25 * t); pos.push(p[0] + u.x * c + v.x * sn, p[1] + u.y * c + v.y * sn, p[2] + u.z * c + v.z * sn); }
  }
  for (let s = 0; s < N; s++) for (let k = 0; k < S; k++) { const a = s * S + k, b = s * S + (k + 1) % S, c = a + S, d = b + S; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function buildGrove(hole, T, box, E, hi, { group, coarse, rockMat, sunDir }) {
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const DT = drawTerrain(T, hole), gnd = (x, z) => DT.groundAt(x, z);

  // ---- the forest floor from the 10 m map: this hole's field where it has one (so the edges meet the playfield),
  // drawn in the ground shader (aW: x fern, y moss (the meadow 0.6), z another hole's mown ground, w root and bark)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 1 ? 1 : 0, m === 2 ? 1 : m === 5 ? 0.6 : 0, m === 10 ? 1 : 0, m === 3 || m === 4 ? 1 : 0];
  const split = (Vt, idx, k, k1, k2, k3) => { if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); };
  const W = batch(), water = lin([46, 58, 52]);
  {
    const st = coarse ? 2 : 1, ni = Math.floor((WM.nx - 1) / st), nj = Math.floor((WM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), wet = new Uint8Array((ni + 1) * (nj + 1)), surf = new Float32Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)); const m = WM.mDec[J * WM.nx + I]; wet[k] = m === 8 ? 1 : 0; surf[k] = y;
      if (inField(x, z) && !wet[k]) { const g = gnd(x, z); if (g !== null) y = g; }
      Vt.set([x, wet[k] ? y - 0.9 : y - 0.3, z], k * 3); Wt.set(wOf(m), k * 4);
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1, q = [k, k1, k2, k3];
      const play = q.every(p => inPlay(Vt[p * 3], Vt[p * 3 + 2]));
      if (!play) split(Vt, idx, k, k1, k2, k3);
      // the water outside the field, from the 10 m map: a sheet at the surface over every cell with water at a corner
      if (!play && q.some(p => wet[p])) { const lv = Math.min(...q.filter(p => wet[p]).map(p => surf[p])) - 0.05, P = p => [Vt[p * 3], lv, Vt[p * 3 + 2]]; W.quad(P(k), P(k2), P(k3), P(k1), water); }
    }
    group.add(groundMesh(Vt, Wt, idx));
  }
  // ---- out past it: the floor of the forest running on into the mist, from the 60 m map
  const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); FM.mDec = dec(FM.m, Uint8Array); }
  const ix0 = WM.x0 + 40, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 40, iz0 = WM.z0 + 40, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 40;
  {
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = FM.mDec[J * FM.nx + I];
      Vt.set([x, LY(FM.hDec[J * FM.nx + I] / FM.scale + FM.y0) - (m === 8 ? 1.6 : 0.6), z], k * 3); Wx.set([X, Z], k * 2); Wt.set(wOf(m), k * 4);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; split(Vt, idx, k, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }
  // ---- the brook and the pool inside the field: a sheet 0.8 m over the bed on every cell that plays as water
  if (Fd) {
    const cW = Fd.codes.indexOf('water');
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const ks = [j * Fd.nx + i, j * Fd.nx + i + 1, (j + 1) * Fd.nx + i, (j + 1) * Fd.nx + i + 1];
      if (!ks.some(k => Fd.s[k] === cW)) continue;
      const x0 = Fd.x0 + i * Fd.cell, z0 = Fd.z0 + j * Fd.cell, ys = [[x0, z0], [x0 + Fd.cell, z0], [x0, z0 + Fd.cell], [x0 + Fd.cell, z0 + Fd.cell]].map((p, q) => Fd.s[ks[q]] === cW ? T.groundAt(...p) + 0.8 : null).filter(v => v !== null);
      const lv = Math.min(...ys) - 0.03;
      W.quad([x0, lv, z0], [x0, lv, z0 + Fd.cell], [x0 + Fd.cell, lv, z0 + Fd.cell], [x0 + Fd.cell, lv, z0], water);
    }
  }
  { const m = W.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0, envMapIntensity: 1.2 }), false); if (m) { m.renderOrder = 1; group.add(m); } }

  // ---- the giants: every one within reach of this hole as a tapered trunk under its crown; snags bare; the heart
  // tree on its own. Out past the plan's forest, more trunks on a jittered grid into the mist (not in the meadow)
  const near = [], R2 = (coarse ? 1300 : 1700) ** 2;
  for (const t of E.trees) {
    const [x, z] = L(t[0], t[1]); if ((x - cx) ** 2 + (z - cz) ** 2 > R2) continue;
    const [ex, ez] = L(t[0] + (t[8] || 0), t[1] + (t[9] || 0));   // the crown leaning out over an opening
    near.push({ x, z, ox: ex - x, oz: ez - z, r: t[2], h: t[3], low: t[4], cr: t[5], y: LY(t[6]), heart: t[7] & 1, snag: t[7] & 2, stair: t[7] & 16 });
  }
  {
    const G = 40, ext = coarse ? 1300 : 1700;
    const fmM = (X, Z) => { const i = Math.round((X - FM.x0) / FM.cell), j = Math.round((Z - FM.z0) / FM.cell); return i < 0 || j < 0 || i >= FM.nx || j >= FM.nz ? 0 : FM.mDec[j * FM.nx + i]; };
    const fmH = (X, Z) => { const i = Math.round((X - FM.x0) / FM.cell), j = Math.round((Z - FM.z0) / FM.cell); return i < 0 || j < 0 || i >= FM.nx || j >= FM.nz ? 0 : FM.hDec[j * FM.nx + i] / FM.scale + FM.y0; };
    const C0 = (() => { const X = F.x + cx * rx + (-cz) * fx, Z = F.z + cx * rz + (-cz) * fz; return [X, Z]; })();
    for (let i = Math.floor((C0[0] - ext) / G); i <= Math.ceil((C0[0] + ext) / G); i++) for (let j = Math.floor((C0[1] - ext) / G); j <= Math.ceil((C0[1] + ext) / G); j++) {
      const X = (i + 0.15 + 0.7 * hash(i, j)) * G, Z = (j + 0.15 + 0.7 * hash(j + 7, i)) * G;
      if (X > -1000 && X < 900 && Z > -800 && Z < 900) continue;   // the plan's own forest is in E.trees
      if (hash(i * 2.3, j * 1.9) < 0.12 || fmM(X, Z) === 5 || fmM(X, Z) === 8) continue;
      const [x, z] = L(X, Z); if ((x - cx) ** 2 + (z - cz) ** 2 > ext * ext) continue;
      near.push({ x, z, r: 4 + 2 * hash(i + 2, j + 9), h: 96 + 14 * hash(X, Z), low: 0.53 + 0.04 * hash(Z, X), cr: 23 + 6 * hash(X + 3, Z), y: LY(fmH(X, Z)) - 0.5 });
    }
  }
  {
    const giants = near.filter(t => !t.heart), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    const trunks = new THREE.InstancedMesh(S.trunk, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), giants.length);
    giants.forEach((t, k) => {
      const H = t.snag ? t.h : t.h * 0.97;
      trunks.setMatrixAt(k, M.compose(new THREE.Vector3(t.x, t.y - 0.5, t.z), Q.setFromAxisAngle(up, hash(t.x, t.z) * 6.28), new THREE.Vector3(t.r, H + 0.5, t.r)));
      { const v = 0.82 + 0.36 * hash(t.x * 2, t.z), w = hash(t.z, t.x); trunks.setColorAt(k, t.snag ? C.setRGB(...lin([70, 64, 58])) : C.setRGB(...lin([(96 + 14 * w) * v, (60 + 6 * w) * v, (44 + 4 * w) * v]))); }   // redwood bark: red-brown, some greyer
    });
    trunks.castShadow = true; trunks.receiveShadow = true; trunks.frustumCulled = false; group.add(trunks);
    // the crowns: conifers from about half way up, wide enough that neighbours touch; tiered close to the play, plain
    // cones out in the mist. Dark blue-green, a little lighter and yellower where the sun gets in
    const crowned = giants.filter(t => !t.snag), nearR = (coarse ? 520 : 680) ** 2, isNear = t => (t.x - cx) ** 2 + (t.z - cz) ** 2 < nearR;
    const sets = [0, 1, 2].map(v => crowned.filter(t => isNear(t) && Math.floor(hash(t.x + 9, t.z) * 3) === v)).concat([crowned.filter(t => !isNear(t))]);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
    sets.forEach((list, v) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(v < 3 ? S.crowns[v] : S.crownFar, crownMat, list.length);
      list.forEach((t, k) => {
        const lo = t.y + t.h * t.low, Hc = t.h * (1 - t.low) * 1.04;
        im.setMatrixAt(k, M.compose(new THREE.Vector3(t.x + (t.ox || 0), lo, t.z + (t.oz || 0)), Q.setFromAxisAngle(up, hash(t.z, t.x) * 6.28), new THREE.Vector3(t.cr, Hc, t.cr)));
        const g = 0.8 + 0.4 * hash(t.x * 3, t.z), w = hash(t.x, t.z + 2);
        im.setColorAt(k, C.setRGB(...lin([(30 + 16 * w) * g, (50 + 12 * w) * g, (40 - 4 * w) * g])));
      });
      im.castShadow = true; im.receiveShadow = v < 3; im.frustumCulled = false; group.add(im);
    });
  }
  // the heart tree: a trunk 60 m across, buttresses running out over its roots, a crown of five great masses
  const HT = E.heart;
  {
    const [x, z] = L(...HT.c), y = LY(HT.y), B = batch(), bark = lin([96, 70, 52]), barkD = lin([70, 52, 40]);
    const tr = new THREE.Mesh(S.trunk, new THREE.MeshStandardMaterial({ color: new THREE.Color(...lin([88, 58, 42])), roughness: 0.95 }));
    tr.position.set(x, y - 12, z); tr.scale.set(HT.r, HT.h * 0.96 + 12, HT.r); tr.castShadow = true; tr.receiveShadow = true; group.add(tr);
    // the ground anywhere near: the field where this hole has one, the 10 m map beyond
    const gAny = (px, pz) => { if (inField(px, pz)) { const g = gnd(px, pz); if (g !== null) return g; } const [X, Z] = [F.x + px * rx + (-pz) * fx, F.z + px * rz + (-pz) * fz], i = Math.round((X - WM.x0) / WM.cell), j = Math.round((Z - WM.z0) / WM.cell); return i < 0 || j < 0 || i >= WM.nx || j >= WM.nz ? y : LY(wH(i, j)); };
    for (let k = 0; k < 9; k++) {
      const an = k / 9 * Math.PI * 2 + 0.3, c = Math.cos(an), s = Math.sin(an), len = HT.roots * (0.8 + 0.25 * hash(k, 1)), w = 3.2 + 1.5 * hash(1, k), h0 = 26, d0 = HT.r * 0.9;
      // a buttress: a fin from 26 m up the trunk running down to the ground at its end, its foot following the ground
      const N = 6, pts = [...Array(N + 1)].map((_, q) => { const d = d0 + (len - d0) * q / N, gx = x + c * d, gz = z + s * d; return { d, g: gAny(gx, gz), top: (h0 * (1 - q / N) ** 1.6) }; });
      const P = (d, side, yy) => [x + c * d - s * side, yy, z + s * d + c * side];
      for (let q = 0; q < N; q++) { const A = pts[q], Bp = pts[q + 1], wa = w * (1 - 0.6 * q / N), wb = w * (1 - 0.6 * (q + 1) / N);
        B.quad(P(A.d, -wa, A.g - 1.5), P(Bp.d, -wb, Bp.g - 1.5), P(Bp.d, 0, Bp.g + Bp.top + 0.6), P(A.d, 0, A.g + A.top + 0.6), bark);
        B.quad(P(A.d, 0, A.g + A.top + 0.6), P(Bp.d, 0, Bp.g + Bp.top + 0.6), P(Bp.d, wb, Bp.g - 1.5), P(A.d, wa, A.g - 1.5), barkD); }
    }
    const m = B.mesh(vc({ flatShading: true })); if (m) group.add(m);
    const cm = new THREE.InstancedMesh(S.crowns[1], new THREE.MeshStandardMaterial({ color: new THREE.Color(...lin([40, 60, 44])), vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }), 5), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const lo = y + HT.h * HT.low, Hc = HT.h * (1 - HT.low);
    // one great spire and four lesser leaders round it, lower down: an old tree that has lost its top more than once
    [[0, 0, 1, 1, 0], [0.42, 0.2, 0.55, 0.7, 0.04], [-0.38, 0.3, 0.58, 0.64, 0.08], [0.1, -0.42, 0.5, 0.6, 0.02], [-0.22, -0.3, 0.52, 0.72, 0.1]].forEach(([ox, oz, s, v, dy], k) =>
      cm.setMatrixAt(k, M.compose(new THREE.Vector3(x + ox * HT.cr, lo + dy * Hc, z + oz * HT.cr), Q.setFromAxisAngle(up, k * 1.7), new THREE.Vector3(HT.cr * s, Hc * v, HT.cr * s))));
    cm.castShadow = true; cm.receiveShadow = true; cm.frustumCulled = false; group.add(cm);
  }

  // ---- shafts of sun: where the roof of crowns opens over the forest floor, the light comes down through the haze
  // in a beam. Found by marching from the ground toward the sun past every crown (their outline, crownR); a beam
  // goes where a lit spot has shade round it (a gap, not open sky), off the mown ground and clear of the tees
  const anims = [];
  if (sunDir && sunDir.y > 0.12 && Fd) {
    const cell = 24, grid = new Map(), key = (i, j) => i * 7919 + j;
    for (const t of near) if (!t.snag) {
      const R = t.cr * (t.heart ? 1 : 1.02), lo = t.y + t.h * t.low, H = t.h * (1 - t.low), ccx = t.x + (t.ox || 0), ccz = t.z + (t.oz || 0);
      for (let i = Math.floor((ccx - R) / cell); i <= Math.floor((ccx + R) / cell); i++) for (let j = Math.floor((ccz - R) / cell); j <= Math.floor((ccz + R) / cell); j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push({ x: ccx, z: ccz, lo, H, cr: R }); }
    }
    const shaded = (x, y, z) => {
      for (let d = 3; d < 260; d += 3) {
        const px = x + sunDir.x * d, py = y + sunDir.y * d, pz = z + sunDir.z * d; if (py > y + 125) return false;
        const Lc = grid.get(key(Math.floor(px / cell), Math.floor(pz / cell))); if (!Lc) continue;
        for (const t of Lc) { const r = crownR((py - t.lo) / t.H) * t.cr * 0.8; if (r > 0 && (px - t.x) ** 2 + (pz - t.z) ** 2 < r * r) return true; }
      }
      return false;
    };
    const tees = Object.values(hole.tees || {}), mown = new Set(['fairway', 'green', 'fringe', 'tee', 'water']), cand = [];
    const x0 = Fd.x0 + 10, x1 = Fd.x0 + (Fd.nx - 1) * Fd.cell - 10, z0 = Fd.z0 + 10, z1 = Fd.z0 + (Fd.nz - 1) * Fd.cell - 10;
    for (let z = z0; z < z1; z += 7) for (let x = x0; x < x1; x += 7) {
      const jx = x + (hash(x, z) - 0.5) * 5, jz = z + (hash(z, x) - 0.5) * 5, y = gnd(jx, jz); if (y === null || mown.has(T.surfaceAt(jx, jz))) continue;
      if (tees.some(p => (p[0] - jx) ** 2 + (p[1] - jz) ** 2 < 35 * 35)) continue;
      if (shaded(jx, y + 1, jz)) continue;
      let sh = 0; for (const [dx, dz] of [[11, 0], [-11, 0], [0, 11], [0, -11], [8, 8], [-8, -8]]) { const yy = gnd(jx + dx, jz + dz); if (yy !== null && shaded(jx + dx, yy + 1, jz + dz)) sh++; }
      if (sh >= 3) cand.push([jx, y, jz, hash(jx * 0.7, jz * 1.3)]);
    }
    cand.sort((p, q) => p[3] - q[3]);
    const pick = [], max = coarse ? 22 : 40;
    for (const c of cand) { if (pick.length >= max) break; if (pick.some(p => (p[0] - c[0]) ** 2 + (p[2] - c[2]) ** 2 < 26 * 26)) continue; pick.push(c); }
    if (pick.length) {
      const base = [], uv = [], wl = [], idx = [];
      pick.forEach(([x, y, z, r], k) => {
        const w = 2 + 3.5 * hash(r * 9, k), Lb = (52 + 16 * hash(k, r * 3)) / sunDir.y;   // up into the roof, not past it
        for (const [u, v] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { base.push(x, y - 0.5, z); uv.push(u, v); wl.push(w, Lb); }
        const o = k * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(base, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aWL', new THREE.Float32BufferAttribute(wl, 2)); g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uSun: { value: sunDir }, uCol: { value: new THREE.Color(1.0, 0.86, 0.62) }, uA: { value: 0.22 }, uT: { value: 0 } },
        vertexShader: `attribute vec2 aUV; attribute vec2 aWL; uniform vec3 uSun; varying vec2 vUV; varying float vD; varying float vSeed;
          void main(){ vec3 ax = normalize(uSun); vec3 p0 = (modelMatrix * vec4(position, 1.0)).xyz + ax * aUV.y * aWL.y;
            vec3 sd = normalize(cross(ax, normalize(cameraPosition - p0))); vec3 p = p0 + sd * aUV.x * aWL.x * (1.0 + 0.7 * aUV.y);
            vec4 mv = viewMatrix * vec4(p, 1.0); vD = -mv.z; vUV = aUV; vSeed = position.x * 0.13 + position.z * 0.071; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uCol; uniform float uA; uniform float uT; varying vec2 vUV; varying float vD; varying float vSeed;
          void main(){ float across = 1.0 - abs(vUV.x); across = across * across * (3.0 - 2.0 * across);
            float along = smoothstep(0.0, 0.05, vUV.y) * (1.0 - smoothstep(0.3, 1.0, vUV.y));
            float drift = 0.75 + 0.25 * sin(uT * 0.35 + vSeed * 6.0 + vUV.y * 4.0 + vUV.x * 1.5);
            float fade = smoothstep(8.0, 30.0, vD) * (1.0 - smoothstep(180.0, 700.0, vD));
            gl_FragColor = vec4(uCol, across * along * drift * fade * uA); }`,
      });
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 2; group.add(m);
      anims.push((dt, t) => { mat.uniforms.uT.value = t; });
    }
  }

  // ---- the root plate (torn up on end, earth and roots) and the burnt shell round the 8th green, from the course's
  // own boxes; the fallen giant itself is ground (its back is the 3rd's high road)
  {
    const B = batch(), earth = lin([84, 66, 48]), earthD = lin([60, 48, 36]), char = lin([40, 34, 30]), charD = lin([26, 22, 20]);
    const block = (X, Z, y, w, l, h, rot, k, kd) => {
      const [x, z] = L(X, Z), r = rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), y0 = LY(y) - 0.6, y1 = LY(y) + h;
      const P = (su, sv, t) => [x + ux * su * w / 2 + vx * sv * l / 2, t ? y1 : y0, z + uz * su * w / 2 + vz * sv * l / 2];
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let f = 0; f < 4; f++) { const p = c[f], q = c[(f + 1) % 4]; B.quad(P(...p, 0), P(...p, 1), P(...q, 1), P(...q, 0), f % 2 ? k : kd); }
      B.quad(P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), P(1, -1, 1), kd);
    };
    for (const o of E.walls) {
      const [x, z] = L(...o.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 1500 ** 2) continue;
      if (o.kind === 'plate') {   // a disc on end: an octagon of earth with roots round its rim
        const [px, pz] = L(...o.at), r = o.rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), R = o.w / 2, y0 = LY(o.y) - 1;
        const ring = [...Array(12)].map((_, k) => { const an = k / 12 * Math.PI * 2; return [Math.cos(an) * R * (0.9 + 0.2 * hash(k, 2)), Math.sin(an) * R * 0.55 * (0.9 + 0.2 * hash(2, k)) + R * 0.5]; });
        const P = (u, h, side) => [px + ux * u + vx * side * o.l / 2, y0 + h, pz + uz * u + vz * side * o.l / 2];
        for (let k = 0; k < 12; k++) { const p = ring[k], q = ring[(k + 1) % 12]; B.quad(P(p[0], p[1], -1), P(q[0], q[1], -1), P(q[0], q[1], 1), P(p[0], p[1], 1), earthD); B.tri(P(0, R * 0.5, -1), P(q[0], q[1], -1), P(p[0], p[1], -1), earth); B.tri(P(0, R * 0.5, 1), P(p[0], p[1], 1), P(q[0], q[1], 1), earth); }
      } else block(o.at[0], o.at[1], o.y, o.w, o.l, o.h, o.rot, char, charD);
    }
    const m = B.mesh(vc({ flatShading: true })); if (m) group.add(m);
  }

  // ---- the Stair: each raised tee a deck at the end of a limb grown out of the stair tree, the treads spiralling
  // up the trunk between them
  {
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4c36, roughness: 0.9 }), moss = new THREE.MeshStandardMaterial({ color: 0x6b7d3a, roughness: 0.95 });
    for (const l of E.limbs) {
      const P = p => { const [x, z] = L(p[0], p[2]); return [x, LY(p[1]), z]; };
      const A = P(l.from), K = P(l.knee), Bq = P(l.to); if ((A[0] - cx) ** 2 + (A[2] - cz) ** 2 > 1500 ** 2) continue;
      const m = new THREE.Mesh(limbGeo(A, K, Bq, l.r0, l.r1), wood); m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    for (const d of E.decks) {
      const pts = d.outline.map(p => L(...p)); if ((pts[0][0] - cx) ** 2 + (pts[0][1] - cz) ** 2 > 1500 ** 2) continue;
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.35, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2); g.translate(0, LY(d.y) - 1.78, 0);   // the top (with its bevel) at the tee's height
      const m = new THREE.Mesh(g, [moss, wood]); m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    for (const St of E.stairs) {
      const [sx, sz] = L(...St.at), R = St.r + 0.9, dth = 1.25 / R, foot = LY(St.foot), top = LY(St.top), n = Math.ceil((top - foot) / 0.42);
      const im = new THREE.InstancedMesh(S.step, wood, n), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < n; k++) { const th = k * dth; im.setMatrixAt(k, M.compose(new THREE.Vector3(sx + R * Math.cos(th), foot + 0.3 + k * 0.42, sz + R * Math.sin(th)), Q.setFromAxisAngle(up, -th), new THREE.Vector3(1.8, 0.3, 1.4))); }
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im);
    }
  }
  return { trees: [], anims };
}
