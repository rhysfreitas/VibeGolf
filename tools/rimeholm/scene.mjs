// Rimeholm: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and the glacier between the holes (world.mjs scenery layered on). Shared by
// the plans, the profiles and the sketch views, so they all show the same ground. Pure.
import { project, seDist, seOutline, rectPts, inPoly, profileFn, smooth, clamp, at, rnd, distLine, headingAt, lerp } from './geo.mjs';
import { makeGreen, makeFairway, makeCrack, makeShaft, noise1, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { WORLD, layerLift, onPeak } from './world.mjs';

export const SURF = ['snow', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'ice', 'rock', 'rubble', 'travertine', 'hall', 'void', 'powder'];
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
// a hole's own scarps (no open crack) are its elevation: their lift belongs to that hole's ground in the blend
// below, not to the whole glacier, or a shelf runs on under the next hole's tee (6's did, 14 m high behind
// its green)
for (const a of ALL) a.local = a.owner >= 0 && a.obj.spec && !a.obj.open && !!a.obj.lift;
const localLift = (k, X, Z) => { let y = 0; for (const a of ALL) if (a.local && a.owner === k) { const [x, z] = a.from(X, Z); y += a.obj.lift(x, z); } return y; };
export const CRACKS = ALL;
const worldVoid = (X, Z) => { let d = Infinity; for (const a of ALL) { if (Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; d = Math.min(d, a.obj.voidD(...a.from(X, Z))); } return d; };
const worldLift = (X, Z) => { let y = 0; for (const a of ALL) { if (!a.obj.lift || a.local || Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; y += a.obj.lift(...a.from(X, Z)); } return y; };

// a green's contour, in its own frame (u right, v toward the back, metres from the pin). Directions are
// degrees clockwise from the front: 0 = toward the tee, 90 = right, 180 = the back.
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
  const k = h.n - 1, prof = profileFn(h.prof), W = WOR[k];
  const endHead = headingAt(h.line, h.len - 1), ec = Math.cos(endHead), es = Math.sin(endHead);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // black volcanic sand by the greens (warm ground), hollows of soft powder out in the fairways
  // three shapes: an ellipse ({ at, rx, rz }), a strip along the line ({ strip: [[s, L, R], ...] }, edges like a
  // fairway's) or a band wrapping the green ({ wrap: { from, to, d, w } }: degrees round the green, 0 = past the
  // pin, + to the right; d metres off its edge, w wide)
  const bunkers = (h.bunkers || []).map((b, i) => {
    if (b.strip) { const fd = makeFairway(h.line, [{ e: b.strip, wob: b.wob ?? 3, seed: 90 + i }]), sx = b.strip.map(([s, L, R]) => at(h.line, s, (R - L) / 2));
      return { strip: true, kind: b.kind || 'powder', depth: 1.3, edgeM: fd, x: sx[0][0], z: sx[0][1], box: [Math.min(...sx.map(p => p[0])) - 70, Math.min(...sx.map(p => p[1])) - 70, Math.max(...sx.map(p => p[0])) + 70, Math.max(...sx.map(p => p[1])) + 70] }; }
    if (b.wrap) return { wrap: b.wrap, kind: b.kind || 'sand', depth: 0.9, seed: 95 + i, x: h.pin[0], z: h.pin[1] };
    const kind = b.kind || (Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45 ? 'sand' : 'powder');
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, kind, depth: kind === 'sand' ? 0.8 : 1.3 }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed);
  // a greenside bunker sits just off the green, never in it: slide it straight away from the pin until
  // every part of it is at least 2.5 m outside the green's edge (room for a collar between)
  for (const b of bunkers) {
    if (b.kind !== 'sand' || b.wrap || b.strip) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    b.was = [b.x, b.z];
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
    b.edge = clear(); b.moved = Math.hypot(b.x - b.was[0], b.z - b.was[1]);
  }
  // metres outside a bunker (negative inside)
  const wrapM = (b, x, z) => {
    const W = b.wrap, [u, v] = gUV(x, z), a = Math.atan2(u, v) * 180 / Math.PI, span = W.to - W.from;
    let t = (((a - W.from) % 360) + 360) % 360 / span, r = Math.hypot(u, v);
    if (t > 1) { const over = Math.min((t - 1) * span, 360 - t * span) * Math.PI / 180 * r; return Math.max(over, 1); }
    const w = W.w * Math.pow(Math.sin(Math.PI * t), 0.35) * (1 + 0.22 * noise1(t * 6, b.seed)), c = W.d + w / 2;
    return Math.abs(gm(x, z) - c) - w / 2 + 0.6 * noise2(x / 4, z / 4, b.seed);
  };
  const edgeM = (b, x, z) => b.strip ? b.edgeM(x, z) : b.wrap ? wrapM(b, x, z) : (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) if (!b.box) b.box = b.wrap ? [h.pin[0] - 70, h.pin[1] - 70, h.pin[0] + 70, h.pin[1] + 70] : [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const extra = (h.extraFw || []).map((e, i) => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0, seed: 60 + i }));
  const rubble = (h.rubble || []).map(r => ({ x: r.at[0], z: r.at[1], rx: r.rx, rz: r.rz, rot: r.rot || 0 }));
  const forms = (h.forms || []).map(f => ({ ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0 }));
  const cliffs = (h.cliffs || []).map(c => ({ ...c, x: c.at[0], z: c.at[1], rot: c.rot || 0 }));
  const lake = h.lake && { ...h.lake, x: h.lake.at[0], z: h.lake.at[1], rot: h.lake.rot || 0 };
  // a hole of open water in the lake's ice, with a ragged edge
  const open = h.openWater && { x: h.openWater.at[0], z: h.openWater.at[1], rx: h.openWater.rx, rz: h.openWater.rz, rot: h.openWater.rot || 0 };
  const inOpen = (x, z) => !!open && seDist(open, x, z) + 0.16 * noise2(x / 3.5, z / 3.5, 17) < 1;
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  // the cracks that touch this hole: its own, in its frame, and everyone else's through world space
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
  const box = [Math.min(...xs) - 320, Math.min(...zs) - 320, Math.max(...xs) + 320, Math.max(...zs) + 320];
  const here = [];
  for (const a of ALL) {
    if (a.owner === k) { here.push({ obj: a.obj, f: (x, z) => [x, z] }); continue; }
    if (a.local) continue;   // another hole's scarp is that hole's elevation, not this one's
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
      if (Gd.contour) g += contourAt(Gd.contour, u, v);
      y += g * fade;
    }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    const [X, Z] = W(x, z);
    let m = smooth((go - 4) / 8);
    for (const t of teePads) m *= smooth((Math.hypot(x - t.x, z - t.z) - 7) / 8);
    // `groomed` (0-1): how much of the waves a hole's fairway keeps. At full size (about half a metre) a ball resting
    // in a trough on the 9th's climb clipped the next crest a few metres ahead
    y += m * waves(X, Z) * (h.groomed == null ? 1 : lerp(h.groomed, 1, smooth((fwD(x, z) + 2) / 8)));
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
    if (lake) { const e = seDist(lake, x, z); if (e < 1) return (inOpen(x, z) ? lake.y - 0.35 : lake.y) - drop; if (e < 1.14) y = lerp(lake.y + 0.1 - drop, y, smooth((e - 1) / 0.14)); }
    for (const w of waters) { const e = seDist(w, x, z); if (e < 1) return w.y - drop; if (e < 1.3) y = lerp(w.y + 0.25 - drop, y, smooth((e - 1) / 0.3)); }
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z, true), b = ground(x - d, z, true), c = ground(x, z + d, true), e = ground(x, z - d, true); return Math.hypot(a - b, c - e) / (2 * d); };
  const fairwayD = (x, z) => { let fd = fwD(x, z); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) + 0.12 * noise2(x / 9, z / 9, e.seed) - 1) * Math.min(e.rx, e.rz)); return fd; };

  function surface(x, z) {
    const vd = voidD(x, z);
    if (vd < 0) return 'void';
    if (lake && seDist(lake, x, z) < 1) return inOpen(x, z) ? 'water' : 'ice';
    for (const w of waters) if (seDist(w, x, z) < 1) return 'water';
    if (hallPts && inPoly(hallPts, x, z)) return 'hall';
    const go = gm(x, z);
    if (go < 0) return 'green';
    for (const b of bunkers) if (inBunker(b)(x, z)) return b.kind;
    if (go < (h.green.apron || 3) || (h.green.punch && go < h.green.punch.floor + h.green.punch.bank)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    if (vd < 3.5) return 'ice';
    const pr = along(x, z);
    for (const c of cliffs) if (seDist(c, x, z) < 1.02 && slopeAt(x, z) > 0.3) return c.surf || 'rock';
    const sl = slopeAt(x, z);
    if (sl > 0.42) {
      // a scarp with rockFace is a dark rock cliff (its crags too), but where the frozen falls run down it, ice
      for (const c of here) if (c.obj.spec && !c.obj.open && c.obj.spec.rockFace) {
        const e = c.obj.signedE(...c.f(x, z)); if (e < -3 || e > c.obj.lip.face * 2.5 + 6) continue;
        return h.falls && pr.off > h.falls.off[0] - 2 && pr.off < h.falls.off[1] + 2 && e < c.obj.lip.face * 2 ? 'ice' : 'rock';
      }
      const [X, Z] = W(x, z); return crackLift(x, z) > 0.2 ? 'ice' : onPeak(X, Z) ? 'rock' : (h.steep || 'rock');
    }
    const fd = fairwayD(x, z);
    if (fd < 0 && vd > 6) return 'fairway';
    for (const f of forms) if (f.surf && seDist(f, x, z) < 0.75) return f.surf;
    for (const r of rubble) if (seDist(r, x, z) < 1) return 'rubble';
    for (const c of here) if (c.obj.spec && !c.obj.open && c.obj.spec.rubble) { const e = c.obj.signedE(...c.f(x, z)); if (e < 0 && e > -c.obj.spec.rubble * (0.7 + 0.3 * noise2(x / 6, z / 6, 3))) return 'rubble'; }
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
  // erratics stay 22 m clear of every tee pad: one stood 7 m in front of the 9th's Hare tee and turned every drive back
  for (const b of h.boulders || []) {
    if (surfaceOk(b.at) && teePads.every(t => Math.hypot(b.at[0] - t.x, b.at[1] - t.z) > 22 + b.r)) objs.push({ kind: 'boulder', x: b.at[0], z: b.at[1], r: b.r, h: b.h, base: gAt(...b.at) - b.h * 0.25 });
  }
  function surfaceOk(p) { const s = surface(...p); return !['fairway', 'green', 'fringe', 'tee', 'water', 'ice', 'void', 'sand', 'powder'].includes(s); }
  for (const t of h.trees || []) if (surfaceOk([t.x, t.z])) objs.push({ kind: 'tree', x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  if (h.cave) {   // the cliff and its cave mouth are ground (base above); the roof is a slab over the back tees
    const C = h.cave;
    objs.push({ kind: 'roof', pts: [at(h.line, C.s0, -C.w / 2 - 2), at(h.line, C.s1 - 8, -C.w / 2 - 2), at(h.line, C.s1 - 8, C.w / 2 + 2), at(h.line, C.s0, C.w / 2 + 2)], y: C.roof, t: C.h - C.roof, label: C.label });
  }
  if (h.arch) { const A = h.arch; objs.push({ kind: 'arch', a: [A.a[0], A.a[1], gAt(A.a[0], A.a[1]) ?? 0], b: [A.b[0], A.b[1], gAt(A.b[0], A.b[1]) ?? 0], h: A.h, w: A.w, t: A.t, label: A.label }); }
  if (h.hall) objs.push({ kind: 'hall', pts: hallPts, base: Math.min(...hallPts.map(p => gAt(...p))) - 0.5, h: h.hall.h, roof: h.hall.roof, at: h.hall.at, rot: endHead, label: h.hall.label });
  if (h.longship) { const S = h.longship, rot = S.toward ? Math.atan2(S.toward[1] - S.at[1], S.toward[0] - S.at[0]) : S.rot || 0; objs.push({ kind: 'longship', ...S, rot, x: S.at[0], z: S.at[1], y: lake.y - 0.6 }); }
  if (h.mammoth) { const M = h.mammoth, pr = project(h.line, ...M.at); objs.push({ kind: 'mammoth', x: M.at[0], z: M.at[1], base: gAt(...M.at), dir: headingAt(h.line, pr.s), label: M.label }); }
  if (h.falls) {
    // the frozen falls: columns of ice standing the full height of the face in front, flows hanging from the lip
    // behind them over the bulge, and a few icicles along the rest of the lip; seracs lean off the shelf's crest
    const sc = OWN[k].cracks.find(c => !c.open), side = sc.lip.side, st = 1.1, P = sc.scarpLine(st), R = rnd(600 + h.n);
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * side, nz = dx / l * side;  // toward the high side
      const F = sc.faceAt(i * st), off = project(h.line, ...a).off, inFalls = off > h.falls.off[0] && off < h.falls.off[1];
      if (!inFalls && R() > 0.22) continue;
      const lipP = [a[0] + nx * (F + 1.5), a[1] + nz * (F + 1.5)], top = ground(...lipP, true), foot = ground(a[0] - nx * 2, a[1] - nz * 2, true);
      const edge = inFalls ? Math.min(1, (Math.min(off - h.falls.off[0], h.falls.off[1] - off)) / 5) : 0;
      const rows = inFalls ? 4 : 1;
      for (let row = 0; row < rows; row++) {
        const t = inFalls ? 0.04 + row * 0.24 + R() * 0.1 : 0.88 + R() * 0.08, p = [a[0] + nx * F * t, a[1] + nz * F * t], gp = ground(...p, true);
        // in the falls, ropey columns that pour over the lip and run down to the ice, flaring where they land;
        // toward its edges and along the rest of the lip, icicles that hang free and taper to a drip
        if (inFalls && R() < 0.4 + 0.6 * edge) {
          objs.push({ kind: 'icefall', x: p[0], z: p[1], top: top - 0.2 - R() * 0.6, len: Math.max(1, top - (row === 0 ? foot : gp) + 0.3), r: (row === 0 ? 1.4 : 1.1) + R() * 1.8, seed: Math.floor(R() * 1e4) });
          continue;
        }
        const tip = gp + 0.2 + R() * (top - gp) * (inFalls ? 0.5 : 0.75);
        objs.push({ kind: 'icicle', x: p[0], z: p[1], top: top + 0.2, len: Math.max(1, top - tip), r: inFalls ? 0.7 + R() * 1 : 0.4 + R() * 0.7, seed: Math.floor(R() * 1e4) });
      }
    }
    for (let i = 0; i < P.length; i += 5) {
      const off = project(h.line, ...P[i]).off; if (Math.abs(off) < 26 || R() < 0.45) continue;
      const a = P[i], b = P[Math.min(i + 1, P.length - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * side, nz = (b[0] - a[0]) / l * side, F = sc.faceAt(i * st);
      const d = F + 1.5 + R() * 5, p = [a[0] + nx * d + (R() - 0.5) * 3, a[1] + nz * d + (R() - 0.5) * 3];
      if (sc.spec.rockFace) { const r = 2.5 + R() * 3; objs.push({ kind: 'boulder', x: p[0], z: p[1], r, h: r * (0.9 + R() * 0.9), base: ground(...p, true) - 1 }); }
      else objs.push({ kind: 'serac', x: p[0], z: p[1], r: 2 + R() * 2.5, h: 4 + R() * 7, base: ground(...p, true) - 1, seed: 700 + i });
    }
  }
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
    const [x, z] = LOC[k](X, Z), y = BUILT[k].ground(x, z, true, true) + HOLES[k].base + localLift(k, X, Z);
    ws += w; ys += w * y;
  }
  // within 45 m of a hole's line it is that hole's ground exactly
  const blend = ys / ws, own0 = BUILT[best].ground(lx, lz, true, true) + HOLES[best].base + localLift(best, X, Z);
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
  for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 160) continue; const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4); const [x, z] = LOC[k](X, Z); ws += w; ys += w * (BUILT[k].ground(x, z, true, true) + HOLES[k].base + localLift(k, X, Z)); }
  return ys / ws + worldLift(X, Z) + layerLift(X, Z);
}
export { WL, LOC, WOR };
