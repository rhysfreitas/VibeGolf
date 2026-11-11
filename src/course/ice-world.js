// Rimeholm's glacier (global THREE): what COURSE.ice holds (world space) put into a hole's frame (hole.frame) and
// drawn: the far glacier from its height map (snow, blue ice, dark rock peaks) out to a ring of mountains, the
// crevasse walls down from the field's open air, seracs and pressure-ridge blocks, erratic boulders, the frozen
// falls, the braziers and the steam off the warm ground, the hot pools and the open water, the longhouse, the ice
// cave's roof, the ice bridge, the longship under the lake and the mammoth in the wall, and the aurora overhead.
// One merged mesh per material, so a hole is a handful of draw calls. The ball's side of it (boxes, boulders,
// wedges, spruce) is in the course module and terrain.js.
import { rng, fbm } from './noise.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
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
  return { tri, quad, mesh, get n() { return pos.length / 9; } };
}
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
// what the paint shows beyond the surface code: 1 bare rock, 2 travertine, 3 rubble, 4 the hall's floor
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}

/* ---------- the paint: two textures the ground shader reads (main.js, ICE) ---------- */
// A: R packed snow (fairway, tee), G grass (green 1, its collar 0.5), B black sand, A rough (0.55; snow 0)
// B: R lake ice, G bare rock (rubble 0.6), B powder bunker, A travertine
// warm moss round the green and the hot pools: patchy, thinning out with distance (0..1)
export function warmSpots(hole, ICE, L) {
  const out = [[hole.pin[0], hole.pin[1], 62]];
  if (ICE && L) for (const Wt of ICE.water) if (Wt.hot) { const P = Wt.p.map(p => L(...p)), c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length]; out.push([c[0], c[1], 30]); }
  return out;
}
let mossAt = () => 0;
export function surfaceTextures(T, hole, box, mPerTexel, ICE = null) {
  const F = hole.frame, a0 = F.heading * Math.PI / 180, fx = Math.sin(a0), fz = -Math.cos(a0), rx = Math.cos(a0), rz = Math.sin(a0);
  const Lw = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const warm = warmSpots(hole, ICE, Lw);
  mossAt = (x, z) => { let m = 0; for (const [wx, wz, wr] of warm) { const d = Math.hypot(x - wx, z - wz); if (d < wr) m = Math.max(m, (1 - d / wr) * 1.7); } return m <= 0 ? 0 : Math.min(1, m) * (fbm(x / 6, z / 6) > 0.46 ? 1 : 0.2); };
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, C = Fd ? Fd.codes : [], cF = C.indexOf('fairway'), cR = C.indexOf('fringe'), cG = C.indexOf('rough'), cI = C.indexOf('ice'), cT = C.indexOf('tee'), cGn = C.indexOf('green');
  // the field's surfaces are 2 m cells; a field cell under the green counts as collar
  const gCache = new Map(), onGreen = k => { let v = gCache.get(k); if (v === undefined) { v = T.surfaceAt(Fd.x0 + (k % Fd.nx) * Fd.cell, Fd.z0 + Math.floor(k / Fd.nx) * Fd.cell) === 'green'; gCache.set(k, v); } return v; };   // field cells under the green: collar
  // a cubic B-spline over the 4 x 4 cells round each texel: round contours (plain bilinear on 2 m cells leaves stairs)
  const bsw = t => [(1 - t) ** 3 / 6, (3 * t ** 3 - 6 * t * t + 4) / 6, (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6, t ** 3 / 6];
  const blend = (x, z) => {
    const fx = (x - Fd.x0) / Fd.cell, fz = (z - Fd.z0) / Fd.cell, i1 = Math.floor(fx), j1 = Math.floor(fz), wu = bsw(fx - i1), wv = bsw(fz - j1);
    const w = [0, 0, 0, 0, 0], add = (k, f) => { const c = onGreen(k) ? cR : Fd.s[k]; if (c === cF || c === cT) w[0] += f; else if (c === cR || c === cGn) w[1] += f; else if (c === cG) w[2] += f; else if (c === cI) w[3] += f; };
    for (let b = 0; b < 4; b++) for (let a2 = 0; a2 < 4; a2++) { const ii = Math.max(0, Math.min(Fd.nx - 1, i1 - 1 + a2)), jj = Math.max(0, Math.min(Fd.nz - 1, j1 - 1 + b)); add(jj * Fd.nx + ii, wu[a2] * wv[b]); }
    return w;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), m = ['green', 'fringe', 'sand', 'powder', 'tee', 'fairway'].includes(s) ? 0 : matAt(hole, x, z), o = (j * W + i) * 4, mo = mossAt(x, z);   // rock and travertine paint only on native ground (its 2 m cells would step across a green)
    const own = Fd && Fd.ready && !['green', 'sand', 'powder', 'tee', 'water', 'void'].includes(s) ? blend(x, z) : null;
    if (own) {
      a[o] = own[0] * 255; a[o + 1] = own[1] * 128; a[o + 2] = 0;
      a[o + 3] = Math.min(255, (own[0] + own[1] + own[3]) * 255 + own[2] * 140);
      b[o] = own[3] * 255;
    } else {
    a[o] = s === 'fairway' || s === 'tee' ? 255 : 0;
    a[o + 1] = s === 'green' ? 255 : s === 'fringe' ? 128 : 0;
    a[o + 2] = s === 'sand' ? 255 : 0;
    a[o + 3] = s === 'desert' || s === 'void' ? 0 : s === 'rough' ? 140 : 255;
    b[o] = s === 'ice' ? 255 : 0;
    }
    if (mo > 0 && (s === 'rough' || s === 'desert') && a[o + 1] < 60) a[o + 1] = Math.round(77 * mo);
    b[o + 1] = m === 1 ? 255 : m === 3 ? 150 : m === 4 ? 120 : 0;
    b[o + 2] = s === 'powder' ? 255 : 0;
    b[o + 3] = m === 2 ? 255 : 0;
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#e9eef5', rough: '#d6dfe9', firstcut: '#cfd9e5', fairway: '#b6c8db', fringe: '#5c9448', green: '#73b657', tee: '#c4d2e2', sand: '#2b2a2a', powder: '#ffffff', water: '#2f6f8a', ice: '#7d9cb4', void: '#0b1018' };
  return (x, z) => { const s = T.surfaceAt(x, z); if (s === 'desert') { const m = matAt(hole, x, z); if (m === 1) return '#4a4c52'; if (m === 2) return '#d9ccb0'; if (m === 3) return '#9aa1aa'; } return C[s] || '#e9eef5'; };
}

// a low-poly ellipsoid (animals, cairn stones) into a batch, coloured k (top tinted by kTop if given)
function blob(B, cx, cy, cz, rx, ry, rz, k, kTop = null, n = 7, m = 4, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (u, v) => { const th = u / n * Math.PI * 2, ph = v / m * Math.PI - Math.PI / 2, x = Math.cos(ph) * Math.cos(th) * rx, z = Math.cos(ph) * Math.sin(th) * rz; return [cx + x * c - z * s, cy + Math.sin(ph) * ry, cz + x * s + z * c]; };
  for (let v = 0; v < m; v++) for (let u = 0; u < n; u++) { const col = kTop && v >= m - 1 ? kTop : k; B.quad(P(u, v), P(u + 1, v), P(u + 1, v + 1), P(u, v + 1), col); }
}
// an oriented slab from a to b ([x, y, z]), w across, t thick
function slab(B, a, b, w, t, k) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d) || 1, u = d.map(v => v / L);
  let n = [-u[2], 0, u[0]]; const nl = Math.hypot(n[0], n[2]) || 1; n = [n[0] / nl, 0, n[2] / nl];
  const up = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const C = (p, sa, sb) => [p[0] + n[0] * w / 2 * sa + up[0] * t / 2 * sb, p[1] + n[1] * w / 2 * sa + up[1] * t / 2 * sb, p[2] + n[2] * w / 2 * sa + up[2] * t / 2 * sb];
  const A = [C(a, -1, -1), C(a, 1, -1), C(a, 1, 1), C(a, -1, 1)], Q = [C(b, -1, -1), C(b, 1, -1), C(b, 1, 1), C(b, -1, 1)];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; B.quad(A[i], A[j], Q[j], Q[i], k); B.quad(A[i], Q[i], Q[j], A[j], k); }
}

/* ---------- textures made once ---------- */
let TEX = null;
function makeTextures() {
  const glow = (r0, stops) => { const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); for (const [t, c] of stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  return {
    flame: glow(0, [[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,170,60,0.9)'], [0.6, 'rgba(220,80,20,0.35)'], [1, 'rgba(120,30,0,0)']]),
    steam: glow(0, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(240,246,255,0.25)'], [1, 'rgba(240,246,255,0)']]),
    moon: glow(0, [[0, 'rgba(255,252,240,1)'], [0.42, 'rgba(250,246,232,1)'], [0.47, 'rgba(220,226,240,0.35)'], [1, 'rgba(160,180,220,0)']]),
    halo: glow(0, [[0, 'rgba(200,214,240,0.35)'], [0.4, 'rgba(160,180,220,0.12)'], [1, 'rgba(120,140,190,0)']]),
    streak: (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 128, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 16); const v = g.getImageData(0, 0, 128, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 128; x++) v.data[(y * 128 + x) * 4 + 3] *= Math.sin(Math.PI * (y + 0.5) / 16) * (0.7 + 0.3 * Math.sin(x * 0.4 + y));
      g.putImageData(v, 0, 0); const t = new THREE.CanvasTexture(cv); return t; })(),
  };
}

/* ---------- the aurora: curtains of light round the sky, slowly folding ---------- */
function aurora(group, cx, cz, y0, bright = 1) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uB: { value: bright } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vU; uniform float uT, uB;
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      void main(){
        float x = vU.x * 46.0, t = uT * 0.03;
        float fold = vn(vec2(x*0.35 + t, 3.0)) * 2.0 + vn(vec2(x*1.3 - t*1.7, 9.0)) * 0.6;   // where the curtain bunches
        float rays = 0.55 + 0.45 * vn(vec2(x*9.0 + fold*4.0, t*2.0));                       // fine vertical rays
        float band = smoothstep(0.0, 0.12, vU.y) * (1.0 - smoothstep(0.35, 1.0, vU.y));
        float lower = 1.0 - smoothstep(0.02, 0.2, abs(vU.y - 0.12 - 0.05*sin(x*0.6 + fold)));  // the bright lower hem
        float a = (band * 0.55 + lower * 0.6) * rays * smoothstep(0.25, 0.9, vn(vec2(x*0.18 - t*0.6, 1.0)) + 0.25);
        a *= smoothstep(0.0, 0.12, vU.x) * (1.0 - smoothstep(0.88, 1.0, vU.x));
        vec3 col = mix(vec3(0.15, 1.0, 0.55), vec3(0.75, 0.22, 0.45), smoothstep(0.4, 0.95, vU.y));      // green, fading to red up the rays
        float hem = 1.0 - smoothstep(0.0, 0.05, abs(vU.y - 0.1 - 0.05*sin(x*0.6 + fold)));                // the violet lower hem of a fold
        col = mix(col, vec3(0.62, 0.3, 1.0), hem * 0.55);
        gl_FragColor = vec4(col * a * 0.55 * uB, 1.0);
      }`,
  });
  const g = new THREE.CylinderGeometry(5200, 5200, 2600, 96, 1, true, 0, Math.PI * 2);
  const m = new THREE.Mesh(g, mat); m.position.set(cx, y0 + 1300 + 900, cz); m.renderOrder = -2; m.frustumCulled = false; group.add(m);
  // a second, nearer and higher sweep across the sky
  const m2 = new THREE.Mesh(new THREE.CylinderGeometry(3200, 3600, 1600, 64, 1, true, 0.6, 2.4), mat); m2.position.set(cx + 600, y0 + 2600, cz - 900); m2.renderOrder = -2; m2.frustumCulled = false; group.add(m2);
  return (dt, t) => { mat.uniforms.uT.value = t; };
}

export function buildIce(hole, T, box, ICE, hi, { group, coarse, groundMat, rockMat, sunDir = null, night = true }) {
  if (!TEX) TEX = makeTextures();
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base, LR = r => r - a;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const R = rng(hi * 131 + 7), trees = [], anims = [], pools = [], smoke = [];
  const far = coarse ? 1500 : 2200;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, ...o });
  const iceMat = vc({ roughness: 0.3, envMapIntensity: 1.3 }), snowMat = vc({ roughness: 0.95 }), stoneMat = vc({ roughness: 0.95 });
  const Bi = batch(), Bs = batch(), Br = batch(), Bw = batch();   // ice, snow (ground and caps), rock and timber, the longship's timber

  // ---- the far glacier, from the height map: this hole's field where it has one (so the edges meet the playfield)
  const WM = ICE.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); WM.mDec = dec(WM.m, Uint8Array); }
  const st = coarse ? 3 : 2, wnx = WM.nx, wnz = WM.nz;
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;
  const wH = (i, j) => WM.hDec[j * wnx + i] / WM.scale + WM.y0;
  const cols = { 0: lin([226, 232, 242]), 1: lin([150, 188, 214]), 2: lin([62, 64, 70]), 3: lin([16, 30, 52]) };
  {
    const ni = Math.floor((wnx - 1) / st), nj = Math.floor((wnz - 1) / st), V = new Float32Array((ni + 1) * (nj + 1) * 3), C = new Float32Array((ni + 1) * (nj + 1) * 3), keep = new Uint8Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)), m = WM.mDec[J * wnx + I];
      if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) { y = g; if (m === 3) m = 0; } }
      // snow lies on anything not steep: rock only shows on the faces
      const c = cols[m] || cols[0], sh = 0.92 + 0.12 * fbm(X / 90, Z / 90);
      V.set([x, y - 0.6, z], k * 3); C.set([c[0] * sh, c[1] * sh, c[2] * sh], k * 3);
      keep[k] = near(x, z, 3600) ? 1 : 0;
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if (!keep[k] || !keep[k3]) continue;
      // under the playfield: leave it out
      const xs = [V[k * 3], V[k1 * 3], V[k2 * 3], V[k3 * 3]], zs = [V[k * 3 + 2], V[k1 * 3 + 2], V[k2 * 3 + 2], V[k3 * 3 + 2]];
      if (xs.every((x, q) => inPlay(x, zs[q]))) continue;
      idx.push(k, k2, k1, k1, k2, k3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(V, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(idx); g.computeVertexNormals();
    // steep faces of the far ground go to rock or ice by their slope
    const N = g.attributes.normal;
    for (let k = 0; k < N.count; k++) { const ny = N.getY(k); if (ny < 0.72) { const t = Math.min(1, (0.72 - ny) / 0.3), c = C.subarray(k * 3, k * 3 + 3), rk = c[0] < 0.2 ? cols[2] : cols[1]; c[0] += (rk[0] - c[0]) * t; c[1] += (rk[1] - c[1]) * t; c[2] += (rk[2] - c[2]) * t; } }
    const m = new THREE.Mesh(g, vc({ roughness: 0.92 })); m.receiveShadow = true; group.add(m);
  }
  // ---- out to the horizon: a snow plain past the map, and a ring of mountains
  {
    const Rg = 14000, y = LY(WM.y0 + 60), Bp = batch(), k = lin([210, 218, 232]);
    const c0 = L(WM.x0, WM.z0), c1 = L(WM.x0 + (wnx - 1) * WM.cell, WM.z0), c2 = L(WM.x0 + (wnx - 1) * WM.cell, WM.z0 + (wnz - 1) * WM.cell), c3 = L(WM.x0, WM.z0 + (wnz - 1) * WM.cell);
    const rim = [c0, c1, c2, c3], ctr = [(c0[0] + c2[0]) / 2, (c0[1] + c2[1]) / 2];
    for (let i = 0; i < 4; i++) { const p = rim[i], q = rim[(i + 1) % 4], P2 = [ctr[0] + (p[0] - ctr[0]) * 6, ctr[1] + (p[1] - ctr[1]) * 6], Q2 = [ctr[0] + (q[0] - ctr[0]) * 6, ctr[1] + (q[1] - ctr[1]) * 6];
      Bp.quad([p[0], y - 30, p[1]], [P2[0], y - 30, P2[1]], [Q2[0], y - 30, Q2[1]], [q[0], y - 30, q[1]], k); }
    const Rm = rng(41);
    const Bm = batch();
    for (let i = 0; i < 70; i++) {   // the ranges round the ice: jagged peaks of dark rock, snow on their tops, 5-10 km out
      const th = Rm() * Math.PI * 2, d = 5200 + Rm() * 5000, X = ctr[0] + Math.cos(th) * d, Z = ctr[1] + Math.sin(th) * d, r = 450 + Rm() * 900, H = 220 + Rm() * 520 + Rm() * Rm() * 500;
      const n = 6 + Math.floor(Rm() * 3), pk = [X + (Rm() - 0.5) * r * 0.4, y + H, Z + (Rm() - 0.5) * r * 0.4], base = [];
      for (let s = 0; s < n; s++) { const t = s / n * Math.PI * 2 + Rm() * 0.4, rr = r * (0.7 + Rm() * 0.5); base.push([X + Math.cos(t) * rr, y - 40, Z + Math.sin(t) * rr]); }
      for (let s = 0; s < n; s++) { const p = base[s], q = base[(s + 1) % n], mid = (u, v, f) => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f, u[2] + (v[2] - u[2]) * f];
        const p2 = mid(p, pk, 0.45 + Rm() * 0.25), q2 = mid(q, pk, 0.45 + Rm() * 0.25), lit = 0.6 + 0.4 * Math.max(0, Math.cos(th - 2.4)), dark = lin([16 + Rm() * 10, 20 + Rm() * 10, 32 + Rm() * 12]).map(v => v * lit);
        Bm.quad(p, q, q2, p2, dark); Bm.tri(p2, q2, pk, lin([70, 82, 108]).map(v => v * lit)); }
    }
    const m = Bp.mesh(vc({ roughness: 1 }), false); if (m) group.add(m);
    const mm = Bm.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), false); if (mm) { mm.renderOrder = -1; group.add(mm); }
  }

  // ---- crevasse walls: blue ice down from the field's open air, darkening to black
  if (Fd && Fd.ready) {
    const top = lin([170, 210, 232]), mid = lin([70, 130, 175]), deep = lin([10, 22, 40]);
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, v = Fd.h[k];
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const w = Fd.h[k + di + dj * Fd.nx], va = Number.isNaN(v), wa = Number.isNaN(w); if (va === wa) continue;
        const g = va ? w : v, x = Fd.x0 + (i + di * 0.5) * Fd.cell, z = Fd.z0 + (j + dj * 0.5) * Fd.cell, h2 = Fd.cell * 0.55;
        if (!near(x, z, far)) continue;
        const p = dj ? [[x - h2, z], [x + h2, z]] : [[x, z - h2], [x, z + h2]], j1 = (fbm(x / 7, z / 7) - 0.5) * 1.4;
        const into = va ? [-di, -dj] : [di, dj], ov = 0.5 + fbm(x / 5, z / 5) * 0.7;   // toward the open air: the cornice hangs out over it
        const cA = [p[0][0] + into[0] * ov, p[0][1] + into[1] * ov], cB = [p[1][0] + into[0] * ov, p[1][1] + into[1] * ov];
        Bs.quad([p[0][0], g + 0.3, p[0][1]], [p[1][0], g + 0.3, p[1][1]], [cB[0], g - 0.2, cB[1]], [cA[0], g - 0.2, cA[1]], lin([236, 242, 250]));
        Bs.quad([p[1][0], g + 0.3, p[1][1]], [p[0][0], g + 0.3, p[0][1]], [cA[0], g - 0.2, cA[1]], [cB[0], g - 0.2, cB[1]], lin([236, 242, 250]));
        Bs.quad([cA[0], g - 0.2, cA[1]], [cB[0], g - 0.2, cB[1]], [p[1][0], g - 0.9, p[1][1]], [p[0][0], g - 0.9, p[0][1]], lin([200, 220, 236]));
        Bs.quad([cB[0], g - 0.2, cB[1]], [cA[0], g - 0.2, cA[1]], [p[0][0], g - 0.9, p[0][1]], [p[1][0], g - 0.9, p[1][1]], lin([200, 220, 236]));
        const firn = lin([214, 230, 240]), dirt = lin([92, 112, 132]), l2 = lin([140, 186, 214]);
        for (const [A, Bq] of [[p[0], p[1]], [p[1], p[0]]]) {
          Bi.quad([A[0], g + 0.25, A[1]], [Bq[0], g + 0.25, Bq[1]], [Bq[0], g - 1.4, Bq[1]], [A[0], g - 1.4, A[1]], firn);
          Bi.quad([A[0], g - 1.4, A[1]], [Bq[0], g - 1.4, Bq[1]], [Bq[0], g - 1.7, Bq[1]], [A[0], g - 1.7, A[1]], dirt);
          Bi.quad([A[0], g - 1.7, A[1]], [Bq[0], g - 1.7, Bq[1]], [Bq[0], g - 3.2 + j1 * 0.5, Bq[1]], [A[0], g - 3.2 + j1 * 0.5, A[1]], top);
          Bi.quad([A[0], g - 3.2 + j1 * 0.5, A[1]], [Bq[0], g - 3.2 + j1 * 0.5, Bq[1]], [Bq[0], g - 5 + j1, Bq[1]], [A[0], g - 5 + j1, A[1]], l2);
          Bi.quad([A[0], g - 5 + j1, A[1]], [Bq[0], g - 5 + j1, Bq[1]], [Bq[0], g - 16, Bq[1]], [A[0], g - 16, A[1]], mid);
          Bi.quad([A[0], g - 16, A[1]], [Bq[0], g - 16, Bq[1]], [Bq[0], g - 45, Bq[1]], [A[0], g - 45, A[1]], deep);
        }
      }
    }
  }

  // ---- seracs: leaning, faceted pillars of ice with snow on their tops; pressure-ridge blocks
  const iceC = [lin([196, 224, 240]), lin([170, 208, 232]), lin([150, 196, 226]), lin([210, 232, 246])];
  const pillar = (x, z, y0, r, H, seed, lean = 0.12, n = 6) => {
    const Rs = rng(seed * 7 + 1), tilt = [(Rs() - 0.5) * lean * H, (Rs() - 0.5) * lean * H], bot = [], topP = [], c = iceC[Math.floor(Rs() * 4)];
    const cut = (Rs() - 0.5) * r * 0.9;   // the top is a slanted break
    for (let s = 0; s < n; s++) { const t = s / n * Math.PI * 2 + Rs() * 0.5, rr = r * (0.75 + Rs() * 0.45), ox = Math.cos(t) * rr, oz = Math.sin(t) * rr;
      bot.push([x + ox, y0, z + oz]); topP.push([x + ox * 0.7 + tilt[0], y0 + H + ox / r * cut, z + oz * 0.7 + tilt[1]]); }
    for (let s = 0; s < n; s++) { const q = (s + 1) % n, sh = 0.82 + 0.18 * Math.cos(s * 1.7 + seed); Bi.quad(bot[s], bot[q], topP[q], topP[s], c.map(v => v * sh)); }
    const tc = [topP.reduce((s, p) => s + p[0], 0) / n, topP.reduce((s, p) => s + p[1], 0) / n + 0.3, topP.reduce((s, p) => s + p[2], 0) / n];
    for (let s = 0; s < n; s++) Bs.tri(topP[s], tc, topP[(s + 1) % n], lin([236, 242, 250]));
  };
  for (const [X, Z, y, r, H, seed] of ICE.seracs) { const [x, z] = L(X, Z); if (!near(x, z, far)) continue; pillar(x, z, footY(x, z, LY(y)) - 1, r, H, seed); }
  for (const [X, Z, y, r, H, tilt, seed] of ICE.blocks) { const [x, z] = L(X, Z); if (!near(x, z, far * 0.8)) continue; pillar(x, z, footY(x, z, LY(y)) - 0.6, r * 0.8, H, seed, 0.5 + Math.abs(tilt), 4); }

  // ---- erratic boulders: dark rock, a dusting of snow on top
  {
    const geo = new THREE.DodecahedronGeometry(1, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + 3, p.getZ(i) * 2 + p.getY(i)) - 0.5) * 0.5; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); }
    geo.computeVertexNormals();
    const cl = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const up = geo.attributes.normal.getY(i), c = up > 0.6 ? lin([230, 236, 244]) : lin([70, 70, 76]); cl.set(c, i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    const list = ICE.boulders.map(([X, Z, y, r, H]) => { const [x, z] = L(X, Z); return near(x, z, far) ? [x, z, footY(x, z, LY(y)), r, H] : null; }).filter(Boolean);
    const im = new THREE.InstancedMesh(geo, vc({ roughness: 0.95 }), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    list.forEach(([x, z, y, r, H], i) => { q.setFromEuler(e.set(0, (x * 0.37 + z * 0.11) % 6.28, 0)); m4.compose(new THREE.Vector3(x, y + H * 0.35, z), q, new THREE.Vector3(r, H * 0.62, r * 0.85)); im.setMatrixAt(i, m4); });
    im.castShadow = im.receiveShadow = true; if (list.length) group.add(im);
  }

  // ---- spruce: this hole's play (hole.plants, drawn by main.js); the rest in view are drawn here too
  for (const [X, Z, y, r, H, k] of ICE.trees) { const [x, z] = L(X, Z); if (inField(x, z) || !near(x, z, far * 0.7)) continue; trees.push({ x, z, y: LY(y), s: H / 9, type: 'pine', r: ((X * 7.3 + Z * 3.1) % 1 + 1) % 1 }); }

  // ---- the frozen falls: ropey columns of ice that pour over the lip and flare where they land; icicles
  const ring = (x, z, yTop, len, prof, seed, colr) => {   // a lathe: prof(t) = radius at t (0 top .. 1 bottom)
    const n = 7, rows = 6, Rs = rng(seed + 3), ph = Rs() * 6;
    let prev = null;
    for (let rI = 0; rI <= rows; rI++) {
      const t = rI / rows, y = yTop - len * t, rr = prof(t), cur = [];
      for (let s = 0; s < n; s++) { const th = s / n * Math.PI * 2 + ph, w = rr * (1 + 0.15 * Math.sin(th * 3 + t * 7 + ph)); cur.push([x + Math.cos(th) * w, y, z + Math.sin(th) * w]); }
      if (prev) for (let s = 0; s < n; s++) { const q = (s + 1) % n, sh = 0.86 + 0.14 * Math.cos(s * 1.3 + seed); Bi.quad(prev[s], prev[q], cur[q], cur[s], colr.map(v => v * sh)); }
      prev = cur;
    }
  };
  for (const [X, Z, top, len, r, seed] of ICE.icefalls) { const [x, z] = L(X, Z); if (!near(x, z, far)) continue;
    ring(x, z, LY(top), len, t => r * (1 - 0.28 * Math.sin(Math.PI * t)) + r * 0.9 * Math.max(0, (t - 0.78) / 0.22) ** 2, seed, lin([214, 236, 248])); }
  for (const [X, Z, top, len, r, seed] of ICE.icicles) { const [x, z] = L(X, Z); if (!near(x, z, far * 0.6)) continue;
    ring(x, z, LY(top), len, t => r * Math.pow(1 - t, 1.3) + 0.03, seed, lin([200, 228, 244])); }

  // ---- the ice cave's roof: a slab of blue ice over the back tees, hung with icicles
  for (const Rf of ICE.roofs) {
    const P = Rf.p.map(p => L(...p)); if (!near(P[0][0], P[0][1], far)) continue;
    const y0 = LY(Rf.y), y1 = y0 + Rf.t, Rr = rng(17);
    for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; Bi.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], lin([120, 170, 205])); }
    Bi.quad([P[0][0], y0, P[0][1]], [P[3][0], y0, P[3][1]], [P[2][0], y0, P[2][1]], [P[1][0], y0, P[1][1]], lin([90, 140, 180]));
    Bs.quad([P[0][0], y1, P[0][1]], [P[1][0], y1, P[1][1]], [P[2][0], y1, P[2][1]], [P[3][0], y1, P[3][1]], lin([232, 238, 246]));
    for (let k = 0; k < 70; k++) { const u = Rr(), v = Rr(), x = P[0][0] + (P[1][0] - P[0][0]) * u + (P[3][0] - P[0][0]) * v, z = P[0][1] + (P[1][1] - P[0][1]) * u + (P[3][1] - P[0][1]) * v;
      ring(x, z, y0 + 0.2, 1 + Rr() * Rr() * 9, t => (0.25 + Rr() * 0.4) * (1 - t) + 0.02, k, lin([190, 222, 242])); }
  }
  // ---- the ice bridge: an arch of old ice
  for (const A of ICE.arches) {
    const p = L(A.a[0], A.a[1]), q = L(A.b[0], A.b[1]); if (!near(p[0], p[1], far)) continue;
    const n = 14, P3 = t => [p[0] + (q[0] - p[0]) * t, LY(A.a[2] + (A.b[2] - A.a[2]) * t) + A.h * Math.sin(Math.PI * t), p[1] + (q[1] - p[1]) * t];
    const dx = q[0] - p[0], dz = q[1] - p[1], dl = Math.hypot(dx, dz), nx = -dz / dl * A.w / 2, nz = dx / dl * A.w / 2;
    for (let i = 0; i < n; i++) { const u = P3(i / n), v = P3((i + 1) / n), th = A.t * (1 + 0.8 * (1 - Math.sin(Math.PI * (i + 0.5) / n)));
      const c = (P, s, dy) => [P[0] + nx * s, P[1] + dy, P[2] + nz * s];
      Bi.quad(c(u, -1, -th / 2), c(v, -1, -th / 2), c(v, 1, -th / 2), c(u, 1, -th / 2), lin([120, 175, 210]));
      Bs.quad(c(u, -1, th / 2), c(u, 1, th / 2), c(v, 1, th / 2), c(v, -1, th / 2), lin([236, 242, 250]));
      for (const s of [-1, 1]) Bi.quad(c(u, s, -th / 2), c(u, s, th / 2), c(v, s, th / 2), c(v, s, -th / 2), lin([160, 202, 228])); }
  }

  // ---- the longhouse (the clubhouse): timber walls, a steep roof of turf under snow, carved gable heads, a warm door
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, toneMapped: false });
  for (const H of ICE.halls) {
    const P = H.p.map(p => L(...p)); if (!near(P[0][0], P[0][1], far)) continue;
    const c = [P.reduce((s, p) => s + p[0], 0) / 4, P.reduce((s, p) => s + p[1], 0) / 4];
    const y0 = Math.min(...P.map(p => footY(p[0], p[1], LY(H.y)))) - 0.3, y1 = y0 + H.h, yr = y1 + H.roof;
    const timber = lin([74, 52, 36]), dark = lin([46, 32, 24]);
    // the long sides bow out a little, as a longhouse's do
    const bow = (A, Bq, t, k) => [A[0] + (Bq[0] - A[0]) * t + (c[0] - (A[0] + Bq[0]) / 2) * -0.08 * Math.sin(Math.PI * t) * k, A[1] + (Bq[1] - A[1]) * t + (c[1] - (A[1] + Bq[1]) / 2) * -0.08 * Math.sin(Math.PI * t) * k];
    const n = 8;
    for (const [A, Bq] of [[P[0], P[1]], [P[2], P[3]]]) for (let i = 0; i < n; i++) {
      const p = bow(A, Bq, i / n, 1), q = bow(A, Bq, (i + 1) / n, 1);
      Br.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], i % 2 ? timber : dark);
      // the roof from the eave out over the wall to the ridge
      const r0 = [(A[0] + P[(P.indexOf(A) + 3) % 4][0]) / 2, (A[1] + P[(P.indexOf(A) + 3) % 4][1]) / 2];
      const mid = [c[0] + (Bq[0] - A[0]) * ((i / n) - 0.5), c[1] + (Bq[1] - A[1]) * ((i / n) - 0.5)], mid2 = [c[0] + (Bq[0] - A[0]) * (((i + 1) / n) - 0.5), c[1] + (Bq[1] - A[1]) * (((i + 1) / n) - 0.5)];
      const ov = (pt) => [pt[0] + (pt[0] - c[0]) * 0.12, pt[1] + (pt[1] - c[1]) * 0.12];
      const pe = ov(p), qe = ov(q);
      // snow on top, facing up whichever side this is; turf underneath, facing down
      const face = (B, up, a, b, cc, d, col) => { const ny = (b[2] - a[2]) * (cc[0] - a[0]) - (b[0] - a[0]) * (cc[2] - a[2]); if ((ny > 0) === up) B.quad(a, b, cc, d, col); else B.quad(d, cc, b, a, col); };
      face(Bs, true, [pe[0], y1 - 0.6, pe[1]], [qe[0], y1 - 0.6, qe[1]], [mid2[0], yr, mid2[1]], [mid[0], yr, mid[1]], lin([232, 238, 246]));
      face(Br, false, [pe[0], y1 - 1.0, pe[1]], [qe[0], y1 - 1.0, qe[1]], [mid2[0], yr - 0.4, mid2[1]], [mid[0], yr - 0.4, mid[1]], lin([60, 70, 50]));
      { const e0 = [pe[0], y1 - 1.0, pe[1]], e1 = [qe[0], y1 - 1.0, qe[1]], e2 = [qe[0], y1 - 0.6, qe[1]], e3 = [pe[0], y1 - 0.6, pe[1]]; Br.quad(e0, e1, e2, e3, lin([60, 70, 50])); Br.quad(e3, e2, e1, e0, lin([60, 70, 50])); }   // the turf showing at the eave
      void r0;
    }
    // gable ends, the carved heads crossing over the ridge, and a lit door
    for (const [A, Bq] of [[P[1], P[2]], [P[3], P[0]]]) {
      const m = [(A[0] + Bq[0]) / 2, (A[1] + Bq[1]) / 2];
      Br.quad([A[0], y0, A[1]], [Bq[0], y0, Bq[1]], [Bq[0], y1, Bq[1]], [A[0], y1, A[1]], timber);
      Br.tri([A[0], y1, A[1]], [Bq[0], y1, Bq[1]], [m[0], yr, m[1]], dark);
      const out = [m[0] + (m[0] - c[0]) * 0.06, m[1] + (m[1] - c[1]) * 0.06];
      for (const s of [-1, 1]) { const tip = [out[0] + (Bq[0] - A[0]) * 0.12 * s, out[1] + (Bq[1] - A[1]) * 0.12 * s];
        Br.quad([m[0], yr - 0.3, m[1]], [tip[0], yr + 2.2, tip[1]], [tip[0], yr + 2.6, tip[1]], [m[0], yr + 0.3, m[1]], dark); }
      const d0 = [m[0] + (A[0] - m[0]) * 0.18, m[1] + (A[1] - m[1]) * 0.18], d1 = [m[0] - (A[0] - m[0]) * 0.18, m[1] - (A[1] - m[1]) * 0.18];
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute([d0[0] + (out[0] - m[0]), y0, d0[1] + (out[1] - m[1]), d1[0] + (out[0] - m[0]), y0, d1[1] + (out[1] - m[1]), d1[0] + (out[0] - m[0]), y0 + 3, d1[1] + (out[1] - m[1]), d0[0] + (out[0] - m[0]), y0 + 3, d0[1] + (out[1] - m[1])], 3)); dg.setIndex([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2]);
      group.add(new THREE.Mesh(dg, glowMat));
      pools.push([out[0], out[1], 14, 1.3, 0]);
    }
    for (const i of [0, 1, 2]) smoke.push([c[0] + (P[1][0] - P[0][0]) * (i - 1) * 0.25, c[1] + (P[1][1] - P[0][1]) * (i - 1) * 0.25, yr - 0.5, 1.2]);   // smoke from the roof
  }

  // ---- the longship: its stern under the lake ice (a dark shape seen through it), its bow rising out of the ice at
  // `rise` degrees for `out` metres: a clinker hull, the dragon prow, a broken mast with a scrap of frozen sail,
  // shields along the gunwales, snow and icicles, the ice heaved up in plates where it broke through
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x03070c, transparent: true, opacity: 0.62, depthWrite: false });
  for (const S of ICE.longships) {
    const [x, z] = L(S.x, S.z); if (!near(x, z, far)) continue;
    const r = LR(S.rot), d = [Math.cos(r), Math.sin(r)], nl = [-d[1], d[0]], ph = (S.rise || 0) * Math.PI / 180, out = S.out || 0;
    const yI = (T.groundAt(x, z) ?? LY(S.y + 0.6)), bu = S.len / 2 - out * Math.cos(ph);   // the break, from the centre along the keel
    { // the submerged part, stern to the break
      const shp = new THREE.Shape(), n = 20, tB = (bu + S.len / 2) / S.len, W = t => S.beam / 2 * Math.sin(Math.PI * t) ** 0.6;
      const pts = []; for (let i = 0; i <= n; i++) { const t = tB * i / n; pts.push([(t - 0.5) * S.len, W(t)]); }
      pts.forEach(([u, w], i) => (i ? shp.lineTo(u, w) : shp.moveTo(u, w))); for (let i = n; i >= 0; i--) shp.lineTo(pts[i][0], -pts[i][1]);
      const g = new THREE.ShapeGeometry(shp); g.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(g, shadowMat); m.position.set(x, yI + 0.03, z); m.rotation.y = -r; m.renderOrder = 2; group.add(m);
    }
    if (!out) continue;
    const bx = x + d[0] * bu, bz = z + d[1] * bu, sp = Math.sin(ph), cp = Math.cos(ph);
    // a point on the hull: u along the keel from the break (rising), lat across, v up off the keel line
    const H = (u, lat, v) => [bx + d[0] * (u * cp - v * sp) + nl[0] * lat, yI + u * sp + v * cp, bz + d[1] * (u * cp - v * sp) + nl[1] * lat];
    const both = (B, a, b, c, e, k) => { B.quad(a, b, c, e, k); B.quad(e, c, b, a, k); };
    const Rw = rng(Math.round(S.x * 7 + S.z * 3));
    const wood = [lin([132, 122, 108]), lin([112, 102, 90]), lin([146, 136, 120]), lin([100, 92, 82])], inner = lin([64, 58, 50]);   // old timber weathered silver-grey, frosted
    const hw = u => S.beam / 2 * (1 - Math.pow(Math.max(0, u) / out, 2.4) * 0.93), dp = u => 2.3 * (1 - 0.55 * Math.pow(Math.max(0, u) / out, 2)), gw = u => 0.5 + 1.7 * Math.pow(Math.max(0, u) / out, 3);
    const sec = (u, k, K) => { const ps = -Math.PI / 2 + Math.PI * k / K; return [hw(u) * Math.sin(ps), -dp(u) * Math.cos(ps) + gw(u) * Math.sin(ps) ** 2]; };
    const NU = coarse ? 10 : 18, K = 14;
    for (let i = 0; i < NU; i++) {
      const u0 = -0.8 + (out + 0.8) * i / NU, u1 = -0.8 + (out + 0.8) * (i + 1) / NU;
      for (let k = 0; k < K; k++) {
        const [l00, v00] = sec(u0, k, K), [l01, v01] = sec(u0, k + 1, K), [l10, v10] = sec(u1, k, K), [l11, v11] = sec(u1, k + 1, K);
        const lap = 0.05 * (k % 2 ? 1 : -1), col = wood[(k + (i > NU * 0.6 && k % 3 === 0 ? 1 : 0)) % 4];   // clinker strakes, lapped
        both(Bw, H(u0, l00 * (1 + lap), v00), H(u1, l10 * (1 + lap), v10), H(u1, l11, v11), H(u0, l01, v01), col);
        // the inside, darker, a little in
        Bw.quad(H(u0, l01 * 0.92, v01 + 0.1), H(u1, l11 * 0.92, v11 + 0.1), H(u1, l10 * 0.92, v10 + 0.1), H(u0, l00 * 0.92, v00 + 0.1), inner);
      }
      // snow along both gunwales and drifted along the bottom inside
      for (const sd of [-1, 1]) { const g0 = sec(u0, sd < 0 ? 0 : K, K), g1 = sec(u1, sd < 0 ? 0 : K, K);
        both(Bs, H(u0, g0[0], g0[1] + 0.02), H(u1, g1[0], g1[1] + 0.02), H(u1, g1[0] * 0.86, g1[1] + 0.16), H(u0, g0[0] * 0.86, g0[1] + 0.16), lin([228, 234, 244]));
        // icicles off the gunwale, hanging straight down
        if (!coarse && Rw() < 0.7) { const t = Rw(), uu = u0 + (u1 - u0) * t, gg = sec(uu, sd < 0 ? 0 : K, K), p = H(uu, gg[0] * 1.02, gg[1] - 0.05), ln = 0.25 + Rw() * 0.9;
          for (let q = 0; q < 3; q++) { const a0 = q / 3 * Math.PI * 2, a1 = (q + 1) / 3 * Math.PI * 2, rr = 0.06 + ln * 0.05; Bi.tri([p[0] + Math.cos(a0) * rr, p[1], p[2] + Math.sin(a0) * rr], [p[0] + Math.cos(a1) * rr, p[1], p[2] + Math.sin(a1) * rr], [p[0], p[1] - ln, p[2]], lin([200, 228, 246])); } } }
      const kb = sec(u0, K / 2, K), kc = sec(u1, K / 2, K);
      if (u0 < out * 0.7) both(Bs, H(u0, -hw(u0) * 0.45, kb[1] + 0.35), H(u1, -hw(u1) * 0.45, kc[1] + 0.35), H(u1, hw(u1) * 0.45, kc[1] + 0.35), H(u0, hw(u0) * 0.45, kb[1] + 0.35), lin([222, 230, 242]));
    }
    // the stem curling up into the dragon's neck and head (square section, tapering)
    const g0 = gw(out), stem = [[out, -0.6], [out + 0.5, g0 * 0.6], [out + 0.75, g0 + 0.9], [out + 0.55, g0 + 2.2], [out + 0.1, g0 + 3.0], [out + 0.35, g0 + 3.55]];
    const tube = (P, r0, r1, k) => { for (let i = 0; i < P.length - 1; i++) { const ra = r0 + (r1 - r0) * i / (P.length - 1), rb = r0 + (r1 - r0) * (i + 1) / (P.length - 1), [ua, va] = P[i], [ub, vb] = P[i + 1];
      const C = (u, v, rr, sa, sb) => H(u + sb * rr * 0.7, sa * rr, v); for (const [sa, sb, sa2, sb2] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) both(Bw, C(ua, va, ra, sa, sb), C(ub, vb, rb, sa, sb), C(ub, vb, rb, sa2, sb2), C(ua, va, ra, sa2, sb2), k); } };
    tube(stem, 0.34, 0.2, wood[0]);
    { // the head: a long snout, open jaw, two horns, looking out over the lake
      const hu = out + 0.35, hv = g0 + 3.55, k = wood[2], kd = lin([40, 34, 28]);
      const box = (u0, v0, u1, v1, w, kk) => { const P = (u, v, l) => H(u, l, v), q = [[u0, v0], [u1, v1]]; const c = (i, sa, sb) => P(q[i][0], q[i][1] + sb * w * 0.5, sa * w * 0.5);
        for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) both(Bw, c(0, ...a), c(1, ...a), c(1, ...b), c(0, ...b), kk); };
      box(hu - 0.2, hv, hu + 1.25, hv + 0.15, 0.42, k);            // upper jaw
      box(hu - 0.1, hv - 0.32, hu + 1.0, hv - 0.5, 0.32, k);        // lower jaw, dropped open
      both(Bw, H(hu - 0.15, -0.08, hv + 0.2), H(hu - 0.55, -0.05, hv + 0.75), H(hu - 0.45, -0.02, hv + 0.75), H(hu - 0.05, -0.02, hv + 0.2), k);   // horns
      both(Bw, H(hu - 0.15, 0.08, hv + 0.2), H(hu - 0.55, 0.05, hv + 0.75), H(hu - 0.45, 0.02, hv + 0.75), H(hu - 0.05, 0.02, hv + 0.2), k);
      both(Bw, H(hu + 0.6, -0.22, hv + 0.02), H(hu + 0.75, -0.22, hv + 0.02), H(hu + 0.75, -0.22, hv + 0.13), H(hu + 0.6, -0.22, hv + 0.13), kd);  // eyes
      both(Bw, H(hu + 0.6, 0.22, hv + 0.02), H(hu + 0.75, 0.22, hv + 0.02), H(hu + 0.75, 0.22, hv + 0.13), H(hu + 0.6, 0.22, hv + 0.13), kd);
      both(Bs, H(hu - 0.2, -0.2, hv + 0.17), H(hu + 1.2, -0.2, hv + 0.17), H(hu + 1.2, 0.2, hv + 0.17), H(hu - 0.2, 0.2, hv + 0.17), lin([232, 238, 246]));   // snow on its snout
    }
    // shields along the gunwales: round, painted halves, some lost
    for (const sd of [-1, 1]) for (let q = 0; q < 6; q++) { if (Rw() < 0.3) continue; const uu = out * (0.08 + q * 0.12), gg = sec(uu, sd < 0 ? 0 : K, K), c0 = H(uu, gg[0] * 1.04, gg[1] - 0.35), rr = 0.42;
      const kA = q % 2 ? lin([150, 54, 40]) : lin([210, 196, 160]), kB = q % 2 ? lin([210, 196, 160]) : lin([40, 60, 90]);
      for (let e = 0; e < 8; e++) { const a0 = e / 8 * Math.PI * 2, a1 = (e + 1) / 8 * Math.PI * 2, P = a => H(uu + Math.cos(a) * rr, gg[0] * 1.06, gg[1] - 0.35 + Math.sin(a) * rr);
        const kk = e < 4 ? kA : kB; Bw.tri(c0, P(a0), P(a1), kk); Bw.tri(c0, P(a1), P(a0), kk); } }
    // the mast, snapped, raking back with the hull; a stub of yard and a scrap of striped sail frozen stiff
    const mu = out * 0.32, mv0 = -dp(mu) + 0.3, ml = 4.6;
    slab(Bw, H(mu, 0, mv0), H(mu, 0, mv0 + ml), 0.3, 0.3, wood[3]);
    for (let q = 0; q < 3; q++) Bw.tri(H(mu - 0.15, -0.15 + q * 0.15, mv0 + ml), H(mu + 0.15, -0.15 + q * 0.15, mv0 + ml), H(mu + (q - 1) * 0.08, -0.1 + q * 0.12, mv0 + ml + 0.5 + q * 0.25), wood[3]);
    const ya = H(mu, 0.2, mv0 + ml - 0.7), yb = H(mu, 3.1, mv0 + ml - 0.55); slab(Bw, ya, yb, 0.18, 0.18, wood[1]);
    { const NS = 6, NV = 4, drop = 2.4;
      for (let a2 = 0; a2 < NS; a2++) for (let b2 = 0; b2 < NV; b2++) {
        const P = (i, j) => { const t = i / NS, f = j / NV, tear = j === NV ? 0.55 + 0.45 * Math.sin(i * 2.7 + 1) * Math.sin(i * 1.3) : 1; return [ya[0] + (yb[0] - ya[0]) * t * 0.92 + d[0] * 0.25 * Math.sin(f * 2.2), ya[1] + (yb[1] - ya[1]) * t - drop * f * tear * (1 - 0.35 * t), ya[2] + (yb[2] - ya[2]) * t * 0.92 + d[1] * 0.25 * Math.sin(f * 2.2)]; };
        const red = a2 % 2 === 0, k = (red ? lin([150, 70, 62]) : lin([214, 206, 190])).map((v, i) => v * 0.8 + 0.18 * [0.8, 0.86, 0.92][i] * (b2 / NV));   // frosted toward the hem
        both(Bw, P(a2, b2), P(a2 + 1, b2), P(a2 + 1, b2 + 1), P(a2, b2 + 1), k); } }
    // where it broke through: the ice heaved up in plates round the hull, snow drifted against it
    for (let q = 0; q < (coarse ? 8 : 14); q++) { const a2 = Rw() * Math.PI * 2, rr = S.beam * 0.55 + Rw() * 3.5, px = bx + Math.cos(a2) * rr, pz = bz + Math.sin(a2) * rr, len = 1.2 + Rw() * 2.2, tilt = 0.25 + Rw() * 0.6;
      const ox = Math.cos(a2), oz = Math.sin(a2); slab(Bi, [px - ox * len * 0.5, yI - 0.1, pz - oz * len * 0.5], [px + ox * len * 0.5 * Math.cos(tilt), yI - 0.1 + len * Math.sin(tilt), pz + oz * len * 0.5 * Math.cos(tilt)], 1 + Rw() * 1.6, 0.35, lin([168, 204, 228])); }
    for (let q = 0; q < 6; q++) { const a2 = q / 6 * Math.PI * 2 + Rw(), rr = S.beam * 0.45; blob(Bs, bx + Math.cos(a2) * rr, yI, bz + Math.sin(a2) * rr, 1.6 + Rw(), 0.6 + Rw() * 0.4, 1.2, lin([224, 232, 244]), null, 7, 3); }
    pools.push([bx + d[0] * 3, bz + d[1] * 3, 9, 0.75, 0]);   // a faint warm glow on it, so it reads at night
  }
  // ---- the mammoth in the valley wall: a dark bulk behind clear ice
  for (const Mm of ICE.mammoths) {
    const [x, z] = L(Mm.x, Mm.z); if (!near(x, z, far)) continue;
    const y = footY(x, z, LY(Mm.y)), r = LR(Mm.rot), grp = new THREE.Group(), hair = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 1 }), tusk = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
    const blob = (sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), hair); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); grp.add(m); };
    blob(2.6, 2.1, 1.7, 0, 3.4, 0); blob(1.4, 1.5, 1.3, 2.6, 4.4, 0); blob(0.9, 0.9, 0.9, 1.6, 5.2, 0);
    for (const [lx, lz] of [[-1.5, -0.8], [-1.5, 0.8], [1.3, -0.8], [1.3, 0.8]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 2.4, 8), hair); l.position.set(lx, 1.2, lz); grp.add(l); }
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.18, 2.6, 8), hair); tr.position.set(3.6, 2.9, 0); tr.rotation.z = 0.35; grp.add(tr);
    for (const s of [-1, 1]) { const tk = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 6, 16, 2.4), tusk); tk.position.set(3.4, 2.9, s * 0.55); tk.rotation.set(0, 0, -1.2); grp.add(tk); }
    const box = new THREE.Mesh(new THREE.BoxGeometry(9.5, 7.5, 5.5), new THREE.MeshStandardMaterial({ color: 0xbfe2f5, roughness: 0.15, transparent: true, opacity: 0.38, depthWrite: false }));
    box.position.set(0.8, 3.4, 0); box.renderOrder = 3; grp.add(box);
    grp.position.set(x, y - 0.5, z); grp.rotation.y = -r; group.add(grp);
  }

  // ---- water: the hot pools (turquoise, steaming) and the open water in the lake (black)
  const hotMat = new THREE.MeshStandardMaterial({ color: 0x3e9fa8, roughness: 0.15, metalness: 0.05, emissive: 0x0b3a40, emissiveIntensity: night ? 0.6 : 0.15, transparent: true, opacity: 0.92 });
  const coldMat = new THREE.MeshStandardMaterial({ color: 0x0a1820, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.96 });
  for (const Wt of ICE.water) {
    const P = Wt.p.map(p => L(...p)), c = [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
    if (!near(c[0], c[1], far) || !inField(c[0], c[1])) continue;   // another hole's pool would float over this one
    const y = LY(Wt.y), g0 = T.groundAt(c[0], c[1]); if (g0 === null || Math.abs(g0 + 0.8 - y) > 2.5) continue;
    const shp = new THREE.Shape(P.map(p => new THREE.Vector2(p[0], -p[1]))), g = new THREE.ShapeGeometry(shp); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, Wt.hot ? hotMat : coldMat); m.position.y = y + 0.02; m.renderOrder = 1; group.add(m);
  }

  // ---- braziers: iron bowls on legs, burning (one points draw for every flame); every third is a lantern cairn,
  // stacked stones with a lantern on top. Both throw a warm pool of light on the snow (the ground shader's uPools).
  const fl = [], lan = [], bowls = batch();
  const lineD = (x, z) => { let d = Infinity; const Lp = hole.line; for (let i = 0; i < Lp.length - 1; i++) { const [ax, az] = Lp[i], [bx, bz] = Lp[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; };
  ICE.braziers.forEach(([X, Z, y], bi) => { const [x, z] = L(X, Z); if (!near(x, z, far)) return; const g = footY(x, z, LY(y));
    if (bi % 3 === 1) {   // a cairn
      const Rc = rng(bi * 13 + 5); let yy = g - 0.1;
      for (let k = 0; k < 4; k++) { const rr = 0.55 - k * 0.1 + Rc() * 0.08, hh = 0.2 + Rc() * 0.08; blob(Br, x + (Rc() - 0.5) * 0.1, yy + hh, z + (Rc() - 0.5) * 0.1, rr, hh, rr * (0.8 + Rc() * 0.3), lin([66 + Rc() * 20, 68 + Rc() * 20, 76 + Rc() * 20]), lin([226, 232, 242]), 6, 3, Rc() * 6); yy += hh * 1.8; }
      lan.push(x, yy + 0.3, z); pools.push([x, z, 6.5, 1.1, lineD(x, z)]); return;
    }
    for (let s = 0; s < 3; s++) { const t = s / 3 * Math.PI * 2; bowls.quad([x + Math.cos(t) * 0.5, g, z + Math.sin(t) * 0.5], [x + Math.cos(t) * 0.5 + 0.08, g, z + Math.sin(t) * 0.5], [x + Math.cos(t) * 0.25 + 0.08, g + 1.1, z + Math.sin(t) * 0.25], [x + Math.cos(t) * 0.25, g + 1.1, z + Math.sin(t) * 0.25], lin([30, 28, 26])); }
    for (let s = 0; s < 8; s++) { const t = s / 8 * Math.PI * 2, u = (s + 1) / 8 * Math.PI * 2; bowls.quad([x + Math.cos(t) * 0.3, g + 1.05, z + Math.sin(t) * 0.3], [x + Math.cos(u) * 0.3, g + 1.05, z + Math.sin(u) * 0.3], [x + Math.cos(u) * 0.55, g + 1.45, z + Math.sin(u) * 0.55], [x + Math.cos(t) * 0.55, g + 1.45, z + Math.sin(t) * 0.55], lin([40, 36, 32])); }
    fl.push(x, g + 1.9, z); pools.push([x, z, 10, 1.6, lineD(x, z)]); });
  if (lan.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lan, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: TEX.flame, size: 1.1, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); pts.renderOrder = 4; group.add(pts); }
  { const m = bowls.mesh(vc({ roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide })); if (m) group.add(m); }
  if (fl.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(fl, 3));
    const pm = new THREE.PointsMaterial({ map: TEX.flame, size: 2.4, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: night ? 1 : 0.7 });
    const pts = new THREE.Points(g, pm); pts.renderOrder = 4; group.add(pts);
    anims.push((dt, t) => { pm.size = 2.2 + 0.35 * Math.sin(t * 9.1) + 0.2 * Math.sin(t * 23.7); });
  }
  // ---- steam off the warm ground round the greens and the pools: puffs rising and fading, one points draw
  {
    const src = [...ICE.steam.map(([X, Z, y, r]) => { const [x, z] = L(X, Z); return near(x, z, 900) ? [x, z, footY(x, z, LY(y)), r] : null; }).filter(Boolean), ...smoke];
    const per = 5, n = src.length * per, pos = new Float32Array(n * 3), ph = Float32Array.from({ length: n }, () => R());
    if (n) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ map: TEX.steam, size: 7, sizeAttenuation: true, transparent: true, depthWrite: false, opacity: night ? 0.5 : 0.65, color: night ? 0xc8d8f0 : 0xffffff });
      const pts = new THREE.Points(g, pm); pts.frustumCulled = false; pts.renderOrder = 3; group.add(pts);
      const step = t => { for (let i = 0; i < n; i++) { const s = src[Math.floor(i / per)], u = (t * 0.08 + ph[i]) % 1, a = ph[i] * 40; pos[i * 3] = s[0] + Math.cos(a) * s[3] * 0.6 + u * 2.5; pos[i * 3 + 1] = s[2] + 0.5 + u * 9; pos[i * 3 + 2] = s[1] + Math.sin(a) * s[3] * 0.6; } g.attributes.position.needsUpdate = true; };
      step(0); anims.push((dt, t) => step(t));
    }
  }

  // ---- warm oases: moss, grass and dwarf willow round each green and hot pool (one instanced draw each)
  {
    const spots = [], Ro = rng(hi * 71 + 3);
    for (const [wx, wz, wr] of warmSpots(hole, ICE, L)) for (let k = 0; k < (coarse ? 420 : 700); k++) {
      const a = Ro() * Math.PI * 2, d = wr * Math.sqrt(Ro()), x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d, sf = T.surfaceAt(x, z);
      if (sf !== 'rough' && sf !== 'desert') continue;
      if (fbm(x / 6, z / 6) < 0.44 || Ro() > 1.2 - d / wr) continue;   // in the moss patches, thinning outward
      const g = T.groundAt(x, z); if (g === null) continue; spots.push([x, g, z, Ro()]);
    }
    const tuftG = new THREE.ConeGeometry(0.12, 0.38, 4, 1).translate(0, 0.16, 0), bushG = new THREE.IcosahedronGeometry(0.42, 0).scale(1, 0.55, 1).translate(0, 0.08, 0);
    const tufts = spots.filter(s => s[3] < 0.62), bushes = spots.filter(s => s[3] >= 0.62);
    const mk = (geo, list, cols, sc) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cc = new THREE.Color();
      list.forEach(([x, y, z, u], i) => { const s2 = sc[0] + u * sc[1]; q.setFromEuler(e.set(0, u * 40, 0)); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s2 * (1 + u), s2 * (0.5 + u * 0.5), s2)); im.setMatrixAt(i, m4); im.setColorAt(i, cc.set(cols[Math.floor(u * 97) % cols.length])); });
      im.receiveShadow = true; group.add(im); };
    mk(tuftG, tufts, [0x7d8a46, 0x9a8f56, 0xa08a50, 0x6c7e3e], [0.7, 0.8]);
    mk(bushG, bushes, [0x56703a, 0x6f7a3e, 0x7a6038, 0x4f6a36], [0.45, 0.6]);   // dwarf willow: low domes, olive to rust
  }

  // ---- a runestone by the back tee and one near the green: grey stone, a red serpent band carved on its face
  {
    const L0 = hole.line, d0 = [L0[1][0] - L0[0][0], L0[1][1] - L0[0][1]], dl = Math.hypot(...d0), u0 = [d0[0] / dl, d0[1] / dl], tee = Object.values(hole.tees)[0];
    const spots = [[tee[0] - u0[1] * 17 - u0[0] * 4, tee[1] + u0[0] * 17 - u0[1] * 4, Math.atan2(u0[1], u0[0])], [hole.pin[0] + 26, hole.pin[1] + 14, 0.4]];
    for (const [x0, z0, yaw] of spots) {
      let x = x0, z = z0; for (let k = 0; k < 8 && !['rough', 'desert'].includes(T.surfaceAt(x, z)); k++) { x += 4; z += 3; }
      const g = T.groundAt(x, z); if (g === null) continue;
      const c = Math.cos(yaw), s2 = Math.sin(yaw), at = (u, y, v = 0) => [x + u * c - v * s2, g + y, z + u * s2 + v * c], stone = lin([104, 106, 112]);
      const prof = [[-0.6, 0], [0.6, 0], [0.62, 1.7], [0.42, 2.25], [0, 2.4], [-0.45, 2.2], [-0.62, 1.6]];
      for (const v of [-0.18, 0.18]) for (let i = 1; i < prof.length - 1; i++) Br.tri(at(prof[0][0], prof[0][1], v), at(prof[i][0], prof[i][1], v), at(prof[i + 1][0], prof[i + 1][1], v), stone);
      for (let i = 0; i < prof.length; i++) { const a2 = prof[i], b2 = prof[(i + 1) % prof.length]; Br.quad(at(a2[0], a2[1], -0.18), at(b2[0], b2[1], -0.18), at(b2[0], b2[1], 0.18), at(a2[0], a2[1], 0.18), stone.map(q => q * 0.85)); }
      const red = lin([150, 46, 36]); let prev = null;   // the serpent: a band up one side, over the top and down the other
      for (let t = 0; t <= 1.0001; t += 0.05) { const th = Math.PI * t, px = -Math.cos(th) * 0.45, py = 0.25 + Math.sin(th) * 1.75 + (t < 0.15 || t > 0.85 ? 0 : 0); const cur = [px, py];
        if (prev) Br.quad(at(prev[0] - 0.05, prev[1], -0.19), at(cur[0] - 0.05, cur[1], -0.19), at(cur[0] + 0.05, cur[1] - 0.04, -0.19), at(prev[0] + 0.05, prev[1] - 0.04, -0.19), red); prev = cur; }
    }
  }

  // ---- life: an arctic fox or two, a raven pair wheeling overhead, a reindeer herd far off (scenery only, off the lines)
  const Ba = batch();
  {
    const Ra = rng(hi * 17 + 11), Lp = hole.line, len = Lp.slice(1).reduce((a2, p, i) => a2 + Math.hypot(p[0] - Lp[i][0], p[1] - Lp[i][1]), 0);
    const along = (sA, off) => { let acc = 0; for (let i = 1; i < Lp.length; i++) { const [ax, az] = Lp[i - 1], [bx, bz] = Lp[i], l = Math.hypot(bx - ax, bz - az); if (acc + l >= sA || i === Lp.length - 1) { const t = Math.min(1, (sA - acc) / l), dx = (bx - ax) / l, dz = (bz - az) / l; return [ax + (bx - ax) * t - dz * off, az + (bz - az) * t + dx * off, Math.atan2(dz, dx)]; } acc += l; } };
    const free = (x, z) => { const sf = T.surfaceAt(x, z); return (sf === 'desert' || sf === 'rough') && T.groundAt(x, z) !== null && lineD(x, z) > 38; };
    const fur = lin([214, 218, 224]), furD = lin([160, 160, 166]), dark = lin([30, 30, 34]);
    for (let f = 0; f < 2; f++) for (let tries = 0; tries < 30; tries++) {
      const [x, z, yaw] = along(len * (0.25 + Ra() * 0.6), (Ra() < 0.5 ? -1 : 1) * (42 + Ra() * 30)); if (!free(x, z)) continue;
      const g = T.groundAt(x, z), yw = yaw + Ra() * 6, c = Math.cos(yw), s2 = Math.sin(yw), P = (u, y, v = 0) => [x + u * c - v * s2, g + y, z + u * s2 + v * c];
      blob(Ba, ...P(0, 0.3), 0.36, 0.17, 0.15, fur, null, 7, 4, yw); blob(Ba, ...P(0.38, 0.42), 0.13, 0.12, 0.11, fur, null, 6, 3, yw);
      blob(Ba, ...P(0.52, 0.4), 0.09, 0.05, 0.05, furD, null, 5, 3, yw); blob(Ba, ...P(-0.48, 0.32), 0.26, 0.09, 0.09, fur, null, 6, 3, yw + 0.3);
      for (const [lu, lv] of [[0.22, 0.08], [0.22, -0.08], [-0.22, 0.08], [-0.22, -0.08]]) slab(Ba, P(lu, 0.0, lv), P(lu, 0.22, lv), 0.05, 0.05, furD);
      for (const lv of [0.05, -0.05]) Ba.tri(P(0.38, 0.52, lv - 0.03), P(0.38, 0.52, lv + 0.03), P(0.36, 0.62, lv), dark);
      break;
    }
    // the herd: eight reindeer grazing 250-450 m off the line
    const [hx, hz] = along(len * (0.3 + Ra() * 0.4), (Ra() < 0.5 ? -1 : 1) * (260 + Ra() * 160));
    const hide = lin([96, 84, 72]), pale = lin([200, 196, 186]), antl = lin([170, 150, 120]);
    for (let k = 0; k < 8; k++) {
      const x = hx + (Ra() - 0.5) * 50, z = hz + (Ra() - 0.5) * 50, g = T.groundAt(x, z) ?? footY(x, z, null); if (g === null || g === undefined) continue;
      const yw = Ra() * 6, graze = Ra() < 0.5, c = Math.cos(yw), s2 = Math.sin(yw), P = (u, y, v = 0) => [x + u * c - v * s2, g + y, z + u * s2 + v * c];
      blob(Ba, ...P(0, 1.05), 0.85, 0.42, 0.34, hide, null, 7, 4, yw); blob(Ba, ...P(-0.2, 0.92), 0.6, 0.3, 0.3, pale, null, 6, 3, yw);
      const hd = graze ? P(1.0, 0.45) : P(1.0, 1.55); slab(Ba, P(0.7, 1.2), hd, 0.26, 0.3, hide); blob(Ba, ...hd, 0.24, 0.13, 0.12, hide, null, 6, 3, yw);
      for (const [lu, lv] of [[0.55, 0.18], [0.55, -0.18], [-0.55, 0.18], [-0.55, -0.18]]) slab(Ba, P(lu, 0, lv), P(lu, 0.85, lv), 0.09, 0.09, hide);
      if (!graze) for (const lv of [0.1, -0.1]) { slab(Ba, [hd[0], hd[1] + 0.1, hd[2]], P(0.85, 2.3, lv * 4), 0.05, 0.05, antl); slab(Ba, P(0.95, 1.9, lv * 2.5), P(1.25, 2.1, lv * 3), 0.04, 0.04, antl); }
    }
    const m = Ba.mesh(vc({ roughness: 1 }), true); if (m) group.add(m);
    // ravens: two black birds wheeling high over the hole
    const bird = new THREE.BufferGeometry(); bird.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.35, 0.08, 0, 0.2, -0.08, 0, 0.2, 0, 0, -0.05, 0.6, 0.05, 0.1, 0, 0, 0.18, 0, 0, -0.05, 0, 0, 0.18, -0.6, 0.05, 0.1], 3)); bird.computeVertexNormals();
    const bm = new THREE.MeshBasicMaterial({ color: 0x0c0d10, side: THREE.DoubleSide });
    const rav = [0, 1].map(i => { const b = new THREE.Mesh(bird, bm); b.scale.setScalar(1.6); group.add(b); return { b, r: 45 + i * 12, ph: i * 2.1, y: 38 + i * 6 }; });
    const [rx0, rz0] = along(len * 0.55, 0);
    anims.push((dt, t) => { for (const v of rav) { const a2 = t * 0.18 + v.ph; v.b.position.set(rx0 + Math.cos(a2) * v.r, (T.groundAt(rx0, rz0) ?? 0) + v.y + Math.sin(t * 0.7 + v.ph) * 2, rz0 + Math.sin(a2) * v.r); v.b.rotation.set(0, -a2, 0.35); v.b.scale.y = 1.6 * (0.6 + 0.4 * Math.sin(t * 6 + v.ph)); } });
  }

  // ---- spindrift: low snow streaming across the ice in the wind
  {
    const n = coarse ? 140 : 260, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: TEX.streak, transparent: true, depthWrite: false, color: night ? 0xb8c8e8 : 0xffffff, opacity: 0.42, side: THREE.DoubleSide }), n);
    const Rs = rng(hi * 5 + 1), st2 = Array.from({ length: n }, () => ({ x: box.x0 + Rs() * (box.x1 - box.x0), z: box.z0 + Rs() * (box.z1 - box.z0), h: 0.12 + Rs() * Rs() * 1.1, l: 4 + Rs() * 6, w: 0.5 + Rs() * 0.9, v: 0.7 + Rs() * 0.6 }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    im.frustumCulled = false; im.renderOrder = 3; group.add(im);
    const step = (dt, wv) => { const wl = Math.hypot(wv?.x || 0, wv?.z || 0) || 1, dx = (wv?.x || 0.6) / wl, dz = (wv?.z || 0.8) / wl, sp = 1.5 + (wv?.mph || 6) * 0.35, yaw = Math.atan2(dz, dx);
      st2.forEach((S, i) => { S.x += dx * sp * S.v * dt; S.z += dz * sp * S.v * dt;
        if (S.x < box.x0) S.x += box.x1 - box.x0; if (S.x > box.x1) S.x -= box.x1 - box.x0; if (S.z < box.z0) S.z += box.z1 - box.z0; if (S.z > box.z1) S.z -= box.z1 - box.z0;
        const g = T.groundAt(S.x, S.z); m4.compose(pv.set(S.x, (g ?? -999) + S.h, S.z), q.setFromEuler(e.set(0, -yaw, 0)), sv.set(S.l, 1, S.w)); im.setMatrixAt(i, m4); });
      im.instanceMatrix.needsUpdate = true; };
    step(0, null); anims.push((dt, t, wv) => step(Math.min(dt, 0.1), wv));
  }

  for (const [B, mat] of [[Bi, iceMat], [Bs, snowMat], [Br, stoneMat], [Bw, vc({ roughness: 0.85, emissive: 0x2a1c10 })]]) { const m = B.mesh(mat); if (m) group.add(m); }   // (the wreck's timber catches a little warm light from below)
  if (night) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(11000, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vD; void main(){ float h = clamp(vD.y, -0.1, 1.0); vec3 c = mix(vec3(0.035,0.055,0.1), vec3(0.008,0.014,0.04), smoothstep(0.0, 0.5, h)); c = mix(c, vec3(0.05,0.12,0.12), smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.25, 0.6, h)) * 0.35); gl_FragColor = vec4(c, 1.0);
        #include <encodings_fragment>
      }` }));
    dome.position.set(cx, 0, cz); dome.renderOrder = -3; dome.frustumCulled = false; group.add(dome);
    anims.push(aurora(group, cx, cz, LY(F.base) + 200, hi === 8 ? 1.45 : 1));   // brightest over the 9th
    // the moon, where the night's light comes from, with a soft halo
    if (sunDir) for (const [map, sz] of [[TEX.halo, 2600], [TEX.moon, 380]]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, fog: false, depthWrite: false, transparent: true, toneMapped: false }));
      sp.scale.set(sz, sz, 1); sp.position.set(cx + sunDir.x * 9000, sunDir.y * 9000, cz + sunDir.z * 9000); sp.renderOrder = -2; group.add(sp); }
  }
  pools.sort((a2, b2) => a2[4] - b2[4]);
  return { trees, anims, pools: pools.map(q => q.slice(0, 4)) };
}
