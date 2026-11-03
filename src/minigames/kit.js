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
    rules = [], accent,
  } = cfg;
  const handlers = {};
  const emit = (ev, d) => (handlers[ev] || []).forEach(f => f(d));
  const sfx = createSfx();
  if (accent) document.documentElement.style.setProperty('--accent', accent);

  /* ---------- HUD markup ---------- */
  const hud = document.createElement('div'); hud.id = 'mg';
  hud.innerHTML = `
  <div class="mg-tl">
    <div class="mg-card glass">
      <div class="mg-game">${esc(title)} <span class="mg-diff" data-r="diff"></span></div>
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
    <div class="mg-hitrow">
      <button class="mg-chip" data-r="clubBtn" aria-expanded="false" title="Club"><b data-r="club">7i</b><span>Club</span></button>
      <button class="mg-hit" data-r="hit">Hit</button>
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
  const S = {
    difficulty: store.get(`mg.${id}.diff`, difficulties[0].id),
    names: store.get('players', ['Player 1']),
    players: [], cur: 0, shot: 0, streak: 0, challenges: [], phase: 'setup', shotHits: 0,
  };
  const diffObj = () => difficulties.find(d => d.id === S.difficulty) || difficulties[0];
  const player = () => S.players[S.cur];
  const mult = () => Math.min(MAX_MULT, 1 + player().streak);

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
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' && S.phase === 'aim') { e.preventDefault(); sfx.init(); emit('hit'); }
  });

  /* ---------- HUD rendering ---------- */
  let shownScore = 0, scoreAnim = null;
  function renderHud() {
    const p = player(); if (!p) return;
    R.diff.textContent = diffObj().label;
    R.player.textContent = p.name;
    R.shot.textContent = `Shot ${Math.min(p.shots + 1, shotsPerPlayer)} of ${shotsPerPlayer}`;
    const m = mult();
    R.mult.textContent = '×' + m; R.mult.dataset.level = m; R.mult.classList.toggle('live', m > 1);
    R.stars.innerHTML = S.challenges.map((c, i) => `<i class="${p.done[i] ? 'on' : ''}" title="${esc(c.text)}">★</i>`).join('');
    if (S.players.length > 1) {
      R.board.hidden = false;
      R.board.innerHTML = S.players.map((q, i) => `<li class="${i === S.cur ? 'cur' : ''}"><span>${esc(q.name)}</span><b class="num">${fmt(q.score)}</b></li>`).join('');
    } else R.board.hidden = true;
  }
  function countUpTo(target) {
    cancelAnimationFrame(scoreAnim);
    const from = shownScore, t0 = performance.now(), dur = Math.min(900, 300 + (target - from) * 0.8);
    const stepF = now => {
      const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      shownScore = from + (target - from) * e; R.score.textContent = fmt(shownScore);
      if (u < 1) scoreAnim = requestAnimationFrame(stepF); else { shownScore = target; R.score.classList.remove('bump'); }
    };
    R.score.classList.add('bump'); scoreAnim = requestAnimationFrame(stepF);
  }

  /* ---------- feedback ---------- */
  let splashT = 0, closeT = 0, toastT = 0;
  function splash(word, { gold = false, big = false, sub = '' } = {}) {
    R.splash.innerHTML = `<b>${esc(word)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    R.splash.className = 'mg-splash on' + (gold ? ' gold' : '') + (big ? ' big' : '');
    void R.splash.offsetWidth; R.splash.classList.add('pop');
    clearTimeout(splashT); splashT = setTimeout(() => { R.splash.className = 'mg-splash'; }, 1300);
  }
  function soClose(yd, what = '') {
    R.close.textContent = `So close · ${yd < 10 ? yd.toFixed(1) : Math.round(yd)} yd${what ? ' ' + what : ''}`;
    R.close.className = 'mg-close on'; sfx.close();
    clearTimeout(closeT); closeT = setTimeout(() => { R.close.className = 'mg-close'; }, 1800);
  }
  function toast(html, ms = 2000) {
    R.toast.innerHTML = html; R.toast.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => R.toast.classList.remove('on'), ms);
  }

  /* ---------- scoring ---------- */
  function award(base, { label = '' } = {}) {
    const p = player(), m = mult(), pts = Math.round(base * m);
    p.score += pts; p.shotPts += pts; p.stats.score = p.score;
    countUpTo(p.score); checkChallenges(); renderHud();
    return pts;
  }
  function stat(key, n = 1) { const p = player(); p.stats[key] = (p.stats[key] || 0) + n; checkChallenges(); }
  function statMax(key, v) { const p = player(); p.stats[key] = Math.max(p.stats[key] || 0, v); checkChallenges(); }
  function checkChallenges() {
    const p = player();
    S.challenges.forEach((c, i) => {
      if (p.done[i]) return;
      if ((p.stats[c.key] || 0) >= c.goal) {
        p.done[i] = true; sfx.star();
        toast(`<span class="mg-starPop">★</span> Challenge complete · ${esc(c.text)}`, 2400);
      }
    });
  }
  function endShot(scored) {
    const p = player();
    p.shots++;
    if (scored) { p.streak = Math.min(MAX_MULT - 1, p.streak + 1); statMax('mult', Math.min(MAX_MULT, 1 + p.streak)); }
    else p.streak = 0;
    S.phase = 'between'; R.hit.disabled = true;
    renderHud();
    const last = S.players.every(q => q.shots >= shotsPerPlayer);
    return { last };
  }
  function showResult(html) { R.result.innerHTML = html; R.result.hidden = false; }

  /* ---------- turn flow ---------- */
  function next() {
    if (S.players.every(q => q.shots >= shotsPerPlayer)) { finish(); return false; }
    // round robin; skip anyone who has finished
    do { S.cur = (S.cur + 1) % S.players.length; } while (player().shots >= shotsPerPlayer);
    beginTurn(S.players.length > 1);
    return true;
  }
  function beginTurn(announce) {
    const p = player(); p.shotPts = 0;
    S.phase = 'aim'; R.hit.disabled = false; renderHud();
    if (announce) {
      R.bannerName.textContent = `${p.name}`; R.bannerSub.textContent = `your turn · shot ${p.shots + 1} of ${shotsPerPlayer}`;
      R.banner.hidden = false; R.banner.classList.remove('go'); void R.banner.offsetWidth; R.banner.classList.add('go');
      setTimeout(() => { R.banner.hidden = true; }, 1600);
    }
    emit('turn', { player: p, index: S.cur, shot: p.shots });
  }

  /* ---------- start screen ---------- */
  function pickChallenges() {
    const avail = pool.filter(c => !c.only || c.only.includes(S.difficulty));
    const pick = [], a = avail.slice();
    while (pick.length < 3 && a.length) pick.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    return pick;
  }
  function renderStart() {
    const best = store.get(`best.${id}.${S.difficulty}`, null);
    R.startPanel.innerHTML = `
      <div class="mg-sTitle"><span class="lbl">Mini game</span><h1>${esc(title)}</h1><p>${esc(blurb)}</p></div>
      <div class="mg-sGrid">
        <div class="mg-sCol">
          <span class="lbl">Difficulty</span>
          <div class="mg-seg">${difficulties.map(d => `<button class="${d.id === S.difficulty ? 'on' : ''}" data-diff="${d.id}">${esc(d.label)}</button>`).join('')}</div>
          <p class="note">${esc(diffObj().note || '')}</p>
          <span class="lbl">Players</span>
          <div class="mg-players">${S.names.map((n, i) => `<div class="mg-pl"><input id="pl${i}" value="${esc(n)}" maxlength="14" aria-label="Player ${i + 1} name">${S.names.length > 1 ? `<button data-rm="${i}" aria-label="Remove player">×</button>` : ''}</div>`).join('')}
          ${S.names.length < 4 ? '<button class="mg-add" data-add>+ Add player</button>' : ''}</div>
        </div>
        <div class="mg-sCol">
          <span class="lbl">This run's challenges</span>
          <ul class="mg-chal">${S.challenges.map(c => `<li><i>★</i>${esc(c.text)}</li>`).join('')}</ul>
          ${rules.length ? `<span class="lbl">How it works</span><ul class="mg-rules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
          <p class="mg-best">${best ? `Best on ${esc(diffObj().label)}: <b class="num">${fmt(best.score)}</b> · ${'★'.repeat(best.stars || 0)}${'☆'.repeat(3 - (best.stars || 0))}` : `No best yet on ${esc(diffObj().label)}`}</p>
        </div>
      </div>
      <div class="mg-sBtns"><label class="mg-snd"><input type="checkbox" id="mgSound" ${sfx.on ? 'checked' : ''}> Sound</label><button class="mg-go" data-go>Start</button></div>`;
    const P = R.startPanel;
    P.querySelectorAll('[data-diff]').forEach(b => b.onclick = () => { S.difficulty = b.dataset.diff; store.set(`mg.${id}.diff`, S.difficulty); readNames(); S.challenges = pickChallenges(); renderStart(); });
    P.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { readNames(); S.names.splice(+b.dataset.rm, 1); renderStart(); });
    const add = P.querySelector('[data-add]'); if (add) add.onclick = () => { readNames(); S.names.push(`Player ${S.names.length + 1}`); renderStart(); };
    P.querySelector('#mgSound').onchange = e => { sfx.on = e.target.checked; };
    P.querySelector('[data-go]').onclick = () => { sfx.init(); readNames(); beginGame(); };
  }
  function readNames() {
    const ins = R.startPanel.querySelectorAll('.mg-pl input');
    if (ins.length) S.names = [...ins].map((el, i) => el.value.trim() || `Player ${i + 1}`);
  }
  function showStart() {
    S.phase = 'setup'; S.challenges = pickChallenges(); renderStart();
    R.endScr.hidden = true; R.startScr.hidden = false; R.play.hidden = true; R.result.hidden = true;
  }
  function beginGame(same) {
    store.set('players', S.names);
    S.players = S.names.map(name => ({ name, score: 0, shots: 0, streak: 0, stats: {}, done: [false, false, false], shotPts: 0 }));
    S.cur = 0; shownScore = 0; R.score.textContent = '0';
    R.startScr.hidden = true; R.endScr.hidden = true; R.play.hidden = false; R.result.hidden = true;
    emit('start', { difficulty: diffObj(), players: S.players });
    beginTurn(S.players.length > 1);
  }

  /* ---------- end screen ---------- */
  function finish() {
    S.phase = 'over'; R.play.hidden = true;
    const key = `best.${id}.${S.difficulty}`, best = store.get(key, null);
    const ranked = S.players.map((p, i) => ({ ...p, i, stars: p.done.filter(Boolean).length })).sort((a, b) => b.score - a.score);
    const top = ranked[0], newBest = !best || top.score > best.score;
    if (newBest || (best && top.stars > (best.stars || 0))) store.set(key, { score: Math.max(top.score, best ? best.score : 0), stars: Math.max(top.stars, best ? best.stars || 0 : 0), name: top.name });
    sfx.fanfare();
    R.endPanel.innerHTML = `
      <div class="mg-sTitle"><span class="lbl">${esc(title)} · ${esc(diffObj().label)}</span><h1>${S.players.length > 1 ? `${esc(top.name)} wins` : 'Round complete'}</h1>
      ${newBest ? '<div class="mg-newBest">NEW BEST!</div>' : best ? `<p>Best: <b class="num">${fmt(best.score)}</b>${best.name && S.players.length > 1 ? ' · ' + esc(best.name) : ''}</p>` : ''}</div>
      <ol class="mg-standings">${ranked.map((p, r) => `<li class="${r === 0 ? 'win' : ''}"><span class="pos">${r + 1}</span><span class="nm">${esc(p.name)}</span><span class="st">${'<i class="on">★</i>'.repeat(p.stars)}${'<i>★</i>'.repeat(3 - p.stars)}</span><b class="num">${fmt(p.score)}</b></li>`).join('')}</ol>
      <ul class="mg-chal done">${S.challenges.map((c, i) => `<li class="${S.players.some(p => p.done[i]) ? 'got' : ''}"><i>★</i>${esc(c.text)}${S.players.length > 1 ? ` <small>${S.players.filter(p => p.done[i]).map(p => esc(p.name)).join(', ')}</small>` : ''}</li>`).join('')}</ul>
      <div class="mg-sBtns"><a class="mg-ghost" href="games.html">Mini games</a><button class="mg-ghost" data-setup>Change setup</button><button class="mg-go" data-again>Play again</button></div>`;
    R.endPanel.querySelector('[data-again]').onclick = () => { S.challenges = pickChallenges(); beginGame(); };
    R.endPanel.querySelector('[data-setup]').onclick = showStart;
    R.endScr.hidden = false;
    emit('end', { ranked });
  }

  return {
    on(ev, f) { (handlers[ev] = handlers[ev] || []).push(f); return this; },
    showStart, award, stat, statMax, splash, soClose, toast, endShot, next, showResult, setClub,
    setPrompt(html) { R.prompt.innerHTML = html; },
    get phase() { return S.phase; }, set phase(v) { S.phase = v; R.hit.disabled = v !== 'aim'; },
    get player() { return player(); }, get players() { return S.players; },
    get multiplier() { return mult(); }, get difficulty() { return diffObj(); },
    get club() { return clubIdx; }, sfx, els: R,
  };
}
