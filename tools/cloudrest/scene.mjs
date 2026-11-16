// Cloudrest: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's own frame,
// plus the world transform and the ground between the holes. A hole's own ground follows the world (world.mjs V)
// along its line (with its `prof` knots, `cross` banks and the 8th's terrace), blending into the world further out
// and past its ends; greens, sand and tee pads sit on top. Then `worldAt` blends the holes' grounds, adds the walls and
// kerbs (world.mjs liftAt, after the blend so a wall stays sheer) and the water, and gives one surface. Over open air
// (the gorge, the cleft, below the mist) the ground is null and the surface 'void'. (After tools/eldergrove/scene.mjs.)
//
// Off the grass, outward: rough (mountain grass) round every fairway, green and tee; scrub (juniper and
// rhododendron: plays as rough) beyond; rock on wall faces and anything steep (native: it kicks); the kerb (rock and
// pines along every outer edge); tea (the 8th's rows of bushes: rough); paving (the 9th's courtyard: native).
import { seDist, seOutline, smooth, clamp, at, distLine, headingAt, lerp, project, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, noise2, noise1 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, wet, waterAt, liftAt, ridgeAt, roofOver, inGorge, inCleft, SITES, MIST, PINNACLES, NEEDLE, lineD, w, WLINES, tierAt } from './world.mjs';

export const SURF = ['rough', 'scrub', 'rock', 'kerb', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'tea', 'paving', 'void'];
const knAt = (K, s) => { if (s <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth((s - K[i][0]) / (K[i + 1][0] - K[i][0]))); return K.at(-1)[1]; };
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

// a green's contour in its own frame (as tools/eldergrove)
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

// the world along each line, 2 m steps from 80 m behind the tee to 120 m past the pin, open air filled in from the
// ground either side (the cleft, the gorge under the 4th), lightly smoothed, plus the hole's `prof` knots
const PROF = HOLES.map((h, k) => {
  const st = 2, s0 = -80, s1 = h.len + 120, n = Math.ceil((s1 - s0) / st) + 1, L0 = h.line;
  const sd = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], sl = Math.hypot(...sd), ed = [L0.at(-1)[0] - L0.at(-2)[0], L0.at(-1)[1] - L0.at(-2)[1]], el = Math.hypot(...ed);
  const pt = s => s < 0 ? [L0[0][0] + sd[0] / sl * s, L0[0][1] + sd[1] / sl * s] : s > h.len ? [L0.at(-1)[0] + ed[0] / el * (s - h.len), L0.at(-1)[1] + ed[1] / el * (s - h.len)] : at(L0, s);
  const K = h.prof || [[0, 0], [h.len, 0]], kn = s => { if (s <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) if (s <= K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], smooth((s - K[i][0]) / (K[i + 1][0] - K[i][0]))); return K.at(-1)[1]; };
  const y = []; for (let i = 0; i < n; i++) { const s = s0 + i * st; y.push(V(...WOR[k](...pt(s)))); }
  for (let i = 0; i < n; i++) if (y[i] === null) {   // open air on the line: carry the ground across it
    let a = i - 1, b = i + 1; while (a >= 0 && y[a] === null) a--; while (b < n && y[b] === null) b++;
    const ya = a >= 0 ? y[a] : null, yb = b < n ? y[b] : null; y[i] = ya !== null && yb !== null ? lerp(ya, yb, (i - a) / (b - a)) : ya ?? yb ?? MIST;
  }
  for (let i = 0; i < n; i++) if (y[i] === null) y[i] = MIST;
  const sm = y.map((_, i) => { let a = 0, c = 0; for (let j = -12; j <= 12; j++) { a += y[clamp(i + j, 0, n - 1)]; c++; } return a / c; });
  return { at: s => { const f = clamp((s - s0) / st, 0, n - 1), i = Math.floor(f), t = f - i; return lerp(sm[i], sm[Math.min(n - 1, i + 1)], t) + kn(s); }, raw: s => { const f = clamp((s - s0) / st, 0, n - 1), i = Math.round(f); return y[i] + kn(s); }, kn };
});
HOLES.forEach((h, k) => { h.base = h.flat === 0 ? V(...WOR[k](0, 0)) : PROF[k].at(0); });

export function buildHole(h) {
  const k = h.n - 1, Wh = WOR[k], PR = PROF[k];
  const endHead = headingAt(h.line, h.len - 1);
  const GR = makeGreen(h.pin, endHead, { seed: 70 + h.n, ...h.green });
  const gm = GR.gm, gUV = GR.uv;
  const fwD = makeFairway(h.line, h.fw || []);
  const bunkers = (h.bunkers || []).map((b, i) => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0, seed: 40 + i + h.n * 9, side: Math.hypot(b.at[0] - h.pin[0], b.at[1] - h.pin[1]) < 45, depth: 1.0 }));
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
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * span(s, a, b); return g; };
  const crossAt = (s, off) => { let g = 0; for (const [a, b, hh, ww, f = 0] of h.cross || []) { const t = Math.max(0, Math.abs(off) - f) / (ww - f); g += (hh > 0 ? hh * smooth(t) : -hh * (1 - smooth(t))) * span(s, a, b); } return g; };   // [s0, s1, h, w, flat half-width]
  // the 8th's terrace wall: the upper terrace (left of the wall's line) h metres over the lower
  const TR = h.terrace, trEdge = s => { const E = TR.e; if (s <= E[0][0]) return E[0][1]; for (let i = 0; i < E.length - 1; i++) if (s <= E[i + 1][0]) return lerp(E[i][1], E[i + 1][1], smooth((s - E[i][0]) / (E[i + 1][0] - E[i][0]))); return E.at(-1)[1]; };
  const terraceAt = (s, off) => TR ? TR.h * smooth((trEdge(s) - off) / TR.w + 0.5) * smooth((s - TR.s0 + 12) / 14) : 0;
  const lineExtra = (s, off) => crossAt(s, off) + terraceAt(s, off);
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1], lift: 0, back: 0 }));
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
  // the ground without greens, sand and pads (absolute): the line's height near it (with cant, banks and the terrace),
  // the world away from it and past its ends; null over open air
  function baseAbs(x, z) {
    const [X, Z] = Wh(x, z), v = V(X, Z); if (v === null) return null;
    const pr = along(x, z);
    // a hole whose ground is the world's own (flat: 0: the ridge, the Needle, the alcove, the tiers): the world, with
    // the hole's prof knots and banks along the line
    if (h.flat === 0) { let y = v + (PR.kn(pr.s) + lineExtra(pr.s, pr.off)) * (1 - smooth((Math.abs(pr.off) - 45) / 30));
      if (h.ceil) { const c = h.base + knAt(h.ceil, pr.s), k2 = 1 - smooth((Math.abs(pr.off) - 40) / 30); if (y > c) y = lerp(y, c, k2); }
      return wet(X, Z, y); }
    const kk = Math.max(smooth((Math.abs(pr.off) - (h.flat ?? 34)) / (h.fade ?? 40)), smooth((pr.s - h.len - (h.endFade ?? 36)) / 36), smooth((-pr.s - 40) / 34));
    const extra = lineExtra(pr.s, pr.off) * (1 - smooth((Math.abs(pr.off) - 80) / 30));
    if (kk >= 1) return wet(X, Z, v + extra);
    let line = PR.at(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -90, 90) + extra;
    if (h.ramp) line = lerp(PR.at(pr.s) - PR.kn(pr.s) + knAt(h.ramp.prof, pr.s), line, smooth((Math.abs(pr.off) - h.ramp.w) / 7));   // the 6th's neck: the face spread into a grass ramp near the line
    return wet(X, Z, lerp(line, v + extra, kk));
  }
  function base(x, z) {
    const b0 = baseAbs(x, z); if (b0 === null) return null;
    let y = b0 - h.base;
    const go = gm(x, z);
    if (go < 7 && h.green.contour) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(h.green.contour, u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // the green levelled to the pin's height before its contour (the collar blends it back over 9 m)
  const pinBase = (baseAbs(...h.pin) ?? PR.at(h.len)) - h.base;
  const level = (x, z, y) => {
    if (y === null) return null;
    const go = gm(x, z); if (go > 9) return y;
    const t = 1 - smooth((go + 1) / 10), raw = baseAbs(x, z); if (raw === null) return y;
    return y + (pinBase - (raw - h.base)) * t;
  };
  for (const t of teePads) t.y = (level(t.x, t.z, base(t.x, t.z)) ?? 0) + 0.25;
  const tipsPad = h.tipsPt ? { x: h.tipsPt[0], z: h.tipsPt[1], lift: 0, back: 0 } : null;
  if (tipsPad) tipsPad.y = (level(tipsPad.x, tipsPad.z, base(tipsPad.x, tipsPad.z)) ?? 0);

  function ownGround(x, z) {
    const [X, Z] = Wh(x, z);
    let y = level(x, z, base(x, z)); if (y === null) return null;
    const wa = waterAt(X, Z, y + h.base); if (wa && gm(x, z) > 2) return Math.min(y, wa.level - h.base);
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 12 && Math.abs(y - t.y) < 1.5) y = lerp(t.y, y, smooth((d - 6) / 6)); }
    if (tipsPad) { const d = Math.hypot(x - tipsPad.x, z - tipsPad.z); if (d < 16) y = lerp(tipsPad.y, y, smooth((d - 8) / 8)); }
    return y;
  }
  const slopeOwn = (x, z) => { const d = 1.5, a = ownGround(x + d, z), b = ownGround(x - d, z), c = ownGround(x, z + d), e = ownGround(x, z - d); if ([a, b, c, e].includes(null)) return 9; return Math.hypot(a - b, c - e) / (2 * d); };
  // the 9th's courtyard: the green's surround inside the walls, paved
  const inCourt = (X, Z) => h.n === 9 && Math.hypot(X - 408, Z + 588) < 34 && -Z < 620;

  function ownSurface(x, z) {
    const [X, Z] = Wh(x, z);
    const g0 = ownGround(x, z); if (g0 === null) return 'void';
    const go = gm(x, z);
    if (go < 0) return 'green';
    if (waterAt(X, Z, g0 + h.base)) return 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    if (go < (h.green.apron || 3)) return 'fringe';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    const lf = liftAt(X, Z); if (lf.face) return 'rock';
    if (lf.kerb) return 'kerb';
    const r = inGorge(X, Z) ? ridgeAt(X, Z) : null;
    if (r && (r.part === 'notch' || r.part === 'kerb')) return r.part === 'notch' ? 'rock' : 'kerb';
    const fd = fwD(x, z), sl = slopeOwn(x, z);
    if (fd < 0 && sl < (h.mown ?? 0.3)) return 'fairway';
    if (sl > 0.75) return 'rock';
    if (inCourt(X, Z)) return 'paving';
    if (go < 9 + 2 * noise2(x / 13, z / 13, 7) || fd < 8 + 3 * noise2(x / 17, z / 17, 8)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 12) return 'rough';
    if (tipsPad && Math.hypot(x - tipsPad.x, z - tipsPad.z) < 11) return 'rough';
    if (r && r.part === 'shelf') return 'rough';
    if (h.n === 8 && fd < 60) return 'tea';
    if (fd < 22 + 8 * noise2(x / 29, z / 29, 9)) return 'rough';
    return noise2(X / 31, Z / 31, 10) > 0.45 ? 'rock' : 'scrub';
  }
  return { h, ownGround, ownSurface, gm, fairwayD: fwD, inBunker, bunkers, teePads, base: h.base, baseAbs, along, tipsPad, edgeM, onPad };
}
const OWN = HOLES.map(buildHole);

// ---- the ground between the holes (world, absolute heights): { y (null over open air), s, k }
const TIPS_W = HOLES.map((h, k) => OWN[k].tipsPad ? [...WOR[k](OWN[k].tipsPad.x, OWN[k].tipsPad.z), OWN[k].tipsPad.y + OWN[k].base] : null).filter(Boolean);
export function worldAt(X, Z) {
  const v0 = V(X, Z);
  if (v0 === null) return { y: null, s: 'void', k: -1 };
  let best = -1, bd = Infinity;
  const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  const [lx, lz] = LOC[best](X, Z), own = OWN[best];
  let y;
  if (bd > 240) y = wet(X, Z, v0);
  else {
    let fw = 0, fy = 0;
    for (let k = 0; k < HOLES.length; k++) { if (near[k] > bd + 60) continue; const g = OWN[k].ownGround(...LOC[k](X, Z)); if (g === null) continue; const wk = Math.pow(1 - smooth((near[k] - bd) / 60), 2) / Math.pow(near[k] + 4, 2); fw += wk; fy += wk * (g + OWN[k].base); }
    y = fw > 0 ? fy / fw : wet(X, Z, v0);
    if (bd > 130) y = lerp(y, wet(X, Z, v0), smooth((bd - 130) / 110));
  }
  // a green or a tee pad belongs to its own hole: its own ground wins over the blend within 10 m of it
  for (let k = 0; k < HOLES.length; k++) {
    if (near[k] > 120) continue;
    const O = OWN[k], [qx, qz] = LOC[k](X, Z), go = O.gm(qx, qz);
    let t = go < 10 ? 1 - smooth((go + 1) / 11) : 0;
    for (const p of O.teePads) { const d = Math.hypot(qx - p.x, qz - p.z); if (d < 14 && (O.onPad(p, qx, qz) || Math.abs((O.baseAbs(qx, qz) ?? -1e9) - O.base - p.y) < 1.5)) t = Math.max(t, 1 - smooth((d - 7) / 7)); }
    if (t > 0) { const g = O.ownGround(qx, qz); if (g !== null) y = lerp(y, g + O.base, t); }
  }
  for (const [tx, tz, ty] of TIPS_W) { const d = Math.hypot(X - tx, Z - tz); if (d < 16) y = lerp(ty, y, smooth((d - 8) / 8)); }
  const lf = liftAt(X, Z); y += lf.y;
  let s = bd < 170 ? own.ownSurface(lx, lz) : (lf.face ? 'rock' : lf.kerb ? 'kerb' : noise2(X / 31, Z / 31, 10) > 0.45 ? 'rock' : 'scrub');
  if (s === 'void') s = 'scrub';
  if (['rough', 'scrub', 'rock', 'tea'].includes(s) && !lf.face) for (let k = 0; k < HOLES.length; k++) {
    if (k === best || near[k] > 150) continue;
    const o = OWN[k].ownSurface(...LOC[k](X, Z));
    if (['fairway', 'green', 'fringe', 'sand', 'tee'].includes(o)) { s = o; break; }
  }
  const wa = waterAt(X, Z, y); if (wa && s !== 'green') { s = 'water'; if (wa.body !== 'stream') y = Math.min(y, wa.level); }
  return { y, s, k: best, face: lf.face, kerb: lf.kerb };
}

// ---- pines: on the kerbs, the ledges and the pinnacles' tops (drawn; not yet in play), 26 m or more off every line
const hsh = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
export const PINES = [];
// the play behind each line's start (a back tee or tips set back of it, as the 9th's on its knoll) and the 9th's bold
// line straight at the green: pines keep off them too
const TEELINES = HOLES.flatMap((h, k) => { const W = WOR[k], o = [W(...h.tipsPt), W(...h.teePts.summit), W(...h.line[0])], L = [o]; if (h.boldPath) L.push([W(...h.teePts.summit), W(...h.boldPath)]); return L; });
{
  const S = 14;
  for (let i = Math.floor(-760 / S); i <= Math.ceil(940 / S); i++) for (let j = Math.floor(-1000 / S); j <= Math.ceil(700 / S); j++) {
    const X = (i + 0.1 + 0.8 * hsh(i, j)) * S, Z = (j + 0.1 + 0.8 * hsh(j + 5, i)) * S;
    if (lineD(X, Z) < 26 || TEELINES.some(L => distLine(L, X, Z) < 26)) continue;
    const r = hsh(i * 3.1, j * 1.7);
    if (inGorge(X, Z) || inCleft(X, Z)) { if (r > 0.45) continue; const v = V(X, Z); if (v === null || ridgeAt(X, Z)) continue; PINES.push({ X, Z, y: v, h: 8 + 7 * hsh(i + 2, j), r: 2.4 + 1.6 * hsh(j, i + 3) }); continue; }
    const lf = liftAt(X, Z); if (lf.face) continue;
    const want = lf.kerb ? 0.75 : 0.2; if (r > want) continue;
    const g = worldAt(X, Z); if (g.y === null || !['kerb', 'scrub', 'rock'].includes(g.s)) continue;
    PINES.push({ X, Z, y: g.y, h: 9 + 8 * hsh(i + 2, j), r: 2.6 + 1.8 * hsh(j, i + 3) });
  }
}

// ---- the built things as solid boxes (world), and each hole read through worldAt in its own frame
export const BOXES = SITES.filter(o => o.solid).map(o => ({ ...o, X: o.at[0], Z: o.at[1] }));
export const BUILT = OWN.map((O, k) => {
  const h = HOLES[k], Wk = WOR[k], Lk = LOC[k], base = O.base;
  const ground = (x, z) => { const v = worldAt(...Wk(x, z)); return v.y === null ? null : v.y - base; };
  const surface = (x, z) => worldAt(...Wk(x, z)).s;
  const near = (X, Z, r) => distLine(WL[k], X, Z) < r;
  const walls = BOXES.filter(o => near(o.X, o.Z, 360)).map(o => { const [x, z] = Lk(o.X, o.Z), g = worldAt(o.X, o.Z).y; return { ...o, x, z, rot: o.rot - HD[k], y: (g ?? MIST) - base }; });
  const pines = PINES.filter(t => near(t.X, t.Z, 420)).map(t => { const [x, z] = Lk(t.X, t.Z); return { ...t, x, z, y: t.y - base }; });
  const inBox = (o, x, z) => { const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), c = dx * Math.cos(o.rot) + dz * Math.sin(o.rot); return Math.abs(a) < o.l / 2 && Math.abs(c) < o.w / 2; };
  // solid intervals over a point: what a ball at (x, z) could hit above the ground (the built things)
  function solids(x, z) {
    const out = [];
    for (const o of walls) { if (Math.abs(x - o.x) > 60 || Math.abs(z - o.z) > 60) continue; if (inBox(o, x, z)) out.push([o.y - 0.5, o.y + o.h, o.name || o.kind]); }
    return out;
  }
  // the alcove's roof over (x, z), relative to the base, or null
  const roof = (x, z) => { const r = roofOver(...Wk(x, z)); return r === null ? null : r - base; };
  const slopeAt = (x, z) => { const d = 1.5, a = ground(x + d, z), b = ground(x - d, z), c = ground(x, z + d), e = ground(x, z - d); if ([a, b, c, e].includes(null)) return 9; return Math.hypot(a - b, c - e) / (2 * d); };
  return { h, ground, surface, own: O, walls, pines, solids, roof, inBox, gm: O.gm, fairwayD: O.fairwayD, inBunker: O.inBunker, bunkers: O.bunkers, teePads: O.teePads, base, baseAbs: O.baseAbs, along: O.along, slopeAt };
});
export { WL, LOC, WOR, PROF, HD };
