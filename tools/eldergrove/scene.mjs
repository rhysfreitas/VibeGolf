// Eldergrove: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own frame,
// plus the world transform and the ground between the holes. A hole's own ground follows the world's floor along its
// line (with its `prof` knots, cant and crossfall), blending into the world (world.mjs V) further out and past its
// ends; the shared shapes sit on top: forms, the fallen giant, the 9th's centre root, greens, sand and tee pads.
// Every hole's `ground` and `surface` are read through `worldAt`, which blends the holes' own grounds, so a point has
// one height and one surface for every hole that sees it. (After tools/wreckersreach/scene.mjs.)
//
// The trees: every giant trunk near the lines of play is placed in holes.mjs; the far forest is scattered here on a
// jittered grid, 78 m or more off every line and out of the meadow, the Glade and the pool. Each giant is a trunk
// (r 4-6 m, soak 0.45) under a crown from 60 to 100 m up (17 m across in radius), as the game's trees.js body.
//
// Off the grass, outward: moss (plays as first cut) round every fairway, green and tee; fern (rough) in drifts beyond
// it; leaf litter (beach: firm, it runs) on the open floor; root (native: it kicks) round the foot of every trunk,
// on the heart tree's buttresses, the 9th's roots and the fallen giant's flanks. In the meadow and the Glade:
// meadow grass (rough).
import { seDist, seOutline, smooth, clamp, at, distLine, headingAt, lerp, project, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, noise2, noise1 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, floorWorld, wet, waterAt, pitMound, dryK, brookAt, poolE, openAt, meadowAt, gladeAt, heartAt, fallenAt, HEART, SHELL, SITES, ROOTPLATE, lineD, w } from './world.mjs';

export const SURF = ['litter', 'fern', 'moss', 'fairway', 'fringe', 'green', 'tee', 'sand', 'root', 'meadow', 'water', 'bark', 'void'];
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

// ---- the forms every hole shares (banks, the 9th's amphitheatre and its root shoulder), gathered into world space
const FORMS = [];
for (const [k, h] of HOLES.entries()) {
  const Wk = WOR[k], hd = HD[k];
  for (const f of h.forms || []) {
    const lp = f.world ? h.L(...f.world) : f.at, rot = f.rot || 0;
    FORMS.push({ ...f, k, c: Wk(...lp), wrot: rot + hd, reach: Math.max(f.rx, f.rz) + 10 });
  }
}
const formLift = (f, X, Z) => {
  const e = seDist({ x: f.c[0], z: f.c[1], rx: f.rx, rz: f.rz, rot: f.wrot, p: f.p }, X, Z) + 0.06 * noise2(X / 14, Z / 14, 3);
  // a root is steep-sided (it stands up out of the floor); a bank is a soft swell
  return f.root ? f.h * (1 - smooth((e - 0.55) / 0.45)) : f.h * bump(e);
};
export function shapesAt(X, Z) {
  let y = 0, root = 0;
  for (const f of FORMS) { if (Math.abs(X - f.c[0]) > f.reach + 20 || Math.abs(Z - f.c[1]) > f.reach + 20) continue; const l = formLift(f, X, Z); y += l; if (f.root && l > 0.6) root = 1; }
  const fg = fallenAt(X, Z); y += fg.lift;
  return { y, root, fallen: fg };
}

// ---- the trees: the holes' placed trunks in world space, then the far forest
const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
export const TRUNKS = [];
for (const [k, h] of HOLES.entries()) for (const t of h.trunkPts) {
  const [X, Z] = WOR[k](t.x, t.z);
  TRUNKS.push({ X, Z, r: t.r, hole: k, job: t.job, placed: true, marker: !!t.marker, h: t.snag ? t.h : t.tall || 98 + 8 * hsh(X, Z), low: t.snag ? 0.99 : t.low || 0.6 + 0.04 * hsh(Z, X), cr: t.snag ? 0.4 : 16 + 4 * hsh(X + 3, Z), snag: !!t.snag });
}
// the heart tree (the 9th's landmark): a trunk 60 m across, its crown from 143 m up
TRUNKS.push({ X: HEART.c[0], Z: HEART.c[1], r: HEART.r, hole: 8, job: 'the heart tree', placed: true, heart: true, h: HEART.h, low: HEART.low, cr: HEART.cr });
// the vistas to the heart tree (the landmark): the far forest keeps clear of them, so it shows between the trunks
const wpt = (k, p) => WOR[k](...p);
export const VISTAS = [
  ['3 from the low road', wpt(2, HOLES[2].targets[0].at)], ['4 from round the shore (the reveal, across the pool)', wpt(3, HOLES[3].targets[0].at)],
  ['5 from the high side', wpt(4, HOLES[4].targets[0].at)], ['6 from the platform', wpt(5, HOLES[5].teePts.redwood)], ['7 from the tee', wpt(6, HOLES[6].teePts.redwood)],
  ['8 from the tee', wpt(7, HOLES[7].teePts.redwood)], ['9 from the tee', wpt(8, HOLES[8].teePts.redwood)]].map(([name, p]) => ({ name, p }));
const vistaD = (X, Z) => { let d = Infinity; for (const V_ of VISTAS) { const pr = project([V_.p, HEART.c], X, Z), L = Math.hypot(V_.p[0] - HEART.c[0], V_.p[1] - HEART.c[1]); if (pr.s > 30 && pr.s < L - HEART.r - 20) d = Math.min(d, pr.d); } return d; };
const FAR = [];
{
  const S = 34;
  for (let i = Math.floor(-1000 / S); i <= Math.ceil(900 / S); i++) for (let j = Math.floor(-800 / S); j <= Math.ceil(900 / S); j++) {
    const X = (i + 0.15 + 0.7 * hsh(i, j)) * S, Z = (j + 0.15 + 0.7 * hsh(j + 5, i)) * S;
    if (hsh(i * 3.1, j * 1.7) < 0.12) continue;   // a few gaps: the cathedral floor
    if (lineD(X, Z) < 78 || openAt(X, Z) > 0.2 || poolE(X, Z) < 1.4 || Math.hypot(X, Z) < 150) continue;
    if (Math.hypot(X - SHELL.c[0], Z - SHELL.c[1]) < 55 || fallenAt(X, Z).lift > 0 || Math.hypot(X - ROOTPLATE.c[0], Z - ROOTPLATE.c[1]) < 30) continue;
    const b = brookAt(X, Z); if (b && b.d < 8) continue;
    if (TRUNKS.some(t => Math.hypot(t.X - X, t.Z - Z) < 26 + t.r)) continue;
    if (vistaD(X, Z) < 18 + 2 * 3) continue;
    const r = 4 + 2 * hsh(i + 2, j + 9);
    FAR.push({ X, Z, r, far: true, h: 92 + 16 * hsh(X, Z), low: 0.58 + 0.06 * hsh(Z, X), cr: 15 + 5 * hsh(X + 3, Z) });
  }
}
export const ALLTREES = [...TRUNKS, ...FAR];
// a grid over the trees for quick lookups
const TG = new Map(), TCELL = 40, tkey = (i, j) => i * 100003 + j;
for (const t of ALLTREES) { const R = Math.max(t.r, t.cr) + 8; for (let i = Math.floor((t.X - R) / TCELL); i <= Math.floor((t.X + R) / TCELL); i++) for (let j = Math.floor((t.Z - R) / TCELL); j <= Math.floor((t.Z + R) / TCELL); j++) { const k = tkey(i, j); if (!TG.has(k)) TG.set(k, []); TG.get(k).push(t); } }
export const treesNear = (X, Z) => TG.get(tkey(Math.floor(X / TCELL), Math.floor(Z / TCELL))) || [];
// the foot of a trunk: { d (metres from the bark), t, root (0-1: on a buttress) }
function trunkFoot(X, Z) {
  let best = null;
  for (const t of treesNear(X, Z)) {
    const d = Math.hypot(X - t.X, Z - t.Z) - t.r;
    if (!best || d < best.d) best = { d, t };
  }
  if (!best) return null;
  const t = best.t, a = Math.atan2(Z - t.Z, X - t.X), n = t.heart ? 9 : 5 + Math.floor(hsh(t.X, t.Z) * 3);
  const lobe = Math.pow(Math.abs(Math.cos(a * n / 2 + hsh(t.Z, t.X) * 6)), 3);   // buttresses round the foot
  best.root = t.r < 3 ? 0 : best.d < (t.heart ? 10 : 2.5) + (t.heart ? 30 : 4.5) * lobe ? 1 : 0;   // a snag or the marker has no buttresses
  best.flare = best.d < 0 || t.r < 3 ? 0 : (t.heart ? 4 : 1.2) * lobe * (1 - smooth(best.d / (t.heart ? 40 : 6)));
  return best;
}
export { trunkFoot };

// a green's contour in its own frame (as tools/wreckersreach)
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

// the world's floor (with the heart tree's mound) along each line, 2 m steps from 80 m behind the tee to 120 m past
// the pin, lightly smoothed, plus the hole's `prof` knots
const rawV = (X, Z) => floorWorld(X, Z) + heartAt(X, Z).lift;
const PROF = HOLES.map((h, k) => {
  const st = 2, s0 = -80, s1 = h.len + 120, n = Math.ceil((s1 - s0) / st) + 1, L0 = h.line;
  const sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el = Math.hypot(...ed);
  const pt = s => s < 0 ? [L0[0][0] + sd[0] / sl * s, L0[0][1] + sd[1] / sl * s] : s > h.len ? [L0.at(-1)[0] + ed[0] / el * (s - h.len), L0.at(-1)[1] + ed[1] / el * (s - h.len)] : at(L0, s);
  const K = h.prof || [[0, 0], [h.len, 0]], kn = s => { if (s <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth((s - K[i][0]) / (K[i + 1][0] - K[i][0]))); return K.at(-1)[1]; };
  const y = []; for (let i = 0; i < n; i++) { const s = s0 + i * st; y.push(rawV(...WOR[k](...pt(s)))); }
  const sm = y.map((_, i) => { let a = 0, c = 0; for (let j = -12; j <= 12; j++) { a += y[clamp(i + j, 0, n - 1)]; c++; } return a / c; });   // 50 m: the line's height without the floor's small rolls
  return { at: s => { const f = clamp((s - s0) / st, 0, n - 1), i = Math.floor(f), t = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], t) + kn(s); } };
});
HOLES.forEach((h, k) => { h.base = PROF[k].at(0); });

export function buildHole(h) {
  const k = h.n - 1, Wh = WOR[k], PR = PROF[k];
  const endHead = headingAt(h.line, h.len - 1);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green });
  const gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  // sand hollows (the forest's old root pits): soft sand, a soft rim
  const bunkers = (h.bunkers || []).map((b, i) => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, side: Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45, depth: 0.9 }));
  const bunkerE = (b, x, z) => seDist(b, x, z) + 0.1 * noise2(x / 3, z / 3, b.seed);
  for (const b of bunkers) {   // a greenside one sits at least 2.5 m outside the green's edge
    if (!b.side) continue;
    const clear = () => Math.min(gm(b.x, b.z), ...seOutline({ ...b, rx: b.rx * 1.15, rz: b.rz * 1.15 }, 32).map(p => gm(...p)));
    let dx = b.x - h.pin[0], dz = b.z - h.pin[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    for (let i = 0; i < 120 && clear() < 2.5; i++) { b.x += dx * 0.5; b.z += dz * 0.5; }
  }
  const edgeM = (b, x, z) => (bunkerE(b, x, z) - 1) * Math.min(b.rx, b.rz);
  for (const b of bunkers) b.box = [b.x - b.rx * 1.5 - b.rz, b.z - b.rz * 1.5 - b.rx, b.x + b.rx * 1.5 + b.rz, b.z + b.rz * 1.5 + b.rx];
  const inBunker = b => (x, z) => x > b.box[0] && x < b.box[2] && z > b.box[1] && z < b.box[3] && edgeM(b, x, z) < 0;
  const fairwayD = fwD;
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  const crossAt = (s, off) => { let g = 0; for (const [a, b, hh, ww] of h.cross || []) g += (hh > 0 ? hh * smooth(Math.abs(off) / ww) : -hh * (1 - smooth(Math.abs(off) / ww))) * span(s, a, b); return g; };   // hh > 0 banks the sides up (a half-pipe), hh < 0 raises a spine down the line (a hog's back)
  // the 9th's centre root: a ridge h high and w wide along the line, steep sides (the ball drops at its foot)
  const rootAt = (s, off) => { const R = h.root; if (!R) return 0; return R.h * (1 - smooth((Math.abs(off) - R.w / 2) / 1.6)) * smooth((s - R.s0) / 8) * (1 - smooth((s - R.s1) / 8)); };
  const lineExtra = (s, off) => crossAt(s, off) + rootAt(s, off);
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  // a deck (a raised tee) runs on 8.5 m behind the ball and 3.5 m in front of it, so the drop shows from the tee
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1], lift: (h.teeY || {})[key] || 0, back: (h.teeY || {})[key] ? 2.5 : 0 }));
  const onPad = (t, x, z, m = 0) => { const [u, v] = [(x - t.x) * tc + (z - t.z) * ts, (x - t.x) * ts - (z - t.z) * tc]; return Math.abs(u) < 5 + m && Math.abs(v + (t.back || 0)) < 6 + m; };

  const L0 = h.line, sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl0 = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el0 = Math.hypot(...ed);
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
  // the ground without the shared shapes (absolute): the floor along the line near it (with the hole's cant and
  // crossfall), the world away from it and past its ends
  function baseAbs(x, z) {
    const pr = along(x, z), [X, Z] = Wh(x, z);
    const kk = Math.max(smooth((Math.abs(pr.off) - (h.flat ?? 34)) / (h.fade ?? 40)), smooth((pr.s - h.len - (h.endFade ?? 36)) / 36), smooth((-pr.s - 40) / 34));
    if (kk >= 1) return V(X, Z);
    const line = PR.at(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + lineExtra(pr.s, pr.off);
    return lerp(wet(X, Z, line), V(X, Z), kk);
  }
  // everything but water and tee pads, relative to the hole's base: the shared shapes, the green's contour, the sand
  // the forest's roll (world.mjs pitMound) as this hole has it: full in the fern and the litter, a third on the
  // fairway (soft swells), none on or round a green, a tee, the water, the fallen giant, the 9th's centre root
  const sightSegs = [];   // the shots' straight lines: every tee to every target, every target to the pin
  for (const tp of Object.values(h.teePts)) for (const tg of h.targets || []) sightSegs.push([tp, tg.at]);
  for (const tg of h.targets || []) sightSegs.push([tg.at, h.pin]);
  const segD = ([a, b], x, z) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const rollK = (x, z, X, Z, sh) => {
    if (sh.fallen.lift > 0.3 || sh.root) return 0;
    let k = dryK(X, Z); if (k <= 0) return 0;
    const go = gm(x, z); k *= smooth((go - 10) / 14);
    for (const t of teePads) k *= smooth((Math.hypot(x - t.x, z - t.z) - 10) / 10);
    if (h.tipsPt) k *= smooth((Math.hypot(x - h.tipsPt[0], z - h.tipsPt[1]) - 9) / 9);
    const fd = fwD(x, z); k *= 0.33 + 0.67 * smooth((fd + 2) / 10);
    { const pr = along(x, z); if (pr.s > -20 && pr.s < h.len + 10) k *= 0.33 + 0.67 * smooth((Math.abs(pr.off) - 22) / 14); }
    { let d = Infinity; for (const sg of sightSegs) d = Math.min(d, segD(sg, x, z)); k *= smooth((d - 8) / 14); }   // and the line of every shot stays clear in sight (none within 8 m of it)   // the playing corridor (the carry from the tee too) gets the fairway's soft swells, so a mound never hides a landing area
    if (h.root) { const pr = along(x, z); if (Math.abs(pr.off) < h.root.w / 2 + 4 && pr.s > h.root.s0 - 10 && pr.s < h.root.s1 + 10) k = 0; }
    return k * (1 - 0.5 * openAt(X, Z));
  };
  function base(x, z) {
    const [X, Z] = Wh(x, z), sh0 = shapesAt(X, Z);
    let y = baseAbs(x, z) - h.base + sh0.y;
    { const k = rollK(x, z, X, Z, sh0); if (k > 0) y += k * pitMound(X, Z); }
    const go = gm(x, z);
    if (go < 7 && h.green.contour) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(h.green.contour, u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green levelled to the pin's height before its contour (the collar blends it back over 9 m)
  const pinBase = (() => { const pr = along(...h.pin); return PR.at(pr.s) + lineExtra(pr.s, 0) - h.base + shapesAt(...Wh(...h.pin)).y; })();
  const level = (x, z, y) => {
    const go = gm(x, z); if (go > 9) return y;
    const t = 1 - smooth((go + 1) / 10);
    const raw = baseAbs(x, z) - h.base + shapesAt(...Wh(x, z)).y; return y + (pinBase - raw) * t;
  };
  for (const t of teePads) t.y = level(t.x, t.z, base(t.x, t.z)) + 0.4 + t.lift;
  const tipsPad = h.tipsPt ? { x: h.tipsPt[0], z: h.tipsPt[1], lift: h.tipsY || 0, back: h.tipsY ? 2.5 : 0 } : null;
  if (tipsPad) tipsPad.y = level(tipsPad.x, tipsPad.z, base(tipsPad.x, tipsPad.z)) + tipsPad.lift;

  // floor = true: the ground under a deck (a tee grown on a limb of the stair tree), for drawing round it
  function ownGround(x, z, floor = false) {
    const [X, Z] = Wh(x, z), wa = waterAt(X, Z);
    if (wa && gm(x, z) > 2) return wa.level - h.base;
    for (const t of teePads) if (onPad(t, x, z) && !(floor && t.lift)) return t.y;
    if (!floor && tipsPad && tipsPad.lift && onPad(tipsPad, x, z)) return tipsPad.y;
    let y = level(x, z, base(x, z));
    for (const t of teePads) { if (t.lift) continue; const d = Math.hypot(x - t.x, z - t.z); if (d < 12) y = lerp(t.y, y, smooth((d - 6) / 6)); }   // a platform stands sheer: no blend
    if (tipsPad && !tipsPad.lift) { const d = Math.hypot(x - tipsPad.x, z - tipsPad.z); if (d < 16) y = lerp(tipsPad.y, y, smooth((d - 8) / 8)); }
    return y;
  }
  const slopeOwn = (x, z) => { const d = 1.5, a = ownGround(x + d, z), b = ownGround(x - d, z), c = ownGround(x, z + d), e = ownGround(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };

  function ownSurface(x, z) {
    const [X, Z] = Wh(x, z);
    const go = gm(x, z);
    if (go < 0) return 'green';
    if (waterAt(X, Z)) return 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    if (tipsPad && tipsPad.lift && onPad(tipsPad, x, z)) return 'tee';
    const ft = trunkFoot(X, Z); if (ft && ft.d < 0) return 'bark';
    const sh = shapesAt(X, Z), fd = fairwayD(x, z);
    if (fd < 0 && slopeOwn(x, z) < (h.mown ?? 0.35) && !sh.root) return 'fairway';
    if (h.root) { const pr = along(x, z); if (Math.abs(pr.off) < h.root.w / 2 + 0.8 && pr.s > h.root.s0 - 3 && pr.s < h.root.s1 + 3) return 'root'; }
    if (sh.root) return 'root';
    if (sh.fallen.flank) return 'root';                         // the fallen giant's flanks: bark, it kicks
    if (sh.fallen.on) return 'moss';                            // its back beyond the mown high road
    if (ft && ft.root) return 'root';
    if (heartAt(X, Z).root > 0.45) return 'root';
    const open = openAt(X, Z);
    if (open > 0.5) return 'meadow';
    const mossW = (h.fern === 7 ? 0 : 5) + 2 * noise2(x / 17, z / 17, 8);
    if (go < 8 + 2 * noise2(x / 13, z / 13, 7) || fd < mossW) return 'moss';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 12) return 'moss';
    if (tipsPad && Math.hypot(x - tipsPad.x, z - tipsPad.z) < 11) return 'moss';
    const fernW = h.fern ?? (15 + 6 * noise2(x / 29, z / 29, 9));
    if (fd < mossW + fernW) return 'fern';
    if (fd < 70 && noise2(X / 23, Z / 23, 10) > 0.35) return 'fern';   // drifts of fern out on the floor
    return 'litter';
  }
  // the decks: each raised tee is the flat, mossy end of a limb grown out of the stair tree (Rhys, 15 November: "grown
  // out of the tree rather than a raised ground platform"). For the ball a deck is ground (its pad, 10 x 12 m, at the
  // tee's height); the limb that carries it, and the stair round the trunk, are drawn
  const decks = [...teePads.filter(t => t.lift), ...(tipsPad && tipsPad.lift ? [{ ...tipsPad, k: 'tips' }] : [])].map(t => {
    const cor = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a), e = 4;   // a rounded pad, a superellipse inside the 10 x 12 m the ball plays on
      const u = 5 * Math.sign(c) * Math.abs(c) ** (2 / e), v = 6 * Math.sign(sn) * Math.abs(sn) ** (2 / e) - t.back; cor.push([t.x + u * tc + v * ts, t.z + u * ts - v * tc]); }
    return { k: t.k, x: t.x - t.back * ts, z: t.z + t.back * tc, y: t.y, outline: cor };
  });
  const st = h.trunkPts.find(t => t.stair);
  const limbs = st ? decks.map(d => {
    const dx = d.x - st.x, dz = d.z - st.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    // from the bark, 7 m below the deck, rising out to the deck's middle (the last 5 m under the pad, flattening into it)
    return { from: [st.x + ux * st.r * 0.95, d.y - 7, st.z + uz * st.r * 0.95], knee: [st.x + ux * (st.r + (l - st.r) * 0.45), d.y - 3.2, st.z + uz * (st.r + (l - st.r) * 0.45)], to: [d.x, d.y - 1.2, d.z], r0: 2.6, r1: 1.7, k: d.k, reach: l - st.r };
  }) : [];
  const stair = st ? { x: st.x, z: st.z, r: st.r, top: Math.max(...decks.map(d => d.y)) } : null;
  return { h, ownGround, ownSurface, gm, fairwayD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, tipsPad, edgeM, onPad, decks, limbs, stair };
}
const OWN = HOLES.map(buildHole);

// ---- the ground between the holes (world, absolute heights)
const TIPS_W = HOLES.map((h, k) => OWN[k].tipsPad ? [...WOR[k](OWN[k].tipsPad.x, OWN[k].tipsPad.z), OWN[k].tipsPad.y + OWN[k].base, OWN[k].tipsPad.lift] : null).filter(Boolean);
export function worldAt(X, Z, floor = false) {
  let best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const wa = waterAt(X, Z);
  const [lx, lz] = LOC[best](X, Z), own = OWN[best];
  if (wa && !(bd < 60 && own.gm(lx, lz) < 2)) return { y: wa.level, s: 'water', k: best };
  let y;
  if (bd > 240) { const sh = shapesAt(X, Z); y = V(X, Z) + sh.y + (sh.fallen.lift > 0.3 ? 0 : dryK(X, Z) * pitMound(X, Z) * (1 - 0.5 * openAt(X, Z))); }
  else {
    let fw = 0, fy = 0;
    for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 60) continue; const wk = Math.pow(1 - smooth((near[k] - bd) / 60), 2) / Math.pow(near[k] + 4, 2); fw += wk; fy += wk * (OWN[k].ownGround(...LOC[k](X, Z), floor) + OWN[k].base); }
    y = fy / fw;
    if (bd > 130) { const sh = shapesAt(X, Z); y = lerp(y, V(X, Z) + sh.y + (sh.fallen.lift > 0.3 ? 0 : dryK(X, Z) * pitMound(X, Z) * (1 - 0.5 * openAt(X, Z))), smooth((bd - 130) / 110)); }
  }
  // a green or a tee pad belongs to its own hole: its own ground wins over the blend within 10 m of it
  let deck = false;
  for (let k = 0; k < HOLES.length; k++) {
    if (near[k] > 120) continue;
    const O = OWN[k], [qx, qz] = LOC[k](X, Z), go = O.gm(qx, qz);
    let t = go < 10 ? 1 - smooth((go + 1) / 11) : 0;
    for (const p of O.teePads) { const d = Math.hypot(qx - p.x, qz - p.z); if (p.lift ? d < 8 : d < 14) t = Math.max(t, p.lift ? (floor ? 0 : 1) : 1 - smooth((d - 7) / 7)); if (p.lift && O.onPad(p, qx, qz)) deck = true; }
    if (O.tipsPad && O.tipsPad.lift && O.onPad(O.tipsPad, qx, qz)) { deck = true; if (!floor) t = 1; }
    if (t > 0) y = lerp(y, O.ownGround(qx, qz, floor) + O.base, t);
  }
  for (const [tx, tz, ty, lift] of TIPS_W) { if (lift) continue; const d = Math.hypot(X - tx, Z - tz); if (d < 16) y = lerp(ty, y, smooth((d - 8) / 8)); }
  // the root flare at a trunk's foot
  const ft = trunkFoot(X, Z); if (ft && ft.d > 0) y += ft.flare;
  let s = bd < 160 ? own.ownSurface(lx, lz) : (ft && ft.d < 0 ? 'bark' : ft && ft.root ? 'root' : openAt(X, Z) > 0.5 ? 'meadow' : noise2(X / 23, Z / 23, 10) > 0.35 ? 'fern' : 'litter');
  if (['moss', 'fern', 'litter', 'meadow'].includes(s)) for (let k = 0; k < HOLES.length; k++) {
    if (k === best || near[k] > 150) continue;
    const o = OWN[k].ownSurface(...LOC[k](X, Z));
    if (['fairway', 'green', 'fringe', 'sand', 'tee'].includes(o)) { s = o; break; }
  }
  return { y, s, k: best, deck };
}
// the decks, their limbs and the stair in world space (absolute heights), for drawing from any hole
const wp3 = (k, p) => { const [X, Z] = WOR[k](p[0], p[2]); return [X, p[1] + OWN[k].base, Z]; };
export const DECKS = OWN.flatMap((O, k) => O.decks.map(d => ({ hole: k, k: d.k, y: d.y + O.base, at: WOR[k](d.x, d.z), outline: d.outline.map(q => WOR[k](...q)) })));
export const LIMBS = OWN.flatMap((O, k) => O.limbs.map(l => ({ hole: k, k: l.k, from: wp3(k, l.from), knee: wp3(k, l.knee), to: wp3(k, l.to), r0: l.r0, r1: l.r1, reach: l.reach })));
export const STAIRS = OWN.flatMap((O, k) => O.stair ? [{ hole: k, at: WOR[k](O.stair.x, O.stair.z), r: O.stair.r, top: O.stair.top + O.base, foot: worldAt(...WOR[k](O.stair.x, O.stair.z)).y }] : []);

// ---- each hole, read through worldAt in its own frame: ground (relative to its base), surface, the solids and
// the trees near it
const PLATE = SITES.find(s => s.kind === 'plate'), SHELLS = SITES.find(s => s.kind === 'shell');
function shellSegs() {   // the shell as 16 wall boxes round an arc (a gap toward the tee)
  const out = [], n = 16, c = SHELLS.at, gap = SHELLS.gap * Math.PI / 180, open = SHELLS.open * Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const a = open + gap / 2 + (i + 0.5) * (Math.PI * 2 - gap) / n, R = SHELLS.r + SHELLS.t / 2;   // compass bearing
    const X = c[0] + Math.sin(a) * R, Z = c[1] - Math.cos(a) * R, len = R * (Math.PI * 2 - gap) / n + 1;
    const hgt = SHELLS.h * (0.72 + 0.28 * Math.abs(Math.sin(i * 1.9 + 0.4))) * (i === 0 || i === n - 1 ? 0.62 : 1);   // a broken top, the ends lower
    out.push({ kind: 'wall', X, Z, w: SHELLS.t, l: len, h: hgt, rot: a + Math.PI / 2 });
  }
  return out;
}
export const WALLS = [{ kind: 'plate', X: PLATE.at[0], Z: PLATE.at[1], w: PLATE.r * 2, l: PLATE.t, h: PLATE.h, rot: PLATE.rot }, ...shellSegs()];
const inBoxW = (o, X, Z) => { const dx = X - o.X, dz = Z - o.Z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), c = dx * Math.cos(o.rot) + dz * Math.sin(o.rot); return Math.abs(a) < o.l / 2 && Math.abs(c) < o.w / 2; };
export const BUILT = OWN.map((O, k) => {
  const h = HOLES[k], Wk = WOR[k], Lk = LOC[k], base = O.base;
  const ground = (x, z) => worldAt(...Wk(x, z)).y - base;
  const surface = (x, z) => worldAt(...Wk(x, z)).s;
  // the trees near the hole, in its frame, as the game's tree bodies (trees.js: h, cr, low, tr; soak 0.45)
  const trees = ALLTREES.filter(t => distLine(WL[k], t.X, t.Z) < 330 || t.heart).map(t => { const [x, z] = Lk(t.X, t.Z); return { x, z, y: worldAt(t.X, t.Z + 0).y - base, X: t.X, Z: t.Z, r: t.r, h: t.h, low: t.low, cr: t.cr, heart: !!t.heart, snag: !!t.snag, marker: !!t.marker, placed: !!t.placed, hole: t.hole, job: t.job }; });
  for (const t of trees) { const g = ground(t.x, t.z + t.r + 1); if (g != null) t.y = Math.min(t.y, g); }
  const walls = WALLS.filter(o => distLine(WL[k], o.X, o.Z) < 330).map(o => { const [x, z] = Lk(o.X, o.Z); return { ...o, x, z, rot: o.rot - HD[k], y: worldAt(o.X, o.Z).y - base }; });
  const inBox = (o, x, z) => { const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), c = dx * Math.cos(o.rot) + dz * Math.sin(o.rot); return Math.abs(a) < o.l / 2 && Math.abs(c) < o.w / 2; };
  // solid intervals over a point: what a ball at (x, z) could hit above the ground (trunks to their crowns, walls)
  function solids(x, z) {
    const out = [];
    for (const t of trees) { if (Math.abs(x - t.x) > t.r + 1 || Math.abs(z - t.z) > t.r + 1) continue; if (Math.hypot(x - t.x, z - t.z) < t.r) out.push([t.y - 0.5, t.y + t.h * t.low, t.heart ? 'the heart tree' : t.snag ? 'the snag' : 'a trunk']); }
    for (const o of walls) { if (Math.abs(x - o.x) > 40 || Math.abs(z - o.z) > 40) continue; if (inBox(o, x, z)) out.push([o.y - 0.5, o.y + o.h, o.kind === 'plate' ? 'the root plate' : 'the shell\'s wall']); }
    return out;
  }
  // the crowns overhead: the height above (x, z) where a crown begins, or null
  function crownOver(x, z) {
    let lo = null;
    for (const t of trees) { const d = Math.hypot(x - t.x, z - t.z); if (d > t.cr) continue; const top = t.y + t.h, bot = t.y + t.h * t.low, cy = (top + bot) / 2, rv = (top - bot) / 2, e = 1 - (d / t.cr) ** 2; const y = cy - rv * Math.sqrt(Math.max(0, e)); lo = lo === null ? y : Math.min(lo, y); }
    return lo;
  }
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z), b = ground(x - d, z), c = ground(x, z + d), e = ground(x, z - d); return Math.hypot(a - b, c - e) / (2 * d); };
  return { h, ground, surface, own: O, trees, walls, solids, crownOver, gm: O.gm, fairwayD: O.fairwayD, inBunker: O.inBunker, bunkers: O.bunkers, teePads: O.teePads, base, baseAbs: O.baseAbs, along: O.along, slopeAt };
});
export { WL, LOC, WOR, PROF, FORMS, FAR };
