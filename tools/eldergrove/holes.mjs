// Eldergrove, plan book round 1: the first tree course. Nine holes on the floor of an ancient forest of conifers
// about 100 m tall, a misty morning with low sun shafts between the trunks, one colossal heart tree at the heart. The
// concept, the skeleton (par 36: 4 5 4 4 4 3 5 3 4), the routing and the nine hole cards were approved by Rhys on 14
// November 2026 (claude/eldergrove-layout.md in the project); this file draws them: real fairway outlines from the
// forms, green shapes, heights, the tee sets and the Ironwood tips spot on every hole, targets, and every giant trunk
// near the lines of play placed on purpose (`trunks`; the far forest is scattered in scene.mjs, 78 m or more off
// every line).
// Its logic: the trunks are walls (a ball that hits one drops at its foot 45% of the time, Rhys's pick, else it comes
// back off the bark) and the canopy is a roof far above any shot (a crown from 60 to 100 m up knocks a skied ball
// down). Lies: moss (first cut), fern (rough), leaf litter (beach: firm, it runs), root (native: it kicks). Almost no
// penalty ground: the brook (by the 1st green, the 6th, the 7th) and the pool on the 4th.
// Each hole is written in its own frame (metres; tee at the origin, the hole runs toward -z, x is right of the line,
// y up from the hole's `base`, the back tee's height). `route` turns the layout doc's world line ([x east, n north])
// into `legs` and `place`; `L(x, n)` turns a world point into the hole's frame. The height along each line follows
// the world's floor (world.mjs), with `prof` knots [[s, dy]] added to it.
//
// Two bends differ from the layout doc's table, measured from its own lines (the lines are what Rhys approved): the
// 1st bends LEFT 26° (the table says right), and the 9th bends right 76° (the table says 50°).
import { lineOf, lengthOf, at, headingAt, YD } from './geo.mjs';
import { LINES, FALLEN } from './world.mjs';

export const COURSE = {
  id: 'eldergrove', name: 'Eldergrove', theme: 'grove', altFt: 1200,
  signature: { time: 'early morning', light: 'a misty morning: low sun shafts through fog between the trunks, green shade, bright pools where the sun reaches the floor; the Glade in full sun', wind: 'calm under the trees, a light breeze in the Glade', weather: 'mist clearing', temp: 'cool' },
  teeSets: [
    { id: 'redwood', name: 'Redwood', color: '#7a2e1f', minDrive: 260 },
    { id: 'cedar', name: 'Cedar', color: '#b5762e', minDrive: 230 },
    { id: 'rowan', name: 'Rowan', color: '#c9402f', minDrive: 200 },
    { id: 'hazel', name: 'Hazel', color: '#d9c27a', minDrive: 0 },
  ],
  // the tips tee, switched off (docs/COURSE-DESIGN.md "The tips tee: an option in the data"): kept out of teeSets
  tipsSet: { id: 'ironwood', name: 'Ironwood', color: '#3b3f44', minDrive: 290 },
  card: {
    hook: 'Golf on the floor of a forest older than memory: conifers 100 m tall, trunks 8 to 12 m across, the first branches 60 m up. One logic: the trunks are walls (a ball that hits one drops at its foot about half the time, otherwise it comes back off the bark) and the canopy is a roof far above any shot (only a skied ball reaches it, and it is knocked down). Almost no penalty ground: the cost of a miss is being blocked out.',
    skeleton: 'Par 36: 4 5 4 4 4 3 5 3 4 (the traditional card). In from the meadow on a gentle opener; the Avenue (560 yd dead straight) as the early showpiece; the hardest pair 4 and 5; the Stair (a tee 25 m up a living tree) the breather; a reachable par 5 and a long par 3; the finish down into an amphitheatre of roots under the heart tree.',
    classics: 'Cape (4: the pool), Long (7: the ravine where the second wants to finish). Set pieces: the chute (1: through two gate trees), the wall (8: the burnt shell\'s walls return a long ball). Two more classics welcome.',
    decisions: 'Four, each a different type: high road or low road (3: the fallen giant\'s back or the floor beside it), bite off what you dare (4: across the pool), go or lay up (7: over the ravine in two), centre-line hazard (9: left or right of the root). One in the last two holes.',
    landmarks: 'The heart tree: the reveal is the 9th tee, where it fills the frame 245 m away (Rhys, 14 November: from 1 to 8 it stands 50-85° left of the shot, outside the fixed camera\'s view, glimpsed sideways and from the 1st\'s fan, and reflected in the 4th\'s pool off to the left). The Glade\'s light (from 4 and 6). The fallen giant\'s root plate (from the 2nd green and the 4th tee).',
    rhythm: 'A gentle opener down a valley that feeds; the Avenue straight after; the hardest holes 4 and 5 (across the pool, then up the Glade\'s hillside); the Stair the breather; the Brook reachable; the Hollow a long iron uphill; the Hall to finish under the heart tree. Par 3s 150 and 190; par 4s 335, 400, 420, 440, 465; par 5s 505 and 560.',
    forms: 'Seven fairways, seven forms: 1 fan, 2 strip (an avenue), 3 split, 4 hook, 5 wide strip, 7 broken, 9 island. The two plain strips are on purpose (the Avenue, the Glade). A trunk beside every fairway, each hole\'s trees doing a different job.',
    heights: '1 half-pipe (a stream valley), 2 crest and run, 3 stepped (bold: high road, low road), 4 level (the pool\'s shore), 5 hillside bench 9% across (bold), 6 the drop (the only one: a tee 25 m up a tree), 7 dip in front (the ravine), 8 uphill to a shelf, 9 fall-away into the amphitheatre.',
    dials: 'One pushed on every hole: 1 a chute (two gate trees 45 m apart), 2 width (34 m between the colonnade\'s fern, 560 yd dead straight: past real golf), 3 length (335 yd), 4 a carry (as much pool as you dare), 5 width (75 m of meadow), 6 height (a tee 25 m up a living tree), 7 length (505 yd, reachable), 8 green inside a burnt-out trunk\'s shell, 9 green surround (an amphitheatre of roots).',
    newBorrowed: 'New to the register: the first tree-lined course; a tunnel of trees; a fairway along a fallen trunk; a tee in a living tree; a meadow hole; a green in a natural amphitheatre; moss and leaf-litter lies. Borrowed (two): a tee shot off a height (the Stair), a green inside a shell (the Hollow). No waterfall, bridge in play, chasm, punchbowl, arch or climb to the clubhouse.',
  },
};
export const BACK = 'redwood', FRONT = 'hazel';

// the layout doc's line ([x east, n north] tee, corners, pin) as a place and legs
function route(pts) {
  const b = pts.slice(1).map((p, i) => Math.atan2(p[0] - pts[i][0], p[1] - pts[i][1]) * 180 / Math.PI);
  const turn = (a, c) => ((c - a + 540) % 360) - 180;
  return { place: { at: [pts[0][0], -pts[0][1]], heading: (b[0] + 360) % 360 }, legs: pts.slice(1).map((p, i) => [Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), i ? turn(b[i - 1], b[i]) : 0]), world: pts };
}
// a world point [x east, n north] in a hole's frame
const localOf = place => (x, n) => {
  const a = place.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a), dx = x - place.at[0], dz = -n - place.at[1];
  return [dx * rx + dz * rz, -(dx * fx + dz * fz)];
};

// a giant trunk: [s along the line, off to its right, r]; or { world: [x, n], r }. r is the trunk's radius at the
// floor (8-12 m across); each is about 100 m tall, its crown from 60 m up (scene.mjs). `job` says why it stands there.
const row = (s0, s1, step, off, r, jit = 0, seed = 1) => { const out = []; let k = 0; for (let s = s0; s <= s1 + 0.01; s += step, k++) { const j = Math.sin((k + 1) * 12.9898 * seed) * 43758.5453; out.push([s, off + jit * ((j - Math.floor(j)) * 2 - 1), r + 0.6 * (((j * 7) % 1 + 1) % 1 - 0.5)]); } return out; };

function hole(def) {
  const R = route(def.world), L = lineOf(R.legs), len = lengthOf(L), P = (s, o = 0) => at(L, s, o), Lw = localOf(R.place);
  const h = def.build(P, L, len, Lw);
  h.line = L; h.len = len; h.pin = L.at(-1); h.place = R.place; h.legs = R.legs; h.L = Lw;
  if (h.green && h.green.k) h.green.lobes = h.green.lobes.map(([u, v, rx, rz, rot = 0]) => [u * h.green.k, v * h.green.k, rx * h.green.k, rz * h.green.k, rot]);
  h.teePts = {};
  for (const [k, v] of Object.entries(h.tees)) h.teePts[k] = typeof v === 'number' ? P(v) : v.world ? Lw(...v.world) : P(v[0], v[1]);
  // card yards: along the line on a par 4 or 5; on a par 3 straight from the pad to the pin
  const yd = (v, p) => Math.round((def.par === 3 ? Math.hypot(p[0] - h.pin[0], p[1] - h.pin[1]) : len - (typeof v === 'number' ? v : v[0])) / YD / 5) * 5;
  h.yards = {};
  for (const [k, v] of Object.entries(h.tees)) h.yards[k] = yd(v, h.teePts[k]);
  const tp = def.tips || (def.par === 3 ? [-14, 0] : [-34, 0]);
  h.tipsPt = P(...tp); h.tipsYards = yd(tp, h.tipsPt);
  if (def.par !== 3 && tp[1]) { const b = h.teePts[BACK]; h.tipsYards = Math.round((h.yards[BACK] + Math.hypot(h.tipsPt[0] - b[0], h.tipsPt[1] - b[1]) / YD) / 5) * 5; }
  h.tips = { tee: h.tipsPt, yards: h.tipsYards };
  // the trunks in the hole's frame: { x, z, r, job }
  h.trunkPts = (h.trunks || []).flatMap(T => (T.list || [T]).map(t => {
    const p = Array.isArray(t) ? P(t[0], t[1]) : t.world ? Lw(...t.world) : t.at ? t.at : P(t.s, t.off);
    return { x: p[0], z: p[1], r: Array.isArray(t) ? t[2] : t.r, job: T.job || t.job || '', ...(t.tall ? { tall: t.tall, low: t.low } : {}), ...(t.snag ? { snag: true, h: t.h } : {}), ...(t.marker ? { marker: true } : {}) };
  }));
  return { ...def, ...h };
}
const sand = (at, rx, rz = rx, rot = 0, more = {}) => ({ at, rx, rz, rot, ...more });
// the fallen giant's back in a hole's frame: a point `t` metres along its axis from the crown end, `o` off it (+ right)
const onTrunk = (Lw, t, o = 0) => { const A = Lw(FALLEN.a[0], -FALLEN.a[1]), B = Lw(FALLEN.b[0], -FALLEN.b[1]), l = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / l, (B[1] - A[1]) / l]; return [A[0] + u[0] * t - u[1] * o, A[1] + u[1] * t + u[0] * o]; };
// the high road: mown 27 m wide along the trunk's back, from the top of the ramp to 6 m short of its root end
const highRoad = Lw => { const A = Lw(FALLEN.a[0], -FALLEN.a[1]), B = Lw(FALLEN.b[0], -FALLEN.b[1]), l = Math.hypot(B[0] - A[0], B[1] - A[1]), P = [];
  for (let t = 38; t <= l - 6; t += 8) P.push(onTrunk(Lw, t, 13.5)); for (let t = l - 6; t >= 38; t -= 8) P.push(onTrunk(Lw, t, -13.5)); return P; };

export const HOLES = [
  // 1. THE EAVES: in from the bright meadow, down a stream valley and through two gate trees into the forest
  hole({ n: 1, name: 'The Eaves', par: 4, world: LINES[0], tips: [-36, 0], shape: 'Dogleg left (26°), down the valley',
    build: (P, L, len) => ({
      tees: { redwood: 0, cedar: [22, 7], rowan: [50, -6], hazel: [86, 0] },
      // a fan: 32 m through the gate, opening all the way to the green
      fw: [{ e: [[108, 15, 15], [130, 16, 17], [165, 20, 20], [205, 24, 24], [238, 27, 26], [275, 30, 29], [305, 31, 30], [330, 25, 23], [345, 15, 14], [356, 9, 9]], wob: 3 }],
      // the half-pipe: the valley's banks rise 4 m by 40 m off the line and feed a loose drive back (mown up the
      // lower bank, moss above)
      cross: [[95, 352, 4, 40]], mown: 0.2,
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 16, -14), 4.5, 3.2, 0.5), sand(P(len + 13, -9), 3.6, 2.8, -0.3)],
      green: { k: 0.93, lobes: [[0, 0, 13, 15, 12], [-6, 9, 7.5, 6.5, 0], [5, -8, 6.5, 6, 0]], apron: 3, contour: [{ fall: 10, pct: 1.8 }, { ridge: [[-11, 8], [9, 9]], h: 0.3, w: 3 }], style: 'Big and open from the front, set a little right of the line toward the brook, falling 1.8% toward you, a low spine across its middle; two small sand hollows on the left' },
      trunks: [
        { job: 'the gate: two trees 45 m apart at 130 yd', list: [[119, -27.5, 5], [119, 27.5, 5]] },
        { job: 'the eaves: the forest\'s edge, a funnel toward the gate', list: [[38, -48, 4.6], [42, 52, 5], [74, -41, 4.8], [80, 43, 4.4]] },
        { job: 'the valley\'s sides', list: [...row(165, 335, 44, -56, 4.8, 5, 1.3), ...row(185, 315, 44, 58, 4.6, 5, 2.1)] },
        { job: 'behind the green', list: [[402, -30, 5], [406, 33, 4.6], [428, 2, 5.2]] },
      ],
      targets: [{ name: 'The fan', at: P(236, 3) }],
      words: {
        story: 'The eaves: in from the bright meadow, through the gate into the trees.',
        plays: 'From a tee in the open meadow the hole runs down a stream valley into the forest, and at 130 yd two giant trunks stand either side of the line 45 m apart: the gate. It only catches a real mishit. Beyond it the fairway fans out to 55 m where drives land, and the valley\'s banks feed a loose drive back down. The hole bends 26° left past the gate. A mid iron to a big open green; the brook runs round its back and right side, the only penalty on the hole.',
        safe: 'Driver through the gate to the fan (236 m), a mid iron in.',
        bold: null,
        miss: 'Through the gate wide: the valley\'s banks (moss, then fern) feed it back. Into a gate tree: about half drop at its foot, the rest come back toward you. At the green, the brook right and long; two sand hollows left; the safe miss is short and left.',
      },
      card: {
        type: 'Original (a gentle opener)', form: 'Fan', feature: 'The gate: two giant trunks 45 m apart at 130 yd; the valley\'s banks', job: 'The gate is a frame (the tee shot is seen through it) and an obstacle for a real mishit only; the banks are helpers (they feed a loose drive back)',
        decision: 'None: one clear line through the gate', miss: 'Small: moss on the banks. Medium: fern up the banks, a gate tree. Big: the forest floor beyond the valley\'s sides. Penalty only at the green: the brook right and long. Safe miss at the green: short left',
        view: 'In front the meadow and the forest\'s edge; in the middle the two gate trees framing the fairway; beyond, the valley running down into the trees and the light on the green. The landing area shows through the gate',
        ground: 'Half-pipe: a valley banked 4 m on both sides from the gate to the green; −6 m tee to green',
        height: 'Half-pipe', dial: 'A chute: two gate trees 45 m apart at 130 yd', shots: { tee: 'Straight, through the gate', approach: 'A mid iron to a big open green' }, hazard: 'Behind and right of the green: the brook', surround: 'Water: the brook behind and right; sand left', setPiece: 'The chute (the gate)',
      },
    }),
  }),

  // 2. THE AVENUE: 560 yd dead straight down a colonnade of trunks
  hole({ n: 2, name: 'The Avenue', par: 5, world: LINES[1], tips: [-36, 0], shape: 'Dead straight', tight: true,
    build: (P, L, len) => {
      // the colonnade: trunk faces 24 m either side of the line (34 m of fairway, 7 m of soft fern each side), a
      // trunk every 35 m, the two rows staggered; from 262 to 318 m the rows step out 4 m where the forward tees'
      // drives land, and the fairway widens to 40 m there
      const out = s => s > 255 && s < 325 ? 4 : 0;
      const colL = [], colR = [];
      for (let s = 32; s <= 482; s += 35) colL.push([s, -(29 + out(s)), 5 + 0.4 * Math.sin(s)]);
      for (let s = 49.5; s <= 482; s += 35) colR.push([s, 29 + out(s), 5 + 0.4 * Math.cos(s)]);
      return {
        tees: { redwood: 0, cedar: [60, 0], rowan: [105, 0], hazel: [145, 0] },
        // a strip: 34 m, dead straight; 40 m from 262 to 318 m (the forward tees' landing); the nave of moss before it
        // holds the forward tees
        fw: [{ e: [[180, 17, 17], [250, 17, 17], [266, 21, 21], [314, 21, 21], [330, 17, 17], [470, 17, 17], [490, 14, 14], [500, 10, 10]], wob: 0.8 }],
        fern: 7, prof: [[0, 0], [170, 0], [238, 3.2], [300, 0], [len, 0]],   // the crest at 260 yd (the floor's own crest, sharpened)
        green: { lobes: [[0, 0, 11, 14.5, 0], [0, 10, 7, 5.5, 0]], apron: 4, contour: [{ fall: 0, pct: 1.6 }, { tier: [0, 4], up: 180, h: 0.4, w: 4 }], style: 'Square to the avenue, deeper than wide, falling 1.6% toward you with a back tier 0.4 m up; mossy banks either side and the colonnade closing round behind it' },
        trunks: [
          { job: 'the colonnade: two rows, a trunk every 35 m, staggered', list: [...colL, ...colR] },
          { job: 'the apse behind the green', list: [[548, -26, 5.2], [552, 27, 5.4], [576, 0, 5.6]] },
        ],
        targets: [{ name: 'The crest', at: P(238, 0) }, { name: 'The lay-up', at: P(418, 0) }],
        words: {
          story: 'The Avenue: a colonnade of trunks 100 m tall, dead straight for 560 yd.',
          plays: 'The nine\'s one tight hole and the hole past real golf: 560 yd dead straight down a colonnade of trunks 48 m apart, 34 m of fairway with 7 m of soft fern each side and a trunk every 35 m. The rows are staggered, so between any two trunks there is a gap of about 25 m out to the forest floor. A crest crosses at 260 yd: carry it and the ball runs on down the far side. Three straight shots: shape is punished, length isn\'t needed. The forward tees stand down the mossy nave, and where their drives land the rows step out and the fairway widens to 40 m.',
          safe: 'Three straight shots: over the crest (238 m), to the lay-up (418 m), a wedge.',
          bold: null,
          miss: 'Small: the fern. Medium: a trunk (about half drop at the foot, the rest come back toward the fairway) or out through a gap onto the leaf litter, a chip back between the trunks. No penalty ground anywhere.',
        },
        card: {
          type: 'Original (the hole past real golf)', form: 'Strip (an avenue)', feature: 'The colonnade: two rows of giant trunks, 48 m apart, a trunk every 35 m', job: 'An obstacle for the miss (a trunk drops a ball at its foot) and a frame for the whole hole',
          decision: 'None: one clear line, three times', miss: 'Small: the fern. Medium: a trunk, or through a gap onto the litter (a chip out between the trunks). Big: deep in the forest. No penalty ground. Safe miss at the green: short',
          view: 'In front the mossy nave; in the middle the colonnade converging on the crest; beyond, the light at the far end where the green is. The crest shows; the landing beyond it does not (it runs on)',
          ground: 'Crest and run: a crest 4 m over the ground at 260 yd, the fairway running down beyond it; +5 m tee to green',
          height: 'Crest and run', dial: 'Width: 34 m between the fern, 560 yd dead straight under 100 m trees (past real golf)', shots: { tee: 'Dead straight', approach: 'A full wedge (the third)' }, hazard: 'Down both sides: the colonnade', surround: 'Moss banks; the apse of trunks behind',
        },
      };
    },
  }),

  // 3. THE FALLEN GIANT: high road along the fallen trunk's back, or low road on the floor beside it
  hole({ n: 3, name: 'The Fallen Giant', par: 4, world: LINES[2], tips: [-30, 0], shape: 'A slight dogleg right (8°)', split: true,
    build: (P, L, len, Lw) => {
      const ax = (s) => { const t = (s - 61) / (229 - 61); return -36 + 14 * t; };   // about where the trunk's axis lies, metres left of the line
      const hr = onTrunk(Lw, 118);   // the high road's target on the trunk's back, and the marker beyond it
      return {
        tees: { redwood: 0, cedar: [18, 10], rowan: [45, -6], hazel: [76, 20] },
        // split: the high road mown along the trunk's back (26 m), the low road on the floor to its right (about 50 m)
        fw: [{ poly: highRoad(Lw), wob: 1 },
          { e: [[96, 12, 34], [150, 9, 41], [205, 6, 42], [245, 5, 36], [266, 8, 24], [276, 8, 14]], wob: 2.6 }],
        // the green on the upper level, level with the trunk's back; a bank 5-6 m up from the low road
        prof: [[0, 0], [len, 0]],
        bunkers: [sand(P(len - 15, 13), 5.4, 3.8, 0.3)],
        green: { k: 1.06, lobes: [[0, 0, 10, 12, -18], [-4, 7, 5.5, 5, 0]], apron: 2, contour: [{ fall: 200, pct: 1.6 }, { bowl: [-4, 9], r: 8, h: 0.25 }], style: 'Small, up on the high level, set a little left so the high road plays down its length; it falls 1.6% toward the back left with a shallow bowl; one sand hollow front right, the bank down to the low road in front' },
        trunks: [
          { job: 'the far side of the low road', list: [[118, 62, 5], [172, 66, 5.4], [226, 60, 4.8]] },
          { job: 'beyond the fern under the fallen giant', list: [[112, -82, 5], [186, -74, 5.2]] },
          { job: 'behind the green', list: [[342, -22, 5], [348, 26, 4.8]] },
          { job: 'the marker: a young fir growing out of the trunk\'s back, the high road\'s line', list: [{ at: onTrunk(Lw, 132), r: 0.7, snag: true, h: 9, marker: true }] },
        ],
        reliefLine: [[0, 0], onTrunk(Lw, 20), onTrunk(Lw, 160), P(250, -2), P(272, 2), L.at(-1)],   // read on the high road: up the ramp onto the trunk's back, off its end to the low road, up the bank to the green (the two levels side by side)
        targets: [{ name: 'The low road', at: P(226, 20) }, { name: 'The high road', at: hr, bold: true }],
        boldPath: hr,
        words: {
          story: 'The fallen giant: a trunk 28 m across lying along the hole, its back the high road.',
          plays: 'A fallen giant lies along the left of the hole, its mossy back 28 m wide and 6 m up. The high road: up the ramp of its broken crown onto its back, a 3 wood or a hybrid (about 200 yd) to a flat lie with the green in sight, then a wedge down its length. The low road: driver on the forest floor beside it, 50 m wide; from there the green is up a bank 6 m above you and the trunk\'s end hides its left half: a blind pitch. The root plate stands on end where the trunk ends.',
          safe: 'Driver down the low road (226 m), a blind pitch up to the green.',
          bold: 'A 3 wood or hybrid onto the trunk\'s back (178 m), a wedge in with the green in sight.',
          miss: 'Off the trunk\'s right side: the low road. Off its left: fern under the trunk, blocked, a shot out along the floor. Right of the low road: fern, then the forest floor. At the green, a sand hollow front right; short, the bank sends it back down.',
        },
        card: {
          type: 'Original (high road, low road)', form: 'Split (the trunk\'s back and the floor)', feature: 'The fallen giant (28 m wide, 6 m up) and its root plate', job: 'Its back is the high road (a lie-setter: flat, the view); its flank is an obstacle and a frame; the root plate is a landmark',
          decision: 'High road, low road: the trunk\'s back (about 200 yd, a flat lie and a wedge in sight) or the floor beside it (driver, 50 m wide, a blind pitch up the bank)',
          miss: 'Small: moss along the trunk\'s edges, fern beside the low road. Medium: fern under the trunk (blocked, a shot out), the forest floor. Big: deep in the forest. No penalty ground. Safe miss at the green: left (high side)',
          view: 'In front the ramp of broken crown; in the middle the trunk\'s back running away and the low road beside it; beyond, the root plate and the light on the green, the heart tree glimpsed far left. Both roads show',
          ground: 'Stepped: the trunk\'s back and the green 6 m over the low road; +5 m tee to green',
          height: 'Stepped (high road, low road)', dial: 'Length: 335 yd', shots: { tee: 'A lay-up to a number onto the trunk (bold), or driver straight (low road)', approach: 'A wedge with the green in sight, or a blind pitch up a bank' }, hazard: 'Down the left: the fallen giant', surround: 'A drop (the bank down to the low road); sand front right',
        },
      };
    },
  }),

  // 4. THE MIRROR: a cape round a black, still pool
  hole({ n: 4, name: 'The Mirror', par: 4, world: LINES[3], tips: [-28, -28], shape: 'Dogleg left (39°) round the pool',
    build: (P, L, len, Lw) => ({
      tees: { redwood: 0, cedar: [20, -8], rowan: [50, 6], hazel: [100, -42] },
      // a hook: the fairway wraps round the pool's east and north shores; the bold drive lands on its inside lobe
      fw: [{ e: [[76, 14, 20], [120, 18, 26], [175, 22, 30], [215, 26, 32], [255, 24, 27], [300, 18, 20], [345, 14, 15], [366, 10, 10], [374, 7, 7]], wob: 3 },
        { lobes: [[262, -30, 30, 20, -25]], join: 12, wob: 2.5 }],
      formLine: [[0, 0], L.at(-1)],   // a hook is read against the straight line from tee to green, which it wraps round
      cant: [[140, 270, 5]],   // leans away from the water (falls to the right: 3% where drives land, the floor leaning back toward the pool)
      prof: [[0, 0], [len, 0]],
      bunkers: [sand(P(len - 10, 16), 4.2, 3.4, -0.2)],
      green: { k: 0.96, lobes: [[0, 0, 12, 17, -14], [-5, 12, 7, 6, 0], [4, -10, 6, 5, 0]], apron: 3, contour: [{ fall: 30, pct: 1.7 }, { tier: [0, 3], up: 200, h: 0.45, w: 4 }], style: 'Long and angled along the bold line (its long axis turns left), falling 1.7% toward the front right with a tier across its back; a sand hollow right; the pool\'s mossy beach short left' },
      trunks: [
        { job: 'the frame for the tee shot', list: [[40, -40, 4.8], [44, 42, 5]] },
        { job: 'outside the bend', list: [[118, 56, 5], [176, 60, 5.2], [236, 56, 4.8]] },
        { job: 'the frame behind the green', list: [[404, -30, 5], [410, 32, 5.4]] },
        { job: 'the pool\'s far shore (they stand in the reflection)', list: [{ world: [302, 38], r: 5.2 }, { world: [304, 110], r: 5 }, { world: [334, -4], r: 4.8 }] },
      ],
      targets: [{ name: 'Round the shore', at: P(228, 8) }, { name: 'Over the water', at: Lw(408, 124), bold: true }],
      boldPath: Lw(408, 124),
      words: {
        story: 'The mirror: a black, still pool, the heart tree standing whole in it.',
        plays: 'A cape round a black, still pool inside the bend. The safe drive goes up the right, never crosses water and leaves about 160 yd. The more of the pool the drive carries, the shorter the second (up to 40 yd less) and the better the angle into a long green set along the bold line. A mossy beach on the near shore catches a drive that bails out short of the water. The fairway leans 3% away from the pool. From the landing area the heart tree is seen whole for the first time, standing in the water.',
        safe: 'Up the right round the shore (228 m), a mid iron in.',
        bold: 'Across the pool to its north shore (about 250 m from the tee), a short iron along the green.',
        miss: 'Left: the mossy beach, then the pool (a stroke and a drop). Right: fern, then the trunks outside the bend. At the green, a sand hollow right; the pool short left.',
      },
      card: {
        type: 'Cape', form: 'Hook', feature: 'The pool, and the heart tree reflected in it', job: 'The pool is the hazard for the bold line; the mossy beach is a helper (it catches a bail-out); the reflection is the reveal',
        decision: 'Bite off what you dare: the more pool you carry, the shorter the second (up to 40 yd) and the better the angle into the green',
        miss: 'Small: moss, the beach. Medium: fern, a trunk outside the bend. Big: the pool, left only (penalty on one side). Safe miss: right',
        view: 'In front two framing trunks; in the middle the pool, black and still, and the fairway round its shore; beyond, the light on the green and the Glade\'s brightness through the trees. Both lines show',
        ground: 'Level: the pool\'s shore (+1 m), the fairway leaning 3% away from the water',
        height: 'Level (the pool\'s shore)', dial: 'A carry: as much of the pool as you dare', shots: { tee: 'A draw round the pool, or a carry across it', approach: 'A short iron along the green from the bold side, a mid iron across it from the safe side' }, hazard: 'Diagonal: the pool', surround: 'Water short left; sand right',
      },
    }),
  }),

  // 5. THE GLADE: out of the trees into full sun, up a meadow on a hillside
  hole({ n: 5, name: 'The Glade', par: 4, world: LINES[4], tips: [-34, 0], shape: 'Dogleg left (38°) up the hillside', flat: 44, fade: 40,
    build: (P, L, len) => ({
      tees: { redwood: 0, cedar: [14, 0], rowan: [64, -4], hazel: [118, 50] },
      // a wide strip: 75 m of meadow where drives land (the ball finishes well below where it lands)
      fw: [{ e: [[90, 12, 20], [130, 22, 40], [200, 28, 52], [262, 28, 56], [322, 28, 42], [372, 21, 24], [398, 15, 15], [412, 10, 10]], wob: 3.5 }],   // fuller on the high side
      meadow: true,
      cant: [[60, 360, -10]],   // the hillside bench: 9% falling to the left (south) across the landing area
      prof: [[0, 0], [len, 0]],
      bunkers: [],
      green: { k: 0.97, lobes: [[0, 0, 15, 18, -10], [-7, 11, 9, 8, 0], [7, -10, 8.5, 7, 0]], apron: 5, contour: [{ fall: 260, pct: 1.6 }, { bowl: [-8, 10], r: 10, h: 0.3 }], style: 'Big and open, set across the slope; it falls 1.6% to the left (the hillside), a feeding bank on the high (right) side and a hollow on the low side; run it in from the right' },
      trunks: [
        { job: 'the doorway into the sun', list: [[28, -21, 5.5], [32, 23, 5.8]] },
        { job: 'the Glade\'s far edge, behind the green (none toward the 6th tee: its platform stays open above)', list: [[458, -36, 5], [466, 32, 5.2]] },
        { job: 'the lone silver snag on the high side: the aim point', list: [{ s: 255, off: 46, r: 1.8, snag: true, h: 34 }] },
      ],
      targets: [{ name: 'Up the high side', at: P(240, 16) }],
      words: {
        story: 'The Glade: out of the trees into full sun, up a wildflower meadow on a hillside.',
        plays: 'Through a doorway of two trunks out into full sun: a wildflower meadow on a hillside leaning 9% to the left, ball above your feet for the second. The fairway is 75 m wide because the ball finishes well below where it lands. Hold the drive up the high side, aiming at the lone silver snag, and a long iron from a hanging lie runs in from the right onto a big open green; a feeding bank on its high side, a hollow on the low side. No penalty ground anywhere.',
        safe: 'Up the high side at the snag (240 m), a long iron run in from the right.',
        bold: null,
        miss: 'Left (the low side): the meadow, everything feeds down; a longer, uphill second. Right (the high side): the meadow, a hanging lie above the green. No penalty ground. At the green, the bank right feeds; the hollow left.',
      },
      card: {
        type: 'Original (the meadow hole)', form: 'Wide strip', feature: 'The Glade: a sunlit meadow on a 9% hillside; the lone silver snag', job: 'The hillside is a lie-setter (ball above your feet); the snag is the aim point; the green\'s high bank is a helper',
        decision: 'None: one wide line, the slope is the question', miss: 'Small: the meadow. Medium: well down the slope (the angle and the stance worse). Big: the Glade\'s edge and the trees. No penalty ground. Safe miss at the green: right (the bank feeds)',
        view: 'In front the doorway of two trunks; in the middle the bright meadow climbing away and the snag on the high side; beyond, the Glade\'s far edge, the green in sun. The landing area shows',
        ground: 'Hillside bench: 9% across (falling left) and climbing; +13 m tee to green',
        height: 'Hillside bench', dial: 'Width: 75 m of open meadow', shots: { tee: 'A fade held up the high side', approach: 'A long iron from a hanging lie, run in from the right' }, hazard: 'Down the left: the hillside itself', surround: 'A feeding bank right, a collection hollow left',
      },
    }),
  }),

  // 6. THE STAIR: a short iron from a platform 25 m up a living tree
  hole({ n: 6, name: 'The Stair', par: 3, world: LINES[5], tips: [-12, -3], shape: 'One shot, down from the platform', platform: true,
    build: (P, L, len) => ({
      // the platform tees: Redwood 25 m up, Cedar on the lower landing (12 m up) round the other side of the trunk;
      // Rowan and Hazel on the floor
      tees: { redwood: 0, cedar: [7, 13], rowan: [22, 6], hazel: [46, -6] },
      teeY: { redwood: 25, cedar: 12 },
      tipsY: 31,
      bunkers: [],
      green: { k: 1.0, lobes: [[0, 0, 11.5, 14, 22], [5, 8, 6.5, 5.5, 0]], apron: 3, contour: [{ fall: 30, pct: 1.6 }, { ridge: [[-6, -6], [7, 5]], h: 0.25, w: 3 }], style: 'Angled from front left to back right, the brook in front and down the left; falling 1.6% toward the brook with a gentle spine; moss banks behind and right gather a long ball' },
      forms: [{ at: P(len + 14, 10), rx: 14, rz: 9, h: 2.2, label: 'the moss bank' }],
      trunks: [
        { job: 'the stair tree (its first branches 90 m up: open over the platform)', list: [{ s: -6, off: 10, r: 5.5, tall: 112, low: 0.8 }] },
        { job: 'behind the green', list: [[len + 32, -22, 5], [len + 36, 24, 5.2]] },
        { job: 'the light shaft\'s sides', list: [[70, -44, 4.8], [78, 46, 5]] },
      ],
      targets: [],
      words: {
        story: 'The Stair: a stair grown round a living trunk to a platform 25 m up.',
        plays: 'The breather. Up a stair grown round a living trunk to a platform 25 m up; a short iron down through a shaft of light to a green with the brook in front and down its left side and moss banks behind and right that gather a long ball. The ball drops 25 m, so it plays about a club less. The Cedar tee is the stair\'s lower landing, 12 m up; Rowan and Hazel are on the floor.',
        safe: 'A short iron to the middle of the green, long rather than short.',
        bold: 'At a front-left pin, over the brook.',
        miss: 'Short or left: the brook (a stroke and a drop). Long or right: the moss banks gather it. Safe miss: long right',
      },
      card: {
        type: 'Original (a tee in a living tree)', form: 'None (par 3)', feature: 'The stair tree and its platform; the brook; the shaft of light', job: 'The platform is the height; the brook is the hazard; the moss banks are helpers',
        decision: 'None: a par 3', miss: 'Small: the moss banks long and right. Medium: the fern beyond them. Big: the brook, short and left only. Safe miss: long right',
        view: 'From 25 m up: in front the platform\'s edge and the stair tree\'s trunk on the right; in the middle the green far below in a shaft of light, the brook in front of it; beyond, the forest and the Glade\'s light behind. The flag shows',
        ground: 'The drop: 25 m from the platform to the green (the only drop par 3)',
        height: 'Drop', dial: 'Height: a tee 25 m up a living tree', shots: { tee: null, approach: 'A short iron dropped from height' }, hazard: 'In front and left of the green: the brook', surround: 'Water front and left; moss banks behind and right',
      },
    }),
  }),

  // 7. THE BROOK: down a long valley; the brook crosses in a little ravine short of the green
  hole({ n: 7, name: 'The Brook', par: 5, world: LINES[6], tips: [-36, 0], shape: 'Dogleg left (44°) down the valley', goGreen: true,
    build: (P, L, len) => ({
      tees: { redwood: 0, cedar: [25, 9], rowan: [70, -10], hazel: [150, 40] },
      // broken: the drive and the lay-up on one fairway down the valley, ended by the ravine; the green's approach beyond
      fw: [{ e: [[96, 22, 24], [150, 26, 28], [200, 30, 29], [250, 30, 28], [300, 26, 26], [340, 24, 24], [372, 20, 20], [390, 12, 12]], wob: 3 },
        { e: [[414, 13, 13], [425, 17, 17], [442, 13, 13], [450, 8, 8]], wob: 2 }],
      cant: [[120, 300, 2.4]],
      prof: [[0, 0], [len, 0]],
      // old root pits where the second wants to finish (the Long's cross hazard), and one behind the green
      bunkers: [sand(P(318, -20), 6, 4.5, 0.4), sand(P(334, 14), 5.5, 4, -0.3), sand(P(352, -8), 4.5, 3.5, 0.1), sand(P(300, 22), 4, 3.2, 0.6), sand(P(len + 15, 4), 4.6, 3.2, 0)],
      green: { k: 1.0, lobes: [[0, 0, 13, 15, 8], [-6, 9, 7, 6, 0]], apron: 4, contour: [{ fall: 0, pct: 1.6 }, { tier: [2, -3], up: 180, h: 0.4, w: 4 }], style: 'Open across the front (a long second runs on over the ravine\'s far lip), falling 1.6% toward you with a back tier; one sand hollow behind' },
      trunks: [
        { job: 'the valley\'s east side (the brook\'s side)', list: [...row(95, 215, 42, -54, 4.8, 5, 3.1)] },
        { job: 'the valley\'s west side', list: [...row(80, 230, 50, 52, 5, 5, 4.7)] },
        { job: 'down the second leg', list: [[272, -46, 5], [322, -48, 4.8], [292, 50, 5.2], [342, 48, 5]] },
        { job: 'behind the green', list: [[len + 30, -26, 5], [len + 34, 28, 5.2]] },
      ],
      targets: [{ name: 'The corner', at: P(228, 6) }, { name: 'The lay-up', at: P(374, -1) }],
      words: {
        story: 'The brook: down a long valley to a little ravine short of the green.',
        plays: 'A reachable par 5 down a long valley whose fall runs a drive on round the corner. The brook crosses in a little ravine 3-4 m deep about 50 m short of the green. From a good drive it is about 220 yd to carry it to an open green, or lay up short of the ravine and pitch from 90 yd. Four old root pits, filled with sand, sit where the second shot wants to finish if you lay up too far. A bridge of living root crosses the brook off the line.',
        safe: 'Round the corner (228 m), a lay-up short of the ravine (378 m), a pitch of 90 yd.',
        bold: 'A wood over the ravine onto the open green in two.',
        miss: 'Left (the brook\'s side): fern, then the forest floor down to the brook. Right: fern, the valley\'s west side. The lay-up too long: the root pits, then the ravine. At the green, sand behind.',
      },
      card: {
        type: 'Long', form: 'Broken (the ravine across it)', feature: 'The brook\'s ravine; the root pits; the root bridge', job: 'The ravine is the hazard across the second shot; the root pits set the lay-up\'s number; the valley\'s fall is a helper (it runs the drive on); the bridge is a frame',
        decision: 'Go or lay up: a wood over the ravine (about 220 yd) to an open green, or a lay-up short of it and a pitch from 90 yd',
        miss: 'Small: moss, fern. Medium: the forest floor and the trunks on the valley\'s sides, the root pits. Big: the ravine (a stroke and a drop), across the line only. Safe miss at the green: short of the ravine',
        view: 'In front the valley falling away; in the middle the corner and the trunks lining both sides; beyond, the bend and the light down the second leg. The landing area shows',
        ground: 'Dip in front: the ravine 3-4 m deep short of the green; the valley falls 8 m tee to green',
        height: 'Dip in front', dial: 'Length: 505 yd, reachable', shots: { tee: 'Driver as hard as you like down the fall', approach: 'A wood over the ravine, or a pitch of 90 yd' }, hazard: 'Across: the brook\'s ravine', surround: 'An open front; sand behind',
      },
    }),
  }),

  // 8. THE HOLLOW: a long iron up 7 m into the shell of a burnt-out giant
  hole({ n: 8, name: 'The Hollow', par: 3, world: LINES[7], tips: [-14, 0], shape: 'One shot, uphill into the shell',
    build: (P, L, len) => ({
      tees: { redwood: 0, cedar: [12, -8], rowan: [28, 9], hazel: [56, -6] },
      // the shelf inside the shell: the green 7 m over the tee; a steep mossy front (about 40%) sends a short ball
      // back down
      prof: [[0, 0], [110, 0], [len - 32, -2.2], [len - 22, -0.2], [len, 0], [len + 40, 0]],
      bunkers: [],
      green: { k: 1.0, lobes: [[0, 0, 12, 14, -8], [4, 8, 7, 6, 0]], apron: 3, contour: [{ fall: 0, pct: 1.8 }, { bowl: [3, 5], r: 11, h: 0.3 }], style: 'Inside the shell, open toward the tee, falling 1.8% toward you with a shallow bowl at the back right; the black walls on three sides return a long or wide ball; the steep mossy front sends a short one back down' },
      trunks: [
        { job: 'the approach\'s sides', list: [[62, -40, 4.8], [70, 42, 5], [118, -38, 5], [124, 40, 4.6]] },
      ],
      targets: [],
      words: {
        story: 'The Hollow: a green inside the shell of a burnt-out giant.',
        plays: 'A long iron, 190 yd, up 7 m to a green inside the shell of a giant that burnt out long ago. Its black walls stand 15 m high round three sides and open toward you: anything long or wide comes back off them. The front is steep moss: a ball that comes up short runs back down the bank. So the shot is to carry all the way and let the walls be the backstop.',
        safe: 'A long iron to the middle, long rather than short.',
        bold: 'At a front pin, just over the bank.',
        miss: 'Short: the mossy front sends it back down 20 m. Long or wide: off the walls and back toward the green. No penalty ground. Safe miss: long',
      },
      card: {
        type: 'Original (a green in a shell)', form: 'None (par 3)', feature: 'The burnt shell: black walls 15 m high on three sides, open toward the tee', job: 'The walls are helpers (a backstop: the wall set piece) and the frame; the mossy front is a lie-setter that sends a short ball back',
        decision: 'None: a par 3', miss: 'Small: off the walls. Medium: down the front bank. Big: the forest floor beside the shell. No penalty ground. Safe miss: long',
        view: 'In front the forest floor rising; in the middle the shell\'s black walls and the green inside them, the flag against the wall; beyond, the shell\'s broken top and the trees. The flag shows',
        ground: 'Uphill to a shelf: +7 m, the front a steep moss bank',
        height: 'Uphill par 3, to a shelf', dial: 'Green shape: a green inside a burnt-out trunk\'s shell', shots: { tee: null, approach: 'A long iron carried all the way' }, hazard: 'Behind and round the green: the shell (a helper)', surround: 'The wall behind and both sides; a steep front', setPiece: 'The wall (the shell)',
      },
    }),
  }),

  // 9. THE HALL: to the heart tree, left or right of a root 4 m high down the middle
  hole({ n: 9, name: 'The Hall', par: 4, world: LINES[8], tips: [-34, 0], shape: 'Dogleg right (76°) round the heart tree', split: true,
    build: (P, L, len) => ({
      tees: { redwood: 0, cedar: [22, -9], rowan: [60, 10], hazel: [86, -6] },
      // an island: one fairway with the centre root down its middle (left of it 26 m, right of it 42 m)
      fw: [{ e: [[110, 22, 22], [150, 30, 36], [200, 34, 48], [250, 35, 50], [300, 30, 42], [340, 24, 30], [370, 18, 18], [390, 11, 11]], wob: 2.6 },
        { bite: [[172, 0, 9, 8, 0], [200, 0, 12, 8, 0], [232, 0, 12, 8, 0], [262, 0, 12, 8, 0], [282, 0, 8, 7, 0]], join: 9, wob: 0.8 }],
      prof: [[0, 4], [60, 2], [120, -0.4], [175, -1.6], [240, -0.9], [300, -1.2], [len - 60, -1.6], [len, -3.4]],   // the back tees on a knoll 4 m up and the first leg falling evenly, so both lanes beyond the root show
      // the centre root: 4 m high down the middle from 169 to 282 m (a root lie, a wall a ball drops at the foot of)
      root: { s0: 169, s1: 282, h: 4, w: 7 },
      reliefLine: [[0, 0], P(150, 6), P(240, 22), L.at(-1)],   // read down the right lane (the centre root is the hazard, not the height form)
      // the amphitheatre: roots in an arc round the green's back and sides, open toward the left lane; the root
      // shoulder in front of the green's right half, which hides it from the right lane
      forms: [{ at: P(len + 28, -2), rx: 30, rz: 8, h: 3.4, rot: 0.15, root: true, label: 'the amphitheatre' }, { at: P(len + 6, 30), rx: 8, rz: 26, h: 3.2, rot: -0.3, root: true },
        { at: P(len + 6, -32), rx: 8, rz: 24, h: 2.8, rot: 0.35, root: true }, { at: P(330, 11), rx: 6.5, rz: 9, h: 3.4, rot: 0, root: true, label: 'the root shoulder' }],
      bunkers: [],
      green: { k: 0.94, lobes: [[0, 0, 14, 17, -6], [-6, 11, 8.5, 7, 0], [8, -6, 7, 6.5, 0]], apron: 4, contour: [{ fall: 0, pct: 1.4 }, { ridge: [[-8, -14], [-9, 12]], h: 0.3, w: 3.5 }], style: 'In the amphitheatre\'s floor, its roots feeding a ball in; falling 1.4% toward you, a spine down its middle splitting a left half (open from the left lane) from a right half (hidden behind the root shoulder from the right lane); the hall\'s lit doors behind' },
      trunks: [
        { job: 'right of the first leg', list: [[58, 46, 5], [112, 48, 4.8]] },
        { job: 'left of the first leg', list: [[82, -52, 5.2], [142, -50, 5]] },
        { job: 'the far side of the left lane', list: [[262, -56, 5], [318, -52, 5.2]] },
      ],
      targets: [{ name: 'The right lane', at: P(240, 22) }, { name: 'The left lane', at: P(242, -17), bold: true }],
      boldPath: P(242, -17),
      words: {
        story: 'The Hall: to the heart tree, its roots an amphitheatre round the last green.',
        plays: 'The finish, round the heart tree. A root 4 m high runs down the middle of the fairway from about 185 to 310 yd. Left of it the fairway is 26 m wide and points straight down the amphitheatre\'s entrance: an open approach to the whole green. Right of it is 42 m wide, but the approach comes over a root shoulder to a green whose right half you can\'t see. The green lies in an amphitheatre of roots that feed a ball in, the hall\'s lit doors in the roots behind.',
        safe: 'Right of the root (240 m), a blind approach over the shoulder.',
        bold: 'Left of the root (242 m), a short iron straight down the entrance.',
        miss: 'Into the root: it drops at its foot (a root lie, it kicks). Left of the left lane: fern, the trunks. Right of the right lane: fern, the heart tree\'s roots. At the green the amphitheatre feeds a near miss in.',
      },
      card: {
        type: 'Original (centre-line hazard)', form: 'Island (round the centre root)', feature: 'The centre root; the amphitheatre of roots; the heart tree and the hall\'s doors', job: 'The root is the centre-line hazard; the amphitheatre is a helper (it feeds a ball in); the heart tree is the landmark the round walks toward',
        decision: 'Centre-line hazard: left of the root (26 m, an open approach to the whole green) or right of it (42 m, a blind approach over the root shoulder)',
        miss: 'Small: moss, the root\'s foot. Medium: fern, a trunk, the heart tree\'s buttress roots. Big: deep in the forest. No penalty ground. Safe miss at the green: anywhere into the amphitheatre (it feeds)',
        view: 'In front the forest floor; in the middle the bend round the heart tree\'s roots and the root down the fairway; beyond, the heart tree itself, filling the sky. Both lanes show',
        ground: 'Fall-away: from a knoll 4 m up, down 10 m in all, the last 3 m of it into the amphitheatre',
        height: 'Fall-away', dial: 'Green surround: an amphitheatre of roots', shots: { tee: 'A fade round the bend, left or right of the root', approach: 'A short iron down the entrance, or a blind one over the shoulder' }, hazard: 'In the centre: the root', surround: 'An amphitheatre of roots that feeds',
      },
    }),
  }),
];
export { FALLEN };
