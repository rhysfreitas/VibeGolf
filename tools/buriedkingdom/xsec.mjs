// node tools/buriedkingdom/xsec.mjs <hole> <s,s,...> : cross-sections of a hole's ground (absolute heights and surfaces every 2 m, 80 m either side of the line) as JSON on stdout, for now-against-proposed sheets
import { HOLES } from './holes.mjs';
import { BUILT } from './scene.mjs';
import { at } from './geo.mjs';
const n = +process.argv[2], S = process.argv[3].split(',').map(Number), h = HOLES[n - 1], B = BUILT[n - 1], out = {};
for (const s of S) { out[s] = []; for (let o = -80; o <= 80; o += 2) { const p = at(h.line, s, o); out[s].push([o, +(B.ground(...p) + h.base).toFixed(2), B.surface(...p)]); } }
console.log(JSON.stringify(out));
