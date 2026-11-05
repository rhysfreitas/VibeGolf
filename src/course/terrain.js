// Course terrain: ground height, surfaces and rock for one hole. Pure (no DOM, no Three.js), so the
// physics, the renderer and the tests all read the same shapes.
//
// A hole is built from islands (superellipse tops; the Aerie's floating rocks, Red Mesa's mesas),
// an optional canyon floor under them, painted fairways and sand, and rock you can hit (arches and
// hoodoos). groundAt(x, z) is the highest top under a point, else the floor, else null (open air).

import { hash2, vnoise, fbm, rng, sstep } from './noise.js';
import { prepFeatures } from './features.js';
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
// pts: [[x, z, halfWidth?], ...]; returns signed distance to the band's edge (negative inside)
export function bandDist(pts, hw0, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, ah = hw0] = pts[i], [bx, bz, bh = hw0] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t) - (ah + (bh - ah) * t);
    if (d < best) best = d;
  }
  return best;
}
const wobble = (x, z, k) => 1 + 0.5 * (vnoise(x / 23 + k, z / 23 - k) - 0.5);
// a wash: a dry sandy channel pressed into the floor
const WASH_DEPTH = 1.1;

/* ---------- rock you can hit ---------- */
// arch:   { type:'arch', x, z, rot, w, h, t, d, y? } span axis along rot (0 = along x), opening w wide
//         and h tall above its base, a band of rock t thick and d deep (front to back)
// hoodoo: { type:'hoodoo', x, z, r, h, cap, y? } a column r in radius, h tall, with a cap
export function prepRock(R, groundAt) {
  R.c = Math.cos(R.rot || 0); R.s = Math.sin(R.rot || 0);
  if (R.y == null) R.y = (groundAt(R.x, R.z) ?? 0) - 0.5;
  if (R.type === 'arch') {
    R.ai = R.w / 2; R.bi = R.h; R.ao = R.ai + R.t; R.bo = R.bi + R.t * 0.85;
    R.bound = R.ao + R.d;
  } else if (R.type === 'hoodoo') {
    R.seed = R.seed ?? (R.x * 13.1 + R.z * 7.7);
    R.capH = (R.cap ?? R.r * 1.5) * 0.75; R.capR = R.cap ?? R.r * 1.5;
    R.bound = Math.max(R.capR, R.r * 1.6) + 1;
  }
  return R;
}
// radius of a hoodoo column at height v above its base (shared with the mesh)
export function hoodooR(R, v) {
  const t = v / R.h;
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
    const ein = (u / R.ai) ** 2 + (v / R.bi) ** 2, eout = (u / R.ao) ** 2 + (v / R.bo) ** 2;
    if (eout >= 1 || ein <= 1) return null;
    const pIn = (Math.sqrt(ein) - 1) * Math.min(R.ai, R.bi), pOut = (1 - Math.sqrt(eout)) * Math.min(R.ao, R.bo), pFace = R.d / 2 - Math.abs(w);
    let nu, nv, nw = 0;
    if (pFace < pIn && pFace < pOut) { nu = 0; nv = 0; nw = Math.sign(w) || 1; }
    else if (pIn < pOut) { nu = -u / (R.ai * R.ai); nv = -v / (R.bi * R.bi); }
    else { nu = u / (R.ao * R.ao); nv = v / (R.bo * R.bo); }
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
  return null;
}

/* ---------- the hole ---------- */
// hole.floor: { y, relief, solid (false = scenery only, open air for the ball), washes:[{pts, w}],
//               gorges:[{x, z, rx, rz, rot}] (no floor) }
// hole.fairways: [{ pts:[[x,z,hw]...], hw }] painted fairway on any ground; hole.sand: [[x,z,r]...]
// hole.tees: { setId: [x, z] | {x, z, w, l, h, rot} }; hole.rocks: arches and hoodoos
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
export function createTerrain(hole) {
  const ISL = hole.islands.map(I => prepIsland({ ...I, playable: true }));
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
    const t = topAt(x, z), fl = floorAt(x, z);
    if (t && (fl === null || t.h >= fl)) return t.h;
    return fl;
  }
  function islandAt(x, z) { const t = topAt(x, z); return t ? t.I : null; }
  // shaped features: each tee plays toward the next point of the line ahead of it, else the pin
  const teeSpots = teeEntries.map(([, v]) => (Array.isArray(v) ? [v[0], v[1]] : [v.x, v.z, v]));
  const aimFrom = ([x, z]) => { const pin = hole.pin || [0, -100]; if (!hole.line) return pin; const L = hole.line, here = lineProj(L, x, z).s; let acc = 0; for (let i = 1; i < L.length; i++) { acc += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); if (acc > here + 30) return L[i]; } return pin; };
  const FT = prepFeatures(hole, baseGroundAt, teeSpots, teeSpots.map(aimFrom));
  const groundAt = FT.groundAt;
  // the corridor: rough along the playing line, native desert outside it and across the carry
  const corridor = hole.corridor ?? 32, roughW = hole.roughW ?? 12;
  let native = null;
  if (hole.line) {
    const g0 = FT.greens[0], fwS = fairways.length ? lineProj(hole.line, fairways[0].pts[0][0], fairways[0].pts[0][1]).s : g0 ? lineProj(hole.line, g0.x, g0.z).s - g0.rz - 28 : 0;
    native = hole.native || [24, fwS - 8];
  }
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
    const t = surfaceTop(x, z);
    let onFloor;
    if (!t) { onFloor = true; if (!F || !F.solid || inGorge(x, z)) return 'void'; }
    else if (!F || !F.solid || baseTop(t.I) > F.y + F.relief + 2) onFloor = false;
    else { const fl = floorAt(x, z), h = t.h ?? islandH(t.I, x, z, Math.min(1, islandF(t.I, x, z))); onFloor = fl !== null && fl > h; }
    const I = onFloor ? null : t.I;
    const fs = FT.surfaceAt(x, z, () => groundAt(x, z)); if (fs) return fs;
    if (I && I.bunkers) for (const b of I.bunkers) if (Math.hypot(x - b[0], z - b[1]) < b[2] * (1 + 0.12 * Math.sin(Math.atan2(z - b[1], x - b[0]) * 3 + b[0]))) return 'sand';
    for (const b of sand) if (Math.hypot(x - b[0], z - b[1]) < b[2] * (1 + 0.12 * Math.sin(Math.atan2(z - b[1], x - b[0]) * 3 + b[0]))) return 'sand';
    if (I && I.kind === 'green') { const d = Math.hypot(x - I.green.x, z - I.green.z); return d < I.green.r ? 'green' : d < I.green.r + 2 ? 'fairway' : 'rough'; }
    if (I && I.green) { const d = Math.hypot(x - I.green.x, z - I.green.z); if (d < I.green.r) return 'green'; if (d < I.green.r + 2.5) return 'fairway'; }
    if (onFloor && washD(x, z) < 0) return 'waste'; // a dry wash: desert waste
    if (fairways.length) { const d = fairwayD(x, z); if (d < 0) return 'fairway'; if (hole.line && d < 2.2) return 'firstcut'; if (hole.line && d < roughW) return 'rough'; }
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
  const rocks = (hole.rocks || []).map(R => prepRock({ ...R }, groundAt)).filter(R => R.solid !== false);
  function solidAt(x, y, z) { for (const R of rocks) { const n = rockNormal(R, x, y, z); if (n) return n; } return null; }
  // the lowest height a ball can fall to before it's gone (below every top and the floor)
  const lows = ISL.map(I => (I.slope ? Math.min(I.slope.from[2], I.slope.to[2]) : I.top));
  if (F && F.solid) lows.push(F.y - 3);
  const voidY = Math.min(...lows) - 70;
  // slope of the ground (rise per metre along x and z), for lies and green reading
  function slopeAt(x, z, e = 0.5) {
    const a = groundAt(x + e, z), b = groundAt(x - e, z), c = groundAt(x, z + e), d = groundAt(x, z - e);
    if (a === null || b === null || c === null || d === null) return { x: 0, z: 0 };
    return { x: (a - b) / (2 * e), z: (c - d) / (2 * e) };
  }
  return { ISL, floor: F, rocks, features: FT, groundAt, baseGroundAt, floorAt, floorShape, inGorge, islandAt, topAt, surfaceAt, solidAt, slopeAt, fairwayD, washD, voidY, native, corridor };
}
