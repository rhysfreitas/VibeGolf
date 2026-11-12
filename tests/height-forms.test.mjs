import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMS, formOf } from '../tools/review/height-forms.mjs';
import { heightForm, BOLD, PLAIN } from '../tools/review/relief.mjs';

test('the check names every height form on the sheet', () => {
  for (const f of FORMS) assert.equal(formOf(f).form, f.name, f.name);
});
test('a steady ramp and level ground are plain, not a form', () => {
  const line = [[0, 0], [0, -380]], fw = () => true;
  assert.equal(heightForm(line, (x, z) => 12 * -z / 380, fw, 4).form, 'ramp up');
  assert.equal(heightForm(line, (x, z) => -12 * -z / 380, fw, 4).form, 'ramp down');
  assert.equal(heightForm(line, () => 0, fw, 4).form, 'level');
  assert.ok(PLAIN.includes('ramp up') && BOLD.includes('table top') && BOLD.includes('hillside bench'));
});
test('a par 3 off a height is a drop, and 25 m of climb is bold', () => {
  const fw = () => true;
  assert.equal(heightForm([[0, 0], [0, -160]], (x, z) => -20 * -z / 160, fw, 3).form, 'drop par 3');
  assert.equal(heightForm([[0, 0], [0, -400]], (x, z) => 30 * -z / 400, fw, 4).form, 'big climb');
});
