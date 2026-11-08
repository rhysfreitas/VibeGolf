// node tools/hollowmere/emit.mjs (after sample.mjs): write src/course/hollowmere.js, the playable blockout of Hollowmere, from holes.mjs (one world
// frame) and the sampled yardages (out/meta.json). Each hole is turned into its own frame: the back tee at the
// origin, the pin straight down -z. Other holes' ground in the same cavern comes along as scenery islands, and
// the caverns (halls, roof openings, stalactites, marks) go in hole.cave for cave.js and cave-world.js.
import fs from 'fs';
import { HOLES, HALLS, SKY, HOLLOW, LANDMARKS, caveFloor } from './holes.mjs';
import { hallDepth } from '../../src/course/cave.js';
import { createTerrain, prepIsland, islandF, edgeRadius } from '../../src/course/terrain.js';
const M = JSON.parse(fs.readFileSync(new URL('./out/meta.json', import.meta.url)));
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
const FLOOR = { 1: -46, 2: -58, 3: -66, 8: -66, 9: -50 };   // the cave floor under holes without one
const inHall = (x, z) => HALLS.some(H => hallDepth(H, x, z) > 0);
const clearLine = (a, b) => { for (let k = 1; k < 30; k++) { const f = k / 30; if (!inHall(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)) return false; } return true; };

const out = HOLES.map((h0, i) => {
  const n = i + 1, m = M.holes[i], tee = h0.tees.eagle, pin = h0.green.pins[0];
  const hd = Math.atan2(pin[0] - tee[0], -(pin[1] - tee[1])), cs = Math.cos(hd), sn = Math.sin(hd);
  const W = (lx, lz) => [tee[0] + lx * cs - lz * sn, tee[1] + lx * sn + lz * cs];
  const L = ([x, z]) => { const dx = x - tee[0], dz = z - tee[1]; return [r1(dx * cs + dz * sn), r1(-dx * sn + dz * cs)]; };
  const P = p => [...L(p), ...p.slice(2)];                   // a point with extra values after x, z
  const rot = v => r3((v || 0) - hd);
  const xz = o => { const [x, z] = L([o.x, o.z]); return { ...o, x, z }; };
  const island = I => { const o = xz(I); o.rot = rot(I.rot); if (I.slope) o.slope = { from: P(I.slope.from), to: P(I.slope.to) }; return o; };
  const feat = F => { const o = xz(F); if (F.from) o.from = L(F.from); if (F.toward) o.toward = L(F.toward); if (F.rot !== undefined) o.rot = rot(F.rot); if (F.pins) o.pins = F.pins.map(L); return o; };
  const floor0 = h0.floor || caveFloor(FLOOR[n]);
  const H = {
    name: h0.name, par: h0.par, shape: h0.shape, idea: h0.idea, blurb: h0.play,
    heading: Math.round(((hd * 180 / Math.PI) % 360 + 360) % 360),
    tees: Object.fromEntries(Object.entries(h0.tees).map(([k, p]) => [k, L(p)])),
    yards: Object.fromEntries(Object.entries(m.tees).map(([k, t]) => [k, t.yd])),
    line: [tee, ...h0.line.slice(1)].map(L), pin: L(pin), corridor: h0.corridor ?? 38,
    targets: [{ name: 'Green', pin: true }], drops: [],
    islands: h0.islands.map(island),
    floor: { ...floor0, gorges: floor0.gorges.map(g => ({ ...xz(g), rot: rot(g.rot) })) },
    fairways: (h0.fairways || []).map(f => ({ ...f, pts: f.pts.map(P) })),
    green: feat(h0.green),
  };
  for (const k of ['bunkers', 'landforms', 'water']) if (h0[k]) H[k] = h0[k].map(feat);
  if (h0.groves) H.groves = h0.groves.map(G => { const { r, kind, ...g } = feat(G); return kind === 'mushroom' ? { ...g, rx: r, rz: r, type: 'mushroom', s: [1.8, 2.8] } : { ...g, rx: r, rz: r, type: 'oak', s: [1.1, 1.6] }; });
  if (h0.rocks) H.rocks = h0.rocks.map(xz);
  if (h0.rivers) H.rivers = h0.rivers.map(r => ({ ...r, pts: r.pts.map(P) }));
  // the other holes' ground in view: islands in the same caverns with a clear line from this hole's tee or green
  const near = (x, z) => [tee, pin, ...h0.line].some(p => Math.hypot(x - p[0], z - p[1]) < 700) && (clearLine(tee, [x, z]) || clearLine(pin, [x, z]));
  // ...but none that overlaps this hole's own ground (their heights belong to another hole's landforms)
  const own = h0.islands.map(I => prepIsland({ seed: 1, ...I }));
  const overlaps = I => { const P = prepIsland({ seed: 1, ...I }); for (let a = 0; a < 24; a++) for (const f of [0, 0.4, 0.75, 1]) { const e = edgeRadius(P, a / 24 * 6.2832), x = P.x + (e.x - P.x) * f, z = P.z + (e.z - P.z) * f; if (own.some(O => islandF(O, x, z) <= 1.05)) return true; } return false; };
  const others = HOLES.flatMap((o, j) => j === i ? [] : o.islands.filter(I => I.kind !== 'tee' && near(I.x, I.z) && !overlaps(I)).map(I => ({ ...island(I), kind: I.kind === 'rock' ? 'rock' : 'rough', scenery: true })));
  // without a floor of its own the hall is filled wall to wall: its ramps widen out to the cave walls
  if (!h0.floor) for (const I of H.islands) {
    if (!I.slope || I.scenery || I.rx < 40) continue;
    const hall = HALLS.map(Hl => ({ Hl, d: hallDepth(Hl, ...W(I.x, I.z)) })).sort((a, b) => b.d - a.d)[0];
    if (hall && hall.d > 0) I.rx = Math.max(I.rx, (hall.Hl.w ? hall.Hl.w / 2 : Math.min(hall.Hl.rx, hall.Hl.rz)) + 18);
  }
  H.islands.push(...others);
  // the caverns
  const T = createTerrain({ ...h0, line: [tee, ...h0.line.slice(1)], pin, floor: floor0 });
  const halls = HALLS.filter(Hl => { const c = Hl.e || Hl.a; return [tee, pin].some(p => Math.hypot(c[0] - p[0], c[1] - p[1]) < 1500); })
    .map(Hl => Hl.e ? { e: L(Hl.e), rx: Hl.rx, rz: Hl.rz, rot: rot(Hl.rot || 0), p: Hl.p || 2, roof: Hl.roof, foot: Hl.foot } : { a: L(Hl.a), b: L(Hl.b), w: Hl.w, roof: Hl.roof, foot: Hl.foot });
  const sky = SKY.filter(S => Math.hypot(S.x - tee[0], S.z - tee[1]) < 1600).map(S => ({ ...xz(S), name: S.name }));
  const stalactites = [], marks = [];
  // this hole's marks, then the landmarks of other holes nearby (scenery only)
  const absTip = p => (p.length > 3 ? p[2] : (T.groundAt(p[0], p[1]) ?? floor0.y) + p[2]);
  const addMarks = (list, own) => { for (const mk of list) {
    if (mk.type === 'stalactites') { for (const p of mk.pts) stalactites.push({ ...xz({ x: p[0], z: p[1] }), y: r1(absTip(p)), r: p[4] || 2.6 }); if (own) marks.push({ type: 'text', label: mk.label }); continue; }
    const o = { ...mk };
    if (mk.pts) o.pts = mk.pts.map(P);
    if (mk.poly) o.poly = mk.poly.map(L);
    if (mk.x !== undefined) [o.x, o.z] = L([mk.x, mk.z]);
    if (mk.from) o.from = L(mk.from);
    if (!own) o.distant = true;
    if (mk.type !== 'text') marks.push(o);
  } };
  addMarks(h0.marks, true);
  const seen = new Set(h0.marks.map(mk => mk.type + (mk.label || '')));
  HOLES.forEach((o, j) => { if (j === i) return; addMarks(o.marks.filter(mk => {
    const p = mk.x !== undefined ? [mk.x, mk.z] : mk.pts ? mk.pts[0] : mk.poly ? mk.poly[0] : null;
    if (!p || seen.has(mk.type + (mk.label || '')) || ['text', 'lanterns', 'rails', 'stalactites', 'skylight', 'deep'].includes(mk.type)) return false;
    if (Math.hypot(p[0] - tee[0], p[1] - tee[1]) > 1100 || !(clearLine(tee, p) || clearLine(pin, p))) return false;
    seen.add(mk.type + (mk.label || '')); return true;
  }), false); });
  H.cave = { halls, sky, wall: 34, stalactites, marks: marks.filter(mk => mk.type !== 'text') };
  return H;
});

const src = `// Hollowmere: nine holes through old limestone mine caverns (course.html?c=hollowmere). A BLOCKOUT,
// generated from the plan book's hole data (tools/hollowmere: holes.mjs, sample.mjs, emit.mjs): the ground, features and
// caverns are in place for sketch views and a first look; props are stand-ins.
// Beyond the usual hole format: hole.cave (cave.js) holds the halls, roof openings, stalactites and the marks
// cave-world.js draws; islands with scenery: true are other holes' ground in the same cavern.
export const COURSE = {
  id: 'hollowmere', name: 'Hollowmere', theme: 'cave', altFt: 0,
  blurb: 'Nine holes through old mine caverns: a waterfall into the Deep, glowworms and crystal, and a climb back into the light.',
  signature: { time: 'midday', wind: 'calm', windFrom: 'random', weather: 'clear', temp: 'cool' },
  voidText: ['Into the Deep', 'Lost in the Deep'],
  teeSets: [
    { id: 'eagle', name: 'Eagle', color: '#2f5fa8', minDrive: 260 },
    { id: 'hawk', name: 'Hawk', color: '#f2efe6', minDrive: 220 },
    { id: 'swift', name: 'Swift', color: '#c94a3a', minDrive: 185 },
    { id: 'wren', name: 'Wren', color: '#e0b84a', minDrive: 0 },
  ],
};
export const HOLES = [
${out.map(h => '  ' + JSON.stringify(h)).join(',\n')},
];
`;
fs.writeFileSync(new URL('../../src/course/hollowmere.js', import.meta.url), src);
console.log('wrote', src.length, 'bytes;', out.map((h, i) => `${i + 1}: ${h.islands.length} islands, ${h.cave.halls.length} halls, ${h.cave.marks.length} marks, ${h.cave.stalactites.length} stal`).join(' | '));
