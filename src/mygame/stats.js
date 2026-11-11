// My game: numbers and tendencies from the session record (src/recorder.js). Pure.
//
//   bagStats(shots)          per club: carry, total, spread, launch, spin, speed, smash, gaps
//                            (Practice Ground live shots only, the last 40 per club)
//   practiceTendencies(shots) per club on the Practice Ground: the miss, the shape, face and path,
//                            what the coach read, the feels you tagged
//   courseTendencies(shots)  on the course: drives (fairways, the miss), approaches by distance
//                            (short, long, left, right of where you aimed), penalties, by club
//   compare(bag, course)     where a club plays differently on the course than in practice

export const CLUB_ORDER = ['DR', '3W', 'HY', '5i', '7i', '9i', 'PW', 'SW'];
export const CLUB_NAMES = { DR: 'Driver', '3W': '3 wood', HY: 'Hybrid', '5i': '5 iron', '7i': '7 iron', '9i': '9 iron', PW: 'Pitching wedge', SW: 'Sand wedge' };
export const PER_CLUB = 40;
export const MIN_SHOTS = 3;   // fewer than this and a club shows as "not enough shots"

const med = a => { const b = a.filter(v => v !== null && v !== undefined && isFinite(v)).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null; };
const mean = a => { const b = a.filter(v => v !== null && v !== undefined && isFinite(v)); return b.length ? b.reduce((s, v) => s + v, 0) / b.length : null; };
const sd = a => { const b = a.filter(v => v !== null && v !== undefined && isFinite(v)); if (b.length < 2) return null; const m = mean(b); return Math.sqrt(mean(b.map(v => (v - m) ** 2))); };
const q = (a, p) => { const b = a.filter(v => isFinite(v)).sort((x, y) => x - y); if (!b.length) return null; const i = (b.length - 1) * p, lo = Math.floor(i); return b[lo] + (b[Math.min(lo + 1, b.length - 1)] - b[lo]) * (i - lo); };
const share = (a, f) => (a.length ? a.filter(f).length / a.length : 0);
const byClub = shots => { const m = new Map(); for (const s of shots) { if (!s.club) continue; if (!m.has(s.club)) m.set(s.club, []); m.get(s.club).push(s); } return m; };
const ordered = m => [...m.keys()].sort((a, b) => (CLUB_ORDER.indexOf(a) + 99) % 99 - (CLUB_ORDER.indexOf(b) + 99) % 99);
const trustedClub = s => s.clubData && !(s.trust && s.trust.club);
const spinOk = s => !s.trust || s.trust.spin !== 'ignore';

// the shots that feed your numbers
export const practiceShots = shots => shots.filter(s => s.practice && s.live !== false && s.result && isFinite(s.result.carry));
export const courseShots = shots => shots.filter(s => s.mode === 'course' && s.live !== false && s.course);

export function bagStats(shots) {
  const m = byClub(practiceShots(shots)), rows = [];
  for (const club of ordered(m)) {
    const all = m.get(club), S = all.slice(-PER_CLUB), carry = S.map(s => s.result.carry);
    const row = { club, name: CLUB_NAMES[club] || club, n: S.length, total: all.length, enough: S.length >= MIN_SHOTS,
      carry: med(carry), totalYd: med(S.map(s => s.result.total)),
      depth: S.length >= MIN_SHOTS ? [q(carry, 0.1), q(carry, 0.9)] : null,
      side: med(S.map(s => s.result.landOffline ?? s.result.offline)), sideSpread: sd(S.map(s => s.result.landOffline ?? s.result.offline)),
      launch: med(S.map(s => s.ball && s.ball.VLA)), spin: med(S.filter(spinOk).map(s => s.ball && s.ball.TotalSpin)),
      ballSpeed: med(S.map(s => s.ball && s.ball.Speed)), clubSpeed: med(S.map(s => s.clubData && s.clubData.Speed > 0 ? s.clubData.Speed : null)),
      apexFt: med(S.map(s => s.result.apexFt)), last: S[S.length - 1].t };
    row.smash = row.ballSpeed && row.clubSpeed ? row.ballSpeed / row.clubSpeed : null;
    rows.push(row);
  }
  for (let i = 0; i < rows.length - 1; i++) if (rows[i].carry !== null && rows[i + 1].carry !== null) rows[i].gap = rows[i].carry - rows[i + 1].carry;
  return rows;
}

// curve from the spin axis: + = right (fade/slice for a right-hander)
const shapeOf = axis => (axis === null ? null : axis > 8 ? 'slice' : axis > 2.5 ? 'fade' : axis < -8 ? 'hook' : axis < -2.5 ? 'draw' : 'straight');
export const SHAPE_NAMES = { slice: 'Slice', fade: 'Fade', straight: 'Straight', draw: 'Draw', hook: 'Hook' };

export function practiceTendencies(shots) {
  const m = byClub(practiceShots(shots)), out = [];
  for (const club of ordered(m)) {
    const S = m.get(club).slice(-PER_CLUB); if (S.length < MIN_SHOTS) continue;
    const side = S.map(s => s.result.landOffline ?? s.result.offline), carry = med(S.map(s => s.result.carry)) || 1, wide = Math.max(5, carry * 0.06);
    const axis = med(S.filter(spinOk).map(s => s.ball && s.ball.SpinAxis)), C = S.filter(trustedClub);
    const reads = {}, feels = {};
    for (const s of S) { for (const e of s.coach || []) if (e.type === 'read' && e.id) reads[e.id] = (reads[e.id] || 0) + 1; if (s.feel) feels[s.feel] = (feels[s.feel] || 0) + 1; }
    out.push({ club, name: CLUB_NAMES[club] || club, n: S.length,
      left: share(side, v => v < -wide), right: share(side, v => v > wide), side: med(side),
      shape: shapeOf(axis), axis,
      path: C.length >= MIN_SHOTS ? med(C.map(s => s.clubData.Path)) : null,
      ftp: C.length >= MIN_SHOTS ? med(C.map(s => s.clubData.FaceToTarget - s.clubData.Path)) : null,
      aoa: C.length >= MIN_SHOTS ? med(C.map(s => s.clubData.AngleOfAttack)) : null,
      reads: Object.entries(reads).sort((a, b) => b[1] - a[1]), feels });
  }
  return out;
}

// approaches: shots aimed at the green from 50 yd or more (the aim landed within 15% of the pin's distance)
const BUCKETS = [[50, 100], [100, 150], [150, 200], [200, 260]];
export function courseTendencies(shots) {
  const S = courseShots(shots);
  const drives = S.filter(s => s.course.fromLie === 'tee' && s.course.par >= 4);
  const fair = s => ['fairway', 'fringe', 'firstcut'].includes(s.course.restLie);
  const miss = (arr, k, lo, hi) => share(arr.filter(s => s.course[k] !== undefined), s => (lo !== null && s.course[k] < lo) || (hi !== null && s.course[k] > hi));
  const driveSide = d => d.filter(s => s.course.right !== undefined);
  const dr = driveSide(drives);
  const drive = { n: drives.length, fairways: share(drives, fair), left: share(dr, s => s.course.right < -12 && !fair(s)), right: share(dr, s => s.course.right > 12 && !fair(s)),
    penalties: share(drives, s => ['void', 'water'].includes(s.course.restLie)), carry: med(drives.map(s => s.course.carry)) };
  const appr = S.filter(s => s.course.fromPin >= 50 && s.course.fromLie !== 'green' && s.course.aimYd !== undefined && Math.abs(s.course.aimYd - s.course.fromPin) <= s.course.fromPin * 0.15);
  const approaches = BUCKETS.map(([lo, hi]) => {
    const A = appr.filter(s => s.course.fromPin >= lo && s.course.fromPin < hi);
    return { lo, hi, n: A.length, short: miss(A, 'long', -8, null), long: miss(A, 'long', null, 8), left: miss(A, 'right', -8, null), right: miss(A, 'right', null, 8),
      green: share(A, s => s.course.restLie === 'green' || s.course.restLie === 'holed'), leave: med(A.map(s => s.course.toPin)),
      longBy: med(A.map(s => s.course.long)), rightBy: med(A.map(s => s.course.right)) };
  });
  const m = byClub(S.filter(s => s.course.long !== undefined && s.course.fromLie !== 'green')), clubs = [];
  for (const club of ordered(m)) { const A = m.get(club); if (A.length < MIN_SHOTS) continue;
    clubs.push({ club, name: CLUB_NAMES[club] || club, n: A.length, longBy: med(A.map(s => s.course.long)), rightBy: med(A.map(s => s.course.right)),
      spread: sd(A.map(s => s.course.right)), lies: [...new Set(A.map(s => s.course.fromLie))] }); }
  const rounds = new Set(S.map(s => s.course.course + '|' + Math.floor(s.t / 864e5))).size;
  return { n: S.length, rounds, drive, approaches, clubs, penalties: S.filter(s => ['void', 'water'].includes(s.course.restLie)).length };
}

// a club that plays differently on the course than on the Practice Ground (2+ yd of bias, enough shots)
export function compare(bag, practice, course) {
  const out = [];
  for (const c of course.clubs) {
    const p = practice.find(x => x.club === c.club), b = bag.find(x => x.club === c.club);
    if (!p || !b || !b.enough) continue;
    const dSide = (c.rightBy ?? 0) - (p.side ?? 0);
    if (Math.abs(dSide) >= 4) out.push({ club: c.club, name: c.name, kind: 'side', by: dSide });
    if (c.longBy !== null && Math.abs(c.longBy) >= 5) out.push({ club: c.club, name: c.name, kind: 'depth', by: c.longBy });
  }
  return out;
}
