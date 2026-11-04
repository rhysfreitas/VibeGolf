// The simulated-shot tool, shared by every mode (mini games, range, course). One small button
// opens a fly-out with: club (Auto follows the game's suggestion), Normal / Punch / Stinger, a shape
// line you drag left or right, and Ideal (the exact shot) / Hit (with a decent amateur's misses).
// It stays out of the way so the screen looks like it does with an R10: shots from the R10 never
// use these settings.
//
//   const tool = createSimTool(parent, { clubs, onShot: s => ... });
//   tool.suggest({ club, axis, traj })   // the game's recommendation for this shot
//   tool.setTarget({ x, z, label })       // a spot picked on a map, for the next shot only
//   s = { club, traj, axis, ideal, target, clubAuto, axisAuto, autoAim }
//
// Auto-aim (the small crosshair beside the pill, off by default and remembered): on, the
// simulated shot aims itself at the target; off, it flies down the phantom aim line you drag
// left or right in the view (src/aim-line.js).

export const TRAJ = [
  { id: 'normal', name: 'Normal' },
  { id: 'punch', name: 'Punch' },
  { id: 'stinger', name: 'Stinger' },
];
const AXIS_MAX = 24; // degrees of spin axis at the ends of the shape line (− draw · + fade)

export function shapeName(axis) {
  const a = Math.abs(axis), side = axis < 0 ? 'draw' : 'fade';
  if (a < 1.5) return 'Straight';
  if (a >= 16) return axis < 0 ? 'Hook' : 'Slice';
  return `${a < 6 ? 'Little ' + side : side[0].toUpperCase() + side.slice(1)}`;
}

const AIM_KEY = 'vibegolf.autoAim';
const readAim = () => { try { return localStorage.getItem(AIM_KEY) === '1'; } catch (e) { return false; } };
const saveAim = v => { try { localStorage.setItem(AIM_KEY, v ? '1' : '0'); } catch (e) { /* storage blocked */ } };

export function createSimTool(parent, { clubs = [], onShot = () => {}, onTarget = () => {}, onChange = () => {}, auto = true, aimToggle = true, note = 'Your R10 shots fly exactly as you hit them; these settings are only for simulated shots.', extra = null } = {}) {
  const el = document.createElement('div');
  el.className = 'st';
  el.innerHTML = `
    <button class="st-btn" type="button" aria-expanded="false" title="Simulated shot">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20c3-1 5-4 7-8s4-6 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 3.6"/><circle cx="19" cy="5" r="2.4" fill="currentColor"/></svg>
      <span class="st-sum"></span>
    </button>
    <button class="st-aim" type="button" aria-pressed="false" title="Auto-aim: simulated shots aim themselves at the target. Off: they follow the aim line you drag in the view.">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle class="st-aimDot" cx="12" cy="12" r="2" fill="currentColor"/></svg>
      <span>Auto</span>
    </button>
    <aside class="st-panel" hidden aria-label="Simulated shot">
      <header><span>Simulated shot</span><button class="st-x" type="button" aria-label="Close">×</button></header>
      <div class="st-target" hidden><span></span><button type="button" class="st-clear" aria-label="Clear the map spot">×</button></div>
      <div class="st-clubs" role="group" aria-label="Club"></div>
      <div class="st-seg" role="group" aria-label="Trajectory"></div>
      <div class="st-shape">
        <svg viewBox="0 0 220 74" aria-label="Shot shape: drag left or right" role="slider" tabindex="0">
          <line class="st-mid" x1="110" y1="68" x2="110" y2="8"/>
          <path class="st-sugg"/>
          <path class="st-path"/>
          <circle class="st-ball" cx="110" cy="66" r="3.4"/>
          <circle class="st-flag" cx="110" cy="9" r="3.4"/>
          <circle class="st-knob" r="9"/>
        </svg>
        <div class="st-shapeRow"><span class="st-shapeName"></span><button type="button" class="st-reset" hidden>Reset</button></div>
      </div>
      <div class="st-extra"></div>
      <div class="st-go"><button type="button" class="st-ideal" title="The exact shot, no misses">Ideal</button><button type="button" class="st-hit" title="A decent amateur's swing: it misses a little">Hit</button></div>
      <p class="st-note">${note}</p>
    </aside>`;
  parent.appendChild(el);
  const $ = s => el.querySelector(s);
  const btn = $('.st-btn'), panel = $('.st-panel'), sum = $('.st-sum');
  if (extra) $('.st-extra').appendChild(extra);

  const S = { club: null, traj: 'normal', axis: null, target: null, sugg: { club: 0, axis: 0 }, enabled: true, autoAim: readAim() };
  const aimBtn = $('.st-aim'); aimBtn.hidden = !aimToggle;
  aimBtn.onclick = () => setAutoAim(!S.autoAim);
  function setAutoAim(v) { if (S.autoAim === !!v) return; S.autoAim = !!v; saveAim(S.autoAim); changed(); }
  const club = () => (S.club ?? S.sugg.club);
  const axis = () => (S.axis ?? S.sugg.axis ?? 0);

  /* clubs: Auto (the suggestion) + every club */
  const cw = $('.st-clubs');
  const mkClub = (label, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'st-club'; b.textContent = label; b.onclick = () => { S.club = i; changed(); }; cw.appendChild(b); return b; };
  const autoBtn = mkClub('Auto', null); autoBtn.hidden = !auto;
  const clubBtns = clubs.map((c, i) => { const b = mkClub(c.id, i); b.title = c.name; return b; });
  /* trajectory */
  const sw = $('.st-seg');
  const trajBtns = TRAJ.map(t => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t.name; b.onclick = () => { S.traj = t.id; changed(); }; sw.appendChild(b); return b; });
  /* the shape line: drag anywhere on it, left or right */
  const svg = $('.st-shape svg');
  const curve = a => { const cx = 110 - (a / AXIS_MAX) * 92; return `M110 66 Q ${cx.toFixed(1)} 37 110 9`; };
  const knobX = a => 110 - (a / AXIS_MAX) * 46;
  let drag = false;
  const fromEvent = e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 220; let a = -(x - 110) / 46 * AXIS_MAX; a = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, a)); if (Math.abs(a) < 1.2) a = 0; return Math.round(a * 2) / 2; };
  svg.addEventListener('pointerdown', e => { drag = true; svg.setPointerCapture(e.pointerId); S.axis = fromEvent(e); render(); });
  svg.addEventListener('pointermove', e => { if (drag) { S.axis = fromEvent(e); render(); } });
  svg.addEventListener('pointerup', () => { if (drag) { drag = false; changed(); } });
  svg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); S.axis = Math.max(-AXIS_MAX, Math.min(AXIS_MAX, axis() + (e.key === 'ArrowLeft' ? 1 : -1))); changed(); } });
  $('.st-reset').onclick = () => { S.axis = null; changed(); };
  $('.st-clear').onclick = () => { S.target = null; render(); onTarget(null); };

  function settings() { return { club: club(), traj: S.traj, axis: axis(), target: S.target, clubAuto: S.club == null, axisAuto: S.axis == null, autoAim: S.autoAim }; }
  function changed() { render(); onChange(settings()); }
  function render() {
    const ci = club(), a = axis();
    autoBtn.setAttribute('aria-pressed', String(S.club == null && auto));
    autoBtn.textContent = clubs[S.sugg.club] ? `Auto · ${clubs[S.sugg.club].id}` : 'Auto';
    clubBtns.forEach((b, i) => { b.setAttribute('aria-pressed', String(S.club === i || (!auto && S.club == null && i === S.sugg.club))); b.classList.toggle('sugg', auto && i === S.sugg.club); });
    trajBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(TRAJ[i].id === S.traj)));
    aimBtn.setAttribute('aria-pressed', String(S.autoAim));
    $('.st-path').setAttribute('d', curve(a));
    $('.st-sugg').setAttribute('d', curve(S.sugg.axis || 0));
    $('.st-sugg').style.display = S.axis != null && Math.abs((S.sugg.axis || 0) - a) > 0.4 ? '' : 'none';
    const k = $('.st-knob'); k.setAttribute('cx', knobX(a).toFixed(1)); k.setAttribute('cy', 37);
    svg.setAttribute('aria-valuenow', String(a)); svg.setAttribute('aria-valuetext', shapeName(a));
    $('.st-shapeName').textContent = `${shapeName(a)}${Math.abs(a) >= 1.5 ? ` · ${Math.abs(a)}°` : ''}`;
    $('.st-reset').hidden = S.axis == null;
    const tg = $('.st-target'); tg.hidden = !S.target; if (S.target) tg.querySelector('span').textContent = S.target.label || 'Aiming at your spot';
    const tr = S.traj === 'normal' ? '' : ` · ${TRAJ.find(t => t.id === S.traj).name}`;
    sum.innerHTML = `<b>${clubs[ci] ? clubs[ci].id : ''}</b>${tr}${Math.abs(a) >= 1.5 ? ` · ${shapeName(a)}` : ''}${S.target ? ' · spot' : ''}`;
  }
  function open(v = panel.hidden) { panel.hidden = !v; btn.setAttribute('aria-expanded', String(v)); el.classList.toggle('open', v); }
  btn.onclick = () => open();
  $('.st-x').onclick = () => open(false);
  const shoot = ideal => {
    if (!S.enabled) return;
    const s = { ...settings(), ideal };
    const had = !!S.target; S.target = null; open(false); render();
    if (had) onTarget(null);
    onShot(s);
  };
  $('.st-ideal').onclick = () => shoot(true);
  $('.st-hit').onclick = () => shoot(false);
  render();

  return {
    el, open, shoot,
    // the game's recommendation for this shot (Auto follows it; a club you picked stays picked)
    suggest({ club: c = S.sugg.club, axis: a = 0 } = {}) { S.sugg = { club: c, axis: a }; render(); },
    setTarget(t) { S.target = t; render(); onTarget(t); },
    clearTarget() { if (S.target) { S.target = null; render(); onTarget(null); } },
    setEnabled(v) { S.enabled = v; $('.st-hit').disabled = $('.st-ideal').disabled = !v; el.classList.toggle('busy', !v); },
    get settings() { return settings(); },
    get autoAim() { return S.autoAim; }, setAutoAim,
    setClub(i) { S.club = i; render(); },        // the page picked a club (e.g. a keyboard shortcut); null = Auto
    get club() { return club(); },
    get isOpen() { return !panel.hidden; },
    render,
  };
}
