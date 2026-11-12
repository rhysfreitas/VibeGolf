// hole-frame points -> world (holes.mjs) frame: node toworld.mjs <hole> x,z x,z ...
import { HOLES } from '../holes.mjs';
const h = HOLES[+process.argv[2] - 1], tee = h.tees.eagle, pin = h.green.pins[0];
const hd = Math.atan2(pin[0] - tee[0], -(pin[1] - tee[1])), cs = Math.cos(hd), sn = Math.sin(hd);
for (const a of process.argv.slice(3)) { const [lx, lz] = a.split(',').map(Number); console.log(a, '->', [tee[0] + lx * cs - lz * sn, tee[1] + lx * sn + lz * cs].map(v => +v.toFixed(1)).join(', ')); }
