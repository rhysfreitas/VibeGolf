// node tools/emberfell/sketch.mjs [holes] : the plan book's sketch views. Simple 3D shapes from the plan data
// (ground cells, boulders, trees, lava trees, basalt columns, the tube's walls and mouths, the spatter vent, the
// clubhouse, fumaroles), projected through a real camera and drawn as ink and washes in SVG, hazed with
// distance. Past 1.7 km the mountain is drawn as silhouettes from the same height function (the caldera's far
// walls, the cone, the sea at the horizon), under a pale dusk sky with the plume and its lightning, drawn light
// so the book prints. out/views/h<n>_<tee|land|green>.svg (+ .png). Painter's order by horizontal distance.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES, BACK, FRONT } from './holes.mjs';
import { BUILT, toWorld, toLocal, worldAt, CRACKS } from './scene.mjs';
import { V, FALL, VENT, POOL, INSIDE, ISLAND, NECK, LAKE } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, clamp, seOutline, lengthOf, rnd, project } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [242, 234, 230], MIST = 900;
const SC = { flow: [120, 116, 116], rough: [206, 214, 172], fairway: [170, 206, 130], fringe: [152, 198, 112], green: [160, 214, 120], tee: [184, 212, 150],
  sand: [216, 214, 208], scoria: [198, 124, 102], lava: [250, 132, 42], rock: [96, 94, 100], rubble: [170, 166, 164], cinder: [184, 120, 102], ash: [224, 218, 208],
  forest: [86, 124, 88], sulfur: [236, 220, 124], hall: [64, 62, 66], void: [26, 26, 30] };
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);

const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.88, 1 - Math.exp(-Math.max(0, d - 40) / MIST));
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
    else { ys = c.s === 'lava' ? k.map(() => c.y) : k.map(v => v.s === 'lava' && c.s !== 'lava' ? v.y + 0.0 : v.y ?? c.y); col = SC[c.s] || SC.ash; }
    const dx = ((ys[1] + ys[2]) - (ys[0] + ys[3])) / (2 * s), dz = ((ys[2] + ys[3]) - (ys[0] + ys[1])) / (2 * s);
    const n = [-dx, 1, -dz], nl = Math.hypot(...n), lam = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl, 0, 1);
    const tex = c.s === 'fairway' || c.s === 'tee' ? 0.985 + 0.03 * (Math.floor(Math.hypot(x, z) / 9) % 2) : c.s === 'flow' ? 0.9 + 0.2 * hash(Math.floor(x / 3), Math.floor(z / 3)) : c.s === 'ash' || c.s === 'cinder' ? 0.98 + 0.04 * hash(Math.floor(x / 5), Math.floor(z / 5)) : 1;
    // lava glows: no shading, little haze
    const glow = c.s === 'lava';
    col = glow ? col.map((v, i) => v * (0.94 + 0.12 * hash(Math.floor(x / 4), Math.floor(z / 4)))) : col.map(v => v * (0.78 + 0.24 * lam) * tex);
    const P = proj([[x, ys[0], z], [x + s, ys[1], z], [x + s, ys[2], z + s], [x, ys[3], z + s]]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d) * (c.y === null ? 0.4 : glow ? 0.35 : 1)));
    // open air (a crevasse's floor in the dark) goes down first, under its walls and everything else
    add(c.y === null ? q.d + 5000 : q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    // grains in the bunkers; the crust on the lava: dark plates with bright cracks between
    if ((c.s === 'sand' || c.s === 'scoria') && q.d < 300 && s <= 4) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.05, col = hex(mix(c.s === 'sand' ? [150, 150, 146] : [140, 60, 44], f));
      let dots = '';
      for (let i = 0; i < 3; i++) { const v = cam.view([x + hash(x + i, z) * s, y0, z + hash(z + i, x) * s]); if (v[2] < 1) continue; const p = cam.scr(v); dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0.6, 1.4 * (1.1 - f)).toFixed(2)}" fill="${col}"/>`; }
      if (dots) add(q.d - 0.03, dots);
    }
    if (glow && q.d < 900 && s <= 12 && hash(Math.floor(x / 7), Math.floor(z / 7)) > 0.45) {
      const y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.05, cx = x + s * (0.2 + 0.6 * hash(x, z)), cz = z + s * (0.2 + 0.6 * hash(z, x)), r = s * (0.22 + 0.2 * hash(x + 3, z));
      const P2 = proj(Array.from({ length: 6 }, (_, i) => { const a = i / 6 * 6.283 + hash(x, i); return [cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r * 0.8]; }));
      if (P2) add(q.d - 0.02, `<polygon points="${fmt(P2)}" fill="${hex(mix([92, 46, 34], fogAt(q.d) * 0.4))}" fill-opacity="0.75"/>`);
    }
    // fresh lava: a rough, broken surface; a few strokes of crust on near cells
    if (c.s === 'flow' && q.d < 260 && s <= 6 && hash(Math.floor(x * 2.3), Math.floor(z * 1.7)) > 0.5) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.08, a0 = hash(x, z) * 6.28, pts = [];
      for (let i = 0; i <= 3; i++) { const t = i / 3 - 0.5, j = (hash(x + i, z) - 0.5) * s * 0.6; pts.push([x + s / 2 + Math.cos(a0) * t * s * 1.3 - Math.sin(a0) * j, y0, z + s / 2 + Math.sin(a0) * t * s * 1.3 + Math.cos(a0) * j]); }
      const p = projLine(pts);
      if (p) add(q.d - 0.03, `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([62, 58, 58], f))}" stroke-width="${(1.1 * (1.15 - f)).toFixed(2)}" stroke-opacity="0.8"/>`);
    }
  }

  // ---- ink outlines draped on the ground: the green, bunkers, the lava's shore, the fairway's edges
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
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
    segDrape(edgeSegs((x, z) => B.surface(x, z) === 'lava', Math.min(...xs) - 160, Math.min(...zs) - 160, Math.max(...xs) + 160, Math.max(...zs) + 160, 2.5), [150, 50, 16], 1.3, 0.1); }
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
    segDrape(edgeSegs((x, z) => B.surface(x, z) === 'fairway', Math.min(...xs) - 90, Math.min(...zs) - 40, Math.max(...xs) + 90, Math.max(...zs) + 40, 2), [120, 146, 180], 1.0); }

  // ---- the tube's trench and skylights: basalt walls down into the dark (the walls that face the camera);
  // scarps (the flow fronts) get an inked top edge. Every crack, from its own frame into this one.
  const WALL = [[104, 100, 104], [76, 72, 78], [46, 44, 50], [22, 22, 26]], BANDS = [0, 0.08, 0.26, 0.55, 1];
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
      drape(Q, false, [40, 38, 40], 1.8, () => true, 0.3);
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
  function tree(x, z, y0, r, hh, seed) {   // an ohia: a crooked trunk under a broad, ragged crown
    const d = cam.hd([x, 0, z]); if (d > 1100 || !inView(x, z, 0.3)) return;
    const f = fogAt(d); let svg = '';
    const trunk = projLine([[x, y0, z], [x + 0.4, y0 + hh * 0.55, z]]);
    if (trunk) svg += `<line x1="${trunk[0][0].toFixed(1)}" y1="${trunk[0][1].toFixed(1)}" x2="${trunk[1][0].toFixed(1)}" y2="${trunk[1][1].toFixed(1)}" stroke="${hex(mix([70, 56, 46], f))}" stroke-width="${Math.max(1, 0.5 / Math.max(cam.view([x, y0, z])[2], 1) * FPX).toFixed(2)}"/>`;
    const g = [[64, 98, 64], [56, 90, 60], [74, 106, 66]][Math.floor(hash(seed, 3) * 3)], N = 9, P = [];
    for (let i = 0; i < N; i++) { const a = i / N * 6.283, rr = r * (0.75 + 0.35 * hash(seed, i)); P.push([x + Math.cos(a) * rr * cam.r[0], y0 + hh * 0.72 + Math.sin(a) * hh * 0.28, z + Math.cos(a) * rr * cam.r[2]]); }
    const c = proj(P); if (c) svg += `<polygon points="${fmt(wob(c, true, seed, 1.2))}" fill="${hex(mix(g, f))}" stroke="${hex(mix([34, 52, 36], f))}" stroke-width="${(0.7 * (1.2 - f)).toFixed(2)}"/>`;
    add(d - 0.2, svg);
  }
  function steam(x, z, y0, r, seed) {
    const d = cam.hd([x, 0, z]); if (d > 900 || d < 30 || !inView(x, z, 0.3)) return;
    let svg = '';
    for (let k = 0; k < 3; k++) {
      const v = cam.view([x + (hash(seed, k) - 0.5) * r, y0 + 2 + k * r * 0.9, z + (hash(k, seed) - 0.5) * r]); if (v[2] < 2) continue;
      const c = cam.scr(v), pr = r * (0.6 + k * 0.35) / v[2] * FPX;
      svg += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${pr.toFixed(1)}" ry="${(pr * 0.6).toFixed(1)}" fill="white" fill-opacity="${(0.55 - k * 0.15).toFixed(2)}" stroke="#b8b0a8" stroke-opacity="0.35"/>`;
    }
    add(d - 0.6, svg);
  }

  function drawObjs(objs, map, yoff) {
    for (const o of objs) {
      const tr = p => map(p[0], p[1]);
      if (o.kind === 'boulder') {
        const [x, z] = tr([o.x, o.z]), pts = ngon(x, z, o.r * 0.8, 6, hash(x, z) * 6, 0.8);
        prismUp(pts, o.base + yoff, pts.map((_, i) => o.base + yoff + o.h * (0.75 + 0.25 * hash(i, x))), [78, 76, 82], Math.round(x + z), 0, 0.6);
      } else if (o.kind === 'tree') { const p = tr([o.x, o.z]); tree(p[0], p[1], o.base + yoff, o.r, o.h, Math.round(o.x * 7 + o.z)); }
      else if (o.kind === 'lavatree') {   // a stone shell, hollow where the trunk burned out
        const [x, z] = tr([o.x, o.z]), pts = ngon(x, z, o.r, 7, hash(o.seed, 1) * 6, 0.9);
        prismUp(pts, o.base + yoff, pts.map((_, i) => o.base + yoff + o.h * (0.8 + 0.25 * hash(o.seed, i))), [62, 60, 64], o.seed, 0, 0.82);
      } else if (o.kind === 'column') {   // a basalt column on a terrace's face, its top a hexagon
        const [x, z] = tr([o.x, o.z]), pts = ngon(x, z, o.r, 6, 0.5 + hash(o.seed, 2) * 0.4, 1);
        prismUp(pts, o.base + yoff, o.top + yoff, [86, 84, 92].map(v => v * (0.9 + 0.2 * hash(o.seed, 3))), o.seed, 0, 1);
      } else if (o.kind === 'vent') {   // a spatter cone, glowing at its mouth, a plume of fume over it
        const [x, z] = tr([o.x, o.z]), d = cam.hd([x, 0, z]), y = o.base + yoff;
        prismUp(ngon(x, z, o.r * 0.8, 9, 0.3, 1), y - 1, y + 6, [128, 70, 58], 81, 0, 0.45);
        const v = cam.view([x, y + 6.5, z]); if (v[2] > 2) { const c = cam.scr(v), rr = 5 / v[2] * FPX;
          add(d - 1, `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rr * 2.6).toFixed(1)}" ry="${(rr * 1.3).toFixed(1)}" fill="#ffb060" fill-opacity="0.35"/><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${rr.toFixed(1)}" ry="${(rr * 0.5).toFixed(1)}" fill="#ff8a2a"/>`); }
        steam(x, z, y + 6, 6, 91);
      } else if (o.kind === 'steam') { const p = tr([o.x, o.z]); steam(p[0], p[1], o.base + yoff, o.r, Math.round(o.x * 3 + o.z)); }
      else if (o.kind === 'mouth') {   // the dark arch of the tube where its roof still stands
        const [x, z] = tr([o.x, o.z]), ux = Math.sin(o.dir), uz = -Math.cos(o.dir), d = cam.hd([x, 0, z]); if (d > 900) continue;
        const nx = -uz, nz = ux, y = o.base + yoff, P = [];
        for (let i = 0; i <= 12; i++) { const a = Math.PI * i / 12; P.push([x + nx * Math.cos(a) * o.w * 0.45, y - o.depth * 0.55 + Math.sin(a) * o.depth * 0.42, z + nz * Math.cos(a) * o.w * 0.45]); }
        const q = proj(P); if (q) add(d - 0.3, `<polygon points="${fmt(q)}" fill="#141214" stroke="#555" stroke-width="0.8"/>`);
      } else if (o.kind === 'hall') {   // the clubhouse: a long, low lodge of black basalt, flat roofed, lit windows
        const pts = o.pts.map(tr), y0 = o.base + yoff, y1 = y0 + o.h, ctr = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4];
        prismUp(pts, y0, y1, [70, 68, 72], 61);
        const inner = pts.map(p => [ctr[0] + (p[0] - ctr[0]) * 0.7, ctr[1] + (p[1] - ctr[1]) * 0.7]);
        prismUp(inner, y1, y1 + o.roof, [80, 76, 80], 63, -0.4);
        for (let i = 0; i < 4; i++) {
          const a = pts[i], b = pts[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 20) continue;
          for (let t = 0.1; t < 0.92; t += 0.14) { const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], q = proj([[p[0], y0 + 1.6, p[1]], [p[0] + (b[0] - a[0]) / len * 2.6, y0 + 1.6, p[1] + (b[1] - a[1]) / len * 2.6], [p[0] + (b[0] - a[0]) / len * 2.6, y0 + 4, p[1] + (b[1] - a[1]) / len * 2.6], [p[0], y0 + 4, p[1]]]);
            const mx = (a[0] + b[0]) / 2 - ctr[0], mz = (a[1] + b[1]) / 2 - ctr[1]; if (q && (cam.pos[0] - (a[0] + b[0]) / 2) * mx + (cam.pos[2] - (a[1] + b[1]) / 2) * mz > 0) add(cam.hd([p[0], 0, p[1]]) - 0.6, `<polygon points="${fmt(q)}" fill="#f2b84b"/>`); }
        }
      }
    }
  }
  drawObjs(B.objs, (x, z) => [x, z], h.base);
  for (const [k, Hk] of HOLES.entries()) {
    if (k === hi) continue;
    const Wk = WOR[k], m = (x, z) => toHere(...Wk(x, z));
    const near = [Hk.line[0], Hk.pin].some(p => Math.hypot(...toHere(...Wk(...p)).map((v, i) => v - [cam.pos[0], cam.pos[2]][i])) < 900);
    drawObjs(BUILT[k].objs.filter(o => near || ['hall', 'vent'].includes(o.kind)), m, Hk.base);
  }
  // the lavafall: a glowing ribbon down the bay's wall from its lip to the pool, steam where it lands
  {
    const T = toHere(...FALL.top), F = toHere(...FALL.foot), N = 24, Lp = [], Rp = [], dxf = F[0] - T[0], dzf = F[1] - T[1], lf = Math.hypot(dxf, dzf), nx = -dzf / lf, nz = dxf / lf;
    for (let i = 0; i <= N; i++) {
      const t = i / N, w = FALL.w * (0.55 + 0.45 * t + 0.08 * Math.sin(t * 17)), Xw = FALL.top[0] + (FALL.foot[0] - FALL.top[0]) * t, Zw = FALL.top[1] + (FALL.foot[1] - FALL.top[1]) * t, y = V(Xw, Zw) + 1.5;
      const px = T[0] + dxf * t, pz = T[1] + dzf * t; Lp.push([px - nx * w / 2, y, pz - nz * w / 2]); Rp.push([px + nx * w / 2, y, pz + nz * w / 2]);
    }
    const d = cam.hd([(T[0] + F[0]) / 2, 0, (T[1] + F[1]) / 2]), q = proj([...Lp, ...Rp.reverse()]);
    if (q && d < 4000) {
      let streak = '';
      for (let k = 1; k < 4; k++) { const S = projLine(Lp.map((p, i) => { const r = Rp[N - i]; return [p[0] + (r[0] - p[0]) * k / 4, p[1], p[2] + (r[2] - p[2]) * k / 4]; })); if (S) streak += `<polyline points="${fmt(S)}" fill="none" stroke="#ffe08a" stroke-width="1.4" stroke-opacity="0.8"/>`; }
      add(d - 1, `<polygon points="${fmt(q)}" fill="#f7792a" stroke="#c04a12" stroke-width="1"/>` + streak);
      steam(F[0], F[1], POOL.level, 7, 7);
    }
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
  // past the cells: the mountain as silhouettes from its own heights (land nearer than 3.4 km and beyond it), the
  // sea at the horizon where nothing nearer stands higher; the plume over the caldera's far side, with lightning
  const camW = W(cam.pos[0], cam.pos[2]), az0 = Math.atan2(cam.f[0], -cam.f[2]) + h.place.heading * Math.PI / 180;
  const rings = [], hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 4000, cam.pos[1], cam.pos[2] + cam.f[2] * 4000]))[1];
  const ang2y = a => VH / 2 - (Math.tan(a) - cam.f[1] / Math.hypot(cam.f[0], cam.f[2])) * FPX / Math.cos(Math.asin(cam.f[1]) || 1) * 1;
  const cols = 100, bands = [[1650, 3400], [3400, 14000]], tops = bands.map(() => []), seaTop = [], dists = bands.map(() => []);
  for (let c = 0; c <= cols; c++) {
    const a = az0 + (c / cols - 0.5) * (HFOV + 0.3), sx = Math.sin(a), sz = -Math.cos(a);
    let run = -Infinity; const res = [];
    for (const [d0, d1] of bands) {
      let best = -Infinity, bd = d0;
      for (let d = d0; d < d1; d *= 1.025) { const y = V(camW[0] + sx * d, camW[1] + sz * d) - d * d / 12.7e6, an = Math.atan2(y - cam.pos[1], d); if (y > 0 && an > best) { best = an; bd = d; } }
      res.push([best, bd]);
    }
    const sea = Math.atan2(-cam.pos[1] - 16000 ** 2 / 12.7e6, 16000);
    // a point on screen for this column at elevation angle an: project a point far along the ray
    const P = an => { const d = 5000, w = [cam.pos[0], cam.pos[1] + Math.tan(an) * d, cam.pos[2]], lx = Math.sin(a - h.place.heading * Math.PI / 180), lz = -Math.cos(a - h.place.heading * Math.PI / 180); w[0] += lx * d; w[2] += lz * d; const v = cam.view(w); return v[2] > 1 ? cam.scr(v) : null; };
    res.forEach(([an, bd], b) => { const p = an > -Infinity ? P(an) : null; tops[b].push(p); dists[b].push(bd); });
    seaTop.push(P(sea));
  }
  let far = '';
  const poly = (T, colr, op = 1) => { const pts = T.filter(Boolean); if (pts.length < 3) return ''; return `<polygon points="${fmt([...pts, [pts.at(-1)[0], VH + 60], [pts[0][0], VH + 60]])}" fill="${hex(colr)}" fill-opacity="${op}" stroke="${hex(colr.map(v => v * 0.85))}" stroke-width="1"/>`; };
  far += poly(seaTop, [206, 214, 222]);
  const mean = A => A.reduce((x, y) => x + y, 0) / A.length;
  far += poly(tops[1], mix([96, 90, 96], fogAt(mean(dists[1])) * 0.85));
  far += poly(tops[0], mix([84, 80, 86], fogAt(mean(dists[0])) * 0.8));
  // crags down the far walls: a few strokes from the skyline down
  for (const [b, T] of tops.entries()) for (let c = 2; c < T.length - 2; c += 3) { const p = T[c]; if (!p || p[1] > VH) continue; far += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${(p[0] + 3 - hash(c, b) * 6).toFixed(1)}" y2="${(p[1] + 30 + 40 * hash(b, c)).toFixed(1)}" stroke="${hex(mix([60, 56, 62], 0.55 + 0.15 * b))}" stroke-width="0.8"/>`; }
  // the plume: a column of ash rising from the vent on the caldera's far side, leaning with the wind, lightning in it
  let plume = '';
  {
    const vx = VENT.at[0] - camW[0], vz = VENT.at[1] - camW[1], dist = Math.hypot(vx, vz), Lv = toHere(...VENT.at), R = rnd(77 + hi);
    for (let k = 0; k < 16; k++) {
      const t = k / 15, hgt = 1300 + t * 5200, lean = t * t * 1800, w = 260 + t * 2200, pw = [Lv[0] + lean * 0.7, hgt, Lv[1] + lean * 0.3];
      const v = cam.view(pw); if (v[2] < 50) continue;
      const c = cam.scr(v), r = w / v[2] * FPX;
      plume += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.62).toFixed(1)}" fill="${hex([168 - t * 26, 158 - t * 26, 158 - t * 20])}" fill-opacity="${(0.72 - t * 0.25).toFixed(2)}" stroke="#a89e9c" stroke-opacity="0.35"/>`;
    }
    for (let b = 0; b < 2; b++) {   // lightning: jagged forks inside the column
      let pw = [Lv[0] + 200 * (R() - 0.5), 2600 + R() * 1400, Lv[1]], pts = [];
      for (let k = 0; k < 7; k++) { const v = cam.view(pw); if (v[2] > 50) pts.push(cam.scr(v)); pw = [pw[0] + (R() - 0.5) * 260, pw[1] - 160 - R() * 120, pw[2]]; }
      if (pts.length > 2) plume += `<polyline points="${fmt(pts)}" fill="none" stroke="#fff6c8" stroke-width="2.2"/><polyline points="${fmt(pts)}" fill="none" stroke="#c8a8ff" stroke-width="0.8"/>`;
    }
    if (dist < 400) plume = '';
  }
  const inside = INSIDE(...camW);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6deef"/><stop offset="${clamp(hz / VH * 0.7, 0.05, 0.9).toFixed(3)}" stop-color="#f4e2dc"/><stop offset="${clamp(hz / VH, 0.06, 0.95).toFixed(3)}" stop-color="#fbe6d2"/><stop offset="1" stop-color="#fbe6d2"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/>` + (inside ? far + plume : plume + far) + polys.map(p => p.svg).join('') + lsvg +
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
  const pin = h.pin, tee = h.teePts[BACK];
  const firstT = (h.targets || [])[0] || { at: pin };
  const labelSet = [], here = LOC[hi];
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  for (const t of h.targets || []) labelSet.push(L3(t.at, t.name, -46));
  labelSet.push(L3(pin, 'green', -60));
  for (const [p, t] of h.voidLabels || []) labelSet.push(L3(at(h.line, ...p), t, -36));
  for (const f of h.forms || []) if (f.label) labelSet.push(L3(f.at, f.label, -36, f.h));
  if (h.cone) labelSet.push(L3([h.cone.at[0] + 40, h.cone.at[1]], 'the cinder cone', -70, 10));
  if (h.bridge) labelSet.push(L3(at(h.line, h.bridge.s, 0), 'the bridge', -30));
  if (h.columns) labelSet.push(L3(at(h.line, 196, 40), 'basalt columns', -40));
  if (h.fumaroles) labelSet.push(L3(at(h.line, 160, -70), 'fumaroles', -40));
  if (h.vent) labelSet.push(L3(here(...h.vent.at), 'spatter vent', -50, 7));
  if (h.hall) labelSet.push(L3(h.hall.at, 'the clubhouse', -60, 8));
  for (const [wp, t] of [[[-600, -575], 'the lava lake'], [[-300, 650], 'the lava river'], [FALL.foot, 'the lavafall'], [[-460, -660], 'the rock bridge']]) {
    const p = here(...wp), pr = project(h.line, ...p); if (pr.d < 260) labelSet.push(L3(p, t, -40, 2));
  }
  const v = [];
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin), look: look(tee, pin, 6) });
    const fw = h.teePts[FRONT]; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin), look: look(fw, pin, 5) });
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
