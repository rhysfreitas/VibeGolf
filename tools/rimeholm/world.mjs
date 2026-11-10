// Rimeholm's glacier between and beyond the holes (world frame: x east, -z north), scenery only: crevasse
// fields with raised lips, pressure ridges heaped with ice blocks, bands of seracs and rock peaks (nunataks)
// poking through the ice. Everything stays at least 90 m off every line of play (100 m for the peaks' feet).
// The glacier flows toward the south-south-east, so crevasses run across that and lift on their downhill side.
import { distLine, rnd, smooth, clamp } from './geo.mjs';
import { makeCrack, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';

const toW = h => { const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a); return (x, z) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz]; };
const WL = HOLES.map(h => h.line.map(p => toW(h)(...p)));
const clear = (x, z) => Math.min(...WL.map(L => distLine(L, x, z)));
const FLOW = 160 * Math.PI / 180, fdx = Math.sin(FLOW), fdz = -Math.cos(FLOW);   // the way the ice moves

const R = rnd(4242);
const cracks = [], ridges = [], peaks = [], objs = [];
// candidate spots on a jittered grid round the course
const cand = [];
for (let x = -1100; x <= 2200; x += 190) for (let z = -1500; z <= 1300; z += 190) {
  const X = x + (R() - 0.5) * 100, Z = z + (R() - 0.5) * 100;
  cand.push([X, Z, clear(X, Z)]);
}
// rock peaks first: few, far from play, apart from each other
for (const c of cand.filter(c => c[2] > 420 && c[2] < 1300).sort(() => R() - 0.5)) {
  if (peaks.length >= 9) break;
  if (peaks.some(p => Math.hypot(p.x - c[0], p.z - c[1]) < 520)) continue;
  const r = 110 + R() * 130;
  if (c[2] - r < 120) continue;
  peaks.push({ x: c[0], z: c[1], r, h: 45 + R() * 120, seed: Math.floor(R() * 1000) });
}
const nearPeak = (x, z, pad = 30) => peaks.some(p => Math.hypot(p.x - x, p.z - z) < p.r + pad);
const okLine = (pts, pad) => pts.every(p => clear(...p) > pad && !nearPeak(...p));
for (const [X, Z, d] of cand) {
  if (d < 110 || d > 950 || nearPeak(X, Z, 60)) continue;
  const roll = R();
  const ang = Math.atan2(fdz, fdx) + Math.PI / 2 + (R() - 0.5) * 0.7, ux = Math.cos(ang), uz = Math.sin(ang);
  if (roll < 0.42) {
    // a crevasse field: a few roughly parallel cracks, each a gentle curve
    const n = 2 + Math.floor(R() * 3), gap = 16 + R() * 18;
    for (let i = 0; i < n; i++) {
      const L = 50 + R() * 110, cx = X + fdx * (i - n / 2) * gap + (R() - 0.5) * 20, cz = Z + fdz * (i - n / 2) * gap + (R() - 0.5) * 20;
      const bend = (R() - 0.5) * 0.8, pts = [-1, -0.33, 0.33, 1].map(t => [cx + ux * t * L / 2 + fdx * bend * (1 - t * t) * 12, cz + uz * t * L / 2 + fdz * bend * (1 - t * t) * 12]);
      const w = 3 + R() * 7;
      if (!okLine(pts, 90 + w)) continue;
      cracks.push(makeCrack({ pts, w, seed: 300 + cracks.length, lip: { h: 1.5 + R() * 3, toward: [cx + fdx * 40, cz + fdz * 40], run: 5 + R() * 8, fall: 5 + R() * 4 } }));
    }
  } else if (roll < 0.66) {
    // a pressure ridge: a low heaved line of ice heaped with broken blocks
    const L = 90 + R() * 130, pts = [-1, -0.5, 0, 0.5, 1].map(t => [X + ux * t * L / 2 + fdx * (R() - 0.5) * 14, Z + uz * t * L / 2 + fdz * (R() - 0.5) * 14]);
    if (!okLine(pts, 100)) continue;
    const rd = { pts, h: 2 + R() * 2.5, w: 9 + R() * 6 };
    ridges.push(rd);
    for (let k = 0; k < 4; k++) for (let t = 0; t < 1; t += 0.035 + R() * 0.03) {
      const i = Math.min(3, Math.floor(t * 4)), f = t * 4 - i, a = pts[i], b = pts[i + 1], s = 2 + R() * 4;
      objs.push({ kind: 'iceblock', x: a[0] + (b[0] - a[0]) * f + (R() - 0.5) * rd.w * 0.8, z: a[1] + (b[1] - a[1]) * f + (R() - 0.5) * rd.w * 0.8, r: s, h: s * (0.8 + R() * 0.9), tilt: (R() - 0.5) * 0.9, seed: Math.floor(R() * 1e4) });
      if (k > 1) break;
    }
  } else if (roll < 0.8) {
    // a band of seracs: the broken ice below a steepening
    const L = 60 + R() * 90;
    for (let t = -0.5; t <= 0.5; t += 0.06 + R() * 0.05) for (let row = 0; row < 2 + Math.floor(R() * 2); row++) {
      const x = X + ux * t * L + fdx * row * 12 + (R() - 0.5) * 8, z = Z + uz * t * L + fdz * row * 12 + (R() - 0.5) * 8;
      if (clear(x, z) < 95) continue;
      objs.push({ kind: 'serac', x, z, r: 3 + R() * 3.5, h: 8 + R() * 16, seed: Math.floor(R() * 1e4) });
    }
  }
}

// ground lift from the peaks and ridges (world coords); the cracks lift their own lips
export function layerLift(X, Z) {
  let y = 0;
  for (const p of peaks) {
    const d = Math.hypot(X - p.x, Z - p.z); if (d > p.r * 1.25) continue;
    const n = noise2(X / 45, Z / 45, p.seed) * 0.35 + noise2(X / 14, Z / 14, p.seed + 1) * 0.12;
    const t = clamp(d / p.r + n * 0.4, 0, 1.2);
    y += p.h * Math.pow(Math.max(0, 1 - t), 1.6) * (1 + n);
  }
  for (const r of ridges) { const d = distLine(r.pts, X, Z); if (d < r.w) y += r.h * (0.5 + 0.5 * Math.cos(Math.PI * d / r.w)); }
  return y;
}
export const onPeak = (X, Z) => peaks.some(p => Math.hypot(X - p.x, Z - p.z) < p.r * 1.1);
export const WORLD = { cracks, ridges, peaks, objs, WL };
