// node tools/wreckersreach/sample.mjs : grids, profiles and drive arcs for the plan book (out/grid/), the course
// map raster, and the rules checks (out/grid/checks.txt; a line starting ! breaks a rule). Then: python3 plans.py,
// node sketch.mjs, node book.mjs. Every number here is flown with the game's physics on the links surfaces
// (Rhys's picks, 14 November 2026: the fairway runs, a pot caps a shot at about 85 yd, a tussock is a hack out).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK, FRONT } from './holes.mjs';
import { BUILT, SURF, toWorld, worldAt, WL, LOC, WOR, PROPS } from './scene.mjs';
import { LABELS, SITES, DGREEN, dgE, CAULDRON, waterAt } from './world.mjs';
import { project, at, lengthOf, YD, headingAt } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { windVector, windInShot } from '../../src/course/conditions.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), lap = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
// each tee set's drive (about its minDrive in still air on firm turf, or 150 yd carry for the forward set)
const SET_DRIVE = { galleon: { Speed: 150, VLA: 12, TotalSpin: 3000 }, frigate: { Speed: 138, VLA: 12.5, TotalSpin: 3000 }, brig: { Speed: 126, VLA: 13, TotalSpin: 3100 }, lugger: { Speed: 108, VLA: 14, TotalSpin: 3300 } };
// the game's surfaces on this course (main.js maps fairway, tee and fringe to 'links' on COURSE.turf = 'links')
const PHYS = { fairway: 'links', fringe: 'links', tee: 'links', fescue: 'rough', dune: 'sand', tussock: 'tussock', beach: 'beach', pot: 'pot', wreck: 'desert', stone: 'desert', void: 'rough' };
// the signature wind: the Sea wind, 14-20 mph from the south-west; checked at 17
const SIG_WIND = { mph: 17, from: 225 };
const ord = n => n + (['st', 'nd', 'rd'][n - 1] || 'th');

// a drive from p along direction dir (radians from -z in the hole's frame, + right), optionally with the wind:
// the flight, where it lands and rests, and where it first meets anything solid above the ground
function drive(B, p, dir, shot, wind = null) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = B.ground(p[0], p[1]) ?? 0;
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const wv = wind ? windInShot(windVector(wind, B.h.place.heading), dir) : null;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = B.ground(...W(lx, lz)); return g === null ? null : g - y0; },
    surfaceAt: (lx, lz) => { const v = B.surface(...W(lx, lz)); return PHYS[v] || v; },
    voidY: -80, altFt: COURSE.altFt, wind: wv,
  });
  let hit = null; const pts = [];
  for (const q of r.pts) {
    const [x, z] = W(q.p[0], q.p[2]), y = y0 + q.p[1], d = Math.hypot(x - p[0], z - p[1]);
    if (!hit) for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hit = { d, y, what }; break; }
    pts.push([+d.toFixed(1), +y.toFixed(2), q.phase === 'flight' ? 0 : 1]);
  }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]), [lx, lz] = W(land.p[0], land.p[2]);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), hit, rest: B.surface(ex, ez), end: [ex, ez], land: [lx, lz], latLand: land.p[0], latEnd: end.p[0] };
}

const meta = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 140;
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
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, dir0, sh)]));
  if (h.par > 3) drives.windy = drive(B, back, dir0, DRIVES.mid, SIG_WIND);
  let bold = null;
  if (h.boldLine) { const [a, b] = h.boldLine, d = Math.atan2(b[0] - a[0], -(b[1] - a[1])); bold = { line: h.boldLine, prof: along(h.boldLine), drives: Object.fromEntries(Object.entries(DRIVES).map(([k, sh]) => [k, drive(B, back, d, sh)])) }; }
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 70; x < h.pin[0] + 70; x++) for (let z = h.pin[1] - 70; z < h.pin[1] + 70; z++) if (B.gm(x + 0.5, z + 0.5) < 0) n++; return n; })();
  const prof = along(h.line), ys = prof.map(p => p[1]).filter(v => v !== null);
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const labels = [];
  const L_ = (p, t) => labels.push([p, t]);
  for (const f of h.forms || []) if (f.label) L_(f.world ? h.L(...f.world) : f.at, f.label);
  for (const o of B.objs) if (o.label && o.hole === i) L_([o.x + 18, o.z], o.label);
  for (const [wp, t] of LABELS) { const p = LOC[i](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 150 && pr.s > -60 && pr.s < h.len + 110) L_(p, t); }
  meta.push({ tips: h.tipsPt, tipsYards: h.tipsYards, tipsSet: COURSE.tipsSet, n: h.n, name: h.name, par: h.par, yards: h.yards, x0, z0, W, H, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    greenArea: gcells, sharedGreen: !!h.green.shared, teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), targets: (h.targets || []).map(t => {
      const pr = project(h.line, ...t.at); let w = 0;
      if (B.surface(...t.at) === 'fairway') { let a = pr.off, b = pr.off; while (B.surface(...at(h.line, pr.s, a - 0.5)) === 'fairway' && a > pr.off - 120) a -= 0.5; while (B.surface(...at(h.line, pr.s, b + 0.5)) === 'fairway' && b < pr.off + 120) b += 0.5; w = b - a; }
      return { name: t.name, p: t.at, bold: !!t.bold, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: Math.round(w), toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) };
    }),
    objs: B.objs.map(o => ({ kind: o.kind, x: o.x, z: o.z, w: o.w, l: o.l, h: o.h, r: o.r, rot: o.rot, base: o.base, label: o.label, wall: o.wall, sunk: o.sunk, lean: o.lean })),
    pots: B.bunkers.map(b => ({ x: b.x, z: b.z, r: b.rx, relic: b.relic || null })),
    prof, drives, bold, words: h.words, card: h.card, shape: h.shape, green: h.green.shared ? { shared: true, style: 'One end of the double green it shares with the ' + (h.n === 2 ? '8th' : '2nd') + ': about 105 × 40 m, two flags, each half falling 1.6% toward its own hole, a swale 0.3 m deep between them' } : h.green, base: h.base, place: h.place, labels });
  lap(`hole ${h.n} sampled`);
}

// the course map: the world's surface and a hillshade from its heights
const WR = 4, X0 = -330, X1 = 420, Z0 = -1930, Z1 = 60;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR), ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) {
  const v = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR);
  ms[r * MW + c] = SURF.indexOf(v.s); mh[r * MW + c] = v.y;
}
fs.writeFileSync(`${OUT}/world.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, labels: LABELS, props: PROPS.filter(p => p.at).map(p => ({ kind: p.kind, at: p.at, w: p.w, l: p.l, h: p.h, r: p.r, rot: p.wrot })),
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, par: h.par, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([k, p]) => [k, toWorld(h)(...p)])) })), back: BACK }));
lap('course map');

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.n} ${m.name.padEnd(20)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what + ' @' + Math.round(v.hit.d) : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([k, v]) => `${k} ${Math.round(v.carry / YD)}/${Math.round(v.total / YD)}yd ${v.rest}${v.hit ? ' HIT ' + v.hit.what : ''}`).join(' · ') : '');
  console.log('    green', m.greenArea, 'm2; targets', m.targets.map(t => `${t.name} ${t.d}yd ${t.surf} ${t.width}m`).join(' · '));
}
console.log('total', meta.reduce((a, m) => a + m.yards[BACK], 0), 'yd; par', meta.reduce((a, m) => a + m.par, 0));

// ---- the checks
const report = [];
const R_ = (...a) => { const l = a.join(' '); report.push(l); console.log(l); };
const fwWidth = (B, p, dir) => {
  if (B.surface(...p) !== 'fairway') return 0;
  const nx = Math.cos(dir), nz = Math.sin(dir); let a = 0, b = 0;
  while (a > -120 && B.surface(p[0] + nx * (a - 0.5), p[1] + nz * (a - 0.5)) === 'fairway') a -= 0.5;
  while (b < 120 && B.surface(p[0] + nx * (b + 0.5), p[1] + nz * (b + 0.5)) === 'fairway') b += 0.5;
  return b - a;
};
const lanes = (B, p, dir) => {
  const nx = Math.cos(dir), nz = Math.sin(dir), out = []; let run = 0;
  for (let a = -90; a <= 90; a += 0.5) { if (B.surface(p[0] + nx * a, p[1] + nz * a) === 'fairway') run += 0.5; else { if (run >= 6) out.push(run); run = 0; } }
  if (run >= 6) out.push(run);
  return out;
};
// pins at 3% or less; tees 12 m off the fairway; nothing overhead within 45 m of a tee
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; R_(`${sl > 3 ? '!' : ' '} ${h.n} pin slope ${sl.toFixed(1)}%`);
  for (const [k, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 14; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) R_(`! ${h.n} ${k} tee: fairway ${near} m away (12 m wanted)`);
    const sf = B.surface(...p); if (sf !== 'tee') R_(`! ${h.n} ${k} tee pad reads ${sf}`);
    for (const [a] of B.solids(...p)) if (a - B.ground(...p) < 45) R_(`! ${h.n} ${k} tee: something overhead ${(a - B.ground(...p)).toFixed(0)} m up`);
  }
}
lap('pins and tees');
function playsLike(dist, dh) {
  let best = null;
  for (let mph = 60; mph <= 160; mph += 1) {
    const sh = { Speed: mph, VLA: 26 - mph * 0.08, TotalSpin: 8800 - mph * 32, HLA: 0, SpinAxis: 0 };
    const flat = simulate(sh, { groundAt: () => 0, surfaceAt: () => 'links', altFt: COURSE.altFt, flightOnly: true });
    const drop = simulate(sh, { groundAt: (x, z) => Math.hypot(x, z) > 25 ? dh : 0, surfaceAt: () => 'links', altFt: COURSE.altFt, voidY: -200, flightOnly: true });
    if (!flat.landed || !drop.landed) continue;
    if (drop.carry * YD >= dist) { best = flat.carry; break; }
  }
  return best && Math.round(best);
}
const p3 = [], CONT = [], LEANS = [];
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], m = meta[i], back = h.teePts[BACK];
  // the tips spot
  const t = h.tipsPt, ts = B.surface(...t), tg = B.ground(...t);
  let nearG = Infinity; const tw = toWorld(h)(...t);
  for (const [k, H] of HOLES.entries()) if (k !== i) { const g = toWorld(H)(...H.pin); nearG = Math.min(nearG, Math.hypot(g[0] - tw[0], g[1] - tw[1])); }
  let nearF = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 16; r++) if (B.surface(t[0] + Math.cos(a) * r, t[1] + Math.sin(a) * r) === 'fairway') nearF = Math.min(nearF, r);
  const over = B.solids(...t).filter(([a]) => a - tg < 45);
  const hd0 = headingAt(h.line, 1), pc = Math.cos(hd0), ps = Math.sin(hd0), padY = [];
  for (const u of [-5, 0, 5]) for (const v of [-6, 0, 6]) padY.push(B.ground(t[0] + u * pc - v * ps, t[1] + u * ps + v * pc));
  const padOk = Math.max(...padY) - Math.min(...padY) <= 1.2, behind = h.tipsYards - h.yards[BACK];
  const lenOk = h.par === 3 ? behind >= 8 && behind <= 30 : behind >= 20 && behind <= 50;
  let land = '', landOk = true;
  if (h.par > 3) {
    const c = COURSE.tipsSet.minDrive, tsl = project(h.line, ...t).s - (project(h.line, ...t).s <= 0.01 ? Math.hypot(t[0] - h.line[0][0], t[1] - h.line[0][1]) : 0), s = Math.min(h.len - 1, tsl + c * YD);
    const aim = (h.targets || []).find(q => !q.bold), cands = [[at(h.line, s), headingAt(h.line, s)]];
    if (aim) { const dx = aim.at[0] - t[0], dz = aim.at[1] - t[1], l = Math.hypot(dx, dz); cands.push([[t[0] + dx / l * c * YD, t[1] + dz / l * c * YD], Math.atan2(dx, -dz)]); }
    const meas = cands.map(([p, dir]) => { const ln = lanes(B, p, dir); return { p, ln, ok: Math.max(0, ...ln) >= 40 || ln.filter(v => v >= 25).length >= 2 }; });
    const best = meas.find(q => q.ok) || meas[0];
    land = ` ${c} yd drive: ${B.surface(...best.p)}, lanes ${best.ln.map(Math.round).join(' + ') || 'none'} m;`; landOk = best.ok || ((h.tight || h.layUp) && Math.max(0, ...best.ln) >= 30);
  }
  const okT = !['water', 'green', 'fairway', 'pot', 'tussock'].includes(ts) && padOk && lenOk && nearG > 35 && nearF >= 12 && !over.length && landOk;
  R_(`${okT ? ' ' : '!'} ${h.n} tips ${h.tipsYards} yd (+${behind}): ${ts}, pad ${padOk ? 'level' : 'NOT LEVEL'} (${(Math.max(...padY) - Math.min(...padY)).toFixed(1)} m), ${nearF === Infinity ? '16+' : nearF} m off fairway, nearest other green ${Math.round(nearG)} m${over.length ? ', OVERHEAD' : ''};${land}`);
  // every tee set's drive lands on 40 m or more of fairway; on the 3rd (a drivable par 4 whose forward tees lay up)
  // each set's lay-up short of the hollow
  if (h.par > 3) {
    const ws = [];
    for (const T of COURSE.teeSets) {
      const s0 = project(h.line, ...h.teePts[T.id]).s; let s = Math.min(h.len - 20, s0 + (T.minDrive || 150) * YD);
      if (h.layUp) s = Math.min(s, 176);
      const p = at(h.line, s), dir = headingAt(h.line, s), ln = lanes(B, p, dir), wide = Math.max(0, ...ln), ok = wide >= 40 || ln.filter(v => v >= 25).length >= 2;
      ws.push(`${T.name} ${ln.length > 1 ? ln.map(Math.round).join('+') : Math.round(wide)}`);
      if (!ok && h.tight && T.id === BACK && wide >= 30) { R_(`  ${h.n} ${T.name} drive lands on ${Math.round(wide)} m: the nine's tight fairway (the neck), the valley's banks soft on both sides`); continue; }
      if (!ok) R_(`! ${h.n} ${T.name} ${h.layUp ? 'lay-up' : 'drive'} (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, lanes ${ln.map(Math.round).join(', ') || 'none'} m`);
    }
    R_(`  ${h.n} landing widths (m): ${ws.join(', ')}${h.layUp ? ' (each set\'s lay-up short of the hollow)' : ''}`);
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
  R_(`  ${h.n} green ${m.greenArea} m2${h.green.shared ? ' (the double green)' : ''}, ${Math.round(depth)} deep x ${Math.round(width)} wide (${(depth / width).toFixed(2)}), long axis ${Math.abs(Math.round(ang))}° ${ang > 8 ? 'right' : ang < -8 ? 'left' : 'straight'} of the approach`);
  if (h.par === 3) p3.push({ n: h.n, yd: h.yards[BACK], plays: playsLike(Math.hypot(back[0] - h.pin[0], back[1] - h.pin[1]), m.pinY - m.teeY) });
  const gs = greenStats(B, { r: 4 }), feat = gs.relief >= 0.25 ? 'a feature' : 'flatter';
  m.contour = { median: +gs.median.toFixed(1), relief: +gs.relief.toFixed(2), areas: gs.areas.length, cup: Math.round(gs.cup * 100), feat };
  CONT.push({ n: h.n, feat, relief: gs.relief });
  {   // the green diagram's grid: 0.5 m in the approach's frame (up the page = away from the approach); 64 m across for the double green
    const fx = ux, fz = uz, rx = -uz, rz = ux, N = h.green.shared ? 257 : 97, half = (N - 1) / 2, y0 = B.ground(...h.pin), hg = [], gmv = [], sf = [];
    const gc0 = h.green.shared ? toCentre(h, B) : [0, 0];   // the double green: centred on the green, not the pin
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const a = (c - half) / 2, b = (half - r) / 2, x = h.pin[0] + gc0[0] + a * rx + b * fx, z = h.pin[1] + gc0[1] + a * rz + b * fz, g = B.ground(x, z);
      hg.push(+(g - y0).toFixed(3)); gmv.push(+B.gm(x, z).toFixed(2)); sf.push(SURF.indexOf(B.surface(x, z)));
    }
    const gc = gc0;
    const pa = gs.areas.map(q => { const dx = q.x - h.pin[0] - gc[0], dz = q.z - h.pin[1] - gc[1]; return [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; });
    const pinAt = [+(-gc[0] * rx - gc[1] * rz).toFixed(1), +(-gc[0] * fx - gc[1] * fz).toFixed(1)];
    let other = null; if (h.green.shared) { const o = LOC[i](...DGREEN.pins[h.n === 2 ? 8 : 2]), dx = o[0] - h.pin[0] - gc[0], dz = o[1] - h.pin[1] - gc[1]; other = [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; }
    fs.writeFileSync(`${OUT}/green${h.n}.json`, JSON.stringify({ N, step: 0.5, h: hg, gm: gmv, s: sf, areas: pa, pin: pinAt, other, shared: !!h.green.shared }));
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
    m.lean = ws.map(w => ({ name: w.name, lean: +w.lean.toFixed(1) }));
    LEANS.push({ n: h.n, lean: top ? top.lean : 0 });
    R_(`  ${h.n} fairway lean: ${ws.map(w => `${w.name} ${Math.abs(w.lean).toFixed(1)}% ${w.lean > 0.3 ? 'to the right' : w.lean < -0.3 ? 'to the left' : 'level'}`).join('; ') || 'no targets'}`);
  }
  lap(`hole ${h.n} checked`);
}
// the double green's centre relative to a hole's pin, in the hole's frame
function toCentre(h, B) { const xs = [], zs = []; for (let x = h.pin[0] - 70; x < h.pin[0] + 70; x += 1) for (let z = h.pin[1] - 70; z < h.pin[1] + 70; z += 1) if (B.gm(x, z) < 0) { xs.push(x); zs.push(z); } return [xs.reduce((a, b) => a + b, 0) / xs.length - h.pin[0], zs.reduce((a, b) => a + b, 0) / zs.length - h.pin[1]]; }
const lean2 = LEANS.filter(l => Math.abs(l.lean) >= 2).length;
R_(`  fairways leaning 2% or more where drives land: ${lean2} of ${LEANS.length} (a links: humps and hollows more than leans)`);
const featN = CONT.filter(c => c.feat === 'a feature').length;
R_(`${featN >= 5 ? ' ' : '!'} greens with a feature (0.25 m+ beyond the plane): ${featN} of ${CONT.length}; flatter: ${CONT.filter(c => c.feat !== 'a feature').map(c => c.n).join(', ') || 'none'}`);
for (const q of p3) R_(`  par 3 ${q.n}: ${q.yd} yd, plays like about ${q.plays} yd in still air`);
const pl = p3.map(q => q.plays).sort((a, b) => a - b); for (let j = 1; j < pl.length; j++) if (pl[j] - pl[j - 1] < 25) R_(`! par 3s within ${pl[j] - pl[j - 1]} yd of each other (plays-like)`);

// ---- the tee view through the game's fixed camera (3.2 m behind the ball, 1.55 m up; the frame shows 19° above
// level to 31° below): each tee set's target (the flag on a par 3; the lip and its marker on a table top)
const EYE = 1.55, BACKC = 3.2, PX = 40 * 250 / 22;
function sight(B, from, to, toY) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]), ux = (to[0] - from[0]) / d, uz = (to[1] - from[1]) / d;
  const eye = [from[0] - ux * BACKC, from[1] - uz * BACKC], ey = B.ground(...from) + EYE, D = d + BACKC, ang = Math.atan2(toY - ey, D) * 180 / Math.PI;
  let hid = null;
  for (let t = 4; t < D - 3 && !hid; t += 2) { const x = eye[0] + ux * t, z = eye[1] + uz * t, y = ey + (toY - ey) * t / D, g = B.ground(x, z);
    if (g !== null && g > y + 0.05) hid = `the ground ${Math.round(t)} m out`; else for (const [a, b, what] of B.solids(x, z)) if (y > a && y < b) { hid = what; break; } }
  return { ang, inFrame: ang <= 19 && ang >= -31, hid, d, ey };
}
// how tall a thing stands on a phone from a point: the part of it above whatever hides its foot
function shows(B, from, o) {
  // aim at the near face, so the thing itself doesn't count as hiding itself
  const top = o.base + o.h, dd = Math.hypot(o.x - from[0], o.z - from[1]), back = (o.w ? Math.max(o.w, o.l) / 2 : o.r || 0) + 1.5;
  const face = [o.x - (o.x - from[0]) / dd * back, o.z - (o.z - from[1]) / dd * back]; let vis = top;
  for (let y = top; y >= o.base; y -= 0.5) { if (sight(B, from, face, y).hid) break; vis = y; }
  const d = Math.hypot(o.x - from[0], o.z - from[1]) + BACKC;
  return { px: Math.round(PX * (top - vis) / d), d: Math.round(d), seen: top - vis };
}
let blind = 0;
for (const [i, B] of BUILT.entries()) {
  const h = HOLES[i], out = [];
  for (const T of COURSE.teeSets) {
    const tee = h.teePts[T.id]; let to, toY, what;
    if (h.par === 3) { to = h.pin; toY = B.ground(...h.pin) + 2.1; what = 'the flag'; }
    else if (h.table) { to = at(h.line, h.table.s0 + h.table.face / 2 + 2, 0); toY = B.ground(...to) + 0.3; what = 'the lip'; }
    else { const q = (h.targets || []).find(q => !q.bold); to = q.at; toY = B.ground(...to) + 0.3; what = q.name; }
    const S = sight(B, tee, to, toY), ok = S.inFrame && !S.hid;
    out.push(`${T.name} ${ok ? 'sees' : 'CANNOT SEE'} ${what} (${S.ang.toFixed(1)}°${S.hid ? ', behind ' + S.hid : ''})`);
    if (!ok && T.id === BACK) { if (h.n === 6) R_(`  ${h.n} ${T.name} tee: ${what} hidden by ${S.hid} (the Dell: blind on purpose, the mast marks it)`); else { R_(`! ${h.n} ${T.name} tee: ${what} is ${S.hid ? 'hidden by ' + S.hid : 'out of the frame'} (${S.ang.toFixed(1)}°)`); } blind++; }
    else if (!ok && h.n !== 6) R_(`! ${h.n} ${T.name} tee: ${what} is ${S.hid ? 'hidden by ' + S.hid : 'out of the frame'} (${S.ang.toFixed(1)}°)`);
  }
  R_(`  ${h.n} tee view: ${out.join('; ')}`);
  const bt = (h.targets || []).find(q => q.bold);
  if (bt && h.table) { const lp = at(h.line, h.table.s0 + h.table.face / 2 + 2), S = sight(B, h.teePts[BACK], lp, B.ground(...lp) + 0.3); R_(`${S.inFrame && !S.hid ? ' ' : '!'} ${h.n} bold target "${bt.name}" is on the table top: from the ${COURSE.teeSets[0].name} tee its lip is ${S.hid ? 'hidden by ' + S.hid : 'in sight'} (${S.ang.toFixed(1)}°), the bell on it (a table top with a marker: not blind)`); }
  else if (bt) { const S = sight(B, h.teePts[BACK], bt.at, B.ground(...bt.at) + 0.3); R_(`${S.inFrame && !S.hid ? ' ' : '!'} ${h.n} bold target "${bt.name}" from the ${COURSE.teeSets[0].name} tee: ${S.hid ? 'hidden by ' + S.hid : 'in sight'} (${S.ang.toFixed(1)}°)`); }
}
// blind approaches: the 9th's low road (on purpose); every other second shot sees its flag
let blindA = 0;
for (const [i, B] of BUILT.entries()) { const h = HOLES[i]; if (h.par === 3) continue;
  for (const q of h.targets || []) { const S = sight(B, q.at, h.pin, B.ground(...h.pin) + 2.1), d = Math.hypot(q.at[0] - h.pin[0], q.at[1] - h.pin[1]);
    if (d > 260) continue;
    if (S.hid) { blindA++; R_(`${h.n === 9 && q.name === 'The low road' ? ' ' : '!'} ${h.n} from "${q.name}" the flag is hidden by ${S.hid}${h.n === 9 && q.name === 'The low road' ? ' (the low road: blind on purpose, over the table\'s shoulder)' : ''}`); } } }
R_(`${blind + blindA <= 2 ? ' ' : '!'} blind shots: ${blind} from the back tees, ${blindA} approaches (two a nine at most: the Dell and the 9th's low road)`);
lap('views');

// ---- the brief's look-at-first list
const wpt = (k, p) => WOR[k](...p), wd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// two holes sharing ground: the same height and surface for both, wherever both see it
{
  let dmax = 0, sdiff = 0, n = 0;
  for (const [a, b, X0s, X1s, Z0s, Z1s] of [[0, 8, -10, 110, -400, -205], [1, 7, 0, 120, -762, -712]]) for (let k = 0; k < 400; k++) {
    const X = X0s + Math.random() * (X1s - X0s), Z = Z0s + Math.random() * (Z1s - Z0s), pa = LOC[a](X, Z), pb = LOC[b](X, Z);
    const ga = BUILT[a].ground(...pa) + BUILT[a].base, gb = BUILT[b].ground(...pb) + BUILT[b].base;
    dmax = Math.max(dmax, Math.abs(ga - gb)); if (BUILT[a].surface(...pa) !== BUILT[b].surface(...pb)) sdiff++; n++;
  }
  R_(`${dmax < 0.01 && !sdiff ? ' ' : '!'} shared ground: the 1st and 9th, and the 2nd and 8th, read ${dmax.toFixed(3)} m apart at most and ${sdiff} of ${n} points with a different surface`);
  const g2 = LOC[1](...DGREEN.pins[2]), g8 = LOC[7](...DGREEN.pins[8]), on = [BUILT[1].surface(...g2), BUILT[7].surface(...g8)];
  let area = 0; for (let X = -40; X < 160; X++) for (let Z = -800; Z < -680; Z++) if (dgE(X + 0.5, Z + 0.5) < 0) area++;
  R_(`  the double green: ${area} m2, the 2nd's pin and the 8th's ${Math.round(wd(DGREEN.pins[2], DGREEN.pins[8]))} m apart, both on ${[...new Set(on)].join('/')}; each hole carries its own pin (hole.pin), one green outline (the emitter writes it into both holes)`);
}
// width in a cross wind: each tee set's drive with the signature wind (17 mph from the south-west), aimed off for
// the drift as a player would; where a straight one finishes, and where one a standard deviation off line does
// (start 3°, spin axis 6.5°), against the fairway there
{
  const wa = [];
  for (const [i, B] of BUILT.entries()) {
    const h = HOLES[i]; if (h.par === 3 || h.layUp) continue;
    const parts = [];
    for (const T of COURSE.teeSets) {
      const tee = h.teePts[T.id], q = (h.targets || []).find(q => !q.bold) || { at: at(h.line, 220) }, aim = Math.atan2(q.at[0] - tee[0], -(q.at[1] - tee[1]));
      const sh = SET_DRIVE[T.id], c0 = drive(B, tee, aim, sh, SIG_WIND);
      // aim off: turn the start so the straight one finishes on the aim's line
      const off0 = c0.latEnd, dist = c0.total, turn = Math.atan2(-off0, dist), dir = aim + turn;
      const ctr = drive(B, tee, dir, sh, SIG_WIND);
      const lo = drive(B, tee, dir, { ...sh, HLA: -3, SpinAxis: -6.5 }, SIG_WIND), hi = drive(B, tee, dir, { ...sh, HLA: 3, SpinAxis: 6.5 }, SIG_WIND);
      const spread = Math.abs(hi.latEnd - lo.latEnd), p = ctr.end, wdt = fwWidth(B, p, aim + Math.PI / 2 - Math.PI / 2 + 0) || Math.max(0, ...lanes(B, p, Math.atan2(p[0] - tee[0], -(p[1] - tee[1]))));
      const fin = [lo, ctr, hi].map(r => r.rest), wet_ = fin.filter(s => s === 'water').length;
      parts.push(`${T.name} drifts ${Math.abs(Math.round(off0))} m, aims off ${Math.abs(Math.round(turn * 180 / Math.PI))}°, ±1σ ${Math.round(spread)} m on ${Math.round(wdt)} m (${fin.join('/')})`);
      if (wet_) R_(`! ${h.n} ${T.name}: a drive a standard deviation off line in the signature wind finishes in the water`);
    }
    wa.push(`  ${h.n} cross wind: ${parts.join('; ')}`);
  }
  for (const l of wa) R_(l);
}
lap('cross wind');
// how hard the long holes play with the wind on: a 7 iron's carry along each leg into or with the wind, against
// still air, gives each hole's plays-like length
{
  const mk = (dir, B) => { const still = simulate({ Speed: 120, VLA: 16.3, TotalSpin: 7097, HLA: 0, SpinAxis: 0 }, { altFt: COURSE.altFt, flightOnly: true }).carry, wv = windInShot(windVector(SIG_WIND, B.h.place.heading), dir);
    const r = simulate({ Speed: 120, VLA: 16.3, TotalSpin: 7097, HLA: 0, SpinAxis: 0 }, { altFt: COURSE.altFt, flightOnly: true, wind: wv }); return still / r.carry; };
  const out = [];
  for (const [i, B] of BUILT.entries()) {
    const h = HOLES[i]; let pl = 0;
    for (let s = 0; s < h.len; s += 10) pl += 10 * mk(headingAt(h.line, s + 5), B);
    out.push(`${h.n} ${h.yards[BACK]}→${Math.round(pl / YD)}`);
  }
  R_(`  plays like in the signature wind (yd, Galleon): ${out.join(', ')}`);
}
// the 3rd: the hull drops a ball at its foot; the lay-up's wedge sees the flag over her; the stern castle on a phone
{
  const B = BUILT[2], h = HOLES[2], hull = B.objs.find(o => o.kind === 'hull' && o.site), cas = B.objs.find(o => o.kind === 'castle'), mast = B.objs.find(o => o.kind === 'mast' && Math.hypot(o.x - cas.x, o.z - cas.z) < 12);
  const lay = h.targets[0].at, S = sight(B, lay, h.pin, B.ground(...h.pin) + 2.1), pin2 = B.ground(...h.pin) + 0.3, S2 = sight(B, lay, h.pin, pin2);
  R_(`  3 the hull soaks a ball (${hull.soak}): it drops at her foot in the hollow; the castle ${cas.soak}`);
  R_(`${S.hid ? '!' : ' '} 3 from the lay-up the flag is ${S.hid ? 'hidden by ' + S.hid : 'in sight'}; the green's surface ${S2.hid ? 'hidden by ' + S2.hid : 'in sight'}`);
  const sc = shows(B, h.teePts[BACK], cas), sm = mast ? shows(B, h.teePts[BACK], mast) : { px: 0 };
  R_(`${Math.max(sc.px, sm.px) >= 40 ? ' ' : '!'} 3 the stern castle from the Galleon tee: ${sc.d} m away, ${sc.px} px (its mizzen stump ${sm.px} px); 40 or more wanted`);
}
// the 5th: both cuts and the pool in the tee view or the landing view; the beacon on a phone
{
  const B = BUILT[4], h = HOLES[4], tee = h.teePts[BACK], pc = LOC[4](...CAULDRON.c), S = sight(B, tee, pc, 0.4 - B.base);
  const bold = h.targets.find(t => t.bold), Sb = sight(B, tee, bold.at, B.ground(...bold.at) + 0.3);
  const land = h.targets[0].at, mst = B.objs.find(o => o.kind === 'mast' && o.h >= 30), Sl = sight(B, land, [mst.x, mst.z], mst.base + mst.h), Sg = sight(B, land, h.pin, B.ground(...h.pin) + 2.1);
  R_(`${!S.hid ? ' ' : '!'} 5 from the tee the Cauldron's water is ${S.hid ? 'hidden by ' + S.hid : 'in sight'} (${S.ang.toFixed(1)}°), the cut's landing ${Sb.hid ? 'hidden' : 'in sight'}; from the landing area the frigate's masts (the aim for the second cut) ${Sl.hid ? 'hidden by ' + Sl.hid : 'in sight'} and the flag ${Sg.hid ? 'hidden by ' + Sg.hid : 'in sight'}`);
  // the cut: water carried on the bold drive's line, and the yards each cut saves
  const [a, b] = h.boldLine, d = wd(a, b), u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; let w0 = null, w1 = null;
  for (let t = 0; t < d; t += 1) if (B.surface(a[0] + u[0] * t, a[1] + u[1] * t) === 'water') { w0 ??= t; w1 = t; }
  const round = project(h.line, ...bold.at).s, saved = round - d;
  R_(`  5 the first cut (tee to "${bold.name}"): ${w0 === null ? 'NO WATER on its line' : `carries ${Math.round((w1 + 1) / YD)} yd to clear the pool (water ${Math.round(w0 / YD)}-${Math.round((w1 + 1) / YD)} yd)`}; it saves ${Math.round(saved / YD)} yd against the line round`);
  const from = bold.at, d2 = wd(from, h.pin), u2 = [(h.pin[0] - from[0]) / d2, (h.pin[1] - from[1]) / d2]; let v0 = null, v1 = null;
  for (let t = 0; t < d2; t += 1) if (B.surface(from[0] + u2[0] * t, from[1] + u2[1] * t) === 'water') { v0 ??= t; v1 = t; }
  const roundRest = h.len - round;
  R_(`  5 the second cut (from there at the green): ${v0 === null ? 'no water on its line' : `water ${Math.round(v0 / YD)}-${Math.round((v1 + 1) / YD)} yd`}, ${Math.round(d2 / YD)} yd against ${Math.round(roundRest / YD)} round (saves ${Math.round((roundRest - d2) / YD)}); both cuts ${Math.round((d + d2) / YD)} yd tee to green`);
  const bc = B.objs.find(o => o.kind === 'beacon'), sb = shows(B, tee, bc);
  R_(`${sb.px >= 40 ? ' ' : '!'} 5 the beacon from the 5th tee: ${sb.d} m away, ${sb.px} px`);
  for (const n of [1, 2, 3, 4]) { const Bk = BUILT[n - 1], o = Bk.objs.find(o => o.kind === 'beacon'); if (o) { const s = shows(Bk, HOLES[n - 1].teePts[BACK], o); R_(`  the beacon from the ${ord(n)} tee: ${s.d} m, ${s.px} px`); } else R_(`  the beacon from the ${ord(n)} tee: beyond 320 m of the line`); }
}
// the 6th's mast; the 7th's forward tees (no carry); the 9th's face and bell, and its low road
{
  const B6 = BUILT[5], m6 = B6.objs.find(o => o.kind === 'mast' && o.marker), s6 = shows(B6, HOLES[5].teePts[BACK], m6);
  R_(`${s6.px >= 40 ? ' ' : '!'} 6 the mast on the dune from the Galleon tee: ${s6.d} m away, ${s6.px} px`);
  const B7 = BUILT[6], h7 = HOLES[6];
  for (const T of COURSE.teeSets) { const p = h7.teePts[T.id]; let wet_ = 0, last = null; const d = wd(p, h7.pin);
    for (let t = 0; t < d; t += 1) { const q = [p[0] + (h7.pin[0] - p[0]) * t / d, p[1] + (h7.pin[1] - p[1]) * t / d]; if (B7.surface(...q) === 'water') { wet_++; last = t; } }
    R_(`${(T.id === 'brig' || T.id === 'lugger') && wet_ ? '!' : ' '} 7 ${T.name} tee (${h7.yards[T.id]} yd): ${wet_ ? `carries ${Math.round((last + 1) / YD)} yd to clear the creek` : 'no water on its line'}`); }
  const B9 = BUILT[8], h9 = HOLES[8], T = h9.table, bell = B9.objs.find(o => o.kind === 'bell'), sb = shows(B9, h9.teePts[BACK], bell), lip = sight(B9, h9.teePts[BACK], at(h9.line, T.s0 + T.face / 2 + 2), B9.ground(...at(h9.line, T.s0 + T.face / 2 + 2)) + 0.3);
  const g = s => B9.ground(...at(h9.line, s));
  R_(`  9 the face: ${(g(T.s0 + T.face / 2 + 4) - g(T.s0 - T.face / 2 - 4)).toFixed(1)} m up between ${Math.round(T.s0 - T.face / 2)} and ${Math.round(T.s0 + T.face / 2)} m; the top level ${(g(T.s0 + 15) - g(T.s1 - 15)).toFixed(1)} m over ${T.s1 - T.s0 - 30} m; carry to the top ${COURSE.teeSets.map(S => `${S.name} ${Math.round((T.s0 + T.face / 2 + 3 - project(h9.line, ...h9.teePts[S.id]).s) / YD)} yd`).join(', ')}`);
  R_(`${!lip.hid && lip.inFrame ? ' ' : '!'} 9 from the Galleon tee the lip is ${lip.hid ? 'hidden by ' + lip.hid : 'in sight'} (${lip.ang.toFixed(1)}°); the bell ${sb.px} px`);
  const low = h9.targets.find(t => t.name === 'The low road'), pr = project(h9.line, ...low.at);
  R_(`  9 the low road (${Math.round(Math.hypot(...low.at) / YD)} yd): ${B9.surface(...low.at)}, ${Math.round(-(pr.off) - (-T.L + T.face / 2))} m from the foot of the table's side bank; ${Math.round(Math.hypot(low.at[0] - h9.pin[0], low.at[1] - h9.pin[1]) / YD)} yd left`);
}
// walks, green to the next tee
R_(`  walks green to tee (m): ${HOLES.slice(0, -1).map((h, i) => `${h.n}-${h.n + 1} ${Math.round(wd(wpt(i, h.pin), wpt(i + 1, HOLES[i + 1].teePts[BACK])))}`).join(', ')}`);
fs.writeFileSync(`${OUT}/checks.txt`, report.join('\n'));
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, holes: meta, teeSets: COURSE.teeSets, back: BACK, p3 }));
lap('done');
