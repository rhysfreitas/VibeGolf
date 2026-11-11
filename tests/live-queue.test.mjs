import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveQueue } from '../src/live-queue.js';

function rig() {
  const g = { phase: 'aim', t: 0, played: [], held: [], dropped: [] };
  g.q = createLiveQueue({ ready: () => g.phase === 'aim', canHold: () => g.phase !== 'setup', play: s => { g.played.push(s); g.phase = 'flight'; },
    now: () => g.t, onHold: s => g.held.push(s), onDrop: (s, why) => g.dropped.push(why) });
  return g;
}

test('a swing when the game is ready plays at once', () => {
  const g = rig();
  assert.equal(g.q.push('a'), 'played');
  assert.deepEqual(g.played, ['a']);
});

test('a swing a moment early is held and played when the game is ready', () => {
  const g = rig(); g.phase = 'flight';
  assert.equal(g.q.push('a'), 'held');
  assert.equal(g.q.flush(), false, 'still not ready');
  g.t = 3000; g.phase = 'aim';
  assert.equal(g.q.flush(), true);
  assert.deepEqual(g.played, ['a']);
  g.phase = 'aim';
  assert.equal(g.q.flush(), false, 'played once only');
});

test('a newer swing replaces the held one; a stale one is dropped, not played', () => {
  const g = rig(); g.phase = 'flight';
  g.q.push('a'); g.t = 1000; g.q.push('b');
  g.t = 2000; g.phase = 'aim'; g.q.flush();
  assert.deepEqual(g.played, ['b']);
  g.phase = 'flight'; g.q.push('c'); g.t = 20000; g.phase = 'aim';
  assert.equal(g.q.flush(), false);
  assert.deepEqual(g.played, ['b']);
  assert.deepEqual(g.dropped, ['too-early']);
});

test('nothing is held on a menu', () => {
  const g = rig(); g.phase = 'setup';
  assert.equal(g.q.push('a'), 'dropped');
  g.phase = 'aim';
  assert.equal(g.q.flush(), false);
  assert.deepEqual(g.dropped, ['not-playing']);
});
