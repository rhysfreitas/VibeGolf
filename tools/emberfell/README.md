# Emberfell: plan book tools

Emberfell is a course in planning: nine holes on a volcano at dusk. Four play round the outside of the cone on a
broad shoulder below the rim (a kipuka of old forest beside a live lava river, a barranco, a breached cinder cone with
the green in its crater, a collapsed lava tube with a natural bridge), the 5th drops 59 m off the rim at the Notch,
and four play inside the caldera (two slumped terraces, a bay under a lavafall, a cape round the lava lake, and an
island in the lake with the clubhouse on it). These tools make its plan book from one set of data, so the plans,
profiles and sketch views always agree. They follow `tools/rimeholm/` (geo.mjs and shapes.mjs are copies of its own).

| Step | What it does |
|---|---|
| `world.mjs` | The mountain, in world space: `V(X, Z)` (the shoulder, the cone's upper slopes, the rim with the Notch as a narrow V, the spatter rampart round the Notch's outside, the caldera wall, terraces T1 and T2, the floor, the lake's pit and the island), `lavaAt` (the lake, the river between its levees, the pool under the fall), `nativeAt` (fresh flow, cinder, ash, rock, rubble). The shoulder under holes 1–4 is a Gaussian RBF through `CTRL` heights, so each hole climbs or falls as planned. |
| `holes.mjs` | The hole data, each hole in its own frame from `legs`, placed with `place: { at, heading }`: fairways (two edges along the line), greens from lobes, bunkers (ash sand by the greens, red scoria waste in the fairways, each with a `job`), forms, the cinder cone, cracks (the tube's square-ended trench, flow fronts), skylights, zones (forest, sulfur), `ramps` where the line eases down a step, `tips` (the spot for a future tips tee), targets and the words for the book. |
| `scene.mjs` | Each hole's ground: the mountain sampled under its line (eased down its `ramps`) near the line, blending into `V` 30–66 m off it, with the shared shapes (forms, cone, cracks) and its own green complex, bunkers and tee pads on top; surfaces; solid things. `worldAt` blends the holes into the mountain. |
| `node sample.mjs` | Grids, profiles, drives flown with the game's physics (`src/physics.js`) at 3,550 ft, the course map, and the checks: pins over 3%, tees near a fairway, anything overhead, the tips spot (room, slope, off the fairways, away from other greens, the fairway where 280 and 300 yd drives land), every tee set's landing width, scoria bunkers that don't touch the fairway, each green's depth, width and angle to the approach, and the par 3s' plays-like spread. `out/grid/checks.txt` has them; a line starting `!` breaks a rule. About a minute. |
| `python3 plans.py` | Plan and profile per hole (the tips spot as a hollow ring), and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG; past 1.7 km the mountain is drawn as silhouettes from `V` (the far walls, the cone, the sea at the horizon), under a pale dusk sky with the plume and its lightning. Seconds a view. |
| `node book.mjs` | The PDF (`out/emberfell-plan-book-r<ROUND>.pdf`): a cover with the map, the course at a glance (with the tips yardages and the greens' shapes), then one page a hole. `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page. |

Run them in that order. Output goes to `out/` (ignored by git). No emitter to the engine format yet.
