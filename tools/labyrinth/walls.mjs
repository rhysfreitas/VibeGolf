// node tools/labyrinth/walls.mjs : round 0's numbers for how the Labyrinth's walls play, flown with the game's own
// physics (src/physics.js). Writes out/walls.json for the proposal and prints a summary.
//  1. Corridor misses (the 2nd): walls 31 m either side of the line, 60 m high. Where a drive that reaches a wall
//     finishes, for soak 0 (every ball comes back), 0.45 (bare stone, as The Reclaim's facades) and 0.8 (ivy), against
//     the same drive in the open. Is a corridor a bumper lane (too helpful) or a gutter (too punishing)?
//  2. The bank shot (the 2nd): approaches that fly long into the end wall 34 m behind the pin: leaning 0, 8, 12 and 16
//     degrees, with a kick bank at its foot, against no wall and a plain soaking wall.
//  3. The Elbow's carry (the 3rd): drives along the bold line over the two low walls of the inside corner (round 0's
//     geometry from maze.mjs), from four tee spots, for the four tee sets' players. Which clear, and where the rest go.
//  4. The 1st's gate: second shots through the gate under its lintel 40 m up.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../../src/physics.js';
import { walls, floorAt, LINES, F3a, F3L, F3R, F1a, P } from './maze.mjs';
import { at, inPoly, rnd, project } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const YD = 0.9144, ALT = 1200;
const DRIVES = {   // ball data and what they do on a flat fairway at 1,200 ft (carry / total yd: printed below)
  tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, long: { Speed: 158, VLA: 11.5, TotalSpin: 2850 },
  mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, short: { Speed: 132, VLA: 13, TotalSpin: 3300 }, shorter: { Speed: 115, VLA: 14, TotalSpin: 3500 },
};
// the four tee sets' players (minDrive 260/230/200, and the forward set)
const PLAYERS = [['Tower', 'long'], ['Rampart', 'mid'], ['Gate', 'short'], ['Court', 'shorter']];
// a club's ball data for a carry (yd): scale the tour club's speed (launch and spin kept)
const CLUBS = { '9 iron': [109, 20.4, 8647], '7 iron': [120, 16.3, 7097], '5 iron': [132, 12.1, 5361], 'hybrid': [146, 10.2, 4437], '3 wood': [158, 9.2, 3655] };
function forCarry(club, carry) {
  const [S0, V, T] = CLUBS[club]; let lo = S0 * 0.4, hi = S0 * 1.2;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, c = simulate({ Speed: m, VLA: V, HLA: 0, TotalSpin: T, SpinAxis: 0 }, { altFt: ALT, flightOnly: true, groundAt: () => 0 }).carry; if (c < carry) lo = m; else hi = m; }
  return { Speed: (lo + hi) / 2, VLA: V, TotalSpin: T };
}
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const R = {};
const ONLY = process.argv[2] || '';
const want = k => !ONLY || ONLY === k;

if (want('corridor')) {
// ---- 1. corridor misses ---------------------------------------------------------------------------------------
// shot frame: tee at the origin, -z downrange, x right; walls' faces at |x| = 31, 10 m thick, 60 m high
function corridor(soak) {
  return {
    altFt: ALT, groundAt: () => 0,
    surfaceAt: (x) => { const a = Math.abs(x); return a < 25 ? 'fairway' : a < 28 ? 'firstcut' : a < 31 ? 'rough' : 'desert'; },
    solidAt: soak === null ? null : (x, y, z) => {
      const a = Math.abs(x); if (a < 31 || a > 41 || y > 60 || z > 40) return null;
      const n = [x > 0 ? -1 : 1, 0, 0]; if (soak) n.soak = soak; return n;
    },
  };
}
const open = { altFt: ALT, groundAt: () => 0, surfaceAt: x => Math.abs(x) < 25 ? 'fairway' : Math.abs(x) < 31 ? 'rough' : 'desert' };
function fly(ball, o, seed = 1) { const r = rnd(seed); return simulate({ HLA: 0, SpinAxis: 0, ...ball }, { ...o, rng: r }); }
const rest = res => { const e = res.pts.at(-1).p; return { x: e[0], d: -e[2], hit: res.rockHits > 0 }; };
{
  // a sweep: a 'mid' drive pushed or pulled (start line) and curved (spin axis) so it finishes 0-80 yd offline in
  // the open; with walls, where it finishes (offline, down) for each soak
  const sweep = [];
  for (const hla of [0, 3, 5, 7, 9, 11, 13]) for (const axis of [0, 10, 20]) {
    const ball = { ...DRIVES.mid, HLA: hla, SpinAxis: axis };
    const o0 = rest(fly(ball, open));
    const row = { hla, axis, open: o0 };
    for (const s of [0, 0.45, 0.8]) {
      // soak is random: fly it 40 times
      const out = []; for (let k = 0; k < 40; k++) out.push(rest(fly(ball, corridor(s), 100 + k)));
      row['s' + s] = out;
    }
    sweep.push(row);
  }
  // a scatter wider than the tool's (start σ 4.5°, axis σ 9°: a real amateur on a bad day), 2,000 drives, so plenty reach
  // the walls; shares of where they finish, and yards lost against the same drive in the open
  const scat = {}; const r = rnd(9);
  const balls = []; for (let k = 0; k < 2000; k++) balls.push({ ...DRIVES.mid, HLA: gauss(r) * 4.5, SpinAxis: gauss(r) * 9, Speed: DRIVES.mid.Speed * (1 + gauss(r) * 0.03) });
  const opens = balls.map(b => rest(fly(b, open)));
  for (const s of [0, 0.45, 0.8]) {
    const c = { n: 0, hit: 0, fairway: 0, rough: 0, foot: 0, back: 0, lostHit: 0, lostAll: 0, offOpen: 0, offWall: 0 };
    balls.forEach((b, k) => {
      const w = rest(fly(b, corridor(s), 500 + k)), o = opens[k], a = Math.abs(w.x);
      c.n++; if (!w.hit) return;
      c.hit++; c.lostHit += (o.d - w.d) / YD; c.offOpen += Math.abs(o.x) / YD; c.offWall += a / YD;
      if (a < 25) c.fairway++; else if (a < 28) c.rough++; else c.foot++;          // foot: the 3 m at the face
      if (a < 28) c.back++;
    });
    for (const k of ['lostHit', 'offOpen', 'offWall']) c[k] = c.hit ? +(c[k] / c.hit).toFixed(1) : 0;
    scat['s' + s] = c;
  }
  R.corridor = { sweep, scat };
  console.log('\n1. corridor (mid drive):');
  for (const [k, c] of Object.entries(scat)) console.log(`  soak ${k.slice(1)}: ${c.hit} of ${c.n} reach a wall; of those ${c.fairway} finish on the fairway, ${c.rough} rough, ${c.foot} at the foot; ${c.lostHit} yd shorter than in the open; offline ${c.offOpen} yd in the open -> ${c.offWall}`);
}

}
if (want('bank')) {
// ---- 2. the bank shot --------------------------------------------------------------------------------------
// frame: the pin at the origin, the approach from +z toward -z (downrange), the end wall's foot 34 m behind the pin.
// The green 12 x 16 m (half-axes); the kick bank (mown) rises from its back edge, 17 m behind the pin, to the wall's foot
// (k = 3, 4 or 5 m over the 17 m to the wall). The ball comes from D yd short of the pin.
function bank(lean, soak, kick = 3) {
  const wz = -34, tl = Math.tan(lean * Math.PI / 180), n = [0, -Math.sin(lean * Math.PI / 180), Math.cos(lean * Math.PI / 180)];
  if (soak) n.soak = soak;
  const g = (x, z) => z < -17 ? kick * Math.min(1, (-17 - z) / 17) : 0;          // the bank starts at the green's back edge
  return {
    altFt: ALT, groundAt: (x, z) => g(x, z),
    // the collar and the kick bank are mown short ('fairway' to the physics: main.js plays 'fringe' as fairway)
    surfaceAt: (x, z) => { const e = (x / 12) ** 2 + (z / 16) ** 2; return e < 1 ? 'green' : e < 1.45 ? 'fairway' : z < -19 ? 'fairway' : Math.abs(x) < 25 ? 'fairway' : 'rough'; },
    solidAt: lean === null ? null : (x, y, z) => (y < 60 && z < wz + y * tl && z > wz - 14 + y * tl && Math.abs(x) < 41) ? n : null,
  };
}
{
  const cases = [['no wall', null, 0, 0], ['upright, soaks 45%, no bank', 0, 0.45, 0], ['upright, no bank', 0, 0, 0], ['upright, bank 5 m', 0, 0, 5],
    ['leaning 12°, no bank', 12, 0, 0], ['leaning 12°, bank 4 m', 12, 0, 4], ['leaning 12°, bank 5 m', 12, 0, 5], ['leaning 12°, bank 5 m, ivy (soaks 80%)', 12, 0.8, 5], ['leaning 18°, bank 5 m', 18, 0, 5]];
  const rows = [], LONGS = [0, 8, 16, 24, 32, 40, 50, 65, 80];
  for (const [club, D] of [['9 iron', 140], ['7 iron', 165], ['5 iron', 190], ['hybrid', 210], ['3 wood', 230]]) {
    for (const long of LONGS) {
      const ball = forCarry(club, D + long), row = { club, D, long };
      for (const [name, lean, soak, kick] of cases) {
        const b = bank(lean, soak, kick), sh = D * YD, res = [];
        const o = { altFt: ALT, groundAt: (x, z) => b.groundAt(x, z + sh), surfaceAt: (x, z) => b.surfaceAt(x, z + sh), solidAt: b.solidAt && ((x, y, z) => b.solidAt(x, y, z + sh)) };
        for (let k = 0; k < (soak ? 20 : 1); k++) {
          const r = simulate({ ...ball, HLA: 0, SpinAxis: 0 }, { ...o, rng: rnd(40 + k) }), e = r.pts.at(-1).p, x = e[0], z = e[2] + sh;
          res.push({ x: +x.toFixed(1), z: +z.toFixed(1), on: (x / 12) ** 2 + (z / 16) ** 2 < 1, hit: r.rockHits > 0 });
        }
        row[name] = res;
      }
      rows.push(row);
    }
  }
  // sample flights for the figure: a 7 iron from 165 yd, hit 0, 24, 40 and 65 yd long, with no wall and with the
  // proposed wall (leaning 12°, a 5 m bank), as (z behind the pin, height) every 0.1 s
  const tracks = {};
  for (const [name, lean, soak, kick] of [['no wall', null, 0, 0], ['leaning 12°, bank 5 m', 12, 0, 5]]) {
    tracks[name] = [0, 24, 40, 65].map(long => {
      const D = 165, sh = D * YD, b = bank(lean, soak, kick), ball = forCarry('7 iron', D + long);
      const r = simulate({ ...ball, HLA: 0, SpinAxis: 0 }, { altFt: ALT, rng: rnd(3), groundAt: (x, z) => b.groundAt(x, z + sh), surfaceAt: (x, z) => b.surfaceAt(x, z + sh), solidAt: b.solidAt && ((x, y, z) => b.solidAt(x, y, z + sh)) });
      let last = -1; const pts = [];
      for (const p of r.pts) if (p.t - last >= 0.05 || p.hit) { pts.push([+(p.p[2] + sh).toFixed(2), +p.p[1].toFixed(2)]); last = p.t; }
      pts.push([+(r.pts.at(-1).p[2] + sh).toFixed(2), +r.pts.at(-1).p[1].toFixed(2)]);
      return { long, pts };
    });
  }
  R.bank = { cases: cases.map(c => c[0]), rows, longs: LONGS, tracks };
  console.log('\n2. bank shot: share finishing on the green, by how far long the ball was hit (yd past the pin: ' + LONGS.join(' ') + ')');
  for (const c of R.bank.cases) {
    const by = LONGS.map(l => { const rs = rows.filter(r => r.long === l).flatMap(r => r[c]); return Math.round(100 * rs.filter(q => q.on).length / rs.length); });
    console.log('  ' + c.padEnd(38), by.map(v => String(v).padStart(4) + '%').join(''));
  }
}

}
// ---- 3. the Elbow's carry ------------------------------------------------------------------------------------
// the round-0 maze as the physics sees it: every prism is solid (soak as set), the floor from floorAt. A ball that
// comes down on a low wall's top is pushed off its nearer side (the game will drop it at the foot on the tee side, as
// The Reclaim drops a ball off a roof)
const MZ = walls('dressed', 'L');
function mazeOpts() {
  const near = (x, z) => MZ.filter(w => inPoly(w.pts, x, z));
  return {
    altFt: ALT,
    groundAt: (x, z) => floorAt(x, z),
    surfaceAt: (x, z) => 'rough',
    solidAt: (x, y, z) => {
      for (const w of near(x, z)) {
        if (y < w.y0 || y > w.y1) continue;
        // outward normal of the nearest side
        let best = null, bd = 1e9;
        for (let i = 0; i < 4; i++) {
          const a = w.pts[i], b = w.pts[(i + 1) % 4], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez), nx = ez / l, nz = -ex / l;
          const d = Math.abs((x - a[0]) * nx + (z - a[1]) * nz); if (d < bd) { bd = d; best = [nx, 0, nz]; }
        }
        // make it point outward (away from the centroid)
        const cx = w.pts.reduce((s, p) => s + p[0], 0) / 4, cz = w.pts.reduce((s, p) => s + p[1], 0) / 4;
        if ((x - cx) * best[0] + (z - cz) * best[2] < 0) best = best.map(v => -v);
        best.soak = w.soak; return best;
      }
      return null;
    },
  };
}
const MO = mazeOpts();
// fly a ball from a world point toward an aim point (world), in the world frame
function worldShot(from, aim, ball, seed = 1, o = MO) {
  const y0 = o.groundAt(from[0], from[1]);
  const yaw = Math.atan2(aim[0] - from[0], -(aim[1] - from[1])), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => from[0] + lx * c - lz * s, wz = (lx, lz) => from[1] + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...ball }, {
    altFt: ALT, rng: rnd(seed),
    groundAt: (lx, lz) => o.groundAt(wx(lx, lz), wz(lx, lz)) - y0,
    surfaceAt: () => 'rough',
    solidAt: (lx, ly, lz) => { const n = o.solidAt(wx(lx, lz), y0 + ly, wz(lx, lz)); if (!n) return null; const m = [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; m.soak = n.soak; return m; },
  });
  const pts = r.pts.map(p => [wx(p.p[0], p.p[2]), y0 + p.p[1], wz(p.p[0], p.p[2])]);
  return { r, pts, end: pts.at(-1) };
}
if (want('elbow')) {
  // the tee spots (round 0: along leg 1; the plan book sets them): back 0, then 20, 45, 80 m down the line
  const spots = { Tower: 0, Rampart: 20, Gate: 45, Court: 80 };
  const land = at(F3L.L, 70, 2);                              // the bold line's landing area in leg 2, about 60 yd short of the green
  const where = p => {
    const a = project(F3a.L, p[0], p[2]), b = project(F3L.L, p[0], p[2]), c = project(F3R.L, p[0], p[2]);
    if (b.s > 32 && Math.abs(b.off) < 30) return 'leg 2 (bold line made)';
    if (c.s > 32 && Math.abs(c.off) < 30) return 'the shut leg';
    if (Math.abs(a.off) < 30 && a.s < 215) return 'leg 1 (the tee side)';
    if (Math.abs(a.off) < 30) return 'the corner';
    return 'the court (behind the low walls)';
  };
  const rows = [];
  for (const [set, key] of PLAYERS) {
    const from = at(F3a.L, spots[set], 0), ball = DRIVES[key];
    // the crest: the far low wall's line along this tee's bold line
    const res = worldShot(from, land, ball, 7), d = Math.hypot(res.end[0] - from[0], res.end[2] - from[1]);
    // height over the floor where the line crosses the far low wall (leg 2's inside face, off -30..-40)
    let crest = null;
    for (const p of res.pts) { const b = project(F3L.L, p[0], p[2]); if (b.s > 38 && b.s < 90 && b.off > -40 && b.off < -30) { crest = { h: +(p[1] - floorAt(p[0], p[2])).toFixed(1), d: +(Math.hypot(p[0] - from[0], p[2] - from[1]) / YD).toFixed(0) }; break; } }
    // and a scatter of 60 drives at the same aim
    const r = rnd(spots[set] + 3), tally = {}, ends = [];
    for (let k = 0; k < 60; k++) { const b = { ...ball, HLA: gauss(r) * 3, SpinAxis: gauss(r) * 6.5, Speed: ball.Speed * (1 + gauss(r) * 0.03), VLA: ball.VLA + gauss(r) * 1.8 }; const q = worldShot(from, land, b, 300 + k); const w = where(q.end); tally[w] = (tally[w] || 0) + 1; ends.push([+q.end[0].toFixed(1), +q.end[2].toFixed(1), w]); }
    // the carry the bold line asks for from this tee: the distance to the far low wall's face along the aim
    const aimLen = Math.hypot(land[0] - from[0], land[1] - from[1]); let need = null;
    for (let s = 0; s < aimLen; s += 1) { const x = from[0] + (land[0] - from[0]) * s / aimLen, z = from[1] + (land[1] - from[1]) * s / aimLen, b = project(F3L.L, x, z); if (b.s > 38 && b.off > -41 && b.off < -29) { need = +((s + 10) / YD).toFixed(0); break; } }
    const track = res.pts.filter((p, i) => i % 24 === 0).map(p => p.map(v => +v.toFixed(1)));
    // and where each scattered drive finished (for the plan)
    rows.push({ set, player: key, from: spots[set], tee: from, need, crest, finish: where(res.end), end: res.end.map(v => +v.toFixed(1)), hits: res.r.rockHits, dist: +(d / YD).toFixed(0), tally, track, ends });
  }
  R.elbow = { land, rows };
  console.log('\n3. the Elbow, bold line (aim: leg 2, 70 m past the corner):');
  for (const r of rows) console.log(`  ${r.set.padEnd(8)} ${r.player.padEnd(8)} tee +${r.from} m: carry needed ${r.need} yd; straight one is ${r.crest ? r.crest.h + ' m up at ' + r.crest.d + ' yd' : 'down before the wall'} -> ${r.finish} at ${r.end} (${r.hits} hits); scatter`, JSON.stringify(r.tally));
}

if (want('gate')) {
// ---- 4. the 1st's gate --------------------------------------------------------------------------------------
{
  const gate = P([210, 306]), rows = [];
  for (const short of [40, 70, 100, 140, 180]) {               // metres short of the gate, on the line through it
    const dir = [gate[0] - LINES[1][0][0], gate[1] - LINES[1][0][1]], l = Math.hypot(...dir), u = dir.map(v => v / l);
    const from = [gate[0] - u[0] * short, gate[1] - u[1] * short], aim = [gate[0] + u[0] * 150, gate[1] + u[1] * 150];
    const row = { short };
    for (const club of ['3 wood', 'hybrid', '5 iron', '7 iron']) {
      const [S, V, T] = CLUBS[club], q = worldShot(from, aim, { Speed: S, VLA: V, TotalSpin: T }, 1);
      let h = null; for (const p of q.pts) { if (Math.hypot(p[0] - from[0], p[2] - from[1]) >= short) { h = +(p[1] - floorAt(gate[0], gate[1])).toFixed(1); break; } }
      row[club] = { h, hit: q.r.rockHits > 0 };
    }
    rows.push(row);
  }
  R.gate = rows;
  console.log('\n4. the gate: height (m) as it passes through, by club and metres short of the gate (lintel at 40 m)');
  for (const r of rows) console.log(`  ${String(r.short).padStart(3)} m short:`, ['3 wood', 'hybrid', '5 iron', '7 iron'].map(c => `${c} ${r[c].h}${r[c].hit ? ' HIT' : ''}`).join(' · '));
}
}
for (const [k, b] of Object.entries(DRIVES)) { const r = simulate({ HLA: 0, SpinAxis: 0, ...b }, { altFt: ALT }); console.log(k, 'carry', r.carry.toFixed(0), 'total', (-r.pts.at(-1).p[2] / YD).toFixed(0)); }
const prev = fs.existsSync(path.join(OUT, 'walls.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'walls.json'))) : {};
fs.writeFileSync(path.join(OUT, 'walls.json'), JSON.stringify({ ...prev, ...R }));
