import test from 'node:test';
import assert from 'node:assert/strict';
import { createResGovernor } from '../src/adaptive-res.js';

const run = (g, ms, frames) => { let last = null; for (let i = 0; i < frames; i++) { const r = g.sample(ms); if (r !== null) last = r; } return last; };

test('fast frames leave the resolution alone', () => {
  const g = createResGovernor({ max: 2 });
  assert.equal(run(g, 16.7, 2000), null);
  assert.equal(g.ratio, 2);
});

test('slow frames step the resolution down, never below the floor', () => {
  const g = createResGovernor({ max: 2 });
  run(g, 33, 40);
  assert.ok(Math.abs(g.ratio - 1.7) < 1e-9, 'one step after one window');
  run(g, 33, 4000);
  assert.equal(g.ratio, 1.25);
});

test('a stall (a hole being built) is not read as a slow frame rate', () => {
  const g = createResGovernor({ max: 2 });
  for (let i = 0; i < 30; i++) { g.sample(16.7); } g.sample(900); run(g, 16.7, 400);
  assert.equal(g.ratio, 2);
});

test('it steps back up when there is room, and backs off when the step up was too much', () => {
  const g = createResGovernor({ max: 2 });
  run(g, 33, 80);                                   // two steps down
  const low = g.ratio; assert.ok(low < 1.5);
  run(g, 16.7, 40 * 6);                             // a quiet spell: one try up
  assert.ok(g.ratio > low, 'stepped up');
  const tried = g.ratio;
  run(g, 30, 40);                                   // too much: back down
  assert.ok(g.ratio < tried);
  const again = g.ratio;
  run(g, 16.7, 40 * 6);
  assert.equal(g.ratio, again, 'waits longer before trying again');
  run(g, 16.7, 40 * 6);
  assert.ok(g.ratio > again, 'then tries');
});
