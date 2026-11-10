// The Reclaim: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's
// own frame, plus the world transform and the city between the holes. Shared by the plans, the profiles and
// the sketch views, so they all show the same ground. Pure.
import { project, seDist, rectPts, inPoly, profileFn, smooth, clamp, at, lineOf, rnd, distLine } from './geo.mjs';
import { HOLES } from './holes.mjs';

export const SURF = ['street', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'rubble', 'stands', 'deck', 'building', 'void'];
// the river (world): one channel at one level, along the left of the Bridge, past Riverside's quay and the
// foot of the Rift, coming down the east side of town
const byN = n => HOLES.find(h => h.n === n);
const W_ = (n, s, off) => { const h = byN(n), p = at(h.line, s, off); return toWorld(h)(...p); };
export const RIVER = { y: -1, w: 150, pts: [[1300, -1150], [1230, -620], W_(7, -260, -175), W_(7, 0, -175), W_(7, 262, -175), W_(7, 420, -165), W_(7, 540, -150),
  W_(8, 60, -110), W_(8, 200, -150), W_(9, 40, -215), W_(9, 220, -270), [-900, 250]] };
const bump = e => e >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * e);

function fwLines(h) {
  return (h.fairway || []).map(([s0, s1, w, off = 0]) => {
    const pts = []; for (let s = s0; s <= s1 + 0.01; s += 4) pts.push(at(h.line, Math.min(s, s1), off));
    return { pts, w };
  });
}

export function buildHole(h) {
  const prof = profileFn(h.prof), F = fwLines(h), W = toWorld(h);
  const G = { x: h.pin[0], z: h.pin[1], rx: h.green.rx, rz: h.green.rz, rot: h.green.rot || 0 };
  const greenD = (x, z) => seDist(G, x, z);
  const bunkers = (h.bunkers || []).map(b => ({ x: b.at[0], z: b.at[1], rx: b.rx, rz: b.rz, rot: b.rot || 0 }));
  const waters = (h.water || []).map(w => ({ x: w.at[0], z: w.at[1], rx: w.rx, rz: w.rz, rot: w.rot || 0, p: w.p, y: w.y, rim: w.rim }));
  const rubble = (h.rubble || []).map(r => ({ x: r.at[0], z: r.at[1], rx: r.rx, rz: r.rz, rot: r.rot || 0, h: r.h || 0 }));
  const extra = (h.extraFw || []).map(e => ({ x: e.at[0], z: e.at[1], rx: e.rx, rz: e.rz, rot: e.rot || 0 }));
  const teePads = Object.entries(h.teePts).map(([k, p]) => ({ k, x: p[0], z: p[1], y: (h.teeY || {})[k] }));
  const foot = (h.buildings || []).map(b => rectPts(b.at[0], b.at[1], b.w, b.d, b.rot || 0));
  const rift = h.rift && { pts: h.rift.pts, w: h.rift.w };
  const inlet = h.inlet;
  const plat = (h.platform || []).map(p => ({ pts: rectPts(p.at[0], p.at[1], p.w, p.d, p.rot || 0), y: p.y }));
  const cantAt = s => { let g = 0; for (const [a, b, gr] of h.cant || []) g += gr * smooth((s - a) / 30) * (1 - smooth((s - b) / 30)); return g; };
  const st = h.stadium && { ...h.stadium, x: h.stadium.at[0], z: h.stadium.at[1] };

  function stadiumY(x, z) {   // pitch 0, stands rising in 3 m tiers to h, the street round the rim at h
    const e = seDist(st, x, z), out = (e - 1) * Math.min(st.rx, st.rz) * 1.25;
    if (out <= 0) return { y: 0, surf: null };
    const t = clamp(out / st.stand, 0, 1);
    const pr = project(h.line, x, z), inOpen = pr.s >= st.open.s[0] && pr.s <= st.open.s[1] && Math.abs(pr.off) < st.open.w;
    const raw = st.h * t, k = Math.floor(raw / 3), f = raw / 3 - k, tier = t >= 1 ? st.h : (k + smooth(f * 3)) * 3;
    // the collapsed middle of the south stand: a slope of rubble, blended into the tiers either side
    const wo = pr.s < st.open.s[1] + 10 ? 1 - smooth((Math.abs(pr.off) - st.open.w) / 14) : 0;
    if (wo > 0.5) return { y: tier * (1 - wo) + raw * wo, surf: t < 1 ? 'rubble' : null };
    if (t >= 1) return { y: st.h, surf: null };
    return { y: tier * (1 - wo) + raw * wo, surf: 'stands' };
  }

  function ground(x, z, raw = false) {
    if (!raw && rift && distLine(rift.pts, x, z) < rift.w / 2) return null;
    for (const p of plat) if (inPoly(p.pts, x, z)) return p.y;
    for (const t of teePads) if (t.y !== undefined && Math.abs(x - t.x) < 6 && Math.abs(z - t.z) < 5) return t.y;
    const pr = project(h.line, x, z);
    let y = prof(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -80, 80);
    if (st) y = stadiumY(x, z).y;
    if (h.crest) { const c = h.crest, e = Math.max(Math.abs(pr.s - project(h.line, c.at[0], c.at[1]).s) / (c.length / 2), Math.abs(pr.off) / (c.width / 2)); y += c.height * bump(e); }
    for (const r of rubble) if (r.h) y += r.h * bump(seDist(r, x, z));
    if (h.pit) {
      const p = h.pit, e = seDist({ x: p.at[0], z: p.at[1], rx: p.rx, rz: p.rz, rot: p.rot }, x, z);
      let dip = p.depth * smooth((1 - e) * Math.min(p.rx, p.rz) / p.bank);
      if (h.ramp) {   // the station stairs: a ramp down into the pit
        const R = h.ramp, dx = R.to[0] - R.from[0], dz = R.to[1] - R.from[1], l2 = dx * dx + dz * dz;
        const t = clamp(((x - R.from[0]) * dx + (z - R.from[1]) * dz) / l2, 0, 1), d = Math.hypot(x - R.from[0] - dx * t, z - R.from[1] - dz * t);
        if (d < R.w / 2) { const w = 1 - smooth((d - R.w / 2 + 6) / 6); dip = dip * (1 - w) + p.depth * smooth(t) * w; }
      }
      // punchbowl: the concourse floor rises a little toward the bank
      y -= dip; if (dip > p.depth - 0.5) y += 1.2 * smooth((e - 0.4) / 0.5);
    }
    if (inlet && distLine(inlet.pts, x, z) < inlet.w / 2) return inlet.y - h.base;
    for (const w of waters) if (seDist(w, x, z) < 1) return w.y;
    { const [X, Z] = W(x, z); if (distLine(RIVER.pts, X, Z) < RIVER.w / 2) return RIVER.y - h.base; }
    return y;
  }

  function surface(x, z) {
    if (rift && distLine(rift.pts, x, z) < rift.w / 2) return 'void';
    if (inlet && distLine(inlet.pts, x, z) < inlet.w / 2) return 'water';
    { const [X, Z] = W(x, z); if (distLine(RIVER.pts, X, Z) < RIVER.w / 2) return 'water'; }
    for (const w of waters) if (seDist(w, x, z) < 1) return 'water';
    for (const f of foot) if (inPoly(f, x, z)) return 'building';
    const gd = greenD(x, z);
    if (gd < 1) return 'green';
    if (gd < 1 + 3 / Math.min(G.rx, G.rz)) return 'fringe';
    for (const b of bunkers) if (seDist(b, x, z) < 1) return 'sand';
    for (const t of teePads) if (Math.abs(x - t.x) < 5 && Math.abs(z - t.z) < 4) return 'tee';
    for (const p of plat) if (inPoly(p.pts, x, z)) return 'deck';
    if (st) { const s = stadiumY(x, z); if (s.surf) return s.surf; }
    let fd = Infinity;
    for (const f of F) fd = Math.min(fd, distLine(f.pts, x, z) - f.w / 2);
    for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) - 1) * Math.min(e.rx, e.rz));
    if (fd < 0) return 'fairway';
    for (const r of rubble) if (seDist(r, x, z) < 1) return 'rubble';
    if (gd < 1 + 14 / Math.min(G.rx, G.rz)) return 'rough';
    if (fd < (h.corridor ?? 18)) return 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    if (st) return 'rough';
    return 'street';
  }

  // the solid and built things, in the hole's frame (y up from the hole's base)
  const objs = [];
  const gAt = (x, z) => ground(x, z) ?? 0;
  for (const [i, b] of (h.buildings || []).entries()) {
    const pts = foot[i], base = Math.min(...pts.map(p => gAt(p[0], p[1]))) - 1;
    objs.push({ kind: 'bldg', pts, base, h: b.h, broken: b.broken, open: b.open, cols: b.cols, lean: b.lean, tower: b.tower, vines: b.vines,
      name: b.name, label: b.label, rot: b.rot || 0, seed: 1000 * h.n + i, at: b.at, w: b.w, d: b.d });
  }
  for (const t of h.trees || []) objs.push({ kind: 'tree', x: t.x, z: t.z, r: t.r, h: t.h, base: gAt(t.x, t.z) });
  for (const w of h.wrecks || []) {
    const S = { car: [1.9, 4.6, 1.5], bus: [2.6, 12, 3.2], boat: [4, 11, 2.5] }[w.type];
    objs.push({ kind: 'box', pts: rectPts(w.at[0], w.at[1], S[0], S[1], w.rot), base: gAt(w.at[0], w.at[1]) - (w.type === 'boat' ? 1.2 : 0.1), h: S[2], color: w.type === 'boat' ? 'boat' : 'rust', label: w.type });
  }
  for (const e of h.el || []) objs.push({ kind: 'el', pts: e.pts, y: e.y, w: e.w, broken: e.broken, label: e.label });
  for (const p of h.platform || []) objs.push({ kind: 'slab', pts: rectPts(p.at[0], p.at[1], p.w, p.d, p.rot || 0), y: p.y, t: 1.2, legs: true, label: p.label });
  for (const r of h.roof || []) objs.push({ kind: 'slab', pts: rectPts(r.at[0], r.at[1], r.w, r.d, 0), y: r.y, t: r.t, label: r.label, ragged: true });
  for (const c of h.columns || []) objs.push({ kind: 'col', x: c.at[0], z: c.at[1], r: c.r, base: gAt(c.at[0], c.at[1]), h: c.h + (gAt(c.at[0], c.at[1]) < -5 ? 0 : 0) });
  for (const p of h.poles || []) objs.push({ kind: 'pole', x: p.at[0], z: p.at[1], base: gAt(p.at[0], p.at[1]), h: p.h, lean: p.lean });
  for (const c of h.cranes || []) objs.push({ kind: 'crane', x: c.at[0], z: c.at[1], base: gAt(c.at[0], c.at[1]), h: c.h });
  if (h.bridge) objs.push({ kind: 'bridge', a: h.bridge.a, b: h.bridge.b, base: -1 - h.base, h: h.bridge.h, label: h.bridge.label });
  if (h.span) objs.push({ kind: 'span', a: h.span.a, b: h.span.b, w: h.span.w, t: h.span.t, label: h.span.label });
  if (h.bridgeDeck) { const d = h.bridgeDeck; objs.push({ kind: 'span', a: [d.a[0], d.a[1], 1 - h.base], b: [d.b[0], d.b[1], 22 - h.base], w: d.w, t: 2, label: d.label, deck: true }); }
  if (h.marker) objs.push({ kind: 'marker', x: h.marker[0], z: h.marker[1], base: gAt(h.marker[0], h.marker[1]) });
  if (h.ramp && h.ramp.y) objs.push({ kind: 'ramp', from: h.ramp.from, to: h.ramp.to, w: h.ramp.w, y: h.ramp.y });

  // solid intervals over a point: what a ball at (x, z) could hit above the ground
  function solids(x, z) {
    const out = [];
    for (const o of objs) {
      if (o.kind === 'bldg' && inPoly(o.pts, x, z)) out.push([o.base + (o.open || 0), o.base + o.h, o.name || 'building']);
      if (o.kind === 'el' && distLine(o.pts, x, z) < o.w / 2) out.push([o.y - 1.2, o.y + 0.8, 'the El']);
      if (o.kind === 'slab' && inPoly(o.pts, x, z)) out.push([o.y - o.t, o.y, o.label || 'slab']);
      if (o.kind === 'span' && !o.deck) {
        const [ax, az, ay] = o.a, [bx, bz, by] = o.b, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
        const t = ((x - ax) * dx + (z - az) * dz) / l2, d = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(l2);
        if (t >= 0 && t <= 1 && d < o.w / 2) { const y = ay + (by - ay) * t; out.push([y - o.t / 2, y + o.t / 2, 'the span']); }
      }
    }
    return out;
  }
  return { h, ground, surface, objs, solids, greenD };
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
// a hole's plain scenery buildings give way to the next hole's play: none within 40 m of another hole's line
{
  const WL = HOLES.map(h => h.line.map(p => toWorld(h)(...p)));
  BUILT.forEach((B, i) => {
    const W = toWorld(HOLES[i]);
    const keep = B.objs.filter(o => {
      if (o.kind !== 'bldg' || o.name) return true;
      const pts = [...o.pts, o.at].map(p => W(...p));
      return !WL.some((L, k) => k !== i && pts.some(p => distLine(L, p[0], p[1]) < 40));
    });
    B.objs.splice(0, B.objs.length, ...keep);
  });
}

// the city between the holes: blocks of ruined buildings filling the gaps, off every hole's play (world)
export function cityFill() {
  const R = rnd(77), keep = [];
  const play = HOLES.map(h => { const W = toWorld(h); return { line: h.line.map(p => W(...p)), pin: W(...h.pin), h }; });
  const occupied = [];
  for (const [i, B] of BUILT.entries()) { const W = toWorld(HOLES[i]); for (const o of B.objs) if (o.kind === 'bldg') occupied.push(o.pts.map(p => W(...p))); }
  const riverD = (x, z) => distLine(RIVER.pts, x, z);
  for (let X = -900; X <= 1500; X += 46) for (let Z = -1400; Z <= 600; Z += 46) {
    if (R() < 0.18) continue;                       // a cross street or a lot gone back to trees
    const x = X + (R() - 0.5) * 10, z = Z + (R() - 0.5) * 10;
    if (riverD(x, z) < RIVER.w / 2 + 30) continue;
    let ok = true;
    for (const p of play) { if (distLine(p.line, x, z) < 95 || Math.hypot(x - p.pin[0], z - p.pin[1]) < 80) { ok = false; break; } }
    if (!ok) continue;
    const w = 26 + R() * 14, d = 26 + R() * 14, pts = rectPts(x, z, w, d, 0);
    if (occupied.some(o => o.some(q => inPoly(pts, q[0], q[1])) || pts.some(q => inPoly(o, q[0], q[1])))) continue;
    // nearer the middle of town the towers are taller
    const core = Math.exp(-Math.hypot(x - 450, z - 650 + 1250) / 700);
    const tall = R() < 0.12 ? 1.8 : 1;
    const hgt = Math.round((16 + R() * 40 + core * 90 * R()) * tall);
    const collapsed = R() < 0.08;
    // it stands on the nearest hole's ground
    let bi = 0, bd = Infinity; play.forEach((p, k) => { const d = distLine(p.line, x, z); if (d < bd) { bd = d; bi = k; } });
    const Lc = toLocal(HOLES[bi])(x, z), gy = BUILT[bi].ground(...Lc);
    const base = HOLES[bi].base + (gy ?? 0) - 1;
    keep.push({ kind: collapsed ? 'heap' : 'bldg', pts, base, h: collapsed ? 6 + R() * 6 : hgt, broken: R() < 0.75, vines: R() < 0.4, seed: Math.round(R() * 1e6), x, z, w, d });
  }
  return keep;
}
