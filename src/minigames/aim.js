// Aiming help shared by the mini games: ball data that reaches a target (for simulated Hit / Ideal shot).
const YD = 0.9144;

// Ball data that carries `distM` and starts toward lateral `x`. Picks a club, then trims swing
// length so the carry matches. `sim(ball)` must return a physics result on flat ground.
export function solveShot(sim, clubs, target) {
  const dist = Math.hypot(target.x, target.z), hla = Math.atan2(target.x, -target.z) * 180 / Math.PI;
  const ball = (c, k) => ({ Speed: c.Speed * k, VLA: c.VLA + (1 - k) * 7, HLA: hla, TotalSpin: c.TotalSpin * (0.65 + 0.35 * k), SpinAxis: 0 });
  // true distance to where it lands (r.carry is downrange only, which is wrong for wide targets)
  const carry = b => { const r = sim(b), l = (r.pts.find(p => p.phase !== 'flight') || r.pts[r.pts.length - 1]).p; return { carry: Math.hypot(l[0], l[2]), t: r.flightTime }; };
  // shortest club whose full swing gets there
  let ci = clubs.length - 1;
  for (let i = clubs.length - 1; i >= 0; i--) { if (carry(ball(clubs[i], 1)).carry >= dist) { ci = i; break; } if (i === 0) ci = 0; }
  const c = clubs[ci];
  let lo = 0.3, hi = 1, k = 1, out = carry(ball(c, 1));
  if (out.carry > dist) {
    for (let it = 0; it < 14; it++) { k = (lo + hi) / 2; out = carry(ball(c, k)); if (out.carry > dist) hi = k; else lo = k; }
  }
  return { club: ci, k, ball: ball(c, k), carryM: out.carry, flightTime: out.t };
}

/* ---------- the simulated-shot tool's shots (club · Normal / Punch / Stinger · shape) ---------- */
// How each trajectory changes a club's stock launch: a punch comes out lower with less spin, a
// stinger lower still (it's meant for long clubs, but any club can try it).
export const TRAJ_MUL = {
  normal: { vla: 1, spin: 1, speed: 1 },
  punch: { vla: 0.68, spin: 0.78, speed: 0.97 },
  stinger: { vla: 0.48, spin: 0.62, speed: 1.0 },
};
export function toolBall(c, k, hla, { traj = 'normal', axis = 0 } = {}) {
  const t = TRAJ_MUL[traj] || TRAJ_MUL.normal;
  return { Speed: c.Speed * k * t.speed, VLA: (c.VLA + (1 - k) * 7) * t.vla, HLA: hla, TotalSpin: c.TotalSpin * (0.65 + 0.35 * k) * t.spin, SpinAxis: axis };
}
// Ball data that lands on `target` ({ x, z }) with the tool's club (null = shortest that gets there),
// trajectory and shape (spin axis): the swing is trimmed for distance and aimed off so the curve
// brings it back. Returns { club, k, ball, land }.
export function solveCustom(sim, clubs, target, { club = null, traj = 'normal', axis = 0 } = {}) {
  const dist = Math.hypot(target.x, target.z), bearing = Math.atan2(target.x, -target.z);
  const land = b => { const r = sim(b), l = (r.pts.find(p => p.phase !== 'flight') || r.pts[r.pts.length - 1]).p; return { x: l[0], z: l[2], d: Math.hypot(l[0], l[2]) }; };
  const o = { traj, axis };
  let hla = bearing * 180 / Math.PI;
  let ci = club;
  if (ci == null) { ci = 0; for (let i = clubs.length - 1; i >= 0; i--) if (land(toolBall(clubs[i], 1, hla, o)).d >= dist) { ci = i; break; } }
  const c = clubs[ci];
  let k = 1, l;
  for (let pass = 0; pass < 3; pass++) {
    l = land(toolBall(c, 1, hla, o)); k = 1;
    if (l.d > dist) { let lo = 0.3, hi = 1; for (let i = 0; i < 12; i++) { k = (lo + hi) / 2; l = land(toolBall(c, k, hla, o)); if (l.d > dist) hi = k; else lo = k; } }
    if (l.d < 1) break; // it meets the ground at the ball (a lip in front of it): no bearing to correct toward
    const err = bearing - Math.atan2(l.x, -l.z);
    if (Math.abs(err) < 0.0015) break;
    hla += err * 180 / Math.PI;
  }
  return { club: ci, k, ball: toolBall(c, k, hla, o), land: l };
}
// A decent amateur's version of a shot: start direction σ≈3°, spin axis σ≈6.5°, a little speed,
// launch and spin variation. Used for every simulated Hit.
export function amateurMiss(ball, rnd = Math.random) {
  const g = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { ...ball, HLA: ball.HLA + g() * 3, SpinAxis: (ball.SpinAxis || 0) + g() * 6.5, Speed: ball.Speed * (1 + g() * 0.03), VLA: ball.VLA + g() * 1.8, TotalSpin: ball.TotalSpin * (1 + g() * 0.1) };
}
// The usual handler: a cache keyed on the target and the tool's settings, then Ideal or Hit.
export function makeToolShot(sim, clubs) {
  const cache = new Map();
  return (target, s) => {
    const key = `${target.x.toFixed(1)},${target.z.toFixed(1)}|${s.clubAuto ? 'a' : s.club}|${s.traj}|${s.axis}`;
    if (!cache.has(key)) { if (cache.size > 200) cache.clear(); cache.set(key, solveCustom(sim, clubs, target, { club: s.clubAuto ? null : s.club, traj: s.traj, axis: s.axis })); }
    const sol = cache.get(key);
    return { ...sol, ball: s.ideal ? { ...sol.ball } : amateurMiss(sol.ball) };
  };
}

/* ---------- the phantom aim line (src/aim-line.js) ---------- */
// Where a simulated flight lands (or ends, for flight-only sims), and its bearing in degrees
// (+ = right of straight downrange, the same sense as HLA).
export const landOf = r => (r.pts.find(p => p.phase !== 'flight') || r.pts[r.pts.length - 1]).p;
export const bearingOf = (x, z) => Math.atan2(x, -z) * 180 / Math.PI;
// Turning a shot: on flat ground with no wind, adding δ to HLA turns the whole flight δ about the ball.
export function turnBall(ball, deg) { return { ...ball, HLA: (ball.HLA || 0) + deg }; }
export function turnPts(pts, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(q => ({ ...q, p: [q.p[0] * c - q.p[2] * s, q.p[1], q.p[0] * s + q.p[2] * c] }));
}
// How far to turn a shot whose ideal flight lands on `fromDeg`: none with auto-aim (the game's
// solver already aims at the target), otherwise onto the aim line you dragged (`yawDeg`).
export const aimTurn = (fromDeg, { autoAim, yawDeg = 0, targetDeg = fromDeg }) => (autoAim ? targetDeg : yawDeg) - fromDeg;
