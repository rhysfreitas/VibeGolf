// node tools/review/design.mjs <course ...|all> [--seeds=12] [--no-play] [--only=decisions|gate]
// The checks behind docs/COURSE-DESIGN.md "The nine" and "The hole card" that the other tools don't make:
//   skeleton   par order, length, net height change and bend of every hole, and, with more than one course,
//              where the courses repeat each other (the same par order, the same kind of hole in the same slot)
//   rhythm     the spread of par-4 and par-3 lengths, the compass spread, bends each way, opener and finish
//   view       from the stance camera on the back tee: is the tee shot's target in the frame, and is it blind?
//   carry      the longest forced carry on each tee set's line against 60% of that set's drive
//   gate       the physics play-through as a pass or fail: every hole finishes, and how far over par it plays
//              (back tees at full length, forward tees with a player 80% as long)
//   decisions  for each hole with a bold target: what the bold line gains, and the strokes each route takes for a
//              long hitter (the back tees, 10% longer than the tool's stock player: about 295 yd) and a short one
//              (the third tee set, 82%); a choice is real when the bold line pays for one and not the other.
//              Use --seeds=24 or more here: at 6 seeds a difference under 0.3 strokes is noise. A bold target out of
//              reach from the tee is scored as a second-shot choice (the drive plays safe, the second goes at it); a
//              Green target marked bold is a drivable green
// Playable courses come from src/course; planned ones (emberfell, lostvalley) give a skeleton row from their plan data.
// Lines starting `!` break a rule. Seconds a course without the play, a few minutes with it.
import path from 'path';
import { createTerrain } from '../../src/course/terrain.js';
import { STANCE } from '../../src/stance.js';
import { loadCourse, MODULES, REPO } from './page.mjs';
import { makePlayer } from './play.mjs';

const args = process.argv.slice(2), flag = k => args.find(a => a.startsWith(`--${k}`));
const SEEDS = +((flag('seeds=') || '--seeds=12').split('=')[1]), PLAY = !flag('no-play'), ONLY_DEC = !!flag('only=decisions'), ONLY_GATE = !!flag('only=gate');
const PLANNED = ['emberfell', 'lostvalley'];
let names = args.filter(a => !a.startsWith('--'));
if (!names.length || names[0] === 'all') names = [...Object.keys(MODULES), ...PLANNED];
const YD = 0.9144, yd = m => Math.round(m / YD), deg = r => r * 180 / Math.PI;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const BOLD_NAME = /(bite|over the|through the|go for|thread|across the)/i;

// signed turns along a polyline (x east, z south: positive is a right turn) -> 'L' | 'R' | 'S' | '|'
function bendOf(L) {
  let l = 0, r = 0;
  for (let i = 1; i < L.length - 1; i++) {
    const a = [L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]], b = [L[i + 1][0] - L[i][0], L[i + 1][1] - L[i][1]];
    const t = deg(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
    if (t > 0) r += t; else l -= t;
  }
  return l > 10 && r > 10 ? 'S' : r - l > 12 ? 'R' : l - r > 12 ? 'L' : '|';
}
const tagsOf = (par, yards, dy) => [par === 4 && yards <= 320 ? 'drivable' : '', dy !== null && dy <= -20 ? 'drop' : '', dy !== null && dy >= 20 ? 'climb' : ''].filter(Boolean);

const rows = {}; // course -> [{ n, name, par, yards, dy, bend, tags }]
for (const c of names) {
  if (PLANNED.includes(c)) {
    const m = await import(path.join(REPO, 'tools', c, 'holes.mjs'));
    rows[c] = m.HOLES.map(h => { const y = h.yards[m.BACK]; return { n: h.n, name: h.name, par: h.par, yards: y, dy: null, bend: bendOf(h.line), tags: tagsOf(h.par, y, null) }; });
    console.log(`\n== ${c} (planned: skeleton only; heights are in its plan book)`);
    continue;
  }
  const { HOLES, COURSE } = await loadCourse(c), sets = COURSE.teeSets, back = sets[0].id;
  const { playHole } = makePlayer(COURSE);
  const out = [], T = HOLES.map(h => createTerrain(h));
  console.log(`\n== ${COURSE.name}`);
  rows[c] = HOLES.map((h, i) => {
    const t = T[i], tee = h.tees[back], pin = h.green?.pins?.[0] || h.pin, y = h.yards[back];
    const L = h.line || [tee, ...(h.targets || []).filter(x => !x.pin && !x.bold).map(x => [x.x, x.z]), pin];
    const dy = Math.round((t.groundAt(pin[0], pin[1]) ?? 0) - (t.groundAt(tee[0], tee[1]) ?? 0));
    return { n: i + 1, name: h.name, par: h.par, yards: y, dy, bend: bendOf(L), tags: tagsOf(h.par, y, dy) };
  });

  // --- rhythm ---
  const R = rows[c], p4 = R.filter(r => r.par === 4).map(r => r.yards).sort((a, b) => a - b), p3 = R.filter(r => r.par === 3).map(r => r.yards).sort((a, b) => a - b);
  const quad = new Set(HOLES.map(h => Math.floor((((h.heading ?? 0) % 360) + 360) % 360 / 90))), bends = k => R.filter(r => r.bend === k).length;
  console.log(`rhythm: par ${R.reduce((a, r) => a + r.par, 0)} (${R.map(r => r.par).join(' ')}); par 4s ${p4.join(', ')} yd; par 3s ${p3.join(', ')} yd; bends L ${bends('L')} R ${bends('R')} S ${bends('S')} straight ${bends('|')}; compass quarters used ${quad.size} of 4`);
  if (p4.length >= 3 && !(p4[0] <= 340 && p4.at(-1) >= 420)) console.log(`! par 4s want a short one (340 yd or less) and a long one (420 or more) from the back tees: ${p4[0]}–${p4.at(-1)}`);
  if (quad.size < 3) console.log(`! holes face only ${quad.size} quarters of the compass: the wind plays the same on most of them`);
  if (bends('|') > 3) console.log(`! ${bends('|')} straight holes`);
  if (Math.abs(bends('L') - bends('R')) > 2) console.log(`! bends lean one way: ${bends('L')} left, ${bends('R')} right`);
  for (let i = 1; i < R.length; i++) if (R[i].par === R[i - 1].par && R[i].par !== 4) console.log(`! holes ${i} and ${i + 1} are both par ${R[i].par}`);

  // --- per hole: view, carry, gate, decisions ---
  let blind = 0;
  const marked = HOLES.some(h => (h.targets || []).some(x => x.bold));
  for (const [i, h] of HOLES.entries()) {
    const t = T[i], pin = h.green?.pins?.[0] || h.pin, tg = (h.targets || []).filter(x => !x.pin), notes = [];
    // a pin target marked bold is a drivable green: the bold line is the green itself
    const gBold = (h.targets || []).find(x => x.pin && x.bold);
    // names only stand in for marks on a course that marks none (the Aerie, Red Mesa, Hollowmere)
    const inferred = !marked, bold = [...tg.filter(x => x.bold || (inferred && BOLD_NAME.test(x.name))), ...(gBold ? [{ name: 'Drive the green', x: pin[0], z: pin[1], green: true }] : [])], safe = tg.filter(x => !bold.includes(x));
    const aimFrom = (tee, reach, list) => { // the tee shot's target, as auto-aim picks it
      if (h.par === 3 || dist(tee, pin) <= reach) return pin;
      const dp = dist(tee, pin), ok = list.map(x => [x.x, x.z]).filter(p => dist(p, pin) < dp - 5 && dist(p, tee) <= reach);
      return ok.find((p, k) => dist(p, tee) >= 0.6 * reach || k === ok.length - 1) || list.map(x => [x.x, x.z])[0] || pin;
    };
    // view from the stance camera on the back tee
    { const tee = h.tees[back], aim = aimFrom(tee, 245, safe), d = dist(tee, aim), ux = (aim[0] - tee[0]) / d, uz = (aim[1] - tee[1]) / d;
      const ey = (t.groundAt(tee[0], tee[1]) ?? 0) + STANCE.up, ex = tee[0] - ux * STANCE.back, ez = tee[1] - uz * STANCE.back, ay = (t.groundAt(aim[0], aim[1]) ?? 0) + 0.3;
      const half = STANCE.fov / 2, pitch = deg(Math.atan2(STANCE.up, STANCE.back)) - deg(Math.atan((2 * STANCE.ballAt - 1) * Math.tan(half * Math.PI / 180)));
      const el = deg(Math.atan2(ay - ey, d + STANCE.back)), lo = -(pitch + half), hi = half - pitch;
      let hid = 0;
      for (let k = 2; k < 60; k++) { const f = k / 60, g = t.groundAt(ex + (aim[0] - ex) * f, ez + (aim[1] - ez) * f); if (g !== null && g > ey + (ay - ey) * f + 0.3) { hid = Math.max(hid, g - (ey + (ay - ey) * f)); } }
      if (hid >= 1.5) { blind++; notes.push(`blind tee shot (ground stands ${hid.toFixed(1)} m into the sight line to the landing area)`); }
      if (el < lo + 2 || el > hi - 2) notes.push(`! the tee shot's target sits ${el.toFixed(0)}° from level: outside the fixed view (${lo.toFixed(0)}° to ${hi.toFixed(0)}°)`);
    }
    // forced carry on each tee set's line
    for (const s of sets) {
      const tee = h.tees[s.id]; if (!tee) continue;
      const drive = (s.minDrive || 150), aim = aimFrom(tee, drive * 1.05 * YD, safe), d = dist(tee, aim); let far = 0;
      for (let m = 8; m < d; m += 2) { const x = tee[0] + (aim[0] - tee[0]) * m / d, z = tee[1] + (aim[1] - tee[1]) * m / d, g = t.groundAt(x, z), sf = g === null ? 'void' : t.surfaceAt(x, z); if (sf === 'void' || sf === 'water') far = m + 2; }
      // a par 3's tee shot is its carry: only the forward set is held to the rule there
      if (yd(far) > 0.6 * drive) notes.push(`${h.par === 3 && s !== sets.at(-1) ? '' : '! '}${s.name} tees: forced carry ${yd(far)} yd, over 60% of a ${drive} yd drive`);
    }
    if (PLAY) {
      // gate: back tees at full reach, forward tees at 80%
      for (const [s, scale, who] of ONLY_DEC ? [] : [[sets[0], 1, 'long'], [sets.at(-1), 0.8, 'short']]) {
        let sum = 0, stuck = 0, pen = 0;
        for (let k = 0; k < SEEDS; k++) { const r = playHole(h, t, s.id, 101 + k * 37 + i * 11, { scale }); sum += r.n; pen += r.pen; if (r.stuck) stuck++; }
        const over = sum / SEEDS - h.par;
        notes.push(`${stuck || over > 2 ? '! ' : ''}${s.name} (${who} hitter): ${over >= 0 ? '+' : ''}${over.toFixed(1)} to par, ${(pen / SEEDS).toFixed(1)} penalties a hole${stuck ? `, never finished on ${stuck} of ${SEEDS}` : ''}`);
      }
      // decisions: the bold line against the safe one
      if (bold.length && h.par > 3 && !ONLY_GATE) {
        const B = bold[0], bp = [B.x, B.z];
        for (const [s, scale, who] of [[sets[0], 1.1, 'long'], [sets[Math.min(2, sets.length - 1)], 0.82, 'short']]) {
          const tee = h.tees[s.id], reach = 245 * scale, sAim = aimFrom(tee, reach, safe), gain = yd(dist(sAim, pin) - dist(bp, pin));
          const run = o => { let n = 0, pen = 0; for (let k = 0; k < SEEDS; k++) { const r = playHole(h, t, s.id, 503 + k * 29 + i * 7, { scale, ...o }); n += r.n; pen += r.pen; } return [n / SEEDS, pen / SEEDS]; };
          const can = dist(tee, bp) <= reach * 1.05, [sn, sp] = run({ skip: bold }), verdict = (bn, sn) => bn < sn - 0.1 ? 'the bold line pays' : bn > sn + 0.1 ? 'the bold line costs' : 'no difference';
          if (can) {
            const [bn, bpn] = run({ first: bp });
            notes.push(`"${B.name}"${inferred ? ' (bold by its name: mark it bold in the data)' : ''}, ${who} hitter from ${s.name}: leaves ${gain} yd less; safe ${sn.toFixed(2)} strokes (${sp.toFixed(2)} pen), bold ${bn.toFixed(2)} (${bpn.toFixed(2)} pen): ${verdict(bn, sn)}`);
            if (who === 'long' && gain < 25) notes.push(`! "${B.name}" gains only ${gain} yd on the safe target: it needs 25 yd or a better angle to be a choice`);
          } else if (B.green) notes.push(`"${B.name}", ${who} hitter from ${s.name}: out of reach (${yd(dist(tee, bp))} yd); safe ${sn.toFixed(2)}`);
          else {
            // out of reach from the tee: a choice made with the second shot. The tee shot plays the safe line, then the
            // second goes at the bold target (as far as that lie reaches) against the safe lay-up, the nearest safe
            // target to the pin that is further from it than the bold one
            const r2 = 225 * scale, land = sAim, lay = safe.map(x => [x.x, x.z]).filter(p => dist(p, pin) > dist(bp, pin)).sort((a, b) => dist(a, pin) - dist(b, pin))[0];
            const [bn, bpn] = run({ skip: bold, first: bp, firstAt: 1 }), g2 = lay ? yd(dist(lay, pin) - dist(bp, pin)) : null;
            notes.push(`"${B.name}"${inferred ? ' (bold by its name: mark it bold in the data)' : ''}, ${who} hitter from ${s.name}: a second-shot choice (${yd(dist(land, bp))} yd from the drive${dist(land, bp) > r2 * 1.05 ? ', out of reach' : ''})${g2 !== null ? `, leaves ${g2} yd less than the lay-up` : ''}; safe ${sn.toFixed(2)} strokes (${sp.toFixed(2)} pen), bold ${bn.toFixed(2)} (${bpn.toFixed(2)} pen): ${verdict(bn, sn)}`);
          }
        }
      }
    }
    const r = R[i];
    console.log(`${i + 1} ${h.name}: par ${h.par}, ${r.yards} yd, ${r.dy >= 0 ? '+' : ''}${r.dy} m, bend ${r.bend}${r.tags.length ? ', ' + r.tags.join(', ') : ''}${bold.length ? '' : h.par > 3 ? ', no bold target' : ''}`);
    for (const n of notes) console.log('   ' + n);
  }
  const dec = HOLES.filter(h => (h.targets || []).some(x => x.pin ? x.bold : (x.bold || (!HOLES.some(k => (k.targets || []).some(y => y.bold)) && BOLD_NAME.test(x.name))))).length;
  console.log(`${blind > 2 ? '! ' : ''}blind tee shots: ${blind} (two a nine at most); holes with a bold target: ${dec} (two to four a nine)`);
}

// --- across the courses: where they repeat each other ---
const cs = Object.keys(rows);
if (cs.length > 1) {
  console.log('\n== across the courses');
  const w = Math.max(...cs.map(c => c.length));
  for (const c of cs) console.log(`${c.padEnd(w)}  ${rows[c].map(r => `${r.par}${r.bend}${r.tags.includes('drivable') ? 'd' : ''}${r.tags.includes('drop') ? '↓' : ''}${r.tags.includes('climb') ? '↑' : ''}`.padEnd(5)).join(' ')}  par ${rows[c].reduce((a, r) => a + r.par, 0)}`);
  console.log('(par, bend: L R S or | straight, d = drivable par 4, ↓ ↑ = 20 m or more down or up; planned courses show no heights)');
  for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
    const A = rows[cs[a]], B = rows[cs[b]], same = A.filter((r, i) => B[i] && r.par === B[i].par).length;
    if (same === A.length) console.log(`! ${cs[a]} and ${cs[b]} have the same par order`);
    else if (same >= A.length - 2) console.log(`  ${cs[a]} and ${cs[b]} share the par on ${same} of ${A.length} holes`);
  }
  for (let i = 0; i < 9; i++) {
    const par = {}; for (const c of cs) if (rows[c][i]) (par[rows[c][i].par] ||= []).push(c);
    for (const [p, list] of Object.entries(par)) if (list.length >= Math.max(4, Math.ceil(cs.length * 0.7))) console.log(`! hole ${i + 1} is a par ${p} on ${list.length} of ${cs.length} courses`);
    for (const k of ['S', 'drivable']) { const list = cs.filter(c => rows[c][i] && (rows[c][i].bend === k || rows[c][i].tags.includes(k))); if (list.length >= 3) console.log(`! hole ${i + 1} is ${k === 'S' ? 'an S-bend' : 'a drivable par 4'} on ${list.join(', ')}`); }
  }
  const tot = new Set(cs.map(c => rows[c].reduce((a, r) => a + r.par, 0))), mix = new Set(cs.map(c => [3, 4, 5].map(p => rows[c].filter(r => r.par === p).length).join('/')));
  if (tot.size === 1 && cs.length > 2) console.log(`! every course is par ${[...tot][0]}`);
  if (mix.size === 1 && cs.length > 2) console.log(`! every course has the same mix of par 3s/4s/5s: ${[...mix][0]}`);
  const up = cs.filter(c => rows[c].at(-1).dy !== null && rows[c].at(-1).dy >= 8); if (up.length >= 3) console.log(`! the last hole climbs on ${up.join(', ')}`);
  const dn = cs.filter(c => rows[c][0].dy !== null && rows[c][0].dy <= -8); if (dn.length >= 3) console.log(`! the first hole drops on ${dn.join(', ')}`);
}
