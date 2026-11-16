# Eldergrove: plan tools

Eldergrove is a playable blockout (15 November 2026, `?c=eldergrove`), made from its plan book (round 1, 14 November 2026, and Rhys's notes on it the next morning) by `emit.mjs`: the first tree course. Nine holes on the floor of an
ancient forest of conifers about 100 m tall (trunks 8-12 m across, first branches about 60 m up), a misty morning,
one colossal heart tree at the origin. The concept, the skeleton (par 36: 4 5 4 4 4 3 5 3 4), the routing and the
nine hole cards were approved by Rhys on 14 November 2026 (`claude/eldergrove-layout.md` and
`claude/brief-eldergrove.md` in the project). These tools draw them and make the plan book from one set of data.
They follow `tools/wreckersreach/` (`geo.mjs`, `shapes.mjs` and `greens.mjs` are copies of its own).

The forest's logic (Rhys's picks, 14 November 2026): a giant trunk is a tree body (`src/course/trees.js`) whose trunk
soaks 45% of the balls that hit it (`soak: 0.45`, as The Reclaim's facades: the ball drops at its foot, otherwise it
comes back off the bark); its crown from about 50 to 100 m up knocks a skied ball down (no normal shot gets above about
40 m). The lies reuse today's surfaces: moss plays as first cut, fern as rough, leaf litter as beach (firm, it runs),
root as native ('desert': it kicks, a bad lie now and then), the meadow and the Glade as rough. The brook and the pool
are the only penalty ground.

Run order: `node sample.mjs` (about 4 minutes), `python3 plans.py`, `node sketch.mjs [holes]` (about 15 s a hole),
then `node ../review/relief.mjs eldergrove`, `alike.mjs` and `spread.mjs` into `out/review.txt`, and `node book.mjs`
(`ROUND=n DATE='…' NEW=new.json` optional). Output goes to `out/` (ignored by git).

| Step | What it does |
|---|---|
| `world.mjs` | The forest in world space (x east, -z north; points written `[x east, n north]` as in the layout doc): `V(X, Z)`, the ground without the holes. The floor (an RBF through control heights along every line and between, `roll` for the floor's own swells), the meadow and the Glade (`meadowAt`, `gladeAt`, `openAt`), the brook (`BROOK`, its bed never rising downstream, the ravine on the 7th), the pool (`POOL`), the heart tree's mound and buttress roots (`heartAt`), the fallen giant (`FALLEN`, `fallenAt`: its back 28 m wide and 6 m up, the ramp of its broken crown) and its root plate, the hollow stump (`SHELL`), `SITES`, `LABELS`. |
| `holes.mjs` | `COURSE` (tee sets Redwood, Cedar, Rowan, Hazel, the Ironwood tips set, the course card) and `HOLES`: each hole from its world line through `route`, in its own frame. `trunks` places every giant near the play on purpose (`[s, off, r]`, `{ world }`, `{ at }`, `row(...)`; each list says its job: the gate, the colonnade, the valley's sides, the doorway, the stair tree...); `cross` (the 1st's half-pipe), `cant`, `root` (the 9th's centre root), `forms` (banks, the amphitheatre's roots with `root: true`), `teeY`/`tipsY` (the Stair's tees, 25, 12 and 31 m up, each a deck on a limb of the stair tree, `stair: true` on its trunk: for the ball a deck is a 10 x 12 m pad of ground at its height, running 8.5 m behind the tee and 3.5 m in front; scene.mjs gives each hole's `decks`, `limbs` and `stair`, and `DECKS`, `LIMBS`, `STAIRS` in world space; `worldAt(X, Z, true)` is the floor under a deck, which the sketches draw, with the limb and deck drawn over it), `fern` (the Avenue's 7 m), `highRoad`/`onTrunk` (the 3rd's high road drawn on the trunk's back), `reliefLine`/`formLine` (what `relief.mjs` and `alike.mjs` read). |
| `scene.mjs` | Each hole's own ground and surface (`buildHole`), the far forest (`FAR`: a jittered 34 m grid, 62 m or more off every line, out of the meadow, the Glade and the pool, and clear of the vistas to the heart tree), `worldAt` (the holes' grounds blended; a green or a tee pad its own hole's), and `BUILT`: each hole's `ground`, `surface`, `trees` (as the game's tree bodies), `walls`, `solids`, `crownOver`. The canopy (15 November, Rhys: tall pines whose crowns almost blend and block out the sun): pines 150-175 m tall (Rhys the same evening: the foliage "at least 2-3 times longer") with crowns from 51-56 m up, so 95-125 m of foliage, 26-32 m in radius on the placed giants and 24-30 on the far forest, and every giant 15-120 m from a line leans its crown out toward it by up to 22% of its radius (`lineNear` in `world.mjs`; `lx, lz` world, `ox, oz` in a hole's frame), so crowns from either side nearly meet over the play. Surfaces: `fairway`, `fringe`, `green`, `tee`, `moss`, `fern`, `litter`, `root`, `meadow`, `sand`, `water`, `bark`. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics through the trees (soak and crowns) on the forest lies, the course map's raster and the checks (`out/grid/checks.txt`, `!` marks a failure): pins, tees, overhead crowns, tips, landing widths, greens, leans, par 3s, the tee view through the game's camera (and how much of its 90° the trunks within 250 m fill), blind shots, and the brief's look-at-first list (the canopy against the tallest shots, a trunk never trapping a ball, the gate tree soaking drives, the Avenue's widths and gaps, the high road, its ramp and left side, the Stair's tees, the Hall's root and the green under the heart tree, the heart tree in the frame and through the forest, the reveal, penalty ground, the walks). |
| `python3 plans.py` | Plan (trunks to scale, placed ones dark, crowns as dashed rings), profile (trunks as bars) and green diagram per hole, and the course map. White pages. |
| `node sketch.mjs [holes]` | Three views a hole through a real camera in SVG: ground cells from `worldAt` (shade under the canopy, sun in the Glade), every trunk as a tapered column with its crown, the shell and the plate as boxes, a few sun shafts through the mist. |
| `node book.mjs` | The plan book PDF: the cover with the course map, the course card, the course at a glance, the checks as run, one page a hole. |
| `node emit.mjs` | Writes `src/course/eldergrove.js` (about 30 s; never hand-edit the module): each hole's field sampled from `worldAt` every 2 m (engine codes: moss 'firstcut', fern and meadow 'rough', litter 'beach', root and bark 'desert', sand, water with a 0.8 m bed; paint byte `m`), the decks as ground with `deckFloor` under them, greens and bunkers as outlines, the root plate and the stump's walls as soaking boxes, every giant near the field as a tree body (type 'redwood', 'snag' or 'heart'; soak 0.45; `dy` for its foot), the tips; and `COURSE.grove`, the forest once in world space (a 10 m and a 60 m map with the paint, every giant, the heart tree, the walls, the decks, limbs and stair) that `src/course/grove-world.js` draws. |

Plan book round 1 (14 November 2026), `out/eldergrove-plan-book-r1.pdf`. Changes from the layout doc: the 1st bends
left 26° and the 9th right 76° (measured from the approved lines; the table said right 26° and right 50°); the brook
crosses the 7th at 87% of its line so the lay-up leaves 90 yd; the 9th's back tees on a knoll 4 m up; the root plate
torn off to the left of the trunk's end. Open: the heart tree stands 50-85° left of the shot from every tee but the
9th's, outside the fixed camera's 90° (the 4th's reveal doesn't show in the frame), and from the 9th tee the left
lane lies behind the 4 m root.

Round 1 notes from Rhys (15 November 2026), in the same book: the heart tree's reveal is the 9th tee, the 9th's
two lanes stay blind (his picks, 14 November); the Stair's tees grown out of the tree (decks on three limbs, the
stair round the trunk; the stair tree moved to 15 m right of the line, the Cedar tee to [8, 21], a fourth view of
the 6th looks at the tree); the 3rd's high road made the better line: the fallen giant 32 m longer toward the green
(the root plate with it), the high road's target 223 m out leaving 88 m in sight, the sentinel (a standing giant
214 m out at the low road's left edge) making the low road a lay-up (182 m, 128 m left, blind and uphill) or a
26-30 m lane past it, the green turned 26° right to lie along the high road with a second sand hollow on the low
road's side (`out/h3-now-vs-proposed.png`). Then (Rhys, the same morning): the 3rd's green 10 m left (its line now ends at (446, -173)), so the
high road plays straight down it and the low road comes in across it past the trunk's end; the low road opened on
the right (to 45-48 m, and the lane past the sentinel 34-38 m wide), so going round is a real line too
(`out/h3-r2b.png`). And more ground (Rhys's pick, "roll plus two bigger forms"): the forest's own roll everywhere (`pitMound` in
world.mjs: a windthrow pit and its mound in each 46 m cell, the trees fallen toward the north-east, and a nurse log
in each 110 m cell; scene.mjs `rollK` takes it full off the fairways, a third on them and in the playing corridor,
none within 8 m of every shot's straight line (so a mound never hides a target), none round greens, tees and water); the 4th's green perched on a
knoll 5 m over the shore (`prof`; a hog's back was tried first, but the shore sits only a metre over the pool; `cross` with h < 0 now raises a spine); the 9th a true fall-away (7 m in
its last 100 m). `relief.mjs`: nine forms, none twice, no plain hole.

Blockout (15 November 2026): `node emit.mjs`, then `npm test` (`tests/eldergrove.test.mjs`), `node ../review/design.mjs
eldergrove` (the gate: every hole within +0.3 for both players after the fixes below) and `node ../review/playthrough.mjs
eldergrove --render=120`. The engine asked for three changes, made here in `holes.mjs`: the 7th's lay-up at P(360, 12)
(it sat a metre from the brook, which runs down the left of the second leg), the 4th's bold target at Lw(425, 113) (a
carry of about 230 yd, not 267), the 9th's left lane target at P(262, -14) (about 25 yd nearer than the right lane's).
