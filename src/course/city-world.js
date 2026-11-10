// The Reclaim's city (global THREE): what COURSE.city holds (world space) put into a hole's frame (hole.frame) and
// drawn: ruined buildings with broken tops, blown-out floors, ivy hanging off them and vines up their walls, trees
// on their roofs; the El; the fallen towers and their chunks; stopped cars and cabs; poles, cranes and the bridge;
// water and the river; the chasm walls; the street out to the mist. One merged mesh per material, so a hole is a
// handful of draw calls. The ball's side of it (boxes, wedges, trees) is in the course module and terrain.js.
import { rng } from './noise.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// facades: a floor every 4 m, a bay every 6 m, some windows dark, some panels gone
function facadeTexture() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S * 4; cv.height = S * 4;
  const g = cv.getContext('2d'), R = rng(11);
  g.fillStyle = '#c9c6bf'; g.fillRect(0, 0, cv.width, cv.height);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * S, y = j * S;
    g.fillStyle = `rgba(0,0,0,${0.04 + R() * 0.06})`; g.fillRect(x, y, S, S);
    const dark = R(), win = dark < 0.25 ? '#2a2a2a' : dark < 0.6 ? '#4a4d50' : '#6c7274';
    g.fillStyle = win; g.fillRect(x + S * 0.12, y + S * 0.22, S * 0.76, S * 0.6);
    if (R() < 0.4) { g.fillStyle = '#5b7a45'; g.globalAlpha = 0.7; g.fillRect(x + S * 0.12, y + S * (0.55 + R() * 0.2), S * 0.76, S * 0.28); g.globalAlpha = 1; } // weeds on the sill
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + S * 0.9, S, S * 0.1);           // the slab edge
  }
  // a plain corner (uv near 0, 0) for roofs, rubble, ivy and steel
  g.fillStyle = '#ffffff'; g.fillRect(0, cv.height - 8, 8, 8);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
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
  const uvs = (i, s) => (ribs ? [i * 0.25, s * L / 4] : PLAIN);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, sh = 0.85 + 0.15 * (i % 2); B.quad(A[i], A[j], Bq[j], Bq[i], k.map(v => v * sh), uvs(0, 0), uvs(1, 0), uvs(1, 1), uvs(0, 1)); }
  B.quad(A[3], A[2], A[1], A[0], k.map(v => v * 0.8)); B.quad(Bq[0], Bq[1], Bq[2], Bq[3], k.map(v => v * 0.8));
}
const boxAt = (B, x, z, w, d, rot, y0, y1, k) => {   // an axis box turned by rot (yaw from +x toward +z)
  const c = Math.cos(rot), s = Math.sin(rot), P = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c - v * s, z + u * s + v * c]);
  footBox(B, P, y0, y1, k);
};
function footBox(B, P, y0, y1, k) {
  const ctr = [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; wall(B, a, b, ctr, y0, [[0, y1], [1, y1]], k, false); }
  B.quad([P[0][0], y1, P[0][1]], [P[3][0], y1, P[3][1]], [P[2][0], y1, P[2][1]], [P[1][0], y1, P[1][1]], k.map(v => v * 0.85));
}
// a wall from a to b (footprint points), outward away from ctr, from y0 up to a broken skyline
// top: [[t (0..1 along), y], ...]
function wall(B, a, b, ctr, y0, top, k, windows = true, lean = null) {
  const out = ((a[0] + b[0]) / 2 - ctr[0]) * (b[1] - a[1]) - ((a[1] + b[1]) / 2 - ctr[1]) * (b[0] - a[0]) > 0;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const P = (t, y) => { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return lean ? [x + lean[0] * (y - y0), y, z + lean[1] * (y - y0)] : [x, y, z]; };
  const U = (t, y) => (windows ? [t * len / 6, (y - y0) / 4] : PLAIN);
  for (let i = 0; i < top.length - 1; i++) {
    const [t0, h0] = top[i], [t1, h1] = top[i + 1];
    const q = [P(t0, y0), P(t1, y0), P(t1, h1), P(t0, h0)], u = [U(t0, y0), U(t1, y0), U(t1, h1), U(t0, h0)];
    if (out) B.quad(q[0], q[1], q[2], q[3], k, u[0], u[1], u[2], u[3]); else B.quad(q[1], q[0], q[3], q[2], k, u[1], u[0], u[3], u[2]);
  }
}

export function buildCity(hole, T, box, W, hi, { group, coarse }) {
  if (!TEX) TEX = facadeTexture();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base, LR = r => r - a;   // world height / yaw -> this hole's
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  // double-sided: every wall shows from outside whichever way its footprint runs
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: TEX, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const plainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const greenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  const Bw = batch(), Bp = batch(), Bg = batch();
  const trees = [], blobs = [];
  const far = coarse ? 1100 : 1600, detail = coarse ? 380 : 620;

  // ---- buildings
  for (const b of W.bldg) {
    const P = b.p.map(p => L(...p)), c = [P.reduce((s, p) => s + p[0], 0) / 4, P.reduce((s, p) => s + p[1], 0) / 4];
    if (!near(c[0], c[1], far)) continue;
    // stand on this hole's ground where it is under the building (nothing floats)
    let y0 = LY(b.y); if (c[0] > box.x0 && c[0] < box.x1 && c[1] > box.z0 && c[1] < box.z1) for (const q of [...P, c]) { const g = T.groundAt(q[0], q[1]); if (g !== null && g - 1 < y0) y0 = g - 1; }
    const R = rng(b.s * 7 + 3), top = y0 + b.h, d0 = Math.hypot(c[0] - cx, c[1] - cz), rich = d0 < detail;
    const tone = lin([[200, 197, 190], [186, 176, 166], [176, 182, 186], [205, 200, 188], [168, 150, 136]][Math.floor(R() * 5)]);
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
    for (let i = 0; i < 4; i++) wall(rich ? Bw : Bp, P[i], P[(i + 1) % 4], c, lo, sky[i], tone, rich, lean);
    // the roof, at the lowest of the broken top (trees grow out of it)
    const rTop = Math.min(...sky.flat().map(e => e[1])) - 0.5, sh = p => (lean ? [p[0] + lean[0] * (rTop - y0), p[1] + lean[1] * (rTop - y0)] : p);
    const Rp = P.map(sh);
    Bp.quad([Rp[0][0], rTop, Rp[0][1]], [Rp[3][0], rTop, Rp[3][1]], [Rp[2][0], rTop, Rp[2][1]], [Rp[1][0], rTop, Rp[1][1]], tone.map(v => v * 0.6));
    Bp.quad([Rp[0][0], rTop, Rp[0][1]], [Rp[1][0], rTop, Rp[1][1]], [Rp[2][0], rTop, Rp[2][1]], [Rp[3][0], rTop, Rp[3][1]], tone.map(v => v * 0.6));
    if (b.open) { // the blown-out lobby: the floor slab above it, seen from below, on its columns
      Bp.quad([P[0][0], lo, P[0][1]], [P[1][0], lo, P[1][1]], [P[2][0], lo, P[2][1]], [P[3][0], lo, P[3][1]], tone.map(v => v * 0.45));
      Bp.quad([P[0][0], lo, P[0][1]], [P[3][0], lo, P[3][1]], [P[2][0], lo, P[2][1]], [P[1][0], lo, P[1][1]], tone.map(v => v * 0.45));
    }
    if (b.tower) { // the clock tower on the clubhouse, with its pyramid roof
      const w = b.tower.w / 2, tp = [[c[0] - w, c[1] - w], [c[0] + w, c[1] - w], [c[0] + w, c[1] + w], [c[0] - w, c[1] + w]].map(sh), yb = rTop, yt = rTop + b.tower.h;
      for (let i = 0; i < 4; i++) wall(Bw, tp[i], tp[(i + 1) % 4], sh(c), yb, [[0, yt], [1, yt]], tone, true, lean);
      const ap = sh(c), apex = [ap[0] + (lean ? lean[0] * b.tower.h : 0), yt + 9, ap[1] + (lean ? lean[1] * b.tower.h : 0)], k2 = lin([110, 116, 112]);
      const tt = tp.map(p => [p[0] + (lean ? lean[0] * b.tower.h : 0), yt, p[1] + (lean ? lean[1] * b.tower.h : 0)]);
      for (let i = 0; i < 4; i++) Bp.tri(tt[(i + 1) % 4], tt[i], apex, k2);
      for (let i = 0; i < 4; i++) Bp.tri(tt[i], tt[(i + 1) % 4], apex, k2);
    }
    if (!rich) continue;
    // ivy hanging off the broken top, vines up the walls, shrubs at the foot, trees out of the roof
    for (let i = 0; i < 4; i++) {
      const p = P[i], q = P[(i + 1) % 4], len = Math.hypot(q[0] - p[0], q[1] - p[1]), ox = (q[1] - p[1]) / len, oz = -(q[0] - p[0]) / len;
      const sg = ((p[0] + q[0]) / 2 - c[0]) * ox + ((p[1] + q[1]) / 2 - c[1]) * oz > 0 ? 1 : -1, off = 0.25 * sg;
      const at = (t, y) => { const x = p[0] + (q[0] - p[0]) * t + ox * off, z = p[1] + (q[1] - p[1]) * t + oz * off; return lean ? [x + lean[0] * (y - y0), y, z + lean[1] * (y - y0)] : [x, y, z]; };
      const nm = Math.ceil(len / 14 * (b.v ? 1.4 : 0.6));
      for (let m = 0; m < nm; m++) {
        const t = R(), w = Math.min(0.4, (3 + R() * 7) / len), e = sky[i], k = Math.min(e.length - 1, Math.round(t * (e.length - 1))), yt = e[k][1] - 0.5, hang = 5 + R() * Math.min(26, (yt - lo) * 0.6);
        const gk = lin([[88, 120, 66], [74, 104, 58], [104, 130, 72]][Math.floor(R() * 3)]);
        let prev = [t - w / 2, yt - hang * (0.5 + 0.5 * R())];
        for (let j = 1; j <= 4; j++) { const tt = t - w / 2 + j / 4 * w, yb = yt - hang * (0.45 + 0.55 * R());
          Bg.quad(at(prev[0], prev[1]), at(tt, yb), at(tt, yt), at(prev[0], yt), gk); prev = [tt, yb]; }
      }
      for (let v = 0; v < Math.ceil(len / 6) * (b.v ? 1 : 0.6); v++) {
        const t = R(), hh = lo + (0.15 + R() * 0.55) * (b.h - (b.open || 0)), gk = lin([78, 110, 62]);
        Bg.quad(at(t, lo), at(t + 0.35 / len, lo), at(t + 0.5 / len, hh), at(t + 0.1 / len, hh), gk);
      }
      if (d0 < detail * 0.7) for (let k = 0; k < len / 9; k++) { const t = R(); blobs.push([p[0] + (q[0] - p[0]) * t + ox * sg * 2, y0 + 0.4, p[1] + (q[1] - p[1]) * t + oz * sg * 2, 1.4 + R() * 1.8]); }
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
    const kind = s[8], k = kind === 2 ? lin([110, 70, 50]) : kind === 1 ? lin([165, 160, 152].map(v => v * (0.9 + 0.2 * ((s[0] * 7.1) % 1)))) : kind === 3 ? lin([196, 193, 186]) : lin([168, 166, 162]);
    prism(kind === 3 ? Bw : Bp, [A[0], LY(s[2]), A[1]], [Bq[0], LY(s[5]), Bq[1]], s[6], s[7], k, kind === 3 || kind === 0);
  }
  for (const s of W.slabs) { const P = s.p.map(p => L(...p)); if (!near(P[0][0], P[0][1], far)) continue; const y = LY(s.y); footBox(Bp, P, y - s.t, y - (s.legs ? 0.12 : 0), lin([178, 175, 170])); }
  for (const c of W.cols) { const [x, z] = L(c[0], c[1]); if (!near(x, z, far)) continue; boxAt(Bp, x, z, c[4] * 2, c[4] * 2, 0, LY(c[2]), LY(c[2]) + c[3], lin([176, 172, 166])); }
  // ---- cars and cabs, many grown over
  const CC = { cab: [214, 168, 44], rust: [150, 104, 78], green: [108, 130, 100], white: [196, 196, 188], boat: [104, 118, 128] };
  for (const c of W.cars) {
    const [x, z] = L(c[0], c[1]); if (!near(x, z, detail)) continue;
    const y0 = LY(c[2]), rot = LR(c[3]), k = lin(CC[c[7]] || CC.rust);
    if (!c[9]) { boxAt(Bp, x, z, c[4], c[5], rot, y0, y0 + c[6], k); continue; }
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
  for (const m of [Bw.mesh(mat), Bp.mesh(plainMat), Bg.mesh(greenMat, false)]) if (m) group.add(m);

  // ---- water: ponds and the river at their levels
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x5f7d86, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.92 });
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
  const sy = (edge.length ? edge[Math.floor(edge.length * 0.3)] : 0) - 0.4, Rg = 2600, Bs = batch(), sk = lin([93, 92, 88]);
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
      im.setMatrixAt(k, m4); col.setRGB(...lin([150 + Rr() * 40, 146 + Rr() * 36, 138 + Rr() * 30])); im.setColorAt(k, col); k++;
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
  return { trees, anims: [] };
}
