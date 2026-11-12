// one tips spot (hole-frame x,z) on the emitted proposal: pad flatness, height against the back tee, overhead, and a
// 290 yd drive's landing toward a given aim (a target name, or 'pin')
import { HOLES } from '../../../src/course/hollowmere.js';
import { createTerrain } from '../../../src/course/terrain.js';
const YD = 0.9144, [hn, xz, ...an] = process.argv.slice(2), aimName = an.join(' '), h = HOLES[+hn - 1], T = createTerrain(h);
const [x, z] = xz.split(',').map(Number), B = h.tees.eagle;
const A = aimName === 'pin' ? h.pin : (() => { const t = h.targets.find(q => q.name === aimName) || h.targets.find(q => !q.pin && !q.bold); return [t.x, t.z]; })();
const L = Math.hypot(A[0] - x, A[1] - z), ux = (A[0] - x) / L, uz = (A[1] - z) / L;
let lo = 1e9, hi = -1e9, surf = new Set();
for (let a = -6; a <= 6; a += 1.5) for (let b = -5; b <= 5; b += 1.25) { const px = x + ux * a - uz * b, pz = z + uz * a + ux * b, y = T.groundAt(px, pz); if (y === null) { surf.add('AIR'); continue; } lo = Math.min(lo, y); hi = Math.max(hi, y); surf.add(T.surfaceAt(px, pz)); }
const y0 = T.groundAt(x, z); let over = null; for (let y = y0 + 3; y <= y0 + 45; y += 1) if (T.solidAt(x, y, z)) { over = y - y0; break; }
const d = 290 * YD, cx = x + ux * d, cz = z + uz * d; let w = 0, row = ''; for (let o = -70; o <= 70; o++) { const px = cx - uz * o, pz = cz + ux * o, s = T.groundAt(px, pz) === null ? 'void' : T.surfaceAt(px, pz); if (s === 'fairway') w++; if (o % 5 === 0) row += s[0]; }
console.log(`hole ${hn} spot ${x},${z}: ${(Math.hypot(x - B[0], z - B[1]) / YD).toFixed(0)} yd behind, ground ${y0?.toFixed(1)} (back tee ${T.groundAt(...B).toFixed(1)}), pad falls ${(hi - lo).toFixed(2)} m, surfaces ${[...surf].join('/')}, overhead ${over ?? 'clear'}; 290 yd toward ${aimName || 'first target'} lands on ${w} m [${row}]`);
