// green and fairway slope measures for the book's checks: each green's fall, its relief beyond that plane,
// the slope at the pin and its pin areas (discs 6 m across, all at 3% or less, 3 m or more inside the edge, 8 m apart) and the cuppable share (3 m inside the edge, at 3% or less with nothing steeper within 1 m); and the
// fairway's lean across the line where drives land
import { at } from './geo.mjs';
export function greenStats(B, opt = {}) {
  const h = B.h, G = (x, z) => B.ground(x, z, true), R = opt.r ?? 5, D = 0.75;
  const slope = (x, z) => Math.hypot(G(x + D, z) - G(x - D, z), G(x, z + D) - G(x, z - D)) / (2 * D) * 100;
  const pts = [];
  for (let x = h.pin[0] - 40; x <= h.pin[0] + 40; x += 1) for (let z = h.pin[1] - 40; z <= h.pin[1] + 40; z += 1) {
    const e = B.gm(x, z); if (e < 0) pts.push({ x, z, y: G(x, z), e, s: slope(x, z) });
  }
  const n = pts.length; let mx = 0, mz = 0, my = 0; for (const p of pts) { mx += p.x; mz += p.z; my += p.y; } mx /= n; mz /= n; my /= n;
  let cxx = 0, czz = 0, cxz = 0, cxy = 0, czy = 0;
  for (const p of pts) { const dx = p.x - mx, dz = p.z - mz, dy = p.y - my; cxx += dx * dx; czz += dz * dz; cxz += dx * dz; cxy += dx * dy; czy += dz * dy; }
  const det = cxx * czz - cxz * cxz, a = (cxy * czz - czy * cxz) / det, c = (czy * cxx - cxy * cxz) / det;
  let lo = Infinity, hi = -Infinity; for (const p of pts) { const r = p.y - (my + a * (p.x - mx) + c * (p.z - mz)); lo = Math.min(lo, r); hi = Math.max(hi, r); }
  const key = (x, z) => `${x},${z}`, M = new Map(pts.map(p => [key(p.x, p.z), p]));
  const cands = [];
  for (const p of pts) {
    if (p.e > -3) continue;
    let ok = true, worst = 0;
    for (let dx = -R; dx <= R && ok; dx++) for (let dz = -R; dz <= R; dz++) { if (dx * dx + dz * dz > R * R) continue; const q = M.get(key(p.x + dx, p.z + dz)); if (!q || q.s > 3) { ok = false; break; } worst = Math.max(worst, q.s); }
    if (ok) cands.push({ ...p, worst });
  }
  cands.sort((p, q) => p.worst - q.worst);
  const areas = [];
  for (const p of cands) if (areas.every(q => Math.hypot(p.x - q.x, p.z - q.z) >= 8)) areas.push(p);
  const steep = pts.filter(p => p.s > 3).length / n;
  let cup = 0; for (const p of pts) { if (p.e > -3) continue; let ok = true; for (let dx = -1; dx <= 1 && ok; dx++) for (let dz = -1; dz <= 1; dz++) { const q = M.get(key(p.x + dx, p.z + dz)); if (!q || q.s > 3) { ok = false; break; } } if (ok) cup++; }
  const med = pts.map(p => p.s).sort((a, b) => a - b)[Math.floor(n / 2)];
  return { area: n, cup: cup / n, median: med, fall: Math.hypot(a, c) * 100, fallDir: Math.atan2(-a, -c), relief: hi - lo, raw: Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y)),
    pinSlope: slope(...h.pin), areas, steep, maxSlope: Math.max(...pts.map(p => p.s)) };
}
// lean across the fairway (positive = falls to the right of the line), every 5 m along it
export function leanAlong(B, s0 = 40, s1 = B.h.len - 50, half = 12) {
  const h = B.h, G = (x, z) => B.ground(x, z, true), out = [];
  for (let s = s0; s <= s1; s += 5) {
    const p = at(h.line, s, 0); if (B.fairwayD(p[0], p[1]) > 0) continue;
    const l = at(h.line, s, -half), r = at(h.line, s, half), gl = G(...l), gr = G(...r);
    if (gl == null || gr == null || ['water', 'tar', 'cliff'].includes(B.surface(...l)) || ['water', 'tar', 'cliff'].includes(B.surface(...r))) continue;
    out.push([s, (gl - gr) / (2 * half) * 100]);
  }
  return out;
}
