// node tools/review/tips.mjs <course ...|all>
// The tips tee as an option (docs/COURSE-DESIGN.md "The tips tee: an option in the data"). A course that is ready
// carries COURSE.tipsSet = { id, name, color, minDrive } (kept out of teeSets, so the game doesn't offer it) and, on
// every hole, tips: { tee: [x, z], yards }. Turning it on later is then data: put tipsSet first in teeSets and copy
// each hole's tips.tee and tips.yards into tees and yards under its id. This checks each spot is ready for that:
//   ground     real ground under a 10 x 12 m pad, level within 1.2 m, not fairway, green, sand or water
//   length     20-50 yd behind the back tee on a par 4 or 5, 8-30 yd on a par 3; the card yardage within 6 yd of the
//              back tee's yardage plus that distance
//   overhead   no rock within 45 m above the spot
//   landing    40 m or more of fairway across the line where a tips drive (tipsSet.minDrive, 290 yd if unset)
//              carries to, on par 4s and 5s, measured toward the first target
// Lines starting `!` break a rule. Playable courses only (planned ones run the same rules in their plan-book checks).
import { createTerrain } from '../../src/course/terrain.js';
import { loadCourse, MODULES } from './page.mjs';

const YD = 0.9144, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let names = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!names.length || names[0] === 'all') names = Object.keys(MODULES);
for (const c of names) {
  const { COURSE, HOLES } = await loadCourse(c), set = COURSE.tipsSet, back = COURSE.teeSets[0].id;
  console.log(`\n== ${COURSE.name}: ${set ? `tips set "${set.name}" (${set.id}), drive ${set.minDrive || 290} yd` : '! no COURSE.tipsSet'}`);
  let total = 0, have = 0;
  HOLES.forEach((h, i) => {
    const tag = `${i + 1} ${h.name}`, t = h.tips;
    if (!t || !t.tee) return console.log(`! ${tag}: no tips tee`);
    have++; total += t.yards || 0;
    const T = createTerrain(h), [x, z] = t.tee, bt = h.tees[back], B = Array.isArray(bt) ? bt : [bt.x, bt.z], bad = [];
    const pin = h.green?.pins?.[0] || h.pin, P = Array.isArray(pin) ? pin : [pin.x, pin.z];
    const next = (h.targets || []).find(q => !q.pin && !q.bold), A = h.par > 3 && next ? [next.x, next.z] : P;
    const L = dist(A, [x, z]), ux = (A[0] - x) / L, uz = (A[1] - z) / L;
    let lo = Infinity, hi = -Infinity;
    for (let a = -6; a <= 6; a += 3) for (let b = -5; b <= 5; b += 2.5) {
      const px = x + ux * a - uz * b, pz = z + uz * a + ux * b, y = T.groundAt(px, pz);
      if (y === null) { bad.push('open air under the pad'); a = b = 99; break; }
      lo = Math.min(lo, y); hi = Math.max(hi, y);
      const s = T.surfaceAt(px, pz); if (['fairway', 'green', 'sand', 'water', 'fringe'].includes(s) && !bad.includes(`on ${s}`)) bad.push(`on ${s}`);
    }
    if (hi - lo > 1.2) bad.push(`ground falls ${(hi - lo).toFixed(1)} m across the pad`);
    const behind = dist([x, z], B) / YD, [mn, mx] = h.par === 3 ? [8, 30] : [20, 50];
    if (behind < mn || behind > mx) bad.push(`${Math.round(behind)} yd behind the back tee (want ${mn}-${mx})`);
    const want = (h.yards?.[back] || 0) + behind;
    if (!t.yards) bad.push('no yards'); else if (Math.abs(t.yards - want) > 6 && Math.abs(dist([x, z], B) + 0 - (t.yards - h.yards[back]) * YD) > 6 * YD) bad.push(`card says ${t.yards} yd, the back tee's ${h.yards[back]} plus ${Math.round(behind)} is ${Math.round(want)}`);
    const y0 = T.groundAt(x, z);
    if (y0 !== null && T.solidAt) for (let y = y0 + 3; y <= y0 + 45; y += 3) if (T.solidAt(x, y, z)) { bad.push(`rock ${Math.round(y - y0)} m overhead`); break; }
    let wide = null;
    if (h.par > 3) {
      const d = (set?.minDrive || 290) * YD, cx = x + ux * d, cz = z + uz * d; wide = 0;
      for (let o = -70; o <= 70; o++) { const px = cx - uz * o, pz = cz + ux * o; if (T.groundAt(px, pz) !== null && T.surfaceAt(px, pz) === 'fairway') wide++; }
      if (wide < 40) bad.push(`a ${(set?.minDrive || 290)} yd drive lands on ${wide} m of fairway (want 40)`);
    }
    console.log(`${bad.length ? '! ' : ''}${tag}: ${t.yards || '?'} yd, ${Math.round(behind)} yd behind the back tee${wide !== null ? `, drive lands on ${wide} m of fairway` : ''}${bad.length ? ': ' + bad.join('; ') : ''}`);
  });
  console.log(`${have < HOLES.length ? '! ' : ''}${have} of ${HOLES.length} holes have a tips tee${have ? `; ${total} yd for the nine (aim 3,600-3,700)` : ''}`);
}
