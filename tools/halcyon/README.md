# Halcyon Ring: plan tools

Halcyon Ring is a course in planning (`claude/brief-halcyon-ring.md` in the project): parkland golf inside a ring
space station, a pristine garden colony. Floor windows onto space are the penalty area; the ball flies as on
Earth. Skeleton (Rhys's pick, 11 November 2026): par 35, 4 3 4 5 3 4 4 5 3, finishing with a par 3 across the
Great Window to the clubhouse.

Concept stage. The plan-book tools (`world.mjs`, `holes.mjs`, `shapes.mjs`, `sample.mjs`, `plans.py`,
`sketch.mjs`, `book.mjs`) follow `tools/emberfell/` and `tools/lostvalley/` once the concept is agreed.

| Step | What it does |
|---|---|
| `node ring-sketch.mjs` | Concept sketches of the ring through the game's fixed tee camera, for choosing the radius: across the ring (a par 4) and up the curve (a par 3 over a floor window) at R = 1.5, 3 and 5 km, and the Great Window from a tee on the floor and from one raised 14 m. Ring space is `a` across (the axis), `s` along (arc length), `h` up; the floor is a cylinder of radius R, 1 km wide, with villa terraces rising 46 m at each rim and glass rim walls 320 m tall. Writes `out/ring-*.svg` and `out/ring-sheet.png`. Seconds. |

What the sketches showed (11 November 2026):

- Seen from the floor, the ring floor at arc angle φ sits φ/2 above level, so the tee camera (19° up at most)
  sees the floor out to φ = 38°, 0.66 R along the ring. The far side overhead never shows in play.
- Across the ring the view is the same at any radius (level ground to the far rim's glass). Up the curve, the
  radius sets how wide the land looks between the rim walls: a broad valley at 1.5 km, a narrow channel at 5 km.
- A floor window is nearly edge-on from a tee on the floor (1.55 m eye height): a white sliver, no stars. To see
  down through one, the tee must stand above it (14 m up and it reads as a pool of space).
