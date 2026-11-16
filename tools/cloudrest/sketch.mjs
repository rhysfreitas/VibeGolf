// node tools/cloudrest/sketch.mjs [holes] : the plan book's sketch views. Plain shapes from the plan data (ground
// cells from worldAt, so the walls, kerbs, the ridge, the pinnacles and the tiers are the real ground; open air drawn
// as the top of the mist, 150 m, far below; the pines as dark cones; the monastery and the sacred things as boxes with
// red or gold roofs; the alcove's roof as a slab of rock overhead), projected through a real camera and drawn as ink
// and washes in SVG, hazed with distance, the light low from the west, drawn light so the book prints.
// out/views/h<n>_<tee|land|green>.svg (+ .png). Painter's order by horizontal distance. (After
// tools/eldergrove/sketch.mjs.)
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES, BACK, FRONT } from './holes.mjs';
import { BUILT, toWorld, toLocal, worldAt, PINES } from './scene.mjs';
import { LABELS, SITES, MIST, ROOF, WLINES, roofOver } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, clamp, project } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [232, 226, 214], FOGD = 900, FAR = 2200;
const SC = { rough: [170, 190, 126], scrub: [136, 154, 104], rock: [170, 162, 150], kerb: [128, 122, 112], fairway: [142, 194, 104], fringe: [136, 190, 98], green: [146, 210, 106],
  tee: [160, 202, 126], sand: [240, 226, 190], water: [90, 120, 130], tea: [118, 160, 92], paving: [212, 200, 180], void: [244, 244, 246] };
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);
const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.8, 1 - Math.exp(-Math.max(0, d - 60) / FOGD));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
// the sun: late afternoon, low in the west-south-west (world direction toward it)
const SUN = (() => { const az = 250 * Math.PI / 180, el = 16 * Math.PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]; })();

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
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look), W = WOR[hi], Lc = LOC[hi], base = B.base;
  const a0 = h.place.heading * Math.PI / 180, rxw = [Math.cos(a0), Math.sin(a0)], fxw = [Math.sin(a0), -Math.cos(a0)];
  const L = (() => { const x = SUN[0] * rxw[0] + SUN[2] * rxw[1], z = -(SUN[0] * fxw[0] + SUN[2] * fxw[1]); return [x, SUN[1], z]; })();
  const polys = [];
  const proj = P => { const v = clipNear(P.map(cam.view)); if (v.length < 3) return null; const q = clipBox(v.map(cam.scr)); return q.length < 3 ? null : q; };
  const projLine = P => { const v = P.map(cam.view); if (v.some(q => q[2] < 0.6)) return null; return v.map(cam.scr); };
  const inView = (x, z, margin = 0.25) => { const v = cam.view([x, cam.pos[1], z]); return v[2] > -20 && Math.abs(v[0]) < (v[2] + 30) * (Math.tan(HFOV / 2) + margin); };
  const add = (key, svg) => polys.push({ key, svg });
  const lit = n => { const nl = Math.hypot(...n); return clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl, 0, 1); };
  const ink = d => `stroke="${hex(mix([60, 54, 44], fogAt(d) * 0.9))}"`;

  // ---- ground (heights relative to the hole's base); open air as the mist's top far below
  const MY = MIST - base, cache = new Map();
  const gq = (x, z) => { const key = x.toFixed(2) + ':' + z.toFixed(2); let v = cache.get(key); if (!v) { const q = worldAt(...W(x, z)); v = { y: q.y === null ? null : q.y - base, s: q.y === null ? 'void' : q.s }; cache.set(key, v); } return v; };
  const gy = (x, z) => { const v = gq(x, z); return v.y ?? MY; };
  const cells = [];
  function cell(x, z, s) {
    const d = Math.hypot(x + s / 2 - cam.pos[0], z + s / 2 - cam.pos[2]);
    if (d > FAR + s) return;
    { const v = cam.view([x + s / 2, cam.pos[1], z + s / 2]), r = s * 0.72; if (v[2] < -20 - r || Math.abs(v[0]) > (v[2] + 30 + r) * (Math.tan(HFOV / 2) + 0.35) + r) return; }   // a cell's whole square, not just its centre (the one under the camera)
    const c = gq(x + s / 2, z + s / 2), k = [gq(x, z), gq(x + s, z), gq(x + s, z + s), gq(x, z + s)];
    const mixed = k.some(q => q.s !== c.s), ys = k.map(q => q.y ?? MY), tall = Math.max(...ys) - Math.min(...ys);
    const want = Math.max(1.2, d * 0.02);
    if (s > want * 1.5 || (mixed && s > Math.max(1.2, d * 0.007)) || (tall > 8 && s > Math.max(2, d * 0.006))) { const t = s / 2; cell(x, z, t); cell(x + t, z, t); cell(x + t, z + t, t); cell(x, z + t, t); return; }
    cells.push({ x, z, s, c, k, d });
  }
  const S0 = 64, gx0 = Math.floor((cam.pos[0] - FAR) / S0) * S0, gz0 = Math.floor((cam.pos[2] - FAR) / S0) * S0;
  for (let x = gx0; x < cam.pos[0] + FAR; x += S0) for (let z = gz0; z < cam.pos[2] + FAR; z += S0) cell(x, z, S0);
  for (const q of cells) {
    const { x, z, s, c, k } = q;
    if (c.s === 'void') {   // the mist: a pale sheet, brighter toward the sun
      const P = proj([[x, MY, z], [x + s, MY, z], [x + s, MY, z + s], [x, MY, z + s]]); if (!P) continue;
      const t = 0.9 + 0.08 * hash(Math.floor(x / 40), Math.floor(z / 40)), col = [246 * t, 244 * t, 240 * t];
      add(q.d + 4000, `<polygon points="${fmt(P)}" fill="${hex(mix(col, fogAt(q.d) * 0.5))}" stroke="${hex(mix(col, fogAt(q.d) * 0.5))}" stroke-width="0.7"/>`);
      continue;
    }
    const ys = k.map(v => v.y ?? c.y - 1.5);   // a corner over open air: the edge (the face below is drawn on its own)
    const yw = c.s === 'water' ? ys.map(() => c.y) : ys;
    let col = SC[c.s] || SC.rough;
    const dx = ((yw[1] + yw[2]) - (yw[0] + yw[3])) / (2 * s), dz = ((yw[2] + yw[3]) - (yw[0] + yw[1])) / (2 * s);
    const steep = Math.hypot(dx, dz) > 1.2, lam = lit([-dx, 1, -dz]);
    if (steep && !['fairway', 'green', 'tee', 'fringe', 'water'].includes(c.s)) col = [150, 142, 132];   // faces: grey rock
    const tex = c.s === 'fairway' || c.s === 'tee' ? 0.985 + 0.03 * (Math.floor(Math.hypot(x, z) / 9) % 2) : 0.95 + 0.08 * hash(Math.floor(x / 5), Math.floor(z / 5));
    col = c.s === 'water' ? col : col.map(v => v * (0.6 + 0.46 * lam) * tex);
    const P = proj([[x, yw[0], z], [x + s, yw[1], z], [x + s, yw[2], z + s], [x, yw[3], z + s]]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d)));
    add(q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    // a cliff face down to the mist wherever this cell meets open air
    if (k.some(v => v.y === null) || [[s / 2 + 0.6, 0], [-(s / 2 + 0.6), 0], [0, s / 2 + 0.6], [0, -(s / 2 + 0.6)]].some(([u, v]) => gq(x + s / 2 + u, z + s / 2 + v).s === 'void')) {
      const C = [[x, z], [x + s, z], [x + s, z + s], [x, z + s]];
      for (let i = 0; i < 4; i++) {
        const a = C[i], b2 = C[(i + 1) % 4], m = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2], n = [b2[1] - a[1], 0, -(b2[0] - a[0])];   // outward for a clockwise ring in x right, z down-screen
        const out = [m[0] + Math.sign(n[0]) * 0.8 * (n[0] !== 0), m[1] + Math.sign(n[2]) * 0.8 * (n[2] !== 0)];
        if (gq(...out).s !== 'void') continue;
        if (n[0] * (cam.pos[0] - m[0]) + n[2] * (cam.pos[2] - m[1]) <= 0) continue;
        const ya = Math.min(yw[i], c.y), yb = Math.min(yw[(i + 1) % 4], c.y), P2 = proj([[a[0], ya, a[1]], [b2[0], yb, b2[1]], [b2[0], MY, b2[1]], [a[0], MY, a[1]]]); if (!P2) continue;
        const rc = [158, 150, 140].map(v => v * (0.62 + 0.42 * lit(n)) * (0.93 + 0.1 * hash(Math.floor(a[0] / 7), Math.floor(a[1] / 7))));
        const fc2 = hex(mix(rc, fogAt(q.d)));
        add(q.d + 0.05, `<polygon points="${fmt(P2)}" fill="${fc2}" stroke="${fc2}" stroke-width="0.6"/>`);
      }
    }
    if (c.s === 'tea' && q.d < 380 && s <= 4) {   // rows of tea bushes
      const f = fogAt(q.d), cc = hex(mix([80, 120, 62], f)); let dots = '';
      for (let i = 0; i < 2; i++) { const v = cam.view([x + hash(x + i, z) * s, c.y + 0.4, z + hash(z + i, x) * s]); if (v[2] < 1) continue; const p = cam.scr(v); dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0.8, 2.2 * (1.1 - f) * 60 / Math.max(q.d, 30)).toFixed(2)}" fill="${cc}"/>`; }
      if (dots) add(q.d - 0.03, dots);
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
  { const c = Math.cos(headingAt(h.line, 1)), sn = Math.sin(headingAt(h.line, 1)); for (const t of B.teePads) drape([[-5, -6], [5, -6], [5, 6], [-5, 6]].map(([u, v]) => [t.x + u * c - v * sn, t.z + u * sn + v * c]), true, [110, 130, 150], 0.9); }
  { const [px, pz] = h.pin; segDrape(edgeSegs((x, z) => B.gm(x, z) < 0, px - 45, pz - 45, px + 45, pz + 45, 1), [60, 96, 40], 1.4); }
  for (const b of B.bunkers) segDrape(edgeSegs(B.inBunker(b), ...b.box, 0.8), [150, 124, 70], 1.2);
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]); segDrape(edgeSegs((x, z) => B.surface(x, z) === 'fairway', Math.min(...xs) - 100, Math.min(...zs) - 40, Math.max(...xs) + 100, Math.max(...zs) + 40, 2), [96, 132, 70], 1.0); }

  // ---- boxes (optionally tapering to the top), with a pitched roof or a spire
  function prism(o, colr, taper = 1, roof = null) {
    const d0 = cam.hd([o.x, 0, o.z]); if (d0 > FAR || !inView(o.x, o.z, 0.4 + 40 / Math.max(d0, 1))) return;
    const c = Math.cos(o.rot), s = Math.sin(o.rot), cor = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [u * o.w / 2, v * o.l / 2]);
    const pt = ([u, v], y, t = 1) => [o.x + (u * c + v * s) * t, y, o.z + (u * s - v * c) * t];   // v along the bearing (sin, -cos)
    const y0 = o.base, y1 = o.base + o.h, f = fogAt(d0);
    for (let i = 0; i < 4; i++) {
      const a = cor[i], b = cor[(i + 1) % 4], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n = [m[0] * c + m[1] * s, 0, m[0] * s - m[1] * c], mid = pt(m, y0);
      if (n[0] * (cam.pos[0] - mid[0]) + n[2] * (cam.pos[2] - mid[2]) <= 0) continue;
      const P = proj([pt(a, y0), pt(b, y0), pt(b, y1, taper), pt(a, y1, taper)]); if (!P) continue;
      add(cam.hd(mid) - 0.2, `<polygon points="${fmt(P)}" fill="${hex(mix(colr.map(v => v * (0.76 + 0.3 * lit(n))), f))}" ${ink(d0)} stroke-width="${(1.1 * (1.2 - f)).toFixed(2)}" stroke-linejoin="round"/>`);
    }
    if (roof === 'spire') { const tip = [o.x, y1 + o.h * 0.7, o.z]; for (let i = 0; i < 4; i++) { const P = proj([pt(cor[i], y1, taper), pt(cor[(i + 1) % 4], y1, taper), tip]); if (P) add(d0 - 0.3 - i * 0.01, `<polygon points="${fmt(P)}" fill="${hex(mix([212, 170, 60].map(v => v * (0.8 + 0.2 * (i % 2))), f))}" ${ink(d0)} stroke-width="0.7"/>`); } }
    else if (roof) {   // a pitched roof with deep eaves, the ridge along its length
      const rc = roof === 'gold' ? [214, 168, 52] : [168, 62, 44], e = 1.18, rh = Math.min(o.w, o.l) * 0.32, ridge = [pt([0, -o.l / 2 * e], y1 + rh), pt([0, o.l / 2 * e], y1 + rh)];
      for (const sg of [-1, 1]) { const P = proj([pt([sg * o.w / 2 * e, -o.l / 2 * e], y1 - 0.6), pt([sg * o.w / 2 * e, o.l / 2 * e], y1 - 0.6), ridge[1], ridge[0]]); if (P) add(d0 - 0.3 - (sg > 0 ? 0.01 : 0), `<polygon points="${fmt(P)}" fill="${hex(mix(rc.map(v => v * (sg < 0 ? 0.84 : 1.04)), f))}" ${ink(d0)} stroke-width="0.8"/>`); }
    } else if (cam.pos[1] > y1) { const P = proj(cor.map(q => pt(q, y1, taper))); if (P) add(d0 - 0.25, `<polygon points="${fmt(P)}" fill="${hex(mix(colr.map(v => v * 1.04), f))}" ${ink(d0)} stroke-width="0.8"/>`); }
  }
  const HD = h.place.heading * Math.PI / 180;
  for (const o of SITES) {
    const [x, z] = Lc(...o.at), g = gy(x, z), bo = { x, z, w: o.w, l: o.l, h: o.h, rot: o.rot - HD, base: g - 0.3 };
    if (o.kind === 'hall') prism(bo, [238, 232, 220], 1, o.roof || 'red');
    else if (o.kind === 'stupa') { prism({ ...bo, h: o.h * 0.45 }, [246, 244, 238], 0.82); prism({ ...bo, w: o.w * 0.5, l: o.l * 0.5, h: o.h * 0.3, base: bo.base + o.h * 0.45 }, [246, 244, 238], 0.7, 'spire'); }
    else if (o.kind === 'wall') prism(bo, [200, 190, 172]);
    else if (o.kind === 'cairn') prism(bo, [150, 144, 134], 0.35);
    else if (o.kind === 'gatehouse' || o.kind === 'wheel') prism(bo, [230, 222, 206], 1, 'red');
    else if (o.kind === 'stair') prism(bo, [196, 188, 170], 1);
    else if (o.kind === 'halls') prism({ ...bo, base: g + 2 }, [236, 228, 214], 1, 'red');
    else if (o.kind === 'bridge') { const c = Math.cos(bo.rot), s = Math.sin(bo.rot), A = [x - s * o.l / 2, z + c * o.l / 2], Bp = [x + s * o.l / 2, z - c * o.l / 2], ya = gy(...A), yb = gy(...Bp), sag = 6, pts = [];
      for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([A[0] + (Bp[0] - A[0]) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t) + 0.8, A[1] + (Bp[1] - A[1]) * t]); }
      const p = pts.map(cam.view); if (p.every(q => q[2] > 1)) add(cam.hd([x, 0, z]) - 1, `<polyline points="${fmt(p.map(cam.scr))}" fill="none" stroke="#5a4632" stroke-width="2"/>`); }
  }
  // the pines: dark tiered cones, lit on the sun's side
  const rx = cam.r[0], rz = cam.r[2], rl = Math.hypot(rx, rz), ux = rx / rl, uz = rz / rl, litS = clamp(0.5 + 0.5 * (ux * L[0] + uz * L[2]), 0, 1);
  for (const t of B.pines) {
    const d0 = cam.hd([t.x, 0, t.z]); if (d0 > 1600 || !inView(t.x, t.z, 0.3)) continue;
    const g = gy(t.x, t.z), f = fogAt(d0), Q = [];
    for (let k = 0; k <= 3; k++) { const y = g + 1.5 + (t.h - 1.5) * k / 3, r = t.r * (1 - k / 3.3); Q.push([[t.x - ux * r, y, t.z - uz * r], [t.x + ux * r, y, t.z + uz * r]]); }
    const P = proj([Q[0][0], Q[1][0], Q[1][0].map((v, i) => i === 1 ? v : v * 1), Q[2][0], [t.x, g + t.h + 1.5, t.z], Q[2][1], Q[1][1], Q[0][1]]); if (!P) continue;
    add(d0 - 0.1, `<polygon points="${fmt(P)}" fill="${hex(mix([52 + 30 * litS, 76 + 24 * litS, 54 + 10 * litS], f))}" stroke="none"/>`);
  }
  // the alcove's roof: an overhang of rock, its underside a dark slab
  { const k = ROOF.hole, Wl = WLINES[k], pts = [];
    for (let s = ROOF.s0; s <= ROOF.s1; s += 10) { const p = at(Wl, Math.max(0, s), ROOF.off1); pts.push(p); }
    for (let s = ROOF.s1; s >= ROOF.s0; s -= 10) { const p = at(Wl, Math.max(0, s), ROOF.off0); pts.push(p); }
    const P3 = pts.map(([X, Z]) => { const [x, z] = Lc(X, Z), r = roofOver(X, Z) ?? ROOF.under; return [x, r - base, z]; });
    const c0 = Lc(...at(Wl, (ROOF.s0 + ROOF.s1) / 2, 0)), d0 = cam.hd([c0[0], 0, c0[1]]);
    if (d0 < FAR) { const P = proj(P3); if (P) add(cam.pos[1] < ROOF.under - base ? -1 : d0 + 50, `<polygon points="${fmt(P)}" fill="${hex(mix([92, 86, 80], fogAt(d0) * 0.6))}" opacity="0.94" ${ink(d0)} stroke-width="1"/>`); } }
  // the flag
  { const [px, pz] = h.pin, y = gy(px, pz), d = cam.hd([px, 0, pz]), p = projLine([[px, y, pz], [px, y + 2.4, pz]]);
    if (p) { const sc = (p[0][1] - p[1][1]) / 2.4; add(d - 0.4, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="#333" stroke-width="${Math.max(1, sc * 0.05).toFixed(1)}"/><polygon points="${p[1][0].toFixed(1)},${p[1][1].toFixed(1)} ${(p[1][0] + Math.max(5, sc * 0.75)).toFixed(1)},${(p[1][1] + Math.max(2.5, sc * 0.28)).toFixed(1)} ${p[1][0].toFixed(1)},${(p[1][1] + Math.max(5, sc * 0.56)).toFixed(1)}" fill="#c0392b"/>`); } }
  // markers (the 8th's upper terrace, the 6th's lip)
  for (const m of view.markers || []) { const y = gy(...m), d = cam.hd([m[0], 0, m[1]]), p = projLine([[m[0], y, m[1]], [m[0], y + 2.5, m[1]]]); if (p) add(d - 0.4, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="#d6ad2a" stroke-width="2.4"/>`); }

  polys.sort((a, b) => b.key - a.key);
  // ---- labels
  let lsvg = ''; const placed = [];
  for (const Lb of view.labels || []) {
    const v = cam.view(Lb.p); if (v[2] < 8 || v[2] > 2200) continue; const s = cam.scr(v); if (s[0] < 70 || s[0] > VW - 70 || s[1] < 30 || s[1] > VH - 20) continue;
    const w = Lb.text.length * 7.6 + 14; let ty = s[1] + Lb.dy;
    for (let k = 0; k < 8; k++) { if (!placed.some(p => Math.abs(p.x - s[0]) < (p.w + w) / 2 + 4 && Math.abs(p.y - ty) < 22)) break; ty -= 24; }
    ty = clamp(ty, 16, VH - 16); placed.push({ x: s[0], y: ty, w });
    lsvg += `<line x1="${s[0].toFixed(1)}" y1="${s[1].toFixed(1)}" x2="${s[0].toFixed(1)}" y2="${(ty + 9).toFixed(1)}" stroke="#333" stroke-width="0.8"/><circle cx="${s[0].toFixed(1)}" cy="${s[1].toFixed(1)}" r="2.2" fill="#333"/>` +
      `<rect x="${(s[0] - w / 2).toFixed(1)}" y="${(ty - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="3" fill="white" fill-opacity="0.9" stroke="#333" stroke-width="0.6"/>` +
      `<text x="${s[0].toFixed(1)}" y="${(ty + 4.5).toFixed(1)}" font-family="DejaVu Sans, sans-serif" font-size="13" text-anchor="middle" fill="#222">${Lb.text.replace(/&/g, '&amp;')}</text>`;
  }
  // the game's frame: 19° above level and 31° below, from the eye
  const hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 6000, cam.pos[1], cam.pos[2] + cam.f[2] * 6000]))[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c7d2"/><stop offset="${clamp(hz / VH * 0.7, 0.05, 0.9).toFixed(3)}" stop-color="#e3e1da"/><stop offset="${clamp(hz / VH, 0.06, 0.95).toFixed(3)}" stop-color="#f1e9da"/><stop offset="1" stop-color="#f4f1ea"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/>` + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee (2.4 m up, near the game's eye), from the landing area (par 3: the
// forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], W = WOR[hi], base = BUILT[hi].base, g = (x, z) => { const v = worldAt(...W(x, z)).y; return (v === null ? MIST : v) - base; }, here = LOC[hi];
  const eye = (p, toward, back = 4, up = 5) => { const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), x = p[0] - dx / l * back, z = p[1] - dz / l * back; return [x, Math.max(g(x, z), g(p[0], p[1])) + up, z]; };
  const look = (toward, drop = 0) => [toward[0], g(...toward) + 1 - drop, toward[1]];
  const pin = h.pin, tee = h.teePts[BACK], firstT = (h.targets || []).filter(t => !t.bold)[0] || { at: pin };
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  const labels = [];
  for (const t of h.targets || []) if (!t.pin) labels.push(L3(t.at, t.name, -46));
  labels.push(L3(pin, 'green', -60));
  for (const [wp, t] of LABELS) { const p = here(...wp); if (project(h.line, ...p).d < 900) labels.push(L3(p, t, -34, 2)); }
  for (const o of SITES) if (o.name && !['wall', 'bridge'].includes(o.kind) && !/guesthouse|bell|lamp/.test(o.name)) { const p = here(...o.at); if (project(h.line, ...p).d < 700) labels.push(L3(p, o.name, -40, o.h + 2)); }
  const v = [], sk = h.sketch || {}, markers = [];
  for (const t of h.targets || []) if (t.bold && !t.pin) markers.push(t.at);
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin, 3.2, 1.8), look: look(pin, -2) });
    const fw = h.teePts[FRONT]; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin, 3.2, 1.8), look: look(pin, -2) });
  } else {
    const aim = firstT.at;
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, aim, 3.2, 1.8), look: look(aim, sk.teeDrop ?? -2) });
    const next = (h.targets || []).find(t => t !== firstT && !t.bold && !t.pin), to = next && h.par === 5 ? next.at : pin;
    v.push({ id: 'land', title: 'From the landing area', fov: 50, pos: eye(firstT.at, to, 3.2, 1.8), look: look(to, 2) });
  }
  const sg = at(h.line, h.len - (sk.greenBack ?? 60), sk.greenOff ?? 0), past = at(h.line, h.len + 25);
  v.push({ id: 'green', title: 'Short of the green', fov: 50, pos: eye(sg, pin, 0, 6), look: [past[0], g(...pin) - 2, past[1]] });
  for (const x of v) { x.labels = labels; x.markers = markers; }
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
