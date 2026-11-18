// node emit.mjs : writes the island study as a course module (tools/emeraldbay/out/study/emeraldbay.js, not in git),
// in the same format tools/emeraldbay/emit.mjs writes, so render.mjs can serve it in place of the real module and the
// game draws it with bay-world.js and the ground shader's BAY branch. Three short holes on the Massif: the Shelf, the
// Drop, the Sandbar.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { V, HOLES, TIDES, BOATS, DROP_GREEN, LEDGE, POINT } from './island.mjs';
import { packHeights } from '../../../src/course/field-code.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(HERE, '../out/study/emeraldbay.js');
const CELL = 2, r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const CODES = ['rough', 'fairway', 'fringe', 'tee', 'water', 'sand', 'desert', 'waste', 'beach'];
const b64 = a => Buffer.from(a.buffer).toString('base64');
const len = L => L.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - L[i][0], p[1] - L[i][1]), 0);
function proj(L, X, Z) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  for (let i = 1; i < L.length; i++) {
    const [ax, az] = L[i - 1], [bx, bz] = L[i], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((X - ax) * dx + (Z - az) * dz) / (l * l)));
    const d = Math.hypot(X - ax - dx * t, Z - az - dz * t); if (d < best.d) best = { d, s: acc + t * l }; acc += l;
  }
  return best;
}

// the play on each hole, world space: tee pad, a fairway ribbon down the line (not on the par 3), the green
const GREENS = [null, { X: DROP_GREEN.X, Z: DROP_GREEN.Z, y: DROP_GREEN.y, rx: 17, rz: 22, rot: 0.5 }, { X: 352, Z: 90, y: 3.2, rx: 15, rz: 20, rot: -0.7 }];
HOLES.forEach((h, k) => {
  const pin = h.line.at(-1);
  if (!GREENS[k]) { const v = V(...pin); GREENS[k] = { X: pin[0], Z: pin[1], y: v.y, rx: 16, rz: 21, rot: 0 }; }
  if (k === 2) h.line = [h.line[0], [300, 15], [GREENS[2].X, GREENS[2].Z]];
  if (k === 1) { h.line[1] = [GREENS[1].X, GREENS[1].Z]; h.line[0] = [LEDGE.X + 39.5 * LEDGE.dx, LEDGE.Z + 39.5 * LEDGE.dz]; }
  h.tee = h.line[0]; h.teeY = k === 1 ? LEDGE.y : k === 2 ? Math.max(3.2, V(...h.line[0]).y) : V(...h.line[0]).y;
});
const gIn = (g, X, Z, pad = 0) => { const c = Math.cos(g.rot), s = Math.sin(g.rot), dx = X - g.X, dz = Z - g.Z, u = (dx * c + dz * s) / (g.rx + pad), v = (-dx * s + dz * c) / (g.rz + pad); return Math.hypot(u, v); };
function play(X, Z) {   // the ground and tag with the play pieces laid in
  let v = V(X, Z), y = v.y, t = v.t;
  HOLES.forEach((h, k) => {
    const g = GREENS[k], q = gIn(g, X, Z, 0), qs = gIn(g, X, Z, 9);
    if (qs < 1) { const tilt = 0.015 * ((X - g.X) * 0.6 - (Z - g.Z) * 0.8); y = lerp(y, g.y + tilt, 1 - smooth((qs - 0.7) / 0.3)); if (q < 1) t = 'green'; else if (q < 1.15) t = 'fringe'; else if (t === 'jungle' || t === 'sand') t = 'rough'; }
    const dt = Math.hypot(X - h.tee[0], Z - h.tee[1]);
    if (dt < 12 && y > h.teeY - 3) { y = lerp(y, h.teeY, 1 - smooth((dt - 6) / 6)); if (dt < 6) t = 'tee'; }   // a pad never builds out over a drop
    if (h.fw) { const p = proj(h.line, X, Z), L = len(h.line); const hw = h.fw / 2 + 6 * Math.sin(p.s / 37 + k); if (p.s > 70 && p.s < L - 20 && p.d < hw && t !== 'green' && t !== 'fringe' && t !== 'water' && t !== 'wet' && y > 2.5) t = 'fairway'; }
  });
  return { y, t };
}
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
const ENG = { water: 'water', wet: 'beach', sand: 'waste', jungle: 'rough', rough: 'rough', fairway: 'fairway', fringe: 'fringe', green: 'fringe', tee: 'tee' };
const MAT = { water: 8, wet: 4, sand: 3, jungle: 1, rough: 0, fairway: 10, fringe: 10, green: 10, tee: 10 };

function holeOut(k) {
  const h = HOLES[k], tee = h.tee, pin = h.line.at(-1);
  const a = Math.atan2(pin[0] - tee[0], -(pin[1] - tee[1])), heading = a * 180 / Math.PI;
  const rx = Math.cos(a), rz = Math.sin(a), fx = Math.sin(a), fz = -Math.cos(a), base = h.teeY;
  const toW = (x, z) => [tee[0] + x * rx + -z * fx, tee[1] + x * rz + -z * fz];
  const toL = (X, Z) => { const dx = X - tee[0], dz = Z - tee[1]; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const pts = h.line.map(p => toL(...p)), xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const x0 = Math.floor((Math.min(...xs) - 260) / CELL) * CELL, x1 = Math.max(...xs) + 260, z0 = Math.floor((Math.min(...zs) - 260) / CELL) * CELL, z1 = Math.max(...zs) + 200;
  const nx = Math.ceil((x1 - x0) / CELL) + 1, nz = Math.ceil((z1 - z0) / CELL) + 1;
  const hs = new Float32Array(nx * nz), tg = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const [X, Z] = toW(x0 + i * CELL, z0 + j * CELL), v = play(X, Z); hs[j * nx + i] = v.y - base; tg.push(v.t); }
  const ss = new Uint8Array(nx * nz), ms = new Uint8Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k2 = j * nx + i, t = tg[k2], yv = hs[k2];
    const gx = (hs[j * nx + Math.min(nx - 1, i + 1)] - hs[j * nx + Math.max(0, i - 1)]) / (2 * CELL), gz = (hs[Math.min(nz - 1, j + 1) * nx + i] - hs[Math.max(0, j - 1) * nx + i]) / (2 * CELL);
    const steep = Math.hypot(gx, gz) > 1.9 && (t === 'jungle' || t === 'rough' || t === 'sand');
    ss[k2] = CODES.indexOf(steep ? 'desert' : ENG[t]); ms[k2] = steep ? 2 : MAT[t];
    lo = Math.min(lo, yv);
  }
  const y0 = Math.floor(lo), q = new Int16Array(nx * nz); for (let k2 = 0; k2 < q.length; k2++) q[k2] = Math.round((hs[k2] - y0) * 50);
  const g = GREENS[k], [gx, gz] = toL(g.X, g.Z), outline = [];
  for (let i = 0; i < 48; i++) { const t = i / 48 * Math.PI * 2, wob = 1 + 0.06 * Math.sin(t * 3 + k), u = Math.cos(t) * g.rx * wob, v = Math.sin(t) * g.rz * wob, c = Math.cos(g.rot), s = Math.sin(g.rot); outline.push(toL(g.X + u * c - v * s, g.Z + u * s + v * c).map(r2)); }
  const yards = Math.round(len(h.line) / 0.9144);
  return { n: h.n, name: h.name, par: h.par, heading: Math.round((heading + 360) % 360), blurb: h.story, line: pts.map(p => p.map(r1)), tees: { marlin: [0, 0], manta: [0, 0], turtle: [0, 0], clownfish: [0, 0] }, teePads: {}, yards: { marlin: yards, manta: yards, turtle: yards, clownfish: yards }, pin: [r1(gx), r1(gz)], targets: [{ name: 'Green', pin: true }], drops: [],
    tips: { tee: [0, 30], yards: yards + 30 },
    field: { x0, z0, cell: CELL, nx, nz, y0, codes: CODES, pred: 1, h: b64(packHeights(q, nx)), s: b64(ss), m: b64(ms) },
    frame: { x: r1(tee[0]), z: r1(tee[1]), heading: r2(heading), base: r2(base) },
    green: { x: r1(gx), z: r1(gz), outline, keepGround: true, apron: 3, pins: [[r1(gx), r1(gz)]] }, bunkers: [], rocks: [], plants: [] };
}

// the bay: 10 m over the Massif and round it, 40 m out to the far islands
function mapOf(X0, X1, Z0, Z1, C, scale) {
  const nx = Math.round((X1 - X0) / C) + 1, nz = Math.round((Z1 - Z0) / C) + 1, raw = new Float32Array(nx * nz), tg = new Array(nx * nz);
  let lo = Infinity;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const v = play(X0 + i * C, Z0 + j * C); raw[j * nx + i] = v.y; tg[j * nx + i] = v.t; lo = Math.min(lo, v.y); }
  const m = new Uint8Array(nx * nz), q = new Int16Array(nx * nz), y0 = Math.floor(lo);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, gx = (raw[j * nx + Math.min(nx - 1, i + 1)] - raw[j * nx + Math.max(0, i - 1)]) / (2 * C), gz = (raw[Math.min(nz - 1, j + 1) * nx + i] - raw[Math.max(0, j - 1) * nx + i]) / (2 * C);
    m[k] = Math.hypot(gx, gz) > (C > 20 ? 0.9 : 1.4) && tg[k] === 'jungle' ? 2 : MAT[tg[k]];
    q[k] = Math.round((raw[k] - y0) * scale);
  }
  return { x0: X0, z0: Z0, cell: C, nx, nz, y0, scale, pred: 1, h: b64(packHeights(q, nx)), m: b64(m) };
}
const world = mapOf(-850, 850, -1050, 450, 5, 20), far = mapOf(-4000, 4000, -4200, 3600, 40, 4);
const play_ = HOLES.map(h => ({ line: h.line.map(p => p.map(r1)), tees: [h.tee.map(r1)] }));
const sites = BOATS.map(([X, Z, hd]) => ({ kind: 'longtail', name: null, at: [X, Z], w: 1.7, l: 13, h: 1.2, rot: r2(hd * Math.PI / 180), y: 0 }));
const course = { id: 'emeraldbay', name: 'Emerald Bay (island study)', theme: 'bay', altFt: 0, wallSoak: 0.45, blurb: 'The island study: one whole island to agree the look.',
  signature: { time: 'midday', wind: 'light', weather: 'clear', temp: 'hot' }, voidText: ['Into the sea', 'Ends in the sea'],
  teeSets: [{ id: 'marlin', name: 'Marlin', color: '#1f4e79', minDrive: 260 }, { id: 'manta', name: 'Manta', color: '#2a8a8a', minDrive: 230 }, { id: 'turtle', name: 'Turtle', color: '#5a9a3a', minDrive: 200 }, { id: 'clownfish', name: 'Clownfish', color: '#e8743b', minDrive: 0 }],
  tipsSet: { id: 'shark', name: 'Shark', color: '#5b6670', minDrive: 290 },
  rolls: [{ id: 'tide', name: 'Tide', options: [{ id: 'low', name: 'Low tide', sea: 0 }, { id: 'high', name: 'High tide', sea: 2.4 }] }],
  bay: { world, far, tides: TIDES, sites, play: play_, roof: [], landmarks: {} } };
const holes = HOLES.map((_, k) => holeOut(k));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `export const COURSE = ${JSON.stringify(course)};\nexport const HOLES = ${JSON.stringify(holes)};\n`);
console.log(OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + ' MB', holes.map(h => `${h.name} ${h.yards.marlin} yd, frame ${JSON.stringify(h.frame)}`).join('\n'));
