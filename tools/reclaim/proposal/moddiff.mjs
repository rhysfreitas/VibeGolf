// which holes of the emitted module differ from main's (and which keys)
import { execSync } from 'child_process'; import fs from 'fs';
const S = '/tmp/claude-0/-home-claude/0c0eb480-dd5b-5d01-aa47-32e52973db68/scratchpad/base/main-reclaim.mjs';
fs.writeFileSync(S, execSync('git -C /home/claude/vibegolf show main:src/course/reclaim.js', { maxBuffer: 1 << 28 }));
const A = await import(S), B = await import('/home/claude/vibegolf/src/course/reclaim.js?' + Date.now());
A.HOLES.forEach((h, i) => { const k = Object.keys({ ...h, ...B.HOLES[i] }).filter(key => JSON.stringify(h[key]) !== JSON.stringify(B.HOLES[i][key])); if (k.length) console.log('hole', i + 1, k.join(' ')); });
const ck = Object.keys(A.COURSE.city).filter(k => JSON.stringify(A.COURSE.city[k]) !== JSON.stringify(B.COURSE.city[k])); console.log('city keys differ:', ck.join(' ') || 'none');
for (const k of ck) { const a = A.COURSE.city[k], b = B.COURSE.city[k]; let n = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) n++; console.log(' ', k, n, 'of', a.length, '/', b.length); }
