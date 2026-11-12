// node tools/halcyon/sketch.mjs [holes] : the plan book's sketch views. Plain shapes from the plan data through a
// real camera, drawn as ink and washes in SVG, hazed with distance, drawn light so the book prints (space is a pale
// wash with grey stars, not black). The ring is drawn as the true cylinder seen from each hole's frame: a point in
// ring space (a, s, h) sits (R - h) sin φ north of the hole's low line and R - (R - h) cos φ up, φ = (s - s_tee) / R,
// so near the hole it is the hole's own ground (the curve rising from its back tee) and far off the floor climbs
// up the frame. Near the line the floor is the hole's own ground (scene.mjs), beyond it the other holes and the
// floor (worldAt). Drawn: floor cells by surface, the rim walls' glass with mullions, Earth and stars behind the
// glass and under the floor windows, trees, villas (lit on the night side), the spoke's A-frame and shaft, walls,
// the clubhouse, the aqueduct, the falls. out/views/h<n>_<tee|land|green>.svg (+ .png). Painter's order by distance.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES, BACK, FRONT } from './holes.mjs';
import { BUILT, worldAt, LOC, WOR, STEE, waterW, shapesAt } from './scene.mjs';
import { R as RR, HALF, WALL, H, nativeAt, inWindow, TERMINATOR, SPOKE, AQUEDUCT, WINDOWS, CLUBHOUSE, CANAL } from './world.mjs';
import { at, clamp, rnd, project, distLine, headingAt } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [240, 236, 228], MIST = 2600, SPACE = [236, 240, 246];
const SC = { park: [204, 220, 168], rough: [186, 208, 140], fairway: [164, 204, 118], fringe: [150, 198, 106], green: [156, 214, 112], tee: [176, 210, 140],
  sand: [236, 226, 196], water: [158, 196, 218], window: null, wood: [120, 158, 104], garden: [190, 214, 160], plaza: [226, 222, 212], stone: [214, 206, 190], void: [26, 26, 30] };
const TREEC = { lime: [108, 150, 92], plane: [96, 140, 86], yew: [70, 104, 76], poplar: [112, 150, 86], willow: [140, 172, 108] };
const mix = (c, f, to = FOG) => c.map((v, i) => Math.round(v + (to[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.82, 1 - Math.exp(-Math.max(0, d - 80) / MIST));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
const night = s => s < TERMINATOR ? 1 - clamp((s - TERMINATOR + 60) / 60, 0, 1) : 0;

// scenery scattered over the floor in ring space (generated once): tree clumps in the woods and the parkland,
// villas on the terraces and along the floor, all kept 35 m off every line of play
const WLINES = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
const offLines = (X, Z, d) => WLINES.every(L => distLine(L, X, Z) > d);
const SCATTER = (() => {
  const R = rnd(4242), trees = [], villas = [];
  for (let i = 0; i < 2600; i++) {
    const a = -440 + R() * 880, s = -1400 + R() * 4600, X = a, Z = -s;
    const nat = nativeAt(X, Z); if (!offLines(X, Z, nat === 'wood' ? 70 : 38) || waterW(X, Z) || inWindow(a, s)) continue;
    if (nat === 'wood' || (nat === 'park' && R() < 0.12)) { const n = nat === 'wood' ? 5 : 2; for (let j = 0; j < n; j++) { const x = X + (R() - 0.5) * 30, z = Z + (R() - 0.5) * 30; trees.push({ X: x, Z: z, h: 16 + R() * 10, r: 5 + R() * 4, kind: R() < 0.7 ? 'plane' : 'lime' }); } }
    else if (nat === 'garden' && R() < 0.35) villas.push({ X, Z, w: 22 + R() * 14, l: 14 + R() * 6, h: 7 + R() * 5, rot: (R() < 0.5 ? 0 : Math.PI / 2) + (R() - 0.5) * 0.2 });
  }
  return { trees, villas };
})();

function camera(pos, look) {
  const f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]], fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const cam = { pos, f, r, u };
  cam.view = p => { const v = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]]; return [v[0] * r[0] + v[1] * r[1] + v[2] * r[2], v[0] * u[0] + v[1] * u[1] + v[2] * u[2], v[0] * f[0] + v[1] * f[1] + v[2] * f[2]]; };
  cam.dir = v => [v[0] * r[0] + v[1] * r[1] + v[2] * r[2], v[0] * u[0] + v[1] * u[1] + v[2] * u[2], v[0] * f[0] + v[1] * f[1] + v[2] * f[2]];
  cam.scr = v => [VW / 2 + v[0] / v[2] * FPX, VH / 2 - v[1] / v[2] * FPX];
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
const fmt = P => P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

function renderView(hi, view) {
  HFOV = (view.fov || 60) * Math.PI / 180; FPX = (VW / 2) / Math.tan(HFOV / 2);
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look), toHere = LOC[hi], s0 = STEE[hi];
  // ring space (a, s, height above the floor) → this hole's frame
  const ringP = (a, s, hh) => { const ph = (s - s0) / RR, r = RR - hh, N = r * Math.sin(ph), Y = RR - r * Math.cos(ph); const [x, z] = toHere(a, -(s0 + N)); return [x, Y - B.base, z]; };
  const polys = [];
  const add = (pts3, fill, o = {}) => {
    let v = pts3.map(p => cam.view(p)); v = clipNear(v); if (v.length < 3) return;
    const P = v.map(q => cam.scr(q)); const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    if (Math.max(...xs) < -50 || Math.min(...xs) > VW + 50 || Math.max(...ys) < -50 || Math.min(...ys) > VH + 50) return;
    const d = o.d ?? v.reduce((a, q) => a + Math.hypot(q[0], q[1], q[2]), 0) / v.length;
    polys.push({ d, svg: `<polygon points="${fmt(P)}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 0.6}"` : ` stroke="${fill}" stroke-width="0.7"`}${o.op ? ` fill-opacity="${o.op}"` : ''}/>` });
  };
  // where the camera is in ring space
  const [cx, , cz] = view.pos, camW = WOR[hi](cx, cz), camA = camW[0], camS = -camW[1];

  // ---- the floor: a grid in ring space, fine near the camera, coarse far off
  const sRows = [], aCols = [];
  { const half = []; let d = 0, st = 4; while (d < 4200) { half.push(d); d += st; st = Math.min(st * 1.07, 140); }
    for (let i = half.length - 1; i > 0; i--) sRows.push(camS - half[i]); for (const v of half) sRows.push(camS + v); }
  { const half = []; let d = 0, st = 4; while (d < 940) { half.push(d); d += st; st = Math.min(st * 1.1, 60); }
    const set = new Set(); for (const v of half) { set.add(clamp(camA - v, -HALF, HALF)); set.add(clamp(camA + v, -HALF, HALF)); } aCols.push(...[...set].sort((p, q) => p - q)); }
  const nodeY = new Map(), key = (i, j) => i * 10000 + j;
  const nodeAt = (i, j) => {
    const k = key(i, j); if (nodeY.has(k)) return nodeY.get(k);
    const a = aCols[j], s = sRows[i], X = a, Z = -s, [lx, lz] = toHere(X, Z);
    let p;
    if (distLine(h.line, lx, lz) < 230 && Math.abs(s - s0) < 900) { const g = B.ground(lx, lz); p = [lx, g, lz]; }
    else { const w = Math.hypot(s - camS, a - camA) < 1600 ? worldAt(X, Z).y : H(X, Z) + shapesAt(X, Z); p = ringP(a, s, w); }
    nodeY.set(k, p); return p;
  };
  for (let i = 0; i + 1 < sRows.length; i++) for (let j = 0; j + 1 < aCols.length; j++) {
    const a = (aCols[j] + aCols[j + 1]) / 2, s = (sRows[i] + sRows[i + 1]) / 2, X = a, Z = -s, [lx, lz] = toHere(X, Z);
    const near = distLine(h.line, lx, lz) < 230 && Math.abs(s - s0) < 900;
    let sf = near ? B.surface(lx, lz) : (Math.hypot(s - camS, a - camA) < 1400 ? worldAt(X, Z).s : (waterW(X, Z) ? 'water' : inWindow(a, s) ? 'window' : nativeAt(X, Z)));
    const pts = [nodeAt(i, j), nodeAt(i, j + 1), nodeAt(i + 1, j + 1), nodeAt(i + 1, j)];
    if (sf === 'window') {   // a hole in the floor: glass a few metres down, the stars under it
      const gl = pts.map(p => [p[0], p[1] - 3.5, p[2]]), v = cam.view(gl[0]), d = Math.hypot(...v);
      add(gl, hex(mix([214, 224, 240], fogAt(d) * 0.6)), { d: d + 4 });
      const k = hash(a, s); if (k < 0.45) { const q = cam.view(gl[0]); if (q[2] > 1) { const p = cam.scr(q); polys.push({ d: d + 3.9, svg: `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.8 + 1.4 * k).toFixed(1)}" fill="#6f7a8c"/>` }); } }
      continue;
    }
    const v = cam.view(pts[0]), d = Math.hypot(...v);
    let c = SC[sf] || SC.park;
    if (sf === 'park' || sf === 'rough') c = mix(c, 0.3 * hash(Math.round(a / 30), Math.round(s / 30)), [190, 214, 150]);
    if (sf === 'fairway' && Math.round(s / 9) % 2 === 0 && near) c = mix(c, 0.5, [176, 214, 128]);   // mowing stripes
    const n = night(s); if (n) c = mix(c, 0.55 * n, [96, 104, 132]);
    add(pts, hex(mix(c, fogAt(d))));
  }
  // window frames: white stone coping round each floor window
  for (const w of WINDOWS) { const n = 72, ring = []; for (let k = 0; k < n; k++) { const t = k / n * 2 * Math.PI, c = Math.cos(w.rot), sn = Math.sin(w.rot), pw = 2 / w.p;
      const u = Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** pw, v = Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** pw; ring.push([w.a + (u * w.ra) * c - (v * w.rs) * sn, w.s + (u * w.ra) * sn + (v * w.rs) * c, u, v]); }
    for (let k = 0; k < n; k++) { const [a0, s0_, u0, v0] = ring[k], [a1, s1, u1, v1] = ring[(k + 1) % n];
      const g0 = worldAt(a0, -s0_).y, g1 = worldAt(a1, -s1).y, oa = a0 + u0 * 2.2, os = s0_ + v0 * 2.2, ob = a1 + u1 * 2.2, os1 = s1 + v1 * 2.2;
      const q = [ringP(a0, s0_, g0 + 0.3), ringP(a1, s1, g1 + 0.3), ringP(ob, os1, g1 + 0.3), ringP(oa, os, g0 + 0.3)], dv = Math.hypot(...cam.view(q[0]));
      add(q, hex(mix([246, 246, 242], fogAt(dv) * 0.8)), { stroke: '#8a8f99', sw: 0.5, d: dv - 0.5 });
      const sk = [ringP(a0, s0_, g0 + 0.2), ringP(a1, s1, g1 + 0.2), ringP(a1, s1, g1 - 3.5), ringP(a0, s0_, g0 - 3.5)];   // the frame's inner face, down into the glass
      add(sk, hex(mix([214, 218, 226], fogAt(dv) * 0.8)), { stroke: '#9aa0aa', sw: 0.4, d: dv + 1 });
    }
    // mullions across the glass every 12 m
    const c = Math.cos(w.rot), sn = Math.sin(w.rot);
    for (let u = -w.ra + 12; u < w.ra; u += 12) { const p0 = [w.a + u * c - (-w.rs * 0.92) * sn, w.s + u * sn + (-w.rs * 0.92) * c], p1 = [w.a + u * c - (w.rs * 0.92) * sn, w.s + u * sn + (w.rs * 0.92) * c], g = worldAt(w.a, -w.s).y - 0.3;
      const q = [ringP(p0[0] - 0.4 * c, p0[1] - 0.4 * sn, g), ringP(p0[0] + 0.4 * c, p0[1] + 0.4 * sn, g), ringP(p1[0] + 0.4 * c, p1[1] + 0.4 * sn, g), ringP(p1[0] - 0.4 * c, p1[1] - 0.4 * sn, g)];
      add(q, '#c4cad4', { d: 1e7 }); }
  }
  // the rim walls: glass from the terraces' tops up, ribs every 120 m, horizontal mullions; a pale base
  for (const side of [-1, 1]) {
    const a = side * HALF;
    for (let i = 0; i + 2 < sRows.length; i += 2) {
      const sA = sRows[i], sB = sRows[i + 2], gA = H(a - side * 2, -sA), gB = H(a - side * 2, -sB);
      const base = [ringP(a, sA, gA), ringP(a, sB, gB), ringP(a, sB, gB + 10), ringP(a, sA, gA + 10)], dv = Math.hypot(...cam.view(base[0]));
      add(base, hex(mix([232, 232, 226], fogAt(dv))));
      const g = [ringP(a, sA, gA + 10), ringP(a, sB, gB + 10), ringP(a, sB, WALL), ringP(a, sA, WALL)];
      add(g, hex(mix([196, 214, 232], fogAt(dv) * 0.6)), { op: 0.42 });
    }
    for (let s = Math.ceil((camS - 4000) / 120) * 120; s < camS + 4200; s += 120) {
      const g = H(a - side * 2, -s), q = [ringP(a, s - 2.5, g), ringP(a, s + 2.5, g), ringP(a, s + 2.5, WALL), ringP(a, s - 2.5, WALL)], dv = Math.hypot(...cam.view(ringP(a, s, 60)));
      add(q, hex(mix([250, 250, 252], fogAt(dv) * 0.5)), { stroke: '#a8aeb8', sw: 0.5 });
    }
    for (const hh of [70, 140, 220]) for (let i = 0; i + 3 < sRows.length; i += 3) {
      const q = [ringP(a, sRows[i], hh - 1.2), ringP(a, sRows[i + 3], hh - 1.2), ringP(a, sRows[i + 3], hh + 1.2), ringP(a, sRows[i], hh + 1.2)], dv = Math.hypot(...cam.view(q[0]));
      add(q, hex(mix([244, 246, 250], fogAt(dv) * 0.5)), { d: dv - 1 });
    }
  }
  // the spoke: two square legs leaning in from their feet to the apex 260 m up, then one shaft toward the hub
  const leg = (a0, a1, h0, h1, w0, w1) => { const n = 16;
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, A0 = a0 + (a1 - a0) * t0, A1 = a0 + (a1 - a0) * t1, H0 = h0 + (h1 - h0) * t0, H1 = h0 + (h1 - h0) * t1, W0 = w0 + (w1 - w0) * t0, W1 = w0 + (w1 - w0) * t1;
      for (const [du, ds, sh] of [[-1, 0, 0.92], [1, 0, 0.8], [0, -1, 1], [0, 1, 0.86]]) {
        const P = du ? [[A0 + du * W0 / 2, SPOKE.s - W0 / 2, H0], [A0 + du * W0 / 2, SPOKE.s + W0 / 2, H0], [A1 + du * W1 / 2, SPOKE.s + W1 / 2, H1], [A1 + du * W1 / 2, SPOKE.s - W1 / 2, H1]]
          : [[A0 - W0 / 2, SPOKE.s + ds * W0 / 2, H0], [A0 + W0 / 2, SPOKE.s + ds * W0 / 2, H0], [A1 + W1 / 2, SPOKE.s + ds * W1 / 2, H1], [A1 - W1 / 2, SPOKE.s + ds * W1 / 2, H1]];
        const q = P.map(([a, s, hh]) => ringP(a, s, hh)), dv = Math.hypot(...cam.view(ringP((A0 + A1) / 2, SPOKE.s, (H0 + H1) / 2)));
        add(q, hex(mix([234 * sh, 236 * sh, 240 * sh], fogAt(dv) * 0.7)), { stroke: '#8f96a2', sw: 0.6 }); } } };
  leg(SPOKE.legs[0][0], SPOKE.a - 12, 0, SPOKE.apex, SPOKE.foot, 22); leg(SPOKE.legs[1][0], SPOKE.a + 12, 0, SPOKE.apex, SPOKE.foot, 22); leg(SPOKE.a, SPOKE.a, SPOKE.apex - 20, RR * 0.9, 40, 26);
  // the aqueduct: arches on piers across the east terraces
  { const [a0, s0a] = AQUEDUCT.from, [a1, s1a] = AQUEDUCT.to, n = 9;
    for (let k = 0; k <= n; k++) { const t = k / n, a = a0 + (a1 - a0) * t, s = s0a + (s1a - s0a) * t, g = H(a, -s); const q = [ringP(a - 2, s - 2, g), ringP(a + 2, s + 2, g), ringP(a + 2, s + 2, g + AQUEDUCT.h), ringP(a - 2, s - 2, g + AQUEDUCT.h)], dv = Math.hypot(...cam.view(q[0])); add(q, hex(mix([222, 214, 200], fogAt(dv))), { stroke: '#9a9080', sw: 0.5 }); }
    const g0 = H(a0, -s0a), g1 = H(a1, -s1a), q = [ringP(a0, s0a - 4, g0 + AQUEDUCT.h - 3), ringP(a1, s1a - 4, g1 + AQUEDUCT.h - 3), ringP(a1, s1a - 4, g1 + AQUEDUCT.h + 1), ringP(a0, s0a - 4, g0 + AQUEDUCT.h + 1)];
    add(q, hex(mix([226, 218, 204], fogAt(Math.hypot(...cam.view(q[0]))))), { stroke: '#9a9080', sw: 0.5 }); }

  // ---- things on the ground: this hole's objects in its frame, the scenery in ring space
  const box = (P0, w, l, hh, rot, y0, col, lit) => {   // P0 in the hole frame [x, z]
    const c = Math.cos(rot), s_ = Math.sin(rot), corners = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([u, v]) => [P0[0] + u * c - v * s_, P0[1] + u * s_ + v * c]);
    const dv = Math.hypot(...cam.view([P0[0], y0, P0[1]]));
    for (let k = 0; k < 4; k++) { const A = corners[k], Bc = corners[(k + 1) % 4], q = [[A[0], y0, A[1]], [Bc[0], y0, Bc[1]], [Bc[0], y0 + hh, Bc[1]], [A[0], y0 + hh, A[1]]];
      const shade = 0.82 + 0.16 * ((k % 2) ? 1 : 0); add(q, hex(mix(col.map(v => v * shade), fogAt(dv))), { stroke: '#7c838e', sw: 0.5, d: dv + 0.5 }); }
    add(corners.map(p => [p[0], y0 + hh, p[1]]), hex(mix(col.map(v => v * 0.9), fogAt(dv))), { stroke: '#7c838e', sw: 0.5, d: dv - 0.5 });
    if (lit) { const mid = [P0[0], y0 + hh * 0.5, P0[1]], v = cam.view(mid); if (v[2] > 1) { const p = cam.scr(v), k = Math.max(1.2, 300 / v[2]); polys.push({ d: dv - 1, svg: `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${k.toFixed(1)}" fill="#f3c65a"/>` }); } }
  };
  const tree = (x, y0, z, hh, r, kind) => {
    const v0 = cam.view([x, y0, z]); if (v0[2] < 2) return; const d = Math.hypot(...v0);
    const top = cam.scr(cam.view([x, y0 + hh, z])), foot = cam.scr(v0), crown = cam.scr(cam.view([x, y0 + hh - r * (kind === 'poplar' ? 2.2 : 0.9), z]));
    const rad = Math.max(0.7, r * FPX / v0[2]), col = hex(mix(TREEC[kind] || TREEC.plane, fogAt(d))), trunk = hex(mix([110, 96, 82], fogAt(d)));
    const ry = kind === 'poplar' ? rad * 2.6 : kind === 'yew' ? rad * 1.3 : rad * 0.95;
    polys.push({ d, svg: `<line x1="${foot[0].toFixed(1)}" y1="${foot[1].toFixed(1)}" x2="${crown[0].toFixed(1)}" y2="${crown[1].toFixed(1)}" stroke="${trunk}" stroke-width="${Math.max(0.6, rad * 0.16).toFixed(1)}"/><ellipse cx="${crown[0].toFixed(1)}" cy="${(crown[1] - ry * 0.3).toFixed(1)}" rx="${rad.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${col}" stroke="${hex(mix([60, 90, 60], fogAt(d)))}" stroke-width="0.5"/>` });
  };
  for (const o of B.objs) {
    if (TREEC[o.kind]) tree(o.x, o.base, o.z, o.h, o.r, o.kind);
    else if (o.kind === 'villa' || o.kind === 'clubhouse') { const [, sW] = WOR[hi](o.x, o.z); box([o.x, o.z], o.w, o.l, o.h, o.rot, o.base, [250, 250, 246], night(-sW) > 0.3); if (o.kind === 'clubhouse') box([o.x, o.z], o.w * 0.6, o.l * 0.6, o.h + 8, o.rot, o.base, [252, 252, 250], false); }
    else if (o.kind === 'wall') { const dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1], l = Math.hypot(dx, dz); box([(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2], o.t, l, o.h, Math.atan2(dx, -dz), Math.min(o.a[2], o.b[2]), [244, 242, 236]); }
    else if (o.kind === 'bridge') { const ya = B.ground(...o.a) + 1.2, yb = B.ground(...o.b) + 1.2, n = [o.b[1] - o.a[1], -(o.b[0] - o.a[0])], l = Math.hypot(...n), u = [n[0] / l * 1.6, n[1] / l * 1.6];
      add([[o.a[0] - u[0], ya, o.a[1] - u[1]], [o.a[0] + u[0], ya, o.a[1] + u[1]], [o.b[0] + u[0], yb, o.b[1] + u[1]], [o.b[0] - u[0], yb, o.b[1] - u[1]]], '#e8e4dc', { stroke: '#7c838e', sw: 0.6 }); }
    else if (o.kind === 'falls') { const y0 = o.base, q = [[o.x - o.w / 2, y0, o.z], [o.x + o.w / 2, y0, o.z], [o.x + o.w / 2, y0 + o.h, o.z], [o.x - o.w / 2, y0 + o.h, o.z]]; add(q, '#e2eef8', { stroke: '#8fb0cc', sw: 0.6 }); }
  }
  // scenery trees and villas from ring space (near ones only as shapes; far ones as dots)
  for (const t of SCATTER.trees) { const a = t.X, s = -t.Z; if (Math.abs(s - camS) > 2600) continue; const p = ringP(a, s, H(t.X, t.Z)); const v = cam.view(p); if (v[2] < 5 || Math.abs(v[0] / v[2]) > 1.3) continue; tree(p[0], p[1], p[2], t.h, t.r, t.kind); }
  for (const vl of SCATTER.villas) { const a = vl.X, s = -vl.Z; if (Math.abs(s - camS) > 3200) continue; const p = ringP(a, s, H(vl.X, vl.Z)); const v = cam.view(p); if (v[2] < 5 || Math.abs(v[0] / v[2]) > 1.4) continue; box([p[0], p[2]], vl.w, vl.l, vl.h, vl.rot - HOLES[hi].place.heading * Math.PI / 180, p[1] - 0.2, [250, 250, 246], night(s) > 0.3); }
  if (hi !== 8) { const [x, z] = toHere(CLUBHOUSE.a, -CLUBHOUSE.s), p = ringP(CLUBHOUSE.a, CLUBHOUSE.s, H(CLUBHOUSE.a, -CLUBHOUSE.s)); box([p[0], p[2]], CLUBHOUSE.w, CLUBHOUSE.d, CLUBHOUSE.h, -HOLES[hi].place.heading * Math.PI / 180 + 0.1, p[1], [252, 252, 250]); box([p[0], p[2]], CLUBHOUSE.w * 0.6, CLUBHOUSE.d * 0.6, CLUBHOUSE.h + 8, -HOLES[hi].place.heading * Math.PI / 180 + 0.1, p[1], [252, 252, 250]); }
  // the flag
  { const g = B.ground(...h.pin), b = cam.view([h.pin[0], g, h.pin[1]]), t = cam.view([h.pin[0], g + 2.6, h.pin[1]]);
    if (b[2] > 1) { const pb = cam.scr(b), pt = cam.scr(t), k = Math.max(4, (pb[1] - pt[1]) * 0.45); polys.push({ d: Math.hypot(...b) - 2, svg: `<line x1="${pb[0].toFixed(1)}" y1="${pb[1].toFixed(1)}" x2="${pt[0].toFixed(1)}" y2="${pt[1].toFixed(1)}" stroke="#333" stroke-width="1.4"/><path d="M${pt[0].toFixed(1)},${pt[1].toFixed(1)} l${(k * 1.3).toFixed(1)},${(k * 0.45).toFixed(1)} l${(-k * 1.3).toFixed(1)},${(k * 0.45).toFixed(1)}z" fill="#d23b2a"/>` }); } }

  polys.sort((p, q) => q.d - p.d);
  // ---- the background: space as a pale wash, stars as grey dots, Earth placed where this view can see it
  // through the glass (a snapshot: the station turns, and Earth wheels past the rims and windows once a turn)
  let bg = '';
  const sr = rnd(17 + hi);
  for (let k = 0; k < 1800; k++) { const zz = sr() * 2 - 1, t = sr() * Math.PI * 2, q = Math.sqrt(1 - zz * zz), v = cam.dir([q * Math.cos(t), zz, q * Math.sin(t)]); if (v[2] < 0.05) continue; const p = cam.scr(v);
    if (p[0] > 0 && p[0] < VW && p[1] > 0 && p[1] < VH) bg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.5 + sr() * 1.1).toFixed(2)}" fill="#8d96a6" fill-opacity="${(0.4 + sr() * 0.5).toFixed(2)}"/>`; }
  { const e = view.earth || [0.45, -0.42], f = cam.f, r = cam.r, d = [f[0] + r[0] * e[0], f[1] + e[1], f[2] + r[2] * e[0]], v = cam.dir(d);
    if (v[2] > 0.05) { const c = cam.scr(v), rad = FPX * Math.tan(30 * Math.PI / 180), er = rnd(5);
      bg += `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(rad + 8).toFixed(1)}" fill="#dce9f6"/><circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${rad.toFixed(1)}" fill="#c9ddf0" stroke="#8fa9c4" stroke-width="1.2"/>`;
      for (let k = 0; k < 24; k++) { const an = er() * 6.283, rr = er() * rad * 0.85; bg += `<ellipse cx="${(c[0] + Math.cos(an) * rr).toFixed(1)}" cy="${(c[1] + Math.sin(an) * rr).toFixed(1)}" rx="${(rad * (0.06 + er() * 0.14)).toFixed(1)}" ry="${(rad * (0.025 + er() * 0.05)).toFixed(1)}" fill="#ffffff" fill-opacity="0.85"/>`; }
      for (let k = 0; k < 7; k++) { const an = er() * 6.283, rr = er() * rad * 0.7; bg += `<ellipse cx="${(c[0] + Math.cos(an) * rr).toFixed(1)}" cy="${(c[1] + Math.sin(an) * rr).toFixed(1)}" rx="${(rad * (0.1 + er() * 0.16)).toFixed(1)}" ry="${(rad * (0.06 + er() * 0.08)).toFixed(1)}" fill="#d9e4c8" fill-opacity="0.8"/>`; } } }
  // labels: leader lines from the thing up to a tag
  let lsvg = '';
  const placed = [];
  for (const L of view.labels || []) {
    const v = cam.view(L.p); if (v[2] < 8) continue; const p = cam.scr(v); if (p[0] < 40 || p[0] > VW - 40 || p[1] < 30 || p[1] > VH - 20) continue;
    let ty = p[1] + L.dy; for (const q of placed) if (Math.abs(q[0] - p[0]) < 160 && Math.abs(q[1] - ty) < 26) ty = q[1] - 28;
    ty = Math.max(24, ty); placed.push([p[0], ty]);
    const w = L.text.length * 9.4 + 14;
    lsvg += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${(ty + 8).toFixed(1)}" stroke="#333" stroke-width="1"/><rect x="${(p[0] - w / 2).toFixed(1)}" y="${(ty - 12).toFixed(1)}" width="${w.toFixed(1)}" height="22" rx="4" fill="white" fill-opacity="0.9" stroke="#555" stroke-width="0.6"/><text x="${p[0].toFixed(1)}" y="${(ty + 4).toFixed(1)}" font-family="DejaVu Sans, Helvetica, sans-serif" font-size="16" text-anchor="middle" fill="#222">${L.text}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}"><rect width="${VW}" height="${VH}" fill="${hex(SPACE)}"/>` + bg + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee, from the landing area (par 3: the forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], B = BUILT[hi], g = (x, z) => B.ground(x, z);
  const eye = (p, toward, back = 4, up = 5) => {
    const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const x = p[0] - ux * back, z = p[1] - uz * back, y = Math.max(g(x, z), g(p[0], p[1])) + up;
    return [x, y, z];
  };
  const look = (p, toward, drop = 0) => [toward[0], g(...toward) + 1 - drop, toward[1]];
  const pin = h.pin, tee = h.teePts[BACK];
  const firstT = (h.targets || []).filter(t => !t.bold)[0] || { at: pin };
  const labelSet = [], here = LOC[hi];
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  for (const t of h.targets || []) if (t.name !== 'At the green') labelSet.push(L3(t.at, t.name, -46));
  labelSet.push(L3(pin, 'green', -60));
  for (const f of h.forms || []) if (f.label) labelSet.push(L3(f.at, f.label, -36));
  for (const f of h.feet || []) if (f.label) labelSet.push(L3(f.at, f.label, -120, 30));
  for (const v of h.villas || []) if (v.label) labelSet.push(L3(v.at, v.label, -50, v.h));
  if (h.bridge) labelSet.push(L3(h.bridge.a, h.bridge.label, -40, 2));
  for (const [wp, t, up] of [[[-179, -176], 'the Long Window', 0.5], [[242.4, -1767.7], 'the Great Window', 0.5], [[-438, -650], 'the rim glass', 2], [[-420, -1000], 'the long lake', 1], [[240, -1545], 'the lock', 2], [[370, -1625], 'the aqueduct', 18], [[-186, -1090], 'the falls', 10]]) {
    const p = here(...wp), pr = project(h.line, ...p); if (pr.d < 320 && pr.s > -80 && pr.s < h.len + 160) labelSet.push(L3(p, t, -40, up));
  }
  const v = [];
  if (h.par === 3) {
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, pin), look: look(tee, pin, 6) });
    const fw = h.teePts[FRONT]; v.push({ id: 'land', title: 'From the forward tee', fov: 50, pos: eye(fw, pin), look: look(fw, pin, 5) });
  } else {
    const aim = firstT.at;
    v.push({ id: 'tee', title: 'From the back tee', pos: eye(tee, aim), look: look(tee, aim, 6) });
    const next = (h.targets || []).find(t => t !== firstT && !t.bold);
    const to = next && h.par === 5 ? next.at : pin;
    v.push({ id: 'land', title: 'From the landing area', fov: 50, pos: eye(aim, to), look: look(aim, to, 6) });
  }
  const sg2 = at(h.line, h.len - 55), past = at(h.line, h.len + 25);
  v.push({ id: 'green', title: 'Short of the green', fov: 50, pos: eye(sg2, pin, 0, 9), look: [past[0], g(...h.pin) - 2, past[1]] });
  for (const x of v) x.labels = labelSet;
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
