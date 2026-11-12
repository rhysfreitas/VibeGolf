// A round in progress, saved on this device after every stroke so a reload, a locked screen or a closed
// tab doesn't lose it. Pure: the course page does the storing (localStorage `vibegolf.course.<id>.round`).
// A save is offered back for 18 hours; a finished round is never kept.
const VERSION = 1;
export const ROUND_MAX_AGE = 18 * 3600 * 1000;
const COND_KEYS = ['tee', 'time', 'wind', 'windFrom', 'weather', 'temp'];

export function packRound(s, now = Date.now()) {
  const cond = {}; for (const k of COND_KEYS) if (s.cond[k] !== undefined) cond[k] = s.cond[k];
  return {
    v: VERSION, at: now, course: s.courseId, cond, windRoll: s.windRoll, pinPick: s.pinPick || [],
    scores: Array.from(s.scores || [], x => (x == null ? null : x)),
    holeIdx: s.holeIdx, strokes: s.strokes, ball: s.ball.map(n => Math.round(n * 100) / 100), lie: s.lie, holed: !!s.holed,
    once: Array.isArray(s.once) ? s.once.filter(k => typeof k === 'string') : [],   // once-a-round events already seen (the Lost Valley's pterosaur)
  };
}

// The saved round if it can be picked up on this course as it is now, else null.
// course = { id, holes (count), teeIds }
export function readRound(raw, course, now = Date.now()) {
  let r = raw;
  if (typeof raw === 'string') { try { r = JSON.parse(raw); } catch (e) { return null; } }
  if (!r || typeof r !== 'object' || r.v !== VERSION || r.course !== course.id) return null;
  if (!(now - r.at >= 0) || now - r.at > ROUND_MAX_AGE) return null;
  if (!Number.isInteger(r.holeIdx) || r.holeIdx < 0 || r.holeIdx >= course.holes) return null;
  if (r.holed && r.holeIdx >= course.holes - 1) return null;                 // the round was finished
  if (!r.cond || !course.teeIds.includes(r.cond.tee)) return null;
  if (!Array.isArray(r.ball) || r.ball.length !== 3 || !r.ball.every(Number.isFinite)) return null;
  if (!Number.isInteger(r.strokes) || r.strokes < 0 || typeof r.lie !== 'string') return null;
  if (!r.windRoll || !Number.isFinite(r.windRoll.mph) || !Array.isArray(r.windRoll.holes)) return null;
  if (!Array.isArray(r.scores) || !Array.isArray(r.pinPick)) return null;
  if (r.once !== undefined && (!Array.isArray(r.once) || !r.once.every(k => typeof k === 'string'))) return null;
  if (r.once === undefined) r.once = [];                                       // saved before once-a-round events
  if (!r.holed && r.strokes === 0 && r.holeIdx === 0) return null;            // nothing played yet
  return r;
}

// "Hole 4 · 2 strokes · +1 thru 3" for the Resume button.
export function describeRound(r, pars) {
  const next = r.holed ? r.holeIdx + 1 : r.holeIdx;
  let played = 0, total = 0, par = 0;
  r.scores.forEach((s, i) => { if (s != null && pars[i] != null && (i < next)) { played++; total += s; par += pars[i]; } });
  const d = total - par, rel = d === 0 ? 'level' : d > 0 ? `+${d}` : `${d}`;
  const here = r.holed || r.strokes === 0 ? 'on the tee' : `${r.strokes} stroke${r.strokes === 1 ? '' : 's'}`;
  return `Hole ${next + 1} · ${here}` + (played ? ` · ${rel} thru ${played}` : '');
}
