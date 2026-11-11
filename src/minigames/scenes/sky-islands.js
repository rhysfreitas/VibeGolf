// The Aerie's sky world for Island Hopper: floating islands over a sea of clouds, with
// decorative spires in the distance. Islands live in a `chain` group that slides so the ball's
// island is always at the local origin (the camera never has to move far from the stand-over view).

import { createStage, rng, hash2 } from '../../world/stage.js';
import { cumulusBanks, skyPines } from '../../world/sky-art.js';
import { edgeR, islandTop, islandFrac, padRadius, groundAt as islandsGround, band } from '../island-logic.js';

const FOG_V = '\n#include <fog_pars_vertex>\n';

export function createSkyIslands(container) {
  const st = createStage(container, {
    // the Aerie's golden morning (its course preset): low warm sun, a bright cloud sea bouncing light back up
    turbidity: 2.6, rayleigh: 1.9, mie: 0.005, mieG: 0.85, elev: 16, az: 48,
    sunColor: 0xffc48a, sunInt: 3.0, exposure: 0.6, hemiSky: 0xb8cdea, hemiGround: 0xd9d2c4, hemiInt: 0.62,
    fogColor: 0xece6da, fogNear: 700, fogFar: 5600, shadowBox: 140,
  });
  const { scene } = st;
  const chain = new THREE.Group(); scene.add(chain);
  const origin = new THREE.Vector3();          // world point that sits at the local origin
  const islands = [];                           // live island defs (world coords)

  /* ---------- cloud sea ---------- */
  function cloudLayer(y, scale, alpha, speed) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uA: { value: alpha }, uS: { value: scale }, uV: { value: speed } }]),
      vertexShader: `varying vec3 vW; ${FOG_V} void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
      fragmentShader: `varying vec3 vW; uniform float uT, uA, uS, uV;
        #include <fog_pars_fragment>
        float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
        float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
        float fb(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s += a*vn(p); p = p*2.03 + 7.1; a *= 0.5; } return s; }
        void main(){ vec2 p = vW.xz * uS + vec2(uT*uV, uT*uV*0.4);
          float n = fb(p + fb(p*0.5 + uT*0.01)*1.6);
          float a = smoothstep(0.38, 0.72, n) * uA;
          float lit = 0.8 + 0.25*smoothstep(0.45, 0.85, fb(p*1.7 + 3.0));
          gl_FragColor = vec4(mix(vec3(0.6,0.66,0.76), vec3(1.0,0.96,0.88), lit*0.95), a); // white tops, blue-grey folds
          #include <tonemapping_fragment>
          #include <encodings_fragment>
          #include <fog_fragment>
        }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), mat);
    m.position.y = y; m.renderOrder = -1; scene.add(m); return mat;
  }
  const clouds = [cloudLayer(-170, 0.0016, 1, 1), cloudLayer(-115, 0.0028, 0.5, 1.8)];
  // cumulus standing round the horizon, as on the Aerie course (one mesh)
  scene.add(cumulusBanks({ cx: 0, cz: -300, sunDir: st.sunDir, haze: new THREE.Color(0xece6da), n: st.coarse ? 22 : 34, baseY: -150 }));

  /* ---------- island mesh ---------- */
  const islandMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, envMapIntensity: 0.6 });
  const c1 = new THREE.Color(), c2 = new THREE.Color();
  // the Aerie's palette (tools/aerie/art-brief.md): pale quartz sandstone in amber bands, darker undersides, mown
  // grass lighter than the golden rough, moss on the lip
  const SAND = [0xcdbfa3, 0xb39f80, 0xd9b98a].map(h => new THREE.Color(h)), UNDER = new THREE.Color(0x6f6658), MOSS = new THREE.Color(0x4f6b30);
  const FAIR = new THREE.Color(0x5f9a36), FAIR2 = new THREE.Color(0x6aa63e), ROUGH = new THREE.Color(0x5a7a34), ROUGH2 = new THREE.Color(0x6e7f38);
  function islandMesh(I, deco) {
    const N = deco ? 48 : 80, rings = [0, 0.12, 0.25, 0.4, 0.55, 0.68, 0.79, 0.88, 0.94, 0.98, 1], K = deco ? 14 : 22;
    const D = I.depth || I.r * (3.2 + (I.seed % 1) * 2.4), rows = rings.length + K;
    const pos = new Float32Array((N + 1) * rows * 3), col = new Float32Array((N + 1) * rows * 3);
    const R = rng(Math.floor(I.seed * 1000) + 7), lean = [(R() - 0.5) * 0.2, (R() - 0.5) * 0.2];
    // far spires in three forms, as on the Aerie course: straight-sided pillars, stepped towers and carrots
    const form = !deco ? 'carrot' : (hash2(Math.floor(I.seed * 97), 5) < 0.45 ? 'pillar' : hash2(Math.floor(I.seed * 97), 6) < 0.4 ? 'stepped' : 'carrot');
    const shape = t => form === 'pillar' ? (t < 0.82 ? 1 - 0.16 * t : 0.87 * Math.sqrt(Math.max(0, 1 - (t - 0.82) / 0.18)))
      : form === 'stepped' ? Math.max(0, 1 - 0.22 * Math.floor(t * 4.2)) * (t < 0.95 ? 1 : (1 - t) / 0.05) : Math.pow(Math.max(0, 1 - t), 0.75);
    let v = 0;
    for (let j = 0; j <= N; j++) {
      const th = j / N * Math.PI * 2, er = edgeR(I, th), cx = Math.cos(th), sz = Math.sin(th);
      let rimY = 0;
      for (const f of rings) {
        const x = I.x + cx * er * f * 0.999, z = I.z + sz * er * f * 0.999, y = islandTop(I, x, z, f);
        pos.set([x, y, z], v * 3);
        const n = 0.5 + 0.5 * Math.sin(x * 0.7 + I.seed) * Math.cos(z * 0.6);
        if (f < 0.62) c1.copy(FAIR).lerp(FAIR2, n * 0.5).lerp(ROUGH, Math.max(0, (f - 0.42) / 0.2) * 0.85);   // mown round the pad
        else c1.copy(ROUGH).lerp(ROUGH2, n * 0.7);                                                       // longer, a little golden
        if (f > 0.92) c1.lerp(MOSS, 0.6);
        col.set([c1.r, c1.g, c1.b], v * 3); v++; rimY = y;
      }
      for (let k = 1; k <= K; k++) {
        const t = Math.pow(k / K, 1.3), d = t * D;
        const taper = k === 1 ? 1.03 : shape(t) * (1 + 0.14 * (hash2(j * 7 + k, Math.floor(I.seed * 31)) - 0.5) + 0.06 * Math.sin(d * 0.15 + th * 5));
        const x = I.x + lean[0] * d + cx * er * taper, z = I.z + lean[1] * d + sz * er * taper;
        pos.set([x, rimY - d - (k === 1 ? 0.8 : 0), z], v * 3);
        const yy = rimY - d, bi = Math.floor(yy / 3.2 + I.seed * 7), band = hash2(bi, Math.floor(I.seed * 13)), wob = 0.5 + 0.5 * Math.sin(yy * 1.7 + th * 3);
        c1.copy(SAND[band < 0.45 ? 0 : band < 0.75 ? 1 : 2]).lerp(SAND[1], wob * 0.25);                 // horizontal bands, amber where the sun catches
        if (hash2(j, Math.floor(I.seed * 31)) < 0.1) c1.multiplyScalar(0.72);                           // vertical fractures
        c1.lerp(UNDER, Math.min(1, d / (D * 0.75)) * 0.85);                                              // the underside falls into shadow
        if (k <= 2) c1.lerp(MOSS, 0.7);                                                                   // mossy lip
        col.set([c1.r, c1.g, c1.b], v * 3); v++;
      }
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let r = 0; r < rows - 1; r++) { const a = j * rows + r, b = (j + 1) * rows + r; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(geo, islandMat); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh);
    // a few pines near the rim, never on the pad
    const trees = [], nT = deco ? Math.round(I.r / 5) : 3 + Math.floor(R() * 4);
    for (let t = 0; t < nT * 8 && trees.length < nT; t++) {
      const th = R() * 6.28, f = 0.6 + R() * 0.28, x = I.x + Math.cos(th) * edgeR(I, th) * f, z = I.z + Math.sin(th) * edgeR(I, th) * f;
      if (!deco && Math.sin(th) < -0.25) continue;                          // you tee off from the front: keep it clear
      trees.push([x, islandTop(I, x, z, f), z, 0.8 + R() * 0.7]);
    }
    if (trees.length) skyPines(trees.map(([x, y, z, s]) => ({ x, y, z, s, r: R() * 0.6, type: 'pine' })), g); // the Aerie's wind-bent pines
    return g;
  }

  /* ---------- pads, beacons, labels ---------- */
  const padMat = color => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uA; uniform vec3 uC;
      void main(){ float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.92, 1.0, r));
        float fill = (1.0 - smoothstep(0.0, 0.85, r)) * (0.25 + 0.12 * sin(uT * 3.0 - r * 9.0));
        gl_FragColor = vec4(uC * (ring * 1.6 + fill) * uA, 1.0); }`,
  });
  const BAND_COL = { short: 0x6dffb0, mid: 0x36e2ff, long: 0xffc23d };
  function label(text, sub, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(14,26,32,0.72)'; g.beginPath(); g.roundRect ? g.roundRect(8, 14, 240, 100, 18) : g.rect(8, 14, 240, 100); g.fill();
    g.fillStyle = color; g.textAlign = 'center';
    g.font = '800 52px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(text, 128, 66);
    g.fillStyle = '#f2efe6'; g.font = '600 26px "Saira Semi Condensed", "Arial Narrow", sans-serif'; g.fillText(sub, 128, 100);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, depthTest: false, transparent: true, toneMapped: false }));
    s.renderOrder = 8; return s;
  }

  function addIsland(I, { pad = true, labelText = null, rise = 0 } = {}) {
    const g = islandMesh(I, false);
    const obj = { I, group: g, rise, riseT: rise ? 0 : 1, pad: null, beacon: null, label: null, alpha: 1, removing: 0 };
    if (pad) {
      const color = BAND_COL[I.band] || 0x36e2ff, pr = padRadius(I);
      const p = new THREE.Mesh(new THREE.CircleGeometry(pr * 1.15, 48).rotateX(-Math.PI / 2), padMat(color));
      p.position.set(I.x, islandTop(I, I.x, I.z, 0) + 0.12, I.z); p.renderOrder = 3; g.add(p); obj.pad = p;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
      b.geometry.translate(0, 30, 0); b.position.copy(p.position); g.add(b); obj.beacon = b;
      if (labelText) { const l = label(labelText[0], labelText[1], '#' + new THREE.Color(color).getHexString()); l.position.set(I.x, p.position.y + 14, I.z); g.add(l); obj.label = l; }
    }
    chain.add(g); islands.push(obj);
    if (rise) g.position.y = -rise;
    return obj;
  }
  function removeIsland(obj, animate = true) {
    if (!animate) { chain.remove(obj.group); dispose(obj.group); islands.splice(islands.indexOf(obj), 1); return; }
    obj.removing = 0.0001;
  }
  const dispose = g => g.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && o.material !== islandMat && !o.isInstancedMesh) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });

  /* ---------- distant spires (static decor) ---------- */
  const R = rng(321);
  for (let i = 0; i < 34; i++) {
    const a = R() * Math.PI * 2, rad = 380 + Math.pow(R(), 0.8) * 1700, size = 20 + R() * 55 + rad * 0.025;
    const I = { x: Math.cos(a) * rad, z: Math.sin(a) * rad - 300, y: -60 + R() * 200 + (rad > 1000 ? R() * 200 : 0), r: size, seed: R() * 10, depth: size * (3 + R() * 3) };
    if (Math.abs(I.x) < 160 && I.z < 0 && I.z > -900) continue; // keep the play lane open
    scene.add(islandMesh(I, true));
  }

  /* ---------- frame ---------- */
  function setOrigin(p) { origin.copy(p); chain.position.set(-p.x, -p.y, -p.z); }
  const defs = () => islands.filter(o => !o.removing && o.riseT >= 1).map(o => o.I);
  // local frame: ball at the origin
  const groundAt = (x, z) => { const v = islandsGround(defs(), x + origin.x, z + origin.z); return v === null ? null : v - origin.y; };
  const safeGround = (x, z) => { const v = groundAt(x, z); return v === null ? -999 : v; };

  return {
    ...st, chain, islands, origin, addIsland, removeIsland, setOrigin, groundAt, safeGround, defs,
    get busy() { return islands.some(o => o.removing || o.riseT < 1); },
    animate(clock, dt) {
      clouds.forEach(m => { m.uniforms.uT.value = clock; });
      for (let i = islands.length - 1; i >= 0; i--) {
        const o = islands[i];
        if (o.riseT < 1) { o.riseT = Math.min(1, o.riseT + dt / 1.4); const e = 1 - Math.pow(1 - o.riseT, 3); o.group.position.y = -o.rise * (1 - e); }
        if (o.removing) {
          o.removing += dt / 0.9; const u = Math.min(1, o.removing);
          o.group.position.y = -u * u * 60;
          o.group.traverse(m => { if (m.material && m.material.transparent && m.material.opacity !== undefined && !m.material.uniforms) m.material.opacity *= 0.9; });
          if (u >= 1) { chain.remove(o.group); dispose(o.group); islands.splice(i, 1); continue; }
        }
        if (o.pad) o.pad.material.uniforms.uT.value = clock;
        if (o.beacon) o.beacon.material.opacity = 0.16 + 0.08 * Math.sin(clock * 2.5 + o.I.seed);
        if (o.label) { const d = o.label.position.clone().add(chain.position).distanceTo(st.camera.position); const s = Math.max(10, d * 0.13); o.label.scale.set(s, s * 0.5, 1); o.label.position.y = islandTop(o.I, o.I.x, o.I.z, 0) + 6 + s * 0.45 + Math.sin(clock * 2 + o.I.seed) * 0.4; }
      }
    },
  };
}
