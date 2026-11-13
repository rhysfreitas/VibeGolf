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
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uEarth: { value: new THREE.Vector3(-1, 0, 0) }, uMoon: { value: new THREE.Vector3(1, 0, 0) }, uSheen: { value: new THREE.Color(0xd8dde2) }, uWall: { value: 0 } }]),
    fog: true, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; varying vec3 vN;
#include <fog_pars_vertex>
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform vec3 uEarth; uniform vec3 uMoon; uniform vec3 uSheen; uniform float uWall; varying vec3 vW; varying vec3 vN;
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
    vec3 ocean = mix(vec3(0.02, 0.07, 0.2), vec3(0.05, 0.16, 0.35), n3(d*9.0));
    float land = smoothstep(0.55, 0.62, n3(d*5.0 + 3.1)), cloud = smoothstep(0.5, 0.75, n3(d*14.0) * 0.6 + n3(d*4.0) * 0.5);
    vec3 earth = mix(ocean, vec3(0.16, 0.18, 0.08), land); earth = mix(earth, vec3(0.85, 0.88, 0.92), cloud);
    col = earth * (0.6 + 1.1*r); col += vec3(0.25, 0.45, 0.9) * pow(1.0 - r, 3.0) * 0.6; }
  else col += vec3(0.15, 0.3, 0.7) * smoothstep(er - 0.01, er, e) * 0.35;
  // the Moon: small and grey
  float mo = dot(d, normalize(uMoon)); if (mo > cos(0.03)) { col = vec3(0.75, 0.75, 0.72) * (0.75 + 0.35 * n3(d*120.0)); body = 1.0; }
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
  const reach = coarse ? 3600 : 5200;
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

  // ---- space through glass: the floor windows, the rim glass, the rim walls
  const SP = spaceMat().clone(), SPW = spaceMat().clone();   // the floor glass (drawn over the ground under it) and the walls
  SP.polygonOffset = true; SP.polygonOffsetFactor = -2; SP.polygonOffsetUnits = -2; SPW.uniforms.uWall.value = 0.38;
  { const ew = Lv(-Math.cos(0.17), 0), mw = Lv(Math.cos(0.09), -0.3); SP.uniforms.uEarth.value.set(ew[0], Math.sin(0.15), ew[1]); SP.uniforms.uMoon.value.set(mw[0], Math.sin(0.09), mw[1]); SP.uniforms.uSheen.value.set(haze); for (const k of ['uEarth', 'uMoon', 'uSheen']) SPW.uniforms[k].value.copy(SP.uniforms[k].value); }
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
  for (const [X, Z, w, l, h, rot, y] of E.villas) {
    const aa = X, s = -Z; if (Math.abs(s - F.s0) > reach * 0.7) continue;
    const p = ringP(aa, s, y); if (inField(p[0], p[2])) continue;   // the field's villas are rocks: drawn below
    boxR(aa, s, w, l, h, rot, y - 0.3, villaC, roofC);
  }
  { const C = E.clubhouse; if (Math.abs(C.s - F.s0) < reach) { boxR(C.a, C.s, C.w, C.d, C.h, 0.1, C.y - 0.3, villaC, roofC); boxR(C.a, C.s, C.w * 0.6, C.d * 0.6, C.h + 8, 0.1, C.y - 0.3, villaC, roofC); } }
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
    const col = Rk.wall ? lin([236, 232, 222]) : Rk.villa === 'the lip marker' ? lin([214, 80, 60]) : villaC, lo = C.map(([x, z]) => [x, Rk.y, z]), hi = C.map(([x, z]) => [x, Rk.y + Rk.h, z]);
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, sh = k % 2 ? 0.86 : 1; Bb.quad(lo[k], lo[k2], hi[k2], hi[k], col.map(v => v * sh)); }
    Bb.quad(hi[0], hi[1], hi[2], hi[3], Rk.wall || Rk.villa === 'the lip marker' ? col : roofC);
  }
  { const m = Bb.mesh(vc({ roughness: 0.75 })); if (m) group.add(m); }
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
      far.push({ p, pine: kind === 'yew' || kind === 'poplar', h: hh, r, hsh, up: ringUp(s) });
    }
    // this hole's own trees well off the line (they still play: T.trees keeps them; main.js leaves those marked
    // ringFar to this); the ones near the play keep main.js's fuller crowns
    const Lh = hole.line || [], lineD = (x, z) => { let m = Infinity; for (let i = 0; i < Lh.length - 1; i++) { const [ax, az] = Lh[i], [bx, bz] = Lh[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); m = Math.min(m, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return m; };
    for (const t of T.trees || []) if (lineD(t.x, t.z) > 60 && !Lh.some(q => Math.hypot(q[0] - t.x, q[1] - t.z) < 80)) { t.ringFar = true; far.push({ p: [t.x, t.y, t.z], pine: t.type === 'pine', h: t.h || 12, r: t.cr || 4, hsh: t.r ?? 0.5, up: new THREE.Vector3(0, 1, 0) }); }
    if (far.length) {
      const crownO = new THREE.IcosahedronGeometry(1, 0), crownP = new THREE.ConeGeometry(1, 1, 6), trunk = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
      const oaks = far.filter(t => !t.pine), pines = far.filter(t => t.pine);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color();
      const inst = (geo, list, color, place) => { if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((t, i) => { place(t); Q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t.up); M.compose(P, Q, S); m.setMatrixAt(i, M); C.setHex(color).multiplyScalar(0.8 + 0.35 * t.hsh); m.setColorAt(i, C); });
        m.instanceMatrix.needsUpdate = true; m.castShadow = false; m.receiveShadow = false; group.add(m); };
      const lift = (t, k) => P.set(t.p[0] + t.up.x * k, t.p[1] + t.up.y * k, t.p[2] + t.up.z * k);
      inst(crownO, oaks, 0x4c6a2c, t => { lift(t, t.h * 0.62); S.set(t.r, t.h * 0.36, t.r); });
      inst(crownP, pines, 0x2f4a26, t => { lift(t, t.h * 0.55); S.set(t.r * 0.8, t.h * 0.85, t.r * 0.8); });
      inst(trunk, far, 0x4a3a2a, t => { lift(t, t.h * 0.18); S.set(Math.max(0.25, t.r * 0.08), t.h * 0.36, Math.max(0.25, t.r * 0.08)); });
    }
  }
  return { trees, anims };
}
