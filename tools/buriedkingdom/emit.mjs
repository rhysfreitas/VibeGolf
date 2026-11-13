// node tools/buriedkingdom/emit.mjs : writes src/course/buriedkingdom.js (the course module) from the plan data, the
// same ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and
// run this (about 2 minutes). Built like tools/lostvalley/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the site as the book draws it (heights in 2 cm steps), with engine
//            surface codes: firm sand is 'waste' (the lie reads "Sand"), the Sand Sea 'sand' (a bunker: "Dune"),
//            the river and the boat basin 'water' (bed 0.8 m under the drawn level), rock and masonry 'desert',
//            the fields by the river 'rough'; and m: what the paint shows (firm sand, soft sand, rock, masonry,
//            fields, water)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too, all soft sand ('sand')
//   rocks    what the ball hits: the gate's towers, the fallen obelisk's pieces, temple walls, the Sphinx's head,
//            the colossi (boxes that soak, draw: false: kingdom-world.js draws them) and fallen blocks (boulders)
//   plants   date palms (type 'palm', each with its own body; kingdom-world.js draws them)
//   frame    where the hole sits on the site (kingdom-world.js draws COURSE.kingdom into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.kingdom is the site once, in world space: a 10 m height map over the course, a 60 m one out over the
// river plain, the dune sea and the cliffs, the water level, the pyramids, the built things and the palms.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal } from './scene.mjs';
import { V, waterAt, nativeAt, softAt, PYRAMIDS, RIVER, BASIN, SITES, SPHINX, BANK } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { distLine, rnd, project } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/buriedkingdom.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ENG = { firm: 'waste', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'sand', water: 'water', rock: 'desert', stone: 'desert', field: 'rough', void: 'void' };
const CODES = ['waste', 'rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'desert', 'void'];
// the paint byte (and the world map's): 0 firm sand, 1 soft sand, 2 rock, 3 masonry, 4 fields, 8 water, 10 (world
// map only) a hole's mown ground
const MAT = { firm: 0, sand: 1, rock: 2, stone: 3, field: 4, water: 8 };
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

// the built things, once, in world space (absolute heights): the world's sites and each hole's own (the gate, the
// fallen obelisk). kingdom-world.js draws these; each hole's copies in `rocks` are what the ball hits.
const BUILT_THINGS = [];
{
  for (const S of SITES) {
    if (S.kind === 'obelisk') { const a = S.a, b = S.b, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      BUILT_THINGS.push({ kind: 'obelisk', at: c.map(r1), w: S.t, l: r1(l), h: S.t, rot: r2(Math.atan2(b[0] - a[0], -(b[1] - a[1]))), y: r1(gy(...c) - 0.5), name: S.name }); continue; }
    if (!S.at) continue;
    let y = gy(...S.at) - 0.4;
    if (S.kind === 'head') y = gy(...SPHINX.pin) + SPHINX.head.top - S.h;
    BUILT_THINGS.push({ kind: S.kind, at: S.at.map(r1), w: S.w, l: S.l, h: S.h, rot: r2(S.rot), y: r1(y), ...(S.awning ? { awning: 1 } : {}), ...(S.name ? { name: S.name } : {}) });
  }
  for (const [k, B] of BUILT.entries()) {
    const h = HOLES[k], hd = h.place.heading * Math.PI / 180;
    for (const o of B.objs) if (!o.site && (o.kind === 'tower' || o.kind === 'obelisk')) {
      const [X, Z] = WOR[k](o.x, o.z);
      BUILT_THINGS.push({ kind: o.kind === 'tower' ? 'tower' : 'piece', at: [r1(X), r1(Z)], w: r1(o.w), l: r1(o.l), h: r1(o.h), rot: r2(o.rot + hd), y: r1(o.base + h.base), hole: h.n });
    }
  }
}
// palms: each hole's own, and the river's green line (date palms in the fields along the bank, 60 m or more off
// every line of play, scenery where they stand outside a hole's field, in play inside one)
const PALMS = [];
{
  const WL = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
  const TEES = HOLES.flatMap((h, k) => [...Object.values(h.teePts), h.tipsPt].filter(Boolean).map(p => WOR[k](...p)));
  for (const [k, B] of BUILT.entries()) for (const o of B.objs) if (o.kind === 'palm') {
    const [X, Z] = WOR[k](o.x, o.z);
    if (TEES.some(([x, z]) => Math.hypot(X - x, Z - z) < o.r + 14)) continue;
    if (WL.some((L, j) => j !== k && distLine(L, X, Z) < o.r + 9)) continue;
    PALMS.push([r1(X), r1(Z), r1(o.r), r1(o.h)]);
  }
  const R = rnd(4127);
  for (let i = 0; i < 60000 && PALMS.length < 900; i++) {
    const X = -900 + R() * 1500, Z = -1300 + R() * 2100;
    if (nativeAt(X, Z) !== 'field' || waterAt(X, Z)) continue;
    const rp = project(BANK, X, Z); if (rp.off < 0 && R() < 0.6) continue;   // thinner on the far bank
    if (Math.min(...WL.map(L => distLine(L, X, Z))) < 60) continue;
    if (TEES.some(([x, z]) => Math.hypot(X - x, Z - z) < 45)) continue;
    PALMS.push([r1(X), r1(Z), r1(2.6 + R() * 1.6), r1(11 + R() * 9)]);
  }
}
const plantOf = (x, z, r, hh) => ({ x: r1(x), z: r1(z), type: 'palm', h: hh, cr: r, low: 0.74, tr: 0.35, s: r2(hh / 10), r: r2(((x * 7.3 + z * 3.1) % 1 + 1) % 1) });

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], L = LOC[hi], base = h.base;
  const pts = [...h.line, ...(h.tipsPt ? [h.tipsPt] : [])], xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), w = worldAt(X, Z);
    let y = w.y - base;
    const s = w.s;
    if (s === 'water') y -= 0.8;                          // a bed under the drawn level
    const k = j * nx + i;
    hs[k] = y; ss[k] = CODES.indexOf(ENG[s] ?? 'waste'); ms[k] = MAT[s] ?? 0;
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((hs[k] - y0) * 50);

  // the green and bunkers by their outlines (the field already has their shape)
  const gx = h.pin[0], gz = h.pin[1];
  const gOut = outlineOf((x, z) => B.gm(x, z) < 0, [gx - 70, gz - 70, gx + 70, gz + 70], 0.4);
  const green = { x: r1(gx), z: r1(gz), outline: gOut, keepGround: true, apron: h.green.apron || 3, pins: [[r1(h.pin[0]), r1(h.pin[1])]] };
  const bunkers = [];
  for (const b of B.bunkers) {
    const box = b.box, inside = B.inBunker(b), clip = [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)];
    for (const o of allOutlines(inside, clip, 0.5)) {
      if (o.length < 8) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: 'sand' });
    }
  }

  // what the ball hits: everything near this hole's play, into its frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const hd = h.place.heading * Math.PI / 180;
  for (const S of BUILT_THINGS) {
    if (S.kind === 'tent') continue;                       // canvas: scenery only
    const [x, z] = L(...S.at); if (!inBox(x, z, 20)) continue;
    rocks.push({ type: 'box', x: r1(x), z: r1(z), w: S.w, d: S.l, rot: r2(S.rot - hd), y: r1(S.y - base), h: r1(S.h + (S.kind === 'head' ? 0 : 0.4)), soak: 0.45, draw: false, what: S.kind });
  }
  for (const o of B.objs) if (o.kind === 'boulder') rocks.push({ type: 'boulder', x: r1(o.x), z: r1(o.z), r: r1(o.r), h: r1(o.h), y: r1(o.base), rot: r2((o.x * 0.37 + o.z * 0.11) % 6.28), pe: 3.2 });
  for (const [X, Z, r, hh] of PALMS) { const [x, z] = L(X, Z); if (inBox(x, z)) plants.push(plantOf(x, z, r, hh)); }

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

// the site: heights every 10 m over the course (what it is from worldAt, water at its level), and every 60 m out
// over the river plain, the far bank, the dune sea and the cliffs (the world alone, V)
const WX0 = -760, WX1 = 1900, WZ0 = -1100, WZ1 = 1260, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
const WLN = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i;
  const near = Math.min(...WLN.map(L => distLine(L, X, Z))) < 300;
  const wa = near ? null : waterAt(X, Z);
  const w = near ? worldAt(X, Z) : wa ? { y: wa.level, s: 'water' } : { y: V(X, Z), s: softAt(X, Z) ? 'sand' : nativeAt(X, Z) };
  wraw[k] = w.y; if (wraw[k] < wlo) wlo = wraw[k];
  wm[k] = MAT[w.s] ?? (['fairway', 'rough', 'fringe', 'green', 'tee'].includes(w.s) ? 10 : 0);
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
let far;
{
  const FX0 = -7000, FX1 = 9200, FZ0 = -8200, FZ1 = 8000, FC = 60, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz), fm = new Uint8Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) { const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i, wa = waterAt(X, Z);
    fr[k] = wa ? wa.level : Math.min(260, Math.max(0, V(X, Z))); if (fr[k] < flo) flo = fr[k];
    fm[k] = wa ? 8 : MAT[nativeAt(X, Z)] ?? 0; }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 4);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 4, pred: 1, h: b64(packHeights(fq, fnx)), m: b64(fm) };
}

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'buriedkingdom', name: 'The Buried Kingdom', theme: 'kingdom', altFt: COURSE.altFt,
  blurb: 'Nine holes through Egyptian ruins half buried in sand, in blazing late-morning light: across the boat basin, up the causeway under the great pyramid, over the Sand Sea, to the Sphinx, and down the wadi to the cliff temple. Off the grass is firm sand you can play from; the soft dunes are bunkers.',
  signature: { time: 'midday', wind: 'light', windFrom: 270, weather: 'clear', temp: 'hot' },
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet,
  kingdom: { world, far, level: RIVER.level, basin: { c: BASIN.c, rx: BASIN.rx, rz: BASIN.rz },
    pyramids: PYRAMIDS.map(P => ({ c: P.c.map(r1), half: P.half, h: P.h, y: r1(V(P.c[0] + P.half + 4, P.c[1], true)), ...(P.cased ? { cased: P.cased } : {}) })),
    built: BUILT_THINGS, palms: PALMS.map(([X, Z, r, hh]) => [X, Z, r1(gy(X, Z)), r, hh]) } };
const src = `// The Buried Kingdom: nine holes through Egyptian ruins half buried in sand. GENERATED by
// tools/buriedkingdom/emit.mjs from the plan book's hole data (tools/buriedkingdom/holes.mjs, world.mjs, scene.mjs):
// don't edit by hand. Each hole's ground is a sampled field (terrain.js prepField): firm sand plays as 'waste' (the
// lie reads Sand), the Sand Sea and every bunker as 'sand' (Dune), the river and the boat basin as water; its green
// and bunkers are outlines over it; the gate's towers, the fallen obelisk, temple walls, the Sphinx's head and the
// colossi are boxes the ball hits, the palms play (each with its own body), and kingdom-world.js draws
// COURSE.kingdom (the site once, in world space) into each hole's frame. The tips tee is in the data, switched
// off: COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '));
