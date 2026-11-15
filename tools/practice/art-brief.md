# The Practice Ground: art brief (pass 1)

Written 14 November 2026 from research (no reference photos from Rhys). The Practice Ground has been the blockout
since 7 November (`f3a5624`, `0c76d79`): a floodlit tour campus at blue hour with a city skyline, the main tee line,
the Swing Lab and the short-game area behind a lit hedge. Renders of today's look: `tools/review/range.mjs`
(`range_before_sheet.jpg`). It is the place you see most: every range and coaching session looks down it.

## What the renders show (before)

- **It reads as daytime.** The turf from the tee is a flat, bright lime green all the way to the 200 yd board: the
  tee's own light pool and the cool "sun" key (1.1) light everything evenly, so there is no night in the ground.
  Under real LED floods the lit turf is a rich green and everything outside the light falls off fast to near black.
- The turf has no texture close to: broad pale bands, no blades, no divots, no balls. The mats are dark green slabs.
- The target greens are flat discs inside a glowing ring; from the tee they read as rings on a lawn, not greens.
- The skyline is a row of flat tan boxes, too small and too pale to read as a lit city; the city glow is faint.
- The tree lines are dark balls; the tower glows are big soft circles; the tower heads are plain boxes.
- The Academy behind the tee is a dark box with one lit strip (seen only from the overview).
- The Swing Lab reads well (grid floor, monitors, truss, the pressure mat) and needs least.

## The feel

Quiet focus after hours. The campus is yours: one lit tee line, the field glowing in pools under tall masts, the
city humming on the horizon, the big screen answering every shot. Warm floodlit green against a deep cool sky:
the blue-hour contrast photographers wait for, when the sky still has colour and the lights are already on.

## Palette (big surfaces first)

| Colour | Hex | What |
|---|---|---|
| Lit fairway | `#3d7a2c` / `#478a33` | turf under the floods, mowing stripes about 9 m (three mower passes) |
| Unlit turf | `#121f12` | between and beyond the pools: the light falls off to this, not to grey |
| Rough / berms | `#22361c` | beyond the mown range, darker and coarser |
| Target greens | `#5aa53e` | brighter and finer than the fairway, a fringe ring `#4a9236` |
| Bunker sand (lit) | `#d2c49a` | pale, warm under the floods |
| Floodlight | `#fff2dc` | 4000 K: a warm-neutral white (5000 K reads too blue against the sky) |
| Sky zenith / mid / horizon | `#08122c` / `#1b3262` / `#4d6590` | deep blue, a pale band low down |
| City glow | `#c98a55` | sodium and LED glow above the skyline, strongest behind the tallest towers |
| Lit windows | `#ffd08a` warm, `#d6e6ff` cool office | three in five lit, in floors, not a checkerboard |
| Structures | `#1d242b` dark steel, `#6b7682` mast grey, `#9a7350` timber | |
| Fog / haze | `#16243f` | cool, thin; a faint warm lift under each mast |

Keep the greens a little desaturated: the shader multiplies by the pool light, and saturated green under a bright
pool goes lime (today's problem).

## Materials

- **Range turf**: mowing stripes across the line (9 m) in the landing areas, a finer cross-cut near the targets;
  close to the camera, blades and clumps; scattered divots and pale scars; worn tracks where the picker drives.
- **The tee**: a grass tee in front of the mats with lines of divots (each about 10 × 5 cm, in strips where players
  hit), and quality hitting mats (two-tone, a rubber tee) with a slim divider and a ball tray at each bay.
- **Target greens**: real greens with a fringe ring, a collar and one or two bunkers each, lit by their own small
  floods so they glow brighter than the fairway; flags on 2.3 m poles. Practice-facility designers ask for targets
  that look like approach shots to real greens, at a spread of distances (here 50–250 yd).
- **Masts**: slim galvanised poles 26 m, LED heads (a dark frame with a grid of bright cells), aimed down the range;
  in the light haze a faint cone under each head.
- **The skyline**: towers in two or three depths, lit floors and a few dark ones, a couple of crowns lit at the top,
  red aircraft beacons blinking on the tallest; the glow over the city strongest behind it.
- **The big screen**: as now (it reads), with a little bezel light spill on the ground below.

## Vegetation

Tree belts down both sides, outside the lights: dark, layered crowns (pine and oak), the nearest catching the edge
of a pool so their fronts show green; a clipped hedge with uplights round the short-game area (as now). Nothing on
the range itself.

## Sky, light and weather

- **The signature: late blue hour, still air.** The sun about 6° down behind the tee: a pale warm band low in the
  sky behind you, the sky ahead deep blue going navy at the top, the first stars, the city's glow on the horizon.
- **Light is the floods.** Every lit surface sits in a pool; between pools the ground falls nearly to black; the
  key light is the masts behind the tee (shadows fall downrange), not a sun overhead. The tee line is brightest.
- A thin haze so the masts throw faint beams and the far end softens into the city glow.

## Life and details

A few, never busy, scenery only: range balls dotted over the landing areas (white, catching the light: the most
"range" thing there is), ball pyramids, a bag stand and alignment sticks by your bay, the ball picker cart crawling
across the far range with its cage and lamps, moths in the lights, an aircraft crossing the sky. No other players
by default (it's after hours; you have the place to yourself).

## Landmarks

- **The big screen** at the end of the range (seen from every station).
- **The skyline** with one tall tower whose crown is lit, on the line from the tee.

## Avoid

- Daylight in the ground: a uniformly lit field, a green that reads lime, grey shadows.
- Neon-arcade glow everywhere (no glowing rings on every target, no coloured turf zones) unless chosen.
- Busy props on the lines of play; anything that hides the ball's landing from the tee.
- Real lights beyond two: pools stay painted in the shader, glows stay sprites.

## References

- Floodlit driving ranges at night (image search: Silverstream Golf Park, Burgess Hill Golf Centre, Portsmouth Golf
  Centre): lit tee lines under a canopy, the field in pools of white light, dark beyond.
- LED range lighting guides (ledlightingsupply.com, logoslighting.com): ranges need concentrated beams to light
  distant targets, masts 30–50 ft and more; outdoor floods are mostly 4000 K or 5000 K; greens are lit brighter than
  fairways.
- Broadlands Driving Range (Ansell Lighting): 5000 K floods on a Toptracer range.
- Practice facility design (Golf Range Magazine, Golf Course Industry, sportscotland's development centre spec):
  target greens at a spread of distances, shaped and bunkered like real approach shots, pale sand to define targets
  at 225 yd and more.
- Tokyo's multi-deck net ranges (Shiba Park's three decks, 1963; Meiji Jingu Gaien's 123 bays): ranges in the city,
  tall steel net towers down both sides, open late.
- Blue-hour photography (glass.photo, goldenhourcalculator, dailyphototips): the window when sky and city lights
  balance; cool sky against warm lights; the sky ahead deep blue, the warm band where the sun went down.
- Swing studios (MIA Sports, The Belfry, Haggin Oaks' indoor/outdoor studio): banks of synchronised high-speed
  cameras, force plates, big displays, bright even light; studios that open onto the range through tall doors.

## Rhys's picks (14 November 2026)

Asked in the picker, with `practice-ground-light-options.jpg` (three quick re-lights of today's tee view):

- **Structures: tour campus.** Layered tree belts down both sides, slim 26 m LED masts with gridded heads and faint
  beams, a grass tee with divot strips in front of proper mats.
- **Ground and targets: real tour greens.** Shaped greens with a fringe and bunkers, lit brighter than the fairway;
  textured turf, divots, range balls in the landing areas; the glow rings only flash when a ball lands on a green.
- **Light and sky: C, the dusk afterglow** (not the recommended blue hour). A pink-orange band on the horizon
  ahead where the sun went down, the lights just coming on, softer contrast than full night.
- **Details: all four.** Range balls and bay props (a ball pyramid, a bag stand, alignment sticks); the ball picker
  cart crawling across the far range with its lamps on; a richer skyline in layers with one tall tower whose crown
  is lit, blinking beacons and a plane crossing now and then; faint beams under the masts and moths at the heads.

What that changes in the brief: the sky is the afterglow (sun about 2–4° down, ahead and a little left, behind the
city), so the skyline stands dark against a warm band with its windows lit; pools stay, but the turf between them
is dusk-dim (about a fifth of a pool), not black; the floods are warmer than the sky and only just winning.
