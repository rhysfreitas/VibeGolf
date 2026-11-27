// The hole's intro flyover, pure (no Three.js): the camera's control points and where it looks, as plain
// [x, y, z] arrays in the hole's frame, for a Catmull-Rom curve in main.js.
//
// The default is one shape for every hole: up behind the tee and to the left, a high swing out to the left
// over the middle, down past the pin to the right. It doesn't know what stands round the hole, so on many
// holes it flew through cliffs, trees, buildings or a cave's roof (Rhys, 27 November 2026). Those holes carry
// a planned path in flyovers.js, made by tools/review/flyover.mjs: it voxelises everything drawn round the
// hole and keeps the path a few metres clear of all of it, as close to the default as it can.
// A planned path is keyed to the tee and the green it was planned for, so a hole whose tee or green moves
// falls back to the default until the tool is run again (tests/flyover.test.mjs flags it).

// default control points for a tee t = [x, y, z] and a pin p = [x, y, z]
export function defaultFlyover(t, p) {
  const dx = p[0] - t[0], dz = p[2] - t[2], L = Math.hypot(dx, dz) || 1, d = [dx / L, dz / L];
  const side = [-d[1], d[0]];   // to the right of the line
  const at = (o, back, sd, up) => [o[0] + d[0] * back + side[0] * sd, o[1] + up, o[2] + d[1] * back + side[1] * sd];
  const mid = [(t[0] + p[0]) / 2, (t[1] + p[1]) / 2, (t[2] + p[2]) / 2];
  return {
    pts: [at(t, -55, -20, 32), at(mid, 0, -L * 0.35, 70 + L * 0.08), at(p, 50, 35, 28)],
    looks: [[t[0] + d[0] * L * 0.45, t[1] + (p[1] - t[1]) * 0.45 - 10, t[2] + d[1] * L * 0.45], [mid[0], mid[1] - 20, mid[2]], [p[0], p[1] - 2, p[2]]],
    dur: Math.min(9, 5.5 + L / 160),
  };
}

// a planned path for this hole and tee set, if there is one and it was planned for this tee and green
// (the pin moves round the green from round to round; the green's centre is what's keyed)
export function plannedFlyover(table, courseId, holeIdx, teeId, tee, green) {
  const e = table?.[courseId]?.[holeIdx]?.[teeId];
  if (!e) return null;
  if (Math.hypot(e.tee[0] - tee[0], e.tee[1] - tee[1]) > 3 || Math.hypot(e.green[0] - green[0], e.green[1] - green[1]) > 3) return null;
  return e;
}

// the flyover to fly: the planned one, else the default
export function flyoverFor(table, courseId, holeIdx, teeId, t, p, green) {
  return plannedFlyover(table, courseId, holeIdx, teeId, [t[0], t[2]], green) || defaultFlyover(t, p);
}
