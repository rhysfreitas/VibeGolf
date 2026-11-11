// Outline checks (docs/COURSE-DESIGN.md "Greens, fairways and bunkers"), measured from the hole's own surfaces on
// a 1 m grid: the green's shape (how close to a plain oval), size, depth against width and angle to the approach;
// the fairway's width along the line and how much it changes; every bunker's size, whether it touches the
// fairway and its job; the fairway width where each tee set's drive lands; and, for the course, green styles,
// the spread of the par 3s and how the greens' angles balance. analyse.mjs prints these with each hole.
import { along, lineLen } from './page.mjs';

const YD = 0.9144;
// distance s along a polyline of the point nearest (x, z), and how far off it is
export function project(L, x, z) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (l * l))), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
    if (d < best.d) best = { d, s: acc + t * l };
    acc += l;
  }
  return best;
}
// cells of one surface connected to a start cell (flood fill on a 1 m grid round the start)
function blob(sf, x0, z0, want, R) {
  const seen = new Set(['0,0']), out = [], st = [[0, 0]];
  if (!want(sf(x0, z0))) return out;
  while (st.length) {
    const [i, j] = st.pop(); out.push([x0 + i, z0 + j]);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj, k = `${a},${b}`; if (Math.abs(a) > R || Math.abs(b) > R || seen.has(k)) continue;
      seen.add(k); if (want(sf(x0 + a, z0 + b))) st.push([a, b]);
    }
  }
  return out;
}
// shape of a set of cells: area, moment ellipse (axes, direction) and how much of the shape it covers
function shapeOf(cells) {
  const n = cells.length; let mx = 0, mz = 0; for (const [x, z] of cells) { mx += x; mz += z; } mx /= n; mz /= n;
  let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of cells) { const a = x - mx, b = z - mz; sxx += a * a; szz += b * b; sxz += a * b; }
  sxx /= n; szz /= n; sxz /= n;
  const tr = sxx + szz, det = sxx * szz - sxz * sxz, l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det)), l2 = tr - l1;
  const ang = Math.atan2(l1 - sxx, sxz || 1e-9), A = 2 * Math.sqrt(l1), B = 2 * Math.sqrt(Math.max(l2, 1e-6)); // semi-axes
  const ca = Math.cos(ang), sa = Math.sin(ang), inE = (x, z) => { const a = (x - mx) * ca + (z - mz) * sa, b = -(x - mx) * sa + (z - mz) * ca; return (a / A) ** 2 + (b / B) ** 2 <= 1; };
  const set = new Set(cells.map(([x, z]) => `${Math.round(x)},${Math.round(z)}`));
  let both = 0, onlyE = 0;
  for (let x = Math.floor(mx - A - 2); x <= mx + A + 2; x++) for (let z = Math.floor(mz - A - 2); z <= mz + A + 2; z++) {
    const e = inE(x, z), g = set.has(`${x},${z}`); if (e && g) both++; else if (e) onlyE++;
  }
  return { area: n, cx: mx, cz: mz, axis: [ca, sa], aspect: A / B, oval: both / (n + onlyE) };
}
const SHORT = s => s === 'fairway';

export function holeOutlines(h, T, COURSE, L) {
  const sf = (x, z) => T.surfaceAt(x, z), len = lineLen(L), flags = [];
  const pin = h.green.pins?.[0] || h.pin;
  // green
  const gc = blob((x, z) => sf(x, z), Math.round(pin[0]), Math.round(pin[1]), s => s === 'green', 60);
  const G = shapeOf(gc);
  const from = L.length > 2 ? L.at(-2) : L[0], ad = Math.hypot(pin[0] - from[0], pin[1] - from[1]), ax = (pin[0] - from[0]) / ad, az = (pin[1] - from[1]) / ad;
  const dot = G.axis[0] * ax + G.axis[1] * az, cross = G.axis[0] * az - G.axis[1] * ax;
  let angle = Math.acos(Math.min(1, Math.abs(dot))) * 180 / Math.PI; // long axis off the approach, 0 = along it
  const turn = -Math.sign(dot * cross) || 0; // which way the back of the green turns: + = to the right (x east, z south)
  let depth = 0, width = 0, dmin = 1e9, dmax = -1e9, wmin = 1e9, wmax = -1e9;
  for (const [x, z] of gc) { const a = (x - G.cx) * ax + (z - G.cz) * az, b = -(x - G.cx) * az + (z - G.cz) * ax; dmin = Math.min(dmin, a); dmax = Math.max(dmax, a); wmin = Math.min(wmin, b); wmax = Math.max(wmax, b); }
  depth = dmax - dmin + 1; width = wmax - wmin + 1;
  const green = { area: G.area, depth: Math.round(depth), width: Math.round(width), oval: +G.oval.toFixed(2), angle: Math.round(angle), turn: G.aspect >= 1.15 && angle >= 15 && angle <= 75 ? (turn > 0 ? 'R' : 'L') : '-', style: h.green.style || 'tilt' };
  if (G.oval >= 0.9) flags.push('green is a plain oval');
  if (depth < width * 0.95 && angle < 30) flags.push(`green wider than deep (${green.width} × ${green.depth})`);
  // fairway width under the line every 5 m from 100 m out to 25 m short of the green
  const widths = [];
  for (let s = 100; s < len - 25; s += 5) {
    const [px, pz, ux, uz] = along(L, s), nx = -uz, nz = ux;
    let k0 = null;
    for (let o = 0; o <= 70 && k0 === null; o++) for (const sg of o ? [1, -1] : [1]) if (k0 === null && SHORT(sf(px + nx * o * sg, pz + nz * o * sg))) k0 = o * sg;
    if (k0 === null) { widths.push([s, 0]); continue; }
    let a = k0, b = k0; while (a > -90 && SHORT(sf(px + nx * (a - 1), pz + nz * (a - 1)))) a--; while (b < 90 && SHORT(sf(px + nx * (b + 1), pz + nz * (b + 1)))) b++;
    widths.push([s, b - a + 1]);
  }
  const at = s => { const r = widths.find(w => w[0] >= s - 2.5); return r ? r[1] : null; };
  const live = widths.filter(w => w[1] > 0 && w[0] < len - 40).map(w => w[1]);
  const live15 = live.filter(w => w >= 15), fairway = h.par > 3 && live15.length ? { min: Math.min(...live15), max: Math.max(...live), change: +(Math.max(...live15) / Math.min(...live15)).toFixed(2) } : null;
  if (fairway && fairway.change < 1.3) flags.push(`fairway width barely changes (${fairway.min}–${fairway.max} m)`);
  // landing width for each tee set: the drive (minDrive, or 150 yd) toward the first fairway target it can reach
  // (as auto-aim plays it), else down the line; the width is the fairway run across the shot there
  const land = {}, tg = (h.targets || []).filter(t => !t.pin);
  const across = (px, pz, ux, uz) => { const nx = -uz, nz = ux; let k0 = null;
    for (let o = 0; o <= 30 && k0 === null; o++) for (const sg of o ? [1, -1] : [1]) if (k0 === null && SHORT(sf(px + nx * o * sg, pz + nz * o * sg))) k0 = o * sg;
    if (k0 === null) return 0; let a = k0, b = k0; while (a > -90 && SHORT(sf(px + nx * (a - 1), pz + nz * (a - 1)))) a--; while (b < 90 && SHORT(sf(px + nx * (b + 1), pz + nz * (b + 1)))) b++; return b - a + 1; };
  if (h.par > 3) for (const t of COURSE.teeSets) {
    const p = h.tees[t.id]; if (!p) continue;
    const d = (t.minDrive || 150) * YD * 0.95, aim = tg.find(q => Math.hypot(q.x - p[0], q.z - p[1]) > d * 0.6);
    let w, s;
    if (aim) { const l = Math.hypot(aim.x - p[0], aim.z - p[1]), ux = (aim.x - p[0]) / l, uz = (aim.z - p[1]) / l, k = Math.min(d, l), x = p[0] + ux * k, z = p[1] + uz * k; w = across(x, z, ux, uz); s = project(L, x, z).s; }
    else { s = project(L, p[0], p[1]).s + d; w = at(s); }
    land[t.id] = { s: Math.round(s), w, at: aim?.name };
    if (w !== null && w < 40) flags.push(`${t.name || t.id} drive lands on ${w} m of fairway (${Math.round(s)} m${aim ? ', toward ' + aim.name : ''})`);
  }
  // bunkers: sand blobs within 90 m of the line
  const bunkers = [], seenSand = new Set();
  const xs = L.map(p => p[0]), zs = L.map(p => p[1]);
  for (let x = Math.min(...xs) - 70; x <= Math.max(...xs) + 70; x += 2) for (let z = Math.min(...zs) - 70; z <= Math.max(...zs) + 70; z += 2) {
    if (seenSand.has(`${Math.round(x)},${Math.round(z)}`) || sf(x, z) !== 'sand') continue;
    const cells = blob(sf, x, z, s => s === 'sand', 60); for (const [a, b] of cells) seenSand.add(`${Math.round(a)},${Math.round(b)}`);
    if (cells.length < 6) continue;
    let bx = 0, bz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [a, b] of cells) { bx += a; bz += b; x0 = Math.min(x0, a); x1 = Math.max(x1, a); z0 = Math.min(z0, b); z1 = Math.max(z1, b); }
    bx /= cells.length; bz /= cells.length;
    const span = Math.max(x1 - x0, z1 - z0) + 1, toPin = Math.hypot(bx - pin[0], bz - pin[1]);
    let touches = false; for (const [a, b] of cells) { for (const [da, db] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (sf(a + da, b + db) === 'fairway') { touches = true; break; } if (touches) break; }
    const pr = project(L, bx, bz), gs = toPin < Math.max(G.area ** 0.5, 20) + 8;
    const job = gs ? 'greenside' : toPin < 100 ? 'approach' : 'fairway';
    bunkers.push({ span: Math.round(span), s: Math.round(pr.s), off: Math.round(pr.d), toPin: Math.round(toPin), touches, job });
    if (job === 'fairway' && span < 20) flags.push(`fairway bunker of ${Math.round(span)} m at ${Math.round(pr.s)} m`);
    if (!gs && !touches) flags.push(`bunker at ${Math.round(pr.s)} m doesn't touch the fairway`);
  }
  // side slope and green contour (docs/COURSE-DESIGN.md "Side slope and green contour"): the fairway's lean
  // across the shot round each tee set's landing and each fairway target, and the green's typical slope, shape
  // beyond its plane, the pin, pin areas (discs 6 m across at 3% or less, 3 m inside the edge, 8 m apart)
  const gy = (x, z) => T.groundAt(x, z), D = 0.75;
  const slope = (x, z) => { const a = gy(x + D, z), b = gy(x - D, z), c = gy(x, z + D), d = gy(x, z - D); return [a, b, c, d].some(v => v == null) ? 99 : Math.hypot(a - b, c - d) / (2 * D) * 100; };
  const leanAt = (x, z, ux, uz) => { const nx = -uz, nz = ux, v = [];
    for (let k = -30; k <= 30; k += 5) { const px = x + ux * k, pz = z + uz * k; if (sf(px, pz) !== 'fairway') continue;
      const l = gy(px - nx * 12, pz - nz * 12), r = gy(px + nx * 12, pz + nz * 12), sl = sf(px - nx * 12, pz - nz * 12), sr = sf(px + nx * 12, pz + nz * 12);
      if (l == null || r == null || ['water', 'void'].includes(sl) || ['water', 'void'].includes(sr)) continue; v.push((l - r) / 24 * 100); }
    return v.length >= 3 ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  const leans = [];
  if (h.par > 3) {
    let prev = h.tees[COURSE.teeSets[0].id];
    for (const t of tg) { const l = Math.hypot(t.x - prev[0], t.z - prev[1]) || 1, v = leanAt(t.x, t.z, (t.x - prev[0]) / l, (t.z - prev[1]) / l); if (v != null) leans.push({ at: t.name, lean: v }); prev = [t.x, t.z]; }
    if (!leans.length) { const s0 = Math.min(230, len * 0.6), [x, z, ux, uz] = along(L, s0), v = leanAt(x, z, ux, uz); if (v != null) leans.push({ at: Math.round(s0) + ' m', lean: v }); }
  }
  const gset = new Set(gc.map(([x, z]) => `${x},${z}`)), cells = gc.map(([x, z]) => ({ x, z, y: gy(x, z), s: slope(x, z) })).filter(c => c.y != null);
  const inside = (x, z, r) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r && !gset.has(`${x + dx},${z + dz}`)) return false; return true; };
  const byKey = new Map(cells.map(c => [`${c.x},${c.z}`, c]));
  let mx = 0, mz = 0, my = 0; for (const c of cells) { mx += c.x; mz += c.z; my += c.y; } mx /= cells.length; mz /= cells.length; my /= cells.length;
  let cxx = 0, czz = 0, cxz = 0, cxy = 0, czy = 0; for (const c of cells) { const a = c.x - mx, b = c.z - mz, d = c.y - my; cxx += a * a; czz += b * b; cxz += a * b; cxy += a * d; czy += b * d; }
  const det = cxx * czz - cxz * cxz, pa = (cxy * czz - czy * cxz) / det, pc = (czy * cxx - cxy * cxz) / det;
  let rlo = Infinity, rhi = -Infinity; for (const c of cells) { const r = c.y - (my + pa * (c.x - mx) + pc * (c.z - mz)); rlo = Math.min(rlo, r); rhi = Math.max(rhi, r); }
  const cand = []; for (const c of cells) { if (!inside(c.x, c.z, 6)) continue; let ok = true, worst = 0; for (let dx = -3; dx <= 3 && ok; dx++) for (let dz = -3; dz <= 3; dz++) { if (dx * dx + dz * dz > 9) continue; const q = byKey.get(`${c.x + dx},${c.z + dz}`); if (!q || q.s > 3) { ok = false; break; } worst = Math.max(worst, q.s); } if (ok) cand.push({ ...c, worst }); }
  cand.sort((a, b) => a.worst - b.worst); const areas = []; for (const c of cand) if (areas.every(q => Math.hypot(c.x - q.x, c.z - q.z) >= 8)) areas.push(c);
  const sl = cells.map(c => c.s).sort((a, b) => a - b);
  const contour = { median: +sl[Math.floor(sl.length / 2)].toFixed(1), relief: +(rhi - rlo).toFixed(2), pin: +slope(pin[0], pin[1]).toFixed(1), areas: areas.length, steep: Math.round(cells.filter(c => c.s > 3).length / cells.length * 100) };
  contour.feature = contour.relief >= 0.25;
  if (contour.median < 1) flags.push(`green nearly flat (typical slope ${contour.median}%)`);
  if (contour.median > 3) flags.push(`green steep (typical slope ${contour.median}%)`);
  if (contour.areas < 2) flags.push(`green has ${contour.areas} pin area${contour.areas === 1 ? '' : 's'}`);
  return { green, fairway, widths, land, bunkers, leans, contour, flags, dy: (T.groundAt(pin[0], pin[1]) ?? 0) - (T.groundAt(...h.tees[COURSE.teeSets[0].id]) ?? 0) };
}

// the course as a whole: styles, par 3s, how the angled greens balance
export function courseOutlines(HOLES, rows, COURSE) {
  const flags = [], styles = {};
  for (const r of rows) styles[r.green.style] = (styles[r.green.style] || 0) + 1;
  for (const [k, v] of Object.entries(styles)) if (v > 3) flags.push(`${v} greens of style ${k}`);
  // par 3s, plays-like (roughly: thinner air carries about 1.7% further per 1,000 ft, and each metre of climb or
  // drop to the green is about a yard; the game's own figure comes from the flight model)
  const p3 = HOLES.map((h, i) => [h, i, rows[i]]).filter(([h]) => h.par === 3).map(([h, i, r]) => ({ n: i + 1, yd: h.yards[COURSE.teeSets[0].id], dy: r.dy,
    plays: Math.round(h.yards[COURSE.teeSets[0].id] * (1 - 0.017 * (COURSE.altFt || 0) / 1000) + r.dy * 1.04), heading: h.heading }));
  for (let a = 0; a < p3.length; a++) for (let b = a + 1; b < p3.length; b++) if (Math.abs(p3[a].plays - p3[b].plays) < 25) flags.push(`par 3s ${p3[a].n} and ${p3[b].n} play about ${Math.abs(p3[a].plays - p3[b].plays)} yd apart (${p3[a].plays} and ${p3[b].plays})`);
  const L = rows.filter(r => r.green.turn === 'L').length, R = rows.filter(r => r.green.turn === 'R').length;
  if (L < 2 || R < 2) flags.push(`angled greens: ${L} left, ${R} right (want 2 or 3 each)`);
  const ovals = rows.filter(r => r.green.oval >= 0.9).length;
  // side slope and green contour across the nine
  const big = HOLES.map((h, i) => [h, rows[i]]).filter(([h]) => h.par > 3), top = r => r.leans.reduce((a, b) => Math.abs(b.lean) > Math.abs(a) ? b.lean : a, 0);
  const lean2 = big.filter(([, r]) => Math.abs(top(r)) >= 2).length, strong = big.filter(([, r]) => Math.abs(top(r)) >= 5.5).length;
  const features = rows.filter(r => r.contour.feature).length;
  if (lean2 * 2 <= big.length) flags.push(`only ${lean2} of ${big.length} par 4/5 landing areas lean 2% or more`);
  if (strong < 1 || strong > 2) flags.push(`${strong} strong sidehill landing areas (5.5%+; want one or two)`);
  if (features < 5) flags.push(`only ${features} greens with a feature (0.25 m+ beyond their plane; want most)`);
  return { styles, p3, angled: { L, R }, ovals, lean: { lean2, strong, of: big.length }, features, flags };
}
