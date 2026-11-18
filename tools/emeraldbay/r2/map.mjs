// the bay every 4 m (heights and tags) and the holes, for map.py: out/r2/map.bin, map.json
import fs from 'fs';
import { V, HOLES, W, polyLen } from './bay.mjs';
const X0 = -1000, X1 = 1000, Z0 = -1400, Z1 = 552, C = 4, nx = (X1 - X0) / C, nz = (Z1 - Z0) / C;
const T = ['water', 'wet', 'sand', 'jungle', 'flat'];
const buf = new Float32Array(nx * nz * 2);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const v = V(X0 + i * C, Z0 + j * C); buf[(j * nx + i) * 2] = v.y; buf[(j * nx + i) * 2 + 1] = T.indexOf(v.t); }
fs.writeFileSync('../out/r2/map.bin', Buffer.from(buf.buffer));
const holes = HOLES.map(h => { const P = h.line.map(p => W(...p)); return { n: h.n, name: h.name, par: h.par, P, yd: Math.round(polyLen(P) / 0.9144), y: P.map(p => +V(...p).y.toFixed(1)) }; });
fs.writeFileSync('../out/r2/map.json', JSON.stringify({ X0, Z0, C, nx, nz, holes }));
for (const h of holes) console.log(h.n, h.name, h.par, h.yd + ' yd', 'heights', h.y.join(' '));
console.log('total', holes.reduce((a, h) => a + h.yd, 0));
