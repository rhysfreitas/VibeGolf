# tools/cloudrest: Cloudrest's plan tools

Cloudrest is the "roof of the world" course: holes cut into the sides of a misty green gorge, a cliff monastery in
the far wall, the ball flying about 10% further in thin air. The design is `claude/cloudrest-layout.md` in the
project (approved 15 November 2026); the job is `claude/brief-cloudrest.md`. Nothing is in the game yet.

## Round 0: thin air, the wall and the mist (15 November 2026)

Numbers for Rhys before anything is drawn.

- `air.mjs [altFt] [tempF]`: a quick table, club by club, of carry, peak height, a stock slice and wind drift at an
  altitude against sea level; with no arguments, a sweep of the driver's carry gain against altitude.
- `air-data.mjs > out/air.json`: every number in the proposal (the bag, flight paths, the altitude sweep, the
  temperature settings, the other courses' altitudes, the highest shots against the alcove's roof, the run on today's
  fairway against a proposed damp turf, and 4,000 drives at a shelf's wall under five wall models).
- `air-sheets.py`: draws `out/cloudrest-thin-air-r0.pdf` from `out/air.json` (four white A4 landscape pages).

What the numbers say:

- Altitude is already in the flight model (`COURSE.altFt`, through `airDensity` in `src/physics.js`; Red Mesa sits at
  5,200 ft and carries 8% further). A tour driver carries 10% further at 6,600 ft (72°F, density 0.93 against 1.19);
  an amateur's driver (140 mph ball speed) needs 8,500 ft. Short irons gain more (12%), the sand wedge less (9%).
- Thin air lands the ball flatter (a driver at 33° not 42°), so on today's fairway a drive runs 32 yd, not 17: +15%
  in total. A damp turf (`mu 0.42, eScale 0.92, tScale 0.65, crr 0.19`) brings it back to 21 yd. Proposed, not built.
- A cliff that is part of the ground knocks a ball back a quarter of its speed; 4% of those that hit it rolled back
  across a 62 m shelf into the mist. A wall that soaks (0.45, The Reclaim's facades) drops 73% at its foot and sends
  none to the mist; a kerb at the outer edge stops the rest.
- The highest shot the game sees is a skied driver, about 86 m up in thin air; any iron tops out under 53 m.

`out/` is ignored by git.

**Rhys's picks (15 November 2026):** 8,500 ft (an amateur's driver +10%, a tour driver +12%, short irons +15%);
damp turf (physics.js 'damp', retuned for 8,500 ft: mu 0.44, eScale 0.90, tScale 0.62, crr 0.21; a tour drive runs
20 yd, against 40 on fairway there and 17 at sea level); walls that soak (`COURSE.wallSoak` 0.45 → physics.js
`wallSoak`); and instead of a plays-like figure, the course readout's top line now shows the lie and the air as they
change the selected club's carry, on every course (`distEffects` in main.js). `air-data.mjs` now runs at 8,500 ft;
the round-0 PDF was drawn at 6,600 ft, before his pick. His four reference screenshots (a cliff monastery on a
forested crag, a misty pinnacle, a cliff temple's wall) are kept in `out/refs/` for the art pass, not in git.

## Round 1: the plan book (15 November 2026)

The approved routing and hole cards drawn: `node sample.mjs` (about 4 minutes), `python3 plans.py`, `node sketch.mjs`
(about 6 minutes; `node sketch.mjs 3 9` for some holes), then the review tools into `out/review.txt`
(`cd ../review && { node relief.mjs cloudrest; node alike.mjs cloudrest; node spread.mjs cloudrest; } > ../cloudrest/out/review.txt`)
and `node book.mjs` → `out/cloudrest-plan-book-r1.pdf` (white landscape pages; `ROUND`, `DATE` in the environment).

- `world.mjs`: the gorge in world space (metres; x east, -z north): `LINES` (the layout doc's playing lines), the two
  cliff edges and the cleft (open air between: `V` returns null, the mist at `MIST` 150 m), the Needle and the
  pinnacles, the Broken Ridge (`ridgeAt`: spine, flanks, catch shelf, kerbs, `NOTCH`), the floor as an RBF through
  `FLOOR` controls laid along the lines, the 9th's tiers (`DESCENT`, `LIP1`: the first bank, at the tee's lip),
  `WALLS` (cliff faces as offset polylines with a height and a slope behind; `thick` makes a fin, as the alcove's),
  `ROOF` (the alcove's overhang), kerbs (`kerbAt`: a 1.6 m lip of rock along every outer edge, none across a par 3's
  carry or in front of a green), the stream and the two pools, `SITES` (the built and sacred things as boxes).
- `holes.mjs`: the course card, tee sets (Summit, Ridge, Ledge, Terrace; the Pinnacle tips switched off), each hole
  in its own frame from its world line (`route`): fairways (`fw`: ribbons `{ e }`, free shapes `{ lobes }`), `prof`
  knots along the line, `cross` banks (`[s0, s1, h, w, flat]`), the 8th's `terrace`, `flat: 0` for holes whose
  ground is the world's own (4, 5, 7, 9) with a `ceil` where it must be no higher (the 4th's lip, the 5th's approach),
  the 6th's `ramp` (the neck up the face), greens, bunkers, targets (`bold: true` on 5, 8 and 9), words and card.
- `scene.mjs`: each hole's own ground and surfaces, `worldAt` (the holes blended, walls and kerbs added after so a
  wall stays sheer, open air null), the pines (scenery for now), `BUILT` (each hole read through `worldAt`).
- `sample.mjs`: grids, profiles, cross sections, drives flown with the game's physics (8,500 ft, damp turf, walls
  that soak 0.45, the mist as `voidY`) and the checks (`out/grid/checks.txt`, a line starting `!` breaks a rule):
  pins, tees, overhead (the roof), tips, landing widths, greens, leans, par 3 plays-like, the fixed camera's view from
  every tee set, blind shots, the wall, the kerb, the roof, the face, the crest and the notch, the tiers, the
  terraces, the carries, the pinnacles, walks, the golden roof.
- `plans.py`, `sketch.mjs`, `book.mjs`: the book (it reads JPEG copies of the views, plans and map: `out/*.jpg`, made from the PNGs as in the snippet at the top of `book.mjs`). `round1-notes.json`: what moved from the layout doc and what is
  open, page 3.

## The blockout (16 November 2026)

Rhys on round 1: "This looks really great. I would say build it" (no preference on the open questions: built as the
book draws it). `node emit.mjs` (about a minute) writes `src/course/cloudrest.js`; don't hand-edit it. Each hole's
field is sampled every 2 m from `worldAt` with open air stored as gaps (terrain.js reads a gap as no ground: a ball
over an edge falls and it's a cloud drop), engine codes (fairway, fringe, tee, rough for mountain grass, scrub and the
tea rows, native 'desert' for rock, the kerbs and the courtyard's paving, sand, water with a 0.8 m bed) and a paint
byte (0 rough, 1 scrub, 2 rock, 3 kerb, 4 tea, 5 paving, 6 sand, 8 water, 10 mown, 255 open air). The cliffs are part
of the field's ground, so `COURSE.wallSoak` soaks a ball that flies into one. The monastery's halls, the stupa, the
gate house, the prayer-wheel house, the cairn and the courtyard's walls are soaking boxes; the balcony's parapet
throws a ball back; the alcove's roof is slabs of rock 80-90 m up along the 7th (`ROOFBOX`); all `draw: false`.
`COURSE.cloud` is the gorge once: a 10 m map over the course and a 40 m one out to 5 km (gaps for open air), the
mist's level, the built things, the pines, the roof. `src/course/cloud-world.js` draws it (blockout): the ground in
the shader's `CLOUD` branch, cliff faces from every edge down past the mist, the mist sheet with a thinner layer
over it, water, the boxes under red and gold roofs, the roof slabs, the pines as cones. The notch's far side became
a slope of scree and the 5th's lay-up moved to 210 m (the gate's player was stuck under a sheer far face).
`tests/cloudrest.test.mjs` checks the course.

After Rhys's first round (16 November 2026): the Descent played too short (a tour 5 iron reached the green from
the Summit tee). The Summit tee moved 55 m back onto a knoll 8 m up behind the top terrace (`KNOLL` and `knollAt`
in `world.mjs`), so it still sees the first tier: 435 yd on the card, 342 yd straight at the green and 54 m down.
`sample.mjs` treats a drive along the line that lands on the bank below the first tier as lay up or go (as at the
5th's notch), and pines keep off the ground behind each line's start and off the 9th's bold line (`TEELINES`).
