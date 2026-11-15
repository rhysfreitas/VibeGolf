// Renders of the Practice Ground for an art review, served straight from the repo like page.mjs.
//   node tools/review/range.mjs [view ...] [--tag=after] [--w=844 --h=390]
// Views (default: all):
//   tee      the Range's address view, clean          lab    Coaching's view in the Swing Lab
//   short    the short-game tee (station 'short')     flight a 7 iron in flight from the tee
//   wide     back and up behind the tee line          bays   along the tee line from the left end
//   green    the 150 yd green from just short of it   screen the big screen from 200 yd out
//   labout   the Swing Lab from the range, outside    sg     the short-game area from the hedge
//   over     the whole campus from above the Academy
// Prints draws, triangles and a software frame time for the tee view. Writes tools/review/out/range_<view>[_tag].png;
// `python3 tools/review/sheet.py --files ...` makes a contact sheet.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { REPO, OUT } from './page.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const CLEAN = 'body *{visibility:hidden!important} canvas{visibility:visible!important}';
// fixed poses in campus coordinates (the tee station, so the world isn't slid): pos, look, fov
const POSES = {
  wide: [[-6, 9, 22], [4, 0, -90], 55],
  bays: [[-49, 1.7, 1.2], [20, 0.6, -6], 50],
  green: [[-12, 1.7, -150 * 0.9144 + 30], [16, 0, -150 * 0.9144], 40],
  screen: [[10, 2, -200 * 0.9144], [10, 22, -338], 45],
  labout: [[44, 2.2, -26], [64, 3, 0], 45],
  sg: [[-74, 1.7, -88], [-112, 0, -150], 55],
  over: [[0, 70, 75], [0, 0, -140], 55],
};
const args = process.argv.slice(2), flag = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const ALL = ['tee', 'lab', 'short', 'flight', ...Object.keys(POSES)];
const views = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : ALL;
const tag = flag('tag') ? '_' + flag('tag') : '', W = +(flag('w') || 844), H = +(flag('h') || 390);

const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
async function open(mode) {
  const pg = await b.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(900000);
  pg.on('pageerror', e => errs.push(`${mode}: ${e.message}`));
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: '', contentType: 'text/css' });
    const f = path.join(REPO, decodeURIComponent(u.pathname));
    try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
  });
  await pg.addInitScript(() => { window.__lowq = true; try { localStorage.clear(); } catch (e) { /* off */ } });
  await pg.goto(`http://vibegolf.local/range.html?mode=${mode}`); await pg.waitForTimeout(2500);
  await pg.evaluate(() => __advance(1, 3));
  return pg;
}
const snap = (pg, v) => pg.screenshot({ path: path.join(OUT, `range_${v}${tag}.png`) });
const clean = pg => pg.addStyleTag({ content: CLEAN });

const t0 = Date.now();
let pg = await open('range');
if (views.includes('tee')) {
  const cost = await pg.evaluate(() => {
    const R = __world.renderer, info = R.info; info.autoReset = false; info.reset(); R.render(__world.scene, __world.camera);
    const calls = info.render.calls, tris = info.render.triangles; info.autoReset = true;
    const gl = R.getContext(), px = new Uint8Array(4), t = performance.now();
    for (let i = 0; i < 4; i++) { R.render(__world.scene, __world.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return { calls, tris, ms: Math.round((performance.now() - t) / 4), meshes: (() => { let n = 0; __world.scene.traverse(o => { if (o.isMesh || o.isSprite || o.isPoints) n++; }); return n; })() };
  });
  console.log(`tee view: ${cost.calls} draws, ${cost.meshes} objects, ${Math.round(cost.tris / 1000)}k triangles, ${cost.ms} ms a frame (software)`);
  const st = await clean(pg); await snap(pg, 'tee'); await st.evaluate(s => s.remove());
}
if (views.includes('flight')) {
  await pg.evaluate(() => document.querySelector('.st-ideal')?.click());
  await pg.evaluate(() => __advance(2.2, 2)); const st = await clean(pg); await snap(pg, 'flight'); await st.evaluate(s => s.remove());
  await pg.evaluate(() => __advance(8, 3));
}
const poses = views.filter(v => POSES[v]);
if (poses.length) {
  const st = await clean(pg);
  for (const v of poses) {
    await pg.evaluate(([p, l, fov]) => { // the range re-places its camera every frame, so hold the pose at render time
      const c = __world.camera, R = __world.renderer;
      if (!window.__origRender) window.__origRender = R.render.bind(R);
      R.render = (s, cam) => { if (cam === c) { cam.position.set(...p); cam.lookAt(...l); cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); } window.__origRender(s, cam); };
      __world.aimShadows(new THREE.Vector3(l[0], 0, l[2]));
      __world.renderer.render(__world.scene, c);
    }, POSES[v]);
    await pg.waitForTimeout(300); await snap(pg, v);
  }
  await st.evaluate(s => s.remove());
}
if (views.includes('short')) {
  await pg.evaluate(() => { if (window.__origRender) __world.renderer.render = window.__origRender; __world.setStation('short'); __advance(0.5); });
  const st = await clean(pg); await snap(pg, 'short'); await st.evaluate(s => s.remove());
}
await pg.close();
if (views.includes('lab')) {
  pg = await open('coach');
  await pg.evaluate(() => document.querySelector('[data-m=watch]')?.click()); await pg.waitForTimeout(500);
  await pg.evaluate(() => __advance(0.5)); await clean(pg); await snap(pg, 'lab'); await pg.close();
}
console.log('done', Math.round((Date.now() - t0) / 1000) + 's', 'errors', JSON.stringify(errs));
await b.close();
