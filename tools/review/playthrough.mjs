// node tools/review/playthrough.mjs <course> [holes...]
// Plays each hole at phone size with the simulated shot on auto-aim (the default tees), up to 9 strokes,
// and prints the lie after every stroke. A hole that never finishes, or the same lie over and over, is a
// layout bug (Hollowmere's 4th aimed through a rock nose; Red Mesa's 9th hits its tier wall).
// About 3-8 minutes a hole with software rendering: run it in the background.
import { openCourse, loadCourse } from './page.mjs';
const [course = 'aerie', ...rest] = process.argv.slice(2);
const { HOLES } = await loadCourse(course);
const holes = rest.length ? rest.map(Number) : HOLES.map((_, i) => i + 1);
const { browser, page: pg, errs } = await openCourse(course);
for (const n of holes) {
  await pg.evaluate(i => { __startHole(i); document.getElementById('skip')?.click(); }, n - 1);
  await pg.evaluate(() => __advance(0.6)); await pg.waitForTimeout(300);
  const log = [];
  for (let k = 0; k < 9; k++) {
    if (await pg.evaluate(() => __state.phase) === 'holed') break;
    await pg.keyboard.press('Space'); await pg.evaluate(() => __advance(14, 6)); await pg.waitForTimeout(900);
    await pg.evaluate(() => __advance(3, 6)); await pg.waitForTimeout(500);
    const st = await pg.evaluate(() => ({ ph: __state.phase, lie: __state.lie, s: __state.strokes, toast: (document.getElementById('toast')?.textContent || '').slice(0, 40) }));
    console.log(`  ${HOLES[n - 1].name} stroke ${st.s}: ${st.lie}${st.toast ? ' (' + st.toast + ')' : ''}`);
    log.push(`${st.s}:${st.lie}`);
    if (st.ph === 'holed') break;
  }
  const fin = await pg.evaluate(() => ({ ph: __state.phase, s: __state.strokes }));
  console.log(`hole ${n} ${HOLES[n - 1].name} par ${HOLES[n - 1].par}: ${fin.ph === 'holed' ? 'holed in ' + fin.s : 'NOT FINISHED after ' + fin.s} | ${log.join(' ')}`);
}
console.log('errors', JSON.stringify(errs.slice(0, 8)));
await browser.close();
