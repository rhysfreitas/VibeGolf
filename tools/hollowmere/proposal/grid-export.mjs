// sample holes of a Hollowmere module in their own frame for the proposal plans:
// node grid-export.mjs <module.js> <outdir> <tag> hole:x0,x1,z0,z1,res ...
import { createTerrain } from '../../../src/course/terrain.js';
import fs from 'fs';
const [mod, outDir, tag, ...specs] = process.argv.slice(2);
const { HOLES } = await import(mod);
const SURF = ['void', 'tee', 'fairway', 'fringe', 'firstcut', 'rough', 'desert', 'sand', 'waste', 'water', 'green', 'rock'];
for (const sp of specs) {
  const [hn, box] = sp.split(':'), [x0, x1, z0, z1, res] = box.split(',').map(Number), h = HOLES[+hn - 1], T = createTerrain(h);
  const nx = Math.round((x1 - x0) / res), nz = Math.round((z1 - z0) / res), H = new Float32Array(nx * nz), S = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let k = 0; k < nx; k++) {
    const x = x0 + (k + 0.5) * res, z = z0 + (j + 0.5) * res, g = T.groundAt(x, z), i = j * nx + k;
    if (g === null) { H[i] = NaN; S[i] = 0; continue; }
    const wall = T.cave && T.cave.wallDepth ? T.cave.wallDepth(x, z) : 99;
    if (wall <= 0 || T.solidAt(x, g + 1.5, z)) { H[i] = g; S[i] = SURF.indexOf('rock'); continue; }
    H[i] = g; S[i] = Math.max(0, SURF.indexOf(T.surfaceAt(x, z)));
  }
  const prof = []; // along the line every 2 m
  const L = h.line; let acc = 0;
  for (let i = 0; i < L.length - 1; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az); for (let t = 0; t < len; t += 2) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len; prof.push([acc + t, T.groundAt(x, z)]); } acc += len; }
  const meta = { hole: +hn, name: h.name, par: h.par, box: [x0, x1, z0, z1, res], nx, nz, SURF, tees: h.tees, tips: h.tips || null, pin: h.pin, line: h.line, targets: h.targets, yards: h.yards, prof,
    rocks: (h.rocks || []).filter(r => r.x > x0 && r.x < x1 && r.z > z0 && r.z < z1).map(r => [r.x, r.z, r.r || 3, r.type]), groves: (h.groves || []).map(g => [g.x, g.z, g.rx]) };
  fs.writeFileSync(`${outDir}/${tag}_h${hn}.json`, JSON.stringify(meta));
  fs.writeFileSync(`${outDir}/${tag}_h${hn}.bin`, Buffer.concat([Buffer.from(H.buffer), Buffer.from(S.buffer)]));
  console.log(tag, hn, nx, nz);
}
