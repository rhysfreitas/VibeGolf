// The Buried Kingdom (global THREE), blockout: what COURSE.kingdom holds (world space) put into a hole's frame
// (hole.frame) and drawn. The site from its height maps (firm sand, the dune sea, the fields along the river, the
// cliffs of the wadi) in the ground shader's KINGDOM branch, the river and the boat basin as one sheet at their
// level, the pyramids as clean faces over the sampled ground (the great one's top still cased in white), the built
// things as plain blocks (the valley temple, the gate's towers, the fallen obelisk, the Sphinx's head, the colossi
// and the cliff temple, the camp's tents) and the date palms. The ball's side of it (the boxes, the palms' bodies)
// is in the course module, terrain.js and trees.js; everything here is drawn only. The art pass comes later.
import { unpackHeights } from './field-code.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
export const TYPES = new Set(['palm']);
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
// the paint byte: 0 firm sand, 1 soft sand, 2 rock, 3 masonry, 4 fields, 8 water, 10 (world map only) mown ground
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, KINGDOM) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B soft sand (bunkers and the Sand Sea), A grass length (rough)
// B: R fields, G masonry, B (spare), A rock
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee'), cS = C.indexOf('sand');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG && m !== 4) w[2] += f; else if (c === cS) w[3] += f;
      if (m === 4) w[4] += f; else if (m === 3) w[5] += f; else if (m === 2) w[6] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[3] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway', 'sand'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[4]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 2] = 0; b[o + 3] = Math.round(Math.min(1, own[6]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#b9a27c', rough: '#8f9a4c', firstcut: '#7fa046', fairway: '#6fa843', fringe: '#79b44a', green: '#8acb5c', tee: '#80b052', sand: '#f1e2b4', waste: '#d9bf8a', water: '#3f7f8c', void: '#15110f' };
  const M = { 2: '#9c8460', 3: '#cdbd9c', 4: '#5f8a3c' };
  return (x, z) => { const s = T.surfaceAt(x, z), m = matAt(hole, x, z); if ((s === 'desert' || s === 'rough') && M[m]) return M[m]; return C[s] || C.waste; };
}
// what a native lie is called, from the paint under the ball (rock and masonry are 'desert', the fields 'rough')
export function lieName(hole, x, z) { return { 2: 'Rock', 3: 'Stone', 4: 'Field' }[matAt(hole, x, z)] || 'Rock'; }
export const isField = (hole, x, z) => matAt(hole, x, z) === 4;

/* ---------- shapes made once ---------- */
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const trunk = new THREE.CylinderGeometry(0.55, 1, 1, 6); trunk.translate(0, 0.5, 0);
  // a date palm's crown: fronds arching out and down from the top of the trunk (unit radius, the crown's top at 0)
  const pos = [], N = 11;
  for (let i = 0; i < N; i++) {
    const an = i / N * Math.PI * 2 + (i % 2) * 0.2, c = Math.cos(an), s = Math.sin(an), w = 0.2, lift = i % 2 ? 0.1 : 0.3;
    const P = (r, y, side) => [c * r - s * w * side * (1 - r * 0.7), y, s * r + c * w * side * (1 - r * 0.7)];
    const rib = [[0, 0], [0.4, lift], [0.75, lift - 0.05], [1, lift - 0.45]];
    for (let k = 0; k < rib.length - 1; k++) { const [r0, y0] = rib[k], [r1, y1] = rib[k + 1]; const A = P(r0, y0, -1), B = P(r0, y0, 1), C = P(r1, y1, 1), D = P(r1, y1, -1); pos.push(...A, ...B, ...C, ...A, ...C, ...D); }
  }
  const crown = new THREE.BufferGeometry(); crown.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); crown.computeVertexNormals();
  trunk.userData.keep = true; crown.userData.keep = true;
  return (SHAPES = { trunk, crown });
}

export function buildKingdom(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;

  // ---- the site from the 10 m map: this hole's field where it has one (so the edges meet the playfield), drawn
  // in the ground shader (aW: x fields, y masonry, w rock)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 4 ? 1 : m === 10 ? 0.5 : 0, m === 3 ? 1 : 0, 0, m === 2 ? 1 : 0];
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
  // ---- out past it: the river plain and the far bank, the dune sea, the cliffs, from the 60 m map
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); FM.mDec = dec(FM.m, Uint8Array); }
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 40, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 40, iz0 = WM.z0 + 40, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 40;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = FM.mDec[J * FM.nx + I];
      Vt.set([x, LY(FM.hDec[J * FM.nx + I] / FM.scale + FM.y0) - (m === 8 ? 1.6 : 0.8), z], k * 3); Wx.set([X, Z], k * 2); Wt.set(wOf(m), k * 4);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; split(Vt, idx, k, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }

  // ---- the river and the boat basin: one sheet at their level (the beds are drawn under it; nothing else on the
  // site lies below it)
  {
    const g = new THREE.PlaneGeometry(17000, 17000); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3f6f66, roughness: 0.22, metalness: 0, envMapIntensity: 0.9 }));
    const [x, z] = L(1000, 0); m.position.set(x, LY(E.level) - 0.04, z); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }

  // ---- the pyramids: clean faces just outside the sampled ground (the great one's top still cased in white)
  const B = batch(), stone = lin([200, 172, 126]), stoneD = lin([178, 150, 108]), casing = lin([240, 234, 220]), canvas = lin([236, 230, 214]);
  for (const P of E.pyramids) {
    const hf = P.half * 1.02 + 2.5, top = P.y + P.h + 3.2, yb = P.y - 3;
    const C = (sx, sz, t) => { const [x, z] = L(P.c[0] + sx * hf * (1 - t), P.c[1] + sz * hf * (1 - t)); return [x, LY(yb + (top - yb) * t), z]; };
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]], tc = P.cased ? P.cased : 1;
    for (let f = 0; f < 4; f++) {
      const p = cs[f], q = cs[(f + 1) % 4], k = f % 2 ? stone : stoneD;
      B.quad(C(...p, 0), C(...p, tc), C(...q, tc), C(...q, 0), k);
      if (tc < 1) B.tri(C(...p, tc), C(...p, 1), C(...q, tc), casing);
    }
  }
  // ---- the built things as plain blocks: w across, l along (rot: the compass bearing of l), from y up h; `tk`
  // tapers the top
  const block = (X, Z, y, w, l, h, rot, k, tk = 1, dy = 0) => {
    const [x, z] = L(X, Z), r = rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), y0 = LY(y) + dy, y1 = y0 + h;
    const P = (su, sv, t) => [x + (ux * su * w / 2 + vx * sv * l / 2) * (t ? tk : 1), t ? y1 : y0, z + (uz * su * w / 2 + vz * sv * l / 2) * (t ? tk : 1)];
    const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let f = 0; f < 4; f++) { const p = c[f], q = c[(f + 1) % 4]; B.quad(P(...p, 0), P(...p, 1), P(...q, 1), P(...q, 0), f % 2 ? k : k.map(v => v * 0.88)); }
    B.quad(P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), P(1, -1, 1), k);
  };
  for (const S of E.built) {
    const [X, Z] = S.at;
    if (S.kind === 'tower') block(X, Z, S.y, S.w, S.l, S.h, S.rot, stone, 0.82);                       // a pylon tower, battered
    else if (S.kind === 'piece' || S.kind === 'obelisk') block(X, Z, S.y, S.w, S.l, S.h, S.rot, lin([200, 150, 128]), 0.9);   // red granite
    else if (S.kind === 'head') { block(X, Z, S.y, S.w, S.l, S.h, S.rot, stone, 0.78); block(X, Z, S.y, S.w * 1.7, S.l * 0.5, S.h * 0.8, S.rot, stoneD, 0.6, 0); }   // the head in its headcloth
    else if (S.kind === 'colossus') { block(X, Z, S.y, S.w, S.l, S.h * 0.42, S.rot, stone); block(X, Z, S.y, S.w * 0.82, S.l * 0.5, S.h * 0.4, S.rot, stone, 0.85, S.h * 0.42); block(X, Z, S.y, S.w * 0.42, S.l * 0.36, S.h * 0.18, S.rot, stoneD, 0.9, S.h * 0.82); }
    else if (S.kind === 'tent') block(X, Z, S.y, S.w, S.l, S.h, S.rot, canvas, S.awning ? 1 : 0.12);
    else block(X, Z, S.y, S.w, S.l, S.h, S.rot, S.h > 12 ? stone : stoneD, S.h > 12 ? 0.9 : 1);
  }
  { const m = B.mesh(vc({ flatShading: true })); if (m) group.add(m); }

  // ---- the date palms: a trunk and a crown of fronds each, instanced
  {
    const far = coarse ? 1300 : 2200, list = [];
    for (const [X, Z, y, r, h] of E.palms) { const [x, z] = L(X, Z); if (Math.hypot(x - cx, z - cz) > far) continue; list.push([x, footY(x, z, LY(y)), z, r, h]); }
    if (list.length) {
      const tm = new THREE.InstancedMesh(S.trunk, new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 1 }), list.length);
      const cm = new THREE.InstancedMesh(S.crown, new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.85, side: THREE.DoubleSide }), list.length);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      list.forEach(([x, y, z, r, h], i) => {
        tm.setMatrixAt(i, M.compose(new THREE.Vector3(x, y - 0.3, z), Q.setFromAxisAngle(up, 0), new THREE.Vector3(0.38, h * 0.9, 0.38)));
        cm.setMatrixAt(i, M.compose(new THREE.Vector3(x, y + h * 0.86, z), Q.setFromAxisAngle(up, (x * 0.7 + z * 0.3) % 6.28), new THREE.Vector3(r * 1.15, h * 0.24, r * 1.15)));
      });
      tm.castShadow = cm.castShadow = true; tm.receiveShadow = cm.receiveShadow = true; group.add(tm, cm);
    }
  }
  return { trees: [], anims: [] };
}
