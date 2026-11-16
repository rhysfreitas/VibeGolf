// node tools/labyrinth/sample.mjs : plan book round 1's numbers. For every play (the nine holes, and the other
// version of the 3rd and 7th): the ground and surfaces on a 1 m grid round the hole and the walls standing there (for
// plans.py), the profile, drives flown with the game's physics against the walls (they soak: stone 45%, ivy 80%), the
// checks the Musts ask for, the decisions, the par 3s, the bank shot, the greens. Writes out/grid/*.bin and
// out/sample.json, and out/checks.txt.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../../src/physics.js';
import { HOLES, PLAYS, COURSE, BACK, SETS, playName } from './holes.mjs';
import { PLAYED, SURF, PHYS, wallD } from './scene.mjs';
import { walls, wallsFor, floorAt, TOWER, P } from './world.mjs';
import { at, project, lengthOf, headingAt, inPoly, rnd, YD } from './geo.mjs';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), lap = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
const ALT = COURSE.altFt;
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, long: { Speed: 158, VLA: 11.5, TotalSpin: 2850 },
  mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, short: { Speed: 132, VLA: 13, TotalSpin: 3300 }, shorter: { Speed: 115, VLA: 14, TotalSpin: 3500 } };
const PLAYER = { tower: 'long', rampart: 'mid', gate: 'short', court: 'shorter', tips: 'tour' };
const CLUBS = { 'PW': [102, 24, 9300], '9 iron': [109, 20.4, 8647], '7 iron': [120, 16.3, 7097], '5 iron': [132, 12.1, 5361], 'hybrid': [146, 10.2, 4437], '3 wood': [158, 9.2, 3655] };
function forCarry(club, carry) {   // a club's ball data for a carry in yards (speed scaled; launch and spin kept)
  const [S0, V, T] = CLUBS[club]; let lo = S0 * 0.3, hi = S0 * 1.25;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2, c = simulate({ Speed: m, VLA: V, HLA: 0, TotalSpin: T, SpinAxis: 0 }, { altFt: ALT, flightOnly: true, groundAt: () => 0 }).carry; if (c < carry) lo = m; else hi = m; }
  return { Speed: (lo + hi) / 2, VLA: V, TotalSpin: T };
}
const clubFor = yd => yd < 120 ? 'PW' : yd < 150 ? '9 iron' : yd < 170 ? '7 iron' : yd < 195 ? '5 iron' : yd < 215 ? 'hybrid' : '3 wood';
// flat-ground carry and total of each driver preset (yd)
const FLAT = Object.fromEntries(Object.entries(DRIVES).map(([k, b]) => { const r = simulate({ ...b, HLA: 0, SpinAxis: 0 }, { altFt: ALT, groundAt: () => 0, surfaceAt: () => 'fairway' }); return [k, { carry: r.carry, total: Math.hypot(r.pts.at(-1).p[0], r.pts.at(-1).p[2]) / YD }]; }));
// the ball a player hits to a spot d yd away: the driver if it's at or past their total, else a club carrying short of it
function clubTo(pl, d) {
  const f = Object.entries(DRIVES).find(([, b]) => b === pl)[1], k = Object.keys(DRIVES).find(n => DRIVES[n] === pl), F = FLAT[k];
  if (d >= F.total - 6) return { ...f, club: 'driver' };
  const roll = d > 215 ? 14 : d > 180 ? 9 : 5, carry = d - roll, club = carry > 205 ? '3 wood' : clubFor(carry);
  return { ...forCarry(club, carry), club };
}
// plays-like (yd) of a par 3 dist yd away with the green dh m above the tee: the flat carry that lands at that height
function playsLike(dist, dh) {
  let lo = 40, hi = 330;
  for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2, b = forCarry(clubFor(m), m), r = simulate({ ...b, HLA: 0, SpinAxis: 0 }, { altFt: ALT, flightOnly: true, voidY: -400, groundAt: (x, z) => Math.hypot(x, z) > dist * YD * 0.6 ? dh : dh - 60 }); if (Math.hypot(r.pts.at(-1).p[0], r.pts.at(-1).p[2]) / YD < dist) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---- the walls as solids, per version: a 20 m bucket grid; a lean shifts the footprint with height ----
const SOLIDS = {};
function solidsFor(ver) {
  const key = JSON.stringify(ver); if (SOLIDS[key]) return SOLIDS[key];
  const B = new Map(), K = (i, j) => i * 100000 + j;
  for (const w of wallsFor(ver)) {
    if (w.ground) continue;
    const sh = w.shift || [0, 0], xs = w.pts.flatMap(p => [p[0], p[0] + sh[0]]), zs = w.pts.flatMap(p => [p[1], p[1] + sh[1]]);
    for (let i = Math.floor(Math.min(...xs) / 20); i <= Math.floor(Math.max(...xs) / 20); i++) for (let j = Math.floor(Math.min(...zs) / 20); j <= Math.floor(Math.max(...zs) / 20); j++) { const k = K(i, j); if (!B.has(k)) B.set(k, []); B.get(k).push(w); }
  }
  const hit = (X, Y, Z) => {
    for (const w of B.get(K(Math.floor(X / 20), Math.floor(Z / 20))) || []) {
      if (Y < w.y0 || Y > w.y1) continue;
      const t = (Y - w.y0) / (w.y1 - w.y0), sh = w.shift || [0, 0], x = X - sh[0] * t, z = Z - sh[1] * t;
      if (!inPoly(w.pts, x, z)) continue;
      return w;
    }
    return null;
  };
  const normal = (w, X, Y, Z) => {
    if (w.y1 - Y < 0.6) return [0, 1, 0];
    const t = (Y - w.y0) / (w.y1 - w.y0), sh = w.shift || [0, 0], x = X - sh[0] * t, z = Z - sh[1] * t, Q = w.pts;
    const cx = Q.reduce((a, p) => a + p[0], 0) / Q.length, cz = Q.reduce((a, p) => a + p[1], 0) / Q.length;
    let best = Infinity, n = [0, 0];
    for (let i = 0; i < Q.length; i++) {
      const [ax, az] = Q[i], [bx, bz] = Q[(i + 1) % Q.length], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l)));
      const d = Math.hypot(x - ax - dx * u, z - az - dz * u);
      if (d < best) { best = d; let nx = -dz / l, nz = dx / l; const mx = (ax + bx) / 2 - cx, mz = (az + bz) / 2 - cz; if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; } n = [nx, nz]; }
    }
    return [n[0], 0, n[1]];
  };
  const near = (X, Z) => B.get(K(Math.floor(X / 20), Math.floor(Z / 20))) || [];
  return (SOLIDS[key] = { hit, normal, near });
}
const verOf = B => ({ 3: B.h.n === 3 ? B.h.ver || 'A' : 'A', 7: B.h.n === 7 ? B.h.ver || 'A' : 'A' });

let seed = 11; const rng = () => (seed = seed * 16807 % 2147483647) / 2147483647;
// a shot from p (world) toward heading dir (radians, 0 = north/-Z, + right), with the walls: where it lands and rests
function shot(B, p, dir, ball, y0in = null) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = y0in ?? B.ground(...p), SO = solidsFor(verOf(B));
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const toShot = (nx, nz) => [c * nx + s * nz, -s * nx + c * nz];
  let wallHit = null;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...ball }, {
    groundAt: (lx, lz) => B.ground(...W(lx, lz)) - y0,
    surfaceAt: (lx, lz) => PHYS[B.surface(...W(lx, lz))] || 'rough',
    solidAt: (lx, ly, lz) => { const [X, Z] = W(lx, lz), Y = ly + y0, w = SO.hit(X, Y, Z); if (!w) return null; wallHit = wallHit || w; const n = SO.normal(w, X, Y, Z), [u, v] = toShot(n[0], n[2]), o = [u, n[1], v]; if (w.soak) o.soak = w.soak; return o; },
    rng, altFt: ALT,
  });
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const E = W(end.p[0], end.p[2]), Lp = W(land.p[0], land.p[2]);
  const track = []; for (const [i, q] of r.pts.entries()) if (i % 10 === 0 || i === r.pts.length - 1) { const [x, z] = W(q.p[0], q.p[2]); track.push([+x.toFixed(1), +z.toFixed(1), +(y0 + q.p[1]).toFixed(1)]); }
  return { carry: Math.hypot(Lp[0] - p[0], Lp[1] - p[1]), total: Math.hypot(E[0] - p[0], E[1] - p[1]), land: Lp, end: E, rest: B.surface(...E), wall: wallHit ? wallHit.kind : null, apex: Math.max(...r.pts.map(q => q.p[1])), track };
}
const dirTo = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
// fairway across the line at a point (metres, square to the line there); lanes 6 m or more
function across(B, pt) {
  const pr = project(B.h.line, ...pt), d = headingAt(B.h.line, Math.max(1, Math.min(B.h.len - 1, pr.s))) + Math.PI / 2, nx = Math.sin(d), nz = -Math.cos(d), out = []; let run = 0;
  for (let a = -90; a <= 90; a += 0.5) { if (B.surface(pt[0] + nx * a, pt[1] + nz * a) === 'fairway') run += 0.5; else { if (run >= 6) out.push(run); run = 0; } }
  if (run >= 6) out.push(run);
  return out;
}
// what's on each side of a landing area: penalty ground within 45 m of the line, left and right
function sides(B, s) {
  const pen = side => { for (let a = 5; a <= 45; a += 1) { const v = B.surface(...at(B.h.line, s, side * a)); if (v === 'water' || v === 'penalty') return v; } return null; };
  return [pen(-1), pen(1)];
}

// ---- per play ----
const meta = [], report = [], R_ = (...a) => { const l = a.join(' '); report.push(l); console.log(l); };
const ONLY = process.argv.slice(2);   // node sample.mjs 3B 7A: only those plays, printed, nothing written
for (const B of PLAYED.filter(b => !ONLY.length || ONLY.includes(`${b.h.n}${b.h.ver || ''}`))) {
  const h = B.h, tag = `${h.n}${h.ver || ''}`, back = h.teePts[BACK];
  // the grid for the plan: 1 m cells over the hole with 80 m round it
  const xs = [...h.line.map(p => p[0]), ...Object.values(h.teePts).map(p => p[0])], zs = [...h.line.map(p => p[1]), ...Object.values(h.teePts).map(p => p[1])], M = 80;
  if (h.tips) { xs.push(h.tips.tee[0]); zs.push(h.tips.tee[1]); }
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const X = x0 + c + 0.5, Z = z0 + r + 0.5; hgt[r * W + c] = B.ground(X, Z); srf[r * W + c] = SURF.indexOf(B.surface(X, Z)); }
  fs.writeFileSync(`${OUT}/h${tag}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const ws = wallsFor(verOf(B)).filter(w => w.pts.some(p => p[0] > x0 - 20 && p[0] < x1 + 20 && p[1] > z0 - 20 && p[1] < z1 + 20))
    .map(w => ({ pts: w.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]), y0: +w.y0.toFixed(1), y1: +(+w.y1).toFixed(1), floor: +floorAt(...w.pts[0]).toFixed(1), kind: w.kind, ground: !!w.ground, shift: w.shift || null }));
  const along = (L, st = 2) => { const len = lengthOf(L), out = []; for (let s = -40; s <= len + 40; s += st) { const p = s < 0 ? at(L, 0, 0).map((v, i) => v + (L[0][i] - L[1][i]) / Math.hypot(L[1][0] - L[0][0], L[1][1] - L[0][1]) * -s) : at(L, s); out.push([s, +B.ground(...p).toFixed(2), B.surface(...p), +wallTop(B, ...p).toFixed(1)]); } return out; };
  seed = 11 + h.n * 7;
  // drives: each tee set's player, aimed at the first target (or down the line); the tips with a tour drive
  const drives = {}, minW = {};
  if (h.par > 3) for (const k of [...SETS, ...(h.tips ? ['tips'] : [])]) {
    const p = k === 'tips' ? h.tips.tee : h.teePts[k], pl = DRIVES[PLAYER[k]], safe = h.targets.filter(t => !t.bold && !t.second);
    // the furthest safe target the player reaches, and the club that gets there (a driver if it's past them)
    const reach = FLAT[PLAYER[k]].total, ds = safe.map(t => Math.hypot(t.at[0] - p[0], t.at[1] - p[1]) / YD), j = ds.reduce((b, d, i) => d <= reach + 5 && (b < 0 || d > ds[b]) ? i : b, -1);
    const tgt = j >= 0 ? safe[j].at : safe[0] ? safe[0].at : at(h.line, Math.min(h.len, 230)), d = Math.hypot(tgt[0] - p[0], tgt[1] - p[1]) / YD;
    const ball = clubTo(pl, d); drives[k] = shot(B, p, dirTo(p, tgt), ball); drives[k].club = ball.club; drives[k].ball = ball; drives[k].aim = tgt;
    drives[k].lanes = across(B, drives[k].end);
    // the Must: fairway across where the set's drive (minDrive, or 160 yd for the forward set) comes down, toward that target
    const md = (k === 'tips' ? COURSE.tipsSet.minDrive : COURSE.teeSets.find(t => t.id === k).minDrive) || 160, dd = dirTo(p, tgt), q = [p[0] + Math.sin(dd) * Math.min(md, d + 10) * YD, p[1] - Math.cos(dd) * Math.min(md, d + 10) * YD];
    minW[k] = { at: q, lanes: across(B, q), surf: B.surface(...q) };
  }
  // the decision: the bold line from each tee set
  const boldT = h.targets.find(t => t.bold && !t.second);
  const boldBall = (pl, d) => h.n === 3 ? pl : clubTo(pl, d);   // the Elbow's carry wants a driver's height
  const bold = boldT && h.par > 3 ? Object.fromEntries(SETS.map(k => { const p = h.teePts[k], r = shot(B, p, dirTo(p, boldT.at), boldBall(DRIVES[PLAYER[k]], Math.hypot(boldT.at[0] - p[0], boldT.at[1] - p[1]) / YD)); return [k, { ...r, toPin: Math.hypot(r.end[0] - h.pin[0], r.end[1] - h.pin[1]) / YD, need: Math.hypot(boldT.at[0] - p[0], boldT.at[1] - p[1]) / YD }]; })) : null;
  // the bold line with an amateur's miss: 24 from the Rampart tee (the mid player)
  const boldScatter = [];
  if (boldT && h.par > 3) { const r2 = rnd(600 + h.n), p = h.teePts.rampart, b0 = boldBall(DRIVES.mid, Math.hypot(boldT.at[0] - p[0], boldT.at[1] - p[1]) / YD);
    for (let i = 0; i < 24; i++) { const s = shot(B, p, dirTo(p, boldT.at), { ...b0, HLA: 3 * gauss(r2), SpinAxis: 6.5 * gauss(r2), Speed: b0.Speed * (1 + 0.03 * gauss(r2)) }); boldScatter.push({ end: s.end.map(v => +v.toFixed(1)), rest: s.rest, wall: s.wall, toPin: Math.round(Math.hypot(s.end[0] - h.pin[0], s.end[1] - h.pin[1]) / YD) }); } }
  // a scatter: 24 drives from the back tee with an amateur's miss (start σ 3°, axis σ 6.5°): where they finish
  const scatter = [];
  if (h.par > 3) { const r2 = rnd(500 + h.n), tgt = drives.rampart ? drives.rampart.aim : at(h.line, 230), b0 = drives.rampart.ball;
    for (let i = 0; i < 24; i++) { const s = shot(B, h.teePts.rampart, dirTo(h.teePts.rampart, tgt), { ...b0, HLA: 3 * gauss(r2), SpinAxis: 6.5 * gauss(r2) }); scatter.push({ end: s.end.map(v => +v.toFixed(1)), rest: s.rest, wall: s.wall, off: +project(h.line, ...s.end).off.toFixed(1) }); } }
  // par 3s: a club for each tee to the middle of the green (aimed at the pin), and 12 with an amateur's miss
  const tee3 = {};
  if (h.par === 3) for (const k of [...SETS, ...(h.tips ? ['tips'] : [])]) {
    const p = k === 'tips' ? h.tips.tee : h.teePts[k], dist = Math.hypot(h.pin[0] - p[0], h.pin[1] - p[1]) / YD, dh = B.pinY - B.ground(...p);
    const yd = playsLike(dist, dh), club = clubFor(yd), best = { club, yd, r: shot(B, p, dirTo(p, h.pin), forCarry(club, yd)) };
    const r2 = rnd(700 + h.n), miss = [];
    for (let i = 0; i < 12; i++) { const s = shot(B, p, dirTo(p, h.pin), { ...forCarry(best.club, best.yd * (1 + 0.05 * gauss(r2))), HLA: 3 * gauss(r2), SpinAxis: 6.5 * gauss(r2) }); miss.push({ end: s.end.map(v => +v.toFixed(1)), rest: s.rest, wall: s.wall }); }
    tee3[k] = { dist: Math.round(dist), drop: +dh.toFixed(1), club: best.club, plays: Math.round(best.yd), rest: best.r.rest, wall: best.r.wall, track: best.r.track, on: miss.filter(m => m.rest === 'green').length, walls: miss.filter(m => m.wall).length, miss };
  }
  const gs = greenStats(B), leans = leanAlong(B);
  const targets = h.targets.map(t => ({ name: t.name, p: t.at, bold: t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), lanes: across(B, t.at), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) }));
  meta.push({ n: h.n, ver: h.ver, tag, name: playName(h), par: h.par, yards: h.yards, tips: h.tips, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts, head: h.head,
    teeY: B.ground(...back), pinY: B.pinY, walls: ws, prof: along(h.line), boldProf: boldT ? along([back, boldT.at]) : null, boldAt: boldT ? boldT.at : null,
    drives: Object.fromEntries(Object.entries(drives).map(([k, d]) => [k, { club: d.club, carry: Math.round(d.carry / YD), total: Math.round(d.total / YD), rest: d.rest, wall: d.wall, lanes: d.lanes, end: d.end, track: d.track }])),
    bold: bold && Object.fromEntries(Object.entries(bold).map(([k, d]) => [k, { carry: Math.round(d.carry / YD), total: Math.round(d.total / YD), rest: d.rest, wall: d.wall, toPin: Math.round(d.toPin), need: Math.round(d.need), end: d.end, track: d.track }])),
    scatter, boldScatter, minW, tee3, green: { area: gs.area, fall: +gs.fall.toFixed(1), relief: +gs.relief.toFixed(2), pinSlope: +gs.pinSlope.toFixed(1), areas: gs.areas.length, cup: +gs.cup.toFixed(2), maxSlope: +gs.maxSlope.toFixed(1) },
    leans: leans.map(([s, l]) => [s, +l.toFixed(1)]), targets, sand: B.bunkers.map(b => ({ x: b.x, z: b.z, rx: b.rx, rz: b.rz, rot: b.rot })), plants: (h.plants || []).map(t => ({ ...t })),
    words: h.words, card: h.card, shape: h.shape, green0: h.green });
  lap(`${tag} sampled`);
}
function wallTop(B, X, Z) {   // the highest standing wall over a point (0 if none), metres over the floor there
  if (wallD(X, Z) > 0) return 0;
  let top = 0; for (const w of solidsFor(verOf(B)).near(X, Z)) if (inPoly(w.pts, X, Z)) top = Math.max(top, +w.y1 - floorAt(X, Z)); return top;
}

// ---- the checks ----
R_('THE LABYRINTH: plan book round 1 checks', new Date().toISOString().slice(0, 10));
for (const m of meta) {
  const B = PLAYED.find(b => `${b.h.n}${b.h.ver || ''}` === m.tag), h = B.h;
  R_(`\n${m.tag} ${m.name}, par ${m.par}: ${SETS.map(k => `${k} ${m.yards[k]}`).join(', ')}${m.tips ? `; tips ${m.tips.yards}` : '; no tips spot'}`);
  // pins at 3% or less; green
  R_(`${m.green.pinSlope > 3 ? '!' : ' '} green ${m.green.area} m², fall ${m.green.fall}%, relief ${m.green.relief} m, pin ${m.green.pinSlope}%, ${m.green.areas} pin areas, cuppable ${Math.round(m.green.cup * 100)}%, steepest ${m.green.maxSlope}%`);
  // tees: off fairway, on their pads, nothing overhead under 45 m
  for (const [k, p] of [...Object.entries(h.teePts), ...(h.tips ? [['tips', h.tips.tee]] : [])]) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.2) for (let r = 0; r < 14; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 10) R_(`! ${k} tee: fairway ${near} m away`);
    const sf = B.surface(...p); if (sf !== 'tee') R_(`! ${k} tee pad reads ${sf}`);
    const g = B.ground(...p), over = wallsFor(verOf(B)).filter(w => !w.ground && w.y0 > g - 1 && w.y0 - g < 45 && [[0, 0], [4, 5], [-4, -5], [4, -5], [-4, 5]].some(([u, v]) => inPoly(w.pts, p[0] + u, p[1] + v)));
    if (over.length) R_(`! ${k} tee: ${over[0].kind} ${(over[0].y0 - g).toFixed(0)} m overhead`);
    const wdist = wallD(...p); if (wdist < 6) R_(`  ${k} tee: a wall ${wdist.toFixed(0)} m away`);
  }
  if (m.tips) { const t = m.tips.tee, b = h.teePts[BACK], d = Math.hypot(t[0] - b[0], t[1] - b[1]) / YD; R_(`${d < 20 || d > 50 ? '!' : ' '} tips ${d.toFixed(0)} yd behind the back tee${m.drives.tips ? `; a tour drive ${m.drives.tips.carry}/${m.drives.tips.total} yd, ${m.drives.tips.rest}, lanes ${m.drives.tips.lanes.join('+') || 0} m` : ''}`); }
  // drives: each set lands on 40 m+ of fairway (45-65 m for the back tee's)
  for (const [k, d] of Object.entries(m.drives)) {
    const w = Math.max(0, ...d.lanes), sumw = d.lanes.reduce((a, b) => a + b, 0), want = k === BACK ? 45 : 40;
    R_(`${d.rest !== 'fairway' ? '!' : ' '} ${k.padEnd(8)} ${d.club} ${d.carry}/${d.total} yd, ${d.rest}${d.wall ? ` (hit ${d.wall})` : ''}, fairway across ${d.lanes.join('+') || 0} m${k === BACK && w > 65 ? ' (over 65)' : ''}`);
  }
  for (const [k, w] of Object.entries(m.minW)) { const mx = Math.max(0, ...w.lanes); if (mx < (k === BACK ? 45 : 40)) R_(`! ${k}: ${w.surf}, ${w.lanes.join('+') || 0} m of fairway across where its minimum drive comes down`); }
  // penalty ground on one side of a landing area at most
  if (h.par > 3) for (const k of SETS) { const d = m.drives[k], s = project(h.line, ...d.end).s, [l, r] = sides(B, s); if (l && r) R_(`! ${k}: penalty ground both sides of the landing area (${l} / ${r})`); }
  if (m.scatter.length) { const c = {}; for (const s of m.scatter) { const k = s.rest + (s.wall ? ' off a wall' : ''); c[k] = (c[k] || 0) + 1; } R_('  24 amateur drives (back tee, mid):', Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', ')); }
  if (m.boldScatter.length) { const c = {}; for (const s of m.boldScatter) { const k = s.rest + (s.wall ? ' off a wall' : ''); c[k] = (c[k] || 0) + 1; } R_('  24 amateur bold drives (Rampart):', Object.entries(c).map(([k, v]) => `${k} ${v}`).join(', '), '; median', m.boldScatter.map(s => s.toPin).sort((a, b) => a - b)[12], 'yd to the pin'); }
  if (m.bold) R_('  bold line:', Object.entries(m.bold).map(([k, d]) => `${k} needs ${d.need} yd: ${d.carry}/${d.total} ${d.rest}${d.wall ? ' (' + d.wall + ')' : ''}, ${d.toPin} to the pin`).join(' · '));
  for (const t of m.targets) R_(`${t.surf !== 'fairway' ? '!' : ' '} target ${t.name}${t.bold ? ' (bold)' : ''}: ${t.d} yd, ${t.surf}, fairway across ${t.lanes.join('+') || 0} m, ${t.toPin} yd to the pin`);
  for (const [k, t] of Object.entries(m.tee3)) R_(`  ${k.padEnd(8)} ${t.dist} yd, ${t.drop > 0 ? 'up' : 'down'} ${Math.abs(t.drop)} m: ${t.club} carrying ${t.plays} yd lands ${t.rest}${t.wall ? ' (' + t.wall + ')' : ''}; with a miss ${t.on}/12 on the green, ${t.walls}/12 off a wall`);
  if (m.leans.length) { const L = m.leans.map(l => l[1]); R_(`  fairway lean ${Math.min(...L).toFixed(1)} to ${Math.max(...L).toFixed(1)}% (+ falls right)`); }
}

if (ONLY.length) process.exit(0);
// the 2nd's bank shot: long approaches into the end wall over the kick bank; share that finishes on the green
{
  const B = PLAYED.find(b => b.h.n === 2), h = B.h, rows = [];
  for (const [club, D] of [['7 iron', 165], ['5 iron', 190], ['hybrid', 210]]) for (const long of [0, 10, 20, 30, 40, 55]) {
    const start = at(h.line, h.len - D * YD), r2 = rnd(D + long); let on = 0, wall = 0;
    for (let i = 0; i < 12; i++) { seed = 900 + i + long; const s = shot(B, start, dirTo(start, h.pin), { ...forCarry(club, D + long), HLA: 1.5 * gauss(r2) }); if (s.rest === 'green') on++; if (s.wall) wall++; }
    rows.push({ club, D, long, on, wall });
  }
  R_('\nthe 2nd: approaches flown long into the end wall (12 each, a little start-line scatter): on the green / off the wall');
  for (const r of rows) R_(`  ${r.club} from ${r.D} yd, ${r.long} yd long: ${r.on}/12 on, ${r.wall}/12 hit the wall`);
  meta.find(m => m.tag === '2').bank = rows;
}
// the 9th: the second shot over the rubble from the wall top (the go), and the lay-up
{
  const B = PLAYED.find(b => b.h.n === 9), h = B.h, d = meta.find(m => m.tag === '9').drives;
  R_('\nthe 9th: second shots from where each set\'s drive finished');
  for (const k of SETS) {
    const p = d[k].end, toPin = Math.hypot(h.pin[0] - p[0], h.pin[1] - p[1]) / YD, sOn = project(h.line, ...p).s, toRub = (370 - sOn) / YD;
    const w3 = forCarry('3 wood', 250), go = shot(B, p, dirTo(p, h.pin), { ...w3, Speed: w3.Speed * DRIVES[PLAYER[k]].Speed / 167 }), lay = shot(B, p, dirTo(p, at(h.line, 342)), forCarry(clubFor(toRub - 22), toRub - 22));
    R_(`  ${k}: ${Math.round(toPin)} yd to go, ${Math.round(toRub)} to the rubble; a 3 wood ${Math.round(go.carry / YD)}/${Math.round(go.total / YD)} ${go.rest}, ${Math.round(Math.hypot(go.end[0] - h.pin[0], go.end[1] - h.pin[1]) / YD)} yd left; lay-up ${lay.rest}, ${Math.round(Math.hypot(lay.end[0] - h.pin[0], lay.end[1] - h.pin[1]) / YD)} yd left`);
  }
}
const total = HOLES.reduce((a, h) => a + h.yards[BACK], 0);
R_(`\ntotal ${total} yd (Tower), par ${HOLES.reduce((a, h) => a + h.par, 0)}; ${SETS.map(k => `${k} ${HOLES.reduce((a, h) => a + h.yards[k], 0)}`).join(', ')}; tips ${HOLES.reduce((a, h) => a + (h.tips ? h.tips.yards : h.yards[BACK]), 0)}`);
fs.writeFileSync(path.join(HERE, 'out/sample.json'), JSON.stringify({ meta, surf: SURF, total }));
fs.writeFileSync(path.join(HERE, 'out/checks.txt'), report.join('\n') + '\n');
lap('done');
