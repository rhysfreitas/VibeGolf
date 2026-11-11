# The Lost Valley: plan book tools

The Lost Valley is a course in planning: nine holes in a hidden valley where time stopped, walled in by the sheer
cliffs of a table mountain (a tepui), on a golden afternoon after rain. The round starts and ends at an old
expedition camp on a ledge 30 m up the south wall. The 1st drops off the ledge's bluff to the floor, 2–8 loop round
the floor (a cycad grove, a tar pit, the braided river, the plunge pool under the Great Falls, a colossal strangler
fig with a root arch over the fairway, the Bone Bluff with a skeleton in its face, a swamp of cypresses), and the 9th
climbs a broad ramp back to the ledge beside Camp Falls. Long-necks, small plant-eaters, pterosaurs and one distant
hunter are scenery only. These tools make its plan book from one set of data, so the plans, profiles and sketch
views always agree. They follow `tools/emberfell/` (geo.mjs and shapes.mjs are copies of its own).

| Step | What it does |
|---|---|
| `world.mjs` | The valley, in world space: `V(X, Z)` (the floor as a Gaussian RBF through `CTRL` heights, the walls rising from a wandering foot (`footR`: bays where falls come down) as a jungle talus, then a sheer face with three ledges to the flat top, the table mountains beyond (`FAR`), the camp's `LEDGE` with its bluff and the `ramp` down its east end, the river's channel and braids, the gorge through the sill, the plunge pool, the swamp's basin, the tar pit, the Bone Bluff), `waterAt` (the pool, the river's channels, the swamp's pools, the tar, Camp Falls' pool and stream) and `nativeAt` (fern meadow, jungle, cliff, gravel bars, mud). |
| `life.mjs` | The scenery in world space: the camp (tents, the mess fly, the hut on stilts, the fire, crates, the flag), the falls (`FALLS`: the Great Falls, Camp Falls and ribbon falls at the wall's bays) and the animals (`LIFE`: the plain herd, the east meadow herd and three wading the river, small plant-eaters drinking, the hunter, pterosaurs in flight, nests on the south wall). |
| `holes.mjs` | The hole data, each hole in its own frame from `legs`, placed with `place: { at, heading }`: fairways (two edges along the line; the 6th has a second branch round the fig), greens from lobes, bunkers (river sand, each fairway bunker with a `job`), forms, cants, trees by kind (`cycad`, `fern`, `conifer`, `broad`, `cypress`), the 1st's `spire`, the 6th's `strangler` (trunk, canopy, root `arch`), the 8th's `swampTrees`, `tips` (the spot for a future tips tee), targets and the words for the book. |
| `scene.mjs` | Each hole's ground: the valley sampled under its line near the line, blending into `V` further out (where the valley differs a lot from the line, as at the bluff, the valley keeps its shape), with forms, the green complex, bunkers and tee pads on top; surfaces (the river's gravel bars within 150 m of the line play as bunkers, `bar`); solid things (trees, boulders, the spire, the fig's trunk and canopy, the root arch). `worldAt` blends the holes into the valley. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics (`src/physics.js`) at 1,320 ft, the course map, and the checks: pins over 3%, tees near a fairway, anything overhead, the tips spot (room, slope, off the fairways, away from other greens, the fairway where 280 and 300 yd drives land), every tee set's landing width, fairway bunkers that don't touch the fairway, each green's depth, width and angle to the approach, and the par 3s' plays-like spread. `out/grid/checks.txt` has them; a line starting `!` breaks a rule. About two minutes. |
| `python3 plans.py` | Plan and profile per hole (the tips spot as a hollow ring; no contours up the walls), and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG. The walls are drawn as ground out to 2.7 km (sandstone banded and streaked, jungle on the talus and the ledges), the table mountains beyond as silhouettes; falls hang down the faces from lips found on the walls; trees by kind; scattered stands on the floor kept 35 m off every line; the camp, the rope bridge, the spire with its perched pterosaur, the Strangler, the skeleton, the tar pit's bones; the animals as true-shape silhouettes. About 40 s a hole. |
| `node book.mjs` | The PDF (`out/lostvalley-plan-book-r<ROUND>.pdf`): a cover with the map, the course at a glance, then one page a hole. `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page. |

Run them in that order. Output goes to `out/` (ignored by git). No emitter to the engine format yet.

Things the engine will need that it doesn't have (from `claude/course-brief-lost-valley.md`): the jungle look fast
on phones, the animals as instanced herds, the Overlook's pterosaur (perched, launched by the round's first tee
shot, once a round), the tar pit as a water-like hazard, the root arch as a solid arch, the golden after-rain sky.
