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
- Pins stay at 3% or less (tested). Rolls and tiers can push a spot over; move the pin or soften the
  green.

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
- **Play every hole headless before calling it done**: tee to holed with the simulated tool and auto-aim
  on, logging each lie. A hole that never finishes, or a run of the same lie, is a layout bug, not bad
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
- **A cant is a soft hazard.** Tilt a fairway a percent or two toward trouble only on a hole that's
  otherwise easy; on a hole that's already hard, keep it level.
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
