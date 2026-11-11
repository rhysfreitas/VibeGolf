// Learn a skill: every skill's goal is reachable by the swing it teaches, the usual miss names the
// right thing in the way, and the learn → test → open-ended flow.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_ORDER, createSkillCoach, skillMetrics, scoreShot, flightOf, clubFor, TEST_SHOTS } from '../src/coach/skills.js';
import { CLUB_REF } from '../src/coach/windows.js';
import { applyFault } from '../src/coach/faults.js';
import { LESSONS } from '../src/coach/lessons.js';

// the tour shot for a club, with club data as the R10 would send it
const tour = id => { const r = CLUB_REF[id]; return { Speed: r.speed, VLA: r.vla, HLA: 0, TotalSpin: r.spin, SpinAxis: 0, Club: { Speed: r.speed / r.smash, Path: 0, FaceToTarget: 0, AngleOfAttack: r.aoa } }; };
const as = (id, fault) => applyFault(tour(id), fault, id);
// a coach, its baseline (when the skill needs one) played with normal shots
function coachFor(skill, option, club) {
  const c = createSkillCoach({ skill, option, club });
  while (c.phase === 'baseline') c.addShot(tour(club), club);
  return c;
}
const inside = (c, shot) => c.addShot(shot, c.club).find(e => e.type === 'tick').inside;
const readAfter = (c, shot) => { let ev = []; for (let i = 0; i < 4; i++) ev = c.addShot(shot, c.club); return ev.find(e => e.type === 'read' || e.type === 'learned'); };

test('ten skills, each with keys, goals and blockers that have lessons', () => {
  assert.equal(SKILL_ORDER.length, 10);
  for (const id of SKILL_ORDER) {
    const S = SKILLS[id];
    for (const o of S.options || [{ id: null }]) {
      assert.ok(S.keys(o.id).length >= 2, `${id} keys`);
      for (const k of S.keys(o.id)) assert.ok(LESSONS[k.lesson], `${id} key lesson ${k.lesson}`);
      for (const b of S.blockers(o.id)) assert.ok(LESSONS[b.lesson], `${id} blocker lesson ${b.lesson}`);
      assert.ok(S.title(o.id) && S.sub(o.id) && S.cue(o.id));
    }
  }
});

test('Shape it: a draw swing draws, a fade swing fades; a straight one is told to swing out', () => {
  const d = coachFor('shape', 'draw', '7i'); assert.ok(inside(d, as('7i', 'draw')));
  const f = coachFor('shape', 'fade', '7i'); assert.ok(inside(f, as('7i', 'fade')));
  assert.equal(readAfter(coachFor('shape', 'draw', '7i'), tour('7i')).blocker.id, 'pathLeft');
  assert.equal(readAfter(coachFor('shape', 'fade', '7i'), as('7i', 'stuck')).blocker.id, 'pathRight');
  // the path is out to the right but the face matches it: a push
  assert.equal(readAfter(coachFor('shape', 'draw', '7i'), as('7i', 'aimedOff')).blocker.id, 'faceOpen');
});

test('Take the curve out: measured against your own slice or hook', () => {
  const after = (option, stock) => { const c = createSkillCoach({ skill: 'straight', option, club: '7i' }); for (let i = 0; i < 4; i++) c.addShot(as('7i', stock), '7i'); return c; };
  assert.equal(createSkillCoach({ skill: 'straight', option: 'slice', club: '7i' }).phase, 'baseline');
  // a third of the slice, starting near the line, is in the goal; the full slice isn't
  assert.ok(inside(after('slice', 'overTheTop'), applyFault(tour('7i'), 'overTheTop', '7i', Math.random, 0.35)));
  assert.ok(!inside(after('slice', 'overTheTop'), as('7i', 'overTheTop')));
  assert.equal(readAfter(after('slice', 'overTheTop'), as('7i', 'overTheTop')).blocker.id, 'pathLeft');
  // the hook side: still aimed right for it
  assert.ok(inside(after('hook', 'stuck'), applyFault(tour('7i'), 'stuck', '7i', Math.random, 0.35)));
  assert.equal(readAfter(after('hook', 'stuck'), as('7i', 'stuck')).blocker.id, 'aimed');
  // a slicer who over-does it into a hook is told so
  assert.equal(readAfter(after('slice', 'overTheTop'), as('7i', 'closedFace')).blocker.id, 'overdone');
});

test('Compress your irons: a flip adds loft; a compressed strike is in the goal', () => {
  assert.ok(inside(coachFor('compress', null, '7i'), as('7i', 'compress')));
  const r = readAfter(coachFor('compress', null, '7i'), as('7i', 'flip'));
  assert.equal(r.blocker.id, 'flip');
  assert.equal(clubFor('compress', 'DR'), '7i'); assert.equal(clubFor('compress', '9i'), '9i');
});

test('Hit up on the driver: hitting down is named; hitting up launches higher with less spin', () => {
  const c = coachFor('driverUp', null, 'DR');
  assert.ok(!inside(c, tour('DR')));
  assert.ok(inside(coachFor('driverUp', null, 'DR'), as('DR', 'hitUp')));
  assert.equal(readAfter(coachFor('driverUp', null, 'DR'), tour('DR')).blocker.id, 'down');
  assert.equal(clubFor('driverUp', '7i'), 'DR');
});

test('Flight it: measured against your own four normal shots first', () => {
  const lo = createSkillCoach({ skill: 'flight', option: 'low', club: '7i' });
  assert.equal(lo.phase, 'baseline');
  let ev; for (let i = 0; i < 4; i++) ev = lo.addShot(tour('7i'), '7i');
  assert.ok(ev.some(e => e.type === 'baseline')); assert.equal(lo.phase, 'learn');
  assert.ok(inside(lo, as('7i', 'low')), 'a knockdown is low');
  assert.ok(inside(coachFor('flight', 'high', '7i'), as('7i', 'high')), 'a high shot is high');
  assert.equal(readAfter(coachFor('flight', 'low', '7i'), tour('7i')).blocker.id, 'launchHigh');
  // a session that already has four normal shots skips the baseline
  const ms = Array.from({ length: 4 }, () => skillMetrics(tour('7i'), '7i'));
  assert.equal(createSkillCoach({ skill: 'flight', option: 'low', club: '7i', stockMs: ms }).phase, 'learn');
});

test('Start it on your line and Find the centre', () => {
  assert.ok(inside(coachFor('line', null, '7i'), tour('7i')));
  assert.equal(readAfter(coachFor('line', null, '7i'), as('7i', 'openFace')).blocker.id, 'faceRight');
  assert.equal(readAfter(coachFor('line', null, '7i'), as('7i', 'aimedOff')).blocker.id, 'aimed');
  assert.ok(inside(coachFor('centre', null, '7i'), tour('7i')));
  assert.equal(readAfter(coachFor('centre', null, '7i'), as('7i', 'fat')).blocker.id, 'fat');
});

test('Wedges: a 9 o\'clock swing carries about 70% of your full one', () => {
  const c = coachFor('wedges', 'nine', 'PW'), full = flightOf(tour('PW')).carry, want = full * 0.7;
  // find the ball speed that carries the 9 o'clock number
  let lo = 40, hi = CLUB_REF.PW.speed;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (flightOf({ ...tour('PW'), Speed: mid }).carry < want) lo = mid; else hi = mid; }
  const half = { ...tour('PW'), Speed: lo, Club: { ...tour('PW').Club, Speed: lo / CLUB_REF.PW.smash } };
  assert.ok(inside(c, half));
  assert.equal(readAfter(coachFor('wedges', 'nine', 'PW'), tour('PW')).blocker.id, 'long');
});

test('Tighten your pattern: the same shot repeats; misses both ways are named', () => {
  const c = coachFor('pattern', null, '7i');
  for (let i = 0; i < 4; i++) c.addShot(as('7i', 'draw'), '7i');
  assert.ok(inside(c, as('7i', 'draw')), 'the same draw again is in the pattern');
  const t = coachFor('pattern', null, '7i'); let ev = [];
  for (let i = 0; i < 4; i++) ev = t.addShot(applyFault(tour('7i'), 'twoWay', '7i', () => (i % 2 ? 0.2 : 0.8)), '7i');
  assert.equal(ev.find(e => e.type === 'read').blocker.id, 'twoWay');
});

test('Add speed: faster than your own baseline with the strike holding', () => {
  const c = coachFor('speed', null, 'DR');
  assert.ok(!inside(c, tour('DR')), 'your normal speed is not the goal');
  assert.ok(inside(c, as('DR', 'faster')));
  assert.equal(readAfter(coachFor('speed', null, 'DR'), tour('DR')).blocker.id, 'slow');
});

test('learn → test (5 of 8) → open-ended, and only urgent things interrupt', () => {
  const c = coachFor('shape', 'draw', '7i');
  let ev; for (let i = 0; i < 4; i++) ev = c.addShot(as('7i', 'draw'), '7i');
  assert.ok(ev.some(e => e.type === 'learned')); assert.equal(c.phase, 'test');
  for (let i = 0; i < 3; i++) c.addShot(tour('7i'), '7i');            // three misses: 5 of the last 5 still passes
  assert.equal(c.phase, 'test');
  ev = c.addShot(tour('7i'), '7i');
  assert.ok(ev.some(e => e.type === 'retest'), 'a fourth miss means 5 of 8 is out of reach: back to learning');
  assert.equal(c.phase, 'learn');
  // learn it again, then pass the test
  for (let i = 0; i < 4; i++) ev = c.addShot(as('7i', 'draw'), '7i');
  assert.equal(c.phase, 'test');
  for (let i = 0; i < 5; i++) ev = c.addShot(as('7i', 'draw'), '7i');
  assert.ok(ev.some(e => e.type === 'passed')); assert.equal(c.phase, 'open'); assert.ok(c.passed);
  // open-ended: it keeps reading in fours
  for (let i = 0; i < 4; i++) ev = c.addShot(as('7i', 'draw'), '7i');
  assert.ok(ev.some(e => e.type === 'read'));
  // the wrong club is ignored; a shank interrupts
  assert.equal(c.addShot(tour('DR'), 'DR')[0].type, 'wrongClub');
  const sh = { ...tour('7i'), HLA: 14, Speed: 70 };
  assert.ok(c.addShot(sh, '7i').some(e => e.type === 'urgent' && e.id === 'shank'));
  assert.ok(TEST_SHOTS === 8);
});

test('scoreShot: inside every window scores 1; further out scores less', () => {
  const g = [{ key: 'path', lo: 2, hi: 6, tol: 3 }];
  assert.equal(scoreShot({ path: 4 }, g).score, 1);
  assert.ok(Math.abs(scoreShot({ path: 0.5 }, g).score - 0.5) < 1e-9);
  assert.equal(scoreShot({ path: -5 }, g).score, 0);
  // a goal that needs club data is skipped without it
  assert.equal(scoreShot({ hasClub: false, aoa: 9, path: 4 }, [...g, { key: 'aoa', lo: 1, hi: 5, tol: 2, club: true }]).parts.length, 1);
});
