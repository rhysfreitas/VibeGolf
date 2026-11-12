// node tools/halcyon/heights.mjs <tag> : each hole's ground along its playing line (every 2 m, with the surface and
// the ground 12 m either side) and across its landing area, for the height-form proposal's before/after profiles.
// Writes out/heights/<tag>.json.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES } from './holes.mjs';
import { BUILT } from './scene.mjs';
import { headingAt, at } from './geo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url)), tag = process.argv[2] || 'now';
const out = HOLES.map((h, i) => {
  const B = BUILT[i], along = [];
  for (let s = -10; s <= h.len + 25; s += 2) {
    const p = at(h.line, Math.max(0, Math.min(h.len, s))), hd = headingAt(h.line, Math.max(0, Math.min(h.len - 1, s)));
    const ux = Math.sin(hd), uz = -Math.cos(hd), q = s < 0 ? [p[0] + ux * s, p[1] + uz * s] : s > h.len ? [p[0] + ux * (s - h.len), p[1] + uz * (s - h.len)] : p;
    along.push([s, +B.ground(...q).toFixed(2), B.surface(...q)]);
  }
  const sL = Math.min(h.len * 0.62, 228.6), p = at(h.line, sL), hd = headingAt(h.line, sL), rx = Math.cos(hd), rz = Math.sin(hd), across = [];
  for (let o = -60; o <= 60; o += 2) across.push([o, +B.ground(p[0] + rx * o, p[1] + rz * o).toFixed(2), B.surface(p[0] + rx * o, p[1] + rz * o)]);
  return { n: h.n, name: h.name, par: h.par, len: h.len, sL, along, across, tees: Object.fromEntries(Object.entries(h.teePts).map(([k, t]) => [k, B.ground(...t)])) };
});
fs.writeFileSync(path.join(HERE, 'out/heights', tag + '.json'), JSON.stringify(out));
console.log('wrote', tag);
