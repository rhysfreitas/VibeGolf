# The Buried Kingdom: plan tools

The Buried Kingdom is planned, not yet playable: nine holes through an invented Egyptian site half buried in drifted
sand, in blazing late-morning light. The concept, the skeleton (par 36: 3 5 4 4 3 5 4 4 4), the routing and the nine
hole cards were approved by Rhys on 13 November 2026 (`claude/buried-kingdom-layout.md` and
`claude/brief-buried-kingdom.md` in the project). These tools draw them and make the plan book from one set of
data. They follow `tools/lostvalley/` (`geo.mjs`, `shapes.mjs` and `greens.mjs` are copies of its own).

Three zones in order: the river (1 The Landing, 2 The River Bank, 3 The Causeway), the plateau (4 Sahara, 5 The
Sphinx, 6 Hog's Back), the cliffs (7 The Quarry, 8 The Gate, 9 The Colossi). Its logic is sand in three bands: rough
8-15 m round every fairway and green; then firm, wind-packed sand (surface `firm`, the lie "Sand"), which plays as
the game's existing waste area (Rhys's pick, 13 November: no change to `src/physics.js`; a 7 iron goes 160 yd from
it against 173 from fairway, and a ball landing on it stops in about a yard); and soft sand (surface `sand`, the
lie "Dune": a bunker, 7 iron 139 yd) only in bunkers and the Sand Sea. Water is in play on the 1st and 2nd only.

Plan book round 1 (13 November 2026), `out/buried-kingdom-plan-book-r1.pdf`: real fairway outlines from the forms
(scalloped, funnel, hook, broken, a wide strip, fan, island: `alike.mjs buriedkingdom` 0 of 21 alike), green shapes
sized to the cards, bunkers, heights (`relief.mjs`: nine height forms, none twice, bold 4, 7, 8), tee sets (Falcon,
Jackal, Ibis, Scarab) and the Cobra tips spot on every hole (3,730 yd, switched off), targets (bold on 4 and 9, the
6th's green). `spread.mjs` finds no cluster. Changes from the layout doc, all from the checks: the great pyramid
stands 48 m further south (centre 733, 712) so its face is square behind the 3rd green; the 8th's gate towers
stand 25.5 m either side of the line (42 m of fairway between them, so every tee set lands on 40 m); the 9th's
Ibis and Scarab tees are both right of the line (from the left the obelisk hid the target); the 8th's tips spot is
west of its back tee (straight back it crowded the 7th green).

Round 2 (13 November 2026, Rhys's picks from two now-against-proposed sheets), `out/buried-kingdom-plan-book-r2.pdf`:
the 2nd leans 2.2% toward the river (was 2.5% away; a terrace across its fairway was drawn and dropped: a river
plain has no height); three dunes drifted over the 3rd's causeway from alternate sides and three round the 4th's
grass (`forms`), each lifting one edge of the fairway about 2 m. `xsec.mjs <hole> <s,s,...>` cuts cross-sections
of a hole's ground for such sheets.

Run order: `node sample.mjs` (about 2 minutes), `python3 plans.py`, `node sketch.mjs [holes]` (about 20 s a hole),
then `node ../review/relief.mjs buriedkingdom`, `alike.mjs` and `spread.mjs` into `out/review.txt`, and
`node book.mjs` (`ROUND=n DATE='…' NEW=new.json` optional). Output goes to `out/` (ignored by git).

| Step | What it does |
|---|---|
| `world.mjs` | The site in world space (x east, -z north; points are written `[x east, n north]` as in the layout doc): `V(X, Z)`, the ground without the holes. Two smooth floors through control heights (`UP`: the river plain rising east onto the plateau; `LOW`: the quarry's bench and the wadi), joined along the plateau's lip (`LIP`); the river (`BANK`, water west of it) and the boat basin (`BASIN`, quay walls but for a beach round its south-east); the dune sea on the plateau (`duneAt`: transverse ridges, none on the river plain, in the wadi or along the 6th); the wadi's cliffs (`wallAt`, about 90 m either side of `WADI`); what stands on the ground (`standAt`: the three pyramids and the Sphinx's body); what is cut into it (`cutAt`: the Sand Sea, the quarry, the river and basin); `waterAt`, `softAt` (the Sand Sea's soft sand), `nativeAt` (firm sand, fields by the river, rock, stone); `SITES` (the built things as boxes: the valley temple, the Sphinx's head, the cliff temple and colossi, the camp, the unfinished obelisk) and `LABELS`. |
| `holes.mjs` | `COURSE` (tee sets, the Cobra tips set, the course card) and `HOLES`: each hole from the layout doc's world line (`world`, through `route`, which gives `place` and `legs`), in its own frame. `prof` (knots `[s, y]` from the tee) draws the line's height on every hole; `cant`, `cross` and `table` as in the Lost Valley's tools; `deck` (the 3rd: the ground drops `h` outside the fairway's edge, a kerb along it); `gate` (the 8th's two towers); `obelisk` (the 9th's fallen pieces); `mown` (the steepest slope the fairway is mown up: the 8th's face); `tight` (the nine's one tight fairway, allowed 30-36 m at the back tee's landing); `endFade`, `flat`, `fade` (where the hole's own ground gives way to the world); a green's `k` scales its lobes to the card's area; a form with `stone: true` is stone (the Sphinx's paws). Card yards are along the line, or on a par 3 straight from the pad. `reliefLine` and `formLine` (the 4th) are the lines `relief.mjs` and `alike.mjs` read the hole on: its valley is on the bold line and its hook wraps the straight line. |
| `scene.mjs` | Each hole built in its own frame (`buildHole`): the line's profile near the line, blending into `V` off it and past both ends, with forms, the green, bunkers and tee pads on top; `surface` (the three bands of sand); the solid things (towers, obelisk pieces, the world's boxes near the hole, palms, boulders). `worldAt` is the ground between the holes. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics (firm sand as 'waste'), the course map's raster and the checks (`out/grid/checks.txt`, `!` marks a failure): the Lost Valley's set (pins, tees, tips, landing widths, bunkers, greens, leans, par 3 spread), the tee view through the game's fixed camera for every tee set, the landmarks' height on a phone, and the layout doc's look-at-first list (the 1st's carries and beach, the 4th's bold line and way round, the 7th's bench and whether it is drivable, the 8th's face and carries, the 8th green against the 9th tee, the walks). |
| `python3 plans.py` | Plan, profile and green diagram per hole, and the course map. White pages. |
| `node sketch.mjs [holes]` | Three views a hole (back tee 2.4 m up, landing area or forward tee, short of the green): plain shapes through a real camera in SVG. Blockout shapes only. |
| `node book.mjs` | The plan book PDF: cover map, course card, the course at a glance (two tables), the checks as run, one page a hole. |

The blockout (13 November 2026, after Rhys approved the plan book): `node emit.mjs` (about a minute) writes
`src/course/buriedkingdom.js` from this data: each hole's field every 2 m (firm sand as the engine's 'waste', the
Sand Sea and bunkers 'sand', the river and the basin 'water'), greens and bunkers as outlines, the built things as
soaking boxes, palms as plants, the tips spots switched off, and `COURSE.kingdom` (the site once: a 10 m map, a
60 m one beyond, pyramids, built things, palms) for `src/course/kingdom-world.js`. Don't hand-edit the module.
After a change: `node emit.mjs`, `npm test`, `node ../review/design.mjs buriedkingdom` (the gate),
`node ../review/tips.mjs buriedkingdom` (the 3rd's 36 m landing is the nine's one tight fairway, on purpose).
Each tips spot gets level ground (`tipsPad` in `scene.mjs`); one more than 10 m off the line (the 8th's, beside
the lip) is measured through the back tee. Targets moved for the engine: the 8th's (terrace 246 m, lay-up 165 m)
and the 9th's (the bold left one at 266 m past the obelisk; a lay-up short of the forecourt).

Still to come: the art pass (`docs/ART-PASS.md`), in its own round.
