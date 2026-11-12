// Halcyon Ring routing check: places the nine holes on the floor, measures what the routing asks (lengths,
// spacing between holes, walks, the windows, spoke, lake and canal against the lines, and which landmarks are in
// each tee's fixed view) and writes out/routing.json for routing.py (the map).
//   node tools/halcyon/routing.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOLES, COURSE, BACK, FRONT } from './holes.mjs';
import * as W from './world.mjs';
import { YD, project, at } from './geo.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out'); mkdirSync(OUT, { recursive: true });
const place = h => { const a = h.place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  return ([x, z]) => [h.place.at[0] + x * rx + (-z) * fx, h.place.at[1] + x * rz + (-z) * fz]; };
const toAS = ([X, Z]) => [X, -Z];
const HF = Math.atan(Math.tan(25 * Math.PI / 180) * 844 / 390) * 180 / Math.PI;   // the frame's half width, degrees

const out = { holes: [], world: {}, notes: [] };
const lines = [];
for (const h of HOLES) {
  const pl = place(h);
  const line = h.line.map(pl).map(toAS);
  const tees = Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toAS(pl(p))]));
  lines.push(line);
  out.holes.push({ n: h.n, name: h.name, par: h.par, line, tees, tips: toAS(pl(h.tips.tee)), yards: h.yards, tipsYards: h.tips.yards, heading: h.place.heading, shape: h.shape || 'Straight', card: h.card });
}
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const report = [];
const yd = (h) => h.yards[BACK];
report.push(`Halcyon Ring routing: ${HOLES.map(h => `${h.n} par ${h.par} ${yd(h)}`).join(' · ')}`);
report.push(`Total: ${HOLES.reduce((a, h) => a + yd(h), 0)} yd from Zenith, ${HOLES.reduce((a, h) => a + h.yards.meridian, 0)} Meridian, ${HOLES.reduce((a, h) => a + h.yards.horizon, 0)} Horizon, ${HOLES.reduce((a, h) => a + h.yards[FRONT], 0)} Nadir; Kingfisher tips ${HOLES.reduce((a, h) => a + h.tips.yards, 0)}`);

// spacing: the nearest approach of each hole's line to every other hole's line (sampled every 5 m)
const sample = L => { const pts = []; for (let i = 0; i + 1 < L.length; i++) { const n = Math.ceil(dist(L[i], L[i + 1]) / 5); for (let k = 0; k < n; k++) pts.push([L[i][0] + (L[i + 1][0] - L[i][0]) * k / n, L[i][1] + (L[i + 1][1] - L[i][1]) * k / n]); } pts.push(L.at(-1)); return pts; };
const S = lines.map(sample);
for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
  let best = 1e9, bp = null;
  for (const p of S[i]) for (const q of S[j]) { const d = dist(p, q); if (d < best) { best = d; bp = [p, q]; } }
  if (best < 90) report.push(`${best < 60 ? '! ' : ''}holes ${i + 1} and ${j + 1}: lines ${best.toFixed(0)} m apart at a ${bp[0][0].toFixed(0)}, s ${bp[0][1].toFixed(0)}`);
}
// walks from each green to the next tee (the back tee)
for (let i = 0; i + 1 < out.holes.length; i++) report.push(`walk ${i + 1} → ${i + 2}: ${dist(out.holes[i].line.at(-1), out.holes[i + 1].tees[BACK]).toFixed(0)} m`);
// the curve: rise from tee to green along the ring, measured from the hole's lowest point along the ring
for (const h of out.holes) {
  const ss = h.line.map(p => p[1]), lo = Math.min(...ss), hi = Math.max(...ss);
  report.push(`${h.n} along the ring ${(hi - lo).toFixed(0)} m: the curve alone would lift its far end ${W.curveRise(hi, lo).toFixed(1)} m`);
}
// features against the lines
const lineAt = n => out.holes[n - 1].line;
const near = (n, p) => { const L = lineAt(n), pr = project(L.map(q => [q[0], -q[1]]), p[0], -p[1]); return pr; };
for (const w of W.WINDOWS) { const pr = near(w.hole, [w.a, w.s]); report.push(`${w.name}: centre ${pr.s.toFixed(0)} m along the ${w.hole}${w.hole === 4 ? 'th' : 'th'}'s line, ${pr.off.toFixed(0)} m ${pr.off > 0 ? 'right' : 'left'}`); }
for (const [k, leg] of W.SPOKE.legs.entries()) { const pr = near(7, leg); report.push(`Spoke leg ${k + 1}: ${pr.s.toFixed(0)} m along the 7th, ${pr.off.toFixed(0)} m ${pr.off > 0 ? 'right' : 'left'}`); }
// the 4th's bold line: tee straight to 70 m down the second leg, and how much it saves
{ const h = out.holes[3], T = h.tees[BACK], c = h.line[1], g = h.line[2], d2 = [g[0] - c[0], g[1] - c[1]], l2 = Math.hypot(...d2), B = [c[0] + d2[0] / l2 * 70, c[1] + d2[1] / l2 * 70];
  const w = W.WINDOWS[0]; const bl = dist(T, B), sl = dist(T, c) + 70;
  // the carry over the window along the bold line
  let first = null, last = null; for (let s = 0; s <= bl; s += 1) { const p = [T[0] + (B[0] - T[0]) * s / bl, T[1] + (B[1] - T[1]) * s / bl]; if (W.inWindow(...p)) { if (first === null) first = s; last = s; } }
  report.push(`4th bold line: ${bl.toFixed(0)} m to 70 m down the second leg (safe ${sl.toFixed(0)}: ${((sl - bl) / YD).toFixed(0)} yd less); crosses the window ${first === null ? 'nowhere' : `${first}–${last} m from the Zenith tee (carry ${(last / YD).toFixed(0)} yd)`}`);
  out.bold4 = [T, B]; }
// the 9th's carry from each tee
{ const h = out.holes[8], g = h.line.at(-1);
  for (const [k, T] of Object.entries(h.tees)) { const L = dist(T, g); let last = null; for (let s = 0; s <= L; s += 1) { const p = [T[0] + (g[0] - T[0]) * s / L, T[1] + (g[1] - T[1]) * s / L]; if (W.inWindow(...p)) last = s; }
    report.push(`9th from ${k}: carry the Great Window ${last === null ? 'none' : (last / YD).toFixed(0) + ' yd'}`); } }
// the canal across the 8th
{ const L = lineAt(8); for (const s of S[7]) {} const c = W.CANAL.pts; let hits = [];
  for (let i = 0; i + 1 < c.length; i++) for (let k = 0; k + 1 < L.length; k++) { const p = c[i], q = c[i + 1], r = L[k], t = L[k + 1];
    const d = (q[0] - p[0]) * (t[1] - r[1]) - (q[1] - p[1]) * (t[0] - r[0]); if (Math.abs(d) < 1e-9) continue;
    const u = ((r[0] - p[0]) * (t[1] - r[1]) - (r[1] - p[1]) * (t[0] - r[0])) / d, v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { const X = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; const pr = near(8, X); hits.push(pr.s); } }
  report.push(`The canal crosses the 8th's line ${hits.map(s => `${s.toFixed(0)} m (${(s / YD).toFixed(0)} yd) from the Zenith tee`).join(', ') || 'nowhere'}`); }
// the lake against the 6th: nearest water to the line at the landing area
{ const L = lineAt(6); let best = 1e9; for (let i = 0; i < W.LAKE.pts.length; i++) { const p = W.LAKE.pts[i]; const pr = near(6, p); if (pr.s > 150 && pr.s < 300) best = Math.min(best, Math.abs(pr.off) - W.LAKE.w[i] / 2); }
  report.push(`6th: the lake's edge ${best.toFixed(0)} m off the line where drives land (left)`); }

// landmarks in each tee's view: horizontal angle off the heading, within the frame's half width (≈ ${HF}°)
const LM = [['spoke', [W.SPOKE.a, W.SPOKE.s]], ['clubhouse', [W.CLUBHOUSE.a, W.CLUBHOUSE.s]]];
for (const h of out.holes) {
  const T = h.tees[BACK], seen = [];
  const hd = h.heading * Math.PI / 180, f = [Math.sin(hd), Math.cos(hd)];
  for (const [id, p] of LM) {
    const v = [p[0] - T[0], p[1] - T[1]], d = Math.hypot(...v); if (d < 30) continue;
    const ang = Math.atan2(f[0] * v[1] - f[1] * v[0], f[0] * v[0] + f[1] * v[1]) * -180 / Math.PI;
    const elev = (Math.abs(v[1]) / W.R) / 2 * 180 / Math.PI;    // where the curve puts its foot
    if (Math.abs(ang) < HF - 3) seen.push(`${id} ${ang > 0 ? 'right' : 'left'} ${Math.abs(ang).toFixed(0)}° at ${(d / 1000).toFixed(2)} km, its foot ${elev.toFixed(1)}° up`);
  }
  // the rim glass ahead: a heading with an east or west part sees the rim within its frame
  const ex = Math.sin(hd); if (Math.abs(ex) > 0.5) seen.push(`rim glass (${ex > 0 ? 'east' : 'west'}) ahead at ${((W.HALF - Math.sign(ex) * T[0]) / Math.abs(ex) / 1000).toFixed(2)} km`);
  else if (Math.abs(T[0]) > W.HALF - 120) seen.push(`rim glass beside (${T[0] < 0 ? 'west' : 'east'}, ${(W.HALF - Math.abs(T[0])).toFixed(0)} m)`);
  // the night side: south of the terminator, in view for headings with a south part
  if (Math.cos(hd) < -0.3 || (Math.abs(Math.sin(hd)) > 0.9 && T[1] < 200)) seen.push('the night side');
  h.view = seen; report.push(`${h.n} tee sees: ${seen.join('; ') || 'none of the landmarks'}`);
}
out.world = { R: W.R, HALF: W.HALF, TERMINATOR: W.TERMINATOR, WINDOWS: W.WINDOWS, RIM_GLASS: W.RIM_GLASS, LAKE: W.LAKE, CANAL: W.CANAL, AQUEDUCT: W.AQUEDUCT, SPOKE: W.SPOKE, CLUBHOUSE: W.CLUBHOUSE, TRAM: W.TRAM, VALLEY: W.VALLEY };
out.report = report;
writeFileSync(join(OUT, 'routing.json'), JSON.stringify(out, null, 1));
console.log(report.join('\n'));
// the safe line's clearance from the Long Window, where safe drives finish (180-240 m along the 4th)
{ const h = out.holes[3], L = h.line; let best = 1e9;
  for (let s = 160; s <= 250; s += 5) { const L3 = L.map(q => [q[0], -q[1]]), p = at(L3, s), a = p[0], ss = -p[1];
    for (let r = 0; r < 120; r += 1) { let hit = false; for (const ang of [0, Math.PI]) { /* both sides */ }
      for (let k = 0; k < 36; k++) { const t = k / 36 * 2 * Math.PI; if (W.inWindow(a + r * Math.cos(t), ss + r * Math.sin(t))) { hit = true; break; } }
      if (hit) { best = Math.min(best, r); break; } } }
  console.log(`4th: the Long Window's nearest edge is ${best} m from the safe line where drives finish (${(best / YD).toFixed(0)} yd)`); }
