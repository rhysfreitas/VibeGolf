// candidate tips spots behind each back tee, in the emitted hole frame, scored by tips.mjs's rules
import { COURSE, HOLES } from '../../../src/course/hollowmere.js';
import { createTerrain } from '../../../src/course/terrain.js';
const YD = 0.9144;
HOLES.forEach((h, i) => {
  const T = createTerrain(h), B = h.tees.eagle, pin = h.pin;
  const first = (h.targets || []).find(q => !q.pin && !q.bold), A0 = h.par > 3 && first ? [first.x, first.z] : pin;
  // back along the line from the first target through the back tee
  const L0 = Math.hypot(A0[0] - B[0], A0[1] - B[1]), bx = -(A0[0] - B[0]) / L0, bz = -(A0[1] - B[1]) / L0;
  const [mn, mx] = h.par === 3 ? [9, 28] : [21, 48], res = [];
  for (let byd = mn; byd <= mx; byd += 1) for (let off = -24; off <= 24; off += 2) {
    const d = byd * YD, x = B[0] + bx * d - bz * off, z = B[1] + bz * d + bx * off;
    const behind = Math.hypot(x - B[0], z - B[1]) / YD; if (behind < mn || behind > mx + 1) continue;
    const L = Math.hypot(A0[0] - x, A0[1] - z), ux = (A0[0] - x) / L, uz = (A0[1] - z) / L;
    let lo = Infinity, hi = -Infinity, bad = '';
    for (let a = -6; a <= 6 && !bad; a += 3) for (let b = -5; b <= 5; b += 2.5) {
      const px = x + ux * a - uz * b, pz = z + uz * a + ux * b, y = T.groundAt(px, pz);
      if (y === null) { bad = 'air'; break; }
      lo = Math.min(lo, y); hi = Math.max(hi, y);
      const s = T.surfaceAt(px, pz); if (['fairway', 'green', 'sand', 'water', 'fringe'].includes(s)) { bad = s; break; }
      if (T.solidAt(px, y + 1, pz)) { bad = 'rock'; break; }
    }
    if (bad || hi - lo > 1.2) continue;
    const y0 = T.groundAt(x, z); let over = false; for (let y = y0 + 3; y <= y0 + 45; y += 3) if (T.solidAt(x, y, z)) { over = true; break; }
    if (over) continue;
    // nearest other tee: keep 6 m clear of the pads
    let wide = null;
    if (h.par > 3) { const dd = 290 * YD, cx = x + ux * dd, cz = z + uz * dd; wide = 0; for (let o = -70; o <= 70; o++) { const px = cx - uz * o, pz = cz + ux * o; if (T.groundAt(px, pz) !== null && T.surfaceAt(px, pz) === 'fairway') wide++; } }
    res.push({ x: +x.toFixed(1), z: +z.toFixed(1), behind: Math.round(behind), off, flat: +(hi - lo).toFixed(2), wide, dy: +(y0 - T.groundAt(...B)).toFixed(1) });
  }
  const ok = res.filter(r => (r.wide === null || r.wide >= 40) && Math.abs(r.dy) < 2.5 && r.flat < 1);
  const best = (ok.length ? ok : res).sort((a, b) => (Math.abs(a.off) - Math.abs(b.off)) * 2 + (Math.abs(a.behind - (h.par === 3 ? 14 : 30)) - Math.abs(b.behind - (h.par === 3 ? 14 : 30))) * 0.5 + (b.wide ?? 0) * 0 )[0];
  console.log(i + 1, 'level ok', ok.length, JSON.stringify(ok.sort((a,b)=>Math.abs(a.off)-Math.abs(b.off)||a.flat-b.flat).slice(0,4)), 'level any', res.filter(r=>Math.abs(r.dy)<2.5).length, 'best wide level', JSON.stringify(res.filter(r=>Math.abs(r.dy)<2.5).sort((a,b)=>(b.wide??0)-(a.wide??0))[0])); if(0) console.log(i + 1, h.name, `par ${h.par} ${h.yards.eagle} yd:`, res.length, 'spots,', ok.length, 'landing ok; best', JSON.stringify(best), '| widest landing', JSON.stringify(res.sort((a, b) => (b.wide ?? 0) - (a.wide ?? 0))[0]));
});
