// Runs the real app (Electron) and checks it end to end: the hub over vibegolf://game/, a secure context with
// Bluetooth and the camera, the link through page changes, the PC kept awake on play pages, outside links
// sent to the browser, the window remembered, and the R10 reconnected at start with no tap (against
// tools/r10/fake-r10.js, which stands in for navigator.bluetooth).
// node scripts/smoke.mjs   (on Linux without a display: xvfb-run -a node scripts/smoke.mjs)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { _electron: electron } = require('playwright-core');

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAKE = fs.readFileSync(path.join(APP, '..', 'tools', 'r10', 'fake-r10.js'), 'utf8');
const USER = fs.mkdtempSync(path.join(os.tmpdir(), 'vg-app-'));
const env = { ...process.env, VIBEGOLF_USER_DATA: USER, VIBEGOLF_NO_UPDATE: '1', VIBEGOLF_TEST: '1' };
const out = {}, fails = [];
const check = (name, ok, got) => { out[name] = got; if (!ok) fails.push(`${name}: ${JSON.stringify(got)}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const launch = () => electron.launch({ args: [APP, '--no-sandbox'], env, timeout: 60000 });
async function gameFrame(page, file) {
  for (let i = 0; i < 80; i++) {
    const f = page.frames().find(x => x !== page.mainFrame() && x.url().includes(file));
    if (f) { await f.waitForLoadState('load'); return f; }
    await wait(250);
  }
  throw new Error(`no frame ${file}; frames: ${page.frames().map(f => f.url())}`);
}

// 1. First run
let app = await launch();
let page = await app.firstWindow();
await page.waitForLoadState('load');
check('hubUrl', page.url().startsWith('vibegolf://game/app.html'), page.url());
let f = await gameFrame(page, 'index.html');
const env1 = await f.evaluate(async () => {
  const m = await import('/src/launch-monitor.js');
  return { hubbed: !!m.launchMonitor.hubbed, secure: isSecureContext, bluetooth: !!(navigator.bluetooth && navigator.bluetooth.requestDevice), keepHidden: document.getElementById('keep').hidden, title: document.title };
});
check('frame', env1.hubbed && env1.secure && env1.keepHidden, env1);
// Windows and macOS have Web Bluetooth on; Chromium keeps it experimental on Linux (the fake stands in below)
check('bluetoothApi', env1.bluetooth || process.platform === 'linux', env1.bluetooth);
check('appApi', await page.evaluate(() => !!(window.vibegolfApp && window.vibegolfApp.app)), true);
check('appApiHiddenFromGame', await f.evaluate(() => typeof window.vibegolfApp === 'undefined'), true);
check('asleepOnMenu', !(await app.evaluate(() => global.__vg.awake())), false);
// the camera, through the permission handler, in the hub (where the camera links will live)
const cam = await page.evaluate(async () => { try { const s = await navigator.mediaDevices.getUserMedia({ video: true }); const t = s.getVideoTracks()[0]; const r = t.readyState; t.stop(); return r; } catch (e) { return e.name; } });
check('camera', cam === 'live', cam);
// a play page keeps the PC awake; back to a menu lets it sleep
await f.evaluate(() => { location.href = 'range.html?mode=range'; });
f = await gameFrame(page, 'range.html'); await wait(1500);
check('awakeOnRange', await app.evaluate(() => global.__vg.awake()), true);
check('hash', (await page.evaluate(() => location.hash)) === '#range.html?mode=range', await page.evaluate(() => location.hash));
await f.evaluate(() => { location.href = 'courses.html'; });
f = await gameFrame(page, 'courses.html'); await wait(800);
check('asleepOnCourses', !(await app.evaluate(() => global.__vg.awake())), false);
// outside links go to the browser; nothing else loads in the window
await app.evaluate(({ shell }) => { global.__opened = []; shell.openExternal = async u => { global.__opened.push(u); }; });
await f.evaluate(() => { window.open('https://example.com/a', '_blank'); });
await f.evaluate(() => { const a = document.createElement('a'); a.href = 'https://example.com/b'; document.body.appendChild(a); a.click(); });
await wait(1000);
check('external', (await app.evaluate(() => global.__opened)).length === 2, await app.evaluate(() => global.__opened));
check('stillOurs', f.url().startsWith('vibegolf://game/courses.html'), f.url());
check('windows', app.windows().length === 1, app.windows().length);
// the window remembers its size
const bw = await app.browserWindow(page);
await bw.evaluate(w => w.setBounds({ x: 40, y: 30, width: 900, height: 600 }));
await wait(300);
// the "was connected" flags, as after a real first connect
await page.evaluate(() => { localStorage.setItem('vibegolf.lm.auto', '1'); localStorage.setItem('vibegolf.lm.source', 'ble'); });
await app.close();
// and the R10 the app picked then (written after the app has saved its own settings on close)
const saved = JSON.parse(fs.readFileSync(path.join(USER, 'settings.json'), 'utf8'));
fs.writeFileSync(path.join(USER, 'settings.json'), JSON.stringify({ ...saved, r10: { id: 'fake', name: 'Approach R10' } }));

// 2. Second run: the window comes back, and the R10 reconnects with no tap (no getDevices, as in Electron)
const INJ = path.join(USER, 'fake.js');
fs.writeFileSync(INJ, `window.__noGetDevices = true; window.__rememberFromStart = true;\n${FAKE}`);
env.VIBEGOLF_TEST_INJECT = INJ;
app = await launch();
page = await app.firstWindow();
await page.waitForLoadState('load');
const b2 = await (await app.browserWindow(page)).evaluate(w => w.getBounds());
check('bounds', b2.width === 900 && b2.height === 600, b2);
f = await gameFrame(page, 'index.html');   // a new start opens at home
await wait(6000);
const lm = await page.evaluate(() => { const l = window.__vibegolfHub.launchMonitor; return { status: l.status, detail: l.detail, requests: (window.__fakeR10.requests || []).length }; });
check('autoConnect', lm.status === 'ready' && lm.requests === 1, lm);
check('pill', (await f.evaluate(() => document.querySelector('#lmText').textContent)) === 'R10 live', await f.evaluate(() => document.querySelector('#lmText').textContent));
await f.evaluate(() => { location.href = 'course.html?c=aerie'; });
f = await gameFrame(page, 'course.html');
await f.evaluate(() => { const g = document.querySelector('#suGo'); if (g) g.click(); }); await wait(800);
await f.evaluate(() => { window.__shots = []; return import('/src/launch-monitor.js').then(m => m.launchMonitor.addEventListener('shot', e => window.__shots.push(e.detail.Meta.shotNumber))); });
await page.evaluate(() => window.__fakeR10.shot(77)); await wait(1500);
check('shotOnCourse', JSON.stringify(await f.evaluate(() => window.__shots)) === '[77]', await f.evaluate(() => window.__shots));
check('connects', (await page.evaluate(() => window.__fakeR10.connects)) === 1, await page.evaluate(() => window.__fakeR10.connects));
await page.screenshot({ path: path.join(USER, 'course.png'), timeout: 60000 }).catch(() => {});   // the course renders slowly in software
out.log = fs.readFileSync(path.join(USER, 'app.log'), 'utf8').trim().split('\n').slice(-8);
await app.close();

console.log(JSON.stringify(out, null, 1));
console.log(fails.length ? `FAIL\n${fails.join('\n')}` : 'PASS', USER);
process.exit(fails.length ? 1 : 0);
