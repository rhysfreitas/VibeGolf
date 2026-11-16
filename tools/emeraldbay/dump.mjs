// node tools/emeraldbay/dump.mjs : the world sampled on grids for the figures (out/grid-*.json):
// the whole bay every 5 m, and each tide hole's box every 2 m. Heights in metres above low water, tags as codes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { V, WLINES, TIDES, HW } from './world.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
fs.mkdirSync(OUT, { recursive: true });
export const CODES = ['sea', 'wet', 'sand', 'grass', 'rough', 'jungle', 'karst'];

function grid(name, x0, x1, n0, n1, cell) {
  const nx = Math.round((x1 - x0) / cell) + 1, nn = Math.round((n1 - n0) / cell) + 1, y = [], t = [], cave = [];
  for (let j = 0; j < nn; j++) for (let i = 0; i < nx; i++) {
    const g = V(x0 + i * cell, -(n0 + j * cell));
    y.push(+g.y.toFixed(2)); t.push(CODES.indexOf(g.t)); cave.push(g.cave ? 1 : 0);
  }
  fs.writeFileSync(path.join(OUT, `grid-${name}.json`), JSON.stringify({ x0, n0, cell, nx, nn, y, t, cave, tides: TIDES, hw: HW }));
  console.log(name, nx, 'x', nn);
}
const lines = WLINES.map(L => L.map(([X, Z]) => [X, -Z]));
fs.writeFileSync(path.join(OUT, 'lines.json'), JSON.stringify(lines));
grid('bay', -250, 1400, -150, 1500, 5);
grid('h3', 640, 960, 300, 560, 2);
grid('h5', 560, 1040, 900, 1200, 2);
grid('h9', 60, 680, 520, 880, 2);
