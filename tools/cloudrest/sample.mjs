// node tools/cloudrest/sample.mjs : grids, profiles, cross sections and drive arcs for the plan book (out/grid/),
// the course map raster, and the rules checks (out/grid/checks.txt; a line starting ! breaks a rule). Then: python3
// plans.py, node sketch.mjs, node book.mjs. Every drive is flown with the game's physics as Cloudrest will play
// (Rhys's picks, 15 November 2026): 8,500 ft, damp turf on the fairways, cliff faces that soak 45% of the balls that
// hit them, open air (the mist) below 150 m.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK, FRONT } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, LOC, WOR, PINES, BOXES } from './scene.mjs';
import { LABELS, MIST, NEEDLE, NOTCH, ROOF, SITES, WALLS, LINES, w, WLINES, kerbAt, PINNACLES, lineD } from './world.mjs';
import { project, at, lengthOf, YD, headingAt, distLine } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), lap = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const HYBRID = { Speed: 132, VLA: 13, TotalSpin: 4600 }, WOOD3 = { Speed: 150, VLA: 10.5, TotalSpin: 3700 };
// the game's surfaces on this course (Rhys's picks, 15 November 2026: damp turf)
const PHYS = { fairway: 'damp', fringe: 'damp', tee: 'damp', green: 'green', rough: 'rough', scrub: 'rough', tea: 'rough', rock: 'desert', kerb: 'desert', paving: 'desert', sand: 'sand', water: 'water', void: 'rough' };
const ALT = COURSE.altFt, SOAK = COURSE.wallSoak;
let seed = 11; const rng = () => (seed = seed * 16807 % 2147483647) / 2147483647;

// a shot from p along direction dir (radians from -z in the hole's frame, + right), off the walls and the built
// things, into the mist: where it lands and rests, and what it hits
function drive(B, p, dir, shot, y0in = null, extra = {}) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = y0in ?? (B.ground(p[0], p[1]) ?? 0);
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const toShot = (nx, nz) => [c * nx + s * nz, -s * nx + c * nz];
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return PHYS[v] || v; },
    solidAt: (lx, ly, lz) => { const [x, z] = W(lx, lz), y = ly + y0;
      const rf = B.roof(x, z); if (rf !== null && y > rf) return [0, -1, 0];
      for (const o of B.walls) { if (Math.abs(x - o.x) > 40 || Math.abs(z - o.z) > 40 || y < o.y || y > o.y + o.h) continue; const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.rot) - dz * Math.cos(o.rot), b = dx * Math.cos(o.rot) + dz * Math.sin(o.rot);
        if (Math.abs(a) < o.l / 2 && Math.abs(b) < o.w / 2) { const nh = (o.l / 2 - Math.abs(a)) < (o.w / 2 - Math.abs(b)) ? [Math.sign(a) * Math.sin(o.rot), -Math.sign(a) * Math.cos(o.rot)] : [Math.sign(b) * Math.cos(o.rot), Math.sign(b) * Math.sin(o.rot)]; const [u, v] = toShot(nh[0], nh[1]); return [u, 0, v]; } }
      return null; },
    rng, voidY: MIST - B.base - 2, altFt: ALT, wallSoak: SOAK, ...extra,
  });
  const pts = [];
  for (const q of r.pts) { const [x, z] = W(q.p[0], q.p[2]); pts.push([+Math.hypot(x - p[0], z - p[1]).toFixed(1), +(y0 + q.p[1]).toFixed(2), q.phase === 'flight' ? 0 : 1]); }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]), [lx, lz] = W(land.p[0], land.p[2]);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), rocks: r.rockHits,
    rest: r.outcome === 'void' ? 'mist' : B.surface(ex, ez), end: [ex, ez], land: [lx, lz], outcome: r.outcome };
}

const meta = [];
const SECTIONS = { 1: [150, 260, 340], 5: [180, 258, 360], 6: [200, 270, 400], 8: [250, 380], 9: [60, 120, 230] };
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 190;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H), Wk = WOR[i];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = worldAt(...Wk(x0 + c + 0.5, z0 + r + 0.5));
    hgt[r * W + c] = v.y === null ? NaN : v.y - B.base; srf[r * W + c] = SURF.indexOf(v.s);
  }
  fs.writeFileSync(`${OUT}/h${h.n}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), B.solids(x, z).map(v => [v[0], v[1], v[2]]), B.roof(x, z)]); } return P; };
  const back = h.teePts[BACK], tee0 = B.ground(...back);
  const dir0 = headingAt(h.line, 1);
  seed = 11 + i;
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldPath) { const b = h.boldPath, d = Math.atan2(b[0] - back[0], -(b[1] - back[1])), Lb = [back, b]; bold = { line: Lb, prof: along(Lb), drives: Object.fromEntries(Object.entries(DRIVES).map(([k, s]) => [k, drive(B, back, d, s)])) }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 70; x < h.pin[0] + 70; x++) for (let z = h.pin[1] - 70; z < h.pin[1] + 70; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  // cross sections square to the line (the brief: wall, shelf, kerb, drop), looking down the hole (left on the left)
  const sections = (SECTIONS[h.n] || []).map((s, j) => { const pts = []; for (let o = -110; o <= 110; o += 1) { const p = at(h.line, s, o); pts.push([o, B.ground(...p), B.surface(...p)]); } return { s, tag: 'ABCD'[j], ends: [at(h.line, s, -110), at(h.line, s, 110)], yd: Math.round((h.len - s) / YD), pts }; });
  const labels = [];
  for (const [wp, t] of LABELS) { const p = LOC[i](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 190 && pr.s > -60 && pr.s < h.len + 140) labels.push([p, t]); }
  for (const o of SITES) { if (!o.name || o.kind === 'wall') continue; const p = LOC[i](...o.at), pr = project(h.line, ...p); if (Math.abs(pr.off) < 150 && pr.s > -40 && pr.s < h.len + 80) labels.push([p, o.name]); }
  meta.push({ tips: h.tipsPt, tipsYards: h.tipsYards, tipsSet: COURSE.tipsSet, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), greenArea: gcells, mist: MIST - B.base,
    targets: (h.targets || []).map(t => {
      const pr = project(h.line, ...t.at); let wd = 0;
      if (B.surface(...t.at) === 'fairway') { const d = headingAt(h.line, pr.s) + Math.PI / 2, nx = Math.sin(d), nz = -Math.cos(d); let a = 0, b = 0; while (a > -120 && B.surface(t.at[0] + nx * (a - 0.5), t.at[1] + nz * (a - 0.5)) === 'fairway') a -= 0.5; while (b < 120 && B.surface(t.at[0] + nx * (b + 0.5), t.at[1] + nz * (b + 0.5)) === 'fairway') b += 0.5; wd = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(wd), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    walls: B.walls.map(o => ({ kind: o.kind, x: o.x, z: o.z, w: o.w, l: o.l, h: o.h, rot: o.rot })),
    pines: B.pines.filter(t => Math.abs(t.x) < 700 && Math.abs(t.z) < 900).map(t => ({ x: +t.x.toFixed(1), z: +t.z.toFixed(1), r: t.r })),
    sand: B.bunkers.map(b => ({ x: b.x, z: b.z, r: b.rx })), drops: (h.drops || []).map(d => ({ name: d.name, p: d.at })),
    prof, sections, drives, bold, words: h.words, card: h.card, shape: h.shape, green: h.green, base: h.base, place: h.place, labels });
  lap(`hole ${h.n} sampled`);
}

// the course map: the world's surface and a hillshade from its heights
const WR = 4, X0 = -720, X1 = 900, Z0 = -1000, Z1 = 780;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y === null ? NaN : v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, labels: LABELS, mist: MIST,
  pines: PINES.filter(t => t.X > X0 && t.X < X1 && t.Z > Z0 && t.Z < Z1).map(t => ({ X: +t.X.toFixed(1), Z: +t.Z.toFixed(1), r: t.r })),
  boxes: SITES.map(o => ({ kind: o.kind, X: o.at[0], Z: o.at[1], w: o.w, l: o.l, rot: o.rot, roof: o.roof || null })),
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, par: h.par, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })), back: BACK }));
lap('course map');

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(18)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.rocks ? ' (off a wall)' : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}`).join(' · ') : '');
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
// nothing overhead under 45 m at a tee: the alcove's roof, the built things
const overhead = (B, p, g) => { const r = B.roof(...p), sol = B.solids(...p).filter(([a]) => a - g < 45); return { roof: r === null ? null : r - g, solid: sol.length ? sol[0][2] : null }; };
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; R_(`${sl > 3 ? '!' : ' '} ${h.n} pin slope ${sl.toFixed(1)}%`);
  const oh = [];
  for (const [k, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 14; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) R_(`! ${h.n} ${k} tee: fairway ${near} m away (12 m wanted)`);
    const sf = B.surface(...p); if (sf !== 'tee') R_(`! ${h.n} ${k} tee pad reads ${sf}`);
    let voidN = 0; for (const u of [-5, 0, 5]) for (const v of [-6, 0, 6]) if (B.ground(p[0] + u, p[1] + v) === null) voidN++;
    if (voidN) R_(`! ${h.n} ${k} tee: ${voidN} of 9 points of its pad over open air`);
    const g = B.ground(...p), o = overhead(B, p, g);
    if (o.solid || (o.roof !== null && o.roof < 45)) R_(`! ${h.n} ${k} tee: ${o.solid || 'the roof'} overhead ${o.roof !== null ? o.roof.toFixed(0) + ' m up' : ''}`);
    oh.push(`${k} ${o.roof === null ? 'open sky' : 'the roof ' + Math.round(o.roof) + ' m up'}`);
  }
  if (h.n === 7) R_(`  7 over the tees: ${oh.join(', ')}`);
}
lap('pins and tees');
function playsLike(dist, dh) {
  for (let mph = 60; mph <= 170; mph += 1) {
    const sh = { Speed: mph, VLA: 26 - mph * 0.08, TotalSpin: 8800 - mph * 32, HLA: 0, SpinAxis: 0 };
    const sea = simulate(sh, { groundAt: () => 0, flightOnly: true });
    const drop = simulate(sh, { groundAt: (x, z) => { const r = Math.hypot(x, z); return r < 2 ? 0 : r > dist * 0.7 ? dh : -80; }, altFt: ALT, voidY: -200, flightOnly: true });
    if (drop.carry * YD >= dist) return Math.round(sea.carry);
  }
  return null;
}
const p3 = [], CONT = [], LEANS = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], m = meta[i], back = h.teePts[BACK];
  // the tips spot
  const t = h.tipsPt, ts = B.surface(...t), tg = B.ground(...t);
  let nearF = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 16; r++) if (B.surface(t[0] + Math.cos(a) * r, t[1] + Math.sin(a) * r) === 'fairway') nearF = Math.min(nearF, r);
  const oh = tg === null ? { roof: null, solid: 'open air' } : overhead(B, t, tg);
  const hd0 = headingAt(h.line, 1), pc = Math.cos(hd0), ps = Math.sin(hd0), padY = [];
  for (const u of [-4.5, 0, 4.5]) for (const v of [-5.5, 0, 5.5]) padY.push(B.ground(t[0] + u * pc - v * ps, t[1] + u * ps + v * pc));
  const padVoid = padY.some(v => v === null), padOk = !padVoid && Math.max(...padY) - Math.min(...padY) <= 1.2, behind = h.tipsYards - h.yards[BACK];
  const lenOk = h.par === 3 ? behind >= 8 && behind <= 30 : behind >= 20 && behind <= 50;
  let land = '', landOk = true;
  if (h.par > 3) {
    const c = COURSE.tipsSet.minDrive, s = Math.min(h.len - 1, project(h.line, ...t).s - Math.hypot(t[0] - h.line[0][0], t[1] - h.line[0][1]) * (project(h.line, ...t).s <= 0.01 ? 1 : 0) + c * YD);
    const ln = lanes(B, at(h.line, s), headingAt(h.line, s)), ok = Math.max(0, ...ln) >= 40 || ln.filter(v => v >= 25).length >= 2;
    const notch = h.n === 5 && Math.abs(s - (NOTCH.s0 + NOTCH.s1) / 2) < 30;
    land = notch ? ` ${c} yd drive: at the notch, so it lays up or carries;` : ` ${c} yd drive: ${B.surface(...at(h.line, s))}, lanes ${ln.map(Math.round).join(' + ') || 'none'} m;`; landOk = ok || notch || (h.n === 5 && Math.max(0, ...ln) >= 30);
  }
  const ohOk = !oh.solid && (oh.roof === null || oh.roof >= 45);
  const okT = !['water', 'green', 'fairway', 'sand', 'void', 'rock'].includes(ts) && padOk && lenOk && nearF >= 12 && ohOk && landOk;
  R_(`${okT ? ' ' : '!'} ${h.n} tips ${h.tipsYards} yd (+${behind}): ${ts}, pad ${padVoid ? 'OVER OPEN AIR' : padOk ? 'level' : 'NOT LEVEL'} (${padVoid ? '-' : (Math.max(...padY) - Math.min(...padY)).toFixed(1)} m), ${nearF === Infinity ? '16+' : nearF} m off fairway, overhead ${oh.roof === null ? 'open' : Math.round(oh.roof) + ' m'};${land}`);
  // every tee set's drive lands on 40 m or more of fairway (two lanes of 25 m on a split hole)
  if (h.par > 3) {
    const ws = [];
    for (const T of COURSE.teeSets) {
      const s0 = project(h.line, ...h.teePts[T.id]).s, s = Math.min(h.len - 20, s0 + (T.minDrive || 150) * YD);
      const p = at(h.line, s), dir = headingAt(h.line, s), ln = lanes(B, p, dir), wide = Math.max(0, ...ln), ok = wide >= 40 || ln.filter(v => v >= 25).length >= 2;
      ws.push(`${T.name} ${ln.length > 1 ? ln.map(Math.round).join('+') : Math.round(wide)}`);
      if (!ok && h.n === 5 && Math.abs(s - (NOTCH.s0 + NOTCH.s1) / 2) < 30) R_(`  5 ${T.name} drive (${T.minDrive || 150} yd) would land at the notch: this tee set lays up short of it (${Math.round((NOTCH.s0 - 25 - s0) / YD)} yd) or carries it (${Math.round((NOTCH.s1 + 8 - s0) / YD)} yd)`);
      else if (!ok) R_(`${h.n === 5 && wide >= 30 ? ' ' : '!'} ${h.n} ${T.name} drive (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, lanes ${ln.map(Math.round).join(', ') || 'none'} m${h.n === 5 && wide >= 30 ? ' (the crest: the nine\'s one tight fairway)' : ''}`);
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
      const a = (c - half) / 2, b = (half - r) / 2, x = h.pin[0] + a * rx + b * fx, z = h.pin[1] + a * rz + b * fz, g = B.ground(x, z);
      hg.push(g === null ? null : +(g - y0).toFixed(3)); gmv.push(+B.gm(x, z).toFixed(2)); sf.push(SURF.indexOf(B.surface(x, z)));
    }
    const pa = gs.areas.map(q => { const dx = q.x - h.pin[0], dz = q.z - h.pin[1]; return [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; });
    fs.writeFileSync(`${OUT}/green${h.n}.json`, JSON.stringify({ N, step: 0.5, h: hg, gm: gmv, s: sf, areas: pa, pin: [0, 0] }));
  }
  const badG = gs.pinSlope > 3 || (gs.areas.length < 2 && m.greenArea > 400) || gs.median < 1 || gs.median > 3;   // a green under 400 m² (the Needle's) may have one pin area
  R_(`${badG ? '!' : ' '} ${h.n} green contour: typical slope ${gs.median.toFixed(1)}%, ${gs.relief.toFixed(2)} m beyond its plane (${feat}), pin ${gs.pinSlope.toFixed(1)}%, ${gs.areas.length} pin areas, ${Math.round(gs.cup * 100)}% cuppable`);
  if (h.par > 3) {
    const ws = [];
    for (const q of (h.targets || []).filter(q => !q.bold && !q.pin)) {
      const pq = project(h.line, ...q.at), v = leanAlong(B, pq.s - 30, pq.s + 30, 12, pq.off).map(x => x[1]);
      if (v.length) ws.push({ name: q.name, lean: v.reduce((a, b) => a + b, 0) / v.length });
    }
    m.lean = ws.map(w_ => ({ name: w_.name, lean: +w_.lean.toFixed(1) }));
    R_(`  ${h.n} fairway lean: ${ws.map(w_ => `${w_.name} ${Math.abs(w_.lean).toFixed(1)}% ${w_.lean > 0.3 ? 'to the right' : w_.lean < -0.3 ? 'to the left' : 'level'}`).join('; ') || 'no targets'}`);
  }
  lap(`hole ${h.n} checked`);
}
const featN = CONT.filter(c => c.feat === 'a feature').length;
R_(`${featN >= 5 ? ' ' : '!'} greens with a feature (0.25 m+ beyond the plane): ${featN} of ${CONT.length}; flatter: ${CONT.filter(c => c.feat !== 'a feature').map(c => c.n).join(', ') || 'none'}`);
for (const q of p3) R_(`  par 3 ${q.n}: ${q.yd} yd on the card, plays like about ${q.plays} yd at sea level (the air and the height)`);

// ---- the fixed camera (3.2 m behind the ball, 1.55 m up; 19° above level to 31° below, about 90° across on a phone
// held sideways): each tee set's target in sight. Open air hides nothing; the ground and the built things do.
const EYE = 1.55, BACKC = 3.2, HALF = 45;
function sight(B, from, to, toY, fromY = null) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]), ux = (to[0] - from[0]) / d, uz = (to[1] - from[1]) / d;
  const eye = [from[0] - ux * BACKC, from[1] - uz * BACKC], ey = (fromY ?? B.ground(...from)) + EYE, D = d + BACKC, ang = Math.atan2(toY - ey, D) * 180 / Math.PI;
  let hid = null;
  for (let t = 4; t < D - 3 && !hid; t += 1.5) { const x = eye[0] + ux * t, z = eye[1] + uz * t, y = ey + (toY - ey) * t / D, g = B.ground(x, z);
    if (g !== null && g > y + 0.05) hid = `the ground ${Math.round(t)} m out`; else for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hid = what; break; } }
  return { ang, inFrame: ang <= 19 && ang >= -31, hid, d, ey };
}
let blind = 0; const blindBold = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], out = [];
  for (const T of COURSE.teeSets) {
    const tee = h.teePts[T.id]; let to, toY, what;
    if (h.par === 3) { to = h.pin; toY = B.ground(...h.pin) + 2.1; what = 'the flag'; }
    else { const q = (h.targets || []).find(q => !q.bold); to = q.at; toY = B.ground(...to) + 0.3; what = q.name; }
    const S = sight(B, tee, to, toY), ok = S.inFrame && !S.hid;
    out.push(`${T.name} ${ok ? 'sees' : 'CANNOT SEE'} ${what} (${S.ang.toFixed(1)}°${S.hid ? ', behind ' + S.hid : ''})`);
    if (!ok) { R_(`! ${h.n} ${T.name} tee: ${what} is ${S.hid ? 'hidden by ' + S.hid : 'out of the frame'} (${S.ang.toFixed(1)}°)`); if (T.id === BACK) blind++; }
  }
  R_(`  ${h.n} tee view: ${out.join('; ')}`);
  for (const bt of (h.targets || []).filter(q => q.bold)) {
    const S = sight(B, h.teePts[BACK], bt.at, B.ground(...bt.at) + (bt.pin ? 2.1 : 0.3)), M = !bt.pin && S.hid ? sight(B, h.teePts[BACK], bt.at, B.ground(...bt.at) + 2.5) : null;
    if (S.inFrame && !S.hid) R_(`  ${h.n} bold target "${bt.name}" from the ${COURSE.teeSets[0].name} tee: in sight (${S.ang.toFixed(1)}°)`);
    else if (M && M.inFrame && !M.hid) R_(`  ${h.n} bold target "${bt.name}" from the ${COURSE.teeSets[0].name} tee: its ground hidden by ${S.hid}, a 2.5 m marker on it in sight (${M.ang.toFixed(1)}°): a marker goes there`);
    else { R_(`! ${h.n} bold target "${bt.name}" from the ${COURSE.teeSets[0].name} tee: hidden by ${S.hid} (${S.ang.toFixed(1)}°)`); blindBold.push(h.n); }
  }
}
// blind approaches: on purpose only the 6th's second from below the face (and the 5th's catch shelf, a recovery)
let blindA = 0; const ONPURPOSE = { 6: 'The lower shelf', 9: 'The first tier' };
for (const [i, B] of BUILT.entries()) { const h = HOLES[i]; if (h.par === 3) continue;
  for (const q of (h.targets || []).filter(q => !q.pin)) { const S2 = sight(B, q.at, h.pin, B.ground(...h.pin) + 2.1), d = Math.hypot(q.at[0] - h.pin[0], q.at[1] - h.pin[1]);
    if (d > 260) { if (ONPURPOSE[h.n] === q.name) { const nx = (h.targets || []).find(t => !t.bold && t !== q && !t.pin); if (nx) { const S3 = sight(B, q.at, nx.at, B.ground(...nx.at) + 0.3); if (S3.hid) { blindA++; R_(`  ${h.n} from "${q.name}" the next target ("${nx.name}") is hidden by ${S3.hid}: blind on purpose (the face)`); } else R_(`  ${h.n} from "${q.name}" the next target ("${nx.name}") is in sight`); } } continue; }
    if (S2.hid) { blindA++; R_(`${ONPURPOSE[h.n] === q.name ? ' ' : '!'} ${h.n} from "${q.name}" the flag is hidden by ${S2.hid}${ONPURPOSE[h.n] === q.name ? ' (on purpose)' : ''}`); } } }
R_(`${blind + blindBold.length <= 2 ? ' ' : '!'} blind tee shots: ${blind} safe lines from the back tees, ${blindBold.length} bold lines (${blindBold.join(', ') || 'none'}); two a nine at most. Blind approaches: ${blindA} (the 5th's catch shelf, a recovery, is blind by design)`);
lap('views');

// ---- the brief's look-at-first list
const wd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pct = (a, b) => Math.round(a / Math.max(1, b) * 100);
// the thin air: what the course's altitude does to a drive and a 7 iron (the round-0 numbers, here in the plan)
{
  const c = s => [simulate(s, { flightOnly: true, groundAt: () => 0 }).carry, simulate(s, { flightOnly: true, groundAt: () => 0, altFt: ALT }).carry];
  const d = c({ ...DRIVES.tour, HLA: 0, SpinAxis: 0 }), i7 = c({ Speed: 120, VLA: 16.3, TotalSpin: 7097, HLA: 0, SpinAxis: 0 });
  R_(`  thin air (${ALT.toLocaleString()} ft): a tour driver carries ${Math.round(d[0])} -> ${Math.round(d[1])} yd (+${pct(d[1] - d[0], d[0])}%), a 7 iron ${Math.round(i7[0])} -> ${Math.round(i7[1])} (+${pct(i7[1] - i7[0], i7[0])}%)`);
}
// the wall gives: drives aimed into each wall beside play; how many drop at its foot, and a shot back from the foot
{
  const out = [];
  for (const [k, side, s] of [[0, 1, 250], [5, 1, 330], [6, -1, 130]]) {
    const B = BUILT[k], h = HOLES[k], tgt = at(h.line, s, side * 60), from = k === 6 ? h.teePts[BACK] : at(h.line, s - 170, 0); let hit = 0, foot = 0, back = 0, n = 0;
    for (let j = 0; j < 24; j++) { seed = 300 + j * 13 + k; const dir = Math.atan2(tgt[0] - from[0], -(tgt[1] - from[1])) + (rng() - 0.5) * 0.08; const r = drive(B, from, dir, k === 6 ? { Speed: 125, VLA: 15, TotalSpin: 5000 } : DRIVES.mid); n++; if (!r.rocks) continue; hit++;
      const pr = project(h.line, ...r.end); if (Math.abs(Math.abs(pr.off) - Math.abs(project(h.line, ...tgt).off)) < 30 || B.surface(...r.end) === 'rock') foot++; else back++; }
    out.push(`${k + 1}: ${hit} of ${n} hit the wall, ${foot} finished at its foot, ${back} came back out`);
  }
  R_(`  the wall gives (soak ${SOAK}): ${out.join('; ')}`);
  // from the foot of each wall beside play, a clear shot back to fairway (60 m or less)
  const res = [];
  for (const [k, side] of [[0, 1], [5, 1], [6, -1]]) {
    const B = BUILT[k], h = HOLES[k]; let dead = 0, n = 0;
    for (let s = 60; s < h.len - 30; s += 30) {
      let o = side * 10; while (Math.abs(o) < 90 && !(B.surface(...at(h.line, s, o)) === 'rock' && (B.slopeAt(...at(h.line, s, o)) > 0.75))) o += side * 1;
      if (Math.abs(o) >= 90) continue; const p = at(h.line, s, o - side * 3); n++;
      const play = h.par === 3 ? ['green', 'fringe', 'rough', 'scrub'] : ['fairway'];   // a par 3 has no fairway: back to the green or the rough beside it
      let ok = false; for (let b = 0; b < 6.283 && !ok; b += 0.2) for (const r of [20, 35, 50]) { const q = [p[0] + Math.cos(b) * r, p[1] + Math.sin(b) * r]; if (play.includes(B.surface(...q)) && B.ground(...q) !== null && B.ground(...q) < B.ground(...p) + 6) ok = true; }
      if (!ok) dead++;
    }
    res.push(`${k + 1} ${n - dead} of ${n}`);
  }
  R_(`  a wall never traps a ball: from its foot (3 m out), fairway (on the 7th, the green or rough) within 50 m and no more than 6 m up: ${res.join(', ')}`);
}
// the kerb: balls rolled toward the edge at 4-12 m/s; how many go over into the mist
{
  const B = BUILT[0], h = HOLES[0]; const res = [];
  for (const v of [4, 6, 8, 10, 12]) {
    let over = 0, n = 0;
    for (const s of [180, 230, 280, 330]) {
      let o = -10; while (o > -90 && !(B.surface(...at(h.line, s, o)) === 'kerb')) o -= 0.5; const p = at(h.line, s, o + 14), dir = headingAt(h.line, s) - Math.PI / 2; n++;
      const mph = v / 0.44704, r = drive(B, p, dir, { Speed: mph, VLA: 0.2, TotalSpin: 200 });
      if (r.outcome === 'void') over++;
    }
    res.push(`${v} m/s ${over} of ${n} over`);
  }
  R_(`  the kerb (1.6 m of rock) on the 1st, a ball rolled at it from 14 m: ${res.join(', ')}`);
}
// the mist takes: penalty ground within a medium miss (55 m) on both sides of a landing area
{
  const out = [];
  for (const [i, B] of BUILT.entries()) { const h = HOLES[i]; if (h.par === 3) continue;
    let both = 0, either = 0; const where = [];
    for (const q of (h.targets || []).filter(t => !t.pin)) { const pr = project(h.line, ...q.at), hd = headingAt(h.line, pr.s) + Math.PI / 2, nx = Math.sin(hd), nz = -Math.cos(hd);
      const side = sg => { for (let a = 0; a <= 55; a += 1) { const p = [q.at[0] + nx * a * sg, q.at[1] + nz * a * sg]; const sf = B.surface(...p); if (sf === 'void' || sf === 'water') return a; } return null; };
      const L = side(-1), R = side(1); if (L !== null && R !== null) { both++; where.push(`${q.name} (left ${L} m, right ${R} m)`); } else if (L !== null || R !== null) either++; }
    out.push(`${h.n} ${both ? 'BOTH SIDES at ' + where.join(', ') : either ? 'one side' : 'none'}`); }
  R_(`${out.some(o => /BOTH/.test(o)) ? '!' : ' '} penalty ground (mist, water) within 55 m of a landing target: ${out.join('; ')}`);
}
// the alcove's roof against the highest shots the game sees
{
  const B = BUILT[6], h = HOLES[6]; let lo = Infinity; for (let s = -10; s <= h.len + 10; s += 5) for (const o of [-20, 0, 20]) { const p = at(h.line, s, o), r = B.roof(...p), g = B.ground(...p); if (r !== null && g !== null) lo = Math.min(lo, r - g); }
  const ap = s => simulate({ HLA: 0, SpinAxis: 0, ...s }, { groundAt: () => 0, altFt: ALT }).apexFt * 0.3048;
  R_(`  7 the alcove's roof: ${Math.round(lo)} m over the play at its lowest; apex in this air: a hybrid ${ap(HYBRID).toFixed(0)} m, a 7 iron ${ap({ Speed: 120, VLA: 16.3, TotalSpin: 7097 }).toFixed(0)} m, a skied driver (150 mph, 35°) ${ap({ Speed: 150, VLA: 35, TotalSpin: 4500 }).toFixed(0)} m`);
  seed = 5; const r7 = drive(B, h.teePts[BACK], headingAt(h.line, 1), { Speed: 150, VLA: 35, TotalSpin: 4500 });
  R_(`  7 a skied driver from the Summit tee: ${r7.rocks ? 'hits the roof and drops' : 'clears the roof'}, finishes on ${r7.rest}`);
}
// the Stair: the face, its lip in the tee view, the lay-up's distance from the face's foot, the longest drives
{
  const B = BUILT[5], h = HOLES[5], g = s => B.ground(...at(h.line, s, 22)), F0 = 262, F1 = 278, face = [g(F0), g(F1)];   // the face beside the ramp (22 m right of the line)
  const lay = h.targets[0], d = project(h.line, ...lay.at).s;
  const lip = at(h.line, F1 + 2), S = sight(B, h.teePts[BACK], lip, B.ground(...lip) + 0.5), S2 = sight(B, h.teePts[BACK], at(h.line, F1 + 30), g(F1 + 30) + 0.3);
  const gr = q => B.ground(...at(h.line, q)), rs = Math.max(...Array.from({ length: 26 }, (_, k) => (gr(248 + k * 2 + 2) - gr(248 + k * 2)) / 2 * 100));
  R_(`  6 the ramp (the neck) on the line: ${(gr(300) - gr(248)).toFixed(1)} m up from 248 to 300 m, steepest ${rs.toFixed(0)}%`);
  R_(`  6 the face beside it: ${(face[1] - face[0]).toFixed(1)} m from ${F0} to ${F1} m (steepest ${Math.max(...Array.from({ length: 8 }, (_, k) => (g(F0 + k * 2 + 2) - g(F0 + k * 2)) / 2 * 100)).toFixed(0)}%); the lay-up target ${Math.round(F0 - d)} m short of its foot; the lip ${S.hid ? 'HIDDEN by ' + S.hid : 'in the frame from the Summit tee'} (${S.ang.toFixed(1)}°); the top beyond it ${S2.hid ? 'out of sight' : 'in sight'}`);
  const dr = meta[5].drives; R_(`  6 drives up the line: ${Object.entries(dr).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)} yd to ${v.rest}`).join(', ')} (the face's foot at ${Math.round(F0 / YD)} yd, its top ${Math.round(F1 / YD)})`);
}
// the Broken Ridge: the crest's width, the catch shelf, the notch, both routes
{
  const B = BUILT[4], h = HOLES[4]; const ws = [140, 200, 300, 400].map(s => Math.round(Math.max(0, ...lanes(B, at(h.line, s), headingAt(h.line, s)))));
  let shelf = null; for (let o = -20; o > -70; o -= 1) { const sf = B.surface(...at(h.line, 180, o)); if (sf === 'rough' && B.slopeAt(...at(h.line, 180, o)) < 0.2) { shelf = [o, B.ground(...at(h.line, 180, o))]; break; } }
  const crest = B.ground(...at(h.line, 180));
  R_(`  5 the crest: fairway ${ws.join(', ')} m wide (at 140, 200, 300, 400 m); the catch shelf ${shelf ? Math.round(-shelf[0]) + ' m left of the line, ' + (crest - shelf[1]).toFixed(1) + ' m below the crest' : 'MISSING'}; the notch ${NOTCH.s0}-${NOTCH.s1} m, ${(crest - B.ground(...at(h.line, (NOTCH.s0 + NOTCH.s1) / 2))).toFixed(1)} m deep`);
  const lay = h.targets[0], bold = h.targets[1];
  R_(`  5 short of the notch (${Math.round(project(h.line, ...lay.at).s / YD)} yd) leaves ${Math.round(wd(lay.at, h.pin) / YD)} yd; over it (${Math.round(project(h.line, ...bold.at).s / YD)} yd, a ${Math.round(NOTCH.s1 / YD)} yd carry) leaves ${Math.round(wd(bold.at, h.pin) / YD)} yd`);
  const S = sight(B, at(h.line, 180, shelf ? shelf[0] : -40), h.pin, B.ground(...h.pin) + 2.1);
  R_(`  5 from the catch shelf the flag is ${S.hid ? 'hidden (' + S.hid + '): a blind shot back up, as the card says' : 'in sight'}`);
}
// the Descent: the tiers, the courtyard from the tee, the bold drive
{
  const B = BUILT[8], h = HOLES[8]; const tiers = [118, 232, 320].map(s => B.ground(...at(h.line, s)) + B.base);
  const S = sight(B, h.teePts[BACK], h.pin, B.ground(...h.pin) + 2.1), S1 = sight(B, h.teePts[BACK], h.targets[0].at, B.ground(...h.targets[0].at) + 0.3);
  const gold = SITES.find(o => o.roof === 'gold'), gl = LOC[8](...gold.at), gy = worldAt(...gold.at).y - B.base + gold.h;
  for (const [nm, p] of [['the Summit tee', h.teePts[BACK]], ['the first tier', h.targets[0].at]]) { const dd = Math.hypot(gl[0] - p[0], gl[1] - p[1]), q = [gl[0] - (gl[0] - p[0]) / dd * 18, gl[1] - (gl[1] - p[1]) / dd * 18], G = sight(B, p, q, gy - 1); R_(`${G.hid ? '!' : ' '} 9 from ${nm} the golden roof (the bold line's aim) is ${G.hid ? 'hidden by ' + G.hid : 'in sight'} (${G.ang.toFixed(1)}°)`); }
  for (const [nm, p] of [['the Summit tee', h.teePts[BACK]], ['the first tier', h.targets[0].at], ['the second tier', h.targets[1].at]]) { const seen = [];
    for (const o of SITES.filter(o => o.kind === 'hall')) { const q0 = LOC[8](...o.at), dd = Math.hypot(q0[0] - p[0], q0[1] - p[1]), q = [q0[0] - (q0[0] - p[0]) / dd * (o.w / 2 + 2), q0[1] - (q0[1] - p[1]) / dd * (o.w / 2 + 2)], top = worldAt(...o.at).y - B.base + o.h, G = sight(B, p, q, top - 1.5); seen.push(`${o.name} ${G.hid ? 'hidden' : 'seen'}${G.inFrame ? '' : ' (out of frame)'}`); }
    R_(`  9 from ${nm}, the monastery's roofs: ${seen.join(', ')}`); }
  R_(`  9 the tiers: ${tiers.map(v => v.toFixed(0)).join(', ')} m; from the Summit tee the first tier ${S1.hid ? 'HIDDEN (' + S1.hid + ')' : 'in sight'} (${S1.ang.toFixed(0)}°), the flag in the courtyard ${S.hid ? 'HIDDEN (' + S.hid + ')' : 'in sight'} (${S.ang.toFixed(0)}°, ${Math.round(wd(h.teePts[BACK], h.pin) / YD)} yd)`);
  const res = []; for (let j = 0; j < 12; j++) { seed = 900 + j * 7; const dir = Math.atan2(h.pin[0] - h.teePts[BACK][0], -(h.pin[1] - h.teePts[BACK][1])) + (rng() - 0.5) * 0.1; const r = drive(B, h.teePts[BACK], dir, { ...DRIVES.mid, SpinAxis: (rng() - 0.5) * 12 }); res.push(r.rest); }
  const cnt = res.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {});
  R_(`  9 twelve 150 mph drives at the golden roof (a decent amateur's scatter): ${Object.entries(cnt).map(([k, v]) => `${v} ${k}`).join(', ')}`);
}
// the Tea Terraces: the upper terrace's width, the step, the green from the upper terrace
{
  const B = BUILT[7], h = HOLES[7]; const up = [200, 260, 330].map(s => { const ln = lanes(B, at(h.line, s), headingAt(h.line, s)); return ln.map(Math.round).join('+'); });
  const step = B.ground(...at(h.line, 280, -20)) - B.ground(...at(h.line, 280, 20)), hi = h.targets.find(t => t.bold), S = sight(B, hi.at, h.pin, B.ground(...h.pin) + 2.1), lo = h.targets[2], S2 = sight(B, lo.at, h.pin, B.ground(...h.pin) + 2.1);
  R_(`  8 the two terraces: lanes ${up.join(', ')} m (at 200, 260, 330 m); the upper ${step.toFixed(1)} m over the lower; from the upper terrace the flag ${S.hid ? 'hidden' : 'in sight'} (${Math.round(wd(hi.at, h.pin) / YD)} yd); from the low road's lay-up ${S2.hid ? 'hidden' : 'in sight'} (${Math.round(wd(lo.at, h.pin) / YD)} yd)`);
}
// the Needle and the Balcony: the carries
{
  for (const k of [1, 3]) { const B = BUILT[k], h = HOLES[k]; const parts = [];
    for (const T of COURSE.teeSets) { const p = h.teePts[T.id], D = wd(p, h.pin); let last = null, first = null; for (let t = 0; t < D; t += 0.5) { const q = [p[0] + (h.pin[0] - p[0]) * t / D, p[1] + (h.pin[1] - p[1]) * t / D]; if (B.ground(...q) === null) { if (first === null) first = t; last = t; } }
      const carry = last === null ? 0 : (last + 1) / YD, cap = T.id === FRONT ? 150 * 0.6 : null; parts.push(`${T.name} ${h.yards[T.id]} yd, carries ${Math.round(carry)} yd of open air${cap && carry > cap ? ' (over 60% of 150)' : ''}`); }
    R_(`${parts.some(p => /over 60/.test(p)) ? '!' : ' '} ${h.n} ${h.name}: ${parts.join('; ')}`); }
}
// the pinnacles keep off the lines; slots of open air inside a fairway
{
  const near = PINNACLES.filter(p => lineD(p[0], -p[1]) < 45 + p[2]);
  R_(`${near.length ? '!' : ' '} pinnacles within 45 m of a line: ${near.length ? near.map(p => p.slice(0, 2).join(',')).join('; ') : 'none'}`);
  const slots = BUILT.map((B, i) => { const h = HOLES[i]; let n = 0; for (let s = 0; s < h.len; s += 2) for (let o = -60; o <= 60; o += 2) { const p = at(h.line, s, o); if (B.fairwayD(...p) < -2 && B.ground(...p) === null) n++; } return n ? `${h.n} ${n * 4} m²` : null; }).filter(Boolean);
  R_(`${slots.length ? '!' : ' '} open air inside a fairway outline: ${slots.join(', ') || 'none'}`);
}
R_(`  walks green to tee (m): ${HOLES.slice(0, -1).map((h, i) => `${h.n}-${h.n + 1} ${Math.round(wd(WOR[i](...h.pin), WOR[i + 1](...HOLES[i + 1].teePts[BACK])))}`).join(', ')}`);
// the landmark: the golden roof against the fixed camera's 90° frame, from each tee and landing target
{
  const gold = SITES.find(o => o.roof === 'gold').at, out = [];
  for (const [i, h] of HOLES.entries()) {
    const pts = [['tee', h.teePts[BACK], h.par === 3 ? h.pin : (h.targets.find(q => !q.bold) || { at: h.pin }).at], ...(h.targets || []).filter(q => !q.pin).map(q => [q.name, q.at, h.pin])];
    for (const [name, p, aimL] of pts) { const P0 = WOR[i](...p), aim = WOR[i](...aimL);
      let b = Math.atan2(gold[0] - P0[0], -(gold[1] - P0[1])) - Math.atan2(aim[0] - P0[0], -(aim[1] - P0[1])); b = Math.atan2(Math.sin(b), Math.cos(b)); const deg = Math.round(b * 180 / Math.PI);
      if (Math.abs(deg) <= HALF) out.push(`${h.n} ${name} (${Math.abs(deg)}° ${deg < 0 ? 'left' : 'right'}, ${Math.round(Math.hypot(gold[0] - P0[0], gold[1] - P0[1]))} m)`); }
  }
  R_(`  the golden roof in the 90° frame: ${out.join('; ') || 'nowhere'}`);
}
fs.writeFileSync(`${OUT}/checks.txt`, report.join('\n'));
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets, back: BACK, p3 }));
lap('done');
