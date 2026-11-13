// node tools/halcyon/emit.mjs : writes src/course/halcyon.js (the course module) from the plan data, the same ground
// and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and run this
// (a minute or two). Built like tools/lostvalley/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m in its own frame, the curve from its back tee included (heights in 2 cm
//            steps), with engine surface codes (the lake, the canal and the pools play as 'water', their bed 0.8 m
//            under the drawn level; floor windows and the rim glass play as 'water' too, flush: a stroke and a drop
//            beside where the ball crossed) and m: what the paint shows (lawn, woods, garden, plaza, stone, glass,
//            water)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  outlines too (white sand)
//   rocks    what the ball hits: villas, the clubhouse and the lip marker (boxes; a villa's facade soaks a wild ball,
//            so it drops at the foot), garden walls (thin boxes), the spoke's feet (wedges leaning in toward the
//            apex), and the rim walls past the glass (tall boxes)
//   plants   trees that play (limes, planes, yews, poplars, willows), each with its own body
//   frame    where the hole sits on the ring (ring-world.js draws COURSE.ring into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.ring is the station once, in ring space (a across, east +; s along, north/spinward +; world X = a, Z = -s;
// heights above the cylinder's floor, without any hole's curve): a 10 m map over the course and a 40 m one round
// the ring either side, the windows, the rim glass, the lake and canal levels, the scenery villas and trees, the
// spoke, the clubhouse, the aqueduct, the footbridge, the falls and the tram line. ring-world.js puts it on the
// true cylinder in each hole's frame.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal, waterW, shapesAt, STEE } from './scene.mjs';
import { H, R, HALF, WALL, RIM, curveRise, nativeAt, inWindow, WINDOWS, LAKE, CANAL, AQUEDUCT, SPOKE, CLUBHOUSE, TRAM, TERMINATOR } from './world.mjs';
import { edgeSegs } from './shapes.mjs';
import { distLine, rnd, seOutline } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/halcyon.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
// plan surfaces -> the engine's ('desert' is the native park: lawns, woods, gardens, plaza, terrace walls); greens and
// bunkers come from their outlines
const ENG = { park: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'rough', water: 'water', window: 'water', wood: 'desert', garden: 'desert', plaza: 'desert', stone: 'desert', void: 'void' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'void'];
// the paint byte (and the maps'): 0 lawn, 1 woods, 2 garden, 3 plaza, 4 stone, 7 glass, 8 water, 10 (maps only) a
// hole's mown ground, 11 (maps only) sand
const MAT = { park: 0, wood: 1, garden: 2, plaza: 3, stone: 4, window: 7, water: 8 };
const b64 = a => Buffer.from(a.buffer).toString('base64');
const WOR = HOLES.map(toWorld), LOC = HOLES.map(toLocal);
const WLINES = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
const curveK = k => (X, Z) => curveRise(-Z, STEE[k]);

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

// ---- the scenery, once, in ring space: tree clumps in the woods and the parkland, villas in the gardens (as the
// plan book's sketches scatter them), kept off every line of play
const offLines = (X, Z, d) => WLINES.every(L => distLine(L, X, Z) > d);
const SCN = { trees: [], villas: [] };
{
  const Rn = rnd(4242);
  for (let i = 0; i < 9000; i++) {
    const a = -436 + Rn() * 872, s = -1400 + Rn() * 4900, X = a, Z = -s;
    const nat = nativeAt(X, Z); if (!offLines(X, Z, nat === 'wood' ? 70 : 40) || waterW(X, Z) || inWindow(a, s) || Math.abs(a) > HALF - RIM.w - 6) continue;
    if (nat === 'wood' || (nat === 'park' && Rn() < 0.1)) {
      const n = nat === 'wood' ? 4 : 2;
      for (let j = 0; j < n; j++) { const x = X + (Rn() - 0.5) * 28, z = Z + (Rn() - 0.5) * 28; if (!offLines(x, z, 34) || waterW(x, z) || inWindow(x, -z)) continue; SCN.trees.push([r1(x), r1(z), Rn() < 0.7 ? 'plane' : 'lime', r1(16 + Rn() * 10), r1(5 + Rn() * 4)]); }
    } else if (nat === 'garden' && Rn() < 0.3) {
      const w = 22 + Rn() * 14, l = 14 + Rn() * 6, rot = (Rn() < 0.5 ? 0 : Math.PI / 2) + (Rn() - 0.5) * 0.2;
      if (SCN.villas.some(v => Math.hypot(v[0] - X, v[1] - Z) < 40)) continue;
      SCN.villas.push([r1(X), r1(Z), r1(w), r1(l), r1(7 + Rn() * 5), r2(rot)]);
    }
  }
}
// the follies (art pass 1, Rhys's pick): temples and rotundas on the park's lawns well off the lines, statues in
// front of villas, fountains in the plazas, a couple of obelisks; scenery only (nothing in the field plays)
const FOLLIES = [];
{
  const Rn = rnd(777), far = (X, Z, d) => FOLLIES.every(f => Math.hypot(f.X - X, f.Z - Z) > d), ok = (X, Z, d) => offLines(X, Z, d) && !waterW(X, Z) && !inWindow(X, -Z) && Math.abs(X) < HALF - RIM.w - 40;
  let temples = 0, obelisks = 0;
  for (let i = 0; i < 20000 && (temples < 7 || obelisks < 3); i++) {
    const a = -400 + Rn() * 800, s = -1300 + Rn() * 4700, X = a, Z = -s;
    if (nativeAt(X, Z) !== 'park' || !ok(X, Z, 95)) continue;
    if (temples < 7 && far(X, Z, 420)) { FOLLIES.push({ kind: temples % 2 ? 'temple' : 'rotunda', X, Z, rot: Rn() * 6.283 }); temples++; }
    else if (obelisks < 3 && far(X, Z, 300)) { FOLLIES.push({ kind: 'obelisk', X, Z, rot: 0 }); obelisks++; }
  }
  for (const [k, v] of SCN.villas.entries()) { if (k % 3) continue; const r = v[5], X = v[0] + Math.sin(r) * (v[3] / 2 + 12), Z = v[1] - Math.cos(r) * (v[3] / 2 + 12); if (ok(X, Z, 40) && far(X, Z, 30)) FOLLIES.push({ kind: 'statue', X, Z, rot: r }); }
  for (const [k, v] of SCN.villas.entries()) { if (k % 5 !== 1) continue; const r = v[5], X = v[0] - Math.sin(r) * (v[3] / 2 + 16), Z = v[1] + Math.cos(r) * (v[3] / 2 + 16); if (ok(X, Z, 40) && far(X, Z, 30)) FOLLIES.push({ kind: 'fountain', X, Z, rot: 0 }); }
  { const C = CLUBHOUSE, X = C.a + 2, Z = -(C.s - C.d / 2 - 22); if (!waterW(X, Z) && !inWindow(X, -Z)) FOLLIES.push({ kind: 'fountain', X, Z, rot: 0, big: true }); }
}
const follies = FOLLIES.map(f => ({ kind: f.kind, a: r1(f.X), s: r1(-f.Z), rot: r2(f.rot), y: r1(H(f.X, f.Z) + shapesAt(f.X, f.Z)), ...(f.big ? { big: 1 } : {}) }));

// the floor's height (absolute, no curve) and surface between and round the holes
const ground = (X, Z) => { const w = worldAt(X, Z); return w; };

// ---- each hole
function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], L = LOC[hi], base = h.base, cv = curveK(hi);
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), k = j * nx + i;
    let y, s;
    if (Math.abs(X) > HALF) { y = RIM.y + cv(X, Z) - base; s = 'window'; }          // past the wall: never reached
    else {
      const w = ground(X, Z); s = w.s;
      y = w.y + cv(X, Z) - base;
      if (s === 'water') y -= 0.8;                                                     // a bed under the drawn level
    }
    hs[k] = y; ss[k] = CODES.indexOf(ENG[s] ?? 'desert'); ms[k] = MAT[s] ?? 0;
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
    for (const o of allOutlines(inside, clip, 0.4)) {
      if (o.length < 6) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: 4, rz: 4, outline: o, keepGround: true, lie: 'sand' });
    }
  }

  // what the ball hits, into this hole's frame
  const rocks = [], plants = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const gAt = (x, z) => B.ground(x, z);
  for (const o of B.objs) {
    if (o.kind === 'villa' || o.kind === 'clubhouse') rocks.push({ type: 'box', x: r1(o.x), z: r1(o.z), w: r1(o.w), d: r1(o.l), h: r1(o.h + 0.3), y: r1(o.base), rot: r2(o.rot), ...(o.w > 4 ? { soak: 0.45 } : {}), [o.kind]: o.label || o.kind });
    else if (o.kind === 'wall') { const dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1], l = Math.hypot(dx, dz); rocks.push({ type: 'box', x: r1((o.a[0] + o.b[0]) / 2), z: r1((o.a[1] + o.b[1]) / 2), w: r2(o.t), d: r1(l), h: r1(o.h + 0.5), y: r1(Math.min(o.a[2], o.b[2]) - 0.5), rot: r2(Math.atan2(-dx, dz)), wall: true }); }
    else if (['lime', 'plane', 'yew', 'poplar', 'willow'].includes(o.kind)) plants.push(plantOf(o.x, o.z, o.kind, o.r, o.h));
  }
  // the spoke's feet: each leg a wedge from below its foot, leaning in toward the apex (the play only needs its foot)
  if (h.feet) for (const leg of SPOKE.legs) {
    const [fx, fz] = L(leg[0], -leg[1]); if (!inBox(fx, fz, 60)) continue;
    const ax = SPOKE.a + Math.sign(leg[0] - SPOKE.a) * 12, t = 140 / SPOKE.apex, tx = leg[0] + (ax - leg[0]) * t, [px, pz] = L(tx, -leg[1]);
    const gy = gAt(fx, fz) ?? 0;
    rocks.push({ type: 'wedge', from: [r1(fx), r1(fz), r1(gy - 3)], to: [r1(px), r1(pz), r1(gy + 140)], w: [SPOKE.foot, r1(SPOKE.foot - (SPOKE.foot - 22) * t)], h: [SPOKE.foot, r1(SPOKE.foot - (SPOKE.foot - 22) * t)], spoke: true });
  }
  // scenery villas and trees that stand inside the field play too
  for (const [X, Z, w, l, hh, rot] of SCN.villas) { const [x, z] = L(X, Z); if (!inBox(x, z)) continue; const g = gAt(x, z); if (g == null) continue; rocks.push({ type: 'box', x: r1(x), z: r1(z), w, d: l, h: r1(hh + 1.5), y: r1(g - 0.5), rot: r2(rot - h.place.heading * Math.PI / 180), soak: 0.45, villa: 'a villa' }); }
  for (const [X, Z, kind, hh, r] of SCN.trees) { const [x, z] = L(X, Z); if (inBox(x, z)) plants.push(plantOf(x, z, kind, r, hh)); }
  // the rim walls, where the field reaches them: glass from the sill up (boxes 30 m thick standing on the rim)
  for (const side of [-1, 1]) {
    const aW = side * (HALF + 15), corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => W(x, z)), ss2 = corners.map(c => -c[1]);
    if (Math.max(...corners.map(c => side * c[0])) < HALF - 30) continue;
    const s0 = Math.min(...ss2), s1 = Math.max(...ss2);
    for (let s = s0; s < s1; s += 120) {
      const sm = Math.min(s + 60, s1), [x, z] = L(aW, -sm), dirW = L(aW, -(sm + 1)), rot = Math.atan2(-(dirW[0] - x), dirW[1] - z);
      rocks.push({ type: 'box', x: r1(x), z: r1(z), w: 30, d: 122, h: 320, y: r1(RIM.y + cv(aW, -sm) - base - 1), rot: r2(rot), soak: 0.6, rimWall: true });
    }
  }

  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: k === 'zenith' && h.padL ? Math.max(6, h.padL * 2) : 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin && t.at).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    tips: { tee: h.tips.tee.map(r1), yards: h.tips.yards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base: r2(base), s0: r1(STEE[hi]) },
    green, bunkers, rocks, plants, card: h.words };
}
// a tree's body for trees.js (an explicit one: canopy from h*low to h, radius cr; a trunk tr thick under it); the
// game draws limes, planes and willows as round crowns ('oak'), yews and poplars as cones ('pine')
const LOW = { lime: 0.3, plane: 0.3, willow: 0.15, yew: 0.05, poplar: 0.15 };
const plantOf = (x, z, kind, r, hh) => ({ x: r1(x), z: r1(z), type: kind === 'yew' || kind === 'poplar' ? 'pine' : 'oak', kind, h: r1(hh), cr: r1(r), low: LOW[kind] ?? 0.3, tr: 0.5, s: r2(hh / 10), r: r2(((x * 7.3 + z * 3.1) % 1 + 1) % 1) });

// ---- the ring's maps (ring space: heights above the floor, no curve): 10 m over the course, 40 m round the ring
function ringMap(a0, a1, s0, s1, cell, near) {
  const na = Math.round((a1 - a0) / cell) + 1, ns = Math.round((s1 - s0) / cell) + 1;
  const raw = new Float32Array(na * ns), m = new Uint8Array(na * ns); let lo = Infinity;
  for (let j = 0; j < ns; j++) for (let i = 0; i < na; i++) {
    const a = a0 + i * cell, s = s0 + j * cell, X = a, Z = -s, k = j * na + i;
    let y, sf;
    if (near && Math.min(...WLINES.map(L => distLine(L, X, Z))) < 220) { const w = ground(X, Z); y = w.y; sf = w.s; }
    else { const w = waterW(X, Z); y = w ? w.level : H(X, Z) + shapesAt(X, Z); sf = w ? 'water' : inWindow(a, s) ? 'window' : nativeAt(X, Z); }
    raw[k] = y; m[k] = MAT[sf] ?? (sf === 'sand' ? 11 : 10);
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(na * ns);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((raw[k] - y0) * 20);
  return { a0, s0, cell, na, ns, y0, scale: 20, pred: 1, h: b64(packHeights(q, na)), m: b64(m) };
}
const world = ringMap(-HALF, HALF, -1500, 3600, 10, true);
const far = ringMap(-HALF, HALF, -6400, 8400, 40, false);

// the structures, in ring space
const r1a = p => p.map(r1);
const windows = WINDOWS.map(w => ({ name: w.name, a: w.a, s: w.s, ra: w.ra, rs: w.rs, rot: w.rot, p: w.p, y: r1(H(w.a, -w.s)) }));
const spoke = { ...SPOKE, y: r1(H(SPOKE.legs[0][0], -SPOKE.s)) };
const clubhouse = { ...CLUBHOUSE, y: r1(H(CLUBHOUSE.a, -CLUBHOUSE.s)) };
const aqueduct = { ...AQUEDUCT, y0: r1(H(AQUEDUCT.from[0], -AQUEDUCT.from[1])), y1: r1(H(AQUEDUCT.to[0], -AQUEDUCT.to[1])) };
const bridges = [], falls = [];
for (const [k, B] of BUILT.entries()) {
  const h = HOLES[k], W = WOR[k], cv = curveK(k);
  for (const o of B.objs) {
    if (o.kind === 'bridge') { const A = W(...o.a), Bq = W(...o.b); bridges.push({ a: [...r1a(A), r1(B.ground(...o.a) + h.base - cv(...A) + 1.2)], b: [...r1a(Bq), r1(B.ground(...o.b) + h.base - cv(...Bq) + 1.2)], label: o.label }); }
    if (o.kind === 'falls') { const P = W(o.x, o.z); falls.push({ at: r1a(P), w: o.w, h: o.h, y: r1(o.base + h.base - cv(...P)), facing: r2(h.place.heading * Math.PI / 180) }); }
  }
}
const villas = SCN.villas.map(([X, Z, w, l, hh, rot]) => [X, Z, w, l, hh, rot, r1(H(X, Z) + shapesAt(X, Z))]);
const trees = SCN.trees.map(([X, Z, kind, hh, r]) => [X, Z, kind, hh, r, r1(ground(X, Z).y)]);
const course = { id: 'halcyon', name: 'Halcyon Ring', theme: 'ring', altFt: 0,
  blurb: 'Nine holes of parkland golf inside a ring space station, a garden colony 5 km in radius, in the late light: lawns, woods, lakes and white villas on terraces, the floor climbing up the ring ahead and behind, Earth through the glass. Floor windows and the rim glass are a penalty area.',
  signature: { time: 'golden', wind: 'light', windFrom: 'random', weather: 'clear', temp: 'mild' },
  voidText: ['Onto the glass', 'Ends on the glass'],
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet,
  ring: { R, half: HALF, wall: WALL, rim: RIM, terminator: TERMINATOR, world, far, windows, lake: { level: LAKE.level, pts: LAKE.pts, w: LAKE.w }, follies, canal: { pts: CANAL.pts, w: CANAL.w, lock: CANAL.lock },
    spoke, clubhouse, aqueduct, bridges, falls, tram: { a: 0, stop: TRAM }, villas, trees } };
const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const src = `// Halcyon Ring: nine holes of parkland golf inside a ring space station. GENERATED by tools/halcyon/emit.mjs from the
// plan book's hole data (tools/halcyon/holes.mjs, world.mjs, scene.mjs): don't edit by hand. Each hole's ground is a
// sampled field (terrain.js prepField) with the ring's curve from its back tee in it; the lake and the canal play as
// water, and so do the floor windows and the rim glass (flush: a stroke and a drop beside where the ball crossed);
// its green and bunkers are outlines over it; villas, walls, the clubhouse, the spoke's feet and the rim walls are
// rocks the ball hits; its trees play; and ring-world.js draws COURSE.ring (the station once, in ring space) on the
// true cylinder in each hole's frame. The tips tee is in the data, switched off: COURSE.tipsSet is not in teeSets,
// and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${h.bunkers.length}b`).join(' '));
