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
};

// shot: a simulated ball with Club data (as the range's realSwing makes); returns a new shot
export function applyFault(shot, id, clubId, rnd = Math.random) {
  if (!id || id === 'none') return shot;
  const ref = CLUB_REF[clubId] || CLUB_REF['7i'];
  let d = DELTA[id];
  if (id === 'twoWay') { const s = rnd() < 0.5 ? -1 : 1; d = { path: s * 6, face: s * 3.5 }; }
  if (!d) return shot;
  const s = { ...shot, Club: { ...(shot.Club || {}) } }, c = s.Club;
  const face = d.face || 0, path = d.path || 0, aoa = d.aoa || 0, loft = d.loft || 0;
  const perDeg = 290 * ref.spin / 7097;           // rpm per degree of spin loft, scaled to the club
  s.HLA = (s.HLA || 0) + 0.8 * face + 0.2 * path;
  s.SpinAxis = (s.SpinAxis || 0) + 1.9 * (face - path);
  s.VLA = s.VLA + 0.8 * loft + (d.launch || 0);
  s.TotalSpin = Math.max(300, (s.TotalSpin + perDeg * (loft - aoa)) * (d.spinMul || 1));
  s.Speed = s.Speed * (d.smash || 1);
  if (c.Path !== undefined) c.Path = +c.Path + path; else c.Path = path;
  if (c.FaceToTarget !== undefined) c.FaceToTarget = +c.FaceToTarget + face; else c.FaceToTarget = face;
  c.AngleOfAttack = (c.AngleOfAttack !== undefined ? +c.AngleOfAttack : ref.aoa) + aoa;
  if (c.Loft !== undefined) c.Loft = +c.Loft + loft;
  return s;
}
