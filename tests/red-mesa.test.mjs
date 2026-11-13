// Red Mesa: the course data, the terrain it builds and how the ball plays on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES, COURSE } from '../src/course/red-mesa.js';
import { HOLES as AERIE, COURSE as AERIE_COURSE } from '../src/course/aerie.js';
import { windVector, windInShot, suggestTee, teeYards, rollWind, holeWind } from '../src/course/conditions.js';

const YD = 0.9144;
const T = HOLES.map(h => createTerrain(h));
const pinOf = (h, t) => { const p = h.pin; return { x: p[0], y: t.groundAt(p[0], p[1]), z: p[1] }; };
// fly a shot over hole terrain from a world spot toward another (same transform as the course)
function shoot(t, from, to, shot, extra = {}) {
  const o = { x: from[0], y: t.groundAt(from[0], from[1]), z: from[1] };
  const yaw = Math.atan2(to[0] - o.x, -(to[1] - o.z)), c = Math.cos(yaw), s = Math.sin(yaw);
  const wx = (lx, lz) => o.x + lx * c - lz * s, wz = (lx, lz) => o.z + lx * s + lz * c;
  const r = simulate({ HLA: 0, SpinAxis: 0, ...shot }, {
    groundAt: (lx, lz) => { const g = t.groundAt(wx(lx, lz), wz(lx, lz)); return g === null ? null : g - o.y; },
    surfaceAt: (lx, lz) => { const v = t.surfaceAt(wx(lx, lz), wz(lx, lz)); return v === 'tee' ? 'fairway' : v === 'void' ? 'rough' : v; },
    solidAt: (lx, ly, lz) => { const n = t.solidAt(wx(lx, lz), o.y + ly, wz(lx, lz)); return n && [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]; },
    voidY: t.voidY - o.y, altFt: COURSE.altFt, ...extra,
  });
  const e = r.pts.at(-1).p, land = r.pts.find(p => p.phase !== 'flight')?.p || e;
  return { r, end: { x: wx(e[0], e[2]), y: o.y + e[1], z: wz(e[0], e[2]) }, land: { x: wx(land[0], land[2]), z: wz(land[0], land[2]) } };
}
const TOUR = { DR: { Speed: 167, VLA: 10.9, TotalSpin: 2686 }, '8i': { Speed: 115, VLA: 18.1, TotalSpin: 7998 }, '7i': { Speed: 120, VLA: 16.3, TotalSpin: 7097 }, PW: { Speed: 102, VLA: 24.2, TotalSpin: 9304 }, '9i': { Speed: 109, VLA: 20.4, TotalSpin: 8647 } };

test('nine holes, par 36, four tee sets with the designed totals', () => {
  assert.equal(HOLES.length, 9);
  assert.equal(HOLES.reduce((a, h) => a + h.par, 0), 36);
  const want = { canyon: 3503, mesa: 3090, sage: 2665, lizard: 2070 };
  for (const s of COURSE.teeSets) assert.equal(teeYards(HOLES, s.id), want[s.id], s.id);
});

test('every tee is on a tee box and measures its card yardage to the pin', () => {
  HOLES.forEach((h, i) => {
    for (const s of COURSE.teeSets) {
      const tp = h.tees[s.id];
      assert.notEqual(T[i].groundAt(tp[0], tp[1]), null, `${h.name} ${s.id} tee has ground`);
      assert.equal(T[i].surfaceAt(tp[0], tp[1]), 'tee', `${h.name} ${s.id}`);
      // measured along the playing line where there is one, else straight to the pin
      let m;
      if (h.line) {
        const L = h.line; let k = 1; while (k < L.length - 1 && L[k][1] > tp[1]) k++;
        m = Math.hypot(L[k][0] - tp[0], L[k][1] - tp[1]); for (let j = k + 1; j < L.length; j++) m += Math.hypot(L[j][0] - L[j - 1][0], L[j][1] - L[j - 1][1]);
        m += Math.hypot(h.pin[0] - L.at(-1)[0], h.pin[1] - L.at(-1)[1]) * 0;
      } else m = Math.hypot(h.pin[0] - tp[0], h.pin[1] - tp[1]);
      const y = m / YD;
      assert.ok(Math.abs(y - h.yards[s.id]) / h.yards[s.id] < 0.03, `${h.name} ${s.id}: ${y.toFixed(0)} vs ${h.yards[s.id]}`);
    }
    assert.equal(T[i].surfaceAt(h.pin[0], h.pin[1]), 'green', `${h.name} pin on the green`);
    // pins at least 6 m apart, so each has its own cupping area
    h.green.pins.forEach((a, k) => h.green.pins.slice(k + 1).forEach(b => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) >= 6, `${h.name} pins ${a} and ${b} too close`)));
    // every pin position: on the green, at 3% or less
    for (const p of h.green.pins) {
      const t = createTerrain({ ...h, pin: p }), g = t.slopeAt(p[0], p[1]);
      assert.equal(t.surfaceAt(p[0], p[1]), 'green', `${h.name} pin ${p}`);
      assert.ok(Math.hypot(g.x, g.z) * 100 <= 3.1, `${h.name} pin ${p}: ${(Math.hypot(g.x, g.z) * 100).toFixed(2)}%`);
    }
  });
});

test('Kestrel drops 70 m from the back tee; each forward set has its own ledge', () => {
  const t = T[2], h = HOLES[2], pin = pinOf(h, t);
  const drops = COURSE.teeSets.map(s => t.groundAt(...h.tees[s.id]) - pin.y);
  [70, 55, 35, 20].forEach((d, i) => assert.ok(Math.abs(drops[i] - d) < 1.5, `${drops[i]} vs ${d}`));
  // it plays about 90 yards short: a tour 8 or 7 iron finds the green from 265
  const best = ['8i', '7i'].map(c => shoot(t, h.tees.canyon, h.pin, TOUR[c])).map(s => Math.hypot(s.land.x - pin.x, s.land.z - pin.z));
  assert.ok(Math.min(...best) < 18, `closest landing ${best.map(v => v.toFixed(0))} m from the pin`);
});

test("Needle's Eye: a normal drive flies through the arch; a skied one clips it", () => {
  const t = T[3], h = HOLES[3];
  for (const set of ['canyon', 'mesa', 'sage']) {
    const through = shoot(t, h.tees[set], [0, -260], TOUR.DR);
    assert.equal(through.r.rockHits, 0, `${set} tour drive`);
    const am = shoot(t, h.tees[set], [0, -260], { Speed: 140, VLA: 13, TotalSpin: 3100 });
    assert.equal(am.r.rockHits, 0, `${set} amateur drive`);
  }
  // one long arch, diagonal across the fairway: a high drive reaches the span 34 m up and clips it
  const R = h.rocks[0];
  assert.ok(R.w >= 90 && Math.abs(R.rot) > 0.6, 'a long arch, slung diagonally');
  const high = shoot(t, h.tees.canyon, [0, -260], { Speed: 150, VLA: 17, TotalSpin: 3800 });
  assert.ok(high.r.rockHits >= 1, 'a high drive hits the span');
  assert.ok(high.end.z > -175, 'and drops short of it');
  const left = shoot(t, h.tees.canyon, [-42, -200], TOUR.DR);
  assert.ok(left.r.rockHits >= 1, 'a drive at the left foot hits it');
  const right = shoot(t, h.tees.sage, [41, -109], { Speed: 120, VLA: 11, TotalSpin: 3000 });
  assert.ok(right.r.rockHits >= 1, 'a push from the forward tee hits the right foot');
});

test('Hoodoos: the table rock knocks a drive down; the plateaus step up; no middle fairway', () => {
  const t = T[6], h = HOLES[6], R = h.rocks[0];
  const s = shoot(t, h.tees.canyon, [R.x, R.z], { Speed: 140, VLA: 13, TotalSpin: 3100 });
  assert.ok(s.r.rockHits >= 1, 'hits the rock');
  assert.ok(s.end.z > R.z - 25, 'and finishes near or short of it');
  const bench = t.groundAt(10, -100), tees = t.groundAt(-33, -100), fw = t.groundAt(-50, -215);
  assert.ok(tees - bench > 2.5 && fw - tees > 1.2, `bench ${bench.toFixed(1)}, tee plateau ${tees.toFixed(1)}, fairway plateau ${fw.toFixed(1)}`);
  assert.equal(t.surfaceAt(-50, -215), 'fairway'); assert.equal(t.surfaceAt(25, -270), 'fairway');
  assert.equal(t.surfaceAt(10, -160), 'desert', 'the middle is native now');
  assert.equal(t.surfaceAt(-92, -180), 'sand', 'the huge bunker');
});

test('missing off a mesa lands on the canyon floor; the gorge on 6 is gone', () => {
  const t1 = T[0], h1 = HOLES[0];
  const off = shoot(t1, h1.tees.canyon, [140, -230], TOUR.DR);
  assert.equal(off.r.outcome, 'rest');
  assert.ok(off.end.y < -30, `ends on the floor at ${off.end.y.toFixed(1)}`);
  assert.equal(t1.surfaceAt(off.end.x, off.end.z), 'desert');
  const t6 = T[5], h6 = HOLES[5];
  const short = shoot(t6, h6.tees.canyon, h6.pin, { Speed: 70, VLA: 24, TotalSpin: 6000 });
  assert.equal(short.r.outcome, 'void');
  const good = shoot(t6, h6.tees.canyon, h6.pin, { Speed: 112, VLA: 19, TotalSpin: 8000 });
  assert.equal(good.r.outcome, 'rest');
  for (const d of h6.drops) assert.notEqual(t6.groundAt(d[0], d[1]), null, 'drops are on the green side');
});

test('box canyon walls on 2 kick a long approach back', () => {
  const t = T[1], h = HOLES[1];
  const long = shoot(t, [2, -230], [0, -460], { Speed: 132, VLA: 12, TotalSpin: 5000 });
  assert.ok(long.r.rockHits >= 1);
  assert.ok(long.end.z > -400, `finishes in front of the back wall (${long.end.z.toFixed(0)})`);
});

test('the Aerie keeps its holes, with four bird-named tee sets', () => {
  assert.deepEqual(AERIE_COURSE.teeSets.map(t => t.name), ['Eagle', 'Hawk', 'Swift', 'Wren']);
  AERIE.forEach(h => {
    const t = createTerrain(h);
    for (const s of AERIE_COURSE.teeSets) { const p = h.tees[s.id]; assert.equal(t.surfaceAt(p[0], p[1]), 'tee', `${h.name} ${s.id}`); }
  });
});

test('wind: bearings map into the hole and the shot frames', () => {
  const head = windVector({ mph: 10, from: 0 }, 0); // north wind, hole plays north
  assert.ok(head.z > 4.4 && Math.abs(head.x) < 1e-9, 'into your face');
  const cross = windVector({ mph: 10, from: 270 }, 0); // west wind, hole plays north: left to right
  assert.ok(cross.x > 4.4);
  const turned = windInShot(cross, Math.PI / 2); // aiming right (east): now a tailwind
  assert.ok(turned.z < -4.4);
  const roll = rollWind({ wind: 'breezy', windFrom: 225 }, () => 0.5);
  assert.equal(roll.from, 225); assert.ok(roll.mph >= 8 && roll.mph <= 14);
  assert.equal(holeWind(rollWind({ wind: 'calm' }), 3).mph, 0);
});

test('tee suggestion follows the median drive', () => {
  const sets = COURSE.teeSets;
  assert.equal(suggestTee(sets, []).id, 'mesa');
  assert.equal(suggestTee(sets, [270, 280, 250, 265]).id, 'canyon');
  assert.equal(suggestTee(sets, [230, 240, 200]).id, 'mesa');
  assert.equal(suggestTee(sets, [190, 200, 210]).id, 'sage');
  assert.equal(suggestTee(sets, [150, 170, 160]).id, 'lizard');
});

test('a ball rolling into a hoodoo stops against it instead of passing through', () => {
  const t = T[6], h = HOLES[6], R = h.rocks[3];
  const from = [R.x, R.z + 30];
  const free = simulate({ Speed: 45, VLA: 3, TotalSpin: 500, HLA: 0, SpinAxis: 0 }, { altFt: COURSE.altFt });
  assert.ok(-free.pts.at(-1).p[2] > 40, 'on open ground it would roll past');
  const s = shoot(t, from, [R.x, R.z], { Speed: 45, VLA: 3, TotalSpin: 500 });
  assert.ok(s.end.z > R.z + 2, `ends in front of the spire (${(s.end.z - R.z).toFixed(1)} m)`);
});

test('no tee sits on a fairway: every pad is in the rough or native beside it', () => {
  HOLES.forEach((h, i) => {
    for (const [id, tp] of Object.entries(h.tees)) assert.ok(T[i].fairwayD(tp[0], tp[1]) >= 8, `${h.name} ${id} is ${T[i].fairwayD(tp[0], tp[1]).toFixed(1)} m from the fairway`);
  });
});

test('Rimrock: a drive pulled left finds the boulder; the ledge drops the corner side a level', () => {
  const t = T[0], h = HOLES[0];
  const B = t.rocks.find(r => r.type === 'boulder' && r.r >= 8);
  const s = shoot(t, h.tees.canyon, [B.x, B.z], { Speed: 140, VLA: 13, TotalSpin: 3100 });
  assert.ok(s.r.rockHits >= 1, 'hits the boulder');
  assert.ok(s.end.z > B.z - 2, 'and stops in front of it');
  const upper = t.groundAt(-8, -222), lower = t.groundAt(12, -270);
  assert.ok(upper - lower > 1.2, `safe left sits ${(upper - lower).toFixed(1)} m above the corner`);
});

test('The Chute: a wide plateau on the left, a grove on the split, walls cut back, a wash short of the green', () => {
  const t = T[1], h = HOLES[1];
  const upper = t.groundAt(-46, -262), lower = t.groundAt(12, -262);
  assert.ok(upper - lower > 2.8 && upper - lower < 6, `the plateau stands ${(upper - lower).toFixed(1)} m above the lower fairway`);
  assert.equal(t.surfaceAt(-46, -262), 'fairway'); assert.equal(t.surfaceAt(12, -262), 'fairway');
  assert.ok(t.trees.length >= 5 && t.trees.every(tr => tr.x > -24 && tr.x < -6 && tr.z < -200 && tr.z > -262), 'the grove sits on the split');
  // the canyon opens out around the fork: plateau on the left to x -75, open ground on the right to x 60
  assert.ok(t.groundAt(-70, -200) < t.floor.y + 15, 'no wall at x -70 by the fork');
  assert.ok(t.groundAt(-95, -200) > t.floor.y + 30, 'the left wall stands beyond the plateau');
  assert.ok(t.groundAt(58, -200) < t.floor.y + 15, 'no wall at x 58 by the fork');
  assert.ok(t.groundAt(-45, -60) > t.floor.y + 30, 'narrow by the tee');
  for (const x of [-20, 0, 20]) assert.equal(t.surfaceAt(x, -326), 'waste', `the wash crosses at x ${x}`);
  assert.ok(t.groundAt(-60, -340) < t.floor.y + 3 && t.groundAt(60, -325) < t.floor.y + 3, 'gaps in both walls where the wash comes through');
  assert.equal(t.surfaceAt(1, -342), 'fairway');
  assert.ok(t.groundAt(-9, -374) - t.groundAt(11, -374) > 0.3, 'the green is higher on the left');
  assert.ok(t.groundAt(-37, -399) - t.floor.y > 20, `rockfall ${(t.groundAt(-37, -399) - t.floor.y).toFixed(0)} m up`);
  const lz = h.tees.lizard, rise = t.groundAt(lz[0], lz[1]) - t.groundAt(20, lz[1]);
  assert.ok(rise > 1 && rise < 6, `forward tee ${rise.toFixed(1)} m up`);
});

test('Dry Wash: a burn from the falls crosses the hole twice, then the front of the green; a drive into it is wet', () => {
  const t = T[7], h = HOLES[7], V = t.features.rivers[0];
  assert.ok(V && V.level < t.floor.y, 'the burn sits below the floor');
  assert.ok(V.w <= 8, 'a burn, not a river');
  for (const [x, z] of [[-38, -111], [48, -170], [8, -270], [0, -373], [22, -380]]) assert.equal(t.surfaceAt(x, z), 'water', `water at ${x}, ${z}`);
  assert.equal(t.surfaceAt(-3, -200), 'fairway', 'the fairway inside the bend is dry');
  assert.notEqual(t.surfaceAt(-52, -400), 'water', 'no longer down the left wall');
  assert.equal(t.surfaceAt(13, -350), 'fairway', 'a lay-up short of it is dry');
  // a drive pushed right finds the water (the tee ledge is 12 m up, so it carries further)
  const wet = shoot(t, h.tees.canyon, [50, -190], { Speed: 132, VLA: 12, TotalSpin: 2900 }); // off the 12 m ledge
  assert.equal(t.surfaceAt(wet.end.x, wet.end.z), 'water');
});

test('no slots to the floor where islands meet: Rimrock\'s promontory, The Climb\'s gullies and tiers', () => {
  // walk across each join: the ground never drops more than a few metres below both sides
  const across = (h, a, b) => { const T = createTerrain(HOLES[h]); let lo = Infinity;
    for (let t = 0; t <= 1; t += 0.02) lo = Math.min(lo, T.groundAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t));
    return Math.min(T.groundAt(...a), T.groundAt(...b)) - lo; };
  assert.ok(across(0, [12, -340], [48, -340]) < 3, 'Rimrock: the safe way round reaches the green on land');
  assert.ok(across(8, [-6, -282], [-30, -282]) < 4, 'The Climb: no slot between the gully and its left wall');
  assert.ok(across(8, [30, -290], [60, -290]) < 4, 'The Climb: none at the top right of the first gully');
  assert.ok(across(8, [-6, -440], [-6, -462]) < 4, 'The Climb: the second gully runs onto the top tier');
  assert.ok(across(8, [20, -440], [20, -466]) < 4, 'The Climb: across the junction on the right too');
});
