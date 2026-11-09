// node tools/review/sample.mjs <course> : sample each hole in a frame with the tee at the bottom and the pin up the page
// -> out/grid/<course>_h<n>.bin (float32 height, NaN = void; then uint8 surface) + out/grid/<course>.json. Then python3 tools/review/plans.py <course> draws them.
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, OUT as BASE } from './page.mjs';
import fs from 'fs';
const which = process.argv[2] || 'aerie';
const { HOLES, COURSE } = await loadCourse(which);
const OUT = BASE + '/grid/'; fs.mkdirSync(OUT, { recursive: true });
const SURF = ['void', 'tee', 'fairway', 'fringe', 'firstcut', 'rough', 'desert', 'sand', 'waste', 'water', 'green', 'rock'];
const RES = 1, back = COURSE.teeSets[0].id;
const meta = [];
HOLES.forEach((h, i) => {
  const T = createTerrain(h), tee = h.tees[back], pin = h.green.pins?.[0] || h.pin;
  const hd = Math.atan2(pin[0] - tee[0], -(pin[1] - tee[1])), cs = Math.cos(hd), sn = Math.sin(hd);
  const Wd = (lx, lz) => [tee[0] + lx * cs - lz * sn, tee[1] + lx * sn + lz * cs];
  const Lc = (x, z) => { const dx = x - tee[0], dz = z - tee[1]; return [dx * cs + dz * sn, -dx * sn + dz * cs]; };
  const line = h.line || [tee, pin];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (p, r) => { const [lx, lz] = Lc(p[0], p[1]); x0 = Math.min(x0, lx - r); x1 = Math.max(x1, lx + r); z0 = Math.min(z0, lz - r); z1 = Math.max(z1, lz + r); };
  line.forEach(p => grow(p, 75)); Object.values(h.tees).forEach(p => grow(p, 30)); grow(pin, 55);
  x0 = Math.floor(x0); z0 = Math.floor(z0); const W = Math.ceil((x1 - x0) / RES), H = Math.ceil((z1 - z0) / RES);
  const hb = new Float32Array(W * H), sb = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const [x, z] = Wd(x0 + c * RES, z0 + r * RES), g = T.groundAt(x, z), k = r * W + c;
    if (g === null) { hb[k] = NaN; sb[k] = 0; continue; }
    hb[k] = g; let s = T.surfaceAt(x, z); if (T.solidAt(x, g + 2.5, z)) s = 'rock';
    sb[k] = Math.max(0, SURF.indexOf(s));
  }
  fs.writeFileSync(`${OUT}${which}_h${i + 1}.bin`, Buffer.concat([Buffer.from(hb.buffer), Buffer.from(sb.buffer)]));
  const L = p => Lc(p[0], p[1]);
  // profile along the line (world), every 2 m
  const prof = []; let acc = 0;
  for (let k = 0; k < line.length - 1; k++) { const [ax, az] = line[k], [bx, bz] = line[k + 1], l = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s < l; s += 2) { const x = ax + (bx - ax) * s / l, z = az + (bz - az) * s / l, g = T.groundAt(x, z); prof.push([acc + s, g, g === null ? 'void' : T.surfaceAt(x, z)]); } acc += l; }
  meta.push({ n: i + 1, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, RES, tee: L(tee), tees: Object.fromEntries(Object.entries(h.tees).map(([k, v]) => [k, L(v)])),
    pin: L(pin), line: line.map(L), targets: (h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, p: L([t.x, t.z]) })),
    trees: (T.trees || []).map(t => [...L([t.x, t.z]), t.r || 3]), prof, teeY: T.groundAt(...tee), pinY: T.groundAt(...pin), teeSets: COURSE.teeSets });
});
fs.writeFileSync(`${OUT}${which}.json`, JSON.stringify({ SURF, holes: meta }));
console.log(which, meta.map(m => `${m.n}:${m.W}x${m.H}`).join(' '));
