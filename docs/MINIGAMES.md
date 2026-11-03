# VibeGolf mini games: design spec

Eight mini games, all gamified at the **same level**. That level is a fun sweet spot without slot machines, card reveals, unlock shops or announcers. Every game is built from the shared kit below, so they feel like one family.

**Launch monitor reality.** A real swing comes every 15–30 s and the ball flies for about 5 s. Nothing moves fast: moving targets glide at a steady, readable speed so you can aim ahead of them. Don't make punch, flop or stinger shots a scoring condition, because the R10 doesn't read them reliably. Scoring comes from carry, start direction, curve and landing spot, which the R10 reads well. Its spin is sometimes estimated, so anything that depends on roll is tuned forgivingly.

---

## Scenes: every game has its own world

The scoring, feedback, players and end screen are shared, but each game has its **own scene** that fits it. All scenes keep the same camera ("standing over the ball", bottom centre) and HUD layout, and each scene sits on the shared base stage (`src/world/stage.js`: renderer, sky, sun, fog).

| Game | Scene |
|---|---|
| Shape It | **Sunset Mesa**: a fairway on a red-rock mesa high above a desert valley, pink and violet sunset sky, so the glowing rings pop. |
| Zombie Siege | **Dead farm at dusk**: ground fog, a blood-orange moon, a sagging barn, dead trees, crows on the fence, flickering floodlights; zombies shamble out of a cornfield. |
| Carnival Booth | **Night fairground**: string lights, a striped tent behind the booth, a Ferris wheel turning on the horizon. |
| Island Hopper | **The Aerie**'s floating sky world. |
| Golf HORSE | **Woodson Range at twilight** under floodlights. |
| Golf Bowling | **Neon roadside lane**: a 1950s bowling lane laid down a desert valley floor. |
| Wedge Ladder | **Practice academy**: a crisp morning, banded target greens, a coach's board. |
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
| **Players** | 1–4 players with names, a turn banner and a live scoreboard (hot-seat). |
| **Help** | A suggested club for each target, the corner map (top view, plus a side view where height matters), and live R10 or simulated swings. |

**Difficulty** changes one obvious thing per game, usually target size or tolerance, never the speed of moving things. Beginner should feel generous.

**Out of scope for every game:** card or slot reveals, unlockable cosmetics, boss stages, upgrade shops, crowd roars, announcer lines, fast-moving targets.

---

## 1. Shape It
Fly the ball through a set of rings tracing a shot shape.

- **Shapes**, chosen at random each turn: straight, draw, fade, hook, slice, and high or low to a set distance. Each comes with a suggested club and swing length.
- **Rings:** three per shape (rising, apex, descending), sized as a share of their distance: Beginner ~30 yd across at 150 yd, Amateur ~18, Pro ~11, Tour ~6. Each has a perfect center.
- **Scoring:** points per ring, perfect doubles it, and threading all three gives a **SHAPE!** bonus. Streak applies across shots.
- **Round:** 10 shots each.
- **Map:** top and side views showing the rings and your tracer.
- **Challenges, e.g.:** thread a full shape · 2 perfects · reach ×4.

## 2. Zombie Siege
Zombies walk toward your fence. Your ball explodes where it lands.

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
An old-time shooting gallery downrange.

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

- **The call:** the setter picks a carry (e.g. 150 yd), a shape (straight, draw or fade) and optionally a height (normal or high). They must make it first, or the turn passes.
- **Matching:**
  - Each other player has to land within tolerance, and **MATCHED** stamps on screen.
  - Within half the tolerance is a **PERFECT MATCH**.
  - A miss earns a letter, which stamps on with an animation, plus "So close · 3 yd long" style feedback.
- **Difficulty:** tolerance.
- **Word length:** HORSE, or PIG for a quick game.
- **End screen:** the last player standing wins. The streak here counts how many players the setter stumps in a row.
- **Challenges** (per player)**, e.g.:** stump everyone once · 2 perfect matches · win without a letter.

## 6. Golf Bowling
Giant pins down the fairway. Ten frames, real bowling scoring.

- **Pins:** about two-metre pins at the end of a fairway "lane". The ball lands, rolls into the pin deck and knocks pins, which topple into their neighbors.
- **Scoring:** a strike is the perfect zone. Splash words: **STRIKE**, **SPARE**, **TURKEY**, plus split names. "So close" on 9-pin frames.
- **Streak:** bowling scoring is its own multiplier, so the streak badge here tracks strikes in a row.
- **Difficulty:** lane length (100 / 140 / 180 yd).
- **Tuning:** forgiving roll, because the R10's spin reading drives the bounce.
- **Challenges, e.g.:** a strike · pick up a split · score 120+.

## 7. Wedge Ladder
Climb a ladder of carry distances with your wedges.

- **Rungs:** 40, 50 … 120 yd (difficulty sets the range). Each rung is a glowing landing band on the ground with its number.
- **Bands:** Beginner ±8 yd, Amateur ±5, Pro ±3. Within 1 yd is **PERFECT**.
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
3. **Island Hopper** (reuses The Aerie's islands), then **Golf HORSE**.
4. **Carnival Booth**, **Wedge Ladder**, **Golf Bowling**, **Glass Tower**.
