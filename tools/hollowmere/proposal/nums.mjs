// numbers for the proposal pages from an emitted module: each par 4/5's form and width along its line, each tee set's landing
import { createTerrain } from '../../../src/course/terrain.js';
import { signature, distance } from '../../review/alike.mjs';
import fs from 'fs';
const [mod, out] = process.argv.slice(2), { HOLES, COURSE } = await import(mod), YD = 0.9144;
const res = { holes: {}, pairs: [] }, sigs = [];
HOLES.forEach((h, i) => {
  if (h.par < 4) return;
  const T = createTerrain(h), fw = (x, z) => T.groundAt(x, z) !== null && T.surfaceAt(x, z) === 'fairway', sig = signature(h.line, fw);
  sigs.push([i + 1, sig]);
  const land = {}, tg = (h.targets || []).filter(t => !t.pin);
  for (const t of COURSE.teeSets) {
    const p = h.tees[t.id], d = (t.minDrive || 150) * YD * 0.95, aim = tg.find(q => Math.hypot(q.x - p[0], q.z - p[1]) > d * 0.6) || { x: h.pin[0], z: h.pin[1] };
    const l = Math.hypot(aim.x - p[0], aim.z - p[1]), ux = (aim.x - p[0]) / l, uz = (aim.z - p[1]) / l, k = Math.min(d, l), x = p[0] + ux * k, z = p[1] + uz * k;
    let w = 0; for (let o = -80; o <= 80; o++) if (fw(x - uz * o, z + ux * o)) w++;
    land[t.id] = { w, x, z };
  }
  res.holes[i + 1] = { name: h.name, form: sig.form, w: sig.w, meanW: sig.meanW, minW: sig.minW, maxW: sig.maxW, len: sig.len, land };
});
for (let a = 0; a < sigs.length; a++) for (let b = a + 1; b < sigs.length; b++) res.pairs.push([sigs[a][0], sigs[b][0], +distance(sigs[a][1], sigs[b][1]).toFixed(2)]);
fs.writeFileSync(out, JSON.stringify(res));
console.log(Object.entries(res.holes).map(([n, h]) => `${n}:${h.form}`).join(' '), '| alike pairs', res.pairs.filter(p => p[2] < 0.25).map(p => p.join('-')).join(' '));
