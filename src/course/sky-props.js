// Aerie stand-ins (global THREE): the things a drafted hole draws but doesn't play yet. Hanging islands,
// broad waterfalls, rock slabs jutting from an island, the hot air balloon, the drifting island and lanterns,
// plus the other holes' landmarks in the distance. Built from hole.draft.marks and hole.distant.
// ctx: { group, trees, island(I, detail, group, trees), fall(I, th, w), prepIsland, edgeRadius, mat, T, anims }
import { fbm, rng } from './terrain.js';

const rockAttrs = (geo, depth = 6) => {
  const n = geo.attributes.position.count;
  geo.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 3 ? 1 : 0)), 4));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(n).fill(depth), 1));
  return geo;
};

// a hanging island: top at `top`, its underside tapering down to `bottom`
function hanging(m, ctx, seed, group = ctx.group) {
  const I = ctx.prepIsland({ x: m.x, z: m.z, rx: m.rx, rz: m.rz, rot: m.rot || 0, p: m.p, top: m.top, depth: m.top - m.bottom, kind: 'deco', seed, dome: m.dome || 0, trees: m.dome ? 0 : m.trees ?? Math.round(m.rx * m.rz / 160) });
  ctx.island(I, { seg: 96, side: 18 }, group, ctx.trees);
  return I;
}

// a slab of rock: the polygon (x, z) extruded from `bottom` to `top`, its edges broken up
function slab(m, ctx, group = ctx.group) {
  const s = new THREE.Shape(m.poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: m.top - m.bottom, bevelEnabled: true, bevelThickness: 2, bevelSize: 2.5, bevelSegments: 2, curveSegments: 4, steps: 4 });
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = fbm(x / 9 + 3, z / 9 - y / 7) - 0.5;
    p.setXYZ(i, x + n * 4, y + (fbm(z / 11, x / 11) - 0.5) * 3, z + (fbm(y / 8 + 5, x / 9) - 0.5) * 4);
  }
  geo.computeVertexNormals(); rockAttrs(geo, 30);
  const mesh = new THREE.Mesh(geo, ctx.mat); mesh.position.y = m.bottom; mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
}

// a crag: rock growing out of an island's top and curving away along a Bezier (from -> via -> to), wide and
// thick at the root where it blends into the island, tapering to the tip. w and h: [root, tip] width and
// thickness in metres. The root starts a few metres down inside the island.
function crag(m, ctx, group = ctx.group) {
  const V3 = (a) => new THREE.Vector3(a[0], a[2], a[1]); // marks give [x, z, y]
  const A = V3(m.from).add(new THREE.Vector3(0, -6, 0)), B = V3(m.via), C = V3(m.to);
  const N = 30, K = 18, pos = [], idx = [], seed = (m.from[0] * 7.3 + m.from[1] * 3.1) % 50;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    const P = A.clone().multiplyScalar(u * u).add(B.clone().multiplyScalar(2 * u * t)).add(C.clone().multiplyScalar(t * t));
    const T = B.clone().sub(A).multiplyScalar(2 * u).add(C.clone().sub(B).multiplyScalar(2 * t)).normalize();
    let S = new THREE.Vector3().crossVectors(T, up); if (S.lengthSq() < 1e-4) S.set(1, 0, 0); S.normalize();
    const U = new THREE.Vector3().crossVectors(S, T).normalize();
    const flare = 1 + 0.7 * Math.max(0, 1 - t / 0.18) ** 2;               // the root spreads into the island
    const w = (m.w[0] + (m.w[1] - m.w[0]) * Math.pow(t, 0.85)) / 2 * flare, h = (m.h[0] + (m.h[1] - m.h[0]) * Math.pow(t, 0.8)) / 2 * flare;
    for (let k = 0; k <= K; k++) {
      const a = k / K * Math.PI * 2, n = 1 + 0.28 * (fbm(t * 6 + seed, a * 1.3 + seed) - 0.5) + 0.12 * (fbm(t * 18 + seed, a * 3) - 0.5);
      const q = i === N ? P : P.clone().addScaledVector(S, Math.cos(a) * w * n).addScaledVector(U, Math.sin(a) * h * n);
      pos.push(q.x, q.y, q.z);
    }
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + K + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo.computeVertexNormals(); rockAttrs(geo, 30);
  const mesh = new THREE.Mesh(geo, ctx.mat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
}

// a wedge: a blocky, tapering prism of rock jutting straight out from an island, rooted inside the island and
// pointing a little up. from/to: [x, z, y] root and tip (the axis), w and h: [root, tip] width and thickness;
// drop: a buttress carrying the rock down the island's side below the root (m). Faceted, flat shaded.
let facetMat = null;
function wedge(m, ctx, group = ctx.group) {
  if (!facetMat) { facetMat = ctx.mat.clone(); facetMat.onBeforeCompile = ctx.mat.onBeforeCompile; facetMat.flatShading = true; }
  const A = new THREE.Vector3(m.from[0], m.from[2], m.from[1]), C = new THREE.Vector3(m.to[0], m.to[2], m.to[1]);
  const T = C.clone().sub(A).normalize(), up = new THREE.Vector3(0, 1, 0);
  let S = new THREE.Vector3().crossVectors(T, up); if (S.lengthSq() < 1e-4) S.set(1, 0, 0); S.normalize();
  const U = new THREE.Vector3().crossVectors(S, T).normalize();
  const R = rng(Math.round(Math.abs(m.from[0] * 13 + m.from[1] * 7)) + 3);
  // a chamfered rectangle (8 corners) per ring, each corner nudged so the faces break up
  const ring = [[1, 0.55], [0.6, 1], [-0.6, 1], [-1, 0.55], [-1, -0.55], [-0.6, -1], [0.6, -1], [1, -0.55]];
  const N = 5, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, P = A.clone().lerp(C, t);
    const w = (m.w[0] + (m.w[1] - m.w[0]) * t) / 2, h = (m.h[0] + (m.h[1] - m.h[0]) * t) / 2;
    for (const [a, b] of ring) {
      const j = i === 0 || i === N ? 0.08 : 0.16;
      const q = P.clone().addScaledVector(S, a * w * (1 + (R() - 0.5) * j * 2)).addScaledVector(U, b * h * (1 + (R() - 0.5) * j * 2)).addScaledVector(T, (R() - 0.5) * 3);
      pos.push(q.x, q.y, q.z);
    }
  }
  const K = ring.length;
  for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = a + K, d = b + K; idx.push(a, c, b, b, c, d); }
  const tip = pos.length / 3; pos.push(...C.clone().addScaledVector(T, 2).toArray()); for (let k = 0; k < K; k++) idx.push(N * K + k, tip, N * K + (k + 1) % K);
  const root = pos.length / 3; pos.push(...A.clone().addScaledVector(T, -4).toArray()); for (let k = 0; k < K; k++) idx.push(k, (k + 1) % K, root);
  let geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  geo = geo.toNonIndexed(); geo.computeVertexNormals(); rockAttrs(geo, 30);
  const mesh = new THREE.Mesh(geo, facetMat); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  // the buttress: the same rock carried down the island's side under the root, narrowing as it goes
  if (m.drop) {
    const top = A.clone().addScaledVector(T, Math.min(14, A.distanceTo(C) * 0.2));
    wedge({ from: [top.x, top.z, top.y], to: [top.x - T.x * 4, top.z - T.z * 4, top.y - m.drop], w: [m.w[0] * 0.8, m.w[0] * 0.25], h: [m.h[0] * 1.1, m.h[0] * 0.4] }, ctx, group);
  }
}

// the hot air balloon: striped envelope, skirt, basket, ropes; it bobs
const stripeTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    const cols = ['#d9472b', '#f2c14e', '#f4ead5', '#2f6f8f'];
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * 16, 0, 16, 64); }
    t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = THREE.RepeatWrapping; return t;
  };
})();
function balloon(m, ctx, group = ctx.group, bob = true) {
  const g = new THREE.Group(); g.position.set(m.x, m.y, m.z);
  const env = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 20), new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.75 }));
  env.scale.set(1, 1.18, 1); g.add(env);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 1.6, 5, 24, 1, true), new THREE.MeshStandardMaterial({ map: stripeTex(), roughness: 0.8, side: THREE.DoubleSide }));
  skirt.position.y = -11.5; g.add(skirt);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 2.2), new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.95 }));
  basket.position.y = -17.5; g.add(basket);
  const rope = []; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) rope.push(a * 1.6, -14, b * 1.6, a * 1, -16.8, b * 1);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3));
  g.add(new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x3a2a1c })));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  group.add(g);
  if (bob) ctx.anims.push((dt, t) => { g.position.y = m.y + Math.sin(t * 0.35) * 1.4; g.rotation.y = t * 0.03; });
  return g;
}

// lanterns on posts round a green
function lanterns(m, ctx) {
  const post = new THREE.MeshStandardMaterial({ color: 0x3b2f24, roughness: 0.9 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: 0xffc46a, emissiveIntensity: 1.4, roughness: 0.5 });
  for (let i = 0; i < m.n; i++) {
    const a = i / m.n * Math.PI * 2, x = m.x + Math.cos(a) * m.r, z = m.z + Math.sin(a) * m.r * 0.92, y = ctx.T.groundAt(x, z);
    if (y === null) continue;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.2, 6), post); p.position.set(x, y + 1.1, z);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), glow); l.position.set(x, y + 2.35, z);
    ctx.group.add(p, l);
  }
}

// a waterfall off the nearest rim (a playable island or a hanging one), as wide as the mark
function falls(m, ctx, islands) {
  const mid = m.pts[Math.floor(m.pts.length / 2)];
  let best = null;
  for (const I of islands) for (let k = 0; k < 96; k++) {
    const th = k / 96 * Math.PI * 2, e = ctx.edgeRadius(I, th), d = Math.hypot(e.x - mid[0], e.z - mid[1]);
    if (!best || d < best.d) best = { I, th, d };
  }
  if (!best) return;
  let w = 0; for (let i = 1; i < m.pts.length; i++) w += Math.hypot(m.pts[i][0] - m.pts[i - 1][0], m.pts[i][1] - m.pts[i - 1][1]);
  ctx.group.add(ctx.fall(best.I, best.th, Math.max(6, w)));
}

export function buildSkyProps(hole, ctx, LANDMARKS) {
  const marks = hole.draft?.marks || [], R = rng(hole.par * 31 + marks.length);
  const hung = [];
  marks.forEach((m, i) => {
    if (m.type === 'hanging') hung.push(hanging(m, ctx, 300 + i));
    else if (m.type === 'overhang') slab(m, ctx);
    else if (m.type === 'crag') crag(m, ctx);
    else if (m.type === 'wedge') wedge(m, ctx);
    else if (m.type === 'balloon') balloon(m, ctx);
    else if (m.type === 'lanterns') lanterns(m, ctx);
    else if (m.type === 'drift') { // a small island with trees, swaying a little
      const g = new THREE.Group(); ctx.group.add(g);
      hanging({ x: m.x, z: m.z, rx: m.r, rz: m.r * 0.85, top: m.top, bottom: m.bottom, trees: 4 }, ctx, 400 + i, g);
      ctx.anims.push((dt, t) => { g.position.x = Math.sin(t * 0.25) * 2; g.position.y = Math.sin(t * 0.4 + 1) * 0.6; });
    }
  });
  for (const m of marks) if (m.type === 'falls') falls(m, ctx, [...ctx.T.ISL, ...hung]);
  // the other holes' landmarks, far off
  for (const d of hole.distant || []) {
    const L = LANDMARKS[d.id]; if (!L) continue;
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = -d.rot * Math.PI / 180; ctx.group.add(g);
    const sub = { ...ctx, group: g, trees: [] }, local = [];
    for (const m of L.marks) {
      const q = { ...m, x: (m.x ?? 0) - L.at[0], z: (m.z ?? 0) - L.at[1] };
      if (m.poly) q.poly = m.poly.map(([x, z]) => [x - L.at[0], z - L.at[1]]);
      for (const k of ['from', 'via', 'to']) if (m[k]) q[k] = [m[k][0] - L.at[0], m[k][1] - L.at[1], m[k][2]];
      if (m.pts) q.pts = m.pts.map(([x, z]) => [x - L.at[0], z - L.at[1]]);
      if (m.type === 'hanging') local.push(hanging(q, sub, 500 + local.length, g));
      else if (m.type === 'overhang') slab(q, sub, g);
      else if (m.type === 'crag') crag(q, sub, g);
      else if (m.type === 'wedge') wedge(q, sub, g);
      else if (m.type === 'balloon') balloon(q, sub, g, false);
    }
    for (const m of L.marks) if (m.type === 'falls') {
      const q = { ...m, pts: m.pts.map(([x, z]) => [x - L.at[0], z - L.at[1]]) };
      falls(q, { ...sub, T: { ISL: [] } }, local);
    }
  }
  return R;
}
