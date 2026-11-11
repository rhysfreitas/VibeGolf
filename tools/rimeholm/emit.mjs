// node tools/rimeholm/emit.mjs : writes src/course/rimeholm.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / scene.mjs and run this.
// Each hole carries:
//   field    its ground sampled every 2 m from the glacier as the book draws it (heights in 2 cm steps, NaN =
//            open air: the crevasses and the moulin) with engine surface codes, and m: what the paint shows
//            (bare rock, travertine) that the surface code doesn't
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too: black sand by the greens ('sand'), soft powder in the fairways ('powder')
//   rocks    what the ball hits: seracs and ice blocks (boxes), erratic boulders, the hall, the ice cave's roof,
//            the ice bridge (wedges)
//   plants   the spruce, which play
//   frame    where the hole sits on the glacier (ice-world.js draws COURSE.ice into it)
// COURSE.ice is the glacier once, in world space: a coarse height map for the far ground, and every drawn thing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal } from './scene.mjs';
import { WORLD } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt, distLine, project, seOutline, rnd } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/rimeholm.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// plan surfaces -> the engine's ('desert' is native ground: snow); greens and bunkers come from their outlines
const ENG = { snow: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'rough', powder: 'rough', water: 'water', ice: 'ice', rock: 'desert', rubble: 'desert', travertine: 'desert', hall: 'desert', void: 'void' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'tee', 'water', 'ice', 'void'];
const MAT = { rock: 1, travertine: 2, rubble: 3, hall: 4 };
const b64 = a => Buffer.from(a.buffer).toString('base64');
const WOR = HOLES.map(toWorld), LOC = HOLES.map(toLocal);

// chain marching-squares segments into closed loops; the biggest first
function loops(segs) {
  const key = p => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`, next = new Map();
  for (const [a, b] of segs) next.set(key(a), [a, b]);
  const used = new Set(), out = [];
  for (const [k0] of next) {
    if (used.has(k0)) continue;
    const L = []; let k = k0;
    while (next.has(k) && !used.has(k)) { used.add(k); const [a, b] = next.get(k); L.push(a); k = key(b); }
    if (L.length > 4) out.push(L);
  }
  const area = L => Math.abs(L.reduce((s, p, i) => { const q = L[(i + 1) % L.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  return out.sort((a, b) => area(b) - area(a));
}
const chaikin = L => L.flatMap((p, i) => { const q = L[(i + 1) % L.length]; return [[p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]]; });
const thin = (L, d = 0.7) => { const o = [L[0]]; for (const p of L) if (Math.hypot(p[0] - o.at(-1)[0], p[1] - o.at(-1)[1]) >= d) o.push(p); return o; };
const outlineOf = (inside, box, st = 0.4) => { const Ls = loops(edgeSegs(inside, ...box, st)); return Ls.length ? thin(chaikin(Ls[0])).map(p => [r2(p[0]), r2(p[1])]) : null; };

// everything drawn, once, in world space (absolute heights)
const ICE = { seracs: [], blocks: [], boulders: [], trees: [], icefalls: [], icicles: [], braziers: [], steam: [], water: [], halls: [], roofs: [], arches: [], longships: [], mammoths: [] };
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k], Y = y => r1(y + h.base), a = h.place.heading * Math.PI / 180;
  const P = (x, z) => { const q = W(x, z); return [r1(q[0]), r1(q[1])]; };
  for (const o of B.objs) {
    if (o.kind === 'serac') ICE.seracs.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h), (o.seed ?? 0) % 9973]);
    else if (o.kind === 'boulder') ICE.boulders.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (o.kind === 'tree') ICE.trees.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h), k]);
    else if (o.kind === 'icefall') ICE.icefalls.push([...P(o.x, o.z), Y(o.top), r1(o.len), r2(o.r), o.seed % 9973]);
    else if (o.kind === 'icicle') ICE.icicles.push([...P(o.x, o.z), Y(o.top), r1(o.len), r2(o.r), o.seed % 9973]);
    else if (o.kind === 'brazier') ICE.braziers.push([...P(o.x, o.z), Y(o.base)]);
    else if (o.kind === 'steam') ICE.steam.push([...P(o.x, o.z), Y(o.base), r1(o.r)]);
    else if (o.kind === 'hall') ICE.halls.push({ p: o.pts.map(q => P(...q)), y: Y(o.base), h: o.h, roof: o.roof, rot: r2(o.rot + a) });
    else if (o.kind === 'roof') ICE.roofs.push({ p: o.pts.map(q => P(...q)), y: Y(o.y), t: o.t });
    else if (o.kind === 'arch') ICE.arches.push({ a: [...P(o.a[0], o.a[1]), Y(o.a[2])], b: [...P(o.b[0], o.b[1]), Y(o.b[2])], h: o.h, w: o.w, t: o.t });
    else if (o.kind === 'longship') ICE.longships.push({ x: P(o.x, o.z)[0], z: P(o.x, o.z)[1], y: Y(o.y), len: o.len, beam: o.beam, rot: r2((o.rot || 0) + a), rise: o.rise || 0, out: o.out || 0 });
    else if (o.kind === 'mammoth') ICE.mammoths.push({ x: P(o.x, o.z)[0], z: P(o.x, o.z)[1], y: Y(o.base), rot: r2(o.dir + a) });
  }
}
for (const o of WORLD.objs) {
  const g = worldAt(o.x, o.z).y ?? worldAt(o.x, o.z).raw ?? 0;
  if (o.kind === 'serac') ICE.seracs.push([r1(o.x), r1(o.z), r1(g - 1), r1(o.r), r1(o.h), o.seed % 9973]);
  else if (o.kind === 'iceblock') ICE.blocks.push([r1(o.x), r1(o.z), r1(g - 0.6), r1(o.r), r1(o.h), r2(o.tilt), o.seed % 9973]);
}
for (const p of WORLD.peaks) (ICE.peaks ||= []).push([r1(p.x), r1(p.z), r1(p.r), r1(p.h)]);

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], L = LOC[hi], base = h.base;
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, w = worldAt(...W(x, z));
    let y = w.y === null ? null : w.y - base;
    const s = w.s;
    if (y !== null && s === 'water') y -= 0.8;                          // water: a bed under the drawn level
    const k = j * nx + i;
    hs[k] = y === null ? NaN : y; ss[k] = CODES.indexOf(ENG[s] ?? 'desert'); ms[k] = MAT[s] || 0;
    if (y !== null && y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Number.isNaN(hs[k]) ? -32768 : Math.round((hs[k] - y0) * 50);

  // the green and bunkers by their outlines (the field already has their shape)
  const gx = h.pin[0], gz = h.pin[1];
  const gOut = outlineOf((x, z) => B.gm(x, z) < 0, [gx - 60, gz - 60, gx + 60, gz + 60], 0.4);
  const green = { x: r1(gx), z: r1(gz), outline: gOut, keepGround: true, apron: 6, pins: [[r1(h.pin[0]), r1(h.pin[1])]] };
  const bunkers = B.bunkers.map(b => {
    const box = b.box || [b.x - 40, b.z - 40, b.x + 40, b.z + 40], inside = B.inBunker(b);
    const o = outlineOf(inside, [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)], b.strip ? 0.8 : 0.5);
    if (!o) return null;
    const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
    return { x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: b.kind === 'sand' ? 'sand' : 'powder' };
  }).filter(Boolean);

  // what the ball hits: everything drawn near this hole's play, into its frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const here = (X, Z) => L(X, Z);
  const near = (x, z, d) => distLine(h.line, x, z) < d;
  const box = (x, z, w, d, rot, y, hh, soak) => rocks.push({ type: 'box', x: r1(x), z: r1(z), w: r1(w), d: r1(d), rot: r2(rot || 0), y: r1(y), h: r1(hh), ...(soak ? { soak } : {}) });
  for (const [X, Z, y, r, hh, seed] of ICE.seracs) { const [x, z] = here(X, Z); if (inBox(x, z) && near(x, z, 260)) box(x, z, r * 1.7, r * 1.4, (seed % 628) / 100, y - base, hh, 0.25); }
  for (const [X, Z, y, r, hh] of ICE.blocks) { const [x, z] = here(X, Z); if (inBox(x, z) && near(x, z, 220)) box(x, z, r * 1.5, r * 1.2, 0, y - base, hh); }
  for (const [X, Z, y, r, hh] of ICE.boulders) { const [x, z] = here(X, Z); if (inBox(x, z)) rocks.push({ type: 'boulder', x: r1(x), z: r1(z), r: r1(r), h: r1(hh), y: r1(y - base), rot: r2((x * 0.37 + z * 0.11) % 6.28), pe: 2.6 }); }
  for (const H of ICE.halls) { const p = H.p.map(v => here(...v)), c = [p.reduce((s, v) => s + v[0], 0) / 4, p.reduce((s, v) => s + v[1], 0) / 4];
    if (inBox(c[0], c[1], 40)) box(c[0], c[1], Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]), Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]), H.y - base, H.h + H.roof * 0.6, 0.45); }
  for (const R of ICE.roofs) { const p = R.p.map(v => here(...v)), c = [p.reduce((s, v) => s + v[0], 0) / 4, p.reduce((s, v) => s + v[1], 0) / 4];
    if (inBox(c[0], c[1], 40)) box(c[0], c[1], Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]), Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]), R.y - base, R.t); }
  for (const A of ICE.arches) { const a = here(A.a[0], A.a[1]), b = here(A.b[0], A.b[1]); if (!inBox(a[0], a[1], 40)) continue;
    const n = 8; for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, P3 = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, A.a[2] + (A.b[2] - A.a[2]) * t + A.h * Math.sin(Math.PI * t) - base];
      const p = P3(t0), q = P3(t1); rocks.push({ type: 'wedge', from: [r1(p[0]), r1(p[1]), r1(p[2])], to: [r1(q[0]), r1(q[1]), r1(q[2])], w: [A.w, A.w], h: [A.t, A.t] }); } }
  // the longship's bow out of the ice: the hull, the dragon's neck and the mast stub (the sail is scenery)
  for (const S of ICE.longships) { if (!S.out) continue; const [cx, cz] = here(S.x, S.z); if (!inBox(cx, cz, 40)) continue;
    const r = S.rot - h.place.heading * Math.PI / 180, d = [Math.cos(r), Math.sin(r)], ph = S.rise * Math.PI / 180, yI = S.y + 0.6 - base, bu = S.len / 2 - S.out * Math.cos(ph);
    const Hp = (u, v) => [cx + d[0] * (bu + u * Math.cos(ph) - v * Math.sin(ph)), cz + d[1] * (bu + u * Math.cos(ph) - v * Math.sin(ph)), yI + u * Math.sin(ph) + v * Math.cos(ph)];
    const wedge = (a3, b3, w, t) => rocks.push({ type: 'wedge', from: a3.map(r1), to: b3.map(r1), w: [r1(w[0]), r1(w[1])], h: [r1(t[0]), r1(t[1])] });
    wedge(Hp(-1, 0), Hp(S.out, 1.2), [S.beam * 0.92, 1.0], [2.8, 1.6]);
    wedge(Hp(S.out, 1.6), Hp(S.out + 0.6, 5.6), [0.6, 0.5], [0.6, 0.5]);
    wedge(Hp(S.out * 0.32, -1.6), Hp(S.out * 0.32, 3.4), [0.4, 0.3], [0.4, 0.3]); }
  for (const [X, Z, y, r, hh, kk] of ICE.trees) { const [x, z] = here(X, Z); if (inBox(x, z)) plants.push({ x: r1(x), z: r1(z), s: r2(hh / 9), type: 'pine', r: r2(((X * 7.3 + Z * 3.1) % 1 + 1) % 1) }); }

  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, h: b64(q), s: b64(ss), m: b64(ms) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base },
    green, bunkers, rocks, plants, card: h.words };
}

// water to draw: each pool and the open water as an outline at its level (world space)
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const bx = [Math.min(...xs) - 120, Math.min(...zs) - 120, Math.max(...xs) + 120, Math.max(...zs) + 120];
  const isW = (x, z) => B.surface(x, z) === 'water';
  for (const Lp of loops(edgeSegs(isW, ...bx, 1))) {
    if (Lp.length < 8) continue;
    const ys = Lp.map(p => B.ground(...p, true)).filter(v => v !== null).sort((a, b) => a - b);
    const lvl = ys[Math.floor(ys.length / 2)] + h.base;
    const hot = (h.water || []).some(w => Lp.some(p => Math.hypot(p[0] - w.at[0], p[1] - w.at[1]) < Math.max(w.rx, w.rz) * 1.4));
    ICE.water.push({ p: thin(chaikin(Lp), 1).map(p => { const q = W(...p); return [r1(q[0]), r1(q[1])]; }), y: r2(lvl), hot: hot ? 1 : 0 });
  }
}

// the far glacier: heights every 10 m over the whole course and out past the peaks, with what it is
// (0 snow, 1 ice, 2 rock, 3 open air)
const WX0 = -1500, WX1 = 2700, WZ0 = -1900, WZ1 = 1700, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz);
let wlo = Infinity; const wraw = new Float32Array(wnx * wnz);
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, w = worldAt(X, Z), k = j * wnx + i;
  wraw[k] = w.y === null ? (w.raw ?? 0) - 25 : w.y; if (wraw[k] < wlo) wlo = wraw[k];
  wm[k] = w.y === null ? 3 : w.s === 'rock' ? 2 : w.s === 'ice' ? 1 : 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
ICE.world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, h: b64(wq), m: b64(wm) };

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'rimeholm', name: 'Rimeholm', theme: 'ice', altFt: COURSE.altFt,
  blurb: 'Nine holes across a glacier in the far north, played at night under the aurora. Packed-snow fairways run, crevasses swallow a wild ball, and hot springs keep the greens alive.',
  voidText: ['Into a crevasse', 'Gone down a crevasse'],
  signature: { time: 'night', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'cold' },
  teeSets: COURSE.teeSets, ice: ICE };
const src = `// Rimeholm: nine holes across a glacier at night under the aurora. GENERATED by tools/rimeholm/emit.mjs from the
// plan book's hole data (tools/rimeholm/holes.mjs): don't edit by hand. Each hole's ground is a sampled field
// (terrain.js prepField; open air for the crevasses and the moulin), its green and bunkers are outlines over it,
// seracs, ice blocks, boulders, the hall and the ice bridge are rocks the ball hits, its spruce play, and
// ice-world.js draws COURSE.ice (the glacier once, in world space) into each hole's frame.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '), 'seracs', ICE.seracs.length, 'blocks', ICE.blocks.length, 'water', ICE.water.length);
