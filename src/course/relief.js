// Penalty relief, pure. The clouds play as a red penalty area (Rule 17): one stroke, then a drop on the
// grass within about two club lengths of where the ball last left an island, no nearer the hole.
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const BAD = new Set(['void', 'water', 'sand', 'green']);

// track: the ball's ground track, [[x, z], ...] in order (flight and roll); pin: [x, z].
// Returns { x, z, edge: [x, z] } or null (then it's stroke and distance).
export function cloudDrop({ track, pin, groundAt, surfaceAt, reach = 2.2 }) {
  let last = -1;
  for (let i = 0; i < track.length; i++) if (groundAt(track[i][0], track[i][1]) !== null) last = i;
  if (last < 0) return null;
  // the edge: walk on from the last point over land toward the next one, which is over the clouds
  let E = track[last];
  if (last + 1 < track.length) {
    const A = track[last], B = track[last + 1];
    for (let k = 1; k <= 24; k++) { const t = k / 24, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]; if (groundAt(p[0], p[1]) === null) break; E = p; }
  }
  const pinD = dist(E, pin);
  // firm ground: land all round, a metre and a half out, so the ball can't roll straight back off
  const firm = (x, z) => { for (let a = 0; a < 8; a++) if (groundAt(x + Math.cos(a * 0.785) * 1.5, z + Math.sin(a * 0.785) * 1.5) === null) return false; return true; };
  for (let r = 0.5; r <= reach * 4; r += 0.5) { // two club lengths, then a little further if that's all edge
    let best = null;
    for (let a = 0; a < 36; a++) {
      const x = E[0] + Math.cos(a / 36 * Math.PI * 2) * r, z = E[1] + Math.sin(a / 36 * Math.PI * 2) * r;
      if (groundAt(x, z) === null || BAD.has(surfaceAt(x, z)) || dist([x, z], pin) < pinD || !firm(x, z)) continue;
      const d = dist([x, z], pin); if (!best || d > best.d) best = { x, z, d }; // the safest: furthest from the hole on that ring
    }
    if (best && r >= Math.min(reach, 1)) return { x: best.x, z: best.z, edge: E };
  }
  return null;
}
