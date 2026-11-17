// versions.js: a course's rolls (Emerald Bay's tide) and the versions of its holes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rollPicks, checkPicks, applyPicks, picksLabel } from '../src/course/versions.js';

const ROLLS = [{ id: 'tide', name: 'Tide', options: [{ id: 'low', name: 'Low tide', sea: 0 }, { id: 'high', name: 'High tide', sea: 2.4 }] }];
const course = () => ({ rolls: ROLLS });
const holes = () => [
  { n: 1, frame: { base: 5 }, yards: { a: 300 }, targets: [{ name: 'Green', pin: true }], tips: { tee: [0, 10], yards: 320 } },
  { n: 2, frame: { base: 2 }, yards: { a: 200 }, targets: [], tips: { tee: [0, 10], yards: 215 }, versionBy: 'tide',
    versions: [{ id: 'low', note: 'Low tide: run it up.', yards: { a: 200 }, tipsYards: 215, targets: [{ name: 'Tongue', x: 0, z: -90 }] },
               { id: 'high', note: 'High tide: all carry.', yards: { a: 220 }, tipsYards: 235, targets: [{ name: 'Green', pin: true }] }] },
];

test('rollPicks: one option per roll, from the generator', () => {
  assert.deepEqual(rollPicks(ROLLS, () => 0), { tide: 'low' });
  assert.deepEqual(rollPicks(ROLLS, () => 0.999), { tide: 'high' });
  assert.deepEqual(rollPicks(undefined), {});
  const seen = new Set(); for (let i = 0; i < 50; i++) seen.add(rollPicks(ROLLS).tide); assert.equal(seen.size, 2);
});

test('checkPicks: a saved pick must name a real option', () => {
  assert.deepEqual(checkPicks(ROLLS, { tide: 'high' }), { tide: 'high' });
  assert.equal(checkPicks(ROLLS, { tide: 'spring' }), null);
  assert.equal(checkPicks(ROLLS, {}), null);
  assert.equal(checkPicks(ROLLS, null), null);
  assert.deepEqual(checkPicks([], { tide: 'x' }), {});
});

test("applyPicks: the version's targets, yards, tips yards and note; every hole the sea in its own frame", () => {
  const H = holes();
  applyPicks(course(), H, { tide: 'high' });
  assert.equal(H[0].sea, 2.4 - 5); assert.equal(H[1].sea, 2.4 - 2);
  assert.deepEqual(H[1].yards, { a: 220 }); assert.equal(H[1].tips.yards, 235); assert.equal(H[1].version, 'high');
  assert.equal(H[1].versionNote, 'High tide: all carry.'); assert.equal(H[1].targets[0].name, 'Green');
  assert.deepEqual(H[0].yards, { a: 300 }, 'a hole without versions keeps its own'); assert.equal(H[0].version, undefined);
  applyPicks(course(), H, { tide: 'low' });
  assert.equal(H[0].sea, -5); assert.deepEqual(H[1].yards, { a: 200 }); assert.equal(H[1].targets[0].name, 'Tongue'); assert.equal(H[1].tips.yards, 215);
  const plain = holes(); applyPicks({}, plain, {}); assert.equal(plain[0].sea, undefined, 'no roll sets a sea: no sea');
});

test('picksLabel names the options', () => {
  assert.equal(picksLabel(ROLLS, { tide: 'high' }), 'High tide');
  assert.equal(picksLabel(undefined, {}), '');
});
