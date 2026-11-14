// Headless check of the R10 popover and the Bluetooth path against a fake R10 (fake-r10.js):
// node tools/r10/check.mjs [outDir]  — screenshots at 844x390, 667x375 and 1280x800, plus a JSON report.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('playwright');
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), OUT = process.argv[2] || path.join(REPO, 'tools/review/out/r10');
fs.mkdirSync(OUT, { recursive: true });
const FAKE = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'fake-r10.js'), 'utf8');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(page, { width, height, pre = '' }) {
  const pg = await b.newPage({ viewport: { width, height } }); pg.setDefaultTimeout(240000);
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
console.log(JSON.stringify(result, null, 1));
await b.close();
