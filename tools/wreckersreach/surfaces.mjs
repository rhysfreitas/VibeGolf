// Wrecker's Reach: what the ground does to a ball today, and what the links surfaces would do.
// node tools/wreckersreach/surfaces.mjs  -> a table of run-outs, lie costs and wind effects.
import { simulate, SURFACES, airDensity } from '../../src/physics.js';
const rho = airDensity(72, 0);
const SHOTS = {
  'tour DR': { Speed: 167, VLA: 10.9, TotalSpin: 2686 },
  'amat DR': { Speed: 140, VLA: 12.5, TotalSpin: 3000 },
  '5i': { Speed: 132, VLA: 12.1, TotalSpin: 5361 },
  '7i': { Speed: 120, VLA: 16.3, TotalSpin: 7097 },
  'PW': { Speed: 102, VLA: 24.2, TotalSpin: 9304 },
};
const LIE = { // main.js lieAdjust today
  fairway: s => s,
  firstcut: s => ({ ...s, Speed: s.Speed * 0.98, TotalSpin: s.TotalSpin * 0.88, VLA: s.VLA + 0.3 }),
  rough: s => ({ ...s, Speed: s.Speed * 0.94, TotalSpin: s.TotalSpin * 0.7, VLA: s.VLA + 0.8 }),
  sand: s => ({ ...s, Speed: s.Speed * 0.86, TotalSpin: s.TotalSpin * 0.65, VLA: s.VLA + 2 }),
  waste: s => ({ ...s, Speed: s.Speed * 0.94, TotalSpin: s.TotalSpin * 0.78, VLA: s.VLA + 0.6 }),
  desert: s => ({ ...s, Speed: s.Speed * 0.9, TotalSpin: s.TotalSpin * 0.62, VLA: s.VLA + 1 }),
};
export const run = (shot, surf, wind = 0, side = 0) => {
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, { rho, surfaceAt: () => surf, wind: { x: side, z: wind } });
  return { carry: r.carry, total: r.totalDown, roll: r.totalDown - r.carry, off: r.offline, carryOff: r.carryOffline };
};
const f = n => n.toFixed(0).padStart(5);
if (process.argv[1].endsWith('surfaces.mjs')) {
  console.log('Run-out (yd past the landing) by surface, still air');
  console.log('shot     ' + Object.keys(SURFACES).filter(s => s !== 'water').map(s => s.slice(0, 7).padStart(8)).join(''));
  for (const [k, s] of Object.entries(SHOTS)) console.log(k.padEnd(9) + Object.keys(SURFACES).filter(s => s !== 'water').map(su => f(run(s, su).roll).padStart(8)).join(''));
  console.log('\nLie cost today (total yd from that lie vs fairway, landing on fairway)');
  for (const k of ['7i', 'PW']) for (const [l, a] of Object.entries(LIE)) {
    const b = run(SHOTS[k], 'fairway').total, r = run(a(SHOTS[k]), 'fairway').total;
    console.log(`${k} ${l.padEnd(9)} ${f(r)} yd  ${(100 * (r / b - 1)).toFixed(0)}%`);
  }
  const MPH = 0.44704;
  console.log('\nWind: carry change (yd) into (+) / down (−) and drift across, at mph');
  for (const mph of [10, 15, 20, 24]) for (const k of ['tour DR', 'amat DR', '7i', 'PW']) {
    const c0 = run(SHOTS[k], 'fairway').carry, ci = run(SHOTS[k], 'fairway', mph * MPH).carry, cd = run(SHOTS[k], 'fairway', -mph * MPH).carry;
    const x = run(SHOTS[k], 'fairway', 0, mph * MPH).carryOff;
    console.log(`${String(mph).padStart(2)} mph ${k.padEnd(8)} carry ${f(c0)}  into ${f(ci - c0)}  down ${f(cd - c0)}  across ${f(x)}`);
  }
}
export { SHOTS, LIE };
