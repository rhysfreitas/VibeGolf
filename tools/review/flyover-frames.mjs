// node tools/review/flyover-frames.mjs <course> <hole> [teeId] [--at=0.1,0.3,0.5,0.7,0.9] [--w=640 --h=296]
// Frames of a hole's intro flyover as the game flies it, the default path above the planned one (from
// src/course/flyovers.js), at the given shares of the flight. Writes out/fly_<course>_<hole>_<tee>_<which>_<k>.png;
// make a sheet with sheet.py --files. Software WebGL: about 20–40 s a frame.
import { openCourse, goHole, loadCourse, OUT } from './page.mjs';
import { createTerrain } from '../../src/course/terrain.js';
import { defaultFlyover, plannedFlyover } from '../../src/course/flyover.js';
import { FLYOVERS } from '../../src/course/flyovers.js';

const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [course, hs, teeArg] = args.filter(a => !a.startsWith('--'));
const { HOLES, COURSE } = await loadCourse(course);
const n = +hs, h = HOLES[n - 1], T = createTerrain(h), tee = teeArg || COURSE.teeSets[0].id;
const at = String(opt.at || '0.1,0.3,0.5,0.7,0.9').split(',').map(Number);
const W = +(opt.w || 640), H = +(opt.h || 296);
const pin = h.green.pins?.[0] || h.pin, t = [h.tees[tee][0], T.groundAt(...h.tees[tee]) ?? 0, h.tees[tee][1]], p = [pin[0], T.groundAt(pin[0], pin[1]) ?? 0, pin[1]];
const paths = { default: defaultFlyover(t, p) };
const pl = plannedFlyover(FLYOVERS, COURSE.id, n - 1, tee, h.tees[tee], [h.green.x, h.green.z]); if (pl) paths.planned = pl;
const { browser, page: pg, errs } = await openCourse(course, { width: W, height: H, clean: true });
await goHole(pg, n);
const files = [];
for (const [which, f] of Object.entries(paths)) for (let k = 0; k < at.length; k++) {
  const pose = await pg.evaluate(({ f, u }) => {
    const v = q => new THREE.Vector3(...q), c = new THREE.CatmullRomCurve3(f.pts.map(v)), l = new THREE.CatmullRomCurve3(f.looks.map(v));
    const e = u * u * (3 - 2 * u);
    return { pos: c.getPoint(e).toArray(), look: l.getPoint(Math.min(1, e * 1.05)).toArray(), fov: 52 };
  }, { f, u: at[k] });
  await pg.evaluate(q => { window.__pose = q; __advance(0.3); }, pose);
  const file = `${OUT}/fly_${course}_${n}_${tee}_${which}_${k}.png`;
  await pg.screenshot({ path: file }); files.push(file);
  console.log(which, at[k], pose.pos.map(v => v.toFixed(0)).join(','));
}
console.log(files.join(' '));
if (errs.length) console.log('errors', errs.slice(0, 5));
await browser.close();
