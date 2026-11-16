// node tools/labyrinth/grids.mjs : the green grids (heights in each green's own frame, 1 m, for the green diagrams)
// and the course map (the floor and every hole's surfaces on a 4 m grid, every wall), for plans.py. Quick.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLAYED, SURF } from './scene.mjs';
import { walls, floorAt, worldSurface, MAZE, TOWER, P } from './world.mjs';
import { HOLES, BACK, playName } from './holes.mjs';
import { project } from './geo.mjs';
import { greenStats } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
for (const B of PLAYED) {
  const h = B.h, tag = `${h.n}${h.ver || ''}`, N = 61, st = 1, half = (N - 1) / 2 * st, ec = Math.cos(h.head), es = Math.sin(h.head);
  const H = [], GM = [], S = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const u = -half + c * st, v = half - r * st, X = h.pin[0] + u * ec + v * es, Z = h.pin[1] + u * es - v * ec;
    H.push(+B.ground(X, Z).toFixed(3)); GM.push(+B.gm(X, Z).toFixed(2)); S.push(SURF.indexOf(B.surface(X, Z)));
  }
  const gs = greenStats(B), areas = gs.areas.map(p => { const [u, v] = B.gUV(p.x, p.z); return [+u.toFixed(1), +v.toFixed(1)]; });
  fs.writeFileSync(`${OUT}/green${tag}.json`, JSON.stringify({ N, step: st, h: H, gm: GM, s: S, areas, pin: [0, 0] }));
}
// the course map: 4 m cells, X -120..1230, Z -1395..120 (the maze and 60 m round it)
const WR = 4, X0 = MAZE.x0 - 60, Z0 = -MAZE.y1 - 60, MW = Math.ceil((MAZE.x1 - MAZE.x0 + 120) / WR), MH = Math.ceil((MAZE.y1 - MAZE.y0 + 120) / WR);
const ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
const own = PLAYED.filter(B => !B.h.ver || B.h.ver === 'A');
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const X = X0 + (c + 0.5) * WR, Z = Z0 + (r + 0.5) * WR;
  let best = null, bd = 130;
  for (const B of own) { const d = project(B.h.line, X, Z).d; if (d < bd) { bd = d; best = B; } }
  const s = best ? best.surface(X, Z) : (worldSurface(X, Z) === 'water' ? 'water' : worldSurface(X, Z) === 'rubble' ? 'rubble' : 'floor');
  ms[r * MW + c] = SURF.indexOf(s); mh[r * MW + c] = best ? best.ground(X, Z) : floorAt(X, Z);
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
const W = walls().map(w => ({ pts: w.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]), h: +(+w.y1 - floorAt(...w.pts[0])).toFixed(1), kind: w.kind, ground: !!w.ground, only: w.only || null, hole: w.hole || null }));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, walls: W, tower: { at: P(TOWER.at), half: TOWER.half },
  holes: HOLES.map(h => ({ n: h.n, name: h.name, par: h.par, line: h.line, tee: h.teePts[BACK], pin: h.pin, alt: (h.versions || []).map(v => ({ line: v.line, pin: v.pin })) })) }));
console.log('greens and map written');
