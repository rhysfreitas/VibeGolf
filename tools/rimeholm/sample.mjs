// node tools/rimeholm/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), plus the
// course map raster, and the rules checks. Then: python3 plans.py, node sketch.mjs, node book.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, CRACKS, LOC, WOR } from './scene.mjs';
import { WORLD } from './world.mjs';
import { project, at, lengthOf, YD, headingAt } from './geo.mjs';
import { simulate } from '../../src/physics.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const PHYS = { powder: 'sand', fringe: 'fairway', tee: 'fairway', ice: 'desert', rock: 'desert', travertine: 'desert', rubble: 'waste', snow: 'rough', hall: 'rough', void: 'rough' };

// a drive from p along direction dir (radians from -z, + right) over the hole's ground: the flight, and where
// it first meets anything solid above the ground
function drive(B, p, dir, shot) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = B.ground(p[0], p[1]) ?? 0;
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return PHYS[v] || v; },
    voidY: -80, altFt: COURSE.altFt,
  });
  let hit = null; const pts = [];
  for (const q of r.pts) {
    const [x, z] = W(q.p[0], q.p[2]), y = y0 + q.p[1], d = Math.hypot(x - p[0], z - p[1]);
    if (!hit) for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hit = { d, y, what }; break; }
    pts.push([+d.toFixed(1), +y.toFixed(2), q.phase === 'flight' ? 0 : 1]);
  }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), hit, rest: B.surface(ex, ez) };
}

const meta = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 140;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const x = x0 + c + 0.5, z = z0 + r + 0.5, g = B.ground(x, z);
    hgt[r * W + c] = g === null ? NaN : g; srf[r * W + c] = SURF.indexOf(B.surface(x, z));
  }
  fs.writeFileSync(`${OUT}/h${h.n}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), B.solids(x, z).map(v => [v[0], v[1], v[2]])]); } return P; };
  const back = h.teePts.mammoth, tee0 = B.ground(...back);
  const dir0 = headingAt(h.line, 1);
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldLine) { const [a, b] = h.boldLine, d = Math.atan2(b[0] - a[0], -(b[1] - a[1])); bold = { line: h.boldLine, prof: along(h.boldLine), drives: Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, d, sh)])) }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 45; x < h.pin[0] + 45; x++) for (let z = h.pin[1] - 45; z < h.pin[1] + 45; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  // the climb and the fall along the line (each run of 1 m or more)
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const labels = [];
  const L_ = (p, t) => labels.push([p, t]);
  for (const w of h.water || []) if (w.label) L_(w.at, w.label);
  for (const f of h.forms || []) if (f.label) L_(f.at, f.label);
  for (const c of h.cliffs || []) if (c.label) L_(c.at, c.label);
  for (const r of h.rubble || []) if (r.label) L_(r.at, r.label);
  for (const [p, t] of h.voidLabels || []) L_(at(h.line, ...p), t);
  if (h.lake) L_(at(h.line, 70, 40), h.lake.label);
  if (h.openWater) L_([h.openWater.at[0] + h.openWater.rx + 10, h.openWater.at[1]], h.openWater.label);
  if (h.moulin) L_(h.moulin.at, h.moulin.label);
  if (h.esker) L_(at(h.line, 140, 54), h.esker.label + ` (${h.esker.h} m up)`);
  for (const w of h.walls || []) if (w.label) L_(at(h.line, (w.s0 + Math.min(w.s1, h.len)) / 2, w.side * (w.off + 26)), w.label);
  if (h.falls) L_(at(h.line, h.falls.s, h.falls.off[1] + 14), h.falls.label);
  // cracks and scarps in this hole's frame (for the plan): each as its two edges, the lip edge marked
  const toHere = LOC[i], cr = [];
  const box = [x0, z0, x0 + W, z0 + H], inB = p => p[0] > box[0] && p[0] < box[2] && p[1] > box[1] && p[1] < box[3];
  for (const a of CRACKS) {
    const Wf = a.owner >= 0 ? WOR[a.owner] : (x, z) => [x, z], loc = P => P.map(p => toHere(...Wf(...p)).map(v => +v.toFixed(1)));
    if (a.obj.outline && a.obj.spec) {
      if (a.obj.open) { const o = a.obj.outline(2), L = loc(o.L), R = loc(o.R); if (L.some(inB) || R.some(inB)) cr.push({ L, R, lip: o.lipEdge }); }
      else { const P = loc(a.obj.scarpLine(2)); if (P.some(inB)) cr.push({ scarp: P, side: a.obj.lip.side }); }
    } else if (a.obj.outline) { const P = loc(a.obj.outline(90)); if (P.some(inB)) cr.push({ ring: P }); }
  }
  const wobjs = WORLD.objs.map(o => { const [x, z] = toHere(o.x, o.z); return { ...o, x, z }; }).filter(o => inB([o.x, o.z]));
  meta.push({ cracks: cr, wobjs, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    greenArea: gcells, teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), targets: (h.targets || []).map(t => {
      // the width of fairway straight across the line where the target sits
      const pr = project(h.line, ...t.at); let w = 0;
      if (B.surface(...t.at) === 'fairway') { let a = pr.off, b = pr.off; while (B.surface(...at(h.line, pr.s, a - 0.5)) === 'fairway' && a > pr.off - 120) a -= 0.5; while (B.surface(...at(h.line, pr.s, b + 0.5)) === 'fairway' && b < pr.off + 120) b += 0.5; w = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(w), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    objs: B.objs, prof, drives, bold, words: h.words, green: h.green, base: h.base, place: h.place, labels, voids: h.voids || [], openWater: h.openWater || null });
}
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets }));

// the course map: the glacier's surface and a hillshade from its heights
const WR = 3, X0 = -260, X1 = 1300, Z0 = -820, Z1 = 560;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y === null ? NaN : v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF,
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })),
  hall: (() => { const k = HOLES.findIndex(h => h.hall); const o = BUILT[k].objs.find(o => o.kind === 'hall'); return o.pts.map(p => toWorld(HOLES[k])(...p)); })() }));

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(18)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what : ''}`).join(' · ') : '');
  console.log('    green', m.greenArea, 'm2 ·', m.cracks.length, 'cracks in view ·', m.wobjs.length, 'scenery pieces');
  console.log('    targets', m.targets.map(t => `${t.name} ${t.d}yd ${t.surf} ${t.width}m`).join(' · '));
}
console.log('total', meta.reduce((a, m) => a + m.yards.mammoth, 0), 'yd; par', meta.reduce((a, m) => a + m.par, 0));
// checks: pins 3% or less, tees not on fairway (12 m clear), the roof 45 m over every tee
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; if (sl > 3) console.log('PIN', h.n, sl.toFixed(1) + '%');
  for (const [k, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.2) for (let r = 0; r < 16; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) console.log('TEE', h.n, k, 'fairway', near, 'm away');
    for (const [a] of B.solids(...p)) if (a - B.ground(...p) < 45) console.log('OVERHEAD', h.n, k, (a - B.ground(...p)).toFixed(0), 'm');
  }
}
