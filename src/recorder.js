// The session recorder: every live shot, kept on this device, for My game, the coach's tuning
// and export. Pure core (createRecorder takes its storage); `recorder` is the page's instance
// on localStorage. No DOM, no Three.js.
//
// A shot keeps what the R10 sent (ball, club, Meta), what the coach's trust checks made of it,
// where it was hit (mode, club, Practice Ground or not), and what came of it: the flight on the
// range (carry, total, offline), the result on a course (hole, lie, the miss against where you
// aimed), the coach's events, and an optional feel tag. Sessions break on a new page or mode,
// or after 30 minutes without a shot.
//
//   recorder.attach(launchMonitor, { mode: () => 'range', club: () => '7i' })   // records every live shot
//   recorder.result(shot, { carry, total, offline })                      // when the shot comes to rest
//   recorder.note(shot, { coach: [...] }) · recorder.tag(id, 'fat') · recorder.sessions · recorder.exportJSON()
//
// Live shots only. `?recsim=1` also records simulated ones (marked live: false), for testing.

import { shotMetrics } from './coach/coach-logic.js';

export const STORE_KEY = 'vibegolf.sessions.v1';
export const FEELS = ['pure', 'fat', 'thin', 'toe', 'heel'];
export const FEEL_NAMES = { pure: 'Pure', fat: 'Fat', thin: 'Thin', toe: 'Toe', heel: 'Heel' };
export const PRACTICE_MODES = ['range', 'coach'];      // the shots that feed your numbers
export const MODE_NAMES = { range: 'Range', coach: 'Coaching', course: 'Course', game: 'Mini game' };
export const GAP_MS = 30 * 60 * 1000;
export const MAX_SHOTS = 2500;                         // oldest sessions go first past this

const r1 = v => (v === undefined || v === null || !isFinite(+v) ? null : Math.round(+v * 10) / 10);
const pick = (o, keys) => { if (!o) return null; const out = {}; for (const k of keys) if (o[k] !== undefined && o[k] !== null) out[k] = typeof o[k] === 'number' ? r1(o[k]) : o[k]; return out; };

export function createRecorder({ storage = null, now = () => Date.now(), recordSim = false } = {}) {
  let data = { v: 1, sessions: [] };
  try { const s = storage && JSON.parse(storage.getItem(STORE_KEY) || 'null'); if (s && s.v === 1 && Array.isArray(s.sessions)) data = s; } catch (e) { /* corrupt or blocked: start fresh */ }
  const ids = new WeakMap();                           // shot object -> record id
  let ctx = { mode: 'range', page: null, club: () => null }, session = null, seq = 0;
  const listeners = new Set();

  function save() {
    let n = data.sessions.reduce((s, x) => s + x.shots.length, 0);
    while (n > MAX_SHOTS && data.sessions.length > 1) n -= data.sessions.shift().shots.length;
    try { if (storage) storage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* full or blocked: keep it in memory */ }
    for (const f of listeners) f();
  }
  const modeNow = () => (typeof ctx.mode === 'function' ? ctx.mode() : ctx.mode) || 'range';
  function sessionFor(t, mode) {
    const last = data.sessions[data.sessions.length - 1];
    const lastT = last && last.shots.length ? last.shots[last.shots.length - 1].t : last && last.start;
    if (session && last === session && session.mode === mode && t - lastT < GAP_MS) return session;
    session = { id: `s${t.toString(36)}`, start: t, mode, page: ctx.page, shots: [] };
    data.sessions.push(session);
    return session;
  }
  const find = id => { for (let i = data.sessions.length - 1; i >= 0; i--) { const s = data.sessions[i].shots.find(x => x.id === id); if (s) return s; } return null; };
  const recOf = shot => (typeof shot === 'string' ? find(shot) : ids.has(shot) ? find(ids.get(shot)) : null);

  // record one shot as it arrives
  function capture(shot, { live = true, club = null } = {}) {
    if (!shot || (!live && !recordSim)) return null;
    const t = now(), mode = modeNow(), S = sessionFor(t, mode), clubId = club || ctx.club() || null;
    let trust = null;
    try { const m = shotMetrics(shot, clubId || '7i'); trust = { club: m.clubTrust, spin: m.spinTrust, spinWhy: m.spinWhy }; } catch (e) { /* bad shot data */ }
    const rec = {
      id: `${S.id}.${++seq}`, t, club: clubId, mode, practice: PRACTICE_MODES.includes(mode), live: !!live,
      ball: pick(shot, ['Speed', 'VLA', 'HLA', 'TotalSpin', 'SpinAxis']),
      clubData: shot.Club ? pick(shot.Club, ['Speed', 'Path', 'FaceToTarget', 'AngleOfAttack', 'Loft']) : null,
      meta: shot.Meta ? { source: shot.Meta.source || null, shotNumber: shot.Meta.shotNumber ?? null, spinSource: shot.Meta.spinSource || null,
        marking: shot.Meta.marking || null, timing: shot.Meta.timing || null } : null,
      trust, result: null, course: null, coach: null, feel: null,
    };
    S.shots.push(rec); ids.set(shot, rec.id); save();
    return rec.id;
  }

  return {
    // what the page is: a mode and the club in hand (a function, read when each shot arrives)
    // mode may be a function, read when each shot arrives
    setContext(c) { ctx = { ...ctx, ...c }; },
    // record every live shot from a launch monitor (subscribe before the page's own listener)
    attach(lm, c) { if (c) this.setContext(c); lm.addEventListener('shot', e => capture(e.detail, { live: true })); return this; },
    capture,
    result(shot, r) { const rec = recOf(shot); if (!rec) return; rec.result = { ...rec.result, ...r }; save(); },
    course(shot, c) { const rec = recOf(shot); if (!rec) return; rec.course = { ...rec.course, ...c }; save(); },
    note(shot, n) { const rec = recOf(shot); if (!rec) return; if (n.coach) rec.coach = (rec.coach || []).concat(n.coach); save(); },
    // a feel tag on a shot (null clears it)
    tag(shotOrId, feel) { const rec = recOf(shotOrId); if (!rec) return; rec.feel = FEELS.includes(feel) ? feel : null; save(); },
    idOf: shot => ids.get(shot) || null,
    get: id => find(id),
    get sessions() { return data.sessions; },
    get shots() { return data.sessions.flatMap(s => s.shots); },
    onChange(f) { listeners.add(f); return () => listeners.delete(f); },
    exportJSON(sessionIds = null) {
      const sessions = sessionIds ? data.sessions.filter(s => sessionIds.includes(s.id)) : data.sessions;
      return JSON.stringify({ app: 'VibeGolf', kind: 'sessions', v: 1, exported: new Date(now()).toISOString(), sessions }, null, 1);
    },
    clear() { data = { v: 1, sessions: [] }; session = null; save(); },
  };
}

let ls = null; try { ls = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { ls = null; }
const simFlag = typeof location !== 'undefined' && /[?&]recsim=1\b/.test(location.search);
export const recorder = createRecorder({ storage: ls, recordSim: simFlag });
