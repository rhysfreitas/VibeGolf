// node tools/review/alike.mjs <course ...|all> [--pairs]
// Are the fairways on a course the same shape? (docs/COURSE-DESIGN.md "Sameness: the repeat budget".)
// The other checks look at one fairway at a time, so nine fairways that each pass can still be nine copies of one
// shape. This walks every par 4 and 5 fairway along its playing line, measures its shape (how wide it is at each
// point, where its middle sits against the line, how many lanes and pieces it has), names its form, and compares
// every fairway with every other, on the course and across the courses.
//   form      spindle (narrow, widest in the middle, narrow again: the stock shape), ribbon (even width), fan (widens),
//             funnel (narrows), hourglass (pinched in the middle), bowl (nearly as wide as it is long), hook (its
//             middle swings off the line by most of a width), scalloped (its middle weaves from side to side as
//             hazards bite in), split (two lanes for a fifth of its length or more), island (a gap in the middle of
//             the fairway for a short stretch), broken (two pieces along the line), stepping stones (three or more)
//   alike     two fairways whose shapes differ by less than 0.25 (0 = identical, about 1 = nothing in common),
//             mirror images counted as the same
// Rules it flags with `!`: a form more than twice on a course, more than two spindles or ribbons together, two holes
// in a row of one form, any pair alike.
// Playable courses are read from the game's terrain; planned ones (emberfell, lostvalley) from their plan data.
import path from 'path';
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, MODULES, REPO } from './page.mjs';

const PLANNED = ['emberfell', 'lostvalley', 'halcyon', 'buriedkingdom'];
const N = 24, ALIKE = 0.25;

const lenOf = L => L.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - L[i][0], p[1] - L[i][1]), 0);
function at(L, s, off) {
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], l = Math.hypot(bx - ax, bz - az);
    if (s <= l || i === L.length - 2) { const ux = (bx - ax) / l, uz = (bz - az) / l; return [ax + ux * s - uz * off, az + uz * s + ux * off]; }
    s -= l;
  }
}

// The shape of a fairway along a line. inFw(x, z) says whether a point is fairway.
export function signature(line, inFw) {
  const len = lenOf(line), rows = [];
  for (let s = 35; s <= len - 25; s += 5) {
    let w = 0, m = 0, lanes = 0, run = 0, lo = null, hi = null;
    for (let o = -110; o <= 110; o += 1) {
      const p = at(line, s, o);
      if (inFw(p[0], p[1])) { run++; w++; m += o; if (lo === null) lo = o; hi = o; } else { if (run >= 5) lanes++; else { w -= run; } run = 0; }
    }
    if (run >= 5) lanes++;
    rows.push({ s, w: lanes ? w : 0, c: lanes && w ? m / w : 0, lanes, span: lanes ? hi - lo : 0 });
  }
  const on = rows.map((r, i) => (r.w > 0 ? i : -1)).filter(i => i >= 0);
  if (on.length < 12) return null;                              // under 60 m of fairway: a par 3's apron
  const R = rows.slice(on[0], on.at(-1) + 1), F = (R.length - 1) * 5, live = R.filter(r => r.w > 0);
  const meanW = live.reduce((a, r) => a + r.w, 0) / live.length;
  let pieces = 1, gap = 0; for (const r of R) { if (r.w === 0) gap++; else { if (gap >= 2) pieces++; gap = 0; } }
  const pick = k => Array.from({ length: N }, (_, i) => { const t = i / (N - 1) * (R.length - 1), a = Math.floor(t), b = Math.min(R.length - 1, a + 1), f = t - a; return R[a][k] * (1 - f) + R[b][k] * f; });
  const w = pick('w').map(v => v / meanW), c = pick('c').map(v => v / meanW), lanes = pick('lanes');
  const third = (a, i) => a.slice(i * 8, i * 8 + 8).reduce((x, y) => x + y, 0) / 8, maxW = Math.max(...live.map(r => r.w));
  const wMax = Math.max(...w), iMax = w.indexOf(wMax), sd = Math.sqrt(w.reduce((a, v) => a + (v - 1) ** 2, 0) / N);
  const mid = w.slice(6, 18), wMid = Math.min(...mid), iMid = 6 + mid.indexOf(wMid);
  const twoLane = R.filter(r => r.lanes >= 2).length / R.length;
  const cR = Math.max(...c) - Math.min(...c);
  // weave: how many times the fairway's middle swings from one side of the line to the other by a fifth of a width
  let weave = 0, ref = c[0]; let dir = 0; for (const v of c) { if (dir >= 0 && v < ref - 0.2) { if (dir > 0) weave++; dir = -1; ref = v; } else if (dir <= 0 && v > ref + 0.2) { if (dir < 0) weave++; dir = 1; ref = v; } else if ((dir > 0 && v > ref) || (dir < 0 && v < ref)) ref = v; }
  let form;
  if (pieces >= 3) form = 'stepping stones';
  else if (pieces === 2) form = 'broken';
  else if (twoLane >= 0.2) form = 'split';
  else if (twoLane >= 0.05) form = 'island';
  else if (maxW / F > 0.45) form = 'bowl';
  else if (cR > 0.9) form = 'hook';
  else if (weave >= 2) form = 'scalloped';
  else if (wMid < 0.7 * Math.max(...w.slice(0, iMid + 1)) && wMid < 0.7 * Math.max(...w.slice(iMid))) form = 'hourglass';
  else if (third(w, 2) > 1.45 * third(w, 0)) form = 'fan';
  else if (third(w, 2) < 0.62 * third(w, 0)) form = 'funnel';
  else if (sd < 0.14) form = 'ribbon';
  else if (iMax >= 5 && iMax <= 18 && w[0] < 0.72 * wMax && w[N - 1] < 0.72 * wMax) form = 'spindle';
  else form = 'uneven';
  return { form, len: F, meanW, maxW, minW: Math.min(...live.map(r => r.w)), pieces, twoLane, cR, w, c, lanes };
}

// 0 = the same shape, about 1 = nothing in common; a mirror image counts as the same
export function distance(a, b) {
  const rms = (x, y, k = 1) => Math.sqrt(x.reduce((s, v, i) => s + (v - k * y[i]) ** 2, 0) / x.length);
  const mean = (x, y) => x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) / x.length;
  return rms(a.w, b.w) + 0.7 * Math.min(rms(a.c, b.c), rms(a.c, b.c, -1)) + 0.5 * Math.abs(a.pieces - b.pieces) + mean(a.lanes, b.lanes);
}

// signatures for one course: [{ n, name, par, sig }]
export async function courseFairways(c) {
  if (PLANNED.includes(c)) {
    const H = await import(path.join(REPO, 'tools', c, 'holes.mjs')), S = await import(path.join(REPO, 'tools', c, 'shapes.mjs'));
    // formLine: a hook is read against the straight line from tee to green, which its fairway wraps round
    return H.HOLES.filter(h => h.par > 3).map(h => { const fd = S.makeFairway(h.line, h.fw || []); return { n: h.n, name: h.name, par: h.par, sig: signature(h.formLine || h.line, (x, z) => fd(x, z) < 0) }; });
  }
  const { HOLES, COURSE } = await loadCourse(c), back = COURSE.teeSets[0].id;
  const lineOf = h => h.line || [h.tees[back], ...(h.targets || []).filter(t => !t.pin && !t.bold).map(t => [t.x, t.z]), h.green?.pins?.[0] || h.pin];
  // Generated courses (a `frame` on every hole) sample their ground from the whole world, so a hole's field also
  // holds its neighbours' fairways; count only the hole's own ground: points nearer its line than any other hole's
  // (The Reclaim's fields come from each hole's own plan data, not a shared world, so they hold only its own fairway:
  // there the filter would drop a hook's fairway that wraps out nearer another hole's line than its own.)
  const framed = HOLES.every(h => h.frame) && !COURSE.city, toW = F => { const a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
    return (x, z) => [F.x + x * rx - z * fx, F.z + x * rz - z * fz]; };
  const WL = framed ? HOLES.map(h => { const W = toW(h.frame); return lineOf(h).map(p => W(...p)); }) : null;
  const dLine = (L, x, z) => { let d = Infinity; for (let i = 0; i < L.length - 1; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; };
  const own = (i, W) => (x, z) => { if (!WL) return true; const [X, Z] = W(x, z), d = dLine(WL[i], X, Z); return WL.every((L, j) => j === i || dLine(L, X, Z) >= d); };
  return HOLES.map((h, i) => ({ h, i })).filter(o => o.h.par > 3).map(({ h, i }) => {
    const T = createTerrain(h), mine = own(i, framed ? toW(h.frame) : null);
    return { n: i + 1, name: h.name, par: h.par, sig: signature(lineOf(h), (x, z) => T.groundAt(x, z) !== null && T.surfaceAt(x, z) === 'fairway' && mine(x, z)) };
  });
}

if (process.argv[1] && process.argv[1].endsWith('alike.mjs')) {
  const args = process.argv.slice(2), PAIRS = args.includes('--pairs');
  let names = args.filter(a => !a.startsWith('--'));
  if (!names.length || names[0] === 'all') names = [...Object.keys(MODULES), ...PLANNED];
  const all = [];
  for (const c of names) {
    const F = (await courseFairways(c)).filter(f => f.sig);
    console.log(`\n== ${c}`);
    for (const f of F) { const s = f.sig; console.log(`${f.n} ${f.name}: ${s.form}; ${Math.round(s.len)} m of fairway, ${Math.round(s.minW)}–${Math.round(s.maxW)} m wide (mean ${Math.round(s.meanW)})${s.pieces > 1 ? `, ${s.pieces} pieces` : ''}${s.twoLane ? `, two lanes for ${Math.round(s.twoLane * 100)}%` : ''}, middle swings ${Math.round(s.cR * s.meanW)} m`); }
    const by = {}; for (const f of F) (by[f.sig.form] ||= []).push(f.n);
    for (const [k, v] of Object.entries(by)) if (v.length > 2) console.log(`! ${v.length} fairways are a ${k} (holes ${v.join(', ')}): a form twice a course at most`);
    const plain = F.filter(f => ['spindle', 'ribbon', 'uneven'].includes(f.sig.form));
    if (plain.length > 2) console.log(`! ${plain.length} of ${F.length} fairways are plain strips (holes ${plain.map(f => f.n).join(', ')}): two at most`);
    for (let i = 1; i < F.length; i++) if (F[i].n === F[i - 1].n + 1 && F[i].sig.form === F[i - 1].sig.form) console.log(`! holes ${F[i - 1].n} and ${F[i].n} in a row are both a ${F[i].sig.form}`);
    let alike = 0;
    for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) {
      const d = distance(F[i].sig, F[j].sig);
      if (d < ALIKE) { alike++; console.log(`! ${F[i].n} ${F[i].name} and ${F[j].n} ${F[j].name} are alike (${d.toFixed(2)})`); }
      else if (PAIRS) console.log(`  ${F[i].n} and ${F[j].n}: ${d.toFixed(2)}`);
    }
    console.log(`${alike ? '! ' : ''}${alike} of ${F.length * (F.length - 1) / 2} pairs alike; forms: ${Object.entries(by).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
    for (const f of F) all.push({ c, ...f });
  }
  if (names.length > 1) {
    console.log('\n== across the courses');
    const by = {}; for (const f of all) (by[f.sig.form] ||= []).push(f);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) console.log(`${k}: ${v.length} of ${all.length} fairways`);
    let n = 0, tot = 0; const worst = {};
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].c !== all[j].c) { tot++; if (distance(all[i].sig, all[j].sig) < ALIKE) { n++; const k = [all[i].c, all[j].c].sort().join(' and '); worst[k] = (worst[k] || 0) + 1; } }
    console.log(`${n} of ${tot} pairs of fairways on different courses are alike${n ? ': ' + Object.entries(worst).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join('; ') : ''}`);
  }
}
