// Red Mesa scenery (global THREE): the canyon floor, the surface paint texture, distant mesas,
// arches and hoodoos built from the same shapes the physics hits, desert plants, props and
// wildlife. Everything for one hole goes into the group passed in; update(dt, t) animates it.
import { fbm, vnoise, rng, sstep, islandF, edgeRadius, hoodooR, archOuterA, prepRock, prepIsland } from './terrain.js';

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
export function buildFloor(T, box, mat, coarse, group, playfield = false, { gorgeEdge = false } = {}) {
  const F = T.floor; if (!F) return null;
  const meshes = [];
  const inBox = (x, z) => x > box.x0 + 8 && x < box.x1 - 8 && z > box.z0 + 8 && z < box.z1 - 8;
  // gorgeEdge: round each chasm, a fine apron of floor out to past the coarse cells that touch it (they're dropped,
  // or two corners pulled to opposite sides of the rim would lay a lid across it); the coarse floor sits under it
  // (one apron over all the chasms together: separate ones would overlap, and two floors at one height flicker)
  const big = coarse ? 60 : 40, aprons = [];
  if (gorgeEdge && F.gorges.length) { const A = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
    for (const g of F.gorges) { const m = g.bound + big * 1.6; A.x0 = Math.min(A.x0, g.x - m); A.x1 = Math.max(A.x1, g.x + m); A.z0 = Math.min(A.z0, g.z - m); A.z1 = Math.max(A.z1, g.z + m); }
    aprons.push(A); }
  const inApron = (x, z) => aprons.some(A => x > A.x0 && x < A.x1 && z > A.z0 && z < A.z1);
  const grid = (x0, z0, x1, z1, step, drop) => {
    const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = geo.attributes.position, In = gorgeEdge ? new Uint8Array(p.count) : null;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      // gorgeEdge (caves): a point in a chasm moves out onto its rim (the chasm gets its own wall, buildGorgeWalls),
      // rather than the floor sloping down into it across a whole coarse cell
      if (gorgeEdge && T.inGorge(x, z)) { const g = F.gorges.find(g => islandF(g, x, z) <= 1); const dx = x - g.x, dz = z - g.z, e = edgeRadius(g, Math.atan2(-dx * g.s + dz * g.c, dx * g.c + dz * g.s)); x = e.x; z = e.z; p.setX(i, x); p.setZ(i, z); In[i] = 1; }
      let y = !In?.[i] && T.inGorge(x, z) ? F.y - 120 : T.floorShape(x, z);
      if (drop && (inBox(x, z) || inApron(x, z))) y -= drop;
      else if (drop) y += 6 * (fbm(x / 400, z / 400) - 0.5) * sstep(300, 1400, Math.hypot(x - (box.x0 + box.x1) / 2, z - (box.z0 + box.z1) / 2));
      p.setY(i, y);
    }
    if (In) { // drop every triangle touching a chasm: the apron (or the playfield) covers the ground round it
      const ix = geo.index.array, keep = [];
      for (let t = 0; t < ix.length; t += 3) { const a = ix[t], b = ix[t + 1], c = ix[t + 2]; if (In[a] || In[b] || In[c]) continue; keep.push(a, b, c); }
      geo.setIndex(keep);
    }
    geo.computeVertexNormals(); rockAttrs(geo, 0);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.island = { playable: F.solid, floor: true };
    group.add(m); meshes.push(m);
  };
  if (!playfield) grid(box.x0, box.z0, box.x1, box.z1, coarse ? 4 : 3, 0);
  for (const A of aprons) { // the fine floor round a chasm, ending on its outline (not where the playfield already is)
    const st = coarse ? 5 : 4, nx = Math.ceil((A.x1 - A.x0) / st), nz = Math.ceil((A.z1 - A.z0) / st), pos = [], H = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = A.x0 + i * st, z = A.z0 + j * st; H.push(T.inGorge(x, z) ? null : T.floorShape(x, z)); pos.push(x, 0, z); }
    const In = new Uint8Array(H.length);
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i; if (H[k] !== null) { pos[k * 3 + 1] = H[k]; continue; }
      const x = pos[k * 3], z = pos[k * 3 + 2]; let best = null;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const ii = i + di, jj = j + dj; if (ii < 0 || ii > nx || jj < 0 || jj > nz || H[jj * (nx + 1) + ii] === null) continue;
        const x2 = A.x0 + ii * st, z2 = A.z0 + jj * st; let lo = 0, hi = 1;
        for (let q = 0; q < 10; q++) { const m = (lo + hi) / 2; if (T.inGorge(x + (x2 - x) * m, z + (z2 - z) * m)) lo = m; else hi = m; }
        if (!best || hi < best.t) best = { t: hi, x: x + (x2 - x) * hi, z: z + (z2 - z) * hi };
      }
      if (!best) continue;
      H[k] = T.floorShape(best.x, best.z); pos[k * 3] = best.x; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = best.z; In[k] = 1;
    }
    const ok = k => H[k] !== null;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (inBox(A.x0 + (i + 0.5) * st, A.z0 + (j + 0.5) * st)) continue;
      if (ok(a) && ok(b) && ok(c) && !(In[a] && In[b] && In[c])) idx.push(a, c, b);
      if (ok(b) && ok(c) && ok(d) && !(In[b] && In[c] && In[d])) idx.push(b, c, d);
    }
    if (!idx.length) continue;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); rockAttrs(geo, 0);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.island = { playable: F.solid, floor: true }; group.add(m); meshes.push(m);
  }
  const cx = (box.x0 + box.x1) / 2, cz = (box.z0 + box.z1) / 2, R = 3600;
  grid(cx - R, cz - R, cx + R, cz + R, coarse ? 60 : 40, 3);
  return meshes;
}

/* ---------- rock you can hit ---------- */
export function archGeometry(R) {
  const s = new THREE.Shape(), N = 40, foot = -4;
  const fl = R.flare ? archOuterA(R, 0) : R.ao; // flared legs: the outer line widens toward the foot
  s.moveTo(fl + 1, foot);
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI, v = R.bo * Math.sin(a); s.lineTo(archOuterA(R, v) * Math.cos(a), v); }
  s.lineTo(-fl - 1, foot); s.lineTo(-R.ai, foot);
  for (let i = N; i >= 0; i--) { const a = (i / N) * Math.PI; s.lineTo(R.ai * Math.cos(a), R.bi * Math.sin(a)); }
  s.lineTo(R.ai, foot); s.lineTo(R.ao, foot);
  const geo = new THREE.ExtrudeGeometry(s, { depth: R.d, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 8, steps: 3 });
  geo.translate(0, 0, -R.d / 2);
  return geo;
}

/* ---------- waterfalls: a sheet of water down a cliff, a stream across the top, spray at the foot ---------- */
// prop { type: 'waterfall', x, z (the lip), rot (the way the water falls out of the cliff), w, top, back (m of
// stream on top) }
const fallTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d'), R = rng(77);
  g.fillStyle = 'rgba(220,235,240,0.55)'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 160; i++) { const x = R() * 64, y = R() * 256, l = 20 + R() * 70; g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.6})`; g.fillRect(x, y, 1 + R() * 2.5, l); g.fillRect(x, y - 256, 1 + R() * 2.5, l); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
})();
function waterfall(p, T, ctx) {
  const dx = Math.sin(p.rot), dz = Math.cos(p.rot), w = p.w || 10;
  // find the lip: walk out from inside the rock until the ground falls away
  let lx = p.x - dx * 30, lz = p.z - dz * 30; const top = p.top ?? T.groundAt(lx, lz) ?? 0;
  for (let k = 0; k < 160; k++) { const g = T.groundAt(lx + dx * 0.5, lz + dz * 0.5); if (g === null || g < top - 3) break; lx += dx * 0.5; lz += dz * 0.5; }
  p = { ...p, x: lx, z: lz };
  const bottom = T.groundAt(p.x + dx * 8, p.z + dz * 8) ?? top - 40, H = top - bottom;
  const tex = fallTex.clone(); tex.needsUpdate = true; tex.repeat.set(w / 8, H / 30);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xe8f3f6 });
  // the sheet bows out from the cliff as it falls
  const geo = new THREE.PlaneGeometry(w, H, 4, 20), q = geo.attributes.position;
  for (let i = 0; i < q.count; i++) { const y = q.getY(i), t = (H / 2 - y) / H; q.setXYZ(i, q.getX(i) * (1 + t * 0.35), -t * H, 0.8 + t * t * 5 + t * 1.5); }
  const sheet = new THREE.Mesh(geo, mat); sheet.position.set(p.x, top + 0.3, p.z); sheet.rotation.y = p.rot; sheet.renderOrder = 2; ctx.group.add(sheet);
  // the stream across the top, back from the lip
  const back = p.back || 60, sg = new THREE.PlaneGeometry(w * 0.8, back, 1, 8); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, -back / 2);
  const stream = new THREE.Mesh(sg, waterMat); stream.position.set(p.x, top + 0.15, p.z); stream.rotation.y = p.rot; ctx.group.add(stream);
  // spray at the foot
  const spray = [], sm = new THREE.SpriteMaterial({ map: fallTex, color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(sm); const k = i / 9; s.scale.set(w * (0.9 + k), w * 0.7, 1); s.position.set(p.x + dx * (6 + k * 6) + (k - 0.5) * w * dz, bottom + 2 + k * 3, p.z + dz * (6 + k * 6) - (k - 0.5) * w * dx); ctx.group.add(s); spray.push(s); }
  ctx.anims.push((dt, t) => { tex.offset.y = t * 0.9; spray.forEach((s, i) => { s.material.opacity = 0.25 + 0.12 * Math.sin(t * 2 + i); }); });
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
    } else if (R.type === 'boulder' && R.r >= 3) { // a big one: its own mesh in the canyon's rock
      // craggy: two passes of noise, a flattened base, and a few broken facets
      const geo = new THREE.IcosahedronGeometry(1, 3), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const sq = 1 / Math.pow(Math.abs(x) ** R.pe + Math.abs(y) ** R.pe + Math.abs(z) ** R.pe, 1 / R.pe); x *= sq; y *= sq; z *= sq; // the block
        const k = 1 + 0.22 * (fbm(x * 1.3 + R.seed, (y + z) * 1.3) - 0.5) + 0.09 * (fbm(x * 4 - R.seed, z * 4 + y * 2) - 0.5);
        const cut = Math.max(0.55, 1 - Math.max(0, Math.abs(Math.sin(Math.atan2(z, x) * 2.5 + R.seed)) - 0.82) * 1.6); // flat-ish facets
        p.setXYZ(i, x * k * cut, Math.max(-0.75, y * k), z * k * cut);
      }
      geo.computeVertexNormals(); rockAttrs(geo);
      const m = new THREE.Mesh(geo, mat); m.scale.set(R.a, R.hc, R.b); m.position.set(R.x, R.y + R.cy, R.z); m.rotation.y = -(R.rot || 0);
      m.castShadow = m.receiveShadow = true; group.add(m);
    }
  }
  // the rest of the boulders, instanced over a few lumpy shapes
  const small = T.rocks.filter(R => R.type === 'boulder' && R.r < 3);
  if (small.length) {
    const geos = [0, 1, 2].map(k => roughen(new THREE.IcosahedronGeometry(1, 1), 0.3, 0.7, 11 + k * 7));
    const bm = new THREE.MeshStandardMaterial({ roughness: 0.97, flatShading: true }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    geos.forEach((geo, k) => {
      const list = small.filter((_, i) => i % 3 === k); if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, bm, list.length);
      list.forEach((R, i) => {
        m4.compose(V(R.x, R.y + R.cy, R.z), q.setFromEuler(new THREE.Euler(0, -(R.rot || 0), 0)), V(R.a, R.hc, R.b)); im.setMatrixAt(i, m4);
        c.set([0x8c4a30, 0x9a5a3a, 0x7a4430, 0xa86a48][Math.floor(R.seed) % 4]).offsetHSL(0, 0, ((R.seed * 7) % 1 - 0.5) * 0.05); im.setColorAt(i, c);
      });
      im.castShadow = im.receiveShadow = true; group.add(im);
    });
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
    out.push(prepIsland({ x, z, rx: size, rz: size * (0.55 + R() * 0.9), rot: R() * 3, p: 2.2 + R() * 1.1, top, depth: top - fy, kind: 'rock', seed: 300 + i, relief: 2, ragged: true }));
  }
  return out;
}

/* ---------- talus: blocks fallen from the walls, heaped at their feet (scenery) ---------- */
export function talus(pts, coarse, group) {
  if (!pts || !pts.length) return;
  const list = coarse ? pts.filter((_, i) => i % 2 === 0) : pts;
  const geos = [0, 1].map(k => { const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + k * 5, p.getZ(i) * 2 + p.getY(i)) - 0.5) * 0.7; p.setXYZ(i, p.getX(i) * n * 1.2, p.getY(i) * n * 0.7, p.getZ(i) * n); }
    g.computeVertexNormals(); return g; });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.97, flatShading: true }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), e3 = new THREE.Euler();
  geos.forEach((geo, k) => {
    const L = list.filter((_, i) => i % 2 === k); if (!L.length) return;
    const im = new THREE.InstancedMesh(geo, mat, L.length);
    L.forEach(([x, y, z, s, r], i) => {
      m4.compose(V(x, y + s * 0.15, z), q.setFromEuler(e3.set(r * 2, r * 13, r * 5)), V(s, s * (0.6 + r * 0.5), s * (0.8 + r * 0.4))); im.setMatrixAt(i, m4);
      c.set([0x8a4228, 0x9c5434, 0x6e3822, 0xa8603e, 0x52301f][Math.floor(r * 5)]).offsetHSL(0, 0, (r - 0.5) * 0.05); im.setColorAt(i, c);
    });
    im.castShadow = !coarse; im.receiveShadow = true; group.add(im);
  });
}

/* ---------- plants ---------- */
const shrubGeo = new THREE.IcosahedronGeometry(1, 1);
// sagebrush and blackbrush: crossed, twiggy cut-outs, silver-green (a smooth sphere read as a stone)
const sageGeo = (() => { const g = new THREE.BufferGeometry(), P = [], U = [];
  for (const r of [0, Math.PI / 3, Math.PI * 2 / 3]) { const c = Math.cos(r) * 0.5, s = Math.sin(r) * 0.5;
    P.push(-c, 0, -s, c, 0, s, c, 1, s, -c, 0, -s, c, 1, s, -c, 1, -s); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); return g; })();
let sageTex = null;
function sagebrushTexture() {
  if (sageTex) return sageTex;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), R = rng(41);
  // a rounded clump of fine twigs and tiny leaves, thinning toward its edge
  for (let i = 0; i < 900; i++) {
    const a = R() * Math.PI, rr = Math.sqrt(R()), x = S / 2 + Math.cos(a) * rr * S * 0.46, y = S - Math.sin(a) * rr * S * 0.92;
    if (rr > 0.8 && R() < 0.5) continue;
    const v = R(); g.fillStyle = `rgb(${140 + v * 45},${150 + v * 40},${125 + v * 40})`; g.fillRect(x, y, 1.5 + R() * 2.5, 1.5 + R() * 2);
  }
  g.strokeStyle = 'rgba(110,95,80,0.9)'; g.lineWidth = 1.2;
  for (let i = 0; i < 14; i++) { const x0 = S / 2 + (R() - 0.5) * 20; g.beginPath(); g.moveTo(x0, S); g.lineTo(x0 + (R() - 0.5) * 70, S - 20 - R() * 60); g.stroke(); }
  sageTex = new THREE.CanvasTexture(cv); sageTex.encoding = THREE.sRGBEncoding; return sageTex;
}
const shrubMat = new THREE.MeshStandardMaterial({ roughness: 0.95, envMapIntensity: 0.4 });
export function scatterShrubs(T, box, coarse, group, { red = false } = {}) {
  const R = rng(Math.round(box.x0 * 7 + box.z1 * 3)), n = red ? (coarse ? 1600 : 3200) : coarse ? 900 : 1700, list = [];
  for (let i = 0; i < n * 4 && list.length < n; i++) {
    const x = box.x0 + R() * (box.x1 - box.x0), z = box.z0 + R() * (box.z1 - box.z0), s = T.surfaceAt(x, z);
    if (s !== 'desert' && !(s === 'rough' && T.fairwayD(x, z) > 14)) continue;
    if (T.features.greens.some(G => Math.hypot(x - G.x, z - G.z) < (G.reach || Math.max(G.rx, G.rz)) + G.apron + 10)) continue;
    if (vnoise(x / 30, z / 30) < 0.35) continue;
    const g = T.groundAt(x, z); if (g === null) continue;
    list.push([x, g, z, 0.35 + R() * R() * 1.1, R()]);
  }
  const sage = !!red;
  const im = sage ? new THREE.InstancedMesh(sageGeo, new THREE.MeshStandardMaterial({ map: sagebrushTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }), list.length)
    : new THREE.InstancedMesh(shrubGeo, shrubMat, list.length), m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion();
  list.forEach(([x, y, z, s, r], i) => {
    if (sage) m.compose(V(x, y - 0.05, z), q.setFromAxisAngle(V(0, 1, 0), r * 6), V(s * 1.9, s * 1.2, s * 1.9));
    else m.compose(V(x, y + s * 0.25, z), q.setFromAxisAngle(V(0, 1, 0), r * 6), V(s * 1.2, s * 0.65, s));
    im.setMatrixAt(i, m);
    if (sage) c.set(r < 0.6 ? 0x8a9478 : r < 0.85 ? 0x9a9878 : 0x55583f).offsetHSL(0, 0, (r - 0.5) * 0.05); // sagebrush, rabbitbrush, blackbrush
    else c.set(r < 0.55 ? 0x7d8a62 : r < 0.85 ? 0x9a9c6c : 0x6a6a44).offsetHSL(0, 0, (r - 0.5) * 0.06);
    im.setColorAt(i, c);
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
// trees stay out of play: off the line from every tee to the pin, clear of the fairway and green surrounds
function inPlay(T, hole, x, z) {
  const pin = hole.pin || [0, -100];
  for (const t of Object.values(hole.tees || {})) {
    const [ax, az] = Array.isArray(t) ? t : [t.x, t.z], dx = pin[0] - ax, dz = pin[1] - az, L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(x - ax - dx * k, z - az - dz * k) < 20) return true;
  }
  if (T.fairwayD(x, z) < 9) return true;
  return T.features.greens.some(G => Math.hypot(x - G.x, z - G.z) < (G.reach || Math.max(G.rx, G.rz)) + G.apron + 10);
}
export function cottonwoodSpots(T, hole) {
  const out = [], R = rng(91);
  // a ring of cottonwoods around each spring pool, kept off the green side
  for (const W of T.features.water) for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + R() * 0.4, r = 1.5 + R() * 0.5, x = W.x + Math.cos(a) * W.rx * r, z = W.z + Math.sin(a) * W.rz * r;
    const s = T.surfaceAt(x, z); if (s === 'green' || s === 'fringe' || s === 'fairway' || s === 'water' || s === 'sand') continue;
    if (inPlay(T, hole, x, z)) continue;
    const y = T.groundAt(x, z); if (y === null) continue;
    out.push({ x, y, z, s: 1.2 + R() * 0.7, type: 'cotton', r: R() });
  }
  for (const w of [...(T.floor?.washes || []), ...T.features.rivers.map(V => ({ pts: V.line.filter((_, k) => k % 6 === 0), w: V.w + 6 }))]) for (let i = 0; i < w.pts.length - 1; i++) {
    const [ax, az] = w.pts[i], [bx, bz] = w.pts[i + 1], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 8; d < L; d += 22 + R() * 14) {
      const side = R() < 0.5 ? -1 : 1, off = w.w / 2 + 5 + R() * 9;
      const x = ax + (bx - ax) * d / L + nx * off * side, z = az + (bz - az) * d / L + nz * off * side;
      const s = T.surfaceAt(x, z); if (s !== 'desert' && s !== 'rough') continue;
      if (inPlay(T, hole, x, z)) continue;
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
const waterMat = new THREE.MeshStandardMaterial({ color: 0x24525e, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.86, envMapIntensity: 1.3 });
const riverMat = new THREE.MeshStandardMaterial({ color: 0x2f5f63, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.88, envMapIntensity: 1.2, side: THREE.DoubleSide });
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

// A flock is one mesh: every bird's body (a cone) and two wings written into one geometry each frame, so ten
// swallows cost one draw, not thirty. Flat-shaded, so no normals to keep.
function birds(p, y, ctx, kind) {
  // kestrels hover and stoop, swallows dart, ravens wheel in a pair, a red-tailed hawk soars wide and high
  const SPEC = { kestrels: [3, 0x8a5a3a, 0.9, 18, 26, 0.12, 0.08, 14], swallows: [9, 0x2a2a35, 0.35, 10, 30, 0.5, 0.5, 18],
    ravens: [2, 0x141418, 1.15, 28, 20, 0.16, 0.04, 8], hawk: [1, 0x6a4a32, 1.3, 70, 30, 0.07, 0.02, 6] }[kind];
  const [n, col, span, r0, r1, s0, s1, dy] = SPEC, R = rng(n * 17 + span * 10);
  const cone = new THREE.ConeGeometry(span * 0.09, span * 0.5, 6).rotateX(-Math.PI / 2).toNonIndexed(), body = cone.attributes.position.array; cone.dispose();
  const wing = [0, 0, -span * 0.12, span * 0.5, 0, 0.02, 0, 0, span * 0.14], per = body.length / 3 + 6;
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * per * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.9, side: THREE.DoubleSide, flatShading: true }));
  mesh.frustumCulled = false; ctx.group.add(mesh);
  const flock = [];
  for (let i = 0; i < n; i++) flock.push({ rad: r0 + R() * r1, sp: s0 + R() * s1, ph: kind === 'ravens' ? i * 0.5 : R() * 6.28, hy: y + (R() - 0.5) * dy });
  ctx.anims.push((dt, t) => {
    let k = 0;
    const put = (lx, ly, lz, x, yy, z, c, s) => { pos[k++] = x + lx * c + lz * s; pos[k++] = yy + ly; pos[k++] = z - lx * s + lz * c; };
    flock.forEach((f, i) => {
      const a = f.ph + t * f.sp * (i % 2 ? 1 : -1), x = p.x + Math.cos(a) * f.rad + (kind === 'swallows' ? Math.sin(t * 2.1 + f.ph) * 6 : 0), z = p.z + Math.sin(a) * f.rad * 0.7;
      const yy = f.hy + Math.sin(t * 0.4 + f.ph) * 3, ry = -a + (i % 2 ? 0 : Math.PI), c = Math.cos(ry), s = Math.sin(ry);
      const flap = kind === 'kestrels' ? (Math.sin(t * 1.3 + f.ph) > 0.6 ? Math.sin(t * 16) * 0.6 : 0.12)
        : kind === 'hawk' ? 0.08 + (Math.sin(t * 0.21 + f.ph) > 0.93 ? Math.sin(t * 9) * 0.45 : 0)       // soars; a few slow beats now and then
        : kind === 'ravens' ? (Math.sin(t * 0.7 + f.ph) > 0.2 ? Math.sin(t * 8 + f.ph) * 0.6 : 0.1)
        : Math.sin(t * 22 + f.ph) * 0.8;
      for (let j = 0; j < body.length; j += 3) put(body[j], body[j + 1], body[j + 2], x, yy, z, c, s);
      const fc = Math.cos(flap), fs = Math.sin(flap);
      for (const m of [1, -1]) for (let j = 0; j < 9; j += 3) { const wx = wing[j] * m; put(wx * fc, wing[j] * fs, wing[j + 2], x, yy, z, c, s); } // each wing rises about the body's axis
    });
    geo.attributes.position.needsUpdate = true;
  });
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

// Ancestral Puebloan cliff dwellings in an alcove: a dark arched recess in the wall at height p.y, a ledge,
// stone rooms with T-shaped doors, a round tower, a ladder. rot: the way it faces, out of the wall. Scenery.
function dwellings(p, T, ctx) {
  const fx = Math.sin(p.rot), fz = Math.cos(p.rot), rx = Math.cos(p.rot), rz = -Math.sin(p.rot), W = p.w || 30, H = p.h || 13;
  // find the wall's face at this height: walk in from the open air until the ground stands above it
  let fxp = p.x + fx * 30, fzp = p.z + fz * 30;
  for (let d = 30; d > -40; d -= 0.5) { const x = p.x + fx * d, z = p.z + fz * d, g = T.groundAt(x, z); if (g !== null && g > p.y + H) { fxp = x + fx * 0.6; fzp = z + fz * 0.6; break; } }
  const g = new THREE.Group(); g.position.set(fxp, p.y, fzp); g.rotation.y = p.rot; ctx.group.add(g);
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
  // the alcove: a dark arched recess (the wall can't be cut, so its shadowed back is laid just proud of the
  // face), the overhang's lip around it, and the ledge the rooms stand on
  const back = new THREE.Mesh(new THREE.CircleGeometry(1, 28, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x24140d, roughness: 1 }));
  back.scale.set(W / 2, H, 1); back.position.z = 1.0; g.add(back);
  const lip = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.06, 28, 1, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7a3c22, roughness: 1, side: THREE.DoubleSide }));
  lip.scale.set(W / 2 + 1, H + 1, 1); lip.position.z = 1.15; g.add(lip);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 1.4, 7), M(0x9a5a3a)); ledge.position.set(0, -0.7, 3.5); g.add(ledge);
  // rooms: dry-laid stone in the rock's own colours, one to three storeys, T doors and little windows
  const R = rng(Math.round(p.x * 3 + p.z)), stone = [0xb98a64, 0xa87a58, 0xc49a74], dark = M(0x1c120c);
  for (let i = 0, x = -W * 0.4; x < W * 0.38 && i < 9; i++) {
    const w = 2.6 + R() * 2.6, d = 2.8 + R() * 1.8, h = (1 + Math.floor(R() * (Math.abs(x) < W * 0.2 ? 3 : 2))) * 2.4, bk = 2.6 + R() * 2.4;
    if (R() < 0.18 && i > 1) { // the round tower
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2, h + 1.8, 12), M(stone[0])); tw.position.set(x + 1.8, (h + 1.8) / 2, bk + 0.5); g.add(tw);
      x += 4.2; continue;
    }
    const rm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(stone[Math.floor(R() * 3)])); rm.position.set(x + w / 2, h / 2, bk - d / 2); g.add(rm);
    for (let f = 0; f < h / 2.4; f++) {
      const dx = x + w * (0.3 + R() * 0.4), dy = f * 2.4, fz2 = bk + 0.02;
      if (R() < 0.6) { const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.1), dark), t2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.1), dark);
        t1.position.set(dx, dy + 1.45, fz2); t2.position.set(dx, dy + 0.75, fz2); g.add(t1, t2); }           // a T-shaped door
      else { const wnd = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.1), dark); wnd.position.set(dx, dy + 1.4, fz2); g.add(wnd); }
    }
    x += w + 0.2 + R() * 0.6;
  }
  // a ladder up to the ledge from the talus below
  const lad = M(0x5a4030), lx = W * 0.2;
  for (const s of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7, 5), lad); r.position.set(lx + s, -3.6, 7.6); r.rotation.x = 0.25; g.add(r); }
  for (let k = 0; k < 9; k++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4), lad); r.rotation.z = Math.PI / 2; r.position.set(lx, -6.8 + k * 0.75, 7.6 - (k - 4) * 0.19); g.add(r); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}

// a chuckwalla on a warm rock beside the Lizard tees: it does push-ups now and then (scenery)
function lizard(hole, T, ctx) {
  const tee = hole.tees && hole.tees.lizard; if (!tee) return;
  const pin = hole.pin || (hole.green && hole.green.pins && hole.green.pins[0]) || [0, -100], L = hole.line ? hole.line[1] : pin;
  const dx = L[0] - tee[0], dz = L[1] - tee[1], l = Math.hypot(dx, dz) || 1, sx = -dz / l, sz = dx / l;
  let x = tee[0] + sx * 7, z = tee[1] + sz * 7, y = T.groundAt(x, z);
  if (y === null) { x = tee[0] - sx * 7; z = tee[1] - sz * 7; y = T.groundAt(x, z); } if (y === null) return;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = Math.atan2(sx, sz) + 0.6; ctx.group.add(g);
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xa8603c, roughness: 1, flatShading: true }));
  rock.scale.set(1.3, 0.45, 1); rock.position.y = 0.2; g.add(rock);
  const body = new THREE.Group(); body.position.y = 0.62; g.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 }), tail = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6), skin); torso.scale.set(1, 0.55, 2); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin); head.scale.set(1, 0.7, 1.3); head.position.set(0, 0.04, 0.38); body.add(head);
  const tl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 6), tail); tl.rotation.x = -Math.PI / 2; tl.position.z = -0.6; body.add(tl);
  for (const [lx, lz] of [[-0.15, 0.18], [0.15, 0.18], [-0.15, -0.18], [0.15, -0.18]]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.14, 4), skin); leg.position.set(lx, -0.07, lz); leg.rotation.z = lx > 0 ? -0.7 : 0.7; body.add(leg); }
  ctx.anims.push((dt, t) => { const u = (t % 7) / 7, up = u > 0.8 ? Math.max(0, Math.sin((u - 0.8) / 0.2 * Math.PI * 3)) : 0; body.position.y = 0.62 + up * 0.07; head.rotation.y = Math.sin(t * 0.4) * 0.4; });
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
export function buildProps(hole, T, tee, mat, group, { glyphs = true, life = false } = {}) {
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
    else if (p.type === 'waterfall') waterfall(p, T, ctx);
    else if (p.type === 'dwellings') dwellings(p, T, ctx);
  }
  if (life) { // Red Mesa: a pair of ravens and a hawk over every hole, a lizard by the Lizard tees
    const L = hole.line || [tee, hole.pin || [0, -150]], m = L[Math.floor(L.length / 2)], g = T.groundAt(m[0], m[1]) ?? 0;
    if (life === 'sky') { birds({ x: m[0] + 60, z: m[1] }, g + 25, ctx, 'swallows'); birds({ x: m[0] - 40, z: m[1] - 60 }, g + 70, ctx, 'hawk'); } // swifts and an eagle
    else { birds({ x: m[0] + 30, z: m[1] }, g + 38, ctx, 'ravens'); birds({ x: m[0] - 20, z: m[1] - 40 }, g + 85, ctx, 'hawk'); lizard(hole, T, ctx); }
  }
  for (const I of T.ISL) if (I.rail) railing(I, T, ctx);
  if (glyphs) petroglyph(hole, T, hole.tees[Object.keys(hole.tees)[0]], ctx);
  return ctx;
}

/* ---------- the playing surface ---------- */
// One mesh over the hole's box, sampled from the shaped ground: 24 m tiles, fine (under a metre) where a
// green, bunker, tee or pond is, coarser elsewhere, with short skirts so tiles of different sizes meet
// without cracks. Cells that span a cliff are left to the island walls.
// which level a point's ground belongs to: the island whose top it is, 'F' for the canyon floor, null over open air
function levelAt(T, x, z) {
  const t = T.topAt(x, z), fl = T.floorAt(x, z);
  if (t && (fl === null || t.h >= fl)) return t.I;
  return fl !== null ? 'F' : null;
}
// A tile with a cliff in it (two levels side by side, more than 2.5 m apart): the cliff cells used to be
// dropped, leaving a saw-toothed gap along the rim. Instead each piece of ground (split only by cliffs) gets its
// own copy of the tile: points off the piece move onto its outline (the nearest edge point along the grid's eight directions, found
// by bisection), take this level's ground there, and the cells are drawn up to that edge.
function splitLevels(T, tx, tz, n, step, H, pos, nrm, idx) {
  const N1 = n + 1, LV = H.map((y, k) => (y === null ? null : levelAt(T, tx + (k % N1) * step, tz + Math.floor(k / N1) * step)));
  let split = false;
  for (let j = 0; j <= n && !split; j++) for (let i = 0; i <= n && !split; i++) {
    const k = j * N1 + i; if (LV[k] === null) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || ii > n || jj > n) continue;
      const q = jj * N1 + ii; if (LV[q] !== null && LV[q] !== LV[k] && Math.abs(H[q] - H[k]) > 2.5) { split = true; break; }
    }
  }
  if (!split) return false;
  // pieces: points joined without a cliff between them (the same island, or two islands meeting at about the
  // same height, like a ramp running onto a tier), so only real cliffs split the tile
  const up = H.map((_, k) => k), find = k => { while (up[k] !== k) k = up[k] = up[up[k]]; return k; };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const k = j * N1 + i; if (LV[k] === null) continue;
    for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const ii = i + di, jj = j + dj; if (ii < 0 || ii > n || jj > n) continue;
      const q = jj * N1 + ii; if (LV[q] === null) continue;
      if (LV[q] === LV[k] || Math.abs(H[q] - H[k]) <= 2.5) up[find(q)] = find(k);
    }
  }
  const CP = LV.map((v, k) => (v === null ? null : find(k))), pieces = new Map();
  CP.forEach((c, k) => { if (c !== null) { if (!pieces.has(c)) pieces.set(c, new Set()); pieces.get(c).add(LV[k]); } });
  if (pieces.size < 2) return false;
  pos.length -= H.length * 3; // the caller already pushed the tile's grid points: take them back out
  for (const [C, labels] of pieces) {
    const on = (x, z) => labels.has(levelAt(T, x, z)) && T.groundAt(x, z) !== null;
    const inC = k => CP[k] === C;
    const HL = H.map((y, k) => (inC(k) ? y : null)), P = [], In = new Uint8Array(H.length);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * N1 + i, x = tx + i * step, z = tz + j * step; P.push(x, HL[k] ?? 0, z);
      if (inC(k)) continue;
      let best = null;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const ii = i + di, jj = j + dj, nx2 = tx + ii * step, nz2 = tz + jj * step;
        const inL = ii >= 0 && ii <= n && jj >= 0 && jj <= n ? inC(jj * N1 + ii) : on(nx2, nz2); if (!inL) continue;
        let lo = 0, hi = 1; // lo: off this level (this point), hi: on it (the neighbour)
        for (let s = 0; s < 10; s++) { const m = (lo + hi) / 2; if (on(x + (nx2 - x) * m, z + (nz2 - z) * m)) hi = m; else lo = m; }
        if (!best || hi < best.t) best = { t: hi, x: x + (nx2 - x) * hi, z: z + (nz2 - z) * hi };
      }
      if (!best) continue;
      const g = T.groundAt(best.x, best.z); if (g === null) continue;
      HL[k] = g; In[k] = 1; P[k * 3] = best.x; P[k * 3 + 1] = g; P[k * 3 + 2] = best.z;
    }
    const base = pos.length / 3; pos.push(...P);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const y = HL[j * N1 + i]; if (y === null) { nrm.push(0, 1, 0); continue; }
      const at = (ii, jj) => { let v; if (ii >= 0 && ii <= n && jj >= 0 && jj <= n) v = HL[jj * N1 + ii]; else { const x = tx + ii * step, z = tz + jj * step; v = on(x, z) ? T.groundAt(x, z) : null; } return v ?? y; };
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step), gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step), Ln = Math.hypot(gx, 1, gz);
      nrm.push(-gx / Ln, 1 / Ln, -gz / Ln);
    }
    const ok = (...k) => { let lo = Infinity, hi = -Infinity; for (const q of k) { const y = HL[q]; if (y === null) return false; lo = Math.min(lo, y); hi = Math.max(hi, y); } return hi - lo < Math.max(2.5, step * 0.9); };
    const tri = (a, b, c) => {
      if (!ok(a, b, c) || (In[a] && In[b] && In[c])) return;
      idx.push(base + a, base + b, base + c);
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * N1 + i, b = a + 1, c = a + N1, d = c + 1;
      tri(a, c, b); tri(b, c, d);
    }
    // skirts down the tile's four edges (as the caller does for a whole tile)
    const edge = [];
    for (let i = 0; i <= n; i++) edge.push(i);
    for (let j = 1; j <= n; j++) edge.push(j * N1 + n);
    for (let i = n - 1; i >= 0; i--) edge.push(n * N1 + i);
    for (let j = n - 1; j >= 1; j--) edge.push(j * N1);
    edge.push(0);
    for (let k = 0; k < edge.length - 1; k++) {
      const p = edge[k], q = edge[k + 1]; if (HL[p] === null || HL[q] === null || Math.abs(HL[p] - HL[q]) > 2.5) continue;
      const s0 = pos.length / 3; pos.push(P[p * 3], HL[p] - 0.35, P[p * 3 + 2], P[q * 3], HL[q] - 0.35, P[q * 3 + 2]);
      nrm.push(...nrm.slice((base + p) * 3, (base + p) * 3 + 3), ...nrm.slice((base + q) * 3, (base + q) * 3 + 3));
      idx.push(base + p, base + q, s0, base + q, s0 + 1, s0);
    }
  }
  return true;
}

export function buildPlayfield(T, box, mat, coarse, group, { steepFine = false, snapEdges = false, levels = false, keepSteep = false } = {}) {
  const FT = T.features, TILE = 24, fine = coarse ? 1 : 0.7, mid = coarse ? 3 : 2.2;
  const busy = [...FT.greens, ...FT.bunkers, ...FT.tees, ...FT.water, ...FT.rockfalls];
  // (caves: banks with no island wall to cover a dropped cell)
  const pos = [], idx = [], nrm = [];
  for (let tz = box.z0; tz < box.z1; tz += TILE) for (let tx = box.x0; tx < box.x1; tx += TILE) {
    // fine where a feature is, and wherever the ground is steep (banks down to water, rimstone steps): a
    // coarse tile there drops its tall cells and leaves jagged holes
    const steep = () => { const S = 4, m = TILE / S; let prev = null;
      for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) {
        const y = T.groundAt(tx + i * S, tz + j * S), l = i ? prev : null, u = j ? T.groundAt(tx + i * S, tz + (j - 1) * S) : null; prev = y;
        if (y !== null && ((l !== null && Math.abs(y - l) > 2.2) || (u !== null && Math.abs(y - u) > 2.2))) return true;
      } return false; };
    const hot = busy.some(F => F.x + F.bound > tx && F.x - F.bound < tx + TILE && F.z + F.bound > tz && F.z - F.bound < tz + TILE) || (steepFine && steep());
    const n = Math.max(2, Math.round(TILE / (hot ? fine : mid))), step = TILE / n, base = pos.length / 3, H = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = tx + i * step, z = tz + j * step, y = T.groundAt(x, z);
      H.push(y); pos.push(x, y ?? 0, z);
    }
    // levels (Red Mesa): where the ground drops a cliff from one island to another or to the canyon floor, each
    // level is drawn on its own and ends on its island's outline, where the cliff wall meets it
    if (levels && splitLevels(T, tx, tz, n, step, H, pos, nrm, idx)) continue;
    // snapEdges (caves): a point over open air (a chasm) next to ground moves onto the edge, so the ground ends
    // on the chasm's own outline rather than in a staircase of whole cells (the chasm wall meets it there)
    const In = snapEdges ? new Uint8Array(H.length) : null;
    if (snapEdges) for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = j * (n + 1) + i; if (H[k] !== null) continue;
      const x = tx + i * step, z = tz + j * step; let best = null;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const ii = i + di, jj = j + dj, nx2 = tx + ii * step, nz2 = tz + jj * step;
        const g = ii >= 0 && ii <= n && jj >= 0 && jj <= n ? H[jj * (n + 1) + ii] : T.groundAt(nx2, nz2); if (g === null) continue;
        let lo = 0, hi = 1; // lo: open air (this point), hi: ground (the neighbour)
        for (let q = 0; q < 10; q++) { const m = (lo + hi) / 2; if (T.groundAt(x + (nx2 - x) * m, z + (nz2 - z) * m) === null) lo = m; else hi = m; }
        if (!best || hi < best.t) best = { t: hi, x: x + (nx2 - x) * hi, z: z + (nz2 - z) * hi };
      }
      if (!best) continue;
      const g = T.groundAt(best.x, best.z); if (g === null) continue;
      H[k] = g; pos[(base + k) * 3] = best.x; pos[(base + k) * 3 + 1] = g; pos[(base + k) * 3 + 2] = best.z; In[k] = 1;
    }
    // normals from the ground's slope (neighbours past the tile's edge sampled directly), so tiles
    // light the same along their seams
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const y = H[j * (n + 1) + i]; if (y === null) { nrm.push(0, 1, 0); continue; }
      const x = tx + i * step, z = tz + j * step;
      const at = (ii, jj) => { const v = ii >= 0 && ii <= n && jj >= 0 && jj <= n ? H[jj * (n + 1) + ii] : T.groundAt(tx + ii * step, tz + jj * step); return v ?? y; };
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step), gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step), L = Math.hypot(gx, 1, gz);
      nrm.push(-gx / L, 1 / L, -gz / L);
    }
    // a cell across a cliff is dropped (Red Mesa's walls stand there); keepSteep (the city: no walls) draws it as a bank
    const ok = (...k) => { let lo = Infinity, hi = -Infinity; for (const q of k) { const y = H[q]; if (y === null) return false; lo = Math.min(lo, y); hi = Math.max(hi, y); } return keepSteep || hi - lo < Math.max(2.5, step * 0.9); };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      if (ok(a, b, c) && !(In && In[a] && In[b] && In[c])) idx.push(base + a, base + c, base + b);
      if (ok(b, c, d) && !(In && In[b] && In[c] && In[d])) idx.push(base + b, base + c, base + d);
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
      nrm.push(...nrm.slice((base + p) * 3, (base + p) * 3 + 3), ...nrm.slice((base + q) * 3, (base + q) * 3 + 3));
      idx.push(base + p, base + q, s0, base + q, s0 + 1, s0); // facing out, toward any crack
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); rockAttrs(geo, 0);
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.userData.island = { playable: true, floor: true };
  group.add(m);
  return m;
}

/* ---------- ponds and rivers ---------- */
export function buildWater(T, group) {
  for (const V of T.features.rivers || []) { // a ribbon at the river's level, a little wider than the water
    const L = V.line, pos = [], idx = [], hw = V.hw + 0.8;
    for (let i = 0; i < L.length; i++) {
      const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      pos.push(L[i][0] - dz / l * hw, V.level, L[i][1] + dx / l * hw, L[i][0] + dz / l * hw, V.level, L[i][1] - dx / l * hw);
      if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, riverMat); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  }
  for (const W of T.features.water) {
    const g = new THREE.CircleGeometry(1, 64); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, waterMat);
    m.scale.set(W.rx * 1.45, 1, W.rz * 1.45); m.rotation.y = -W.rot; m.position.set(W.x, W.level, W.z);
    m.receiveShadow = true; m.renderOrder = 1; m.userData.pond = W; group.add(m);
  }
}
