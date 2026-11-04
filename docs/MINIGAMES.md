# VibeGolf mini games: design spec

Eight mini games, all gamified at the **same level**. That level is a fun sweet spot without slot machines, card reveals, unlock shops or announcers. Every game is built from the shared kit below, so they feel like one family.

**Launch monitor reality.** A real swing comes every 15–30 s and the ball flies for about 5 s. Nothing moves fast: moving targets glide at a steady, readable speed so you can aim ahead of them. Don't make punch, flop or stinger shots a scoring condition, because the R10 doesn't read them reliably. Scoring comes from carry, start direction, curve and landing spot, which the R10 reads well. Its spin is sometimes estimated, so anything that depends on roll is tuned forgivingly.

---

## Scenes: every game has its own world

The scoring, feedback, players and end screen are shared, but each game has its **own scene** that fits it. All scenes keep the same camera ("standing over the ball", bottom centre) and HUD layout, and each scene sits on the shared base stage (`src/world/stage.js`: renderer, sky, sun, fog).

| Game | Scene |
|---|---|
| Shape It | **The Launch Bay**: you tee off from the launch pad in the hangar at the back of a spaceship. Its stern door is open on space, with a faint force field across it (it keeps the air in) that ripples as the ball goes through, and a lit flight deck runs out from it like a carrier's, with yardage painted on it (a ball that misses the deck drops away into space). Small ships wait in their launch slots either side with their engines idling, blue lane lights chase toward the door, and through it an asteroid belt crosses the distance under a ringed gas giant, with a few rocks drifting past and far-off ships cruising. The hidden joke: you're reading a *launch* monitor. The rings are flight gates with nav lights, and the map is the bay's **flight-plan screen**, a monitor on a boom arm hanging into the top right of the view (it rides with the camera so it stays readable; tap it to aim at a spot). Its status line reads Cleared for launch, In flight, each gate, then On plan or Off plan. A perfect flight plan sends one of the ships out of the door; it rises back up its slot's lift next turn. |
| Zombie Siege | **Dead farm at night**: a huge low moon, stars and drifting clouds, distant lightning. Floodlights cut beams through rolling ground fog. Your fence has sandbags, barbed wire and burning barrels, and the field has an overturned pickup with its headlights on, a burning tractor, a graveyard some zombies climb out of, a barn, an abandoned farmhouse, a windmill, jack-o'-lanterns and a far church steeple. Candle-lit headstones carved with the yardage mark every 50 yd down both sides. Synthesised night sounds (wind, crickets, groans that grow as they near, crows, thunder, a bell each wave). Spooky, not gory. |
| Carnival Booth | **The Tin Gallery**: a life-size antique tin shooting gallery on a sunny late afternoon. A bulb-lit arch over the counter, a plank stage floor, painted plywood waves rocking side to side, gears turning on striped walls, and a painted sky backdrop with a cut-out sun on a stick. The rows are tiered (cans low, boards on posts, ducks on a raised rail along a painted sea wall, the bell up top) and the walls are solid. The real fairground shows beyond: Ferris wheel, big top, carousel, coaster, stalls, bunting and balloons. A synthesised calliope waltz plays. |
| Island Hopper | **The Aerie**'s floating sky world. |
| Golf HORSE | **The Cul-de-sac**: a giant suburban cul-de-sac just after sunset under Topgolf-style floodlights. You hit from a bay on the first garage roof. Seven LED target rings sit in the street and lawns, a basketball court is painted in the bulb under a giant driveway hoop, and a basketball scoreboard shows the call. |
| Golf Bowling | **The Toy Room**: you've been shrunk in a kid's bedroom on a sunny afternoon (everything is real size ×30). The lane is the long runner rug down the floor, with woven landing dots and arrows, and the toy pin set (9 m pins, white with red stripes) stands on a maple mat between red side rails with a cushion behind. Floorboards, a toy train looping through a sunbeam with dust in it, letter blocks, log-sized crayons, marbles, a race car, a spinning top, a beach ball, the bed with a patchwork quilt and a teddy on the pillow, a dresser with a lit lamp, a toy shelf, kid's drawings taped to the wall, and a big window with gingham curtains, the garden fence and a tree. A wooden yardstick is the pinsetter's sweep bar; Beginner gets foam-noodle bumpers. Sunlight only gets in through the windows (a shader dims direct light where the walls block it). The camera glides down the lane to watch the pins, then back. A roadside neon lane could be a second lane later. |
| Wedge Ladder | **The Airfield**: a vintage airstrip at sunrise. Each rung is a landing zone painted across the flat runway (true carries) with a runway-style number; the live zone has green and red edge-light rows and a floating number. Control tower with a turning beacon, hangars, a biplane, a windsock, taxiway yardage signs and hot-air balloons. The ladder HUD is a departures-style flight board whose rows double as a top-down runway strip with your landings. |
| Glass Tower | **Downtown plaza at dusk**: the target tower lit among other skyscrapers. |

---

## Shared kit (every game)

| Piece | What it does |
|---|---|
| **Living targets** | A slow idle animation: rings spin and pulse, ducks bob, zombies shamble, windows flicker. |
| **Hit** | The target flashes bright and gives a short sparkle burst. Several hits in one shot chime at a rising pitch. |
| **Perfect zone** | Every target has a tighter center. A hit there gives a gold burst and **PERFECT**, worth double. |
| **So close** | A near miss shows **So close · 2 yd**, with a quick flash where it missed. |
| **Streak multiplier** | ×2 → ×3 → ×4 (max) on consecutive scoring shots. The badge glows hotter as it climbs, and a miss resets it. |
| **Score count-up** | Points roll up after each shot. |
| **Splash words** | One short word per big moment (PERFECT, SHAPE!, TRIPLE, STRIKE…). One at a time and brief. |
| **Run challenges** | Three optional goals shown at the start of each run. Each completed one is worth a star (max 3). |
| **End screen** | Score, stars, personal best, a **NEW BEST!** banner, and Play again. Bests are saved per game and difficulty. |
| **Players** | 1–4 players with names, **each with their own difficulty**, a turn banner and a live scoreboard (hot-seat). Bests are kept per difficulty. Shot games take turns. Survival games (`mode: 'run'`) give each player a full run in turn. |
| **Help** | A suggested club for each target, the corner map (top view, plus a side view where height matters), and live R10 or simulated swings. |
| **Test swings** | One small button opens the shared simulated-shot tool (`src/sim-tool.js`): club (Auto follows the game's suggestion), Normal / Punch / Stinger, a shape line to drag left or right, a swing-length bar (% of full, Full by default), **Ideal** (the exact shot) and **Hit** (a decent amateur *attempting* it). A dashed phantom line shows where it will fly; drag it left or right in the view to aim. Tapping a game's map (or picking a target) points the line there and sets the club and swing length that reach it. The crosshair beside the pill is **Auto-aim** (off by default): on, the game picks the swing length and direction to its target for you. R10 shots never use these settings. |

**Difficulty** changes one obvious thing per game, usually target size or tolerance, never the speed of moving things. Beginner should feel generous.

**Out of scope for every game:** card or slot reveals, unlockable cosmetics, boss stages, upgrade shops, crowd roars, announcer lines, fast-moving targets.

---

## 1. Shape It
Fly the ball through a set of rings tracing a shot shape.

- **Shapes**, chosen at random each turn: straight, draw, fade, hook, slice, and high or low to a set distance. Each comes with a suggested club and swing length.
- **Rings:** three per shape (rising, apex, descending), sized as a share of their distance: Beginner ~30 yd across at 150 yd, Amateur ~18, Pro ~11, Tour ~6. Each has a perfect center.
- **Scoring:** points per ring, perfect doubles it, and threading all three gives a **SHAPE!** bonus. Streak applies across shots.
- **Round:** 10 shots each.
- **Map:** the flight-plan screen: top and side views showing the rings and your tracer.
- **Challenges, e.g.:** thread a full shape · 2 perfects · reach ×4.

## 2. Zombie Siege
Zombies walk toward your fence. Your ball explodes where it lands. The field funnels in toward the fence (full width out deep, narrowing to stay within 32° of straight ahead), and each zombie keeps its lane, so none ends up at an angle you can't hit.

- **Difficulty = blast radius only:** Easy 20 yd · Normal 12 · Hard 7 · Nightmare 4. All zombies walk at a steady pace.
- **Field:** yard lines and flags every 25 yd plus a centerline. Zombies come in across the width, so aiming off-line spreads your shots.
- **Zombie types:**
  - Walkers.
  - Packs of 5–6 clumped together, the big-score targets.
  - Tanks: two blasts, and they glow red after the first.
  - Bloaters: when one dies it bursts and chain-kills anything nearby.
- **Scoring:**
  - Landing within ~2 yd of a zombie is a **DIRECT HIT** (the perfect zone), worth double.
  - Multi-kills: **DOUBLE**, **TRIPLE**, and **MASSACRE** for 5 or more.
  - Kills on consecutive shots build the streak. A blast that just misses shows "So close".
- **Waves:** a short summary between waves, and every third wave is a bigger horde.
- **Fence:** has hit points and shows damage. The run ends when it breaks. Score is time survived plus kills.
- **Power-ups:** supply crates only (repair, freeze for one shot, airstrike on one lane), grabbed by landing near one.
- **Challenges, e.g.:** a MASSACRE · reach wave 5 · pop a bloater chain.

## 3. Carnival Booth
An old-time shooting gallery downrange. *(Built: 4 cans, 2 boards in the gaps, 5 ducks gliding on a loop, the bell. Tickets are the score: small plush at 300, medium at 800, giant at 1,600. Knocking down every can scores a +200 row bonus.)*

- **Rows:** tin cans at ~75 yd, bullseye boards at ~120, a row of ducks on a rail at ~150, and the prize bell at ~210.
- **Ducks** glide slowly and steadily, so you aim ahead of them. Beginner shows a faint lead marker.
- **Scoring:**
  - Each row is worth more than the one before.
  - Board bullseyes and duck centers are the perfect zone.
  - Hitting the bell rings it with a big splash.
  - The streak builds on consecutive hits.
- **Round:** 12 shots each.
- **Prizes:** a ticket tally turns into a prize-shelf tier on the end screen (small, medium, giant plush). That's the star display.
- **Difficulty:** target size.
- **Challenges, e.g.:** ring the bell · 3 ducks · clear the can row.

## 4. Island Hopper
Hop across floating islands of The Aerie without falling into the clouds.

- Each hop offers 2–3 next islands at different distances. Farther islands are worth more, which adds risk and reward.
- **Landing:** land and stay on the island to continue. A glowing pad at each island's center is the perfect zone. A miss off the edge shows "So close · 3 yd".
- **Lives and streak:** 3 lives. The streak builds on consecutive landings, and islands get smaller the further you go.
- **Difficulty:** island size.
- **Challenges, e.g.:** reach island 10 · 3 perfect pads · take a long hop.

## 5. Golf HORSE
Call a shot and make the others copy it. 2–4 players.

- **Targets:** seven Topgolf-style LED rings at 60, 90, 120, 150, 180, 210 and 240 yd, each with its own color, flag and bullseye. The 240 is the **Hoop**, under the giant driveway hoop. Any ring a ball lands in lights up (flash, fast LED chase, sparkles, chime), called or not.
- **The call**, made on the basketball scoreboard: a target ring, a shape (Any, Straight, Draw or Fade) and a height (Any, High or Low). Shape is read from the spin axis. High and Low compare the apex with a normal shot to that target, and the board shows the line (e.g. APEX ≥ 96 FT).
- **The setter** must make their own call. Make it and everyone else has to match it, and the setter calls again. Miss it and the call passes to the next player, with no letters.
- **Matching:**
  - Land in the ring with the right shape and height: **MATCHED** (or **PERFECT MATCH** in the bullseye, 40% of the ring).
  - A miss earns a letter, which stamps onto the scoreboard, plus "So close · 3 yd long" style feedback.
- **Difficulty:** each player's ring size (about 20 / 15 / 11 / 8 yd across at 150 yd) and how clearly a shape or height has to show.
- **Word length:** HORSE, or PIG for a quick game. The last player standing wins (after 24 made calls, fewest letters wins).
- **Scoring (bragging rights):** a made call or match is worth 100, +50 for a shape, +50 for a height, double in the bullseye. The setter gets 150 for each player they stump. The usual streak applies. A ball that drops through the giant hoop's rim is a **SWISH!** (+300).
- **Solo:** Dusty, the kid from down the street, joins as a computer player (with his own difficulty) and swings like a decent amateur.
- **Challenges** (per player)**:** stump everyone on one call · 2 bullseyes · win without a letter · match 3 calls · make 3 of your own calls · make or match 2 draws or fades · a High or Low call · land in the Hoop.

## 6. Golf Bowling
Giant pins down the fairway. Ten frames, real bowling scoring.

- **Pins:** about two-metre pins at the end of a fairway "lane". The ball lands, rolls into the pin deck and knocks pins, which topple into their neighbors.
- **Scoring:** a strike is the perfect zone. Splash words: **STRIKE**, **SPARE**, **TURKEY**, plus split names. "So close" on 9-pin frames.
- **Streak:** bowling scoring is its own multiplier, so the streak badge here tracks strikes in a row.
- **Difficulty:** lane length (85 / 110 / 130 / 150 yd). The first build used 100 / 140 / 180, but flying the ball into the pins (instead of rolling it in) exposes an amateur's spread: at 180 yd about a third of first balls missed the rack.
- **Tuning:** forgiving roll, because the R10's spin reading drives the bounce.
- **Challenges, e.g.:** a strike · pick up a split · score 120+.
- **Built:** fly it into the pins. The flight is the physics, so the ball's real speed and entry angle reach the pins: pins fly as hard as they're hit (a low, hot punch explodes them, a soft wedge tips them over), and a draw curving into the 1-3 pocket (or a fade into the 1-2) carries better than a straight ball, which the head pin knocks off line, like a hook in bowling. A ball that lands short rolls in on the rug, which soaks up most of its speed (ignoring spin), so it's a weak bowl. A small top-down rigid-body sim (`bowling-logic.js`) does the pin action: the ball shoves the pins it meets, a falling pin sweeps whatever it tips into, and pins bounce off the side rails. Simulated and ideal shots use the club and shape chips (a longer club is hit as a knockdown punch), so the mechanic can be tried without an R10. Beginner 85 yd with bumpers and a guide line, Amateur 110, Pro 130, Tour 150 with heavier pins. Splits are named (the bedposts, the big four, Greek church…). Converting a split is very rare with a golf ball, so it's a celebrated splash rather than a challenge. The simulated amateur (suggested club, draw) averages about 136 / 120 / 89 / 72; going two clubs longer for a low punch averages 137 / 114 / 106 / 84.

## 7. Wedge Ladder
Climb a ladder of carry distances with your wedges.

- **Rungs:** 40, 50 … 120 yd (difficulty sets the range). Each rung is a glowing landing band on the ground with its number.
- **Bands:** Beginner ±5 yd (40–100), Amateur ±4, Pro ±3, Tour ±2 (40–120). Within about 1 yd is **PERFECT**. Distance is carry measured straight down the runway. (Tuned so Beginner is generous and Amateur reaches the top about a third of the time.)
- **Moving:** a hit climbs a rung and a miss drops one, with "So close · 1.5 yd long" feedback. A ladder HUD on the side shows where you are.
- **Round:** 15 shots each. The score is your highest rung plus perfects, and the streak builds on consecutive climbs.
- **Challenges, e.g.:** reach the top · 3 perfects · no drops.

## 8. Glass Tower
Smash the windows of a glass skyscraper.

- **The tower** stands about 160 yd out. Windows are lit, and higher floors are worth more. The ball has to still be in the air at the tower to hit a window, so club choice and height matter.
- **Hits:** a window shatters with falling glass and flashing alarm lights. Clearing a whole floor is a bonus.
- **Gold windows:** one or two rotate around the tower as the perfect zone.
- **So close** shows when you miss a lit window by a little.
- **Round:** 10 shots each, and the streak builds on consecutive breaks.
- **Map:** a side view shows your flight against the tower face.
- **Difficulty:** window size.
- **Challenges, e.g.:** break a gold window · hit the top floor · clear a floor.

---

## Build order
1. **Shape It plus the shared kit:** the mini games menu, players and turns, difficulty, run challenges, splash words, the end screen and bests.
2. **Zombie Siege.**
3. **Island Hopper** (reuses The Aerie's islands), then **Golf HORSE**. *(Done.)*
4. **Carnival Booth**, **Wedge Ladder**, **Golf Bowling** *(done)*, then **Glass Tower**.
