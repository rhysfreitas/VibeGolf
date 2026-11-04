// Carnival Booth rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: ball on the counter at the origin, aim down -z, x right, y up, metres.
// Design: docs/MINIGAMES.md §3. A life-size tin shooting gallery: cans, bullseye boards, a rail of
// ducks gliding slowly across, and the prize bell. Difficulty sets target size.

import { toolBall } from './aim.js';
export const YD = 0.9144;
export const SHOTS = 12;

export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', s: 1.3, lead: true, note: 'Big targets, and a marker shows where to aim ahead of the ducks.' },
  { id: 'amateur', label: 'Amateur', s: 1.0, lead: false, note: 'Standard targets. Lead the ducks yourself.' },
  { id: 'pro', label: 'Pro', s: 0.78, lead: false, note: 'Smaller targets.' },
  { id: 'tour', label: 'Tour', s: 0.6, lead: false, note: 'Small targets. The bell is a real prize.' },
];

// rows of the gallery (sizes at Amateur; multiplied by the difficulty's s)
export const ROWS = {
  cans: { name: 'Cans', yd: 75, points: 100, z: -75 * YD, shelf: 0.9, r: 2.0, h: 5.4, xs: [-27, -9, 9, 27] },
  boards: { name: 'Boards', yd: 120, points: 150, z: -120 * YD, cy: 10, R: 5.4, xs: [-18, 18], bull: 0.25 },
  ducks: { name: 'Ducks', yd: 150, points: 300, z: -150 * YD, rail: 11, w: 7.5, h: 6.0, n: 5, x0: -50, x1: 50, speed: 2.4, center: 0.32 },
  bell: { name: 'Bell', yd: 210, points: 500, z: -210 * YD, x: 0, cy: 26, r: 3.4 },
};
export const ROW_IDS = ['cans', 'boards', 'ducks', 'bell'];
// solid parts of the set a ball stops against (no tickets): the front of the can shelf, the painted
// sea wall under the duck rail, and the sky backdrop at the far end
export const WALLS = [
  { z: ROWS.cans.z + 2.3, top: ROWS.cans.shelf, half: 32 },
  { z: ROWS.ducks.z - 1.5, top: ROWS.ducks.rail, half: 54 },
  { z: -230, top: 34, half: 54 },
];
export const PERFECT_MULT = 2;

export const CHALLENGES = [
  { id: 'bell', text: 'Ring the prize bell', key: 'bells', goal: 1 },
  { id: 'ducks3', text: 'Knock down 3 ducks', key: 'ducks', goal: 3 },
  { id: 'cans', text: 'Clear the can row', key: 'canRows', goal: 1 },
  { id: 'bull2', text: 'Hit 2 bullseyes', key: 'bulls', goal: 2 },
  { id: 'rows4', text: 'Hit something in every row', key: 'rows', goal: 4, only: ['beginner', 'amateur'] },
  { id: 'duckC', text: 'Hit a duck dead centre', key: 'duckCenters', goal: 1, only: ['pro', 'tour'] },
  { id: 'x4', text: 'Reach a ×4 streak', key: 'mult', goal: 4 },
];

// tickets (the score) → prize
export const PRIZES = [
  { id: 'none', name: 'Try again', min: 0 },
  { id: 'small', name: 'Small plush', min: 300 },
  { id: 'medium', name: 'Medium plush', min: 800 },
  { id: 'giant', name: 'Giant plush', min: 1600 },
];
export const prizeFor = tickets => [...PRIZES].reverse().find(p => tickets >= p.min);
export const nextPrize = tickets => PRIZES.find(p => p.min > tickets) || null;

/* ---------- layout for a difficulty ---------- */
export function layout(diff) {
  const s = diff.s, C = ROWS.cans, B = ROWS.boards, D = ROWS.ducks, L = ROWS.bell;
  return {
    s,
    cans: C.xs.map((x, i) => ({ i, x, z: C.z, y0: C.shelf, r: C.r * s, h: C.h * s })),
    boards: B.xs.map((x, i) => ({ i, x, z: B.z, cy: B.cy, R: B.R * s })),
    ducks: { z: D.z, y0: D.rail, w: D.w * s, h: D.h * s, n: D.n, x0: D.x0, x1: D.x1, speed: D.speed },
    bell: { x: L.x, z: L.z, cy: L.cy, r: L.r * s },
  };
}
// where duck i is at game time t (they loop: off the right end, back in at the left)
export function duckX(rail, i, t) {
  const L = rail.x1 - rail.x0, gap = L / rail.n;
  return rail.x0 + (((i * gap + rail.speed * t) % L) + L) % L;
}
export const duckLap = (rail, i, t) => Math.floor((i * (rail.x1 - rail.x0) / rail.n + rail.speed * t) / (rail.x1 - rail.x0));

/* ---------- what the ball hit ---------- */
// pts: physics points (t, p). state: { cansDown: [bool], ducksDown: [bool], t0 } (t0 = game time at launch).
// Returns the first thing hit: { kind, i, t, p:[x,y,z], perfect, d } or null, plus the nearest miss.
const BALL = 0.0214;
export function findHit(pts, lay, state) {
  const { cans, boards, ducks: D, bell } = lay;
  let near = { yd: Infinity, kind: null };
  const consider = (kind, m) => { const yd = Math.max(0, m) / YD; if (yd < near.yd) near = { yd, kind }; };
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], A = a.p, Bp = b.p;
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]);
    let best = null;
    const take = (f, hit) => { if (!best || f < best.f) best = { f, ...hit }; };
    const at = f => [A[0] + (Bp[0] - A[0]) * f, A[1] + (Bp[1] - A[1]) * f, A[2] + (Bp[2] - A[2]) * f];
    const time = f => a.t + (b.t - a.t) * f;
    // vertical planes: boards, ducks, bell (crossing going downrange)
    const cross = z => (A[2] > z && Bp[2] <= z ? (A[2] - z) / (A[2] - Bp[2]) : null);
    let f = boards.length ? cross(boards[0].z) : null;
    if (f !== null) {
      const p = at(f);
      for (const bd of boards) {
        const d = Math.hypot(p[0] - bd.x, p[1] - bd.cy);
        if (d <= bd.R + BALL) take(f, { kind: 'boards', i: bd.i, p, perfect: d <= bd.R * ROWS.boards.bull, d: d / bd.R });
        else consider('boards', d - bd.R);
      }
    }
    f = cross(D.z);
    if (f !== null) {
      const p = at(f), t = state.t0 + time(f), cy = D.y0 + D.h / 2;
      for (let i = 0; i < D.n; i++) {
        if (state.ducksDown && state.ducksDown[i]) continue;
        const dx = (p[0] - duckX(D, i, t)) / (D.w / 2), dy = (p[1] - cy) / (D.h / 2), e = Math.hypot(dx, dy);
        if (e <= 1) take(f, { kind: 'ducks', i, p, perfect: e <= ROWS.ducks.center, d: e });
        else consider('ducks', (e - 1) * D.w / 2);
      }
    }
    for (const w of WALLS) { const fw = cross(w.z); if (fw !== null) { const p = at(fw); if (p[1] <= w.top && Math.abs(p[0]) <= w.half) take(fw, { kind: 'wall', i: 0, p, perfect: false, d: 0 }); } }
    f = cross(bell.z);
    if (f !== null) { const p = at(f), d = Math.hypot(p[0] - bell.x, p[1] - bell.cy); if (d <= bell.r + BALL) take(f, { kind: 'bell', i: 0, p, perfect: d <= bell.r * 0.4, d: d / bell.r }); else consider('bell', d - bell.r); }
    // cans: upright cylinders on the shelf (the ball can hit one on the way down or skipping in)
    const nSub = Math.max(1, Math.ceil(len / 0.25));
    for (const c of cans) {
      if (state.cansDown && state.cansDown[c.i]) continue;
      if (Math.min(A[2], Bp[2]) > c.z + c.r + 1 || Math.max(A[2], Bp[2]) < c.z - c.r - 1) continue;
      for (let s = 1; s <= nSub; s++) {
        const ff = s / nSub, p = at(ff), dxz = Math.hypot(p[0] - c.x, p[2] - c.z);
        if (dxz <= c.r + BALL && p[1] >= c.y0 && p[1] <= c.y0 + c.h) { take(ff, { kind: 'cans', i: c.i, p, perfect: false, d: dxz / c.r }); break; }
      }
      // closest approach for "so close"
      const crossC = cross(c.z);
      if (crossC !== null) { const p = at(crossC), dx = Math.abs(p[0] - c.x) - c.r, dy = p[1] < c.y0 ? c.y0 - p[1] : p[1] > c.y0 + c.h ? p[1] - c.y0 - c.h : 0; consider('cans', Math.hypot(Math.max(0, dx), dy)); }
    }
    if (best) return { hit: { ...best, t: time(best.f) }, near };
  }
  return { hit: null, near };
}

// The ball after it hits a target: it stops dead, pops back a little and drops to the floor.
export function bounceOff(pts, hit, floorY = 0) {
  const out = pts.filter(q => q.t < hit.t).map(q => ({ ...q, phase: 'flight' }));
  out.push({ t: hit.t, p: [...hit.p], phase: 'flight' });
  const last = out.length > 2 ? out[out.length - 2] : out[0];
  const dt0 = Math.max(1e-3, hit.t - last.t), vx = (hit.p[0] - last.p[0]) / dt0, vz = (hit.p[2] - last.p[2]) / dt0;
  let v = [-vx * 0.12, 1.6, -vz * 0.16], p = [...hit.p], t = hit.t;
  for (let i = 0; i < 400 && p[1] > floorY; i++) { const dt = 1 / 60; v[1] -= 9.81 * dt; p = [p[0] + v[0] * dt, Math.max(floorY, p[1] + v[1] * dt), p[2] + v[2] * dt]; t += dt; out.push({ t, p: [...p], phase: 'flight' }); }
  out.push({ t: t + 0.4, p: [p[0], floorY, p[2]], phase: 'roll' });
  return out;
}

export function scoreHit(hit) {
  if (!hit || hit.kind === 'wall') return 0;
  const base = ROWS[hit.kind].points;
  return hit.perfect && (hit.kind === 'boards' || hit.kind === 'ducks') ? base * PERFECT_MULT : base;
}

/* ---------- aiming help (Ideal shot, simulated Hit) ---------- */
// The point to aim at for a row, given what's still standing. now = game time.
export function aimPoint(row, lay, state, now, flightTime = 5) {
  if (row === 'cans') {
    const up = lay.cans.filter(c => !(state.cansDown && state.cansDown[c.i]));
    const c = (up.length ? up : lay.cans).slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
    return { x: c.x, y: c.y0 + c.h * 0.5, z: c.z + c.r * 0.6 };
  }
  if (row === 'boards') { const b = lay.boards[lay.boards.length - 1]; return { x: b.x, y: b.cy, z: b.z }; }
  if (row === 'bell') return { x: lay.bell.x, y: lay.bell.cy, z: lay.bell.z };
  // ducks: the one that will be nearest the middle when the ball gets there, led by the flight time
  const D = lay.ducks, t = now + flightTime;
  let bi = 0, bd = Infinity;
  for (let i = 0; i < D.n; i++) { if (state.ducksDown && state.ducksDown[i]) continue; const x = duckX(D, i, t), m = Math.abs(x) + (x > D.x1 - 6 ? 100 : 0); if (m < bd) { bd = m; bi = i; } }
  return { x: duckX(D, bi, t), y: D.y0 + D.h / 2, z: D.z, duck: bi };
}

// Ball data whose flight passes through `aim` (a point on a vertical target). sim(ball) → physics result.
export function solveAim(sim, clubs, aim, { club = null, traj = 'normal', axis = 0 } = {}) {
  const D = Math.hypot(aim.x, aim.z), bearing = Math.atan2(aim.x, -aim.z);
  let hla = bearing * 180 / Math.PI;
  const ball = (c, k) => toolBall(c, k, hla, { traj, axis });
  // where the ball is when it's D metres out (y = -1 if it never gets there in the air)
  const at = r => {
    const P = r.pts;
    for (let i = 1; i < P.length; i++) {
      const a = Math.hypot(P[i - 1].p[0], P[i - 1].p[2]), b = Math.hypot(P[i].p[0], P[i].p[2]);
      if (b >= D) { const f = (D - a) / ((b - a) || 1), q = j => P[i - 1].p[j] + (P[i].p[j] - P[i - 1].p[j]) * f; return { y: q(1), x: q(0), z: q(2), t: P[i - 1].t + (P[i].t - P[i - 1].t) * f }; }
    }
    return { y: -1, t: r.flightTime };
  };
  let ci = club;
  if (ci == null) { ci = 0; for (let i = clubs.length - 1; i >= 0; i--) { if (at(sim(ball(clubs[i], 1))).y >= aim.y) { ci = i; break; } } }
  const c = clubs[ci];
  let k = 1, h;
  for (let pass = 0; pass < 3; pass++) {
    let lo = 0.3, hi = 1; k = 1; h = at(sim(ball(c, 1)));
    if (h.y > aim.y) { for (let it = 0; it < 16; it++) { k = (lo + hi) / 2; h = at(sim(ball(c, k))); if (h.y > aim.y) hi = k; else lo = k; } k = (lo + hi) / 2; h = at(sim(ball(c, k))); }
    if (h.y < 0 || !axis) break;                         // straight shots start on line already
    const err = bearing - Math.atan2(h.x, -h.z); if (Math.abs(err) < 0.001) break;
    hla += err * 180 / Math.PI;                          // aim off so the curve brings it back
  }
  return { club: ci, k, ball: ball(c, k), timeToTarget: h.t };
}
