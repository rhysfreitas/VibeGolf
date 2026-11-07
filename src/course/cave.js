// Caverns (pure: no DOM, no Three.js), for underground courses like Hollowmere. Shared by the renderer
// (the roof and wall mesh), the physics (solidAt in terrain.js) and the tests.
// hole.cave: {
//   halls: [{ a:[x,z], b:[x,z], w } | { e:[x,z], rx, rz, rot, p }, ...each with roof (y of the roof) and foot
//           (y where its walls meet the floor)]: the open caverns; everything outside them is rock
//   sky:   [{ x, z, r }]: openings in the roof (sinkholes, skylights); no roof over them
//   wall:  m over which a wall curves up from its foot to the roof (default 34)
//   stalactites: [{ x, z, y (the tip), r (at the roof) }]: solid cones hanging from the roof
//   marks: scenery the renderer draws (lanterns, crystals, glowworms, mushrooms, falls, rails...) }
import { fbm, sstep } from './noise.js';

// how far inside a hall a point is (m; negative outside)
export function hallDepth(H, x, z) {
  if (H.e) {
    const dx = x - H.e[0], dz = z - H.e[1], c = Math.cos(H.rot || 0), s = Math.sin(H.rot || 0), p = H.p || 2;
    const u = dx * c + dz * s, v = -dx * s + dz * c;
    const rho = Math.pow(Math.abs(u / H.rx) ** p + Math.abs(v / H.rz) ** p, 1 / p);
    return (1 - rho) * Math.min(H.rx, H.rz);
  }
  const [ax, az] = H.a, [bx, bz] = H.b, dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return H.w / 2 - Math.hypot(x - ax - dx * t, z - az - dz * t);
}

export function createCave(cave) {
  const halls = cave.halls || [], sky = cave.sky || [], W = cave.wall || 34;
  const skyAt = (x, z) => sky.some(S => Math.hypot(x - S.x, z - S.z) < S.r);
  const inHall = (x, z) => halls.some(H => hallDepth(H, x, z) > 0);
  // the underside of the rock over a point: the roof, curving down into the walls at each hall's edge;
  // null under open sky, and the deepest foot outside every hall (solid rock)
  function ceilingAt(x, z) {
    if (skyAt(x, z)) return null;
    let best = -Infinity, low = Infinity;
    for (const H of halls) {
      low = Math.min(low, H.foot);
      const d = hallDepth(H, x, z); if (d <= 0) continue;
      const t = Math.min(1, d / Math.min(W, (H.w ? H.w / 2 : Math.min(H.rx, H.rz)) * 0.8));
      const vault = 1 - (1 - t) * (1 - t);
      const bumps = (fbm(x / 38 + 11, z / 38 - 7) - 0.5) * 9 * vault;
      best = Math.max(best, H.foot + (H.roof + bumps - H.foot) * vault);
    }
    return best === -Infinity ? (low === Infinity ? null : low - 20) : best;
  }
  const stal = (cave.stalactites || []).map(S => ({ ...S, r: S.r || 2.5, base: null }));
  // inside the rock overhead or a stalactite? the outward normal (into the cave), else null
  function solidAt(x, y, z) {
    for (const S of stal) {
      if (y < S.y || Math.abs(x - S.x) > S.r || Math.abs(z - S.z) > S.r) continue;
      if (S.base === null) S.base = ceilingAt(S.x, S.z) ?? S.y + 10;
      if (y > S.base) continue;
      const rad = S.r * (y - S.y) / Math.max(1, S.base - S.y), dx = x - S.x, dz = z - S.z, d = Math.hypot(dx, dz);
      if (d < rad) { const L = d || 1; return [dx / L * 0.94, -0.34, dz / L * 0.94]; }
    }
    const c = ceilingAt(x, z); if (c === null || y < c) return null;
    const e = 0.75, cx = (ceilingAt(x + e, z) ?? c) - (ceilingAt(x - e, z) ?? c), cz = (ceilingAt(x, z + e) ?? c) - (ceilingAt(x, z - e) ?? c);
    const gx = cx / (2 * e), gz = cz / (2 * e), L = Math.hypot(gx, 1, gz);
    return [gx / L, -1 / L, gz / L];
  }
  return { halls, sky, skyAt, inHall, ceilingAt, solidAt, stalactites: stal, wall: W, marks: cave.marks || [] };
}
