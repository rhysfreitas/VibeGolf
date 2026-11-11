// Emberfell's mountain (global THREE): what COURSE.volc holds (world space) put into a hole's frame (hole.frame)
// and drawn. The far mountain from its height map out to a skirt falling to the sea, the lava (the lake, the
// rivers and pools, here from the field and far off from the map) as one glowing, crusted surface, the lava
// tube's trench walls and its dark mouths, basalt blocks, columns and lava trees, the clubhouse, steam off the
// fumaroles, the vents, the geysers, the lavafall down the caldera wall and the ash plume over the far vent,
// lit from below with lightning in it. One merged mesh per material where it can be. The ball's side (boulders,
// lava trees, the clubhouse, the ohia) is in the course module and terrain.js. Blockout: the art pass comes next.
import { rng, fbm } from './noise.js';

const lin = c => c.map(v => Math.pow(v / 255, 2.2));
const dec = (b64, T) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
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
// the paint byte (tools/emberfell/emit.mjs MAT): 1 flow, 2 cinder, 3 ash, 4 rock, 5 rubble, 6 forest, 7 sulfur,
// 8 crust, 9 sinter, 10 the hall's floor, 11 lava (the far map adds 12 open air, 13 mown, 14 rough)
function matAt(hole, x, z) {
  const F = hole.field; if (!F) return 0;
  if (!F.mDec) F.mDec = typeof F.m === 'string' ? dec(F.m, Uint8Array) : new Uint8Array(F.nx * F.nz);
  const i = Math.round((x - F.x0) / F.cell), j = Math.round((z - F.z0) / F.cell);
  if (i < 0 || j < 0 || i >= F.nx || j >= F.nz) return 0;
  return F.mDec[j * F.nx + i];
}
// metres to the nearest lava cell in the field (up to 24), a chamfer pass over the grid, once per hole
function lavaNear(F) {
  if (F.lavaD) return F.lavaD;
  const n = F.nx * F.nz, D = new Float32Array(n).fill(99), cw = F.codes.indexOf('water');
  for (let k = 0; k < n; k++) if (F.s[k] === cw) D[k] = 0;
  const c = F.cell, d2 = c * Math.SQRT2;
  for (let pass = 0; pass < 2; pass++) {
    const fw = pass === 0;
    for (let jj = 0; jj < F.nz; jj++) { const j = fw ? jj : F.nz - 1 - jj;
      for (let ii = 0; ii < F.nx; ii++) { const i = fw ? ii : F.nx - 1 - ii, k = j * F.nx + i; let v = D[k]; if (v === 0) continue;
        const s = fw ? -1 : 1;
        if (i + s >= 0 && i + s < F.nx) v = Math.min(v, D[k + s] + c);
        if (j + s >= 0 && j + s < F.nz) { const k2 = k + s * F.nx; v = Math.min(v, D[k2] + c); if (i + s >= 0 && i + s < F.nx) v = Math.min(v, D[k2 + s] + d2); if (i - s >= 0 && i - s < F.nx) v = Math.min(v, D[k2 - s] + d2); }
        D[k] = v; } }
  }
  return (F.lavaD = D);
}

/* ---------- the paint: two textures the ground shader reads (main.js, VOLC) ---------- */
// A: R mown (fairway, tee), G grass (green 1, its collar 0.5), B ash-grey sand, A grass length (rough 0.55; native 0)
// B: R red cinder (scoria waste 1, native cinder 0.7), G grey ash (rubble 0.5), B glow (crust seams 1, the lava's
//    light on its shores 0..0.5), A sulfur (1) or sinter (0.5)
export function surfaceTextures(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const a = new Uint8Array(W * H * 4), b = new Uint8Array(W * H * 4);
  const Fd = hole.field, LD = Fd && Fd.ready ? lavaNear(Fd) : null;
  const ldAt = (x, z) => { if (!LD) return 99; const fx = Math.max(0, Math.min(Fd.nx - 1.001, (x - Fd.x0) / Fd.cell)), fz = Math.max(0, Math.min(Fd.nz - 1.001, (z - Fd.z0) / Fd.cell)), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * Fd.nx + i;
    return (LD[k] * (1 - u) + LD[k + 1] * u) * (1 - v) + (LD[k + Fd.nx] * (1 - u) + LD[k + Fd.nx + 1] * u) * v; };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4, native = s === 'desert' || s === 'rough' || s === 'firstcut';
    const m = native ? matAt(hole, x, z) : 0;
    a[o] = s === 'fairway' || s === 'tee' ? 255 : 0;
    a[o + 1] = s === 'green' ? 255 : s === 'fringe' ? 128 : 0;
    a[o + 2] = s === 'sand' ? 255 : 0;
    a[o + 3] = s === 'desert' || s === 'void' || s === 'water' || s === 'waste' ? 0 : s === 'rough' ? (m === 6 ? 110 : 140) : 255;
    b[o] = s === 'waste' ? 255 : m === 2 ? 180 : 0;
    b[o + 1] = m === 3 ? 255 : m === 5 || m === 10 ? 128 : 0;
    const ld = s === 'water' ? 0 : ldAt(x, z);
    b[o + 2] = m === 8 ? 255 : ld < 22 ? Math.round(128 * Math.pow(1 - ld / 22, 1.6)) : 0;
    b[o + 3] = m === 7 ? 255 : m === 9 ? 128 : 0;
  }
  const tex = d => { const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; };
  return [tex(a), tex(b)];
}
// the corner map, painted from the surfaces
export function mapPaint(T, hole) {
  const C = { desert: '#2a2726', rough: '#4f6a34', firstcut: '#5a7a3a', fairway: '#6f9a45', fringe: '#7db052', green: '#8fc565', tee: '#86b85e', sand: '#9b968d', waste: '#8a3a22', water: '#ff6a1a', void: '#050404' };
  const M = { 2: '#5e2a1c', 3: '#77716a', 4: '#1c1a1a', 5: '#4a4542', 6: '#2f4422', 7: '#b8a83a', 8: '#151212', 9: '#d8d2c2' };
  return (x, z) => { const s = T.surfaceAt(x, z); if (s === 'desert') { const m = matAt(hole, x, z); if (M[m]) return M[m]; } return C[s] || '#2a2726'; };
}

/* ---------- the lava: a crust of dark plates over glowing melt, the seams creeping ---------- */
let lavaMat = null;
const lavaU = { uT: { value: 0 } };
function makeLavaMat() {
  return new THREE.ShaderMaterial({
    fog: true, side: THREE.DoubleSide, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 } }]),
    vertexShader: `varying vec3 vW; attribute float aHot; varying float vHot;
#include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vHot = aHot; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW; varying float vHot; uniform float uT;
#include <fog_pars_fragment>
      float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
      float fb(vec2 p){ return vn(p)*0.5 + vn(p*2.07+3.1)*0.25 + vn(p*4.13+7.7)*0.125 + vn(p*8.4+1.3)*0.0625; }
      // distance to the nearest seam between crust plates (cellular)
      float seam(vec2 q){ vec2 ci = floor(q), cf = fract(q); float c1 = 8.0, c2 = 8.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(float(i), float(j)), o = vec2(h21(ci + g), h21(ci + g + 17.0)); o = 0.5 + 0.4*sin(uT*0.05 + 6.2831*o); float d = length(g + o - cf); if (d < c1) { c2 = c1; c1 = d; } else if (d < c2) c2 = d; }
        return c2 - c1; }
      void main(){
        vec2 p = vW.xz;
        float melt = smoothstep(0.35, 0.75, fb(p*0.012 + vec2(uT*0.002, 0.0))) * 0.7 + vHot*0.5;     // open, molten patches
        float s = seam(p*0.16 + vec2(fb(p*0.05)*1.5)), s2 = seam(p*0.55 + 9.0);
        float glow = (1.0 - smoothstep(0.0, 0.12 + 0.25*melt, s)) + 0.5*(1.0 - smoothstep(0.0, 0.08, s2)) * melt;
        glow = clamp(glow + melt*0.55, 0.0, 1.0) * (0.75 + 0.25*sin(uT*0.7 + fb(p*0.03)*12.0));
        vec3 crust = mix(vec3(0.022,0.016,0.014), vec3(0.07,0.035,0.025), fb(p*0.3));
        vec3 hot = mix(vec3(0.9,0.12,0.02), vec3(2.6,0.9,0.18), smoothstep(0.55, 1.0, glow));
        gl_FragColor = vec4(mix(crust, hot, smoothstep(0.08, 0.7, glow)), 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        #include <fog_fragment>
      }`,
  });
}
// a lava surface from quads [x0, z0, x1, z1, y, hot]
function lavaMesh(cells) {
  if (!cells.length) return null;
  const pos = new Float32Array(cells.length * 18), hot = new Float32Array(cells.length * 6);
  cells.forEach(([x0, z0, x1, z1, y, h], k) => { pos.set([x0, y, z0, x0, y, z1, x1, y, z0, x1, y, z0, x0, y, z1, x1, y, z1], k * 18); hot.fill(h, k * 6, k * 6 + 6); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aHot', new THREE.BufferAttribute(hot, 1));
  const m = new THREE.Mesh(g, lavaMat); m.receiveShadow = false; return m;
}

/* ---------- textures made once ---------- */
let TEX = null;
function makeTextures() {
  const glow = stops => { const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); for (const [t, c] of stops) gr.addColorStop(t, c); g.fillStyle = gr; g.fillRect(0, 0, S, S); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; };
  const puff = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), R = rng(9);
    for (let i = 0; i < 22; i++) { const x = 64 + (R() - 0.5) * 60, y = 64 + (R() - 0.5) * 50, r = 14 + R() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  return {
    glow: glow([[0, 'rgba(255,220,150,1)'], [0.2, 'rgba(255,130,40,0.75)'], [0.55, 'rgba(200,50,10,0.25)'], [1, 'rgba(90,10,0,0)']]),
    steam: glow([[0, 'rgba(255,255,255,0.5)'], [0.5, 'rgba(236,232,228,0.22)'], [1, 'rgba(236,232,228,0)']]),
    flash: glow([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(220,210,255,0.6)'], [1, 'rgba(160,140,220,0)']]),
    puff,
  };
}

export function buildVolcano(hole, T, box, VOLC, hi, { group, coarse }) {
  if (!TEX) TEX = makeTextures();
  if (!lavaMat) { lavaMat = makeLavaMat(); lavaU.uT = lavaMat.uniforms.uT; }
  const F = hole.frame, a = F.heading * Math.PI / 180, fx = Math.sin(a), fz = -Math.cos(a), rx = Math.cos(a), rz = Math.sin(a);
  const L = (X, Z) => { const dx = X - F.x, dz = Z - F.z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };
  const LY = y => y - F.base;
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, near = (x, z, d) => Math.hypot(x - cx, z - cz) < d;
  const Fd = hole.field, inField = (x, z) => Fd && x > Fd.x0 && z > Fd.z0 && x < Fd.x0 + (Fd.nx - 1) * Fd.cell && z < Fd.z0 + (Fd.nz - 1) * Fd.cell;
  const footY = (x, z, y) => { if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) return g; } return y; };
  const trees = [], anims = [];
  const far = coarse ? 1600 : 2400;
  const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  const Br = batch();   // basalt: walls, the clubhouse, mouths
  const shrink = 6, inPlay = (x, z) => x > box.x0 + shrink && x < box.x1 - shrink && z > box.z0 + shrink && z < box.z1 - shrink;

  // ---- the far mountain from the height map (this hole's field where it has one, so the edges meet the playfield)
  const WM = VOLC.world; if (!WM.hDec) { WM.hDec = dec(WM.h, Int16Array); WM.mDec = dec(WM.m, Uint8Array); }
  const wnx = WM.nx, wnz = WM.nz, wH = (i, j) => WM.hDec[j * wnx + i] / WM.scale + WM.y0;
  const mapY = (X, Z) => { const fx2 = Math.max(0, Math.min(wnx - 1.001, (X - WM.x0) / WM.cell)), fz2 = Math.max(0, Math.min(wnz - 1.001, (Z - WM.z0) / WM.cell)), i = Math.floor(fx2), j = Math.floor(fz2), u = fx2 - i, v = fz2 - j;
    return (wH(i, j) * (1 - u) + wH(i + 1, j) * u) * (1 - v) + (wH(i, j + 1) * (1 - u) + wH(i + 1, j + 1) * u) * v; };
  const RC = VOLC.rim.c, RIM = 2300;   // the map is drawn out to RIM from the caldera's centre, then the skirt
  const cols = { 0: lin([28, 25, 24]), 1: lin([22, 20, 20]), 2: lin([92, 40, 26]), 3: lin([96, 90, 84]), 4: lin([36, 33, 32]), 5: lin([66, 60, 56]), 6: lin([30, 44, 22]), 7: lin([170, 150, 60]), 8: lin([16, 14, 14]), 9: lin([200, 194, 180]), 10: lin([50, 48, 46]), 11: lin([40, 14, 6]), 12: lin([6, 5, 5]), 13: lin([70, 104, 46]), 14: lin([52, 72, 34]) };
  const lavaFar = [];
  {
    const st = coarse ? 3 : 2, ni = Math.floor((wnx - 1) / st), nj = Math.floor((wnz - 1) / st), Vv = new Float32Array((ni + 1) * (nj + 1) * 3), C = new Float32Array((ni + 1) * (nj + 1) * 3), keep = new Uint8Array((ni + 1) * (nj + 1)), lavaV = new Uint8Array((ni + 1) * (nj + 1));
    for (let j = 0; j <= nj; j++) for (let i = 0; i <= ni; i++) {
      const I = i * st, J = j * st, X = WM.x0 + I * WM.cell, Z = WM.z0 + J * WM.cell, [x, z] = L(X, Z), k = j * (ni + 1) + i;
      let y = LY(wH(I, J)), m = WM.mDec[J * wnx + I];
      if (m === 11) { lavaV[k] = 1; y -= 1.5; }
      if (inField(x, z)) { const g = T.groundAt(x, z); if (g !== null) { y = g; if (m === 12) m = 4; } }
      const c = cols[m] || cols[0], sh = 0.9 + 0.16 * fbm(X / 90, Z / 90);
      Vv.set([x, y - 0.5, z], k * 3); C.set([c[0] * sh, c[1] * sh, c[2] * sh], k * 3);
      keep[k] = near(x, z, 5200) && Math.hypot(X - RC[0], Z - RC[1]) < RIM + st * WM.cell ? 1 : 0;
    }
    const idx = [];
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const k = j * (ni + 1) + i, k1 = k + 1, k2 = k + ni + 1, k3 = k2 + 1;
      if (!keep[k] || !keep[k3] || !keep[k1] || !keep[k2]) continue;
      const xs = [Vv[k * 3], Vv[k1 * 3], Vv[k2 * 3], Vv[k3 * 3]], zs = [Vv[k * 3 + 2], Vv[k1 * 3 + 2], Vv[k2 * 3 + 2], Vv[k3 * 3 + 2]];
      if (xs.every((x, q) => inPlay(x, zs[q]))) continue;   // under the playfield: left out
      idx.push(k, k2, k1, k1, k2, k3);
      // lava far off: a quad over each cell that's lava (the level is the map's height there)
      if (lavaV[k] && lavaV[k3] && !xs.some((x, q) => inField(x, zs[q]))) { const I = i * st, J = j * st, X0 = WM.x0 + I * WM.cell, Z0 = WM.z0 + J * WM.cell, d = st * WM.cell;
        const P0 = L(X0, Z0), y = LY(wH(I, J)); lavaFar.push([X0, Z0, X0 + d, Z0 + d, y]); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(Vv, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(idx); g.computeVertexNormals();
    // steep faces go to wall rock, darkening with height: the caldera wall and the cone
    const N = g.attributes.normal;
    for (let k = 0; k < N.count; k++) { const ny = N.getY(k); if (ny < 0.75 && !lavaV[k]) { const t = Math.min(1, (0.75 - ny) / 0.3), cc = C.subarray(k * 3, k * 3 + 3), rk = lin([44 + 14 * fbm(Vv[k * 3] / 30, Vv[k * 3 + 1] / 18), 38, 36]); cc[0] += (rk[0] - cc[0]) * t; cc[1] += (rk[1] - cc[1]) * t; cc[2] += (rk[2] - cc[2]) * t; } }
    const m = new THREE.Mesh(g, vc()); m.receiveShadow = true; group.add(m);
  }
  // ---- the skirt: the mountain's lower slopes falling away to the sea, and the sea
  {
    const Bp = batch(), n = 128, rings = [RIM - 20, 2700, 3400, 4300, 5500, 7000, 9000, 12000, 16000];
    const Y = (r, y0) => r <= RIM ? y0 : y0 * Math.pow(1 - Math.min(1, (r - RIM) / (10500 - RIM)), 1.6) - (r > 10500 ? (r - 10500) * 0.02 : 0);
    const ring0 = Array.from({ length: n }, (_, s) => { const th = s / n * Math.PI * 2, X = RC[0] + Math.sin(th) * (RIM - 20), Z = RC[1] - Math.cos(th) * (RIM - 20); return mapY(X, Z) - 2; });
    for (let r = 0; r < rings.length - 1; r++) for (let s = 0; s < n; s++) {
      const P = (ri, si) => { const th = (si % n) / n * Math.PI * 2, R0 = rings[ri], X = RC[0] + Math.sin(th) * R0, Z = RC[1] - Math.cos(th) * R0, [x, z] = L(X, Z); return [x, LY(Y(R0, ring0[si % n])), z]; };
      const t = rings[r] / 16000, k = lin([30 - 8 * t, 27 - 6 * t, 26 - 4 * t]).map(v => v * (0.9 + 0.2 * fbm(s * 0.7, r * 1.3)));
      Bp.quad(P(r, s), P(r + 1, s), P(r + 1, s + 1), P(r, s + 1), k);
    }
    const m = Bp.mesh(vc({ roughness: 1, side: THREE.DoubleSide }), false); if (m) group.add(m);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.25, metalness: 0.1 }));
    const [sx, sz] = L(RC[0], RC[1]); sea.position.set(sx, LY(-2), sz); group.add(sea);
  }

  // ---- the lava: the field's lava cells near the play (a little wider than the cell: the banks hide the edge),
  // the map's further off
  {
    const cells = [], cw = Fd ? Fd.codes.indexOf('water') : -1;
    if (Fd && Fd.ready) for (let j = 0; j < Fd.nz; j++) for (let i = 0; i < Fd.nx; i++) { const k = j * Fd.nx + i; if (Fd.s[k] !== cw || Number.isNaN(Fd.h[k])) continue;
      const x = Fd.x0 + i * Fd.cell, z = Fd.z0 + j * Fd.cell, e = Fd.cell * 0.85; cells.push([x - e, z - e, x + e, z + e, Fd.h[k] + 0.8, 0]); }
    const m1 = lavaMesh(cells); if (m1) group.add(m1);
    // far lava in world space, turned into the frame
    const far2 = lavaFar.map(([X0, Z0, X1, Z1, y]) => [X0, Z0, X1, Z1, y]);
    if (far2.length) {
      const pos = new Float32Array(far2.length * 18), hot = new Float32Array(far2.length * 6);
      far2.forEach(([X0, Z0, X1, Z1, y], k) => { const p = [L(X0, Z0), L(X0, Z1), L(X1, Z0), L(X1, Z1)]; pos.set([p[0][0], y, p[0][1], p[1][0], y, p[1][1], p[2][0], y, p[2][1], p[2][0], y, p[2][1], p[1][0], y, p[1][1], p[3][0], y, p[3][1]], k * 18); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aHot', new THREE.BufferAttribute(hot, 1));
      group.add(new THREE.Mesh(g, lavaMat));
    }
    anims.push((dt, t) => { lavaU.uT.value = t; });
  }

  // ---- the lava tube's trench and skylights: sheer basalt walls down from the field's open air, black below
  if (Fd && Fd.ready) {
    const top = lin([46, 42, 40]), mid = lin([24, 22, 21]), deep = lin([4, 4, 4]);
    for (let j = 0; j < Fd.nz - 1; j++) for (let i = 0; i < Fd.nx - 1; i++) {
      const k = j * Fd.nx + i, v = Fd.h[k];
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const w = Fd.h[k + di + dj * Fd.nx], va = Number.isNaN(v), wa = Number.isNaN(w); if (va === wa) continue;
        const g = va ? w : v, x = Fd.x0 + (i + di * 0.5) * Fd.cell, z = Fd.z0 + (j + dj * 0.5) * Fd.cell, h2 = Fd.cell * 0.55;
        const p = dj ? [[x - h2, z], [x + h2, z]] : [[x, z - h2], [x, z + h2]], jg = (fbm(x / 5, z / 5) - 0.5) * 1.2;
        for (const [A, Bq] of [[p[0], p[1]], [p[1], p[0]]]) {
          Br.quad([A[0], g + 0.2, A[1]], [Bq[0], g + 0.2, Bq[1]], [Bq[0], g - 4 + jg, Bq[1]], [A[0], g - 4 + jg, A[1]], top);
          Br.quad([A[0], g - 4 + jg, A[1]], [Bq[0], g - 4 + jg, Bq[1]], [Bq[0], g - 12, Bq[1]], [A[0], g - 12, A[1]], mid);
          Br.quad([A[0], g - 12, A[1]], [Bq[0], g - 12, Bq[1]], [Bq[0], g - 40, Bq[1]], [A[0], g - 40, A[1]], deep);
        }
      }
    }
  }
  // the tube's mouths: the dark arch under the roof that still stands at each end of the trench
  for (const M of VOLC.mouths) { const [x, z] = L(M.x, M.z); if (!near(x, z, far)) continue;
    const d = M.dir - a, ux = Math.cos(d), uz = Math.sin(d), r = M.w * 0.42, y0 = LY(M.y) - M.depth * 0.95, n = 10;
    for (let s = 0; s < n; s++) { const t0 = s / n * Math.PI, t1 = (s + 1) / n * Math.PI, A = [x + ux * Math.cos(t0) * r, y0 + Math.sin(t0) * r * 1.1, z + uz * Math.cos(t0) * r], Bq = [x + ux * Math.cos(t1) * r, y0 + Math.sin(t1) * r * 1.1, z + uz * Math.cos(t1) * r];
      Br.tri([x, y0, z], A, Bq, lin([3, 3, 3])); Br.tri([x, y0, z], Bq, A, lin([3, 3, 3])); } }

  // ---- basalt blocks (the ball's boulders) and lava trees, from this hole's rocks; columns and far blocks
  {
    const geo = new THREE.DodecahedronGeometry(1, 1), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + 3, p.getZ(i) * 2 + p.getY(i)) - 0.5) * 0.5; const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.75); p.setXYZ(i, sq(p.getX(i)) * n, sq(p.getY(i)) * n, sq(p.getZ(i)) * n); }
    geo.computeVertexNormals();
    const rocks = T.rocks.filter(R => R.type === 'boulder');
    const far3 = VOLC.boulders.map(([X, Z, y, r, H]) => { const [x, z] = L(X, Z); return !inField(x, z) && near(x, z, far * 0.7) ? { x, z, y: LY(y), r, H } : null; }).filter(Boolean);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), rocks.length + far3.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    let k = 0;
    for (const R of rocks) { m4.compose(new THREE.Vector3(R.x, R.y + R.cy, R.z), q.setFromEuler(e.set(0, -(R.rot || 0), 0)), new THREE.Vector3(R.a, R.hc, R.b)); im.setMatrixAt(k, m4); c.setRGB(...lin([34 + (k * 37) % 14, 31 + (k * 37) % 12, 30 + (k * 37) % 10])); im.setColorAt(k++, c); }
    for (const R of far3) { m4.compose(new THREE.Vector3(R.x, R.y + R.H * 0.4, R.z), q.setFromEuler(e.set(0, (R.x * 0.37) % 6.28, 0)), new THREE.Vector3(R.r, R.H * 0.5, R.r * 0.85)); im.setMatrixAt(k, m4); c.setRGB(...lin([34, 31, 30])); im.setColorAt(k++, c); }
    im.castShadow = im.receiveShadow = true; if (k) group.add(im);
    const lt = T.rocks.filter(R => R.type === 'hoodoo'), cyl = new THREE.CylinderGeometry(0.55, 1, 1, 8, 3, true); cyl.translate(0, 0.5, 0);
    { const pp = cyl.attributes.position; for (let i = 0; i < pp.count; i++) { const n = 1 + (fbm(pp.getX(i) * 3 + pp.getY(i) * 2, pp.getZ(i) * 3) - 0.5) * 0.45; pp.setX(i, pp.getX(i) * n); pp.setZ(i, pp.getZ(i) * n); } cyl.computeVertexNormals(); }
    if (lt.length) { const il = new THREE.InstancedMesh(cyl, new THREE.MeshStandardMaterial({ color: 0x2a2523, roughness: 0.97, side: THREE.DoubleSide }), lt.length);
      lt.forEach((R, i) => { m4.compose(new THREE.Vector3(R.x, R.y, R.z), q.setFromEuler(e.set(0, R.seed || i, 0)), new THREE.Vector3(R.r, R.h + 0.5, R.r)); il.setMatrixAt(i, m4); }); il.castShadow = il.receiveShadow = true; group.add(il); }
    const colsL = VOLC.columns.map(([X, Z, b, t, r, s]) => { const [x, z] = L(X, Z); return near(x, z, far * 0.6) ? [x, z, LY(b), LY(t), r, s] : null; }).filter(Boolean);
    if (colsL.length) { const hex = new THREE.CylinderGeometry(1, 1, 1, 6); hex.translate(0, 0.5, 0);
      const ic = new THREE.InstancedMesh(hex, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), colsL.length);
      colsL.forEach(([x, z, b, t, r, s], i) => { m4.compose(new THREE.Vector3(x, b, z), q.setFromEuler(e.set(0, s % 1.05, 0)), new THREE.Vector3(r, Math.max(1, t - b), r)); ic.setMatrixAt(i, m4); c.setRGB(...lin([38 + s % 12, 36 + s % 10, 36 + s % 9])); ic.setColorAt(i, c); });
      ic.castShadow = ic.receiveShadow = true; group.add(ic); }
  }
  // ---- the kipuka's ohia further off (this hole's are hole.plants, drawn by main.js)
  for (const [X, Z, y, r, H] of VOLC.trees) { const [x, z] = L(X, Z); if (inField(x, z) || !near(x, z, far * 0.6)) continue; trees.push({ x, z, y: LY(y), s: Math.max(r / 3.4, H / 13), type: 'cotton', r: ((X * 7.3 + Z * 3.1) % 1 + 1) % 1 }); }

  // ---- the clubhouse: black basalt walls, a flat roof with deep eaves, warm windows
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb066, toneMapped: false }), Bg = batch();
  for (const H of VOLC.halls) {
    const P = H.p.map(p => L(...p)); if (!near(P[0][0], P[0][1], far)) continue;
    const c = [P.reduce((s, p) => s + p[0], 0) / 4, P.reduce((s, p) => s + p[1], 0) / 4];
    const y0 = Math.min(...P.map(p => footY(p[0], p[1], LY(H.y)))) - 0.4, y1 = y0 + H.h, ws = lin([40, 37, 36]), out = (p, f) => [c[0] + (p[0] - c[0]) * f, c[1] + (p[1] - c[1]) * f];
    for (let i = 0; i < 4; i++) { const p = P[i], q = P[(i + 1) % 4]; Br.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], ws);
      const L2 = Math.hypot(q[0] - p[0], q[1] - p[1]), nW = Math.floor(L2 / 5), nx2 = (q[1] - p[1]) / L2 * 0.08, nz2 = -(q[0] - p[0]) / L2 * 0.08;
      for (let w = 0; w < nW; w++) { const t0 = (w + 0.25) / nW, t1 = (w + 0.75) / nW, A = [p[0] + (q[0] - p[0]) * t0 - nx2, p[1] + (q[1] - p[1]) * t0 - nz2], Bq = [p[0] + (q[0] - p[0]) * t1 - nx2, p[1] + (q[1] - p[1]) * t1 - nz2];
        Bg.quad([A[0], y0 + 1.4, A[1]], [Bq[0], y0 + 1.4, Bq[1]], [Bq[0], y1 - 1.2, Bq[1]], [A[0], y1 - 1.2, A[1]], [1, 1, 1]); Bg.quad([Bq[0], y0 + 1.4, Bq[1]], [A[0], y0 + 1.4, A[1]], [A[0], y1 - 1.2, A[1]], [Bq[0], y1 - 1.2, Bq[1]], [1, 1, 1]); } }
    const E = P.map(p => out(p, 1.18)), rt = y1 + 0.6;
    Br.quad([E[0][0], rt, E[0][1]], [E[1][0], rt, E[1][1]], [E[2][0], rt, E[2][1]], [E[3][0], rt, E[3][1]], lin([30, 28, 27])); Br.quad([E[0][0], rt, E[0][1]], [E[3][0], rt, E[3][1]], [E[2][0], rt, E[2][1]], [E[1][0], rt, E[1][1]], lin([22, 20, 19]));
    for (let i = 0; i < 4; i++) { const p = E[i], q = E[(i + 1) % 4]; Br.quad([p[0], y1, p[1]], [q[0], y1, q[1]], [q[0], rt, q[1]], [p[0], rt, p[1]], lin([30, 28, 27])); }
  }
  { const m = Bg.mesh(glowMat, false); if (m) group.add(m); }

  // ---- smoke and glow: steam off the fumaroles and geysers, the vents' glow, the lavafall, the plume
  const sprite = (map, color, opacity, add = false) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, fog: true, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
  const steamM = sprite(TEX.steam, 0xf2ece6, 0.55), puffs = [];
  const steamAt = (x, y, z, r, n, rise, life) => { for (let i = 0; i < n; i++) { const s = new THREE.Sprite(steamM); s.userData = { x, y, z, r, rise, life, ph: i / n }; group.add(s); puffs.push(s); } };
  for (const [X, Z, y, r] of VOLC.steam) { const [x, z] = L(X, Z); if (near(x, z, far * 0.6)) steamAt(x, footY(x, z, LY(y)), z, r, coarse ? 4 : 6, 9, 6); }
  for (const G of VOLC.geysers) { const [x, z] = L(...G.at); if (near(x, z, far)) steamAt(x, LY(G.y) + 1, z, G.r * 0.25, 5, 14, 7); }
  anims.push((dt, t, wv) => { for (const s of puffs) { const u = s.userData, k = (t / u.life + u.ph) % 1, drift = k * u.rise;
    s.position.set(u.x + (wv?.x || 0.5) * drift * 0.6, u.y + 1 + drift, u.z + (wv?.z || 0.3) * drift * 0.6); s.scale.setScalar(u.r * (1 + k * 3)); s.material.opacity = 0.5; } });
  // the biggest geyser erupts every few minutes: a column of water and steam 30 m up for half a minute
  for (const G of VOLC.geysers.filter(g => g.erupt)) { const [x, z] = L(...G.at); if (!near(x, z, far)) continue;
    const jet = Array.from({ length: 10 }, (_, i) => { const s = new THREE.Sprite(sprite(TEX.steam, 0xffffff, 0)); group.add(s); return s; });
    anims.push((dt, t) => { const cyc = (t + hi * 37) % 180, on = cyc < 30 ? Math.sin(Math.PI * cyc / 30) : 0;
      jet.forEach((s, i) => { const k = i / 9; s.position.set(x, LY(G.y) + 2 + k * 30 * on, z); s.scale.setScalar(4 + k * 10); s.material.opacity = on * (0.7 - k * 0.4); }); }); }
  const glowM = sprite(TEX.glow, 0xffffff, 0.85, true);
  for (const [X, Z, y, r] of VOLC.vents) { const [x, z] = L(X, Z); if (!near(x, z, far * 1.4)) continue; const s = new THREE.Sprite(glowM); s.position.set(x, LY(y) + 3, z); s.scale.setScalar(r * 1.6); group.add(s);
    steamAt(x, LY(y) + 2, z, r * 0.4, 4, 26, 9); }
  // a soft glow over the lake and the rivers far off, as their light catches the fumes
  { const Rg = rng(hi + 5); for (let i = 0; i < Math.min(60, lavaFar.length); i++) { const c = lavaFar[Math.floor(Rg() * lavaFar.length)], [x, z] = L((c[0] + c[2]) / 2, (c[1] + c[3]) / 2);
      if (!near(x, z, 3600)) continue; const s = new THREE.Sprite(sprite(TEX.glow, 0xff7a30, 0.18, true)); s.position.set(x, c[4] + 18 - F.base, z); s.scale.set(140, 50, 1); group.add(s); } }
  // the lavafall: a ribbon of lava down the caldera wall from the lip to the pool, glowing at the foot
  { const Fa = VOLC.fall, n = 48, pts = [];
    for (let i = 0; i <= n; i++) { const t = i / n, X = Fa.top[0] + (Fa.foot[0] - Fa.top[0]) * t, Z = Fa.top[1] + (Fa.foot[1] - Fa.top[1]) * t, [x, z] = L(X, Z); pts.push([x, LY(Math.max(mapY(X, Z) + 1.2, Fa.foot[2] + 0.5)), z]); }
    if (near(pts[n][0], pts[n][2], 5000)) {
      const dx = pts[n][0] - pts[0][0], dz = pts[n][2] - pts[0][2], dl = Math.hypot(dx, dz), nx2 = -dz / dl, nz2 = dx / dl, pos = [], hot = [];
      for (let i = 0; i < n; i++) { const w0 = Fa.w * (0.6 + 0.5 * i / n) / 2, w1 = Fa.w * (0.6 + 0.5 * (i + 1) / n) / 2, A = pts[i], Bq = pts[i + 1];
        const v = [[A[0] - nx2 * w0, A[1], A[2] - nz2 * w0], [A[0] + nx2 * w0, A[1], A[2] + nz2 * w0], [Bq[0] + nx2 * w1, Bq[1], Bq[2] + nz2 * w1], [Bq[0] - nx2 * w1, Bq[1], Bq[2] - nz2 * w1]];
        pos.push(...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]); for (let q = 0; q < 6; q++) hot.push(0.8); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aHot', new THREE.Float32BufferAttribute(hot, 1));
      group.add(new THREE.Mesh(g, lavaMat));
      const s = new THREE.Sprite(sprite(TEX.glow, 0xff8a3a, 0.6, true)); s.position.set(pts[n][0], pts[n][1] + 10, pts[n][2]); s.scale.setScalar(90); group.add(s);
    } }
  // the plume: ash boiling up from the far vent and leaning downwind, lit red from below, lightning inside it
  { const P0 = VOLC.plume, [x, z] = L(...P0.at), y0 = LY(P0.y), Rp = rng(31), n = coarse ? 26 : 40, parts = [];
    for (let i = 0; i < n; i++) { const k = i / (n - 1), lit = Math.pow(1 - k, 2.2), col = new THREE.Color().setRGB(0.18 + 0.5 * lit, 0.15 + 0.12 * lit, 0.15 + 0.03 * lit);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.puff, color: col, transparent: true, opacity: 0.85 - k * 0.35, depthWrite: false, fog: false }));
      s.userData = { k, ox: (Rp() - 0.5) * 2, oz: (Rp() - 0.5) * 2, ph: Rp() * 6 }; group.add(s); parts.push(s); }
    const bolt = new THREE.Sprite(sprite(TEX.flash, 0xd8d0ff, 0, true)); group.add(bolt);
    let next = 4 + Rp() * 6, on = 0;
    anims.push((dt, t, wv) => { const wx = wv?.x || 0.6, wz = wv?.z || 0.2;
      for (const s of parts) { const u = s.userData, h = 60 + u.k * 3600, w = 200 + u.k * 1700;
        s.position.set(x + u.ox * w * 0.25 + wx * u.k * u.k * 900 + Math.sin(t * 0.05 + u.ph) * 30, y0 + h, z + u.oz * w * 0.25 + wz * u.k * u.k * 900); s.scale.set(w, w * 0.8, 1); }
      next -= dt; if (next < 0) { on = 0.35; next = 3 + Rp() * 9; bolt.position.set(x + (Rp() - 0.5) * 500, y0 + 600 + Rp() * 1500, z + (Rp() - 0.5) * 500); bolt.scale.setScalar(700 + Rp() * 600); }
      on = Math.max(0, on - dt); bolt.material.opacity = on > 0 ? (Math.sin(on * 60) > 0 ? 0.9 : 0.3) : 0; });
    const base = new THREE.Sprite(sprite(TEX.glow, 0xff5a1a, 0.55, true)); base.position.set(x, y0 + 40, z); base.scale.set(700, 300, 1); group.add(base);
  }

  { const m = Br.mesh(vc({ roughness: 0.95, side: THREE.DoubleSide })); if (m) group.add(m); }
  return { trees, anims };
}
