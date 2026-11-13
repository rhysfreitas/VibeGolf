// The Buried Kingdom, in world space (metres; x east, -z north, y above the river's bed datum). Pure, no DOM.
// An invented Egyptian site half-buried in drifted sand, in three zones west to east: the river (holes 1-3: a
// river plain, the royal boat basin, the valley temple and the causeway climbing off the plain), the plateau
// (4-6: a dune sea with long ridges and blowouts, the great pyramid, the Sphinx) and the cliffs (7-9: the quarry
// under the plateau's lip, a wadi between rock walls, the cliff temple and its colossi). V(X, Z) is the ground
// without the holes; each hole's ground follows it away from its line (scene.mjs). Points below are written
// [x east, n north] as in claude/buried-kingdom-layout.md and turned to [X, Z = -n] by `w`.
import { clamp, smooth, lerp, project, seDist, lengthOf } from './geo.mjs';
import { noise1, noise2 } from './shapes.mjs';

const w = p => [p[0], -p[1]];
const W = P => P.map(w);

// ---- two smooth floors through control heights (Gaussian RBFs, as the Lost Valley's): the upland (river plain
// rising east onto the plateau) and the lowland south-east of the plateau's lip (the quarry's bench, the wadi)
function rbf(ctrl, SIG, REG) {
  const n = ctrl.length, phi = d2 => Math.exp(-d2 / (2 * SIG * SIG));
  const M = ctrl.map((a, i) => [...ctrl.map(b => phi((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) + (a === b ? 0.03 : 0)), a[2] - REG]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const wt = M.map((row, i) => row[n] / row[i]), R = SIG * 4;
  return (x, nn) => { let y = REG; for (let i = 0; i < n; i++) { const dx = x - ctrl[i][0], dn = nn - ctrl[i][1]; if (Math.abs(dx) < R && Math.abs(dn) < R) y += wt[i] * phi(dx * dx + dn * dn); } return y; };
}
export const UP = [
  // the river plain: the quays of the boat basin (1), the bank (2), the valley temple
  [0, 0, 8.5], [131, 19, 9], [66, 12, 8.5], [66, 90, 8], [60, -70, 7], [160, 90, 6.5], [190, 240, 6.8], [215, 380, 7.2], [185, 500, 7.6], [151, 616, 8.5], [120, 690, 8.5],
  [-20, 150, 5.5], [90, 300, 5.5], [70, 560, 6], [40, 760, 6], [20, -200, 6], [150, -150, 7], [250, 0, 8], [300, 200, 8.5], [320, 400, 9], [260, 560, 8.5],
  // the causeway (3) climbing off the plain, and the slope either side of it
  [200, 652, 8.5], [300, 654, 13], [400, 655, 19], [500, 656, 25], [598, 656, 30.5], [300, 800, 11], [430, 820, 17], [560, 860, 26], [330, 520, 11], [430, 500, 17], [530, 470, 25],
  // the plateau: the 4th round the Sand Sea, the Sphinx's shelf (5), the great dune (6) with low ground either side
  [640, 590, 31], [795, 545, 31], [862, 367, 33], [738, 482, 30.5], [885, 315, 34], [820, 240, 37], [765, 177, 41], [700, 150, 39], [820, 110, 43], [805, -20, 45.5], [790, -150, 47], [750, -240, 49], [704, -326, 52], [735, -400, 50],
  [930, -20, 37], [920, -160, 39], [640, -190, 37], [690, -50, 36], [700, 70, 37], [610, -320, 38], [840, -330, 47],
  // the slope west of the plateau, down to the plain
  [520, 300, 23], [420, 200, 15], [320, 80, 9.5], [460, 40, 19], [560, -110, 28], [500, -260, 25], [360, -160, 11], [260, -320, 8], [110, -330, 6.5], [600, 130, 30], [640, 350, 29.5],
  // the plateau east and north: the dune sea, the lesser pyramids
  [950, 500, 34], [1010, 300, 38], [960, 140, 41], [940, 800, 32], [1040, 665, 34], [733, 712, 31.5], [733, 900, 30], [1150, 450, 37], [1100, 100, 42], [1060, -150, 44], [1000, -300, 46], [1200, -100, 46], [1250, 250, 40], [1200, 800, 34], [850, 1000, 30], [500, 1000, 22], [250, 1000, 10],
];
export const LOW = [
  // under the lip: the 7th's bench, the quarry's rim, the 7th green
  [770, -412, 33], [870, -415, 30], [950, -405, 32], [1039, -390, 36], [800, -470, 25], [900, -468, 24], [1000, -462, 26],
  // the wadi: the 8th's floor and terrace, the 9th down to the forecourt
  [1035, -440, 22.6], [1052, -520, 23], [1085, -600, 23.4], [1100, -665, 27], [1091, -805, 31.5], [1110, -850, 31], [1220, -892, 28.5], [1330, -930, 27.5], [1420, -892, 25], [1507, -847, 21], [1585, -832, 21],
  // the low desert south and west of the plateau
  [700, -540, 26], [600, -620, 22], [800, -680, 25], [900, -720, 26], [950, -900, 28], [1100, -1000, 27], [1300, -1060, 25], [1500, -1000, 22], [1700, -880, 20], [500, -480, 22], [400, -600, 16], [700, -800, 24], [1250, -760, 28], [1400, -700, 27], [1250, -560, 27], [1200, -400, 30],
];
const upAt = rbf(UP, 150, 26), lowAt = rbf(LOW, 130, 26);
// the plateau's lip: north of it the plateau, south of it the lowland; the 7th tee stands on it
export const LIP = W([[-900, -540], [200, -500], [420, -470], [560, -440], [660, -420], [712, -422], [746, -417], [757, -400], [772, -380], [820, -368], [900, -360], [985, -352], [1040, -318], [1075, -260], [1090, -180], [1210, -150], [2600, -150]]);
const lipD = (X, Z) => { const pr = project(LIP, X, Z); return pr.off + 5 * noise1(pr.s / 60, 5) + 2 * noise1(pr.s / 17, 6); };   // + = south of the lip (the line runs east)

// ---- the river along the west: its east bank, south to north (west of it is water); the boat basin with the
// 1st across it; the beach round the basin's south-east
export const BANK = W([[-70, -420], [-52, -200], [-66, -80], [-64, 0], [-44, 90], [24, 190], [102, 290], [150, 380], [128, 462], [72, 548], [34, 640], [18, 800], [28, 1100]]);
export const RIVER = { level: 2.5, bed: 1.4, width: 560 };
export const BASIN = { c: w([66, 12]), rx: 42, rz: 50, p: 3.4, level: 2.5, bed: 1.2 };
const basinE = (X, Z) => seDist({ x: BASIN.c[0], z: BASIN.c[1], rx: BASIN.rx, rz: BASIN.rz, p: BASIN.p }, X, Z);
// the beach: how much of the basin's shore here is a beach (1) and not a quay wall (0): its south-east
const beachW = (X, Z) => { const a = Math.atan2(-(Z - BASIN.c[1]), X - BASIN.c[0]) * 180 / Math.PI;   // 0 = east, -90 = south
  return smooth((a + 118) / 22) * (1 - smooth((a + 26) / 20)); };

// ---- what stands on the ground: the pyramids (the great one's top third still cased in white), the Sphinx
export const PYRAMIDS = [
  { c: w([733, 712]), half: 102.5, h: 131, name: 'the great pyramid', cased: 0.7 },
  { c: w([940, 800]), half: 52, h: 64, name: 'a lesser pyramid' },
  { c: w([1040, 665]), half: 38, h: 46, name: 'a lesser pyramid' },
];
const pyrAt = (P, X, Z) => { const m = Math.max(Math.abs(X - P.c[0]), Math.abs(Z - P.c[1])); return m >= P.half ? 0 : P.h * (1 - m / P.half); };
// the Sphinx lies at the 5th's pin, facing the tee (north-east), its body running on south-west: paws either
// side of the green (the hole's own forms), the chest 20 m behind the pin, the head over it
export const SPHINX = (() => { const pin = [765, 177], b = 221 * Math.PI / 180, f = [Math.sin(b), Math.cos(b)], P = d => w([pin[0] + f[0] * d, pin[1] + f[1] * d]);
  return { pin: w(pin), rot: b, chest: P(27), body: { c: P(60), along: 40, across: 12.5, h: 15 }, head: { at: P(27), w: 13, l: 14, h: 15, top: 25 }, dir: w(f) }; })();
function sphinxAt(X, Z) {
  const B = SPHINX.body, dx = X - B.c[0], dz = Z - B.c[1], a = dx * SPHINX.dir[0] + dz * SPHINX.dir[1], c = -dx * SPHINX.dir[1] + dz * SPHINX.dir[0];
  const e = Math.pow(Math.pow(Math.abs(a) / B.along, 5) + Math.pow(Math.abs(c) / B.across, 5), 1 / 5);
  if (e >= 1) return 0;
  // a lion's back: flat-topped with steep flanks, low at the haunches, rising to the shoulders (the tee's end)
  return B.h * (0.7 + 0.3 * smooth(0.5 - a / (2 * B.along))) * Math.pow(1 - Math.pow(e, 5), 0.5);
}
export function standAt(X, Z) {
  let y = 0;
  for (const P of PYRAMIDS) y = Math.max(y, pyrAt(P, X, Z));
  return Math.max(y, sphinxAt(X, Z));
}

// ---- the dune sea on the plateau: long transverse ridges (crests north-south, the wind off the river), a gentle
// windward side and a slip face to the east; none on the river plain or in the wadi (each zone its own ground),
// and none along the 6th, which plays down one great dune of its own
const CALM6 = W([[820, 110], [790, -150], [704, -326]]);
const CALM = [W([[640, 590], [795, 545], [862, 367]]), W([[885, 315], [765, 177]]), W([[200, 652], [598, 656]])];
function duneAt(X, Z) {
  const n = -Z, m = smooth((X - 560) / 160) * (1 - smooth((lipD(X, Z) + 90) / 80));
  if (m <= 0) return 0;
  const ph = (X * 0.94 + n * 0.34) / 135 + 0.9 * noise2(X / 330, n / 330, 71), t = ph - Math.floor(ph);
  const prof = t < 0.7 ? smooth(t / 0.7) : 1 - smooth((t - 0.7) / 0.3);
  const far = 1 + 1.1 * smooth((Math.hypot(X - 1050, n - 420) < 1 ? 0 : (X - 900) / 500)) * smooth((n - 250) / 300);
  let a = 4.2 * far * (0.55 + 0.45 * noise2(X / 210, n / 210, 72));
  a *= smooth((project(CALM6, X, Z).d - 70) / 90);
  for (const L of CALM) a *= 0.35 + 0.65 * smooth((project(L, X, Z).d - 60) / 80);
  return m * a * (prof - 0.45);
}

// ---- the cliffs: rock walls either side of the wadi, about 90 m off its middle. East and south of it they are
// the cliff line, out to the horizon; west of the 8th they are a headland between the wadi and the low desert
export const WADI = W([[1005, -395], [1050, -470], [1085, -600], [1100, -700], [1092, -805], [1115, -855], [1220, -893], [1330, -932], [1420, -895], [1507, -850], [1572, -836]]);
const WADI_J = (() => { let s = 0; for (let i = 0; i < 4; i++) s += Math.hypot(WADI[i + 1][0] - WADI[i][0], WADI[i + 1][1] - WADI[i][1]); return s; })();   // where the 8th ends
export function wallAt(X, Z) {
  const pr = project(WADI, X, Z), n = -Z;
  if (pr.d < 60) return 0;
  const hw = 88 + 9 * noise1(pr.s / 70, 21) + 4 * noise1(pr.s / 19, 22) + (pr.off < 0 ? 0 : 0) ;
  let k = smooth((pr.d - hw) / 26);
  if (k <= 0) return 0;
  if (pr.off > 0 && pr.s < WADI_J + 30) k *= smooth((pr.s - 70) / 110) * (1 - smooth((pr.d - 250) / 130));   // the headland west of the 8th
  if (pr.off <= 0) k *= 1 - smooth((n + 300) / 110);                                                   // no cliff north of the quarry's back wall
  const top = 46 + 9 * noise2(X / 160, Z / 160, 23) + 3 * noise2(X / 45, Z / 45, 24);
  // two ledges in the face
  const c = clamp((pr.d - hw) / 60, 0, 1), led = c + 0.06 * Math.sin(c * 12.6);
  return k * top * clamp(0.55 + 0.45 * led, 0, 1);
}

// ---- cuts: the Sand Sea (the 4th's blowout: a bowl of soft sand 9 m deep), the quarry pit, the river and basin
export const SANDSEA = { c: w([738, 482]), rx: 54, rz: 47, rot: (135.1 - 90) * Math.PI / 180, floor: 22, name: 'the Sand Sea' };   // long axis down the 4th's straight line
const seaE = (X, Z) => seDist({ x: SANDSEA.c[0], z: SANDSEA.c[1], rx: SANDSEA.rx, rz: SANDSEA.rz, rot: SANDSEA.rot }, X, Z) + 0.07 * noise2(X / 23, Z / 23, 31);
export const QUARRY = { c: w([900, -508]), rx: 104, rz: 38, p: 4.5, floor: 18.5, name: 'the quarry', obelisk: { a: w([862, -512]), b: w([905, -503]), t: 4.2 } };
const quarryE = (X, Z) => seDist({ x: QUARRY.c[0], z: QUARRY.c[1], rx: QUARRY.rx, rz: QUARRY.rz, p: QUARRY.p, rot: -0.04 }, X, Z) + 0.03 * noise2(X / 15, Z / 15, 33);
export function cutAt(X, Z, y) {
  const se = seaE(X, Z);
  if (se < 1.25) {   // steep on the tee's side (the slip face), a long even ramp up to the far rim
    const t = ((X - SANDSEA.c[0]) * Math.cos(SANDSEA.rot) + (Z - SANDSEA.c[1]) * Math.sin(SANDSEA.rot)) / SANDSEA.rx, p = lerp(2.6, 1.0, smooth((t + 0.35) / 0.9));
    const bowl = SANDSEA.floor + 9.5 * Math.pow(clamp(se, 0, 1.3), p); y = Math.min(y, lerp(bowl, y, smooth((se - 0.97) / 0.28))); }
  const qe = quarryE(X, Z);
  if (qe < 1.08) y = lerp(Math.min(y, QUARRY.floor + 0.5 * noise2(X / 20, Z / 20, 34)), y, smooth((qe - 0.97) / 0.1));
  const be = basinE(X, Z);
  if (be < 1.9) {
    const bw = beachW(X, Z), quay = lerp(BASIN.bed, y, smooth((be - 0.985) / 0.03)), beach = Math.min(y, BASIN.level - 1.3 + Math.max(0, be - 0.9) * 46 * 0.11);
    y = lerp(quay, be < 0.9 ? BASIN.bed : beach, bw);
  }
  const rp = project(BANK, X, Z);
  if (rp.off < 30 && rp.off > -RIVER.width - 30) {
    const e = rp.off < -RIVER.width / 2 ? -RIVER.width - rp.off : rp.off;   // metres up the nearer bank (+ = on land)
    y = e < 0 ? Math.min(y, RIVER.bed) : lerp(Math.min(y, RIVER.level + 0.5 + e * 0.1), y, smooth((e - 6) / 24));
  }
  return y;
}
export function waterAt(X, Z) {
  if (basinE(X, Z) < 0.985 + 0.05 * beachW(X, Z)) { const g = cutAt(X, Z, 9); if (g < BASIN.level - 0.05) return { level: BASIN.level, body: 'basin' }; }
  const rp = project(BANK, X, Z);
  if (rp.off < -2.5 && rp.off > -RIVER.width + 2.5) return { level: RIVER.level, body: 'river' };
  return null;
}
// soft sand lying in the world (a bunker lie): the Sand Sea
export const softAt = (X, Z) => seaE(X, Z) < 0.985;

export function V(X, Z, raw = false) {
  const n = -Z;
  let y = upAt(X, n);
  const ld = lipD(X, Z);
  if (ld > -40) y = lerp(y, lowAt(X, n), smooth((ld + 6) / 34));
  // west of the river: the far bank's fields, then the western desert rising
  const rp = project(BANK, X, Z);
  if (rp.off < 0) y = lerp(y, 4.5 + Math.max(0, -rp.off - RIVER.width - 300) * 0.02, smooth(-rp.off / 60));
  y += duneAt(X, Z) + 0.5 * noise2(X / 60, Z / 60, 3) + 0.2 * noise2(X / 17, Z / 17, 4);
  y += wallAt(X, Z);
  return raw ? y : cutAt(X, Z, y + standAt(X, Z));
}

// the native ground away from the play: firm, wind-packed sand nearly everywhere; fields and palms along the
// river (the river's green line); rock on the cliffs, the quarry's faces and the monuments
export function nativeAt(X, Z) {
  if (standAt(X, Z) > 0.5) return 'stone';
  if (wallAt(X, Z) > 2.5) return 'rock';
  const qe = quarryE(X, Z); if (qe < 1.06) return qe > 0.9 ? 'rock' : 'firm';
  const rp = project(BANK, X, Z);
  if (rp.off < -RIVER.width || (rp.off >= 0 && rp.off < 95 + 30 * noise1(rp.s / 80, 41) && basinE(X, Z) > 1.25)) return 'field';
  return 'firm';
}

// ---- the built things, in world space, for the plans, the sketches and the emitter: boxes { at, w (across), l
// (along), h, rot (compass bearing of its length), y (its foot above the ground) }
const box = (at, ww, l, h, bearing = 0, more = {}) => ({ kind: 'box', at: w(at), w: ww, l, h, rot: bearing * Math.PI / 180, ...more });
export const SITES = [
  // the valley temple at the causeway's foot: a pylon front toward the river, a court, a hall
  box([100, 670], 46, 9, 15, 0, { name: 'the valley temple', stone: 1 }), box([126, 652], 6, 44, 6, 90), box([126, 688], 6, 44, 6, 90), box([150, 670], 30, 8, 9, 0),
  // the old jetty behind the 1st tee and two mooring posts
  box([-46, 0], 8, 30, 1.2, 90, { name: 'the jetty' }),
  // the Sphinx's head over its chest
  { kind: 'head', at: SPHINX.head.at, w: SPHINX.head.w, l: SPHINX.head.l, h: SPHINX.head.h, rot: SPHINX.rot, name: 'the Sphinx' },
  // the cliff temple at the wadi's head: a rock-cut front, four seated colossi before it, each 30 m
  box([1596, -836], 78, 10, 40, 85, { name: 'the cliff temple', stone: 1 }),
  ...[[1572, -876], [1568, -856], [1565, -822], [1563, -802]].map(p => ({ kind: 'colossus', at: w(p), w: 9, l: 12, h: 30, rot: 265 * Math.PI / 180, name: 'the colossi' })),
  // the expedition camp in the forecourt, left of the 9th green: 1920s dig tents, an awning, crates
  ...[[1478, -792, 20], [1492, -786, 20], [1506, -781, 20], [1520, -779, 20]].map(([x, n, b]) => ({ kind: 'tent', at: w([x, n]), w: 5, l: 7, h: 3.2, rot: b * Math.PI / 180, name: 'the camp' })),
  { kind: 'tent', at: w([1498, -800]), w: 9, l: 12, h: 3.6, rot: 20 * Math.PI / 180, awning: 1 },
  // the unfinished obelisk lying in the quarry
  { kind: 'obelisk', a: QUARRY.obelisk.a, b: QUARRY.obelisk.b, t: QUARRY.obelisk.t, name: 'the unfinished obelisk' },
];
export const LABELS = [[w([-120, 330]), 'the river'], [w([66, 40]), 'the boat basin'], [w([118, -40]), 'the beach'], [w([122, 706]), 'the valley temple'], [w([400, 690]), 'the causeway'], [w([733, 712]), 'the great pyramid'],
  [w([738, 482]), 'the Sand Sea'], [SPHINX.body.c, 'the Sphinx'], [w([900, -508]), 'the quarry'], [w([1160, -640]), 'the wadi'], [w([1596, -800]), 'the cliff temple'], [w([1500, -770]), 'the camp'], [w([1050, 420]), 'the dune sea']];
export { lipD, basinE, beachW, seaE, quarryE };
