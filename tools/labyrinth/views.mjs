// node tools/labyrinth/views.mjs [name...] : round 0 views through the game's own camera (src/stance.js: 3.2 m
// behind the ball, 1.55 m up, a 50° vertical field of view, the ball 88% of the way down; at 844×390 that is 19°
// above level to 31° below and about 90° across), rendered from the maze in maze.mjs: walls as blocks lit by the low
// evening sun with real shadows, the floor painted with the mown ground, the flags. Lifted shade so it prints.
// out/views/<name>.png. Needs playwright (npm i --no-save playwright) and Chrome (CHROME=/usr/bin/google-chrome).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { walls, floorAt, paintAt, flags, LINES, SUN, P, F2, F3a, F3L, F3R, F1a } from './maze.mjs';
import { at } from './geo.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(HERE, '../..'), OUT = path.join(HERE, 'out/views');
fs.mkdirSync(OUT, { recursive: true });
const W = 844, H = 390, DPR = 2;
const YD = 0.9144;

// the game's stance (src/stance.js), here in plain arrays
function stance(ball, aim, o = {}) {
  const back = o.back ?? 3.2, up = o.up ?? 1.55, fov = 50, ballAt = 0.88;
  let d = [aim[0] - ball[0], aim[2] - ball[2]]; const l = Math.hypot(...d); d = d.map(v => v / l);
  const pos = [ball[0] - d[0] * back, ball[1] + up, ball[2] - d[1] * back];
  const g = floorAt(pos[0], pos[2]); pos[1] = Math.max(pos[1], g + 0.5);
  const half = fov * Math.PI / 360, alpha = Math.atan2(pos[1] - ball[1], back), beta = Math.atan((2 * ballAt - 1) * Math.tan(half));
  const pitch = alpha - beta;
  return { pos, look: [pos[0] + d[0] * 100, pos[1] - 100 * Math.tan(pitch), pos[2] + d[1] * 100], ball };
}
const ballAt = (X, Z) => [X, floorAt(X, Z) + 0.02, Z];
const on = (F, s, off = 0) => at(F.L, s, off);

// the views: [name, version (which Elbow door is open), variant, ball, aim]
const V = [];
const view = (name, o) => V.push({ name, version: 'L', variant: 'dressed', ...o });
for (const variant of ['plain', 'dressed', 'low', 'broken']) {
  const t = { plain: 'A', dressed: 'B', low: 'C', broken: 'D' }[variant];
  // the 2nd: tee, the landing area (a 260 m drive), a long approach (200 yd) and a short one (130 yd)
  view(`h2_tee_${t}`, { variant, ball: ballAt(...LINES[2][0]), aim: LINES[2][1] });
  view(`h2_land_${t}`, { variant, ball: ballAt(...on(F2, 245)), aim: LINES[2][1] });
  view(`h2_long_${t}`, { variant, ball: ballAt(...on(F2, 416 - 200 * YD)), aim: LINES[2][1] });
  if (variant === 'low' || variant === 'broken') continue;
  // the 3rd: the tee (to the corner), the corner (down the open leg)
  view(`h3_tee_${t}`, { variant, ball: ballAt(...LINES[3][0]), aim: on(F3a, 210, -8) });
  view(`h3_corner_${t}`, { variant, ball: ballAt(...on(F3a, 200, 0)), aim: LINES[3][2] });
  // the 1st: the tee toward the gate, and the drive's landing area looking through it
  view(`h1_tee_${t}`, { variant, ball: ballAt(...LINES[1][0]), aim: P([210, 306]) });
  { const b = on(F1a, 215, 8), g = P([210, 306]); view(`h1_land_${t}`, { variant, ball: ballAt(...b), aim: [b[0] + 3 * (g[0] - b[0]), b[1] + 3 * (g[1] - b[1])] }); }
}
view('h3_tee_R', { version: 'R', ball: ballAt(...LINES[3][0]), aim: on(F3a, 210, 8) });
view('h3_corner_R', { version: 'R', ball: ballAt(...on(F3a, 200, 0)), aim: LINES['3R'][2] });
view('h3_bold_L', { ball: ballAt(...LINES[3][0]), aim: on(F3L, 70, 2) });                          // the bold line, aimed over the heap
view('h3_boldland_L', { ball: ballAt(...on(F3L, 75, 4)), aim: LINES[3][2] });                       // where the bold drive finishes

// callouts for the book: [label, [X, y, Z]] projected through the same camera into out/views/notes.json
const F0 = 12, TOWER = [767, F0 + 96, -794];
const p3 = (xz, y) => [xz[0], y, xz[1]];
const NOTES = {
  h2_tee: [['End wall, 450 m: lit by the low sun', p3(on(F2, 450, -18), F0 + 34)], ['Pin, 455 yd', p3(LINES[2][1], F0 + 2)]],
  h2_tee_A: [['60 m walls fill the top of the frame for the first 170 m', p3(on(F2, 40, -31), F0 + 30)]],
  h2_tee_D: [['The tower, over a fallen stretch', TOWER]],
  h2_land: [['Gold light along the top of the left wall', p3(on(F2, 360, -31), F0 + 44)], ['The end wall leans in over the green', p3(on(F2, 450, 10), F0 + 40)]],
  h2_land_D: [['The tower again, over the second fallen stretch', TOWER]],
  h2_long: [['Kick bank and leaning wall behind the green', p3(on(F2, 444, 14), F0 + 8)]],
  h3_tee: [['Both side walls drop to 9-14 m from 80 m out', p3(on(F3a, 125, -31), F0 + 13)], ['Outer corner wall: stops a drive that runs through', p3(on(F3a, 236, 6), F0 + 46)]],
  h3_tee_B: [['Open door (left this round)', p3(on(F3L, 34, 0), F0 + 30)]],
  h3_tee_R: [['Open door (right this round)', p3(on(F3R, 34, 0), F0 + 30)]],
  h3_corner_B: [['Leg 2 and the green, 140 m', p3(LINES[3][2], F0 + 3)]],
  h3_corner_R: [['Leg 2 and the green, 140 m', p3(LINES['3R'][2], F0 + 3)]],
  h3_bold_L: [['Bold line: over both low walls and the court', p3(on(F3L, 60, -36), F0 + 14)]],
  h1_tee: [['Inner gate: doors 40 m high, 290 yd', p3(P([210, 306]), F0 + 44)]],
  h1_land: [['Through the gate into the first court', p3(P([216, 340]), F0 + 20)]],
};
function project(cam, p) {
  const f = cam.look.map((v, i) => v - cam.pos[i]), fl = Math.hypot(...f); f.forEach((v, i) => f[i] = v / fl);
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map(v => v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = p.map((q, i) => q - cam.pos[i]), x = v[0] * r[0] + v[1] * r[1] + v[2] * r[2], y = v[0] * u[0] + v[1] * u[1] + v[2] * u[2], z = v[0] * f[0] + v[1] * f[1] + v[2] * f[2];
  if (z < 1) return null;
  const tv = Math.tan(25 * Math.PI / 180), th = tv * W / H;
  return [+(50 + 50 * x / (z * th)).toFixed(1), +(50 - 50 * y / (z * tv)).toFixed(1)];   // percent of the frame
}

// the floor's paint, in the shader's colours (linear-ish sRGB values; the page converts)
const PAINT = { fairway: [0.43, 0.57, 0.3], rough: [0.34, 0.43, 0.25], native: [0.45, 0.47, 0.33], green: [0.49, 0.66, 0.33],
  fringe: [0.46, 0.62, 0.32], tee: [0.46, 0.6, 0.33], rubble: [0.55, 0.52, 0.46] };
function floorMesh(version) {
  const x0 = -90, x1 = 1260, z0 = -1420, z1 = 90, c = 4, nx = Math.round((x1 - x0) / c) + 1, nz = Math.round((z1 - z0) / c) + 1;
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * c, Z = z0 + j * c, k = (j * nx + i) * 3, p = PAINT[paintAt(X, Z, version)];
    pos[k] = X; pos[k + 1] = floorAt(X, Z); pos[k + 2] = Z;
    const n = 0.93 + 0.1 * Math.sin(X * 1.7 + Z * 2.3) * Math.sin(X * 0.37 - Z * 0.53);
    col[k] = p[0] * n; col[k + 1] = p[1] * n; col[k + 2] = p[2] * n;
  }
  return { nx, nz, pos: Array.from(pos), col: Array.from(col) };
}

const PAGE = `<!doctype html><html><body style="margin:0;background:#fff"><canvas id=c></canvas>
<script src="http://vibegolf.local/vendor/three-r147/three.min.js"></script>
<script>
window.build = (D) => {
  const R = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true });
  R.setPixelRatio(D.dpr); R.setSize(D.w, D.h); R.outputEncoding = THREE.sRGBEncoding;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const S = new THREE.Scene();
  const sun = new THREE.Vector3().setFromSphericalCoords(1, (90 - D.sun.el) * Math.PI / 180, 0);
  { const az = D.sun.az * Math.PI / 180, el = D.sun.el * Math.PI / 180; sun.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); }
  // the sky: a gradient dome, warm low down toward the sun
  const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: sun } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uSun; varying vec3 vD; void main(){ float h = max(vD.y, 0.0); vec3 top = vec3(0.36,0.52,0.78), hor = vec3(0.93,0.84,0.72);' +
      'vec3 c = mix(hor, top, pow(h, 0.55)); float g = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0,0.72,0.42) * pow(g, 12.0) * 0.55 + vec3(1.0,0.9,0.7) * pow(g, 400.0) * 2.0;' +
      'gl_FragColor = vec4(c, 1.0); }' });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMat); S.add(sky);
  S.fog = new THREE.Fog(new THREE.Color(0.86, 0.80, 0.72), 300, 3200);
  const hemi = new THREE.HemisphereLight(0xa9bde0, 0x6e6250, D.debug ? 0 : 0.52); S.add(hemi);
  S.add(new THREE.AmbientLight(0xffffff, D.debug ? 0 : 0.12));
  const L = new THREE.DirectionalLight(0xffbb72, 3.8); L.position.copy(sun).multiplyScalar(2500).add(new THREE.Vector3(560, 0, -560));
  L.target.position.set(560, 0, -560); S.add(L.target); S.add(L);
  L.castShadow = true; const sc = L.shadow.camera; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 100; sc.far = 5200;
  L.shadow.mapSize.set(4096, 4096); L.shadow.bias = -0.0004; L.shadow.normalBias = 0.6;
  // the walls
  const P = [], C = [], col = (k, f, y) => {
    const K = { stone: [0.7,0.65,0.56], ivy: [0.68,0.63,0.54], door: [0.34,0.27,0.21], lintel: [0.6,0.56,0.5], tower: [0.72,0.68,0.6], rubble: [0.58,0.55,0.49], bank: [0.76,0.72,0.63] }[k];
    return K;
  };
  const hash = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const IVY = [0.3, 0.39, 0.21], IVY2 = [0.37, 0.45, 0.24], GRASS = [0.47, 0.52, 0.3];
  const quad = (a, b, c2, d, ca, cb, cc, cd) => { P.push(...a, ...b, ...c2, ...a, ...c2, ...d); C.push(...ca, ...cb, ...cc, ...ca, ...cc, ...cd); };
  for (const w of D.walls) {
    const b = w.pts.map(([x, z]) => [x, w.y0, z]);
    let t = w.pts.map(([x, z]) => [x + (w.shift ? w.shift[0] : 0), w.y1, z + (w.shift ? w.shift[1] : 0)]);
    if (w.shrink) { const cx = t.reduce((a, p) => a + p[0], 0) / 4, cz = t.reduce((a, p) => a + p[2], 0) / 4; t = t.map(p => { const dx = p[0] - cx, dz = p[2] - cz, l = Math.hypot(dx, dz); return [p[0] - dx / l * w.shrink * 1.41, p[1], p[2] - dz / l * w.shrink * 1.41]; }); }
    const base = col(w.kind);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, A = b[i], B = b[j], Tb = t[j], Ta = t[i];
      const len = Math.hypot(B[0] - A[0], B[2] - A[2]), hh = w.y1 - w.y0;
      const nu = Math.max(1, Math.round(len / (w.kind === 'ivy' ? 2.5 : 7))), nv = Math.max(1, Math.round(hh / (w.kind === 'ivy' ? 3 : 7)));
      for (let u = 0; u < nu; u++) for (let v = 0; v < nv; v++) {
        const p = (uu, vv) => { const lo = [A[0] + (B[0] - A[0]) * uu, A[1], A[2] + (B[2] - A[2]) * uu], hi = [Ta[0] + (Tb[0] - Ta[0]) * uu, Ta[1], Ta[2] + (Tb[2] - Ta[2]) * uu]; return [lo[0] + (hi[0] - lo[0]) * vv, lo[1] + (hi[1] - lo[1]) * vv, lo[2] + (hi[2] - lo[2]) * vv]; };
        const p00 = p(u / nu, v / nv), p10 = p((u + 1) / nu, v / nv), p11 = p((u + 1) / nu, (v + 1) / nv), p01 = p(u / nu, (v + 1) / nv);
        const cx = (p00[0] + p11[0]) / 2, cz = (p00[2] + p11[2]) / 2, rel = (v + 0.5) / nv;
        let c = base.map((q, k) => q * (0.9 + 0.16 * hash(Math.round(cx / 3), Math.round(cz / 3) + v)));
        // courses of stone: a darker line every other row
        if (w.kind !== 'door' && v % 2) c = c.map(q => q * 0.94);
        if (w.kind === 'ivy') { const col = hash(Math.round(cx / 2.5) * 3.1, Math.round(cz / 2.5) * 1.7), big = hash(Math.round(cx / 14) * 0.7, Math.round(cz / 14) * 2.3), reach = (0.15 + 0.55 * big) * (0.75 + 0.5 * col), hang = hash(Math.round(cx / 2.5) * 1.3, Math.round(cz / 2.5) * 2.9) * big; const on = rel < reach || rel > 1 - 0.3 * hang; if (on) c = (col < 0.5 ? IVY : IVY2).map(q => q * (0.92 + 0.16 * hash(u, v))); }
        quad(p00, p10, p11, p01, c, c, c, c);
      }
    }
    // the top: grass where it's a wall's top
    const ct = w.top === 'grass' ? GRASS : base.map(q => q * 1.05);
    quad(t[0], t[3], t[2], t[1], ct, ct, ct, ct);
  }
  const lin = a => a.map(v => Math.pow(v, 2.2));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(lin(C), 3)); g.computeVertexNormals();
  const wm = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); wm.castShadow = wm.receiveShadow = true; S.add(wm);
  // the floor
  const F = D.floor, fg = new THREE.BufferGeometry(), idx = [];
  for (let j = 0; j < F.nz - 1; j++) for (let i = 0; i < F.nx - 1; i++) { const a = j * F.nx + i, b = a + 1, c = a + F.nx, d = c + 1; idx.push(a, c, b, b, c, d); }
  fg.setAttribute('position', new THREE.Float32BufferAttribute(F.pos, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(lin(F.col), 3)); fg.setIndex(idx); fg.computeVertexNormals();
  const fm = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true })); fm.receiveShadow = true; S.add(fm);
  // the flags
  for (const f of D.flags) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); pole.position.set(f[0], f[1] + 1.2, f[2]); S.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.5), new THREE.MeshBasicMaterial({ color: 0xe23b2e, side: THREE.DoubleSide })); fl.position.set(f[0] + 0.38, f[1] + 2.15, f[2]); S.add(fl);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshLambertMaterial({ color: 0xffffff })); S.add(ball);
  const cam = new THREE.PerspectiveCamera(50, D.w / D.h, 0.3, 9000);
  window.shot = (v) => { cam.position.set(...v.pos); cam.lookAt(...v.look); sky.position.copy(cam.position); ball.position.set(v.ball[0], v.ball[1] + 0.04, v.ball[2]); R.render(S, cam); return R.domElement.toDataURL('image/png'); };
  return true;
};
</script></body></html>`;

const want = process.argv.slice(2);
const list = V.filter(v => !want.length || want.some(w => v.name.startsWith(w)));
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await browser.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(900000);
pg.on('pageerror', e => console.log('PAGEERR', e.message)); pg.on('console', m => m.type() === 'error' && console.log('console', m.text()));
await pg.route('**/*', r => { const u = new URL(r.request().url()); if (u.hostname !== 'vibegolf.local') return r.fulfill({ body: PAGE, contentType: 'text/html' });
  try { return r.fulfill({ body: fs.readFileSync(path.join(REPO, u.pathname)), contentType: 'text/javascript' }); } catch (e) { return r.fulfill({ status: 404, body: '' }); } });
await pg.goto('http://page.local/');
let built = null;
const NF = path.join(OUT, 'notes.json'), notes = fs.existsSync(NF) ? JSON.parse(fs.readFileSync(NF)) : {};
for (const v of list) {
  const key = v.variant + v.version;
  if (built !== key) {
    const fl = flags(v.version).map(([X, Z]) => [X, floorAt(X, Z), Z]);
    await pg.evaluate(D => window.build(D), { w: W, h: H, dpr: DPR, sun: SUN, debug: !!process.env.DEBUG, walls: walls(v.variant, v.version), floor: floorMesh(v.version), flags: fl });
    built = key;
  }
  const s = v.cam ? { ...v.cam, ball: [0, -100, 0] } : stance(v.ball, [v.aim[0], 0, v.aim[1]]);
  const t0 = Date.now(), url = await pg.evaluate(s => window.shot(s), s);
  fs.writeFileSync(path.join(OUT, v.name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  const base = v.name.replace(/_[A-Z]$/, '');
  notes[v.name] = [...(NOTES[base] || []), ...(NOTES[v.name] || [])].map(([t, p]) => ({ t, at: project(s, p) })).filter(n => n.at);
  console.log(v.name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close();
fs.writeFileSync(NF, JSON.stringify(notes, null, 1));
