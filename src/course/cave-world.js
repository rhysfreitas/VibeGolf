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
const flowGeo = lathe(18, 9, t => 0.3 + 0.95 * Math.pow(1 - t, 2.2) + 0.08 * Math.sin(t * 31)); // flowstone draped down a wall, spreading at its foot (y=0)
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

// how far the wall's face stands in (+) or out from the solid shape at a point (the knobs follow it)
const wallPush = (x, y, z) => (fbm(x / 13 + 2.2, z / 13 + y / 11) - 0.5) * 8 + (fbm(x / 4.5, z / 4.5 - y / 5) - 0.5) * 3;

// a cenote's greenery: shrubs and small trees along every ledge, vines hanging down the wall below it
function cenotePlants(S, rim, CN, sd) {
  const G = new THREE.Group(), R = rng(Math.round(S.x * 7 + S.z * 13)), shrubs = [], vines = [], trunks = [];
  let r = S.r;
  for (let k = 0; k < CN.terraces; k++) {
    const y = rim + (k + 1) * CN.step + 0.6, mid = r + CN.ledge * 0.55, n = Math.round(mid * 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i + R() * 0.8) / n * Math.PI * 2, rr = mid + (R() - 0.5) * CN.ledge * 0.5, x = Math.cos(a) * rr, z = Math.sin(a) * rr, s = 1.4 + R() * 2.6;
      shrubs.push({ p: V(S.x + x, y + s * 0.4, S.z + z), q: new THREE.Quaternion(), s: V(s, s * 0.75, s), c: 0.75 + R() * 0.5 });
      if (R() < 0.18) { const th = 4 + R() * 5; trunks.push({ p: V(S.x + x, y, S.z + z), q: new THREE.Quaternion(), s: V(0.35, th, 0.35), c: 1 }); shrubs.push({ p: V(S.x + x, y + th, S.z + z), q: new THREE.Quaternion(), s: V(3.2, 2.4, 3.2), c: 0.8 + R() * 0.3 }); }
    }
    const nv = Math.round(r * 0.9);
    for (let i = 0; i < nv; i++) { // vines from the lip of the ledge below this one, down the wall
      const a = (i + R()) / nv * Math.PI * 2, len = 3 + R() * R() * CN.step, x = Math.cos(a) * (r + 1.2), z = Math.sin(a) * (r + 1.2);
      vines.push({ p: V(S.x + x, rim + k * CN.step + CN.step * 0.95 - len, S.z + z), q: new THREE.Quaternion().setFromAxisAngle(UP, -a + Math.PI / 2), s: V(0.6 + R() * 1.4, len, 1), c: 0.7 + R() * 0.5 });
    }
    r += CN.ledge;
  }
  const leaf = new THREE.MeshBasicMaterial({ color: 0x4f8a3a, vertexColors: true, fog: false });
  G.add(instances(lumpy(1, 2.2, 0.3), leaf, shrubs, true));
  G.add(instances(withColor(new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0)), new THREE.MeshBasicMaterial({ color: 0x5a4632, vertexColors: true, fog: false }), trunks, true));
  const vg = withColor(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0));
  G.add(instances(vg, new THREE.MeshBasicMaterial({ color: 0x3f7a34, vertexColors: true, side: THREE.DoubleSide, fog: false }), vines, true));
  return G;
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
  // where the sheet stands up as wall, push it in and out across its face: buttresses, recesses, broken rock
  { const nr = geo.attributes.normal;
    for (let k = 0; k < Y.length; k++) {
      if (Number.isNaN(Y[k])) continue;
      const nx_ = nr.getX(k), nz_ = nr.getZ(k), hz = Math.hypot(nx_, nz_); if (hz < 0.35) continue;
      const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
      const o = wallPush(x, y, z) * Math.min(1, (hz - 0.35) * 2.5);
      pos[k * 3] += nx_ / hz * o; pos[k * 3 + 2] += nz_ / hz * o;
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); }
  const roof = new THREE.Mesh(geo, rockMat); roof.receiveShadow = true; group.add(roof);

  /* ---------- the foot of the walls: rubble, fallen blocks and flowstone, so no wall meets the floor clean ---------- */
  const bx0 = box0.x0 - 160, bx1 = box0.x1 + 160, bz0 = box0.z0 - 160, bz1 = box0.z1 + 160;
  const PLAY = new Set(['green', 'fringe', 'fairway', 'tee', 'sand', 'water']);
  const rubble = [], blocks = [], flows = [], q0 = new THREE.Quaternion(), eul = new THREE.Euler();
  const wantR = coarse ? 900 : 1700, wantB = coarse ? 260 : 420, wantF = coarse ? 80 : 130;
  for (let t = 0; t < 40000 && (rubble.length < wantR || blocks.length < wantB || flows.length < wantF); t++) {
    const x = bx0 + R() * (bx1 - bx0), z = bz0 + R() * (bz1 - bz0), d = C.wallDepth(x, z);
    if (d < -5 || d > 10) continue;
    const g = T.groundAt(x, z); if (g === null || PLAY.has(T.surfaceAt(x, z))) continue;
    const rot = q0.clone().setFromEuler(eul.set((R() - 0.5) * 0.6, R() * 6.3, (R() - 0.5) * 0.6));
    if (d > -1 && rubble.length < wantR && R() < Math.pow(1 - Math.max(0, d) / 10, 1.6)) {
      const k = 0.35 + R() * R() * 1.6; rubble.push({ p: V(x, g - k * 0.25, z), q: rot, s: V(k * (0.8 + R() * 0.6), k, k * (0.8 + R() * 0.6)), c: 0.55 + R() * 0.4 });
    } else if (d < 4 && blocks.length < wantB && R() < 0.45) {
      // fallen blocks heaped against the wall foot, some piled two high
      const k = 2.5 + R() * R() * 8, sy = k * (0.6 + R() * 0.5); blocks.push({ p: V(x, g + sy * 0.3, z), q: rot, s: V(k * (0.9 + R() * 0.7), sy, k * (0.9 + R() * 0.5)), c: 0.5 + R() * 0.35 });
      if (d < 1.5 && R() < 0.4) { const k2 = k * (0.45 + R() * 0.3); blocks.push({ p: V(x + (R() - 0.5) * k * 0.6, g + sy * 0.85 + k2 * 0.3, z + (R() - 0.5) * k * 0.6), q: q0.clone().setFromEuler(eul.set(R(), R() * 6.3, R())), s: V(k2, k2 * 0.8, k2 * 1.1), c: 0.5 + R() * 0.35 }); }
    } else if (d > -1 && d < 2 && flows.length < wantF && R() < 0.3) {
      const top = C.ceilingAt(x, z); if (top === null || top - g < 8) continue;
      const w = 2.5 + R() * 5; flows.push({ p: V(x, g - 0.6, z), q: q0.clone().setFromEuler(eul.set(0, R() * 6.3, 0)), s: V(w, top - g + 4, w * (0.55 + R() * 0.3)), c: 0.62 + R() * 0.3 });
    }
  }
  const flowMat = new THREE.MeshStandardMaterial({ color: 0x857a6c, roughness: 0.8, metalness: 0, vertexColors: true });
  if (rubble.length) group.add(instances(lumpy(1, 3.1, 0.35), rockMat, rubble, true));
  if (blocks.length) group.add(instances(lumpy(1, 7.7, 0.45), rockMat, blocks, true));
  if (flows.length) group.add(instances(flowGeo, flowMat, flows, true));

  /* ---------- openings to the sky: a shaft up through the rock, daylight above, a beam down ---------- */
  const sd = (sunDir && sunDir.y > 0.2 ? sunDir.clone() : V(0.25, 1, 0.15)).normalize();
  for (const S of C.sky) {
    if (Math.hypot(S.x - cx, S.z - cz) > reach + 400) continue;
    let rim = -Infinity; for (let a = 0; a < 16; a++) { const y = C.ceilingAt(S.x + Math.cos(a / 16 * 6.283) * (S.r + 4), S.z + Math.sin(a / 16 * 6.283) * (S.r + 4)); if (y !== null) rim = Math.max(rim, y); }
    if (rim === -Infinity) rim = 40;
    if (S.cenote) rim = gy(S.x, S.z) + 0.5; // a cenote's walls step up from its floor: no cave roof round it
    S.rim = rim;
    const U = S.upper, CN = S.cenote, shaftH = U ? U.h : CN ? CN.terraces * CN.step + 6 : S.r > 40 ? 26 : 34, top = rim + shaftH;
    let open = U ? U.sky : S.r;
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
      // the shaft up to daylight: a ragged funnel, flaring as it rises (a cenote steps back in terraces
      // with plants on every ledge), lit by the sky: dark rock at the foot, sunlit rock at the top
      const P = [[S.r * 0.97, rim - 5]];
      if (CN) { let r = S.r; for (let k = 0; k < CN.terraces; k++) { const y0 = rim + k * CN.step; P.push([r + 1.5, y0 + CN.step * 0.85], [r + 2.2, y0 + CN.step], [r + CN.ledge, y0 + CN.step + 0.6]); r += CN.ledge; } P.push([r + 3, top + 4]); open = r + 3; }
      else P.push([S.r * 1.04, rim + shaftH * 0.4], [S.r * 1.18, rim + shaftH * 0.8], [S.r * 1.3, top + 4]), (open = S.r * 1.3);
      const sg = new THREE.LatheGeometry(P.map(([r, y]) => new THREE.Vector2(r, y)), 64), sp = sg.attributes.position;
      for (let k = 0; k < sp.count; k++) { const x = sp.getX(k), y = sp.getY(k), z = sp.getZ(k), f = 1 + 0.07 * (fbm(x / 14 + 3, z / 14 + y / 12) - 0.5) + 0.04 * (fbm(x / 4, z / 4 - y / 5) - 0.5); sp.setXYZ(k, x * f, y, z * f); }
      sg.computeVertexNormals(); withColor(sg);
      const sc = sg.attributes.color, sn = sg.attributes.normal;
      for (let k = 0; k < sc.count; k++) {
        const y = sp.getY(k), t = Math.max(0, Math.min(1, (y - rim) / (top - rim))), ny = sn.getY(k);
        const lit = 0.35 + 0.65 * Math.max(0, -(sn.getX(k) * sd.x + ny * sd.y + sn.getZ(k) * sd.z));  // baked sunlight
        const ledge = CN && ny < -0.6;                                                                    // (normals face in: up-facing ledges point down)
        const v = (CN ? 0.18 + 0.75 * t * t : 0.1 + 0.5 * Math.pow(t, 1.6)) * lit, n = 0.85 + 0.3 * fbm(sp.getX(k) / 9, sp.getZ(k) / 9 + y / 7);
        if (ledge) sc.setXYZ(k, 0.32 * v * n + 0.05, 0.62 * v * n + 0.08, 0.24 * v * n + 0.03); else sc.setXYZ(k, 0.86 * v * n, 0.8 * v * n, 0.7 * v * n);
      }
      const sm = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); sm.position.set(S.x, 0, S.z); group.add(sm);
      if (CN) group.add(cenotePlants(S, rim, CN, sd));
      // the sky past the rim: a dome, so nothing black shows round the opening
      // (a small shaft just ends in a disc of sky: a dome would show through gaps in the rock round it)
      const dome = CN ? new THREE.Mesh(new THREE.SphereGeometry(open * 1.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xbfd9ef, side: THREE.BackSide, fog: false }))
        : new THREE.Mesh(new THREE.CircleGeometry(open * 1.08, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xcfdcea, fog: false }));
      dome.position.set(S.x, top + (CN ? 2 : 3.5), S.z); group.add(dome);
    }
    if (U) { const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(open * 1.2, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9f3ff, fog: false })); skyDisc.position.set(S.x, top + 9, S.z); group.add(skyDisc); }
    open = U ? U.sky : S.r; // the beam is as wide as the hole it comes through
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
      // a step of a cascade down a cenote's terraces: from ledge k+1 down to ledge k (or the pool)
      const cn = M.cascade !== undefined && C.sky.find(S => S.cenote && S.rim !== undefined && Math.hypot(m0.x - S.x, m0.z - S.z) < S.r + 60);
      if (cn) { M.top = cn.rim + (M.cascade + 1) * cn.cenote.step + 0.6; if (M.cascade) M.bottom = cn.rim + M.cascade * cn.cenote.step + 0.6; }
      const top = lip ? lip.rim + 1 : M.top ?? 30;
      const mid = m0, bot = M.bottom ?? Math.min(gy(mid.x, mid.z), T.floor ? T.floor.y : -60) - (T.inGorge?.(mid.x, mid.z) ? 140 : 0); // bottom: a cascade step
      const Hh = top - bot, W = pts.reduce((s, p, k) => s + (k ? p.distanceTo(pts[k - 1]) : 0), 0) || 12;
      const tex = fallTex.clone(); tex.needsUpdate = true; tex.repeat.set(W / 8, Hh / 30);
      const fg = new THREE.PlaneGeometry(1, 1, pts.length * 3, 24), fp = fg.attributes.position;
      for (let k = 0; k < fp.count; k++) {
        const u = fp.getX(k) + 0.5, v = fp.getY(k) + 0.5, f = u * (pts.length - 1), a = Math.min(pts.length - 2, Math.floor(f)), t = f - a;
        const p = pts[a].clone().lerp(pts[a + 1], t), drop = (1 - v);
        fp.setXYZ(k, p.x, top - drop * Hh, p.z);
      }
      fg.computeVertexNormals();
      const sheet = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: Hh > 120 ? 0.62 : 0.85, depthWrite: false, side: THREE.DoubleSide, color: 0xcfe4ee, fog: !far })); // a tall curtain reads as falling water, not a wall
      sheet.renderOrder = 2; group.add(sheet);
      const mist = []; for (let k = 0; k < 7; k++) { const s = glow(0xcfe3ea, W * (1.2 + k * 0.3), 0.18); s.position.set(mid.x + (R() - 0.5) * W, Math.max(bot, gy(mid.x, mid.z)) + 4 + k * 3, mid.z + (R() - 0.5) * W); s.material.blending = THREE.NormalBlending; group.add(s); mist.push(s); }
      ctx.anims.push((dt, t) => { tex.offset.y = t * 0.8; mist.forEach((s, i) => { s.material.opacity = 0.14 + 0.06 * Math.sin(t * 1.7 + i); }); });
    }
    else if (M.type === 'geode') {
      // a geode cracked open, like a halved stone: the green sits in the lower half (crystals lining the
      // inside of its rim, an agate band along the crest) and the upper half stands on end behind it
      // (grey shell, agate rings, a hollow packed with crystal facing the tee)
      const dx0 = M.x - M.from[0], dz0 = M.z - M.from[1], dl = Math.hypot(dx0, dz0), d = V(dx0 / dl, 0, dz0 / dl), side = V(-d.z, 0, d.x);
      const purple = [], blue = [], white = [], put = (L, p, dir, len, w = 0.32) => L.push({ p, q: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), s: V(len * w, len, len * w), c: 0.85 + R() * 0.3 });
      const pick = () => { const r = R(); return r < 0.55 ? purple : r < 0.85 ? blue : white; };
      // the lower half: crest of the rim along each ray, crystals on its inner face
      const band = [], N = 48;
      for (let k = 0; k <= N; k++) {
        const a = (k / N - 0.5) * 2 * 1.95, ca = Math.cos(a), sa = Math.sin(a), rx = d.x * ca - d.z * sa, rz = d.x * sa + d.z * ca;
        let best = 0, bh = -Infinity; for (let r = 14; r < M.r * 1.5; r += 0.8) { const g = gy(M.x + rx * r, M.z + rz * r); if (g > bh) { bh = g; best = r; } }
        band.push([rx, rz, best]);
        for (let j = 0; j < (coarse ? 6 : 10); j++) {
          const r = best * (0.62 + R() * 0.4), x = M.x + rx * r, z = M.z + rz * r;
          put(pick(), V(x, gy(x, z) - 0.2, z), V(-rx + (R() - 0.5) * 0.6, 0.7 + R() * 0.9, -rz + (R() - 0.5) * 0.6), 0.8 + R() * R() * 3.2);
        }
      }
      // the agate band along the crest: white outside, lavender, a thin line of blue inside
      { const pos = [], col = [], idx = [], cols = [[0.55, 0.56, 0.6], [0.93, 0.92, 0.97], [0.74, 0.66, 0.92], [0.5, 0.45, 0.88]], offs = [2.4, 1.2, 0, -1.1];
        band.forEach(([rx, rz, r], k) => offs.forEach((o, j) => { const x = M.x + rx * (r + o), z = M.z + rz * (r + o); pos.push(x, gy(x, z) + 0.25, z); col.push(...cols[j]); if (k) for (const q of [j]) if (q < offs.length - 1) { const a0 = (k - 1) * 4 + q, b0 = k * 4 + q; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); } }));
        const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); bg.setIndex(idx);
        group.add(new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: !far }))); }
      // the upper half on end: rings of agate round a hollow of crystal, facing the tee
      if (M.back) {
        const B = M.back, gb = gy(M.x, M.z), cy = gb + B.y0 + B.h, face = V(B.x, cy, B.z).addScaledVector(d, -9); // stands clear of the slab's ragged face
        // a broken, irregular outline (the same wobble for every ring, so the bands stay concentric)
        const wob = t => 1 + 0.07 * Math.sin(5 * t + 1.3) + 0.04 * Math.sin(11 * t + 0.4) + 0.025 * Math.sin(23 * t);
        const loop = (P, sc, rev) => { for (let k = 0; k <= 72; k++) { const t = (rev ? -1 : 1) * k / 72 * Math.PI * 2, f = wob(t) * sc; k ? P.lineTo(Math.cos(t) * B.w * f, Math.sin(t) * B.h * f) : P.moveTo(Math.cos(t) * B.w * f, Math.sin(t) * B.h * f); } };
        const ring = (s0, s1, color, push = 0) => { const sh = new THREE.Shape(), hole = new THREE.Path(); loop(sh, s1, false); loop(hole, s0, true); sh.holes.push(hole);
          const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 48), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
          m.position.copy(face).addScaledVector(d, push); m.lookAt(m.position.clone().sub(d)); group.add(m); };
        ring(1.0, 1.12, 0x55585e); ring(0.93, 1.0, 0xeae6f2, -0.05); ring(0.86, 0.93, 0xb6a3e2, -0.1); ring(0.82, 0.86, 0x7a6fd6, -0.15); ring(0.79, 0.82, 0xf2eff8, -0.2);
        // the hollow: a dish set back into the slab, dark violet, crystals standing out of it toward the tee
        const dsh = new THREE.Shape(); loop(dsh, 1, false);
        const dish = new THREE.Mesh(new THREE.ShapeGeometry(dsh, 48), new THREE.MeshStandardMaterial({ color: 0x2b1f55, roughness: 0.5, emissive: 0x24164f, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
        dish.scale.set(0.8, 0.8, 1); dish.position.copy(face).addScaledVector(d, 0.05); dish.lookAt(dish.position.clone().sub(d)); group.add(dish);
        for (let k = 0; k < (coarse ? 260 : 420); k++) {
          const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.78 * wob(a), u = Math.cos(a) * rr * B.w, v = Math.sin(a) * rr * B.h;
          const p = face.clone().addScaledVector(side, u).add(V(0, v, 0)).addScaledVector(d, -0.1 - rr * 0.6); // the rim stands proudest: the middle reads as a hollow
          const out = V(-d.x, 0, -d.z).addScaledVector(side, -u / B.w * 0.5).add(V(0, -v / B.h * 0.45 + 0.25, 0)).add(V((R() - 0.5) * 0.5, (R() - 0.5) * 0.5, (R() - 0.5) * 0.5));
          put(rr > 0.6 && R() < 0.4 ? white : pick(), p, out, 1.2 + R() * R() * (5 - rr * 3));
        }
        if (!far) { const P = new THREE.PointLight(0xa57bff, 2.4, 80, 1.3); P.position.copy(face).addScaledVector(d, -12); group.add(P); ctx.lights.push(P); }
      }
      for (const [L, hue] of [[purple, 0x9b6bff], [blue, 0x5f8dff], [white, 0xe6e2ff]]) if (L.length) {
        const mat = new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.7, roughness: 0.15, metalness: 0.1, vertexColors: true });
        group.add(instances(crystalGeo, mat, L, true));
      }
      for (let k = 0; k < 4; k++) { const a = (k - 1.5) * 0.7, gl = glow(k % 2 ? 0x6f8dff : 0x9b6bff, 22, 0.3); gl.position.set(M.x + (d.x * Math.cos(a) - d.z * Math.sin(a)) * M.r, gy(M.x, M.z) + 4, M.z + (d.x * Math.sin(a) + d.z * Math.cos(a)) * M.r); group.add(gl); }
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
      // two steel rails on timber sleepers, following the ground
      const ties = [], bars = [];
      for (let k = 0; k < M.pts.length - 1; k++) { const [ax, az] = M.pts[k], [bx, bz] = M.pts[k + 1], L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bz - az, bx - ax);
        const q = new THREE.Quaternion().setFromAxisAngle(UP, -yaw), n = Math.ceil(L / 1.1);
        for (let j = 0; j < n; j++) { const t = (j + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; ties.push({ p: V(x, gy(x, z) + 0.06, z), q, s: V(0.28, 0.14, 1.9), c: 0.7 + R() * 0.4 }); }
        const m = Math.ceil(L / 4); for (let j = 0; j < m; j++) for (const o of [-0.55, 0.55]) { const t = (j + 0.5) / m, x = ax + (bx - ax) * t - Math.sin(yaw) * o, z = az + (bz - az) * t + Math.cos(yaw) * o; bars.push({ p: V(x, gy(x, z) + 0.2, z), q, s: V(L / m + 0.05, 0.1, 0.08), c: 1 }); }
      }
      const unit = withColor(new THREE.BoxGeometry(1, 1, 1));
      group.add(instances(unit, timberMat, ties, true), instances(unit, new THREE.MeshStandardMaterial({ color: 0x4a4038, metalness: 0.6, roughness: 0.5, vertexColors: true }), bars, true));
    }
    else if (M.type === 'crystalcave') {
      // a side cave lined with glowing crystal: clusters over the floor, hanging from the roof, banked at the walls
      const L = [[], [], []], hues = [0x8f6bff, 0x5fd8ff, 0xd8f4ff];
      for (let k = 0, made = 0; k < 9000 && made < (coarse ? 700 : 1300); k++) {
        const a = R() * 6.283, r = Math.sqrt(R()) * M.r, x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r, d = C.wallDepth(x, z);
        if (d < 0.5) continue;
        const g = gy(x, z), top = C.ceilingAt(x, z), L1 = L[Math.floor(R() * 3)], len = 0.6 + R() * R() * (d < 6 ? 6 : 3.5);
        const where = R(); made++;
        if (where < 0.45 || top === null) L1.push({ p: V(x, g - 0.2, z), q: new THREE.Quaternion().setFromUnitVectors(UP, V((R() - 0.5) * 0.8, 1, (R() - 0.5) * 0.8).normalize()), s: V(len * 0.3, len, len * 0.3), c: 0.85 + R() * 0.3 });
        else L1.push({ p: V(x, top + 0.4, z), q: new THREE.Quaternion().setFromUnitVectors(UP, V((R() - 0.5) * 0.7, -1, (R() - 0.5) * 0.7).normalize()), s: V(len * 0.3, len, len * 0.3), c: 0.85 + R() * 0.3 });
      }
      L.forEach((list, i) => list.length && group.add(instances(crystalGeo, new THREE.MeshStandardMaterial({ color: hues[i], emissive: hues[i], emissiveIntensity: 0.8, roughness: 0.15, vertexColors: true }), list, true)));
      if (!far) for (let k = 0; k < 3; k++) { const P = new THREE.PointLight(k % 2 ? 0x6fd8ff : 0x9b7bff, 1.6, 70, 1.3), a = k * 2.1; P.position.set(M.x + Math.cos(a) * M.r * 0.4, gy(M.x, M.z) + 6, M.z + Math.sin(a) * M.r * 0.4); group.add(P); ctx.lights.push(P); }
      for (let k = 0; k < 5; k++) { const gl = glow(k % 2 ? 0x6fd8ff : 0x9b7bff, 26, 0.25), a = R() * 6.28, r = R() * M.r * 0.7; gl.position.set(M.x + Math.cos(a) * r, gy(M.x, M.z) + 3 + R() * 8, M.z + Math.sin(a) * r); group.add(gl); }
    }
    else if (M.type === 'gours') {
      // rimstone pools: each a glowing turquoise pool held back by a cream lip of flowstone
      const d0 = V(M.pts[0][0] - M.from[0], 0, M.pts[0][1] - M.from[1]).normalize(), yaw = Math.atan2(d0.x, -d0.z);
      const water = new THREE.MeshStandardMaterial({ color: 0x2fd8c8, emissive: 0x1fbfb0, emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.88 });
      const lip = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6, emissive: 0x2a3a36, emissiveIntensity: 0.5 });
      M.pts.forEach(([x, z], k) => {
        const rx = 15 - k, rz = 3.8, g = Math.min(gy(x, z), gy(x + d0.x * 2, z + d0.z * 2), gy(x - d0.x * 2, z - d0.z * 2));
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), water); pool.scale.set(rx, 1, rz); pool.rotation.y = -yaw; pool.position.set(x, g + 0.3, z); group.add(pool);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 48).rotateX(Math.PI / 2), lip); rim.scale.set(rx + 0.4, 6, rz + 0.4); rim.rotation.y = -yaw; rim.position.set(x, g + 0.25, z); group.add(rim);
        const gl = glow(0x3fe6d6, rx * 1.6, 0.3); gl.position.set(x, g + 2.5, z); group.add(gl);
      });
      if (!far) { const [x, z] = M.pts[1], P = new THREE.PointLight(0x3fe6d6, 2.6, 90, 1.2); P.position.set(x, gy(x, z) + 6, z); group.add(P); ctx.lights.push(P); }
    }
    else if (M.type === 'stack') {
      // fallen rock stacked up a steep bank: wherever the ground in front of the green rises sharply
      const back = Math.atan2(M.z - M.from[1], M.x - M.from[0]), list = [];
      for (let k = 0; k < 140; k++) {
        const a = back + Math.PI + (R() - 0.5) * 2.2, r = M.r0 + R() * (M.r1 - M.r0), x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r;
        const e = 1.2, sl = Math.hypot(gy(x + e, z) - gy(x - e, z), gy(x, z + e) - gy(x, z - e)) / (2 * e); if (sl < 0.22) continue;
        const k1 = 0.8 + R() * 1.6; list.push({ p: V(x, gy(x, z) + k1 * 0.2, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 0.5, R() * 6.3, R() * 0.5)), s: V(k1 * 1.3, k1 * 0.7, k1), c: 0.55 + R() * 0.35 });
        if (R() < 0.5) { const k2 = k1 * 0.7; list.push({ p: V(x + (R() - 0.5), gy(x, z) + k1 * 0.75 + k2 * 0.2, z + (R() - 0.5)), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R() * 6.3, R())), s: V(k2 * 1.2, k2 * 0.7, k2), c: 0.55 + R() * 0.35 }); }
      }
      if (list.length) group.add(instances(lumpy(1, 9.1, 0.4), rockMat, list, true));
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
  // the ore cart on its rails: rolls to where the course put it (T.cart.s), a few metres a second
  if (T.cart) {
    const cartG = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x6b4a34, metalness: 0.55, roughness: 0.6 });
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 1.1, 4, 1).rotateY(Math.PI / 4), iron); tub.scale.set(1.25, 1, 0.72); tub.position.y = 0.95; cartG.add(tub);
    for (const [u, v] of [[-0.8, -0.62], [0.8, -0.62], [-0.8, 0.62], [0.8, 0.62]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12).rotateX(Math.PI / 2), iron); w.position.set(u, 0.32, v); cartG.add(w); }
    const ore = instances(lumpy(1, 4.4, 0.4), rockMat, Array.from({ length: 9 }, () => ({ p: V((R() - 0.5) * 1.6, 1.45 + R() * 0.2, (R() - 0.5) * 0.7), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(R(), R(), R())), s: V(0.35, 0.3, 0.32), c: 0.5 + R() * 0.3 })), true);
    cartG.add(ore);
    const gem = new THREE.Mesh(crystalGeo, new THREE.MeshStandardMaterial({ color: 0x8f6bff, emissive: 0x8f6bff, emissiveIntensity: 0.9 })); gem.scale.set(0.25, 0.8, 0.25); gem.position.set(0.3, 1.5, 0); cartG.add(gem);
    group.add(cartG);
    let shown = T.cart.s;
    const place = () => { const P = T.cart.at(shown); cartG.position.set(P.x, gy(P.x, P.z) + 0.15, P.z); cartG.rotation.y = -P.yaw; };
    place();
    ctx.anims.push(dt => { const d = T.cart.s - shown; if (Math.abs(d) > 0.01) { shown += Math.sign(d) * Math.min(Math.abs(d), dt * 4); place(); } });
  }
  return ctx;
}
