// Wrecker's Reach: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own
// frame, plus the world transform and the ground between the holes. A hole's own ground follows the world's floor
// along its line (with its `prof` knots, cant, crown and table), blending into the world (world.mjs V, with the
// dunes) further out and past its ends; the shared shapes sit on top: forms, greens, pots and tee pads.
//
// Two holes share ground twice (the brief: "the shared ground must come from the one world function"): the 1st and
// 9th share a fairway, and the 2nd and 8th a green. Both come from world.mjs (SHARED_FW, DGREEN): inside them every
// hole's ground is the world's own (no hole's cant or profile lifts it), and the double green's surface is one
// datum and one contour whichever hole asks. Then every hole's `ground` and `surface` are read through `worldAt`,
// which blends the holes' own grounds, so a point has one height and one surface for every hole that sees it.
//
// Off the grass, in order: fescue (cheap), the dunes (sand with tussocks of dune grass), the beach (firm wet sand).
// Shared by the plans, profiles, sketches and checks. Pure. (After tools/buriedkingdom/scene.mjs.)
import { seDist, seOutline, smooth, clamp, at, distLine, headingAt, lerp, project, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, floorWorld, wet, waterAt, beachAt, coastD, cauldronE, creekD, sharedD, dgE, dgContour, DGREEN, STANDS, SITES, tussockAt, tussockDensity, w } from './world.mjs';

export const SURF = ['dune', 'fescue', 'fairway', 'fringe', 'green', 'tee', 'pot', 'tussock', 'beach', 'water', 'wreck', 'stone', 'void'];
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
const HD = HOLES.map(h => h.place.heading * Math.PI / 180);

// ---- things placed in a hole's frame that every hole shares, gathered into world space: forms (dunes, banks,
// hollows), the hole's props (hulls, masts, ribs, the bell, the wall), stands of dune grass and tussock zones
const FORMS = [], PROPS = [], STANDW = [...STANDS], ZONES = [];
for (const [k, h] of HOLES.entries()) {
  const Wk = WOR[k], hd = HD[k];
  for (const f of h.forms || []) {
    const lp = f.world ? h.L(...f.world) : f.at, rot = f.bearing != null ? (f.bearing - h.place.heading - 90) * Math.PI / 180 : (f.rot || 0);
    const c = Wk(...lp);
    FORMS.push({ ...f, k, c, wrot: rot + hd, rx: f.rx, rz: f.rz, reach: Math.max(f.rx, f.rz) + 10 });
  }
  for (const p of h.props || []) PROPS.push({ ...p, at: Wk(...p.at), wrot: p.rot != null ? p.rot + hd : 0, hole: k });
  for (const s of h.stands || []) STANDW.push({ ...s, c: s.world ? w(s.world) : Wk(...s.at), rot: s.rot || 0 });
  for (const g of h.grass || []) ZONES.push({ ...g, c: g.world ? w(g.world) : Wk(...g.at) });
}
for (const S of SITES) PROPS.push({ ...S, wrot: S.rot || 0, site: true });
// a form's lift at a world point (each form is a superellipse turned to its world rotation)
const formLift = (f, X, Z) => f.h * bump(seDist({ x: f.c[0], z: f.c[1], rx: f.rx, rz: f.rz, rot: f.wrot, p: f.p }, X, Z) + 0.06 * noise2(X / 14, Z / 14, 3));
export function shapesAt(X, Z) {
  let y = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; y += formLift(f, X, Z); }
  return y;
}
const sandForm = (X, Z) => FORMS.some(f => f.sand && seDist({ x: f.c[0], z: f.c[1], rx: f.rx, rz: f.rz, rot: f.wrot, p: f.p }, X, Z) < 0.78);
// where the world's own ground holds whatever the holes do: the shared fairway and the double green (1 inside)
export const sharedMask = (X, Z) => Math.max(1 - smooth((sharedD(X, Z) + 14) / 14), 1 - smooth((dgE(X, Z) - 6) / 14));   // 1 inside, fading out over its last 14 m
// tussocks: the density there (the base on the dunes and the holes' zones), and the clump at a point
export const densAt = (X, Z) => tussockDensity(X, Z, ZONES);
const standAt = (X, Z) => { for (const s of STANDW) { if (Math.abs(X - s.c[0]) > 14 || Math.abs(Z - s.c[1]) > 14) continue; const e = seDist({ x: s.c[0], z: s.c[1], rx: s.rx, rz: s.rz, rot: s.rot * Math.PI / 180 }, X, Z) + 0.12 * noise2(X / 3, Z / 3, 9); if (e < 1) return e < 0.72 ? 'tussock' : 'dune'; } return null; };

// a green's contour in its own frame (u right, v toward the back, metres from the pin); directions are degrees
// clockwise from the front: 0 = toward the tee, 90 = right, 180 = the back. (As tools/buriedkingdom.)
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
// a box standing on the ground, in a hole's frame: is (x, z) inside its footprint?
const inBox = (o, x, z) => { const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), c = dx * Math.cos(o.rot) + dz * Math.sin(o.rot); return Math.abs(a) < o.l / 2 && Math.abs(c) < o.w / 2; };

// the floor along each line (2 m steps from 80 m behind the tee to 120 m past the pin, the line carried on straight
// past its ends), lightly smoothed, plus the hole's `prof` knots [[s, dy]] (smoothstep between them)
const PROF = HOLES.map((h, k) => {
  const st = 2, s0 = -80, s1 = h.len + 120, n = Math.ceil((s1 - s0) / st) + 1, L0 = h.line;
  const sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el = Math.hypot(...ed);
  const pt = s => s < 0 ? [L0[0][0] + sd[0] / sl * s, L0[0][1] + sd[1] / sl * s] : s > h.len ? [L0.at(-1)[0] + ed[0] / el * (s - h.len), L0.at(-1)[1] + ed[1] / el * (s - h.len)] : at(L0, s);
  const K = h.prof || [[0, 0], [h.len, 0]], kn = s => { if (s <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth((s - K[i][0]) / (K[i + 1][0] - K[i][0]))); return K.at(-1)[1]; };
  const y = []; for (let i = 0; i < n; i++) { const s = s0 + i * st; y.push(floorWorld(...WOR[k](...pt(s)))); }
  const sm = y.map((_, i) => { let a = 0, c = 0; for (let j = -3; j <= 3; j++) { a += y[clamp(i + j, 0, n - 1)]; c++; } return a / c; });
  return { at: s => { const f = clamp((s - s0) / st, 0, n - 1), i = Math.floor(f), t = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], t) + kn(s); } };
});
HOLES.forEach((h, k) => { h.base = PROF[k].at(0); });

// the double green in a hole's frame: its edge and its surface (absolute)
const dgSurface = (X, Z) => DGREEN.datum + dgContour(X, Z);

export function buildHole(h) {
  const k = h.n - 1, Wh = WOR[k], PR = PROF[k], hd = HD[k];
  const endHead = headingAt(h.line, h.len - 1);
  const SHG = !!h.green.shared;
  const GR = SHG ? null : makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green });
  const gm = SHG ? (x, z) => dgE(...Wh(x, z)) : GR.gm, gUV = SHG ? null : GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // the pots: small, sunk, a steep sod face toward the green; soft sand
  const bunkers = (h.bunkers || []).map((b, i) => {
    const side = Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45;
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, side, job: b.job, pot: !!b.pot, relic: b.relic, depth: b.depth ?? (b.pot ? 1.6 : 0.9) }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.1 * noise2(x / 3, z / 3, b.seed);
  for (const b of bunkers) {   // a greenside pot sits at least 2.5 m outside the green's edge
    if (!b.side) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    b.was = [b.x, b.z];
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
    b.edge = clear(); b.moved = Math.hypot(b.x - b.was[0], b.z - b.was[1]);
  }
  const edgeM = (b, x, z) => (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) b.box = [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const extra = (h.extraFw || []).map((e, i) => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0, seed: 60 + i }));
  const fairwayD = (x, z) => { let fd = fwD(x, z); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) + 0.12 * noise2(x / 9, z / 9, e.seed) - 1) * Math.min(e.rx, e.rz)); return fd; };
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  // across the line: `cross` [[s0, s1, h, w]] raises the sides (h > 0: a half-pipe) or lowers them (h < 0: crowned);
  // `table` { s0, s1, L, R, h, face } lifts a level top h metres between s0..s1 and L..R across, its banks `face` wide
  const crossAt = (s, off) => { let g = 0; for (const [a, b, hh, ww] of h.cross || []) g += hh * smooth(Math.abs(off) / ww) * span(s, a, b); return g; };
  const tableAt = (s, off) => { const T = h.table; if (!T) return 0; const e = v => smooth(v / T.face + 0.5);
    return T.h * e(s - T.s0) * (1 - e(s - T.s1)) * e(off - T.L) * (1 - e(off - T.R)); };
  const lineExtra = (s, off) => crossAt(s, off) + tableAt(s, off);
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const onPad = (t, x, z) => { const [u, v] = [(x - t.x) * tc + (z - t.z) * ts, (x - t.x) * ts - (z - t.z) * tc]; return Math.abs(u) < 6 && Math.abs(v) < 5; };

  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
  // where a point is along the line (s) and how far off it, eased across the bisector inside each corner
  const blendS = (x, z) => {
    const L = h.line, c = []; let acc = 0;
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (l * l), 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      c.push({ d, s: acc + t * l, off: (dx * (z - az) - dz * (x - ax)) / l }); acc += l;
    }
    c.sort((p, q) => p.d - q.d);
    if (c.length < 2 || Math.abs(c[0].s - c[1].s) > 60) return c[0];
    const ww = 0.5 + 0.5 * smooth((c[1].d - c[0].d) / 14);
    return { d: c[0].d, s: c[0].s * ww + c[1].s * (1 - ww), off: c[0].off * ww + c[1].off * (1 - ww) };
  };
  const along = (x, z) => {
    const pr = blendS(x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  // the ground without the shared shapes (absolute): the floor along the line near it (with the hole's cant, crown
  // and table), the world away from it and past its ends; inside the shared ground, the world's own
  function baseAbs(x, z) {
    const pr = along(x, z), [X, Z] = Wh(x, z);
    let kk = Math.max(smooth((Math.abs(pr.off) - (h.flat ?? 30)) / (h.fade ?? 36)), smooth((pr.s - h.len - (h.endFade ?? 34)) / 34), smooth((-pr.s - 40) / 34));
    const sm = sharedMask(X, Z); kk = Math.max(kk, sm);
    if (kk >= 1) return V(X, Z);
    const own = (1 - sm), line = PR.at(pr.s) - own * cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + own * lineExtra(pr.s, pr.off);
    return lerp(wet(X, Z, line), V(X, Z), kk);
  }
  // everything but water and tee pads, relative to the hole's base: the shared forms, the green's contour, the pots
  function base(x, z) {
    const [X, Z] = Wh(x, z);
    let y = baseAbs(x, z) - h.base + shapesAt(X, Z);
    const go = gm(x, z);
    if (!SHG && go < 7 && h.green.contour) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(h.green.contour, u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + (b.pot ? 0.8 : 2)) / (b.pot ? 0.9 : 2.3))) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green's own surface is levelled to the pin's height before its contour (the collar blends it back over 9 m);
  // the double green is levelled to its datum and takes its world contour
  const pinBase = (() => { const pr = along(...h.pin); return PR.at(pr.s) + lineExtra(pr.s, 0) - h.base + shapesAt(...Wh(...h.pin)); })();
  const level = (x, z, y) => {
    const go = gm(x, z); if (go > 9) return y;
    const t = 1 - smooth((go + 1) / 10);
    if (SHG) { const [X, Z] = Wh(x, z); return lerp(y, dgSurface(X, Z) - h.base, t); }
    const raw = baseAbs(x, z) - h.base + shapesAt(...Wh(x, z)); return y + (pinBase - raw) * t;
  };
  for (const t of teePads) t.y = level(t.x, t.z, base(t.x, t.z)) + 0.4;
  const tipsPad = h.tipsPt ? { x: h.tipsPt[0], z: h.tipsPt[1] } : null;
  if (tipsPad) tipsPad.y = level(tipsPad.x, tipsPad.z, base(tipsPad.x, tipsPad.z));

  // this hole's own ground (relative to its base): what worldAt blends with its neighbours'
  function ownGround(x, z) {
    const [X, Z] = Wh(x, z), wa = waterAt(X, Z);
    if (wa && gm(x, z) > 2) return wa.level - h.base;
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = level(x, z, base(x, z));
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, smooth((d - 6) / 6)); }
    if (tipsPad) { const d = Math.hypot(x - tipsPad.x, z - tipsPad.z); if (d < 16) y = lerp(tipsPad.y, y, smooth((d - 8) / 8)); }
    return y;
  }
  const slopeOwn = (x, z) => { const d = 1.5, a = ownGround(x + d, z), b = ownGround(x - d, z), c = ownGround(x, z + d), e = ownGround(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };

  // this hole's own surface: green, water, pots, fringe, tees, the wrecks' footprints, the stands of grass, fairway
  // (mown up a slope to `mown`), the beach, the fescue band (round the fairway, the green and the tees), then the dunes:
  // sand, or a tussock where a clump stands
  function ownSurface(x, z) {
    const [X, Z] = Wh(x, z);
    const go = gm(x, z);
    if (go < 0) return 'green';
    if (waterAt(X, Z)) return 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'pot';
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    const st = standAt(X, Z); if (st) return st;
    const fd = fairwayD(x, z);
    if (fd < 0 && slopeOwn(x, z) < (h.mown ?? 0.35)) return 'fairway';
    if (beachAt(X, Z)) return 'beach';
    if (sandForm(X, Z)) return tussockAt(X, Z, densAt) ? 'tussock' : 'dune';
    if (go < 11 + 2.5 * noise2(x / 21, z / 21, 9)) return 'fescue';
    if (fd < (h.corridor ?? 10) + 3.5 * noise2(x / 33, z / 33, 8)) return 'fescue';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 12) return 'fescue';
    return tussockAt(X, Z, densAt) ? 'tussock' : 'dune';
  }
  return { h, ownGround, ownSurface, gm, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, tipsPad, edgeM };
}

const OWN = HOLES.map(buildHole);

// ---- the ground between the holes (world, absolute heights): each hole's own ground near its line, blended into
// its neighbours' further out and into the world beyond; the surface from the nearest hole
const TIPS_W = HOLES.map((h, k) => OWN[k].tipsPad ? [...WOR[k](OWN[k].tipsPad.x, OWN[k].tipsPad.z), OWN[k].tipsPad.y + OWN[k].base] : null).filter(Boolean);
export function worldAt(X, Z) {
  let best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const wa = waterAt(X, Z);
  const [lx, lz] = LOC[best](X, Z), own = OWN[best];
  if (wa && !(bd < 60 && own.gm(lx, lz) < 2)) return { y: wa.level, s: 'water', k: best };
  let y;
  if (bd > 240) y = V(X, Z) + shapesAt(X, Z);
  else {
    let fw = 0, fy = 0;
    for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 60) continue; const wk = Math.pow(1 - smooth((near[k] - bd) / 60), 2) / Math.pow(near[k] + 4, 2); fw += wk; fy += wk * (OWN[k].ownGround(...LOC[k](X, Z)) + OWN[k].base); }
    y = fy / fw;
    if (bd > 130) y = lerp(y, V(X, Z) + shapesAt(X, Z), smooth((bd - 130) / 110));
  }
  // a green or a tee pad belongs to its own hole: its own ground wins over the blend within 10 m of it
  for (let k = 0; k < HOLES.length; k++) {
    if (near[k] > 120) continue;
    const O = OWN[k], [qx, qz] = LOC[k](X, Z), go = O.gm(qx, qz);
    let t = go < 10 ? 1 - smooth((go + 1) / 11) : 0;
    for (const p of O.teePads) { const d = Math.hypot(qx - p.x, qz - p.z); if (d < 14) t = Math.max(t, 1 - smooth((d - 7) / 7)); }
    if (t > 0) y = lerp(y, O.ownGround(qx, qz) + O.base, t);
  }
  if (dgE(X, Z) < 0) y = dgSurface(X, Z);   // the double green: one surface whichever hole asks
  for (const [tx, tz, ty] of TIPS_W) { const d = Math.hypot(X - tx, Z - tz); if (d < 16) y = lerp(ty, y, smooth((d - 8) / 8)); }
  // the surface: the nearest hole's, but a fairway, green or pot of any hole near enough wins over another's rough
  let s = bd < 160 ? own.ownSurface(lx, lz) : (beachAt(X, Z) ? 'beach' : tussockAt(X, Z, densAt) ? 'tussock' : 'dune');
  if (['fescue', 'dune', 'tussock'].includes(s)) for (let k = 0; k < HOLES.length; k++) {
    if (k === best || near[k] > 150) continue;
    const o = OWN[k].ownSurface(...LOC[k](X, Z));
    if (['fairway', 'green', 'fringe', 'pot', 'tee'].includes(o)) { s = o; break; }
  }
  return { y, s, k: best };
}

// each hole, read through worldAt in its own frame: ground (relative to its base), surface, the solids near it
const objsFor = k => {
  const out = [], Lk = LOC[k], hd = HD[k], h = HOLES[k];
  for (const P of PROPS) {
    if (!P.at) continue;
    const [x, z] = Lk(...P.at); if (distLine(h.line, x, z) > 320) continue;
    out.push({ ...P, x, z, rot: (P.wrot || 0) - hd, label: P.hole === k || P.site ? (P.label || P.name || null) : null, base: null });
  }
  return out;
};
export const BUILT = OWN.map((O, k) => {
  const h = HOLES[k], Wk = WOR[k], base = O.base;
  const ground = (x, z) => worldAt(...Wk(x, z)).y - base;
  const surface = (x, z) => worldAt(...Wk(x, z)).s;
  const objs = objsFor(k);
  for (const o of objs) {
    const g = ground(o.x, o.z);
    o.base = o.sunk ? -base - 1.5 : o.kind === 'mast' && waterAt(...o.at) ? -base - 1 : g - (o.kind === 'hull' || o.kind === 'castle' ? 0.8 : 0.3);
  }
  const BOXY = ['inn', 'lugger', 'hull', 'castle', 'wall', 'rib'];
  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (Math.abs(x - o.x) > 40 || Math.abs(z - o.z) > 40) continue;
      if (BOXY.includes(o.kind)) { if (inBox(o, x, z)) out.push([o.base, o.base + o.h, o.kind === 'castle' ? 'the stern castle' : o.kind === 'hull' ? (o.wall ? 'the man-of-war' : 'the galleon') : o.kind === 'rib' ? 'a rib' : o.kind === 'wall' ? 'the yard wall' : o.kind === 'inn' ? 'the inn' : 'a lugger']); }
      else if (['mast', 'lantern', 'beacon', 'bell'].includes(o.kind)) { if (Math.hypot(x - o.x, z - o.z) < o.r) out.push([o.base, o.base + o.h, o.kind === 'beacon' ? 'the beacon' : 'a mast']); }
    }
    return out;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z), b = ground(x - d, z), c = ground(x, z + d), e = ground(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };
  return { h, ground, surface, own: O, objs, solids, gm: O.gm, fairwayD: O.fairwayD, inBunker: O.inBunker, bunkers: O.bunkers, teePads: O.teePads, base, baseAbs: O.baseAbs, along: O.along, slopeAt };
});
export { WL, LOC, WOR, PROF, FORMS, PROPS, STANDW, ZONES };
