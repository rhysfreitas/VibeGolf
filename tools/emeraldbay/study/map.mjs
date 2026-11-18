// a quick top-down look at the study island: heights and tags every 4 m to out/study/map.bin for map.py
import fs from 'fs';
import { V } from './island.mjs';
const X0 = -800, X1 = 800, Z0 = -1000, Z1 = 500, C = 4, nx = (X1 - X0) / C, nz = (Z1 - Z0) / C;
const T = ['water', 'wet', 'sand', 'jungle', 'rough', 'fairway', 'green', 'tee'];
const buf = new Float32Array(nx * nz * 2);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const v = V(X0 + i * C, Z0 + j * C); buf[(j * nx + i) * 2] = v.y; buf[(j * nx + i) * 2 + 1] = T.indexOf(v.t); }
fs.mkdirSync('../out/study', { recursive: true });
fs.writeFileSync('../out/study/map.bin', Buffer.from(buf.buffer));
fs.writeFileSync('../out/study/map.json', JSON.stringify({ X0, Z0, C, nx, nz }));
