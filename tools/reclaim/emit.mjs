// node tools/reclaim/emit.mjs : writes src/course/reclaim.js (the course module) from the plan data, the same
// shapes the plan book draws. Don't hand-edit the module: edit holes.mjs / scene.mjs and run this.
// Each hole carries:
//   field   its ground sampled every 2 m (heights in 2 cm steps, NaN = open air) and surfaces (terrain.js prepField)
//   green, bunkers   shaped features (features.js) over the field; tees on raised pads as on every course
//   rocks   what the ball hits: buildings (boxes whose facades soak a ball), the Atrium's columns, the El, the
//           fallen towers and their chunks (wedges), cars, the bridge
//   plants  the trees, which play
//   city    what city-world.js draws: buildings (broken tops, open floors, lean, ivy), the El, spans and chunks,
//           cars, poles, cranes, the bridge, water and the river, in this hole's frame (heights from its base)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE } from './holes.mjs';
import { BUILT, toWorld, toLocal, cityFill, RIVER, SURF } from './scene.mjs';
import { at, headingAt, distLine, YD, rectPts } from './geo.mjs';
import { packHeights } from '../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../../src/course/reclaim.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const CITY = cityFill(), WL = HOLES.map(h => h.line.map(p => toWorld(h)(...p)));
// my surfaces -> the engine's ('desert' is native ground: here the cracked street); sand comes from the bunkers
const ENG = { street: 'desert', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'green', tee: 'tee', sand: 'rough', water: 'water', rubble: 'rough', stands: 'desert', deck: 'desert', building: 'desert', void: 'void' };
const CODES = ['desert', 'rough', 'fairway', 'fringe', 'green', 'tee', 'water', 'void'];

function holeOut(hi) {
  const h = HOLES[hi], B = BUILT[hi], toHere = toLocal(h), base = h.base;
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 175) / CELL) * CELL, x1 = Math.max(...xs) + 175, z0 = Math.floor((Math.min(...zs) - 165) / CELL) * CELL, z1 = Math.max(...zs) + 150;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), ss = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * CELL, z = z0 + j * CELL, s = B.surface(x, z);
    let y = B.ground(x, z);
    if (y !== null && s === 'water') y -= 0.8;                     // water: a bed under the drawn level
    hs[j * nx + i] = y === null ? NaN : y; ss[j * nx + i] = CODES.indexOf(ENG[s]);
    if (y !== null && y < lo) lo = y;
  }
  // where the ground is rubble (heaps, ramps, banks): grass over it, plays as rough, with chunks drawn on it
  const rubble = [];
  for (let z = z0; z < z1; z += 4) for (let x = x0; x < x1; x += 4) if (B.surface(x, z) === 'rubble') rubble.push(r1(x), r1(z));
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz);
  for (let k = 0; k < q.length; k++) q[k] = Number.isNaN(hs[k]) ? -32768 : Math.round((hs[k] - y0) * 50);
  const b64 = a => Buffer.from(a.buffer).toString('base64');

  // the green and its bunkers as shaped features over the field
  // g.engine: the complex's style and shaping for features.js (else a gentle tilt; a punchbowl in a pit); g.lobes: its
  // outline; g.pins: more pins as [u, b] from the first, in the green's frame (u right, b toward the back)
  const g = h.green, style = g.engine || (h.pit ? { style: 'punchbowl' } : { style: 'tilt', tilt: 0.6 });
  const from = h.line[h.line.length - 2], rot = Math.atan2(h.pin[0] - from[0], -(h.pin[1] - from[1])), gc = Math.cos(rot), gs = Math.sin(rot);
  const pinAt = ([u, b]) => [r1(h.pin[0] + u * gc + b * gs), r1(h.pin[1] + u * gs - b * gc)];
  const green = { x: r1(h.pin[0]), z: r1(h.pin[1]), rx: g.rx, rz: g.rz, ...(g.lobes ? { lobes: g.lobes, join: g.join, wob: g.wob } : {}), from: [r1(from[0]), r1(from[1])], ...style,
    pins: [[0, 0], ...(g.pins || [])].map(pinAt) };
  const bunkers = (h.bunkers || []).map(b => ({ x: r1(b.at[0]), z: r1(b.at[1]), rx: b.rx, rz: b.rz, ...(b.rot ? { rot: b.rot } : {}), style: b.style || 'flashed' }));

  // what the ball hits
  const rocks = [], city = { bldg: [], el: [], span: [], cars: [], poles: [], cranes: [], cols: [], bridge: [], water: [], rivers: [], slabs: [] };
  const box = (x, z, w, d, rot, y, hh, soak) => rocks.push({ type: 'box', x: r1(x), z: r1(z), w: r1(w), d: r1(d), rot: r2(rot || 0), y: r1(y), h: r1(hh), ...(soak ? { soak } : {}) });
  const wedge = (a, b, w, t) => rocks.push({ type: 'wedge', from: [r1(a[0]), r1(a[1]), r1(a[2])], to: [r1(b[0]), r1(b[1]), r1(b[2])], w: [r1(w), r1(w)], h: [r1(t), r1(t)] });
  const nearPlay = (x, z, d) => distLine(h.line, x, z) < d;
  // a hole's own things (map = identity, yoff 0) and the other holes' (into this frame, their base)
  const take = (objs, map, yoff, own, kHole) => {
    for (const o of objs) {
      const tr = p => map(p[0], p[1]);
      if (o.kind === 'bldg') {
        const pts = o.pts.map(tr), c = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4];
        const w = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), d = Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]), rot = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
        let lean = null;
        if (o.lean) { const Hk = HOLES[kHole], a = headingAt(Hk.line, Hk.len - 1), p0 = map(0, 0), p1 = map(Math.sin(a) * 100, -Math.cos(a) * 100), l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); lean = [r2((p1[0] - p0[0]) / l), r2((p1[1] - p0[1]) / l), o.lean.deg]; }
        city.bldg.push({ p: pts.map(q => [r1(q[0]), r1(q[1])]), y: r1(o.base + yoff), h: o.h, b: o.broken === 'snap' ? 2 : o.broken ? 1 : 0, ...(o.open ? { open: o.open, cols: o.cols || 4 } : {}), ...(lean ? { lean } : {}), ...(o.tower ? { tower: o.tower } : {}), ...(o.vines ? { v: 1 } : {}), s: o.seed % 9973 });
        if (nearPlay(c[0], c[1], 260)) {
          if (o.open) { box(c[0], c[1], w, d, rot, o.base + yoff + o.open, o.h - o.open, 0.45); }
          else box(c[0], c[1], w, d, rot, o.base + yoff, o.h + (o.tower ? o.tower.h : 0), 0.45);
          if (o.open) for (let u = 0; u < (o.cols || 4); u++) for (let v = 0; v < (o.cols || 4); v++) {
            const t = (u + 0.5) / (o.cols || 4), s2 = (v + 0.5) / (o.cols || 4), px = pts[0][0] + (pts[1][0] - pts[0][0]) * t + (pts[3][0] - pts[0][0]) * s2, pz = pts[0][1] + (pts[1][1] - pts[0][1]) * t + (pts[3][1] - pts[0][1]) * s2;
            box(px, pz, 2.2, 2.2, rot, o.base + yoff, o.open, 0.3); city.cols.push([r1(px), r1(pz), r1(o.base + yoff), o.open, 1.1]);
          }
        }
      } else if (o.kind === 'tree' && own) { /* plants, below */ }
      else if (o.kind === 'box') { // wrecks
        const pts = o.pts.map(tr), c = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4], rot = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
        const w = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), d = Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]);
        city.cars.push([r1(c[0]), r1(c[1]), r1(o.base + yoff), r2(rot), r1(w), r1(d), r1(o.h), o.color, o.moss ? 1 : 0, o.car ? 1 : 0]);
        if (own) box(c[0], c[1], w, d, rot, o.base + yoff, o.car ? 1.5 : o.h);
      } else if (o.kind === 'el') {
        const pts = o.pts.map(tr);
        city.el.push({ p: pts.map(q => [r1(q[0]), r1(q[1])]), y: o.y + yoff, w: o.w, broken: !!o.broken });
        if (own || pts.some(p => nearPlay(p[0], p[1], 150))) {
          let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          for (let s = 0; s < len - 0.1; s += 12) { const a = at(pts, s), b = at(pts, Math.min(len, s + 12)); wedge([a[0], a[1], o.y + yoff - 0.8], [b[0], b[1], o.y + yoff - 0.8], o.w, 1.6); }
        }
      } else if (o.kind === 'span') {
        const a = tr(o.a), b = tr(o.b);
        city.span.push([r1(a[0]), r1(a[1]), r1(o.a[2] + yoff), r1(b[0]), r1(b[1]), r1(o.b[2] + yoff), r1(o.w), r1(o.t), o.girder ? 2 : o.rubble || o.torn ? 1 : o.fallen ? 3 : o.deck ? 4 : 0]);
        if ((own || nearPlay(a[0], a[1], 150)) && !o.girder && o.w > 1.2) wedge([a[0], a[1], o.a[2] + yoff], [b[0], b[1], o.b[2] + yoff], o.w, o.t);
      } else if (o.kind === 'slab') {
        const pts = o.pts.map(tr); city.slabs.push({ p: pts.map(q => [r1(q[0]), r1(q[1])]), y: o.y + yoff, t: o.t, legs: !!o.legs });
        if (!o.legs && own) { const c = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4], w = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), d = Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]); box(c[0], c[1], w, d, Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), o.y + yoff - o.t, o.t); }
      } else if (o.kind === 'col') { const p = tr([o.x, o.z]); city.cols.push([r1(p[0]), r1(p[1]), r1(o.base + yoff), o.h, o.r]); if (own) box(p[0], p[1], o.r * 2, o.r * 2, 0, o.base + yoff, o.h); }
      else if (o.kind === 'pole') { const p = tr([o.x, o.z]); city.poles.push([r1(p[0]), r1(p[1]), r1(o.base + yoff), o.h, o.lean || 0]); if (own) box(p[0], p[1], 1.2, 1.2, 0, o.base + yoff, o.h); }
      else if (o.kind === 'crane') { const p = tr([o.x, o.z]); city.cranes.push([r1(p[0]), r1(p[1]), r1(o.base + yoff), o.h]); if (own) box(p[0], p[1], 3.2, 3.2, 0, o.base + yoff, o.h); }
      else if (o.kind === 'bridge') { const a = tr(o.a), b = tr(o.b); city.bridge.push([r1(a[0]), r1(a[1]), r1(b[0]), r1(b[1]), r1(o.base + yoff), o.h]);
        if (own) for (const p of [a, b]) { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l; for (const k of [1, -1]) box(p[0] + nx * 12 * k, p[1] + nz * 12 * k, 4.4, 4.4, 0, o.base + yoff, o.h); } }
      else if (o.kind === 'ramp') { const a = tr(o.from), b = tr(o.to); city.span.push([r1(a[0]), r1(a[1]), r1(o.y[0] + yoff - 1), r1(b[0]), r1(b[1]), r1(o.y[1] + yoff - 1), o.w, 2, 4]); }
    }
  };
  take(B.objs, (x, z) => [x, z], 0, true, hi);
  const boxC = [(x0 + x1) / 2, (z0 + z1) / 2];
  const ownCity = city; // the hole's own scenery, drawn in its frame
  // the other holes' things and the city: solid where they stand near this hole's play (drawn from COURSE.city)
  for (const [k, Bk] of BUILT.entries()) {
    if (k === hi) continue;
    const Wk = toWorld(HOLES[k]), m = (x, z) => toHere(...Wk(x, z)), yoff = HOLES[k].base - base;
    for (const o of Bk.objs) if (o.kind === 'bldg') { const pts = o.pts.map(p => m(...p)), c = [pts.reduce((a, p) => a + p[0], 0) / 4, pts.reduce((a, p) => a + p[1], 0) / 4];
      if (nearPlay(c[0], c[1], 200)) box(c[0], c[1], Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[3][0] - pts[0][0], pts[3][1] - pts[0][1]), Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), o.base + yoff, o.h, 0.45); }
  }
  for (const c of CITY) { const pts = c.pts.map(p => toHere(...p)), cx = pts.reduce((a, p) => a + p[0], 0) / 4, cz = pts.reduce((a, p) => a + p[1], 0) / 4;
    if (nearPlay(cx, cz, 200)) box(cx, cz, c.w, c.d, Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), c.base - base, c.h, c.kind === 'heap' ? 0 : 0.45); }
  if (false) for (const [k, Bk] of BUILT.entries()) {
    if (k === hi) continue;
    const Wk = toWorld(HOLES[k]), m = (x, z) => toHere(...Wk(x, z)), yoff = HOLES[k].base - base;
    const near = HOLES[k].line.some(p => { const q = m(...p); return Math.hypot(q[0] - boxC[0], q[1] - boxC[1]) < 900; });
    take(Bk.objs.filter(o => near ? o.kind !== 'tree' : ['bldg', 'span', 'el', 'bridge'].includes(o.kind)), m, yoff, false, k);
    // the other holes' trees, drawn only (they are far from this hole's play)
    if (near) for (const o of Bk.objs) if (o.kind === 'tree') { const p = m(o.x, o.z); if (!nearPlay(p[0], p[1], 120)) (city.trees ||= []).push([r1(p[0]), r1(p[1]), r1(o.base + yoff), r1(o.r), r1(o.h)]); }
  }
  if (false) for (const c of CITY) {
    const pts = c.pts.map(p => toHere(...p)), cx = pts.reduce((a, p) => a + p[0], 0) / 4, cz = pts.reduce((a, p) => a + p[1], 0) / 4;
    if (Math.hypot(cx - boxC[0], cz - boxC[1]) > 1600) continue;
    city.bldg.push({ p: pts.map(q => [r1(q[0]), r1(q[1])]), y: r1(c.base - base), h: Math.round(c.h), b: c.kind === 'heap' ? 3 : c.broken ? 1 : 0, ...(c.vines ? { v: 1 } : {}), s: c.seed % 9973 });
    if (nearPlay(cx, cz, 200)) box(cx, cz, c.w, c.d, 0, c.base - base, c.h, c.kind === 'heap' ? 0 : 0.45);
  }
  // water to draw: ponds (ellipses, at their level), the inlet and the river (ribbons)
  for (const w of h.water || []) city.water.push([r1(w.at[0]), r1(w.at[1]), r1(w.rx * (w.p ? 1.15 : 1)), r1(w.rz * (w.p ? 1.15 : 1)), r2(w.rot || 0), w.y]);
  if (h.inlet) city.rivers.push({ p: h.inlet.pts.map(q => [r1(q[0]), r1(q[1])]), w: h.inlet.w, y: h.inlet.y - base });

  // the trees, which play
  const plants = B.objs.filter(o => o.kind === 'tree').map(o => ({ x: r1(o.x), z: r1(o.z), s: r2(o.r / 3), type: o.r > 7 ? 'cotton' : 'oak', r: r2((o.x * 7.3 + o.z * 3.1) % 1 + (o.x < 0 ? 1 : 0)) }));
  // the hole's compass heading, tee to green
  const heading = Math.round((h.place.heading + Math.atan2(h.pin[0], -h.pin[1]) * 180 / Math.PI + 360) % 360);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, [r1(p[0]), r1(p[1])]]));
  const targets = [...(h.targets || []).filter(t => !t.pin).map(t => ({ name: t.name, x: r1(t.at[0]), z: r1(t.at[1]) })), { name: 'Green', pin: true }];
  return { n: h.n, name: h.name, par: h.par, heading, line: h.line.map(p => [r1(p[0]), r1(p[1])]), tees, yards: h.yards, pin: [r1(h.pin[0]), r1(h.pin[1])], targets, drops: [],
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss) },
    frame: { x: h.place.at[0], z: h.place.at[1], heading: h.place.heading, base },
    green, bunkers, rocks, plants, city, rubble, card: h.words };
}

const holes = HOLES.map((_, i) => holeOut(i));
// the city, once, in world space (x east, -z north, absolute heights): every hole's scenery, the blocks between,
// the river; city-world.js puts what's near into each hole's frame (hole.frame)
const W = { bldg: [], el: [], span: [], cars: [], poles: [], cranes: [], cols: [], bridge: [], water: [], rivers: [], slabs: [], trees: [] };
for (const [k, h] of holes.entries()) {
  const Hk = HOLES[k], Wf = toWorld(Hk), P = p => { const q = Wf(p[0], p[1]); return [r1(q[0]), r1(q[1])]; }, Y = y => r1(y + Hk.base), a = Hk.place.heading * Math.PI / 180;
  const R = rot => r2(rot + a);   // a yaw in the hole's frame (from +x toward +z) -> world
  for (const b of h.city.bldg) W.bldg.push({ ...b, p: b.p.map(P), y: Y(b.y), ...(b.lean ? { lean: [r2(b.lean[0] * Math.cos(a) - b.lean[1] * Math.sin(a)), r2(b.lean[0] * Math.sin(a) + b.lean[1] * Math.cos(a)), b.lean[2]] } : {}) });
  for (const e of h.city.el) W.el.push({ ...e, p: e.p.map(P), y: Y(e.y) });
  for (const s of h.city.span) { const A = P([s[0], s[1]]), Bq = P([s[3], s[4]]); W.span.push([...A, Y(s[2]), ...Bq, Y(s[5]), ...s.slice(6)]); }
  for (const c of h.city.cars) { const A = P(c); W.cars.push([...A, Y(c[2]), R(c[3]), ...c.slice(4)]); }
  for (const c of h.city.poles) W.poles.push([...P(c), Y(c[2]), c[3], c[4]]);
  for (const c of h.city.cranes) W.cranes.push([...P(c), Y(c[2]), c[3]]);
  for (const c of h.city.cols) W.cols.push([...P(c), Y(c[2]), c[3], c[4]]);
  for (const b of h.city.bridge) W.bridge.push([...P([b[0], b[1]]), ...P([b[2], b[3]]), Y(b[4]), b[5]]);
  for (const w of h.city.water) W.water.push([...P(w), r2(w[2]), r2(w[3]), R(w[4]), Y(w[5])]);
  for (const r of h.city.rivers) W.rivers.push({ p: r.p.map(P), w: r.w, y: Y(r.y) });
  for (const s of h.city.slabs) W.slabs.push({ ...s, p: s.p.map(P), y: Y(s.y) });
  for (const t of h.plants) { const q = P([t.x, t.z]); W.trees.push([...q, k]); }
  delete h.city;
}
W.rivers.push({ p: RIVER.pts.map(p => [r1(p[0]), r1(p[1])]), w: RIVER.w, y: RIVER.y });
for (const c of CITY) W.bldg.push({ p: c.pts.map(q => [r1(q[0]), r1(q[1])]), y: r1(c.base), h: Math.round(c.h), b: c.kind === 'heap' ? 3 : c.broken ? 1 : 0, ...(c.vines ? { v: 1 } : {}), s: c.seed % 9973 });
const course = { id: 'reclaim', name: 'The Reclaim', theme: 'city', altFt: COURSE.altFt,
  blurb: 'Nine holes through a city that nature has taken back. Towers stand gutted, the streets have cracked and gone to grass, and someone kept a course mown through the ruins.',
  voidText: ['Into the ground', 'Ends down the hole'],
  signature: { time: 'morning', wind: 'light', windFrom: 'random', weather: 'haze', temp: 'cool' },
  teeSets: COURSE.teeSets, city: W };
const src = `// The Reclaim: nine holes through a city that nature has taken back. GENERATED by tools/reclaim/emit.mjs from
// the plan book's hole data (tools/reclaim/holes.mjs): don't edit by hand. Each hole's ground is a sampled field
// (terrain.js prepField), its green and bunkers are shaped features, its buildings, the El, the fallen towers and
// the cars are rocks the ball hits (facades soak some balls), its trees play, and city-world.js draws hole.city.
export const COURSE = ${JSON.stringify(course)};
export const HOLES = ${JSON.stringify(holes)};
`;
fs.writeFileSync(OUT, src);
console.log(OUT, (src.length / 1e6).toFixed(2) + ' MB', holes.map(h => `${h.n}:${h.rocks.length}r/${h.plants.length}t/${(h.field.h.length / 1e3).toFixed(0)}k`).join(' '), 'city', W.bldg.length);
