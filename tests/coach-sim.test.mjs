// The coach against an amateur's swing measured by an R10 (tools/coach/model.mjs): every fault
// read most of the time, clean swings flagged rarely. Guards the thresholds tuned with
// tools/coach/sim-check.mjs; fewer trials than the tool, so the bars sit a little under its numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sweep } from '../tools/coach/sim-check.mjs';

test('with R10-sized measurement error, the coach reads each fault and leaves clean swings alone', () => {
  const rows = sweep({ trials: 120, mode: 'r10', clubs: ['7i', 'DR'] });
  const faults = rows.filter(r => r.fault !== 'clean'), clean = rows.filter(r => r.fault === 'clean');
  const mean = faults.reduce((s, r) => s + r.hit, 0) / faults.length;
  assert.ok(mean >= 0.78, `mean read right ${(mean * 100).toFixed(0)}%`);
  for (const r of faults) assert.ok(r.hit >= 0.55, `${r.fault}/${r.club} read right ${(r.hit * 100).toFixed(0)}%: ${JSON.stringify(r.wrong.slice(0, 2))}`);
  for (const r of clean) assert.ok(1 - r.hit <= 0.4, `clean ${r.club} flagged ${((1 - r.hit) * 100).toFixed(0)}%`);
});

test('with perfect club data the reads are better still', () => {
  const rows = sweep({ trials: 120, mode: 'ideal', clubs: ['7i'] });
  const faults = rows.filter(r => r.fault !== 'clean'), clean = rows.find(r => r.fault === 'clean');
  assert.ok(faults.reduce((s, r) => s + r.hit, 0) / faults.length >= 0.88);
  assert.ok(1 - clean.hit <= 0.25);
});

test('with R10 error, the swing each skill teaches still gets learned, and a normal swing rarely passes', async () => {
  const { CASES, learnRate } = await import('../tools/coach/skill-check.mjs');
  for (const [s, o, club, a, x] of CASES) {
    const r = learnRate(s, o, club, a, { trials: 60, mode: 'r10', ...x });
    assert.ok(r.learned >= 0.65, `${r.skill}/${club} learned ${(r.learned * 100).toFixed(0)}%`);
    assert.ok(r.falsePass <= 0.2, `${r.skill}/${club}: a normal swing passed ${(r.falsePass * 100).toFixed(0)}%`);
  }
});
