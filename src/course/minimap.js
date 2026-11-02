// Corner hole map for course play: a small top-down plan of the current hole, rotated so the
// hole always plays up the screen. Static shapes are drawn once per hole; the ball, aim line,
// landing ellipse and shot tracks are redrawn each frame.

const COL = {
  rim: 'rgba(8, 14, 12, 0.55)',
  rough: '#3d6a2b',
  fairway: '#5e9a3a',
  green: '#7cc65b',
  sand: '#e8d29a',
  tee: '#86b85e',
  track: 'rgba(245, 197, 66, 0.85)',
  trackOld: 'rgba(245, 197, 66, 0.45)',
  aim: 'rgba(242, 239, 230, 0.75)',
};

export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  let hole = null, view = null, staticLayer = null, dpr = 1, W = 0, H = 0;

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    if (hole) fit();
  }

  // hole = { shapes: [{ kind, rim:[[x,z]...], fair:[[x,z]...]|null, green:{x,z,r}|null, bunkers:[[x,z,r]] }], tee:[x,z], pin:[x,z] }
  function setHole(h) { hole = h; fit(); }

  function fit() {
    if (!hole || W < 30 || H < 30) { view = null; return; } // not laid out yet
    const [tx, tz] = hole.tee, [px, pz] = hole.pin;
    const ang = Math.atan2(px - tx, -(pz - tz));          // hole direction as a yaw
    const c = Math.cos(-ang), s = Math.sin(-ang);
    const toLocal = (x, z) => { const dx = x - tx, dz = z - tz; return [dx * c - dz * s, dx * s + dz * c]; };
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const sh of hole.shapes) for (const [x, z] of sh.rim) {
      const [lx, lz] = toLocal(x, z);
      minX = Math.min(minX, lx); maxX = Math.max(maxX, lx); minZ = Math.min(minZ, lz); maxZ = Math.max(maxZ, lz);
    }
    const pad = 8, k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = W / 2 - (minX + maxX) / 2 * k, oz = H / 2 - (minZ + maxZ) / 2 * k;
    view = { k, map: (x, z) => { const [lx, lz] = toLocal(x, z); return [ox + lx * k, oz + lz * k]; } };
    drawStatic();
  }

  function path(g, pts) { g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = view.map(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); }

  function drawStatic() {
    staticLayer = document.createElement('canvas');
    staticLayer.width = canvas.width; staticLayer.height = canvas.height;
    const g = staticLayer.getContext('2d');
    g.scale(dpr, dpr);
    g.lineJoin = 'round';
    for (const sh of hole.shapes) {
      path(g, sh.rim); g.lineWidth = 3; g.strokeStyle = COL.rim; g.stroke();
      g.fillStyle = sh.kind === 'tee' ? COL.rough : COL.rough; g.fill();
      if (sh.fair) { path(g, sh.fair); g.fillStyle = COL.fairway; g.fill(); }
      if (sh.green) {
        const [a, b] = view.map(sh.green.x, sh.green.z);
        g.beginPath(); g.arc(a, b, (sh.green.r + 2) * view.k, 0, 7); g.fillStyle = COL.fairway; g.fill();
        g.beginPath(); g.arc(a, b, sh.green.r * view.k, 0, 7); g.fillStyle = COL.green; g.fill();
      }
      for (const [x, z, r] of sh.bunkers || []) { const [a, b] = view.map(x, z); g.beginPath(); g.arc(a, b, Math.max(1.5, r * view.k), 0, 7); g.fillStyle = COL.sand; g.fill(); }
    }
    // tee box
    const [ta, tb] = view.map(hole.tee[0], hole.tee[1]);
    g.fillStyle = COL.tee; g.fillRect(ta - 4, tb - 5, 8, 10);
    // flag
    const [fa, fb] = view.map(hole.pin[0], hole.pin[1]);
    g.strokeStyle = '#f2efe6'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(fa, fb); g.lineTo(fa, fb - 11); g.stroke();
    g.fillStyle = '#f5c542'; g.beginPath(); g.moveTo(fa, fb - 11); g.lineTo(fa + 7, fb - 8.5); g.lineTo(fa, fb - 6); g.closePath(); g.fill();
    g.fillStyle = '#0b0f0c'; g.beginPath(); g.arc(fa, fb, 1.6, 0, 7); g.fill();
  }

  function line(pts, color, width, dash) {
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => { const [a, b] = view.map(p.x, p.z); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  }

  // d = { ball:{x,z}, ballVisible, aim:{land:{x,z}, rest:{x,z}|null, color, lat, dep, yaw}|null, tracks:[[{x,z}]], live:[{x,z}] }
  function draw(d) {
    const r = canvas.getBoundingClientRect();                 // re-fit if the box changed (rotation)
    if (Math.round(r.width) !== W || Math.round(r.height) !== H) size();
    if (!view || !staticLayer) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    d.tracks.forEach((t, i) => line(t, i === d.tracks.length - 1 && !d.live ? COL.track : COL.trackOld, 1.4));
    if (d.live) line(d.live, COL.track, 1.8);
    if (d.aim) {
      line([d.ball, d.aim.land], COL.aim, 1.2, [3, 3]);
      const [a, b] = view.map(d.aim.land.x, d.aim.land.z);
      ctx.save(); ctx.translate(a, b);
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(3, d.aim.lat * view.k), Math.max(3, d.aim.dep * view.k), 0, 0, 7);
      ctx.strokeStyle = d.aim.color; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.globalAlpha = 0.18; ctx.fillStyle = d.aim.color; ctx.fill(); ctx.restore();
      if (d.aim.rest) { const [ra, rb] = view.map(d.aim.rest.x, d.aim.rest.z); ctx.beginPath(); ctx.arc(ra, rb, 1.8, 0, 7); ctx.fillStyle = 'rgba(242,239,230,0.9)'; ctx.fill(); }
    }
    if (d.ballVisible) {
      const [a, b] = view.map(d.ball.x, d.ball.z);
      ctx.beginPath(); ctx.arc(a, b, 3.4, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
    }
  }

  size();
  addEventListener('resize', size);
  return { setHole, draw, resize: size };
}
