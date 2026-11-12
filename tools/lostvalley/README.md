# The Lost Valley: plan book tools

The Lost Valley is a playable blockout (since 11 November 2026, after plan book round 3): nine holes in a hidden valley where time stopped, walled in by the sheer
cliffs of a table mountain (a tepui), on a golden afternoon after rain. Round 3 (11 November 2026) re-laid it to the
skeleton Rhys picked: par 37, 4 5 4 3 5 4 3 4 5. The round starts at the expedition camp on a knoll on the valley
floor; 1 Cycad Grove (a giant monkey-puzzle at the inside of the corner), 2 The Floodplain (a Long: the back channel
across the second shot), 3 The Bone Bed (the Bone Bluff in the fairway, the green in a ring of sand), 4 The Tar Pit
(a Short dressed in tar), 5 The Swamp (two stepping stones or the dry way); 6 The Nest climbs a ramp to a ledge 27 m
up the east wall, 7 The Overlook drops off its bluff (an Eden; the creek from Nest Falls long and left; the reveal),
8 The Strangler (drivable under the root arch; a Leven) and 9 The Plunge Pool (a reachable par 5 to the shelf green
in the pool under the Great Falls). Long-necks, small plant-eaters, pterosaurs and one distant hunter are scenery
only. Each hole in `holes.mjs` carries its hole card (`card`: type, form, feature and job, decision, miss map, tee
view, ground) and `COURSE.card` the course card, as `docs/COURSE-DESIGN.md` Part 1 asks. These tools make its plan
book from one set of data, so the plans, profiles and sketch
views always agree. They follow `tools/emberfell/` (geo.mjs and shapes.mjs are copies of its own).

| Step | What it does |
|---|---|
| `world.mjs` | The valley, in world space: `V(X, Z)` (the floor as a Gaussian RBF through `CTRL` heights, lightly smoothed (0.02 on the diagonal) so close heights don't overshoot into hills; the walls rising from a wandering foot (`footR`: bays where falls come down) as a jungle talus, then a sheer face with three ledges to the flat top, the table mountains beyond (`FAR`), the east `LEDGE` with its bluff (it stops at its ends) and the `ramp` down its south end, the river's channel and braids, the gorge through the sill, the plunge pool, the swamp's basin, the tar pit, the creek's shallow valley). Two parts go on after a hole's line profile (scene.mjs samples `V(X, Z, true)` under the line, then adds them): `standAt` (what stands in the play: the Bone Bluff) and `cutAt` (narrow water cut into any ground: Nest Falls' pool and stream on the ledge, the creek from the cascade off the bluff, behind the 7th green, to the river, the back channel and its oxbow, the 5th's two pools `POOLS5`). `waterAt` (the pool round the 9th's shelf, the river's channels, the swamp's pools, the tar's three pools, Nest Falls' pool and stream, the creek, the back channel, the oxbow) and `nativeAt` (fern meadow, jungle, cliff, gravel bars, mud). |
| `life.mjs` | The scenery in world space: the camp on its knoll behind the 1st tee (tents, the mess fly, the hut on stilts, the fire, crates, the flag), the falls (`FALLS`: the Great Falls, Nest Falls, its cascade off the bluff (a `fixed` lip) and ribbon falls at the wall's bays) and the animals (`LIFE`: the plain herd south of the 5th, the east meadow herd and three wading the river, small plant-eaters drinking, the hunter, pterosaurs in flight, nests on the east wall above the ledge). |
| `holes.mjs` | The hole data, each hole in its own frame from `legs`, placed with `place: { at, heading }`: fairways (pieces, each two edges along the line: split lanes, pieces either side of a creek or a channel, stepping stones), greens from lobes, bunkers (river sand, each fairway bunker with a `job`; `strip` for a long one, `waste: true` for a shallow waste, `ring: { inner, outer, gap, gapW }` for sand round a green with one way in), forms, cants, trees by kind (`cycad`, `fern`, `conifer`, `broad`, `cypress`), the 1st's `spire`, the 2nd's `giant` (a tree with low boughs), the 1st's `log`, the 6th's `strangler` (trunk, canopy, root `arch`), the 9th's `step` (a rock band across the hole, the ground flattened either side, broken down over `gap`), the 8th's `swampTrees`, `tips` (the spot for a future tips tee), targets and the words for the book. |
| `scene.mjs` | Each hole's ground: the valley sampled under its line near the line, blending into `V` further out (where the valley differs a lot from the line, as at the bluff, the valley keeps its shape), with forms, the green complex, bunkers and tee pads on top; surfaces (the river's gravel bars within 150 m of the line play as bunkers, `bar`); solid things (trees, boulders, the spire, the fig's trunk and canopy, the root arch). `worldAt` blends the holes into the valley. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics (`src/physics.js`) at 1,320 ft, the course map, and the checks: pins over 3%, tees near a fairway, anything overhead, the tips spot (room, slope, off the fairways, away from other greens, the fairway where 280 and 300 yd drives land), every tee set's landing width (one fairway 40 m or more, or two lanes 25 m or more each where a split fairway lands), fairway bunkers that don't touch the fairway, the fairway lean round each target (at the target's own offset, so a lane counts), each green's depth, width and angle to the approach, and the par 3s' plays-like spread. `out/grid/checks.txt` has them; a line starting `!` breaks a rule. About two minutes. |
| `python3 plans.py` | Plan and profile per hole (the tips spot as a hollow ring; no contours up the walls), and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG. The walls are drawn as ground out to 2.7 km (sandstone banded and streaked, jungle on the talus and the ledges), the table mountains beyond as silhouettes; falls hang down the faces from lips found on the walls; trees by kind; scattered stands on the floor kept 35 m off every line; the camp, the rope bridge, the spire with its perched pterosaur, the Strangler, the skeleton, the tar pit's bones; the animals as true-shape silhouettes. About 40 s a hole. |
| `node book.mjs` | The PDF (`out/lostvalley-plan-book-r<ROUND>.pdf`): a cover with the map, the course at a glance, then one page a hole. `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page. |

Fairways aren't only ribbons: in `holes.mjs` a piece of `fw` is `{ e: [[s, L, R] ...] }` (two edges along the line), `{ lobes: [[s, off, along, across, rot] ...] }` (a free shape: a bowl, a fan, a hook, an island of fairway) or `{ bite: [...] }` (the same shapes cut out of the rest: an island in the middle, a scalloped edge). `docs/fairway-forms.svg` shows twelve forms and `tools/review/forms.mjs` has the data for each; `node tools/review/alike.mjs lostvalley` names each fairway's form and flags repeats (`docs/COURSE-DESIGN.md` "Sameness" and "Fairway forms").

Run them in that order. Output goes to `out/` (ignored by git).

`node emit.mjs` writes the playable course, `src/course/lostvalley.js` (`course.html?c=lostvalley`), from the same
data (about 2 minutes; don't hand-edit the module): each hole's ground sampled every 2 m from `worldAt` (so it meets
its neighbours as the book draws them) with the engine's surface codes and a paint byte (meadow, jungle floor, rock,
rubble, mud, gravel, the camp, tar, water); water and tar play as `water` (their bed 0.8 m under the drawn level; the
toast says "Into the tar" in the tar), the river's gravel bars near the play as `sand`; the green and bunkers as
outlines over the field (`features.js` `outline` + `keepGround`; river sand, and the 1st's strip as `waste`);
boulders, the 7th's spire (a hoodoo, `draw: false`: valley-world.js draws it), the Strangler's root arch (wedges along
its curve), the camp's hut and the lookout (boxes that soak) as rocks; every tree as a plant with its own body
(`h`, `cr`, `low`, `tr`: trees.js), including the giant on the 1st, the fig and a jungle of about 4,000 on the talus,
kept 60 m off every line; and `COURSE.valley`: the valley once in world space (a 10 m map over the floor and walls, a
50 m one out to the far mesas, the falls, camp, bridge, bones and animals) for `src/course/valley-world.js`. Rerun it
after any change here, then `node --test tests/lostvalley.test.mjs` and
`node tools/review/playthrough.mjs lostvalley --render=120`.

Still to come from `claude/course-brief-lost-valley.md` (the art pass): the jungle look (the blockout's trees are
plain shapes), the animals beyond blocks, the Overlook's pterosaur (perched, launched by the round's first tee shot,
once a round), the after-rain light and mist worked up.
