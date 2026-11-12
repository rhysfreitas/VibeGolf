// Emberfell's volcano (global THREE): what COURSE.ember holds (world space) put into a hole's frame (hole.frame)
// and drawn. A blockout, ahead of its art pass: the far mountain from its height maps (ash, fresh black flows, red
// cinder, the caldera walls in dark basalt) down to the sea, the lava (the lake, the rivers, the pools, the
// lavafall) glowing and creeping, the lava tube's walls down from the field's open air, boulders, the lava trees,
// basalt columns, the vents and fumaroles steaming, the geysers, the clubhouse on the island, the plume over the
// far side of the caldera, and embers rising off the lava. One merged mesh per material where it can be. The
// ball's side of it (boulders, lava trees, the clubhouse, the forest) is in the course module and terrain.js.
import { rng, fbm } from './noise.js';
import { unpackHeights } from './field-code.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
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
// the paint byte: 0 ash, 1 fresh flow, 2 rock, 3 rubble, 4 red cinder, 5 forest floor, 6 sulfur, 7 the clubhouse's
// floor, 8 crust, 9 sinter, 10 lava, 11 open air
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}
// metres from each field cell to the nearest lava (capped), for the glow on the ground round it
function heatField(F) {
  if (F.heat) return F.heat;
  const cw = F.codes.indexOf('water'), n = F.nx * F.nz, d = new Float32Array(n).fill(99), c = F.cell, dg = c * Math.SQRT2;
  for (let k = 0; k < n; k++) if (F.s[k] === cw) d[k] = 0;
  for (let j = 0; j < F.nz; j++) for (let i = 0; i < F.nx; i++) { const k = j * F.nx + i; let v = d[k]; if (i) v = Math.min(v, d[k - 1] + c); if (j) { v = Math.min(v, d[k - F.nx] + c); if (i) v = Math.min(v, d[k - F.nx - 1] + dg); if (i < F.nx - 1) v = Math.min(v, d[k - F.nx + 1] + dg); } d[k] = v; }
  for (let j = F.nz - 1; j >= 0; j--) for (let i = F.nx - 1; i >= 0; i--) { const k = j * F.nx + i; let v = d[k]; if (i < F.nx - 1) v = Math.min(v, d[k + 1] + c); if (j < F.nz - 1) { v = Math.min(v, d[k + F.nx] + c); if (i < F.nx - 1) v = Math.min(v, d[k + F.nx + 1] + dg); if (i) v = Math.min(v, d[k + F.nx - 1] + dg); } d[k] = v; }
  return (F.heat = d);
}

/* ---------- the paint: two textures the ground shader reads (main.js, EMBER) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B bunker (sand 1, red scoria 0.5), A grass length (rough 0.55)
// B: R fresh black flow (rubble 0.5, crust 0.7), G red cinder, B pale ground (sinter 1, sulfur 0.6), A the lava's glow
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee');
  const heat = heatField(Fd);
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0], add = (k, f) => { const c = onGreen(k) ? cR : Fd.s[k]; if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f; w[3] += f * Math.max(0, 1 - heat[k] / 26) ** 2; };
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) { const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)); add(jj * Fd.nx + ii, wu[p] * wv[q]); }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    const m = ['green', 'fringe', 'sand', 'waste', 'tee', 'fairway'].includes(s) ? -1 : matAt(hole, x, z);
    if (!['green', 'sand', 'waste', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = 0; a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else {
      a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = s === 'sand' ? 255 : s === 'waste' ? 128 : 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255;
    }
    b[o] = m === 1 ? 255 : m === 8 ? 180 : m === 3 ? 120 : m === 2 ? 200 : 0;
    b[o + 1] = m === 4 ? 255 : 0;
    b[o + 2] = m === 9 ? 255 : m === 6 ? 150 : 0;
    b[o + 3] = Math.round(Math.min(1, own[3]) * 255);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#5d5752', rough: '#6d7340', firstcut: '#768046', fairway: '#7f9a46', fringe: '#86a64c', green: '#94bf5a', tee: '#8aa652', sand: '#9c968c', waste: '#8a3b24', water: '#ff6a1a', void: '#0b0909' };
  const M = { 1: '#1d1b1d', 2: '#2c2a2c', 3: '#45403d', 4: '#7a3826', 5: '#3d5236', 6: '#c9b45a', 8: '#2a2627', 9: '#e8e2d2' };
  return (x, z) => { const s = T.surfaceAt(x, z); if (s === 'desert') { const m = matAt(hole, x, z); if (M[m]) return M[m]; } return C[s] || '#5d5752'; };
}

/* ---------- textures made once ---------- */
let TEX = null;
function makeTextures() {
  const glow = stops => { const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); for (const [t, c] of stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  // lava: dark crust plates with glowing seams, brighter where the crust is thin (tiles seamlessly)
  const lava = (() => {
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), im = g.createImageData(S, S), R = rng(5);
    const pts = Array.from({ length: 34 }, () => [R() * S, R() * S]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const d = Math.hypot(x - px - ox, y - py - oy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const seam = Math.max(0, 1 - (d2 - d1) / 7), thin = fbm(x / 22, y / 22), hot = Math.min(1, seam * 1.2 + Math.max(0, thin - 0.55) * 1.6);
      const r = 40 + 215 * hot, gg = 14 + 150 * hot * hot, bb = 8 + 60 * hot * hot * hot, o = (y * S + x) * 4;
      im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = bb; im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  return {
    lava,
    glow: glow([[0, 'rgba(255,220,150,1)'], [0.3, 'rgba(255,120,30,0.7)'], [1, 'rgba(160,30,0,0)']]),
    smoke: glow([[0, 'rgba(70,62,62,0.85)'], [0.55, 'rgba(60,54,56,0.45)'], [1, 'rgba(50,46,50,0)']]),
    steam: glow([[0, 'rgba(255,255,255,0.6)'], [0.5, 'rgba(240,240,240,0.25)'], [1, 'rgba(240,240,240,0)']]),
    ember: glow([[0, 'rgba(255,240,180,1)'], [0.4, 'rgba(255,140,40,0.8)'], [1, 'rgba(200,50,0,0)']]),
  };
}

export function buildEmber(hole, T, box, E, hi, { group, coarse, sunDir = null }) {
  if (!TEX) TEX = makeTextures();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const R = rng(hi * 131 + 7), trees = [], anims = [];
  const far = coarse ? 1800 : 2600;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const lavaMat = new THREE.MeshBasicMaterial({ map: TEX.lava, color: 0xffffff, toneMapped: false, fog: true });
  const lavaUV = g => { const p = g.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + F.x) / 22; uv[i * 2 + 1] = (p.getZ(i) + F.z) / 22; } g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); };
  anims.push((dt, t) => { TEX.lava.offset.set(Math.sin(t * 0.05) * 0.04, t * 0.006); });
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  // what each paint byte looks like from afar
  const MC = { 0: lin([84, 80, 78]), 1: lin([38, 36, 38]), 2: lin([58, 52, 50]), 3: lin([70, 64, 60]), 4: lin([118, 52, 36]), 5: lin([52, 74, 44]), 6: lin([190, 170, 90]), 7: lin([60, 58, 60]), 8: lin([40, 36, 38]), 9: lin([226, 220, 204]), 10: lin([255, 110, 30]), 11: lin([12, 10, 10]) };
  const rockK = lin([58, 52, 50]);

  // ---- the near mountain, from the 10 m map: this hole's field where it has one (so the edges meet the playfield)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const Bl = batch();   // far lava
  {
    const st = coarse ? 3 : 2, ni = Math.floor((WM.nx - 1) / st), nj = Math.floor((WM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), C = new Float32Array((ni + 1) * (nj + 1) * 3), Mk = new Uint8Array((ni + 1) * (nj + 1)), keep = new Uint8Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)), m = WM.mDec[J * WM.nx + I];
      if (inField(x, z) && m !== 10) { const g = T.groundAt(x, z); if (g !== null) y = g; }
      const c = MC[m] || MC[0], sh = 0.9 + 0.16 * fbm(X / 90, Z / 90);
      Vt.set([x, y - 0.5, z], k * 3); C.set([c[0] * sh, c[1] * sh, c[2] * sh], k * 3); Mk[k] = m;
      keep[k] = near(x, z, 6000) ? 1 : 0;
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if (!keep[k] || !keep[k3]) continue;
      const xs = [Vt[k * 3], Vt[k1 * 3], Vt[k2 * 3], Vt[k3 * 3]], zs = [Vt[k * 3 + 2], Vt[k1 * 3 + 2], Vt[k2 * 3 + 2], Vt[k3 * 3 + 2]];
      if (xs.every((x, q) => inPlay(x, zs[q]))) continue;
      const lv = [k, k1, k2, k3].filter(q => Mk[q] === 10);
      if (lv.length) {   // a lava cell: a flat glowing sheet at the lava's level (the ground under it is drawn too)
        const ly = Math.max(...lv.map(q => Vt[q * 3 + 1])) + 0.5, P = q => [Vt[q * 3], ly, Vt[q * 3 + 2]];
        Bl.quad(P(k), P(k2), P(k3), P(k1), [1, 1, 1]);
      }
      idx.push(k, k2, k1, k1, k2, k3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(idx); g.computeVertexNormals();
    const N = g.attributes.normal;   // steep faces of the far ground go to dark basalt
    for (let k = 0; k < N.count; k++) { const ny = N.getY(k); if (ny < 0.75 && Mk[k] !== 10) { const t = Math.min(1, (0.75 - ny) / 0.3), c = C.subarray(k * 3, k * 3 + 3); for (let q = 0; q < 3; q++) c[q] += (rockK[q] - c[q]) * t; } }
    const m = new THREE.Mesh(g, vc({ roughness: 0.94 })); m.receiveShadow = true; group.add(m);
  }
  // ---- out to the sea: the mountain from the 50 m map past the near one, the lower slopes green, and the sea
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); }
    const st = 2, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 60, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 60, iz0 = WM.z0 + 60, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 60;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), C = new Float32Array((ni + 1) * (nj + 1) * 3), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, yw = FM.hDec[J * FM.nx + I] / FM.scale + FM.y0;
      const n = fbm(X / 700, Z / 700), c = yw < 6 ? lin([40, 36, 34]) : yw < 380 + 160 * n ? lin([46 + 20 * n, 70 + 24 * n, 40]) : yw < 700 + 120 * n ? lin([84, 70, 58]) : lin([58, 54, 54]);
      Vt.set([x, LY(yw) - 1, z], k * 3); C.set(c, k * 3); Wx.set([X, Z], k * 2);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; idx.push(k, k2, k1, k1, k2, k3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, vc({ roughness: 0.96 })); m.receiveShadow = true; group.add(m);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.25, metalness: 0.2 }));
    sea.position.set(cx, LY(E.sea) + 0.5, cz); group.add(sea);
  }

  // ---- the near lava: the field's lava cells as a sheet at the lava's level (rivers follow their slope)
  const Bn = batch();
  if (Fd && Fd.ready) {
    const cw = Fd.codes.indexOf('water'), Hh = Fd.h;
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, ks = [k, k + 1, k + Fd.nx + 1, k + Fd.nx], w = ks.filter(q => Fd.s[q] === cw);
      if (!w.length) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell;
      if (!(x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1)) continue;
      const mean = w.reduce((s, q) => s + Hh[q], 0) / w.length + 0.8, Y = q => (Fd.s[q] === cw && !Number.isNaN(Hh[q]) ? Hh[q] + 0.8 : mean);
      const c = Fd.cell;
      Bn.quad([x, Y(ks[0]), z], [x, Y(ks[3]), z + c], [x + c, Y(ks[2]), z + c], [x + c, Y(ks[1]), z], [1, 1, 1]);
    }
  }
  for (const B of [Bn, Bl]) { const m = B.mesh(lavaMat, false); if (m) { lavaUV(m.geometry); m.receiveShadow = false; m.renderOrder = 1; group.add(m); } }

  // ---- the lava tube: dark rock walls down from the field's open air, and its floor far below
  const Br = batch();   // rock and built things
  if (Fd && Fd.ready) {
    const top = lin([46, 42, 42]), mid = lin([24, 22, 22]), deep = lin([6, 5, 5]);
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, v = Fd.h[k];
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const w = Fd.h[k + di + dj * Fd.nx], va = Number.isNaN(v), wa = Number.isNaN(w); if (va === wa) continue;
        const g = va ? w : v, x = Fd.x0 + (i + di * 0.5) * Fd.cell, z = Fd.z0 + (j + dj * 0.5) * Fd.cell, h2 = Fd.cell * 0.55;
        if (!near(x, z, far)) continue;
        const p = dj ? [[x - h2, z], [x + h2, z]] : [[x, z - h2], [x, z + h2]], jg = (fbm(x / 5, z / 5) - 0.5) * 1.2;
        for (const [A, Bq] of [[p[0], p[1]], [p[1], p[0]]]) {
          Br.quad([A[0], g + 0.2, A[1]], [Bq[0], g + 0.2, Bq[1]], [Bq[0], g - 4 + jg, Bq[1]], [A[0], g - 4 + jg, A[1]], top);
          Br.quad([A[0], g - 4 + jg, A[1]], [Bq[0], g - 4 + jg, Bq[1]], [Bq[0], g - 12, Bq[1]], [A[0], g - 12, A[1]], mid);
          Br.quad([A[0], g - 12, A[1]], [Bq[0], g - 12, Bq[1]], [Bq[0], g - 30, Bq[1]], [A[0], g - 30, A[1]], deep);
        }
      }
    }
  }
  // the tube's mouths: a dark arch at each end where the roof still stands
  for (const [X, Z, y, dir, w] of E.mouths) { const [x, z] = L(X, Z); if (!near(x, z, far)) continue; const d = dir - a, ux = Math.cos(d), uz = Math.sin(d), yb = footY(x, z, LY(y)) - 9, n = 8;
    for (let s = 0; s < n; s++) { const t0 = s / n * Math.PI, t1 = (s + 1) / n * Math.PI, P = t => [x + ux * Math.cos(t) * w * 0.45, yb + Math.sin(t) * 8, z + uz * Math.cos(t) * w * 0.45]; Br.tri([x, yb, z], P(t0), P(t1), lin([4, 3, 3])); Br.tri([x, yb, z], P(t1), P(t0), lin([4, 3, 3])); } }

  // ---- boulders: dark basalt
  const lump = (seed, detail = 1) => { const geo = new THREE.DodecahedronGeometry(1, detail), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + seed, p.getZ(i) * 2 + p.getY(i)) - 0.5) * 0.55; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); } geo.computeVertexNormals(); return geo; };
  const inst = (geo, mat, list, place) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3(); list.forEach((it, i) => { place(it, pv, e, sv); q.setFromEuler(e); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); }); im.castShadow = im.receiveShadow = true; group.add(im); };
  const basalt = new THREE.MeshStandardMaterial({ color: 0x2a2729, roughness: 0.92 });
  inst(lump(3), basalt, E.boulders.map(([X, Z, y, r, H]) => { const [x, z] = L(X, Z); return near(x, z, far) ? [x, z, footY(x, z, LY(y)), r, H] : null; }).filter(Boolean),
    ([x, z, y, r, H], pv, e, sv) => { pv.set(x, y + H * 0.35, z); e.set(0, (x * 0.37 + z * 0.11) % 6.28, 0); sv.set(r, H * 0.62, r * 0.85); });
  // ---- the lava trees: stone shells where a flow cooled round a trunk, grey-black and ragged
  { const geo = new THREE.CylinderGeometry(0.7, 1, 1, 7, 3, true).translate(0, 0.5, 0), p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 3, p.getY(i) * 2 + p.getZ(i) * 3) - 0.5) * 0.6; p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); } geo.computeVertexNormals();
    inst(geo, new THREE.MeshStandardMaterial({ color: 0x3a3536, roughness: 0.95, side: THREE.DoubleSide }), E.lavaTrees.map(([X, Z, y, r, H]) => { const [x, z] = L(X, Z); return near(x, z, far) ? [x, z, footY(x, z, LY(y)), r, H] : null; }).filter(Boolean),
      ([x, z, y, r, H], pv, e, sv) => { pv.set(x, y - 0.2, z); e.set((x % 1) * 0.12, x * 1.7, (z % 1) * 0.12); sv.set(r, H, r); }); }
  // ---- basalt columns: hexagonal prisms on the terraces' faces
  inst(new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x302c2e, roughness: 0.85, flatShading: true }),
    E.columns.map(([X, Z, y0, y1, r]) => { const [x, z] = L(X, Z); return near(x, z, far) ? [x, z, LY(y0), LY(y1), r] : null; }).filter(Boolean),
    ([x, z, y0, y1, r], pv, e, sv) => { pv.set(x, y0, z); e.set(0, (x * 3.1 + z) % 1.05, 0); sv.set(r, Math.max(1, y1 - y0), r); });
  // ---- the forest beyond this hole's field (this hole's own is hole.plants, drawn and played by main.js)
  for (const [X, Z, y, r, H] of E.trees) { const [x, z] = L(X, Z); if (inField(x, z) || !near(x, z, far * 0.7)) continue; trees.push({ x, z, y: LY(y), s: H / 9, type: 'oak', r: ((X * 7.3 + Z * 3.1) % 1 + 1) % 1 }); }

  // ---- the clubhouse on the island: a long, low lodge of black basalt, flat roofed, its windows lit warm
  for (const Hc of E.halls) {
    const P = Hc.p.map(v => L(...v)), c = [P.reduce((s, v) => s + v[0], 0) / 4, P.reduce((s, v) => s + v[1], 0) / 4]; if (!near(c[0], c[1], far)) continue;
    const y0 = LY(Hc.y), y1 = y0 + Hc.h, wall = lin([40, 37, 38]), roof = lin([26, 24, 25]);
    for (let s = 0; s < 4; s++) { const p = P[s], q = P[(s + 1) % 4]; Br.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], wall); Br.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], wall); }
    const out = (p, f) => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f];
    const Q = P.map(p => out(p, 1.08)); Br.quad([Q[0][0], y1 + 0.6, Q[0][1]], [Q[3][0], y1 + 0.6, Q[3][1]], [Q[2][0], y1 + 0.6, Q[2][1]], [Q[1][0], y1 + 0.6, Q[1][1]], roof);
    for (let s = 0; s < 4; s++) { const p = Q[s], q = Q[(s + 1) % 4]; Br.quad([p[0], y1, p[1]], [q[0], y1, q[1]], [q[0], y1 + 0.6, q[1]], [p[0], y1 + 0.6, p[1]], roof); }
    const win = new THREE.MeshBasicMaterial({ color: 0xffb562, toneMapped: false, side: THREE.DoubleSide }), Bw = batch();
    for (let s = 0; s < 4; s++) { const p = out(P[s], 1.005), q = out(P[(s + 1) % 4], 1.005), len = Math.hypot(q[0] - p[0], q[1] - p[1]), nWin = Math.floor(len / 4);
      for (let w = 0; w < nWin; w++) { const t0 = (w + 0.3) / nWin, t1 = (w + 0.7) / nWin, A = [p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0], B = [p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1];
        Bw.quad([A[0], y0 + 1.6, A[1]], [B[0], y0 + 1.6, B[1]], [B[0], y0 + 3.6, B[1]], [A[0], y0 + 3.6, A[1]], [1, 1, 1]); } }
    const wm = Bw.mesh(win, false); if (wm) group.add(wm);
  }

  // ---- the lavafall: a glowing sheet down the wall from the lip into the pool
  if (E.fall) {
    const P = E.fall.pts.map(([X, Z, y]) => { const [x, z] = L(X, Z); return [x, LY(y) + 1.5, z]; });
    if (near(P[0][0], P[0][2], far * 2)) {
      const d = [P.at(-1)[0] - P[0][0], P.at(-1)[2] - P[0][2]], l = Math.hypot(...d), n = [-d[1] / l, d[0] / l], w = E.fall.w / 2, pos = [], uv = [];
      for (let i = 0; i < P.length - 1; i++) {   // a strip of quads down the path, u across, v down
        const p = P[i], q = P[i + 1], wp = w * (0.8 + 0.3 * i / P.length), wq = w * (0.8 + 0.3 * (i + 1) / P.length), v0 = i / 6, v1 = (i + 1) / 6;
        const A = [p[0] - n[0] * wp, p[1], p[2] - n[1] * wp], B = [p[0] + n[0] * wp, p[1], p[2] + n[1] * wp], C = [q[0] + n[0] * wq, q[1], q[2] + n[1] * wq], D = [q[0] - n[0] * wq, q[1], q[2] - n[1] * wq];
        pos.push(...A, ...B, ...C, ...A, ...C, ...D); uv.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const tex = TEX.lava.clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const fallMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, color: 0xffd8b0 });
      group.add(new THREE.Mesh(g, fallMat)); anims.push((dt, t) => { tex.offset.y = -t * 0.35; });
      // steam where it meets the pool
      const foot = P.at(-1); for (let s = 0; s < 4; s++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.steam, transparent: true, depthWrite: false, opacity: 0.45 })); const sz = 30 + s * 14; sp.scale.set(sz, sz, 1); sp.position.set(foot[0], foot[1] + 10 + s * 16, foot[2]); group.add(sp); }
    }
  }

  // ---- fume and steam: the vents (glowing at the mouth), the fumaroles, the geysers; one points draw of puffs
  const puffs = [], glows = [];
  for (const [X, Z, y, r] of E.vents) { const [x, z] = L(X, Z); if (!near(x, z, far * 1.5)) continue; const yy = footY(x, z, LY(y)); glows.push([x, yy + 2, z, r * 1.6]); for (let s = 0; s < 6; s++) puffs.push({ x, z, y0: yy + 4, r: r * 0.5, k: 'smoke', ph: R() }); }
  for (const [X, Z, y, r] of E.steam) { const [x, z] = L(X, Z); if (!near(x, z, far)) continue; for (let s = 0; s < 3; s++) puffs.push({ x, z, y0: footY(x, z, LY(y)), r: r * 0.8, k: 'steam', ph: R() }); }
  for (const [X, Z, y, r, erupt] of E.geysers) { const [x, z] = L(X, Z); if (!near(x, z, far)) continue; const yy = footY(x, z, LY(y)); for (let s = 0; s < (erupt ? 8 : 3); s++) puffs.push({ x, z, y0: yy, r: erupt ? 3 : 2, k: 'steam', ph: R(), tall: erupt ? 1 : 0 }); }
  for (const [x, y, z, s] of glows) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sp.scale.set(s, s * 0.6, 1); sp.position.set(x, y, z); group.add(sp); }
  for (const kind of ['smoke', 'steam']) {
    const list = puffs.filter(p => p.k === kind); if (!list.length) continue;
    const g = new THREE.BufferGeometry(), pos = new Float32Array(list.length * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: kind === 'smoke' ? TEX.smoke : TEX.steam, size: kind === 'smoke' ? 26 : 14, transparent: true, depthWrite: false, opacity: kind === 'smoke' ? 0.55 : 0.5 }));
    pts.frustumCulled = false; group.add(pts);
    const step = t => { list.forEach((p, i) => { const f = (t * (p.tall ? 0.22 : 0.08) + p.ph) % 1, h = p.tall ? 34 : kind === 'smoke' ? 40 : 14; pos.set([p.x + Math.sin(p.ph * 9 + t * 0.3) * p.r * f, p.y0 + f * h, p.z + Math.cos(p.ph * 7 + t * 0.25) * p.r * f], i * 3); }); g.attributes.position.needsUpdate = true; };
    step(0); anims.push((dt, t) => step(t));
  }

  // ---- the plume: a column of ash and fume over the far vent, lit from below, drifting off downwind (no fog: it
  // stands over the far side of the caldera, tinted toward the haze by hand)
  if (E.plume) {
    const [px, pz] = L(...E.plume.at), py = LY(E.plume.y), Rp = rng(17), list = [];
    for (let i = 0; i < 46; i++) { const t = i / 46, h = t * t * 1700 + Rp() * 60; list.push({ x: px + h * 0.22 + (Rp() - 0.5) * 80 * (1 + t * 3), y: py + 30 + h, z: pz + (Rp() - 0.5) * 80 * (1 + t * 3), s: 140 + t * 620 + Rp() * 120, t, ph: Rp() * 6 }); }
    for (const p of list) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.smoke, transparent: true, depthWrite: false, fog: false, opacity: 0.75 - p.t * 0.35, color: new THREE.Color().setRGB(0.55 + 0.5 * (1 - p.t) ** 4, 0.42 + 0.12 * (1 - p.t) ** 4, 0.42) }));
      sp.scale.set(p.s, p.s, 1); sp.position.set(p.x, p.y, p.z); sp.renderOrder = -1; group.add(sp);
      anims.push((dt, t) => { sp.material.rotation = p.ph + t * 0.01; });
    }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, toneMapped: false })); gl.scale.set(420, 240, 1); gl.position.set(px, py + 40, pz); group.add(gl);
  }

  // ---- embers: sparks rising off the lava in view (one points draw)
  if (Fd && Fd.ready) {
    const cw = Fd.codes.indexOf('water'), spots = [];
    for (let k = 0; k < Fd.s.length; k += 7) if (Fd.s[k] === cw) { const x = Fd.x0 + (k % Fd.nx) * Fd.cell, z = Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell; if (x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1) spots.push([x, Fd.h[k] + 0.8, z]); }
    if (spots.length) {
      const n = coarse ? 160 : 320, list = Array.from({ length: n }, () => ({ s: spots[Math.floor(R() * spots.length)], ph: R(), v: 0.5 + R(), dx: (R() - 0.5) * 6, dz: (R() - 0.5) * 6 }));
      const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: TEX.ember, size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      pts.frustumCulled = false; group.add(pts);
      const step = t => { list.forEach((p, i) => { const f = (t * 0.12 * p.v + p.ph) % 1; pos.set([p.s[0] + p.dx * f + Math.sin(t + p.ph * 20) * 0.6, p.s[1] + f * 22, p.s[2] + p.dz * f], i * 3); }); g.attributes.position.needsUpdate = true; };
      step(0); anims.push((dt, t) => step(t));
    }
  }

  { const m = Br.mesh(vc({ roughness: 0.92 })); if (m) group.add(m); }
  return { trees, anims };
}
