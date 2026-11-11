import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFairway } from '../tools/lostvalley/shapes.mjs';
import { makeFairway as makeE } from '../tools/emberfell/shapes.mjs';
import { signature, distance } from '../tools/review/alike.mjs';
import { FORMS } from '../tools/review/forms.mjs';

const LINE = [[0, 0], [0, -390]];
const sig = fw => { const fd = makeFairway(LINE, fw); return signature(LINE, (x, z) => fd(x, z) < 0); };

test('the plan tools draw lobes and bites as well as ribbons, the same in both toolsets', () => {
  const fw = [{ e: [[60, 20, 20], [300, 20, 20]], wob: 0 }, { lobes: [[200, 60, 30, 25]], wob: 0 }, { bite: [[150, 0, 12, 10]], wob: 0 }];
  for (const mk of [makeFairway, makeE]) {
    const f = mk(LINE, fw);
    assert.ok(f(0, -100) < 0, 'inside the ribbon');
    assert.ok(f(0, -150) > 0, 'the bite is cut out of it');
    assert.ok(f(60, -200) < 0, 'the lobe is fairway');
    assert.ok(f(150, -200) > 0, 'beyond it is not');
  }
});

test('every form on the sheet is named as itself, and no two forms measure alike', () => {
  const want = { 'Hourglass (Bottle)': 'hourglass', 'Island (doughnut)': 'island', 'Double (Channel)': 'split' };
  const S = FORMS.map(F => ({ name: F.name, s: sig(F.fw) }));
  for (const { name, s } of S) assert.equal(s.form, want[name] || name.toLowerCase(), name);
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(distance(S[i].s, S[j].s) > 0.25, `${S[i].name} and ${S[j].name}: ${distance(S[i].s, S[j].s).toFixed(2)}`);
});

test('two fairways from the stock numbers measure alike, mirrored or not', () => {
  const a = sig([{ e: [[60, 14, 14], [100, 22, 22], [150, 28, 27], [200, 32, 27], [240, 30, 25], [275, 22, 23], [335, 13, 14]], wob: 5 }]);
  const b = sig([{ e: [[62, 14, 14], [100, 22, 22], [150, 27, 28], [195, 29, 30], [230, 29, 29], [262, 24, 24], [340, 13, 14]], wob: 5, seed: 40 }]);
  assert.equal(a.form, 'spindle'); assert.equal(b.form, 'spindle');
  assert.ok(distance(a, b) < 0.25, `stock shapes: ${distance(a, b).toFixed(2)}`);
});
