// node tools/rimeholm/sketch.mjs [holes] : the plan book's sketch views. Simple 3D shapes from the plan data
// (ground cells, seracs, boulders, spruce, the ice cave's roof, the ice bridge, the hall, braziers, steam, the
// longship under the ice, the mammoth in the wall), projected through a real camera and drawn as ink and
// washes in SVG, hazed with distance, under a pale night sky with the aurora (drawn light so the book prints).
// out/views/h<n>_<tee|land|green>.svg (+ .png). Painter's order by horizontal distance: for a layout round.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES } from './holes.mjs';
import { BUILT, toWorld, toLocal, worldAt, CRACKS } from './scene.mjs';
import { WORLD } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, clamp, seOutline, lengthOf, rnd } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [232, 237, 245], MIST = 520;
const SC = { snow: [246, 248, 252], rough: [230, 236, 245], fairway: [200, 216, 234], fringe: [150, 196, 118], green: [160, 212, 124], tee: [204, 218, 236],
  sand: [78, 76, 82], powder: [232, 240, 252], water: [118, 182, 204], ice: [172, 212, 232], rock: [104, 106, 116], rubble: [176, 182, 194], travertine: [236, 226, 204], hall: [140, 108, 80], void: [34, 46, 72] };
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);

const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.9, 1 - Math.exp(-Math.max(0, d - 30) / MIST));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

function camera(pos, look) {
  const f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const cam = { pos, f, r, u };
  cam.view = p => { const v = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]]; return [v[0] * r[0] + v[1] * r[1] + v[2] * r[2], v[0] * u[0] + v[1] * u[1] + v[2] * u[2], v[0] * f[0] + v[1] * f[1] + v[2] * f[2]]; };
  cam.scr = v => [VW / 2 + v[0] / v[2] * FPX, VH / 2 - v[1] / v[2] * FPX];
  cam.hd = p => Math.hypot(p[0] - pos[0], p[2] - pos[2]);
  return cam;
}
function clipNear(P, near = 0.6) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ia = a[2] >= near, ib = b[2] >= near;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]); }
  }
  return out;
}
function clipBox(P, x0 = -400, y0 = -400, x1 = VW + 400, y1 = VH + 400) {
  let out = P;
  for (const [k, v, keepLess] of [[0, x0, false], [0, x1, true], [1, y0, false], [1, y1, true]]) {
    const inp = out; out = []; if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = keepLess ? a[k] <= v : a[k] >= v, ib = keepLess ? b[k] <= v : b[k] >= v;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}
const fmt = P => P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
function wob(P, closed, seed = 1, amp = 0.75) {
  const pts = closed ? [...P, P[0]] : P, out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay), n = Math.min(60, Math.max(1, Math.ceil(l / 14)));
    const nx = -(by - ay) / (l || 1), ny = (bx - ax) / (l || 1);
    for (let k = 0; k < n; k++) { const t = k / n, j = (hash(seed + i * 7.1 + k, ax * 0.01 + t) - 0.5) * 2 * amp * (k === 0 ? 0.3 : 1); out.push([ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j]); }
  }
  out.push(pts.at(-1)); return out;
}

function renderView(hi, view) {
  HFOV = (view.fov || 60) * Math.PI / 180; FPX = (VW / 2) / Math.tan(HFOV / 2);
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look), W = WOR[hi], toHere = LOC[hi];
  const polys = [];
  const proj = P => { const v = clipNear(P.map(cam.view)); if (v.length < 3) return null; const q = clipBox(v.map(cam.scr)); return q.length < 3 ? null : q; };
  const projLine = P => { const v = P.map(cam.view); if (v.some(q => q[2] < 0.6)) return null; return v.map(cam.scr); };
  const inView = (x, z, margin = 0.25) => { const v = cam.view([x, cam.pos[1], z]); return v[2] > -20 && Math.abs(v[0]) < (v[2] + 30) * (Math.tan(HFOV / 2) + margin); };
  const add = (key, svg) => polys.push({ key, svg });

  // ---- ground: the glacier (this hole's own ground near its line, blended into the others), absolute y
  const cache = new Map();
  const gq = (x, z) => { const key = x.toFixed(2) + ':' + z.toFixed(2); let v = cache.get(key); if (!v) { v = worldAt(...W(x, z)); cache.set(key, v); } return v; };
  const gy = (x, z) => { const v = gq(x, z); return v.y ?? v.raw ?? 0; };
  const cells = [];
  function cell(x, z, s) {
    const d = Math.hypot(x + s / 2 - cam.pos[0], z + s / 2 - cam.pos[2]);
    if (d > 1700) return;
    if (!inView(x + s / 2, z + s / 2, 0.35 + s / Math.max(d, 1))) return;
    const c = gq(x + s / 2, z + s / 2), k = [gq(x, z), gq(x + s, z), gq(x + s, z + s), gq(x, z + s)];
    const mixed = k.some(q => q.s !== c.s || (q.y === null) !== (c.y === null));
    const want = Math.max(1.2, d * 0.02);
    if (s > want * 1.5 || (mixed && s > Math.max(1.2, d * 0.006))) { const t = s / 2; cell(x, z, t); cell(x + t, z, t); cell(x + t, z + t, t); cell(x, z + t, t); return; }
    cells.push({ x, z, s, c, k, d });
  }
  const R = 1600, S0 = 64, gx0 = Math.floor((cam.pos[0] - R) / S0) * S0, gz0 = Math.floor((cam.pos[2] - R) / S0) * S0;
  for (let x = gx0; x < cam.pos[0] + R; x += S0) for (let z = gz0; z < cam.pos[2] + R; z += S0) cell(x, z, S0);
  const L = [-0.45, 0.8, 0.4], Ll = Math.hypot(...L); L.forEach((v, i) => L[i] = v / Ll);
  for (const q of cells) {
    const { x, z, s, c, k } = q;
    let col, ys;
    if (c.y === null) { ys = k.map(v => (v.raw ?? 0) - 0.05); col = SC.void; }
    else { ys = k.map(v => v.y ?? c.y); col = SC[c.s] || SC.snow; }
    const dx = ((ys[1] + ys[2]) - (ys[0] + ys[3])) / (2 * s), dz = ((ys[2] + ys[3]) - (ys[0] + ys[1])) / (2 * s);
    const n = [-dx, 1, -dz], nl = Math.hypot(...n), lam = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl, 0, 1);
    const icy = c.s === 'ice' ? 0.93 + 0.1 * hash(Math.floor(x / 3), Math.floor(z / 3)) : 1;
    const tex = icy * (c.s === 'fairway' || c.s === 'tee' ? 0.985 + 0.03 * (Math.floor(Math.hypot(x, z) / 9) % 2) : c.s === 'snow' || c.s === 'rough' ? 0.99 + 0.02 * hash(Math.floor(x / 4), Math.floor(z / 4)) : 1);
    // snow in shadow goes blue rather than grey
    const sh = 1 - lam, blue = [0.80, 0.86, 1.0];
    col = col.map((v, i) => v * (0.80 + 0.22 * lam) * tex * (1 - sh * 0.25 * (1 - blue[i])));
    const P = proj([[x, ys[0], z], [x + s, ys[1], z], [x + s, ys[2], z + s], [x, ys[3], z + s]]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d) * (c.y === null ? 0.4 : 1)));
    // open air (a crevasse's floor in the dark) goes down first, under its walls and everything else
    add(c.y === null ? q.d + 5000 : q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    // grains on the black sand, specks in the powder
    if ((c.s === 'sand' || c.s === 'powder') && q.d < 300 && s <= 4) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.05, col = hex(mix(c.s === 'sand' ? [190, 190, 198] : [130, 160, 205], f));
      let dots = '';
      for (let i = 0; i < 3; i++) { const v = cam.view([x + hash(x + i, z) * s, y0, z + hash(z + i, x) * s]); if (v[2] < 1) continue; const p = cam.scr(v); dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0.6, 1.4 * (1.1 - f)).toFixed(2)}" fill="${col}"/>`; }
      if (dots) add(q.d - 0.03, dots);
    }
    // cracks in the ice
    if (c.s === 'ice' && q.d < 320 && s <= 8 && hash(Math.floor(x * 1.9), Math.floor(z * 2.1)) > 0.5) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.08, a0 = hash(z, x) * 6.283, pts = [];
      for (let i = 0; i <= 4; i++) { const t = i / 4 - 0.5, j = (hash(x + i, z) - 0.5) * s * 0.5; pts.push([x + s / 2 + Math.cos(a0) * t * s * 1.6 - Math.sin(a0) * j, y0, z + s / 2 + Math.sin(a0) * t * s * 1.6 + Math.cos(a0) * j]); }
      const p = projLine(pts);
      if (p) add(q.d - 0.03, `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([90, 140, 172], f))}" stroke-width="${(1.0 * (1.15 - f)).toFixed(2)}" stroke-opacity="0.8"/>`);
    }
    // wind-carved snow: a few strokes across near cells of powder
    if ((c.s === 'snow' || c.s === 'rough') && q.d < 220 && s <= 6 && hash(Math.floor(x * 2.3), Math.floor(z * 1.7)) > 0.55) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.05, a0 = 0.7 + hash(x, z) * 0.4, pts = [];
      for (let i = 0; i <= 3; i++) { const t = i / 3 - 0.5; pts.push([x + s / 2 + Math.cos(a0) * t * s * 1.4, y0 + Math.sin(i * 1.7) * 0.05, z + s / 2 + Math.sin(a0) * t * s * 1.4]); }
      const p = projLine(pts);
      if (p) add(q.d - 0.03, `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([170, 186, 214], f))}" stroke-width="${(1.1 * (1.1 - f)).toFixed(2)}" stroke-linecap="round" stroke-opacity="0.7"/>`);
    }
  }

  // ---- ink outlines draped on the ground: the green, bunkers, pools, the lake, the fairway's edges, crevasse rims
  const drape = (P, closed, colr, wd, keep = () => true, lift = 0.15) => {
    const pts = closed ? [...P, P[0]] : P;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) {
        const x1 = ax + (bx - ax) * k / n, z1 = az + (bz - az) * k / n, x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n;
        if (!keep((x1 + x2) / 2, (z1 + z2) / 2)) continue;
        const d = cam.hd([x1, 0, z1]); if (d > 900) continue;
        const p = projLine([[x1, gy(x1, z1) + lift, z1], [x2, gy(x2, z2) + lift, z2]]); if (!p) continue;
        const f = fogAt(d);
        add(d - 0.05, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${hex(mix(colr, f))}" stroke-width="${(wd * (1.15 - f)).toFixed(2)}" stroke-linecap="round"/>`);
      }
    }
  };
  for (const t of B.teePads) { const c = Math.cos(headingAt(h.line, 1)), sn = Math.sin(headingAt(h.line, 1)); drape([[-6, -5], [6, -5], [6, 5], [-6, 5]].map(([u, v]) => [t.x + u * c - v * sn, t.z + u * sn + v * c]), true, [120, 146, 180], 0.9); }
  const segDrape = (segs, colr, wd, lift = 0.15) => { for (const [p, q] of segs) drape([p, q], false, colr, wd, () => true, lift); };
  { const [px, pz] = h.pin; segDrape(edgeSegs((x, z) => B.gm(x, z) < 0, px - 45, pz - 45, px + 45, pz + 45, 1), [60, 96, 40], 1.4); }
  for (const b of B.bunkers) segDrape(edgeSegs(B.inBunker(b), ...b.box, b.strip || b.wrap ? 1.2 : 0.8), b.kind === 'sand' ? [40, 40, 44] : [96, 130, 180], 1.2);
  for (const w of h.water || []) drape(seOutline({ x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0 }, 40), true, [60, 110, 130], 1.2);
  if (h.lake) drape(seOutline({ x: h.lake.at[0], z: h.lake.at[1], rx: h.lake.rx, rz: h.lake.rz, rot: h.lake.rot || 0 }, 64), true, [70, 120, 150], 1.3);
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
    segDrape(edgeSegs((x, z) => B.surface(x, z) === 'fairway', Math.min(...xs) - 90, Math.min(...zs) - 40, Math.max(...xs) + 90, Math.max(...zs) + 40, 2), [120, 146, 180], 1.0); }

  // ---- crevasses: ice walls down into the dark (the walls that face the camera), a snow cornice on the
  // raised lip; scarps get an inked top edge. Every crack on the glacier, from its own frame into this one.
  const WALL = [[176, 222, 242], [104, 168, 206], [52, 98, 142], [22, 36, 60]], BANDS = [0, 0.08, 0.26, 0.55, 1];
  const wallRun = (E, inward, depth, lip, seed) => {
    const dc = cam.hd([E[0][0], 0, E[0][1]]), kk = clamp(Math.round(dc / 140), 1, 6), P = E.filter((_, i) => i % kk === 0 || i === E.length - 1);
    let corn = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); if (l < 0.01) continue;
      const nx = -dz / l * inward, nz = dx / l * inward, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, d = cam.hd([mx, 0, mz]);
      if (d > 1400 || !inView(mx, mz, 0.3)) { corn = []; continue; }
      const ya = gy(a[0] - nx * 0.6, a[1] - nz * 0.6), yb = gy(b[0] - nx * 0.6, b[1] - nz * 0.6);
      if (lip) corn.push([a[0], ya + 0.25, a[1]]);
      if ((cam.pos[0] - mx) * nx + (cam.pos[2] - mz) * nz <= 0) continue;
      const f = fogAt(d); let svg = '';
      for (let j = 0; j < 4; j++) {
        const t0 = BANDS[j] * depth, t1 = BANDS[j + 1] * depth, jig = (hash(i + seed, j) - 0.5) * 1.2;
        const q = proj([[a[0], ya - t0 + (j ? jig : 0), a[1]], [b[0], yb - t0 + (j ? jig : 0), b[1]], [b[0], yb - t1, b[1]], [a[0], ya - t1, a[1]]]);
        if (q) { const c = hex(mix(WALL[j].map(v => v * (0.94 + 0.1 * hash(i, seed))), f * 0.85)); svg += `<polygon points="${fmt(q)}" fill="${c}" stroke="${c}" stroke-width="0.6"/>`; }
      }
      const top = projLine([[a[0], ya, a[1]], [b[0], yb, b[1]]]);
      if (top) svg += `<line x1="${top[0][0].toFixed(1)}" y1="${top[0][1].toFixed(1)}" x2="${top[1][0].toFixed(1)}" y2="${top[1][1].toFixed(1)}" stroke="${hex(mix([30, 60, 90], f))}" stroke-width="${(1.1 * (1.2 - f)).toFixed(2)}"/>`;
      add(d - 0.02, svg);
    }
    if (lip && corn.length > 1) for (let i = 0; i < corn.length - 1; i++) {   // the cornice: a thick white lip
      const pa = corn[i], pb = corn[i + 1], d = cam.hd(pa), q = projLine([pa, pb]); if (!q) continue;
      add(d - 0.3, `<line x1="${q[0][0].toFixed(1)}" y1="${q[0][1].toFixed(1)}" x2="${q[1][0].toFixed(1)}" y2="${q[1][1].toFixed(1)}" stroke="white" stroke-width="${(3.2 * (1.15 - fogAt(d)) * Math.min(1, 160 / Math.max(d, 1))).toFixed(2)}" stroke-linecap="round"/>`);
    }
  };
  for (const [ci, a] of CRACKS.entries()) {
    const tr = a.owner >= 0 ? (p => toHere(...WOR[a.owner](...p))) : (p => toHere(...p));
    const [cx, cz] = toHere(...a.c);
    if (cam.hd([cx, 0, cz]) > 1500) continue;
    const o = a.obj;
    if (o.spec && o.open) { const E = o.outline(1.5), L = E.L.map(tr), Rr = E.R.map(tr); wallRun(L, 1, o.depth, E.lipEdge === 'L', ci * 7); wallRun(Rr, -1, o.depth, E.lipEdge === 'R', ci * 7 + 3); }
    else if (o.spec) {   // a scarp: ink its top edge, just on the high side
      const P = o.scarpLine(2), side = o.lip.side, Q = [];
      for (let i = 0; i < P.length - 1; i++) { const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dz) || 1; const k = o.faceAt(i * 2) + 1.2; Q.push(tr([P[i][0] - dz / l * side * k, P[i][1] + dx / l * side * k])); }
      drape(Q, false, [40, 80, 120], 1.8, () => true, 0.3); drape(Q, false, [250, 252, 255], 1.0, () => true, 0.45);
    } else { const E = o.outline(120).map(tr); wallRun(E, -1, 40, false, ci); }
  }

  // ---- solids
  const ink = (d, a = 1) => `stroke="${hex(mix([36, 40, 50], fogAt(d) * 0.9))}" stroke-opacity="${a}"`;
  const face = (P3s, colr, d, extra = '', seed = 1, sw = 1, op = 1) => {
    const P = proj(P3s); if (!P) return null;
    const f = fogAt(d); return `<polygon points="${fmt(P)}" fill="${hex(mix(colr, f))}" fill-opacity="${op}" stroke="none"/>` +
      `<polyline points="${fmt(wob(P, true, seed))}" fill="none" ${ink(d, op < 1 ? 0.5 : 1)} stroke-width="${(sw * (1.3 - f)).toFixed(2)}" stroke-linejoin="round"/>` + extra;
  };
  // a prism over a footprint (local x, z), tapering toward its top; top heights per corner for a cut top
  function prismUp(pts, y0, tops, colr, seed, kb = 0, taper = 1, op = 1) {
    const ctr = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length], d0 = cam.hd([ctr[0], 0, ctr[1]]);
    if (d0 > 1500 || !inView(ctr[0], ctr[1], 0.4 + 30 / Math.max(d0, 1))) return;
    const top = pts.map((p, i) => [ctr[0] + (p[0] - ctr[0]) * taper, typeof tops === 'number' ? tops : tops[i], ctr[1] + (p[1] - ctr[1]) * taper]);
    if (cam.pos[1] > Math.min(...top.map(p => p[1]))) { const s = face(top, colr.map(v => v * 1.05), d0, '', seed + 9, 0.7, op); if (s) add(d0 + kb + 0.01, s); }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const nx = mx - ctr[0], nz = mz - ctr[1];
      if ((cam.pos[0] - mx) * nx + (cam.pos[2] - mz) * nz <= 0) continue;
      const dd = cam.hd([mx, 0, mz]), lit = 0.82 + 0.2 * Math.max(0, (nx * L[0] + nz * L[2]) / Math.hypot(nx, nz));
      const s = face([[a[0], y0, a[1]], [b[0], y0, b[1]], top[(i + 1) % pts.length], top[i]], colr.map(v => v * lit), dd, '', seed + i, 0.8, op); if (s) add(dd + kb, s);
    }
  }
  const ngon = (x, z, r, n, rot = 0, sq = 1) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * 6.283; return [x + Math.cos(a) * r, z + Math.sin(a) * r * sq]; });
  function prism(a, b, w, t, colr, seed, op = 1) {  // an oriented beam from a to b (each [x, z, y])
    const dx = b[0] - a[0], dz = b[1] - a[1], dy = b[2] - a[2], len = Math.hypot(dx, dz, dy), ux = dx / len, uz = dz / len, uy = dy / len;
    let nx = -dz, nz = dx; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    const up = [-(uy * ux), 1 - uy * uy, -(uy * uz)]; const ul = Math.hypot(...up); up.forEach((v, i) => up[i] = v / ul);
    const C = (p, sa, sb) => [p[0] + nx * w / 2 * sa + up[0] * t / 2 * sb, p[2] + up[1] * t / 2 * sb, p[1] + nz * w / 2 * sa + up[2] * t / 2 * sb];
    const c8 = { a: [C(a, -1, -1), C(a, 1, -1), C(a, 1, 1), C(a, -1, 1)], b: [C(b, -1, -1), C(b, 1, -1), C(b, 1, 1), C(b, -1, 1)] };
    const mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2, (a[1] + b[1]) / 2];
    const faces = [[c8.a[0], c8.a[1], c8.b[1], c8.b[0]], [c8.a[1], c8.a[2], c8.b[2], c8.b[1]], [c8.a[2], c8.a[3], c8.b[3], c8.b[2]], [c8.a[3], c8.a[0], c8.b[0], c8.b[3]], c8.a, c8.b];
    for (const [i, F] of faces.entries()) {
      const fc = F.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
      const out = [fc[0] - mid[0], fc[1] - mid[1], fc[2] - mid[2]], toC = [cam.pos[0] - fc[0], cam.pos[1] - fc[1], cam.pos[2] - fc[2]];
      if (out[0] * toC[0] + out[1] * toC[1] + out[2] * toC[2] <= 0) continue;
      const s = face(F, colr.map(v => v * (0.84 + 0.05 * i)), cam.hd(fc), '', seed + i, 0.9, op); if (s) add(cam.hd(fc) - 0.5, s);
    }
  }
  function spruce(x, z, y0, r, hh, seed) {
    const d = cam.hd([x, 0, z]); if (d > 1100 || !inView(x, z, 0.3)) return;
    const f = fogAt(d); let svg = '';
    const g = [[52, 84, 70], [46, 76, 64], [60, 92, 76]][Math.floor(hash(seed, 3) * 3)];
    for (let k = 0; k < 3; k++) {   // three tiers, snow on each
      const yb = y0 + hh * (0.15 + k * 0.27), yt = yb + hh * 0.45, rr = r * (1 - k * 0.28);
      const p = proj([[x - rr * cam.r[0], yb, z - rr * cam.r[2]], [x + rr * cam.r[0], yb, z + rr * cam.r[2]], [x, yt, z]]);
      if (!p) continue;
      svg += `<polygon points="${fmt(p)}" fill="${hex(mix(g, f))}" stroke="${hex(mix([30, 44, 38], f))}" stroke-width="${(0.7 * (1.2 - f)).toFixed(2)}"/>`;
      const sn = proj([[x - rr * 0.7 * cam.r[0], yb + hh * 0.08, z - rr * 0.7 * cam.r[2]], [x + rr * 0.15 * cam.r[0], yb + hh * 0.06, z + rr * 0.15 * cam.r[2]], [x, yt, z]]);
      if (sn) svg += `<polygon points="${fmt(sn)}" fill="${hex(mix([238, 242, 250], f))}" fill-opacity="0.75"/>`;
    }
    add(d - 0.2, svg);
  }
  function brazier(x, z, y0) {
    const d = cam.hd([x, 0, z]); if (d > 700 || !inView(x, z, 0.2)) return;
    const pole = projLine([[x, y0, z], [x, y0 + 1.6, z]]); if (!pole) return;
    const f = fogAt(d), c = pole[1], rr = Math.max(1.8, 0.6 / cam.view([x, y0 + 1.6, z])[2] * FPX);
    add(d - 0.3, `<line x1="${pole[0][0].toFixed(1)}" y1="${pole[0][1].toFixed(1)}" x2="${c[0].toFixed(1)}" y2="${c[1].toFixed(1)}" ${ink(d)} stroke-width="1"/>` +
      `<circle cx="${c[0].toFixed(1)}" cy="${(c[1] - rr * 0.6).toFixed(1)}" r="${(rr * 2.6).toFixed(1)}" fill="#ffd08a" fill-opacity="${(0.35 * (1 - f)).toFixed(2)}"/>` +
      `<circle cx="${c[0].toFixed(1)}" cy="${(c[1] - rr * 0.6).toFixed(1)}" r="${rr.toFixed(1)}" fill="${hex(mix([240, 150, 40], f * 0.5))}"/>`);
  }
  function steam(x, z, y0, r, seed) {
    const d = cam.hd([x, 0, z]); if (d > 900 || !inView(x, z, 0.3)) return;
    let svg = '';
    if (d < 30) return;
    for (let k = 0; k < 2; k++) {
      const v = cam.view([x + (hash(seed, k) - 0.5) * r, y0 + 1 + k * r * 0.6, z + (hash(k, seed) - 0.5) * r]); if (v[2] < 2) continue;
      const c = cam.scr(v), pr = r * (0.55 + k * 0.3) / v[2] * FPX;
      svg += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${pr.toFixed(1)}" ry="${(pr * 0.55).toFixed(1)}" fill="white" fill-opacity="${(0.3 - k * 0.12).toFixed(2)}"/>`;
    }
    add(d - 0.6, svg);
  }

  function drawObjs(objs, map, yoff, Hk) {
    for (const o of objs) {
      const tr = p => map(p[0], p[1]);
      if (o.kind === 'serac') {
        const [x, z] = tr([o.x, o.z]), R_ = rnd(o.seed), n = 6, pts = ngon(x, z, o.r, n, R_() * 6, 0.75 + R_() * 0.4);
        const tops = pts.map(() => o.base + yoff + o.h * (0.72 + 0.28 * R_()));
        prismUp(pts, o.base + yoff, tops, [178, 214, 232], o.seed, 0, 0.62);
      } else if (o.kind === 'icicle') {
        // a hanging column of ice: wide at the lip, tapering to a drip; pale, with a darker blue edge
        const [x, z] = tr([o.x, o.z]), d = cam.hd([x, 0, z]); if (d > 900 || !inView(x, z, 0.3)) continue;
        const y1 = o.top + yoff, y0 = y1 - o.len, lean = (hash(o.seed, 1) - 0.5) * 0.6, r = o.r;
        const p = proj([[x - r * cam.r[0], y1, z - r * cam.r[2]], [x + r * cam.r[0], y1, z + r * cam.r[2]], [x + r * 0.45 * cam.r[0] + lean, y1 - o.len * 0.55, z + r * 0.45 * cam.r[2]], [x + lean * 1.5, y0, z], [x - r * 0.5 * cam.r[0] + lean, y1 - o.len * 0.5, z - r * 0.5 * cam.r[2]]]);
        if (p) { const f = fogAt(d); add(d - 0.6 - hash(o.seed, 2) * 0.3, `<polygon points="${fmt(p)}" fill="${hex(mix([222, 240, 250].map(v => v * (0.93 + 0.07 * hash(o.seed, 3))), f))}" stroke="${hex(mix([92, 146, 182], f))}" stroke-width="${(0.8 * (1.2 - f)).toFixed(2)}" stroke-linejoin="round"/>`); }
      } else if (o.kind === 'icefall') {
        // a column of a frozen waterfall: lumpy sides, a waist, a skirt where it lands; a pale glint down it
        const [x, z] = tr([o.x, o.z]), d = cam.hd([x, 0, z]); if (d > 900 || !inView(x, z, 0.3)) continue;
        const y1 = o.top + yoff, r = o.r, ph = hash(o.seed, 4) * 6, N = 9, Lp = [], Rp = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, w = r * (1 - 0.28 * Math.sin(Math.PI * t) + 0.14 * Math.sin(t * 11 + ph)) + r * 0.9 * Math.max(0, (t - 0.78) / 0.22) ** 2, y = y1 - o.len * t;
          Lp.push([x - w * cam.r[0], y, z - w * cam.r[2]]); Rp.push([x + w * cam.r[0], y, z + w * cam.r[2]]);
        }
        const p = proj([...Lp, ...Rp.reverse()]), g = projLine([[x + r * 0.25 * cam.r[0], y1 - o.len * 0.05, z + r * 0.25 * cam.r[2]], [x + r * 0.15 * cam.r[0], y1 - o.len * 0.8, z + r * 0.15 * cam.r[2]]]);
        if (p) { const f = fogAt(d), sh = 0.9 + 0.1 * hash(o.seed, 3);
          add(d - 0.6 - hash(o.seed, 2) * 0.3, `<polygon points="${fmt(p)}" fill="${hex(mix([214 * sh, 236 * sh, 248], f))}" stroke="${hex(mix([104, 152, 188], f))}" stroke-width="${(0.7 * (1.2 - f)).toFixed(2)}" stroke-linejoin="round"/>` + (g ? `<polyline points="${fmt(g)}" fill="none" stroke="${hex(mix([250, 253, 255], f))}" stroke-width="1.4" stroke-linecap="round"/>` : '')); }
      } else if (o.kind === 'iceblock') {
        const [x, z] = tr([o.x, o.z]), R_ = rnd(o.seed), pts = ngon(x, z, o.r, 5, R_() * 6, 0.6 + R_() * 0.5);
        const b0 = o.base !== undefined ? o.base + yoff : (o.base = (worldAt(o.x, o.z).y ?? 0) - 0.8);
        prismUp(pts, b0, pts.map((p, i) => b0 + o.h * (0.55 + 0.45 * R_()) + (p[0] - x) * o.tilt * 0.5), [200, 226, 242], o.seed, 0, 0.7);
      } else if (o.kind === 'boulder') {
        const [x, z] = tr([o.x, o.z]), pts = ngon(x, z, o.r * 0.8, 6, hash(x, z) * 6, 0.8);
        prismUp(pts, o.base + yoff, pts.map((_, i) => o.base + yoff + o.h * (0.75 + 0.25 * hash(i, x))), [96, 98, 108], Math.round(x + z), 0, 0.6);
      } else if (o.kind === 'tree') { const p = tr([o.x, o.z]); spruce(p[0], p[1], o.base + yoff, o.r, o.h, Math.round(o.x * 7 + o.z)); }
      else if (o.kind === 'brazier') { const p = tr([o.x, o.z]); brazier(p[0], p[1], o.base + yoff); }
      else if (o.kind === 'steam') { const p = tr([o.x, o.z]); steam(p[0], p[1], o.base + yoff, o.r, Math.round(o.x * 3 + o.z)); }
      else if (o.kind === 'roof') { const pts = o.pts.map(tr); prismUp(pts, o.y + yoff, o.y + yoff + o.t, [190, 218, 234], 3, -0.3); }
      else if (o.kind === 'arch') {
        const a = tr(o.a), b = tr(o.b), N = 8;
        for (let k = 0; k < N; k++) {
          const t0 = k / N, t1 = (k + 1) / N, P0 = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, o.a[2] + yoff + (o.b[2] - o.a[2]) * t0 + o.h * Math.sin(Math.PI * t0)],
            P1 = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, o.a[2] + yoff + (o.b[2] - o.a[2]) * t1 + o.h * Math.sin(Math.PI * t1)];
          prism(P0, P1, o.w, o.t, [184, 218, 236], 41 + k);
        }
      } else if (o.kind === 'hall') {
        const pts = o.pts.map(tr), y0 = o.base + yoff, y1 = y0 + o.h, ctr = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4];
        prismUp(pts, y0, y1, [150, 114, 82], 61);
        // the long roof: a ridge down the middle of the long side, turf and snow on it, carved heads at both gables
        const m01 = [(pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2], m12 = [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2];
        const yr = y1 + o.roof, d0 = cam.hd([ctr[0], 0, ctr[1]]);
        const r1 = proj([[pts[0][0], y1, pts[0][1]], [pts[1][0], y1, pts[1][1]], [m12[0], yr, m12[1]], [m01[0], yr, m01[1]]]);
        const r2 = proj([[pts[3][0], y1, pts[3][1]], [pts[2][0], y1, pts[2][1]], [m12[0], yr, m12[1]], [m01[0], yr, m01[1]]]);
        for (const [i, r] of [r1, r2].entries()) if (r) add(d0 - 0.4 - i * 0.05, `<polygon points="${fmt(r)}" fill="${hex(mix(i ? [214, 224, 236] : [236, 240, 248], fogAt(d0)))}" stroke="${hex(mix([60, 52, 46], fogAt(d0)))}" stroke-width="1"/>`);
        for (const m of [m01, m12]) prism([m[0], m[1], yr - 0.5], [m[0] + (m[0] - ctr[0]) * 0.12, m[1] + (m[1] - ctr[1]) * 0.12, yr + 3.5], 0.9, 0.9, [90, 64, 44], 62);
        // lit windows: a row of warm squares along the walls
        for (let i = 0; i < 4; i++) {
          const a = pts[i], b = pts[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 30) continue;
          for (let t = 0.1; t < 0.95; t += 0.12) { const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], q = proj([[p[0], y0 + 2.2, p[1]], [p[0] + (b[0] - a[0]) / len * 2, y0 + 2.2, p[1] + (b[1] - a[1]) / len * 2], [p[0] + (b[0] - a[0]) / len * 2, y0 + 4, p[1] + (b[1] - a[1]) / len * 2], [p[0], y0 + 4, p[1]]]);
            const mx = (a[0] + b[0]) / 2 - ctr[0], mz = (a[1] + b[1]) / 2 - ctr[1]; if (q && (cam.pos[0] - (a[0] + b[0]) / 2) * mx + (cam.pos[2] - (a[1] + b[1]) / 2) * mz > 0) add(cam.hd([p[0], 0, p[1]]) - 0.6, `<polygon points="${fmt(q)}" fill="#f2b84b"/>`); }
        }
      } else if (o.kind === 'longship') {
        const [x, z] = tr([o.x, o.z]), d = cam.hd([x, 0, z]), c = Math.cos(o.rot), s = Math.sin(o.rot), P = [];
        for (let i = 0; i <= 30; i++) { const t = -1 + 2 * i / 30; P.push([t * o.len / 2, o.beam / 2 * (1 - t * t) ** 0.7]); }
        for (let i = 30; i >= 0; i--) { const t = -1 + 2 * i / 30; P.push([t * o.len / 2, -o.beam / 2 * (1 - t * t) ** 0.7]); }
        const p = proj(P.map(([u, v]) => [x + u * c - v * s, o.y + yoff + 0.4, z + u * s + v * c]));
        const mast = o.out ? null : projLine([[x, o.y + yoff + 0.4, z], [x - s * 6, o.y + yoff + 0.4, z + c * 6]]);
        if (p) add(d - 0.04, `<polygon points="${fmt(p)}" fill="#5a4636" fill-opacity="0.5" stroke="#4a3626" stroke-opacity="0.7" stroke-width="1.2"/>` +
          (mast ? `<polyline points="${fmt(mast)}" stroke="#4a3626" stroke-opacity="0.6" stroke-width="1.4"/>` : ''));
        // the light under the ice
        if (p) add(d - 0.03, `<polygon points="${fmt(p)}" fill="#9fe0ff" fill-opacity="0.18"/>`);
        if (o.out) {   // the bow rising out of the ice, the dragon's neck curling up off it
          const ph = o.rise * Math.PI / 180, bu = o.len / 2 - o.out * Math.cos(ph), y0 = o.y + yoff + 0.6;
          const H = (u, v, l = 0) => [x + c * (bu + u * Math.cos(ph) - v * Math.sin(ph)) - s * l, y0 + u * Math.sin(ph) + v * Math.cos(ph), z + s * (bu + u * Math.cos(ph) - v * Math.sin(ph)) + c * l];
          const side = proj([H(0, -1.5), H(o.out, 0.4), H(o.out, 2.2), H(o.out * 0.5, 1.0), H(0, 0.6)]), neck = projLine([H(o.out, 2.2), H(o.out + 0.75, 3.1), H(o.out + 0.55, 4.4), H(o.out + 0.1, 5.2), H(o.out + 1.4, 5.7)]);
          if (side) add(d - 0.05, `<polygon points="${fmt(side)}" fill="#6a5440" stroke="#3a2a1c" stroke-width="1.2"/>` + (neck ? `<polyline points="${fmt(neck)}" fill="none" stroke="#3a2a1c" stroke-width="2"/>` : ''));
        }
      } else if (o.kind === 'mammoth') {
        // in the ice of the valley wall, its side to the hole: body, head, a curl of tusk breaking out
        const [x, z] = tr([o.x, o.z]), y = o.base + yoff + 6, ux = Math.sin(o.dir), uz = -Math.cos(o.dir), nx = -uz, nz = ux, col = [120, 92, 70];
        prism([x - ux * 5, z - uz * 5, y], [x + ux * 4, z + uz * 4, y + 0.5], 4.5, 5.5, col, 71, 0.75);
        prism([x + ux * 4, z + uz * 4, y + 1], [x + ux * 7.5, z + uz * 7.5, y - 0.5], 3.2, 4, col.map(v => v * 0.9), 72, 0.75);
        for (const k of [-0.8, 0.8]) {
          const b0 = [x + ux * 7.5 + nx * k + nx * 1.5, z + uz * 7.5 + nz * k + nz * 1.5, y - 2], b1 = [b0[0] + ux * 3 + nx * 2.5, b0[1] + uz * 3 + nz * 2.5, y - 3.2], b2 = [b1[0] + ux * 2.5 + nx * 1.5, b1[1] + uz * 2.5 + nz * 1.5, y - 1];
          prism(b0, b1, 0.6, 0.6, [236, 226, 200], 73); prism(b1, b2, 0.5, 0.5, [236, 226, 200], 74);
        }
        for (const [a, b] of [[-3.5, -1], [2, 3.5]]) for (const k of [-1, 1]) prism([x + ux * a + nx * k, z + uz * a + nz * k, y - 2.5], [x + ux * b + nx * k, z + uz * b + nz * k, y - 6], 1.2, 1.2, col.map(v => v * 0.85), 75, 0.7);
      } else if (o.kind === 'moulin') {
        const [x, z] = tr([o.x, o.z]), d = cam.hd([x, 0, z]), P = [];
        for (let a = 0; a < 6.283; a += 0.1) P.push([x + Math.cos(a) * o.r * 0.55, gy(x, z) - 0.5, z + Math.sin(a) * o.r * 0.55]);
        const p = proj(P); if (p) add(d - 0.02, `<polygon points="${fmt(p)}" fill="#3d8fc8" fill-opacity="0.35"/>`);
      }
    }
  }
  drawObjs(B.objs, (x, z) => [x, z], h.base, h);
  // the glacier's scenery: ridges of ice blocks and serac bands, bases on the glacier (absolute heights)
  drawObjs(WORLD.objs.filter(o => { const [x, z] = toHere(o.x, o.z); return cam.hd([x, 0, z]) < 1500; }).map(o => o.kind === 'serac' && o.base === undefined ? Object.assign(o, { base: (worldAt(o.x, o.z).y ?? 0) - 1 }) : o), toHere, 0, null);
  for (const [k, Hk] of HOLES.entries()) {
    if (k === hi) continue;
    const Wk = WOR[k], m = (x, z) => toHere(...Wk(x, z));
    const near = [Hk.line[0], Hk.pin].some(p => Math.hypot(...toHere(...Wk(...p)).map((v, i) => v - [cam.pos[0], cam.pos[2]][i])) < 900);
    drawObjs(BUILT[k].objs.filter(o => near || ['hall', 'serac', 'roof'].includes(o.kind)), m, Hk.base, Hk);
  }
  // the flag
  { const [x, z] = h.pin, y0 = gy(x, z), d = cam.hd([x, 0, z]);
    const pole = projLine([[x, y0, z], [x, y0 + 2.6, z]]), fl = proj([[x, y0 + 2.6, z], [x + 1.1, y0 + 2.25, z], [x, y0 + 1.9, z]]);
    if (pole) add(d - 2, `<line x1="${pole[0][0].toFixed(1)}" y1="${pole[0][1].toFixed(1)}" x2="${pole[1][0].toFixed(1)}" y2="${pole[1][1].toFixed(1)}" stroke="#222" stroke-width="1.3"/>` + (fl ? `<polygon points="${fmt(fl)}" fill="#c0392b"/>` : '')); }

  polys.sort((a, b) => b.key - a.key);
  // labels: named things and targets in view, with leader lines
  const labels = [];
  const lab = (p3, text, dy = -40) => { const v = cam.view(p3); if (v[2] < 18) return; const s = cam.scr(v); if (s[0] < 40 || s[0] > VW - 40 || s[1] < 20 || s[1] > VH - 10) return; labels.push({ s, text, dy }); };
  for (const t of view.labels || []) lab(t.p, t.text, t.dy);
  labels.sort((a, b) => a.s[0] - b.s[0]);
  const placed = []; let lsvg = '';
  for (const L_ of labels) {
    let ty = L_.s[1] + L_.dy; const w = L_.text.length * 8.2 + 14;
    for (let k = 0; k < 8; k++) { if (!placed.some(p => Math.abs(p.x - L_.s[0]) < (p.w + w) / 2 + 4 && Math.abs(p.y - ty) < 22)) break; ty -= 24; }
    ty = clamp(ty, 16, VH - 16); placed.push({ x: L_.s[0], y: ty, w });
    lsvg += `<line x1="${L_.s[0].toFixed(1)}" y1="${L_.s[1].toFixed(1)}" x2="${L_.s[0].toFixed(1)}" y2="${(ty + 9).toFixed(1)}" stroke="#333" stroke-width="0.8"/>` +
      `<circle cx="${L_.s[0].toFixed(1)}" cy="${L_.s[1].toFixed(1)}" r="2.2" fill="#333"/>` +
      `<rect x="${(L_.s[0] - w / 2).toFixed(1)}" y="${(ty - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="3" fill="white" fill-opacity="0.9" stroke="#333" stroke-width="0.6"/>` +
      `<text x="${L_.s[0].toFixed(1)}" y="${(ty + 4.5).toFixed(1)}" font-family="DejaVu Sans, sans-serif" font-size="13" text-anchor="middle" fill="#222">${L_.text}</text>`;
  }
  // the sky: pale night blue, the mountains round the glacier, the aurora's curtains over them
  const hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 4000, cam.pos[1], cam.pos[2] + cam.f[2] * 4000]))[1];
  const az0 = Math.atan2(cam.f[0], -cam.f[2]);
  let mtn = '';
  for (const [dist, hgt, col, sd] of [[5200, 900, [214, 222, 236], 7], [3400, 520, [196, 206, 224], 3]]) {
    const pts = [];
    for (let i = -48; i <= 48; i++) {
      const a = az0 + i / 48 * (HFOV / 2 + 0.25), [X, Z] = W(cam.pos[0], cam.pos[2]);
      const wa = a + h.place.heading * Math.PI / 180;
      const pk = hgt * (0.45 + 0.35 * Math.abs(Math.sin(wa * 3.1 + sd)) + 0.2 * Math.abs(Math.sin(wa * 11.3 + sd * 2)) ** 1.5);
      const p = [cam.pos[0] + Math.sin(a) * dist, 90 + pk, cam.pos[2] - Math.cos(a) * dist], v = cam.view(p);
      if (v[2] > 1) pts.push(cam.scr(v));
    }
    if (pts.length > 2) {
      const poly = [...pts, [pts.at(-1)[0], VH + 50], [pts[0][0], VH + 50]];
      mtn += `<polygon points="${fmt(poly)}" fill="${hex(col)}" stroke="${hex(col.map(v => v * 0.82))}" stroke-width="1"/>`;
      // snow lines down the faces
      for (let i = 2; i < pts.length - 2; i += 3) mtn += `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${(pts[i][0] + 6).toFixed(1)}" y2="${(pts[i][1] + 40).toFixed(1)}" stroke="${hex(col.map(v => v * 0.9))}" stroke-width="0.8"/>`;
    }
  }
  let aur = '';
  for (let b = 0; b < 3; b++) {
    const y0 = clamp(hz - 230 - b * 90, 20, VH * 0.5), pts = [];
    for (let x = -50; x <= VW + 50; x += 40) pts.push([x, y0 + 40 * Math.sin(x * 0.004 + b * 1.7 + hi) + 18 * Math.sin(x * 0.011 + b)]);
    const top = pts.map(([x, y]) => [x, y - 70 - 30 * Math.sin(x * 0.007 + b)]);
    aur += `<polygon points="${fmt([...pts, ...top.reverse()])}" fill="url(#aur${b % 2})" fill-opacity="${(0.55 - b * 0.12).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dde5f2"/><stop offset="${clamp(hz / VH, 0.05, 0.95).toFixed(3)}" stop-color="#eef2f8"/><stop offset="1" stop-color="#eef2f8"/></linearGradient>` +
    `<linearGradient id="aur0" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7fe0b0"/><stop offset="0.6" stop-color="#a8ecc8" stop-opacity="0.6"/><stop offset="1" stop-color="#c8b8f0" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="aur1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#b8a6ee"/><stop offset="0.7" stop-color="#a6e6c6" stop-opacity="0.4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/>` + aur + mtn + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee, from the landing area (par 3: the forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], W = WOR[hi], g = (x, z) => { const v = worldAt(...W(x, z)); return v.y ?? v.raw ?? 0; };
  const eye = (p, toward, back = 4, up = 5) => {
    const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const x = p[0] - ux * back, z = p[1] - uz * back, y = Math.max(g(x, z), g(p[0], p[1])) + up;
    return [x, y, z];
  };
  const look = (p, toward, drop = 0) => { const yy = g(...toward); return [toward[0], yy + 1 - drop, toward[1]]; };
  const pin = h.pin, tee = h.teePts.mammoth;
  const firstT = (h.targets || [])[0] || { at: pin };
  const labelSet = [];
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  for (const t of h.targets || []) labelSet.push(L3(t.at, t.name, -46));
  labelSet.push(L3(pin, 'green', -60));
  if (h.lake) labelSet.push(L3(at(h.line, 70, 40), 'the frozen lake', -34));
  if (h.openWater) labelSet.push(L3(h.openWater.at, 'open water', -30));
  if (h.longship) labelSet.push(L3(h.longship.at, 'the longship', -70));
  if (h.moulin) labelSet.push(L3(h.moulin.at, 'the moulin', -40));
  if (h.mammoth) labelSet.push(L3(h.mammoth.at, 'the mammoth', -50, 6));
  if (h.falls) labelSet.push(L3(at(h.line, h.falls.s, 12), 'the frozen falls', -40, 0));
  if (h.seracs) labelSet.push(L3(at(h.line, 186, -30), 'the seracs', -110, 20));
  if (h.arch) labelSet.push(L3(at(h.line, 418, -45), 'ice bridge', -40, 9));
  if (h.hall) labelSet.push(L3(h.hall.at, 'the hall', -60, 14));
  if (h.esker) labelSet.push(L3(at(h.line, 150, 0), 'the esker', -40));
  for (const [p, t] of h.voidLabels || []) labelSet.push(L3(at(h.line, ...p), t, -36));
  for (const w of h.water || []) if (w.label) labelSet.push(L3(w.at, w.label, -36));
  for (const f of h.forms || []) if (f.label) labelSet.push(L3(f.at, f.label, -36, f.h));
  const v = [];
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin), look: look(tee, pin, 6) });
    const fw = h.teePts.hare; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin), look: look(fw, pin, 5) });
  } else {
    const aim = firstT.at;
    const tb = ((h.sketch || {}).tee || {}).back || 4;
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, aim, tb), look: look(tee, aim, 6) });
    const next = (h.targets || []).find(t => t !== firstT && !t.bold);
    const to = next && h.par === 5 ? next.at : pin;
    v.push({ id: 'land', title: 'From the landing area', fov: 50, pos: eye(aim, to), look: look(aim, to, 6) });
  }
  const gback = ((h.sketch || {}).green || {}).back || 55;
  const goff = ((h.sketch || {}).green || {}).off || 0, sg2 = at(h.line, h.len - gback, goff), past = at(h.line, h.len + 25);
  v.push({ id: 'green', title: 'Short of the green', fov: 50, pos: eye(sg2, pin, 0, 9), look: [past[0], g(...h.pin) - 2, past[1]] });
  for (const x of v) { x.labels = labelSet; const o = (h.sketch || {})[x.id]; if (o) { if (o.up) x.look[1] += o.up; if (o.fov) x.fov = o.fov; if (o.eye) x.pos[1] += o.eye; } }
  return v;
}

const only = process.argv.slice(2).map(Number);
if (import.meta.url === pathToFileURL(process.argv[1]).href) for (const [hi, h] of HOLES.entries()) {
  if (only.length && !only.includes(h.n)) continue;
  for (const v of viewsFor(hi)) {
    const t0 = Date.now(), svg = renderView(hi, v), f = `${OUT}/h${h.n}_${v.id}`;
    fs.writeFileSync(f + '.svg', svg);
    execFileSync('rsvg-convert', ['--unlimited', '-w', '1600', '-o', f + '.png', f + '.svg']);
    console.log(h.n, v.id, (svg.length / 1e6).toFixed(1) + ' MB', Date.now() - t0 + ' ms');
  }
}
