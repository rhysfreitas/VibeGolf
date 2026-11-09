// node tools/review/drives.mjs [course...] : three drives (tour, medium, shorter) from the back and second tees at each
// par 4/5's first target, with the game's physics: where they finish. Catches walls and water in the landing area.
import { simulate } from '../../src/physics.js';
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse } from './page.mjs';
const YD = 0.9144;
function shoot(t, from, to, shot, altFt) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => { const v = t.surfaceAt(wx(lx, lz), wz(lx, lz)); return v === 'tee' ? 'fairway' : v === 'void' ? 'rough' : v; },
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt,
  });
  const e = r.pts.at(-1).p, x = wx(e[0], e[2]), z = wz(e[0], e[2]);
  return { x, z, d: Math.hypot(x - o.x, z - o.z), y: o.y + e[1], surf: t.surfaceAt(x, z), g: t.groundAt(x, z), events: [...new Set(r.pts.map(p => p.phase))].join('>') };
}
const DRIVES = { long: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, short: { Speed: 132, VLA: 13, TotalSpin: 3300 } };
const courses = process.argv.slice(2); if (!courses.length) courses.push('aerie', 'redmesa', 'hollowmere');
for (const c of courses) {
  const { HOLES, COURSE } = await loadCourse(c);
  console.log('==', c);
  HOLES.forEach((h, i) => {
    if (h.par === 3) return;
    const T = createTerrain(h), out = [];
    for (const set of [COURSE.teeSets[0].id, COURSE.teeSets[1].id]) {
      const tee = h.tees[set], tg = h.targets.find(t => !t.pin), aim = [tg.x, tg.z];
      for (const [k, sh] of Object.entries(DRIVES)) { const r = shoot(T, tee, aim, sh, COURSE.altFt); out.push(`${set}/${k} ${Math.round(r.d / YD)}yd ${r.surf}${r.g === null ? '(void)' : ''} ${r.events.includes('void') ? 'VOID' : ''}`); }
    }
    console.log(i + 1, h.name, '| aim', h.targets.find(t => !t.pin).name, '|', out.join(' · '));
  });
}
