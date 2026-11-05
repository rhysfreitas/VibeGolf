// The swing mannequin: a 3D golfer that shows a fault next to the goal (see docs/COACHING.md).
// Uses the global THREE (r147 UMD). One renderer, moved into whichever slot the coach shows.
//
// World: metres, y up. The golfer (right-handed) faces +z; the target is +x (the golfer's left).
// The swing is keyed at the ten P positions (address … finish). Hands and club are keyed in
// the world but blended in the chest's own frame, so between keys they ride the body's turn;
// the club's turn is blended as a quaternion, so it can never flip the long way round.
//
//   const mq = createMannequin();
//   mq.mount(el)                         // move the canvas into a slot
//   mq.play(lesson, { mode, cam, show }) // a lesson from lessons.js
//   mq.setWho('you'|'goal'|'both') · mq.setT(t) · mq.setPlaying(v) · mq.goTo(cam)
//   mq.numbers()                         // loft / path / attack read off the scene at impact

import { MODES } from './lessons.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z), D = Math.PI / 180;
const n = (x, y, z) => V(x, y, z).normalize();
const toV = a => (a ? (a.isVector3 ? a.clone() : V(a[0], a[1], a[2])) : null);

/* ---------------- fixed geometry ---------------- */
const BALL = V(0.02, 0.0214 + 0.012, 0.68);
const LOFT = 34, LIE = 62;
const S0 = V(0, Math.sin(LIE * D), -Math.cos(LIE * D));            // up the shaft at address
const F0 = V(1, 0, 0);                                              // square face reference
const HOSEL = V(BALL.x - 0.035, 0.035 + 0.012, BALL.z - 0.034);
const GRIP_AT = 0.83;
const H0 = HOSEL.clone().addScaledVector(S0, GRIP_AT);
const LEN = { thigh: 0.45, shin: 0.43, upper: 0.3, fore: 0.28, spine: 0.48 };
const ANK = { L: V(0.21, 0.085, -0.02), R: V(-0.21, 0.085, -0.02) };
const P0 = V(0, 0.91, -0.12);
const REACH = LEN.upper + LEN.fore - 0.004;

const basis = (S, F) => { const s = S.clone().normalize(), f = F.clone().addScaledVector(s, -F.dot(s)).normalize(), t = s.clone().cross(f); return new THREE.Matrix4().makeBasis(s, f, t); };
const B0inv = basis(S0, F0).invert();
const clubQuat = (d, f) => new THREE.Quaternion().setFromRotationMatrix(basis(d.clone().negate(), f).multiply(B0inv));
const qOf = (turn, side, bend) => new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, side * D))
  .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(bend * D, 0, 0))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -turn * D, 0)));

// where the body is for a set of posture numbers. stance: the whole body slid along the target
// line (ball position lessons); thrust: the pelvis pushed toward the ball (early extension)
function bodyFrame(P) {
  const pc = P0.clone().add(V(P.shift + (P.stance || 0), -P.drop, P.thrust || 0));
  const qp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -P.pelvis * D, 0));
  const qt = qOf(P.chest, P.side, P.bend);
  const neck = pc.clone().add(V(0, LEN.spine, 0).applyQuaternion(qt));
  return { pc, qp, qt, neck, shL: neck.clone().add(V(0.19, -0.05, 0).applyQuaternion(qt)), shR: neck.clone().add(V(-0.19, -0.05, 0).applyQuaternion(qt)) };
}

/* ---------------- the swing: ten P positions ---------------- */
//            P1   P2    P3    P4    P5    P6     P7   P8     P9    P10
//          addr  take  arm∥  top   arm∥  shaft∥ IMP  shaft∥ arm∥  finish
const T = [0, 0.15, 0.29, 0.47, 0.57, 0.635, 0.7, 0.765, 0.84, 1];
const IMP = 6, SCAL = ['pelvis', 'shift', 'drop', 'chest', 'side', 'bend', 'heel', 'knee', 'lookUp', 'stance', 'thrust'];
const BASE = {
  // the body keeps turning all the way to the finish, so the arms ride the turn instead of
  // swinging the club over on their own
  pelvis: [0, 12, 28, 45, 18, -10, -38, -58, -80, -100],
  chest: [0, 32, 68, 92, 64, 36, -15, -52, -90, -124],
  shift: [0, -0.015, -0.025, -0.03, 0.04, 0.065, 0.08, 0.1, 0.12, 0.13],
  drop: [0, 0, 0.005, 0.01, 0.03, 0.03, 0.02, 0.01, 0, -0.04],
  // into the finish the spine straightens and leans back a touch (a soft reverse C), so the
  // arms don't have to swing the club over a rigid body
  side: [6, 5, 3, 0, 8, 11, 14, 12, 11, 9],
  bend: [40, 40, 38, 36, 38, 39, 38, 33, 22, 6],
  heel: [0, 0, 0, 0, 0.05, 0.12, 0.3, 0.55, 0.8, 1],
  knee: [0, 0, 0, 0, 0.1, 0.2, 0.35, 0.45, 0.55, 0.6],
  lookUp: [0, 0, 0, 0, 0, 0, 0, 0.15, 0.5, 1],
  stance: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  thrust: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  H: [H0, V(-0.3, 0.86, 0.31), V(-0.42, 1.14, 0.17), V(-0.34, 1.4, 0.14), V(-0.3, 1.13, 0.24), V(-0.15, 0.95, 0.3), null, V(0.3, 0.92, 0.18), V(0.55, 1.15, 0.2), V(0.16, 1.55, -0.06)],
  d: [S0.clone().negate(), n(-0.97, 0.06, 0.2), n(-0.2, 0.88, -0.42), n(0.97, -0.1, -0.2), n(-0.3, 0.88, -0.36), n(-0.98, 0.1, 0.0), null, n(0.98, 0.12, -0.04), n(0.2, 0.9, -0.4), n(-0.7, -0.45, -0.55)],
  f: [F0.clone(), n(0.05, -0.25, 0.97), n(0.35, 0.3, 0.88), n(0.2, 0.6, 0.75), n(0.1, 0.3, 0.95), n(0.05, -0.15, 0.98), null, n(0, 0.2, -0.98), n(-0.3, 0.2, -0.9), n(0, 1, 0)],
};
// hands and club for a clubhead at the ball: shaft lean toward the target, face open
function atBall(leanDeg = 8, openDeg = 0) {
  const s = S0.clone().applyAxisAngle(V(0, 0, 1), -leanDeg * D).normalize();
  // the face leans with the shaft (so lean takes loft off without turning the face)
  const f = F0.clone().applyAxisAngle(V(0, 0, 1), -leanDeg * D).applyAxisAngle(V(0, 1, 0), -openDeg * D);
  return { H: HOSEL.clone().add(V(0.01, 0, 0)).addScaledVector(s, GRIP_AT), d: s.clone().negate(), f };
}
// a swing from a lesson spec: { over: { scalar: [10] }, impact: [lean, open], keys: { i: { H, d, f } } }
function buildSwing(spec = {}) {
  const over = spec.over || {}, v = {};
  for (const k of SCAL) v[k] = (over[k] || BASE[k]).slice();
  for (const k of ['H', 'd', 'f']) v[k] = BASE[k].map(x => x && x.clone());
  for (const [i, o] of Object.entries(spec.keys || {})) { if (o.H) v.H[i] = toV(o.H); if (o.d) v.d[i] = toV(o.d).normalize(); if (o.f) v.f[i] = toV(o.f).normalize(); }
  const imp = atBall(...(spec.impact || [8, 0]));
  v.H[IMP] = imp.H; v.d[IMP] = imp.d; v.f[IMP] = imp.f;
  const keyP = i => { const P = {}; for (const k of SCAL) P[k] = v[k][i]; return P; };
  // the lead arm stays long from takeaway to the release; at P9 the trail arm is the long one
  for (const i of [1, 2, 3, 4, 5, 7]) {
    if ((spec.keys || {})[i] && spec.keys[i].free) continue;
    if (i === 7 && (spec.keys || {})[7]) continue;
    const sh = bodyFrame(keyP(i)).shL, up = S0.clone().applyQuaternion(clubQuat(v.d[i], v.f[i]));
    const dir = v.H[i].clone().addScaledVector(up, 0.03).sub(sh).normalize();
    v.H[i] = sh.clone().addScaledVector(dir, REACH * 0.975).addScaledVector(up, -0.03);
  }
  if (!((spec.keys || {})[8] && spec.keys[8].free)) {
    const sh = bodyFrame(keyP(8)).shR, up = S0.clone().applyQuaternion(clubQuat(v.d[8], v.f[8]));
    const dir = v.H[8].clone().addScaledVector(up, -0.065).sub(sh).normalize();
    v.H[8] = sh.clone().addScaledVector(dir, REACH * 0.97).addScaledVector(up, 0.065);
  }
  v.keys = T.map((_, i) => {
    const bf = bodyFrame(keyP(i)), inv = bf.qt.clone().invert();
    return { h: v.H[i].clone().sub(bf.pc).applyQuaternion(inv), q: inv.clone().multiply(clubQuat(v.d[i], v.f[i])) };
  });
  for (let i = 1; i < v.keys.length; i++) { const q = v.keys[i].q; if (q.dot(v.keys[i - 1].q) < 0) q.set(-q.x, -q.y, -q.z, -q.w); }
  for (const c of ['x', 'y', 'z']) v['h' + c] = v.keys.map(k => k.h[c]);
  for (const c of ['x', 'y', 'z', 'w']) v['q' + c] = v.keys.map(k => k.q[c]);
  v.yaw = spec.yaw || 0;
  return v;
}
// Hermite through the keys with tangents scaled to the real time between them; starts from
// rest at address and settles at the finish
function seg(t) { let i = 0; while (i < T.length - 2 && t > T[i + 1]) i++; return { i, u: (t - T[i]) / (T[i + 1] - T[i]) }; }
const slope = (a, j) => { if (j === 0 || j === T.length - 1) return 0; return (a[j + 1] - a[j - 1]) / (T[j + 1] - T[j - 1]); };
function herm(a, i, u) {
  const h = T[i + 1] - T[i], u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a[i] + (u3 - 2 * u2 + u) * h * slope(a, i) + (-2 * u3 + 3 * u2) * a[i + 1] + (u3 - u2) * h * slope(a, i + 1);
}
function sample(v, t) {
  const { i, u } = seg(Math.min(1, Math.max(0, t))), P = {};
  for (const k of SCAL) P[k] = herm(v[k], i, u);
  P.heel = Math.max(0, P.heel); P.lookUp = Math.min(1, Math.max(0, P.lookUp));
  const bf = P.bf = bodyFrame(P);
  P.H = V(herm(v.hx, i, u), herm(v.hy, i, u), herm(v.hz, i, u)).applyQuaternion(bf.qt).add(bf.pc);
  P.q = bf.qt.clone().multiply(new THREE.Quaternion(herm(v.qx, i, u), herm(v.qy, i, u), herm(v.qz, i, u), herm(v.qw, i, u)).normalize());
  const up = S0.clone().applyQuaternion(P.q);
  for (let pass = 0; pass < 2; pass++) for (const [sh, off] of [[bf.shL, 0.03], [bf.shR, -0.065]]) {
    const dv = P.H.clone().addScaledVector(up, off).sub(sh), over = dv.length() - REACH;
    if (over > 0) P.H.addScaledVector(dv.normalize(), -over);
  }
  P.yaw = v.yaw;
  return P;
}
function mixP(a, b, k) {
  if (!b || k <= 0) return a; const P = {};
  for (const s of SCAL) P[s] = a[s] + (b[s] - a[s]) * k;
  P.bf = bodyFrame(P); P.H = a.H.clone().lerp(b.H, k); P.q = a.q.clone().slerp(b.q, k); P.yaw = a.yaw + (b.yaw - a.yaw) * k;
  return P;
}

/* ---------------- the renderer and the cast ---------------- */
export function createMannequin({ pixelRatio = Math.min(devicePixelRatio || 1, 2) } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'mq-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14191b); scene.fog = new THREE.Fog(0x14191b, 9, 26);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.03, 80);
  scene.add(new THREE.HemisphereLight(0xcfdcff, 0x2b3322, 0.75));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6); key.position.set(3, 6, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 1, far: 20 }); key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.55); rim.position.set(-4, 3, -3); scene.add(rim);
  const grass = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c4a2a, roughness: 1 }));
  grass.receiveShadow = true; scene.add(grass);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 1.6), new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.95 }));
  mat.position.set(0, 0.006, 0.35); mat.receiveShadow = true; scene.add(mat);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(5, 0.002, 0.012), new THREE.MeshBasicMaterial({ color: 0xe9ecef, transparent: true, opacity: 0.55 }));
  tl.position.set(1.8, 0.013, BALL.z + 0.06); scene.add(tl);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0214, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  ball.position.copy(BALL); ball.castShadow = true; scene.add(ball);
  // the swing plane sheet (path lessons)
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.9), new THREE.MeshBasicMaterial({ color: 0x5ab8ff, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  { const s = S0.clone(), x = V(1, 0, 0), nrm = x.clone().cross(s); plane.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, s, nrm)); plane.position.copy(HOSEL).addScaledVector(s, 0.9).add(V(0.2, 0, 0)); }
  const planeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: 0x5ab8ff, transparent: true, opacity: 0.5 }));
  planeEdge.position.copy(plane.position); planeEdge.quaternion.copy(plane.quaternion);
  plane.visible = planeEdge.visible = false; scene.add(plane, planeEdge);

  function buildClub(colors) {
    const g = new THREE.Group();
    const M = c => new THREE.MeshStandardMaterial({ color: c, metalness: 0.85, roughness: 0.3, transparent: colors.ghost, opacity: colors.opacity });
    const steel = M(colors.steel), rubber = new THREE.MeshStandardMaterial({ color: colors.grip, roughness: 0.8, transparent: colors.ghost, opacity: colors.opacity }), head = M(colors.head);
    const face = new THREE.MeshStandardMaterial({ color: colors.face, metalness: 0.6, roughness: 0.45, transparent: colors.ghost, opacity: colors.opacity });
    const along = (len, r0, r1, m, from) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 12), m); c.position.copy(from).addScaledVector(S0, len / 2); c.quaternion.setFromUnitVectors(V(0, 1, 0), S0); c.castShadow = !colors.ghost; return c; };
    g.add(along(0.92, 0.0045, 0.0075, steel, HOSEL));
    g.add(along(0.27, 0.0105, 0.0125, rubber, HOSEL.clone().addScaledVector(S0, 0.66)));
    g.add(along(0.07, 0.0075, 0.0085, head, HOSEL.clone().addScaledVector(S0, -0.012)));
    const s = Math.sin(LOFT * D), c = Math.cos(LOFT * D);
    const prof = [[0, 0.002], [-0.048 * s, 0.048 * c], [-0.048 * s - 0.006, 0.048 * c + 0.001], [-0.043, 0.03], [-0.046, 0.012], [-0.038, 0.0], [-0.018, -0.001]];
    const hg = new THREE.ExtrudeGeometry(new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y))), { depth: 0.076, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2 });
    const hm = new THREE.Mesh(hg, head); hm.position.set(BALL.x - 0.032, 0.012, BALL.z - 0.034); hm.castShadow = !colors.ghost; g.add(hm);
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.044), face);
    fp.position.set(BALL.x - 0.032 - 0.024 * s + 0.0012, 0.012 + 0.024 * c, BALL.z - 0.034 + 0.039);
    fp.rotation.set(0, Math.PI / 2, 0); fp.rotateX(-LOFT * D); g.add(fp);
    g.children.forEach(m => m.position.sub(H0));
    const pivot = new THREE.Group(); pivot.add(g);
    return { pivot, mats: [steel, rubber, head] };
  }
  const tmpY = V(0, 1, 0);
  function placeLimb(mesh, a, b) { const d = b.clone().sub(a), l = d.length(); mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(tmpY, d.normalize()); mesh.scale.set(1, l, 1); }
  function ik(root, target, a, b, pole) {
    const t = target.clone().sub(root); let c = t.length(); c = Math.min(Math.max(c, Math.abs(a - b) + 1e-3), a + b - 1e-3);
    const u = t.normalize(), cosA = (a * a + c * c - b * b) / (2 * a * c), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const v = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
    const mid = root.clone().addScaledVector(u, a * cosA).addScaledVector(v, a * sinA);
    return { mid, end: mid.clone().add(target.clone().sub(mid).normalize().multiplyScalar(b)) };
  }
  // body parts by name, so a lesson can light up the one at fault
  const PART_GROUPS = {
    hands: ['handL', 'handR', 'foreL', 'foreR'], wrists: ['handL', 'handR', 'foreL', 'foreR'],
    hips: ['pelvis', 'thighL', 'thighR', 'belly'], shoulders: ['chest', 'shL', 'shR', 'upperL', 'upperR'],
    head: ['head', 'cap', 'neck', 'brim'], feet: ['footL', 'footR', 'shinL', 'shinR'], arms: ['upperL', 'upperR', 'foreL', 'foreR', 'elL', 'elR'],
  };
  function buildMan(colors) {
    const ghost = !!colors.ghost;
    const mk = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.02, transparent: ghost, opacity: ghost ? colors.opacity : 1, depthWrite: !ghost });
    const rig = new THREE.Group(), inner = new THREE.Group(); rig.position.copy(BALL); inner.position.copy(BALL).negate(); rig.add(inner); scene.add(rig);
    const add = (geo, m) => { const x = new THREE.Mesh(geo, m); x.castShadow = !ghost; inner.add(x); return x; };
    const parts = {}, mats = {};
    const part = (name, geo, c) => { mats[name] = mk(c); parts[name] = add(geo, mats[name]); };
    const limb = (r0, r1) => new THREE.CylinderGeometry(r1, r0, 1, 14), sph = r => new THREE.SphereGeometry(r, 16, 12);
    part('thighL', limb(0.068, 0.05), colors.pants); part('thighR', limb(0.068, 0.05), colors.pants);
    part('shinL', limb(0.048, 0.04), colors.pants); part('shinR', limb(0.048, 0.04), colors.pants);
    part('kneeL', sph(0.05), colors.pants); part('kneeR', sph(0.05), colors.pants);
    part('footL', new THREE.BoxGeometry(0.105, 0.07, 0.28), colors.shoe); part('footR', new THREE.BoxGeometry(0.105, 0.07, 0.28), colors.shoe);
    part('pelvis', new THREE.SphereGeometry(1, 20, 14), colors.pants); part('belly', limb(0.13, 0.15), colors.shirt); part('chest', new THREE.SphereGeometry(1, 20, 14), colors.shirt);
    part('upperL', limb(0.048, 0.04), colors.shirt); part('upperR', limb(0.048, 0.04), colors.shirt);
    part('foreL', limb(0.036, 0.03), colors.skin); part('foreR', limb(0.036, 0.03), colors.skin);
    part('shL', sph(0.055), colors.shirt); part('shR', sph(0.055), colors.shirt); part('elL', sph(0.04), colors.shirt); part('elR', sph(0.04), colors.shirt);
    part('handL', sph(0.042), colors.glove); part('handR', sph(0.04), colors.skin); part('neck', limb(0.05, 0.045), colors.skin);
    part('head', sph(0.105), colors.skin); part('cap', new THREE.SphereGeometry(0.11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), colors.cap);
    part('brim', new THREE.CylinderGeometry(0.075, 0.075, 0.008, 20, 1, false, -Math.PI / 2, Math.PI), colors.cap);
    const club = buildClub({ steel: ghost ? colors.shirt : 0xc9d0d8, grip: ghost ? colors.shirt : 0x16191e, head: ghost ? colors.shirt : 0xd7dce2, face: colors.face, ghost, opacity: ghost ? colors.opacity : 1 });
    inner.add(club.pivot);
    return { rig, inner, parts, mats, club: club.pivot, clubMats: club.mats, ghost };
  }
  function pose(man, P) {
    const p = man.parts, { pc, qp, qt, neck, shL, shR } = P.bf;
    man.rig.rotation.y = (P.yaw || 0) * D;
    const hipL = pc.clone().add(V(0.1, -0.03, 0).applyQuaternion(qp)), hipR = pc.clone().add(V(-0.1, -0.03, 0).applyQuaternion(qp));
    p.pelvis.position.copy(pc); p.pelvis.quaternion.copy(qp); p.pelvis.scale.set(0.17, 0.11, 0.12);
    placeLimb(p.belly, pc.clone().add(V(0, 0.04, 0).applyQuaternion(qt)), pc.clone().add(V(0, 0.3, 0).applyQuaternion(qt)));
    p.chest.position.copy(pc).add(V(0, 0.34, 0.01).applyQuaternion(qt)); p.chest.quaternion.copy(qt); p.chest.scale.set(0.19, 0.16, 0.12);
    p.shL.position.copy(shL); p.shR.position.copy(shR);
    const headC = neck.clone().add(V(0, 0.16, 0.05).applyQuaternion(qt));
    placeLimb(p.neck, neck.clone().add(V(0, -0.03, 0).applyQuaternion(qt)), headC);
    p.head.position.copy(headC);
    const look = BALL.clone().lerp(V(6, 1.2, BALL.z), P.lookUp), fwd = look.clone().sub(headC).normalize();
    const hq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(headC, look, V(0, 1, 0).applyQuaternion(qt))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + 0.25, 0, 0)));
    p.cap.position.copy(headC); p.cap.quaternion.copy(hq).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0, 0)));
    p.brim.position.copy(headC).addScaledVector(fwd, 0.07).add(V(0, 0.035, 0).applyQuaternion(qt)); p.brim.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(V(0, 0, 0), fwd, V(0, 1, 0))).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.25, 0, 0)));
    const up = S0.clone().applyQuaternion(P.q);
    man.club.position.copy(P.H); man.club.quaternion.copy(P.q);
    const handL = P.H.clone().addScaledVector(up, 0.03), handR = P.H.clone().addScaledVector(up, -0.065);
    // elbows bend toward the ground (and a little toward the chest's front): stable all the way
    // round, so the arms never swap sides as the hands pass over the shoulders into the finish
    const front = V(0, 0, 1).applyQuaternion(qt);
    const pole = V(0, -1, 0).addScaledVector(front, -0.35);
    const aL = ik(shL, handL, LEN.upper, LEN.fore, pole.clone().add(V(0.25, 0, 0))), aR = ik(shR, handR, LEN.upper, LEN.fore, pole.clone().add(V(-0.25, 0, 0)));
    placeLimb(p.upperL, shL, aL.mid); placeLimb(p.foreL, aL.mid, aL.end); p.elL.position.copy(aL.mid); p.handL.position.copy(aL.end);
    placeLimb(p.upperR, shR, aR.mid); placeLimb(p.foreR, aR.mid, aR.end); p.elR.position.copy(aR.mid); p.handR.position.copy(aR.end);
    for (const [k, hip, sgn] of [['L', hipL, 1], ['R', hipR, -1]]) {
      const heel = k === 'R' ? P.heel : 0;
      const ank = ANK[k].clone().add(V((P.stance || 0), heel * 0.07, heel * 0.05));
      const lg = ik(hip, ank, LEN.thigh, LEN.shin, V(sgn * 0.25 + (k === 'R' ? P.knee : 0), 0, 1));
      placeLimb(p['thigh' + k], hip, lg.mid); placeLimb(p['shin' + k], lg.mid, ank); p['knee' + k].position.copy(lg.mid);
      const foot = p['foot' + k]; foot.position.copy(ank).add(V(sgn * 0.01, -0.045 + heel * 0.02, 0.09 - heel * 0.03));
      foot.rotation.set(heel * 0.9, sgn * 0.18, 0);
    }
  }
  const SOLID = { shirt: 0x6a87a3, pants: 0x2f3644, skin: 0xc99b7a, shoe: 0xeceae4, cap: 0x24303c, glove: 0xf3f1ea };
  const ghostOf = (c, o) => ({ shirt: c, pants: c, skin: c, shoe: c, cap: c, glove: c, face: c, ghost: true, opacity: o });
  const cast = {
    you: buildMan({ ...SOLID, face: 0xffb04a }),
    goalSolid: buildMan({ ...SOLID, face: 0x6ee38a }),
    goalGhost: buildMan(ghostOf(0x6ee38a, 0.28)),
    beforeGhost: buildMan(ghostOf(0xffb04a, 0.3)),
  };

  /* ---------------- reading numbers off the scene ---------------- */
  const n0 = V(Math.cos(LOFT * D), Math.sin(LOFT * D), 0);
  const faceCentre = V(BALL.x - 0.03, 0.035, BALL.z + 0.005).sub(H0);
  const loftOf = P => Math.asin(n0.clone().applyQuaternion(P.q).y) / D;
  const headAt = P => { const o = new THREE.Object3D(); o.position.copy(P.H); o.quaternion.copy(P.q); o.updateMatrix(); return faceCentre.clone().applyMatrix4(o.matrix); };
  // the clubhead's direction on the way into the ball
  const motion = (sw, t) => { const a = headAt(sample(sw, t - 0.012)), b = headAt(sample(sw, t)), d = b.sub(a); return { path: Math.atan2(d.z, d.x) / D, attack: Math.atan2(d.y, Math.hypot(d.x, d.z)) / D }; };
  // face angle: where the face points, left/right of the target (+ open, i.e. right)
  const faceOf = P => { const nn = n0.clone().applyQuaternion(P.q); return Math.atan2(nn.z, nn.x) / D + (P.yaw || 0) * -1; };
  function numbersOf(sw) { const m = motion(sw, 0.7), P = sample(sw, 0.7); return { loft: loftOf(P), path: m.path - (sw.yaw || 0), attack: m.attack, face: faceOf(P) }; }

  /* ---------------- camera ---------------- */
  const CAMS = {
    panel: { pos: V(-0.22, 0.98, 4.3), at: V(-0.22, 0.84, 0.25) },
    front: { pos: V(-0.25, 0.98, 5.1), at: V(-0.3, 0.84, 0.25) },
    dtl: { pos: V(-4.9, 1.2, 0.45), at: V(0.3, 0.92, 0.02) },
    dtlPanel: { pos: V(-4.4, 1.15, 0.5), at: V(0.25, 0.86, 0.1) },
    close: { pos: V(BALL.x - 0.02, 0.09, BALL.z + 0.5), at: V(BALL.x - 0.06, 0.06, BALL.z) },
    top: { pos: V(-1.2, 1.9, 2.2), at: V(-0.25, 1.25, 0.1) },
    // halfway through (P8): the clubhead out toward the target, seen from in front
    through: { pos: V(0.9, 1.05, 2.0), at: V(0.55, 0.85, 0.15) },
  };
  const orbit = { at: V(), r: 5, th: 0, ph: 0, goal: null };
  function setFrom(pos, at) { orbit.at.copy(at); const o = pos.clone().sub(at); orbit.r = o.length(); orbit.th = Math.atan2(o.x, o.z); orbit.ph = Math.asin(o.y / orbit.r); }
  function goTo(name, snap = false) {
    const c = CAMS[name] || CAMS.front;
    if (snap) { orbit.goal = null; setFrom(c.pos, c.at); }
    else orbit.goal = { pos: c.pos.clone(), at: c.at.clone(), k: 0, from: camera.position.clone(), fromAt: orbit.at.clone() };
    state.cam = name;
  }
  // drag to orbit and pinch or scroll to zoom, when allowed
  const ptrs = new Map(); let pinch = 0;
  canvas.addEventListener('pointerdown', e => { if (!state.orbit) return; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); orbit.goal = null; });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1) { orbit.th -= dx * 0.008; orbit.ph = Math.max(-0.05, Math.min(1.35, orbit.ph + dy * 0.006)); }
    else { const [a, b] = [...ptrs.values()], dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) orbit.r = Math.max(0.3, Math.min(9, orbit.r * pinch / dd)); pinch = dd; }
  });
  const up_ = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
  canvas.addEventListener('pointerup', up_); canvas.addEventListener('pointercancel', up_);
  canvas.addEventListener('wheel', e => { if (!state.orbit) return; e.preventDefault(); orbit.goal = null; orbit.r = Math.max(0.3, Math.min(9, orbit.r * Math.exp(e.deltaY * 0.001))); }, { passive: false });

  /* ---------------- playback ---------------- */
  const state = { lesson: null, sw: null, mode: { type: 'loop', a: 0.5, b: 0.82, speed: 0.16, holdAt: 0.7, hold: 1.4 }, t: 0, hold: 0, clock: 0, playing: true, who: 'both', show: {}, mix: 0, cam: 'panel', orbit: false, highlight: null, offset: null, speed: 1, running: false, onStep: null };
  // lesson: { you, goal, cam, mode, highlight, plane } (lessons.js); opts override any of them
  function play(lesson, opts = {}) {
    const L = { ...lesson, ...opts };
    state.lesson = L;
    state.sw = { you: buildSwing(L.you), goal: buildSwing(L.goal || {}) };
    state.mode = { ...((typeof L.mode === 'string' ? MODES[L.mode] : L.mode) || MODES.impact) };
    state.show = L.show || { you: 1, goalGhost: 1 };
    state.mix = L.mix || 0; state.orbit = !!L.orbit; state.highlight = L.highlight || null;
    plane.visible = planeEdge.visible = !!L.plane;
    state.t = state.mode.a ?? (state.mode.type === 'still' ? state.mode.at : 0); state.hold = 0; state.clock = 0; state.playing = true;
    goTo(L.cam || 'panel', true);
    setHighlight(state.highlight);
    return numbers();
  }
  function setHighlight(name) {
    for (const m of Object.values(cast.you.mats)) m.emissive.setHex(0x000000);
    for (const m of cast.you.clubMats) m.emissive.setHex(0x000000);
    state.hl = name ? (name === 'club' ? cast.you.clubMats : (PART_GROUPS[name] || []).map(k => cast.you.mats[k]).filter(Boolean)) : [];
  }
  function numbers() {
    const nowSw = state.mix > 0 ? null : state.sw.you;
    const you = nowSw ? numbersOf(nowSw) : mixedNumbers(), goal = numbersOf(state.sw.goal);
    return { you, goal, before: numbersOf(state.sw.you) };
  }
  function mixedNumbers() {
    const P = mixP(sample(state.sw.you, 0.7), sample(state.sw.goal, 0.7), state.mix);
    const a = mixP(sample(state.sw.you, 0.688), sample(state.sw.goal, 0.688), state.mix), b = P;
    const d = headAt(b).sub(headAt(a));
    return { loft: loftOf(P), path: Math.atan2(d.z, d.x) / D - (P.yaw || 0), attack: Math.atan2(d.y, Math.hypot(d.x, d.z)) / D, face: faceOf(P) };
  }
  // drills: a half swing that freezes at impact, or the pump (top, down to halfway three times, through)
  const ease = u => u * u * (3 - 2 * u);
  const DRILLS = {
    impactHold: [['to', 0.26, 1.7, 0], ['hold', 0.5, 0], ['down', 2.0, 1], ['freeze', 2.2, 2], ['reset', 1.6, 3]],
    pump: [['to', 0.47, 2.2, 0], ['pump', 1.2, 1], ['pump', 1.2, 1], ['to', 1, 2.2, 2], ['hold', 1.2, 2], ['reset', 1.6, 3]],
  };
  function drillPose(kind, sec) {
    const seq = DRILLS[kind] || DRILLS.impactHold, len = seq.reduce((a, k) => a + (k[0] === 'to' ? k[2] : k[1]), 0);
    let s = sec % len, from = 0; const goal = state.sw.goal;
    for (const k of seq) {
      const dur = k[0] === 'to' ? k[2] : k[1], step = k.at(-1);
      if (s > dur) { s -= dur; if (k[0] === 'to') from = k[1]; else if (k[0] === 'reset') from = 0; else if (k[0] === 'freeze' || k[0] === 'down') from = 0.7; continue; }
      const e = ease(s / dur), imp = sample(goal, 0.7);
      if (k[0] === 'to') return { P: sample(goal, from + (k[1] - from) * e), step };
      if (k[0] === 'hold') return { P: sample(goal, from), step };
      if (k[0] === 'down') return { P: mixP(sample(goal, 0.26 * (1 - e)), imp, e * e), step };
      if (k[0] === 'freeze') return { P: imp, step };
      if (k[0] === 'pump') { const u = s / dur, w = u < 0.5 ? ease(u * 2) : ease((1 - u) * 2); return { P: sample(goal, 0.47 + (0.57 - 0.47) * w), step }; }
      const endP = from > 0.9 ? sample(goal, 1) : imp;
      return { P: mixP(endP, sample(goal, 0), e), step };
    }
    return { P: sample(goal, 0), step: 0 };
  }
  function stepTime(dt) {
    const m = state.mode;
    if (m.type === 'drill') { state.clock += dt * state.speed; return; }
    if (m.type === 'still' || !state.playing) return;
    if (state.hold > 0) { state.hold -= dt; return; }
    const before = state.t; state.t += dt * (m.speed || 0.27) * state.speed;
    if (m.holdAt != null && before < m.holdAt && state.t >= m.holdAt) { state.t = m.holdAt; state.hold = m.hold || 1.2; }
    if (m.type === 'loop' && state.t >= m.b) { state.t = m.a; state.hold = m.rest ?? 0.5; }
    if (m.type === 'full' && state.t > 1.25) state.t = 0;
  }
  let last = 0;
  function frame(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0); last = now;
    render(dt);
    requestAnimationFrame(frame);
  }
  function render(dt = 0) {
    if (!state.sw) return;
    stepTime(dt);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const off = state.offset && state.offset(w, h);
    if (off) camera.setViewOffset(w, h, off.x, off.y, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const tt = Math.min(1, state.t), m = state.mode, sh = state.show, full = m.type === 'full';
    let drill = null, step = -1;
    if (m.type === 'drill') { drill = drillPose(m.drill, state.clock); step = drill.step; }
    const sY = sample(state.sw.you, tt), sG = drill ? drill.P : sample(state.sw.goal, tt);
    const vis = {
      you: full ? state.who !== 'goal' : !!(sh.you || sh.now),
      goalGhost: full ? state.who === 'both' : !!sh.goalGhost,
      goalSolid: full ? state.who === 'goal' : !!sh.goalSolid,
      beforeGhost: !full && !!sh.beforeGhost,
    };
    for (const [k, man] of Object.entries(cast)) man.rig.visible = vis[k];
    if (vis.you) pose(cast.you, sh.now && !full ? mixP(sY, sample(state.sw.goal, tt), state.mix) : sY);
    if (vis.goalGhost) pose(cast.goalGhost, sG);
    if (vis.goalSolid) pose(cast.goalSolid, sG);
    if (vis.beforeGhost) pose(cast.beforeGhost, sY);
    // the part at fault glows softly
    const glow = 0.18 + 0.14 * Math.sin(performance.now() / 380);
    for (const mt of state.hl || []) mt.emissive.setRGB(glow, glow * 0.55, 0.05);
    if (orbit.goal) { const g = orbit.goal; g.k = Math.min(1, g.k + dt * 1.6); const e = g.k * g.k * (3 - 2 * g.k); setFrom(g.from.clone().lerp(g.pos, e), g.fromAt.clone().lerp(g.at, e)); if (g.k >= 1) orbit.goal = null; }
    camera.position.set(orbit.at.x + orbit.r * Math.cos(orbit.ph) * Math.sin(orbit.th), orbit.at.y + orbit.r * Math.sin(orbit.ph), orbit.at.z + orbit.r * Math.cos(orbit.ph) * Math.cos(orbit.th));
    camera.lookAt(orbit.at);
    renderer.render(scene, camera);
    if (state.onStep) state.onStep({ t: tt, step, you: sY, goal: sG });
  }

  return {
    canvas,
    mount(el) { if (el && canvas.parentNode !== el) el.appendChild(canvas); },
    play, numbers, goTo,
    start() { if (!state.running) { state.running = true; last = 0; requestAnimationFrame(frame); } },
    stop() { state.running = false; },
    render,
    setWho(v) { state.who = v; },
    setT(v) { state.t = v; state.hold = 0; },
    setClock(v) { state.clock = v; },
    setPlaying(v) { state.playing = v; },
    setMode(m) { m = typeof m === 'string' ? MODES[m] : m; state.mode = { ...m }; state.t = m.a ?? 0; state.clock = 0; state.hold = 0; },
    setSpeed(v) { state.speed = v; },
    setOrbit(v) { state.orbit = v; },
    setOffset(fn) { state.offset = fn; },
    onStep(fn) { state.onStep = fn; },
    get t() { return state.t; }, get playing() { return state.playing; }, get cam() { return state.cam; },
    get who() { return state.who; },
    loftAt: (sw = 'you', t = state.t) => loftOf(sample(state.sw[sw], t)),
    dispose() { state.running = false; renderer.dispose(); },
    get debug() { return { cast, camera }; },
  };
}

export const MQ = { T, BALL, atBall };
