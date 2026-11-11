// Checks the things that keep a real session alive, headlessly on one course:
//   the screen wake lock is asked for, a round is saved after each stroke and offered back after a reload,
//   and a live swing that arrives early is held and played (or refused with a message when far too early).
// node tools/review/session.mjs [course]   (about 2 minutes; writes out/session_<course>_resume_<w>.png)
import path from 'path';
import { openCourse, OUT } from './page.mjs';
const course = process.argv[2] || 'aerie';
const ok = (c, what) => { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) process.exitCode = 1; };
const init = () => { window.__wake = 0; try { Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => { window.__wake++; return { release: async () => {}, addEventListener() {} }; } } }); } catch (e) { /* fixed */ } };
const DRIVE = { Speed: 150, VLA: 12, HLA: 0, TotalSpin: 2800, SpinAxis: 0 };
const KEY = `vibegolf.course.${course}.round`;

const { browser, page: pg, errs } = await openCourse(course, { keep: true, start: false, init });
await pg.evaluate(() => { localStorage.clear(); });
await pg.reload(); await pg.waitForTimeout(2500);
ok(await pg.evaluate(() => document.querySelector('#suResume').hidden), 'no Resume button before a round exists');
await pg.evaluate(() => document.querySelector('#suGo').click()); await pg.waitForTimeout(600);
ok(await pg.evaluate(() => window.__wake) >= 1, 'the screen wake lock is requested');

// a live swing on the flyover ends it and plays
await pg.evaluate(s => window.Aerie.receiveShot(s), DRIVE);
ok(await pg.evaluate(() => __state.phase) === 'flight' && await pg.evaluate(() => __state.strokes) === 1, 'a swing during the flyover plays from the tee');
// a second swing while the ball is in the air is held...
await pg.evaluate(s => { __advance(1.5); window.Aerie.receiveShot(s); }, DRIVE);
ok(/Swing received/.test(await pg.evaluate(() => document.querySelector('#toast').textContent)), 'a swing during the flight is held, with a message');
// ...and since the ball takes far longer than 6 s to stop, it is refused, with a message, at the next lie
for (let i = 0; i < 40 && !['address', 'putt'].includes(await pg.evaluate(() => __state.phase)); i++) { await pg.evaluate(() => __advance(1.5)); await pg.waitForTimeout(350); }
await pg.waitForTimeout(700);
const st1 = await pg.evaluate(() => ({ phase: __state.phase, strokes: __state.strokes, hole: __state.holeIdx, ball: [__state.ball.x, __state.ball.y, __state.ball.z], lie: __state.lie }));
ok(['address', 'putt'].includes(st1.phase), `the first shot came to rest (${st1.lie}, lying ${st1.strokes})`);
ok(st1.strokes === 1 || /Swing not counted/.test(await pg.evaluate(() => document.querySelector('#toast').textContent)), 'the early swing was not played from a lie it was not meant for');
const saved = JSON.parse(await pg.evaluate(k => localStorage.getItem(k), KEY) || 'null');
ok(saved && saved.strokes === st1.strokes && saved.holeIdx === 0 && Math.abs(saved.ball[0] - st1.ball[0]) < 0.02, 'the round is saved after the stroke');

// a swing just before the game is ready: hold it, then let the next lie come
if (st1.phase === 'address') {
  await pg.evaluate(s => window.Aerie.receiveShot(s), { ...DRIVE, Speed: 120, VLA: 18, TotalSpin: 6500 });
  for (let i = 0; i < 40 && !['address', 'putt', 'holed'].includes(await pg.evaluate(() => (__state.phase === 'flight' || __state.phase === 'rest' ? 'x' : __state.phase))); i++) { await pg.evaluate(() => __advance(1.5)); await pg.waitForTimeout(250); }
}
const st2 = await pg.evaluate(() => ({ phase: __state.phase, strokes: __state.strokes, hole: __state.holeIdx, ball: [__state.ball.x, __state.ball.y, __state.ball.z], lie: __state.lie, scores: __state.scores.slice() }));

// reload: the round is offered back and picks up where it was
for (const [w, h] of [[844, 390], [667, 375]]) {
  await pg.setViewportSize({ width: w, height: h });
  await pg.reload(); await pg.waitForTimeout(2500);
  const label = await pg.evaluate(() => { const b = document.querySelector('#suResume'); return b.hidden ? null : b.textContent; });
  ok(!!label, `after a reload the setup screen offers: ${label}`);
  const fits = await pg.evaluate(() => { const r = document.querySelector('#suResume').getBoundingClientRect(), g = document.querySelector('#suGo').getBoundingClientRect(); return r.left >= 0 && g.right <= innerWidth && r.bottom <= innerHeight && g.bottom <= innerHeight; });
  ok(fits, `Resume and Tee off fit at ${w}x${h}`);
  await pg.screenshot({ path: path.join(OUT, `session_${course}_resume_${w}.png`) });
}
await pg.evaluate(() => document.querySelector('#suResume').click()); await pg.waitForTimeout(800);
const st3 = await pg.evaluate(() => ({ phase: __state.phase, strokes: __state.strokes, hole: __state.holeIdx, ball: [__state.ball.x, __state.ball.y, __state.ball.z], lie: __state.lie }));
ok(st3.hole === st2.hole && st3.strokes === st2.strokes && Math.hypot(st3.ball[0] - st2.ball[0], st3.ball[2] - st2.ball[2]) < 0.05 && st3.lie === st2.lie,
  `resumed on hole ${st3.hole + 1}, lying ${st3.strokes} in the ${st3.lie}, ball where it was (was hole ${st2.hole + 1}, lying ${st2.strokes}, ${st2.lie})`);
ok(['address', 'putt'].includes(st3.phase), `ready to play (${st3.phase})`);
await pg.evaluate(() => __advance(0.5));
await pg.screenshot({ path: path.join(OUT, `session_${course}_resumed.png`) });
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
await browser.close();
