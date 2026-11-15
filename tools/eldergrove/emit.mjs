// node tools/eldergrove/emit.mjs : writes src/course/eldergrove.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and run
// this (about a minute). Built like tools/wreckersreach/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the forest as the book draws it (worldAt: every hole's own ground
//            blended), heights in 2 cm steps, with engine surface codes: fairway, fringe, tee, moss 'firstcut', fern
//            and the meadow 'rough', leaf litter 'beach' (firm, it runs), root and bark 'desert', sand, the brook and
//            the pool 'water' (bed 0.8 m under the drawn level); and m: what the paint shows (grove-world.js). The
//            Stair's decks are ground for the ball (each a 10 x 12 m pad at its tee's height, m 9); `deckFloor` is the
//            floor under them, which the game draws instead, with the limb and the deck over it
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  the hole's sand by its outlines
//   rocks    what the ball hits besides the trees, draw: false (grove-world.js draws them): the root plate and the
//            burnt shell's walls (boxes that soak: a ball that hits them drops at their foot)
//   plants   the giants near the play as the game's tree bodies (trees.js: h, cr, low, tr; soak 0.45, so a ball
//            that hits a trunk drops at its foot about half the time; the crown 60-100 m up); dy sets the trunk's
//            foot to the plan's (the low side of its root flare)
//   frame    where the hole sits in the forest (grove-world.js draws COURSE.grove into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.grove is the forest once, in world space: a 10 m height map over the course and a 60 m one out past it (with
// the paint), every giant (placed and far), the heart tree, the root plate and the shell, the Stair's decks, limbs
// and stair, the pool's level.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal, ALLTREES, WALLS, DECKS, LIMBS, STAIRS, WL } from './scene.mjs';
import { V, waterAt, POOL, HEART, FALLEN, ROOTPLATE, SHELL, SITES, pitMound, dryK, openAt, fallenAt } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { distLine } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/eldergrove.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ENG = { litter: 'beach', fern: 'rough', moss: 'firstcut', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'sand', root: 'desert', meadow: 'rough', water: 'water', bark: 'desert', void: 'void' };
const CODES = ['rough', 'firstcut', 'fairway', 'fringe', 'tee', 'water', 'sand', 'beach', 'desert', 'void'];
// the paint byte (and the world map's): 0 leaf litter, 1 fern, 2 moss, 3 root, 4 bark (the fallen giant's flanks,
// the root plate), 5 meadow, 6 sand, 8 water, 9 a deck (grown, not ground), 10 mown ground (fairway, collar, green, tee)
const MAT = { litter: 0, fern: 1, moss: 2, root: 3, bark: 4, meadow: 5, sand: 6, water: 8, fairway: 10, fringe: 10, green: 10, tee: 10 };
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
const allOutlines = (inside, box, st) => loops(edgeSegs(inside, ...box, st)).map(L => thin(chaikin(L)).map(p => [r2(p[0]), r2(p[1])]));

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], base = B.base;
  const pts = [...h.line, ...(h.tipsPt ? [h.tipsPt] : [])], xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz), deckFloor = [];
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), w = worldAt(X, Z);
    let y = w.y - base;
    const s = w.s, k = j * nx + i;
    if (s === 'water') y -= 0.8;                          // a bed under the drawn level
    hs[k] = y; ss[k] = CODES.indexOf(ENG[s] ?? 'beach'); ms[k] = MAT[s] ?? 0;
    if (w.deck) { ms[k] = 9; deckFloor.push([i, j, r2(worldAt(X, Z, true).y - base)]); }
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((hs[k] - y0) * 50);

  // the green and the sand by their outlines
  const gx = h.pin[0], gz = h.pin[1];
  const green = { x: r1(gx), z: r1(gz), outline: outlineOf((x, z) => B.gm(x, z) < 0, [gx - 70, gz - 70, gx + 70, gz + 70], 0.4), keepGround: true, apron: h.green.apron || 3, pins: [[r1(gx), r1(gz)]] };
  const bunkers = [];
  for (const b of B.bunkers) {
    const box = b.box, clip = [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)];
    for (const o of allOutlines(B.inBunker(b), clip, 0.25)) {
      if (o.length < 6) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: b.rx, rz: b.rz, outline: o, keepGround: true, lie: 'sand' });
    }
  }

  // what the ball hits besides the trees: the root plate and the shell's walls near this hole (draw: false)
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const rocks = B.walls.filter(o => inBox(o.x, o.z, 30)).map(o => ({ type: 'box', x: r1(o.x), z: r1(o.z), w: o.w, d: r2(o.l), rot: r2(o.rot), y: r1(o.y - 0.6), h: r1(o.h + 0.6), soak: o.kind === 'plate' ? 0.6 : 0.45, draw: false, what: o.kind === 'plate' ? 'the root plate' : "the shell's wall" }));

  // the giants near the field as tree bodies: the trunk soaks, the crown far up; the heart tree whole
  const plants = [];
  for (const t of B.trees) {
    if (!t.heart && !inBox(t.x, t.z, Math.max(t.cr, 20))) continue;
    const gC = worldAt(t.X, t.Z).y - base, dy = Math.min(0, t.y - gC);
    plants.push({ x: r1(t.x), z: r1(t.z), type: t.heart ? 'heart' : t.snag ? 'snag' : 'redwood', h: r1(t.h), cr: r1(t.cr), low: r2(t.low), tr: r2(t.r), soak: 0.45, ...(dy < -0.05 ? { dy: r2(dy) } : {}), s: 1, r: r2(((t.x * 7.3 + t.z * 3.1) % 1 + 1) % 1) });
  }
  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true, ...(h.goGreen ? { bold: true } : {}) }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(gx), r1(gz)], targets, drops: [],
    tips: { tee: h.tips.tee.map(r1), yards: h.tips.yards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    ...(deckFloor.length ? { deckFloor } : {}),
    frame: { x: r1(h.place.at[0]), z: r1(h.place.at[1]), heading: r2(h.place.heading), base: r2(base) },
    green, bunkers, rocks, plants, card: h.words };
}

// ---- the forest once: heights every 10 m over the course (worldAt, the floor under a deck) and every 60 m far out
const WX = WL.flat().map(p => p[0]), WZ = WL.flat().map(p => p[1]);
const WX0 = Math.floor((Math.min(...WX) - 900) / 10) * 10, WX1 = Math.max(...WX) + 900, WZ0 = Math.floor((Math.min(...WZ) - 900) / 10) * 10, WZ1 = Math.max(...WZ) + 900, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i, w = worldAt(X, Z, true);
  wraw[k] = w.y; if (w.y < wlo) wlo = w.y;
  wm[k] = MAT[w.s] ?? 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
let far;
{
  const FX0 = -7000, FX1 = 7000, FZ0 = -7000, FZ1 = 7000, FC = 60, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz), fm = new Uint8Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i;
    const inside = X > WX0 + 60 && X < WX1 - 60 && Z > WZ0 + 60 && Z < WZ1 - 60;
    const y = inside ? worldAt(X, Z, true).y : V(X, Z) + dryK(X, Z) * pitMound(X, Z);
    const wa = waterAt(X, Z);
    fr[k] = y; fm[k] = wa ? 8 : openAt(X, Z) > 0.5 ? 5 : 0; if (y < flo) flo = y;
  }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 4);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 4, pred: 1, h: b64(packHeights(fq, fnx)), m: b64(fm) };
}
// every giant: [X, Z, r, h, low, cr, y (its foot), flags] (1 the heart tree, 2 a snag, 4 placed for a job, 8 the
// marker on the 3rd, 16 the stair tree)
const groundW = (X, Z) => worldAt(X, Z, true).y;
const stairAt = STAIRS.map(S => S.at);
const trees = ALLTREES.map(t => {
  let y = groundW(t.X, t.Z); const e = groundW(t.X, t.Z + t.r + 1); if (e != null) y = Math.min(y, e);
  const stair = stairAt.some(p => Math.hypot(p[0] - t.X, p[1] - t.Z) < 1);
  return [r1(t.X), r1(t.Z), r2(t.r), r1(t.h), r2(t.low), r1(t.cr), r2(y), (t.heart ? 1 : 0) | (t.snag ? 2 : 0) | (t.placed ? 4 : 0) | (t.marker ? 8 : 0) | (stair ? 16 : 0)];
});
const walls = WALLS.map(o => ({ kind: o.kind, at: [r1(o.X), r1(o.Z)], w: o.w, l: r2(o.l), h: r1(o.h), rot: r2(o.rot), y: r2(groundW(o.X, o.Z)) }));
const fallen = { a: FALLEN.a.map(r1), b: FALLEN.b.map(r1), top: FALLEN.top, h: FALLEN.h };
const plate = SITES.find(s => s.kind === 'plate');
const grove = { world, far, trees, walls, level: POOL.level,
  heart: { c: HEART.c, r: HEART.r, h: HEART.h, low: HEART.low, cr: HEART.cr, roots: HEART.roots, y: r2(groundW(HEART.c[0] + HEART.r + 2, HEART.c[1])) },
  fallen, plate: { at: plate.at.map(r1), r: plate.r, h: plate.h, t: plate.t, rot: r2(plate.rot), y: r2(groundW(...plate.at)) },
  shell: { at: SHELL.c.map(r1), r: SHELL.r, t: SHELL.t, h: SHELL.h },
  decks: DECKS.map(d => ({ k: d.k, y: r2(d.y), at: d.at.map(r1), outline: d.outline.map(p => p.map(r2)) })),
  limbs: LIMBS.map(l => ({ k: l.k, from: l.from.map(r2), knee: l.knee.map(r2), to: l.to.map(r2), r0: l.r0, r1: l.r1 })),
  stairs: STAIRS.map(S => ({ at: S.at.map(r1), r: S.r, top: r2(S.top), foot: r2(S.foot) })) };

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'eldergrove', name: COURSE.name, theme: 'grove', altFt: COURSE.altFt,
  blurb: 'Golf on the floor of a forest older than memory: giant trunks a hundred metres tall stand in and beside the line, the canopy a roof far above any shot, the mist lifting off the moss. A ball that hits a trunk drops at its foot. The round circles a heart tree sixty metres across and finishes under it.',
  signature: { time: 'morning', wind: 'calm', weather: 'haze', temp: 'cool' },
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet, grove };
const src = `// Eldergrove: nine holes on the floor of an ancient forest of giant conifers. GENERATED by tools/eldergrove/emit.mjs
// from the plan book's hole data (tools/eldergrove/holes.mjs, world.mjs, scene.mjs): don't edit by hand. Each hole's
// ground is a sampled field (terrain.js prepField): moss plays as first cut, fern and the meadow as rough, leaf litter
// as beach (firm, it runs), root and bark as native, the brook and the pool as water; its green and sand are outlines
// over it. Every giant near the play is a tree body (trees.js): its trunk soaks 45% of the balls that hit it (they
// drop at its foot), its crown starts about 60 m up. The root plate and the burnt shell's walls are rocks the ball
// hits; the Stair's tees are decks on limbs of the stair tree (ground for the ball, drawn as grown wood). grove-world.js
// draws COURSE.grove (the forest once, in world space) into each hole's frame. The tips tee is in the data, switched
// off: COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.bunkers.length}b/${h.plants.length}t`).join(' '), 'trees', trees.length);
