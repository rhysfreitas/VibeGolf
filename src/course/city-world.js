// The Reclaim's city (global THREE): what COURSE.city holds (world space) put into a hole's frame (hole.frame) and
// drawn: ruined buildings with broken tops, blown-out floors, ivy hanging off them and vines up their walls, trees
// on their roofs; the El; the fallen towers and their chunks; stopped cars and cabs; poles, cranes and the bridge;
// water and the river; the chasm walls; the street out to the mist. One merged mesh per material, so a hole is a
// handful of draw calls. The ball's side of it (boxes, wedges, trees) is in the course module and terrain.js.
import { rng } from './noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// facades, each 4 bays by 4 floors, made once. Brick: a tall window a bay with a stone lintel and sill, soot and
// moss; concrete towers: spandrel bands and ribbon windows, water stains down the panels. Both are pale and nearly
// neutral so each building's tone (vertex colour) gives it its brick or stone. uv near (0, 0) is plain white, for
// roofs, rubble and steel.
const TILE = { brick: [12, 14], conc: [16, 15.2] };   // metres a texture spans (4 bays, 4 floors)
function facadeTexture(kind) {
  const S = 128, N = 4, cv = document.createElement('canvas'); cv.width = cv.height = S * N;
  const g = cv.getContext('2d'), R = rng(kind === 'brick' ? 11 : 23), W = cv.width;
  if (kind === 'brick') {
    g.fillStyle = '#d9cfc6'; g.fillRect(0, 0, W, W);
    for (let y = 0; y < W; y += 3) for (let x = (y / 3) % 2 ? 0 : 4; x < W; x += 8) {   // brick by brick, a little uneven
      const v = 200 + R() * 40; g.fillStyle = `rgb(${v},${v * 0.93},${v * 0.88})`; g.fillRect(x, y, 7, 2);
    }
  } else {
    g.fillStyle = '#d6d4cf'; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 2600; i++) { const v = 180 + R() * 70; g.fillStyle = `rgba(${v},${v},${v * 0.98},0.35)`; g.fillRect(R() * W, R() * W, 2 + R() * 6, 2 + R() * 6); }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i * S, y = j * S, r = R();
    const glass = kind === 'brick' ? (r < 0.2 ? '#101214' : r < 0.55 ? '#2a2f33' : r < 0.85 ? '#3d454a' : '#5a6468') : (r < 0.15 ? '#1c1f21' : r < 0.6 ? '#4a5257' : '#68757b');
    if (kind === 'brick') {
      const wx = x + S * 0.3, wy = y + S * 0.18, ww = S * 0.4, wh = S * 0.56;
      g.fillStyle = 'rgba(40,30,25,0.18)'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      if (R() < 0.12) { g.fillStyle = '#7a6650'; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 1; k < 5; k++) g.fillRect(wx, wy + wh * k / 5, ww, 2); } // boarded up
      else { g.fillStyle = glass; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(200,200,190,0.5)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); g.fillRect(wx, wy + wh * 0.45, ww, 2); }
      g.fillStyle = '#f2ece2'; g.fillRect(wx - 5, wy - 9, ww + 10, 7); g.fillRect(wx - 4, wy + wh, ww + 8, 5);    // lintel, sill
      g.fillStyle = 'rgba(30,25,20,0.16)'; g.fillRect(wx + R() * ww, wy + wh + 5, 3 + R() * 5, S * (0.1 + R() * 0.3)); // soot run off the sill
      if (j === 0) { g.fillStyle = '#efe8dc'; g.fillRect(x, y, S, 6); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, y + 6, S, 2); } // a stone band every 4 floors
    } else {
      for (const ux of [0.1, 0.55]) { const wx = x + S * ux, wy = y + S * 0.2, ww = S * 0.35, wh = S * 0.48;     // two windows a bay, set in the panel
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        const r2 = R(); g.fillStyle = r2 < 0.15 ? '#0e1011' : r2 < 0.55 ? '#3b4246' : '#59646a'; g.fillRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(205,205,200,0.45)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
      g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x, y + S * 0.86, S, 3); g.fillRect(x + S - 2, y, 2, S);          // panel joints
      if (R() < 0.08) { g.fillStyle = 'rgba(60,58,54,0.85)'; g.fillRect(x + S * R() * 0.5, y + S * R() * 0.5, S * 0.5, S * 0.45); } // a panel gone
    }
    if (R() < 0.35) { const gr = g.createLinearGradient(0, y + S * 0.6, 0, y + S * 1.6);                          // water stains
      gr.addColorStop(0, 'rgba(40,38,30,0.22)'); gr.addColorStop(1, 'rgba(40,38,30,0)'); g.fillStyle = gr; g.fillRect(x + R() * S, y + S * 0.6, 4 + R() * 14, S); }
    if (R() < 0.3) { g.fillStyle = `rgba(${70 + R() * 30},${100 + R() * 30},${50 + R() * 20},0.55)`;               // moss and weeds on the ledges
      for (let k = 0; k < 14; k++) g.fillRect(x + R() * S, y + S * (kind === 'brick' ? 0.78 : 0.56) + R() * 6, 3 + R() * 6, 2 + R() * 5); }
  }
  g.fillStyle = '#ffffff'; g.fillRect(0, W - 8, 8, 8);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  return t;
}
// ivy and grass: leaves and blades on a clear ground, cut out with alphaTest
function leafTexture(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(kind === 'ivy' ? 31 : 37);
  if (kind === 'ivy') {   // tiles seamlessly: the sheets' own outlines give the ragged edges
    const dot = (x, y, f) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) f(x + ox, y + oy); };
    g.fillStyle = '#26381c'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2800; i++) { const x = R() * S, y = R() * S, v = R(), rx2 = 3 + R() * 5, ry2 = 2.5 + R() * 4, rt = R() * 3;
      g.fillStyle = `rgb(${44 + v * 60},${72 + v * 70},${30 + v * 34})`; dot(x, y, (px, py) => { g.beginPath(); g.ellipse(px, py, rx2, ry2, rt, 0, Math.PI * 2); g.fill(); }); }
    g.globalCompositeOperation = 'destination-out';                    // gaps between the leaves
    for (let i = 0; i < 70; i++) { const x = R() * S, y = R() * S, r = 2 + R() * 5; dot(x, y, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill(); }); }
    g.globalCompositeOperation = 'source-over';
  } else {
    for (let i = 0; i < 70; i++) {
      const x0 = S * (0.15 + R() * 0.7), lean = (R() - 0.5) * 90, h = S * (0.45 + R() * 0.55), v = R();
      g.strokeStyle = `rgb(${90 + v * 70},${110 + v * 60},${50 + v * 30})`; g.lineWidth = 2 + R() * 3;
      g.beginPath(); g.moveTo(x0, S); g.quadraticCurveTo(x0 + lean * 0.3, S - h * 0.6, x0 + lean, S - h); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
  return t;
}
let TEX = null;
const PLAIN = [0.004, 0.004];

// a growing set of triangles with colour and uv, made into one mesh
function batch() {
  const pos = [], col = [], uv = [];
  const tri = (a, b, c, k, ta = PLAIN, tb = PLAIN, tc = PLAIN) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k[0], k[1], k[2]); uv.push(...ta, ...tb, ...tc); };
  const quad = (a, b, c, d, k, ua, ub, uc, ud) => { tri(a, b, c, k, ua, ub, uc); tri(a, c, d, k, ua, uc, ud); };
  const mesh = (mat, shadow = true) => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  return { tri, quad, mesh };
}
const lin = c => c.map(v => Math.pow(v / 255, 2.2));
// an oriented box from a to b ([x, y, z] ends), w across (horizontal), t thick
function prism(B, a, b, w, t, k, ribs = false) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map(v => v / L);
  let n = [-u[2], 0, u[0]]; const nl = Math.hypot(n[0], n[2]) || 1; n = [n[0] / nl, 0, n[2] / nl];
  const up = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]; if (up[1] < 0) up.forEach((v, i) => up[i] = -v);
  const C = (p, sa, sb) => [p[0] + n[0] * w / 2 * sa + up[0] * t / 2 * sb, p[1] + n[1] * w / 2 * sa + up[1] * t / 2 * sb, p[2] + n[2] * w / 2 * sa + up[2] * t / 2 * sb];
  const A = [C(a, -1, -1), C(a, 1, -1), C(a, 1, 1), C(a, -1, 1)], Bq = [C(b, -1, -1), C(b, 1, -1), C(b, 1, 1), C(b, -1, 1)];
  const uvs = (i, s) => (ribs ? [i * w / TILE.conc[0], s * L / TILE.conc[1]] : PLAIN);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, sh = 0.85 + 0.15 * (i % 2); B.quad(A[i], A[j], Bq[j], Bq[i], k.map(v => v * sh), uvs(0, 0), uvs(1, 0), uvs(1, 1), uvs(0, 1)); }
  B.quad(A[3], A[2], A[1], A[0], k.map(v => v * 0.8)); B.quad(Bq[0], Bq[1], Bq[2], Bq[3], k.map(v => v * 0.8));
}
const boxAt = (B, x, z, w, d, rot, y0, y1, k) => {   // an axis box turned by rot (yaw from +x toward +z)
  const c = Math.cos(rot), s = Math.sin(rot), P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c - v * s, z + u * s + v * c]);
  footBox(B, P, y0, y1, k);
};
function footBox(B, P, y0, y1, k) {
  const ctr = [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; wall(B, a, b, ctr, y0, [[0, y1], [1, y1]], k, null); }
  B.quad([P[0][0], y1, P[0][1]], [P[3][0], y1, P[3][1]], [P[2][0], y1, P[2][1]], [P[1][0], y1, P[1][1]], k.map(v => v * 0.85));
}
// a wall from a to b (footprint points), outward away from ctr, from y0 up to a broken skyline
// top: [[t (0..1 along), y], ...]
function wall(B, a, b, ctr, y0, top, k, tile = null, lean = null) {
  const out = ((a[0] + b[0]) / 2 - ctr[0]) * (b[1] - a[1]) - ((a[1] + b[1]) / 2 - ctr[1]) * (b[0] - a[0]) > 0;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const P = (t, y) => { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return lean ? [x + lean[0] * (y - y0), y, z + lean[1] * (y - y0)] : [x, y, z]; };
  const U = (t, y) => (tile ? [t * len / tile[0], (y - y0) / tile[1]] : PLAIN);
  for (let i = 0; i < top.length - 1; i++) {
    const [t0, h0] = top[i], [t1, h1] = top[i + 1];
    const q = [P(t0, y0), P(t1, y0), P(t1, h1), P(t0, h0)], u = [U(t0, y0), U(t1, y0), U(t1, h1), U(t0, h0)];
    if (out) B.quad(q[0], q[1], q[2], q[3], k, u[0], u[1], u[2], u[3]); else B.quad(q[1], q[0], q[3], q[2], k, u[1], u[0], u[3], u[2]);
  }
}

export function buildCity(hole, T, box, W, hi, { group, coarse, sunDir = null, beams = false }) {
  if (!TEX) TEX = { brick: facadeTexture('brick'), conc: facadeTexture('conc'), ivy: leafTexture('ivy'), grass: leafTexture('grass') };
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base, LR = r => r - a;   // world height / yaw -> this hole's
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  // double-sided: every wall shows from outside whichever way its footprint runs
  const std = o => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, ...o });
  const mat = std({ map: TEX.brick }), concMat = std({ map: TEX.conc, roughness: 0.85 }), plainMat = std({ roughness: 0.9 });
  const ivyMat = std({ map: TEX.ivy, alphaTest: 0.5, roughness: 1 });
  const Bw = batch(), Bc = batch(), Bp = batch(), Bg = batch();
  const trees = [], blobs = [], anims = [];
  const far = coarse ? 1100 : 1600, detail = coarse ? 380 : 620;
  const steelDark = lin([46, 42, 38]);
  // the hole's own lines of play, to keep furniture and animals off them
  const lines = [Object.values(hole.tees), hole.line, [hole.pin]];
  const offLine = (x, z, d) => { for (const Lp of lines) for (let i = 0; i < Lp.length; i++) { const p = Lp[i], q = Lp[Math.min(i + 1, Lp.length - 1)], dx = q[0] - p[0], dz = q[1] - p[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / l2)); if (Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t) < d) return false; } return true; };

  // ivy over a stretch of wall: a sheet just off the face, from y0 up to a ragged top (ys: heights along it)
  const ivySheet = (at, t0, t1, ys, y0, len, k) => {
    const n = ys.length - 1;
    for (let j = 0; j < n; j++) { const ta = t0 + (t1 - t0) * j / n, tb = t0 + (t1 - t0) * (j + 1) / n, ua = ta * len / 5, ub = tb * len / 5;
      Bg.quad(at(ta, y0), at(tb, y0), at(tb, ys[j + 1]), at(ta, ys[j]), k, [ua, 0], [ub, 0], [ub, (ys[j + 1] - y0) / 5], [ua, (ys[j] - y0) / 5]); }
  };

  // ---- buildings: brick walk-ups and stone blocks low down, concrete towers above them
  const BRICK = [[128, 86, 72], [112, 78, 64], [98, 74, 64], [140, 120, 100], [160, 150, 132], [120, 94, 78]].map(lin);
  const CONC = [[150, 148, 142], [134, 134, 130], [146, 140, 130], [122, 122, 120]].map(lin);
  for (const b of W.bldg) {
    const P = b.p.map(p => L(...p)), c = [P.reduce((s, p) => s + p[0], 0) / 4, P.reduce((s, p) => s + p[1], 0) / 4];
    if (!near(c[0], c[1], far)) continue;
    // stand on this hole's ground where it is under the building (nothing floats)
    let y0 = LY(b.y); if (c[0] > box.x0 && c[0] < box.x1 && c[1] > box.z0 && c[1] < box.z1) for (const q of [...P, c]) { const g = T.groundAt(q[0], q[1]); if (g !== null && g - 1 < y0) y0 = g - 1; }
    const R = rng(b.s * 7 + 3), top = y0 + b.h, d0 = Math.hypot(c[0] - cx, c[1] - cz), rich = d0 < detail;
    const brick = b.tower || (b.h < 60 ? R() < 0.72 : R() < 0.3), tone = (brick ? BRICK : CONC)[Math.floor(R() * (brick ? BRICK.length : CONC.length))];
    const tile = brick ? TILE.brick : TILE.conc, BW = brick ? Bw : Bc;   // every facade textured (same cost); the detail is ivy and the rest
    if (b.b === 3) { // a collapsed block: a heap of rubble
      footBox(Bp, P, y0, y0 + b.h * 0.5, tone.map(v => v * 0.8));
      for (let k = 0; k < 6; k++) prism(Bp, [c[0] + (R() - 0.5) * 20, y0 + b.h * 0.4, c[1] + (R() - 0.5) * 20], [c[0] + (R() - 0.5) * 24, y0 + b.h * (0.5 + R() * 0.5), c[1] + (R() - 0.5) * 24], 4 + R() * 6, 2 + R() * 2, tone.map(v => v * 0.9));
      continue;
    }
    const lean = b.lean ? (() => { const [lx, lz] = [b.lean[0] * rx + b.lean[1] * rz, -(b.lean[0] * fx + b.lean[1] * fz)], t = Math.tan(b.lean[2] * Math.PI / 180); return [lx * t, lz * t]; })() : null;
    const lo = y0 + (b.open || 0);
    // the broken skyline of each wall
    const sky = P.map((p, i) => {
      const q = P[(i + 1) % 4], len = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(len / 7)), e = [];
      for (let k = 0; k <= n; k++) { let y = top; if (b.b === 2) y = top - (6 + 22 * R()) * (0.4 + 0.6 * Math.abs(Math.sin(k / n * 3 + i))); else if (b.b === 1) y = top - (R() < 0.35 ? 3 + R() * Math.min(18, b.h * 0.35) : R() * 3); e.push([k / n, y]); }
      return e;
    });
    for (let i = 0; i < 4; i++) sky[(i + 1) % 4][0][1] = sky[i].at(-1)[1];
    for (let i = 0; i < 4; i++) wall(BW, P[i], P[(i + 1) % 4], c, lo, sky[i], tone, tile, lean);
    // the roof, at the lowest of the broken top (trees grow out of it); a cornice round an unbroken brick top
    const rTop = Math.min(...sky.flat().map(e => e[1])) - 0.5, sh = p => (lean ? [p[0] + lean[0] * (rTop - y0), p[1] + lean[1] * (rTop - y0)] : p);
    const Rp = P.map(sh);
    Bp.quad([Rp[0][0], rTop, Rp[0][1]], [Rp[3][0], rTop, Rp[3][1]], [Rp[2][0], rTop, Rp[2][1]], [Rp[1][0], rTop, Rp[1][1]], tone.map(v => v * 0.6));
    if (rich && brick && !b.b && !lean) for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4], o = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]], ol = Math.hypot(...o) || 1;
      prism(Bp, [p[0] + o[0] / ol * 0.4, top - 0.4, p[1] + o[1] / ol * 0.4], [q[0] + o[0] / ol * 0.4, top - 0.4, q[1] + o[1] / ol * 0.4], 1.2, 0.8, lin([214, 206, 192])); }
    if (b.open) { // the blown-out lobby: the floor slab above it, seen from below, on its columns
      Bp.quad([P[0][0], lo, P[0][1]], [P[1][0], lo, P[1][1]], [P[2][0], lo, P[2][1]], [P[3][0], lo, P[3][1]], tone.map(v => v * 0.45));
    }
    if (b.tower) { // the clock tower on the clubhouse, with its pyramid roof
      const w = b.tower.w / 2, tp = [[c[0] - w, c[1] - w], [c[0] + w, c[1] - w], [c[0] + w, c[1] + w], [c[0] - w, c[1] + w]].map(sh), yb = rTop, yt = rTop + b.tower.h;
      for (let i = 0; i < 4; i++) wall(Bw, tp[i], tp[(i + 1) % 4], sh(c), yb, [[0, yt], [1, yt]], tone, TILE.brick, lean);
      const ap = sh(c), apex = [ap[0] + (lean ? lean[0] * b.tower.h : 0), yt + 9, ap[1] + (lean ? lean[1] * b.tower.h : 0)], k2 = lin([110, 116, 112]);
      const tt = tp.map(p => [p[0] + (lean ? lean[0] * b.tower.h : 0), yt, p[1] + (lean ? lean[1] * b.tower.h : 0)]);
      for (let i = 0; i < 4; i++) Bp.tri(tt[(i + 1) % 4], tt[i], apex, k2);
    }
    if (!rich) continue;
    // ivy: climbing sheets from the street up, sheets hanging off the broken top; shrubs at the foot; fire escapes
    let escape = brick && !b.b && !lean && b.h > 12 && R() < 0.55 ? Math.floor(R() * 4) : -1;
    for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4], len = Math.hypot(q[0] - p[0], q[1] - p[1]), ox = (q[1] - p[1]) / len, oz = -(q[0] - p[0]) / len;
      const sg = ((p[0] + q[0]) / 2 - c[0]) * ox + ((p[1] + q[1]) / 2 - c[1]) * oz > 0 ? 1 : -1;
      const atO = off => (t, y) => { const x = p[0] + (q[0] - p[0]) * t + ox * off * sg, z = p[1] + (q[1] - p[1]) * t + oz * off * sg; return lean ? [x + lean[0] * (y - y0), y, z + lean[1] * (y - y0)] : [x, y, z]; };
      const at = atO(0.3), e = sky[i], yAt = t => e[Math.min(e.length - 1, Math.round(t * (e.length - 1)))][1];
      const gk = () => lin([[150, 175, 130], [130, 160, 112], [170, 186, 140]][Math.floor(R() * 3)]);
      // climbing: from the foot, up to a ragged top
      const nc = Math.ceil(len / 16 * (b.v ? 1.5 : 0.7));
      for (let m = 0; m < nc; m++) {
        const w = Math.min(0.6, (4 + R() * 12) / len), t0 = R() * (1 - w), hmax = Math.min(yAt(t0 + w / 2) - lo, 6 + Math.pow(R(), 1.6) * (b.v ? 40 : 22));
        if (hmax < 3) continue;
        const ys = [0, 1, 2, 3, 4].map(j => lo + hmax * (j === 0 || j === 4 ? 0.3 + R() * 0.3 : 0.6 + R() * 0.4));
        ivySheet(at, t0, t0 + w, ys, lo, len, gk());
      }
      // hanging off the broken top
      const nm = Math.ceil(len / 14 * (b.v ? 1.2 : b.b ? 0.6 : 0.3));
      for (let m = 0; m < nm; m++) {
        const w = Math.min(0.4, (3 + R() * 8) / len), t0 = R() * (1 - w), yt = yAt(t0 + w / 2) - 0.3, hang = 4 + R() * Math.min(24, (yt - lo) * 0.5);
        const at2 = atO(0.35), n = 4;
        for (let j = 0; j < n; j++) { const ta = t0 + w * j / n, tb = t0 + w * (j + 1) / n, ya = yt - hang * (j === 0 ? 0.3 : 0.5 + R() * 0.5), yb = yt - hang * (j === n - 1 ? 0.3 : 0.5 + R() * 0.5);
          Bg.quad(at2(ta, ya), at2(tb, yb), at2(tb, yt), at2(ta, yt), gk(), [ta * len / 5, 0], [tb * len / 5, 0], [tb * len / 5, (yt - yb) / 5], [ta * len / 5, (yt - ya) / 5]); }
      }
      if (d0 < detail * 0.7) for (let k = 0; k < len / 8; k++) { const t = R(); blobs.push([p[0] + (q[0] - p[0]) * t + ox * sg * 2, y0 + 0.4, p[1] + (q[1] - p[1]) * t + oz * sg * 2, 1.2 + R() * 2]); }
      // a fire escape down one long wall of a brick walk-up: landings each floor, stairs between, a drop ladder
      if (i === escape && len > 12 && d0 < detail * 0.8) {
        const t0 = 0.3 + R() * 0.3, tw = 3.6 / len, fl = 3.5, nF = Math.floor((rTop - lo - 4) / fl);
        for (let f = 1; f <= nF; f++) { const y = lo + f * fl;
          const a0 = atO(0.1)(t0, y), a1 = atO(0.1)(t0 + tw, y), b0 = atO(1.3)(t0, y), b1 = atO(1.3)(t0 + tw, y);
          Bp.quad(a0, a1, b1, b0, steelDark); Bp.quad(b0, b1, [b1[0], y + 1, b1[2]], [b0[0], y + 1, b0[2]], steelDark.map(v => v * 0.8)); // landing, rail
          if (f < nF) { const s0 = atO(0.8)(f % 2 ? t0 : t0 + tw, y), s1 = atO(0.8)(f % 2 ? t0 + tw : t0, y + fl); prism(Bp, s0, s1, 0.8, 0.15, steelDark); }
        }
        if (nF > 0) { const l0 = atO(0.8)(t0 + tw * 0.5, lo + 2.2), l1 = atO(0.8)(t0 + tw * 0.5, lo + fl); prism(Bp, l0, l1, 0.5, 0.08, steelDark); }
        escape = -1;
      }
    }
    if (b.b && !b.tower) for (let k = 0, n = Math.floor(R() * 3.2); k < n; k++) {
      const u = 0.2 + R() * 0.6, v = 0.2 + R() * 0.6, x = P[0][0] + (P[1][0] - P[0][0]) * u + (P[3][0] - P[0][0]) * v, z = P[0][1] + (P[1][1] - P[0][1]) * u + (P[3][1] - P[0][1]) * v;
      trees.push({ x, y: rTop, z, s: 0.8 + R() * 1.2, type: 'oak', r: R(), deco: true });
    }
  }
  // ---- the El: deck, girders, columns, and a carriage hanging off a broken end
  const steel = lin([98, 88, 78]);
  for (const e of W.el) {
    const P = e.p.map(p => L(...p)); if (!P.some(p => near(p[0], p[1], far))) continue;
    const y = LY(e.y);
    let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const pt = s => { for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (s <= l || i === P.length - 1) { const t = s / l; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; } s -= l; } };
    for (let s = 0; s < len - 0.1; s += 12) {
      const A = pt(s), Bq = pt(Math.min(len, s + 12)), last = e.broken && s + 12 >= len - 0.1;
      prism(Bp, [A[0], y - 0.8, A[1]], [Bq[0], last ? y - 3.5 : y - 0.8, Bq[1]], e.w, 1.6, steel);
      const dx = Bq[0] - A[0], dz = Bq[1] - A[1], dl = Math.hypot(dx, dz) || 1, nx = -dz / dl, nz = dx / dl;
      for (const k of [1, -1]) { const x = A[0] + nx * e.w * 0.38 * k, z = A[1] + nz * e.w * 0.38 * k, g = T.groundAt(x, z) ?? y - 12; boxAt(Bp, x, z, 0.9, 0.9, 0, g - 1, y - 1.6, steel); }
      prism(Bp, [A[0] + nx * e.w * 0.45, y - 2.6, A[1] + nz * e.w * 0.45], [A[0] - nx * e.w * 0.45, y - 2.6, A[1] - nz * e.w * 0.45], 0.8, 1.0, steel);
      if (last) prism(Bp, [Bq[0], y - 1, Bq[1]], [Bq[0] + dx / dl * 6, y - 15, Bq[1] + dz / dl * 6], 3, 3.2, lin([128, 98, 66]));
    }
  }
  // ---- the fallen towers, torn ends, chunks, girders, ramps and decks
  for (const s of W.span) {
    const A = L(s[0], s[1]), Bq = L(s[3], s[4]); if (!near(A[0], A[1], far)) continue;
    const kind = s[8], k = kind === 2 ? lin([110, 70, 50]) : kind === 1 ? lin([132, 128, 120].map(v => v * (0.9 + 0.2 * ((s[0] * 7.1) % 1)))) : kind === 3 ? lin([160, 157, 150]) : lin([136, 134, 128]);
    prism(kind === 3 || kind === 0 ? Bc : Bp, [A[0], LY(s[2]), A[1]], [Bq[0], LY(s[5]), Bq[1]], s[6], s[7], k, kind === 3 || kind === 0);
  }
  for (const s of W.slabs) { const P = s.p.map(p => L(...p)); if (!near(P[0][0], P[0][1], far)) continue; const y = LY(s.y); footBox(Bp, P, y - s.t, y - (s.legs ? 0.12 : 0), lin([138, 134, 124])); }
  for (const c of W.cols) { const [x, z] = L(c[0], c[1]); if (!near(x, z, far)) continue; boxAt(Bp, x, z, c[4] * 2, c[4] * 2, 0, LY(c[2]), LY(c[2]) + c[3], lin([110, 106, 98]));
    if (((c[0] * 7.3) % 1 + 1) % 1 < 0.5) { const w2 = c[4] + 0.15, hh = c[3] * (0.3 + ((c[1] * 3.1) % 1 + 1) % 1 * 0.5), y2 = LY(c[2]);   // ivy up some of the columns
      for (const [ax, az, bx2, bz2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) Bg.quad([x + ax * w2, y2, z + az * w2], [x + bx2 * w2, y2, z + bz2 * w2], [x + bx2 * w2, y2 + hh, z + bz2 * w2], [x + ax * w2, y2 + hh * 0.8, z + az * w2], lin([150, 175, 130]), [0, 0], [0.4, 0], [0.4, hh / 5], [0, hh / 5]); } }
  // ---- cars and cabs, many grown over
  const CC = { cab: [214, 168, 44], rust: [150, 104, 78], green: [108, 130, 100], white: [196, 196, 188], boat: [104, 118, 128] };
  for (const c of W.cars) {
    const [x, z] = L(c[0], c[1]); if (!near(x, z, detail)) continue;
    const y0 = LY(c[2]), rot = LR(c[3]), k = lin(CC[c[7]] || CC.rust);
    if (!c[9]) { // a bus (or a boat): a long body, a dark band of windows, wheels
      if (c[7] === 'boat') { boxAt(Bp, x, z, c[4], c[5], rot, y0, y0 + c[6], k); continue; }
      const kb = lin([186, 160, 112]); boxAt(Bp, x, z, c[4], c[5], rot, y0 + 0.4, y0 + 1.5, kb); boxAt(Bp, x, z, c[4] * 0.99, c[5] * 0.99, rot, y0 + 1.5, y0 + 2.5, lin([34, 38, 40]));
      boxAt(Bp, x, z, c[4], c[5], rot, y0 + 2.5, y0 + c[6], kb.map(v => v * 1.05));
      for (const [u, v] of [[-0.48, -0.33], [0.48, -0.33], [-0.48, 0.33], [0.48, 0.33]]) { const cs = Math.cos(rot), sn = Math.sin(rot); boxAt(Bp, x + u * c[4] * cs - v * c[5] * sn, z + u * c[4] * sn + v * c[5] * cs, 0.3, 1, rot, y0, y0 + 0.9, lin([30, 30, 30])); }
      blobs.push([x, y0 + c[6], z, 1.6]); continue;
    }
    boxAt(Bp, x, z, c[4], c[5], rot, y0 + 0.25, y0 + 0.95, k); boxAt(Bp, x, z, c[4] * 0.86, c[5] * 0.55, rot, y0 + 0.95, y0 + 1.45, k.map(v => v * 0.8));
    for (const [u, v] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]]) { const cs = Math.cos(rot), sn = Math.sin(rot), wx = x + u * c[4] * cs - v * c[5] * sn, wz = z + u * c[4] * sn + v * c[5] * cs; boxAt(Bp, wx, wz, 0.3, 0.6, rot, y0, y0 + 0.5, lin([30, 30, 30])); }
    if (c[8]) blobs.push([x, y0 + 1.2, z, 0.9 + ((x * 13) % 1 + 1) % 1 * 0.6]);
  }
  // ---- floodlights, cranes and the bridge
  for (const p of W.poles) { const [x, z] = L(p[0], p[1]); if (!near(x, z, far)) continue; const y0 = LY(p[2]), lean = (p[4] || 0) * Math.PI / 180;
    const tx = x + Math.sin(lean) * p[3] * 0.7; prism(Bp, [x, y0, z], [tx, y0 + p[3] * Math.cos(lean * 0.3), z], 1.2, 1.2, lin([100, 100, 104])); boxAt(Bp, tx, z, 6, 1.2, 0, y0 + p[3], y0 + p[3] + 4, lin([90, 92, 96])); }
  for (const p of W.cranes) { const [x, z] = L(p[0], p[1]); if (!near(x, z, far)) continue; const y0 = LY(p[2]);
    boxAt(Bp, x, z, 3.2, 3.2, 0, y0, y0 + p[3], lin([168, 120, 60])); prism(Bp, [x - 6, y0 + p[3], z], [x + 30, y0 + p[3] + 2, z - 8], 1.6, 1.6, lin([168, 120, 60])); }
  for (const b of W.bridge) {
    const A = L(b[0], b[1]), Bq = L(b[2], b[3]); if (!near(A[0], A[1], far * 1.2)) continue;
    const y0 = LY(b[4]), H = b[5], dx = Bq[0] - A[0], dz = Bq[1] - A[1], dl = Math.hypot(dx, dz), nx = -dz / dl, nz = dx / dl, k = lin([150, 120, 96]);
    for (const p of [A, Bq]) { for (const s of [1, -1]) boxAt(Bp, p[0] + nx * 12 * s, p[1] + nz * 12 * s, 4.4, 4.4, Math.atan2(nz, nx), y0, y0 + H, k);
      for (const yy of [H * 0.55, H * 0.92]) prism(Bp, [p[0] + nx * 12, y0 + yy, p[1] + nz * 12], [p[0] - nx * 12, y0 + yy, p[1] - nz * 12], 2.5, 3, k); }
    for (const s of [1, -1]) for (let t = 0; t < 1; t += 0.05) { // the main cables, slack now, sagging into the river
      const y = q => y0 + H - (H + 2) * Math.pow(Math.sin(Math.PI * q), 0.7);
      prism(Bp, [A[0] + dx * t + nx * 12 * s, y(t), A[1] + dz * t + nz * 12 * s], [A[0] + dx * (t + 0.05) + nx * 12 * s, y(t + 0.05), A[1] + dz * (t + 0.05) + nz * 12 * s], 0.5, 0.5, lin([70, 60, 54]));
    }
  }
  // ---- the chasms (a rift, a sinkhole): dark rock walls down from their outline
  const Fd = hole.field, rock = lin([58, 56, 54]);
  if (Fd && Fd.ready) for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
    const k = j * Fd.nx + i, v = Fd.h[k];
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const w = Fd.h[k + di + dj * Fd.nx], va = Number.isNaN(v), wa = Number.isNaN(w); if (va === wa) continue;
      const g = va ? w : v, x = Fd.x0 + (i + di * 0.5) * Fd.cell, z = Fd.z0 + (j + dj * 0.5) * Fd.cell, h2 = Fd.cell * 0.55;
      const p = dj ? [[x - h2, z], [x + h2, z]] : [[x, z - h2], [x, z + h2]];
      Bp.quad([p[0][0], g + 0.2, p[0][1]], [p[1][0], g + 0.2, p[1][1]], [p[1][0], g - 40, p[1][1]], [p[0][0], g - 40, p[0][1]], rock);
      Bp.quad([p[1][0], g + 0.2, p[1][1]], [p[0][0], g + 0.2, p[0][1]], [p[0][0], g - 40, p[0][1]], [p[1][0], g - 40, p[1][1]], rock);
    }
  }
  for (const m of [Bw.mesh(mat), Bc.mesh(concMat), Bp.mesh(plainMat), Bg.mesh(ivyMat, false)]) if (m) group.add(m);

  // ---- water: ponds and the river at their levels
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x3c5650, roughness: 0.32, metalness: 0.05, transparent: true, opacity: 0.94 });
  for (const w of W.water) { const [x, z] = L(w[0], w[1]); if (!near(x, z, far)) continue;
    // a pond is drawn only on this hole's own ground at its level: another hole's pond would float over this one
    const gw = x > box.x0 && x < box.x1 && z > box.z0 && z < box.z1 ? T.groundAt(x, z) : null; if (gw === null || Math.abs(gw - LY(w[5])) > 2.5) continue;
    const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, waterMat);
    m.scale.set(w[2], 1, w[3]); m.rotation.y = -LR(w[4]); m.position.set(x, LY(w[5]), z); m.renderOrder = 1; group.add(m); }
  for (const r of W.rivers) {
    const P = r.p.map(p => L(...p)), y = LY(r.y), pos = [], idx = [], hw = r.w / 2 + 2;
    for (let i = 0; i < P.length; i++) { const a2 = P[Math.max(0, i - 1)], b2 = P[Math.min(P.length - 1, i + 1)], dx = b2[0] - a2[0], dz = b2[1] - a2[1], l = Math.hypot(dx, dz) || 1;
      pos.push(P[i][0] - dz / l * hw, y, P[i][1] + dx / l * hw, P[i][0] + dz / l * hw, y, P[i][1] - dx / l * hw); if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, waterMat); m.renderOrder = 1; group.add(m);
  }
  // ---- the street out to the mist: a ring round the hole's own ground (never over it), at the height of its edge
  const edge = [];
  for (let t = 0; t <= 1; t += 0.05) for (const [x, z] of [[box.x0 + (box.x1 - box.x0) * t, box.z0], [box.x0 + (box.x1 - box.x0) * t, box.z1], [box.x0, box.z0 + (box.z1 - box.z0) * t], [box.x1, box.z0 + (box.z1 - box.z0) * t]]) { const g = T.groundAt(x, z); if (g !== null) edge.push(g); }
  edge.sort((p, q) => p - q);
  const sy = (edge.length ? edge[Math.floor(edge.length * 0.3)] : 0) - 0.4, Rg = 2600, Bs = batch(), sk = lin([84, 88, 72]);
  for (const [ax, az, bx, bz] of [[cx - Rg, cz - Rg, cx + Rg, box.z0], [cx - Rg, box.z1, cx + Rg, cz + Rg], [cx - Rg, box.z0, box.x0, box.z1], [box.x1, box.z0, cx + Rg, box.z1]])
    Bs.quad([ax, sy, az], [ax, sy, bz], [bx, sy, bz], [bx, sy, az], sk);
  const street = Bs.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), false); street.receiveShadow = true; group.add(street);
  // ---- rubble heaps, ramps and banks: grass over them, broken concrete poking through
  if (hole.rubble && hole.rubble.length) {
    const n = hole.rubble.length / 2, Rr = rng(hi * 97 + 5), geo = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), n * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), col = new THREE.Color(), teesXZ = Object.values(hole.tees); let k = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
      if (Rr() < 0.35) continue;
      const x = hole.rubble[i * 2] + (Rr() - 0.5) * 4, z = hole.rubble[i * 2 + 1] + (Rr() - 0.5) * 4, g = T.groundAt(x, z); if (g === null) continue;
      // nothing big right beside a tee: a block there fills the view from the stance
      const dt = Math.min(...teesXZ.map(p => Math.hypot(p[0] - x, p[1] - z))); if (dt < 14) continue;
      const s = (0.5 + Math.pow(Rr(), 2) * 3.2) * Math.min(1, 0.35 + (dt - 14) / 30);
      m4.compose(V3(x, g + s * 0.12, z), q.setFromEuler(e3.set((Rr() - 0.5) * 0.9, Rr() * 6.3, (Rr() - 0.5) * 0.9)), V3(s * (0.8 + Rr() * 0.8), s * (0.35 + Rr() * 0.4), s * (0.6 + Rr() * 0.7)));
      im.setMatrixAt(k, m4); col.setRGB(...(Rr() < 0.3 ? lin([84 + Rr() * 20, 100 + Rr() * 20, 60 + Rr() * 14]) : lin([112 + Rr() * 30, 106 + Rr() * 26, 92 + Rr() * 20]))); im.setColorAt(k, col); k++;
    }
    im.count = k; im.castShadow = im.receiveShadow = true; group.add(im);
  }

  // ---- shrubs and moss: lumpy green blobs, instanced
  if (blobs.length) {
    const geo = new THREE.IcosahedronGeometry(1, 1), im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), blobs.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    blobs.forEach(([x, y, z, r], i) => { m4.compose(V3(x, y, z), q, V3(r, r * 0.7, r)); im.setMatrixAt(i, m4); col.set([0x4f6b38, 0x5d7a40, 0x46613a][i % 3]); im.setColorAt(i, col); });
    im.receiveShadow = true; group.add(im);
  }
  // other holes' trees near this one, and the trees on the roofs (they play, like every tree)
  const clear = (x, z) => [...Object.values(hole.tees), hole.pin, ...hole.line].every(p => Math.hypot(p[0] - x, p[1] - z) > 45);
  for (const t of W.trees) { if (t[2] === hi) continue; const [x, z] = L(t[0], t[1]); if (!near(x, z, detail) || !clear(x, z)) continue; const g = T.groundAt(x, z); if (g !== null) trees.push({ x, y: g, z, s: 1.2 + ((x * 7) % 1 + 1) % 1, type: 'oak', r: 0.5 }); }

  // ---- weeds and grass through the cracks, over the rubble and the rough: crossed blades, instanced
  {
    const geo = new THREE.BufferGeometry(), P2 = [], U2 = [];
    for (const r of [0, Math.PI / 2]) { const c2 = Math.cos(r) * 0.5, s2 = Math.sin(r) * 0.5;
      P2.push(-c2, 0, -s2, c2, 0, s2, c2, 1, s2, -c2, 0, -s2, c2, 1, s2, -c2, 1, -s2); U2.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); geo.computeVertexNormals();
    const cap = coarse ? 3500 : 7000, im = new THREE.InstancedMesh(geo, std({ map: TEX.grass, alphaTest: 0.5, roughness: 1, vertexColors: false }), cap);
    const Rg2 = rng(hi * 131 + 9), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), col = new THREE.Color(); let k = 0;
    const PROB = { desert: 0.4, rough: 0.3, firstcut: 0.05 }, step = coarse ? 3.4 : 2.6;
    for (let z = box.z0; z < box.z1 && k < cap; z += step) for (let x = box.x0; x < box.x1 && k < cap; x += step) {
      const px = x + (Rg2() - 0.5) * step, pz = z + (Rg2() - 0.5) * step, pr = PROB[T.surfaceAt(px, pz)]; if (!pr) continue;
      const patch = Math.sin(px * 0.11 + Math.sin(pz * 0.07) * 2) * Math.cos(pz * 0.09 - px * 0.03);   // patchy, not even
      if (Rg2() > pr * (0.6 + patch)) continue;
      const g = T.groundAt(px, pz); if (g === null) continue;
      const w = 0.6 + Rg2() * 1.0, h = 0.35 + Rg2() * 0.8;
      m4.compose(V3(px, g - 0.05, pz), q.setFromEuler(e3.set(0, Rg2() * 3.2, 0)), V3(w, h, w)); im.setMatrixAt(k, m4);
      col.set([0x9fb06a, 0x8aa45c, 0xb0b070, 0x7f9a52][Math.floor(Rg2() * 4)]); im.setColorAt(k, col); k++;
    }
    im.count = k; im.receiveShadow = true; group.add(im);
    // saplings and young trees in the street, well off the play
    for (let n = 0, tries = 0; n < (coarse ? 10 : 18) && tries < 400; tries++) {
      const x = box.x0 + Rg2() * (box.x1 - box.x0), z = box.z0 + Rg2() * (box.z1 - box.z0);
      if (T.surfaceAt(x, z) !== 'desert' || !offLine(x, z, 32)) continue;
      const g = T.groundAt(x, z); if (g === null || T.solidAt(x, g + 2, z)) continue;
      trees.push({ x, y: g, z, s: 0.45 + Rg2() * 0.45, type: 'oak', r: Rg2() }); n++;
    }
  }

  // ---- street furniture by the stopped cars: lamp posts (some leaning), traffic signals over the lanes, signs
  {
    const Fp = batch(), Fg = batch(), Rf = rng(hi * 53 + 17), pole = lin([60, 68, 62]), head = lin([150, 122, 44]), lit = lin([40, 40, 36]);
    for (const c of W.cars) {
      if (!c[9]) continue;
      const [x0, z0] = L(c[0], c[1]); if (!near(x0, z0, detail * 0.8)) continue;
      const r = Rf(); if (r > 0.34) continue;
      const rot = LR(c[3]), wx = Math.cos(rot), wz = Math.sin(rot), sd = Rf() < 0.5 ? 1 : -1, off = c[4] / 2 + 2.6;
      const x = x0 + wx * off * sd, z = z0 + wz * off * sd; if (!offLine(x, z, 26)) continue;
      const g = T.groundAt(x, z); if (g === null || T.solidAt(x, g + 3, z)) continue;
      const tilt = Rf() < 0.2 ? 0.15 + Rf() * 0.3 : 0, tx = -wx * sd * Math.sin(tilt), tz = -wz * sd * Math.sin(tilt);
      if (r < 0.06) { // a traffic signal on a mast arm out over the lane
        const H = 6.5, top = [x + tx * H, g + H * Math.cos(tilt), z + tz * H];
        prism(Fp, [x, g - 0.3, z], top, 0.32, 0.32, pole);
        const end = [top[0] - wx * sd * 7, top[1] + 0.3, top[2] - wz * sd * 7]; prism(Fp, top, end, 0.2, 0.2, pole);
        for (const f of [0.55, 0.95]) { const hx = top[0] + (end[0] - top[0]) * f, hz = top[2] + (end[2] - top[2]) * f, hy = top[1] + (end[1] - top[1]) * f;
          boxAt(Fp, hx, hz, 0.45, 0.4, rot, hy - 1.25, hy - 0.05, head); boxAt(Fp, hx, hz, 0.5, 0.42, rot, hy - 1.15, hy - 0.15, lit); }
      } else { // a lamp post, its arm over the street
        const H = 7.5, top = [x + tx * H, g + H * Math.cos(tilt), z + tz * H];
        prism(Fp, [x, g - 0.3, z], top, 0.22, 0.22, pole);
        const end = [top[0] - wx * sd * 2.2, top[1] + 0.2, top[2] - wz * sd * 2.2]; prism(Fp, top, end, 0.14, 0.14, pole);
        boxAt(Fp, end[0], end[2], 0.7, 0.35, rot, end[1] - 0.3, end[1] + 0.05, lin([80, 84, 80]));
        if (Rf() < 0.35) { const sy2 = g + 2.6; boxAt(Fp, x - wx * sd * 0.5, z - wz * sd * 0.5, 0.9, 0.06, rot + Math.PI / 2, sy2, sy2 + 0.3, Rf() < 0.6 ? lin([40, 104, 62]) : lin([210, 208, 200])); }
        if (Rf() < 0.4) Fg.quad([x + 0.2, g, z], [x - 0.2, g, z + 0.2], [x - 0.2, g + 2 + Rf() * 3, z + 0.2], [x + 0.2, g + 2 + Rf() * 3, z], lin([150, 175, 130]), [0, 0], [0.3, 0], [0.3, 0.8], [0, 0.8]);
      }
    }
    for (const m of [Fp.mesh(plainMat), Fg.mesh(ivyMat, false)]) if (m) group.add(m);
  }

  // ---- a few deer grazing in the rough, well off the line
  {
    const Rd = rng(hi * 71 + 3), nDeer = coarse ? 1 : 1 + (hi % 3 === 0 ? 2 : 1);
    const body = batch(), headB = batch(), tan = lin([150, 110, 74]), pale = lin([210, 196, 170]), dark = lin([60, 46, 36]);
    const bx = (B, x0, y0, z0, x1, y1, z1, k) => { const P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; footBox(B, P, y0, y1, k); };
    bx(body, -0.25, 0.75, -0.7, 0.25, 1.15, 0.7, tan); bx(body, -0.18, 0.72, 0.65, 0.18, 1.0, 0.8, pale);              // body, rump
    for (const [lx, lz] of [[-0.15, -0.55], [0.15, -0.55], [-0.15, 0.55], [0.15, 0.55]]) bx(body, lx - 0.05, 0, lz - 0.05, lx + 0.05, 0.8, lz + 0.05, dark);
    bx(body, -0.06, 0.95, 0.78, 0.06, 1.15, 0.86, pale);                                                                    // tail
    bx(headB, -0.09, 0, -0.1, 0.09, 0.6, 0.1, tan); bx(headB, -0.1, 0.55, -0.42, 0.1, 0.75, 0.05, tan);                    // neck, head (pivot at the withers)
    bx(headB, -0.16, 0.72, -0.05, -0.05, 0.86, 0.03, tan); bx(headB, 0.05, 0.72, -0.05, 0.16, 0.86, 0.03, tan);           // ears
    bx(headB, -0.04, 0.58, -0.46, 0.04, 0.66, -0.4, dark);
    const deerMat = std({ roughness: 1 }), bodyGeo = body.mesh(deerMat).geometry, headGeo = headB.mesh(deerMat).geometry;
    for (let n = 0, tries = 0; n < nDeer && tries < 300; tries++) {
      const x = box.x0 + Rd() * (box.x1 - box.x0), z = box.z0 + Rd() * (box.z1 - box.z0), s = T.surfaceAt(x, z);
      if (!(s === 'rough' || s === 'desert') || !offLine(x, z, 38)) continue;
      const g = T.groundAt(x, z); if (g === null || T.solidAt(x, g + 1, z)) continue;
      const sl = T.slopeAt ? T.slopeAt(x, z) : { x: 0, z: 0 }; if (Math.hypot(sl.x, sl.z) > 0.2) continue;
      const D = new THREE.Group(), hd = new THREE.Mesh(headGeo, deerMat), bd = new THREE.Mesh(bodyGeo, deerMat);
      hd.position.set(0, 1.05, -0.62); D.add(bd, hd); D.position.set(x, g, z); D.rotation.y = Rd() * 6.3; D.scale.setScalar(1.15);
      bd.castShadow = hd.castShadow = true; group.add(D);
      const ph = Rd() * 20, per = 9 + Rd() * 6;
      anims.push((dt, t) => { const u = ((t + ph) % per) / per, up = u > 0.78 ? Math.sin((u - 0.78) / 0.22 * Math.PI) : 0; hd.rotation.x = -1.05 * (1 - up) + 0.1 * Math.sin(t * 3 + ph) * (1 - up); });
      n++;
    }
  }

  // ---- birds wheeling over the street
  {
    const nB = coarse ? 5 : 8, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, -0.9, 0.35, 0.05, 0, 0, 0.2, 0, 0, -0.25, 0, 0, 0.2, 0.9, 0.35, 0.05], 3)); geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 1, side: THREE.DoubleSide }), nB);
    const line = hole.line, mid = line[Math.floor(line.length / 2)], gm = T.groundAt(mid[0], mid[1]) ?? 0;
    const C0 = V3(mid[0] + 40, gm + 38, mid[1]), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), sc = V3(1, 1, 1);
    const B = Array.from({ length: nB }, (_, i) => ({ r: 30 + i * 6 + (i % 3) * 5, ph: i * 0.7, h: (i % 4) * 2.5, sp: 0.16 + (i % 3) * 0.02, fl: i * 1.3 }));
    im.frustumCulled = false; group.add(im);
    const place = t => { B.forEach((b, i) => { const a2 = t * b.sp + b.ph, x = C0.x + Math.cos(a2) * b.r, z = C0.z + Math.sin(a2) * b.r * 0.7, y = C0.y + b.h + Math.sin(t * 0.3 + b.ph) * 3;
      const flap = Math.sin(t * 9 + b.fl); sc.set(1.3, 1.3 * flap, 1.3); q.setFromEuler(e3.set(0, -a2, 0.2));
      m4.compose(V3(x, y, z), q, sc); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; };
    place(0); anims.push((dt, t) => place(t));
  }

  // ---- shafts of sun through the haze, where the low morning sun reaches down a street
  if (beams && sunDir && sunDir.y > 0.05) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g2 = cv.getContext('2d');
    const gx = g2.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(255,255,255,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = gx; g2.fillRect(0, 0, 64, 256); g2.globalCompositeOperation = 'destination-in';
    const gy = g2.createLinearGradient(0, 0, 0, 256); gy.addColorStop(0, 'rgba(0,0,0,0)'); gy.addColorStop(0.35, 'rgba(0,0,0,1)'); gy.addColorStop(0.9, 'rgba(0,0,0,0.8)'); gy.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gy; g2.fillRect(0, 0, 64, 256);
    const bm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), color: 0xfff0d0, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
    const Rb = rng(hi * 19 + 1), line = hole.line, sd = V3(sunDir.x, sunDir.y, sunDir.z).normalize();
    let made = 0; const bp = [], bu = [];
    for (let tries = 0; tries < 120 && made < (coarse ? 3 : 5); tries++) {
      const i = Math.floor(Rb() * (line.length - 1)), f = 0.15 + Rb() * 0.8, p = line[i], q2 = line[i + 1];
      const lx = p[0] + (q2[0] - p[0]) * f, lz = p[1] + (q2[1] - p[1]) * f, dx = q2[0] - p[0], dz = q2[1] - p[1], dl = Math.hypot(dx, dz) || 1, side2 = (Rb() < 0.5 ? 1 : -1) * (25 + Rb() * 70);
      const x = lx - dz / dl * side2, z = lz + dx / dl * side2, g = T.groundAt(x, z); if (g === null) continue;
      let open = true; for (let d = 4; d < 200 && open; d += 5) if (T.solidAt(x + sd.x * d, g + 1 + sd.y * d, z + sd.z * d)) open = false;
      if (!open) continue;
      const Lb = Math.min(500, 110 / sd.y), w = 8 + Rb() * 14, a0 = V3(x, g, z), a1 = a0.clone().addScaledVector(sd, Lb);
      const across = V3(-sd.z, 0, sd.x).normalize(), up2 = new THREE.Vector3().crossVectors(sd, across).normalize();
      for (const ax of [across, up2]) {
        const c0 = a0.clone().addScaledVector(ax, -w / 2), c1 = a0.clone().addScaledVector(ax, w / 2), c2 = a1.clone().addScaledVector(ax, w * 0.8), c3 = a1.clone().addScaledVector(ax, -w * 0.8);
        bp.push(...c0.toArray(), ...c1.toArray(), ...c2.toArray(), ...c0.toArray(), ...c2.toArray(), ...c3.toArray()); bu.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      }
      made++;
    }
    if (bp.length) { const gq = new THREE.BufferGeometry(); gq.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); gq.setAttribute('uv', new THREE.Float32BufferAttribute(bu, 2));
      const m = new THREE.Mesh(gq, bm); m.renderOrder = 2; group.add(m); }
  }
  return { trees, anims };
}
