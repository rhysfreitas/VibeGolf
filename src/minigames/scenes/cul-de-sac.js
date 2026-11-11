// The Cul-de-sac — the Golf HORSE scene. A giant suburban cul-de-sac just after sunset: you hit
// from a Topgolf-style bay on the first garage roof, down a wide street to a basketball court in
// the bulb with a giant driveway hoop. Houses with lit windows (one flickering TV), porch lights,
// street lamps, tall floodlights, chalk yard lines, a basketball scoreboard that shows the call,
// and seven LED target rings that light up and chase when a ball lands in them.

import { createStage, rng, hash2, GLSL_NOISE, terrainMesh } from '../../world/stage.js';
import { YD, TEE_H, STREET, DECK, TARGETS, ringR, BULL_FRAC, HOOP, streetAt, groundAt, surfaceAt } from '../horse-logic.js';

const Y0 = -TEE_H; // street level

function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

export function createCulDeSac(container) {
  const st = createStage(container, {
    turbidity: 3.2, rayleigh: 2.6, mie: 0.006, mieG: 0.86, elev: 0.6, az: 198,
    sunColor: 0xff8a5c, sunInt: 0.7, exposure: 0.62, hemiSky: 0x6470b8, hemiGround: 0x2a2a36, hemiInt: 0.85,
    fogColor: 0x464d72, fogNear: 260, fogFar: 1600, shadowBox: 110,
  });
  const { scene, renderer } = st;
  const R = rng(240), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const glow = glowTexture();
  const glowMat = c => new THREE.SpriteMaterial({ map: glow, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const emis = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

  /* ---------------- ground: asphalt street + bulb, curbs, sidewalks, lawns ---------------- */
  const geo = terrainMesh(streetAt, { N: st.coarse ? 220 : 300, nearX: 150, farX: 2600, nearZ: 280, farZ: 2600, cz: -140 });
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
  const HZ = HOOP.z, BASE = HZ - 5.5;
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE + `
float sDist(vec2 p){
  float rect = max(max(abs(p.x) - ${STREET.half.toFixed(1)}, ${STREET.end.toFixed(1)} - p.y), p.y - ${STREET.back.toFixed(1)});
  float bulb = length(p - vec2(0.0, ${STREET.end.toFixed(1)})) - ${STREET.bulbR.toFixed(1)};
  return min(rect, bulb);
}
float lineAA(float d, float w, float px){ return 1.0 - smoothstep(w - px, w + px, abs(d)); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <map_fragment>', `
vec3 p = vWPos;
float camD = length(cameraPosition - p);
float far = smoothstep(25.0, 110.0, camD);
float fine = mix(fb(p.xz*3.1), 0.5, far);
float d = sDist(p.xz);
float px = max(0.02, camD * 0.0016);
// asphalt: dark aggregate, patches, oil stains and a few cracks
vec3 asph = lin(vec3(0.17,0.175,0.19)) * (0.72 + 0.5*fine);
asph *= 0.85 + 0.3*fb(p.xz*0.05 + 3.0);
asph *= 1.0 - 0.35*smoothstep(0.62, 0.7, fb(p.xz*0.21 + 9.0));
float crack = (1.0 - smoothstep(0.0, 0.012 + px*0.3, abs(fb(p.xz*0.09) - 0.5))) * (1.0 - far);
asph *= 1.0 - 0.45*crack;
// lawns: mown stripes
vec3 lawn = mix(lin(vec3(0.2,0.32,0.13)), lin(vec3(0.15,0.27,0.1)), step(0.5, fract(p.z/4.0)) * (1.0 - far*0.7));
lawn *= 0.78 + 0.4*fine; lawn *= 0.85 + 0.3*fb(p.xz*0.08);
vec3 conc = lin(vec3(0.5,0.49,0.46)) * (0.82 + 0.25*fine);
// slabs on the sidewalk
float slab = lineAA(fract(p.z/1.6)-0.5, 0.48, 0.0);
vec3 c = d < 0.0 ? asph : (d < 0.35 ? conc*1.15 : (d < 3.3 ? conc*(0.92 + 0.08*slab) : lawn));
c = mix(c, asph * 0.6, smoothstep(-0.7, -0.05, d) * step(d, 0.0) * 0.35); // gutter
float rough = d < 0.0 ? 0.9 : (d < 3.3 ? 0.85 : 1.0);
if (d < 0.0) {
  float fade = 1.0 - smoothstep(140.0, 360.0, camD);
  // chalk yard lines every 25 yd down the straight, with a dashed centre line
  float yd = -p.z / ${YD};
  float lw = 0.22 / ${YD} + px / ${YD};
  float yl = lineAA(mod(yd + 12.5, 25.0) - 12.5, lw, 0.0) * step(20.0, yd) * step(p.z, -8.0) * step(${(STREET.end + STREET.bulbR - 2).toFixed(1)}, p.z);
  float cl = lineAA(p.x, 0.12 + px*0.5, px) * step(0.5, fract(yd / 4.0)) * step(${(STREET.end + STREET.bulbR).toFixed(1)}, p.z) * step(p.z, -6.0);
  float chalk = max(yl * (0.55 + 0.45*fb(p.xz*0.7)), cl * 0.6) * fade;
  c = mix(c, lin(vec3(0.86,0.86,0.82)), chalk);
  // the court in the bulb: key, free throw circle, three-point arc, baseline
  float lw2 = 0.2 + px;
  vec2 k = p.xz - vec2(0.0, ${BASE.toFixed(2)});
  float inKey = step(abs(k.x), 8.5) * step(0.0, k.y) * step(k.y, 20.0);
  float key = max(max(lineAA(abs(k.x) - 8.5, lw2, px) * step(0.0, k.y) * step(k.y, 20.0), lineAA(k.y - 20.0, lw2, px) * step(abs(k.x), 8.5)), lineAA(k.y, lw2, px) * step(abs(k.x), 30.0));
  float ftc = lineAA(length(k - vec2(0.0, 20.0)) - 6.3, lw2, px) * step(20.0, k.y);
  vec2 h = p.xz - vec2(0.0, ${HZ.toFixed(2)});
  float arc = lineAA(length(h) - 23.6, lw2, px) * step(-5.5, h.y);
  c = mix(c, lin(vec3(0.75,0.32,0.12))*0.9, inKey * 0.55);
  c = mix(c, lin(vec3(0.92,0.9,0.85)), max(max(key, ftc), arc) * 0.85);
  // centre circle with a painted logo ring
  float cc = lineAA(length(p.xz - vec2(0.0, ${(STREET.end + 26).toFixed(1)})) - 5.0, lw2, px);
  c = mix(c, lin(vec3(0.92,0.9,0.85)), cc * 0.6 * step(${(STREET.end + 21).toFixed(1)}, p.z));
}
// hills beyond the houses
c = mix(c, lin(vec3(0.1,0.15,0.08)) * (0.8 + 0.3*fb(p.xz*0.01)), smoothstep(${(Y0 + 1).toFixed(1)}, ${(Y0 + 8).toFixed(1)}, p.y));
diffuseColor.rgb = c;
`);
  };
  const ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

  // ---- yardage decals painted on the street ----
  const decal = (text, w, h, { color = 'rgba(235,235,225,0.9)', font = 800 } = {}) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${font} 110px "Saira Semi Condensed", "Arial Narrow", sans-serif`; g.fillText(text, 128, 70);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
  };
  for (const yd of [50, 100, 150]) for (const side of [-1, 1]) { const m = decal(String(yd), 9, 4.5); m.position.set(side * 10.5, Y0 + 0.02, -yd * YD); scene.add(m); }

  /* ---------------- the bay: hitting deck on the first garage roof ---------------- */
  const siding = std(0xb9b3a6), trim = std(0xece8df);
  const deckW = DECK.x * 2, deckD = DECK.zb - DECK.zf;
  const deck = new THREE.Mesh(B(deckW, 0.3, deckD), std(0x6f5a46, { roughness: 0.9 })); deck.position.set(0, -0.15, (DECK.zb + DECK.zf) / 2); deck.receiveShadow = true; scene.add(deck);
  const garage = new THREE.Mesh(B(deckW - 0.4, TEE_H - 0.3, deckD + 2), siding); garage.position.set(0, Y0 + (TEE_H - 0.3) / 2, (DECK.zb + DECK.zf) / 2 + 1); garage.receiveShadow = true; scene.add(garage);
  const gDoor = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), std(0xdedad0, { roughness: 0.6 })); gDoor.position.set(0, Y0 + 1.6, DECK.zf - 0.01); gDoor.rotation.y = Math.PI; scene.add(gDoor);
  const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), std(0x2f6a3a, { roughness: 1 })); mat2.rotation.x = -Math.PI / 2; mat2.position.set(0, 0.012, 0.3); mat2.receiveShadow = true; scene.add(mat2);
  const matLine = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.4), new THREE.MeshBasicMaterial({ color: 0xeeeeee })); matLine.rotation.x = -Math.PI / 2; matLine.position.set(0.55, 0.014, 0.3); scene.add(matLine);
  // LED strip along the bay's front edge and side rails
  const strip = new THREE.Mesh(B(deckW, 0.06, 0.06), emis(0x6af0ff)); strip.position.set(0, -0.05, DECK.zf + 0.03); scene.add(strip);
  for (const sx of [-1, 1]) {
    for (let z = DECK.zf + 0.4; z < DECK.zb; z += 1.4) { const p = new THREE.Mesh(B(0.07, 1.05, 0.07), trim); p.position.set(sx * (DECK.x - 0.1), 0.52, z); scene.add(p); }
    const rail = new THREE.Mesh(B(0.09, 0.08, deckD - 0.4), trim); rail.position.set(sx * (DECK.x - 0.1), 1.05, (DECK.zb + DECK.zf) / 2 + 0.2); scene.add(rail);
  }
  // mailbox down at the curb
  const mbx = new THREE.Group(); mbx.position.set(5.5, Y0, -4);
  const mPost = new THREE.Mesh(B(0.12, 1.1, 0.12), std(0x3c3a36)); mPost.position.y = 0.55; mbx.add(mPost);
  const mBox = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12, 1, false, 0, Math.PI), std(0x2a3d6a, { metalness: 0.3, roughness: 0.5 })); mBox.rotation.z = Math.PI / 2; mBox.rotation.y = Math.PI / 2; mBox.position.y = 1.12; mbx.add(mBox);
  const flag = new THREE.Mesh(B(0.02, 0.22, 0.08), std(0xd23a2a)); flag.position.set(0.21, 1.25, 0); mbx.add(flag);
  scene.add(mbx);

  /* ---------------- houses ---------------- */
  const PALETTE = [0xd8cfc0, 0xb7c4c9, 0xc9b39a, 0x9fae98, 0xe2dccf, 0xb9a9b8, 0xa7b3c4, 0xcdb48e];
  // art pass 1: lap siding (a board every 20 cm, a shadow line under each) and asphalt shingles (rows of tabs),
  // laid out in world space so every house shares the same scale; each material keeps its own colour
  const worldPat = (m, kind) => { m.customProgramCacheKey = () => kind; m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + GLSL_NOISE).replace('#include <map_fragment>', kind === 'siding' ? `
float camD = length(cameraPosition - vWPos), aa = clamp(camD * 0.002, 0.0, 0.6);
float lap = fract(vWPos.y / 0.2); diffuseColor.rgb *= mix(0.78 + 0.26 * smoothstep(0.0, 0.25, lap), 0.93, aa) * (0.94 + 0.12 * fb(vWPos.xz * 0.6 + vWPos.y));` : `
float camD = length(cameraPosition - vWPos), aa = clamp(camD * 0.003, 0.0, 0.7);
float row = fract(vWPos.y / 0.24), tab = fract((vWPos.x + vWPos.z) / 0.9 + floor(vWPos.y / 0.24) * 0.5);
float sh2 = (0.75 + 0.3 * smoothstep(0.0, 0.3, row)) * (1.0 - 0.18 * step(0.94, tab));
diffuseColor.rgb *= mix(sh2, 0.9, aa) * (0.85 + 0.3 * h21(floor(vec2((vWPos.x + vWPos.z) / 0.9, vWPos.y / 0.24))));`);
  }; return m; };
  const roofMats = [0x3b3634, 0x4a3c34, 0x34383e, 0x5a4a3c].map(c => worldPat(std(c), 'shingle'));
  const litWin = [], darkWin = [], porchPools = [], hedges = [];
  const houseObjs = [];
  let tvWin = null;
  const win = new THREE.PlaneGeometry(1.5, 1.35);
  const porchGlows = [];
  function house(x, z, faceTo, i) {
    const g = new THREE.Group(); g.position.set(x, Y0, z);
    g.rotation.y = Math.atan2(faceTo[0] - x, faceTo[1] - z);   // local +z faces the street
    const w = 14 + R() * 4, h = 6 + R() * 1.4, d = 11, two = R() < 0.65;
    const bodyH = two ? h : 3.6;
    const body = new THREE.Mesh(B(w, bodyH, d), worldPat(std(PALETTE[i % PALETTE.length]), 'siding')); body.position.y = bodyH / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    const sh = new THREE.Shape(); const rw = w / 2 + 0.7, rh = 2.6 + R() * 1.4;
    sh.moveTo(-rw, 0); sh.lineTo(0, rh); sh.lineTo(rw, 0); sh.lineTo(-rw, 0);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d + 1.2, bevelEnabled: false }), roofMats[i % roofMats.length]);
    roof.position.set(0, bodyH, -d / 2 - 0.6); roof.castShadow = true; g.add(roof);
    // garage on one side, front door and porch on the other
    const gs = R() < 0.5 ? 1 : -1;
    const gd = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.9), std(0xe6e2d8, { roughness: 0.6 })); gd.position.set(gs * (w / 2 - 3.4), 1.45, d / 2 + 0.01); g.add(gd);
    for (let k = 1; k < 4; k++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.04), std(0xa9a59a)); ln.position.set(gd.position.x, k * 0.72, d / 2 + 0.02); g.add(ln); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), std([0x6a2a22, 0x23384f, 0x2d3b2a, 0x3a2a1a][i % 4], { roughness: 0.5 })); door.position.set(-gs * 1.2, 1.15, d / 2 + 0.01); g.add(door);
    const porch = new THREE.Mesh(B(3.4, 0.2, 2.0), trim); porch.position.set(door.position.x, 0.1, d / 2 + 1.0); porch.receiveShadow = true; g.add(porch);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), emis(0xffd59a)); lamp.position.set(door.position.x + 0.9, 2.2, d / 2 + 0.15); g.add(lamp);
    const pg = new THREE.Sprite(glowMat(0xffc27a)); pg.scale.setScalar(2.2); pg.position.copy(lamp.position); g.add(pg); porchGlows.push(pg);
    porchPools.push([door.position.x + 0.4, d / 2 + 2.2, g]);                       // a warm pool on the walk and lawn
    // a hedge along the lawn's edge beside the driveway, and a flower bed under the front windows
    hedges.push([g, -gs * (w / 2 - 0.2), d / 2 + 6.5, 0.9, 1.1, 9]);
    hedges.push([g, -gs * 3.4, d / 2 + 0.7, 3.2, 0.55, 0.9, true]);
    // driveway out to the sidewalk
    g.updateMatrixWorld(true);
    const dw = new THREE.Mesh(new THREE.PlaneGeometry(6, 14), std(0x8d8a84, { roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 }));
    dw.rotation.x = -Math.PI / 2; dw.position.set(gd.position.x, 0.015, d / 2 + 7); dw.receiveShadow = true; g.add(dw);
    // windows: ground floor beside the door, upstairs across the front
    const spots = [[-gs * 3.4, 1.6]];
    if (two) for (const fx of [-w / 2 + 2.2, 0, w / 2 - 2.2]) spots.push([fx, bodyH - 1.7]);
    else spots.push([-gs * (w / 2 - 1.6), 1.6]);
    // a side window too
    const placeWin = (lx, ly, lz, ry) => {
      const o = new THREE.Object3D(); o.position.set(lx, ly, lz); o.rotation.y = ry; g.add(o); g.updateMatrixWorld(true);
      const mw = o.matrixWorld.clone(); g.remove(o); return mw;
    };
    spots.forEach(([lx, ly]) => {
      const mw = placeWin(lx, ly, d / 2 + 0.02, 0);
      if (!tvWin && i === 2) { tvWin = mw; return; }
      (R() < 0.62 ? litWin : darkWin).push(mw);
    });
    if (R() < 0.6) litWin.push(placeWin(w / 2 + 0.02, 1.8, 0, Math.PI / 2));
    scene.add(g); houseObjs.push(g);
    // a car on some driveways
    if (R() < 0.55) car(g, gd.position.x, d / 2 + 5.5, i);
  }
  const carCols = [0x9a1f1f, 0x1f3f7a, 0xd9d9d9, 0x222428, 0x5b6a4a, 0x7a7a80];
  function car(g, lx, lz, i) {
    const c = new THREE.Group(); c.position.set(lx, 0, lz); c.rotation.y = R() < 0.5 ? 0 : Math.PI;
    const paint = std(carCols[i % carCols.length], { metalness: 0.5, roughness: 0.35 });
    const body = new THREE.Mesh(B(1.9, 0.8, 4.4), paint); body.position.y = 0.65; body.castShadow = true; c.add(body);
    const cab = new THREE.Mesh(B(1.7, 0.65, 2.3), std(0x1d232b, { metalness: 0.6, roughness: 0.2 })); cab.position.set(0, 1.35, -0.2); c.add(cab);
    for (const sx of [-0.7, 0.7]) { const tl = new THREE.Mesh(B(0.35, 0.12, 0.04), emis(0xff2a1a)); tl.position.set(sx, 0.8, -2.22); c.add(tl); }
    const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12); wheel.rotateZ(Math.PI / 2);
    for (const [wx, wz] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) { const w = new THREE.Mesh(wheel, std(0x111111)); w.position.set(wx, 0.34, wz); c.add(w); }
    g.add(c);
  }
  // both sides of the straight, then around the bulb
  const sideX = STREET.half + 3.3 + 12 + 5.5;
  let hi = 0;
  for (const z of [-24, -62, -100, -138]) for (const s of [-1, 1]) house(s * (sideX + R() * 3), z + (R() - 0.5) * 6, [0, z], hi++);
  const bulbHR = STREET.bulbR + 3.3 + 12 + 5.5;
  for (const deg of [-8, -48, -90, -132, -172]) {
    const a = deg * Math.PI / 180;
    house(Math.cos(a) * bulbHR, STREET.end + Math.sin(a) * bulbHR, [0, STREET.end], hi++);
  }
  // window instances
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const lit = new THREE.InstancedMesh(win, litMat, litWin.length);
  litWin.forEach((mw, i) => { lit.setMatrixAt(i, mw); col.setRGB(1.0, 0.72 + R() * 0.12, 0.42 + R() * 0.15).multiplyScalar(0.75 + R() * 0.35); lit.setColorAt(i, col); });
  scene.add(lit);
  const dark = new THREE.InstancedMesh(win, std(0x1a2230, { roughness: 0.2, metalness: 0.5 }), Math.max(1, darkWin.length));
  darkWin.forEach((mw, i) => dark.setMatrixAt(i, mw)); dark.count = darkWin.length; scene.add(dark);
  // white frames round every window and a cross of glazing bars over each, so they read as windows, not stickers
  { const all = [...litWin, ...darkWin, ...(tvWin ? [tvWin] : [])], fm = new THREE.Matrix4().makeTranslation(0, 0, -0.012);
    const frames = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.78, 1.62), std(0xf0ece4, { roughness: 0.6 }), all.length);
    all.forEach((mw, i) => frames.setMatrixAt(i, mw.clone().multiply(fm))); scene.add(frames);
    const barG = new THREE.BufferGeometry(); { const a = new THREE.PlaneGeometry(1.5, 0.06).toNonIndexed(), b = new THREE.PlaneGeometry(0.06, 1.35).toNonIndexed(); barG.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3)); barG.setAttribute('normal', new THREE.Float32BufferAttribute([...a.attributes.normal.array, ...b.attributes.normal.array], 3)); }
    const bars = new THREE.InstancedMesh(barG, std(0xece8df, { roughness: 0.6 }), all.length), bm = new THREE.Matrix4().makeTranslation(0, 0, 0.008);
    all.forEach((mw, i) => bars.setMatrixAt(i, mw.clone().multiply(bm))); scene.add(bars); }
  // warm porch-light pools on the walks and lawns
  { const pt = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,190,120,0.5)'); gr.addColorStop(0.45, 'rgba(255,170,100,0.16)'); gr.addColorStop(1, 'rgba(255,160,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
    const pm = new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), pm, porchPools.length), v = new THREE.Vector3();
    porchPools.forEach(([lx, lz, g], i) => { v.set(lx, 0.04, lz).applyMatrix4(g.matrixWorld); pools.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z)); }); scene.add(pools); }
  // hedges and flower beds (one instanced mesh each)
  { const hg = new THREE.IcosahedronGeometry(1, 1); { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (hash2(Math.round(p.getX(i) * 30), Math.round(p.getY(i) * 30 + p.getZ(i) * 17)) - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n); } hg.computeVertexNormals(); }
    const parts = [];
    for (const [g, lx, lz, len, ht, dep, bed] of hedges) { const n = Math.max(1, Math.round((bed ? len : dep) / 0.9)); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n - 0.5; parts.push([g, bed ? lx + t * len : lx, bed ? lz : lz + t * dep, bed ? 0.55 : 0.75, ht, bed]); } }
    const hm = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), parts.length), v = new THREE.Vector3();
    parts.forEach(([g, lx, lz, r, ht, bed], i) => { v.set(lx, ht * 0.5, lz).applyMatrix4(g.matrixWorld); m4.compose(v, q.identity(), sc.set(r, ht * 0.6, r)); hm.setMatrixAt(i, m4);
      hm.setColorAt(i, bed ? col.set([0xc04a5a, 0xe0b040, 0x9a5ac0, 0xe07a3a][i % 4]).multiplyScalar(0.7) : col.setRGB(0.07, 0.15, 0.05).offsetHSL(0, 0, (R() - 0.5) * 0.03)); });
    hm.castShadow = hm.receiveShadow = true; scene.add(hm); }
  const tvMat = new THREE.MeshBasicMaterial({ color: 0x6aa8ff, toneMapped: false });
  const tv = new THREE.Mesh(win, tvMat); if (tvWin) { tv.applyMatrix4(tvWin); scene.add(tv); }

  /* ---------------- trees ---------------- */
  const trees = [];
  const SB = [25, -88]; // the lawn scoreboard: keep the line of sight to it clear of trees
  const okTree = (x, z) => !(z < 0 && z > SB[1] - 30 && Math.abs(x / z - SB[0] / SB[1]) < 0.16) && streetDist2(x, z) > 5 && houseObjs.every(h => Math.hypot(h.position.x - x, h.position.z - z) > 12);
  function streetDist2(x, z) { const rect = Math.max(Math.abs(x) - STREET.half, STREET.end - z, z - STREET.back); return Math.min(rect, Math.hypot(x, z - STREET.end) - STREET.bulbR); }
  for (let i = 0; i < 420 && trees.length < 150; i++) {
    const x = (R() - 0.5) * 260, z = 30 - R() * 360;
    if (!okTree(x, z)) continue;
    const gap = streetDist2(x, z);
    if (gap < 14 && R() < 0.75) continue; // keep front lawns mostly open
    trees.push([x, z, 3.2 + R() * 2.8]);
  }
  // art pass 1: a crown of five lumpy clumps a tree (maples and oaks), not two balls
  const canopyGeo = new THREE.IcosahedronGeometry(1, 1), trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6); trunkGeo.translate(0, 0.5, 0);
  { const p = canopyGeo.attributes.position; for (let i = 0; i < p.count; i++) { const n = 1 + (hash2(Math.round(p.getX(i) * 40 + 5), Math.round(p.getY(i) * 40 + p.getZ(i) * 23)) - 0.5) * 0.4; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.85, p.getZ(i) * n); } canopyGeo.computeVertexNormals(); }
  const NC = 5, canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), trees.length * NC);
  const trunk = new THREE.InstancedMesh(trunkGeo, std(0x3a2e24), trees.length);
  trees.forEach(([x, z, s], i) => {
    const y = streetAt(x, z), th = s * (0.9 + R() * 0.5);
    m4.compose(ps.set(x, y, z), q.identity(), sc.set(s * 0.6, th, s * 0.6)); trunk.setMatrixAt(i, m4);
    const base = [0x2c4a22, 0x35522a, 0x3e5a2c, 0x4a5a2a][Math.floor(R() * 4)];
    for (let k = 0; k < NC; k++) {
      const a = k / (NC - 1) * 6.28 + R(), rr = k === 0 ? 0 : s * 0.55, cs = s * (k === 0 ? 0.85 : 0.6 + R() * 0.15);
      q.setFromEuler(new THREE.Euler(R(), R() * 6, R()));
      m4.compose(ps.set(x + Math.cos(a) * rr, y + th + s * (k === 0 ? 0.9 : 0.45 + R() * 0.5), z + Math.sin(a) * rr), q, sc.set(cs, cs * 0.9, cs));
      canopy.setMatrixAt(i * NC + k, m4);
      col.set(base).offsetHSL((R() - 0.5) * 0.03, (R() - 0.5) * 0.08, (R() - 0.5) * 0.06 + (k === 0 ? 0.02 : 0)); canopy.setColorAt(i * NC + k, col);
    }
  });
  canopy.castShadow = trunk.castShadow = true; scene.add(canopy, trunk);

  /* ---------------- street lamps with pools of light ---------------- */
  const poolTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,190,110,0.55)'); gr.addColorStop(0.5, 'rgba(255,170,90,0.18)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const poleMat = std(0x2c2f34, { metalness: 0.5, roughness: 0.5 });
  const lampAt = (x, z, inward) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.5, 8), poleMat); pole.position.set(x, Y0 + 3.25, z); scene.add(pole);
    const arm = new THREE.Mesh(B(1.6, 0.08, 0.08), poleMat); arm.position.set(x + inward[0] * 0.8, Y0 + 6.4, z + inward[1] * 0.8); arm.rotation.y = Math.atan2(-inward[1], inward[0]); scene.add(arm);
    const lx = x + inward[0] * 1.5, lz = z + inward[1] * 1.5;
    const head = new THREE.Mesh(B(0.5, 0.14, 0.3), emis(0xffd29a)); head.position.set(lx, Y0 + 6.33, lz); scene.add(head);
    const gl = new THREE.Sprite(glowMat(0xffb36a)); gl.scale.setScalar(4.5); gl.position.set(lx, Y0 + 6.2, lz); scene.add(gl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(lx, Y0 + 0.03, lz); scene.add(pool);
  };
  for (const z of [-12, -55, -98, -141]) for (const s of [-1, 1]) lampAt(s * (STREET.half + 1.2), z + (s > 0 ? 20 : 0), [-s, 0]);
  for (const deg of [-25, -70, -110, -155]) { const a = deg * Math.PI / 180, r = STREET.bulbR + 1.2; lampAt(Math.cos(a) * r, STREET.end + Math.sin(a) * r, [-Math.cos(a), -Math.sin(a)]); }

  /* ---------------- floodlights (Topgolf style) ---------------- */
  const floods = [];
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(0xcfe0ff) } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; uniform vec3 uC; void main(){ gl_FragColor = vec4(uC * 0.035 * pow(vY, 1.6), 1.0); }', // softer (art pass 1)
  });
  const floodAt = (x, z, aim, real) => {
    const H = 24, y = Y0 + H;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, H, 10), std(0x5c6066, { metalness: 0.6, roughness: 0.45 })); pole.position.set(x, Y0 + H / 2, z); pole.castShadow = true; scene.add(pole);
    const head = new THREE.Group(); head.position.set(x, y, z); head.lookAt(aim[0], Y0, aim[1]); scene.add(head);
    const frame = new THREE.Mesh(B(4.2, 2.2, 0.3), poleMat); head.add(frame);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.85), emis(0xf4f8ff)); p.position.set(-1.35 + c * 1.35, 0.5 - r * 1.0, 0.16); head.add(p); }
    const gl = new THREE.Sprite(glowMat(0xdfe9ff)); gl.scale.setScalar(9); gl.position.set(x, y, z); scene.add(gl);
    // a faint beam in the dusk haze
    const dir = new THREE.Vector3(aim[0] - x, Y0 - y, aim[1] - z), len = dir.length();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 15, len, 20, 1, true), coneMat);
    cone.geometry.translate(0, -len / 2, 0); cone.position.set(x, y, z);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize()); scene.add(cone);
    if (real) { const L = new THREE.SpotLight(0xe6eeff, 3.2, 300, 0.62, 0.6, 1.0); L.position.set(x, y, z); L.target.position.set(aim[0], Y0, aim[1]); scene.add(L, L.target); floods.push(L); }
  };
  floodAt(-30, -58, [-2, -105], true); floodAt(30, -58, [2, -105], true);
  floodAt(-34, -150, [-4, -200], true); floodAt(34, -150, [4, -200], true);
  floodAt(-28, 8, [0, -45], false); floodAt(28, 8, [0, -45], false);

  /* ---------------- the giant hoop ---------------- */
  const hoop = new THREE.Group(); scene.add(hoop);
  const rimY = HOOP.y, bbZ = HOOP.z - HOOP.r - 0.45, poleZ = bbZ - 3.2;
  const hp = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, rimY + 3.5 - Y0, 12), std(0x2a2d33, { metalness: 0.5, roughness: 0.5 })); hp.position.set(0, (rimY + 3.5 + Y0) / 2, poleZ); hp.castShadow = true; hoop.add(hp);
  const arm = new THREE.Mesh(B(0.5, 0.5, bbZ - poleZ), hp.material); arm.position.set(0, rimY + 2.2, (bbZ + poleZ) / 2); hoop.add(arm);
  const bbTex = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const g = cv.getContext('2d'); g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 512, 300); g.strokeStyle = '#ff6a1a'; g.lineWidth = 16; g.strokeRect(10, 10, 492, 280); g.lineWidth = 12; g.strokeRect(176, 130, 160, 120); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t; })();
  const bb = new THREE.Mesh(B(6.3, 3.7, 0.18), [std(0xf0eee8), std(0xf0eee8), std(0xf0eee8), std(0xf0eee8), new THREE.MeshStandardMaterial({ map: bbTex, roughness: 0.4, emissive: 0x332a22, emissiveMap: bbTex }), std(0xf0eee8)]);
  bb.position.set(0, rimY + 1.25, bbZ); bb.castShadow = true; hoop.add(bb);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a, toneMapped: false });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP.r, 0.07, 8, 40), rimMat); rim.rotation.x = Math.PI / 2; rim.position.set(HOOP.x, rimY, HOOP.z); hoop.add(rim);
  const rimArm = new THREE.Mesh(B(0.3, 0.08, 0.5), rimMat); rimArm.position.set(0, rimY, bbZ + 0.3); hoop.add(rimArm);
  const rimGlow = new THREE.Sprite(glowMat(0xff7a2a)); rimGlow.scale.setScalar(6); rimGlow.position.copy(rim.position); hoop.add(rimGlow);
  // net: strands from the rim to a narrower ring below
  const netPts = [], NS = 16;
  for (let i = 0; i < NS; i++) { const a = i / NS * Math.PI * 2, b = (i + 0.5) / NS * Math.PI * 2; netPts.push(Math.cos(a) * HOOP.r, 0, Math.sin(a) * HOOP.r, Math.cos(b) * HOOP.r * 0.55, -1.6, Math.sin(b) * HOOP.r * 0.55); netPts.push(Math.cos(a) * HOOP.r, 0, Math.sin(a) * HOOP.r, Math.cos(a - 0.2) * HOOP.r * 0.55, -1.6, Math.sin(a - 0.2) * HOOP.r * 0.55); }
  const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xf2f2f2 })); net.position.copy(rim.position); hoop.add(net);
  let netKick = 0;

  /* ---------------- scoreboard on the lawn (mirrors the call) ---------------- */
  const sbCv = document.createElement('canvas'); sbCv.width = 1024; sbCv.height = 512;
  const sbTex = new THREE.CanvasTexture(sbCv); sbTex.encoding = THREE.sRGBEncoding; sbTex.anisotropy = 8;
  const sb = new THREE.Group(); sb.position.set(SB[0], Y0, SB[1]); scene.add(sb);
  for (const sx of [-3.4, 3.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 7, 8), poleMat); p.position.set(sx, 3.5, 0); sb.add(p); }
  const sbBox = new THREE.Mesh(B(10, 5.2, 0.6), std(0x15171b, { roughness: 0.6 })); sbBox.position.y = 8.4; sb.add(sbBox);
  const sbFace = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.8), new THREE.MeshBasicMaterial({ map: sbTex, toneMapped: false })); sbFace.position.set(0, 8.4, 0.31); sb.add(sbFace);
  sb.lookAt(0, Y0, 6); // face the bay
  const sbGlow = new THREE.Sprite(glowMat(0xffa040)); sbGlow.scale.set(16, 9, 1); sbGlow.material.opacity = 0.25; sbGlow.position.set(0, 8.4, 0.8); sb.add(sbGlow);
  function setBoard({ yd = '', color = '#ffb43a', shape = '', height = '', setter = '', status = '', rows = [] } = {}) {
    const g = sbCv.getContext('2d'), W = 1024, H = 512;
    g.fillStyle = '#07080a'; g.fillRect(0, 0, W, H);
    // dot grid like an LED panel
    g.fillStyle = 'rgba(255,170,60,0.05)'; for (let y = 6; y < H; y += 12) for (let x = 6; x < W; x += 12) g.fillRect(x, y, 5, 5);
    g.strokeStyle = '#3a3d44'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
    const led = (t, x, y, size, c = '#ffb43a', align = 'center') => { g.font = `700 ${size}px "Saira Semi Condensed", "Arial Narrow", monospace`; g.textAlign = align; g.textBaseline = 'middle'; g.shadowColor = c; g.shadowBlur = size * 0.35; g.fillStyle = c; g.fillText(t, x, y); g.shadowBlur = 0; };
    led('TARGET', 190, 52, 34, '#ff5a3a'); led('SHAPE', 520, 52, 34, '#ff5a3a'); led('HEIGHT', 830, 52, 34, '#ff5a3a');
    led(String(yd), 190, 150, 130, color); led(shape.toUpperCase(), 520, 150, 84); led(height.toUpperCase(), 830, 150, 84);
    led(status.toUpperCase() || (setter ? `SET BY ${setter.toUpperCase()}` : ''), W / 2, 262, 46, '#ffe08a');
    rows.slice(0, 4).forEach((r, i) => {
      const x = rows.length > 2 ? (i % 2 ? 560 : 60) : 60, y = rows.length > 2 ? 340 + Math.floor(i / 2) * 80 : 350 + i * 82;
      led(r.name.toUpperCase().slice(0, 9), x, y, 50, r.cur ? '#ffe08a' : '#c88a3a', 'left');
      [...r.word].forEach((ch, k) => led(ch, x + 260 + k * 46, y, 52, k < r.letters ? '#ff3a2a' : '#3a2a1c'));
    });
    sbTex.needsUpdate = true;
  }

  /* ---------------- LED target rings ---------------- */
  const ringVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
  const ringFS = `
varying vec2 vUv; uniform vec3 uColor; uniform float uT, uLit, uCalled, uR, uS, uBull, uFlash;
void main(){
  vec2 q = (vUv - 0.5) * 2.0 * uS;
  float r = length(q), a = atan(q.y, q.x);
  float px = max(fwidth(r), 0.01);
  float w = max(0.45, px * 2.2), bw = max(0.3, px * 1.8);
  float outer = 1.0 - smoothstep(w * 0.5 - px, w * 0.5 + px, abs(r - uR + w * 0.5));
  float bull = 1.0 - smoothstep(bw * 0.5 - px, bw * 0.5 + px, abs(r - uR * uBull));
  float n = max(12.0, floor(uR * 2.4));
  float seg = abs(fract(a / 6.28318 * n + uT * mix(0.0, 3.0, uLit)) - 0.5);
  float leds = mix(0.65, 1.0, smoothstep(0.32, 0.12, seg));
  float spd = mix(0.5, 5.0, uLit);
  float chase = 0.5 + 0.5 * sin(a * 3.0 - uT * spd);
  float idle = 0.8 + 0.2 * sin(uT * 1.7 + uR);
  float br = mix(idle * (0.6 + 0.4 * chase), 1.8 + 1.0 * chase, uLit) * mix(1.0, 1.4, uCalled) * leds;
  float fill = (1.0 - smoothstep(uR - w, uR, r)) * (0.035 + 0.22 * uLit + 0.04 * uCalled);
  float bullFill = (1.0 - smoothstep(uR * uBull - bw, uR * uBull, r)) * (0.05 + 0.4 * uLit + 0.05 * uCalled);
  float halo = exp(-abs(r - uR) / (0.7 + 2.0 * uLit)) * (0.12 + 0.45 * uLit + 0.12 * uCalled);
  float flash = uFlash * (1.0 - smoothstep(0.0, uR, r)) * 1.2;
  vec3 c = uColor * (outer * br * 1.7 + bull * br * 1.25 + fill + bullFill + halo + flash);
  gl_FragColor = vec4(c, 1.0);
}`;
  const labelTex = (T, big) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = T.color; g.shadowBlur = 18; g.fillStyle = T.color;
    g.font = '800 84px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(String(T.yd), 128, T.hoop ? 54 : 66);
    if (T.hoop) { g.font = '700 34px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText('HOOP', 128, 108); }
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  };
  const beaconMat = c => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(c) }, uT: { value: 0 }, uA: { value: 0 } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying float vY; uniform vec3 uC; uniform float uT, uA; void main(){ float s = 0.75 + 0.25*sin(vY*30.0 - uT*4.0); gl_FragColor = vec4(uC * uA * s * pow(1.0 - vY, 1.6) * 0.7, 1.0); }',
  });
  const NPOST = 18, postGeo = new THREE.BoxGeometry(0.22, 1, 0.22); postGeo.translate(0, 0.5, 0);
  const rings = TARGETS.map(T => {
    const g = new THREE.Group(); g.position.set(T.px, Y0 + 0.04, T.pz); scene.add(g);
    const u = { uColor: { value: new THREE.Color(T.color) }, uT: { value: 0 }, uLit: { value: 0 }, uCalled: { value: 0 }, uR: { value: 8 }, uS: { value: 10 }, uBull: { value: BULL_FRAC }, uFlash: { value: 0 } };
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: ringVS, fragmentShader: ringFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, extensions: { derivatives: true } }));
    disc.rotation.x = -Math.PI / 2; disc.renderOrder = 1; g.add(disc);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 6), std(0xdddddd, { metalness: 0.4 })); pole.position.y = 2.1; g.add(pole);
    const flagM = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshBasicMaterial({ color: T.color, side: THREE.DoubleSide, toneMapped: false }));
    flagM.geometry.translate(0.85, 0, 0); flagM.position.y = 3.6; g.add(flagM);
    const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(T), depthWrite: false, transparent: true, toneMapped: false, fog: false }));
    const dist = Math.hypot(T.px, T.pz - 4); lbl.scale.set(dist * 0.06, dist * 0.03, 1); lbl.position.y = 4.6 + dist * 0.018; g.add(lbl);
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 70, 16, 1, true), beaconMat(T.color)); beacon.position.y = 35; beacon.visible = false; beacon.scale.set(0.5 + dist / 110, 1, 0.5 + dist / 110); g.add(beacon);
    // LED bollards around the rim: they read as a ring even from a low angle, and chase when lit
    const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NPOST);
    posts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(posts);
    return { T, g, disc, u, flagM, lbl, beacon, posts, base: new THREE.Color(T.color), lit: 0, flash: 0 };
  });
  function setRings(diff) {
    for (const o of rings) {
      const r = ringR(o.T, diff); o.u.uR.value = r; o.u.uS.value = r * 1.35; o.disc.scale.setScalar(r * 1.35);
      const h = 0.7 + Math.hypot(o.T.px, o.T.pz) * 0.006; // taller further away so they still read
      for (let k = 0; k < NPOST; k++) { const a = k / NPOST * Math.PI * 2; m4.compose(ps.set(Math.cos(a) * r, 0, Math.sin(a) * r), q.identity(), sc.set(1, h, 1)); o.posts.setMatrixAt(k, m4); }
      o.posts.instanceMatrix.needsUpdate = true;
    }
  }
  let called = -1;
  function setCalled(i) { called = i; rings.forEach((o, k) => { o.beacon.visible = k === i; }); }
  // sparkle bursts
  const bursts = [];
  const sparkTex = glow;
  function sparkle(x, y, z, color, n = 90, spread = 4) {
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * spread; pos.set([x + Math.cos(a) * rr, y + 0.3, z + Math.sin(a) * rr], i * 3); vel.push([Math.cos(a) * (1 + R() * 3), 5 + R() * 9, Math.sin(a) * (1 + R() * 3)]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ map: sparkTex, color, size: 0.9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const p = new THREE.Points(g, m); scene.add(p); bursts.push({ p, vel, t: 0 });
  }
  function lightRing(i, { bull = false } = {}) {
    const o = rings[i]; if (!o) return;
    o.lit = 3.2; o.flash = 1;
    sparkle(o.T.px, Y0, o.T.pz, o.T.color, bull ? 160 : 90, o.u.uR.value * 0.8);
    if (bull) sparkle(o.T.px, Y0, o.T.pz, 0xffe9a0, 80, o.u.uR.value * 0.3);
  }
  // landing markers: a small white ring that pops out where each ball landed this call
  const marks = [];
  const markMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });
  function markLanding(x, z, color = 0xffffff) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 28), markMat(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, groundAt(x, z) + 0.06, z); m.userData.t = 0; scene.add(m); marks.push(m);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16), markMat(color)); dot.rotation.x = -Math.PI / 2; dot.position.set(x, groundAt(x, z) + 0.07, z); dot.userData.dot = true; scene.add(dot); marks.push(dot);
  }
  function clearMarks() { while (marks.length) { const m = marks.pop(); scene.remove(m); m.geometry.dispose(); m.material.dispose(); } }

  return {
    ...st, groundAt, surfaceAt, rings, setRings, setCalled, lightRing, sparkle, markLanding, clearMarks, setBoard,
    swish() { netKick = 1; sparkle(HOOP.x, HOOP.y - 1, HOOP.z, 0xff8a2a, 140, 1.5); },
    animate(clock, dt) {
      for (const o of rings) {
        o.lit = Math.max(0, o.lit - dt); o.flash = Math.max(0, o.flash - dt * 2.2);
        o.u.uT.value = clock; o.u.uLit.value = Math.min(1, o.lit / 0.8); o.u.uFlash.value = o.flash;
        o.u.uCalled.value += ((o.T.i === called ? 1 : 0) - o.u.uCalled.value) * Math.min(1, dt * 4);
        o.flagM.rotation.y = Math.sin(clock * 2.2 + o.T.i) * 0.35;
        const lv = o.u.uLit.value, cv = o.u.uCalled.value;
        for (let k = 0; k < NPOST; k++) {
          const chase = 0.5 + 0.5 * Math.sin(k / NPOST * Math.PI * 6 - clock * (1 + 9 * lv));
          col.copy(o.base).multiplyScalar((0.45 + 0.25 * chase) * (1 + 0.5 * cv) + lv * (0.9 + 1.2 * chase)); o.posts.setColorAt(k, col);
        }
        o.posts.instanceColor.needsUpdate = true;
        if (o.beacon.visible) { o.beacon.material.uniforms.uT.value = clock; o.beacon.material.uniforms.uA.value = 0.55 + 0.45 * Math.max(o.u.uLit.value, 0.3 + 0.2 * Math.sin(clock * 3)); }
      }
      for (let k = bursts.length - 1; k >= 0; k--) {
        const b = bursts[k]; b.t += dt; const P = b.p.geometry.attributes.position;
        for (let i = 0; i < b.vel.length; i++) { const v = b.vel[i]; v[1] -= 9 * dt; P.array[i * 3] += v[0] * dt; P.array[i * 3 + 1] = Math.max(Y0 + 0.05, P.array[i * 3 + 1] + v[1] * dt); P.array[i * 3 + 2] += v[2] * dt; }
        P.needsUpdate = true; b.p.material.opacity = Math.max(0, 1 - b.t / 1.7);
        if (b.t > 1.7) { scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(k, 1); }
      }
      for (const m of marks) { m.userData.t += dt; if (!m.userData.dot) { const s = 1 + Math.min(1, m.userData.t * 3) * 1.4; m.scale.setScalar(s); } }
      // the TV next door flickers
      const tvF = 0.55 + 0.45 * hash2(Math.floor(clock * 7), 3); tvMat.color.setRGB(0.35 * tvF, 0.55 * tvF, 1.0 * tvF);
      // net sways after a swish
      netKick = Math.max(0, netKick - dt * 0.8); net.scale.set(1 + 0.15 * netKick * Math.sin(clock * 20), 1 - 0.25 * netKick, 1 + 0.15 * netKick * Math.cos(clock * 17));
      rimGlow.material.opacity = 0.7 + 0.3 * Math.sin(clock * 2) + netKick;
    },
  };
}
