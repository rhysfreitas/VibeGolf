// Caverns (pure: no DOM, no Three.js), for underground courses like Hollowmere. Shared by the renderer
// (the roof and wall mesh), the physics (solidAt in terrain.js) and the tests.
// hole.cave: {
//   halls: [{ a:[x,z], b:[x,z], w } | { e:[x,z], rx, rz, rot, p }, ...each with roof (y of the roof) and foot
//           (y where its walls meet the floor)]: the open caverns; everything outside them is rock
//   sky:   [{ x, z, r, upper? }]: openings in the roof (sinkholes, skylights); no roof over them. upper:
//           { h, r, sky } a second cavern above the opening (drawn only), with its own skylight
//   wall:  m over which a wall curves up from its foot to the roof (default 34)
//   stalactites: [{ x, z, y (the tip), r (at the roof) }]: solid cones hanging from the roof
//   marks: scenery the renderer draws (lanterns, crystals, glowworms, mushrooms, falls, rails, geode...) }
// The rock is irregular, the same for the renderer and the ball: walls wander in and out (alcoves and
// bulges), the roof rises and falls in vaults and hangs down in ribs. A wall soaks up some balls (soak:
// the chance it kills the ball's speed so it drops into the rubble at its foot) and bounces the rest.
import { fbm } from './noise.js';

// how far inside a hall a point is (m; negative outside), before the wobble
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
const halfWidth = H => (H.w ? H.w / 2 : Math.min(H.rx, H.rz));
// the wall line wanders: alcoves and bulges, less in a narrow passage
function wobble(H, x, z) {
  const k = Math.min(1, halfWidth(H) / 45);
  return ((fbm(x / 34 + 3.1, z / 34 - 1.7) - 0.5) * 24 + (fbm(x / 11 + 7.3, z / 11 + 2.9) - 0.5) * 7) * k;
}
export const WALL_SOAK = 0.45, STAL_SOAK = 0.2;

export function createCave(cave) {
  const halls = cave.halls || [], sky = cave.sky || [], W = cave.wall || 34;
  const skyAt = (x, z) => sky.some(S => Math.hypot(x - S.x, z - S.z) < S.r);
  // how far inside the open cave a point is, wall wobble and all (negative: in the rock)
  function wallDepth(x, z) { let best = -Infinity; for (const H of halls) best = Math.max(best, hallDepth(H, x, z) + wobble(H, x, z)); return best; }
  const inHall = (x, z) => wallDepth(x, z) > 0;
  // the underside of the rock over a point: the roof, curving down into the walls at each hall's edge;
  // null under open sky, and the deepest foot outside every hall (solid rock)
  function ceilingAt(x, z) {
    if (skyAt(x, z)) return null;
    let best = -Infinity, low = Infinity;
    for (const H of halls) {
      low = Math.min(low, H.foot);
      const d = hallDepth(H, x, z) + wobble(H, x, z); if (d <= 0) continue;
      const t = Math.min(1, d / Math.min(W, halfWidth(H) * 0.8));
      const vault = 1 - (1 - t) ** 3;                                     // walls rise steeply, then the roof
      const span = H.roof - H.foot;
      // vaults rise and fall over the hall; ribs and drapes hang down from it
      const vaults = (fbm(x / 95 + 5.2, z / 95 - 9.1) - 0.5) * span * 0.22;
      const rib = Math.pow(1 - Math.abs(2 * fbm(x / 42 - 3.3, z / 42 + 8.8) - 1), 6) * Math.min(16, span * 0.14);
      const bumps = (fbm(x / 38 + 11, z / 38 - 7) - 0.5) * 9;
      best = Math.max(best, H.foot + (H.roof + vaults + bumps - rib - H.foot) * vault);
    }
    return best === -Infinity ? (low === Infinity ? null : low - 20) : best;
  }
  const stal = (cave.stalactites || []).map(S => ({ ...S, r: S.r || 2.5, base: null }));
  const soaked = (n, soak) => { n.soak = soak; return n; };
  // inside the rock overhead or a stalactite? the outward normal (into the cave, with its soak), else null
  function solidAt(x, y, z) {
    for (const S of stal) {
      if (y < S.y || Math.abs(x - S.x) > S.r || Math.abs(z - S.z) > S.r) continue;
      if (S.base === null) S.base = ceilingAt(S.x, S.z) ?? S.y + 10;
      if (y > S.base) continue;
      const rad = S.r * (y - S.y) / Math.max(1, S.base - S.y), dx = x - S.x, dz = z - S.z, d = Math.hypot(dx, dz);
      if (d < rad) { const L = d || 1; return soaked([dx / L * 0.94, -0.34, dz / L * 0.94], STAL_SOAK); }
    }
    const c = ceilingAt(x, z); if (c === null || y < c) return null;
    const e = 0.75, cx = (ceilingAt(x + e, z) ?? c) - (ceilingAt(x - e, z) ?? c), cz = (ceilingAt(x, z + e) ?? c) - (ceilingAt(x, z - e) ?? c);
    const gx = cx / (2 * e), gz = cz / (2 * e), L = Math.hypot(gx, 1, gz);
    return soaked([gx / L, -1 / L, gz / L], WALL_SOAK);
  }
  return { halls, sky, skyAt, inHall, wallDepth, ceilingAt, solidAt, stalactites: stal, wall: W, marks: cave.marks || [] };
}
