// node tools/lostvalley/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), plus the
// course map raster, and the rules checks. Then: python3 plans.py, node sketch.mjs, node book.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, LOC, WOR } from './scene.mjs';
import { V, RIVER, POOL, TAR, SWAMP, BLUFF, BRIDGE, LEDGE, CAMP_FALLS, GREAT_FALLS } from './world.mjs';
import { CAMP, LIFE } from './life.mjs';
import { project, at, lengthOf, YD, headingAt } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const PHYS = { bar: 'sand', fringe: 'fairway', tee: 'fairway', tar: 'water', meadow: 'desert', jungle: 'rough', cliff: 'desert', mud: 'desert', gravel: 'waste', rubble: 'waste', camp: 'rough', void: 'rough' };

// a drive from p along direction dir (radians from -z, + right) over the hole's ground: the flight, and where
// it first meets anything solid above the ground
function drive(B, p, dir, shot) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = B.ground(p[0], p[1]) ?? 0;
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return PHYS[v] || v; },
    voidY: -80, altFt: COURSE.altFt,
  });
  let hit = null; const pts = [];
  for (const q of r.pts) {
    const [x, z] = W(q.p[0], q.p[2]), y = y0 + q.p[1], d = Math.hypot(x - p[0], z - p[1]);
    if (!hit) for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hit = { d, y, what }; break; }
    pts.push([+d.toFixed(1), +y.toFixed(2), q.phase === 'flight' ? 0 : 1]);
  }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), hit, rest: B.surface(ex, ez) };
}

const meta = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 140;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const W = x1 - x0, H = z1 - z0, hgt = new Float32Array(W * H), srf = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const x = x0 + c + 0.5, z = z0 + r + 0.5, g = B.ground(x, z);
    hgt[r * W + c] = g === null ? NaN : g; srf[r * W + c] = SURF.indexOf(B.surface(x, z));
  }
  fs.writeFileSync(`${OUT}/h${h.n}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), B.solids(x, z).map(v => [v[0], v[1], v[2]])]); } return P; };
  const back = h.teePts[BACK], tee0 = B.ground(...back);
  const dir0 = headingAt(h.line, 1);
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldLine) { const [a, b] = h.boldLine, d = Math.atan2(b[0] - a[0], -(b[1] - a[1])); bold = { line: h.boldLine, prof: along(h.boldLine), drives: Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, d, sh)])) }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 45; x < h.pin[0] + 45; x++) for (let z = h.pin[1] - 45; z < h.pin[1] + 45; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  // the climb and the fall along the line (each run of 1 m or more)
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const labels = [];
  const L_ = (p, t) => labels.push([p, t]);
  for (const f of h.forms || []) if (f.label) L_(f.at, f.label);
  if (h.spire) L_([h.spire.at[0] - 30, h.spire.at[1]], h.spire.label);
  if (h.strangler) L_([h.strangler.trunk[0] + 30, h.strangler.trunk[1] - 30], h.strangler.label);
  // the valley's features labelled where they are in this hole's frame
  const feats = [[[TAR.c[0], TAR.c[1] - 26], 'the tar pit'], [POOL.c, 'the plunge pool'], [[BLUFF.c[0], BLUFF.c[1]], 'the Bone Bluff'], [[(BRIDGE.a[0] + BRIDGE.b[0]) / 2, (BRIDGE.a[1] + BRIDGE.b[1]) / 2 - 14], 'the rope bridge'],
    [[350, -560], 'the swamp'], [[470, -1250], 'the river'], [[520, -950], 'the river'], [[110, 80], 'the camp'], [CAMP_FALLS.pool.c, 'Camp Falls'], [GREAT_FALLS.foot, 'the Great Falls'], [[450, -1500], 'the gorge']];
  for (const [wp, t] of feats) { const p = LOC[i](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 170 && pr.s > -60 && pr.s < h.len + 80) L_(p, t); }
  const cr = [];
  const wobjs = [];
  // the camp and the bridge, from world space into this hole's frame
  for (const o of CAMP) { const p = LOC[i](...o.at); if (Math.hypot(p[0] - h.line.at(-1)[0], p[1] - h.line.at(-1)[1]) < 500 || Math.hypot(...p) < 400) wobjs.push({ ...o, x: p[0], z: p[1], rot: (o.rot || 0) - h.place.heading * Math.PI / 180 }); }
  { const a = LOC[i](...BRIDGE.a), b = LOC[i](...BRIDGE.b); if (Math.min(Math.hypot(...a.map((v, j) => v - h.pin[j])), Math.hypot(...a)) < 400) wobjs.push({ kind: 'bridge', a, b }); }
  meta.push({ tips: h.tipsPt, tipsYards: h.tipsYards, cracks: cr, wobjs, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    greenArea: gcells, teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), targets: (h.targets || []).map(t => {
      // the width of fairway straight across the line where the target sits
      const pr = project(h.line, ...t.at); let w = 0;
      if (B.surface(...t.at) === 'fairway') { let a = pr.off, b = pr.off; while (B.surface(...at(h.line, pr.s, a - 0.5)) === 'fairway' && a > pr.off - 120) a -= 0.5; while (B.surface(...at(h.line, pr.s, b + 0.5)) === 'fairway' && b < pr.off + 120) b += 0.5; w = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(w), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    objs: B.objs, prof, drives, bold, words: h.words, green: h.green, base: h.base, place: h.place, labels });
}
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets }));

// the course map: the valley's surface and a hillshade from its heights
const WR = 5, X0 = -1000, X1 = 1300, Z0 = -1960, Z1 = 360;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y === null ? NaN : v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF,
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })),
  camp: CAMP, life: LIFE, bridge: BRIDGE, back: BACK }));

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(18)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what : ''}`).join(' · ') : '');
  console.log('    green', m.greenArea, 'm2');
  console.log('    targets', m.targets.map(t => `${t.name} ${t.d}yd ${t.surf} ${t.width}m`).join(' · '));
}
console.log('total', meta.reduce((a, m) => a + m.yards[BACK], 0), 'yd; par', meta.reduce((a, m) => a + m.par, 0));
// checks: pins 3% or less, tees not on fairway (12 m clear), the roof 45 m over every tee
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; if (sl > 3) console.log('PIN', h.n, sl.toFixed(1) + '%');
  for (const [k, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.2) for (let r = 0; r < 16; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) console.log('TEE', h.n, k, 'fairway', near, 'm away');
    for (const [a] of B.solids(...p)) if (a - B.ground(...p) < 45) console.log('OVERHEAD', h.n, k, (a - B.ground(...p)).toFixed(0), 'm');
  }
}

// ---- the shape review's checks (docs/COURSE-DESIGN.md "Greens, fairways and bunkers") and the tips tee
const fwWidth = (B, p, dir) => {   // contiguous fairway straight across a direction through p
  if (B.surface(...p) !== 'fairway') return 0;
  const nx = Math.cos(dir), nz = Math.sin(dir); let a = 0, b = 0;
  while (a > -120 && B.surface(p[0] + nx * (a - 0.5), p[1] + nz * (a - 0.5)) === 'fairway') a -= 0.5;
  while (b < 120 && B.surface(p[0] + nx * (b + 0.5), p[1] + nz * (b + 0.5)) === 'fairway') b += 0.5;
  return b - a;
};
const report = [];
const R_ = (...a) => { const l = a.join(' '); report.push(l); console.log(l); };
// plays-like for a par 3 from the game's flight: the flat carry of the iron that lands at this distance and drop
function playsLike(dist, dh) {
  let best = null;
  for (let mph = 60; mph <= 160; mph += 1) {
    const sh = { Speed: mph, VLA: 26 - mph * 0.08, TotalSpin: 8800 - mph * 32, HLA: 0, SpinAxis: 0 };
    const flat = simulate(sh, { groundAt: () => 0, surfaceAt: () => 'fairway', altFt: COURSE.altFt });
    const drop = simulate(sh, { groundAt: (x, z) => Math.hypot(x, z) > 25 ? dh : 0, surfaceAt: () => 'fairway', altFt: COURSE.altFt, voidY: -200 });
    const lf = flat.pts.find(q => q.phase !== 'flight'), ld = drop.pts.find(q => q.phase !== 'flight');
    if (!lf || !ld) continue;
    const cd = Math.hypot(ld.p[0], ld.p[2]);
    if (cd >= dist) { best = Math.hypot(lf.p[0], lf.p[2]); break; }
  }
  return best && Math.round(best / YD);
}
const p3 = [], CONT = [], LEANS = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], m = meta[i], back = h.teePts[BACK];
  // the tips spot: room, not a cliff or another hole's green, off the fairways, nothing overhead
  const t = h.tipsPt, ts = B.surface(...t), tg = B.ground(...t), d = 2;
  const sl = tg === null ? 9 : Math.hypot(B.ground(t[0] + d, t[1]) - B.ground(t[0] - d, t[1]), B.ground(t[0], t[1] + d) - B.ground(t[0], t[1] - d)) / (2 * d);
  let nearG = Infinity; const tw = toWorld(h)(...t);
  for (const [k, H] of HOLES.entries()) if (k !== i) { const g = toWorld(H)(...H.pin); nearG = Math.min(nearG, Math.hypot(g[0] - tw[0], g[1] - tw[1])); }
  let nearF = Infinity; for (let a = 0; a < 6.283; a += 0.2) for (let r = 0; r < 16; r++) if (B.surface(t[0] + Math.cos(a) * r, t[1] + Math.sin(a) * r) === 'fairway') nearF = Math.min(nearF, r);
  const over = B.solids(...t).filter(([a]) => a - tg < 45);
  const okT = !['void', 'water', 'tar', 'green', 'fairway', 'cliff', 'camp'].includes(ts) && sl < 0.3 && nearG > 35 && nearF >= 12 && !over.length;
  let land = '';
  if (h.par > 3) {   // a tips drive carrying 280 and 300 yd down the line: the fairway there
    const tsl = project(h.line, ...t).s;
    for (const c of [280, 300]) { const s = Math.min(h.len - 1, tsl + c * YD), p = at(h.line, s); land += ` ${c} yd: ${B.surface(...p)} ${Math.round(fwWidth(B, p, headingAt(h.line, s)))} m;`; }
  }
  R_(`${okT ? ' ' : '!'} ${h.n} tips ${h.tipsYards} yd (+${h.tipsYards - h.yards[BACK]}): ${ts}, slope ${(sl * 100).toFixed(0)}%, ${nearF === Infinity ? '16+' : nearF} m off fairway, nearest other green ${Math.round(nearG)} m${over.length ? ', OVERHEAD' : ''};${land}`);
  // every tee set's drive lands on 40 m or more of fairway: the fairway across the line at the drive's length
  // (minDrive, or 150 yd for the forward set) from that tee
  if (h.par > 3) {
    const ws = [];
    for (const T of COURSE.teeSets) {
      const s0 = project(h.line, ...h.teePts[T.id]).s, s = Math.min(h.len - 20, s0 + (T.minDrive || 150) * YD), p = at(h.line, s), w = fwWidth(B, p, headingAt(h.line, s));
      ws.push(`${T.name} ${Math.round(w)}`);
      if (w < 40) R_(`! ${h.n} ${T.name} drive (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, ${Math.round(w)} m of fairway`);
    }
    R_(`  ${h.n} landing widths (m): ${ws.join(', ')}`);
  }
  // fairway bunkers touch the fairway; greenside ones sit off the green
  for (const [j, b] of B.bunkers.entries()) {
    if (b.side || b.pot) continue;
    let touch = Infinity; const ins = B.inBunker(b);
    for (let x = b.box[0]; x < b.box[2]; x += 1.5) for (let z = b.box[1]; z < b.box[3]; z += 1.5) if (ins(x, z)) touch = Math.min(touch, Math.max(0, B.fairwayD(x, z)));
    if (touch > 2) R_(`! ${h.n} fairway bunker ${j} is ${touch.toFixed(0)} m off the fairway`);
    else R_(`  ${h.n} fairway bunker ${j} (${b.job || '?'}) touches the fairway`);
  }
  // the green: depth along the approach against width, and its angle to the approach (+ = turned right)
  const aim2 = (h.targets || []).filter(q => !q.bold).at(-1), from = h.par === 3 ? back : aim2 ? aim2.at : at(h.line, h.len - 120);
  const ap = Math.atan2(h.pin[0] - from[0], -(h.pin[1] - from[1])), ux = Math.sin(ap), uz = -Math.cos(ap);
  const pts = []; for (let x = h.pin[0] - 45; x < h.pin[0] + 45; x += 0.5) for (let z = h.pin[1] - 45; z < h.pin[1] + 45; z += 0.5) if (B.gm(x, z) < 0) pts.push([x, z]);
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = [Math.cos(th), Math.sin(th)];   // the long axis (x, z)
  let ang = Math.atan2(ax[0] * -uz + ax[1] * ux, ax[0] * ux + ax[1] * uz) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const along = pts.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), across = pts.map(([x, z]) => -(x - cx) * uz + (z - cz) * ux);
  const depth = Math.max(...along) - Math.min(...along), width = Math.max(...across) - Math.min(...across);
  m.greenShape = { depth: Math.round(depth), width: Math.round(width), angle: Math.round(ang) };
  R_(`  ${h.n} green ${m.greenArea} m2, ${Math.round(depth)} deep x ${Math.round(width)} wide (${(depth / width).toFixed(2)}), long axis ${Math.abs(Math.round(ang))}° ${ang > 8 ? 'right' : ang < -8 ? 'left' : 'straight'} of the approach`);
  if (h.par === 3) p3.push({ n: h.n, yd: h.yards[BACK], plays: playsLike(h.len, m.pinY - m.teeY) });
  // the green's contour: its typical slope, relief beyond its plane, the pin, the pin areas, the cuppable share
  const gs = greenStats(B), feat = gs.relief >= 0.25 ? 'a feature' : 'flatter';
  m.contour = { median: +gs.median.toFixed(1), relief: +gs.relief.toFixed(2), areas: gs.areas.length, cup: Math.round(gs.cup * 100), feat };
  CONT.push({ n: h.n, feat, relief: gs.relief });
  {   // the green diagram's grid: 0.5 m in the approach's frame (up the page = away from the approach)
    const fx = ux, fz = uz, rx = -uz, rz = ux, N = 97, y0 = B.ground(...h.pin), hg = [], gmv = [], sf = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const a = (c - 48) / 2, b = (48 - r) / 2, x = h.pin[0] + a * rx + b * fx, z = h.pin[1] + a * rz + b * fz, g = B.ground(x, z);
      hg.push(g === null ? null : +(g - y0).toFixed(3)); gmv.push(+B.gm(x, z).toFixed(2)); sf.push(SURF.indexOf(B.surface(x, z)));
    }
    const pa = gs.areas.map(q => { const dx = q.x - h.pin[0], dz = q.z - h.pin[1]; return [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; });
    fs.writeFileSync(`${OUT}/green${h.n}.json`, JSON.stringify({ N, step: 0.5, h: hg, gm: gmv, s: sf, areas: pa }));
  }
  const badG = gs.pinSlope > 3 || gs.areas.length < 2 || gs.median < 1 || gs.median > 3;
  R_(`${badG ? '!' : ' '} ${h.n} green contour: typical slope ${gs.median.toFixed(1)}%, ${gs.relief.toFixed(2)} m beyond its plane (${feat}), pin ${gs.pinSlope.toFixed(1)}%, ${gs.areas.length} pin areas, ${Math.round(gs.cup * 100)}% cuppable`);
  // the fairway's lean across the line where drives land: round each fairway target, 30 m either side
  if (h.par > 3) {
    const L = leanAlong(B), ws = [];
    for (const q of (h.targets || []).filter(q => !q.bold)) {
      const s0 = project(h.line, ...q.at).s, v = L.filter(([s]) => Math.abs(s - s0) <= 30).map(x => x[1]);
      if (v.length) ws.push({ name: q.name, lean: v.reduce((a, b) => a + b, 0) / v.length });
    }
    const top = ws.reduce((a, b) => Math.abs(b.lean) > Math.abs(a?.lean ?? 0) ? b : a, null);
    m.lean = ws.map(w => ({ name: w.name, lean: +w.lean.toFixed(1) }));
    LEANS.push({ n: h.n, lean: top ? top.lean : 0 });
    R_(`  ${h.n} fairway lean: ${ws.map(w => `${w.name} ${Math.abs(w.lean).toFixed(1)}% ${w.lean > 0.3 ? 'to the right' : w.lean < -0.3 ? 'to the left' : 'level'}`).join('; ') || 'no targets'}`);
  }
}
const lean2 = LEANS.filter(l => Math.abs(l.lean) >= 2).length, strong = LEANS.filter(l => Math.abs(l.lean) >= 5.5).length;
R_(`${lean2 * 2 > LEANS.length ? ' ' : '!'} fairways leaning 2% or more where drives land: ${lean2} of ${LEANS.length} par 4s and 5s; strong (5.5%+): ${strong}${strong < 1 || strong > 2 ? ' (want one or two)' : ''}`);
const featN = CONT.filter(c => c.feat === 'a feature').length;
R_(`${featN >= 5 ? ' ' : '!'} greens with a feature (0.25 m+ beyond the plane): ${featN} of ${CONT.length}; flatter: ${CONT.filter(c => c.feat !== 'a feature').map(c => c.n).join(', ') || 'none'}`);
for (const q of p3) R_(`  par 3 ${q.n}: ${q.yd} yd, plays like about ${q.plays} yd`);
const pl = p3.map(q => q.plays).sort((a, b) => a - b); for (let j = 1; j < pl.length; j++) if (pl[j] - pl[j - 1] < 25) R_(`! par 3s within ${pl[j] - pl[j - 1]} yd of each other (plays-like)`);
fs.writeFileSync(`${OUT}/checks.txt`, report.join('\n'));
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets, back: BACK, p3 }));
