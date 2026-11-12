import test from 'node:test';
import assert from 'node:assert/strict';
import { nineFlags } from '../tools/review/spread.mjs';

const hole = (n, par, yards, o = {}) => ({ n, name: 'H' + n, par, yards, green: 550, byGreen: 1, inFairway: 1, biggest: 200, width: par > 3 ? 48 : null, turn: 30, ...o });
test('a nine whose holes sit in the middle of every dial is flagged on each', () => {
  const F = [hole(1, 4, 400), hole(2, 3, 165), hole(3, 5, 530), hole(4, 4, 410), hole(5, 4, 390), hole(6, 3, 170), hole(7, 4, 420), hole(8, 5, 540), hole(9, 4, 380)];
  const { flags } = nineFlags(F), has = t => flags.some(f => f.includes(t));
  for (const t of ['Greens cluster', 'Par 3s cluster', 'Par 4s cluster', 'Par 5s cluster', 'Fairway widths cluster', 'Bunker counts cluster', 'Bends cluster', 'Edges of real golf', 'Past real golf']) assert.ok(has(t), t);
});
test('variety passes without a tiny green or a huge one, and one hole past real golf is wanted', () => {
  const F = [
    hole(1, 4, 400, { green: 450, width: 62, turn: 10 }), hole(2, 3, 135, { green: 420, byGreen: 3 }), hole(3, 5, 495, { green: 700, inFairway: 4, turn: 75 }),
    hole(4, 4, 310, { green: 480, width: 36 }), hole(5, 4, 470, { green: 640, byGreen: 0, inFairway: 0, turn: 5 }), hole(6, 3, 215, { green: 760 }),
    hole(7, 4, 430, { green: 520, byGreen: 2 }), hole(8, 5, 660, { green: 600, width: 80, turn: 50 }), hole(9, 4, 365, { green: 560, byGreen: 2, inFairway: 3 }),
  ];
  const { flags, past, edges } = nineFlags(F);
  assert.deepEqual(flags, []);
  assert.equal(past.length, 1);                 // the 660 yd par 5
  assert.ok(edges.length >= 3);
});
