// node tools/review/relief.mjs <course ...|all>
// What does the ground do on each hole? (docs/COURSE-DESIGN.md "Height forms".)
// The elevation rule used to count only the net height from tee to green, so a steady ramp passed and every hole
// came out "slightly up, slightly down, a bigger drop if it's a par 3". This walks every hole along its playing
// line (the height every 5 m, and across the line at each point), names its height form and flags a course whose
// holes all do the same thing.
//   bold      table top (a face of 5 m or more inside 25 m with level ground on top), hillside bench (the landing
//             area leans 7% or more one way), valley carry (a dip of 6 m or more between tee and landing area),
//             stepped (two or more steps of 3 m between level ground), big drop / big climb (25 m or more from tee to green)
//   moderate  crest and run, hog's back (crowned across), half-pipe (banked both sides), tee drop (12 m or more down
//             to the landing area), perched green (4 m up in the last 45 m), dip in front, fall-away
//   plain     ramp up, ramp down, level
//   par 3s    drop, uphill, across a gulf, level
// Rules it flags with `!`: fewer than two bold holes; a form more than twice, or twice running; more than three
// plain holes among the par 4s and 5s; more than two tee drops; more than one drop par 3; every landing area
// leaning about the same.
// Playable courses are read from the game's terrain; a planned one from tools/<course>/scene.mjs (BUILT).
import path from 'path';
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, MODULES, REPO } from './page.mjs';

const PLANNED = ['halcyon', 'buriedkingdom'];
export const BOLD = ['table top', 'hillside bench', 'valley carry', 'stepped', 'big drop', 'big climb'];
export const PLAIN = ['ramp up', 'ramp down', 'level'];
const YD = 0.9144;

// line: [[x, z] ...] from the back tee to the pin; groundAt(x, z) -> height or null; onFw(x, z) -> is it fairway
export function heightForm(line, groundAt, onFw, par, landAt = null) {
  const P = []; let acc = 0;
  for (let k = 0; k < line.length - 1; k++) {
    const [ax, az] = line[k], [bx, bz] = line[k + 1], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l;
    for (let s = 0; s < l; s += 5) {
      const x = ax + ux * s, z = az + uz * s, y = groundAt(x, z), q = o => groundAt(x - uz * o, z + ux * o);
      P.push({ s: acc + s, y, l12: q(-12), r12: q(12), fw: y !== null && onFw(x, z) });   // q(+o) is right of the line (it was read as left, so every lean was reported the wrong way round)
    }
    acc += l;
  }
  const len = acc, G = P.filter(p => p.y !== null); if (G.length < 6) return null;
  const end = line.at(-1), yG = groundAt(end[0], end[1]) ?? G.at(-1).y, y0 = G[0].y, net = yG - y0;
  const near = s => { let b = G[0]; for (const p of G) if (Math.abs(p.s - s) < Math.abs(b.s - s)) b = p; return b; };
  const span = (a, b) => G.filter(p => p.s >= a && p.s <= b);
  const gap = P.some(p => p.y === null && p.s > 15 && p.s < len - 15);
  if (par === 3) {
    const mid = span(20, len - 20), low = mid.length ? Math.min(...mid.map(p => p.y)) : y0;
    const form = net <= -8 ? 'drop par 3' : net >= 5 ? 'uphill par 3' : (gap || low <= Math.min(y0, yG) - 6) ? 'par 3 across a gulf' : 'level par 3';
    return { form, also: [], net, len, lean: 0, par };
  }
  const sL = landAt ?? Math.min(len * 0.62, 250 * YD), L = near(sL), found = [];
  // table top: a face (5 m up inside 25 m: 20% or steeper) at least 80 m out, then 60 m of ground level with its top
  for (const a of G) {
    if (a.s < 80 || a.s > len - 110) continue;
    const b = near(a.s + 25); if (b.y - a.y < 5) continue;
    const top = span(b.s + 5, b.s + 65); if (top.length < 10) continue;
    if (top.every(p => Math.abs(p.y - top[0].y) <= 1.5)) { found.push('table top'); break; }
  }
  // hillside bench: the landing area leans one way, 7% or more on average
  const zone = span(sL - 40, sL + 40).filter(p => p.l12 !== null && p.r12 !== null);
  const lean = zone.length ? zone.reduce((t, p) => t + (p.r12 - p.l12) / 24 * 100, 0) / zone.length : 0;
  if (Math.abs(lean) >= 7 && Math.abs(lean) < 30) found.push('hillside bench');
  // valley carry: a dip between the tee and the landing area
  const carry = span(20, sL - 20);
  if (gap === false && carry.length && Math.min(...carry.map(p => p.y)) <= Math.min(y0, L.y) - 6) found.push('valley carry');
  // stepped: two or more steps (3 m up or down inside 20 m, with the 30 m before and after each nearly level), past the tee
  let steps = 0, last = -99;
  for (const a of G) {
    if (a.s < 70 || a.s > len - 50 || a.s - last < 50) continue;
    const b = near(a.s + 20), pre = near(a.s - 30), post = near(b.s + 30);
    if (Math.abs(b.y - a.y) >= 3 && Math.abs(a.y - pre.y) <= 1.5 && Math.abs(post.y - b.y) <= 1.5) { steps++; last = b.s; }
  }
  if (steps >= 2 && !found.includes('table top')) found.push('stepped');
  if (net <= -25) found.push('big drop'); if (net >= 25) found.push('big climb');
  // crest and run: a crest 4 m over the ground 60 m either side of it, on the way to the landing area
  for (const c of span(60, sL + 40)) { const a = near(c.s - 60), b = near(c.s + 60); if (c.y >= a.y + 4 && c.y >= b.y + 4) { found.push('crest and run'); break; } }
  // across the landing area: crowned (hog's back) or banked (half-pipe)
  const cross = zone.length ? zone.reduce((t, p) => t + (p.y - (p.l12 + p.r12) / 2), 0) / zone.length : 0;
  if (cross >= 0.6) found.push("hog's back"); if (cross <= -0.8) found.push('half-pipe');
  if (L.y - y0 <= -12) found.push('tee drop');
  // the green: perched, a dip in front, or falling away
  const g45 = near(len - 45), front = span(len - 70, len - 10), g80 = near(len - 80);
  if (yG - g45.y >= 4) found.push('perched green');
  else if (front.length && Math.min(...front.map(p => p.y)) <= Math.min(g80.y, yG) - 2.5) found.push('dip in front');
  else if (near(len - 60).y - yG >= 3) found.push('fall-away');
  const plain = net >= 6 ? 'ramp up' : net <= -6 ? 'ramp down' : 'level';
  const form = found[0] || plain;
  return { form, also: found.slice(1), net, len, lean, par, toLand: L.y - y0, toGreen: yG - L.y };
}

export async function courseRelief(c) {
  if (PLANNED.includes(c)) {
    const S = await import(path.join(REPO, 'tools', c, 'scene.mjs')), H = await import(path.join(REPO, 'tools', c, 'holes.mjs'));
    return { name: H.COURSE.name, holes: H.HOLES.map((h, i) => { const B = S.BUILT[i]; return { n: i + 1, name: h.name, r: heightForm(h.reliefLine || h.line, (x, z) => B.ground(x, z), (x, z) => B.surface(x, z) === 'fairway', h.par) }; }) };   // reliefLine: a hole whose height form is on its bold line (a valley carry beside a level way round)
  }
  const { COURSE, HOLES } = await loadCourse(c), back = COURSE.teeSets[0].id;
  return { name: COURSE.name, holes: HOLES.map((h, i) => {
    const T = createTerrain(h), xz = p => Array.isArray(p) ? p : [p.x, p.z], pin = xz(h.green?.pins?.[0] || h.pin), tee = xz(h.tees[back]);
    const mids = h.line && h.line.length >= 2 ? h.line.slice(1, -1) : (h.targets || []).filter(t => !t.pin && !t.bold).map(t => [t.x, t.z]);
    return { n: i + 1, name: h.name, r: heightForm([tee, ...mids, pin], T.groundAt, (x, z) => T.groundAt(x, z) !== null && T.surfaceAt(x, z) === 'fairway', h.par) };
  }) };
}

if (process.argv[1] && process.argv[1].endsWith('relief.mjs')) {
  let names = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!names.length || names[0] === 'all') names = [...Object.keys(MODULES), ...PLANNED];
  const all = {};
  for (const c of names) {
    const { name, holes } = await courseRelief(c), F = holes.filter(h => h.r);
    console.log(`\n== ${name}`);
    for (const h of F) { const r = h.r; console.log(`${h.n} ${h.name} (par ${r.par}): ${r.form}${r.also.length ? ' (also ' + r.also.join(', ') + ')' : ''}; ${r.net >= 0 ? '+' : ''}${r.net.toFixed(0)} m${r.par > 3 ? `, tee to landing ${r.toLand.toFixed(0)}, landing to green ${r.toGreen.toFixed(0)}, landing area leans ${Math.abs(r.lean).toFixed(1)}% ${r.lean > 0.5 ? 'up to the right' : r.lean < -0.5 ? 'up to the left' : ''}` : ''}`); all[r.form] = (all[r.form] || 0) + 1; }
    const by = {}; for (const h of F) (by[h.r.form] ||= []).push(h.n);
    const long = F.filter(h => h.r.par > 3), has = k => F.filter(h => h.r.form === k || h.r.also.includes(k));
    const bold = F.filter(h => BOLD.includes(h.r.form) || h.r.also.some(k => BOLD.includes(k)));
    if (bold.length < 2) console.log(`! ${bold.length} bold hole${bold.length === 1 ? '' : 's'} (a table top, a hillside bench, a valley carry, steps, 25 m up or down): two or three a nine`);
    for (const [k, v] of Object.entries(by)) if (v.length > 2 && !PLAIN.includes(k)) console.log(`! ${v.length} holes are a ${k} (holes ${v.join(', ')}): a height form twice a course at most`);
    for (let i = 1; i < F.length; i++) if (F[i].r.form === F[i - 1].r.form && F[i].n === F[i - 1].n + 1) console.log(`! holes ${F[i - 1].n} and ${F[i].n} in a row are both a ${F[i].r.form}`);
    const plain = long.filter(h => PLAIN.includes(h.r.form));
    if (plain.length > 3) console.log(`! ${plain.length} of ${long.length} par 4s and 5s are plain (ramp or level: holes ${plain.map(h => h.n).join(', ')}): three at most`);
    if (has('tee drop').length > 2) console.log(`! ${has('tee drop').length} tee shots drop 12 m or more to the landing area (holes ${has('tee drop').map(h => h.n).join(', ')}): two at most`);
    if ((by['drop par 3'] || []).length > 1) console.log(`! ${by['drop par 3'].length} par 3s are drops (holes ${by['drop par 3'].join(', ')}): one a course`);
    const leans = long.map(h => Math.abs(h.r.lean)).filter(v => v < 30);
    if (leans.length > 3 && Math.max(...leans) - Math.min(...leans) < 3) console.log(`! every landing area leans about the same (${Math.min(...leans).toFixed(1)}–${Math.max(...leans).toFixed(1)}%): want some near level, most 2–5% and one or two at 7% or more`);
    console.log(`forms: ${Object.entries(by).map(([k, v]) => `${k} ${v.length}`).join(', ')}; bold holes ${bold.map(h => h.n).join(', ') || 'none'}`);
  }
  if (names.length > 1) { console.log('\n== across the courses'); for (const [k, v] of Object.entries(all).sort((a, b) => b[1] - a[1])) console.log(`${k}: ${v}`); }
}
