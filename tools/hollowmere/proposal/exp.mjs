// quick checks on the proposal's world-frame plan data (no emit): forms and likeness, each tee set's landing,
// tees and targets on/off fairway, bunkers touching, groves clear of the fairway
import { HOLES } from '../holes.mjs';
import { createTerrain } from '../../../src/course/terrain.js';
import { signature, distance } from '../../review/alike.mjs';
const YD = 0.9144, MIN = { eagle: 260, hawk: 220, swift: 185, wren: 150 };
const only = process.argv.slice(2).map(Number);
const sigs = [];
HOLES.forEach((h0, i) => {
  if (h0.par < 4) return;
  const tee = h0.tees.eagle, pin = h0.green.pins[0], line = [tee, ...h0.line.slice(1)];
  const T = createTerrain({ ...h0, line, pin, corridor: h0.corridor ?? 38, native: [0, 0] });
  const fw = (x, z) => T.groundAt(x, z) !== null && T.surfaceAt(x, z) === 'fairway';
  const sig = signature(line, fw); sigs.push({ n: i + 1, sig });
  if (only.length && !only.includes(i + 1)) return;
  const out = [`${i + 1} ${h0.name}: ${sig.form}, ${Math.round(sig.len)} m, ${Math.round(sig.minW)}-${Math.round(sig.maxW)} wide (mean ${Math.round(sig.meanW)}) w-profile ${sig.w.map(v => v.toFixed(1)).join(' ')}`];
  const tg = (h0.targets || []).filter(t => !t.pin && !t.bold);
  for (const [id, p] of Object.entries(h0.tees)) {
    const d = MIN[id] * YD * 0.95, aim = tg.find(q => Math.hypot(q.x - p[0], q.z - p[1]) > d * 0.6) || { x: pin[0], z: pin[1] };
    const l = Math.hypot(aim.x - p[0], aim.z - p[1]), ux = (aim.x - p[0]) / l, uz = (aim.z - p[1]) / l, k = Math.min(d, l), x = p[0] + ux * k, z = p[1] + uz * k;
    let w = 0; for (let o = -80; o <= 80; o++) if (fw(x - uz * o, z + ux * o)) w++;
    let onTee = false; for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 4, 8]) if (fw(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r)) onTee = true;
    out.push(`   ${id}: lands on ${w} m${onTee ? '  ! tee within 8 m of fairway' : ''}`);
  }
  for (const t of h0.targets || []) if (!t.pin) out.push(`   target ${t.name}: ${T.surfaceAt(t.x, t.z)}`);
  for (const g of h0.groves || []) { let n = 0; for (let a = 0; a < 6.28; a += 0.3) for (let r = 0; r <= g.r; r += 2) if (fw(g.x + Math.cos(a) * r, g.z + Math.sin(a) * r)) n++; if (n) out.push(`   ! grove at ${g.x.toFixed(0)},${g.z.toFixed(0)} over fairway (${n} samples)`); }
  for (const b of h0.bunkers || []) { let touch = false, inside = 0; for (let a = 0; a < 6.28; a += 0.3) { const r = Math.max(b.rx, b.rz) + 3; if (fw(b.x + Math.cos(a) * r, b.z + Math.sin(a) * r)) touch = true; } if (Math.hypot(b.x - pin[0], b.z - pin[1]) > 40 && !touch) out.push(`   bunker at ${b.x.toFixed(0)},${b.z.toFixed(0)} not touching fairway`); }
  console.log(out.join('\n'));
});
for (let a = 0; a < sigs.length; a++) for (let b = a + 1; b < sigs.length; b++) { const d = distance(sigs[a].sig, sigs[b].sig); if (d < 0.32) console.log(`pair ${sigs[a].n}-${sigs[b].n}: ${d.toFixed(2)}${d < 0.25 ? ' ALIKE' : ''}`); }
console.log('forms', sigs.map(s => `${s.n}:${s.sig.form}`).join(' '));
