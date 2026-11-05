// Red Mesa scenery (global THREE): the canyon floor, the surface paint texture, distant mesas,
// arches and hoodoos built from the same shapes the physics hits, desert plants, props and
// wildlife. Everything for one hole goes into the group passed in; update(dt, t) animates it.
import { fbm, vnoise, rng, sstep, islandF, edgeRadius, hoodooR, prepRock, prepIsland } from './terrain.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- surface paint: R short grass (fairway, tee, fringe), G green, B sand (bunkers, waste, pond
   beds), A grass length (1 first cut and shorter, 0.55 rough, 0 native desert) ---------- */
export function surfaceTexture(T, hole, box, mPerTexel) {
  const W = Math.min(1024, Math.ceil((box.x1 - box.x0) / mPerTexel)), H = Math.min(1536, Math.ceil((box.z1 - box.z0) / mPerTexel));
  const data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = box.x0 + (i + 0.5) / W * (box.x1 - box.x0), z = box.z0 + (j + 0.5) / H * (box.z1 - box.z0);
    const s = T.surfaceAt(x, z), o = (j * W + i) * 4;
    data[o] = s === 'fairway' || s === 'tee' || s === 'fringe' ? 255 : 0;
    data[o + 1] = s === 'green' ? 255 : 0;
    data[o + 2] = s === 'sand' || s === 'waste' || s === 'water' ? 255 : 0;
    data[o + 3] = s === 'desert' || s === 'void' ? 0 : s === 'rough' || s === 'sand' || s === 'waste' || s === 'water' ? 140 : 255;
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return tex;
}

function rockAttrs(geo, w = 1) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 3 ? w : 0)), 4));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(n), 1));
  return geo;
}
function roughen(geo, amp, scale, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x / scale + seed, (y + z * 0.7) / scale - seed) - 0.5;
    p.setXYZ(i, x + n * amp, y + (fbm(z / scale, x / scale + 3) - 0.5) * amp * 0.5, z + (fbm(y / scale + 9, x / scale) - 0.5) * amp);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------- the canyon floor ---------- */
export function buildFloor(T, box, mat, coarse, group, playfield = false) {
  const F = T.floor; if (!F) return null;
  const meshes = [];
  const grid = (x0, z0, x1, z1, step, drop) => {
    const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let y = T.inGorge(x, z) ? F.y - 120 : T.floorShape(x, z);
      if (drop && x > box.x0 + 8 && x < box.x1 - 8 && z > box.z0 + 8 && z < box.z1 - 8) y -= drop;
      else if (drop) y += 6 * (fbm(x / 400, z / 400) - 0.5) * sstep(300, 1400, Math.hypot(x - (box.x0 + box.x1) / 2, z - (box.z0 + box.z1) / 2));
      p.setY(i, y);
    }
    geo.computeVertexNormals(); rockAttrs(geo, 0);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.island = { playable: F.solid, floor: true };
    group.add(m); meshes.push(m);
  };
  if (!playfield) grid(box.x0, box.z0, box.x1, box.z1, coarse ? 4 : 3, 0);
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, R = 3600;
  grid(cx - R, cz - R, cx + R, cz + R, coarse ? 60 : 40, 3);
  return meshes;
}

/* ---------- rock you can hit ---------- */
export function archGeometry(R) {
  const s = new THREE.Shape(), N = 40, foot = -4;
  s.moveTo(R.ao, foot);
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI; s.lineTo(R.ao * Math.cos(a), R.bo * Math.sin(a)); }
  s.lineTo(-R.ao, foot); s.lineTo(-R.ai, foot);
  for (let i = N; i >= 0; i--) { const a = (i / N) * Math.PI; s.lineTo(R.ai * Math.cos(a), R.bi * Math.sin(a)); }
  s.lineTo(R.ai, foot); s.lineTo(R.ao, foot);
  const geo = new THREE.ExtrudeGeometry(s, { depth: R.d, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 8, steps: 3 });
  geo.translate(0, 0, -R.d / 2);
  return geo;
}
export function buildRocks(T, hole, mat, group) {
  const capMat = new THREE.MeshStandardMaterial({ color: 0x5f4a3c, roughness: 0.95 });
  for (const R of T.rocks) {
    if (R.type === 'arch') {
      const geo = rockAttrs(roughen(archGeometry(R), 1.1, 9, R.x));
      const m = new THREE.Mesh(geo, mat); m.position.set(R.x, R.y, R.z); m.rotation.y = -(R.rot || 0);
      m.castShadow = m.receiveShadow = true; group.add(m);
    } else if (R.type === 'hoodoo') {
      const prof = []; const top = R.h - R.capH * 0.85;
      for (let i = 0; i <= 28; i++) { const v = -1 + (top + 1) * i / 28; prof.push(new THREE.Vector2(Math.max(0.3, hoodooR(R, Math.max(0, v))), v)); }
      prof.push(new THREE.Vector2(0.01, top));
      const geo = rockAttrs(roughen(new THREE.LatheGeometry(prof, 14), 0.35, 3, R.seed));
      const m = new THREE.Mesh(geo, mat); m.position.set(R.x, R.y, R.z); m.castShadow = m.receiveShadow = true; group.add(m);
      const cap = new THREE.Mesh(roughen(new THREE.SphereGeometry(1, 14, 8), 0.12, 0.6, R.seed), capMat);
      cap.scale.set(R.capR, R.capH * 0.6, R.capR * (0.85 + 0.15 * Math.sin(R.seed)));
      cap.position.set(R.x, R.y + R.h - R.capH * 0.5, R.z); cap.rotation.y = R.seed; cap.castShadow = cap.receiveShadow = true; group.add(cap);
    }
  }
}

/* ---------- distant mesas and buttes (scenery islands, built by the course renderer) ---------- */
export function decoMesas(hole, T, pin, coarse) {
  const R = rng(hole.heading * 37 + hole.par * 11 + 5);
  const a = { x: 0, z: 0 }, b = { x: pin.x, z: pin.z };
  const seg = (x, z) => { const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)); return Math.hypot(x - a.x - dx * t, z - a.z - dz * t); };
  const fy = T.floor ? T.floor.y : -60, out = [];
  const near = hole.islands.map(I => ({ x: I.x, z: I.z, r: Math.max(I.rx, I.rz) }));
  for (let i = 0; i < 500 && out.length < (coarse ? 30 : 44); i++) {
    const ang = R() * Math.PI * 2, rad = 260 + Math.pow(R(), 0.7) * 2600;
    const x = b.x * 0.5 + Math.cos(ang) * rad, z = b.z * 0.5 + Math.sin(ang) * rad;
    if (seg(x, z) < 200 + rad * 0.04) continue;
    const butte = R() < 0.3, size = butte ? 20 + R() * 40 : 60 + R() * 200 + rad * 0.04;
    if (out.some(d => Math.hypot(d.x - x, d.z - z) < (Math.max(d.rx, d.rz) + size) * 1.05)) continue;
    if (near.some(d => Math.hypot(d.x - x, d.z - z) < d.r + size + 20)) continue;
    const top = fy + (butte ? 60 + R() * 140 : 30 + R() * 150) + (rad > 1400 ? R() * 80 : 0);
    out.push(prepIsland({ x, z, rx: size, rz: size * (0.55 + R() * 0.9), rot: R() * 3, p: 2.6 + R() * 1.4, top, depth: top - fy, kind: 'rock', seed: 300 + i, relief: 2 }));
  }
  return out;
}

/* ---------- plants ---------- */
const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
const shrubMat = new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.4 });
export function scatterShrubs(T, box, coarse, group) {
  const R = rng(Math.round(box.x0 * 7 + box.z1 * 3)), n = coarse ? 900 : 1700, list = [];
  for (let i = 0; i < n * 4 && list.length < n; i++) {
    const x = box.x0 + R() * (box.x1 - box.x0), z = box.z0 + R() * (box.z1 - box.z0), s = T.surfaceAt(x, z);
    if (s !== 'rough' && s !== 'desert') continue;
    if (vnoise(x / 30, z / 30) < 0.35) continue;
    const g = T.groundAt(x, z); if (g === null) continue;
    list.push([x, g, z, 0.35 + R() * R() * 1.1, R()]);
  }
  const im = new THREE.InstancedMesh(shrubGeo, shrubMat, list.length), m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion();
  list.forEach(([x, y, z, s, r], i) => {
    m.compose(V(x, y + s * 0.25, z), q.setFromAxisAngle(V(0, 1, 0), r * 6), V(s * 1.2, s * 0.65, s));
    im.setMatrixAt(i, m); c.set(r < 0.55 ? 0x7d8a62 : r < 0.85 ? 0x9a9c6c : 0x6a6a44).offsetHSL(0, 0, (r - 0.5) * 0.06); im.setColorAt(i, c);
  });
  im.receiveShadow = true; im.castShadow = !coarse; group.add(im);
  // stones on the floor
  const stones = [];
  for (let i = 0; i < (coarse ? 260 : 500) * 4 && stones.length < (coarse ? 260 : 500); i++) {
    const x = box.x0 + R() * (box.x1 - box.x0), z = box.z0 + R() * (box.z1 - box.z0);
    if (T.surfaceAt(x, z) !== 'desert') continue;
    stones.push([x, T.groundAt(x, z), z, 0.3 + R() * R() * 2.2, R()]);
  }
  const sm = new THREE.InstancedMesh(shrubGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), stones.length);
  stones.forEach(([x, y, z, s, r], i) => { m.compose(V(x, y + s * 0.15, z), q.setFromEuler(new THREE.Euler(r, r * 7, r * 3)), V(s, s * 0.6, s * 0.8)); sm.setMatrixAt(i, m); c.set(r < 0.5 ? 0x8a4a30 : 0x9c6a4a); sm.setColorAt(i, c); });
  sm.castShadow = sm.receiveShadow = true; group.add(sm);
}
export function cottonwoodSpots(T, hole) {
  const out = [], R = rng(91);
  // a ring of cottonwoods around each spring pool, kept off the green side
  for (const W of T.features.water) for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + R() * 0.4, r = 1.5 + R() * 0.5, x = W.x + Math.cos(a) * W.rx * r, z = W.z + Math.sin(a) * W.rz * r;
    const s = T.surfaceAt(x, z); if (s === 'green' || s === 'fringe' || s === 'fairway' || s === 'water' || s === 'sand') continue;
    const y = T.groundAt(x, z); if (y === null) continue;
    out.push({ x, y, z, s: 1.2 + R() * 0.7, type: 'cotton', r: R() });
  }
  for (const w of (T.floor?.washes || [])) for (let i = 0; i < w.pts.length - 1; i++) {
    const [ax, az] = w.pts[i], [bx, bz] = w.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 8; d < L; d += 22 + R() * 14) {
      const side = R() < 0.5 ? -1 : 1, off = w.w / 2 + 5 + R() * 9;
      const x = ax + (bx - ax) * d / L + nx * off * side, z = az + (bz - az) * d / L + nz * off * side;
      const s = T.surfaceAt(x, z); if (s !== 'desert' && s !== 'rough') continue;
      out.push({ x, y: T.groundAt(x, z), z, s: 1.3 + R() * 0.7, type: 'cotton', r: R() });
    }
  }
  return out;
}

/* ---------- props ---------- */
const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3e, roughness: 0.95 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x4e3a2a, roughness: 1 });
const iron = new THREE.MeshStandardMaterial({ color: 0x3d3833, roughness: 0.6, metalness: 0.5 });
const rust = new THREE.MeshStandardMaterial({ color: 0x7c3f22, roughness: 0.8, metalness: 0.3 });
const tin = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.45, metalness: 0.7 });
const box = (w, h, d, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; return m; };
const cyl = (r0, r1, h, mat, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; };
function beam(a, b, w, mat) { // a timber from point a to point b
  const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.BoxGeometry(w, w, d.length()), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.castShadow = true; m.receiveShadow = true; return m;
}
function textPlank(text, w, h, bg = '#6b4a30', fg = '#f1e3c4') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w); const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`; g.beginPath(); const y = Math.random() * cv.height; g.moveTo(0, y); g.lineTo(cv.width, y + (Math.random() - 0.5) * 6); g.stroke(); }
  g.fillStyle = fg; g.font = `700 ${Math.round(cv.height * 0.5)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cv.width / 2, cv.height * 0.55);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
}

function windmill(p, y, ctx) {
  const g = new THREE.Group(); g.position.set(p.x, y, p.z);
  const H = 11, legs = [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]];
  for (const [x, z] of legs) g.add(beam(V(x, 0, z), V(x * 0.22, H, z * 0.22), 0.16, woodDark));
  for (let k = 1; k < 4; k++) { const t = k / 4, h = H * t, s = 1 - t * 0.78; for (let i = 0; i < 4; i++) { const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4]; g.add(beam(V(ax * s, h, az * s), V(bx * s, h, bz * s), 0.1, woodDark)); } }
  const head = new THREE.Group(); head.position.y = H + 0.3; g.add(head);
  head.add(box(0.5, 0.5, 1.2, iron, 0, 0, 0));
  const wheel = new THREE.Group(); wheel.position.z = -0.75; head.add(wheel);
  for (let i = 0; i < 18; i++) { const b = box(0.32, 2.3, 0.04, tin, 0, 1.45, 0); const piv = new THREE.Group(); piv.rotation.z = i / 18 * Math.PI * 2; b.rotation.y = 0.5; piv.add(b); wheel.add(piv); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.04, 6, 36), iron); wheel.add(ring);
  const tail = box(0.04, 1.2, 2.2, tin, 0, 0.2, 2.1); head.add(tail); head.add(beam(V(0, 0, 0.4), V(0, 0, 1.4), 0.08, iron));
  const tank = cyl(2.2, 2.2, 1.6, wood, 18); tank.position.set(4, 0.8, 1.5); g.add(tank);
  ctx.group.add(g);
  ctx.anims.push((dt, t, wind) => { head.rotation.y = Math.atan2(-wind.x, wind.z) + Math.PI; wheel.rotation.z -= dt * (0.6 + wind.mph * 0.25); });
}

function birdMesh(color, span) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.ConeGeometry(span * 0.09, span * 0.5, 6), mat); body.rotation.x = -Math.PI / 2; g.add(body);
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -span * 0.12, span * 0.5, 0, 0.02, 0, 0, span * 0.14, 0, 0, -span * 0.12, span * 0.5, 0, 0.02, 0, 0, span * 0.14].slice(0, 9), 3)); wg.computeVertexNormals();
  const L = new THREE.Mesh(wg, mat), Rw = new THREE.Mesh(wg, mat); Rw.scale.x = -1; g.add(L, Rw);
  g.userData.wings = [L, Rw];
  return g;
}
function birds(p, y, ctx, kind) {
  const n = kind === 'kestrels' ? 3 : 9, R = rng(n * 17);
  for (let i = 0; i < n; i++) {
    const b = birdMesh(kind === 'kestrels' ? 0x8a5a3a : 0x2a2a35, kind === 'kestrels' ? 0.9 : 0.35); ctx.group.add(b);
    const rad = kind === 'kestrels' ? 18 + R() * 26 : 10 + R() * 30, sp = kind === 'kestrels' ? 0.12 + R() * 0.08 : 0.5 + R() * 0.5, ph = R() * 6.28, hy = y + (R() - 0.5) * (kind === 'kestrels' ? 14 : 18);
    ctx.anims.push((dt, t) => {
      const a = ph + t * sp * (i % 2 ? 1 : -1), x = p.x + Math.cos(a) * rad + (kind === 'swallows' ? Math.sin(t * 2.1 + ph) * 6 : 0), z = p.z + Math.sin(a) * rad * 0.7;
      const yy = hy + Math.sin(t * 0.4 + ph) * 3;
      b.position.set(x, yy, z); b.rotation.y = -a + (i % 2 ? 0 : Math.PI);
      const flap = kind === 'kestrels' ? (Math.sin(t * 1.3 + ph) > 0.6 ? Math.sin(t * 16) * 0.6 : 0.12) : Math.sin(t * 22 + ph) * 0.8;
      b.userData.wings[0].rotation.z = flap; b.userData.wings[1].rotation.z = -flap;
    });
  }
}

function boulders(p, T, ctx) {
  const R = rng(7), geo = new THREE.IcosahedronGeometry(1, 1), mat = new THREE.MeshStandardMaterial({ color: 0x8c4a30, roughness: 1 });
  const im = new THREE.InstancedMesh(geo, mat, p.n), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < p.n; i++) {
    const x = p.x + (R() - 0.5) * p.w, z = p.z + (R() - 0.5) * p.d, s = 1 + R() * 3.5, y = T.groundAt(x, z) ?? T.floor.y;
    m.compose(V(x, y + s * 0.3, z), q.setFromEuler(new THREE.Euler(R() * 3, R() * 3, 0)), V(s, s * 0.7, s * 0.9)); im.setMatrixAt(i, m);
  }
  im.castShadow = im.receiveShadow = true; ctx.group.add(im);
}

function mine(p, T, ctx) {
  // rot: the way the portal faces (local +z → (sin rot, 0, cos rot)), out of the cliff
  const g = new THREE.Group(), y = T.groundAt(p.x + Math.sin(p.rot) * 8, p.z + Math.cos(p.rot) * 8) ?? 0;
  g.position.set(p.x, y, p.z); g.rotation.y = p.rot;
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(4, 4.6), new THREE.MeshBasicMaterial({ color: 0x0b0806 })); hole.position.set(0, 2.3, 0.6); g.add(hole);
  g.add(box(0.45, 5.2, 0.45, wood, -2.3, 2.6, 1), box(0.45, 5.2, 0.45, wood, 2.3, 2.6, 1), box(5.6, 0.55, 0.6, wood, 0, 5.2, 1));
  g.add(box(0.35, 4.8, 0.35, woodDark, -2.3, 2.4, 3.2), box(0.35, 4.8, 0.35, woodDark, 2.3, 2.4, 3.2), box(5.2, 0.4, 0.4, woodDark, 0, 4.9, 3.2), box(0.25, 0.3, 2.4, woodDark, -2.3, 4.9, 2.1), box(0.25, 0.3, 2.4, woodDark, 2.3, 4.9, 2.1));
  for (let i = 0; i < 16; i++) g.add(box(1.9, 0.12, 0.28, woodDark, 0, 0.06, 1 + i * 1.5));
  g.add(box(0.08, 0.12, 24, iron, -0.55, 0.18, 12.5), box(0.08, 0.12, 24, iron, 0.55, 0.18, 12.5));
  const cart = (z, ry) => { const c = new THREE.Group(); c.add(box(1.3, 0.9, 1.9, rust, 0, 0.95, 0)); for (const [x, zz] of [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.6], [0.5, 0.6]]) { const w = cyl(0.25, 0.25, 0.12, iron); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, zz); c.add(w); } c.position.set(0, 0.05, z); c.rotation.y = ry; return c; };
  g.add(cart(6, 0), cart(9.5, 0.04));
  const sign = textPlank('LUCKY STRIKE', 3.4, 0.7); sign.position.set(0, 6, 1.35); sign.rotation.z = -0.05; g.add(sign);
  const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1, flatShading: true })); ore.scale.set(2, 0.6, 1.5); ore.position.set(4.5, 0.3, 7); g.add(ore);
  ctx.group.add(g);
}

function trestle(p, T, ctx) {
  const ry = p.y, floorY = T.floor ? T.floor.y : -140, dir = Math.sign(p.z1 - p.z0), L = Math.abs(p.z1 - p.z0);
  const members = [];
  const add = (a, b, w) => members.push([a, b, w]);
  for (let s = 0; s <= L; s += 8) {
    const z = p.z0 + dir * s, g = T.groundAt(p.x, z), bottom = g === null ? floorY : g;
    if (ry - bottom < 0.8) continue;
    const H = ry - 0.4 - bottom, spread = 1.6 + H * 0.12;
    add(V(p.x - spread, bottom, z), V(p.x - 1.1, ry - 0.4, z), 0.32); add(V(p.x + spread, bottom, z), V(p.x + 1.1, ry - 0.4, z), 0.32);
    add(V(p.x - 0.4, bottom, z), V(p.x - 0.4, ry - 0.4, z), 0.28); add(V(p.x + 0.4, bottom, z), V(p.x + 0.4, ry - 0.4, z), 0.28);
    for (let h = bottom + 10; h < ry - 2; h += 11) {
      const w0 = 1.1 + (spread - 1.1) * (ry - 0.4 - h) / H, w1 = 1.1 + (spread - 1.1) * (ry - 0.4 - Math.min(ry - 0.4, h + 11)) / H;
      add(V(p.x - w0, h, z), V(p.x + w0, h, z), 0.18);
      add(V(p.x - w0, h, z), V(p.x + w1, Math.min(ry - 0.4, h + 11), z), 0.12); add(V(p.x + w0, h, z), V(p.x - w1, Math.min(ry - 0.4, h + 11), z), 0.12);
    }
    if (H > 6 && s + 8 <= L) for (const sx of [-1, 1]) add(V(p.x + sx * 0.4, ry - 3, z), V(p.x + sx * 0.4, ry - 7, z + dir * 8), 0.14);
  }
  // deck: ties and two rails, the whole length
  const ties = Math.floor(L / 0.9);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const im = new THREE.InstancedMesh(unit, wood, members.length + ties + 2), m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 0, 1);
  let k = 0;
  for (const [a, b, w] of members) { const d = b.clone().sub(a), l = d.length(); q.setFromUnitVectors(up, d.normalize()); m.compose(a.clone().add(b).multiplyScalar(0.5), q, V(w, w, l)); im.setMatrixAt(k++, m); }
  for (let i = 0; i < ties; i++) { m.compose(V(p.x, ry - 0.15, p.z0 + dir * i * 0.9), q.identity(), V(2.6, 0.2, 0.3)); im.setMatrixAt(k++, m); }
  im.count = k; im.castShadow = im.receiveShadow = true; ctx.group.add(im);
  for (const sx of [-0.55, 0.55]) { const r = box(0.08, 0.14, L, iron, p.x + sx, ry + 0.02, (p.z0 + p.z1) / 2); ctx.group.add(r); }
  // the train: loco, tender and three cars; crosses every minute or so, never near the ball
  const train = new THREE.Group(), black = new THREE.MeshStandardMaterial({ color: 0x1d1c1c, roughness: 0.55, metalness: 0.4 }), red = new THREE.MeshStandardMaterial({ color: 0x7a2418, roughness: 0.7 }), brass = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.4, metalness: 0.8 });
  const boiler = cyl(0.75, 0.75, 4.2, black, 16); boiler.rotation.x = Math.PI / 2; boiler.position.set(0, 1.55, -1.2); train.add(boiler);
  const stack = cyl(0.35, 0.2, 1.1, black); stack.position.set(0, 2.6, -2.7); train.add(stack);
  const dome = cyl(0.3, 0.35, 0.5, brass); dome.position.set(0, 2.35, -0.9); train.add(dome);
  train.add(box(1.8, 1.9, 1.7, red, 0, 1.95, 1.6), box(2, 0.12, 2, black, 0, 2.95, 1.6), box(1.6, 0.4, 6.6, black, 0, 0.75, -0.3));
  const cow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.8, 4), black); cow.rotation.x = -Math.PI / 2; cow.rotation.y = Math.PI / 4; cow.position.set(0, 0.6, -3.7); train.add(cow);
  for (let i = 0; i < 3; i++) { const w = cyl(0.55, 0.55, 1.7, black); w.rotation.z = Math.PI / 2; w.position.set(0, 0.55, -2.2 + i * 1.3); train.add(w); }
  const tender = box(1.7, 1.3, 3, black, 0, 1.25, 4.4); train.add(tender);
  for (let c = 0; c < 3; c++) { const car = box(1.8, 1.6, 6.5, c === 1 ? red : woodDark, 0, 1.55, 10 + c * 7.2); train.add(car, box(2, 0.12, 6.7, black, 0, 2.4, 10 + c * 7.2)); }
  train.traverse(o => { if (o.isMesh) o.castShadow = true; });
  ctx.group.add(train);
  // steam puffs
  const puffT = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const puffs = Array.from({ length: 36 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffT, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; ctx.group.add(s); return { s, age: 9 }; });
  let pi = 0, emit = 0;
  const period = 70, speed = 9, len = L + 40;
  ctx.anims.push((dt, t, wind) => {
    const ph = (t + 12) % period, u = ph * speed;
    const running = u < len;
    train.visible = running;
    if (running) {
      const zz = p.z0 + dir * (u - 30); train.position.set(p.x, ry + 0.1, zz); train.rotation.y = dir > 0 ? Math.PI : 0;
      emit += dt; if (emit > 0.12) { emit = 0; const P = puffs[pi++ % puffs.length]; P.age = 0; P.s.visible = true; P.s.position.set(p.x, ry + 3.2, zz - dir * 2.7); }
    }
    for (const P of puffs) {
      if (P.age > 6) { P.s.visible = false; continue; }
      P.age += dt; const a = P.age; P.s.position.x += (wind.x * 0.6) * dt; P.s.position.z += (wind.z * 0.6) * dt; P.s.position.y += (1.6 - a * 0.15) * dt;
      const sc = 1.2 + a * 1.6; P.s.scale.set(sc, sc, 1); P.s.material.opacity = 0.75 * Math.max(0, 1 - a / 6);
    }
  });
}

function balancedRock(p, T, ctx) {
  const y = T.groundAt(p.x, p.z) ?? 0, mat = new THREE.MeshStandardMaterial({ color: 0x9c5232, roughness: 0.95 });
  const prof = []; for (let i = 0; i <= 12; i++) { const v = i / 12 * 11; prof.push(new THREE.Vector2(1.6 + 2.4 * Math.pow(1 - v / 11, 2) - 0.7 * Math.sin(v / 11 * Math.PI) * 0.8, v)); }
  const ped = new THREE.Mesh(roughen(new THREE.LatheGeometry(prof, 12), 0.3, 2), mat); ped.position.set(p.x, y - 0.5, p.z); ped.castShadow = ped.receiveShadow = true;
  const bo = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1, 2), 0.25, 0.7, 4), new THREE.MeshStandardMaterial({ color: 0x6e4632, roughness: 0.95 }));
  bo.scale.set(6.5, 4.2, 5); bo.position.set(p.x + 1.2, y + 13.6, p.z); bo.rotation.z = 0.18; bo.castShadow = bo.receiveShadow = true;
  ctx.group.add(ped, bo);
}

function fossil(p, T, ctx) {
  const bone = new THREE.MeshStandardMaterial({ color: 0xe6dac0, roughness: 0.8 }), g = new THREE.Group();
  const y = (T.floor ? T.floor.y : 0) + 9; g.position.set(p.x, y, p.z); g.rotation.y = p.rot; // ribs face (sin rot, 0, cos rot)
  const spine = new THREE.CatmullRomCurve3([V(-16, 2, 0), V(-6, 5, 0.6), V(6, 4.5, 0.6), V(16, 0, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(spine, 40, 0.7, 8), bone));
  for (let i = 0; i < 12; i++) {
    const u = 0.12 + i / 13 * 0.76, a = spine.getPoint(u), len = 7 + Math.sin(u * Math.PI) * 6;
    const rib = new THREE.CatmullRomCurve3([a, a.clone().add(V(0.5, -len * 0.3, 2.4)), a.clone().add(V(1.2, -len * 0.75, 3)), a.clone().add(V(1.6, -len, 1.6))]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(rib, 16, 0.32 - i * 0.008, 6), bone));
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), bone); skull.scale.set(3.6, 1.8, 1.6); skull.position.set(-19, 2.6, 0.6); g.add(skull);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  ctx.group.add(g);
}

function debris(T, ctx) {
  const R = rng(23);
  for (const w of (T.floor?.washes || [])) for (let i = 0; i < 7; i++) {
    const k = Math.floor(R() * (w.pts.length - 1)), [ax, az] = w.pts[k], [bx, bz] = w.pts[k + 1], t = R();
    const x = ax + (bx - ax) * t + (R() - 0.5) * w.w * 1.6, z = az + (bz - az) * t + (R() - 0.5) * w.w * 1.6;
    const log = cyl(0.25, 0.35, 4 + R() * 5, new THREE.MeshStandardMaterial({ color: 0x9a8a78, roughness: 1 }), 7);
    log.rotation.z = Math.PI / 2; log.rotation.y = R() * 3; log.position.set(x, (T.groundAt(x, z) ?? 0) + 0.25, z); ctx.group.add(log);
  }
}

function clubhouse(p, T, ctx) {
  const y = T.groundAt(p.x, p.z) ?? 0, g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = p.rot || 0;
  const adobe = new THREE.MeshStandardMaterial({ color: 0xc78a5e, roughness: 0.95 }), glow = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb45a, emissiveIntensity: 0.9, roughness: 0.6 });
  g.add(box(24, 6.5, 13, adobe, 0, 3.0, 0), box(12, 4.5, 9, adobe, 6, 8.5, -1));
  for (let i = 0; i < 9; i++) { const v = cyl(0.18, 0.18, 1.6, woodDark, 6); v.rotation.x = Math.PI / 2; v.position.set(-11 + i * 2.7, 5.6, 7.2); g.add(v); }
  for (let i = 0; i < 6; i++) { const w = box(1.6, 1.8, 0.1, glow, -9 + i * 3.6, 2.6, 6.55); g.add(w); }
  for (let i = 0; i < 5; i++) g.add(box(0.3, 3.2, 0.3, woodDark, -10 + i * 5, 1.6, 12));
  for (let i = 0; i < 18; i++) g.add(box(0.15, 0.15, 6, wood, -11 + i * 1.3, 3.3, 9.3));
  g.add(box(22, 0.25, 0.3, woodDark, 0, 3.15, 12));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  ctx.group.add(g); ctx.glow.push(glow);
}

function observatory(p, T, ctx) {
  const y = T.groundAt(p.x, p.z) ?? 0, g = new THREE.Group(); g.position.set(p.x, y, p.z);
  const stucco = new THREE.MeshStandardMaterial({ color: 0xe2d6c2, roughness: 0.9 });
  const base = cyl(5, 5.4, 6.5, stucco, 28); base.position.y = 3.2; g.add(base);
  const dome = new THREE.Group(); dome.position.y = 6.5; g.add(dome);
  const dm = new THREE.Mesh(new THREE.SphereGeometry(5.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.75 })); dm.castShadow = true; dome.add(dm);
  dome.add(box(1.3, 5.6, 2.2, new THREE.MeshBasicMaterial({ color: 0x0c0c10 }), 0, 2.6, 3.9));
  const tube = cyl(0.5, 0.6, 5, new THREE.MeshStandardMaterial({ color: 0xf0ede6, roughness: 0.5 })); tube.position.set(0, 3.4, 2.2); tube.rotation.x = 0.75; dome.add(tube);
  g.add(box(1.6, 2.4, 0.2, woodDark, 0, 1.2, 5.3));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  ctx.group.add(g);
  ctx.anims.push(dt => { dome.rotation.y += dt * 0.05; });
}

function windowArch(p, T, mat, ctx) {
  const R = prepRock({ ...p, type: 'arch', y: (T.floor ? T.floorShape(p.x, p.z) : 0) - 1 }, () => 0);
  const geo = rockAttrs(roughen(archGeometry(R), 2, 14, 3));
  const m = new THREE.Mesh(geo, mat); m.position.set(R.x, R.y, R.z); m.rotation.y = -(R.rot || 0); m.castShadow = m.receiveShadow = true; ctx.group.add(m);
  // a fin of rock carrying it, so it reads as part of a ridge
  for (const sx of [-1, 1]) { const fin = new THREE.Mesh(rockAttrs(roughen(new THREE.BoxGeometry(70, R.bo * 0.85, R.d * 1.4, 10, 8, 3).toNonIndexed(), 4, 18, sx)), mat); fin.position.set(R.x + sx * (R.ao + 30), R.y + R.bo * 0.4, R.z); fin.castShadow = fin.receiveShadow = true; ctx.group.add(fin); }
}

/* ---------- petroglyph tee markers ---------- */
const GLYPHS = {
  spiral: g => { g.beginPath(); for (let a = 0; a < 18; a += 0.1) { const r = a * 5; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); },
  snake: g => { g.beginPath(); for (let x = 30; x < 226; x += 2) g.lineTo(x, 128 + Math.sin(x / 22) * 40 * (1 - Math.abs(x - 128) / 140)); g.stroke(); g.beginPath(); g.arc(226, 128 + Math.sin(226 / 22) * 4, 9, 0, 7); g.stroke(); },
  bird: g => { g.beginPath(); g.moveTo(30, 110); g.quadraticCurveTo(90, 60, 128, 120); g.quadraticCurveTo(166, 60, 226, 110); g.moveTo(128, 120); g.lineTo(128, 190); g.moveTo(110, 190); g.lineTo(146, 190); g.stroke(); },
  sun: g => { g.beginPath(); g.arc(128, 128, 40, 0, 7); g.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(128 + Math.cos(a) * 55, 128 + Math.sin(a) * 55); g.lineTo(128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90); g.stroke(); } },
  hand: g => { g.beginPath(); g.arc(128, 160, 42, 0, Math.PI, true); g.lineTo(86, 200); g.lineTo(170, 200); g.lineTo(170, 160); g.stroke(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(96 + i * 22, 125); g.lineTo(92 + i * 24, 50 + Math.abs(i - 1.5) * 14); g.stroke(); } g.beginPath(); g.moveTo(172, 160); g.lineTo(212, 120); g.stroke(); },
  train: g => { g.strokeRect(50, 100, 120, 60); g.strokeRect(170, 80, 50, 80); g.beginPath(); g.moveTo(70, 100); g.lineTo(70, 60); g.stroke(); for (const x of [80, 130, 195]) { g.beginPath(); g.arc(x, 180, 18, 0, 7); g.stroke(); } },
  spirals: g => { for (const [cx, cy] of [[85, 128], [171, 128]]) { g.beginPath(); for (let a = 0; a < 13; a += 0.1) { const r = a * 3.2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.stroke(); } },
  lizard: g => { g.beginPath(); g.moveTo(128, 30); g.lineTo(128, 226); g.stroke(); for (const y of [80, 160]) { g.beginPath(); g.moveTo(80, y - 30); g.lineTo(100, y); g.lineTo(156, y); g.lineTo(176, y - 30); g.stroke(); } g.beginPath(); g.ellipse(128, 40, 14, 20, 0, 0, 7); g.stroke(); },
  stars: g => { for (const [x, y, r] of [[70, 70, 22], [180, 90, 30], [110, 170, 26], [190, 190, 14]]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283 - 1.57, rr = i % 2 ? r * 0.4 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.stroke(); } },
};
function petroglyph(hole, T, tee, ctx) {
  const draw = GLYPHS[hole.glyph] || GLYPHS.spiral;
  for (const side of [-1, 1]) {
    const x = tee[0] + side * 8.5, z = tee[1] + 3, y = T.groundAt(x, z), ty = T.groundAt(tee[0], tee[1]);
    if (y === null || Math.abs(y - ty) > 1.5) continue;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d');
    g.fillStyle = '#3a2016'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 40},${40 + Math.random() * 20},${25},${Math.random() * 0.4})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
    g.strokeStyle = '#d9b48c'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; draw(g);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const rock = new THREE.Mesh(roughen(new THREE.IcosahedronGeometry(1, 2), 0.18, 0.8, side), new THREE.MeshStandardMaterial({ color: 0x5a2e1e, roughness: 0.9 }));
    rock.scale.set(1.8, 1.25, 0.9); rock.position.set(x, y + 0.6, z); rock.rotation.y = side * 0.9; rock.castShadow = rock.receiveShadow = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, transparent: false }));
    const n = V(-side, 0, -0.35).normalize(); face.position.set(x + n.x * 0.82, y + 0.75, z + n.z * 0.82); face.lookAt(face.position.clone().add(n));
    ctx.group.add(rock, face);
    return;
  }
}

function railing(I, T, ctx) {
  const posts = [];
  for (let i = 0; i < 26; i++) {
    const th = i / 26 * Math.PI * 2, e = edgeRadius(I, th), x = I.x + (e.x - I.x) * 0.9, z = I.z + (e.z - I.z) * 0.9;
    if (z < I.z - 2) continue; // open toward the green
    posts.push(V(x, (T.groundAt(x, z) ?? I.top), z));
  }
  posts.sort((a, b) => Math.atan2(a.z - I.z, a.x - I.x) - Math.atan2(b.z - I.z, b.x - I.x));
  for (const p of posts) ctx.group.add(beam(p, p.clone().add(V(0, 1.1, 0)), 0.14, woodDark));
  for (let i = 0; i < posts.length - 1; i++) for (const h of [0.55, 1.05]) ctx.group.add(beam(posts[i].clone().add(V(0, h, 0)), posts[i + 1].clone().add(V(0, h, 0)), 0.09, wood));
}

// build every prop on the hole; returns the animation hooks
export function buildProps(hole, T, tee, mat, group) {
  const ctx = { group, anims: [], glow: [] };
  for (const p of hole.props || []) {
    const y = T.groundAt(p.x, p.z);
    if (p.type === 'windmill') windmill(p, y ?? 0, ctx);
    else if (p.type === 'kestrels' || p.type === 'swallows') birds(p, p.y ?? ((y ?? 0) + 18), ctx, p.type);
    else if (p.type === 'boulders') boulders(p, T, ctx);
    else if (p.type === 'mine') mine(p, T, ctx);
    else if (p.type === 'trestle') trestle(p, T, ctx);
    else if (p.type === 'balanced') balancedRock(p, T, ctx);
    else if (p.type === 'fossil') fossil(p, T, ctx);
    else if (p.type === 'debris') debris(T, ctx);
    else if (p.type === 'clubhouse') clubhouse(p, T, ctx);
    else if (p.type === 'observatory') observatory(p, T, ctx);
    else if (p.type === 'windowArch') windowArch(p, T, mat, ctx);
  }
  for (const I of T.ISL) if (I.rail) railing(I, T, ctx);
  petroglyph(hole, T, hole.tees[Object.keys(hole.tees)[0]], ctx);
  return ctx;
}

/* ---------- the playing surface ---------- */
// One mesh over the hole's box, sampled from the shaped ground: 24 m tiles, fine (under a metre) where a
// green, bunker, tee or pond is, coarser elsewhere, with short skirts so tiles of different sizes meet
// without cracks. Cells that span a cliff are left to the island walls.
export function buildPlayfield(T, box, mat, coarse, group) {
  const FT = T.features, TILE = 24, fine = coarse ? 1 : 0.7, mid = coarse ? 3 : 2.2;
  const busy = [...FT.greens, ...FT.bunkers, ...FT.tees, ...FT.water];
  const pos = [], idx = [];
  for (let tz = box.z0; tz < box.z1; tz += TILE) for (let tx = box.x0; tx < box.x1; tx += TILE) {
    const hot = busy.some(F => F.x + F.bound > tx && F.x - F.bound < tx + TILE && F.z + F.bound > tz && F.z - F.bound < tz + TILE);
    const n = Math.max(2, Math.round(TILE / (hot ? fine : mid))), step = TILE / n, base = pos.length / 3, H = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = tx + i * step, z = tz + j * step, y = T.groundAt(x, z);
      H.push(y); pos.push(x, y ?? 0, z);
    }
    const ok = (...k) => { let lo = Infinity, hi = -Infinity; for (const q of k) { const y = H[q]; if (y === null) return false; lo = Math.min(lo, y); hi = Math.max(hi, y); } return hi - lo < Math.max(2.5, step * 0.9); };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      if (ok(a, b, c)) idx.push(base + a, base + c, base + b);
      if (ok(b, c, d)) idx.push(base + b, base + c, base + d);
    }
    // skirts down the tile's four edges
    const edge = [];
    for (let i = 0; i <= n; i++) edge.push(i);
    for (let j = 1; j <= n; j++) edge.push(j * (n + 1) + n);
    for (let i = n - 1; i >= 0; i--) edge.push(n * (n + 1) + i);
    for (let j = n - 1; j >= 1; j--) edge.push(j * (n + 1));
    edge.push(0);
    for (let k = 0; k < edge.length - 1; k++) {
      const p = edge[k], q = edge[k + 1]; if (H[p] === null || H[q] === null || Math.abs(H[p] - H[q]) > 2.5) continue;
      const s0 = pos.length / 3; pos.push(pos[(base + p) * 3], H[p] - 0.35, pos[(base + p) * 3 + 2], pos[(base + q) * 3], H[q] - 0.35, pos[(base + q) * 3 + 2]);
      idx.push(base + p, base + q, s0, base + q, s0 + 1, s0); // facing out, toward any crack
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.computeVertexNormals(); rockAttrs(geo, 0);
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.island = { playable: true, floor: true };
  group.add(m);
  return m;
}

/* ---------- ponds ---------- */
const waterMat = new THREE.MeshStandardMaterial({ color: 0x24525e, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.86, envMapIntensity: 1.3 });
export function buildWater(T, group) {
  for (const W of T.features.water) {
    const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, waterMat);
    m.scale.set(W.rx * 1.45, 1, W.rz * 1.45); m.rotation.y = -W.rot; m.position.set(W.x, W.level, W.z);
    m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }
}
