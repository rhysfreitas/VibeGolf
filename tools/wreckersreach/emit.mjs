// node tools/wreckersreach/emit.mjs : writes src/course/wreckersreach.js (the course module) from the plan data, the
// same ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and
// run this (about a minute). Built like tools/buriedkingdom/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the spit as the book draws it (worldAt: every hole's own ground blended,
//            so the shared fairway and the double green are one ground), heights in 2 cm steps, with engine surface
//            codes: fairway, fringe and tee (main.js plays them as 'links' on COURSE.turf = 'links'), fescue 'rough',
//            the dunes 'sand' (the lie reads Dune), dune grass 'tussock' (a hack out), the beach 'beach', the pots
//            'pot', the sea, the lagoon, the Cauldron and the creek 'water' (bed 0.8 m under the drawn level), the
//            wrecks' footprints and stone 'desert'; and m: what the paint shows (links-world.js)
//   green    a features green with the plan's outline (keepGround: the field already has its shape); the 2nd and 8th
//            each carry the whole double green, with their own pin
//   bunkers  the hole's pots as outlines (lie 'pot')
//   rocks    what the ball hits, draw: false (links-world.js draws them): the inn, the luggers, the galleon's hull and
//            stern castle (boxes that soak: a ball drops at the foot), the man-of-war's hull behind the 4th green and
//            the brig's ribs (boxes that throw a ball back), the yard wall, the masts, the lantern post, the bell
//            post and the beacon (wedges, so a mast can lean)
//   frame    where the hole sits on the spit (links-world.js draws COURSE.links into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// COURSE.links is the spit once, in world space: a 10 m height map over the course and a 60 m one out over the sea,
// the lagoon, the mainland and the far shore (with the paint), the water level and the built things.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal, PROPS, GRASS, clusterAt, WL } from './scene.mjs';
import { V, waterAt, beachAt, SEA_LEVEL, coastD, creekD, cauldronE, CAULDRON, BAR, HUMPS } from './world.mjs';
import { edgeSegs, noise2 } from './shapes.mjs';
import { distLine, smooth, rnd } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/wreckersreach.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ENG = { dune: 'sand', fescue: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', pot: 'pot', tussock: 'tussock', beach: 'beach', water: 'water', wreck: 'desert', stone: 'desert', void: 'void' };
const CODES = ['rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'pot', 'tussock', 'beach', 'desert', 'void'];
// the paint byte (and the world map's): 0 dune sand, 1 fescue, 2 beach, 3 wreck timber, 4 stone, 5 dune grass,
// 6 pot sand, 8 water, 10 mown ground (fairway, collar, green, tee)
const MAT = { dune: 0, fescue: 1, beach: 2, wreck: 3, stone: 4, tussock: 5, pot: 6, water: 8, fairway: 10, fringe: 10, green: 10, tee: 10 };
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

// ---- the built things and wrecks, once, in world space (absolute heights): what links-world.js draws. `rot` is the
// compass direction of a box's length (radians); a post's `lean` tips it toward the east (degrees)
const BOXY = ['inn', 'lugger', 'hull', 'castle', 'wall', 'rib'], POSTS = ['mast', 'lantern', 'beacon', 'bell'];
const footOf = P => {
  if (P.sunk) return SEA_LEVEL - 1.5;
  const wa = waterAt(...P.at); if (wa) return wa.level - 1;
  return worldAt(...P.at).y - (P.kind === 'hull' || P.kind === 'castle' ? 0.8 : 0.3);
};
const BUILT_THINGS = PROPS.filter(P => P.at && (BOXY.includes(P.kind) || POSTS.includes(P.kind))).map(P => ({
  kind: P.kind, at: P.at.map(r1), y: r1(footOf(P)), h: P.h,
  ...(BOXY.includes(P.kind) ? { w: P.w, l: P.l, rot: r2(P.wrot || 0) } : { r: P.r }),
  ...(P.lean ? { lean: P.lean } : {}), ...(P.sunk ? { sunk: 1 } : {}), ...(P.wall ? { wall: 1 } : {}), ...(P.hole != null ? { hole: P.hole + 1 } : {}),
  ...(P.name || P.label ? { name: P.name || P.label } : {}),
}));

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], L = LOC[hi], base = B.base;
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
    hs[k] = y; ss[k] = CODES.indexOf(ENG[s] ?? 'sand'); ms[k] = MAT[s] ?? 0;
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Math.round((hs[k] - y0) * 50);

  // the green (the 2nd's and 8th's: the whole double green) and the pots by their outlines
  const gx = h.pin[0], gz = h.pin[1], gr = h.green.shared ? 130 : 70;
  const gOut = outlineOf((x, z) => B.gm(x, z) < 0, [gx - gr, gz - gr, gx + gr, gz + gr], 0.4);
  const green = { x: r1(gx), z: r1(gz), outline: gOut, keepGround: true, apron: h.green.apron || 3, pins: [[r1(gx), r1(gz)]] };
  const bunkers = [];
  for (const b of B.bunkers) {
    const box = b.box, inside = B.inBunker(b), clip = [Math.max(box[0], x0), Math.max(box[1], z0), Math.min(box[2], x1), Math.min(box[3], z1)];
    for (const o of allOutlines(inside, clip, 0.25)) {
      if (o.length < 6) continue;
      const cx = o.reduce((s, p) => s + p[0], 0) / o.length, cz = o.reduce((s, p) => s + p[1], 0) / o.length;
      bunkers.push({ x: r1(cx), z: r1(cz), rx: b.rx, rz: b.rz, outline: o, keepGround: true, lie: 'pot' });
    }
  }

  // what the ball hits: every built thing and wreck near this hole's play, into its frame (draw: false)
  const rocks = [];
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const hd = h.place.heading * Math.PI / 180;
  for (const S of BUILT_THINGS) {
    if (S.sunk) continue;                                  // the frigate's hull lies under the Cauldron: masts only
    const [x, z] = L(...S.at); if (!inBox(x, z, 20)) continue;
    const y = S.y - base;
    if (S.w) {
      const soak = S.kind === 'hull' ? (S.wall ? 0 : 0.8) : S.kind === 'castle' ? 0.8 : S.kind === 'inn' ? 0.6 : S.kind === 'rib' ? 0 : 0.3;
      rocks.push({ type: 'box', x: r1(x), z: r1(z), w: S.w, d: S.l, rot: r2(S.rot - hd), y: r1(y), h: r1(S.h + (S.kind === 'hull' || S.kind === 'castle' ? 0.8 : 0.3)), ...(soak ? { soak } : {}), draw: false, what: S.kind });
    } else {
      // a post or a mast (a wedge from its foot to its top, so it can lean), the beacon a round tower about 8 m across
      const lean = (S.lean || 0) * Math.PI / 180, tx = Math.sin(lean) * S.h, ty = Math.cos(lean) * S.h;
      const [ex, ez] = L(S.at[0] + tx, S.at[1]), d = S.kind === 'beacon' ? S.r * 2 : Math.max(0.5, S.r * 2);
      rocks.push({ type: 'wedge', from: [r1(x), r1(z), r1(y)], to: [r1(ex), r1(ez), r1(y + ty)], w: [r2(d), r2(d * (S.kind === 'beacon' ? 0.85 : 0.6))], h: [r2(d), r2(d * (S.kind === 'beacon' ? 0.85 : 0.6))], draw: false, what: S.kind });
    }
  }

  // the dune grass: every cluster near the field as bodies a low ball can fly into (circles of its half-width along
  // its long axis, 1.45 m tall, type 'tussock': links-world.js draws them from the field's grass cells)
  const plants = [];
  for (const g of GRASS) {
    const [cx, cz] = L(...g.c); if (!inBox(cx, cz, 12)) continue;
    const [ex, ez] = L(g.c[0] + Math.cos(g.rot), g.c[1] + Math.sin(g.rot)), ux = ex - cx, uz = ez - cz;
    const n = Math.max(1, Math.round(g.rx / g.rz)), span = g.rx - g.rz;
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : -span + 2 * span * i / (n - 1), x = cx + ux * t, z = cz + uz * t;
      plants.push({ x: r1(x), z: r1(z), type: 'tussock', h: 1.45, cr: r2(g.rz * 1.05), low: 0.04, tr: 0, s: 1, r: r2(((x * 7.3 + z * 3.1) % 1 + 1) % 1) }); }
  }
  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true, ...(h.goGreen ? { bold: true } : {}) }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(gx), r1(gz)], targets, drops: [],
    tips: { tee: h.tips.tee.map(r1), yards: h.tips.yards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: r1(h.place.at[0]), z: r1(h.place.at[1]), heading: r2(h.place.heading), base: r2(base) },
    green, bunkers, rocks, plants, card: h.words, ...(h.green.shared ? { shared: 'green' } : {}) };
}

// ---- the spit: heights every 10 m over the course (worldAt near the holes, the world beyond), and every 60 m far
// out. The world's coast closes the land along a straight edge south of the course and east of the mainland; out
// past the 10 m map the mainland carries on south and east, and a far shore of low hills closes the lagoon
const WLN = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
const WX0 = -760, WX1 = 980, WZ0 = -2260, WZ1 = 420, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
const surfOut = (X, Z) => { const wa = waterAt(X, Z); if (wa) return 'water'; if (beachAt(X, Z)) return 'beach'; return clusterAt(X, Z) ? 'tussock' : 'dune'; };
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i;
  const near = Math.min(...WLN.map(L => distLine(L, X, Z))) < 300;
  const w = near ? worldAt(X, Z) : { y: waterAt(X, Z) ? SEA_LEVEL : V(X, Z), s: surfOut(X, Z) };
  wraw[k] = w.s === 'water' ? Math.min(w.y, SEA_LEVEL) : w.y; if (wraw[k] < wlo) wlo = wraw[k];
  // a hole's dune slopes away from the play read as fescue where they're grassed; tussocks from 10 m read as dunes
  wm[k] = w.s === 'tussock' ? 0 : MAT[w.s] ?? 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };

// the far land: the mainland south of the course and east of it (south of the lagoon), and the far shore across the
// lagoon; d is metres in from its water's edge. Low grassy hills, a beach at the edge
const farShoreX = n => 1750 + 260 * noise2(n / 900, 0.3, 71) + 120 * noise2(n / 300, 0.7, 72);
function farLand(X, Z) {
  const n = -Z;
  const dW = X + 290 + 18 * noise2(n / 400, 1.1, 73);                 // the open coast carries on south
  const dS = 600 + 30 * noise2(X / 500, 2.3, 74) - n;                  // the lagoon's south shore
  const dE = X - farShoreX(n);                                          // the far shore
  let d = -Infinity;
  if (n < -400) d = Math.max(d, dW);
  if (X > 1300 && n < 700) d = Math.max(d, Math.min(dS, X > 1350 ? 1e4 : dS));
  d = Math.max(d, dE);
  return d;
}
let far;
{
  const FX0 = -9000, FX1 = 9000, FZ0 = -9500, FZ1 = 7500, FC = 60, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz), fm = new Uint8Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i;
    const wa = waterAt(X, Z), d = farLand(X, Z);
    let y, m;
    if (!wa) { y = Math.max(-1, V(X, Z)); m = beachAt(X, Z) ? 2 : 0; }
    else if (d > 0) {
      const hill = (0.55 + 0.45 * noise2(X / 700, Z / 700, 75)) * (1 - Math.abs(noise2(X / 1400, Z / 1400, 76)));
      y = 0.4 + Math.min(d * 0.05, 2.5) + 46 * smooth((d - 80) / 900) * hill; m = d < 50 ? 2 : 1;
    } else { y = Math.max(-6, d * 0.02); m = 8; }
    fr[k] = y; fm[k] = m; if (y < flo) flo = y;
  }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Math.round((fr[k] - fy0) * 4);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 4, pred: 1, h: b64(packHeights(fq, fnx)), m: b64(fm) };
}

// ---- art pass 1 (art-brief.md, Rhys's picks): what links-world.js draws round the play, laid out here where every
// hole's line and tee is known. All of it is scenery (the ball passes through it), kept off the lines of play and
// clear of the tees.
const ART = {};
{
  const TEES = HOLES.flatMap((h, k) => [...Object.values(h.teePts), h.tipsPt].filter(Boolean).map(p => WOR[k](...p)));
  const offLine = (X, Z, d) => WL.every(L => distLine(L, X, Z) >= d);
  const offTee = (X, Z, d) => TEES.every(([x, z]) => Math.hypot(X - x, Z - z) >= d);
  const spaced = (list, X, Z, d) => list.every(q => Math.hypot(q[0] - X, q[1] - Z) >= d);
  const R = rnd(7741), surf = (X, Z) => worldAt(X, Z).s, gy = (X, Z) => worldAt(X, Z).y;
  const onLand = (X, Z) => !waterAt(X, Z);
  ART.bar = BAR.map(p => p.map(r1));
  ART.humps = HUMPS.map(([c, rx, rz, rot]) => [r1(c[0]), r1(c[1]), rx, rz, rot]);
  // seals hauled out on the humps and on the beach at the point
  ART.seals = [];
  for (const [c, rx, rz, rot] of HUMPS) for (let i = 0; i < Math.round(rx / 5); i++) { const u = (R() - 0.5) * rx * 1.2, v = (R() - 0.5) * rz * 0.9;
    ART.seals.push([r1(c[0] + u * Math.cos(rot) - v * Math.sin(rot)), r1(c[1] + u * Math.sin(rot) + v * Math.cos(rot)), 0.5, r2(R() * 6.28), r2(0.85 + R() * 0.35)]); }
  for (let i = 0; i < 4000 && ART.seals.length < 34; i++) {
    const X = -260 + R() * 420, Z = -1950 + R() * 160, cd = coastD(X, Z);
    if (cd < 2 || cd > 14 || !offLine(X, Z, 70) || !offTee(X, Z, 60) || !spaced(ART.seals, X, Z, 2.4)) continue;
    if (Math.hypot(X - -40, Z - -1905) > 95) continue;
    ART.seals.push([r1(X), r1(Z), r1(gy(X, Z)), r2(R() * 6.28), r2(0.85 + R() * 0.35)]);
  }
  // reeds along the lagoon's shore and the creek's banks, in patches, from the water's edge to a few metres up
  ART.reeds = [];
  for (let i = 0; i < 90000 && ART.reeds.length < 700; i++) {
    const X = 240 + R() * 1150, Z = -1760 + R() * 1200, cd = coastD(X, Z), kd = creekD(X, Z);
    const shore = X > 300 && cd > -4 && cd < 8, creek = kd > -2.5 && kd < 5;
    if (!shore && !creek) continue;
    if (noise2(X / 45, Z / 45, 81) < -0.15 && !creek) continue;
    if (!offLine(X, Z, 32) || !offTee(X, Z, 32) || !spaced(ART.reeds, X, Z, 2.6)) continue;
    const wa = waterAt(X, Z);
    ART.reeds.push([r1(X), r1(Z), r1(wa ? SEA_LEVEL : V(X, Z)), r2(0.8 + R() * 0.5), wa ? 1 : 0]);
  }
  // gorse: round the inn and inland on the mainland (south and east), in clumps
  ART.gorse = [];
  const gorse = (X, Z) => { const s = surf(X, Z); if (!(s === 'dune' || s === 'fescue') || !onLand(X, Z)) return false;
    if (!offLine(X, Z, 30) || !offTee(X, Z, 26) || !spaced(ART.gorse, X, Z, 3.2)) return false;
    if (PROPS.some(P => P.at && P.kind === 'inn' && Math.hypot(P.at[0] - X, P.at[1] - Z) < 26)) return false;
    ART.gorse.push([r1(X), r1(Z), r1(gy(X, Z)), r2(1.1 + R() * 1.1)]); return true; };
  for (let i = 0; i < 6000 && ART.gorse.length < 70; i++) { const an = R() * 6.283, rr = 26 + R() * 70; gorse(14 + Math.cos(an) * rr, -111 + Math.sin(an) * rr); }
  for (let i = 0; i < 60000 && ART.gorse.length < 420; i++) {
    const X = -200 + R() * 1150, Z = -760 + R() * 1170;
    const inland = smooth((Z + 280) / 260) + smooth((X - 260) / 200); if (R() > inland) continue;
    if (noise2(X / 60, Z / 60, 82) < 0.1) continue;
    gorse(X, Z);
  }
  // thrift and sea holly out on the fescue and the dunes (drawn only: links-world.js puts the ones inside a hole's
  // field there itself); a scatter over the whole spit for the far views
  ART.flowers = [];
  for (let i = 0; i < 120000 && ART.flowers.length < 1600; i++) {
    const X = -300 + R() * 680, Z = -2000 + R() * 2200, s = surf(X, Z);
    if (!(s === 'fescue' || s === 'dune') || !offLine(X, Z, 45) || !offTee(X, Z, 30)) continue;
    const k = s === 'fescue' ? (R() < 0.6 ? 0 : 1) : (R() < 0.75 ? 1 : 0);   // 0 thrift, 1 sea holly
    if (noise2(X / 30, Z / 30, 83 + k) < 0.05) continue;
    ART.flowers.push([r1(X), r1(Z), r1(gy(X, Z)), k]);
  }
  // the weathered post fences on the dunes (Rhys's photo): runs along the foredune and across the lagoon-side dunes,
  // a post every 2.6 m dipping with the ground, some leaning, a few gone
  ART.fences = [];
  const run = (A, B) => { const L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.floor(L / 2.6), posts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, X = A[0] + (B[0] - A[0]) * t + noise2(i / 6, A[0], 84) * 1.2, Z = A[1] + (B[1] - A[1]) * t;
      if (!onLand(X, Z) || !offLine(X, Z, 38) || !offTee(X, Z, 40) || surf(X, Z) === 'beach') { if (posts.length > 3) ART.fences.push(posts.splice(0)); else posts.length = 0; continue; }
      if (R() < 0.06) continue;
      posts.push([r1(X), r1(Z), r1(gy(X, Z)), r2(0.9 + R() * 0.5), r2((R() - 0.5) * 0.25), r2((R() - 0.5) * 0.25)]); }
    if (posts.length > 3) ART.fences.push(posts); };
  for (let n0 = -300; n0 < 1750; n0 += 120 + R() * 90) { const X = -236 + R() * 12, l = 60 + R() * 110; run([X, -n0], [X + (R() - 0.5) * 8, -(n0 + l)]); }
  run([-200, -1820], [-120, -1870]); run([-40, -1868], [80, -1858]);
  for (const [a, b] of [[[300, -1000], [318, -1160]], [[290, -820], [305, -900]], [[120, -230], [200, -160]], [[-150, -60], [-90, 20]]]) run(a, b);
  // flotsam on the beaches along the wrack line: barrels, spars, rope, a crate, a broken oar
  ART.flotsam = [];
  for (let i = 0; i < 80000 && ART.flotsam.length < 110; i++) {
    const X = -310 + R() * 700, Z = -1960 + R() * 2000, y = V(X, Z);
    if (!beachAt(X, Z) || waterAt(X, Z) || y < 0.75 || y > 1.5 || cauldronE(X, Z) < 1.3) continue;
    if (!offLine(X, Z, 30) || !offTee(X, Z, 30) || !spaced(ART.flotsam, X, Z, 9)) continue;
    const k = [0, 0, 1, 1, 1, 2, 2, 3, 4][Math.floor(R() * 9)];   // 0 barrel, 1 spar, 2 rope, 3 crate, 4 oar
    ART.flotsam.push([r1(X), r1(Z), r1(y), k, r2(R() * 6.28), r2(0.7 + R() * 0.6)]);
  }
  // lobster pots (creels) stacked by the luggers on the hauling ground
  ART.creels = [];
  for (const P of PROPS.filter(P => P.kind === 'lugger')) for (let i = 0; i < 5; i++) {
    const an = R() * 6.283, rr = 4 + R() * 4, X = P.at[0] + Math.cos(an) * rr, Z = P.at[1] + Math.sin(an) * rr;
    if (!offLine(X, Z, 22) || !spaced(ART.creels, X, Z, 1.4)) continue;
    const st = R() < 0.5 ? 2 : 1, y0 = gy(X, Z), r = r2(R() * 6.28);
    for (let k = 0; k < st; k++) ART.creels.push([r1(X), r1(Z), r2(y0 + k * 0.5), r]);
  }
  // gulls: standing on the wrecks, the inn's ridge, the luggers and some fence posts; on the beach in loose groups;
  // flocks wheeling over the wrecks, the hauling ground and the bar
  ART.gulls = [];
  for (const B of BUILT_THINGS) {
    if (!['hull', 'castle', 'lugger', 'inn', 'rib'].includes(B.kind) || B.sunk) continue;
    const n = B.kind === 'rib' ? (R() < 0.35 ? 1 : 0) : Math.round(Math.min(8, B.l / 6)), rot = B.rot || 0;
    for (let i = 0; i < n; i++) { const u = (R() - 0.5) * (B.kind === 'inn' ? 0 : B.w * 0.5), v = (R() - 0.5) * B.l * 0.8;
      ART.gulls.push([r1(B.at[0] + u * Math.cos(rot) + v * Math.sin(rot)), r1(B.at[1] + u * Math.sin(rot) - v * Math.cos(rot)), r2(B.y + B.h), r2(R() * 6.28)]); }
  }
  for (const F of ART.fences) for (const p of F) if (R() < 0.03) ART.gulls.push([p[0], p[1], r2(p[2] + p[3]), r2(R() * 6.28)]);
  ART.oyster = [];
  for (let g = 0; g < 400 && ART.oyster.length < 60; g++) {
    const X = -300 + R() * 650, Z = -1950 + R() * 1900, y = V(X, Z);
    if (!beachAt(X, Z) || waterAt(X, Z) || y > 0.95 || cauldronE(X, Z) < 1.3 || !offLine(X, Z, 40) || !offTee(X, Z, 40)) continue;
    const n = 3 + Math.floor(R() * 6), gull = R() < 0.4;
    for (let i = 0; i < n; i++) { const x = X + (R() - 0.5) * 7, z = Z + (R() - 0.5) * 7; if (waterAt(x, z)) continue;
      (gull ? ART.gulls : ART.oyster).push([r1(x), r1(z), r2(V(x, z)), r2(R() * 6.28)]); }
  }
  const P0 = PROPS.find(P => P.name === 'the galleon'), PM = PROPS.find(P => P.kind === 'hull' && P.l > 60);
  ART.wheel = [[...P0.at.map(r1), 26, 34, 7], [...PM.at.map(r1), 30, 40, 6], [-112, -165, 20, 26, 5], [-540, -1500, 14, 60, 8], [60, -1700, 24, 45, 5]];
  // a rowing boat drifting on the lagoon, well off the 8th
  ART.boat = [[470, -1380], [540, -1220], [585, -1040], [560, -880]];
}
const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'wreckersreach', name: COURSE.name, theme: 'links', turf: 'links', altFt: COURSE.altFt,
  blurb: 'A true links on a spit of dunes where a sandbar has taken ships for centuries: firm running turf, a strong sea wind, sod-faced pots, the wrecks as walls and markers. Out to the point and the beacon tower, home along the lagoon to the Wrecker\'s Inn.',
  signature: { time: 'golden', wind: 'sea', windFrom: 225, weather: 'clear', temp: 'cool' },
  teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet,
  links: { world, far, level: SEA_LEVEL, built: BUILT_THINGS, grass: GRASS.map(g => [r1(g.c[0]), r1(g.c[1]), r1(g.rx), r1(g.rz), r2(g.rot)]),
    cauldron: { c: CAULDRON.c, rx: CAULDRON.rx, rz: CAULDRON.rz, rot: r2(CAULDRON.rot), p: CAULDRON.p, mouth: { ...CAULDRON.mouth, rot: r2(CAULDRON.mouth.rot) } }, ...ART } };
const src = `// Wrecker's Reach: nine holes of true links on a spit of dunes on a ship-graveyard coast. GENERATED by
// tools/wreckersreach/emit.mjs from the plan book's hole data (tools/wreckersreach/holes.mjs, world.mjs, scene.mjs):
// don't edit by hand. COURSE.turf = 'links': main.js plays fairways, tees and collars as physics.js 'links' (they
// run). Each hole's ground is a sampled field (terrain.js prepField): fescue plays as 'rough', the dunes as 'sand'
// (the lie reads Dune), dune grass as 'tussock', the beach as 'beach', the pots as 'pot', the sea, the lagoon, the
// Cauldron and the creek as water; its green and pots are outlines over it (the 2nd and 8th share one green); the
// wrecks, the inn, the masts and the beacon are rocks the ball hits, and links-world.js draws COURSE.links (the spit
// once, in world space) into each hole's frame. The tips tee is in the data, switched off: COURSE.tipsSet is not in
// teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.bunkers.length}b/${h.plants.length}g`).join(' '));
