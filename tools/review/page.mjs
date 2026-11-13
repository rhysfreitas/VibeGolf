// Shared helper for the review tools: open a course page headlessly, served straight from the repo
// (no web server needed), with the test hooks on, and the standard review poses.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const { chromium } = createRequire(import.meta.url)('playwright');

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(REPO, 'tools/review/out');
fs.mkdirSync(OUT, { recursive: true });

// course id -> module file in src/course/
export const MODULES = { aerie: 'aerie', redmesa: 'red-mesa', hollowmere: 'hollowmere', reclaim: 'reclaim', rimeholm: 'rimeholm', emberfell: 'emberfell', lostvalley: 'lostvalley', halcyon: 'halcyon' };
export const loadCourse = c => import(path.join(REPO, 'src/course', `${MODULES[c]}.js`));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// Software WebGL (SwiftShader). Set CHROME=/path/to/chrome if the bundled Chromium has no WebGL.
// keep: don't clear storage on each load (for checks that reload the page); start: false stays on the setup screen;
// init: an extra init script (a function) run before the page's own.
export async function openCourse(course, { width = 844, height = 390, clean = false, keep = false, start = true, init = null } = {}) {
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
  await pg.addInitScript(k => { window.__lowq = true; window.__noVar = true; if (!k) try { localStorage.clear(); } catch (e) { /* storage off */ } }, keep);
  if (init) await pg.addInitScript(init);
  await pg.goto(`http://vibegolf.local/course.html?c=${course}`); await pg.waitForTimeout(2500);
  if (start) { await pg.evaluate(() => document.querySelector('#suGo').click()); await pg.waitForTimeout(800); }
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

// The three standard review views of a hole, as __pose objects in the hole's frame:
//   tee   = behind the back tee, looking down the line to the first bend
//   land  = on the fairway where a drive finishes (par 3: the forward tee), looking at the pin
//   green = 45 m short of the green, a little above it
export function viewPoses(h, T, COURSE) {
  const back = COURSE.teeSets[0].id, fwd = COURSE.teeSets.at(-1).id;
  const gy = (x, z) => T.groundAt(x, z) ?? (T.floor?.y ?? -30), pin = h.green.pins?.[0] || h.pin, L = h.line || [h.tees[back], pin];
  const P = {};
  { const [tx, tz] = h.tees[back], [ax, az] = L[1], dx = ax - tx, dz = az - tz, l = Math.hypot(dx, dz);
    const ty = gy(tx, tz), far = Math.min(l, 240), lx = tx + dx / l * far, lz = tz + dz / l * far;
    P.tee = { pos: [tx - dx / l * 4, ty + 2.4, tz - dz / l * 4], look: [lx, Math.min(ty, gy(lx, lz)) + 2, lz], fov: 62 }; }
  { let x, z;
    if (h.par === 3) [x, z] = h.tees[fwd]; else {
      const [ax, az] = along(L, 215); let best = null;
      for (let dz = -60; dz <= 60; dz += 3) for (let dx = -60; dx <= 60; dx += 3) { const px = ax + dx, pz = az + dz; if (T.surfaceAt(px, pz) !== 'fairway') continue; const c = Math.hypot(dx, dz); if (!best || c < best.c) best = { x: px, z: pz, c }; }
      [x, z] = best ? [best.x, best.z] : [ax, az];
    }
    P.land = { pos: [x, gy(x, z) + 1.8, z], look: [pin[0], gy(pin[0], pin[1]) + 3, pin[1]], fov: 58 }; }
  { const a = L.at(-2), dx = pin[0] - a[0], dz = pin[1] - a[1], l = Math.hypot(dx, dz), G = h.green;
    const gx = G.x - dx / l * 45, gz = G.z - dz / l * 45, gyy = gy(G.x, G.z);
    P.green = { pos: [gx, Math.max(gy(gx, gz) + 2, gyy + 7), gz], look: [G.x + dx / l * 12, gyy + 2, G.z + dz / l * 12], fov: 60 }; }
  return P;
}

// go to hole n (1-based) and settle; then set a fixed camera with the markers hidden
export async function goHole(pg, n) { await pg.evaluate(i => { __startHole(i); document.getElementById('skip')?.click(); window.__pose = null; }, n - 1); await pg.evaluate(() => __advance(0.8)); }
export async function setPose(pg, p) { await pg.evaluate(q => { window.__pose = q; __advance(0.3); }, p); await hideMarkers(pg); }
