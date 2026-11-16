// node tools/labyrinth/sketch.mjs [tag...] : plan book round 1's views through the game's own camera (src/stance.js:
// 3.2 m behind the ball, 1.55 m up, a 50° vertical field of view, the ball 88% of the way down; at 844×390 that is
// 19° above level to 31° below and about 90° across), from the planned course: world.mjs's walls (each version's
// doors), every hole's ground and surfaces from scene.mjs, the flags, the low evening sun with real shadows.
// out/views/r1_<tag>_<view>.png and out/views/r1_notes.json (callouts projected through the same camera).
// Needs playwright (npm i --no-save playwright) and Chrome (CHROME=/usr/bin/google-chrome). The page is views.mjs's.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { wallsFor, floorAt, SUN, MAZE, P, TOWER, CISTERN, WATER } from './world.mjs';
import { PLAYED } from './scene.mjs';
import { BACK } from './holes.mjs';
import { at, project, lengthOf } from './geo.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..'), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const W = 844, H = 390, DPR = 2, YD = 0.9144;
const S = JSON.parse(fs.readFileSync(path.join(HERE, 'out/sample.json')));

// the ground: for each version set, the nearest play's ground and paint (within 130 m of its line), else the floor
const sets = { A: PLAYED.filter(B => !B.h.ver || B.h.ver === 'A'), B: PLAYED.filter(B => !B.h.ver || B.h.ver === 'B') };
const groundOf = ver => (X, Z) => { let best = null, bd = 130; for (const B of sets[ver]) { const d = project(B.h.line, X, Z).d; if (d < bd) { bd = d; best = B; } } return best ? [best.ground(X, Z), best.surface(X, Z)] : [floorAt(X, Z), 'floor']; };
const PAINT = { fairway: [0.43, 0.57, 0.3], rough: [0.36, 0.45, 0.26], floor: [0.42, 0.46, 0.3], green: [0.5, 0.68, 0.34], fringe: [0.46, 0.62, 0.32], tee: [0.46, 0.6, 0.33],
  rubble: [0.55, 0.52, 0.46], wall: [0.55, 0.52, 0.46], sand: [0.86, 0.8, 0.64], water: [0.25, 0.36, 0.42], penalty: [0.5, 0.4, 0.3] };
function floorMesh(ver) {
  const x0 = MAZE.x0 - 30, x1 = MAZE.x1 + 30, z0 = -MAZE.y1 - 30, z1 = -MAZE.y0 + 30, c = 2.5, nx = Math.round((x1 - x0) / c) + 1, nz = Math.round((z1 - z0) / c) + 1, G = groundOf(ver);
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * c, Z = z0 + j * c, k = (j * nx + i) * 3, [y, s] = G(X, Z), p = PAINT[s] || PAINT.floor;
    pos[k] = X; pos[k + 1] = y; pos[k + 2] = Z;
    let n = 0.93 + 0.1 * Math.sin(X * 1.7 + Z * 2.3) * Math.sin(X * 0.37 - Z * 0.53);
    if (s === 'fairway' || s === 'green') n *= 1 + 0.035 * Math.sign(Math.sin((X + Z) / 4));   // mowing stripes
    col[k] = p[0] * n; col[k + 1] = p[1] * n; col[k + 2] = p[2] * n;
  }
  return { nx, nz, pos: Array.from(pos), col: Array.from(col) };
}
function stance(B, ball, aim) {
  const back = 3.2, up = 1.55, fov = 50, ballAt = 0.88;
  let d = [aim[0] - ball[0], aim[1] - ball[2]]; const l = Math.hypot(...d); d = d.map(v => v / l);
  const pos = [ball[0] - d[0] * back, ball[1] + up, ball[2] - d[1] * back];
  pos[1] = Math.max(pos[1], B.ground(pos[0], pos[2]) + 0.5);
  const half = fov * Math.PI / 360, alpha = Math.atan2(pos[1] - ball[1], back), beta = Math.atan((2 * ballAt - 1) * Math.tan(half)), pitch = alpha - beta;
  return { pos, look: [pos[0] + d[0] * 100, pos[1] - 100 * Math.tan(pitch), pos[2] + d[1] * 100], ball };
}
function project3(cam, p) {
  const f = cam.look.map((v, i) => v - cam.pos[i]), fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = p.map((q, i) => q - cam.pos[i]), x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2], y = v[0] * u[0] + v[1] * u[1] + v[2] * u[2], z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
  if (z < 1) return null;
  const tv = Math.tan(25 * Math.PI / 180), th = tv * W / H, px = 50 + 50 * x / (z * th), py = 50 - 50 * y / (z * tv);
  return px < 2 || px > 98 || py < 3 || py > 97 ? null : [+px.toFixed(1), +py.toFixed(1)];
}

// the views: for each play, the tee (back tee, toward the first target or the pin), the landing (where the back
// tee's drive stopped, toward the pin) and the green (from 90 yd out on the line, toward the pin); the bold line's
// tee view on 3, 4 and 6; the Rampart and Court tees on the par 3s
const V = [];
const Bof = tag => PLAYED.find(B => `${B.h.n}${B.h.ver || ''}` === tag);
const TW = P(TOWER.at), TWR = [TW[0], 14 + 100, TW[1]];
for (const m of S.meta) {
  const B = Bof(m.tag), h = B.h, ver = h.ver || 'A', ball = p => [p[0], B.ground(...p) + 0.02, p[1]];
  const back = m.tees[BACK], safe = m.targets.find(t => !t.bold && !t.second), aim0 = h.par === 3 ? m.pin : safe ? safe.p : at(h.line, 220);
  const notes = [['the pin', [m.pin[0], m.pinY + 2, m.pin[1]]], ['the tower', TWR]];
  if (safe && h.par > 3) notes.push([`${safe.name} (${safe.d} yd)`, [safe.p[0], B.ground(...safe.p) + 1, safe.p[1]]]);
  const boldT = m.targets.find(t => t.bold);
  if (boldT) notes.push([`${boldT.name} (bold, ${boldT.d} yd)`, [boldT.p[0], B.ground(...boldT.p) + 1, boldT.p[1]]]);
  V.push({ name: `r1_${m.tag}_tee`, ver, B, ball: ball(back), aim: aim0, notes });
  if (h.par > 3) {
    const e = m.drives[BACK].end; V.push({ name: `r1_${m.tag}_land`, ver, B, ball: ball(e), aim: m.pin, notes });
    const g = at(h.line, h.len - 90 * YD); V.push({ name: `r1_${m.tag}_green`, ver, B, ball: ball(g), aim: m.pin, notes });
    if (boldT && !boldT.second) V.push({ name: `r1_${m.tag}_bold`, ver, B, ball: ball(back), aim: boldT.p, notes });
  } else {
    for (const k of ['rampart', 'court']) V.push({ name: `r1_${m.tag}_${k}`, ver, B, ball: ball(m.tees[k]), aim: m.pin, notes });
  }
}

const PAGE = fs.readFileSync(path.join(HERE, 'views.mjs'), 'utf8').match(/const PAGE = `([\s\S]*?)`;\n/)[1].replace('bank: [0.76,0.72,0.63] }', 'bank: [0.76,0.72,0.63], water: [0.2,0.3,0.36] }');
const want = process.argv.slice(2);
const list = V.filter(v => !want.length || want.some(w => v.name.startsWith('r1_' + w)));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await browser.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(1800000);
pg.on('pageerror', e => console.log('PAGEERR', e.message)); pg.on('console', m => m.type() === 'error' && console.log('console', m.text()));
await pg.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: PAGE, contentType: 'text/html' });
  try { return r.fulfill({ body: fs.readFileSync(path.join(REPO, u.pathname)), contentType: 'text/javascript' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); } });
await pg.goto('http://page.local/');
const NF = path.join(OUT, 'r1_notes.json'), notes = fs.existsSync(NF) ? JSON.parse(fs.readFileSync(NF)) : {};
let built = null;
for (const ver of ['A', 'B']) {
  const mine = list.filter(v => v.ver === ver); if (!mine.length) continue;
  const t0 = Date.now();
  const ws = wallsFor({ 3: ver, 7: ver }).map(w => ({ pts: w.pts, y0: w.y0, y1: w.ground ? Math.min(...w.pts.map(p => floorAt(...p))) - 0.6 : +w.y1, kind: w.kind === 'parapet' || w.kind === 'low' ? 'stone' : w.kind, top: w.top, shift: w.shift || null, shrink: w.shrink || 0 }));
  // the cistern's water and the 8th's pool as flat slabs at their levels (drawn as thin walls)
  const C = CISTERN, wat = [[[880, -C.y0], [1066, -C.y0], [1066, -C.y1], [880, -C.y1]]];
  for (const q of wat) ws.push({ pts: q, y0: WATER - 0.05, y1: WATER, kind: 'water', top: null });
  const flags = sets[ver].map(B => [B.h.pin[0], B.ground(...B.h.pin), B.h.pin[1]]);
  await pg.evaluate(D => window.build(D), { w: W, h: H, dpr: DPR, sun: SUN, walls: ws, floor: floorMesh(ver), flags });
  console.log(`built ${ver} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const v of mine) {
    const s = stance(v.B, v.ball, v.aim), t1 = Date.now(), url = await pg.evaluate(s => window.shot(s), s);
    fs.writeFileSync(path.join(OUT, v.name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    notes[v.name] = v.notes.map(([t, p]) => ({ t, at: project3(s, p) })).filter(n => n.at);
    console.log(v.name, ((Date.now() - t1) / 1000).toFixed(1) + 's');
  }
}
await browser.close();
fs.writeFileSync(NF, JSON.stringify(notes, null, 1));
