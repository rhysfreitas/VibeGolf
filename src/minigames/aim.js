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
