// Geometry helpers for the Rimeholm plan data (metres; local hole frame: tee at the origin, the hole runs
// toward -z, x is right of the line; y up). Pure, no DOM. (A copy of tools/reclaim/geo.mjs.)
export const YD = 0.9144;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// a polyline from legs: [[length, turn in degrees (+ = right)], ...], starting at the origin heading -z
export function lineOf(legs) {
  let h = 0, x = 0, z = 0; const pts = [[0, 0]];
  for (const [len, turn] of legs) { h += turn * Math.PI / 180; x += Math.sin(h) * len; z -= Math.cos(h) * len; pts.push([x, z]); }
  return pts;
}
export const lengthOf = L => L.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - L[i][0], p[1] - L[i][1]), 0);
// the point s metres along a polyline, pushed `off` metres to the right of travel
export function at(L, s, off = 0) {
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (s <= l || i === L.length - 2) { const ux = (bx - ax) / l, uz = (bz - az) / l; return [ax + ux * s - uz * off, az + uz * s + ux * off]; }
    s -= l;
  }
}
// heading of travel at s (radians, 0 = -z, + = right)
export function headingAt(L, s) {
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (s <= l || i === L.length - 2) return Math.atan2(bx - ax, -(bz - az));
    s -= l;
  }
}
// nearest point on a polyline: { s, off (+ right), d }
export function project(L, x, z) {
  let best = { d: Infinity, s: 0, off: 0 }, acc = 0;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (l * l), 0, 1), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best.d) {
      // signed offset: right of travel is +
      const cr = (dx * (z - az) - dz * (x - ax)) / l;
      best = { d, s: acc + t * l, off: cr };
    }
    acc += l;
  }
  return best;
}
// distance to a polyline (capsule chain)
export const distLine = (L, x, z) => project(L, x, z).d;
// superellipse distance: < 1 inside. o = { x, z, rx, rz, rot, p }
export function seDist(o, x, z) {
  const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), dx = x - o.x, dz = z - o.z;
  const u = (dx * c + dz * s) / o.rx, v = (-dx * s + dz * c) / o.rz, p = o.p || 2;
  return Math.pow(Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p), 1 / p);
}
// the outline of a superellipse as points (for drawing)
export function seOutline(o, n = 64) {
  const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0), p = o.p || 2, out = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const u = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / p) * o.rx, v = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / p) * o.rz;
    out.push([o.x + u * c - v * s, o.z + u * s + v * c]);
  }
  return out;
}
// point in polygon
export function inPoly(P, x, z) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
// a seeded random stream (the same every run)
export const rnd = seed => { let t = (seed * 2654435761) >>> 0 || 1; return () => { t ^= t << 13; t >>>= 0; t ^= t >>> 17; t ^= t << 5; t >>>= 0; return t / 4294967296; }; };
// rectangle footprint corners: centre, width (across, local x), depth (along, local z), rot (yaw, radians)
export function rectPts(x, z, w, d, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c - v * s, z + u * s + v * c]);
}
// profile: [[s, y], ...] -> y(s), smoothstep between points
export function profileFn(P) {
  return s => {
    if (s <= P[0][0]) return P[0][1];
    for (let i = 0; i < P.length - 1; i++) if (s <= P[i + 1][0]) return lerp(P[i][1], P[i + 1][1], smooth((s - P[i][0]) / (P[i + 1][0] - P[i][0])));
    return P.at(-1)[1];
  };
}
