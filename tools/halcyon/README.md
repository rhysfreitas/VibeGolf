# Halcyon Ring: plan tools

Halcyon Ring is a course in planning (`claude/brief-halcyon-ring.md` in the project): parkland golf inside a ring
space station, a pristine garden colony. Floor windows onto space are the penalty area; the ball flies as on
Earth. Skeleton (Rhys's pick, 11 November 2026): par 35, 4 3 4 5 3 4 4 5 3, finishing with a par 3 across the
Great Window to the clubhouse.

Routing check (11 November 2026). Rhys's concept picks: R = 5 km, 900 m between the rims; the curve plays as it
looks; floor windows are glass and a penalty area (a stroke and a drop, like water); tees Zenith, Meridian, Horizon,
Nadir and the Kingfisher tips; decisions on 4 (bite off the Long Window), 7 (drivable round the spoke) and 8 (go or
lay up at the canal); classics Double Plateau 1, Eden 2, Road 3, Leven 7, Channel 8; landmarks the spoke, Earth
through the rim glass and the clubhouse, the reveal the Great Window from the 9th tee; late light with the air
handling's spinward breeze. He approved the routing ("move on to the next steps").

Plan book round 1 (12 November 2026): fairway and green shapes on every hole (forms fan, hourglass, hook,
scalloped, island, split: `node tools/review/alike.mjs halcyon` finds no pair alike), the checks, plans, profiles,
green diagrams, sketch views on the true cylinder and the book, `out/halcyon-plan-book-r1.pdf`. Changes from the
routing, all from the checks: the 9th moved 45 m north (the Great Window had overlapped the 8th green); the canal
runs behind the 8th tee and up the right of the valley; the 8th tee sits on the spoke's plinth; the 6th is The Long
Lake; the 5th tee stands on the high terrace's lip with a long lawn falling to the balcony, and the 9th's tees step
down on three terraces (10, 7 and 4 m), each 3 m short of its lip, because the game's camera saw nothing of the
balcony or the window from a tee set back on a terrace; the 9th is 150 yd (the par 3s play 174, 214 and 138); the
7th's forward tees moved right of the line so the spoke's foot doesn't hide the landing area.

Plan book round 2 (12 November 2026), from the two addenda of that day (height forms; dials, set pieces and
shots; `claude/brief-addendum-height-forms.md`, `claude/brief-addendum-dials.md` in the project). A proposal went
first (`proposal/`, `out/heights/halcyon-dials-and-heights-proposal.pdf`) and Rhys picked every change: a height
form on every hole, none twice (half-pipe 1, uphill par 3 2, tee drop 3, stepped 4, drop par 3 5, hillside bench 6,
table top 7, perched green 8, a par 3 across a gulf 9; bold 4, 6, 7); one dial pushed on every hole (the 1st's
90 m lawn, the 2nd's 290 m² postage stamp at 115 yd, the 3rd's eleven bunkers with the church pews, the window's
scale on 4, the 230 yd 5th, the 6th's 10% bench, the 7th's 1,400 m² green past real golf, the 8th at 490 yd and
reachable, no bunker on the 9th); set pieces the postage stamp and the church pews; the 9th's window sunk in an
amphitheatre 8.5 m deep with tee and green level on its rims; the 7th up onto a table top 7.5 m high round the
spoke, whose foot moved 30 m west; the shots asked for and the hazard and surround kinds on each card. Zenith
3,105 yd, Kingfisher tips 3,345. `spread.mjs halcyon` finds no cluster, `relief.mjs halcyon` flags nothing,
`alike.mjs halcyon` 0 of 15. The book is `out/halcyon-plan-book-r2.pdf`.

Plan book round 3 (12 November 2026), from Rhys's notes on round 2: the rim glass, a 24 × 130 m strip of floor
glass beside the 5th's balcony, read as an anomaly; he asked for "a full glass ring all the way around either side
of the station" with "decent supports". Now `RIM` in `world.mjs`: a band of glass 24 m wide along the foot of
each rim wall all the way round, flush with the rim's ground (9 m), segmented every 120 m by a beam on each of the wall's ribs (round 5: first arched ribs every
60 m, then 120, then Rhys found them too busy), and a sill where the floor glass meets the wall; ground higher than the band ends in
a retaining wall at its edge. The long lake's west shore moved in off the glass (the rim walk between), the
balcony rose 7 m so it stands 8 m over the glass (the 5th now drops 15 m), and the 3rd's tips tee came 17 m behind
its back tee. The 1st's green had come out as two pieces with the pin between them; it is one green now, and
`sample.mjs` flags a green in pieces or a pin less than 3 m inside its edge. Rounds 4 and 5 the same day, from his notes: the supports
halved and put on the wall's ribs, then the arches taken out ("too busy") for flat beams across the glass on the
wall's ribs and a sill along the wall's foot; the lake's head back behind the 5th green; the postage stamp kept.
The book is `out/halcyon-plan-book-r5.pdf`.

Run order for the book: `node sample.mjs` (about 20 s), `python3 plans.py`, `node sketch.mjs` (a few seconds),
`node book.mjs` (`ROUND=n DATE='…' NEW=new.json` optional).

| Step | What it does |
|---|---|
| `world.mjs` | The floor in ring space (`a` across, east +; `s` along, north/spinward +; plan X = a, Z = -s): the rims at a = ±450, the day/night line (`TERMINATOR`, the night side south of it), villa terraces toward each rim (`PLATEAUS`, eased edges, applied in order; `fall: [s0, y0, s1, y1]` tilts a top along the ring), the 9th's amphitheatre (`bowl` and its steps), the floor windows (`WINDOWS`: the Long Window on 4, the Great Window on 9), the rim glass (`RIM`: a band along the foot of each rim wall, beams every 120 m on the wall's ribs, a sill at the wall), the long lake along the west side, the canal with its lock and aqueduct, the spoke's A-frame foot astride the 7th, the clubhouse, the tram stop, the 8th's valley. `curveRise(s, s0)` is the curve's lift from a hole's low line. |
| `holes.mjs` | `COURSE` (tee sets, the Kingfisher tips set switched off, the course card `card`) and `HOLES`: each hole from `legs` in its own frame, `place: { at, heading }` on the floor, tee spots, the tips spot (`tips`, default 34 m behind on par 4s and 5s, 14 m on par 3s) and its hole card (`card`: story, type, form, feature and job, decision, miss map, tee view, ground). |
| `scene.mjs` | Each hole built in its own frame (`buildHole`): ground = the floor (`H`) + the curve from its back tee + the shared landforms + its cant and ramps near the line, the green levelled to the pin (a shelf cut into the curve), `pipe: [[s0, s1, height, halfWidth]]` (embankments rising (|off|/hw)^1.5 to `height` either side, the line unchanged), `levels: [[s0, s1], ...]` (terraces levelled at the line's mid-height with banks between), bunkers carved in, tee pads (`padL` shortens them so one stops short of a lip; a pad never blends down over a drop); `surface` (fairway, rough, the native park, woods only 70 m or more off the line, gardens, plaza, terrace walls, water, window); trees, villas, walls, the spoke's feet, the footbridge and the falls as objects and solids. `worldAt` is the floor between the holes for the map. |
| `shapes.mjs`, `greens.mjs` | Fairways (ribbons `{ e }`, free shapes `{ lobes }`, cut-outs `{ bite }`), greens from lobes with designed contour, green stats and leans (as `tools/lostvalley/`). |
| `node sample.mjs` | The checks (`out/grid/checks.txt`, `!` marks a failure): yardages, tees off fairways, tips pads, drives from every tee set (landing widths), the bold lines, bunkers touching the fairway, green size, contour and pins, leans (the church pews' rungs count as one hazard), par 3 spread, and the tee view through the game's camera (3.2 m behind the ball, 1.55 m up: each tee set's target in sight, or the flag on a par 3, and how much of a floor window shows; walls, villas and the spoke block the view). Writes the grids for the plans and the map. |
| `python3 plans.py` | One plan, profile and green diagram a hole, and the course map (`out/map.png`, north to the right). White pages. |
| `node sketch.mjs [holes]` | Three views a hole (back tee, landing area or forward tee, short of the green), 5 m up, on the true cylinder: the hole's own ground near the line, the floor beyond climbing up the frame, rim walls of glass with ribs, Earth, the spoke, the aqueduct, villas, trees, the windows with stars under the glass. `out/views/`. |
| `node heights.mjs` | Along-line and across profiles of each hole to `out/heights/<tag>.json`; `proposal/profiles.py` and `proposal/book.mjs` draw now-against-proposed pages from two of them (how the round 2 proposal was made). |
| `node book.mjs` | The plan book PDF: cover map, course card, the course at a glance, one page a hole (hole card, views, plan, words, checks, profile, green). |
| `node routing.mjs` | The routing check: yardages, spacing between hole lines, walks, the curve's lift on each hole, the windows, spoke, canal and lake against the lines, the 4th's bold line and carry, the 9th's carry from each tee, and which landmarks are in each back tee's fixed view. Writes `out/routing.json`. |
| `python3 routing.py` | The routing map (`out/routing-map.png`, white page, north up). |
| `node ring-sketch.mjs` | Concept sketches of the ring through the game's fixed tee camera, for choosing the radius: across the ring (a par 4) and up the curve (a par 3 over a floor window) at R = 1.5, 3 and 5 km, and the Great Window from a tee on the floor and from one raised 14 m. Ring space is `a` across (the axis), `s` along (arc length), `h` up; the floor is a cylinder of radius R, 1 km wide, with villa terraces rising 46 m at each rim and glass rim walls 320 m tall. Writes `out/ring-*.svg` and `out/ring-sheet.png`. Seconds. |

What the sketches showed (11 November 2026):

- Seen from the floor, the ring floor at arc angle φ sits φ/2 above level, so the tee camera (19° up at most)
  sees the floor out to φ = 38°, 0.66 R along the ring. The far side overhead never shows in play.
- Across the ring the view is the same at any radius (level ground to the far rim's glass). Up the curve, the
  radius sets how wide the land looks between the rim walls: a broad valley at 1.5 km, a narrow channel at 5 km.
- A floor window is nearly edge-on from a tee on the floor (1.55 m eye height): a white sliver, no stars. To see
  down through one, the tee must stand above it (14 m up and it reads as a pool of space).
