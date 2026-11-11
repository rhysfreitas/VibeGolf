// Coaching range: the rules. Pure (no DOM, no Three.js). See docs/COACHING.md for the spec.
//
// Shots come in as launch-monitor data (GSPro BallData naming, with optional ClubData under
// `Club`). The coach turns each into impact metrics, scores them against the club's windows,
// and over a window of 4 shots with one club decides whether a condition holds. When several
// hold it picks one: conditions explained by another drop out, then the earliest priority
// group wins (setup, path, face, control, low point, strike, session). A shank is raised at once.
//
//   const coach = createCoach({ history });
//   coach.addShot(shot, '7i')  -> events: read | good | tick | progress | shank | fatigue
//   coach.accept(causeId)      -> focus on that cause's cue for the next 8 shots
//   coach.dismiss() · coach.again() · coach.nextCause() · coach.serialize()

import { CLUB_REF, LAUNCH_PER_LOFT, windowsFor as physicsWindows } from './windows.js';
import { CONDITIONS } from './conditions.js';
import { clubTrust, spinTrust, spinForRules } from './trust.js';

export const READ_WINDOW = 4;     // shots before the coach speaks
export const FOCUS_SHOTS = 8;     // shots on a cue before the progress check
export const QUIET_SHOTS = 10;    // a condition isn't raised again for this many shots
export const STALL = 0.25;        // progress below this after a focus block = try the next cause

const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; };
const clamp01 = v => Math.max(0, Math.min(1, v));
const num = v => (v === undefined || v === null || v === '' ? NaN : +v);

/* ---------------- one shot -> impact metrics ---------------- */
// Signs follow GSPro / TrackMan for a right-hander: path + in-to-out, face + open,
// attack + up, spin axis + tilted right, start direction + right.
// Club data that fails the trust check (trust.js) is treated as missing; the spin rules see
// the spin the trust check allows (spinRaw keeps what the R10 sent).
export function shotMetrics(shot, clubId) {
  const ref = CLUB_REF[clubId] || CLUB_REF['7i'], ct = clubTrust(shot), c = ct.ok ? shot.Club : {};
  const axis = +shot.SpinAxis || 0, dir = +shot.HLA || 0;
  const hasClub = isFinite(num(c.Path)) && isFinite(num(c.FaceToTarget));
  // no club data: a rough D-plane inverse (start mostly face, curve from face to path)
  const ftpB = axis / 1.8, faceB = dir + 0.2 * ftpB;
  const face = hasClub ? num(c.FaceToTarget) : faceB, path = hasClub ? num(c.Path) : faceB - ftpB;
  const clubSpeed = num(c.Speed) > 0 ? num(c.Speed) : shot.Speed / ref.smash;
  const aoa = isFinite(num(c.AngleOfAttack)) ? num(c.AngleOfAttack) : ref.aoa;
  const launch = +shot.VLA || 0;
  const dynLoft = isFinite(num(c.Loft)) ? num(c.Loft) : launch / LAUNCH_PER_LOFT[ref.kind];
  const spinRaw = +shot.TotalSpin || 0, aoaMeasured = isFinite(num(c.AngleOfAttack));
  const st = spinTrust({ spin: spinRaw, axis, launch, clubSpeed, aoa: aoaMeasured ? aoa : null, ftp: hasClub ? face - path : null,
    spinSource: shot.Meta && shot.Meta.spinSource }, clubId);
  return {
    club: clubId, kind: ref.kind, hasClub, clubTrust: ct.why,
    ballSpeed: +shot.Speed || 0, clubSpeed, smash: (+shot.Speed || 0) / clubSpeed,
    launch, dir, spin: spinForRules(spinRaw, st), spinRaw, spinTrust: st.verdict, spinWhy: st.why, axis,
    face, path, ftp: face - path, aoa, dynLoft, spinLoft: dynLoft - aoa,
  };
}

/* ---------------- per-shot predicates ---------------- */
// Each returns 0 (no), or a side: 1 (or ±1 for conditions with a direction). `opp` is the
// opposite miss: one of those in the window stops the condition firing.
const isThin = (m, w) => m.launch > 3 && m.launch <= w.launchC - 4 && m.spin <= w.spinC * 0.8;
const isTop = (m, w) => m.launch <= 3 && m.spin < w.spin[0] * 0.4;
// heavy contact: slow off the face without the extra spin a flip adds
const isFat = (m, w) => m.smash <= 0.92 * w.smashRef && m.spin <= w.spin[1] && !isThin(m, w) && !isTop(m, w);
const iron = m => m.kind === 'iron' || m.kind === 'wedge';
const wood = m => m.kind === 'wood' || m.kind === 'driver';
export const RULES = {
  // setup faults are judged on the window's averages (swing noise hides them shot by shot)
  aimedOff: { test: (m) => (Math.abs(m.dir) >= 3 && Math.abs(m.ftp) <= 2 ? Math.sign(m.dir) : 0), sided: true, onMean: true },
  ballBack: { test: (m, w) => (m.kind !== 'driver' && m.aoa <= w.aoa[0] - 2 && m.path >= 3 && m.dir > 0 ? 1 : 0), onMean: true },
  ballForward: { test: (m, w) => (iron(m) && m.aoa >= w.aoa[1] && m.path <= -2 && m.smash < w.smashMin ? 1 : 0) },
  overTheTop: { test: m => (m.path <= -3 ? 1 : 0), opp: m => m.path >= 3, agree: m => m.dir < -1 || m.axis > 2.5 },
  stuck: { test: m => (m.path >= 4 ? 1 : 0), opp: m => m.path <= -3, agree: m => m.dir > 1 || m.axis < -2.5 },
  openFace: { test: m => (m.ftp >= 3 ? 1 : 0), opp: m => m.ftp <= -3, agree: m => m.axis > 2.5 },
  closedFace: { test: m => (m.ftp <= -3 ? 1 : 0), opp: m => m.ftp >= 3, agree: m => m.axis < -2.5 },
  flip: { test: (m, w) => (m.spinLoft >= w.spinLoft + 4 && m.smash < w.smashMin + 0.03 ? 1 : 0), opp: (m, w) => m.spinLoft <= w.spinLoft - 4 },
  steep: { test: (m, w) => (m.aoa <= w.aoa[0] - 2 && (m.spin >= w.spinC || m.launch <= w.launchC - 1) ? 1 : 0), opp: (m, w) => m.aoa >= w.aoa[1] },
  fat: { test: (m, w) => (isFat(m, w) ? 1 : 0) },
  driverDown: { test: (m, w) => (m.kind === 'driver' && m.aoa < w.aoa[0] && m.spin > w.spin[1] ? 1 : 0) },
  thin: { test: (m, w) => (isThin(m, w) ? 1 : 0) },
  offCentre: { test: (m, w) => (iron(m) && m.smash < w.smashMin - 0.05 && !isFat(m, w) && m.launch >= w.launch[0] - 1 && m.launch <= w.launch[1] + 1 && m.spin >= w.spin[0] * 0.9 && m.spin <= w.spin[1] * 1.1 ? 1 : 0) },
  toeHeel: { test: m => { if (!wood(m) || !m.hasClub) return 0; const d = m.axis - 1.8 * m.ftp; return Math.abs(d) >= 6 ? Math.sign(d) : 0; }, sided: true },
  top: { test: (m, w) => (isTop(m, w) ? 1 : 0) },
  shank: { test: m => (m.dir >= 10 && m.smash < 1.0 ? 1 : 0), single: true },
};
// a firing condition removes the ones it explains (its root cause covers them)
export const EXPLAINS = {
  ballBack: ['steep', 'stuck', 'closedFace', 'aimedOff'], ballForward: ['overTheTop', 'thin', 'fat', 'openFace'],
  aimedOff: ['overTheTop', 'stuck'], overTheTop: ['steep', 'openFace'], stuck: ['closedFace'],
  flip: ['openFace', 'fat', 'thin'], steep: ['fat'], driverDown: ['steep'], fat: ['offCentre'], thin: ['offCentre'],
};
export const GROUP_ORDER = ['urgent', 'setup', 'path', 'face', 'control', 'lowPoint', 'strike', 'session'];

/* ---------------- the window: which conditions hold ---------------- */
const METRIC_KEYS = ['ballSpeed', 'clubSpeed', 'smash', 'launch', 'dir', 'spin', 'axis', 'face', 'path', 'ftp', 'aoa', 'dynLoft', 'spinLoft'];
function meanOf(ms) { const o = { ...ms[ms.length - 1] }; for (const k of METRIC_KEYS) o[k] = mean(ms.map(m => m[k])); return o; }
// ms: the last READ_WINDOW metrics with one club; w: that club's windows
export function evaluate(ms, w) {
  const fired = [];
  if (ms.length < READ_WINDOW) return fired;
  const win = ms.slice(-READ_WINDOW);
  for (const [id, r] of Object.entries(RULES)) {
    if (r.single) continue;
    if (r.onMean) {
      const side = r.test(meanOf(win), w); if (!side) continue;
      const n = win.filter(m => r.test(m, w) === side).length;
      fired.push({ id, side, matches: n, confidence: n >= READ_WINDOW - 1 ? 'high' : 'medium' });
      continue;
    }
    const sides = win.map(m => r.test(m, w));
    let side = 0, n = 0;
    if (r.sided) { const pos = sides.filter(s => s > 0).length, neg = sides.filter(s => s < 0).length; side = pos >= neg ? 1 : -1; n = Math.max(pos, neg); if (Math.min(pos, neg) > 0) continue; }
    else { n = sides.filter(s => s).length; side = 1; }
    if (n < READ_WINDOW - 1) continue;
    if (r.opp && win.some(m => r.opp(m, w))) continue;
    let confidence = n === READ_WINDOW ? 'high' : 'medium';
    if (r.agree) { const hasClub = win.every(m => m.hasClub), ag = win.filter(m => r.agree(m)).length; if (!hasClub || ag < READ_WINDOW - 1) confidence = 'medium'; }
    fired.push({ id, side, matches: n, confidence });
  }
  // two-way miss: path or face spread wider than its bias
  for (const k of ['path', 'face']) {
    const v = win.map(m => m[k]), s = sd(v);
    if (s > 4 && Math.abs(mean(v)) < s && Math.max(...v) >= 3 && Math.min(...v) <= -3) { fired.push({ id: 'twoWay', side: 1, matches: READ_WINDOW, confidence: 'medium', key: k }); break; }
  }
  return fired;
}
// one condition to coach, or null
export function pick(fired) {
  if (!fired.length) return null;
  const ids = new Set(fired.map(f => f.id));
  const live = fired.filter(f => !fired.some(g => g.id !== f.id && (EXPLAINS[g.id] || []).includes(f.id)));
  const pool = live.length ? live : fired;
  const rank = f => GROUP_ORDER.indexOf(CONDITIONS[f.id].group) * 10 - (EXPLAINS[f.id] || []).filter(x => ids.has(x)).length;
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
}

/* ---------------- what the readout shows ---------------- */
// the numbers behind a condition: your average against the window
const EVID = {
  launch: { label: 'Launch', unit: '°', win: w => w.launch }, spin: { label: 'Spin', unit: 'rpm', win: w => w.spin },
  smash: { label: 'Smash', unit: '', win: w => [w.smashMin, w.smashRef + 0.03] }, aoa: { label: 'Attack', unit: '°', win: w => w.aoa },
  path: { label: 'Path', unit: '°', win: () => [-3, 3] }, face: { label: 'Face', unit: '°', win: () => [-2, 2] },
  ftp: { label: 'Face to path', unit: '°', win: () => [-2, 2] }, dir: { label: 'Start line', unit: '°', win: () => [-2, 2] },
  spinLoft: { label: 'Spin loft', unit: '°', win: w => [w.spinLoft - 2, w.spinLoft + 2] }, clubSpeed: { label: 'Club speed', unit: 'mph', win: w => [w.clubSpeed * 0.97, w.clubSpeed * 1.05] },
};
export function evidence(id, ms, w) {
  return (CONDITIONS[id].evidence || []).map(k => ({ key: k, ...EVID[k], value: mean(ms.map(m => m[k])), window: EVID[k].win(w) }));
}
// rank a condition's causes: a data hint that holds puts its cause first
export const HINTS = {
  steepAttack: (ms, w) => mean(ms.map(m => m.aoa)) <= w.aoa[0],
  shallowAttack: (ms, w) => mean(ms.map(m => m.aoa)) >= w.aoa[1] - 1,
  strikeMix: (ms, w) => sd(ms.map(m => m.smash)) > 0.04 || (ms.some(m => isThin(m, w)) && ms.some(m => isFat(m, w))),
  pushHook: ms => ms.some(m => m.dir > 2) && ms.some(m => m.axis < -4),
  pathLeft: ms => mean(ms.map(m => m.path)) <= -2,
  pathRight: ms => mean(ms.map(m => m.path)) >= 2,
  highLaunch: (ms, w) => mean(ms.map(m => m.launch)) >= w.launch[1],
  lowSmash: (ms, w) => mean(ms.map(m => m.smash)) < w.smashMin - 0.02,
  goodContact: (ms, w) => mean(ms.map(m => m.smash)) >= w.smashMin - 0.02,
  startLeft: ms => mean(ms.map(m => m.dir)) <= -1.5,
  faceWider: ms => sd(ms.map(m => m.face)) > sd(ms.map(m => m.path)),
};
export function rankCauses(id, ms, w) {
  const causes = CONDITIONS[id].causes.map((c, i) => ({ ...c, i, hinted: !!(c.hint && HINTS[c.hint] && HINTS[c.hint](ms, w)) }));
  causes.sort((a, b) => (b.hinted - a.hinted) || a.i - b.i);
  return causes.map((c, i) => ({ ...c, likely: i === 0 }));
}

/* ---------------- progress on a condition ---------------- */
// the number that has to move, and where it's heading (0 = where you started, 1 = there)
const avg = k => ms => mean(ms.map(m => m[k]));
export const PROGRESS = {
  aimedOff: { value: ms => Math.abs(avg('dir')(ms)), target: () => 1.5 },
  ballBack: { value: avg('aoa'), target: w => w.aoa[0] }, ballForward: { value: avg('aoa'), target: w => w.aoa[1] },
  overTheTop: { value: avg('path'), target: () => -1 }, stuck: { value: avg('path'), target: () => 2 },
  openFace: { value: avg('ftp'), target: () => 1 }, closedFace: { value: avg('ftp'), target: () => -1 },
  twoWay: { value: ms => Math.max(sd(ms.map(m => m.path)), sd(ms.map(m => m.face))), target: () => 2 },
  flip: { value: avg('spinLoft'), target: w => w.spinLoft + 1 }, steep: { value: avg('aoa'), target: w => w.aoa[0] },
  fat: { value: avg('smash'), target: w => w.smashMin }, driverDown: { value: avg('aoa'), target: () => 0 },
  thin: { value: avg('launch'), target: w => w.launch[0] }, offCentre: { value: avg('smash'), target: w => w.smashMin },
  toeHeel: { value: ms => mean(ms.map(m => Math.abs(m.axis - 1.8 * m.ftp))), target: () => 2 },
  top: { value: avg('launch'), target: w => w.launch[0] },
};
export function progressOf(id, baseMs, nowMs, w) {
  const P = PROGRESS[id]; if (!P) return { progress: 0, before: 0, now: 0, target: 0 };
  const before = P.value(baseMs), now = P.value(nowMs), target = P.target(w);
  const span = target - before;
  return { before, now, target, progress: Math.abs(span) < 1e-6 ? 1 : clamp01((now - before) / span) };
}

/* ---------------- one shot: inside every window? ---------------- */
export function isGoodShot(m, w) {
  return m.launch >= w.launch[0] && m.launch <= w.launch[1] && m.spin >= w.spin[0] && m.spin <= w.spin[1]
    && m.aoa >= w.aoa[0] && m.aoa <= w.aoa[1] && m.smash >= w.smashMin
    && Math.abs(m.ftp) <= 2 && Math.abs(m.path) <= 3 && Math.abs(m.dir) <= 2;
}

/* ---------------- the coaching session ---------------- */
// history (saved by the page) keeps, per club, the last baseline and cue per condition
export function createCoach({ windowsFor = physicsWindows, history = null } = {}) {
  const st = {
    shots: [],                // { club, m, n }
    n: 0,                     // shots seen this session
    phase: 'watch',           // watch | read | focus | review
    read: null,               // the open readout { id, causes, ... }
    focus: null,              // { id, club, cause, causes, baseMs, ms, good, blocks }
    quiet: {},                // condition id -> shot number it may be raised again
    hist: history && history.v === 1 ? history : { v: 1, clubs: {} },
  };
  const clubShots = club => st.shots.filter(s => s.club === club);
  const windowsOf = (club, ms) => windowsFor(club, median(ms.map(m => m.clubSpeed)));

  function addShot(shot, club) {
    const m = shotMetrics(shot, club); st.n++;
    st.shots.push({ club, m, n: st.n });
    const ev = [];
    const ms = clubShots(club).map(s => s.m), w = windowsOf(club, ms);
    if (RULES.shank.test(m, w)) ev.push({ type: 'shank', condition: CONDITIONS.shank, metrics: m });
    const good = isGoodShot(m, w);
    // fatigue: speed fading and strike worsening over a long block with one club
    if (ms.length >= 14 && !(st.quiet.fatigue > st.n)) {
      const first = ms.slice(0, 10), lastN = ms.slice(-4);
      if (median(lastN.map(x => x.clubSpeed)) <= 0.95 * median(first.map(x => x.clubSpeed)) && median(lastN.map(x => x.smash)) < median(first.map(x => x.smash)) - 0.02) {
        st.quiet.fatigue = st.n + QUIET_SHOTS * 2; ev.push({ type: 'fatigue', condition: CONDITIONS.fatigue });
      }
    }
    if (st.phase === 'focus' && st.focus && st.focus.club === club) {
      const F = st.focus; F.ms.push(m); F.good = good ? F.good + 1 : 0;
      if (good) ev.push({ type: 'good', streak: F.good });
      ev.push({ type: 'tick', count: F.ms.length, of: FOCUS_SHOTS, condition: CONDITIONS[F.id], cause: F.cause });
      if (F.good >= 3 || F.ms.length >= FOCUS_SHOTS) ev.push(review(F.good >= 3));
      return ev;
    }
    if (good) ev.push({ type: 'good', streak: 1 });
    if (st.phase !== 'watch' || ms.length < READ_WINDOW) return ev;
    const win = ms.slice(-READ_WINDOW);
    const fired = evaluate(win, w).filter(f => !(st.quiet[f.id] > st.n) || worseThanLast(f.id, club, win, w));
    const top = pick(fired);
    if (top) {
      const C = CONDITIONS[top.id];
      st.read = { id: top.id, club, side: top.side, confidence: top.confidence, baseMs: win, w, causes: rankCauses(top.id, win, w), also: fired.filter(f => f.id !== top.id).map(f => f.id) };
      st.phase = 'read';
      ev.push({ type: 'read', condition: C, ...st.read, evidence: evidence(top.id, win, w) });
    }
    return ev;
  }
  function worseThanLast(id, club, win, w) {
    const h = st.hist.clubs[club] && st.hist.clubs[club][id]; if (!h || !PROGRESS[id]) return false;
    const P = PROGRESS[id], now = P.value(win), target = P.target(w);
    return Math.abs(now - target) > Math.abs(h.before - target) + 1e-9;
  }
  function review(early) {
    const F = st.focus, w = windowsOf(F.club, clubShots(F.club).map(s => s.m));
    const recent = F.ms.slice(-READ_WINDOW), pr = progressOf(F.id, F.baseMs, recent, w);
    F.blocks++;
    const stalled = !early && pr.progress < STALL;
    const nextCause = stalled ? F.causes.find(c => c.id !== F.cause.id && !F.tried.includes(c.id)) || null : null;
    st.phase = 'review';
    save(F.club, F.id, { before: pr.before, cause: F.cause.id, progress: pr.progress, n: st.n });
    return { type: 'progress', condition: CONDITIONS[F.id], cause: F.cause, ...pr, done: early || pr.progress >= 0.85, stalled, nextCause, offerDrill: stalled || F.blocks >= 2, blocks: F.blocks, shots: F.ms.length, baseMs: F.baseMs, recentMs: recent, w };
  }
  function save(club, id, rec) { (st.hist.clubs[club] ||= {})[id] = { ...(st.hist.clubs[club] || {})[id], ...rec }; }

  return {
    addShot,
    // the player chose a cause from the readout: focus on its cue
    accept(causeId) {
      const R = st.read; if (!R) return null;
      const cause = R.causes.find(c => c.id === causeId) || R.causes[0];
      st.focus = { id: R.id, club: R.club, cause, causes: R.causes, baseMs: R.baseMs, ms: [], good: 0, blocks: 0, tried: [cause.id] };
      st.phase = 'focus'; st.read = null; st.quiet[R.id] = st.n + QUIET_SHOTS;
      save(R.club, R.id, { before: PROGRESS[R.id] ? PROGRESS[R.id].value(R.baseMs) : 0, cause: cause.id, n: st.n });
      return st.focus;
    },
    // closed the readout without taking the cue
    dismiss() { if (st.read) st.quiet[st.read.id] = st.n + QUIET_SHOTS; st.read = null; st.phase = 'watch'; },
    // another block of 8 on the same cue (or a different cause of the same condition)
    again(causeId) {
      const F = st.focus; if (!F) return null;
      if (causeId && causeId !== F.cause.id) { F.cause = F.causes.find(c => c.id === causeId) || F.cause; F.tried.push(F.cause.id); }
      F.baseMs = F.ms.length >= READ_WINDOW ? F.ms.slice(-READ_WINDOW) : F.baseMs; F.ms = []; F.good = 0; st.phase = 'focus';
      return F;
    },
    nextCause() { const F = st.focus; if (!F) return null; const c = F.causes.find(x => !F.tried.includes(x.id)); return c ? this.again(c.id) : null; },
    // done with this condition: back to watching
    finish() { if (st.focus) st.quiet[st.focus.id] = st.n + QUIET_SHOTS; st.focus = null; st.phase = 'watch'; },
    get phase() { return st.phase; }, get focus() { return st.focus; }, get read() { return st.read; },
    get shots() { return st.shots; },
    serialize() { return JSON.parse(JSON.stringify(st.hist)); },
  };
}
