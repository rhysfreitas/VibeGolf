// The Buried Kingdom (global THREE): what COURSE.kingdom holds (world space) put into a hole's frame (hole.frame)
// and drawn. Art pass 1 (tools/buriedkingdom/art-brief.md, Rhys's picks): the site from its height maps in the ground
// shader's KINGDOM branch (firm sand, soft dunes, the fields along the river, the wadi's limestone cliffs); the river
// and the basin as one sheet; the pyramids with stepped cores in courses and the great one's cased top with a ragged
// edge; the pylons battered with a cornice and great figures in sunk relief, faded paint under the cornice; the
// colossi as seated kings and the Sphinx's head in its headcloth, worn; granite obelisks; the valley temple's papyrus
// columns; date palms with fronds, doum palms, papyrus and reeds, tamarisk and acacias; egrets, ibis, a heron and two
// feluccas; the expedition's tents, spoil rail, carts, crates, flags and ladders; ruin litter; tomb doors in the
// cliffs; sand streaming off the dune crests. The ball's side of it (the boxes, the palms' bodies) is in the course
// module, terrain.js and trees.js; everything here is drawn only.
import { unpackHeights } from './field-code.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
export const TYPES = new Set(['palm']);
function batch() {
  const pos = [], col = [];
  const tri = (a, b, c, k) => { pos.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) col.push(k[0], k[1], k[2]); };
  const quad = (a, b, c, d, k) => { tri(a, b, c, k); tri(a, c, d, k); };
  const mesh = (mat, shadow = true) => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  return { tri, quad, mesh };
}
// the paint byte: 0 firm sand, 1 soft sand, 2 rock, 3 masonry, 4 fields, 8 water, 10 (world map only) mown ground
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, KINGDOM) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B soft sand (bunkers and the Sand Sea), A grass length (rough)
// B: R fields, G masonry, B (spare), A rock
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee'), cS = C.indexOf('sand');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG && m !== 4) w[2] += f; else if (c === cS) w[3] += f;
      if (m === 4) w[4] += f; else if (m === 3) w[5] += f; else if (m === 2) w[6] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[3] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway', 'sand'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[4]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 2] = 0; b[o + 3] = Math.round(Math.min(1, own[6]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#b9a27c', rough: '#8f9a4c', firstcut: '#7fa046', fairway: '#6fa843', fringe: '#79b44a', green: '#8acb5c', tee: '#80b052', sand: '#f1e2b4', waste: '#d9bf8a', water: '#3f7f8c', void: '#15110f' };
  const M = { 2: '#9c8460', 3: '#cdbd9c', 4: '#5f8a3c' };
  return (x, z) => { const s = T.surfaceAt(x, z), m = matAt(hole, x, z); if ((s === 'desert' || s === 'rough') && M[m]) return M[m]; return C[s] || C.waste; };
}
// what a native lie is called, from the paint under the ball (rock and masonry are 'desert', the fields 'rough')
export function lieName(hole, x, z) { return { 2: 'Rock', 3: 'Stone', 4: 'Field' }[matAt(hole, x, z)] || 'Rock'; }
export const isField = (hole, x, z) => matAt(hole, x, z) === 4;


/* ---------- art pass 1 (tools/buriedkingdom/art-brief.md, Rhys's picks: weathered stone with paint traces, the
   river strip green, clear with heat shimmer, the dig, river life, ruin litter) ---------- */
// U: the uniforms the ground shader reads (main.js adds them to the KINGDOM branch): time for the mirage, the
// horizon's colour the far flats take on
export const U = { uKTime: { value: 0 }, uKSky: { value: new THREE.Color(0xd4dce4).convertSRGBToLinear() } };
const TILE = 8;   // metres per repeat of the masonry texture: courses about 1 m, blocks 1.1–2.5 m

// the sky (art pass 1): THREE.Sky goes pale with the sun this high, so a dome of deep blue over a pale horizon band,
// a soft glow round the sun; main.js calls sky(on) from applySky (on in clear or hazy daylight)
const SKY = { on: true, sun: new THREE.Vector3(0.3, 0.9, 0.2) }, DOMES = new Set();
export function sky(on, sunDir) { SKY.on = on; if (sunDir) SKY.sun.copy(sunDir); for (const d of DOMES) d.visible = on; }
function skyDome() {
  const m = new THREE.ShaderMaterial({ uniforms: { uSun: { value: SKY.sun } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vW;
void main(){
  vec3 d = normalize(vW - cameraPosition); float e = max(d.y, 0.0);
  vec3 zen = vec3(0.07, 0.36, 1.25), mid = vec3(0.34, 0.86, 1.95), hor = vec3(1.75, 1.85, 1.95), dust = vec3(2.0, 1.85, 1.6);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.18, e)); col = mix(col, zen, smoothstep(0.12, 0.85, e));
  col = mix(col, dust, smoothstep(0.035, -0.01, d.y));
  float su = max(dot(d, normalize(uSun)), 0.0); col += vec3(1.6, 1.45, 1.2) * (pow(su, 6.0) * 0.35 + pow(su, 300.0) * 4.0);
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(11000, 48, 24), m); mesh.renderOrder = -10; mesh.frustumCulled = false; mesh.visible = SKY.on;
  DOMES.add(mesh); mesh.onBeforeRender = () => {}; return mesh;
}

let TEX = null;
function textures() {
  if (TEX) return TEX;
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rep = true, clampV = false) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep) { t.wrapS = THREE.RepeatWrapping; t.wrapT = clampV ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping; } t.anisotropy = 4; return t; };
  // dressed limestone courses, near neutral (vertex colours give each thing its tone): 8 m a repeat, eight courses
  const masonry = (() => {
    const [c, g] = cvs(512, 512), R = rng(7), ch = 64;
    g.fillStyle = '#8c8170'; g.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      let x = -R() * 120; const y = row * ch;
      while (x < 512) {
        const w = (1.1 + R() * 1.4) * 64, t = 0.86 + R() * 0.2, rr = 214 * t, gg = 203 * t, bb = 182 * t;
        for (const dx of [0, 512, -512]) {
          g.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`; g.fillRect(x + dx + 1.5, y + 1.5, w - 3, ch - 3);
          g.fillStyle = 'rgba(255,250,235,0.18)'; g.fillRect(x + dx + 1.5, y + 1.5, w - 3, 3);   // the lit top arris
          g.fillStyle = 'rgba(60,45,30,0.22)'; g.fillRect(x + dx + 1.5, y + ch - 7, w - 3, 5);      // shade under the next course
        }
        x += w;
      }
    }
    for (let i = 0; i < 2600; i++) { const x = R() * 512, y = R() * 512, r = 0.6 + R() * 1.8; g.fillStyle = R() < 0.5 ? 'rgba(80,62,40,0.22)' : 'rgba(255,248,230,0.16)'; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = R() * 512, y = R() * 512; g.fillStyle = 'rgba(110,86,58,0.12)'; g.beginPath(); g.ellipse(x, y, 10 + R() * 30, 4 + R() * 10, R() * 3, 0, 6.283); g.fill(); }
    return tex(c);
  })();
  // carved bedrock (the Sphinx, the colossi): strata a half to one and a half metres thick, pitted and grooved
  // by the wind, no joints; 8 m a repeat
  const carved = (() => {
    const [c, g] = cvs(512, 512), R = rng(13); let y = 0;
    while (y < 512) { const h = (0.5 + R()) * 64, t = 0.86 + R() * 0.2; g.fillStyle = `rgb(${212 * t | 0},${198 * t | 0},${170 * t | 0})`; g.fillRect(0, y, 512, h);
      g.fillStyle = 'rgba(70,52,34,0.28)'; g.fillRect(0, y + h - 5, 512, 5); g.fillStyle = 'rgba(255,248,230,0.14)'; g.fillRect(0, y, 512, 3); y += h; }
    for (let i = 0; i < 160; i++) { const x = R() * 512, yy = R() * 512; g.strokeStyle = 'rgba(80,60,40,0.18)'; g.lineWidth = 1 + R() * 2; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 20 + R() * 60, yy + (R() - 0.5) * 6); g.stroke(); }
    for (let i = 0; i < 3000; i++) { g.fillStyle = R() < 0.55 ? 'rgba(80,62,40,0.2)' : 'rgba(255,248,230,0.14)'; g.beginPath(); g.arc(R() * 512, R() * 512, 0.6 + R() * 2.2, 0, 6.283); g.fill(); }
    return tex(c);
  })();
  // a pylon's face, 12 m across and 24 m tall a repeat (it tiles across): the cornice's shadow, a winged disc, two
  // great figures in sunk relief facing each other over a column of glyphs, a frieze below; faded blue, red and
  // yellow kept only in the shade under the cornice and in the deeper cuts; the foot worn pale by blown sand
  const relief = (() => {
    const W = 512, H = 1024, [c, g] = cvs(W, H), R = rng(11), m = W / 12;   // px per metre
    g.fillStyle = '#d2c5aa'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += m * 0.8) { g.fillStyle = 'rgba(90,70,48,0.16)'; g.fillRect(0, y, W, 1.5); let x = -R() * 60; while (x < W) { g.fillRect(x, y, 1.5, m * 0.8); x += m * (1.4 + R() * 1.6); } }
    for (let i = 0; i < 3000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(90,70,48,0.12)' : 'rgba(255,250,235,0.12)'; g.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2); }
    const sunk = (draw, fill) => {   // a sunk relief: a shadowed edge on the upper left, a lit edge on the lower right
      g.save(); g.translate(-2, -2); g.strokeStyle = 'rgba(55,40,25,0.55)'; g.lineWidth = 3; draw(); g.stroke(); g.restore();
      g.save(); g.translate(1.5, 1.5); g.strokeStyle = 'rgba(255,248,230,0.4)'; g.lineWidth = 2; draw(); g.stroke(); g.restore();
      draw(); g.fillStyle = fill || 'rgba(120,96,66,0.16)'; g.fill();
    };
    const paint = (draw, col, a) => { draw(); g.fillStyle = col.replace('A', a.toFixed(2)); g.fill(); };
    const BLUE = 'rgba(45,95,138,A)', RED = 'rgba(160,72,46,A)', YEL = 'rgba(201,160,58,A)';
    // the cornice's shadow and a band of paint under it
    const gr = g.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, 'rgba(50,36,22,0.5)'); gr.addColorStop(1, 'rgba(50,36,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 120);
    for (let x = 0; x < W; x += 24) { g.fillStyle = [BLUE, RED, YEL][(x / 24) % 3].replace('A', '0.3'); g.fillRect(x + 3, 6, 16, 34); }
    // a winged disc
    const disc = () => { g.beginPath(); g.ellipse(W / 2, 150, 26, 22, 0, 0, 6.283); g.moveTo(W / 2 - 30, 148); g.quadraticCurveTo(W / 2 - 150, 120, W / 2 - 220, 162); g.lineTo(W / 2 - 30, 170); g.moveTo(W / 2 + 30, 148); g.quadraticCurveTo(W / 2 + 150, 120, W / 2 + 220, 162); g.lineTo(W / 2 + 30, 170); };
    sunk(disc); paint(disc, BLUE, 0.22); g.beginPath(); g.ellipse(W / 2, 150, 22, 18, 0, 0, 6.283); g.fillStyle = RED.replace('A', '0.3'); g.fill();
    // a great standing figure (about 13 m), facing in from either side
    const figure = (cx, dir, raise) => () => {
      const s = m, f = (x, y) => [cx + dir * x * s, y * s], P = (...pts) => { g.moveTo(...f(...pts[0])); for (const q of pts.slice(1)) g.lineTo(...f(...q)); g.closePath(); };
      g.beginPath();
      P([-0.5, 6.2], [0.5, 6.2], [0.7, 4.6], [-0.7, 4.6]);                        // the tall crown
      g.moveTo(...f(0.55, 5.4)); g.arc(...f(0, 5.4), 0.62 * s, 0, 6.283);           // the head
      P([-1.25, 7.0], [1.25, 7.0], [0.9, 10.8], [-0.9, 10.8]);                      // the body
      P([-1.1, 10.6], [1.6, 10.6], [1.2, 13.0], [-0.9, 13.0]);                      // the kilt
      P([-0.8, 13.0], [-0.2, 13.0], [-0.5, 19.0], [-1.0, 19.0]);                    // the legs, striding
      P([0.3, 13.0], [1.0, 13.0], [1.6, 19.0], [1.0, 19.0]);
      if (raise) { P([-1.2, 7.2], [-0.8, 7.0], [-2.0, 4.0], [-2.4, 4.3]); g.moveTo(...f(-2.0, 3.6)); g.arc(...f(-2.2, 3.6), 0.45 * s, 0, 6.283); }
      else P([1.0, 7.3], [1.4, 7.4], [2.2, 10.0], [1.9, 10.2]);
      P([1.6, 6.0], [1.85, 6.0], [1.85, 19.0], [1.6, 19.0]);                        // a staff
    };
    const yo = 3.6 * m;   // the figures stand below the disc
    for (const [cx, dir, raise] of [[3.0 * m, 1, true], [W - 3.0 * m, -1, false]]) {
      const fig = figure(cx, dir, raise);
      g.save(); g.translate(0, yo - 4 * m); sunk(fig); g.restore();
      g.save(); g.translate(0, yo - 4 * m); g.beginPath(); const s = m; g.rect(cx + dir * -0.6 * s - (dir < 0 ? 1.2 * s : 0), 4.6 * s, 1.2 * s, 1.6 * s); g.fillStyle = (raise ? RED : BLUE).replace('A', '0.26'); g.fill(); g.restore();   // the crown's paint
    }
    // a column of glyphs between them, and a frieze of them low down
    const glyph = (x, y, sz) => { const k = Math.floor(R() * 6); g.beginPath();
      if (k === 0) { g.ellipse(x, y, sz * 0.45, sz * 0.25, 0, 0, 6.283); } else if (k === 1) { g.moveTo(x - sz * 0.4, y + sz * 0.4); g.lineTo(x, y - sz * 0.45); g.lineTo(x + sz * 0.4, y + sz * 0.4); g.closePath(); }
      else if (k === 2) { g.rect(x - sz * 0.42, y - sz * 0.12, sz * 0.84, sz * 0.24); } else if (k === 3) { g.ellipse(x - sz * 0.1, y, sz * 0.3, sz * 0.18, 0.2, 0, 6.283); g.moveTo(x + sz * 0.15, y - sz * 0.1); g.lineTo(x + sz * 0.42, y - sz * 0.35); g.lineTo(x + sz * 0.3, y + sz * 0.02); }
      else if (k === 4) { g.arc(x, y, sz * 0.3, 0, 6.283); } else { g.rect(x - sz * 0.08, y - sz * 0.45, sz * 0.16, sz * 0.9); } };
    g.save(); g.strokeStyle = 'rgba(90,68,44,0.3)'; g.lineWidth = 2; g.strokeRect(W / 2 - 0.7 * m, 4.4 * m, 1.4 * m, 13 * m); g.restore();
    for (let y = 4.9 * m; y < 17.2 * m; y += 0.6 * m) sunk(() => glyph(W / 2, y, 0.5 * m));
    g.save(); g.strokeStyle = 'rgba(90,68,44,0.3)'; g.lineWidth = 2; g.strokeRect(6, 19.6 * m, W - 12, 1.3 * m); g.restore();
    for (let x = 0.5 * m; x < W - 0.3 * m; x += 0.62 * m) sunk(() => glyph(x, 20.25 * m, 0.5 * m));
    // the foot worn pale and plain by blown sand
    const gf = g.createLinearGradient(0, 20.9 * m, 0, H); gf.addColorStop(0, 'rgba(222,208,180,0)'); gf.addColorStop(1, 'rgba(222,208,180,0.85)'); g.fillStyle = gf; g.fillRect(0, 20.9 * m, W, H);
    return tex(c, true, true);
  })();
  // a date palm's frond: a rachis with leaflets angled toward the tip (alpha-tested)
  const frond = (() => {
    const [c, g] = cvs(64, 256), R = rng(5);
    for (let y = 250; y > 6; y -= 3.2) { const t = 1 - y / 256, len = 28 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) + 2;
      for (const sd of [-1, 1]) { const k = 0.8 + R() * 0.3; g.strokeStyle = `rgb(${(78 + R() * 30) * k | 0},${(104 + R() * 26) * k | 0},${(58 + R() * 18) * k | 0})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(32, y); g.lineTo(32 + sd * len, y - len * 0.75); g.stroke(); } }
    g.strokeStyle = '#7a6a3e'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 256); g.lineTo(32, 4); g.stroke();
    const t = tex(c, false); return t;
  })();
  // a palm trunk's old leaf bases: a diamond lattice
  const trunk = (() => {
    const [c, g] = cvs(64, 64); g.fillStyle = '#8a7258'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(50,36,24,0.55)'; g.lineWidth = 3;
    for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i * 32 + 64, 0); g.lineTo(i * 32, 64); g.stroke(); }
    return tex(c);
  })();
  // papyrus and reeds: stalks, umbels, blades (alpha-tested, on crossed quads)
  const papyrus = (() => {
    const [c, g] = cvs(256, 256), R = rng(9);
    for (let i = 0; i < 26; i++) { const x = 20 + R() * 216, b = 255 - R() * 10; g.strokeStyle = `rgb(${70 + R() * 30 | 0},${108 + R() * 30 | 0},${52 + R() * 16 | 0})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + R() * 30 - 15, 160, x + R() * 40 - 20, b - 150 - R() * 80); g.stroke(); }
    for (let i = 0; i < 18; i++) { const x = 24 + R() * 208, y = 30 + R() * 110, r = 10 + R() * 12;
      for (let k = 0; k < 26; k++) { const an = -Math.PI * (0.05 + 0.9 * R()); g.strokeStyle = `rgba(${120 + R() * 50 | 0},${140 + R() * 30 | 0},${60 + R() * 20 | 0},0.9)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + Math.cos(an) * r, y + 6 + Math.sin(an) * r * 0.9); g.stroke(); } }
    for (let i = 0; i < 40; i++) { const x = R() * 256; g.strokeStyle = `rgb(${88 + R() * 40 | 0},${110 + R() * 30 | 0},${56 + R() * 20 | 0})`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 256); g.quadraticCurveTo(x + 10, 220, x + R() * 40 - 20, 180 + R() * 40); g.stroke(); }
    return tex(c, false);
  })();
  // red granite, speckled: feldspar pink, black mica, grey quartz (the obelisks); 4 m a repeat
  const granite = (() => { const [c, g] = cvs(256, 256), R = rng(29); g.fillStyle = '#a77a6c'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const r = R(); g.fillStyle = r < 0.35 ? 'rgba(40,30,30,0.7)' : r < 0.6 ? 'rgba(190,180,175,0.6)' : 'rgba(150,90,74,0.7)'; g.fillRect(R() * 256, R() * 256, 1 + R() * 2.5, 1 + R() * 2.5); }
    return tex(c); })();
  return (TEX = { masonry, carved, relief, frond, trunk, papyrus, granite });
}
let MATS = null;
function materials() {
  if (MATS) return MATS;
  const T = textures();
  return (MATS = {
    // merged batches are double-sided (a face wound the wrong way still shows); instanced meshes take their
    // colour per instance, so their materials have no vertex colours (a missing colour attribute reads as black)
    stone: new THREE.MeshStandardMaterial({ map: T.masonry, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
    stoneI: new THREE.MeshStandardMaterial({ map: T.masonry, roughness: 0.92, metalness: 0 }),
    carved: new THREE.MeshStandardMaterial({ map: T.carved, vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    relief: new THREE.MeshStandardMaterial({ map: T.relief, vertexColors: true, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide }),
    plainI: new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 }),
    granite: new THREE.MeshStandardMaterial({ map: T.granite, vertexColors: true, roughness: 0.48, metalness: 0, side: THREE.DoubleSide }),
    heap: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
    frond: new THREE.MeshStandardMaterial({ map: T.frond, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.82 }),
    trunk: new THREE.MeshStandardMaterial({ map: T.trunk, roughness: 1 }),
    reed: new THREE.MeshStandardMaterial({ map: T.papyrus, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
  });
}
// a batch with uvs: quads get uvs from their position (vertical faces: along the bottom edge and up; flat faces: x
// and z), TILE metres a repeat
function ubatch() {
  const pos = [], col = [], uv = [];
  const put = (p, k, t) => { pos.push(p[0], p[1], p[2]); col.push(k[0], k[1], k[2]); uv.push(t[0], t[1]); };
  const tri = (a, b, c, k, ta = [0, 0], tb = [0, 0], tc = [0, 0]) => { put(a, k, ta); put(b, k, tb); put(c, k, tc); };
  const quadUV = (a, b, c, d, k, ta, tb, tc, td) => { tri(a, b, c, k, ta, tb, tc); tri(a, c, d, k, ta, tc, td); };
  const quad = (a, b, c, d, k, tile = TILE) => {
    const ex = d[0] - a[0], ez = d[2] - a[2], ey = d[1] - a[1], fx = b[0] - a[0], fy = b[1] - a[1], fz = b[2] - a[2];
    const ny = ez * fx - ex * fz, nl = Math.hypot(ey * fz - ez * fy, ny, ex * fy - ey * fx) || 1;
    let T;
    if (Math.abs(ny / nl) > 0.75) T = p => [p[0] / tile, p[2] / tile];
    else { const l = Math.hypot(ex, ez) || 1, tx = ex / l, tz = ez / l; T = p => [(p[0] * tx + p[2] * tz) / tile, p[1] / tile]; }
    quadUV(a, b, c, d, k, T(a), T(b), T(c), T(d));
  };
  const mesh = (mat, shadow = true) => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; return m;
  };
  return { tri, quad, quadUV, mesh, get n() { return pos.length; } };
}
// a box in an object's own frame: u across, v along (+ forward), y up from its foot; `tk` tapers the top toward the
// middle; faces on the ±v sides may go to another batch (`vb`, with `vt` its uv mapper for a relief: u, v in metres
// from the face's left and top)
function box3(B, P, u0, u1, v0, v1, y0, y1, k, { tk = 1, vb = null, vt = null, top = true, tile = TILE } = {}) {
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  const C = (u, v, y, t) => P(t ? uc + (u - uc) * tk : u, t ? vc + (v - vc) * tk : v, y);
  const cs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (let f = 0; f < 4; f++) {
    const p = cs[f], q = cs[(f + 1) % 4], kk = f % 2 ? k : k.map(x => x * 0.92);
    const a = C(...p, y0, 0), b = C(...p, y1, 1), c = C(...q, y1, 1), d = C(...q, y0, 0);
    if (vb && f % 2 === 0) {   // a ±v face: the relief, its uvs in metres from the face's left edge and its top
      const w = Math.hypot(d[0] - a[0], d[2] - a[2]), h = y1 - y0;
      vb.quadUV(a, b, c, d, kk, vt(0, h), vt(0, 0), vt(w, 0), vt(w, h));
    } else B.quad(a, b, c, d, kk, tile);
  }
  if (top) B.quad(C(u0, v0, y1, 1), C(u0, v1, y1, 1), C(u1, v1, y1, 1), C(u1, v0, y1, 1), k, tile);
}

/* ---------- shapes made once ---------- */
let SHAPES = null;
function shapes() {
  if (SHAPES) return SHAPES;
  const keep = g => { g.userData.keep = true; return g; };
  // a date palm's trunk: a slight taper, the leaf bases' lattice wrapped round it
  const trunk = new THREE.CylinderGeometry(0.62, 1, 1, 8, 4, true); trunk.translate(0, 0.5, 0);
  { const uv = trunk.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 14); }
  // its crown (unit radius, the crown's heart at 0): an upper tier of fronds rising, a lower tier drooping, three
  // dead ones hanging; each frond a strip arched along its length
  const crown = (() => {
    const pos = [], uv = [], col = [], R = rng(3);
    const frond = (an, rise, droop, len, live) => {
      const c = Math.cos(an), s = Math.sin(an), N = 4, k = live ? [0.9 + R() * 0.2, 0.9 + R() * 0.2, 0.85 + R() * 0.2] : [1.25, 0.92, 0.62];
      const pts = []; for (let i = 0; i <= N; i++) { const t = i / N, r = t * len, y = rise * Math.sin(Math.PI * t * 0.6) - droop * t * t; pts.push([c * r, y, s * r, t]); }
      for (let i = 0; i < N; i++) { const [x0, y0, z0, t0] = pts[i], [x1, y1, z1, t1] = pts[i + 1], w0 = 0.26 * len * Math.pow(Math.sin(Math.PI * Math.min(1, t0 * 1.1 + 0.05)), 0.7), w1 = 0.26 * len * Math.pow(Math.sin(Math.PI * Math.min(1, t1 * 1.1 + 0.05)), 0.7);
        const px = -s, pz = c, tilt = 0.25;
        const A = [x0 - px * w0, y0 + tilt * w0, z0 - pz * w0], B = [x0 + px * w0, y0 + tilt * w0, z0 + pz * w0], C = [x1 + px * w1, y1 + tilt * w1, z1 + pz * w1], D = [x1 - px * w1, y1 + tilt * w1, z1 - pz * w1];
        for (const [p, u, v] of [[A, 0, t0], [B, 1, t0], [C, 1, t1], [A, 0, t0], [C, 1, t1], [D, 0, t1]]) { pos.push(...p); uv.push(u, v); col.push(...k); } }
    };
    for (let i = 0; i < 9; i++) frond(i / 9 * 6.283 + R() * 0.3, 0.42, 0.55, 1, true);
    for (let i = 0; i < 7; i++) frond((i + 0.5) / 7 * 6.283 + R() * 0.3, 0.12, 1.1, 0.96, true);
    for (let i = 0; i < 2; i++) frond(R() * 6.283, -0.1, 1.5, 0.7, false);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    return g;
  })();
  // papyrus and reeds: two crossed quads, 1 m across and 1 m tall (scaled per clump)
  const reed = (() => { const a = new THREE.PlaneGeometry(1, 1); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(Math.PI / 2); const c = a.clone(); c.rotateY(Math.PI / 4);
    const g = new THREE.BufferGeometry(), parts = [a, b, c], P = [], UV = [];
    for (const q of parts) { const ix = q.index.array; for (const i of ix) { P.push(q.attributes.position.getX(i), q.attributes.position.getY(i), q.attributes.position.getZ(i)); UV.push(q.attributes.uv.getX(i), q.attributes.uv.getY(i)); } }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeVertexNormals(); return g; })();
  // a tamarisk: a lumpy feathery mound (unit radius)
  const bush = (() => { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, R = rng(17);
    for (let i = 0; i < p.count; i++) { const k = 0.75 + 0.35 * R(); p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i)) * k * 0.9 + 0.2, p.getZ(i) * k); }
    g.computeVertexNormals(); return g; })();
  // an acacia's flat umbrella crown (unit radius) and a trunk
  const umbrella = (() => { const g = new THREE.SphereGeometry(1, 12, 6), p = g.attributes.position, R = rng(19);
    for (let i = 0; i < p.count; i++) { const k = 0.85 + 0.25 * R(); p.setXYZ(i, p.getX(i) * k, p.getY(i) * 0.2 * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
  const stick = new THREE.CylinderGeometry(0.12, 0.2, 1, 5); stick.translate(0, 0.5, 0);
  // a column drum lying on its side (unit radius and length), a block, a casing stone (a wedge)
  const drum = new THREE.CylinderGeometry(1, 1, 1, 14); drum.rotateZ(Math.PI / 2);
  const blk = new THREE.BoxGeometry(1, 1, 1);
  const wedge = (() => { const s = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.5, 1)]); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
  // a papyrus column (Karnak's side columns, about 13 m): a round base, the shaft narrowing at its foot and its
  // top, a closed bud capital, an abacus; and a broken shaft (unit height)
  const column = (() => { const pts = [[1.75, 0], [1.75, 0.45], [1.25, 0.55], [1.38, 1.6], [1.4, 9.3], [1.2, 9.9], [1.55, 10.8], [1.5, 11.5], [1.05, 12.1], [1.1, 12.2], [1.1, 13]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 14); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.1, uv.getY(i) * 1.6); return g; })();
  const shaft = (() => { const g = new THREE.CylinderGeometry(1.36, 1.38, 1, 14, 1, false); g.translate(0, 0.5, 0); return g; })();
  // a wading bird (egret, ibis, heron: about 1 m tall), and one flying
  const bird = (() => { const B = new THREE.BufferGeometry(), parts = [];
    const body = new THREE.SphereGeometry(0.22, 6, 4); body.scale(1, 0.7, 1.7); body.translate(0, 0.72, 0); parts.push(body);
    const neck = new THREE.CylinderGeometry(0.04, 0.05, 0.45, 4); neck.rotateX(-0.35); neck.translate(0, 1.0, 0.28); parts.push(neck);
    const head = new THREE.SphereGeometry(0.07, 5, 3); head.scale(1, 1, 2.6); head.translate(0, 1.22, 0.42); parts.push(head);
    for (const x of [-0.06, 0.06]) { const l = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 3); l.translate(x, 0.3, 0); parts.push(l); }
    return merge(parts); })();
  const flyer = (() => { const parts = [], body = new THREE.SphereGeometry(0.2, 6, 4); body.scale(1, 0.7, 2.2); parts.push(body);
    for (const sd of [-1, 1]) { const w = new THREE.BoxGeometry(0.75, 0.03, 0.32); w.translate(sd * 0.45, 0.04, 0); w.rotateZ(sd * 0.18); parts.push(w); }
    return merge(parts); })();
  return (SHAPES = { trunk: keep(trunk), crown: keep(crown), reed: keep(reed), bush: keep(bush), umbrella: keep(umbrella), stick: keep(stick), drum: keep(drum), blk: keep(blk), wedge: keep(wedge), column: keep(column), shaft: keep(shaft), bird: keep(bird), flyer: keep(flyer) });
}
function merge(parts) {   // non-indexed merge of simple geometries (position and normal only)
  const P = [], N = [];
  for (const g0 of parts) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); return g;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildKingdom(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes(), M = materials();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const near = (X, Z, d) => { const [x, z] = L(X, Z); return Math.hypot(x - cx, z - cz) < d; };
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const R = rng(hi * 977 + 13), anims = [];
  // an object's frame: P(u, v, y) with u across, v along its bearing `rot` (compass, + forward), y up from `base`
  const frame = (X, Z, base, rot) => { const [x, z] = L(X, Z), r = rot - a, ux = Math.cos(r), uz = Math.sin(r), vx = Math.sin(r), vz = -Math.cos(r), y0 = LY(base);
    return (u, v, y) => [x + ux * u + vx * v, y0 + y, z + uz * u + vz * v]; };

  // ---- the site from the 10 m map: this hole's field where it has one (so the edges meet the playfield), drawn
  // in the ground shader (aW: x fields, y masonry, w rock)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 4 ? 1 : m === 10 ? 0.5 : 0, m === 3 ? 1 : 0, 0, m === 2 ? 1 : 0];
  const split = (Vt, idx, k, k1, k2, k3) => { if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k2, k3, k, k3, k1); else idx.push(k, k2, k1, k1, k2, k3); };
  {
    const st = coarse ? 2 : 1, ni = Math.floor((WM.nx - 1) / st), nj = Math.floor((WM.nz - 1) / st);
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)); const m = WM.mDec[J * WM.nx + I], wet = m === 8;
      if (inField(x, z) && !wet) { const g = T.groundAt(x, z); if (g !== null) y = g; }
      Vt.set([x, wet ? y - 0.9 : y - 0.3, z], k * 3); Wt.set(wOf(m), k * 4);
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if ([k, k1, k2, k3].every(q => inPlay(Vt[q * 3], Vt[q * 3 + 2]))) continue;
      split(Vt, idx, k, k1, k2, k3);
    }
    group.add(groundMesh(Vt, Wt, idx));
  }
  // ---- out past it: the river plain and the far bank, the dune sea, the cliffs, from the 60 m map
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); FM.mDec = dec(FM.m, Uint8Array); }
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 40, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 40, iz0 = WM.z0 + 40, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 40;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = FM.mDec[J * FM.nx + I];
      Vt.set([x, LY(FM.hDec[J * FM.nx + I] / FM.scale + FM.y0) - (m === 8 ? 1.6 : 0.8), z], k * 3); Wx.set([X, Z], k * 2); Wt.set(wOf(m), k * 4);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; split(Vt, idx, k, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }

  // ---- the river and the boat basin: one sheet at their level, slow and opaque, brown-green, mirroring the sky
  // as it goes off toward the far bank
  {
    const g = new THREE.PlaneGeometry(17000, 17000); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a4a34, roughness: 0.3, metalness: 0, envMapIntensity: 0.7 }));
    const [x, z] = L(1000, 0); m.position.set(x, LY(E.level) - 0.04, z); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }

  const Bs = ubatch(), Br = ubatch(), Bp = ubatch(), Bg = ubatch(), Bc = ubatch();   // stone, relief, plain, granite, carved
  const stone = lin([206, 182, 140]), stoneL = lin([222, 204, 168]), stoneD = lin([184, 160, 120]), casing = lin([226, 216, 194]);
  const granite = lin([150, 130, 124]), quartz = lin([178, 152, 126]), canvas = lin([226, 216, 192]), wood = lin([122, 96, 66]), iron = lin([70, 64, 58]), dark = lin([26, 20, 16]);
  const RELIEF_W = 12, RELIEF_H = 24, rtop = (top) => (u, v) => [u / RELIEF_W, 1 - (v) / RELIEF_H];   // uvs on a relief face from its top
  // ---- the pyramids: the stepped core in courses, the great one's top third still cased in white with a ragged
  // lower edge, the casing standing a little proud of the core
  for (const P of E.pyramids) {
    if (!near(P.c[0], P.c[1], 6000)) continue;
    const hf = P.half * 1.02 + 2.5, top = P.y + P.h + 3.2, yb = P.y - 3;
    const C = (sx, sz, t, out = 0) => { const [x, z] = L(P.c[0] + sx * (hf + out) * (1 - t), P.c[1] + sz * (hf + out) * (1 - t)); return [x, LY(yb + (top - yb) * t + out * 0.3), z]; };
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]], tc = P.cased || 1;
    for (let f = 0; f < 4; f++) {
      const p = cs[f], q = cs[(f + 1) % 4];
      const wl = 2 * hf, h0 = 0, h1 = (top - yb) * Math.min(1, tc + 0.03);
      // the core: v in courses up the face (1 m), u along the base
      const tA = [0, LY(yb) / TILE], tD = [wl / TILE, LY(yb) / TILE], tB = [wl * 0.5 * (1 - Math.min(1, tc + 0.03)) / TILE, (LY(yb) + h1) / TILE], tC = [wl * (1 - 0.5 * (1 - Math.min(1, tc + 0.03))) / TILE, (LY(yb) + h1) / TILE];
      Bs.quadUV(C(...p, 0), C(...p, Math.min(1, tc + 0.03)), C(...q, Math.min(1, tc + 0.03)), C(...q, 0), f % 2 ? stone : stoneD, tA, tB, tC, tD);
      if (tc < 1) {   // the casing: a fan from the apex to a ragged edge
        const N = 14, Rp = rng(f * 31 + Math.round(P.c[0]));
        const edge = []; for (let i = 0; i <= N; i++) { const u = i / N, t = tc - (i === 0 || i === N ? 0.0 : 0.012 + 0.03 * Rp() * Rp()); edge.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u, t]); }
        const apex = C(0, 0, 1, 0.6), k = f % 2 ? casing : casing.map(x => x * 0.93);
        for (let i = 0; i < N; i++) Bp.tri(C(edge[i][0], edge[i][1], edge[i][2], 0.6), apex, C(edge[i + 1][0], edge[i + 1][1], edge[i + 1][2], 0.6), k);
      }
    }
  }
  // ---- the built things
  const pieces = E.built.filter(S => S.kind === 'piece');
  for (const S of E.built) {
    const [X, Z] = S.at;
    if (!near(X, Z, 3200)) continue;
    const Pf = frame(X, Z, S.y, S.rot), w2 = S.w / 2, l2 = S.l / 2;
    if (S.kind === 'tower' || (S.kind === 'box' && S.name === 'the valley temple')) {
      // a pylon (tower): battered 1 in 8, a torus roll up the corners, a cavetto cornice; relief on its broad faces
      const h = S.h, tk = 1 - 2 * (h / 8) / Math.max(S.w, S.l) * 0.5, tkU = 1 - (h / 8) / S.w, tkV = 1 - (h / 8) / S.l;
      const Pt = (u, v, y) => Pf(u * (1 - (1 - tkU) * y / h), v * (1 - (1 - tkV) * y / h), y);
      box3(Bs, Pt, -w2, w2, -l2, l2, 0, h - 1.6, stone, { vb: Br, vt: (u, v) => [u / RELIEF_W, 1 - (v + 1.6) / RELIEF_H], top: false });
      const wT = w2 * (1 - (1 - tkU) * (h - 1.6) / h), lT = l2 * (1 - (1 - tkV) * (h - 1.6) / h);
      box3(Bs, Pf, -wT - 0.9, wT + 0.9, -lT - 0.9, lT + 0.9, h - 1.6, h - 0.35, stoneL, { tk: 1.0 });   // the cornice's flare
      box3(Bs, Pf, -wT - 0.9, wT + 0.9, -lT - 0.9, lT + 0.9, h - 0.35, h, stone);
      // the flagstaff recesses on the front, two dark slots
      if (S.kind === 'tower') for (const u of [-w2 * 0.42, w2 * 0.42]) { const v = -l2 * (1 - (1 - tkV) * 0.25) - 0.06; Bp.quad(Pf(u - 0.3, v, 0.3), Pf(u - 0.3, v, h * 0.7), Pf(u + 0.3, v, h * 0.7), Pf(u + 0.3, v, 0.3), lin([120, 100, 76])); }
    } else if (S.kind === 'box' && S.name === 'the cliff temple') {
      // a rock-cut front: the relief across it, a cornice, a great dark doorway in the middle facing the colossi
      box3(Bs, Pf, -w2, w2, -l2, l2, 0, S.h - 2, stone, { vb: Br, vt: (u, v) => [u / RELIEF_W, 1 - (v * 0.8 + 2) / RELIEF_H], top: false });
      box3(Bs, Pf, -w2 - 1.2, w2 + 1.2, -l2 - 1.2, l2 + 0.2, S.h - 2, S.h, stoneL);
      Bp.quad(Pf(-3.5, -l2 - 0.08, 0), Pf(-3.5, -l2 - 0.08, 12), Pf(3.5, -l2 - 0.08, 12), Pf(3.5, -l2 - 0.08, 0), dark);
      box3(Bs, Pf, -5, 5, -l2 - 0.6, -l2, 12, 13.4, stoneL);   // the lintel
    } else if (S.kind === 'colossus') {
      // a seated king on his throne, the face worn away; + v forward
      const Pc = (u, v, y) => Pf(u * S.w / 9, v * S.l / 12, y * S.h / 30), k = quartz, k2 = quartz.map(x => x * 0.9);
      box3(Bs, Pc, -4.6, 4.6, -6.2, 6.2, 0, 3.4, stoneD);                         // the plinth
      { const Bs = { quad: (a, b, c, d, k) => Bc.quad(a, b, c, d, k, 26), quadUV: Bc.quadUV, tri: Bc.tri };
      box3(Bs, Pc, -4.2, 4.2, -6, -0.6, 3.4, 17, k);                              // the throne
      for (const sd of [-1, 1]) {
        box3(Bs, Pc, sd > 0 ? 0.3 : -3.4, sd > 0 ? 3.4 : -0.3, 2.6, 5.0, 3.4, 12.6, k2);   // shins
        box3(Bs, Pc, sd > 0 ? 0.3 : -3.4, sd > 0 ? 3.4 : -0.3, -1.4, 5.0, 10.6, 13.4, k);  // thighs
        box3(Bs, Pc, sd > 0 ? 0.4 : -3.3, sd > 0 ? 3.3 : -0.4, 4.4, 6.0, 3.4, 4.6, k2);    // feet
        box3(Bs, Pc, sd > 0 ? 2.9 : -4.1, sd > 0 ? 4.1 : -2.9, -1.0, 4.6, 13.4, 14.6, k);  // forearms on the knees
        box3(Bs, Pc, sd > 0 ? 3.4 : -4.4, sd > 0 ? 4.4 : -3.4, -2.6, -0.4, 14.2, 21.2, k2); // upper arms
      }
      box3(Bs, Pc, -3.4, 3.4, -3.6, 0.6, 13.4, 22.6, k, { tk: 1.12 });            // the torso, broad shoulders
      box3(Bs, Pc, -2.7, 2.7, -1.6, 0.5, 19.4, 24.6, k2, { tk: 0.8 });             // the headcloth's lappets
      box3(Bs, Pc, -1.7, 1.7, -2.6, 0.9, 22.4, 26.6, k, { tk: 0.92 });             // the head, worn
      box3(Bs, Pc, -2.4, 2.4, -3.2, 0.4, 24.2, 27.4, k2, { tk: 0.7 });             // the headcloth over it
      box3(Bs, Pc, -1.0, 1.0, -2.0, 0.0, 27.4, 30, k, { tk: 0.55 });               // the stump of a crown
      }
    } else if (S.kind === 'head') {
      // the Sphinx's head over its chest, facing the tee: the headcloth's lappets falling behind the face to the
      // shoulders, the face worn and the nose gone, the cloth's top in two steps, the cobra's stump on the brow
      const Ph = (u, v, y) => Pf(-u * S.w / 13, -v * S.l / 14, y * S.h / 15), k = stone, k2 = stoneD, kl = stoneL;   // turned half round (not mirrored)
      box3(Bc, Ph, -6.0, 6.0, -6.0, 2.0, 0, 5.5, k2, { tk: 0.92 });               // the chest and shoulders under the head
      for (const sd of [-1, 1]) box3(Bc, Ph, sd > 0 ? 3.0 : -6.4, sd > 0 ? 6.4 : -3.0, -2.6, 1.4, 2.5, 10.8, k, { tk: 0.62 });   // a lappet, flaring to the shoulder
      box3(Bc, Ph, -3.4, 3.4, -1.0, 4.4, 4.2, 11.8, kl, { tk: 0.92 });            // the face
      box3(Bc, Ph, -0.9, 0.9, 4.2, 5.0, 7.0, 9.0, k2, { tk: 0.8 });               // what is left of the nose
      box3(Bc, Ph, -2.0, 2.0, 3.6, 4.6, 4.2, 5.4, k2);                            // the chin
      box3(Bc, Ph, -4.8, 4.8, -5.4, 2.0, 10.2, 12.8, k, { tk: 0.86 });            // the headcloth's band
      box3(Bc, Ph, -4.1, 4.1, -5.0, 1.6, 12.8, 14.6, k2, { tk: 0.7 });            // its top
      box3(Bc, Ph, -0.55, 0.55, 1.6, 2.5, 11.6, 13.4, k2);                        // the cobra's stump
      // paws stretched out in front of the chest (drawn only, short of the green)
      for (const sd of [-1, 1]) { box3(Bc, Ph, sd > 0 ? 3.2 : -8.4, sd > 0 ? 8.4 : -3.2, 4, 11, -8.6, -6.4, k2, { tk: 0.86 }); }
    } else if (S.kind === 'piece' || S.kind === 'obelisk') {
      box3(Bg, Pf, -w2, w2, -l2, l2, 0, S.h, granite, { tk: 0.94, tile: 4 });
      if (S.kind === 'piece' && S.w === Math.min(...pieces.map(q => q.w))) {   // the pyramidion on the obelisk's top piece
        const cxp = pieces.reduce((s, q) => s + q.at[0], 0) / pieces.length, czp = pieces.reduce((s, q) => s + q.at[1], 0) / pieces.length;
        const fwd = Math.sign((X - cxp) * Math.sin(S.rot) + -(Z - czp) * Math.cos(S.rot)) || 1, e = fwd * l2, tip = Pf(0, e + fwd * 2.2, S.h / 2);
        const cs = [[-w2, 0], [w2, 0], [w2, S.h], [-w2, S.h]].map(([u, y]) => Pf(u * 0.94, e, y));
        for (let i = 0; i < 4; i++) Bg.tri(cs[i], fwd > 0 ? cs[(i + 1) % 4] : tip, fwd > 0 ? tip : cs[(i + 1) % 4], granite.map(x => x * 1.08));
      }
    } else if (S.kind === 'tent') {
      if (S.awning) {   // an awning on poles
        for (const [u, v] of [[-w2, -l2], [w2, -l2], [w2, l2], [-w2, l2]]) box3(Bp, Pf, u - 0.08, u + 0.08, v - 0.08, v + 0.08, 0, S.h, wood);
        Bp.quad(Pf(-w2 - 0.4, -l2 - 0.4, S.h), Pf(-w2 - 0.4, l2 + 0.4, S.h + 0.4), Pf(w2 + 0.4, l2 + 0.4, S.h + 0.4), Pf(w2 + 0.4, -l2 - 0.4, S.h), canvas);
        Bp.quad(Pf(w2 + 0.4, -l2 - 0.4, S.h), Pf(w2 + 0.4, l2 + 0.4, S.h + 0.4), Pf(-w2 - 0.4, l2 + 0.4, S.h + 0.4), Pf(-w2 - 0.4, -l2 - 0.4, S.h), canvas.map(x => x * 0.8));
        for (let i = 0; i < 3; i++) box3(Bp, Pf, -2.4 + i * 1.6, -1.4 + i * 1.6, -1, 0.6, 0, 0.8, wood);   // a table and crates under it
      } else {          // a ridge tent: low walls, a sloped roof, a dark door flap
        const wall = 1.3, h = S.h, P = Pf, k = canvas, kd = canvas.map(x => x * 0.84);
        Bp.quad(P(-w2, -l2, 0), P(-w2, -l2, wall), P(-w2, l2, wall), P(-w2, l2, 0), kd); Bp.quad(P(w2, l2, 0), P(w2, l2, wall), P(w2, -l2, wall), P(w2, -l2, 0), kd);
        Bp.quad(P(-w2, -l2, wall), P(0, -l2, h), P(0, l2, h), P(-w2, l2, wall), k); Bp.quad(P(w2, l2, wall), P(0, l2, h), P(0, -l2, h), P(w2, -l2, wall), k.map(x => x * 0.9));
        for (const v of [-l2, l2]) { const s = v < 0 ? 1 : -1; Bp.quad(P(-w2 * s, v, 0), P(-w2 * s, v, wall), P(0, v, h), P(0, v, 0), kd); Bp.quad(P(0, v, 0), P(0, v, h), P(w2 * s, v, wall), P(w2 * s, v, 0), kd); }
        Bp.quad(P(-0.6, -l2 - 0.05, 0), P(-0.6, -l2 - 0.05, h * 0.75), P(0.6, -l2 - 0.05, h * 0.75), P(0.6, -l2 - 0.05, 0), dark.map(x => x * 3));
      }
    } else if (S.kind === 'box' && S.name === 'the jetty') {
      box3(Bs, Pf, -w2, w2, -l2, l2, -2.5, S.h, stoneD);
    } else box3(Bs, Pf, -w2, w2, -l2, l2, 0, S.h, S.h > 12 ? stone : stoneD, { tk: S.h > 8 ? 0.96 : 1 });
  }
  // the Sphinx's body: a skin of carved strata just over the ground's own shape (the ball plays on that), a haunch
  // at the back, the tail curled along the right flank
  if (E.sphinx && near(E.sphinx.c[0], E.sphinx.c[1], 3000)) {
    const B = E.sphinx, d = B.dir, NA = 40, NC = 14, Pt = (aa, cc, y) => { const [x, z] = L(B.c[0] + d[0] * aa - d[1] * cc, B.c[1] + d[1] * aa + d[0] * cc); return [x, LY(B.y) + y, z]; };
    const hAt = (aa, cc) => { const e = Math.pow(Math.pow(Math.abs(aa) / B.along, 5) + Math.pow(Math.abs(cc) / B.across, 5), 0.2); if (e >= 1) return -0.6;
      const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t), haunch = 1.4 * Math.exp(-((aa - B.along * 0.62) ** 2) / 90) * Math.exp(-((Math.abs(cc) - 6) ** 2) / 30);
      return B.h * (0.7 + 0.3 * sm(0.5 - aa / (2 * B.along))) * Math.pow(1 - Math.pow(e, 5), 0.5) + 0.35 + haunch; };
    const grid = []; for (let i = 0; i <= NA; i++) { const row = []; for (let j = 0; j <= NC; j++) { const aa = -B.along * 1.02 + i / NA * B.along * 2.04, cc = -B.across * 1.04 + j / NC * B.across * 2.08; row.push(Pt(aa, cc, hAt(aa, cc))); } grid.push(row); }
    for (let i = 0; i < NA; i++) for (let j = 0; j < NC; j++) Bc.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j], stone);
    for (let i = 0; i < 14; i++) { const t = i / 14, aa = B.along * (0.85 - t * 1.1), cc = B.across * 0.98, y = hAt(aa, B.across * 0.8) * (0.25 + 0.1 * Math.sin(t * 3)); box3(Bc, (u, v, yy) => Pt(aa + v, cc + u, y + yy), -0.6, 0.6, -2.6, 2.6, 0, 1.0, stoneD); }
  }
  // the papyrus columns standing in the valley temple's court, some broken
  if (E.columns) {
    const full = E.columns.filter(c => c[3] >= 12.9 && near(c[0], c[1], 2500)), brk = E.columns.filter(c => c[3] < 12.9 && near(c[0], c[1], 2500)), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const mk = (geo, list, sy) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, M.stoneI, list.length); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach(([X, Z, y, h], i) => { const [x, z] = L(X, Z); m.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, footY(x, z, LY(y)) - 0.4, z), Q.setFromAxisAngle(up, X * 0.3), new THREE.Vector3(1, sy(h), 1))); m.setColorAt(i, new THREE.Color().setRGB(...stone)); });
      m.castShadow = m.receiveShadow = true; group.add(m); };
    mk(S.column, full, () => 1); mk(S.shaft, brk, h => h);
  }
  // ruin litter: column drums, blocks, fallen casing, two toppled heads half sunk in the sand
  if (E.litter) {
    const byK = { drum: [], block: [], casing: [] }, Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler();
    for (const q of E.litter) { if (!near(q.at[0], q.at[1], 2200)) continue;
      if (q.k === 'head') {   // a colossal head on its side in the sand
        const Ph = frame(q.at[0], q.at[1], q.y - 1.2, q.rot), Pr = (u, v, y) => Ph(y - 2.4, v, 2.6 - u);   // turned on its side
        box3(Bs, Pr, -2.6, 2.6, -1.6, 0.6, 0, 3.6, quartz, { tk: 0.8 }); box3(Bs, Pr, -1.6, 1.6, -2.4, 0.9, 1.2, 5.0, quartz.map(x => x * 0.92), { tk: 0.9 }); box3(Bs, Pr, -2.2, 2.2, -2.9, 0.4, 3.4, 5.8, quartz, { tk: 0.7 });
        continue; }
      byK[q.k]?.push(q); }
    const mk = (geo, list, mat, sc, col) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3);
      list.forEach((q, i) => { const [x, z] = L(q.at[0], q.at[1]), [sx, sy, sz, dy, tilt] = sc(q); m.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, footY(x, z, LY(q.y)) + dy, z), Q.setFromEuler(e.set(tilt, q.rot - a, tilt * 0.6)), new THREE.Vector3(sx, sy, sz))); const t = 0.88 + 0.2 * q.t; m.setColorAt(i, new THREE.Color().setRGB(col[0] * t, col[1] * t, col[2] * t)); });
      m.castShadow = m.receiveShadow = true; group.add(m); };
    mk(S.drum, byK.drum, M.stoneI, q => [1.2 * q.s, 1.25 * q.s, 1.25 * q.s, 0.7 * q.s, 0], stone);
    mk(S.blk, byK.block, M.stoneI, q => [1.4 + 1.4 * q.s * q.t, 0.9 + 0.6 * q.s, 1.1 + q.s, 0.2, (q.t - 0.5) * 0.3], stone);
    mk(S.wedge, byK.casing, M.stoneI, q => [1.6 * q.s, 1.4 * q.s, 1.2 * q.s, -0.25, (q.t - 0.5) * 0.4], casing);
  }
  // talus at the foot of the wadi's walls: blocks fallen from the beds, half bedded in the sand
  if (E.talus) { const list = E.talus.filter(q => near(q[0], q[1], 2000));
    if (list.length) { const m = new THREE.InstancedMesh(S.blk, M.stoneI, list.length), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler();
      list.forEach(([X, Z, y, s, r], i) => { const [x, z] = L(X, Z); m.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, footY(x, z, LY(y)) + s * 0.25, z), Q.setFromEuler(e.set(r * 0.13, r, r * 0.07)), new THREE.Vector3(s * 1.5, s, s * 1.2)));
        const t = 0.82 + ((X * 3.7 + Z) % 1 + 1) % 1 * 0.3; m.setColorAt(i, new THREE.Color().setRGB(...lin([176 * t, 140 * t, 98 * t]))); });
      m.castShadow = m.receiveShadow = true; group.add(m); } }
  // the basin's quay wall where it isn't the beach, with a coping
  if (E.quay && near(E.quay[0][0], E.quay[0][1], 2500)) {
    for (let i = 0; i < E.quay.length - 1; i++) { const A = E.quay[i], B = E.quay[i + 1]; if (!A[3] || !B[3]) continue;
      const [ax, az] = L(A[0], A[1]), [bx, bz] = L(B[0], B[1]), y0 = LY(E.level) - 3, ta = LY(A[2]) + 0.12, tb = LY(B[2]) + 0.12;
      Bs.quad([ax, y0, az], [ax, ta, az], [bx, tb, bz], [bx, y0, bz], stoneD);
      const ox = (A[0] - E.basin.c[0]), oz = (A[1] - E.basin.c[1]), ol = Math.hypot(ox, oz) || 1, [px, pz] = L(A[0] + ox / ol * 1.2, A[1] + oz / ol * 1.2), [qx, qz] = L(B[0] + ox / ol * 1.2, B[1] + oz / ol * 1.2);
      Bs.quad([ax, ta, az], [px, ta, pz], [qx, tb, qz], [bx, tb, bz], stoneL); }
  }
  // rock-cut tomb doors in the wadi's walls: a dressed frame, a dark doorway
  for (const [X, Z, y, rot] of E.doors || []) { if (!near(X, Z, 2600)) continue;
    const Pd = frame(X, Z, y, rot); box3(Bc, Pd, -2.2, 2.2, -2.5, 0.1, -0.6, 5.0, lin([176, 140, 98]), { tk: 0.96 }); Bp.quad(Pd(-1.1, 0.14, 0), Pd(-1.1, 0.14, 3.2), Pd(1.1, 0.14, 3.2), Pd(1.1, 0.14, 0), lin([46, 34, 24])); }
  // the expedition dig: the spoil rail and its tip carts, the spoil heap, crates, survey flags, ladders against
  // the second colossus
  if (E.camp && near(E.camp.heap[0], E.camp.heap[1], 2600)) {
    const C = E.camp, rail = C.rail;
    const along = t => { const segs = []; let tot = 0; for (let i = 1; i < rail.length; i++) { const l = Math.hypot(rail[i][0] - rail[i - 1][0], rail[i][1] - rail[i - 1][1]); segs.push(l); tot += l; }
      let d = t * tot; for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const u = d / segs[i], A = rail[i], B = rail[i + 1]; return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u, Math.atan2(B[0] - A[0], -(B[1] - A[1]))]; } d -= segs[i]; } };
    for (let t = 0; t <= 1.0001; t += 0.025) { const [X, Z, y, rot] = along(t), Pr = frame(X, Z, y, rot); box3(Bp, Pr, -0.6, 0.6, -0.12, 0.12, 0, 0.12, wood); if (t < 0.99) for (const u of [-0.31, 0.31]) box3(Bp, Pr, u - 0.03, u + 0.03, 0, 1.2, 0.12, 0.2, iron); }
    for (const t of C.carts) { const [X, Z, y, rot] = along(t), Pc = frame(X, Z, y + 0.2, rot); box3(Bp, Pc, -0.4, 0.4, -0.6, 0.6, 0, 0.35, iron); box3(Bp, Pc, -0.55, 0.55, -0.75, 0.75, 0.35, 1.1, iron.map(x => x * 1.3), { tk: 1.25 }); }
    { const [X, Z, y] = C.heap, [x, z] = L(X, Z), g = new THREE.ConeGeometry(14, 7, 16, 3), p = g.attributes.position, Rh = rng(41);
      for (let i = 0; i < p.count; i++) { const k = p.getY(i) > 3.4 ? 1 : 0.85 + 0.3 * Rh(); p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + 0.3 * Rh()), p.getZ(i) * k); } g.computeVertexNormals();
      const col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) col.set(lin([212 - Rh() * 30, 196 - Rh() * 30, 160 - Rh() * 26]), i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, M.heap); m.position.set(x, footY(x, z, LY(y)) + 2.2, z); m.castShadow = m.receiveShadow = true; group.add(m); }
    for (const [X, Z, y, rot, n] of C.crates) { const Pc = frame(X, Z, y, rot); for (let i = 0; i < n; i++) box3(Bp, Pc, -0.5 + i * 0.15, 0.5 + i * 0.15, -0.4 + (i % 2) * 0.9, 0.4 + (i % 2) * 0.9, i > 1 ? 0.8 : 0, i > 1 ? 1.6 : 0.8, wood.map(x => x * (1.1 - 0.1 * i))); }
    for (const [X, Z, y] of C.flags) { const Pf2 = frame(X, Z, y, 0); for (let i = 0; i < 6; i++) box3(Bp, Pf2, -0.04, 0.04, -0.04, 0.04, i * 0.5, i * 0.5 + 0.5, i % 2 ? lin([236, 232, 222]) : lin([176, 46, 36]));
      Bp.quad(Pf2(0, 0, 2.4), Pf2(0, 0, 3.0), Pf2(0.8, 0, 2.85), Pf2(0.8, 0, 2.55), lin([196, 54, 40])); Bp.quad(Pf2(0.8, 0, 2.55), Pf2(0.8, 0, 2.85), Pf2(0, 0, 3.0), Pf2(0, 0, 2.4), lin([196, 54, 40])); }
    if (C.ladder) { const Pl = frame(C.ladder.at[0], C.ladder.at[1], C.ladder.y + 3.4, C.ladder.rot); for (const [u0, lh] of [[-1.6, 11], [1.4, 8]]) {
      for (const u of [u0 - 0.25, u0 + 0.25]) { const a1 = Pl(u, -2.2, 0), b1 = Pl(u, 0.2, lh); box3(Bp, (uu, vv, yy) => [a1[0] + (b1[0] - a1[0]) * yy / lh + uu, a1[1] + yy, a1[2] + (b1[2] - a1[2]) * yy / lh + vv], -0.05, 0.05, -0.05, 0.05, 0, lh, wood); }
      for (let r = 0.4; r < lh; r += 0.45) { const t = r / lh; Bp.quad(Pl(u0 - 0.25, -2.2 + 2.4 * t, r), Pl(u0 - 0.25, -2.2 + 2.4 * t, r + 0.06), Pl(u0 + 0.25, -2.2 + 2.4 * t, r + 0.06), Pl(u0 + 0.25, -2.2 + 2.4 * t, r), wood); } } }
  }
  for (const [B, mat] of [[Bs, M.stone], [Br, M.relief], [Bp, M.plain], [Bg, M.granite], [Bc, M.carved]]) { const m = B.mesh(mat); if (m) group.add(m); }

  // ---- the date palms: a lattice trunk with a little lean, a crown of fronds, suckers at the foot of some;
  // doum palms (forked, fan crowns) here and there in the far groves
  {
    const far = coarse ? 1100 : 1700, list = [];
    for (const [X, Z, y, r, h] of E.palms) { const [x, z] = L(X, Z); if (Math.hypot(x - cx, z - cz) > far) continue; list.push([x, footY(x, z, LY(y)), z, r, h]); }
    if (list.length) {
      const nS = list.filter((_, i) => i % 5 < 2).length;
      const tm = new THREE.InstancedMesh(S.trunk, M.trunk, list.length), cm = new THREE.InstancedMesh(S.crown, M.frond, list.length + nS);
      cm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((list.length + nS) * 3), 3);
      const Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler(); let k = list.length;
      list.forEach(([x, y, z, r, h], i) => {
        const Rp = rng(Math.round(x * 13 + z * 7) & 0xffff), lx = (Rp() - 0.5) * 0.12, lz = (Rp() - 0.5) * 0.12, H = h * 0.9;
        tm.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, y - 0.3, z), Q.setFromEuler(e.set(lx, 0, lz)), new THREE.Vector3(0.36, H, 0.36)));
        const top = new THREE.Vector3(0, H, 0).applyEuler(e.set(lx, 0, lz));
        cm.setMatrixAt(i, Mx.compose(new THREE.Vector3(x + top.x, y - 0.3 + top.y + 0.2, z + top.z), Q.setFromEuler(e.set(lx * 0.5, Rp() * 6.28, lz * 0.5)), new THREE.Vector3(r * 1.25, r * 1.1, r * 1.25)));
        const t = 0.85 + Rp() * 0.25; cm.setColorAt(i, new THREE.Color().setRGB(0.95 * t, 0.98 * t, 0.86 * t));
        if (i % 5 < 2) { const an = Rp() * 6.28; cm.setMatrixAt(k, Mx.compose(new THREE.Vector3(x + Math.cos(an) * 1.2, y + 0.9, z + Math.sin(an) * 1.2), Q.setFromEuler(e.set(0, an, 0)), new THREE.Vector3(r * 0.45, r * 0.55, r * 0.45))); cm.setColorAt(k, new THREE.Color().setRGB(0.95, 1.02, 0.85)); k++; }
      });
      tm.castShadow = cm.castShadow = true; tm.receiveShadow = cm.receiveShadow = true; group.add(tm, cm);
    }
    const Bd = ubatch();
    for (const [X, Z, y, h] of E.doums || []) { if (!near(X, Z, far)) continue; const [x, z] = L(X, Z), y0 = footY(x, z, LY(y)), Rd = rng(Math.round(X * 7 + Z));
      const seg = (p0, p1, r) => { const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], l = Math.hypot(...d); const P = (u, v, yy) => { const t = yy / l; return [p0[0] + d[0] * t + u, p0[1] + d[1] * t, p0[2] + d[2] * t + v]; }; box3(Bd, P, -r, r, -r, r, 0, l, lin([118, 104, 84]), { top: false }); };
      const fork = [x, y0 + h * 0.45, z]; seg([x, y0, z], fork, 0.3);
      for (let b = 0; b < 2 + (Rd() < 0.4 ? 1 : 0); b++) { const an = Rd() * 6.28, tip = [fork[0] + Math.cos(an) * h * 0.25, y0 + h * (0.9 + 0.2 * Rd()), fork[2] + Math.sin(an) * h * 0.25]; seg(fork, tip, 0.22);
        for (let f = 0; f < 12; f++) { const fa = f / 12 * 6.28, cx2 = tip[0], cz2 = tip[2]; const p0 = [cx2, tip[1], cz2], p1 = [cx2 + Math.cos(fa) * 2.2, tip[1] + 0.3 - 0.6 * Math.abs(Math.sin(fa)), cz2 + Math.sin(fa) * 2.2], p2 = [cx2 + Math.cos(fa + 0.26) * 2.2, tip[1] + 0.3 - 0.6 * Math.abs(Math.sin(fa + 0.26)), cz2 + Math.sin(fa + 0.26) * 2.2];
          Bd.tri(p0, p1, p2, lin([100, 116, 70])); Bd.tri(p0, p2, p1, lin([84, 100, 60])); } } }
    { const m = Bd.mesh(M.plain); if (m) group.add(m); }
  }
  // ---- papyrus and reeds along the river's bank and in its shallows; tamarisk thinning out on the sand past the
  // fields; acacias in the wadi
  const inst = (geo, mat, list, put) => { if (!list.length) return null; const m = new THREE.InstancedMesh(geo, mat, list.length), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler(), cols = [];
    list.forEach((q, i) => { const [p, rot, s, c] = put(q); m.setMatrixAt(i, Mx.compose(p, Q.setFromEuler(e.set(0, rot, 0)), s)); if (c) cols.push(c); });
    if (cols.length === list.length) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3), 3); cols.forEach((c, i) => m.setColorAt(i, c)); }
    m.castShadow = mat !== M.reed; m.receiveShadow = true; group.add(m); return m; };
  {
    const reeds = (E.reeds || []).filter(q => near(q[0], q[1], 1600));
    inst(S.reed, M.reed, reeds, ([X, Z, y, s, wet]) => { const [x, z] = L(X, Z), yy = wet ? LY(y) - 0.3 : footY(x, z, LY(y)) - 0.2, h = (wet ? 3.2 : 2.4) * s;
      return [new THREE.Vector3(x, yy, z), X * 1.7, new THREE.Vector3(h * 1.1, h, h * 1.1)]; });
    const tam = (E.tamarisk || []).filter(q => near(q[0], q[1], 1800));
    inst(S.bush, M.leaf, tam, ([X, Z, y, s]) => { const [x, z] = L(X, Z), t = 0.85 + ((X * 7.1 + Z) % 1 + 1) % 1 * 0.3; return [new THREE.Vector3(x, footY(x, z, LY(y)) - 0.3, z), X, new THREE.Vector3(s, s * 0.85, s), new THREE.Color().setRGB(...lin([112 * t, 116 * t, 76 * t]))]; });
    const ac = (E.acacias || []).filter(q => near(q[0], q[1], 2000));
    inst(S.stick, M.plainI, ac, ([X, Z, y, h]) => { const [x, z] = L(X, Z); return [new THREE.Vector3(x, footY(x, z, LY(y)) - 0.2, z), 0, new THREE.Vector3(1.4, h * 0.85, 1.4), new THREE.Color().setRGB(...lin([110, 92, 72]))]; });
    inst(S.umbrella, M.leaf, ac, ([X, Z, y, h]) => { const [x, z] = L(X, Z); return [new THREE.Vector3(x, footY(x, z, LY(y)) + h * 0.85, z), X, new THREE.Vector3(h * 0.9, h * 0.9, h * 0.9), new THREE.Color().setRGB(...lin([92, 108, 60]))]; });
  }
  // ---- river life: egrets, ibis and a heron in the reeds; three egrets flying low over the water; feluccas
  {
    const birds = (E.birds || []).filter(q => near(q[0], q[1], 1200)), KC = [lin([240, 238, 230]), lin([58, 44, 38]), lin([150, 156, 162])];
    inst(S.bird, M.plainI, birds, ([X, Z, y, kind, rot]) => { const [x, z] = L(X, Z), s = kind === 2 ? 1.5 : 1; return [new THREE.Vector3(x, Math.max(LY(E.level) - 0.25, footY(x, z, LY(y)) - 0.05), z), rot, new THREE.Vector3(s, s, s), new THREE.Color().setRGB(...KC[kind])]; });
    const fl = new THREE.InstancedMesh(S.flyer, M.plainI, 3), Mx = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler(), cen = L(-140, -200);
    fl.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(9), 3); for (let i = 0; i < 3; i++) fl.setColorAt(i, new THREE.Color().setRGB(...KC[0]));
    if (Math.hypot(cen[0] - cx, cen[1] - cz) < 2500) { group.add(fl); let t = R() * 100;
      anims.push(dt => { t += dt; for (let i = 0; i < 3; i++) { const an = t * 0.05 + i * 0.25, rr = 260 + i * 12, x = cen[0] + Math.cos(an) * rr, z = cen[1] + Math.sin(an) * rr * 2.2, flap = Math.sin(t * 5 + i) * 0.25;
        fl.setMatrixAt(i, Mx.compose(new THREE.Vector3(x, LY(E.level) + 6 + i * 1.5 + Math.sin(t * 0.7 + i) * 1.5, z), Q.setFromEuler(e.set(0, -an + Math.PI, flap)), new THREE.Vector3(1.2, 1.2, 1.2))); } fl.instanceMatrix.needsUpdate = true; }); }
    // two feluccas, a lateen sail on a long slanted yard, ping-ponging slowly up and down their lanes
    for (const [bi, lane] of (E.boats || []).entries()) { if (lane.length < 4) continue;
      const g = new THREE.Group(), Bb = ubatch(), P = (u, v, y) => [u, y, -v];
      box3(Bb, (u, v, y) => P(u * (1 - Math.abs(v) / 6.5 * 0.6), v, y), -1.3, 1.3, -4.5, 4.5, -0.3, 0.9, wood.map(x => x * 0.9));
      box3(Bb, P, -0.08, 0.08, 1.4, 1.6, 0.9, 8.5, wood);
      const sail = lin([238, 232, 216]); Bb.tri(P(0.1, -4.2, 1.6), P(0.1, 2.2, 13.5), P(0.1, 3.6, 1.8), sail); Bb.tri(P(-0.1, -4.2, 1.6), P(-0.1, 3.6, 1.8), P(-0.1, 2.2, 13.5), sail);
      const mm = Bb.mesh(M.plain); g.add(mm); group.add(g);
      const pts = lane.map(([X, Z]) => L(X, Z)), segL = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = segL.reduce((s, l) => s + l, 0);
      let d = R() * tot, dir = bi ? -1 : 1; const v = 0.9;
      const place = () => { let dd = d; for (let i = 0; i < segL.length; i++) { if (dd <= segL[i]) { const u = dd / segL[i], A = pts[i], B = pts[i + 1]; g.position.set(A[0] + (B[0] - A[0]) * u, LY(E.level), A[1] + (B[1] - A[1]) * u); g.rotation.y = Math.atan2(-(B[0] - A[0]), -(B[1] - A[1])) + (dir < 0 ? Math.PI : 0); return; } dd -= segL[i]; } };
      place(); anims.push(dt => { d += dir * v * dt; if (d > tot) { d = tot; dir = -1; } if (d < 0) { d = 0; dir = 1; } place(); });
    }
  }
  // ---- sand streaming off the dune crests in the wind (downwind is east, the signature's westerly)
  {
    const cr = (E.crests || []).filter(q => near(q[0], q[1], 3000));
    if (cr.length) {
      const pos = [], uv = [];
      for (const [X, Z, y] of cr) { const [x, z] = L(X, Z), [x2, z2] = L(X + 70, Z), y0 = LY(y) - 0.6, nx = -(z2 - z) / 70 * 18, nz = (x2 - x) / 70 * 18;
        for (const [p, t] of [[[x - nx, y0, z - nz], [0, 0]], [[x + nx, y0, z + nz], [0, 1]], [[x2 + nx, y0 + 5, z2 + nz], [1, 1]], [[x - nx, y0, z - nz], [0, 0]], [[x2 + nx, y0 + 5, z2 + nz], [1, 1]], [[x2 - nx, y0 + 5, z2 - nz], [1, 0]]]) { pos.push(...p); uv.push(...t); }
        for (const [p, t] of [[[x, y0, z], [0, 0]], [[x, y0 + 4, z], [0, 1]], [[x2, y0 + 9, z2], [1, 1]], [[x, y0, z], [0, 0]], [[x2, y0 + 9, z2], [1, 1]], [[x2, y0 + 2, z2], [1, 0]]]) { pos.push(...p); uv.push(...t); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uT: U.uKTime },
        vertexShader: `varying vec2 vUv; varying vec3 vP;
#include <fog_pars_vertex>
void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vP = position; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vP;
#include <fog_pars_fragment>
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){ float s = n(vec2(vUv.x*5.0 - uT*0.9 + vP.x*0.01, vUv.y*3.0 + vP.z*0.01)) * n(vec2(vUv.x*11.0 - uT*1.7, vUv.y*6.0));
  float a = smoothstep(0.08, 0.6, s) * (1.0 - vUv.x) * smoothstep(0.0, 0.2, vUv.x) * sin(3.14159*vUv.y) * 0.75;
  gl_FragColor = vec4(vec3(2.1, 1.85, 1.5), a);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}` }));
      m.renderOrder = 3; group.add(m);
    }
  }
  { for (const d of [...DOMES]) if (!d.parent || !d.parent.parent) DOMES.delete(d); const dome = skyDome(); dome.position.set(cx, 0, cz); group.add(dome); }
  anims.push(dt => { U.uKTime.value += dt; });
  return { trees: [], anims };
}
