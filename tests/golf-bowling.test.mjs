// Golf Bowling rules: scoring, splits, the 10th frame, and the roll + pin action.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { solveShot } from '../src/minigames/aim.js';
import { YD, CLUBS, DIFFICULTIES, ALL_PINS, LAND_GAP, PIN_S, rack, isSplit, splitName, score, marks, frameDone, pinsUp, strikeWord, bowl, rollFrom, bestLine } from '../src/minigames/bowling-logic.js';

const game = s => s.map(f => f.slice());

test('scoring: a perfect game is 300, all spares of 5 is 150, all nines is 90', () => {
  assert.equal(score([...Array(9)].map(() => [10]).concat([[10, 10, 10]])).total, 300);
  assert.equal(score([...Array(9)].map(() => [5, 5]).concat([[5, 5, 5]])).total, 150);
  assert.equal(score([...Array(10)].map(() => [9, 0])).total, 90);
  const s = score(game([[10], [7, 3], [9, 0], [10], [0, 8], [8, 2], [0, 6], [10], [10], [10, 8, 1]]));
  assert.deepEqual(s.cum, [20, 39, 48, 66, 74, 84, 90, 120, 148, 167]);
});

test('running totals wait for strike and spare bonuses, the live total never goes down', () => {
  assert.deepEqual(score([[10]]).cum, [null]);
  assert.deepEqual(score([[10], [3]]).cum, [null, null]);
  assert.deepEqual(score([[10], [3, 4]]).cum, [17, 24]);
  assert.deepEqual(score([[6, 4], [8]]).cum, [18, null]);
  const rolls = [[10], [10], [7, 3], [4, 2]]; let last = 0;
  for (let f = 0; f < rolls.length; f++) for (let b = 1; b <= rolls[f].length; b++) {
    const tot = score([...rolls.slice(0, f), rolls[f].slice(0, b)]).total; assert.ok(tot >= last); last = tot;
  }
  assert.equal(last, score(rolls).total);
});

test('frames end at the right ball, and the 10th re-racks after a mark', () => {
  assert.ok(frameDone([10], 0) && !frameDone([7], 0) && frameDone([7, 2], 0));
  assert.ok(!frameDone([10], 9) && !frameDone([10, 3], 9) && frameDone([10, 3, 4], 9));
  assert.ok(frameDone([6, 3], 9) && !frameDone([6, 4], 9));
  assert.equal(pinsUp([7], 3), 3);
  assert.equal(pinsUp([10], 9), 10); assert.equal(pinsUp([10, 6], 9), 4); assert.equal(pinsUp([6, 4], 9), 10);
});

test('score sheet marks', () => {
  assert.deepEqual(marks([10], 0), ['', 'X']);
  assert.deepEqual(marks([7, 3], 2), ['7', '/']);
  assert.deepEqual(marks([0, 0], 2), ['-', '-']);
  assert.deepEqual(marks([10, 10, 10], 9), ['X', 'X', 'X']);
  assert.deepEqual(marks([10, 7, 3], 9), ['X', '7', '/']);
  assert.deepEqual(marks([8, 2, 10], 9), ['8', '/', 'X']);
  assert.equal(strikeWord(1), 'STRIKE'); assert.equal(strikeWord(3), 'TURKEY');
});

test('splits: the head pin is down and the pins left do not touch', () => {
  assert.ok(isSplit([7, 10]) && isSplit([4, 6]) && isSplit([2, 7]) && isSplit([3, 10]) && isSplit([5, 6]) && isSplit([4, 6, 7, 10]));
  assert.ok(!isSplit([1, 7]) && !isSplit([2, 4]) && !isSplit([4, 7]) && !isSplit([3, 5, 6]) && !isSplit([10]) && !isSplit([2, 4, 5, 8]));
  assert.equal(splitName([10, 7]), 'The bedposts');
  assert.equal(rack(0).find(p => p.n === 10).x, 1.5 * PIN_S);
});

test('pin action: a pocket hit strikes more than a head-on hit, a wide ball misses', () => {
  const L = 100 * YD, x = bestLine(ALL_PINS, { L });
  assert.ok(Math.abs(x) > PIN_S * 0.08 && Math.abs(x) < PIN_S * 0.5, `the best line is a pocket, not head on (${x})`);
  const roll = (x, seed) => { const dl = Math.hypot(x / L, 1); return rollFrom({ x: x * (L - 8) / L, z: -(L - 8), vx: x / L / dl * 9, vz: -1 / dl * 9 }, ALL_PINS, { L, seed }); };
  let pocket = 0, head = 0;
  for (let s = 1; s <= 30; s++) { pocket += roll(x, s).down.length === 10; head += roll(0, s).down.length === 10; }
  assert.ok(pocket > head + 8, `pocket ${pocket} vs head-on ${head}`);
  const wide = roll(25, 1); assert.equal(wide.down.length, 0);
  const r = roll(x, 3); assert.ok(r.contactT > 0 && r.ballPts.length > 10 && Object.keys(r.tracks).length >= r.down.length);
});

test('the ideal shot lands short of the pins and rolls in', () => {
  const sim = b => simulate(b, { groundAt: () => 0 });
  for (const d of DIFFICULTIES) {
    const L = d.lane * YD, x = bestLine(ALL_PINS, { L, pinMass: d.pinMass }), f = (L - LAND_GAP) / L;
    const sol = solveShot(sim, CLUBS, { x: x * f, z: -(L - LAND_GAP) });
    const fl = simulate(sol.ball, { groundAt: () => 0, flightOnly: true });
    const r = bowl(fl.pts, ALL_PINS, { L, pinMass: d.pinMass, seed: 5 });
    assert.ok(r.landing && Math.abs(-r.landing.z - (L - LAND_GAP)) < 2, `${d.id}: lands ${(-r.landing.z / YD).toFixed(1)} yd`);
    assert.ok(r.down.length >= 7, `${d.id}: ideal shot knocks ${r.down.length}`);
  }
});

test('bumpers (Beginner) turn a wide roll back into the pins', () => {
  const L = 100 * YD, x0 = 13, start = { x: x0, z: -(L - 30), vx: 0.6, vz: -9 };
  assert.equal(rollFrom(start, ALL_PINS, { L, seed: 2 }).down.length, 0);
  const b = rollFrom(start, ALL_PINS, { L, seed: 2, bumpers: true }); assert.ok(b.bumped && b.down.length > 0);
});
