// Renders of the mini games for an art review: for each game, the play view with its UI, the same view clean,
// a wide view (the camera pulled back and up from where it stands), the ball in flight after an Ideal shot,
// and the payoff a few seconds later. No server needed (served straight from the repo, like page.mjs).
//   node tools/review/games.mjs [game ...] [--only=play,clean,wide,flight,land] [--tag=after]
// Games: shape-it zombie-siege island-hopper horse carnival-booth wedge-ladder golf-bowling (default: all).
// Writes tools/review/out/game_<game>_<view>[_tag].png; sheet.py --files makes a contact sheet of them.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { REPO, OUT } from './page.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

export const GAMES = ['shape-it', 'zombie-siege', 'island-hopper', 'horse', 'carnival-booth', 'wedge-ladder', 'golf-bowling'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const CLEAN = '.mg-tl,.mg-tr,.mg-play,.mg-result,.mg-splash,.mg-board,.st,#rotate,.mg-rotate{visibility:hidden!important}';

const args = process.argv.slice(2), flag = k => (args.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const games = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : GAMES;
const only = (flag('only') || 'play,clean,wide,flight,land').split(','), tag = flag('tag') ? '_' + flag('tag') : '';

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
for (const g of games) {
  const t0 = Date.now(), pg = await b.newPage({ viewport: { width: 844, height: 390 } }); pg.setDefaultTimeout(900000);
  pg.on('pageerror', e => errs.push(`${g}: ${e.message}`));
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: '', contentType: 'text/css' });
    const f = path.join(REPO, decodeURIComponent(u.pathname));
    try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); }
  });
  await pg.addInitScript(() => { window.__lowq = true; try { localStorage.clear(); } catch (e) { /* off */ } });
  await pg.goto(`http://vibegolf.local/${g}.html`); await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.querySelector('[data-go]')?.click()); await pg.waitForTimeout(1500);
  await pg.evaluate(() => __advance(1.5, 3));
  const shot = async v => { if (only.includes(v)) await pg.screenshot({ path: path.join(OUT, `game_${g}_${v}${tag}.png`) }); };
  await shot('play');
  const cost = await pg.evaluate(() => { // draws, triangles and software frame time of the play view
    const R = __world.renderer, info = R.info; info.autoReset = false; info.reset(); R.render(__world.scene, __world.camera);
    const calls = info.render.calls, tris = info.render.triangles; info.autoReset = true;
    const gl = R.getContext(), px = new Uint8Array(4), t = performance.now(); for (let i = 0; i < 4; i++) { R.render(__world.scene, __world.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return { calls, tris, ms: Math.round((performance.now() - t) / 4) };
  });
  const style = await pg.addStyleTag({ content: CLEAN });
  await shot('clean');
  if (only.includes('wide')) {
    await pg.evaluate(() => { // the game re-places its camera every frame, so hold the wide pose at render time
      const c = __world.camera, f = new THREE.Vector3(); c.getWorldDirection(f); f.y = 0; f.normalize();
      const to = c.position.clone().addScaledVector(f, -14).add(new THREE.Vector3(0, 9, 0)), R = __world.renderer, orig = R.render.bind(R);
      window.__wideFrom = c.position.clone(); window.__unwide = () => { R.render = orig; };
      R.render = (s, cam) => { if (cam === c) { cam.position.copy(to); cam.updateMatrixWorld(); } orig(s, cam); };
      __advance(0);
    });
    await pg.waitForTimeout(400);
    await shot('wide');
    await pg.evaluate(() => { __unwide(); __world.camera.position.copy(window.__wideFrom); __advance(0); });
  }
  await style.evaluate(s => s.remove());
  if (only.includes('flight') || only.includes('land')) {
    await pg.evaluate(() => document.querySelector('.st-ideal')?.click());
    await pg.evaluate(() => __advance(1.4, 2)); await pg.addStyleTag({ content: CLEAN }); await shot('flight');
    await pg.evaluate(() => __advance(5, 3)); await shot('land');
  }
  console.log(g, 'done', Math.round((Date.now() - t0) / 1000) + 's', `| ${cost.calls} draws, ${Math.round(cost.tris / 1000)}k triangles, ${cost.ms} ms a frame`);
  await pg.close();
}
console.log('errors', JSON.stringify(errs));
await b.close();
