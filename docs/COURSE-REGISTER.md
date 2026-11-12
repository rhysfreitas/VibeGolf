# Course register: what every course has already used

Check a new course against this before its plan book, and add it when its skeleton is agreed
(`docs/COURSE-DESIGN.md` "Skeleton"). `node tools/review/design.mjs all` prints the skeleton table and flags
where courses repeat each other. Started 11 November 2026 with the audit of all seven courses at the end.

## Skeletons

Par and bend (L, R, S for an S-bend or double dogleg, | straight); d = drivable par 4; ↓ ↑ = 20 m or more down
or up from tee to green.

| Course | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Par |
|---|---|---|---|---|---|---|---|---|---|---|
| The Aerie | 4R | 3 | 5 | 4L d | 4R | 3 | 4L | 4 | 5 | 36 |
| Red Mesa | 4R | 4 ↓ | 3 ↓ | 4L | 5S | 3 | 4R d | 4 | 5S ↑ | 36 |
| Hollowmere | 4R ↓ | 3 | 5L ↑ | 4L ↓ | 3 | 4R | 5S | 4R | 4R | 36 |
| The Reclaim | 4R | 4L | 3 | 5S | 3 ↓ | 4 d | 5L | 4R | 4 ↑ | 36 |
| Rimeholm | 4R ↓ | 4L | 3 | 5S | 4 d ↓ | 3 | 4R | 5L | 4L ↑ | 36 |
| Emberfell (playable blockout, round 7) | 5L | 4 | 4L | 3 ↓ | 4R d | 5L | 4R | 3 | 4R | 36 |
| The Lost Valley (planned) | 4R ↓ | 4L | 3 | 5S | 3 | 4 d | 4R | 5L | 4 ↑ | 36 |

What repeats (11 November 2026):

- Every course is par 36 with two par 3s, five par 4s and two par 5s.
- Every course opens with a par 4, and six of seven open bending right.
- The 3rd is a par 3 on five of seven; the 4th is an S-bend par 5 on the last four.
- A drivable par 4 sits 5th or 6th on the last four.
- The Reclaim and Emberfell have the same par order; the Lost Valley shares seven of nine pars with each of The
  Reclaim, Rimeholm and Emberfell.
- Every course finishes by climbing to a clubhouse or camp (the Aerie +5 m, Red Mesa +29, Hollowmere up into the
  cenote's light, The Reclaim +28, Rimeholm +38, Emberfell +17, the Lost Valley +30).
- Four open with a drop off a ledge (Hollowmere −32 m, The Reclaim −12, Rimeholm −30, the Lost Valley −27).

### Assigned on 11 November 2026 (Rhys's picks; not yet drawn)

Emberfell and the Lost Valley are being re-laid to new skeletons, each in its own chat
(`claude/brief-emberfell-skeleton.md` and `claude/brief-lost-valley-skeleton.md` in the project). Check a new
course against these two rows as well; replace them with the measured rows when the plan books are approved.

| Course | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Par |
|---|---|---|---|---|---|---|---|---|---|---|
| Emberfell (drawn in round 6; the row above) | 5 Kipuka | 4 Barranco | 4 Lava Tube | 3 ↓ The Crown | 4 d Terraces | 5 Lavafall | 4 The Lake | 3 Cinder Cone (now inside the caldera) | 4 The Heart | 36 |
| The Lost Valley | 4 Cycad Grove | 5 Floodplain | 4 Bone Bed | 3 Tar Pit | 5 Swamp | 4 ↑ The Nest | 3 ↓ The Overlook | 4 d Strangler | 5 Plunge Pool | 37 |

- Emberfell: a par 5 opens (first course to); three holes outside, the drop off the rim 4th, five inside; the
  island finish stays. Same par as another course on four holes at most (Rimeholm). Drawn in round 6 (11 November):
  3,395 yd from the Obsidian tees, 3,670 from the Magma tips (switched off in the data; round 7 moved the Lake's spot off the Lavafall's approach, 410 yd).
- The Lost Valley: starts on the valley floor; the climb to the ledge is the 6th and the drop off it the 7th (the
  first view of the valley from above); the drivable par 4 is the 8th; a reachable par 5 finishes at the shelf
  green under the Great Falls. First par 37, first with three par 5s, first not to finish with a climb. Same par
  as another course on four holes at most (Red Mesa).
  Routing check sent 11 November 2026 (`tools/lostvalley/`): the ledge moved to the east wall with its ramp at the
  south end; Titan 3,395 yd, 4R 5R 4L 3 5L 4↑ 3↓ 4d 5L, forms fan, broken, island, split, funnel, split,
  scalloped; classics Long (2), Short (4), Eden (7), Leven (8); tips (Brachio, switched off) 3,670 yd. Rhys's
  picks: the ledge on the east wall, a lookout on it by the 7th tee, the rope bridge across the gorge beside the
  9th. Plan book round 3 has the decisions (3, 5, 8, 9) as proposed. The measured row replaces this one when Rhys
  approves the layout.
- Against each other they share a par on two holes.

**Not yet used, so open to the next course (after those two):** par 35; one or three par 3s; one par 5; a par 3
opener; a par 3 or par 5 at the 2nd, 8th or 9th beyond what's above; back-to-back par 3s or par 5s as a set piece;
a finish that goes downhill, to water, to an island or under the landmark; a course whose biggest climb is in the
middle; a long par 3 early.

## Ideas used, by course

| Course | Its logic | Classics | Decision types | Set pieces and landmarks | Big sand |
|---|---|---|---|---|---|
| **The Aerie** | Clouds are a penalty area; islands drift between shots | Cape (5), punchbowl (6) | Bite off a carry (5), go or lay up (9) (both `bold: true`, 11 November); the long way round (3) is a showpiece, its right route measures as a trap | Waterfall that knocks a ball down (1), drifting island, hot-air balloon, rock pinnacle on the line (3), climb to the clubhouse (9) | None |
| **Red Mesa** | A miss off the top plays from the canyon floor | Cape (1), speed slot to a punchbowl (2), Redan (3), Biarritz (6), Alps (9) | Bite the corner (1), go or lay up (5), drivable (7) (all `bold: true`, 11 November); the arch (4) is a frame and an obstacle: a one-line hole (Rhys, 11 November) | 70 m drop par 3 (3), natural arch (4), trestle and steam train (6), hoodoos (7), cliff dwellings, climb through the tiers (9) | Waste on 5 |
| **Hollowmere** | Walls soak a ball; lit play in the dark | Punchbowl (5, 8) | Bite the corner (1, 4), thread the stalagmites (3), over the trestle (7), drivable through the eyelet (9) | Ore cart that moves (1), Mirror Lake (2), terraces (3), the Deep and its falls (4, 6, 7), geode green (5), glowworm grotto (8), cenote (9) | None |
| **The Reclaim** | Facades soak a ball; streets are native ground | Punchbowl (3), Redan and plateau greens, Bottle (4) | Through the lobby (2, long way round), the bottle at the crest (4), drivable, running on from the right (6), bite off the basin (8) | The El (1, 6), gutted tower (2), subway cave-in (3), propped tower (4), stadium and sinkhole (5), fallen bridge (7), rift and leaning clubhouse (9) | None |
| **Rimeholm** | Ice runs; powder buries; hot springs keep greens alive | Redan (7), punchbowl (8) | Cape over the moulin (7), split fairway (8), drivable through the seracs (5) | Ice cave tee (1), travertine terraces (2), longship (3), crevasse field (4), frozen falls (6), moulin (7), mammoth (8), longhouse under the aurora (9) | Powder strip (1) |
| **Emberfell** (playable blockout, round 7) | Lava plays as water | Leven (5), Long (6), Cape (7), Punchbowl in a crater ringed with sand (8) | Drivable down the columns (5), go or lay up at the rill (6), bite off the cape (7), split (9) | Kipuka and lava river (1), geysers (2), tube bridge and a double fairway either side of its trench (3), the Notch reveal (4), basalt columns (5), lavafall in its bay (6), lava lake (7), cinder cone on the caldera floor (8), island clubhouse (9) | Cross bunker (2), ring (8), beach (9) |
| **The Lost Valley** (planned) | Animals are scenery; tar plays as water | Cape (7) | Split round the giant (2), over the channel (4), drivable under the arch (6), centre-line bluff (7), stepping stones or the dry way (8) | Camp ledge (1, 9), monkey-puzzle (2), tar pit and bones (3), braided river (4), Great Falls (5), strangler fig arch (6), Bone Bluff (7), swamp (8), nests (9) | Gravel bars |

Classics no course has used yet: **Eden, Road, Bottle, Channel, Leven, Double Plateau, Hog's Back, Sahara, Long,
Dell.** A punchbowl is on six of seven courses: give it a rest.

## Fairway forms, counted (`node tools/review/alike.mjs all`, 11 November 2026)

49 par 4 and 5 fairways on seven courses. Forms: **spindle 17, broken 11, island 7, split 7, hourglass 4,
scalloped 2, uneven 1. Never used: fan, funnel, bowl, hook, stepping stones, double.** (The Lost Valley's
stepping stones measure as a split: its pools don't yet cut the fairway into separate pieces.) 83 of 1,029 pairs
of fairways on different courses measure as alike.

| Course | Forms | Pairs alike | Against the budget |
|---|---|---|---|
| The Aerie | broken 3, island, split, spindle, scalloped | 0 of 21 | Three broken (its islands), one over |
| Red Mesa | spindle 2, broken 2, scalloped, hourglass, split | 0 of 21 | Inside it. The most varied course |
| Hollowmere | spindle 4, island 2, split | 4 | Four spindles; the Adit, the Rim, the Grotto and the Cenote alike |
| The Reclaim | broken 2, spindle 2, hourglass, hook, fan (reshaped 11 November) | 0 | Inside it; six fairways match another course's (three Hollowmere's, three Rimeholm's), was 26. Was spindle 5, broken 2, six pairs alike |
| Rimeholm | island 3, spindle 2, uneven, broken | 2 | Three plain strips; the Ice Gate and the Hot Springs alike, in a row |
| Emberfell (playable blockout) | round 6: scalloped, funnel, split (a double fairway), hourglass, broken, fan, island | 0 | Inside it; two fairways match another course's (the Barranco and Rimeholm's Ice Gate, the Heart and the Lost Valley's Bone Bed). Was spindle 3, hourglass 3, island, five pairs alike |
| The Lost Valley (planned) | split 4, broken 3 | 0 | Every hole split or broken: two forms, and three splits in a row |

The two planned courses fix theirs in their re-lay (their briefs say so). The playable five keep theirs until
each is next touched; The Reclaim and Hollowmere have the most to gain.

## Set pieces, counted (from the course notes; approximate)

| Kind | Courses | Count |
|---|---|---|
| A waterfall (or the theme's version) as a backdrop | The Aerie, Red Mesa, Hollowmere, Rimeholm, Emberfell, the Lost Valley | 6 |
| A tee shot off a ledge, 25 m or more down | Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell, the Lost Valley | 6 |
| A punchbowl green | The Aerie, Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell | 6 |
| A bridge, in play or as a landmark | Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell, the Lost Valley | 6 |
| A climb to the clubhouse to finish | Every course but the re-laid Lost Valley | 6 |
| A chasm or void beside the fairway | The Aerie, Red Mesa, Hollowmere, The Reclaim, Rimeholm | 5 |
| Something to play through or under (an arch, a lobby, an eyelet) | Red Mesa, Hollowmere, The Reclaim, the Lost Valley | 4 |
| A relic in the ground (a fossil, a ship, a mammoth, a skeleton) | Red Mesa, Rimeholm, the Lost Valley | 3 |
| A fairway split round an object | Rimeholm, Emberfell, the Lost Valley | 3 |
| Something that moves between shots | The Aerie (island), Red Mesa (train), Hollowmere (ore cart) | 3 |
| Terraces to play up or down | Hollowmere, Rimeholm, Emberfell | 3 |
| A green inside a shell (a geode, a crater) | Hollowmere, Emberfell | 2 |
| An island green | Emberfell | 1 |
| A double fairway either side of a hazard | Emberfell (the Lava Tube) | 1 |
| A hole along a shoreline with a beach as the miss | Emberfell (the Heart) | 1 |
| Stepping-stone fairway | The Lost Valley | 1 |

**Over-used (on three or more): a new course takes two of these at most.** Everything from "a relic" up.

**Never used, to start from:** a fairway along a ridge crest; a hole round the rim of something, playing
clockwise; a green in a natural amphitheatre; a green hidden behind a wall or bank; a causeway or dam to play along; a zigzag down a slope in switchbacks; an up-and-over
saddle between two peaks; a hole through a tunnel of trees; a shared double green; a tee you reach the fairway
from across still water with a bail-out beach; dunes and blowouts; a quarry with benches; a canal with locks; a
tide or a level that changes between shots.

## Audit of all seven courses against the rules, 11 November 2026

How to read it. *Measured* means `node tools/review/design.mjs` (8 seeds for the gate, 12 for the decisions). Its
player is a decent amateur's scatter with tour-length clubs, no lie costs, stances, branches or wind, so it
flags a hole for a look; it doesn't prove one broken. **The gate lines below were re-measured later the same day**
after the tool's player was found to aim differently from the game (it read a green up a climb as blocked): the
first run had flagged seven holes, and four of those were the tool. The decision lines are from the first run
and want re-running (`--only=decisions --seeds=24`) before anyone acts on them. *Read* means taken from
the course's data and cards. *Not audited* means nobody has written it down yet: the miss maps, the helper
features and the landmark tables don't exist for any course, so those rules start with the next round of each.
A bold target out of reach from the tee is now scored as a second-shot choice (11 November).

### Every course

- **Skeleton (Must for new courses):** all seven share the card and the mix above. The five playable courses
  stay as they are. Emberfell and the Lost Valley are the two that can still change: see their rows.
- **Hole cards:** only Emberfell and the Lost Valley carry a story for every hole; none has a feature job, a
  miss map or a tee-view line.
- **`bold: true`:** every course now marks its bold targets in the data (Red Mesa three, the Aerie two, marked
  11 November with Hollowmere and The Reclaim); the tool no longer has to guess them from the names.
- **Rhythm, measured, all five playable:** holes face all four quarters of the compass on every course; par 3s
  and par 5s are never back to back.

### The Aerie (re-measured 11 November, 12 rounds gate, 24 decisions)

- **Gate:** passes. Worst hole +0.3 (Lantern and the Cape, back tees). No hole fails to finish.
- **Forced carries (Must):** four holes break the 60% rule from the back tees: the 3rd and 5th 166 yd, the 9th
  179 yd, the 8th 199 yd; the 8th also from the second and third tee sets (162 and 118 yd) and the 9th from the
  second (133 yd). Kept, on purpose: carries between islands are what the course is, and the clouds give a drop,
  not a lost ball. On the 8th (Long Roll), a player 80% as long as each set's drive carries about 185, 150 and
  120 yd in the game's physics, so each has the next tee forward to carry from (the Swift-length player is close
  even from the Swift tee: 120 against 118).
- **View:** one blind tee shot (the 3rd, over the crest at the balloon). Fine.
- **Decisions:** two marked `bold: true`. The Cape's cove (5th, bite off a carry): 39 yd less, pays the long
  hitter 0.25 and the short one 0.29 with no penalty, so it is close to simply the line. The Ascent (9th, go or
  lay up, added 11 November on the fairway short of the green): a second-shot choice 246 yd from the drive, 70 yd
  less than the lay-up; pays the long hitter 0.5 (reaches in two) and the short one 0.37 (it goes as far as it
  reaches). The 3rd's "Round the right" is unmarked: it costs both players over a stroke with 0.6–0.8 penalties
  (the tool can't bend a ball round the pinnacle). The 4th is not a decision: every bold spot tried on its top
  terrace costs the long hitter 0.75–1.7 (its card: "no hero carry, just a climb"). Marking 3, 4 and 5 would be
  three in a row.
- **Tips:** the Albatross set, switched off, 3,692 yd: 452, 205, 549, 353, 480, 153, 445, 490, 565 (44, 29, 39,
  33, 30, 25, 32, 33, 35 yd behind). No back tee had ground behind it, so each is a small tee island floating
  behind the back tee (Rhys's pick, 11 November). Long Way Round's is blind over its crest like its back tee.
- **Rhythm:** five straight holes (three at most); par 4s 320–457 yd, a good spread; par 3s 126 and 171.
- **Classics:** two (Cape, punchbowl). Short of four or five.

### Red Mesa (re-measured 11 November, 12 rounds gate, 24 decisions)

- **Gate:** passes. The 1st (Rimrock) trap was the review tool, not the hole: a bunker shot against the lip by
  the raised green made the shot solver flip its aim 180° and hit a driver backwards into the canyon (fixed in
  `src/minigames/aim.js`). Rimrock +0.6 → +0.0, finishes every round. Worst hole now Kestrel +0.8 from the back
  tees, because the tool (and the game's auto-aim) reads the 242 m to the pin on the flat, beyond 90% of reach,
  and lays up to "Bail out short"; the 70 m drop isn't counted.
- **View:** three blind tee shots by the check. By eye: the 2nd is blind by design (the 34 m drop); the 6th reads
  as in sight (the green shows over the tee mesa's lip); the 8th (Dry Wash) was the one to fix: its Canyon tee is now built up 2 m on
  a raised pad (11 November), 1.8 m into the sight line → 0.4 m. Two blind, inside the limit.
- **Decisions:** three marked `bold: true`. Rimrock's corner: 57 yd less, no difference for either player
  (3.96 / 4.00 long, 3.92 / 4.00 short). Switchback's "Over the waste" (second shot, 190 yd from the drive, 86 yd
  less than the lay-up): pays the long hitter 0.13, costs the short one 0.58: real. Hoodoos' "Go for it": pays the
  long hitter 0.13, costs the short one 0.54; the table rock's cap knocked down five long drives in twelve, so it
  moved 8 m left (11 November): Go for it now pays the long hitter about half a stroke (see the numbers below). Needle's Eye is a one-line hole (Rhys's pick): both tee
  targets pass under the arch, so "Through the arch" is now "Left side" beside "Right side"; the arch is a frame
  and an obstacle.
- **Tips:** the Butte set, switched off, 3,676 yd, all on existing mesa ground: 419, 440, 287, 400, 565, 190,
  350, 480, 545 (24, 30, 25, 30, 30, 15, 30, 30, 30 yd behind the back tees). The 2nd's and 6th's are blind like
  their back tees; the 8th's has a 3.5 m pad so it sees over the ledge too.
- **Rhythm:** four straight holes; par 4s 320–450; par 3s 175 and 265 (far apart on the card, close plays-like
  because of the 70 m drop, as the shape review found).
- **Classics:** five. The model for the rule.

### Hollowmere

- **Gate:** the 6th (The Falls) fails from both ends: +1.9 from the back tees with a penalty every other time,
  +2.4 from the forward tees with 1.3 penalties a hole, and it didn't finish on one of eight. Everything else
  passes.
- **Forced carries:** none over the limit on a par 4 or 5.
- **View:** two blind tee shots (the Geode by design, the Grotto). At the limit.
- **Decisions:** four by name. The Rim's corner (4th) pays both players a quarter of a stroke at no risk, so it
  is simply the line; the Adit's corner (1st) makes no difference to either. The 3rd and 7th are second shots.
  No tee-shot choice measures as real, and "bite the corner" is used twice.
- **Rhythm:** four bends right to two left; par 4s 343–446 (no short one); par 3s 166 and 168 yd, two yards
  apart on the card, which breaks the 25 yd rule unless they play differently (one drops 19 m, one climbs 12).
- **Classics:** one (punchbowl, twice).

### The Reclaim

- **Gate:** passes. No hole over +1.5 and none fails to finish.
- **Forced carries:** the Stadium (5th, par 3) from the forward tees: 98 yd against a 150 yd drive.
- **View:** no blind tee shots.
- **Decisions (reshape, 11 November; Rhys picked 2, 4, 6 and 8; 1, 7 and 9 one line):** at 24 rounds the drivable
  6th is real (running on from the right pays the short hitter 0.33, costs the long hitter 0.5 with 0.42
  penalties). The rest are to be judged by playing: the bottle on 4 pays both by 1.1–2.0 (a miss off the neck
  costs only a rough lie, and the tool's player has no lie costs), the bite on 8 is inside the noise (+0.17 /
  −0.12), and the Atrium still costs the long hitter (+0.5) and pays nobody; it wants a risk added (next round).
  `design.mjs` now scores second-shot choices (the 4th; the 7th's inlet before it was unmarked: pays the long
  hitter 0.2, costs the short 0.3).
- **Rhythm:** four straight holes; par 4s 300–430 (the 8th is now 365, so only the 2nd is at 380).
- **Tips:** the Girder set, switched off, 3,603 yd: 427, 418, 161, 583, 221, 331, 590, 403, 469 (27, 38, 26, 38, 26,
  31, 30, 38, 39 yd behind the back tee); the 1st's on the El platform's back end, run on 24 m for it.
- **Classics:** three by green style.

### Rimeholm

- **Gate:** one hole flagged. The 9th (The Aurora Hall) from the forward tees: +2.1, didn't finish on one of
  eight (the 38 m climb is a lot for a short hitter). The 4th and 8th, flagged in the first run, were the tool.
  On the 4th the first target (The trough) sits at the foot of a 23% ramp, so a driver off the deck from there
  flies into the slope: worth moving the target a few metres back.
- **View:** four blind tee shots, two over the limit: the 1st and 5th (both off a lip, the ledge hides the
  landing area by about 2 m), the 6th (blind by design) and the 9th (the climb).
- **Decisions:** two marked. Over the moulin (7th) is a real choice: 69 yd less, pays the short hitter a quarter
  of a stroke, nothing for the long one. The 8th's is a second shot. The drivable 5th has no bold target marked.
- **Rhythm:** passes every check. Par 4s 300–420.
- **Classics:** two (Redan, punchbowl).

### Emberfell (planned, round 5)

- **Skeleton:** the same par order as The Reclaim, with the S-bend par 5 fourth and the drivable par 4 sixth
  like the other three recent courses. Its finish (across a rock bridge to an island green) is its own. Cheap
  changes to ask Rhys about: turn the 2nd (420 yd, down 15 and up 21) into a par 5 and the 4th into a long
  par 4, which breaks the par order and the par-5-fourth slot without moving a hole.
- **Decisions:** three (drivable 6th, go or lay up at the rill on the 7th, split on the 9th), three types. Inside
  the range. Mark the 7th's carry `bold`.
- **Classics:** two named (punchbowl, Cape). The 3rd is close to a Short; the 5th could be an Eden.
- **Reveal:** has one (the Notch), the model for the rule.
- **Not audited until it is in the engine:** gate, carries, view.

### The Lost Valley (planned, round 2)

- **Skeleton:** opens with a drop off a ledge and finishes with a sidehill climb, S-bend par 5 fourth, drivable
  sixth: the fourth course on that layout. It shares seven pars with three other courses. It is early enough to
  change: a different opener or finish, or a par 3 moved off the 3rd.
- **Decisions:** five (split 2nd, the channel on the 4th, drivable 6th, the bluff on the 7th, stepping stones
  on the 8th), and three in a row at 6, 7, 8. Over the range of two to four: drop one, and break up the run.
- **Classics:** one named (Cape).
- **Not audited until it is in the engine:** gate, carries, view.

### What I'd do first

1. Done 11 November: the tool and the game disagreed on Rimeholm because the tool's player aimed differently
   (fixed in `tools/review/play.mjs`), and a topped shot ran for ever (fixed in `src/physics.js`).
2. Mark `bold: true` in the courses that lack it, then fix the choices that measure backwards or as traps:
   The Reclaim's 8th reshaped (a hook) 11 November; its 2nd still wants a risk. Red Mesa and the Aerie done 11 November (the arch a one-line hole, the table rock moved).
3. Look at the drop-off-a-lip tee views (Red Mesa 2, Rimeholm 1 and 5) in a render.
4. Done 11 November: Rhys picked new skeletons for Emberfell and the Lost Valley (see "Assigned" above).
5. Write hole cards (feature job, miss map, tee view) for the playable courses as each next gets touched.
