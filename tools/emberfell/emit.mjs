// node tools/emberfell/emit.mjs : writes src/course/emberfell.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and
// run this. Built like tools/rimeholm/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the mountain as the book draws it (heights in 2 cm steps, NaN = open
//            air: the lava tube's trench and its skylights) with engine surface codes (lava plays as 'water': a
//            stroke and a drop beside where it went in), and m: what the paint shows (fresh flow, rock, rubble,
//            red cinder, forest floor, sulfur, the clubhouse's floor, crust, sinter, lava)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too: ash-grey sand by the greens ('sand'), red scoria out in the fairways ('waste')
//   rocks    what the ball hits: boulders, the lava trees (stone shells), the clubhouse
//   plants   the kipuka's forest, which plays
//   frame    where the hole sits on the mountain (ember-world.js draws COURSE.ember into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.ember is the volcano once, in world space: a 10 m height map over the caldera and the shoulder, a coarse
// one out to the sea, and every drawn thing (lavafall, plume, vents, geysers, columns, the clubhouse).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal } from './scene.mjs';
import { V, lavaAt, FALL, VENT, VENTS, GEYSERS, LAKE, SEA } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { distLine } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/emberfell.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// plan surfaces -> the engine's ('desert' is native ground); greens and bunkers come from their outlines
const ENG = { flow: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'rough', scoria: 'rough', lava: 'water', rock: 'desert', rubble: 'desert', cinder: 'desert', ash: 'desert', forest: 'rough', sulfur: 'desert', hall: 'desert', void: 'void', crust: 'desert', sinter: 'desert' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'tee', 'water', 'void'];
// the paint byte (and the world map's): 0 ash, 1 fresh flow, 2 rock, 3 rubble, 4 red cinder, 5 forest floor,
// 6 sulfur, 7 the clubhouse's floor, 8 crust, 9 sinter, 10 lava, 11 open air
const MAT = { ash: 0, flow: 1, rock: 2, rubble: 3, cinder: 4, forest: 5, sulfur: 6, hall: 7, crust: 8, sinter: 9, lava: 10, void: 11 };
const b64 = a => Buffer.from(a.buffer).toString('base64');
const WOR = HOLES.map(toWorld), LOC = HOLES.map(toLocal);

function loops(segs) {   // chain marching-squares segments into closed loops; the biggest first
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
const EMB = { boulders: [], trees: [], lavaTrees: [], columns: [], halls: [], steam: [], vents: [], mouths: [], geysers: [], fall: null, plume: null };
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k], Y = y => r1(y + h.base), a = h.place.heading * Math.PI / 180;
  const P = (x, z) => { const q = W(x, z); return [r1(q[0]), r1(q[1])]; };
  for (const o of B.objs) {
    if (o.kind === 'boulder') EMB.boulders.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (o.kind === 'tree') EMB.trees.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (o.kind === 'lavatree') EMB.lavaTrees.push([...P(o.x, o.z), Y(o.base), r2(o.r), r1(o.h)]);
    else if (o.kind === 'column') EMB.columns.push([...P(o.x, o.z), Y(o.base), Y(o.top), r2(o.r), o.seed % 9973]);
    else if (o.kind === 'steam') EMB.steam.push([...P(o.x, o.z), Y(o.base), r1(o.r)]);
    else if (o.kind === 'vent') EMB.vents.push([...P(o.x, o.z), Y(o.base), r1(o.r)]);
    else if (o.kind === 'mouth') EMB.mouths.push([...P(o.x, o.z), Y(o.base), r2(o.dir + a), r1(o.w)]);
    else if (o.kind === 'hall') EMB.halls.push({ p: o.pts.map(q => P(...q)), y: Y(o.base), h: o.h, roof: o.roof });
  }
}
const gy = (X, Z) => { const w = worldAt(X, Z); return w.y ?? w.raw ?? V(X, Z); };
for (const v of VENTS) EMB.vents.push([v.at[0], v.at[1], r1(gy(...v.at)), v.r]);
for (const g of GEYSERS) EMB.geysers.push([g.at[0], g.at[1], r1(gy(...g.at)), g.r, g.erupt || 0]);
// the lavafall: its path down the wall from the lip to the pool, the ground's height every 6 m
{ const n = Math.ceil(Math.hypot(FALL.foot[0] - FALL.top[0], FALL.foot[1] - FALL.top[1]) / 6), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, X = FALL.top[0] + (FALL.foot[0] - FALL.top[0]) * t, Z = FALL.top[1] + (FALL.foot[1] - FALL.top[1]) * t; pts.push([r1(X), r1(Z), r1(Math.max(V(X, Z), gy(X, Z)))]); }
  EMB.fall = { pts, w: FALL.w }; }
EMB.plume = { at: VENT.at, r: VENT.r, y: r1(V(...VENT.at)) };
EMB.lake = LAKE.level; EMB.sea = SEA.y;

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
    if (y !== null && s === 'lava') y -= 0.8;                          // lava: a bed under the drawn level
    const k = j * nx + i;
    hs[k] = y === null ? NaN : y; ss[k] = CODES.indexOf(ENG[s] ?? 'desert'); ms[k] = MAT[s] ?? 0;
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
    const o = outlineOf(inside, [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)], b.strip || b.wrap ? 0.8 : 0.5);
    if (!o) return null;
    const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
    return { x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: b.kind === 'sand' ? 'sand' : 'waste' };
  }).filter(Boolean);

  // what the ball hits: everything near this hole's play, into its frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  // a rock's base is the lowest ground under its footprint, so on a slope its downhill edge meets the ground (set at
  // its centre's height, a boulder on the 9th's tumulus overhung the slope and a ball rolled in under its belly and
  // stuck there)
  const footBase = (X, Z, r, y) => { let lo = Infinity; for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 4, q = k === 8 ? [X, Z] : [X + Math.cos(a) * r, Z + Math.sin(a) * r], w = worldAt(...q); if (w.y !== null) lo = Math.min(lo, w.y); } return Math.min(y, lo); };
  for (const [X, Z, y, r, hh] of EMB.boulders) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'boulder', x: r1(x), z: r1(z), r: r1(r), h: r1(hh), y: r1(footBase(X, Z, r, y) - base), rot: r2((x * 0.37 + z * 0.11) % 6.28), pe: 2.6 }); }
  for (const [X, Z, y, r, hh] of EMB.lavaTrees) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'box', x: r1(x), z: r1(z), w: r1(r * 1.7), d: r1(r * 1.7), rot: r2((X * 0.71 + Z * 0.3) % 6.28), y: r1(footBase(X, Z, r * 0.85, y) - base), h: r1(hh), soak: 0.3 }); }
  for (const H of EMB.halls) { const p = H.p.map(v => L(...v)), c = [p.reduce((s, v) => s + v[0], 0) / 4, p.reduce((s, v) => s + v[1], 0) / 4];
    if (inBox(c[0], c[1], 40)) rocks.push({ type: 'box', x: r1(c[0]), z: r1(c[1]), w: r1(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])), d: r1(Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1])), rot: r2(Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0])), y: r1(H.y - base), h: r1(H.h + H.roof * 0.6), soak: 0.45 }); }
  for (const [X, Z, y, r, hh] of EMB.trees) { const [x, z] = L(X, Z); if (inBox(x, z)) plants.push({ x: r1(x), z: r1(z), s: r2(hh / 9), type: 'oak', r: r2(((X * 7.3 + Z * 3.1) % 1 + 1) % 1) }); }

  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    tips: h.tips,
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base },
    green, bunkers, rocks, plants, card: h.words };
}

// the mountain: heights every 10 m over the caldera and the shoulder (what it is from worldAt), and every 50 m out
// to the sea (the mountain alone, V)
const WX0 = -2000, WX1 = 1800, WZ0 = -3300, WZ1 = 1500, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, w = worldAt(X, Z), k = j * wnx + i;
  wraw[k] = w.y === null ? (w.raw ?? V(X, Z)) - 14 : w.y; if (wraw[k] < wlo) wlo = wraw[k];
  wm[k] = w.y === null ? MAT.void : MAT[w.s] ?? 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
EMB.world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
{
  const FX0 = -10000, FX1 = 10000, FZ0 = -11500, FZ1 = 8500, FC = 50, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) { const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i; fr[k] = Math.max(-60, V(X, Z)); if (fr[k] < flo) flo = fr[k]; }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 2);
  EMB.far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 2, pred: 1, h: b64(packHeights(fq, fnx)) };
}

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'emberfell', name: 'Emberfell', theme: 'ember', altFt: COURSE.altFt,
  blurb: 'Nine holes on a volcano at dusk: out across the black flows of its shoulder, through the Notch in the rim, and down into the caldera to a green on an island in the lava lake. Lava plays as water.',
  voidText: ['Into the lava tube', 'Gone into the lava tube'],
  signature: { time: 'golden', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'warm' },
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet, ember: EMB };
const src = `// Emberfell: nine holes on a volcano at dusk. GENERATED by tools/emberfell/emit.mjs from the plan book's hole data
// (tools/emberfell/holes.mjs, world.mjs): don't edit by hand. Each hole's ground is a sampled field (terrain.js
// prepField; open air for the lava tube), lava plays as water, its green and bunkers are outlines over it,
// boulders, lava trees and the clubhouse are rocks the ball hits, the kipuka's forest plays, and ember-world.js
// draws COURSE.ember (the volcano once, in world space) into each hole's frame. The tips tee is in the data,
// switched off: COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '));
