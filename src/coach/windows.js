// Coaching range: target windows per club, scaled to the player's own club speed.
// Pure (no DOM, no Three.js). See docs/COACHING.md.
//
// The anchor is the TrackMan PGA Tour average for each club (the same numbers the physics is
// calibrated against). A slower swing spins a little less and can't land the ball quite as
// steeply, so spin scales as a power of club speed and the descent target eases down; the
// flight model then finds the launch that lands that spin at that descent, and the window
// centre moves by that much from the tour launch. Both rules are fitted so the LPGA Tour
// averages fall out (7 iron at 76 mph: about 19° and 6,700 rpm; driver at 94 mph: about
// 13° and 2,600 rpm). The tour player gets exactly the tour numbers.

import { simulate } from '../physics.js';

// ball mph, launch deg, spin rpm, smash, attack deg (TrackMan tour averages; SW is a partial)
export const CLUB_REF = {
  DR: { speed: 167, vla: 10.9, spin: 2686, smash: 1.49, aoa: -1.3, kind: 'driver' },
  '3W': { speed: 158, vla: 9.2, spin: 3655, smash: 1.48, aoa: -2.9, kind: 'wood' },
  HY: { speed: 146, vla: 10.2, spin: 4437, smash: 1.46, aoa: -3.3, kind: 'wood' },
  '5i': { speed: 132, vla: 12.1, spin: 5361, smash: 1.38, aoa: -3.1, kind: 'iron' },
  '7i': { speed: 120, vla: 16.3, spin: 7097, smash: 1.33, aoa: -4.3, kind: 'iron' },
  '9i': { speed: 109, vla: 20.4, spin: 8647, smash: 1.28, aoa: -4.7, kind: 'iron' },
  PW: { speed: 102, vla: 24.2, spin: 9304, smash: 1.23, aoa: -5.0, kind: 'wedge' },
  SW: { speed: 76, vla: 31, spin: 9800, smash: 1.15, aoa: -5.0, kind: 'wedge' },
};
// attack-angle window and smash floor don't scale with speed
export const FIXED = {
  DR: { aoa: [-2, 5], smashMin: 1.44 }, '3W': { aoa: [-3, 1], smashMin: 1.42 }, HY: { aoa: [-4, 0], smashMin: 1.38 },
  '5i': { aoa: [-5, -1], smashMin: 1.33 }, '7i': { aoa: [-6, -2], smashMin: 1.3 }, '9i': { aoa: [-6, -2], smashMin: 1.25 },
  PW: { aoa: [-7, -2], smashMin: 1.2 }, SW: { aoa: [-7, -1], smashMin: 1.1 },
};
// launch ≈ this fraction of dynamic loft (used to estimate loft when the R10 doesn't send it)
export const LAUNCH_PER_LOFT = { driver: 0.88, wood: 0.85, iron: 0.8, wedge: 0.78 };

export const tourClubSpeed = id => CLUB_REF[id].speed / CLUB_REF[id].smash;

const flight = (ball, sim) => sim({ Speed: ball.Speed, VLA: ball.VLA, HLA: 0, TotalSpin: ball.TotalSpin, SpinAxis: 0 });
const defaultSim = b => simulate(b, { flightOnly: true });

// spin ∝ (club speed)^e, and the descent target drops 22° per unit of speed fraction lost
const SPIN_EXP = { driver: 0.15, wood: 0.25, iron: 0.35, wedge: 0.35 };
const targetDescent = (tourDesc, f) => tourDesc - 22 * (1 - f);
// the launch that lands this ball speed and spin at `desc` (descent rises with launch)
function launchFor(ballSpeed, spin, desc, sim) {
  let lo = 2, hi = 50;
  for (let i = 0; i < 11; i++) { const mid = (lo + hi) / 2; if (flight({ Speed: ballSpeed, VLA: mid, TotalSpin: spin }, sim).descent < desc) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

const cache = new Map();
// Windows for a club at a club speed (mph). `sim` is only for tests.
export function windowsFor(id, clubSpeed, { sim = defaultSim } = {}) {
  const ref = CLUB_REF[id] || CLUB_REF['7i'], fx = FIXED[id] || FIXED['7i'];
  const vt = ref.speed / ref.smash;
  const v = Math.max(0.5 * vt, Math.min(1.2 * vt, +clubSpeed > 0 ? +clubSpeed : vt));
  const key = `${id}|${Math.round(v)}|${sim === defaultSim ? 'd' : 'x'}`;
  if (cache.has(key)) return cache.get(key);
  const tKey = `${id}|tour|${sim === defaultSim ? 'd' : 'x'}`;
  if (!cache.has(tKey)) {
    const desc = flight({ Speed: ref.speed, VLA: ref.vla, TotalSpin: ref.spin }, sim).descent;
    cache.set(tKey, { desc, L: launchFor(ref.speed, ref.spin, desc, sim) });
  }
  const T = cache.get(tKey), f = v / vt, spinC = ref.spin * Math.pow(f, SPIN_EXP[ref.kind]);
  const L = Math.abs(f - 1) < 0.005 ? T.L : launchFor(v * ref.smash, spinC, targetDescent(T.desc, f), sim);
  const launchC = ref.vla + (L - T.L);
  const lw = ref.kind === 'driver' ? 2 : 2.5, sw = ref.kind === 'driver' ? 0.15 : 0.12;
  const ratio = LAUNCH_PER_LOFT[ref.kind];
  const w = {
    club: id, kind: ref.kind, clubSpeed: v, descent: targetDescent(T.desc, f),
    launch: [launchC - lw, launchC + lw], launchC,
    spin: [spinC * (1 - sw), spinC * (1 + sw)], spinC,
    aoa: fx.aoa.slice(), smashMin: fx.smashMin, smashRef: ref.smash,
    spinLoft: launchC / ratio - ref.aoa,
  };
  // stock carry (yd) and how it moves with ball speed (per mph), launch (per °) and spin (per
  // rpm), for the coach's distance spread (a linear carry is plenty for a spread)
  const bs = v * ref.smash, cy = (sp, l, s) => flight({ Speed: sp, VLA: l, TotalSpin: s }, sim).carry;
  const c0 = cy(bs, launchC, spinC);
  if (isFinite(c0)) w.carry = { c: c0, v: bs, dv: (cy(bs + 2, launchC, spinC) - cy(bs - 2, launchC, spinC)) / 4,
    dl: (cy(bs, launchC + 1, spinC) - cy(bs, launchC - 1, spinC)) / 2, ds: (cy(bs, launchC, spinC * 1.1) - cy(bs, launchC, spinC * 0.9)) / (0.2 * spinC) };
  cache.set(key, w);
  return w;
}
