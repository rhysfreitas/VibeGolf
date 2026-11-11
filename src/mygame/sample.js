// Example sessions for My game (?demo=1): a mid-handicap player who flips his irons a little
// (high, spinny, a touch right) and pushes the driver on the course. Shaped like recorder.js's
// records. Seeded, so every load looks the same. Pure.

const CARRY = { DR: 232, '3W': 208, HY: 192, '5i': 172, '7i': 152, '9i': 132, PW: 116, SW: 84 };
const LAUNCH = { DR: 13, '3W': 11.5, HY: 13, '5i': 15, '7i': 19, '9i': 23, PW: 27, SW: 32 };
const SPIN = { DR: 2900, '3W': 3900, HY: 4700, '5i': 5600, '7i': 7300, '9i': 8700, PW: 9400, SW: 9800 };
const SPEED = { DR: 100, '3W': 95, HY: 89, '5i': 84, '7i': 79, '9i': 75, PW: 72, SW: 62 };
const SMASH = { DR: 1.45, '3W': 1.44, HY: 1.4, '5i': 1.34, '7i': 1.3, '9i': 1.25, PW: 1.2, SW: 1.12 };

export function sampleShots(now = Date.now()) {
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const out = []; let n = 0;
  const ball = (club, flip) => ({ Speed: SPEED[club] * SMASH[club] * (1 + g() * 0.015) * (flip ? 0.97 : 1), VLA: LAUNCH[club] + g() * 1 + (flip ? 2.5 : 0),
    HLA: g() * 2 + 0.6, TotalSpin: SPIN[club] * (1 + g() * 0.08) * (flip ? 1.14 : 1), SpinAxis: g() * 5 + (flip ? 4 : 1) });
  // three Practice Ground sessions over the last two weeks
  for (const [days, clubs] of [[13, ['7i', '9i', 'PW', 'DR']], [8, ['5i', '7i', 'HY', 'DR']], [2, ['3W', '7i', '9i', 'SW', 'DR']]]) {
    let t = now - days * 864e5;
    for (const club of clubs) for (let i = 0; i < 9; i++) {
      t += 40e3 + R() * 30e3;
      const iron = !['DR', '3W', 'HY'].includes(club), flip = iron && R() < 0.45, b = ball(club, flip);
      const carry = CARRY[club] * (1 + g() * 0.035) * (flip ? 0.95 : 1), side = carry * (g() * (iron ? 0.045 : 0.07) + (flip ? 0.05 : 0.012));
      out.push({ id: `demo.${++n}`, t, club, mode: days === 8 ? 'coach' : 'range', practice: true, live: true, ball: b,
        clubData: { Speed: SPEED[club] * (1 + g() * 0.01), Path: g() * 2 + (iron ? -1.2 : 0.8), FaceToTarget: g() * 1.6 + (flip ? 1.8 : 0.6), AngleOfAttack: (iron ? -3.5 : -0.5) + g() + (flip ? 2 : 0) },
        meta: { source: 'ble', spinSource: 'estimated' }, trust: { club: null, spin: 'use', spinWhy: [] },
        result: { carry: Math.round(carry * 10) / 10, total: Math.round(carry * (iron ? 1.04 : 1.1) * 10) / 10, landOffline: Math.round(side * 10) / 10, apexFt: Math.round(LAUNCH[club] * 4.2) },
        coach: days === 8 && i === 4 && iron ? [{ type: 'read', id: 'flip' }] : null, feel: R() < 0.2 ? (flip ? 'thin' : 'pure') : null });
    }
  }
  // two rounds
  for (const [days, course] of [[10, 'redmesa'], [4, 'aerie']]) {
    let t = now - days * 864e5;
    for (let hole = 1; hole <= 9; hole++) {
      const par = [4, 3, 5, 4, 4, 3, 4, 5, 4][hole - 1];
      const shots = par === 3 ? [['7i', 'tee', 158]] : par === 4 ? [['DR', 'tee', 390], ['9i', 'fairway', 138]] : [['DR', 'tee', 520], ['HY', 'fairway', 290], ['PW', 'fairway', 108]];
      shots.forEach(([club, fromLie, fromPin], k) => {
        t += 150e3;
        const right = club === 'DR' ? 13 + g() * 12 : 3 + g() * 7, long = club === 'DR' ? g() * 10 : -6 + g() * 8;
        const restLie = club === 'DR' ? (Math.abs(right) < 14 ? 'fairway' : R() < 0.15 ? 'water' : 'rough') : (Math.abs(right) < 9 && Math.abs(long) < 9 ? 'green' : long < -9 ? 'fairway' : 'rough');
        const aimYd = club === 'DR' || club === 'HY' ? Math.min(fromPin, CARRY[club] + 10) : fromPin;
        out.push({ id: `demo.${++n}`, t, club, mode: 'course', practice: false, live: true, ball: ball(club, false), clubData: null, meta: { source: 'ble' },
          trust: { club: 'missing', spin: 'use', spinWhy: [] }, result: null, coach: null, feel: null,
          course: { course, hole, par, stroke: k + 1, fromLie, fromPin, restLie, toPin: Math.max(5, fromPin - aimYd + Math.abs(long) + Math.abs(right) * 0.4), carry: CARRY[club], aimYd, long: Math.round(long * 10) / 10, right: Math.round(right * 10) / 10 } });
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
