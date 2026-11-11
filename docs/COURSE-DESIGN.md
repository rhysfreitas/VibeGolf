# Course design: how we lay out a course

Lessons from building the Aerie, Red Mesa and, above all, Hollowmere (three rounds of markups with the
owner). Read this before laying out a new course; CLAUDE.md has the short version.

## The process that works

1. **Plan first, on paper.** A yardage-book PDF on white pages: the plan of each hole, its side view,
   how it plays and what it's for. Discuss the direction before producing a PDF. Ask design questions as
   multiple choice, with a recommended option.
2. **Then a blockout in the game**, and a review book of it. Each hole page has three views from the game
   (from the back tee, from the landing area or, on a par 3, from the forward tee, and from just short of
   the green), the plan with the elevation profile under it, a short "what you're seeing", and ruled
   lines for notes. A "new this round" page of feature views goes after the cover. Lift the shadows for
   print, and keep the pages white.
   For a first round, projected sketches are quicker than a blockout: simple shapes from the plan data
   through a real camera, inked as SVG (`tools/reclaim/sketch.mjs`, seconds a view), with the cameras a
   few metres up so the ground reads. Build the engine blockout once the layout settles.
3. **Iterate in rounds from the owner's markups.** Every markup gets done or answered, and the reply
   lists what changed hole by hole. When the owner asks for suggestions, offer three or four concrete
   options and let them pick. Reference photos are gold: match them closely (the cenote and the geode
   landed because they followed the pictures).
4. **Check from the player's eye.** Renders of the three views catch what the plan can't: floating
   geometry, cliffs beside a green, a view that hides the shot. The plan catches the rest: a dogleg that
   goes the wrong way, water that doesn't join up, a tee on a fairway.
5. **Then the art pass**, once the layout is agreed: references (the owner's photos, or an art brief
   researched and written when there are none), the direction agreed in four picker questions, a build,
   and a check of every hole. The steps, techniques and tools are in `docs/ART-PASS.md`.

## Shape

- Vary the shapes: doglegs both ways, a cape, an S-bend, a drivable par 4, a par 3 over water, a blind
  uphill par 3. Straight holes only now and then.
- **Check a dogleg's direction from the geometry, not the label.** The sign of the cross product of the
  two legs (with x east and z south, positive is a right turn). The Cenote was once labelled one way and
  built the other.
- A drivable par 4: about 280 to 300 m straight from a raised tee to the green, a safe way round, and a
  bold line that really works (simulate a tour drive through it in a test).
- Forward tees go on their own pads beside the fairway, at least 12 m clear of it, never on it.
- A floor-to-roof feature in front of the back tee (a column, a fin) segments the tees and makes the
  back-tee shot think.
- **Vary the outlines of greens and fairways (agreed with the owner, Rimeholm round 2).** No plain circles,
  ovals or constant-width strips: they read as placeholders. Give each green its own shape and size (a
  kidney, a peanut, a crescent, an L, a long thin diagonal, a clover, a T; roughly 450 to 750 m²), with an
  uneven edge and the pin well inside a lobe, never in a waist. Let each fairway's two edges vary on their
  own along the hole: swell where drives land, pinch between landing areas, scallop along the edges, and
  let bunkers, crevasses and rocks bite in. Splitting a fairway now and then is good. Keep the 45–65 m
  width where drives land and pins at 3% or less. Rimeholm's `tools/rimeholm/shapes.mjs` (`makeGreen`
  from lobes, `makeFairway` from edges along the line) is one way to build them; in the engine a green takes
  `lobes` (the same format) and a painted fairway a half-width per point.
- **Leave room for a tips tee (agreed with the owner, 10 November 2026).** Every course will get a fifth set
  of tees behind the back set, at tour length: about 7,200–7,400 yd for 18, so 3,600–3,700 yd a nine (today's
  back tees run about 3,300). Design for it from the plan: ground behind each back tee for a pad 20–50 yd further
  back on the par 4s and 5s (a par 3 can stretch less), not a cliff, a wall or another hole's green; the landing
  areas and their hazards still working for drives that carry 280–300 yd (fairways wide enough there, bunkers and
  carries that matter from the tips without taking the landing area under 45 m); nothing overhead within 45 m of
  that pad either; and the pad off the fairway, like every tee. Sketch the tips spot on the plan even before the
  tee set exists, so adding it later is data, not a redesign.
- **Fairway bunkers on the larger side (agreed with the owner, Rimeholm round 3).** Out where drives land,
  a bunker 25–40 m across, or a long one that follows a fairway's edge for 100 m or more, reads as a real
  hazard; a 10 m dot reads as a placeholder. Let them bite into the fairway's edge without taking the landing
  area under 45 m. Greenside bunkers can stay small, and sit at least 2.5 m off the green.
- **Cliff and shelf edges wander.** A ridge, shelf or scarp seen across the hole should never be a straight
  line or a regular zigzag: give its edge bays and prows tens of metres long with smaller crags inside them,
  vary the height of its face and break its crest. Rimeholm's `crag` scarps (`tools/rimeholm/shapes.mjs`) do
  this with noise at three scales.
- **Make chasms and crevasses read from the tee.** A plain dark slit is easy to miss. Give them a jagged
  outline, a raised lip on one side (a broken face a few metres high), walls you can see down into, and
  more of them as scenery between the holes, layered into the distance.

## Greens, fairways and bunkers (the shape review, 10 November 2026)

From measuring all four courses (31 of 36 greens were plain ovals, most fairways capsules of one width) and
from how real architects size, angle and guard greens. `tools/review/analyse.mjs` measures each of these.

- **Angle the greens, and balance them across the nine.** Most greens a little deeper than wide (about
  1.2:1 along the approach; bogey players need about 20% more depth than width). Across nine: two or three
  angled left, two or three right, one or two straight on, one near 45° for a short approach, and one shallow,
  wide green on the longest par 3 or 4. Long approaches stay near the line; short ones can turn more (about
  1–3° per club). An angled green is what makes one side of the fairway better than the other.
- **Design each hole from the green back.** Pick the green's angle and the side its main bunker or hazard
  guards first. The green's open side decides the better side of the fairway: put the fairway hazard on that
  side, biting into the edge, so the good angle costs a risk and the safe side leaves a harder approach. Not
  on every hole: keep only a few real bold-or-safe choices.
- **Flowing lines, not squiggles.** Vary a fairway's width at the scale of the hole: swell where drives land,
  pinch between landing areas or where a hazard bites in, over stretches of 40–80 m, the edge following the
  ground. Small jags only on natural edges (rock, a crevasse, rubble). Along a par 4 or 5 the width under the
  line should change by at least 30%. The rough line varies too, coming in where the hole wants to be hard and
  backing off where it doesn't; no constant collar of rough round the fairway.
- **Shape the fairway's ground, not just its outline.** Landing areas a little flatter where drives come to
  rest, rolls between. Give each par 4 and 5 one contour that matters: a spine down the fairway (a hog's back)
  that kicks a missed line away, a cant against the shot you want to play (reverse camber), a speed slot, a
  crest, a swale, or a slope that feeds the brave line toward the green's open side. Keep contours broad
  (15–40 m from crest to crest, under about 4% where drives land) so they move the ball rather than bounce it
  at random.
- **Bunkers each have a job.** Every fairway bunker is a carry bunker (short of the landing area, on the side
  with the better angle in), a target bunker (beyond it, so long hitters play up to or past it), an approach
  bunker (40–90 m short of the green on par 5s and long par 4s) or a catch bunker (between short grass and real
  trouble). Each one touches or bites into the fairway; a bunker out in the rough does nothing. No two holes on
  a course use the same bunker pattern. Greenside bunkers are the linchpin: their side decides the rest. Don't
  put a carry bunker close to the tee (it punishes the weakest players twice).
- **Pot bunkers are sunk, not rimmed.** A pot is a small (3–5 m), deep hole cut into the ground: a steep,
  revetted sod face toward the green, a flat sand floor, the back easing in from grade so you can walk in.
  No raised lip round it; only flashed bunkers build a lip up their face.
- **A punchbowl is sunk into level ground, not rimmed.** The ground stays level up to the bowl, then banks
  fall about 1.2–1.5 m to the green and feed a near miss in. Nothing stands above the land round it: the
  engine's punchbowl once built a 1.6 m ring outside the green, which read as a donut (Rhys spotted it on
  Drift). A rim belongs only to a feature that has one (the Geode's cracked shell).
- **Check the landing area for every tee set.** For each tee set, the drive (its `minDrive`, or about 150 yd
  for the forward set) lands on fairway at least 40 m wide. On long holes a staggered landing area for the
  forward tees is fine.
- **Variety across the nine.** No more than three greens of one style on a course. Par 3s at least 25 yd apart
  (plays-like) and facing different ways. Where it fits, one classic fairway idea per course: a hog's back, a
  reverse camber, a split fairway, a speed slot.

## Side slope and green contour (agreed with the owner, 10 November 2026)

Rhys noticed the courses had plenty of up and down but fairways level from side to side, and greens that
were interesting only in outline (and the punchbowls). Measured on Emberfell round 2: fairways tilted
0–0.8% across on average, three greens dead flat, three a single 1–1.5% plane, one tier on nine. Real
courses tilt far more. The rules, and the numbers behind them:

- **Most fairways lean.** On most par 4/5 landing areas the ground falls 2–5% across the line, and the lean
  has a purpose: the high side gives the better angle in (a ball on the low side kicks toward the rough or a
  bunker and leaves the harder approach), or a reverse camber leans against the shape the hole asks for (a
  dogleg left that leans right). Vary which way across the nine. A hole that's already hard leans away from
  its trouble (toward safety or into a catch bunker), never toward a penalty.
- **Now and then, a strong one.** Once or twice a nine, a side slope of 6–8% across the landing area: a
  sidehill fairway along a hillside, the ball above or below your feet for the second. Keep it under about
  7% on a level landing area, 4–5% where the fairway also runs downhill (it adds roll), and give the low
  side a wide rough or a catch bunker so the slope sets the lie rather than the score.
- **Lean the ground, not just the line.** A lean runs 60–120 m along the hole and right across the fairway
  into the rough, blending out beyond; it moves the ball, it doesn't bounce it. The flatter "landing
  plateau" idea still holds for where most drives stop: a lean of 2–3% there, more just short of or past it.
- **Greens: moderate, like a modern course.** Overall fall about 1.5–2.5% (today's greens average about 2%;
  classic greens 3% and more). Most greens (six or seven of nine) also get one internal feature: a tier
  0.3–0.6 m high with a slope of about 1 in 6 to 1 in 7 between, a spine or ridge that splits it, a swale
  across it, a bowl that gathers to one pin, a back shelf, a crown that sheds the edges. A couple can be
  flatter (just the fall), and one bold green a nine is fine (a bigger tier, a Redan's fall, a Biarritz
  swale). Mix the features across the nine; no two neighbouring greens the same.
- **Pin areas stay puttable.** Three or four pin areas a green, each about 10 m across or more at 3% or less
  (tested); steeper ground goes between them and round the edges (ridges up to about 0.6 m at 10–15% where
  pins never go). Pins 1–1.5 m or more off a tier's top or foot. A green needs only 14–21 cup spots, so
  it can afford the contour.
- **The game already reads it.** The slope under the ball changes every shot (ball above the feet pulls
  left, uphill launches higher), and putting odds read break, tiers and downhill speed, so these play.
- **Measured, not eyeballed.** The book tools (`tools/emberfell/sample.mjs`) and `tools/review/analyse.mjs`
  report each landing area's cross slope and each green's fall, relief beyond its plane and pin areas.

Sources: golfcourseindustry.com "Modern green contours" (pin areas 3% at Stimp 10, greens about 2% now,
perimeter ridges to 2 ft at 10–15%); golfnewsstoriesonline.com "How much cup space does a green have?"
(14–21 cup spots, a 1 ft tier at 5–7 to 1 across 50–70 ft, pins 3–5 ft off a tier) and "Using fairway
slopes for strategy" (cross slopes to about 7% on level zones, 4–5% when also downhill).

## Elevation and slope

- **Every hole goes up or down.** Several holes 8–15 m, two or three big ones (25–35 m: a drive off a
  ledge, a climb to the last green). Never a run of flat holes.
- Within holes, use tilted fairways (a cant toward trouble), terraces (rimstone banks), crests with blind
  shots, raised greens with false fronts, punchbowls and bowls that gather the ball.
- **Build elevation from the floor and wide landforms, not raised slabs.** An island slab stands as a
  cliff wherever its edge isn't buried in a wall: the owner read these as "weird drop-offs and
  plateaus". Use a wide `step` landform (a ramp spanning wall to wall, with `run` to stay up) to climb
  or drop, `mound`s for knolls and blind crests, `tilt` for cants. Keep islands for real ledges (a tee at
  a lip looking down) and for rock.
- **The ground round fairways and greens can move, but no accidental plateaus.** Gentle banks, rolls
  and a slope up to a wall are fine. Avoid sharp rises or plateaus along the edges of lots of fairways
  and greens: a raised shelf beside the short grass, or a green on a table with drops on every side.
  These usually come from a slab or a ramp that ends short of the wall, not from a decision, and the
  owner reads them as weird drop-offs. Fix the shape instead of leaving it. A plateau is fine as a
  thought-out feature on one hole, chosen for how it plays (a raised green with a false front, the
  5th's blind shot over a mound), with a rim or bowl where a near miss should stay at green level.
  Ask of each one: did we mean this, and does it make the shot better?
- A ramp that spans wall to wall climbs without kicking the ball toward water or a wall.
- Climbs: keep the average grade under about 15% (a smoothstep ramp peaks at 1.5× its average).
- **One hole's landforms never lift another hole's ground.** Islands from other holes in the same
  cavern come along as scenery; the shaped ground (`sceneryAt` in terrain.js) keeps their height. And
  don't let one hole's slab run under another hole's green (the 3rd's tee slab made jagged cliffs beside
  the 2nd green).
- Pins stay at 3% or less (tested). Rolls and tiers can push a spot over; move the pin to a flatter spot
  on the same green, or ease that part, rather than flattening the whole green.

## Hazards and misses

- **A miss must cost something.** In a cave the walls are the obvious trap: they must not keep a shank
  in play. Walls soak up some balls (they drop dead into a rubble lie at the foot) and bounce the rest.
  Put stalagmite stands, mushroom groves, water and big fairway-lining bunkers where wild shots land,
  the way trees work on a parkland course.
- But **not overly hard**: fairways 45–65 m wide where drives land (the fairway itself, measured
  straight across; the rough beyond is extra), short grass round greens, a safe way round every
  forced carry, and only a few real bold-or-safe choices. If a hole already plays hard (the Cenote), keep
  its ground from kicking toward trouble.
- When the owner circles a feature as "in the way", move it out of the line enough to leave a real shot
  (the grotto's mushrooms at the bend).
- Test that normal drives clear the roof and walls, and that the bold lines work.
- **Give every hole course-management targets** (`targets`, on fairway, tested), with the green last:
  a safe one and, where there is one, a bold one. Auto-aim plays the pin when it's in reach and the
  line to it is clear of rock and rising ground, otherwise the first target in order that it can reach
  and see, skipping one that would only be a short shot when a further one is in reach. Without targets a
  dogleg aims straight through the rock at the corner (the Rim's 4th hit the nose nine times running).
  Put a target on each leg of a long hole, safe first, and check its surface: a lay-up that lands in a
  bunker isn't a lay-up.
- **Tiers, ledges and walls can stay, but the fairway gets through them on a ramp.** The Climb's tiers were
  slabs whose front edges stood as 14 m walls across the fairway: drives stopped dead at the foot and no
  club could climb out. Now the walls stay and the fairway climbs a gully eroded through each one (a
  sloped island between two wall pieces, with rockfall at the foot of the gully walls).
- **Islands that meet must overlap.** Two superellipses laid edge to edge leave a slot down to the floor between them
  (rounded corners make it worse where three meet): The Climb had them along both gullies and between its tiers, and
  Rimrock's promontory was cut off by one. Tuck a ramp or a lower piece a few metres under its neighbours (the higher
  top wins), add a small filler where three corners meet, and run `tools/review/slots.mjs`.
- **Play every hole headless before calling it done**: tee to holed with the simulated tool and auto-aim
  on, logging each lie (`tools/review/quickplay.mjs` in minutes for a whole course, `playthrough.mjs` in the
  game itself for the holes that changed). A hole that never finishes, or a run of the same lie, is a layout bug, not bad
  luck.

## Water

- **One continuous pool is a river channel at one level** (`rivers`, wide `w`), not a ring of ponds:
  small ponds are dishes and read as separate puddles.
- Streams run downhill as level pools a few metres apart (`streams` in holes.mjs): a cascade.
- A pool that wraps a green sits on the same flat as the green, level with it.
- Falls need a source that makes sense: off a lip, in through a hole in the roof, down terraces.

## Looking natural

- Caves: irregular walls and roofs (vaults, ribs, alcoves), rubble and fallen blocks heaped at the foot
  of every wall (never a clean half dome meeting the floor), flowstone, side caverns and fissures so it
  feels like a network, eyelets for looks and one to play through.
- **Nothing floats.** Anything placed on a displaced visual surface must use the same displacement or
  sit on the ground (rock knobs on the pushed-out wall sheet floated, and were taken out).
- Light the play and let the rest go dark: lanterns, beams through openings, a light on each green.
  For vastness, fade a high vault to black with faint glints, so you can't see its top.
- A smaller, ragged opening in a domed roof, hung with vines, reads better than a wide-open pit.
- Signature features need a real hook: a cracked geode around the green, a cenote, rimstone pools in a
  recess, a crystal cave, a cart on rails that rolls and plays.

## Using height and slope (what worked on Hollowmere)

- **Mix the kinds of height change across the nine**: a drop off a ledge (the Adit's tee at the mine
  mouth), a long fall to a lake (Mirror Lake), terraces stepping down (the Stalagmite Forest), a climb
  out of a bowl (the Geode), and a finish that rises into the light (the Cenote). No two holes in a row
  should use the same kind.
- **Let the height tell the player where to go.** A green set level with a pool behind it reads as safe
  ground in the right place; a fairway that climbs to it makes the approach a little longer without
  punishing a miss. A tee high over the landing area shows the whole hole; a blind crest hides it, so
  put a marker on the line.
- **Terraces are where the ball stops.** Rimstone banks (`step` landforms of a couple of metres with a
  short `run`) set the next lie: a ball on the upper terrace has a flat stance, one short of it a
  downslope.
- **A cant is a soft hazard.** Lean a fairway toward trouble only on a hole that's otherwise easy; on a
  hole that's already hard, lean it away from the trouble (see "Side slope and green contour").
- **Green surrounds decide how hard a hole plays.** A rim or bowl (the geode) keeps near misses at green
  level; a false front sends short shots back; a punchbowl gathers. Pick one per green, matched to how
  hard the shot in already is.
- **The view sells the height.** Big drops need something to read them by: a waterfall, a lantern line
  down the fairway, a lit green far below. Check each from the tee render, not the plan.

## Gotchas in the pipeline (Hollowmere)

- `tools/hollowmere/emit.mjs` turns world-frame data into each hole's frame. **Every new field must be
  carried and transformed**: we lost mark positions, rock rotations, a geode's `back`, and a hall's
  `wall` this way. After adding a field, check the emitted module.
- Cave playfield tiles go fine wherever the ground is steep (`steepFine`), or tall cells drop and leave
  jagged holes.
- **Openings and chasms need their own edges.** A grid cut cell by cell round a skylight or along a chasm
  leaves a staircase you can see through (and coarse far-floor cells laid fairway paint down into the
  Deep). The roof is pulled onto each opening's rim and the shafts sealed to it; chasms get rock walls from
  their own outline. Check with a magenta background and the fog off: anything magenta that isn't sky is a
  hole. Check a chasm drawn as a bite of another really joins it: the inlet on the Falls stood 6–29 m of
  ground apart from the Deep until three neck gorges (`HOLLOW.gorges`) opened it in.
- **Speed in caves.** Real point and spot lights cost every pixel on screen, every frame: Hollowmere's
  15–19 per hole made play crawl on phones. Its lanterns, beams and glows are baked into the meshes
  (`bakeLights` in `cave-world.js`), and only the green's and the fairway's spotlights are real. Add new
  cave lights to `ctx.baked`. And anything sampled per texel or per vertex (the paint texture, the roof
  sheet) runs a few hundred thousand times a hole: `wallDepth` and `ceilingAt` cull halls for that reason.
- The renders are slow (software GL: about 10–15 minutes a hole for three views). The page caches the
  course module: restart a render after changing the data or the renderer.
- The book: `node sample.mjs`, `python3 plans.py`, `node views.mjs`, `python3 color.py`,
  `python3 board.py`, `node printb.mjs` (scripts in the session scratchpad; check `overflow []`).
