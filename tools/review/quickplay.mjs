// node tools/review/quickplay.mjs <course> [holes...] [--seeds=3]: a fast play-through with the game's physics and no
// browser (seconds a hole, against minutes for playthrough.mjs). Each stroke picks a target the way auto-aim does
// (the pin when it's in reach and the line is clear, else the first fairway target in reach, skipping one under
// 60% of reach when a further one is in reach), solves the club and swing length for it, and hits it with a decent
// amateur's miss. On the green: two putts (one inside 3 m). In the void or water: a stroke, and it plays again from
// where it was, at the nearest target. Logs the lie after each stroke; a hole that takes 10 or more is a layout bug.
// It skips what the game adds on top (lie costs, slope stances, trees' branches, wind), so it's a check, not the game.
import { simulate } from '../../src/physics.js';
import { createTerrain } from '../../src/course/terrain.js';
import { CLUBS } from '../../src/world/clubs.js';
import { solveCustom, amateurMiss } from '../../src/minigames/aim.js';
import { rng } from '../../src/course/noise.js';
import { loadCourse } from './page.mjs';

const args = process.argv.slice(2), course = args[0], seeds = +((args.find(a => a.startsWith('--seeds=')) || '--seeds=3').slice(8));
const pick = args.slice(1).filter(a => !a.startsWith('--')).map(Number);
const { HOLES, COURSE } = await loadCourse(course);
const REACH = { tee: 245, fairway: 225, fringe: 200, rough: 190, firstcut: 210, sand: 150, desert: 160, waste: 170, ice: 225, powder: 140 };

function flyer(T, o, yaw, live) {
  const c = Math.cos(yaw), s = Math.sin(yaw), wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  return ball => {
    const r = simulate({ HLA: 0, SpinAxis: 0, ...ball }, {
      groundAt: (lx, lz) => { const g = T.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
      surfaceAt: (lx, lz) => { const v = T.surfaceAt(wx(lx, lz), wz(lx, lz)); return v === 'tee' ? 'fairway' : v; },
      solidAt: live ? (lx, ly, lz) => { const n = T.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; } : undefined,
      voidY: T.voidY - o.y, altFt: COURSE.altFt || 0,
    });
    if (!live) return r;
    const e = r.pts.at(-1).p, x = wx(e[0], e[2]), z = wz(e[0], e[2]), g = T.groundAt(x, z);
    return { x, z, y: g, surf: g === null || e[1] < T.voidY - o.y + 1 ? 'void' : T.surfaceAt(x, z) };
  };
}
// is the straight line to (x, z) clear of rock and rising ground under a rough arc (25 m apex)?
function clear(T, o, x, z) {
  const d = Math.hypot(x - o.x, z - o.z);
  for (let k = 1; k < 30; k++) {
    const f = k / 30, px = o.x + (x - o.x) * f, pz = o.z + (z - o.z) * f, h = o.y + 100 * f * (1 - f) * Math.min(1, d / 120);
    const g = T.groundAt(px, pz); if (g !== null && g > h - 1) return false;
    if (T.solidAt(px, h, pz)) return false;
  }
  return true;
}
function playHole(h, T, set, seed) {
  const R = rng(seed), back = h.tees[set], pin = h.pin, pinY = T.groundAt(pin[0], pin[1]);
  let ball = { x: back[0], z: back[1], y: T.groundAt(back[0], back[1]), surf: 'tee' }, n = 0;
  const log = [], tg = (h.targets || []).filter(t => !t.pin).map(t => [t.x, t.z]);
  while (n < 12) {
    if (ball.surf === 'green' || (ball.surf === 'fringe' && Math.hypot(ball.x - pin[0], ball.z - pin[1]) < 8)) {
      const d = Math.hypot(ball.x - pin[0], ball.z - pin[1]); n += d < 3 ? 1 : 2; log.push(d < 3 ? 'putt' : '2 putts'); return { n, log };
    }
    const reach = REACH[ball.surf] ?? 190, dp = Math.hypot(pin[0] - ball.x, pin[1] - ball.z);
    let aim;
    if (dp <= reach && clear(T, ball, pin[0], pin[1])) aim = pin;
    else {
      const ahead = tg.filter(t => Math.hypot(pin[0] - t[0], pin[1] - t[1]) < dp - 5);
      const ok = ahead.filter(t => Math.hypot(t[0] - ball.x, t[1] - ball.z) <= reach && clear(T, ball, t[0], t[1]));
      aim = ok.find((t, i) => Math.hypot(t[0] - ball.x, t[1] - ball.z) >= 0.6 * reach || i === ok.length - 1);
      if (!aim) { const t = ahead[0] || pin, d = Math.hypot(t[0] - ball.x, t[1] - ball.z), f = Math.min(1, reach / d); aim = [ball.x + (t[0] - ball.x) * f, ball.z + (t[1] - ball.z) * f]; }
    }
    const yaw = Math.atan2(aim[0] - ball.x, -(aim[1] - ball.z)), dist = Math.hypot(aim[0] - ball.x, aim[1] - ball.z);
    const flat = flyer(T, ball, yaw, false), live = flyer(T, ball, yaw, true);
    const sol = solveCustom(flat, CLUBS, { x: 0, z: -dist });
    const res = live(amateurMiss(sol.ball, R)); n++;
    if (res.surf === 'void' || res.surf === 'water') { n++; log.push(`${res.surf}+1`); continue; } // a stroke, play again from here
    log.push(res.surf); ball = res;
  }
  return { n, log, stuck: true };
}
const sets = [COURSE.teeSets[0].id, COURSE.teeSets.at(-1).id];
let total = 0;
for (const [i, h] of HOLES.entries()) {
  if (pick.length && !pick.includes(i + 1)) continue;
  const T = createTerrain(h), out = [];
  for (const set of sets) for (let k = 0; k < seeds; k++) {
    const r = playHole(h, T, set, 101 + k * 37 + i * 11);
    out.push(`${set}:${r.n}${r.stuck ? '!' : ''}`); if (set === sets[0] && k === 0) total += r.n;
    if (r.stuck || r.n >= h.par + 4) console.log(`  ${h.name} ${set} seed ${k}: ${r.n} | ${r.log.join(' ')}`);
  }
  console.log(`${i + 1} ${h.name} par ${h.par}: ${out.join(' ')}`);
}
console.log(`${course}: first seed from the back tees, ${total}`);
