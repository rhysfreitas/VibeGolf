# Review tools

Headless tools for checking a course against `docs/COURSE-DESIGN.md` and for making review books. They
work on any course module (`aerie`, `redmesa`, `hollowmere`, `reclaim`) and serve the site straight from the repo, so
no web server is needed. Output goes to `tools/review/out/` (ignored by git).

| Tool | What it does | Time |
|---|---|---|
| `node tools/review/analyse.mjs <course>` | Each hole against the rules: height change, bends (+ = right), carries, fairway width where a drive lands, what surrounds each green, steep steps beside fairway, targets. Then the outline checks (`outlines.mjs`, from the shape review): the green's size, depth against width, how close it is to a plain oval and its angle to the approach (L/R); fairway width along the line and how much it changes; each bunker's size, job and whether it touches the fairway; the fairway where each tee set's drive lands (toward its first target, as auto-aim plays); and for the course, green styles, angled greens each way and the par 3s' plays-like spread. Lines starting `!` break a rule | seconds |
| `node tools/review/drives.mjs [course...]` | Tour, medium and shorter drives from the back and second tees at each par 4/5's first target, with the game's physics. Catches walls and water in the landing area | seconds |
| `node tools/review/sample.mjs <course>` then `python3 tools/review/plans.py <course>` | A plan of each hole (tee at the bottom, surface colours, hillshade, 2 m contours, targets) with its profile. Red marks a step of 3 m or more within 8 m of short grass: the plateau check | seconds |
| `node tools/review/slots.mjs <course> [holes]` | Slots: narrow trenches to the floor where two islands meet without overlapping, with playing ground on both sides (a ball falls in). Some are meant (the tip of a canyon you carry); look at each | under a minute |
| `node tools/review/views.mjs <course> [holes] [--only=tee,land,green] [--pose=...]` | Clean in-game renders from the back tee, the landing area and short of the green, plus any extra pose | 1–2 min a hole |
| `node tools/review/playthrough.mjs <course> [holes] [--render=N]` | Plays each hole on auto-aim at phone size and logs the lie after every stroke. A hole that never finishes is a layout bug. `--render=120` renders every 120th step instead of every 6th: the same golf in about a tenth of the time | 3–8 min a hole (under 1 with `--render=120`) |
| `node tools/review/games.mjs [game ...] [--only=play,clean,wide,flight,land] [--tag=x]` | Renders of the mini games for an art review: the play view with its UI, the same view clean, a wide view (the camera held a few metres back and up), the ball in flight after an Ideal shot and the payoff a few seconds later. Writes `out/game_<game>_<view>.png`; `sheet.py --files` makes a sheet of them | about 1–2.5 min a game |
| `node tools/review/quickplay.mjs <course> [holes] [--seeds=3]` | A play-through with the game's physics and no browser: from the back and forward tees, each stroke picks its target as auto-aim does, solves the club and swing length and hits it with a decent amateur's miss; two putts on the green, a stroke for the void or water. Skips lie costs, stances, branches and wind, so it's a check, not the game: use it after any layout change, and `playthrough.mjs` for the holes that changed | 1–2 min a course |
| `python3 tools/review/sheet.py <course> [holes] [--views=tee,land,green]` | A contact sheet of the views.mjs renders on a white page, captioned. `--files a.jpg b.jpg ... --title=...` makes one of any images (a mood board of references, a before/after) | seconds |
| `node tools/review/seethrough.mjs <course> [holes] [--only=...]` | Holes in the world: each view with sky, clouds and fog off on magenta; counts what you can see through looking down (a dropped playfield cell, a missing wall, a chasm with no floor) and writes a mask with the gaps in red. Not for the Aerie (open sky below is the design) | about 1 min a view |
| `node tools/review/pick.mjs <course> <hole> <tee\|land\|green\|pose> <x> <y> ...` | What's at a pixel of a 1280x720 render: the meshes a ray meets (material, colour, texture, instance) and what the terrain says is there, or background where you see sky | under a minute |
| `node tools/review/perf.mjs <course> [holes] [--vs=<ref>] [--top=5]` | What a hole costs from its back tee: meshes, triangles, a real frame's time at 844x390, the heaviest meshes. `--vs` measures another commit (a temporary worktree) the same way and prints both | 1–2 min a hole |

Renders use software WebGL, so they are slow and share two CPUs: run the browser tools in the background,
one at a time, and don't run them next to a long test. If the bundled Chromium shows a black page, set
`CHROME=/usr/bin/google-chrome`.

Hollowmere's plan book (yardage plans, sketched views, the round-by-round review PDFs) was made with
`tools/hollowmere/` plus scratch scripts in the same spirit as these. An art pass uses sheet, seethrough,
pick and perf; the steps are in `docs/ART-PASS.md`. `page.mjs` has the shared pieces: `openCourse`,
`viewPoses` (the three review views of a hole), `goHole`, `setPose`, `hideMarkers`.
