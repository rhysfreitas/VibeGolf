# Eldergrove: plan tools

Eldergrove is in its plan book (round 1, 14 November 2026): the first tree course. Nine holes on the floor of an
ancient forest of conifers about 100 m tall (trunks 8-12 m across, first branches about 60 m up), a misty morning,
one colossal heart tree at the origin. The concept, the skeleton (par 36: 4 5 4 4 4 3 5 3 4), the routing and the
nine hole cards were approved by Rhys on 14 November 2026 (`claude/eldergrove-layout.md` and
`claude/brief-eldergrove.md` in the project). These tools draw them and make the plan book from one set of data.
They follow `tools/wreckersreach/` (`geo.mjs`, `shapes.mjs` and `greens.mjs` are copies of its own).

The forest's logic (Rhys's picks, 14 November 2026): a giant trunk is a tree body (`src/course/trees.js`) whose trunk
soaks 45% of the balls that hit it (`soak: 0.45`, as The Reclaim's facades: the ball drops at its foot, otherwise it
comes back off the bark); its crown from 60 to 100 m up knocks a skied ball down (no normal shot gets above about
40 m). The lies reuse today's surfaces: moss plays as first cut, fern as rough, leaf litter as beach (firm, it runs),
root as native ('desert': it kicks, a bad lie now and then), the meadow and the Glade as rough. The brook and the pool
are the only penalty ground.

Run order: `node sample.mjs` (about 4 minutes), `python3 plans.py`, `node sketch.mjs [holes]` (about 15 s a hole),
then `node ../review/relief.mjs eldergrove`, `alike.mjs` and `spread.mjs` into `out/review.txt`, and `node book.mjs`
(`ROUND=n DATE='…' NEW=new.json` optional). Output goes to `out/` (ignored by git).

| Step | What it does |
|---|---|
| `world.mjs` | The forest in world space (x east, -z north; points written `[x east, n north]` as in the layout doc): `V(X, Z)`, the ground without the holes. The floor (an RBF through control heights along every line and between, `roll` for the floor's own swells), the meadow and the Glade (`meadowAt`, `gladeAt`, `openAt`), the brook (`BROOK`, its bed never rising downstream, the ravine on the 7th), the pool (`POOL`), the heart tree's mound and buttress roots (`heartAt`), the fallen giant (`FALLEN`, `fallenAt`: its back 28 m wide and 6 m up, the ramp of its broken crown) and its root plate, the burnt shell (`SHELL`), `SITES`, `LABELS`. |
| `holes.mjs` | `COURSE` (tee sets Redwood, Cedar, Rowan, Hazel, the Ironwood tips set, the course card) and `HOLES`: each hole from its world line through `route`, in its own frame. `trunks` places every giant near the play on purpose (`[s, off, r]`, `{ world }`, `{ at }`, `row(...)`; each list says its job: the gate, the colonnade, the valley's sides, the doorway, the stair tree...); `cross` (the 1st's half-pipe), `cant`, `root` (the 9th's centre root), `forms` (banks, the amphitheatre's roots with `root: true`), `teeY` (the Stair's platform tees, 25 and 12 m up: a column of ground in the field, since a features.js pad stops at a lip), `fern` (the Avenue's 7 m), `highRoad`/`onTrunk` (the 3rd's high road drawn on the trunk's back), `reliefLine`/`formLine` (what `relief.mjs` and `alike.mjs` read). |
| `scene.mjs` | Each hole's own ground and surface (`buildHole`), the far forest (`FAR`: a jittered 34 m grid, 78 m or more off every line, out of the meadow, the Glade and the pool, and clear of the vistas to the heart tree), `worldAt` (the holes' grounds blended; a green or a tee pad its own hole's), and `BUILT`: each hole's `ground`, `surface`, `trees` (as the game's tree bodies), `walls`, `solids`, `crownOver`. Surfaces: `fairway`, `fringe`, `green`, `tee`, `moss`, `fern`, `litter`, `root`, `meadow`, `sand`, `water`, `bark`. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics through the trees (soak and crowns) on the forest lies, the course map's raster and the checks (`out/grid/checks.txt`, `!` marks a failure): pins, tees, overhead crowns, tips, landing widths, greens, leans, par 3s, the tee view through the game's camera (and how much of its 90° the trunks within 250 m fill), blind shots, and the brief's look-at-first list (the canopy against the tallest shots, a trunk never trapping a ball, the gate tree soaking drives, the Avenue's widths and gaps, the high road, its ramp and left side, the Stair's tees, the Hall's root and the green under the heart tree, the heart tree in the frame and through the forest, the reveal, penalty ground, the walks). |
| `python3 plans.py` | Plan (trunks to scale, placed ones dark, crowns as dashed rings), profile (trunks as bars) and green diagram per hole, and the course map. White pages. |
| `node sketch.mjs [holes]` | Three views a hole through a real camera in SVG: ground cells from `worldAt` (shade under the canopy, sun in the Glade), every trunk as a tapered column with its crown, the shell and the plate as boxes, a few sun shafts through the mist. |
| `node book.mjs` | The plan book PDF: the cover with the course map, the course card, the course at a glance, the checks as run, one page a hole. |

Plan book round 1 (14 November 2026), `out/eldergrove-plan-book-r1.pdf`. Changes from the layout doc: the 1st bends
left 26° and the 9th right 76° (measured from the approved lines; the table said right 26° and right 50°); the brook
crosses the 7th at 87% of its line so the lay-up leaves 90 yd; the 9th's back tees on a knoll 4 m up; the root plate
torn off to the left of the trunk's end. Open: the heart tree stands 50-85° left of the shot from every tee but the
9th's, outside the fixed camera's 90° (the 4th's reveal doesn't show in the frame), and from the 9th tee the left
lane lies behind the 4 m root.
