// The Overlook's pterosaur (The Lost Valley): where it is and how it holds itself, second by second, from the moment
// the round's first tee shot on the 7th is struck. Pure: no DOM, no THREE. valley-world.js draws the animal from
// what at(t) returns; tests/ptero-flight.test.mjs checks the flight.
//
// It perches on the spire just off the 7th tee, wings folded, standing on its knuckles. When the shot is struck it
// crouches, springs off with a big downstroke, beats three times to get going, then glides out ahead and left of
// the line, dropping below the tee, and banks slowly away left toward the herd across the floor. Scenery only:
// it keeps well clear of the line of play and well above the ground.
//
// makeFlight({ perch: [x, y, z] (its feet on the spire's top, in the hole's frame: x right, y up, -z down the
// line), floor(x, z) (the ground's height there, or null), clear (metres over the ground, default 12) })
// returns { duration, at(t) } with at(t) = { p: [x, y, z], yaw (0 = facing -z, + = turning left), pitch, bank (+ =
// left wing down), fold (1 folded, 0 spread), flap (shoulder angle, + = wings up), crouch (0..1), gone }.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t * t * (3 - 2 * t);

// The route, relative to the perch (the spire stands 70 m out and 34 m left of the 7th's line): straight out off the
// lip, diving below the tee and keeping 30 m left of the line while the ball is in the air, then easing in to cross
// the landing view short and left of the green (about 15 m off the line, after the ball is down), and banking away
// left toward the herd, climbing gently as it goes.
const ROUTE = [[0, 0, 0], [1, 2.4, -7], [2, -3, -25], [1, -12, -55], [0, -18, -90], [4, -20, -120], [10, -21, -150], [11, -22, -175], [-4, -23, -198], [-50, -24, -216], [-120, -24, -224], [-300, -22, -226], [-600, -18, -214], [-900, -8, -200]];
const T_CROUCH = 0.35, T_LEAP = 1.3, T_BEAT = 4.6;

export function makeFlight({ perch, floor = null, clear = 12 } = {}) {
  const [px, py, pz] = perch;
  // the control points, lifted where the ground (or its trees) would come within `clear` of them
  const C = ROUTE.map(([dx, dy, dz], i) => {
    const x = px + dx, z = pz + dz; let y = py + dy;
    if (i > 1 && floor) { const g = floor(x, z); if (g != null && y < g + clear) y = g + clear; }
    return [x, y, z];
  });
  // a Catmull-Rom spline through them, sampled every metre or so, with its arc length
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const P = [], S = [0];
  for (let i = 0; i < C.length - 1; i++) {
    const a = C[Math.max(0, i - 1)], b = C[i], c = C[i + 1], d = C[Math.min(C.length - 1, i + 2)];
    const n = Math.max(4, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1], c[2] - b[2])));
    for (let k = 0; k < n; k++) { const t = k / n; P.push([0, 1, 2].map(j => cr(a[j], b[j], c[j], d[j], t))); }
  }
  P.push(C.at(-1).slice());
  for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  const LEN = S.at(-1);
  const along = s => {   // the point s metres along, and the direction there
    s = clamp(s, 0, LEN);
    let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = (s - S[lo]) / Math.max(1e-6, S[hi] - S[lo]), a = P[lo], b = P[hi];
    return { p: [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * f), d: [b[0] - a[0], b[1] - a[1], b[2] - a[2]] };
  };
  // speed: still on the perch, a slow spring off, a dive off the lip up to 22 m/s, then settling to a 13 m/s glide
  const speed = t => (t < T_CROUCH ? 0 : t < T_LEAP ? 3.5 : t < 3.3 ? 3.5 + (t - T_LEAP) * 9.25 : Math.max(13, 22 - (t - 3.3) * 0.9));
  const dist = [], DT = 0.05; { let s = 0; for (let t = 0; t < 400; t += DT) { dist.push(s); s += speed(t) * DT; if (s > LEN) { dist.push(LEN); break; } } }
  const sAt = t => { const i = t / DT, k = Math.floor(i); if (k >= dist.length - 1) return LEN; return dist[k] + (dist[k + 1] - dist[k]) * (i - k); };
  const duration = (dist.length - 1) * DT;
  const yawOf = d => Math.atan2(-d[0], -d[2]);   // 0 = facing -z, + = left

  function at(t) {
    if (t <= 0) return { p: [px, py, pz], yaw: yawOf([C[1][0] - px, 0, C[1][2] - pz]), pitch: 0.42, bank: 0, fold: 1, flap: 0, crouch: 0, gone: false };
    if (t >= duration) return { p: C.at(-1), yaw: 0, pitch: 0, bank: 0, fold: 0, flap: 0, crouch: 0, gone: true };
    const s = sAt(t), A = along(s), B = along(s + 3), d = [B.p[0] - A.p[0], B.p[1] - A.p[1], B.p[2] - A.p[2]];
    const yaw = yawOf(d), h = Math.hypot(d[0], d[2]) || 1, pitch = Math.atan2(d[1], h);
    // a coordinated turn: bank from the turn rate and the speed (tan bank = v^2 kappa / g), never more than 35 deg
    const Y0 = yawOf(along(s - 4).d), Y1 = yawOf(along(s + 4).d);
    let dy = Y1 - Y0; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    const v = speed(t), bank = clamp(Math.atan(v * v * (dy / 8) / 9.81), -0.6, 0.6);
    let fold = 1, flap = 0, crouch = 0, p = A.p.slice();
    if (t < T_CROUCH) { crouch = ease(t / T_CROUCH); p[1] -= 0.25 * crouch; }
    else if (t < T_LEAP) {   // the spring: wings open and come down hard
      const u = (t - T_CROUCH) / (T_LEAP - T_CROUCH);
      crouch = 1 - ease(Math.min(1, u * 3)); fold = 1 - ease(u); flap = 1.0 - 1.6 * ease(u);
    } else if (t < T_BEAT) {   // three beats to get going
      const u = (t - T_LEAP) / (T_BEAT - T_LEAP); fold = 0; flap = 0.7 * Math.sin(u * 3 * 2 * Math.PI - Math.PI / 2) * (1 - 0.5 * u) + 0.1;
    } else {   // gliding: wings a little up, a slow pair of beats now and then
      fold = 0; const c = (t - T_BEAT) % 9; flap = 0.12 + (c < 2 ? 0.35 * Math.sin(c * Math.PI) : 0);
    }
    const u = clamp((t - T_CROUCH) / (T_LEAP - T_CROUCH), 0, 1);   // head-high on the perch, level by the end of the spring
    return { p, yaw, pitch: 0.42 * (1 - u) + pitch * u, bank: bank * u, fold, flap, crouch, gone: false };
  }
  return { duration, at, length: LEN };
}
