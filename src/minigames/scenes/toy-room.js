// The Toy Room — the Golf Bowling scene. You've been shrunk down in a kid's bedroom on a sunny
// afternoon. The lane is the long runner rug down the middle of the floor, and the toy pin set at
// the far end stands as tall as a house. Around it: floorboards, a toy train looping through a
// sunbeam, scattered letter blocks and log-sized crayons, the bed and the dresser looming like
// cliffs, a teddy bear watching from the pillow, kid's drawings taped to the wall and a big window
// with the garden fence and a tree outside. Everything is real size times thirty.
//
// The sun only gets in through the two windows: a global shader tweak dims direct light wherever
// the wall would block it, so the sunbeams land as warm patches on the floor (and dust drifts in them).
//
// API: setLane(diff) · setGuide(x|null) · setPins(up, { drop }) · playPins(tracks) · posePins(t)
//      sweep(keep) → seconds · animate(clock, dt)

import { createStage, rng, GLSL_NOISE } from '../../world/stage.js';
import { YD, PIN_H, PIN_S, PIN_R, KICK_X, RUG_HALF, BUMPER_LEN, WALL_Z, rack, deckEnd } from '../bowling-logic.js';

const X0 = -66, X1 = 66, Z1 = 42, CEIL = 78;          // the room (real 4.4 m × 8.2 m × 2.6 m, ×30)
const RUG_T = 0.3, RUG_Z0 = 14, RUG_Z1 = WALL_Z + 12;  // the runner rug: 1 cm thick
const LWIN = { z0: -110, z1: -70, y0: 26, y1: 62 };    // window in the left wall (the sunbeam)
const FWIN = { x0: -18, x1: 18, y0: 26, y1: 64 };      // window in the far wall (the backdrop)

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}

export function createToyRoom(container) {
  const st = createStage(container, {
    turbidity: 3.2, rayleigh: 1.4, mie: 0.004, mieG: 0.8, elev: 38.3, az: 224.5,
    sunColor: 0xffe2b8, sunInt: 2.6, exposure: 0.62, hemiSky: 0xf2e6d4, hemiGround: 0x8a6440, hemiInt: 0.7,
    fogColor: 0xd8e4ee, fogNear: 320, fogFar: 2400, shadowBox: 140,
  });
  const { scene, renderer, sunDir } = st;
  const R = rng(1957), col = new THREE.Color();
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const mesh = (g, m, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; return o; };
  const group = (...kids) => { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; };

  /* ---------- sunlight only through the windows ---------- */
  const sd = sunDir, f = n => n.toFixed(4), BASE = 0.5;
  THREE.ShaderChunk.lights_pars_begin += `
float roomWin(vec2 h, vec2 c, vec2 hs) {
  vec2 d = abs(h - c) - hs; float edge = 1.0 - smoothstep(-0.8, 0.8, max(d.x, d.y));
  vec2 m = abs(h - c); return edge * smoothstep(0.45, 1.0, min(m.x, m.y));
}
float roomSun(vec3 w) {
  vec3 L = vec3(${f(sd.x)}, ${f(sd.y)}, ${f(sd.z)});
  if (w.x < ${(X0 - 0.5).toFixed(1)} || w.z < ${(WALL_Z - 0.5).toFixed(1)} || w.y > ${CEIL.toFixed(1)}) return 1.0;
  float kx = (${X0}.0 - w.x) / L.x, kz = (${WALL_Z}.0 - w.z) / L.z, kc = (${CEIL}.0 - w.y) / L.y;
  float lit = 0.0;
  if (kx < kz && kx < kc) lit = roomWin(vec2(w.z + L.z * kx, w.y + L.y * kx), vec2(${(LWIN.z0 + LWIN.z1) / 2}.0, ${(LWIN.y0 + LWIN.y1) / 2}.0), vec2(${(LWIN.z1 - LWIN.z0) / 2}.0, ${(LWIN.y1 - LWIN.y0) / 2}.0));
  else if (kz < kc) lit = roomWin(vec2(w.x + L.x * kz, w.y + L.y * kz), vec2(${(FWIN.x0 + FWIN.x1) / 2}.0, ${(FWIN.y0 + FWIN.y1) / 2}.0), vec2(${(FWIN.x1 - FWIN.x0) / 2}.0, ${(FWIN.y1 - FWIN.y0) / 2}.0));
  return mix(${BASE}, 1.0, lit);
}`;
  THREE.ShaderChunk.lights_fragment_begin = THREE.ShaderChunk.lights_fragment_begin.replace(
    'getDirectionalLightInfo( directionalLight, geometry, directLight );',
    'getDirectionalLightInfo( directionalLight, geometry, directLight );\n\t\tdirectLight.color *= roomSun( transpose( mat3( viewMatrix ) ) * geometry.position + cameraPosition );');

  // indoor reflections: a warm room with a bright window, instead of the open sky
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(B(30, 12, 40), basic(0xcdbfa8, { side: THREE.BackSide })));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 40), basic(0x7a5434)); fl.rotation.x = -Math.PI / 2; fl.position.y = -5.9; es.add(fl);
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), basic(new THREE.Color(0xfff2dc).multiplyScalar(5))); w1.position.set(0, 1, -19.9); es.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), basic(new THREE.Color(0xfff2dc).multiplyScalar(5))); w2.position.set(-14.9, 1, -6); w2.rotation.y = Math.PI / 2; es.add(w2);
    scene.environment = pm.fromScene(es, 0.03).texture;
  }
  // the sun's shadows cover the whole room
  const sun = st.sun; Object.assign(sun.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 1400 }); sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06;
  const shadowFocus = new THREE.Vector3(0, 0, -90);
  st.aimShadows(shadowFocus);

  /* ---------- floorboards ---------- */
  const groundAt = (x, z) => (Math.abs(x) <= RUG_HALF && z <= RUG_Z0 && z >= RUG_Z1 ? 0 : -RUG_T);
  const surfaceAt = (x, z) => (Math.abs(x) <= RUG_HALF ? 'fairway' : 'green');
  const shaderPos = sh => sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 });
  floorMat.onBeforeCompile = sh => {
    sh.vertexShader = shaderPos(sh);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <map_fragment>', `
vec3 p = vWPos; float camD = length(cameraPosition - p), px = max(0.01, camD * 0.0016);
float pw = 3.6, cx = floor(p.x / pw), fx = fract(p.x / pw);
float off = h21(vec2(cx, 3.0)) * 40.0, rz = floor((p.z + off) / 40.0), fz = fract((p.z + off) / 40.0);
float tone = h21(vec2(cx, rz));
vec3 wood = mix(lin(vec3(0.58, 0.38, 0.21)), lin(vec3(0.74, 0.53, 0.31)), tone);
float grain = fb(vec2(p.x * 3.0 + cx * 13.0, p.z * 0.18 + rz * 5.0));
wood *= 0.78 + 0.42 * grain; wood *= 0.92 + 0.12 * sin(p.z * 1.4 + grain * 9.0 + cx);
float seam = 1.0 - smoothstep(0.05, 0.05 + px, min(fx, 1.0 - fx) * pw);
seam = max(seam, 1.0 - smoothstep(0.06, 0.06 + px, min(fz, 1.0 - fz) * 40.0));
wood = mix(wood, lin(vec3(0.18, 0.11, 0.06)), seam * 0.8);
diffuseColor.rgb = wood;
float rough = mix(0.32, 0.6, grain) + seam * 0.3;
`);
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 4, Z1 - WALL_Z + 4, 1, 1), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -RUG_T, (Z1 + WALL_Z) / 2); floor.receiveShadow = true; scene.add(floor);

  /* ---------- the runner rug (the lane), with the pin deck and its markings ---------- */
  const U = { uL: { value: 100 * YD }, uGuide: { value: new THREE.Vector3(0, 0, 0) } };
  const rugMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  rugMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = shaderPos(sh);
    const h = PIN_S * Math.sqrt(3) / 2;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform float uL;\nuniform vec3 uGuide;' + GLSL_NOISE)
      .replace('#include <map_fragment>', `
vec3 p = vWPos; float camD = length(cameraPosition - p), px = max(0.012, camD * 0.0016);
float ax = abs(p.x), fine = fb(p.xz * 5.0), far = smoothstep(40.0, 160.0, camD);
// wool: navy field with a soft diamond lattice
vec3 navy = lin(vec3(0.17, 0.29, 0.54));
float dl = abs(fract((p.x + p.z) / 7.0) - 0.5) + abs(fract((p.x - p.z) / 7.0) - 0.5);
vec3 c = mix(navy, lin(vec3(0.25, 0.39, 0.66)), (1.0 - smoothstep(0.03, 0.03 + px / 7.0, abs(dl - 0.5))) * 0.7 * (1.0 - far * 0.7));
// the border: red band, cream zigzag, mustard band
float bR = ${RUG_HALF.toFixed(2)};
c = mix(c, lin(vec3(0.72, 0.16, 0.12)), step(bR - 1.2, ax));
float zz = abs(fract(p.z / 3.0) - 0.5) * 2.0;
float zig = 1.0 - smoothstep(0.12, 0.12 + px, abs(ax - (bR - 2.5 + zz * 0.9)));
c = mix(c, lin(vec3(0.93, 0.86, 0.7)), zig * step(bR - 3.2, ax) * step(ax, bR - 1.4));
c = mix(c, lin(vec3(0.9, 0.66, 0.16)), step(bR - 4.2, ax) * step(ax, bR - 3.4));
// the pin deck: a pale maple mat with red pin spots
float dz0 = -uL + 3.0, dz1 = -uL - ${(3 * h + 5).toFixed(2)};
float onDeck = step(p.z, dz0) * step(dz1, p.z) * step(ax, ${(KICK_X - 0.2).toFixed(2)});
vec3 maple = lin(vec3(0.86, 0.72, 0.5)) * (0.86 + 0.2 * fb(vec2(p.x * 0.4, p.z * 3.0)));
maple = mix(maple, lin(vec3(0.6, 0.45, 0.28)), (1.0 - smoothstep(0.04, 0.04 + px, abs(fract(p.x / 2.4) - 0.5) * 2.4 - 1.12)) * 0.4);
float spot = 0.0;
for (int r = 0; r < 4; r++) for (int k = 0; k < 4; k++) { if (k > r) continue;
  vec2 q = vec2((float(k) - float(r) * 0.5) * ${PIN_S.toFixed(3)}, -uL - float(r) * ${h.toFixed(3)});
  float d = length(p.xz - q); spot = max(spot, 1.0 - smoothstep(0.18, 0.18 + px, abs(d - ${(PIN_R * 1.15).toFixed(2)}))); }
maple = mix(maple, lin(vec3(0.78, 0.14, 0.1)), spot);
c = mix(c, maple, onDeck);
// woven dots and arrows (as on a real lane)
float dotZ = -uL + 7.0;
float dts = 0.0; for (int i = -3; i <= 3; i++) { vec2 q = p.xz - vec2(float(i) * 3.2, dotZ); q.y *= 0.55; dts = max(dts, 1.0 - smoothstep(0.85, 0.85 + px, length(q))); }
float arr = 0.0; for (int i = -3; i <= 3; i++) { vec2 a = p.xz - vec2(float(i) * 3.2, -uL + 24.0 + abs(float(i)) * 2.5);
  float tri = max(abs(a.x) * 1.6 + a.y * 0.42 - 1.4, max(-a.y - 3.0, a.y - 3.0)); arr = max(arr, 1.0 - smoothstep(0.0, px * 2.0, tri)); }
c = mix(c, lin(vec3(0.95, 0.9, 0.78)), max(dts, arr) * step(ax, bR - 4.4));
// Beginner's guide line: dashes under the best line into the pins
if (uGuide.y > 0.5) {
  float gx = uGuide.x + uGuide.z * (-p.z - uL); // the ball's track over the rug as it comes in
  float gw = max(0.35, px * 1.6);
  float gl = (1.0 - smoothstep(gw, gw + px, abs(p.x - gx))) * step(0.4, fract(p.z / 5.0)) * step(-uL + 1.5, p.z) * step(p.z, -uL + 40.0);
  c = mix(c, lin(vec3(1.0, 0.82, 0.3)), gl * 0.95);
}
// the pile: fine fibres up close, a soft sheen far away
c *= mix(0.78 + 0.4 * fine, 0.98, far) * (0.94 + 0.1 * fb(p.xz * 0.15));
diffuseColor.rgb = c;
`);
  };
  const rugLen = RUG_Z0 - RUG_Z1;
  const rugTop = new THREE.Mesh(new THREE.PlaneGeometry(RUG_HALF * 2, rugLen, 1, 1), rugMat);
  rugTop.rotation.x = -Math.PI / 2; rugTop.position.set(0, 0, (RUG_Z0 + RUG_Z1) / 2); rugTop.receiveShadow = true; scene.add(rugTop);
  const rugSide = std(0x7c1c14, { roughness: 1 });
  [-1, 1].forEach(s => scene.add(mesh(B(0.3, RUG_T, rugLen), rugSide, s * (RUG_HALF - 0.15), -RUG_T / 2, (RUG_Z0 + RUG_Z1) / 2, false)));
  { // fringe at both ends
    const tex = canvasTex(256, 32, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { g.fillStyle = `rgba(${236 - (i % 7) * 4},${224 - (i % 5) * 5},196,1)`; g.fillRect(i, 0, 2, h - (i * 7919 % 9)); } });
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(6, 1);
    const fm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 1, side: THREE.DoubleSide });
    [[RUG_Z0, 1], [RUG_Z1, -1]].forEach(([z, s]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(RUG_HALF * 2, 1.6), fm); m.rotation.x = -Math.PI / 2; m.position.set(0, -RUG_T + 0.03, z + s * 0.8); m.receiveShadow = true; scene.add(m); });
  }

  /* ---------- walls, skirting, ceiling ---------- */
  const paper = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#cfe0e8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c3d6df'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
    const star = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
    star(48, 60, 13, '#f7e9b0'); star(176, 150, 11, '#ffffff'); star(110, 220, 9, '#f7e9b0'); star(220, 40, 7, '#ffffff'); star(20, 180, 6, '#ffffff');
    g.fillStyle = '#ffffff'; [[150, 70], [70, 130]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 10, 0, 7); g.arc(x + 12, y - 4, 12, 0, 7); g.arc(x + 25, y, 9, 0, 7); g.fill(); });
  });
  paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
  const wallMat = (rx, ry) => { const t = paper.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return std(0xffffff, { map: t, roughness: 0.92 }); };
  const wall = (w, h, d, x, y, z, rx, ry) => { const m = mesh(B(w, h, d), wallMat(rx, ry), x, y, z, false); scene.add(m); return m; };
  // left wall with the sunbeam window
  const LZ0 = WALL_Z - 2, LZ1 = Z1 + 2;
  wall(2, CEIL, LWIN.z0 - LZ0, X0 - 1, CEIL / 2, (LZ0 + LWIN.z0) / 2, 4, 3);
  wall(2, CEIL, LZ1 - LWIN.z1, X0 - 1, CEIL / 2, (LWIN.z1 + LZ1) / 2, 4, 3);
  wall(2, LWIN.y0 + 1, LWIN.z1 - LWIN.z0, X0 - 1, (LWIN.y0 - 1) / 2, (LWIN.z0 + LWIN.z1) / 2, 1, 1);
  wall(2, CEIL - LWIN.y1, LWIN.z1 - LWIN.z0, X0 - 1, (LWIN.y1 + CEIL) / 2, (LWIN.z0 + LWIN.z1) / 2, 1, 1);
  wall(2, CEIL, LZ1 - LZ0, X1 + 1, CEIL / 2, (LZ0 + LZ1) / 2, 8, 3);
  // far wall with the big window
  wall(FWIN.x0 - X0 + 2, CEIL, 2, (X0 - 2 + FWIN.x0) / 2, CEIL / 2, WALL_Z - 1, 2.4, 3);
  wall(X1 + 2 - FWIN.x1, CEIL, 2, (FWIN.x1 + X1 + 2) / 2, CEIL / 2, WALL_Z - 1, 2.4, 3);
  wall(FWIN.x1 - FWIN.x0, FWIN.y0 + 1, 2, 0, (FWIN.y0 - 1) / 2, WALL_Z - 1, 1, 1);
  wall(FWIN.x1 - FWIN.x0, CEIL - FWIN.y1, 2, 0, (FWIN.y1 + CEIL) / 2, WALL_Z - 1, 1, 0.5);
  wall(X1 - X0 + 4, CEIL, 2, 0, CEIL / 2, Z1 + 1, 6, 3);
  const ceil = mesh(B(X1 - X0 + 4, 2, Z1 - WALL_Z + 4), std(0xf4efe6, { roughness: 1 }), 0, CEIL + 1, (Z1 + WALL_Z) / 2, false); scene.add(ceil);
  const white = std(0xf6f2ea, { roughness: 0.5 });
  scene.add(mesh(B(0.7, 3, LZ1 - LZ0), white, X0 + 0.35, 1.2, (LZ0 + LZ1) / 2, false), mesh(B(0.7, 3, LZ1 - LZ0), white, X1 - 0.35, 1.2, (LZ0 + LZ1) / 2, false));
  scene.add(mesh(B(X1 - X0, 3, 0.7), white, 0, 1.2, WALL_Z + 0.35, false), mesh(B(X1 - X0, 3, 0.7), white, 0, 1.2, Z1 - 0.35, false));
  { // a wall socket on the skirting for scale, and the light switch
    const plate = mesh(B(2.2, 3.4, 0.25), white, 30, 9.5, WALL_Z + 0.15, false); scene.add(plate);
    [-0.5, 0.5].forEach(dx => scene.add(mesh(B(0.18, 0.55, 0.1), basic(0x3a3632), 30 + dx, 10.1, WALL_Z + 0.3, false)));
    scene.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 10).rotateX(Math.PI / 2), basic(0x3a3632), 30, 8.9, WALL_Z + 0.3, false));
  }

  /* ---------- windows: frames, sills, curtains, the garden outside ---------- */
  const frameMat = std(0xfbf8f0, { roughness: 0.45 });
  function windowFrame(w, h) { // in the XY plane, centred, facing +z
    const g = new THREE.Group(), t = 1.4, d = 2.4;
    g.add(mesh(B(w + t * 2, t, d), frameMat, 0, h / 2 + t / 2, 0), mesh(B(w + t * 2, t, d), frameMat, 0, -h / 2 - t / 2, 0));
    g.add(mesh(B(t, h, d), frameMat, -w / 2 - t / 2, 0, 0), mesh(B(t, h, d), frameMat, w / 2 + t / 2, 0, 0));
    g.add(mesh(B(0.9, h, 1.2), frameMat, 0, 0, 0), mesh(B(w, 0.9, 1.2), frameMat, 0, 0, 0));
    g.add(mesh(B(w + 7, 1.1, 4.4), frameMat, 0, -h / 2 - t - 0.5, 1.6)); // sill
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0xdfeef8, transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0, depthWrite: false }));
    g.add(glass);
    return g;
  }
  const fw = windowFrame(FWIN.x1 - FWIN.x0, FWIN.y1 - FWIN.y0); fw.position.set(0, (FWIN.y0 + FWIN.y1) / 2, WALL_Z); scene.add(fw);
  const lw = windowFrame(LWIN.z1 - LWIN.z0, LWIN.y1 - LWIN.y0); lw.rotation.y = Math.PI / 2; lw.position.set(X0, (LWIN.y0 + LWIN.y1) / 2, (LWIN.z0 + LWIN.z1) / 2); scene.add(lw);
  { // curtains: sunny yellow gingham, gathered in soft folds
    const tex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#fff6dc'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(240,184,40,0.55)'; g.fillRect(0, 0, 32, 64); g.fillRect(0, 0, 64, 32); g.fillStyle = 'rgba(230,160,20,0.5)'; g.fillRect(0, 0, 32, 32); });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(6, 12);
    const cm = std(0xffffff, { map: tex, roughness: 0.95, side: THREE.DoubleSide });
    const panel = (w, h, folds) => { const g = new THREE.PlaneGeometry(w, h, folds * 6, 8), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), k = (y + h / 2) / h; p.setZ(i, Math.sin(x / w * folds * Math.PI * 2) * (0.9 + 0.5 * (1 - k))); p.setX(i, x * (0.85 + 0.15 * k)); } g.computeVertexNormals(); return g; };
    const top = FWIN.y1 + 6, ch = top - FWIN.y0 + 8;
    [-1, 1].forEach(s => { const m = mesh(panel(14, ch, 4), cm, s * (FWIN.x1 + 6), top - ch / 2, WALL_Z + 2.6); scene.add(m); });
    scene.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 56, 10).rotateZ(Math.PI / 2), std(0xc89a58, { roughness: 0.4, metalness: 0.3 }), 0, top + 0.4, WALL_Z + 2.8));
    const lt = LWIN.y1 + 6, lh = lt - LWIN.y0 + 8;
    [-1, 1].forEach(s => { const m = mesh(panel(12, lh, 3), cm, X0 + 2.6, lt - lh / 2, (LWIN.z0 + LWIN.z1) / 2 + s * ((LWIN.z1 - LWIN.z0) / 2 + 5)); m.rotation.y = Math.PI / 2; scene.add(m); });
  }
  { // on the far sill: a cactus in a terracotta pot and a little sailboat
    const sy = FWIN.y0 - 1.4 + 0.55, sz = WALL_Z + 2.4;
    const pot = mesh(new THREE.CylinderGeometry(2.4, 1.8, 3.6, 18), std(0xc5653a, { roughness: 0.9 }), -10, sy + 1.8, sz); scene.add(pot);
    const cac = std(0x4f8a3c, { roughness: 0.7 });
    scene.add(mesh(new THREE.CapsuleGeometry(1.2, 4.5, 6, 12), cac, -10, sy + 6.6, sz));
    const arm = mesh(new THREE.CapsuleGeometry(0.6, 1.8, 4, 10), cac, -8.6, sy + 7.2, sz); scene.add(arm);
    scene.add(mesh(new THREE.CapsuleGeometry(0.55, 1.2, 4, 10), cac, -11.3, sy + 6.0, sz));
    const hull = mesh(B(5, 1.4, 1.6), std(0x2f6fb5, { roughness: 0.5 }), 9, sy + 0.7, sz); scene.add(hull);
    scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), std(0xd8b27a), 9, sy + 4, sz));
    const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5.2, 0), new THREE.Vector3(2.8, 0, 0)]), std(0xfff8ee, { side: THREE.DoubleSide })); sail.geometry.computeVertexNormals(); sail.position.set(9.2, sy + 1.6, sz); scene.add(sail);
  }
  { // outside: the garden fence and a big tree, seen through the windows (shrunk, so giant)
    const fm = std(0xe9e3d6, { roughness: 0.9 });
    const fence = new THREE.InstancedMesh(B(14, 64, 2), fm, 60);
    for (let i = 0; i < 60; i++) { const m = new THREE.Matrix4().makeTranslation(-450 + i * 15.5, 30, -300 - (i % 2) * 0.5); fence.setMatrixAt(i, m); }
    fence.receiveShadow = true; scene.add(fence);
    const leafs = std(0x5b8a3a, { roughness: 0.95 }), leafs2 = std(0x6f9e45, { roughness: 0.95 });
    const tree = new THREE.Group(); tree.position.set(-60, 0, -760);
    tree.add(mesh(new THREE.CylinderGeometry(16, 24, 260, 10), std(0x6a4b32), 0, 130, 0, false));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i ? 85 : 0; const b = mesh(new THREE.IcosahedronGeometry(85 + R() * 30, 1), i % 2 ? leafs : leafs2, Math.cos(a) * r, 290 + R() * 60 + (i ? 0 : 60), Math.sin(a) * r * 0.6, false); tree.add(b); }
    scene.add(tree);
    const t2 = tree.clone(); t2.position.set(380, -30, -980); t2.scale.setScalar(0.9); scene.add(t2);
  }

  /* ---------- sunbeams: a soft shaft of light and dust drifting in it ---------- */
  const beams = new THREE.Group(); scene.add(beams);
  function beam(corners) { // window corners (world) → their spots on the floor along the sun
    const fl = corners.map(c => c.clone().addScaledVector(sd, -(c.y + RUG_T) / sd.y));
    const g = new THREE.BufferGeometry(), v = [], cl = [];
    const quad = (a, b, c, d, ia, ib) => { for (const [p, al] of [[a, ia], [b, ia], [c, ib], [a, ia], [c, ib], [d, ib]]) { v.push(p.x, p.y, p.z); cl.push(1, 0.9, 0.7, al); } };
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(corners[i], corners[j], fl[j], fl[i], 0.13, 0.015); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.renderOrder = 3; beams.add(m);
    return { corners, fl };
  }
  const lb = beam([new THREE.Vector3(X0, LWIN.y0, LWIN.z0), new THREE.Vector3(X0, LWIN.y0, LWIN.z1), new THREE.Vector3(X0, LWIN.y1, LWIN.z1), new THREE.Vector3(X0, LWIN.y1, LWIN.z0)]);
  beam([new THREE.Vector3(FWIN.x0, FWIN.y0, WALL_Z), new THREE.Vector3(FWIN.x1, FWIN.y0, WALL_Z), new THREE.Vector3(FWIN.x1, FWIN.y1, WALL_Z), new THREE.Vector3(FWIN.x0, FWIN.y1, WALL_Z)]);
  const dustTex = canvasTex(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, false);
  const ND = 260, dustGeo = new THREE.BufferGeometry(), dpos = new Float32Array(ND * 3), dseed = [];
  for (let i = 0; i < ND; i++) dseed.push({ u: R(), v: R(), s: R(), ph: R() * 6.28 });
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, color: 0xfff0c8, size: 0.5, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  dust.frustumCulled = false; scene.add(dust);
  function moveDust(t) {
    const c = lb.corners;
    dseed.forEach((d, i) => {
      const z = c[0].z + (c[1].z - c[0].z) * d.u, y = c[0].y + (c[2].y - c[0].y) * d.v;
      const k = ((d.s + t * 0.004) % 1) * (y / sd.y) * 0.95;
      dpos[i * 3] = X0 - sd.x * k + Math.sin(t * 0.3 + d.ph) * 1.2; dpos[i * 3 + 1] = y - sd.y * k + Math.sin(t * 0.21 + d.ph * 2) * 1.0; dpos[i * 3 + 2] = z - sd.z * k + Math.cos(t * 0.25 + d.ph) * 1.2;
    });
    dustGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- furniture ---------- */
  { // the bed along the right wall: a white wooden frame, patchwork quilt, pillow, teddy on top
    const bx0 = 34, bx1 = X1 - 1, bz0 = -62, bz1 = -120, bw = bx1 - bx0, bl = bz0 - bz1, bxC = (bx0 + bx1) / 2, bzC = (bz0 + bz1) / 2;
    const frame = std(0xf2ede4, { roughness: 0.5 });
    [[bx0, bz0, 20], [bx1, bz0, 20], [bx0, bz1, 30], [bx1, bz1, 30]].forEach(([x, z, h]) => scene.add(mesh(B(2.2, h, 2.2), frame, x, h / 2 - RUG_T, z)));
    scene.add(mesh(B(bw, 14, 1.2), frame, bxC, 22, bz1 + 0.4));      // headboard
    scene.add(mesh(B(bw, 6, 1.2), frame, bxC, 15, bz0 - 0.4));       // footboard
    scene.add(mesh(B(bw - 1, 4, bl - 2), std(0xe8e2d6), bxC, 9, bzC));
    const quiltTex = canvasTex(256, 256, (g, w, h) => {
      const cols = ['#f2b8a8', '#a8d4e6', '#f6dc8e', '#b8dcae', '#d9c2ea', '#ffffff', '#f4a96a'];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = cols[(i * 3 + j * 5 + (i * j) % 3) % cols.length]; g.fillRect(i * 32, j * 32, 32, 32); g.fillStyle = 'rgba(255,255,255,0.35)'; if ((i + j) % 2) { g.beginPath(); g.arc(i * 32 + 16, j * 32 + 16, 7, 0, 7); g.fill(); } }
      g.strokeStyle = 'rgba(120,90,70,0.5)'; g.setLineDash([3, 3]); g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
    });
    quiltTex.wrapS = quiltTex.wrapT = THREE.RepeatWrapping; quiltTex.repeat.set(1.5, 2.5);
    const qm = std(0xffffff, { map: quiltTex, roughness: 0.95 });
    const quilt = new THREE.BoxGeometry(bw + 1, 13, bl - 12, 12, 6, 16), qp = quilt.attributes.position; // drape: puffy top, sides hanging and flaring
    for (let i = 0; i < qp.count; i++) { const x = qp.getX(i), y = qp.getY(i), z = qp.getZ(i), k = (6.5 - y) / 13; qp.setX(i, x * (1 + k * 0.06)); qp.setY(i, y + (y > 6 ? Math.sin(x * 0.4) * 0.3 + Math.cos(z * 0.3) * 0.3 : 0)); qp.setZ(i, z * (1 + k * 0.03)); }
    quilt.computeVertexNormals();
    scene.add(mesh(quilt, qm, bxC, 11.5, bzC + 6));
    const pillow = new THREE.SphereGeometry(1, 24, 12); pillow.scale(bw * 0.4, 3, 6);
    scene.add(mesh(pillow, std(0xfffdf8, { roughness: 0.9 }), bxC, 20, bz1 + 7));
    bear(bxC - 2, 19, bz1 + 9, -0.55);
  }
  function bear(x, y, z, rotY) { // a fuzzy teddy, sitting
    const tex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#9a6a3e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const s = R(); g.fillStyle = `rgba(${s > 0.5 ? '70,44,22' : '196,150,100'},${0.2 + R() * 0.25})`; g.fillRect(R() * w, R() * h, 1, 2 + R() * 3); } });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
    const fur = std(0xffffff, { map: tex, roughness: 1 }), pale = std(0xe2c29a, { roughness: 1 }), eye = std(0x111111, { roughness: 0.15 });
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY;
    const S = (r, sx, sy, sz, m, px, py, pz) => { const ge = new THREE.SphereGeometry(r, 24, 16); ge.scale(sx, sy, sz); const o = mesh(ge, m, px, py, pz); g.add(o); return o; };
    S(1, 4.2, 4.8, 3.8, fur, 0, 4.6, 0);                 // body
    S(1, 2.6, 2.8, 2.2, pale, 0, 4.2, 2.1);              // tummy
    S(1, 3.4, 3.1, 3.1, fur, 0, 11, 0.3);                // head
    S(1, 1.5, 1.1, 1.3, pale, 0, 10.4, 3.1);             // muzzle
    S(0.55, 1, 0.8, 0.7, eye, 0, 11.0, 4.3);             // nose
    [-1, 1].forEach(s => {
      S(0.42, 1, 1, 1, eye, s * 1.25, 12.2, 2.75);       // eyes
      S(1, 1.25, 1.25, 0.6, fur, s * 2.6, 13.7, -0.2);   // ears
      S(1, 0.7, 0.7, 0.4, pale, s * 2.6, 13.7, 0.2);
      const arm = S(1, 1.3, 3.2, 1.3, fur, s * 4.4, 5.8, 0.8); arm.rotation.z = s * 0.5; arm.rotation.x = -0.4;
      const leg = S(1, 1.6, 1.5, 3.2, fur, s * 2.4, 1.4, 2.8);
      S(1, 1.1, 1.1, 0.3, pale, s * 2.4, 1.4, 6.0);      // paw pads
    });
    const bow = std(0xd83a3a, { roughness: 0.6 });
    [-1, 1].forEach(s => { const b = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), bow); b.rotation.z = s * Math.PI / 2; b.position.set(s * 1.1, 8.1, 2.6); b.castShadow = true; g.add(b); });
    S(0.5, 1, 1, 1, bow, 0, 8.1, 2.8);
    scene.add(g);
  }
  { // the dresser by the far left corner, with a lamp that's switched on
    const dx = X0 + 9, dz = -160, w = 30, h = 30, d = 16;
    const dm = std(0xf3dc96, { roughness: 0.55 }), knob = std(0xffffff, { roughness: 0.3 });
    scene.add(mesh(B(d, h, w), dm, dx, h / 2 - RUG_T, dz));
    scene.add(mesh(B(d + 1.4, 1.2, w + 1.4), std(0xe9cd82, { roughness: 0.45 }), dx, h - RUG_T + 0.3, dz));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const y = 5 + r * 8.5, z = dz - w / 4 + c * w / 2;
      scene.add(mesh(B(0.6, 7.4, w / 2 - 1.2), std(0xf7e4a8, { roughness: 0.5 }), dx + d / 2 + 0.2, y, z));
      scene.add(mesh(new THREE.SphereGeometry(0.75, 12, 8), knob, dx + d / 2 + 0.9, y, z));
    }
    const top = h - RUG_T + 0.9;
    scene.add(mesh(new THREE.CylinderGeometry(2.2, 3, 1.2, 16), std(0x6aa0c8, { roughness: 0.4 }), dx, top + 0.6, dz - 8));
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 9, 8), std(0xd0c8b8, { metalness: 0.5, roughness: 0.3 }), dx, top + 5, dz - 8));
    const shade = mesh(new THREE.CylinderGeometry(3.4, 5.6, 6.4, 22, 1, true), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffc878, emissiveIntensity: 0.9, side: THREE.DoubleSide, roughness: 0.9 }), dx, top + 11, dz - 8);
    scene.add(shade);
    const lamp = new THREE.PointLight(0xffc27a, 1.6, 110, 1.6); lamp.position.set(dx + 2, top + 10, dz - 8); scene.add(lamp);
    const pig = new THREE.SphereGeometry(1, 18, 12); pig.scale(3, 2.4, 2.2);
    const pg = mesh(pig, std(0xf2a3b5, { roughness: 0.35 }), dx + 1, top + 2.4, dz + 6); scene.add(pg);
    [-1, 1].forEach(s => [-1, 1].forEach(t => scene.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 8), std(0xf2a3b5), dx + 1 + t * 1.6, top + 0.5, dz + 6 + s * 1.1))));
    const ph = canvasTex(64, 80, (g, w, hh) => { g.fillStyle = '#7fc4e8'; g.fillRect(0, 0, w, hh); g.fillStyle = '#5aa04a'; g.fillRect(0, 52, w, 28); g.fillStyle = '#ffe070'; g.beginPath(); g.arc(46, 18, 9, 0, 7); g.fill(); g.fillStyle = '#d94a3a'; g.fillRect(14, 36, 18, 18); g.beginPath(); g.moveTo(10, 38); g.lineTo(23, 26); g.lineTo(36, 38); g.fill(); });
    const frameP = group(mesh(B(0.6, 9, 7.4), std(0x8a5a34), 0, 0, 0), mesh(B(0.2, 7.6, 6), std(0xffffff, { map: ph }), 0.35, 0, 0));
    frameP.position.set(dx - 3, top + 4.5, dz + 11); frameP.rotation.z = 0.12; frameP.rotation.y = 0.5; scene.add(frameP);
  }
  { // a low toy shelf under the left window: cubbies of coloured bins, books and a globe on top
    const sx = X0 + 5, z0 = LWIN.z0 - 4, z1 = LWIN.z1 + 4, h = 22, d = 10, w = z1 - z0;
    const wm = std(0xffffff, { roughness: 0.6 });
    scene.add(mesh(B(d, 1.2, w), wm, sx, h - RUG_T, (z0 + z1) / 2), mesh(B(d, 1.2, w), wm, sx, 10.5, (z0 + z1) / 2));
    for (let i = 0; i <= 4; i++) scene.add(mesh(B(d, h, 1.2), wm, sx, h / 2 - RUG_T, z0 + i * w / 4));
    const bins = [0xe25b45, 0x3e8ed0, 0xf2c230, 0x58b368];
    for (let i = 0; i < 4; i++) for (let r = 0; r < 2; r++) scene.add(mesh(B(d - 1.5, 8, w / 4 - 2.6), std(bins[(i + r * 2) % 4], { roughness: 0.6 }), sx + 0.6, 4.3 + r * 11, z0 + (i + 0.5) * w / 4));
    let z = z0 + 3; const bc = [0x2f5f9e, 0xc84a3a, 0x3f8f5a, 0xe6b23a, 0x7a4a9e, 0x1f7f8f];
    for (let i = 0; i < 9; i++) { const bh = 6 + R() * 3, bt = 1.1 + R() * 0.7; scene.add(mesh(B(6.5, bh, bt), std(bc[i % bc.length], { roughness: 0.7 }), sx, h - RUG_T + 0.6 + bh / 2, z)); z += bt + 0.15; }
    const globeTex = canvasTex(256, 128, (g, w, hh) => { g.fillStyle = '#3d86c6'; g.fillRect(0, 0, w, hh); g.fillStyle = '#6fbf5a'; [[40, 40, 30, 22], [120, 56, 22, 34], [180, 36, 40, 20], [200, 90, 20, 14], [70, 92, 16, 12]].forEach(([x, y, a, b]) => { g.beginPath(); g.ellipse(x, y, a, b, 0.3, 0, 7); g.fill(); }); });
    const globe = mesh(new THREE.SphereGeometry(4.2, 28, 18), std(0xffffff, { map: globeTex, roughness: 0.4 }), sx, h - RUG_T + 9.5, z1 - 8); globe.rotation.z = 0.4; scene.add(globe);
    scene.add(mesh(new THREE.CylinderGeometry(1.6, 2.4, 1, 14), std(0x8a5a34), sx, h - RUG_T + 1.1, z1 - 8), mesh(new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6), std(0xc89a58, { metalness: 0.5 }), sx, h - RUG_T + 3.6, z1 - 8));
  }
  { // kid's drawings taped to the far wall: a house in the sun, and a golfer with a flag
    const crayon = (g, pts, c, w = 5) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + (R() - 0.5) * 2, y + (R() - 0.5) * 2) : g.moveTo(x, y))); g.stroke(); };
    const scribble = (g, x0, y0, x1, y1, c) => { g.strokeStyle = c; g.lineWidth = 3; g.globalAlpha = 0.75; g.beginPath(); for (let y = y0; y < y1; y += 5) { g.moveTo(x0 + R() * 4, y); g.lineTo(x1 - R() * 4, y + 3); } g.stroke(); g.globalAlpha = 1; };
    const paperBg = (g, w, h) => { g.fillStyle = '#fbfaf4'; g.fillRect(0, 0, w, h); };
    const house = canvasTex(320, 240, (g, w, h) => {
      paperBg(g, w, h); scribble(g, 0, 190, w, h, '#5fb34a');
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(262, 52, 30, 0, 7); g.fill();
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; crayon(g, [[262 + Math.cos(a) * 38, 52 + Math.sin(a) * 38], [262 + Math.cos(a) * 54, 52 + Math.sin(a) * 54]], '#f5b322', 4); }
      scribble(g, 70, 120, 180, 196, '#e2543e'); crayon(g, [[60, 124], [125, 60], [190, 124], [60, 124]], '#7a4a2a', 6);
      scribble(g, 112, 150, 138, 196, '#4a7ad6'); crayon(g, [[150, 132], [172, 132], [172, 152], [150, 152], [150, 132]], '#4a7ad6', 4);
      crayon(g, [[36, 30], [56, 22], [76, 32], [96, 24]], '#5a8ad8', 4);
    });
    const golfer = canvasTex(320, 240, (g, w, h) => {
      paperBg(g, w, h); scribble(g, 0, 196, w, h, '#5fb34a'); scribble(g, 210, 182, 290, 200, '#3f9a3a');
      crayon(g, [[256, 190], [256, 92]], '#333', 4); g.fillStyle = '#e8463c'; g.beginPath(); g.moveTo(256, 92); g.lineTo(296, 106); g.lineTo(256, 120); g.fill();
      g.strokeStyle = '#333'; g.lineWidth = 5; g.beginPath(); g.arc(96, 84, 16, 0, 7); g.stroke();
      crayon(g, [[96, 100], [96, 150]], '#333'); crayon(g, [[96, 150], [78, 194]], '#333'); crayon(g, [[96, 150], [114, 194]], '#333');
      crayon(g, [[96, 116], [124, 132], [150, 104]], '#333'); crayon(g, [[96, 116], [126, 136]], '#333'); crayon(g, [[150, 104], [176, 70]], '#8a5a34', 4);
      g.fillStyle = '#fff'; g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.arc(200, 60, 6, 0, 7); g.fill(); g.stroke();
      crayon(g, [[182, 76], [190, 66]], '#999', 2); crayon(g, [[176, 82], [186, 74]], '#999', 2);
      g.fillStyle = '#2a64c4'; g.font = '700 30px "Comic Sans MS", "Chalkboard SE", cursive'; g.fillText('ME!', 40, 40);
    });
    const tape = new THREE.MeshStandardMaterial({ color: 0xf6efc8, transparent: true, opacity: 0.7, roughness: 0.6 });
    [[house, -40, 40, -0.05], [golfer, 40, 42, 0.06]].forEach(([tex, x, y, r]) => {
      const pg = new THREE.Group(); pg.position.set(x, y, WALL_Z + 0.08); pg.rotation.z = r;
      const pp = new THREE.Mesh(new THREE.PlaneGeometry(20, 15), std(0xffffff, { map: tex, roughness: 0.95 })); pp.receiveShadow = true; pg.add(pp);
      [[-9, 6.8, 0.6], [9, 6.8, -0.5]].forEach(([tx, ty, tr]) => { const t = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.4), tape); t.position.set(tx, ty, 0.05); t.rotation.z = tr; pg.add(t); });
      scene.add(pg);
    });
  }

  /* ---------- toys on the floor ---------- */
  const blockTex = (ch, bg) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = '#fffaf0'; g.font = '800 82px "Saira Semi Condensed", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, w / 2, h / 2 + 4); });
  const blockMats = [['A', '#e2543e'], ['B', '#3e8ed0'], ['C', '#f2b830'], ['D', '#58b368'], ['G', '#8a5ac8'], ['O', '#f08a3a'], ['L', '#2f9ea8'], ['F', '#e2543e']].map(([c, b]) => std(0xffffff, { map: blockTex(c, b), roughness: 0.55 }));
  const blockGeo = B(2.4, 2.4, 2.4); blockGeo.translate(0, 1.2, 0);
  const block = (x, z, y = -RUG_T, ry = R() * 6.3, mi = Math.floor(R() * blockMats.length)) => { const b = mesh(blockGeo, blockMats[mi], x, y, z); b.rotation.y = ry; scene.add(b); return b; };
  // a tower spelling G-O-L-F (well, nearly), and blocks scattered by the lane
  [[4], [5], [6], [7]].forEach(([mi], i) => block(-22, -46, -RUG_T + i * 2.4, 0.2 * i - 0.3, mi));
  [[-19, -30], [-24, -36], [-18, -60], [21, -40], [24, -34], [26, -66], [-28, -120], [30, -140], [-20, -8.5], [22, -12]].forEach(([x, z]) => block(x, z));
  block(24.6, -35, -RUG_T + 2.4);
  { // wooden building planks and an arch
    const pm = std(0xd8a868, { roughness: 0.6 });
    scene.add(mesh(B(9, 1.2, 2.4), pm, -26, 0.3, -96), mesh(B(2.4, 6, 2.4), pm, 18, 2.7, -100), mesh(B(2.4, 6, 2.4), pm, 25, 2.7, -100), mesh(B(10, 1.6, 2.6), std(0xe2543e, { roughness: 0.55 }), 21.5, 6.5, -100));
  }
  { // crayons, the size of logs, spilled from their box near the tee
    const colors = [0xd8352a, 0x2a62c8, 0x2f9a48, 0xf2c21e, 0x7c4ac0, 0xf0782a, 0xe85a9a];
    const cr = (x, z, ry, ci, y = -RUG_T + 0.27) => {
      const c = colors[ci % colors.length], g = new THREE.Group();
      const wax = std(c, { roughness: 0.55 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 2.4, 12), [wax, wax, wax]); body.castShadow = true;
      const wr = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 1.9, 12, 1, true), std(new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.12), { roughness: 0.85 }));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.55, 12), wax); tip.position.y = 1.47; tip.castShadow = true;
      g.add(body, wr, tip); g.rotation.z = Math.PI / 2; g.rotation.y = ry; g.position.set(x, y, z);
      g.traverse(o => { if (o.isMesh) o.receiveShadow = true; }); scene.add(g);
    };
    [[-13.4, -27, 0.3], [-12.2, -28.4, 0.9], [-14.6, -29.6, -0.4], [-11.6, -31, 1.6], [13.6, -30, -0.6], [14.8, -32.5, 0.2]].forEach(([x, z, r], i) => cr(x, z, r, i));
    const box = new THREE.Group(); box.position.set(-17.4, -RUG_T, -33); box.rotation.y = 0.5;
    box.add(mesh(B(3.4, 4.2, 1.2), std(0xf2c21e, { roughness: 0.7 }), 0, 2.1, 0), mesh(B(3.4, 0.6, 1.2), std(0x2f9a48, { roughness: 0.7 }), 0, 3.6, 0.02));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.CylinderGeometry(0.27, 0.27, 2, 10), std(colors[i + 2]), -1.1 + i * 0.72, 4.4, 0); box.add(c); const t = mesh(new THREE.ConeGeometry(0.27, 0.5, 10), std(colors[i + 2]), -1.1 + i * 0.72, 5.6, 0); box.add(t); }
    scene.add(box);
  }
  { // marbles
    const mc = [0x3aa0e8, 0xe8503a, 0x40c070, 0xf0c020];
    [[11.2, -20], [11.9, -20.8], [-11.4, -38], [16, -44], [-16, -52]].forEach(([x, z], i) => scene.add(mesh(new THREE.SphereGeometry(0.48, 18, 12), new THREE.MeshPhysicalMaterial({ color: mc[i % 4], roughness: 0.05, metalness: 0, clearcoat: 1, transmission: 0, envMapIntensity: 1.5 }), x, -RUG_T + 0.48, z)));
  }
  { // a little red race car
    const car = new THREE.Group(); car.position.set(20, -RUG_T, -52); car.rotation.y = 0.7;
    car.add(mesh(B(2.4, 0.9, 5), std(0xd8302a, { roughness: 0.3, metalness: 0.2 }), 0, 1.0, 0), mesh(B(1.9, 0.8, 2.2), std(0x222a33, { roughness: 0.15 }), 0, 1.8, -0.2));
    [[-1.25, 1.6], [1.25, 1.6], [-1.25, -1.6], [1.25, -1.6]].forEach(([x, z]) => { const w = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.5, 14).rotateZ(Math.PI / 2), std(0x1a1a1a, { roughness: 0.8 }), x, 0.62, z); car.add(w); });
    scene.add(car);
  }
  { // a striped beach ball by the bed
    const tex = canvasTex(256, 64, (g, w, h) => { const c = ['#e8463c', '#ffffff', '#f2c21e', '#ffffff', '#3e8ed0', '#ffffff']; c.forEach((cc, i) => { g.fillStyle = cc; g.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
    const bb = mesh(new THREE.SphereGeometry(5.5, 32, 20), std(0xffffff, { map: tex, roughness: 0.35 }), 26, 5.2 - RUG_T, -146); bb.rotation.set(0.4, 0.3, 0.2); scene.add(bb);
  }
  // a spinning top, gently spinning
  const top = new THREE.Group(); top.position.set(-24, -RUG_T, -76);
  { const tm = std(0x3e8ed0, { roughness: 0.35 }), tm2 = std(0xf2c21e, { roughness: 0.35 });
    const body = new THREE.LatheGeometry([[0, 0], [0.4, 0.3], [2.6, 2.2], [2.8, 2.6], [2.2, 3.2], [0.4, 3.4], [0.3, 5.2], [0, 5.3]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
    const b = mesh(body, tm); top.add(b); const band = mesh(new THREE.TorusGeometry(2.72, 0.18, 6, 32).rotateX(Math.PI / 2), tm2, 0, 2.4, 0); top.add(band); scene.add(top); }

  /* ---------- the toy train, looping through the sunbeam ---------- */
  const TR = { cx: -34, cz: -74, rx: 12, rz: 24 };
  const trackAt = u => { const a = u * Math.PI * 2; return new THREE.Vector3(TR.cx + Math.cos(a) * TR.rx, 0, TR.cz + Math.sin(a) * TR.rz); };
  {
    const N = 120, geoPts = [];
    for (let i = 0; i <= N; i++) geoPts.push(trackAt(i / N));
    const curve = new THREE.CatmullRomCurve3(geoPts, true);
    const shape = new THREE.Shape(); shape.moveTo(-1.3, 0); shape.lineTo(1.3, 0); shape.lineTo(1.3, 0.36); shape.lineTo(0.9, 0.36); shape.lineTo(0.9, 0.2); shape.lineTo(0.5, 0.2); shape.lineTo(0.5, 0.36); shape.lineTo(-0.5, 0.36); shape.lineTo(-0.5, 0.2); shape.lineTo(-0.9, 0.2); shape.lineTo(-0.9, 0.36); shape.lineTo(-1.3, 0.36); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { steps: 240, bevelEnabled: false, extrudePath: curve });
    const tr = mesh(geo, std(0xdcb278, { roughness: 0.6 }), 0, -RUG_T, 0); tr.castShadow = false; scene.add(tr);
  }
  const train = [];
  {
    const car = (len, bodyC, extra) => {
      const g = new THREE.Group(), wood = std(bodyC, { roughness: 0.5 });
      g.add(mesh(B(2.2, 1.6, len), wood, 0, 1.25, 0));
      [-1, 1].forEach(s => [-1, 1].forEach(t => g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14).rotateZ(Math.PI / 2), std(0xd8302a, { roughness: 0.5 }), s * 1.15, 0.6, t * len * 0.32))));
      if (extra) extra(g);
      scene.add(g); train.push({ g, len });
    };
    car(4.2, 0x2a62c8, g => { g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.6, 16).rotateX(Math.PI / 2), std(0x2a62c8, { roughness: 0.45 }), 0, 2.6, -0.7)); g.add(mesh(B(2.2, 2.2, 1.6), std(0xd8302a, { roughness: 0.5 }), 0, 3.0, 1.2)); g.add(mesh(B(2.5, 0.35, 2), std(0x222222), 0, 4.2, 1.2)); g.add(mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.4, 10), std(0x222222), 0, 3.9, -1.5)); });
    car(3.4, 0xf2c21e, g => g.add(mesh(B(1.6, 1.2, 2.6), std(0x58b368, { roughness: 0.5 }), 0, 2.6, 0)));
    car(3.4, 0xd8302a, g => [-0.6, 0.6].forEach(z => g.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 12), std(0x3e8ed0), 0, 2.65, z))));
    car(3.4, 0x58b368, g => g.add(mesh(B(1.8, 1.4, 2.8), std(0xf08a3a, { roughness: 0.5 }), 0, 2.7, 0)));
  }
  const perim = (() => { let L = 0, p = trackAt(0); for (let i = 1; i <= 400; i++) { const q = trackAt(i / 400); L += q.distanceTo(p); p = q; } return L; })();
  function moveTrain(t) {
    let s = (t * 3.2) % perim;
    train.forEach((c, i) => {
      const u = s / perim, a = trackAt(u), b = trackAt(u + 0.002);
      c.g.position.set(a.x, -RUG_T + 0.36, a.z); c.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI;
      s -= (c.len / 2 + (train[i + 1] ? train[i + 1].len / 2 : 0) + 0.7); if (s < 0) s += perim;
    });
  }

  /* ---------- the pins: giant white plastic toy pins with red neck stripes ---------- */
  const pinTex = canvasTex(4, 256, (g, w, h) => { g.fillStyle = '#fbf8f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#d42a24'; const band = (a, b) => g.fillRect(0, h - b * h, w, (b - a) * h); band(0.6, 0.635); band(0.665, 0.70); });
  const prof = [[0, 0], [0.066, 0], [0.092, 0.03], [0.128, 0.13], [0.159, 0.29], [0.146, 0.38], [0.12, 0.46], [0.082, 0.56], [0.06, 0.62], [0.064, 0.68], [0.078, 0.76], [0.084, 0.84], [0.076, 0.91], [0.056, 0.96], [0.03, 0.99], [0, 1]];
  const pinProfile = (() => { const pts = []; const N = 64; for (let i = 0; i <= N; i++) { const y = i / N; let k = 0; while (k < prof.length - 2 && prof[k + 1][1] < y) k++; const [r0, y0] = prof[k], [r1, y1] = prof[k + 1], u = (y - y0) / ((y1 - y0) || 1); const sm = u * u * (3 - 2 * u); pts.push(new THREE.Vector2((r0 + (r1 - r0) * (0.5 * u + 0.5 * sm)) * PIN_H, y * PIN_H)); } return pts; })();
  const pinGeo = new THREE.LatheGeometry(pinProfile, 28);
  const pinMat = new THREE.MeshStandardMaterial({ map: pinTex, roughness: 0.22, metalness: 0, envMapIntensity: 1.1 });
  const pins = rack(0).map(p => { const m = new THREE.Mesh(pinGeo, pinMat); m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m); return { n: p.n, m, home: new THREE.Vector3(), track: null, drop: 0, lift: 0, swept: false, sweepZ: 0 }; });
  const qT = new THREE.Quaternion(), qY = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3();
  function pose(pin, x, y, z, th, dirA, yaw) {
    tv.set(Math.sin(dirA) * Math.sin(th), Math.cos(th), Math.cos(dirA) * Math.sin(th));
    qT.setFromUnitVectors(UP, tv); qY.setFromAxisAngle(UP, yaw);
    pin.m.quaternion.copy(qY).multiply(qT);
    pin.m.position.set(x, y + PIN_R * 0.95 * Math.sin(Math.min(th, Math.PI / 2)), z);
  }
  // the deck's side rails (kickbacks), the cushion behind the pins, Beginner's foam-noodle bumpers
  const railMat = std(0xc8402e, { roughness: 0.5 });
  const rails = [-1, 1].map(s => { const m = mesh(B(1.1, 2.6, 1), railMat); scene.add(m); return m; });
  const cushionGeo = (() => { const g = new THREE.BoxGeometry(2 * KICK_X + 6, 9, 9, 16, 6, 6), p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 - 0.18 * (Math.abs(v.y) / 4.5) ** 2 - 0.12 * (Math.abs(v.z) / 4.5) ** 2; p.setXYZ(i, v.x * (1 - 0.04 * (v.y / 4.5) ** 2), v.y * (1 - 0.1 * (v.x / (KICK_X + 3)) ** 4), v.z * k); } g.computeVertexNormals(); return g; })();
  const cushionTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#9fc6e8'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,0.6)'; for (let x = 8; x < w; x += 22) for (let y = 8; y < h; y += 22) { g.beginPath(); g.arc(x + ((y / 22) % 2) * 11, y, 4, 0, 7); g.fill(); } });
  const cushion = mesh(cushionGeo, std(0xffffff, { map: cushionTex, roughness: 0.95 })); scene.add(cushion);
  const noodleMats = [0xff5fa8, 0x7ae04a, 0x3ab0ff, 0xffb02e].map(c => std(c, { roughness: 0.85 }));
  const bumpers = new THREE.Group(); scene.add(bumpers);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const m = mesh(new THREE.CylinderGeometry(0.85, 0.85, BUMPER_LEN / 3 - 0.3, 20).rotateX(Math.PI / 2), noodleMats[(i + (s > 0 ? 1 : 0)) % 4], s * (KICK_X + 0.55), 0.85, 0); m.userData.i = i; bumpers.add(m); }
  // the pinsetter: a wooden yardstick that sweeps the deck
  const stickTex = canvasTex(1024, 48, (g, w, h) => { g.fillStyle = '#e9c26a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,80,30,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(R() * w, 0, 1 + R() * 2, h); g.fillStyle = '#2a1f14'; for (let i = 0; i <= 36; i++) { const x = 10 + i * (w - 20) / 36; g.fillRect(x, 0, 2, i % 6 === 0 ? 20 : 12); if (i % 6 === 0 && i) { g.font = '700 16px sans-serif'; g.fillText(String(i), x + 3, 38); } } g.font = '700 14px sans-serif'; g.fillStyle = '#b8402a'; g.fillText('YARDSTICK', w / 2 - 40, 40); });
  const stick = mesh(B(2 * KICK_X + 2, 1.2, 0.3), [std(0xd8b060), std(0xd8b060), std(0xd8b060), std(0xd8b060), std(0xffffff, { map: stickTex, roughness: 0.6 }), std(0xd8b060)]);
  stick.visible = false; scene.add(stick);

  /* ---------- lane setup per difficulty ---------- */
  let L = 100 * YD, deckZ1 = deckEnd(L);
  const homes = () => rack(L);
  function setLane(diff) {
    L = diff.lane * YD; deckZ1 = deckEnd(L); U.uL.value = L;
    const len = deckZ1 - (L - 3);
    rails.forEach((m, i) => { m.scale.set(1, 1, len); m.position.set((i ? 1 : -1) * (KICK_X + 0.55), 1.3, -(L - 3) - len / 2); });
    cushion.position.set(0, 4.3, -deckZ1 - 4.5);
    bumpers.visible = !!diff.bumpers;
    bumpers.children.forEach(m => { m.position.z = -(L - BUMPER_LEN) - (m.userData.i + 0.5) * BUMPER_LEN / 3; });
    homes().forEach((h, i) => pins[i].home.set(h.x, 0, h.z));
    shadowFocus.set(0, 0, -Math.max(80, L * 0.62)); st.aimShadows(shadowFocus);
  }
  function setGuide(x, slope = 0) { U.uGuide.value.set(x == null ? 0 : x, x == null ? 0 : 1, slope); }

  /* ---------- pin animation: racking, playback, the sweep ---------- */
  let anim = null; // { type: 'drop'|'sweep', t, dur, ... }
  function setPins(up, { drop = false } = {}) {
    stick.visible = false;
    pins.forEach(p => { p.track = null; p.swept = false; p.lift = 0; const on = up.includes(p.n); p.m.visible = on; p.drop = on && drop ? 1 : 0; pose(p, p.home.x, 0, p.home.z, 0, 0, 0); p.m.material = pinMat; });
    if (drop) anim = { type: 'drop', t: 0, dur: 1.1 };
  }
  function playPins(tracks) { pins.forEach(p => { p.track = tracks[p.n] || null; }); }
  function sampleTrack(trk, t) {
    if (t <= trk[0][0]) return trk[0];
    if (t >= trk[trk.length - 1][0]) return trk[trk.length - 1];
    let lo = 0, hi = trk.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (trk[m][0] <= t) lo = m; else hi = m; }
    const a = trk[lo], b = trk[hi], u = (t - a[0]) / ((b[0] - a[0]) || 1);
    return a.map((v, i) => v + (b[i] - v) * u);
  }
  function posePins(t) {
    pins.forEach(p => { if (!p.m.visible || !p.track) return; const s = sampleTrack(p.track, t); if (t < p.track[0][0]) pose(p, p.home.x, 0, p.home.z, 0, 0, 0); else pose(p, s[1], s[2], s[3], s[4], s[5], s[6]); });
  }
  // the yardstick drops in front of the deck and pushes the fallen pins back into the cushion,
  // while the pins still standing are lifted clear and set back down
  function sweep(keep) {
    pins.forEach(p => { if (!p.m.visible) return; p.keep = keep.includes(p.n); p.base = { pos: p.m.position.clone(), q: p.m.quaternion.clone() }; });
    anim = { type: 'sweep', t: 0, dur: 2.0 };
    return anim.dur;
  }
  const ease = u => u * u * (3 - 2 * u);
  function stepAnim(dt) {
    if (!anim) return;
    anim.t += dt; const t = anim.t;
    if (anim.type === 'drop') {
      pins.forEach((p, i) => { if (!p.m.visible || !p.drop) return; const u = Math.max(0, Math.min(1, (t - i * 0.045) / 0.55)); const b = u < 1 ? 1 - (1 - u) * (1 - u) : 1; const bounce = u >= 1 ? Math.max(0, Math.sin(Math.min(1, (t - i * 0.045 - 0.55) / 0.25) * Math.PI)) * 0.35 : 0; pose(p, p.home.x, (1 - b) * 16 + bounce, p.home.z, 0, 0, 0); if (u >= 1 && t - i * 0.045 > 0.8) p.drop = 0; });
      if (t >= anim.dur) { pins.forEach(p => { if (p.m.visible) pose(p, p.home.x, 0, p.home.z, 0, 0, 0); p.drop = 0; }); anim = null; }
      return;
    }
    // sweep: 0–0.4 lift + stick drops · 0.4–1.3 stick slides back · 1.3–1.6 stick lifts · 1.5–2.0 pins set down
    const lift = t < 0.4 ? ease(t / 0.4) : t < 1.5 ? 1 : 1 - ease(Math.min(1, (t - 1.5) / 0.5));
    const sz0 = -(L - 4.5), sz1 = -(deckZ1 + 1.5);
    const sp = t < 0.4 ? 0 : Math.min(1, (t - 0.4) / 0.9), sZ = sz0 + (sz1 - sz0) * ease(sp);
    const sy = t < 0.4 ? 14 * (1 - ease(t / 0.4)) + 0.6 : t < 1.3 ? 0.6 : 0.6 + 16 * ease(Math.min(1, (t - 1.3) / 0.3));
    stick.visible = t < 1.62; stick.position.set(0, sy, sZ);
    pins.forEach(p => {
      if (!p.m.visible || !p.base) return;
      if (p.keep) { p.m.position.set(p.home.x, lift * 11, p.home.z); p.m.quaternion.set(0, 0, 0, 1); return; }
      const z = Math.min(p.base.pos.z, sZ - 1.0 - PIN_R);
      p.m.position.set(p.base.pos.x, p.base.pos.y, z);
      if (z < -deckZ1 - 2) p.m.visible = false;
    });
    if (t >= anim.dur) { pins.forEach(p => { if (p.keep && p.m.visible) pose(p, p.home.x, 0, p.home.z, 0, 0, 0); else p.m.visible = false; p.base = null; p.track = null; }); stick.visible = false; anim = null; }
  }

  function animate(clock, dt) {
    moveTrain(clock); moveDust(clock); stepAnim(dt);
    top.rotation.y += dt * 9; top.rotation.z = Math.sin(clock * 1.3) * 0.05; top.rotation.x = Math.cos(clock * 1.3) * 0.05;
  }

  setLane({ lane: 100, bumpers: true });
  return {
    renderer, scene, camera: st.camera, sunDir, groundAt, surfaceAt,
    aimShadows: () => {}, animate, setLane, setGuide, setPins, playPins, posePins, sweep,
    get L() { return L; }, get busy() { return !!anim; },
  };
}
