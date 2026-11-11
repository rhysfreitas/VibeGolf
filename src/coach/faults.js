// Coaching range: swing-fault presets for simulated shots, so the coach can be tested without
// the R10. Pure. A fault shifts the club delivery (face, path, attack, loft, strike) and the
// ball follows by a simple D-plane: start ≈ 0.8 face + 0.2 path, spin axis ≈ 1.9 × face to
// path, launch ≈ 0.8 × added loft, spin ≈ 290 rpm per degree of spin loft (scaled by club).

import { CLUB_REF } from './windows.js';

export const FAULTS = [
  { id: 'none', name: 'None' },
  { id: 'flip', name: 'Flip' },
  { id: 'overTheTop', name: 'Over the top' },
  { id: 'openFace', name: 'Open face' },
  { id: 'closedFace', name: 'Closed face' },
  { id: 'stuck', name: 'Stuck' },
  { id: 'steep', name: 'Steep' },
  { id: 'fat', name: 'Fat' },
  { id: 'thin', name: 'Thin' },
  { id: 'twoWay', name: 'Two-way' },
  { id: 'aimedOff', name: 'Aimed right' },
  { id: 'ballBack', name: 'Ball back' },
  { id: 'ballForward', name: 'Ball forward' },
  { id: 'driverDown', name: 'Driver hitting down' },
  { id: 'offCentre', name: 'Off-centre' },
  { id: 'distance', name: 'Distance spread' },
  { id: 'top', name: 'Topped' },
  { id: 'shank', name: 'Shank' },
  // skill attempts (Learn a skill): the swing doing what the lesson asks
  { id: 'draw', name: 'Skill: draw swing' },
  { id: 'fade', name: 'Skill: fade swing' },
  { id: 'compress', name: 'Skill: compressed' },
  { id: 'hitUp', name: 'Skill: hitting up' },
  { id: 'low', name: 'Skill: knockdown' },
  { id: 'high', name: 'Skill: high shot' },
  { id: 'faster', name: 'Skill: faster swing' },
];

// delivery changes: face, path, attack, loft (deg), smash ×, spin ×, launch + (strike effects)
const DELTA = {
  flip: { face: 2, loft: 7, aoa: 1.5, smash: 0.95 },
  overTheTop: { face: -1.5, path: -6, aoa: -2.5 },
  openFace: { face: 4.5 },
  closedFace: { face: -4.5 },
  stuck: { face: 3, path: 6.5, aoa: 1 },
  steep: { aoa: -5, loft: -2.5 },
  fat: { smash: 0.86, spinMul: 0.85, launch: 1 },
  thin: { smash: 0.95, spinMul: 0.65, launch: -5 },
  aimedOff: { face: 4, path: 4 },
  ballBack: { aoa: -4, path: 4.5, face: 3, loft: -3 },
  ballForward: { aoa: 3.5, path: -3.5, face: -2.5, loft: 1, smash: 0.96 },
  driverDown: { aoa: -5, loft: -1 },
  offCentre: { smash: 0.935 },
  top: { launch: -40, spinMul: 0.3, smash: 0.82 },
  shank: { face: 14, smash: 0.7, spinMul: 0.8 },
  draw: { face: 1.5, path: 5 },
  fade: { face: -1.5, path: -5 },
  compress: { loft: -4, aoa: -1.5, smash: 1.01 },
  hitUp: { aoa: 5.5, loft: 3 },
  low: { loft: -7, aoa: -1, launch: -1 },
  high: { loft: 6 },
  faster: { speed: 1.06 },
};

// shot: a simulated ball with Club data (as the range's realSwing makes); returns a new shot.
// `scale` makes the fault milder (under 1) or stronger (over 1): angles and the strike
// effects scale together.
export function applyFault(shot, id, clubId, rnd = Math.random, scale = 1) {
  if (!id || id === 'none') return shot;
  const ref = CLUB_REF[clubId] || CLUB_REF['7i'];
  let d = DELTA[id];
  if (id === 'twoWay') { const s = rnd() < 0.5 ? -1 : 1; d = { path: s * 6, face: s * 3.5 }; }
  // distance spread: strike, low point and swing length all wander from shot to shot
  if (id === 'distance') { const u = () => rnd() - 0.5; d = { smash: 1 - 0.09 * rnd(), loft: 6 * u(), aoa: 3 * u(), speed: 1 + 0.05 * u() }; }
  if (!d) return shot;
  if (scale !== 1) { const k = scale, m = v => (v === undefined ? v : 1 + (v - 1) * k); d = { ...d, smash: m(d.smash), spinMul: m(d.spinMul), speed: m(d.speed) };
    for (const f of ['face', 'path', 'aoa', 'loft', 'launch', 'axis']) if (d[f] !== undefined) d[f] *= k; }
  const s = { ...shot, Club: { ...(shot.Club || {}) } }, c = s.Club;
  const face = d.face || 0, path = d.path || 0, aoa = d.aoa || 0, loft = d.loft || 0;
  const perDeg = 290 * ref.spin / 7097;           // rpm per degree of spin loft, scaled to the club
  s.HLA = (s.HLA || 0) + 0.8 * face + 0.2 * path;
  s.SpinAxis = (s.SpinAxis || 0) + 1.9 * (face - path) + (d.axis || 0);
  s.VLA = Math.max(0.5, s.VLA + 0.8 * loft + (d.launch || 0));
  s.TotalSpin = Math.max(300, (s.TotalSpin + perDeg * (loft - aoa)) * (d.spinMul || 1));
  s.Speed = s.Speed * (d.smash || 1) * (d.speed || 1);
  if (d.speed && c.Speed !== undefined) c.Speed = +c.Speed * d.speed;
  if (c.Path !== undefined) c.Path = +c.Path + path; else c.Path = path;
  if (c.FaceToTarget !== undefined) c.FaceToTarget = +c.FaceToTarget + face; else c.FaceToTarget = face;
  c.AngleOfAttack = (c.AngleOfAttack !== undefined ? +c.AngleOfAttack : ref.aoa) + aoa;
  if (c.Loft !== undefined) c.Loft = +c.Loft + loft;
  return s;
}
