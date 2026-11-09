// node tools/review/views.mjs <course> [holes...] [--only=tee,land,green] [--pose=n:name:x,y,z:lx,ly,lz:fov ...]
// Clean in-game renders (no HUD, ball or markers) for review books -> tools/review/out/<course>_v<n>_<view>.png
//   tee   = behind the back tee, looking down the line to the first bend
//   land  = on the fairway where a drive finishes (par 3: the forward tee), looking at the pin
//   green = 45 m short of the green, a little above it
// --pose renders an extra view in the hole's frame; a y written as +h means h metres above the ground there.
// About 1-2 minutes a hole at 1280x720 with software rendering.
import { createTerrain } from '../../src/course/terrain.js';
import { openCourse, loadCourse, hideMarkers, along, OUT } from './page.mjs';
const args = process.argv.slice(2), course = args[0] || 'aerie';
const only = (args.find(a => a.startsWith('--only=')) || '--only=tee,land,green').slice(7).split(',');
const poses = args.filter(a => a.startsWith('--pose=')).map(a => a.slice(7).split(':'));
const { HOLES, COURSE } = await loadCourse(course);
const back = COURSE.teeSets[0].id, fwd = COURSE.teeSets.at(-1).id;
const which = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
if (!which.length && !poses.length) which.push(...HOLES.map((_, i) => i + 1));
const { browser, page: pg, errs } = await openCourse(course, { width: 1280, height: 720, clean: true });
const pose = async p => { await pg.evaluate(q => { window.__pose = q; __advance(0.3); }, p); await hideMarkers(pg); };
let cur = -1;
const go = async n => { if (cur === n) return; cur = n; await pg.evaluate(i => { __startHole(i); document.getElementById('skip')?.click(); window.__pose = null; }, n - 1); await pg.evaluate(() => __advance(0.8)); };
const t0 = Date.now();
for (const n of which) {
  const h = HOLES[n - 1], T = createTerrain(h), gy = (x, z) => T.groundAt(x, z) ?? (T.floor?.y ?? -30), pin = h.green.pins?.[0] || h.pin;
  const L = h.line || [h.tees[back], pin];
  await go(n);
  if (only.includes('tee')) {
    const [tx, tz] = h.tees[back], [ax, az] = L[1], dx = ax - tx, dz = az - tz, l = Math.hypot(dx, dz);
    const ty = gy(tx, tz), far = Math.min(l, 240), lx = tx + dx / l * far, lz = tz + dz / l * far;
    await pose({ pos: [tx - dx / l * 4, ty + 2.4, tz - dz / l * 4], look: [lx, Math.min(ty, gy(lx, lz)) + 2, lz], fov: 62 });
    await pg.screenshot({ path: `${OUT}/${course}_v${n}_tee.png` });
  }
  if (only.includes('land')) {
    let x, z;
    if (h.par === 3) [x, z] = h.tees[fwd]; else {
      const [ax, az] = along(L, 215); let best = null;
      for (let dz = -60; dz <= 60; dz += 3) for (let dx = -60; dx <= 60; dx += 3) { const px = ax + dx, pz = az + dz; if (T.surfaceAt(px, pz) !== 'fairway') continue; const c = Math.hypot(dx, dz); if (!best || c < best.c) best = { x: px, z: pz, c }; }
      [x, z] = best ? [best.x, best.z] : [ax, az];
    }
    await pose({ pos: [x, gy(x, z) + 1.8, z], look: [pin[0], gy(pin[0], pin[1]) + 3, pin[1]], fov: 58 });
    await pg.screenshot({ path: `${OUT}/${course}_v${n}_land.png` });
  }
  if (only.includes('green')) {
    const a = L.at(-2), dx = pin[0] - a[0], dz = pin[1] - a[1], l = Math.hypot(dx, dz), G = h.green;
    const gx = G.x - dx / l * 45, gz = G.z - dz / l * 45, gyy = gy(G.x, G.z);
    await pose({ pos: [gx, Math.max(gy(gx, gz) + 2, gyy + 7), gz], look: [G.x + dx / l * 12, gyy + 2, G.z + dz / l * 12], fov: 60 });
    await pg.screenshot({ path: `${OUT}/${course}_v${n}_green.png` });
  }
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
