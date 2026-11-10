// node tools/review/views.mjs <course> [holes...] [--only=tee,land,green] [--pose=n:name:x,y,z:lx,ly,lz:fov ...]
// Clean in-game renders (no HUD, ball or markers) for review books -> tools/review/out/<course>_v<n>_<view>.png
//   tee   = behind the back tee, looking down the line to the first bend
//   land  = on the fairway where a drive finishes (par 3: the forward tee), looking at the pin
//   green = 45 m short of the green, a little above it
// --pose renders an extra view in the hole's frame; a y written as +h means h metres above the ground there.
// About 1-2 minutes a hole at 1280x720 with software rendering.
import { createTerrain } from '../../src/course/terrain.js';
import { openCourse, loadCourse, OUT, viewPoses, goHole, setPose } from './page.mjs';
const args = process.argv.slice(2), course = args[0] || 'aerie';
const only = (args.find(a => a.startsWith('--only=')) || '--only=tee,land,green').slice(7).split(',');
const poses = args.filter(a => a.startsWith('--pose=')).map(a => a.slice(7).split(':'));
const { HOLES, COURSE } = await loadCourse(course);
const which = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
if (!which.length && !poses.length) which.push(...HOLES.map((_, i) => i + 1));
const { browser, page: pg, errs } = await openCourse(course, { width: 1280, height: 720, clean: true });
const pose = p => setPose(pg, p);
let cur = -1;
const go = async n => { if (cur === n) return; cur = n; await goHole(pg, n); };
const t0 = Date.now();
for (const n of which) {
  const h = HOLES[n - 1], P = viewPoses(h, createTerrain(h), COURSE);
  await go(n);
  for (const v of ['tee', 'land', 'green']) if (only.includes(v)) { await pose(P[v]); await pg.screenshot({ path: `${OUT}/${course}_v${n}_${v}.png` }); }
  console.log(course, 'hole', n, 'done', Math.round((Date.now() - t0) / 1000) + 's');
}
for (const [n, name, p, l, fov] of poses) {
  const h = HOLES[+n - 1], T = createTerrain(h), gy = (x, z) => T.groundAt(x, z) ?? (T.floor?.y ?? -30);
  const val = s => { const [x, y, z] = s.split(','); return [+x, y.startsWith('+') ? gy(+x, +z) + +y.slice(1) : +y, +z]; };
  await go(+n);
  await pose({ pos: val(p), look: val(l), fov: +(fov || 60) });
  await pg.screenshot({ path: `${OUT}/${course}_${name}.png` });
  console.log(course, 'pose', name, 'done');
}
console.log('errors', JSON.stringify(errs.slice(0, 5)));
await browser.close();
