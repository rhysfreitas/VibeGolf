# tools/emeraldbay: Emerald Bay's plan tools

Emerald Bay is an invented bay of limestone islands (the Krabi / Koh Phi Phi look): sheer karst with jungle on top,
white sand, clear turquoise water, a chain of holes wrapped once round the bay. Two logics: sand is always playable
and water is a stroke (a cliff gives the ball back onto the sand below), and the tide is high or low each round,
changing holes 3, 5 and 9. The design is `claude/emerald-bay-layout.md` in the project (approved 15 November 2026),
the job `claude/brief-emerald-bay.md` with `claude/brief-addendum-emerald-bay-look.md`, the running record
`claude/status-emerald-bay.md`. Nothing is in the game yet: plan book round 1 is out for review.

## Round 0: the tide and the surfaces (16 November 2026)

Before the plan book. World frame: X east, Z south (the layout doc's (x, y north) is `[x, -y]`, `w` in
`world.mjs`), metres, heights above low water.

- `geo.mjs`: geometry helpers (a copy of `tools/cloudrest/geo.mjs`).
- `world.mjs`: the bay as one height function `V(X, Z)` → `{ y, t, cave }` (t: sea bed, wet (intertidal) sand,
  dry sand, grass, rough, jungle, karst). The ground never moves; `TIDES` puts the sea at 0 (low) or 2.4 m (high)
  and `surfaceAt(X, Z, tide)` says what it plays as at that tide (anything below the sea is water; intertidal sand
  above it is firm wet sand). The islands are schematic superellipses with wandering coasts, beaches and karst
  towers, except the tide holes' own ground, drawn in each line's frame: the 3rd's tongue (`TONGUE`) and the rock
  its forward tee stands on (`TURTLE_ROCK`); the Sandbar's uneven section (`BAR`: 42 m of salt grass, the open-sea
  side narrow, the bay side a band of rough and dry sand, so at high water the sea is inside a medium miss on one
  side only); the 9th's tee rock, flats (south of the spit only), spit (`SPIT`: narrow past the sea stack so the
  8th keeps open water round it, wide where drives land), creek, the beach at the cave mouth, the hollow island
  (`HOLLOW`, moved west of the layout sketch so the cave sits 424-505 yd along the line) and its cave (`CAVE`, floor
  3 m, roof 43 m).
- `node dump.mjs`: the world on grids for the figures (`out/grid-*.json`: the bay every 5 m, each tide hole's box
  every 2 m).
- `node checks.mjs`: the numbers (`out/checks.json`): each tee set's carries on the 3rd at both tides, the dry
  ground either side of every tee set's landing area on the 5th and the 9th (the 9th's high-water route along the
  spit), the creek, cave and go/lay-up distances, shots flown under the cave roof, and the sand lies flown with
  `src/physics.js` (a copy of main.js `lieAdjust`).
- `python3 figs.py`: the figures (`out/figs/`): the bay at both tides, each tide hole's plan at both tides side by
  side with its profile or section.
- (`book.mjs` made the round-0 proposal, `out/emerald-bay-round0.pdf`; round 1 replaced it with the plan book.) It needed
  `npm i --no-save playwright` and Chrome (`CHROME=/usr/bin/google-chrome`).

What it found:

- The Sandbar as the layout drew it (40 m of grass, 10 m of beach each side at high water) puts the sea 33 yd from
  the line on both sides where drives land: it fails the penalty-ground Must. The uneven bar passes at both tides
  (high water: 42 yd north, 62 south; low water 72 and 92).
- The 3rd's forward tee needs a spot nearer the green: a rock beside the tongue's tip gives 87 yd of carry at high
  water (90 allowed). From the back, 98 yd onto the tongue at low water, 192 yd all carry at high.
- The 9th: in the layout's sketch the cave was at the corner, where drives land; with the hollow island further
  west the low-water hole is a drive over the flats, then go (260 yd through the cave from a 260 m drive) or lay up
  over the creek to the cave mouth (126 yd carry, 135 left). High water plays 589 yd along the spit, water on its
  left only. The go shot and the third pass 12 m or more under the roof.
- Sand lies (7 iron, tour): fairway 173, wet sand 167 (−3%, runs like fairway), dry sand as 'waste' 160 (−8%),
  bunker 139 (−20%), rock as 'desert' 149 (−14%).

## Plan book round 1 (16 November 2026)

Set up like `tools/cloudrest/` (copied and changed: the sea instead of open air, the tide as a parameter).

- `world.mjs` (round 1): the three play islands shaped round their holes. Island A (`landA`): the 1st's palm valley,
  a level floor along the line (`P1`, 10 m falling to 3) with a 1.6 m swale down it and banks rising 25 m to the
  towers either side (`twL` places a tower by a hole's line); the headland the 2nd tees off (`HEADLAND`, its lip at
  the tee). Island B (`landB`): the 4th's shelf (`P4`, 12-15 m up) leaning 8% down to the right, the land between the
  coves rising on toward the west cliffs; three coves (`COVES`, each [s, inner edge's off, along] in the 4th's frame,
  bitten out of the coast by `bites`) with a beach at each head; the 3rd green's beach shelf under the shelf's edge.
  Island C (`landC`): a jungle massif 40-60 m with lowlands cut in: the 5th's approach and green, the 6th's valley
  (`P6`: a table top, a 6.5 m face 226-248 m out under the saddle's level top) between two towers 200 m tall with the
  pinnacle in the fairway (`PINNACLE`, 30 m), the 7th's beach round its cove (`COVE7`) under the leaning cliff
  (`OVER`, `overhangAt`: a wall 92 m tall along the 7th's left whose underside leans out from 4.5 m at its foot to
  62 m at its lip, 10 m left of the line), the point the 8th tees off. The stack (`STACK`) has a rim round its back
  half and a 40 m spire on it. `lineCoord(k, X, Z)` is a point's place along hole k's line, carried on straight past
  its ends; `roofAt` is the rock overhead (the cave's roof, the overhang); `LEDGE2` the 2nd's forward tee.
- `holes.mjs`: the course card, the tee sets (Marlin, Manta, Turtle, Clownfish; Shark tips switched off),
  `COURSE.rolls` (the tide) and each hole: tees, fairway pieces (the plan tools' `e`, `lobes`, `bite`), green lobes and
  contour, bunkers, targets, words and card. A tide hole (3, 5, 9) has `versions` (`low`, `high`; `versionBy: 'tide'`):
  each with its note, targets and yards (the 9th at high tide is measured along its route on the spit, `route`).
  `pinS` cuts a line short (the 4th's pin), `teeLift` raises a pad (the 4th's back tees), `formLine` is the line
  alike.mjs reads a hook against (the 7th).
- `scene.mjs`: each hole's ground is the world's own plus its green (levelled to the pin, with its contour), bunkers
  and tee pads; `surface(x, z, tide)` and `worldAt(X, Z, tide)`: below the sea is water, intertidal sand above it
  wet sand, beaches dry sand, then rough, jungle and rock. `built(k, tide)` is a hole read through `worldAt` in its own
  frame (`playGround` gives the water's top for the physics); `BUILT` is each at low tide, for the review tools.
  `PHYS`: fairway, fringe and tee 'fairway', jungle 'rough', rock 'desert', bunkers 'sand', dry sand 'waste', wet sand
  'beach', water 'water'.
- `node sample.mjs` (about 90 s): a page per hole, two for each tide hole (`h<id>.bin`, id `1`, `3L`, `3H`...), the
  course map at both tides, and the checks (`out/grid/checks.txt`): pins, tee pads, tips spots, landing widths,
  forced carries along the line, water within 50 m of a landing target, the par 3s' water to carry from every tee,
  greens, the fixed camera's view from every tee, the sea stack's size from the holes that see it, the cave's roof
  against the approaches, the overhang against skied drives, the 4th's coves on the straight line and its lean, the
  6th's blind second, the 3rd's tongue and the 5th's dry ground at both tides. Drives flown with `src/physics.js`
  (the sands, the soak, the roof).
- `python3 plans.py`, `node sketch.mjs` (about 6 min; `node sketch.mjs 4 9L` for some pages), `node book.mjs`:
  plans, profiles, cross sections, greens, maps, the sketch views and `out/emerald-bay-plan-book-r1.pdf`.
  `round1-notes.json` is the book's page of what moved and what is open. `node ../review/relief.mjs emeraldbay`,
  `alike.mjs`, `spread.mjs` read it (`PLANNED`).

## The blockout (16 November 2026)

Rhys on plan book round 1 and the 4th's markup: "build it". `node emit.mjs` (about a minute) writes
`src/course/emeraldbay.js` from the plan data; don't hand-edit the module.

- Each hole's `field` is sampled every 2 m from `worldAt(X, Z, 'low')`: heights (the sea bed is the real ground, no
  bed cut under the water), engine codes from `PHYS` and a paint byte `m` (0 salt grass, 1 jungle, 2 rock, 3 dry sand,
  4 wet sand, 6 bunker sand, 8 water at low tide, 10 mown). The tide is one rule in the game (terrain.js `fieldSurf`):
  ground below the round's sea is water. The emitter checks the rule against the plan book's own high tide on every
  cell and prints the misses (none).
- Greens and bunkers are outlines over the field; the sea cave's roof (along the 9th's line) and the overhang (along
  the 7th's) are slabs of rock 30 m thick at the underside's lowest point under each (`slabs`), the beach shack and
  the stilt houses soaking boxes. A tide hole carries `versionBy: 'tide'` and `versions` (`low`, `high`: note,
  targets, yards, tips yards); its plain targets and yards are the low tide's.
- `COURSE.rolls` is the tide (`src/course/versions.js` applies it); `COURSE.bay` is the bay once (a 10 m map over the
  course and a 40 m one out to 4 km, with the paint; the sites, the play lines, the roof slabs, the landmarks).
- `src/course/bay-world.js` draws it (the art pass comes later). `tests/emeraldbay.test.mjs` checks it.
- The review tools read the course at low tide; `ROLLS=tide=high node ../review/design.mjs emeraldbay` (or
  quickplay) at high.

## The island study (17 November 2026)

Rhys on the blockout: the islands didn't look or feel like his photos (Maya Bay from the beach and the air, Koh
Hong's streaked wall, the longtail between sheer walls, Krabi's islets joined by a sandbar), because round 1 cut
valleys through them. His picks: the big islands stay whole; most of the golf at their foot (shelves with a side lean,
like the 4th and 7th); up top only a par 3 dropping down; through the rock only the sea cave and one natural gap; the
Sandbar kept; fresh layout welcome; an island study first. The photos are in `out/refs/` (not in git).

`study/` builds one whole island in the game to agree the look before any hole is re-laid:
- `island.mjs`: the Massif, a horseshoe of jungle-covered karst round a cove opening south (Maya Bay), in world space:
  a ragged coast from superellipses (`coast`), sheer walls 60-180 m from the sea, a steep jungle climb to a lumpy
  body 150-200 m up, rounded summits on it (`PEAKS`); a white beach at the cove's head and smaller ones (`BEACHES`);
  the Shelf along the east arm's outer side (a bench 13-16 m up, about 70 m wide, leaning 6% to the sea, measured
  in from the east coast: `eastCoast`); a ledge 70 m up the cove's west wall, open to the cove; a gap 30 m wide
  between the west arm and a tower (`GAP`); a sandbar dry along its crest at low tide out to a domed islet (`BAR`);
  far islands; three study holes (the Shelf, the Drop, the Sandbar).
- `node map.mjs && python3 map.py`: a top-down map (`out/study/map.png`).
- `node emit.mjs`: the study as a course module (`out/study/emeraldbay.js`, not in git) in the real module's format.
- `node render.mjs [view ...]` (CHROME set): course.html with the study module served in place of
  `src/course/emeraldbay.js`, from fixed poses matched to the photos (`out/study/<view>.png`; about 1-2 min a view).

What the study changed in the game (they apply to Emerald Bay as it is too): bay-world.js paints two canvas textures
once (karst limestone with stains and hanging streaks, and a jungle canopy of leafy crowns) that the ground shader's
`BAY` branch reads triplanar at two scales; jungle on everything up to about 70 degrees, bare streaked rock past it
with jungle hanging on in patches, a dark notch at the waterline; lumpy crowns over the jungle near the hole and on
the 5 m (study) or 10 m map out to 1.7 km (none on a cliff's rim); the sea as a fresnel sheet (clear looking down, a
deep sheen across it) over a bed coloured by depth; a tropical sky dome with cumulus (`BW.sky`); longtails with a
prow post and canopy; the near map leaves the hole's box to the playfield.

## Layout round 2: whole islands (17 November 2026)

Rhys on the study: "way way more like what I was thinking ... redo the course". `r2/` is the re-laid routing on whole
islands, built like the study (study the look, then the plan book draws the real shapes):
- `bay.mjs`: the bay in world space (plan [x, n] → X, Z = −n): five whole islands (`ISLANDS`: A, the Maya island, a
  horseshoe round a cove opening north; B with the shelf on its west wall; C with the 7th's cove; the Sentinel; D, the
  Hong, hollow round its lagoon), the gap between C and the Sentinel (`GAP`), the sea cave into the Hong (`CAVE`), the
  stack, the islets (the Drop's islet, the cay), `FLATS` (strips at an island's foot: beach or wall edge, a lean, a
  peak), the tidal flats and the Sandbar, the Drop's ledge (`LEDGE`, 60 m up the cove's head wall) and the nine
  (`HOLES`, lines in plan). Par order kept (5 3 3 5 4 4 4 3 5), 3,368 yd from the back at low tide.
- `node map.mjs && python3 map.py`: the plan with the nine (`out/r2/map.png`).
- `node emit.mjs`: a course module of it (`out/r2/emeraldbay.js`, not in git); `node render.mjs [view ...]` (CHROME
  set): the aerials and a view from six tees (`out/r2/<view>.png`).
- `node proposal.mjs`: the routing proposal on white landscape pages (`out/emerald-bay-routing-r2.pdf`).
The holes: 1 the Village into the cove along its west terrace; 2 the Drop, off the ledge to the islet green in the
cove (the only hole up top); 3 the Tongue, across the cove to the beach under the east wall; 4 the Coves on B's
shelf; 5 the Sandbar to C; 6 the Gap, through the floor between C and the Sentinel (new, for the Saddle); 7 the
Overhang; 8 the Stack; 9 the Hong across the flats and through the cave. Next: Rhys's verdict, then plan book round 2.
