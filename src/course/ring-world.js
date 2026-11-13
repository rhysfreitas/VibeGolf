// Halcyon Ring (global THREE): what COURSE.ring holds (ring space: a across, east +; s along, north/spinward +;
// heights above the cylinder's floor) put on the true cylinder in a hole's frame (hole.frame) and drawn. A blockout,
// ahead of its art pass: the floor beyond the hole from the ring's maps (lawns, woods, gardens, plaza and terrace
// walls in the ground shader's RING branch), climbing up the ring ahead and behind; the rim walls of glass with
// their ribs and mullions, the rim glass in the floor with its beams and sill, and the floor windows, all showing
// space (stars, Earth through the west glass, the Moon through the east) through a glass sheen; the lake and the
// canal; the spoke, the clubhouse, villas, the aqueduct, the footbridge, the falls and the tram line; the parkland's
// trees in view (returned: they play where a wild ball reaches them). The ball's side of it (villas, walls, the
// spoke's feet, the rim walls, the trees) is in the course module, terrain.js and trees.js; everything here is
// drawn only.
import { rng } from './noise.js';
import { unpackHeights } from './field-code.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const sm = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
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
  return { tri, quad, mesh, get n() { return pos.length; } };
}
// the paint byte: 0 lawn, 1 woods, 2 garden, 3 plaza, 4 stone, 7 glass, 8 water, 10 (maps only) a hole's mown
// ground, 11 (maps only) sand
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, RING) ---------- */
// A: R fairway and tee, G green (1; collar 0.5), B bunker, A grass length
// B: R woods, G garden, B plaza (1), A stone (terrace walls)
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd.codes, cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cT = C.indexOf('tee');
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };
  if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0, 0, 0];
    for (let q = 0; q < 4; q++) for (let p = 0; p < 4; p++) {
      const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + p)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + q)), k = jj * Fd.nx + ii, f = wu[p] * wv[q];
      const c = onGreen(k) ? cR : Fd.s[k], m = Fd.mDec[k];
      if (c === cF || c === cT) w[0] += f; else if (c === cR) w[1] += f; else if (c === cG) w[2] += f;
      if (m === 1) w[3] += f; else if (m === 2) w[4] += f; else if (m === 3 || m === 7) w[5] += f; else if (m === 4) w[6] += f;
    }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, own = blend(x, z);
    if (!['green', 'sand', 'waste', 'tee', 'water', 'void'].includes(s)) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = 0; a[o + 3] = Math.min(255, (own[0] + own[1]) * 255 + own[2] * 140);
    } else {
      a[o] = s === 'tee' ? 255 : 0; a[o + 1] = s === 'green' ? 255 : 0; a[o + 2] = s === 'sand' ? 255 : s === 'waste' ? 128 : 0; a[o + 3] = s === 'void' || s === 'water' ? 0 : 255;
    }
    const mown = ['green', 'fringe', 'tee', 'fairway', 'sand', 'waste'].includes(s) ? 0 : 1;
    for (let c = 0; c < 4; c++) b[o + c] = Math.round(Math.min(1, own[3 + c]) * 255 * mown);
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#86a85c', rough: '#5f8f3a', firstcut: '#6a9a40', fairway: '#7cb64c', fringe: '#86c055', green: '#94d266', tee: '#8abd5c', sand: '#efe8d2', waste: '#d6ccb0', water: '#4c8fa8', void: '#15110f' };
  const M = { 1: '#4f7a3c', 2: '#98b870', 3: '#d9d4c6', 4: '#c9bfa8', 7: '#16203a' };
  return (x, z) => { const s = T.surfaceAt(x, z), m = matAt(hole, x, z); if (s === 'water' && m === 7) return M[7]; if (s === 'desert' && M[m]) return M[m]; return C[s] || '#86a85c'; };
}
// what a native lie is called, from the paint under the ball
export function lieName(hole, x, z) { return { 0: 'Lawn', 1: 'Woods', 2: 'Garden', 3: 'Paving', 4: 'Stone' }[matAt(hole, x, z)] || 'Lawn'; }
// glass (a floor window or the rim glass) or water at a point (the toast)
export const isGlass = (hole, x, z) => matAt(hole, x, z) === 7;

/* ---------- space through glass: stars, Earth and the Moon by the view direction, a sheen at grazing angles ---------- */
let SPACE = null;
function spaceMat() {
  if (SPACE) return SPACE;
  SPACE = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uEarth: { value: new THREE.Vector3(-1, 0, 0) }, uSun: { value: new THREE.Vector3(1, 0.14, 0) }, uEast: { value: new THREE.Vector3(1, 0, 0) }, uNorth: { value: new THREE.Vector3(0, 0, -1) }, uSheen: { value: new THREE.Color(0xd8dde2) }, uWall: { value: 0 }, uTime: { value: 0 } }]),
    fog: true, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; varying vec3 vN;
#include <fog_pars_vertex>
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uEarth; uniform vec3 uSun; uniform vec3 uEast; uniform vec3 uNorth; uniform vec3 uSheen; uniform float uWall; uniform float uTime; varying vec3 vW; varying vec3 vN;
#include <fog_pars_fragment>
float h3(vec3 p){ p = fract(p*vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y)*p.z); }
float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y), mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 col = vec3(0.004, 0.006, 0.014);
  // stars: a few per cell of a grid on the view direction, a faint band of the galaxy
  vec3 q = d * 260.0, c = floor(q); float hs = h3(c), st = step(0.972, hs) * (1.0 - smoothstep(0.08, 0.32, length(fract(q) - 0.5)));
  col += vec3(0.75, 0.8, 0.9) * st * (0.4 + 2.0*fract(hs*37.0));
  col += vec3(0.03, 0.03, 0.045) * smoothstep(0.35, 0.0, abs(d.y + 0.3*d.x)) * n3(d*6.0);
  // Earth: a disc about 23 degrees across, oceans, cloud and a bright limb
  float e = dot(d, normalize(uEarth)), er = cos(0.2), body = 0.0;
  if (e > er) { body = 1.0; float r = sqrt(max(0.0, 1.0 - (1.0 - e) / (1.0 - er)));
    vec3 ocean = mix(vec3(0.01, 0.05, 0.18), vec3(0.03, 0.12, 0.34), n3(d*9.0));
    float land = smoothstep(0.6, 0.66, n3(d*4.0 + 3.1) * 0.75 + n3(d*16.0) * 0.25);
    float cw = n3(d*7.0 + vec3(n3(d*3.0)*2.0)), cloud = smoothstep(0.52, 0.72, cw * 0.55 + n3(d*22.0) * 0.3 + n3(d*2.5) * 0.35);
    vec3 earth = mix(ocean, mix(vec3(0.20, 0.17, 0.09), vec3(0.09, 0.14, 0.06), n3(d*11.0)), land); earth = mix(earth, vec3(0.9, 0.92, 0.95), cloud * 0.9);
    col = earth * (0.35 + 0.95*r); col += vec3(0.2, 0.42, 0.95) * pow(1.0 - r, 4.0) * 0.7; }
  else col += vec3(0.15, 0.3, 0.7) * smoothstep(er - 0.01, er, e) * 0.35;
  // the sun, low through the east glass: a hot disc and a soft corona
  float su = dot(d, normalize(uSun));
  if (su > cos(0.014)) { col = vec3(9.0, 7.6, 5.6); body = 1.0; }
  col += vec3(1.0, 0.78, 0.5) * (pow(max(su, 0.0), 900.0) * 2.4 + pow(max(su, 0.0), 60.0) * 0.18); body = max(body, smoothstep(0.985, 1.0, su));
  // station traffic: a few ships drifting past beyond the glass, a white hull and a blinking light
  for (int k = 0; k < 4; k++) {
    float fk = float(k), side = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0, ph = uTime * (0.0035 + 0.0012 * fk) + fk * 1.7;
    vec3 c = normalize(side * uEast + uNorth * sin(ph) * 1.6 + vec3(0.0, 0.12 + 0.07 * fk, 0.0));
    vec3 t1 = normalize(uNorth - dot(uNorth, c) * c), t2 = cross(c, t1);
    float x = dot(d - c, t1), y = dot(d - c, t2), L = 0.006 + 0.003 * fk;
    float hull = 1.0 - smoothstep(0.85, 1.0, (x * x) / (L * L) + (y * y) / (L * L * 0.05));
    col = mix(col, vec3(0.55, 0.57, 0.6) * (0.7 + 0.3 * step(0.0, y)), hull * step(dot(d, c), 1.0));
    float blink = step(0.85, fract(uTime * 0.7 + fk * 0.31));
    col += vec3(2.0, 0.25, 0.2) * blink * (1.0 - smoothstep(0.0, L * 0.35, length(vec2(x - L * 0.9, y))));
  }
  // glass: a sheen of the lit air at grazing angles, a slight blue in it
  float fr = pow(1.0 - abs(dot(normalize(vN), -d)), 4.0);
  col = mix(col * vec3(0.92, 0.96, 1.0), uSheen, clamp((fr * 0.85 + 0.04 + uWall) * (1.0 - 0.6*body), 0.0, 1.0));   // the walls also catch the lit air between (uWall)
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
}`,
  });
  return SPACE;
}

/* ---------- the sky over the open ring: black space and stars, the air thin and blue low down, the haze at the floor ---------- */
function skyDome(sunDir, haze) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir || new THREE.Vector3(1, 0.14, 0) }, uHaze: { value: new THREE.Color(haze) } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun; uniform vec3 uHaze; varying vec3 vW;
float h3(vec3 p){ p = fract(p*vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y)*p.z); }
void main(){
  vec3 d = normalize(vW - cameraPosition); float e = d.y;
  vec3 col = vec3(0.004, 0.006, 0.014);
  vec3 q = d * 260.0, c = floor(q); float hs = h3(c), st = step(0.972, hs) * (1.0 - smoothstep(0.08, 0.32, length(fract(q) - 0.5)));
  col += vec3(0.75, 0.8, 0.9) * st * (0.4 + 2.0*fract(hs*37.0)) * smoothstep(0.08, 0.3, e);
  // the ring's air: thin and blue a little above the floor, the warm haze at it
  col = mix(col, vec3(0.08, 0.16, 0.34), smoothstep(0.34, 0.06, e));
  col = mix(col, uHaze, smoothstep(0.12, -0.02, e));
  float su = max(dot(d, normalize(uSun)), 0.0); col += vec3(1.0, 0.75, 0.45) * pow(su, 40.0) * 0.25;
  gl_FragColor = vec4(col, 1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(11000, 48, 24), m); mesh.renderOrder = -10; mesh.frustumCulled = false; return mesh;
}

/* ---------- a white modern villa (art pass 1): floor slabs with deep overhangs, long glass bands between white piers,
   the upper floors stepping back into planted roof terraces; P(u, v, y) puts a point of its footprint (u across w,
   v along l, y up from its foot) in the hole's frame. Bw takes the white, Bg the glass (unlit: dark panes, a few
   lit warm) ---------- */
function villa(P, w, l, h, Bw, Bg, seed, { colonnade = false } = {}) {
  const white = lin([238, 235, 228]), shade = lin([214, 212, 206]), soffit = lin([190, 188, 184]), plant = lin([92, 118, 64]);
  const n = Math.max(1, Math.min(4, Math.round((h - 0.6) / 3.4))), fh = Math.max(3, (h - 0.6) / n), ov = 1.3, R = rng(seed);
  const box = (u0, u1, v0, v1, y0, y1, k, top = k, under = null) => {
    const A = [P(u0, v0, y0), P(u1, v0, y0), P(u1, v1, y0), P(u0, v1, y0)], B = [P(u0, v0, y1), P(u1, v0, y1), P(u1, v1, y1), P(u0, v1, y1)];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; Bw.quad(A[i], A[j], B[j], B[i], k.map(c => c * (i % 2 ? 0.9 : 1))); }
    Bw.quad(B[0], B[1], B[2], B[3], top); if (under) Bw.quad(A[3], A[2], A[1], A[0], under);
  };
  let v1 = l / 2;
  for (let f = 0; f < n; f++) {
    const y0 = f * fh, back = f ? Math.min(l * 0.3, 2.5 + R() * 3) : 0, vv0 = -l / 2, vv1 = v1 - back;
    if (f && back > 0.5) box(-w / 2 + 0.6, w / 2 - 0.6, vv1, v1 - 0.4, y0, y0 + 0.5, plant);   // the roof terrace's planters
    v1 = vv1;
    // the slab under this floor (the ground floor's is its plinth), overhanging
    box(-w / 2 - (f ? ov : 0.4), w / 2 + (f ? ov : 0.4), vv0 - (f ? ov : 0.4), vv1 + (f ? ov : 0.4), y0 - 0.35, y0 + 0.05, white, white, soffit);
    // the walls: glass bands on the long faces between piers every 4.5 m, white ends
    const ya = y0 + 0.05, yb = y0 + fh - 0.35, along = [[-w / 2, w / 2, vv0, -1], [-w / 2, w / 2, vv1, 1]], ends = [[vv0, vv1, -w / 2, -1], [vv0, vv1, w / 2, 1]];
    for (const [u0, u1, v, sg] of along) {
      const np = Math.max(2, Math.round((u1 - u0) / 4.5));
      for (let k = 0; k < np; k++) {
        const a0 = u0 + (u1 - u0) * k / np, a1 = u0 + (u1 - u0) * (k + 1) / np, pw = 0.35;
        const lit = R() < 0.28, gk = lit ? lin([198, 156, 98]).map(c => c * (0.7 + 0.4 * R())) : lin([30, 38, 44]).map(c => c * (0.8 + 0.5 * R()));
        const A = sg < 0 ? [P(a0 + pw, v, ya), P(a1 - pw, v, ya), P(a1 - pw, v, yb), P(a0 + pw, v, yb)] : [P(a1 - pw, v, ya), P(a0 + pw, v, ya), P(a0 + pw, v, yb), P(a1 - pw, v, yb)];
        Bg.quad(A[0], A[1], A[2], A[3], gk);
        box(a0 - pw, a0 + pw, v - 0.3 * sg - 0.15, v - 0.3 * sg + 0.15, ya, yb, shade);
      }
    }
    for (const [v0, v1e, u, sg] of ends) { const A = sg < 0 ? [P(u, v1e, ya), P(u, v0, ya), P(u, v0, yb), P(u, v1e, yb)] : [P(u, v0, ya), P(u, v1e, ya), P(u, v1e, yb), P(u, v0, yb)]; Bw.quad(A[0], A[1], A[2], A[3], white.map(c => c * 0.95)); }
    // the core behind the glass (so the glass never shows the far side through the building)
    box(-w / 2 + 1.2, w / 2 - 1.2, vv0 + 1.2, vv1 - 1.2, ya, yb, soffit);
    if (colonnade && f === 0) for (let k = 0; k <= Math.round(w / 6); k++) { const u = -w / 2 - 0.6 + (w + 1.2) * k / Math.round(w / 6); box(u - 0.35, u + 0.35, vv0 - 3.6, vv0 - 2.9, y0, y0 + fh * 2 - 0.4, white); }
  }
  // the roof: a thin slab with a deep overhang (over the colonnade too)
  const yr = n * fh;
  box(-w / 2 - ov - 0.4, w / 2 + ov + 0.4, -l / 2 - (colonnade ? 4.4 : ov + 0.4), v1 + ov + 0.4, yr - 0.4, yr + 0.15, white, white, soffit);
  return { roof: yr, front: -l / 2 };
}

/* ---------- the ring, in a hole's frame ---------- */
export function buildRing(hole, T, box, E, hi, { group, coarse, rockMat, sunDir = null, haze = 0xd8dde2 }) {
  const F = hole.frame, RR = E.R, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const Lv = (dX, dZ) => [dX * rx + dZ * rz, -(dX * fx + dZ * fz)];
  // ring space (a, s, height above the floor) -> this hole's frame, on the true cylinder; within 700 m along the
  // ring the plan's flat coordinates (as the field was sampled), easing to the cylinder's beyond
  const ringP = (aa, s, hh) => {
    const d = s - F.s0, ph = d / RR, t = sm((Math.abs(d) - 700) / 600), N = d + ((RR - hh) * Math.sin(ph) - d) * t, Y = RR - (RR - hh) * Math.cos(ph);
    const [x, z] = L(aa, -(F.s0 + N)); return [x, Y - F.base, z];
  };
  // the floor's up (toward the axis) at a point s along the ring, in this hole's frame, eased as ringP is
  const ringUp = s => { const d = s - F.s0, ph = d / RR, t = sm((Math.abs(d) - 700) / 600), sa = -Math.sin(ph) * t, ca = 1 + (Math.cos(ph) - 1) * t, [ux, uz] = Lv(0, -1); return new THREE.Vector3(ux * sa, ca, uz * sa).normalize(); };
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 + 2 && z > Fd.z0 + 2 && x < Fd.x0 + (Fd.nx - 2) * Fd.cell && z < Fd.z0 + (Fd.nz - 2) * Fd.cell;
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const R = rng(hi * 131 + 7), trees = [], anims = [];
  const reach = 6000;   // the floor climbs out of the top of the frame by about 5.2 km along the ring (open to space above, a cut short of that shows as a hard edge against the stars)
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });

  // the maps
  const MAPS = [E.world, E.far];
  for (const M of MAPS) if (!M.hDec) { M.hDec = dec(M.h, Int16Array); if (M.pred) unpackHeights(M.hDec, M.na); M.mDec = dec(M.m, Uint8Array); }
  const inMap = (M, aa, s) => aa >= M.a0 && s >= M.s0 && aa <= M.a0 + (M.na - 1) * M.cell && s <= M.s0 + (M.ns - 1) * M.cell;
  const mapH = (aa, s) => { const M = inMap(E.world, aa, s) ? E.world : E.far, fi = Math.min(M.na - 1.001, Math.max(0, (aa - M.a0) / M.cell)), fj = Math.min(M.ns - 1.001, Math.max(0, (s - M.s0) / M.cell)), i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, H = (ii, jj) => M.hDec[jj * M.na + ii] / M.scale + M.y0; return (H(i, j) * (1 - u) + H(i + 1, j) * u) * (1 - v) + (H(i, j + 1) * (1 - u) + H(i + 1, j + 1) * u) * v; };
  // the ground at a ring point in this hole's frame (the field's where it has one)
  const groundP = (aa, s, lift = 0) => { const p = ringP(aa, s, mapH(aa, s) + lift); if (inField(p[0], p[2])) { const g = T.groundAt(p[0], p[2]); if (g !== null) p[1] = g + lift; } return p; };

  // ---- the floor from the maps: the 10 m one over the course, the 40 m one round the ring either side (the ground
  // shader paints it: aW x woods, y garden, z plaza (1) or a hole's mown ground (0.5), w stone)
  const Bw = batch();
  const ground = (M, skip) => {
    const st = M === E.world && coarse ? 2 : 1, ni = Math.floor((M.na - 1) / st), j0 = Math.max(0, Math.floor((F.s0 - reach - M.s0) / M.cell / st)), j1 = Math.min(Math.floor((M.ns - 1) / st), Math.ceil((F.s0 + reach - M.s0) / M.cell / st));
    if (j1 <= j0) return;
    const nj = j1 - j0, Vt = new Float32Array((ni + 1) * (nj + 1) * 3), Wt = new Float32Array((ni + 1) * (nj + 1) * 4), Mk = new Uint8Array((ni + 1) * (nj + 1)), Sv = new Float32Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = (j0 + j) * st, aa = M.a0 + I * M.cell, s = M.s0 + J * M.cell, k = j * (ni + 1) + i, m = M.mDec[J * M.na + I];
      let hh = M.hDec[J * M.na + I] / M.scale + M.y0; const wet = m === 8;
      const p = ringP(aa, s, wet ? hh - 1.2 : hh - 0.25);
      if (inField(p[0], p[2]) && !wet) { const g = T.groundAt(p[0], p[2]); if (g !== null) p[1] = g - 0.25; }
      Vt.set(p, k * 3); Mk[k] = m; Sv[k] = s;
      Wt.set([m === 1 ? 1 : 0, m === 2 ? 1 : 0, m === 3 || m === 7 || m === 11 ? 1 : m === 10 ? 0.5 : 0, m === 4 ? 1 : 0], k * 4);
      if (wet) { /* water sheets below */ }
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if (skip && [k, k1, k2, k3].every(q => skip(Sv[q]))) continue;
      const xs = [Vt[k * 3], Vt[k1 * 3], Vt[k2 * 3], Vt[k3 * 3]], zs = [Vt[k * 3 + 2], Vt[k1 * 3 + 2], Vt[k2 * 3 + 2], Vt[k3 * 3 + 2]];
      if (xs.every((x, q) => inPlay(x, zs[q]))) continue;
      const wv = [k, k1, k2, k3].filter(q => Mk[q] === 8);
      if (wv.length >= 2) { const P = q => [Vt[q * 3], Vt[q * 3 + 1] + (Mk[q] === 8 ? 1.2 : 0), Vt[q * 3 + 2]]; const ly = wv.reduce((s, q) => s + P(q)[1], 0) / wv.length, Q = q => { const p = P(q); return [p[0], Mk[q] === 8 ? p[1] : ly, p[2]]; }; Bw.quad(Q(k), Q(k1), Q(k3), Q(k2), [1, 1, 1]); }   // facing up
      if (Math.abs(Vt[k * 3 + 1] - Vt[k3 * 3 + 1]) < Math.abs(Vt[k1 * 3 + 1] - Vt[k2 * 3 + 1])) idx.push(k, k3, k2, k, k1, k3); else idx.push(k, k1, k2, k1, k3, k2);   // wound so the normals face up (the shader reads steep ground as stone)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vt, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wt, 4));
    g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(Vt.length / 3), 1)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, rockMat); mesh.receiveShadow = true; group.add(mesh);
  };
  const W0 = E.world, ws0 = W0.s0 + W0.cell, ws1 = W0.s0 + (W0.ns - 2) * W0.cell;
  ground(E.world, null);
  ground(E.far, s => s > ws0 && s < ws1);
  // the near water: the field's lake and canal cells as a sheet at the level
  if (Fd && Fd.ready) {
    const cw = Fd.codes.indexOf('water'), Hh = Fd.h;
    if (!Fd.mDec) Fd.mDec = dec(Fd.m, Uint8Array);
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, ks = [k, k + 1, k + Fd.nx + 1, k + Fd.nx], w = ks.filter(q => Fd.s[q] === cw && Fd.mDec[q] === 8);
      if (!w.length) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell, c = Fd.cell;
      if (!inPlay(x, z) && !inPlay(x + c, z + c)) continue;
      const mean = w.reduce((s, q) => s + Hh[q], 0) / w.length + 0.8, Y = q => (Fd.s[q] === cw && Fd.mDec[q] === 8 ? Hh[q] + 0.8 : mean);
      Bw.quad([x, Y(ks[0]), z], [x, Y(ks[3]), z + c], [x + c, Y(ks[2]), z + c], [x + c, Y(ks[1]), z], [1, 1, 1]);
    }
  }
  { const m = Bw.mesh(new THREE.MeshStandardMaterial({ color: 0x2c5866, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.93, envMapIntensity: 0.5 }), false); if (m) { m.renderOrder = 1; group.add(m); } }

  group.add(skyDome(sunDir, haze));

  // ---- space through glass: the floor windows, the rim glass, the rim walls
  const SP = spaceMat().clone(), SPW = spaceMat().clone();   // the floor glass (drawn over the ground under it) and the walls
  SP.polygonOffset = true; SP.polygonOffsetFactor = -2; SP.polygonOffsetUnits = -2; SPW.uniforms.uWall.value = 0.07;   // the walls dark: space shows through them (the sky is open above)
  { const ew = Lv(-Math.cos(0.17), 0), ea = Lv(1, 0), no = Lv(0, -1); SP.uniforms.uEarth.value.set(ew[0], Math.sin(0.15), ew[1]); SP.uniforms.uEast.value.set(ea[0], 0, ea[1]); SP.uniforms.uNorth.value.set(no[0], 0, no[1]); SP.uniforms.uSheen.value.set(haze);
    for (const k of ['uEarth', 'uEast', 'uNorth', 'uSheen']) SPW.uniforms[k].value.copy(SP.uniforms[k].value);
    SPW.uniforms.uSheen.value.lerp(new THREE.Color(0x7d8ca4), 0.65);
    SP.uniforms.uSheen.value.set(0x3a4658); SP.uniforms.uWall.value = -0.02;   // the floor glass mirrors the black sky overhead: dark, a cool sheen low down, the stars and Earth's glow through it   // the walls catch a cool sheen (the air and the far wall), not the floor's warm haze
    if (sunDir) { SP.uniforms.uSun.value = sunDir; SPW.uniforms.uSun.value = sunDir; }
    anims.push((dt, t) => { SP.uniforms.uTime.value = t; SPW.uniforms.uTime.value = t; }); }
  const G = { pos: [] }, gq = (A, B, C, D) => G.pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  for (const w of E.windows) {
    if (Math.abs(w.s - F.s0) > reach) continue;
    const c = Math.cos(w.rot), sn = Math.sin(w.rot), pw = 2 / w.p, NR = 64, NK = 6;
    const P = (t, k) => { const cu = Math.cos(t), su = Math.sin(t), u = Math.sign(cu) * Math.abs(cu) ** pw * w.ra * k, v = Math.sign(su) * Math.abs(su) ** pw * w.rs * k; return groundP(w.a + u * c - v * sn, w.s + u * sn + v * c, 0.06); };
    for (let r = 0; r < NK; r++) for (let i = 0; i < NR; i++) { const t0 = i / NR * 6.2832, t1 = (i + 1) / NR * 6.2832, k0 = r / NK, k1 = (r + 1) / NK; gq(P(t0, k0), P(t0, k1), P(t1, k1), P(t1, k0)); }
  }
  const Rm = E.rim, sAt = [], rimGy = s => ringP(0, s, Rm.y)[1];
  { let d = 0, st = 6; const ds = []; while (d < reach) { ds.push(d); d += st; st = Math.min(st * 1.06, 60); } for (let i = ds.length - 1; i > 0; i--) sAt.push(F.s0 - ds[i]); for (const v of ds) sAt.push(F.s0 + v); }
  for (const side of [-1, 1]) {
    const ain = side * (E.half - Rm.w), aout = side * E.half;
    for (let i = 0; i + 1 < sAt.length; i++) { const s0 = sAt[i], s1 = sAt[i + 1]; gq(ringP(ain, s0, Rm.y + 0.06), ringP(aout, s0, Rm.y + 0.06), ringP(aout, s1, Rm.y + 0.06), ringP(ain, s1, Rm.y + 0.06)); }
  }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, SP); m.renderOrder = 1; group.add(m); }
  // the rim walls: glass from the sill up to the wall's top, curving with the ring
  const Wl = { pos: [] }, wq = (A, B, C, D) => Wl.pos.push(...A, ...B, ...C, ...A, ...C, ...D);
  for (const side of [-1, 1]) {
    const aw = side * E.half, hs = [Rm.y + Rm.sill.h, 40, 90, 160, 240, E.wall];
    for (let i = 0; i + 2 < sAt.length; i += 2) { const s0 = sAt[i], s1 = sAt[i + 2]; for (let k = 0; k + 1 < hs.length; k++) wq(ringP(aw, s0, hs[k]), ringP(aw, s1, hs[k]), ringP(aw, s1, hs[k + 1]), ringP(aw, s0, hs[k + 1])); }
  }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(Wl.pos, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, SPW); group.add(m); }

  // ---- the frame: the wall's ribs every 120 m and its horizontal mullions; across the rim glass a beam on each rib
  // to the floor's edge; the sill along the wall's foot
  const Bf = batch(), white = lin([238, 240, 243]), pale = lin([214, 218, 224]);
  for (const side of [-1, 1]) {
    const aw = side * E.half, ain = side * (E.half - Rm.w), BM = Rm.beam, SL = Rm.sill, ai = aw - side * 0.6;
    for (let s = Math.ceil((F.s0 - reach) / BM.every) * BM.every; s < F.s0 + reach; s += BM.every) {
      const sa = s - BM.w / 2, sb = s + BM.w / 2;
      // the rib up the wall
      Bf.quad(ringP(ai, sa, Rm.y), ringP(ai, sb, Rm.y), ringP(ai, sb, E.wall), ringP(ai, sa, E.wall), white);
      // the beam across the glass: its top, its two sides and its end at the floor's edge
      const yt = Rm.y + BM.h, yb = Rm.y - 1.5;
      Bf.quad(ringP(ain, sa, yt), ringP(aw, sa, yt), ringP(aw, sb, yt), ringP(ain, sb, yt), white);
      Bf.quad(ringP(ain, sa, yb), ringP(aw, sa, yb), ringP(aw, sa, yt), ringP(ain, sa, yt), pale);
      Bf.quad(ringP(ain, sb, yt), ringP(aw, sb, yt), ringP(aw, sb, yb), ringP(ain, sb, yb), pale);
      Bf.quad(ringP(ain, sa, yb), ringP(ain, sa, yt), ringP(ain, sb, yt), ringP(ain, sb, yb), pale);
    }
    const as = aw - side * SL.w;
    for (let i = 0; i + 1 < sAt.length; i++) {
      const s0 = sAt[i], s1 = sAt[i + 1];
      Bf.quad(ringP(as, s0, Rm.y + SL.h), ringP(aw, s0, Rm.y + SL.h), ringP(aw, s1, Rm.y + SL.h), ringP(as, s1, Rm.y + SL.h), white);
      Bf.quad(ringP(as, s0, Rm.y - 1), ringP(as, s0, Rm.y + SL.h), ringP(as, s1, Rm.y + SL.h), ringP(as, s1, Rm.y - 1), pale);
      if (i % 2 === 0) for (const hh of [70, 140, 220]) { const s2 = sAt[Math.min(sAt.length - 1, i + 2)]; Bf.quad(ringP(aw - side * 0.4, s0, hh - 1.2), ringP(aw - side * 0.4, s2, hh - 1.2), ringP(aw - side * 0.4, s2, hh + 1.2), ringP(aw - side * 0.4, s0, hh + 1.2), pale); }
    }
  }
  { const m = Bf.mesh(vc({ roughness: 0.5, side: THREE.DoubleSide }), false); if (m) group.add(m); }

  // ---- the built things in ring space (each corner on the cylinder): villas, the clubhouse, the spoke, the
  // aqueduct, the footbridge, the tram line
  const Bb = batch();
  const boxR = (aa, s, w, l, h, rot, y0, col, roof = null) => {   // a box standing on the floor in ring space
    const c = Math.cos(rot), sn = Math.sin(rot), C = [[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2]].map(([u, v]) => [aa + u * c - v * sn, s + u * sn + v * c]);
    const lo = C.map(([p, q]) => ringP(p, q, y0)), hi = C.map(([p, q]) => ringP(p, q, y0 + h));
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, sh = k % 2 ? 0.86 : 1; Bb.quad(lo[k], lo[k2], hi[k2], hi[k], col.map(v => v * sh)); }
    Bb.quad(hi[0], hi[1], hi[2], hi[3], roof || col.map(v => v * 0.92));
  };
  const villaC = lin([246, 244, 238]), roofC = lin([132, 140, 150]);
  const Bv = batch(), Bg = batch(), flags = [];
  const ringVilla = (aa, s, w, l, h, rot, y0, seed, o) => { const c = Math.cos(rot), sn = Math.sin(rot); return villa((u, v, y) => ringP(aa + u * c - v * sn, s + u * sn + v * c, y0 + y), w, l, h, Bv, Bg, seed, o); };
  let vk = 0;
  for (const [X, Z, w, l, h, rot, y] of E.villas) {
    const aa = X, s = -Z; vk++; if (Math.abs(s - F.s0) > (coarse ? 1400 : 2200)) continue;
    const p = ringP(aa, s, y); if (inField(p[0], p[2])) continue;   // the field's villas are rocks: drawn below
    if (Math.hypot(p[0], p[2]) > 950) { boxR(aa, s, w, l, h, rot, y - 0.3, villaC, villaC.map(c => c * 0.9)); continue; }   // far off: a white block is all that reads
    const v = ringVilla(aa, s, w, l, h, rot, y - 0.3, vk * 17 + 3);
    if (vk % 3 === 0 && Math.hypot(p[0], p[2]) < 1600) { const c = Math.cos(rot), sn = Math.sin(rot); flags.push({ base: ringP(aa + (w / 2 - 2) * c, s + (w / 2 - 2) * sn, y - 0.3 + v.roof), h: 7 }); }
  }
  { const C = E.clubhouse; if (Math.abs(C.s - F.s0) < reach) { const v = ringVilla(C.a, C.s, C.w, C.d, C.h, 0.1, C.y - 0.3, 99, { colonnade: true });
      for (const k of [-1, 0, 1]) flags.push({ base: ringP(C.a + k * 14, C.s - C.d / 2 - 8, C.y), h: 14, big: true }); } }
  // the spoke: two legs leaning in from their feet to the apex, then one shaft toward the hub
  { const S = E.spoke, leg = (a0, a1, h0, h1, w0, w1, n = 14) => {
      for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n, A0 = a0 + (a1 - a0) * t0, A1 = a0 + (a1 - a0) * t1, H0 = h0 + (h1 - h0) * t0, H1 = h0 + (h1 - h0) * t1, W0 = w0 + (w1 - w0) * t0, W1 = w0 + (w1 - w0) * t1;
        const P = (A, Hh, du, ds, Wd) => ringP(A + du * Wd / 2, S.s + ds * Wd / 2, Hh);
        for (const [du0, ds0, du1, ds1, sh] of [[-1, -1, -1, 1, 0.9], [-1, 1, 1, 1, 0.8], [1, 1, 1, -1, 0.95], [1, -1, -1, -1, 0.85]]) Bb.quad(P(A0, H0, du0, ds0, W0), P(A0, H0, du1, ds1, W0), P(A1, H1, du1, ds1, W1), P(A1, H1, du0, ds0, W1), lin([226, 230, 236]).map(v => v * sh)); } };
    if (Math.abs(S.s - F.s0) < reach) { leg(S.legs[0][0], S.a - 12, S.y - 3, S.apex, S.foot, 22); leg(S.legs[1][0], S.a + 12, S.y - 3, S.apex, S.foot, 22); leg(S.a, S.a, S.apex - 20, RR * 0.88, 40, 26, 24); } }
  // the aqueduct: piers and a deck across the east terraces
  { const Q = E.aqueduct, n = 9; if (Math.abs(Q.from[1] - F.s0) < reach) for (let k = 0; k <= n; k++) { const t = k / n, aa = Q.from[0] + (Q.to[0] - Q.from[0]) * t, s = Q.from[1] + (Q.to[1] - Q.from[1]) * t, y = Q.y0 + (Q.y1 - Q.y0) * t, rot = Math.atan2(Q.to[1] - Q.from[1], Q.to[0] - Q.from[0]);
      boxR(aa, s, 4, 4, Q.h, rot, y - 1, lin([222, 214, 200])); if (k < n) { const t2 = (k + 1) / n, a2 = Q.from[0] + (Q.to[0] - Q.from[0]) * t2, s2 = Q.from[1] + (Q.to[1] - Q.from[1]) * t2; boxR((aa + a2) / 2, (s + s2) / 2, Math.hypot(a2 - aa, s2 - s) + 4, 6, 4, rot, y + Q.h - 3, lin([226, 218, 204])); } } }
  // the footbridges and the tram line
  for (const Bd of E.bridges) { const [ax, az] = L(Bd.a[0], Bd.a[1]), [bx, bz] = L(Bd.b[0], Bd.b[1]); if (Math.hypot(ax, az) > reach) continue; const ya = groundP(Bd.a[0], -Bd.a[1])[1], yb = groundP(Bd.b[0], -Bd.b[1])[1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l * 1.6, nz = dx / l * 1.6, y0 = Math.max(ya, yb) + 1.4;
    Bb.quad([ax - nx, y0, az - nz], [ax + nx, y0, az + nz], [bx + nx, y0, bz + nz], [bx - nx, y0, bz - nz], lin([232, 228, 220])); }
  for (let i = 0; i + 1 < sAt.length; i++) { const s0 = sAt[i], s1 = sAt[i + 1]; for (const off of [-0.9, 0.9]) { const p0 = groundP(off - 0.08, s0, 0.08), p1 = groundP(off + 0.08, s0, 0.08), p2 = groundP(off + 0.08, s1, 0.08), p3 = groundP(off - 0.08, s1, 0.08); if (inPlay(p0[0], p0[2])) continue; Bb.quad(p0, p1, p2, p3, lin([70, 74, 80])); } }
  // the hole's own villas, walls, the clubhouse and the lip marker (rocks in the module)
  for (const Rk of T.rocks) {
    if (Rk.type !== 'box' || Rk.rimWall) continue;
    const c = Math.cos(Rk.rot || 0), sn = Math.sin(Rk.rot || 0), C = [[-Rk.w / 2, -Rk.d / 2], [Rk.w / 2, -Rk.d / 2], [Rk.w / 2, Rk.d / 2], [-Rk.w / 2, Rk.d / 2]].map(([u, v]) => [Rk.x + u * c - v * sn, Rk.z + u * sn + v * c]);
    if ((Rk.villa && Rk.villa !== 'the lip marker') || Rk.clubhouse) {   // the hole's villas (they play: their box is the rock)
      const P = (u, v, y) => [Rk.x + u * c - v * sn, Rk.y + y, Rk.z + u * sn + v * c];
      villa(P, Rk.w, Rk.d, Rk.h, Bv, Bg, Math.round(Rk.x * 7 + Rk.z * 3), { colonnade: !!Rk.clubhouse });
      continue;
    }
    const col = Rk.wall ? lin([236, 232, 222]) : Rk.villa === 'the lip marker' ? lin([214, 80, 60]) : villaC, lo = C.map(([x, z]) => [x, Rk.y, z]), hi = C.map(([x, z]) => [x, Rk.y + Rk.h, z]);
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, sh = k % 2 ? 0.86 : 1; Bb.quad(lo[k], lo[k2], hi[k2], hi[k], col.map(v => v * sh)); }
    Bb.quad(hi[0], hi[1], hi[2], hi[3], Rk.wall || Rk.villa === 'the lip marker' ? col : roofC);
  }
  { const m = Bb.mesh(vc({ roughness: 0.75 })); if (m) group.add(m); }
  { const m = Bv.mesh(vc({ roughness: 0.6, side: THREE.DoubleSide })); if (m) group.add(m); const g = Bg.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), false); if (g) group.add(g); }
  // flags on the villas and the clubhouse, stirring in the air handling's breeze
  if (flags.length) {
    const Bp = batch(); for (const f of flags) { const [x, y, z] = f.base; Bp.quad([x - 0.08, y, z], [x + 0.08, y, z], [x + 0.08, y + f.h, z], [x - 0.08, y + f.h, z], lin([230, 230, 230])); Bp.quad([x, y, z - 0.08], [x, y, z + 0.08], [x, y + f.h, z + 0.08], [x, y + f.h, z - 0.08], lin([230, 230, 230])); }
    { const m = Bp.mesh(vc({ side: THREE.DoubleSide }), false); if (m) group.add(m); }
    const NU = 8, pos = [], cols = [], base = [], C2 = [lin([30, 70, 140]), lin([200, 60, 50]), lin([240, 240, 236])];
    flags.forEach((f, i) => { const fw = f.big ? 4.2 : 2.4, fhh = f.big ? 2.6 : 1.5, [x, y, z] = f.base, top = y + f.h, k = C2[i % 3];
      for (let j = 0; j < NU; j++) { const u0 = j / NU * fw, u1 = (j + 1) / NU * fw; const q = [[x, top - fhh, z, u0], [x, top, z, u0], [x, top, z, u1], [x, top - fhh, z, u1]], tri = [q[0], q[1], q[2], q[0], q[2], q[3]];
        for (const t of tri) { pos.push(t[0], t[1], t[2]); base.push(t[0], t[2], t[3], i); cols.push(...k); } } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const fm = new THREE.Mesh(g, vc({ side: THREE.DoubleSide, roughness: 0.9 })); fm.frustumCulled = false; group.add(fm);
    const fp = g.attributes.position;
    anims.push((dt, t, wv) => { const dir = wv && (wv.x || wv.z) ? Math.atan2(wv.z, wv.x) : 0.6, sp = 0.5 + Math.min(1, (wv?.mph || 6) / 15);
      for (let v = 0; v < fp.count; v++) { const bx = base[v * 4], bz = base[v * 4 + 1], u = base[v * 4 + 2], ii = base[v * 4 + 3], wob = Math.sin(t * 5 * sp + u * 1.8 + ii) * 0.25 * u;
        fp.setX(v, bx + Math.cos(dir) * u - Math.sin(dir) * wob); fp.setZ(v, bz + Math.sin(dir) * u + Math.cos(dir) * wob); }
      fp.needsUpdate = true; });
  }
  // ---- the follies (art pass 1): rotundas and temples on the park's lawns, obelisks, statues before the villas,
  // fountains; white marble, scenery only (drawn where they stand outside the field, which none of them should be)
  const Bm = batch(), marble = lin([236, 232, 222]), marbleS = lin([212, 208, 198]), waterC = lin([70, 110, 120]), jets = [];
  const frustum = (Pf, r0, r1, y0, y1, n, k) => { for (let i = 0; i < n; i++) { const t0 = i / n * 6.2832, t1 = (i + 1) / n * 6.2832; Bm.quad(Pf(Math.cos(t0) * r0, Math.sin(t0) * r0, y0), Pf(Math.cos(t1) * r0, Math.sin(t1) * r0, y0), Pf(Math.cos(t1) * r1, Math.sin(t1) * r1, y1), Pf(Math.cos(t0) * r1, Math.sin(t0) * r1, y1), k.map(c => c * (0.88 + 0.12 * Math.cos(t0 - 0.8)))); } };
  const disc = (Pf, r, y, n, k) => { for (let i = 0; i < n; i++) { const t0 = i / n * 6.2832, t1 = (i + 1) / n * 6.2832; Bm.tri(Pf(0, 0, y), Pf(Math.cos(t1) * r, Math.sin(t1) * r, y), Pf(Math.cos(t0) * r, Math.sin(t0) * r, y), k); } };
  const dome = (Pf, r, y, k) => { const NR = 6; for (let j = 0; j < NR; j++) { const p0 = j / NR * 1.5708, p1 = (j + 1) / NR * 1.5708; frustum(Pf, r * Math.cos(p0), r * Math.cos(p1), y + r * Math.sin(p0), y + r * Math.sin(p1), 16, k); } };
  const cube = (Pf, u0, u1, v0, v1, y0, y1, k) => { const A = [Pf(u0, v0, y0), Pf(u1, v0, y0), Pf(u1, v1, y0), Pf(u0, v1, y0)], B = [Pf(u0, v0, y1), Pf(u1, v0, y1), Pf(u1, v1, y1), Pf(u0, v1, y1)]; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; Bm.quad(A[i], A[j], B[j], B[i], k.map(c => c * (i % 2 ? 0.88 : 1))); } Bm.quad(B[0], B[1], B[2], B[3], k); };
  for (const Fo of E.follies || []) {
    if (Math.abs(Fo.s - F.s0) > (coarse ? 1200 : 1800)) continue;
    const c = Math.cos(Fo.rot), sn = Math.sin(Fo.rot), Pf = (u, v, y) => ringP(Fo.a + u * c - v * sn, Fo.s + u * sn + v * c, Fo.y - 0.2 + y);
    const at = Pf(0, 0, 0); if (inPlay(at[0], at[2])) continue;
    if (Fo.kind === 'rotunda') {
      for (let q = 0; q < 3; q++) frustum(Pf, 7.6 - q * 0.6, 7.6 - q * 0.6, q * 0.35, (q + 1) * 0.35, 20, marbleS), disc(Pf, 7.6 - q * 0.6, (q + 1) * 0.35, 20, marble);
      for (let k = 0; k < 10; k++) { const t = k / 10 * 6.2832, cu = Math.cos(t) * 5.6, cv = Math.sin(t) * 5.6; frustum((u, v, y) => Pf(cu + u, cv + v, y), 0.42, 0.36, 1.05, 7.4, 7, marble); }
      frustum(Pf, 6.3, 6.3, 7.4, 8.4, 20, marble); disc(Pf, 6.3, 8.4, 20, marbleS); dome(Pf, 5.9, 8.4, marble);
    } else if (Fo.kind === 'temple') {
      cube(Pf, -8, 8, -5.5, 5.5, 0, 1.2, marbleS);
      for (let i = 0; i < 6; i++) for (const v of [-4.4, 4.4]) { const u = -6.6 + i * 2.64; frustum((x, z, y) => Pf(u + x, v + z, y), 0.45, 0.38, 1.2, 7.6, 7, marble); }
      for (const u of [-6.6, 6.6]) for (const v of [-1.5, 1.5]) frustum((x, z, y) => Pf(u + x, v + z, y), 0.45, 0.38, 1.2, 7.6, 7, marble);
      cube(Pf, -7.4, 7.4, -5, 5, 7.6, 8.6, marble);
      const r0 = Pf(-7.6, -5.2, 8.6), r1 = Pf(7.6, -5.2, 8.6), r2 = Pf(7.6, 5.2, 8.6), r3 = Pf(-7.6, 5.2, 8.6), ka = Pf(-7.6, 0, 11), kb = Pf(7.6, 0, 11);
      Bm.quad(r0, r1, kb, ka, marbleS); Bm.quad(r2, r3, ka, kb, marbleS); Bm.tri(r3, r0, ka, marble); Bm.tri(r1, r2, kb, marble);
    } else if (Fo.kind === 'obelisk') {
      cube(Pf, -2.4, 2.4, -2.4, 2.4, 0, 1.4, marbleS);
      const sh = [Pf(-0.9, -0.9, 1.4), Pf(0.9, -0.9, 1.4), Pf(0.9, 0.9, 1.4), Pf(-0.9, 0.9, 1.4)], st = [Pf(-0.55, -0.55, 17), Pf(0.55, -0.55, 17), Pf(0.55, 0.55, 17), Pf(-0.55, 0.55, 17)], tip = Pf(0, 0, 18.4);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; Bm.quad(sh[i], sh[j], st[j], st[i], marble.map(v => v * (i % 2 ? 0.88 : 1))); Bm.tri(st[i], st[j], tip, marble); }
    } else if (Fo.kind === 'statue') {
      cube(Pf, -0.8, 0.8, -0.8, 0.8, 0, 1.8, marbleS);
      frustum(Pf, 0.42, 0.3, 1.8, 3.6, 7, marble); frustum(Pf, 0.3, 0.36, 3.6, 4.1, 7, marble); dome(Pf, 0.24, 4.1, marble);
    } else if (Fo.kind === 'fountain') {
      const R0 = Fo.big ? 9 : 4.5;
      frustum(Pf, R0, R0, 0, 0.6, 24, marbleS); frustum(Pf, R0 - 0.4, R0 - 0.4, 0.6, 0.1, 24, marbleS); disc(Pf, R0 - 0.4, 0.42, 24, waterC);
      frustum(Pf, 0.6, 0.4, 0.4, 2.2, 8, marble); frustum(Pf, 1.8, 0.4, 2.4, 2.2, 12, marble); disc(Pf, 1.8, 2.4, 12, waterC);
      jets.push({ p: Pf(0, 0, 2.4), up: ringUp(Fo.s), h: Fo.big ? 6 : 3.2, r: Fo.big ? 1.2 : 0.6 });
    }
  }
  { const m = Bm.mesh(vc({ roughness: 0.55, side: THREE.DoubleSide })); if (m) group.add(m); }
  if (jets.length) {   // the fountains' jets: a soft white column of falling water, flickering
    const jm = new THREE.MeshStandardMaterial({ color: 0xeef6f8, transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false });
    const geo = new THREE.CylinderGeometry(0.15, 1, 1, 10, 1, true), Q = new THREE.Quaternion(), up0 = new THREE.Vector3(0, 1, 0), mesh = new THREE.InstancedMesh(geo, jm, jets.length), M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3();
    mesh.frustumCulled = false; group.add(mesh);
    anims.push((dt, t) => { jets.forEach((j, i) => { const k = 1 + 0.08 * Math.sin(t * 9 + i * 2); Q.setFromUnitVectors(up0, j.up); P.set(...j.p).addScaledVector(j.up, j.h * k / 2); S.set(j.r, j.h * k, j.r); M.compose(P, Q, S); mesh.setMatrixAt(i, M); }); mesh.instanceMatrix.needsUpdate = true; });
  }

  // ---- signs of people and station traffic (art pass 1): the tram gliding along its line, a boat on the lake,
  // beacons blinking on the spoke, a couple of drones over the park; all scenery, all off the lines of play
  {
    const shapeBox = (w, h, l, col) => { const g = new THREE.BoxGeometry(w, h, l); g.translate(0, h / 2, 0); return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 })); };
    // the tram: two white cars with a dark window band, coming round the ring now and then
    const tram = new THREE.Group(); for (const dz of [-13, 13]) { const body = shapeBox(2.8, 3.4, 24, 0xf2f1ec); body.position.z = dz; tram.add(body); const band = shapeBox(2.86, 1.1, 22.6, 0x26323a); band.position.set(0, 1.6, dz); tram.add(band); }
    group.add(tram);
    const tramS = s => groundP(0, s, 0.3), up0 = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), Mx = new THREE.Matrix4();
    anims.push((dt, t) => { const span = 3600, s = F.s0 - span / 2 + ((t * 16 + hi * 397) % (span + 1200)); tram.visible = s < F.s0 + span / 2;
      if (!tram.visible) return; const a = tramS(s), b = tramS(s + 4); tram.position.set(...a); tmp.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); tmp2.copy(ringUp(s));
      Mx.lookAt(new THREE.Vector3(), tmp, tmp2); tram.quaternion.setFromRotationMatrix(Mx); });
    // a boat on the lake: a white hull and a sail, drifting up and down the lake
    const Lk = E.lake; if (Lk && Lk.pts && Math.abs(Lk.pts[3][1] - F.s0) < 2600) {
      const boat = new THREE.Group(); const hull = shapeBox(2.2, 0.9, 6.5, 0xf4f2ec); boat.add(hull);
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -2.2, 0, 8, -0.6, 0, 1, 2.2], 3)); sg.computeVertexNormals(); boat.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xfbf8ef, side: THREE.DoubleSide, roughness: 0.7 })));
      group.add(boat); const P = Lk.pts, lens = [0]; for (let i = 1; i < P.length; i++) lens.push(lens[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
      const at = d => { let i = 1; while (i < P.length - 1 && lens[i] < d) i++; const u = (d - lens[i - 1]) / (lens[i] - lens[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u]; };
      const tot = lens.at(-1), lo = tot * 0.25, hi2 = tot * 0.85;
      anims.push((dt, t) => { const ph = (t * 1.6) % (2 * (hi2 - lo)), d = lo + (ph < hi2 - lo ? ph : 2 * (hi2 - lo) - ph), [aa, ss] = at(d), [ab, sb] = at(d + 3), p = ringP(aa + 12, ss, Lk.level), q = ringP(ab + 12, sb, Lk.level);
        boat.position.set(...p); boat.rotation.set(0, Math.atan2(q[0] - p[0], q[2] - p[2]) + Math.sin(t * 0.9) * 0.03, Math.sin(t * 1.3) * 0.04); });
    }
    // beacons on the spoke's legs and shaft, and a couple of drones over the park
    const S = E.spoke; if (Math.abs(S.s - F.s0) < reach) {
      const bm = new THREE.MeshBasicMaterial({ color: 0xff3a2a, toneMapped: false }), bg = new THREE.SphereGeometry(1.6, 8, 6), beacons = [];
      for (const [aa, hh] of [[S.legs[0][0] + (S.a - 12 - S.legs[0][0]) * 0.5, S.apex * 0.5], [S.legs[1][0] + (S.a + 12 - S.legs[1][0]) * 0.5, S.apex * 0.5], [S.a, S.apex + 10], [S.a, S.apex + 400], [S.a, S.apex + 900]]) { const b = new THREE.Mesh(bg, bm); b.position.set(...ringP(aa, S.s, hh)); group.add(b); beacons.push(b); }
      anims.push((dt, t) => { const on = (t % 1.6) < 0.25; for (const b of beacons) b.visible = on; });
    }
    const dm = new THREE.MeshStandardMaterial({ color: 0x40464c, roughness: 0.5 }), drones = [];
    for (let k = 0; k < 2; k++) { const d = new THREE.Group(); d.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), dm)); for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10), dm); r.position.set(x, 0.25, z); d.add(r); }
      const lt = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), new THREE.MeshBasicMaterial({ color: 0x9ff0ff, toneMapped: false })); lt.position.y = -0.3; d.add(lt);
      // off to the side of the hole, 140 m or more from the line
      const side = k ? 1 : -1, mid = hole.line[Math.floor(hole.line.length / 2)] || [0, -150], cx = mid[0] + side * (150 + 40 * k), cz = mid[1] - 60 * k, gy = (T.groundAt(cx, cz) ?? 0) + 32 + 10 * k;
      group.add(d); drones.push({ d, cx, cz, gy, k }); }
    anims.push((dt, t) => { for (const q of drones) { const a = t * 0.12 * (q.k ? -1 : 1) + q.k * 2; q.d.position.set(q.cx + Math.cos(a) * 30, q.gy + Math.sin(t * 1.3 + q.k) * 1.2, q.cz + Math.sin(a) * 30); q.d.rotation.y = -a; } });
  }

  // the falls: a sheet down the terrace wall behind the 6th green
  for (const Fl of E.falls) { const p = groundP(Fl.at[0], -Fl.at[1]); if (Math.hypot(p[0], p[2]) > reach) continue; const r = Fl.facing - F.heading * Math.PI / 180, ux = Math.cos(r) * Fl.w / 2, uz = Math.sin(r) * Fl.w / 2, y0 = Fl.y, y1 = Fl.y + Fl.h;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([p[0] - ux, y0, p[2] - uz, p[0] + ux, y0, p[2] + uz, p[0] + ux, y1, p[2] + uz, p[0] - ux, y0, p[2] - uz, p[0] + ux, y1, p[2] + uz, p[0] - ux, y1, p[2] - uz], 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe8f2f6, transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 0.3 })); m.renderOrder = 2; group.add(m); }

  // ---- the parkland's trees in view outside the field: scenery, drawn here as cheap instanced shapes (a 20-face
  // crown or a 6-sided cone on a 5-sided trunk), thinned with distance; the woods' paint carries the rest. The field's
  // own trees play and come from main.js's buildTrees.
  {
    const far = [];
    for (const [X, Z, kind, hh, r, y] of E.trees) {
      const s = -Z; if (Math.abs(s - F.s0) > (coarse ? 900 : 1300)) continue;
      const p = ringP(X, s, y); if (inField(p[0], p[2])) continue;
      const d = Math.hypot(p[0], p[2]), hsh = ((X * 12.9898 + Z * 78.233) % 1 + 1) % 1;
      if (d > 600 && hsh > Math.pow(600 / d, coarse ? 1.8 : 1.2)) continue;
      far.push({ p, kind: hsh < 0.12 ? 'cedar' : hsh > 0.95 ? 'poplar' : kind, h: hh, r, hsh, up: ringUp(s) });   // a landscape park: planes and limes, a cedar now and then
    }
    // this hole's own trees well off the line (they still play: T.trees keeps them; main.js leaves those marked
    // ringFar to this); the ones near the play keep main.js's fuller crowns
    const Lh = hole.line || [], lineD = (x, z) => { let m = Infinity; for (let i = 0; i < Lh.length - 1; i++) { const [ax, az] = Lh[i], [bx, bz] = Lh[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
    for (const t of T.trees || []) if (lineD(t.x, t.z) > 60 && !Lh.some(q => Math.hypot(q[0] - t.x, q[1] - t.z) < 80)) { t.ringFar = true; far.push({ p: [t.x, t.y, t.z], kind: t.kind === 'yew' ? 'cedar' : t.kind || (t.type === 'pine' ? 'poplar' : 'plane'), h: t.h || 12, r: t.cr || 4, hsh: t.r ?? 0.5, up: new THREE.Vector3(0, 1, 0) }); }
    if (far.length) {
      // landscape-park shapes: planes and limes as three lumpy blobs, willows wide and low, cedars of Lebanon in flat
      // dark tiers, poplars as tall columns; all on trunks
      const blob = new THREE.IcosahedronGeometry(1, 1), blob0 = new THREE.IcosahedronGeometry(1, 0), tier = new THREE.CylinderGeometry(1, 0.85, 1, 9), trunk = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true });
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color(), up0 = new THREE.Vector3(0, 1, 0);
      const parts = { blob: [], blob0: [], tier: [], trunk: [] };   // blob0: the 20-face crown for trees well away from the play
      const add = (geo, t, along, side, fwd, sx, sy, sz, color) => { parts[geo === 'blob' && !t.near ? 'blob0' : geo].push({ t, along, side, fwd, sx, sy, sz, color }); };
      for (const t of far) t.near = lineD(t.p[0], t.p[2]) < 110;
      for (const t of far) {
        const h = t.h, r = t.r, j = t.hsh, k = t.kind;
        add('trunk', t, h * 0.2, 0, 0, Math.max(0.3, r * 0.09), h * 0.4, Math.max(0.3, r * 0.09), 0x4a3a2a);
        if (k === 'cedar') for (let q = 0; q < 3; q++) add('tier', t, h * (0.38 + q * 0.2), (j - 0.5) * r * 0.3 * q, (0.5 - j) * r * 0.2, r * (1.15 - q * 0.25), h * 0.09, r * (0.95 - q * 0.2), 0x2e4430);
        else if (k === 'poplar') add('blob', t, h * 0.56, 0, 0, r * 0.42, h * 0.46, r * 0.42, 0x41602e);
        else if (k === 'willow') { add('blob', t, h * 0.5, 0, 0, r * 1.1, h * 0.3, r * 1.1, 0x76903f); add('blob', t, h * 0.62, r * 0.3, 0, r * 0.7, h * 0.22, r * 0.7, 0x7d9a46); }
        else { add('blob', t, h * 0.62, 0, 0, r * 0.85, h * 0.3, r * 0.85, k === 'lime' ? 0x4f6e2e : 0x48682c);
          add('blob', t, h * 0.56, r * 0.45, r * 0.2, r * 0.6, h * 0.22, r * 0.6, 0x527230); add('blob', t, h * 0.7, -r * 0.35, -r * 0.25, r * 0.55, h * 0.2, r * 0.55, 0x45642a); }
      }
      const geos = { blob, blob0, tier, trunk }, side = new THREE.Vector3(), fwd = new THREE.Vector3();
      for (const [name, list] of Object.entries(parts)) {
        if (!list.length) continue;
        const m = new THREE.InstancedMesh(geos[name], mat, list.length);
        list.forEach((q, i) => { const t = q.t; Q.setFromUnitVectors(up0, t.up); side.set(1, 0, 0).applyQuaternion(Q); fwd.set(0, 0, 1).applyQuaternion(Q);
          P.set(t.p[0], t.p[1], t.p[2]).addScaledVector(t.up, q.along).addScaledVector(side, q.side).addScaledVector(fwd, q.fwd); S.set(q.sx, q.sy, q.sz);
          M.compose(P, Q, S); m.setMatrixAt(i, M); C.setHex(q.color).multiplyScalar(0.82 + 0.3 * t.hsh); m.setColorAt(i, C); });
        m.instanceMatrix.needsUpdate = true; m.castShadow = false; m.receiveShadow = false; group.add(m);
      }
    }
  }
  return { trees, anims };
}
