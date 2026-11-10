# Rimeholm: plan book tools

Rimeholm is a course in planning: nine holes on a glacier in the far north, played at night under the
aurora. Packed-snow fairways, powder rough, crevasses and a moulin (open air), hot springs round the greens,
a longship under the frozen lake (3) and a woolly mammoth in the valley wall (8). These tools make its plan
book from one set of hole data, so the plans, profiles and sketch views always agree. They follow
`tools/reclaim/` (the sketch renderer started as a copy of its `sketch.mjs`).

| Step | What it does |
|---|---|
| `holes.mjs` | The hole data: legs, profile, cant, fairways, green (raise and false front, tiers, tilt, Redan, crown, a true punchbowl), bunkers, hot pools, the lake and its lead, crevasses and the moulin, seracs, cliffs, the esker and valley walls, the ice cave, the ice bridge, the hall, targets and the words for the book. Each hole in its own frame; `place` chains each tee a short walk from the last green. |
| `scene.mjs` | Ground, surfaces and solid things per hole (pure), the world transform, and `worldAt`: the glacier between the holes, each hole's own ground near its line blended into the others further out. |
| `node sample.mjs` | Grids for the plans, profiles along the line (and the bold line), drives flown with the game's physics (`src/physics.js`), the course map, and checks (pins over 3%, tees within 12 m of a fairway, anything under 45 m over a tee). |
| `python3 plans.py` | Plan and profile per hole, and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG, hazed with distance, under a pale aurora sky so it prints. Seconds per view, no WebGL. `hole.sketch` tweaks a view (`tee.back`, `green.back`, `fov`, `up`, `eye`). |
| `node book.mjs` | The PDF (`out/rimeholm-plan-book-r<ROUND>.pdf`), printed with Chrome: a cover with the map, the course at a glance, then one page a hole (three views across the top; the plan, how it plays, the profile and notes under them). `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page from the JSON list. |

Run them in that order. Output goes to `out/` (ignored by git). There is no emitter to the engine format yet.
