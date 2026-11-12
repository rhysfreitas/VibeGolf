# Rimeholm: plan book tools

Rimeholm is a course in planning: nine holes on a glacier in the far north, played at night under the
aurora. Packed-snow fairways, powder rough, crevasses and a moulin (open air), hot springs round the greens,
a longship under the frozen lake (3) and a woolly mammoth in the valley wall (8). These tools make its plan
book from one set of hole data, so the plans, profiles and sketch views always agree. They follow
`tools/reclaim/` (the sketch renderer started as a copy of its `sketch.mjs`).

| Step | What it does |
|---|---|
| `holes.mjs` | The hole data: legs, profile, cant, fairways, green (raise and false front, tiers, tilt, Redan, crown, a true punchbowl), bunkers (ellipses, `strip`s along the line with edges like a fairway's, a `wrap` round the green), hot pools, the lake and its open water, crevasses and scarps (`crag` for an edge that wanders in bays and buttresses, `rockFace` for a dark rock cliff with rock tors on its lip, `bulge` where a frozen waterfall builds out from it) and the moulin, seracs, the frozen falls (`falls`: columns and icicles down a scarp), cliffs, the esker and valley walls, the ice cave, the ice bridge, the hall, targets and the words for the book. Each hole in its own frame; `place` chains each tee a short walk from the last green. |
| `scene.mjs` | Ground, surfaces and solid things per hole (pure), the world transform, and `worldAt`: the glacier between the holes, each hole's own ground near its line blended into the others further out. |
| `node sample.mjs` | Grids for the plans, profiles along the line (and the bold line), drives flown with the game's physics (`src/physics.js`), the course map, and checks (pins over 3%, tees within 12 m of a fairway, anything under 45 m over a tee). |
| `python3 plans.py` | Plan and profile per hole, and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, inked and washed in SVG, hazed with distance, under a pale aurora sky so it prints. Seconds per view, no WebGL. `hole.sketch` tweaks a view (`tee.back`, `green.back`, `fov`, `up`, `eye`). |
| `node book.mjs` | The PDF (`out/rimeholm-plan-book-r<ROUND>.pdf`), printed with Chrome: a cover with the map, the course at a glance, then one page a hole (three views across the top; the plan, how it plays, the profile and notes under them). `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page from the JSON list. |

Run them in that order. Output goes to `out/` (ignored by git).

`node emit.mjs` writes the playable course, `src/course/rimeholm.js`, from the same data (about 4 minutes): each
hole's ground sampled every 2 m from `worldAt` (so it meets its neighbours as the book draws them; open air for the
crevasses and the moulin) with the engine's surface codes and a paint byte (bare rock, travertine, rubble), the
green and bunkers as outlines over it (`features.js` `outline` + `keepGround`; bunkers play as `sand` by the greens
and `powder` in the fairways), seracs, ice blocks, boulders, the hall, the ice cave's roof and the ice bridge as
rocks the ball hits, the spruce as plants, and `COURSE.ice`: the glacier once in world space (a 10 m height map out
past the peaks, and everything drawn) for `src/course/ice-world.js`. Rerun it after any change here, then
`node --test tests/rimeholm.test.mjs` and `node tools/review/playthrough.mjs rimeholm --render=120`.

**Rework, 11 November 2026** (from `claude/brief-rimeholm-rework.md`, Rhys approved the proposal): the 2nd scalloped (pools left, right, left,
right up the terraces; `cant` per shelf leans each away from its pool), the 9th an hourglass with one first ramp to the shelf and
`groomed: 0.33` (its fairway keeps a third of the snow waves), the drops on the 1st and 5th starting at the back tee's pad, erratics
kept 22 m off every tee pad, bold targets on 5 and 9. A hole's `tips: [s, off, padH]` is its switched-off tips tee (Bear, in
`COURSE.tipsSet`); `emit.mjs` writes it as `tips: { tee, yards, pad? }` and `COURSE.tipsSet`, and `node tools/review/tips.mjs rimeholm`
checks the spots. Proposals are built in a scratch copy first (a git worktree of the repo), emitted and checked there, and shown to
Rhys before they go in.

