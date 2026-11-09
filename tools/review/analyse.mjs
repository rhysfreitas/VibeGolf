// node tools/review/analyse.mjs <course> : each hole against the course-design rules (docs/COURSE-DESIGN.md):
// height change, bends (+ = right), carries, fairway width where a drive lands, green surrounds, steps beside
// fairway, targets. Prints a summary and writes tools/review/out/<course>.json
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, OUT, along, lineLen } from './page.mjs';
import fs from 'fs';
const which = process.argv[2] || 'aerie';
const M = await loadCourse(which);
const { HOLES, COURSE } = M, back = COURSE.teeSets[0].id, fwd = COURSE.teeSets.at(-1).id;
const SHORT = new Set(['fairway', 'fringe', 'green', 'tee']);
const out = [];
HOLES.forEach((h, i) => {
  const T = createTerrain(h), g = (x, z) => T.groundAt(x, z), sf = (x, z) => T.surfaceAt(x, z);
  const [tx, tz] = h.tees[back], ty = g(tx, tz), pin = h.green.pins?.[0] || h.pin, py = g(pin[0], pin[1]);
  const L = h.line || [h.tees[back], ...(h.targets || []).filter(t => !t.pin).slice(0, 1).map(t => [t.x, t.z]), pin], len = lineLen(L);
  // shape: turn at each bend (positive = right)
  const turns = [];
  for (let k = 1; k < L.length - 1; k++) {
    const d1 = [L[k][0] - L[k - 1][0], L[k][1] - L[k - 1][1]], d2 = [L[k + 1][0] - L[k][0], L[k + 1][1] - L[k][1]];
    const ang = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1]) * 180 / Math.PI;
    if (Math.abs(ang) > 8) turns.push(Math.round(ang));
  }
  // profile along the line: every 5 m; carries = stretches with no ground or a drop of 6 m+ below the line's ends
  const prof = []; for (let s = 0; s <= len; s += 5) { const [x, z] = along(L, s); prof.push([s, g(x, z), sf(x, z)]); }
  const gaps = []; let st = null;
  for (const [s, y, f] of prof) { const bad = y === null || f === 'water' || f === 'void' || (which === 'redmesa' && f === 'desert' && y < Math.min(ty, py) - 6); if (bad && st === null) st = s; if (!bad && st !== null) { gaps.push([st, s]); st = null; } }
  const ys = prof.map(p => p[1]).filter(y => y !== null), hi = Math.max(...ys), lo = Math.min(...ys);
  // landing width at the drive (par 4/5: 230 m; par 3: none), across the line: fairway, playable, and steps
  let land = null;
  if (h.par > 3) {
    const s = Math.min(230, len * 0.6), [ax, az, ux, uz] = along(L, s), nx = -uz, nz = ux, y0 = g(ax, az);
    const row = []; for (let o = -60; o <= 60; o += 1) { const x = ax + nx * o, z = az + nz * o; row.push([o, g(x, z), sf(x, z)]); }
    const run = test => { let a = 0, b = 0; while (a > -60 && test(row[60 + a - 1])) a--; while (b < 60 && test(row[60 + b + 1])) b++; return [a, b]; };
    const fw = run(r => r[2] === 'fairway' || r[2] === 'fringe'), play = run(r => r[1] !== null && Math.abs(r[1] - (y0 ?? 0)) < 4 && !['water', 'void', 'sand'].includes(r[2]));
    land = { s: Math.round(s), surf: sf(ax, az), fairway: fw[1] - fw[0], playable: play[1] - play[0], left: row.slice(0, 60).map(r => r[2][0]).join(''), right: row.slice(61).map(r => r[2][0]).join('') };
  }
  // green surround: rings at 6 and 14 m beyond the green's edge
  const G = h.green, R = Math.max(G.rx, G.rz), rings = {};
  for (const d of [6, 14]) {
    let down = 0, up = 0, voids = 0, short = 0, n = 0;
    for (let a = 0; a < 360; a += 10) { const r = a * Math.PI / 180, x = G.x + Math.cos(r) * (G.rx + d), z = G.z + Math.sin(r) * (G.rz + d), y = g(x, z), f = sf(x, z); n++;
      if (y === null || f === 'void') { voids++; continue; } if (y < py - 3) down++; if (y > py + 3) up++; if (SHORT.has(f)) short++; }
    rings[d] = { down: Math.round(down / n * 100), up: Math.round(up / n * 100), void: Math.round(voids / n * 100), short: Math.round(short / n * 100) };
  }
  // fairway edges: fairway cells (2 m) within 10 m of a step of 3 m+ up or down (to other ground) or of the void
  let fwN = 0, stepUp = 0, stepDown = 0, edgeVoid = 0; const spots = [];
  const xs = [], zs = []; for (const p of L) { xs.push(p[0]); zs.push(p[1]); }
  for (let x = Math.min(...xs) - 90; x <= Math.max(...xs) + 90; x += 2) for (let z = Math.min(...zs) - 90; z <= Math.max(...zs) + 90; z += 2) {
    if (sf(x, z) !== 'fairway') continue; const y = g(x, z); if (y === null) continue; fwN++;
    let u = false, dn = false, v = false;
    for (let a = 0; a < 8; a++) { const r = a * Math.PI / 4; for (const d of [5, 10]) { const y2 = g(x + Math.cos(r) * d, z + Math.sin(r) * d); if (y2 === null) v = true; else if (y2 > y + 3) u = true; else if (y2 < y - 3) dn = true; } }
    if (u) stepUp++; if (dn) stepDown++; if (v) edgeVoid++;
    if ((u || dn) && spots.length < 400) spots.push([x, z, u ? 1 : -1]);
  }
  // cluster the step spots to name where they are along the hole
  const where = []; for (const [x, z, k] of spots) { let best = 1e9, bs = 0; for (let s = 0; s <= len; s += 5) { const [ax, az] = along(L, s), d = Math.hypot(ax - x, az - z); if (d < best) { best = d; bs = s; } } where.push([Math.round(bs / 10) * 10, k]); }
  const byS = {}; for (const [s, k] of where) { byS[s] = byS[s] || [0, 0]; byS[s][k > 0 ? 0 : 1]++; }
  out.push({ n: i + 1, name: h.name, par: h.par, yards: h.yards[back], fwdYards: h.yards[fwd], elev: Math.round(py - ty), hi: Math.round(hi - ty), lo: Math.round(lo - ty), turns, gaps: gaps.map(([a, b]) => [a, b - a]), land, rings, green: { style: G.style, raise: G.raise, falseFront: G.falseFront, size: `${G.rx}x${G.rz}` },
    fairwayEdges: { cells: fwN, stepUp: Math.round(stepUp / fwN * 100), stepDown: Math.round(stepDown / fwN * 100), void: Math.round(edgeVoid / fwN * 100), along: byS },
    targets: (h.targets || []).filter(t => !t.pin).map(t => `${t.name}:${sf(t.x, t.z)}`), bunkers: (h.bunkers || []).length, landforms: (h.landforms || []).map(l => l.type).join(' '), rocks: (h.rocks || []).length, groves: (h.groves || []).length, water: (h.water || []).length + (h.rivers || []).length });
});
fs.writeFileSync(`${OUT}/${which}.json`, JSON.stringify(out, null, 1));
for (const o of out) {
  console.log(`\n${o.n} ${o.name} par ${o.par} ${o.yards} yd (fwd ${o.fwdYards})  elev ${o.elev > 0 ? '+' : ''}${o.elev} m (line hi ${o.hi}, lo ${o.lo})  turns ${o.turns.join(',') || 'straight'}  carries ${o.gaps.map(g => g[1] + 'm@' + g[0]).join(' ') || 'none'}`);
  if (o.land) console.log(`  landing @${o.land.s}m on ${o.land.surf}: fairway ${o.land.fairway} m, playable ${o.land.playable} m`);
  console.log(`  green ${o.green.style} ${o.green.size}${o.green.raise ? ' raise ' + o.green.raise : ''}${o.green.falseFront ? ' ff ' + o.green.falseFront : ''}  ring6 ${JSON.stringify(o.rings[6])} ring14 ${JSON.stringify(o.rings[14])}`);
  console.log(`  fairway edges: ${o.fairwayEdges.stepUp}% near a rise, ${o.fairwayEdges.stepDown}% near a drop, ${o.fairwayEdges.void}% near void; along ${JSON.stringify(o.fairwayEdges.along)}`);
  console.log(`  targets ${o.targets.join(' | ') || 'none'}; bunkers ${o.bunkers}, landforms ${o.landforms || '-'}, rocks ${o.rocks}, groves ${o.groves}, water ${o.water}`);
}
