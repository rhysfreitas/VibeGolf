# Halcyon Ring: plan tools

Halcyon Ring is a course in planning (`claude/brief-halcyon-ring.md` in the project): parkland golf inside a ring
space station, a pristine garden colony. Floor windows onto space are the penalty area; the ball flies as on
Earth. Skeleton (Rhys's pick, 11 November 2026): par 35, 4 3 4 5 3 4 4 5 3, finishing with a par 3 across the
Great Window to the clubhouse.

Routing check (11 November 2026). Rhys's concept picks: R = 5 km, 900 m between the rims; the curve plays as it
looks; floor windows are glass and a penalty area (a stroke and a drop, like water); tees Zenith, Meridian, Horizon,
Nadir and the Kingfisher tips; decisions on 4 (bite off the Long Window), 7 (drivable round the spoke) and 8 (go or
lay up at the canal); classics Double Plateau 1, Eden 2, Road 3, Leven 7, Channel 8; landmarks the spoke, Earth
through the rim glass and the clubhouse, the reveal the Great Window from the 9th tee; late light with the air
handling's spinward breeze. The plan-book tools (`shapes.mjs`, `sample.mjs`, `plans.py`, `sketch.mjs`, `book.mjs`)
follow `tools/emberfell/` and `tools/lostvalley/` once he approves the routing.

| Step | What it does |
|---|---|
| `world.mjs` | The floor in ring space (`a` across, east +; `s` along, north/spinward +; plan X = a, Z = -s): the rims at a = ±450, the day/night line (`TERMINATOR`, the night side south of it), villa terraces toward each rim, the floor windows (`WINDOWS`: the Long Window on 4, the Great Window on 9), the rim glass under the 5th's balcony, the long lake along the west side, the canal with its lock and aqueduct, the spoke's A-frame foot astride the 7th, the clubhouse, the tram stop, the 8th's valley. `curveRise(s, s0)` is the curve's lift from a hole's low line. |
| `holes.mjs` | `COURSE` (tee sets, the Kingfisher tips set switched off, the course card `card`) and `HOLES`: each hole from `legs` in its own frame, `place: { at, heading }` on the floor, tee spots, the tips spot (`tips`, default 34 m behind on par 4s and 5s, 14 m on par 3s) and its hole card (`card`: story, type, form, feature and job, decision, miss map, tee view, ground). |
| `node routing.mjs` | The routing check: yardages, spacing between hole lines, walks, the curve's lift on each hole, the windows, spoke, canal and lake against the lines, the 4th's bold line and carry, the 9th's carry from each tee, and which landmarks are in each back tee's fixed view. Writes `out/routing.json`. |
| `python3 routing.py` | The routing map (`out/routing-map.png`, white page, north up). |
| `node ring-sketch.mjs` | Concept sketches of the ring through the game's fixed tee camera, for choosing the radius: across the ring (a par 4) and up the curve (a par 3 over a floor window) at R = 1.5, 3 and 5 km, and the Great Window from a tee on the floor and from one raised 14 m. Ring space is `a` across (the axis), `s` along (arc length), `h` up; the floor is a cylinder of radius R, 1 km wide, with villa terraces rising 46 m at each rim and glass rim walls 320 m tall. Writes `out/ring-*.svg` and `out/ring-sheet.png`. Seconds. |

What the sketches showed (11 November 2026):

- Seen from the floor, the ring floor at arc angle φ sits φ/2 above level, so the tee camera (19° up at most)
  sees the floor out to φ = 38°, 0.66 R along the ring. The far side overhead never shows in play.
- Across the ring the view is the same at any radius (level ground to the far rim's glass). Up the curve, the
  radius sets how wide the land looks between the rim walls: a broad valley at 1.5 km, a narrow channel at 5 km.
- A floor window is nearly edge-on from a tee on the floor (1.55 m eye height): a white sliver, no stars. To see
  down through one, the tee must stand above it (14 m up and it reads as a pool of space).
