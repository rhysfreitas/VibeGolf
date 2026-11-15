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
