# tools/labyrinth: The Labyrinth's plan tools

The Labyrinth is a maze the size of a town: colossal overgrown walls 10-60 m high, low evening sun, the tower in the
central court at the 5th, doors that change on two holes each round. The design is `claude/labyrinth-layout.md` in
the project (approved 15 November 2026); the job is `claude/brief-labyrinth.md`; the running record is
`claude/status-labyrinth.md`. Nothing is in the game yet.

## Round 0: the view, the walls and the doors (15 November 2026)

Checks before the plan book. World frame: X east, Z south (the layout doc's (x, y north) is `[x, -y]`), metres.

- `geo.mjs`: geometry helpers (a copy of `tools/eldergrove/geo.mjs`).
- `maze.mjs`: the maze round the first three holes as wall prisms (footprint, bottom, top, an optional lean, kind,
  soak), the floor (`floorAt`: gently heaved, level in the corridors, the 1st's forecourt banked as a half-pipe), the
  mown ground for the views (`paintAt`, schematic), the tower, and a placeholder fill of the rest of the maze so the
  skyline reads (sightlines to the tower kept open). `walls(variant, door)`: variant `plain` (A, the layout's
  numbers), `dressed` (B: heights varied, broken tops, notches), `low` (C: the 2nd's side walls 30-36 m) or `broken`
  (D: B with two stretches of the 2nd's left wall fallen to 14 m); `door` 'L' or 'R' for the Elbow. The Elbow: leg 1's
  side walls stand 80 m, then drop to 9-14 m to the corner; each leg 2's inside wall is low for its first 50 m; a
  court of rough behind each; gate towers at both mouths, the open door slid into its posts, the shut one a slab.
- `node views.mjs [name...]`: renders through the game's own camera (`src/stance.js`: 3.2 m behind, 1.55 m up, 50°
  tall, 844×390) in headless Chrome with three.js: the walls lit by the sun (WSW, 10° up) with real shadows, lifted
  shade, ivy, the floor's paint, flags. About 2 s a view. `out/views/<name>.png` and `notes.json` (callouts
  projected through the same camera). Needs `npm i --no-save playwright` and Chrome (`CHROME=/usr/bin/google-chrome`).
- `node walls.mjs [corridor|bank|elbow|gate]`: flown with `src/physics.js` at 1,200 ft: (1) drives into the 2nd's
  side walls for soak 0, 0.45 and 0.8 against the open; (2) approaches hit long into the 2nd's end wall, leaning or
  upright, with and without a kick bank; (3) the Elbow's bold line from four tee spots over round 0's maze (every
  prism solid); (4) second shots through the 1st's gate under its 40 m lintel. `out/walls.json`, about 2 minutes.
- `node dump.mjs`: the walls as JSON for the plans (`out/maze.json`).
- `python3 figs.py`: the figures (`out/figs/`).
- `node book.mjs`: the proposal, `out/labyrinth-round0.pdf` (10 white A4 landscape pages).

What it found:

- From a tee inside a 62 m corridor the camera sees two walls and a slot of sky whatever their height: a 60 m wall
  fills the top of the frame for 170 m, a 36 m wall for 90 m. What reads is the lit end wall, the gold band the low
  sun puts on the left wall, and a break in a wall (the tower over a fallen stretch).
- A wall alone doesn't bank a ball onto a green: whatever it hits, it drops at the foot. A mown bank at the foot
  steeper than 22% (fairway's rolling resistance) does: 5 m over the 17 m from the green's back edge to the wall
  (29%) put every approach hit 24-80 yd long back on the green; the 12° lean keeps a ball hit low off the corner.
- Wall soak: at 0.45 (bare stone) 73% of drives that reach a 2nd's side wall drop at its foot and lose 29 yd against
  the open, 8% come back to the fairway; at 0.8 (ivy) 88%, 36 yd, 4%. Neither a bumper lane nor a gutter.
- The layout's heap of fallen wall at the Elbow's corner didn't read from the tee, and open door leaves swung back
  along leg 2 stood 40 m tall in the bold line: hence the low walls, the court and the sliding doors. The bold carry
  from round 0's back tee is 212 yd (the layout said 225).
- The 1st's lintel at 40 m: the highest normal second shot passes the gate at about 28 m.
