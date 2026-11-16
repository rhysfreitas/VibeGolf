# tools/labyrinth: The Labyrinth's plan tools

The Labyrinth is a maze the size of a town: colossal overgrown walls 10-60 m high, low evening sun, the tower in the
central court at the 5th, doors that change on two holes each round. The design is `claude/labyrinth-layout.md` in
the project (approved 15 November 2026); the job is `claude/brief-labyrinth.md`; the running record is
`claude/status-labyrinth.md`. Nothing is in the game yet: plan book round 1 is drawn (16 November 2026).

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
- `node book0.mjs`: the proposal, `out/labyrinth-round0.pdf` (10 white A4 landscape pages).

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

## Round 1: the plan book (16 November 2026)

Rhys's picks from round 0 (the 2nd's walls broken, soak 45% on bare stone and 80% in ivy, the Elbow's shut leg a
stroke and a drop, the doors rolled each round), then the whole course drawn. World frame as round 0. Run in order:

- `world.mjs`: the whole maze as one world. `LINES` (the approved lines; the Elbow's and the Two Doors' second
  versions as `'3B'`, `'7B'`), `groundXY(x, y)` / `floorAt(X, Z)` (the floor with each hole's landforms: the 1st's
  dished forecourt, the corridor's lean and kick bank, the Elbow's leans and daises, the cistern and its crowned
  causeway and stones, the tower court's moat and plinth, the garden's terrace, the 7th's forecourt and alcoves, the
  8th's tee wall, stair blocks and sunken court, the 9th's wall top and the breach's steps), `worldSurface` (water,
  rubble), `walls()` (every wall as a prism: footprint, bottom, top, `kind`, `soak`, an optional `shift` for a lean;
  `ground: true` for the wall tops that are played on; `only` + `hole` for a door that is shut in one version) and
  `wallsFor({ 3: 'A' | 'B', 7: 'A' | 'B' })`, `legAt` (a point against a leg, carried on past its ends). The rest of
  the maze is a fill of cells 110 m across, lower along the sightlines to the tower.
- `holes.mjs`: the course card, the tee sets (Tower, Rampart, Gate, Court; the Keystone tips switched off), the doors
  roll (`COURSE.rolls`), and each hole: tees as `s` / `[s, off]` along the line or `{ xy }`, fairway pieces
  (`makeFairway` from `shapes.mjs`), the green's lobes and designed `contour` (`blend` shortens the collar's blend,
  for the 2nd's bank), bunkers, plants, targets (`bold`, `second` for a second shot's), words and the hole card;
  `versions` for the other way on 3 and 7. `PLAYS` lists every play.
- `scene.mjs`: each play built over the floor (`PLAYED`; `BUILT` is version A for the shared tools): the green
  levelled to the pin then contoured, bunkers, tee pads; surfaces green, fringe, tee, fairway, sand, water, penalty
  (the Elbow's shut leg and its court), rough, the maze floor's long grass, rubble within 3 m of a standing wall
  (`wallD`, a 2 m distance grid), and the 2nd's mown bank. `PHYS` maps them to physics.js surfaces.
- `node sample.mjs [tag...]`: everything flown with `src/physics.js` against the walls (buckets of prisms, the lean
  followed, soak per kind): each tee set's drive to the furthest safe target it reaches (a club down where it's
  shorter), the fairway where its minimum drive comes down, 24 amateur drives, the bold line from each tee and 24 with
  a miss, the par 3s (plays-like, then 12 with a miss), the 2nd's bank shot, the 9th's second shots; pins, tees off
  fairway, nothing overhead under 45 m, tips spots, penalty ground on one side. `out/checks.txt`, `out/sample.json`,
  `out/grid/h<tag>.bin`. About 3.5 minutes; with tags (`3A 3B`) it prints just those and writes nothing.
- `node grids.mjs`: the green grids and the course map (`out/grid/`).
- `python3 plans.py`: plans (walls shaded by height, their heights written on the ones near the play), profiles,
  green diagrams and the map (`out/plan<tag>.png` ...).
- `node sketch.mjs [tag...]`: views through the game's camera from the planned course (round 0's page), tee, landing
  and green (par 3s: the Tower, Rampart and Court tees), with callouts; `out/views/r1_*.png`, `r1_notes.json`.
- `(cd ../review && node relief.mjs labyrinth && node alike.mjs labyrinth && node spread.mjs labyrinth) > out/review.txt`
- JPEG copies, then `node book.mjs`: `out/labyrinth-plan-book-r1.pdf` (white A4 landscape). `round1-notes.json`
  holds the book's "what moved" and "open" lists.
