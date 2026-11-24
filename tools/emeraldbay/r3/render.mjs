// node render.mjs [name ...] : renders the island study in the game (course.html with the study module served in
// place of src/course/emeraldbay.js) from fixed poses matched to Rhys's photos. Needs CHROME (see tools/review/page.mjs).
// Writes tools/emeraldbay/out/study/<name>.png.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..'), OUT = path.join(HERE, '../out/r3');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// [name, hole index, camera in world space [X, y, Z], look at, fov, width, height]
const POSES = [
  ['bay', 3, [1500, 900, 950], [250, 0, -420], 50],                  // the whole bay from the south-east
  ['baynorth', 3, [450, 820, -2150], [280, 0, -330], 48],           // the bay from the north
  ['cove1', 0, [-468, 9.5, 205], [-545, 10, -40], 60],               // the 1st: up the Maya island's outer west shore
  ['drop2', 1, [172, 66.5, 36.9], [10, 4, 95], 62],               // the 2nd: off the ledge to the islet in the cove
  ['tongue3', 2, [404, 8.5, 342], [596, 4, 385], 60],               // the 3rd: across the channel's mouth to the islet
  ['shelf4', 3, [805.5, 17.5, 104.8], [726, 15, -60], 58],             // the 4th: up the shelf on B's outer east wall
  ['sandbar5', 4, [1072, 9.5, -462], [838, 4, -772], 60],           // the 5th: along the sandbar to the gap's mouth
  ['gap6', 5, [832, 8.5, -772], [833, 18, -1000], 60],              // the 6th: through the gap
  ['overhang7', 6, [692, 8.5, -1132], [480, 8, -1060], 62],          // the 7th: round the cove on C's north shore
  ['stack8', 7, [327.7, 11.5, -906.8], [230, 8, -840], 60],             // the 8th: out to the stack
  ['hong9', 8, [82, 8.5, -735], [-312, 16, -768], 58],              // the 9th: across the flats to the cave
];
const want = process.argv.slice(2);
const STUDY = await import(path.join(OUT, 'emeraldbay.js') + '?t=' + Date.now());
const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = +(process.env.W || 1200), H = +(process.env.H || 675);
const pg = await b.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(900000);
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.route('**/*', r => {
  const u = new URL(r.request().url());
  if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: '', contentType: 'text/css' });
  const f = u.pathname === '/src/course/emeraldbay.js' ? path.join(OUT, 'emeraldbay.js') : path.join(REPO, decodeURIComponent(u.pathname));
  try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
});
await pg.addInitScript(() => { window.__lowq = true; window.__noVar = true; try { localStorage.clear(); } catch (e) { /* off */ } });
await pg.goto('http://vibegolf.local/course.html?c=emeraldbay'); await pg.waitForTimeout(2500);
await pg.evaluate(() => document.querySelector('#suGo').click()); await pg.waitForTimeout(800);
await pg.addStyleTag({ content: '#top,#holeCard,#dock,#minimapWrap,.tag,#toast,#card,#intro,#skip,#rotate,#hitbar,#readout,.st,.sim-tool,#aimPill{visibility:hidden!important}' });
let cur = -1;
for (const [name, hi, pos, look, fov] of POSES) {
  if (want.length && !want.includes(name)) continue;
  if (hi !== cur) { await pg.evaluate(i => { __startHole(i); document.querySelector('#skip').click(); __advance(1); }, hi); cur = hi; }
  if (!pos) await pg.evaluate(() => { window.__pose = null; __advance(0.3); });
  else {
    const f = STUDY.HOLES[hi].frame, a = f.heading * Math.PI / 180, rx = Math.cos(a), rz = Math.sin(a), fx = Math.sin(a), fz = -Math.cos(a);
    const L = ([X, y, Z]) => { const dx = X - f.x, dz = Z - f.z; return [dx * rx + dz * rz, y - f.base, -(dx * fx + dz * fz)]; };
    await pg.evaluate(p => { window.__pose = p; __advance(0.3); }, { pos: L(pos), look: L(look), fov });
  }
  await pg.evaluate(() => __advance(0.5, 5));
  await pg.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(name);
}
console.log(errs.join('\n') || 'no errors');
await b.close();
