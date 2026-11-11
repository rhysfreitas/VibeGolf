// node tools/review/quickplay.mjs <course> [holes...] [--seeds=3]: a fast play-through with the game's physics and no
// browser (seconds a hole, against minutes for playthrough.mjs). Each stroke picks a target the way auto-aim does
// (the pin when it's in reach and the line is clear, else the first fairway target in reach, skipping one under
// 60% of reach when a further one is in reach), solves the club and swing length for it, and hits it with a decent
// amateur's miss. On the green: two putts (one inside 3 m). In the void or water: a stroke, and it plays again from
// where it was, at the nearest target. Logs the lie after each stroke; a hole that takes 10 or more is a layout bug.
// It skips what the game adds on top (lie costs, slope stances, trees' branches, wind), so it's a check, not the game.
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse } from './page.mjs';
import { makePlayer } from './play.mjs';

const args = process.argv.slice(2), course = args[0], seeds = +((args.find(a => a.startsWith('--seeds=')) || '--seeds=3').slice(8));
const pick = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
const { HOLES, COURSE } = await loadCourse(course);
const { playHole } = makePlayer(COURSE);
const sets = [COURSE.teeSets[0].id, COURSE.teeSets.at(-1).id];
let total = 0;
for (const [i, h] of HOLES.entries()) {
  if (pick.length && !pick.includes(i + 1)) continue;
  const T = createTerrain(h), out = [];
  for (const set of sets) for (let k = 0; k < seeds; k++) {
    const r = playHole(h, T, set, 101 + k * 37 + i * 11);
    out.push(`${set}:${r.n}${r.stuck ? '!' : ''}`); if (set === sets[0] && k === 0) total += r.n;
    if (r.stuck || r.n >= h.par + 4) console.log(`  ${h.name} ${set} seed ${k}: ${r.n} | ${r.log.join(' ')}`);
  }
  console.log(`${i + 1} ${h.name} par ${h.par}: ${out.join(' ')}`);
}
console.log(`${course}: first seed from the back tees, ${total}`);
