// node tools/review/perf.mjs <course> [holes...] [--vs=<git ref>] [--top=5]
// What a hole costs to draw, from its back tee: meshes (about the draw calls), triangles (instances
// counted), and the time of a real frame (each render waited on with readPixels) at phone size,
// 844x390. Software WebGL, so the times only compare with each other on this machine; a phone has a
// GPU and other limits. --vs=<ref> (a commit, a tag, HEAD~1) builds that version in a temporary git
// worktree and measures it the same way, then prints both, so an art pass shows what it added.
// --top lists the heaviest meshes on each hole. Default holes: 1, the middle one and the last.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createTerrain } from '../../src/course/terrain.js';
import { REPO, OUT, loadCourse, viewPoses } from './page.mjs';
const argv = process.argv.slice(2), course = argv.find(a => !a.startsWith('--')) || 'aerie';
const vs = (argv.find(a => a.startsWith('--vs=')) || '').slice(5), top = +((argv.find(a => a.startsWith('--top=')) || '--top=5').slice(6));
const { HOLES, COURSE } = await loadCourse(course);
let holes = argv.filter(a => !a.startsWith('--')).slice(1).map(Number);
if (!holes.length) holes = [...new Set([1, Math.ceil(HOLES.length / 2), HOLES.length])];

async function measure(root) {
  const { openCourse } = await import(path.join(root, 'tools/review/page.mjs'));
  const { browser, page: pg } = await openCourse(course, { width: 844, height: 390, clean: true });
  const out = [];
  for (const n of holes) {
    const h = HOLES[n - 1], P = viewPoses(h, createTerrain(h), COURSE).tee;
    await pg.evaluate(i => { __startHole(i); document.getElementById('skip')?.click(); window.__pose = null; }, n - 1);
    await pg.evaluate(() => __advance(0.8));
    await pg.evaluate(q => { window.__pose = q; __advance(0.3); }, P);
    const r = await pg.evaluate(({ top }) => {
      const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      const gl = cv.getContext('webgl2') || cv.getContext('webgl'), px = new Uint8Array(4), frame = () => { __advance(1 / 60, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      frame(); frame();
      const t0 = performance.now(); for (let i = 0; i < 6; i++) frame(); const ms = (performance.now() - t0) / 6;
      let meshes = 0, tris = 0; const list = [];
      __scene.traverseVisible(o => { if (!o.isMesh) return; meshes++; const g = o.geometry, k = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); tris += k;
        const m = Array.isArray(o.material) ? o.material[0] : o.material; list.push({ k, what: `${o.type}#${o.id} ${m.type}${m.map ? ' textured' : ''}${m.alphaTest ? ' alphaTest' : ''}${m.transparent ? ' transparent' : ''}${o.isInstancedMesh ? ' x' + o.count : ''}` }); });
      list.sort((a, b) => b.k - a.k);
      return { ms: Math.round(ms), meshes, ktris: Math.round(tris / 1000), top: list.slice(0, top).map(t => `${Math.round(t.k / 1000)}k ${t.what}`) };
    }, { top });
    out.push({ n, ...r });
  }
  await browser.close();
  return out;
}

const now = await measure(REPO);
let old = null, wt = null;
if (vs) {
  wt = path.join(OUT, '.perf-' + vs.replace(/[^\w.-]/g, '_'));
  try { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', wt], { stdio: 'ignore' }); } catch (e) { /* none yet */ }
  execFileSync('git', ['-C', REPO, 'worktree', 'add', '--detach', '--force', wt, vs], { stdio: 'ignore' });
  try { old = await measure(wt); } finally { execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', wt], { stdio: 'ignore' }); if (fs.existsSync(wt)) fs.rmSync(wt, { recursive: true, force: true }); }
}
const pct = (a, b) => (b ? `${a - b >= 0 ? '+' : ''}${Math.round((a - b) / b * 100)}%` : '');
console.log(`${course}: from the back tee, 844x390${vs ? `, now vs ${vs}` : ''}`);
for (const r of now) {
  const o = old && old.find(q => q.n === r.n);
  console.log(`hole ${r.n} ${HOLES[r.n - 1].name}: ${r.meshes} meshes, ${r.ktris}k triangles, ${r.ms} ms a frame` +
    (o ? `   (was ${o.meshes}, ${o.ktris}k, ${o.ms} ms: ${pct(r.meshes, o.meshes)} meshes, ${pct(r.ktris, o.ktris)} triangles, ${pct(r.ms, o.ms)} time)` : ''));
  for (const t of r.top) console.log('    ' + t);
}
