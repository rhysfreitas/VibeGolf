// Emerald Bay: each hole's ground and surfaces from its plan data (holes.mjs), in the hole's own frame, at a tide.
// The ground is the world's own (world.mjs V: the islands are shaped round their holes there); a hole adds its green
// (levelled to the pin's height, with its contour), its bunkers and its tee pads on top. The tide decides the surface:
// ground below the sea is water; intertidal sand above it is firm wet sand. `worldAt(X, Z, tide)` gives one ground and
// one surface for any point: a hole's own features win near them, the nearest hole's surfaces elsewhere.
//
// Surfaces, outward from the grass: rough (a band round every fairway, green and tee; salt-grass rough on the bars);
// jungle (the islands' floor under the palms: plays as rough); dry sand (beaches above high water: Rhys's pick, the
// game's 'waste'); wet sand (intertidal sand when the tide is out: the game's 'beach', firm, it runs); bunkers (soft
// sand: 'sand'); rock (cliffs and anything steep: native, it kicks; a ball that flies into a face may drop at its foot,
// COURSE.wallSoak); water (a stroke and a drop).
import { seDist, seOutline, smooth, clamp, at, distLine, headingAt, lerp, project, lengthOf } from './geo.mjs';
import { makeGreen, makeFairway, noise2 } from './shapes.mjs';
import { HOLES } from './holes.mjs';
import { V, TIDES, roofAt, WLINES, lineD } from './world.mjs';

export const SURF = ['rough', 'jungle', 'rock', 'fairway', 'fringe', 'green', 'tee', 'sand', 'drysand', 'wetsand', 'water', 'void'];
// what each plays as in the game's physics
export const PHYS = { fairway: 'fairway', fringe: 'fairway', tee: 'fairway', green: 'green', rough: 'rough', jungle: 'rough', rock: 'desert', sand: 'sand', drysand: 'waste', wetsand: 'beach', water: 'water', void: 'water' };

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

// a green's contour in its own frame (as tools/cloudrest)
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
const tagAt = (X, Z) => V(X, Z);

export function buildHole(h) {
  const k = h.n - 1, Wh = WOR[k];
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
  const teeHead = headingAt(h.line, 1), tc = Math.cos(teeHead), ts = Math.sin(teeHead);
  const teePads = Object.entries(h.teePts).map(([key, p]) => ({ k: key, x: p[0], z: p[1] }));
  const onPad = (t, x, z, m = 0) => { const u = (x - t.x) * tc + (z - t.z) * ts, v = (x - t.x) * ts - (z - t.z) * tc; return Math.abs(u) < 5 + m && Math.abs(v) < 6 + m; };
  const base = V(...Wh(...h.teePts.marlin)).y + 0.3;

  const raw = (x, z) => V(...Wh(x, z)).y - base;
  // the green levelled to the pin's height, its contour on top; the collar blends back over 9 m
  const pinY = raw(...h.pin);
  function shaped(x, z) {
    let y = raw(x, z);
    const go = gm(x, z);
    if (go < 9) { const t = 1 - smooth((go + 1) / 10); y = lerp(y, pinY, t); }
    if (go < 7 && h.green.contour) { const fade = 1 - smooth((go - 0.5) / 6), [u, v] = gUV(x, z); y += contourAt(h.green.contour, u, v) * fade; }
    for (const b of bunkers) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const e = edgeM(b, x, z); if (e < 0.5) y -= b.depth * (1 - smooth((e + 2) / 2.3)) * smooth((go - 0.5) / 1.5); }
    return y;
  }
  // tee pads: level, 0.3 m over the highest ground under them
  for (const t of teePads) { let m = -Infinity; for (const u of [-5, 0, 5]) for (const v of [-6, 0, 6]) m = Math.max(m, shaped(t.x + u * tc - v * ts, t.z + u * ts + v * tc)); t.y = m + 0.3 + ((h.teeLift || {})[t.k] || 0); }   // teeLift: a raised pad (the 4th's back tees, to see over the first cove)
  const tipsPad = h.tipsPt ? { x: h.tipsPt[0], z: h.tipsPt[1] } : null;
  if (tipsPad) { let m = -Infinity; for (const u of [-5, 0, 5]) for (const v of [-6, 0, 6]) m = Math.max(m, shaped(tipsPad.x + u * tc - v * ts, tipsPad.z + u * ts + v * tc)); tipsPad.y = m + 0.2; }
  function ground(x, z) {
    for (const t of teePads) if (onPad(t, x, z)) return t.y;
    let y = shaped(x, z);
    for (const t of teePads) { const d = Math.hypot(x - t.x, z - t.z); if (d < 14 && Math.abs(y - t.y) < 3.5) y = lerp(t.y, y, smooth((d - 7) / 7)); }
    if (tipsPad) { const d = Math.hypot(x - tipsPad.x, z - tipsPad.z); if (d < 16 && Math.abs(y - tipsPad.y) < 3) y = lerp(tipsPad.y, y, smooth((d - 8) / 8)); }
    return y;
  }
  // a feature of this hole at (x, z): its green and collar, a bunker, a tee pad (these win over another hole's ground)
  const feature = (x, z) => gm(x, z) < 9 || bunkers.some(b => inBunker(b)(x, z)) || teePads.some(t => Math.hypot(x - t.x, z - t.z) < 12) || (tipsPad && Math.hypot(x - tipsPad.x, z - tipsPad.z) < 12);
  const slopeAt = (x, z) => { const d = 1.5; return Math.hypot(ground(x + d, z) - ground(x - d, z), ground(x, z + d) - ground(x, z - d)) / (2 * d); };
  // the surface at a tide
  function surface(x, z, tide = 'low') {
    const [X, Z] = Wh(x, z), v = tagAt(X, Z), sea = TIDES[tide] - base, y = ground(x, z), go = gm(x, z);
    if (go < 0) return 'green';
    for (const t of teePads) if (onPad(t, x, z)) return 'tee';
    if (y < sea) return 'water';
    for (const b of bunkers) if (inBunker(b)(x, z)) return 'sand';
    if (go < (h.green.apron || 3)) return 'fringe';
    if (v.t === 'karst' || slopeAt(x, z) > 0.75) return 'rock';
    if (v.cave) return 'drysand';
    const fd = fwD(x, z);
    if (fd < 0 && v.t !== 'sea' && !(h.keepBeach && v.t === 'sand')) return 'fairway';   // keepBeach: a beach stays a beach where the fairway runs down to it (the 4th's cove heads)
    if (v.t === 'sand') return 'drysand';
    if (v.t === 'wet' || v.t === 'sea') return 'wetsand';
    if (v.t === 'grass' || v.t === 'rough') return 'rough';
    if (go < 10 + 2 * noise2(x / 13, z / 13, 7) || fd < 9 + 4 * noise2(x / 17, z / 17, 8)) return 'rough';
    { const pr = project(h.line, x, z); if (pr.s > 0 && pr.s < h.len && Math.abs(pr.off) < 20 + 4 * noise2(x / 21, z / 21, 9)) return 'rough'; }   // a corridor of rough down the line (tee to fairway, between pieces)
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 12) return 'rough';
    if (tipsPad && Math.hypot(x - tipsPad.x, z - tipsPad.z) < 11) return 'rough';
    return 'jungle';
  }
  const roof = (x, z) => { const r = roofAt(...Wh(x, z)); return r === null ? null : r - base; };
  return { h, ground, surface, feature, gm, uv: gUV, fairwayD: fwD, inBunker, bunkers, teePads, tipsPad, base, slopeAt, roof, onPad, edgeM };
}
const OWN = HOLES.map(buildHole);

// ---- the ground and the surface anywhere (world, absolute heights)
export function worldAt(X, Z, tide = 'low') {
  let best = -1, bd = Infinity; const near = [];
  for (let k = 0; k < HOLES.length; k++) { const d = distLine(WL[k], X, Z); near.push(d); if (d < bd) { bd = d; best = k; } }
  // a hole's own green, bunkers and tees win over the nearest hole's ground
  let k = best;
  for (let j = 0; j < HOLES.length; j++) { if (near[j] > 160) continue; const [x, z] = LOC[j](X, Z); if (OWN[j].feature(x, z)) { k = j; break; } }
  const O = OWN[k], [x, z] = LOC[k](X, Z);
  if (bd > 260) {
    const v = V(X, Z), sea = TIDES[tide];
    const s = v.y < sea ? 'water' : v.t === 'karst' ? 'rock' : v.t === 'sand' ? 'drysand' : (v.t === 'wet' || v.t === 'sea') ? 'wetsand' : v.t === 'jungle' ? 'jungle' : 'rough';
    return { y: Math.max(v.y, v.y < sea ? v.y : v.y), s, k: -1, sea };
  }
  return { y: O.ground(x, z) + O.base, s: O.surface(x, z, tide), k, sea: TIDES[tide] };
}

// ---- each hole read through worldAt in its own frame, at a tide
export function built(k, tide = 'low') {
  const O = OWN[k], h = HOLES[k], Wk = WOR[k], base = O.base, sea = TIDES[tide] - base;
  const ground = (x, z) => worldAt(...Wk(x, z), tide).y - base;
  const surface = (x, z) => worldAt(...Wk(x, z), tide).s;
  // what the ball meets: the ground, or the water's top where it is under the sea
  const playGround = (x, z) => { const g = ground(x, z); return g < sea ? sea : g; };
  const slopeAt = (x, z) => { const d = 1.5; return Math.hypot(ground(x + d, z) - ground(x - d, z), ground(x, z + d) - ground(x, z - d)) / (2 * d); };
  return { h, tide, sea, ground, playGround, surface, own: O, solids: () => [], roof: O.roof, gm: O.gm, fairwayD: O.fairwayD, inBunker: O.inBunker, bunkers: O.bunkers, teePads: O.teePads, tipsPad: O.tipsPad, base, slopeAt, walls: [], pines: [] };
}
export { WL, LOC, WOR, HD, OWN };
// the plain BUILT list the review tools read (relief, alike, spread): each hole at low tide
export const BUILT = HOLES.map((h, k) => built(k, 'low'));
