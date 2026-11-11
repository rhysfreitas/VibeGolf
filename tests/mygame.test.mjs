// My game: bag numbers and tendencies from the session record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bagStats, practiceTendencies, courseTendencies, compare, practiceShots, MIN_SHOTS } from '../src/mygame/stats.js';
import { sampleShots } from '../src/mygame/sample.js';

const rec = (club, carry, extra = {}) => ({ t: 1, club, practice: true, live: true, mode: 'range', ball: { Speed: 110, VLA: 18, TotalSpin: 7000, SpinAxis: 2 },
  clubData: { Speed: 82, Path: -1, FaceToTarget: 1, AngleOfAttack: -4 }, trust: { club: null, spin: 'use' }, result: { carry, total: carry + 6, landOffline: 3 }, ...extra });

test('the bag uses Practice Ground shots only, and orders clubs from driver down with gaps', () => {
  const shots = [rec('7i', 150), rec('7i', 152), rec('7i', 154), rec('DR', 230), rec('DR', 240), rec('DR', 235),
    rec('7i', 90, { practice: false, mode: 'game' }), rec('7i', 60, { live: false }), rec('9i', 130)];
  const bag = bagStats(shots);
  assert.deepEqual(bag.map(r => r.club), ['DR', '7i', '9i']);
  assert.equal(bag[1].carry, 152); assert.equal(bag[0].gap, 235 - 152);
  assert.equal(bag[2].enough, false, 'one shot is not enough for a club');
  assert.equal(practiceShots(shots).length, 7);
});

test('ignored spin stays out of the bag\'s spin number', () => {
  const shots = [rec('7i', 150), rec('7i', 151), rec('7i', 152, { ball: { Speed: 110, VLA: 18, TotalSpin: 1200 }, trust: { club: null, spin: 'ignore' } })];
  assert.equal(bagStats(shots)[0].spin, 7000);
});

test('practice tendencies: the miss side, shape and path for each club with enough shots', () => {
  const shots = Array.from({ length: 6 }, (_, i) => rec('7i', 150, { result: { carry: 150, total: 156, landOffline: i < 4 ? 14 : 0 }, coach: i === 2 ? [{ type: 'read', id: 'flip' }] : null, feel: i === 1 ? 'thin' : null }));
  const [t] = practiceTendencies(shots);
  assert.ok(Math.abs(t.right - 4 / 6) < 1e-9); assert.equal(t.left, 0);
  assert.equal(t.path, -1); assert.equal(t.ftp, 2); assert.deepEqual(t.reads, [['flip', 1]]); assert.equal(t.feels.thin, 1);
});

test('course tendencies and how a club plays differently from practice, on the example data', () => {
  const S = sampleShots(Date.UTC(2026, 10, 11)), C = courseTendencies(S);
  assert.ok(C.n > 20 && C.rounds === 2);
  assert.ok(C.drive.n === 14 && C.drive.right > C.drive.left, 'the example player pushes the driver');
  const a = C.approaches.find(x => x.lo === 100);
  assert.ok(a.n > 0 && a.short > a.long, 'and comes up short with the irons');
  assert.ok(compare(bagStats(S), practiceTendencies(S), C).some(x => x.club === 'DR' && x.kind === 'side' && x.by > 0));
  assert.ok(MIN_SHOTS >= 3);
});
