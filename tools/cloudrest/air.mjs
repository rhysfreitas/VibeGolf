// Thin air on Cloudrest: what a per-course altitude does club by club against sea level.
// node tools/cloudrest/air.mjs [altFt] [tempF]   (no args: a sweep for the driver, then the table at the pick)
import { simulate, airDensity } from '../../src/physics.js';

// the course's clubs (src/course/main.js CLUBS: TrackMan PGA Tour averages)
const TOUR = [
  ['Driver', 167, 10.9, 2686], ['3 wood', 158, 9.2, 3655], ['Hybrid', 146, 10.2, 4437], ['5 iron', 132, 12.1, 5361],
  ['7 iron', 120, 16.3, 7097], ['9 iron', 109, 20.4, 8647], ['PW', 102, 24.2, 9304], ['SW', 76, 31, 9800],
];
// a mid-handicap amateur's driver and 7 iron (TrackMan amateur averages, rounded)
const AM = [['Driver (amateur)', 140, 13, 3000], ['7 iron (amateur)', 105, 18, 6500]];
const MPH = 0.44704;

function fly(c, env, axis = 0, crossMph = 0) {
  const [, Speed, VLA, TotalSpin] = c;
  return simulate({ Speed, VLA, HLA: 0, TotalSpin, SpinAxis: axis }, {
    altFt: env.altFt, tempF: env.tempF, flightOnly: true, groundAt: () => 0,
    wind: { x: crossMph * MPH, z: 0 },
  });
}
function row(c, env) {
  const s = fly(c, env), sl = fly(c, env, 15), w = fly(c, env, 0, 10);
  return { carry: s.carry, apex: s.apexFt, slice: sl.carryOffline, drift: w.carryOffline, time: s.flightTime };
}
export function table(altFt, tempF = 72, clubs = [...TOUR, ...AM]) {
  const sea = { altFt: 0, tempF: 72 }, here = { altFt, tempF };
  return clubs.map(c => ({ club: c[0], sea: row(c, sea), here: row(c, here) }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tempF = +(process.argv[3] || 72);
  if (!process.argv[2]) {
    const s0 = fly(TOUR[0], { altFt: 0, tempF: 72 }).carry, a0 = fly(AM[0], { altFt: 0, tempF: 72 }).carry;
    console.log('altFt  rho    tour DR  +%    am DR  +%   (tempF', tempF + ')');
    for (let a = 0; a <= 9000; a += 500) {
      const t = fly(TOUR[0], { altFt: a, tempF }).carry, m = fly(AM[0], { altFt: a, tempF }).carry;
      console.log(String(a).padStart(5), airDensity(tempF, a).toFixed(3), t.toFixed(1).padStart(7), ((t / s0 - 1) * 100).toFixed(1).padStart(5), m.toFixed(1).padStart(7), ((m / a0 - 1) * 100).toFixed(1).padStart(5));
    }
  } else {
    const alt = +process.argv[2];
    console.log(`altFt ${alt}, ${tempF}°F (rho ${airDensity(tempF, alt).toFixed(3)} vs ${airDensity(72, 0).toFixed(3)})`);
    console.log('club               carry sea→here (+%)   apex ft sea→here   slice yd (axis 15°)   drift yd (10 mph across)');
    for (const r of table(alt, tempF)) {
      const p = (a, b) => `${a.toFixed(0)}→${b.toFixed(0)}`;
      console.log(r.club.padEnd(18), `${p(r.sea.carry, r.here.carry)} (${((r.here.carry / r.sea.carry - 1) * 100).toFixed(1)}%)`.padEnd(22),
        p(r.sea.apex, r.here.apex).padEnd(18), `${r.sea.slice.toFixed(1)}→${r.here.slice.toFixed(1)}`.padEnd(21), `${r.sea.drift.toFixed(1)}→${r.here.drift.toFixed(1)}`);
    }
  }
}
