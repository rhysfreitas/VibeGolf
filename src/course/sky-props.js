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
      if (m.pts) q.pts = m.pts.map(([x, z]) => [x - L.at[0], z - L.at[1]]);
      if (m.type === 'hanging') local.push(hanging(q, sub, 500 + local.length, g));
      else if (m.type === 'overhang') slab(q, sub, g);
      else if (m.type === 'balloon') balloon(q, sub, g, false);
    }
    for (const m of L.marks) if (m.type === 'falls') {
      const q = { ...m, pts: m.pts.map(([x, z]) => [x - L.at[0], z - L.at[1]]) };
      falls(q, { ...sub, T: { ISL: [] } }, local);
    }
  }
  return R;
}
