// Cavern scenery for underground courses (global THREE): the roof and walls built from the same shape the
// physics hits (cave.js ceilingAt), openings to the sky with their shafts of sunlight, stalactites,
// lanterns, crystals, a glowworm ceiling, giant mushrooms, waterfalls, ferns and the old mine's timbers,
// rails and trestle. The play is lit (lanterns, the sun through the roof, a light on every green); the rest
// stays dark. buildCave() returns { anims, lights } for the course renderer.
import { rng, fbm } from './noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f675c, roughness: 1, metalness: 0, side: THREE.DoubleSide, vertexColors: true });
const timberMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.9 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 0.6, metalness: 0.5 });
const fallTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d'), R = rng(91);
  g.fillStyle = 'rgba(210,228,236,0.5)'; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 170; i++) { const x = R() * 64, y = R() * 256, l = 20 + R() * 70; g.fillStyle = `rgba(255,255,255,${0.25 + R() * 0.6})`; g.fillRect(x, y, 1 + R() * 2.5, l); g.fillRect(x, y - 256, 1 + R() * 2.5, l); }
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; return t;
})();
const glowTex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
})();
const glow = (color, size, opacity = 0.9) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.scale.set(size, size, 1); return s; };
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
// rock shapes, each with a white colour attribute (rockMat takes vertex colours) for instancing
const withColor = g => { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
function lumpy(detail, seed, amt) { // a faceted boulder
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + amt * (fbm(x * 1.7 + seed, z * 1.7 + y * 1.3 - seed) - 0.5) * 2; p.setXYZ(i, x * k, y * k * 0.8, z * k); }
  g.computeVertexNormals(); return withColor(g);
}
const lathe = (n, seg, f) => withColor(new THREE.LatheGeometry(Array.from({ length: n + 1 }, (_, i) => new THREE.Vector2(Math.max(0.02, f(i / n)), i / n)), seg));
const stalGeo = lathe(14, 8, t => Math.pow(t, 1.25) * (1 + 0.12 * Math.sin(t * 23))); // tip at y=0, base (radius 1) at y=1
const flowGeo = lathe(18, 9, t => 0.4 + 0.8 * Math.pow(1 - t, 3) + 0.55 * Math.pow(t, 5) + 0.07 * Math.sin(t * 31)); // flowstone, floor (y=0) to roof (y=1)
const crystalGeo = withColor(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0.02), new THREE.Vector2(0.5, 0.74), new THREE.Vector2(0, 1)], 6));
const UP = new THREE.Vector3(0, 1, 0);
function instances(geo, mat, list, tint) { // list: [{ p, q, s, c }]
  const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4(), c = new THREE.Color();
  list.forEach((o, i) => { m4.compose(o.p, o.q, o.s); im.setMatrixAt(i, m4); if (tint) { c.setScalar(o.c ?? 1); im.setColorAt(i, c); } });
  im.castShadow = false; im.receiveShadow = true; return im;
}
function beam(a, b, w, mat) { // a timber from a to b
  const d = b.clone().sub(a), m = box(w, w, d.length(), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.lookAt(b); m.castShadow = true; return m;
}

export function buildCave(h, T, box0, { group, coarse, sunDir }) {
  const C = T.cave, R = rng(h.par * 7919 + (h.yards?.eagle || 1));
  const ctx = { anims: [], lights: [] };
  const gy = (x, z) => T.groundAt(x, z) ?? (T.floor ? T.floor.y : 0);
  const pin = h.pinPos;

  /* ---------- the roof and walls: one sheet over every hall in reach ---------- */
  const reach = 1100, cx = (box0.x0 + box0.x1) / 2, cz = (box0.z0 + box0.z1) / 2;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const H of C.halls) {
    const pts = H.e ? [[H.e[0] - Math.max(H.rx, H.rz), H.e[1] - Math.max(H.rx, H.rz)], [H.e[0] + Math.max(H.rx, H.rz), H.e[1] + Math.max(H.rx, H.rz)]] : [H.a, H.b].flatMap(p => [[p[0] - H.w / 2, p[1] - H.w / 2], [p[0] + H.w / 2, p[1] + H.w / 2]]);
    for (const [x, z] of pts) { if (Math.hypot(x - cx, z - cz) > reach + 500) continue; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  }
  x0 -= 20; x1 += 20; z0 -= 20; z1 += 20;
  const step = coarse ? 7 : 5, nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3), col = new Float32Array((nx + 1) * (nz + 1) * 3), Y = new Float32Array((nx + 1) * (nz + 1));
  let low = Infinity; for (const H of C.halls) low = Math.min(low, H.foot);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + i * step, z = z0 + j * step, k = j * (nx + 1) + i;
    let y = C.ceilingAt(x, z); if (y === null) y = NaN;
    else y -= 3.2 * fbm(x / 8 + 5, z / 8 - 3) + 1.4 * fbm(x / 3, z / 3); // knobbly rock, hanging a little below the solid shape
    Y[k] = y; pos.set([x, Number.isNaN(y) ? 0 : y, z], k * 3);
    // flowstone streaks and damp, darker rock higher up
    const n = fbm(x / 26, z / 26 + (Number.isNaN(y) ? 0 : y) / 40), f = fbm(x / 6 + 9, z / 6), v = (0.35 + 0.65 * n) * (0.75 + 0.5 * f);
    col.set([v * 0.95, v * 0.9, v * 0.82], k * 3);
  }
  const idx = [];
  const ok = k => !Number.isNaN(Y[k]);
  const buried = k => Y[k] < low - 5;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    if (!(ok(a) && ok(b) && ok(c) && ok(d))) continue;
    if (buried(a) && buried(b) && buried(c) && buried(d)) continue;
    idx.push(a, b, c, b, d, c); // wound to face down, into the cave
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const roof = new THREE.Mesh(geo, rockMat); roof.receiveShadow = true; group.add(roof);

  /* ---------- the foot of the walls: rubble, fallen blocks and flowstone, so no wall meets the floor clean ---------- */
  const bx0 = box0.x0 - 160, bx1 = box0.x1 + 160, bz0 = box0.z0 - 160, bz1 = box0.z1 + 160;
  const PLAY = new Set(['green', 'fringe', 'fairway', 'tee', 'sand', 'water']);
  const rubble = [], blocks = [], flows = [], q0 = new THREE.Quaternion(), eul = new THREE.Euler();
  const wantR = coarse ? 900 : 1700, wantB = coarse ? 110 : 180, wantF = coarse ? 45 : 80;
  for (let t = 0; t < 40000 && (rubble.length < wantR || blocks.length < wantB || flows.length < wantF); t++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0), d = C.wallDepth(x, z);
    if (d < -5 || d > 10) continue;
    const g = T.groundAt(x, z); if (g === null || PLAY.has(T.surfaceAt(x, z))) continue;
    const rot = q0.clone().setFromEuler(eul.set((R() - 0.5) * 0.6, R() * 6.3, (R() - 0.5) * 0.6));
    if (d > -1 && rubble.length < wantR && R() < Math.pow(1 - Math.max(0, d) / 10, 1.6)) {
      const k = 0.35 + R() * R() * 1.6; rubble.push({ p: V(x, g - k * 0.25, z), q: rot, s: V(k * (0.8 + R() * 0.6), k, k * (0.8 + R() * 0.6)), c: 0.55 + R() * 0.4 });
    } else if (d < 3 && blocks.length < wantB && R() < 0.35) {
      const k = 2 + R() * R() * 6; blocks.push({ p: V(x, g + k * 0.15, z), q: rot, s: V(k * (0.9 + R() * 0.7), k * (0.6 + R() * 0.5), k * (0.9 + R() * 0.5)), c: 0.5 + R() * 0.35 });
    } else if (d > 0.5 && d < 4 && flows.length < wantF && R() < 0.25) {
      const top = C.ceilingAt(x, z); if (top === null || top - g < 8) continue;
      const w = 2.5 + R() * 5; flows.push({ p: V(x, g - 0.6, z), q: q0.clone().setFromEuler(eul.set(0, R() * 6.3, 0)), s: V(w, top - g + 4, w * (0.55 + R() * 0.3)), c: 0.62 + R() * 0.3 });
    }
  }
  const flowMat = new THREE.MeshStandardMaterial({ color: 0x9a8b76, roughness: 0.75, metalness: 0, vertexColors: true });
  if (rubble.length) group.add(instances(lumpy(1, 3.1, 0.35), rockMat, rubble, true));
  if (blocks.length) group.add(instances(lumpy(1, 7.7, 0.45), rockMat, blocks, true));
  if (flows.length) group.add(instances(flowGeo, flowMat, flows, true));

  /* ---------- openings to the sky: a shaft up through the rock, daylight above, a beam down ---------- */
  const sd = (sunDir && sunDir.y > 0.2 ? sunDir.clone() : V(0.25, 1, 0.15)).normalize();
  for (const S of C.sky) {
    if (Math.hypot(S.x - cx, S.z - cz) > reach + 400) continue;
    let rim = -Infinity; for (let a = 0; a < 16; a++) { const y = C.ceilingAt(S.x + Math.cos(a / 16 * 6.283) * (S.r + 4), S.z + Math.sin(a / 16 * 6.283) * (S.r + 4)); if (y !== null) rim = Math.max(rim, y); }
    if (rim === -Infinity) rim = 40;
    S.rim = rim;
    const U = S.upper, shaftH = U ? U.h : S.r > 40 ? 26 : 34, top = rim + shaftH, open = U ? U.sky : S.r;
    if (U) {
      // a second cavern above the opening: its floor runs out from the lip, the walls rise and close over
      // to its own skylight. The falls pour off the lip into the cavern below.
      const P = [[S.r * 0.98, rim - 4], [S.r * 1.04, rim + 0.5], [U.r * 0.6, rim + 2.5], [U.r * 0.92, rim + 5], [U.r, rim + U.h * 0.25], [U.r * 0.96, rim + U.h * 0.55], [U.r * 0.72, rim + U.h * 0.86], [U.sky * 1.8, rim + U.h * 0.98], [U.sky, rim + U.h + 2], [U.sky * 1.05, rim + U.h + 10]];
      const ug = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 56), up = ug.attributes.position;
      for (let k = 0; k < up.count; k++) { const x = up.getX(k), y = up.getY(k), z = up.getZ(k), rr = Math.hypot(x, z) || 1; if (rr < S.r * 1.1 || y > rim + U.h) continue;
        const f = 1 + 0.16 * (fbm(x / 22 + 4, z / 22 + y / 30) - 0.5) + 0.06 * (fbm(x / 6, z / 6 - y / 8) - 0.5); up.setXYZ(k, x * f, y + 3 * (fbm(x / 15, z / 15) - 0.5), z * f); }
      ug.computeVertexNormals(); withColor(ug);
      const cc = ug.attributes.color; for (let k = 0; k < cc.count; k++) { const v = 0.45 + 0.4 * fbm(up.getX(k) / 18, up.getZ(k) / 18 + up.getY(k) / 25); cc.setXYZ(k, v * 0.95, v * 0.9, v * 0.82); }
      const um = new THREE.Mesh(ug, rockMat); um.position.set(S.x, 0, S.z); um.receiveShadow = true; group.add(um);
      const B = new THREE.PointLight(0xe9e0cc, 1.0, U.r * 2.6, 1.1); B.position.set(S.x, rim + U.h * 0.45, S.z); group.add(B); ctx.lights.push(B);
    } else {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(S.r * 1.15, S.r, shaftH + 6, 40, 4, true), rockMat); sh.position.set(S.x, rim + shaftH / 2 - 3, S.z); group.add(sh);
    }
    const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(open * 1.2, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9f3ff, fog: false }));
    skyDisc.position.set(S.x, top + (U ? 9 : 3), S.z); group.add(skyDisc);
    // the beam, leaning with the sun, down to the ground
    const g0 = gy(S.x, S.z), H = top - g0, lean = V(-sd.x / sd.y, 0, -sd.z / sd.y).multiplyScalar(H * 0.35);
    const bg = new THREE.CylinderGeometry(open * 0.95, open * 1.05 + (S.r - open) * 0.5, H, 32, 1, true); bg.translate(0, -H / 2, 0);
    const bp = bg.attributes.position; for (let q = 0; q < bp.count; q++) { const t = -bp.getY(q) / H; bp.setX(q, bp.getX(q) + lean.x * t); bp.setZ(q, bp.getZ(q) + lean.z * t); }
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0cf, transparent: true, opacity: S.r > 40 ? 0.035 : 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const bm = new THREE.Mesh(bg, beamMat); bm.position.set(S.x, top, S.z); bm.renderOrder = 3; group.add(bm);
    // the pool of light where it lands
    const L = new THREE.SpotLight(0xfff1d4, S.r > 40 ? 2.4 : 3.2, H * 1.8, Math.min(1.1, Math.atan((S.r * 1.25) / H)), 0.45, 1);
    L.position.set(S.x, top, S.z); L.target.position.set(S.x + lean.x, g0, S.z + lean.z); group.add(L, L.target); ctx.lights.push(L);
    // a big opening fills its cavern with soft bounced daylight
    if (S.r > 30) { const B = new THREE.PointLight(0xe8e2d4, 1.1, 1100, 0.9); B.position.set(S.x + lean.x, g0 + 30, S.z + lean.z); group.add(B); ctx.lights.push(B); }
  }

  /* ---------- stalactites: the solid ones (cave.js), then a scatter over the roof ---------- */
  // they grow in clusters: one long one with shorter ones round it, and drapes along the walls
  const list = [];
  const hangAt = (x, z, len, r, keep = 0) => { // a stalactite hanging len below the roof at x, z (keep: m clear above the ground)
    const y = C.ceilingAt(x, z); if (y === null) return;
    const g = gy(x, z), L = keep ? Math.min(len, y - g - keep) : len; if (L < 0.8) return;
    list.push([x, y - L, z, r, L + 2]);
  };
  const cluster = (x, z, len, r, n, spread, keep) => {
    hangAt(x, z, len, r, keep);
    for (let k = 0; k < n; k++) { const a = R() * 6.28, d = spread * (0.3 + R() * 0.7), f = 0.15 + R() * R() * 0.6; hangAt(x + Math.cos(a) * d, z + Math.sin(a) * d, len * f, Math.max(0.3, r * (0.25 + f * 0.6)), keep); }
  };
  for (const S of C.stalactites) {
    const base = C.ceilingAt(S.x, S.z) ?? S.y + 10; list.push([S.x, S.y, S.z, S.r, base - S.y + 2]);
    for (let k = 0; k < 10; k++) { const a = R() * 6.28, d = S.r * (0.8 + R() * 1.6), f = 0.12 + R() * 0.3; hangAt(S.x + Math.cos(a) * d, S.z + Math.sin(a) * d, (base - S.y) * f, S.r * (0.15 + f * 0.5)); }
  }
  for (const M of C.marks) if (M.type === 'hang') for (const [x, z, len, r] of M.pts) cluster(x, z, len, r, 14, r * 4.5, 18);
  const want = coarse ? 420 : 760;
  for (let t = 0; t < want * 8 && list.length < want; t++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0), y = C.ceilingAt(x, z);
    if (y === null || Math.hypot(x - cx, z - cz) > reach) continue;
    const d = C.wallDepth(x, z); if (d < 1) continue;
    const g = gy(x, z); if (y - g < 16) continue;
    const near = d < 16, len = (near ? 1.5 : 2) + R() * R() * Math.min(near ? 9 : 20, (y - g) * 0.25);
    cluster(x, z, len, 0.35 + len * 0.13, near ? 3 + Math.floor(R() * 5) : 2 + Math.floor(R() * 4), near ? 3 : 5, 14);
  }
  group.add(instances(stalGeo, rockMat, list.map(([x, y, z, r, l]) => ({ p: V(x, y, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), s: V(r, l, r), c: 0.6 + R() * 0.35 })), true));

  /* ---------- the marks ---------- */
  const lanterns = [];
  for (const M of C.marks) {
    const far = M.distant;
    if (M.type === 'lanterns') for (const [x, z] of M.pts) {
      const y = gy(x, z);
      group.add(beam(V(x, y - 0.5, z), V(x, y + 3.6, z), 0.22, timberMat), beam(V(x, y + 3.4, z), V(x + 0.9, y + 3.4, z), 0.16, timberMat));
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc46b })); lamp.position.set(x + 0.9, y + 3.0, z); group.add(lamp);
      const gl = glow(0xffa94d, 5); gl.position.copy(lamp.position); group.add(gl);
      lanterns.push(lamp.position.clone());
    }
    else if (M.type === 'crystals') for (const [x, z] of M.pts) {
      const y = gy(x, z), n = 5 + Math.floor(R() * 6), hue = R() < 0.6 ? 0x9b6bff : 0x5fd8ff;
      const mat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88 });
      for (let k = 0; k < n; k++) {
        const L = 2 + R() * 6, cr = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.5 + L * 0.12, L, 6, 1), mat);
        cr.position.set(x + (R() - 0.5) * 6, y + L * 0.4, z + (R() - 0.5) * 6); cr.rotation.set((R() - 0.5) * 0.9, R() * 6, (R() - 0.5) * 0.9); group.add(cr);
      }
      const gl = glow(hue, 16, 0.5); gl.position.set(x, y + 3, z); group.add(gl);
      if (!far && ctx.lights.length < 10 && R() < 0.5) { const P = new THREE.PointLight(hue, 1.4, 45, 1.5); P.position.set(x, y + 4, z); group.add(P); ctx.lights.push(P); }
    }
    else if (M.type === 'glowworms') {
      const xs = M.poly.map(p => p[0]), zs = M.poly.map(p => p[1]), inPoly = (x, z) => { let s = false; for (let a = 0, b = M.poly.length - 1; a < M.poly.length; b = a++) { const [ax, az] = M.poly[a], [bx, bz] = M.poly[b]; if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) s = !s; } return s; };
      const P = [], B = [], S = [], k1 = M.dense ? (coarse ? 4 : 5) : 1;
      const mx = Math.min(...xs), wx = Math.max(...xs) - mx, mz = Math.min(...zs), wz = Math.max(...zs) - mz;
      for (let k = 0; k < (coarse ? 9000 : 16000) * k1 * 1.5 && P.length < (coarse ? 2500 : 4500) * 3 * k1; k++) {
        const x = mx + R() * wx, z = mz + R() * wz;
        if (!inPoly(x, z)) continue; const y = C.ceilingAt(x, z); if (y === null) continue;
        // thicker in the hollows of the roof, where the air is still
        const yy = y - 0.4 - R() * 1.5; P.push(x, yy, z);
        if (M.dense && R() < 0.12) B.push(x, yy - 0.3, z);
        if (M.dense && R() < 0.25) S.push(x, yy, z, x, yy - 0.6 - R() * R() * 5, z); // the silk threads they hang
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8ff5e3, size: (coarse ? 2.2 : 1.7) * (M.dense ? 1.2 : 1), sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
      if (M.dense && !far) {
        const gb = new THREE.BufferGeometry(); gb.setAttribute('position', new THREE.Float32BufferAttribute(B, 3));
        const bright = new THREE.Points(gb, new THREE.PointsMaterial({ color: 0x6ff0dc, map: glowTex, size: 5, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
        group.add(bright);
        const gs = new THREE.BufferGeometry(); gs.setAttribute('position', new THREE.Float32BufferAttribute(S, 3));
        group.add(new THREE.LineSegments(gs, new THREE.LineBasicMaterial({ color: 0x7fe9d8, transparent: true, opacity: 0.22, fog: false, depthWrite: false })));
        // the ceiling's own glow, cyan on the rock and the floor below
        const cxp = xs.reduce((a, b) => a + b) / xs.length, czp = zs.reduce((a, b) => a + b) / zs.length;
        for (const [ox, oz] of [[0, 0], [-0.3, 0.25], [0.3, -0.25]]) {
          const x = cxp + ox * wx, z = czp + oz * wz, y = C.ceilingAt(x, z); if (y === null) continue;
          const L = new THREE.PointLight(0x4fe6cf, 0.9, 220, 1.2); L.position.set(x, y - 10, z); group.add(L); ctx.lights.push(L);
        }
        let tw = 0; ctx.anims.push(dt => { tw += dt; bright.material.opacity = 0.75 + 0.12 * Math.sin(tw * 0.9); });
      }
    }
    else if (M.type === 'falls') {
      // a sheet along the lip points, from the top down to the floor (or on into the Deep)
      const pts = M.pts.map(([x, z]) => V(x, 0, z)), m0 = pts[Math.floor(pts.length / 2)];
      const lip = C.sky.find(S => S.upper && S.rim !== undefined && Math.hypot(m0.x - S.x, m0.z - S.z) < S.r + 20);
      const top = lip ? lip.rim + 1 : M.top ?? 30;
      const mid = m0, bot = Math.min(gy(mid.x, mid.z), T.floor ? T.floor.y : -60) - (T.inGorge?.(mid.x, mid.z) ? 140 : 0);
      const Hh = top - bot, W = pts.reduce((s, p, k) => s + (k ? p.distanceTo(pts[k - 1]) : 0), 0) || 12;
      const tex = fallTex.clone(); tex.needsUpdate = true; tex.repeat.set(W / 8, Hh / 30);
      const fg = new THREE.PlaneGeometry(1, 1, pts.length * 3, 24), fp = fg.attributes.position;
      for (let k = 0; k < fp.count; k++) {
        const u = fp.getX(k) + 0.5, v = fp.getY(k) + 0.5, f = u * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(f)), t = f - a;
        const p = pts[a].clone().lerp(pts[a + 1], t), drop = (1 - v);
        fp.setXYZ(k, p.x, top - drop * Hh, p.z);
      }
      fg.computeVertexNormals();
      const sheet = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xdfeef3, fog: !far }));
      sheet.renderOrder = 2; group.add(sheet);
      const mist = []; for (let k = 0; k < 7; k++) { const s = glow(0xcfe3ea, W * (1.2 + k * 0.3), 0.18); s.position.set(mid.x + (R() - 0.5) * W, Math.max(bot, gy(mid.x, mid.z)) + 4 + k * 3, mid.z + (R() - 0.5) * W); s.material.blending = THREE.NormalBlending; group.add(s); mist.push(s); }
      ctx.anims.push((dt, t) => { tex.offset.y = t * 0.8; mist.forEach((s, i) => { s.material.opacity = 0.14 + 0.06 * Math.sin(t * 1.7 + i); }); });
    }
    else if (M.type === 'geode') {
      // the broken-open geode behind a green: its shell of rock lined with crystals, all facing in, the open
      // side toward the tee (from)
      const back = Math.atan2(M.z - M.from[1], M.x - M.from[0]), purple = [], cyan = [];
      for (let k = 0; k < (coarse ? 260 : 480); k++) {
        const a = back + (R() - 0.5) * 2 * 1.9, rr = M.r * (0.88 + R() * 0.28), x = M.x + Math.cos(a) * rr, z = M.z + Math.sin(a) * rr;
        const g = gy(x, z), hgt = R() * R() * 30, len = 1.4 + R() * R() * 7;
        const dir = V(M.x - x, (R() - 0.2) * rr * 0.9, M.z - z).normalize();
        const o = { p: V(x, g + hgt - 0.5, z), q: new THREE.Quaternion().setFromUnitVectors(UP, dir), s: V(len * 0.32, len, len * 0.32), c: 0.85 + R() * 0.3 };
        (R() < 0.7 ? purple : cyan).push(o);
      }
      for (const [L, hue] of [[purple, 0x9b6bff], [cyan, 0x5fd8ff]]) {
        const mat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.75, roughness: 0.15, metalness: 0.1, vertexColors: true });
        group.add(instances(crystalGeo, mat, L, true));
      }
      for (let k = 0; k < 5; k++) { const a = back + (k - 2) * 0.6, gl = glow(k % 2 ? 0x5fd8ff : 0x9b6bff, 26, 0.35); gl.position.set(M.x + Math.cos(a) * M.r * 0.9, gy(M.x, M.z) + 8 + R() * 10, M.z + Math.sin(a) * M.r * 0.9); group.add(gl); }
      if (!far) { const P = new THREE.PointLight(0xa57bff, 2.2, 90, 1.3); P.position.set(M.x + Math.cos(back) * M.r * 0.5, gy(M.x, M.z) + 12, M.z + Math.sin(back) * M.r * 0.5); group.add(P); ctx.lights.push(P); }
    }
    else if (M.type === 'adit') {
      // the timber-framed mine entrance, daylight beyond it (it faces down the hole)
      const x = M.x, z = M.z, y = gy(x, z - 6), w = 11, hgt = 8;
      for (const s of [-1, 1]) group.add(beam(V(x + s * w / 2, y - 1, z), V(x + s * w / 2, y + hgt, z), 0.7, timberMat));
      group.add(beam(V(x - w / 2 - 1, y + hgt, z), V(x + w / 2 + 1, y + hgt, z), 0.8, timberMat));
      const day = new THREE.Mesh(new THREE.PlaneGeometry(w - 1, hgt), new THREE.MeshBasicMaterial({ color: 0xfff6e0, fog: false })); day.position.set(x, y + hgt / 2 - 0.5, z + 4); group.add(day);
      const L = new THREE.SpotLight(0xfff0d8, 2.2, 160, 0.7, 0.6, 1); L.position.set(x, y + hgt * 0.6, z + 3); L.target.position.set(x, y - 10, z - 60); group.add(L, L.target); ctx.lights.push(L);
      // rock around the mouth
      const rk = new THREE.Mesh(new THREE.TorusGeometry(w * 0.9, 4.5, 6, 18, Math.PI), rockMat); rk.position.set(x, y - 1, z + 1); group.add(rk);
    }
    else if (M.type === 'rails') {
      const P = [];
      for (let k = 0; k < M.pts.length - 1; k++) { const [ax, az] = M.pts[k], [bx, bz] = M.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 3), px = -(bz - az) / L, pz = (bx - ax) / L;
        for (let s = 0; s < n; s++) { const t0 = s / n, t1 = (s + 1) / n; for (const o of [-0.55, 0.55]) { const xa = ax + (bx - ax) * t0 + px * o, za = az + (bz - az) * t0 + pz * o, xb = ax + (bx - ax) * t1 + px * o, zb = az + (bz - az) * t1 + pz * o; P.push(xa, gy(xa, za) + 0.15, za, xb, gy(xb, zb) + 0.15, zb); } } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a2622 })));
    }
    else if (M.type === 'trestle') {
      const [a, b] = M.pts, ya = gy(a[0], a[1]), yb = gy(b[0], b[1]), y = Math.max(ya, yb) + 0.5, A = V(a[0], y, a[1]), B = V(b[0], y, b[1]);
      for (const o of [-1.4, 1.4]) { const d = B.clone().sub(A).normalize(), p = V(-d.z, 0, d.x).multiplyScalar(o); group.add(beam(A.clone().add(p), B.clone().add(p), 0.5, timberMat)); }
      const L = A.distanceTo(B), n = Math.ceil(L / 7);
      for (let k = 0; k <= n; k++) { const P = A.clone().lerp(B, k / n), deep = 34; group.add(beam(P.clone().add(V(0, -deep, 0)), P, 0.55, timberMat)); if (k < n) { const Q = A.clone().lerp(B, (k + 1) / n); group.add(beam(P.clone().add(V(0, -deep, 0)), Q, 0.3, timberMat), beam(Q.clone().add(V(0, -deep, 0)), P, 0.3, timberMat)); } }
      const lamp = glow(0xffa94d, 6); lamp.position.copy(A.clone().lerp(B, 0.5)).add(V(0, 3, 0)); group.add(lamp);
    }
    else if (M.type === 'ferns') for (const [x, z, r] of M.pts) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x3d6a2c, roughness: 0.9 });
      for (let k = 0; k < 14; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat), a = R() * 6.28, rr = R() * r; const y = gy(x + Math.cos(a) * rr, z + Math.sin(a) * rr); s.scale.set(1.4 + R() * 2, 0.8 + R(), 1.4 + R() * 2); s.position.set(x + Math.cos(a) * rr, y + R() * 14, z + Math.sin(a) * rr); group.add(s); }
    }
    else if (M.type === 'clubhouse') {
      const y = 34, b = box(26, 9, 15, new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.85 })); b.position.set(M.x, y + 4.5, M.z); group.add(b);
      const rf = box(29, 1.2, 18, timberMat); rf.position.set(M.x, y + 9.6, M.z); group.add(rf);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(22, 3), new THREE.MeshBasicMaterial({ color: 0xffd79a })); win.position.set(M.x, y + 5, M.z + 7.6); group.add(win);
    }
  }
  // giant glowing mushrooms (they play as trees: trees.js 'mushroom')
  const shrooms = T.trees.filter(t => t.type === 'mushroom');
  if (shrooms.length) {
    const stem = new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.8, emissive: 0x2a3b3a, emissiveIntensity: 0.6 });
    const capM = new THREE.MeshStandardMaterial({ color: 0x48e0c8, roughness: 0.5, emissive: 0x2fd6c0, emissiveIntensity: 0.85 });
    for (const t of shrooms) {
      const H = 3.2 * t.s, cs = 2.4 * t.s;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * t.s, 0.55 * t.s, H + cs * 0.4, 10), stem); st.position.set(t.x, t.y + (H + cs * 0.4) / 2 - 0.3, t.z); group.add(st);
      const cp = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM); cp.scale.set(cs * 1.05, cs * 0.55, cs * 1.05); cp.position.set(t.x, t.y + H + cs * 0.25, t.z); group.add(cp);
    }
    const P = new THREE.PointLight(0x46e3cc, 1.6, 60, 1.4), m = shrooms[Math.floor(shrooms.length / 2)]; P.position.set(m.x, m.y + 10, m.z); group.add(P); ctx.lights.push(P);
  }
  // the play is lit: the lanterns nearest the line, and a warm light over the green
  const along = p => { const tx = h.tee[0], tz = h.tee[1]; const dx = pin.x - tx, dz = pin.z - tz, L2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((p.x - tx) * dx + (p.z - tz) * dz) / L2)); return Math.hypot(p.x - tx - dx * t, p.z - tz - dz * t); };
  lanterns.sort((a, b) => along(a) - along(b)).slice(0, coarse ? 5 : 8).forEach(p => { const L = new THREE.PointLight(0xffb366, 2.1, 85, 1.3); L.position.copy(p).add(V(0, 1, 0)); group.add(L); ctx.lights.push(L); });
  const gL = new THREE.SpotLight(0xfff0d6, 2.6, 160, 0.42, 0.7, 1); gL.position.set(pin.x + 18, pin.y + 48, pin.z + 22); gL.target.position.copy(pin); group.add(gL, gL.target); ctx.lights.push(gL);
  // a softer light down the fairway from the tee, so the landing area reads
  const mid = V((h.tee[0] + pin.x) / 2, 0, (h.tee[1] + pin.z) / 2); mid.y = gy(mid.x, mid.z);
  const fL = new THREE.SpotLight(0xffe2b8, 1.3, 600, 0.55, 0.9, 1); fL.position.set(h.tee[0], gy(h.tee[0], h.tee[1]) + 40, h.tee[1] + 30); fL.target.position.copy(mid); group.add(fL, fL.target); ctx.lights.push(fL);
  return ctx;
}
