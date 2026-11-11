// A test golfer and an R10 for checking the coach without a launch monitor. Pure.
//
// The golfer: an amateur at a share of tour club speed, the coach's own windows as the
// centre of his normal shot, and a decent amateur's swing-to-swing scatter (face σ 1.9°,
// path σ 2.4°, attack σ 1.1°, launch σ 0.9°, ball speed 1.2%, spin 7%).
// The R10: what reaches the coach. Measurement error on top of the swing (face σ 1.6°,
// path σ 3.0°, attack σ 1.3°, start line σ 0.5°, launch σ 0.4°, ball speed 0.5%), spin as an
// estimate (σ 12%, axis σ 2°), no loft, and the 0/0/0 club placeholder on a share of shots.
// The error sizes come from a published R10 vs TrackMan 4 comparison (average errors
// about 1.5–2.8° face, 3–3.8° path, up to 1.9° attack) and are an assumption until real
// sessions are recorded.

import { CLUB_REF, windowsFor } from '../../src/coach/windows.js';
import { applyFault } from '../../src/coach/faults.js';

export function rngOf(seed = 1) {
  let s = seed % 2147483647 || 1;
  const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { R, g };
}

// one normal swing for this player
export function normalShot(club, { speed = 0.87, rng }) {
  const r = CLUB_REF[club], vt = r.speed / r.smash, v = vt * speed, w = windowsFor(club, v), { g } = rng;
  const face = g() * 1.9, path = g() * 2.4;
  return {
    Speed: v * r.smash * (1 + g() * 0.012), VLA: w.launchC + g() * 0.9, HLA: face * 0.8 + path * 0.2,
    TotalSpin: w.spinC * (1 + g() * 0.07), SpinAxis: (face - path) * 1.9 + g() * 1.5,
    Club: { Speed: v * (1 + g() * 0.01), Path: path, FaceToTarget: face, AngleOfAttack: r.aoa + g() * 1.1 },
  };
}

// what the coach receives: 'ideal' (true numbers), 'r10' (measured), 'ballOnly' (no club data)
export function measure(shot, mode, { rng, dropout = 0.04 }) {
  if (mode === 'ideal') return shot;
  const { g, R } = rng, o = { ...shot, Club: shot.Club ? { ...shot.Club } : undefined };
  o.HLA += g() * 0.5; o.VLA += g() * 0.4; o.Speed *= 1 + g() * 0.005;
  o.TotalSpin *= 1 + g() * 0.12; o.SpinAxis += g() * 2;
  o.Meta = { source: 'ble', spinSource: 'estimated', marking: 'plain', timing: null };
  if (mode === 'ballOnly' || !o.Club || R() < dropout) { delete o.Club; return o; }
  o.Club.Path += g() * 3.0; o.Club.FaceToTarget += g() * 1.6; o.Club.AngleOfAttack += g() * 1.3; delete o.Club.Loft;
  return o;
}

export function swingWith(fault, club, { speed, scale = 1, mode = 'r10', rng }) {
  const s = applyFault(normalShot(club, { speed, rng }), fault, club, rng.R, scale);
  return measure(s, mode, { rng });
}
