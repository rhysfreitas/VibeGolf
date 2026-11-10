# The Reclaim: plan book tools

The Reclaim is a course in blockout (`course.html?c=reclaim`): nine holes through a ruined city that nature has taken
back, about twenty years after everyone left. Misty overcast morning. These tools make its plan book
from one set of hole data, so the plans, profiles and sketch views always agree.

| Step | What it does |
|---|---|
| `holes.mjs` | The hole data (a fairway piece is `[s0, s1, w, off]` or `{ e: [[s, L, R], ...] }`, its edges' distances from the line at knots; a green has `lobes`, an `engine` style and extra `pins` in its own frame): legs, profile, cant, fairways, green, bunkers, water, rubble, the rift, buildings (broken tops, the Atrium's open floors, the leaning clubhouse), the El, the fallen span, the stadium, the bridge, targets and the words for the book. Each hole in its own frame, placed in the city by `place`. |
| `scene.mjs` | Ground, surfaces and solid things per hole (pure), the river, the world transform and the city blocks between the holes. |
| `node sample.mjs` | Grids for the plans, profiles along the line (and the bold line), drives flown with the game's physics (`src/physics.js`), the world map, and checks (drive hits, holes running into each other's buildings). |
| `python3 plans.py` | Plan and profile per hole, and the course map (white pages). |
| `node sketch.mjs [holes]` | The projected sketch views: plain shapes through a real camera, ink and washes, misted with distance. Seconds per view, no WebGL. `hole.sketch` tweaks a view (`up`, `fov`, `eye`). |
| `node book.mjs` | The PDF (`out/the-reclaim-plan-book-r<ROUND>.pdf`), printed with Chrome. `ROUND=2 NEW=rounds-r2.json node book.mjs` adds a "new in this round" page: each hole's `sketch.extra` feature views and the change list from the JSON. |

Run them in that order. Output goes to `out/` (ignored by git).

`node emit.mjs` writes the playable course, `src/course/reclaim.js`, from the same data: each hole's ground
sampled every 2 m into a field, the green and bunkers as shaped features, the buildings, the El, the fallen
towers, chunks and cars as rocks the ball hits, the trees as plants, and the city once in world space for
`src/course/city-world.js` to draw. Rerun it after any change here, then `npm test` and
`node tools/review/playthrough.mjs reclaim`.
