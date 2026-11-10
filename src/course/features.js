// Course features: the shaped ground a hole is played over. Pure (no DOM, no Three.js).
//
// terrain.js builds the base ground (island tops, the canyon floor); these shape it:
//   landforms  ridges, swales, mounds, bowls, side tilts and speed-slot steps   (added to the ground)
//   green      a green complex: tilt, tiers, swale, crown, punchbowl, false front, raised or sunk
//   tees       raised, mown tee pads, one per set
//   water      ponds: a basin with a water level                                 (these three are pads:
//   rivers     a channel along a smoothed polyline, filled to one level
//              the ground blends to their own shape, built level from the ground at their centre)
//   rockfalls  piles of fallen rock: scree heaped against a wall or spilling off a boulder (native
//              ground; terrain.js scatters boulders over them)
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
//   swale: { b, depth, width }, crown (m), dish (m), mound (m), runoff (short-grass falloffs), pins: [[x, z]...],
//   contours: [{ u, b, r, h }] (rolls in the surface; default: a few, seeded), roll (their scale, default 1) }
// Around each pin the rolls flatten into a cupping area, so a pin sits on the green's tilt alone.
const GREEN_STYLES = {
  tilt: {},
  tiered: { tiers: [{ b: 0, step: 0.75 }] },
  crowned: { crown: 0.25, tilt: 0.6, runoff: true, raise: 0.8 },
  plateau: { raise: 1.4, runoff: true, falseFront: 0.5 },
  punchbowl: { raise: -0.6, dish: 0.18, mound: 1.6, tilt: 0.8 },
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
  if (!G.contours) { // a few rolls across the surface: humps and hollows 4-8 m across
    let k = Math.abs(Math.sin(G.seed * 12.9898) * 43758.5453) % 1; const r = () => (k = (k * 9301 + 0.4927) % 1);
    G.contours = Array.from({ length: 3 }, (_, i) => ({ u: (r() - 0.5) * G.rx * 1.2, b: (r() - 0.5) * G.rz * 1.2, r: 4.5 + r() * 3.5, h: (i % 2 ? -1 : 1) * (0.2 + r() * 0.18) * (G.roll ?? 1) }));
  }
  G.cups = (G.pins || []).map(([px, pz]) => { const l = loc(G, px, pz); return { u: l.u, b: l.b, c: rolls(G, l.u, l.b) }; });
  return G;
}
function rolls(G, u, b) { let h = 0; for (const c of G.contours) h += c.h * Math.exp(-((u - c.u) ** 2 + (b - c.b) ** 2) / (c.r * c.r)); return h; }
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
  // rolls, flattened into a cupping area around each pin (within about 2.2 m, easing out by 4.5 m)
  let c = rolls(G, u, b);
  for (const p of G.cups) { const d = Math.hypot(u - p.u, b - p.b); if (d < 4.5) c += (p.c - c) * (1 - sstep(2.2, 4.5, d)); }
  return h + c + 0.04 * (fbm(u / 6 + G.seed, b / 6) - 0.5);
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

/* ---------- rockfalls ---------- */
// { x, z, rx (half width), rz (half depth), rot|toward (the pile rises toward that point: a wall, a boulder),
//   height (m at the back; 0 = a scatter of rocks on the ground), n (boulders), size: [min, max] (radius, m) }
export function prepRockfall(P, baseAt) {
  if (P.toward && P.rot == null) P.rot = Math.atan2(P.toward[0] - P.x, -(P.toward[1] - P.z));
  framed(P); P.height = P.height ?? 0; P.seed = P.seed ?? (P.x * 0.7 + P.z * 1.3);
  const fx = P.x - P.s * P.rz, fz = P.z + P.c * P.rz; // the front (downhill) edge, middle
  P.y0 = Math.min(baseAt(P.x, P.z), baseAt(fx, fz)); P.bound = Math.max(P.rx, P.rz) * 1.1 + 2;
  // the pile's foot follows the ground along its length (a heap along a ramp steps up with it, rather than
  // standing level and leaving its low end a few metres up in the air): the ground at the front edge and the
  // middle at the same place along it
  P.footAt = u => Math.min(baseAt(P.x + u * P.c, P.z + u * P.s), baseAt(P.x + u * P.c - P.rz * P.s, P.z + u * P.s + P.rz * P.c));
  return P;
}
export function rockfallRho(P, x, z) { const { u, b } = loc(P, x, z); return Math.hypot(u / P.rx, b / P.rz); }
function rockfallGround(P, x, z) {
  if (!P.height || !near(P, x, z)) return null;
  const { u, b } = loc(P, x, z), rho = Math.hypot(u / P.rx, b / P.rz); if (rho >= 1) return null;
  const t = Math.min(1, Math.max(0, (b / P.rz + 1) / 2)); // 0 at the front, 1 at the back
  const edge = 1 - sstep(0.7, 1, Math.hypot(u / P.rx, Math.min(0, b) / P.rz));
  const y0 = P.footAt(u) ?? P.y0;
  return y0 + P.height * Math.pow(t, 1.6) * edge + Math.min(0.9, P.height * 0.06) * (fbm(x / 3 + P.seed, z / 3) - 0.5) * edge;
}

/* ---------- rivers ---------- */
// { pts: [[x, z]...], w (water width, m), depth (m below the level at the middle) }: the line is smoothed
// (Catmull-Rom), the water sits at one level just under the lowest bank, and the banks blend back to
// the ground over a few metres
function catmull(P, step = 3) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P.at(-1));
  return out;
}
export function prepRiver(V, baseAt) {
  V.line = catmull(V.pts); V.w = V.w || 12; V.depth = V.depth ?? 1.1; V.hw = V.w / 2; V.bank = V.bank ?? 5;
  let lo = Infinity; for (const [x, z] of V.line) { const b = baseAt(x, z); if (b !== null && b < lo) lo = b; }
  V.level = (Number.isFinite(lo) ? lo : 0) - 0.3;
  const xs = V.line.map(p => p[0]), zs = V.line.map(p => p[1]), m = V.hw + V.bank + 2;
  V.box = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m];
  return V;
}
export function riverDist(V, x, z) {
  if (x < V.box[0] || x > V.box[1] || z < V.box[2] || z > V.box[3]) return Infinity;
  let best = Infinity; const L = V.line;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) best = d;
  }
  return best;
}
function riverGround(V, x, z, base) {
  const d = riverDist(V, x, z); if (d > V.hw + V.bank) return null;
  if (base > V.level + 6) return null; // a cliff it runs past (or falls from) stays a cliff
  if (d < V.hw) return V.level - V.depth * (1 - (d / V.hw) ** 2) - 0.12;
  const edge = V.level + 0.1;
  return edge + (Math.max(base, edge) - edge) * sstep(V.hw, V.hw + V.bank, d);
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
  if (base < flat - 3) return null; // a pad never hangs out over a drop: it stops at the lip
  return d <= 0 ? flat : base + (flat - base) * (1 - sstep(0, 2.6, d));
}

/* ---------- all of a hole's features ---------- */
// teeSpots: [[x, z, extra?]...]; teeAims: the point each tee plays toward (sets the pad's direction)
// sceneryAt(x, z) (optional): { top, floor } where another hole's ground (scenery) is the top there; this hole's
// landforms shape its own floor, not that ground, so the higher of the two wins
export function prepFeatures(hole, baseAt, teeSpots, teeAims, sceneryAt = null) {
  const landforms = (hole.landforms || []).map(L => prepLandform({ ...L }));
  const shaped = (x, z) => {
    const b = baseAt(x, z); if (b === null) return null;
    let d = 0; for (const L of landforms) d += landformDelta(L, x, z);
    const S = d && sceneryAt ? sceneryAt(x, z) : null;
    if (S) return S.floor === null ? S.top : Math.max(S.top, S.floor + d);
    return b + d;
  };
  const greenSpec = hole.green && !Array.isArray(hole.green) ? [hole.green] : hole.green || [];
  const pin = hole.pin;
  const greens = greenSpec.map(G => prepGreen({ ...G }, (x, z) => shaped(x, z) ?? 0, hole.line ? hole.line.at(-2) : teeSpots[0]));
  const tees = teeSpots.map(([x, z, extra], i) => prepTee({ x, z, rot: Math.atan2(teeAims[i][0] - x, -(teeAims[i][1] - z)), ...(extra || {}) }, (a, c) => shaped(a, c) ?? 0));
  const water = (hole.water || []).map(W => prepWater({ ...W }, (x, z) => shaped(x, z) ?? 0));
  const green0 = greens[0];
  const bunkers = (hole.bunkers || []).map(B => prepBunker({ ...B }, green0 ? [green0.x, green0.z] : pin));
  const rockfalls = (hole.rockfalls || []).map(P => prepRockfall({ ...P }, (x, z) => shaped(x, z) ?? 0));
  const rivers = (hole.rivers || []).map(V => prepRiver({ ...V }, shaped));

  function groundAt(x, z) {
    let h = shaped(x, z); if (h === null) return null;
    for (const W of water) { const g = waterGround(W, x, z, h); if (g !== null) h = g; }
    for (const V of rivers) { const g = riverGround(V, x, z, h); if (g !== null) h = g; }
    for (const G of greens) { const g = greenGround(G, x, z, h); if (g !== null) h = g; }
    for (const T of tees) { const g = teeGround(T, x, z, h); if (g !== null) h = g; }
    for (const P of rockfalls) { const g = rockfallGround(P, x, z); if (g !== null && g > h) h = g; }
    for (const B of bunkers) h += bunkerDelta(B, x, z);
    return h;
  }
  // the surface the features decide, or null to fall through to paint and island kinds
  // (groundOf: a function, called only near water)
  function surfaceAt(x, z, groundOf) {
    for (const T of tees) if (near(T, x, z)) { const d = teeDist(T, x, z); if (d < 0) return 'tee'; }
    for (const W of water) if (near(W, x, z) && waterRho(W, x, z) < 1.4) { const g = groundOf(); if (g !== null && g < W.level) return 'water'; }
    for (const V of rivers) { const d = riverDist(V, x, z); if (d < V.hw) return 'water'; if (d < V.hw + 2) return 'waste'; }
    let rim = null; // sand beats the green; the green beats a bunker's grassy rim
    for (const B of bunkers) { const s = bunkerSurface(B, x, z); if (s === 'sand' || s === 'waste') return s; if (s) rim = s; }
    for (const G of greens) { const s = greenSurface(G, x, z); if (s === 'green' || s === 'fringe') return s; if (s && !rim) rim = s; }
    for (const P of rockfalls) if (near(P, x, z) && rockfallRho(P, x, z) < 0.92) return 'desert';
    if (rim) return rim;
    for (const T of tees) if (near(T, x, z) && teeDist(T, x, z) < 4) return 'rough';
    return null;
  }
  const any = landforms.length + greens.length + tees.length + water.length + bunkers.length + rockfalls.length + rivers.length > 0;
  return { landforms, greens, tees, water, rivers, bunkers, rockfalls, groundAt, surfaceAt, any };
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
