// Rimeholm: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and the glacier between the holes (world.mjs scenery layered on). Shared by
// the plans, the profiles and the sketch views, so they all show the same ground. Pure.
import { project, seDist, rectPts, inPoly, profileFn, smooth, clamp, at, rnd, distLine, headingAt, lerp } from './geo.mjs';
import { makeGreen, makeFairway, makeCrack, makeShaft, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { WORLD, layerLift, onPeak } from './world.mjs';

export const SURF = ['snow', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'ice', 'rock', 'rubble', 'travertine', 'hall', 'void'];
const bump = e => e >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * e);
const span = (s, a, b, r = 30) => smooth((s - a) / r) * (1 - smooth((s - b) / r));

// local -> world (x east, -z north, y absolute)
export function toWorld(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (x, z) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz];
}
export function toLocal(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (X, Z) => { const dx = X - h.place.at[0], dz = Z - h.place.at[1]; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
}
const WL = HOLES.map(h => h.line.map(p => toWorld(h)(...p))), LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld);

// every crack and shaft on the glacier, each with a way to ask it about a world point:
// the holes' own (built in their frames) and the scenery's (built in world space)
const OWN = HOLES.map((h, k) => ({
  cracks: (h.cracks || []).map(makeCrack),
  shaft: h.moulin ? makeShaft(h.moulin.at, h.moulin.r, 5 + k) : null,
}));
const ALL = [];
for (const [k, o] of OWN.entries()) for (const c of [...o.cracks, ...(o.shaft ? [o.shaft] : [])]) ALL.push({ obj: c, owner: k, from: LOC[k] });
for (const c of WORLD.cracks) ALL.push({ obj: c, owner: -1, from: (X, Z) => [X, Z] });
for (const a of ALL) {   // a world-space centre and reach, to cull
  const pts = a.obj.spec ? a.obj.spec.pts : [a.obj === OWN[a.owner]?.shaft ? HOLES[a.owner].moulin.at : [0, 0]];
  const W = a.owner >= 0 ? WOR[a.owner] : (x, z) => [x, z], P = pts.map(p => W(...p));
  a.c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  a.reach = Math.max(...P.map(p => Math.hypot(p[0] - a.c[0], p[1] - a.c[1]))) + (a.obj.lip ? a.obj.lip.run + a.obj.lip.fall + a.obj.lip.end : 0) + 60 + (a.obj.spec ? 0 : HOLES[a.owner].moulin.r);
}
export const CRACKS = ALL;
const worldVoid = (X, Z) => { let d = Infinity; for (const a of ALL) { if (Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; d = Math.min(d, a.obj.voidD(...a.from(X, Z))); } return d; };
const worldLift = (X, Z) => { let y = 0; for (const a of ALL) { if (!a.obj.lift || Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; y += a.obj.lift(...a.from(X, Z)); } return y; };

export function buildHole(h) {
  const k = h.n - 1, prof = profileFn(h.prof), W = WOR[k];
  const endHead = headingAt(h.line, h.len - 1), ec = Math.cos(endHead), es = Math.sin(endHead);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  const bunkers = (h.bunkers || []).map((b, i) => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9 }));
  const inBunker = b => (x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed) < 1;
  const extra = (h.extraFw || []).map((e, i) => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0, seed: 60 + i }));
  const rubble = (h.rubble || []).map(r => ({ x: r.at[0], z: r.at[1], rx: r.rx, rz: r.rz, rot: r.rot || 0 }));
  const forms = (h.forms || []).map(f => ({ ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0 }));
  const cliffs = (h.cliffs || []).map(c => ({ ...c, x: c.at[0], z: c.at[1], rot: c.rot || 0 }));
  const lake = h.lake && { ...h.lake, x: h.lake.at[0], z: h.lake.at[1], rot: h.lake.rot || 0 };
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  // the cracks that touch this hole: its own, in its frame, and everyone else's through world space
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const box = [Math.min(...xs) - 320, Math.min(...zs) - 320, Math.max(...xs) + 320, Math.max(...zs) + 320];
  const here = [];
  for (const a of ALL) {
    if (a.owner === k) { here.push({ obj: a.obj, f: (x, z) => [x, z] }); continue; }
    const [cx, cz] = LOC[k](...a.c);
    if (cx < box[0] - a.reach || cx > box[2] + a.reach || cz < box[1] - a.reach || cz > box[3] + a.reach) continue;
    here.push({ obj: a.obj, f: (x, z) => a.from(...W(x, z)) });
  }
  const voidD = (x, z) => { let d = Infinity; for (const c of here) d = Math.min(d, c.obj.voidD(...c.f(x, z))); return d; };
  const crackLift = (x, z) => { let y = 0; for (const c of here) if (c.obj.lift) y += c.obj.lift(...c.f(x, z)); return y; };
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
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
  // everything but water and tee pads; `bare` leaves out what's layered from the glacier (crack lips, peaks,
  // ridges) so the world blend can add it once
  function base(x, z, bare = false) {
    const pr = along(x, z);
    let y = prof(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90);
    if (h.esker) { const E = h.esker; y -= E.h * smooth((Math.abs(pr.off) - E.w / 2) / E.fall) * span(pr.s, E.s0, E.s1); }
    for (const w of h.walls || []) y += w.h * smooth((w.side * pr.off - w.off) / w.bank) * span(pr.s, w.s0, w.s1);
    if (h.cave) { const C = h.cave; if (pr.s < C.s1 + 6) y += C.h * smooth((Math.abs(pr.off) - C.w / 2) / 3) * (1 - smooth((pr.s - C.s1) / 4)); }
    for (const f of forms) y += f.h * bump(seDist(f, x, z));
    for (const c of cliffs) { const e = seDist(c, x, z); y += c.h * smooth((1 - e) * Math.min(c.rx, c.rz) / 5); }
    // the green's surrounds: a raised green (false front) or a true punchbowl (level ground, then a hollow)
    const go = gm(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - (Gd.falseFront ? 0.5 : 2)) / (Gd.falseFront ? 5 : 8)));
    if (Gd.punch) { const P = Gd.punch; y -= P.depth * (1 - smooth((go - P.floor) / P.bank)); }
    if (go < 7) {   // tiers, tilts, the redan and a crown, faded out past the collar
      const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z);
      let g = 0;
      if (Gd.tier) g += Gd.tier.h * smooth((pr.s - Gd.tier.s) / 5);
      if (Gd.tilt) g += (Gd.tilt.side ? Gd.tilt.side * u : 0) * Gd.tilt.pct / 100 * -1 + (Gd.tilt.front ? v * Gd.tilt.pct / 100 : 0);
      if (Gd.redan) g += (-u + v) / Math.SQRT2 * -Gd.redan / 100;
      if (Gd.crown) g += Gd.crown * (1 - clamp(1 + go / 9, 0, 1) ** 2);
      y += g * fade;
    }
    const [X, Z] = W(x, z);
    let m = smooth((go - 4) / 8);
    for (const t of teePads) m *= smooth((Math.hypot(x - t.x, z - t.z) - 7) / 8);
    y += m * waves(X, Z);
    if (!bare) y += crackLift(x, z) + layerLift(X, Z) * m;
    return y;
  }
  for (const t of teePads) t.y = base(t.x, t.z) + 0.4;
  const waters = (h.water || []).map(w => { const o = { x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0, spring: w.spring }; o.y = base(o.x, o.z) - 0.6; return o; });

  function ground(x, z, raw = false, bare = false) {
    if (!raw && voidD(x, z) < 0) return null;
    for (const t of teePads) if (onPad(t, x, z)) return bare ? t.y - crackLift(x, z) : t.y;
    let y = base(x, z, bare);
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y - (bare ? crackLift(x, z) : 0), y, smooth((d - 6) / 6)); }
    const drop = bare ? crackLift(x, z) : 0;
    if (lake) { const e = seDist(lake, x, z); if (e < 1) return (h.lead && distLine(h.lead.pts, x, z) < h.lead.w / 2 ? lake.y - 0.35 : lake.y) - drop; if (e < 1.14) y = lerp(lake.y + 0.1 - drop, y, smooth((e - 1) / 0.14)); }
    for (const w of waters) { const e = seDist(w, x, z); if (e < 1) return w.y - drop; if (e < 1.3) y = lerp(w.y + 0.25 - drop, y, smooth((e - 1) / 0.3)); }
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z, true), b = ground(x - d, z, true), c = ground(x, z + d, true), e = ground(x, z - d, true); return Math.hypot(a - b, c - e) / (2 * d); };
  const fairwayD = (x, z) => { let fd = fwD(x, z); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) + 0.12 * noise2(x / 9, z / 9, e.seed) - 1) * Math.min(e.rx, e.rz)); return fd; };

  function surface(x, z) {
    const vd = voidD(x, z);
    if (vd < 0) return 'void';
    if (lake && seDist(lake, x, z) < 1) return h.lead && distLine(h.lead.pts, x, z) < h.lead.w / 2 ? 'water' : 'ice';
    for (const w of waters) if (seDist(w, x, z) < 1) return 'water';
    if (hallPts && inPoly(hallPts, x, z)) return 'hall';
    const go = gm(x, z);
    if (go < 0) return 'green';
    if (go < (h.green.apron || 3) || (h.green.punch && go < h.green.punch.floor + h.green.punch.bank)) return 'fringe';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    if (vd < 3.5) return 'ice';
    const pr = along(x, z);
    if (h.falls && pr.s > h.falls.s0 && pr.s < h.falls.s1 && pr.off > h.falls.off[0] && pr.off < h.falls.off[1]) return 'ice';
    for (const c of cliffs) if (seDist(c, x, z) < 1.02 && slopeAt(x, z) > 0.3) return c.surf || 'rock';
    const sl = slopeAt(x, z);
    if (sl > 0.42) { const [X, Z] = W(x, z); return crackLift(x, z) > 0.2 ? 'ice' : onPeak(X, Z) ? 'rock' : (h.steep || 'rock'); }
    const fd = fairwayD(x, z);
    if (fd < 0 && vd > 6) return 'fairway';
    for (const f of forms) if (f.surf && seDist(f, x, z) < 0.75) return f.surf;
    for (const r of rubble) if (seDist(r, x, z) < 1) return 'rubble';
    if (h.rims && sl > 0.1 && Math.abs(pr.off) < 90 && pr.s > 80 && pr.s < h.len - 30) return 'travertine';
    if (go < 14) return 'rough';
    if (fd < (h.corridor ?? 18) && vd > 4) return 'rough';
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
  if (h.cave) {   // the cliff and its cave mouth are ground (base above); the roof is a slab over the back tees
    const C = h.cave;
    objs.push({ kind: 'roof', pts: [at(h.line, C.s0, -C.w / 2 - 2), at(h.line, C.s1 - 8, -C.w / 2 - 2), at(h.line, C.s1 - 8, C.w / 2 + 2), at(h.line, C.s0, C.w / 2 + 2)], y: C.roof, t: C.h - C.roof, label: C.label });
  }
  if (h.arch) { const A = h.arch; objs.push({ kind: 'arch', a: [A.a[0], A.a[1], gAt(A.a[0], A.a[1]) ?? 0], b: [A.b[0], A.b[1], gAt(A.b[0], A.b[1]) ?? 0], h: A.h, w: A.w, t: A.t, label: A.label }); }
  if (h.hall) objs.push({ kind: 'hall', pts: hallPts, base: Math.min(...hallPts.map(p => gAt(...p))) - 0.5, h: h.hall.h, roof: h.hall.roof, at: h.hall.at, rot: endHead, label: h.hall.label });
  if (h.longship) objs.push({ kind: 'longship', ...h.longship, x: h.longship.at[0], z: h.longship.at[1], y: lake.y - 0.6 });
  if (h.mammoth) { const M = h.mammoth, pr = project(h.line, ...M.at); objs.push({ kind: 'mammoth', x: M.at[0], z: M.at[1], base: gAt(...M.at), dir: headingAt(h.line, pr.s), label: M.label }); }
  if (h.moulin) objs.push({ kind: 'moulin', x: h.moulin.at[0], z: h.moulin.at[1], r: h.moulin.r });
  // braziers down both sides of the play, lit at night; steam off the green and the warm pools
  {
    const R = rnd(900 + h.n);
    for (let s = 60; s < h.len - 25; s += 62) {
      for (const side of [-1, 1]) {
        let off = 0; const ss = s + (R() - 0.5) * 10;
        while (Math.abs(off) < 80 && fairwayD(...at(h.line, ss, off)) < 9 + R() * 4) off += side * 2;
        const p = at(h.line, ss, off < 2 && off > -2 ? side * 24 : off), sf = surface(...p);
        if (['rough', 'snow', 'travertine'].includes(sf) && voidD(...p) > 8 && teePads.every(t => Math.hypot(p[0] - t.x, p[1] - t.z) > 25)) objs.push({ kind: 'brazier', x: p[0], z: p[1], base: gAt(...p) });
      }
    }
    for (let i = 0; i < 6; i++) {   // round the green's edge
      const a = i / 6 * 6.283 + R(); let r = 2; while (r < 45 && gm(h.pin[0] + Math.cos(a) * r, h.pin[1] + Math.sin(a) * r) < 1) r += 0.5;
      const p = [h.pin[0] + Math.cos(a) * r, h.pin[1] + Math.sin(a) * r]; objs.push({ kind: 'steam', x: p[0], z: p[1], base: gAt(...p), r: 3 + R() * 2 });
    }
    for (const w of waters) for (let i = 0; i < 2; i++) { const p = [w.x + (R() - 0.5) * w.rx, w.z + (R() - 0.5) * w.rz]; objs.push({ kind: 'steam', x: p[0], z: p[1], base: w.y, r: 4 + R() * 3 }); }
  }

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'serac' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base, o.base + o.h, 'a serac']);
      if (o.kind === 'boulder' && Math.hypot(x - o.x, z - o.z) < o.r * 0.8) out.push([o.base, o.base + o.h, 'a boulder']);
      if (o.kind === 'tree' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base + 1, o.base + o.h, 'a spruce']);
      if (o.kind === 'hall' && inPoly(o.pts, x, z)) out.push([o.base, o.base + o.h + (o.roof || 0), 'the hall']);
      if (o.kind === 'roof' && inPoly(o.pts, x, z)) out.push([o.y, o.y + o.t, 'the cave roof']);
      if (o.kind === 'arch') {
        const [ax, az, ay] = o.a, [bx, bz, by] = o.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = ((x - ax) * dx + (z - az) * dz) / l2, d = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(l2);
        if (t >= 0 && t <= 1 && d < o.w / 2) { const y = ay + (by - ay) * t + o.h * Math.sin(Math.PI * t); out.push([y - o.t / 2, y + o.t / 2, 'the ice bridge']); }
      }
    }
    return out;
  }
  return { h, ground, surface, objs, solids, gm, voidD, fairwayD, inBunker, bunkers, waters, teePads, lakeY: lake && lake.y, own: OWN[k] };
}

export const BUILT = HOLES.map(buildHole);

// the glacier between the holes (world): each hole's own ground near its line, blended into its
// neighbours' further out, plus the crack lips, ridges and peaks once. Absolute heights.
export function worldAt(X, Z) {
  let ws = 0, ys = 0, best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const [lx, lz] = LOC[best](X, Z);
  for (let k = 0; k < HOLES.length; k++) {
    if (near[k] > bd + 160) continue;
    const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4);
    const [x, z] = LOC[k](X, Z), y = BUILT[k].ground(x, z, true, true) + HOLES[k].base;
    ws += w; ys += w * y;
  }
  // within 45 m of a hole's line it is that hole's ground exactly
  const blend = ys / ws, own0 = BUILT[best].ground(lx, lz, true, true) + HOLES[best].base;
  // the layered ground (peaks, ridges) stays off greens, tees and water, as in each hole's own ground
  const own = BUILT[best], gmo = bd < 150 ? own.gm(lx, lz) : 99;
  const y = lerp(own0, blend, smooth((bd - 45) / 70)) + worldLift(X, Z) + layerLift(X, Z) * smooth((gmo - 4) / 8);
  if (worldVoid(X, Z) < 0) return { y: null, raw: y, s: 'void', k: best };
  let s;
  if (bd < 150) s = own.surface(lx, lz);
  else {
    const vd = worldVoid(X, Z);
    if (vd < 3.5) s = 'ice';
    else { const d = 1.5, sl = Math.hypot(worldY(X + d, Z) - worldY(X - d, Z), worldY(X, Z + d) - worldY(X, Z - d)) / (2 * d); s = sl > 0.42 ? (onPeak(X, Z) ? 'rock' : 'ice') : 'snow'; }
  }
  return { y, s, k: best };
}
// just the height (no surface), for slopes off the holes
function worldY(X, Z) {
  let ws = 0, ys = 0, bd = Infinity; const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); bd = Math.min(bd, d); }
  for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 160) continue; const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4); const [x, z] = LOC[k](X, Z); ws += w; ys += w * (BUILT[k].ground(x, z, true, true) + HOLES[k].base); }
  return ys / ws + worldLift(X, Z) + layerLift(X, Z);
}
export { WL, LOC, WOR };
