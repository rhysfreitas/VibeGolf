// The Reclaim: each hole's ground, surfaces and solid things from its plan data (holes.mjs), in the hole's
// own frame, plus the world transform and the city between the holes. Shared by the plans, the profiles and
// the sketch views, so they all show the same ground. Pure.
import { project, seDist, rectPts, inPoly, profileFn, smooth, clamp, at, lineOf, rnd, distLine, headingAt } from './geo.mjs';
import { HOLES } from './holes.mjs';

export const SURF = ['street', 'rough', 'fairway', 'fringe', 'green', 'tee', 'sand', 'water', 'rubble', 'stands', 'deck', 'building', 'void'];
// the river (world): one channel at one level, along the left of the Bridge, past Riverside's quay and the
// foot of the Rift, coming down the east side of town
const byN = n => HOLES.find(h => h.n === n);
const W_ = (n, s, off) => { const h = byN(n), p = at(h.line, s, off); return toWorld(h)(...p); };
export const RIVER = { y: -1, w: 150, pts: [[1300, -1150], [1230, -620], W_(7, -260, -175), W_(7, 0, -175), W_(7, 262, -175), W_(7, 420, -165), W_(7, 540, -150),
  W_(8, 60, -128), W_(8, 200, -155), W_(9, 40, -215), W_(9, 220, -270), [-900, 250]] };
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
  const sink = h.sinkhole && { x: h.sinkhole.at[0], z: h.sinkhole.at[1], rx: h.sinkhole.rx, rz: h.sinkhole.rz, rot: 0 };
  const inVoid = (x, z) => (rift && distLine(rift.pts, x, z) < rift.w / 2) || (sink && seDist(sink, x, z) < 1);
  const endHead = (() => { const n = h.line.length, a = h.line[n - 2], b = h.line[n - 1]; return Math.atan2(b[0] - a[0], -(b[1] - a[1])); })();
  // the pavilion floor under hole 4's green: a slab in the green's frame (v + toward the back)
  const pod = h.podium && { ...h.podium, c: Math.cos(endHead), s: Math.sin(endHead) };
  // buckled streets: quake rolls of a metre or so under everything, in world space so neighbours agree
  const rollAmp = h.rolls ?? 1;
  const rolls = (X, Z) => 0.55 * Math.sin(0.071 * X + 0.6) * Math.cos(0.052 * Z - 0.3) + 0.4 * Math.sin(0.043 * X - 0.061 * Z + 1.3) + 0.25 * Math.sin(0.12 * Z + 0.03 * X);
  const damaged = (x, z) => { if (!st || !st.damage) return false; const a = Math.atan2(x - st.x, -(z - st.z)) * 180 / Math.PI; return st.damage.some(([a0, a1]) => a >= a0 && a <= a1); };
  const lumps = (x, z) => 1.6 * Math.sin(x * 0.21 + Math.cos(z * 0.17) * 2) * Math.cos(z * 0.19 - x * 0.05) + 0.9 * Math.sin((x + z) * 0.37);

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
    // the stands the quake brought down: slumped into the bowl as lumpy rubble
    if (damaged(x, z)) { const sl = st.h * Math.pow(t, 1.35) + lumps(x, z) * smooth(t * 3) * (1 - t * 0.6); return { y: Math.max(0, sl), surf: 'rubble' }; }
    return { y: tier * (1 - wo) + raw * wo, surf: 'stands' };
  }

  function ground(x, z, raw = false) {
    if (!raw && inVoid(x, z)) return null;
    for (const p of plat) if (inPoly(p.pts, x, z)) return p.y;
    for (const t of teePads) if (t.y !== undefined && Math.abs(x - t.x) < 6 && Math.abs(z - t.z) < 5) return t.y;
    const pr = project(h.line, x, z);
    let y = prof(pr.s) - cantAt(pr.s) / 100 * clamp(pr.off, -80, 80);
    if (st) y = stadiumY(x, z).y;
    // the hole's own big landforms
    if (h.trench) {   // the subway caved in under the avenue: a trench with rubble banks
      const T = h.trench, along = smooth((pr.s - T.s0) / T.ramp) * (1 - smooth((pr.s - T.s1 + T.ramp) / T.ramp)), across = 1 - smooth((Math.abs(pr.off) - T.w / 2) / T.bank);
      y -= T.depth * along * across;
    }
    if (h.ridge) {    // the fallen tower's grassed rubble ridge across the line, low at one end
      const R = h.ridge, hh = R.low + (R.h - R.low) * smooth((pr.off - R.lowOff) / (R.fullOff - R.lowOff));
      y += hh * bump(Math.abs(pr.s - R.s) / (R.len / 2)) * (1 - smooth((Math.abs(pr.off) - 110) / 20));
    }
    if (h.slabEdge) { // the tipped slab's broken edge: a 5 m drop past the rough
      const E = h.slabEdge, on = smooth((pr.s - E.s0) / 8) * (1 - smooth((pr.s - E.s1) / 8));
      y -= E.drop * smooth((E.off - pr.off) / 2.5) * on;
    }
    if (pod) {        // the pavilion floor: a raised slab, broken steps up its front
      const dx = x - h.pin[0], dz = z - h.pin[1], u = dx * pod.c + dz * pod.s, v = dx * pod.s - dz * pod.c; // v + is past the pin
      // the slab runs from 30 m short of the pin (broken steps up its first 10 m: a false front) to 24 m past it
      const inSide = 1 - smooth((Math.abs(u) - pod.w / 2) / 1.2), back = 1 - smooth((v - 24) / 1.2), front = smooth((v + 30) / pod.front);
      y += pod.h * inSide * back * front;
    }
    if (h.greenTier) { // two tiers and rolls on the green, from the rubble behind it
      const g = h.greenTier, gd0 = greenD(x, z);
      if (gd0 < 1.5) { const w = 1 - smooth((gd0 - 1) / 0.5); y += (g.h * smooth((pr.s - g.s) / 5) + g.roll * Math.sin(x * 0.14 + 0.5) * Math.cos(z * 0.13)) * w; }
    }
    {   // buckled streets everywhere but greens, tees, decks and water
      const [X, Z] = W(x, z), gd0 = greenD(x, z);
      let m = rollAmp * smooth((gd0 - 1.2) / 0.6);
      for (const t of teePads) m *= smooth((Math.hypot(x - t.x, z - t.z) - 7) / 8);
      if (pod) { const dx = x - h.pin[0], dz = z - h.pin[1], u = dx * pod.c + dz * pod.s, v = dx * pod.s - dz * pod.c; if (Math.abs(u) < pod.w / 2 + 3 && v > -33 && v < 27) m = 0; }
      y += m * rolls(X, Z);
    }
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
    if (inVoid(x, z)) return 'void';
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
    if (h.ridge) { const R = h.ridge, pr = project(h.line, x, z); if (Math.abs(pr.s - R.s) < R.len * 0.32 && pr.off > R.lowOff + 12) return Math.abs(pr.off) < 45 ? 'rough' : 'rubble'; }
    if (fd < 0) return 'fairway';
    for (const r of rubble) if (seDist(r, x, z) < 1) return 'rubble';
    if (h.trench) { const T = h.trench, pr = project(h.line, x, z); if (pr.s > T.s0 - 4 && pr.s < T.s1 + 4 && Math.abs(Math.abs(pr.off) - T.w / 2 - T.bank / 2) < T.bank / 2 + 1) return 'rubble'; }
    if (h.slabEdge) { const E = h.slabEdge, pr = project(h.line, x, z); if (pr.s > E.s0 && pr.s < E.s1 && Math.abs(pr.off - E.off) < 2.5) return 'rubble'; }
    if (gd < 1 + 14 / Math.min(G.rx, G.rz)) return 'rough';
    // buckled streets: the asphalt shows through the rough in broken slabs
    const patch = () => { const [X, Z] = W(x, z); return Math.sin(X * 0.13 + Math.sin(Z * 0.07) * 2) * Math.cos(Z * 0.11 - X * 0.03) + 0.35 * Math.sin(X * 0.41 + Z * 0.37) > 0.68; };
    if (fd < (h.corridor ?? 18)) return fd > 4 && gd > 1.8 && !st && patch() ? 'street' : 'rough';
    for (const t of teePads) if (Math.hypot(x - t.x, z - t.z) < 14) return 'rough';
    if (st) return 'rough';
    return 'street';
  }

  const fwDist = (x, z) => { let fd = Infinity; for (const f of F) fd = Math.min(fd, distLine(f.pts, x, z) - f.w / 2); for (const e of extra) fd = Math.min(fd, (seDist(e, x, z) - 1) * Math.min(e.rx, e.rz)); return fd; };
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
    objs.push({ kind: 'box', pts: rectPts(w.at[0], w.at[1], S[0], S[1], w.rot), base: gAt(w.at[0], w.at[1]) - (w.type === 'boat' ? 1.2 : 0.1), h: S[2], color: w.type === 'boat' ? 'boat' : w.color || 'rust', car: w.type === 'car', moss: w.moss, label: w.type });
  }
  for (const e of h.el || []) objs.push({ kind: 'el', pts: e.pts, y: e.y, w: e.w, broken: e.broken, label: e.label });
  for (const p of h.platform || []) objs.push({ kind: 'slab', pts: rectPts(p.at[0], p.at[1], p.w, p.d, p.rot || 0), y: p.y, t: 1.2, legs: true, label: p.label });
  for (const r of h.roof || []) objs.push({ kind: 'slab', pts: rectPts(r.at[0], r.at[1], r.w, r.d, 0), y: r.y, t: r.t, label: r.label, ragged: true });
  for (const c of (h.columns || []).filter(c => c.at)) objs.push({ kind: 'col', x: c.at[0], z: c.at[1], r: c.r, base: gAt(c.at[0], c.at[1]), h: c.h + (gAt(c.at[0], c.at[1]) < -5 ? 0 : 0) });
  for (const p of h.poles || []) objs.push({ kind: 'pole', x: p.at[0], z: p.at[1], base: gAt(p.at[0], p.at[1]), h: p.h, lean: p.lean });
  for (const c of h.cranes || []) objs.push({ kind: 'crane', x: c.at[0], z: c.at[1], base: gAt(c.at[0], c.at[1]), h: c.h });
  if (h.bridge) objs.push({ kind: 'bridge', a: h.bridge.a, b: h.bridge.b, base: -1 - h.base, h: h.bridge.h, label: h.bridge.label });
  if (h.span) objs.push({ kind: 'span', a: h.span.a, b: h.span.b, w: h.span.w, t: h.span.t, label: h.span.label });
  if (h.bridgeDeck) { const d = h.bridgeDeck; objs.push({ kind: 'span', a: [d.a[0], d.a[1], 1 - h.base], b: [d.b[0], d.b[1], 22 - h.base], w: d.w, t: 2, label: d.label, deck: true }); }
  if (h.fallen) {
    const f = h.fallen, R = rnd(70 + h.n), [ax, az] = f.a, [bx, bz] = f.b, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
    const y0 = Math.min(gAt(ax, az), gAt(bx, bz)) - 2, end = 34;     // the last 34 m is the broken top end
    const ex = bx - ux * end, ez = bz - uz * end;
    objs.push({ kind: 'span', a: [ax, az, y0 + f.h / 2], b: [ex, ez, y0 + f.h / 2], w: f.w, t: f.h, label: f.label, fallen: true });
    // the torn end: each floor a slice of what is left, ragged, smaller and lower toward the break
    for (let k = 0; k < 8; k++) {
      const t0 = 4 * k + R() * 1.2, t1 = t0 + 3.2 + R() * 1.5, fade = 1 - k / 9;
      const wk = f.w * (0.35 + 0.55 * R()) * fade, hk = f.h * (0.25 + 0.6 * R()) * fade, o = (R() - 0.5) * (f.w - wk);
      const yk = gAt(ex + ux * t0, ez + uz * t0) - 1 + hk / 2;
      objs.push({ kind: 'span', a: [ex + ux * t0 + nx * o, ez + uz * t0 + nz * o, yk + (R() - 0.5) * 2], b: [ex + ux * t1 + nx * o, ez + uz * t1 + nz * o, yk + (R() - 0.5) * 3], w: wk, t: hk, deck: true, label: '', torn: true });
    }
    // chunks of the building sticking out of the grass that is taking the ridge back, and twisted girders
    const rg = h.ridge;
    for (let k = 0; k < 130; k++) {
      // half heaped round the broken end, half strewn along the ridge across the hole
      let cx, cz;
      if (k % 2 === 0) { const a = R() * Math.PI * 2, d = 4 + Math.pow(R(), 0.8) * 40; cx = bx - ux * 8 + Math.cos(a) * d; cz = bz - uz * 8 + Math.sin(a) * d * 0.7; }
      else { const p = at(h.line, rg.s + (R() - 0.5) * rg.len * 0.9, rg.lowOff + R() * (90 - rg.lowOff)); cx = p[0]; cz = p[1]; }
      if (fwDist(cx, cz) < -6 && R() < 0.6) continue;
      const sz = 1.5 + Math.pow(R(), 1.8) * 7, th = 0.8 + R() * 2.4, yaw = R() * Math.PI, c2 = Math.cos(yaw) * sz / 2, s2 = Math.sin(yaw) * sz / 2;
      const g0 = gAt(cx, cz), tilt = (R() - 0.3) * sz * 0.9;
      if (R() < 0.18) objs.push({ kind: 'span', a: [cx, cz, g0 - 1], b: [cx + c2 * 0.4, cz + s2 * 0.4, g0 + 4 + R() * 6], w: 0.5, t: 0.5, deck: true, label: '', girder: true });
      else objs.push({ kind: 'span', a: [cx - c2, cz - s2, g0 - th * 0.3], b: [cx + c2, cz + s2, g0 - th * 0.3 + tilt], w: sz * (0.4 + R() * 0.5), t: th, deck: true, label: '', rubble: true });
    }
  }
  for (const c of h.chunks || []) objs.push({ kind: 'span', a: [c.a[0], c.a[1], gAt(c.a[0], c.a[1]) + c.a[2] - 6], b: [c.b[0], c.b[1], gAt(c.b[0], c.b[1]) + c.b[2] - 6], w: c.w, t: c.t, deck: true, label: '' });
  if (h.podium) for (const c of h.columns || []) if (c.rel) {
    const [u, v] = c.rel, cs = Math.cos(endHead), sn = Math.sin(endHead), x = h.pin[0] + u * cs + v * sn, z = h.pin[1] + u * sn - v * cs;
    objs.push({ kind: 'col', x, z, r: c.r, base: gAt(x, z), h: c.h });
  }
  {   // reclamation: street trees and great trees through the rough and the streets, rows of stopped cars and cabs
    const R = rnd(500 + h.n), xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]);
    const bx0 = Math.min(...xs) - 110, bx1 = Math.max(...xs) + 110, bz0 = Math.min(...zs) - 110, bz1 = Math.max(...zs) + 110;
    const trees = objs.filter(o => o.kind === 'tree'), cars = objs.filter(o => o.kind === 'box');
    const far = (x, z, L, d) => L.every(o => Math.hypot((o.x ?? o.pts[0][0]) - x, (o.z ?? o.pts[0][1]) - z) > d);
    const offTee = (x, z) => teePads.every(t => Math.hypot(x - t.x, z - t.z) > 16) && greenD(x, z) > 1 + 14 / Math.min(G.rx, G.rz);
    let nT = h.scatter?.trees ?? 34, nC = h.scatter?.cars ?? 9;
    const playLine = [h.teePts.spire, ...(h.targets || []).filter(t => !t.pin).map(t => t.at), h.pin];
    for (let i = 0; i < 6000 && (nT > 0 || nC > 0); i++) {
      const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0), sf = surface(x, z), fd = fwDist(x, z);
      if (!['rough', 'street', 'rubble'].includes(sf) || ground(x, z) === null || !offTee(x, z) || fd > 75) continue;
      // trees keep off the lines of play: tee to each target to the green, as the game's scattered trees do
      if (nT > 0 && fd > 7 && far(x, z, trees, 9) && distLine(h.line, x, z) > 30 && distLine(playLine, x, z) > 24) {
        const big = R() < 0.12;
        const t = { kind: 'tree', x, z, r: big ? 8 + R() * 5 : 3 + R() * 3.5, h: big ? 22 + R() * 10 : 8 + R() * 9, base: gAt(x, z), wild: true };
        objs.push(t); trees.push(t); nT--; continue;
      }
      if (nC > 0 && sf !== 'rubble' && fd > 5 && far(x, z, cars, 25)) {
        const pr = project(h.line, x, z), yaw = headingAt(h.line, pr.s) + (R() - 0.5) * 0.5, n = 1 + Math.floor(R() * 3);
        for (let k = 0; k < n; k++) {
          const cx = x + Math.sin(yaw) * k * 6.5 + (R() - 0.5) * 1.5, cz = z - Math.cos(yaw) * k * 6.5 + (R() - 0.5) * 1.5;
          if (fwDist(cx, cz) < 4 || ground(cx, cz) === null || !['rough', 'street'].includes(surface(cx, cz))) continue;
          const col = ['cab', 'cab', 'cab', 'rust', 'green', 'white'][Math.floor(R() * 6)], yw = yaw + (R() - 0.5) * 0.6;
          const c = { kind: 'box', pts: rectPts(cx, cz, 1.9, 4.6, yw), base: gAt(cx, cz) - 0.15, h: 1.5, color: col, car: true, moss: R() < 0.55, label: 'car' };
          objs.push(c); cars.push(c);
        }
        nC--;
      }
    }
  }
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
      if ([...o.pts, o.at].some(p => B.surface(...p) === 'water')) return false;
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
    if ([[x, z], ...pts].some(p => BUILT[bi].surface(...toLocal(HOLES[bi])(...p)) === 'water')) continue;
    const base = HOLES[bi].base + (gy ?? 0) - 1;
    keep.push({ kind: collapsed ? 'heap' : 'bldg', pts, base, h: collapsed ? 6 + R() * 6 : hgt, broken: R() < 0.75, vines: R() < 0.4, seed: Math.round(R() * 1e6), x, z, w, d });
  }
  return keep;
}
