// Shared helper for the review tools: open a course page headlessly, served straight from the repo
// (no web server needed), with the test hooks on. Used by views.mjs and playthrough.mjs.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(REPO, 'tools/review/out');
fs.mkdirSync(OUT, { recursive: true });

// course id -> module file in src/course/
export const MODULES = { aerie: 'aerie', redmesa: 'red-mesa', hollowmere: 'hollowmere' };
export const loadCourse = c => import(path.join(REPO, 'src/course', `${MODULES[c]}.js`));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// Software WebGL (SwiftShader). Set CHROME=/path/to/chrome if the bundled Chromium has no WebGL.
export async function openCourse(course, { width = 844, height = 390, clean = false } = {}) {
  const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width, height } }); pg.setDefaultTimeout(900000);
  const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: '', contentType: 'text/css' }); // fonts etc.: not needed
    const f = path.join(REPO, decodeURIComponent(u.pathname));
    try { return r.fulfill({ body: fs.readFileSync(f), contentType: MIME[path.extname(f)] || 'application/octet-stream' }); }
    catch (e) { return r.fulfill({ status: 404, body: '' }); }
  });
  await pg.addInitScript(() => { window.__lowq = true; window.__noVar = true; try { localStorage.clear(); } catch (e) { /* storage off */ } });
  await pg.goto(`http://vibegolf.local/course.html?c=${course}`); await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.querySelector('#suGo').click()); await pg.waitForTimeout(800);
  if (clean) await pg.addStyleTag({ content: '#top,#holeCard,#dock,#minimapWrap,.tag,#toast,#card,#intro,#skip,#rotate,#hitbar,#readout,.st,.sim-tool,#aimPill{visibility:hidden!important}' });
  return { browser: b, page: pg, errs };
}

// Hide everything but the hole, the lights, the sky and the cloud/floor planes (ball, aim line, rings, markers).
export const hideMarkers = pg => pg.evaluate(() => {
  const S = __scene, count = o => { let c = 0; o.traverse(() => c++); return c; };
  const big = S.children.reduce((a, o) => (count(o) > count(a) ? o : a), S.children[0]);
  for (const o of S.children) {
    if (o === big || o.isLight || o.__off || o.renderOrder < 0 || o.scale.x > 1000 || (o.children.length && count(o) > 40)) continue;
    if (o.type === 'Line2' || o.isLine || o.isSprite || o.isMesh || o.isPoints) { Object.defineProperty(o, 'visible', { get: () => false, set() {} }); o.__off = true; }
  }
  __advance(0);
});

// a point s metres along a polyline, with the direction there
export const along = (L, s) => {
  for (let i = 0; i < L.length - 1; i++) { const [ax, az] = L[i], [bx, bz] = L[i + 1], l = Math.hypot(bx - ax, bz - az); if (s <= l) return [ax + (bx - ax) * s / l, az + (bz - az) * s / l, (bx - ax) / l, (bz - az) / l]; s -= l; }
  const a = L.at(-2), c = L.at(-1), l = Math.hypot(c[0] - a[0], c[1] - a[1]); return [c[0], c[1], (c[0] - a[0]) / l, (c[1] - a[1]) / l];
};
export const lineLen = L => L.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - L[i][0], p[1] - L[i][1]), 0);
