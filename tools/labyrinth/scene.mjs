// The Labyrinth, plan book round 1: each hole built over the maze (world frame, absolute heights). The floor is the
// world's (world.mjs: the half-pipe, the corridor's lean and kick bank, the causeway, the moat, the terrace, the
// forecourt, the sunken court, the wall top and the breach); a hole adds its green (levelled to the pin, then its
// designed contour), its bunkers and its tee pads, and paints its surfaces: green, fringe, tee, fairway, sand, the
// rough round the mown ground, the maze floor's long grass, rubble along the foot of every standing wall, water, and
// on the Elbow the shut leg as a penalty area.
//
// BUILT[i] is hole i as played in version A (the shared check tools read it); PLAYED is every play, version B of the
// 3rd and 7th included. Each has ground(X, Z), surface(X, Z), gm (metres outside the green), fairwayD, bunkers, pads.
import { HOLES, PLAYS, SETS } from './holes.mjs';
import { floorAt, worldSurface, walls, MAZE, FRAMES, P, ALCOVES, legAt } from './world.mjs';
import { makeGreen, makeFairway, noise2 } from './shapes.mjs';
import { project, headingAt, seDist, seOutline, inPoly, smooth, clamp, lerp, distLine } from './geo.mjs';

export const SURF = ['floor', 'rough', 'rubble', 'wall', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'penalty'];
// how the game would play each (the plan's names for its surfaces): the maze floor is long grass, rubble and the wall
// foot native ground, the shut leg a penalty area with no bed
export const PHYS = { floor: 'rough', rough: 'rough', rubble: 'desert', wall: 'desert', fairway: 'fairway', fringe: 'fairway', green: 'green', tee: 'fairway', sand: 'sand', water: 'water', penalty: 'water' };

// a green's contour in its own frame (as tools/cloudrest)
const dirUV = a => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
export function contourAt(C, u, v) {
  let g = 0;
  for (const c of C || []) {
    if (c.fall != null) { const [du, dv] = dirUV(c.fall); g -= (u * du + v * dv) * c.pct / 100; }
    else if (c.tier) { const [du, dv] = dirUV(c.up), d = (u - c.tier[0]) * du + (v - c.tier[1]) * dv; g += c.h * smooth(d / c.w + 0.5); }
    else if (c.ridge) { const d = distLine(c.ridge, u, v); g += c.h * Math.exp(-((d / c.w) ** 2)); }
    else if (c.bowl) { const d = Math.hypot(u - c.bowl[0], v - c.bowl[1]); g -= c.h * Math.exp(-((d / (c.r / 2)) ** 2)); }
  }
  return g;
}

// ---- the walls on a 2 m grid: which cell is under a standing wall, and how far each cell is from one -------------
// (a standing wall: 5 m or more over the floor, not a lintel, door, parapet or the ground-topped wall tops)
const G = 2, GX0 = MAZE.x0 - 60, GZ0 = -MAZE.y1 - 60, GW = Math.ceil((MAZE.x1 - MAZE.x0 + 120) / G), GH = Math.ceil((MAZE.y1 - MAZE.y0 + 120) / G);
const WD = new Float32Array(GW * GH).fill(1e9);
const standing = w => !w.ground && !['lintel', 'door', 'parapet'].includes(w.kind) && !w.pier && +w.y1 - floorAt(...w.pts[0]) > 5;
for (const w of walls()) {
  if (!standing(w)) continue;
  const xs = w.pts.map(p => p[0]), zs = w.pts.map(p => p[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - GX0) / G)), c1 = Math.min(GW - 1, Math.ceil((Math.max(...xs) - GX0) / G));
  const r0 = Math.max(0, Math.floor((Math.min(...zs) - GZ0) / G)), r1 = Math.min(GH - 1, Math.ceil((Math.max(...zs) - GZ0) / G));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (inPoly(w.pts, GX0 + (c + 0.5) * G, GZ0 + (r + 0.5) * G)) WD[r * GW + c] = 0;
}
{ // chamfer distance (3-4), in metres
  const a = G, b = G * Math.SQRT2, f = (i, j, d) => { if (j >= 0 && j < GW * GH && WD[j] + d < WD[i]) WD[i] = WD[j] + d; };
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) { const i = r * GW + c; if (c > 0) f(i, i - 1, a); if (r > 0) { f(i, i - GW, a); if (c > 0) f(i, i - GW - 1, b); if (c < GW - 1) f(i, i - GW + 1, b); } }
  for (let r = GH - 1; r >= 0; r--) for (let c = GW - 1; c >= 0; c--) { const i = r * GW + c; if (c < GW - 1) f(i, i + 1, a); if (r < GH - 1) { f(i, i + GW, a); if (c < GW - 1) f(i, i + GW + 1, b); if (c > 0) f(i, i + GW - 1, b); } }
}
// metres from the nearest standing wall's footprint (0 under one)
export const wallD = (X, Z) => { const c = Math.floor((X - GX0) / G), r = Math.floor((Z - GZ0) / G); return c < 0 || r < 0 || c >= GW || r >= GH ? 1e9 : WD[r * GW + c]; };

// the Elbow's shut leg: the other way's court and its leg past the door (a penalty area, Rhys's pick, 16 November)
const inF = (F, X, Z, s0, s1, o0, o1) => { const p = legAt(F, X, -Z); return p.s >= s0 && p.s <= s1 && p.off >= o0 && p.off <= o1; };
const box2 = (x0, y0, x1, y1) => (X, Z) => X >= x0 && X <= x1 && -Z >= y0 && -Z <= y1;
const SHUT3 = { A: (X, Z) => inF(FRAMES.F3R, X, Z, 35, 175, -40, 40) || box2(585, 360, 690, 445)(X, Z),
  B: (X, Z) => inF(FRAMES.F3L, X, Z, 35, 175, -40, 40) || box2(770, 360, 875, 445)(X, Z) };
// the 2nd's kick bank behind the green, mown to the wall's foot
const BANK2 = (h, X, Z) => { if (h.n !== 2) return false; const p = legAt(FRAMES.F2, X, -Z); return p.s > h.len - 4 && p.s < h.len + 35 && Math.abs(p.off) < 29; };

export function buildPlay(h) {
  const GR = makeGreen(h.pin, h.head, { seed: 70 + h.n * 3 + (h.ver === 'B' ? 1 : 0), ...h.green });
  const gm = GR.gm, gUV = GR.uv, fwD = makeFairway(h.line, h.fw || []);
  const pinY = floorAt(...h.pin);
  const bunkers = (h.bunkers || []).map((b, i) => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: (b.rot || 0) * Math.PI / 180 + h.head, seed: 40 + i + h.n * 9, depth: 1.1 }));
  for (const b of bunkers) {   // a greenside one sits at least 2.5 m outside the green's edge
    if (Math.hypot(b.x - h.pin[0], b.z - h.pin[1]) > 45) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
  }
  const edgeM = (b, x, z) => (seDist(b, x, z) + 0.1 * noise2(x / 3, z / 3, b.seed) - 1) * Math.min(b.rx, b.rz);
  const inBunker = (b, x, z) => Math.abs(x - b.x) < b.rx + b.rz && Math.abs(z - b.z) < b.rx + b.rz && edgeM(b, x, z) < 0;
  // tee pads: 10 m across, 12 m deep, square to the line where it starts, level at the floor there + 0.3
  const th = headingAt(h.line, 1), tc = Math.cos(th), ts = Math.sin(th);
  const pad = (key, p) => ({ k: key, x: p[0], z: p[1], y: floorAt(...p) + 0.3 });
  const pads = SETS.map(k => pad(k, h.teePts[k])), tipsPad = h.tips ? pad('tips', h.tips.tee) : null;
  const onPad = (t, x, z, m = 0) => { const u = (x - t.x) * tc + (z - t.z) * ts, v = (x - t.x) * ts - (z - t.z) * tc; return Math.abs(u) < 5 + m && Math.abs(v) < 6 + m; };

  function ground(X, Z) {
    let y = floorAt(X, Z);
    const go = gm(X, Z);
    const bl = h.green.blend ?? 9;
    if (go < bl) {   // the green levelled to the pin's height, then its contour (the collar blends it back over 9 m, or `blend`)
      const t = 1 - smooth((go + 1) / (bl + 1)), [u, v] = gUV(X, Z);
      y = lerp(y, pinY, t) + contourAt(h.green.contour, u, v) * (1 - smooth((go - 0.5) / 6));
    }
    for (const b of bunkers) { const e = edgeM(b, X, Z); if (e < 2) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    for (const t of [...pads, tipsPad]) {
      if (!t) continue;
      if (onPad(t, X, Z)) return t.y;
      const d = Math.hypot(X - t.x, Z - t.z); if (d < 13 && Math.abs(y - t.y) < 1.8) y = lerp(t.y, y, smooth((d - 7) / 6));
    }
    return y;
  }
  const slope = (X, Z) => { const d = 1.5; return Math.hypot(ground(X + d, Z) - ground(X - d, Z), ground(X, Z + d) - ground(X, Z - d)) / (2 * d); };
  function surface(X, Z) {
    const go = gm(X, Z);
    if (go < 0) return 'green';
    const ws = worldSurface(X, Z), wd = wallD(X, Z);
    if (ws === 'water' && go > 2) return 'water';
    if (h.n === 3 && SHUT3[h.ver || 'A'](X, Z)) return 'penalty';
    for (const b of bunkers) if (inBunker(b, X, Z)) return 'sand';
    if (wd === 0) return 'wall';
    if (go < (h.green.apron || 2.5)) return 'fringe';
    for (const t of [...pads, tipsPad]) if (t && onPad(t, X, Z)) return 'tee';
    if (BANK2(h, X, Z)) return 'fairway';
    const fd = fwD(X, Z);
    if (fd < 0 && slope(X, Z) < (h.mown ?? 0.3)) return 'fairway';
    if (ws === 'rubble' || wd < 3 + 1.2 * noise2(X / 6, Z / 6, 5)) return 'rubble';
    if (go < 9 + 2 * noise2(X / 13, Z / 13, 7) || fd < 8 + 3 * noise2(X / 17, Z / 17, 8)) return 'rough';
    for (const t of [...pads, tipsPad]) if (t && Math.hypot(X - t.x, Z - t.z) < 12) return 'rough';
    return 'floor';
  }
  return { h, ground, surface, gm, gUV, fairwayD: fwD, bunkers, pads, tipsPad, pinY, onPad, edgeM };
}

export const PLAYED = PLAYS.map(buildPlay);
export const BUILT = HOLES.map(h => PLAYED.find(B => B.h.n === h.n));
