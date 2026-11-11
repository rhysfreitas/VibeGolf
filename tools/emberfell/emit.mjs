// node tools/emberfell/emit.mjs : writes src/course/emberfell.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / scene.mjs / world.mjs and
// run this (a few minutes). Each hole carries:
//   field    its ground sampled every 2 m from the mountain as the book draws it (heights in 2 cm steps, NaN =
//            open air: the lava tube's trench and its skylights), engine surface codes (lava plays as 'water',
//            its bed 0.8 m under the drawn level), and m: what the paint shows that the code doesn't (black
//            flow, red cinder, grey ash, wall rock, rubble, forest floor, sulfur, crust, sinter, the hall's floor,
//            lava)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too: ash-grey sand by the greens ('sand'), red scoria waste out in the fairways ('waste')
//   rocks    what the ball hits: basalt blocks (boulders), lava trees (stone shells, tapering columns), the
//            clubhouse (a box that soaks)
//   plants   the kipuka's ohia, which play
//   frame    where the hole sits on the mountain (volcano-world.js draws COURSE.volc into it)
// COURSE.volc is the mountain once, in world space: a coarse height map from the summit to the shoulder's foot,
// and everything drawn (columns, tube mouths, steam, vents, geysers, the lavafall, the plume).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal } from './scene.mjs';
import { V, lavaAt, FALL, VENT, VENTS, GEYSERS, CAL, INSIDE, RIVERS } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { distLine } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/emberfell.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// plan surfaces -> the engine's ('desert' is native ground); greens and bunkers come from their outlines
const ENG = { flow: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'rough', scoria: 'rough', lava: 'water', rock: 'desert', rubble: 'desert', cinder: 'desert', ash: 'desert', forest: 'rough', sulfur: 'desert', hall: 'desert', void: 'void', crust: 'desert', sinter: 'desert' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'tee', 'water', 'void'];
export const MAT = { flow: 1, cinder: 2, ash: 3, rock: 4, rubble: 5, forest: 6, sulfur: 7, crust: 8, sinter: 9, hall: 10, lava: 11 };
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
const VOLC = { boulders: [], trees: [], lavatrees: [], columns: [], mouths: [], steam: [], vents: [], halls: [], geysers: GEYSERS.map(g => ({ at: g.at, r: g.r, erupt: g.erupt || 0, y: r1(V(...g.at)) })),
  fall: { top: [...FALL.top, r1(V(...FALL.top))], foot: [...FALL.foot, r1(lavaAt(...FALL.foot)?.level ?? V(...FALL.foot))], w: FALL.w },
  plume: { at: VENT.at, y: r1(V(...VENT.at) + VENT.h), r: VENT.r }, rim: CAL };
for (const v of VENTS) VOLC.vents.push([v.at[0], v.at[1], r1(V(...v.at)), v.r]);
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k], Y = y => r1(y + h.base), a = h.place.heading * Math.PI / 180;
  const P = (x, z) => { const q = W(x, z); return [r1(q[0]), r1(q[1])]; };
  for (const o of B.objs) {
    if (o.kind === 'boulder') VOLC.boulders.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (o.kind === 'tree') VOLC.trees.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (o.kind === 'lavatree') VOLC.lavatrees.push([...P(o.x, o.z), Y(o.base), r2(o.r), r1(o.h), o.seed % 9973]);
    else if (o.kind === 'column') VOLC.columns.push([...P(o.x, o.z), Y(o.base), Y(o.top), r2(o.r), o.seed % 9973]);
    else if (o.kind === 'mouth') VOLC.mouths.push({ x: P(o.x, o.z)[0], z: P(o.x, o.z)[1], y: Y(o.base), dir: r2(o.dir + a), w: o.w, depth: o.depth });
    else if (o.kind === 'steam') VOLC.steam.push([...P(o.x, o.z), Y(o.base), r1(o.r)]);
    else if (o.kind === 'vent') VOLC.vents.push([...P(o.x, o.z), Y(o.base), o.r]);
    else if (o.kind === 'hall') VOLC.halls.push({ p: o.pts.map(q => P(...q)), y: Y(o.base), h: o.h, roof: o.roof, rot: r2(o.rot + a) });
  }
}

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
    if (y !== null && s === 'lava') y -= 0.8;                           // lava: a bed under the drawn level
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
    const box = b.box, inside = B.inBunker(b);
    const o = outlineOf(inside, [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)], b.strip || b.wrap ? 0.8 : 0.5);
    if (!o) return null;
    const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
    return { x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: b.kind === 'sand' ? 'sand' : 'waste' };
  }).filter(Boolean);

  // what the ball hits: everything near this hole's play, into its frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  for (const [X, Z, y, r, hh] of VOLC.boulders) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'boulder', x: r1(x), z: r1(z), r: r1(r), h: r1(hh), y: r1(y - base), rot: r2(((x * 0.37 + z * 0.11) % 6.28 + 6.28) % 6.28), pe: 2.6 }); }
  for (const [X, Z, y, r, hh] of VOLC.lavatrees) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'hoodoo', x: r1(x), z: r1(z), r: r2(r), h: r1(hh), y: r1(y - base), cap: 0, taper: true }); }
  for (const H of VOLC.halls) { const p = H.p.map(v => L(...v)), c = [p.reduce((s, v) => s + v[0], 0) / 4, p.reduce((s, v) => s + v[1], 0) / 4];
    if (inBox(c[0], c[1], 40)) rocks.push({ type: 'box', x: r1(c[0]), z: r1(c[1]), w: r1(Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1])), d: r1(Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1])), rot: r2(Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0])), y: r1(H.y - base), h: r1(H.h + H.roof * 0.6), soak: 0.45 }); }
  for (const [X, Z, y, r, hh] of VOLC.trees) { const [x, z] = L(X, Z); if (inBox(x, z)) plants.push({ x: r1(x), z: r1(z), s: r2(Math.max(r / 3.4, hh / 13)), type: 'cotton', r: r2(((X * 7.3 + Z * 3.1) % 1 + 1) % 1) }); }

  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true }];
  const w = h.words || {};
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, h: b64(q), s: b64(ss), m: b64(ms) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base: r2(base) },
    green, bunkers, rocks, plants, card: { story: w.story, plays: w.plays, safe: w.safe, bold: w.bold, miss: w.miss } };
}

// the far mountain: heights every 12 m from beyond the summit to the shoulder's foot, with what it is (the paint
// codes above; lava cells carry the lava's level, open air the trench's floor 14 m down)
const WX0 = -2700, WX1 = 2700, WZ0 = -3800, WZ1 = 2300, WC = 12;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, w = worldAt(X, Z), k = j * wnx + i;
  wraw[k] = w.y === null ? (w.raw ?? V(X, Z)) : w.y; if (wraw[k] < wlo) wlo = wraw[k];
  wm[k] = w.y === null ? 12 : MAT[w.s] || (['fairway', 'fringe', 'green', 'tee'].includes(w.s) ? 13 : w.s === 'rough' || w.s === 'sand' || w.s === 'scoria' ? 14 : 0);
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 10);
VOLC.world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 10, h: b64(wq), m: b64(wm) };
process.stdout.write('world ');

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'emberfell', name: 'Emberfell', theme: 'volcano', altFt: COURSE.altFt,
  blurb: 'Nine holes on a volcano at dusk: four round the outside of the cone, one off the rim into the caldera, four inside it down to the lava lake and an island green. Lava plays as water.',
  voidText: ['Down the lava tube', 'Gone down the lava tube'],
  signature: { time: 'golden', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'hot' },
  teeSets: COURSE.teeSets, volc: VOLC };
const src = `// Emberfell: nine holes on a volcano at dusk. GENERATED by tools/emberfell/emit.mjs from the plan book's hole data
// (tools/emberfell/holes.mjs, scene.mjs, world.mjs): don't edit by hand. Each hole's ground is a sampled field
// (terrain.js prepField; open air for the lava tube's trench and skylights), lava plays as water, its green and
// bunkers are outlines over it, basalt blocks, lava trees and the clubhouse are rocks the ball hits, the kipuka's
// ohia play, and volcano-world.js draws COURSE.volc (the mountain once, in world space) into each hole's frame.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '), 'columns', VOLC.columns.length, 'lavatrees', VOLC.lavatrees.length);
