// node tools/review/flyover.mjs <course ...|all> [--holes=1,2] [--write]
// Does the hole's intro flyover fly clear? Builds each hole in the game (headless), voxelises everything drawn round
// it (2 m voxels: ground, cliffs, walls, roofs, trees, buildings, props; not sky, mist, water sheets or glows) and
// flies the flyover through it from every tee set: "blocked" is the share of the path that comes within about
// 4–6 m of something drawn (through it, or skimming it), "hidden" the share of the flight whose look point on the
// ground is behind something. Where the default path doesn't fly clear (or hides the ground for over 30% of the
// flight) it plans one: candidates from the default's shape (mirrored, pulled in, higher, lower, over the line of
// play round a dogleg, the heights over the ground under it) and keeps the clear one nearest the default.
// --write puts the planned paths in src/course/flyovers.js (the game flies them; flyover.js has the format) and, when
// every hole was checked, stamps the course in its CHECKED (tests/flyover.test.mjs fails until a changed or new course
// has been checked again).
// Writes out/flyover-<course>.json (--rewrite rebuilds the table from it without the browser). Software WebGL: about 30 s to open a course, then 10–40 s a hole.
import fs from 'fs';
import path from 'path';
import { openCourse, goHole, loadCourse, MODULES, OUT, REPO } from './page.mjs';
import { courseStamp } from '../../src/course/flyover.js';

const args = process.argv.slice(2), opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
let courses = args.filter(a => !a.startsWith('--'));
if (!courses.length) { console.log('usage: flyover.mjs <course ...|all> [--holes=1,2] [--write]'); process.exit(1); }
if (courses[0] === 'all') courses = Object.keys(MODULES);
const FILE = path.join(REPO, 'src/course/flyovers.js');

const pct = v => `${Math.round(v * 100)}%`;
for (const course of courses) {
  const { HOLES, COURSE } = await loadCourse(course);
  const teeIds = COURSE.teeSets.map(t => t.id);
  const holes = opt.holes ? String(opt.holes).split(',').map(Number) : HOLES.map((_, i) => i + 1);
  // --rewrite: the table again from the last run's json, no browser
  const out = opt.rewrite ? JSON.parse(fs.readFileSync(path.join(OUT, `flyover-${course}.json`), 'utf8')) : await measure(course, HOLES, COURSE, teeIds, holes);
  if (!opt.rewrite) fs.writeFileSync(path.join(OUT, `flyover-${course}.json`), JSON.stringify(out));
  if (opt.write || opt.rewrite) {
    const { FLYOVERS, CHECKED = {} } = await import(FILE + '?t=' + Date.now());
    const T = { ...FLYOVERS }; T[COURSE.id] = { ...(T[COURSE.id] || {}) };
    const C = { ...CHECKED };
    // every hole checked: stamp the course as it is now
    if (HOLES.every((_, i) => out.holes[i + 1])) C[COURSE.id] = courseStamp(fs.readFileSync(path.join(REPO, 'src/course', `${MODULES[course]}.js`), 'utf8'));
    for (const n of holes) {
      const h = HOLES[n - 1], r = out.holes[n], e = {};
      if (!r) continue;
      for (const id of teeIds) {
        const p = r.tees[id]?.plan; if (!p || (p.dev < 2 && !r.tees[id].def.blocked) || p.judge.blocked > r.tees[id].def.blocked) continue; // never worse than the default, nor the same as one that flies clear
        e[id] = { tee: h.tees[id], green: [h.green.x, h.green.z], pts: p.pts, looks: p.looks, dur: +p.dur.toFixed(2) };
      }
      if (Object.keys(e).length) T[COURSE.id][n - 1] = e; else delete T[COURSE.id][n - 1];
    }
    if (!Object.keys(T[COURSE.id]).length) delete T[COURSE.id];
    writeTable(T, C);
    console.log(`${COURSE.name}: ${Object.keys(T[COURSE.id] || {}).length} holes with a planned flyover in src/course/flyovers.js`);
  }
}

async function measure(course, HOLES, COURSE, teeIds, holes) {
  const { browser, page: pg, errs } = await openCourse(course, { clean: true });
  await pg.evaluate(async () => { window.__fly = await import('/tools/review/flyover-page.js'); });
  const mod = MODULES[course], out = { course, holes: {} };
  console.log(`\n${COURSE.name}`);
  for (const n of holes) {
    await goHole(pg, n);
    const r = await pg.evaluate(async ({ n, mod, teeIds }) => {
      const M = await import(`/src/course/${mod}.js`);
      return __fly.runHole(M.HOLES[n - 1], teeIds);
    }, { n, mod, teeIds });
    out.holes[n] = r;
    const line = teeIds.map(id => {
      const t = r.tees[id]; if (!t) return `${id} —`;
      const d = t.def, p = t.plan;
      const what = d.hits?.length ? ' ' + d.hits.map(x => `${x.mat.replace('Material', '')}${x.inst ? '×' + x.inst : ''}#${x.col}`).join(',') : '';
      return `${id}: ${d.blocked ? `blocked ${pct(d.frac)} at ${d.span}, nearest ${d.minD.toFixed(1)} m${what}` : `clear (${d.minD.toFixed(1)} m)`}, hidden ${pct(d.los)}` +
        (p ? ` → plan ${p.judge.blocked ? `STILL blocked ${pct(p.judge.frac)}` : `clear (${p.judge.minD.toFixed(1)} m)`}, hidden ${pct(p.judge.los)}, steep ${pct(p.judge.steep)}, ${p.o.route}${p.o.mids === 2 ? '×2' : ''} side ${p.o.side} h ${p.o.h} ${p.o.y} back ${p.o.b0}/${p.o.b2}, ${p.dev} m off` : '');
    });
    console.log(`  ${n} ${HOLES[n - 1].name} (${r.tris} tris, voxels ${r.dims.join('×')} in ${r.voxMs} ms)\n    ` + line.join('\n    '));
  }
  if (errs.length) console.log('errors', errs.slice(0, 5));
  await browser.close();
  return out;
}

function writeTable(T, C) {
  const j = v => JSON.stringify(v);
  let s = `// Planned intro flyovers (generated by tools/review/flyover.mjs --write; don't hand-edit). For holes where the default\n` +
    `// path in flyover.js flew through something drawn: course id -> hole index -> tee set id -> the tee and green it was\n` +
    `// planned for, the camera's control points, where it looks, and how long it flies.\nexport const FLYOVERS = {\n`;
  for (const c of Object.keys(T).sort()) {
    s += `  ${c}: {\n`;
    for (const k of Object.keys(T[c]).map(Number).sort((a, b) => a - b)) {
      s += `    ${k}: {\n`;
      for (const id of Object.keys(T[c][k])) { const e = T[c][k][id]; s += `      ${id}: { tee: ${j(e.tee)}, green: ${j(e.green)}, pts: ${j(e.pts)}, looks: ${j(e.looks)}, dur: ${e.dur} },\n`; }
      s += `    },\n`;
    }
    s += `  },\n`;
  }
  s += '};\n\n// each course as it was when every hole\'s flyover was last checked (courseStamp of its module)\nexport const CHECKED = {\n';
  for (const c of Object.keys(C).sort()) s += `  ${c}: '${C[c]}',\n`;
  fs.writeFileSync(FILE, s + '};\n');
}
