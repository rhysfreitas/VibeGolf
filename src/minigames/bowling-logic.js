// Golf Bowling rules: pure functions (no DOM, no Three.js) so they can be unit tested.
// Frame: ball at the origin, aim down -z, metres. The lane is a long runner rug, dead flat and level
// with you. Design: docs/MINIGAMES.md §6. Ten frames, real bowling scoring.
//
// Fly it into the pins. The ball's flight comes from the physics, so its speed and the angle it
// comes in at are your real shot: a low, hot punch hits hardest, and a draw (or fade) curving into
// the pocket carries like a hook does in bowling, where a straight ball tends to get knocked off
// line by the head pin and leave one standing. A ball that lands short rolls in on the rug, which
// soaks up most of its speed (it ignores spin, so a noisy reading can't decide a frame): a weak bowl.
// A small top-down rigid-body sim knocks the pins: the ball shoves the pins it touches, pins fly
// as hard as they're hit, and a pin that tips over sweeps whatever it falls into.

export const YD = 0.9144;
export const FRAMES = 10;

// toy pins as tall as a house (you've been shrunk). Proportions of a real pin: 15 in tall,
// 4.77 in across the belly, set 12 in apart.
export const PIN_H = 9;
export const PIN_S = PIN_H * 0.8;
export const PIN_R = PIN_H * 0.159;
export const BALL_R = PIN_H * 0.25;   // the ball's reach in the pin deck (it's a game: a golf ball would slip between)
// pin action: ball mass (× a pin's), bounce, how far a toppling pin reaches (× belly radius), slide friction
export const TUNE = { mass: 4.5, e: 0.8, reach: 2.5, fallFr: 3.0, lieFr: 10.0 };
export const RUG_HALF = 15;         // the runner rug: about the width of a real lane, scaled
export const AIM_H = 3.5;             // fly it into the head pin at about chest height on a pin
// shot shapes for the simulated and ideal shots (spin axis, degrees: − draws left for a right-hander)
export const SHAPES = [{ id: 'draw', name: 'Draw', axis: -12 }, { id: 'straight', name: 'Straight', axis: 0 }, { id: 'fade', name: 'Fade', axis: 12 }];
export const KICK_X = 1.5 * PIN_S + PIN_R + 1.1; // the deck's side rails (kickbacks): pins bounce back in off them
export const WALL_Z = -206;           // the far wall of the room (under the window)
export const BUMPER_LEN = 45;        // Beginner's bumpers run this far up the lane from the pins
export const deckEnd = L => L + 3 * PIN_S * Math.sqrt(3) / 2 + 5;

export const CLUBS = [
  { id: 'HY', name: 'Hybrid', Speed: 146, VLA: 10.2, TotalSpin: 4437 },
  { id: '5i', name: '5 iron', Speed: 132, VLA: 12.1, TotalSpin: 5361 },
  { id: '6i', name: '6 iron', Speed: 126, VLA: 14.1, TotalSpin: 6231 },
  { id: '7i', name: '7 iron', Speed: 120, VLA: 16.3, TotalSpin: 7097 },
  { id: '8i', name: '8 iron', Speed: 115, VLA: 18.1, TotalSpin: 7998 },
  { id: '9i', name: '9 iron', Speed: 109, VLA: 20.4, TotalSpin: 8647 },
  { id: 'PW', name: 'Pitching wedge', Speed: 102, VLA: 24.2, TotalSpin: 9304 },
  { id: 'GW', name: 'Gap wedge', Speed: 90, VLA: 27.5, TotalSpin: 9600 },
  { id: 'SW', name: 'Sand wedge', Speed: 76, VLA: 31, TotalSpin: 9800 },
];

// difficulty is the lane length; Tour also has heavier pins, so only a pocket hit carries them all
export const DIFFICULTIES = [
  { id: 'beginner', label: 'Beginner', lane: 85, pinMass: 1, guide: true, bumpers: true, note: '85 yd lane with bumpers, and a guide line shows the best line into the pins.' },
  { id: 'amateur', label: 'Amateur', lane: 110, pinMass: 1, guide: false, note: '110 yd lane.' },
  { id: 'pro', label: 'Pro', lane: 130, pinMass: 1, guide: false, note: '130 yd lane.' },
  { id: 'tour', label: 'Tour', lane: 150, pinMass: 1.3, guide: false, note: '150 yd lane and heavier pins: come in hot and hit the pocket.' },
];

export const CHALLENGES = [
  { id: 'strike', text: 'Bowl a strike', key: 'strikes', goal: 1 },
  { id: 'spare', text: 'Pick up a spare', key: 'spares', goal: 1 },
  { id: 'spares3', text: 'Pick up 3 spares', key: 'spares', goal: 3, only: ['beginner', 'amateur'] },
  { id: 'spares2', text: 'Pick up 2 spares', key: 'spares', goal: 2, only: ['pro', 'tour'] },
  { id: 'double', text: 'Bowl a double', key: 'strikeRun', goal: 2, only: ['beginner', 'amateur'] },
  { id: 'strikes2', text: 'Bowl 2 strikes in a game', key: 'strikes', goal: 2, only: ['pro', 'tour'] },
  { id: 'marks3', text: 'Mark 3 frames in a row', key: 'markRun', goal: 3, only: ['beginner'] },
  { id: 'marks2', text: 'Mark 2 frames in a row', key: 'markRun', goal: 2, only: ['amateur', 'pro', 'tour'] },
  { id: 's120', text: 'Score 120+', key: 'score', goal: 120, only: ['beginner'] },
  { id: 's100', text: 'Score 100+', key: 'score', goal: 100, only: ['amateur'] },
  { id: 's80', text: 'Score 80+', key: 'score', goal: 80, only: ['pro', 'tour'] },
];

/* ===================== the rack ===================== */
// pin 1 at the front, rows going away; from where you stand 2/4/7 are on the left, 3/6/10 on the right
export function rack(L) {
  const h = PIN_S * Math.sqrt(3) / 2, out = [];
  let n = 1;
  for (let r = 0; r < 4; r++) for (let k = 0; k <= r; k++) out.push({ n: n++, x: (k - r / 2) * PIN_S, z: -L - r * h, row: r });
  return out;
}
export const ALL_PINS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const POS = rack(0);
const near = (a, b, d) => Math.abs(Math.hypot(a.x - b.x, a.z - b.z) - d) < 1e-6;

// A split (USBC): the head pin is down, and the pins left standing don't touch: a pin is down
// between them, or down just ahead of and between two side-by-side pins (5-6).
export function isSplit(standing) {
  const S = new Set(standing);
  if (S.has(1) || S.size < 2) return false;
  const P = POS.filter(p => S.has(p.n));
  const linked = (a, b) => {
    if (!near(a, b, PIN_S)) return false;
    if (a.row !== b.row) return true;                                           // diagonal neighbours touch
    const ahead = POS.find(q => q.row === a.row - 1 && Math.abs(q.x - (a.x + b.x) / 2) < 1e-6);
    return !ahead || S.has(ahead.n);                                             // side by side: only if the pin ahead stands
  };
  const seen = new Set([P[0].n]), stack = [P[0]];
  while (stack.length) { const a = stack.pop(); for (const b of P) if (!seen.has(b.n) && linked(a, b)) { seen.add(b.n); stack.push(b); } }
  return seen.size < P.length;
}
const SPLIT_NAMES = { '7-10': 'The bedposts', '4-6-7-10': 'The big four', '4-6-7-8-10': 'Greek church', '4-6-7-9-10': 'Greek church', '5-7-10': 'The lily', '2-7': 'Baby split', '3-10': 'Baby split', '4-6': 'Big ears' };
export const pinList = s => [...s].sort((a, b) => a - b).join('-');
export function splitName(standing) { return SPLIT_NAMES[pinList(standing)] || null; }

/* ===================== scoring ===================== */
// frames: one array of pin counts per frame, e.g. [[10], [7, 3], [9, 0], ...]
export function frameDone(fr, i) {
  if (!fr || !fr.length) return false;
  if (i < FRAMES - 1) return fr[0] === 10 || fr.length === 2;
  return fr.length === 3 || (fr.length === 2 && fr[0] + fr[1] < 10);
}
// pins standing for the next ball of frame i (the 10th re-racks after a strike or a spare)
export function pinsUp(fr, i) {
  if (!fr.length) return 10;
  if (i < FRAMES - 1) return 10 - fr[0];
  const [a, b] = fr;
  if (fr.length === 1) return a === 10 ? 10 : 10 - a;
  if (a === 10) return b === 10 ? 10 : 10 - b;
  return 10; // a spare
}
export const freshRack = (fr, i) => pinsUp(fr, i) === 10;
// cum: the running total under each frame once it can be known (null while a bonus is pending);
// total: everything knocked so far plus the bonus balls already thrown (it only ever goes up)
export function score(frames) {
  const rolls = frames.flat(), cum = [];
  let idx = 0, total = 0, run = 0, known = true;
  frames.forEach((fr, f) => {
    let val, fin;
    if (f < FRAMES - 1 && fr[0] === 10) { const b = rolls.slice(idx + 1, idx + 3); val = 10 + b.reduce((s, v) => s + v, 0); fin = b.length === 2; idx += 1; }
    else if (f < FRAMES - 1 && fr.length === 2 && fr[0] + fr[1] === 10) { const b = rolls.slice(idx + 2, idx + 3); val = 10 + b.reduce((s, v) => s + v, 0); fin = b.length === 1; idx += 2; }
    else { val = fr.reduce((s, v) => s + v, 0); fin = frameDone(fr, f); idx += fr.length; }
    total += val; known = known && fin; run += val;
    cum.push(known ? run : null);
  });
  return { cum, total };
}
// the marks for a frame on the score sheet: X strike, / spare, - a miss
export function marks(fr, i) {
  const d = v => (v === 0 ? '-' : String(v));
  if (!fr || !fr.length) return [];
  if (i < FRAMES - 1) {
    if (fr[0] === 10) return ['', 'X'];
    return [d(fr[0]), fr.length > 1 ? (fr[0] + fr[1] === 10 ? '/' : d(fr[1])) : ''];
  }
  const out = [], [a, b, c] = fr;
  out.push(a === 10 ? 'X' : d(a));
  if (b != null) out.push(a === 10 ? (b === 10 ? 'X' : d(b)) : a + b === 10 ? '/' : d(b));
  if (c != null) out.push((a === 10 && b === 10) || (a !== 10 && a + b === 10) ? (c === 10 ? 'X' : d(c)) : b + c === 10 ? '/' : d(c));
  return out;
}
// splash word for strikes in a row
export function strikeWord(run) { return run >= 6 ? `${run}-BAGGER` : ['STRIKE', 'STRIKE', 'DOUBLE', 'TURKEY', 'HAMBONE', 'FIVE-BAGGER'][run] || 'STRIKE'; }

/* ===================== the roll and the pin action ===================== */
const LAND_KEEP = 0.42;   // share of the landing speed the ball keeps on the rug (no spin: forgiving)
const DECK_KEEP = 0.82;   // landing on the hard maple pin deck keeps most of it
const ROLL_A = 1.3;       // rug rolling resistance (m/s²)
const PIN_VMAX = 30;      // the hardest a pin can be sent flying
const FLOOR_A = 0.5;      // bare floorboards off the rug
const G = 9.81, G_PIN = 9.81 * 3.5; // pins tip a little faster than real (they're light plastic)
const DT = 1 / 240, REC = 1 / 60;

function rand(seed) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0; return (s >>> 8) / 16777216; }; }

// flight: the physics points up to the first touch of the ground ({ t, p: [x, y, z] }).
// up: the pin numbers standing. Returns the ball path (for playback), each moved pin's track,
// and which pins went down.
export function bowl(flight, up, { L, pinMass = 1, bumpers = false, seed = 1 } = {}) {
  // hand over to our sim near the deck (or at the landing, whichever comes first)
  const nearDeck = p => p[1] < PIN_H + 1.5 && -p[2] > L - PIN_R - BALL_R - 1;
  let cut = flight.findIndex(q => nearDeck(q.p));
  if (cut < 1) cut = flight.length - 1;
  const a = flight[cut - 1] || flight[cut], b = flight[cut];
  const dt = (b.t - a.t) || 1 / 120;
  const st = { t: b.t, p: b.p.slice(), v: [(b.p[0] - a.p[0]) / dt, (b.p[1] - a.p[1]) / dt, (b.p[2] - a.p[2]) / dt], air: true, touched: false };
  if (st.p[1] <= 0) st.p[1] = 0;
  const pre = flight.slice(0, cut).map(q => ({ t: q.t, p: q.p.slice(), phase: 'flight' }));
  return deck(st, pre, up, { L, pinMass, bumpers, seed });
}

function deck(st, pre, up, { L, pinMass, bumpers = false, seed }) {
  const R = rand(seed), jit = s => (R() - 0.5) * 2 * s;
  const pins = rack(L).filter(p => up.includes(p.n)).map(p => ({ ...p, x0: p.x, z0: p.z, vx: 0, vz: 0, s: 0, th: 0, om: 0, dx: 0, dz: -1, y: 0, vy: 0, yaw: 0, yawV: 0, wob: 0, wobT: 0, hit: new Set(), trk: null }));
  const ballPts = pre.slice(), mb = TUNE.mass, mp = pinMass;
  let t = st.t, nextRec = t, contactT = null, landing = null, settleT = null;
  const pos = st.p, vel = st.v;
  let air = st.air, touched = st.touched, bumped = false, contact = null;

  const knock = (q, vx, vz) => {
    q.vx += vx; q.vz += vz;
    let v = Math.hypot(q.vx, q.vz); if (v < 1e-6) return;
    if (v > PIN_VMAX) { q.vx *= PIN_VMAX / v; q.vz *= PIN_VMAX / v; v = PIN_VMAX; }
    if (q.s <= 1 && v < 0.75) { q.s = 1; q.wob = Math.max(q.wob, 0.18 * v / 0.75); q.wobT = t; q.dx = q.vx / v; q.dz = q.vz / v; q.vx *= 0.2; q.vz *= 0.2; return; }
    if (q.s <= 1) { q.s = 2; q.dx = q.vx / v; q.dz = q.vz / v; q.th = Math.max(q.th, 0.06); }
    q.om = Math.max(q.om, v / (0.5 * PIN_H));
    if (v > 6.5) q.vy = Math.max(q.vy, 0.22 * v);
    q.yawV += jit(v * 0.5);
    if (!q.trk) q.trk = [];
  };
  const segDist = (bx, bz, ex, ez, px, pz) => {
    const sx = ex - bx, sz = ez - bz, l2 = sx * sx + sz * sz || 1e-9;
    const u = Math.max(0, Math.min(1, ((px - bx) * sx + (pz - bz) * sz) / l2));
    return { d: Math.hypot(bx + sx * u - px, bz + sz * u - pz), u, cx: bx + sx * u, cz: bz + sz * u };
  };

  const tMax = t + 16;
  while (t < tMax) {
    t += DT;
    /* ball */
    if (air) {
      vel[1] -= G * DT; pos[0] += vel[0] * DT; pos[1] += vel[1] * DT; pos[2] += vel[2] * DT;
      if (pos[1] <= 0) {
        pos[1] = 0;
        if (!touched) { const k = -pos[2] > L - 3 && -pos[2] < deckEnd(L) ? DECK_KEEP : LAND_KEEP; touched = true; landing = { x: pos[0], z: pos[2], t }; vel[0] *= k; vel[2] *= k; vel[1] = -vel[1] * 0.2; }
        else { vel[0] *= 0.93; vel[2] *= 0.93; vel[1] = -vel[1] * 0.3; }
        if (vel[1] < 0.7) { vel[1] = 0; air = false; }
      }
    } else {
      const s = Math.hypot(vel[0], vel[2]), a = Math.abs(pos[0]) < RUG_HALF ? ROLL_A : FLOOR_A;
      const ns = Math.max(0, s - a * DT); if (s > 0) { vel[0] *= ns / s; vel[2] *= ns / s; }
      pos[0] += vel[0] * DT; pos[2] += vel[2] * DT;
      if (bumpers && Math.abs(pos[0]) > KICK_X - BALL_R * 0.5 && Math.abs(pos[0]) < KICK_X + 2 && -pos[2] > L - BUMPER_LEN && -pos[2] < L && vel[0] * Math.sign(pos[0]) > 0) { vel[0] *= -0.5; bumped = true; }
      if (Math.abs(pos[0]) > KICK_X - BALL_R * 0.5 && Math.abs(pos[0]) < KICK_X + 1 && -pos[2] > L - 3 && -pos[2] < deckEnd(L) && vel[0] * Math.sign(pos[0]) > 0) vel[0] *= -0.4;
      if (pos[2] < WALL_Z + 3) { pos[2] = WALL_Z + 3; vel[2] = Math.abs(vel[2]) * 0.25; vel[0] *= 0.5; } // the skirting board
    }
    /* ball into standing pins */
    if (pos[1] < PIN_H * 0.92) for (const q of pins) {
      if (q.s > 1) continue;
      const dx = q.x - pos[0], dz = q.z - pos[2], d = Math.hypot(dx, dz);
      if (d >= BALL_R + PIN_R || d < 1e-6) continue;
      let nx = dx / d, nz = dz / d; const an = jit(0.3), c = Math.cos(an), sn = Math.sin(an); [nx, nz] = [nx * c - nz * sn, nx * sn + nz * c];
      const vr = (vel[0] - q.vx) * nx + (vel[2] - q.vz) * nz;
      if (vr <= 0) continue;
      const J = (1 + TUNE.e) * vr / (1 / mb + 1 / mp);   // pins fly as hard as they're hit
      if (contactT == null) { contactT = t; contact = { speed: Math.hypot(vel[0], vel[2]), angle: Math.atan2(-vel[0], -vel[2]) * 180 / Math.PI, y: pos[1] }; }
      vel[0] -= J / mb * nx; vel[2] -= J / mb * nz;
      knock(q, J / mp * nx, J / mp * nz);
    }
    /* pins */
    for (const q of pins) {
      if (q.s === 1) { if (t - q.wobT > 1.1) { q.s = 0; q.wob = 0; } continue; }
      if (q.s < 2) continue;
      const v = Math.hypot(q.vx, q.vz), fr = (q.s === 2 ? TUNE.fallFr : TUNE.lieFr) * DT;
      if (v > 0) { const k = Math.max(0, v - fr) / v; q.vx *= k; q.vz *= k; }
      q.x += q.vx * DT; q.z += q.vz * DT;
      if (-q.z > deckEnd(L) && Math.abs(q.x) < KICK_X + 3) { q.vz = Math.max(0, q.vz) * 0.2; q.vx *= 0.9; } // into the cushion
      if (Math.abs(q.x) > KICK_X - PIN_R * 0.6 && Math.abs(q.x) < KICK_X + 1 && -q.z > L - 3 && -q.z < deckEnd(L) && q.vx * Math.sign(q.x) > 0) { q.vx *= -0.85; q.dx = -q.dx; q.yawV += jit(2); }
      if (q.y > 0 || q.vy > 0) { q.vy -= G * DT; q.y = Math.max(0, q.y + q.vy * DT); if (q.y === 0) q.vy = 0; }
      q.yaw += q.yawV * DT; q.yawV *= 1 - 1.5 * DT;
      if (q.s === 2) {
        q.om += (G_PIN / PIN_H) * 1.5 * Math.sin(q.th) * DT; q.th += q.om * DT;
        if (q.th >= Math.PI / 2) { q.th = Math.PI / 2; q.s = 3; q.om = 0; }
      }
    }
    /* a falling or sliding pin into its neighbours */
    for (const q of pins) {
      if (q.s < 2) continue;
      const reach = PIN_H * (q.s === 3 ? 1 : Math.sin(q.th)), v = Math.hypot(q.vx, q.vz);
      if (q.s === 3 && v < 0.25) continue;
      const ex = q.x + q.dx * reach, ez = q.z + q.dz * reach;
      for (const o of pins) {
        if (o === q || o.s > 1 || q.hit.has(o.n)) continue;
        const sd = segDist(q.x, q.z, ex, ez, o.x, o.z);
        if (sd.d > PIN_R * TUNE.reach) continue;
        q.hit.add(o.n);
        const along = sd.u * reach;
        const vHit = q.s === 3 ? v * 0.75 : Math.max(v * 1.0, q.om * along * Math.cos(q.th) * 1.2);
        let nx = o.x - sd.cx, nz = o.z - sd.cz; const nl = Math.hypot(nx, nz) || 1; nx = nx / nl * 0.5 + q.dx * 0.5; nz = nz / nl * 0.5 + q.dz * 0.5;
        const an = jit(0.6), c = Math.cos(an), sn = Math.sin(an), l = Math.hypot(nx, nz) || 1;
        knock(o, (nx * c - nz * sn) / l * vHit * (1 / mp), (nx * sn + nz * c) / l * vHit * (1 / mp));
        if (q.s === 2) q.om *= 0.8; else { q.vx *= 0.8; q.vz *= 0.8; }
      }
    }
    /* record */
    if (t >= nextRec) {
      nextRec += REC;
      ballPts.push({ t, p: [pos[0], pos[1], pos[2]], phase: !touched ? 'flight' : air ? 'bounce' : 'roll' });
      for (const q of pins) if (q.trk || q.s === 1) {
        if (!q.trk) q.trk = [];
        const wob = q.s === 1 ? q.wob * Math.exp(-(t - q.wobT) * 3) * Math.abs(Math.sin((t - q.wobT) * 9)) : 0;
        q.trk.push([t, q.x, q.y, q.z, q.s >= 2 ? q.th : wob, Math.atan2(q.dx, q.dz), q.yaw]);
      }
    }
    /* done? */
    const moving = pins.some(q => q.s === 1 || q.s === 2 || (q.s === 3 && Math.hypot(q.vx, q.vz) > 0.05));
    const ballSpeed = Math.hypot(vel[0], vel[2]);
    if (contactT != null) {
      if (!moving && settleT == null) settleT = t;
      if (moving) settleT = null;
      if (settleT != null && t - settleT > 0.6 && t - contactT > 1.6) break;
      if (t - contactT > 6) break;
    } else if (!air && (ballSpeed < 0.02 || -pos[2] > deckEnd(L) + 2 || (-pos[2] > L + 4 && Math.abs(pos[0]) > KICK_X + 2) || Math.abs(pos[0]) > 40)) break;
  }
  const down = pins.filter(q => q.s >= 2).map(q => q.n);
  const standing = up.filter(n => !down.includes(n));
  const tracks = {}; pins.forEach(q => { if (q.trk && q.trk.length) tracks[q.n] = q.trk; });
  const enteredDeck = contactT != null;
  const lastP = ballPts[ballPts.length - 1].p;
  const reason = enteredDeck ? 'hit' : -lastP[2] < L - PIN_R - BALL_R ? 'short' : landing && -landing.z > L + 3 * PIN_S ? 'over' : 'wide';
  return { ballPts, tracks, down, standing, contactT, contact, landing, endT: t, reason, bumped };
}

// test helper: a ball already rolling at (x, z) with velocity (vx, vz)
export function rollFrom({ x, z, vx, vz }, up, opts) { return deck({ t: 0, p: [x, 0, z], v: [vx, 0, vz], air: false, touched: true }, [], up, { pinMass: 1, seed: 1, ...opts }); }

// The pocket for a full rack (measured with the sim, see tests): a hook curving left (a draw for a
// right-hander) wants the 1-3 pocket, a fade the 1-2 pocket, and a straight ball a touch lighter.
export const pocket = slope => (slope < -0.02 ? 1.75 : slope > 0.02 ? -1.75 : 1.25);

// The best line through the pins left standing, for a ball coming in the way your shot does:
// slope = sideways metres per metre downrange as it reaches the pins, speed (m/s), height and
// descent (deg). Tries lines across the deck and keeps the one that knocks the most (a little
// wiggle room counts, so it isn't a knife edge). Returns the x (metres) to cross the head pin's row.
export function bestLine(up, { L, pinMass = 1, slope = 0, speed = 14, h = AIM_H, descent = 40 } = {}) {
  const P = rack(L).filter(p => up.includes(p.n));
  if (!P.length) return 0;
  if (P.length === 10) return pocket(slope);
  const xs = [], x0 = Math.max(-KICK_X + 1, Math.min(...P.map(p => p.x)) - 4.5), x1 = Math.min(KICK_X - 1, Math.max(...P.map(p => p.x)) + 4.5);
  for (let x = x0; x <= x1 + 1e-6; x += PIN_S / 12) xs.push(x);
  const back = 4, dl = Math.hypot(slope, 1), vy = -speed * Math.tan(descent * Math.PI / 180);
  const tryX = x => {
    let n = 0;
    for (const seed of [3, 11]) { // start just short of the pins, on the way down to the crossing height
      const r = deck({ t: 0, p: [x - slope * back, Math.max(0.05, h + (-vy) * back / speed), -(L - back)], v: [slope / dl * speed, vy, -1 / dl * speed], air: true, touched: false }, [], up, { L, pinMass, seed: seed + Math.round(x * 100) });
      n += r.down.length;
    }
    return n / 2;
  };
  const got = xs.map(tryX);
  let best = -1, bx = 0;
  xs.forEach((x, i) => {
    const sc = got[i] * 2 + (got[i - 1] ?? 0) + (got[i + 1] ?? 0) - Math.abs(x) * 0.01;
    if (sc > best) { best = sc; bx = x; }
  });
  return bx;
}

/* ===================== aiming the simulated / ideal shot ===================== */
// A swing with club c at effort k (1 = full). Below full, a longer club is hit as a knockdown:
// lower launch, a little less speed and spin, so it comes in low and hot.
export function swing(c, k, hla, axis = 0) {
  return { Speed: c.Speed * (0.8 + 0.2 * k), VLA: c.VLA * (0.4 + 0.6 * k), HLA: hla, TotalSpin: c.TotalSpin * (0.6 + 0.4 * k), SpinAxis: axis };
}
// where a flight (physics points) crosses the head pin's row: height, x, slope, speed, descent.
// A ball that comes down short gets a negative height (how far short), so it stays monotonic.
export function crossing(pts, L) {
  const i = pts.findIndex(q => -q.p[2] >= L);
  if (i < 1) { const e = pts[pts.length - 1].p; return { y: -(L + e[2]) - 1, x: e[0], slope: 0, speed: 0, descent: 90, short: true }; }
  const a = pts[i - 1], b = pts[i], u = (L + a.p[2]) / (a.p[2] - b.p[2]), dt = b.t - a.t;
  const vx = (b.p[0] - a.p[0]) / dt, vz = (b.p[2] - a.p[2]) / dt, vy = (b.p[1] - a.p[1]) / dt, vh = Math.hypot(vx, vz);
  return { y: a.p[1] + (b.p[1] - a.p[1]) * u, x: a.p[0] + (b.p[0] - a.p[0]) * u, slope: vx / -vz, speed: vh, descent: Math.atan2(-vy, vh) * 180 / Math.PI };
}
// Ball data that crosses the head pin's row at (x, height h) with the given shape. club: an index
// into clubs, or null for the shortest club whose full swing gets there at that height.
// flight(ball) must return physics points on flat ground (flightOnly).
// Pass k (a swing effort already solved for this club, shape and lane) to only re-aim sideways.
export function solveInto(flight, clubs, { L, x = 0, h = AIM_H, axis = 0, club = null, k: k0 = null }) {
  const at = (c, k, hla) => crossing(flight(swing(c, k, hla, axis)), L);
  let hla = Math.atan2(x, L) * 180 / Math.PI;
  let ci = club;
  if (ci == null) { ci = 0; for (let i = clubs.length - 1; i >= 0; i--) if (at(clubs[i], 1, hla).y >= h) { ci = i; break; } }
  const c = clubs[ci];
  let k = k0 ?? 1, cr;
  for (let it = 0; it < (k0 == null ? 2 : 0); it++) {
    if (at(c, 1, hla).y > h) { let lo = 0.05, hi = 1; for (let j = 0; j < 11; j++) { k = (lo + hi) / 2; if (at(c, k, hla).y > h) hi = k; else lo = k; } }
    else k = 1;
    cr = at(c, k, hla);
    hla += Math.atan2(x - cr.x, L) * 180 / Math.PI;
  }
  for (let it = 0; it < 2; it++) { cr = at(c, k, hla); hla += Math.atan2(x - cr.x, L) * 180 / Math.PI; }
  cr = at(c, k, hla);
  return { club: ci, k, ball: swing(c, k, hla, axis), cross: cr };
}
