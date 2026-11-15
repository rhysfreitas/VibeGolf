// node tools/eldergrove/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), the course map
// raster, and the rules checks (out/grid/checks.txt; a line starting ! breaks a rule). Then: python3 plans.py,
// node sketch.mjs, node book.mjs. Every drive is flown with the game's physics through the trees as the game will
// build them (trees.js bodies: each giant's trunk soaks 45% of the balls that hit it, its crown from 60 m up) and on
// the forest lies Rhys picked on 14 November 2026: moss as first cut, fern as rough, leaf litter as beach, root as
// native.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK, FRONT } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, LOC, WOR, TRUNKS, FAR, WALLS, trunkFoot, ALLTREES, VISTAS } from './scene.mjs';
import { LABELS, HEART, POOL, FALLEN, ROOTPLATE, SHELL, fallenAt, w } from './world.mjs';
import { project, at, lengthOf, YD, headingAt, distLine } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { createTreeField } from '../../src/course/trees.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), lap = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const HYBRID = { Speed: 132, VLA: 13, TotalSpin: 4600 };   // about 205 yd carry: the high road's club
// the game's surfaces on this course (Rhys's picks, 14 November 2026)
const PHYS = { fairway: 'fairway', fringe: 'fairway', tee: 'fairway', green: 'green', moss: 'firstcut', fern: 'rough', meadow: 'rough', litter: 'beach', root: 'desert', bark: 'desert', sand: 'sand', water: 'water', void: 'rough' };
const SOAK = 0.45;
const ord = n => n + (['st', 'nd', 'rd'][n - 1] || 'th');
const TF = BUILT.map(B => createTreeField(B.trees.map(t => ({ x: t.x, y: t.y, z: t.z, h: t.h, cr: t.cr, low: t.low, tr: t.r, type: 'giant', soak: SOAK }))));
let seed = 11; const rng = () => (seed = seed * 16807 % 2147483647) / 2147483647;

// a drive from p along direction dir (radians from -z in the hole's frame, + right), flown through the trees and
// off the walls: where it lands and rests, and what it hits
function drive(B, p, dir, shot, k = BUILT.indexOf(B), y0in = null) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = y0in ?? (B.ground(p[0], p[1]) ?? 0);
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const toShot = (nx, nz) => [c * nx + s * nz, -s * nx + c * nz];
  const walls = B.walls;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return PHYS[v] || v; },
    treeAt: (lx, ly, lz) => { const [x, z] = W(lx, lz), q = TF[k].at(x, ly + y0, z); if (!q || !q.n) return q; const [a, b] = toShot(q.n[0], q.n[2]); return { n: [a, 0, b], soak: q.soak }; },
    solidAt: (lx, ly, lz) => { const [x, z] = W(lx, lz), y = ly + y0;
      for (const o of walls) { if (Math.abs(x - o.x) > 30 || Math.abs(z - o.z) > 30 || y < o.y || y > o.y + o.h) continue; const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), b = dx * Math.cos(o.rot) + dz * Math.sin(o.rot);
        if (Math.abs(a) < o.l / 2 && Math.abs(b) < o.w / 2) { const nh = (o.l / 2 - Math.abs(a)) < (o.w / 2 - Math.abs(b)) ? [Math.sign(a) * Math.sin(o.rot), -Math.sign(a) * Math.cos(o.rot)] : [Math.sign(b) * Math.cos(o.rot), Math.sign(b) * Math.sin(o.rot)]; const [u, v] = toShot(nh[0], nh[1]); return [u, 0, v]; } }
      return null; },
    rng, voidY: -80, altFt: COURSE.altFt,
  });
  const pts = [];
  for (const q of r.pts) { const [x, z] = W(q.p[0], q.p[2]); pts.push([+Math.hypot(x - p[0], z - p[1]).toFixed(1), +(y0 + q.p[1]).toFixed(2), q.phase === 'flight' ? 0 : 1]); }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]), [lx, lz] = W(land.p[0], land.p[2]);
  const hitAt = r.pts.find(q => q.hit);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), trees: r.treeHits, rocks: r.rockHits,
    hit: hitAt ? { d: Math.hypot(...W(hitAt.p[0], hitAt.p[2]).map((v, i) => v - p[i])), y: y0 + hitAt.p[1], what: r.treeHits ? 'a trunk' : 'a wall' } : null, rest: B.surface(ex, ez), end: [ex, ez], land: [lx, lz], latEnd: end.p[0] };
}

const meta = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 190;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H), Wk = WOR[i];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = worldAt(...Wk(x0 + c + 0.5, z0 + r + 0.5));
    hgt[r * W + c] = v.y - B.base; srf[r * W + c] = SURF.indexOf(v.s);
  }
  fs.writeFileSync(`${OUT}/h${h.n}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), B.solids(x, z).map(v => [v[0], v[1], v[2]])]); } return P; };
  const back = h.teePts[BACK], tee0 = B.ground(...back);
  const dir0 = headingAt(h.line, 1);
  seed = 11 + i;
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldPath) { const b = h.boldPath, d = Math.atan2(b[0] - back[0], -(b[1] - back[1])), Lb = [back, b], sh = h.n === 3 ? { hybrid: HYBRID, mid: DRIVES.mid } : DRIVES; bold = { line: Lb, prof: along(Lb), drives: Object.fromEntries(Object.entries(sh).map(([k, s]) => [k, drive(B, back, d, s)])) }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 70; x < h.pin[0] + 70; x++) for (let z = h.pin[1] - 70; z < h.pin[1] + 70; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const labels = [];
  for (const f of h.forms || []) if (f.label) labels.push([f.world ? h.L(...f.world) : f.at, f.label]);
  for (const [wp, t] of LABELS) { const p = LOC[i](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 170 && pr.s > -60 && pr.s < h.len + 120) labels.push([p, t]); }
  meta.push({ tips: h.tipsPt, tipsYards: h.tipsYards, tipsSet: COURSE.tipsSet, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), greenArea: gcells,
    targets: (h.targets || []).map(t => {
      const pr = project(h.line, ...t.at); let wd = 0;
      if (B.surface(...t.at) === 'fairway') { const d = headingAt(h.line, pr.s) + Math.PI / 2, nx = Math.sin(d), nz = -Math.cos(d); let a = 0, b = 0; while (a > -120 && B.surface(t.at[0] + nx * (a - 0.5), t.at[1] + nz * (a - 0.5)) === 'fairway') a -= 0.5; while (b < 120 && B.surface(t.at[0] + nx * (b + 0.5), t.at[1] + nz * (b + 0.5)) === 'fairway') b += 0.5; wd = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(wd), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    trees: B.trees.filter(t => Math.abs(t.x) < 900 && Math.abs(t.z) < 900).map(t => ({ x: +t.x.toFixed(1), z: +t.z.toFixed(1), r: t.r, placed: t.placed && t.hole === i, heart: t.heart, snag: t.snag, cr: t.cr })),
    walls: B.walls.map(o => ({ kind: o.kind, x: o.x, z: o.z, w: o.w, l: o.l, h: o.h, rot: o.rot })),
    sand: B.bunkers.map(b => ({ x: b.x, z: b.z, r: b.rx })),
    prof, drives, bold, words: h.words, card: h.card, shape: h.shape, green: h.green, base: h.base, place: h.place, labels, teeLift: h.teeY || {} });
  lap(`hole ${h.n} sampled`);
}

// the course map: the world's surface and a hillshade from its heights
const WR = 4, X0 = -760, X1 = 600, Z0 = -520, Z1 = 760;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, labels: LABELS, trees: [...TRUNKS, ...FAR].filter(t => t.X > X0 && t.X < X1 && t.Z > Z0 && t.Z < Z1).map(t => ({ X: +t.X.toFixed(1), Z: +t.Z.toFixed(1), r: t.r, placed: !!t.placed, heart: !!t.heart })),
  walls: WALLS.map(o => ({ kind: o.kind, X: o.X, Z: o.Z, w: o.w, l: o.l, rot: o.rot })),
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, par: h.par, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })), back: BACK }));
lap('course map');

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(18)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what : ''}`).join(' · ') : '');
  console.log('    green', m.greenArea, 'm2; targets', m.targets.map(t => `${t.name} ${t.d}yd ${t.surf} ${t.width}m`).join(' · '));
}
console.log('total', meta.reduce((a, m) => a + m.yards[BACK], 0), 'yd; par', meta.reduce((a, m) => a + m.par, 0));

// ---- the checks
const report = [];
const R_ = (...a) => { const l = a.join(' '); report.push(l); console.log(l); };
const lanes = (B, p, dir) => {
  const nx = Math.cos(dir), nz = Math.sin(dir), out = []; let run = 0;
  for (let a = -90; a <= 90; a += 0.5) { if (B.surface(p[0] + nx * a, p[1] + nz * a) === 'fairway') run += 0.5; else { if (run >= 6) out.push(run); run = 0; } }
  if (run >= 6) out.push(run);
  return out;
};
// pins at 3% or less; tees 12 m off the fairway; nothing overhead within 45 m of a tee (trunks or crowns)
const overhead = (B, p, g) => { const c = B.crownOver(...p), sol = B.solids(...p).filter(([a]) => a - g < 45); return { crown: c === null ? null : c - g, solid: sol.length ? sol[0][2] : null }; };
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; R_(`${sl > 3 ? '!' : ' '} ${h.n} pin slope ${sl.toFixed(1)}%`);
  const oh = [];
  for (const [k, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 14; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) R_(`! ${h.n} ${k} tee: fairway ${near} m away (12 m wanted)`);
    const sf = B.surface(...p); if (sf !== 'tee') R_(`! ${h.n} ${k} tee pad reads ${sf}`);
    const g = B.ground(...p), o = overhead(B, p, g);
    if (o.solid || (o.crown !== null && o.crown < 45)) R_(`! ${h.n} ${k} tee: ${o.solid || 'a crown'} overhead ${o.crown !== null ? o.crown.toFixed(0) + ' m up' : ''}`);
    oh.push(`${k} ${o.crown === null ? 'open sky' : Math.round(o.crown) + ' m'}`);
  }
  R_(`  ${h.n} over the tees (the lowest crown): ${oh.join(', ')}`);
}
lap('pins and tees');
function playsLike(dist, dh) {
  for (let mph = 60; mph <= 160; mph += 1) {
    const sh = { Speed: mph, VLA: 26 - mph * 0.08, TotalSpin: 8800 - mph * 32, HLA: 0, SpinAxis: 0 };
    const flat = simulate(sh, { groundAt: () => 0, altFt: COURSE.altFt, flightOnly: true });
    const drop = simulate(sh, { groundAt: (x, z) => Math.hypot(x, z) > 25 ? dh : 0, altFt: COURSE.altFt, voidY: -200, flightOnly: true });
    if (drop.carry * YD >= dist) return Math.round(flat.carry);
  }
  return null;
}
const p3 = [], CONT = [], LEANS = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], m = meta[i], back = h.teePts[BACK];
  // the tips spot
  const t = h.tipsPt, ts = B.surface(...t), tg = B.ground(...t);
  let nearG = Infinity; const tw = toWorld(h)(...t);
  for (const [k, H] of HOLES.entries()) if (k !== i) { const g = toWorld(H)(...H.pin); nearG = Math.min(nearG, Math.hypot(g[0] - tw[0], g[1] - tw[1])); }
  let nearF = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 16; r++) if (B.surface(t[0] + Math.cos(a) * r, t[1] + Math.sin(a) * r) === 'fairway') nearF = Math.min(nearF, r);
  const oh = overhead(B, t, tg);
  const hd0 = headingAt(h.line, 1), pc = Math.cos(hd0), ps = Math.sin(hd0), padY = [];
  for (const u of [-4.5, 0, 4.5]) for (const v of [-5.5, 0, 5.5]) padY.push(B.ground(t[0] + u * pc - v * ps, t[1] + u * ps + v * pc));
  const padOk = Math.max(...padY) - Math.min(...padY) <= 1.2, behind = h.tipsYards - h.yards[BACK];
  const lenOk = h.par === 3 ? behind >= 8 && behind <= 30 : behind >= 20 && behind <= 50;
  let land = '', landOk = true;
  if (h.par > 3) {
    const c = COURSE.tipsSet.minDrive, tsl = project(h.line, ...t).s - (project(h.line, ...t).s <= 0.01 ? Math.hypot(t[0] - h.line[0][0], t[1] - h.line[0][1]) : 0), s = Math.min(h.len - 1, tsl + c * YD);
    const ln = lanes(B, at(h.line, s), headingAt(h.line, s)), ok = Math.max(0, ...ln) >= 40 || ln.filter(v => v >= 25).length >= 2;
    land = ` ${c} yd drive: ${B.surface(...at(h.line, s))}, lanes ${ln.map(Math.round).join(' + ') || 'none'} m;`; landOk = ok || (h.tight && Math.max(0, ...ln) >= 30);
  }
  const ohOk = !oh.solid && (oh.crown === null || oh.crown >= 45);
  const okT = !['water', 'green', 'fairway', 'sand', 'bark'].includes(ts) && (padOk || h.tipsY) && lenOk && nearG > 35 && nearF >= 12 && ohOk && landOk;
  R_(`${okT ? ' ' : '!'} ${h.n} tips ${h.tipsYards} yd (+${behind}): ${ts}, pad ${h.tipsY ? 'on the stair, ' + h.tipsY + ' m up' : padOk ? 'level' : 'NOT LEVEL'} (${(Math.max(...padY) - Math.min(...padY)).toFixed(1)} m), ${nearF === Infinity ? '16+' : nearF} m off fairway, nearest other green ${Math.round(nearG)} m, overhead ${oh.crown === null ? 'open' : Math.round(oh.crown) + ' m'};${land}`);
  // every tee set's drive lands on 40 m or more of fairway (two lanes of 25 m on a split hole)
  if (h.par > 3) {
    const ws = [];
    for (const T of COURSE.teeSets) {
      const s0 = project(h.line, ...h.teePts[T.id]).s, s = Math.min(h.len - 20, s0 + (T.minDrive || 150) * YD);
      const p = at(h.line, s), dir = headingAt(h.line, s), ln = lanes(B, p, dir), wide = Math.max(0, ...ln), ok = wide >= 40 || ln.filter(v => v >= 25).length >= 2;
      ws.push(`${T.name} ${ln.length > 1 ? ln.map(Math.round).join('+') : Math.round(wide)}`);
      if (!ok && h.tight && T.id === BACK && wide >= 30) { R_(`  ${h.n} ${T.name} drive lands on ${Math.round(wide)} m: the nine's one tight fairway (the Avenue), 7 m of fern each side`); continue; }
      if (!ok) R_(`! ${h.n} ${T.name} drive (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, lanes ${ln.map(Math.round).join(', ') || 'none'} m`);
    }
    R_(`  ${h.n} landing widths (m): ${ws.join(', ')}`);
  }
  // the green
  const aim2 = (h.targets || []).filter(q => !q.bold).at(-1), from = h.par === 3 ? back : aim2 ? aim2.at : at(h.line, h.len - 120);
  const ap = Math.atan2(h.pin[0] - from[0], -(h.pin[1] - from[1])), ux = Math.sin(ap), uz = -Math.cos(ap);
  const pts = []; for (let x = h.pin[0] - 70; x < h.pin[0] + 70; x += 0.5) for (let z = h.pin[1] - 70; z < h.pin[1] + 70; z += 0.5) if (B.gm(x, z) < 0) pts.push([x, z]);
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = [Math.cos(th), Math.sin(th)];
  let ang = Math.atan2(ax[0] * -uz + ax[1] * ux, ax[0] * ux + ax[1] * uz) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const alongG = pts.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), across = pts.map(([x, z]) => -(x - cx) * uz + (z - cz) * ux);
  const depth = Math.max(...alongG) - Math.min(...alongG), width = Math.max(...across) - Math.min(...across);
  m.greenShape = { depth: Math.round(depth), width: Math.round(width), angle: Math.round(ang) };
  R_(`  ${h.n} green ${m.greenArea} m2, ${Math.round(depth)} deep x ${Math.round(width)} wide (${(depth / width).toFixed(2)}), long axis ${Math.abs(Math.round(ang))}° ${ang > 8 ? 'right' : ang < -8 ? 'left' : 'straight'} of the approach`);
  if (h.par === 3) p3.push({ n: h.n, yd: h.yards[BACK], plays: playsLike(Math.hypot(back[0] - h.pin[0], back[1] - h.pin[1]), m.pinY - m.teeY) });
  const gs = greenStats(B, { r: 4 }), feat = gs.relief >= 0.25 ? 'a feature' : 'flatter';
  m.contour = { median: +gs.median.toFixed(1), relief: +gs.relief.toFixed(2), areas: gs.areas.length, cup: Math.round(gs.cup * 100), feat };
  CONT.push({ n: h.n, feat });
  {   // the green diagram's grid: 0.5 m in the approach's frame (up the page = away from the approach)
    const fx = ux, fz = uz, rx = -uz, rz = ux, N = 97, half = (N - 1) / 2, y0 = B.ground(...h.pin), hg = [], gmv = [], sf = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const a = (c - half) / 2, b = (half - r) / 2, x = h.pin[0] + a * rx + b * fx, z = h.pin[1] + a * rz + b * fz;
      hg.push(+(B.ground(x, z) - y0).toFixed(3)); gmv.push(+B.gm(x, z).toFixed(2)); sf.push(SURF.indexOf(B.surface(x, z)));
    }
    const pa = gs.areas.map(q => { const dx = q.x - h.pin[0], dz = q.z - h.pin[1]; return [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; });
    fs.writeFileSync(`${OUT}/green${h.n}.json`, JSON.stringify({ N, step: 0.5, h: hg, gm: gmv, s: sf, areas: pa, pin: [0, 0] }));
  }
  const badG = gs.pinSlope > 3 || gs.areas.length < 2 || gs.median < 1 || gs.median > 3;
  R_(`${badG ? '!' : ' '} ${h.n} green contour: typical slope ${gs.median.toFixed(1)}%, ${gs.relief.toFixed(2)} m beyond its plane (${feat}), pin ${gs.pinSlope.toFixed(1)}%, ${gs.areas.length} pin areas, ${Math.round(gs.cup * 100)}% cuppable`);
  if (h.par > 3) {
    const ws = [];
    for (const q of (h.targets || []).filter(q => !q.bold)) {
      const pq = project(h.line, ...q.at), v = leanAlong(B, pq.s - 30, pq.s + 30, 12, pq.off).map(x => x[1]);
      if (v.length) ws.push({ name: q.name, lean: v.reduce((a, b) => a + b, 0) / v.length });
    }
    const top = ws.reduce((a, b) => Math.abs(b.lean) > Math.abs(a?.lean ?? 0) ? b : a, null);
    m.lean = ws.map(w_ => ({ name: w_.name, lean: +w_.lean.toFixed(1) }));
    LEANS.push({ n: h.n, lean: top ? top.lean : 0 });
    R_(`  ${h.n} fairway lean: ${ws.map(w_ => `${w_.name} ${Math.abs(w_.lean).toFixed(1)}% ${w_.lean > 0.3 ? 'to the right' : w_.lean < -0.3 ? 'to the left' : 'level'}`).join('; ') || 'no targets'}`);
  }
  lap(`hole ${h.n} checked`);
}
const featN = CONT.filter(c => c.feat === 'a feature').length;
R_(`${featN >= 5 ? ' ' : '!'} greens with a feature (0.25 m+ beyond the plane): ${featN} of ${CONT.length}; flatter: ${CONT.filter(c => c.feat !== 'a feature').map(c => c.n).join(', ') || 'none'}`);
for (const q of p3) R_(`  par 3 ${q.n}: ${q.yd} yd, plays like about ${q.plays} yd`);

// ---- the fixed camera among giant trunks (3.2 m behind the ball, 1.55 m up; the frame shows 19° above level to
// 31° below and, on a phone held sideways (844 x 390), about 90° across): each tee set's target in sight, and how
// much of the frame's width the trunks fill
const EYE = 1.55, BACKC = 3.2, PX = 40 * 250 / 22, HALF = 45;
function sight(B, from, to, toY, fromY = null) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]), ux = (to[0] - from[0]) / d, uz = (to[1] - from[1]) / d;
  const eye = [from[0] - ux * BACKC, from[1] - uz * BACKC], ey = (fromY ?? B.ground(...from)) + EYE, D = d + BACKC, ang = Math.atan2(toY - ey, D) * 180 / Math.PI;
  let hid = null;
  for (let t = 4; t < D - 3 && !hid; t += 1.5) { const x = eye[0] + ux * t, z = eye[1] + uz * t, y = ey + (toY - ey) * t / D, g = B.ground(x, z);
    if (g !== null && g > y + 0.05 && !(fromY !== null && t < 9)) hid = `the ground ${Math.round(t)} m out`; else for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hid = what; break; } }
  return { ang, inFrame: ang <= 19 && ang >= -31, hid, d, ey };
}
// the trunks across the view: the share of the frame's width (90°) they fill, and the widest one
function trunkCover(B, from, toward) {
  const dir = Math.atan2(toward[0] - from[0], -(toward[1] - from[1])), eye = [from[0] - Math.sin(dir) * BACKC, from[1] + Math.cos(dir) * BACKC], iv = [];
  let widest = null;
  for (const t of B.trees) {
    const dx = t.x - eye[0], dz = t.z - eye[1], d = Math.hypot(dx, dz); if (d < t.r + 0.5 || d > 250) continue;
    let b = Math.atan2(dx, -dz) - dir; b = Math.atan2(Math.sin(b), Math.cos(b)); const half = Math.asin(Math.min(1, t.r / d));
    const a0 = (b - half) * 180 / Math.PI, a1 = (b + half) * 180 / Math.PI; if (a1 < -HALF || a0 > HALF) continue;
    iv.push([Math.max(-HALF, a0), Math.min(HALF, a1)]);
    if (!widest || a1 - a0 > widest.deg) widest = { deg: a1 - a0, d: Math.round(d), side: b < 0 ? 'left' : 'right', at: Math.round(b * 180 / Math.PI) };
  }
  iv.sort((p, q) => p[0] - q[0]); let cov = 0, cur = null;
  for (const [a, b] of iv) { if (!cur || a > cur[1]) { if (cur) cov += cur[1] - cur[0]; cur = [a, b]; } else cur[1] = Math.max(cur[1], b); }
  if (cur) cov += cur[1] - cur[0];
  // the middle third of the frame, where the shot goes
  let mid = 0; for (const [a, b] of iv) { const lo = Math.max(a, -15), hi = Math.min(b, 15); if (hi > lo) mid = Math.max(mid, hi - lo); }
  return { pct: Math.round(cov / (2 * HALF) * 100), widest, mid: +mid.toFixed(1) };
}
function shows(B, from, o, fromY = null) {
  const top = o.base + o.h, dd = Math.hypot(o.x - from[0], o.z - from[1]), back = (o.r || 0) + 1.5;
  const face = [o.x - (o.x - from[0]) / dd * back, o.z - (o.z - from[1]) / dd * back]; let vis = top;
  for (let y = top; y >= o.base; y -= 0.5) { if (sight(B, from, face, y, fromY).hid) break; vis = y; }
  const d = Math.hypot(o.x - from[0], o.z - from[1]) + BACKC;
  return { px: Math.round(PX * (top - vis) / d), d: Math.round(d), seen: top - vis };
}
let blind = 0;
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], out = [], cov = [];
  for (const T of COURSE.teeSets) {
    const tee = h.teePts[T.id], tY = (h.teeY || {})[T.id] ? B.ground(...tee) : null; let to, toY, what;
    if (h.par === 3) { to = h.pin; toY = B.ground(...h.pin) + 2.1; what = 'the flag'; }
    else { const q = (h.targets || []).find(q => !q.bold); to = q.at; toY = B.ground(...to) + 0.3; what = q.name; }
    const S = sight(B, tee, to, toY, tY), ok = S.inFrame && !S.hid;
    out.push(`${T.name} ${ok ? 'sees' : 'CANNOT SEE'} ${what} (${S.ang.toFixed(1)}°${S.hid ? ', behind ' + S.hid : ''})`);
    if (!ok) { R_(`! ${h.n} ${T.name} tee: ${what} is ${S.hid ? 'hidden by ' + S.hid : 'out of the frame'} (${S.ang.toFixed(1)}°)`); if (T.id === BACK) blind++; }
    const C = trunkCover(B, tee, to); cov.push(`${T.name} ${C.pct}%${C.widest ? ` (widest ${C.widest.deg.toFixed(0)}° at ${C.widest.d} m ${C.widest.side})` : ''}`);
    if (C.mid > 12) R_(`! ${h.n} ${T.name} tee: a trunk fills ${C.mid}° of the middle of the frame`);
  }
  R_(`  ${h.n} tee view: ${out.join('; ')}`);
  R_(`  ${h.n} trunks within 250 m across the tee view (share of the 90° frame): ${cov.join(', ')}`);
  for (const bt of (h.targets || []).filter(q => q.bold)) { const mk = h.n === 3 ? B.trees.find(t => t.marker) : null, S = mk ? sight(B, h.teePts[BACK], [mk.x - 1.2, mk.z], mk.y + mk.h - 0.5) : sight(B, h.teePts[BACK], bt.at, B.ground(...bt.at) + 0.3); R_(`${S.inFrame && !S.hid ? ' ' : h.n === 9 ? ' ' : '!'} ${h.n} bold target "${bt.name}"${mk ? ' (its marker, the young fir on the trunk\'s back)' : ''} from the ${COURSE.teeSets[0].name} tee: ${S.hid ? 'hidden by ' + S.hid : 'in sight'} (${S.ang.toFixed(1)}°)`); }
  // the landing views: from each target toward the next (or the pin)
  if (h.par > 3) for (const q of h.targets) { const C = trunkCover(B, q.at, h.pin); R_(`  ${h.n} from "${q.name}" the trunks fill ${C.pct}% of the frame${C.widest ? `, widest ${C.widest.deg.toFixed(0)}° at ${C.widest.d} m` : ''}${C.mid > 12 ? ' (!! across the middle)' : ''}`); }
}
// blind approaches: on purpose only the 3rd's low road and the 9th's right lane
let blindA = 0; const ONPURPOSE = { 3: 'The low road', 9: 'The right lane' };
for (const [i, B] of BUILT.entries()) { const h = HOLES[i]; if (h.par === 3) continue;
  for (const q of h.targets || []) { const S = sight(B, q.at, h.pin, B.ground(...h.pin) + 0.4), S2 = sight(B, q.at, h.pin, B.ground(...h.pin) + 2.1), d = Math.hypot(q.at[0] - h.pin[0], q.at[1] - h.pin[1]);
    if (d > 260) continue;
    const mine = ONPURPOSE[h.n] === q.name;
    if (mine) { if (S.hid) { blindA++; R_(`  ${h.n} from "${q.name}" the green's surface is hidden by ${S.hid} (the flag ${S2.hid ? 'too' : 'shows'}): blind on purpose`); } else R_(`! ${h.n} from "${q.name}" the green is in sight: meant to be blind`); }
    else if (S2.hid) { blindA++; R_(`! ${h.n} from "${q.name}" the flag is hidden by ${S2.hid}`); }
    else if (S.hid) R_(`  ${h.n} from "${q.name}" the green's surface sits below the eye line (${S.hid}); the flag shows`); } }
R_(`${blind + blindA <= 3 ? ' ' : '!'} blind shots: ${blind} from the back tees, ${blindA} approaches, and the 9th's left lane behind the root from the tee: three, one over the two a nine (Rhys's pick, 14 November: keep both of the 9th's blind, with the 3rd's low road)`);
lap('views');

// ---- the brief's look-at-first list
const wd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the canopy: the tallest shot the game makes against the crowns 60 m up
{
  const ap = s => simulate({ HLA: 0, SpinAxis: 0, ...s }, { groundAt: () => 0, altFt: COURSE.altFt }).pts.reduce((m, p) => Math.max(m, p.p[1]), 0);
  R_(`  the canopy (crowns from about 60 m up): apex of a tour driver ${ap(DRIVES.tour).toFixed(0)} m, a high driver ${ap(DRIVES.high).toFixed(0)} m, a 7 iron ${ap({ Speed: 120, VLA: 16.3, TotalSpin: 7097 }).toFixed(0)} m, a skied driver (160 mph, 25°) ${ap({ Speed: 160, VLA: 25, TotalSpin: 4500 }).toFixed(0)} m: only the skied one reaches a crown`);
}
// a trunk must not trap a ball: from the foot of every placed trunk near play, a clear chip (60 m or less, past no
// other trunk, wall or the fallen giant) back to fairway or green
{
  const out = [];
  for (const [i, B] of BUILT.entries()) {
    const h = HOLES[i]; let n = 0, dead = 0; const deadAt = [];
    const blocked = (a, b) => { const L = wd(a, b), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (const t of B.trees) { const px = t.x - a[0], pz = t.z - a[1], s = px * ux + pz * uz; if (s < 0 || s > L) continue; if (Math.abs(px * uz - pz * ux) < t.r + 0.3 && Math.hypot(px, pz) > t.r + 0.4) return true; }
      for (let s = 2; s < L; s += 2) { const x = a[0] + ux * s, z = a[1] + uz * s; for (const o of B.walls) { const dx = x - o.x, dz = z - o.z, aa = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), cc = dx * Math.cos(o.rot) + dz * Math.sin(o.rot); if (Math.abs(aa) < o.l / 2 && Math.abs(cc) < o.w / 2) return true; } if (h.n === 3 && fallenAt(...WOR[i](x, z)).lift > 2.5 && B.ground(x, z) > B.ground(...a) + 2.5) return true; }
      return false; };
    for (const t of B.trees.filter(t => t.placed && t.hole === i && !t.heart)) {
      if (Math.abs(project(h.line, t.x, t.z).off) > 80 || Math.min(Math.max(0, B.fairwayD(t.x, t.z)), Math.max(0, B.gm(t.x, t.z))) > 70) continue;
      for (let a = 0; a < 6.283; a += Math.PI / 6) {
        const p = [t.x + Math.cos(a) * (t.r + 2.5), t.z + Math.sin(a) * (t.r + 2.5)]; n++;
        let ok = false; const d0 = Math.min(Math.max(0, B.fairwayD(...p)), Math.max(0, B.gm(...p)));
        for (let b = 0; b < 6.283 && !ok; b += Math.PI / 18) { const q = [p[0] + Math.cos(b) * 50, p[1] + Math.sin(b) * 50], d1 = Math.min(Math.max(0, B.fairwayD(...q)), Math.max(0, B.gm(...q))); if ((d1 < d0 - 10 || d1 < 8) && !blocked(p, q)) ok = true; }
        if (!ok) { dead++; deadAt.push(`${Math.round(project(h.line, ...p).s)} m`); }
      }
    }
    out.push(`${h.n} ${dead ? `${dead} of ${n} dead (${[...new Set(deadAt)].slice(0, 4).join(', ')})` : `0 of ${n}`}`);
  }
  R_(`${out.some(o => !/ 0 of/.test(o)) ? '!' : ' '} a trunk never traps a ball: points round each placed trunk's foot (12 a trunk, 2.5 m from the bark) with no clear 50 m shot that ends 10 m or more nearer the fairway or the green (or within 8 m of it): ${out.join(' · ')}`);
}
// the trunks soak: a drive into a gate tree on the 1st, 20 times
{
  const B = BUILT[0], h = HOLES[0], g = B.trees.find(t => t.placed && /gate/.test(t.job) && t.x < 0), tee = h.teePts[BACK];
  const dir = Math.atan2(g.x - tee[0], -(g.z - tee[1])); let foot = 0, back = 0, n = 0;
  for (let k = 0; k < 20; k++) { seed = 101 + k * 7; const r = drive(B, tee, dir, DRIVES.mid); if (!r.trees) continue; n++; const d = Math.hypot(r.end[0] - g.x, r.end[1] - g.z) - g.r; if (d < 6) foot++; else back++; }
  R_(`  1 a drive into the left gate tree, 20 times: ${n} hit it; ${foot} dropped at its foot, ${back} came back (soak ${SOAK})`);
}
// the Avenue: the colonnade's width, the fern, and the forward tees' landing
{
  const B = BUILT[1], h = HOLES[1], row = s => { const p = at(h.line, s), ln = lanes(B, p, headingAt(h.line, s)), fw = Math.max(0, ...ln);
    const faces = [-1, 1].map(sg => { let best = Infinity; for (const t of B.trees.filter(t => t.placed && t.hole === 1)) { const pr = project(h.line, t.x, t.z); if (Math.sign(pr.off) !== sg || Math.abs(pr.s - s) > 18) continue; best = Math.min(best, Math.abs(pr.off) - t.r); } return best; });
    return { fw, faces }; };
  const a = row(238), b = row(290), c = row(420);
  R_(`  2 the Avenue: at the crest (238 m) ${Math.round(a.fw)} m of fairway, the trunks' faces ${a.faces.map(Math.round).join(' and ')} m off the line (fern ${Math.round(Math.min(...a.faces) - a.fw / 2)} m); where the forward tees land (290 m) ${Math.round(b.fw)} m, faces ${b.faces.map(Math.round).join(' and ')}; the lay-up (420 m) ${Math.round(c.fw)} m`);
  const gaps = []; const L = B.trees.filter(t => t.placed && t.hole === 1).map(t => ({ t, pr: project(h.line, t.x, t.z) })).filter(q => q.pr.off < 0 && q.pr.s < 500).sort((p, q) => p.pr.s - q.pr.s);
  for (let k = 1; k < L.length; k++) gaps.push(L[k].pr.s - L[k - 1].pr.s - L[k].t.r - L[k - 1].t.r);
  R_(`  2 the colonnade's gaps (left row): ${Math.round(Math.min(...gaps))}-${Math.round(Math.max(...gaps))} m between trunks`);
}
// the fallen giant: the high road's width on its back, the ramp, its left side
{
  const B = BUILT[2], h = HOLES[2], L3 = LOC[2];
  const A = L3(...FALLEN.a), Bp = L3(...FALLEN.b), len = wd(A, Bp), u = [(Bp[0] - A[0]) / len, (Bp[1] - A[1]) / len], nrm = [-u[1], u[0]];
  const widths = [], grades = [];
  for (const s of [70, 100, 130, 160]) { const c = [A[0] + u[0] * s, A[1] + u[1] * s]; let a = 0, b = 0; while (a > -40 && B.surface(c[0] + nrm[0] * (a - 0.5), c[1] + nrm[1] * (a - 0.5)) === 'fairway') a -= 0.5; while (b < 40 && B.surface(c[0] + nrm[0] * (b + 0.5), c[1] + nrm[1] * (b + 0.5)) === 'fairway') b += 0.5; widths.push(Math.round(b - a)); }
  for (let s = 0; s < 55; s += 2) { const p = [A[0] + u[0] * s, A[1] + u[1] * s], q = [A[0] + u[0] * (s + 2), A[1] + u[1] * (s + 2)]; grades.push((B.ground(...q) - B.ground(...p)) / 2 * 100); }
  const topY = B.ground(A[0] + u[0] * 110, A[1] + u[1] * 110), floorY = B.ground(A[0] + u[0] * 110 + nrm[0] * 30, A[1] + u[1] * 110 + nrm[1] * 30);
  R_(`  3 the high road: mown ${widths.join(', ')} m wide along the trunk's back; its back ${(topY - floorY).toFixed(1)} m over the floor; the ramp of broken crown climbs at most ${Math.max(...grades).toFixed(0)}% (a ball rolling up it at 15 m/s: see below)`);
  // a ball rolled up the ramp
  { const c0 = [A[0] - u[0] * 25, A[1] - u[1] * 25], dir = Math.atan2(u[0], -u[1]); seed = 9; const parts = []; for (const mph of [40, 55]) { const r = drive(B, c0, dir, { Speed: mph, VLA: 0.5, TotalSpin: 300 }); const pr = (r.end[0] - A[0]) * u[0] + (r.end[1] - A[1]) * u[1]; parts.push(`${mph} mph stops ${Math.round(pr)} m along it (${pr > 55 ? 'up on its back' : 'on the ramp'})`); } R_(`  3 a ball rolled up the ramp: ${parts.join(', ')}; none thrown back`); }
  // the left side: from the fern under the trunk, a shot out along the floor to the green or the low road's end
  let worst = 0; const res = [];
  for (const s of [80, 120, 160]) { const p = [A[0] + u[0] * s - nrm[0] * 24, A[1] + u[1] * s - nrm[1] * 24], g = B.ground(...p), sf = B.surface(...p);
    const toPin = Math.atan2(h.pin[0] - p[0], -(h.pin[1] - p[1])); seed = 3; const r = drive(B, p, toPin, { Speed: 105, VLA: 18, TotalSpin: 6000 });
    res.push(`${s} m: ${sf}, ${Math.round(wd(p, h.pin) / YD)} yd out, a punch toward the green finishes on ${r.rest}${r.trees ? ' (off a trunk)' : ''}`); }
  R_(`  3 off the trunk's left side (24 m left of its axis): ${res.join('; ')}`);
  const plate = B.walls.find(o => o.kind === 'plate'), hr = h.targets.find(t => t.bold), S = sight(B, hr.at, h.pin, B.ground(...h.pin) + 0.4);
  R_(`${S.hid ? '!' : ' '} 3 from the high road the green is ${S.hid ? 'hidden by ' + S.hid : 'in sight'}; the root plate ${Math.round(wd([plate.x, plate.z], h.pin))} m from the pin`);
  const dH = wd(hr.at, h.pin); let lo = 60, hi = 130; for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, c = simulate({ Speed: m, VLA: 34 - m * 0.13, TotalSpin: 11000 - m * 25, HLA: 0, SpinAxis: 0 }, { altFt: COURSE.altFt, flightOnly: true }).carry * YD; if (c > dH - 4) hi = m; else lo = m; }
  seed = 5; const wg = drive(B, hr.at, Math.atan2(h.pin[0] - hr.at[0], -(h.pin[1] - hr.at[1])), { Speed: hi, VLA: 34 - hi * 0.13, TotalSpin: 11000 - hi * 25 }, 2, B.ground(...hr.at));
  R_(`  3 an iron from the high road (${Math.round(wd(hr.at, h.pin) / YD)} yd, ${Math.round(hi)} mph): apex ${wg.apex.toFixed(0)} m, finishes on ${wg.rest}${wg.rocks ? ' (hit the root plate)' : ''}`);
  const tee = h.teePts[BACK], lipP = [A[0] + u[0] * 70 + nrm[0] * 13.5, A[1] + u[1] * 70 + nrm[1] * 13.5], hs = sight(B, tee, lipP, B.ground(...lipP) + 0.3);
  R_(`${hs.hid || !hs.inFrame ? '!' : ' '} 3 from the Redwood tee the trunk's right edge (the high road's lip, 70 m along it) is ${hs.hid ? 'hidden by ' + hs.hid : 'in sight'} (${hs.ang.toFixed(1)}°): the top surface is out of sight from the tee, the young fir on it marks the line (not blind, as a table top with a marker)`);
}
// the Stair: the platform, its overhead, the lower tees
{
  const B = BUILT[5], h = HOLES[5], st = B.trees.find(t => t.placed && /stair/.test(t.job));
  const parts = COURSE.teeSets.map(T => { const p = h.teePts[T.id], g = B.ground(...p), o = overhead(B, p, g), floor = B.ground(p[0] + 9, p[1] + 9); return `${T.name} ${((h.teeY || {})[T.id] || 0)} m up (${o.crown === null ? 'open above' : 'the lowest crown ' + Math.round(o.crown) + ' m over it'})`; });
  R_(`  6 the tees: ${parts.join('; ')}; the stair tree ${st ? Math.round(wd([st.x, st.z], h.teePts.redwood)) + ' m from the platform, its first branches ' + Math.round(st.h * st.low) + ' m up' : 'missing'}`);
  for (const T of COURSE.teeSets) { const p = h.teePts[T.id]; let wet_ = 0, last = null; const d = wd(p, h.pin);
    for (let t = 0; t < d; t += 1) { const q = [p[0] + (h.pin[0] - p[0]) * t / d, p[1] + (h.pin[1] - p[1]) * t / d]; if (B.surface(...q) === 'water') { wet_++; last = t; } }
    R_(`${T.id === FRONT && wet_ && (last + 1) / YD > 90 ? '!' : ' '} 6 ${T.name} tee (${h.yards[T.id]} yd): ${wet_ ? `carries ${Math.round((last + 1) / YD)} yd to clear the brook` : 'no water on its line'}`); }
}
// the Hall: the centre root, the green's distance from the heart tree, nothing over the green under 45 m
{
  const B = BUILT[8], h = HOLES[8], g = s => B.ground(...at(h.line, s));
  const rootH = [190, 230, 270].map(s => (B.ground(...at(h.line, s)) - Math.min(B.ground(...at(h.line, s, 10)), B.ground(...at(h.line, s, -10)))).toFixed(1));
  const pinW = WOR[8](...h.pin), dH = Math.hypot(pinW[0] - HEART.c[0], pinW[1] - HEART.c[1]);
  let low = Infinity; for (let x = h.pin[0] - 20; x <= h.pin[0] + 20; x += 2) for (let z = h.pin[1] - 20; z <= h.pin[1] + 20; z += 2) { if (B.gm(x, z) > 0) continue; const c = B.crownOver(x, z); if (c !== null) low = Math.min(low, c - B.ground(x, z)); for (const [a] of B.solids(x, z)) low = Math.min(low, a - B.ground(x, z)); }
  R_(`  9 the centre root stands ${rootH.join(', ')} m over the lanes beside it (at 190, 230, 270 m); the green's pin ${Math.round(dH)} m from the heart tree's centre (${Math.round(dH - HEART.r)} m from its bark); over the green: ${low === Infinity ? 'open (nothing under 45 m)' : 'the lowest thing ' + Math.round(low) + ' m up'}`);
  const ht = B.trees.find(t => t.heart), sh = shows(B, h.teePts[BACK], { x: ht.x, z: ht.z, base: ht.y, h: 160, r: ht.r });
  R_(`  9 the heart tree from the Redwood tee: ${sh.d} m away, ${sh.px} px of trunk in the frame`);
  seed = 7; const into = drive(B, at(h.line, 160, 0), headingAt(h.line, 200), { Speed: 120, VLA: 12, TotalSpin: 5000 }, 8);
  R_(`  9 a 7 iron flown down the line into the root from 160 m: finishes on ${into.rest} ${Math.round(Math.abs(project(h.line, ...into.end).off))} m off the line`);
}
// the heart tree from the holes: in the frame from each tee and from the 4th's landing (the reveal, in the pool)
{
  // how much of the heart tree's trunk (its 60 m width) shows past the trunks in between, from a point in world space
  const seen = (P0) => { const dx = HEART.c[0] - P0[0], dz = HEART.c[1] - P0[1], D = Math.hypot(dx, dz), half = Math.asin(HEART.r / D), b0 = Math.atan2(dx, -dz); let clear = 0, n = 0;
    for (let a = -half; a <= half + 1e-9; a += half / 12) { n++; const b = b0 + a, ux = Math.sin(b), uz = -Math.cos(b); let hit = false;
      for (const t of ALLTREES) { if (t.heart) continue; const px = t.X - P0[0], pz = t.Z - P0[1], s_ = px * ux + pz * uz; if (s_ < 0 || s_ > D - HEART.r) continue; if (Math.abs(px * uz - pz * ux) < t.r) { hit = true; break; } }
      if (!hit) clear++; }
    return { pct: Math.round(clear / n * 100), D: Math.round(D), deg: (2 * half * 180 / Math.PI) }; };
  const parts = [];
  for (const V_ of VISTAS) { const S = seen(V_.p); parts.push(`${V_.name}: ${S.pct}% of its trunk clear, ${S.D} m away (${S.deg.toFixed(0)}° wide)`); }
  R_(`  the heart tree (the landmark), through the forest: ${parts.join('; ')}`);
  const inF = [];
  for (const [i, h] of HOLES.entries()) {
    const pts = [['tee', h.teePts[BACK], h.par === 3 ? h.pin : (h.targets.find(q => !q.bold) || { at: h.pin }).at], ...(h.targets || []).map(q => [q.name, q.at, h.pin])];
    for (const [name, p, aimL] of pts) { const P0 = WOR[i](...p), aim = WOR[i](...aimL);
      let b = Math.atan2(HEART.c[0] - P0[0], -(HEART.c[1] - P0[1])) - Math.atan2(aim[0] - P0[0], -(aim[1] - P0[1])); b = Math.atan2(Math.sin(b), Math.cos(b)); const deg = Math.round(b * 180 / Math.PI);
      inF.push(`${h.n} ${name}: ${Math.abs(deg) <= HALF ? 'IN the frame' : 'out'} (${Math.abs(deg)}° ${deg < 0 ? 'left' : 'right'})`); }
  }
  R_(`  the heart tree against the fixed camera's 90° frame (looking along the shot): ${inF.join('; ')}`);
  const B = BUILT[3], h = HOLES[3], land = h.targets[0].at, Lh = LOC[3](...HEART.c), ht = { x: Lh[0], z: Lh[1] }, pc = LOC[3](...POOL.c);
  let b = Math.atan2(ht.x - land[0], -(ht.z - land[1])) - Math.atan2(h.pin[0] - land[0], -(h.pin[1] - land[1])); b = Math.atan2(Math.sin(b), Math.cos(b));
  const between = (() => { const d = wd(land, [ht.x, ht.z]); for (let t = 20; t < d; t += 4) { const q = [land[0] + (ht.x - land[0]) * t / d, land[1] + (ht.z - land[1]) * t / d]; if (B.surface(...q) === 'water') return Math.round(t); } return null; })();
  R_(`  4 the reveal: from "Round the shore" the heart tree is ${Math.round(Math.abs(b) * 180 / Math.PI)}° ${b < 0 ? 'left' : 'right'} of the line to the pin, ${Math.round(wd(land, [ht.x, ht.z]))} m away; the pool ${between ? 'lies between, from ' + between + ' m out (its reflection shows in the water)' : 'is not between'}`);
}
// sand, and where the penalty ground is
{
  const pens = BUILT.map((B, i) => { const h = HOLES[i]; let wet_ = 0; for (let s = 0; s < h.len; s += 4) for (const o of [-40, -25, 25, 40]) if (B.surface(...at(h.line, s, o)) === 'water') { wet_++; break; } return `${h.n} ${wet_ ? 'water within 40 m of the line on ' + wet_ * 4 + ' m of it' : 'none'}`; });
  R_(`  penalty ground near the lines: ${pens.join(', ')}`);
  R_(`  sand hollows: ${BUILT.map((B, i) => `${HOLES[i].n} ${B.bunkers.length}`).join(', ')}`);
}
R_(`  walks green to tee (m): ${HOLES.slice(0, -1).map((h, i) => `${h.n}-${h.n + 1} ${Math.round(wd(WOR[i](...h.pin), WOR[i + 1](...HOLES[i + 1].teePts[BACK])))}`).join(', ')}`);
R_(`  trees: ${TRUNKS.length} placed near the lines (the heart tree among them), ${FAR.length} in the far forest`);
fs.writeFileSync(`${OUT}/checks.txt`, report.join('\n'));
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets, back: BACK, p3 }));
lap('done');
