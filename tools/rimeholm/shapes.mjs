// Shapes for Rimeholm round 2 (pure): greens built from lobes, fairways with two edges that vary along the
// hole, jagged crevasses and scarps with a raised lip, and a marching-squares outline for drawing any of them.
import { project, lengthOf, at, clamp, smooth, lerp } from './geo.mjs';

// value noise, 1D and 2D, in [-1, 1]
const h1 = (i, s) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
const h2 = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 269.5 + s * 113.3) * 43758.5453; return (v - Math.floor(v)) * 2 - 1; };
export function noise1(t, seed = 0) {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return lerp(h1(i, seed), h1(i + 1, seed), u) * 0.7 + lerp(h1(i * 2 + 7, seed), h1(i * 2 + 8, seed), u) * 0.3;
}
export function noise2(x, z, seed = 0) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(h2(i, j, seed), h2(i + 1, j, seed), u), lerp(h2(i, j + 1, seed), h2(i + 1, j + 1, seed), u), v);
}
const hash = (a, b) => (h1(a * 3.1 + b, b) + 1) / 2;
// polynomial smooth minimum: a union of two distances with the join filled k metres
const smin = (a, b, k) => { const t = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, t) - k * t * (1 - t); };

// A green from lobes in the green's frame (u right of the hole's last leg, v past the pin; the pin at 0, 0).
// lobes: [u, v, rx (across), rz (along), rot (degrees, + turns the long axis to the right)]. Returns gm(x, z):
// metres outside the edge (negative inside), with soft joins between lobes and an uneven edge.
export function makeGreen(pin, head, spec) {
  const ec = Math.cos(head), es = Math.sin(head), seed = spec.seed || 1, wob = spec.wob ?? 1.8, k = spec.join ?? 5;
  const uv = (x, z) => { const dx = x - pin[0], dz = z - pin[1]; return [dx * ec + dz * es, dx * es - dz * ec]; };
  const L = spec.lobes.map(([u, v, rx, rz, rot = 0]) => ({ u, v, rx, rz, c: Math.cos(rot * Math.PI / 180), s: Math.sin(rot * Math.PI / 180), m: Math.min(rx, rz) }));
  const gm = (x, z) => {
    const [u, v] = uv(x, z);
    let d = Infinity;
    for (const o of L) {
      const du = u - o.u, dv = v - o.v, a = du * o.c - dv * o.s, b = du * o.s + dv * o.c;
      const e = Math.hypot(a / o.rx, b / o.rz), di = (e - 1) * o.m;
      d = d === Infinity ? di : smin(d, di, k);
    }
    return d + wob * noise2(x / 7, z / 7, seed);
  };
  return { gm, uv };
}

// A fairway from pieces along the playing line. Each piece: { e: [[s, L, R], ...], wob, seed } where L and R
// are how far the left and right edges sit from the line (a negative L puts the left edge right of the line).
// Edges ease between the knots, wobble (scallops of about `wob` metres) and round off at the ends.
// Returns fd(x, z): metres outside the nearest piece (negative inside).
export function makeFairway(line, pieces) {
  const P = pieces.map((p, i) => ({ e: p.e, wob: p.wob ?? 3, seed: p.seed ?? 11 + i * 7, s0: p.e[0][0], s1: p.e.at(-1)[0] }));
  const knot = (e, s, k) => {
    if (s <= e[0][0]) return e[0][k];
    for (let i = 0; i < e.length - 1; i++) if (s <= e[i + 1][0]) return lerp(e[i][k], e[i + 1][k], smooth((s - e[i][0]) / (e[i + 1][0] - e[i][0])));
    return e.at(-1)[k];
  };
  const len = lengthOf(line);
  return (x, z) => {
    const pr = project(line, x, z);
    let s = pr.s, off = pr.off;
    // past the ends of the line, carry on straight
    if (s >= len - 0.01 || s <= 0.01) {
      const a = s <= 0.01 ? line[0] : line.at(-2), b = s <= 0.01 ? line[1] : line.at(-1), dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
      const base = s <= 0.01 ? line[0] : line.at(-1), t = ((x - base[0]) * dx + (z - base[1]) * dz) / l;
      s = (s <= 0.01 ? 0 : len) + t; off = (dx * (z - base[1]) - dz * (x - base[0])) / l;
    }
    let best = Infinity;
    for (const p of P) {
      const ss = clamp(s, p.s0, p.s1);
      const Lw = knot(p.e, ss, 1) + p.wob * (0.75 * noise1(ss / 27, p.seed) + 0.45 * noise1(ss / 8.5, p.seed + 1)), Rw = knot(p.e, ss, 2) + p.wob * (0.75 * noise1(ss / 25, p.seed + 3) + 0.45 * noise1(ss / 9, p.seed + 4));
      const m = (Rw - Lw) / 2; let hw = (Rw + Lw) / 2;
      const c = Math.min(16, (p.s1 - p.s0) / 3);
      const into = Math.min(ss - p.s0, p.s1 - ss);
      if (into < c) hw *= Math.sqrt(Math.max(0, 1 - ((c - into) / c) ** 2));
      const lat = Math.abs(off - m) - hw, beyond = Math.abs(s - ss);
      const d = beyond > 0 ? Math.hypot(beyond, Math.max(0, lat)) : lat;
      if (d < best) best = d;
    }
    return best;
  };
}

// A crevasse (or, with open: false, a scarp): a jagged slit along pts that tapers to a point at each end,
// with an optional lip: the ground on one side raised h metres for `run`, falling away over `fall`.
// spec: { pts, w, jag, lip: { h, toward: [x, z] | side, run, fall, face }, open, seed, depth }
export function makeCrack(spec) {
  const pts = spec.pts, len = lengthOf(pts), seed = spec.seed ?? 1, open = spec.open !== false;
  const w = spec.w ?? 0, jag = spec.jag ?? (open ? Math.min(3, 0.3 * w + 0.8) : 4);
  const lip = spec.lip ? { run: 6, fall: 6, face: 2, end: 30, ...spec.lip } : null;
  if (lip) lip.side = lip.side ?? Math.sign(project(pts, ...lip.toward).off || 1);
  const lens = s => Math.pow(Math.max(0, Math.sin(Math.PI * clamp(s / len, 0, 1))), 0.45);
  const per = [6 + 6 * hash(seed, 1), 6 + 6 * hash(seed, 2)], ph = [hash(seed, 3) * 12, hash(seed, 4) * 12];
  const zig = (s, k) => { const t = ((s + ph[k]) / per[k]) % 1, tri = Math.abs(t * 2 - 1) * 2 - 1; return 0.55 * tri + 0.45 * noise1(s / 8, seed * 5 + k); };
  const hw = (s, k) => Math.max(0, lens(s) * (w / 2 + jag * zig(s, k) * 0.9));   // k 0: left, 1: right
  const pad = w + jag + (lip ? lip.run + lip.fall + lip.end : 4) + 4;
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const box = [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad];
  const inBox = (x, z) => x > box[0] && x < box[2] && z > box[1] && z < box[3];
  // metres outside the slit (negative inside), and which side
  // past an end: how far beyond it along the end segment (ab) and the offset from that segment's line
  const d0 = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]], d1 = [pts.at(-1)[0] - pts.at(-2)[0], pts.at(-1)[1] - pts.at(-2)[1]];
  const l0 = Math.hypot(...d0), l1 = Math.hypot(...d1);
  function edge(x, z) {
    const pr = project(pts, x, z), ends = pr.s <= 0.01 || pr.s >= len - 0.01;
    let ab = 0;
    if (ends) {
      const st = pr.s <= 0.01, e = st ? pts[0] : pts.at(-1), dv = st ? d0 : d1, l = st ? l0 : l1;
      ab = Math.max(0, ((x - e[0]) * dv[0] + (z - e[1]) * dv[1]) / l);
      // the offset from the end segment's own line, + right of the crack's direction of travel
      const tv = st ? [-dv[0], -dv[1]] : dv; pr.off = (tv[0] * (z - e[1]) - tv[1] * (x - e[0])) / l;
    }
    if (!open) return { d: Math.abs(pr.off), off: pr.off, s: pr.s, ends, ab };
    const k = pr.off < 0 ? 0 : 1, d = ends ? Math.hypot(ab, pr.off) : Math.abs(pr.off) - hw(pr.s, k);
    return { d, off: pr.off, s: pr.s, ends, ab };
  }
  const voidD = (x, z) => (!open || !inBox(x, z)) ? Infinity : edge(x, z).d;
  function lift(x, z) {
    if (!lip || !inBox(x, z)) return 0;
    const E = edge(x, z);
    let side, e;
    if (open) { side = Math.sign(E.off) === lip.side; e = Math.max(0, E.d); }
    else { const sh = jag * zig(E.s, 0) * Math.min(1, lens(E.s) * 3); e = lip.side * E.off - sh; side = e > 0; }
    if (E.ends) { // past an end the step carries on, softening and dying away over lip.end
      const soft = smooth((lip.side * E.off) / (1 + E.ab * 0.6) + 0.5), rise = 1;
      return lip.h * soft * rise * (1 - smooth(E.ab / lip.end)) * (1 - smooth((Math.abs(E.off) - lip.run) / lip.fall));
    }
    if (!side) return 0;
    const endF = 1;
    const rise = open ? 1 : smooth(e / lip.face);
    return lip.h * rise * (1 - smooth((e - lip.run) / lip.fall)) * endF;
  }
  // the two edges as points (for drawing walls), and which edge is the lip
  function outline(step = 1.5) {
    const L = [], R = [];
    for (let s = 0; s <= len + 0.01; s += step) { L.push(at(pts, Math.min(s, len), -hw(s, 0))); R.push(at(pts, Math.min(s, len), hw(s, 1))); }
    return { L, R, lipEdge: lip ? (lip.side < 0 ? 'L' : 'R') : null };
  }
  function scarpLine(step = 2) { const P = []; for (let s = 0; s <= len + 0.01; s += step) { const sh = jag * zig(s, 0) * Math.min(1, lens(s) * 3); P.push(at(pts, Math.min(s, len), lip.side * sh)); } return P; }
  return { spec, open, len, voidD, lift, outline, scarpLine, box, depth: spec.depth ?? 28, lip };
}

// An irregular round shaft (the moulin): r varies round the rim
export function makeShaft(c, r, seed = 3) {
  const R = a => r * (1 + 0.07 * noise1(a * 3, seed) + 0.04 * (Math.abs(((a * 7 / Math.PI) % 1) * 2 - 1) * 2 - 1));
  const voidD = (x, z) => { const dx = x - c[0], dz = z - c[1], d = Math.hypot(dx, dz); if (d > r * 1.3) return d - r; const a = Math.atan2(dz, dx) + Math.PI; return d - R(a); };
  const outline = (n = 120) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI * 2; const rr = R(a); return [c[0] - Math.cos(a) * rr, c[1] - Math.sin(a) * rr]; });
  return { voidD, outline, depth: 40 };
}

// marching squares: the edge of { inside(x, z) } over a box, as short segments
export function edgeSegs(inside, x0, z0, x1, z1, st = 1) {
  const nx = Math.ceil((x1 - x0) / st), nz = Math.ceil((z1 - z0) / st), V = new Uint8Array((nx + 1) * (nz + 1)), segs = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = inside(x0 + i * st, z0 + j * st) ? 1 : 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = V[j * (nx + 1) + i], b = V[j * (nx + 1) + i + 1], c = V[(j + 1) * (nx + 1) + i + 1], d = V[(j + 1) * (nx + 1) + i];
    const k = a | b << 1 | c << 2 | d << 3; if (k === 0 || k === 15) continue;
    const X = x0 + i * st, Z = z0 + j * st, T = [X + st / 2, Z], Rt = [X + st, Z + st / 2], B = [X + st / 2, Z + st], Lt = [X, Z + st / 2];
    const C = { 1: [[Lt, T]], 2: [[T, Rt]], 3: [[Lt, Rt]], 4: [[Rt, B]], 5: [[Lt, T], [Rt, B]], 6: [[T, B]], 7: [[Lt, B]], 8: [[B, Lt]], 9: [[B, T]], 10: [[T, Rt], [B, Lt]], 11: [[B, Rt]], 12: [[Rt, Lt]], 13: [[Rt, T]], 14: [[T, Lt]] }[k];
    segs.push(...C);
  }
  return segs;
}
