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

## Layout round 3: water between the islands (24 November 2026)

Rhys on round 2: "everything is a bit tight and the holes are all on the inside of their islands which is giving a
sense that there isn't any water between the islands"; he liked the study's horseshoe with only the green in the
middle of the U and the holes wrapping round the outside. `r3/` is set up like `r2/` (same tools; `bay.mjs` holds the
bay) with:
- the islands spread over about 1.8 by 1.6 km with open channels between every pair (about 290 m Maya island to B,
  290 m B to C, 180 m to the Hong, the open middle of the bay with the stack and the cay);
- the golf on the outer shores (1 up the Maya island's west side, 7 round a cove on C's north shore), but for the
  4th, which Rhys asked to route to the inside: a shelf up B's west wall over the channel, the Maya island across it;
- inside the horseshoe only the Drop: a notch at the lip 60 m up the cove's east wall (`LEDGE`, found by sampling the
  wall face on the line to the islet) and the green alone on a sand islet in the cove (`ISLETS[0]`);
- the 3rd from the east arm's tip across the channel's mouth to an islet, with a tide tongue (`BARS`: the tongue's
  crest 1.5 m is under the sea at high tide; the Sandbar's 3.1 m stays dry);
- par order kept (5 3 3 5 4 4 4 3 5): 5 3 4 5 3 4 4 3 5 would match Halcyon Ring on six holes. 3,279 yd.
`node proposal.mjs` writes `out/emerald-bay-routing-r3.pdf`. From the high aerial poses a dark shape shows at the far
map's southern edge (nothing in the ground data there); the proposal crops it.

## Plan book round 2 (24 November 2026)

Rhys approved layout round 3 ("Approve, go to the plan book", with the 4th moved to the inside). The plan tools
now draw it: `world.mjs`, `holes.mjs` and `round2-notes.json` were rewritten on the round 3 islands; `scene.mjs`,
`sample.mjs` and `book.mjs` keep their jobs (`ROUND=2` gave round 2). `node sample.mjs`, `python3 plans.py`,
`node sketch.mjs`, `node book.mjs` give `out/emerald-bay-plan-book-r2.pdf`.

- `world.mjs`: the bay as `r3/bay.mjs` built it (whole massifs, `FLATS` at their feet, islets), with the hole
  features drawn properly. Flats take `seaSide` (a terrace at a wall's foot: grass to the wall, a beach or, when it
  stands over 6 m, a low coral cliff on its sea side), `land` (grass across, a short beach `bank` only where it meets
  open water), `steps` ([s, dh, w] along the flat), `pipe`/`pipeW` (a dished floor, no noise). The 1st's terraces
  step down 4 m twice (`west`); the 4th's shelf leans 9% into B and climbs (`shelf`), its coves (`COVES`) bitten in
  from the channel; the Sandbar (`BAR`, uneven) and the 3rd's tongue (`TONGUE`) win over any flat they overlap
  (`tideBits`); the gap's walls come down to the slot's floor (extra superellipses on C and the Sentinel), the floor a
  half-pipe out to C's north beach (`gapfloor`, `gapexit`); the overhang (`OVER`) cuts C back to its foot and the beach
  runs in under it; the stack, its rim and spire; the 9th's flats (`TIDAL`), spit (`SPIT`: dry on its south side,
  narrow toward the stack), creek (`CREEK`), cave (`CAVE`, `caveRoofAt`), the wall-foot beach and the perched shelf
  in the lagoon. The Drop's notch (`LEDGE`) runs 30 m back so the tips spot stands in it, and its tee is at the lip.
- `holes.mjs`: the nine on the new lines (`LINES` in world.mjs), cards and words; `padFront` stops a tee pad short of
  a lip (the Drop's: a pad that ran 6 m on hid the islet); a bunker takes `kind: 'pot'` (1.6 m deep), and every
  bunker stays above high water on a low beach (`scene.mjs`).
- Checks: no Must broken at either tide; relief (bold 1 stepped and 4 bench), alike (0 of 15 alike) and spread
  (the 9th's 1,400 m² green past real golf) pass. One Should is open: the 6th's bold landing is about 1° out of sight.
- Not yet rebuilt: `emit.mjs` (the blockout) still reads round 1's features; the round 0 tools (`checks.mjs`,
  `dump.mjs`, `figs.py`) ran against round 0's world and are kept as a record.


## Plan book round 3 (24 November 2026)

From Rhys's markup on round 2. `ROUND=3` is now the default in `book.mjs`; `round3-notes.json` lists what moved.

- Sea stacks (`STACKS` in world.mjs, laid on a hole's line by `[k, s, off]`, `r`, `top`; one with `tee` has a mown
  top): the Drop's Turtle (22 m) and Clownfish (9 m) tees, the 3rd's Clownfish tee (16 m, a Ko Tapu needle in the
  blockout), and a 28 m stack in the Sandbar's right edge at 205 m (the fairway swells left past it).
- The 5th's headland (`HEAD5`, `headland()`): the cliff at the gap's mouth brought out round the green, its top 9 m
  (6 m over the bar), a grass ramp 16 m wide up the green's front-right corner (`ramp`, in the 5th's frame). The 6th's
  tee stands on its north edge and the slot's floor falls from 9 to 4.3 m to the exit (`gapfloor`, `gapfloor2`).
  The stacks and the headland are applied over the flats by `V`, which wraps the old function (`V0`).
- More fall: the 1st's terraces 16, 10 and 4 m (`west`: steps of 6 m, a 4.5% lean to the channel); the 7th's beach
  leans to the sea (`ccove`, `cnorth`; relief reads it as a hillside bench, 8%).
- The 9th re-laid as a true dogleg left (`LINES[8]`, 70°): the spit (`SPIT`, dry on its outside) round to the cave
  beach, and an island fairway inside the dogleg (`ISLAND9`, top 1.5 m: under the sea at high tide). Its low-tide
  version adds the island as a bold target (`island: true`; `sample.mjs` exempts it from the water-both-sides check
  and reports the carry from each tee and whether any of it stays dry at high tide). The flats, the creek and
  round 2's high-tide route are gone.
- Checks: no `!` at either tide; relief (bold 1, 4, 7; perched greens 5 and 9), alike (0 of 15) and spread pass.

## Plan book round 4 (25 November 2026)

From Rhys's markup on round 3 ("use your judgment on 9"). `ROUND=4` is the default in `book.mjs`; `round4-notes.json`.

- The 9th a real decision: the corner pushed out (`LINES[8]` through (-90, 855), 71°) so the long way round is a true
  three-shotter (no drive on the spit has the cave in line within reach); the Marlin tee 35 m back on the grown cay, so
  the island fairway is a 256 yd carry over water (289 yd to its middle, 238 left through the cave); a moat about 20 m
  across all round the island (`V` pulls the ground under the sea between 3 and 30 m out from `ISLAND9`'s outline;
  the cave beach's flat was cut back too); the spit's inside shelves off steeply (`SPIT.steep`). The cave's floor is
  mown through to the green (`scene.mjs`: a fairway piece over the cave reads fairway, not dry sand).
- The 8th's tees spread to 145, 130, 110, 95 yd; the Shark tips stay at 160 (15 yd behind the Marlin tee).
- `book.mjs`: a hole page is a flex column, so a long card shrinks the plan instead of pushing it into the footer.
- Checks: no `!` at either tide; relief, alike (0 of 15; the 9th reads as a split) and spread pass. 3,310 yd.

## Plan book round 5 (25 November 2026)

Rhys on round 4: the drawing meant "redo the fairway to green outline and move the tee box to the red circle", so that
taking the right fairway is three shots, with water between the end of the right fairway and the next (intermediate)
fairway "so that you can't go long enough to give yourself 230-250 in". `ROUND=5` is the default; `round5-notes.json`.

- The 9th's tee on `the tee rock` (an islet 6.5 m high in the open water south-west of the cay, `ISLETS`); the island
  fairway straight over the sea from it (281 yd, a 257 yd carry; 238 left through the cave).
- `SPITS` in world.mjs replaces the one spit: the right fairway's (`cap: 'end'`: past its end the land drops into the
  sea within a few metres) and the intermediate fairway's down to the cave beach (`cap: 'start'`), with 35-50 m of
  water between. `spitAt()` is laid both in the floor and over the flats in `V`, so the cave beach's beach edge can't
  cut the intermediate fairway. The right fairway's fairway ends 285 yd from the Marlin tee, leaving 306 yd.
- The moat round the island is measured in metres from its outline (3-19 m), not the superellipse's scaled distance.
- `sample.mjs`: the forced-carry check stops after 30 m of dry ground past the tee; a target with `second: true` (a bold
  target for the second shot) isn't looked for from the tee; it reports where the right fairway ends and what it leaves.
- `../review/relief.mjs` reads a plan that gives `B.sea` on the water's surface, not the sea bed.
- Checks: no `!` at either tide; relief (bold 1, 4, 7), alike (0 of 15; the 9th reads as broken) and spread pass. 3,315 yd.
## Plan book round 6 (25 November 2026)

Rhys's markup on round 5's 9th: the cave entrance more natural (his red line the beach, his green outline one connected
fairway round the cave's mouth), the island fairway a triangle "rewarded a little more as you hit longer", water between
it and the right fairway with a natural sandbar round it, and "round more of the areas ... natural sand bar areas into
the water rather than a drop off". `ROUND=6` is the default; `round6-notes.json`.

- The 9th's land is three shapes in world.mjs, each a waterline at low water with bands inside it (wet sand to the
  high-water mark over `wet` m, then dry sand, rough, grass) and a sandbar outside it (`shelf`: 3 m down over 45 m, then
  on to the bed over 120 m), laid in `V` by `land9` (the highest wins): `CAVELAND` (the cave beach: `shore` his red
  line, north tower to south tower, `wall` closing it through the towers; the grass rises 0.3 m away from the wall and
  meets the cave's floor at it), `ISLAND9` (the triangle `tri` with its corners rounded to 10 m by `roundPoly`, `plan`
  the outline; 1.5 m up, rough 3 m, sand 12 m, then water) and `RIGHT9` (the right fairway's land as rounded boxes in
  its line's frame, `rbox`: the shore and the grass, ends rounded). `CHANNEL9` keeps his blue channel 2.4 m deep.
  `SPITS`, `spitAt`, the moat and the `wallfoot` flat are gone. `smoothPoly` (Chaikin) smooths outlines.
- holes.mjs: the island fairway is `ISLAND9.plan`; the cave beach's fairway one outline (`mouth`) from inside the cave's
  mouth round the beach; the lay-up target in its middle (164 yd left).
- `sample.mjs` counts the island's high-tide cells inside the island's outline only (the cave beach's fairway now comes
  within 40 m of its middle).
- Checks: no `!` at either tide. The island: a 259 yd carry from the Marlin tee onto its point, 12 m wide at 260 yd,
  52 m at 290, 291 yd to its middle, 217 left. Water all round it (13 m at least), the tee rock 25 m off the right
  fairway's land, the gap 41 m. Relief, alike (0 of 15) and spread pass. 3,315 yd.

## Plan book round 7 (25 November 2026)

Rhys's markup on round 6's 9th: "extend the island fairway down some so you don't have to carry it quite so far",
the main fairway "isn't just a straight slot. Give it some irregular shape", and the cay between the 9th and the 8th
"seems like a leftover". `ROUND=7` is the default; `round7-notes.json`.

- `ISLAND9.tri` is his outline (the old triangle's top kept, carried down toward the tee rock), rounded to 8 m; sand
  10 m. The fairway now starts 229 yd from the Marlin tee (about a 230 yd carry) and runs to 319. From its lower part
  the cave's south tower hides the flag; `ISLAND9.aim` (the bold target) sits on the upper part, where the line to the
  pin goes through the cave: 287 yd out, 223 left.
- The right fairway: his outline added as a `poly` (swelling right over the upper half, on to near the land's end) and
  the ribbon's left edge in and out. `RIGHT9.bulge` widens the grass on the right to match; `tail` 34, `g1` 24. It ends
  317 yd from the Marlin tee and leaves 281.
- The cay is gone from `ISLETS`.
- Checks: no `!` at either tide; relief, alike (0 of 15) and spread pass. 3,315 yd.
