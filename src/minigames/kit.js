// Shared mini game kit (see docs/MINIGAMES.md "Shared kit"). Builds the HUD and screens every
// mini game uses, so all games feel like one family:
//   start screen (difficulty, players, this run's challenges, best) · turn banner · score + streak
//   PERFECT / So close / splash words · score count-up · run challenges → stars · end screen + bests
//   bottom-left prompt + club chip + Hit · bottom-right last-shot card · sounds
//
//   const kit = createKit({ id, title, blurb, shotsPerPlayer, difficulties, challenges, clubs });
//   kit.on('start', ({ difficulty, players }) => ...);  kit.on('turn', ({ player, shot }) => ...)
//   kit.on('hit', () => swing());  kit.on('club', i => ...)
//   during a shot: kit.award(points, opts) / kit.splash(word) / kit.soClose(yd) / kit.stat(key, n)
//   when the shot is over: kit.endShot(scored) → then kit.next()

import { launchMonitor, mountLaunchMonitorUI } from '../launch-monitor.js';

const $ = (sel, root = document) => root.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem('vibegolf.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('vibegolf.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString();
const MAX_MULT = 4;

/* ---------- sounds (synthesised; start after the first tap) ---------- */
function createSfx() {
  let ctx = null, on = store.get('sound', true);
  const init = () => { if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; } try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } };
  addEventListener('pointerdown', init, { passive: true });
  function tone(freq, { t = 0, len = 0.35, vol = 0.25, type = 'sine', slide = 0 } = {}) {
    if (!ctx || !on) return;
    const t0 = ctx.currentTime + t, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + len);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + len + 0.05);
  }
  function noise(len, freq, vol, t = 0) {
    if (!ctx || !on) return;
    const n = ctx.sampleRate * len, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination); src.start(ctx.currentTime + t);
  }
  const NOTES = [1046.5, 1318.5, 1568, 2093, 2637]; // C6 E6 G6 C7 E7: each hit in a shot climbs
  return {
    init, get on() { return on; }, set on(v) { on = v; store.set('sound', v); },
    chime(step = 0) { const f = NOTES[Math.min(step, NOTES.length - 1)]; tone(f, { len: 0.5, vol: 0.18 }); tone(f * 2, { len: 0.3, vol: 0.06, t: 0.01 }); },
    perfect() { [0, 0.07, 0.14].forEach((t, i) => tone(1568 * [1, 1.26, 1.5][i], { t, len: 0.6, vol: 0.12 })); noise(0.35, 6000, 0.05, 0.05); },
    miss() { tone(220, { len: 0.25, vol: 0.12, type: 'triangle', slide: 0.7 }); },
    close() { tone(330, { len: 0.18, vol: 0.1, type: 'triangle' }); tone(311, { t: 0.12, len: 0.22, vol: 0.1, type: 'triangle' }); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, { t: i * 0.09, len: 0.45, vol: 0.13, type: 'triangle' })); },
    boom() { noise(0.9, 120, 0.9); noise(0.5, 900, 0.25); tone(70, { len: 0.7, vol: 0.4, slide: 0.5 }); },
    tick() { tone(1800, { len: 0.04, vol: 0.05 }); },
    star() { [1318.5, 1760, 2349].forEach((f, i) => tone(f, { t: i * 0.06, len: 0.4, vol: 0.1 })); },
    noise, tone,
  };
}

export function createKit(cfg) {
  const {
    id, title, blurb = '', shotsPerPlayer = 10, difficulties, challenges: pool = [], clubs = [],
    rules = [], accent, idealShot = false, mode = 'shots', summary = null,
    minPlayers = 1, cpu = null, rankBy = null, options = [], board = true,
    multiplier = true, badge = null,
  } = cfg;
  // multiplier: false → award() adds points as given (e.g. bowling, whose scoring is its own
  // multiplier); badge(player) → { text, level } relabels the streak badge (e.g. strikes in a row)
  // 'shots': N shots each, round robin · 'run': each player plays until their run ends ·
  // 'manual': the game decides who plays next (kit.turnTo) and when it ends (kit.finishGame)
  const RUN = mode === 'run', MANUAL = mode === 'manual';
  // cpu: { name, diff } adds a computer player when there aren't `minPlayers` people
  const handlers = {};
  const emit = (ev, d) => (handlers[ev] || []).forEach(f => f(d));
  const sfx = createSfx();
  if (accent) document.documentElement.style.setProperty('--accent', accent);

  /* ---------- HUD markup ---------- */
  const hud = document.createElement('div'); hud.id = 'mg';
  hud.innerHTML = `
  <div class="mg-tl">
    <div class="mg-card glass">
      <div class="mg-game"><span class="mg-title">${esc(title)}</span><span class="mg-diff" data-r="diff"></span></div>
      <div class="mg-row"><span class="mg-player" data-r="player"></span><span class="mg-shot" data-r="shot"></span></div>
      <div class="mg-row mg-scoreRow">
        <span class="num mg-score" data-r="score">0</span>
        <span class="mg-mult" data-r="mult" title="Streak multiplier">×1</span>
        <span class="mg-stars" data-r="stars" title="Challenges"></span>
      </div>
    </div>
    <ol class="mg-board glass" data-r="board" hidden></ol>
  </div>
  <div class="mg-tr">
    <div class="mg-tools glass">
      <a class="menu-link" href="games.html" title="Mini games"><span class="mlong">Games</span><span class="mshort" aria-hidden="true">‹</span></a>
      <button class="tbtn lm-btn" data-r="lmBtn" title="Launch monitor"><i class="dot" data-r="lmDot"></i><span data-r="lmText">R10 off</span></button>
    </div>
  </div>
  <div class="mg-play" data-r="play">
    <div class="mg-prompt glass" data-r="prompt"></div>
    <button class="mg-ideal" data-r="ideal" hidden title="Hits the exact shot the target was built from (simulated)">Ideal shot <small>test</small></button>
    <div class="mg-hitrow">
      <button class="mg-chip" data-r="clubBtn" aria-expanded="false" title="Club"><b data-r="club">7i</b><span>Club</span></button>
      <button class="mg-hit" data-r="hit" title="A simulated golfer attempts the shot">Hit</button>
    </div>
  </div>
  <div class="mg-result glass" data-r="result" hidden></div>
  <aside class="mg-sheet glass" data-r="clubSheet" hidden aria-label="Club">
    <h2>Club <button class="x" data-r="clubX" aria-label="Close">×</button></h2>
    <div class="mg-clubs" data-r="clubs"></div>
    <p class="note">The suggested club is underlined. With your R10 connected, hit any club you like: the ball flight comes from the R10.</p>
  </aside>
  <div class="mg-splash" data-r="splash" aria-live="polite"></div>
  <div class="mg-close" data-r="close"></div>
  <div class="mg-toast glass" data-r="toast"></div>
  <div class="mg-banner" data-r="banner" hidden><span data-r="bannerName"></span><small data-r="bannerSub"></small></div>
  <div class="mg-overlay" data-r="startScr" hidden><div class="mg-panel glass" data-r="startPanel"></div></div>
  <div class="mg-overlay" data-r="endScr" hidden><div class="mg-panel glass" data-r="endPanel"></div></div>`;
  document.body.appendChild(hud);
  const R = {}; hud.querySelectorAll('[data-r]').forEach(el => { R[el.dataset.r] = el; });
  mountLaunchMonitorUI({ dot: R.lmDot, text: R.lmText, button: R.lmBtn, compact: true });

  /* ---------- state ---------- */
  // the roster: names are shared across games, each player's difficulty is remembered per game
  const names = store.get('players', ['Player 1']).map(n => (typeof n === 'string' ? n : n.name));
  const lastDiff = store.get(`mg.${id}.diff`, difficulties[0].id);
  const savedDiffs = store.get(`mg.${id}.diffs`, []);
  const S = {
    roster: names.map((name, i) => ({ name, diff: difficulties.some(d => d.id === savedDiffs[i]) ? savedDiffs[i] : lastDiff })),
    players: [], cur: 0, challenges: [], phase: 'setup', shotLabel: '',
    opts: Object.fromEntries(options.map(o => [o.id, store.get(`mg.${id}.opt.${o.id}`, o.def)])),
  };
  const humans = () => S.roster.filter(r => !r.cpu).length;
  function fillCpu() { // keep the computer player in the roster while it's needed to make up the numbers
    if (!cpu) return;
    const has = S.roster.some(r => r.cpu);
    if (!has && humans() < minPlayers) S.roster.push({ name: cpu.name, diff: store.get(`mg.${id}.cpuDiff`, cpu.diff || difficulties[0].id), cpu: true, auto: true });
  }
  fillCpu();
  const findDiff = idd => difficulties.find(d => d.id === idd) || difficulties[0];
  const diffObj = () => (player() ? player().difficulty : findDiff(S.roster[0] && S.roster[0].diff));
  const player = () => S.players[S.cur];
  const mult = () => (multiplier ? Math.min(MAX_MULT, 1 + player().streak) : 1);

  /* ---------- clubs ---------- */
  let clubIdx = 0, suggested = -1;
  clubs.forEach((c, i) => { const b = document.createElement('button'); b.className = 'mg-clubBtn'; b.textContent = c.id; b.title = c.name; b.onclick = () => { setClub(i); toggleClubs(false); emit('club', i); }; R.clubs.appendChild(b); });
  function setClub(i, isSuggestion) {
    clubIdx = i; if (isSuggestion) suggested = i;
    R.club.textContent = clubs[i] ? clubs[i].id : '';
    [...R.clubs.children].forEach((b, j) => { b.setAttribute('aria-pressed', String(j === i)); b.classList.toggle('sugg', j === suggested); });
    if (clubs[i]) launchMonitor.setPlayer({ club: clubs[i].id });
  }
  function toggleClubs(open = R.clubSheet.hidden) { R.clubSheet.hidden = !open; R.clubBtn.setAttribute('aria-expanded', String(open)); }
  R.clubBtn.onclick = () => toggleClubs(); R.clubX.onclick = () => toggleClubs(false);
  R.clubBtn.hidden = !clubs.length;
  R.hit.onclick = () => { sfx.init(); if (S.phase === 'aim') emit('hit'); };
  // test helper: the ideal shot is only offered while swings are simulated (no live R10)
  const syncIdeal = () => { R.ideal.hidden = !idealShot || launchMonitor.status === 'ready'; };
  launchMonitor.addEventListener('status', syncIdeal); syncIdeal();
  R.ideal.onclick = () => { sfx.init(); if (S.phase === 'aim') emit('ideal'); };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' && S.phase === 'aim') { e.preventDefault(); sfx.init(); emit('hit'); }
  });

  /* ---------- HUD rendering ---------- */
  let shownScore = 0, scoreAnim = null;
  function renderHud() {
    const p = player(); if (!p) return;
    R.diff.textContent = p.difficulty.label;
    R.player.textContent = p.name;
    R.shot.textContent = RUN || MANUAL ? S.shotLabel : `Shot ${Math.min(p.shots + 1, shotsPerPlayer)} of ${shotsPerPlayer}`;
    const m = mult(), bd = badge ? badge(p) : { text: '×' + m, level: m };
    R.mult.textContent = bd.text; R.mult.dataset.level = bd.level; R.mult.classList.toggle('live', bd.level > 1);
    R.stars.innerHTML = S.challenges.map((c, i) => `<i class="${p.done[i] ? 'on' : ''}" title="${esc(c.text)}">★</i>`).join('');
    if (board && S.players.length > 1) {
      R.board.hidden = false;
      R.board.innerHTML = S.players.map((q, i) => `<li class="${i === S.cur ? 'cur' : ''}"><span>${esc(q.name)}</span><b class="num">${fmt(q.score)}</b></li>`).join('');
    } else R.board.hidden = true;
  }
  // Roll the score up to `target`. Uses performance.now() for both ends of the timing: some iPhones
  // hand requestAnimationFrame a timestamp on a different clock, which made the roll-up never end
  // (and the number climb forever).
  function countUpTo(target) {
    cancelAnimationFrame(scoreAnim);
    const from = shownScore, t0 = performance.now(), dur = Math.max(1, Math.min(900, 300 + Math.abs(target - from) * 0.8));
    const stepF = () => {
      const u = Math.max(0, Math.min(1, (performance.now() - t0) / dur)), e = 1 - Math.pow(1 - u, 3);
      shownScore = from + (target - from) * e; R.score.textContent = fmt(shownScore);
      if (u < 1) scoreAnim = requestAnimationFrame(stepF); else { shownScore = target; R.score.textContent = fmt(target); R.score.classList.remove('bump'); }
    };
    R.score.classList.add('bump'); scoreAnim = requestAnimationFrame(stepF);
  }
  // show a player's own score immediately when their turn starts
  function showScore(v) { cancelAnimationFrame(scoreAnim); shownScore = v; R.score.textContent = fmt(v); R.score.classList.remove('bump'); }

  /* ---------- feedback ---------- */
  let splashT = 0, closeT = 0, toastT = 0;
  function splash(word, { gold = false, big = false, sub = '' } = {}) {
    R.splash.innerHTML = `<b>${esc(word)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    R.splash.className = 'mg-splash on' + (gold ? ' gold' : '') + (big ? ' big' : '');
    void R.splash.offsetWidth; R.splash.classList.add('pop');
    clearTimeout(splashT); splashT = setTimeout(() => { R.splash.className = 'mg-splash'; }, 1300);
  }
  function soClose(yd, what = '') {
    R.close.textContent = typeof yd === 'string' ? `So close · ${yd}` : `So close · ${yd < 10 ? yd.toFixed(1) : Math.round(yd)} yd${what ? ' ' + what : ''}`;
    R.close.className = 'mg-close on'; sfx.close();
    clearTimeout(closeT); closeT = setTimeout(() => { R.close.className = 'mg-close'; }, 1800);
  }
  function toast(html, ms = 2000) {
    R.toast.innerHTML = html; R.toast.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => R.toast.classList.remove('on'), ms);
  }

  /* ---------- scoring ---------- */
  // `to`: award another player (e.g. the setter in HORSE when someone misses their call)
  function award(base, { to = S.cur } = {}) {
    const p = S.players[to], m = multiplier ? Math.min(MAX_MULT, 1 + p.streak) : 1, pts = Math.round(base * m);
    p.score += pts; p.stats.score = p.score;
    if (to === S.cur) { p.shotPts += pts; countUpTo(p.score); }
    checkChallenges(to); renderHud();
    return pts;
  }
  function stat(key, n = 1, to = S.cur) { const p = S.players[to]; p.stats[key] = (p.stats[key] || 0) + n; checkChallenges(to); }
  function statMax(key, v, to = S.cur) { const p = S.players[to]; p.stats[key] = Math.max(p.stats[key] || 0, v); checkChallenges(to); }
  function checkChallenges(to = S.cur) {
    const p = S.players[to];
    S.challenges.forEach((c, i) => {
      if (p.done[i]) return;
      if ((p.stats[c.key] || 0) >= c.goal) {
        p.done[i] = true; if (p.cpu) return;
        sfx.star();
        toast(`<span class="mg-starPop">★</span> ${S.players.length > 1 ? esc(p.name) + ' · ' : ''}Challenge complete · ${esc(c.text)}`, 2400);
      }
    });
  }
  function endShot(scored) {
    const p = player();
    p.shots++;
    if (scored) { p.streak = Math.min(MAX_MULT - 1, p.streak + 1); statMax('mult', Math.min(MAX_MULT, 1 + p.streak)); }
    else p.streak = 0;
    S.phase = 'between'; R.hit.disabled = true; R.ideal.disabled = true;
    renderHud();
    const last = !RUN && !MANUAL && S.players.every(q => q.shots >= shotsPerPlayer);
    return { last };
  }
  // run mode: the current player's run is over (e.g. the fence fell)
  function finishRun() { player().finished = true; S.phase = 'between'; R.hit.disabled = true; R.ideal.disabled = true; renderHud(); }
  const isDone = q => (RUN ? q.finished : q.shots >= shotsPerPlayer);
  function showResult(html) { R.result.innerHTML = html; R.result.hidden = false; }

  /* ---------- turn flow ---------- */
  function next() {
    if (MANUAL) { emit('advance', { player: player(), index: S.cur }); return true; }
    if (S.players.every(isDone)) { finish(); return false; }
    if (RUN && !player().finished) { beginTurn(false); return true; }       // same run continues
    // round robin; skip anyone who has finished
    do { S.cur = (S.cur + 1) % S.players.length; } while (isDone(player()));
    if (RUN) { showScore(player().score); emit('runStart', { player: player(), index: S.cur }); }
    beginTurn(S.players.length > 1);
    return true;
  }
  function beginTurn(announce, sub = null) {
    const p = player(); p.shotPts = 0;
    if (Math.round(shownScore) !== p.score) showScore(p.score);
    S.phase = p.cpu ? 'cpu' : 'aim'; R.hit.disabled = R.ideal.disabled = !!p.cpu; renderHud();
    if (announce) {
      R.bannerName.textContent = `${p.name}`; R.bannerSub.textContent = sub != null ? sub : RUN ? `your run · ${p.difficulty.label}` : `your turn · shot ${p.shots + 1} of ${shotsPerPlayer}`;
      R.banner.hidden = false; R.banner.classList.remove('go'); void R.banner.offsetWidth; R.banner.classList.add('go');
      setTimeout(() => { R.banner.hidden = true; }, 1600);
    }
    emit('turn', { player: p, index: S.cur, shot: p.shots });
  }
  // manual mode: hand the next shot to player i
  function turnTo(i, { announce = S.players.length > 1, sub = null } = {}) {
    S.cur = i; showScore(player().score); beginTurn(announce, sub);
  }

  /* ---------- start screen ---------- */
  const usedDiffs = () => [...new Set(S.roster.map(r => r.diff))];
  function pickChallenges() {
    const used = [...new Set(S.roster.filter(r => !r.cpu).map(r => r.diff))];
    const avail = pool.filter(c => !c.only || used.every(d => c.only.includes(d)));
    const pick = [], a = avail.slice();
    while (pick.length < 3 && a.length) pick.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return pick;
  }
  function renderStart() {
    const used = usedDiffs(), all = used.length === 1 ? used[0] : null;
    const bests = [...new Set(S.roster.filter(r => !r.cpu).map(r => r.diff))].map(d => ({ d: findDiff(d), b: store.get(`best.${id}.${d}`, null) }));
    R.startPanel.innerHTML = `
      <div class="mg-sTitle"><span class="lbl">Mini game</span><h1>${esc(title)}</h1><p>${esc(blurb)}</p></div>
      <div class="mg-sGrid">
        <div class="mg-sCol">
          <span class="lbl">Players &amp; difficulty</span>
          <div class="mg-players">${S.roster.map((r, i) => `<div class="mg-pl${r.cpu ? ' cpu' : ''}"${r.cpu ? ' data-cpu' : ''}${r.auto ? ' data-auto' : ''}><input id="pl${i}" value="${esc(r.name)}" maxlength="14" aria-label="Player ${i + 1} name"${r.cpu ? ' readonly title="Computer player"' : ''}>${r.cpu ? '<em class="mg-cpuTag">CPU</em>' : ''}
            <select id="pd${i}" aria-label="${esc(r.name)} difficulty">${difficulties.map(d => `<option value="${d.id}" ${d.id === r.diff ? 'selected' : ''}>${esc(d.label)}</option>`).join('')}</select>
            ${S.roster.length > 1 && !(r.cpu && humans() < minPlayers) ? `<button data-rm="${i}" aria-label="Remove player">×</button>` : ''}</div>`).join('')}
          ${S.roster.length < 4 ? '<button class="mg-add" data-add>+ Add player</button>' : ''}${cpu && S.roster.length < 4 && !S.roster.some(r => r.cpu) ? `<button class="mg-add" data-addcpu>+ Add ${esc(cpu.name)} (computer)</button>` : ''}</div>
          ${S.roster.length > 1 ? `<span class="lbl">Set everyone to</span><div class="mg-seg">${difficulties.map(d => `<button class="${d.id === all ? 'on' : ''}" data-diff="${d.id}">${esc(d.label)}</button>`).join('')}</div>` : ''}
          ${options.map(o => `<span class="lbl">${esc(o.label)}</span><div class="mg-seg">${o.choices.map(c => `<button class="${S.opts[o.id] === c.id ? 'on' : ''}" data-opt="${o.id}" data-val="${c.id}">${esc(c.label)}</button>`).join('')}</div>`).join('')}
          <div class="mg-notes">${used.map(d => `<p class="note"><b>${esc(findDiff(d).label)}:</b> ${esc(findDiff(d).note || '')}</p>`).join('')}</div>
        </div>
        <div class="mg-sCol">
          <span class="lbl">This run's challenges</span>
          <ul class="mg-chal">${S.challenges.map(c => `<li><i>★</i>${esc(c.text)}</li>`).join('')}</ul>
          ${rules.length ? `<span class="lbl">How it works</span><ul class="mg-rules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
          <p class="mg-best">${bests.map(({ d, b }) => b ? `Best on ${esc(d.label)}: <b class="num">${fmt(b.score)}</b> ${'★'.repeat(b.stars || 0)}${'☆'.repeat(3 - (b.stars || 0))}` : `No best yet on ${esc(d.label)}`).join('<br>')}</p>
        </div>
      </div>
      <div class="mg-sBtns"><label class="mg-snd"><input type="checkbox" id="mgSound" ${sfx.on ? 'checked' : ''}> Sound</label><button class="mg-go" data-go>Start</button></div>`;
    const P = R.startPanel;
    const reroll = () => { S.challenges = pickChallenges(); renderStart(); };
    P.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { readRoster(); S.roster.forEach(r => { r.diff = b.dataset.diff; }); reroll(); });
    P.querySelectorAll('.mg-pl select').forEach(sel => sel.onchange = () => { readRoster(); reroll(); });
    P.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { readRoster(); S.roster.splice(+b.dataset.rm, 1); fillCpu(); reroll(); });
    const add = P.querySelector('[data-add]'); if (add) add.onclick = () => {
      readRoster();
      // a computer player that only joined to make up the numbers steps aside for a real one
      if (humans() + 1 >= minPlayers) S.roster = S.roster.filter(r => !r.auto);
      const nm = `Player ${humans() + 1}`, last = S.roster.filter(r => !r.cpu).pop(), at = S.roster.findIndex(r => r.cpu);
      const row = { name: nm, diff: last ? last.diff : difficulties[0].id };
      if (at >= 0) S.roster.splice(at, 0, row); else S.roster.push(row);
      renderStart();
    };
    const addCpu = P.querySelector('[data-addcpu]'); if (addCpu) addCpu.onclick = () => { readRoster(); S.roster.push({ name: cpu.name, diff: store.get(`mg.${id}.cpuDiff`, cpu.diff || difficulties[0].id), cpu: true }); reroll(); };
    P.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { readRoster(); S.opts[b.dataset.opt] = b.dataset.val; store.set(`mg.${id}.opt.${b.dataset.opt}`, b.dataset.val); renderStart(); });
    P.querySelector('#mgSound').onchange = e => { sfx.on = e.target.checked; };
    P.querySelector('[data-go]').onclick = () => { sfx.init(); readRoster(); beginGame(); };
  }
  function readRoster() {
    const rows = R.startPanel.querySelectorAll('.mg-pl');
    if (rows.length) S.roster = [...rows].map((row, i) => ({ name: row.querySelector('input').value.trim() || `Player ${i + 1}`, diff: row.querySelector('select').value, cpu: row.hasAttribute('data-cpu'), auto: row.hasAttribute('data-auto') }));
  }
  function showStart() {
    S.phase = 'setup'; S.challenges = pickChallenges(); renderStart();
    R.endScr.hidden = true; R.startScr.hidden = false; R.play.hidden = true; R.result.hidden = true;
  }
  function beginGame() {
    const people = S.roster.filter(r => !r.cpu), bot = S.roster.find(r => r.cpu);
    store.set('players', people.map(r => r.name));
    store.set(`mg.${id}.diffs`, people.map(r => r.diff)); if (people[0]) store.set(`mg.${id}.diff`, people[0].diff);
    if (bot) store.set(`mg.${id}.cpuDiff`, bot.diff);
    S.players = S.roster.map(r => ({ name: r.name, difficulty: findDiff(r.diff), score: 0, shots: 0, streak: 0, stats: {}, done: [false, false, false], shotPts: 0, finished: false, cpu: !!r.cpu }));
    S.cur = 0; showScore(0);
    R.startScr.hidden = true; R.endScr.hidden = true; R.play.hidden = false; R.result.hidden = true;
    emit('start', { players: S.players, options: { ...S.opts } });
    if (MANUAL) return; // the game calls turnTo()
    if (RUN) emit('runStart', { player: player(), index: 0 });
    beginTurn(S.players.length > 1);
  }

  /* ---------- end screen ---------- */
  function finish() {
    S.phase = 'over'; R.play.hidden = true;
    const ranked = S.players.map((p, i) => ({ ...p, i, stars: p.done.filter(Boolean).length })).sort(rankBy || ((a, b) => b.score - a.score));
    // bests are kept per difficulty; each player can set one on their own level (not the computer)
    ranked.forEach(p => {
      if (p.cpu) { p.newBest = false; return; }
      const key = `best.${id}.${p.difficulty.id}`, best = store.get(key, null);
      p.newBest = !best || p.score > best.score;
      p.prevBest = best;
      if (p.newBest || (best && p.stars > (best.stars || 0))) store.set(key, { score: Math.max(p.score, best ? best.score : 0), stars: Math.max(p.stars, best ? best.stars || 0 : 0), name: p.name });
    });
    const top = ranked[0], solo = S.players.length === 1;
    const youLost = !solo && top.cpu && S.players.filter(p => !p.cpu).length === 1;
    sfx.fanfare();
    R.endPanel.innerHTML = `
      <div class="mg-sTitle"><span class="lbl">${esc(title)}${solo ? ' · ' + esc(top.difficulty.label) : ''}</span><h1>${solo ? (RUN ? 'Run over' : 'Round complete') : youLost ? `${esc(top.name)} wins this time` : `${esc(top.name)} wins`}</h1>
      ${solo ? (top.newBest ? '<div class="mg-newBest">NEW BEST!</div>' : top.prevBest ? `<p>Best: <b class="num">${fmt(top.prevBest.score)}</b></p>` : '') : ''}</div>
      <ol class="mg-standings">${ranked.map((p, r) => `<li class="${r === 0 ? 'win' : ''}"><span class="pos">${r + 1}</span><span class="nm">${esc(p.name)}<small>${esc(p.difficulty.label)}${summary ? ' · ' + esc(summary(p)) : ''}</small></span><span class="st">${!solo && p.newBest ? '<em class="nb">NEW BEST</em>' : ''}${'<i class="on">★</i>'.repeat(p.stars)}${'<i>★</i>'.repeat(3 - p.stars)}</span><b class="num">${fmt(p.score)}</b></li>`).join('')}</ol>
      <ul class="mg-chal done">${S.challenges.map((c, i) => `<li class="${S.players.some(p => p.done[i]) ? 'got' : ''}"><i>★</i>${esc(c.text)}${!solo ? ` <small>${S.players.filter(p => p.done[i]).map(p => esc(p.name)).join(', ')}</small>` : ''}</li>`).join('')}</ul>
      <div class="mg-sBtns"><a class="mg-ghost" href="games.html">Mini games</a><button class="mg-ghost" data-setup>Change setup</button><button class="mg-go" data-again>Play again</button></div>`;
    R.endPanel.querySelector('[data-again]').onclick = () => { S.challenges = pickChallenges(); beginGame(); };
    R.endPanel.querySelector('[data-setup]').onclick = showStart;
    R.endScr.hidden = false;
    emit('end', { ranked });
  }

  return {
    on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); return this; },
    showStart, award, stat, statMax, splash, soClose, toast, endShot, next, showResult, setClub, finishRun, turnTo,
    finishGame: () => finish(),
    setShotLabel(t) { S.shotLabel = t; if (RUN || MANUAL) R.shot.textContent = t; },
    setPrompt(html) { R.prompt.innerHTML = html; },
    get phase() { return S.phase; }, set phase(v) { S.phase = v; R.hit.disabled = R.ideal.disabled = v !== 'aim'; },
    get current() { return S.cur; },
    get player() { return player(); }, get players() { return S.players; },
    get multiplier() { return mult(); }, get difficulty() { return diffObj(); },
    get club() { return clubIdx; }, sfx, els: R,
  };
}
