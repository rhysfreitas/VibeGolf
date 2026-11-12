// node tools/lostvalley/sketch.mjs [holes] : the plan book's sketch views. Simple 3D shapes from the plan data
// (ground cells; trees by kind: cycads, tree ferns, monkey-puzzles, broadleaves, swamp cypresses; boulders; the
// spire and its pterosaur; the Strangler and its root arch; the camp; the rope bridge; the falls; the skeleton in
// the Bone Bluff; the bones in the tar pit; the animals as true-shape silhouettes), projected through a real
// camera and drawn as ink and washes in SVG, hazed with distance. Past 1.65 km the walls and the table mountains
// beyond are drawn as silhouettes from the same height function, under a pale golden sky after rain, drawn light
// so the book prints. out/views/h<n>_<tee|land|green>.svg (+ .png). Painter's order by horizontal distance.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { HOLES, BACK, FRONT } from './holes.mjs';
import { BUILT, toWorld, toLocal, worldAt, WL } from './scene.mjs';
import { V, waterAt, inValley, wallD, BLUFF, bluffD, TAR, BRIDGE, POOL, SWAMP, BACKCH, swampD, riverAt, VALLEY, topY, polar } from './world.mjs';
import { CAMP, FALLS, LIFE } from './life.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, clamp, lengthOf, rnd, project, distLine, smooth } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const VW = 1600, VH = 900;
let HFOV = 60 * Math.PI / 180, FPX = (VW / 2) / Math.tan(HFOV / 2);
const FOG = [238, 234, 222], MIST = 2100;
const SC = { meadow: [196, 210, 150], rough: [184, 206, 138], fairway: [164, 204, 118], fringe: [150, 198, 106], green: [156, 214, 112], tee: [176, 210, 140],
  sand: [236, 226, 196], waste: [218, 206, 176], bar: [222, 212, 186], water: [150, 192, 214], tar: [84, 76, 70], cliff: [190, 160, 136], jungle: [92, 136, 84], mud: [150, 140, 110],
  gravel: [204, 196, 176], rubble: [176, 166, 150], camp: [200, 184, 150], void: [26, 26, 30] };
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);

const mix = (c, f) => c.map((v, i) => Math.round(v + (FOG[i] - v) * f));
const hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const fogAt = d => Math.min(0.8, 1 - Math.exp(-Math.max(0, d - 60) / MIST));
const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// the sun: golden afternoon, low in the west-south-west (world direction toward it)
const SUN = (() => { const az = 250 * Math.PI / 180, el = 24 * Math.PI / 180; return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]; })();

// scattered scenery trees across the floor, off every line of play (35 m), out of the water, and stands on the
// plain; plus the jungle canopy drawn on the walls' talus in the views. World space, generated once
const SCATTER = (() => {
  const R = rnd(9001), out = [], kinds = [['conifer', 0.3], ['broad', 0.35], ['fern', 0.2], ['cycad', 0.15]];
  const size = { cycad: [3, 4.5, 1.8, 2.6], fern: [6, 10, 2.2, 3.4], conifer: [24, 38, 4.5, 7], broad: [14, 24, 6, 10] };
  // the 1st tee's view across the valley to the plain herd stays open
  const T1 = [-80, 5], HERD = [-150, -1100], hb = Math.atan2(HERD[0] - T1[0], -(HERD[1] - T1[1]));
  const sight = (X, Z) => { const d = Math.hypot(X - T1[0], Z - T1[1]), b = Math.atan2(X - T1[0], -(Z - T1[1])); return d > 150 && d < 1250 && Math.abs(b - hb) < 0.16; };
  const ok = (X, Z, clear) => !sight(X, Z) && inValley(X, Z) && wallD(X, Z) < -10 && !waterAt(X, Z) && swampD(X, Z) > 10 && bluffD(X, Z) > 1.05 && Math.min(...WL.map(L => distLine(L, X, Z))) > clear && Math.hypot(X - 60, Z - 70) > 150;
  // stands: clumps of 6-20 trees round a centre
  for (let i = 0; i < 150; i++) {
    const cx = -800 + R() * 1950, cz = -1750 + R() * 1850; if (!ok(cx, cz, 70)) continue;
    const n = 6 + Math.floor(R() * 14), r = 18 + R() * 30, k0 = R();
    for (let j = 0; j < n; j++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * r, X = cx + Math.cos(a) * d, Z = cz + Math.sin(a) * d; if (!ok(X, Z, 35)) continue;
      let q = (k0 + R() * 0.5) % 1, kind = 'broad'; for (const [k, f] of kinds) { if (q < f) { kind = k; break; } q -= f; }
      const [h0, h1, r0, r1] = size[kind]; out.push({ kind, X, Z, h: h0 + R() * (h1 - h0), r: r0 + R() * (r1 - r0) });
    }
  }
  // single trees and clumps of tree ferns along the river's banks and the swamp's edge
  for (let i = 0; i < 500; i++) {
    const X = -800 + R() * 1950, Z = -1750 + R() * 1850; if (!ok(X, Z, 35)) continue;
    const rp = riverAt(X, Z), near = rp.d - rp.hw < 40 || swampD(X, Z) < 40;
    if (!near && R() < 0.6) continue;
    const kind = near ? (R() < 0.6 ? 'fern' : 'broad') : R() < 0.5 ? 'conifer' : 'broad', [h0, h1, r0, r1] = size[kind];
    out.push({ kind, X, Z, h: h0 + R() * (h1 - h0), r: r0 + R() * (r1 - r0) });
  }
  return out;
})();

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

// creature profiles: [u along the body (-0.5 tail to +0.5 head, share of its length), v up (metres for the
// reference length)], drawn in the vertical plane through the body's axis, plus legs [u, top v, width]
const PROFILE = {
  longneck: { ref: 25, body: [[-0.5, 3.4], [-0.36, 4.9], [-0.2, 6.6], [-0.1, 7.6], [0.02, 8.0], [0.1, 8.3], [0.18, 10.6], [0.25, 13.2], [0.3, 14.6], [0.355, 14.5], [0.36, 14.0], [0.32, 13.7], [0.27, 12.6], [0.2, 10.0], [0.13, 7.4], [0.07, 5.2], [-0.04, 4.4], [-0.16, 4.6], [-0.28, 4.2], [-0.4, 3.6], [-0.5, 3.2]],
    graze: [[-0.5, 3.4], [-0.36, 4.9], [-0.2, 6.6], [-0.1, 7.6], [0.02, 8.0], [0.12, 7.6], [0.24, 6.4], [0.34, 4.8], [0.42, 3.2], [0.47, 2.6], [0.47, 2.0], [0.42, 2.2], [0.33, 3.8], [0.22, 5.2], [0.12, 5.6], [0.07, 5.0], [-0.04, 4.4], [-0.16, 4.6], [-0.28, 4.2], [-0.4, 3.6], [-0.5, 3.2]],
    legs: [[0.05, 5.4, 1.3], [-0.15, 5.0, 1.5]], color: [118, 110, 94] },
  small: { ref: 6.5, body: [[-0.5, 1.5], [-0.3, 1.9], [-0.1, 2.25], [0.08, 2.15], [0.22, 1.7], [0.34, 1.0], [0.44, 0.45], [0.5, 0.35], [0.47, 0.2], [0.38, 0.6], [0.26, 1.15], [0.12, 1.45], [-0.05, 1.45], [-0.22, 1.5], [-0.5, 1.3]],
    legs: [[-0.1, 1.5, 0.35], [0.14, 1.4, 0.22]], color: [128, 118, 96] },
  hunter: { ref: 12, body: [[-0.5, 3.0], [-0.3, 3.5], [-0.08, 4.0], [0.1, 3.9], [0.24, 3.8], [0.34, 4.3], [0.46, 4.4], [0.52, 4.0], [0.46, 3.6], [0.36, 3.5], [0.24, 3.0], [0.1, 2.6], [-0.06, 2.6], [-0.26, 2.9], [-0.5, 2.85]],
    legs: [[-0.06, 3.1, 0.9], [0.0, 3.0, 0.8]], color: [104, 78, 62] },
  perched: { ref: 5, body: [[-0.16, 0], [-0.22, 1.6], [-0.2, 2.6], [-0.08, 3.2], [0.02, 3.6], [0.06, 4.3], [-0.12, 4.9], [0.0, 5.1], [0.4, 4.5], [0.08, 4.3], [0.1, 3.4], [0.16, 2.4], [0.14, 1.2], [0.08, 0]], legs: [], color: [86, 82, 80] },
};

function renderView(hi, view) {
  HFOV = (view.fov || 60) * Math.PI / 180; FPX = (VW / 2) / Math.tan(HFOV / 2);
  const h = HOLES[hi], B = BUILT[hi], cam = camera(view.pos, view.look), W = WOR[hi], toHere = LOC[hi];
  const a0 = h.place.heading * Math.PI / 180, rxw = [Math.cos(a0), Math.sin(a0)], fxw = [Math.sin(a0), -Math.cos(a0)];
  const dirHere = (dx, dz) => [dx * rxw[0] + dz * rxw[1], -(dx * fxw[0] + dz * fxw[1])];   // a world direction in this frame
  const L = (() => { const [x, z] = dirHere(SUN[0], SUN[2]); return [x, SUN[1], z]; })();
  const polys = [];
  const proj = P => { const v = clipNear(P.map(cam.view)); if (v.length < 3) return null; const q = clipBox(v.map(cam.scr)); return q.length < 3 ? null : q; };
  const projLine = P => { const v = P.map(cam.view); if (v.some(q => q[2] < 0.6)) return null; return v.map(cam.scr); };
  const inView = (x, z, margin = 0.25) => { const v = cam.view([x, cam.pos[1], z]); return v[2] > -20 && Math.abs(v[0]) < (v[2] + 30) * (Math.tan(HFOV / 2) + margin); };
  const add = (key, svg) => polys.push({ key, svg });

  // ---- ground: this hole's own ground near its line, blended into the others and the valley, absolute y
  const cache = new Map();
  const gq = (x, z) => { const key = x.toFixed(2) + ':' + z.toFixed(2); let v = cache.get(key); if (!v) { v = worldAt(...W(x, z)); cache.set(key, v); } return v; };
  const gy = (x, z) => gq(x, z).y;
  const cells = [];
  function cell(x, z, s) {
    const d = Math.hypot(x + s / 2 - cam.pos[0], z + s / 2 - cam.pos[2]);
    if (d > 2700) return;
    if (!inView(x + s / 2, z + s / 2, 0.35 + s / Math.max(d, 1))) return;
    const c = gq(x + s / 2, z + s / 2), k = [gq(x, z), gq(x + s, z), gq(x + s, z + s), gq(x, z + s)];
    const mixed = k.some(q => q.s !== c.s), tall = Math.max(...k.map(q => q.y)) - Math.min(...k.map(q => q.y));
    const want = Math.max(1.2, d * 0.02);
    if (s > want * 1.5 || (mixed && s > Math.max(1.2, d * 0.006)) || (tall > 30 && s > 6)) { const t = s / 2; cell(x, z, t); cell(x + t, z, t); cell(x + t, z + t, t); cell(x, z + t, t); return; }
    cells.push({ x, z, s, c, k, d });
  }
  const R0 = 2700, S0 = 64, gx0 = Math.floor((cam.pos[0] - R0) / S0) * S0, gz0 = Math.floor((cam.pos[2] - R0) / S0) * S0;
  for (let x = gx0; x < cam.pos[0] + R0; x += S0) for (let z = gz0; z < cam.pos[2] + R0; z += S0) cell(x, z, S0);
  const jungle = [];
  for (const q of cells) {
    const { x, z, s, c, k } = q;
    const ys = c.s === 'water' || c.s === 'tar' ? k.map(() => c.y) : k.map(v => v.s === 'water' && c.s !== 'water' ? c.y : v.y);
    let col = SC[c.s] || SC.meadow;
    const dx = ((ys[1] + ys[2]) - (ys[0] + ys[3])) / (2 * s), dz = ((ys[2] + ys[3]) - (ys[0] + ys[1])) / (2 * s);
    const n = [-dx, 1, -dz], nl = Math.hypot(...n), lam = clamp((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl, 0, 1), steep = 1 / nl < 0.45;
    // sandstone faces: banded, streaked dark where water runs; jungle on the ledges where the face lies back
    if (c.s === 'cliff') {
      const yc = ys.reduce((a, v) => a + v, 0) / 4, band = 0.92 + 0.1 * Math.sin(yc / 7.3) + 0.05 * Math.sin(yc / 2.1), streak = hash(Math.floor((x + z) / 9), 3) > 0.78 ? 0.78 : 1;
      col = steep ? col.map(v => v * band * streak) : [104, 142, 88];
    }
    const tex = c.s === 'fairway' || c.s === 'tee' ? 0.985 + 0.03 * (Math.floor(Math.hypot(x, z) / 9) % 2) : c.s === 'meadow' || c.s === 'jungle' ? 0.94 + 0.1 * hash(Math.floor(x / 6), Math.floor(z / 6)) : 1;
    const flat = c.s === 'water' || c.s === 'tar';
    col = flat ? col : col.map(v => v * (0.74 + 0.32 * lam) * tex);
    const P = proj([[x, ys[0], z], [x + s, ys[1], z], [x + s, ys[2], z + s], [x, ys[3], z + s]]);
    if (!P) continue;
    const fc = hex(mix(col, fogAt(q.d)));
    add(q.d, `<polygon points="${fmt(P)}" fill="${fc}" stroke="${fc}" stroke-width="0.7"/>`);
    // grains in the bunkers and on the sandbars; ripples on the water; the tar's sheen
    if ((c.s === 'sand' || c.s === 'bar' || c.s === 'waste') && q.d < 300 && s <= 4) {
      const f = fogAt(q.d), y0 = ys.reduce((a, v) => a + v, 0) / 4 + 0.05, cc = hex(mix([170, 150, 112], f));
      let dots = '';
      for (let i = 0; i < 3; i++) { const v = cam.view([x + hash(x + i, z) * s, y0, z + hash(z + i, x) * s]); if (v[2] < 1) continue; const p = cam.scr(v); dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${Math.max(0.6, 1.4 * (1.1 - f)).toFixed(2)}" fill="${cc}"/>`; }
      if (dots) add(q.d - 0.03, dots);
    }
    if ((c.s === 'water' || c.s === 'tar') && q.d < 700 && s <= 10 && hash(Math.floor(x / 5), Math.floor(z / 5)) > 0.55) {
      const y0 = c.y + 0.05, a = hash(x, z) * 0.6, l = s * 0.8, p = projLine([[x + s / 2 - Math.cos(a) * l / 2, y0, z + s / 2 - Math.sin(a) * l / 2], [x + s / 2 + Math.cos(a) * l / 2, y0, z + s / 2 + Math.sin(a) * l / 2]]);
      if (p) add(q.d - 0.02, `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${c.s === 'tar' ? '#8a8480' : hex(mix([236, 244, 250], fogAt(q.d) * 0.5))}" stroke-width="${c.s === 'tar' ? 1 : 1.3}"/>`);
    }
    // fern fronds on the meadow close by
    if (c.s === 'meadow' && q.d < 70 && s <= 3 && hash(Math.floor(x * 1.7), Math.floor(z * 1.3)) > 0.82) {
      const f = fogAt(q.d), y0 = ys[0], bx = x + hash(x, 1) * s, bz = z + hash(z, 2) * s; let sv = '';
      for (let i = 0; i < 4; i++) { const a = i * 1.6 + hash(x, i), p = projLine([[bx, y0, bz], [bx + Math.cos(a) * 1.1, y0 + 0.7, bz + Math.sin(a) * 1.1]]); if (p) sv += `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${hex(mix([128, 160, 96], f))}" stroke-width="${(0.8 * (1.1 - f)).toFixed(2)}" stroke-linecap="round"/>`; }
      if (sv) add(q.d - 0.04, sv);
    }
    // the jungle on the walls' talus and ledges: a canopy of crowns over every cell
    if ((c.s === 'jungle' || (c.s === 'cliff' && !steep) || c.s === 'rubble') && q.d < 2400) {
      const [X, Z] = W(x + s / 2, z + s / 2), clear = Math.min(...WL.map(L => distLine(L, X, Z)));
      // tall jungle only on the valley's walls, off the lines of play; low ferns and cycads on the bluff and banks
      if (clear > 30 && !FALLS.some(F => distLine([F.foot, [F.foot[0] + (F.foot[0] - VALLEY.c[0]) * 0.4, F.foot[1] + (F.foot[1] - VALLEY.c[1]) * 0.4]], X, Z) < F.w * 0.8 + 6)) jungle.push({ x: x + s / 2, z: z + s / 2, y: ys.reduce((a, v) => a + v, 0) / 4, s, d: q.d, low: wallD(X, Z) < 0 || clear < 60 });
    }
  }

  // ---- ink outlines draped on the ground: the green, bunkers, the water's edge, the fairway's edges
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
  for (const b of B.bunkers) segDrape(edgeSegs(B.inBunker(b), ...b.box, b.strip ? 1.2 : 0.8), [120, 100, 64], 1.2);
  { const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
    segDrape(edgeSegs((x, z) => ['water', 'tar'].includes(B.surface(x, z)), Math.min(...xs) - 160, Math.min(...zs) - 160, Math.max(...xs) + 160, Math.max(...zs) + 160, 2.5), [60, 100, 130], 1.1, 0.1);
    segDrape(edgeSegs((x, z) => B.surface(x, z) === 'fairway', Math.min(...xs) - 90, Math.min(...zs) - 40, Math.max(...xs) + 90, Math.max(...zs) + 40, 2), [120, 146, 180], 1.0); }

  // ---- solids
  const ink = (d, a = 1) => `stroke="${hex(mix([40, 44, 40], fogAt(d) * 0.9))}" stroke-opacity="${a}"`;
  const face = (P3s, colr, d, extra = '', seed = 1, sw = 1, op = 1) => {
    const P = proj(P3s); if (!P) return null;
    const f = fogAt(d); return `<polygon points="${fmt(P)}" fill="${hex(mix(colr, f))}" fill-opacity="${op}" stroke="none"/>` +
      `<polyline points="${fmt(wob(P, true, seed))}" fill="none" ${ink(d, op < 1 ? 0.5 : 1)} stroke-width="${(sw * (1.3 - f)).toFixed(2)}" stroke-linejoin="round"/>` + extra;
  };
  function prismUp(pts, y0, tops, colr, seed, kb = 0, taper = 1, op = 1) {
    const ctr = [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length], d0 = cam.hd([ctr[0], 0, ctr[1]]);
    if (d0 > 1700 || !inView(ctr[0], ctr[1], 0.4 + 30 / Math.max(d0, 1))) return;
    const top = pts.map((p, i) => [ctr[0] + (p[0] - ctr[0]) * taper, typeof tops === 'number' ? tops : tops[i], ctr[1] + (p[1] - ctr[1]) * taper]);
    if (cam.pos[1] > Math.min(...top.map(p => p[1]))) { const s = face(top, colr.map(v => v * 1.05), d0, '', seed + 9, 0.7, op); if (s) add(d0 + kb + 0.01, s); }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      const nx = mx - ctr[0], nz = mz - ctr[1];
      if ((cam.pos[0] - mx) * nx + (cam.pos[2] - mz) * nz <= 0) continue;
      const dd = cam.hd([mx, 0, mz]), lit = 0.8 + 0.24 * Math.max(0, (nx * L[0] + nz * L[2]) / Math.hypot(nx, nz));
      const s = face([[a[0], y0, a[1]], [b[0], y0, b[1]], top[(i + 1) % pts.length], top[i]], colr.map(v => v * lit), dd, '', seed + i, 0.8, op); if (s) add(dd + kb, s);
    }
  }
  const ngon = (x, z, r, n, rot = 0, sq = 1) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * 6.283; return [x + Math.cos(a) * r, z + Math.sin(a) * r * sq]; });
  function prism(a, b, w, t, colr, seed, op = 1, kb = 0) {  // an oriented beam from a to b (each [x, z, y])
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
      const s = face(F, colr.map(v => v * (0.84 + 0.05 * i)), cam.hd(fc), '', seed + i, 0.9, op); if (s) add(cam.hd(fc) - 0.5 + kb, s);
    }
  }
  const lineSvg = (p, colr, w, extra = '') => p ? `<line x1="${p[0][0].toFixed(1)}" y1="${p[0][1].toFixed(1)}" x2="${p[1][0].toFixed(1)}" y2="${p[1][1].toFixed(1)}" stroke="${colr}" stroke-width="${w}" ${extra}/>` : '';
  const pxPerM = (x, y, z) => { const v = cam.view([x, y, z]); return v[2] > 0.5 ? FPX / v[2] : 0; };
  // trees by kind, as a trunk and a crown facing the camera
  const GREENS = { broad: [[70, 110, 62], [62, 100, 58], [82, 118, 66]], conifer: [[52, 86, 58], [46, 78, 54]], giant: [[46, 80, 54], [40, 72, 50]], cypress: [[74, 104, 74], [66, 96, 70]], fern: [[96, 140, 72], [86, 132, 68]], cycad: [[110, 140, 70], [98, 130, 64]] };
  function tree(kind, x, z, y0, r, hh, seed, dark = 0) {
    const d = cam.hd([x, 0, z]); if (d > 2500 || !inView(x, z, 0.3)) return;
    const f = fogAt(d), ppm = pxPerM(x, y0, z); if (ppm * hh < 1.5) return;
    const g = GREENS[kind][Math.floor(hash(seed, 3) * GREENS[kind].length)].map(v => v * (1 - dark)), outline = hex(mix([34, 52, 36], f)), fill = hex(mix(g, f));
    const cx = cam.r[0], cz = cam.r[2];   // the camera's right, flat, for crowns that face it
    let svg = '';
    const trunkW = (w) => Math.max(0.8, w * ppm).toFixed(2);
    if (kind === 'giant') {   // the giant monkey-puzzle: a massive trunk under a dome of flat, spiny boughs in tiers
      svg += lineSvg(projLine([[x, y0, z], [x, y0 + hh * 0.97, z]]), hex(mix([92, 74, 58], f)), trunkW(2.2));
      for (const [lv, rr] of [[0.2, 0.5], [0.32, 0.72], [0.44, 0.88], [0.56, 0.98], [0.67, 1.0], [0.77, 0.94], [0.86, 0.8], [0.94, 0.56]]) {
        const P = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; P.push([x + Math.cos(a) * r * rr * cx, y0 + hh * lv + Math.sin(a) * hh * 0.045 - Math.abs(Math.cos(a)) * hh * 0.03, z + Math.cos(a) * r * rr * cz]); }
        const c = proj(P); if (c) svg += `<polygon points="${fmt(wob(c, true, seed + lv * 9, 0.8))}" fill="${fill}" stroke="${outline}" stroke-width="${(0.6 * (1.2 - f)).toFixed(2)}"/>`;
      }
    } else if (kind === 'conifer') {   // a monkey-puzzle: a tall bare trunk, a flat, layered umbrella crown
      svg += lineSvg(projLine([[x, y0, z], [x, y0 + hh * 0.86, z]]), hex(mix([92, 74, 58], f)), trunkW(0.7));
      for (const [lv, rr] of [[0.7, 0.9], [0.8, 1.0], [0.9, 0.7]]) {
        const P = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; P.push([x + Math.cos(a) * r * rr * cx, y0 + hh * lv + Math.sin(a) * hh * 0.07, z + Math.cos(a) * r * rr * cz]); }
        const c = proj(P); if (c) svg += `<polygon points="${fmt(wob(c, true, seed + lv * 9, 0.8))}" fill="${fill}" stroke="${outline}" stroke-width="${(0.6 * (1.2 - f)).toFixed(2)}"/>`;
      }
    } else if (kind === 'fern' || kind === 'cycad') {   // a crown of fronds arching out from the top of a trunk
      const top = kind === 'fern' ? hh * 0.88 : hh * 0.55;
      svg += lineSvg(projLine([[x, y0, z], [x, y0 + top, z]]), hex(mix(kind === 'fern' ? [92, 78, 60] : [120, 100, 70], f)), trunkW(kind === 'fern' ? 0.3 : 0.7));
      const n = kind === 'fern' ? 9 : 11;
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2 + hash(seed, i), ex = Math.cos(a), ez = Math.sin(a), rr = r * (0.85 + 0.3 * hash(i, seed));
        const P = [[x, y0 + top, z], [x + ex * rr * 0.55, y0 + top + (kind === 'fern' ? 0.6 : 0.9), z + ez * rr * 0.55], [x + ex * rr, y0 + top - (kind === 'fern' ? 1.2 : 0.3), z + ez * rr]];
        const p = projLine(P); if (p) svg += `<polyline points="${fmt(p)}" fill="none" stroke="${fill}" stroke-width="${Math.max(1, (kind === 'fern' ? 0.55 : 0.4) * ppm).toFixed(2)}" stroke-linecap="round"/>`;
      }
    } else {   // a broadleaf or a swamp cypress: a trunk under a broad, ragged crown
      svg += lineSvg(projLine([[x, y0, z], [x + 0.3, y0 + hh * 0.55, z]]), hex(mix([84, 70, 56], f)), trunkW(kind === 'cypress' ? 0.9 : 0.6));
      if (kind === 'cypress') { const p = projLine([[x - 1.6 * cx, y0, z - 1.6 * cz], [x, y0 + 3, z], [x + 1.6 * cx, y0, z + 1.6 * cz]]); if (p) svg += `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([84, 70, 56], f))}" stroke-width="${trunkW(0.5)}"/>`; }
      const N = 11, P = [], lo = kind === 'cypress' ? 0.62 : 0.5;
      for (let i = 0; i < N; i++) { const a = i / N * 6.283, rr = r * (0.72 + 0.38 * hash(seed, i)); P.push([x + Math.cos(a) * rr * cx, y0 + hh * (lo + (1 - lo) / 2) + Math.sin(a) * hh * (1 - lo) / 2, z + Math.cos(a) * rr * cz]); }
      const c = proj(P); if (c) svg += `<polygon points="${fmt(wob(c, true, seed, 1.4))}" fill="${fill}" stroke="${outline}" stroke-width="${(0.7 * (1.2 - f)).toFixed(2)}"/>`;
    }
    add(d - 0.2, svg);
  }
  // the jungle on the talus: a crown or two in each cell, stacked so the canopy reads as a mass
  for (const j of jungle) {
    const n = j.s < 4 ? 1 : j.s < 12 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const x = j.x + (hash(j.x + i, j.z) - 0.5) * j.s, z = j.z + (hash(j.z + i, j.x) - 0.5) * j.s, k = hash(Math.floor(x), Math.floor(z));
      const kind = j.low ? (k < 0.5 ? 'cycad' : 'fern') : k < 0.55 ? 'broad' : k < 0.75 ? 'conifer' : 'fern', hh = j.low ? (kind === 'cycad' ? 3.5 : 6) : kind === 'broad' ? 16 + 10 * hash(x, 4) : kind === 'conifer' ? 26 + 10 * hash(x, 5) : 8, r = j.low ? 2.4 : kind === 'broad' ? Math.max(6, j.s * 0.55) : kind === 'conifer' ? 6 : 3;
      if (j.low && hash(x, z + 3) > 0.45) continue;
      tree(kind, x, z, j.y - 1, r, hh, Math.round(x * 3 + z), 0.08 * hash(z, 7));
    }
  }
  function mist(x, z, y0, r, n, seed, op = 0.5) {   // soft white wisps: spray, steam, swamp mist
    const d = cam.hd([x, 0, z]); if (d > 2000 || !inView(x, z, 0.6)) return;
    let svg = '';
    for (let k = 0; k < n; k++) {
      const v = cam.view([x + (hash(seed, k) - 0.5) * r * 1.6, y0 + k * r * 0.25, z + (hash(k, seed) - 0.5) * r * 1.6]); if (v[2] < 3) continue;
      const c = cam.scr(v), pr = r * (0.5 + 0.5 * hash(seed + 3, k)) / v[2] * FPX;
      svg += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${pr.toFixed(1)}" ry="${(pr * 0.42).toFixed(1)}" fill="white" fill-opacity="${(op * (0.6 + 0.4 * hash(k, 9))).toFixed(2)}"/>`;
    }
    add(d - 3, svg);
  }
  // a creature from its profile, standing at (x, z) on y0, facing dir (a direction in this frame)
  function creature(kind, x, z, y0, dx, dz, len, opts = {}) {
    const d = cam.hd([x, 0, z]); if (d > 2600 || !inView(x, z, 0.4)) return;
    const P = PROFILE[kind], sc = len / P.ref, body = opts.graze ? P.graze : P.body, f = fogAt(d);
    const pt = ([u, v]) => [x + dx * u * len, y0 + v * sc, z + dz * u * len];
    const col = P.color.map(v => v * (opts.dark ? 0.85 : 1));
    let svg = '';
    // legs: the far pair darker, behind; the near pair in front
    const side = [-dz, dx], toC = (cam.pos[0] - x) * side[0] + (cam.pos[2] - z) * side[1] > 0 ? 1 : -1;
    const leg = (u, top, w, s, shade) => {
      const bx = x + dx * u * len + side[0] * s * 0.18 * len * 0.15 * toC, bz = z + dz * u * len + side[1] * s * 0.18 * len * 0.15 * toC;
      const yb = opts.wade ? Math.max(y0, opts.wade) : y0, Q = proj([[bx - dx * w * sc / 2, yb, bz - dz * w * sc / 2], [bx + dx * w * sc / 2, yb, bz + dz * w * sc / 2], [bx + dx * w * sc / 2, y0 + top * sc, bz + dz * w * sc / 2], [bx - dx * w * sc / 2, y0 + top * sc, bz - dz * w * sc / 2]]);
      if (Q) svg += `<polygon points="${fmt(Q)}" fill="${hex(mix(col.map(v => v * shade), f))}" stroke="${hex(mix([46, 40, 34], f))}" stroke-width="0.6"/>`;
    };
    for (const [u, top, w] of P.legs) leg(u, top, w, -1, 0.78);
    const Q = proj(body.map(pt));
    if (Q) svg += `<polygon points="${fmt(Q)}" fill="${hex(mix(col, f))}" stroke="${hex(mix([46, 40, 34], f))}" stroke-width="${(0.9 * (1.2 - f)).toFixed(2)}" stroke-linejoin="round"/>`;
    for (const [u, top, w] of P.legs) leg(u, top, w, 1, 0.95);
    if (opts.wade) { const p = proj(ngon(x, z, len * 0.32, 10, Math.atan2(dz, dx), 0.35).map(([a, b]) => [a, opts.wade + 0.05, b])); if (p) svg = svg + `<polygon points="${fmt(p)}" fill="none" stroke="#f4f8fa" stroke-width="1.2" stroke-opacity="0.8"/>`; }
    add(d - 0.4, svg);
  }
  // a pterosaur in flight: a glider of membrane between long wing bones, seen from below or the side
  function ptero(x, z, y, dx, dz, span) {
    const d = cam.hd([x, 0, z]); if (d > 2600 || !inView(x, z, 0.5)) return;
    const sx = -dz, sz = dx, f = fogAt(d), P = [];
    const W = [[0.0, 1.4], [0.15, 0.5], [0.5, 0.35], [0.95, -0.15], [0.5, -0.35], [0.15, -0.6], [0, -0.9], [-0.15, -0.6], [-0.5, -0.35], [-0.95, -0.15], [-0.5, 0.35], [-0.15, 0.5]];
    for (const [w, u] of W) P.push([x + sx * w * span / 2 + dx * u, y + Math.abs(w) * span * 0.08, z + sz * w * span / 2 + dz * u]);
    const q = proj(P); if (!q) return;
    let svg = `<polygon points="${fmt(q)}" fill="${hex(mix([88, 80, 76], f))}" stroke="${hex(mix([40, 36, 34], f))}" stroke-width="0.7" stroke-linejoin="round"/>`;
    const c = projLine([[x + dx * 1.4, y, z + dz * 1.4], [x - dx * 0.4, y + 0.9, z - dz * 0.4]]); if (c) svg += lineSvg(c, hex(mix([60, 54, 50], f)), 1.2);   // the crest
    add(d - 0.5, svg);
  }

  function drawObjs(objs, map, yoff, dirMap) {
    for (const o of objs) {
      const tr = p => map(p[0], p[1]);
      if (o.kind === 'boulder') {
        const [x, z] = tr([o.x, o.z]), pts = ngon(x, z, o.r * 0.8, 6, hash(x, z) * 6, 0.8);
        prismUp(pts, o.base + yoff, pts.map((_, i) => o.base + yoff + o.h * (0.75 + 0.25 * hash(i, x))), [168, 142, 118], Math.round(x + z), 0, 0.6);
      } else if (GREENS[o.kind]) { const p = tr([o.x, o.z]); tree(o.giant ? 'giant' : o.kind, p[0], p[1], o.base + yoff, o.r, o.h, Math.round(o.x * 7 + o.z)); }
      else if (o.kind === 'log') {   // the fallen giant: a long trunk lying on the ground, its root plate up at one end
        const a = [...tr([o.a[0], o.a[1]])], b = [...tr([o.b[0], o.b[1]])], P = [[a[0], o.a[2] + yoff + o.r, a[1]], [b[0], o.b[2] + yoff + o.r * 0.8, b[1]]];
        const pm = pxPerM(...P[0]), d = cam.hd(P[0]);
        let sv = lineSvg(projLine(P), '#4a3a2c', Math.max(1.2, o.r * 2.2 * pm).toFixed(2)) + lineSvg(projLine(P), '#7a634c', Math.max(0.6, o.r * 1.2 * pm).toFixed(2));
        const rp = proj(ngon(a[0], a[1], o.r * 2.6, 9, 0.2, 1).map(([u, v]) => [u, o.a[2] + yoff + o.r * 1.6, v])); if (rp) sv += `<polygon points="${fmt(rp)}" fill="#5a4636" stroke="#3a2c20" stroke-width="0.8"/>`;
        add(d, sv);
      }
      else if (o.kind === 'spire') {   // a sandstone pinnacle off the bluff, the pterosaur on top
        const [x, z] = tr([o.x, o.z]), y0 = o.base + yoff, pts = ngon(x, z, o.r, 7, 0.4, 1);
        prismUp(pts, y0, pts.map((_, i) => y0 + o.top * (0.94 + 0.06 * hash(i, 4))), [182, 150, 124], 41, 0, 0.55);
        const top = y0 + o.top; creature('perched', x, z, top, ...dirMap(0.6, -0.8), 5.5);
      } else if (o.kind === 'strangler') {   // a fluted trunk of fused roots under a vast crown
        const [x, z] = tr([o.x, o.z]), y0 = o.base + yoff, d = cam.hd([x, 0, z]);
        prismUp(ngon(x, z, o.r * 1.5, 9, 0.2, 1), y0 - 1, y0 + 6, [128, 108, 86], 51, 0, 0.6);
        prismUp(ngon(x, z, o.r, 9, 0.2, 1), y0, y0 + o.h * 0.55, [136, 114, 90], 52, 0, 0.75);
        for (let i = 0; i < 6; i++) { const a = i * 1.05, p = projLine([[x + Math.cos(a) * o.r * 0.9, y0, z + Math.sin(a) * o.r * 0.9], [x + Math.cos(a + 0.5) * o.r * 0.5, y0 + o.h * 0.55, z + Math.sin(a + 0.5) * o.r * 0.5]]); if (p) add(d - 0.6, lineSvg(p, hex(mix([96, 80, 62], fogAt(d))), 1.4)); }
        for (const [lv, rr, dy] of [[0.62, 1.0, 0], [0.76, 0.85, 4], [0.88, 0.6, -6]]) {
          const N = 14, P = []; for (let i = 0; i < N; i++) { const a = i / N * 6.283, q = o.canopy * rr * (0.8 + 0.3 * hash(i, lv * 10)); P.push([x + Math.cos(a) * q * cam.r[0] + dy * cam.f[0], y0 + o.h * lv + Math.sin(a) * o.h * 0.12, z + Math.cos(a) * q * cam.r[2] + dy * cam.f[2]]); }
          const c = proj(P); if (c) add(d - 1 - lv, `<polygon points="${fmt(wob(c, true, 50 + lv * 9, 2))}" fill="${hex(mix([60, 100, 60].map(v => v * (0.9 + lv * 0.15)), fogAt(d)))}" stroke="${hex(mix([30, 52, 34], fogAt(d)))}" stroke-width="0.9"/>`);
        }
      } else if (o.kind === 'arch') {   // the root arch: a thick, knotted root curving from the trunk to its foot
        const N = 28, pts = [];
        for (let i = 0; i <= N; i++) { const t = i / N, p = [o.a[0] + (o.b[0] - o.a[0]) * t, o.a[1] + (o.b[1] - o.a[1]) * t], [x, z] = tr(p), ab = B.archAt ? null : null; const yb = o.a[2] + (o.b[2] - o.a[2]) * t, lift = o.crown * Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.85; pts.push([x, z, yb + yoff + lift + o.t / 2]); }
        for (let i = 0; i < N; i++) prism(pts[i], pts[i + 1], 0.8 * o.w * (1 + 0.6 * (1 - Math.sin(Math.PI * i / N))), 0.85 * o.t * (1 + 0.5 * (1 - Math.sin(Math.PI * i / N))), [118, 98, 78], 60 + i, 1, -1);
      } else if (o.kind === 'tent') {   // canvas A-frame tents
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z), c = Math.cos(o.rot), s = Math.sin(o.rot), u = [c, s], v = [-s, c], w = o.w / 2, l = o.l / 2;
        const P = (a, b, y) => [x + u[0] * a + v[0] * b, y, z + u[1] * a + v[1] * b];
        const d = cam.hd([x, 0, z]); if (d > 900) continue;
        for (const sd of [-1, 1]) { const s1 = face([P(sd * w, -l, y0), P(sd * w, l, y0), P(0, l, y0 + o.h), P(0, -l, y0 + o.h)], [232, 222, 196].map(q => q * (sd > 0 ? 1 : 0.9)), d, '', 70 + sd, 0.7); if (s1) add(d + (sd * ((cam.pos[0] - x) * u[0] + (cam.pos[2] - z) * u[1]) > 0 ? -0.1 : 0.1), s1); }
        for (const e of [-1, 1]) { const s1 = face([P(-w, e * l, y0), P(w, e * l, y0), P(0, e * l, y0 + o.h)], [214, 200, 168], d, '', 72 + e, 0.7); if (s1) add(d + (e * ((cam.pos[0] - x) * v[0] + (cam.pos[2] - z) * v[1]) > 0 ? -0.15 : 0.15), s1); }
      } else if (o.kind === 'fly') {   // the mess fly: a canvas roof on poles
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z), c = Math.cos(o.rot), s = Math.sin(o.rot), d = cam.hd([x, 0, z]); if (d > 900) continue;
        const P = (a, b, y) => [x + c * a - s * b, y, z + s * a + c * b], w = o.w / 2, l = o.l / 2;
        let sv = ''; for (const [a, b] of [[-w, -l], [w, -l], [w, l], [-w, l]]) sv += lineSvg(projLine([P(a, b, y0), P(a, b, y0 + o.h - 0.6)]), hex(mix([96, 80, 60], fogAt(d))), 1.2);
        add(d + 0.2, sv);
        for (const sd of [-1, 1]) { const s1 = face([P(sd * w, -l, y0 + o.h - 0.6), P(sd * w, l, y0 + o.h - 0.6), P(0, l, y0 + o.h + 0.5), P(0, -l, y0 + o.h + 0.5)], [236, 226, 200], d, '', 75 + sd, 0.7); if (s1) add(d - 0.1, s1); }
      } else if (o.kind === 'hut') {   // a hut on stilts: a timber box on posts, a thatched roof, a ladder
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z), d = cam.hd([x, 0, z]); if (d > 1200) continue;
        const pts = ngon(x, z, Math.hypot(o.w, o.l) / 2, 4, o.rot + Math.atan2(o.l, o.w), 1);
        let sv = ''; for (const p of pts) sv += lineSvg(projLine([[p[0], y0, p[1]], [p[0], y0 + o.stilt, p[1]]]), hex(mix([90, 72, 54], fogAt(d))), Math.max(1, 0.35 * pxPerM(x, y0, z)).toFixed(1));
        add(d + 0.3, sv);
        prismUp(pts, y0 + o.stilt, y0 + o.stilt + o.h * 0.7, [150, 118, 84], 80);
        prismUp(pts.map(p => [x + (p[0] - x) * 1.25, z + (p[1] - z) * 1.25]), y0 + o.stilt + o.h * 0.7, y0 + o.stilt + o.h * 1.4, [190, 164, 108], 81, -0.4, 0.15);
      } else if (o.kind === 'fire') {
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z), d = cam.hd([x, 0, z]); if (d > 700) continue;
        const v = cam.view([x, y0 + 0.4, z]); if (v[2] > 2) { const c = cam.scr(v), rr = 1 / v[2] * FPX; add(d - 0.3, `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rr * 1.2).toFixed(1)}" ry="${(rr * 0.7).toFixed(1)}" fill="#f0903a"/>`); }
        mist(x, z, y0 + 3, 2.5, 4, 11, 0.45);
      } else if (o.kind === 'crates') {
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z);
        for (let i = 0; i < 3; i++) { const p = ngon(x + i * 1.6, z + (i % 2) * 1.2, 0.85, 4, 0.78, 1); prismUp(p, y0, y0 + 1.1 + (i === 1 ? 1.1 : 0), [170, 136, 92], 90 + i); }
      } else if (o.kind === 'flag') {
        const [x, z] = tr([o.x, o.z]), y0 = gy(x, z), d = cam.hd([x, 0, z]); if (d > 900) continue;
        const pole = projLine([[x, y0, z], [x, y0 + o.h, z]]), fl = proj([[x, y0 + o.h, z], [x + 2.2 * cam.r[0], y0 + o.h - 0.5, z + 2.2 * cam.r[2]], [x, y0 + o.h - 1.1, z]]);
        add(d - 0.2, lineSvg(pole, '#5a4a3a', 1.1) + (fl ? `<polygon points="${fmt(fl)}" fill="#3f6a8a"/>` : ''));
      } else if (o.kind === 'bridge') {   // the rope bridge: two sagging hand ropes and the deck, hangers between
        const a = o.a, b = o.b, ya = gy(...a) + 1.0, yb = gy(...b) + 1.0, d = cam.hd([(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]); if (d > 1500) continue;
        const span = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / span, nz = (b[0] - a[0]) / span, N = 16, f = fogAt(d);
        const rope = (off, up) => { const P = []; for (let i = 0; i <= N; i++) { const t = i / N; P.push([a[0] + (b[0] - a[0]) * t + nx * off, ya + (yb - ya) * t - span * 0.09 * 4 * t * (1 - t) + up, a[1] + (b[1] - a[1]) * t + nz * off]); } return P; };
        let sv = '';
        const deck = rope(0, 0), hl = rope(-0.8, 1.1), hr = rope(0.8, 1.1);
        for (const R of [deck, hl, hr]) { const p = projLine(R); if (p) sv += `<polyline points="${fmt(p)}" fill="none" stroke="${hex(mix([92, 70, 46], f))}" stroke-width="${R === deck ? 2.2 : 1}"/>`; }
        for (let i = 1; i < N; i += 2) for (const R of [hl, hr]) sv += lineSvg(projLine([R[i], deck[i]]), hex(mix([120, 96, 64], f)), 0.6);
        for (const p of [a, b]) for (const s of [-1, 1]) sv += lineSvg(projLine([[p[0] + nx * s, gy(...p), p[1] + nz * s], [p[0] + nx * s, gy(...p) + 2.4, p[1] + nz * s]]), hex(mix([80, 62, 44], f)), 1.6);
        add(d - 2, sv);
      }
    }
  }
  const dirMapHere = (dx, dz) => { const v = dirHere(dx, dz), l = Math.hypot(...v); return [v[0] / l, v[1] / l]; };
  drawObjs(B.objs, (x, z) => [x, z], h.base, dirMapHere);
  for (const [k, Hk] of HOLES.entries()) {
    if (k === hi) continue;
    const Wk = WOR[k], m = (x, z) => toHere(...Wk(x, z));
    const near = [Hk.line[0], Hk.pin, ...Hk.line].some(p => Math.hypot(...toHere(...Wk(...p)).map((v, i) => v - [cam.pos[0], cam.pos[2]][i])) < 1100);
    drawObjs(BUILT[k].objs.filter(o => near || ['strangler', 'arch', 'spire'].includes(o.kind)), m, Hk.base, dirMapHere);
  }
  // world things: the camp, the bridge, the scattered trees
  drawObjs(CAMP.map(o => { const [x, z] = toHere(...o.at); return { ...o, x, z, rot: (o.rot || 0) - a0 }; }), (x, z) => [x, z], 0, dirMapHere);
  drawObjs([{ kind: 'bridge', a: toHere(...BRIDGE.a), b: toHere(...BRIDGE.b) }], (x, z) => [x, z], 0, dirMapHere);
  for (const t of SCATTER) { const [x, z] = toHere(t.X, t.Z); if (cam.hd([x, 0, z]) > 1650) continue; tree(t.kind, x, z, gy(x, z) - 0.3, t.r, t.h, Math.round(t.X * 3 + t.Z)); }
  // the swamp's mist, lying low over the water
  for (let i = 0; i < 26; i++) { const R = rnd(400 + i), X = 300 + R() * 200, Z = -700 + R() * 300; if (swampD(X, Z) > -5) continue; const [x, z] = toHere(X, Z); mist(x, z, SWAMP.level + 1.5, 14, 3, 300 + i, 0.32); }
  // the falls: a ribbon down the wall's face from its lip to its foot, white water and spray
  for (const F of FALLS) {
    // the lip: out from the foot, away from the valley's centre, up the face until it stops rising
    const ox = F.fixed ? F.lip[0] - F.foot[0] : F.foot[0] - VALLEY.c[0], oz = F.fixed ? F.lip[1] - F.foot[1] : F.foot[1] - VALLEY.c[1], ol = Math.hypot(ox, oz), ux = ox / ol, uz = oz / ol;
    const topAt = topY(polar(...F.foot).th) - 4; let lipD = 0; if (!F.fixed) for (let dd = 0; dd < 500; dd += 2) { lipD = dd; if (V(F.foot[0] + ux * dd, F.foot[1] + uz * dd) >= topAt) break; }
    const lip = F.fixed ? F.lip : [F.foot[0] + ux * lipD, F.foot[1] + uz * lipD], T = toHere(...lip), Ft = toHere(...F.foot), N = 90, Lp = [], Rp = [], dxf = Ft[0] - T[0], dzf = Ft[1] - T[1], lf = Math.hypot(dxf, dzf), nx = -dzf / lf, nz = dxf / lf;
    const d = cam.hd([(T[0] + Ft[0]) / 2, 0, (T[1] + Ft[1]) / 2]); if (d > 4500) continue;
    // it drops from the lip: each step down, the ribbon sits on the face at that height (bunched where the face is
    // sheer, so it hangs straight down, spread where it runs down the talus), just out from the rock
    const top = V(...lip), yF = V(...F.foot), path = t => [lip[0] + (F.foot[0] - lip[0]) * t, lip[1] + (F.foot[1] - lip[1]) * t];
    let tt = 0;
    for (let i = 0; i <= N; i++) {
      const yk = top - (top - yF) * (i / N);
      while (tt < 1 && V(...path(tt)) > yk) tt = Math.min(1, tt + 0.002);
      const [Xw, Zw] = path(tt), y = Math.max(yk, V(Xw, Zw)) + 1.2, w = F.w * (0.55 + 0.55 * (i / N) + 0.08 * Math.sin(i / N * 19 + F.w));
      const [px, pz] = toHere(Xw - ux * 2, Zw - uz * 2); Lp.push([px - nx * w / 2, y, pz - nz * w / 2]); Rp.push([px + nx * w / 2, y, pz + nz * w / 2]);
    }
    const q = proj([...Lp, ...[...Rp].reverse()]);
    if (!q) continue;
    let streak = '';
    for (let k = 1; k < 5; k++) { const S = projLine(Lp.map((p, i) => { const r = Rp[i]; return [p[0] + (r[0] - p[0]) * k / 5, p[1], p[2] + (r[2] - p[2]) * k / 5]; })); if (S) streak += `<polyline points="${fmt(S)}" fill="none" stroke="#b8ccd8" stroke-width="${F.big ? 1.4 : 0.8}" stroke-opacity="0.8"/>`; }
    // in pieces down its length, each at its own distance, so the jungle in front of its foot doesn't hide it all
    for (let i = 0; i < N; i += 6) {
      const j = Math.min(N, i + 6), piece = proj([...Lp.slice(i, j + 1), ...Rp.slice(i, j + 1).reverse()]); if (!piece) continue;
      const mid = Lp[Math.floor((i + j) / 2)], dk = cam.hd(mid) - 8;
      let st = ''; for (let k = 1; k < 5; k++) { const S = projLine(Lp.slice(i, j + 1).map((p, ii) => { const r = Rp[i + ii]; return [p[0] + (r[0] - p[0]) * k / 5, p[1], p[2] + (r[2] - p[2]) * k / 5]; })); if (S) st += `<polyline points="${fmt(S)}" fill="none" stroke="#b8ccd8" stroke-width="${F.big ? 1.4 : 0.8}" stroke-opacity="0.8"/>`; }
      add(dk, `<polygon points="${fmt(piece)}" fill="#fbfdff" stroke="#fbfdff" stroke-width="0.8"/>` + st);
    }
    mist(Ft[0], Ft[1], V(...F.foot) + 4, F.big ? 30 : 10, F.big ? 8 : 3, 700 + F.w, F.big ? 0.45 : 0.35);
  }
  // the skeleton in the Bone Bluff's face: a long-neck's spine curving along the rock, ribs, the neck up the face
  {
    const kS = HOLES.findIndex(q => q.skeleton), toward = WOR[kS](...at(HOLES[kS].line, 150)), ux = toward[0] - BLUFF.c[0], uz = toward[1] - BLUFF.c[1], ul = Math.hypot(ux, uz);
    let F = null; for (let r = 0; r < 200; r += 1) { const X = BLUFF.c[0] + ux / ul * r, Z = BLUFF.c[1] + uz / ul * r; if (bluffD(X, Z) > 0.97) { F = [X, Z]; break; } }
    if (F) {
      const tx = -uz / ul, tz = ux / ul, out = [ux / ul, uz / ul], foot = V(F[0] + out[0] * 6, F[1] + out[1] * 6);
      const S = (t, y) => { const X = F[0] + tx * t * 0.72 - out[0] * 0.5, Z = F[1] + tz * t * 0.72 - out[1] * 0.5, [x, z] = toHere(X, Z); return [x, foot + y * 0.72, z]; };
      const d = cam.hd(S(0, 0)); if (d < 1400 && inView(...[S(0, 0)[0], S(0, 0)[2]], 0.4)) {
        const f = fogAt(d), bone = hex(mix([246, 238, 218], f * 0.6)), edge = hex(mix([92, 76, 60], f));
        let sv = '';
        const spine = []; for (let t = -26; t <= 8; t += 2) spine.push(S(t, 13 + 4 * Math.sin((t + 26) / 34 * Math.PI) - (t < -14 ? (t + 14) * -0.35 : 0)));
        const neck = []; for (let k = 0; k <= 10; k++) { const t = 8 + k * 1.3, y = 17 + k * 1.5 + k * k * 0.06; neck.push(S(t, y)); }
        for (const C of [spine, neck]) { const p = projLine(C); if (p) sv += `<polyline points="${fmt(p)}" fill="none" stroke="${edge}" stroke-width="5"/><polyline points="${fmt(p)}" fill="none" stroke="${bone}" stroke-width="3" stroke-dasharray="4 1.5"/>`; }
        for (let t = -12; t <= 6; t += 2.2) { const top = S(t, 15 + 2 * Math.sin((t + 26) / 34 * Math.PI)), P = []; for (let k = 0; k <= 6; k++) { const a = k / 6; P.push(S(t + 1.6 * Math.sin(a * Math.PI), 15 - a * 6.5 + 2 * Math.sin((t + 26) / 34 * Math.PI))); } const p = projLine(P); if (p) sv += `<polyline points="${fmt(p)}" fill="none" stroke="${edge}" stroke-width="3"/><polyline points="${fmt(p)}" fill="none" stroke="${bone}" stroke-width="1.7"/>`; }
        const sk = neck.at(-1), q = proj(ngon(sk[0], sk[2], 1.4, 6, 0, 0.6).map(([a, b]) => [a, sk[1], b])); if (q) sv += `<polygon points="${fmt(q)}" fill="${bone}" stroke="${edge}" stroke-width="1.2"/>`;
        for (const [t, y] of [[-6, 6], [4, 6.5]]) { const p = projLine([S(t, y + 3), S(t + 1, y - 2), S(t + 2.5, y - 5.5)]); if (p) sv += `<polyline points="${fmt(p)}" fill="none" stroke="${edge}" stroke-width="4"/><polyline points="${fmt(p)}" fill="none" stroke="${bone}" stroke-width="2.4"/>`; }
        add(d - 4, sv);
      }
    }
  }
  // the bones in the tar pit: ribs and a horned skull breaking the surface
  {
    // a horned plant-eater sunk on its belly in the largest pool, its spine pointing at the 3rd tee: the ribcage
    // as nested arches, the skull with its frill and three horns at the near end
    const [X0, Z0] = TAR.blobs[0], Q = (u, y, w) => { const [x, z] = toHere(X0 + u, Z0 + w); return [x, TAR.level + y, z]; };
    const d = cam.hd(Q(0, 0, 0));
    if (d < 1100) {
      const f = fogAt(d), bone = hex(mix([240, 228, 200], f * 0.5)), edge = hex(mix([60, 50, 40], f));
      let sv = '';
      const sp = projLine([Q(-9, 1.2, 0), Q(-3, 4.6, 0), Q(4, 4.2, 0), Q(10, 1.4, 0), Q(14, 0, 0.5)]); if (sp) sv += `<polyline points="${fmt(sp)}" fill="none" stroke="${edge}" stroke-width="5"/><polyline points="${fmt(sp)}" fill="none" stroke="${bone}" stroke-width="3" stroke-dasharray="4 1.5"/>`;
      for (let i = 0; i < 8; i++) {
        const u = -7 + i * 2.1, top = 4.6 - Math.abs(u + 1.5) * 0.12, wd = 3.6 - Math.abs(u + 1) * 0.12, P = [];
        for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; P.push(Q(u + 0.4 * Math.sin(a), top * Math.sin(a) - 0.3, -wd * Math.cos(a))); }
        const p = projLine(P); if (p) sv += `<polyline points="${fmt(p)}" fill="none" stroke="${edge}" stroke-width="3"/><polyline points="${fmt(p)}" fill="none" stroke="${bone}" stroke-width="1.7"/>`;
      }
      // the skull: a beak toward the tee, a broad frill behind it, two brow horns and a nose horn
      const fr = []; for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + k / 12 * Math.PI; fr.push(Q(-11.5 + 0.8 * Math.cos(a), 1.2 + 3.4 * Math.cos(a) * 0.9, 3.6 * Math.sin(a))); }
      const pf = proj(fr); if (pf) sv += `<polygon points="${fmt(pf)}" fill="${bone}" stroke="${edge}" stroke-width="1.4"/>`;
      const hd = proj([Q(-12.5, 0, -1.4), Q(-12.5, 2.4, -1.2), Q(-15.5, 1.6, 0), Q(-16.8, 0.4, 0), Q(-12.5, 0, 1.4), Q(-12.5, 2.4, 1.2)]); if (hd) sv += `<polygon points="${fmt(hd)}" fill="${bone}" stroke="${edge}" stroke-width="1.2"/>`;
      for (const [a0, b0] of [[[-13, 2.2, -0.9], [-15.6, 4.6, -1.3]], [[-13, 2.2, 0.9], [-15.6, 4.6, 1.3]], [[-15.4, 1.6, 0], [-16.4, 2.8, 0]]]) sv += lineSvg(projLine([Q(...a0), Q(...b0)]), edge, 2.6) + lineSvg(projLine([Q(...a0), Q(...b0)]), bone, 1.5);
      add(d - 1, sv);
    }
  }
  // the animals
  for (const a of LIFE) {
    const [x, z] = toHere(...a.at), dd = dirMapHere(Math.sin(a.dir || 0), -Math.cos(a.dir || 0));
    if (a.kind === 'ptero') ptero(x, z, a.y, ...dd, a.span);
    else if (a.kind === 'nest') {   // on the face: find the rock at this height south of the point
      let X = a.at[0], Z = a.at[1]; for (let k = 0; k < 80 && V(X, Z) < a.y; k++) Z += 2;
      const [nx2, nz2] = toHere(X, Z - 1.5), d = cam.hd([nx2, 0, nz2]); if (d > 1500) continue;
      const q = proj(ngon(nx2, nz2, 2.2, 7, 0, 0.6).map(([p, r]) => [p, a.y, r])); if (q) add(d - 6, `<polygon points="${fmt(q)}" fill="${hex(mix([96, 80, 60], fogAt(d)))}" stroke="#e8e2d6" stroke-width="0.8"/>`);
    } else {
      const wa = waterAt(...a.at), gy0 = wa ? V(...a.at) - 0.8 : gy(x, z);
      creature(a.kind === 'longneck' ? 'longneck' : a.kind, x, z, gy0, ...dd, a.len, { graze: a.kind === 'longneck' && !a.browse && !a.wade, wade: wa ? wa.level : 0, dark: a.kind === 'hunter' });
    }
  }
  // the flag on the green
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
  // past the cells: the walls and the table mountains beyond as silhouettes from their own heights
  const camW = W(cam.pos[0], cam.pos[2]), az0 = Math.atan2(cam.f[0], -cam.f[2]) + a0;
  const cols = 120, bands = [[2700, 3600], [3600, 9000]], tops = bands.map(() => []), dists = bands.map(() => []);
  for (let c = 0; c <= cols; c++) {
    const a = az0 + (c / cols - 0.5) * (HFOV + 0.3), sx = Math.sin(a), sz = -Math.cos(a);
    const P = an => { const dd = 5000, lx = Math.sin(a - a0), lz = -Math.cos(a - a0), w = [cam.pos[0] + lx * dd, cam.pos[1] + Math.tan(an) * dd, cam.pos[2] + lz * dd]; const v = cam.view(w); return v[2] > 1 ? cam.scr(v) : null; };
    bands.forEach(([d0, d1], b) => {
      let best = -Infinity, bd = d0;
      for (let d = d0; d < d1; d *= 1.02) { const y = V(camW[0] + sx * d, camW[1] + sz * d) - d * d / 12.7e6, an = Math.atan2(y - cam.pos[1], d); if (an > best) { best = an; bd = d; } }
      tops[b].push(P(best)); dists[b].push(bd);
    });
  }
  let far = '';
  const poly = (T, colr, op = 1) => { const pts = T.filter(Boolean); if (pts.length < 3) return ''; return `<polygon points="${fmt([...pts, [pts.at(-1)[0], VH + 60], [pts[0][0], VH + 60]])}" fill="${hex(colr)}" fill-opacity="${op}" stroke="${hex(colr.map(v => v * 0.88))}" stroke-width="1"/>`; };
  const mean = A => A.reduce((x, y) => x + y, 0) / A.length;
  far += poly(tops[1], mix([170, 176, 180], 0.35));
  far += poly(tops[0], mix([176, 150, 128], fogAt(mean(dists[0])) * 0.75));
  // vertical streaks down the far walls, and the jungle line along their tops
  { const T = tops[0]; for (let c = 1; c < T.length - 1; c += 2) { const p = T[c]; if (!p || p[1] > VH) continue; far += `<line x1="${p[0].toFixed(1)}" y1="${(p[1] + 3).toFixed(1)}" x2="${(p[0] + 2 - hash(c, 1) * 4).toFixed(1)}" y2="${(p[1] + 24 + 60 * hash(1, c)).toFixed(1)}" stroke="${hex(mix([120, 100, 86], 0.5))}" stroke-width="0.8"/>`; }
    const pts = T.filter(Boolean); if (pts.length > 2) far += `<polyline points="${fmt(pts.map(p => [p[0], p[1] + 2]))}" fill="none" stroke="${hex(mix([88, 120, 80], 0.45))}" stroke-width="4" stroke-linecap="round"/>`; }
  // a few big soft clouds, the after-rain sky clearing
  let clouds = '';
  { const R = rnd(31 + hi); for (let i = 0; i < 6; i++) { const cx = R() * VW, cy = 40 + R() * 180, w = 120 + R() * 220; for (let k = 0; k < 5; k++) clouds += `<ellipse cx="${(cx + (k - 2) * w * 0.32).toFixed(1)}" cy="${(cy - Math.sin(k / 4 * Math.PI) * w * 0.12).toFixed(1)}" rx="${(w * 0.32).toFixed(1)}" ry="${(w * 0.16).toFixed(1)}" fill="white" fill-opacity="0.75" stroke="#d8d2c4" stroke-opacity="0.6"/>`; } }
  const hz = cam.scr(cam.view([cam.pos[0] + cam.f[0] * 4000, cam.pos[1], cam.pos[2] + cam.f[2] * 4000]))[1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">` +
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe8ee"/><stop offset="${clamp(hz / VH * 0.75, 0.05, 0.9).toFixed(3)}" stop-color="#f2eedd"/><stop offset="${clamp(hz / VH, 0.06, 0.95).toFixed(3)}" stop-color="#f8ecd0"/><stop offset="1" stop-color="#f8ecd0"/></linearGradient></defs>` +
    `<rect width="${VW}" height="${VH}" fill="url(#sky)"/>` + clouds + far + polys.map(p => p.svg).join('') + lsvg +
    `<rect x="0.5" y="0.5" width="${VW - 1}" height="${VH - 1}" fill="none" stroke="#333" stroke-width="1"/></svg>`;
}

// the three views per hole: from the back tee, from the landing area (par 3: the forward tee), short of the green
export function viewsFor(hi) {
  const h = HOLES[hi], W = WOR[hi], g = (x, z) => worldAt(...W(x, z)).y;
  const eye = (p, toward, back = 4, up = 5) => {
    const dx = toward[0] - p[0], dz = toward[1] - p[1], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const x = p[0] - ux * back, z = p[1] - uz * back, y = Math.max(g(x, z), g(p[0], p[1])) + up;
    return [x, y, z];
  };
  const look = (p, toward, drop = 0) => { const yy = g(...toward); return [toward[0], yy + 1 - drop, toward[1]]; };
  const pin = h.pin, tee = h.teePts[BACK];
  const firstT = (h.targets || []).filter(t => !t.bold)[0] || { at: pin };
  const labelSet = [], here = LOC[hi];
  const L3 = (p, text, dy, up = 0.5) => ({ p: [p[0], g(...p) + up, p[1]], text, dy });
  for (const t of h.targets || []) labelSet.push(L3(t.at, t.name, -46));
  labelSet.push(L3(pin, 'green', -60));
  for (const f of h.forms || []) if (f.label) labelSet.push(L3(f.at, f.label, -36, f.h));
  if (h.strangler) labelSet.push(L3(h.strangler.trunk, 'the Strangler', -80, 40));
  if (h.spire) labelSet.push(L3(h.spire.at, 'the spire', -40, h.spire.h - 26));
  for (const [wp, t, up] of [[[TAR.c[0], TAR.c[1]], 'the tar pit', 1], [POOL.c, 'the plunge pool', 1], [[BLUFF.c[0], BLUFF.c[1]], 'the Bone Bluff', 34], [[690, -756], 'the creek', 2], [BACKCH.pond.c, 'the oxbow', 2], [[(BRIDGE.a[0] + BRIDGE.b[0]) / 2, (BRIDGE.a[1] + BRIDGE.b[1]) / 2], 'the rope bridge', 3],
    [[360, -580], 'the swamp', 1], [[455, -1200], 'the river', 1], [[520, -940], 'the river', 1], [[-120, -1180], 'the camp', 4], [[952, -694], 'Nest Falls', 30], [[808, -738], 'the lookout', 10], [[520, -1630], 'the Great Falls', 80]]) {
    const p = here(...wp), pr = project(h.line, ...p); if (pr.d < 300 && pr.s > -80 && pr.s < h.len + 120) labelSet.push(L3(p, t, -40, up));
  }
  // the herd and the hunter, labelled wherever they show
  labelSet.push(L3(here(120, -220), 'the herd', -34, 14), L3(here(-110, -280), 'the hunter', -34, 6), L3(here(460, -1205), 'long-necks wading', -34, 12), L3(here(890, -1270), 'the east herd', -34, 14));
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
