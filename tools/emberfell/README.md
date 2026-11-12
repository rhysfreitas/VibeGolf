# Emberfell: plan book tools

Emberfell is a course in planning: nine holes on a volcano at dusk, re-laid in round 6 (11 November 2026) to
5 4 4 3 4 5 4 3 4. Three play round the outside of the cone on a broad shoulder below the rim (a par 5 down a kipuka
of old forest beside a live lava river, a barranco, a long par 4 over a collapsed lava tube with a natural bridge and a
channel fairway beyond its trench), the 4th drops 59 m off the rim at the Notch, and five play inside the caldera (two
slumped terraces, a bay under a lavafall, round the lava lake, a breached cinder cone on the floor with the green in
its crater, and an island in the lake with the clubhouse on it). A hole moved to a new number keeps its old shapes
through `seedN` (its old number seeds the green, bunkers and columns). `CARD` in `holes.mjs` is the course card, and
each hole's `words` its hole card (story, form, type, feature, decision, miss, teeView, ground); the book prints both.
The tips tee is in the data, switched off: `COURSE.tipsSet` and each hole's `tips: { tee, yards }`. These tools make its plan book from one set of data, so the plans,
profiles and sketch views always agree. They follow `tools/rimeholm/` (geo.mjs and shapes.mjs are copies of its own).

| Step | What it does |
|---|---|
| `world.mjs` | The mountain, in world space: `V(X, Z)` (the shoulder, the cone's upper slopes, the rim with the Notch as a narrow V, the spatter rampart round the Notch's outside, the caldera wall, terraces T1 and T2, the floor, the lake's pit and the island), `lavaAt` (the lake, three lava rivers between their levees, the pools under the fall and the 6th's columns), `nativeAt` (fresh flow, cinder, ash, rock, rubble, glowing crust fields, the geysers' sinter). The shoulder under holes 1–4 is a Gaussian RBF through `CTRL` heights, so each hole climbs or falls as planned. |
| `holes.mjs` | The hole data, each hole in its own frame from `legs`, placed with `place: { at, heading }`: fairways (two edges along the line), greens from lobes, bunkers (ash sand by the greens, red scoria waste in the fairways, each with a `job`), forms, the cinder cone, cracks (the tube's square-ended trench, flow fronts), skylights, zones (forest, sulfur), `ramps` where the line eases down a step, `tips` (the spot for a future tips tee), targets and the words for the book. |
| `scene.mjs` | Each hole's ground: the mountain sampled under its line (eased down its `ramps`) near the line, blending into `V` 30–66 m off it, with the shared shapes (forms, cone, cracks) and its own green complex, bunkers and tee pads on top; surfaces; solid things. `worldAt` blends the holes into the mountain. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics (`src/physics.js`) at 3,550 ft, the course map, and the checks: pins over 3%, tees near a fairway, anything overhead, the tips spot (room, slope, off the fairways, away from other greens, the fairway where 280 and 300 yd drives land), every tee set's landing width, scoria bunkers that don't touch the fairway, each green's depth, width and angle to the approach, and the par 3s' plays-like spread. `out/grid/checks.txt` has them; a line starting `!` breaks a rule. About a minute. |
| `python3 plans.py` | Plan and profile per hole (the tips spot as a hollow ring), and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG; past 1.7 km the mountain is drawn as silhouettes from `V` (the far walls, the cone, the sea at the horizon), under a pale dusk sky with the plume and its lightning. Seconds a view. |
| `node book.mjs` | The PDF (`out/emberfell-plan-book-r<ROUND>.pdf`): a cover with the map, the course at a glance (with the tips yardages and the greens' shapes), then one page a hole. `ROUND=6 NEW=rounds-r6.json node book.mjs` adds a "new in this round" page. Round 6 also prints the course card after the cover and a hole card at the top of each hole's page. |

Fairways aren't only ribbons: in `holes.mjs` a piece of `fw` is `{ e: [[s, L, R] ...] }` (two edges along the line), `{ lobes: [[s, off, along, across, rot] ...] }` (a free shape: a bowl, a fan, a hook, an island of fairway) or `{ bite: [...] }` (the same shapes cut out of the rest: an island in the middle, a scalloped edge). `docs/fairway-forms.svg` shows twelve forms and `tools/review/forms.mjs` has the data for each; `node tools/review/alike.mjs emberfell` names each fairway's form and flags repeats (`docs/COURSE-DESIGN.md` "Sameness" and "Fairway forms").

Run them in that order. Output goes to `out/` (ignored by git).

`node emit.mjs` writes the playable course, `src/course/emberfell.js`, from the same data (about a minute): each hole's
ground sampled every 2 m from `worldAt` (so it meets its neighbours as the book draws them; open air for the lava tube's
trench and skylights; lava as the engine's 'water', its bed 0.8 m under the drawn level) with a paint byte (fresh flow,
rock, rubble, red cinder, forest floor, sulfur, the clubhouse's floor, crust, sinter, lava), the green and bunkers as
outlines over it (`features.js` `outline` + `keepGround`; sand by the greens, red scoria `waste` in the fairways),
boulders, lava trees and the clubhouse as rocks the ball hits, the kipuka's forest as plants, the tips tee carried
through switched off, and `COURSE.ember`: the volcano once in world space (a 10 m height map over the caldera and the
shoulder, a 50 m one out to the sea, the lavafall, the plume, vents, geysers, columns) for `src/course/ember-world.js`.
Rerun it after any change here, then `node --test tests/emberfell.test.mjs`, `node tools/review/quickplay.mjs emberfell`
and `node tools/review/playthrough.mjs emberfell --render=120`.
