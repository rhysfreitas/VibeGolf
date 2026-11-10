// node tools/review/slots.mjs <course> [holes...]
// Finds slots: narrow strips where the ground drops well below the ground a few metres either side (two
// islands that meet but don't overlap leave a trench to the floor between them), with playing ground (not
// native) on both sides. Prints clusters per hole.
import { createTerrain } from '../../src/course/terrain.js';
const args = process.argv.slice(2), course = args[0] || 'redmesa';
const mod = await import(`../../src/course/${{ redmesa: 'red-mesa', aerie: 'aerie', hollowmere: 'hollowmere', reclaim: 'reclaim' }[course] || course}.js`);
const which = args.slice(1).map(Number), HOLES = mod.HOLES;
const PLAY = new Set(['fairway', 'fringe', 'firstcut', 'rough', 'green', 'tee']); // playing ground on both sides
for (const [hi, h] of HOLES.entries()) {
  if (which.length && !which.includes(hi + 1)) continue;
  const T = createTerrain(h), pts = [];
  const xs = [h.pin[0], ...Object.values(h.tees).map(t => t[0])], zs = [h.pin[1], ...Object.values(h.tees).map(t => t[1])];
  const x0 = Math.min(...xs) - 120, x1 = Math.max(...xs) + 120, z0 = Math.min(...zs) - 80, z1 = Math.max(...zs) + 80;
  for (let z = z0; z < z1; z += 1) for (let x = x0; x < x1; x += 1) {
    const g = T.groundAt(x, z); if (g === null) continue; // open air (a gorge) is meant to be there
    const play = (px, pz) => PLAY.has(T.surfaceAt(px, pz));
    for (const [dx, dz] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (const w of [2, 3, 4]) {
      const a = T.groundAt(x - dx * w, z - dz * w), b = T.groundAt(x + dx * w, z + dz * w);
      if (a !== null && b !== null && a > g + 4 && b > g + 4 && Math.abs(a - b) < 6 && play(x - dx * w, z - dz * w) && play(x + dx * w, z + dz * w)) { pts.push([x, z, Math.min(a, b) - g]); break; }
    }
  }
  const cl = []; // cluster within 6 m
  for (const p of pts) { const c = cl.find(c => Math.hypot(c.x - p[0], c.z - p[1]) < 8); if (c) { c.n++; c.d = Math.max(c.d, p[2]); c.x = (c.x * (c.n - 1) + p[0]) / c.n; c.z = (c.z * (c.n - 1) + p[1]) / c.n; } else cl.push({ x: p[0], z: p[1], n: 1, d: p[2] }); }
  console.log(`${hi + 1} ${h.name}: ${cl.length ? cl.map(c => `(${c.x.toFixed(0)},${c.z.toFixed(0)}) ${c.n}pts ${c.d.toFixed(0)}m`).join('  ') : 'no slots'}`);
}
