// Golf HORSE rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: the ball sits on the hitting deck at the origin, aim down -z, x right, y up, metres.
// The street below is TEE_H lower (a Topgolf-style bay above the first garage).
// Design: docs/MINIGAMES.md §5. The setter calls a target, a shape and a height; everyone else copies it.

export const YD = 0.9144;
export const FT = 0.3048;
export const TEE_H = 11;         // the deck is this far above the street (a top-floor bay)
export const MAX_CALLS = 24;     // made calls before the game is decided on letters (keeps games finite)

/* ---------- the street (shared by physics and the scene) ---------- */
export const STREET = { half: 15, end: -205, bulbR: 48, back: 60 };   // half-width, bulb centre z, bulb radius
export const DECK = { x: 4, zf: -1.6, zb: 5 };                         // deck: |x| < 4, zf > z > ... zb
// signed distance (m) from the edge of the asphalt: negative on the street
export function streetDist(x, z) {
  const rect = Math.max(Math.abs(x) - STREET.half, STREET.end - z, z - STREET.back);
  const bulb = Math.hypot(x, z - STREET.end) - STREET.bulbR;
  return Math.min(rect, bulb);
}
export const onDeck = (x, z) => Math.abs(x) < DECK.x && z > DECK.zf && z < DECK.zb;
// street level everywhere, the deck at the tee, low hills well beyond the houses
export function streetAt(x, z) {
  const out = Math.max(Math.abs(x) - 120, -z - 330, z - 70, 0);
  return -TEE_H + (out > 0 ? Math.min(40, out * 0.12 + (out * out) * 0.0006) : 0);
}
export const groundAt = (x, z) => (onDeck(x, z) ? 0 : streetAt(x, z));
export const surfaceAt = (x, z) => (onDeck(x, z) || streetDist(x, z) < 3.3 ? 'fairway' : 'rough'); // asphalt and sidewalks bounce

/* ---------- targets: seven Topgolf-style rings ---------- */
// yd: distance from the tee along the ground · x: yards right of the centre line
export const TARGETS = [
  { yd: 60, x: -10, color: '#ff3b55', name: 'Red' },
  { yd: 90, x: 14, color: '#ffd23d', name: 'Yellow' },
  { yd: 120, x: -16, color: '#3dff7a', name: 'Green' },
  { yd: 150, x: 6, color: '#3da5ff', name: 'Blue' },
  { yd: 180, x: -12, color: '#f2f2ff', name: 'White' },
  { yd: 210, x: 16, color: '#c35bff', name: 'Purple' },
  { yd: 240, x: 0, color: '#ff8a2a', name: 'Hoop', hoop: true },
].map((t, i) => ({ ...t, i, px: t.x * YD, pz: -Math.sqrt(t.yd * t.yd - t.x * t.x) * YD }));

// Ring size: the difficulty's radius at 150 yd, a little smaller close in and bigger far out.
export const ringR = (T, diff) => diff.r * YD * (0.6 + 0.4 * T.yd / 150);
export const BULL_FRAC = 0.4;                  // the bullseye (PERFECT MATCH) is 40% of the ring
export const bullR = (T, diff) => ringR(T, diff) * BULL_FRAC;

// Difficulty: ring size, and how clearly a shape or height has to show.
//   straight: |spin axis| at most this · curve: draw/fade need at least this much axis
//   hi / lo: a High or Low call needs the apex this far above / below a normal shot to that target
export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', r: 10, straight: 6, curve: 1.5, hi: 1.08, lo: 0.92, note: 'Big rings (about 20 yd across at 150 yd). Shapes and heights only need to show a little.' },
  { id: 'amateur', label: 'Amateur', r: 7.5, straight: 4.5, curve: 2, hi: 1.12, lo: 0.88, note: 'Medium rings (about 15 yd across at 150 yd).' },
  { id: 'pro', label: 'Pro', r: 5.5, straight: 3.5, curve: 2.5, hi: 1.15, lo: 0.85, note: 'Tight rings (about 11 yd across at 150 yd). Shapes must be clear.' },
  { id: 'tour', label: 'Tour', r: 4, straight: 2.5, curve: 3.5, hi: 1.2, lo: 0.8, note: 'Small rings (about 8 yd across at 150 yd). Straight means straight.' },
];

export const SHAPE_CALLS = ['any', 'straight', 'draw', 'fade'];
export const HEIGHT_CALLS = ['any', 'high', 'low'];
export const SHAPE_NAMES = { any: 'Any', straight: 'Straight', draw: 'Draw', fade: 'Fade' };
export const HEIGHT_NAMES = { any: 'Any', high: 'High', low: 'Low' };
// how the ideal / simulated shot plays each call (right-handed: draw starts right, curves left)
const SHAPE_MODS = { any: {}, straight: {}, draw: { hla: 2.6, axis: -7.5 }, fade: { hla: -2.6, axis: 7.5 } };
const HEIGHT_MODS = { any: {}, high: { vla: 8, spin: 1.25, speed: 0.96 }, low: { vla: -4.5, spin: 0.78 } };

export const WORDS = { HORSE: 'HORSE', PIG: 'PIG' };

export const POINTS = { call: 100, shape: 50, height: 50, perfect: 2, stump: 150, swish: 300 };
export const callValue = call => POINTS.call + (call.shape !== 'any' ? POINTS.shape : 0) + (call.height !== 'any' ? POINTS.height : 0);

export const CHALLENGES = [
  { id: 'stumpAll', text: 'Stump everyone on one call', key: 'stumpAll', goal: 1 },
  { id: 'bull2', text: 'Hit 2 bullseyes', key: 'bulls', goal: 2 },
  { id: 'clean', text: 'Win without a letter', key: 'cleanWin', goal: 1 },
  { id: 'match3', text: 'Match 3 calls', key: 'matches', goal: 3 },
  { id: 'calls3', text: 'Make 3 of your own calls', key: 'calls', goal: 3 },
  { id: 'curve2', text: 'Make or match 2 draws or fades', key: 'curves', goal: 2 },
  { id: 'tall', text: 'Make or match a High or Low call', key: 'heights', goal: 1 },
  { id: 'hoop', text: 'Land in the Hoop', key: 'hoops', goal: 1, only: ['beginner', 'amateur'] },
];

/* ---------- reading a shot ---------- */
export function shapeOf(axis, diff) {
  if (axis <= -diff.curve) return 'draw';
  if (axis >= diff.curve) return 'fade';
  return 'straight';
}
export function shapeOk(want, axis, diff) {
  if (want === 'any') return true;
  if (want === 'straight') return Math.abs(axis) <= diff.straight;
  return want === 'draw' ? axis <= -diff.curve : axis >= diff.curve;
}
// What a normal shot to a target peaks at (m above the deck): partial wedges low, full shots ~80 ft.
// A smooth line rather than a solved shot, so gaps in the club set don't make it jump around.
export const refApex = T => FT * Math.min(80, 35 + (T.yd - 60) * 0.5);
export function heightOk(want, apex, ref, diff) {
  if (want === 'high') return apex >= ref * diff.hi;
  if (want === 'low') return apex <= ref * diff.lo;
  return true;
}
export const heightLine = (want, T, diff) => (want === 'high' ? refApex(T) * diff.hi : want === 'low' ? refApex(T) * diff.lo : null);

// Which ring (if any) a landing point is in, using the shooter's ring size.
export function ringAt(x, z, diff) {
  let best = null;
  for (const T of TARGETS) { const d = Math.hypot(x - T.px, z - T.pz); if (d <= ringR(T, diff) && (!best || d < best.d)) best = { T, d }; }
  return best;
}

// Judge a shot against a call. land: {x, z} first bounce · axis: spin axis (deg) · apex (m).
export function judge(call, { land, axis, apex }, diff) {
  const T = TARGETS[call.ring], R = ringR(T, diff);
  const d = Math.hypot(land.x - T.px, land.z - T.pz);
  const inRing = d <= R, bull = d <= R * BULL_FRAC;
  const sOk = shapeOk(call.shape, axis, diff), hOk = heightOk(call.height, apex, refApex(T), diff);
  const made = inRing && sOk && hOk;
  // miss description relative to the line from the tee to the ring
  const len = Math.hypot(T.px, T.pz), ux = T.px / len, uz = T.pz / len;
  const along = (land.x - T.px) * ux + (land.z - T.pz) * uz, side = (land.x - T.px) * -uz + (land.z - T.pz) * ux;
  const dir = Math.abs(along) >= Math.abs(side) ? (along > 0 ? 'long' : 'short') : (side > 0 ? 'right' : 'left');
  const landed = ringAt(land.x, land.z, diff);
  return { made, inRing, bull, shapeOk: sOk, heightOk: hOk, shape: shapeOf(axis, diff), missYd: inRing ? 0 : (d - R) / YD, dir, landedIn: landed ? landed.T.i : -1 };
}

/* ---------- the hoop (an Easter egg: a ball through the rim) ---------- */
export const HOOP = (() => { const T = TARGETS[6]; return { x: T.px, z: T.pz, y: 10.7 - TEE_H, r: 0.85 }; })();
// pts: physics points. True if the ball drops down through the rim.
export function swish(pts) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].p, b = pts[i].p;
    if (a[1] >= HOOP.y && b[1] < HOOP.y) {
      const f = (a[1] - HOOP.y) / (a[1] - b[1]), x = a[0] + (b[0] - a[0]) * f, z = a[2] + (b[2] - a[2]) * f;
      if (Math.hypot(x - HOOP.x, z - HOOP.z) < HOOP.r) return true;
    }
  }
  return false;
}

/* ---------- turn order ---------- */
// letters: count per player · word: 'HORSE' | 'PIG'. Out once you have spelled the word.
export const isOut = (letters, word) => letters >= word.length;
export function nextActive(from, letters, word) {
  const n = letters.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (!isOut(letters[i], word)) return i; }
  return from;
}
// the players who must match the setter's call, in order after the setter
export function matchQueue(setter, letters, word) {
  const q = [], n = letters.length;
  for (let k = 1; k < n; k++) { const i = (setter + k) % n; if (!isOut(letters[i], word)) q.push(i); }
  return q;
}
export const standing = (letters, word) => letters.filter(l => !isOut(l, word)).length;
export const lettersOf = (n, word) => word.slice(0, n);

// A computer setter's call: any target, mostly a shape, sometimes a height.
export function cpuCall(rand = Math.random) {
  const pick = (opts, w) => { let r = rand() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) return opts[i]; } return opts[opts.length - 1]; };
  return { ring: Math.floor(rand() * TARGETS.length), shape: pick(SHAPE_CALLS, [3, 2, 2, 2]), height: pick(HEIGHT_CALLS, [6, 1.5, 1.5]) };
}

/* ---------- aiming help (Ideal shot, simulated Hit, the computer player) ---------- */
// Ball data for a call to target T. `sim(ball)` returns a physics result over the real street.
export function solveCall(sim, clubs, T, call) {
  const sh = SHAPE_MODS[call.shape] || {}, hm = HEIGHT_MODS[call.height] || {};
  const dist = Math.hypot(T.px, T.pz), aim = Math.atan2(T.px, -T.pz) * 180 / Math.PI;
  const ball = (c, k, hla) => ({
    Speed: c.Speed * k * (hm.speed || 1), VLA: c.VLA + (1 - k) * 7 + (hm.vla || 0), HLA: hla,
    TotalSpin: c.TotalSpin * (0.65 + 0.35 * k) * (hm.spin || 1), SpinAxis: sh.axis || 0,
  });
  // r.carry / r.carryOffline are measured at the first bounce, so `sim` may stop there (flightOnly)
  const land = b => { const r = sim(b), x = r.carryOffline * YD, z = -r.carry * YD; return { r, x, z, carry: Math.hypot(x, z) }; };
  let hla = aim + (sh.hla || 0);
  // shortest club whose full swing gets there; a Low call takes one more club and swings easier
  let ci = 0;
  for (let i = clubs.length - 1; i >= 0; i--) { if (land(ball(clubs[i], 1, hla)).carry >= dist) { ci = i; break; } }
  if (call.height === 'low' && ci > 0) ci--;
  const c = clubs[ci];
  let k = 1, out = null;
  for (let pass = 0; pass < 3; pass++) {
    let lo = 0.3, hi = 1; out = land(ball(c, 1, hla)); k = 1;
    if (out.carry > dist) { for (let it = 0; it < 14; it++) { k = (lo + hi) / 2; out = land(ball(c, k, hla)); if (out.carry > dist) hi = k; else lo = k; } }
    if (pass < 2) hla += aim - Math.atan2(out.x, -out.z) * 180 / Math.PI;   // steer the start line so the curve finishes on target
  }
  return { club: ci, k, ball: ball(c, k, hla), apex: out.r.apexFt * FT, flightTime: out.r.flightTime };
}
