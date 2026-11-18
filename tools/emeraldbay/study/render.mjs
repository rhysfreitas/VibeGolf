// node render.mjs [name ...] : renders the island study in the game (course.html with the study module served in
// place of src/course/emeraldbay.js) from fixed poses matched to Rhys's photos. Needs CHROME (see tools/review/page.mjs).
// Writes tools/emeraldbay/out/study/<name>.png.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..'), OUT = path.join(HERE, '../out/study');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// [name, hole index, camera in world space [X, y, Z], look at, fov, width, height]
const POSES = [
  ['beach', 1, [20, 26, -590], [0, 0, -180], 66],
  ['shore', 1, [75, 4.4, -522], [0, 22, -60], 64],                 // Maya Bay from the beach: out through the cove
  ['aerial', 1, [60, 720, 420], [0, 40, -430], 52],                  // over the cove's mouth, looking in
  ['shelf', 0, [352, 42, -70], [318, 8, -330], 58],                 // over the Shelf's tee: the bench, the wall on the left, the sea on the right
  ['shelftee', 0, [334.1, 15.4, -116.8], [329, 8, -240], 58],       // the Shelf's tee view
  ['drop', 1, [-129, 80, -447], [-15, 3.6, -520], 58],        // the Drop's tee on the ledge, 70 m over the beach green
  ['ledge', 1, [-10, 26, -470], [-125, 55, -450], 60],              // the ledge in the cove's wall from across the cove, the beach green below
  ['gap', 1, [-388, 5, -40], [-398, 60, -520], 58],                 // the gap between the west arm and the tower
  ['bar', 2, [256, 5.3, -26.5], [352, 3, 90], 58],                  // along the sandbar to the islet's beach green
  ['offshore', 2, [820, 90, 760], [-40, 70, -380], 48],             // out in the bay
  ['wall', 0, [470, 6, -330], [360, 60, -360], 62],                 // from a boat under the shelf's sea wall
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
