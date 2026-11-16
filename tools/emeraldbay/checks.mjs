// node tools/emeraldbay/checks.mjs : round 0's numbers (out/checks.json): the three tide holes at both tides
// (carries, dry ground either side of every tee set's landing area, the routes), and the sand lies flown with the
// game's physics (src/physics.js) using the course's lie rules (src/course/main.js lieAdjust).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../../src/physics.js';
import { V, TIDES, WLINES, onLine, TURTLE_ROCK, SPIT, CREEK, CAVE, CAVEBEACH, HOLLOW } from './world.mjs';
import { project, at, lengthOf, YD, seDist } from './geo.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out');
const ydOf = m => Math.round(m / YD);
const dry = (X, Z, tide) => V(X, Z).y >= TIDES[tide];
// the tee sets: Marlin, Manta, Turtle, Clownfish (minDrive in yards; the forward set is checked at 150) and the tips
export const SETS = [['marlin', 'Marlin', 260], ['manta', 'Manta', 230], ['turtle', 'Turtle', 200], ['clownfish', 'Clownfish', 150]];
// each tide hole's proposed tee spots, [s, off] in its line's frame
export const TEES = {
  3: { marlin: [0, 0], manta: [12, -5], turtle: [24, 7], clownfish: [TURTLE_ROCK.s, TURTLE_ROCK.off], shark: [-16, 0] },
  5: { marlin: [0, 0], manta: [22, -14], turtle: [48, -30], clownfish: [88, -32], shark: [-30, 2] },
  9: { marlin: [0, 0], manta: [12, 9], turtle: [72, SPIT.vc(72) + 32], clownfish: [118, SPIT.vc(118) + 34], shark: [-17, 3] },
};
export const GREENS = { 3: { s: 183, rx: 13.5, rz: 18 }, 5: { s: 366, rx: 12, rz: 14.5 }, 9: { s: 498, rx: 14.5, rz: 18.5 } };

// walk from a point along a direction until the ground changes from dry to wet (or the reverse): metres
function runTo(X, Z, ux, uz, tide, wantDry, max = 200, step = 0.5) {
  for (let d = 0; d <= max; d += step) if (dry(X + ux * d, Z + uz * d, tide) === wantDry) return d;
  return max;
}
// dry ground either side of a point on a route (the route's local right-hand normal), in metres
function sides(L, s, tide) {
  const p = at(L, s), q = at(L, s + 1), ux = q[0] - p[0], uz = q[1] - p[1], l = Math.hypot(ux, uz);
  const rx = -uz / l, rz = ux / l;   // right of travel
  const onDry = dry(p[0], p[1], tide);
  return { onDry, right: onDry ? runTo(p[0], p[1], rx, rz, tide, false) : 0, left: onDry ? runTo(p[0], p[1], -rx, -rz, tide, false) : 0,
    grass: grassWidth(p, rx, rz) };
}
function grassWidth(p, rx, rz) {
  let a = 0, b = 0; const g = (d) => ['grass'].includes(V(p[0] + rx * d, p[1] + rz * d).t);
  if (!g(0)) return 0;
  while (g(a + 0.5) && a < 150) a += 0.5; while (g(-(b + 0.5)) && b < 150) b += 0.5;
  return a + b;
}
const teeXZ = (k, sp) => onLine(k, sp[0], sp[1]);

// ---- 3 The Tongue: what each tee set must carry at each tide
function hole3() {
  const L = WLINES[2], G = GREENS[3], pin = at(L, G.s), front = at(L, G.s - G.rz);
  const res = {};
  for (const tide of ['low', 'high']) {
    res[tide] = {};
    for (const [id, name] of [...SETS, ['shark', 'Shark']]) {
      const t = teeXZ(2, TEES[3][id]);
      const dx = pin[0] - t[0], dz = pin[1] - t[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
      // off the tee's own ground, then the first dry ground toward the pin, and the last water before the green
      const leave = runTo(t[0], t[1], ux, uz, tide, false, d);
      const land = leave < d ? leave + runTo(t[0] + ux * leave, t[1] + uz * leave, ux, uz, tide, true, d - leave) : d;
      let lastWet = 0; for (let e = 0; e < d - 5; e += 0.5) if (!dry(t[0] + ux * e, t[1] + uz * e, tide)) lastWet = e;
      res[tide][id] = { name, toPin: ydOf(d), firstDry: ydOf(land), allCarry: ydOf(lastWet), toFront: ydOf(Math.hypot(front[0] - t[0], front[1] - t[1])) };
    }
  }
  // the tongue along the line: its height and width
  const prof = []; for (let s = -30; s <= G.s + 30; s += 2) { const p = at(L, s); prof.push([s, +V(p[0], p[1]).y.toFixed(2)]); }
  const gy = V(pin[0], pin[1]).y;
  return { res, prof, greenY: +gy.toFixed(2) };
}

// ---- 5 The Sandbar: dry ground either side of each tee set's landing area at each tide
function hole5() {
  const L = WLINES[4], res = {};
  for (const tide of ['low', 'high']) {
    res[tide] = {};
    for (const [id, name, drive] of SETS) {
      const t = TEES[5][id], s = t[0] + drive * YD;
      const sd = sides(L, s, tide);
      res[tide][id] = { name, s: Math.round(s), drive, fairway: sd.grass, ...sd, waterR: ydOf(sd.right), waterL: ydOf(sd.left) };
    }
  }
  // the section at the landing area (s = 200), both tides
  const sec = []; for (let o = -120; o <= 120; o += 1) { const p = at(L, 200, o); sec.push([o, +V(p[0], p[1]).y.toFixed(2), V(p[0], p[1]).t]); }
  return { res, sec };
}

// ---- 9 The Hong: the low-tide line over the flats, the high-tide route along the spit
function route9(tide) {
  const L = WLINES[8];
  if (tide === 'low') return L;
  const P = [at(L, 0, 0)];
  for (let s = 140; s <= 360; s += 20) P.push(at(L, s, SPIT.vc(s)));
  P.push(at(L, 392, 26), at(L, 425, 0), at(L, 498, 0));
  return P;
}
function hole9() {
  const L = WLINES[8], res = {};
  const creekS = (() => { for (let s = 250; s < 400; s += 0.5) { const p = at(L, s); if (V(p[0], p[1]).y < 0) return s; } return null; })();
  const creekE = (() => { for (let s = creekS; s < 400; s += 0.5) { const p = at(L, s); if (V(p[0], p[1]).y >= 0) return s; } return null; })();
  for (const tide of ['low', 'high']) {
    const R = route9(tide), len = lengthOf(R);
    res[tide] = { routeYd: ydOf(len), sets: {} };
    for (const [id, name, drive] of SETS) {
      const t = teeXZ(8, TEES[9][id]), pr = project(R, t[0], t[1]), s = pr.s + drive * YD;
      res[tide].sets[id] = { name, s: Math.round(s), drive, ...sides(R, s, tide) };
      res[tide].sets[id].waterR = ydOf(res[tide].sets[id].right); res[tide].sets[id].waterL = ydOf(res[tide].sets[id].left);
    }
  }
  // the cave and the lagoon along the line
  const prof = []; for (let s = -20; s <= 520; s += 2) { const p = at(L, s), g = V(p[0], p[1]); prof.push([s, +g.y.toFixed(2), g.cave ? 1 : 0]); }
  return { res, creek: [creekS, creekE], caveYd: [ydOf(CAVE.s0), ydOf(CAVE.s1)], greenYd: ydOf(498),
    goFrom: Object.fromEntries([240, 260, 280].map(s => [s, ydOf(498 - s)])), layup: { at: CAVEBEACH.s0 + 15, left: ydOf(498 - CAVEBEACH.s0 - 15), carry: ydOf(CAVEBEACH.s0 + 15 - 260) },
    routes: route9('high').map(([X, Z]) => [X, -Z]), prof };
}

// ---- the sand: lie costs and run-outs flown with the physics
const CLUBS = [['Driver', 167, 10.9, 2686], ['3 wood', 158, 9.2, 3655], ['Hybrid', 146, 10.2, 4437], ['7 iron', 120, 16.3, 7097], ['PW', 102, 24.2, 9304]];
function lieAdjust(s, lie) {   // a copy of src/course/main.js lieAdjust (16 November 2026)
  s = { ...s };
  if (lie === 'rough') { s.Speed *= 0.94; s.TotalSpin *= 0.7; s.VLA += 0.8; }
  else if (lie === 'sand') { s.Speed *= 0.86; s.TotalSpin *= 0.65; s.VLA += 2; }
  else if (lie === 'waste') { s.Speed *= 0.94; s.TotalSpin *= 0.78; s.VLA += 0.6; }
  else if (lie === 'desert') { s.Speed *= 0.9; s.TotalSpin *= 0.62; s.VLA += 1; }
  else if (lie === 'beach') { s.Speed *= 0.97; s.TotalSpin *= 0.85; s.VLA += 0.3; }
  return s;
}
function lies() {
  const fly = (c, lie, surf = 'fairway') => {
    const [, Speed, VLA, TotalSpin] = c;
    return simulate(lieAdjust({ Speed, VLA, HLA: 0, TotalSpin, SpinAxis: 0 }, lie), { groundAt: () => 0, surfaceAt: () => surf });
  };
  const rows = [];
  for (const c of CLUBS.slice(1)) {
    const f = fly(c, 'fairway').carry;
    rows.push({ club: c[0], fairway: Math.round(f), beach: Math.round(fly(c, 'beach').carry), waste: Math.round(fly(c, 'waste').carry), rough: Math.round(fly(c, 'rough').carry), sand: Math.round(fly(c, 'sand').carry), desert: Math.round(fly(c, 'desert').carry) });
  }
  // run-out of a tour drive and a 7 iron landing on each surface
  const run = {};
  for (const surf of ['fairway', 'beach', 'waste', 'sand', 'rough']) {
    run[surf] = {};
    for (const c of [CLUBS[0], CLUBS[3]]) { const r = fly(c, 'fairway', surf); run[surf][c[0]] = Math.round(r.total - r.carry); }
  }
  return { rows, run };
}

// shots under the cave roof: the go shot from the drive, the lay-up's third, flown down the line (heights above low water)
function caveShots() {
  const shots = [['3 wood, the go shot from 260 m', CLUBS[1], 260, 1.5], ['Hybrid, the go shot from 280 m', CLUBS[2], 280, 1.5], ['PW, the third from the lay-up', CLUBS[4], CAVEBEACH.s0 + 15, 3.0]];
  return shots.map(([name, c, s0, y0]) => {
    const [, Speed, VLA, TotalSpin] = c, r = simulate({ Speed, VLA, HLA: 0, TotalSpin, SpinAxis: 0 }, { groundAt: () => 0, flightOnly: true });
    const pts = r.pts.filter((q, i) => q.phase === "flight" && i % 6 === 0).map(q => [+(s0 - q.p[2]).toFixed(1), +(y0 + q.p[1]).toFixed(1)]);
    const under = pts.filter(([s]) => s >= CAVE.s0 && s <= CAVE.s1), top = under.length ? Math.max(...under.map(q => q[1])) : null;
    return { name, s0, pts, highestInCave: top, clearance: top == null ? null : +(CAVE.roof - top).toFixed(1) };
  });
}
const out = { h3: hole3(), h5: hole5(), h9: { ...hole9(), shots: caveShots() }, lies: lies(), tees: TEES };
fs.writeFileSync(path.join(OUT, 'checks.json'), JSON.stringify(out, null, 1));
const p = (o) => JSON.stringify(o);
console.log('3', p(out.h3.res), 'green y', out.h3.greenY);
console.log('5', p(out.h5.res));
console.log('9 creek', out.h9.creek, 'cave', out.h9.caveYd, 'go', p(out.h9.goFrom), 'layup', p(out.h9.layup));
for (const t of ['low', 'high']) console.log('9', t, out.h9.res[t].routeYd, p(out.h9.res[t].sets));
console.log('lies', p(out.lies));
console.log('cave', p(out.h9.shots.map(q => [q.name, q.highestInCave, q.clearance])));
