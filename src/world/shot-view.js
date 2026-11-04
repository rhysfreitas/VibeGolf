// Ball, shadow, growing tracer, flight playback and the stand-over-ball camera, for range-based
// mini games. One instance per page:
//
//   const sv = createShotView(world);
//   sv.address(club.tee)                 // ball on the mat (or tee)
//   const flight = sv.fly(simulateResult)// start playback; returns { done, landIdx, ... }
//   per frame: sv.update(dt) then render  // advances the ball, tracer and camera
// The camera is fixed (src/stance.js): it doesn't follow the ball up or down.

import { STANCE, stanceView } from '../stance.js';

export const BALL_RADIUS = 0.02135;

export function createShotView(world, opts = {}) {
  const { renderer, scene, camera, groundAt, sunDir } = world;
  const color = opts.tracerColor || '#f5c542';
  const stanceOpts = opts.stance || {};   // e.g. { back, up, ballAt, fov } to stand a little higher for a game
  const PR = () => renderer.getPixelRatio();

  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, envMapIntensity: 0.9 }));
  ball.castShadow = true; scene.add(ball);
  const teePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0025, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.5 }));
  scene.add(teePeg);
  const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  // tracer: bright core + soft glow; old tracers fade back
  const mkLine = (w, o) => { const m = new THREE.LineMaterial({ color: new THREE.Color(color), linewidth: w * PR(), transparent: true, opacity: o, depthWrite: false, toneMapped: false }); m.resolution.set(renderer.domElement.width || 1, renderer.domElement.height || 1); const l = new THREE.Line2(new THREE.LineGeometry(), m); l.frustumCulled = false; l.renderOrder = 2; l.visible = false; scene.add(l); return l; };
  const setLine = (l, arr) => { if (arr.length < 6) { l.visible = false; return; } l.geometry.setPositions(arr); l.geometry._maxInstanceCount = undefined; l.visible = true; }; // see CLAUDE.md "Line2 tracers"
  const tracer = { core: mkLine(2.6, 1), glow: mkLine(7, 0.3) };
  const ghosts = [];
  const extra = [];
  const lines = () => [tracer.core, tracer.glow, ...ghosts, ...extra];
  function resizeLines() { const w = renderer.domElement.width, h = renderer.domElement.height; for (const l of lines()) l.material.resolution.set(w, h); }

  const addrBall = new THREE.Vector3(), FWD = new THREE.Vector3(0, 0, -1);
  const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3(), init: false };
  let flight = null, tmp = new THREE.Vector3();
  // stance.fov (optional) zooms the view: a narrower lens makes far targets bigger (Golf HORSE)
  const baseFov = stanceOpts.fov || STANCE.fov, hfov = 62 * baseFov / STANCE.fov;
  const vfov = () => { const h = THREE.MathUtils.degToRad(hfov); return Math.max(baseFov, Math.min(78, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / camera.aspect)))); };

  function address(onTee) {
    teePeg.visible = !!onTee; teePeg.position.set(0, 0.055, 0);
    ball.position.set(0, (onTee ? 0.045 : 0.03) + BALL_RADIUS, 0); ball.visible = true;
    addrBall.copy(ball.position);
    flight = null; tracer.core.visible = tracer.glow.visible = false;
  }

  // r = result of physics simulate(); `lift` raises the start off the tee/mat and blends to true ground
  function fly(r) {
    const startY = ball.position.y;
    const pts = r.pts.map(p => ({ t: p.t, phase: p.phase, p: [p.p[0], p.p[1] + startY * Math.max(0, 1 - p.t * 4), p.p[2]] }));
    const li = pts.findIndex(p => p.phase !== 'flight');
    flight = { r, pts, t: 0, landIdx: li < 0 ? pts.length - 1 : li, arr: [], done: false, landed: false, onLand: null, onDone: null };
    return flight;
  }

  function sample(t, out) {
    const P = flight.pts; let lo = 0, hi = P.length - 1;
    if (t >= P[hi].t) { out.set(...P[hi].p); return hi; }
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].t <= t) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], f = (t - a.t) / ((b.t - a.t) || 1);
    out.set(a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f, a.p[2] + (b.p[2] - a.p[2]) * f);
    return lo;
  }

  function update(dt) {
    if (flight && !flight.done) {
      flight.t += dt;
      const idx = sample(flight.t, ball.position);
      const arr = flight.arr; arr.length = 0;
      const upto = Math.min(idx, flight.landIdx);
      for (let i = 0; i <= upto; i += 3) arr.push(...flight.pts[i].p);
      if (idx <= flight.landIdx) arr.push(ball.position.x, ball.position.y, ball.position.z);
      setLine(tracer.core, arr); setLine(tracer.glow, arr);
      if (!flight.landed && idx >= flight.landIdx) { flight.landed = true; flight.onLand && flight.onLand(); }
      if (flight.t >= flight.pts[flight.pts.length - 1].t) { flight.done = true; flight.onDone && flight.onDone(); }
    }
    // keep the ball a couple of pixels wide at any distance
    const d = camera.position.distanceTo(ball.position);
    const pxPerM = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * d);
    ball.scale.setScalar(Math.max(1, 1.6 / (BALL_RADIUS * 2 * pxPerM)));
    const gy = groundAt(ball.position.x, ball.position.z), h = Math.max(0, ball.position.y - gy);
    shadow.position.set(ball.position.x - sunDir.x / sunDir.y * h, 0, ball.position.z - sunDir.z / sunDir.y * h);
    shadow.position.y = groundAt(shadow.position.x, shadow.position.z) + 0.012;
    const bs = BALL_RADIUS * 3.2 * ball.scale.x * (1 + h * 0.02);
    shadow.scale.set(bs, bs, 1); shadow.material.opacity = flight ? Math.max(0, 0.75 - h / 40) : 0;
    // camera: standing over the ball, fixed (a window into the world, not a chase cam)
    const v = stanceView(addrBall, FWD, vfov(), stanceOpts);
    if (!cam.init) { cam.pos.copy(v.pos); cam.look.copy(v.look); cam.init = true; }
    cam.pos.lerp(v.pos, 1 - Math.exp(-6 * dt)); cam.look.lerp(v.look, 1 - Math.exp(-3 * dt));
    camera.fov = vfov(); camera.updateProjectionMatrix();
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    world.aimShadows(flight ? tmp.copy(camera.position).lerp(ball.position, 0.5) : tmp.set(0, 0, -45));
  }

  // keep the finished shot as a faint line (e.g. for 'your attempts' on a target)
  function ghostCurrent(opacity = 0.28) {
    if (!flight) return;
    const g = mkLine(1.6, opacity); setLine(g, flight.arr.slice()); ghosts.push(g); resizeLines();
    while (ghosts.length > 6) { const o = ghosts.shift(); scene.remove(o); o.geometry.dispose(); o.material.dispose(); }
  }
  function clearGhosts() { while (ghosts.length) { const o = ghosts.pop(); scene.remove(o); o.geometry.dispose(); o.material.dispose(); } }

  resizeLines();
  // fade the live tracer (e.g. while a game's camera moves in close)
  function tracerFade(k) { tracer.core.material.opacity = 1 - k; tracer.glow.material.opacity = 0.3 * (1 - k); }
  return { ball, address, fly, update, tracerFade, resizeLines, ghostCurrent, clearGhosts, setLine, mkLine: (w, o) => { const l = mkLine(w, o); extra.push(l); return l; }, get flight() { return flight; } };
}
