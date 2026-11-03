// Island Hopper rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// World frame: x right, y up, -z ahead, metres. Each hop starts from where the ball came to rest.
// Design: docs/MINIGAMES.md §4. Difficulty sets island size; islands shrink as the run goes on.

export const YD = 0.9144;
export const LIVES = 3;
export const PAD_FRAC = 0.22;     // the glowing pad is this share of the island's radius
export const VOID_Y = -140;       // below this (relative to the ball) the ball is lost in the clouds

export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', r: 20, note: 'Big islands (about 44 yd across) with wide landing pads.' },
  { id: 'amateur', label: 'Amateur', r: 15, note: 'Medium islands (about 33 yd across).' },
  { id: 'pro', label: 'Pro', r: 11, note: 'Small islands (about 24 yd across).' },
  { id: 'tour', label: 'Tour', r: 8, note: 'Tiny islands (about 17 yd across). Every hop is a dart.' },
];

export const BANDS = [
  { id: 'short', name: 'Short', yd: [70, 105], points: 100, rScale: 0.92, dy: [-12, 8] },
  { id: 'mid', name: 'Mid', yd: [120, 165], points: 200, rScale: 1, dy: [-16, 6] },
  { id: 'long', name: 'Long', yd: [180, 235], points: 350, rScale: 1.12, dy: [-22, 2] },
];
export const band = id => BANDS.find(b => b.id === id);

export const CHALLENGES = [
  { id: 'hop10', text: 'Reach island 10', key: 'hops', goal: 10 },
  { id: 'hop6', text: 'Reach island 6', key: 'hops', goal: 6, only: ['pro', 'tour'] },
  { id: 'pad3', text: 'Land on 3 glowing pads', key: 'pads', goal: 3 },
  { id: 'long1', text: 'Make a long hop', key: 'longHops', goal: 1 },
  { id: 'long3', text: 'Make 3 long hops', key: 'longHops', goal: 3, only: ['beginner', 'amateur'] },
  { id: 'x4', text: 'Reach a ×4 streak', key: 'mult', goal: 4 },
  { id: 'clean5', text: 'Hop 5 times without falling', key: 'cleanRun', goal: 5 },
];

/* ---------- island shape (shared by physics and meshes) ---------- */
export function wob(I, th) { const s = I.seed; return 1 + 0.07 * Math.sin(3 * th + s) + 0.045 * Math.sin(5 * th + 2.1 * s) + 0.025 * Math.sin(9 * th + 3.3 * s); }
export const edgeR = (I, th) => I.r * wob(I, th);
export function islandFrac(I, x, z) { const dx = x - I.x, dz = z - I.z; return Math.hypot(dx, dz) / edgeR(I, Math.atan2(dz, dx)); }
export function islandTop(I, x, z, f = islandFrac(I, x, z)) {
  let h = I.y + 0.35 * Math.sin(x * 0.13 + I.seed) * Math.cos(z * 0.11 + I.seed * 1.7);
  if (f > 0.88) h -= Math.pow((f - 0.88) / 0.12, 2) * 0.9; // rounded lip
  return h;
}
export function islandAt(islands, x, z) {
  for (const I of islands) { if (Math.abs(x - I.x) > I.r * 1.2 || Math.abs(z - I.z) > I.r * 1.2) continue; if (islandFrac(I, x, z) <= 1) return I; }
  return null;
}
export function groundAt(islands, x, z) {
  let best = null;
  for (const I of islands) {
    if (Math.abs(x - I.x) > I.r * 1.2 || Math.abs(z - I.z) > I.r * 1.2) continue;
    const f = islandFrac(I, x, z);
    if (f <= 1) { const h = islandTop(I, x, z, f); if (best === null || h > best) best = h; }
  }
  return best;
}

/* ---------- the next set of islands ---------- */
let nextId = 1;
export function startIsland(diff) { const r = Math.max(10, diff.r * 0.9); return { id: nextId++, band: 'start', x: 0, y: 0, z: r * 0.45, r, seed: 1.3 }; } // ball near the front edge

// Three islands ahead of `from` (the ball): short, mid, long, at different angles and heights.
export function makeOptions(from, hop, diff, rand = Math.random, avoid = []) {
  const scale = Math.max(0.55, 1 - 0.035 * hop);
  const angs = [-17, 0, 17]; for (let i = 2; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [angs[i], angs[j]] = [angs[j], angs[i]]; }
  const placed = [];
  BANDS.forEach((b, i) => {
    let best = null;
    for (let t = 0; t < 60 && !best; t++) {
      const yd = b.yd[0] + rand() * (b.yd[1] - b.yd[0]), d = yd * YD;
      const a = (angs[i] + (rand() - 0.5) * (t < 20 ? 8 : 26)) * Math.PI / 180;
      const I = { id: nextId++, band: b.id, x: from.x + Math.sin(a) * d, z: from.z - Math.cos(a) * d, y: from.y + b.dy[0] + rand() * (b.dy[1] - b.dy[0]), r: diff.r * scale * b.rScale, seed: rand() * 10 };
      const clear = [...avoid, ...placed].every(J => Math.hypot(I.x - J.x, I.z - J.z) > I.r + J.r + 6);
      if (clear) best = I;
    }
    if (best) placed.push(best);
  });
  return placed;
}
export const padRadius = I => Math.max(1.4, I.r * PAD_FRAC);
export const distYd = (from, I) => Math.hypot(I.x - from.x, I.z - from.z) / YD;

/* ---------- what a shot did ---------- */
// pts: physics points in the shot's local frame (ball at `from`). Returns the outcome.
export function resolveHop(pts, outcome, from, current, options) {
  const all = [current, ...options];
  const end = pts[pts.length - 1].p, wx = end[0] + from.x, wz = end[2] + from.z;
  if (outcome !== 'void') {
    const I = islandAt(all, wx, wz);
    if (I && I !== current) {
      const pad = Math.hypot(wx - I.x, wz - I.z) <= padRadius(I);
      const b = band(I.band);
      return { kind: 'hop', island: I, pad, points: b.points * (pad ? 2 : 1), rest: { x: wx, y: end[1] + from.y, z: wz }, yd: distYd(from, I) };
    }
    if (I === current) return { kind: 'stayed', rest: { x: wx, y: end[1] + from.y, z: wz } };
  }
  return { kind: 'fall', ...nearestMiss(pts, from, options) };
}

// How far the ball missed the nearest island's edge (yards), and whether it landed and rolled off.
export function nearestMiss(pts, from, options) {
  let best = { missYd: Infinity, island: null, rolledOff: false };
  for (const I of options) {
    const dy = I.y - from.y;
    let p = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1].p, b = pts[i].p;
      if (a[1] >= dy && b[1] < dy) { const f = (a[1] - dy) / (a[1] - b[1]); p = [a[0] + (b[0] - a[0]) * f, a[2] + (b[2] - a[2]) * f]; break; }
    }
    if (!p) continue;
    const x = p[0] + from.x, z = p[1] + from.z, th = Math.atan2(z - I.z, x - I.x);
    const missM = Math.hypot(x - I.x, z - I.z) - edgeR(I, th);
    const rolledOff = missM <= 0;
    const yd = Math.max(0, missM) / YD;
    if (yd < best.missYd) best = { missYd: yd, island: I, rolledOff };
  }
  return best;
}

/* ---------- aiming help (simulated Hit / Ideal shot) ---------- */
// Ball data that comes to rest near the centre of island `I` from `from`, using the real islands.
export function solveHop(simulate, clubs, from, I, islands) {
  const tx = I.x - from.x, tz = I.z - from.z, dist = Math.hypot(tx, tz);
  const hla = Math.atan2(tx, -tz) * 180 / Math.PI;
  const g = (x, z) => { const v = groundAt(islands, x + from.x, z + from.z); return v === null ? null : v - from.y; };
  const ball = (c, k) => ({ Speed: c.Speed * k, VLA: c.VLA + (1 - k) * 7, HLA: hla, TotalSpin: c.TotalSpin * (0.65 + 0.35 * k), SpinAxis: 0 });
  const run = b => simulate(b, { groundAt: g, voidY: VOID_Y });
  const along = r => { const p = r.pts[r.pts.length - 1].p; return (p[0] * tx + p[2] * tz) / dist; };
  let ci = 0;                                    // longest club if nothing shorter gets there
  for (let i = clubs.length - 1; i >= 0; i--) { if (along(run(ball(clubs[i], 1))) >= dist) { ci = i; break; } }
  const c = clubs[ci];
  let lo = 0.3, hi = 1, k = 1, r = run(ball(c, 1));
  if (along(r) > dist) {
    for (let it = 0; it < 16; it++) { k = (lo + hi) / 2; r = run(ball(c, k)); if (along(r) > dist) hi = k; else lo = k; }
    k = (lo + hi) / 2; r = run(ball(c, k));
  }
  return { club: ci, k, ball: ball(c, k), flightTime: r.flightTime, outcome: r.outcome };
}

// Where the next shot is played from after landing on island I: its front edge, facing on.
export function teeSpot(I) {
  const th = -Math.PI / 2, d = edgeR(I, th) * 0.6;
  const x = I.x, z = I.z - d;
  return { x, y: islandTop(I, x, z), z };
}
