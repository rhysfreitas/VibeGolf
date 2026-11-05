// Calibration regression: the flight model must stay close to TrackMan PGA Tour averages.
// Run with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, airDensity } from '../src/physics.js';

const TOUR = [ // club, ball mph, launch deg, spin rpm, apex yd, land deg, carry yd
  ['Driver', 167, 10.9, 2686, 32, 38, 275],
  ['3 wood', 158, 9.2, 3655, 30, 43, 243],
  ['5 iron', 132, 12.1, 5361, 31, 47, 194],
  ['7 iron', 120, 16.3, 7097, 32, 50, 172],
  ['9 iron', 109, 20.4, 8647, 30, 51, 148],
  ['PW', 102, 24.2, 9304, 29, 52, 136],
];
const rho = airDensity(75, 0, 0.5);

for (const [club, Speed, VLA, TotalSpin, apex, land, carry] of TOUR) {
  test(`${club} carry within 5% of tour average`, () => {
    const r = simulate({ Speed, VLA, HLA: 0, TotalSpin, SpinAxis: 0 }, { rho });
    const err = Math.abs(r.carry - carry) / carry;
    assert.ok(err < 0.05, `${club}: carry ${r.carry.toFixed(1)} vs ${carry} (${(err * 100).toFixed(1)}%)`);
    assert.ok(Math.abs(r.apexYd - apex) < 4, `${club}: apex ${r.apexYd.toFixed(1)} vs ${apex}`);
    assert.ok(Math.abs(r.descent - land) < 6, `${club}: landing angle ${r.descent.toFixed(1)} vs ${land}`);
  });
}

test('spin axis curves the ball the right way', () => {
  const fade = simulate({ Speed: 120, VLA: 16, HLA: 0, TotalSpin: 7000, SpinAxis: 8 }, { rho });
  const draw = simulate({ Speed: 120, VLA: 16, HLA: 0, TotalSpin: 7000, SpinAxis: -8 }, { rho });
  assert.ok(fade.carryOffline > 5 && draw.carryOffline < -5);
});

test('thinner air flies farther', () => {
  const shot = { Speed: 120, VLA: 16.3, HLA: 0, TotalSpin: 7097, SpinAxis: 0 };
  const sea = simulate(shot, { altFt: 0 }), denver = simulate(shot, { altFt: 5280 });
  assert.ok(denver.carry > sea.carry * 1.04);
});

test('ball over open air ends in the void; landing island stops it', () => {
  const island = (x, z) => (Math.hypot(x, z) < 15 ? 0 : (Math.abs(x) < 20 && z < -150 && z > -190) ? -10 : null);
  const seven = simulate({ Speed: 120, VLA: 16.3, HLA: 0, TotalSpin: 7097, SpinAxis: 0 }, { rho, groundAt: island, voidY: -200 });
  const wedge = simulate({ Speed: 102, VLA: 24.2, HLA: 0, TotalSpin: 9304, SpinAxis: 0 }, { rho, groundAt: island, voidY: -200 });
  assert.equal(seven.outcome, 'rest');
  assert.equal(wedge.outcome, 'void');
});

test('a ball rolling slowly over the cup drops', () => {
  const chip = { Speed: 30, VLA: 30, HLA: 0, TotalSpin: 3000, SpinAxis: 0 };
  const opts = { groundAt: () => 0, surfaceAt: () => 'green' };
  const free = simulate(chip, opts);
  const stop = free.pts.at(-1).p;
  const holed = simulate(chip, { ...opts, cup: { x: stop[0], z: stop[2] + 0.4 } }); // 40 cm short of where it would stop
  assert.equal(free.outcome, 'rest');
  assert.equal(holed.outcome, 'holed');
});

test('wind: headwind shortens, tailwind lengthens, crosswind drifts', () => {
  const shot = { Speed: 120, VLA: 16.3, HLA: 0, TotalSpin: 7097, SpinAxis: 0 };
  const calm = simulate(shot, { rho }), zero = simulate(shot, { rho, wind: { x: 0, z: 0 } });
  const head = simulate(shot, { rho, wind: { x: 0, z: 5 } });   // air moving toward the golfer
  const tail = simulate(shot, { rho, wind: { x: 0, z: -5 } });
  const cross = simulate(shot, { rho, wind: { x: 5, z: 0 } });  // left to right
  assert.equal(zero.carry, calm.carry);
  assert.ok(head.carry < calm.carry - 8, `head ${head.carry} vs ${calm.carry}`);
  assert.ok(tail.carry > calm.carry + 4, `tail ${tail.carry} vs ${calm.carry}`);
  assert.ok(head.carry - calm.carry < -(tail.carry - calm.carry), 'headwind hurts more than tailwind helps');
  assert.ok(cross.carryOffline > 4, `cross ${cross.carryOffline}`);
});

test('a ball that flies into rock bounces back off it', () => {
  // a wall 100 m out, 40 m tall; the ball should end short of it
  const wall = (x, y, z) => (z < -100 && z > -104 && y < 40 ? [0, 0, 1] : null);
  const r = simulate({ Speed: 120, VLA: 16.3, HLA: 0, TotalSpin: 7097, SpinAxis: 0 }, { rho, solidAt: wall });
  assert.ok(r.rockHits >= 1);
  assert.ok(r.pts.at(-1).p[2] > -100, 'ends short of the wall');
});
