// node tools/reclaim/sketch.mjs [holes] : the plan book's sketch views. Simple 3D shapes from the plan data
// (ground cells, building boxes with broken tops, the El, the span, trees, wrecks), projected through a real
// camera and drawn as ink and washes in SVG, misted with distance. out/views/h<n>_<tee|land|green>.svg (+ .png)
// Painter's order by horizontal distance; good enough for a layout round, not a renderer.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES } from './holes.mjs';
import { BUILT, toWorld, toLocal, cityFill, RIVER, fwPieces, greenFeature } from './scene.mjs';
import { featureOutline } from '../../src/course/features.js';
import { at, project, headingAt, rnd, clamp, distLine, inPoly, lengthOf, seOutline } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [243, 244, 242], MIST = 330;
const SC = { street: [170, 167, 160], rough: [136, 156, 106], fairway: [136, 184, 96], fringe: [160, 204, 112], green: [196, 228, 142], tee: [142, 188, 100],
  sand: [236, 224, 186], water: [158, 182, 196], rubble: [176, 166, 152], stands: [182, 176, 166], deck: [170, 170, 168], building: [170, 168, 164], void: [40, 40, 42] };
const CITY = cityFill();
const WL = HOLES.map(h => h.line.map(p => toWorld(h)(...p)));
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);

const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.94, 1 - Math.exp(-Math.max(0, d - 25) / MIST));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

function camera(pos, look) {
  const f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [f[2] * 1 - 0, 0, -f[0]]; // f x up(0,1,0) = (-f.z... ) careful: (fy*0 - fz*1, fz*0 - fx*0, fx*1 - fy*0) = (-fz, 0, fx)
  r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  // x in local frame: right of view. With x right, z toward the viewer... check sign with a point to the right.
  const cam = { pos, f, r, u };
  cam.view = p => { const v = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]]; return [v[0] * r[0] + v[1] * r[1] + v[2] * r[2], v[0] * u[0] + v[1] * u[1] + v[2] * u[2], v[0] * f[0] + v[1] * f[1] + v[2] * f[2]]; };
  cam.scr = v => [VW / 2 + v[0] / v[2] * FPX, VH / 2 - v[1] / v[2] * FPX];
  cam.hd = p => Math.hypot(p[0] - pos[0], p[2] - pos[2]);
  return cam;
}
// clip a polygon (view space) to z >= near
function clipNear(P, near = 0.6) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ia = a[2] >= near, ib = b[2] >= near;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]); }
  }
  return out;
}
// clip a screen polygon to a box round the frame (near-clipped walls project far off it)
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
// a hand-drawn line: subdivide in screen space and wobble it a little
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
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look);
  const polys = [];   // { key, svg }
  const base = h.base;
  const P3 = (x, y, z) => [x, y + base, z];          // hole-local with absolute y
  // project a 3D polygon (local x, absolute y, local z) -> screen points (or null)
  const proj = P => { const v = clipNear(P.map(cam.view)); if (v.length < 3) return null; const q = clipBox(v.map(cam.scr)); return q.length < 3 ? null : q; };
  const projLine = P => { const v = P.map(cam.view); if (v.some(q => q[2] < 0.6)) return null; return v.map(cam.scr); };
  const inView = (x, z, margin = 0.25) => { const v = cam.view([x, cam.pos[1], z]); return v[2] > -20 && Math.abs(v[0]) < (v[2] + 30) * (Math.tan(HFOV / 2) + margin); };
  const add = (key, svg) => polys.push({ key, svg });

  // ---- ground: this hole's, or a neighbouring hole's where that is nearer; city street elsewhere
  const others = HOLES.map((_, k) => k).filter(k => k !== hi);
  const W = WOR[hi];
  function groundAt(x, z) {
    const [X, Z] = W(x, z), own = distLine(h.line, x, z);
    let k = -1, kd = Math.min(70, own);
    for (const j of others) { const d = distLine(WL[j], X, Z); if (d < kd) { kd = d; k = j; } }
    if (k < 0) return { y: B.ground(x, z), raw: B.ground(x, z, true), s: B.surface(x, z) };
    const [lx, lz] = LOC[k](X, Z), Bk = BUILT[k], g = Bk.ground(lx, lz), gr = Bk.ground(lx, lz, true), off = HOLES[k].base - base;
    return { y: g === null ? null : g + off, raw: gr + off, s: Bk.surface(lx, lz) };
  }
  const cache = new Map();
  const gq = (x, z) => { const key = x.toFixed(2) + ':' + z.toFixed(2); let v = cache.get(key); if (!v) { v = groundAt(x, z); cache.set(key, v); } return v; };
  const gy = (x, z) => { const v = gq(x, z); return (v.y ?? v.raw ?? 0) + base; };
  const cells = [];
  function cell(x, z, s) {
    const d = Math.hypot(x + s / 2 - cam.pos[0], z + s / 2 - cam.pos[2]);
    if (d > 1500) return;
    if (!inView(x + s / 2, z + s / 2, 0.35 + s / Math.max(d, 1))) return;
    const c = gq(x + s / 2, z + s / 2), k = [gq(x, z), gq(x + s, z), gq(x + s, z + s), gq(x, z + s)];
    const mixed = k.some(q => q.s !== c.s || (q.y === null) !== (c.y === null));
    const want = Math.max(1.2, d * 0.02);
    if (s > want * 1.5 || (mixed && s > Math.max(1.2, d * 0.006))) { const t = s / 2; cell(x, z, t); cell(x + t, z, t); cell(x + t, z + t, t); cell(x, z + t, t); return; }
    cells.push({ x, z, s, c, k, d });
  }
  const R = 1400, S0 = 64, gx0 = Math.floor((cam.pos[0] - R) / S0) * S0, gz0 = Math.floor((cam.pos[2] - R) / S0) * S0;
  for (let x = gx0; x < cam.pos[0] + R; x += S0) for (let z = gz0; z < cam.pos[2] + R; z += S0) cell(x, z, S0);
  const L = [-0.35, 0.85, 0.4], Ll = Math.hypot(...L); L.forEach((v, i) => L[i] = v / Ll);
  for (const q of cells) {
    const { x, z, s, c, k } = q;
    if (c.s === 'building') continue;
    let col, ys;
    if (c.y === null) { // the chasm: dark, flush with the ground it broke out of, with its rim inked
      ys = k.map(v => v.raw - 0.05); col = [46, 46, 48];
    } else { ys = k.map(v => v.y ?? c.y); col = SC[c.s] || SC.street; if (c.s === 'water' && Math.max(...ys) - c.y > 1.2) col = SC.rubble; }
    // shade by the slope
    const dx = ((ys[1] + ys[2]) - (ys[0] + ys[3])) / (2 * s), dz = ((ys[2] + ys[3]) - (ys[0] + ys[1])) / (2 * s);
    const n = [-dx, 1, -dz], nl = Math.hypot(...n), lam = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl;
    const tex = c.s === 'fairway' || c.s === 'tee' ? 0.98 + 0.035 * (Math.floor(project(h.line, x + s / 2, z + s / 2).s / 9) % 2) : c.s === 'street' ? 0.97 + 0.05 * hash(Math.floor(x / 9), Math.floor(z / 9)) : c.s === 'rough' ? 0.985 + 0.03 * hash(Math.floor(x / 3), Math.floor(z / 3)) : 1;
    col = col.map(v => v * (0.78 + 0.3 * lam) * tex);
    const P = proj([P3(x, ys[0], z), P3(x + s, ys[1], z), P3(x + s, ys[2], z + s), P3(x, ys[3], z + s)]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d) * (c.y === null ? 0.45 : 1)));
    add(q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    // cracked asphalt: a crack or two across each near cell of street, grass growing up the cracks
    if (c.s === 'street' && q.d < 260 && s <= 8 && hash(Math.floor(x * 3.1), Math.floor(z * 2.7)) > 0.25) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + base + 0.05, pts = [];
      const a0 = hash(x, z) * 6.283, n = 4;
      for (let i = 0; i <= n; i++) { const t = i / n - 0.5, j = (hash(x + i, z - i) - 0.5) * s * 0.4; pts.push([x + s / 2 + Math.cos(a0) * t * s * 1.3 - Math.sin(a0) * j, y0, z + s / 2 + Math.sin(a0) * t * s * 1.3 + Math.cos(a0) * j]); }
      const p = projLine(pts);
      if (p) add(q.d - 0.03, `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([108, 142, 78], f))}" stroke-width="${(3.2 * (1.1 - f) * Math.min(1.5, 120 / q.d + 0.3)).toFixed(2)}" stroke-linecap="round" stroke-opacity="0.8"/>` +
        `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([66, 64, 60], f))}" stroke-width="${(0.9 * (1.15 - f)).toFixed(2)}"/>`);
    }
  }

  // ---- ink outlines of the short grass, the green, bunkers, water and the rift, draped on the ground
  const drape = (P, closed, colr, wd, keep = () => true) => {
    const pts = closed ? [...P, P[0]] : P;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) {
        const x1 = ax + (bx - ax) * k / n, z1 = az + (bz - az) * k / n, x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n;
        if (!keep((x1 + x2) / 2, (z1 + z2) / 2)) continue;
        const d = cam.hd([x1, 0, z1]); if (d > 900) continue;
        const p = projLine([[x1, gy(x1, z1) + 0.15, z1], [x2, gy(x2, z2) + 0.15, z2]]); if (!p) continue;
        const f = fogAt(d);
        add(d - 0.05, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${hex(mix(colr, f))}" stroke-width="${(wd * (1.15 - f)).toFixed(2)}" stroke-linecap="round"/>`);
      }
    }
  };
  drape(featureOutline(greenFeature(h), 'green', 64), true, [60, 90, 40], 1.4);
  for (const b of h.bunkers || []) drape(seOutline({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0 }, 28), true, [150, 120, 70], 1.2);
  for (const w of h.water || []) drape(seOutline({ x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0, p: w.p }, 48), true, [60, 80, 96], 1.2);
  for (const q of fwPieces(h)) for (const side of [1, -1]) {
    const edge = s => side > 0 ? q.R(s) : -q.L(s);
    const P = [], S = []; for (let s = q.s0; s <= q.s1; s += 3) { P.push(at(h.line, s, edge(s))); S.push(s); }
    const ok = S.map(s => { const a = at(h.line, s, edge(s) - side * 1.5), b = at(h.line, s, edge(s) + side * 1.5); return B.surface(...a) === 'fairway' && B.surface(...b) !== 'fairway'; });
    // draw the runs that really are the edge
    let run = [];
    for (let i = 0; i < P.length; i++) { if (ok[i]) run.push(P[i]); else { if (run.length > 1) drape(run, false, [70, 104, 50], 1.1); run = []; } }
    if (run.length > 1) drape(run, false, [70, 104, 50], 1.1);
  }
  if (h.rift) for (const side of [1, -1]) { const P = []; for (let s = 0; s <= lengthOf(h.rift.pts); s += 3) { const q = at(h.rift.pts, s, side * h.rift.w / 2); P.push(q); } drape(P, false, [30, 30, 30], 2.2); }

  // ---- solids
  const ink = (d, a = 1) => `stroke="${hex(mix([40, 38, 36], fogAt(d) * 0.9))}" stroke-opacity="${a}"`;
  const face = (P3s, colr, d, extra = '', seed = 1, sw = 1) => {
    const P = proj(P3s); if (!P) return null;
    const f = fogAt(d); return `<polygon points="${fmt(P)}" fill="${hex(mix(colr, f))}" stroke="none"/>` +
      `<polyline points="${fmt(wob(P, true, seed))}" fill="none" ${ink(d)} stroke-width="${(sw * (1.3 - f)).toFixed(2)}" stroke-linejoin="round"/>` + extra;
  };
  const facing = (a, b, ctr) => { // outward normal of a wall a->b (footprint wound either way) facing the camera
    const nx = b[2] - a[2], nz = -(b[0] - a[0]), mx = (a[0] + b[0]) / 2, mz = (a[2] + b[2]) / 2;
    const out = (mx - ctr[0]) * nx + (mz - ctr[1]) * nz > 0 ? 1 : -1;
    return ((cam.pos[0] - mx) * nx + (cam.pos[2] - mz) * nz) * out > 0;
  };
  // a box-like building: footprint pts (local), base y (abs), top heights per edge point, options
  function building(o, absBase) {
    const R = rnd(o.seed || 1), pts = o.pts, ctr = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4];
    const d0 = cam.hd([ctr[0], 0, ctr[1]]); if (d0 > 1600) return;
    if (!inView(ctr[0], ctr[1], 0.3 + 40 / Math.max(d0, 1))) return;
    const top = absBase + o.h, tone = [[200, 197, 190], [186, 176, 166], [176, 182, 186], [205, 200, 188]][Math.floor(R() * 4)];
    // lean: a shear toward dir
    const lean = o.lean ? Math.tan(o.lean.deg * Math.PI / 180) : 0, ld = o.leanDir || [0, -1];
    const V = (x, y, z) => [x + ld[0] * lean * (y - absBase), y, z + ld[1] * lean * (y - absBase)];
    // the broken skyline of each wall: points along the edge with their heights
    const edges = [];
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 7)), e = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n; let y = top;
        if (o.broken === 'snap') y = top - (6 + 22 * hash(o.seed + i, k)) * (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i)));
        else if (o.broken) y = top - (R() < 0.35 ? 3 + R() * Math.min(18, o.h * 0.35) : R() * 3);
        e.push([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t]);
      }
      edges.push(e);
    }
    // make the corners agree
    for (let i = 0; i < 4; i++) { const nxt = edges[(i + 1) % 4]; nxt[0][1] = edges[i].at(-1)[1]; }
    const lo = absBase + (o.open || 0);
    // the roof (seen from above)
    if (cam.pos[1] > Math.min(...edges.flat().map(p => p[1])) - 2) {
      const rp = edges.flatMap(e => e.slice(0, -1)).map(p => V(...p));
      const s = face(rp, tone.map(v => v * 0.72), d0, '', o.seed + 9, 0.8); if (s) add(d0 + 0.5, s);
    }
    // the underside of an open lower floor (seen from below)
    if (o.open && cam.pos[1] < lo) { const s = face(pts.map(p => V(p[0], lo, p[1])), [120, 118, 114], d0, '', o.seed + 5); if (s) add(d0 + 0.4, s); }
    for (let i = 0; i < 4; i++) {
      const a = pts[i], b = pts[(i + 1) % 4], A = [a[0], 0, a[1]], Bp = [b[0], 0, b[1]];
      if (!facing(A, Bp, ctr)) continue;
      const e = edges[i], dd = cam.hd([(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
      const lit = 0.9 + 0.12 * Math.abs(Math.sin(Math.atan2(b[1] - a[1], b[0] - a[0]) + 0.6));
      const wall = [V(a[0], lo, a[1]), V(b[0], lo, b[1]), ...e.slice().reverse().map(p => V(...p))];
      const f = fogAt(dd); let extra = '';
      // floor lines and the odd blown-out panel, where it is near enough to read
      if (dd < 650) {
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), lines = [];
        for (let y = lo + 4; y < top - 0.5; y += 4) {
          // the run of this floor under the broken top
          let run = [];
          for (let k = 0; k < e.length; k++) {
            if (e[k][1] > y + 0.3) run.push(V(e[k][0], y, e[k][2]));
            if ((e[k][1] <= y + 0.3 || k === e.length - 1) && run.length > 1) { const p = projLine(run); if (p) lines.push(p); run = []; }
            else if (e[k][1] <= y + 0.3) run = [];
          }
        }
        if (lines.length) extra += `<path d="${lines.map(l => 'M' + fmt(l).replace(/ /g, ' L')).join(' ')}" fill="none" ${ink(dd, 0.35)} stroke-width="${(0.7 * (1.2 - f)).toFixed(2)}"/>`;
        // blown-out panels: dark gaps in the facade
        const gaps = [], ng = Math.floor(len * o.h / 600 * (o.broken ? 1 : 0.4));
        for (let g = 0; g < ng; g++) {
          const t = R(), yb = lo + 4 * Math.floor(R() * (o.h - (o.open || 0) - 4) / 4), w = 3 + R() * 6, t2 = Math.min(1, t + w / len);
          const yt = yb + 3.2; const ek = e[Math.min(e.length - 1, Math.round(t * (e.length - 1)))];
          if (yt > ek[1] - 0.5) continue;
          const p = proj([V(a[0] + (b[0] - a[0]) * t, yb, a[1] + (b[1] - a[1]) * t), V(a[0] + (b[0] - a[0]) * t2, yb, a[1] + (b[1] - a[1]) * t2),
            V(a[0] + (b[0] - a[0]) * t2, yt, a[1] + (b[1] - a[1]) * t2), V(a[0] + (b[0] - a[0]) * t, yt, a[1] + (b[1] - a[1]) * t)]);
          if (p) gaps.push(p);
        }
        if (gaps.length) extra += `<path d="${gaps.map(p => 'M' + fmt(p).replace(/ /g, ' L') + 'Z').join(' ')}" fill="${hex(mix([92, 90, 88], f))}"/>`;
        // ivy hanging from the broken top: masses of green down the wall
        { const ivy = [], nm = Math.ceil(len / 14 * (o.vines ? 1.4 : 0.6));
          for (let m = 0; m < nm; m++) {
            const t = R(), w = (3 + R() * 7) / len, k = Math.min(e.length - 1, Math.round(t * (e.length - 1))), ytop = e[k][1] - 0.5, hang = 5 + R() * Math.min(26, (ytop - lo) * 0.6), P = [];
            const pt = (tt, y) => V(a[0] + (b[0] - a[0]) * tt, y, a[1] + (b[1] - a[1]) * tt);
            P.push(pt(t - w / 2, ytop), pt(t + w / 2, ytop));
            for (let j = 0; j <= 5; j++) { const tt = t + w / 2 - j / 5 * w; P.push(pt(tt, ytop - hang * (0.45 + 0.55 * R()))); }
            const p = proj(P); if (p) ivy.push(p);
          }
          if (ivy.length) extra += `<path d="${ivy.map(p => 'M' + fmt(p).replace(/ /g, ' L') + 'Z').join(' ')}" fill="${hex(mix([88, 120, 66], f))}" fill-opacity="0.92"/>`;
        }
        // vines up the wall
        if (o.vines || R() < 0.75) {
          const vs = [];
          for (let v = 0; v < Math.ceil(len / 6); v++) {
            const t = R(), hgt = lo + (0.15 + R() * 0.55) * (o.h - (o.open || 0)), seg = [];
            for (let y = lo; y < hgt; y += 2.5) seg.push(V(a[0] + (b[0] - a[0]) * (t + Math.sin(y * 0.7 + v) * 0.01), y, a[1] + (b[1] - a[1]) * (t + Math.sin(y * 0.7 + v) * 0.01)));
            const p = seg.length > 1 && projLine(seg); if (p) vs.push(p);
          }
          if (vs.length) extra += `<path d="${vs.map(l => 'M' + fmt(l).replace(/ /g, ' L')).join(' ')}" fill="none" stroke="${hex(mix([78, 110, 62], f))}" stroke-width="${(2.2 * (1.2 - f) * Math.min(1.6, 300 / dd + 0.4)).toFixed(2)}" stroke-linecap="round" stroke-opacity="0.85"/>`;
        }
      }
      const s = face(wall, tone.map(v => v * lit), dd, extra, o.seed + i); if (s) add(dd, s);
      // shrubs grown up against the wall's foot
      if (dd < 500) { const len = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let k = 0; k < len / 9; k++) { const t = R(); const ox = (b[1] - a[1]) / len, oz = -(b[0] - a[0]) / len, sg = ((a[0] + b[0]) / 2 - ctr[0]) * ox + ((a[1] + b[1]) / 2 - ctr[1]) * oz > 0 ? 1 : -1;
        const px = a[0] + (b[0] - a[0]) * t + ox * sg * 2, pz = a[1] + (b[1] - a[1]) * t + oz * sg * 2; tree(px, pz, absBase + 0.6, 1.6 + R() * 2, 3 + R() * 3, o.seed + 70 + k, true); } }
    }
    // trees growing out of the broken top
    if (o.broken && d0 < 1000 && !o.tower) { const n = Math.floor(R() * 3.2);
      for (let k = 0; k < n; k++) { const u = 0.2 + R() * 0.6, v = 0.2 + R() * 0.6, px = pts[0][0] + (pts[1][0] - pts[0][0]) * u + (pts[3][0] - pts[0][0]) * v, pz = pts[0][1] + (pts[1][1] - pts[0][1]) * u + (pts[3][1] - pts[0][1]) * v;
        const r = 2.5 + R() * 4; tree(px, pz, top - 6, r, r * 2 + 4, o.seed + 90 + k, false, -0.3); } }
    // the open lower floors: columns
    if (o.open) {
      const n = o.cols || 4, wd = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
      const cx = o.colsX ? o.colsX.map(x => 0.5 + x / wd) : Array.from({ length: n }, (_, u) => (u + 0.5) / n);
      for (const t of cx) for (let v = 0; v < n; v++) {
        const w_ = (v + 0.5) / n, p = [0, 1].map(k => pts[0][k] + (pts[1][k] - pts[0][k]) * t + (pts[3][k] - pts[0][k]) * w_);
        column(p[0], p[1], absBase, lo, 1.1, [176, 172, 166]);
      }
    }
    if (o.tower) {   // the clock tower on the clubhouse roof
      const t = o.tower, c = ctr, w = t.w / 2, yb = top, yt = top + t.h;
      const tp = [[c[0] - w, c[1] - w], [c[0] + w, c[1] - w], [c[0] + w, c[1] + w], [c[0] - w, c[1] + w]];
      building({ pts: tp, h: t.h, seed: o.seed + 50, lean: o.lean, leanDir: o.leanDir }, yb);
      const apex = V(c[0], yt + 9, c[1]);
      for (let i = 0; i < 4; i++) { const a = tp[i], b = tp[(i + 1) % 4]; if (!facing([a[0], 0, a[1]], [b[0], 0, b[1]], c)) continue;
        const s = face([V(a[0], yt, a[1]), V(b[0], yt, b[1]), apex], [110, 116, 112], d0 - 1, '', o.seed + 60 + i); if (s) add(d0 - 2, s); }
      // the clock face
      const fc = proj([V(c[0] - w * 0.6, yt - 7, c[1] + w + 0.1), V(c[0] + w * 0.6, yt - 7, c[1] + w + 0.1), V(c[0] + w * 0.6, yt - 2, c[1] + w + 0.1), V(c[0] - w * 0.6, yt - 2, c[1] + w + 0.1)]);
    }
  }
  function box(pts, y0, y1, colr, seed, keyBias = 0, noTop = false) {   // a simple prism over a footprint
    const ctr = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length], d0 = cam.hd([ctr[0], 0, ctr[1]]);
    if (d0 > 900 || !inView(ctr[0], ctr[1], 0.4)) return;
    if (cam.pos[1] > y1 && !noTop) { const s = face(pts.map(p => [p[0], y1, p[1]]), colr.map(v => v * 0.8), d0, '', seed, 0.7); if (s) add(d0 + keyBias + 0.01, s); }
    if (cam.pos[1] < y0) { const s = face(pts.map(p => [p[0], y0, p[1]]), colr.map(v => v * 0.6), d0, '', seed, 0.7); if (s) add(d0 + keyBias + 0.01, s); }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (!facing([a[0], 0, a[1]], [b[0], 0, b[1]], ctr)) continue;
      const dd = cam.hd([(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]);
      const s = face([[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], colr.map(v => v * (0.9 + 0.1 * (i % 2))), dd, '', seed + i, 0.8); if (s) add(dd + keyBias, s);
    }
  }
  function column(x, z, y0, y1, r, colr) { box([[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]], y0, y1, colr, Math.round(x * 3 + z)); }
  // an oriented prism from a to b (each [x, z, y]), width w (horizontal, across), thickness t
  function prism(a, b, w, t, colr, seed, ribs) {
    const dx = b[0] - a[0], dz = b[1] - a[1], dy = b[2] - a[2], len = Math.hypot(dx, dz, dy), ux = dx / len, uz = dz / len, uy = dy / len;
    let nx = -dz, nz = dx; const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;               // across, horizontal
    const vx = uy * nz * 0 - 0, up = [-(uy * ux), 1 - uy * uy, -(uy * uz)]; const ul = Math.hypot(...up); up.forEach((v, i) => up[i] = v / ul);
    const C = (p, sa, sb) => [p[0] + nx * w / 2 * sa + up[0] * t / 2 * sb, p[2] + up[1] * t / 2 * sb, p[1] + nz * w / 2 * sa + up[2] * t / 2 * sb];
    const A = [a[0], a[1], a[2]], Bq = [b[0], b[1], b[2]];
    const c8 = { a: [C(A, -1, -1), C(A, 1, -1), C(A, 1, 1), C(A, -1, 1)], b: [C(Bq, -1, -1), C(Bq, 1, -1), C(Bq, 1, 1), C(Bq, -1, 1)] };
    const mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2, (a[1] + b[1]) / 2];
    const faces = [[c8.a[0], c8.a[1], c8.b[1], c8.b[0]], [c8.a[1], c8.a[2], c8.b[2], c8.b[1]], [c8.a[2], c8.a[3], c8.b[3], c8.b[2]], [c8.a[3], c8.a[0], c8.b[0], c8.b[3]], c8.a, c8.b];
    for (const [i, F] of faces.entries()) {
      const fc = F.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
      const out = [fc[0] - mid[0], fc[1] - mid[1], fc[2] - mid[2]], toC = [cam.pos[0] - fc[0], cam.pos[1] - fc[1], cam.pos[2] - fc[2]];
      if (out[0] * toC[0] + out[1] * toC[1] + out[2] * toC[2] <= 0) continue;
      const dd = cam.hd(fc); let extra = '';
      if (ribs && i < 4) { // the fallen floors, now standing across the span
        const ls = []; for (let s = 4; s < len - 1; s += 4) { const k = s / len, q = [F[0], F[3]].map(p0 => p0), p1 = [F[0][0] + (F[3][0] - F[0][0]) * k, F[0][1] + (F[3][1] - F[0][1]) * k, F[0][2] + (F[3][2] - F[0][2]) * k], p2 = [F[1][0] + (F[2][0] - F[1][0]) * k, F[1][1] + (F[2][1] - F[1][1]) * k, F[1][2] + (F[2][2] - F[1][2]) * k]; const p = projLine([p1, p2]); if (p) ls.push(p); }
        if (ls.length) extra = `<path d="${ls.map(l => 'M' + fmt(l).replace(/ /g, ' L')).join(' ')}" fill="none" ${ink(dd, 0.4)} stroke-width="0.8"/>`;
      }
      const s = face(F, colr.map(v => v * (0.82 + 0.06 * i)), dd, extra, seed + i); if (s) add(dd - 0.5, s);
    }
  }
  function tree(x, z, y0, r, hh, seed, shrub = false, kb = 0) {
    const d = cam.hd([x, 0, z]); if (d > 1100 || !inView(x, z, 0.3)) return;
    const cy = y0 + hh - r * 1.05, cv = cam.view([x, cy, z]); if (cv[2] < 1) return;
    const c = cam.scr(cv), pr = r / cv[2] * FPX, f = fogAt(d);
    const g = [[86, 118, 70], [74, 104, 62], [98, 126, 74], [110, 128, 70]][Math.floor(hash(seed, 3) * 4)];
    // a lumpy canopy: a few overlapping blobs on bigger trees, a lighter lobe where the sky lights it
    const nb = pr < 6 ? 1 : r > 6 ? 5 : 3, blobs = [];
    for (let b = 0; b < nb; b++) {
      const ox = nb === 1 ? 0 : (hash(seed + b, 1) - 0.5) * pr * 1.1, oy = nb === 1 ? 0 : (hash(seed - b, 2) - 0.6) * pr * 0.7, rr = pr * (nb === 1 ? 1 : 0.62 + 0.25 * hash(seed, b)), pts = [];
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, k = 0.8 + 0.32 * hash(seed + b * 13, i); pts.push([c[0] + ox + Math.cos(a) * rr * k, c[1] + oy + Math.sin(a) * rr * 1.05 * k]); }
      blobs.push(pts);
    }
    let svg = '';
    if (!shrub) { const t0 = cam.scr(cam.view([x, y0, z])), t1 = cam.scr(cv);
      svg += `<line x1="${t0[0].toFixed(1)}" y1="${t0[1].toFixed(1)}" x2="${t1[0].toFixed(1)}" y2="${t1[1].toFixed(1)}" ${ink(d)} stroke-width="${Math.max(0.6, 0.6 * (r / 4) / cv[2] * FPX).toFixed(1)}"/>`; }
    for (const pts of blobs) svg += `<polygon points="${fmt(pts)}" fill="${hex(mix(g, f))}" stroke="none"/><polyline points="${fmt(wob(pts, true, seed, 0.6))}" fill="none" ${ink(d, 0.7)} stroke-width="${(0.9 * (1.2 - f)).toFixed(2)}"/>`;
    if (pr > 5) { const hl = blobs[0].map(([px, py]) => [c[0] + (px - c[0]) * 0.45 - pr * 0.22, c[1] + (py - c[1]) * 0.4 - pr * 0.25]); svg += `<polygon points="${fmt(hl)}" fill="${hex(mix(g.map(v => v * 1.18), f))}" stroke="none"/>`; }
    add(d - 0.2 + kb, svg);
  }

  function line3(P, d, colr, wdt = 1) { const p = projLine(P); if (!p) return; add(d, `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix(colr, fogAt(d)))}" stroke-width="${wdt}"/>`); }

  // the hole's own things, then the other holes' buildings and the city round them (into this frame)
  const toHere = LOC[hi];
  const lineDir = (L, s) => { const a = headingAt(L, s); return [Math.sin(a), -Math.cos(a)]; };
  function drawObjs(objs, map, yoff, hk) {
    for (const o of objs) {
      const tr = p => map(p[0], p[1]);
      if (o.kind === 'bldg') {
        const ld = o.lean ? (() => { const Hh = HOLES[hk], dir = lineDir(Hh.line, Hh.len - 1), pw = map(dir[0] * 100, dir[1] * 100), p0 = map(0, 0); const v = [pw[0] - p0[0], pw[1] - p0[1]]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l]; })() : null;
        building({ ...o, pts: o.pts.map(tr), leanDir: ld }, o.base + yoff);
      }
      else if (o.kind === 'tree') { const p = tr([o.x, o.z]); tree(p[0], p[1], o.base + yoff, o.r, o.h, Math.round(o.x * 7 + o.z)); }
      else if (o.kind === 'box') {
        const CC = { cab: [214, 168, 44], rust: [150, 104, 78], green: [108, 130, 100], white: [196, 196, 188], boat: [104, 118, 128] }, colr = CC[o.color] || CC.rust, pts = o.pts.map(tr), y0 = o.base + yoff;
        if (!o.car) box(pts, y0, y0 + o.h, colr, 7);
        else {
          box(pts, y0, y0 + 0.95, colr, 7);
          const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cz = pts.reduce((a, p) => a + p[1], 0) / 4, cab = pts.map(p => [cx + (p[0] - cx) * 0.8, cz + (p[1] - cz) * 0.55]);
          box(cab, y0 + 0.95, y0 + 1.5, colr.map(v => v * 0.85), 8, -0.05);
          if (o.moss) tree(cx, cz, y0 + 0.9, 1.1 + hash(cx, cz) * 0.8, 1.6, Math.round(cx * 13 + cz), true, -0.1);
        }
      }
      else if (o.kind === 'col') { const p = tr([o.x, o.z]); column(p[0], p[1], o.base + yoff, o.base + yoff + o.h, o.r, [170, 166, 160]); }
      else if (o.kind === 'slab') {
        const pts = o.pts.map(tr); box(pts, o.y + yoff - o.t, o.y + yoff - (o.legs ? 0.15 : 0), [178, 175, 170], 3, -0.3, o.legs);
        if (o.legs) for (const p of pts) { const q = [p[0] * 0.9 + pts.reduce((a, c) => a + c[0], 0) / 40, p[1] * 0.9 + pts.reduce((a, c) => a + c[1], 0) / 40]; column(q[0], q[1], gy(q[0], q[1]) - 1, o.y + yoff - o.t, 0.5, [120, 110, 100]); }
      }
      else if (o.kind === 'el') {
        const pts = o.pts.map(tr), len = lengthOf(pts), y = o.y + yoff;
        for (let s = 0; s < len - 0.1; s += 12) {
          const s1 = Math.min(len, s + 12), a = at(pts, s), b = at(pts, s1), dir = [b[0] - a[0], b[1] - a[1]], dl = Math.hypot(...dir), n = [-dir[1] / dl * o.w / 2, dir[0] / dl * o.w / 2];
          const last = o.broken && s1 >= len - 0.1;
          const yb = last ? y - 3 : y;
          box([[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], y - 1.6, yb, [98, 88, 78], 11, -0.2);
          for (const k of [1, -1]) column(a[0] + n[0] * 0.75 * k, a[1] + n[1] * 0.75 * k, gy(a[0], a[1]) - 1, y - 1.6, 0.45, [92, 84, 76]);
          if (last) {   // a carriage hanging off the break
            const ux = dir[0] / dl, uz = dir[1] / dl, A = [b[0], b[1], y - 1], Bq = [b[0] + ux * 6, b[1] + uz * 6, y - 15];
            prism(A, Bq, 3, 3.2, [128, 98, 66], 31);
          }
        }
      }
      else if (o.kind === 'span') {
        const a = tr(o.a), b = tr(o.b);
        prism([a[0], a[1], o.a[2] + yoff], [b[0], b[1], o.b[2] + yoff], o.w, o.t, o.girder ? [110, 70, 50] : o.torn ? [168, 166, 162] : o.rubble ? [150 + 40 * hash(a[0], a[1]), 146 + 38 * hash(a[0], a[1]), 140 + 34 * hash(a[0], a[1])].map(Math.round) : o.deck ? [150, 146, 140] : [196, 193, 186], 41, !o.deck);
      }
      else if (o.kind === 'pole') {
        const p = tr([o.x, o.z]), y0 = o.base + yoff, top = y0 + o.h, lean = (o.lean || 0) * Math.PI / 180;
        const tp = [p[0] + Math.sin(lean) * o.h * 0.7, top * Math.cos(lean * 0.3), p[1]];
        prism([p[0], p[1], y0], [tp[0], tp[2], tp[1]], 1.2, 1.2, [100, 100, 104], 51);
        box([[tp[0] - 3, tp[2] - 0.6], [tp[0] + 3, tp[2] - 0.6], [tp[0] + 3, tp[2] + 0.6], [tp[0] - 3, tp[2] + 0.6]], tp[1], tp[1] + 4, [90, 92, 96], 52);
      }
      else if (o.kind === 'crane') {
        const p = tr([o.x, o.z]), y0 = o.base + yoff;
        column(p[0], p[1], y0, y0 + o.h, 1.6, [168, 120, 60]);
        prism([p[0] - 6, p[1], y0 + o.h], [p[0] + 30, p[1] - 8, y0 + o.h + 2], 1.6, 1.6, [168, 120, 60], 61);
      }
      else if (o.kind === 'bridge') {
        const a = tr(o.a), b = tr(o.b), y0 = o.base + yoff, dir = [b[0] - a[0], b[1] - a[1]], dl = Math.hypot(...dir), n = [-dir[1] / dl, dir[0] / dl];
        for (const p of [a, b]) {
          for (const k of [1, -1]) column(p[0] + n[0] * 12 * k, p[1] + n[1] * 12 * k, y0, y0 + o.h, 2.2, [150, 120, 96]);
          for (const yy of [o.h * 0.55, o.h * 0.92]) prism([p[0] + n[0] * 12, p[1] + n[1] * 12, y0 + yy], [p[0] - n[0] * 12, p[1] - n[1] * 12, y0 + yy], 2.5, 3, [150, 120, 96], 71);
        }
        // the main cables, slack now, sagging into the river
        for (const k of [1, -1]) { const P = []; for (let t = 0; t <= 1.001; t += 0.05) P.push([a[0] + dir[0] * t + n[0] * 12 * k, y0 + o.h - (o.h + 2) * Math.sin(Math.PI * t) ** 0.7, a[1] + dir[1] * t + n[1] * 12 * k]); line3(P, cam.hd([a[0], 0, a[1]]) + 5, [70, 60, 54], 1.4); }
      }
      else if (o.kind === 'marker') {
        const p = tr([o.x, o.z]), y0 = o.base + yoff; column(p[0], p[1], y0, y0 + 7, 0.25, [60, 60, 60]);
        const d = cam.hd([p[0], 0, p[1]]), fl = proj([[p[0], y0 + 7, p[1]], [p[0] + 2.4, y0 + 6.2, p[1]], [p[0], y0 + 5.4, p[1]]]); if (fl) add(d - 1, `<polygon points="${fmt(fl)}" fill="#e2b93b" stroke="#333" stroke-width="0.6"/>`);
      }
      else if (o.kind === 'ramp') {
        const A = tr(o.from), Bq = tr(o.to); prism([A[0], A[1], o.y[0] + yoff - 1], [Bq[0], Bq[1], o.y[1] + yoff - 1], o.w, 2, [168, 164, 158], 81);
        for (let t = 0.15; t < 1; t += 0.3) { const p = [A[0] + (Bq[0] - A[0]) * t, A[1] + (Bq[1] - A[1]) * t]; column(p[0], p[1], gy(p[0], p[1]) - 1, o.y[0] + (o.y[1] - o.y[0]) * t + yoff - 2, 1.4, [160, 156, 150]); }
      }
    }
  }
  drawObjs(B.objs, (x, z) => [x, z], base, hi);
  for (const k of others) {
    const Wk = WOR[k], m = (x, z) => toHere(...Wk(x, z));
    // everything from a hole within 450 m; only buildings and the landmark pieces from further away
    const near = Math.hypot(...toHere(...Wk(...HOLES[k].line[0])).map((v, i) => v - [cam.pos[0], cam.pos[2]][i])) < 700 || Math.hypot(...toHere(...Wk(...HOLES[k].pin)).map((v, i) => v - [cam.pos[0], cam.pos[2]][i])) < 700;
    drawObjs(BUILT[k].objs.filter(o => near || ['bldg', 'span', 'el', 'bridge', 'pole'].includes(o.kind)), m, HOLES[k].base, k);
  }
  for (const c of CITY) {
    const pts = c.pts.map(p => toHere(...p)), ctr = toHere(c.x, c.z), d = cam.hd([ctr[0], 0, ctr[1]]);
    if (d > 1500 || !inView(ctr[0], ctr[1], 0.3)) continue;
    if (c.kind === 'heap') box(pts, c.base, c.base + c.h, [180, 170, 156], c.seed);
    else building({ ...c, pts }, c.base);
  }
  // the flag
  { const [x, z] = h.pin, y0 = (B.ground(x, z) ?? 0) + base, d = cam.hd([x, 0, z]);
    const pole = projLine([[x, y0, z], [x, y0 + 2.6, z]]), fl = proj([[x, y0 + 2.6, z], [x + 1.1, y0 + 2.25, z], [x, y0 + 1.9, z]]);
    if (pole) add(d - 2, `<line x1="${pole[0][0].toFixed(1)}" y1="${pole[0][1].toFixed(1)}" x2="${pole[1][0].toFixed(1)}" y2="${pole[1][1].toFixed(1)}" stroke="#222" stroke-width="1.3"/>` + (fl ? `<polygon points="${fmt(fl)}" fill="#c0392b"/>` : '')); }

  polys.sort((a, b) => b.key - a.key);
  // labels: named things and targets in view, with leader lines
  const labels = [];
  const lab = (p3, text, dy = -40) => { const v = cam.view(p3); if (v[2] < 18) return; const s = cam.scr(v); if (s[0] < 40 || s[0] > VW - 40 || s[1] < 20 || s[1] > VH - 10) return; labels.push({ s, text, dy }); };
  for (const t of view.labels || []) lab(t.p, t.text, t.dy);
  // keep labels apart
  labels.sort((a, b) => a.s[0] - b.s[0]);
  const placed = [];
  let lsvg = '';
  for (const L_ of labels) {
    let ty = L_.s[1] + L_.dy; const w = L_.text.length * 8.2 + 14;
    for (let k = 0; k < 8; k++) { if (!placed.some(p => Math.abs(p.x - L_.s[0]) < (p.w + w) / 2 + 4 && Math.abs(p.y - ty) < 22)) break; ty -= 24; }
    ty = clamp(ty, 16, VH - 16); placed.push({ x: L_.s[0], y: ty, w });
    lsvg += `<line x1="${L_.s[0].toFixed(1)}" y1="${L_.s[1].toFixed(1)}" x2="${L_.s[0].toFixed(1)}" y2="${(ty + 9).toFixed(1)}" stroke="#333" stroke-width="0.8"/>` +
      `<circle cx="${L_.s[0].toFixed(1)}" cy="${L_.s[1].toFixed(1)}" r="2.2" fill="#333"/>` +
      `<rect x="${(L_.s[0] - w / 2).toFixed(1)}" y="${(ty - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="3" fill="white" fill-opacity="0.9" stroke="#333" stroke-width="0.6"/>` +
      `<text x="${L_.s[0].toFixed(1)}" y="${(ty + 4.5).toFixed(1)}" font-family="DejaVu Sans, sans-serif" font-size="13" text-anchor="middle" fill="#222">${L_.text}</text>`;
  }
  // the horizon haze over a white sky
  const hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 3000, cam.pos[1], cam.pos[2] + cam.f[2] * 3000]))[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="${clamp(hz / VH, 0.05, 0.95).toFixed(3)}" stop-color="#eceeec"/><stop offset="1" stop-color="#eceeec"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/>` + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee, from the landing area (par 3: the forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], B = BUILT[hi], g = (x, z) => (B.ground(x, z) ?? B.ground(x, z, true) ?? 0) + h.base;
  const eye = (p, toward, back = 4, up = 5) => {
    const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const x = p[0] - ux * back, z = p[1] - uz * back, y = Math.max(g(x, z), g(p[0], p[1])) + up;
    return [x, y, z];
  };
  const look = (p, toward, drop = 0) => { const yy = g(...toward); return [toward[0], yy + 1 - drop, toward[1]]; };
  const pin = h.pin, tee = h.teePts.spire;
  const firstT = (h.targets || []).find(t => !t.pin) || { at: pin };
  const labelSet = [];
  const L3 = (p, text, dy) => ({ p: [p[0], g(...p) + 0.5, p[1]], text, dy });
  for (const t of h.targets || []) labelSet.push(L3(t.at, t.name, -46));
  labelSet.push(L3(pin, 'green', -60));
  for (const o of B.objs) if (o.name) { const c = o.at; labelSet.push({ p: [c[0], o.base + h.base + Math.min(o.h, (o.open || o.h * 0.6)) * 0.9, c[1]], text: o.name, dy: -50 }); }
  if (h.el) { const q = h.el[0].pts[Math.min(2, h.el[0].pts.length - 1)]; labelSet.push({ p: [q[0], h.el[0].y + h.base, q[1]], text: 'the El', dy: -40 }); }
  if (h.span) labelSet.push({ p: [(h.span.a[0] + h.span.b[0]) / 2, (h.span.a[2] + h.span.b[2]) / 2 + h.base + 8, (h.span.a[1] + h.span.b[1]) / 2], text: 'the fallen span', dy: -30 });
  if (h.rift) labelSet.push(L3(h.rift.pts[2], 'the rift', -40));
  if (h.inlet) labelSet.push(L3(h.inlet.pts[1], 'the inlet', -40));
  if (h.marker) labelSet.push(L3(h.marker, 'line marker', -40));
  for (const w of h.water || []) if (w.label) labelSet.push(L3(w.at, w.label, -36));
  const v = [];
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin), look: look(tee, pin, 6) });
    const fw = h.teePts.moss; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin), look: look(fw, pin, 5) });
  } else {
    const aim = firstT.at;
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, aim), look: look(tee, aim, 6) });
    // the landing area: the first target (the bold one on a hole with a carry choice still shows the line on)
    const next = (h.targets || []).find(t => t !== firstT && !t.pin && !t.bold);
    const to = next && h.par === 5 ? next.at : pin;
    v.push({ id: 'land', title: 'From the landing area', fov: 50, pos: eye(aim, to), look: look(aim, to, 6) });
  }
  // short of the green: 45 m back down the line
  const sg = at(h.line, h.len - 45);
  const gback = ((h.sketch || {}).green || {}).back || 55;
  const sg2 = at(h.line, h.len - gback), past = at(h.line, h.len + 25);
  v.push({ id: 'green', title: 'Short of the green', fov: 50, pos: eye(sg2, pin, 0, 9), look: [past[0], g(...h.pin) - 2, past[1]] });
  for (const x of v) { x.labels = labelSet; const o = (h.sketch || {})[x.id]; if (o) { if (o.up) x.look[1] += o.up; if (o.fov) x.fov = o.fov; if (o.eye) x.pos[1] += o.eye; } }
  // extra feature views for the "new this round" page: from [s, off, up] to [s, off, dy]
  for (const [k, e] of ((h.sketch || {}).extra || []).entries()) {
    const p = at(h.line, e.from[0], e.from[1]), q = at(h.line, e.to[0], e.to[1]);
    v.push({ id: 'x' + k, extra: true, title: e.title, fov: e.fov || 56, pos: [p[0], g(...p) + e.from[2], p[1]], look: [q[0], g(...q) + e.to[2], q[1]], labels: labelSet });
  }
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
