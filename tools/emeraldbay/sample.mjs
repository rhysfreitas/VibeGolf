// node tools/emeraldbay/sample.mjs : grids, profiles, cross sections and drive arcs for the plan book (out/grid/),
// the course map raster at both tides, and the rules checks (out/grid/checks.txt; a line starting ! breaks a rule).
// Then: python3 plans.py, node sketch.mjs, node book.mjs. Every drive is flown with the game's physics as Emerald Bay
// will play (round 0, Rhys's picks): dry sand as 'waste', wet sand as 'beach', bunkers 'sand', water a stroke, cliff
// faces that soak 45% of the balls that hit them, the cave's roof and the 7th's overhang solid.
//
// A page is a hole at a tide: the three tide holes (3, 5, 9) get one at each; the other six are drawn at high water
// (the tide changes nothing that plays on them; their checks run at both).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { HOLES, COURSE, BACK, FRONT, TIDE_HOLES } from './holes.mjs';
import { built, SURF, PHYS, toWorld, worldAt, WL, LOC, WOR } from './scene.mjs';
import { LABELS, SITES, TIDES, w, WLINES, V, CAVE, OVER, overhangAt, caveRoofAt, STACK, PINNACLE, COVES, TONGUE } from './world.mjs';
import { project, at, lengthOf, YD, headingAt, distLine, lineOf } from './geo.mjs';
import { simulate } from '../../src/physics.js';
import { greenStats, leanAlong } from './greens.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, 'out/grid');
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), lap = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`);
const DRIVES = { tour: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, mid: { Speed: 150, VLA: 12, TotalSpin: 3000 }, high: { Speed: 160, VLA: 14.5, TotalSpin: 3200 } };
const WOOD3 = { Speed: 150, VLA: 10.5, TotalSpin: 3700 }, HYBRID = { Speed: 132, VLA: 13, TotalSpin: 4600 }, IRON7 = { Speed: 120, VLA: 16.3, TotalSpin: 7097 };
const SOAK = COURSE.wallSoak;
let seed = 11; const rng = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const GS = 2;   // grid step (m)

// a shot from p along direction dir (radians from -z in the hole's frame, + right): off the cliff faces, into the cave's
// roof or the overhang; where it lands and rests
function drive(B, p, dir, shot, extra = {}) {
  const c = Math.cos(dir), s = Math.sin(dir), y0 = B.ground(p[0], p[1]);
  const W = (lx, lz) => [p[0] + lx * c - lz * s, p[1] + lx * s + lz * c];
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => B.playGround(...W(lx, lz)) - y0,
    surfaceAt: (lx, lz) => PHYS[B.surface(...W(lx, lz))],
    solidAt: (lx, ly, lz) => { const [x, z] = W(lx, lz), rf = B.roof(x, z); return rf !== null && ly + y0 > rf ? [0, -1, 0] : null; },
    rng, wallSoak: SOAK, ...extra,
  });
  const pts = [];
  for (const q of r.pts) { const [x, z] = W(q.p[0], q.p[2]); pts.push([+Math.hypot(x - p[0], z - p[1]).toFixed(1), +(y0 + q.p[1]).toFixed(2), q.phase === 'flight' ? 0 : 1]); }
  const land = r.pts.find(q => q.phase !== 'flight') || r.pts.at(-1), end = r.pts.at(-1);
  const [ex, ez] = W(end.p[0], end.p[2]), [lx, lz] = W(land.p[0], land.p[2]);
  return { pts: pts.filter((_, i) => i % 12 === 0), carry: Math.hypot(land.p[0], land.p[2]), total: Math.hypot(end.p[0], end.p[2]), apex: Math.max(...r.pts.map(q => q.p[1])), rocks: r.rockHits,
    rest: B.surface(ex, ez), end: [ex, ez], land: [lx, lz], outcome: r.outcome };
}
const plen = P => P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);

// the pages
const PAGES = [];
for (const [k, h] of HOLES.entries()) {
  if (TIDE_HOLES.includes(h.n)) for (const v of h.versions) PAGES.push({ k, h, tide: v.id, v, id: `${h.n}${v.id === 'low' ? 'L' : 'H'}` });
  else PAGES.push({ k, h, tide: 'high', v: null, id: `${h.n}` });
}
const SECTIONS = { 4: [212, 400], 5: [236], 6: [192], 7: [120], 9: [340] };
const meta = [];
for (const pg of PAGES) {
  const { k, h, tide, v } = pg, B = built(k, tide), Wk = WOR[k];
  const xs = h.line.map(p => p[0]), zs = h.line.map(p => p[1]), M = 190;
  const x0 = Math.floor(Math.min(...xs) - M), x1 = Math.ceil(Math.max(...xs) + M), z0 = Math.floor(Math.min(...zs) - M), z1 = Math.ceil(Math.max(...zs) + M);
  const Wd = Math.ceil((x1 - x0) / GS), Hd = Math.ceil((z1 - z0) / GS), hgt = new Float32Array(Wd * Hd), srf = new Uint8Array(Wd * Hd);
  for (let r = 0; r < Hd; r++) for (let c = 0; c < Wd; c++) {
    const q = worldAt(...Wk(x0 + (c + 0.5) * GS, z0 + (r + 0.5) * GS), tide);
    hgt[r * Wd + c] = q.y - B.base; srf[r * Wd + c] = SURF.indexOf(q.s);
  }
  fs.writeFileSync(`${OUT}/h${pg.id}.bin`, Buffer.concat([Buffer.from(hgt.buffer), Buffer.from(srf.buffer)]));
  const along = L => { const len = lengthOf(L), P = []; for (let s = 0; s <= len; s += 2) { const [x, z] = at(L, s); P.push([s, B.ground(x, z), B.surface(x, z), [], B.roof(x, z)]); } return P; };
  const back = h.teePts[BACK], tee0 = B.ground(...back);
  const targets = v ? v.targets : h.targets, yards = v ? v.yards : h.yards, tipsYards = v ? v.tipsYards : h.tipsYards;
  const routeL = v && v.route ? [back, ...v.route, h.pin] : null;
  const dir0 = routeL ? Math.atan2(routeL[1][0] - back[0], -(routeL[1][1] - back[1])) : headingAt(h.line, 1);
  seed = 11 + k;
  const drives = h.par === 3 ? {} : Object.fromEntries(Object.entries(DRIVES).map(([key, sh]) => [key, drive(B, back, dir0, sh)]));
  let bold = null;
  if (h.boldPath && !(v && v.route)) { const b = h.boldPath, d = Math.atan2(b[0] - back[0], -(b[1] - back[1])), Lb = [back, b]; bold = { line: Lb, prof: along(Lb), drives: Object.fromEntries(Object.entries(DRIVES).map(([key, s]) => [key, drive(B, back, d, s)])) }; }
  const route = routeL ? { line: routeL, prof: along(routeL) } : null;
  const gcells = (() => { let n = 0; for (let x = h.pin[0] - 50; x < h.pin[0] + 50; x += 0.5) for (let z = h.pin[1] - 50; z < h.pin[1] + 50; z += 0.5) if (B.gm(x, z) < 0) n++; return Math.round(n / 4); })();
  const prof = along(h.line), ys = prof.map(p => p[1]);
  let rise = 0, fall = 0; { let last = ys[0]; for (const y of ys) { const d = y - last; if (Math.abs(d) >= 1) { if (d > 0) rise += d; else fall -= d; last = y; } } }
  const sections = (SECTIONS[h.n] || []).map((s, j) => { const pts = []; for (let o = -120; o <= 120; o += 1) { const p = at(h.line, s, o); pts.push([o, B.ground(...p), B.surface(...p)]); } return { s, tag: 'ABCD'[j], ends: [at(h.line, s, -120), at(h.line, s, 120)], yd: Math.round((h.len - s) / YD), pts }; });
  const labels = [];
  for (const [wp, t] of LABELS) { const p = LOC[k](...wp), pr = project(h.line, ...p); if (Math.abs(pr.off) < 200 && pr.s > -80 && pr.s < h.len + 150) labels.push([p, t]); }
  for (const o of SITES) { if (!o.name) continue; const p = LOC[k](...o.at), pr = project(h.line, ...p); if (Math.abs(pr.off) < 160 && pr.s > -60 && pr.s < h.len + 100) labels.push([p, o.name]); }
  const lanesAt = p => { const pr = project(h.line, ...p), d = headingAt(h.line, pr.s) + Math.PI / 2, nx = Math.sin(d), nz = -Math.cos(d); let a = 0, b = 0; while (a > -120 && B.surface(p[0] + nx * (a - 0.5), p[1] + nz * (a - 0.5)) === 'fairway') a -= 0.5; while (b < 120 && B.surface(p[0] + nx * (b + 0.5), p[1] + nz * (b + 0.5)) === 'fairway') b += 0.5; return b - a; };
  meta.push({ id: pg.id, tide, tideHole: TIDE_HOLES.includes(h.n), note: v ? v.note : null, tips: h.tipsPt, tipsYards, tipsSet: COURSE.tipsSet, n: h.n, name: h.name, par: h.par, yards, x0, z0, W: Wd, H: Hd, step: GS, line: h.line, len: h.len, pin: h.pin, tees: h.teePts,
    teeY: tee0, pinY: B.ground(...h.pin), rise: Math.round(rise), fall: Math.round(fall), greenArea: gcells, sea: B.sea,
    targets: (targets || []).map(t => ({ name: t.name, p: t.at, bold: !!t.bold, pin: !!t.pin, d: Math.round(Math.hypot(t.at[0] - back[0], t.at[1] - back[1]) / YD), surf: B.surface(...t.at), width: B.surface(...t.at) === 'fairway' ? Math.round(lanesAt(t.at)) : 0, toPin: Math.round(Math.hypot(t.at[0] - h.pin[0], t.at[1] - h.pin[1]) / YD) })),
    sand: B.bunkers.map(b => ({ x: b.x, z: b.z, r: b.rx })),
    prof, sections, drives, bold, route, words: h.words, card: h.card, shape: h.shape, green: h.green, base: B.base, place: h.place, labels });
  lap(`page ${pg.id} sampled`);
}

// the course map, at each tide: the world's surface and a hillshade from its heights
const WR = 4, X0 = -280, X1 = 1300, Z0 = -1420, Z1 = -60;
const MW = Math.ceil((X1 - X0) / WR), MH = Math.ceil((Z1 - Z0) / WR);
for (const tide of ['low', 'high']) {
  const ms = new Uint8Array(MW * MH), mh = new Float32Array(MW * MH);
  for (let r = 0; r < MH; r++) for (let c = 0; c < MW; c++) { const q = worldAt(X0 + (c + 0.5) * WR, Z0 + (r + 0.5) * WR, tide); ms[r * MW + c] = SURF.indexOf(q.s); mh[r * MW + c] = q.y; }
  fs.writeFileSync(`${OUT}/world-${tide}.bin`, Buffer.concat([Buffer.from(ms.buffer), Buffer.from(mh.buffer)]));
}
fs.writeFileSync(`${OUT}/world.json`, JSON.stringify({ X0, Z0, WR, MW, MH, SURF, labels: LABELS, tides: TIDES,
  boxes: SITES.map(o => ({ kind: o.kind, X: o.at[0], Z: o.at[1], w: o.w, l: o.l, rot: o.rot })),
  holes: HOLES.map((h, i) => ({ n: h.n, name: h.name, par: h.par, line: WL[i], tees: Object.fromEntries(Object.entries(h.teePts).map(([key, p]) => [key, toWorld(h)(...p)])) })), back: BACK }));
lap('course map');

for (const m of meta) {
  const d = m.drives, b = m.bold;
  console.log(`${m.id.padEnd(3)} ${m.name.padEnd(14)} par ${m.par} ${JSON.stringify(m.yards)} tee ${(m.teeY + m.base).toFixed(0)} green ${(m.pinY + m.base).toFixed(0)} (${(m.pinY - m.teeY).toFixed(0)} m; up ${m.rise}, down ${m.fall})`);
  console.log('   ', Object.entries(d).map(([key, q]) => `${key} ${Math.round(q.carry / YD)}/${Math.round(q.total / YD)}yd ${q.rest}${q.rocks ? ' (off rock)' : ''}`).join(' · '),
    b ? '| bold: ' + Object.entries(b.drives).map(([key, q]) => `${key} ${Math.round(q.carry / YD)}/${Math.round(q.total / YD)}yd ${q.rest}`).join(' · ') : '');
  console.log('    green', m.greenArea, 'm2; targets', m.targets.map(t => `${t.name} ${t.d}yd ${t.surf} ${t.width}m`).join(' · '));
}

// ---- the checks
const report = [];
const R_ = (...a) => { const l = a.join(' '); report.push(l); console.log(l); };
const lanes = (B, p, dir) => {
  const nx = Math.cos(dir), nz = Math.sin(dir), out = []; let run = 0;
  for (let a = -90; a <= 90; a += 0.5) { if (B.surface(p[0] + nx * a, p[1] + nz * a) === 'fairway') run += 0.5; else { if (run >= 6) out.push(run); run = 0; } }
  if (run >= 6) out.push(run);
  return out;
};
const TIDES2 = ['low', 'high'];
R_(`Emerald Bay plan book round 1 checks (${new Date().toISOString().slice(0, 10)}). Every hole is checked at both tides; ! breaks a rule.`);
R_(`  total: low tide ${HOLES.reduce((a, h) => a + (h.versions ? h.versions[0].yards : h.yards)[BACK], 0)} yd, high tide ${HOLES.reduce((a, h) => a + (h.versions ? h.versions[1].yards : h.yards)[BACK], 0)} yd; par ${HOLES.reduce((a, h) => a + h.par, 0)}`);
for (const [k, h] of HOLES.entries()) {
  const B = built(k, 'low'), [x, z] = h.pin, d = 1, gx = (B.ground(x + d, z) - B.ground(x - d, z)) / (2 * d), gz = (B.ground(x, z + d) - B.ground(x, z - d)) / (2 * d);
  const sl = Math.hypot(gx, gz) * 100; R_(`${sl > 3 ? '!' : ' '} ${h.n} pin slope ${sl.toFixed(1)}%`);
  for (const [key, p] of Object.entries(h.teePts)) {
    let near = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 14; r += 1) if (B.surface(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r) === 'fairway') near = Math.min(near, r);
    if (near < 12) R_(`! ${h.n} ${key} tee: fairway ${near} m away (12 m wanted)`);
    for (const tide of TIDES2) { const sf = built(k, tide).surface(...p); if (sf !== 'tee') R_(`! ${h.n} ${key} tee pad reads ${sf} at ${tide} tide`); }
    const r = B.roof(...p); if (r !== null && r - B.ground(...p) < 45) R_(`! ${h.n} ${key} tee: rock overhead ${Math.round(r - B.ground(...p))} m up`);
  }
}
lap('pins and tees');

// the tips spot, the landing widths, the forced carries, penalty ground (each at both tides)
const routeOf = (h, v) => v && v.route ? lineOf2([h.teePts[BACK], ...v.route, h.pin]) : null;
function lineOf2(P) { return P; }
const alongPoly = (P, s) => at(P, s), headPoly = (P, s) => headingAt(P, s);
for (const [k, h] of HOLES.entries()) {
  for (const tide of h.versions ? TIDES2 : ['high']) {   // a hole the tide doesn't change: checked at high water, the narrower beaches
    const B = built(k, tide), v = h.versions ? h.versions.find(q => q.id === tide) : null, tag = h.versions ? ` (${tide} tide)` : '';
    const RL = v && v.route ? [h.teePts[BACK], ...v.route, h.pin] : null;
    // the tips spot
    const t = h.tipsPt, ts = B.surface(...t);
    let nearF = Infinity; for (let a = 0; a < 6.283; a += 0.25) for (let r = 0; r < 16; r++) if (B.surface(t[0] + Math.cos(a) * r, t[1] + Math.sin(a) * r) === 'fairway') nearF = Math.min(nearF, r);
    const tipsY = v ? v.tipsYards : h.tipsYards, backY = (v ? v.yards : h.yards)[BACK], behind = tipsY - backY;
    const lenOk = h.par === 3 ? behind >= 8 && behind <= 30 : behind >= 20 && behind <= 50;
    let land = '', landOk = true;
    if (h.par > 3) {
      const c = COURSE.tipsSet.minDrive * YD;
      const p = RL ? alongPoly(RL, Math.min(plen(RL) - 1, c + Math.hypot(t[0] - RL[0][0], t[1] - RL[0][1]) * 0 - 0)) : at(h.line, Math.min(h.len - 1, project(h.line, ...t).s + c - (project(h.line, ...t).s <= 0.01 ? Math.hypot(t[0] - h.line[0][0], t[1] - h.line[0][1]) : 0)));
      const ln = lanes(B, p, RL ? headPoly(RL, c) : headingAt(h.line, project(h.line, ...p).s)), ok = Math.max(0, ...ln) >= 40 || ln.filter(q => q >= 25).length >= 2;
      land = ` ${COURSE.tipsSet.minDrive} yd drive: ${B.surface(...p)}, lanes ${ln.map(Math.round).join(' + ') || 'none'} m;`; landOk = ok || (h.n === 7);
    }
    const okT = !['water', 'green', 'fairway', 'sand', 'rock'].includes(ts) && lenOk && nearF >= 12 && landOk;
    R_(`${okT ? ' ' : '!'} ${h.n}${tag} tips ${tipsY} yd (+${behind}): ${ts}, ${nearF === Infinity ? '16+' : nearF} m off fairway;${land}${h.n === 7 ? ' (the 7th: a drivable par 4, the tips plays it as a lay-up or a go)' : ''}`);
    if (h.par > 3) {
      const ws = [];
      for (const T of COURSE.teeSets) {
        const tp = h.teePts[T.id], dist = (T.minDrive || 150) * YD;
        let p, dir;
        if (RL) { const RL2 = [tp, ...RL.slice(1)]; p = alongPoly(RL2, Math.min(plen(RL2) - 20, dist)); dir = headPoly(RL2, Math.min(plen(RL2) - 20, dist)); }
        else { const pj = project(h.line, ...tp), s0 = pj.s > 0.01 ? pj.s : -Math.hypot(tp[0] - h.line[0][0], tp[1] - h.line[0][1]), s = Math.min(h.len - 20, s0 + dist); p = at(h.line, s); dir = headingAt(h.line, s); }
        const ln = lanes(B, p, dir), wide = Math.max(0, ...ln), ok = wide >= 40 || ln.filter(q => q >= 25).length >= 2;
        ws.push(`${T.name} ${ln.length > 1 ? ln.map(Math.round).join('+') : Math.round(wide)}`);
        if (!ok) R_(`! ${h.n}${tag} ${T.name} drive (${T.minDrive || 150} yd) lands on ${B.surface(...p)}, lanes ${ln.map(Math.round).join(', ') || 'none'} m`);
      }
      R_(`  ${h.n}${tag} landing widths (m): ${ws.join(', ')}`);
      // forced carry: the water a ball must fly from each tee set along the line (or the tide's route) before dry ground
      const fc = [];
      for (const T of COURSE.teeSets) {
        const tp = h.teePts[T.id], P = RL ? [tp, ...RL.slice(1)] : [tp, ...h.line.slice(1).filter(q => project(h.line, ...q).s > project(h.line, ...tp).s)];
        const len = plen(P); let wet = 0, run = 0;
        for (let s = 2; s < Math.min(len, 260); s += 1) { const q = alongPoly(P, s); if (B.surface(...q) === 'water') run++; else { wet = Math.max(wet, run ? s : 0); if (run && s > 40) break; run = 0; } }
        const cap = 0.6 * (T.minDrive || 150) * YD; fc.push(`${T.name} ${Math.round(wet / YD)} yd${wet > cap ? ' (OVER 60%)' : ''}`);
      }
      R_(`${fc.some(q => /OVER/.test(q)) ? '!' : ' '} ${h.n}${tag} forced carry over water along the line: ${fc.join(', ')}`);
    }
    // penalty ground within a medium miss (50 m) on both sides of a landing target
    if (h.par > 3) {
      const tg = (v ? v.targets : h.targets).filter(q => !q.pin); const where = [];
      for (const q of tg) { const pr = project(h.line, ...q.at), hd = headingAt(h.line, pr.s) + Math.PI / 2, nx = Math.sin(hd), nz = -Math.cos(hd);
        const side = sg => { for (let a = 0; a <= 50; a += 1) { if (B.surface(q.at[0] + nx * a * sg, q.at[1] + nz * a * sg) === 'water') return a; } return null; };
        const L = side(-1), R = side(1); where.push(`${q.name}: ${L === null ? '-' : 'left ' + L + ' m'}, ${R === null ? '-' : 'right ' + R + ' m'}${L !== null && R !== null ? ' BOTH' : ''}`); }
      R_(`${where.some(q => /BOTH/.test(q)) ? '!' : ' '} ${h.n}${tag} water within 50 m of a landing target: ${where.join('; ')}`);
    }
  }
}
lap('tips, landing, carries, penalty');

// the par 3s: open water to carry from each tee set at each tide (the forward set's 60% of 150 yd: 90 yd)
for (const k of [1, 2, 7]) {
  const h = HOLES[k];
  for (const tide of TIDES2) {
    const B = built(k, tide), parts = [];
    for (const T of COURSE.teeSets) {
      const p = h.teePts[T.id], D = Math.hypot(h.pin[0] - p[0], h.pin[1] - p[1]); let last = 0;
      for (let t = 0; t < D; t += 0.5) { const q = [p[0] + (h.pin[0] - p[0]) * t / D, p[1] + (h.pin[1] - p[1]) * t / D]; if (B.surface(...q) === 'water') last = t; }
      const carry = last ? (last + 1) / YD : 0, over = T.id === FRONT && carry > 90;
      parts.push(`${T.name} ${(h.versions ? h.versions.find(q => q.id === tide).yards : h.yards)[T.id]} yd, ${Math.round(carry)} yd of water${over ? (h.n === 8 ? ' (over 90: the brief\'s exception, the point nearest the stack)' : ' (OVER 90)') : ''}`);
    }
    R_(`${parts.some(p => /OVER 90\)/.test(p)) ? '!' : ' '} ${h.n} ${h.name} (${tide} tide): ${parts.join('; ')}`);
  }
}

// greens
const CONT = [];
for (const [k, h] of HOLES.entries()) {
  const B = built(k, 'low'), m = meta.find(q => q.n === h.n), back = h.teePts[BACK];
  const aim2 = (h.targets || []).filter(q => !q.bold && !q.pin).at(-1), from = h.par === 3 ? back : aim2 ? aim2.at : at(h.line, h.len - 120);
  const ap = Math.atan2(h.pin[0] - from[0], -(h.pin[1] - from[1])), ux = Math.sin(ap), uz = -Math.cos(ap);
  const pts = []; for (let x = h.pin[0] - 50; x < h.pin[0] + 50; x += 0.5) for (let z = h.pin[1] - 50; z < h.pin[1] + 50; z += 0.5) if (B.gm(x, z) < 0) pts.push([x, z]);
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz), ax = [Math.cos(th), Math.sin(th)];
  let ang = Math.atan2(ax[0] * -uz + ax[1] * ux, ax[0] * ux + ax[1] * uz) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  const alongG = pts.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), across = pts.map(([x, z]) => -(x - cx) * uz + (z - cz) * ux);
  const depth = Math.max(...alongG) - Math.min(...alongG), width = Math.max(...across) - Math.min(...across);
  for (const mm of meta.filter(q => q.n === h.n)) mm.greenShape = { depth: Math.round(depth), width: Math.round(width), angle: Math.round(ang) };
  R_(`  ${h.n} green ${m.greenArea} m2, ${Math.round(depth)} deep x ${Math.round(width)} wide (${(depth / width).toFixed(2)}), long axis ${Math.abs(Math.round(ang))}° ${ang > 8 ? 'right' : ang < -8 ? 'left' : 'straight'} of the approach`);
  const gs = greenStats(B, { r: 4 }), feat = gs.relief >= 0.25 ? 'a feature' : 'flatter';
  for (const mm of meta.filter(q => q.n === h.n)) mm.contour = { median: +gs.median.toFixed(1), relief: +gs.relief.toFixed(2), areas: gs.areas.length, cup: Math.round(gs.cup * 100), feat };
  CONT.push({ n: h.n, feat });
  {   // the green diagram's grid: 0.5 m in the approach's frame (up the page = away from the approach)
    const fx = ux, fz = uz, rx = -uz, rz = ux, N = 97, half = (N - 1) / 2, y0 = B.ground(...h.pin), hg = [], gmv = [], sf = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const a = (c - half) / 2, b = (half - r) / 2, x = h.pin[0] + a * rx + b * fx, z = h.pin[1] + a * rz + b * fz, g = B.ground(x, z);
      hg.push(+(g - y0).toFixed(3)); gmv.push(+B.gm(x, z).toFixed(2)); sf.push(SURF.indexOf(B.surface(x, z)));
    }
    const pa = gs.areas.map(q => { const dx = q.x - h.pin[0], dz = q.z - h.pin[1]; return [+(dx * rx + dz * rz).toFixed(1), +(dx * fx + dz * fz).toFixed(1)]; });
    fs.writeFileSync(`${OUT}/green${h.n}.json`, JSON.stringify({ N, step: 0.5, h: hg, gm: gmv, s: sf, areas: pa, pin: [0, 0] }));
  }
  const badG = gs.pinSlope > 3 || (gs.areas.length < 2 && m.greenArea > 400) || gs.median < 1 || gs.median > 3;
  R_(`${badG ? '!' : ' '} ${h.n} green contour: typical slope ${gs.median.toFixed(1)}%, ${gs.relief.toFixed(2)} m beyond its plane (${feat}), pin ${gs.pinSlope.toFixed(1)}%, ${gs.areas.length} pin areas, ${Math.round(gs.cup * 100)}% cuppable`);
  if (h.par > 3) {
    const ws = [];
    for (const q of (h.targets || []).filter(q => !q.bold && !q.pin)) {
      const pq = project(h.line, ...q.at), vv = leanAlong(B, pq.s - 30, pq.s + 30, 12, pq.off).map(x => x[1]);
      if (vv.length) ws.push({ name: q.name, lean: vv.reduce((a, b) => a + b, 0) / vv.length });
    }
    for (const mm of meta.filter(q => q.n === h.n)) mm.lean = ws.map(w_ => ({ name: w_.name, lean: +w_.lean.toFixed(1) }));
    R_(`  ${h.n} fairway lean: ${ws.map(w_ => `${w_.name} ${Math.abs(w_.lean).toFixed(1)}% ${w_.lean > 0.3 ? 'to the right' : w_.lean < -0.3 ? 'to the left' : 'level'}`).join('; ') || 'no targets'}`);
  }
}
const featN = CONT.filter(c => c.feat === 'a feature').length;
R_(`${featN >= 5 ? ' ' : '!'} greens with a feature (0.25 m+ beyond the plane): ${featN} of ${CONT.length}; flatter: ${CONT.filter(c => c.feat !== 'a feature').map(c => c.n).join(', ') || 'none'}`);
lap('greens');

// ---- the fixed camera (3.2 m behind the ball, 1.55 m up; 19° above level to 31° below): each tee set's target in
// sight. The ground and the rock overhead (the cave's roof, the overhang) hide it.
const EYE = 1.55, BACKC = 3.2;
function sight(B, from, to, toY) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]), ux = (to[0] - from[0]) / d, uz = (to[1] - from[1]) / d;
  const eye = [from[0] - ux * BACKC, from[1] - uz * BACKC], ey = B.ground(...from) + EYE, D = d + BACKC, ang = Math.atan2(toY - ey, D) * 180 / Math.PI;
  let hid = null;
  for (let t = 4; t < D - 3 && !hid; t += 1.5) { const x = eye[0] + ux * t, z = eye[1] + uz * t, y = ey + (toY - ey) * t / D, g = B.playGround(x, z), r = B.roof(x, z);
    if (g > y + 0.05) hid = `the ground ${Math.round(t)} m out`; else if (r !== null && y > r) hid = `the rock overhead ${Math.round(t)} m out`; }
  return { ang, inFrame: ang <= 19 && ang >= -31, hid, d };
}
let blind = 0;
for (const [k, h] of HOLES.entries()) for (const tide of h.versions ? TIDES2 : ['high']) {
  const B = built(k, tide), v = h.versions ? h.versions.find(q => q.id === tide) : null, tg = v ? v.targets : h.targets, out = [];
  for (const T of COURSE.teeSets) {
    const tee = h.teePts[T.id]; let to, toY, what;
    if (h.par === 3) { to = h.pin; toY = B.ground(...h.pin) + 2.1; what = 'the flag'; }
    else { const q = tg.find(q => !q.bold); to = q.at; toY = B.playGround(...to) + 0.3; what = q.name; }
    const S = sight(B, tee, to, toY), ok = S.inFrame && !S.hid;
    out.push(`${T.name} ${ok ? 'sees' : 'CANNOT SEE'} ${what} (${S.ang.toFixed(1)}°${S.hid ? ', behind ' + S.hid : ''})`);
    if (!ok) { R_(`! ${h.n}${v ? ' (' + tide + ')' : ''} ${T.name} tee: ${what} is ${S.hid ? 'hidden by ' + S.hid : 'out of the frame'} (${S.ang.toFixed(1)}°)`); if (T.id === BACK) blind++; }
  }
  R_(`  ${h.n}${v ? ' (' + tide + ')' : ''} tee view: ${out.join('; ')}`);
  for (const bt of tg.filter(q => q.bold)) { const S = sight(B, h.teePts[BACK], bt.at, B.playGround(...bt.at) + (bt.pin ? 2.1 : 0.3)), M = !bt.pin && S.hid ? sight(B, h.teePts[BACK], bt.at, B.playGround(...bt.at) + 2.5) : null;
    if (M && M.inFrame && !M.hid) R_(`  ${h.n} bold target "${bt.name}" from the Marlin tee: its ground hidden by ${S.hid}, a 2.5 m marker on it in sight (${M.ang.toFixed(1)}°): a marker goes there`);
    else R_(`${S.inFrame && !S.hid ? ' ' : '!'} ${h.n} bold target "${bt.name}" from the Marlin tee: ${S.hid ? 'hidden by ' + S.hid : S.inFrame ? 'in sight' : 'out of the frame'} (${S.ang.toFixed(1)}°)`); }
  // approaches: from each landing target the flag (on the 6th from short of the crest it is blind by design)
  if (h.par > 3) for (const q of tg.filter(q => !q.pin)) { const S2 = sight(B, q.at, h.pin, B.ground(...h.pin) + 2.1), dd = Math.hypot(q.at[0] - h.pin[0], q.at[1] - h.pin[1]);
    if (dd < 252) R_(`${S2.hid && h.n !== 6 ? '!' : ' '} ${h.n}${v ? ' (' + tide + ')' : ''} from "${q.name}" (${Math.round(dd / YD)} yd) the flag is ${S2.hid ? 'hidden by ' + S2.hid + (h.n === 6 ? ' (the Alps: blind on purpose)' : '') : 'in sight'}`); }
}
R_(`${blind <= 2 ? ' ' : '!'} blind tee shots from the back tees: ${blind}; two a nine at most`);
lap('views');

// ---- the brief's look-at-first list
const wd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the sea stack (and its spire) from 1, 4, 5, 7, 9: in the 90° frame, and how tall on a phone (a 40 px landmark is
// about 22 m at 250 m: 455 px per radian of height)
{
  const S = STACK.spire, out = [];
  for (const n of [1, 4, 5, 7, 9]) { const k = n - 1, h = HOLES[k], B = built(k, 'high');
    const pts = [['tee', h.teePts[BACK], (h.targets.find(q => !q.bold) || { at: h.pin }).at], ...h.targets.filter(q => !q.pin && !q.bold).map(q => [q.name, q.at, h.pin])];
    for (const [name, p, aimL] of pts) { const P0 = WOR[k](...p), aim = WOR[k](...aimL), dist = Math.hypot(S.X - P0[0], S.Z - P0[1]);
      let b = Math.atan2(S.X - P0[0], -(S.Z - P0[1])) - Math.atan2(aim[0] - P0[0], -(aim[1] - P0[1])); b = Math.atan2(Math.sin(b), Math.cos(b)); const deg = Math.round(b * 180 / Math.PI);
      const eyeY = B.ground(...p) + B.base + EYE, px = Math.round(455 * (Math.atan2(S.top - eyeY, dist) - Math.atan2(TIDES.high - eyeY, dist)));
      out.push(`${n} ${name}: ${Math.abs(deg) <= 45 ? 'in frame' : 'outside the frame'} (${Math.abs(deg)}° ${deg < 0 ? 'left' : 'right'}, ${Math.round(dist)} m, ${px} px tall)`); } }
  R_(`  the sea stack and its spire (${S.top} m): ${out.join('; ')}`);
}
// the 9th: the cave's roof against the highest approaches; the green through the cave in sight; go and lay-up
{
  const k = 8, h = HOLES[k], B = built(k, 'low');
  let lo = Infinity; for (let s = CAVE.s0; s <= CAVE.s1; s += 2) for (const o of [-15, 0, 15]) { const p = at(h.line, s, o), r = B.roof(...p), g = B.ground(...p); if (r !== null) lo = Math.min(lo, r - g); }
  R_(`  9 the cave's roof: ${Math.round(lo)} m over the floor at its lowest within 15 m of the line`);
  for (const tide of TIDES2) { const Bt = built(k, tide), tg = h.versions.find(q => q.id === tide).targets.filter(q => !q.pin);
    for (const q of tg) { const S = sight(Bt, q.at, h.pin, Bt.ground(...h.pin) + 2.1), d = Math.round(wd(q.at, h.pin) / YD), dir = Math.atan2(h.pin[0] - q.at[0], -(h.pin[1] - q.at[1]));
      const shots = d > 205 ? [['3 wood', WOOD3], ['hybrid', HYBRID]] : d > 150 ? [['hybrid', HYBRID], ['7 iron', IRON7]] : [['7 iron', IRON7], ['wedge', { Speed: 90, VLA: 26, TotalSpin: 9000 }]];
      const res = shots.map(([nm, sh]) => { seed = 77; const r = drive(Bt, q.at, dir, sh); return `${nm} ${Math.round(r.carry / YD)} carry, apex ${r.apex.toFixed(0)} m, ${r.rocks ? 'hits the roof, ' : ''}finishes ${r.rest} ${Math.round(wd(r.end, h.pin) / YD)} yd from the pin`; });
      R_(`  9 (${tide}) from "${q.name}" (${d} yd): the flag ${S.hid ? 'HIDDEN by ' + S.hid : 'in sight through the cave'} (${S.ang.toFixed(1)}°); ${res.join('; ')}`); } }
  const lay = h.targets.find(q => q.name === 'The cave beach'), flats = h.targets.find(q => q.name === 'The flats');
  R_(`  9 (low) the flats ${Math.round(wd(h.teePts[BACK], flats.at) / YD)} yd from the Marlin tee leave ${Math.round(wd(flats.at, h.pin) / YD)} yd; the lay-up leaves ${Math.round(wd(lay.at, h.pin) / YD)} yd`);
}
// the 7th: the overhang against the highest shots; the bold drive across the cove
{
  const k = 6, h = HOLES[k], B = built(k, 'high');
  let lo = Infinity, at0 = null; for (let s = 0; s <= h.len; s += 4) for (let o = -40; o <= 20; o += 2) { const p = at(h.line, s, o), r = B.roof(...p); if (r !== null && r - B.ground(...p) < lo) { lo = r - B.ground(...p); at0 = [s, o]; } }
  let lip = Infinity; for (let s = 0; s <= h.len; s += 2) { const p = at(h.line, s); for (let o = 0; o > -60; o -= 0.5) { const q = at(h.line, s, o); if (B.roof(...q) !== null) { lip = Math.min(lip, -o); break; } } }
  const ap = s => simulate({ HLA: 0, SpinAxis: 0, ...s }, { groundAt: () => 0 }).apexFt * 0.3048;
  R_(`  7 the overhang: its lip ${Math.round(lip)} m left of the line at the nearest; ${Math.round(lo)} m over the beach at its lowest within 40 m of the line; apex: a 7 iron ${ap(IRON7).toFixed(0)} m, a high drive ${ap(DRIVES.high).toFixed(0)} m, a skied driver (150 mph, 35°) ${ap({ Speed: 150, VLA: 35, TotalSpin: 4500 }).toFixed(0)} m`);
  const out = []; for (const pull of [-4, -8, -12]) { seed = 40; const r = drive(B, h.teePts[BACK], headingAt(h.line, 1) + pull * Math.PI / 180, { Speed: 150, VLA: 35, TotalSpin: 4500 }); out.push(`${-pull}° left ${r.rocks ? 'hits the overhang' : 'clears it'}, finishes ${r.rest}`); }
  R_(`  7 a skied driver pulled left from the Marlin tee: ${out.join('; ')}`);
  const bp = h.pin, back = h.teePts[BACK], D = wd(bp, back); let w0 = null, w1 = null; for (let t = 0; t < D; t += 1) { const q = [back[0] + (bp[0] - back[0]) * t / D, back[1] + (bp[1] - back[1]) * t / D]; if (B.surface(...q) === 'water') { if (w0 === null) w0 = t; w1 = t; } }
  const res = []; for (const [nm, sh] of Object.entries(DRIVES)) { seed = 50; const r = drive(B, back, Math.atan2(bp[0] - back[0], -(bp[1] - back[1])), sh); res.push(`${nm} ${Math.round(r.carry / YD)} carry, finishes ${r.rest} ${Math.round(wd(r.end, bp) / YD)} yd from the pin`); }
  R_(`  7 the bold line: ${Math.round(D / YD)} yd tee to pin, water from ${Math.round(w0 / YD)} to ${Math.round(w1 / YD)} yd (a ${Math.round(w1 / YD)} yd carry to the far beach); ${res.join('; ')}`);
  const lay = h.targets[0]; R_(`  7 the safe line: ${Math.round(wd(back, lay.at) / YD)} yd to the corner, leaving ${Math.round(wd(lay.at, bp) / YD)} yd`);
}
// the 4th: the lean, the coves on the bold line, both routes
{
  const k = 3, h = HOLES[k], B = built(k, 'high'), back = h.teePts[BACK], bp = h.pin, D = wd(back, bp); const wet = []; let run = null;
  for (let t = 0; t <= D; t += 1) { const q = [back[0] + (bp[0] - back[0]) * t / D, back[1] + (bp[1] - back[1]) * t / D], sw = B.surface(...q) === 'water'; if (sw && run === null) run = t; if (!sw && run !== null) { wet.push([run, t]); run = null; } }
  R_(`  4 the straight line tee to green (${Math.round(D / YD)} yd) crosses water at ${wet.map(([a, b]) => `${Math.round(a / YD)}-${Math.round(b / YD)}`).join(', ')} yd (the coves)`);
  const bt = h.targets.find(q => q.bold), st = h.targets[0], lay = h.targets[2];
  R_(`  4 bold: the shelf between the coves ${Math.round(wd(back, bt.at) / YD)} yd from the Marlin tee, leaves ${Math.round(wd(bt.at, bp) / YD)} yd; safe: the shelf ${Math.round(wd(back, st.at) / YD)} yd leaves ${Math.round(wd(st.at, bp) / YD)}, past the second cove leaves ${Math.round(wd(lay.at, bp) / YD)}`);
  const ls = leanAlong(B, 120, 450, 14).map(x => x[1]); R_(`  4 the shelf's lean where it is fairway: ${(ls.reduce((a, b) => a + b, 0) / ls.length).toFixed(1)}% (+ falls right, away from the water), ${Math.min(...ls).toFixed(1)} to ${Math.max(...ls).toFixed(1)}`);
}
// the 6th: the pinnacle, the crest and the blind second
{
  const k = 5, h = HOLES[k], B = built(k, 'high'), pin6 = WOR[k] ? LOC[k](PINNACLE.X, PINNACLE.Z) : null, pr = project(h.line, ...pin6);
  const crest = B.ground(...at(h.line, 245)) + B.base;
  R_(`  6 the pinnacle ${Math.round(pr.s)} m out (${Math.round((pr.s + 24) / YD)} yd from the Marlin tee), ${PINNACLE.h} m tall; the crest at 245 m, ${crest.toFixed(0)} m up; tee ${(B.ground(...h.teePts[BACK]) + B.base).toFixed(0)} m, green ${(B.ground(...h.pin) + B.base).toFixed(0)} m`);
  for (const s of [180, 210, 250, 280, 300, 315]) { const S = sight(B, at(h.line, s), h.pin, B.ground(...h.pin) + 2.1); R_(`  6 from ${s} m out (${Math.round((s + 24) / YD)} yd) the flag is ${S.hid ? 'hidden (' + S.hid + ')' : 'in sight'}`); }
}
// the 3rd: the tongue at each tide; the 5th: the bar's dry ground each side at each tide
{
  const k = 2, h = HOLES[k];
  for (const tide of TIDES2) { const B = built(k, tide); let first = null; const back = h.teePts[BACK], D = wd(back, h.pin); let lastWater = 0;
    for (let t = 0; t < D; t += 0.5) { const q = [back[0] + (h.pin[0] - back[0]) * t / D, back[1] + (h.pin[1] - back[1]) * t / D]; const sf = B.surface(...q); if (sf === 'water') lastWater = t; else if (lastWater && first === null && sf !== 'water') first = [t, sf]; }
    R_(`  3 (${tide}) from the Marlin tee: water to ${Math.round(lastWater / YD)} yd${first ? `, then ${first[1]} from ${Math.round(first[0] / YD)} yd` : ''}; the green's front edge at ${Math.round((D - 16) / YD)} yd`); }
  const k5 = 4, h5 = HOLES[k5];
  for (const tide of TIDES2) { const B = built(k5, tide), parts = [];
    for (const s of [120, 200, 260]) { const side = sg => { for (let o = 0; o <= 140; o += 1) if (B.surface(...at(h5.line, s, o * sg)) === 'water') return o; return 140; }; parts.push(`at ${s} m: left ${side(-1)} m, right ${side(1)} m`); }
    R_(`  5 (${tide}) dry ground from the line: ${parts.join('; ')}`); }
}
R_(`  walks green to tee (m): ${HOLES.slice(0, -1).map((h, i) => `${h.n}-${h.n + 1} ${Math.round(wd(WOR[i](...h.pin), WOR[i + 1](...HOLES[i + 1].teePts[BACK])))}`).join(', ')}`);
fs.writeFileSync(`${OUT}/checks.txt`, report.join('\n'));
fs.writeFileSync(`${OUT}/holes.json`, JSON.stringify({ SURF, pages: meta, teeSets: COURSE.teeSets, back: BACK, card: COURSE.card, tides: TIDES }));
lap('done');
