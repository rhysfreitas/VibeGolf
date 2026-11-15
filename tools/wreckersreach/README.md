# Wrecker's Reach: plan tools

Wrecker's Reach is a playable blockout since 14 November 2026 (`?c=wreckersreach`): the first true links. Nine holes on a spit of dunes on an invented
ship-graveyard coast (age of sail only: galleons, frigates, brigs, luggers), the sea to the west, the lagoon to the
east, in a storm clearing. The concept, the skeleton (par 36: 5 3 4 4 5 3 3 5 4), the routing and the nine hole cards
were approved by Rhys on 13 November 2026 (`claude/wreckers-reach-layout.md`, `claude/brief-wreckers-reach.md` and
`claude/brief-addendum-wreckers-reach-vegetation.md` in the project). These tools draw them and make the plan book
from one set of data. They follow `tools/buriedkingdom/` (`geo.mjs`, `shapes.mjs` and `greens.mjs` are copies of its
own; `shapes.mjs` adds a polygon fairway piece for the shared fairway, and `geo.mjs`'s `project` now gives the
distance to a corner past it, so a dogleg's fairway no longer carries on straight past the bend).

No special rule: a true links, the fantasy in the scenery. The links surfaces (Rhys's picks, 14 November 2026, from
`surfaces.mjs`'s numbers; in `src/physics.js` and `src/course/main.js` since then): the fairway runs (`COURSE.turf =
'links'` maps fairway, tee and fringe to physics 'links': a 140 mph drive runs about 35 yd, a 7 iron 16, against 17
and 8 on a parkland fairway); off it, fescue (plays as rough), then the dunes: pale sand (a bunker lie) with tussocks
of dune grass (a hack out, about 50 yd at most, always found); the beach (firm wet sand, −3%, it runs like a parkland
fairway); pots (a sod face: out about 85 yd at most, greenside as a bunker); the Sea wind, 14-20 mph from the
south-west, steady. The sea, the lagoon, the Cauldron and the creek are the only penalty ground.

Run order: `node sample.mjs` (about 4 minutes), `python3 plans.py`, `node sketch.mjs [holes]` (about 20 s a hole),
then `node ../review/relief.mjs wreckersreach`, `alike.mjs` and `spread.mjs` into `out/review.txt`, and
`node book.mjs` (`ROUND=n DATE='…' NEW=new.json` optional). Output goes to `out/` (ignored by git).

| Step | What it does |
|---|---|
| `surfaces.mjs` | Today's run-outs, lie costs and wind effects against the proposed links numbers (the figures Rhys picked from). |
| `world.mjs` | The spit in world space (x east, −z north; points written `[x east, n north]` as in the layout doc): `V(X, Z)`, the ground without the holes. The floor (an RBF through control heights: the dune slacks the holes lie in, with the layout doc's heights along every line) with `rumple` (humps and hollows 15-40 m across, about 0.4 m); the dunes between the holes (`duneAt`: hummocky crests 5-10 m, none within about 30 m of a playing line, the shared fairway or the double green) and the foredune on the sea side; the coast (`COAST`, `coastD`), the beaches (`beachAt`) and the water (`waterAt`: the sea, the lagoon, `CAULDRON` with its mouth, `CREEK`, one sheet at sea level); `SHARED_FW` and `DGREEN` (the shared ground: inside them every hole's ground is the world's own, and the double green has one datum and one contour, `dgContour`); `STANDS` (dune grass placed on purpose: the screen down the shared fairway); tussocks (`tussockDensity`, `tussockAt`: a jittered grid of clumps 3.2 m apart, kept by the density there); `SITES` (the inn, the luggers, the false light, the galleon's hull, stern castle and mizzen, the frigate's masts in the Cauldron, the beacon); `LINES` (the layout doc's lines, the 9th's slid 40 m north). |
| `holes.mjs` | `COURSE` (tee sets Galleon, Frigate, Brig, Lugger, the Man-of-War tips set, the course card) and `HOLES`: each hole from its world line through `route`, in its own frame; `L(x, n)` puts a world point in it. The line's height follows the world's floor, with `prof` knots `[[s, dy]]` added; `cant`, `cross` (the 4th's half-pipe), `table` (the 9th) as in the Buried Kingdom's tools; `forms` may be given in world space (`world`, `bearing`) and are shared by every hole; `props` (hulls, masts, ribs, the bell, the yard wall) and `stands` and `grass` (tussock zones: `{ at | world, r, d }`) go into world space for every hole to see; `green: { shared: true }` is the double green; a fairway piece `shared(Lw)` is the shared field; `layUp` (the 3rd: its forward tees lay up short of the hollow), `tight` (the 4th's neck: the nine's one tight landing), `boldLine`, `reliefLine` and `reliefLand` (what `relief.mjs` reads the 3rd on). |
| `scene.mjs` | Each hole's own ground and surface (`OWN`), then `worldAt`, which blends them (a green or a tee pad is its own hole's; the double green one surface), and `BUILT`: every hole's `ground` and `surface` read through `worldAt`, so two holes that share ground read the same height and surface (checked: 0.000 m apart). Surfaces: `fairway`, `fringe`, `green`, `tee`, `pot`, `fescue`, `dune`, `tussock`, `beach`, `water`. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics on the links surfaces (and in the Sea wind), the course map's raster and the checks (`out/grid/checks.txt`, `!` marks a failure): pins, tees, tips, landing widths, greens, leans, par 3s, the tee view through the game's camera, blind shots, and the brief's look-at-first list (the shared ground, the double green's two pins, width in a cross wind with a drive a standard deviation off line, each hole's plays-like length in the Sea wind, the 3rd's hull and lay-up, the 5th's cuts and its reveal, the 7th's forward tees, the 9th's face, bell and low road, the landmarks on a phone, the walks). |
| `python3 plans.py` | Plan, profile and green diagram per hole (the double green's diagram shows both flags), and the course map. White pages. |
| `node sketch.mjs [holes]` | Three views a hole through a real camera in SVG: ground cells from `worldAt`, boxes for the hulls, the castle, the inn and the ribs, posts for the masts, the lantern and the bell, tufts for the tussocks near the camera, a low storm-clearing sun. |
| `node emit.mjs` | Writes `src/course/wreckersreach.js`, the course module (about 40 s; never hand-edit it): each hole's field sampled every 2 m from `worldAt` with the engine's surface codes and a paint byte, the green and pots as outlines (the 2nd and 8th each carry the whole double green), the wrecks, the inn, masts and the beacon as rocks (`draw: false`), and `COURSE.links`, the spit once in world space, which `src/course/links-world.js` draws. |
| `node book.mjs` | The plan book PDF: the cover with the course map, the course card, the course at a glance, the checks as run, one page a hole. |

Plan book round 1 (14 November 2026), `out/wreckers-reach-plan-book-r1.pdf`. Changes from the layout doc, all from
the checks: the 9th slid 40 m north (the walk from the 8th green 97 m, not 137); the galleon 8 m west (her stern
castle hid the bold landing); the Cauldron 15 m west and a little smaller, with a mouth reaching north-east (so the
5th's last leg doesn't run along its bank, and the second cut still crosses water); the ground between the 5th tee
and the pool lowered and the tee raised 4.6 m (the reveal: the water shows from the tee); the shared field ends
about 100 yd from the 9th green (the table's back).

The blockout (14 November 2026, after Rhys approved round 1): `node emit.mjs`, then `node --test tests/wreckersreach.test.mjs`. Two
changes the engine asked for: the 4th green's back tier sits 3 m further from the pin (the cup sat on its foot, 4.2%),
and the 5th's bold target moved 6 m toward the line (it sat on the lobe's edge, which the 2 m field rounds to fescue).
