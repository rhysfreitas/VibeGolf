// landing widths per tee set and outline flags, for the emitted Reclaim
import { createTerrain } from '/home/claude/vibegolf/src/course/terrain.js';
import { holeOutlines } from '/home/claude/vibegolf/tools/review/outlines.mjs';
const M = await import('/home/claude/vibegolf/src/course/reclaim.js?' + Date.now());
for (const n of (process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [1, 2, 4, 6, 7, 8, 9])) {
  const h = M.HOLES[n - 1], T = createTerrain(h), o = holeOutlines(h, T, M.COURSE, h.line);
  console.log(n, h.name, Object.entries(o.land).map(([k, v]) => `${k} ${v.w} m @${v.s}${v.at ? ' ->' + v.at : ''}`).join('; '));
  if (o.flags.length) console.log('   flags:', o.flags.join(' | '));
}
