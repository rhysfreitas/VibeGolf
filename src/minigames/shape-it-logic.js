// Shape It rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: tee at the origin, aim down -z, x right, y up, metres. Ball data in GSPro naming.

export const YD = 0.9144;

// Tour-average launch per club (same table as the range) — reference shots are built from these.
export const CLUBS = [
  { id: 'DR', name: 'Driver', Speed: 167, VLA: 10.9, TotalSpin: 2686, tee: true },
  { id: '3W', name: '3 wood', Speed: 158, VLA: 9.2, TotalSpin: 3655, tee: true },
  { id: 'HY', name: 'Hybrid', Speed: 146, VLA: 10.2, TotalSpin: 4437 },
  { id: '5i', name: '5 iron', Speed: 132, VLA: 12.1, TotalSpin: 5361 },
  { id: '7i', name: '7 iron', Speed: 120, VLA: 16.3, TotalSpin: 7097 },
  { id: '9i', name: '9 iron', Speed: 109, VLA: 20.4, TotalSpin: 8647 },
  { id: 'PW', name: 'Pitching wedge', Speed: 102, VLA: 24.2, TotalSpin: 9304 },
  { id: 'SW', name: 'Sand wedge', Speed: 76, VLA: 31, TotalSpin: 9800 },
];
export const clubIndex = id => CLUBS.findIndex(c => c.id === id);

// Shot shapes for a right-handed golfer. hla: start direction (+ right), axis: spin axis (+ curves right).
// No punch / stinger / flop: the R10 doesn't read those reliably (docs/MINIGAMES.md).
export const SHAPES = {
  straight: { name: 'Straight', hla: 0, axis: 0, clubs: ['DR', '3W', '5i', '7i', '9i', 'PW'], weight: 3 },
  draw:     { name: 'Draw', hla: 2.4, axis: -6.5, clubs: ['DR', '3W', 'HY', '5i', '7i', '9i'], weight: 3 },
  fade:     { name: 'Fade', hla: -2.4, axis: 6.5, clubs: ['DR', '3W', 'HY', '5i', '7i', '9i'], weight: 3 },
  hook:     { name: 'Hook', hla: 4.2, axis: -15, clubs: ['DR', '3W', 'HY', '5i', '7i'], weight: 1.5, curve: true },
  slice:    { name: 'Slice', hla: -4.2, axis: 15, clubs: ['DR', '3W', 'HY', '5i', '7i'], weight: 1.5, curve: true },
  high:     { name: 'High', hla: 0, axis: 0, vla: 5, spin: 1.18, speed: 0.97, clubs: ['7i', '9i', 'PW'], weight: 1.5 },
  low:      { name: 'Low', hla: 0, axis: 0, vla: -4, spin: 0.8, speed: 1.0, clubs: ['5i', '7i', '9i'], weight: 1.5 },
};

// Beginner and Amateur fly through tall *gates*: only left and right count, so it's all about
// start line and curve (draws and fades; Amateur adds hooks and slices). Pro and Tour fly through
// *rings*, where height counts too and every shape is in play.
// Size as a share of distance from the tee (gate half-width or ring radius), with a floor.
// Beginner gates ≈ 22 yd wide at 150 yd, Amateur ≈ 13; Pro rings ≈ 14 yd across, Tour ≈ 10.
// (A decent amateur's swing threads a full shape about 70% / 45% / 30% / 15% of the time.)
const CURVES = ['straight', 'draw', 'fade'];
export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', gate: true, frac: 0.075, min: 3.0, guide: true, shapes: CURVES, note: 'Tall gates: just start it on line and curve it through (about 22 yd wide at 150 yd). Straights, draws and fades, with a guide line.' },
  { id: 'amateur', label: 'Amateur', gate: true, frac: 0.045, min: 2.0, guide: true, shapes: [...CURVES, 'hook', 'slice'], note: 'Narrower gates (about 13 yd wide at 150 yd), and hooks and slices join in. Guide line on.' },
  { id: 'pro', label: 'Pro', frac: 0.048, min: 2.2, guide: false, note: 'Rings: height counts now, and high and low shots join in (about 14 yd across at 150 yd). No guide line.' },
  { id: 'tour', label: 'Tour', frac: 0.034, min: 1.6, guide: false, note: 'Tight rings (about 10 yd across at 150 yd). No guide line.' },
];
export const PERFECT_FRAC = 0.25; // the bright centre is a quarter of the ring: earned, not given
export const GATE_PERFECT_FRAC = 0.2; // a gate's centre band (left-right only, so a little narrower)
export const POINTS = { ring: 100, shape: 250, perfectShape: 500 };

export const CHALLENGES = [
  { id: 'full1', text: 'Thread a full shape', key: 'fullShapes', goal: 1 },
  { id: 'full3', text: 'Thread 3 full shapes', key: 'fullShapes', goal: 3, only: ['beginner', 'amateur'] },
  { id: 'perf2', text: 'Hit 2 perfect gates', key: 'perfects', goal: 2 },
  { id: 'perf5', text: 'Hit 5 perfect gates', key: 'perfects', goal: 5, only: ['beginner', 'amateur'] },
  { id: 'x4', text: 'Reach a ×4 streak', key: 'mult', goal: 4 },
  { id: 'rings15', text: 'Clear 15 gates', key: 'rings', goal: 15 },
  { id: 'rings8', text: 'Clear 8 gates', key: 'rings', goal: 8, only: ['pro', 'tour'] },
  { id: 'curve', text: 'Thread a hook or slice', key: 'curveShapes', goal: 1, only: ['amateur', 'pro', 'tour'] },
];

// allowed: the difficulty's shapes (gates only ask for curves; rings use them all)
export function pickShape(rand = Math.random, lastKey = null, allowed = null) {
  const keys = (allowed || Object.keys(SHAPES)).filter(k => k !== lastKey);
  const total = keys.reduce((a, k) => a + SHAPES[k].weight, 0);
  let r = rand() * total;
  for (const k of keys) { r -= SHAPES[k].weight; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

// Ball data for a club hitting a shape (no randomness).
export function shapeBall(club, shapeKey) {
  const s = SHAPES[shapeKey];
  return {
    Speed: club.Speed * (s.speed || 1), VLA: club.VLA + (s.vla || 0), HLA: s.hla,
    TotalSpin: club.TotalSpin * (s.spin || 1), SpinAxis: s.axis,
  };
}

// Place three rings along a reference flight: rising (~33% of carry), apex, descending (~80%).
// pts: physics result points [{t, p:[x,y,z], phase}]. Returns rings with centre, normal, radius.
// On a gate difficulty they're gates instead: kind 'gate', a level normal, r = half-width, and
// top = how tall the posts stand (comfortably above the flight there; height still doesn't count).
export function buildRings(pts, diff) {
  const flight = [];
  for (const q of pts) { flight.push(q); if (q.phase !== 'flight') break; }
  const horiz = q => Math.hypot(q.p[0], q.p[2]);
  const carry = horiz(flight[flight.length - 1]);
  let apexI = 0; flight.forEach((q, i) => { if (q.p[1] > flight[apexI].p[1]) apexI = i; });
  const find = (frac, after) => { for (let i = after; i < flight.length; i++) if (horiz(flight[i]) >= carry * frac) return i; return flight.length - 2; };
  const i1 = Math.min(find(0.33, 0), apexI - 2), i3 = Math.max(find(0.8, apexI), apexI + 2);
  return [i1, apexI, i3].map((i, k) => {
    i = Math.max(1, Math.min(flight.length - 2, i));
    const a = flight[i - 1].p, b = flight[i + 1].p, c = flight[i].p;
    const n = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], nl = Math.hypot(...n);
    const dist = Math.hypot(...c);
    const r = Math.max(diff.min, diff.frac * dist);
    if (diff.gate) {
      const hl = Math.hypot(n[0], n[2]);
      return { k, kind: 'gate', c: c.slice(), n: [n[0] / hl, 0, n[2] / hl], r, perfect: r * GATE_PERFECT_FRAC, t: flight[i].t, dist, top: Math.max(12, c[1] * 1.3 + 6) };
    }
    return { k, kind: 'ring', c: c.slice(), n: n.map(v => v / nl), r, perfect: r * PERFECT_FRAC, t: flight[i].t, dist };
  });
}

// Where (and when) a flight crosses each ring's plane, moving forward through it.
// Returns per ring: { hit, perfect, d (m from centre, Infinity if never reached), t, nearYd }
// For a gate, d is just how far left or right of centre it went through (height doesn't count).
export function testRings(pts, rings) {
  return rings.map(ring => {
    let best = { d: Infinity, t: null };
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].phase !== 'flight' && pts[i].phase !== 'flight') break;
      const a = pts[i - 1].p, b = pts[i].p;
      const sa = (a[0] - ring.c[0]) * ring.n[0] + (a[1] - ring.c[1]) * ring.n[1] + (a[2] - ring.c[2]) * ring.n[2];
      const sb = (b[0] - ring.c[0]) * ring.n[0] + (b[1] - ring.c[1]) * ring.n[1] + (b[2] - ring.c[2]) * ring.n[2];
      if (sa <= 0 && sb > 0) {
        const f = sa / (sa - sb), p = [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * f);
        const d = ring.kind === 'gate'
          ? Math.abs((p[0] - ring.c[0]) * -ring.n[2] + (p[2] - ring.c[2]) * ring.n[0])
          : Math.hypot(p[0] - ring.c[0], p[1] - ring.c[1], p[2] - ring.c[2]);
        if (d < best.d) best = { d, t: pts[i - 1].t + (pts[i].t - pts[i - 1].t) * f, p };
      }
    }
    const hit = best.d <= ring.r, perfect = best.d <= ring.perfect;
    const near = !hit && best.d <= ring.r + Math.max(0.6 * ring.r, 2.5 * YD);
    return { hit, perfect, near, d: best.d, t: best.t, p: best.p || null, missYd: hit ? 0 : (best.d - ring.r) / YD };
  });
}

// Points for a shot before the streak multiplier: per ring, then the shape bonus.
export function scoreShot(results) {
  const items = results.map(r => (r.hit ? (r.perfect ? 2 : 1) * POINTS.ring : 0));
  const all = results.every(r => r.hit), allPerfect = all && results.every(r => r.perfect);
  const bonus = allPerfect ? POINTS.perfectShape : all ? POINTS.shape : 0;
  return { items, bonus, base: items.reduce((a, b) => a + b, 0) + bonus, all, allPerfect, rings: results.filter(r => r.hit).length, perfects: results.filter(r => r.perfect).length };
}
