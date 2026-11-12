// node tools/lostvalley/emit.mjs : writes src/course/lostvalley.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs / life.mjs
// and run this (about 3 minutes). Built like tools/emberfell/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the valley as the book draws it (heights in 2 cm steps), with engine
//            surface codes (water and tar play as 'water': a stroke and a drop; their bed is 0.8 m under the level
//            the renderer draws; the river's gravel bars near the play are 'sand', a bunker) and m: what the paint
//            shows (meadow, jungle floor, rock, rubble, mud, gravel, the camp's trodden ground, tar, water)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too: pale river sand ('sand'), the 1st's long strip of sand and gravel ('waste')
//   rocks    what the ball hits: sandstone boulders, the spire on the 7th (a hoodoo), the fallen giant's log and the
//            Strangler's root arch (wedges along their length), the camp's hut and the lookout (boxes that soak)
//   plants   trees that play: cycads, tree ferns, monkey-puzzles (the giant on the 1st), broadleaves, swamp
//            cypresses, the Strangler (a fig: a trunk of fused roots under a canopy 34 m across), and the jungle on
//            the talus under the walls; each with its own body (h, cr, low), drawn by valley-world.js
//   frame    where the hole sits in the valley (valley-world.js draws COURSE.valley into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.valley is the valley once, in world space: a 10 m height map over the floor and the walls, a 50 m one out
// over the table mountain's top to the far mesas, water levels, the falls, the camp and the lookout, the bridge,
// the bones, and the animals (scenery only).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal } from './scene.mjs';
import { V, waterAt, nativeAt, wallD, bluffD, VALLEY, BLUFF, TAR, POOL, SHELF, GREAT_FALLS, BRIDGE, NEST_FALLS, CREEK, FAR } from './world.mjs';
import { CAMP, FALLS, LIFE } from './life.mjs';
import { edgeSegs, noise2 } from './shapes.mjs';
import { distLine, at, rnd } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/lostvalley.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// plan surfaces -> the engine's ('desert' is native ground: meadow, jungle floor, mud, rubble); greens and bunkers
// come from their outlines
const ENG = { meadow: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'rough', waste: 'rough', bar: 'sand', water: 'water', tar: 'water', cliff: 'desert', jungle: 'desert', mud: 'desert', gravel: 'desert', rubble: 'desert', camp: 'desert', void: 'void' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'void'];
// the paint byte (and the world map's): 0 meadow, 1 jungle floor, 2 rock, 3 rubble, 4 mud, 5 gravel, 6 the camp's
// trodden ground, 7 tar, 8 water, 9 the bluff's rock
const MAT = { meadow: 0, jungle: 1, cliff: 2, rubble: 3, mud: 4, gravel: 5, bar: 5, camp: 6, tar: 7, water: 8 };
const b64 = a => Buffer.from(a.buffer).toString('base64');
const WOR = HOLES.map(toWorld), LOC = HOLES.map(toLocal);
const gy = (X, Z) => { const w = worldAt(X, Z); return w.y ?? V(X, Z); };

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
const allOutlines = (inside, box, st) => loops(edgeSegs(inside, ...box, st)).map(L => thin(chaikin(L)).map(p => [r2(p[0]), r2(p[1])]));

// everything solid or drawn, once, in world space (absolute heights)
const VAL = { boulders: [], trees: [], spires: [], logs: [], figs: [], arches: [] };
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k], Y = y => r1(y + h.base);
  const P = (x, z) => { const q = W(x, z); return [r1(q[0]), r1(q[1])]; };
  for (const o of B.objs) {
    if (o.kind === 'boulder') VAL.boulders.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h)]);
    else if (['cycad', 'fern', 'conifer', 'broad', 'cypress'].includes(o.kind)) VAL.trees.push([...P(o.x, o.z), o.wet ? Y(o.base) : null, o.giant ? 'giant' : o.kind, r1(o.r), r1(o.h), o.low ?? null]);
    else if (o.kind === 'spire') VAL.spires.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.top)]);
    else if (o.kind === 'log') VAL.logs.push([...P(...o.a), Y(o.a[2]), ...P(...o.b), Y(o.b[2]), r1(o.r)]);
    else if (o.kind === 'strangler') VAL.figs.push([...P(o.x, o.z), Y(o.base), r1(o.r), r1(o.h), r1(o.canopy)]);
    else if (o.kind === 'arch') VAL.arches.push({ a: [...P(o.a[0], o.a[1]), Y(o.a[2])], b: [...P(o.b[0], o.b[1]), Y(o.b[2])], crown: o.crown, t: o.t, w: o.w });
  }
}
// no tree (but the giant and the fig, which the holes are built round) within 16 m of its crown of any tee of any
// hole, nor over another hole's line: a stand placed for one hole can stand where its neighbour's tee is
{
  const TEES = HOLES.flatMap((h, k) => Object.values(h.teePts).map(p => WOR[k](...p))), LINES = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
  VAL.trees = VAL.trees.filter(([X, Z, , kind, r]) => kind === 'giant' || (TEES.every(([x, z]) => Math.hypot(X - x, Z - z) > r + 16) && LINES.every(L => distLine(L, X, Z) > r + 6)));
}
// the jungle on the talus under the walls and on the ledges: broadleaves, tree ferns and a few monkey-puzzles, kept
// 60 m or more off every line of play (they play where they stand inside a hole's field)
{
  const R = rnd(907), WL = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
  for (let i = 0; i < 150000 && VAL.trees.length < 5600; i++) {
    const X = VALLEY.c[0] + (R() * 2 - 1) * 1150, Z = VALLEY.c[1] + (R() * 2 - 1) * 1250, d = wallD(X, Z);
    if (d < -25 || d > 85) continue;
    if (waterAt(X, Z)) continue;
    if (Math.min(...WL.map(L => distLine(L, X, Z))) < 60) continue;
    const sl = Math.abs(gy(X + 3, Z) - gy(X - 3, Z)) / 6 + Math.abs(gy(X, Z + 3) - gy(X, Z - 3)) / 6;
    if (sl > 0.9) continue;
    const t = R(), kind = t < 0.55 ? 'broad' : t < 0.85 ? 'fern' : 'conifer';
    const S = { fern: [[6, 10], [2.2, 3.4]], conifer: [[24, 38], [4.5, 7]], broad: [[14, 26], [6, 10]] }[kind];
    VAL.trees.push([r1(X), r1(Z), null, kind, r1(S[1][0] + R() * (S[1][1] - S[1][0])), r1(S[0][0] + R() * (S[0][1] - S[0][0])), null]);
  }
}

// a tree's body for trees.js (an explicit one: canopy from h*low to h, radius cr; a trunk tr thick under it)
const LOW = { cycad: 0.5, fern: 0.45, conifer: 0.35, broad: 0.3, cypress: 0.35, giant: 0.12 };
const TR = { cycad: 0.35, fern: 0.22, conifer: 0.7, broad: 0.6, cypress: 0.9, giant: 1.6 };
const plantOf = (x, z, kind, r, hh, low, y) => ({ x: r1(x), z: r1(z), type: kind, h: hh, cr: r, low: low ?? LOW[kind], tr: TR[kind], s: r2(hh / 10), r: r2(((x * 7.3 + z * 3.1) % 1 + 1) % 1), ...(y != null ? { y } : {}) });

// the root arch as wedges along its curve (archAt in scene.mjs: from the trunk to the foot, rising `crown` in a
// sine, `t` thick, w wide; its two ends run down into the ground as legs)
function archPieces(A) {
  const pt = t => { const [ax, az, ay] = A.a, [bx, bz, by] = A.b; const yb = ay + (by - ay) * t, lift = A.crown * Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.85; return [ax + (bx - ax) * t, az + (bz - az) * t, yb + lift + A.t / 2]; };
  const out = [], N = 12;
  for (let i = 0; i < N; i++) { const p = pt(i / N), q = pt((i + 1) / N); out.push({ from: p, to: q, w: [A.w, A.w], h: [A.t, A.t] }); }
  for (const t of [0.05, 0.95]) { const p = pt(t); out.push({ from: [p[0], p[1], p[2] - 7], to: [p[0], p[1], p[2] + 1], w: [A.w * 1.3, A.w], h: [A.w * 1.3, A.w] }); }
  return out;
}

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], L = LOC[hi], base = h.base;
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), w = worldAt(X, Z);
    let y = w.y - base;
    const s = w.s;
    if (s === 'water' || s === 'tar') y -= 0.8;                          // a bed under the drawn level
    const k = j * nx + i;
    hs[k] = y; ss[k] = CODES.indexOf(ENG[s] ?? 'desert'); ms[k] = s === 'cliff' && bluffD(X, Z) < 1.15 ? 9 : MAT[s] ?? 0;
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((hs[k] - y0) * 50);

  // the green and bunkers by their outlines (the field already has their shape)
  const gx = h.pin[0], gz = h.pin[1];
  const gOut = outlineOf((x, z) => B.gm(x, z) < 0, [gx - 60, gz - 60, gx + 60, gz + 60], 0.4);
  const green = { x: r1(gx), z: r1(gz), outline: gOut, keepGround: true, apron: 6, pins: [[r1(h.pin[0]), r1(h.pin[1])]] };
  const bunkers = [];
  for (const b of B.bunkers) {
    const box = b.box, inside = B.inBunker(b), clip = [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)];
    for (const o of allOutlines(inside, clip, b.strip || b.ring ? 0.8 : 0.5)) {
      if (o.length < 8) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: b.kind === 'waste' ? 'waste' : 'sand' });
    }
  }

  // what the ball hits: everything near this hole's play, into its frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  for (const [X, Z, y, r, hh] of VAL.boulders) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'boulder', x: r1(x), z: r1(z), r: r1(r), h: r1(hh), y: r1(y - base), rot: r2((x * 0.37 + z * 0.11) % 6.28), pe: 2.4 }); }
  for (const [X, Z, y, r, top] of VAL.spires) { const [x, z] = L(X, Z); if (inBox(x, z)) rocks.push({ type: 'hoodoo', x: r1(x), z: r1(z), r: r1(r * 0.62), h: r1(top), cap: r1(r * 1.25), y: r1(y - base), spire: true, draw: false }); }
  const wedge = (p, q, w, hh) => { const [ax, az] = L(p[0], p[1]), [bx, bz] = L(q[0], q[1]); return { type: 'wedge', from: [r1(ax), r1(az), r1(p[2] - base)], to: [r1(bx), r1(bz), r1(q[2] - base)], w: w.map(r1), h: hh.map(r1) }; };
  for (const [ax, az, ay, bx, bz, by, r] of VAL.logs) { const [x, z] = L((ax + bx) / 2, (az + bz) / 2); if (inBox(x, z, 30)) rocks.push({ ...wedge([ax, az, ay + r * 0.5], [bx, bz, by + r * 0.5], [r * 1.8, r * 1.2], [r * 1.6, r * 1.1]), log: true }); }
  for (const A of VAL.arches) { const [x, z] = L(A.a[0], A.a[1]); if (inBox(x, z, 60)) for (const p of archPieces(A)) rocks.push({ ...wedge(p.from, p.to, p.w, p.h), root: true }); }
  for (const c of CAMP) if (c.kind === 'hut') { const [x, z] = L(...c.at); if (!inBox(x, z)) continue; const y = gy(...c.at) - base, rot = c.rot - h.place.heading * Math.PI / 180;
    rocks.push({ type: 'box', x: r1(x), z: r1(z), w: c.w, d: c.l, rot: r2(rot), y: r1(y), h: r1(c.stilt + c.h + 1.2), soak: 0.45, hut: c.label || 'the hut' }); }
  for (const [X, Z, y, kind, r, hh, low] of VAL.trees) { const [x, z] = L(X, Z); if (inBox(x, z)) plants.push(plantOf(x, z, kind, r, hh, low, y != null ? r1(y - base) : null)); }
  for (const [X, Z, y, r, hh, can] of VAL.figs) { const [x, z] = L(X, Z); if (!inBox(x, z, 40)) continue;
    plants.push({ x: r1(x), z: r1(z), type: 'fig', h: hh, cr: can, low: 30 / hh, tr: r, s: r2(hh / 10), r: 0.5, y: r1(y - base) }); }

  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true, ...(h.goGreen ? { bold: true } : {}) }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    tips: { tee: h.tips.tee.map(r1), yards: h.tips.yards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base },
    green, bunkers, rocks, plants, card: h.words };
}

// the valley: heights every 10 m over the floor and the walls (what it is from worldAt, water at its level), and
// every 50 m out over the table mountain's top to the far mesas (the valley alone, V)
const WX0 = -1000, WX1 = 1320, WZ0 = -1960, WZ1 = 360, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i;
  const near = wallD(X, Z) < 120, w = near ? worldAt(X, Z) : { y: V(X, Z), s: nativeAt(X, Z) };
  wraw[k] = w.y; if (wraw[k] < wlo) wlo = wraw[k];
  wm[k] = MAT[w.s] ?? (['fairway', 'rough', 'fringe', 'green', 'tee', 'sand', 'waste'].includes(w.s) ? 10 : 0);
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
let far;
{
  const FX0 = -9000, FX1 = 9000, FZ0 = -10000, FZ1 = 8000, FC = 50, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) { const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i; fr[k] = Math.max(0, V(X, Z)); if (fr[k] < flo) flo = fr[k]; }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 2);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 2, pred: 1, h: b64(packHeights(fq, fnx)) };
}

// the falls: each one's path from the lip down the wall to its foot, the ground's height every 8 m
const falls = FALLS.map(F => {
  const n = Math.max(2, Math.ceil(Math.hypot(F.foot[0] - F.lip[0], F.foot[1] - F.lip[1]) / 8)), pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n, X = F.lip[0] + (F.foot[0] - F.lip[0]) * t, Z = F.lip[1] + (F.foot[1] - F.lip[1]) * t; pts.push([r1(X), r1(Z), r1(i === n ? gy(X, Z) : Math.max(V(X, Z), gy(X, Z)))]); }
  return { name: F.name, pts, w: F.w, big: !!F.big };
});
// the camp and the lookout, the animals, the bridge, the bones: scenery only (the hut and the lookout also play)
const camp = CAMP.map(c => ({ ...c, y: r1(gy(...c.at)) }));
const life = LIFE.map(a => ({ ...a, ...(a.y == null ? { y: r1(gy(...a.at)) } : {}), ...(a.wade ? { y: r1(waterAt(...a.at)?.level ?? gy(...a.at)) } : {}) }));
const bridge = { a: [...BRIDGE.a, r1(gy(...BRIDGE.a))], b: [...BRIDGE.b, r1(gy(...BRIDGE.b))] };
const kS = HOLES.findIndex(q => q.skeleton), toward = kS >= 0 ? WOR[kS](...at(HOLES[kS].line, 150)) : [BLUFF.c[0] + 30, BLUFF.c[1] + 30];
const kT = HOLES.findIndex(q => q.par === 3 && q.n === 4), tTee = WOR[kT](0, 0);
const bones = { bluff: { c: BLUFF.c, rx: BLUFF.rx, rz: BLUFF.rz, rot: BLUFF.rot, h: BLUFF.h, y: r1(V(...BLUFF.c, true)), toward: toward.map(r1) }, tar: { c: TAR.c, level: TAR.level, toward: tTee.map(r1) } };

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'lostvalley', name: 'The Lost Valley', theme: 'valley', altFt: COURSE.altFt,
  blurb: 'Nine holes in a hidden valley walled in by the cliffs of a table mountain, on a golden afternoon after rain: from the expedition\'s camp round the floor, up to a ledge on the east wall, and down to a green in the pool under the Great Falls. Tar plays as water; the animals are scenery.',
  signature: { time: 'golden', wind: 'calm', windFrom: 'random', weather: 'clear', temp: 'mild' },
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet,
  valley: { world, far, falls, camp, life, bridge, bones, pool: { ...POOL, shelf: SHELF }, greatFalls: GREAT_FALLS, nest: NEST_FALLS, creek: CREEK.pts, farMesas: FAR, floor: VALLEY.floor,
    trees: VAL.trees.map(([X, Z, y, kind, r, hh, low]) => [X, Z, y ?? r1(gy(X, Z)), kind, r, hh, low ?? LOW[kind]]),
    figs: VAL.figs, arches: VAL.arches, logs: VAL.logs, spires: VAL.spires, boulders: VAL.boulders } };
const src = `// The Lost Valley: nine holes in a hidden valley walled in by the cliffs of a table mountain. GENERATED by
// tools/lostvalley/emit.mjs from the plan book's hole data (tools/lostvalley/holes.mjs, world.mjs, life.mjs): don't
// edit by hand. Each hole's ground is a sampled field (terrain.js prepField), water and tar play as water, the river's
// gravel bars near the play as bunkers, its green and bunkers are outlines over it, boulders, the spire, the log, the
// root arch, the hut and the lookout are rocks the ball hits, its trees play (each with its own body), and
// valley-world.js draws COURSE.valley (the valley once, in world space) into each hole's frame. The tips tee is in
// the data, switched off: COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '));
