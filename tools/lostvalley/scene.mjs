// The Lost Valley: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's
// own frame, plus the world transform and the valley between the holes. A hole's ground is its own line's profile
// near the line (the valley floor under it, eased down its `ramps`, with its cant), blending into the valley
// (world.mjs V) further out, with the hole's shapes on top: forms (shared through world space, so every hole
// sees them), its green complex, bunkers and tee pads. Water and tar are level and play as water; the river's
// gravel bars play as bunkers. Shared by the plans, profiles and sketches. Pure.
import { project, seDist, seOutline, rectPts, inPoly, smooth, clamp, at, rnd, distLine, headingAt, lerp, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, noise1, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, waterAt, nativeAt, wallD, riverAt, swampD, swampWet, SWAMP, LEDGE, CAMP_FALLS } from './world.mjs';

export const SURF = ['meadow', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'bar', 'water', 'tar', 'cliff', 'jungle', 'mud', 'gravel', 'rubble', 'camp', 'void'];
const bump = e => e >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * e);
const span = (s, a, b, r = 30) => smooth((s - a) / r) * (1 - smooth((s - b) / r));

// local -> world (x east, -z north)
export function toWorld(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (x, z) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz];
}
export function toLocal(h) {
  const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return (X, Z) => { const dx = X - h.place.at[0], dz = Z - h.place.at[1]; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
}
const LOC = HOLES.map(toLocal), WOR = HOLES.map(toWorld), WL = HOLES.map((h, k) => h.line.map(p => WOR[k](...p)));

// the line's profile: the valley sampled under the line, eased down each ramp, lightly smoothed (water under the
// line is bridged at the bank's height, so a fairway never dips into a channel)
const PROF = HOLES.map((h, k) => {
  const st = 2, n = Math.ceil(h.len / st) + 1, y = [];
  for (let i = 0; i < n; i++) y.push(V(...WOR[k](...at(h.line, Math.min(i * st, h.len)))));
  for (const [a, b] of h.ramps || []) { const ia = Math.round(a / st), ib = Math.min(n - 1, Math.round(b / st)), ya = y[ia], yb = y[ib]; for (let i = ia; i <= ib; i++) y[i] = lerp(ya, yb, smooth((i - ia) / (ib - ia))); }
  const sm = y.map((_, i) => { let s = 0, c = 0; for (let j = -3; j <= 3; j++) { const q = y[clamp(i + j, 0, n - 1)]; s += q; c++; } return s / c; });
  return { st, y: sm, at: s => { const f = clamp(s / st, 0, n - 1), i = Math.floor(f), t = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], t); } };
});
HOLES.forEach((h, k) => { h.base = PROF[k].at(0); });

// forms (mounds, ridges, slots) shared through world space, each asked about a world point in its own hole's frame
const FORMS = [];
for (const [k, h] of HOLES.entries()) for (const f of h.forms || []) FORMS.push({ k, ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0, reach: Math.max(f.rx, f.rz) + 10 });
for (const f of FORMS) f.c = WOR[f.k](f.x, f.z);
const formLift = (f, x, z) => f.h * bump(seDist(f, x, z) + 0.06 * noise2(x / 14, z / 14, 3));
function shapesAt(X, Z) {
  let y = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; y += formLift(f, ...LOC[f.k](X, Z)); }
  return y;
}

// a green's contour, in its own frame (u right, v toward the back, metres from the pin). Directions are
// degrees clockwise from the front: 0 = toward the tee, 90 = right, 180 = the back. (As tools/emberfell.)
//   { fall: deg, pct }               the whole green falls toward deg
//   { tier: [u, v], up: deg, h, w }  a step h metres up across the line through [u, v], rising toward up, over w
//   { ridge: [[u, v], [u, v]], h, w } a spine along the segment (h < 0: a swale), w its half-width
//   { bowl: [u, v], r, h }           a dip h deep, r across (h < 0: a knob)
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
export function buildHole(h) {
  const k = h.n - 1, W = WOR[k], PR = PROF[k];
  const endHead = headingAt(h.line, h.len - 1);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // pale river sand in every bunker; out in the fairways they are bigger
  const bunkers = (h.bunkers || []).map((b, i) => {
    if (b.strip) { const fd = makeFairway(h.line, [{ e: b.strip, wob: b.wob ?? 3, seed: 90 + i }]), sx = b.strip.map(([s, L, R]) => at(h.line, s, (R - L) / 2));
      return { strip: true, kind: 'sand', depth: 0.9, edgeM: fd, job: b.job, x: sx[0][0], z: sx[0][1], box: [Math.min(...sx.map(p => p[0])) - 70, Math.min(...sx.map(p => p[1])) - 70, Math.max(...sx.map(p => p[0])) + 70, Math.max(...sx.map(p => p[1])) + 70] }; }
    const side = Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45;
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, kind: 'sand', side, job: b.job, pot: !!b.pot, depth: b.pot ? 1.2 : side ? 0.8 : 0.9 }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed);
  for (const b of bunkers) {   // a greenside bunker sits at least 2.5 m outside the green's edge
    if (!b.side || b.strip) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    b.was = [b.x, b.z];
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
    b.edge = clear(); b.moved = Math.hypot(b.x - b.was[0], b.z - b.was[1]);
  }
  const edgeM = (b, x, z) => b.strip ? b.edgeM(x, z) : (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) if (!b.box) b.box = [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const extra = (h.extraFw || []).map((e, i) => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0, seed: 60 + i }));
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const onPad = (t, x, z) => { const [u, v] = [(x - t.x) * tc + (z - t.z) * ts, (x - t.x) * ts - (z - t.z) * tc]; return Math.abs(u) < 6 && Math.abs(v) < 5; };

  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
  const along = (x, z) => {
    const pr = project(h.line, x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  // the ground without the shared shapes (absolute): the line's profile near the line, the valley away from it.
  // Off the line, water, the bluff and the walls keep the valley's own shape (the line's profile only reaches
  // where the valley is within a few metres of it)
  function baseAbs(x, z) {
    const pr = along(x, z), kk = smooth((Math.abs(pr.off) - (h.flat ?? 30)) / (h.fade ?? 36));
    const line = PR.at(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90);
    if (kk >= 1) return V(...W(x, z));
    const v = V(...W(x, z)), gap = Math.abs(v - line), keep = smooth((gap - 4) / 6) * smooth((Math.abs(pr.off) - 14) / 10);
    return lerp(lerp(line, v, kk), v, keep);
  }
  // everything but water and tee pads, relative to the hole's base
  function base(x, z) {
    let y = baseAbs(x, z) - h.base + shapesAt(...W(x, z));
    const go = gm(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - (Gd.falseFront ? 0.5 : 2)) / (Gd.falseFront ? 5 : 8)));
    if (go < 7) {   // tiers, tilts, faded out past the collar; the green itself levelled
      const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z), pr = along(x, z);
      let g = 0;
      if (Gd.tier) g += Gd.tier.h * smooth((pr.s - Gd.tier.s) / 5);
      if (Gd.tilt) g += (Gd.tilt.side ? Gd.tilt.side * u : 0) * Gd.tilt.pct / 100 * -1 + (Gd.tilt.front ? v * Gd.tilt.pct / 100 : 0);
      if (Gd.contour) g += contourAt(Gd.contour, u, v);
      y += g * fade;
    }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + (b.pot ? 0.8 : 2)) / (b.pot ? 0.9 : 2.3))) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green's own surface is levelled to the pin's height before tilts (the collar blends it back over 9 m)
  const pinBase = (() => { const pr = along(...h.pin); return PR.at(pr.s) - h.base + shapesAt(...W(...h.pin)); })();
  const level = (x, z, y) => { const go = gm(x, z); if (go > 9) return y; const raw = baseAbs(x, z) - h.base + shapesAt(...W(x, z)); return y + (pinBase - raw) * (1 - smooth((go + 1) / 10)); };
  for (const t of teePads) t.y = level(t.x, t.z, base(t.x, t.z)) + 0.4;

  function ground(x, z) {
    const [X, Z] = W(x, z), wa = waterAt(X, Z);
    if (wa && gm(x, z) > 2) return wa.level - h.base;
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = level(x, z, base(x, z));
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, smooth((d - 6) / 6)); }
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z), b = ground(x - d, z), c = ground(x, z + d), e = ground(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };
  const fairwayD = (x, z) => { let fd = fwD(x, z); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) + 0.12 * noise2(x / 9, z / 9, e.seed) - 1) * Math.min(e.rx, e.rz)); return fd; };

  function surface(x, z) {
    const [X, Z] = W(x, z);
    const go = gm(x, z);
    if (go < 0) return 'green';
    const wa = waterAt(X, Z);
    if (wa) return wa.body === 'tar' ? 'tar' : 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return b.kind;
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    const sl = slopeAt(x, z), fd = fairwayD(x, z);
    if (fd < 0 && sl < 0.35) return 'fairway';
    if (sl > 0.9) return 'cliff';
    const nat = nativeAt(X, Z);
    // the river's gravel bars: bunkers near the play, gravel beyond
    if (nat === 'gravel') return distLine(h.line, x, z) < 150 ? 'bar' : 'gravel';
    if (nat === 'jungle' || nat === 'cliff') return sl > 0.55 ? 'cliff' : 'jungle';
    if (sl > 0.5) return 'rubble';
    if (go < 14) return 'rough';
    if (nat === 'mud') return 'mud';
    if (fd < (h.corridor ?? 18)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    return nat;
  }

  // the solid and built things, in the hole's frame (y up from the hole's base)
  const objs = [];
  const gAt = (x, z) => ground(x, z);
  const notInPlay = ['fairway', 'green', 'fringe', 'tee', 'sand', 'bar', 'water', 'tar'];
  const surfaceOk = p => !notInPlay.includes(surface(...p));
  for (const b of h.boulders || []) if (surfaceOk(b.at)) objs.push({ kind: 'boulder', x: b.at[0], z: b.at[1], r: b.r, h: b.h, base: gAt(...b.at) - b.h * 0.25 });
  for (const t of h.trees || []) if (surfaceOk([t.x, t.z]) && distLine(h.line, t.x, t.z) > t.r + 9) objs.push({ kind: t.kind, x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  if (h.swampTrees) {   // cypresses through the swamp: in the water and on the hummocks, clear of the fairway
    const R = rnd(h.swampTrees.seed);
    for (let i = 0; i < h.swampTrees.n * 4 && objs.filter(o => o.kind === 'cypress').length < h.swampTrees.n; i++) {
      const X = 240 + R() * 240, Z = -730 + R() * 350; if (swampD(X, Z) > -4) continue;
      const [x, z] = LOC[k](X, Z); if (fairwayD(x, z) < 8 || distLine(h.line, x, z) < 22) continue;
      if (objs.some(o => o.kind === 'cypress' && Math.hypot(o.x - x, o.z - z) < 7)) continue;
      const wet = swampWet(X, Z);
      objs.push({ kind: 'cypress', x, z, r: 3.6 + R() * 2.6, h: 18 + R() * 12, base: wet ? SWAMP.level - h.base : gAt(x, z), wet });
    }
  }
  if (h.spire) { const [x, z] = h.spire.at; objs.push({ kind: 'spire', x, z, r: 4.5, base: V(...W(x, z)) - h.base - 2, top: h.spire.h + 2, label: h.spire.label }); }
  if (h.strangler) {
    const S = h.strangler, [tx, tz] = S.trunk, [fx, fz] = S.arch.foot, by = gAt(tx, tz), fy = gAt(fx, fz);
    objs.push({ kind: 'strangler', x: tx, z: tz, r: S.r, h: S.h, canopy: S.canopy, base: by - 0.5, label: S.label });
    objs.push({ kind: 'arch', a: [tx, tz, by], b: [fx, fz, fy], crown: S.arch.crown, t: S.arch.t, w: 4.5 });
  }
  // the 9th's camp is drawn from world.mjs (CAMP); the 7th's skeleton and the 3rd's bones likewise

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  const archAt = (o, x, z) => {   // the root arch as a curve from the trunk to the foot, w wide; [bottom, top] or null
    const dx = o.b[0] - o.a[0], dz = o.b[1] - o.a[1], l = Math.hypot(dx, dz), t = ((x - o.a[0]) * dx + (z - o.a[1]) * dz) / (l * l);
    if (t < 0 || t > 1) return null;
    const off = Math.abs((x - o.a[0]) * dz - (z - o.a[1]) * dx) / l; if (off > o.w / 2) return null;
    const yb = lerp(o.a[2], o.b[2], t), lift = o.crown * Math.sin(Math.PI * Math.pow(t, 0.8)) ** 0.85;
    return [yb + lift - (t < 0.12 || t > 0.9 ? 6 : 0), yb + lift + o.t];
  };
  const TREE_LOW = { cycad: 0.5, fern: 0.45, conifer: 0.35, broad: 0.3, cypress: 0.35 };
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'boulder' && Math.hypot(x - o.x, z - o.z) < o.r * 0.8) out.push([o.base, o.base + o.h, 'a boulder']);
      else if (TREE_LOW[o.kind] !== undefined && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base + o.h * TREE_LOW[o.kind], o.base + o.h, 'a tree']);
      else if (o.kind === 'spire' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base, o.base + o.top, 'the spire']);
      else if (o.kind === 'strangler') { const d = Math.hypot(x - o.x, z - o.z); if (d < o.r) out.push([o.base, o.base + o.h, 'the fig\'s trunk']); else if (d < o.canopy) out.push([o.base + 30, o.base + o.h, 'the fig\'s canopy']); }
      else if (o.kind === 'arch') { const a = archAt(o, x, z); if (a) out.push([a[0], a[1], 'the root arch']); }
    }
    return out;
  }
  return { h, ground, surface, objs, solids, gm, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, archAt };
}

export const BUILT = HOLES.map(buildHole);

// the valley between the holes (world, absolute heights): each hole's own ground near its line, blended into its
// neighbours' further out and into the valley beyond
export function worldAt(X, Z) {
  let ws = 0, ys = 0, best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const wa = waterAt(X, Z);
  const [lx, lz] = LOC[best](X, Z), own = BUILT[best];
  if (wa && !(bd < 60 && own.gm(lx, lz) < 2)) return { y: wa.level, s: wa.body === 'tar' ? 'tar' : 'water', k: best };
  let y;
  if (bd > 260) y = V(X, Z) + shapesAt(X, Z);
  else {
    for (let k = 0; k < HOLES.length; k++) {
      if (near[k] > bd + 160) continue;
      const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4);
      ws += w; ys += w * BUILT[k].baseAbs(...LOC[k](X, Z));
    }
    // each nearby hole's own ground, weighted by how near its line is, so two holes' grounds meet without a seam
    let fw = 0, fy = 0;
    for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 60) continue; const wk = Math.pow(1 - smooth((near[k] - bd) / 60), 2) / Math.pow(near[k] + 4, 2); fw += wk; fy += wk * (BUILT[k].ground(...LOC[k](X, Z)) + BUILT[k].base); }
    const blend = ys / ws + shapesAt(X, Z), full = fy / fw;
    y = lerp(full, blend, smooth((bd - 45) / 70));
    if (bd > 150) y = lerp(y, V(X, Z) + shapesAt(X, Z), smooth((bd - 150) / 110));
  }
  const s = bd < 150 ? own.surface(lx, lz) : (() => {
    const d = 1.5, sl = Math.hypot(V(X + d, Z) - V(X - d, Z), V(X, Z + d) - V(X, Z - d)) / (2 * d);
    const nat = nativeAt(X, Z);
    if (sl > 0.9) return 'cliff';
    if (nat === 'jungle' || nat === 'cliff') return sl > 0.55 ? 'cliff' : 'jungle';
    return nat;
  })();
  return { y, s, k: best };
}
export { WL, LOC, WOR, PROF };
