// How well the coach reads each fault, with an amateur's swing and an R10's measurement error.
//
//   node tools/coach/sim-check.mjs [--trials=300] [--shots=8] [--mode=r10|ideal|ballOnly|all]
//                                  [--speed=0.87] [--scale=1] [--clubs=7i,PW,DR] [--json]
//
// Each trial is a fresh coach and up to --shots swings with the fault; the first read counts.
// Prints, per fault and club: read right, read as something else (and what), no read. "clean"
// is a normal swing, where any read is a false alarm.

import { createCoach } from '../../src/coach/coach-logic.js';
import { rngOf, swingWith } from './model.mjs';

// the read each fault should give (any of a list). Ball position has no read of its own: it
// should show as the first cause of the read it causes (CAUSE).
export const EXPECT = {
  clean: null, flip: 'flip', overTheTop: 'overTheTop', openFace: 'openFace', closedFace: 'closedFace', stuck: 'stuck',
  steep: 'steep', fat: 'fat', thin: 'thin', twoWay: 'twoWay', aimedOff: 'aimedOff', ballBack: ['stuck', 'steep', 'aimedOff'],
  ballForward: ['overTheTop', 'flip', 'thin', 'fat', 'aimedOff', 'offCentre'], offCentre: 'offCentre', top: 'thin', driverDown: 'driverDown',
  distance: 'distance', shank: 'shank',
};
export const CAUSE = { ballBack: ['stuckBall', 'steepBall', 'aimBall'], ballForward: ['ottBall', 'flipBall', 'thinBall', 'fatBall', 'aimBall', 'offBall'] };
const ok = (want, id) => (Array.isArray(want) ? want.includes(id) : want === id);
// faults that only make sense with some clubs
const ONLY = { driverDown: ['DR'], distance: ['5i', '7i', '9i', 'PW', 'DR', '3W', 'HY'], ballBack: ['5i', '7i', '9i', 'PW', 'SW', '3W', 'HY'], ballForward: ['5i', '7i', '9i', 'PW', 'SW'], fat: ['5i', '7i', '9i', 'PW', 'SW'], offCentre: ['5i', '7i', '9i', 'PW', 'SW'], flip: ['5i', '7i', '9i', 'PW', 'SW'], steep: ['5i', '7i', '9i', 'PW', 'SW'] };

export function readRate(fault, club, { trials = 300, shots = 8, mode = 'r10', speed = 0.87, scale = 1, seed = 11 } = {}) {
  const rng = rngOf(seed + club.charCodeAt(0) * 131 + fault.length * 977 + Math.round(scale * 100));
  const got = {};
  for (let t = 0; t < trials; t++) {
    const c = createCoach(); let first = 'none', cause = null;
    for (let i = 0; i < shots && first === 'none'; i++)
      for (const e of c.addShot(swingWith(fault === 'clean' ? 'none' : fault, club, { speed, scale, mode, rng }), club)) {
        if (e.type === 'read') { first = e.id; cause = e.causes[0].id; } else if (e.type === 'shank') first = 'shank';
        if (first !== 'none') break;
      }
    // a read with the wrong first cause counts as read as something else
    if (CAUSE[fault] && ok(EXPECT[fault], first) && !CAUSE[fault].includes(cause)) first = `${first} (${cause})`;
    got[first] = (got[first] || 0) + 1;
  }
  const want = EXPECT[fault], n = trials;
  const hit = want ? Object.entries(got).filter(([k]) => ok(want, k)).reduce((s, [, v]) => s + v, 0) / n : (got.none || 0) / n;
  const wrong = Object.entries(got).filter(([k]) => k !== 'none' && !ok(want, k)).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / n]);
  return { fault, club, hit, none: want ? (got.none || 0) / n : 0, wrong, got };
}

export function sweep({ clubs = ['7i', 'PW', 'DR'], faults = Object.keys(EXPECT), ...o } = {}) {
  const rows = [];
  for (const f of faults) for (const club of clubs) { if (ONLY[f] && !ONLY[f].includes(club)) continue; rows.push(readRate(f, club, o)); }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
  const modes = (arg('mode') || 'r10') === 'all' ? ['ideal', 'r10', 'ballOnly'] : [arg('mode') || 'r10'];
  const o = { trials: +(arg('trials') || 300), shots: +(arg('shots') || 8), speed: +(arg('speed') || 0.87), scale: +(arg('scale') || 1), clubs: (arg('clubs') || '7i,PW,DR').split(',') };
  const pct = v => `${Math.round(v * 100)}%`.padStart(4);
  for (const mode of modes) {
    const rows = sweep({ ...o, mode });
    if (process.argv.includes('--json')) { console.log(JSON.stringify({ mode, rows })); continue; }
    console.log(`\n${mode} · club speed ${Math.round(o.speed * 100)}% of tour · fault size ×${o.scale} · ${o.trials} trials of ${o.shots} shots`);
    console.log('fault        club  right  none  read as instead');
    for (const r of rows) console.log(`${r.fault.padEnd(12)} ${r.club.padEnd(4)} ${pct(r.hit)}  ${pct(r.none)}  ${r.wrong.slice(0, 3).map(([k, v]) => `${k} ${pct(v).trim()}`).join(', ')}`);
    const f = rows.filter(r => r.fault !== 'clean'), clean = rows.filter(r => r.fault === 'clean');
    console.log(`mean right ${pct(f.reduce((s, r) => s + r.hit, 0) / f.length)} · worst ${f.slice().sort((a, b) => a.hit - b.hit).slice(0, 3).map(r => `${r.fault}/${r.club} ${pct(r.hit).trim()}`).join(', ')} · clean swings flagged ${clean.map(r => `${r.club} ${pct(1 - r.hit).trim()}`).join(', ')}`);
  }
}
