// Menu thumbnails for the courses (courses.html tiles), rendered from the game.
//   node tools/review/thumbs.mjs <course> [hole:view ...] [--w=480 --h=300]   candidates -> out/thumb_<course>_<hole>_<view>.png
//   node tools/review/thumbs.mjs --final [course ...]                             the picks in PICKS -> out/thumb_<course>.png
//   python3 tools/review/thumbs.py                                                out/thumb_<course>.png -> assets/thumb-<course>.jpg
// A view is tee, land or green (the review views from page.mjs), lifted and pulled back as 'tee+8/12/55' (up, back,
// fov), or a named pose in POSES. Picks render at 960x540 and are scaled to the tile's 640x360 (16:9), so edges stay
// clean. About 10 s a view at candidate size in software, plus 15 s to open a course.
import { createTerrain } from '../../src/course/terrain.js';
import { openCourse, loadCourse, OUT, viewPoses, goHole, setPose } from './page.mjs';

// course -> [hole, view]: what each tile shows (refreshed 23 November 2026, after every course's art pass)
export const PICKS = {
  aerie: [6, 'tee+10/15'], redmesa: [3, 'tee+6/5'], hollowmere: [9, 'green+3'], reclaim: [4, 'tee+2/0'],
  rimeholm: [3, 'green+3/10'], emberfell: [7, 'land+12'], lostvalley: [9, 'tee+6'], halcyon: [6, 'tee+8'],
  buriedkingdom: [3, 'tee+6/0/38'], wreckersreach: [4, 'green+4'], eldergrove: [6, 'green+2'], cloudrest: [4, 'green+3/10'],
  emeraldbay: [2, 'tee+6'],
};
// extra poses in a hole's frame: [pos, look, fov]; a y of '+h' is h metres above the ground there
export const POSES = {};

const args = process.argv.slice(2), opt = k => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
// the tiles are 16:9 (courses.html crops to it), so the picks render 960x540 and are saved at 640x360
const final = args.includes('--final'), W = +(opt('w') || (final ? 960 : 480)), H = +(opt('h') || (final ? 540 : 270));
const jobs = []; // [course, hole, view, file]
if (final) {
  const list = args.filter(a => !a.startsWith('--'));
  for (const c of list.length ? list : Object.keys(PICKS)) jobs.push([c, PICKS[c][0], PICKS[c][1], `thumb_${c}.png`]);
} else {
  const c = args[0];
  for (const a of args.slice(1).filter(a => !a.startsWith('--'))) { const [n, v = 'tee'] = a.split(':'); jobs.push([c, +n, v, `thumb_${c}_${n}_${v.replace(/[+/]/g, '_')}.png`]); }
}
const byCourse = {};
for (const j of jobs) (byCourse[j[0]] ||= []).push(j);
for (const [course, list] of Object.entries(byCourse)) {
  const { HOLES, COURSE } = await loadCourse(course);
  const { browser, page: pg, errs } = await openCourse(course, { width: W, height: H, clean: true });
  let cur = -1;
  for (const [, n, view, file] of list) {
    const h = HOLES[n - 1], T = createTerrain(h);
    if (cur !== n) { await goHole(pg, n); cur = n; }
    let p;
    if (POSES[`${course}:${view}`]) {
      const gy = (x, z) => T.groundAt(x, z) ?? (T.floor?.y ?? -30);
      const val = ([x, y, z]) => [x, typeof y === 'string' ? gy(x, z) + +y.slice(1) : y, z];
      const [pos, look, fov] = POSES[`${course}:${view}`]; p = { pos: val(pos), look: val(look), fov };
    } else {
      // tee, land or green, optionally lifted and pulled back: 'tee+8/12/55' = 8 m up, 12 m further back, fov 55
      const [, base, up = 0, back = 0, fov] = view.match(/^(\w+)(?:\+([\d.]+)(?:\/([\d.]+)(?:\/([\d.]+))?)?)?$/);
      const q = viewPoses(h, T, COURSE)[base], dx = q.look[0] - q.pos[0], dz = q.look[2] - q.pos[2], l = Math.hypot(dx, dz);
      p = { pos: [q.pos[0] - dx / l * +back, q.pos[1] + +up, q.pos[2] - dz / l * +back], look: q.look, fov: fov ? +fov : q.fov };
    }
    await setPose(pg, p);
    await pg.evaluate(() => __advance(1.5, 5)); // let anything animated settle (water, flags, birds)
    await pg.screenshot({ path: `${OUT}/${file}` });
    console.log(course, n, view, '->', file);
  }
  if (errs.length) console.log('errors', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
}
