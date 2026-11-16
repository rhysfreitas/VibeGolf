// Cloudrest (global THREE): what COURSE.cloud holds (world space) put into a hole's frame (hole.frame) and drawn.
// Art pass 1 (16 November 2026, tools/cloudrest/art-brief.md, Rhys's picks: buff stone and Bhutanese halls; crooked
// pines, mossy ledges and vines; a golden sea of clouds; prayer flags and chortens, a lived-in monastery, the rope
// bridge and the waterfall, birds): the ground from the 10 m and 40 m maps in the ground shader's CLOUD branch; a cliff
// face from every edge over open air, in rows that wander in and out with depth, in the shader's buff stone (main.js);
// the pinnacles as irregular columns from the emitter's outlines; the alcove's walls and roof as stone; the sea of
// clouds (a lit, bumped base sheet and two patchy layers, U.uCTime drifting them); Huangshan pines on the ledges, lips,
// crowns and faces, and vines down the faces; the monastery's halls from a canvas facade with lit windows, maroon
// bands and low hipped roofs; the stupa, the stair, the cairn, the courtyard walls, the painted halls with seated
// figures in niches, the lamp hall hung on the face, the rope bridge; tea hedges along the contours away from the play;
// prayer flags that flutter, chortens, chimney smoke, the waterfall at the cleft's head, lammergeiers and swifts. The
// ball's side of it (the ground, the rocks, the surfaces) is in the course module and terrain.js; everything here is
// drawn only, and the scenery keeps 26 m off every hole's play (E.play) and clear of the tees.
import { unpackHeights } from './field-code.js';

export const TYPES = new Set();   // nothing for main.js's buildTrees to leave to us (the pines are scenery, drawn here)
const GAP = -32768;
const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn2 = (x, z, k = 0) => { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz), h = (a, b) => hash(a + k * 17.3, b - k * 9.1);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; };
// the uniforms the ground shader reads in its CLOUD branch (main.js adds them): the mist's level in the hole's frame,
// so the stone and grass fade into it at the cliff's foot, and time
export const U = { uCMist: { value: -1e4 }, uCTime: { value: 0 } };
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
  // Huangshan pines (art pass 1, Rhys's pick): a crooked trunk out of the rock and flat umbrella pads of needles,
  // height 1, built once. Three upright shapes, and one that grows out of a cliff face (along +x, then up)
  const pine = (path, pads, seed) => {
    const pos = [], col = [];
    const bark = lin([62, 50, 41]), barkL = lin([88, 74, 60]);
    for (let k = 0; k < path.length - 1; k++) {   // the trunk: a five-sided tube along the path, tapering
      const a = path[k], b = path[k + 1], r0 = 0.05 * (1 - k / path.length) + 0.012, r1 = 0.05 * (1 - (k + 1) / path.length) + 0.012;
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(), u = new THREE.Vector3(0, 0, 1).cross(d); if (u.lengthSq() < 1e-4) u.set(1, 0, 0); u.normalize(); const v = d.clone().cross(u);
      for (let i = 0; i < 5; i++) {
        const t0 = i / 5 * Math.PI * 2, t1 = (i + 1) / 5 * Math.PI * 2, o = (t, r) => [Math.cos(t) * u.x * r + Math.sin(t) * v.x * r, Math.cos(t) * u.y * r + Math.sin(t) * v.y * r, Math.cos(t) * u.z * r + Math.sin(t) * v.z * r];
        const A = o(t0, r0), B = o(t1, r0), C = o(t1, r1), D = o(t0, r1), P = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
        pos.push(...P(a, A), ...P(a, B), ...P(b, C), ...P(a, A), ...P(b, C), ...P(b, D)); for (let q = 0; q < 6; q++) col.push(...(i % 2 ? bark : barkL));
      }
    }
    const ico = new THREE.IcosahedronGeometry(1, 0), ip = ico.attributes.position;
    pads.forEach(([x, y, z, rx, ry], n) => {   // a pad: a flattened, lumpy disc of needles, lighter on top
      for (let i = 0; i < ip.count; i++) {
        const X = ip.getX(i), Y = ip.getY(i), Z = ip.getZ(i), w = 1 + 0.22 * Math.sin(X * 5.1 + Z * 3.7 + seed + n);
        pos.push(x + X * rx * w, y + Y * ry * (Y < 0 ? 0.55 : 1), z + Z * rx * w);
        const t = 0.5 + 0.5 * Y; col.push(...lin([30 + 24 * t, 50 + 30 * t, 32 + 16 * t]));
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); g.userData.keep = true; return g;
  };
  const pines = [
    pine([[0, 0, 0], [0.02, 0.3, 0], [0.12, 0.55, 0.04], [0.06, 0.78, -0.03], [0.1, 0.92, 0]], [[0.1, 0.94, 0, 0.3, 0.06], [0.32, 0.8, 0.05, 0.22, 0.05], [-0.16, 0.74, -0.08, 0.2, 0.05], [0.14, 0.62, -0.18, 0.16, 0.04]], 1),
    pine([[0, 0, 0], [-0.04, 0.25, 0.02], [0.08, 0.45, 0], [0.22, 0.66, 0.02], [0.3, 0.86, 0]], [[0.3, 0.9, 0, 0.34, 0.07], [0.5, 0.72, 0.1, 0.2, 0.05], [0.04, 0.7, -0.12, 0.22, 0.05]], 2),
    pine([[0, 0, 0], [0, 0.4, 0], [0.04, 0.7, 0.02], [0, 0.9, 0]], [[0, 0.95, 0, 0.26, 0.07], [0.2, 0.82, 0.12, 0.2, 0.05], [-0.2, 0.78, -0.06, 0.2, 0.05], [0.08, 0.66, -0.2, 0.18, 0.05], [-0.1, 0.56, 0.18, 0.15, 0.04]], 3),
  ];
  const cliffPine = pine([[0, 0, 0], [0.3, 0.06, 0.02], [0.55, 0.22, -0.02], [0.66, 0.46, 0], [0.62, 0.66, 0.02]], [[0.62, 0.7, 0, 0.3, 0.06], [0.82, 0.56, 0.08, 0.2, 0.05], [0.42, 0.5, -0.1, 0.18, 0.04]], 4);
  // vines: hanging strands of small leaves, seamless across, fading to their tips
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c = cv.getContext('2d');
  let sd = 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let k = 0; k < 46; k++) {
    const x0 = rnd() * 256, len = 160 + rnd() * 352, g0 = 70 + rnd() * 50;
    for (let y = 0; y < len; y += 5) {
      const x = x0 + Math.sin(y * 0.02 + k) * 6, f = 1 - y / len * 0.5;
      for (const dx of [-256, 0, 256]) { c.fillStyle = `rgb(${Math.round(42 * f + rnd() * 18)},${Math.round(g0 * f + rnd() * 25)},${Math.round(30 * f)})`; c.beginPath(); c.ellipse(x + dx + (rnd() - 0.5) * 9, y, 3.2 + rnd() * 2.5, 2 + rnd() * 1.6, rnd() * 3, 0, Math.PI * 2); c.fill(); }
    }
  }
  const vineTex = new THREE.CanvasTexture(cv); vineTex.encoding = THREE.sRGBEncoding; vineTex.wrapS = THREE.RepeatWrapping; vineTex.anisotropy = 4;
  // the halls' facade (Rhys's pick: Tiger's Nest): whitewash, a timber beam at each floor, a wide carved timber window
  // (rabsel) on the upper storey and two small windows below; 8 m by two 3.5 m storeys a repeat, 64 px a metre. The
  // top-left corner is plain white so roofs and trim share the material by vertex colour. The emissive map lights a
  // few panes (butter lamps)
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 448; const f = fc.getContext('2d');
  const ec = document.createElement('canvas'); ec.width = 512; ec.height = 448; const e = ec.getContext('2d'); e.fillStyle = '#000'; e.fillRect(0, 0, 512, 448);
  f.fillStyle = '#e9e3d5'; f.fillRect(0, 0, 512, 448);
  for (let k = 0; k < 900; k++) { const x = rnd() * 512, y = rnd() * 448, g = 214 + rnd() * 26; f.fillStyle = `rgba(${g},${g - 6},${g - 18},0.35)`; f.fillRect(x, y, 2 + rnd() * 10, 2 + rnd() * 6); }
  for (let k = 0; k < 26; k++) { const x = rnd() * 512, y = 224 + rnd() * 120, gr = f.createLinearGradient(0, y, 0, 448); gr.addColorStop(0, 'rgba(120,110,90,0)'); gr.addColorStop(1, 'rgba(120,110,90,0.25)'); f.fillStyle = gr; f.fillRect(x, y, 3 + rnd() * 6, 448 - y); }
  const tim = '#3d2b20', trim = '#6e2a22';
  f.fillStyle = tim; f.fillRect(0, 214, 512, 16); f.fillStyle = trim; f.fillRect(0, 210, 512, 4);   // the floor beam
  for (let x = 4; x < 512; x += 14) { f.fillStyle = '#5a3a28'; f.fillRect(x, 200, 8, 10); }           // its beam ends
  // the rabsel: a wide timber window on the upper storey, three cusped lights over a carved sill
  f.fillStyle = tim; f.fillRect(150, 28, 212, 160); f.fillStyle = trim; f.fillRect(156, 34, 200, 6); f.fillRect(156, 168, 200, 6);
  for (let c = 0; c < 3; c++) { const x0 = 166 + c * 64;
    f.fillStyle = '#1e150e'; f.beginPath(); f.moveTo(x0, 160); f.lineTo(x0, 70); f.quadraticCurveTo(x0 + 6, 50, x0 + 22, 52); f.quadraticCurveTo(x0 + 38, 50, x0 + 44, 70); f.lineTo(x0 + 44, 160); f.fill();
    f.strokeStyle = '#6b4a32'; f.lineWidth = 2; for (let y = 76; y < 160; y += 14) { f.beginPath(); f.moveTo(x0, y); f.lineTo(x0 + 44, y); f.stroke(); } f.beginPath(); f.moveTo(x0 + 22, 56); f.lineTo(x0 + 22, 160); f.stroke();
    if (c !== 1) { e.fillStyle = c ? 'rgba(255,170,90,0.55)' : 'rgba(255,190,110,0.85)'; e.fillRect(x0 + 2, 74, 40, 84); } }
  f.fillStyle = '#5a3a28'; f.fillRect(150, 186, 212, 10);
  // two small windows on the lower storey
  for (const x0 of [56, 406]) { f.fillStyle = tim; f.fillRect(x0 - 6, 282, 60, 78); f.fillStyle = '#1b130d'; f.fillRect(x0, 290, 48, 62); f.fillStyle = trim; f.fillRect(x0 - 6, 276, 60, 6); }
  e.fillStyle = 'rgba(255,170,90,0.5)'; e.fillRect(406, 290, 48, 62);
  f.fillStyle = '#ffffff'; f.fillRect(0, 0, 6, 6);
  const facade = new THREE.CanvasTexture(fc); facade.encoding = THREE.sRGBEncoding; facade.wrapS = facade.wrapT = THREE.RepeatWrapping; facade.anisotropy = 4;
  const glow = new THREE.CanvasTexture(ec); glow.encoding = THREE.sRGBEncoding; glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
  return (SHAPES = { cone, trunk, pines, cliffPine, vineTex, facade, glow });
}
const mapOf = M => { if (!M.hDec) { M.hDec = dec(M.h, Int16Array); if (M.pred) unpackHeights(M.hDec, M.nx); M.mDec = dec(M.m, Uint8Array); } return M; };

// smooth normals for a triangle soup: each corner takes the summed (area-weighted) normals of the triangles that share
// its position and face within about 70° of its own, so walls shade in curves while a crown's rim or a thin fin stays crisp
function weldNormals(P) {
  const n = P.length / 9, TN = new Float32Array(n * 3), K = new Map(), keys = new Array(n * 3);
  for (let t = 0; t < n; t++) {
    const o = t * 9, ux = P[o + 3] - P[o], uy = P[o + 4] - P[o + 1], uz = P[o + 5] - P[o + 2], vx = P[o + 6] - P[o], vy = P[o + 7] - P[o + 1], vz = P[o + 8] - P[o + 2];
    TN[t * 3] = uy * vz - uz * vy; TN[t * 3 + 1] = uz * vx - ux * vz; TN[t * 3 + 2] = ux * vy - uy * vx;
    for (let c = 0; c < 3; c++) { const q = o + c * 3, k = Math.round(P[q] * 20) + ',' + Math.round(P[q + 1] * 20) + ',' + Math.round(P[q + 2] * 20); keys[t * 3 + c] = k; let L = K.get(k); if (!L) K.set(k, L = []); L.push(t); }
  }
  const N = new Float32Array(P.length);
  for (let t = 0; t < n; t++) {
    const ax = TN[t * 3], ay = TN[t * 3 + 1], az = TN[t * 3 + 2], al = Math.hypot(ax, ay, az) || 1;
    for (let c = 0; c < 3; c++) {
      let sx = 0, sy = 0, sz = 0;
      for (const u of K.get(keys[t * 3 + c])) { const bx = TN[u * 3], by = TN[u * 3 + 1], bz = TN[u * 3 + 2]; if ((ax * bx + ay * by + az * bz) > 0.34 * al * (Math.hypot(bx, by, bz) || 1)) { sx += bx; sy += by; sz += bz; } }
      const l = Math.hypot(sx, sy, sz) || 1, q = t * 9 + c * 3; N[q] = sx / l; N[q + 1] = sy / l; N[q + 2] = sz / l;
    }
  }
  return N;
}

export function buildCloud(hole, T, box, E, hi, { group, coarse, rockMat, sunDir }) {
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
  U.uCMist.value = MY;
  const anims = [];
  // how far a world point is from every hole's play (its line from the tips to the pin) and from the nearest tee
  const SEG = [], TEE = [];
  for (const pl of E.play || []) { for (let k = 0; k < pl.line.length - 1; k++) SEG.push([...pl.line[k], ...pl.line[k + 1]]); TEE.push(...pl.tees); }
  const playD = (X, Z) => { let d = Infinity; for (const [x1, z1, x2, z2] of SEG) { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((X - x1) * dx + (Z - z1) * dz) / l2)); d = Math.min(d, Math.hypot(X - x1 - t * dx, Z - z1 - t * dz)); } return d; };
  const teeD = (X, Z) => { let d = Infinity; for (const [x, z] of TEE) d = Math.min(d, Math.hypot(X - x, Z - z)); return d; };
  const W = (x, z) => [F.x + x * rx + (-z) * fx, F.z + x * rz + (-z) * fz];   // the hole's frame to world
  const clear = (x, z, d = 26) => { const [X, Z] = W(x, z); return playD(X, Z) >= d && teeD(X, Z) >= Math.max(14, d * 0.6); };

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
  const Wtr = batch(), water = lin([58, 84, 92]);
  // ---- the cliffs (art pass 1): a face from every edge over open air down past the mist, in the ground shader's rock
  // (aW.w = 1, aDepth the metres below the lip), in rows that wander in and out with depth so the walls stand as
  // buttresses and bays, not a fence. The offset is a field over the world (the same for two faces sharing a corner)
  // and grows with depth; the top row is the ground's edge itself, the second a sharp lip
  const FP = [], FW = [], FD = [], edges = [];
  const wob = (x, z, d) => { const A = Math.min(7, d * 0.22), X = x + F.x, Z = z + F.z;
    return [A * (vn2(X / 46, Z / 46, 3) * 2 - 1) + A * 0.22 * (vn2(X / 13, Z / 13, 5) * 2 - 1), A * (vn2(X / 46 + 9, Z / 46, 4) * 2 - 1) + A * 0.22 * (vn2(X / 13 + 4, Z / 13, 6) * 2 - 1)]; };
  // A face's top row is the ground's edge itself (a staircase of the map's cells); from a few metres down its corners are
  // pulled onto the outline smoothed over about a cell and a half (sc: the cell size of the map the edge came from), so
  // the walls run in curves, not steps. Faces are queued and drawn once every edge is known
  const QF = [], CN = new Map();
  const face = (p, q, out, sc) => { QF.push([p, q, out, sc]); if (sc) for (const P of [p, q]) { let c = CN.get(sc); if (!c) CN.set(sc, c = new Map()); c.set(Math.round(P[0] * 10) + ',' + Math.round(P[2] * 10), P); } };
  let GRID = null;
  const smoothAt = (P, sc) => {   // the outline near P, smoothed (a Gaussian over the unique corners within 2.5 sigma)
    const g = GRID.get(sc); if (!g) return [P[0], P[2]];
    const sg = 1.3 * sc, R = 2.5 * sg, cs = g.cs, i0 = Math.floor((P[0] - R) / cs), i1 = Math.floor((P[0] + R) / cs), j0 = Math.floor((P[2] - R) / cs), j1 = Math.floor((P[2] + R) / cs);
    let sx = 0, sz = 0, sw = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const L2 = g.m.get(i + ',' + j); if (L2) for (const c of L2) { const d2 = (c[0] - P[0]) ** 2 + (c[2] - P[2]) ** 2; if (d2 > R * R) continue; const w = Math.exp(-d2 / (2 * sg * sg)); sx += w * c[0]; sz += w * c[2]; sw += w; } }
    return sw ? [sx / sw, sz / sw] : [P[0], P[2]];
  };
  const SM = new Map();
  const facePt = (P, d, sc) => {   // the face's point d m under the top corner P
    if (d === 0) return [P[0], P[1], P[2]];
    const k = sc + ':' + Math.round(P[0] * 10) + ',' + Math.round(P[2] * 10); let s2 = SM.get(k); if (!s2) SM.set(k, s2 = sc ? smoothAt(P, sc) : [P[0], P[2]]);
    const f = Math.min(1, d / 6), bx = P[0] + (s2[0] - P[0]) * f, bz = P[2] + (s2[1] - P[2]) * f, w = wob(bx, bz, d);
    return [bx + w[0], P[1] - d, bz + w[1]];
  };
  const drawFaces = () => {
    GRID = new Map();
    for (const [sc, c] of CN) { const cs = 3.25 * sc, m = new Map(); for (const P of c.values()) { const k = Math.floor(P[0] / cs) + ',' + Math.floor(P[2] / cs); let L2 = m.get(k); if (!L2) m.set(k, L2 = []); L2.push(P); } GRID.set(sc, { cs, m }); }
    for (const [p, q, out, sc] of QF) {
      const bot = MY - 14, D = Math.max(p[1], q[1]) - bot; if (D <= 0.5) continue;
      const fine = sc < 4;   // the field's 2 m edges: fewer rows (they're many)
      const rows = (fine ? [0, 1.6, 9, 40] : [0, 1.6, 7, 24, 55, 110, 200]).filter(d => d < D - 4); rows.push(D);
      const mx = (p[0] + q[0]) / 2, mz = (p[2] + q[2]) / 2, ex = q[0] - p[0], ez = q[2] - p[2];
      const flip = (ez * (out[0] - mx) - ex * (out[1] - mz)) < 0;   // wind so the face looks out over the gap (unflipped, its normal is (ez, 0, -ex))
      for (let r = 0; r < rows.length - 1; r++) {
        const a = facePt(p, rows[r], sc), b = facePt(q, rows[r], sc), c = facePt(q, rows[r + 1], sc), d = facePt(p, rows[r + 1], sc);
        const tri = (u, v, w, du, dv, dw) => { FP.push(...u, ...v, ...w); FD.push(du, dv, dw); for (let k = 0; k < 3; k++) FW.push(0, 0, 0, 1); };
        if (flip) { tri(a, c, b, rows[r], rows[r + 1], rows[r]); tri(a, d, c, rows[r], rows[r + 1], rows[r + 1]); }
        else { tri(a, b, c, rows[r], rows[r], rows[r + 1]); tri(a, c, d, rows[r], rows[r + 1], rows[r + 1]); }
      }
      if (D > 30) edges.push({ p, q, out, D, sc });
    }
  };
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
    const idx = [], P = p => [Vt[p * 3], Vt[p * 3 + 1], Vt[p * 3 + 2]], C = p => [Vt[p * 3], Vt[p * 3 + 2]]; const sc = M.cell * st;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1, q = [k, k1, k2, k3];
      if (skip(q, Vt, Wx)) continue;
      const g = q.map(p => gap[p]), n = g.reduce((s, v) => s + v, 0);
      if (n === 0) { split(Vt, idx, k, k1, k2, k3); if (q.some(p => wet[p])) { const lv = Math.min(...q.filter(p => wet[p]).map(p => Vt[p * 3 + 1])) + sink - 0.05, Q = p => [Vt[p * 3], lv, Vt[p * 3 + 2]]; Wtr.quad(Q(k), Q(k2), Q(k3), Q(k1), water); } continue; }
      if (n === 4) continue;
      // an edge over open air: the ground's triangle that has all three corners, and faces down from the edge
      if (n === 1) { const tri = [[k, k2, k3], [k, k3, k1], [k, k2, k1], [k1, k2, k3]].find(t => t.every(p => !gap[p])); if (tri) idx.push(...tri); }
      const ring = [k, k1, k3, k2];
      for (let e = 0; e < 4; e++) { const p = ring[e], o = ring[(e + 1) % 4], g2 = ring[(e + 2) % 4], g3 = ring[(e + 3) % 4]; if (!gap[p] && !gap[o] && (gap[g2] || gap[g3])) face(P(o), P(p), gap[g2] ? C(g2) : C(g3), sc); }
      for (let e = 0; e < 4; e++) { const p = ring[e]; if (gap[p]) continue; const o = ring[(e + 1) % 4], b2 = ring[(e + 3) % 4]; if (gap[o] && gap[b2]) { const A = P(p), G = C(ring[(e + 2) % 4]); face([A[0] - 1.5, A[1], A[2] - 1.5], [A[0] + 1.5, A[1], A[2] + 1.5], G, 0); face([A[0] - 1.5, A[1], A[2] + 1.5], [A[0] + 1.5, A[1], A[2] - 1.5], G, 0); } }
    }
    group.add(groundMesh(Vt, Wt, idx));
  };
  const WM = mapOf(E.world), FM = mapOf(E.far);
  // inside the hole's box the playfield draws the ground; the map's 10 m chords there would cut up through it on any
  // curved slope (big flat facets up the gorge's sides), so only quads with open air or reaching past the box are drawn
  const inBox = (x, z) => x > box.x0 + 1 && x < box.x1 - 1 && z > box.z0 + 1 && z < box.z1 - 1;
  drawMap(WM, (q, Vt) => q.every(p => { const x = Vt[p * 3], z = Vt[p * 3 + 2]; return inBox(x, z) && gnd(x, z) !== null; }), coarse ? 2 : 1, 0.3);
  const ix0 = WM.x0 + 30, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 30, iz0 = WM.z0 + 30, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 30;
  drawMap(FM, (q, Vt, Wx) => q.every(p => Wx[p * 2] > ix0 && Wx[p * 2] < ix1 && Wx[p * 2 + 1] > iz0 && Wx[p * 2 + 1] < iz1), coarse ? 2 : 1, 0.8);
  // the field's own edges over open air, at its 2 m cells (the 10 m map's faces are too coarse up close)
  if (Fd) {
    const nanAt = (i, j) => i < 0 || j < 0 || i >= Fd.nx || j >= Fd.nz || Number.isNaN(Fd.h[j * Fd.nx + i]);
    const yAt = (i, j) => Fd.h[j * Fd.nx + i];
    for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) {
      if (nanAt(i, j)) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell, y = yAt(i, j), c = Fd.cell / 2;
      if (nanAt(i + 1, j)) face([x + c, y, z + c], [x + c, y, z - c], [x + 3 * c, z], Fd.cell);
      if (nanAt(i - 1, j)) face([x - c, y, z - c], [x - c, y, z + c], [x - 3 * c, z], Fd.cell);
      if (nanAt(i, j + 1)) face([x - c, y, z + c], [x + c, y, z + c], [x, z + 3 * c], Fd.cell);
      if (nanAt(i, j - 1)) face([x + c, y, z - c], [x - c, y, z - c], [x, z - 3 * c], Fd.cell);
    }
  }
  drawFaces();
  // the pinnacles (art pass 1): irregular columns from the emitter's outlines, a little wider than the 10 m map's
  // square blocks so they hide them, swelling and leaning with depth, under a grassy crown; not where this hole's own
  // field draws the pinnacle (the Needle on the 4th)
  {
    const tri = (A, B, C, dA, dB, dC, w, ox, oy, oz) => {   // wound so the normal points along (ox, oy, oz)
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * ox + ny * oy + nz * oz < 0) { FP.push(...A, ...C, ...B); FD.push(dA, dC, dB); } else { FP.push(...A, ...B, ...C); FD.push(dA, dB, dC); }
      for (let k = 0; k < 3; k++) FW.push(...w);
    };
    const RW = [0, 0, 0, 1], GW = [0, 0, 0, 0], R2c = 2600 ** 2;
    for (const [X, Z, top, R] of E.pinnacles || []) {
      const [x0, z0] = L(X, Z); if ((x0 - cx) ** 2 + (z0 - cz) ** 2 > R2c) continue;
      if (inField(x0, z0) && gnd(x0, z0) !== null) continue;
      const yt = LY(top), bot = MY - 14, D = yt - bot, n = R.length;
      const rows = [0, 1.6, 6, 14, 26, 42, 62, 90, 130, 200].filter(d => d < D - 4); rows.push(D);
      const ring = rows.map(d => R.map((r, k) => { const a = k / n * Math.PI * 2, A = Math.min(6, d * 0.2), wv = A * vn2(Math.cos(a) * 2.2 + X / 50, Math.sin(a) * 2.2 + d / 30, 7) + Math.min(3, d * 0.5) * vn2(k * 0.9 + X, d / 14, 8);
        const rr = r + 1.6 + wv + d * 0.035, WX = X + Math.cos(a) * rr, WZ = Z + Math.sin(a) * rr, [lx, lz] = L(WX, WZ); return [lx, yt - d, lz]; }));
      for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n, a = ring[r][k], b = ring[r][k1], c = ring[r + 1][k1], d = ring[r + 1][k], ox = (a[0] + b[0]) / 2 - x0, oz = (a[2] + b[2]) / 2 - z0;
        tri(a, b, c, rows[r], rows[r], rows[r + 1], RW, ox, 0, oz); tri(a, c, d, rows[r], rows[r + 1], rows[r + 1], RW, ox, 0, oz);
      }
      // the crown: a low dome over the top, grass to its edge
      const mid = R.map((r, k) => { const a = k / n * Math.PI * 2, [lx, lz] = L(X + Math.cos(a) * r * 0.6, Z + Math.sin(a) * r * 0.6); return [lx, yt + 2.6, lz]; }), C0 = [x0, yt + 3.9, z0];
      for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; tri(C0, mid[k], mid[k1], 0, 0, 0, GW, 0, 1, 0); tri(mid[k], ring[0][k], ring[0][k1], 0, 0, 0, GW, 0, 1, 0); tri(mid[k], ring[0][k1], mid[k1], 0, 0, 0, GW, 0, 1, 0); }
      if (D > 30) for (let k = 0; k < n; k += 2) edges.push({ p: ring[0][k], q: ring[0][(k + 1) % n], out: [ring[0][k][0] * 2 - x0, ring[0][k][2] * 2 - z0], D, pin: true });
    }
  }
  if (FP.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(FW, 4)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(FD, 1)); g.setAttribute('normal', new THREE.Float32BufferAttribute(weldNormals(FP), 3));
    const m = new THREE.Mesh(g, rockMat); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
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

  // ---- the sea of clouds (art pass 1, Rhys's pick: golden): an opaque base sheet at the mist's top whose billows are
  // a bump on its normal, so the low sun lights their sunward sides gold and the cliffs' shadows fall cool across it,
  // and three patchy layers above it that thin out upward, so the cloud meets the rock softly. All drift slowly.
  // MeshStandardMaterial with noise patched in, so it takes the sun, the shadows and the fog like everything else
  {
    const R = 5200, g = new THREE.PlaneGeometry(R * 2, R * 2, 1, 1); g.rotateX(-Math.PI / 2);
    const NOISE = `
float cH(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float cN(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(cH(i),cH(i+vec2(1,0)),u.x), mix(cH(i+vec2(0,1)),cH(i+vec2(1,1)),u.x), u.y); }
float cF(vec2 p){ return cN(p)*0.5 + cN(p*2.03+3.1)*0.27 + cN(p*4.11+7.7)*0.15 + cN(p*8.3+1.3)*0.08; }`;
    const mistMat = (layer, opts) => {
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, ...opts });
      m.onBeforeCompile = sh => {
        sh.uniforms.uCTime = U.uCTime; sh.uniforms.uLayer = { value: layer }; sh.uniforms.uOff = { value: new THREE.Vector2(F.x, F.z) }; sh.uniforms.uSunD = { value: sunDir || new THREE.Vector3(0.6, 0.2, 0.2) };
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP; uniform float uCTime, uLayer; uniform vec2 uOff; uniform vec3 uSunD; vec3 mistNW = vec3(0.0, 1.0, 0.0);' + NOISE)
          .replace('#include <color_fragment>', `#include <color_fragment>
vec2 q = vMP.xz + uOff + vec2(uCTime*1.6, uCTime*0.5) * (1.0 + uLayer*0.4) + uLayer*vec2(311.0, 97.0);
float bill = cF(q*0.0075) * 0.75 + cF(q*0.024) * 0.25;
float shadeC = smoothstep(0.25, 0.8, bill);
diffuseColor.rgb = mix(vec3(0.5, 0.56, 0.66), vec3(0.96, 0.92, 0.86), shadeC);
${layer > 0 ? `diffuseColor.a *= smoothstep(${(0.42 + layer * 0.07).toFixed(2)}, ${(0.62 + layer * 0.08).toFixed(2)}, bill);` : ''}`)
          .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
${layer === 0 ? `{ float e = 6.0; float b0 = cF(q*0.0075)*0.75 + cF(q*0.024)*0.25, bx = cF((q+vec2(e,0.0))*0.0075)*0.75 + cF((q+vec2(e,0.0))*0.024)*0.25, bz = cF((q+vec2(0.0,e))*0.0075)*0.75 + cF((q+vec2(0.0,e))*0.024)*0.25;
vec3 nW = normalize(vec3(-(bx - b0)/e*90.0, 1.0, -(bz - b0)/e*90.0)); mistNW = nW; normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }` : ''}`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// the golden light on the billows that face the low sun, the troughs cool; toward the sun the whole sea glows warm
{ vec3 sd = normalize(uSunD); float lit = max(0.0, dot(mistNW, sd)); vec3 vd = normalize(vMP - cameraPosition);
float toward = pow(max(0.0, dot(normalize(vec3(vd.x, 0.0, vd.z)), normalize(vec3(sd.x, 0.0, sd.z)))), 3.0);
totalEmissiveRadiance += diffuseColor.rgb * vec3(0.14, 0.15, 0.18) + vec3(1.0, 0.66, 0.36) * (lit * 0.85 + toward * 0.35 + 0.08) * shadeC; }`);
      };
      return m;
    };
    const base = new THREE.Mesh(g, mistMat(0, {})); base.position.set(cx, MY, cz); base.receiveShadow = true; group.add(base);
    [[6, 0.8], [15, 0.5]].forEach(([dy, op], k) => {
      const m = new THREE.Mesh(g, mistMat(k + 1, { transparent: true, opacity: op, depthWrite: false })); m.position.set(cx, MY + dy, cz); m.renderOrder = 2 + k; m.receiveShadow = true; group.add(m);
    });
    anims.push(dt => { U.uCTime.value += dt; });
  }

  // ---- the built things (art pass 1, Rhys's pick: Bhutanese halls): whitewashed halls on a stone plinth, battered a
  // little, the facade texture at real scale, a maroon band and a dark timber gap under deep low hipped roofs (red
  // lacquer, the golden hall gilded, with a gilded lantern and finial), the bell tower's open belfry, the white stupa,
  // the pilgrim stair in steps, the cairn as stacked stones, the courtyard walls whitewashed with a maroon coping, the
  // painted halls in the alcove as galleries with seated figures carved in niches between them, the lamp hall hung on
  // the cliff's face under the courtyard, and the rope bridge slung from its anchors
  const chimneys = [];
  {
    const pos = [], uvs = [], col = [], WC = [0.002, 0.998];
    const tri = (A, B, C, k, ua = WC, ub = WC, uc = WC) => { pos.push(...A, ...B, ...C); uvs.push(...ua, ...ub, ...uc); for (let q = 0; q < 3; q++) col.push(k[0], k[1], k[2]); };
    const quad = (A, B, C, D, k, u4) => { if (u4) { tri(A, B, C, k, u4[0], u4[1], u4[2]); tri(A, C, D, k, u4[0], u4[2], u4[3]); } else { tri(A, B, C, k); tri(A, C, D, k); } };
    const white = lin([224, 218, 206]), stoneC = lin([150, 140, 122]), stoneD = lin([112, 104, 90]), maroon = lin([106, 43, 37]), timber = lin([58, 42, 32]), red = lin([118, 40, 32]), redD = lin([90, 30, 24]), gold = lin([190, 150, 66]), goldD = lin([150, 112, 44]), bronze = lin([120, 92, 52]);
    const frame = (x, z, r) => { const ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r); return (su, sv, y) => [x + ux * su + vx * sv, y, z + uz * su + vz * sv]; };
    // a box: w across (u), l along (v), from y0 to y1, shrinking to `taper` at the top; uv (metres/8, height/7 down from vTop) on the sides if tex
    const box = (Pf, w, l, y0, y1, k, kd, { tex = false, taper = 1, top = true, vTop = y1, sides = [0, 1, 2, 3] } = {}) => {
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]], hw = w / 2, hl = l / 2;
      for (const f of sides) { const p = c[f], q = c[(f + 1) % 4], len = f % 2 ? l : w;
        const A = Pf(p[0] * hw, p[1] * hl, y0), B = Pf(q[0] * hw, q[1] * hl, y0), C = Pf(q[0] * hw * taper, q[1] * hl * taper, y1), D = Pf(p[0] * hw * taper, p[1] * hl * taper, y1);
        const o = Math.floor(hash(A[0], A[2]) * 4) * 0.5;
        if (!tex) { quad(A, B, C, D, f % 2 ? k : kd, null); continue; }
        // storeys of 4.4 m down from the top: the top one with the carved window (the texture's upper half), the
        // rest with the small windows (its lower half), each its own band; a bay is 10 m
        const SH = 4.4, BW = 10, n = Math.max(1, Math.round((y1 - y0) / SH)), sh = (y1 - y0) / n, lerpP = (P0, P1, t) => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t, P0[2] + (P1[2] - P0[2]) * t];
        for (let q = 0; q < n; q++) { const t1 = 1 - q / n, t0 = 1 - (q + 1) / n, a0 = lerpP(A, D, t0), b0 = lerpP(B, C, t0), a1 = lerpP(A, D, t1), b1 = lerpP(B, C, t1), vb = q === 0 ? 0.5 : 0, vt = q === 0 ? 1 : 0.5;
          quad(a0, b0, b1, a1, f % 2 ? k : kd, [[o, vb], [o + len / BW, vb], [o + len / BW, vt], [o, vt]]); } }
      if (top) quad(Pf(-hw * taper, -hl * taper, y1), Pf(hw * taper, -hl * taper, y1), Pf(hw * taper, hl * taper, y1), Pf(-hw * taper, hl * taper, y1), kd);
    };
    const hip = (Pf, w, l, y, rise, k, kd) => {   // a low hipped roof over w x l (eaves included), its ridge along the longer side
      const hw = w / 2, hl = l / 2, E = [Pf(-hw, -hl, y), Pf(hw, -hl, y), Pf(hw, hl, y), Pf(-hw, hl, y)];
      if (l >= w) { const r0 = Pf(0, -(hl - hw), y + rise), r1 = Pf(0, hl - hw, y + rise); quad(E[0], E[1], r0, r0, kd); quad(E[1], E[2], r1, r0, k); quad(E[2], E[3], r1, r1, kd); quad(E[3], E[0], r0, r1, k); }
      else { const r0 = Pf(-(hw - hl), 0, y + rise), r1 = Pf(hw - hl, 0, y + rise); quad(E[0], E[1], r1, r0, k); quad(E[1], E[2], r1, r1, kd); quad(E[2], E[3], r0, r1, k); quad(E[3], E[0], r0, r0, kd); }
      const t = 0.45; for (let f = 0; f < 4; f++) { const a2 = E[f], b2 = E[(f + 1) % 4]; quad(a2, b2, [b2[0], b2[1] - t, b2[2]], [a2[0], a2[1] - t, a2[2]], timber); }   // the fascia
    };
    const ell = (cxx, cyy, czz, rx2, ry2, rz2, k, half = false) => {   // an ellipsoid (or its top half)
      const N = 10, M = half ? 4 : 7, P = (i, j) => { const th = i / N * Math.PI * 2, ph = (half ? 0.5 : 1) * Math.PI * j / M; return [cxx + Math.cos(th) * Math.sin(ph) * rx2, cyy + Math.cos(ph) * ry2, czz + Math.sin(th) * Math.sin(ph) * rz2]; };
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) quad(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), k);
    };
    const finial = (P0, hgt) => { for (let q = 0; q < 4; q++) ell(P0[0], P0[1] + hgt * (0.15 + q * 0.22), P0[2], hgt * (0.22 - q * 0.04), hgt * 0.12, hgt * (0.22 - q * 0.04), gold); };
    const hall = (x, z, y0, w, l, h, r, roofK, { gild = false, belfry = false, plinth = 1.4 } = {}) => {
      const Pf = frame(x, z, r), yT = y0 + h;
      chimneys.push(Pf(w * 0.22, l * 0.18, yT + 2.1 + Math.min(w, l) * 0.12));
      box(Pf, w + 0.6, l + 0.6, y0 - 3, y0 + plinth, stoneC, stoneD, { top: false });
      box(Pf, w, l, y0 + plinth, yT, white, white, { tex: true, taper: 0.975, top: false, vTop: yT });
      box(Pf, w * 0.975 + 0.1, l * 0.975 + 0.1, yT, yT + 1.3, maroon, maroon, { top: false });
      box(Pf, w * 0.975 - 0.3, l * 0.975 - 0.3, yT + 1.3, yT + 2.1, timber, timber, { top: false });
      const ov = 3.6, rise = Math.min(w, l) * 0.2, rk = roofK === 'gold' ? [gold, goldD] : [red, redD];
      hip(Pf, w + ov, l + ov, yT + 2.1, rise, ...rk);
      if (gild) {   // the golden hall's lantern: a raised gilded roof on a dark timber drum, and a finial
        const c0 = Pf(0, 0, yT + 2.1 + rise * 0.55); box(frame(c0[0], c0[2], r), w * 0.34, l * 0.34, c0[1] - 1, c0[1] + 2.4, timber, timber, { top: false });
        hip(frame(c0[0], c0[2], r), w * 0.44, l * 0.44, c0[1] + 2.4, Math.min(w, l) * 0.12, gold, goldD); finial([c0[0], c0[1] + 2.4 + Math.min(w, l) * 0.12, c0[2]], 3.2);
      } else finial(Pf(0, 0, yT + 2.1 + rise), 1.6);
      if (belfry) {   // an open belfry on four posts with its own little roof and a bronze bell
        const c0 = Pf(0, 0, yT + 2.1 + rise * 0.6), Q = frame(c0[0], c0[2], r), bw = 4.6;
        for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(frame(...[Q(su * bw / 2, sv * bw / 2, 0)].map(p => [p[0], p[2]])[0], r), 0.4, 0.4, c0[1] - 1, c0[1] + 4, timber, timber, { top: false });
        hip(Q, bw + 2.2, bw + 2.2, c0[1] + 4, 1.4, red, redD); finial([c0[0], c0[1] + 5.4, c0[2]], 1.2);
        ell(c0[0], c0[1] + 1.6, c0[2], 1.1, 1.5, 1.1, bronze);
      }
    };
    const seated = (x, z, y0, r, hgt) => {   // a seated figure carved in the rock: plinth, folded legs, body, head, worn and mossy
      const Pf = frame(x, z, r), k = lin([142, 132, 112]), kM = lin([96, 108, 70]), s1 = hgt / 16;
      box(Pf, 10 * s1, 6 * s1, y0 - 1, y0 + 1.6 * s1, kM, stoneD);
      const c = Pf(0, 0.4 * s1, 0);
      ell(c[0], y0 + 2.6 * s1, c[2], 4.6 * s1, 1.5 * s1, 3.0 * s1, kM);
      const b = Pf(0, 0.8 * s1, 0); ell(b[0], y0 + 7.4 * s1, b[2], 2.5 * s1, 4.2 * s1, 2.0 * s1, k);
      ell(b[0], y0 + 12.6 * s1, b[2], 1.45 * s1, 1.7 * s1, 1.4 * s1, k); ell(b[0], y0 + 14.5 * s1, b[2], 0.6 * s1, 0.7 * s1, 0.6 * s1, k);
      for (const sd of [-1, 1]) { const hnd = Pf(sd * 1.1 * s1, -0.6 * s1, 0); ell(hnd[0], y0 + 4.6 * s1, hnd[2], 1.0 * s1, 0.6 * s1, 0.9 * s1, k); }
    };
    const W3 = mapOf(E.world), mAt = (X, Z) => { const i = Math.round((X - W3.x0) / W3.cell), j = Math.round((Z - W3.z0) / W3.cell); if (i < 0 || j < 0 || i >= W3.nx || j >= W3.nz) return null; const v = W3.hDec[j * W3.nx + i]; return v === GAP ? null : v / W3.scale + W3.y0; };
    for (const o of E.sites) {
      const [x, z] = L(...o.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue;
      const y = LY(o.y), r = o.rot - a, Pf = frame(x, z, r);
      if (o.kind === 'hall' && o.face) {   // the lamp hall, hung on the face: find the lip toward the ground, set its back to it, its roof under the lip
        const ux = Math.cos(o.rot), uz = Math.sin(o.rot); let Ex = null, Ez, Ey;
        for (let d = 0; d < 40; d += 1) { const X = o.at[0] - ux * d, Z = o.at[1] - uz * d, g = mAt(X, Z); if (g !== null) { Ex = X; Ez = Z; Ey = g; break; } }
        if (Ex === null) continue;
        const [lx, lz] = L(Ex + ux * (o.w / 2 + 2), Ez + uz * (o.w / 2 + 2)); hall(lx, lz, LY(Ey) - o.h - 6, o.w, o.l, o.h, r, 'red', { plinth: 0.6 });
        const P2 = frame(lx, lz, r); box(P2, o.w + 2, o.l + 2, LY(Ey) - o.h - 9, LY(Ey) - o.h - 5.6, timber, timber);   // its balcony floor
      }
      else if (o.kind === 'hall') hall(x, z, y, o.w, o.l, o.h, r, o.roof, { gild: o.roof === 'gold', belfry: /bell/.test(o.name) });
      else if (o.kind === 'gatehouse' || o.kind === 'wheel') { hall(x, z, y, o.w, o.l, o.h, r, 'red', { plinth: 1 });
        if (o.kind === 'wheel') {   // a row of prayer wheels along its front under a lean-to roof
          const n = 9, sp = (o.l + 4) / n;
          for (let q = 0; q < n; q++) { const c2 = Pf(o.w / 2 + 1.4, -o.l / 2 - 2 + (q + 0.5) * sp, 0); ell(c2[0], y + 1.5, c2[2], 0.42, 0.75, 0.42, q % 2 ? red : redD); ell(c2[0], y + 2.2, c2[2], 0.46, 0.1, 0.46, gold); ell(c2[0], y + 0.8, c2[2], 0.46, 0.1, 0.46, gold); }
          const roofP = frame(...(() => { const c2 = Pf(o.w / 2 + 1.5, 0, 0); return [c2[0], c2[2]]; })(), r); hip(roofP, 3.4, o.l + 5, y + 3.2, 0.5, red, redD);
        } }
      else if (o.kind === 'stupa') {   // the white stupa: a stepped base, a dome, a gilded spire of rings
        box(Pf, o.w, o.l, y - 2, y + 1.6, white, lin([214, 208, 196])); box(Pf, o.w * 0.8, o.l * 0.8, y + 1.6, y + 3, white, lin([214, 208, 196])); box(Pf, o.w * 0.62, o.l * 0.62, y + 3, y + 4.2, white, lin([214, 208, 196]));
        ell(x, y + 4.2, z, o.w * 0.34, o.h * 0.3, o.w * 0.34, white, true);
        box(Pf, o.w * 0.2, o.w * 0.2, y + 4.2 + o.h * 0.28, y + 6.2 + o.h * 0.28, gold, goldD);
        for (let q = 0; q < 9; q++) ell(x, y + 6.6 + o.h * 0.28 + q * 0.62, z, o.w * (0.12 - q * 0.01), 0.3, o.w * (0.12 - q * 0.01), q % 2 ? gold : goldD);
        finial([x, y + 12.2 + o.h * 0.28, z], 1.6);
      }
      else if (o.kind === 'cairn') { for (let q = 0; q < 9; q++) { const a2 = q * 2.4, rr = q < 5 ? 1.5 : 0.7; ell(x + Math.cos(a2) * rr * (q < 8 ? 1 : 0), y - 0.4 + (q < 5 ? 0.5 : q < 8 ? 1.9 : 3.0), z + Math.sin(a2) * rr * (q < 8 ? 1 : 0), 1.1 - q * 0.06, 0.7, 0.95 - q * 0.05, q % 2 ? stoneC : stoneD); } }
      else if (o.kind === 'wall') { box(Pf, o.w, o.l, y - 1, y + o.h - 0.35, white, lin([214, 208, 196]), { top: false }); box(Pf, o.w + 0.25, o.l + 0.1, y + o.h - 0.35, y + o.h, maroon, maroon); }
      else if (o.kind === 'stair') { const n = 18; for (let q = 0; q < n; q++) { const P2 = frame(...(() => { const c2 = Pf(0, -o.l / 2 + (q + 0.5) * o.l / n, 0); return [c2[0], c2[2]]; })(), r); box(P2, o.w, o.l / n + 0.05, y - 9.5, y - 9 + (q + 1) * 0.5, stoneC, stoneD); } }
      else if (o.kind === 'halls') {   // the painted halls: three galleries with two seated figures in niches between, set against the back wall (-u)
        const segs = [[-41, 28, 'hall'], [-20.5, 13, 'niche'], [0, 28, 'hall'], [20.5, 13, 'niche'], [41, 28, 'hall']];
        for (const [sv, len, kind] of segs) { const c2 = Pf(0, sv, 0), P2 = frame(c2[0], c2[2], r);
          if (kind === 'hall') { box(P2, o.w, len, y - 2, y + 1.2, stoneC, stoneD, { top: false }); box(P2, o.w, len, y + 1.2, y + o.h * 0.8, white, white, { tex: true, top: false, vTop: y + o.h * 0.8 }); box(P2, o.w + 0.1, len + 0.1, y + o.h * 0.8, y + o.h * 0.8 + 1.2, maroon, maroon, { top: false }); hip(P2, o.w + 3, len + 3, y + o.h * 0.8 + 1.8, 1.6, red, redD); box(P2, o.w - 0.3, len - 0.3, y + o.h * 0.8 + 1.2, y + o.h * 0.8 + 1.8, timber, timber, { top: false }); }
          else { const nb = frame(...(() => { const c3 = P2(-o.w * 0.5 - 1, 0, 0); return [c3[0], c3[2]]; })(), r); box(nb, 1, len, y - 1, y + o.h * 0.95, lin([70, 64, 54]), lin([70, 64, 54]), { top: false }); const fc2 = P2(0.6, 0, 0); seated(fc2[0], fc2[2], y, r + Math.PI / 2, o.h * 0.68); }
        }
      }
      else if (o.kind === 'bridge') {   // the rope bridge: anchored on the ground either side, planks sagging between, two hand ropes and the suspenders
        const vx = Math.sin(o.rot), vz = -Math.cos(o.rot); let A = null, B = null;
        for (let d = o.l * 0.3; d < o.l * 0.9 && (!A || !B); d += 2) { if (!A) { const g = mAt(o.at[0] - vx * d, o.at[1] - vz * d); if (g !== null) A = [o.at[0] - vx * d, o.at[1] - vz * d, g]; } if (!B) { const g = mAt(o.at[0] + vx * d, o.at[1] + vz * d); if (g !== null) B = [o.at[0] + vx * d, o.at[1] + vz * d, g]; } }
        if (!A || !B) continue;
        const N = 30, pts = [], [ax2, az2] = L(A[0], A[1]), [bx2, bz2] = L(B[0], B[1]), ux2 = Math.cos(r), uz2 = Math.sin(r), span = Math.hypot(B[0] - A[0], B[1] - A[1]);
        for (let q = 0; q <= N; q++) { const t = q / N; pts.push([ax2 + (bx2 - ax2) * t, LY(A[2] + (B[2] - A[2]) * t) - span * 0.07 * (1 - (2 * t - 1) ** 2) + 0.3, az2 + (bz2 - az2) * t]); }
        const wood = lin([110, 84, 60]), rope = lin([150, 132, 100]);
        for (let q = 0; q < N; q++) { const p = pts[q], qq = pts[q + 1]; quad([p[0] - ux2 * 0.9, p[1], p[2] - uz2 * 0.9], [p[0] + ux2 * 0.9, p[1], p[2] + uz2 * 0.9], [qq[0] + ux2 * 0.9, qq[1], qq[2] + uz2 * 0.9], [qq[0] - ux2 * 0.9, qq[1], qq[2] - uz2 * 0.9], q % 2 ? wood : lin([96, 72, 52]));
          for (const sd of [-1, 1]) { const h1 = 1.1 + 0.25 * (1 - (2 * q / N - 1) ** 2), h2 = 1.1 + 0.25 * (1 - (2 * (q + 1) / N - 1) ** 2); quad([p[0] + sd * ux2 * 0.95, p[1] + h1, p[2] + sd * uz2 * 0.95], [qq[0] + sd * ux2 * 0.95, qq[1] + h2, qq[2] + sd * uz2 * 0.95], [qq[0] + sd * ux2 * 0.95, qq[1] + h2 - 0.08, qq[2] + sd * uz2 * 0.95], [p[0] + sd * ux2 * 0.95, p[1] + h1 - 0.08, p[2] + sd * uz2 * 0.95], rope);
            if (q % 3 === 0) quad([p[0] + sd * ux2 * 0.95 - 0.03, p[1], p[2] + sd * uz2 * 0.95], [p[0] + sd * ux2 * 0.95 + 0.03, p[1], p[2] + sd * uz2 * 0.95], [p[0] + sd * ux2 * 0.95 + 0.03, p[1] + h1, p[2] + sd * uz2 * 0.95], [p[0] + sd * ux2 * 0.95 - 0.03, p[1] + h1, p[2] + sd * uz2 * 0.95], rope); } }
        for (const [px, py, pz] of [pts[0], pts[N]]) for (const sd of [-1, 1]) box(frame(px + sd * ux2 * 1.0, pz + sd * uz2 * 1.0, r), 0.35, 0.35, py - 1, py + 1.8, timber, timber);
        E.bridgeEnds = { a: pts[0], b: pts[N], ux: ux2, uz: uz2 };
      }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: S.facade, emissiveMap: S.glow, emissive: 0xffffff, emissiveIntensity: 0.55, vertexColors: true, roughness: 0.88, metalness: 0, flatShading: true, side: THREE.DoubleSide }));
      m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    // the alcove (art pass 1): its two walls as walls of the rock (a face, the ends and the back, from below the floor
    // up into the roof, wandering in and out with depth; the 10 m map makes them cones) and its roof as slabs of the
    // same stone with a thickened, broken lip and hanging lumps underneath, all in the ground shader's rock
    const RP = [], RD = [], RWt = [];
    const otri = (A, B, C, d, o) => { const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (nx * o[0] + ny * o[1] + nz * o[2] < 0) RP.push(...A, ...C, ...B); else RP.push(...A, ...B, ...C); RD.push(d, d, d); for (let q = 0; q < 3; q++) RWt.push(0, 0, 0, 1); };
    const oquad = (A, B, C, D, d, o) => { otri(A, B, C, d, o); otri(A, C, D, d, o); };
    for (const fin of E.fins || []) {
      const pts = fin.pts.map(([X, Z, nx, nz, fl, tp]) => { const [x, z] = L(X, Z), [x2, z2] = L(X + nx, Z + nz); return { x, z, nx: x2 - x, nz: z2 - z, fl: LY(fl) - 4, tp: LY(tp) }; });
      if (!pts.some(p => (p.x - cx) ** 2 + (p.z - cz) ** 2 < 2400 ** 2)) continue;
      const th = fin.thick, rowsAt = (p, k) => { const H = p.tp - p.fl, rs = [0, 2, 8, 20, 36, 56, 78].filter(d => d < H - 3); rs.push(H); return rs; };
      const ptAt = (p, d, side) => { const bx = p.x + p.nx * (side ? th : 0), bz = p.z + p.nz * (side ? th : 0), w = wob(bx, bz, Math.max(3, Math.min(d, p.tp - p.fl - d) + 4)); const sg = side ? -1 : 1; return [bx + w[0] * 0.45 + sg * p.nx * 1.5, p.tp - d, bz + w[1] * 0.45 + sg * p.nz * 1.5]; };   // wandering, but never out into the play
      const N = 7;   // rows as fractions of each point's height, so neighbours line up
      const row = (p, r, side) => ptAt(p, (p.tp - p.fl) * r / N, side);
      for (let k = 0; k < pts.length - 1; k++) for (const side of [0, 1]) for (let r = 0; r < N; r++) {
        const p = pts[k], q = pts[k + 1], o = side ? [p.nx, 0, p.nz] : [-p.nx, 0, -p.nz];
        oquad(row(p, r, side), row(q, r, side), row(q, r + 1, side), row(p, r + 1, side), 6 + (p.tp - p.fl) * r / N, o);
      }
      for (const [p, sgn] of [[pts[0], -1], [pts[pts.length - 1], 1]]) {   // the ends
        const nb = sgn < 0 ? pts[1] : pts[pts.length - 2], o = [(p.x - nb.x), 0, (p.z - nb.z)];
        for (let r = 0; r < N; r++) oquad(row(p, r, 0), row(p, r, 1), row(p, r + 1, 1), row(p, r + 1, 0), 6 + (p.tp - p.fl) * r / N, o);
      }
    }
    for (const R of E.roof.boxes) {
      const [x, z] = L(...R.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 2400 ** 2) continue;
      const Pf = frame(x, z, R.rot - a), y0 = LY(R.y), N = 6, hw = R.w / 2 + 6, hl = R.l / 2 + 4;
      const P = (i, j, top) => { const su = -hw + 2 * hw * i / N, sv = -hl + 2 * hl * j / N, n1 = vn2((su * 0.7 + R.at[0]) / 15, (sv + R.at[1]) / 15, 9), edge = Math.min(i, N - i, j, N - j);
        return Pf(su, sv, top ? y0 + R.h : y0 - (edge ? 1 + 8 * n1 * n1 : 6 + 5 * n1)); };
      const cU = Pf(0, 0, y0 + R.h / 2);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { oquad(P(i, j, 0), P(i + 1, j, 0), P(i + 1, j + 1, 0), P(i, j + 1, 0), 30, [0, -1, 0]); oquad(P(i, j, 1), P(i + 1, j, 1), P(i + 1, j + 1, 1), P(i, j + 1, 1), 30, [0, 1, 0]); }
      const side = (A, B, C, D) => { const m = [(A[0] + B[0]) / 2 - cU[0], 0, (A[2] + B[2]) / 2 - cU[2]]; oquad(A, B, C, D, 30, m); };
      for (let i = 0; i < N; i++) { side(P(i, 0, 0), P(i + 1, 0, 0), P(i + 1, 0, 1), P(i, 0, 1)); side(P(i, N, 0), P(i + 1, N, 0), P(i + 1, N, 1), P(i, N, 1)); }
      for (let j = 0; j < N; j++) { side(P(0, j, 0), P(0, j + 1, 0), P(0, j + 1, 1), P(0, j, 1)); side(P(N, j, 0), P(N, j + 1, 0), P(N, j + 1, 1), P(N, j, 1)); }
    }
    if (RP.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(RP, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(RWt, 4)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(RD, 1)); g.setAttribute('normal', new THREE.Float32BufferAttribute(weldNormals(RP), 3));
      const m = new THREE.Mesh(g, rockMat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  }

  // ---- the pines (art pass 1): crooked umbrella pines where the plan put them, leaning out over the nearest drop (or
  // down the slope), more growing out of the cliff faces and off the pinnacles' crowns; and curtains of vines down the
  // faces from some lips. Scenery: none of it plays
  {
    const W2 = mapOf(E.world), hAt = (X, Z) => { const i = Math.round((X - W2.x0) / W2.cell), j = Math.round((Z - W2.z0) / W2.cell); if (i < 0 || j < 0 || i >= W2.nx || j >= W2.nz) return null; const r = W2.hDec[j * W2.nx + i]; return r === GAP ? null : r / W2.scale + W2.y0; };
    const lean = (X, Z) => {   // the way down from here, in world space, and how steep
      let gx = 0, gz = 0, open = false; const y0 = hAt(X, Z) ?? 0;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, y = hAt(X + Math.cos(a) * 14, Z + Math.sin(a) * 14); const d = y === null ? 40 : Math.max(0, y0 - y); if (y === null) open = true; gx += Math.cos(a) * d; gz += Math.sin(a) * d; }
      const l = Math.hypot(gx, gz) || 1; return { dx: gx / l, dz: gz / l, k: open ? 1 : Math.min(1, l / 30) };
    };
    const up = new THREE.Vector3(0, 1, 0), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3(), ax = new THREE.Vector3(), Cc = new THREE.Color();
    const sets = [[], [], []], cliff = [], R2 = (coarse ? 1400 : 1900) ** 2, ha = -a;   // ha: world angles to the hole's frame
    const addPine = (x, z, y, h, wx, wz, k, seed) => {   // (wx, wz): lean direction in the hole's frame, k: 0..1
      const v = Math.floor(hash(x, z + seed) * 3); sets[v].push({ x, y, z, h, wx, wz, k, s: hash(z, x) });
    };
    const toLocalDir = (dx, dz) => [dx * rx + dz * rz, -(dx * fx + dz * fz)];
    for (const t of E.pines) { const [x, z] = L(t[0], t[1]); if ((x - cx) ** 2 + (z - cz) ** 2 > R2 || teeD(t[0], t[1]) < 16) continue; const ln = lean(t[0], t[1]), [wx, wz] = toLocalDir(ln.dx, ln.dz); addPine(x, z, LY(t[2]) - 0.4, t[3] * 0.85, wx, wz, ln.k, 0); }
    const nd = E.sites.find(o => o.kind === 'pine'); if (nd) { const [x, z] = L(...nd.at), ln = lean(...nd.at), [wx, wz] = toLocalDir(ln.dx, ln.dz); sets[1].push({ x, y: LY(nd.y) - 0.5, z, h: nd.h * 1.5, wx, wz, k: 1, s: 0.5 }); }
    // on the pinnacles' crowns, near the rim, leaning out
    for (const [X, Z, top, R] of E.pinnacles || []) {
      const [x0, z0] = L(X, Z); if ((x0 - cx) ** 2 + (z0 - cz) ** 2 > R2) continue;
      const n = 2 + Math.floor(hash(X, Z) * 4);
      for (let q = 0; q < n; q++) { const k = Math.floor(hash(X + q, Z) * 32), a2 = k / 32 * Math.PI * 2, r = R[k] * (0.55 + 0.35 * hash(q, X)), WX = X + Math.cos(a2) * r, WZ = Z + Math.sin(a2) * r, [x, z] = L(WX, WZ), [wx, wz] = toLocalDir(Math.cos(a2), Math.sin(a2));
        if (clear(x, z)) addPine(x, z, LY(top) + 3.5 * (1 - (r / R[k]) ** 2) - 0.3, 7 + 7 * hash(q, Z), wx, wz, 0.7, q); }
    }
    // out of the faces, at the ledges
    for (const e of edges) {
      const len = Math.hypot(e.q[0] - e.p[0], e.q[2] - e.p[2]), mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[2] + e.q[2]) / 2;
      if ((mx - cx) ** 2 + (mz - cz) ** 2 > R2) continue;
      if (hash(mx * 0.7, mz * 1.3) > len / (e.pin ? 22 : 38)) continue;
      const d = 6 + Math.min(e.D * 0.55, 80) * hash(mz, mx), A = facePt(e.p, d, e.sc), B = facePt(e.q, d, e.sc), ox = e.out[0] - mx, oz = e.out[1] - mz, ol = Math.hypot(ox, oz) || 1;
      if (!clear(mx, mz, 18)) continue;
      cliff.push({ x: (A[0] + B[0]) / 2 - ox / ol * 0.6, y: Math.max(e.p[1], e.q[1]) - d, z: (A[2] + B[2]) / 2 - oz / ol * 0.6, h: 6 + 7 * hash(mx, d), wx: ox / ol, wz: oz / ol });
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
    const inst = (geo, list, place) => {
      if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((t, k) => { place(t); m.setMatrixAt(k, M4); const v = 0.82 + 0.36 * hash(t.x * 2, t.z); m.setColorAt(k, Cc.setRGB(v, v * (0.96 + 0.08 * hash(t.z, 3)), v)); });
      m.castShadow = true; m.receiveShadow = true; group.add(m);
    };
    sets.forEach((list, v) => inst(S.pines[v], list, t => {
      const yaw = Math.atan2(-t.wz, t.wx);   // the shape's +x turned toward the drop
      Q.setFromAxisAngle(up, yaw + (t.s - 0.5) * 0.8);
      ax.set(-t.wz, 0, t.wx).normalize(); Q2.setFromAxisAngle(ax, -(0.08 + 0.32 * t.k) * (0.6 + 0.6 * t.s)); Q.premultiply(Q2);
      M4.compose(Vp.set(t.x, t.y, t.z), Q, Vs.set(t.h * (0.85 + 0.3 * t.s), t.h, t.h * (0.85 + 0.3 * t.s)));
    }));
    inst(S.cliffPine, cliff, t => { Q.setFromAxisAngle(up, Math.atan2(-t.wz, t.wx)); M4.compose(Vp.set(t.x, t.y, t.z), Q, Vs.setScalar(t.h)); });
    // vines: sheets hugging the faces from the lip, in runs (a 30 m noise), their lengths wandering so the tips are ragged
    const VP = [], VU = [];
    for (const e of edges) {
      const mx = (e.p[0] + e.q[0]) / 2, mz = (e.p[2] + e.q[2]) / 2; if ((mx - cx) ** 2 + (mz - cz) ** 2 > (coarse ? 700 : 1100) ** 2) continue;
      if (vn2((mx + F.x) / 34, (mz + F.z) / 34, 11) < 0.64) continue;
      const ox = e.out[0] - mx, oz = e.out[1] - mz, ol = Math.hypot(ox, oz) || 1, nx = ox / ol * 0.5, nz = oz / ol * 0.5;
      const lenAt = P => Math.min(e.D - 6, 9 + 24 * vn2((P[0] + F.x) / 8, (P[2] + F.z) / 8, 12));
      const la = lenAt(e.p), lb = lenAt(e.q), ua = (e.p[0] + e.p[2]) / 6, ub = ua + Math.hypot(e.q[0] - e.p[0], e.q[2] - e.p[2]) / 6;
      for (let r = 0; r < 4; r++) {
        const t0 = r / 4, t1 = (r + 1) / 4, pt = (P, l, t) => { const Q = facePt(P, l * t, e.sc); return [Q[0] + nx, Q[1] + 0.3, Q[2] + nz]; };
        const A = pt(e.p, la, t0), B = pt(e.q, lb, t0), C = pt(e.q, lb, t1), D = pt(e.p, la, t1);
        VP.push(...A, ...B, ...C, ...A, ...C, ...D); VU.push(ua, 1 - t0, ub, 1 - t0, ub, 1 - t1, ua, 1 - t0, ub, 1 - t1, ua, 1 - t1);
      }
    }
    if (VP.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(VP, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(VU, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: S.vineTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 })); m.receiveShadow = true; group.add(m);
    }
  }
  // ---- the tea terraces (art pass 1): clipped bushes in rows along the contours (every 1.8 m of height), as low
  // hedges, only 30 m or more from the play and off the fairways and greens (a ball in the tea is never hidden);
  // nearer the play the ground shader paints the same rows
  if (Fd) {
    const HP = [], HC = [], dk = lin([40, 76, 34]), lt = lin([66, 108, 48]), sp = 1.8, cF2 = Fd.codes.indexOf('fairway'), cG2 = Fd.codes.indexOf('green');
    const hAt = (i, j) => Fd.h[j * Fd.nx + i];
    const hedge = (A, B) => { const dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.45, nz = dx / l * 0.45, tA = [A[0], A[1] + 0.6, A[2]], tB = [B[0], B[1] + 0.6, B[2]];
      HP.push(A[0] + nx, A[1] - 0.05, A[2] + nz, B[0] + nx, B[1] - 0.05, B[2] + nz, ...tB, A[0] + nx, A[1] - 0.05, A[2] + nz, ...tB, ...tA); HC.push(...dk, ...dk, ...lt, ...dk, ...lt, ...lt);
      HP.push(B[0] - nx, B[1] - 0.05, B[2] - nz, A[0] - nx, A[1] - 0.05, A[2] - nz, ...tA, B[0] - nx, B[1] - 0.05, B[2] - nz, ...tA, ...tB); HC.push(...dk, ...dk, ...lt, ...dk, ...lt, ...lt); };
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i; if (Fd.mDec ? Fd.mDec[k] !== 4 : matAt(hole, Fd.x0 + i * Fd.cell, Fd.z0 + j * Fd.cell) !== 4) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell; if (!clear(x, z, 30)) continue;
      let near2 = false; for (let dj = -6; dj <= 6 && !near2; dj += 2) for (let di = -6; di <= 6; di += 2) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= Fd.nx || jj >= Fd.nz) continue; const c = Fd.s[jj * Fd.nx + ii]; if (c === cF2 || c === cG2) { near2 = true; break; } }
      if (near2) continue;
      const c4 = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a2, b2]) => [Fd.x0 + a2 * Fd.cell, hAt(a2, b2), Fd.z0 + b2 * Fd.cell]);
      if (c4.some(c => Number.isNaN(c[1]))) continue;
      const lo = Math.min(...c4.map(c => c[1])), hi2 = Math.max(...c4.map(c => c[1]));
      for (let lv = Math.ceil(lo / sp) * sp; lv < hi2; lv += sp) {
        const cr = []; for (let e = 0; e < 4; e++) { const A = c4[e], B = c4[(e + 1) % 4]; if ((A[1] - lv) * (B[1] - lv) < 0) { const t = (lv - A[1]) / (B[1] - A[1]); cr.push([A[0] + (B[0] - A[0]) * t, lv, A[2] + (B[2] - A[2]) * t]); } }
        if (cr.length >= 2) hedge(cr[0], cr[1]); if (cr.length === 4) hedge(cr[2], cr[3]);
      }
    }
    if (HP.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(HP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(HC, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })); m.receiveShadow = true; m.castShadow = true; group.add(m); }
  }

  // ---- the details (art pass 1, all four of Rhys's picks): prayer flags strung from the cairn, along the rope
  // bridge, between the monastery's roofs and on tall poles round the stupa; small white chortens by the paths; smoke
  // from the chimneys; the thread of waterfall at the head of the cleft on the 2nd; lammergeiers
  // wheeling over the gorge and swifts along the faces. Scenery only, 26 m or more off every line, 14 m off the tees
  {
    const W4 = mapOf(E.world), mAt = (X, Z) => { const i = Math.round((X - W4.x0) / W4.cell), j = Math.round((Z - W4.z0) / W4.cell); if (i < 0 || j < 0 || i >= W4.nx || j >= W4.nz) return null; const v = W4.hDec[j * W4.nx + i]; return v === GAP ? null : v / W4.scale + W4.y0; };
    const yAtL = (x, z) => { const g = inField(x, z) ? gnd(x, z) : null; if (g !== null) return g; const [X, Z] = W(x, z), m = mAt(X, Z); return m === null ? null : LY(m); };
    const near = (x, z, R) => (x - cx) ** 2 + (z - cz) ** 2 < R * R;
    // -- prayer flags
    const FPp = [], FCp = [], FFp = [], FLAG = [[70, 100, 150], [226, 220, 205], [172, 62, 52], [72, 128, 82], [212, 176, 72]].map(lin), cord = lin([70, 60, 50]);
    const fq = (A, B, C, D, k, fA = 0, fB = 0, fC = 0, fD = 0) => { FPp.push(...A, ...B, ...C, ...A, ...C, ...D); for (let q = 0; q < 6; q++) FCp.push(...k); FFp.push(fA, fB, fC, fA, fC, fD); };
    const string = (A, B, sagK = 0.07, banner = false) => {   // flags every 0.7 m along a sagging cord from A to B (hole frame)
      const span = Math.hypot(B[0] - A[0], B[2] - A[2], B[1] - A[1]), n = Math.max(2, Math.floor(span / 0.7)), P = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - span * sagK * 4 * t * (1 - t), A[2] + (B[2] - A[2]) * t];
      for (let q = 0; q < n; q++) { const p0 = P(q / n), p1 = P((q + 1) / n); fq(p0, p1, [p1[0], p1[1] - 0.05, p1[2]], [p0[0], p0[1] - 0.05, p0[2]], cord);
        const m0 = P((q + 0.15) / n), m1 = P((q + 0.85) / n), k = FLAG[q % 5], dh = banner ? 0.9 : 0.42; fq(m0, m1, [m1[0], m1[1] - dh, m1[2]], [m0[0], m0[1] - dh, m0[2]], k, 0, 0, 1, 1); }
    };
    const pole = (x, y, z, hgt, banner = true) => {   // a tall pole with a long white banner down one side (a dar)
      fq([x - 0.08, y, z], [x + 0.08, y, z], [x + 0.08, y + hgt, z], [x - 0.08, y + hgt, z], cord); fq([x, y, z - 0.08], [x, y, z + 0.08], [x, y + hgt, z + 0.08], [x, y + hgt, z - 0.08], cord);
      if (banner) for (let q = 0; q < 6; q++) { const y1 = y + hgt - 0.4 - q * 0.9, k = q % 2 ? FLAG[1] : lin([236, 232, 222]); fq([x + 0.08, y1, z], [x + 0.08, y1 - 0.9, z], [x + 0.08 + 0.7, y1 - 0.9, z], [x + 0.08 + 0.7, y1, z], k, 0, 0, 1, 1); }
    };
    const clearLine = (A, B, d = 22) => { for (let t = 0; t <= 1.001; t += 0.25) if (!clear(A[0] + (B[0] - A[0]) * t, A[2] + (B[2] - A[2]) * t, d)) return false; return true; };
    for (const o of E.sites) {
      const [x, z] = L(...o.at); if (!near(x, z, 1500)) continue;
      const y = LY(o.y);
      if (o.kind === 'cairn') for (let q = 0; q < 7; q++) {   // strings fanning out from a mast on the cairn
        const a2 = q / 7 * Math.PI * 2 + 0.3, rr = 20 + 10 * hash(q, x), ex = x + Math.cos(a2) * rr, ez = z + Math.sin(a2) * rr, ey = yAtL(ex, ez); if (ey === null) continue;
        const A = [x, y + 8, z], B = [ex, ey + 2.4, ez]; if (!clearLine(A, B, 18)) continue; string(A, B, 0.05); pole(ex, ey, ez, 2.6, false);
        if (q === 0) pole(x, y + 2, z, 6.5, false);
      }
      if (o.kind === 'stupa') for (let q = 0; q < 4; q++) { const a2 = q * Math.PI / 2 + 0.785, px = x + Math.cos(a2) * 11, pz = z + Math.sin(a2) * 11, py = yAtL(px, pz); if (py !== null && clear(px, pz, 20)) pole(px, py, pz, 7.5); }
    }
    // between the monastery's roofs: the golden hall to the bell tower and to the guesthouse (where clear of the 9th)
    { const tops = E.sites.filter(o => o.kind === 'hall' && !o.face).map(o => { const [x, z] = L(...o.at); return [x, LY(o.y) + o.h + 4, z, o.name]; });
      const gh = tops.find(t => /golden/.test(t[3])); if (gh) for (const t of tops) if (t !== gh && near(t[0], t[2], 1500) && clearLine(gh, t, 20)) string(gh, t, 0.1); }
    if (E.bridgeEnds) { const { a: A, b: B, ux, uz } = E.bridgeEnds; for (const sd of [-1, 1]) string([A[0] + sd * ux, A[1] + 2.2, A[2] + sd * uz], [B[0] + sd * ux, B[1] + 2.2, B[2] + sd * uz], 0.075); }
    // -- chortens: small whitewashed stupas by the paths near the sites, wherever there's clear level ground
    const CP = [], CC = [];
    const cq = (A, B, C, D, k) => { CP.push(...A, ...B, ...C, ...A, ...C, ...D); for (let q = 0; q < 6; q++) CC.push(...k); };
    const cbox = (x, z, y0, w, y1, k) => { const h2 = w / 2, P = [[-h2, -h2], [h2, -h2], [h2, h2], [-h2, h2]]; for (let f = 0; f < 4; f++) { const p0 = P[f], p1 = P[(f + 1) % 4]; cq([x + p0[0], y0, z + p0[1]], [x + p1[0], y0, z + p1[1]], [x + p1[0], y1, z + p1[1]], [x + p0[0], y1, z + p0[1]], f % 2 ? k : k.map(v => v * 0.86)); } cq([x - h2, y1, z - h2], [x + h2, y1, z - h2], [x + h2, y1, z + h2], [x - h2, y1, z + h2], k); };
    const chorten = (x, y, z, sc) => { const wht = lin([226, 220, 208]); cbox(x, z, y - 0.6, 2.4 * sc, y + 1.0 * sc, wht); cbox(x, z, y + 1.0 * sc, 1.9 * sc, y + 1.4 * sc, lin([106, 43, 37])); cbox(x, z, y + 1.4 * sc, 1.5 * sc, y + 2.6 * sc, wht); cbox(x, z, y + 2.6 * sc, 0.6 * sc, y + 3.6 * sc, lin([190, 150, 66])); cbox(x, z, y + 3.6 * sc, 0.25 * sc, y + 4.3 * sc, lin([190, 150, 66])); };
    for (const o of E.sites) {
      if (!['gatehouse', 'wheel', 'stupa', 'cairn', 'stair', 'hall'].includes(o.kind) || o.face) continue;
      const [x, z] = L(...o.at); if (!near(x, z, 1200)) continue;
      let placed = 0;
      for (let q = 0; q < 12 && placed < 2; q++) { const a2 = q * 2.39 + hash(x, z) * 6, rr = Math.max(o.w, o.l) * 0.7 + 8 + q * 3, px = x + Math.cos(a2) * rr, pz = z + Math.sin(a2) * rr, py = yAtL(px, pz);
        if (py === null || !clear(px, pz, 28)) continue; const sl = [yAtL(px + 2, pz), yAtL(px - 2, pz), yAtL(px, pz + 2), yAtL(px, pz - 2)]; if (sl.some(v => v === null || Math.abs(v - py) > 1)) continue;
        chorten(px, py, pz, 0.9 + 0.3 * hash(px, pz)); placed++; }
    }
    if (FPp.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(FPp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(FCp, 3)); g.setAttribute('aF', new THREE.Float32BufferAttribute(FFp, 1)); g.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, metalness: 0 });
      mat.onBeforeCompile = sh => { sh.uniforms.uCTime = U.uCTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aF; uniform float uCTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat fl = sin(uCTime*7.0 + position.x*0.9 + position.z*0.7) * 0.5 + sin(uCTime*11.0 + position.x*2.3) * 0.25; transformed += vec3(0.16*fl, 0.05*fl, 0.16*fl) * aF;'); };
      const m = new THREE.Mesh(g, mat); m.castShadow = true; group.add(m);
    }
    if (CP.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(CP, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(CC, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
    // -- smoke: soft puffs rising from the chimneys and leaning with the wind
    const ch = chimneys.filter(c => near(c[0], c[2], 1300)).slice(0, 8);
    if (ch.length) {
      const N = 16, P = new Float32Array(ch.length * N * 3), A2 = new Float32Array(ch.length * N), g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aAge', new THREE.BufferAttribute(A2, 1));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPx: { value: 900 } },
        vertexShader: 'attribute float aAge; varying float vA; uniform float uPx; void main(){ vA = aAge; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (1.2 + aAge * 4.5) / -mv.z; }',
        fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = (1.0 - smoothstep(0.2, 0.5, r)) * (1.0 - vA) * smoothstep(0.0, 0.08, vA) * 0.32; gl_FragColor = vec4(vec3(0.82, 0.8, 0.78), a); }' });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6; group.add(pts);
      const age = Array.from({ length: ch.length * N }, (_, i) => (i % N) / N);
      anims.push((dt, clock, wv) => { const wx = wv && wv.x || 0.6, wz = wv && wv.z || 0.2; mat.uniforms.uPx.value = 900 * (group.parent ? 1 : 1);
        for (let i = 0; i < age.length; i++) { age[i] = (age[i] + dt / 14) % 1; const c = ch[Math.floor(i / N)], t = age[i]; P[i * 3] = c[0] + wx * t * 14 + Math.sin(i * 7.3) * t * 2; P[i * 3 + 1] = c[1] + t * 18; P[i * 3 + 2] = c[2] + wz * t * 14 + Math.cos(i * 5.1) * t * 2; A2[i] = t; }
        g.attributes.position.needsUpdate = true; g.attributes.aAge.needsUpdate = true; });
    }
    // -- the thread of waterfall: a narrow sheet from the cleft's head down the face into the cloud
    {
      // at the cleft's head on the 2nd (the layout's thread of waterfall): the emitter gives the lip and the way out
      const Fw = E.falls, best = Fw ? { X: Fw.X, Z: Fw.Z, y: Fw.y, dx: Fw.ox, dz: Fw.oz } : null;
      if (best) {
        const [x, z] = L(best.X, best.Z), [x2, z2] = L(best.X + best.dx * 10, best.Z + best.dz * 10), ox = x2 - x, oz = z2 - z, ol = Math.hypot(ox, oz) || 1, ux = ox / ol, uz = oz / ol, vx = -uz, vz = ux;
        if (near(x, z, 2600)) {
          const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = 'rgba(255,255,255,0)'; c.fillRect(0, 0, 64, 256);
          for (let k = 0; k < 40; k++) { const xx = Math.random() * 64, gr = c.createLinearGradient(0, 0, 0, 256), al = 0.25 + Math.random() * 0.5; gr.addColorStop(0, `rgba(240,244,246,${al})`); gr.addColorStop(0.5, `rgba(225,232,236,${al * 0.5})`); gr.addColorStop(1, `rgba(240,244,246,${al})`); c.fillStyle = gr; c.fillRect(xx, 0, 1 + Math.random() * 4, 256); }
          const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          const top = LY(best.y) + 0.3, bot = MY - 4, hw = 3.2, edge = [x + ux * 1.5, z + uz * 1.5], VPs = [], UVs = [], rowsF = 8;
          for (let r = 0; r < rowsF; r++) { const d0 = (top - bot) * r / rowsF, d1 = (top - bot) * (r + 1) / rowsF, out0 = 1.5 + Math.min(10, d0 * 0.12), out1 = 1.5 + Math.min(10, d1 * 0.12), w0 = hw + d0 * 0.04, w1 = hw + d1 * 0.04;
            const A = [edge[0] + ux * out0 - vx * w0, top - d0, edge[1] + uz * out0 - vz * w0], B = [edge[0] + ux * out0 + vx * w0, top - d0, edge[1] + uz * out0 + vz * w0], C = [edge[0] + ux * out1 + vx * w1, top - d1, edge[1] + uz * out1 + vz * w1], D = [edge[0] + ux * out1 - vx * w1, top - d1, edge[1] + uz * out1 - vz * w1];
            VPs.push(...A, ...B, ...C, ...A, ...C, ...D); const v0 = d0 / 30, v1 = d1 / 30; UVs.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(VPs, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UVs, 2));
          const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.85 })); m.renderOrder = 5; group.add(m);
          anims.push(dt => { tex.offset.y += dt * 0.9; });
        }
      }
    }
    // -- birds: two lammergeiers wheeling over open air near the hole, and a flock of swifts darting along a face
    {
      const bird = (span) => { const g = new THREE.BufferGeometry(), s2 = span / 2, v = [0, 0, 0.7, 0, 0.05, -0.6, -s2, 0.12, -0.1, 0, 0, 0.7, s2, 0.12, -0.1, 0, 0.05, -0.6, 0, 0, -0.6, -0.35, 0, -1.05, 0.35, 0, -1.05];
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g; };
      const dark = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9, side: THREE.DoubleSide });
      let centre = null;
      for (let q = 0; q < 40 && !centre; q++) { const a2 = q * 2.4, rr = 180 + q * 15, px = cx + Math.cos(a2) * rr, pz = cz + Math.sin(a2) * rr; if (yAtL(px, pz) === null && clear(px, pz, 120)) centre = [px, pz]; }
      if (centre) for (let k = 0; k < 2; k++) {
        const m = new THREE.Mesh(bird(2.7), dark); m.scale.setScalar(1); group.add(m);
        const R = 110 + 50 * k, Y = MY + 95 + 30 * k, sp = 0.09 + 0.02 * k, ph = k * 2.1;
        anims.push((dt, clock) => { const t = clock * sp + ph, px = centre[0] + Math.cos(t) * R, pz = centre[1] + Math.sin(t) * R; m.position.set(px, Y + Math.sin(t * 2.3) * 6, pz); m.rotation.set(0, -t + Math.PI, 0); m.rotateZ(-0.35); });
      }
      // swifts: near the nearest long face, clear of the play
      const e0 = edges.filter(e => near((e.p[0] + e.q[0]) / 2, (e.p[2] + e.q[2]) / 2, 600) && clear((e.p[0] + e.q[0]) / 2, (e.p[2] + e.q[2]) / 2, 60))[0];
      if (e0) { const N = 12, im = new THREE.InstancedMesh(bird(0.45), dark, N), M4 = new THREE.Matrix4(), Qb = new THREE.Quaternion(), Vb = new THREE.Vector3(), Sb = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), c0 = [(e0.p[0] + e0.q[0]) / 2, Math.max(e0.p[1], e0.q[1]) - 12, (e0.p[2] + e0.q[2]) / 2];
        group.add(im); anims.push((dt, clock) => { for (let k = 0; k < N; k++) { const t = clock * (0.6 + 0.05 * k) + k * 1.7, px = c0[0] + Math.sin(t) * 40 + Math.sin(t * 2.7 + k) * 8, pz = c0[2] + Math.sin(t * 2) * 22, py = c0[1] + Math.cos(t * 1.3 + k) * 10;
          Qb.setFromAxisAngle(up, Math.atan2(Math.cos(t) * 40, Math.cos(t * 2) * 44)); M4.compose(Vb.set(px, py, pz), Qb, Sb); im.setMatrixAt(k, M4); } im.instanceMatrix.needsUpdate = true; }); }
    }
  }
  return { trees: [], anims };
}
