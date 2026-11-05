// Mannequin lesson data: every cause in the catalogue points at a lesson that exists and is
// well formed (the 3D side needs a browser, so only the data is checked here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITIONS } from '../src/coach/conditions.js';
import { LESSONS, MODES, READOUTS, DRILL_DEMOS } from '../src/coach/lessons.js';

const SCAL = ['pelvis', 'shift', 'drop', 'chest', 'side', 'bend', 'heel', 'knee', 'lookUp', 'stance', 'thrust'];
test('every cause names a lesson that exists (or none)', () => {
  for (const C of Object.values(CONDITIONS)) for (const k of C.causes) {
    if (k.lesson === null) continue;
    assert.ok(LESSONS[k.lesson], `${C.id}.${k.id} -> ${k.lesson}`);
  }
});
test('lessons are well formed', () => {
  for (const [id, L] of Object.entries(LESSONS)) {
    assert.ok(L.title && L.caption && L.caption.length < 120, `${id} title and a one-sentence caption`);
    assert.ok(MODES[L.mode], `${id} mode`); assert.ok(L.readout === null || READOUTS[L.readout], `${id} readout`);
    assert.ok(['panel', 'front', 'dtl', 'dtlPanel', 'close', 'top', 'through'].includes(L.cam), `${id} cam`);
    for (const sw of [L.you || {}, L.goal || {}]) {
      for (const [k, a] of Object.entries(sw.over || {})) { assert.ok(SCAL.includes(k), `${id} ${k}`); assert.equal(a.length, 10, `${id} ${k} has 10 keys`); }
      for (const [i, key] of Object.entries(sw.keys || {})) { assert.ok(+i > 0 && +i < 10 && +i !== 6, `${id} key ${i}`); for (const v of ['H', 'd', 'f']) if (key[v]) assert.equal(key[v].length, 3); }
      if (sw.impact) assert.equal(sw.impact.length, 2);
    }
  }
});
test('the first lessons (flip, open face, over the top, fat and thin) all have figures', () => {
  for (const id of ['flip', 'openFace', 'overTheTop', 'fat', 'thin']) {
    const withFigure = CONDITIONS[id].causes.filter(k => k.lesson && LESSONS[k.lesson]);
    assert.ok(withFigure.length >= 2, id);
  }
  for (const d of Object.keys(DRILL_DEMOS)) assert.ok(Object.values(CONDITIONS).some(C => C.causes.some(k => k.drill.name === d)), d);
});
