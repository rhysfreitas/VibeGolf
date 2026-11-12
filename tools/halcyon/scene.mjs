// Halcyon Ring: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and the floor between the holes. A hole's ground is the station floor (world.mjs
// H: terraces, basins, the valley) plus the curve rising from the hole's back tee ((s - s_tee)² / 2R along the
// ring: "the curve plays as it looks"), with the hole's own shapes on top: its cants, ramps and forms, its green
// complex (levelled into the curve), bunkers and tee pads. Forms are shared through world space, so every hole sees
// them. Floor windows are flush glass and play as a penalty area ('window'); the lake and the canal as water.
// Shared by the plans, profiles, sketches and checks. Pure.
import { project, seDist, seOutline, smooth, clamp, at, rnd, distLine, headingAt, lerp } from './geo.mjs';
import { makeGreen, makeFairway, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { H, R, HALF, RIM, curveRise, waterAt, inWindow, nativeAt, LAKE, SPOKE } from './world.mjs';

// a green's contour, in its own frame (u right, v toward the back, metres from the pin). Directions are degrees
// clockwise from the front: 0 = toward the tee, 90 = right, 180 = the back (as tools/lostvalley).
//   { fall: deg, pct } the whole green falls toward deg; { tier: [u, v], up: deg, h, w } a step h up toward up;
//   { ridge: [[u, v], [u, v]], h, w } a spine (h < 0: a swale); { bowl: [u, v], r, h } a dip h deep, r across
const dirUV = a => [Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180)];
export function contourAt(C, u, v) {
  let g = 0;
  for (const c of C) {
    if (c.fall != null) { const [du, dv] = dirUV(c.fall); g -= (u * du + v * dv) * c.pct / 100; }
    else if (c.tier) { const [du, dv] = dirUV(c.up), d = (u - c.tier[0]) * du + (v - c.tier[1]) * dv; g += c.h * smooth(d / c.w + 0.5); }
    else if (c.ridge) { const d = distLine(c.ridge, u, v); g += c.h * Math.exp(-((d / c.w) ** 2)); }
    else if (c.bowl) { const d = Math.hypot(u - c.bowl[0], v - c.bowl[1]); g -= c.h * Math.exp(-((d / (c.r / 2)) ** 2)); }
  }
  return g;
}
export const SURF = ['park', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'window', 'wood', 'garden', 'plaza', 'stone', 'void'];
const bump = e => e >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * e);
const span = (s, a, b, r = 30) => smooth((s - a) / r) * (1 - smooth((s - b) / r));

// local -> world (X = a east, Z = -s, north is -Z)
export function toWorld(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (x, z) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz];
}
export function toLocal(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (X, Z) => { const dx = X - h.place.at[0], dz = Z - h.place.at[1]; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
}
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld), WL = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));
// the ring's arc length at each hole's back tee: its low line
const STEE = HOLES.map((h, k) => -WOR[k](...h.teePts.zenith)[1]);

// forms (mounds and hollows) shared through world space, each asked about a world point in its own hole's frame
const FORMS = [];
for (const [k, h] of HOLES.entries()) for (const f of h.forms || []) FORMS.push({ k, ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0, reach: Math.max(f.rx, f.rz) + 10 });
for (const f of FORMS) f.c = WOR[f.k](f.x, f.z);
const formLift = (f, x, z) => f.h * bump(seDist(f, x, z) + 0.06 * noise2(x / 14, z / 14, 3));
export function shapesAt(X, Z) {
  let y = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; y += formLift(f, ...LOC[f.k](X, Z)); }
  return y;
}
// the holes' own water (the 6th's bays and falls pool), in world space
const POOLS = [];
for (const [k, h] of HOLES.entries()) for (const w of h.water || []) { const c = WOR[k](...w.at); POOLS.push({ k, x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0, c, level: w.label === 'the falls pool' ? H(...c) - 0.9 : LAKE.level, label: w.label }); }
export function waterW(X, Z) {
  const w = waterAt(X, Z); if (w) return w;
  for (const p of POOLS) { if (Math.abs(X - p.c[0]) > 60 || Math.abs(Z - p.c[1]) > 60) continue; const [x, z] = LOC[p.k](X, Z); if (seDist(p, x, z) + 0.08 * noise2(X / 9, Z / 9, 5) < 1) return { level: p.level, body: 'pool' }; }
  return null;
}

export function buildHole(h) {
  const k = h.n - 1, W = WOR[k], s0 = STEE[k];
  const curveAt = (X, Z) => curveRise(-Z, s0);
  const endHead = headingAt(h.line, h.len - 1);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  const bunkers = (h.bunkers || []).map((b, i) => {
    const side = Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45;
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, kind: 'sand', side, job: b.job, pot: !!b.pot, depth: b.pot ? 1.2 : side ? 0.8 : 0.9 }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed);
  for (const b of bunkers) {   // a greenside bunker sits at least 2.5 m outside the green's edge
    if (!b.side) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
  }
  const edgeM = (b, x, z) => (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) b.box = [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  const rampAt = (s, off) => { let y = 0; for (const [a, b, dh] of h.ramps || []) y += dh * smooth((s - a) / (b - a)); return y * (1 - smooth((Math.abs(off) - 70) / 50)); };
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const onPad = (t, x, z) => { const u = (x - t.x) * tc + (z - t.z) * ts, v = (x - t.x) * ts - (z - t.z) * tc; return Math.abs(u) < (h.padL || 6) && Math.abs(v) < 5; };

  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
  const blendS = (x, z) => {   // s and offset, eased across the bisector inside each corner (as tools/lostvalley)
    const L = h.line, c = []; let acc = 0;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (l * l), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      c.push({ d, s: acc + t * l, off: (dx * (z - az) - dz * (x - ax)) / l }); acc += l;
    }
    c.sort((p, q) => p.d - q.d);
    if (c.length < 2 || Math.abs(c[0].s - c[1].s) > 60) return c[0];
    const w = 0.5 + 0.5 * smooth((c[1].d - c[0].d) / 14);
    return { d: c[0].d, s: c[0].s * w + c[1].s * (1 - w), off: c[0].off * w + c[1].off * (1 - w) };
  };
  const along = (x, z) => {
    const pr = blendS(x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  // the ground without the green and bunkers (absolute, in the hole's frame): the floor, the curve from the back
  // tee, the shared forms, and this hole's cant and ramps near its line
  // a banked avenue (`pipe: [s0, s1, height, halfWidth]`): embankments either side of the line, the ground rising as
  // (|off| / halfWidth)^1.5 to `height` at halfWidth (the line itself untouched), so a loose drive is fed back
  const pipeAt = (s, off) => { let y = 0; for (const [a, b, dep, hw] of h.pipe || []) y += dep * Math.min(1, Math.abs(off) / hw) ** 1.5 * span(s, a, b, 40); return y; };
  function rawAbs(x, z) {
    const [X, Z] = W(x, z), pr = along(x, z), near = 1 - smooth((Math.abs(pr.off) - 70) / 60);
    return H(X, Z) + curveAt(X, Z) + shapesAt(X, Z) + (-cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + rampAt(pr.s, pr.off) + pipeAt(pr.s, pr.off)) * near;
  }
  // level terraces (`levels: [[s0, s1], ...]`): the ground along the line is held level from s0 to s1 at its height
  // half way, so the rise between (the curve, the ramps) comes as a bank between terraces, not one long ramp
  const LV = (h.levels || []).map(([a, b]) => ({ a, b }));
  if (LV.length) {
    const PC = [], P0 = s => { const k = Math.round(s); if (PC[k] === undefined) PC[k] = rawAbs(...at(h.line, k)); return PC[k]; };
    const P = s => { s = clamp(s, 0, h.len); const k = Math.floor(s), t = s - k; return t ? lerp(P0(k), P0(k + 1), t) : P0(k); };
    for (const l of LV) { l.c = P((l.a + l.b) / 2); l.Pa = P(l.a); l.Pb = P(l.b); }
    LV.adj = s => {
      const F = LV[0], E = LV.at(-1);
      if (s < F.a) return (F.c - F.Pa) * smooth((s - F.a + 25) / 25);
      if (s > E.b) return (E.c - E.Pb) * (1 - smooth((s - E.b) / 25));
      for (let i = 0; i < LV.length; i++) {
        const l = LV[i]; if (s <= l.b) return l.c - P(s);
        const m = LV[i + 1]; if (s < m.a) return lerp(l.c, m.c, smooth((s - l.b) / (m.a - l.b))) - P(s);
      }
      return 0;
    };
  }
  function baseAbs(x, z) {
    if (!LV.length) return rawAbs(x, z);
    const pr = along(x, z), near = 1 - smooth((Math.abs(pr.off) - 70) / 60);
    return rawAbs(x, z) + LV.adj(pr.s) * near;
  }
  h.base = baseAbs(...h.teePts.zenith);
  function base(x, z) {
    let y = baseAbs(x, z) - h.base;
    const go = gm(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - (Gd.falseFront ? 0.5 : 2)) / (Gd.falseFront ? 5 : 8)));
    if (go < 7) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(Gd.contour || [], u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + (b.pot ? 0.8 : 2)) / (b.pot ? 0.9 : 2.3))) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green is levelled to the pin's height (a shelf cut level into the curve), blended back over its collar
  const pinBase = baseAbs(...h.pin) - h.base;
  const level = (x, z, y) => { const go = gm(x, z); if (go > 10) return y; const raw = baseAbs(x, z) - h.base; return y + (pinBase - raw) * (1 - smooth((go + 1) / 11)); };
  for (const t of teePads) t.y = level(t.x, t.z, base(t.x, t.z)) + 0.4;

  const waterLocal = (X, Z) => { const w = waterW(X, Z); return w ? { ...w, y: w.level + curveAt(X, Z) - h.base } : null; };
  function ground(x, z) {
    const [X, Z] = W(x, z), wa = waterLocal(X, Z);
    if (wa && gm(x, z) > 2) return wa.y;
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = level(x, z, base(x, z));
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, 1 - (1 - smooth((d - 6) / 6)) * (1 - smooth((Math.abs(y - t.y) - 1) / 1.5))); }   // a pad doesn't blend down over a lip
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z), b = ground(x - d, z), c = ground(x, z + d), e = ground(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };
  const fairwayD = (x, z) => fwD(x, z);

  function surface(x, z) {
    const [X, Z] = W(x, z), go = gm(x, z);
    if (go < 0) return 'green';
    if (Math.abs(X) > HALF) return 'stone';   // past the rim wall
    if (waterW(X, Z)) return 'water';
    if (inWindow(X, -Z)) return 'window';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    const sl = slopeAt(x, z), fd = fairwayD(x, z);
    if (fd < 0 && sl < 0.35) return 'fairway';
    if (sl > 0.7) return 'stone';
    if (go < 14) return 'rough';
    if (fd < (h.corridor ?? 16)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    const nat = nativeAt(X, Z);
    if (nat === 'wood' && distLine(h.line, x, z) < 70) return 'park';   // woods only stand 70 m or more off the line
    return nat;
  }

  // the solid and built things, in the hole's frame (y up from the hole's base)
  const objs = [], gAt = (x, z) => ground(x, z);
  const notInPlay = ['fairway', 'green', 'fringe', 'tee', 'sand', 'water', 'window'];
  for (const t of h.trees || []) if (!notInPlay.includes(surface(t.x, t.z)) && (t.keep || distLine(h.line, t.x, t.z) > t.r + 9)) objs.push({ kind: t.kind, x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  const lineRot = (p) => { const pr = project(h.line, ...p); return headingAt(h.line, clamp(pr.s, 1, h.len - 1)); };
  for (const v of h.villas || []) { const rot = lineRot(v.at) + (v.rot || 0) * Math.PI / 180; objs.push({ kind: v.clubhouse ? 'clubhouse' : 'villa', x: v.at[0], z: v.at[1], w: v.w, l: v.l, h: v.h, rot, base: gAt(...v.at) - 0.3, label: v.label }); }
  for (const w of h.walls || []) objs.push({ kind: 'wall', a: [...w.a, gAt(...w.a)], b: [...w.b, gAt(...w.b)], h: w.h, t: 0.8 });
  for (const g of h.feet || []) objs.push({ kind: 'leg', x: g.at[0], z: g.at[1], w: g.w, h: g.h, base: gAt(...g.at) - 0.5, rot: headingAt(h.line, 1), label: g.label });
  if (h.bridge) objs.push({ kind: 'bridge', a: h.bridge.a, b: h.bridge.b, label: h.bridge.label });
  for (const f of h.falls || []) objs.push({ kind: 'falls', x: f.at[0], z: f.at[1], w: f.w, h: f.h, base: gAt(...f.at) - f.h });
  // the rim glass's beams (every RIM.beam.every m along each rim, on the wall's ribs) and its sill along the wall,
  // within 260 m of the line
  { const ss = h.line.map(p => -W(...p)[1]), lo = Math.min(...ss) - 300, hi = Math.max(...ss) + 300, toL = LOC[k];
    for (const side of [-1, 1]) {
      for (let sr = Math.ceil(lo / RIM.beam.every) * RIM.beam.every; sr <= hi; sr += RIM.beam.every) {
        const inner = toL(side * (HALF - RIM.w), -sr), wall = toL(side * HALF, -sr);
        if (distLine(h.line, ...inner) < 260) objs.push({ kind: 'beam', a: inner, b: wall, w: RIM.beam.w, s: sr, side }); }
      const sa = side * (HALF - RIM.sill.w / 2), pts = [];
      for (let sr = lo; sr <= hi; sr += 20) { const p = toL(sa, -sr); if (distLine(h.line, ...p) < 260) pts.push(p); }
      if (pts.length > 1) objs.push({ kind: 'sill', pts, w: RIM.sill.w, side });
    } }

  const TREE_LOW = { lime: 0.3, plane: 0.3, yew: 0, poplar: 0.15, willow: 0.15 };
  const inBox = (o, x, z) => { const c = Math.cos(o.rot), s = Math.sin(o.rot), dx = x - o.x, dz = z - o.z, u = dx * c + dz * s, v = dx * s - dz * c; return Math.abs(u) < (o.kind === 'leg' ? o.w : o.w) / 2 && Math.abs(v) < (o.kind === 'leg' ? o.w : o.l) / 2; };
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (TREE_LOW[o.kind] !== undefined && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base + o.h * TREE_LOW[o.kind], o.base + o.h, 'a tree']);
      else if ((o.kind === 'villa' || o.kind === 'clubhouse') && inBox(o, x, z)) out.push([o.base, o.base + o.h, o.kind === 'clubhouse' ? 'the clubhouse' : 'a villa']);
      else if (o.kind === 'leg' && inBox(o, x, z)) out.push([o.base, o.base + o.h, 'the spoke\'s foot']);
      else if (o.kind === 'wall' && distLine([o.a, o.b], x, z) < o.t) { const t = clamp(((x - o.a[0]) * (o.b[0] - o.a[0]) + (z - o.a[1]) * (o.b[1] - o.a[1])) / ((o.b[0] - o.a[0]) ** 2 + (o.b[1] - o.a[1]) ** 2), 0, 1), y = lerp(o.a[2], o.b[2], t); out.push([y - 0.5, y + o.h, 'a wall']); }
    }
    return out;
  }
  return { h, ground, surface, objs, solids, gm, gUV, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, curveAt, s0 };
}

export const BUILT = HOLES.map(buildHole);

// the floor between the holes (world, absolute height above the cylinder, without any hole's curve): each hole's
// own ground near its line (its curve taken back out), the floor beyond
export function worldAt(X, Z) {
  let best = -1, bd = Infinity;
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); if (d < bd) { bd = d; best = k; } }
  const B = BUILT[best], [lx, lz] = LOC[best](X, Z), w = waterW(X, Z);
  const floor = H(X, Z) + shapesAt(X, Z);
  let y = floor;
  if (bd < 200) { const own = B.ground(lx, lz) + B.base - B.curveAt(X, Z); y = lerp(own, floor, smooth((bd - 110) / 90)); }
  if (w && !(bd < 60 && B.gm(lx, lz) < 2)) return { y: w.level, s: 'water', k: best };
  const s = bd < 140 ? B.surface(lx, lz) : inWindow(X, -Z) ? 'window' : nativeAt(X, Z);
  return { y, s, k: best };
}
export { WL, LOC, WOR, STEE };
