// Coaching range: what to believe in a launch-monitor shot. Pure (no DOM, no Three.js).
// See docs/COACHING.md ("Trust checks").
//
// Club data: the R10 sends face, path and attack (no loft). It can't always track the club,
// and some connectors fill ClubData with placeholders. The Bluetooth driver and the bridge
// already drop the slow-swing 0/0/0; this is the coach's own backstop, whatever the source.
//
// Spin: with a plain ball the R10's spin is its own estimate. Before the coach leans on it,
// each shot's spin passes four checks; the verdict says how much a rule may use it:
//   'use'    measured, or every check that applies passes
//   'tie'    one check fails: a tie-breaker only (half way to what the strike predicts)
//   'ignore' two or more fail, or the spin is impossible for the club: rules see the spin
//            the strike predicts instead
//
//   clubTrust(shot)                    -> { ok, why }
//   spinTrust({ ... }, clubId)         -> { verdict, why, expected, fails, checks }

import { CLUB_REF, LAUNCH_PER_LOFT } from './windows.js';

const fin = v => v !== undefined && v !== null && v !== '' && isFinite(+v);

// limits a real swing can't pass (deg, mph)
export const CLUB_LIMITS = { path: 25, face: 25, aoa: [-20, 20], speed: [20, 160], smash: [0.7, 1.6] };

export function clubTrust(shot) {
  const c = shot && shot.Club;
  if (!c || typeof c !== 'object') return { ok: false, why: 'missing' };
  const P = c.Path, F = c.FaceToTarget, A = c.AngleOfAttack, S = c.Speed;
  if (!fin(P) || !fin(F)) return { ok: false, why: 'missing' };
  const p = +P, f = +F, a = fin(A) ? +A : null, s = fin(S) ? +S : null;
  // all three angles alike: the R10's 0/0/0 placeholder, or a connector's dummy 1/1/1
  if (a !== null && p === f && f === a) return { ok: false, why: p === 0 ? 'zeros' : 'same' };
  if (Math.abs(p) > CLUB_LIMITS.path || Math.abs(f) > CLUB_LIMITS.face) return { ok: false, why: 'range' };
  if (a !== null && (a < CLUB_LIMITS.aoa[0] || a > CLUB_LIMITS.aoa[1])) return { ok: false, why: 'range' };
  if (s !== null && s > 0) {
    if (s < CLUB_LIMITS.speed[0] || s > CLUB_LIMITS.speed[1]) return { ok: false, why: 'speed' };
    const smash = (+shot.Speed || 0) / s;
    if (smash < CLUB_LIMITS.smash[0] || smash > CLUB_LIMITS.smash[1]) return { ok: false, why: 'smash' };
  }
  return { ok: true, why: null };
}

// The spin this strike should give: spin grows with spin loft (dynamic loft less attack) and
// with club speed, fitted through the club's tour average. Loft isn't sent, so it comes
// from launch.
export function expectedSpin({ launch, aoa, clubSpeed }, clubId) {
  const ref = CLUB_REF[clubId] || CLUB_REF['7i'], k = LAUNCH_PER_LOFT[ref.kind];
  const refLoft = ref.vla / k - ref.aoa, refSpeed = ref.speed / ref.smash;
  const spinLoft = Math.max(2, launch / k - (aoa ?? ref.aoa));
  const v = clubSpeed > 0 ? clubSpeed : refSpeed;
  return ref.spin * (spinLoft / refLoft) * (v / refSpeed);
}

// bands for the four checks
export const SPIN_CHECK = {
  possible: [0.45, 2.0],   // × the spin expected at the club's usual attack
  strike: 0.3,             // ± share of the spin expected from the measured attack
  curve: 4,                // ° between the spin axis and 1.9 × face to path
};

// m: { spin, axis, launch, clubSpeed, aoa (measured, or null), ftp (measured, or null), spinSource }
export function spinTrust(m, clubId) {
  const checks = {}, why = [];
  if (m.spinSource === 'measured') return { verdict: 'use', why: ['measured'], expected: m.spin, fails: 0, checks: { measured: true } };
  // possible for the club at this launch and speed
  const typical = expectedSpin({ launch: m.launch, aoa: null, clubSpeed: m.clubSpeed }, clubId);
  checks.possible = m.spin >= typical * SPIN_CHECK.possible[0] && m.spin <= typical * SPIN_CHECK.possible[1];
  if (!checks.possible) why.push('impossible');
  // agrees with the strike (needs the measured attack)
  let expected = typical;
  if (m.aoa !== null && m.aoa !== undefined) {
    expected = expectedSpin({ launch: m.launch, aoa: m.aoa, clubSpeed: m.clubSpeed }, clubId);
    checks.strike = Math.abs(m.spin - expected) <= SPIN_CHECK.strike * expected;
    if (!checks.strike) why.push('strike');
  }
  // agrees with the curve (needs the measured face and path)
  if (m.ftp !== null && m.ftp !== undefined) {
    checks.curve = Math.abs(m.axis - 1.9 * m.ftp) <= SPIN_CHECK.curve;
    if (!checks.curve) why.push('curve');
  }
  const fails = why.length;
  // a spin the club can't make is dropped outright; otherwise one miss is a tie-breaker
  const verdict = !checks.possible || fails >= 2 ? 'ignore' : fails === 1 ? 'tie' : 'use';
  return { verdict, why, expected, fails, checks };
}

// the spin a rule should see for a verdict
export function spinForRules(raw, t) {
  if (t.verdict === 'use') return raw;
  if (t.verdict === 'tie') return (raw + t.expected) / 2;
  return t.expected;
}
