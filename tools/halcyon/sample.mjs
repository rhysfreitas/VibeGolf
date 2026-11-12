// node tools/halcyon/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), plus the
// course map raster, and the rules checks. Then: python3 plans.py, node sketch.mjs, node book.mjs.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, LOC, WOR } from './scene.mjs';
import { WINDOWS, LAKE, CANAL, AQUEDUCT, SPOKE, CLUBHOUSE, TRAM, TERMINATOR, RIM_GLASS } from './world.mjs';
import { project, at, lengthOf, YD, headingAt } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const PHYS = { fringe: 'fairway', tee: 'fairway', window: 'water', park: 'firstcut', wood: 'rough', garden: 'rough', plaza: 'desert', stone: 'desert', void: 'rough' };

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
  if (h.boldLine) { const [a, b] = h.boldLine, d = Math.atan2(b[0] - a[0], -(b[1] - a[1])), fromTee = Math.hypot(a[0] - back[0], a[1] - back[1]) < 5;
    // a bold line from the tee gets the three drives; one from the fairway (a second-shot choice) only its ground
    bold = { line: h.boldLine, second: !fromTee, prof: along(h.boldLine), drives: fromTee ? Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, d, sh)])) : {} }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 45; x < h.pin[0] + 45; x++) for (let z = h.pin[1] - 45; z < h.pin[1] + 45; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  // the climb and the fall along the line (each run of 1 m or more)
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const labels = [];
  const L_ = (p, t) => labels.push([p, t]);
  for (const f of h.forms || []) if (f.label) L_(f.at, f.label);
  for (const v of h.villas || []) if (v.label) L_([v.at[0] + 26, v.at[1]], v.label);
  for (const f of h.feet || []) if (f.label) L_([f.at[0] + 34, f.at[1] + 22], f.label);
  if (h.bridge) L_([h.bridge.a[0] + 22, h.bridge.a[1]], h.bridge.label);
  for (const w of h.water || []) if (w.label) L_([w.at[0] - 22, w.at[1]], w.label);
  // the station's features labelled where they are in this hole's frame (ring space a, s → world X = a, Z = -s)
  const feats = [...WINDOWS.map(w => [[w.a, -w.s], w.name.replace('The ', 'the ')]), [[-438, -650], 'the rim glass'], [[-430, -1000], 'the lake'], [[-415, -1500], 'the lake'],
    [[-40, -1170], 'the canal'], [[250, -1350], 'the canal'], [[CANAL.lock[0] + 12, -CANAL.lock[1]], 'the lock'], [[370, -1625], 'the aqueduct'], [[CLUBHOUSE.a, -CLUBHOUSE.s - 30], 'the clubhouse'],
    [[TRAM.a + 30, -TRAM.s], 'the tram stop'], [[60, -TERMINATOR + 14], 'the day/night line'], [[60, 40], 'the night side'], [[-410, -455], 'the high terrace'], [[-430, -150], 'the west rim'], [[430, -350], 'the east rim']];
  for (const [wp, t] of feats) { const p = LOC[i](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 170 && pr.s > -60 && pr.s < h.len + 80) L_(p, t); }
  const cr = [];
  const wobjs = [];
  // windows drawn by outline in this hole's frame
  for (const w of WINDOWS) { const P = []; for (let k = 0; k < 64; k++) { const t = k / 64 * 2 * Math.PI, c = Math.cos(w.rot), sn = Math.sin(w.rot), pw = 2 / w.p;
    const u = Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** pw * w.ra, v = Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** pw * w.rs; P.push(LOC[i](w.a + u * c - v * sn, -(w.s + u * sn + v * c))); }
    if (P.some(p => Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) < 500 || Math.hypot(...p) < 400)) wobjs.push({ kind: 'window', pts: P }); }
  meta.push({ tips: h.tipsPt, tipsYards: h.tipsYards, tipsSet: COURSE.tipsSet, cracks: cr, wobjs, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    greenArea: gcells, teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), targets: (h.targets || []).map(t => {
      // the width of fairway straight across the line where the target sits
      const pr = project(h.line, ...t.at); let w = 0;
      if (B.surface(...t.at) === 'fairway') { let a = pr.off, b = pr.off; while (B.surface(...at(h.line, pr.s, a - 0.5)) === 'fairway' && a > pr.off - 120) a -= 0.5; while (B.surface(...at(h.line, pr.s, b + 0.5)) === 'fairway' && b < pr.off + 120) b += 0.5; w = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(w), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    objs: B.objs, prof, drives, bold, words: h.words, card: h.card, shape: h.shape, green: h.green, base: h.base, place: h.place, labels });
}
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets }));

// the course map: the floor's surface and a hillshade from its heights (no curve: height above the cylinder)
const WR = 4, X0 = -470, X1 = 470, Z0 = -1900, Z1 = 100;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y === null ? NaN : v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF,
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])),
    objs: BUILT[i].objs.filter(o => ['villa', 'clubhouse', 'leg', 'wall'].includes(o.kind)).map(o => o.kind === 'wall' ? { kind: 'wall', a: toWorld(h)(o.a[0], o.a[1]), b: toWorld(h)(o.b[0], o.b[1]) } : { kind: o.kind, at: toWorld(h)(o.x, o.z), w: o.w, l: o.l || o.w, rot: o.rot + h.place.heading * Math.PI / 180 }) })),
  windows: WINDOWS, spoke: SPOKE, aqueduct: AQUEDUCT, terminator: TERMINATOR, tram: TRAM, back: BACK }));

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
const lanes = (B, p, dir) => {   // the runs of fairway straight across a direction through p, within 90 m, 6 m or more each
  const nx = Math.cos(dir), nz = Math.sin(dir), out = []; let run = 0;
  for (let a = -90; a <= 90; a += 0.5) { if (B.surface(p[0] + nx * a, p[1] + nz * a) === 'fairway') run += 0.5; else { if (run >= 6) out.push(run); run = 0; } }
  if (run >= 6) out.push(run);
  return out;
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
  // the pad: real ground under 10 x 12 m, level within 1.2 m; 20-50 yd behind the back tee (8-30 on a par 3)
  const hd0 = headingAt(h.line, 1), pc = Math.cos(hd0), ps = Math.sin(hd0), padY = [];
  for (const u of [-5, 0, 5]) for (const v of [-6, 0, 6]) padY.push(B.ground(t[0] + u * pc - v * ps, t[1] + u * ps + v * pc));
  const padOk = padY.every(y => y !== null) && Math.max(...padY) - Math.min(...padY) <= 1.2, behind = h.tipsYards - h.yards[BACK];
  const lenOk = h.par === 3 ? behind >= 8 && behind <= 30 : behind >= 20 && behind <= 50;
  let land = '', landOk = true;
  if (h.par > 3) {   // a tips drive (tipsSet.minDrive, 290 yd) down the line from the tips spot (behind the tee, so s < 0): 40 m or more of fairway where it lands
    const L0 = h.line, sl0 = Math.hypot(L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]), tsl = ((t[0] - L0[0][0]) * (L0[1][0] - L0[0][0]) + (t[1] - L0[0][1]) * (L0[1][1] - L0[0][1])) / sl0, c = COURSE.tipsSet?.minDrive || 290, s = Math.min(h.len - 1, tsl + c * YD);
    // down the line, and toward the first target where there is one (as tools/review/tips.mjs measures it): the
    // better of the two, with lanes counted as the landing check counts them (40 m, or two lanes of 25 m)
    const aim = (h.targets || []).find(q => !q.bold), cands = [[at(h.line, s), headingAt(h.line, s)]];
    if (aim) { const dx = aim.at[0] - t[0], dz = aim.at[1] - t[1], l = Math.hypot(dx, dz); cands.push([[t[0] + dx / l * c * YD, t[1] + dz / l * c * YD], Math.atan2(dx, -dz)]); }
    const meas = cands.map(([p, dir]) => { const ln = lanes(B, p, dir); return { p, ln, ok: Math.max(0, ...ln) >= 40 || ln.filter(v => v >= 25).length >= 2 }; });
    const best = meas.find(m => m.ok) || meas[0], sf = B.surface(...best.p);
    land = ` ${c} yd drive: ${sf}, lanes ${best.ln.map(Math.round).join(' + ') || 'none'} m;`; landOk = best.ok;
  }
  const okT = !['void', 'water', 'window', 'green', 'fairway', 'stone'].includes(ts) && padOk && lenOk && nearG > 35 && nearF >= 12 && !over.length && landOk;
  R_(`${okT ? ' ' : '!'} ${h.n} tips ${h.tipsYards} yd (+${behind}): ${ts}, pad ${padOk ? 'level' : 'NOT LEVEL'} (${(Math.max(...padY.filter(y => y !== null)) - Math.min(...padY.filter(y => y !== null))).toFixed(1)} m), ${nearF === Infinity ? '16+' : nearF} m off fairway, nearest other green ${Math.round(nearG)} m${over.length ? ', OVERHEAD' : ''};${land}`);
  // every tee set's drive lands on 40 m or more of fairway: the fairway across the line at the drive's length
  // (minDrive, or 150 yd for the forward set) from that tee
  if (h.par > 3) {
    const ws = [];
    for (const T of COURSE.teeSets) {
      const s0 = project(h.line, ...h.teePts[T.id]).s, s = Math.min(h.len - 20, s0 + (T.minDrive || 150) * YD), p = at(h.line, s), dir = headingAt(h.line, s);
      // straight across the line there: one fairway 40 m or more wide, or (where a tree or a bluff splits it)
      // two lanes 25 m or more each
      const ln = lanes(B, p, dir), wide = Math.max(0, ...ln), ok = wide >= 40 || ln.filter(v => v >= 25).length >= 2;
      ws.push(`${T.name} ${ln.length > 1 ? ln.map(Math.round).join('+') : Math.round(wide)}`);
      if (!ok) R_(`! ${h.n} ${T.name} drive (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, lanes ${ln.map(Math.round).join(', ') || 'none'} m`);
    }
    R_(`  ${h.n} landing widths (m): ${ws.join(', ')}`);
  }
  // fairway bunkers touch the fairway; greenside ones sit off the green
  // (church pews are one hazard: its rungs count together, and the band touches the fairway where it crosses it)
  const touchOf = b => { let t = Infinity; const ins = B.inBunker(b); for (let x = b.box[0]; x < b.box[2]; x += 1.5) for (let z = b.box[1]; z < b.box[3]; z += 1.5) if (ins(x, z)) t = Math.min(t, Math.max(0, B.fairwayD(x, z))); return t; };
  const rungs = B.bunkers.filter(b => b.job === 'pews');
  if (rungs.length) { const t = Math.min(...rungs.map(touchOf)), into = rungs.filter(b => touchOf(b) <= 0).length;
    R_(`${t > 2 ? '!' : ' '} ${h.n} the church pews (${rungs.length} rungs) ${t > 2 ? 'are ' + t.toFixed(0) + ' m off the fairway' : 'touch the fairway; ' + into + ' rungs cut into it'}`); }
  for (const [j, b] of B.bunkers.entries()) {
    if (b.side || b.pot || b.job === 'pews') continue;
    const touch = touchOf(b);
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
  if (h.par === 3) p3.push({ n: h.n, yd: h.yards[BACK], plays: playsLike(h.yards[BACK] * YD, m.pinY - m.teeY) });
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
  const badG = gs.pinSlope > 3 || gs.areas.length < 2 || gs.median < 1 || gs.median > 3 || gs.pieces !== 1 || gs.pinIn < 3;
  R_(`${badG ? '!' : ' '} ${h.n} green contour: typical slope ${gs.median.toFixed(1)}%, ${gs.relief.toFixed(2)} m beyond its plane (${feat}), pin ${gs.pinSlope.toFixed(1)}%, ${gs.areas.length} pin areas, ${Math.round(gs.cup * 100)}% cuppable${gs.pieces !== 1 ? `, IN ${gs.pieces} PIECES` : ''}${gs.pinIn < 3 ? `, the pin ${gs.pinIn < 0 ? 'OFF the green' : gs.pinIn.toFixed(1) + ' m inside the edge'}` : ''}`);
  // the fairway's lean across the line where drives land: round each fairway target, 30 m either side
  if (h.par > 3) {
    const ws = [];
    for (const q of (h.targets || []).filter(q => !q.bold)) {   // round the target, at its own offset (a lane)
      const pq = project(h.line, ...q.at), v = leanAlong(B, pq.s - 30, pq.s + 30, 12, pq.off).map(x => x[1]);
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
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets, back: BACK, p3 }));

// the tee view with the game's camera (3.2 m behind the ball, 1.55 m up): is the tee shot's target in sight, and
// on a window hole how much of the glass shows (on a par 3 the flag, 2.4 m up, is enough). A point is in sight when no ground between the eye and it rises
// above the straight line to it (sampled every metre); the target counts when its spot or ground within 5 m of it shows
import { inWindow } from './world.mjs';
const sightOf = (B, eye, p, lift = 0.2) => { const y = B.ground(...p) + lift, dx = p[0] - eye[0], dz = p[1] - eye[1], L = Math.hypot(dx, dz);
  for (let d = 2; d < L - 1; d += 1) { const t = d / L, x = eye[0] + dx * t, z = eye[1] + dz * t, gy = B.ground(x, z), ry = eye[2] + (y - eye[2]) * t; if (gy > ry + 0.05) return false;
    for (const [y0, y1, what] of B.solids(x, z)) if (what !== 'a tree' && ry > y0 && ry < y1) return false; } return true; };   // ground, walls, villas and the spoke's feet block the view (trees don't)
const VIEWS = {};
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], first = (h.targets || []).find(t => !t.bold), aimAt = h.par === 3 ? h.pin : (first ? first.at : h.pin), out = [];
  for (const T of COURSE.teeSets) {
    const tp = h.teePts[T.id]; if (!tp) continue;
    const dx = aimAt[0] - tp[0], dz = aimAt[1] - tp[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, eye = [tp[0] - ux * 3.2, tp[1] - uz * 3.2, B.ground(...tp) + 1.55];
    const seen = h.par === 3 ? (sightOf(B, eye, aimAt, 2.4) ? (sightOf(B, eye, aimAt) ? 'in sight' : 'the flag in sight') : 'BLIND') : ([[0, 0], ...[0, 1, 2, 3, 4, 5, 6, 7].map(k => [5 * Math.cos(k * Math.PI / 4), 5 * Math.sin(k * Math.PI / 4)])].some(([ox, oz]) => sightOf(B, eye, [aimAt[0] + ox, aimAt[1] + oz])) ? 'in sight' : 'BLIND');
    let wTot = 0, wSeen = 0;
    for (let x = -60; x <= 60; x += 3) for (let z = -60; z <= 60; z += 3) { const p = [tp[0] + ux * (L / 2) + x, tp[1] + uz * (L / 2) + z], [X, Z] = WOR[i](...p);
      if (Math.hypot(p[0] - tp[0], p[1] - tp[1]) > L + 20 || !inWindow(X, -Z) || inWindow(X, -Z).rim) continue; wTot++; if (sightOf(B, eye, p, 0)) wSeen++; }
    out.push(`${T.name} ${seen}${wTot ? `, window ${Math.round(100 * wSeen / wTot)}% in sight` : ''}`);
  }
  const blind = out.some(o => o.includes('BLIND')) || out.some(o => /window (\d+)%/.test(o) && +o.match(/window (\d+)%/)[1] < 60);
  VIEWS[h.n] = { to: h.par === 3 ? 'the pin' : first ? first.name : 'the pin', sets: out };
  R_(`${blind ? '!' : ' '} ${h.n} tee view (game camera) to ${h.par === 3 ? 'the pin' : first ? first.name : 'the pin'}: ${out.join('; ')}`);
}
fs.writeFileSync(path.join(OUT, 'checks.txt'), report.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'views.json'), JSON.stringify(VIEWS));
