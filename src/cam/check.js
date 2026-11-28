// cam-check.html: Stage 0 of the camera brief. One page that never reloads, so for this test it does what
// the PC app's hub will do: holds this device's camera and up to two phone cameras, pairs a phone with two
// QR scans, and shows what each delivers (frame rate, size, how evenly frames arrive, the link's numbers).
// Also: the R10 link and every shot it sends (does it report putts?), a 3 s recording test, a 3D load (does
// the device hold its frame rate with the streams up?), a latency clock and the drop test.
import { localCamera, cameraList, phoneOffer, scanQR, recordTest, CamCore as C, CamGrab as G } from './link.js';
import { launchMonitor, mountLaunchMonitorUI } from '../launch-monitor.js';
import { keepAwake } from '../wake.js';

const $ = id => document.getElementById(id);
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
const S = { local: null, phones: [], pairing: null, shots: [], recs: [], drops: [], pairings: [], load: null, pageWin: C.frameWindow(3000), caps: G.caps() };
window.__cam = S; // test hook

mountLaunchMonitorUI({ dot: $('lmDot'), text: $('lmText'), button: $('lmBtn'), compact: true });
keepAwake();

/* ---------- tiles ---------- */
function tile(src) {
  const el = document.createElement('section');
  el.className = 'tile'; el.dataset.id = src.id;
  el.innerHTML = `<div class="vid"></div><canvas class="ov" hidden></canvas>
    <div class="tile-head"><b class="lbl"></b><span class="tbtns">${src.kind === 'local' ? '<select class="dev" title="Camera"></select>' : ''}<button class="flip" title="Front / back">⟲</button><button class="close" title="Close">×</button></span></div>
    <dl class="nums"></dl>`;
  el.querySelector('.vid').appendChild(src.video);
  el.querySelector('.close').onclick = () => { src.close(); };
  el.querySelector('.flip').onclick = () => flip(src);
  $('tiles').appendChild(el);
  src.addEventListener('close', () => {
    el.remove();
    if (src === S.local) { S.local = null; $('startTile').hidden = false; }
    S.phones = S.phones.filter(p => p !== src);
  });
  if (src.kind === 'local') fillDevices(el.querySelector('.dev'), src);
  return el;
}
async function fillDevices(sel, src) {
  const list = await cameraList(), cur = src.settings().deviceId;
  sel.innerHTML = list.map((d, i) => `<option value="${d.deviceId}"${d.deviceId === cur ? ' selected' : ''}>${(d.label || 'Camera ' + (i + 1)).slice(0, 28)}</option>`).join('');
  sel.hidden = list.length < 2;
  sel.onchange = () => src.open({ deviceId: sel.value }).then(() => fillDevices(sel, src)).catch(e => toast(e.message));
}
function flip(src) {
  if (src.kind === 'phone') return src.flip();
  const to = src.facing === 'environment' ? 'user' : 'environment';
  src.open({ facing: to }).then(() => fillDevices(document.querySelector(`[data-id="${src.id}"] .dev`), src)).catch(e => toast(e.message));
}
const how = m => (m === 'callback' ? 'exact' : m === 'counter' ? '±16 ms (counter)' : m === 'pixels' ? '±16 ms (pixels)' : '–');
function rows(list) { return list.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join(''); }
async function renderTile(src) {
  const el = document.querySelector(`[data-id="${src.id}"]`);
  if (!el) return;
  const st = await src.stats(), f = st.frames, set = st.settings || {};
  el.querySelector('.lbl').textContent = src.kind === 'local' ? `This device${src.facing ? ' · ' + (src.facing === 'user' ? 'front' : 'back') : ''}` : src.label;
  let r;
  if (src.kind === 'local') {
    r = [['Frames', `${fmt(f.fps)} fps · ${st.w || '–'}×${st.h || '–'}${set.frameRate ? ` (asked 60, set ${fmt(set.frameRate, 0)})` : ''}`],
      ['Timing', how(st.method)], ['Intervals', `sd ${fmt(f.sd)} · p95 ${fmt(f.p95, 0)} · max ${fmt(f.max, 0)} ms`], ['Missed', f.n ? `${f.gaps} of ${f.n}` : '–']];
  } else {
    const p = st.phone, rc = st.recv || {};
    r = [['Link', st.state + (rc.path ? ' · ' + rc.path : '')]];
    if (p) {
      r.push(['On the phone', `${fmt(p.fps)} fps · ${p.w}×${p.h} · ${p.facing === 'user' ? 'front' : 'back'}${p.set?.frameRate ? ` (set ${fmt(p.set.frameRate, 0)})` : ''}`],
        ['Phone timing', `${how(p.method)} · sd ${fmt(p.sd)} · p95 ${fmt(p.p95, 0)} ms · missed ${p.gaps}/${p.n}`]);
      if (p.out) r.push(['Phone sends', `${fmt(p.out.fps)} fps · ${fmt(p.out.kbps, 0)} kbit/s${p.out.limit && p.out.limit !== 'none' ? ' · held back: ' + p.out.limit : ''}`]);
    }
    r.push(['Arrives', `${fmt(rc.fps)} fps · ${rc.w || st.w || '–'}×${rc.h || st.h || '–'} · ${rc.codec || '–'} · ${fmt(rc.kbps, 0)} kbit/s`],
      ['Here', `dropped ${rc.dropped ?? '–'} · lost ${rc.lost ?? '–'} · buffer ${fmt(rc.jitterMs, 0)} ms · rtt ${fmt(rc.rttMs, 0)} ms`],
      ['Shown', `${fmt(f.fps)} fps · sd ${fmt(f.sd)} ms · ${how(st.method)}`]);
    if (st.clock && Number.isFinite(st.clock.rtt)) r.push(['Clocks', `phone ${st.clock.offset >= 0 ? '+' : ''}${fmt(st.clock.offset, 0)} ms (±${fmt(st.clock.rtt / 2, 0)})`]);
    if (st.drop?.fit?.ok) r.push(['Drop test', `g ${fmt(st.drop.fit.g, 2)} (${st.drop.fit.err >= 0 ? '+' : ''}${fmt(100 * st.drop.fit.err, 1)}%) · ±${fmt(st.drop.fit.rmsMs, 1)} ms`]);
    if (src.connectedMs) r.push(['Paired in', `${fmt(src.connectedMs / 1000, 1)} s from the QR`]);
  }
  el.querySelector('.nums').innerHTML = rows(r);
}
setInterval(() => { for (const s of [S.local, ...S.phones]) if (s) renderTile(s); }, 1000);

/* ---------- this device's camera ---------- */
async function startLocal() {
  if (S.local) return S.local;
  $('localErr').textContent = '';
  try {
    S.local = await localCamera({ facing: 'user' }); // a phone or laptop on its stand faces the golfer
    $('startTile').hidden = true;
    tile(S.local);
    return S.local;
  } catch (e) {
    $('localErr').textContent = e?.name === 'NotAllowedError' ? 'Camera access was refused. Allow it for this site in the browser settings.' : (e?.message || String(e));
    throw e;
  }
}
$('btnLocal').onclick = () => startLocal().catch(() => {});

/* ---------- pairing a phone ---------- */
function drawQR(canvas, text, side, level = 'M') {
  const qr = qrcode(0, level); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 4, cell = Math.max(2, Math.floor(side / (n + 2 * q))), px = cell * (n + 2 * q), dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = px * dpr; canvas.height = px * dpr; canvas.style.width = px + 'px'; canvas.style.height = px + 'px';
  const cx = canvas.getContext('2d'); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, px, px); cx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) cx.fillRect((c + q) * cell, (r + q) * cell, cell, cell);
  return n;
}
async function addPhone() {
  if (S.phones.length >= 2) return toast('Two phone cameras at most.');
  if (S.pairing) { open('pairSheet'); return; }
  open('pairSheet');
  $('pairState').textContent = 'Starting this device\'s camera (it reads the phone\'s code)…';
  try { await startLocal(); } catch (e) { $('pairState').textContent = 'This device\'s camera is needed to read the phone\'s code: ' + $('localErr').textContent + ' You can still paste the code (below).'; }
  $('pairState').textContent = 'Making the code…';
  const p = S.pairing = await phoneOffer();
  const side = Math.min(innerHeight - 140, innerWidth * 0.42, 420);
  const mods = drawQR($('offerQR'), p.link, Math.max(150, side), 'L');
  $('offerLink').value = p.link;
  const t0 = performance.now(), cam = p.camera;
  const rec = { at: new Date().toISOString(), linkChars: p.link.length, qrModules: mods, offerChars: p.code.length };
  S.pairings.push(rec);
  $('pairState').textContent = 'Waiting for the phone…' + (S.local ? ' Reading codes from this device\'s camera.' : '');
  const done = text => {
    if (S.pairing !== p) return;
    if (!p.mine(text)) { $('pairState').textContent = 'That\'s an old code from the phone. Scan the code on this screen again, then hold the phone up.'; return false; }
    link(text);
  };
  const link = async text => {
    stopScan();
    $('pairState').textContent = 'Linking…';
    try {
      await p.accept(text);
      rec.answerAfterMs = performance.now() - t0;
      const on = () => {
        if (cam.connectedMs) return;
        cam.connectedMs = performance.now() - t0; rec.videoAfterMs = cam.connectedMs;
        S.phones.push(cam); tile(cam); S.pairing = null; close('pairSheet'); toast('Phone camera linked');
      };
      cam.video.addEventListener('loadeddata', on, { once: true });
      if (cam.video.readyState >= 2) on();
      cam.addEventListener('state', e => { if (e.detail === 'failed') { $('pairState').textContent = 'The link failed (the phone and this device may not reach each other on this network). Close and try again; a phone hotspot is worth a try.'; rec.failed = true; S.pairing = null; } });
    } catch (e) { $('pairState').textContent = e.message; rec.error = e.message; }
  };
  const stopScan = S.local ? scanQR(S.local, done) : () => {};
  p.stopScan = stopScan; p.done = done;
  return p;
}
$('btnPhone').onclick = () => addPhone().catch(e => { $('pairState').textContent = e.message; });
$('answerGo').onclick = () => { if (S.pairing?.done($('answerIn').value.trim()) === false) $('answerIn').select(); };

/* ---------- sheets, toast ---------- */
function open(id) { $(id).hidden = false; }
function close(id) {
  $(id).hidden = true;
  if (id === 'pairSheet' && S.pairing && !S.pairing.camera.connectedMs) { S.pairing.stopScan?.(); S.pairing.cancel(); S.pairing = null; }
}
for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => close(b.dataset.close);
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

/* ---------- R10 shots ---------- */
launchMonitor.addEventListener('shot', e => {
  const s = e.detail;
  S.shots.unshift({ at: new Date().toLocaleTimeString(), Speed: s.Speed, VLA: s.VLA, HLA: s.HLA, TotalSpin: s.TotalSpin, club: s.Club?.Speed ?? null, source: s.Meta?.source || '' });
  S.shots.length = Math.min(S.shots.length, 30);
  $('shotN').textContent = S.shots.length;
  $('shotRows').innerHTML = S.shots.map(r => `<tr><td>${r.at}</td><td>${fmt(r.Speed)}</td><td>${fmt(r.VLA)}</td><td>${fmt(r.HLA)}</td><td>${fmt(r.TotalSpin, 0)}</td><td>${fmt(r.club)}</td><td>${r.source}</td></tr>`).join('');
  toast(`R10: ${fmt(s.Speed)} mph`);
});
$('btnShots').onclick = () => open('shotSheet');

/* ---------- recording ---------- */
$('btnRec').onclick = async () => {
  const src = S.local || S.phones[0];
  open('recSheet');
  if (!src) { $('recBody').innerHTML = '<p>Start a camera first.</p>'; return; }
  $('recBody').innerHTML = `<p>Recording ${src.kind === 'local' ? 'this device\'s camera' : src.label} for 3 s…</p>`;
  const r = await recordTest(src, 3000);
  S.recs.push({ source: src.kind, ok: r.ok, type: r.type, bytes: r.bytes, kbps: r.kbps, why: r.why });
  $('recBody').innerHTML = r.ok
    ? `<p>${r.type} · ${fmt(r.bytes / 1024, 0)} kB · ${fmt(r.kbps, 0)} kbit/s</p><video src="${r.url}" controls playsinline muted></video>`
    : `<p>Couldn't record: ${r.why}.</p>`;
};

/* ---------- 3D load ---------- */
function script(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); }); }
async function toggleLoad() {
  const b = $('btnLoad');
  if (S.load) { S.load.on = !S.load.on; $('load').hidden = !S.load.on; b.setAttribute('aria-pressed', String(S.load.on)); return; }
  b.textContent = 'Loading…';
  try {
    if (!self.THREE) { await script('vendor/three-r147/three.min.js'); await script('vendor/three-r147/Sky.js'); }
    const { createPracticeGround } = await import('../world/practice-ground.js');
    const world = createPracticeGround($('load'));
    const { renderer, scene, camera } = world;
    camera.position.set(0, 1.6, 3.2); camera.lookAt(0, 1.2, -60);
    const size = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
    size(); addEventListener('resize', size);
    S.load = { on: true };
    const loop = () => { requestAnimationFrame(loop); if (!S.load.on) return; world.tick?.(performance.now() / 1000); renderer.render(scene, camera); };
    loop();
    b.textContent = '3D load'; b.setAttribute('aria-pressed', 'true');
  } catch (e) { b.textContent = '3D load'; toast('3D load: ' + e.message); }
}
$('btnLoad').onclick = toggleLoad;

/* ---------- page frame rate, latency clock ---------- */
let clockOn = false;
(function frame(t) {
  requestAnimationFrame(frame);
  S.pageWin.push(t);
  if (clockOn) $('clockMs').textContent = String(Math.floor(performance.now()) % 100000).padStart(5, '0');
})(performance.now());
setInterval(() => { const f = S.pageWin.stats(); $('pageFps').textContent = `${fmt(f.fps, 0)} fps`; }, 1000);
$('btnClock').onclick = () => { clockOn = !clockOn; $('clock').hidden = !clockOn; $('btnClock').setAttribute('aria-pressed', String(clockOn)); };

/* ---------- drop test on this device's camera ---------- */
let tap = null;
function vidPoint(src, ev) {
  const v = src.video, r = v.getBoundingClientRect(), s = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
  return { x: (ev.clientX - r.left - (r.width - v.videoWidth * s) / 2) / s, y: (ev.clientY - r.top - (r.height - v.videoHeight * s) / 2) / s };
}
function overlay(src, pts, track) {
  const el = document.querySelector(`[data-id="${src.id}"]`); if (!el) return;
  const ov = el.querySelector('.ov'), v = src.video, r = v.getBoundingClientRect(), er = el.getBoundingClientRect();
  ov.hidden = false; ov.width = er.width; ov.height = er.height;
  const cx = ov.getContext('2d'), s = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
  const ox = r.left - er.left + (r.width - v.videoWidth * s) / 2, oy = r.top - er.top + (r.height - v.videoHeight * s) / 2;
  cx.clearRect(0, 0, ov.width, ov.height); cx.fillStyle = '#ffd166'; cx.strokeStyle = '#2ec4a6'; cx.lineWidth = 2;
  for (const p of pts || []) { cx.beginPath(); cx.arc(ox + p.x * s, oy + p.y * s, 6, 0, 7); cx.fill(); }
  if (track?.length) { cx.beginPath(); track.forEach((p, i) => (i ? cx.lineTo : cx.moveTo).call(cx, ox + p.x * s, oy + p.y * s)); cx.stroke(); }
}
function dropStep(step) {
  const src = S.local, b = $('dropBody');
  open('dropSheet');
  if (!src) { b.innerHTML = '<p>Start this device\'s camera first.</p>'; return; }
  const el = document.querySelector(`[data-id="${src.id}"]`), ov = el.querySelector('.ov');
  if (step === 'scale') {
    tap = { pts: [] };
    b.innerHTML = `<p>Hold a tape measure upright where you'll drop the ball. Tap its <b>0</b> mark, then the mark <input id="dropCm" type="number" value="100" min="20" max="200"> cm up, on this device's picture.</p><p class="dim small">Or <button id="dropSkip" class="link">skip</button>: the ball's own size sets the scale (rougher).</p><p id="dropTaps" class="dim small">0 of 2 taps</p>`;
    $('dropSkip').onclick = () => { tap = null; dropStep('ready'); };
    overlay(src, [], null);
    ov.onclick = ev => {
      if (!tap) return;
      tap.pts.push(vidPoint(src, ev)); overlay(src, tap.pts, null);
      $('dropTaps').textContent = `${tap.pts.length} of 2 taps`;
      if (tap.pts.length === 2) { tap.pxPerM = Math.hypot(tap.pts[1].x - tap.pts[0].x, tap.pts[1].y - tap.pts[0].y) / ((parseFloat($('dropCm').value) || 100) / 100); setTimeout(() => dropStep('ready'), 300); }
    };
  } else if (step === 'ready') {
    ov.onclick = null;
    b.innerHTML = '<p>Hold the ball still at chest height in front of something <b>darker than the ball</b>. Press Go and drop it on "Drop".</p><button id="dropGo" class="go">Go</button>';
    $('dropGo').onclick = () => {
      let n = 3;
      const count = () => {
        if (n > 0) { b.innerHTML = `<p class="huge">${n--}</p>`; setTimeout(count, 700); return; }
        b.innerHTML = '<p class="huge">Drop</p>';
        G.dropTest(src.video, { ms: 3000, pxPerM: tap?.pxPerM || 0, onFrame: t => overlay(src, tap?.pts, t) }).then(r => {
          S.drops.push({ source: 'local', fit: r.fit, fitSteady: r.fitSteady, steady: r.steady, method: r.method, scaleFrom: r.scaleFrom, w: r.w, h: r.h, track: r.track.map(p => [Math.round(p.t), +p.y.toFixed(1)]) });
          const f = r.fit;
          b.innerHTML = (f.ok ? `<ul><li>g = <b>${fmt(f.g, 2)}</b> m/s² (true 9.81: ${f.err >= 0 ? '+' : ''}${fmt(100 * f.err, 1)}%)</li><li>${f.frames} frames in the air over ${fmt(f.flightMs, 0)} ms</li><li>Frame times off the curve ±${fmt(f.rmsMs, 1)} ms</li>${r.fitSteady?.ok ? `<li>On the camera's steady clock: g ${fmt(r.fitSteady.g, 2)} (${r.fitSteady.err >= 0 ? '+' : ''}${fmt(100 * r.fitSteady.err, 1)}%), ±${fmt(r.fitSteady.rmsMs, 1)} ms</li>` : ''}<li>Scale from ${r.scaleFrom === 'tape' ? 'the tape' : 'the ball'} · frames ${r.method} · ${r.w}×${r.h}</li></ul>`
            : `<p>No fit: ${f.why}. Ball seen in ${r.track.length} frames: try a darker backdrop or more light.</p>`) + '<button id="dropAgain">Again</button>';
          $('dropAgain').onclick = () => dropStep('ready');
        });
      };
      count();
    };
  }
}
$('btnDrop').onclick = () => dropStep('scale');

/* ---------- report ---------- */
$('btnReport').onclick = async () => {
  const srcs = [];
  for (const s of [S.local, ...S.phones]) if (s) srcs.push(await s.stats());
  const rep = {
    at: new Date().toISOString(), page: location.pathname, ua: navigator.userAgent, screen: [innerWidth, innerHeight, devicePixelRatio],
    caps: S.caps, pageFps: S.pageWin.stats(), load3d: !!S.load?.on, r10: { source: launchMonitor.source, status: launchMonitor.status },
    sources: srcs, pairings: S.pairings, recordings: S.recs, drops: S.drops, shots: S.shots
  };
  const text = JSON.stringify(rep, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v), 1);
  $('reportText').value = text;
  open('reportSheet');
  try { await navigator.clipboard.writeText(text); $('reportMsg').textContent = 'Copied. Paste it into the chat.'; }
  catch (e) { $('reportMsg').textContent = 'Couldn\'t copy by itself: select the text and copy it.'; }
};

// The camera list's labels only show after permission; ask quietly if we already have it.
navigator.permissions?.query({ name: 'camera' }).then(p => { if (p.state === 'granted') startLocal().catch(() => {}); }).catch(() => {});
