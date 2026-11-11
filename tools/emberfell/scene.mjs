// Emberfell: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and the mountain between the holes. A hole's ground is its own line's
// profile near the line (the mountain under it, eased down steps where it has `ramps`), blending into the
// mountain (world.mjs V) by 30-65 m off it, with the hole's shapes on top: forms, the cinder cone, the flow
// fronts and the tube's trench (shared through world space, so every hole sees them), its green complex,
// bunkers and tee pads. Lava is level and plays like water. Shared by the plans, profiles and sketches. Pure.
import { project, seDist, seOutline, rectPts, inPoly, smooth, clamp, at, rnd, distLine, headingAt, lerp, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, makeCrack, makeShaft, noise1, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, lavaAt, nativeAt, BARRANCO, CAL, FALL, polar, rimR, INSIDE, riverCut } from './world.mjs';

export const SURF = ['flow', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'scoria', 'lava', 'rock', 'rubble', 'cinder', 'ash', 'forest', 'sulfur', 'hall', 'void', 'crust', 'sinter'];
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

// the line's profile: the mountain sampled under the line, eased down each ramp, lightly smoothed
const PROF = HOLES.map((h, k) => {
  const st = 2, n = Math.ceil(h.len / st) + 1, y = [];
  for (let i = 0; i < n; i++) y.push(V(...WOR[k](...at(h.line, Math.min(i * st, h.len)))));
  for (const [a, b] of h.ramps || []) { const ia = Math.round(a / st), ib = Math.min(n - 1, Math.round(b / st)), ya = y[ia], yb = y[ib]; for (let i = ia; i <= ib; i++) y[i] = lerp(ya, yb, smooth((i - ia) / (ib - ia))); }
  const sm = y.map((_, i) => { let s = 0, c = 0; for (let j = -3; j <= 3; j++) { const q = y[clamp(i + j, 0, n - 1)]; s += q; c++; } return s / c; });
  return { st, y: sm, at: s => { const f = clamp(s / st, 0, n - 1), i = Math.floor(f), t = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], t); } };
});
HOLES.forEach((h, k) => { h.base = PROF[k].at(0); });

// shapes shared through world space: forms (mounds, ridges, the cinder cone, the spatter vent) and cracks
// (the tube's trench, skylights, flow fronts), each asked about a world point in its own hole's frame
const FORMS = [], ALL = [];
for (const [k, h] of HOLES.entries()) {
  for (const f of h.forms || []) FORMS.push({ k, kind: 'mound', ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0, reach: Math.max(f.rx, f.rz) + 10 });
  if (h.cone) { const C = h.cone, [tx, tz] = C.breach.toward, a = Math.atan2(tz - C.at[1], tx - C.at[0]); FORMS.push({ k, kind: 'cone', ...C, x: C.at[0], z: C.at[1], ba: a, reach: C.base + 5 }); }
  if (h.vent) { const [x, z] = LOC[k](...h.vent.at); FORMS.push({ k, kind: 'vent', x, z, r: 22, h: 10, reach: 26, label: h.vent.label }); }
  for (const c of h.cracks || []) ALL.push({ obj: makeCrack(c), owner: k });
  for (const s of h.skylights || []) ALL.push({ obj: makeShaft(s.at, s.r, 9 + k), owner: k, c0: s.at, r0: s.r });
}
for (const f of FORMS) f.c = WOR[f.k](f.x, f.z);
for (const a of ALL) {
  const pts = a.obj.spec ? a.obj.spec.pts : [a.c0], P = pts.map(p => WOR[a.owner](...p));
  a.c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  a.reach = Math.max(...P.map(p => Math.hypot(p[0] - a.c[0], p[1] - a.c[1]))) + (a.obj.lip ? a.obj.lip.run + a.obj.lip.fall + a.obj.lip.end : 0) + 30 + (a.r0 || 0);
  a.from = LOC[a.owner];
}
export const CRACKS = ALL;
function formLift(f, x, z) {   // x, z in the form's own hole frame
  if (f.kind === 'mound') return f.h * bump(seDist(f, x, z) + 0.06 * noise2(x / 14, z / 14, 3));
  if (f.kind === 'vent') { const d = Math.hypot(x - f.x, z - f.z) / f.r; return d > 1 ? 0 : f.h * (1 - d * d) * (d > 0.35 ? 1 : 0.55 + 0.45 * d / 0.35); }
  // the cinder cone: a rim with a breach toward the tee, the crater floor level inside it
  const dx = x - f.x, dz = z - f.z, r = Math.hypot(dx, dz); if (r > f.base) return 0;
  let da = Math.atan2(dz, dx) - f.ba; da = Math.atan2(Math.sin(da), Math.cos(da));
  const br = Math.exp(-((da * 180 / Math.PI / f.breach.w) ** 4)), rn = 1.2 * noise1(Math.atan2(dz, dx) * 4, 7) + 0.6 * noise1(Math.atan2(dz, dx) * 13, 8);
  const rimH = lerp(f.rimH + rn, f.breach.lip, br);
  if (r >= f.rim) { const t = (r - f.rim) / (f.base - f.rim); return rimH * Math.pow(1 - smooth(t), 1.1); }
  if (r <= f.floorR) return lerp(f.floor, f.breach.lip, br * 0);
  return lerp(f.floor, rimH, smooth((r - f.floorR) / (f.rim - f.floorR)));
}
// forms and crack lifts at a world point
function shapesAt(X, Z) {
  let y = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; y += formLift(f, ...LOC[f.k](X, Z)); }
  for (const a of ALL) { if (!a.obj.lift || Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; y += a.obj.lift(...a.from(X, Z)); }
  return y;
}
const worldVoid = (X, Z) => { let d = Infinity; for (const a of ALL) { if (Math.hypot(X - a.c[0], Z - a.c[1]) > a.reach) continue; d = Math.min(d, a.obj.voidD(...a.from(X, Z))); } return d; };
export const coneAt = (X, Z) => { for (const f of FORMS) if (f.kind === 'cone') { const [x, z] = LOC[f.k](X, Z), r = Math.hypot(x - f.x, z - f.z); if (r < f.base) return { r, f }; } return null; };

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
  const k = h.n - 1, W = WOR[k], PR = PROF[k];
  const endHead = headingAt(h.line, h.len - 1), ec = Math.cos(endHead), es = Math.sin(endHead);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // ash-grey sand by the greens; red scoria (cinder) waste out in the fairways
  const bunkers = (h.bunkers || []).map((b, i) => {
    if (b.wrap) return { wrap: b.wrap, kind: b.kind === 'cinder' ? 'scoria' : 'sand', depth: 0.9, seed: 95 + i, x: h.pin[0], z: h.pin[1], box: [h.pin[0] - 70, h.pin[1] - 70, h.pin[0] + 70, h.pin[1] + 70] };
    if (b.strip) { const fd = makeFairway(h.line, [{ e: b.strip, wob: b.wob ?? 3, seed: 90 + i }]), sx = b.strip.map(([s, L, R]) => at(h.line, s, (R - L) / 2));
      return { strip: true, kind: b.kind === 'cinder' ? 'scoria' : 'sand', depth: 0.9, edgeM: fd, x: sx[0][0], z: sx[0][1], box: [Math.min(...sx.map(p => p[0])) - 70, Math.min(...sx.map(p => p[1])) - 70, Math.max(...sx.map(p => p[0])) + 70, Math.max(...sx.map(p => p[1])) + 70] }; }
    const kind = b.kind === 'cinder' ? 'scoria' : b.kind || (Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45 ? 'sand' : 'scoria');
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, kind, depth: kind === 'sand' ? 0.8 : 0.9 }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed);
  for (const b of bunkers) {   // a greenside bunker sits at least 2.5 m outside the green's edge
    if (b.kind !== 'sand' || b.strip || b.wrap) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    b.was = [b.x, b.z];
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
    b.edge = clear(); b.moved = Math.hypot(b.x - b.was[0], b.z - b.was[1]);
  }
  // a band of sand wrapping the green ({ wrap: { from, to, d, w } }: degrees round the green, 0 = past the pin,
  // + to the right; d metres off its edge, w wide), as on Rimeholm's 6th
  const wrapM = (b, x, z) => {
    const Wr = b.wrap, [u, v] = gUV(x, z), a = Math.atan2(u, v) * 180 / Math.PI, span = Wr.to - Wr.from;
    const t = (((a - Wr.from) % 360) + 360) % 360 / span, r = Math.hypot(u, v);
    if (t > 1) { const over = Math.min((t - 1) * span, 360 - t * span) * Math.PI / 180 * r; return Math.max(over, 1); }
    const w = Wr.w * Math.pow(Math.sin(Math.PI * t), 0.35) * (1 + 0.22 * noise1(t * 6, b.seed)), c = Wr.d + w / 2;
    return Math.abs(gm(x, z) - c) - w / 2 + 0.6 * noise2(x / 4, z / 4, b.seed);
  };
  const edgeM = (b, x, z) => b.strip ? b.edgeM(x, z) : b.wrap ? wrapM(b, x, z) : (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) if (!b.box) b.box = [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const extra = (h.extraFw || []).map((e, i) => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0, seed: 60 + i }));
  const zones = (h.zones || []).map(zn => ({ surf: zn.surf, blobs: zn.blobs.map(([s, o, r]) => [...at(h.line, s, o), r]) }));
  const inZone = (zn, x, z) => zn.blobs.some(([bx, bz, r]) => Math.hypot(x - bx, z - bz) < r * (1 + 0.18 * noise2(x / 9, z / 9, 5)));
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  // the cracks near this hole, asked in this hole's frame
  const here = ALL.map(a => ({ obj: a.obj, f: a.owner === k ? ((x, z) => [x, z]) : ((x, z) => a.from(...W(x, z))) }));
  const voidD = (x, z) => { let d = Infinity; for (const c of here) d = Math.min(d, c.obj.voidD(...c.f(x, z))); return d; };
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
  const hallPts = h.hall && rectPts(h.hall.at[0], h.hall.at[1], h.hall.w, h.hall.d, endHead + 0.5);
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const onPad = (t, x, z) => { const [u, v] = [(x - t.x) * tc + (z - t.z) * ts, (x - t.x) * ts - (z - t.z) * tc]; return Math.abs(u) < 6 && Math.abs(v) < 5; };

  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
  const along = (x, z) => {
    const pr = project(h.line, x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  // the ground without the shared shapes (absolute): the line's profile near the line, the mountain away from it
  function baseAbs(x, z) {
    const pr = along(x, z), kk = smooth((Math.abs(pr.off) - (h.flat ?? 30)) / (h.fade ?? 36));
    const line = PR.at(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + (kk < 1 ? riverCut(...W(x, z)) : 0);   // a lava channel crossing the line cuts it too
    return kk >= 1 ? V(...W(x, z)) : kk <= 0 ? line : lerp(line, V(...W(x, z)), kk);
  }
  // everything but lava and tee pads, relative to the hole's base
  function base(x, z) {
    let y = baseAbs(x, z) - h.base + shapesAt(...W(x, z));
    const go = gm(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - (Gd.falseFront ? 0.5 : 2)) / (Gd.falseFront ? 5 : 8)));
    if (Gd.punch) { const P = Gd.punch; y -= P.depth * (1 - smooth((go - P.floor) / P.bank)); }
    if (go < 7) {   // tiers, tilts, the redan and a crown, faded out past the collar; the green itself levelled
      const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z), pr = along(x, z);
      let g = 0;
      if (Gd.tier) g += Gd.tier.h * smooth((pr.s - Gd.tier.s) / 5);
      if (Gd.tilt) g += (Gd.tilt.side ? Gd.tilt.side * u : 0) * Gd.tilt.pct / 100 * -1 + (Gd.tilt.front ? v * Gd.tilt.pct / 100 : 0);
      if (Gd.redan) g += (-u + v) / Math.SQRT2 * -Gd.redan / 100;
      if (Gd.crown) g += Gd.crown * (1 - clamp(1 + go / 9, 0, 1) ** 2);
      if (Gd.contour) g += contourAt(Gd.contour, u, v);
      y += g * fade;
    }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green's own surface is levelled to the pin's height before tilts, so the mountain's slope under it
  // doesn't tip it (the collar blends it back over 9 m)
  const pinBase = (() => { const pr = along(...h.pin); return PR.at(pr.s) - h.base + shapesAt(...W(...h.pin)); })();
  const level = (x, z, y) => { const go = gm(x, z); if (go > 9) return y; const raw = baseAbs(x, z) - h.base + shapesAt(...W(x, z)); return y + (pinBase - raw) * (1 - smooth((go + 1) / 10)); };
  for (const t of teePads) t.y = level(t.x, t.z, base(t.x, t.z)) + 0.4;

  function ground(x, z, raw = false) {
    if (!raw && voidD(x, z) < 0) return null;
    const [X, Z] = W(x, z), lv = lavaAt(X, Z);
    if (lv) return lv.level - h.base;
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = level(x, z, base(x, z));
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, smooth((d - 6) / 6)); }
    return y;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z, true), b = ground(x - d, z, true), c = ground(x, z + d, true), e = ground(x, z - d, true); return Math.hypot(a - b, c - e) / (2 * d); };
  const fairwayD = (x, z) => { let fd = fwD(x, z); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) + 0.12 * noise2(x / 9, z / 9, e.seed) - 1) * Math.min(e.rx, e.rz)); return fd; };
  const brD = h.bridge ? ((x, z) => { const pr = along(x, z); return Math.abs(pr.s - h.bridge.s) < h.bridge.w / 2 + 2 && Math.abs(pr.off) < 14; }) : () => false;

  function surface(x, z) {
    const vd = voidD(x, z);
    if (vd < 0) return 'void';
    const [X, Z] = W(x, z);
    if (lavaAt(X, Z)) return 'lava';
    if (hallPts && inPoly(hallPts, x, z)) return 'hall';
    const go = gm(x, z);
    if (go < 0) return 'green';
    for (const b of bunkers) if (inBunker(b)(x, z)) return b.kind;
    if (go < (h.green.apron || 3) || (h.green.punch && go < h.green.punch.floor + h.green.punch.bank)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    const sl = slopeAt(x, z), fd = fairwayD(x, z), cn = h.cone && coneAt(X, Z);
    if (fd < 0 && vd > 4 && sl < 0.45) return 'fairway';
    if (sl > (INSIDE(X, Z) ? 0.75 : 0.95)) return 'rock';
    if (cn && cn.r > cn.f.floorR + 3) return 'cinder';
    for (const zn of zones) if (inZone(zn, x, z)) return zn.surf;
    if (vd < 3) return 'rock';
    if (sl > 0.45) return INSIDE(X, Z) ? 'rubble' : 'cinder';
    const pr = along(x, z);
    if (go < 14 || (cn && cn.r <= cn.f.floorR + 3)) return 'rough';
    if (fd < (h.corridor ?? 18) && vd > 4) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    // the barranco's floor: water-worn boulders
    const bp = project(BARRANCO.pts, X, Z); if (!INSIDE(X, Z) && Math.abs(bp.off) < 9 + 4 * noise1(bp.s / 20, 3) && bp.s > 60) return 'rubble';
    return nativeAt(X, Z);
  }

  // the solid and built things, in the hole's frame (y up from the hole's base)
  const objs = [];
  const gAt = (x, z) => ground(x, z) ?? ground(x, z, true);
  function surfaceOk(p) { const s = surface(...p); return !['fairway', 'green', 'fringe', 'tee', 'lava', 'void', 'sand', 'scoria', 'hall'].includes(s); }
  for (const b of h.boulders || []) if (surfaceOk(b.at)) objs.push({ kind: 'boulder', x: b.at[0], z: b.at[1], r: b.r, h: b.h, base: gAt(...b.at) - b.h * 0.25 });
  for (const t of h.trees || []) if (surfaceOk([t.x, t.z]) && surface(t.x, t.z) !== 'flow') objs.push({ kind: 'tree', x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  for (const t of h.lavaTrees || []) if (surfaceOk(t.at)) objs.push({ kind: 'lavatree', x: t.at[0], z: t.at[1], r: t.r, h: t.h, base: gAt(...t.at) - 0.2, seed: t.seed });
  for (const f of FORMS) if (f.k === k && f.kind === 'vent') objs.push({ kind: 'vent', x: f.x, z: f.z, r: f.r, base: gAt(f.x, f.z), label: f.label });
  for (const [s, o] of h.fumaroles || []) { const p = at(h.line, s, o); objs.push({ kind: 'steam', x: p[0], z: p[1], base: gAt(...p), r: 3 + (s % 3) }); }
  if (h.hall) objs.push({ kind: 'hall', pts: hallPts, base: Math.min(...hallPts.map(p => gAt(...p))) - 0.5, h: h.hall.h, roof: h.hall.roof, at: h.hall.at, rot: endHead, label: h.hall.label });
  for (const c of OWNCR(k)) if (c.spec.tube) {   // tube mouths: the dark arch where the roof still stands, at each end
    const P = c.spec.pts;
    for (const [e, n] of [[P[0], P[1]], [P.at(-1), P.at(-2)]]) objs.push({ kind: 'mouth', x: e[0], z: e[1], dir: Math.atan2(n[0] - e[0], -(n[1] - e[1])), w: c.spec.w, depth: c.depth, base: gAt(e[0] + (e[0] - n[0]) * 0.1, e[1] + (e[1] - n[1]) * 0.1) });
  }
  if (h.columns) {   // basalt columns on the terrace edge's face round the corner: wherever the mountain is steep
    const R = rnd(600 + h.n);
    for (let s = h.columns.from[0]; s < h.columns.to[0]; s += 2.2) for (let o = h.columns.from[1] - 90; o < h.columns.to[1]; o += 2.2) {
      const p = at(h.line, s, o), G = (x, z) => ground(x, z, true), d = 1.5, sl = Math.hypot(G(p[0] + d, p[1]) - G(p[0] - d, p[1]), G(p[0], p[1] + d) - G(p[0], p[1] - d)) / (2 * d);
      if (sl < 0.9 || R() < 0.25) continue;
      const ring = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([a, b]) => G(p[0] + a, p[1] + b)), top = Math.max(...ring) - 0.3, foot = Math.min(...ring);
      objs.push({ kind: 'column', x: p[0], z: p[1], r: 1.1 + R() * 0.3, base: foot - 0.5, top: top - R() * 1.6, seed: Math.floor(R() * 1e4) });
    }
  }
  // steam off the green (the warm ground) is not this course: lava glows instead; a few torches line the walks

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'boulder' && Math.hypot(x - o.x, z - o.z) < o.r * 0.8) out.push([o.base, o.base + o.h, 'a boulder']);
      if (o.kind === 'tree' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base + 2, o.base + o.h, 'a tree']);
      if (o.kind === 'lavatree' && Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base, o.base + o.h, 'a lava tree']);
      if (o.kind === 'hall' && inPoly(o.pts, x, z)) out.push([o.base, o.base + o.h + (o.roof || 0), 'the clubhouse']);
    }
    return out;
  }
  return { h, ground, surface, objs, solids, gm, voidD, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along };
}
function OWNCR(k) { return ALL.filter(a => a.owner === k && a.obj.spec).map(a => a.obj); }

export const BUILT = HOLES.map(buildHole);

// the mountain between the holes (world, absolute heights): each hole's own ground near its line, blended into
// its neighbours' further out and into the mountain beyond, the shared shapes on top
export function worldAt(X, Z) {
  let ws = 0, ys = 0, best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const lv = lavaAt(X, Z);
  const [lx, lz] = LOC[best](X, Z), own = BUILT[best];
  if (worldVoid(X, Z) < 0) return { y: null, raw: V(X, Z) + shapesAt(X, Z) - 14, s: 'void', k: best };
  if (lv) return { y: lv.level, s: 'lava', k: best };
  let y;
  if (bd > 260) y = V(X, Z) + shapesAt(X, Z);
  else {
    for (let k = 0; k < HOLES.length; k++) {
      if (near[k] > bd + 160) continue;
      const w = 1 / Math.pow(Math.max(near[k], 30) - 28, 4);
      ws += w; ys += w * BUILT[k].baseAbs(...LOC[k](X, Z));
    }
    const blend = ys / ws + shapesAt(X, Z), full = own.ground(lx, lz, true) + own.base;
    y = lerp(full, blend, smooth((bd - 45) / 70));
    if (bd > 150) y = lerp(y, V(X, Z) + shapesAt(X, Z), smooth((bd - 150) / 110));
  }
  const s = bd < 150 ? own.surface(lx, lz) : (() => {
    const d = 1.5, sl = Math.hypot(V(X + d, Z) - V(X - d, Z), V(X, Z + d) - V(X, Z - d)) / (2 * d);
    if (sl > (INSIDE(X, Z) ? 0.75 : 0.95)) return 'rock';
    const bp = project(BARRANCO.pts, X, Z); if (!INSIDE(X, Z) && Math.abs(bp.off) < 9 + 4 * noise1(bp.s / 20, 3) && bp.s > 60) return 'rubble';
    return nativeAt(X, Z);
  })();
  return { y, s, k: best };
}
export { WL, LOC, WOR, PROF };
