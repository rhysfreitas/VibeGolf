// Headless check of the camera link (Stage 0): node tools/cam/check.mjs [outDir]
// Two Chromium contexts with fake cameras play the game device (cam-check.html) and the camera phone
// (camera.html). The phone opens the link from the game's QR code exactly as the Camera app would; its
// answer QR is shown to the game device's camera (the game's fake camera is swapped for a picture of the
// phone's screen), read by scanQR, and the two link. Then: video and the phone's numbers arrive, the
// R10 shot log (fake R10), the recording test, the 3D load, the report; screenshots at 844×390, 667×375
// and 1280×800, and the camera page at phone sizes. Writes report.json and PNGs to outDir.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname), REPO = path.resolve(HERE, '../..');
const OUT = process.argv[2] || path.join(REPO, 'tools/review/out/cam');
fs.mkdirSync(OUT, { recursive: true });
const FAKE_R10 = fs.readFileSync(path.join(REPO, 'tools/r10/fake-r10.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// localhost, so the page is a secure context (cameras and WebRTC need one)
async function open(url, { width, height, init = '', mobile = false }) {
  const ctx = await b.newContext({ viewport: { width, height }, permissions: ['camera'], hasTouch: mobile, isMobile: mobile });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(60000);
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/fetching the script/.test(m.text())) errs.push('console: ' + m.text()); }); // (sw.js is left out here)
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'localhost') return r.fulfill({ body: '', contentType: 'text/css' });
    if (u.pathname.endsWith('sw.js')) return r.fulfill({ status: 404, body: '' });
    const f = path.join(REPO, decodeURIComponent(u.pathname));
    try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
  });
  if (init) await pg.addInitScript(init);
  await pg.goto(url);
  return { pg, errs, ctx };
}
const R = { errors: {} };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1. the game device: start its camera, add a phone
const hub = await open('http://localhost/cam-check.html', { width: 1280, height: 800, init: `window.__lowq = true;\n${FAKE_R10}` });
await hub.pg.waitForTimeout(1500);
if (await hub.pg.$eval('#startTile', e => !e.hidden)) await hub.pg.click('#btnLocal'); // with permission already given it starts by itself
await hub.pg.waitForFunction(() => window.__cam.local && window.__cam.local.video.videoWidth > 0);
await hub.pg.click('#btnPhone');
await hub.pg.waitForFunction(() => window.__cam.pairing && document.getElementById('offerLink').value.includes('#o='));
const link = await hub.pg.$eval('#offerLink', e => e.value);
R.offerLink = link.length;
await wait(500);
await hub.pg.screenshot({ path: `${OUT}/hub-1280-pair.png` });

// 2. the camera phone opens the link (as the Camera app would), shows its answer QR
const phone = await open(link, { width: 375, height: 667, mobile: true });
await phone.pg.waitForFunction(() => !document.getElementById('qrBox').hidden, null, { timeout: 30000 });
R.answer = await phone.pg.$eval('#codeText', e => e.value);
await phone.pg.screenshot({ path: `${OUT}/camera-375-qr.png` });
const qrPng = await phone.pg.$eval('#qr', c => c.toDataURL('image/png'));

// 3. show the phone's screen to the game device's camera: its fake feed becomes a picture of the QR
await hub.pg.evaluate(async src => {
  const img = new Image(); img.src = src; await img.decode();
  const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720;
  const cx = cv.getContext('2d');
  const draw = () => { cx.fillStyle = '#556'; cx.fillRect(0, 0, 1280, 720); const s = 520; cx.drawImage(img, 640 - s / 2 + 60, 360 - s / 2, s, s); };
  draw(); setInterval(draw, 100);
  window.__cam.local.video.srcObject = cv.captureStream(15);
  window.__cam.local.video.play();
}, qrPng);
await hub.pg.waitForFunction(() => window.__cam.phones.length === 1, null, { timeout: 30000 });
const tQR = await hub.pg.evaluate(() => window.__cam.pairings[0]);
R.pairing = tQR;
await phone.pg.waitForFunction(() => !document.getElementById('live').hidden, null, { timeout: 20000 });
await wait(4500);
R.hubAfterPair = await hub.pg.evaluate(async () => {
  const p = window.__cam.phones[0], st = await p.stats();
  return { state: st.state, w: st.w, h: st.h, recvFps: st.recv && st.recv.fps, codec: st.recv && st.recv.codec, phoneFps: st.phone && st.phone.fps, method: st.phone && st.phone.method, clock: st.clock, label: p.label, tileText: document.querySelector(`[data-id="${p.id}"] .nums`).innerText };
});
R.phoneLive = await phone.pg.evaluate(() => ({ link: document.getElementById('linkText').textContent, stats: document.getElementById('stats').innerText }));
await phone.pg.setViewportSize({ width: 667, height: 375 }); await wait(1200);
await phone.pg.screenshot({ path: `${OUT}/camera-667-live.png` });

// 4. flip command, R10 shot log, recording, 3D load, report
await hub.pg.evaluate(() => window.__cam.phones[0].flip()); await wait(2500);
R.afterFlip = await hub.pg.evaluate(() => window.__cam.phones[0].remote && window.__cam.phones[0].remote.facing);
await hub.pg.evaluate(() => document.getElementById('lmBtn').click()); await wait(200);
await hub.pg.click('#lmBle');
await hub.pg.waitForFunction(() => document.getElementById('lmText').textContent === 'R10 live', null, { timeout: 20000 });
await hub.pg.evaluate(() => document.getElementById('lmBtn').click());
await hub.pg.evaluate(() => window.__fakeR10.shot(7)); await wait(800);
await hub.pg.click('#btnShots'); await wait(200);
R.shotRows = await hub.pg.$$eval('#shotRows tr', t => t.map(r => r.innerText));
await hub.pg.screenshot({ path: `${OUT}/hub-1280-shots.png` });
await hub.pg.click('#shotSheet [data-close]');
await hub.pg.click('#btnRec'); await wait(3800);
R.recording = await hub.pg.$eval('#recBody', e => e.innerText);
await hub.pg.click('#recSheet [data-close]');
await hub.pg.click('#btnLoad'); await hub.pg.waitForFunction(() => document.getElementById('btnLoad').getAttribute('aria-pressed') === 'true', null, { timeout: 120000 });
await wait(3000);
R.pageFpsWithLoad = await hub.pg.$eval('#pageFps', e => e.textContent);
await hub.pg.click('#btnClock'); await wait(300);
await hub.pg.screenshot({ path: `${OUT}/hub-1280-live.png` });
await hub.pg.click('#btnClock');
for (const [w, h] of [[844, 390], [667, 375]]) {
  await hub.pg.setViewportSize({ width: w, height: h }); await wait(1500);
  await hub.pg.screenshot({ path: `${OUT}/hub-${w}-live.png` });
  R['overflow' + w] = await hub.pg.evaluate(() => [...document.querySelectorAll('.nums')].map(n => n.scrollHeight > n.parentElement.clientHeight * 0.75));
}
await hub.pg.click('#btnPhone'); await wait(2500);
await hub.pg.screenshot({ path: `${OUT}/hub-844-pair.png` });
await hub.pg.click('#pairSheet [data-close]');
await hub.pg.setViewportSize({ width: 1280, height: 800 });
await hub.pg.evaluate(() => { navigator.clipboard.writeText = async () => {}; });
await hub.pg.click('#btnReport'); await wait(800);
const rep = JSON.parse(await hub.pg.$eval('#reportText', e => e.value));
R.report = { sources: rep.sources.map(s => s.kind), pairings: rep.pairings.length, shots: rep.shots.length, caps: rep.caps };

// 5. the camera page alone (no offer): intro, the standalone test, and the drop test. A drawn ball dropped
// 1.0 m at 400 px per metre replaces the camera, timed by the clock: the whole drop test (frame times, ball
// finder, fit) should read g back. Run three ways: with requestVideoFrameCallback, then without it (as on
// iOS 12: the frame counter), then without either (the pixel-change fallback).
const NO_RVFC = 'delete HTMLVideoElement.prototype.requestVideoFrameCallback;';
const NO_COUNT = NO_RVFC + " delete HTMLVideoElement.prototype.getVideoPlaybackQuality; Object.defineProperty(HTMLVideoElement.prototype, 'webkitDecodedFrameCount', { get() { return undefined; } });";
const soloErrs = [];
for (const [name, init] of [['callback', ''], ['counter', NO_RVFC], ['pixels', NO_COUNT]]) {
  const solo = await open('http://localhost/camera.html', { width: 667, height: 375, mobile: true, init });
  await wait(500);
  if (name === 'callback') await solo.pg.screenshot({ path: `${OUT}/camera-667-intro.png` });
  await solo.pg.click('#btnSolo');
  await solo.pg.waitForFunction(() => !document.getElementById('live').hidden);
  await solo.pg.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = 1280; cv.height = 720; const cx = cv.getContext('2d');
    const PPM = 400, R = 0.04267 / 2 * PPM, y0 = 150, H = 1.0;
    const draw = () => {
      const t = performance.now(); let y = y0;
      if (window.__dropAt) { const dt = (t - window.__dropAt) / 1000; y = Math.min(y0 + 0.5 * 9.81 * dt * dt * PPM, y0 + H * PPM); }
      cx.fillStyle = '#202830'; cx.fillRect(0, 0, 1280, 720); cx.fillStyle = '#f4f4f0'; cx.beginPath(); cx.arc(640, y, R, 0, 7); cx.fill();
      cx.fillStyle = '#304050'; cx.fillRect((t / 3) % 1280, 700, 40, 20); // something always moving, as a real camera's noise is
      requestAnimationFrame(draw);
    };
    draw();
    const v = document.getElementById('video'); v.srcObject = cv.captureStream(30); v.play();
  });
  await wait(1500);
  await solo.pg.click('#btnDrop');
  if (name === 'callback') await solo.pg.screenshot({ path: `${OUT}/camera-667-scale.png` });
  const at = await solo.pg.evaluate(() => { const v = document.getElementById('video'), r = v.getBoundingClientRect(), s = Math.min(r.width / v.videoWidth, r.height / v.videoHeight); const ox = r.left + (r.width - v.videoWidth * s) / 2, oy = r.top + (r.height - v.videoHeight * s) / 2; return [[ox + 640 * s, oy + 150 * s], [ox + 640 * s, oy + 550 * s]]; });
  await solo.pg.mouse.click(at[0][0], at[0][1]); await solo.pg.mouse.click(at[1][0], at[1][1]);
  await solo.pg.waitForSelector('#dropGo'); await solo.pg.click('#dropGo');
  await solo.pg.waitForFunction(() => /Drop/.test(document.getElementById('dropBody').innerText), null, { timeout: 10000 });
  await wait(400); await solo.pg.evaluate(() => { window.__dropAt = performance.now(); });
  await solo.pg.waitForFunction(() => /g =|fit/.test(document.getElementById('dropBody').innerText), null, { timeout: 15000 });
  R['drop_' + name] = await solo.pg.$eval('#dropBody', e => e.innerText.replace(/\nAgain\nDone$/, ''));
  R['solo_' + name] = await solo.pg.$eval('#stats', e => e.innerText);
  if (name === 'callback') await solo.pg.screenshot({ path: `${OUT}/camera-667-drop.png` });
  soloErrs.push(...solo.errs);
  await solo.ctx.close();
}

R.errors = { hub: hub.errs, phone: phone.errs, solo: soloErrs };
fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
await b.close();
