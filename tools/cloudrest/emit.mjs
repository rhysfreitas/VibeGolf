// node tools/cloudrest/emit.mjs : writes src/course/cloudrest.js (the course module) from the plan data, the same
// ground and shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / world.mjs / scene.mjs and run
// this (about two minutes). Built like tools/eldergrove/emit.mjs. Each hole carries:
//   field    its ground sampled every 2 m from the gorge as the book draws it (worldAt: every hole's own ground
//            blended, the walls and kerbs on top), heights in 2 cm steps, NaN over open air (the mist: terrain.js
//            reads it as no ground, the ball falls and it's a cloud drop), with engine surface codes: fairway, fringe,
//            tee, rough (mountain grass, scrub, the tea rows), native 'desert' (rock, the kerbs, the courtyard's
//            paving), sand, water (the stream and the two pools, bed 0.8 m under the drawn level); and m: what the
//            paint shows (cloud-world.js)
//   green    a features green with the plan's outline (keepGround: the field already has its shape)
//   bunkers  the hole's sand by its outlines
//   rocks    what the ball hits besides the ground, draw: false (cloud-world.js draws them): the monastery's halls,
//            the stupa, the gate house, the prayer-wheel house and the cairn (boxes that soak like a cliff), the
//            courtyard's walls, the balcony's parapet (it throws a long ball back), and the alcove's roof as slabs
//            of rock 80-90 m up
//   frame    where the hole sits in the gorge (cloud-world.js draws COURSE.cloud into it)
//   tips     the tips tee, switched off (COURSE.tipsSet is kept out of teeSets; each hole's tips out of tees/yards)
// The cliff faces are part of the field's ground, so a ball into one is a wall the physics soaks (COURSE.wallSoak).
// COURSE.cloud is the gorge once, in world space: a 10 m height map over the course and a 40 m one out to 5 km (with
// the paint; open air stored as gaps), the mist's level, the built things, the pines, the alcove's roof.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, worldAt, toWorld, toLocal, WL, PINES, HD } from './scene.mjs';
import { V, SITES, MIST, ROOF, WLINES, roofOver, LIP1, PINNACLES, NEEDLE, WALLS, CLEFT_HEAD, LINES } from './world.mjs';
import { noise1 } from './shapes.mjs';
import { edgeSegs } from './shapes.mjs';
import { at, headingAt } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/cloudrest.js');
const CELL = 2, GAP = -32768, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ENG = { rough: 'rough', scrub: 'rough', tea: 'rough', rock: 'desert', kerb: 'desert', paving: 'desert', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee', sand: 'sand', water: 'water', void: 'void' };
const CODES = ['rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'desert', 'void'];
// the paint byte (and the world map's): 0 rough, 1 scrub, 2 rock, 3 kerb, 4 tea, 5 paving, 6 sand, 8 water,
// 10 mown ground (fairway, collar, green, tee), 255 open air
const MAT = { rough: 0, scrub: 1, rock: 2, kerb: 3, tea: 4, paving: 5, sand: 6, water: 8, fairway: 10, fringe: 10, green: 10, tee: 10, void: 255 };
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

// the alcove's roof as slabs of rock along the 7th's line (world space): its underside from roofOver, 30 m thick
const ROOFBOX = [];
{
  const L = WLINES[ROOF.hole], mid = (ROOF.off0 + ROOF.off1) / 2, wd = ROOF.off1 - ROOF.off0 + 6;
  for (let s = ROOF.s0 + 12.5; s < ROOF.s1; s += 25) {
    const c = at(L, Math.max(0, s), mid), hd = headingAt(L, Math.max(1, s));
    let lo = Infinity; for (let o = ROOF.off0 + 4; o < ROOF.off1; o += 8) for (const ds of [-10, 0, 10]) { const r = roofOver(...at(L, Math.max(0, s + ds), o)); if (r !== null) lo = Math.min(lo, r); }
    if (lo === Infinity) continue;
    ROOFBOX.push({ X: c[0], Z: c[1], w: wd, l: 28, rot: hd, y: lo, h: 30 });   // 28 m long every 25 m, so the slabs overlap
  }
}
const SOAK = { hall: 0.45, stupa: 0.45, gatehouse: 0.45, wheel: 0.45, cairn: 0.45, wall: 0.3 };

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], W = WOR[hi], Lk = LOC[hi], base = B.base;
  const pts = [...h.line, ...(h.tipsPt ? [h.tipsPt] : [])], xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, [X, Z] = W(x, z), w = worldAt(X, Z), k = j * nx + i;
    if (w.y === null) { hs[k] = NaN; ss[k] = CODES.indexOf('void'); ms[k] = 255; continue; }
    let y = w.y - base;
    if (w.s === 'water') y -= 0.8;                         // a bed under the drawn level
    hs[k] = y; ss[k] = CODES.indexOf(ENG[w.s] ?? 'rough'); ms[k] = MAT[w.s] ?? 0;
    if (y < lo) lo = y;
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Number.isNaN(hs[k]) ? GAP : Math.round((hs[k] - y0) * 50);

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
  const inBox = (x, z, m = 0) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
  const rocks = B.walls.filter(o => inBox(o.x, o.z, 30)).map(o => ({ type: 'box', x: r1(o.x), z: r1(o.z), w: o.w, d: r2(o.l), rot: r2(o.rot), y: r1(o.y - 0.6), h: r1(o.h + 0.6), soak: /parapet/.test(o.name) ? 0 : SOAK[o.kind] ?? 0.45, draw: false, what: o.name || o.kind }));
  for (const R of ROOFBOX) { const [x, z] = Lk(R.X, R.Z); if (!inBox(x, z, 40)) continue; rocks.push({ type: 'box', x: r1(x), z: r1(z), w: R.w, d: R.l, rot: r2(R.rot - HD[hi]), y: r1(R.y - base), h: R.h, soak: 0.2, draw: false, what: "the alcove's roof" }); }
  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const teePads = Object.fromEntries(Object.keys(h.teePts).map(k => [k, { w: 9, l: 9, h: 0.05 }]));
  const pinBold = (h.targets || []).some(t => t.pin && t.bold);
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]), ...(t.bold ? { bold: true } : {}) })), { name: 'Green', pin: true, ...(pinBold ? { bold: true } : {}) }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, teePads, yards: h.yards, pin: [r1(gx), r1(gz)], targets, drops: [],
    tips: { tee: h.tips.tee.map(r1), yards: h.tips.yards },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: r1(h.place.at[0]), z: r1(h.place.at[1]), heading: r2(h.place.heading), base: r2(base) },
    green, bunkers, rocks, plants: [], card: h.words };
}

// ---- the gorge once: heights every 10 m over the course (worldAt), every 40 m far out (V), open air as gaps
const WX = WL.flat().map(p => p[0]), WZ = WL.flat().map(p => p[1]);
const WX0 = Math.floor((Math.min(...WX) - 700) / 10) * 10, WX1 = Math.max(...WX) + 700, WZ0 = Math.floor((Math.min(...WZ) - 700) / 10) * 10, WZ1 = Math.max(...WZ) + 700, WC = 10;
const wnx = Math.round((WX1 - WX0) / WC) + 1, wnz = Math.round((WZ1 - WZ0) / WC) + 1;
const wq = new Int16Array(wnx * wnz), wm = new Uint8Array(wnx * wnz), wraw = new Float32Array(wnx * wnz);
let wlo = Infinity;
for (let j = 0; j < wnz; j++) for (let i = 0; i < wnx; i++) {
  const X = WX0 + i * WC, Z = WZ0 + j * WC, k = j * wnx + i, w = worldAt(X, Z);
  wraw[k] = w.y === null ? NaN : w.y; if (w.y !== null && w.y < wlo) wlo = w.y;
  wm[k] = w.y === null ? 255 : MAT[w.s] ?? 0;
}
const wy0 = Math.floor(wlo);
for (let k = 0; k < wq.length; k++) wq[k] = Number.isNaN(wraw[k]) ? GAP : Math.round((wraw[k] - wy0) * 20);
const world = { x0: WX0, z0: WZ0, cell: WC, nx: wnx, nz: wnz, y0: wy0, scale: 20, pred: 1, h: b64(packHeights(wq, wnx)), m: b64(wm) };
let far;
{
  const FX0 = -5000, FX1 = 5000, FZ0 = -5000, FZ1 = 5000, FC = 40, fnx = Math.round((FX1 - FX0) / FC) + 1, fnz = Math.round((FZ1 - FZ0) / FC) + 1;
  const fq = new Int16Array(fnx * fnz), fr = new Float32Array(fnx * fnz), fm = new Uint8Array(fnx * fnz); let flo = Infinity;
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    const X = FX0 + i * FC, Z = FZ0 + j * FC, k = j * fnx + i;
    const inside = X > WX0 + 40 && X < WX1 - 40 && Z > WZ0 + 40 && Z < WZ1 - 40;
    const y = inside ? worldAt(X, Z).y : V(X, Z);
    fr[k] = y === null ? NaN : y; fm[k] = y === null ? 255 : 1; if (y !== null && y < flo) flo = y;
  }
  const fy0 = Math.floor(flo); for (let k = 0; k < fq.length; k++) fq[k] = Number.isNaN(fr[k]) ? GAP : Math.round((fr[k] - fy0) * 4);
  far = { x0: FX0, z0: FZ0, cell: FC, nx: fnx, nz: fnz, y0: fy0, scale: 4, pred: 1, h: b64(packHeights(fq, fnx)), m: b64(fm) };
}
const ground = (X, Z) => worldAt(X, Z).y;
const sites = SITES.map(o => ({ kind: o.kind, name: o.name, at: [r1(o.at[0]), r1(o.at[1])], w: o.w, l: o.l, h: o.h, rot: r2(o.rot), roof: o.roof || null, y: r2(ground(...o.at) ?? MIST), ...(o.face ? { face: true } : {}) }));
const pines = PINES.map(t => [r1(t.X), r1(t.Z), r2(t.y), r1(t.h), r2(t.r)]);
const roof = { under: ROOF.under, boxes: ROOFBOX.map(R => ({ at: [r1(R.X), r1(R.Z)], w: R.w, l: R.l, rot: r2(R.rot), y: r1(R.y), h: R.h })) };
// the pinnacles as world.mjs draws them (art pass 1): centre, top and the outline's radius every 11.25 degrees from
// the same noise, so cloud-world.js can draw each as an irregular column (the 10 m map makes them square blocks)
const pinnacles = PINNACLES.map(([x, n, r, top], i) => [x, -n, top, Array.from({ length: 32 }, (_, k) => { const a = k / 32 * Math.PI * 2; return r1(r * (1 + 0.16 * noise1(a * 2.2 + 40 + i, 40 + i) + 0.07 * noise1(a * 7 + (40 + i) * 3, 41 + i))); })]);
pinnacles.push([NEEDLE.c[0], -NEEDLE.c[1], NEEDLE.top - 3.4, Array.from({ length: 32 }, (_, k) => r1(NEEDLE.r * (1 + 0.06 * noise1(k / 32 * Math.PI * 2 * 3, 31))))]);
// every hole's play in world space (art pass 1): tips, back tee, the line to the pin, and all the tee spots, so the
// drawn scenery (pines, flags, chortens, birds) keeps off the lines of play and clear of the tees
const play = HOLES.map((h, k) => { const W = toWorld(h), P = q => W(...q).map(r1); return { line: [P(h.tipsPt), ...h.line.map(P)].filter((q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 0.5), tees: [...Object.values(h.teePts), h.tipsPt].map(P) }; });
// the alcove's two walls (art pass 1): fins of rock from the floor to the roof. The 10 m map draws them as cones;
// cloud-world.js draws each as a wall: points every 6 m along its face with the way into the fin, the floor in front
// and the top (the roof's underside, plus a little to bury it, where the roof is over it)
const fins = WALLS.filter(wl => wl.thick).map(wl => {
  const out = [], P = wl.P;
  for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], [bx, bz] = P[k + 1], l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(l / 6));
    for (let q = 0; q <= n; q++) { if (q === n && k < P.length - 2) continue; const t = q / n, X = ax + (bx - ax) * t, Z = az + (bz - az) * t, tx = (bx - ax) / l, tz = (bz - az) / l;
      let nx = -tz, nz = tx; const yp = worldAt(X + nx * 10, Z + nz * 10).y ?? -1e9, ym = worldAt(X - nx * 10, Z - nz * 10).y ?? -1e9; if (ym > yp) { nx = -nx; nz = -nz; }
      const floor = worldAt(X - nx * 7, Z - nz * 7).y ?? MIST, rf = roofOver(X, Z), top = rf !== null ? rf + 8 : floor + wl.h;
      out.push([r1(X), r1(Z), r2(nx), r2(nz), r1(floor), r1(top)]); } }
  return { pts: out, thick: wl.thick };
});
// the thread of waterfall at the cleft's head (art pass 1): the lip's point, height and the way out over the cleft
const falls = (() => { const L2 = LINES[1], d = Math.hypot(L2[1][0] - L2[0][0], L2[1][1] - L2[0][1]), lx = -(L2[1][1] - L2[0][1]) / d, ln = (L2[1][0] - L2[0][0]) / d;   // left of travel, toward the gorge, in [x, n]
  let H = [CLEFT_HEAD[0], CLEFT_HEAD[1]]; for (let k = 0; k < 40 && V(H[0], -H[1]) === null; k++) H = [H[0] - lx, H[1] - ln];   // back from the cleft onto the lip
  return { X: r1(H[0]), Z: r1(-H[1]), y: r1(V(H[0], -H[1])), ox: r2(lx), oz: r2(-ln) }; })();
const cloud = { world, far, mist: MIST, sites, pines, roof, pinnacles, play, fins, falls };

const holes = HOLES.map((_, i) => { const o = holeOut(i); process.stdout.write(`${i + 1} `); return o; });
const course = { id: 'cloudrest', name: COURSE.name, theme: 'cloud', altFt: COURSE.altFt, turf: COURSE.turf, wallSoak: COURSE.wallSoak,
  blurb: 'Golf on the sides of a misty gorge at 8,500 ft: two facing cliffs hung with pines, stone pinnacles standing out of the cloud, a monastery in the far wall. The wall gives (a ball into a cliff drops at its foot about half the time) and the mist takes. The air is thin: the ball flies about 12% further.',
  signature: { time: 'golden', wind: 'light', weather: 'haze', temp: 'cool' },
  voidText: COURSE.voidText, teeSets: COURSE.teeSets, tipsSet: COURSE.tipsSet, cloud };
const src = `// Cloudrest: nine holes on the sides of a misty gorge at 8,500 ft. GENERATED by tools/cloudrest/emit.mjs from the plan
// book's hole data (tools/cloudrest/holes.mjs, world.mjs, scene.mjs): don't edit by hand. Each hole's ground is a
// sampled field (terrain.js prepField), open air (the mist) as gaps: a ball that goes over an edge is a cloud drop.
// The cliffs are part of the ground, so a ball into one is a wall the physics soaks 45% of the time (COURSE.wallSoak);
// the fairways, tees and collars play as damp turf (COURSE.turf); the air is thin (COURSE.altFt). Its green and sand
// are outlines over the field; the monastery, the stupa and the alcove's roof are rocks. cloud-world.js draws
// COURSE.cloud (the gorge once, in world space) into each hole's frame. The tips tee is in the data, switched off:
// COURSE.tipsSet is not in teeSets, and each hole's tips is not in its tees or yards.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log('\n' + OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.bunkers.length}b`).join(' '));
