// Coaching range rules: windows from the flight model, condition detection, priority,
// confidence, the focus loop, and the fault presets that let it be tested without an R10.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoach, evaluate, pick, shotMetrics, isGoodShot, rankCauses, progressOf, carryOf, RULES, DIST, READ_WINDOW, FOCUS_SHOTS } from '../src/coach/coach-logic.js';
import { windowsFor, CLUB_REF, tourClubSpeed } from '../src/coach/windows.js';
import { CONDITIONS } from '../src/coach/conditions.js';
import { FAULTS, applyFault } from '../src/coach/faults.js';

const base = id => { const r = CLUB_REF[id]; return { Speed: r.speed, VLA: r.vla, HLA: 0, TotalSpin: r.spin, SpinAxis: 0, Club: { Speed: r.speed / r.smash, Path: 0, FaceToTarget: 0, AngleOfAttack: r.aoa } }; };
const alt = () => { let k = 0; return () => (k++ % 2 ? 0.9 : 0.1); };   // twoWay alternates sides
const readAfter = (shots, club) => { const c = createCoach(); let rd = null; for (const s of shots) for (const e of c.addShot(s, club)) if (e.type === 'read') rd = rd || e; return { c, rd }; };
const faulted = (id, club = '7i', n = READ_WINDOW) => { const r = alt(); return Array.from({ length: n }, () => applyFault(base(club), id, club, r)); };

/* ---------- windows ---------- */
test('the tour player gets exactly the tour numbers', () => {
  for (const id of Object.keys(CLUB_REF)) {
    const w = windowsFor(id, tourClubSpeed(id)), r = CLUB_REF[id];
    assert.ok(Math.abs(w.launchC - r.vla) < 0.05 && Math.abs(w.spinC - r.spin) < 1, id);
    assert.ok(isGoodShot(shotMetrics(base(id), id), w), `${id} tour average is a good shot`);
  }
});
test('windows scale to the player: the LPGA averages fall out', () => {
  const i7 = windowsFor('7i', 76), dr = windowsFor('DR', 94);
  assert.ok(Math.abs(i7.launchC - 19) < 1.5 && Math.abs(i7.spinC - 6699) / 6699 < 0.05, `7i ${i7.launchC.toFixed(1)} ${Math.round(i7.spinC)}`);
  assert.ok(Math.abs(dr.launchC - 13.2) < 1 && Math.abs(dr.spinC - 2611) / 2611 < 0.05, `DR ${dr.launchC.toFixed(1)} ${Math.round(dr.spinC)}`);
  // slower swings: more launch, a little less spin; direction windows don't move
  const fast = windowsFor('9i', tourClubSpeed('9i')), slow = windowsFor('9i', tourClubSpeed('9i') * 0.75);
  assert.ok(slow.launchC > fast.launchC + 2 && slow.spinC < fast.spinC);
  assert.deepEqual(slow.aoa, fast.aoa);
});

/* ---------- metrics ---------- */
test('club data is used when it comes; otherwise the ball is read backwards', () => {
  const m = shotMetrics({ ...base('7i'), Club: { Speed: 90, Path: -4, FaceToTarget: 1, AngleOfAttack: -5 } }, '7i');
  assert.equal(m.path, -4); assert.equal(m.ftp, 5); assert.ok(m.hasClub);
  const b = shotMetrics({ Speed: 120, VLA: 16, HLA: -2, TotalSpin: 7000, SpinAxis: 9 }, '7i');
  assert.ok(!b.hasClub && b.ftp > 4 && b.path < b.face, 'a pull-slice reads as out-to-in with an open face');
  assert.ok(Math.abs(b.clubSpeed - 120 / 1.33) < 0.01);
});

/* ---------- every condition ---------- */
const PRESET_FOR = { flip: 'flip', overTheTop: 'overTheTop', openFace: 'openFace', closedFace: 'closedFace', stuck: 'stuck', steep: 'steep', fat: 'fat', thin: 'thin', twoWay: 'twoWay', aimedOff: 'aimedOff' };
test('each fault preset raises its own condition, and only that one', () => {
  for (const club of ['7i', 'PW']) for (const [fault, cond] of Object.entries(PRESET_FOR)) {
    const { rd } = readAfter(faulted(fault, club), club);
    assert.ok(rd, `${club} ${fault}: no read`);
    assert.equal(rd.id, cond, `${club} ${fault} read as ${rd.id}`);
  }
  for (const fault of ['flip', 'overTheTop', 'openFace', 'closedFace', 'stuck', 'steep', 'fat', 'thin', 'twoWay', 'aimedOff']) {
    // with the driver a steep attack is its own condition, hitting down
    const { rd } = readAfter(faulted(fault, 'DR'), 'DR'), want = fault === 'steep' ? 'driverDown' : fault;
    assert.equal(rd && rd.id, want, `driver ${fault}`);
  }
});
test('the conditions without a preset are detected from their signatures', () => {
  const w7 = windowsFor('7i', tourClubSpeed('7i')), wD = windowsFor('DR', tourClubSpeed('DR'));
  const m = (o, club = '7i') => ({ ...shotMetrics(base(club), club), ...o });
  const four = o => [0, 1, 2, 3].map(() => o);
  assert.equal(pick(evaluate(four(m({ aoa: -4, spin: 3400 }, 'DR')), wD)).id, 'driverDown');
  assert.equal(pick(evaluate(four(m({ smash: 1.24 })), w7)).id, 'offCentre');
  // a topped ball reads as thin (one read for both)
  assert.equal(pick(evaluate(four(m({ launch: 2, spin: 1500, smash: 1.1 })), w7)).id, 'thin');
  // a shank is raised on the first one
  const c = createCoach(), ev = c.addShot({ ...base('7i'), HLA: 14, Speed: 70 }, '7i');
  assert.ok(ev.some(e => e.type === 'shank'));
});
test('fatigue: club speed fading and strike worsening over a long block', () => {
  const c = createCoach(); let tired = false;
  for (let i = 0; i < 20; i++) {
    const f = i < 12 ? 1 : 0.9, s = base('7i'); s.Club.Speed *= f; s.Speed *= f * (i < 12 ? 1 : 0.95);
    for (const e of c.addShot(s, '7i')) if (e.type === 'fatigue') tired = true;
    if (c.phase === 'read') c.dismiss();
  }
  assert.ok(tired);
});
test('every condition has a rule, a cue, evidence and causes with drills', () => {
  for (const [id, C] of Object.entries(CONDITIONS)) {
    assert.ok(RULES[id] || ['twoWay', 'distance', 'fatigue'].includes(id), `${id} has a rule`);
    assert.ok(C.headline && C.cue && C.evidence.length && C.causes.length, id);
    assert.ok(C.causes.filter(k => !k.strong).length <= 3, `${id}: at most 3 causes besides ball position`);
    assert.ok(rankCauses(id, [], windowsFor('7i', tourClubSpeed('7i'))).length <= 3, `${id}: at most 3 on the readout`);
    for (const k of C.causes) assert.ok(k.title && k.check && k.drill && k.drill.steps.length, `${id}.${k.id}`);
  }
});

/* ---------- the window rule, priority, confidence ---------- */
test('4 shots before speaking; 3 of 4 must agree and none miss the other way', () => {
  const ott = faulted('overTheTop'), ok = base('7i');
  assert.equal(readAfter(ott.slice(0, 3), '7i').rd, null, 'not after 3');
  assert.equal(readAfter([ott[0], ott[1], ok, ok], '7i').rd, null, '2 of 4 is not a pattern');
  assert.equal(readAfter([ott[0], ott[1], ott[2], ok], '7i').rd.id, 'overTheTop', '3 of 4 is');
  const opp = readAfter([ott[0], ott[1], ott[2], faulted('stuck')[0]], '7i').rd;
  assert.ok(!opp || opp.id !== 'overTheTop', 'the opposite miss blocks it (three pulls and a big push read as two-way instead)');
});
test('one fault at a time: the root cause wins', () => {
  // over the top comes with an open face and a steep attack: it explains both
  const w = windowsFor('7i', tourClubSpeed('7i')), m = shotMetrics(base('7i'), '7i');
  const four = o => [0, 1, 2, 3].map(() => ({ ...m, ...o }));
  // (the ball agrees: it starts left and slices)
  assert.equal(pick(evaluate(four({ path: -6, ftp: 4.5, aoa: -9, spin: 8000, dir: -2, axis: 8 }), w)).id, 'overTheTop');
  // a flip leaves the face open: the flip is the one to fix
  assert.equal(pick(evaluate(four({ spinLoft: w.spinLoft + 6, smash: 1.26, ftp: 3.5 }), w)).id, 'flip');
});
test('ball position is a cause, ranked first when the attack and path point at it', () => {
  // ball back: steep and swinging right, so it starts right
  const back = readAfter(faulted('ballBack'), '7i').rd;
  assert.ok(['aimedOff', 'stuck', 'steep'].includes(back.id), back.id);
  assert.match(back.causes[0].id, /Ball$/, `ball back: ${back.causes[0].id} first`);
  // ball forward: shallow and swinging left
  const w7 = windowsFor('7i', tourClubSpeed('7i')), m = shotMetrics(base('7i'), '7i'), four = o => [0, 1, 2, 3].map(() => ({ ...m, ...o }));
  assert.equal(rankCauses('flip', four({ aoa: -1.5, path: -3 }), w7)[0].id, 'flipBall');
  assert.equal(rankCauses('thin', four({ aoa: -1.5, path: -3 }), w7)[0].id, 'thinBall');
  // with a normal attack it isn't the likely cause
  assert.notEqual(rankCauses('thin', four({}), w7)[0].id, 'thinBall');
});
test('distance spread: the carry changes too much shot to shot', () => {
  const w = windowsFor('7i', tourClubSpeed('7i')), m = shotMetrics(base('7i'), '7i');
  const at = (k, club = '7i') => { const b = base(club); b.Speed *= k; return b; };
  // four shots between 92% and 100% ball speed: about 17 yards shortest to longest
  const spread = [1, 0.92, 0.97, 0.94].map(k => at(k));
  const { rd } = readAfter(spread, '7i');
  assert.equal(rd && rd.id, 'distance');
  assert.equal(rd.causes[0].id, 'distStrike', 'the strike moved (smash changed), so it comes first');
  const gap = rd.evidence.find(e => e.key === 'carryGap').value;
  assert.ok(gap > 12 && gap < 22, `gap ${gap.toFixed(1)} yd`);
  // a steady swing doesn't, nor does the sand wedge (hit at all lengths)
  assert.equal(readAfter([1, 0.99, 1, 0.995].map(k => at(k)), '7i').rd, null);
  assert.ok(!evaluate([1, 0.92, 0.97, 0.94].map(k => shotMetrics(at(k, 'SW'), 'SW')), windowsFor('SW', tourClubSpeed('SW'))).some(f => f.id === 'distance'));
  // changing swing length on purpose (club speed swinging 10%) isn't a spread to coach
  const lengths = [1, 0.85, 0.95, 0.8].map(k => { const b = base('7i'); b.Speed *= k; b.Club.Speed *= k; return b; });
  assert.ok(!evaluate(lengths.map(s => shotMetrics(s, '7i')), w).some(f => f.id === 'distance'));
  // the carry estimate follows the flight model near the window's centre
  assert.ok(Math.abs(carryOf(m, w) - w.carry.c) < 3 && DIST.sd > 0);
});
test('confidence is medium when the ball data alone shows it', () => {
  const noClub = faulted('overTheTop').map(s => { const { Club, ...b } = s; return b; });
  const { rd } = readAfter(noClub, '7i');
  assert.equal(rd.id, 'overTheTop'); assert.equal(rd.confidence, 'medium');
  assert.equal(readAfter(faulted('overTheTop'), '7i').rd.confidence, 'high');
});
test('causes: the one the data supports is the coach\'s pick', () => {
  const w = windowsFor('7i', tourClubSpeed('7i')), m = shotMetrics(base('7i'), '7i');
  const steepOtt = [0, 1, 2, 3].map(() => ({ ...m, path: -5, aoa: -7 }));
  assert.equal(rankCauses('overTheTop', steepOtt, w)[0].id, 'ottShoulders');
  const mixed = [{ ...m, path: -5, smash: 1.2 }, { ...m, path: -5, smash: 1.33 }, { ...m, path: -5, smash: 1.21 }, { ...m, path: -5, smash: 1.33 }];
  const r = rankCauses('overTheTop', mixed, w);
  assert.equal(r[0].id, 'ottWeight'); assert.ok(r[0].likely && !r[1].likely);
});

/* ---------- the focus loop ---------- */
test('accept a cue, 8 shots, then a progress check', () => {
  const c = createCoach(); for (const s of faulted('flip')) c.addShot(s, '7i');
  assert.equal(c.phase, 'read');
  c.accept('flipCast'); assert.equal(c.phase, 'focus');
  let pr = null, ticks = 0;
  // half-fixed flips: spin loft comes down part of the way
  const half = () => { const s = applyFault(base('7i'), 'flip', '7i'); s.VLA -= 2.4; s.TotalSpin -= 600; s.Club.AngleOfAttack -= 0.8; return s; };
  for (let i = 0; i < FOCUS_SHOTS; i++) for (const e of c.addShot(half(), '7i')) { if (e.type === 'tick') ticks++; if (e.type === 'progress') pr = e; }
  assert.equal(ticks, FOCUS_SHOTS); assert.ok(pr, 'progress after 8');
  assert.ok(pr.progress > 0.3 && pr.progress < 0.9 && !pr.stalled, `progress ${pr.progress.toFixed(2)}`);
  assert.equal(c.phase, 'review');
});
test('three good shots in a row on the cue finishes early', () => {
  const c = createCoach(); for (const s of faulted('flip')) c.addShot(s, '7i');
  c.accept(); let pr = null;
  for (let i = 0; i < 3; i++) for (const e of c.addShot(base('7i'), '7i')) if (e.type === 'progress') pr = e;
  assert.ok(pr && pr.done && pr.shots === 3);
});
test('a stalled cue suggests the next cause, then a drill', () => {
  const c = createCoach(); for (const s of faulted('overTheTop')) c.addShot(s, '7i');
  const first = c.read.causes[0].id; c.accept(first);
  let pr = null; for (let i = 0; i < FOCUS_SHOTS; i++) for (const e of c.addShot(faulted('overTheTop', '7i', 1)[0], '7i')) if (e.type === 'progress') pr = e;
  assert.ok(pr.stalled && pr.nextCause && pr.nextCause.id !== first && pr.offerDrill);
  c.nextCause(); assert.equal(c.phase, 'focus'); assert.notEqual(c.focus.cause.id, first);
});
test('no nagging: a dismissed condition stays quiet for 10 shots unless it gets worse', () => {
  const c = createCoach(); for (const s of faulted('openFace')) c.addShot(s, '7i');
  c.dismiss(); let again = false;
  for (const s of faulted('openFace', '7i', 6)) for (const e of c.addShot(s, '7i')) if (e.type === 'read') again = true;
  assert.ok(!again, 'quiet');
  const c2 = createCoach(); for (const s of faulted('openFace')) c2.addShot(s, '7i');
  c2.accept(); c2.finish();
  const worse = () => { const s = applyFault(base('7i'), 'openFace', '7i'); s.Club.FaceToTarget += 4; s.SpinAxis += 7.6; s.HLA += 3.2; return s; };
  let raised = false; for (let i = 0; i < 4; i++) for (const e of c2.addShot(worse(), '7i')) if (e.type === 'read') raised = true;
  assert.ok(raised, 'worse than last time breaks the quiet');
});
test('switching clubs starts a new window; history carries over', () => {
  const c = createCoach(); const ott = faulted('overTheTop');
  c.addShot(ott[0], '7i'); c.addShot(ott[1], '7i'); c.addShot(faulted('overTheTop', 'PW', 1)[0], 'PW'); c.addShot(ott[2], '7i');
  assert.equal(c.phase, 'watch', 'only 3 seven-iron shots');
  for (const e of c.addShot(ott[3], '7i')) assert.notEqual(e.type, 'shank');
  assert.equal(c.phase, 'read'); c.accept();
  const h = c.serialize();
  assert.ok(h.clubs['7i'].overTheTop.cause);
  const c2 = createCoach({ history: h }); assert.deepEqual(c2.serialize(), h);
});
test('progress runs 0 (where you started) to 1 (in the window)', () => {
  const w = windowsFor('7i', tourClubSpeed('7i')), m = shotMetrics(base('7i'), '7i');
  const at = p => [0, 1, 2, 3].map(() => ({ ...m, path: p }));
  assert.equal(progressOf('overTheTop', at(-7), at(-7), w).progress, 0);
  assert.ok(Math.abs(progressOf('overTheTop', at(-7), at(-4), w).progress - 0.5) < 1e-9);
  assert.equal(progressOf('overTheTop', at(-7), at(0), w).progress, 1);
});

/* ---------- presets against a decent amateur's misses ---------- */
test('with natural swing noise, each preset is still read correctly most of the time', () => {
  let seed = 11; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const noisy = id => { const r = CLUB_REF[id], face = g() * 1.9, path = g() * 2.4;
    const s = { Speed: r.speed * (1 + g() * 0.012), VLA: r.vla + g() * 0.9, HLA: face * 0.8 + path * 0.2, TotalSpin: r.spin * (1 + g() * 0.07), SpinAxis: (face - path) * 1.9 + g() * 1.5 };
    s.Club = { Speed: r.speed / r.smash * (1 + g() * 0.01), Path: path, FaceToTarget: face, AngleOfAttack: r.aoa + g() * 1.1 }; return s; };
  const rate = fault => { let hit = 0, any = 0; const T = 120;
    for (let t = 0; t < T; t++) { const c = createCoach(); let got = null;
      for (let i = 0; i < 8 && !got; i++) for (const e of c.addShot(applyFault(noisy('7i'), fault, '7i', R), '7i')) if (e.type === 'read') got = e.id;
      if (got) any++; if (got === (PRESET_FOR[fault] || null)) hit++; }
    return { hit: hit / T, any: any / T }; };
  // a two-way miss that goes the same way three times in four reads as that miss (pull, push, aimed off)
  for (const f of Object.keys(PRESET_FOR)) { const r = rate(f); assert.ok(r.hit >= (f === 'twoWay' ? 0.6 : 0.7), `${f} read correctly ${(r.hit * 100).toFixed(0)}%`); }
  assert.ok(rate('none').any <= 0.2, 'a clean swing is rarely flagged');
});
test('fault presets are listed and leave the shot alone on None', () => {
  assert.equal(FAULTS[0].id, 'none');
  const s = base('7i'); assert.equal(applyFault(s, 'none', '7i'), s);
});
