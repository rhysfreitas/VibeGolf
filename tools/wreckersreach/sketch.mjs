// node tools/wreckersreach/sketch.mjs [holes] : the plan book's sketch views. Plain shapes from the plan data
// (ground cells from worldAt, so the dunes, the hollows, the table and the shared ground are the real ground; the
// wrecks and the inn as boxes; masts, the lantern and the bell as posts; the beacon; tussocks of dune grass as
// tufts near the camera), projected through a real camera and drawn as ink and washes in SVG, hazed with distance,
// under a low storm-clearing sun, drawn light so the book prints. out/views/h<n>_<tee|land|green>.svg (+ .png).
// Painter's order by horizontal distance. (After tools/buriedkingdom/sketch.mjs.)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES, BACK, FRONT } from './holes.mjs';
import { BUILT, toWorld, toLocal, worldAt, densAt, STANDW } from './scene.mjs';
import { LABELS, TUSSOCK_CELL } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, clamp, project } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [226, 230, 232], MIST = 1800, FAR = 2600;
const SC = { dune: [238, 228, 200], fescue: [206, 198, 132], fairway: [150, 196, 108], fringe: [140, 190, 100], green: [146, 208, 106], tee: [168, 204, 132],
  pot: [250, 240, 206], tussock: [224, 212, 176], beach: [222, 208, 172], water: [112, 150, 170], wreck: [140, 110, 80], stone: [200, 192, 176], void: [26, 26, 30] };
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);
const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.72, 1 - Math.exp(-Math.max(0, d - 80) / MIST));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
// the sun: late afternoon, low in the south-west through the clearing (world direction toward it)
const SUN = (() => { const az = 240 * Math.PI / 180, el = 16 * Math.PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]; })();

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
  for (const [k, v, less] of [[0, x0, false], [0, x1, true], [1, y0, false], [1, y1, true]]) {
    const inp = out; out = []; if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = less ? a[k] <= v : a[k] >= v, ib = less ? b[k] <= v : b[k] >= v;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[k]) / (b[k] - a[k]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}
const fmt = P => P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

function renderView(hi, view) {
  HFOV = (view.fov || 60) * Math.PI / 180; FPX = (VW / 2) / Math.tan(HFOV / 2);
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look), W = WOR[hi];
  const a0 = h.place.heading * Math.PI / 180, rxw = [Math.cos(a0), Math.sin(a0)], fxw = [Math.sin(a0), -Math.cos(a0)];
  const L = (() => { const x = SUN[0] * rxw[0] + SUN[2] * rxw[1], z = -(SUN[0] * fxw[0] + SUN[2] * fxw[1]); return [x, SUN[1], z]; })();
  const polys = [];
  const proj = P => { const v = clipNear(P.map(cam.view)); if (v.length < 3) return null; const q = clipBox(v.map(cam.scr)); return q.length < 3 ? null : q; };
  const projLine = P => { const v = P.map(cam.view); if (v.some(q => q[2] < 0.6)) return null; return v.map(cam.scr); };
  const inView = (x, z, margin = 0.25) => { const v = cam.view([x, cam.pos[1], z]); return v[2] > -20 && Math.abs(v[0]) < (v[2] + 30) * (Math.tan(HFOV / 2) + margin); };
  const add = (key, svg) => polys.push({ key, svg });
  const lit = n => { const nl = Math.hypot(...n); return clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl, 0, 1); };

  // ---- ground
  const cache = new Map();
  const gq = (x, z) => { const key = x.toFixed(2) + ':' + z.toFixed(2); let v = cache.get(key); if (!v) { v = worldAt(...W(x, z)); cache.set(key, v); } return v; };
  const gy = (x, z) => gq(x, z).y;
  const cells = [];
  function cell(x, z, s) {
    const d = Math.hypot(x + s / 2 - cam.pos[0], z + s / 2 - cam.pos[2]);
    if (d > FAR + s) return;
    if (!inView(x + s / 2, z + s / 2, 0.35 + s / Math.max(d, 1))) return;
    const c = gq(x + s / 2, z + s / 2), k = [gq(x, z), gq(x + s, z), gq(x + s, z + s), gq(x, z + s)];
    const mixed = k.some(q => q.s !== c.s), tall = Math.max(...k.map(q => q.y)) - Math.min(...k.map(q => q.y));
    const want = Math.max(1.2, d * 0.02);
    if (s > want * 1.5 || (mixed && s > Math.max(1.2, d * 0.007)) || (tall > 12 && s > Math.max(3, d * 0.008))) { const t = s / 2; cell(x, z, t); cell(x + t, z, t); cell(x + t, z + t, t); cell(x, z + t, t); return; }
    cells.push({ x, z, s, c, k, d });
  }
  const S0 = 64, gx0 = Math.floor((cam.pos[0] - FAR) / S0) * S0, gz0 = Math.floor((cam.pos[2] - FAR) / S0) * S0;
  for (let x = gx0; x < cam.pos[0] + FAR; x += S0) for (let z = gz0; z < cam.pos[2] + FAR; z += S0) cell(x, z, S0);
  for (const q of cells) {
    const { x, z, s, c, k } = q;
    const ys = c.s === 'water' ? k.map(() => c.y) : k.map(v => v.s === 'water' ? c.y : v.y);
    let col = SC[c.s] || SC.dune;
    const dx = ((ys[1] + ys[2]) - (ys[0] + ys[3])) / (2 * s), dz = ((ys[2] + ys[3]) - (ys[0] + ys[1])) / (2 * s);
    const lam = lit([-dx, 1, -dz]), yc = (ys[0] + ys[1] + ys[2] + ys[3]) / 4;
    const tex = c.s === 'fairway' || c.s === 'tee' ? 0.985 + 0.03 * (Math.floor(Math.hypot(x, z) / 9) % 2) : c.s === 'dune' || c.s === 'fescue' ? 0.97 + 0.05 * hash(Math.floor(x / 7), Math.floor(z / 7)) : 1;
    col = c.s === 'water' ? col : col.map(v => v * (0.62 + 0.42 * lam) * tex);
    const P = proj([[x, ys[0], z], [x + s, ys[1], z], [x + s, ys[2], z + s], [x, ys[3], z + s]]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d)));
    add(q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    if (c.s === 'pot' && q.d < 320 && s <= 4) {   // grains in the pots
      const f = fogAt(q.d), cc = hex(mix([196, 170, 110], f)); let dots = '';
      for (let i = 0; i < 2; i++) { const v = cam.view([x + hash(x + i, z) * s, yc + 0.05, z + hash(z + i, x) * s]); if (v[2] < 1) continue; const p = cam.scr(v); dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0.6, 1.3 * (1.1 - f)).toFixed(2)}" fill="${cc}"/>`; }
      if (dots) add(q.d - 0.03, dots);
    }
    if (c.s === 'water' && q.d < 700 && s <= 10 && hash(Math.floor(x / 5), Math.floor(z / 5)) > 0.6) {
      const p = projLine([[x + s * 0.1, c.y + 0.05, z + s / 2], [x + s * 0.9, c.y + 0.05, z + s / 2]]);
      if (p) add(q.d - 0.02, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${hex(mix([236, 244, 250], fogAt(q.d) * 0.5))}" stroke-width="1.2"/>`);
    }
  }

  // ---- ink outlines draped on the ground: the green, bunkers, the fairway's edge, the tee pads
  const drape = (P, closed, colr, wd, lift = 0.15) => {
    const pts = closed ? [...P, P[0]] : P;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 3));
      for (let k = 0; k < n; k++) {
        const x1 = ax + (bx - ax) * k / n, z1 = az + (bz - az) * k / n, x2 = ax + (bx - ax) * (k + 1) / n, z2 = az + (bz - az) * (k + 1) / n;
        const d = cam.hd([x1, 0, z1]); if (d > 900) continue;
        const p = projLine([[x1, gy(x1, z1) + lift, z1], [x2, gy(x2, z2) + lift, z2]]); if (!p) continue;
        const f = fogAt(d);
        add(d - 0.05, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${hex(mix(colr, f))}" stroke-width="${(wd * (1.15 - f)).toFixed(2)}" stroke-linecap="round"/>`);
      }
    }
  };
  const segDrape = (segs, colr, wd) => { for (const [p, q] of segs) drape([p, q], false, colr, wd); };
  for (const t of B.teePads) { const c = Math.cos(headingAt(h.line, 1)), sn = Math.sin(headingAt(h.line, 1)); drape([[-6, -5], [6, -5], [6, 5], [-6, 5]].map(([u, v]) => [t.x + u * c - v * sn, t.z + u * sn + v * c]), true, [110, 130, 150], 0.9); }
  { const [px, pz] = h.pin; segDrape(edgeSegs((x, z) => B.gm(x, z) < 0, px - 45, pz - 45, px + 45, pz + 45, 1), [60, 96, 40], 1.4); }
  for (const b of B.bunkers) segDrape(edgeSegs(B.inBunker(b), ...b.box, 0.8), [150, 124, 70], 1.2);
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]); segDrape(edgeSegs((x, z) => B.surface(x, z) === 'fairway', Math.min(...xs) - 100, Math.min(...zs) - 40, Math.max(...xs) + 100, Math.max(...zs) + 40, 2), [96, 132, 70], 1.0); }

  // ---- solids: boxes (optionally tapering to the top), posts, tufts
  const ink = d => `stroke="${hex(mix([60, 54, 44], fogAt(d) * 0.9))}"`;
  function prism(o, colr, taper = 1, roof = 0) {
    const d0 = cam.hd([o.x, 0, o.z]); if (d0 > 2200 || !inView(o.x, o.z, 0.4 + 40 / Math.max(d0, 1))) return;
    const c = Math.cos(o.rot), s = Math.sin(o.rot), cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [u * o.w / 2, v * o.l / 2]);
    const pt = ([u, v], y, t = 1) => [o.x + (u * c + v * s) * t, y, o.z + (u * s - v * c) * t];
    const y0 = o.base, y1 = o.base + o.h, f = fogAt(d0);
    for (let i = 0; i < 4; i++) {
      const a = cor[i], b = cor[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [m[0] * c + m[1] * s, 0, m[0] * s - m[1] * c], mid = pt(m, y0);
      if (n[0] * (cam.pos[0] - mid[0]) + n[2] * (cam.pos[2] - mid[2]) <= 0) continue;
      const P = proj([pt(a, y0), pt(b, y0), pt(b, y1, taper), pt(a, y1, taper)]); if (!P) continue;
      const fc = hex(mix(colr.map(v => v * (0.76 + 0.3 * lit(n))), f));
      add(cam.hd(mid) - 0.2, `<polygon points="${fmt(P)}" fill="${fc}" ${ink(d0)} stroke-width="${(1.1 * (1.2 - f)).toFixed(2)}" stroke-linejoin="round"/>`);
    }
    if (roof) { const rz = pt([0, -o.l / 2], y1 + roof), rb = pt([0, o.l / 2], y1 + roof);   // a ridge tent
      for (const sg of [-1, 1]) { const P = proj([pt([sg * o.w / 2, -o.l / 2], y1), pt([sg * o.w / 2, o.l / 2], y1), rb, rz]); if (P) add(d0 - 0.3, `<polygon points="${fmt(P)}" fill="${hex(mix(colr.map(v => v * (sg < 0 ? 0.86 : 1)), f))}" ${ink(d0)} stroke-width="0.8"/>`); } }
    else if (cam.pos[1] > y1) { const P = proj(cor.map(q => pt(q, y1, taper))); if (P) add(d0 - 0.25, `<polygon points="${fmt(P)}" fill="${hex(mix(colr.map(v => v * 1.04), f))}" ${ink(d0)} stroke-width="0.8"/>`); }
  }
  const TIMBER = [150, 118, 86], STONE = [206, 198, 182];
  const post = (o, colr, wd = 0.5, top = null) => { const d = cam.hd([o.x, 0, o.z]); if (d > 1800 || !inView(o.x, o.z)) return;
    const lean = (o.lean || 0) * Math.PI / 180, a = cam.view([o.x, o.base, o.z]), b = cam.view([o.x + Math.sin(lean) * o.h, o.base + o.h * Math.cos(lean), o.z]); if (a[2] < 1 || b[2] < 1) return;
    const pa = cam.scr(a), pb = cam.scr(b), f = fogAt(d);
    let sv = `<line x1="${pa[0].toFixed(1)}" y1="${pa[1].toFixed(1)}" x2="${pb[0].toFixed(1)}" y2="${pb[1].toFixed(1)}" stroke="${hex(mix(colr, f))}" stroke-width="${Math.max(1.2, wd / a[2] * FPX).toFixed(1)}" stroke-linecap="round"/>`;
    if (top === 'yard') { const y = cam.view([o.x, o.base + o.h * 0.78, o.z]); if (y[2] > 1) { const p = cam.scr(y), r = o.h * 0.28 / y[2] * FPX; sv += `<line x1="${(p[0] - r).toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${(p[0] + r).toFixed(1)}" y2="${(p[1] + r * 0.12).toFixed(1)}" stroke="${hex(mix(colr, f))}" stroke-width="${Math.max(1, wd * 0.7 / y[2] * FPX).toFixed(1)}"/>`; } }
    if (top === 'lamp') sv += `<circle cx="${pb[0].toFixed(1)}" cy="${pb[1].toFixed(1)}" r="${Math.max(2.5, 0.6 / b[2] * FPX).toFixed(1)}" fill="${hex(mix([240, 190, 90], f))}" ${ink(d)} stroke-width="0.8"/>`;
    if (top === 'bell') { const r = Math.max(3, 0.45 / b[2] * FPX); sv += `<path d="M${(pb[0] - r).toFixed(1)},${(pb[1] + r * 1.6).toFixed(1)} Q${pb[0].toFixed(1)},${(pb[1] - 2).toFixed(1)} ${(pb[0] + r).toFixed(1)},${(pb[1] + r * 1.6).toFixed(1)} Z" fill="${hex(mix([196, 150, 60], f))}" ${ink(d)} stroke-width="0.8"/>`; }
    add(d - 0.1, sv); };
  for (const o0 of B.objs) {
    const o = { ...o0, base: o0.base + h.base };
    if (o.kind === 'hull') prism(o, o.wall ? [120, 92, 66] : TIMBER, 0.86);
    else if (o.kind === 'castle') prism(o, [132, 100, 70], 0.92);
    else if (o.kind === 'inn') prism(o, [176, 140, 100], 1, 4);
    else if (o.kind === 'lugger') prism(o, [160, 120, 84], 0.8);
    else if (o.kind === 'rib') prism(o, [120, 94, 70], 0.7);
    else if (o.kind === 'wall') prism(o, STONE);
    else if (o.kind === 'beacon') prism({ ...o, w: o.r * 2, l: o.r * 2, rot: 0 }, STONE, 0.7);
    else if (o.kind === 'mast') post(o, [90, 70, 50], o.r * 1.4, 'yard');
    else if (o.kind === 'lantern') post(o, [80, 64, 48], 0.4, 'lamp');
    else if (o.kind === 'bell') post(o, [80, 64, 48], 0.4, 'bell');
  }
  // tussocks of dune grass near the camera: tufts of arching blades leaning with the wind (from the south-west)
  { const S = TUSSOCK_CELL, R0 = 230, i0 = Math.floor((cam.pos[0] - R0) / S), i1 = Math.ceil((cam.pos[0] + R0) / S), j0 = Math.floor((cam.pos[2] - R0) / S), j1 = Math.ceil((cam.pos[2] + R0) / S);
    const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    const lean = (() => { const a = (225 + 180 - h.place.heading) * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; })();
    const tuft = (x, z, r, tall, d) => { const g = gy(x, z), f = fogAt(d), base = cam.view([x, g, z]); if (base[2] < 2) return;
      const pb = cam.scr(base), col = hex(mix([150, 136, 70], f)), col2 = hex(mix([196, 178, 104], f)); let sv = '';
      const n = 7;
      for (let k = 0; k < n; k++) { const a = (k / (n - 1) - 0.5) * 1.8, tx = x + Math.sin(a) * r * 0.9 + lean[0] * tall * 0.35, tz = z + lean[1] * tall * 0.35, top = cam.view([tx, g + tall * (0.75 + 0.25 * Math.cos(a)), tz]); if (top[2] < 1) continue;
        const pt = cam.scr(top); sv += `<path d="M${(pb[0] + a * 2).toFixed(1)},${pb[1].toFixed(1)} Q${((pb[0] + pt[0]) / 2).toFixed(1)},${(pt[1] - 2).toFixed(1)} ${pt[0].toFixed(1)},${pt[1].toFixed(1)}" fill="none" stroke="${k % 2 ? col : col2}" stroke-width="${Math.max(0.6, 0.12 / base[2] * FPX).toFixed(2)}" stroke-linecap="round"/>`; }
      add(d - 0.04, sv); };
    // the tussocks on the hole's own world (the same jittered grid world.mjs keeps), in world cells
    const Wc = (x, z) => W(x, z), Lc = LOC[hi];
    const [wx, wz] = Wc(cam.pos[0], cam.pos[2]);
    const I0 = Math.floor((wx - R0) / S), I1 = Math.ceil((wx + R0) / S), J0 = Math.floor((wz - R0) / S), J1 = Math.ceil((wz + R0) / S);
    for (let i = I0; i <= I1; i++) for (let j = J0; j <= J1; j++) {
      const X = (i + 0.2 + 0.6 * hsh(i, j)) * S, Z = (j + 0.2 + 0.6 * hsh(j, i + 7)) * S, [cx, cz] = Lc(X, Z), d = Math.hypot(cx - cam.pos[0], cz - cam.pos[2]);
      if (d > R0 || d < 3 || !inView(cx, cz, 0.1)) continue;
      if (!(hsh(i * 1.7 + 11, j * 1.3 + 4) < densAt(X, Z))) continue;
      const sf = worldAt(X, Z).s; if (sf !== 'dune' && sf !== 'tussock') continue;
      tuft(cx, cz, 0.65 + 0.65 * hsh(i + 3, j + 5), 1.1 + 0.4 * hsh(i + 9, j + 1), d);
    }
    for (const st of STANDW) { const [x, z] = Lc(...st.c), d = Math.hypot(x - cam.pos[0], z - cam.pos[2]); if (d > 600 || !inView(x, z)) continue;
      for (let k = 0; k < 9; k++) { const a = k * 2.4, rr = Math.sqrt(k / 9) * Math.min(st.rx, st.rz); tuft(x + Math.cos(a) * rr, z + Math.sin(a) * rr, 1.1, st.h || 1.5, d); } }
  }
  // the flag
  { const [px, pz] = h.pin, y = gy(px, pz), d = cam.hd([px, 0, pz]), p = projLine([[px, y, pz], [px, y + 2.4, pz]]);
    if (p) { const sc = (p[0][1] - p[1][1]) / 2.4; add(d - 0.4, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="#333" stroke-width="${Math.max(1, sc * 0.05).toFixed(1)}"/><polygon points="${p[1][0].toFixed(1)},${p[1][1].toFixed(1)} ${(p[1][0] + Math.max(5, sc * 0.75)).toFixed(1)},${(p[1][1] + Math.max(2.5, sc * 0.28)).toFixed(1)} ${p[1][0].toFixed(1)},${(p[1][1] + Math.max(5, sc * 0.56)).toFixed(1)}" fill="#c0392b"/>`); } }

  polys.sort((a, b) => b.key - a.key);
  // ---- labels
  let lsvg = ''; const placed = [];
  for (const Lb of view.labels || []) {
    const v = cam.view(Lb.p); if (v[2] < 8 || v[2] > 1800) continue; const s = cam.scr(v); if (s[0] < 70 || s[0] > VW - 70 || s[1] < 30 || s[1] > VH - 20) continue;
    const w = Lb.text.length * 7.6 + 14; let ty = s[1] + Lb.dy;
    for (let k = 0; k < 8; k++) { if (!placed.some(p => Math.abs(p.x - s[0]) < (p.w + w) / 2 + 4 && Math.abs(p.y - ty) < 22)) break; ty -= 24; }
    ty = clamp(ty, 16, VH - 16); placed.push({ x: s[0], y: ty, w });
    lsvg += `<line x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${s[0].toFixed(1)}" y2="${(ty + 9).toFixed(1)}" stroke="#333" stroke-width="0.8"/><circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="2.2" fill="#333"/>` +
      `<rect x="${(s[0] - w / 2).toFixed(1)}" y="${(ty - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="3" fill="white" fill-opacity="0.9" stroke="#333" stroke-width="0.6"/>` +
      `<text x="${s[0].toFixed(1)}" y="${(ty + 4.5).toFixed(1)}" font-family="DejaVu Sans, sans-serif" font-size="13" text-anchor="middle" fill="#222">${Lb.text.replace(/&/g, '&amp;')}</text>`;
  }
  const hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 6000, cam.pos[1], cam.pos[2] + cam.f[2] * 6000]))[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f9eaa"/><stop offset="${clamp(hz / VH * 0.55, 0.05, 0.9).toFixed(3)}" stop-color="#b9c6cf"/><stop offset="${clamp(hz / VH * 0.9, 0.06, 0.95).toFixed(3)}" stop-color="#e9e1cc"/><stop offset="${clamp(hz / VH, 0.06, 0.95).toFixed(3)}" stop-color="#e2e4e2"/><stop offset="1" stop-color="#e2e4e2"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/><rect y="${Math.max(0, hz).toFixed(1)}" width="${VW}" height="${VH}" fill="${hex(mix(SC.water, 0.55))}"/>` + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee (2.4 m up, near the game's eye), from the landing area (par 3: the
// forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], W = WOR[hi], g = (x, z) => worldAt(...W(x, z)).y, here = LOC[hi];
  const eye = (p, toward, back = 4, up = 5) => { const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), x = p[0] - dx / l * back, z = p[1] - dz / l * back; return [x, Math.max(g(x, z), g(p[0], p[1])) + up, z]; };
  const look = (toward, drop = 0) => [toward[0], g(...toward) + 1 - drop, toward[1]];
  const pin = h.pin, tee = h.teePts[BACK], firstT = (h.targets || []).filter(t => !t.bold)[0] || { at: pin };
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  const labels = [];
  for (const t of h.targets || []) labels.push(L3(t.at, t.name, -46));
  labels.push(L3(pin, 'green', -60));
  for (const f of h.forms || []) if (f.label) labels.push(L3(f.world ? h.L(...f.world) : f.at, f.label, -30, 1));
  for (const o of BUILT[hi].objs) if (o.label) labels.push({ p: [o.x, o.base + h.base + o.h, o.z], text: o.label, dy: -26 });
  const UP = { 'the beacon': 26, "the Wrecker's Inn": 12, 'the foredune': 8 };
  for (const [wp, t] of LABELS) { const p = here(...wp); if (project(h.line, ...p).d < (UP[t] > 20 ? 1500 : 330)) labels.push(L3(p, t, -34, UP[t] ?? 1)); }
  const v = [], sk = h.sketch || {};
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin, 4, 2.4), look: look(pin, -2) });
    const fw = h.teePts[FRONT]; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin, 4, 2.4), look: look(pin, -2) });
  } else {
    const aim = h.table ? at(h.line, h.table.s0 + 30, 0) : firstT.at;
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, aim, 4, 2.4), look: look(aim, sk.teeDrop ?? -2) });
    const next = (h.targets || []).find(t => t !== firstT && !t.bold), to = next && h.par === 5 ? next.at : pin;
    v.push({ id: 'land', title: 'From the landing area', fov: 50, pos: eye(firstT.at, to, 4, 4), look: look(to, 2) });
  }
  const sg = at(h.line, h.len - (sk.greenBack ?? 60), sk.greenOff ?? 0), past = at(h.line, h.len + 25);
  v.push({ id: 'green', title: 'Short of the green', fov: 50, pos: eye(sg, pin, 0, 8), look: [past[0], g(...pin) - 2, past[1]] });
  for (const x of v) x.labels = labels;
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
