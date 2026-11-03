// Shot detail: the full set of launch-monitor numbers for one shot, with small illustrations
// (club delivery from above, launch and trajectory from the side, spin axis), in the spirit of
// the Garmin Golf app's shot view. Signs follow GSPro Open Connect / TrackMan for a right-hander:
// path + = in-to-out, face + = open (right of target), attack + = up, spin axis + = tilted right.

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = (v, d = 1) => (Math.abs(v) < 0.05 ? 0 : v).toFixed(d);

// Tour-average smash factor and attack angle per club (TrackMan PGA Tour averages; SW is a partial).
export const CLUB_DELIVERY = {
  DR: { smash: 1.49, aoa: -1.3 }, '3W': { smash: 1.48, aoa: -2.9 }, HY: { smash: 1.46, aoa: -3.3 },
  '5i': { smash: 1.38, aoa: -3.1 }, '7i': { smash: 1.33, aoa: -4.3 }, '9i': { smash: 1.28, aoa: -4.7 },
  PW: { smash: 1.23, aoa: -5.0 }, SW: { smash: 1.15, aoa: -5.0 },
};

// Rough D-plane inverse: start direction is mostly face, curvature follows face-to-path.
// Used when a shot arrives without club data (or for slider-set simulated shots).
export function deliveryFromBall(ball) {
  const ftp = (ball.SpinAxis || 0) / 1.6;
  const face = (ball.HLA || 0) + 0.2 * ftp;
  return { face, path: face - ftp };
}

// Everything the detail view shows, from a stored range shot { club, shot, r, live }.
export function shotMetrics(rec, clubId) {
  const b = rec.shot, c = b.Club || null, def = CLUB_DELIVERY[clubId] || CLUB_DELIVERY['7i'];
  const measured = !!(c && +c.Speed > 0);
  const est = !measured;
  const d = deliveryFromBall(b);
  const clubSpeed = measured ? +c.Speed : b.Speed / def.smash;
  const path = c && c.Path !== undefined ? +c.Path : d.path;
  const face = c && c.FaceToTarget !== undefined ? +c.FaceToTarget : d.face;
  const aoa = c && c.AngleOfAttack !== undefined ? +c.AngleOfAttack : def.aoa;
  const axis = b.SpinAxis || 0, spin = b.TotalSpin || 0;
  const r = rec.r;
  return {
    source: rec.live ? 'R10' : 'Sim', est: est && rec.live, sim: !rec.live,
    clubSpeed, smash: b.Speed / clubSpeed, aoa, path, face, ftp: face - path,
    ballSpeed: b.Speed, launch: b.VLA, dir: b.HLA || 0,
    spin, axis, back: spin * Math.cos(axis * DEG), side: spin * Math.sin(axis * DEG),
    carry: r.carry, total: r.totalDown, roll: r.totalDown - r.carry,
    carryOff: r.carryOffline, totalOff: r.offline,
    apexFt: r.apexFt, descent: r.descent, hang: r.flightTime,
    shape: shotShape(b.HLA || 0, axis),
  };
}

// Ball-flight name from start direction and curve (right-handed golfer).
export function shotShape(start, axis) {
  const s = start < -1.5 ? 'Pull' : start > 1.5 ? 'Push' : '';
  const c = axis < -8 ? 'hook' : axis < -2.5 ? 'draw' : axis > 8 ? 'slice' : axis > 2.5 ? 'fade' : '';
  if (!s && !c) return 'Straight';
  if (!s) return c[0].toUpperCase() + c.slice(1);
  return c ? `${s} ${c}` : s;
}

const side = (v, pos, neg, d = 1) => Math.abs(v) < 0.05 ? `0.0°` : `${fmt(Math.abs(v), d)}° <em>${v > 0 ? pos : neg}</em>`;
const lr = (v, unit = '') => Math.abs(v) < 0.5 ? `0${unit}` : `${Math.round(Math.abs(v))}${unit} <em class="${v < 0 ? 'L' : 'R'}">${v < 0 ? 'L' : 'R'}</em>`;
const m = (label, value, unit = '', note = '') => `<div class="dm"><span class="lbl">${label}</span><span class="num">${value}${unit ? `<small>${unit}</small>` : ''}${note}</span></div>`;

/* ---------- illustrations ---------- */
function arrowHead(x, y, ang, size, cls) { // ang: direction of travel (radians, svg coords)
  const a1 = ang + Math.PI * 0.82, a2 = ang - Math.PI * 0.82;
  return `<path class="${cls}" d="M${x},${y} L${x + Math.cos(a1) * size},${y + Math.sin(a1) * size} L${x + Math.cos(a2) * size},${y + Math.sin(a2) * size} Z"/>`;
}

// Top-down at impact: target line, club path, face, and the start/curve of the ball.
function clubSvg(k) {
  const E = 3, cx = 110, cy = 72;
  const p = clamp(k.path * E, -40, 40) * DEG, f = clamp(k.face * E, -40, 40) * DEG, s = clamp(k.dir * E, -35, 35) * DEG;
  const px0 = cx - Math.sin(p) * 58, py0 = cy + Math.cos(p) * 58, px1 = cx + Math.sin(p) * 44, py1 = cy - Math.cos(p) * 44;
  const fcx = cx - Math.sin(f) * 8, fcy = cy + Math.cos(f) * 8, fdx = Math.cos(f) * 22, fdy = Math.sin(f) * 22;
  const sx = cx + Math.sin(s) * 40, sy = cy - Math.cos(s) * 40;
  const bend = clamp(k.axis * E * 0.9, -40, 40);
  const ex = cx + Math.sin(s) * 66 + bend, ey = cy - Math.cos(s) * 62;
  const headAng = Math.atan2(ey - sy, ex - sx);
  return `<svg viewBox="0 0 220 112" class="dIll" role="img" aria-label="Club path and face from above">
    <line class="tgt" x1="${cx}" y1="108" x2="${cx}" y2="4"/>
    <text class="cap" x="${cx + 4}" y="12">target</text>
    <path class="ballLine" d="M${cx},${cy} Q${sx},${sy} ${ex},${ey}"/>
    ${arrowHead(ex, ey, headAng, 6, 'ballHead')}
    <line class="path" x1="${px0}" y1="${py0}" x2="${px1}" y2="${py1}"/>
    ${arrowHead(px1, py1, Math.atan2(py1 - py0, px1 - px0), 8, 'pathHead')}
    <line class="face" x1="${fcx - fdx}" y1="${fcy - fdy}" x2="${fcx + fdx}" y2="${fcy + fdy}"/>
    <circle class="ball" cx="${cx}" cy="${cy}" r="5"/>
    <g class="legend"><circle class="lgPath" cx="10" cy="100" r="3.5"/><text x="17" y="103">Path</text>
      <circle class="lgFace" cx="52" cy="100" r="3.5"/><text x="59" y="103">Face</text>
      <circle class="lgBall" cx="94" cy="100" r="3.5"/><text x="101" y="103">Ball</text></g>
    <text class="cap" x="216" y="108" text-anchor="end">angles ×3</text>
  </svg>`;
}

// Side view: attack angle into the ball, launch line, and the real trajectory shape with apex.
function launchSvg(k, rec) {
  const gx = 22, gy = 92, W = 192;
  const a = clamp(k.aoa * 2, -40, 40) * DEG, v = clamp(k.launch, 0, 60) * DEG;
  const tx = Math.cos(a), ty = -Math.sin(a);                  // club travel (svg y is down)
  const pts = rec.r.pts, li = Math.max(1, pts.findIndex(q => q.phase !== 'flight'));
  const flight = pts.slice(0, li + 1);
  const dist = Math.max(1, -flight[flight.length - 1].p[2]), apex = Math.max(0.5, ...flight.map(q => q.p[1]));
  const sx = (W - 8) / dist, sy = Math.min(70 / apex, sx * 4);
  let d = '';
  flight.forEach((q, i) => {
    if (i % 4 && i !== flight.length - 1) return;
    d += (d ? ' L' : 'M') + (gx + -q.p[2] * sx).toFixed(1) + ',' + (gy - q.p[1] * sy).toFixed(1);
  });
  const top = flight.reduce((b, q) => (q.p[1] > b.p[1] ? q : b), flight[0]);
  const apexX = gx + -top.p[2] * sx, apexY = gy - top.p[1] * sy;
  const landX = gx + dist * sx;
  return `<svg viewBox="0 0 220 112" class="dIll" role="img" aria-label="Launch and trajectory from the side">
    <line class="ground" x1="4" y1="${gy + 3.5}" x2="216" y2="${gy + 3.5}"/>
    <path class="traj" d="${d}"/>
    <line class="launchLine" x1="${gx}" y1="${gy}" x2="${gx + Math.cos(v) * 54}" y2="${gy - Math.sin(v) * 54}"/>
    <line class="path" x1="${gx - tx * 26}" y1="${gy - ty * 26}" x2="${gx - tx * 6}" y2="${gy - ty * 6}"/>
    ${arrowHead(gx - tx * 5, gy - ty * 5, Math.atan2(ty, tx), 6, 'pathHead')}
    <circle class="ball" cx="${gx}" cy="${gy}" r="3.5"/>
    <circle class="apexDot" cx="${apexX}" cy="${apexY}" r="3"/>
    <text class="val" x="${apexX}" y="${Math.max(10, apexY - 7)}" text-anchor="middle">${Math.round(k.apexFt)} ft</text>
    <text class="val" x="${Math.min(212, landX)}" y="${gy - 6}" text-anchor="end">${Math.round(k.descent)}°</text>
    <text class="cap" x="${gx + 8}" y="${gy - 4}">${fmt(k.launch)}°</text>
  </svg>`;
}

// Spin: the ball seen from behind with its tilted axis, plus backspin/sidespin as components.
function spinSvg(k) {
  const cx = 62, cy = 56, R = 34, t = clamp(k.axis * 1.5, -50, 50);
  const ox = 150, oy = 92, top = 74;
  const sc = top / Math.max(1500, Math.abs(k.back), Math.abs(k.side) * 1.4);
  const bx = 0, by = -k.back * sc, sxv = k.side * sc;
  const dimples = [];
  for (let i = 0; i < 26; i++) { const a = i * 2.39996, rr = R * 0.86 * Math.sqrt((i + 0.5) / 26); dimples.push(`<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * rr).toFixed(1)}" r="2.2"/>`); }
  return `<svg viewBox="0 0 220 112" class="dIll" role="img" aria-label="Spin axis and spin components">
    <circle class="ballBig" cx="${cx}" cy="${cy}" r="${R}"/>
    <g class="dimples">${dimples.join('')}</g>
    <g transform="rotate(${t.toFixed(1)} ${cx} ${cy})">
      <line class="axis" x1="${cx}" y1="${cy - R - 12}" x2="${cx}" y2="${cy + R + 12}"/>
      <ellipse class="spinRing" cx="${cx}" cy="${cy}" rx="${R + 6}" ry="9"/>
      ${arrowHead(cx + R + 6, cy + 1, Math.PI / 2, 6, 'ringHead')}
    </g>
    <line class="ground" x1="${ox - 34}" y1="${oy}" x2="${ox + 60}" y2="${oy}"/>
    <line class="comp" x1="${ox}" y1="${oy}" x2="${ox + bx}" y2="${oy + by}"/>
    <line class="comp side" x1="${ox}" y1="${oy}" x2="${ox + sxv}" y2="${oy}"/>
    <line class="axis" x1="${ox}" y1="${oy}" x2="${ox + sxv}" y2="${oy + by}"/>
    <text class="cap" x="${ox + 4}" y="${oy + by + 10}">back</text>
    <text class="cap" x="${ox + sxv + (k.side >= 0 ? 3 : -3)}" y="${oy - 4}" text-anchor="${k.side >= 0 ? 'start' : 'end'}">side</text>
  </svg>`;
}

export function renderShotDetail(rec, clubName, clubId) {
  const k = shotMetrics(rec, clubId);
  const e = k.est ? '<i class="estMark" title="Estimated from ball data">≈</i>' : '';
  const clubNote = k.est ? '<p class="note">≈ estimated from ball data: no club data came with this shot.</p>' : '';
  return `
    <div class="dHead">
      <div class="dBig"><span class="num">${Math.round(k.carry)}</span><small>yd carry</small></div>
      <div class="dBig"><span class="num">${Math.round(k.total)}</span><small>yd total</small></div>
      <div class="dSmall">${m('Roll', Math.round(k.roll), 'yd')}${m('Offline', lr(k.totalOff))}</div>
      <div class="dShape"><b>${k.shape}</b><span>${clubName} · ${k.source}</span></div>
    </div>
    <div class="dGrid">
      <section class="dCard"><h3>Club</h3>${clubSvg(k)}
        <div class="dMetrics">
          ${m('Club speed', e + fmt(k.clubSpeed), 'mph')}${m('Smash', e + k.smash.toFixed(2))}
          ${m('Club path', e + side(k.path, 'in-out', 'out-in'))}${m('Face angle', e + side(k.face, 'open', 'closed'))}
          ${m('Face to path', e + side(k.ftp, 'open', 'closed'))}${m('Attack', e + side(k.aoa, 'up', 'down'))}
        </div>${clubNote}
      </section>
      <section class="dCard"><h3>Launch</h3>${launchSvg(k, rec)}
        <div class="dMetrics">
          ${m('Ball speed', fmt(k.ballSpeed), 'mph')}${m('Launch', fmt(k.launch), '°')}
          ${m('Launch dir', side(k.dir, 'R', 'L'))}${m('Apex', Math.round(k.apexFt), 'ft')}
          ${m('Descent', fmt(k.descent, 0), '°')}${m('Hang time', fmt(k.hang), 's')}
        </div>
      </section>
      <section class="dCard"><h3>Spin</h3>${spinSvg(k)}
        <div class="dMetrics">
          ${m('Total spin', Math.round(k.spin).toLocaleString(), 'rpm')}${m('Spin axis', side(k.axis, 'R', 'L'))}
          ${m('Backspin', Math.round(k.back).toLocaleString(), 'rpm')}${m('Sidespin', lr(k.side, ''), 'rpm')}
          ${m('Carry off', lr(k.carryOff), 'yd')}${m('Curve', lr(k.carryOff - Math.tan(k.dir * DEG) * k.carry), 'yd')}
        </div>
      </section>
    </div>`;
}
