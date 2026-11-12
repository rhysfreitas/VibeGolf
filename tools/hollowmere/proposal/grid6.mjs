// a coarse map of hole 6 in its own frame: ground height and surface, every 10 m
import { HOLES } from '../../../src/course/hollowmere.js';
import { createTerrain } from '../../../src/course/terrain.js';
const hi = +(process.argv[2] || 6) - 1, h = HOLES[hi], T = createTerrain(h);
const [x0, x1, z0, z1, st] = (process.argv[3] || '-140,80,-400,20,10').split(',').map(Number);
const code = { fairway: 'F', rough: 'r', firstcut: 'f', green: 'G', fringe: 'g', sand: 'S', desert: 'd', water: 'W', void: ' ', tee: 'T', waste: 'w' };
for (let z = z0; z <= z1; z += st) { let row = String(z).padStart(5) + ' '; for (let x = x0; x <= x1; x += st) { const g = T.groundAt(x, z); const s = g === null ? 'void' : T.surfaceAt(x, z); row += (code[s] || '?') + (g === null ? '   ' : String(Math.round(g)).padStart(3)); } console.log(row); }
let hdr = '      '; for (let x = x0; x <= x1; x += st) hdr += String(x).padStart(4); console.log(hdr);
