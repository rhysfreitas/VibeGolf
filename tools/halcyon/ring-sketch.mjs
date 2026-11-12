// Halcyon Ring: concept sketches of the ring through the game's fixed tee camera.
// For choosing the ring's radius before any hole is drawn (brief: "show Rhys a tee view sketch at two or
// three radii"). Plain shapes in ring space, projected through the stance camera (3.2 m behind the ball,
// 1.55 m up, 50° vertical fov, pitched so the view runs 19° above level to 31° below), painted far to near.
//
//   node tools/halcyon/ring-sketch.mjs            → out/ring-R<km>-<view>.svg and out/ring-sheet.png
//
// Ring space: a = across the ring (along its axis, metres from the centre line), s = along the ring
// (arc length from the camera, metres), h = height off the floor. The floor is the inside of a cylinder of
// radius R; seen from the camera the floor at arc angle φ sits at φ/2 above level, so nothing past
// φ = 38° (s = 0.66 R) shows in the tee view and the far side overhead never does.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
mkdirSync(OUT, { recursive: true });

const VW = 844, VH = 390;                  // the phone-landscape frame
const VFOV = 50 * Math.PI / 180;
const W = 1000;                            // floor width across the ring
const WALL = 320;                          // rim wall height (glazed above the terraces)
const EYE = 1.55, BACK = 3.2;
const PITCH = Math.atan2(EYE, BACK) - Math.atan(0.76 * Math.tan(VFOV / 2));

// ---------- small helpers ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y) => 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 7, y * 2.1 + 3) + 0.15 * vnoise(x * 4.3 + 1, y * 4.3 + 9);
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const mix = (c1, c2, t) => c1.map((v, i) => v + (c2[i] - v) * t);
const rgb = (c, a = 1) => a >= 1 ? `rgb(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')})` : `rgba(${c.map(v => Math.round(clamp(v, 0, 255))).join(',')},${a})`;

// ---------- the land (the same at every radius, laid out by arc length) ----------
// Terraces rise toward each rim wall (the villa terraces), the rest is parkland: fields, woods, lakes,
// a canal down the middle, floor windows.
const terraceH = a => 46 * smooth(330, 470, Math.abs(a));
const LAKES = [ { a: -150, s: 1500, ra: 170, rs: 420 }, { a: 220, s: 2600, ra: 160, rs: 520 }, { a: -40, s: -900, ra: 200, rs: 260 },
  { a: 160, s: 4300, ra: 180, rs: 600 }, { a: -200, s: 6200, ra: 150, rs: 700 } ];
// floor windows: [a0, a1, s0, s1] (the Great Window is the big one ahead of the across view)
function landUse(a, s, sample) {
  for (const w of sample.windows) if (a > w[0] && a < w[1] && s > w[2] && s < w[3]) return 'window';
  for (const L of LAKES) { const q = ((a - L.a) / L.ra) ** 2 + ((s - L.s) / L.rs) ** 2; if (q < 1 + 0.25 * (fbm(a / 90, s / 90) - 0.5)) return 'lake'; }
  if (Math.abs(a - 30 - 40 * Math.sin(s / 700)) < 9) return 'canal';
  if (Math.abs(a) > 330) return 'terrace';
  const n = fbm(a / 260 + 11, s / 260);
  if (n > 0.6) return 'wood';
  return n > 0.44 ? 'field2' : 'field';
}
const COL = {
  field: [150, 186, 104], field2: [128, 170, 92], wood: [64, 104, 58], lake: [92, 150, 182], canal: [88, 146, 178],
  terrace: [178, 196, 142], fair: [118, 190, 92], green: [96, 196, 90], sand: [236, 222, 176],
};
const HAZE = [214, 226, 236];

// ---------- camera ----------
function makeCam(pos, yaw) {           // yaw: the horizontal aim direction [dx, dz]
  const f = [yaw[0], 0, yaw[1]]; const n = Math.hypot(f[0], f[2]); f[0] /= n; f[2] /= n;
  const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  const fw = [f[0] * cp, -sp, f[2] * cp];
  const right = [-f[2], 0, f[0]];
  const up = [right[1] * fw[2] - right[2] * fw[1], right[2] * fw[0] - right[0] * fw[2], right[0] * fw[1] - right[1] * fw[0]];
  const fpx = (VH / 2) / Math.tan(VFOV / 2);
  return {
    pos, fw, right, up,
    proj(p) {
      const d = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
      const z = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2];
      if (z < 0.3) return null;
      const x = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
      const y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
      return [VW / 2 + fpx * x / z, VH / 2 - fpx * y / z, z];
    },
    toCam(p) {
      const d = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
      return [d[0] * right[0] + d[1] * right[1] + d[2] * right[2], d[0] * up[0] + d[1] * up[1] + d[2] * up[2], d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2]];
    },
    camToScreen(c) { return [VW / 2 + fpx * c[0] / c[2], VH / 2 - fpx * c[1] / c[2], c[2]]; },
    dirToScreen(v) {     // a direction at infinity
      const z = v[0] * fw[0] + v[1] * fw[1] + v[2] * fw[2]; if (z < 0.01) return null;
      const x = v[0] * right[0] + v[1] * right[1] + v[2] * right[2], y = v[0] * up[0] + v[1] * up[1] + v[2] * up[2];
      return [VW / 2 + fpx * x / z, VH / 2 - fpx * y / z];
    },
    fpx,
  };
}

// ring space → world (x = a, y up from the camera's floor point, −z along the ring)
const world = (R, a, s, h = 0) => { const phi = s / R, r = R - h; return [a, R - r * Math.cos(phi), -r * Math.sin(phi)]; };

// ---------- one view ----------
function render(R, view) {
  const polys = [];      // { pts (screen), depth, fill, stroke, sw }
  const sample = { windows: view.windows };
  const camA = view.camA, camS = 0;
  const camP = world(R, camA, camS, terraceH(camA) + EYE + (view.camH || 0));
  const cam = makeCam(camP, view.yaw);
  const push = (pts3, fill, extra = {}) => {
    let c = pts3.map(q => cam.toCam(q));
    const NEAR = 0.4;
    if (c.some(q => q[2] < NEAR)) {          // clip against the near plane
      const o = [];
      for (let i = 0; i < c.length; i++) {
        const A = c[i], B = c[(i + 1) % c.length], ia = A[2] >= NEAR, ib = B[2] >= NEAR;
        if (ia) o.push(A);
        if (ia !== ib) { const t = (NEAR - A[2]) / (B[2] - A[2]); o.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR]); }
      }
      if (o.length < 3) return; c = o;
    }
    const p = c.map(q => cam.camToScreen(q));
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    if (Math.max(...xs) < -40 || Math.min(...xs) > VW + 40 || Math.max(...ys) < -40 || Math.min(...ys) > VH + 40) return;
    const depth = extra.depth ?? p.reduce((m, q) => m + q[2], 0) / p.length;
    polys.push({ pts: p, depth, fill, ...extra });
  };
  const hazeT = d => 1 - Math.exp(-d / (view.hazeD || 2600));

  // floor cells: arc steps grow with distance from the camera
  const sSteps = []; { const half = []; let s = 0, ds = 5; while (s < Math.PI * R * 0.62) { half.push(s); s += ds; ds = Math.min(ds * 1.06, 160); }
    for (let i = half.length - 1; i > 0; i--) sSteps.push(-half[i]); sSteps.push(...half); }
  const aSteps = []; for (let a = -W / 2; a <= W / 2 + 0.1; a += 20) aSteps.push(a);
  const region = view.region;
  for (let i = 0; i + 1 < sSteps.length; i++) {
    const s0 = sSteps[i], s1 = sSteps[i + 1];
    if (region && (s1 < region.s0 || s0 > region.s1)) continue;
    for (let j = 0; j + 1 < aSteps.length; j++) {
      const a0 = aSteps[j], a1 = aSteps[j + 1];
      const am = (a0 + a1) / 2, sm = (s0 + s1) / 2;
      let use = landUse(am, sm, sample);
      const hole = view.hole && view.hole(am, sm);
      if (hole) use = hole;
      if (use === 'window') continue;          // a hole in the floor: space shows through
      let c = COL[use];
      if (use === 'field' || use === 'field2') c = mix(c, [170, 196, 120], 0.25 * vnoise(am / 40, sm / 40));
      if (use === 'terrace') c = mix(c, [236, 238, 230], 0.25 * vnoise(am / 30, sm / 30));
      const pts = [[a0, s0], [a1, s0], [a1, s1], [a0, s1]].map(([a, s]) => world(R, a, s, terraceH(a)));
      const mid = world(R, am, sm, terraceH(am));
      const d = Math.hypot(mid[0] - camP[0], mid[1] - camP[1], mid[2] - camP[2]);
      // light: the floor faces the axis; shade by the terrace slope a little
      const tilt = (terraceH(a1) - terraceH(a0)) / 20 * Math.sign(am);
      c = mix(c, [255, 255, 255], clamp(0.12 * tilt, 0, 0.12));
      push(pts, rgb(mix(c, HAZE, hazeT(d))), { stroke: rgb(mix(c, HAZE, hazeT(d))), sw: 0.6 });
    }
  }

  // floor windows: a frame round each, and the edge you look down past
  for (const w of view.windows) {
    if (region && (w[3] < region.s0 || w[2] > region.s1)) continue;
    const n = 24, ring = [];
    for (let k = 0; k <= n; k++) ring.push([w[0] + (w[1] - w[0]) * k / n, w[2]]);
    for (let k = 0; k <= n; k++) ring.push([w[1], w[2] + (w[3] - w[2]) * k / n]);
    for (let k = 0; k <= n; k++) ring.push([w[1] - (w[1] - w[0]) * k / n, w[3]]);
    for (let k = 0; k <= n; k++) ring.push([w[0], w[3] - (w[3] - w[2]) * k / n]);
    for (let k = 0; k + 1 < ring.length; k++) {
      const [a0, s0] = ring[k], [a1, s1] = ring[k + 1];
      const q = [world(R, a0, s0, 0.5), world(R, a1, s1, 0.5), world(R, a1, s1, -4), world(R, a0, s0, -4)];
      push(q, 'rgb(232,236,240)', { stroke: 'rgb(150,158,170)', sw: 0.6 });
    }
    // mullions across the glass, every 40 m, as thin lines just under the floor
    for (let a = w[0] + 40; a < w[1] - 1; a += 40) push([world(R, a - 0.6, w[2], -0.4), world(R, a + 0.6, w[2], -0.4), world(R, a + 0.6, w[3], -0.4), world(R, a - 0.6, w[3], -0.4)], 'rgba(200,210,225,0.55)', { depth: 1e9 - 1 });
  }

  // rim walls: glass from the top of the terraces up, a pale base, ribs every ~120 m of arc
  for (const side of [-1, 1]) {
    const a = side * W / 2;
    for (let i = 0; i + 1 < sSteps.length; i += 2) {
      const s0 = sSteps[i], s1 = sSteps[Math.min(i + 2, sSteps.length - 1)];
      if (region && (s1 < region.s0 || s0 > region.s1)) continue;
      const base = terraceH(a);
      const b0 = [world(R, a, s0, base), world(R, a, s1, base), world(R, a, s1, base + 14), world(R, a, s0, base + 14)];
      const mid = world(R, a, (s0 + s1) / 2, base + 7);
      const d = Math.hypot(mid[0] - camP[0], mid[1] - camP[1], mid[2] - camP[2]);
      push(b0, rgb(mix([226, 228, 222], HAZE, hazeT(d))));
      const g = [world(R, a, s0, base + 14), world(R, a, s1, base + 14), world(R, a, s1, WALL), world(R, a, s0, WALL)];
      push(g, `rgba(${Math.round(mix([40, 70, 110], HAZE, hazeT(d) * 0.8)[0])},${Math.round(mix([40, 70, 110], HAZE, hazeT(d) * 0.8)[1])},${Math.round(mix([40, 70, 110], HAZE, hazeT(d) * 0.8)[2])},${(0.18 + 0.55 * hazeT(d)).toFixed(2)})`);
    }
    // ribs
    for (let s = -Math.floor(Math.PI * R * 0.62 / 120) * 120; s < Math.PI * R * 0.62; s += 120) {
      if (region && (s < region.s0 || s > region.s1)) continue;
      const pts = [world(R, a, s - 2.5, terraceH(a)), world(R, a, s + 2.5, terraceH(a)), world(R, a, s + 2.5, WALL), world(R, a, s - 2.5, WALL)];
      const mid = world(R, a, s, 100); const d = Math.hypot(mid[0] - camP[0], mid[1] - camP[1], mid[2] - camP[2]);
      push(pts, rgb(mix([238, 240, 244], HAZE, hazeT(d) * 0.7)));
    }
    // horizontal mullions
    for (const hh of [80, 150, 230]) for (let i = 0; i + 1 < sSteps.length; i += 3) {
      const s0 = sSteps[i], s1 = sSteps[Math.min(i + 3, sSteps.length - 1)];
      if (region && (s1 < region.s0 || s0 > region.s1)) continue;
      const pts = [world(R, a, s0, hh - 1.2), world(R, a, s1, hh - 1.2), world(R, a, s1, hh + 1.2), world(R, a, s0, hh + 1.2)];
      const mid = world(R, a, s0, hh); const d = Math.hypot(mid[0] - camP[0], mid[1] - camP[1], mid[2] - camP[2]);
      push(pts, rgb(mix([230, 234, 240], HAZE, hazeT(d) * 0.7)), { depth: d - 1 });
    }
  }

  // the spoke: an A-frame foot astride the centre line, then one shaft to the hub
  if (view.spokeS !== undefined) {
    const sS = view.spokeS;
    const shaft = (a0, a1, h0, h1, w0, w1) => {
      const n = 14;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const A0 = a0 + (a1 - a0) * t0, A1 = a0 + (a1 - a0) * t1, H0 = h0 + (h1 - h0) * t0, H1 = h0 + (h1 - h0) * t1;
        const w0k = w0 + (w1 - w0) * t0, w1k = w0 + (w1 - w0) * t1;
        for (const face of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {   // four faces of a square leg, along s
          const [u, v] = face;
          const q = [world(R, A0 - w0k / 2, sS + u * w0k / 2, H0), world(R, A0 + w0k / 2, sS + u * w0k / 2, H0), world(R, A1 + w1k / 2, sS + u * w1k / 2, H1), world(R, A1 - w1k / 2, sS + u * w1k / 2, H1)];
          const mid = world(R, (A0 + A1) / 2, sS, (H0 + H1) / 2);
          const d = Math.hypot(mid[0] - camP[0], mid[1] - camP[1], mid[2] - camP[2]);
          push(q, rgb(mix(u < 0 ? [222, 226, 232] : [192, 198, 208], HAZE, hazeT(d) * 0.75)), { stroke: rgb(mix([150, 158, 172], HAZE, hazeT(d) * 0.7)), sw: 0.5 });
        }
      }
    };
    shaft(-170, -10, 0, 260, 34, 22); shaft(170, 10, 0, 260, 34, 22);
    shaft(0, 0, 250, R * 0.98, 30, 18);
  }

  // trees in the woods near enough to read, and villas on the terraces
  const r = rng(7);
  const items = [];
  for (let k = 0; k < 9000; k++) {
    const a = (r() - 0.5) * (W - 40), s = (r() - 0.5) * 2 * (view.itemS || 1800);
    if (view.keepOff && view.keepOff(a, s)) continue;
    if (region && (s < region.s0 || s > region.s1)) continue;
    const use = view.hole && view.hole(a, s) ? 'hole' : landUse(a, s, sample);
    if (use === 'wood' || ((use === 'field' || use === 'field2') && r() < 0.03)) items.push({ kind: 'tree', a, s });
    else if (use === 'terrace' && r() < 0.06) items.push({ kind: 'villa', a, s, rot: r() });
  }
  for (const it of items) {
    const h0 = terraceH(it.a);
    const base = world(R, it.a, it.s, h0);
    const d = Math.hypot(base[0] - camP[0], base[1] - camP[1], base[2] - camP[2]);
    if (it.kind === 'tree') {
      const top = cam.proj(world(R, it.a, it.s, h0 + 14)), foot = cam.proj(base);
      if (!top || !foot) continue;
      const rad = Math.max(0.6, (foot[1] - top[1]) * 0.45);
      polys.push({ circle: [top[0], top[1] + rad * 0.7, rad], depth: d, fill: rgb(mix([52, 92, 50], HAZE, hazeT(d))) });
    } else {
      const ww = 26, dd = 16, hh = 9;
      const corners = (h) => [[-ww / 2, -dd / 2], [ww / 2, -dd / 2], [ww / 2, dd / 2], [-ww / 2, dd / 2]].map(([u, v]) => world(R, it.a + u, it.s + v, h0 + h));
      const lo = corners(0), hi = corners(hh);
      const c = mix([250, 250, 246], HAZE, hazeT(d) * 0.8), cs = mix([206, 210, 214], HAZE, hazeT(d) * 0.8);
      const sideToCam = Math.sign(camP[0] - it.a) > 0 ? [1, 2] : [3, 0];
      push([lo[sideToCam[0]], lo[sideToCam[1]], hi[sideToCam[1]], hi[sideToCam[0]]], rgb(cs), { depth: d });
      push([lo[0], lo[1], hi[1], hi[0]], rgb(c), { depth: d - 0.5 });
      push(hi, rgb(mix([240, 240, 236], HAZE, hazeT(d) * 0.8)), { depth: d - 1, stroke: rgb(cs), sw: 0.4 });
    }
  }
  // the flag on the sample green
  if (view.flag) {
    const [fa, fs] = view.flag, h0 = terraceH(fa);
    const b = cam.proj(world(R, fa, fs, h0)), t = cam.proj(world(R, fa, fs, h0 + 2.4));
    if (b && t) polys.push({ line: [b, t], depth: b[2] - 1, stroke: 'rgb(40,40,40)', sw: 1.2, flag: t });
  }

  // ---------- draw ----------
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">`);
  out.push(`<defs><clipPath id="c"><rect width="${VW}" height="${VH}"/></clipPath>`
    + `<radialGradient id="earth" cx="0.42" cy="0.38" r="0.7"><stop offset="0" stop-color="#5d9ed6"/><stop offset="0.55" stop-color="#2f6aa8"/><stop offset="0.9" stop-color="#173f75"/><stop offset="1" stop-color="#0c2448"/></radialGradient></defs>`);
  out.push(`<g clip-path="url(#c)"><rect width="${VW}" height="${VH}" fill="#05070d"/>`);
  // stars (a fixed sphere of them)
  const sr = rng(3);
  for (let k = 0; k < 2600; k++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, q = Math.sqrt(1 - z * z);
    const p = cam.dirToScreen([q * Math.cos(t), z, q * Math.sin(t)]);
    if (p && p[0] > 0 && p[0] < VW && p[1] > 0 && p[1] < VH) out.push(`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(0.3 + sr() * 0.7).toFixed(2)}" fill="#fff" opacity="${(0.35 + sr() * 0.6).toFixed(2)}"/>`);
  }
  // Earth, a big disc at infinity
  if (view.earth) {
    const [ex, ey, ez] = view.earth.dir, n = Math.hypot(ex, ey, ez); const e = [ex / n, ey / n, ez / n];
    const c = cam.dirToScreen(e);
    if (c) {
      const rr = cam.fpx * Math.tan(view.earth.r * Math.PI / 180);
      out.push(`<circle cx="${c[0]}" cy="${c[1]}" r="${rr + 6}" fill="#7fb6ff" opacity="0.25"/><circle cx="${c[0]}" cy="${c[1]}" r="${rr}" fill="url(#earth)"/>`);
      const er = rng(11);
      for (let k = 0; k < 40; k++) { const ang = er() * 6.28, rad = er() * rr * 0.9; out.push(`<ellipse cx="${(c[0] + Math.cos(ang) * rad).toFixed(1)}" cy="${(c[1] + Math.sin(ang) * rad).toFixed(1)}" rx="${(rr * (0.05 + er() * 0.14)).toFixed(1)}" ry="${(rr * (0.02 + er() * 0.05)).toFixed(1)}" fill="#fff" opacity="${(0.25 + er() * 0.4).toFixed(2)}"/>`); }
    }
  }
  polys.sort((p, q) => q.depth - p.depth);
  for (const p of polys) {
    if (p.circle) { out.push(`<circle cx="${p.circle[0].toFixed(1)}" cy="${p.circle[1].toFixed(1)}" r="${p.circle[2].toFixed(1)}" fill="${p.fill}"/>`); continue; }
    if (p.line) {
      out.push(`<line x1="${p.line[0][0].toFixed(1)}" y1="${p.line[0][1].toFixed(1)}" x2="${p.line[1][0].toFixed(1)}" y2="${p.line[1][1].toFixed(1)}" stroke="${p.stroke}" stroke-width="${p.sw}"/>`);
      const f = p.flag; out.push(`<path d="M${f[0]},${f[1]} l7,2.5 l-7,2.5 z" fill="#e8463c"/>`); continue;
    }
    const d = p.pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('') + 'Z';
    out.push(`<path d="${d}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.sw}"` : ''}/>`);
  }
  // the label
  out.push(`<rect x="8" y="8" width="${view.label.length * 6.6 + 16}" height="22" rx="4" fill="#fff" opacity="0.92"/><text x="16" y="23" font-family="Helvetica,Arial,sans-serif" font-size="12" fill="#222">${view.label}</text>`);
  out.push(`</g></svg>`);
  return out.join('\n');
}

// ---------- the views ----------
// 1. Across the ring: a 400 yd par 4 from a tee near the west rim, running east over the floor toward the
//    far rim's glass (level along the line at any radius). The Great Window crosses it short of the green.
// 2. Up the curve: a 160 yd par 3 played along the ring from the centre line, the spoke's foot beyond.
const fairway = (a, s) => {
  // a sample par 4 down +a from a = −360 (tee) to the green at a ≈ +5 (366 m)
  const along = a + 300, off = s;
  if (along > -30 && along < 45 && Math.abs(off) < 45) return Math.abs(off) < 7 && along < 8 ? 'fair' : 'field';   // the tee and the rough in front of it
  if (along > 40 && along < 330) { const half = 24 + 8 * Math.sin(along / 60); if (Math.abs(off - 6 * Math.sin(along / 90)) < half) return 'fair'; }
  if (Math.hypot((along - 366) / 18, off / 14) < 1) return 'green';
  if (Math.hypot((along - 240) / 14, (off - 28) / 9) < 1) return 'sand';
  if (Math.hypot((along - 352) / 7, (off + 16) / 6) < 1) return 'sand';
  return null;
};
const par3 = (a, s) => {
  if (Math.hypot((a - 4) / 15, (s - 148) / 18) < 1) return 'green';
  if (Math.hypot((a + 20) / 7, (s - 140) / 6) < 1) return 'sand';
  return null;
};
const VIEWS = (R) => [
  { id: 'across', label: `R = ${R / 1000} km · across the ring (a par 4, level along the line)`, camA: -300, yaw: [1, 0], hole: fairway,
    windows: [[-170, -105, -90, 70], [90, 210, 1300, 1700]], earth: { dir: [1, 0.13, 0.42], r: 30 }, keepOff: (a, s) => a < 60 && Math.abs(s) < 70, flag: [6, 0], spokeS: Math.min(1100, R * 0.33),
    hazeD: 2600 },
  { id: 'along', label: `R = ${R / 1000} km · up the curve (a 160 yd par 3 across a floor window)`, camA: 0, yaw: [0, -1], hole: par3,
    windows: [[-70, 70, 60, 120], [90, 210, 1300, 1700]], earth: { dir: [1, 0.05, -0.2], r: 30 }, keepOff: (a, s) => Math.abs(a) < 60 && s > -20 && s < 180, flag: [4, 148], spokeS: Math.min(1100, R * 0.33),
    hazeD: 2600 },
];

const RADII = [1500, 3000, 5000];
const files = [];
for (const R of RADII) for (const v of VIEWS(R)) {
  const f = join(OUT, `ring-R${R / 1000}-${v.id}.svg`);
  writeFileSync(f, render(R, v)); files.push(f);
  console.log('wrote', f);
}
// the Great Window from a tee on the floor and from a tee raised 14 m on a terrace (R = 3 km)
const bigWin = (a, s) => Math.hypot((a - 4) / 17, (s - 196) / 19) < 1 ? 'green' : null;
const WIN = [[-75, 75, 45, 170], [90, 210, 1300, 1700]];
for (const [id, camH, label] of [['win-floor', 0, 'R = 3 km · the Great Window from a tee on the floor'], ['win-raised', 14, 'R = 3 km · the same window from a tee raised 14 m']]) {
  const f = join(OUT, `ring-${id}.svg`);
  writeFileSync(f, render(3000, { id, label, camA: 0, camH, yaw: [0, -1], hole: bigWin, windows: WIN, earth: { dir: [0.25, -0.55, -1], r: 26 }, flag: [4, 196], spokeS: 1000, hazeD: 2600,
    keepOff: (a, s) => Math.abs(a) < 70 && s > -20 && s < 230 })); files.push(f);
}
// rising ground at each radius, for the sheet's notes
for (const R of RADII) {
  const rise = d => (d * d / (2 * R)).toFixed(1), slope = d => (100 * d / R).toFixed(0);
  console.log(`R ${R / 1000} km: up the curve 150 m → ${rise(150)} m (${slope(150)}%), 300 m → ${rise(300)} m (${slope(300)}%); `
    + `spin ${(2 * Math.PI * Math.sqrt(R / 9.81)).toFixed(0)} s a turn; across a 60 m fairway the floor dishes ${(30 * 30 / (2 * R)).toFixed(2)} m`);
}
// a contact sheet: two columns (across, along), a row per radius
try {
  const pngs = files.map(f => { const p = f.replace(/\.svg$/, '.png'); execSync(`rsvg-convert -w 1266 -o "${p}" "${f}"`); return p; });
  const rows = [];
  for (let i = 0; i < files.length / 2; i++) {
    const row = join(OUT, `row${i}.png`);
    execSync(`convert "${pngs[2 * i]}" "${pngs[2 * i + 1]}" -bordercolor white -border 8 +append "${row}"`); rows.push(row);
  }
  execSync(`convert ${rows.map(r => `"${r}"`).join(' ')} -background white -append -bordercolor white -border 8 "${join(OUT, 'ring-sheet.png')}"`);
  console.log('wrote', join(OUT, 'ring-sheet.png'));
} catch (e) { console.log('sheet skipped:', e.message); }
