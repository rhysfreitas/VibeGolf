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

  /* ---------- openings to the sky: a shaft up through the rock, daylight above, a beam down ---------- */
  const sd = (sunDir && sunDir.y > 0.2 ? sunDir.clone() : V(0.25, 1, 0.15)).normalize();
  for (const S of C.sky) {
    if (Math.hypot(S.x - cx, S.z - cz) > reach + 400) continue;
    let rim = -Infinity; for (let a = 0; a < 16; a++) { const y = C.ceilingAt(S.x + Math.cos(a / 16 * 6.283) * (S.r + 4), S.z + Math.sin(a / 16 * 6.283) * (S.r + 4)); if (y !== null) rim = Math.max(rim, y); }
    if (rim === -Infinity) rim = 40;
    const shaftH = S.r > 40 ? 26 : 34, top = rim + shaftH;
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(S.r * 1.15, S.r, shaftH + 6, 40, 4, true), rockMat); sh.position.set(S.x, rim + shaftH / 2 - 3, S.z); group.add(sh);
    const skyDisc = new THREE.Mesh(new THREE.CircleGeometry(S.r * 1.15, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe9f3ff, fog: false }));
    skyDisc.position.set(S.x, top + 3, S.z); group.add(skyDisc);
    // the beam, leaning with the sun, down to the ground
    const g0 = gy(S.x, S.z), H = top - g0, lean = V(-sd.x / sd.y, 0, -sd.z / sd.y).multiplyScalar(H * 0.35);
    const bg = new THREE.CylinderGeometry(S.r * 0.95, S.r * 1.05, H, 32, 1, true); bg.translate(0, -H / 2, 0);
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
  const tipDown = new THREE.ConeGeometry(1, 1, 7, 1); tipDown.rotateX(Math.PI); tipDown.translate(0, 0.5, 0); // base at y=1, tip at y=0
  const list = [];
  for (const S of C.stalactites) { const base = C.ceilingAt(S.x, S.z) ?? S.y + 10; list.push([S.x, S.y, S.z, S.r, base - S.y + 2]); }
  const want = coarse ? 260 : 420;
  for (let t = 0; t < want * 6 && list.length < want; t++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0), y = C.ceilingAt(x, z);
    if (y === null || !C.inHall(x, z) || Math.hypot(x - cx, z - cz) > reach) continue;
    const g = gy(x, z); if (y - g < 20) continue;
    const len = 2 + R() * R() * Math.min(18, (y - g) * 0.25);
    list.push([x, y - len, z, 0.3 + len * 0.14, len + 1.5]);
  }
  const im = new THREE.InstancedMesh(tipDown, rockMat, list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  list.forEach(([x, y, z, r, l], i) => { m4.compose(V(x, y, z), q.setFromEuler(new THREE.Euler(0, R() * 6, 0)), V(r, l, r)); im.setMatrixAt(i, m4); c.setScalar(0.6 + R() * 0.35); im.setColorAt(i, c); });
  group.add(im);

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
      const P = [];
      for (let k = 0; k < (coarse ? 9000 : 16000) && P.length < (coarse ? 2500 : 4500); k++) {
        const x = Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)), z = Math.min(...zs) + R() * (Math.max(...zs) - Math.min(...zs));
        if (!inPoly(x, z)) continue; const y = C.ceilingAt(x, z); if (y === null) continue; P.push(x, y - 0.4 - R() * 1.5, z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8ff5e3, size: coarse ? 2.2 : 1.7, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false })));
    }
    else if (M.type === 'falls') {
      // a sheet along the lip points, from the top down to the floor (or on into the Deep)
      const pts = M.pts.map(([x, z]) => V(x, 0, z)), top = M.top ?? 30;
      const mid = pts[Math.floor(pts.length / 2)], bot = Math.min(gy(mid.x, mid.z), T.floor ? T.floor.y : -60) - (T.inGorge?.(mid.x, mid.z) ? 140 : 0);
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
