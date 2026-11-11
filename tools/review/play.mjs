// The physics-only player shared by quickplay.mjs and design.mjs: each stroke picks a target the way auto-aim does,
// solves the club and swing length for it and hits it with a decent amateur's miss. See quickplay.mjs for what it skips.
import { simulate } from '../../src/physics.js';
import { CLUBS } from '../../src/world/clubs.js';
import { solveCustom, amateurMiss } from '../../src/minigames/aim.js';
import { rng } from '../../src/course/noise.js';

export function makePlayer(COURSE) {
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
// is the line to (x, z) clear of rock and rising ground under a rough arc? The same test as the game's flightClear
// (main.js): the arc runs from the ball's height to the target's, so a green up a climb isn't read as blocked.
function clear(T, o, x, z) {
  const d = Math.hypot(x - o.x, z - o.z), ty = T.groundAt(x, z) ?? o.y, apex = Math.min(32, Math.max(4, d / 9));
  for (let f = 0.06; f < 0.95; f += 0.04) {
    const px = o.x + (x - o.x) * f, pz = o.z + (z - o.z) * f, h = o.y + (ty - o.y) * f + 4 * apex * f * (1 - f);
    const g = T.groundAt(px, pz); if (g !== null && g > h) return false;
    if (T.solidAt(px, h, pz)) return false;
  }
  return true;
}
// opts: scale (a shorter hitter: every reach times this), first ([x, z]: where the first shot is aimed, for playing one
// route), skip (targets left out, e.g. the bold ones when playing the safe route), max (strokes before giving up)
function playHole(h, T, set, seed, opts = {}) {
  const scale = opts.scale ?? 1, skip = opts.skip || [];
  const R = rng(seed), back = h.tees[set], pin = h.pin, pinY = T.groundAt(pin[0], pin[1]);
  let ball = { x: back[0], z: back[1], y: T.groundAt(back[0], back[1]), surf: 'tee' }, n = 0, pen = 0;
  const log = [], tg = (h.targets || []).filter(t => !t.pin && !skip.includes(t)).map(t => [t.x, t.z]);
  while (n < (opts.max ?? 12)) {
    if (ball.surf === 'green' || (ball.surf === 'fringe' && Math.hypot(ball.x - pin[0], ball.z - pin[1]) < 22)) { // as the game putts
      const d = Math.hypot(ball.x - pin[0], ball.z - pin[1]); n += d < 3 ? 1 : 2; log.push(d < 3 ? 'putt' : '2 putts'); return { n, log, pen };
    }
    const reach = (REACH[ball.surf] ?? 190) * scale, dp = Math.hypot(pin[0] - ball.x, pin[1] - ball.z);
    let aim;
    if (n === 0 && opts.first) { const d = Math.hypot(opts.first[0] - ball.x, opts.first[1] - ball.z), f = Math.min(1, reach / d); aim = [ball.x + (opts.first[0] - ball.x) * f, ball.z + (opts.first[1] - ball.z) * f]; }
    else if (dp <= reach * 0.9 && clear(T, ball, pin[0], pin[1])) aim = pin;
    else {
      // as the game's auto-aim (nextLie in main.js): the first clear target in reach that is a real shot (60% of reach
      // or more), else the furthest clear one, else the pin, as far toward it as this lie reaches
      const flat = t => Math.hypot(t[0] - ball.x, t[1] - ball.z);
      const ok = tg.filter(t => Math.hypot(pin[0] - t[0], pin[1] - t[1]) < dp - 5 && flat(t) <= reach * 1.02 && clear(T, ball, t[0], t[1]));
      aim = ok.find(t => flat(t) >= 0.6 * reach) || ok.reduce((a, t) => (!a || flat(t) > flat(a) ? t : a), null);
      if (!aim) { const f = Math.min(1, reach / dp); aim = [ball.x + (pin[0] - ball.x) * f, ball.z + (pin[1] - ball.z) * f]; }
    }
    const yaw = Math.atan2(aim[0] - ball.x, -(aim[1] - ball.z)), dist = Math.hypot(aim[0] - ball.x, aim[1] - ball.z);
    const flat = flyer(T, ball, yaw, false), live = flyer(T, ball, yaw, true);
    const sol = solveCustom(flat, CLUBS, { x: 0, z: -dist });
    const res = live(amateurMiss(sol.ball, R)); n++;
    if (res.surf === 'void' || res.surf === 'water') { n++; pen++; log.push(`${res.surf}+1`); continue; } // a stroke, play again from here
    log.push(res.surf); ball = res;
  }
  return { n, log, pen, stuck: true };
}
  return { playHole, clear, REACH };
}
