// The Overlook's pterosaur: its flight off the spire by the 7th tee, against the course as built.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFlight } from '../src/course/ptero-flight.js';
import { createTerrain } from '../src/course/terrain.js';
import { HOLES } from '../src/course/lostvalley.js';

const H = HOLES.find(h => h.name === 'The Overlook'), T = createTerrain(H);
const spire = H.rocks.find(r => r.spire);
const perch = [spire.x, spire.y + spire.h + 2, spire.z];
const F = makeFlight({ perch, floor: (x, z) => T.groundAt(x, z) });
const samples = []; for (let t = 0; t <= F.duration; t += 0.25) samples.push({ t, ...F.at(t) });

test('the spire stands just off the 7th tee, and the pterosaur starts on it, folded, still', () => {
  assert.ok(spire, 'the spire');
  assert.ok(Math.hypot(spire.x, spire.z) < 110 && spire.x < -30, 'off the tee, to the left');
  const top = spire.y + spire.h, tee = T.groundAt(0, 0); assert.ok(top > tee + 1 && top < tee + 8, `its top just over the lip (${(top - tee).toFixed(1)} m)`);
  const a = F.at(0);
  assert.deepEqual(a.p, perch); assert.equal(a.fold, 1); assert.equal(a.gone, false);
  const c = F.at(0.2).p; assert.ok(Math.hypot(c[0] - perch[0], c[1] - perch[1], c[2] - perch[2]) < 0.5 && F.at(0.2).crouch > 0, 'it crouches on the spot before it goes');
});

test('it springs off, opens its wings and glides away, gone after a minute or two', () => {
  assert.ok(F.at(1.4).fold < 0.05, 'wings open by the end of the spring');
  assert.ok(F.duration > 50 && F.duration < 150, `${F.duration.toFixed(0)} s`);
  assert.ok(F.at(F.duration + 1).gone);
  const end = F.at(F.duration - 0.1).p; assert.ok(Math.hypot(end[0], end[2]) > 600, 'far away at the end');
  for (let i = 1; i < samples.length; i++) { const a = samples[i - 1].p, b = samples[i].p; assert.ok(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.25 < 24, 'never faster than its dive'); }
});

test('it stays out of the shot: 30 m or more left of the 7th\'s line while the ball is in the air, never over the line', () => {
  for (const s of samples) if (s.t <= 5.5) assert.ok(s.p[0] < -30, `at ${s.t}s it is ${s.p[0].toFixed(0)} m off the line`);
  for (const s of samples) assert.ok(s.p[0] < -12, `at ${s.t}s it is ${s.p[0].toFixed(0)} m off the line`);
});

test('it drops below the tee (seen from above) and keeps 10 m or more over the ground once away', () => {
  const tee = T.groundAt(0, 0);
  assert.ok(samples.some(s => s.p[1] < tee + 2), 'below eye height at some point');
  for (const s of samples) if (s.t > 4) { const g = T.groundAt(s.p[0], s.p[2]); if (g != null) assert.ok(s.p[1] - g >= 10, `${(s.p[1] - g).toFixed(1)} m over the ground at ${s.t}s`); }
});

test('it banks left as it turns toward the herd', () => {
  assert.ok(samples.some(s => s.bank > 0.15), 'left wing down in the turn');
  assert.ok(!samples.some(s => s.bank < -0.35), 'only a gentle right bank as it eases in toward the green');
});

test('in the tee view on its perch and while the ball climbs, from both back tees (the camera cuts away after about 3 s)', () => {
  // the camera stands 3.2 m behind the ball looking down the line; on a phone it shows about 45 deg either side
  for (const id of ['titan', 'rex']) {
    const [tx, tz] = H.tees[id], cx = tx, cz = tz + 3.2;
    for (const s of samples) if (s.t <= 3.25) { const ang = Math.atan2(-(s.p[0] - cx), -(s.p[2] - cz)) * 180 / Math.PI; assert.ok(ang > 5 && ang < 38, `${id}: ${ang.toFixed(0)} deg left at ${s.t}s`); }
  }
});

test('it crosses the landing view: in front of the camera short of the green, while the ball lands and rolls (5-10 s)', () => {
  // the course's landing view stands short of the green, about 12 m left of the line, looking down it
  const cx = -12, cz = -Math.hypot(...H.pin) + 46;
  const seen = samples.filter(s => s.t >= 5 && s.t <= 10 && s.p[2] < cz - 15 && Math.abs(Math.atan2(-(s.p[0] - cx), -(s.p[2] - cz))) < 35 * Math.PI / 180);
  assert.ok(seen.length >= 4, `in the landing view for ${(seen.length * 0.25).toFixed(1)} s`);
});
