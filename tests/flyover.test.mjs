// The intro flyover: the default shape, and the planned paths in flyovers.js still match their holes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultFlyover, plannedFlyover, flyoverFor } from '../src/course/flyover.js';
import { FLYOVERS } from '../src/course/flyovers.js';

const MODULES = { aerie: 'aerie', redmesa: 'red-mesa', hollowmere: 'hollowmere', reclaim: 'reclaim', rimeholm: 'rimeholm', emberfell: 'emberfell', lostvalley: 'lostvalley', halcyon: 'halcyon', buriedkingdom: 'buriedkingdom', wreckersreach: 'wreckersreach', eldergrove: 'eldergrove', cloudrest: 'cloudrest', emeraldbay: 'emeraldbay' };

test('the default flyover: behind the tee to the left, high out left over the middle, past the pin to the right', () => {
  const f = defaultFlyover([0, 10, 0], [0, 20, -400]);
  assert.equal(f.pts.length, 3); assert.equal(f.looks.length, 3);
  assert.deepEqual(f.pts[0], [-20, 42, 55]);
  assert.deepEqual(f.pts[1], [-140, 15 + 70 + 32, -200]);
  assert.deepEqual(f.pts[2], [35, 48, -450]);
  assert.ok(Math.abs(f.dur - Math.min(9, 5.5 + 400 / 160)) < 1e-9);
});

test('a planned path is used only for the tee and green it was planned for', () => {
  const e = { tee: [0, 0], green: [0, -400], pts: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], looks: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], dur: 7 };
  const table = { c: { 2: { back: e } } };
  assert.equal(plannedFlyover(table, 'c', 2, 'back', [0, 0], [0, -400]), e);
  assert.equal(plannedFlyover(table, 'c', 2, 'back', [10, 0], [0, -400]), null, 'the tee moved');
  assert.equal(plannedFlyover(table, 'c', 2, 'back', [0, 0], [20, -400]), null, 'the green moved');
  assert.equal(plannedFlyover(table, 'c', 2, 'fwd', [0, 0], [0, -400]), null);
  assert.deepEqual(flyoverFor(table, 'c', 3, 'back', [0, 0, 0], [0, 0, -400], [0, -400]).pts, defaultFlyover([0, 0, 0], [0, 0, -400]).pts);
});

test('every planned flyover still matches its hole (else rerun tools/review/flyover.mjs <course> --write)', async () => {
  for (const [cid, holes] of Object.entries(FLYOVERS)) {
    assert.ok(MODULES[cid], `unknown course ${cid}`);
    const { HOLES, COURSE } = await import(`../src/course/${MODULES[cid]}.js`);
    assert.equal(COURSE.id, cid);
    for (const [k, sets] of Object.entries(holes)) {
      const h = HOLES[+k]; assert.ok(h, `${cid} hole index ${k}`);
      for (const [id, e] of Object.entries(sets)) {
        assert.ok(h.tees[id], `${cid} ${+k + 1} tee set ${id}`);
        assert.ok(plannedFlyover(FLYOVERS, cid, +k, id, h.tees[id], [h.green.x, h.green.z]), `${cid} ${+k + 1} ${id}: the tee or green has moved since the flyover was planned`);
        assert.ok(e.pts.length >= 3 && e.pts.length === e.looks.length, `${cid} ${+k + 1} ${id}: control points`);
        for (const q of [...e.pts, ...e.looks]) assert.ok(q.length === 3 && q.every(Number.isFinite));
        assert.ok(e.dur >= 4 && e.dur <= 12);
      }
    }
  }
});
