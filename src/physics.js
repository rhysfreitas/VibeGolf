// Golf ball flight + bounce + roll. Pure functions, SI units, no rendering deps.
// Coordinates: x = right, y = up, -z = downrange (Three.js convention).
// Shot input follows GSPro Open Connect BallData naming (mph, deg, rpm).

const G = 9.80665;
const BALL_R = 0.021335;       // m (1.68 in)
const BALL_M = 0.04593;        // kg (1.62 oz)
const BALL_A = Math.PI * BALL_R * BALL_R;
const MPH = 0.44704, RPM = Math.PI / 30, DEG = Math.PI / 180, YD = 0.9144;

const SURFACES = {
  desert:  { mu: 0.55, eScale: 0.70, tScale: 0.62, crr: 0.30 }, // canyon floor hardpan: firm, kicks
  //            friction  COR scale  rolling resistance (fraction of g)
  //            tScale = horizontal speed kept after turf deformation on impact
  fairway: { mu: 0.40, eScale: 1.00, tScale: 0.70, crr: 0.16 },
  green:   { mu: 0.60, eScale: 0.80, tScale: 0.42, crr: 0.065 },
  rough:   { mu: 0.70, eScale: 0.55, tScale: 0.45, crr: 0.42 },
  sand:    { mu: 0.90, eScale: 0.25, tScale: 0.20, crr: 1.20 },
  firstcut: { mu: 0.55, eScale: 0.80, tScale: 0.58, crr: 0.26 }, // the step between fairway and rough
  waste:   { mu: 0.80, eScale: 0.40, tScale: 0.34, crr: 0.80 },  // desert waste area: firm sand and grit
  water:   { mu: 4.00, eScale: 0.02, tScale: 0.02, crr: 6.00 },  // it stops where it goes in
};

const DEFAULT_COEF = { cd0: 0.2043, cdS: 0.1414, cdLow: 0.2999, cdV: 51.1, clMax: 0.447, s0: 0.1736, clScale: 1.0, spinTau: 19.9 }; // fit to TrackMan PGA Tour averages

function airDensity(tempF = 72, altFt = 0, humidity = 0.5) {
  const T = (tempF - 32) * 5 / 9 + 273.15;
  const h = altFt * 0.3048;
  const p = 101325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
  // water vapour partial pressure (Tetens)
  const Tc = T - 273.15;
  const pv = humidity * 610.78 * Math.pow(10, 7.5 * Tc / (Tc + 237.3));
  return (p - pv) / (287.058 * T) + pv / (461.495 * T);
}

// Cd rises below ~25 m/s (Reynolds number drops out of the post-crisis regime)
function aero(S, v, coef) {
  const cd = coef.cd0 + coef.cdS * S + coef.cdLow * Math.max(0, (coef.cdV - v) / coef.cdV);
  const cl = coef.clScale * coef.clMax * S / (S + coef.s0);
  return { cd, cl };
}

// Initial state from launch-monitor style data.
function launchState(shot) {
  const v = shot.Speed * MPH;
  const vla = shot.VLA * DEG, hla = shot.HLA * DEG;
  const vel = [Math.sin(hla) * Math.cos(vla) * v, Math.sin(vla) * v, -Math.cos(hla) * Math.cos(vla) * v];
  const a = (shot.SpinAxis || 0) * DEG;           // + = tilts right (fade/slice for RH)
  const w = shot.TotalSpin * RPM;
  // backspin axis is +x for -z travel; rotate it so lift tilts right for +axis
  // (rotate around the direction of travel)
  const hx = Math.cos(hla), hz = Math.sin(hla); // horizontal right vector rotated by HLA
  const spin = [Math.cos(a) * w * hx, -Math.sin(a) * w, Math.cos(a) * w * hz];
  return { pos: [0, 0, 0], vel, spin };
}

function deriv(s, env) {
  // aerodynamic forces act on the velocity relative to the air (wind in m/s)
  const vx = s.vel[0] - env.wind[0], vy = s.vel[1], vz = s.vel[2] - env.wind[2];
  const v = Math.hypot(vx, vy, vz) || 1e-9;
  const w = Math.hypot(...s.spin);
  const S = (w * BALL_R) / v;
  const { cd, cl } = aero(S, v, env.coef);
  const q = 0.5 * env.rho * BALL_A * v * v / BALL_M;
  // drag
  let ax = -q * cd * vx / v, ay = -q * cd * vy / v - G, az = -q * cd * vz / v;
  // Magnus: direction spin_hat x vel_hat
  if (w > 1e-6) {
    const ux = s.spin[0] / w, uy = s.spin[1] / w, uz = s.spin[2] / w;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const cn = Math.hypot(cx, cy, cz) || 1e-9;
    ax += q * cl * cx / cn; ay += q * cl * cy / cn; az += q * cl * cz / cn;
  }
  const k = -1 / env.coef.spinTau;
  return { dpos: [s.vel[0], s.vel[1], s.vel[2]], dvel: [ax, ay, az], dspin: [k * s.spin[0], k * s.spin[1], k * s.spin[2]] };
}

function add(s, d, h) {
  return {
    pos: s.pos.map((p, i) => p + d.dpos[i] * h),
    vel: s.vel.map((p, i) => p + d.dvel[i] * h),
    spin: s.spin.map((p, i) => p + d.dspin[i] * h),
  };
}

function rk4(s, env, h) {
  const k1 = deriv(s, env);
  const k2 = deriv(add(s, k1, h / 2), env);
  const k3 = deriv(add(s, k2, h / 2), env);
  const k4 = deriv(add(s, k3, h), env);
  const comb = (key) => s[key].map((p, i) => p + h / 6 * (k1['d' + key][i] + 2 * k2['d' + key][i] + 2 * k3['d' + key][i] + k4['d' + key][i]));
  return { pos: comb('pos'), vel: comb('vel'), spin: comb('spin') };
}

// Penner (2002) normal coefficient of restitution vs impact speed
function cor(vn) { return vn < 20 ? Math.max(0.12, 0.510 - 0.0375 * vn + 0.000903 * vn * vn) : 0.12; }

// Simulate a full shot.
// opts.surfaceAt(x, z) -> 'fairway' | 'green' | 'rough' | 'sand'
// opts.groundAt(x, z)  -> height in metres, or null over open air (floating-island courses)
// opts.voidY           -> stop and report `void` once the ball falls below this height
// opts.cup             -> { x, z } hole position; the ball drops if it reaches it slowly enough
// opts.wind            -> { x, z } air velocity in m/s, in the shot's frame (calm when omitted)
// opts.solidAt(x,y,z)  -> outward normal [nx,ny,nz] (optional .soak: the chance a hit kills the ball's
//                         speed so it drops at the face) when the point is inside rock that isn't
//                         ground (an arch, a spire, a cliff overhang), else null
// opts.treeAt(x,y,z)   -> { n: [nx,0,nz] } against a trunk, { density } (chance per metre of hitting a
//                         branch) inside a canopy, else null
// opts.rng             -> random numbers in [0, 1) for branch hits (Math.random when omitted)
function simulate(shot, opts = {}) {
  const env = {
    rho: opts.rho ?? airDensity(opts.tempF ?? 72, opts.altFt ?? 0),
    coef: { ...DEFAULT_COEF, ...(opts.coef || {}) },
    wind: [opts.wind?.x || 0, 0, opts.wind?.z || 0],
  };
  const solidAt = opts.solidAt || null;
  const treeAt = opts.treeAt || null, rand = opts.rng || Math.random;
  const surfaceAt = opts.surfaceAt || (() => 'fairway');
  const groundAt = opts.groundAt || (() => 0);
  const voidY = opts.voidY ?? -1e9;
  const cup = opts.cup || null;
  const CUP_R = 0.054;
  const dt = 1 / 240;
  let s = launchState(shot);
  const pts = [{ t: 0, p: s.pos.slice(), phase: 'flight' }];
  let t = 0, landed = null, apex = 0, bounces = 0, phase = 'flight';
  let firstDescent = 0, landSpeed = 0, outcome = 'rest', wallHits = 0, rockHits = 0, treeHits = 0;
  const nearCup = (x, z) => cup && Math.hypot(x - cup.x, z - cup.z) < CUP_R;

  while (t < 40) {
    if (phase !== 'roll') {
      const prev = s;
      s = rk4(s, env, dt); t += dt;
      apex = Math.max(apex, s.pos[1]);
      if (s.pos[1] < voidY) { outcome = 'void'; pts.push({ t, p: s.pos.slice(), phase: 'flight' }); break; }
      const nrm = solidAt && solidAt(s.pos[0], s.pos[1], s.pos[2]);
      if (nrm) {
        // hit rock: reflect off the face, losing most of the speed along it
        const vn = s.vel[0] * nrm[0] + s.vel[1] * nrm[1] + s.vel[2] * nrm[2];
        if (vn < 0) {
          const tv = s.vel.map((v, i) => v - vn * nrm[i]);
          // some rock soaks the ball up (a cave wall): it dies against the face and drops at its foot
          if (nrm.soak && rand() < nrm.soak) s = { pos: prev.pos.slice(), vel: [nrm[0] * 1.2, Math.min(0, s.vel[1] * 0.1) - 0.5, nrm[2] * 1.2], spin: [0, 0, 0] };
          else s = { pos: prev.pos.slice(), vel: tv.map((v, i) => v * 0.55 - 0.4 * vn * nrm[i]), spin: prev.spin.map(w => w * 0.3) };
          rockHits++;
        } else s = { ...s, pos: s.pos.map((p, i) => p + nrm[i] * 0.02) };
        if (++wallHits > 60) { outcome = 'void'; break; }
        pts.push({ t, p: s.pos.slice(), phase: landed ? 'bounce' : 'flight', hit: true });
        continue;
      }
      const tree = treeAt && treeAt(s.pos[0], s.pos[1], s.pos[2]);
      if (tree && tree.n) { // off the trunk
        const n = tree.n, vn = s.vel[0] * n[0] + s.vel[2] * n[2];
        if (vn < 0) {
          s = { pos: prev.pos.slice(), vel: [(s.vel[0] - 2 * vn * n[0]) * 0.4, s.vel[1] * 0.6, (s.vel[2] - 2 * vn * n[2]) * 0.4], spin: prev.spin.map(w => w * 0.3) };
          treeHits++;
          if (++wallHits > 60) break;
          pts.push({ t, p: s.pos.slice(), phase: landed ? 'bounce' : 'flight', hit: true });
          continue;
        }
      } else if (tree) { // through the leaves: a branch may knock it down or kick it sideways
        const sp = Math.hypot(...s.vel);
        if (sp > 0.5 && rand() < 1 - Math.exp(-tree.density * sp * dt)) {
          const a = rand() * Math.PI * 2, zr = rand() * 2 - 1, q = Math.sqrt(1 - zr * zr);
          let d = [s.vel[0] / sp * 0.5 + Math.cos(a) * q * 0.9, s.vel[1] / sp * 0.5 + zr * 0.9 - 0.4, s.vel[2] / sp * 0.5 + Math.sin(a) * q * 0.9];
          const dl = Math.hypot(...d) || 1, keep = 0.15 + 0.4 * rand();
          s = { pos: s.pos, vel: d.map(v => v / dl * sp * keep), spin: s.spin.map(w => w * 0.25) };
          treeHits++;
          pts.push({ t, p: s.pos.slice(), phase: landed ? 'bounce' : 'flight', hit: true });
          continue;
        }
      }
      const gNow = groundAt(s.pos[0], s.pos[2]);
      if (gNow !== null && s.pos[1] <= gNow && s.vel[1] < 0 || gNow !== null && s.pos[1] < gNow - 0.05) {
        const gPrev = groundAt(prev.pos[0], prev.pos[2]);
        // a cliff face: it came from open air, from under the ground, or from beside a wall that
        // rises above where the ball was (a step up far steeper than any slope)
        if (gPrev === null || prev.pos[1] < gPrev - 0.3 || (gNow - gPrev > 0.6 && prev.pos[1] < gNow - 0.3)) {
          // flew into a cliff face: knock it back and let it drop
          s = { pos: prev.pos.slice(), vel: [-prev.vel[0] * 0.25, Math.min(prev.vel[1], 0), -prev.vel[2] * 0.25], spin: prev.spin.map(w => w * 0.3) };
          rockHits++;
          if (++wallHits > 40) { outcome = 'void'; break; }
          pts.push({ t, p: s.pos.slice(), phase: landed ? 'bounce' : 'flight' });
          continue;
        }
        // interpolate to ground
        const hp = prev.pos[1] - gPrev, hn = s.pos[1] - gNow;
        const f = hp > 0 ? hp / (hp - hn) : 0;
        s.pos = prev.pos.map((p, i) => p + (s.pos[i] - p) * f);
        s.pos[1] = groundAt(s.pos[0], s.pos[2]) ?? gNow;
        const vh = Math.hypot(s.vel[0], s.vel[2]);
        if (!landed) {
          landed = { t, p: s.pos.slice() };
          firstDescent = Math.atan2(-s.vel[1], vh) / DEG;
          if (opts.flightOnly) break;
          landSpeed = Math.hypot(...s.vel);
        }
        if (nearCup(s.pos[0], s.pos[2]) && vh < 3) { outcome = 'holed'; pts.push({ t, p: s.pos.slice(), phase: 'bounce' }); break; }
        const surf = SURFACES[surfaceAt(s.pos[0], s.pos[2])] || SURFACES.rough;
        // --- bounce: impulse model with sliding/rolling friction ---
        const vn = -s.vel[1];
        const e = cor(vn) * surf.eScale;
        const dh = vh > 1e-6 ? [s.vel[0] / vh, s.vel[2] / vh] : [0, -1];
        const perp = [-dh[1], dh[0]]; // horizontal axis that gives backspin for travel dh
        const wb = s.spin[0] * perp[0] + s.spin[2] * perp[1];
        const u = vh + BALL_R * wb; // contact-point slip speed (forward +)
        const maxImp = surf.mu * (1 + e) * vn;
        const dv = -Math.sign(u) * Math.min(maxImp, (2 / 7) * Math.abs(u));
        const vh2 = (vh + dv) * surf.tScale;
        const wb2 = -vh2 / BALL_R; // leaves the turf rolling
        s.vel = [dh[0] * vh2, e * vn, dh[1] * vh2];
        s.spin = [perp[0] * wb2, s.spin[1] * 0.5, perp[1] * wb2];
        bounces++;
        if (e * vn < 1.2 || bounces > 6) { phase = 'roll'; s.vel[1] = 0; }
        else s.pos[1] += 1e-4;
        pts.push({ t, p: s.pos.slice(), phase: 'bounce' });
        continue;
      }
      pts.push({ t, p: s.pos.slice(), phase: landed ? 'bounce' : 'flight' });
    } else {
      const vh = Math.hypot(s.vel[0], s.vel[2]);
      const x = s.pos[0], z = s.pos[2];
      const surf = SURFACES[surfaceAt(x, z)] || SURFACES.rough;
      // slope pull (rolling sphere: 5/7 g sin θ) then rolling resistance
      const e1 = 0.25;
      const h = (a, b) => { const v = groundAt(a, b); return v === null ? s.pos[1] : v; };
      const gx = (h(x + e1, z) - h(x - e1, z)) / (2 * e1);
      const gz = (h(x, z + e1) - h(x, z - e1)) / (2 * e1);
      if (vh < 0.05 && Math.hypot(gx, gz) < surf.crr) break; // at rest, and the slope can't start it rolling
      let vx = s.vel[0] - (5 / 7) * G * gx * dt, vz = s.vel[2] - (5 / 7) * G * gz * dt;
      const v2 = Math.hypot(vx, vz) || 1e-9;
      const nv = Math.max(0, v2 - surf.crr * G * dt), f = nv / v2;
      if (nv < 0.05 && Math.hypot(gx, gz) < surf.crr) break;
      s.vel = [vx * f, 0, vz * f];
      const nx = x + s.vel[0] * dt, nz = z + s.vel[2] * dt;
      const ng = groundAt(nx, nz);
      t += dt;
      if (ng !== null && ng > s.pos[1] + 0.3) {
        // rolled into a wall: knock it back
        s.vel = [-s.vel[0] * 0.3, 0, -s.vel[2] * 0.3];
        pts.push({ t, p: s.pos.slice(), phase: 'roll' });
        if (++wallHits > 60) break;
        continue;
      }
      const tk = treeAt && ng !== null && treeAt(nx, ng + 0.05, nz);
      const rn = tk && tk.n || solidAt && ng !== null && solidAt(nx, ng + 0.05, nz);
      if (rn) { // rolled into rock: reflect off its face
        const vn = s.vel[0] * rn[0] + s.vel[2] * rn[2];
        if (vn < 0) s.vel = [(s.vel[0] - 2 * vn * rn[0]) * 0.4, 0, (s.vel[2] - 2 * vn * rn[2]) * 0.4];
        pts.push({ t, p: s.pos.slice(), phase: 'roll' });
        if (++wallHits > 60) break;
        continue;
      }
      if (ng === null || ng < s.pos[1] - 0.4) {
        // rolled off the edge
        s.pos = [nx, s.pos[1], nz]; s.spin = [0, 0, 0]; phase = 'flight';
        pts.push({ t, p: s.pos.slice(), phase: 'roll' });
        continue;
      }
      s.pos = [nx, ng, nz];
      pts.push({ t, p: s.pos.slice(), phase: 'roll' });
      if (nearCup(nx, nz) && nv < 1.6) { outcome = 'holed'; break; }
    }
  }
  const end = s.pos; apex = Math.max(apex, 0);
  const lp = landed ? landed.p : end;
  return {
    pts, outcome,
    carry: -lp[2] / YD, carryOffline: lp[0] / YD,
    total: Math.hypot(end[0], end[2]) / YD, totalDown: -end[2] / YD,
    offline: end[0] / YD,
    apexFt: apex / 0.3048, apexYd: apex / YD,
    descent: firstDescent, landSpeedMph: landSpeed / MPH,
    flightTime: landed ? landed.t : t, totalTime: t,
    landed: !!landed, rho: env.rho, rockHits, treeHits,
  };
}

export { simulate, airDensity, SURFACES, DEFAULT_COEF, YD };
