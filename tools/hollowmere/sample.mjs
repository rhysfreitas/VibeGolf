// node tools/hollowmere/sample.mjs (writes tools/hollowmere/out/, not committed): sample every Hollowmere hole in its own frame (tee at the origin, the green straight down
// -z), work out yardages, profiles with the roof, and what each tee can see. Writes out/h<n>.bin + out/meta.json
import { createTerrain, lineProj } from '../../src/course/terrain.js';
import { HOLES, HALLS, SKY, LANDMARKS, HOLLOW, C } from './holes.mjs';
import fs from 'fs';
const OUT = new URL('./out/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
export const SURF = ['void', 'tee', 'fairway', 'fringe', 'firstcut', 'rough', 'desert', 'sand', 'waste', 'water', 'green', 'rock', 'deep'];
const YD = 0.9144, RES = 0.5;

// inside the caverns? (outside is rock)
function inHall(x, z) {
  for (const H of HALLS) {
    if (H.e) { const p = H.p || 2; if (Math.abs((x - H.e[0]) / H.rx) ** p + Math.abs((z - H.e[1]) / H.rz) ** p <= 1) return true; }
    else { const [ax, az] = H.a, [bx, bz] = H.b, dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) <= H.w / 2) return true; }
  }
  return false;
}
const skyAt = (x, z) => SKY.some(s => Math.hypot(x - s.x, z - s.z) < s.r);
const segLen = L => L.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - L[i][0], p[1] - L[i][1]), 0);
function yardsFrom(L, [x, z]) {
  const s = lineProj(L, x, z).s; let acc = 0;
  for (let i = 1; i < L.length; i++) { acc += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]); if (acc > s + 1) return (Math.hypot(L[i][0] - x, L[i][1] - z) + segLen(L.slice(i))) / YD; }
  return 0;
}
const meta = [];
HOLES.forEach((h0, i) => {
  const n = i + 1, tee = h0.tees.eagle, pin = h0.green.pins[0];
  const h = { ...h0, line: [tee, ...h0.line.slice(1)], pin, corridor: h0.corridor ?? 38, native: [0, 0] };
  const T = createTerrain(h);
  const hd = Math.atan2(pin[0] - tee[0], -(pin[1] - tee[1])), cs = Math.cos(hd), sn = Math.sin(hd);
  // local frame: tee at the origin, the pin straight down -z. world = tee + R * local
  const W = (lx, lz) => [tee[0] + lx * cs - lz * sn, tee[1] + lx * sn + lz * cs];
  const Lc = (x, z) => { const dx = x - tee[0], dz = z - tee[1]; return [dx * cs + dz * sn, -dx * sn + dz * cs]; };
  // the box, in local coordinates: the line, tees, green and a margin wide enough to show the hall
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (p, r = 0) => { const [lx, lz] = Lc(p[0], p[1]); x0 = Math.min(x0, lx - r); x1 = Math.max(x1, lx + r); z0 = Math.min(z0, lz - r); z1 = Math.max(z1, lz + r); };
  h.line.forEach(p => grow(p, h0.floor ? 105 : 70)); Object.values(h.tees).forEach(p => grow(p, 40)); grow(pin, 60);
  x0 -= 10; x1 += 10; z0 -= 10; z1 += 18;
  const nx = Math.ceil((x1 - x0) / RES), nz = Math.ceil((z1 - z0) / RES);
  const Hm = new Float32Array(nx * nz), Sm = new Uint8Array(nx * nz), Km = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let k = 0; k < nx; k++) {
    const [x, z] = W(x0 + (k + 0.5) * RES, z0 + (j + 0.5) * RES), idx = j * nx + k;
    if (!inHall(x, z)) { Hm[idx] = NaN; Sm[idx] = SURF.indexOf('rock'); continue; }
    const g = T.groundAt(x, z), top = g === null ? null : T.topAt(x, z);
    // cave wall: a rock island, or open air outside the Hollow's gorges (the hall's edge)
    if ((top && top.I && top.I.kind === 'rock') || (g === null && !(T.floor && T.inGorge(x, z)))) { Hm[idx] = NaN; Sm[idx] = SURF.indexOf('rock'); continue; }
    Hm[idx] = g === null ? NaN : g;
    Sm[idx] = g === null ? SURF.indexOf('deep') : Math.max(0, SURF.indexOf(T.surfaceAt(x, z)));
    Km[idx] = skyAt(x, z) ? 1 : 0;
  }
  fs.writeFileSync(`${OUT}h${n}.bin`, Buffer.concat([Buffer.from(Hm.buffer), Buffer.from(Sm.buffer), Buffer.from(Km.buffer)]));
  // the profile along the line, every metre, with the roof (null under open sky)
  const prof = []; let acc = 0;
  for (let si = 0; si < h.line.length - 1; si++) {
    const [ax, az] = h.line[si], [bx, bz] = h.line[si + 1], len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 1) { const x = ax + (bx - ax) * t / len, z = az + (bz - az) * t / len; prof.push([acc + t, inHall(x, z) ? T.groundAt(x, z) : null, T.surfaceAt(x, z), skyAt(x, z) ? null : h.roof.y]); }
    acc += len;
  }
  // stalactite tips are given as metres above the ground under them: make them absolute
  for (const m of h.marks) if (m.type === 'stalactites') m.pts = m.pts.map(p => p.length > 3 ? p : [p[0], p[1], (T.groundAt(p[0], p[1]) ?? h.floor?.y ?? 0) + p[2], 1]);
  // stalactites near the line, on the profile
  const hang = h.marks.filter(m => m.type === 'stalactites').flatMap(m => m.pts.map(p => { const q = lineProj(h.line, p[0], p[1]); return { s: q.s, off: q.d, y: p[2] }; })).filter(q => q.off < 30);
  const loc = p => Lc(p[0], p[1]);
  const allMarks = [...h.marks, ...(h.rocks || []).map(R => ({ type: 'stalagmite', x: R.x, z: R.z, r: R.r, h: R.h }))];
  const marks = allMarks.map(m => { const o = { ...m };
    if (m.pts) o.pts = m.pts.map(p => [...loc(p), ...p.slice(2)]);
    if (m.poly) o.poly = m.poly.map(p => loc(p));
    if (m.x !== undefined) [o.x, o.z] = loc([m.x, m.z]);
    return o; });
  const teeInfo = Object.fromEntries(Object.entries(h.tees).map(([id, p]) => [id, { x: Lc(...p)[0], z: Lc(...p)[1], yd: Math.round(yardsFrom(h.line, p)), y: T.groundAt(p[0], p[1]) }]));
  // the tips tee (switched off): its yardage, measured like the tees'
  const tipsInfo = h0.tips ? { x: Lc(...h0.tips)[0], z: Lc(...h0.tips)[1], yd: Math.round(yardsFrom(h.line, h0.tips)), y: T.groundAt(...h0.tips) } : null;
  meta.push({ n, name: h.name, par: h.par, tips: tipsInfo, shape: h.shape, idea: h.idea, play: h.play, features: h.features, heading: Math.round(((hd * 180 / Math.PI) % 360 + 360) % 360), box: [x0, z0, nx, nz, RES],
    tees: teeInfo, line: h.line.map(loc), pin: loc(pin), pinY: T.groundAt(...pin), green: loc([h.green.x, h.green.z]), marks, prof, hang, roofY: h.roof.y });
  console.log(n, h.name, 'yards', Object.values(teeInfo).map(t => t.yd).join('/'), 'grid', nx, nz, 'tee y', teeInfo.eagle.y?.toFixed(1), 'pin y', T.groundAt(...pin)?.toFixed(1));
});

// what each tee can see: landmarks ahead (within 50° of the line to the first turn) with a clear line of sight through the caverns
const world = HOLES.map((h, i) => {
  const t = h.tees.eagle, aim = h.line[1], brg0 = Math.atan2(aim[0] - t[0], -(aim[1] - t[1]));
  const sees = [];
  for (const L of LANDMARKS) {
    const dx = L.x - t[0], dz = L.z - t[1], dist = Math.hypot(dx, dz);
    if (dist < 60 || dist > 1100 || Math.hypot(L.x - h.green.pins[0][0], L.z - h.green.pins[0][1]) < 120) continue;
    const rel = ((Math.atan2(dx, -dz) - brg0) * 180 / Math.PI + 540) % 360 - 180;
    if (Math.abs(rel) > 50) continue;
    let clear = true; for (let k = 1; k < 40; k++) { const f = k / 40; if (!inHall(t[0] + dx * f, t[1] + dz * f) && !skyAt(t[0] + dx * f, t[1] + dz * f)) { clear = false; break; } }
    if (clear) sees.push({ id: L.id, name: L.name, short: L.short, rel: Math.round(rel), dist: Math.round(dist) });
  }
  return { n: i + 1, heading: meta[i].heading, tee: t, pin: h.green.pins[0], line: [t, ...h.line.slice(1)], sees };
});
// the course map, in world coordinates: a coarse grid of rock / cavern / the Deep / sky, plus each hole's playing surfaces
let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity;
for (const H of HALLS) { const pts = H.e ? [[H.e[0] - H.rx, H.e[1] - H.rz], [H.e[0] + H.rx, H.e[1] + H.rz]] : [H.a, H.b].flatMap(p => [[p[0] - H.w / 2, p[1] - H.w / 2], [p[0] + H.w / 2, p[1] + H.w / 2]]); for (const [x, z] of pts) { X0 = Math.min(X0, x); X1 = Math.max(X1, x); Z0 = Math.min(Z0, z); Z1 = Math.max(Z1, z); } }
X0 -= 40; X1 += 40; Z0 -= 40; Z1 += 40;
const MR = 3, mx = Math.ceil((X1 - X0) / MR), mz = Math.ceil((Z1 - Z0) / MR), Mk = new Uint8Array(mx * mz);
const terr = HOLES.map((h, i) => createTerrain({ ...h, line: [h.tees.eagle, ...h.line.slice(1)], pin: h.green.pins[0], corridor: h.corridor ?? 38, native: [0, 0] }));
const near = (x, z) => { let best = 0, bd = Infinity; HOLES.forEach((h, i) => { for (const p of [h.tees.eagle, ...h.line.slice(1)]) { const d = Math.hypot(x - p[0], z - p[1]); if (d < bd) { bd = d; best = i; } } }); return best; };
for (let j = 0; j < mz; j++) for (let k = 0; k < mx; k++) {
  const x = X0 + (k + 0.5) * MR, z = Z0 + (j + 0.5) * MR, idx = j * mx + k;
  if (!inHall(x, z)) { Mk[idx] = 0; continue; }
  const ni = near(x, z), T = terr[ni], g = T.groundAt(x, z), top = g === null ? null : T.topAt(x, z);
  const s = g === null ? (T.floor && T.inGorge(x, z) ? 'deep' : 'rock') : top && top.I && top.I.kind === 'rock' ? 'rock' : T.surfaceAt(x, z);
  if (s === 'rock') { Mk[idx] = 0; continue; }
  Mk[idx] = s === 'deep' ? 2 : s === 'water' ? 3 : s === 'green' ? 4 : s === 'fairway' || s === 'fringe' || s === 'tee' ? 5 : s === 'sand' ? 6 : 1;
  if (skyAt(x, z) && Mk[idx] !== 2) Mk[idx] += 10;
}
fs.writeFileSync(`${OUT}map.bin`, Buffer.from(Mk.buffer));
fs.writeFileSync(`${OUT}meta.json`, JSON.stringify({ holes: meta, world, landmarks: LANDMARKS, sky: SKY, map: [X0, Z0, mx, mz, MR], surf: SURF }));
world.forEach(w => console.log(w.n, 'sees', w.sees.map(s => `${s.id} ${s.rel}° ${s.dist}m`).join(', ') || '-'));
const tot = id => meta.reduce((a, m) => a + m.tees[id].yd, 0);
console.log('totals', ['eagle', 'hawk', 'swift', 'wren'].map(id => `${id} ${tot(id)}`).join(' · '), 'par', HOLES.reduce((a, h) => a + h.par, 0));
