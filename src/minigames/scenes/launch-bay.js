// Launch Bay — the Shape It scene. You tee off in the hangar at the back of a spaceship: its
// stern door is open on space, and a lit flight deck runs out from it like a carrier's. Small
// ships wait in their launch slots either side, an asteroid belt crosses the distance under a
// ringed planet, and a few rocks drift past. A faint force field across the door (it keeps the
// air in) ripples when the ball goes through. The hidden joke: you're reading a *launch* monitor,
// so the rings are flight gates and the corner map is the bay's flight-plan screen.
//
// returns the usual scene { renderer, scene, camera, sunDir, groundAt, surfaceAt, aimShadows,
// animate } plus safeGround (for the ball's shadow off the deck), fieldRipple(x, y),
// launchShip() and resetShips().

import { createStage, rng, hash2, GLSL_NOISE, signTexture } from '../../world/stage.js';

const YD = 0.9144;
export const BAY = { door: -45, back: 26, half: 34, height: 36, doorHalf: 24, doorTop: 30, deckHalf: 23, deckEnd: -45 - 345 };

export function createLaunchBay(container) {
  const st = createStage(container, {
    elev: 15, az: 213, sunColor: 0xfff0dc, sunInt: 2.4, exposure: 0.72,
    hemiSky: 0x7f93b8, hemiGround: 0x242833, hemiInt: 0.22, shadowBox: 78,
  });
  const { scene, renderer, sun, sunDir, camera } = st;
  st.sky.visible = false; scene.fog = null; scene.background = new THREE.Color(0x010207);
  scene.add(camera); // the flight-plan monitor hangs in front of the camera
  const R = rng(4242), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ps = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();

  /* ---------- ground: the hangar floor and the flight deck; open space everywhere else ---------- */
  const B = BAY;
  function groundAt(x, z) {
    if (z > B.door) return z <= B.back && Math.abs(x) <= B.half ? 0 : null;
    return z >= B.deckEnd && Math.abs(x) <= B.deckHalf ? 0 : null;
  }
  const surfaceAt = () => 'fairway';
  const safeGround = (x, z) => groundAt(x, z) ?? -400; // for the ball's shadow: none over open space

  /* ---------- environment light: a dim metal room with strip lights ---------- */
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 60), new THREE.MeshBasicMaterial({ color: 0x1c2029, side: THREE.BackSide })));
    for (let i = -2; i <= 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.4, 6) })); s.position.set(i * 9, 14.5, 0); es.add(s); }
    const open = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ color: 0x05070d })); open.position.set(0, 0, -29.9); es.add(open);
    scene.environment = pm.fromScene(es, 0.03).texture;
  }

  /* ---------- deck plating shader (hangar floor + flight deck) ---------- */
  const plating = (outside) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.55, envMapIntensity: 0.9 });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + rAdd, 0.15, 1.0);')
        .replace('#include <map_fragment>', `
vec3 p = vWPos; float rAdd = 0.0;
float camD = length(cameraPosition - p);
float aa = clamp(camD * 0.004, 0.02, 0.3);
vec2 cell = p.xz / 4.0, f = abs(fract(cell) - 0.5);
float seam = smoothstep(0.5 - aa * 0.25, 0.5, max(f.x, f.y));
float plate = h21(floor(cell));
vec3 c = lin(vec3(0.30, 0.32, 0.36)) * (0.82 + 0.3 * plate) * (0.9 + 0.2 * fb(p.xz * 0.7));
c *= 1.0 - 0.45 * seam;
float scuff = smoothstep(0.55, 0.8, fb(p.xz * 0.12 + 4.0)); c *= 1.0 - 0.18 * scuff; rAdd += 0.2 * scuff;
${outside ? `
// flight deck: dark plating, a dashed centre line and solid side lines
c *= 0.62;
float cl = (1.0 - smoothstep(0.35, 0.5, abs(p.x))) * step(0.45, fract(p.z / 12.0));
float sl = 1.0 - smoothstep(0.4, 0.6, abs(abs(p.x) - 21.5));
c = mix(c, lin(vec3(0.85, 0.86, 0.9)), max(cl, sl) * 0.85);
float hz = (1.0 - smoothstep(1.2, 1.4, abs(p.z + 47.0))) * step(0.5, fract((p.x + p.z) / 2.2));
c = mix(c, lin(vec3(0.95, 0.72, 0.1)), hz);` : `
// hangar floor: a yellow launch lane to the door, slot boxes either side, hazard stripes at the door
float lane = 1.0 - smoothstep(0.3, 0.45, abs(abs(p.x) - 6.0));
lane *= step(p.z, 6.0);
float slotX = abs(abs(p.x) - (p.z > -28.0 ? 16.0 : 14.0)), slotZ = min(abs(p.z + 20.0), abs(p.z + 35.0));
float slot = (1.0 - smoothstep(0.25, 0.4, abs(max(slotX / 6.0, slotZ / 7.0) - 1.0) * 6.0)) * step(abs(p.x), 22.0);
float hz = (1.0 - smoothstep(1.1, 1.3, abs(p.z - (${B.door.toFixed(1)} + 1.3)))) * step(0.5, fract((p.x + p.z) / 2.2));
vec3 yel = lin(vec3(0.95, 0.72, 0.1));
c = mix(c, yel, max(max(lane, slot) * 0.85, hz));
// the launch pad you tee off from
float pr = length(p.xz - vec2(0.0, 0.4));
float pad = 1.0 - smoothstep(3.4, 3.5, pr);
c = mix(c, lin(vec3(0.16, 0.18, 0.22)), pad);
c = mix(c, lin(vec3(0.3, 0.85, 1.0)) * 1.6, (1.0 - smoothstep(0.08, 0.16, abs(pr - 3.3))) * 0.9);
rAdd -= pad * 0.2;`}
diffuseColor.rgb = c;
`);
    };
    return m;
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(B.half * 2, B.back - B.door).rotateX(-Math.PI / 2), plating(false));
  floor.position.set(0, 0, (B.back + B.door) / 2); floor.receiveShadow = true; scene.add(floor);
  const deckLen = B.door - B.deckEnd;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(B.deckHalf * 2, 1.2, deckLen), plating(true));
  deck.position.set(0, -0.6, B.door - deckLen / 2); deck.receiveShadow = true; scene.add(deck);
  // girders under the deck so it reads as a structure hanging off the ship
  {
    const g = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.6, roughness: 0.5 }), 60);
    let k = 0;
    for (let z = B.door - 10; z > B.deckEnd + 5 && k < 58; z -= 22) {
      for (const sx of [-1, 1]) { m4.compose(ps.set(sx * (B.deckHalf - 2), -3.2, z), q.identity(), sc.set(1.4, 4.2, 1.4)); g.setMatrixAt(k++, m4); }
    }
    m4.compose(ps.set(0, -4.8, B.door - deckLen / 2), q.identity(), sc.set(B.deckHalf * 1.7, 1.2, deckLen)); g.setMatrixAt(k++, m4);
    g.count = k; scene.add(g);
  }

  /* ---------- the hangar: walls, ribs, ceiling light strips, stern wall with the open door ---------- */
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.45, roughness: 0.6, envMapIntensity: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.55, roughness: 0.55 });
  const box = (w, h, d, x, y, z, mat = wallMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
  const L = B.back - B.door, zc = (B.back + B.door) / 2, H = B.height;
  box(1, H, L, -B.half - 0.5, H / 2, zc); box(1, H, L, B.half + 0.5, H / 2, zc);   // side walls
  box(B.half * 2 + 2, 1, L, 0, H + 0.5, zc);                                        // ceiling
  box(B.half * 2 + 2, H, 1, 0, H / 2, B.back + 0.5);                                // front bulkhead
  // stern wall around the door
  const sideW = B.half - B.doorHalf;
  box(sideW + 1, H, 2.4, -(B.doorHalf + sideW / 2 + 0.5), H / 2, B.door - 1.2);
  box(sideW + 1, H, 2.4, B.doorHalf + sideW / 2 + 0.5, H / 2, B.door - 1.2);
  box(B.half * 2 + 2, H - B.doorTop, 2.4, 0, (H + B.doorTop) / 2, B.door - 1.2);
  // ribs: frames every 6 m around the walls and across the ceiling
  {
    const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), darkMat, 64);
    let k = 0;
    for (let z = B.back - 3; z > B.door + 2; z -= 6) {
      for (const sx of [-1, 1]) { m4.compose(ps.set(sx * (B.half - 0.6), H / 2, z), q.identity(), sc.set(1.4, H, 1.2)); ribs.setMatrixAt(k++, m4); }
      m4.compose(ps.set(0, H - 0.8, z), q.identity(), sc.set(B.half * 2, 1.6, 1.2)); ribs.setMatrixAt(k++, m4);
    }
    ribs.count = k; ribs.castShadow = ribs.receiveShadow = true; scene.add(ribs);
  }
  // ceiling light strips and wall light bars (bright, unlit materials so they glow)
  const glowMat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.4), toneMapped: false });
  {
    const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glowMat(0xdfeaff), 40);
    let k = 0;
    for (const x of [-20, -8, 8, 20]) { m4.compose(ps.set(x, H - 0.1, zc), q.identity(), sc.set(0.7, 0.15, L - 8)); strips.setMatrixAt(k++, m4); }
    for (let z = B.back - 6; z > B.door + 4; z -= 6) for (const sx of [-1, 1]) { m4.compose(ps.set(sx * (B.half - 0.05), 9, z), q.identity(), sc.set(0.12, 2.4, 0.5)); strips.setMatrixAt(k++, m4); }
    strips.count = k; scene.add(strips);
  }
  // a few lights so the bay is lit from inside too
  for (const [x, y, z, i] of [[0, 30, 8, 1.1], [-18, 26, -20, 0.8], [18, 26, -20, 0.8], [0, 22, -36, 0.5]]) { const l = new THREE.PointLight(0xdbe6ff, i, 60, 1.2); l.position.set(x, y, z); scene.add(l); }
  // the door frame: chunky trim with hazard stripes and amber beacons
  const hazTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#f0b51c'; for (let i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 80, 64); g.lineTo(i + 64, 64); g.fill(); } const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const trim = (w, h, x, y, rx, ry) => { const t = hazTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.3 })); m.position.set(x, y, B.door + 0.1); m.receiveShadow = true; scene.add(m); };
  trim(1.6, B.doorTop, -B.doorHalf - 0.8, B.doorTop / 2, 1, B.doorTop / 1.6); trim(1.6, B.doorTop, B.doorHalf + 0.8, B.doorTop / 2, 1, B.doorTop / 1.6);
  trim(B.doorHalf * 2 + 3.2, 1.6, 0, B.doorTop + 0.8, (B.doorHalf * 2 + 3.2) / 1.6, 1);
  // hydraulic rams that lifted the door, tucked up by the lintel
  for (const sx of [-1, 1]) { const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 12, 14), new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.9, roughness: 0.25 })); ram.position.set(sx * (B.doorHalf + 3.2), B.doorTop - 4, B.door + 1.4); ram.rotation.z = sx * 0.35; scene.add(ram); }
  const beacons = [];
  const beaconGeo = new THREE.SphereGeometry(0.35, 12, 8);
  for (const [x, y] of [[-B.doorHalf - 0.8, B.doorTop + 1.9], [B.doorHalf + 0.8, B.doorTop + 1.9], [-B.doorHalf - 0.8, 1.5], [B.doorHalf + 0.8, 1.5]]) {
    const m = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xffa53a, toneMapped: false })); m.position.set(x, y, B.door + 0.6); scene.add(m); beacons.push(m);
  }
  // wall screens, crates and fuel lines for some life in the bay
  {
    const scr = (x, z, txt, sub) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.1), new THREE.MeshBasicMaterial({ map: signTexture(txt, sub, { bg: '#06131f', fg: '#62e6ff' }), toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) })); m.position.set(x, 6.5, z); m.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(m); };
    scr(-B.half + 0.2, -6, 'BAY 3', 'LAUNCH DECK'); scr(B.half - 0.2, -6, 'GO', 'FLIGHT OPS'); scr(-B.half + 0.2, 12, 'O₂', 'FIELD 100%'); scr(B.half - 0.2, 12, 'T−0', 'CLEARED');
    const crate = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }), 40);
    let k = 0;
    for (const [cx, cz] of [[-28, 14], [-27, 4], [28, 16], [27, -2], [-29, -26], [29, -30]]) {
      const n = 2 + Math.floor(R() * 5);
      for (let i = 0; i < n && k < 40; i++) { const s = 1.6 + R() * 1.2; m4.compose(ps.set(cx + (R() - 0.5) * 4, s / 2 + (i > 2 ? s : 0), cz + (R() - 0.5) * 4), q.setFromEuler(new THREE.Euler(0, R() * 0.6, 0)), sc.set(s, s, s)); crate.setMatrixAt(k, m4); crate.setColorAt(k++, col.set([0x5d6573, 0x7a5a2e, 0x3f5a6e, 0x6b6f76][Math.floor(R() * 4)])); }
    }
    crate.count = k; crate.castShadow = crate.receiveShadow = true; scene.add(crate);
    for (const sx of [-1, 1]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, L - 4, 10), new THREE.MeshStandardMaterial({ color: sx < 0 ? 0x9b3a2a : 0x2f5f8f, metalness: 0.5, roughness: 0.45 })); pipe.rotation.x = Math.PI / 2; pipe.position.set(sx * (B.half - 1.6), 3.2, zc); scene.add(pipe); }
    // an overhead crane beam across the bay
    box(B.half * 2 - 2, 1.4, 1.6, 0, H - 4, -12, darkMat); box(3, 2.2, 2.4, 9, H - 5.4, -12, new THREE.MeshStandardMaterial({ color: 0xd9a02a, metalness: 0.3, roughness: 0.5 }));
  }
  // blue lane lights on the floor that chase toward the door
  const laneLights = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), new THREE.MeshBasicMaterial({ toneMapped: false }), 40);
  const laneZ = [];
  { let k = 0; for (let z = 4; z > B.door + 2; z -= 3.2) for (const sx of [-1, 1]) { m4.compose(ps.set(sx * 7.2, 0.03, z), q.identity(), sc.set(1, 1, 1)); laneLights.setMatrixAt(k, m4); laneZ.push(z); k++; } laneLights.count = k; }
  scene.add(laneLights);

  /* ---------- the force field across the door ---------- */
  const field = new THREE.Mesh(new THREE.PlaneGeometry(B.doorHalf * 2, B.doorTop), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uRip: { value: new THREE.Vector3(0, 0, -99) } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vP; uniform float uT; uniform vec3 uRip;
      ${GLSL_NOISE}
      void main(){
        vec2 p = vP; float n = fb(p * 0.08 + vec2(uT * 0.05, uT * 0.03));
        // hex-ish cells
        vec2 h = p * vec2(0.55, 0.64); vec2 g = abs(fract(h + vec2(0.5 * step(1.0, mod(floor(h.y), 2.0)), 0.0)) - 0.5);
        float cellEdge = smoothstep(0.42, 0.5, max(g.x * 1.15 + g.y * 0.6, g.y * 1.2));
        float edge = smoothstep(${(B.doorHalf - 3).toFixed(1)}, ${B.doorHalf.toFixed(1)}, abs(p.x)) + smoothstep(${(B.doorTop / 2 - 3).toFixed(1)}, ${(B.doorTop / 2).toFixed(1)}, abs(p.y));
        float a = 0.006 + 0.022 * cellEdge * n * n + 0.07 * edge;
        float age = uT - uRip.z, d = length(p - uRip.xy);
        a += 0.5 * exp(-age * 1.6) * smoothstep(1.6, 0.0, abs(d - age * 9.0)) * step(0.0, age);
        gl_FragColor = vec4(vec3(0.35, 0.75, 1.0) * a, 1.0);
      }`,
  }));
  field.position.set(0, B.doorTop / 2, B.door - 0.2); field.renderOrder = 2; scene.add(field);

  /* ---------- yardage boards on the flight deck ---------- */
  [100, 150, 200, 250, 300, 350].forEach(yd => {
    const z = -yd * YD; if (z > B.door - 2 || z < B.deckEnd) return;
    const t = signTexture(String(yd), 'YARDS', { bg: 'rgba(0,0,0,0)', fg: '#d9e3ee' });
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.4).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7, depthWrite: false })); m.position.set(sx * 15, 0.02, z); m.rotation.y = 0; scene.add(m); }
  });
  // deck edge lights (blink in a chase) and the end-of-deck strobes
  const edgeN = Math.floor(deckLen / 10);
  const edgeLights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), edgeN * 2 + 8);
  { let k = 0; for (let i = 0; i < edgeN; i++) for (const sx of [-1, 1]) { m4.compose(ps.set(sx * (B.deckHalf - 0.3), 0.25, B.door - 4 - i * 10), q.identity(), sc.set(1, 1, 1)); edgeLights.setMatrixAt(k++, m4); }
    for (let i = 0; i < 8; i++) { m4.compose(ps.set(-B.deckHalf + 3 + i * (B.deckHalf * 2 - 6) / 7, 0.3, B.deckEnd + 0.6), q.identity(), sc.set(1.6, 1.6, 1.6)); edgeLights.setMatrixAt(k++, m4); }
    edgeLights.count = k; }
  scene.add(edgeLights);

  /* ---------- ships in their launch slots ---------- */
  const ships = [];
  function mkShip(accentHex) {
    const g = new THREE.Group();
    const hull = new THREE.MeshStandardMaterial({ color: 0xd8dce3, metalness: 0.55, roughness: 0.36 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.6, roughness: 0.45 });
    const accent = new THREE.MeshStandardMaterial({ color: accentHex, metalness: 0.3, roughness: 0.45 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x14202c, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 });
    const prof = [[0, 0], [1.0, 0.2], [1.45, 1.6], [1.55, 4.6], [1.3, 7.4], [0.85, 9.2], [0.25, 10.4], [0, 10.6]].map(([r, y]) => new THREE.Vector2(r, y));
    const fus = new THREE.LatheGeometry(prof, 18); fus.rotateX(-Math.PI / 2); fus.translate(0, 0, 5); fus.scale(1, 0.72, 1);
    const body = new THREE.Mesh(fus, hull); body.castShadow = true; g.add(body);
    const can = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), glass); can.scale.set(0.82, 0.62, 2.0); can.position.set(0, 0.85, -1.8); g.add(can);
    const wingShape = new THREE.Shape(); wingShape.moveTo(1.1, -0.6); wingShape.lineTo(5.6, 2.0); wingShape.lineTo(5.6, 3.0); wingShape.lineTo(1.1, 3.4); wingShape.closePath();
    const wg = new THREE.ExtrudeGeometry(wingShape, { depth: 0.22, bevelEnabled: false }); wg.rotateX(Math.PI / 2); wg.translate(0, 0.1, 0);
    for (const sx of [1, -1]) {
      const w = new THREE.Mesh(wg, hull); w.scale.x = sx; w.castShadow = true; g.add(w);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.45), accent); stripe.position.set(sx * 3.6, 0.16, 2.2); stripe.rotation.y = sx * -0.5; g.add(stripe);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 1.4), dark); tip.position.set(sx * 5.6, 0.45, 2.5); g.add(tip);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 3.4, 14), dark); eng.rotation.x = Math.PI / 2; eng.position.set(sx * 1.75, 0.1, 3.6); eng.castShadow = true; g.add(eng);
      const noz = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.62, 1.25), toneMapped: false })); noz.position.set(sx * 1.75, 0.1, 5.32); g.add(noz);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 1.8), accent); fin.position.set(sx * 0.8, 1.2, 4.0); fin.rotation.z = sx * -0.3; g.add(fin);
    }
    const gear = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), dark, 3);
    [[0, -3.8], [-1.6, 2.6], [1.6, 2.6]].forEach(([x, z], i) => { m4.compose(ps.set(x, -0.8, z), q.identity(), sc.set(1, 1, 1)); gear.setMatrixAt(i, m4); });
    g.add(gear);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7fd2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    glow.position.set(0, 0.1, 6.4); glow.scale.set(5.5, 2.4, 1); g.add(glow);
    g.userData = { glow, gear };
    return g;
  }
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const gx = cv.getContext('2d'); const gr = gx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
  [[-16, -20, 0xe2512f], [16, -20, 0x2f8fe2], [-14, -35, 0x3fbf6a], [14, -35, 0xe2b42f]].forEach(([x, z, c], i) => {
    const s = mkShip(c); s.position.set(x, 1.6, z); s.rotation.y = (x < 0 ? 1 : -1) * 0.06; scene.add(s);
    ships.push({ g: s, home: new THREE.Vector3(x, 1.6, z), yaw: s.rotation.y, state: 'parked', t: 0, phase: i * 1.3 });
  });
  function launchShip() { // the ship nearest the door that's sitting in its slot lifts off and flies out
    const s = ships.filter(o => o.state === 'parked').sort((a, b) => a.home.z - b.home.z)[0];
    if (s) { s.state = 'launch'; s.t = 0; }
  }
  function resetShips() { for (const s of ships) if (s.state === 'gone') { s.state = 'rise'; s.t = 0; s.g.visible = true; } }

  /* ---------- space: stars, a nebula band, a ringed planet, the asteroid belt, drifting rocks ---------- */
  const dirOf = (azDeg, elDeg) => new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elDeg), THREE.MathUtils.degToRad(azDeg));
  {
    const N = st.coarse ? 4500 : 7000, pos = new Float32Array(N * 3), cl = new Float32Array(N * 3), size = new Float32Array(N);
    const band = new THREE.Vector3(0.3, 0.85, 0.42).normalize();
    for (let i = 0; i < N; i++) {
      let v; do { v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
      v.normalize(); if (R() < 0.45) { v.addScaledVector(band, -v.dot(band) * (0.85 + 0.15 * R())).normalize(); } // crowd the Milky Way band
      pos.set([v.x * 9000, v.y * 9000, v.z * 9000], i * 3);
      const t = R(); col.setHSL(t < 0.2 ? 0.08 : t < 0.35 ? 0.6 : 0.58, t < 0.35 ? 0.6 : 0.1, 0.75 + R() * 0.25); cl.set([col.r, col.g, col.b], i * 3);
      size[i] = (R() ** 6) * 3.2 + 0.7;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const pr = renderer.getPixelRatio();
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, vertexColors: true,
      vertexShader: `attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * ${pr.toFixed(2)}; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vC * a * 1.4, a); }' });
    const stars = new THREE.Points(geo, mat); stars.frustumCulled = false; stars.renderOrder = -2; scene.add(stars);
    // nebula + Milky Way glow on a big sphere behind everything
    const neb = new THREE.Mesh(new THREE.SphereGeometry(9500, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, toneMapped: false,
      uniforms: { uBand: { value: band } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD; uniform vec3 uBand;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fb3(vec3 p){ return n3(p) * 0.5 + n3(p * 2.1) * 0.25 + n3(p * 4.3) * 0.125 + n3(p * 8.7) * 0.0625; }
        void main(){
          vec3 d = normalize(vD);
          float b = 1.0 - abs(dot(d, uBand)); b = pow(b, 7.0);
          float n = fb3(d * 3.0), n2 = fb3(d * 7.0 + 4.0);
          vec3 c = vec3(0.012, 0.014, 0.03);
          c += vec3(0.10, 0.09, 0.12) * b * (0.4 + n2) * 0.7;
          c -= vec3(0.05) * b * smoothstep(0.55, 0.75, n2);                         // dust lanes
          float neb = smoothstep(0.52, 0.8, n) * smoothstep(-0.2, 0.5, d.y + 0.2);
          c += mix(vec3(0.05, 0.02, 0.09), vec3(0.0, 0.07, 0.09), fb3(d * 2.0 + 9.0)) * neb * 1.5;
          gl_FragColor = vec4(c, 1.0);
        }` }));
    neb.renderOrder = -3; scene.add(neb);
  }
  // the planet: a banded gas giant off to the right, lit from the left, with a tilted ring system
  const pDir = dirOf(158, 10.5), pDist = 7600, pR = pDist * Math.tan(THREE.MathUtils.degToRad(7.5));
  const pPos = pDir.clone().multiplyScalar(pDist);
  {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(pR, 64, 40), new THREE.ShaderMaterial({ toneMapped: false,
      uniforms: { uSun: { value: sunDir.clone() } },
      vertexShader: 'varying vec3 vN; varying vec3 vO; varying vec3 vW; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vN; varying vec3 vO; varying vec3 vW; uniform vec3 uSun;
        ${GLSL_NOISE}
        void main(){
          float lat = vO.y + 0.06 * (fb(vec2(atan(vO.z, vO.x) * 3.0, vO.y * 9.0)) - 0.5);
          float bands = sin(lat * 26.0) * 0.5 + 0.5, fine = sin(lat * 71.0 + fb(vec2(vO.x * 8.0, vO.z * 8.0)) * 2.0) * 0.5 + 0.5;
          vec3 c = mix(lin(vec3(0.82, 0.66, 0.46)), lin(vec3(0.62, 0.42, 0.3)), bands);
          c = mix(c, lin(vec3(0.92, 0.84, 0.7)), fine * 0.3);
          float spot = 1.0 - smoothstep(0.06, 0.1, length(vec2(atan(vO.z, vO.x) - 0.9, (vO.y + 0.28) * 2.2)));
          c = mix(c, lin(vec3(0.75, 0.32, 0.2)), spot * 0.8);
          float lit = smoothstep(-0.12, 0.35, dot(normalize(vN), uSun));
          vec3 V = normalize(cameraPosition - vW); float rim = pow(1.0 - max(0.0, dot(normalize(vN), V)), 3.0);
          gl_FragColor = vec4(c * lit * 1.25 + vec3(0.9, 0.7, 0.5) * rim * lit * 0.5, 1.0);
        }` }));
    planet.position.copy(pPos); planet.renderOrder = -1; scene.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(pR * 1.35, pR * 2.3, 128, 1), new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
      uniforms: { uR0: { value: pR * 1.35 }, uR1: { value: pR * 2.3 }, uC: { value: pPos }, uPR: { value: pR }, uSun: { value: sunDir.clone() } },
      vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vW; uniform float uR0, uR1, uPR; uniform vec3 uC, uSun;
        void main(){
          float r = (length(vW - uC) - uR0) / (uR1 - uR0);
          float b = 0.6 + 0.25 * sin(r * 31.0) + 0.15 * sin(r * 13.0 + 1.0); b *= smoothstep(0.0, 0.05, r) * smoothstep(1.0, 0.9, r);
          b *= 1.0 - 0.8 * (1.0 - smoothstep(0.36, 0.38, r)) * smoothstep(0.33, 0.35, r);           // a gap
          // the planet's shadow across the ring
          vec3 rel = vW - uC; float along = dot(rel, uSun); float perp = length(rel - uSun * along);
          float sh = along < 0.0 ? smoothstep(uPR * 0.95, uPR * 1.05, perp) : 1.0;
          vec3 c = vec3(0.86, 0.74, 0.58) * b * (0.25 + 0.85 * sh);
          gl_FragColor = vec4(c, b * 0.85);
        }` }));
    ring.position.copy(pPos); ring.lookAt(pPos.clone().add(new THREE.Vector3(0.25, 1, 0.55))); ring.renderOrder = -1; scene.add(ring);
    // a small blue moon of the planet
    const moon = new THREE.Mesh(new THREE.SphereGeometry(pR * 0.12, 24, 16), new THREE.MeshStandardMaterial({ color: 0x8fb4d8, roughness: 1, envMapIntensity: 0 }));
    moon.position.copy(dirOf(140, 24).multiplyScalar(pDist * 0.9)); scene.add(moon);
  }
  // asteroid rock geometry: lumpy icosahedra
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = 1 + (hash2(Math.round(v.x * 37 + 3), Math.round(v.y * 37 + v.z * 23)) - 0.5) * 0.55; p.setXYZ(i, v.x * n, v.y * n * 0.8, v.z * n); } rockGeo.computeVertexNormals(); }
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d6158, roughness: 0.95, metalness: 0.05, envMapIntensity: 0.05, flatShading: true });
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x5e554c, roughness: 1, metalness: 0, envMapIntensity: 0, flatShading: true, emissive: 0x0d0b0a });
  {
    // the belt: a long, thin band of rocks crossing the distance below the planet
    const N = st.coarse ? 260 : 420, belt = new THREE.InstancedMesh(rockGeo, beltMat, N);
    for (let i = 0; i < N; i++) {
      const az = 100 + R() * 160, el = 1.5 + 5 * Math.sin(THREE.MathUtils.degToRad(az - 100) * 1.1) + (R() - 0.5) * 3.2 * (0.4 + R()), d = 2600 + R() * 3600;
      const v = dirOf(az, el).multiplyScalar(d), s = (8 + R() ** 3 * 70) * (d / 4000);
      m4.compose(v, q.setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)), sc.set(s, s * (0.6 + R() * 0.5), s * (0.7 + R() * 0.6)));
      belt.setMatrixAt(i, m4); belt.setColorAt(i, col.setRGB(0.4, 0.36, 0.32).multiplyScalar(0.35 + R() * 0.45));
    }
    scene.add(belt);
    const DN = st.coarse ? 1400 : 2200, dp = new Float32Array(DN * 3);
    for (let i = 0; i < DN; i++) { const az = 100 + R() * 160, el = 1.5 + 5 * Math.sin(THREE.MathUtils.degToRad(az - 100) * 1.1) + (R() - 0.5) * 4.5, v = dirOf(az, el).multiplyScalar(3000 + R() * 3500); dp.set([v.x, v.y, v.z], i * 3); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x8a7c6c, size: 1.0 * renderer.getPixelRatio(), sizeAttenuation: false, transparent: true, opacity: 0.3, depthWrite: false }));
    scene.add(dust);
  }
  // nearer rocks that drift slowly across the view (well clear of the rings)
  const drift = [];
  const near = new THREE.InstancedMesh(rockGeo, rockMat, 14);
  for (let i = 0; i < 14; i++) {
    const d = 900 + R() * 1300, az = 130 + R() * 100, el = 6 + R() * 26, p = dirOf(az, el).multiplyScalar(d);
    drift.push({ p, v: new THREE.Vector3((R() < 0.5 ? -1 : 1) * (2 + R() * 5), (R() - 0.5) * 0.8, (R() - 0.5) * 2), s: 5 + R() ** 2 * 22, rot: new THREE.Euler(R() * 6, R() * 6, R() * 6), spin: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(0.12) });
    near.setColorAt(i, col.setRGB(0.55, 0.5, 0.45).multiplyScalar(0.8 + R() * 0.5));
  }
  near.castShadow = false; scene.add(near);
  // two small ships cruising far off, just their engine glows and a speck of hull
  const cruisers = [0, 1].map(i => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: i ? 0xffb46b : 0x8fd8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sp.scale.setScalar(18); scene.add(sp); return { sp, a: i * 2.4, d: 2200 + i * 900, el: 10 + i * 9 }; });

  /* ---------- sun glare (just off to the left of the door) ---------- */
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff1d8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glare.position.copy(sunDir).multiplyScalar(8000); glare.scale.setScalar(900); scene.add(glare);

  // shadows stay centred on the hangar so its walls always keep the sun out
  const shadowFocus = new THREE.Vector3(0, 0, -12);
  function aimShadows() { sun.target.position.copy(shadowFocus); sun.position.copy(shadowFocus).addScaledVector(sunDir, 600); }
  aimShadows();

  let rip = -99, lastT = 0;
  return {
    ...st, groundAt, surfaceAt, safeGround, aimShadows, launchShip, resetShips, BAY, ships,
    fieldRipple(x, y) { field.material.uniforms.uRip.value.set(x, y - B.doorTop / 2, lastT); rip = lastT; },
    animate(t) {
      const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t; void rip;
      field.material.uniforms.uT.value = t;
      beacons.forEach((b, i) => { b.material.color.setScalar(0).setRGB(1, 0.65, 0.23).multiplyScalar(0.25 + 2.4 * Math.max(0, Math.sin(t * 3 + i * 1.6))); });
      for (let i = 0; i < laneLights.count; i++) { const k = Math.max(0, Math.sin(-laneZ[i] * 0.55 + t * 5)); laneLights.setColorAt(i, col.setRGB(0.15, 0.55, 1).multiplyScalar(0.3 + 2.6 * k * k)); }
      laneLights.instanceColor.needsUpdate = true;
      for (let i = 0; i < edgeLights.count; i++) { const end = i >= edgeN * 2, k = end ? (Math.sin(t * 6) > 0.6 ? 3 : 0.2) : 0.35 + 1.8 * Math.max(0, Math.sin(-Math.floor(i / 2) * 0.5 + t * 4)) ** 4; edgeLights.setColorAt(i, end ? col.setRGB(1, 0.25, 0.2).multiplyScalar(k) : col.setRGB(0.4, 0.8, 1).multiplyScalar(k)); }
      edgeLights.instanceColor.needsUpdate = true;
      drift.forEach((r, i) => {
        r.p.addScaledVector(r.v, dt); if (Math.abs(r.p.x) > 1500) r.p.x = -Math.sign(r.p.x) * 1400;
        r.rot.x += r.spin.x * dt; r.rot.y += r.spin.y * dt; r.rot.z += r.spin.z * dt;
        m4.compose(r.p, q.setFromEuler(r.rot), sc.set(r.s, r.s * 0.75, r.s * 0.9)); near.setMatrixAt(i, m4);
      });
      near.instanceMatrix.needsUpdate = true;
      cruisers.forEach(c => { const a = c.a + t * 0.012; c.sp.position.copy(dirOf(150 + 60 * Math.sin(a), c.el + 3 * Math.sin(a * 1.7))).multiplyScalar(c.d); c.sp.material.opacity = 0.6 + 0.4 * Math.sin(t * 2 + c.a); });
      // ships: idle engines pulse; a launch lifts off, noses out of the door and accelerates away
      for (const s of ships) {
        const g = s.g, ud = g.userData; s.t += dt;
        if (s.state === 'parked') { ud.glow.material.opacity = 0.35 + 0.2 * Math.sin(t * 2.2 + s.phase); g.position.y = s.home.y + 0.04 * Math.sin(t * 1.3 + s.phase); }
        else if (s.state === 'launch') {
          const lift = Math.min(1, s.t / 1.6), e = lift * lift * (3 - 2 * lift);
          g.position.y = s.home.y + 3.5 * e; ud.gear.visible = s.t < 0.9;
          const turn = Math.min(1, Math.max(0, (s.t - 1.0) / 1.4)), te = turn * turn * (3 - 2 * turn);
          g.position.x = s.home.x * (1 - te * 0.85); g.rotation.y = s.yaw * (1 - te);
          const go = Math.max(0, s.t - 1.8); g.position.z = s.home.z - 4 * go - 14 * go * go;
          g.position.y += go * go * 0.6;
          ud.glow.material.opacity = Math.min(1, 0.5 + go); ud.glow.scale.set(5.5 + go * 6, 2.4 + go * 1.5, 1);
          if (go > 9) { s.state = 'gone'; g.visible = false; }
        } else if (s.state === 'rise') { // back up the slot's lift from below the deck
          const u = Math.min(1, s.t / 2.2), e = u * u * (3 - 2 * u);
          g.position.set(s.home.x, s.home.y - 6 * (1 - e), s.home.z); g.rotation.y = s.yaw; ud.gear.visible = true; ud.glow.scale.set(5.5, 2.4, 1);
          if (u >= 1) s.state = 'parked';
        }
      }
    },
  };
}

// The bay's flight-plan screen: a monitor on a boom arm hanging from the ceiling into the top
// right of your view (where the corner map sits in other games). It rides with the camera so it
// stays put and readable; the game draws on its canvas.
//   const fp = createFlightPlanMonitor(world)
//   fp.layout({ left, top, w, h })  css px of the screen area, every frame
//   fp.canvas (sized w×h at device pixels by layout) · fp.update() after drawing · fp.hit(e) → { x, y } css px | null
export function createFlightPlanMonitor({ renderer, camera }) {
  const el = renderer.domElement, grp = new THREE.Group(); camera.add(grp);
  const cv = document.createElement('canvas'); cv.width = cv.height = 2;
  const mkTex = () => { const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  let tex = mkTex();
  const top = m => { m.transparent = true; m.depthTest = true; return m; }; // drawn after the scene's glows and the aim marker
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), top(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  const bezelMat = top(new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.75, roughness: 0.32, envMapIntensity: 1.2 }));
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bezelMat);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), top(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.75, 1).multiplyScalar(1.6), toneMapped: false })));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), top(new THREE.MeshStandardMaterial({ color: 0x3a404a, metalness: 0.8, roughness: 0.35 })));
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), bezelMat);
  const glareMat = top(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vU; void main(){ float g = smoothstep(0.0, 0.25, vU.x + vU.y - 0.9) * smoothstep(0.75, 0.35, vU.x + vU.y - 0.9); gl_FragColor = vec4(vec3(0.07, 0.09, 0.11) * g, 1.0); }' }));
  const glare = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glareMat);
  for (const [m, o] of [[arm, 19], [knuckle, 19], [bezel, 20], [lip, 21], [screen, 22], [glare, 23]]) { m.renderOrder = o; m.frustumCulled = false; grp.add(m); }
  let W = 0, Hh = 0;
  const ray = new THREE.Raycaster();
  return {
    group: grp, canvas: cv,
    get w() { return W; }, get h() { return Hh; },
    layout({ left, top: tp, w, h }) {
      const dpr = Math.min(devicePixelRatio || 1, 2), cw = Math.round(w * dpr), ch = Math.round(h * dpr);
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; tex.dispose(); tex = mkTex(); screen.material.map = tex; screen.material.needsUpdate = true; }
      W = w; Hh = h;
      const vh = el.clientHeight || innerHeight, vw = el.clientWidth || innerWidth, D = 1;
      const wpp = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / vh;
      const cx = left + w / 2, cy = tp + h / 2, yaw = -0.16;
      grp.position.set((cx - vw / 2) * wpp, (vh / 2 - cy) * wpp, -D);
      grp.rotation.set(0.03, yaw, 0);
      const sw = w * wpp / Math.cos(yaw), sh = h * wpp, pad = 6 * wpp;
      screen.scale.set(sw, sh, 1); glare.scale.set(sw, sh, 1); glare.position.z = 0.0005;
      bezel.scale.set(sw + pad * 2 / Math.cos(yaw), sh + pad * 2 + 4 * wpp, 0.03); bezel.position.set(0, -2 * wpp, -0.016);
      lip.scale.set(sw * 0.3, 1.2 * wpp, 0.004); lip.position.set(0, -sh / 2 - pad - 0.6 * wpp, 0.0);
      arm.scale.set(2.2 * wpp, 0.6, 2.2 * wpp); arm.position.set(sw * 0.18, sh / 2 + pad + 0.3, -0.02);
      knuckle.scale.setScalar(4.2 * wpp); knuckle.position.set(sw * 0.18, sh / 2 + pad + 1.5 * wpp, -0.02);
    },
    update() { tex.needsUpdate = true; },
    hit(e) {
      if (!W) return null;
      const r = el.getBoundingClientRect();
      ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
      const hit = ray.intersectObject(screen, false)[0];
      return hit && hit.uv ? { x: hit.uv.x * W, y: (1 - hit.uv.y) * Hh } : null;
    },
  };
}
