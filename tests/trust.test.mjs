// Coaching trust checks: club data that can't be believed, and spin used only when it makes sense.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clubTrust, spinTrust, expectedSpin, spinForRules } from '../src/coach/trust.js';
import { shotMetrics, createCoach } from '../src/coach/coach-logic.js';
import { applyFault } from '../src/coach/faults.js';
import { CLUB_REF } from '../src/coach/windows.js';

const base = (id = '7i') => { const r = CLUB_REF[id]; return { Speed: r.speed, VLA: r.vla, HLA: 0, TotalSpin: r.spin, SpinAxis: 0,
  Club: { Speed: r.speed / r.smash, Path: 0.5, FaceToTarget: 0.3, AngleOfAttack: r.aoa } }; };

test('club data: real numbers pass, placeholders and impossible values do not', () => {
  assert.equal(clubTrust(base()).ok, true);
  assert.equal(clubTrust({ ...base(), Club: undefined }).why, 'missing');
  assert.equal(clubTrust({ ...base(), Club: { Speed: 90, Path: 0, FaceToTarget: 0, AngleOfAttack: 0 } }).why, 'zeros');
  assert.equal(clubTrust({ ...base(), Club: { Speed: 1, Path: 1, FaceToTarget: 1, AngleOfAttack: 1 } }).why, 'same');
  assert.equal(clubTrust({ ...base(), Club: { Speed: 90, Path: 40, FaceToTarget: 2, AngleOfAttack: -4 } }).why, 'range');
  assert.equal(clubTrust({ ...base(), Club: { Speed: 300, Path: 1, FaceToTarget: 2, AngleOfAttack: -4 } }).why, 'speed');
  assert.equal(clubTrust({ ...base(), Club: { Speed: 40, Path: 1, FaceToTarget: 2, AngleOfAttack: -4 } }).why, 'smash');
});

test('a connector\'s dummy club data is ignored, so the coach estimates face and path from the ball', () => {
  const s = { ...base(), HLA: 3, SpinAxis: 6, Club: { Speed: 1, Path: 1, FaceToTarget: 1, AngleOfAttack: 1, Loft: 1 } };
  const m = shotMetrics(s, '7i');
  assert.equal(m.hasClub, false); assert.equal(m.clubTrust, 'same');
  assert.ok(m.ftp > 2, 'face to path from the spin axis'); assert.ok(m.dynLoft > 15, 'loft from launch, not the dummy 1°');
});

test('the tour average strike expects the tour average spin', () => {
  for (const id of ['DR', '7i', 'PW']) { const r = CLUB_REF[id];
    assert.ok(Math.abs(expectedSpin({ launch: r.vla, aoa: r.aoa, clubSpeed: r.speed / r.smash }, id) - r.spin) < 1, id); }
});

test('spin: sensible spin is used; one disagreement makes it a tie-breaker; nonsense is ignored', () => {
  const m = { spin: 7097, axis: 0, launch: 16.3, clubSpeed: 90.2, aoa: -4.3, ftp: 0, spinSource: 'estimated' };
  assert.equal(spinTrust(m, '7i').verdict, 'use');
  assert.equal(spinTrust({ ...m, spinSource: 'measured', spin: 2000 }, '7i').verdict, 'use', 'measured spin is believed');
  assert.equal(spinTrust({ ...m, axis: 9 }, '7i').verdict, 'tie', 'axis disagrees with face to path');
  assert.equal(spinTrust({ ...m, spin: 2500, launch: 18 }, '7i').verdict, 'ignore', '2,500 rpm at 18° is impossible for a 7 iron');
  assert.equal(spinTrust({ ...m, spin: 10500, axis: 9 }, '7i').verdict, 'ignore', 'strike and curve both disagree');
  // no club data: only the possible check applies
  assert.equal(spinTrust({ ...m, aoa: null, ftp: null }, '7i').verdict, 'use');
  const t = spinTrust({ ...m, axis: 9 }, '7i');
  assert.equal(spinForRules(9000, t), (9000 + t.expected) / 2);
});

test('impossible spin no longer fools the strike rules', () => {
  // a clean 7 iron with a wild spin estimate: the coach should not read it as thin or steep
  let seed = 3; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = createCoach(); const ev = [];
  for (let i = 0; i < 4; i++) { const s = base(); s.TotalSpin = i % 2 ? 1800 : 15500; s.Club.Path = (R() - 0.5); s.Club.FaceToTarget = (R() - 0.5); ev.push(...c.addShot(s, '7i')); }
  assert.ok(!ev.some(e => e.type === 'read'), 'no read from spin nonsense: ' + ev.filter(e => e.type === 'read').map(e => e.id));
  assert.ok(c.shots.every(s => s.m.spinTrust === 'ignore'));
  // with the raw spin these clean swings all counted as misses; now they count as good shots
  assert.equal(ev.filter(e => e.type === 'good').length, 4);
});

test('the fault presets keep their spin believable, so the coach still reads them', () => {
  for (const f of ['flip', 'steep', 'fat', 'thin', 'overTheTop', 'openFace']) {
    const m = shotMetrics(applyFault(base(), f, '7i', () => 0.5), '7i');
    assert.notEqual(m.spinTrust, 'ignore', f + ': ' + m.spinWhy);
  }
});
