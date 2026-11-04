// Wedge Ladder rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: ball at the origin, aim down -z, metres. The runway is flat and level with you, so the
// numbers are true carries. Design: docs/MINIGAMES.md §7. Hit the band → climb a rung; miss → drop one.

export const YD = 0.9144;
export const SHOTS = 15;
export const LATERAL_YD = 22;        // the runway is ~44 yd wide: land anywhere across it

// wedges and a 9 iron (ball speed mph, launch deg, spin rpm): full swings, trimmed by the solver
export const CLUBS = [
  { id: '9i', name: '9 iron', Speed: 109, VLA: 20.4, TotalSpin: 8647 },
  { id: 'PW', name: 'Pitching wedge', Speed: 102, VLA: 24.2, TotalSpin: 9304 },
  { id: 'GW', name: 'Gap wedge', Speed: 90, VLA: 27.5, TotalSpin: 9600 },
  { id: 'SW', name: 'Sand wedge', Speed: 76, VLA: 31, TotalSpin: 9800 },
  { id: 'LW', name: 'Lob wedge', Speed: 66, VLA: 35, TotalSpin: 10000 },
];

// difficulty: which rungs, how wide each band is (± yd), and the PERFECT window
export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', rungs: [40, 50, 60, 70, 80, 90, 100], band: 5, perfect: 1.25, note: 'Rungs 40–100 yd. Land within 5 yd to climb.' },
  { id: 'amateur', label: 'Amateur', rungs: [40, 50, 60, 70, 80, 90, 100, 110, 120], band: 4, perfect: 1, note: 'Rungs 40–120 yd. Within 4 yd to climb.' },
  { id: 'pro', label: 'Pro', rungs: [40, 50, 60, 70, 80, 90, 100, 110, 120], band: 3, perfect: 1, note: 'Rungs 40–120 yd. Within 3 yd to climb.' },
  { id: 'tour', label: 'Tour', rungs: [40, 50, 60, 70, 80, 90, 100, 110, 120], band: 2, perfect: 0.75, note: 'Rungs 40–120 yd. Within 2 yd. Every yard counts.' },
];

export const POINTS = { base: 100, perRung: 25, perfect: 2, top: 300 };
export const rungPoints = i => POINTS.base + POINTS.perRung * i;

export const CHALLENGES = [
  { id: 'top', text: 'Reach the top rung', key: 'top', goal: 1 },
  { id: 'perf3', text: 'Land 3 perfects', key: 'perfects', goal: 3 },
  { id: 'nodrop', text: 'Climb 5 rungs in a row', key: 'climbRun', goal: 5 },
  { id: 'x4', text: 'Reach a ×4 streak', key: 'mult', goal: 4 },
  { id: 'perf1', text: 'Land a perfect', key: 'perfects', goal: 1, only: ['pro', 'tour'] },
  { id: 'climb8', text: 'Climb 8 times', key: 'climbs', goal: 8, only: ['beginner', 'amateur'] },
];

// Judge a landing (x, z in metres) against rung i. Distance is measured downrange, because the
// bands are painted straight across the runway: what you see is what counts.
export function judge(land, diff, i) {
  const target = diff.rungs[i], yd = -land.z / YD, off = yd - target;
  const lateral = Math.abs(land.x) / YD;
  const onRunway = lateral <= LATERAL_YD;
  const inBand = onRunway && Math.abs(off) <= diff.band;
  const perfect = inBand && Math.abs(off) <= diff.perfect;
  const missYd = inBand ? 0 : onRunway ? Math.abs(off) - diff.band : Math.hypot(Math.max(0, Math.abs(off) - diff.band), lateral - LATERAL_YD);
  return { target, yd, off, inBand, perfect, onRunway, missYd, dir: !onRunway ? (land.x > 0 ? 'right' : 'left') : off > 0 ? 'long' : 'short' };
}

// Climb on a hit, drop on a miss. At the top, a hit holds the top rung (and scores the top bonus).
export function step(rung, hit, n) {
  if (hit) return { rung: Math.min(n - 1, rung + 1), climbed: rung < n - 1, held: rung === n - 1 };
  return { rung: Math.max(0, rung - 1), dropped: rung > 0 };
}
export function points(i, j, n) { // i: rung played, j: judgement
  if (!j.inBand) return 0;
  return (rungPoints(i) + (i === n - 1 ? POINTS.top : 0)) * (j.perfect ? POINTS.perfect : 1);
}
