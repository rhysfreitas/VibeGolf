// The Buried Kingdom: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's
// own frame, plus the world transform and the ground between the holes. A hole's ground is its own line's profile
// near the line (drawn with `prof`, with its cant, crown, table and deck), blending into the world (world.mjs V)
// further out and past its ends, with the hole's shapes on top: forms, its green complex, bunkers and tee pads.
// Sand in three bands: rough round the grass, then firm sand ('firm': plays as the game's waste area), and soft
// sand ('sand': a bunker lie) only in bunkers and the Sand Sea. Shared by the plans, profiles, sketches and
// checks. Pure. (After tools/lostvalley/scene.mjs.)
import { seDist, seOutline, smooth, clamp, at, distLine, headingAt, lerp } from './geo.mjs';
import { makeGreen, makeFairway, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, cutAt, standAt, waterAt, nativeAt, softAt, wallAt, SITES } from './world.mjs';

export const SURF = ['firm', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'rock', 'stone', 'field', 'void'];
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

// the line's profile: `prof` knots [[s, y], ...] from the tee (y 0 = the tee's height, taken from the world)
// through a monotone cubic (level where the knots level off or turn, no overshoot), lightly smoothed
const PROF = HOLES.map((h, k) => {
  const st = 2, K = h.prof, s1 = Math.max(h.len, K.at(-1)[0]), n = Math.ceil(s1 / st) + 1, y = [], y0 = V(...WOR[k](0, 0), true);
  const m = K.length, d = K.slice(0, -1).map(([sa, ya], j) => (K[j + 1][1] - ya) / (K[j + 1][0] - sa));
  const t = K.map((_, j) => j === 0 ? d[0] : j === m - 1 ? d[m - 2] : d[j - 1] * d[j] <= 0 ? 0 : 2 / (1 / d[j - 1] + 1 / d[j]));
  t[0] = t[m - 1] = 0;
  for (let i = 0; i < n; i++) { const s = Math.min(i * st, K.at(-1)[0]); let j = 0; while (j < m - 2 && s > K[j + 1][0]) j++;
    const [sa, ya] = K[j], [sb, yb] = K[j + 1], hh = sb - sa, u = clamp((s - sa) / hh, 0, 1), u2 = u * u, u3 = u2 * u;
    y[i] = y0 + (2 * u3 - 3 * u2 + 1) * ya + (u3 - 2 * u2 + u) * hh * t[j] + (-2 * u3 + 3 * u2) * yb + (u3 - u2) * hh * t[j + 1]; }
  const sm = y.map((_, i) => { let s = 0, c = 0; for (let j = -2; j <= 2; j++) { s += y[clamp(i + j, 0, n - 1)]; c++; } return s / c; });
  return { st, y: sm, at: s => { const f = clamp(s / st, 0, n - 1), i = Math.floor(f), tt = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], tt); } };
});
HOLES.forEach((h, k) => { h.base = PROF[k].at(0); });

// forms (mounds, banks) shared through world space, each asked about a world point in its own hole's frame
const FORMS = [];
for (const [k, h] of HOLES.entries()) for (const f of h.forms || []) FORMS.push({ k, ...f, x: f.at[0], z: f.at[1], rot: f.rot || 0, reach: Math.max(f.rx, f.rz) + 10 });
for (const f of FORMS) f.c = WOR[f.k](f.x, f.z);
const formLift = (f, x, z) => f.h * bump(seDist(f, x, z) + 0.06 * noise2(x / 14, z / 14, 3));
function shapesAt(X, Z) {
  let y = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; y += formLift(f, ...LOC[f.k](X, Z)); }
  return y;
}

// a green's contour, in its own frame (u right, v toward the back, metres from the pin). Directions are degrees
// clockwise from the front: 0 = toward the tee, 90 = right, 180 = the back. (As tools/lostvalley.)
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

export function buildHole(h) {
  const k = h.n - 1, W = WOR[k], PR = PROF[k];
  const endHead = headingAt(h.line, h.len - 1);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green }), gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // soft sand in every bunker (the lie "Dune"); a pot is small, sunk and steep
  const bunkers = (h.bunkers || []).map((b, i) => {
    const side = Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45;
    return { x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, kind: 'sand', side, job: b.job, pot: !!b.pot, depth: b.depth ?? (b.pot ? 1.2 : side ? 0.8 : 0.9) }; });
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.13 * noise2(x / 4, z / 4, b.seed);
  for (const b of bunkers) {   // a greenside bunker sits at least 2.5 m outside the green's edge
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
  // across the line: `cross` [[s0, s1, h, w]] raises the sides (h > 0: a half-pipe) or lowers them (h < 0: crowned,
  // a hog's back), full height w metres off the line; `table` { s0, s1, L, R, h, face } lifts a level top h metres
  // between s0..s1 along the line and L..R across it, its banks `face` metres wide
  const crossAt = (s, off) => { let g = 0; for (const [a, b, hh, w] of h.cross || []) g += hh * smooth(Math.abs(off) / w) * span(s, a, b); return g; };
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
    const w = 0.5 + 0.5 * smooth((c[1].d - c[0].d) / 14);
    return { d: c[0].d, s: c[0].s * w + c[1].s * (1 - w), off: c[0].off * w + c[1].off * (1 - w) };
  };
  const along = (x, z) => {
    const pr = blendS(x, z);
    if (pr.s >= h.len - 0.5) pr.s = h.len + ((x - L0.at(-1)[0]) * ed[0] + (z - L0.at(-1)[1]) * ed[1]) / el0;
    else if (pr.s <= 0.5) pr.s = ((x - L0[0][0]) * sd[0] + (z - L0[0][1]) * sd[1]) / sl0;
    return pr;
  };
  // the ground without the shared shapes (absolute): the line's profile near the line, the world away from it and
  // past the hole's ends (behind the tee, beyond the green), with the world's cuts and standing things on top
  function baseAbs(x, z) {
    const pr = along(x, z), [X, Z] = W(x, z);
    const kk = Math.max(smooth((Math.abs(pr.off) - (h.flat ?? 30)) / (h.fade ?? 36)), smooth((pr.s - h.len - (h.endFade ?? 34)) / 34), smooth((-pr.s - 40) / 34));
    if (kk >= 1) return V(X, Z);
    let line = PR.at(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + lineExtra(pr.s, pr.off);
    if (h.deck) {   // a raised deck: outside the fairway's edge the ground drops, a kerb along the edge
      const D = h.deck, fd = fwD(x, z), on = smooth((pr.s - D.from) / 40) * (1 - smooth((pr.s - (h.len - 46)) / 26));
      line += on * (D.kerb * Math.exp(-((fd / 1.3) ** 2)) - D.h * smooth((fd - 0.6) / D.bank));
    }
    return cutAt(X, Z, lerp(line, V(X, Z, true), kk) + standAt(X, Z));
  }
  // everything but water and tee pads, relative to the hole's base
  function base(x, z) {
    let y = baseAbs(x, z) - h.base + shapesAt(...W(x, z));
    const go = gm(x, z), Gd = h.green;
    if (Gd.raise) y += Gd.raise * (1 - smooth((go - 2) / 8));
    if (go < 7 && Gd.contour) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(Gd.contour, u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + (b.pot ? 0.8 : 2)) / (b.pot ? 0.9 : 2.3))) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green's own surface is levelled to the pin's height before its contour (the collar blends it back over 9 m)
  const pinBase = (() => { const pr = along(...h.pin); return PR.at(pr.s) + lineExtra(pr.s, 0) - h.base + shapesAt(...W(...h.pin)); })();
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

  // the solid and built things, in the hole's frame (y up from the hole's base); made before surface() so the
  // stone under them reads as stone
  const objs = [];
  const gAt = (x, z) => ground(x, z);
  if (h.gate) { const G = h.gate; for (const sg of [-1, 1]) { const [x, z] = at(h.line, G.s, sg * G.off); objs.push({ kind: 'tower', x, z, w: G.w, l: G.l, h: G.h, rot: headingAt(h.line, G.s), base: gAt(x, z) - 0.5, label: sg < 0 ? (G.label || 'the gate') : null }); } }
  if (h.obelisk) { const O = h.obelisk, n = 3, gap = 5, pl = (O.s1 - O.s0 - gap * (n - 1)) / n;   // a fallen obelisk in three pieces along the line
    for (let i = 0; i < n; i++) { const s = O.s0 + i * (pl + gap) + pl / 2, [x, z] = at(h.line, s, (i - 1) * 1.4); objs.push({ kind: 'obelisk', x, z, w: O.t * (1 - i * 0.14), l: pl, h: O.t * (1 - i * 0.14), rot: headingAt(h.line, s) + (i - 1) * 0.09, base: gAt(x, z) - 0.6, label: i === 1 ? 'the fallen obelisk' : null }); } }
  // the world's built things near this hole (the Sphinx's head, the colossi, the temples, the camp)
  const hd = h.place.heading * Math.PI / 180;
  for (const S of SITES) {
    if (!S.at) continue;
    const [x, z] = LOC[k](...S.at); if (distLine(h.line, x, z) > 260) continue;
    objs.push({ kind: S.kind, site: true, x, z, w: S.w, l: S.l, h: S.h, rot: S.rot - hd, awning: S.awning, base: null, label: null });
  }
  const BOXY = ['tower', 'obelisk', 'box', 'head', 'colossus', 'tent'];

  function surface(x, z) {
    const [X, Z] = W(x, z);
    const go = gm(x, z);
    if (go < 0) return 'green';
    if (waterAt(X, Z)) return 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    if (softAt(X, Z)) return 'sand';
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    for (const o of objs) if ((o.kind === 'tower' || o.kind === 'obelisk') && inBox(o, x, z)) return 'stone';
    if (standAt(X, Z) > 0.5) return 'stone';
    for (const f of h.forms || []) if (f.stone && seDist({ ...f, x: f.at[0], z: f.at[1] }, x, z) < 0.8) return 'stone';   // the Sphinx's paws
    const sl = slopeAt(x, z), fd = fairwayD(x, z);
    if (fd < 0 && sl < (h.mown ?? 0.35)) return 'fairway';
    if (sl > 0.85) return 'rock';
    const nat = nativeAt(X, Z);
    if (nat === 'rock') return sl > 0.4 ? 'rock' : 'firm';
    if (nat === 'stone') return 'stone';
    // the first band: rough, 8-15 m round the fairway and the green, and round the tees
    if (go < 13 + 2 * noise2(x / 21, z / 21, 9)) return 'rough';
    if (fd < (h.corridor ?? 11) + 3.2 * noise2(x / 33, z / 33, 8)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 13) return 'rough';
    return nat;   // firm sand, or the fields by the river
  }

  const notInPlay = ['fairway', 'green', 'fringe', 'tee', 'sand', 'water'];
  const surfaceOk = p => !notInPlay.includes(surface(...p));
  for (const b of h.boulders || []) if (surfaceOk(b.at)) objs.push({ kind: 'boulder', x: b.at[0], z: b.at[1], r: b.r, h: b.h, base: gAt(...b.at) - b.h * 0.25 });
  for (const t of h.trees || []) if (surfaceOk([t.x, t.z]) && distLine(h.line, t.x, t.z) > t.r + 9) objs.push({ kind: t.kind, x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  for (const o of objs) if (o.base === null) o.base = (o.kind === 'head' ? gAt(...h.pin) + 25 - o.h : gAt(o.x, o.z) - 0.4);   // the Sphinx's head: its top 25 m over the green

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'boulder') { if (Math.hypot(x - o.x, z - o.z) < o.r * 0.8) out.push([o.base, o.base + o.h, 'a boulder']); }
      else if (o.kind === 'palm') { const d = Math.hypot(x - o.x, z - o.z); if (d < o.r) out.push([o.base + o.h * 0.74, o.base + o.h, 'a palm']); else if (d < 0.35) out.push([o.base, o.base + o.h, 'a palm\'s trunk']); }
      else if (BOXY.includes(o.kind) && o.kind !== 'tent' && inBox(o, x, z)) out.push([o.base, o.base + o.h, o.kind === 'tower' ? 'a gate tower' : o.kind === 'obelisk' ? 'the obelisk' : o.kind === 'head' ? 'the Sphinx' : o.kind === 'colossus' ? 'a colossus' : 'a wall']);
    }
    return out;
  }
  return { h, ground, surface, objs, solids, gm, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, slopeAt };
}

export const BUILT = HOLES.map(buildHole);

// the ground between the holes (world, absolute heights): each hole's own ground near its line, blended into its
// neighbours' further out and into the world beyond
export function worldAt(X, Z) {
  let best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const wa = waterAt(X, Z);
  const [lx, lz] = LOC[best](X, Z), own = BUILT[best];
  if (wa && !(bd < 60 && own.gm(lx, lz) < 2)) return { y: wa.level, s: 'water', k: best };
  let y;
  if (bd > 240) y = V(X, Z) + shapesAt(X, Z);
  else {
    let fw = 0, fy = 0;
    for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 60) continue; const wk = Math.pow(1 - smooth((near[k] - bd) / 60), 2) / Math.pow(near[k] + 4, 2); fw += wk; fy += wk * (BUILT[k].ground(...LOC[k](X, Z)) + BUILT[k].base); }
    y = fy / fw;
    if (bd > 130) y = lerp(y, V(X, Z) + shapesAt(X, Z), smooth((bd - 130) / 110));
  }
  const s = bd < 150 ? own.surface(lx, lz) : (() => {
    if (softAt(X, Z)) return 'sand';
    const d = 1.5, sl = Math.hypot(V(X + d, Z) - V(X - d, Z), V(X, Z + d) - V(X, Z - d)) / (2 * d), nat = nativeAt(X, Z);
    if (nat === 'stone') return 'stone';
    if (sl > 0.85 || (nat === 'rock' && sl > 0.4)) return 'rock';
    return nat === 'rock' ? 'firm' : nat;
  })();
  return { y, s, k: best };
}
export { WL, LOC, WOR, PROF, wallAt };
