# Review tools

Headless tools for checking a course against `docs/COURSE-DESIGN.md` and for making review books. They
work on any course module (`aerie`, `redmesa`, `hollowmere`) and serve the site straight from the repo, so
no web server is needed. Output goes to `tools/review/out/` (ignored by git).

| Tool | What it does | Time |
|---|---|---|
| `node tools/review/analyse.mjs <course>` | Each hole against the rules: height change, bends (+ = right), carries, fairway width where a drive lands, what surrounds each green, steep steps beside fairway, targets | seconds |
| `node tools/review/drives.mjs [course...]` | Tour, medium and shorter drives from the back and second tees at each par 4/5's first target, with the game's physics. Catches walls and water in the landing area | seconds |
| `node tools/review/sample.mjs <course>` then `python3 tools/review/plans.py <course>` | A plan of each hole (tee at the bottom, surface colours, hillshade, 2 m contours, targets) with its profile. Red marks a step of 3 m or more within 8 m of short grass: the plateau check | seconds |
| `node tools/review/views.mjs <course> [holes] [--only=tee,land,green] [--pose=...]` | Clean in-game renders from the back tee, the landing area and short of the green, plus any extra pose | 1–2 min a hole |
| `node tools/review/playthrough.mjs <course> [holes]` | Plays each hole on auto-aim at phone size and logs the lie after every stroke. A hole that never finishes is a layout bug | 3–8 min a hole |

Renders use software WebGL, so they are slow and share two CPUs: run the browser tools in the background,
one at a time, and don't run them next to a long test. If the bundled Chromium shows a black page, set
`CHROME=/usr/bin/google-chrome`.

Hollowmere's plan book (yardage plans, sketched views, the round-by-round review PDFs) was made with
`tools/hollowmere/` plus scratch scripts in the same spirit as these.
