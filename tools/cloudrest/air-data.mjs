// Thin air, the wall and the mist on Cloudrest: every number in the round-0 proposal (air-sheets.py draws it).
// node tools/cloudrest/air-data.mjs > tools/cloudrest/out/air.json
// Nothing here changes the game: the proposed damp turf is a local copy of a surface, not in physics.js.
import { simulate, airDensity, SURFACES } from '../../src/physics.js';

const ALT = 8500;                        // Cloudrest's altitude (ft), Rhys's pick 15 November 2026: an amateur's driver carries 10% further at 72°F
const MPH = 0.44704, YD = 0.9144;
const TOUR = [
  ['Driver', 167, 10.9, 2686], ['3 wood', 158, 9.2, 3655], ['Hybrid', 146, 10.2, 4437], ['5 iron', 132, 12.1, 5361],
  ['7 iron', 120, 16.3, 7097], ['9 iron', 109, 20.4, 8647], ['PW', 102, 24.2, 9304], ['SW', 76, 31, 9800],
];
const AM = [['Driver (amateur)', 140, 13, 3000], ['7 iron (amateur)', 105, 18, 6500]];
const shot = (c, extra = {}) => ({ Speed: c[1], VLA: c[2], TotalSpin: c[3], HLA: 0, SpinAxis: 0, ...extra });
const air = (altFt, tempF = 72) => ({ altFt, tempF });

function clubRow(c, env) {
  const fl = o => simulate(shot(c, o.shot), { ...env, flightOnly: true, groundAt: () => 0, wind: o.wind });
  const s = fl({}), sl = fl({ shot: { SpinAxis: 15 } }), w = fl({ wind: { x: 10 * MPH, z: 0 } });
  const r = simulate(shot(c), { ...env, surfaceAt: () => 'fairway' });
  return { carry: s.carry, total: r.total, run: r.total - r.carry, apexFt: s.apexFt, descent: s.descent, slice: sl.carryOffline, drift: w.carryOffline };
}
const clubs = [...TOUR, ...AM].map(c => ({ club: c[0], am: c[0].includes('amateur'), sea: clubRow(c, air(0)), here: clubRow(c, air(ALT)) }));

// flight paths (side view) for three clubs, and the slice seen from above
const path = (c, env, o = {}) => simulate(shot(c, o), { ...env, flightOnly: true, groundAt: () => 0 }).pts
  .filter((p, i) => i % 6 === 0).map(p => [-p.p[2] / YD, p.p[1] / YD, p.p[0] / YD]);
const paths = ['Driver', '7 iron', 'PW'].map(n => { const c = TOUR.find(t => t[0] === n); return { club: n, sea: path(c, air(0)), here: path(c, air(ALT)) }; });
const slicePaths = { sea: path(TOUR[0], air(0), { SpinAxis: 15 }), here: path(TOUR[0], air(ALT), { SpinAxis: 15 }) };

// how high the air goes: driver carry gain against altitude, tour and amateur
const carryAt = (c, a, t = 72) => simulate(shot(c), { altFt: a, tempF: t, flightOnly: true, groundAt: () => 0 }).carry;
const sweep = [];
for (let a = 0; a <= 12000; a += 500) sweep.push({ altFt: a, rho: airDensity(72, a), tour: carryAt(TOUR[0], a) / carryAt(TOUR[0], 0) - 1, am: carryAt(AM[0], a) / carryAt(AM[0], 0) - 1, wedge: carryAt(TOUR[6], a) / carryAt(TOUR[6], 0) - 1 });
const temps = [55, 72, 95].map(t => ({ tempF: t, tour: carryAt(TOUR[0], ALT, t) / carryAt(TOUR[0], 0) - 1 }));
const others = [['Red Mesa', 5200], ['Emberfell', 3550], ['The Lost Valley', 1320], ['Rimeholm', 1200], ['Eldergrove', 1200]]
  .map(([name, a]) => ({ name, altFt: a, tour: carryAt(TOUR[0], a) / carryAt(TOUR[0], 0) - 1 }));

// the highest shots the game can see, against the alcove's roof
const tall = [['A skied drive', { Speed: 150, VLA: 35, TotalSpin: 4500 }], ['A pop-up driver', { Speed: 120, VLA: 55, TotalSpin: 6000 }],
  ['A very high 7 iron', { Speed: 125, VLA: 28, TotalSpin: 9000 }], ['A full wedge, high', { Speed: 95, VLA: 40, TotalSpin: 11000 }],
  ['A stock tour driver', { Speed: 167, VLA: 10.9, TotalSpin: 2686 }]]
  .map(([n, s]) => ({ shot: n, sea: simulate({ HLA: 0, SpinAxis: 0, ...s }, { flightOnly: true, groundAt: () => 0 }).apexFt * 0.3048, here: simulate({ HLA: 0, SpinAxis: 0, ...s }, { altFt: ALT, flightOnly: true, groundAt: () => 0 }).apexFt * 0.3048 }));

// the run: today's fairway in thin air against a damp, softer turf (proposed, not in the game)
SURFACES.cloudDamp = SURFACES.damp; // in physics.js since Rhys picked it
const runRow = (c) => {
  const one = (surf, a) => { const r = simulate(shot(c), { surfaceAt: () => surf, altFt: a }); return { carry: r.carry, run: r.total - r.carry, total: r.total }; };
  return { club: c[0], sea: one('fairway', 0), thin: one('fairway', ALT), damp: one('cloudDamp', ALT) };
};
const run = [TOUR[0], AM[0], TOUR[4], TOUR[6]].map(runRow);
const greenRun = [TOUR[4], TOUR[6], AM[1]].map(c => {
  const g = a => { const r = simulate(shot(c), { surfaceAt: () => 'green', altFt: a }); return r.total - r.carry; };
  return { club: c[0], sea: g(0), here: g(ALT) };
});

// the wall: a 62 m shelf, the wall 31 m right of the line, the mist 31 m left; 4,000 drives biased toward the wall
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const W = 31, M = -31;
const rockWall = soak => ({ groundAt: x => x < M ? null : 0, solidAt: (x, y) => x > W && y < 90 ? Object.assign([-1, 0, 0], { soak }) : null });
const kerb = { groundAt: x => x < M ? null : (x < M + 3 ? 0.9 : 0) }; // a 0.9 m rock kerb 3 m wide at the outer edge
const wallModels = [
  ['Cliff as ground (the engine today)', { groundAt: x => x < M ? null : x > W ? 90 : 0 }],
  ['Cliff as ground, with a kerb', { groundAt: x => x < M ? null : x > W ? 90 : (x < M + 3 ? 0.9 : 0) }],
  ['Soaking rock 0.45 (The Reclaim)', rockWall(0.45)],
  ['Soaking rock 0.45, with a kerb', { ...rockWall(0.45), groundAt: kerb.groundAt }],
  ['Soaking rock 0.8', rockWall(0.8)],
];
const wall = wallModels.map(([name, m]) => {
  seed = 7; let hit = 0, foot = 0, back = 0, mist = 0; const off = [];
  for (let i = 0; i < 4000; i++) {
    const am = rnd() < 0.5;
    const s = am ? { Speed: 140 + gauss() * 6, VLA: 13 + gauss(), TotalSpin: 3000 + gauss() * 400 } : { Speed: 167 + gauss() * 4, VLA: 10.9 + gauss() * 0.7, TotalSpin: 2686 + gauss() * 300 };
    s.HLA = 3 + gauss() * 5; s.SpinAxis = 6 + gauss() * 9;
    const r = simulate(s, { ...m, altFt: ALT, voidY: -40 });
    if (!r.rockHits) continue;
    hit++;
    const e = r.pts[r.pts.length - 1].p;
    if (r.outcome === 'void' || e[1] < -1) { mist++; continue; }
    const d = W - e[0]; off.push(d / YD);
    if (d < 6) foot++; else back++;
  }
  off.sort((a, b) => a - b);
  const q = p => off.length ? off[Math.floor(p * (off.length - 1))] : null;
  return { model: name, drives: 4000, hit, foot: foot / hit, back: back / hit, mist: mist / hit, p50: q(0.5), p90: q(0.9), max: q(1) };
});

console.log(JSON.stringify({ alt: ALT, rho: { sea: airDensity(72, 0), here: airDensity(72, ALT) }, clubs, paths, slicePaths, sweep, temps, others, tall, run, greenRun, wall }, null, 1));
