// node dump.mjs <repo> <out.json> [holes...]: each hole's surface and ground on a 2 m grid, its line, tees, pin,
// targets, buildings, trees and wrecks, from the plan data in <repo>/tools/reclaim
import fs from 'fs'; import path from 'path';
const [repo, out, ...hs] = process.argv.slice(2);
const { HOLES } = await import(path.join(repo, 'tools/reclaim/holes.mjs'));
const { BUILT, SURF } = await import(path.join(repo, 'tools/reclaim/scene.mjs'));
const want = hs.length ? hs.map(Number) : HOLES.map(h => h.n);
const res = {};
for (const n of want) {
  const i = HOLES.findIndex(h => h.n === n), h = HOLES[i], B = BUILT[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs) - 130), x1 = Math.ceil(Math.max(...xs) + 130), z0 = Math.floor(Math.min(...zs) - 70), z1 = Math.ceil(Math.max(...zs) + 60);
  const C = 2, nx = Math.round((x1 - x0) / C) + 1, nz = Math.round((z1 - z0) / C) + 1, S = [], Y = [];
  for (let j = 0; j < nz; j++) for (let k = 0; k < nx; k++) { const x = x0 + k * C, z = z0 + j * C; S.push(SURF.indexOf(B.surface(x, z))); const g = B.ground(x, z); Y.push(g === null ? null : +g.toFixed(2)); }
  res[n] = { n, name: h.name, par: h.par, x0, z0, C, nx, nz, S, Y, line: h.line, teePts: h.teePts, pin: h.pin, yards: h.yards, tips: h.tipsPt ? { tee: h.tipsPt, yards: h.tipsYards } : null,
    targets: (h.targets || []).map(t => ({ name: t.name, at: t.at, bold: !!t.bold })),
    objs: B.objs.filter(o => ['bldg', 'tree', 'box', 'el', 'span'].includes(o.kind)).map(o => ({ kind: o.kind, pts: o.pts, x: o.x, z: o.z, r: o.r, h: o.h, a: o.a, b: o.b, w: o.w, label: o.label, name: o.name, open: o.open, deck: o.deck, rubble: o.rubble, girder: o.girder })),
    bunkers: (h.bunkers || []).map(b => ({ at: b.at, rx: b.rx, rz: b.rz, rot: b.rot || 0 })), SURF };
}
fs.writeFileSync(out, JSON.stringify(res));
console.log('wrote', out, Object.keys(res).join(' '));
