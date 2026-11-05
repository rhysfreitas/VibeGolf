// Coaching range screens (see docs/COACHING.md): the readout with its mannequin and cause
// cards, the reminder chip, the progress check, drills, the full-screen explorer and notices.
// The rules live in src/coach/coach-logic.js; this file only shows what they decide.
//
//   const coach = createCoachUI({ clubName });
//   coach.shot(shot, clubId)   // after each shot lands (live or simulated)
//   coach.summary()            // what this session worked on, for the practice menu
//   coach.setActive(v)         // show or hide the coach (practice mode)

import { createCoach, PROGRESS, FOCUS_SHOTS, READ_WINDOW } from '../coach/coach-logic.js';
import { LESSONS, READOUTS, DRILL_DEMOS } from '../coach/lessons.js';
import { CONDITIONS } from '../coach/conditions.js';
import { createMannequin } from '../coach/mannequin.js';

const HIST_KEY = 'vibegolf.coach.v1';
const loadHist = () => { try { return JSON.parse(localStorage.getItem(HIST_KEY) || 'null'); } catch (e) { return null; } };
const saveHist = h => { try { localStorage.setItem(HIST_KEY, JSON.stringify(h)); } catch (e) { /* storage blocked */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtUnit = (v, unit) => unit === 'rpm' ? Math.round(v).toLocaleString() : unit === '' ? v.toFixed(2) : unit === 'mph' ? v.toFixed(1) : `${v > 0 && unit === '°' ? '' : ''}${v.toFixed(1)}`;
const unitLabel = u => (u === '°' ? '°' : u ? ` ${u}` : '');

export function createCoachUI({ clubName = id => id } = {}) {
  const coach = createCoach({ history: loadHist() });
  let active = false, mq = null, view = null, pendingRead = null, lastRead = null, lastProgress = null, currentLesson = null;
  const seen = [];                        // conditions raised this session, for the summary

  /* ---------------- DOM ---------------- */
  const root = document.createElement('div'); root.id = 'coach'; root.hidden = true;
  root.innerHTML = `
    <button class="co-chip glass" type="button" hidden></button>
    <aside class="co-sheet glass" hidden role="dialog" aria-label="Coach"></aside>
    <section class="co-full" hidden aria-label="Swing explorer">
      <div class="co-fslot"></div>
      <button class="co-back" type="button">‹ Coach</button>
      <div class="co-fcard glass"><h3></h3><div class="co-fnums"></div><p class="co-fcap"></p></div>
      <div class="co-seg co-fcams glass" role="group" aria-label="Camera"><button data-cam="front">Front</button><button data-cam="dtl">Down the line</button><button data-cam="close">Club</button></div>
      <div class="co-fbottom">
        <button class="co-fplay" type="button">Pause</button>
        <div class="co-scrub glass"><input type="range" min="0" max="1000" value="0" aria-label="Swing position"><div class="co-ticks" aria-hidden="true"><span style="left:0">Address</span><span style="left:47%">Top</span><span style="left:70%">Impact</span><span style="left:100%">Finish</span></div></div>
        <div class="co-seg glass" role="group" aria-label="Show"><button data-who="you">You</button><button data-who="goal">Goal</button><button data-who="both" aria-pressed="true">Both</button></div>
      </div>
    </section>
    <div class="co-toast" hidden></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const chip = $('.co-chip'), sheet = $('.co-sheet'), full = $('.co-full'), toastEl = $('.co-toast');

  function ensureMq() {
    if (!mq) { mq = createMannequin(); mq.onStep(onStep); }
    return mq;
  }
  function onStep(s) {
    if (view === 'full') { const r = full.querySelector('input'); if (document.activeElement !== r) r.value = Math.round(s.t * 1000); }
    if (view === 'drill' && s.step >= 0) sheet.querySelectorAll('.co-steps li').forEach((li, i) => li.classList.toggle('now', i === s.step));
  }
  const setOpen = v => { document.body.classList.toggle('co-open', v); };
  function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; view = null; setOpen(false); if (mq) mq.stop(); renderChip(); }

  /* ---------------- the chip: watching, a tip waiting, or the cue you're on ---------------- */
  function renderChip() {
    if (!active) { chip.hidden = true; return; }
    chip.hidden = !!view;
    const F = coach.focus, phase = coach.phase;
    if (pendingRead) {
      chip.className = 'co-chip glass tip'; chip.dataset.act = 'read';
      chip.innerHTML = `<span class="co-ico" aria-hidden="true">!</span><span class="t"><b>Coach has a tip</b><small>${esc(pendingRead.condition.name)}</small></span>`;
    } else if (F && (phase === 'focus' || phase === 'review')) {
      const n = F.ms.length;
      chip.className = 'co-chip glass focus'; chip.dataset.act = phase === 'review' && lastProgress ? 'progress' : 'focus';
      chip.innerHTML = `${cueIcon()}<span class="t"><b>${esc(F.drill ? F.drill.name : F.cause.cue || coachCue(F))}</b><span class="co-dots">${Array.from({ length: FOCUS_SHOTS }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span><small>${n} of ${FOCUS_SHOTS}</small></span>`;
    } else {
      const k = Math.min(READ_WINDOW, countSinceRead());
      chip.className = 'co-chip glass watch'; chip.dataset.act = '';
      chip.innerHTML = `<span class="t"><b>Coach watching</b><span class="co-dots">${Array.from({ length: READ_WINDOW }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span><small>${k < READ_WINDOW ? `${READ_WINDOW - k} more to read` : 'Looking good'}</small></span>`;
    }
  }
  let sinceRead = 0;
  const countSinceRead = () => sinceRead;
  const coachCue = F => (F && F.cause && F.cause.cue) || (lastRead ? lastRead.condition.cue : '');
  const cueIcon = () => '<svg class="co-ico" width="28" height="28" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14" fill="rgba(245,197,66,0.14)"/><line x1="11" y1="6" x2="17" y2="25" stroke="#f5c542" stroke-width="2.4" stroke-linecap="round"/><circle cx="11" cy="7" r="3" fill="#f5c542"/><circle cx="21" cy="25" r="2" fill="#fff"/></svg>';
  chip.addEventListener('click', () => {
    const act = chip.dataset.act;
    if (act === 'read' && pendingRead) { const r = pendingRead; pendingRead = null; showRead(r); }
    else if (act === 'focus' && coach.focus) showFocus();
    else if (act === 'progress' && lastProgress) showProgress(lastProgress);
  });

  /* ---------------- shared pieces ---------------- */
  function figHTML({ expand = true, tags = [], foot = '' } = {}) {
    return `<div class="co-fig"><div class="co-slot"></div>${tags.map((t, i) => `<span class="co-tag ${t.cls}" style="top:${6 + i * 21}px">${esc(t.label)}<i>${esc(t.value)}</i></span>`).join('')}${expand ? '<button class="co-expand" type="button" aria-label="Open the 3D view">⤢</button>' : ''}<div class="co-foot">${esc(foot)}</div></div>`;
  }
  function barsHTML(ev) {
    return `<div class="co-bars">${ev.map(e => {
      const [lo, hi] = e.window, span = Math.max(hi - lo, 1e-6), min = Math.min(lo, e.value) - span * 0.6, max = Math.max(hi, e.value) + span * 0.6, P = v => ((v - min) / (max - min) * 100).toFixed(1);
      const goal = e.unit === 'rpm' ? `${Math.round(lo / 100) * 100 / 1000}k–${Math.round(hi / 100) * 100 / 1000}k` : `${fmtUnit(lo, e.unit)} to ${fmtUnit(hi, e.unit)}`;
      return `<div class="co-bar"><div class="co-lab"><span>${esc(e.label)}</span><span><b>${fmtUnit(e.value, e.unit)}${unitLabel(e.unit)}</b> <span>goal ${goal}</span></span></div><div class="co-track"><div class="co-band" style="left:${P(lo)}%;width:${(P(hi) - P(lo)).toFixed(1)}%"></div><div class="co-mark" style="left:${P(e.value)}%"></div></div></div>`;
    }).join('')}</div>`;
  }
  function mountFig(lesson, opts = {}) {
    const slot = sheet.querySelector('.co-slot'); if (!slot) return null;
    if (!lesson || lesson.inset) { slot.innerHTML = insetSVG(lesson ? lesson.inset : opts.inset, opts.data); if (mq) mq.stop(); return null; }
    const m = ensureMq(); m.mount(slot); m.setOffset(null); m.setOrbit(false);
    const nums = m.play(lesson, opts.play || {}); m.start();
    const ex = sheet.querySelector('.co-expand'); if (ex) ex.onclick = () => openFull(lesson);
    return nums;
  }
  function setTags(nums, readout, labels = ['YOU', 'GOAL']) {
    const tags = sheet.querySelectorAll('.co-tag'), R = READOUTS[readout];
    if (!nums || !R) { tags.forEach(t => { t.hidden = true; }); return; }
    const vals = [nums.you[readout], nums.goal[readout]];
    tags.forEach((t, i) => { t.hidden = false; t.firstChild.textContent = `${labels[i]} ${R.label.toUpperCase()} `; t.querySelector('i').textContent = R.fmt(vals[i]); });
  }

  /* ---------------- 1 · the readout ---------------- */
  function showRead(ev) {
    lastRead = ev; view = 'read'; setOpen(true);
    const C = ev.condition;
    sheet.hidden = false;
    sheet.innerHTML = `
      <div class="co-head"><span class="co-kick">Coach · your last ${READ_WINDOW} shots · ${esc(clubName(ev.club))}</span>${ev.confidence === 'high' ? '' : '<span class="co-conf" title="Only part of the data agrees, so this is a softer read">Likely</span>'}<button class="co-x" type="button" aria-label="Close">×</button></div>
      <div class="co-titles"><h2>${esc(C.headline)}</h2><p class="co-sub">${esc(C.sub)}</p></div>
      <div class="co-row">${figHTML({ tags: [{ cls: 'you', label: 'YOU', value: '' }, { cls: 'goal', label: 'GOAL', value: '' }] })}${barsHTML(ev.evidence)}</div>
      <div class="co-causesWrap"><span class="co-which">Which one is you?</span><div class="co-causes" role="tablist">${ev.causes.map((k, i) => `<button type="button" role="tab" data-i="${i}" aria-selected="false">${esc(k.title)}${k.likely ? '<em>Most likely</em>' : ''}</button>`).join('')}</div></div>
      <div class="co-check"></div>
      <div class="co-cue">${cueIcon()}<div class="t"><small>Next ${FOCUS_SHOTS} shots</small><span class="co-cueText">${esc(C.cue)}</span></div><button class="co-go" type="button">Got it</button></div>`;
    let sel = 0;
    const pickCause = i => {
      sel = i; const k = ev.causes[i], L = LESSONS[k.lesson];
      sheet.querySelectorAll('.co-causes button').forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
      currentLesson = L;
      const nums = mountFig(L, { inset: k.lesson ? null : (C.id === 'twoWay' ? 'dispersion' : 'strike'), data: ev.baseMs });
      setTags(nums, L && L.readout);
      sheet.querySelector('.co-foot').textContent = '';
      cap = L ? L.caption : (C.id === 'twoWay' ? 'Start lines of your last 4 shots.' : '');
      const ex = sheet.querySelector('.co-expand'); if (ex) ex.hidden = !L || !!L.inset;
      renderCheck(k, i);
    };
    // under the causes: what this cause looks like (the lesson's caption), then how to tell
    let cap = '';
    const renderCheck = (k, i) => {
      const box = sheet.querySelector('.co-check'), ch = k.check || {};
      box.innerHTML = cap ? `<span class="co-cap">${esc(cap)}</span>` : '';
      const line = document.createElement('div'); line.className = 'co-tell'; box.appendChild(line);
      if (ch.type === 'ask') {
        line.innerHTML = `<span>${esc(ch.q)}</span><button type="button" data-a="yes">Yes</button><button type="button" data-a="no">No</button>`;
        line.querySelector('[data-a=yes]').onclick = () => { line.innerHTML = '<span class="ok">Then this is the one to work on.</span>'; };
        line.querySelector('[data-a=no]').onclick = () => { if (i + 1 < ev.causes.length) pickCause(i + 1); else line.innerHTML = '<span>Try the first one anyway: the numbers point there.</span>'; };
      } else if (ch.type === 'test') line.innerHTML = `<span><b>Check:</b> ${esc(ch.text)}</span>`;
      else line.innerHTML = k.hinted ? '<span class="ok">✓ Your numbers point here.</span>' : '<span class="quiet">A common cause of this pattern.</span>';
    };
    sheet.querySelectorAll('.co-causes button').forEach(b => { b.onclick = () => pickCause(+b.dataset.i); });
    sheet.querySelector('.co-x').onclick = () => { coach.dismiss(); closeSheet(); };
    sheet.querySelector('.co-go').onclick = () => {
      const F = coach.accept(ev.causes[sel].id); F.cause = { ...F.cause, cue: C.cue }; F.drill = null;
      saveHist(coach.serialize()); sinceRead = 0; closeSheet();
      toast(`Next ${FOCUS_SHOTS} shots: ${C.cue}`);
    };
    pickCause(0);
  }
  // the readout again while you're on the cue
  function showFocus() {
    const F = coach.focus; if (!F) return;
    const C = lastRead ? lastRead.condition : null; if (!C) return;
    view = 'read'; setOpen(true); sheet.hidden = false;
    const L = LESSONS[F.cause.lesson];
    sheet.innerHTML = `
      <div class="co-head"><span class="co-kick">Coach · working on it · ${F.ms.length} of ${FOCUS_SHOTS}</span><button class="co-x" type="button" aria-label="Close">×</button></div>
      <div class="co-titles"><h2>${esc(C.headline)}</h2><p class="co-sub">${esc(F.cause.title)}</p></div>
      <div class="co-row">${figHTML({ tags: [{ cls: 'you', label: 'YOU', value: '' }, { cls: 'goal', label: 'GOAL', value: '' }], foot: L ? L.caption : '' })}${barsHTML(lastRead.evidence)}</div>
      <div class="co-cue">${cueIcon()}<div class="t"><small>The cue</small><span>${esc(F.drill ? F.drill.name : C.cue)}</span></div><button class="co-go" type="button">Keep going</button></div>`;
    setTags(mountFig(L, { inset: C.id === 'twoWay' ? 'dispersion' : 'strike', data: F.baseMs }), L && L.readout);
    sheet.querySelector('.co-x').onclick = closeSheet; sheet.querySelector('.co-go').onclick = closeSheet;
  }

  /* ---------------- 3 · progress ---------------- */
  function showProgress(ev) {
    lastProgress = ev; view = 'progress'; setOpen(true); sheet.hidden = false;
    const C = ev.condition, P = PROGRESS[C.id], pct = Math.round(ev.progress * 100);
    const L = LESSONS[ev.cause.lesson];
    const title = ev.done ? (ev.progress >= 0.85 ? "That's fixed for now" : 'Three good ones in a row') : ev.stalled ? 'Not moving yet' : 'Getting there';
    const sub = ev.done ? 'Keep the feel. The coach goes back to watching.' : ev.stalled ? (ev.nextCause ? `The cue isn't changing the numbers. Try the next cause: ${ev.nextCause.title.toLowerCase()}.` : 'Try a drill to build the feel.') : `${pct}% of the way from where you started to the goal.`;
    const series = [...ev.baseMs.map(m => ({ v: P.value([m]), base: true })), ...(coach.focus ? coach.focus.ms : ev.recentMs).map(m => ({ v: P.value([m]) }))];
    sheet.innerHTML = `
      <div class="co-head"><span class="co-kick">Coach · ${ev.shots} shots on the cue</span><button class="co-x" type="button" aria-label="Close">×</button></div>
      <div class="co-titles"><h2>${esc(title)}</h2><p class="co-sub">${esc(sub)}</p></div>
      <div class="co-row">${figHTML({ tags: [{ cls: 'you dim', label: `FIRST ${READ_WINDOW}`, value: '' }, { cls: 'now', label: `LAST ${READ_WINDOW}`, value: '' }], foot: 'Then vs now' })}
        <div class="co-trend"><span class="co-which">${esc(C.name)}, shot by shot</span>${trendSVG(series, ev.target, ev.before)}
          <div class="co-meter" role="img" aria-label="${pct}% of the way"><i style="width:${pct}%"></i></div><span class="co-pct">${pct}% of the way</span></div></div>
      <div class="co-actions">
        ${ev.done ? '<button class="co-go" type="button" data-a="done">Done</button>' : `<button class="co-go" type="button" data-a="again">${FOCUS_SHOTS} more</button>`}
        ${ev.nextCause ? `<button class="co-alt" type="button" data-a="next">Next cause</button>` : ''}
        ${ev.offerDrill || !ev.done ? `<button class="co-alt" type="button" data-a="drill">Try a drill</button>` : ''}
        ${ev.done ? '' : '<button class="co-alt" type="button" data-a="done">Stop here</button>'}
      </div>`;
    // the mannequin: your old swing as a ghost against one blended toward the goal by your progress
    const nums = mountFig(L ? { ...L, show: { now: 1, beforeGhost: 1 }, mix: Math.max(0.08, ev.progress) } : null, { inset: 'strike' });
    if (nums && L && L.readout) {
      const R = READOUTS[L.readout], tags = sheet.querySelectorAll('.co-tag');
      tags[0].querySelector('i').textContent = R.fmt(nums.before[L.readout]); tags[1].querySelector('i').textContent = R.fmt(nums.you[L.readout]);
    } else sheet.querySelectorAll('.co-tag').forEach(t => { t.hidden = true; });
    sheet.querySelector('.co-x').onclick = closeSheet;
    sheet.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'again') { coach.again(); coach.focus.drill = null; closeSheet(); }
      else if (a === 'next') { coach.nextCause(); const F = coach.focus; F.drill = null; F.cause = { ...F.cause, cue: C.cue }; closeSheet(); toast(`Now: ${F.cause.title}`); }
      else if (a === 'drill') showDrill(ev);
      else { coach.finish(); lastProgress = null; saveHist(coach.serialize()); closeSheet(); }
    }; });
  }
  function trendSVG(series, target, before) {
    const W = 200, H = 96, vals = series.map(s => s.v).concat([target, before]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.15 || 1; lo -= pad; hi += pad;
    const X = i => 10 + i * (W - 20) / Math.max(1, series.length - 1), Y = v => 6 + (hi - v) / (hi - lo) * (H - 18);
    const pts = series.map((s, i) => `${X(i).toFixed(1)},${Y(s.v).toFixed(1)}`).join(' ');
    const cut = series.findIndex(s => !s.base), cx = cut > 0 ? (X(cut - 1) + X(cut)) / 2 : 10;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Shot by shot against the goal">
      <line x1="0" x2="${W}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}" stroke="rgba(110,227,138,0.6)" stroke-dasharray="4 3"/>
      <text x="${W - 2}" y="${(Y(target) - 3).toFixed(1)}" text-anchor="end" fill="#6ee38a" font-size="9" font-family="Saira Semi Condensed, sans-serif">GOAL</text>
      <polyline fill="none" stroke="rgba(241,238,227,0.35)" stroke-width="1.5" points="${pts}"/>
      ${series.map((s, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.v).toFixed(1)}" r="${i === series.length - 1 ? 4.2 : 3.2}" fill="${s.base ? '#ffb04a' : '#f1eee3'}"/>`).join('')}
      ${cut > 0 ? `<line x1="${cx}" x2="${cx}" y1="2" y2="${H - 2}" stroke="rgba(245,197,66,0.6)" stroke-dasharray="3 3"/><text x="${cx + 3}" y="10" fill="#f5c542" font-size="9" font-family="Saira Semi Condensed, sans-serif">CUE</text>` : ''}
    </svg>`;
  }

  /* ---------------- 4 · a drill ---------------- */
  function showDrill(ev) {
    view = 'drill'; setOpen(true); sheet.hidden = false;
    const cause = ev.cause, dr = cause.drill, demo = DRILL_DEMOS[dr.name], L = LESSONS[cause.lesson];
    sheet.innerHTML = `
      <div class="co-head"><span class="co-kick">Drill · ${esc(cause.title)}</span><button class="co-x" type="button" aria-label="Close">×</button></div>
      <div class="co-titles"><h2>${esc(dr.name)}</h2></div>
      <div class="co-row">${figHTML({ expand: false, foot: demo ? 'Slow motion' : '' })}<ol class="co-steps">${dr.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
      <div class="co-cue"><div class="t"><small>Then</small><span>Hit ${FOCUS_SHOTS} with that feel</span></div><button class="co-go" type="button">Start</button></div>`;
    if (demo) mountFig({ you: {}, goal: {}, cam: 'panel', show: { goalSolid: 1 }, mode: { type: 'drill', drill: demo } });
    else mountFig(L);
    sheet.querySelector('.co-x').onclick = closeSheet;
    sheet.querySelector('.co-go').onclick = () => { const F = coach.again(); if (F) F.drill = dr; closeSheet(); toast(`Drill: ${dr.name}`); };
  }

  /* ---------------- notices: shank, fatigue ---------------- */
  function showNotice(C) {
    view = 'notice'; setOpen(true); sheet.hidden = false; sheet.classList.add('small');
    sheet.innerHTML = `<div class="co-head"><span class="co-kick">Coach</span><button class="co-x" type="button" aria-label="Close">×</button></div>
      <div class="co-titles"><h2>${esc(C.headline)}</h2><p class="co-sub">${esc(C.sub)}</p></div>
      <div class="co-cue">${cueIcon()}<div class="t"><small>Try</small><span>${esc(C.cue)}</span></div><button class="co-go" type="button">OK</button></div>`;
    const done = () => { sheet.classList.remove('small'); closeSheet(); };
    sheet.querySelector('.co-x').onclick = done; sheet.querySelector('.co-go').onclick = done;
  }

  /* ---------------- the full-screen explorer ---------------- */
  function openFull(lesson) {
    const m = ensureMq(); view = 'full'; full.hidden = false; setOpen(true);
    m.mount($('.co-fslot')); m.setOrbit(true);
    const nums = m.play(lesson, { mode: 'full', cam: lesson.cam === 'panel' ? 'front' : lesson.cam === 'dtlPanel' ? 'dtl' : lesson.cam === 'through' ? 'front' : lesson.cam });
    m.setWho('both'); full.querySelectorAll('[data-who]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === 'both')));
    full.querySelectorAll('[data-cam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cam === m.cam)));
    $('.co-fcard h3').textContent = lesson.title; $('.co-fcap').textContent = lesson.caption;
    const R = READOUTS[lesson.readout];
    $('.co-fnums').innerHTML = R ? `<div><small>${R.label} · you</small><b class="you">${R.fmt(nums.you[lesson.readout])}</b></div><div><small>${R.label} · goal</small><b class="goal">${R.fmt(nums.goal[lesson.readout])}</b></div>` : '';
    m.setOffset((w, h) => { const fr = full.getBoundingClientRect(), cr = $('.co-fcard').getBoundingClientRect(), br = $('.co-fbottom').getBoundingClientRect(); const left = cr.right - fr.left < w * 0.6 ? cr.right - fr.left : 0, bottom = br.top - fr.top; return { x: w / 2 - (left + w) / 2, y: h / 2 - bottom / 2 }; });
    $('.co-fplay').textContent = 'Pause'; m.start();
  }
  function closeFull() {
    full.hidden = true; if (!mq) return; mq.setOrbit(false); mq.setOffset(null);
    if (sheet.hidden) { view = null; setOpen(false); mq.stop(); renderChip(); return; }
    view = sheet.querySelector('.co-steps') ? 'drill' : 'read';
    const slot = sheet.querySelector('.co-slot'); if (slot && currentLesson) { mq.mount(slot); mq.play(currentLesson); mq.start(); }
  }
  $('.co-back').onclick = closeFull;
  full.querySelectorAll('[data-cam]').forEach(b => { b.onclick = () => { mq.goTo(b.dataset.cam); full.querySelectorAll('[data-cam]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }; });
  full.querySelectorAll('[data-who]').forEach(b => { b.onclick = () => { mq.setWho(b.dataset.who); full.querySelectorAll('[data-who]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }; });
  $('.co-fplay').onclick = () => { const v = !mq.playing; mq.setPlaying(v); $('.co-fplay').textContent = v ? 'Pause' : 'Play'; };
  full.querySelector('input').addEventListener('input', e => { mq.setPlaying(false); $('.co-fplay').textContent = 'Play'; mq.setT(+e.target.value / 1000); });

  /* ---------------- insets: grip, start lines, strike ---------------- */
  function insetSVG(kind, data) {
    if (kind === 'weak' || kind === 'strong') {
      // the lead hand on the grip from the player's eyes: how many knuckles show
      const hand = (x, knuckles, top, sub, good) => `<g transform="translate(${x},0)">
        <rect x="26" y="2" width="14" height="78" rx="7" fill="#16191e"/>
        <path d="M6 24 q27 -14 54 0 v34 q-27 12 -54 0 z" fill="#f3f1ea" stroke="#b8b4aa" stroke-width="1.2"/>
        ${Array.from({ length: knuckles }, (_, i) => `<circle cx="${33 - (knuckles - 1) * 6.5 + i * 13}" cy="28" r="5.5" fill="#dcd8cd" stroke="#8f8b81" stroke-width="1.2"/>`).join('')}
        <text x="33" y="95" text-anchor="middle" fill="${good ? '#6ee38a' : '#ffb04a'}" font-size="13" font-weight="700" font-family="Saira Semi Condensed, sans-serif">${top}</text>
        <text x="33" y="109" text-anchor="middle" fill="#c9cfc3" font-size="11.5" font-family="Saira Semi Condensed, sans-serif">${sub}</text></g>`;
      return `<svg viewBox="0 0 144 112" width="100%" height="100%" role="img" aria-label="${kind === 'weak' ? 'Weak grip: about one knuckle showing, against neutral: two to three' : 'Strong grip: four knuckles showing, against neutral: two to three'}">${hand(2, kind === 'weak' ? 1 : 4, 'YOU', kind === 'weak' ? '1 knuckle' : '4 knuckles', false)}${hand(76, 3, 'GOAL', '2 to 3', true)}</svg>`;
    }
    if (kind === 'dispersion' && data && data.length) {
      return `<svg viewBox="0 0 160 170" width="100%" height="100%" role="img" aria-label="Start lines of your last shots"><line x1="80" y1="160" x2="80" y2="10" stroke="rgba(241,238,227,0.25)" stroke-dasharray="3 4"/>${data.map(m => { const a = Math.max(-25, Math.min(25, m.dir * 3)) * Math.PI / 180, c = Math.max(-30, Math.min(30, m.axis * 1.2)); return `<path d="M80 160 Q ${80 + Math.sin(a) * 75} ${160 - Math.cos(a) * 75} ${80 + Math.sin(a) * 140 + c} ${160 - Math.cos(a) * 140}" fill="none" stroke="#ffb04a" stroke-width="2"/>`; }).join('')}<circle cx="80" cy="160" r="4" fill="#fff"/></svg>`;
    }
    return `<svg viewBox="0 0 160 170" width="100%" height="100%" role="img" aria-label="Clubface strike: the centre is the goal"><path d="M24 70 q4 -26 30 -30 h70 q14 2 14 20 v42 q0 16 -16 18 h-78 q-22 -2 -20 -50z" fill="#d7dce2" stroke="#8d969f"/>${[0, 1, 2, 3, 4, 5].map(i => `<line x1="34" x2="128" y1="${60 + i * 9}" y2="${60 + i * 9}" stroke="#9aa2ab" stroke-width="0.8"/>`).join('')}<circle cx="82" cy="80" r="11" fill="none" stroke="#6ee38a" stroke-width="2" stroke-dasharray="3 3"/><text x="80" y="150" text-anchor="middle" fill="#c9cfc3" font-size="11" font-family="Saira Semi Condensed, sans-serif">STRIKE THE CENTRE</text></svg>`;
  }

  /* ---------------- toasts ---------------- */
  let toastT = 0;
  function toast(msg, good = false) { toastEl.textContent = msg; toastEl.classList.toggle('good', good); toastEl.hidden = false; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => { toastEl.classList.remove('on'); setTimeout(() => { toastEl.hidden = true; }, 300); }, 2200); }

  /* ---------------- shots in ---------------- */
  function shot(s, club) {
    if (!active) return;
    // a new shot while a readout is open: fold it into the chip
    if (view === 'read' && coach.phase === 'read' && lastRead) { pendingRead = lastRead; closeSheet(); }
    sinceRead++;
    const evs = coach.addShot(s, club);
    let shown = false;
    for (const e of evs) {
      if (e.type === 'shank' && !shown) { showNotice(e.condition); shown = true; }
      else if (e.type === 'fatigue' && !shown) { showNotice(e.condition); shown = true; }
      else if (e.type === 'read') { seen.push(e.id); if (!shown && !view) { showRead(e); shown = true; } else pendingRead = e; }
      else if (e.type === 'progress') { saveHist(coach.serialize()); if (!shown) { showProgress(e); shown = true; } else lastProgress = e; }
      else if (e.type === 'good' && !shown) toast(e.streak > 1 ? `That's the one · ${e.streak} in a row` : "That's the one", true);
    }
    renderChip();
  }

  return {
    shot,
    setActive(v) { active = !!v; root.hidden = !active; if (!active) { closeSheet(); full.hidden = true; } renderChip(); },
    get active() { return active; },
    summary() {
      if (!coach.shots.length) return null;
      const F = coach.focus, h = coach.serialize();
      const worked = [...new Set(seen)].map(id => { const club = Object.keys(h.clubs).find(c => h.clubs[c][id]); const r = club && h.clubs[club][id]; return { id, name: CONDITIONS[id].name, progress: r && r.progress != null ? r.progress : null }; });
      return { shots: coach.shots.length, worked, cue: F ? (F.drill ? F.drill.name : lastRead && lastRead.condition.cue) : null };
    },
    get coach() { return coach; },
  };
}
