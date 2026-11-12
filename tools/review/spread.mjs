// node tools/review/spread.mjs <course ...|all>
// Do a course's holes sit in the middle of every dial? (docs/COURSE-DESIGN.md "Dials: one to eleven".)
// The other checks compare shapes. This one measures the plain numbers a round is made of and flags a nine whose
// holes cluster: every green about one size, every par 5 about one length, every fairway about one width, one or
// two bunkers by every green. It asks for variety on every dial and for the nine to touch the edge of real golf on
// three of them; it does not ask for a tiny green and a huge one on every course. Measured 12 November 2026: 80% of 63 greens were 475-650 m2, all 15 par 5s 490-560 yd,
// no par 4 over 457 yd, no par 3 under 126, 80% of fairways 38-60 m wide.
//   greens    area of each (m2) and depth against width
//   lengths   back-tee yards by par
//   width     each par 4/5 fairway's mean width along the line
//   bunkers   patches of sand by each green (within 55 m of the pin) and along each fairway, and the biggest
//   bends     how far each par 4/5's line turns in all
//   past real which holes go beyond anything on a real course (the nine wants one, two at most)
// Lines starting `!` break a rule. Playable courses from the game's terrain; Halcyon Ring from tools/halcyon/scene.mjs.
import path from 'path';
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, MODULES, REPO } from './page.mjs';
import { signature } from './alike.mjs';

const PLANNED = ['halcyon'];
// the edges of real golf (`lo`, `hi`: a nine touches some of them, not all), and what counts as past real golf
export const EDGE = {
  green: { lo: 400, hi: 800, pastLo: 280, pastHi: 1200, unit: 'm²' },
  par3: { lo: 130, hi: 200, pastLo: 100, pastHi: 270, unit: 'yd' },
  par4: { lo: 330, hi: 465, pastLo: 280, pastHi: 500, unit: 'yd' },
  par5: { lo: 505, hi: 580, pastLo: 460, pastHi: 640, unit: 'yd' },
  width: { lo: 36, hi: 70, pastLo: 26, pastHi: 95, unit: 'm' },
};

// one hole's numbers. line: back tee .. pin; groundAt(x, z) -> height or null; surfaceAt(x, z) -> surface name
export function holeFacts(line, groundAt, surfaceAt, par, yards) {
  const pin = line.at(-1), a = line.at(-2), L = Math.hypot(pin[0] - a[0], pin[1] - a[1]), ux = (pin[0] - a[0]) / L, uz = (pin[1] - a[1]) / L;
  const on = (x, z, names) => groundAt(x, z) !== null && names.includes(surfaceAt(x, z));
  let n = 0, d0 = 99, d1 = -99, w0 = 99, w1 = -99;
  for (let u = -60; u <= 60; u += 1.5) for (let v = -60; v <= 60; v += 1.5) { if (on(pin[0] + ux * u - uz * v, pin[1] + uz * u + ux * v, ['green'])) { n++; d0 = Math.min(d0, u); d1 = Math.max(d1, u); w0 = Math.min(w0, v); w1 = Math.max(w1, v); } }
  const xs = line.map(p => p[0]), zs = line.map(p => p[1]), x0 = Math.min(...xs) - 70, z0 = Math.min(...zs) - 70;
  const W = Math.ceil((Math.max(...xs) + 70 - x0) / 3), H = Math.ceil((Math.max(...zs) + 70 - z0) / 3), g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (on(x0 + i * 3, z0 + j * 3, ['sand', 'waste', 'powder'])) g[j * W + i] = 1;
  let byGreen = 0, inFairway = 0, biggest = 0;
  for (let k = 0; k < g.length; k++) if (g[k] === 1) {
    const st = [k]; g[k] = 2; let c = 0, sx = 0, sz = 0;
    while (st.length) { const q = st.pop(), i = q % W, j = (q - i) / W; c++; sx += x0 + i * 3; sz += z0 + j * 3; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + di, j2 = j + dj; if (i2 >= 0 && j2 >= 0 && i2 < W && j2 < H && g[j2 * W + i2] === 1) { g[j2 * W + i2] = 2; st.push(j2 * W + i2); } } }
    if (c * 9 < 40) continue;
    biggest = Math.max(biggest, c * 9); if (Math.hypot(sx / c - pin[0], sz / c - pin[1]) < 55) byGreen++; else inFairway++;
  }
  let width = null, turn = 0;
  if (par > 3) {
    const s = signature(line, (x, z) => on(x, z, ['fairway'])); if (s) width = s.meanW;
    for (let k = 1; k < line.length - 1; k++) { let d = (Math.atan2(line[k + 1][0] - line[k][0], line[k + 1][1] - line[k][1]) - Math.atan2(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1])) * 180 / Math.PI; while (d > 180) d -= 360; while (d < -180) d += 360; turn += Math.abs(d); }
  }
  return { par, yards, green: n * 2.25, depthOverWidth: n ? (d1 - d0) / Math.max(1, w1 - w0) : 0, byGreen, inFairway, biggest, width, turn };
}

// the rules for a nine: F = [{ n, name, ...holeFacts }] -> { flags, past, edges }
// Each dial must vary (the owner, 12 November 2026: "we don't need to go to the extreme on tiny green and huge
// green, just variance and touching the extremes sometimes"). So a dial is flagged when its holes cluster, never
// for missing an extreme; the edges of real golf are counted across all the dials, and a nine wants three of them.
export function nineFlags(F) {
  const flags = [], past = [], edges = [], rng = (a, d = 0) => `${Math.min(...a).toFixed(d)}–${Math.max(...a).toFixed(d)}`;
  const dial = (key, label, list, val, need, how) => {
    const E = EDGE[key], v = list.map(val); if (v.length < 2) return;
    const lo = Math.min(...v), hi = Math.max(...v);
    if (!need(lo, hi)) flags.push(`${label} cluster: ${rng(v)} ${E.unit}; ${how}`);
    if (lo <= E.lo) edges.push(`${label.toLowerCase()} down to ${lo.toFixed(0)} ${E.unit}`);
    if (hi >= E.hi) edges.push(`${label.toLowerCase()} up to ${hi.toFixed(0)} ${E.unit}`);
    for (const h of list) { const x = val(h); if (x < E.pastLo || x > E.pastHi) past.push(`${h.n} ${h.name} (${label.toLowerCase()} ${x.toFixed(0)} ${E.unit})`); }
  };
  const greens = F.filter(h => h.green > 0);
  dial('green', 'Greens', greens, h => h.green, (lo, hi) => hi >= 1.5 * lo, 'the biggest should be half as big again as the smallest, or more');
  const med = [...greens.map(h => h.green)].sort((a, b) => a - b)[Math.floor(greens.length / 2)], same = greens.filter(h => Math.abs(h.green - med) <= med * 0.1).length;
  if (same > 4) flags.push(`Greens: ${same} of ${greens.length} are within 10% of ${med.toFixed(0)} m²; four at most`);
  dial('par3', 'Par 3s', F.filter(h => h.par === 3), h => h.yards, (lo, hi) => hi - lo >= 40, '40 yd or more from the shortest to the longest');
  dial('par4', 'Par 4s', F.filter(h => h.par === 4), h => h.yards, (lo, hi) => hi - lo >= 120, '120 yd or more from the shortest to the longest');
  dial('par5', 'Par 5s', F.filter(h => h.par === 5), h => h.yards, (lo, hi) => hi - lo >= 50, '50 yd or more between them');
  dial('width', 'Fairway widths', F.filter(h => h.width), h => h.width, (lo, hi) => hi - lo >= 25, '25 m or more from the tightest to the widest');
  const total = F.map(h => h.byGreen + h.inFairway);
  if (Math.max(...total) - Math.min(...total) < 4) flags.push(`Bunker counts cluster: ${total.join(' ')} a hole; four or more between the fewest and the most`);
  const by = {}; for (const h of F) by[h.byGreen] = (by[h.byGreen] || 0) + 1;
  for (const [k, v] of Object.entries(by)) if (v > 5) flags.push(`Bunkers: ${v} of ${F.length} greens have exactly ${k} beside them; five at most`);
  if (total.some(t => t === 0)) edges.push('a hole with no bunker');
  if (F.some(h => h.byGreen + h.inFairway >= 6)) edges.push('a field of six or more bunkers');
  if (F.some(h => h.biggest >= 1500)) edges.push(`a ${Math.max(...F.map(h => h.biggest)).toFixed(0)} m² bunker`);
  for (const h of F) if (h.biggest >= 4000) past.push(`${h.n} ${h.name} (a ${h.biggest.toFixed(0)} m² bunker)`);
  const long = F.filter(h => h.par > 3), turns = long.map(h => h.turn);
  if (long.length > 3 && Math.max(...turns) - Math.min(...turns) < 45) flags.push(`Bends cluster: ${rng(turns)}°; 45° or more between the straightest and the sharpest`);
  if (turns.some(t => t >= 70)) edges.push(`a ${Math.max(...turns).toFixed(0)}° bend`);
  if (turns.some(t => t <= 8)) edges.push('a dead-straight hole');
  if (edges.length < 3) flags.push(`Edges of real golf: the nine touches ${edges.length} (${edges.join('; ') || 'none'}); three or more, on different dials`);
  if (past.length === 0) flags.push('Past real golf: no hole goes beyond what a real course has; one a nine');
  if (past.length > 2) flags.push(`Past real golf: ${past.length} holes; two at most`);
  return { flags, past, edges };
}

export async function courseFacts(c) {
  if (PLANNED.includes(c)) {
    const S = await import(path.join(REPO, 'tools', c, 'scene.mjs')), M = await import(path.join(REPO, 'tools', c, 'holes.mjs')), back = M.BACK || M.COURSE.teeSets[0].id;
    return { name: M.COURSE.name, holes: M.HOLES.map((h, i) => ({ n: i + 1, name: h.name, ...holeFacts(h.line, (x, z) => S.BUILT[i].ground(x, z), (x, z) => S.BUILT[i].surface(x, z), h.par, h.yards[back]) })) };
  }
  const { COURSE, HOLES } = await loadCourse(c), back = COURSE.teeSets[0].id, xz = p => Array.isArray(p) ? p : [p.x, p.z];
  return { name: COURSE.name, holes: HOLES.map((h, i) => {
    const T = createTerrain(h), mids = h.line && h.line.length >= 2 ? h.line.slice(1, -1) : (h.targets || []).filter(t => !t.pin && !t.bold).map(t => [t.x, t.z]);
    return { n: i + 1, name: h.name, ...holeFacts([xz(h.tees[back]), ...mids, xz(h.green?.pins?.[0] || h.pin)], T.groundAt, T.surfaceAt, h.par, h.yards[back]) };
  }) };
}

if (process.argv[1] && process.argv[1].endsWith('spread.mjs')) {
  let names = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!names.length || names[0] === 'all') names = [...Object.keys(MODULES), ...PLANNED];
  for (const c of names) {
    const { name, holes: F } = await courseFacts(c), yd = p => F.filter(h => h.par === p).map(h => h.yards).sort((a, b) => a - b).join(' ');
    console.log(`\n== ${name}`);
    console.log(`greens m²: ${F.map(h => h.green.toFixed(0)).join(' ')}`);
    console.log(`yards: par 3s ${yd(3)} | par 4s ${yd(4)} | par 5s ${yd(5)}`);
    console.log(`fairway mean width m: ${F.filter(h => h.width).map(h => `${h.n}:${h.width.toFixed(0)}`).join(' ')}`);
    console.log(`bunkers by the green: ${F.map(h => h.byGreen).join(' ')} | along the fairway: ${F.map(h => h.inFairway).join(' ')} | biggest ${Math.max(...F.map(h => h.biggest)).toFixed(0)} m²`);
    console.log(`bends °: ${F.filter(h => h.par > 3).map(h => `${h.n}:${h.turn.toFixed(0)}`).join(' ')}`);
    const { flags, past, edges } = nineFlags(F);
    console.log(`edges of real golf touched: ${edges.join('; ') || 'none'}`);
    console.log(`past real golf: ${past.join('; ') || 'none'}`);
    for (const f of flags) console.log('! ' + f);
  }
}
