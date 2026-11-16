// Eldergrove (global THREE), blockout: what COURSE.grove holds (world space) put into a hole's frame (hole.frame) and
// drawn. The forest floor from its height maps (leaf litter, fern, moss, the meadow and the Glade, the fallen giant's
// bark) in the ground shader's GROVE branch, the brook and the pool as water sheets, every giant as a tapered trunk
// under a crown far overhead (instanced), the heart tree with its buttresses, the root plate, the hollow stump of a snapped giant, and
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
// the same with texture coordinates: quad(a, b, c, d, tint, [ua, va], [ub, vb], [uc, vc], [ud, vd])
function batchUV() {
  const pos = [], col = [], uv = [];
  const quad = (a, b, c, d, k, ta, tb, tc, td) => { for (const [p, t] of [[a, ta], [b, tb], [c, tc], [a, ta], [c, tc], [d, td]]) { pos.push(...p); uv.push(...t); col.push(...k); } };
  const mesh = mat => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  return { quad, mesh };
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
  const crowns = [0, 1, 2].map(v => coniferGeo(14, 10, v, true)), crownFar = coniferGeo(6, 6, 3, false);
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
    const ub = k / N * 0.86, ua = Math.min(1, ub + 1.9 / N + 0.03 * hash(k, v)), R = crownR(ub + 0.05) * (0.88 + 0.22 * hash(v * 3 + k, 1.7)) + 0.04;
    const ox = (hash(k * 1.3, v) - 0.5) * 0.16, oz = (hash(v, k * 1.9) - 0.5) * 0.16, rot = hash(k, v + 4) * 6.28;
    const rim = [...Array(seg)].map((_, q) => { const an = rot + q / seg * Math.PI * 2, j = 0.78 + 0.4 * hash(q * 2.1 + k, v * 5.3 + q); return [ox + Math.cos(an) * R * j, ub - 0.025 * j + (hash(q, k + v) - 0.5) * 0.03, oz + Math.sin(an) * R * j]; });
    const apex = [ox * 0.5, ua, oz * 0.5], bot = [ox, ub + 0.07, oz], lit = 0.72 + 0.3 * (ub + ua) / 2;
    for (let q = 0; q < seg; q++) { const A = rim[q], B = rim[(q + 1) % seg]; tri(A, apex, B, lit * (0.9 + 0.2 * hash(q, k * 7 + v))); if (under) tri(B, bot, A, 0.42); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
// a limb: rings along a quadratic curve from A through K to B, radius r0 to r1, flared where it leaves the trunk
function limbGeo(A, K, B, r0, r1) {
  const N = 16, S = 10, pos = [], uv = [], idx = [], P = t => A.map((v, i) => (1 - t) * (1 - t) * v + 2 * (1 - t) * t * K[i] + t * t * B[i]);
  for (let s = 0; s <= N; s++) {
    const t = s / N, p = P(t), q = P(Math.min(1, t + 0.02)), o = P(Math.max(0, t - 0.02)), d = new THREE.Vector3(q[0] - o[0], q[1] - o[1], q[2] - o[2]).normalize();
    const u = new THREE.Vector3(0, 1, 0).cross(d).normalize(), v = d.clone().cross(u).normalize(), r = (r0 + (r1 - r0) * t) * (1 + 0.6 * Math.max(0, 1 - t / 0.2) ** 2);
    for (let k = 0; k <= S; k++) { const a = k / S * Math.PI * 2, c = Math.cos(a) * r, sn = Math.sin(a) * r * (0.75 + 0.25 * t); pos.push(p[0] + u.x * c + v.x * sn, p[1] + u.y * c + v.y * sn, p[2] + u.z * c + v.z * sn); uv.push(k / S, t * 4); }
  }
  for (let s = 0; s < N; s++) for (let k = 0; k < S; k++) { const a = s * (S + 1) + k, b = a + 1, c = a + S + 1, d = b + S + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------- art pass 1: textures made once (canvas), shared GLSL ---------- */
let TEX = null;
const rngOf = s => () => (s = s * 16807 % 2147483647) / 2147483647;
// periodic value noise on a grid px by py (so the canvases tile)
function pnoise(x, y, px, py, seed) {
  const h = (i, j) => { i = ((i % px) + px) % px; j = ((j % py) + py) % py; return hash(i + seed * 13.1, j - seed * 7.7); };
  const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return (h(i, j) * (1 - su) + h(i + 1, j) * su) * (1 - sv) + (h(i, j + 1) * (1 - su) + h(i + 1, j + 1) * su) * sv;
}
function textures() {
  if (TEX) return TEX;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  // coast redwood bark, 256 x 512 for about 5 m round by 8 m up: broad fibrous ridges between deep furrows that wander
  // and split, cinnamon where the ridges are fresh, grey-brown where weathered, near black in the furrows
  let bark, barkB;
  {
    const W = 256, H = 512, [c, g] = canvas(W, H), [cb, gb] = canvas(W, H), im = g.createImageData(W, H), ib = gb.createImageData(W, H), N = 9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const yy = y / H, wander = 0.55 * (pnoise(x / W * 2, yy * 2, 2, 2, 1) - 0.5) + 0.18 * (pnoise(x / W * 5, yy * 5, 5, 5, 2) - 0.5);
      const u = x / W * N + wander * 1.6, f = u - Math.floor(u), k = Math.floor(u);
      const deep = 0.6 + 0.5 * pnoise(k, yy * 3, N, 3, 3), fw = 0.1 + 0.14 * pnoise(k + 0.5, yy * 4, N, 4, 12);
      // a ridge that splits: a shallow furrow down its middle where the noise says so
      const sp = Math.max(0, pnoise(k + 0.3, yy * 3, N, 3, 13) - 0.55) * 2.2 * Math.max(0, 1 - Math.abs(f - 0.5) / 0.07);
      const prof = Math.min(1, (f / fw) ** 1.3) * Math.min(1, ((1 - f) / fw) ** 1.3) * (1 - 0.6 * sp);
      const fib = pnoise(x / W * 96, yy * 7, 96, 7, 4), fib2 = pnoise(x / W * 192, yy * 18, 192, 18, 5);
      const weather = pnoise(x / W * 4, yy * 3, 4, 3, 6), crack = Math.max(0, 1 - Math.abs(pnoise(x / W * 2, yy * 20, 2, 20, 7) - 0.5) * 40) * prof * 0.5;
      const lum = (0.55 + 0.45 * prof) * (0.78 + 0.3 * fib + 0.12 * fib2) * (1 - crack * 0.6);
      let r = 124, gg = 64, b = 42;   // cinnamon
      const gw = Math.max(0, weather - 0.45) * 1.6 * prof;   // grey-brown on the weathered ridge tops
      r += (104 - r) * gw; gg += (84 - gg) * gw; b += (72 - b) * gw;
      const fu = 1 - prof * (1 - 0.25 * (1 - deep));   // the furrow's floor: dark red-brown to black
      r = r * lum * (1 - 0.7 * fu); gg = gg * lum * (1 - 0.74 * fu); b = b * lum * (1 - 0.72 * fu);
      const o = (y * W + x) * 4; im.data.set([r, gg, b, 255], o);
      const bv = 255 * (0.2 + 0.65 * prof * deep + 0.15 * fib) * (1 - crack); ib.data.set([bv, bv, bv, 255], o);
    }
    g.putImageData(im, 0, 0); gb.putImageData(ib, 0, 0); bark = tex(c); barkB = tex(cb, false);
  }
  // rotten heartwood: orange-brown fibres broken into cubes (brown rot), darker in the cracks
  let rot;
  {
    const W = 128, H = 256, [c, g] = canvas(W, H), im = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = x / W * 4 + 0.5 * pnoise(x / W * 3, y / H * 5, 3, 5, 8), cy = y / H * 7 + 0.5 * pnoise(x / W * 4, y / H * 4, 4, 4, 9);
      const keep = pnoise(x / W * 6, y / H * 9, 6, 9, 14) > 0.5 ? 1 : 0.3;   // the cubes show only in patches
      const e = Math.min(Math.abs(cx - Math.round(cx)) * (0.6 + keep), Math.abs(cy - Math.round(cy)) * 1.4 / keep), cr = Math.min(1, e / 0.05);
      const fib = pnoise(x / W * 64, y / H * 4, 64, 4, 10), fib2 = pnoise(x / W * 22, y / H * 2, 22, 2, 15), blot = pnoise(x / W * 3, y / H * 5, 3, 5, 11);
      const l = (0.86 + 0.14 * cr) * (0.55 + 0.35 * fib + 0.3 * fib2) * (0.8 + 0.3 * blot);
      const o = (y * W + x) * 4; im.data.set([(104 + 54 * blot) * l, (62 + 30 * blot) * l, (36 + 14 * blot) * l, 255], o);
    }
    g.putImageData(im, 0, 0); rot = tex(c);
  }
  // a sword fern's frond: a dark glossy rachis with about 34 pairs of narrow pinnae angled toward the tip, tapering
  let frond;
  {
    const W = 64, H = 256, [c, g] = canvas(W, H), R = rngOf(77);
    g.clearRect(0, 0, W, H);
    for (let k = 0; k < 34; k++) {
      const t = k / 34, y = H * (1 - t) - 2, len = (W / 2 - 1) * Math.sin(Math.PI * Math.min(1, 0.12 + t * 1.05)) ** 0.6 * (1 - t * 0.3), up = 0.45 + 0.25 * t;
      for (const s of [-1, 1]) {
        const sh = 30 + 40 * R(), col = `rgb(${38 + sh * 0.35 | 0},${70 + sh | 0},${28 + sh * 0.3 | 0})`;
        g.fillStyle = col; g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * len * 0.5, y - len * up * 0.2 - 3, W / 2 + s * len, y - len * up); g.quadraticCurveTo(W / 2 + s * len * 0.6, y - len * up * 0.1 + 4.5, W / 2, y + 5); g.fill();
      }
    }
    g.strokeStyle = 'rgb(52,70,30)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 4); g.stroke();
    frond = new THREE.CanvasTexture(c); frond.encoding = THREE.sRGBEncoding; frond.anisotropy = 4;
  }
  // a soft round glow (the motes)
  let glow;
  { const [c, g] = canvas(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(255,220,160,0.5)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glow = new THREE.CanvasTexture(c); }
  for (const t of [bark, barkB, rot, frond, glow]) t.userData = { keep: true };
  return (TEX = { bark, barkB, rot, frond, glow });
}
const GN = `
float gh3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
float gn3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(gh3(i),gh3(i+vec3(1,0,0)),f.x), mix(gh3(i+vec3(0,1,0)),gh3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(gh3(i+vec3(0,0,1)),gh3(i+vec3(1,0,1)),f.x), mix(gh3(i+vec3(0,1,1)),gh3(i+vec3(1,1,1)),f.x),f.y), f.z); }
`;
// the world position, the world normal and the height above the shape's foot, for the bark's moss and the crowns
const VARY = `varying vec3 vGWP; varying vec3 vGN; varying float vGH;
`;
const VTX = `#include <begin_vertex>
{ vec4 gw = vec4(transformed, 1.0); vec3 gn = objectNormal; float gs = 1.0;
#ifdef USE_INSTANCING
  gw = instanceMatrix * gw; gn = mat3(instanceMatrix) * gn; gs = length(instanceMatrix[1].xyz);
#endif
  gw = modelMatrix * gw; vGWP = gw.xyz; vGN = normalize(mat3(modelMatrix) * gn); vGH = transformed.y * gs * length(modelMatrix[1].xyz); }`;
// redwood bark: the texture, plus moss up the shady side (higher where it's damp low down), in the furrows near the
// foot, and pale lichen in blotches higher up. uShade: the horizontal direction away from the sun
function barkMat(sunDir, repU, repV, opts = {}) {
  const X = textures(), map = X.bark.clone(), bump = X.barkB.clone();
  for (const t of [map, bump]) { t.repeat.set(repU, repV); t.needsUpdate = true; }
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map, bumpMap: bump, bumpScale: 2.2, roughness: 0.94, metalness: 0, ...opts });
  const sh = new THREE.Vector3(-(sunDir ? sunDir.x : 0), 0, -(sunDir ? sunDir.z : 1)).normalize();
  m.onBeforeCompile = s => {
    s.uniforms.uShade = { value: sh };
    s.vertexShader = VARY + s.vertexShader.replace('#include <begin_vertex>', VTX);
    s.fragmentShader = VARY + 'uniform vec3 uShade;\n' + GN + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float side = dot(normalize(vGN.xz + vec2(1e-4)), normalize(uShade.xz));
  float n1 = gn3(vGWP * 0.35), n2 = gn3(vGWP * 1.9 + 3.0), lum = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
  float mh = 0.8 + (1.0 + 6.0 * smoothstep(-0.2, 1.0, side)) * (0.5 + 0.9 * n1);
  float mk = (1.0 - smoothstep(mh * 0.6, mh, vGH)) * smoothstep(-0.9, -0.1, side + 0.6 * (n2 - 0.5) + 1.2 * (1.0 - smoothstep(0.5, 1.6, vGH)));
  mk = max(mk * smoothstep(0.25, 0.6, n2 + 0.3 * n1), (1.0 - smoothstep(0.02, 0.05, lum)) * (1.0 - smoothstep(1.5, 4.0, vGH)) * 0.5);
  vec3 moss = mix(vec3(0.022, 0.04, 0.01), vec3(0.05, 0.08, 0.018), n2) * (0.75 + 0.4 * n1);
  diffuseColor.rgb = mix(diffuseColor.rgb, moss, clamp(mk, 0.0, 1.0) * 0.8);
  float li = smoothstep(0.82, 0.88, gn3(vGWP * vec3(2.2, 0.9, 2.2))) * smoothstep(3.0, 9.0, vGH) * (1.0 - smoothstep(40.0, 90.0, vGH)) * smoothstep(-0.6, 0.4, side);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.19, 0.14) * (0.8 + 0.4 * n2), li * 0.4); }`);
  };
  return m;
}
// the crowns: sprays of needles as clumps of light and dark through the foliage (by world position), bluer in the
// gaps, so a crown reads as masses of sprays rather than flat tiers
function crownMatOf(opts) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide, ...opts });
  m.onBeforeCompile = s => {
    s.vertexShader = VARY + s.vertexShader.replace('#include <begin_vertex>', VTX);
    s.fragmentShader = VARY + GN + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
{ float c1 = gn3(vGWP * 0.42), c2 = gn3(vGWP * 1.6 + 7.0), c3 = gn3(vGWP * 4.5);
  float spray = smoothstep(0.28, 0.78, c1 * 0.7 + c2 * 0.3);
  diffuseColor.rgb *= (0.55 + 0.6 * spray) * (0.85 + 0.3 * c3);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.98, 1.12), 1.0 - spray); }`);
  };
  return m;
}
// parts for the animals and birds: an ellipsoid, a tapered limb between two points, merged with vertex colours
function part(geo, col) { const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(col, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g; }
const ballG = (x, y, z, rx, ry, rz, col, seg = 10) => part(new THREE.SphereGeometry(1, seg, Math.max(5, seg * 0.6 | 0)).scale(rx, ry, rz).translate(x, y, z), col);
function limbG(a, b, r0, r1, col, seg = 6) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length(), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, false).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(...a); return part(g, col);
}
function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3); C.set(p.attributes.color.array, o * 3); o += p.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.userData.keep = true; return g;
}
let LIFE = null;
function lifeShapes() {
  if (LIFE) return LIFE;
  const c = v => lin(v);
  const coat = c([140, 104, 70]), dark = c([62, 44, 30]), pale = c([214, 190, 150]), head = c([110, 80, 54]), nose = c([40, 30, 24]), ant = c([196, 176, 140]);
  // an elk, 2.5 m nose to tail, forward -z, hooves at y 0: tan body, dark neck and legs, pale rump
  const body = [ballG(0, 1.32, 0, 0.42, 0.48, 1.0, coat), ballG(0, 1.38, 0.8, 0.37, 0.4, 0.32, pale), ballG(0, 1.42, -0.68, 0.4, 0.5, 0.45, dark),
    ...[[0.22, -0.68], [-0.22, -0.68], [0.22, 0.68], [-0.22, 0.68]].map(([x, z]) => limbG([x, 1.1, z], [x * 1.05, 0.02, z + 0.06], 0.1, 0.045, dark)), ballG(0, 1.45, 1.08, 0.08, 0.1, 0.08, pale, 6)];
  const neckUp = [limbG([0, 1.5, -0.86], [0, 1.98, -1.22], 0.27, 0.17, dark), ballG(0, 2.0, -1.42, 0.15, 0.17, 0.34, head), ballG(0, 1.93, -1.72, 0.1, 0.1, 0.12, nose, 6),
    ballG(0.13, 2.16, -1.26, 0.04, 0.12, 0.06, head, 5), ballG(-0.13, 2.16, -1.26, 0.04, 0.12, 0.06, head, 5)];
  const neckDown = [limbG([0, 1.42, -0.86], [0, 0.6, -1.36], 0.27, 0.17, dark), ballG(0, 0.38, -1.46, 0.15, 0.32, 0.17, head), ballG(0, 0.1, -1.5, 0.1, 0.1, 0.1, nose, 6),
    ballG(0.13, 0.66, -1.36, 0.04, 0.06, 0.12, head, 5), ballG(-0.13, 0.66, -1.36, 0.04, 0.06, 0.12, head, 5)];
  // a bull's antlers: two beams sweeping back and up from the head, six tines forward off each
  const antlers = [];
  for (const s of [-1, 1]) {
    const B = [[s * 0.08, 2.14, -1.32], [s * 0.3, 2.45, -1.15], [s * 0.42, 2.8, -0.9], [s * 0.45, 3.1, -0.6], [s * 0.38, 3.3, -0.35]];
    for (let k = 0; k < 4; k++) antlers.push(limbG(B[k], B[k + 1], 0.05 - k * 0.008, 0.042 - k * 0.008, ant, 5));
    for (const [k, l] of [[0.2, 0.42], [0.45, 0.4], [1.3, 0.34], [2.2, 0.3], [3.0, 0.24]]) { const i = Math.min(3, Math.floor(k)), t = k - i, p = B[i].map((v, q) => v + (B[i + 1][q] - v) * t); antlers.push(limbG(p, [p[0] + s * 0.05, p[1] + l * 0.45, p[2] - l * 0.85], 0.028, 0.01, ant, 4)); }
  }
  const elkUp = merge([...body, ...neckUp]), elkDown = merge([...body, ...neckDown]), bull = merge([...body.map(g => g.clone()), ...neckUp.map(g => g.clone()), ...antlers]);
  // a raven: body, head, a wedge tail and two wings with their tips raised (scaling y flaps them)
  const blk = c([20, 20, 24]);
  const wingG = s => { const g = new THREE.BufferGeometry(), p = [0, 0, -0.15, s * 0.62, 0.22, 0.05, 0, 0, 0.22, s * 0.62, 0.22, 0.05, s * 0.5, 0.18, 0.22, 0, 0, 0.22]; g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return part(g, blk); };
  const raven = merge([limbG([0, 0, 0.32], [0, 0, -0.3], 0.06, 0.08, blk, 5), ballG(0, 0.02, -0.38, 0.06, 0.06, 0.08, blk, 6), limbG([0, 0, 0.3], [0, 0, 0.55], 0.04, 0.09, blk, 4), wingG(1), wingG(-1)]);
  // a sword fern clump: fronds arching out from the crown (each a card bent at a third and two thirds), the texture
  // carries the pinnae
  const fern = (() => { const pos = [], uv = [], nor = [], R = rngOf(31), n = 12;
    for (let i = 0; i < n; i++) { const a = (i + R() * 0.6) / n * 6.283, up = 0.75 + R() * 0.55, L = 0.75 + R() * 0.4, ca = Math.cos(a), sa = Math.sin(a), w = 0.17 * L;
      const P = t => [ca * L * (t * 0.55 + 0.45 * t * t) , L * (up * t - (up * 0.9) * t * t * t), sa * L * (t * 0.55 + 0.45 * t * t)];
      const pts = [0, 0.34, 0.67, 1].map(P);
      for (let k = 0; k < 3; k++) { const A = pts[k], B = pts[k + 1], v0 = k / 3, v1 = (k + 1) / 3, side = (p, s) => [p[0] - sa * w * s, p[1], p[2] + ca * w * s];
        const q = [[side(A, 1), [0, v0]], [side(A, -1), [1, v0]], [side(B, -1), [1, v1]], [side(A, 1), [0, v0]], [side(B, -1), [1, v1]], [side(B, 1), [0, v1]]];
        for (const [p, t] of q) { pos.push(...p); uv.push(...t); nor.push(ca * 0.3, 0.9, sa * 0.3); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.userData.keep = true; return g; })();
  // a bracket fungus: a half disc, thick at the wood and thin at the rim, cream at the edge and rusty on top; flat
  // side at x 0 (against the bark), out along +x
  const shelf = (() => { const g = new THREE.CylinderGeometry(1, 0.86, 0.22, 12, 1, false, 0, Math.PI).rotateY(-Math.PI / 2), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getZ(i)), top = p.getY(i) > 0; p.setY(i, p.getY(i) * (1.15 - 0.75 * r)); col.set(lin(top ? (r > 0.8 ? [214, 196, 160] : [150, 96, 52]) : [226, 214, 188]), i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); g.userData.keep = true; return g; })();
  // a fallen branch: a crooked limb with a side stub, unit length along +x
  const branch = merge([limbG([0, 0, 0], [0.45, 0.02, 0.04], 0.07, 0.06, [1, 1, 1], 5), limbG([0.45, 0.02, 0.04], [1, 0.0, -0.03], 0.06, 0.035, [1, 1, 1], 5), limbG([0.5, 0.02, 0.04], [0.68, 0.06, 0.2], 0.035, 0.015, [1, 1, 1], 4)]);
  const sapling = coniferGeo(6, 7, 4, false); sapling.userData.keep = true;
  return (LIFE = { elkUp, elkDown, bull, raven, fern, shelf, branch, sapling });
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
      const Hh = 150 + 25 * hash(X, Z); near.push({ x, z, r: 4 + 2 * hash(i + 2, j + 9), h: Hh, low: (51.5 + 4 * hash(Z, X)) / Hh, cr: 23 + 6 * hash(X + 3, Z), y: LY(fmH(X, Z)) - 0.5 });
    }
  }
  {
    const giants = near.filter(t => !t.heart), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    const trunks = new THREE.InstancedMesh(S.trunk, barkMat(sunDir, 6, 19), giants.length);
    giants.forEach((t, k) => {
      const H = t.snag ? t.h : t.h * 0.97;
      trunks.setMatrixAt(k, M.compose(new THREE.Vector3(t.x, t.y - 0.5, t.z), Q.setFromAxisAngle(up, hash(t.x, t.z) * 6.28), new THREE.Vector3(t.r, H + 0.5, t.r)));
      { const v = 0.8 + 0.34 * hash(t.x * 2, t.z), w = hash(t.z, t.x); trunks.setColorAt(k, t.snag ? C.setRGB(0.5, 0.47, 0.45) : C.setRGB(v * (1.02 + 0.06 * w), v * (0.96 + 0.04 * w), v * (0.92 + 0.08 * w))); }   // a tint over the bark: some redder, some greyer
    });
    trunks.castShadow = true; trunks.receiveShadow = true; trunks.frustumCulled = false; group.add(trunks);
    // the crowns: conifers from about half way up, wide enough that neighbours touch; tiered close to the play, plain
    // cones out in the mist. Dark blue-green, a little lighter and yellower where the sun gets in
    const crowned = giants.filter(t => !t.snag), nearR = (coarse ? 520 : 680) ** 2, isNear = t => (t.x - cx) ** 2 + (t.z - cz) ** 2 < nearR;
    const sets = [0, 1, 2].map(v => crowned.filter(t => isNear(t) && Math.floor(hash(t.x + 9, t.z) * 3) === v)).concat([crowned.filter(t => !isNear(t))]);
    const crownMat = crownMatOf();
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
    const tr = new THREE.Mesh(S.trunk, barkMat(sunDir, 30, 34, { color: 0xd8c8bc, bumpScale: 3 }));
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
    const cm = new THREE.InstancedMesh(S.crowns[1], crownMatOf({ color: new THREE.Color(...lin([40, 60, 44])) }), 5), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
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
      for (let d = 3; d < 380; d += 3) {
        const px = x + sunDir.x * d, py = y + sunDir.y * d, pz = z + sunDir.z * d; if (py > y + 185) return false;
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
        uniforms: { uSun: { value: sunDir }, uCol: { value: new THREE.Color(1.0, 0.8, 0.5) }, uA: { value: 0.27 }, uT: { value: 0 } },
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
      // motes: specks of dust and pollen lit in each beam, drifting
      {
        const R = rngOf(hi * 31 + 7), P = [], A = [];
        pick.forEach(([x, y, z, r], k) => {
          const n = coarse ? 14 : 30, w = 2 + 3.5 * hash(r * 9, k);
          for (let i = 0; i < n; i++) { const t = 1.5 + R() * 26, s = (R() - 0.5) * w * 1.4, q = (R() - 0.5) * w * 1.4; P.push(x + sunDir.x / sunDir.y * t + s, y + t, z + sunDir.z / sunDir.y * t + q); A.push(R(), 0.6 + R() * 0.8); }
        });
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.Float32BufferAttribute(A, 2));
        const mm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
          uniforms: { uT: { value: 0 }, uMap: { value: textures().glow } },
          vertexShader: `attribute vec2 aS; uniform float uT; varying float vA;
            void main(){ vec3 p = position + vec3(sin(uT * 0.21 + aS.x * 40.0) * 0.9, sin(uT * 0.13 + aS.x * 17.0) * 1.4, cos(uT * 0.17 + aS.x * 29.0) * 0.9);
              vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z; gl_PointSize = clamp(45.0 * aS.y / max(d, 1.0), 1.0, 5.0);
              vA = (0.55 + 0.45 * sin(uT * 1.3 + aS.x * 60.0)) * smoothstep(3.0, 10.0, d) * (1.0 - smoothstep(60.0, 140.0, d)); gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform sampler2D uMap; varying float vA; void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * c.a * vA * 0.9, 1.0); }` });
        const pm = new THREE.Points(g, mm); pm.frustumCulled = false; pm.renderOrder = 3; group.add(pm);
        anims.push((dt, t) => { mm.uniforms.uT.value = t; });
      }
    }
  }

  // ---- the root plate (torn up on end, earth and roots), from the course's own boxes; the fallen giant itself is ground (its back is the 3rd's high road)
  {
    const B = batch(), earth = lin([84, 66, 48]), earthD = lin([60, 48, 36]);
    for (const o of E.walls) {
      const [x, z] = L(...o.at); if ((x - cx) ** 2 + (z - cz) ** 2 > 1500 ** 2) continue;
      if (o.kind === 'plate') {   // a disc on end: an octagon of earth with roots round its rim
        const [px, pz] = L(...o.at), r = o.rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), R = o.w / 2, y0 = LY(o.y) - 1;
        const ring = [...Array(12)].map((_, k) => { const an = k / 12 * Math.PI * 2; return [Math.cos(an) * R * (0.9 + 0.2 * hash(k, 2)), Math.sin(an) * R * 0.55 * (0.9 + 0.2 * hash(2, k)) + R * 0.5]; });
        const P = (u, h, side) => [px + ux * u + vx * side * o.l / 2, y0 + h, pz + uz * u + vz * side * o.l / 2];
        for (let k = 0; k < 12; k++) { const p = ring[k], q = ring[(k + 1) % 12]; B.quad(P(p[0], p[1], -1), P(q[0], q[1], -1), P(q[0], q[1], 1), P(p[0], p[1], 1), earthD); B.tri(P(0, R * 0.5, -1), P(q[0], q[1], -1), P(p[0], p[1], -1), earth); B.tri(P(0, R * 0.5, 1), P(p[0], p[1], 1), P(q[0], q[1], 1), earth); }
      }   // the stump's walls are drawn below as one ring, from the same heights
    }
    const m = B.mesh(vc({ flatShading: true })); if (m) group.add(m);
  }
  // ---- the hollow stump round the 8th green: a giant that snapped about 20 m up and rotted out from the inside.
  // Bark outside with moss at its foot, rotten wood inside (punky and orange-brown up high, dark and damp low down,
  // moss on the lower inside), a jagged break on top with pale splinters, and the rot's ragged edges either side of
  // the gap toward the tee. Its fallen top is ground (world.mjs TOPLOG): bark flanks and a mossy back in the paint
  const Sh = E.shell;
  if (Sh) {
    const [sx, sz] = L(...Sh.at);
    if ((sx - cx) ** 2 + (sz - cz) ** 2 < 1600 ** 2) {
      const B = batch(), Ri = Sh.r, Ro = Sh.r + Sh.t, D = Math.PI / 180;
      const bark = lin([86, 56, 42]), barkD = lin([60, 40, 31]), moss = lin([72, 90, 42]), mossD = lin([48, 62, 32]), rotL = lin([150, 98, 56]), rotM = lin([112, 72, 44]), rotD = lin([62, 42, 30]), split = lin([150, 112, 80]);
      const P = (a, r, y) => { const [x, z] = L(Sh.at[0] + Math.sin(a) * r, Sh.at[1] - Math.cos(a) * r); return [x, y, z]; };
      const gW = (a, r) => { const [x, z] = L(Sh.at[0] + Math.sin(a) * r, Sh.at[1] - Math.cos(a) * r); if (inField(x, z)) { const g = gnd(x, z); if (g !== null) return g; } return LY(Sh.y); };
      // columns every 2°: the sampled top (every 4°) in between, plus splinters standing up out of the break
      const cols = [], n = Sh.top.length;
      for (let q = 0; q <= (n - 1) * 2; q++) {
        const f = q / 2, i = Math.floor(f), t = f - i, top0 = Sh.top[i] + (Sh.top[Math.min(n - 1, i + 1)] - Sh.top[i]) * t;
        // a ragged break: a slow wander, a little roughness, and here and there a long splinter standing up (a narrow
        // spike over a few columns)
        const g6 = Math.floor(q / 5), inS = (q % 5) / 4, spike = hash(g6, 7.3) > 0.72 ? (3 + 5 * hash(g6, 1.1)) * Math.max(0, 1 - Math.abs(inS - 0.5) * 2.4) : 0;
        const a = (Sh.a0 + f * 4) * D, sp = 1.8 * Math.sin(q * 0.23 + 1.3) + 1.1 * Math.sin(q * 0.61) + (hash(q * 1.7, 2.1) - 0.5) * 0.7 + spike;
        const ridge = q % 2 ? 0.35 : -0.25;   // bark ridges and furrows
        cols.push({ a, top: top0 + sp, ro: Ro + ridge, gi: gW(a, Ri - 0.5), go: gW(a, Ro + 1) });
      }
      const BK = batchUV(), RT = batchUV(), ub = (a, r) => a * r / 5.2, ur = a => a * Ri / 4;
      for (let q = 0; q < cols.length - 1; q++) {
        const A = cols[q], C = cols[q + 1], k = q % 2 ? [1, 1, 1] : [0.86, 0.84, 0.82], yA = LY(Sh.y), mo = hash(q, 3) < 0.5 ? moss : mossD;
        const ytA = yA + A.top, ytC = yA + C.top, mA = A.go + 2 + 3 * hash(q, 9), mC = C.go + 2 + 3 * hash(q + 1, 9);
        // outside: moss round the foot, the redwood bark above (textured)
        B.quad(P(A.a, A.ro, A.go - 1.5), P(A.a, A.ro, mA), P(C.a, C.ro, mC), P(C.a, C.ro, C.go - 1.5), mo);
        BK.quad(P(A.a, A.ro, mA), P(A.a, A.ro, ytA), P(C.a, C.ro, ytC), P(C.a, C.ro, mC), k, [ub(A.a, A.ro), mA / 8], [ub(A.a, A.ro), ytA / 8], [ub(C.a, C.ro), ytC / 8], [ub(C.a, C.ro), mC / 8]);
        // inside: damp and dark low with moss, punky orange-brown higher up (brown rot, cracked into cubes), the
        // break's edge eaten lower than the bark
        const iA = A.gi + 2.5, iC = C.gi + 2.5, hA = A.gi + (ytA - A.gi) * 0.55, hC = C.gi + (ytC - C.gi) * 0.55;
        B.quad(P(C.a, Ri, C.gi - 1.5), P(C.a, Ri, iC), P(A.a, Ri, iA), P(A.a, Ri, A.gi - 1.5), mossD);
        RT.quad(P(C.a, Ri, iC), P(C.a, Ri, hC), P(A.a, Ri, hA), P(A.a, Ri, iA), [0.48, 0.44, 0.42], [ur(C.a), iC / 6], [ur(C.a), hC / 6], [ur(A.a), hA / 6], [ur(A.a), iA / 6]);
        const w = 0.5 + 0.5 * Math.sin(q * 0.17 + 2) * Math.sin(q * 0.05), st = hash(q, 5.5) < 0.2 ? 0.6 : 1, rk = [(0.55 + 0.35 * w) * st, (0.52 + 0.3 * w) * st, (0.5 + 0.22 * w) * st];   // patches of fresher, paler rot, dark streaks where water runs down
        RT.quad(P(C.a, Ri, hC), P(C.a, Ri, ytC - 1.6), P(A.a, Ri, ytA - 1.6), P(A.a, Ri, hA), rk, [ur(C.a), hC / 6], [ur(C.a), (ytC - 1.6) / 6], [ur(A.a), (ytA - 1.6) / 6], [ur(A.a), hA / 6]);
        // the break: from the bark's edge down across the wall to the rotten inside, pale splintered wood
        RT.quad(P(A.a, A.ro, ytA), P(A.a, Ri, ytA - 1.6), P(C.a, Ri, ytC - 1.6), P(C.a, C.ro, ytC), [1.05, 0.98, 0.9], [ub(A.a, Ri), 0], [ub(A.a, Ri), 0.4], [ub(C.a, Ri), 0.4], [ub(C.a, Ri), 0]);
      }
      // the rot's ragged ends either side of the gap
      for (const E2 of [cols[0], cols[cols.length - 1]]) {
        const y0 = Math.min(E2.gi, E2.go) - 1.5, yt = LY(Sh.y) + E2.top, Rm = (Ri + E2.ro) / 2, da = (E2 === cols[0] ? -1 : 1) * 1.2 * D;
        RT.quad(P(E2.a, Ri, y0), P(E2.a, Ri, yt - 1.6), P(E2.a + da, Rm, yt * 0.7 + y0 * 0.3), P(E2.a + da, Rm, y0), [0.5, 0.46, 0.44], [0, y0 / 6], [0, (yt - 1.6) / 6], [0.4, (yt * 0.7 + y0 * 0.3) / 6], [0.4, y0 / 6]);
        RT.quad(P(E2.a + da, Rm, y0), P(E2.a + da, Rm, yt * 0.7 + y0 * 0.3), P(E2.a, E2.ro, yt), P(E2.a, E2.ro, y0), [0.7, 0.64, 0.6], [0.4, y0 / 6], [0.4, (yt * 0.7 + y0 * 0.3) / 6], [0.8, yt / 6], [0.8, y0 / 6]);
      }
      { const X = textures(), bm = barkMat(sunDir, 1, 1, { vertexColors: true, side: THREE.DoubleSide }), rm = new THREE.MeshStandardMaterial({ map: X.rot, vertexColors: true, roughness: 0.97, side: THREE.DoubleSide });
        for (const m of [BK.mesh(bm), RT.mesh(rm)]) if (m) group.add(m); }
      const m = B.mesh(vc({ flatShading: true, side: THREE.DoubleSide })); if (m) group.add(m);
    }
  }

  // ---- the Stair: each raised tee a deck at the end of a limb grown out of the stair tree, the treads spiralling
  // up the trunk between them
  {
    const wood = barkMat(sunDir, 2, 1), moss = new THREE.MeshStandardMaterial({ color: 0x6b7d3a, roughness: 0.95 }), plain = new THREE.MeshStandardMaterial({ color: 0x6a4c36, roughness: 0.9 });
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
      const m = new THREE.Mesh(g, [moss, plain]); m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    for (const St of E.stairs) {
      const [sx, sz] = L(...St.at), R = St.r + 0.9, dth = 1.25 / R, foot = LY(St.foot), top = LY(St.top), n = Math.ceil((top - foot) / 0.42);
      const im = new THREE.InstancedMesh(S.step, plain, n), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < n; k++) { const th = k * dth; im.setMatrixAt(k, M.compose(new THREE.Vector3(sx + R * Math.cos(th), foot + 0.3 + k * 0.42, sz + R * Math.sin(th)), Q.setFromAxisAngle(up, -th), new THREE.Vector3(1.8, 0.3, 1.4))); }
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im);
    }
  }
  // ---- art pass 1: the forest floor's life. Sword ferns on the fern beds and the litter, fallen branches, bracket
  // fungi on the trunks and the stump, young hemlocks (on the logs and thin on the floor), elk and deer, ravens. All
  // drawn only, kept 4 m off anything mown, sanded or wet and off the tees (the emitter keeps the herds, the saplings
  // and the birds off every line)
  {
    const X = textures(), LS = lifeShapes(), M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), Cc = new THREE.Color(), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const MOWN = new Set(['fairway', 'green', 'fringe', 'tee', 'sand', 'water', 'void']);
    const tees = [...Object.values(hole.tees || {}), ...(hole.tips ? [hole.tips.tee] : [])], plants = hole.plants || [];
    const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]];
    const clear = (x, z, d) => { if (!inField(x, z) || MOWN.has(T.surfaceAt(x, z))) return false; for (const [a, b] of ring) { const px = x + a * d, pz = z + b * d; if (!inField(px, pz) || MOWN.has(T.surfaceAt(px, pz))) return false; } return true; };
    const offTrunk = (x, z, pad) => !plants.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < ((p.tr || 3) + pad) ** 2) && !(T.rocks || []).some(r => r.type === 'box' && (r.x - x) ** 2 + (r.z - z) ** 2 < ((r.w || 4) / 2 + 2) ** 2);
    const offTee = (x, z, d) => !tees.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < d * d);
    const R = rngOf(hi * 97 + 13);
    if (Fd) {
      const W0 = Fd.x0, W1 = Fd.x0 + (Fd.nx - 1) * Fd.cell, Z0 = Fd.z0, Z1 = Fd.z0 + (Fd.nz - 1) * Fd.cell, wt = { 1: 1, 0: 0.5, 2: 0.35, 3: 0.15 };
      // sword ferns: clumps of arching fronds, thickest on the fern beds
      const fe = [], want = coarse ? 1400 : 4000;
      for (let i = 0; i < want * 6 && fe.length < want; i++) {
        const x = W0 + R() * (W1 - W0), z = Z0 + R() * (Z1 - Z0), m = matAt(hole, x, z);
        if (R() > (wt[m] || 0) || !clear(x, z, 4) || !offTee(x, z, 10) || !offTrunk(x, z, 0.6)) continue;
        const y = gnd(x, z); if (y === null) continue;
        fe.push([x, y, z, 1.1 + R() * 0.9, R() * 6.28, R()]);
      }
      if (fe.length) {
        const im = new THREE.InstancedMesh(LS.fern, new THREE.MeshStandardMaterial({ map: X.frond, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.88, envMapIntensity: 0.4, color: 0xffffff }), fe.length);
        fe.forEach(([x, y, z, s, r, c], k) => { im.setMatrixAt(k, M4.compose(V3(x, y - 0.05, z), Q4.setFromAxisAngle(UP, r), V3(s, s * (0.85 + 0.3 * c), s))); im.setColorAt(k, Cc.setRGB(0.62 + 0.25 * c, 0.7 + 0.25 * c, 0.5 + 0.15 * c)); });
        im.receiveShadow = true; im.castShadow = false; group.add(im);
      }
      // fallen branches on the litter and the fern beds, greying where they've lain longest
      const br = [], wantB = coarse ? 160 : 340;
      for (let i = 0; i < wantB * 8 && br.length < wantB; i++) {
        const x = W0 + R() * (W1 - W0), z = Z0 + R() * (Z1 - Z0), m = matAt(hole, x, z);
        if (m > 2 || !clear(x, z, 4) || !offTee(x, z, 12) || !offTrunk(x, z, 1)) continue;
        const y = gnd(x, z); if (y === null) continue;
        const len = 1.4 + 4.5 * R() ** 2, a = R() * 6.28, y2 = gnd(x + Math.cos(a) * len, z - Math.sin(a) * len) ?? y;
        br.push([x, y + 0.04, z, len, a, Math.atan2(y2 - y, len), R()]);
      }
      if (br.length) {
        const im = new THREE.InstancedMesh(LS.branch, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), br.length), E3 = new THREE.Euler();
        br.forEach(([x, y, z, len, a, tilt, c], k) => { const th = 1 + len * 0.28; im.setMatrixAt(k, M4.compose(V3(x, y, z), Q4.setFromEuler(E3.set(0, a, tilt, 'YZX')), V3(len, th, th))); im.setColorAt(k, Cc.setRGB(...lin([92 + 40 * c, 72 + 34 * c, 56 + 30 * c]))); });
        im.castShadow = true; im.receiveShadow = true; group.add(im);
      }
    }
    // bracket fungi: shelves on the shady side of the trunks near the hole (more on the snags), stacked in twos and
    // threes, and on the hollow stump's bark
    {
      const sh = [], away = sunDir ? Math.atan2(-sunDir.z, -sunDir.x) : 0, cap = coarse ? 400 : 900;
      const put = (x, y, z, dx, dz, s, c) => sh.push([x, y, z, Math.atan2(-dz, dx), s, c]);
      for (const t of near) {
        if (sh.length > cap) break;
        if (t.heart || (t.x - cx) ** 2 + (t.z - cz) ** 2 > 420 ** 2) continue;
        const hr = hash(t.x * 1.7, t.z * 2.3), n = t.snag ? 5 + Math.floor(4 * hr) : hr < 0.5 ? 0 : 1 + Math.floor(3 * hash(t.z, t.x * 3));
        for (let g = 0; g < n; g++) {
          const a = away + (hash(t.x + g, t.z * 1.3) - 0.5) * 2.4, hm = 0.9 + (t.snag ? 18 : 6) * hash(t.z + g * 2, t.x) ** 1.5, H = t.h;
          const rr = t.r * (1 - 0.58 * hm / H) * (1 + 0.55 * Math.max(0, 1 - hm / (0.06 * H)) ** 2) * 0.97, dx = Math.cos(a), dz = Math.sin(a), s = 0.3 + 0.5 * hash(g, t.x), c = hash(t.z * 3, g);
          for (let q = 0, m = 1 + Math.floor(3 * hash(g * 2, t.z)); q < m; q++) put(t.x + dx * rr, t.y + hm + q * 0.22 * s / 0.4, t.z + dz * rr, dx, dz, s * (1 - q * 0.18), c);
        }
      }
      const Sh = E.shell;
      if (Sh) for (let i = 0; i < 18; i++) {
        const a = (Sh.a0 + 6 + (Sh.a1 - Sh.a0 - 12) * hash(i, 4.4)) * Math.PI / 180, Ro = Sh.r + Sh.t + 0.4, [px, pz] = L(Sh.at[0] + Math.sin(a) * Ro, Sh.at[1] - Math.cos(a) * Ro), [qx, qz] = L(...Sh.at);
        const dx = px - qx, dz = pz - qz, d = Math.hypot(dx, dz); if ((px - cx) ** 2 + (pz - cz) ** 2 > 900 ** 2) break;
        const g0 = inField(px, pz) ? gnd(px, pz) : null, y = (g0 ?? LY(Sh.y)) + 1.5 + 7 * hash(i, 9.1);
        put(px, y, pz, dx / d, dz / d, 0.4 + 0.5 * hash(9, i), hash(i, 2));
      }
      if (sh.length) {
        const im = new THREE.InstancedMesh(LS.shelf, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), sh.length);
        sh.forEach(([x, y, z, r, s, c], k) => { im.setMatrixAt(k, M4.compose(V3(x, y, z), Q4.setFromAxisAngle(UP, r), V3(s, s * 0.9, s))); im.setColorAt(k, c < 0.14 ? Cc.setRGB(1.25, 0.9, 0.3) : Cc.setRGB(0.85 + 0.25 * c, 0.85 + 0.2 * c, 0.82 + 0.2 * c)); });   // a few sulphur shelves
        im.castShadow = false; im.receiveShadow = true; group.add(im);
      }
    }
    const A = E.art;
    if (A) {
      const nearW = (X0, Z0, r) => { const [x, z] = L(X0, Z0); return (x - cx) ** 2 + (z - cz) ** 2 < r * r ? [x, z] : null; };
      // young hemlocks: soft, drooping, lighter than the old crowns
      const sp = A.sap.map(([X0, Z0, y, h]) => { const p = nearW(X0, Z0, coarse ? 900 : 1200); return p ? [p[0], LY(y), p[1], h] : null; }).filter(Boolean);
      if (sp.length) {
        const im = new THREE.InstancedMesh(LS.sapling, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), sp.length);
        sp.forEach(([x, y, z, h], k) => { const c = hash(x, z); im.setMatrixAt(k, M4.compose(V3(x, y + 0.15, z), Q4.setFromAxisAngle(UP, c * 6.28), V3(h * 0.3, h, h * 0.3))); im.setColorAt(k, Cc.setRGB(...lin([(34 + 14 * c), (54 + 16 * c), (36 + 8 * c)]))); });
        im.castShadow = true; im.receiveShadow = true; group.add(im);
      }
      // elk and deer: grazing or heads up; now and then one looks up, or goes back to grazing (the bull stands watch)
      const herd = A.herd.map(([X0, Z0, y, rot, kind, pose]) => { const p = nearW(X0, Z0, 1600); return p ? { x: p[0], z: p[1], y: LY(y), rot: rot - a, kind, pose: kind === 1 ? 0 : pose } : null; }).filter(Boolean);
      if (herd.length) {
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }), n = herd.length;
        const up = new THREE.InstancedMesh(LS.elkUp, mat, n), dn = new THREE.InstancedMesh(LS.elkDown, mat, n), bl = new THREE.InstancedMesh(LS.bull, mat, n), Z = new THREE.Matrix4().makeScale(0, 0, 0);
        const tint = [[1, 1, 1], [1.05, 0.98, 0.95], [1.12, 0.92, 0.82], [1.18, 0.95, 0.8]], size = [1, 1.12, 0.68, 0.48];
        const set = (k, h) => {
          const m = M4.compose(V3(h.x, h.y, h.z), Q4.setFromAxisAngle(UP, h.rot), V3(size[h.kind], size[h.kind], size[h.kind]));
          up.setMatrixAt(k, h.kind !== 1 && h.pose === 0 ? m : Z); dn.setMatrixAt(k, h.kind !== 1 && h.pose === 1 ? m : Z); bl.setMatrixAt(k, h.kind === 1 ? m : Z);
        };
        herd.forEach((h, k) => { set(k, h); for (const im of [up, dn, bl]) im.setColorAt(k, Cc.setRGB(...tint[h.kind])); });
        for (const im of [up, dn, bl]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; group.add(im); }
        let next = 3;
        anims.push((dt, t) => {
          if (t < next) return; next = t + 2.5 + 5 * Math.random();
          const k = Math.floor(Math.random() * n), h = herd[k]; if (h.kind === 1) return;
          h.pose = 1 - h.pose; if (h.pose === 0) h.rot += (Math.random() - 0.5) * 0.9;
          set(k, h); for (const im of [up, dn, bl]) im.instanceMatrix.needsUpdate = true;
        });
      }
      // ravens wheeling under the roof over the openings, flapping a little and gliding
      const birds = [];
      for (const [X0, Z0, y, r, n] of A.birds) { const p = nearW(X0, Z0, 1500); if (p) for (let i = 0; i < n; i++) birds.push({ x: p[0], z: p[1], y: LY(y) + (i % 2) * 4, r: r * (0.75 + 0.3 * hash(i, r)), ph: i / n * 6.28 + hash(r, i), w: (i % 2 ? -1 : 1) * (7 + 2 * hash(i, 3)) / r }); }
      if (birds.length) {
        const im = new THREE.InstancedMesh(LS.raven, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }), birds.length), E3 = new THREE.Euler();
        const place = t => birds.forEach((b, k) => {
          const an = b.ph + t * b.w, x = b.x + Math.cos(an) * b.r, z = b.z + Math.sin(an) * b.r, y = b.y + 3 * Math.sin(t * 0.3 + b.ph);
          const sg = Math.sign(b.w), hd = Math.atan2(sg * Math.sin(an), -sg * Math.cos(an)), fl = Math.sin(t * 9 + b.ph * 5), flap = Math.sin(t * 0.7 + b.ph) > 0.2 ? fl : 0.65;
          im.setMatrixAt(k, M4.compose(V3(x, y, z), Q4.setFromEuler(E3.set(0, hd, 0.35 * sg, 'YXZ')), V3(1.6, 1.6 * flap, 1.6)));
        });
        place(0); im.castShadow = false; im.frustumCulled = false; group.add(im);
        anims.push((dt, t) => { place(t); im.instanceMatrix.needsUpdate = true; });
      }
    }
  }
  return { trees: [], anims };
}
