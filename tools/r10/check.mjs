// Headless check of the R10 popover and the Bluetooth path against a fake R10 (fake-r10.js):
// node tools/r10/check.mjs [outDir] [--only=hub]  — screenshots at 844x390, 667x375 and 1280x800, plus a JSON report.
// The hub case (7, app.html) connects on the menu and checks shots arrive on the range and a course with no reconnect.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const ARGS = process.argv.slice(2), ONLY = (ARGS.find(a => a.startsWith('--only=')) || '').slice(7);
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), OUT = ARGS.find(a => !a.startsWith('--')) || path.join(REPO, 'tools/review/out/r10');
fs.mkdirSync(OUT, { recursive: true });
const FAKE = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'fake-r10.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(page, { width, height, pre = '', touch = false }) {
  const pg = await b.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch }); pg.setDefaultTimeout(240000);
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: '', contentType: 'text/css' });
    const f = path.join(REPO, decodeURIComponent(u.pathname));
    try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
  });
  await pg.addInitScript(`window.__lowq = true; ${pre}\n${FAKE}`);
  await pg.goto(`http://vibegolf.local/${page}`); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { const g = document.querySelector('#suGo'); if (g) g.click(); }); await pg.waitForTimeout(500);
  return { pg, errs };
}
const lmText = pg => pg.evaluate(() => document.querySelector('#lmText,[data-r=lmText]').textContent);
const result = {};

if (!ONLY) {
// 1. Range, phone landscape: Bluetooth view, connect, two shots (one resent), tee distance, debug capture
{
  const { pg, errs } = await open('range.html?mode=range&r10debug=1', { width: 844, height: 390 });
  await pg.evaluate(() => { window.__shots = []; import('/src/launch-monitor.js').then(m => m.launchMonitor.addEventListener('shot', e => window.__shots.push(e.detail))); });
  await pg.evaluate(() => document.querySelector('#lmBtn,[data-r=lmBtn]').click()); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/range-844-ble-off.png` });
  await pg.fill('#lmTee', '7'); await pg.press('#lmTee', 'Enter');
  await pg.click('#lmBle');
  await pg.waitForFunction(() => document.querySelector('#lmText,[data-r=lmText]').textContent === 'R10 live', null, { timeout: 20000 });
  result.rangeReady = await lmText(pg);
  await pg.evaluate(() => window.__fakeR10.shot(42)); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.__fakeR10.shot(42)); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.__fakeR10.shot(43)); await pg.waitForTimeout(1500);
  result.shots = await pg.evaluate(() => window.__shots.map(s => ({ Speed: s.Speed, VLA: s.VLA, SpinAxis: s.SpinAxis, Club: s.Club, Meta: s.Meta })));
  result.fake = await pg.evaluate(() => ({ acks: window.__fakeR10.acks, env: window.__fakeR10.env, events: window.__fakeR10.events }));
  result.capture = await pg.evaluate(() => document.getElementById('lmDbgN').textContent);
  result.readout = await pg.evaluate(() => document.body.innerText.match(/R10[^\n]*/g)?.slice(0, 6));
  await pg.screenshot({ path: `${OUT}/range-844-ble-live.png` });
  // drop and reconnect
  await pg.evaluate(() => window.__fakeR10.drop()); await pg.waitForTimeout(300);
  result.afterDrop = await pg.evaluate(() => document.getElementById('lmState').textContent);
  await pg.waitForFunction(() => document.querySelector('#lmText,[data-r=lmText]').textContent === 'R10 live', null, { timeout: 20000 });
  result.reconnects = await pg.evaluate(() => window.__fakeR10.connects);
  await pg.click('.lm-seg [data-src=bridge]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/range-844-bridge-tab.png` });
  result.rangeErrs = errs;
  await pg.close();
}
// 2. Smaller phone, no Web Bluetooth (Safari/Firefox)
{
  const { pg, errs } = await open('range.html?mode=range', { width: 667, height: 375, pre: 'window.__noBluetooth = true;' });
  await pg.evaluate(() => document.querySelector('#lmBtn,[data-r=lmBtn]').click()); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/range-667-nobt.png` });
  result.noBtView = await pg.evaluate(() => [...document.querySelectorAll('.lm-seg button')].find(b => b.getAttribute('aria-selected') === 'true').textContent);
  result.noBtErrs = errs;
  await pg.close();
}
// 3. Desktop course page (compact pill)
{
  const { pg, errs } = await open('course.html?c=aerie', { width: 1280, height: 800 });
  await pg.evaluate(() => document.querySelector('#lmBtn,[data-r=lmBtn]').click()); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/course-1280-popover.png` });
  result.courseErrs = errs;
  await pg.close();
}
// 4. Course page, getDevices remembers the R10 from the start
{
  const pre = "localStorage.setItem('vibegolf.lm.auto','1'); localStorage.setItem('vibegolf.lm.source','ble');";
  const { pg, errs } = await open('course.html?c=aerie', { width: 844, height: 390, pre: pre + ' window.__rememberFromStart = true;' });
  await pg.waitForFunction(() => document.querySelector('#lmText,[data-r=lmText]').textContent === 'R10 live', null, { timeout: 30000 }).catch(() => {});
  result.courseRemembered = await lmText(pg); // getDevices() remembers the R10: no tap needed
  result.course2Errs = errs;
  await pg.close();
}
// 5. Minigame, compact, no getDevices: should say tap
{
  const pre = "localStorage.setItem('vibegolf.lm.auto','1'); localStorage.setItem('vibegolf.lm.source','ble'); window.__noGetDevices = true;";
  const { pg, errs } = await open('wedge-ladder.html', { width: 844, height: 390, pre });
  result.gameTap = await lmText(pg);
  await pg.evaluate(() => document.querySelector('#lmBtn,[data-r=lmBtn]').click()); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/game-844-tap.png` });
  result.gameErrs = errs;
  await pg.close();
}
// 6. The chooser's name filter doesn't show the R10 (as in Bluefy): the hint and Show all devices
{
  const { pg, errs } = await open('range.html?mode=range', { width: 667, height: 375, pre: 'window.__hideR10 = true; window.__noGetDevices = true;' });
  await pg.evaluate(() => document.querySelector('#lmBtn,[data-r=lmBtn]').click()); await pg.waitForTimeout(300);
  result.missBefore = await pg.evaluate(() => document.getElementById('lmMiss').hidden);
  await pg.click('#lmBle'); await pg.waitForTimeout(500);
  result.missAfter = await pg.evaluate(() => ({ hidden: document.getElementById('lmMiss').hidden, state: document.getElementById('lmState').textContent }));
  await pg.screenshot({ path: `${OUT}/range-667-not-listed.png` });
  await pg.click('#lmAll');
  await pg.waitForFunction(() => document.querySelector('#lmText,[data-r=lmText]').textContent === 'R10 live', null, { timeout: 20000 }).catch(() => {});
  result.showAll = { text: await lmText(pg), hintHidden: await pg.evaluate(() => document.getElementById('lmMiss').hidden), requests: await pg.evaluate(() => window.__fakeR10.requests.map(o => o.acceptAllDevices ? 'all' : 'filtered')) };
  result.missErrs = errs;
  await pg.close();
}
}
// 7. The hub (app.html): connect once on the menu, then the range, a course and back with the link up throughout
if (!ONLY || ONLY === 'hub') {
  const game = async pg => (await pg.$('#game')).contentFrame();
  const listen = f => f.evaluate(() => { window.__shots = []; return import('/src/launch-monitor.js').then(m => { m.launchMonitor.addEventListener('shot', e => window.__shots.push(e.detail)); return !!m.launchMonitor.hubbed; }); });
  const text = f => f.evaluate(() => document.querySelector('#lmText,[data-r=lmText]').textContent);
  const go = async (f, url, wait = 3000) => { await f.evaluate(u => { location.href = u; }, url); await f.waitForURL(u => u.pathname.endsWith(url.split('?')[0])); await f.waitForLoadState('load'); await f.waitForTimeout(wait); };
  const H = result.hub = {};
  const { pg, errs } = await open('app.html?r10debug=1', { width: 844, height: 390 });
  let f = await game(pg);
  H.menuHubbed = await listen(f);
  H.keepLinkHidden = await f.evaluate(() => document.getElementById('keep').hidden);
  await f.click('#lmBtn'); await f.click('#lmBle');
  await f.waitForFunction(() => document.querySelector('#lmText').textContent === 'R10 live', null, { timeout: 20000 });
  H.menu = await text(f);
  await pg.screenshot({ path: `${OUT}/hub-844-menu.png` });
  // the range: no tap, no reconnect, a shot arrives
  await go(f, 'range.html?mode=range');
  H.rangeHubbed = await listen(f);
  H.range = await text(f);
  await pg.evaluate(() => window.__fakeR10.shot(50)); await pg.waitForTimeout(1500);
  H.rangeShots = await f.evaluate(() => window.__shots.map(s => s.Meta && s.Meta.shotNumber));
  H.rangeRecorded = await f.evaluate(() => { const d = JSON.parse(localStorage.getItem('vibegolf.sessions.v1') || '{}'); const s = (d.sessions || []).at(-1); return s ? { mode: s.mode, page: s.page, shots: s.shots.length } : null; });
  H.hashOnRange = await pg.evaluate(() => location.hash);
  await pg.screenshot({ path: `${OUT}/hub-844-range.png` });
  // a course: another shot arrives
  await go(f, 'course.html?c=aerie');
  await f.evaluate(() => { const g = document.querySelector('#suGo'); if (g) g.click(); }); await f.waitForTimeout(800);
  H.courseHubbed = await listen(f);
  H.course = await text(f);
  await pg.evaluate(() => window.__fakeR10.shot(51)); await pg.waitForTimeout(1500);
  H.courseShots = await f.evaluate(() => window.__shots.map(s => s.Meta && s.Meta.shotNumber));
  H.wake = await f.evaluate(async () => { const m = await import('/src/wake.js'); await new Promise(r => setTimeout(r, 300)); let direct; try { const l = await navigator.wakeLock.request('screen'); direct = 'granted'; l.release(); } catch (e) { direct = e.name; } return { state: m.wakeState(), direct, policy: document.featurePolicy ? document.featurePolicy.allowsFeature('screen-wake-lock') : null }; });
  H.wakeTop = await pg.evaluate(async () => { try { const l = await navigator.wakeLock.request('screen'); l.release(); return 'granted'; } catch (e) { return e.name; } });
  H.hashOnCourse = await pg.evaluate(() => location.hash);
  await pg.screenshot({ path: `${OUT}/hub-844-course.png` });
  // back to the range with the frame's own history
  await f.evaluate(() => history.back()); await f.waitForURL(u => u.pathname.endsWith('range.html')); await f.waitForTimeout(3000);
  H.backTo = await f.evaluate(() => location.pathname.split('/').pop() + location.search);
  H.back = await text(f);
  await listen(f); await pg.evaluate(() => window.__fakeR10.shot(52)); await pg.waitForTimeout(1500);
  H.backShots = await f.evaluate(() => window.__shots.map(s => s.Meta && s.Meta.shotNumber));
  H.fake = await pg.evaluate(() => ({ connects: window.__fakeR10.connects, requests: (window.__fakeR10.requests || []).length }));
  H.capturePages = await pg.evaluate(() => window.__vibegolfHub.capture.text()).then(t => JSON.parse(t).entries.filter(e => e.dir === 'hub').map(e => e.page));
  // a reload of the hub opens the page it was on
  await pg.reload(); await pg.waitForTimeout(3000); f = await game(pg);
  H.afterReload = await f.evaluate(() => location.pathname.split('/').pop() + location.search);
  H.errs = errs;
  await pg.close();
  // a remembered R10 connects on the hub's load with no tap, and a game page sees it live
  {
    const pre = "localStorage.setItem('vibegolf.lm.auto','1'); localStorage.setItem('vibegolf.lm.source','ble'); window.__rememberFromStart = true;";
    const { pg, errs } = await open('app.html#wedge-ladder.html', { width: 667, height: 375, pre });
    const f = await game(pg);
    await f.waitForFunction(() => document.querySelector('#lmText,[data-r=lmText]')?.textContent === 'R10 live', null, { timeout: 30000 }).catch(() => {});
    H.rememberedGame = await text(f);
    await pg.screenshot({ path: `${OUT}/hub-667-game.png` });
    H.remErrs = errs;
    await pg.close();
  }
  // no getDevices (Bluefy): the page asks for a tap; one tap in the page connects the hub's link
  {
    const pre = "localStorage.setItem('vibegolf.lm.auto','1'); localStorage.setItem('vibegolf.lm.source','ble'); window.__noGetDevices = true;";
    const { pg, errs } = await open('app.html#range.html?mode=range', { width: 844, height: 390, pre });
    let f = await game(pg);
    H.tapBefore = await text(f);
    await f.click('#lmBtn'); await f.click('#lmBle');
    await f.waitForFunction(() => document.querySelector('#lmText').textContent === 'R10 live', null, { timeout: 20000 }).catch(() => {});
    H.tapAfter = await text(f);
    await go(f, 'shape-it.html');
    H.tapNextPage = await text(f);
    H.tapErrs = errs;
    await pg.close();
  }
  // portrait phone inside the hub: the turn-sideways prompt still shows
  {
    const { pg, errs } = await open('app.html#range.html?mode=range', { width: 390, height: 844, touch: true });
    const f = await game(pg); await f.waitForTimeout(1500);
    H.portraitPrompt = await f.evaluate(() => !document.getElementById('rotate').hidden);
    H.portErrs = errs;
    await pg.close();
  }
}
// 8. Video across frames (for the cameras later): a stream the hub opens plays in a page's <video> straight
// from the hub (srcObject), and keeps running in the hub when the page changes. Chromium's fake webcam.
if (!ONLY || ONLY === 'hub') {
  const cb = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader'] });
  const ctx = await cb.newContext({ viewport: { width: 844, height: 390 }, permissions: ['camera'] });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname !== 'localhost') return r.fulfill({ body: '', contentType: 'text/css' }); const f = path.join(REPO, decodeURIComponent(u.pathname)); try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); } });
  await pg.goto('http://localhost:8199/app.html');   // localhost: a secure context, so the camera API is there await pg.waitForTimeout(2000);
  const V = result.hubVideo = {};
  V.hubStream = await pg.evaluate(async () => { const s = await navigator.mediaDevices.getUserMedia({ video: true }); window.__vibegolfHub.stream = s; return s.getVideoTracks()[0].readyState; });
  const show = f => f.evaluate(async () => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.style.cssText = 'position:fixed;left:8px;top:8px;width:160px;z-index:99;';
    document.body.appendChild(v); v.srcObject = window.top.__vibegolfHub.stream;
    try { await v.play(); } catch (e) { return { error: e.name }; }
    const t0 = v.currentTime; await new Promise(r => setTimeout(r, 1200));
    return { w: v.videoWidth, h: v.videoHeight, advanced: v.currentTime > t0 };
  });
  let f = await (await pg.$('#game')).contentFrame();
  V.menu = await show(f);
  await f.evaluate(() => { location.href = 'courses.html'; }); await f.waitForURL(u => u.pathname.endsWith('courses.html')); await f.waitForTimeout(1000);
  V.trackAfterNav = await pg.evaluate(() => window.__vibegolfHub.stream.getVideoTracks()[0].readyState);
  V.nextPage = await show(f);
  await pg.screenshot({ path: `${OUT}/hub-844-video.png` });
  V.errs = errs;
  await cb.close();
}
console.log(JSON.stringify(result, null, 1));
await b.close();
