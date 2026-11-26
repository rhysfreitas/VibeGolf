// node tools/emeraldbay/emit.mjs : writes src/course/emeraldbay.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and run
// this (about a minute). Built like tools/cloudrest/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the bay as the book draws it (worldAt: every hole's own ground blended),
//            heights in 2 cm steps; the sea bed is the real ground (no bed cut under the water: the sea is one level),
//            with engine surface codes at LOW tide: fairway, fringe, tee, rough (salt grass and the jungle floor),
//            native 'desert' (rock), 'waste' (dry sand), 'beach' (wet sand), sand (bunkers), water; and m: what the
//            paint shows (bay-world.js). The tide is one rule over it (terrain.js fieldSurf): any cell whose ground
//            is below the round's sea (hole.sea, set by versions.js from COURSE.rolls) plays as water. The emitter
//            checks the rule against the plan book's own high-tide surfaces on every hole.
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  the hole's sand by its outlines
//   rocks    what the ball hits besides the ground, draw: false (bay-world.js draws them): the sea cave's roof on the
//            9th and the 7th's overhang as slabs of rock over the play, the beach shack and the stilt houses as boxes
//   versions the tide holes (3, 5, 9): { id: 'low' | 'high', note, targets, yards, tipsYards } (versions.js applies
//            the round's); hole.versionBy 'tide'
//   frame    where the hole sits in the bay (bay-world.js draws COURSE.bay into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.bay is the bay once, in world space: a 10 m height map over the course and a 40 m one out to 4 km (with the
// paint), the built things, the play lines (so drawn scenery keeps off them).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { worldAt, toWorld, toLocal, WL, HD, OWN, PHYS } from './scene.mjs';
import { V, SITES, TIDES, CAVE, OVER, caveRoofAt, overhangAt, onLine, STACK, STACKS, HEAD5 } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/emeraldbay.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ENG = { ...PHYS, green: 'fringe', void: 'water' };
const CODES = ['rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'desert', 'waste', 'beach'];
// the paint byte (and the world map's): 0 rough (salt grass), 1 jungle, 2 rock, 3 dry sand, 4 wet sand, 6 bunker
// sand, 8 water (at low tide), 10 mown ground (fairway, collar, green, tee)
const MAT = { rough: 0, jungle: 1, rock: 2, drysand: 3, wetsand: 4, sand: 6, water: 8, void: 8, fairway: 10, fringe: 10, green: 10, tee: 10 };
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

// ---- rock overhead, in world space: slabs along a line (k), from s0 to s1 and off0 to off1, each at the lowest
// underside under it, 30 m thick; boxes w across the line and d along it
function slabs(k, s0, s1, ds, off0, off1, dof, under, what) {
  const out = [];
  for (let s = s0 + ds / 2; s < s1; s += ds) for (let o = off0 + dof / 2; o < off1; o += dof) {
    let lo = Infinity;
    for (const a of [-0.45, 0, 0.45]) for (const b of [-0.45, 0, 0.45]) { const r = under(...onLine(k, s + a * ds, o + b * dof)); if (r !== null) lo = Math.min(lo, r); }
    if (lo === Infinity) continue;
    const [X, Z] = onLine(k, s, o), [X2, Z2] = onLine(k, s + 1, o), L = Math.hypot(X2 - X, Z2 - Z);
    out.push({ X, Z, ax: -(Z2 - Z) / L, az: (X2 - X) / L, w: dof + 0.6, d: ds + 0.6, y: lo, h: 30, what });
  }
  return out;
}
const ROOF = [
  ...slabs(8, CAVE.s0 - 2, CAVE.s1 + 2, 10, -CAVE.hw - 6, CAVE.hw + 6, 8, caveRoofAt, "the sea cave's roof"),
  ...slabs(6, OVER.s0, OVER.s1, 20, OVER.foot, OVER.lip, 2.5, overhangAt, 'the overhang'),
];
// what bay-world.js draws of them: a grid over (s, off) along the line with the underside at each point (null where
// there is none) and the rock's top above it (the overhang's cliff top; for the cave, the island's height round it)
function roofGrid(k, s0, s1, ds, off0, off1, dof, under, top, what) {
  const nu = Math.round((s1 - s0) / ds) + 1, nv = Math.round((off1 - off0) / dof) + 1, pts = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const [X, Z] = onLine(k, s0 + i * ds, off0 + j * dof), u = under(X, Z);
    pts.push(u === null ? null : [r1(X), r1(Z), r1(u), r1(Math.max(u + 10, top(X, Z)))]);
  }
  return { what, nu, nv, pts };
}
const hongTop = (X, Z) => { let hi = -Infinity; for (const dx of [-60, 0, 60]) for (const dz of [-60, 0, 60]) hi = Math.max(hi, V(X + dx, Z + dz).y); return Math.min(hi - 3, CAVE.roof + 70); };
const ROOFDRAW = [
  roofGrid(8, CAVE.s0 - 2, CAVE.s1 + 2, 4, -CAVE.hw - 6, CAVE.hw + 6, 3, caveRoofAt, hongTop, 'cave'),
  roofGrid(6, OVER.s0, OVER.s1, 6, OVER.foot, OVER.lip, 2, overhangAt, () => OVER.top, 'overhang'),
];
const BOXES = SITES.filter(o => o.kind === 'shack' || o.kind === 'stilt').map(o => ({ X: o.at[0], Z: o.at[1], w: o.w, d: o.l, h: o.h, rot: o.rot || 0, what: o.name || o.kind }));

// the plan book's surface as the game will play it, and the paint byte
const eng = s => ENG[s] ?? 'rough';

function holeOut(hi) {
  const h = HOLES[hi], O = OWN[hi], W = WOR[hi], Lk = LOC[hi], base = O.base, a = HD[hi];
  const rx = Math.cos(a), rz = Math.sin(a), fx = Math.sin(a), fz = -Math.cos(a);
  const vecL = (vx, vz) => [vx * rx + vz * rz, -(vx * fx + vz * fz)];   // a world direction in the hole's frame
  const pts = [...h.line, h.tipsPt], xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity, miss = 0, wetCells = 0;
  const seaHi = TIDES.high - base;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), w = worldAt(X, Z, 'low'), k = j * nx + i;
    const y = w.y - base;
    hs[k] = y; ss[k] = CODES.indexOf(eng(w.s)); ms[k] = MAT[w.s] ?? 0;
    if (y < lo) lo = y;
    // the tide rule against the plan book's high tide (greens and bunkers are features: the game's own outlines win)
    if (w.s !== 'green' && w.s !== 'sand') {
      const hiS = eng(worldAt(X, Z, 'high').s), rule = y < seaHi && w.s !== 'tee' ? 'water' : eng(w.s);
      if (hiS !== rule) miss++;
      if (y < seaHi && y >= TIDES.low - base) wetCells++;
    }
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((hs[k] - y0) * 50);

  const gx = h.pin[0], gz = h.pin[1];
  const green = { x: r1(gx), z: r1(gz), outline: outlineOf((x, z) => O.gm(x, z) < 0, [gx - 70, gz - 70, gx + 70, gz + 70], 0.4), keepGround: true, apron: h.green.apron || 3, pins: [[r1(gx), r1(gz)]] };
  const bunkers = [];
  let lowSand = 0;
  for (const b of O.bunkers) {
    const box = b.box, clip = [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)];
    for (const o of allOutlines(O.inBunker(b), clip, 0.25)) {
      if (o.length < 6) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      if (O.ground(cx, cz) < seaHi + 0.3) lowSand++;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: b.rx, rz: b.rz, outline: o, keepGround: true, lie: 'sand' });
    }
  }
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const rocks = [];
  for (const R of ROOF) {
    const [x, z] = Lk(R.X, R.Z); if (!inBox(x, z, 20)) continue;
    const [cx, cz] = vecL(R.ax, R.az);
    rocks.push({ type: 'box', x: r1(x), z: r1(z), w: R.w, d: R.d, rot: r2(Math.atan2(cz, cx)), y: r1(R.y - base), h: R.h, soak: 0.2, draw: false, what: R.what });
  }
  for (const R of BOXES) {
    const [x, z] = Lk(R.X, R.Z); if (!inBox(x, z, 20)) continue;
    const g = worldAt(R.X, R.Z, 'low').y;
    rocks.push({ type: 'box', x: r1(x), z: r1(z), w: R.w, d: R.d, rot: r2(R.rot - a), y: r1(Math.max(g, TIDES.high) - base - 0.5), h: R.h + 0.5, soak: 0.45, draw: false, what: R.what });
  }
  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(O.teePads.map(t => [t.k, { w: 9, l: 9, h: 0.05 }]));
  const tgt = list => { const out = (list || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })); const p = (list || []).find(t => t.pin); out.push({ name: p ? p.name : 'Green', pin: true, ...(p && p.bold ? { bold: true } : {}) }); return out; };
  const versions = h.versions ? h.versions.map(v => ({ id: v.id, note: v.note, yards: v.yards, tipsYards: v.tipsYards, targets: tgt(v.targets) })) : null;
  const low = versions ? versions.find(v => v.id === 'low') : null;
  const out = { n: h.n, name: h.name, par: h.par, heading, blurb: h.words.story, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: low ? low.yards : h.yards, pin: [r1(gx), r1(gz)], targets: low ? low.targets : tgt(h.targets), drops: [],
    tips: { tee: h.tipsPt.map(r1), yards: low ? low.tipsYards : h.tipsYards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: r1(h.place.at[0]), z: r1(h.place.at[1]), heading: r2(h.place.heading), base: r2(base) },
    green, bunkers, rocks, plants: [], card: h.words };
  if (versions) { out.versionBy = 'tide'; out.versions = versions; }
  return { out, miss, wetCells, lowSand };
}

// ---- the bay once: heights every 10 m over the course (worldAt at low tide), every 40 m far out (V)
const WX = WL.flat().map(p => p[0]), WZ = WL.flat().map(p => p[1]);
const WX0 = Math.floor((Math.min(...WX) - 700) / 10) * 10, WX1 = Math.max(...WX) + 700, WZ0 = Math.floor((Math.min(...WZ) - 700) / 10) * 10, WZ1 = Math.max(...WZ) + 700, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i, w = worldAt(X, Z, 'low');
  wraw[k] = w.y; if (w.y < wlo) wlo = w.y;
  wm[k] = MAT[w.s] ?? 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
let far;
{
  const FX0 = -3400, FX1 = 4600, FZ0 = -4600, FZ1 = 3400, FC = 40, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz), fm = new Uint8Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i;
    const inside = X > WX0 + 40 && X < WX1 - 40 && Z > WZ0 + 40 && Z < WZ1 - 40;
    const w = inside ? worldAt(X, Z, 'low') : null, v = w ? null : V(X, Z);
    const y = w ? w.y : v.y;
    fr[k] = y; fm[k] = w ? MAT[w.s] ?? 0 : v.t === 'karst' ? 2 : v.t === 'jungle' ? 1 : v.t === 'sand' ? 3 : v.t === 'wet' ? 4 : v.y < 0 ? 8 : 0; if (y < flo) flo = y;
  }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 4);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 4, pred: 1, h: b64(packHeights(fq, fnx)), m: b64(fm) };
}
const sites = SITES.map(o => ({ kind: o.kind, name: o.name || null, at: [r1(o.at[0]), r1(o.at[1])], w: o.w, l: o.l, h: o.h, rot: r2(o.rot || 0), y: r2(worldAt(...o.at, 'low').y) }));
// every hole's play in world space: tips, back tee, the line to the pin, and all the tee spots, so the drawn scenery
// (palms) keeps off the lines of play and clear of the tees
const play = HOLES.map((h, k) => { const W = toWorld(h), P = q => W(...q).map(r1); return { line: [P(h.tipsPt), ...h.line.map(P)], tees: [...Object.values(h.teePts), h.tipsPt].map(P) }; });
const roof = ROOF.map(R => ({ at: [r1(R.X), r1(R.Z)], a: [r2(R.ax), r2(R.az)], w: R.w, d: R.d, y: r1(R.y), h: R.h, what: /cave/.test(R.what) ? 'cave' : 'overhang' }));
// the sea stacks (Ko Tapu's look: narrow pinnacles standing in the water), the 8th's spire and the 5th's headland
const landmarks = { stack: { at: [STACK.spire.X, STACK.spire.Z], r: STACK.spire.r, top: STACK.spire.top }, stacks: STACKS.map(st => ({ name: st.name, at: [r1(st.X), r1(st.Z)], r: st.r, top: st.top, tee: st.tee || null })), head5: { at: [r1(HEAD5.o.x), r1(HEAD5.o.z)], top: HEAD5.top } };
const bay = { world, far, tides: TIDES, sites, play, roof, roofDraw: ROOFDRAW, landmarks };

const res = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const holes = res.map(r => r.out);
const course = { id: 'emeraldbay', name: COURSE.name, theme: 'bay', altFt: 0, wallSoak: COURSE.wallSoak,
  blurb: 'An invented bay of limestone islands: sheer towers hung with jungle, white sand and clear turquoise water. Sand always plays (dry sand like a waste area, wet sand firm and running) and water is a stroke. The tide is rolled each round: at high water the tongue, the flats and the bar go under, and three holes play another way.',
  signature: { time: 'midday', wind: 'light', weather: 'clear', temp: 'hot' },
  voidText: ['Into the sea', 'Ends in the sea'], teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet, rolls: COURSE.rolls, bay };
const src = `// Emerald Bay: nine holes round a bay of limestone islands. GENERATED by tools/emeraldbay/emit.mjs from the plan
// book's hole data (tools/emeraldbay/holes.mjs, world.mjs, scene.mjs): don't edit by hand. Each hole's ground is a
// sampled field (terrain.js prepField) with the low tide's surfaces; the tide is rolled each round (COURSE.rolls,
// versions.js) and any ground below the round's sea plays as water. The tide holes (3, 5, 9) carry a version for
// each tide (their targets and yards). Cliffs are part of the ground, so a ball into one is a wall the physics soaks
// 45% of the time (COURSE.wallSoak). Its green and sand are outlines over the field; the sea cave's roof and the 7th's
// overhang are rocks. bay-world.js draws COURSE.bay (the bay once, in world space) into each hole's frame. The tips
// tee is in the data, switched off: COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB');
for (const r of res) console.log(`${r.out.n}: ${r.out.rocks.length} rocks, ${r.out.bunkers.length} bunkers, tide rule misses ${r.miss} cells (of ${r.wetCells} between the tides), bunkers under high water ${r.lowSand}`);
