// Course features: the shaped ground a hole is played over. Pure (no DOM, no Three.js).
//
// terrain.js builds the base ground (island tops, the canyon floor); these shape it:
//   landforms  ridges, swales, mounds, bowls, side tilts and speed-slot steps   (added to the ground)
//   green      a green complex: tilt, tiers, swale, crown, punchbowl, false front, raised or sunk
//   tees       raised, mown tee pads, one per set
//   water      ponds: a basin with a water level                                 (these three are pads:
//              the ground blends to their own shape, built level from the ground at their centre)
//   bunkers    bowls with lips, sand flashed up the face toward the target       (added last)
//
// Every feature has a local frame: u across (right), b along it toward the back. `rot` is the yaw of
// "back" (0 = down the hole, −z), or give `from: [x, z]` (where play comes from) and it's worked out.
import { fbm, vnoise, sstep } from './noise.js';

function framed(F, fallbackFrom) {
  const from = F.from || fallbackFrom;
  if (F.rot == null && from) F.rot = Math.atan2(F.x - from[0], -(F.z - from[1]));
  F.rot = F.rot || 0; F.c = Math.cos(F.rot); F.s = Math.sin(F.rot);
  return F;
}
const loc = (F, x, z) => { const dx = x - F.x, dz = z - F.z; return { u: dx * F.c + dz * F.s, b: dx * F.s - dz * F.c }; };
const near = (F, x, z) => Math.abs(x - F.x) < F.bound && Math.abs(z - F.z) < F.bound;

/* ---------- landforms ---------- */
// { type: 'ridge'|'swale'|'mound'|'bowl'|'tilt'|'step', x, z, rot|from, length, width, height, grade?, run? }
export function prepLandform(L) {
  framed(L); L.length = L.length || 30; L.width = L.width || 20; L.height = L.height ?? 1.2;
  L.run = L.run ?? 50;
  L.bound = Math.hypot(L.length, L.width) / 2 + (L.type === 'step' ? L.run + 50 : 4);
  return L;
}
function landformDelta(L, x, z) {
  if (!near(L, x, z)) return 0;
  const { u, b } = loc(L, x, z), hl = L.length / 2, hw = L.width / 2;
  const taper = 1 - sstep(hl * 0.55, hl, Math.abs(b));
  switch (L.type) {
    case 'ridge': case 'swale': {
      const k = Math.exp(-2.2 * (u / hw) ** 2) * taper;
      return (L.type === 'ridge' ? 1 : -1) * L.height * k;
    }
    case 'mound': case 'bowl': {
      const r = Math.hypot(u / hw, b / hl); if (r >= 1) return 0;
      return (L.type === 'mound' ? 1 : -1) * L.height * 0.5 * (1 + Math.cos(Math.PI * r));
    }
    case 'tilt': { // a side slope: grade % rising to the right (negative: to the left)
      const w = (1 - sstep(0.65, 1, Math.abs(u) / hw)) * taper;
      return (L.grade ?? 5) / 100 * u * w;
    }
    case 'step': { // a speed slot: the ground falls `height` over `length`, stays down for `run`, then eases back
      const across = 1 - sstep(0.7, 1, Math.abs(u) / hw);
      const down = sstep(-hl, hl, b) * (1 - sstep(hl + L.run, hl + L.run + 50, b));
      let d = -L.height * down * across;
      if (L.mounds) for (const sd of [-1, 1]) { const r = Math.hypot((u - sd * (hw + 5)) / 6, (b + hl) / 9); if (r < 1) d += L.mounds * 0.5 * (1 + Math.cos(Math.PI * r)); }
      return d;
    }
  }
  return 0;
}

/* ---------- green complexes ---------- */
// green: { x, z, rx (half width), rz (half depth), rot|from, style, tilt (% higher at the back), side (% higher
//   right), raise (m above the ground around it), apron (m of falloff), falseFront (m), tiers: [{ b, step, axis }],
//   swale: { b, depth, width }, crown (m), dish (m), mound (m), runoff (short-grass falloffs), pins: [[x, z]...] }
const GREEN_STYLES = {
  tilt: {},
  tiered: { tiers: [{ b: 0, step: 0.75 }] },
  crowned: { crown: 0.35, tilt: 0.6, runoff: true, raise: 0.8 },
  plateau: { raise: 1.4, runoff: true, falseFront: 0.5 },
  punchbowl: { raise: -0.6, dish: 0.25, mound: 1.6, tilt: 0.8 },
  redan: { tilt: -2.1, side: 1.6, raise: 0.9, runoff: true },
  biarritz: { swale: { b: 0, depth: 1.1, width: 7 }, tilt: 1, rz: 22 },
};
export function prepGreen(G, baseAt, from) {
  Object.assign(G, { ...GREEN_STYLES[G.style || 'tilt'], ...G });
  framed(G, from);
  G.rx = G.rx || 15; G.rz = G.rz || 13; G.tilt = G.tilt ?? 2; G.side = G.side ?? 0; G.raise = G.raise ?? 0.35; G.apron = G.apron ?? 9;
  G.seed = G.seed ?? (G.x * 0.37 + G.z * 0.11);
  G.y0 = baseAt(G.x, G.z) + G.raise;
  G.bound = Math.max(G.rx, G.rz) * 1.15 + G.apron + 14;
  return G;
}
function greenWob(G, th) { return 1 + 0.05 * Math.sin(3 * th + G.seed) + 0.03 * Math.sin(5 * th + 2 * G.seed); }
export function greenRho(G, u, b) { return Math.hypot(u / G.rx, b / G.rz) / greenWob(G, Math.atan2(b / G.rz, u / G.rx)); }
// height of the putting surface above y0 at local (u, b); defined past the edge too (it's sampled at the edge)
function greenH(G, u, b, rho) {
  let h = G.tilt / 100 * b + G.side / 100 * u;
  if (G.tiers) for (const t of G.tiers) h += t.step * sstep(t.b - 2.2, t.b + 2.2, t.axis === 'u' ? u : b);
  if (G.swale) h -= G.swale.depth * Math.exp(-(((b - G.swale.b) / (G.swale.width / 2)) ** 2));
  const r2 = Math.min(1, rho) ** 2;
  if (G.crown) h -= G.crown * r2;
  if (G.dish) h += G.dish * r2;
  if (G.falseFront) h -= G.falseFront * (1 - sstep(-G.rz * 0.97, -G.rz * 0.97 + (G.ffLen ?? 4.5), b));
  return h + 0.07 * (fbm(u / 7 + G.seed, b / 7) - 0.5);
}
// the complex's ground: { h, w } (w = how much of it replaces the ground), or null when out of reach
function greenGround(G, x, z, base) {
  if (!near(G, x, z)) return null;
  const { u, b } = loc(G, x, z), rho = greenRho(G, u, b);
  if (rho <= 1) return G.y0 + greenH(G, u, b, rho);
  const rDir = Math.hypot(u, b) / rho, e = (rho - 1) * rDir; // metres past the edge
  if (e > G.apron + 4) return null;
  const edge = G.y0 + greenH(G, u / rho, b / rho, 1);
  const w = 1 - sstep(0, G.apron, e);
  let h = base + (edge - base) * w;
  if (G.mound) h += G.mound * Math.exp(-(((e - G.apron * 0.45) / (G.apron * 0.3)) ** 2));
  return h;
}
function greenSurface(G, x, z) {
  if (!near(G, x, z)) return null;
  const { u, b } = loc(G, x, z), rho = greenRho(G, u, b);
  if (rho <= 1) return 'green';
  const e = (rho - 1) * Math.hypot(u, b) / rho;
  if (e < 1.6) return 'fringe';
  if (G.runoff && e < G.apron * 0.85) return 'fringe';
  if (e < 4) return 'firstcut';
  if (e < G.apron + 10) return 'rough';
  return null;
}

/* ---------- bunkers ---------- */
// { x, z, rx, rz, rot|from, style: 'flashed'|'pot'|'grass'|'waste', depth, lip, toward: [x, z] (the face rises
//   on that side; defaults to the green) }
const BUNKER_STYLES = {
  flashed: { depth: 0.9, lip: 0.6, k: 2.6, jag: 0.14 },
  pot: { depth: 1.5, lip: 0.45, k: 7, jag: 0.025 },
  grass: { depth: 1.0, lip: 0.4, k: 3, jag: 0.1 },
  waste: { depth: 0.28, lip: 0, k: 1.6, jag: 0.2 },
};
export function prepBunker(B, toward) {
  const S = BUNKER_STYLES[B.style || 'flashed'];
  Object.assign(B, { ...S, ...B, k: S.k, jag: B.jag ?? S.jag });
  framed(B); B.seed = B.seed ?? (B.x * 1.3 + B.z * 0.7);
  const t = B.toward || toward;
  if (t) { const dx = t[0] - B.x, dz = t[1] - B.z, L = Math.hypot(dx, dz) || 1; B.fx = dx / L; B.fz = dz / L; } else { B.fx = 0; B.fz = -1; }
  B.bound = Math.max(B.rx, B.rz) * 1.9;
  return B;
}
function bunkerRho(B, x, z) {
  const { u, b } = loc(B, x, z), th = Math.atan2(b / B.rz, u / B.rx), s = B.seed;
  const wob = 1 + B.jag * (0.6 * Math.sin(3 * th + s) + 0.4 * Math.sin(5 * th + 2 * s) + 0.25 * Math.sin(9 * th + 3 * s));
  return Math.hypot(u / B.rx, b / B.rz) / wob;
}
function faceOf(B, x, z) { const dx = x - B.x, dz = z - B.z, L = Math.hypot(dx, dz) || 1; return Math.max(0, (dx * B.fx + dz * B.fz) / L); }
function bunkerDelta(B, x, z) {
  if (!near(B, x, z)) return 0;
  const rho = bunkerRho(B, x, z);
  if (rho < 1) {
    const floorish = 1 - Math.pow(rho, B.k);
    return -B.depth * floorish + 0.05 * (vnoise(x * 1.7, z * 1.7) - 0.5);
  }
  if (!B.lip || rho > 1.55) return 0;
  const t = (rho - 1) / 0.55, bump = t < 0.3 ? sstep(0, 0.3, t) : 1 - sstep(0.3, 1, t);
  return B.lip * (0.25 + 0.75 * faceOf(B, x, z)) * bump;
}
function bunkerSurface(B, x, z) {
  if (!near(B, x, z)) return null;
  const rho = bunkerRho(B, x, z);
  if (B.style === 'waste') return rho < 1 ? 'waste' : null;
  if (B.style === 'grass') return rho < 0.78 ? 'sand' : rho < 1.2 ? 'rough' : null;
  if (B.style === 'pot') return rho < 1 ? 'sand' : rho < 1.25 ? 'rough' : null;
  if (rho < 1 + 0.24 * faceOf(B, x, z)) return 'sand'; // flashed up the face
  return rho < 1.35 ? 'rough' : null;
}

/* ---------- ponds ---------- */
// { x, z, rx, rz, rot, depth }: level sits 0.25 m under the ground at its centre
export function prepWater(W, baseAt) {
  framed(W); W.depth = W.depth ?? 1.4; W.seed = W.seed ?? (W.x + W.z);
  W.y0 = baseAt(W.x, W.z); W.level = W.y0 - 0.25;
  W.bound = Math.max(W.rx, W.rz) * 1.7;
  return W;
}
function waterRho(W, x, z) {
  const { u, b } = loc(W, x, z), th = Math.atan2(b / W.rz, u / W.rx);
  return Math.hypot(u / W.rx, b / W.rz) / (1 + 0.08 * Math.sin(3 * th + W.seed) + 0.05 * Math.sin(7 * th + W.seed));
}
function waterGround(W, x, z, base) {
  if (!near(W, x, z)) return null;
  const rho = waterRho(W, x, z); if (rho > 1.6) return null;
  const w = 1 - sstep(1.15, 1.6, rho);
  return base + (W.y0 + 0.12 - base) * w - W.depth * (1 - sstep(0.45, 1.12, rho));
}

/* ---------- tee pads ---------- */
// tees: { setId: [x, z] | { x, z, w, l, h, rot } }; a pad is w across, l long, raised h
export function prepTee(T, baseAt) {
  T.w = T.w || 9; T.l = T.l || 12; T.h = T.h ?? 0.45; framed(T);
  T.y0 = baseAt(T.x, T.z) + T.h; T.bound = Math.max(T.w, T.l) + 8;
  return T;
}
function teeDist(T, x, z) { // signed distance to the pad's rounded rectangle
  const { u, b } = loc(T, x, z), qx = Math.abs(u) - T.w / 2 + 1.2, qz = Math.abs(b) - T.l / 2 + 1.2;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - 1.2;
}
function teeGround(T, x, z, base) {
  if (!near(T, x, z)) return null;
  const d = teeDist(T, x, z); if (d > 2.6) return null;
  const { b } = loc(T, x, z), flat = T.y0 + 0.004 * b;
  return d <= 0 ? flat : base + (flat - base) * (1 - sstep(0, 2.6, d));
}

/* ---------- all of a hole's features ---------- */
// teeSpots: [[x, z, extra?]...]; teeAims: the point each tee plays toward (sets the pad's direction)
export function prepFeatures(hole, baseAt, teeSpots, teeAims) {
  const landforms = (hole.landforms || []).map(L => prepLandform({ ...L }));
  const shaped = (x, z) => { const b = baseAt(x, z); if (b === null) return null; let d = 0; for (const L of landforms) d += landformDelta(L, x, z); return b + d; };
  const greenSpec = hole.green && !Array.isArray(hole.green) ? [hole.green] : hole.green || [];
  const pin = hole.pin;
  const greens = greenSpec.map(G => prepGreen({ ...G }, (x, z) => shaped(x, z) ?? 0, hole.line ? hole.line.at(-2) : teeSpots[0]));
  const tees = teeSpots.map(([x, z, extra], i) => prepTee({ x, z, rot: Math.atan2(teeAims[i][0] - x, -(teeAims[i][1] - z)), ...(extra || {}) }, (a, c) => shaped(a, c) ?? 0));
  const water = (hole.water || []).map(W => prepWater({ ...W }, (x, z) => shaped(x, z) ?? 0));
  const green0 = greens[0];
  const bunkers = (hole.bunkers || []).map(B => prepBunker({ ...B }, green0 ? [green0.x, green0.z] : pin));

  function groundAt(x, z) {
    let h = shaped(x, z); if (h === null) return null;
    for (const W of water) { const g = waterGround(W, x, z, h); if (g !== null) h = g; }
    for (const G of greens) { const g = greenGround(G, x, z, h); if (g !== null) h = g; }
    for (const T of tees) { const g = teeGround(T, x, z, h); if (g !== null) h = g; }
    for (const B of bunkers) h += bunkerDelta(B, x, z);
    return h;
  }
  // the surface the features decide, or null to fall through to paint and island kinds
  // (groundOf: a function, called only near water)
  function surfaceAt(x, z, groundOf) {
    for (const T of tees) if (near(T, x, z)) { const d = teeDist(T, x, z); if (d < 0) return 'tee'; }
    for (const W of water) if (near(W, x, z) && waterRho(W, x, z) < 1.4) { const g = groundOf(); if (g !== null && g < W.level) return 'water'; }
    for (const B of bunkers) { const s = bunkerSurface(B, x, z); if (s) return s; }
    for (const G of greens) { const s = greenSurface(G, x, z); if (s) return s; }
    for (const T of tees) if (near(T, x, z) && teeDist(T, x, z) < 4) return 'rough';
    return null;
  }
  const any = landforms.length + greens.length + tees.length + water.length + bunkers.length > 0;
  return { landforms, greens, tees, water, bunkers, groundAt, surfaceAt, any };
}

/* ---------- outlines, for maps and markers ---------- */
// world-space points around a green, bunker, pond or tee pad
export function featureOutline(F, kind, n = 40) {
  const pts = [];
  const at = (u, b) => [F.x + u * F.c + b * F.s, F.z + u * F.s - b * F.c];
  if (kind === 'tee') {
    for (const [u, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push(at(u * F.w / 2, b * F.l / 2));
    return pts;
  }
  for (let i = 0; i < n; i++) {
    const th = i / n * Math.PI * 2, cu = Math.cos(th), sb = Math.sin(th);
    const rx = F.rx, rz = F.rz;
    let lo = 0, hi = 3 * Math.max(rx, rz);
    for (let k = 0; k < 24; k++) { // find the edge along this direction (rho = 1)
      const m = (lo + hi) / 2, u = cu * m, b = sb * m;
      const rho = kind === 'green' ? greenRho(F, u, b) : kind === 'water' ? waterRhoLocal(F, u, b) : bunkerRhoLocal(F, u, b);
      if (rho < 1) lo = m; else hi = m;
    }
    pts.push(at(cu * lo, sb * lo));
  }
  return pts;
}
function bunkerRhoLocal(B, u, b) { const th = Math.atan2(b / B.rz, u / B.rx), s = B.seed; return Math.hypot(u / B.rx, b / B.rz) / (1 + B.jag * (0.6 * Math.sin(3 * th + s) + 0.4 * Math.sin(5 * th + 2 * s) + 0.25 * Math.sin(9 * th + 3 * s))); }
function waterRhoLocal(W, u, b) { const th = Math.atan2(b / W.rz, u / W.rx); return Math.hypot(u / W.rx, b / W.rz) / (1 + 0.08 * Math.sin(3 * th + W.seed) + 0.05 * Math.sin(7 * th + W.seed)); }
