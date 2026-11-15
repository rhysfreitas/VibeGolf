// node tools/labyrinth/dump.mjs : the round-0 maze as JSON for the proposal's plans (out/maze.json)
import fs from 'fs';
import { walls, LINES, GREENS, floorAt } from './maze.mjs';
const out = { lines: LINES, greens: GREENS, walls: {} };
for (const v of ['plain', 'dressed', 'low', 'broken']) for (const d of ['L', 'R']) out.walls[v + d] = walls(v, d).map(w => ({ pts: w.pts.map(p => p.map(q => +q.toFixed(1))), h: +(w.y1 - 12).toFixed(1), kind: w.kind, lean: w.lean || 0 }));
fs.writeFileSync(new URL('./out/maze.json', import.meta.url), JSON.stringify(out));
