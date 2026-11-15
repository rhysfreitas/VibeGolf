// Wrecker's Reach (global THREE): what COURSE.links holds (world space) put into a hole's frame (hole.frame) and
// drawn. Art pass 1 (tools/wreckersreach/art-brief.md, Rhys's picks: silver-grey weathered wrecks, marram plus
// small colour, the storm clearing, and all four kinds of detail):
//   the sky      a dome (main.js turns THREE.Sky off for it): the storm going away east over the lagoon as a dark
//                deck with rain still falling out of it and a faint rainbow on it, broken cumulus round the horizon
//                lit gold by the low sun in the west, a bank over the sun with its underside lit, rays fanning
//                from it over the sea
//   the water    one sheet at sea level with its own shader: a swell off the sea and a chop on it, the lagoon
//                nearly still and dark, the Cauldron green and choppy, surf running in to the sea beaches, a line
//                of breakers on the wrecking sandbar offshore, the sky (this dome) reflected in it all
//   the wrecks   planked hulls in salt-silvered timber, dark and weedy below the old waterline (the galleon on her
//                side, her stern castle propped up, the man-of-war listing with two tiers of gunports, the luggers
//                tarred black with a coloured strake), the brig's ribs as curved timbers, masts with yards and
//                shrouds; the inn whitewashed under slate with its stern-castle end and smoking chimneys, the
//                beacon in grey stone with its lantern lit, the false light glowing on its post, the bell
//   the plants   the marram clumps sway in the wind (the field's tussocks are what stops the ball), thrift and sea
//                holly in the fescue, gorse inland and round the inn, reeds along the lagoon and the creek
//   life         gulls standing on the wrecks and wheeling over them, oystercatchers on the beach, seals hauled
//                out on the bar and the point, flotsam on the wrack line, the post fences on the dunes, creels by
//                the luggers, a rowing boat on the lagoon
// The ball's side of it (the rocks, the surfaces) is in the course module and terrain.js; everything here is drawn
// only. Placements off the lines of play come from tools/wreckersreach/emit.mjs (COURSE.links).
import { unpackHeights } from './field-code.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const mixC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const rng = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
// a batch of textured, vertex-coloured triangles (non-indexed), turned into one mesh
function ubatch() {
  const pos = [], col = [], uv = [];
  const v3 = (p, t, k) => { pos.push(p[0], p[1], p[2]); uv.push(t[0], t[1]); col.push(k[0], k[1], k[2]); };
  const tri = (a, b, c, ta, tb, tc, ka, kb = ka, kc = ka) => { v3(a, ta, ka); v3(b, tb, kb); v3(c, tc, kc); };
  const quad = (a, b, c, d, ta, tb, tc, td, k) => { tri(a, b, c, ta, tb, tc, k); tri(a, c, d, ta, tc, td, k); };
  const geo = () => {
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); return g;
  };
  return { v3, tri, quad, geo };
}
// geometries with the same attributes merged into one (non-indexed); missing uv and colour filled in
function mergeGeos(list) {
  list = list.filter(Boolean).map(g => g.index ? g.toNonIndexed() : g);
  if (!list.length) return null;
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), C = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count; if (!g.attributes.normal) g.computeVertexNormals();
    P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) UV.set(g.attributes.uv.array, o * 2);
    if (g.attributes.color) C.set(g.attributes.color.array, o * 3); else C.fill(1, o * 3, (o + c) * 3);
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  return g;
}
// a geometry painted one colour (for the small kits below)
const paint = (g, k) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(k, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const kit = parts => mergeGeos(parts.map(([g, M, k]) => { g = paint(g, k); if (M) g.applyMatrix4(M); return g; }));
const Mx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// the paint byte: 0 dune sand, 1 fescue, 2 beach, 3 wreck timber, 4 stone, 5 dune grass, 6 pot sand, 8 water,
// 10 mown ground
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, LINKS) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B sand (the dunes, the pots, under the tussocks), A grass length
// (fescue). B: R beach, G under a tussock, B wreck timber or stone, A the pots (their sod faces)
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee'), cS = C.indexOf('sand'), cP = C.indexOf('pot'), cK = C.indexOf('tussock'), cB = C.indexOf('beach');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f; else if (c === cS || c === cP || c === cK) w[3] += f;
      if (c === cB) w[4] += f; if (c === cK) w[5] += f; if (m === 3) w[6] += f; if (m === 4) w[7] += f; if (c === cP) w[8] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = Math.min(255, own[3] * 255); a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else { a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255; }
    const mown = ['green', 'fringe', 'tee', 'fairway'].includes(s) ? 0 : 1;
    b[o] = Math.round(Math.min(1, own[4]) * 255 * mown); b[o + 1] = Math.round(Math.min(1, own[5]) * 255 * mown); b[o + 2] = Math.round(Math.min(1, own[6] + own[7]) * 255 * mown);
    b[o + 3] = Math.round(Math.min(1, own[8] * 1.6) * 255);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T) {
  const C = { desert: '#6d6559', rough: '#a8a35e', firstcut: '#86a04c', fairway: '#7aa84a', fringe: '#84b250', green: '#8fcb5e', tee: '#86b456', sand: '#e9dfc2', pot: '#d8c99c', tussock: '#8f9a58', beach: '#b9ab8c', water: '#3c6876', void: '#15110f' };
  return (x, z) => C[T.surfaceAt(x, z)] || C.sand;
}
// what a native lie is called, from the paint under the ball (the wrecks' footprints and stone are 'desert')
export function lieName(hole, x, z) { return matAt(hole, x, z) === 3 ? 'Wreck' : 'Stone'; }

/* ---------- uniforms the ground shader shares (main.js merges U into it) ---------- */
// uLTime the clock; uLWind downwind (the prevailing sea wind blows toward the north-east) and uLNorth north, both
// in the hole's frame; uLSea sea level in the frame (the wet beach and the wrack line go by height above it)
export const U = { uLTime: { value: 0 }, uLWind: { value: new THREE.Vector2(0.7, -0.7) }, uLNorth: { value: new THREE.Vector2(0, -1) }, uLSea: { value: 0 } };

/* ---------- the sky: a dome over each hole (main.js turns THREE.Sky off while it's on) ---------- */
const SKY = { on: true, sunU: { value: new THREE.Vector3(0, 0.15, -1) }, hazeU: { value: new THREE.Color(0xc3c6bf) } }, DOMES = new Set();
export function sky(on, sunDir, fog) { SKY.on = on; if (sunDir) SKY.sunU.value.copy(sunDir); if (fog !== undefined) SKY.hazeU.value.set(fog); for (const d of DOMES) d.visible = on; }
// the sky by direction (in the hole's frame). Shared with the water, which reflects it (q = 0: the cheaper pass)
const SKY_GLSL = `
uniform vec3 uSun; uniform vec2 uEast, uNorth; uniform float uLT; uniform vec3 uHaze;
float lsh(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float lsn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(lsh(i),lsh(i+vec2(1,0)),u.x), mix(lsh(i+vec2(0,1)),lsh(i+vec2(1,1)),u.x), u.y); }
float lsf(vec2 p){ return lsn(p)*0.5 + lsn(p*2.03+3.1)*0.25 + lsn(p*4.07+7.7)*0.125 + lsn(p*8.1+1.3)*0.0625; }
// noise round the horizon (k cells a radian) by elevation (m cells a unit of sin): sampled on the two compass axes and
// blended by how much each moves there, so nothing slants
float lrn(vec2 cc, float e, float k, float m, float o){ vec2 w = abs(vec2(cc.y, cc.x)); w /= (w.x + w.y); return lsn(vec2(cc.x * k, e * m + o)) * w.x + lsn(vec2(cc.y * k + 17.0, e * m + o)) * w.y; }
float lrf(vec2 cc, float e, float k, float m, float o){ return lrn(cc, e, k, m, o) * 0.6 + lrn(cc, e, k * 2.1, m * 2.1, o + 3.0) * 0.28 + lrn(cc, e, k * 4.3, m * 4.3, o + 7.0) * 0.12; }
vec3 linksSky(vec3 d, float q) {
  float e = d.y, eu = max(e, 0.0);
  vec2 h = normalize(d.xz + vec2(1e-5, 0.0));
  float ce = dot(h, uEast), cn = dot(h, uNorth); vec2 cc = vec2(ce, cn);
  vec3 S = normalize(uSun); vec2 sH = normalize(S.xz + vec2(1e-5, 0.0));
  float su = clamp(dot(d, S), 0.0, 1.0), toSun = dot(h, sH), low = 1.0 - smoothstep(0.0, 0.3, eu);
  // the washed sky behind the storm: deep blue high up, paling to the sea haze at the horizon
  vec3 col = mix(uHaze * 1.02, vec3(0.42, 0.58, 0.84), smoothstep(0.0, 0.26, eu));
  col = mix(col, vec3(0.13, 0.26, 0.58), smoothstep(0.22, 0.95, eu));
  col += vec3(1.5, 0.92, 0.4) * (pow(su, 5.0) * 0.5 + pow(max(toSun, 0.0), 3.0) * low * low * 0.42);   // gold round the low sun and along the west
  // rays fanning from it
  vec3 t1 = normalize(cross(S, vec3(0.0, 1.0, 0.0))), t2 = cross(t1, S), dp = d - S * dot(d, S);
  vec2 rv = normalize(vec2(dot(dp, t1), dot(dp, t2)) + vec2(1e-5, 0.0));
  float rd = acos(su), rays = q > 0.5 ? smoothstep(0.44, 0.74, lsf(rv * 6.0 + 2.0)) * exp(-rd * 1.8) * smoothstep(0.03, 0.16, rd) : 0.0;
  col += vec3(1.3, 0.9, 0.5) * rays * 0.5 * (0.35 + 0.65 * low);
  // the storm going away east over the lagoon: a dark deck up to about thirty degrees, ragged along its top
  float dTop = 0.08 + 0.46 * smoothstep(-0.35, 1.0, ce) + 0.12 * (lsf(cc * 2.5 + 1.7) - 0.5);
  float rag = q > 0.5 ? lrf(cc, e, 9.0, 6.0, 4.0) * 0.75 + lrn(cc, e, 30.0, 20.0, 9.0) * 0.25 : 0.5;
  float deck = smoothstep(-0.45, 0.05, ce) * (1.0 - smoothstep(dTop - 0.04, dTop + 0.04, e + 0.12 * (rag - 0.5)));
  float dt = q > 0.5 ? lrf(cc, e, 5.0, 9.0, uLT * 0.003) : 0.45;
  vec3 deckC = mix(vec3(0.075, 0.09, 0.12), vec3(0.21, 0.23, 0.28), dt);
  deckC = mix(deckC, vec3(0.5, 0.42, 0.38), smoothstep(dTop - 0.14, dTop, e) * 0.45);                 // its top catches the last of the light
  float rain = q > 0.5 ? smoothstep(0.5, 0.8, lrn(cc, 0.0, 46.0, 0.0, 0.0)) : 0.4;               // rain still falling out of it, far off
  deckC = mix(deckC, vec3(0.36, 0.39, 0.43), (rain * 0.45 + 0.35) * (1.0 - smoothstep(0.0, 0.07, eu)));
  float rb = acos(clamp(dot(d, -S), -1.0, 1.0)), bt = (rb - 0.698) / 0.044;                          // a rainbow on it
  vec3 bow = vec3(smoothstep(0.35, 0.9, bt), 1.0 - abs(bt - 0.5) * 2.2, 1.0 - smoothstep(0.0, 0.55, bt)) * smoothstep(0.0, 0.15, bt) * (1.0 - smoothstep(0.85, 1.0, bt));
  deckC += max(bow, 0.0) * 0.075 * smoothstep(0.0, 0.08, eu) * (1.0 - smoothstep(0.16, 0.3, eu));
  col = mix(col, deckC, deck);
  // broken cumulus all round the horizon, towering higher in front of the storm: front-lit gold, or dark with a
  // gold rim against the sun
  float cov = smoothstep(0.34, 0.62, lsf(cc * 3.2 + 9.0) + 0.12 * max(ce, 0.0));
  float cTop = (0.035 + 0.12 * lsf(cc * 1.6 + 3.0) + 0.07 * max(ce, 0.0)) * (0.15 + 0.85 * cov);   // domes rising and falling, not cut off
  float bump = lrf(cc, e, 20.0, 30.0, 1.0), bmp2 = q > 0.5 ? lrn(cc, e, 64.0, 70.0, 5.0) : 0.5;
  float cu = (1.0 - smoothstep(cTop - 0.012, cTop + 0.008, e + 0.05 * (bump - 0.5) * cov + 0.02 * (bmp2 - 0.5))) * smoothstep(0.02, 0.25, cov) * smoothstep(-0.02, 0.012, e);
  float hi = smoothstep(0.0, cTop + 0.001, e), back = smoothstep(0.3, 0.95, toSun);
  vec3 lit = mix(vec3(0.5, 0.5, 0.56), vec3(1.32, 1.04, 0.74), smoothstep(0.05, 0.85, hi) * (0.55 + 0.45 * bump)) * (0.8 + 0.3 * bmp2);
  vec3 bk = mix(vec3(0.17, 0.18, 0.23), vec3(2.6, 1.7, 0.78), hi * hi * hi * (0.3 + 0.7 * bump));
  col = mix(col, mix(lit, bk, back), cu);
  // a bank of cloud over the sun, its underside lit gold, the sun under its edge
  float nearS = q > 0.5 ? smoothstep(0.72, 0.97, toSun) : 0.0;
  float bLo = 0.2 + 0.04 * (lsf(cc * 14.0) - 0.5), bHi = 0.36 + 0.06 * lsf(cc * 6.0 + 2.0);
  float bnk = nearS * smoothstep(bLo - 0.015, bLo + 0.015, e + 0.03 * (bump - 0.5)) * (1.0 - smoothstep(bHi - 0.04, bHi, e)) * smoothstep(0.3, 0.6, lsf(cc * 5.0 + vec2(0.0, e * 8.0)));
  col = mix(col, mix(vec3(2.8, 1.8, 0.82), vec3(0.24, 0.24, 0.3), smoothstep(bLo, bLo + 0.07, e)), bnk);
  col += vec3(3.0, 2.3, 1.5) * pow(su, 1200.0) * 8.0 * (1.0 - cu) * (1.0 - bnk);                       // the sun
  col = mix(col, uHaze, (1.0 - smoothstep(-0.012, 0.022, e)) * (1.0 - 0.55 * cu));                   // the sea haze at the horizon
  return col;
}
// the same sky, cheaply, for the water's reflection (the waves smear the detail anyway): the gradient, the gold in the
// west, the dark deck in the east, a soft band of cloud at the horizon
vec3 linksSkyLo(vec3 d) {
  float eu = max(d.y, 0.0); vec2 h = normalize(d.xz + vec2(1e-5, 0.0)); float ce = dot(h, uEast);
  vec3 S = normalize(uSun); float su = clamp(dot(d, S), 0.0, 1.0), toSun = dot(h, normalize(S.xz + vec2(1e-5, 0.0))), low = 1.0 - smoothstep(0.0, 0.3, eu);
  vec3 col = mix(uHaze * 1.02, vec3(0.42, 0.58, 0.84), smoothstep(0.0, 0.26, eu));
  col = mix(col, vec3(0.13, 0.26, 0.58), smoothstep(0.22, 0.95, eu));
  col += vec3(1.5, 0.92, 0.4) * (pow(su, 5.0) * 0.5 + pow(max(toSun, 0.0), 3.0) * low * low * 0.42);
  float dTop = 0.08 + 0.46 * smoothstep(-0.35, 1.0, ce), deck = smoothstep(-0.45, 0.05, ce) * (1.0 - smoothstep(dTop - 0.05, dTop + 0.05, eu));
  col = mix(col, mix(vec3(0.13, 0.15, 0.19), vec3(0.36, 0.39, 0.43), 1.0 - smoothstep(0.0, 0.07, eu)), deck);
  float cu = (1.0 - smoothstep(0.03, 0.12, eu)) * smoothstep(0.0, 0.015, eu) * (0.35 + 0.3 * max(ce, 0.0));
  col = mix(col, mix(vec3(1.25, 1.0, 0.72), vec3(0.3, 0.3, 0.36), smoothstep(0.3, 0.95, toSun)), cu);
  col += vec3(3.0, 2.3, 1.5) * pow(su, 1200.0) * 8.0;
  return mix(col, uHaze, 1.0 - smoothstep(-0.012, 0.022, d.y));
}`;
function skyDome(east, north) {
  const m = new THREE.ShaderMaterial({ uniforms: { uSun: SKY.sunU, uEast: { value: east }, uNorth: { value: north }, uLT: U.uLTime, uHaze: SKY.hazeU }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${SKY_GLSL}
varying vec3 vW;
void main(){ gl_FragColor = vec4(linksSky(normalize(vW - cameraPosition), 1.0), 1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}` });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(11000, 48, 24), m); mesh.renderOrder = -10; mesh.frustumCulled = false; mesh.visible = SKY.on;
  DOMES.add(mesh); return mesh;
}

/* ---------- textures, made once ---------- */
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, rep = true) => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; };
  // salt-silvered planking: 8 m along (u) by `girth` m round the hull (v), strakes 25 cm, butts staggered, trenails,
  // grain, rot and rust running from the iron. Near white-grey: the vertex colours carry the tone (the weed below
  // the old waterline, the tar on the luggers)
  const planking = (girth, ports) => {
    const W = 512, Hh = Math.round(girth / 8 * 512), [c, g] = cvs(W, Hh), R = rng(ports ? 29 : 17), sp = 512 / 8 * 0.25;
    g.fillStyle = '#9a958c'; g.fillRect(0, 0, W, Hh);
    for (let y = 0, k = 0; y < Hh; y += sp, k++) {
      let x = -R() * 200;
      while (x < W) {
        const l = (2 + R() * 4) * 64, t = 0.8 + R() * 0.28, base = [196 * t, 192 * t, 184 * t];
        for (const dx of [0, W, -W]) {
          g.fillStyle = `rgb(${base.map(v => v | 0).join(',')})`; g.fillRect(x + dx + 1, y + 1, l - 2, sp - 2);
          for (let s = 0; s < 6; s++) { g.strokeStyle = `rgba(${R() < 0.5 ? '90,84,76' : '235,232,224'},${0.12 + R() * 0.12})`; g.lineWidth = 0.6 + R(); g.beginPath(); const yy = y + 2 + R() * (sp - 4); g.moveTo(x + dx, yy); g.bezierCurveTo(x + dx + l * 0.3, yy + (R() - 0.5) * 3, x + dx + l * 0.7, yy + (R() - 0.5) * 3, x + dx + l, yy + (R() - 0.5) * 2); g.stroke(); }
          g.fillStyle = 'rgba(40,34,30,0.55)'; for (let q = 0; q < l; q += 64) g.fillRect(x + dx + q + 6, y + sp / 2 - 1, 2, 2);   // trenails over each frame
          g.fillStyle = 'rgba(255,255,250,0.12)'; g.fillRect(x + dx + 1, y + 1, l - 2, 2);
          g.fillStyle = 'rgba(30,26,22,0.5)'; g.fillRect(x + dx, y + sp - 2, l, 2);
        }
        x += l;
      }
    }
    for (let i = 0; i < 14; i++) { const x = R() * W, y = R() * Hh, rr = 6 + R() * 22; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(50,40,30,0.18)'); gr.addColorStop(1, 'rgba(50,40,30,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 14; i++) { const x = R() * W, y = R() * Hh; g.fillStyle = 'rgba(60,54,48,0.9)'; g.fillRect(x, y, 3, 3); const gr = g.createLinearGradient(0, y, 0, y + 40); gr.addColorStop(0, 'rgba(120,60,30,0.4)'); gr.addColorStop(1, 'rgba(120,60,30,0)'); g.fillStyle = gr; g.fillRect(x - 1, y, 5, 40); }
    if (ports) {   // two tiers of gunports (four to each 8 m) with a dark wale between them
      for (const [y0, h] of [[Hh * 0.33, 10], [Hh * 0.62, 12]]) { g.fillStyle = 'rgba(38,32,28,0.85)'; g.fillRect(0, y0 - h - 30, W, h); }
      for (const yc of [Hh * 0.2, Hh * 0.48]) for (let i = 0; i < 4; i++) {
        const x = 64 + i * 128 + (R() - 0.5) * 6, s = 44;
        g.fillStyle = '#16120f'; g.fillRect(x - s / 2, yc - s / 2, s, s);
        g.strokeStyle = 'rgba(70,62,54,0.9)'; g.lineWidth = 4; g.strokeRect(x - s / 2 - 2, yc - s / 2 - 2, s + 4, s + 4);
        const gr = g.createLinearGradient(0, yc + s / 2, 0, yc + s / 2 + 50); gr.addColorStop(0, 'rgba(110,60,34,0.45)'); gr.addColorStop(1, 'rgba(110,60,34,0)'); g.fillStyle = gr; g.fillRect(x - 8, yc + s / 2, 16, 50);
      }
    }
    return tex(c);
  };
  // whitewashed rubble walls, 16 m by 8 m: lime over stone, grime down from the eaves, green damp along the foot over
  // a tarred plinth, small deep windows in two rows (some lit), a door; and the lit windows alone (the emissive map)
  const [wc, wg] = cvs(512, 256), [ec, eg] = cvs(512, 256), Rw = rng(41);
  wg.fillStyle = '#ddd7c8'; wg.fillRect(0, 0, 512, 256); eg.fillStyle = '#000'; eg.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 2600; i++) { const x = Rw() * 512, y = Rw() * 256, r = 1 + Rw() * 4; wg.fillStyle = Rw() < 0.5 ? 'rgba(150,140,120,0.12)' : 'rgba(255,255,250,0.18)'; wg.beginPath(); wg.arc(x, y, r, 0, 6.283); wg.fill(); }
  for (let i = 0; i < 40; i++) { const x = Rw() * 512, l = 20 + Rw() * 90, gr = wg.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(90,86,74,0.3)'); gr.addColorStop(1, 'rgba(90,86,74,0)'); wg.fillStyle = gr; wg.fillRect(x, 0, 3 + Rw() * 8, l); }
  { const gr = wg.createLinearGradient(0, 200, 0, 242); gr.addColorStop(0, 'rgba(96,110,70,0)'); gr.addColorStop(1, 'rgba(96,110,70,0.45)'); wg.fillStyle = gr; wg.fillRect(0, 200, 512, 42); wg.fillStyle = '#26221f'; wg.fillRect(0, 242, 512, 14); }
  for (const [row, y] of [[0, 150], [1, 42]]) for (let i = 0; i < 4; i++) {
    const x = 40 + i * 128, lit = Rw() < 0.45;
    if (row === 0 && i === 1) { wg.fillStyle = '#3a3029'; wg.fillRect(x + 50, 160, 36, 82); wg.fillStyle = '#5a4a3c'; wg.fillRect(x + 54, 164, 28, 78); continue; }   // the door
    wg.fillStyle = '#4b4a46'; wg.fillRect(x - 3, y - 3, 38, 48);
    wg.fillStyle = lit ? '#e8b060' : '#2a3036'; wg.fillRect(x, y, 32, 42);
    wg.fillStyle = '#e8e4da'; wg.fillRect(x + 15, y, 2, 42); wg.fillRect(x, y + 20, 32, 2); wg.fillRect(x - 4, y + 42, 40, 4);
    if (lit) { eg.fillStyle = '#ffb860'; eg.fillRect(x, y, 32, 42); eg.fillStyle = '#000'; eg.fillRect(x + 15, y, 2, 42); eg.fillRect(x, y + 20, 32, 2); }
  }
  // slate: 8 m by 8 m, 30 cm courses, staggered, blue-grey, lichen
  const [sc, sg] = cvs(512, 512), Rs = rng(53);
  sg.fillStyle = '#2e3136'; sg.fillRect(0, 0, 512, 512);
  for (let y = 0, k = 0; y < 512; y += 19.2, k++) for (let x = (k % 2) * 10 - 10; x < 512; x += 20) { const t = 0.8 + Rs() * 0.35; sg.fillStyle = `rgb(${84 * t | 0},${88 * t | 0},${96 * t | 0})`; sg.fillRect(x + 1, y + 1, 18, 17.2); sg.fillStyle = 'rgba(0,0,0,0.25)'; sg.fillRect(x + 1, y + 16, 18, 2); }
  for (let i = 0; i < 420; i++) { const x = Rs() * 512, y = Rs() * 512; sg.fillStyle = Rs() < 0.6 ? 'rgba(206,190,110,0.5)' : 'rgba(230,230,220,0.45)'; sg.beginPath(); sg.arc(x, y, 1 + Rs() * 3.5, 0, 6.283); sg.fill(); }
  // grey stone in courses (the beacon, the chimneys, the yard wall): 8 m by 8 m, 50 cm courses, lichen
  const [gc, gg] = cvs(512, 512), Rg = rng(61);
  gg.fillStyle = '#4e4d4a'; gg.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 32) { let x = -Rg() * 60; while (x < 512) { const l = 40 + Rg() * 60, t = 0.82 + Rg() * 0.3; for (const dx of [0, 512, -512]) { gg.fillStyle = `rgb(${150 * t | 0},${150 * t | 0},${146 * t | 0})`; gg.fillRect(x + dx + 1.5, y + 1.5, l - 3, 29); gg.fillStyle = 'rgba(255,255,250,0.12)'; gg.fillRect(x + dx + 1.5, y + 1.5, l - 3, 3); } x += l; } }
  for (let i = 0; i < 700; i++) { const x = Rg() * 512, y = Rg() * 512; gg.fillStyle = Rg() < 0.5 ? 'rgba(200,190,120,0.35)' : 'rgba(225,225,215,0.3)'; gg.beginPath(); gg.arc(x, y, 1 + Rg() * 4, 0, 6.283); gg.fill(); }
  for (let i = 0; i < 30; i++) { const x = Rg() * 512, l = 40 + Rg() * 160, gr = gg.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(40,40,36,0.3)'); gr.addColorStop(1, 'rgba(40,40,36,0)'); gg.fillStyle = gr; gg.fillRect(x, Rg() * 300, 4 + Rg() * 8, l); }
  // the plants: thrift, sea holly and reeds in one strip of cards (alpha-cut), and gorse (dark spines and yellow flowers)
  const [fc, fg] = cvs(768, 256), Rf = rng(71);
  fg.clearRect(0, 0, 768, 256);
  for (let i = 0; i < 70; i++) { const a = (Rf() - 0.5) * 2.4, l = 40 + Rf() * 40; fg.strokeStyle = `rgb(${50 + Rf() * 30 | 0},${78 + Rf() * 30 | 0},${40 + Rf() * 16 | 0})`; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(128, 256); fg.quadraticCurveTo(128 + Math.sin(a) * l * 0.5, 256 - l * 0.6, 128 + Math.sin(a) * l * 1.6, 256 - Math.cos(a) * l * 0.7); fg.stroke(); }
  for (let i = 0; i < 26; i++) { const x = 128 + (Rf() - 0.5) * 170, y = 120 + Rf() * 70; fg.strokeStyle = '#5d6a3a'; fg.lineWidth = 2; fg.beginPath(); fg.moveTo(128 + (x - 128) * 0.3, 250); fg.lineTo(x, y); fg.stroke(); const r = 9 + Rf() * 5; fg.fillStyle = `rgb(${232 + Rf() * 20 | 0},${120 + Rf() * 50 | 0},${170 + Rf() * 40 | 0})`; fg.beginPath(); fg.arc(x, y, r, 0, 6.283); fg.fill(); fg.fillStyle = 'rgba(255,220,240,0.6)'; fg.beginPath(); fg.arc(x - 3, y - 3, r * 0.4, 0, 6.283); fg.fill(); }
  for (let i = 0; i < 16; i++) { const a = (i / 16 - 0.5) * 2.8, l = 60 + Rf() * 60, x0 = 384, tip = [x0 + Math.sin(a) * l, 256 - Math.cos(a) * l * 0.9]; fg.fillStyle = `rgb(${140 + Rf() * 30 | 0},${160 + Rf() * 30 | 0},${172 + Rf() * 26 | 0})`; fg.beginPath(); fg.moveTo(x0 - 8, 256); for (let k = 1; k <= 4; k++) { const t = k / 4, px = x0 + (tip[0] - x0) * t, py = 256 + (tip[1] - 256) * t; fg.lineTo(px + Math.cos(a) * 14 * (1 - t), py + Math.sin(a) * 6); fg.lineTo(px, py); } fg.lineTo(x0 + 8, 256); fg.fill(); }
  for (let i = 0; i < 9; i++) { const x = 384 + (Rf() - 0.5) * 150, y = 90 + Rf() * 70; fg.strokeStyle = '#6f88a8'; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(384, 250); fg.lineTo(x, y); fg.stroke(); fg.fillStyle = '#5f7fb8'; fg.beginPath(); fg.arc(x, y, 10, 0, 6.283); fg.fill(); fg.strokeStyle = '#a8bcd4'; fg.lineWidth = 2; for (let k = 0; k < 8; k++) { const an = k / 8 * 6.283; fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + Math.cos(an) * 20, y + Math.sin(an) * 20); fg.stroke(); } }
  for (let i = 0; i < 46; i++) { const x0 = 520 + Rf() * 240, x1 = x0 + (Rf() - 0.5) * 30, top = 10 + Rf() * 90; fg.strokeStyle = `rgb(${110 + Rf() * 50 | 0},${118 + Rf() * 40 | 0},${70 + Rf() * 20 | 0})`; fg.lineWidth = 2 + Rf() * 2; fg.beginPath(); fg.moveTo(x0, 256); fg.quadraticCurveTo(x0, top + 80, x1, top); fg.stroke();
    if (Rf() < 0.55) { fg.fillStyle = `rgb(${120 + Rf() * 30 | 0},${88 + Rf() * 20 | 0},${62 + Rf() * 14 | 0})`; fg.beginPath(); fg.ellipse(x1 + 3, top + 12, 5, 16, 0.2, 0, 6.283); fg.fill(); }
    else { fg.strokeStyle = 'rgba(90,110,50,0.9)'; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(x0 + (x1 - x0) * 0.6, top + 110); fg.lineTo(x0 + (x1 - x0) * 0.6 + 26 * (Rf() < 0.5 ? -1 : 1), top + 70); fg.stroke(); } }
  const flora = tex(fc, false);
  const [oc, og] = cvs(256, 128), Ro = rng(83);
  og.fillStyle = '#27331a'; og.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) { og.fillStyle = Ro() < 0.5 ? 'rgba(20,30,12,0.8)' : 'rgba(60,76,34,0.7)'; og.fillRect(Ro() * 256, Ro() * 128, 2, 3); }
  for (let i = 0; i < 40; i++) { const cx0 = Ro() * 256, cy0 = Ro() * 64; for (let k = 0; k < 7; k++) { og.fillStyle = `rgba(${226 + Ro() * 29 | 0},${170 + Ro() * 40 | 0},${20 + Ro() * 30 | 0},0.9)`; og.beginPath(); og.arc(cx0 + (Ro() - 0.5) * 16, cy0 + (Ro() - 0.5) * 10, 1 + Ro() * 1.4, 0, 6.283); og.fill(); } }
  // soft round things: a halo (lamps) and a puff (smoke)
  const soft = (inner, outer) => { const [c, g] = cvs(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  const whiteT = tex(wc); whiteT.wrapT = THREE.ClampToEdgeWrapping; const emT = tex(ec); emT.wrapT = THREE.ClampToEdgeWrapping;
  return (TEX = { planks: planking(4, false), ports: planking(8, true), white: whiteT, whiteEm: emT, slate: tex(sc), stone: tex(gc), flora, gorse: tex(oc), halo: soft('rgba(255,236,190,1)', 'rgba(255,170,70,0.35)'), puff: soft('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.35)') });
}

/* ---------- shapes made once ---------- */
export const TYPES = new Set(['tussock']);   // the clusters' bodies (they play); main.js's buildTrees leaves them to this file
let SHAPES = null;
// a clump of dune grass (marram), drawn as four crossed cards round its middle, each carrying a painted fountain of
// about 150 long blades (texture below): dense and dark at the base, arching out and over to straw tips, combed
// toward +x (the instance turns it to lean downwind). About 1.5 m tall and 2.6 m across at unit scale. Cheap (8
// triangles a clump) and dense, which a few dozen modelled blades never were. It sways: gusts run downwind
// through the dunes (the vertex shader below, the shadows with it)
function grassTexture() {
  const W = 512, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); let r = 91; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const col = (t, k) => { const a = [58, 64, 30], m = [118, 126, 62], s = k ? [218, 198, 128] : [170, 176, 96]; const q = t < 0.4 ? a.map((v, i) => v + (m[i] - v) * t / 0.4) : m.map((v, i) => v + (s[i] - v) * (t - 0.4) / 0.6); return `rgb(${q.map(Math.round).join(',')})`; };
  for (let pass = 0; pass < 2; pass++) for (let b = 0; b < 160; b++) {
    const side = rand() * 2 - 1, out = Math.abs(side), x0 = W / 2 + side * W * 0.16 * Math.sqrt(rand()), len = H * (0.55 + 0.42 * rand()) * (1 - 0.25 * out);
    const lean = side * (0.15 + 1.1 * out) + 0.25, straw = rand() < 0.5, wid = 2.2 + 3.2 * rand();
    const pts = []; let px = x0, py = H, ang = lean * 0.35;
    for (let k = 0; k <= 8; k++) { pts.push([px, py]); const t = k / 8; ang += lean * 0.11 * (0.6 + 1.6 * t); px += Math.sin(ang) * len / 8; py -= Math.cos(ang) * len / 8; }
    for (let k = 0; k < 8; k++) { const t = (k + 0.5) / 8; x.strokeStyle = col(pass ? t : t * 0.8, straw); x.lineWidth = wid * (1 - 0.8 * t); x.lineCap = 'round'; x.beginPath(); x.moveTo(...pts[k]); x.lineTo(...pts[k + 1]); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
// crossed cards round the middle: n of them, w across, h tall, leaning `lean` toward +x, the texture's strip [u0, u1]
function cards(n, w, h, lean, u0 = 0, u1 = 1) {
  const pos = [], nor = [], uv = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI, ca = Math.cos(a) * w, sa = Math.sin(a) * w, ln = lean * h;
    const A = [-ca, -0.05, -sa], B = [ca, -0.05, sa], C = [ca + ln, h, sa], D = [-ca + ln, h, -sa];
    for (const [v, t] of [[A, [u0, 0]], [B, [u1, 0]], [C, [u1, 1]], [A, [u0, 0]], [C, [u1, 1]], [D, [u0, 1]]]) { pos.push(...v); nor.push(0.15, 0.97, 0.15); uv.push(...t); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
// the sway: gusts running downwind (uLWind) through the clumps, a flutter on them; the tips move most
function sway(mat, height, amt) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uLT = U.uLTime; sh.uniforms.uLWind = U.uLWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uLT; uniform vec2 uLWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{ vec3 ip = instanceMatrix[3].xyz; float hh = max(position.y, 0.0) / ${height.toFixed(2)};
  float gust = 0.5 + 0.5 * sin(uLT * 0.85 - dot(ip.xz, uLWind) * 0.045 + sin(dot(ip.xz, vec2(uLWind.y, -uLWind.x)) * 0.02));
  float flut = sin(uLT * 3.3 + ip.x * 0.37 + ip.z * 0.29 + position.x * 1.7 + position.z * 1.3);
  transformed.x += hh * hh * ${amt.toFixed(2)} * (0.35 + 0.65 * gust + 0.18 * flut);
  transformed.z += hh * hh * ${amt.toFixed(2)} * 0.18 * sin(uLT * 2.1 + ip.z * 0.5 + ip.x * 0.2); }
#endif`);
  };
  mat.customProgramCacheKey = () => 'sway' + height + amt;
}
// a hull: s along it (the bow at +s), u across, v up from the keel; local x = u, y = v, z = -s. Sections from a bluff
// bow to a transom (or a pointed stern), a wine-glass section, sheer rising to the ends; planks (uv: 8 m along,
// `vS` m round) and weed below the old waterline (vertex colours); holes cut where the planking has gone, with the
// frames showing through them
function hullGeo(o) {
  const { L, beam, D, n = 30, m = 14, transom = 0.5, wl = 0.42, top = [0.62, 0.6, 0.57], weed = [0.06, 0.08, 0.05], strake = null, holes = [], vS = 4, sheer = 0.22, deck = true, deckK = null } = o;
  const pos = [], uv = [], col = [], idx = [], rings = [];
  for (let i = 0; i <= n; i++) {
    const sn = -1 + 2 * i / n, s = sn * L / 2;
    const fb = 1 - Math.pow(Math.abs(sn), sn > 0 ? 2 : 3);
    const b = beam / 2 * (sn > 0 || transom <= 0 ? Math.pow(Math.max(fb, 0.0004), 0.55) : transom + (1 - transom) * Math.pow(Math.max(fb, 0), 0.5));
    const hTop = D * (1 + sheer * sn * sn), keel = D * 0.16 * Math.pow(Math.abs(sn), 3);
    const ring = [];
    for (let j = 0; j <= m; j++) { const ph = Math.PI * j / m; ring.push([-b * Math.cos(ph), keel + (hTop - keel) * (1 - Math.pow(Math.sin(ph), 0.45))]); }
    const g = [0]; for (let j = 1; j <= m; j++) g.push(g[j - 1] + Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1]));
    for (let j = 0; j <= m; j++) {
      const [u, v] = ring[j], t = (v - keel) / (hTop - keel);
      pos.push(u, v, -s); uv.push(s / 8, Math.min(g[j], g[m] - g[j]) / vS);
      let k = mixC(weed, top, Math.min(1, Math.max(0, (t - wl + 0.06) / 0.12)));
      if (strake && t > 0.82 && t < 0.92) k = strake;
      col.push(...k.map(c => c * (0.9 + 0.2 * hash(i, j))));
    }
    rings.push({ ring, s, hTop });
  }
  const at = (i, j) => i * (m + 1) + j, inHole = (i, j) => holes.some(H => i / n >= H[0] && i / n < H[1] && j / m >= H[2] && j / m < H[3]);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { if (inHole(i, j)) continue; idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1)); }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hull.setIndex(idx); hull.computeVertexNormals();
  const B = ubatch(), dk = deckK || top.map(c => c * 0.92);
  if (deck) for (let i = 0; i < n; i++) {   // the deck (planks across the sections), with a hatch gone in the waist
    if (o.deckHole && i / n >= o.deckHole[0] && i / n < o.deckHole[1]) continue;
    const A = rings[i], C = rings[i + 1], a0 = A.ring[0], a1 = A.ring[m], c0 = C.ring[0], c1 = C.ring[m];
    B.quad([a0[0], A.hTop - 0.2, -A.s], [c0[0], C.hTop - 0.2, -C.s], [c1[0], C.hTop - 0.2, -C.s], [a1[0], A.hTop - 0.2, -A.s], [a0[0] / 4, A.s / 8], [c0[0] / 4, C.s / 8], [c1[0] / 4, C.s / 8], [a1[0] / 4, A.s / 8], dk);
  }
  if (transom > 0) { const A = rings[0], c = [0, A.hTop * 0.55, -A.s]; for (let j = 0; j < m; j++) B.tri(c, [A.ring[j + 1][0], A.ring[j + 1][1], -A.s], [A.ring[j][0], A.ring[j][1], -A.s], [0, c[1] / 4], [A.ring[j + 1][0] / 4, A.ring[j + 1][1] / 4], [A.ring[j][0] / 4, A.ring[j][1] / 4], top); }
  // frames where the planking has gone: square timbers following the sections inside the hole
  for (const H of holes) for (let i = Math.ceil(H[0] * n); i <= Math.floor(H[1] * n); i++) {
    const R0 = rings[i], j0 = Math.max(0, Math.floor(H[2] * m) - 1), j1 = Math.min(m, Math.ceil(H[3] * m) + 1);
    const pts = []; for (let j = j0; j <= j1; j++) pts.push([R0.ring[j][0] * 0.97, R0.ring[j][1] + 0.05, -R0.s]);
    sweep(B, pts, 0.28, 0.32, weed.map((c, q) => (c + top[q]) * 0.45));
  }
  // her frames standing inside the planking (every k-th section), seen where the side or the deck has gone
  if (o.frames) for (let i = 1; i < n; i += o.frames) { const R0 = rings[i], pts = R0.ring.map(([u, v]) => [u * 0.95, v + 0.04, -R0.s]); sweep(B, pts, 0.26, 0.3, top.map(c => c * 0.75)); }
  return [hull, B.geo()];
}
// a square timber along a polyline (w across the bend, d along the hull)
function sweep(B, pts, w, d, k, taper = 1) {
  const up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1; i++) {
    a.fromArray(pts[i]); b.fromArray(pts[i + 1]); t.subVectors(b, a).normalize();
    up.set(0, 0, 1); if (Math.abs(t.dot(up)) > 0.9) up.set(1, 0, 0);
    s.crossVectors(t, up).normalize(); n.crossVectors(s, t).normalize();
    const f0 = 1 - (1 - taper) * i / (pts.length - 1), f1 = 1 - (1 - taper) * (i + 1) / (pts.length - 1);
    const C = (p, f, ss, nn) => [p.x + s.x * ss * w / 2 * f + n.x * nn * d / 2 * f, p.y + s.y * ss * w / 2 * f + n.y * nn * d / 2 * f, p.z + s.z * ss * w / 2 * f + n.z * nn * d / 2 * f];
    const sq = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let q = 0; q < 4; q++) { const p0 = sq[q], p1 = sq[(q + 1) % 4]; B.quad(C(a, f0, ...p0), C(a, f0, ...p1), C(b, f1, ...p1), C(b, f1, ...p0), [0, 0], [0.1, 0], [0.1, 0.5], [0, 0.5], k); }
  }
}
// fit a geometry into a box (w across, h up from 0, l along local z), centred on its axis
function fitBox(geo, w, h, l) {
  geo.computeBoundingBox(); const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  geo.scale(w / (b.max.x - b.min.x), h / (b.max.y - b.min.y), l / (b.max.z - b.min.z)); return geo;
}
function shapes() {
  if (SHAPES) return SHAPES;
  const X = textures();
  const post = new THREE.CylinderGeometry(0.7, 1, 1, 8); post.translate(0, 0.5, 0);
  const mast = new THREE.CylinderGeometry(0.62, 1, 1, 10); mast.translate(0, 0.5, 0);
  const tex = grassTexture(), mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
  sway(mat, 1.55, 0.42); sway(depth, 1.55, 0.42);
  const floraMat = new THREE.MeshStandardMaterial({ map: X.flora, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, envMapIntensity: 0.3 });
  sway(floraMat, 1.0, 0.12);
  // gorse: a lumpy dome (an icosphere pushed about), dark spines and yellow flowers
  const gorse = new THREE.IcosahedronGeometry(1, 1), gp = gorse.attributes.position;
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), z = gp.getZ(i), f = 0.8 + 0.35 * hash(Math.round(x * 3), Math.round(z * 3) + Math.round(y * 3) * 7); gp.setXYZ(i, x * f, Math.max(-0.15, y) * f * 0.8, z * f); }
  gorse.computeVertexNormals();
  // birds and beasts (vertex-coloured kits): a gull standing, a gull flying (the instance's y scale flaps it), an
  // oystercatcher, a seal
  const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h), Cy = (a, b, h, n = 8) => new THREE.CylinderGeometry(a, b, h, n);
  const white = lin([238, 238, 234]), gullG = lin([150, 156, 164]), black = lin([24, 24, 26]), yellow = lin([230, 196, 60]), orange = lin([230, 100, 30]), pink = lin([210, 140, 130]);
  const gull = kit([[S(1), Mx(0, 0.24, 0, 0, 0, 0, 0.13, 0.12, 0.24), white], [S(1), Mx(0, 0.37, -0.19, 0, 0, 0, 0.075, 0.075, 0.085), white], [S(1), Mx(0, 0.31, 0.04, 0, 0, 0, 0.15, 0.06, 0.24), gullG],
    [Cy(0.005, 0.03, 0.09, 6), Mx(0, 0.36, -0.29, -Math.PI / 2, 0, 0), yellow], [S(1, 6, 4), Mx(0, 0.28, 0.25, 0, 0, 0, 0.06, 0.03, 0.08), black], [Cy(0.012, 0.012, 0.14, 4), Mx(0.04, 0.07, 0), yellow], [Cy(0.012, 0.012, 0.14, 4), Mx(-0.04, 0.07, 0), yellow]]);
  const flyer = (() => { const B = ubatch(); const wing = sgn => { const r = [sgn * 0.08, 0, 0], m = [sgn * 0.42, 0.1, 0.05], tip = [sgn * 0.75, 0.22, 0.12];
    B.tri(r, m, [sgn * 0.08, 0, 0.2], [0, 0], [0, 0], [0, 0], gullG); B.tri([sgn * 0.08, 0, -0.1], m, r, [0, 0], [0, 0], [0, 0], gullG); B.tri(m, tip, [sgn * 0.44, 0.1, 0.16], [0, 0], [0, 0], [0, 0], black); };
    wing(1); wing(-1); return mergeGeos([B.geo(), paint(S(1).applyMatrix4(Mx(0, 0, 0, 0, 0, 0, 0.07, 0.06, 0.22)), white), paint(S(1).applyMatrix4(Mx(0, 0.02, -0.2, 0, 0, 0, 0.05, 0.05, 0.06)), white)]); })();
  const oyster = kit([[S(1), Mx(0, 0.2, 0, 0, 0, 0, 0.1, 0.09, 0.18), black], [S(1), Mx(0, 0.17, 0.02, 0, 0, 0, 0.09, 0.07, 0.15), white], [S(1), Mx(0, 0.3, -0.13, 0, 0, 0, 0.06, 0.06, 0.07), black],
    [Cy(0.008, 0.016, 0.13, 5), Mx(0, 0.29, -0.24, -Math.PI / 2 + 0.2, 0, 0), orange], [Cy(0.01, 0.01, 0.12, 4), Mx(0.03, 0.06, 0), pink], [Cy(0.01, 0.01, 0.12, 4), Mx(-0.03, 0.06, 0), pink]]);
  const sealK = lin([92, 88, 82]), sealD = lin([60, 56, 52]);
  const seal = kit([[S(1, 12, 8), Mx(0, 0.28, 0, 0, 0, 0, 0.42, 0.3, 0.95), sealK], [S(1, 10, 8), Mx(0, 0.42, -0.95, 0.3, 0, 0, 0.2, 0.19, 0.25), sealD], [S(1, 8, 6), Mx(0, 0.14, 0.95, 0, 0, 0, 0.3, 0.08, 0.25), sealD]]);
  // flotsam: a barrel, a spar, a coil of rope, a crate, an oar; creels (lobster pots) and a fence post
  const wood = lin([150, 142, 128]), woodD = lin([96, 86, 72]), hoop = lin([62, 50, 40]), rope = lin([170, 150, 110]);
  const barrel = kit([[Cy(0.29, 0.29, 0.85, 12), Mx(0, 0.29, 0, 0, 0, Math.PI / 2), woodD], [Cy(0.33, 0.33, 0.06, 12), Mx(0.24, 0.29, 0, 0, 0, Math.PI / 2), hoop], [Cy(0.33, 0.33, 0.06, 12), Mx(-0.24, 0.29, 0, 0, 0, Math.PI / 2), hoop], [Cy(0.34, 0.34, 0.06, 12), Mx(0, 0.29, 0, 0, 0, Math.PI / 2), hoop]]);
  const spar = kit([[Cy(0.1, 0.14, 5, 7), Mx(0, 0.11, 0, 0, 0, Math.PI / 2), wood]]);
  const coil = kit([[new THREE.TorusGeometry(0.34, 0.06, 5, 14), Mx(0, 0.06, 0, Math.PI / 2, 0, 0), rope], [new THREE.TorusGeometry(0.22, 0.05, 5, 12), Mx(0.05, 0.14, 0, Math.PI / 2, 0, 0), rope]]);
  const crate = kit([[new THREE.BoxGeometry(0.8, 0.55, 0.6), Mx(0, 0.24, 0, 0.1, 0, 0.15), wood], [new THREE.BoxGeometry(0.84, 0.08, 0.64), Mx(0, 0.5, 0, 0.1, 0, 0.15), woodD]]);
  const oar = kit([[Cy(0.035, 0.035, 2.6, 6), Mx(0, 0.04, 0, 0, 0, Math.PI / 2), wood], [new THREE.BoxGeometry(0.75, 0.03, 0.16), Mx(1.5, 0.04, 0), wood]]);
  const creel = kit([[new THREE.CylinderGeometry(0.3, 0.3, 0.7, 10, 1, false, 0, Math.PI), Mx(0, 0.02, 0, 0, 0, Math.PI / 2, 1, 1, 1), lin([120, 104, 80])], [new THREE.BoxGeometry(0.62, 0.05, 0.72), Mx(0, 0.02, 0), lin([80, 66, 50])]]);
  const fpost = new THREE.CylinderGeometry(0.055, 0.075, 1, 6); fpost.translate(0, 0.5, 0);
  return (SHAPES = { post, mast, grassMat: mat, grassDepth: depth, clump: cards(4, 1.3, 1.55, 0.35), thrift: cards(2, 0.32, 0.36, 0, 0, 1 / 3), holly: cards(2, 0.3, 0.45, 0, 1 / 3, 2 / 3), reed: cards(3, 0.9, 2.2, 0.08, 2 / 3, 1), floraMat, gorse, gull, flyer, oyster, seal, flotsam: [barrel, spar, coil, crate, oar], creel, fpost });
}

/* ---------- the water: a mask over the 10 m map (world space) the water shader reads ---------- */
// R the open sea (1) or the lagoon (0), G the Cauldron, B metres out from the waterline (0..80), A the bar: 0.5 at
// its crest, +1 per 100 m toward the land (0 or 1 well off it)
let MASK = null;
function waterMask(E) {
  if (MASK) return MASK;
  const WM = E.world, nx = WM.nx, nz = WM.nz, n = nx * nz, d = new Uint8Array(n * 4), wet = new Uint8Array(n), hh = new Float32Array(n);
  for (let k = 0; k < n; k++) { wet[k] = WM.mDec[k] === 8 ? 1 : 0; hh[k] = WM.hDec[k] / WM.scale + WM.y0; }
  const C = E.cauldron, inCaul = (X, Z) => { const se = (o, p) => { const dx = X - o.c[0], dz = Z - o.c[1], u = (dx * Math.cos(o.rot) + dz * Math.sin(o.rot)) / o.rx, v = (-dx * Math.sin(o.rot) + dz * Math.cos(o.rot)) / o.rz; return Math.pow(Math.abs(u), p) + Math.pow(Math.abs(v), p); }; return C && (se(C, C.p) < 1.6 || se(C.mouth, 2) < 1.6); };
  const bar = E.bar || [], barSD = (X, Z) => { let best = Infinity, sg = 1; for (let i = 1; i < bar.length; i++) { const [ax, az] = bar[i - 1], [bx, bz] = bar[i], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((X - ax) * ex + (Z - az) * ez) / (ex * ex + ez * ez))), dd = Math.hypot(X - ax - ex * t, Z - az - ez * t); if (dd < best) { best = dd; sg = Math.sign(ex * (Z - az) - ez * (X - ax)) || 1; } } return best * sg; };
  const R = 9;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, X = WM.x0 + i * WM.cell, Z = WM.z0 + j * WM.cell, o = k * 4;
    const cal = inCaul(X, Z) && X > -120 ? 1 : 0, sea = !cal && (X < -250 || (Z < -1750 && X < 250)) ? 1 : 0;
    d[o] = sea * 255; d[o + 1] = cal * 255;
    if (wet[k]) {   // the nearest waterline: past each land cell by how far up the beach it stands (0.35 m at the edge, 0.052 a metre)
      let best = 80;
      for (let q = -R; q <= R; q++) for (let p = -R; p <= R; p++) { const ii = i + p, jj = j + q; if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue; const kk = jj * nx + ii; if (wet[kk]) continue;
        const inl = Math.max(0, Math.min(9.5, (hh[kk] - 0.35) / 0.052)), dd = Math.hypot(p, q) * WM.cell - inl; if (dd < best) best = dd; }
      d[o + 2] = Math.round(Math.max(0, Math.min(80, best)) / 80 * 255);
    }
    const sd = sea ? barSD(X, Z) : 1e9;
    d[o + 3] = Math.abs(sd) < 60 ? Math.round(Math.max(0, Math.min(1, 0.5 + sd / 100)) * 255) : 0;
  }
  // the bar's sign: + toward the land (test a point between it and the coast)
  if (bar.length && barSD(-400, -800) < 0) for (let k = 0; k < n; k++) if (d[k * 4 + 3]) d[k * 4 + 3] = 255 - d[k * 4 + 3];
  const t = new THREE.DataTexture(d, nx, nz, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return (MASK = { tex: t, min: new THREE.Vector2(WM.x0, WM.z0), size: new THREE.Vector2((nx - 1) * WM.cell, (nz - 1) * WM.cell), half: new THREE.Vector2(0.5 / nx, 0.5 / nz) });
}
function waterMaterial(mask, frame, east, north) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0, envMapIntensity: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSun: SKY.sunU, uEast: { value: east }, uNorth: { value: north }, uLT: U.uLTime, uHaze: SKY.hazeU, uMask: { value: mask.tex }, uMaskMin: { value: mask.min }, uMaskSize: { value: mask.size }, uMaskHalf: { value: mask.half }, uFrame: { value: frame } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vLW; uniform sampler2D uMask; uniform vec2 uMaskMin, uMaskSize, uMaskHalf; uniform vec4 uFrame;
${SKY_GLSL}
vec3 wN = vec3(0.0, 1.0, 0.0); float wFoam = 0.0, wLag = 0.0;
vec2 wave(vec2 X, vec2 dir, float lam, float amp, float t) { float k = 6.2832 / lam; return dir * (amp * k * cos(dot(dir, X) * k - sqrt(9.8 * k) * t)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  // where this is: world X and Z from the hole's frame, then the mask
  vec2 Xw = vec2(uFrame.x + vLW.x * uFrame.z - vLW.z * uFrame.w, uFrame.y + vLW.x * uFrame.w + vLW.z * uFrame.z);
  vec2 mst = uMaskHalf + (Xw - uMaskMin) / uMaskSize * (1.0 - 2.0 * uMaskHalf);
  float inM = step(0.0, mst.x) * step(mst.x, 1.0) * step(0.0, mst.y) * step(mst.y, 1.0);
  vec4 Mk = mix(vec4(step(Xw.x, 980.0), 0.0, 1.0, 0.0), texture2D(uMask, clamp(mst, 0.0, 1.0)), inM);
  float sea = Mk.r, cal = Mk.g, dS = Mk.b * 80.0, tW = uLT; wLag = (1.0 - sea) * (1.0 - cal);
  float cdW = length(cameraPosition - vLW), fine = 1.0 - smoothstep(60.0, 360.0, cdW);
  // the swell off the sea (out of the west-south-west), a chop on it; the lagoon nearly still; the Cauldron choppy
  vec2 sl = sea * (wave(Xw, vec2(0.94, -0.34), 48.0, 0.32, tW) + wave(Xw, vec2(0.81, -0.59), 23.0, 0.14, tW) + wave(Xw, vec2(0.99, 0.14), 11.0, 0.06, tW));
  sl += (sea + cal) * fine * (wave(Xw, vec2(0.62, -0.78), 5.3, 0.028, tW) + wave(Xw, vec2(0.95, 0.31), 3.1, 0.014, tW) + wave(Xw, vec2(0.2, -0.98), 1.9, 0.007, tW));
  sl += cal * (wave(Xw, vec2(-0.7, -0.7), 4.1, 0.022, tW) + wave(Xw, vec2(0.3, 0.95), 2.7, 0.012, tW));
  { vec2 q0 = Xw * 0.9 + vec2(tW * 0.4, -tW * 0.3); float n0 = lsn(q0); sl += (cal + sea * 0.4 + wLag * 0.12) * fine * vec2(lsn(q0 + vec2(0.3, 0.0)) - n0, lsn(q0 + vec2(0.0, 0.3)) - n0) * 0.3; }
  sl *= 1.0 - smoothstep(1.0, 9.0, 8.0 - dS) * 0.5;
  wN = normalize(vec3(-(sl.x * uFrame.z + sl.y * uFrame.w), 1.0, -(-sl.x * uFrame.w + sl.y * uFrame.z)));
  // surf: lines of broken water running in to the sea's beaches, the swash white at the edge; the lagoon and the
  // Cauldron just lap at theirs
  float nb = lsn(Xw * 0.08 + vec2(tW * 0.05, 0.0));
  float ln = pow(0.5 + 0.5 * sin((dS * 0.1 + tW * 0.14 + nb * 1.2) * 6.2832), 10.0) * (1.0 - smoothstep(6.0, 55.0, dS)) * smoothstep(0.3, 0.62, lsn(Xw * vec2(0.03, 0.05) + vec2(0.0, tW * 0.02)));
  float swash = 1.0 - smoothstep(0.5, 6.0 + 3.0 * nb, dS);
  float surf = sea * clamp(ln * 0.9 + swash * (0.5 + 0.5 * lsn(Xw * 0.45 + tW * 0.35)), 0.0, 1.0);
  surf += (1.0 - sea) * (1.0 - smoothstep(0.3, 2.5, dS)) * 0.45 * lsn(Xw * 0.6 + tW * 0.2);
  // breakers on the bar: a white line where the swell trips over it, foam rolling in behind it, broken in places
  float sdb = (Mk.a - 0.5) * 100.0, onBar = sea * step(0.01, Mk.a) * step(Mk.a, 0.99);
  float brk = (1.0 - smoothstep(3.0, 14.0, abs(sdb + 3.0))) * smoothstep(0.32, 0.6, lsn(Xw * 0.012 + vec2(tW * 0.012, 0.0)) + 0.18) * (0.75 + 0.25 * sin(tW * 0.7 + Xw.y * 0.01));
  float rl = pow(0.5 + 0.5 * sin((sdb * 0.085 - tW * 0.13) * 6.2832 + nb * 2.0), 8.0) * smoothstep(0.0, 6.0, sdb) * (1.0 - smoothstep(8.0, 44.0, sdb)) * smoothstep(0.35, 0.6, lsn(Xw * 0.02 + 3.0));
  wFoam = clamp(surf + onBar * (brk + rl * 0.6), 0.0, 1.0) * (0.7 + 0.3 * lsn(Xw * 1.4));
  // the water's colour: the sea deep blue-green, paler over the sand close in, the lagoon dark, the Cauldron green
  vec3 wc = mix(vec3(0.07, 0.14, 0.13), vec3(0.028, 0.065, 0.085), smoothstep(4.0, 70.0, dS));
  wc = mix(wc, vec3(0.022, 0.045, 0.055), wLag);
  wc = mix(wc, vec3(0.035, 0.1, 0.07), cal);
  diffuseColor.rgb = mix(wc, vec3(0.88, 0.9, 0.88), wFoam);
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(mix(0.13, 0.06, wLag), 0.85, wFoam) + smoothstep(400.0, 4000.0, length(cameraPosition - vLW)) * 0.06;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`)
      .replace('#include <output_fragment>', `{ vec3 Vd = normalize(vLW - cameraPosition); vec3 Rf = reflect(Vd, wN); Rf.y = abs(Rf.y) + 0.01;
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(-Vd, wN), 0.0), 5.0);
  outgoingLight += linksSkyLo(normalize(Rf)) * fr * (1.0 - wFoam) * 0.9; }
#include <output_fragment>`);
  };
  m.customProgramCacheKey = () => 'linkswater';
  return m;
}

export function buildLinks(hole, T, box, E, hi, { group, coarse, rockMat }) {
  const S = shapes(), X = textures(), anims = [];
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const bear = deg => { const b = deg * Math.PI / 180 - a; return new THREE.Vector2(Math.sin(b), -Math.cos(b)); };   // a compass direction in the frame
  const east = bear(90), north = bear(0);
  U.uLWind.value.copy(bear(45)); U.uLNorth.value.copy(north); U.uLSea.value = LY(E.level);
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2;
  const near = (X, Z, r) => { const [x, z] = L(X, Z); return Math.hypot(x - cx, z - cz) < r; };
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const R = rng(1009 + hi * 31);

  // ---- the spit from the 10 m map: this hole's field where it has one (so the edges meet the playfield), drawn in
  // the ground shader (aW: x fescue, y beach, z another hole's mown ground, w stone)
  const WM = E.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); if (WM.pred) unpackHeights(WM.hDec, WM.nx); WM.mDec = dec(WM.m, Uint8Array); }
  const wH = (i, j) => WM.hDec[j * WM.nx + i] / WM.scale + WM.y0;
  const wy = (X, Z) => { const fx = Math.max(0, Math.min(WM.nx - 1.001, (X - WM.x0) / WM.cell)), fz = Math.max(0, Math.min(WM.nz - 1.001, (Z - WM.z0) / WM.cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (wH(i, j) * (1 - u) + wH(i + 1, j) * u) * (1 - v) + (wH(i, j + 1) * (1 - u) + wH(i + 1, j + 1) * u) * v; };
  const ground = (X, Z) => { const [x, z] = L(X, Z); if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return LY(wy(X, Z)); };
  const groundMesh = (Vt, Wt, idx) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, rockMat); m.receiveShadow = true; m.castShadow = false; return m;
  };
  const wOf = m => [m === 1 ? 1 : 0, m === 2 ? 1 : 0, m === 10 ? 1 : 0, m === 4 || m === 3 ? 1 : 0];
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
  // ---- out past it: the sea, the lagoon, the mainland and the far shore, from the 60 m map
  {
    const FM = E.far; if (!FM.hDec) { FM.hDec = dec(FM.h, Int16Array); if (FM.pred) unpackHeights(FM.hDec, FM.nx); FM.mDec = dec(FM.m, Uint8Array); }
    const st = coarse ? 2 : 1, ni = Math.floor((FM.nx - 1) / st), nj = Math.floor((FM.nz - 1) / st);
    const ix0 = WM.x0 + 40, ix1 = WM.x0 + (WM.nx - 1) * WM.cell - 40, iz0 = WM.z0 + 40, iz1 = WM.z0 + (WM.nz - 1) * WM.cell - 40;
    const Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Wx = new Float32Array((ni + 1) * (nj + 1) * 2);
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = FM.x0 + I * FM.cell, Z = FM.z0 + J * FM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i, m = FM.mDec[J * FM.nx + I];
      Vt.set([x, LY(FM.hDec[J * FM.nx + I] / FM.scale + FM.y0) - (m === 8 ? 1.6 : 0.6), z], k * 3); Wx.set([X, Z], k * 2); Wt.set(wOf(m), k * 4);
    }
    const idx = [], inner = q => Wx[q * 2] > ix0 && Wx[q * 2] < ix1 && Wx[q * 2 + 1] > iz0 && Wx[q * 2 + 1] < iz1;
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1; if (inner(k) && inner(k1) && inner(k2) && inner(k3)) continue; split(Vt, idx, k, k1, k2, k3); }
    group.add(groundMesh(Vt, Wt, idx));
  }

  // ---- the sea, the lagoon, the Cauldron and the creek: one sheet at sea level (every bed is drawn under it)
  {
    const g = new THREE.PlaneGeometry(19000, 19000); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, waterMaterial(waterMask(E), new THREE.Vector4(F.x, F.z, Math.cos(a), Math.sin(a)), east, north));
    m.position.set(cx, LY(E.level) - 0.03, cz); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
    // humps of sand showing on the bar, wet at their edges
    const hg = [];
    for (const [Xh, Zh, rxh, rzh, rot] of E.humps || []) { if (!near(Xh, Zh, 4000)) continue; const [x, z] = L(Xh, Zh), sg = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = sg.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i); c.set(mixC(lin([118, 108, 88]), lin([196, 182, 150]), Math.min(1, y * 2.2)), i * 3); }
      sg.setAttribute('color', new THREE.BufferAttribute(c, 3)); sg.applyMatrix4(Mx(x, LY(E.level) - 0.6, z, 0, -(rot - a), 0, rxh, 1.15, rzh)); hg.push(sg); }
    const hm = mergeGeos(hg); if (hm) { const mm = new THREE.Mesh(hm, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); mm.receiveShadow = true; group.add(mm); }
  }

  // ---- the built things and the wrecks. Materials: silvered planking (two textures: plain, and with gunports),
  // tarred planking, whitewash, slate, grey stone, plain vertex colour, and lamps that glow
  const M = {
    planks: new THREE.MeshStandardMaterial({ map: X.planks, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
    ports: new THREE.MeshStandardMaterial({ map: X.ports, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
    tar: new THREE.MeshStandardMaterial({ map: X.planks, vertexColors: true, roughness: 0.5, metalness: 0, side: THREE.DoubleSide }),
    white: new THREE.MeshStandardMaterial({ map: X.white, emissiveMap: X.whiteEm, emissive: 0xffffff, emissiveIntensity: 0.9, vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    slate: new THREE.MeshStandardMaterial({ map: X.slate, vertexColors: true, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ map: X.stone, vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
    plain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide }),
  };
  const P = { planks: [], ports: [], tar: [], white: [], slate: [], stone: [], plain: [], glow: [] };
  const silver = lin([206, 204, 198]), silverD = lin([150, 146, 138]), weedK = lin([44, 54, 34]), iron = lin([70, 50, 38]), tarK = lin([22, 21, 20]);
  // a placed local thing: local x across, y up, z along the length (rot: the compass direction of the length)
  const placeM = (Xp, Zp, y, rot, lx = 0, lz = 0) => { const [x, z] = L(Xp, Zp), r = rot - a; return new THREE.Matrix4().makeRotationY(-r).setPosition(x, y, z); };
  // a prism: corners (local [x, z]) from y0 to y1, sides textured in metres (uS along, vS up), `tk` tapers the top;
  // into a ubatch through `put`
  const prism = (Bt, put, cs, y0, y1, k, uS = 8, vS = 8, tk = 1, cap = true, kt = k) => {
    let acc = 0;
    for (let i = 0; i < cs.length; i++) { const p = cs[i], q = cs[(i + 1) % cs.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      Bt.quad(put(p[0], y0, p[1]), put(q[0], y0, q[1]), put(q[0] * tk, y1, q[1] * tk), put(p[0] * tk, y1, p[1] * tk), [acc / uS, y0 / vS], [(acc + l) / uS, y0 / vS], [(acc + l) / uS, y1 / vS], [acc / uS, y1 / vS], i % 2 ? k : k.map(v => v * 0.88)); acc += l; }
    if (cap) for (let i = 1; i < cs.length - 1; i++) Bt.tri(put(cs[0][0] * tk, y1, cs[0][1] * tk), put(cs[i + 1][0] * tk, y1, cs[i + 1][1] * tk), put(cs[i][0] * tk, y1, cs[i][1] * tk), [cs[0][0] / uS, cs[0][1] / uS], [cs[i + 1][0] / uS, cs[i + 1][1] / uS], [cs[i][0] / uS, cs[i][1] / uS], kt);
  };
  const rect = (w, l, ox = 0, oz = 0) => [[ox - w / 2, oz - l / 2], [ox + w / 2, oz - l / 2], [ox + w / 2, oz + l / 2], [ox - w / 2, oz + l / 2]];
  const putOf = (Mt) => { const v = new THREE.Vector3(); return (x, y, z) => { v.set(x, y, z).applyMatrix4(Mt); return [v.x, v.y, v.z]; }; };
  const lamps = [], masts = [], smokes = [], perch = [];
  const ribs = E.built.filter(B => B.kind === 'rib'), ribC = ribs.length ? ribs.reduce((s, B) => [s[0] + B.at[0] / ribs.length, s[1] + B.at[1] / ribs.length], [0, 0]) : null;
  for (const B of E.built) {
    if (!near(B.at[0], B.at[1], 2600)) continue;
    const y0 = LY(B.y), Mt = placeM(B.at[0], B.at[1], y0, B.rot || 0), put = putOf(Mt);
    if (B.kind === 'hull' && !B.sunk) {
      if (B.l > 50) {   // the man-of-war: upright, listing to seaward, two tiers of gunports, stove in toward her bow
        const [h, f] = hullGeo({ L: 64, beam: 14, D: 11, n: 40, m: 16, transom: 0.62, wl: 0.4, top: silver, weed: weedK, vS: 8, holes: [[0.66, 0.8, 0.08, 0.4], [0.2, 0.27, 0.62, 0.8]], deckHole: [0.55, 0.85] });
        for (const g of [h, f]) { if (!g) continue; g.applyMatrix4(Mx(0, 0, 0, 0, 0, -0.17)); }
        const sink = 1.2; fitBox(h, B.w, B.h + sink, B.l); h.translate(0, -sink, 0); h.applyMatrix4(Mt); P.ports.push(h);
        if (f) { fitBox(f, B.w * 0.95, B.h * 0.95 + sink, B.l * 0.96); f.translate(0, -sink, 0); f.applyMatrix4(Mt); P.planks.push(f); }
        for (const [s, hm, r] of [[-0.18, 13, 0.55], [0.12, 9, 0.5], [0.34, 6.5, 0.45]]) masts.push({ base: put(0.4, B.h - 1.2, s * B.l), h: hm, r, lean: 0, yards: hm > 10 ? 1 : 0 });
        perch.push([B.at, B.y + B.h]);
      } else {         // the galleon on her side across the 3rd's hollow, her deck toward the tee, broken open
        const [h, f] = hullGeo({ L: 40, beam: 11, D: 8.5, n: 32, m: 14, transom: 0.55, wl: 0.3, top: silver, weed: weedK, holes: [[0.35, 0.5, 0.55, 0.85], [0.6, 0.68, 0.2, 0.36]], deckHole: [0.3, 0.62], frames: 2 });
        const roll = Mx(0, 0, 0, 0, 0, -0.98), sink = 0.8;
        h.applyMatrix4(roll); fitBox(h, B.w, B.h + sink, B.l); h.translate(0, -sink, 0); h.applyMatrix4(Mt); P.planks.push(h);
        if (f) { f.applyMatrix4(roll); fitBox(f, B.w * 0.9, B.h + sink - 0.6, B.l * 0.95); f.translate(0, -sink, 0); f.applyMatrix4(Mt); P.planks.push(f); }
      }
    } else if (B.kind === 'castle') {   // her stern castle, wrenched upright: a tall planked block, gallery windows, an iron-strapped rudder
      const Bt = ubatch(), w = B.w, l = B.l, hh = B.h;
      prism(Bt, put, rect(w, l), -1, hh * 0.72, silver, 8, 4, 0.94, false);
      prism(Bt, put, rect(w * 0.94 * 0.86, l * 0.94 * 0.86), hh * 0.72, hh, silverD, 8, 4, 0.88, true, silverD);
      for (let i = 0; i < 5; i++) for (const yy of [hh * 0.5, hh * 0.78]) { const xx = -w * 0.36 + i * w * 0.18, z0 = -l / 2 - 0.06; Bt.quad(put(xx - 0.6, yy, z0), put(xx + 0.6, yy, z0), put(xx + 0.6, yy + 1.3, z0), put(xx - 0.6, yy + 1.3, z0), [0, 0], [0, 0], [0, 0], [0, 0], lin([26, 24, 22])); }
      sweep(Bt, [put(0, -0.5, -l / 2 - 0.4), put(0, hh * 0.6, -l / 2 - 0.5)], 0.7, 0.9, silverD);
      for (const yy of [1.5, 3.5, 5.5]) sweep(Bt, [put(-0.5, yy, -l / 2 - 0.92), put(0.5, yy, -l / 2 - 0.92)], 0.12, 0.12, iron);
      P.planks.push(Bt.geo()); perch.push([B.at, B.y + B.h]);
    } else if (B.kind === 'lugger') {   // a fishing lugger hauled up: tarred black, a coloured strake, mast down on a crutch, sail furled
      const sk = [lin([150, 40, 30]), lin([40, 80, 120]), lin([60, 110, 70])][Math.floor(hash(B.at[0], B.at[1]) * 3)];
      const [h, f] = hullGeo({ L: B.l, beam: B.w, D: B.h * 0.85, n: 18, m: 10, transom: 0, wl: 0.25, top: tarK, weed: lin([40, 40, 36]), strake: sk, sheer: 0.16, deckK: lin([120, 112, 100]) });
      const list = Mx(0, 0, 0, 0, 0, (hash(B.at[1], 3) - 0.5) * 0.25);
      h.applyMatrix4(list); h.translate(0, -0.2, 0); h.applyMatrix4(Mt); P.tar.push(h);
      if (f) { f.applyMatrix4(list); f.translate(0, -0.2, 0); f.applyMatrix4(Mt); P.planks.push(f); }
      const Bt = ubatch(), spar = lin([110, 98, 82]);   // a short mast forward, her brown sail furled on its yard, a mizzen stub aft
      sweep(Bt, [put(0, 0.3, -B.l * 0.28), put(0, B.h + 4.2, -B.l * 0.3)], 0.17, 0.17, spar, 0.6);
      sweep(Bt, [put(-0.2, B.h + 3.1, -B.l * 0.12), put(0.2, B.h + 3.6, -B.l * 0.46)], 0.42, 0.36, lin([96, 66, 48]), 0.7);
      sweep(Bt, [put(0, 0.3, B.l * 0.36), put(0, B.h + 2.0, B.l * 0.37)], 0.13, 0.13, spar, 0.7);
      P.plain.push(Bt.geo()); perch.push([B.at, B.y + B.h]);
    } else if (B.kind === 'rib') {   // the brig's ribs: curved timbers out of the sand, bending in toward her middle; a few planks hang on
      const [x0, z0] = L(B.at[0], B.at[1]), [xc, zc] = L(...ribC), dl = Math.hypot(xc - x0, zc - z0) || 1, ix = (xc - x0) / dl, iz = (zc - z0) / dl, top = B.h * (0.82 + 0.18 * hash(B.at[0], 7));
      const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push([x0 - ix * 0.5 + ix * 1.3 * t * t, y0 - 0.4 + top * t, z0 - iz * 0.5 + iz * 1.3 * t * t]); }
      const Bt = ubatch(); sweep(Bt, pts, 0.4, 0.48, mixC(silver, weedK, 0.35), 0.62); B._pts = pts; P.planks.push(Bt.geo());
    } else if (B.kind === 'wall') {   // the inn's yard wall: grey stone, a rounded cope
      const Bt = ubatch(); prism(Bt, put, rect(B.w, B.l), -0.4, B.h, lin([170, 168, 160]), 8, 8, 0.9, true, lin([120, 126, 104])); P.stone.push(Bt.geo());
    } else if (B.kind === 'inn') {
      // the Wrecker's Inn: two whitewashed ranges side by side under slate, the stern castle of a wreck built into its
      // seaward end as a timber wing, stone stacks smoking at the gables
      const w = B.w, l = B.l, wallH = B.h * 0.6, ridge = B.h, castL = 8, mainL = l - castL, zc = -castL / 2;
      const Bw = ubatch(), Bs = ubatch(), Bp = ubatch(), Bg = ubatch(), Bst = ubatch();
      const wallK = lin([255, 255, 255]);
      prism(Bw, put, rect(w, mainL, 0, zc), -0.6, wallH, wallK, 16, 8, 1, false);
      for (const sg of [-1, 1]) {   // the gables of the two ranges, at each end
        for (const ze of [zc - mainL / 2, zc + mainL / 2]) { const xm = sg * w / 4; Bw.tri(put(xm - w / 4, wallH, ze), put(xm + w / 4, wallH, ze), put(xm, ridge, ze), [0, wallH / 8], [w / 32, wallH / 8], [w / 64, ridge / 8], wallK); }
        const xm = sg * w / 4, ov = 0.6;
        for (const sd of [-1, 1]) {   // each range's two roof slopes
          const xe = xm + sd * (w / 4 + ov), ye = wallH - 0.25, sl = Math.hypot(w / 4 + ov, ridge - ye);
          const A = put(xm, ridge, zc - mainL / 2 - ov), Bq = put(xm, ridge, zc + mainL / 2 + ov), C = put(xe, ye, zc + mainL / 2 + ov), Dq = put(xe, ye, zc - mainL / 2 - ov);
          if (sd < 0) Bs.quad(A, Bq, C, Dq, [0, sl / 8], [(mainL + 2 * ov) / 8, sl / 8], [(mainL + 2 * ov) / 8, 0], [0, 0], lin([255, 255, 255]));
          else Bs.quad(Bq, A, Dq, C, [(mainL + 2 * ov) / 8, sl / 8], [0, sl / 8], [0, 0], [(mainL + 2 * ov) / 8, 0], lin([235, 235, 235]));
        }
      }
      // the stern-castle wing: planked, tumblehome, gallery windows lit warm, a carved rail
      const zw = mainL / 2 + zc + castL / 2;
      prism(Bp, put, rect(w * 0.46, castL, 0, zw), -0.6, ridge + 1.2, silver, 8, 4, 0.9, true, silverD);
      for (let i = 0; i < 4; i++) for (const yy of [3.4, 7.8]) { const xx = -w * 0.15 + i * w * 0.1, z1 = zw + castL / 2 + 0.05; Bg.quad(put(xx - 0.4, yy, z1), put(xx + 0.4, yy, z1), put(xx + 0.4, yy + 1.1, z1), put(xx - 0.4, yy + 1.1, z1), [0, 0], [0, 0], [0, 0], [0, 0], hash(i, yy) < 0.6 ? [1.5, 0.95, 0.42] : [0.05, 0.05, 0.05]); }
      // stacks on the ridges at the landward gables and in the middle, with pots
      for (const [xs, zs] of [[-w / 4, zc - mainL / 2 + 0.6], [w / 4, zc - mainL / 2 + 0.6], [w / 4, zc + 2]]) {
        prism(Bst, put, rect(1.6, 1.2, xs, zs), ridge - 2.5, ridge + 2.2, lin([200, 198, 190]), 8, 8, 1, true, lin([90, 88, 84]));
        prism(Bst, put, rect(0.4, 0.4, xs, zs), ridge + 2.2, ridge + 2.9, lin([150, 90, 60]), 2, 2, 0.85);
        smokes.push(put(xs, ridge + 3, zs));
      }
      P.white.push(Bw.geo()); P.slate.push(Bs.geo()); P.planks.push(Bp.geo()); P.glow.push(Bg.geo()); P.stone.push(Bst.geo());
      perch.push([B.at, B.y + B.h]);
    } else if (B.kind === 'mast') {
      { const [mx, mz] = L(B.at[0], B.at[1]); masts.push({ base: [mx, y0, mz], h: B.h, r: B.r, lean: B.lean || 0, yards: B.h >= 18 ? 2 : 0 }); }
    } else if (B.kind === 'lantern') {   // the false light: a lantern on a post, burning
      const [x, z] = L(B.at[0], B.at[1]), Bt = ubatch(), wd = lin([100, 90, 78]);
      sweep(Bt, [[x, y0, z], [x, y0 + B.h, z]], 0.32, 0.32, wd, 0.8); sweep(Bt, [[x, y0 + B.h - 0.3, z], [x + 1.4, y0 + B.h - 0.1, z]], 0.16, 0.16, wd);
      prism(Bt, (lx, ly, lz) => [x + 1.3 + lx, y0 + B.h - 1.4 + ly, z + lz], rect(0.6, 0.6), 0.9, 1.05, lin([40, 34, 30]), 1, 1, 0.5);
      P.plain.push(Bt.geo());
      const Bg = ubatch(); prism(Bg, (lx, ly, lz) => [x + 1.3 + lx, y0 + B.h - 1.4 + ly, z + lz], rect(0.5, 0.5), 0.1, 0.9, [2.6, 1.6, 0.6], 1, 1, 1); P.glow.push(Bg.geo());
      lamps.push([[x + 1.3, y0 + B.h - 0.9, z], 7, 0xffb060]);
    } else if (B.kind === 'bell') {   // the bell: two posts, a beam, a bronze bell
      const [x, z] = L(B.at[0], B.at[1]), Bt = ubatch(), wd = lin([110, 100, 88]);
      sweep(Bt, [[x - 0.9, y0, z], [x - 0.9, y0 + B.h, z]], 0.25, 0.25, wd); sweep(Bt, [[x + 0.9, y0, z], [x + 0.9, y0 + B.h, z]], 0.25, 0.25, wd); sweep(Bt, [[x - 1.2, y0 + B.h, z], [x + 1.2, y0 + B.h, z]], 0.3, 0.3, wd);
      P.plain.push(Bt.geo());
      const bell = new THREE.LatheGeometry([[0.02, 0], [0.42, 0], [0.38, 0.12], [0.28, 0.5], [0.24, 0.66], [0.02, 0.7]].map(p => new THREE.Vector2(p[0], p[1])), 12);
      P.plain.push(paint(bell, lin([96, 120, 96])).applyMatrix4(Mx(x, y0 + B.h - 0.85, z)));
    } else if (B.kind === 'beacon') {   // the beacon tower on the point: grey stone in courses, a corbelled gallery, the lantern lit
      const [x, z] = L(B.at[0], B.at[1]), r0 = B.r, r1 = B.r * 0.78, n = 20, Bt = ubatch(), Bg = ubatch();
      const ring = (r, y) => Array.from({ length: n + 1 }, (_, i) => [x + Math.cos(i / n * 6.2832) * r, y, z + Math.sin(i / n * 6.2832) * r]);
      const A = ring(r0, y0 - 0.5), C = ring(r1, y0 + B.h), circ = 6.2832 * r0;
      for (let i = 0; i < n; i++) Bt.quad(A[i], A[i + 1], C[i + 1], C[i], [i / n * circ / 8, 0], [(i + 1) / n * circ / 8, 0], [(i + 1) / n * circ / 8, B.h / 8], [i / n * circ / 8, B.h / 8], lin([196, 196, 190]));
      const G0 = ring(r1, y0 + B.h), G1 = ring(r1 * 1.25, y0 + B.h + 0.9), G2 = ring(r1 * 1.25, y0 + B.h + 1.4), top = [x, y0 + B.h + 1.4, z];
      for (let i = 0; i < n; i++) { Bt.quad(G0[i], G0[i + 1], G1[i + 1], G1[i], [0, 0], [0.2, 0], [0.2, 0.1], [0, 0.1], lin([170, 170, 164])); Bt.quad(G1[i], G1[i + 1], G2[i + 1], G2[i], [0, 0], [0.2, 0], [0.2, 0.1], [0, 0.1], lin([150, 150, 146])); Bt.tri(G2[i + 1], G2[i], top, [0, 0], [0.1, 0], [0, 0.1], lin([150, 150, 146])); }
      const yl = y0 + B.h + 1.4, L0 = ring(r1 * 0.62, yl), L1 = ring(r1 * 0.62, yl + 3.2), cap = [x, yl + 5.2, z];
      for (let i = 0; i < n; i++) { Bg.quad(L0[i], L0[i + 1], L1[i + 1], L1[i], [0, 0], [0, 0], [0, 0], [0, 0], i % 4 === 0 ? [0.08, 0.07, 0.06] : [2.6, 1.7, 0.7]); Bt.tri(L1[i + 1], L1[i], cap, [0, 0], [0.1, 0], [0, 0.1], lin([60, 64, 62])); }
      Bt.quad([x - 1, y0 - 0.2, z + r0 * 0.99], [x + 1, y0 - 0.2, z + r0 * 0.99], [x + 1, y0 + 2.6, z + r0 * 0.97], [x - 1, y0 + 2.6, z + r0 * 0.97], [0, 0], [0, 0], [0, 0], [0, 0], lin([40, 34, 28]));
      P.stone.push(Bt.geo()); P.glow.push(Bg.geo());
      lamps.push([[x, yl + 1.6, z], 16, 0xffc070]);
    }
  }
  // masts: tapered spars (instanced), yards across the tall ones, shrouds down to the water or the ground
  if (masts.length) {
    const im = new THREE.InstancedMesh(S.mast, new THREE.MeshStandardMaterial({ color: 0x5f5a52, roughness: 0.9 }), masts.length), Q = new THREE.Quaternion(), ax = new THREE.Vector3(), Bt = ubatch(), line = [];
    const [ex, ez] = [east.x, east.y];
    masts.forEach((m, i) => {
      const lean = m.lean * Math.PI / 180; if (!m.yards && m.h >= 12) m.yards = 1; Q.setFromAxisAngle(ax.set(ez, 0, -ex).normalize(), lean);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(Q), base = new THREE.Vector3(...m.base);
      im.setMatrixAt(i, new THREE.Matrix4().compose(base, Q, new THREE.Vector3(m.r, m.h, m.r)));
      const at = t => base.clone().addScaledVector(up, m.h * t);
      const side = new THREE.Vector3(ez, 0, -ex).normalize();   // across: the yards square to the old wind
      for (let k = 0; k < m.yards; k++) { const c = at(k ? 0.82 : 0.6), l = m.h * (k ? 0.34 : 0.5), tilt = (hash(i, k) - 0.5) * 0.5;
        sweep(Bt, [c.clone().addScaledVector(side, -l / 2).add(new THREE.Vector3(0, -tilt * l / 2, 0)).toArray(), c.clone().addScaledVector(side, l / 2).add(new THREE.Vector3(0, tilt * l / 2, 0)).toArray()], m.r * 0.5, m.r * 0.5, lin([120, 114, 104]), 0.6); }
      const tp = at(0.8), foot = Math.max(LY(E.level), m.base[1]);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const f = base.clone().addScaledVector(side, s * (m.h * 0.18 + k * 0.8)); f.y = foot; if (hash(i, k + s * 3) < 0.2) continue; line.push(tp.x, tp.y, tp.z, f.x, f.y, f.z); }
    });
    im.castShadow = true; im.receiveShadow = true; group.add(im);
    P.plain.push(Bt.geo());
    if (line.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(line, 3)); group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a2622, transparent: true, opacity: 0.7 }))); }
  }
  for (const k of Object.keys(P)) { const g = mergeGeos(P[k]); if (!g) continue; const m = new THREE.Mesh(g, M[k]); m.castShadow = k !== 'glow'; m.receiveShadow = k !== 'glow'; group.add(m); }
  // the lamps' halos (the false light and the beacon), additive, seen against the dusk
  for (const [p, s, c] of lamps) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: X.halo, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })); sp.position.set(...p); sp.scale.set(s, s, 1); sp.renderOrder = 4; group.add(sp); }

  // ---- dune grass: a clump on every field cell that plays as 'tussock' (what you see is what stops the ball), the
  // clusters out past the field from COURSE.links.grass, and an eyebrow of small clumps along the top edge of every
  // pot (drawn only). Each clump leans downwind of the prevailing sea wind (from the south-west) and sways.
  const L0 = L(0, 0), Le = L(Math.SQRT1_2, -Math.SQRT1_2), lean = Math.atan2(-(Le[1] - L0[1]), Le[0] - L0[0]);   // downwind (toward the north-east) in this frame
  const line = hole.line, dLine = (x, z) => { let d = Infinity; for (let i = 1; i < line.length; i++) { const [ax, az] = line[i - 1], [bx, bz] = line[i], ex = bx - ax, ez = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))); d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t)); } return d; };
  const inst = (geo, mat, list, shadow, depthMat, colour = true) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const Mt = new THREE.Matrix4(), Q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    list.forEach(([x, y, z, r, h, rot, k], i) => {
      m.setMatrixAt(i, Mt.compose(new THREE.Vector3(x, y, z), Q.setFromAxisAngle(up, rot ?? 0), new THREE.Vector3(r, h, r)));
      if (colour) { const t = hash(z * 1.3, x * 0.7); m.setColorAt(i, k ? C.setRGB(...k) : C.setRGB(0.85 + 0.25 * t, 0.88 + 0.2 * t, 0.82 + 0.12 * hash(x * 3, z))); }
    });
    m.castShadow = shadow; m.receiveShadow = true; group.add(m);
    if (shadow && depthMat) m.customDepthMaterial = depthMat;
    return m;
  };
  {
    const nearL = [], far = [], brow = [];
    if (Fd) {
      const cK = Fd.codes.indexOf('tussock');
      for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) {
        if (Fd.s[j * Fd.nx + i] !== cK) continue;
        const x = Fd.x0 + i * Fd.cell + (hash(i, j) - 0.5) * 1.1, z = Fd.z0 + j * Fd.cell + (hash(j, i) - 0.5) * 1.1, g = T.groundAt(x, z);
        if (g === null) continue;
        const dl = dLine(x, z); if (coarse && dl > 70 && (i + j) % 2) continue;
        (dl < (coarse ? 70 : 110) ? nearL : far).push([x, g - 0.06, z, 1.25 + 0.4 * hash(i + 3, j), 1.15 + 0.3 * hash(i, j + 5), lean + (hash(x, z) - 0.5) * 0.7]);
      }
    }
    // clusters whose middle is outside the field: filled with clumps on a grid over their ellipse
    for (const [Xc, Zc, rxc, rzc, rot] of E.grass || []) {
      const [cx0, cz0] = L(Xc, Zc); if (inField(cx0, cz0) || Math.hypot(cx0 - cx, cz0 - cz) > (coarse ? 520 : 800)) continue;
      const ca = Math.cos(rot), sa = Math.sin(rot);
      const st = coarse ? 3.6 : 3; for (let u = -rxc; u <= rxc; u += st) for (let v = -rzc; v <= rzc; v += st) {
        if ((u / rxc) ** 2 + (v / rzc) ** 2 > 0.9) continue;
        const Xp = Xc + u * ca - v * sa + (hash(u + Xc, v) - 0.5), Zp = Zc + u * sa + v * ca + (hash(v, u + Zc) - 0.5), [x, z] = L(Xp, Zp);
        far.push([x, LY(wy(Xp, Zp)) - 0.36, z, 1.55 + 0.4 * hash(Xp, Zp), 1.2 + 0.3 * hash(Zp, Xp), lean + (hash(x, z) - 0.5) * 0.7]);
      }
    }
    // eyebrows on the pots: small clumps along the higher half of each rim, just outside it
    for (const b of hole.bunkers || []) {
      if (b.lie !== 'pot' || !b.outline) continue;
      const O = b.outline, ys = O.map(p => T.groundAt(p[0], p[1]) ?? 0), mean = ys.reduce((s, v) => s + v, 0) / ys.length;
      let acc = 0;
      for (let i = 0; i < O.length; i++) { const p = O[i], q = O[(i + 1) % O.length]; acc += Math.hypot(q[0] - p[0], q[1] - p[1]); if (acc < 1.3) continue; acc = 0;
        if (ys[i] <= mean + 0.05) continue;
        const ox = p[0] - b.x, oz = p[1] - b.z, ol = Math.hypot(ox, oz) || 1, x = p[0] + ox / ol * 0.7, z = p[1] + oz / ol * 0.7, g = T.groundAt(x, z);
        if (g !== null) brow.push([x, g - 0.05, z, 0.45 + 0.15 * hash(x, z), 0.5 + 0.2 * hash(z, x), lean + (hash(x, z) - 0.5) * 0.7]); }
    }
    inst(S.clump, S.grassMat, nearL, !coarse, S.grassDepth);
    inst(S.clump, S.grassMat, brow, false);
    inst(S.clump, S.grassMat, far, false);
  }

  // ---- the small colour: thrift (pink) and sea holly (blue) in the fescue and on the dunes, gorse inland and round
  // the inn, reeds along the lagoon and the creek. In the field from its cells (off the line); beyond from the emitter
  {
    const thrift = [], holly = [], reeds = [], gorse = [];
    if (Fd) {
      const cG = Fd.codes.indexOf('rough'), cS = Fd.codes.indexOf('sand');
      for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) {
        const c = Fd.s[j * Fd.nx + i]; if (c !== cG && c !== cS) continue;
        const hv = hash(i * 1.7, j * 2.3); if (hv > (c === cG ? 0.07 : 0.025)) continue;
        const x = Fd.x0 + i * Fd.cell + (hash(j, i) - 0.5) * 1.8, z = Fd.z0 + j * Fd.cell + (hash(i + 9, j) - 0.5) * 1.8; if (dLine(x, z) < 22) continue;
        const g = T.groundAt(x, z); if (g === null) continue;
        const k = c === cG ? (hv < 0.04 ? 0 : 1) : (hv < 0.006 ? 0 : 1), s = 0.8 + 0.6 * hash(x, z);
        (k ? holly : thrift).push([x, g - 0.04, z, s, s, hash(z, x) * 6.28]);
      }
    }
    for (const [Xf, Zf, yf, k] of E.flowers || []) { const [x, z] = L(Xf, Zf); if (inField(x, z) || Math.hypot(x - cx, z - cz) > 700) continue; const s = 0.9 + 0.5 * hash(Xf, Zf); (k ? holly : thrift).push([x, LY(yf) - 0.04, z, s * 1.4, s * 1.4, hash(Zf, Xf) * 6.28]); }
    for (const [Xr, Zr, yr, s, wet] of E.reeds || []) { if (!near(Xr, Zr, 1400)) continue; const [x, z] = L(Xr, Zr), y = wet ? LY(yr) - 0.25 : ground(Xr, Zr) - 0.1; reeds.push([x, y, z, s * 1.1, s * (wet ? 1.15 : 0.95), lean + (hash(Xr, Zr) - 0.5) * 1.2]); }
    for (const [Xg, Zg, yg, s] of E.gorse || []) { if (!near(Xg, Zg, 1500)) continue; const [x, z] = L(Xg, Zg); gorse.push([x, ground(Xg, Zg) - 0.15 * s, z, s, s * 0.85, hash(Xg, Zg) * 6.28]); }
    inst(S.thrift, S.floraMat, thrift, false, null, false); inst(S.holly, S.floraMat, holly, false, null, false); inst(S.reed, S.floraMat, reeds, false, null, false);
    inst(S.gorse, new THREE.MeshStandardMaterial({ map: X.gorse, roughness: 0.95, metalness: 0 }), gorse, false, null, false);
  }

  // ---- life and the shore's leavings: gulls (standing and wheeling), oystercatchers, seals, flotsam on the wrack
  // line, the post fences, creels by the luggers, the inn's smoke, a rowing boat on the lagoon
  {
    const plainI = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
    const lst = (src, r, f) => (src || []).filter(q => near(q[0], q[1], r)).map(f);
    inst(S.gull, plainI, lst(E.gulls, 900, ([Xg, Zg, yg, rot]) => { const [x, z] = L(Xg, Zg); return [x, LY(yg) - 0.02, z, 1, 1, rot]; }), false, null, false);
    inst(S.oyster, plainI, lst(E.oyster, 700, ([Xo, Zo, yo, rot]) => { const [x, z] = L(Xo, Zo); return [x, LY(yo) - 0.02, z, 1, 1, rot]; }), false, null, false);
    inst(S.seal, plainI, lst(E.seals, 2500, ([Xs, Zs, ys, rot, s]) => { const [x, z] = L(Xs, Zs); return [x, LY(Math.max(ys, E.level + 0.4)) - 0.1, z, s, s, rot]; }), false, null, false);
    const fl = [[], [], [], [], []];
    for (const [Xf, Zf, yf, k, rot, s] of E.flotsam || []) { if (!near(Xf, Zf, 900)) continue; const [x, z] = L(Xf, Zf); fl[k].push([x, ground(Xf, Zf) - 0.05, z, s, s, rot]); }
    fl.forEach((l, k) => inst(S.flotsam[k], plainI, l, !coarse && k !== 2, null, false));
    inst(S.creel, plainI, lst(E.creels, 900, ([Xc, Zc, yc, rot]) => { const [x, z] = L(Xc, Zc); return [x, LY(yc), z, 1, 1, rot]; }), !coarse, null, false);
    // the fences: grey posts dipping with the dunes, a sagging wire along them
    const posts = [], wire = [];
    for (const run of E.fences || []) {
      if (!near(run[0][0], run[0][1], 1300) && !near(run.at(-1)[0], run.at(-1)[1], 1300)) continue;
      const tops = run.map(([Xp, Zp, yp, h, tx, tz]) => { const [x, z] = L(Xp, Zp), y = ground(Xp, Zp); posts.push([x, y - 0.25, z, 1, h + 0.25, hash(Xp, Zp) * 6.28]); return [x + tx * h, y + h * 0.82, z + tz * h]; });
      for (let i = 1; i < tops.length; i++) { const p = tops[i - 1], q = tops[i]; let prev = p; for (let k = 1; k <= 4; k++) { const t = k / 4, s = Math.sin(t * Math.PI) * 0.12, c = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t - s, p[2] + (q[2] - p[2]) * t]; wire.push(...prev, ...c); prev = c; } }
    }
    const pm = inst(S.fpost, new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 }), posts, false, null, false);
    if (wire.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3)); group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x3c3732, transparent: true, opacity: 0.55 }))); }
    void pm;
    // gulls wheeling over the wrecks, the hauling ground, the Cauldron and the bar (the instance's y scale flaps them)
    const flocks = (E.wheel || []).filter(w => near(w[0], w[1], 2500));
    const nB = flocks.reduce((s, w) => s + w[4], 0);
    if (nB) {
      const fm = new THREE.InstancedMesh(S.flyer, plainI, nB), Mt = new THREE.Matrix4(), Q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      const birds = []; flocks.forEach(([Xw, Zw, yw, rw, n], fi) => { const [x, z] = L(Xw, Zw); for (let i = 0; i < n; i++) birds.push({ x, z, y: LY(yw) + (R() - 0.5) * 8, r: rw * (0.6 + 0.6 * R()), w: (0.12 + 0.1 * R()) * (R() < 0.5 ? 1 : -1), ph: R() * 6.28, fl: R() * 6.28, fi }); });
      group.add(fm); fm.castShadow = false; let t = R() * 100;
      const step = dt => { t += dt; birds.forEach((b, i) => { const an = b.ph + t * b.w, x = b.x + Math.cos(an) * b.r, z = b.z + Math.sin(an) * b.r * 0.8, y = b.y + Math.sin(t * 0.3 + b.ph) * 3;
        const flap = Math.sin(t * 7 + b.fl) > -0.2 ? Math.sin(t * 9 + b.fl) * 1.1 : 0.85;   // glides between bursts
        fm.setMatrixAt(i, Mt.compose(ps.set(x, y, z), Q.setFromEuler(e.set(0, b.w > 0 ? Math.PI - an : -an, b.w > 0 ? -0.35 : 0.35)), sc.set(1.3, 1.3 * flap, 1.3))); }); fm.instanceMatrix.needsUpdate = true; };
      step(0); anims.push(step);
    }
    // smoke from the inn's chimneys, drifting downwind: camera-facing puffs placed in the vertex shader
    if (smokes.length && smokes.some(p => Math.hypot(p[0] - cx, p[2] - cz) < 2000)) {
      const N = 26, pos = [], seed = [], corner = [];
      for (const p of smokes) for (let i = 0; i < N; i++) { const s = (i + R()) / N; for (const c of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(...p); seed.push(s); corner.push(...c); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1)); g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
      const w2 = bear(45);
      const sm = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uT: U.uLTime, uW: { value: new THREE.Vector2(w2.x, w2.y) }, uMap: { value: X.puff } },
        vertexShader: `attribute float aSeed; attribute vec2 aCorner; uniform float uT; uniform vec2 uW; varying vec2 vUv; varying float vA;
#include <fog_pars_vertex>
void main(){ float age = fract(uT * 0.05 + aSeed);
  vec3 p = position + vec3(uW.x, 0.0, uW.y) * (age * age * 30.0 + age * 4.0) + vec3(0.0, age * 13.0, 0.0) + vec3(sin(aSeed * 40.0 + uT * 0.5), 0.0, cos(aSeed * 31.0 + uT * 0.4)) * age * 2.0;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); float s = 0.6 + age * 4.5; mvPosition.xy += aCorner * s;
  vUv = aCorner * 0.5 + 0.5; vA = (1.0 - age) * smoothstep(0.0, 0.1, age) * 0.45; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
        fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA;
#include <fog_pars_fragment>
void main(){ float a = texture2D(uMap, vUv).a * vA; gl_FragColor = vec4(vec3(0.78, 0.77, 0.74), a);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}` }));
      sm.frustumCulled = false; sm.renderOrder = 5; group.add(sm);
    }
    // a rowing boat on the lagoon, a man at the oars, drifting up and down its lane and rocking
    if ((E.boat || []).length > 1 && near(E.boat[0][0], E.boat[0][1], 2600)) {
      const [h] = hullGeo({ L: 4.6, beam: 1.6, D: 0.7, n: 12, m: 8, transom: 0.4, wl: 0.3, top: lin([206, 200, 186]), weed: lin([40, 70, 100]), strake: lin([40, 70, 110]), deck: false, sheer: 0.35 });
      const bg = new THREE.Group(), hm = new THREE.Mesh(h, M.planks); hm.castShadow = true; bg.add(hm);
      const man = kit([[new THREE.CylinderGeometry(0.2, 0.25, 0.7, 8), Mx(0, 0.75, 0.2), lin([60, 64, 70])], [new THREE.SphereGeometry(0.13, 8, 6), Mx(0, 1.2, 0.2), lin([200, 160, 130])], [new THREE.CylinderGeometry(0.16, 0.16, 0.12, 8), Mx(0, 1.32, 0.2), lin([40, 40, 44])],
        [new THREE.CylinderGeometry(0.03, 0.03, 3.4, 5), Mx(0, 0.75, 0.1, 0, 0, Math.PI / 2 - 0.15), lin([150, 140, 120])]]);
      bg.add(new THREE.Mesh(man, plainI)); group.add(bg);
      const pts = E.boat.map(([Xb, Zb]) => L(Xb, Zb)), segL = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), tot = segL.reduce((s, l) => s + l, 0);
      let d = R() * tot, dir = 1, t = 0;
      const place = dt => { t += dt; d += dir * 0.7 * dt; if (d > tot) { d = tot; dir = -1; } if (d < 0) { d = 0; dir = 1; }
        let dd = d; for (let i = 0; i < segL.length; i++) { if (dd <= segL[i] || i === segL.length - 1) { const u = Math.min(1, dd / segL[i]), A = pts[i], B = pts[i + 1]; bg.position.set(A[0] + (B[0] - A[0]) * u, LY(E.level) - 0.3, A[1] + (B[1] - A[1]) * u); bg.rotation.set(Math.sin(t * 0.9) * 0.03, -Math.atan2(B[0] - A[0], -(B[1] - A[1])) + (dir < 0 ? Math.PI : 0), Math.sin(t * 1.3) * 0.05); break; } dd -= segL[i]; } };
      place(0); anims.push(place);
    }
  }

  { for (const d of [...DOMES]) if (!d.parent || !d.parent.parent) DOMES.delete(d); const dome = skyDome(east, north); dome.position.set(cx, 0, cz); group.add(dome); }
  anims.push(dt => { U.uLTime.value += dt; });
  return { trees: [], anims };
}
