// node tools/reclaim/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), plus the
// world map raster. Then: python3 plans.py, node sketch.mjs, node book.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, SURF, toWorld, toLocal, cityFill, RIVER } from './scene.mjs';
import { project, at, lengthOf, YD, distLine, headingAt } from './geo.mjs';
import { simulate } from '../../src/physics.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };

// a drive from p along direction dir (radians from -z, + right) over the hole's ground: the flight, and where
// it first meets anything solid above the ground
function drive(B, p, dir, shot) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = B.ground(p[0], p[1]) ?? 0;
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return ({ street: 'fairway', rubble: 'rough', stands: 'rough', deck: 'fairway', tee: 'fairway', building: 'rough', void: 'rough' })[v] || v; },
    voidY: -80, altFt: COURSE.altFt,
  });
  let hit = null; const pts = [];
  for (const q of r.pts) {
    const [x, z] = W(q.p[0], q.p[2]), y = y0 + q.p[1], d = Math.hypot(x - p[0], z - p[1]);
    if (!hit) for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hit = { d, y, what }; break; }
    pts.push([+d.toFixed(1), +y.toFixed(2), q.phase === 'flight' ? 0 : 1]);
  }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), hit };
}

const meta = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  // the box: the line plus 130 m, 80 m past the pin
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 130;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const x = x0 + c + 0.5, z = z0 + r + 0.5, g = B.ground(x, z);
    hgt[r * W + c] = g === null ? NaN : g; srf[r * W + c] = SURF.indexOf(B.surface(x, z));
  }
  fs.writeFileSync(`${OUT}/h${h.n}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  // the profile along the playing line, and along the bold line where there is one
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), B.solids(x, z).map(v => [v[0], v[1], v[2]])]); } return P; };
  const back = h.teePts.spire, tee0 = B.ground(...back);
  const dir0 = headingAt(h.line, 1);
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldLine) { const [a, b] = h.boldLine, d = Math.atan2(b[0] - a[0], -(b[1] - a[1])); bold = { line: h.boldLine, prof: along(h.boldLine), drives: Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, d, sh)])) }; }
  meta.push({ n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    teeY: tee0, pinY: B.ground(...h.pin), targets: (h.targets || []).map(t => {
      // the width of short grass across the line where the target sits
      const pr = project(h.line, ...t.at); let w = 0;
      if (B.surface(...t.at) === 'fairway') { let a = pr.off, b = pr.off; while (B.surface(...at(h.line, pr.s, a - 0.5)) === 'fairway' && a > pr.off - 120) a -= 0.5; while (B.surface(...at(h.line, pr.s, b + 0.5)) === 'fairway' && b < pr.off + 120) b += 0.5; w = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, pin: !!t.pin, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(w), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    objs: B.objs, prof: along(h.line), drives, bold, words: h.words, green: h.green, base: h.base, place: h.place,
    labels: [...(h.rubble || []).filter(r => r.label).map(r => [r.at, r.label]), ...(h.water || []).filter(w => w.label).map(w => [w.at, w.label]),
      ...(h.rift ? [[h.rift.pts[2], h.rift.label]] : []), ...(h.inlet ? [[h.inlet.pts[1], h.inlet.label]] : []), ...(h.pit ? [[h.pit.at, h.pit.label]] : []),
      ...(h.ramp && h.ramp.label ? [[h.ramp.from, h.ramp.label]] : [])] });
}
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets }));

// the world map: each point belongs to the hole whose line is nearest (within 150 m), else the city
const city = cityFill(), WR = 3, X0 = -900, X1 = 1500, Z0 = -1400, Z1 = 520;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH);
const loc = HOLES.map(toLocal), wl = HOLES.map(h => h.line.map(p => toWorld(h)(...p)));
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const X = X0 + (c + 0.5) * WR, Z = Z0 + (r + 0.5) * WR;
  let bi = -1, bd = 150;
  wl.forEach((L, k) => { const d = distLine(L, X, Z); if (d < bd) { bd = d; bi = k; } });
  let s = distLine(RIVER.pts, X, Z) < RIVER.w / 2 ? 'water' : 'street';
  if (bi >= 0) { const v = BUILT[bi].surface(...loc[bi](X, Z)); if (!(s === 'water' && v === 'street')) s = v; }
  ms[r * MW + c] = SURF.indexOf(s);
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.from(ms.buffer));
const worldObjs = BUILT.flatMap((B, i) => { const Wf = toWorld(HOLES[i]); return B.objs.filter(o => o.kind === 'bldg').map(o => ({ pts: o.pts.map(p => Wf(...p)), h: o.h, name: o.name })); });
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, city: city.map(b => ({ pts: b.pts, h: b.h, heap: b.kind === 'heap' })), bldgs: worldObjs,
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, line: wl[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })),
  river: RIVER }));
for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(13)} par ${m.par} ${JSON.stringify(m.yards)} tee ${m.teeY?.toFixed(1)} green ${m.pinY?.toFixed(1)} (${(m.pinY - m.teeY).toFixed(0)} m)`,
    Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}yd apex ${v.apex.toFixed(0)}m${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k}${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) + 'm y' + v.hit.y.toFixed(0) : ' clear'}`).join(' · ') : '');
}
console.log('total', meta.reduce((a, m) => a + m.yards.spire, 0), 'yd; par', meta.reduce((a, m) => a + m.par, 0), '; city blocks', city.length);
// checks: no hole's line, tees or green runs into another hole's buildings
{
  const foot = BUILT.flatMap((B, i) => B.objs.filter(o => o.kind === 'bldg').map(o => ({ n: HOLES[i].n, pts: o.pts.map(p => toWorld(HOLES[i])(...p)) })));
  const inP = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  for (const h of HOLES) {
    const W = toWorld(h), pts = [];
    for (let s = 0; s <= h.len; s += 5) for (const off of [-25, 0, 25]) pts.push(W(...at(h.line, s, off)));
    for (const p of Object.values(h.teePts)) pts.push(W(...p));
    const bad = new Set();
    for (const p of pts) for (const f of foot) if (inP(f.pts, ...p)) bad.add(`hole ${f.n}'s building`);
    if (bad.size) console.log('CLASH', h.n, h.name, [...bad].join(', '));
  }
}
