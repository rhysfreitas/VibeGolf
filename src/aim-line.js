// The phantom aim line, shared by every mode: a dashed arc showing where the next simulated shot
// will fly, with a marker (‹ ○ ›) where it lands. Drag sideways anywhere on the 3D view to swing
// it left or right; taps still reach the page (a drag only starts after 10 px of sideways travel).
//
//   const al = createAimLine({ renderer, scene, camera });
//   al.show(flatXYZ, landXYZ) · al.hide() · al.visible
//   al.onDrag({ enabled: () => bool, start(), move(dDeg), end() })   // dDeg: + = right
//   attachAimDrag(renderer, camera, { ... })                         // the drag alone
// Shots from the R10 never use it.

export function createAimLine({ renderer, scene, camera }, { color = '#ffffff', opacity = 0.62, width = 1.8, markPx = 30 } = {}) {
  const el = renderer.domElement;
  const mat = new THREE.LineMaterial({ color: new THREE.Color(color), linewidth: width * renderer.getPixelRatio(), transparent: true, opacity, depthWrite: false, toneMapped: false, dashed: true, dashSize: 2.2, gapSize: 1.6 });
  mat.defines.USE_DASH = '';
  const line = new THREE.Line2(new THREE.LineGeometry(), mat);
  line.frustumCulled = false; line.renderOrder = 3; line.visible = false; scene.add(line);
  line.onBeforeRender = () => mat.resolution.set(el.width || 1, el.height || 1);

  // landing marker: a ring with a chevron either side, always facing you, a constant size on screen
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 64;
  const g = cv.getContext('2d'); g.lineCap = g.lineJoin = 'round';
  for (const [w, col] of [[9, 'rgba(0,0,0,0.35)'], [4.5, '#ffffff']]) {
    g.lineWidth = w; g.strokeStyle = col;
    g.beginPath(); g.arc(80, 32, 15, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(45, 20); g.lineTo(33, 32); g.lineTo(45, 44); g.moveTo(115, 20); g.lineTo(127, 32); g.lineTo(115, 44); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0.88 }));
  mark.renderOrder = 6; mark.visible = false; mark.center.set(0.5, 0.5); scene.add(mark);
  mark.onBeforeRender = (r, s, cam) => {
    const d = cam.position.distanceTo(mark.position), h = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * d * markPx / (el.clientHeight || innerHeight);
    mark.scale.set(h * 2.5, h, 1); mark.updateMatrixWorld();
  };

  function show(arr, land) {
    if (!arr || arr.length < 6) { hide(); return; }
    line.geometry.setPositions(arr); line.geometry._maxInstanceCount = undefined; line.computeLineDistances(); // see CLAUDE.md "Line2 tracers"
    line.visible = true;
    if (land) { mark.position.set(land[0], land[1] + 0.05, land[2]); mark.visible = true; } else mark.visible = false;
  }
  function hide() { line.visible = mark.visible = false; }

  const onDrag = (o = {}) => attachAimDrag(renderer, camera, { ...o, enabled: e => line.visible && (o.enabled ? o.enabled(e) : true) });
  return { line, mark, show, hide, onDrag, get visible() { return line.visible; } };
}

// The drag on its own, for a page that draws its own prediction (the course): a sideways drag on
// the view reports how many degrees it has swung the aim (+ = right).
export function attachAimDrag(renderer, camera, { enabled = () => true, start = () => {}, move = () => {}, end = () => {} } = {}) {
  const el = renderer.domElement;
  {
    const ray = new THREE.Raycaster();
    const ang = e => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
      const v = ray.ray.direction; return Math.atan2(v.x, -v.z);
    };
    let d = null;
    el.addEventListener('pointerdown', e => { d = enabled(e) && e.button <= 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY, a0: ang(e), on: false } : null; });
    el.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      if (!d.on) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) { if (Math.abs(dy) > 24) d = null; return; }
        if (!enabled(e)) { d = null; return; }
        d.on = true; try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
        start();
      }
      let a = ang(e) - d.a0; a = Math.atan2(Math.sin(a), Math.cos(a));
      move(a * 180 / Math.PI);
    });
    const stop = e => { if (d && e.pointerId === d.id && d.on) end(); if (d && e.pointerId === d.id) d = null; };
    el.addEventListener('pointerup', stop); el.addEventListener('pointercancel', stop);
  }
}
