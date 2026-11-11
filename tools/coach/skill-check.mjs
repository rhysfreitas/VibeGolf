// Learn a skill against an amateur's swing measured by an R10: how often the swing the skill
// teaches gets "learned" (3 of 4 in the goal) within --shots, and how often a normal swing
// passes for it by mistake.
//
//   node tools/coach/skill-check.mjs [--trials=200] [--shots=12] [--mode=r10|ideal|all]

import { createSkillCoach, skillMetrics } from '../../src/coach/skills.js';
import { rngOf, swingWith } from './model.mjs';

// skill, option, club, the shot tool's attempt preset for it, and for skills measured against a
// faulty stock swing: { stock: that fault, scale: the attempt's share of it }
export const CASES = [
  ['straight', 'slice', '7i', 'overTheTop', { stock: 'overTheTop', scale: 0.35 }], ['straight', 'slice', 'DR', 'overTheTop', { stock: 'overTheTop', scale: 0.35 }],
  ['straight', 'hook', '7i', 'stuck', { stock: 'stuck', scale: 0.35 }],
  ['shape', 'draw', '7i', 'draw'], ['shape', 'fade', '7i', 'fade'], ['shape', 'draw', 'DR', 'draw'], ['shape', 'fade', 'DR', 'fade'],
  ['compress', null, '7i', 'compress'], ['driverUp', null, 'DR', 'hitUp'],
  ['flight', 'low', '7i', 'low'], ['flight', 'high', '7i', 'high'], ['speed', null, 'DR', 'faster'],
];

export function learnRate(skill, option, club, attempt, { trials = 200, shots = 12, mode = 'r10', speed = 0.87, seed = 5, stock = 'none', scale = 1 } = {}) {
  const rng = rngOf(seed + skill.length * 101 + (option || '').length * 37 + club.charCodeAt(0));
  let learned = 0, falsePass = 0, firstBlock = {};
  for (let t = 0; t < trials; t++) {
    for (const [fault, isAttempt, k] of [[attempt, true, scale], [stock, false, 1]]) {
      const stockMs = Array.from({ length: 4 }, () => ({ ...skillMetrics(swingWith(stock, club, { speed, mode, rng }), club), club }));
      const c = createSkillCoach({ skill, option, club, stockMs });
      let got = false, blk = null;
      for (let i = 0; i < shots && !got; i++) for (const e of c.addShot(swingWith(fault, club, { speed, scale: k, mode, rng }), club)) {
        if (e.type === 'learned') got = true;
        if (e.type === 'read' && !blk && e.blocker) blk = e.blocker.id;
      }
      if (isAttempt) { if (got) learned++; else if (blk) firstBlock[blk] = (firstBlock[blk] || 0) + 1; } else if (got) falsePass++;
    }
  }
  return { skill: option ? `${skill}.${option}` : skill, club, learned: learned / trials, falsePass: falsePass / trials,
    blockers: Object.entries(firstBlock).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / trials]) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : null; };
  const modes = (arg('mode') || 'r10') === 'all' ? ['ideal', 'r10'] : [arg('mode') || 'r10'];
  const pct = v => `${Math.round(v * 100)}%`.padStart(4);
  for (const mode of modes) {
    console.log(`\n${mode} · ${arg('trials') || 200} trials · learned within ${arg('shots') || 12} shots`);
    console.log('skill           club  learned  normal swing passes  stopped by');
    for (const [s, o, club, a, x] of CASES) {
      const r = learnRate(s, o, club, a, { trials: +(arg('trials') || 200), shots: +(arg('shots') || 12), mode, ...x });
      console.log(`${r.skill.padEnd(15)} ${club.padEnd(4)}  ${pct(r.learned)}     ${pct(r.falsePass)}            ${r.blockers.slice(0, 2).map(([k, v]) => `${k} ${pct(v).trim()}`).join(', ')}`);
    }
  }
}
