// node render.mjs [name ...] : renders the island study in the game (course.html with the study module served in
// place of src/course/emeraldbay.js) from fixed poses matched to Rhys's photos. Needs CHROME (see tools/review/page.mjs).
// Writes tools/emeraldbay/out/study/<name>.png.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../../..'), OUT = path.join(HERE, '../out/r2');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
// [name, hole index, camera in world space [X, y, Z], look at, fov, width, height]
const POSES = [
  ['bay', 3, [760, 820, 1050], [-20, 0, -470], 50],                  // the whole bay from the south-east
  ['baynorth', 3, [260, 760, -1900], [0, 0, -300], 48],             // the bay from the north, into the Maya island's cove
  ['cove1', 0, [-152, 7, -452], [-92, 10, 0], 60],                   // the 1st: from the stilt village into the cove
  ['drop2', 1, [73.3, 66.5, 135.8], [-12, 4, -230], 62],             // the 2nd: off the ledge to the islet, out of the cove
  ['shelf4', 3, [478, 42, -370], [438, 12, -720], 58],               // the 4th: along the shelf on B's west wall
  ['gap6', 5, [258, 7, -900], [240, 18, -1120], 60],                 // the 6th: through the gap
  ['overhang7', 6, [-248, 7, -905], [-20, 10, -900], 62],            // the 7th: round the cove under the leaning cliff
  ['hong9', 8, [70, 9, -632], [-280, 16, -640], 58],                 // the 9th: across the flats to the cave
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
