// My game: Bag, Practice, On the course and Sessions, all read from the session record.
// ?demo=1 shows example data instead (nothing is saved).
import { recorder, MODE_NAMES, FEEL_NAMES } from '../recorder.js';
import { bagStats, practiceTendencies, courseTendencies, compare, SHAPE_NAMES, MIN_SHOTS } from './stats.js';
import { sampleShots } from './sample.js';
import { CONDITIONS } from '../coach/conditions.js';

const $ = id => document.getElementById(id);
const DEMO = /[?&]demo=1\b/.test(location.search);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const yd = v => (v === null || v === undefined ? '—' : Math.round(v));
const pct = v => `${Math.round(v * 100)}%`;
const side = v => (v === null || v === undefined ? '—' : Math.abs(v) < 0.5 ? '0' : `<span class="${v < 0 ? 'L' : 'R'}">${Math.abs(v).toFixed(0)} ${v < 0 ? 'L' : 'R'}</span>`);
const deg = v => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}°`);
const depth = v => (v === null || v === undefined ? '—' : Math.abs(v) < 0.5 ? 'pin high' : `${Math.abs(v).toFixed(0)} ${v < 0 ? 'short' : 'long'}`);
const day = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const time = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

const shots = () => (DEMO ? demoShots : recorder.shots);
const demoShots = DEMO ? sampleShots() : [];
if (DEMO) $('demo').hidden = false;

/* ---------- tabs (remembered per device) ---------- */
const TABS = ['bag', 'practice', 'course', 'sessions'];
let tab = 'bag';
try { const t = localStorage.getItem('vibegolf.mygame.tab'); if (TABS.includes(t)) tab = t; } catch (e) { /* storage off */ }
const fromHash = location.hash.slice(1); if (TABS.includes(fromHash)) tab = fromHash;
function show(t) {
  tab = t;
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  for (const id of TABS) $(id).hidden = id !== t;
  try { localStorage.setItem('vibegolf.mygame.tab', t); } catch (e) { /* storage off */ }
  render();
}
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) show(b.dataset.tab); });

const empty = (title, body, link = null) => `<div class="empty glass"><h2>${title}</h2><p>${body}</p>${link ? `<a class="go" href="${link[0]}">${link[1]}</a>` : ''}</div>`;

/* ---------- Bag ---------- */
function renderBag() {
  const rows = bagStats(shots());
  if (!rows.length) { $('bag').innerHTML = empty('Your bag fills in as you hit', `Hit real shots with the R10 on the Range or in Coaching. Each club shows once it has ${MIN_SHOTS} shots; the numbers use your last 40 with each club.`, ['range.html?mode=range', 'Go to the Range']); return; }
  // the ladder's scale runs from just under your shortest club to just past your longest
  const ends = rows.flatMap(r => (r.depth ? r.depth : [r.carry])).filter(v => v !== null);
  const min = Math.max(0, Math.floor((Math.min(...ends) - 10) / 25) * 25), max = Math.ceil((Math.max(...ends) + 10) / 25) * 25;
  const x = v => `${Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100))}%`;
  $('bag').innerHTML = `
    <p class="lede">Your carry with each club from the Practice Ground: the middle of your last 40 shots, the band your middle 80% land in, and how far apart your clubs are.</p>
    <div class="card glass"><div class="tablewrap"><table>
      <thead><tr><th>Club</th><th class="n">Carry</th><th class="ladder">Carry range</th><th class="n">Total</th><th class="n">Gap</th><th class="n">Side</th><th class="n hide-s">Launch</th><th class="n hide-s">Spin</th><th class="n hide-s">Club spd</th><th class="n">Shots</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${r.enough ? '' : 'thin'}">
        <td class="club">${esc(r.club)}<small>${esc(r.name)}</small></td>
        <td class="n carry">${yd(r.carry)}</td>
        <td class="ladder">${r.enough ? `<div class="lad" title="${yd(r.depth[0])}–${yd(r.depth[1])} yd"><i class="track"></i><i class="band" style="left:${x(r.depth[0])};width:calc(${x(r.depth[1])} - ${x(r.depth[0])})"></i><i class="dot" style="left:${x(r.carry)}"></i></div>` : `<span class="note">${MIN_SHOTS - r.n} more shot${MIN_SHOTS - r.n === 1 ? '' : 's'}</span>`}</td>
        <td class="n">${yd(r.totalYd)}</td>
        <td class="n">${r.gap !== undefined ? yd(r.gap) : ''}</td>
        <td class="n">${side(r.side)}</td>
        <td class="n hide-s">${r.launch !== null ? r.launch.toFixed(1) + '°' : '—'}</td>
        <td class="n hide-s">${r.spin !== null ? Math.round(r.spin).toLocaleString() : '—'}</td>
        <td class="n hide-s">${r.clubSpeed !== null ? r.clubSpeed.toFixed(0) : '—'}</td>
        <td class="n">${r.total}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td></td><td class="ladder"><div class="scale"><span>${min}</span><span>${Math.round((min + max) / 10) * 5}</span><span>${max} yd</span></div></td><td colspan="7"></td></tr></tfoot>
    </table></div></div>
    <p class="note">Only full swings off the Practice Ground count here. Course and mini-game shots are kept too, and show under On the course.</p>`;
}

/* ---------- Practice ---------- */
function renderPractice() {
  const T = practiceTendencies(shots());
  if (!T.length) { $('practice').innerHTML = empty('Your practice tendencies show here', `Once a club has ${MIN_SHOTS} real shots on the Range or in Coaching, this shows where it goes: which side you miss, the shape, your path and face, what the coach has read, and the feels you tagged.`, ['range.html?mode=coach', 'Go to Coaching']); return; }
  $('practice').innerHTML = `
    <p class="lede">How each club behaves on the Practice Ground, from your last 40 shots with it.</p>
    <div class="cards">${T.map(t => {
      const mid = 1 - t.left - t.right;
      const reads = t.reads.map(([id, n]) => `<span class="chip read">${esc(CONDITIONS[id] ? CONDITIONS[id].name : id)}${n > 1 ? ' ×' + n : ''}</span>`).join('');
      const feels = Object.entries(t.feels).map(([f, n]) => `<span class="chip">${esc(FEEL_NAMES[f] || f)} ${n}</span>`).join('');
      return `<div class="card glass">
        <div class="head"><b>${esc(t.name)}</b><span class="lbl">${t.n} shots</span></div>
        <div class="split" role="img" aria-label="${pct(t.left)} left, ${pct(mid)} on line, ${pct(t.right)} right"><i class="l" style="width:${t.left * 100}%"></i><i class="r" style="width:${t.right * 100}%"></i></div>
        <div class="row"><span><span class="L">${pct(t.left)} left</span> · <span class="ok">${pct(mid)} on line</span> · <span class="R">${pct(t.right)} right</span></span></div>
        <div class="row"><span class="lbl">Shape</span><span class="v">${t.shape ? SHAPE_NAMES[t.shape] : '—'}</span></div>
        <div class="row"><span class="lbl">Path · face to path</span><span class="v">${deg(t.path)} · ${deg(t.ftp)}</span></div>
        <div class="row"><span class="lbl">Attack</span><span class="v">${deg(t.aoa)}</span></div>
        ${reads ? `<div class="row"><span class="lbl">Coach read</span></div><div class="chips">${reads}</div>` : ''}
        ${feels ? `<div class="row"><span class="lbl">Feels you tagged</span></div><div class="chips">${feels}</div>` : ''}
      </div>`; }).join('')}</div>
    <p class="note">On line means within 6% of the carry (at least 5 yd) of your target line. Path and face come from the R10's club data where it was tracked.</p>`;
}

/* ---------- On the course ---------- */
function renderCourse() {
  const all = shots(), C = courseTendencies(all);
  if (!C.n) { $('course').innerHTML = empty('Your course tendencies show here', 'Play a round with the R10 and every shot is kept: your drives (fairways and the miss), approaches by distance (short, long, left or right of where you aimed), penalties, and how each club plays on the course compared with practice.', ['courses.html', 'Play a round']); return; }
  const diff = compare(bagStats(all), practiceTendencies(all), C);
  const d = C.drive;
  $('course').innerHTML = `
    <p class="lede">From ${C.n} real shots over ${C.rounds} round${C.rounds === 1 ? '' : 's'}. Misses are measured against where you aimed (the aim line's landing spot), so a lay-up that finds its spot counts as on target.</p>
    ${diff.length ? `<div class="card glass insight"><h2>Plays differently on the course</h2><ul>${groupDiff(diff).map(([name, xs]) => `<li><b>${esc(name)}:</b> ${xs.map(x => x.kind === 'side' ? `finishes ${Math.abs(x.by).toFixed(0)} yd further ${x.by > 0 ? '<span class="R">right</span>' : '<span class="L">left</span>'} than in practice` : `comes up ${Math.abs(x.by).toFixed(0)} yd ${x.by < 0 ? 'short' : 'long'} of where you aim`).join(', and ')}.</li>`).join('')}</ul></div>` : ''}
    <div class="cards">
      <div class="card glass">
        <div class="head"><b>Off the tee</b><span class="lbl">${d.n} drives · par 4s and 5s</span></div>
        ${d.n ? `<div class="compass"><div><span class="lbl">Fairway</span><span class="num ok">${pct(d.fairways)}</span></div><div><span class="lbl">Miss left</span><span class="num L">${pct(d.left)}</span></div><div><span class="lbl">Miss right</span><span class="num R">${pct(d.right)}</span></div><div><span class="lbl">Penalty</span><span class="num bad">${pct(d.penalties)}</span></div></div>
        <div class="row"><span class="lbl">Typical carry</span><span class="v">${yd(d.carry)} yd</span></div>` : '<p class="note">No tee shots on par 4s or 5s yet.</p>'}
      </div>
      <div class="card glass">
        <div class="head"><b>By club</b><span class="lbl">the miss against your aim</span></div>
        ${C.clubs.length ? C.clubs.map(c => `<div class="row"><span>${esc(c.name)} <span class="lbl">${c.n}</span></span><span class="v">${depth(c.longBy)} · ${side(c.rightBy)}</span></div>`).join('') : `<p class="note">Each club needs ${MIN_SHOTS} shots on the course.</p>`}
      </div>
    </div>
    <div class="card glass"><h2>Approaches</h2>
      <div class="tablewrap"><table>
        <thead><tr><th>From</th><th class="n">Shots</th><th class="n">On green</th><th class="n">Short</th><th class="n">Long</th><th class="n">Left</th><th class="n">Right</th><th class="n">Typical miss</th><th class="n hide-s">Left to pin</th></tr></thead>
        <tbody>${C.approaches.map(a => a.n ? `<tr><td>${a.lo}–${a.hi} yd</td><td class="n">${a.n}</td><td class="n ok">${pct(a.green)}</td><td class="n">${pct(a.short)}</td><td class="n">${pct(a.long)}</td><td class="n L">${pct(a.left)}</td><td class="n R">${pct(a.right)}</td><td class="n">${depth(a.longBy)} · ${side(a.rightBy)}</td><td class="n hide-s">${yd(a.leave)} yd</td></tr>` : `<tr class="thin"><td>${a.lo}–${a.hi} yd</td><td class="n">0</td><td colspan="7" class="note">No approaches from here yet.</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="note">Short, long, left and right count misses of more than 8 yd from where you aimed. Penalty shots in all: ${C.penalties}.</p>
    </div>`;
}

const groupDiff = d => { const m = new Map(); for (const x of d) { if (!m.has(x.name)) m.set(x.name, []); m.get(x.name).push(x); } return [...m]; };

/* ---------- Sessions ---------- */
let confirmDelete = false;
function renderSessions() {
  const list = DEMO ? [] : recorder.sessions.filter(s => s.shots.length).slice().reverse();
  if (!list.length) { $('sessions').innerHTML = empty('No sessions yet', DEMO ? 'The example data has no sessions to list or export. Open My game without <code>?demo=1</code> to see yours.' : 'Every real shot you hit with the R10, in any mode, is kept on this device and grouped into sessions. Export them to keep a copy or send them for tuning the coach.'); return; }
  const tags = s => s.shots.filter(x => x.feel).length;
  $('sessions').innerHTML = `
    <p class="lede">Every real shot is kept on this device, grouped by session. Export a session (or all of them) as a file to keep a copy or to send for tuning the coach.</p>
    <div class="bar"><button class="btn primary" type="button" data-x="all">Export all</button><button class="btn danger" type="button" data-x="del">Delete all</button></div>
    ${confirmDelete ? `<div class="confirm glass"><span>Delete every recorded shot on this device? Your bag and tendencies start again from empty.</span><button class="btn danger" type="button" data-x="delyes">Delete</button><button class="btn" type="button" data-x="delno">Keep them</button></div>` : ''}
    ${list.map(s => { const clubs = [...new Set(s.shots.map(x => x.club).filter(Boolean))].join(' · ');
      return `<div class="sess glass"><span><b>${day(s.start)} · ${time(s.start)}</b><br><span class="meta">${esc(MODE_NAMES[s.mode] || s.mode)} · ${s.shots.length} shot${s.shots.length === 1 ? '' : 's'}${tags(s) ? ` · ${tags(s)} tagged` : ''}</span></span><span class="meta">${esc(clubs)}</span><button class="btn" type="button" data-x="one" data-s="${esc(s.id)}">Export</button></div>`; }).join('')}`;
}
$('sessions').addEventListener('click', e => {
  const b = e.target.closest('button[data-x]'); if (!b) return;
  const x = b.dataset.x;
  if (x === 'all') exportFile(recorder.exportJSON(), 'all');
  else if (x === 'one') exportFile(recorder.exportJSON([b.dataset.s]), b.dataset.s);
  else if (x === 'del') { confirmDelete = true; renderSessions(); }
  else if (x === 'delno') { confirmDelete = false; renderSessions(); }
  else if (x === 'delyes') { confirmDelete = false; recorder.clear(); render(); }
});
async function exportFile(json, tag) {
  const name = `vibegolf-sessions-${new Date().toISOString().slice(0, 10)}${tag === 'all' ? '' : '-' + tag}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  // on a phone the share sheet is the way out (save to files, send to a computer); else a download
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'VibeGolf sessions' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function render() { ({ bag: renderBag, practice: renderPractice, course: renderCourse, sessions: renderSessions })[tab](); }
recorder.onChange(() => render());
addEventListener('storage', e => { if (e.key && e.key.startsWith('vibegolf.sessions')) location.reload(); });
show(tab);
window.__mygame = { show, recorder, DEMO };
