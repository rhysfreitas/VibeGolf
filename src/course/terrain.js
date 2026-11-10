// Course terrain: ground height, surfaces and rock for one hole. Pure (no DOM, no Three.js), so the
// physics, the renderer and the tests all read the same shapes.
//
// A hole is built from islands (superellipse tops; the Aerie's floating rocks, Red Mesa's mesas),
// an optional canyon floor under them, painted fairways and sand, and rock you can hit (arches and
// hoodoos). groundAt(x, z) is the highest top under a point, else the floor, else null (open air).

import { hash2, vnoise, fbm, rng, sstep } from './noise.js';
import { prepFeatures } from './features.js';
import { groveTrees } from './trees.js';
import { createCave } from './cave.js';
export { hash2, vnoise, fbm, rng, sstep };

/* ---------- islands ---------- */
// Optional fields beyond the Aerie's: p (squareness, default 2.4), slope { from:[x,z,y], to:[x,z,y] }
// (a ramp: the top runs from one height to the other, held level past either end), relief (bumps, m).
const MESA_KINDS = new Set(['mesa', 'rock']);
export function prepIsland(I) {
  I.rot = I.rot || 0; I.c = Math.cos(I.rot); I.s = Math.sin(I.rot); I.p = I.p || 2.4;
  I.bound = Math.max(I.rx, I.rz) * 1.25;
  const sd = I.seed * 1.7;
  I.wob = th => 1 + 0.06 * Math.sin(3 * th + sd) + 0.04 * Math.sin(7 * th + 2 * sd) + 0.022 * Math.sin(13 * th + 3 * sd);
  if (I.slope) {
    const [ax, az, ay] = I.slope.from, [bx, bz, by] = I.slope.to, L2 = (bx - ax) ** 2 + (bz - az) ** 2;
    I.slopeAt = (x, z) => { const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / L2)); return ay + (by - ay) * t; };
  }
  return I;
}
export function islandF(I, x, z) { // <= 1 inside
  const dx = x - I.x, dz = z - I.z;
  const u = dx * I.c + dz * I.s, v = -dx * I.s + dz * I.c;
  const rho = Math.pow(Math.pow(Math.abs(u) / I.rx, I.p) + Math.pow(Math.abs(v) / I.rz, I.p), 1 / I.p);
  return rho / I.wob(Math.atan2(v / I.rz, u / I.rx));
}
export function edgeRadius(I, th) { // world-space point on the rim along local angle th
  const cu = Math.cos(th), sv = Math.sin(th);
  const r = 1 / Math.pow(Math.pow(Math.abs(cu) / I.rx, I.p) + Math.pow(Math.abs(sv) / I.rz, I.p), 1 / I.p);
  const w = I.wob(Math.atan2(sv * r / I.rz, cu * r / I.rx));
  const u = cu * r * w, v = sv * r * w;
  return { x: I.x + u * I.c - v * I.s, z: I.z + u * I.s + v * I.c };
}
export function islandH(I, x, z, f) {
  let h = I.slopeAt ? I.slopeAt(x, z) : I.top;
  if (MESA_KINDS.has(I.kind)) {
    // mesa tops: gentle bumps in world space, so neighbouring pieces at one height meet cleanly
    const rel = I.relief ?? 1.2;
    let bump = rel * (fbm(x / 34 + 40, z / 34 + 40) - 0.5);
    if (I.green) {
      const g = I.green, d = Math.hypot(x - g.x, z - g.z);
      const gs = 0.3 * (fbm(x / 40 + I.seed, z / 40) - 0.5) + 0.012 * (z - g.z) - 0.008 * (x - g.x);
      bump = bump + (gs - bump) * (1 - sstep(g.r + 3, g.r + 16, d));
      bump += 0.5 * sstep(g.r + 1, g.r + 7, d) * (1 - sstep(g.r + 9, g.r + 16, d)) * (fbm(x / 9, z / 9 + I.seed) - 0.3);
    }
    h += bump;
    if (f > 0.96) h -= Math.pow((f - 0.96) / 0.04, 2) * 0.5; // a crisp rim
    return h;
  }
  if (I.kind === 'green') {
    const g = I.green, d = Math.hypot(x - g.x, z - g.z);
    h += 0.35 * (fbm(x / 40 + I.seed, z / 40) - 0.5) + 0.012 * (z - g.z) - 0.008 * (x - g.x);
    h += 0.6 * sstep(g.r + 1, g.r + 7, d) * (fbm(x / 9, z / 9 + I.seed) - 0.35);
  } else if (I.kind === 'tee') {
    h += 0.15 * (fbm(x / 20, z / 20) - 0.5);
  } else {
    h += (I.relief ?? 1.4) * (fbm(x / 32 + I.seed * 3, z / 32) - 0.5);
  }
  if (f > 0.9) h -= Math.pow((f - 0.9) / 0.1, 2) * (I.lip ?? 0.9); // rounded lip
  return h;
}

/* ---------- paint: fairways and washes are polylines with a half-width per point ---------- */
// pts: [[x, z, halfWidth?] | [x, z, left, right], ...] (left/right as you play along the points);
// returns the signed distance to the band's edge (negative inside)
export function bandDist(pts, hw0, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1], [ax, az] = A, [bx, bz] = B;
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
    const right = (x - ax) * -dz + (z - az) * dx > 0; // right of the direction of play
    const wA = A.length > 3 ? (right ? A[3] : A[2]) : A[2] ?? hw0, wB = B.length > 3 ? (right ? B[3] : B[2]) : B[2] ?? hw0;
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - (wA + (wB - wA) * t);
    if (d < best) best = d;
  }
  return best;
}
const wobble = (x, z, k) => 1 + 0.5 * (vnoise(x / 23 + k, z / 23 - k) - 0.5);
// a wash: a dry sandy channel pressed into the floor
const WASH_DEPTH = 1.1;

/* ---------- rock you can hit ---------- */
// arch:   { type:'arch', x, z, rot, w, h, t, d, y? } span axis along rot (0 = along x), opening w wide
//         and h tall above its base, a band of rock t thick and d deep (front to back); crown (thickness at the
//         top as a share of t, default 0.85), flare (m the legs widen at the foot) up to fh (default half its height)
// hoodoo: { type:'hoodoo', x, z, r, h, cap, y? } a column r in radius, h tall, with a cap
// boulder: { type:'boulder', x, z, r, h, rot, pe?, y? } a lump r in radius (0.85 r front to back), h tall,
//         sunk a little into the ground; pe > 2 squares it off into a block (a superellipsoid)
export function prepRock(R, groundAt) {
  R.c = Math.cos(R.rot || 0); R.s = Math.sin(R.rot || 0);
  if (R.y == null) R.y = (groundAt(R.x, R.z) ?? 0) - 0.5;
  if (R.type === 'arch') {
    R.ai = R.w / 2; R.bi = R.h; R.ao = R.ai + R.t; R.bo = R.bi + R.t * (R.crown ?? 0.85);
    R.flare = R.flare || 0; R.fh = R.fh ?? R.bo * 0.5;
    R.bound = R.ao + R.flare + R.d;
  } else if (R.type === 'hoodoo') {
    R.seed = R.seed ?? (R.x * 13.1 + R.z * 7.7);
    R.capH = (R.cap ?? R.r * 1.5) * 0.75; R.capR = R.cap ?? R.r * 1.5;
    R.bound = Math.max(R.capR, R.r * 1.6) + 1;
  } else if (R.type === 'wedge') { // a tapering prism along an axis (see wedgeParts)
    const [ax, az, ay] = R.from, [bx, bz, by] = R.to, L = Math.hypot(bx - ax, by - ay, bz - az);
    R.A = [ax, ay, az]; R.len = L; R.T = [(bx - ax) / L, (by - ay) / L, (bz - az) / L];
    let S = [-R.T[2], 0, R.T[0]]; const sl = Math.hypot(S[0], S[2]); S = sl < 1e-3 ? [1, 0, 0] : [S[0] / sl, 0, S[2] / sl];
    R.S = S; R.U = [S[1] * R.T[2] - S[2] * R.T[1], S[2] * R.T[0] - S[0] * R.T[2], S[0] * R.T[1] - S[1] * R.T[0]];
    if (R.U[1] < 0) R.U = R.U.map(v => -v);
    R.x = (ax + bx) / 2; R.z = (az + bz) / 2; R.y = 0; R.bound = L / 2 + Math.max(R.w[0], R.h[0]) + 4;
    return R;
  } else if (R.type === 'float') { // a floating island: a top at I.top, the underside tapering down depth
    R.x = R.I.x; R.z = R.I.z; R.y = 0; R.bound = R.I.bound + 2;
    return R;
  } else if (R.type === 'box') { // a block (a building, a car): w across, d deep, h tall from its base y
    R.bound = Math.hypot(R.w, R.d) / 2 + 0.5;
  } else if (R.type === 'boulder') {
    R.seed = R.seed ?? (R.x * 3.1 + R.z * 1.7);
    R.a = R.r; R.b = R.r * (R.ratio ?? 0.85); R.hc = R.h / 2; R.cy = R.h * 0.42; R.pe = R.pe ?? 2; // centre above the base
    R.bound = Math.max(R.a, R.b) + 0.5;
  }
  return R;
}
// a wedge of rock and, with drop, the buttress carrying it down the island's side under its root:
// [{ from, to, w, h }] ([x, z, y] ends), shared by the physics and the renderer
export function wedgeParts(m) {
  const out = [{ from: m.from, to: m.to, w: m.w, h: m.h }];
  if (m.drop) {
    const [ax, az, ay] = m.from, [bx, bz, by] = m.to, L = Math.hypot(bx - ax, by - ay, bz - az), T = [(bx - ax) / L, (by - ay) / L, (bz - az) / L];
    const k = Math.min(14, L * 0.2), top = [ax + T[0] * k, az + T[2] * k, ay + T[1] * k];
    out.push({ from: top, to: [top[0] - T[0] * 4, top[1] - T[2] * 4, top[2] - m.drop], w: [m.w[0] * 0.8, m.w[0] * 0.25], h: [m.h[0] * 1.1, m.h[0] * 0.4] });
  }
  return out;
}
// where a drifting island sits at u (0..1 along its path)
// the ore cart: its size, and a route it runs along (s: metres from the start)
export const CART = { l: 2.6, w: 1.5, h: 1.5 };
export function makeCart(route) {
  const seg = []; let L = 0;
  for (let k = 0; k < route.length - 1; k++) { const [ax, az] = route[k], [bx, bz] = route[k + 1], l = Math.hypot(bx - ax, bz - az); seg.push({ ax, az, bx, bz, l, s0: L }); L += l; }
  const at = s => { s = Math.max(0, Math.min(L, s)); const g = seg.find(q => s <= q.s0 + q.l) || seg[seg.length - 1], t = (s - g.s0) / g.l;
    return { x: g.ax + (g.bx - g.ax) * t, z: g.az + (g.bz - g.az) * t, yaw: Math.atan2(g.bz - g.az, g.bx - g.ax) }; };
  const C = { length: L, s: L * 0.35, at, pose: () => at(C.s),
    // roll on 25 to 60 m, turning back at either end of the line
    next(rand = Math.random) { const d = 25 + rand() * 35; let n = C.s + (C.dir || 1) * d; if (n > L || n < 0) { C.dir = -(C.dir || 1); n = C.s + C.dir * d; } C.from = C.s; C.s = Math.max(0, Math.min(L, n)); return C.s; } };
  return C;
}

export function driftTo(R, u) {
  const [a, b] = R.path; R.u = u;
  R.I.x = R.x = a[0] + (b[0] - a[0]) * u; R.I.z = R.z = a[1] + (b[1] - a[1]) * u;
}
// an arch's outer half-width at height v above its base: the legs flare out toward the foot (shared with the mesh)
export function archOuterA(R, v) { return R.ao + (R.flare || 0) * Math.pow(Math.max(0, 1 - Math.max(0, v) / R.fh), 2); }
// radius of a hoodoo column at height v above its base (shared with the mesh)
export function hoodooR(R, v) {
  const t = v / R.h;
  if (R.column) return R.r * (1 + 1.4 * Math.pow(Math.abs(2 * Math.min(1, v / R.h) - 1), 3)) * (1 + 0.08 * Math.sin(v * 0.7 + R.seed)); // floor to roof: flared at both ends
  if (R.taper) return R.r * (1 + 0.6 * Math.pow(Math.max(0, 1 - v / 3), 2)) * (1 + 0.07 * Math.sin(v * 1.3 + R.seed)) * Math.max(0.1, 1 - 0.9 * t); // a stalagmite: a tapering cone
  const flare = 1 + 0.9 * Math.pow(Math.max(0, 1 - v / 4), 2);                // talus at the foot
  const bands = 1 + 0.14 * Math.sin(v * 0.9 + R.seed) + 0.08 * Math.sin(v * 2.3 + R.seed * 2);
  const neck = 1 - 0.28 * sstep(0.7, 0.92, t);                                  // pinches under the cap
  return R.r * flare * bands * neck;
}
export function rockNormal(R, x, y, z) {
  const dx = x - R.x, dz = z - R.z;
  if (Math.abs(dx) > R.bound || Math.abs(dz) > R.bound) return null;
  const v = y - R.y;
  if (R.type === 'arch') {
    const u = dx * R.c + dz * R.s, w = -dx * R.s + dz * R.c;
    if (Math.abs(w) > R.d / 2 || v < 0) return null;
    const aoV = archOuterA(R, v), ein = (u / R.ai) ** 2 + (v / R.bi) ** 2, eout = (u / aoV) ** 2 + (v / R.bo) ** 2;
    if (eout >= 1 || ein <= 1) return null;
    const pIn = (Math.sqrt(ein) - 1) * Math.min(R.ai, R.bi), pOut = (1 - Math.sqrt(eout)) * Math.min(aoV, R.bo), pFace = R.d / 2 - Math.abs(w);
    let nu, nv, nw = 0;
    if (pFace < pIn && pFace < pOut) { nu = 0; nv = 0; nw = Math.sign(w) || 1; }
    else if (pIn < pOut) { nu = -u / (R.ai * R.ai); nv = -v / (R.bi * R.bi); }
    else { nu = u / (aoV * aoV); nv = v / (R.bo * R.bo); }
    const L = Math.hypot(nu, nv, nw) || 1; nu /= L; nv /= L; nw /= L;
    return [nu * R.c - nw * R.s, nv, nu * R.s + nw * R.c];
  }
  if (R.type === 'hoodoo') {
    if (v < 0 || v > R.h + R.capH * 0.5) return null;
    const rho = Math.hypot(dx, dz) || 1e-6;
    const cy = R.h - R.capH * 0.5, ev = (v - cy) / (R.capH * 0.6), er = rho / R.capR;
    if (er * er + ev * ev < 1) { // the cap: shed the ball off its rounded top and edges
      const nx = dx / rho * er, nz = dz / rho * er, ny = Math.max(ev, 0.2), L = Math.hypot(nx, ny, nz);
      return [nx / L, ny / L, nz / L];
    }
    if (v < R.h - R.capH && rho < hoodooR(R, v)) return [dx / rho, 0.08, dz / rho];
    return null;
  }
  if (R.type === 'wedge') {
    const p = [x - R.A[0], y - R.A[1], z - R.A[2]], t = p[0] * R.T[0] + p[1] * R.T[1] + p[2] * R.T[2];
    if (t < -4 || t > R.len + 1) return null;
    const f = Math.min(1, Math.max(0, t / R.len)), hw = (R.w[0] + (R.w[1] - R.w[0]) * f) / 2, hh = (R.h[0] + (R.h[1] - R.h[0]) * f) / 2;
    const a = p[0] * R.S[0] + p[1] * R.S[1] + p[2] * R.S[2], b = p[0] * R.U[0] + p[1] * R.U[1] + p[2] * R.U[2];
    if (Math.abs(a) > hw || Math.abs(b) > hh) return null;
    const da = hw - Math.abs(a), db = hh - Math.abs(b), dt = R.len + 1 - t; // the nearest face pushes it out
    const n = db <= da && db <= dt ? R.U.map(v => v * Math.sign(b || 1)) : da <= dt ? R.S.map(v => v * Math.sign(a || 1)) : R.T;
    return n;
  }
  if (R.type === 'float') {
    const I = R.I, D = R.depth, d = I.top - y;
    if (d < -0.5 || d > D) return null;
    const f = islandF(I, x, z), lim = Math.pow(Math.max(0, 1 - Math.max(0, d) / D), 0.75);
    if (f > lim) return null;
    if (d < 1.5) return [0, 1, 0]; // on the top
    const ex = dx / I.rx, ez = dz / I.rz, L = Math.hypot(ex, ez, 0.6) || 1;
    return [ex / L, -0.6 / L, ez / L]; // the underside: out and down
  }
  if (R.type === 'box') {
    if (v < 0 || v > R.h) return null;
    const u = dx * R.c + dz * R.s, w = -dx * R.s + dz * R.c, ou = R.w / 2 - Math.abs(u), ow = R.d / 2 - Math.abs(w), ot = R.h - v;
    if (ou < 0 || ow < 0) return null;
    // the nearest face pushes it out; facades can soak a ball up (it drops at the foot), as cave walls do
    const n = ot < ou && ot < ow ? [0, 1, 0] : ou < ow ? [Math.sign(u) * R.c, 0, Math.sign(u) * R.s] : [-Math.sign(w) * R.s, 0, Math.sign(w) * R.c];
    if (R.soak && n[1] === 0) n.soak = R.soak;
    return n;
  }
  if (R.type === 'boulder') {
    const u = dx * R.c + dz * R.s, w = -dx * R.s + dz * R.c, h = v - R.cy;
    const qu = Math.abs(u / R.a), qw = Math.abs(w / R.b), qh = Math.abs(h / R.hc), e = R.pe;
    if (qu ** e + qw ** e + qh ** e >= 1) return null;
    const nu = Math.sign(u) * qu ** (e - 1) / R.a, nw = Math.sign(w) * qw ** (e - 1) / R.b, nh = Math.sign(h) * qh ** (e - 1) / R.hc, L = Math.hypot(nu, nw, nh) || 1;
    return [(nu * R.c - nw * R.s) / L, nh / L, (nu * R.s + nw * R.c) / L];
  }
  return null;
}

/* ---------- the hole ---------- */
// hole.floor: { y, relief, solid (false = scenery only, open air for the ball), washes:[{pts, w}],
//               gorges:[{x, z, rx, rz, rot}] (no floor) }
// hole.fairways: [{ pts:[[x,z,hw]...], hw }] painted fairway on any ground; hole.sand: [[x,z,r]...]
// hole.tees: { setId: [x, z] | {x, z, w, l, h, rot} }, hole.teePads: { setId: {w, l, h} } (a bigger or
// higher pad for an [x, z] tee); hole.rocks: arches, hoodoos and boulders; hole.rockfalls: piles of
// fallen rock (features.js) with boulders scattered over them; hole.groves: stands of trees (trees.js)
// hole.green, bunkers, landforms, water: shaped features (features.js)
// hole.corridor (m either side of the line kept as rough; default 32), hole.native ([from, to] metres
// along the line that stay native desert: the carry from the back tee), hole.roughW (rough beyond the
// fairway's first cut, default 12)

// distance along a polyline and sideways from it
export function lineProj(L, x, z) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, len = Math.sqrt(L2);
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { d, s: acc + t * len };
    acc += len;
  }
  return best;
}
// hole.field: ground sampled on a grid (a course generated from plan data, like The Reclaim): { x0, z0, cell,
// nx, nz, h (heights, NaN = open air), s (surface codes), codes (names) }. Outside the grid the edge carries on.
export function prepField(F) {
  if (F.ready) return F;
  const dec = (b64, T) => { const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
  if (typeof F.h === 'string') { const q = dec(F.h, Int16Array); F.h = Float32Array.from(q, v => (v === -32768 ? NaN : v / 50 + F.y0)); }
  if (typeof F.s === 'string') F.s = dec(F.s, Uint8Array);
  F.ready = true;
  return F;
}
function fieldAt(F, x, z) {
  const fx = Math.min(F.nx - 1.001, Math.max(0, (x - F.x0) / F.cell)), fz = Math.min(F.nz - 1.001, Math.max(0, (z - F.z0) / F.cell));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * F.nx + i;
  const a = F.h[k], b = F.h[k + 1], c = F.h[k + F.nx], d = F.h[k + F.nx + 1];
  const near = u < 0.5 ? (v < 0.5 ? a : c) : (v < 0.5 ? b : d);
  if (Number.isNaN(near)) return null;                       // open air (a rift, a sinkhole)
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) return near;
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fieldSurf(F, x, z) {
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  return F.codes[F.s[Math.min(F.nz - 1, Math.max(0, j)) * F.nx + Math.min(F.nx - 1, Math.max(0, i))]];
}
export function createTerrain(hole) {
  const FLD = hole.field ? prepField(hole.field) : null;
  const ISL = (hole.islands || []).map(I => prepIsland({ ...I, playable: true }));
  const F = hole.floor ? { relief: 1.6, solid: true, washes: [], gorges: [], ...hole.floor } : null;
  if (F) F.gorges = F.gorges.map((g, i) => prepIsland({ seed: 50 + i, ...g, top: F.y, kind: 'gorge' }));
  const fairways = hole.fairways || [];
  const sand = hole.sand || [];
  const teeEntries = Object.entries(hole.tees || (hole.tee ? { tee: hole.tee } : {}));

  const fairwayD = (x, z) => { let d = Infinity; for (const fw of fairways) d = Math.min(d, bandDist(fw.pts, fw.hw ?? 16, x, z) / wobble(x, z, 3)); return d; };
  const washD = (x, z) => { let d = Infinity; if (F) for (const w of F.washes) d = Math.min(d, bandDist(w.pts, w.w / 2, x, z) / wobble(x, z, 7)); return d; };
  const inGorge = (x, z) => { if (F) for (const g of F.gorges) if (Math.abs(x - g.x) < g.bound && Math.abs(z - g.z) < g.bound && islandF(g, x, z) <= 1) return true; return false; };

  // the canyon floor's height whether or not the ball can land on it (used by the renderer too)
  function floorShape(x, z) {
    if (!F) return null;
    const near = fairways.length ? sstep(0, 30, fairwayD(x, z)) : 1;
    let h = F.y + F.relief * (fbm(x / 60 + 11, z / 60 - 7) - 0.5) * (0.2 + 0.8 * near) + 0.5 * F.relief * (fbm(x / 14, z / 14) - 0.5) * near;
    const wd = washD(x, z);
    if (wd < 6) h -= WASH_DEPTH * (1 - sstep(-2, 6, wd));
    return h;
  }
  function floorAt(x, z) {
    if (!F || !F.solid || inGorge(x, z)) return null;
    return floorShape(x, z);
  }
  function topAt(x, z) { // { I, h } of the highest island over the point, or null
    let best = null;
    for (const I of ISL) {
      if (Math.abs(x - I.x) > I.bound || Math.abs(z - I.z) > I.bound) continue;
      const f = islandF(I, x, z);
      if (f <= 1) { const h = islandH(I, x, z, f); if (!best || h > best.h) best = { I, h }; }
    }
    return best;
  }
  function baseGroundAt(x, z) {
    if (FLD) return fieldAt(FLD, x, z);
    const t = topAt(x, z), fl = floorAt(x, z);
    if (t && (fl === null || t.h >= fl)) return t.h;
    return fl;
  }
  function islandAt(x, z) { const t = topAt(x, z); return t ? t.I : null; }
  // shaped features: each tee plays toward the next point of the line ahead of it, else the pin
  const teeSpots = teeEntries.map(([id, v]) => (Array.isArray(v) ? [v[0], v[1], hole.teePads?.[id]] : [v.x, v.z, v]));
  const aimFrom = ([x, z]) => { const pin = hole.pin || [0, -100]; if (!hole.line) return pin; const L = hole.line, here = lineProj(L, x, z).s; let acc = 0; for (let i = 1; i < L.length; i++) { acc += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); if (acc > here + 30) return L[i]; } return pin; };
  const sceneryAt = (x, z) => { const t = topAt(x, z); if (!t || !t.I.scenery) return null; const fl = floorAt(x, z); return fl !== null && fl > t.h ? null : { top: t.h, floor: fl }; };
  const FT = prepFeatures(hole, baseGroundAt, teeSpots, teeSpots.map(aimFrom), sceneryAt);
  const groundAt = FT.groundAt;
  // the corridor: rough along the playing line, native desert outside it and across the carry
  const corridor = hole.corridor ?? 32, roughW = hole.roughW ?? 12;
  let native = null;
  if (hole.line) {
    const g0 = FT.greens[0], fwS = fairways.length ? lineProj(hole.line, fairways[0].pts[0][0], fairways[0].pts[0][1]).s : g0 ? lineProj(hole.line, g0.x, g0.z).s - g0.rz - 28 : 0;
    native = hole.native || [24, fwS - 8];
  }
  // the canyon floor is part of the hole only when it's the level you play on (or the hole says so);
  // under a mesa-top hole it's native ground, however close to the line
  const teeY0 = teeSpots.length ? baseGroundAt(teeSpots[0][0], teeSpots[0][1]) : null;
  const floorPlays = hole.floorPlay ?? (F && F.solid && teeY0 !== null && F.y > teeY0 - 10);
  // which island is on top, without heights unless they're needed (a lone island, or one well
  // above the floor, needs none: surfaceAt runs a few hundred thousand times per hole for the paint)
  const baseTop = I => (I.slopeAt ? Math.min(I.slope.from[2], I.slope.to[2]) : I.top);
  function surfaceTop(x, z) {
    let one = null, many = false;
    for (const I of ISL) {
      if (Math.abs(x - I.x) > I.bound || Math.abs(z - I.z) > I.bound) continue;
      if (islandF(I, x, z) <= 1) { if (one) { many = true; break; } one = I; }
    }
    if (many) { const t = topAt(x, z); return { I: t.I, h: t.h }; }
    return one ? { I: one, h: null } : null;
  }
  function surfaceAt(x, z) {
    if (FLD) { // features first; a fairway mown up to a green or bunker keeps its fairway (their outer rough gives way)
      if (groundAt(x, z) === null) return 'void';
      const fs = FT.surfaceAt(x, z, () => groundAt(x, z)), own = fieldSurf(FLD, x, z);
      if (fs && !((fs === 'rough' || fs === 'firstcut') && (own === 'fairway' || own === 'fringe' || own === 'tee'))) return fs;
      return own;
    }
    const t = surfaceTop(x, z);
    let onFloor;
    if (!t) { onFloor = true; if (!F || !F.solid || inGorge(x, z)) return 'void'; }
    else if (!F || !F.solid || baseTop(t.I) > F.y + F.relief + 2) onFloor = false;
    else { const fl = floorAt(x, z), h = t.h ?? islandH(t.I, x, z, Math.min(1, islandF(t.I, x, z))); onFloor = fl !== null && fl > h; }
    const I = onFloor ? null : t.I;
    // features decide first; their outer rough gives way to a fairway mown up to them
    const fs = FT.surfaceAt(x, z, () => groundAt(x, z));
    // a wash runs on through a green's surrounds (it can come right up to the putting surface)
    if (fs && onFloor && (fs === 'fringe' || fs === 'firstcut' || fs === 'rough') && F && F.washes.length && washD(x, z) < 0) return 'waste';
    if (fs && !(fs === 'rough' && fairways.length && fairwayD(x, z) < 0)) return fs;
    if (I && I.bunkers) for (const b of I.bunkers) if (Math.hypot(x - b[0], z - b[1]) < b[2] * (1 + 0.12 * Math.sin(Math.atan2(z - b[1], x - b[0]) * 3 + b[0]))) return 'sand';
    for (const b of sand) if (Math.hypot(x - b[0], z - b[1]) < b[2] * (1 + 0.12 * Math.sin(Math.atan2(z - b[1], x - b[0]) * 3 + b[0]))) return 'sand';
    if (I && I.kind === 'green') { const d = Math.hypot(x - I.green.x, z - I.green.z); return d < I.green.r ? 'green' : d < I.green.r + 2 ? 'fairway' : 'rough'; }
    if (I && I.green) { const d = Math.hypot(x - I.green.x, z - I.green.z); if (d < I.green.r) return 'green'; if (d < I.green.r + 2.5) return 'fairway'; }
    if (onFloor && washD(x, z) < 0) return 'waste'; // a dry wash: desert waste
    if (fairways.length) { const d = fairwayD(x, z); if (d < 0) return 'fairway'; if (hole.line && d < 2.2) return 'firstcut'; if (hole.line && d < roughW) return 'rough'; }
    if (cave && cave.wallDepth(x, z) < 9) return 'desert';  // broken rock at a cave wall's foot: a bad lie
    if (onFloor && !floorPlays) return 'desert';
    if (hole.line) { // rough down the corridor, except across the carry; native beyond
      const p = lineProj(hole.line, x, z);
      if (p.d < corridor && !(native && p.s > native[0] && p.s < native[1])) return 'rough';
      return 'desert';
    }
    if (onFloor) return 'desert';
    if (I.kind === 'tee') return 'rough';
    if (I.kind === 'fairway') return islandF(I, x, z) < 0.8 ? 'fairway' : 'rough';
    return 'rough';
  }
  // boulders scattered over each rockfall: bigger toward the back of a pile, all of them solid
  const fallen = [];
  for (const P of FT.rockfalls) {
    const R = rng(Math.round(P.seed * 13) + 7), [s0, s1] = P.size || [0.6, 2.2];
    for (let i = 0, k = 0; i < (P.n ?? 18) * 12 && k < (P.n ?? 18); i++) {
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.95, u = Math.cos(a) * rr * P.rx, b = Math.sin(a) * rr * P.rz;
      const back = Math.min(1, Math.max(0, (b / P.rz + 1) / 2)), r = s0 + (s1 - s0) * Math.pow(R(), 1.6) * (0.45 + 0.55 * back);
      const x = P.x + u * P.c + b * P.s, z = P.z + u * P.s - b * P.c;
      if (fallen.some(o => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.8)) continue;
      if (groundAt(x, z) === null) continue;
      fallen.push({ type: 'boulder', x, z, r, h: r * (0.9 + R() * 0.5), rot: R() * 6.28, seed: R() * 100 }); k++;
    }
  }
  // scenery that plays (a sky course): floating and drifting islands and rock wedges are solid; falls are
  // curtains that knock a ball down. Seeds follow the scenery's order, as the renderer's do.
  const floats = [], wedges = [], curtains = [];
  (hole.scenery || []).forEach((m, i) => {
    if (m.type === 'hanging' || m.type === 'drift') {
      const r = m.r, I = prepIsland({ x: m.x, z: m.z, rx: m.rx ?? r, rz: m.rz ?? r * 0.85, rot: m.rot || 0, p: m.p, top: m.top, depth: m.top - m.bottom, kind: 'deco', seed: (m.type === 'drift' ? 400 : 300) + i, dome: m.dome || 0, trees: m.trees ?? (m.type === 'drift' ? 4 : m.dome ? 0 : Math.round((m.rx ?? r) * (m.rz ?? r) / 160)) });
      const F = { type: 'float', I, depth: m.top - m.bottom, mark: m };
      if (m.type === 'drift') { F.path = m.path; F.drift = true; }
      floats.push(F);
    } else if (m.type === 'wedge') for (const w of wedgeParts(m)) wedges.push({ type: 'wedge', ...w });
  });
  for (const F of floats) if (F.drift) driftTo(F, F.mark.u ?? 0.5);
  // falls: a sheet off the nearest rim (a playable island's or a floating one's), as wide as the mark
  for (const m of hole.scenery || []) if (m.type === 'falls') {
    const mid = m.pts[Math.floor(m.pts.length / 2)];
    let best = null;
    for (const I of [...ISL, ...floats.map(F => F.I)]) for (let k = 0; k < 96; k++) {
      const th = k / 96 * Math.PI * 2, e = edgeRadius(I, th), d = Math.hypot(e.x - mid[0], e.z - mid[1]);
      if (!best || d < best.d) best = { I, th, d, e };
    }
    if (!best) continue;
    let w = 0; for (let i = 1; i < m.pts.length; i++) w += Math.hypot(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1]);
    w = Math.max(6, w);
    const I = best.I, nx = best.e.x - I.x, nz = best.e.z - I.z, nl = Math.hypot(nx, nz) || 1;
    const top = islandH(I, I.x + nx * 0.98, I.z + nz * 0.98, 0.98);
    curtains.push({ I, th: best.th, w, top, x: best.e.x + nx / nl * 1.5, z: best.e.z + nz / nl * 1.5, tx: -nz / nl, tz: nx / nl });
  }
  const rocks = [...(hole.rocks || []), ...fallen, ...wedges, ...floats].map(R => prepRock(R.type === 'float' ? R : { ...R }, groundAt)).filter(R => R.solid !== false);
  // caverns (cave.js): the roof, its walls and stalactites are rock too
  const cave = hole.cave ? createCave(hole.cave) : null;
  // an ore cart on rails (hole.cave.cart: { route: [[x, z], ...] }): it sits somewhere along the route and
  // moves between shots (cart.next()); while a shot flies it is a solid box the ball bounces off
  const cart = hole.cave?.cart ? makeCart(hole.cave.cart.route) : null;
  function cartNormal(x, y, z) {
    if (!cart) return null;
    const P = cart.pose(), dx = x - P.x, dz = z - P.z; if (dx * dx + dz * dz > 9) return null;
    const g = groundAt(P.x, P.z) ?? 0, h = y - g; if (h < 0 || h > CART.h) return null;
    const c = Math.cos(P.yaw), s = Math.sin(P.yaw), u = dx * c + dz * s, v = -dx * s + dz * c; // u along the rails
    const ou = CART.l / 2 - Math.abs(u), ov = CART.w / 2 - Math.abs(v), oy = CART.h - h; if (ou < 0 || ov < 0) return null;
    if (oy < ou && oy < ov) return [0, 1, 0];
    return ou < ov ? [Math.sign(u) * c, 0, Math.sign(u) * s] : [-Math.sign(v) * s, 0, Math.sign(v) * c];
  }
  function solidAt(x, y, z) { for (const R of rocks) { const n = rockNormal(R, x, y, z); if (n) return n; } const k = cartNormal(x, y, z); if (k) return k; return cave ? cave.solidAt(x, y, z) : null; }
  // inside a waterfall's sheet (it widens a little as it falls)
  function curtainAt(x, y, z) {
    for (const C of curtains) {
      if (y > C.top + 1) continue;
      const dx = x - C.x, dz = z - C.z, along = dx * C.tx + dz * C.tz, across = Math.abs(dz * C.tx - dx * C.tz);
      const drop = Math.max(0, C.top - y), half = C.w / 2 * (1 + Math.min(1, drop / 230) * 1.6);
      if (Math.abs(along) < half && across < 2.5 + drop * 0.03) return C;
    }
    return null;
  }
  // groves: trees placed with the hole (the renderer adds its own scatter; all of them play)
  const trees = [...(hole.groves || []).flatMap(G => groveTrees(G, groundAt)), ...(hole.plants || []).map(t => ({ ...t, y: groundAt(t.x, t.z) ?? 0 }))];
  // the lowest height a ball can fall to before it's gone (below every top and the floor)
  const lows = ISL.map(I => (I.slope ? Math.min(I.slope.from[2], I.slope.to[2]) : I.top));
  if (F && F.solid) lows.push(F.y - 3);
  if (FLD) { let lo = Infinity; for (const v of FLD.h) if (v < lo) lo = v; lows.push(lo); }
  const voidY = Math.min(...lows) - 70;
  // slope of the ground (rise per metre along x and z), for lies and green reading
  function slopeAt(x, z, e = 0.5) {
    const a = groundAt(x + e, z), b = groundAt(x - e, z), c = groundAt(x, z + e), d = groundAt(x, z - e);
    if (a === null || b === null || c === null || d === null) return { x: 0, z: 0 };
    return { x: (a - b) / (2 * e), z: (c - d) / (2 * e) };
  }
  return { ISL, floor: F, cave, cart, rocks, trees, floats, curtains, curtainAt, features: FT, groundAt, baseGroundAt, floorAt, floorShape, inGorge, islandAt, topAt, surfaceAt, solidAt, slopeAt, fairwayD, washD, voidY, native, corridor };
}
