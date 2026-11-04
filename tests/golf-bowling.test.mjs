// Golf Bowling rules: scoring, splits, the 10th frame, and the roll + pin action.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../src/physics.js';
import { YD, CLUBS, DIFFICULTIES, SHAPES, ALL_PINS, AIM_H, PIN_H, PIN_S, rack, solveInto, crossing, pocket, isSplit, splitName, score, marks, frameDone, pinsUp, strikeWord, bowl, rollFrom, bestLine } from '../src/minigames/bowling-logic.js';

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

// a ball arriving at the head pin's row at x, speed (m/s) and entry angle (deg, − = curving left)
function into(L, x, speed, deg, seed) {
  const sl = Math.tan(deg * Math.PI / 180), back = 4, dl = Math.hypot(sl, 1), vy = -speed * Math.tan(30 * Math.PI / 180), dt = 0.01;
  const p0 = [x - sl * back, AIM_H - vy * back / speed, -(L - back)], v = [sl / dl * speed, vy, -1 / dl * speed];
  return bowl([{ t: 0, p: p0.map((c, i) => c - v[i] * dt) }, { t: dt, p: p0 }], ALL_PINS, { L, seed });
}

test('pin action: a pocket hit strikes more than a head-on hit, a wide ball misses', () => {
  const L = 100 * YD, x = bestLine(ALL_PINS, { L });
  assert.ok(Math.abs(x) > PIN_S * 0.08 && Math.abs(x) < PIN_S * 0.5, `the best line is a pocket, not head on (${x})`);
  let pocketHits = 0, head = 0;
  for (let s = 1; s <= 30; s++) { pocketHits += into(L, x, 18, 0, s).down.length === 10; head += into(L, 0, 18, 0, s).down.length === 10; }
  assert.ok(pocketHits > head + 8, `pocket ${pocketHits} vs head-on ${head}`);
  assert.equal(into(L, 25, 18, 0, 1).down.length, 0);
  const r = into(L, x, 18, 0, 3); assert.ok(r.contactT > 0 && r.contact.speed > 15 && r.ballPts.length > 10 && Object.keys(r.tracks).length >= r.down.length);
});

test('speed makes the pins explode: a hot ball beats a slow one, and rolling in is weak', () => {
  const L = 140 * YD;
  let hot = 0, slow = 0;
  for (let s = 1; s <= 30; s++) { hot += into(L, 1.5, 22, -4, s).down.length === 10; slow += into(L, 1.5, 7, -4, s).down.length === 10; }
  assert.ok(hot > slow + 10, `hot ${hot} vs slow ${slow} strikes`);
  const roll = (s) => rollFrom({ x: 1.6, z: -(L - 12), vx: -0.3, vz: -6 }, ALL_PINS, { L, seed: s }).down.length;
  let rolled = 0; for (let s = 1; s <= 20; s++) rolled += roll(s) === 10;
  assert.ok(rolled <= 6, `a slow roller strikes ${rolled}/20`);
});

test('a hook into the pocket carries better than a straight ball', () => {
  const L = 140 * YD;
  let hook = 0, straight = 0;
  for (const dx of [-0.75, -0.25, 0.25, 0.75]) for (let s = 1; s <= 15; s++) {
    hook += into(L, pocket(-0.07) + dx, 18, -4, s).down.length === 10;
    straight += into(L, pocket(0) + dx, 18, 0, s).down.length === 10;
  }
  assert.ok(hook > straight + 4, `hook ${hook} vs straight ${straight} strikes`);
  assert.equal(pocket(-0.07), -pocket(0.07)); // a fade into the 1-2 pocket mirrors a draw into the 1-3
});

test('the suggested shot flies into the pocket below the tops of the pins', () => {
  const fl = b => simulate(b, { groundAt: () => 0, flightOnly: true }).pts;
  for (const d of [DIFFICULTIES[0], DIFFICULTIES[2]]) for (const sh of SHAPES) {
    const L = d.lane * YD, x = pocket(sh.axis < 0 ? -1 : sh.axis > 0 ? 1 : 0);
    const sol = solveInto(fl, CLUBS, { L, x, axis: sh.axis });
    const c = crossing(fl(sol.ball), L);
    assert.ok(Math.abs(c.y - AIM_H) < 0.6 && c.y < PIN_H, `${d.id} ${sh.id}: crosses at ${c.y.toFixed(1)} m`);
    assert.ok(Math.abs(c.x - x) < 0.5, `${d.id} ${sh.id}: crosses at x ${c.x.toFixed(2)} (wanted ${x})`);
    if (sh.axis) assert.ok(Math.sign(c.slope) === Math.sign(sh.axis), `${d.id} ${sh.id}: curves the right way`);
    let n = 0; for (let s = 1; s <= 6; s++) n += bowl(fl(sol.ball), ALL_PINS, { L, pinMass: d.pinMass, seed: s }).down.length;
    assert.ok(n / 6 >= 8, `${d.id} ${sh.id}: ideal shot knocks ${(n / 6).toFixed(1)}`);
  }
  // a longer club is hit as a knockdown: lower and hotter into the pins
  const L = 140 * YD, a = solveInto(fl, CLUBS, { L, x: 1.75, axis: -9, club: 6 }), b = solveInto(fl, CLUBS, { L, x: 1.75, axis: -9, club: 1 });
  assert.ok(b.cross.speed > a.cross.speed * 1.3 && b.cross.descent < a.cross.descent - 10, 'the 5 iron punch comes in faster and flatter than the wedge');
});

test('bumpers (Beginner) turn a wide roll back into the pins', () => {
  const L = 100 * YD, x0 = 13, start = { x: x0, z: -(L - 30), vx: 0.9, vz: -13 };
  assert.equal(rollFrom(start, ALL_PINS, { L, seed: 2 }).down.length, 0);
  const b = rollFrom(start, ALL_PINS, { L, seed: 2, bumpers: true }); assert.ok(b.bumped && b.down.length > 0);
});
