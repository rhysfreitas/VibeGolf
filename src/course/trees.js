// Trees the ball can hit. Pure (no DOM, no Three.js): the renderer draws the same list and the
// physics asks treeAt() what is at a point.
//
// A tree is { x, y, z, s, type, r } as the renderer places it (y = the ground at its foot, s = scale,
// r = a 0-1 random). Its body is a trunk (a cylinder) under a canopy (an ellipsoid). A ball inside a
// canopy may hit branches: the chance grows with the distance it travels through the leaves, so a
// ball clipping the edge often slips through and one flown into the middle rarely does.
import { rng } from './noise.js';

// [height of the bare trunk per unit scale, canopy size per unit scale, trunk thickness] (the
// renderer's shapes; pines are cones and are handled apart)
export const TREE_SHAPES = { oak: [2.5, 3, 1], juniper: [0.5, 1.5, 0.6], pinyon: [1.2, 1.9, 0.7], cotton: [4.5, 3.6, 1.4], mushroom: [3.2, 2.4, 1.8] };
// chance per metre of hitting a branch inside the canopy
const DENSITY = { pine: 0.34, oak: 0.3, juniper: 0.5, pinyon: 0.42, cotton: 0.28, mushroom: 0.6 }; // a giant mushroom's cap is dense

export function treeBody(t) {
  if (t.type === 'pine') {
    const H = 7 * t.s + 4 * t.r;
    return { x: t.x, z: t.z, y: t.y, cy: t.y + H * 0.55, rh: 1.7 * t.s, rv: H * 0.42, top: t.y + H * 0.4, tr: Math.max(0.15, 0.22 * t.s), density: DENSITY.pine };
  }
  const sh = TREE_SHAPES[t.type] || TREE_SHAPES.oak, H = sh[0] * t.s, cs = sh[1] * t.s;
  return { x: t.x, z: t.z, y: t.y, cy: t.y + H + cs * 0.55, rh: cs * 1.05, rv: cs * 0.75, top: t.y + H + cs * 0.3, tr: Math.max(0.12, 0.22 * t.s * sh[2]), density: DENSITY[t.type] ?? 0.3 };
}

// a lookup over a list of trees: at(x, y, z) -> { n: [nx, 0, nz] } against a trunk, { density } inside a
// canopy, or null
export function createTreeField(list, cell = 10) {
  const bodies = list.filter(t => t.y != null && Number.isFinite(t.y)).map(treeBody), grid = new Map();
  const key = (i, j) => i * 73856093 ^ j * 19349663;
  for (const B of bodies) {
    const R = Math.max(B.rh, B.tr) + 0.1;
    for (let i = Math.floor((B.x - R) / cell); i <= Math.floor((B.x + R) / cell); i++)
      for (let j = Math.floor((B.z - R) / cell); j <= Math.floor((B.z + R) / cell); j++) {
        const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(B);
      }
  }
  function at(x, y, z) {
    const L = grid.get(key(Math.floor(x / cell), Math.floor(z / cell))); if (!L) return null;
    for (const B of L) {
      const dx = x - B.x, dz = z - B.z;
      if (y < B.y - 0.5) continue;
      const d = Math.hypot(dx, dz);
      if (y < B.top && d < B.tr + 0.04) return { n: d > 1e-6 ? [dx / d, 0, dz / d] : [1, 0, 0] };
      const e = (dx * dx + dz * dz) / (B.rh * B.rh) + ((y - B.cy) / B.rv) ** 2;
      if (e < 1) return { density: B.density };
    }
    return null;
  }
  return { at, bodies, count: bodies.length };
}

// a grove: { x, z, rx, rz, rot, n, type, s: [min, max], seed } -> trees scattered over the ellipse,
// spaced so the canopies touch without stacking
export function groveTrees(G, groundAt) {
  const R = rng(G.seed ?? Math.round(G.x * 7 + G.z * 3)), out = [], c = Math.cos(G.rot || 0), sn = Math.sin(G.rot || 0);
  const [s0, s1] = G.s || [1.1, 1.7], type = G.type || 'cotton';
  for (let i = 0; i < (G.n || 8) * 30 && out.length < (G.n || 8); i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()), u = Math.cos(a) * r * G.rx, v = Math.sin(a) * r * G.rz;
    const x = G.x + u * c - v * sn, z = G.z + u * sn + v * c, s = s0 + R() * (s1 - s0);
    const gap = (TREE_SHAPES[type] || TREE_SHAPES.oak)[1] * s * 1.1;
    if (out.some(t => Math.hypot(t.x - x, t.z - z) < gap)) continue;
    const y = groundAt(x, z); if (y === null) continue;
    out.push({ x, y, z, s, type, r: R() });
  }
  return out;
}
