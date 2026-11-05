// Course conditions and tee sets: pure data and maths shared by every course (no DOM, no Three.js).
//
// Compass bearings are degrees clockwise from north. Each hole has a `heading` (the bearing from
// tee to green); the hole's frame plays down -z, so a bearing B lands at α = B − heading clockwise
// from straight down the hole.

export const TIMES = {
  morning: { label: 'Morning', sunAz: 105, sunEl: 17 },
  midday:  { label: 'Midday', sunAz: 185, sunEl: 62 },
  golden:  { label: 'Golden hour', sunAz: 258, sunEl: 8.5 },
  night:   { label: 'Night', sunAz: 140, sunEl: 38, night: true }, // the moon
};
export const WINDS = {
  calm:   { label: 'Calm', mph: [0, 0] },
  light:  { label: 'Light', mph: [3, 7] },
  breezy: { label: 'Breezy', mph: [8, 14] },
  strong: { label: 'Strong', mph: [15, 24] },
};
export const WEATHER = {
  clear:    { label: 'Clear' },
  haze:     { label: 'High haze' },
  overcast: { label: 'Overcast' },
};
export const TEMPS = { cool: { label: 'Cool', f: 55 }, mild: { label: 'Mild', f: 72 }, hot: { label: 'Hot', f: 95 } };
// wind direction choices: 'random' or the bearing it blows FROM
export const WIND_FROM = [['random', 'Random'], [0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];

const MPH = 0.44704;

// Roll the round's wind once: a base speed and bearing; each hole shifts it a little, like a
// real afternoon. rand() is any 0..1 generator, so tests can pin it.
export function rollWind(setting, rand = Math.random) {
  const [lo, hi] = WINDS[setting.wind]?.mph || [0, 0];
  const mph = lo + (hi - lo) * rand();
  const from = setting.windFrom === 'random' || setting.windFrom == null ? Math.round(rand() * 72) * 5 : +setting.windFrom;
  const holes = Array.from({ length: 18 }, () => ({ dMph: (rand() - 0.5) * 0.3, dFrom: (rand() - 0.5) * 30 }));
  return { mph, from, holes };
}
export function holeWind(roll, holeIdx) {
  if (!roll || roll.mph <= 0) return { mph: 0, from: roll ? roll.from : 0 };
  const h = roll.holes[holeIdx % roll.holes.length];
  return { mph: Math.max(0, roll.mph * (1 + h.dMph)), from: (roll.from + h.dFrom + 360) % 360 };
}
// the air's velocity in the hole's frame (m/s): it blows from `from` toward from+180
export function windVector(w, heading = 0) {
  const a = ((w.from + 180 - heading) * Math.PI) / 180, v = w.mph * MPH;
  return { x: Math.sin(a) * v, z: -Math.cos(a) * v };
}
// the same air seen from a shot aimed `yaw` radians clockwise from down the hole (physics frame)
export function windInShot(vec, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { x: vec.x * c + vec.z * s, z: -vec.x * s + vec.z * c };
}
// sun or moon direction in the hole frame as Three's spherical (polar, azimuth) in radians
export function skyAngles(bearing, elevation, heading = 0) {
  const a = ((bearing - heading) * Math.PI) / 180;
  return { polar: ((90 - elevation) * Math.PI) / 180, azimuth: Math.PI - a };
}

/* ---------- tee sets ---------- */
// Tee It Forward: match driver distance (median total) to course length.
export function suggestTee(sets, drives) {
  if (!drives || drives.length < 3) return { id: sets[1].id, guessed: true };
  const s = [...drives].sort((a, b) => a - b), m = s.length >> 1, med = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  const pick = sets.find(t => med >= t.minDrive) || sets.at(-1);
  return { id: pick.id, median: Math.round(med), guessed: false };
}
export function teeYards(holes, setId) { return holes.reduce((a, h) => a + (typeof h.yards === 'number' ? h.yards : h.yards[setId]), 0); }
