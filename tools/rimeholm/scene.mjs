// Rimeholm: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and a blended glacier between the holes. Shared by the plans, the profiles
// and the sketch views, so they all show the same ground. Pure.
import { project, seDist, rectPts, inPoly, profileFn, smooth, clamp, at, rnd, distLine, headingAt, lerp } from './geo.mjs';
import { HOLES } from './holes.mjs';

export const SURF = ['snow', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'ice', 'rock', 'rubble', 'travertine', 'hall', 'void'];
const bump = e => e >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * e);
const span = (s, a, b, r = 30) => smooth((s - a) / r) * (1 - smooth((s - b) / r));

function fwLines(h) {
  return (h.fairway || []).map(([s0, s1, w, off = 0]) => {
    const pts = []; for (let s = s0; s <= s1 + 0.01; s += 4) pts.push(at(h.line, Math.min(s, s1), off));
    return { pts, w };
  });
}

export function buildHole(h) {
  const prof = profileFn(h.prof), F = fwLines(h), W = toWorld(h);
  const G = { x: h.pin[0], z: h.pin[1], rx: h.green.rx, rz: h.green.rz, rot: h.green.rot || 0 }, gR = Math.min(G.rx, G.rz);
  const greenD = (x, z) => seDist(G, x, z);
  const gOut = (x, z) => (greenD(x, z) - 1) * gR;             // metres outside the green's edge (about)
  const endHead = headingAt(h.line, h.len - 1), ec = Math.cos(endHead), es = Math.sin(endHead);
  // the green's own frame: u right, v past the pin (+) / short of it (-)
  const gUV = (x, z) => { const dx = x - h.pin[0], dz = z - h.pin[1]; return [dx * ec + dz * es, dx * es - dz * ec]; };
  const bunkers = (h.bunkers || []).map(b => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0 }));
  const extra = (h.extraFw || []).map(e => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0 }));
  const rubble = (h.rubble || []).map(r => ({ x: r.at[0], z: r.at[1], rx: r.rx, rz: r.rz, rot: r.rot || 0 }));
  const forms = (h.forms || []).map(f => ({ ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0 }));
  const cliffs = (h.cliffs || []).map(c => ({ ...c, x: c.at[0], z: c.at[1], rot: c.rot || 0 }));
  const lake = h.lake && { ...h.lake, x: h.lake.at[0], z: h.lake.at[1], rot: h.lake.rot || 0 };
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  const voids = h.voids || [], mou = h.moulin;
  const voidD = (x, z) => { let d = Infinity; for (const v of voids) d = Math.min(d, distLine(v.pts, x, z) - v.w / 2); if (mou) d = Math.min(d, Math.hypot(x - mou.at[0], z - mou.at[1]) - mou.r); return d; };
  const teePads = Object.entries(h.teePts).map(([k, p]) => ({ k, x: p[0], z: p[1] }));
  const hallPts = h.hall && rectPts(h.hall.at[0], h.hall.at[1], h.hall.w, h.hall.d, endHead);
  const onPad = (t, x, z) => { const [u, v] = [(x - t.x) * ec + (z - t.z) * es, (x - t.x) * es - (z - t.z) * ec]; return Math.abs(u) < 6 && Math.abs(v) < 5; };
  // snow waves (sastrugi) and drifts: half a metre or so everywhere but greens, tees and water, in world space
  const waves = (X, Z) => 0.32 * Math.sin(0.093 * X + 0.4 * Math.sin(0.021 * Z)) * Math.cos(0.067 * Z - 0.2) + 0.22 * Math.sin(0.041 * X - 0.058 * Z + 1.1);

  // the line's ends carried on straight, so features measured along the line stop where they should
  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
  const along = (x, z) => {
    const pr = project(h.line, x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  function base(x, z) {   // everything but water, tee pads and the green's shaping
    const pr = along(x, z);
    let y = prof(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90);
    if (h.esker) { const E = h.esker; y -= E.h * smooth((Math.abs(pr.off) - E.w / 2) / E.fall) * span(pr.s, E.s0, E.s1); }
    for (const w of h.walls || []) y += w.h * smooth((w.side * pr.off - w.off) / w.bank) * span(pr.s, w.s0, w.s1);
    if (h.cave) { const C = h.cave; if (pr.s < C.s1 + 6) y += C.h * smooth((Math.abs(pr.off) - C.w / 2) / 3) * (1 - smooth((pr.s - C.s1) / 4)); }
    for (const f of forms) y += f.h * bump(seDist(f, x, z));
    for (const c of cliffs) { const e = seDist(c, x, z); y += c.h * smooth((1 - e) * Math.min(c.rx, c.rz) / 5); }
    // the green's surrounds: a raised green (false front) or a true punchbowl (level ground, then a hollow)
    const go = gOut(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - (Gd.falseFront ? 0.5 : 2)) / (Gd.falseFront ? 5 : 8)));
    if (Gd.punch) { const P = Gd.punch; y -= P.depth * (1 - smooth((go - P.floor) / P.bank)); }
    if (greenD(x, z) < 1.6) {   // tiers, tilts, the redan and a crown, faded out past the collar
      const fade = 1 - smooth((greenD(x, z) - 1.05) / 0.45), [u, v] = gUV(x, z);
      let g = 0;
      if (Gd.tier) g += Gd.tier.h * smooth((pr.s - Gd.tier.s) / 5);
      if (Gd.tilt) g += (Gd.tilt.side ? Gd.tilt.side * u : 0) * Gd.tilt.pct / 100 * -1 + (Gd.tilt.front ? v * Gd.tilt.pct / 100 : 0);
      if (Gd.redan) g += (-u + v) / Math.SQRT2 * -Gd.redan / 100;
      if (Gd.crown) g += Gd.crown * (1 - Math.min(1, greenD(x, z)) ** 2);
      y += g * fade;
    }
    const [X, Z] = W(x, z);
    let m = smooth((greenD(x, z) - 1.4) / 0.8);
    for (const t of teePads) m *= smooth((Math.hypot(x - t.x, z - t.z) - 7) / 8);
    y += m * waves(X, Z);
    return y;
  }
  for (const t of teePads) t.y = base(t.x, t.z) + 0.4;
  const waters = (h.water || []).map(w => { const o = { x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0, spring: w.spring }; o.y = base(o.x, o.z) - 0.6; return o; });

  function ground(x, z, raw = false) {
    if (!raw && voidD(x, z) < 0) return null;
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = base(x, z);
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, smooth((d - 6) / 6)); }
    if (lake) { const e = seDist(lake, x, z); if (e < 1) return h.lead && distLine(h.lead.pts, x, z) < h.lead.w / 2 ? lake.y - 0.35 : lake.y; if (e < 1.14) y = lerp(lake.y + 0.1, y, smooth((e - 1) / 0.14)); }
    for (const w of waters) { const e = seDist(w, x, z); if (e < 1) return w.y; if (e < 1.3) y = lerp(w.y + 0.25, y, smooth((e - 1) / 0.3)); }
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z, true), b = ground(x - d, z, true), c = ground(x, z + d, true), e = ground(x, z - d, true); return Math.hypot(a - b, c - e) / (2 * d); };

  function surface(x, z) {
    const vd = voidD(x, z);
    if (vd < 0) return 'void';
    if (lake && seDist(lake, x, z) < 1) return h.lead && distLine(h.lead.pts, x, z) < h.lead.w / 2 ? 'water' : 'ice';
    for (const w of waters) if (seDist(w, x, z) < 1) return 'water';
    if (hallPts && inPoly(hallPts, x, z)) return 'hall';
    const gd = greenD(x, z), go = gOut(x, z);
    if (gd < 1) return 'green';
    if (go < (h.green.apron || 3) || (h.green.punch && go < h.green.punch.floor + h.green.punch.bank)) return 'fringe';
    for (const b of bunkers) if (seDist(b, x, z) < 1) return 'sand';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    if (vd < 4) return 'ice';
    const pr = along(x, z);
    if (h.falls && pr.s > h.falls.s0 && pr.s < h.falls.s1 && pr.off > h.falls.off[0] && pr.off < h.falls.off[1]) return 'ice';
    for (const c of cliffs) if (seDist(c, x, z) < 1.02 && slopeAt(x, z) > 0.3) return c.surf || 'rock';
    const sl = slopeAt(x, z);
    if (sl > 0.42) return h.steep || 'rock';
    let fd = Infinity;
    for (const f of F) fd = Math.min(fd, distLine(f.pts, x, z) - f.w / 2);
    for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) - 1) * Math.min(e.rx, e.rz));
    if (fd < 0) return 'fairway';
    for (const f of forms) if (f.surf && seDist(f, x, z) < 0.75) return f.surf;
    for (const r of rubble) if (seDist(r, x, z) < 1) return 'rubble';
    if (h.rims && sl > 0.1 && Math.abs(pr.off) < 90 && pr.s > 80 && pr.s < h.len - 30) return 'travertine';
    if (go < 14) return 'rough';
    if (fd < (h.corridor ?? 18)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    return 'snow';
  }

  // the solid and built things, in the hole's frame (y up from the hole's base)
  const objs = [];
  const gAt = (x, z) => ground(x, z) ?? ground(x, z, true);
  for (const s of h.seracs || []) objs.push({ kind: 'serac', x: s.at[0], z: s.at[1], r: s.r, h: s.h, base: gAt(...s.at) - 1, seed: s.seed });
  for (const b of h.boulders || []) {
    if (surfaceOk(b.at)) objs.push({ kind: 'boulder', x: b.at[0], z: b.at[1], r: b.r, h: b.h, base: gAt(...b.at) - b.h * 0.25 });
  }
  function surfaceOk(p) { const s = surface(...p); return !['fairway', 'green', 'fringe', 'tee', 'water', 'ice', 'void', 'sand'].includes(s); }
  for (const t of h.trees || []) if (surfaceOk([t.x, t.z])) objs.push({ kind: 'tree', x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  if (h.cave) {   // the ice cave: walls either side of the back tees and the roof over them
    const C = h.cave;
    // the cliff and its cave mouth are ground (base above); the roof is a slab over the back tees
    objs.push({ kind: 'roof', pts: [at(h.line, C.s0, -C.w / 2 - 2), at(h.line, C.s1 - 8, -C.w / 2 - 2), at(h.line, C.s1 - 8, C.w / 2 + 2), at(h.line, C.s0, C.w / 2 + 2)], y: C.roof, t: C.h - C.roof, label: C.label });
  }
  if (h.arch) { const A = h.arch; objs.push({ kind: 'arch', a: [A.a[0], A.a[1], gAt(A.a[0], A.a[1]) ?? 0], b: [A.b[0], A.b[1], gAt(A.b[0], A.b[1]) ?? 0], h: A.h, w: A.w, t: A.t, label: A.label }); }
  if (h.hall) objs.push({ kind: 'hall', pts: hallPts, base: Math.min(...hallPts.map(p => gAt(...p))) - 0.5, h: h.hall.h, roof: h.hall.roof, at: h.hall.at, rot: endHead, label: h.hall.label });
  if (h.longship) objs.push({ kind: 'longship', ...h.longship, x: h.longship.at[0], z: h.longship.at[1], y: lake.y - 0.6 });
  if (h.mammoth) { const M = h.mammoth, pr = project(h.line, ...M.at); objs.push({ kind: 'mammoth', x: M.at[0], z: M.at[1], base: gAt(...M.at), dir: headingAt(h.line, pr.s), label: M.label }); }
  if (h.moulin) objs.push({ kind: 'moulin', x: h.moulin.at[0], z: h.moulin.at[1], r: h.moulin.r });
  // braziers down both sides of the play, lit at night; steam off the green and the warm pools
  {
    const R = rnd(900 + h.n), fw = (h.fairway || []);
    for (let s = 60; s < h.len - 25; s += 62) {
      const f = fw.find(([a, b]) => s >= a && s <= b), half = f ? f[2] / 2 + (f[3] || 0) * 0 : 24;
      for (const side of [-1, 1]) {
        const p = at(h.line, s + (R() - 0.5) * 10, side * (half + 9 + R() * 4) + (f ? f[3] || 0 : 0)), sf = surface(...p);
        if (['rough', 'snow', 'travertine'].includes(sf) && ground(...p) !== null && teePads.every(t => Math.hypot(p[0] - t.x, p[1] - t.z) > 25)) objs.push({ kind: 'brazier', x: p[0], z: p[1], base: gAt(...p) });
      }
    }
    for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + R(), d = 1.05 + 0.15 * R(); const p = [h.pin[0] + Math.cos(a) * G.rx * d, h.pin[1] + Math.sin(a) * G.rz * d]; objs.push({ kind: 'steam', x: p[0], z: p[1], base: gAt(...p), r: 3 + R() * 2 }); }
    for (const w of waters) for (let k = 0; k < 2; k++) { const p = [w.x + (R() - 0.5) * w.rx, w.z + (R() - 0.5) * w.rz]; objs.push({ kind: 'steam', x: p[0], z: p[1], base: w.y, r: 4 + R() * 3 }); }
  }

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'serac' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base, o.base + o.h, 'a serac']);
      if (o.kind === 'boulder' && Math.hypot(x - o.x, z - o.z) < o.r * 0.8) out.push([o.base, o.base + o.h, 'a boulder']);
      if (o.kind === 'tree' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base + 1, o.base + o.h, 'a spruce']);
      if ((o.kind === 'icebox' || o.kind === 'hall') && inPoly(o.pts, x, z)) out.push([o.base, o.base + o.h + (o.roof || 0), o.kind === 'hall' ? 'the hall' : 'the cave wall']);
      if (o.kind === 'roof' && inPoly(o.pts, x, z)) out.push([o.y, o.y + o.t, 'the cave roof']);
      if (o.kind === 'arch') {
        const [ax, az, ay] = o.a, [bx, bz, by] = o.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = ((x - ax) * dx + (z - az) * dz) / l2, d = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(l2);
        if (t >= 0 && t <= 1 && d < o.w / 2) { const y = ay + (by - ay) * t + o.h * Math.sin(Math.PI * t); out.push([y - o.t / 2, y + o.t / 2, 'the ice bridge']); }
      }
    }
    return out;
  }
  return { h, ground, surface, objs, solids, greenD, voidD, waters, teePads, lakeY: lake && lake.y };
}

// local -> world (x east, -z north, y absolute)
export function toWorld(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (x, z) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz];
}
export function toLocal(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (X, Z) => { const dx = X - h.place.at[0], dz = Z - h.place.at[1]; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
}
export const BUILT = HOLES.map(buildHole);
const WL = HOLES.map(h => h.line.map(p => toWorld(h)(...p))), LOC = HOLES.map(toLocal);

// the glacier between the holes (world): each hole's own ground near its line, blended into its
// neighbours' further out, so the sketches and the course map show one surface. Absolute heights.
export function worldAt(X, Z) {
  let ws = 0, ys = 0, best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const own = BUILT[best], [lx, lz] = LOC[best](X, Z), g = own.ground(lx, lz);
  if (g === null && bd < 150) return { y: null, raw: own.ground(lx, lz, true) + HOLES[best].base, s: 'void', k: best };
  const s = bd < 150 ? own.surface(lx, lz) : 'snow';
  for (let k = 0; k < HOLES.length; k++) {
    if (near[k] > bd + 160) continue;
    const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4) ;
    const [x, z] = LOC[k](X, Z), y = BUILT[k].ground(x, z, true) + HOLES[k].base;
    ws += w; ys += w * y;
  }
  // within 45 m of a hole's line it is that hole's ground exactly
  const blend = ys / ws, own0 = BUILT[best].ground(lx, lz, true) + HOLES[best].base;
  return { y: lerp(own0, blend, smooth((bd - 45) / 70)), s, k: best };
}
export { WL, LOC };
