// Shared art for the Aerie's sky world (the course and Island Hopper): banks of cumulus round the horizon and
// wind-bent pines. Global THREE; drawn only, nothing here plays.
import { rng, hash2 } from './stage.js';

// banks of cumulus standing on the cloud sea: a flat, shadowed base, billows piled up into a lit, sharp-edged
// crown. Four variants in one atlas (rows of 256 px), drawn mirrored or not, so a ring of banks is one mesh:
// one draw, tinted per bank by vertex colour toward the haze and the sun. Not tone-mapped and not fogged.
let bankMat = null;
export function cumulusBankMaterial() {
  if (bankMat) return bankMat;

  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 1024; const g = cv.getContext('2d');
  [1, 2, 3, 4].forEach((seed, row) => {
    const R = rng(seed * 17 + 3), y0 = row * 256, base = 236, peaks = [0, 1, 2].map(() => ({ x: 90 + R() * 332, h: 110 + R() * 110, w: 70 + R() * 90 }));
    const top = x => Math.max(30, ...peaks.map(p => p.h * Math.exp(-(((x - p.x) / p.w) ** 2)))) * (0.9 + R() * 0.1);
    const puffs = [];
    for (let i = 0; i < 140; i++) {
      const x = 30 + R() * 452, ht = top(x) * Math.min(1, Math.min(x - 10, 502 - x) / 70), r = 14 + R() * 26 + ht * 0.12;
      puffs.push({ x, y: base - r * 0.6 - R() * Math.max(0, ht - r), r });
    }
    puffs.sort((a, b) => b.y - a.y); // low ones first: the lit crowns lie over them
    g.save(); g.translate(0, y0); g.beginPath(); g.rect(0, 0, 512, base); g.clip();
    for (const p of puffs) {
      const k = THREE.MathUtils.clamp((base - p.y) / 170, 0, 1), sh = Math.round(150 + 95 * k), sb = Math.round(172 + 76 * k);
      const gr = g.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.45, p.r * 0.1, p.x, p.y, p.r);
      gr.addColorStop(0, 'rgba(255,253,248,1)'); gr.addColorStop(0.55, `rgba(${sh + 6},${sh + 8},${sb},1)`); gr.addColorStop(0.86, `rgba(${sh},${sh + 4},${sb},0.95)`); gr.addColorStop(1, `rgba(${sh},${sh + 4},${sb},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    }
    g.restore();
    g.save(); g.translate(0, y0); g.globalCompositeOperation = 'destination-out'; // the base melts into the sea
    const fb = g.createLinearGradient(0, base - 34, 0, base); fb.addColorStop(0, 'rgba(0,0,0,0)'); fb.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = fb; g.fillRect(0, base - 34, 512, 22 + 34);
    g.restore();
  });
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  return (bankMat = new THREE.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.95, fog: false, toneMapped: false, side: THREE.DoubleSide })); // lit cumulus: the brightest thing in view
}

// A ring of n banks round (cx, cz) at 4.6-6 km, facing it, their bases at baseY; lit on the sun's side, tinted
// toward the haze. Returns the mesh (one draw).
export function cumulusBanks({ cx = 0, cz = 0, sunDir, haze, n = 34, baseY = -230, R = rng(77) }) {
  const lit = new THREE.Color(0xfff6ec), sh = new THREE.Color(0xd2d9e3), sunA = Math.atan2(sunDir.z, sunDir.x);
  const pos = [], uv = [], col = [], idx = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * 6.28 + R() * 0.15, rad = 4600 + R() * 1400, w = 1000 + R() * 1500;
    const towards = Math.cos(ang - sunA), c = sh.clone().lerp(lit, 0.5 + 0.5 * Math.max(0, towards)).lerp(haze, 0.08 + R() * 0.1);
    const hgt = w * (0.42 + R() * 0.2), x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad, y0 = baseY + R() * 70;
    const ex = -Math.sin(ang) * w / 2, ez = Math.cos(ang) * w / 2, row = Math.floor(R() * 4), flip = R() < 0.5;
    const v0 = 1 - (row + 1) / 4, v1 = 1 - row / 4, u0 = flip ? 1 : 0, u1 = flip ? 0 : 1, k = pos.length / 3;
    pos.push(x - ex, y0, z - ez, x + ex, y0, z + ez, x + ex, y0 + hgt, z + ez, x - ex, y0 + hgt, z - ez);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let j = 0; j < 4; j++) col.push(c.r, c.g, c.b);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const gb = new THREE.BufferGeometry(); gb.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gb.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gb.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gb.setIndex(idx);
  const banks = new THREE.Mesh(gb, cumulusBankMaterial()); banks.renderOrder = -1; banks.frustumCulled = false;
  return banks;
}

// small faceted clumps (20 faces) that make the pines' pads of needles
export const clumpGeo = new THREE.IcosahedronGeometry(1, 0);
{ const p = clumpGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = 1 + (hash2(Math.round(v.x * 40), Math.round(v.y * 40 + v.z * 20)) - 0.5) * 0.45; p.setXYZ(i, v.x * n, v.y * n * 0.75, v.z * n); } clumpGeo.computeVertexNormals(); }
export const clumpMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true, envMapIntensity: 0.4 });
const pineTrunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 6); pineTrunkGeo.translate(0, 0.5, 0); pineTrunkGeo.userData.keep = clumpGeo.userData.keep = true; // shared: a hole's teardown leaves them
const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 1 });

// The Aerie: pines like those on Zhangjiajie's pillars, a leaning trunk and flat pads of needles in tiers,
// spread to one side (drawn only; each tree still plays by its type's size in trees.js)
export function skyPines(list, group) {
  const pads = new THREE.InstancedMesh(clumpGeo, clumpMat, list.length * 5), trunks = new THREE.InstancedMesh(pineTrunkGeo, pineTrunkMat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color(), e3 = new THREE.Euler(), R = rng(list.length * 13 + 3);
  let k = 0, ti = 0;
  for (const t of list) {
    const H = (t.type === 'pine' ? 6 : 4.5) * t.s + 3 * t.r, lean = R() * 6.28, tilt = 0.12 + R() * 0.28, lx = Math.cos(lean), lz = Math.sin(lean);
    q.setFromEuler(e3.set(Math.sin(lean) * tilt, 0, -Math.cos(lean) * tilt)); m.compose(ps.set(t.x, t.y - 0.3, t.z), q, sc.set(t.s * 0.9, H, t.s * 0.9)); trunks.setMatrixAt(ti++, m);
    const base = [0x2c4428, 0x34502e, 0x283e25][Math.floor(R() * 3)];
    for (let i = 0; i < 5; i++) {
      const f = 0.5 + i * 0.12, w = t.s * (2.4 - i * 0.3) * (0.8 + R() * 0.4), off = H * Math.sin(tilt) * f + (R() - 0.3) * t.s * 1.2;
      m.compose(ps.set(t.x + lx * off + (R() - 0.5) * t.s, t.y + H * f * Math.cos(tilt), t.z + lz * off + (R() - 0.5) * t.s), q.setFromEuler(e3.set((R() - 0.5) * 0.15, R() * 6, (R() - 0.5) * 0.15)), sc.set(w, w * 0.28, w * (0.7 + R() * 0.3)));
      pads.setMatrixAt(k, m); c.set(base).offsetHSL((R() - 0.5) * 0.02, (R() - 0.5) * 0.06, (R() - 0.5) * 0.05 + i * 0.012); pads.setColorAt(k, c); k++;
    }
  }
  pads.count = k; trunks.count = ti;
  for (const im of [pads, trunks]) { im.castShadow = true; im.receiveShadow = true; if (im.count) group.add(im); }
}
