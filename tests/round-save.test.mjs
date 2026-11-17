import test from 'node:test';
import assert from 'node:assert/strict';
import { packRound, readRound, describeRound, nextOpen, ROUND_MAX_AGE } from '../src/course/round-save.js';

const course = { id: 'aerie', holes: 9, teeIds: ['eagle', 'hawk', 'kestrel', 'wren'] };
const live = (o = {}) => ({ courseId: 'aerie', cond: { tee: 'hawk', time: 'morning', wind: 'breeze', windFrom: 'random', weather: 'clear', temp: 'mild', teeChosen: true },
  windRoll: { mph: 7.2, from: 135, holes: [{ dMph: 0.1, dFrom: 4 }] }, pinPick: [0, 2, 1], scores: [4, 5, 3], holeIdx: 3, strokes: 2, ball: [12.3456, 4.2, -231.987], lie: 'rough', ...o });

test('a round in progress comes back as it was saved', () => {
  const raw = JSON.stringify(packRound(live(), 1000));
  const r = readRound(raw, course, 1000 + 60000);
  assert.ok(r);
  assert.equal(r.holeIdx, 3); assert.equal(r.strokes, 2); assert.equal(r.lie, 'rough');
  assert.deepEqual(r.ball, [12.35, 4.2, -231.99]);
  assert.deepEqual(r.scores, [4, 5, 3]);
  assert.equal(r.cond.tee, 'hawk'); assert.equal(r.cond.teeChosen, undefined, 'only the conditions are kept');
  assert.equal(describeRound(r, [4, 4, 3, 5, 4, 3, 4, 4, 5]), 'Hole 4 · 2 strokes · +1 thru 3');
});

test('holed out mid-round: it resumes on the next tee; a finished round is not kept', () => {
  const r = readRound(packRound(live({ holed: true, scores: [4, 5, 3, 5] }), 0), course, 1);
  assert.ok(r.holed);
  assert.equal(describeRound(r, [4, 4, 3, 5, 4, 3, 4, 4, 5]), 'Hole 5 · on the tee · +1 thru 4');
  assert.equal(readRound(packRound(live({ holeIdx: 8, holed: true, scores: [4, 5, 3, 5, 4, 3, 4, 4, 5] }), 0), course, 1), null);
});

test('holes played in any order: next is the next one still to play, and the round ends when all have a score', () => {
  assert.equal(nextOpen([4, 5, 3], 2, 9), 3, 'in order, the next hole');
  assert.equal(nextOpen([4, null, 3, null, null, null, null, null, 5], 8, 9), 1, 'after the 9th, back round to the 2nd');
  assert.equal(nextOpen([4, 5], 6, 9), 7, 'from a hole picked out of order, on from there');
  assert.equal(nextOpen([4, 5, 3, 5, 4, 3, 4, 4, 5], 8, 9), -1, 'every hole scored: finished');
  assert.equal(nextOpen([4, 5, 3, 5, 4, 3, 4, 4], 2, 9), 8, 'only the 9th left');
  // the 9th holed out first: not finished, it resumes on the 1st
  const sc = []; sc[8] = 4;
  const r = readRound(packRound(live({ holeIdx: 8, holed: true, scores: sc }), 0), course, 1);
  assert.ok(r, 'kept');
  assert.equal(describeRound(r, [4, 4, 3, 5, 4, 3, 4, 4, 5]), 'Hole 1 · on the tee · -1 thru 1');
  // replaying a hole that has a score: its old score isn't counted while it's being played again
  const r2 = readRound(packRound(live({ holeIdx: 1, strokes: 1, scores: [4, 5, 3] }), 0), course, 1);
  assert.equal(describeRound(r2, [4, 4, 3, 5, 4, 3, 4, 4, 5]), 'Hole 2 · 1 stroke · level thru 2');
});

test('a save is refused when it is stale, for another course, for tees that no longer exist, or broken', () => {
  const p = packRound(live(), 0);
  assert.equal(readRound(p, course, ROUND_MAX_AGE + 1), null, 'too old');
  assert.equal(readRound(p, { ...course, id: 'redmesa' }, 1), null, 'another course');
  assert.equal(readRound(p, { ...course, teeIds: ['a', 'b'] }, 1), null, 'tees changed');
  assert.equal(readRound(p, { ...course, holes: 3 }, 1), null, 'hole gone');
  assert.equal(readRound('{nope', course, 1), null);
  assert.equal(readRound(null, course, 1), null);
  assert.equal(readRound({ ...p, ball: [1, NaN, 2] }, course, 1), null);
  assert.equal(readRound(packRound(live({ holeIdx: 0, strokes: 0, scores: [] }), 0), course, 1), null, 'nothing played yet');
});

test('once-a-round events (the Lost Valley\'s pterosaur) are kept with the round, and an older save has none', () => {
  const r = readRound(JSON.stringify(packRound(live({ once: ['ptero'] }), 0)), course, 1);
  assert.deepEqual(r.once, ['ptero']);
  const old = packRound(live(), 0); delete old.once;
  assert.deepEqual(readRound(JSON.stringify(old), course, 1).once, []);
  assert.equal(readRound({ ...packRound(live(), 0), once: 'ptero' }, course, 1), null, 'a broken list is refused');
});

test("what the course rolled (Emerald Bay's tide) is kept with the round, and an older save has none", () => {
  assert.deepEqual(readRound(JSON.stringify(packRound(live({ rolls: { tide: 'high' } }), 0)), course, 1).rolls, { tide: 'high' });
  const old = packRound(live(), 0); delete old.rolls;
  assert.deepEqual(readRound(JSON.stringify(old), course, 1).rolls, {});
  assert.equal(readRound({ ...packRound(live(), 0), rolls: ['high'] }, course, 1), null, 'a broken roll is refused');
  assert.equal(readRound({ ...packRound(live(), 0), rolls: { tide: 3 } }, course, 1), null);
});
