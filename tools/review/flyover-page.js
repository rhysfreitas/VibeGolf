// In-page half of tools/review/flyover.mjs (runs in the course page, global THREE): voxelise everything drawn
// round the hole, measure how close each flyover comes to it, and plan a clear path as near the default as can be.
import { createTerrain } from '../../src/course/terrain.js';
import { defaultFlyover } from '../../src/course/flyover.js';

const VS = 2;          // voxel size, m
const CLEAR = 2.5;     // the camera keeps more than this many voxels (centre to centre) from anything drawn: about 4–6 m

// ---------- the voxels ----------
function meshesToVoxelise() {
  const out = [];
  __scene.traverseVisible(o => {
    if (!o.isMesh || o.isLine2 || o.type === 'Line2') return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const m = ms[0];
    if (!m || m.visible === false || m.colorWrite === false) return;
    if (!m.depthWrite) return;                              // sky domes, mist, haze, beams, glows, water sheets
    if (m.blending === THREE.AdditiveBlending) return;
    if (o.scale.x > 1000) return;                           // the sky
    out.push(o);
  });
  return out;
}

export function voxelise(R) {
  // on one fixed lattice, so every run (and the check of what the game flies) sees the same voxels
  R = { x0: Math.floor(R.x0 / VS) * VS, y0: Math.floor(R.y0 / VS) * VS, z0: Math.floor(R.z0 / VS) * VS, x1: R.x1, y1: R.y1, z1: R.z1 };
  const nx = Math.ceil((R.x1 - R.x0) / VS), ny = Math.ceil((R.y1 - R.y0) / VS), nz = Math.ceil((R.z1 - R.z0) / VS);
  const occ = new Uint16Array(nx * ny * nz);
  let meshes = [], info = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m4 = new THREE.Matrix4(), im = new THREE.Matrix4();
  let tris = 0;
  const mark = (x, y, z, id) => {
    const i = Math.floor((x - R.x0) / VS), j = Math.floor((y - R.y0) / VS), k = Math.floor((z - R.z0) / VS);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    occ[(k * ny + j) * nx + i] = id;
  };
  // three snapshots a few seconds apart, so scenery that moves (flocks, herds, boats, drones) counts where it was
  for (let snap = 0; snap < 3; snap++) {
    if (snap) __advance(4);
    meshes = meshesToVoxelise(); info = [];
    meshes.forEach((o, mi) => {
      const id = Math.min(65535, mi + 1);
      const g = o.geometry, P = g.attributes.position; if (!P) return;
      const idx = g.index ? g.index.array : null, n = idx ? idx.length : P.count;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      info.push({ id, type: o.type, mat: mat.type, col: mat.color ? mat.color.getHexString() : null, inst: o.isInstancedMesh ? o.count : 0, tris: n / 3, name: o.name || o.parent?.name || '' });
      o.updateMatrixWorld(true);
      const insts = o.isInstancedMesh ? o.count : 1;
      for (let q = 0; q < insts; q++) {
        if (o.isInstancedMesh) { o.getMatrixAt(q, im); m4.multiplyMatrices(o.matrixWorld, im); } else m4.copy(o.matrixWorld);
        // skip an instance (or mesh) whose bounds miss the region
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere, cw = a.copy(bs.center).applyMatrix4(m4), rr = bs.radius * m4.getMaxScaleOnAxis();
        if (cw.x + rr < R.x0 || cw.x - rr > R.x1 || cw.y + rr < R.y0 || cw.y - rr > R.y1 || cw.z + rr < R.z0 || cw.z - rr > R.z1) continue;
        for (let t = 0; t + 2 < n; t += 3) {
          const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2;
          a.fromBufferAttribute(P, i0).applyMatrix4(m4); b.fromBufferAttribute(P, i1).applyMatrix4(m4); c.fromBufferAttribute(P, i2).applyMatrix4(m4);
          if (Math.max(a.x, b.x, c.x) < R.x0 || Math.min(a.x, b.x, c.x) > R.x1 || Math.max(a.y, b.y, c.y) < R.y0 || Math.min(a.y, b.y, c.y) > R.y1 || Math.max(a.z, b.z, c.z) < R.z0 || Math.min(a.z, b.z, c.z) > R.z1) continue;
          tris++;
          const e = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)), s = Math.max(1, Math.ceil(e / (VS * 0.45)));
          if (s > 400) continue; // a sheet hundreds of metres across (a sea, a far plane): not something the camera meets
          for (let u = 0; u <= s; u++) for (let v = 0; u + v <= s; v++) {
            const w = s - u - v;
            mark((a.x * u + b.x * v + c.x * w) / s, (a.y * u + b.y * v + c.y * w) / s, (a.z * u + b.z * v + c.z * w) / s, id);
          }
        }
      }
    });
  }
  // near: within CLEAR voxels of anything
  const near = new Uint8Array(occ.length), r = Math.ceil(CLEAR), offs = [];
  for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (di * di + dj * dj + dk * dk <= CLEAR * CLEAR) offs.push([di, dj, dk]);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!occ[(k * ny + j) * nx + i]) continue;
    for (const [di, dj, dk] of offs) {
      const I = i + di, J = j + dj, K = k + dk;
      if (I < 0 || J < 0 || K < 0 || I >= nx || J >= ny || K >= nz) continue;
      near[(K * ny + J) * nx + I] = 1;
    }
  }
  return { R, nx, ny, nz, occ, near, info, tris, meshes: meshes.length };
}

const vox = (V, x, y, z) => {
  const i = Math.floor((x - V.R.x0) / VS), j = Math.floor((y - V.R.y0) / VS), k = Math.floor((z - V.R.z0) / VS);
  if (i < 0 || j < 0 || k < 0 || i >= V.nx || j >= V.ny || k >= V.nz) return -1;
  return (k * V.ny + j) * V.nx + i;
};
// distance (m) from a point to the nearest drawn thing, searched out to 12 m
function clearance(V, x, y, z) {
  let best = 99;
  for (let dk = -6; dk <= 6; dk++) for (let dj = -6; dj <= 6; dj++) for (let di = -6; di <= 6; di++) {
    const d2 = di * di + dj * dj + dk * dk; if (d2 * VS * VS >= best * best) continue;
    const q = vox(V, x + di * VS, y + dj * VS, z + dk * VS);
    if (q >= 0 && V.occ[q]) best = Math.sqrt(d2) * VS;
  }
  return best;
}

// ---------- a path and how it flies ----------
function curves(f) {
  const v = p => new THREE.Vector3(p[0], p[1], p[2]);
  return { cur: new THREE.CatmullRomCurve3(f.pts.map(v)), look: new THREE.CatmullRomCurve3(f.looks.map(v)) };
}
// blocked: arc-length samples within reach of something drawn; los: share of the flight (by time, as the game
// flies it) whose look point on the ground is hidden behind something
export function judge(V, f, T, { full = false } = {}) {
  const { cur, look } = curves(f), len = cur.getLength(), n = Math.max(60, Math.ceil(len / 0.8));
  const pts = cur.getSpacedPoints(n);
  let blocked = 0, first = -1, last = -1, hitIds = new Map();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = vox(V, p.x, p.y, p.z);
    if (q >= 0 && V.near[q]) {
      blocked++; if (first < 0) first = i; last = i;
      if (full) { // what is it near?
        for (let dk = -2; dk <= 2; dk++) for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const w = vox(V, p.x + di * VS, p.y + dj * VS, p.z + dk * VS); if (w >= 0 && V.occ[w]) hitIds.set(V.occ[w], (hitIds.get(V.occ[w]) || 0) + 1); }
      }
    }
  }
  let los = 0, steep = 0; const NL = 48;
  for (let s = 0; s < NL; s++) {
    const u = (s + 0.5) / NL, e = u * u * (3 - 2 * u), c = cur.getPoint(e), l = look.getPoint(Math.min(1, e * 1.05));
    if (Math.atan2(c.y - l.y, Math.hypot(l.x - c.x, l.z - c.z)) > 58 * Math.PI / 180) steep++;   // staring down at the ground
    const g = T.groundAt(l.x, l.z); if (g == null) continue;   // looking out over open air: nothing to hide
    const ty = Math.max(g, l.y) + 1.5;
    const dx = l.x - c.x, dy = ty - c.y, dz = l.z - c.z, D = Math.hypot(dx, dy, dz);
    let hid = false;
    for (let t = 4; t < D - 18; t += VS * 0.9) { const q = vox(V, c.x + dx * t / D, c.y + dy * t / D, c.z + dz * t / D); if (q >= 0 && V.occ[q]) { hid = true; break; } }
    if (hid) los++;
  }
  const out = { blocked, frac: blocked / pts.length, len, los: los / NL, steep: steep / NL, span: first < 0 ? null : [+(first / n).toFixed(2), +(last / n).toFixed(2)] };
  if (full) {
    let minD = 99; for (const p of pts) minD = Math.min(minD, clearance(V, p.x, p.y, p.z)); out.minD = minD;
    out.hits = [...hitIds.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([id]) => V.info[id - 1]);
  }
  return out;
}

// ---------- candidates ----------
// route: the straight line tee to pin (the default's), or the line of play through the hole's corners
function routeOf(h, tee, pin, kind) {
  if (kind === 'straight' || !h.line || h.line.length < 3) return [tee, pin];
  const L = h.line; let k = 0, bd = 1e9;
  L.forEach((p, i) => { const d = Math.hypot(p[0] - tee[0], p[1] - tee[1]); if (d < bd) { bd = d; k = i; } });
  // a line point behind the tee (the back tee's start, seen from a forward tee) is dropped
  const dir = [pin[0] - tee[0], pin[1] - tee[1]];
  let pts = L.slice(k + 1).filter(p => (p[0] - tee[0]) * dir[0] + (p[1] - tee[1]) * dir[1] > 0);
  pts = pts.filter(p => Math.hypot(p[0] - pin[0], p[1] - pin[1]) > 25);
  return [tee, ...pts, pin];
}
function along(route, s) {
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i], [bx, bz] = route[i + 1], l = Math.hypot(bx - ax, bz - az) || 1;
    if (s <= l || i === route.length - 2) return { x: ax + (bx - ax) * s / l, z: az + (bz - az) * s / l, dx: (bx - ax) / l, dz: (bz - az) / l };
    s -= l;
  }
}
const lenOf = r => r.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);

function candidate(h, T, t, p, o) {
  const route = routeOf(h, [t[0], t[2]], [p[0], p[2]], o.route), RL = lenOf(route), L = Math.hypot(p[0] - t[0], p[2] - t[2]) || 1;
  const gy = (x, z, f) => { const base = t[1] + (p[1] - t[1]) * f; if (o.y !== 'ground') return base; const g = T.groundAt(x, z); return g == null ? base : Math.max(base, g); };
  const s0 = along(route, 0), sE = along(route, RL);
  const pts = [], looks = [];
  // behind the tee
  { const x = t[0] - s0.dx * o.b0 + (-s0.dz) * (-20 * o.side), z = t[2] - s0.dz * o.b0 + s0.dx * (-20 * o.side);
    pts.push([x, gy(x, z, 0) + 32 * o.h, z]);
    const l = along(route, RL * 0.45); looks.push([l.x, t[1] + (p[1] - t[1]) * 0.45 - 10, l.z]); }
  const mids = o.mids === 2 ? [0.36, 0.68] : [0.5];
  for (const f of mids) {
    const a = along(route, RL * f), sd = -L * 0.35 * o.side * (o.mids === 2 ? 0.8 : 1);
    const x = a.x + (-a.dz) * sd, z = a.z + a.dx * sd;
    pts.push([x, gy(x, z, f) + (70 + L * 0.08) * o.h, z]);
    // the default looks across at the middle from out to the side; pulled in over the line, look on ahead down it
    const k = 1 - Math.min(1, Math.abs(o.side)), fl = Math.min(0.92, f + 0.32 * k), b = along(route, RL * fl);
    looks.push([b.x, t[1] + (p[1] - t[1]) * fl - 20 + 14 * k, b.z]);
  }
  { const x = p[0] + sE.dx * o.b2 + (-sE.dz) * (35 * o.side), z = p[2] + sE.dz * o.b2 + sE.dx * (35 * o.side);
    pts.push([x, gy(x, z, 1) + 28 * o.h, z]); looks.push([p[0], p[1] - 2, p[2]]); }
  return { pts, looks, dur: Math.min(9, 5.5 + L / 160), o };
}

export function candidates(h, T, t, p) {
  const out = [];
  for (const route of ['straight', 'play']) for (const mids of route === 'play' ? [1, 2] : [1])
    for (const sg of [1, -1]) for (const ss of [1, 0.6, 0.3, 0]) for (const hs of [1, 1.3, 1.7, 2.2, 0.75, 0.55, 0.4, 0.28, 0.18])
      for (const y of ['lerp', 'ground']) for (const b0 of [55, 30, 10]) for (const b2 of [50, 20]) {
        if (ss === 0 && sg === -1) continue;
        out.push(candidate(h, T, t, p, { route, mids, side: sg * ss, h: hs, y, b0, b2 }));
      }
  return out;
}

// nudge each control point up, down and sideways while that makes the path better (nearer the default, more room)
function score(V, T, def, c) {
  const j = judge(V, c, T), dev = deviation(c, def), tight = tightness(V, c);
  return { c, j, dev, tight, cost: j.blocked * 50 + dev / 40 + Math.max(0, j.los - 0.1) * 3 + j.steep * 3 + tight * 1.5 + (c.o.route === 'play' ? 0.15 : 0) };
}
function refine(V, T, def, best) {
  best = score(V, T, def, best.c);
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < best.c.pts.length; i++) {
      const a = best.c.pts[Math.max(0, i - 1)], b = best.c.pts[Math.min(best.c.pts.length - 1, i + 1)];
      const tx = b[0] - a[0], tz = b[2] - a[2], tl = Math.hypot(tx, tz) || 1, sx = -tz / tl, sz = tx / tl;
      for (const [dy, ds] of [[12, 0], [-12, 0], [25, 0], [-25, 0], [0, 15], [0, -15], [0, 30], [0, -30]]) {
        const pts = best.c.pts.map(q => q.slice()); pts[i] = [pts[i][0] + sx * ds, pts[i][1] + dy, pts[i][2] + sz * ds];
        const t = score(V, T, def, { ...best.c, pts });
        if (t.cost < best.cost - 1e-3) { best = t; moved = true; }
      }
    }
    if (!moved) break;
  }
  return best;
}
// share of the flight (by time) spent within 8 m of something drawn
function tightness(V, f) {
  const { cur } = curves(f); let n = 0; const N = 40;
  for (let s = 0; s < N; s++) { const u = (s + 0.5) / N, e = u * u * (3 - 2 * u), c = cur.getPoint(e); if (clearance(V, c.x, c.y, c.z) < 8) n++; }
  return n / N;
}
// mean distance between two paths, sampled at the same points of the flight
function deviation(f, g) {
  const A = curves(f).cur, B = curves(g).cur; let s = 0;
  for (let i = 0; i <= 20; i++) s += A.getPoint(i / 20).distanceTo(B.getPoint(i / 20));
  return s / 21;
}

// ---------- the whole job for one hole ----------
// returns, for each tee set, how the default flies and (if it doesn't fly clear) the planned path
export function runHole(h, teeIds, { losBad = 0.3 } = {}) {
  const T = createTerrain(h);
  const pin = h.pinPos ? [h.pinPos.x, h.pinPos.y, h.pinPos.z] : [h.pin[0], T.groundAt(h.pin[0], h.pin[1]) ?? 0, h.pin[1]];
  const per = {};
  for (const id of teeIds) {
    const tt = h.tees[id]; if (!tt) continue;
    const t = [tt[0], T.groundAt(tt[0], tt[1]) ?? 0, tt[1]];
    per[id] = { t, def: defaultFlyover(t, pin), cands: candidates(h, T, t, pin) };
  }
  // one voxel region round every candidate path
  const R = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
  for (const id in per) for (const f of [per[id].def, ...per[id].cands]) for (const q of f.pts) {
    R.x0 = Math.min(R.x0, q[0]); R.x1 = Math.max(R.x1, q[0]); R.y0 = Math.min(R.y0, q[1]); R.y1 = Math.max(R.y1, q[1]); R.z0 = Math.min(R.z0, q[2]); R.z1 = Math.max(R.z1, q[2]);
  }
  for (const id in per) { R.y0 = Math.min(R.y0, per[id].t[1], pin[1]); }
  R.x0 -= 60; R.x1 += 60; R.z0 -= 60; R.z1 += 60; R.y0 -= 40; R.y1 += 30;
  const t0 = performance.now(), V = voxelise(R), tv = performance.now() - t0;
  const res = { voxMs: Math.round(tv), tris: V.tris, meshes: V.meshes, dims: [V.nx, V.ny, V.nz], tees: {} };
  for (const id in per) {
    const { def, cands } = per[id];
    const dj = judge(V, def, T, { full: true });
    const r = { def: dj };
    if (dj.blocked > 0 || dj.los > losBad) {
      // the clear candidates, then the one nearest the default with the ground in view
      // rank every candidate, then among the best few prefer room to spare: a path that skims a wall reads as a near miss
      const ranked = cands.map(c => {
        const j = judge(V, c, T), dev = deviation(c, def);
        return { c, j, dev, cost: j.blocked * 50 + dev / 40 + Math.max(0, j.los - 0.1) * 3 + j.steep * 3 + (c.o.route === 'play' ? 0.15 : 0) };
      }).sort((a, b) => a.cost - b.cost);
      for (const r of ranked.slice(0, 24)) { r.tight = tightness(V, r.c); r.cost += r.tight * 1.5; }
      const best = refine(V, T, def, ranked.slice(0, 24).sort((a, b) => a.cost - b.cost)[0]);
      best.j = judge(V, best.c, T, { full: true });
      r.plan = { tight: +best.tight.toFixed(2), pts: best.c.pts.map(q => q.map(v => +v.toFixed(1))), looks: best.c.looks.map(q => q.map(v => +v.toFixed(1))), dur: best.c.dur, o: best.c.o, judge: best.j, dev: +best.dev.toFixed(1) };
    }
    res.tees[id] = r;
  }
  return res;
}

// what the game flies (flyoverFor with the written table), judged from every tee set
export async function verifyHole(courseId, holeIdx, h, teeIds) {
  const { flyoverFor } = await import('../../src/course/flyover.js');
  const { FLYOVERS } = await import('../../src/course/flyovers.js?t=' + Date.now());
  const T = createTerrain(h);
  const pin = [h.pinPos.x, h.pinPos.y, h.pinPos.z], fs = {};
  const R = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
  for (const id of teeIds) {
    const tt = h.tees[id]; if (!tt) continue;
    const t = [tt[0], T.groundAt(tt[0], tt[1]) ?? 0, tt[1]];
    fs[id] = flyoverFor(FLYOVERS, courseId, holeIdx, id, t, pin, [h.green.x, h.green.z]);
    for (const q of fs[id].pts) { R.x0 = Math.min(R.x0, q[0]); R.x1 = Math.max(R.x1, q[0]); R.y0 = Math.min(R.y0, q[1], t[1]); R.y1 = Math.max(R.y1, q[1]); R.z0 = Math.min(R.z0, q[2]); R.z1 = Math.max(R.z1, q[2]); }
  }
  R.x0 -= 60; R.x1 += 60; R.z0 -= 60; R.z1 += 60; R.y0 -= 40; R.y1 += 30;
  const V = voxelise(R), out = {};
  for (const id in fs) { const j = judge(V, fs[id], T, { full: true }); out[id] = { blocked: j.blocked, span: j.span, minD: j.minD, los: j.los, steep: j.steep, hits: j.hits, planned: !!(FLYOVERS[courseId]?.[holeIdx]?.[id]) }; }
  return out;
}
