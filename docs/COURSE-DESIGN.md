# Course design: how we lay out a course

Read this before laying out a course or a hole. CLAUDE.md has the short version; `docs/COURSE-REGISTER.md` lists
what every course has already used; `docs/ART-PASS.md` is how a course gets its look.

Reorganised 11 November 2026 (the rules review). Before that the rules sat here in the order they were agreed,
and rules got dropped. Now: **fill in the cards first (Part 1), check the nine (Part 2), then the rules by topic
(Part 3)**. Part 4 is the process, Part 5 the building notes and where each rule came from.

## What we're making

Courses that play like real golf in places that couldn't exist. In Rhys's words: still playable; grand fantasy
features that work with the scenery; holes that feel and play somewhat like real courses; every hole unique, with
an interesting feature and a story or goal; and sometimes a decision the layout really supports, such as a hard
path and an easy one, where the easy one may be longer but has less danger.

Every rule below is tagged:

- **Must**: tested or measured, and a failure blocks the round going to Rhys. Fix the design, not the check.
- **Should**: measured or looked at; break one on purpose, for a reason you can write on the hole card.
- **Taste**: Rhys's standing preferences. No tool checks them; a review round does.

# Part 1: the cards

Fill these in **before any shape is drawn**. They go in the plan book (the course card after the cover, each hole
card at the top of its page) and in the course's `holes.mjs`. A blank line on a card is a design gap, not a
formality: Lost Valley round 1 met every outline and slope rule and still read as rinse and repeat.

## The course card

| Line | What goes on it |
|---|---|
| **Hook** | The place, and the one piece of logic its fantasy obeys ("the clouds are a penalty area and islands drift", "lava plays as water"). Nothing too fantastical: no creature or magic that needs explaining. |
| **Skeleton** | Par order, total par, where the big drop, the big climb, the drivable par 4, the long par 3 and the set pieces sit, how it opens and how it finishes. Checked against the register (see "Skeleton"). |
| **Classics** | The four or five classic hole types this course dresses in its theme, none of them the same set as another course's. |
| **Decisions** | Which two to four holes ask a real question, and of which type. No type twice on a course. |
| **Landmarks** | Two to four, with the tees and landing areas each is seen from, and the one planned reveal. |
| **Rhythm** | The opener, where the hardest holes sit, the breather, the finish. |
| **New and borrowed** | The three or more kinds of set piece no course has used, and the two at most taken from the register's over-used list (see "Sameness"). The fairway form of every par 4 and 5, side by side, so repeats show before anything is drawn. |

## The hole card

| Line | What goes on it |
|---|---|
| **Story** | One line. "The giant: a monkey-puzzle alone in the fairway at the corner." If the hole could sit on any course, it isn't done. |
| **Type** | The classic it is built on, or "original". Its **fairway form** from the sheet (`docs/fairway-forms.svg`): spindle, hourglass, fan, funnel, bowl, hook, split, island, broken, stepping stones, double, scalloped. Choose the form for the hole's story before setting any numbers. |
| **Feature and its job** | The feature, and what it does for the golf: hazard, aim point, frame, obstacle, lie-setter or helper (see "Features"). |
| **Decision** | The type and the two routes with their numbers (what the bold line gains, what each risks), or "none: one clear line". |
| **Miss map** | Where the small miss, the medium miss and the big miss finish on each side, and which side is the safe miss at the green. |
| **Tee view** | What is in front, in the middle and beyond; whether the landing area shows; the marker if it doesn't. |
| **Ground** | Net height change and its kind (drop off a ledge, terraces, a climb), the fairway's lean and its purpose, the one contour that matters, the green's feature. |

# Part 2: the nine, as a checklist

Run `node tools/review/design.mjs <course>` (and `all` to compare courses), `node tools/review/alike.mjs <course>`
(and `all`) and `tools/review/analyse.mjs <course>`.
The plan-book tools (`tools/<course>/sample.mjs`) carry the same checks for a course that isn't in the engine yet.

| # | Rule | Tag | Checked by |
|---|---|---|---|
| 1 | The skeleton differs from every other course (par order, set-piece slots, opener, finish) | Must | `design.mjs all`, the register |
| 2 | Every hole finishes from every tee set, and plays no worse than +1.5 for the tool's player | Must | `design.mjs` gate, `quickplay.mjs` |
| 3 | Pins at 3% or less; tees off fairways; nothing overhead under 45 m at a tee; targets on fairway; nothing floats | Must | the course's tests |
| 4 | Every tee set's drive lands on 40 m or more of fairway; 45–65 m where back-tee drives land | Must | `analyse.mjs` |
| 5 | No forced carry over 60% of that tee set's drive, and a way round every forced carry | Must | `design.mjs` carry |
| 6 | Penalty ground (void, water, lava) on one side of a landing area at most | Must | the miss map, `design.mjs` penalties |
| 7 | Two to four decision holes, each a different type, each measured as a real choice | Should | `design.mjs` decisions |
| 8 | Four or five classics, dressed in the theme | Should | the course card |
| 9 | Every hole has a story, a feature with a job, and a hole card with no blank line | Should | the plan book |
| 10 | At least two features a nine help the ball | Should | the hole cards |
| 11 | The tee shot's target is in the fixed view; two blind tee shots a nine at most, each with a marker | Should | `design.mjs` view, a tee render |
| 12 | Each landmark is seen from three or more tees or landing areas; one planned reveal | Should | the landmark table, tee renders |
| 13 | Par 4s from 340 yd or less to 420 or more; par 3s 25 yd or more apart (plays-like), facing different ways | Should | `design.mjs` rhythm, `analyse.mjs` |
| 14 | Holes face three or more quarters of the compass; bends within two of each other left and right; three straight holes at most | Should | `design.mjs` rhythm |
| 15 | No two holes in a row with the same par and bend, the same fairway structure, or the same kind of height change | Should | `design.mjs`, the hole cards |
| 16 | Every hole goes up or down; several 8–15 m, two or three of 25–35 m | Should | `analyse.mjs` |
| 17 | Most par 4/5 landing areas lean 2–5%; a strong 6–8% sidehill once or twice | Should | `analyse.mjs` |
| 18 | Greens fall 1.5–2.5%, six or seven with one feature, three or four pin areas each | Should | `analyse.mjs` |
| 19 | Greens deeper than wide, angled both ways; three of a style at most | Should | `analyse.mjs` |
| 20 | Fairway width changes 30% or more along a par 4/5 | Should | `analyse.mjs` |
| 21 | Every fairway bunker has a job and touches the fairway; no bunker pattern twice | Should | `analyse.mjs` |
| 22 | Room for the tips tee on every hole | Should | the plan-book checks |
| 23 | Grand visuals by layering; edges that wander; chasms that catch the eye; big sand now and then | Taste | a review round |
| 24 | Fairway forms: no form more than twice, never two in a row, two plain strips at most, no two fairways measured alike | Must | `alike.mjs` |
| 25 | No kind of feature more than twice a nine, and the second does a different job | Should | the hole cards |
| 26 | Against the other courses: three or more kinds of set piece nobody has used, two at most from the over-used list, two fairways at most that match an earlier course's | Should | the register, `alike.mjs all` |

# Part 3: the rules by topic

## Skeleton (Must, new 11 November 2026)

Measured across the seven courses built or planned: every one is par 36 with two par 3s and two par 5s; every one
opens with a par 4; five of seven have a par 3 third; the last four (The Reclaim, Rimeholm, Emberfell, the Lost
Valley) all put an S-bend par 5 fourth, a drivable par 4 fifth or sixth, a cape right seventh or eighth and a
sidehill climb to a clubhouse ninth; The Reclaim and Emberfell have the same par order hole for hole. Each hole
was designed on its own merits and the nine was filled in the same order every time.

- **Start a course from its skeleton, and check it against the register** (`docs/COURSE-REGISTER.md`,
  `node tools/review/design.mjs all`). Against every other course: not the same par order; the same par on six of
  nine holes at most; no more than one set piece in the same slot (the big drop, the big climb, the drivable par 4,
  the S-bend or double-dogleg par 5, the long par 3, the cape).
- **Vary the card.** Par 35, 36 or 37. One to three par 3s and par 5s. A par 5 or a par 3 can open. Now and then
  two par 3s or two par 5s in a row as a set piece (once on a course, written on the course card); otherwise not.
- **Vary how it opens and finishes.** Used so far: a drop off a ledge to open (four courses) and a climb to the
  clubhouse to finish (all seven). Until three courses finish another way, a new course doesn't finish with a
  climb to a clubhouse. Other finishes: downhill to a green beside water, a par 3 over the signature hazard, a
  reachable par 5, a green in an amphitheatre, an island green, a green under the landmark the round has been
  walking toward.
- A course already in review rounds keeps what Rhys has approved; change its skeleton only where that is cheap
  (swap two holes' order, turn a par 4 into a par 5 where the ground allows) and ask him first.

## Decisions (Should, measured; rewritten 11 November 2026)

The old rule was "only a few real bold-or-safe choices", with no number and no test, and only Rimeholm marked its
bold lines in the data.

- **Two to four decision holes a nine** (Rhys's number), no type twice, never three in a row, and one of them in the last two
  holes. The other holes have one clear line: the interest there is the feature, the ground and the shot.
- **Types:**
  - *Bite off what you dare* (a cape): a diagonal carry from the tee, more carry for a shorter second.
  - *Drivable par 4*: 280–320 yd from the back tees, a green that takes a running shot from one side, real trouble
    for the miss, and a lay-up that leaves a full shot.
  - *Go or lay up*: a par 5 with a cross hazard across the second shot, or a green that only opens from one side.
  - *Split fairway*: one lane shorter or with the better angle, the other wider and safer, each 25 m or more.
  - *The long way round*: the easy path is longer (a club or two, or an extra shot) and has less danger. The
    direct path crosses or skirts the hole's signature hazard. Both paths are fairway all the way.
  - *Centre-line hazard*: a bunker, rock or tree in the middle; left and right play differently.
  - *The bottle*: wide short of the pinch, narrow beyond it; lay back or thread it.
  - *High road, low road*: an upper shelf with the view and the angle, a lower one that is easier to hit.
- **The bold line must pay.** It leaves 25 yd or more less, or opens the green (the approach comes in along the
  green's long axis instead of across a bunker), or reaches a par 5 in two. Otherwise it is only a harder way to
  play the same hole.
- **The safe line costs about half a stroke, not two.** Its trouble is rough, sand and a longer or blinder
  approach; it never has penalty ground on both sides. A weak player can always finish by it.
- **The risk is on the bold line and you can see it.** Both routes and the hazard that makes the choice are in
  the tee view (see "The view"), and both are `targets` in the data: the bold one carries `bold: true`. The hole
  card gives each route's numbers.
- **Measured.** `design.mjs --only=decisions --seeds=24` plays both routes for a long hitter (about 295 yd from
  the back tees) and a short one (the third tee set). A choice is real when the bold
  line pays for one of them and not for the other, or pays in strokes but at a clear risk of a penalty. If it pays
  for everyone at no risk it is simply the line; if it pays for no one it is a trap. (The tool's player is a
  decent amateur's scatter with no lie costs or wind, so read differences, not totals.)
- From the shape review, still true: design the hole from the green back. The green's open side decides the
  better side of the fairway; the fairway hazard sits on that side, so the good angle costs a risk.

## Classic hole types (Should, new 11 November 2026)

Red Mesa was built on a Cape, a Redan, a Biarritz, a punchbowl and an Alps, and it is the course that plays most
like a real one. Pick four or five a course, dress them in the theme (the hazard is lava, the dune is a serac),
and don't repeat another course's set. The register lists which are used.

| Type | The idea |
|---|---|
| **Cape** | A diagonal carry from the tee over the hazard; the more you carry, the shorter the second. |
| **Redan** | A par 3 whose green is angled about 45° and falls away from front right to back left behind a deep front bunker; play to the high shoulder and let it feed. Reverse it for a fade. |
| **Biarritz** | A long par 3 (or a long approach) to a deep green with a swale across its middle. |
| **Eden** | A mid-length par 3 to a green tilted hard from back to front, bunkers short left and right, trouble long. |
| **Short** | A wedge or short iron to a big green ringed with sand, with a bowl or horseshoe ridge inside. |
| **Alps** | A blind approach over a hill to a green in a hollow, with a marker on the crest. |
| **Punchbowl** | A green sunk into level ground whose banks feed a near miss in. |
| **Road** | A drive that cuts a corner, then a green set at an angle with a deep pot at its front and a hazard hard behind it. |
| **Bottle** | A fairway that narrows in steps past staggered bunkers: wide if you lay back, tight if you go on. |
| **Channel** | A second fairway out across the hazard that shortens the hole for whoever carries to it. |
| **Leven** | A short par 4: the hazard is on the side of the fairway that opens the green; from the safe side the green hides behind a mound. |
| **Double Plateau** | A green with two raised shelves and a low middle. |
| **Hog's Back** | A fairway along a ridge that sheds anything off the centre line. |
| **Sahara** | A carry over a great waste of sand, blind or nearly, to a wide fairway beyond. |
| **Long** | A three-shot hole with a cross hazard set where the second shot wants to finish. |
| **Dell** | A par 3 whose green sits hidden behind a bank, played over a marker. |

## Features: the fantasy has a golf job (Should, new 11 November 2026)

The rule was "every hole has a feature of its own". It said nothing about what the feature does, and almost every
feature built so far is a hazard.

- **Every feature takes a job a real course gives its landforms.** At least one; the hole's signature feature
  should take two.
  - *Hazard*: it costs a stroke or a lie (the lava, the Deep, the tar pit).
  - *Aim point*: the thing you pick your line off (a hornito on the crest, the longship's prow).
  - *Frame*: a backdrop that the green or the flag reads against, or a gate the tee shot is seen through (the
    frozen falls behind the shelf, the root arch).
  - *Obstacle*: you play over, under, through or round it (the Atrium's lobby, the natural arch, the pinnacle).
  - *Lie-setter*: it decides where the ball stops and how you stand (rimstone terraces, a lava bench).
  - *Helper*: it saves or feeds a ball: a wall that backstops a long approach, a bank that feeds to the pin, a
    speed slot down an old channel, a rim that holds a near miss at green level.
- **At least two helpers a nine.** A course where the scenery only ever takes strokes plays harder than it looks
  and stops being fun; real courses are full of friendly slopes.
- **The feature shapes the play and is seen from the tee**, and ideally from other holes. Layer the view: the
  feature in front, the hazard round it, the landmark beyond.
- **Big enough to read on a phone.** The screen is about 390 px tall at a 50° field of view, so 1° is about 8 px.
  A feature that matters from the tee should stand 40 px or more: about 22 m tall at 250 m, 13 m at 150 m.
  The longship's bow was "still small at 100 m".
- **One logic per course.** The fantasy obeys a rule the player can learn (clouds are a penalty area; ice runs;
  facades soak a ball), falls have a source, nothing floats unless floating is the course's rule, and animals
  and props stay off the lines of play.

## Landmarks and sightlines (Should, new 11 November 2026)

- **Two to four landmarks a course**, each seen from three or more tees or landing areas, from different sides.
  The course card carries the table (landmark by hole: seen from the tee, from the landing area, or not).
- **One planned reveal.** Hide the course's best view until one tee: Emberfell's caldera is first seen from the
  5th tee because a rampart closes the Notch from below. Check the hiding as carefully as the showing (the 4th
  tee once looked straight through the gap).
- **Every tee view has three layers**: something near (the feature, a tree, a rock), the hole, and the distance
  (a landmark, other holes, the skyline). Check from the tee render, not the plan.
- Chasms and crevasses read from the tee: a jagged outline, a raised lip on one side, walls you can see down
  into, and more of them as scenery, layered into the distance. Ridges, shelves and cliff edges wander at three
  scales (bays and prows tens of metres long, crags inside them, a broken crest); never a straight line or a
  regular zigzag.

## The view from the fixed camera (Should, new 11 November 2026)

The game's camera stands 3.2 m behind the ball at eye height and never tilts. At a 50° field of view it shows
from about 19° above level to 31° below. Nothing in the rules allowed for that.

- **The tee shot's target is in the frame and you can see it**: the landing area, and on a decision hole both
  routes and the hazard between them. `design.mjs` checks the angle and the sight line from the back tee.
- **Two blind tee shots a nine at most**, each on purpose (an Alps, a crest), each with a marker on the line.
  Blind approaches count toward the same two.
- **A tee on a lip hides what is below it.** From 3.2 m behind a ball at the edge of a ledge, the ledge itself
  hides the ground in front. Set the pad so the lip is under the ball (a pad stops at a ledge's lip in the
  engine), or bring the landing area further out, and check the tee render.
- **The view sells the height.** A big drop needs something to read it by: a waterfall, a line of lanterns down
  the fairway, a lit green far below.

## Rhythm of the nine (Should, new 11 November 2026)

- **A gentle opener**: wide, no forced carry, no penalty ground within a small miss, a view that sets up the
  course. The big drop off a ledge is a fine opener, but four courses have used it.
- **The hardest holes in the middle** (the 4th to the 7th), **a breather after the hardest**, and a finish with
  a decision or the course's set piece rather than simply its longest hole.
- **Spread the lengths.** From the back tees: a par 4 of 340 yd or less and one of 420 or more, no two par 4s
  within 15 yd of each other; par 3s 25 yd or more apart plays-like, facing different ways, and over a course's
  par 3s a short iron and a long one. Approach clubs across the nine should run from a wedge to a long iron.
- **Turn the compass.** Holes face three or more quarters, no three in a row the same way, so a set wind plays
  differently hole to hole.
- **Balance the bends and the shots.** Left and right bends within two of each other, three straight holes at
  most, and as many holes that favour a draw as a fade (the lean, the green's angle and the hazard side decide
  which a hole favours).
- **No two in a row alike**: not the same par and bend, the same fairway structure, the same kind of height
  change (a drop off a ledge, a long fall, terraces, a climb out of a bowl, a rise to the finish), or the same
  green feature.

## Misses, graded (Must for penalty ground, Should for the rest; new 11 November 2026)

"A miss must cost something" and "never overly hard" were both true and neither had a number. Measure a miss from
the line the hole asks for, at the distance the shot lands. A decent amateur's drive scatters about 13 yd to one
side for every standard deviation.

| Miss | From the line, at a drive's landing | It costs | What goes there |
|---|---|---|---|
| None | within 20 yd | nothing | fairway, 45–65 m wide |
| Small | 20–35 yd | a lie, never a stroke | first cut, rough, the low side of a lean, a worse angle |
| Medium | 35–55 yd | a shot, with a recovery back to the fairway | sand, waste, native ground, trees, rubble at a wall's foot |
| Big | beyond 55 yd | a penalty or a lost hole | void, water, lava, a crevasse |

- **Penalty ground on one side at most** (Must). Where clouds, lava, a chasm or water come within a medium miss
  on one side of a landing area, the other side has room to the same distance. Never both sides, and never both
  sides and long.
- **The bold line is the exception.** On a decision hole the bold route may have penalty ground at a small miss,
  on one side. The safe route never does.
- **Round a green**: penalty ground on one side at most, short grass or a bank on the other, and the hole card's
  miss map says which side is the safe miss. Match the surround to the shot in: a rim or bowl that holds a near
  miss after a long or blind approach, a false front or a run-off after a short one.
- **A wall must not keep a shank in play.** Cave walls and facades soak up some balls (they drop into rubble at
  the foot) and bounce the rest. Stalagmite stands, groves and fairway-lining sand sit where medium misses land,
  the way trees work on a parkland course.
- **Forced carries** (Must): none longer than 60% of that tee set's drive (its `minDrive`, or 150 yd for the
  forward set), and a way round on fairway. A par 3's tee shot is its carry, so there only the forward tees are
  held to the 60%, and there is no way round to find.
- If a hole already plays hard, its ground never kicks toward trouble; lean it away (see "Fairway ground").

## The playability gate (Must, new 11 November 2026)

`node tools/review/design.mjs <course>` plays every hole from the back tees at full length and from the forward
tees with a player who hits it 80% as far, a decent amateur's scatter on every shot.

- **Every hole finishes, every time.** A hole the tool cannot finish, or a run of the same lie, is a layout bug,
  not bad luck.
- **No hole plays worse than +1.5 to par** for that player, from either tee set, and the nine averages under
  +1 a hole. More than +2 on a hole fails. Under par is fine: the forward tees should be gentle. (The tool skips lie costs, stances, branches and wind, so the
  real game plays a little harder.)
- **Penalties**: under one for every three holes across the nine.
- Then the game itself: `tools/review/playthrough.mjs` on the holes that changed.

## Sameness: the repeat budget (fairways Must, the rest Should; new 11 November 2026)

Rhys, after the rules review: "I was getting pretty frustrated that all the fairways seemed to be the same rough
shape with no interesting things about it or features to mix things up." And the limit he set: **there can be
some repeat, but not a lot.**

He was right, and it was measurable. `node tools/review/alike.mjs all` walks every par 4 and 5 fairway and
compares each with every other. On 11 November 2026, of 49 fairways across seven courses, 17 were one shape (a
spindle: narrow at the tee end, widest where drives land, narrow again), and no course had a fan, a funnel, a
bowl or a hook anywhere. The Reclaim had five spindles of seven and six pairs the check couldn't tell apart;
Emberfell three spindles and three hourglasses; Hollowmere four spindles. The cause was in the data: almost every
fairway began from the same numbers (`[60, 14, 14], [100, 22, 22], [150, 28, 28], [200, 32, 30]` ...) with the
hazards arranged round it. The Lost Valley's round 2 cured that by splitting or breaking every hole, which is
its own repeat: four splits and three broken fairways.

The earlier checks looked at one hole at a time. These look across the nine and across the courses.

**On one course**

| What | The budget |
|---|---|
| **Fairway form** (Must) | No form more than twice. Never the same form two holes running. Plain strips (spindle, ribbon, uneven) two at most. No two fairways the check measures as alike (under 0.25), mirror images included. |
| **Kind of feature** (a lone tree, a water crossing, a rock in the fairway, a cliff edge, an arch, a bridge, a fall) | Twice at most, and the second time it does a different job (see "Features"). |
| **Decision type** | Once. |
| **Green** | A style three times at most; an outline (kidney, peanut, L, clover ...) once; a contour feature (tier, bowl, spine) three times at most. |
| **Bunker pattern** | Once. "One each side of the landing area and two at the green" is a pattern. |
| **The main threat** | The same hazard on the same side three holes at most, and never three in a row. |
| **Kind of height change, par and bend** | Never two holes running (see "Rhythm"). |

**Against the other courses** (`docs/COURSE-REGISTER.md` keeps the counts)

- A new course brings **three or more kinds of set piece no course has used**, and takes **two at most** from the
  kinds already on three or more courses (today: a waterfall backdrop, a tee shot off a ledge, a punchbowl, a
  bridge, a chasm beside the fairway, a climb to the clubhouse, something to play through or under).
- **Two of its fairways at most** match a fairway on an earlier course (`alike.mjs all`).
- Its classics overlap any one other course's by two at most.

A repeat inside the budget is fine, and sometimes right: a course's logic wants echoes (lava on most of
Emberfell's holes, the Deep seen from four of Hollowmere's). What the budget stops is the default: reaching for
the same shape or the same trick because it was the last one used.

## Fairway forms (Must with the budget above; new 11 November 2026)

`docs/fairway-forms.svg` (and `.png`) shows the twelve forms, each built from the plan tools' own pieces and named by the
check, so the picture, the builder and the measurement agree. `tools/review/forms.mjs` holds the data for each:
copy a piece list into a hole's `fw` and adjust.

| Form | What it is | What it asks |
|---|---|---|
| **Spindle** | Narrow, widest where drives land, narrow again. The stock shape. | Nothing much. Two a nine at most. |
| **Hourglass (Bottle)** | Wide short of a pinch, tight beyond it. | Lay back to the wide part, or thread it. |
| **Fan** | Opens toward the green. | The longer the drive, the more room: it rewards the bold. |
| **Funnel** | Generous off the tee, closing all the way in. | The long drive is the hard one: it rewards restraint. |
| **Bowl** | One basin nearly as wide as it is long. | The ground does the work: where the ball feeds to decides the next shot. |
| **Hook** | Wraps round a hazard; the line to the green crosses it. | How much to cut off. |
| **Split** | Two lanes round a feature. | One shorter or with the angle, one wider. |
| **Island (doughnut)** | One fairway with a hole in it: a tree, a rock, a pot. | Left or right of it. |
| **Broken** | Cut in two by a cross hazard. | Lay up or carry. |
| **Stepping stones** | Islands of fairway through the hazard. | How many to skip. |
| **Double (Channel)** | A second fairway out across the hazard. | The carry to it shortens the hole. |
| **Scalloped** | Hazards bite in from alternate sides. | The line weaves; pick a side for each shot. |

- **The sheet shows each form in its plainest state, on a straight line. That is the starting point, not the
  hole.** A form is measured along the playing line, so it bends with the hole: any of them can be a dogleg,
  an S-bend or a cape, and the bend is chosen separately (see "Hole shape and outline"). Then give it character
  (Taste, Rhys 11 November 2026): uneven edges, one side fuller than the other, the wide part off-centre, the
  ground's own lines showing in the outline. Two holes of one form should not look like the same drawing.
- **The exotic forms sparingly** (Taste, Rhys 11 November 2026). A **bowl** once a course at most, and never
  the round basin on the sheet: an irregular shape that follows its hollow. **Stepping stones** once a course at
  most, as a few large stones (two to four, each a proper landing area of 40 m or more) so it still reads as a
  golf hole; many small ones are a mini game. Island, double and scalloped are the next most unusual: once or
  twice. The everyday variety comes from hourglass, fan, funnel, hook, split and broken, bent and shaped.
- **Choose the form from the hole's story, before any numbers.** Never start a fairway by copying the last
  hole's knots. A hole whose card says "spindle" needs a reason on the card.
- **The plan tools draw all of them** (`tools/<course>/shapes.mjs` `makeFairway`). A piece is a ribbon
  (`{ e: [[s, L, R] ...] }`: its two edges at knots along the line), a free shape (`{ lobes: [[s, off, along,
  across, rot] ...] }`: a smooth union of ellipses placed by distance along the line and offset from it), or a
  cut-out (`{ bite: [...] }`: the same shapes removed from the rest). Bowls, hooks, stepping stones and the far
  half of a double fairway are lobes; an island in the middle and a scalloped edge are bites.
- **A form needs the ground to match.** A bowl is a real hollow; a hook's inside edge falls toward its hazard; a
  funnel's sides rise. A shape painted on flat ground is still a strip to play.
- **Every tee set still lands on enough fairway** (40 m, or two lanes of 25 m): a fan's narrow end and a
  funnel's are measured where each tee set's drive finishes, so move the tees to suit the form.
- Beyond the twelve, invent. The check names anything it doesn't know "uneven" and still compares it.

## Hole shape and outline (Should)

- Vary the shapes: doglegs both ways, a cape, an S-bend, a drivable par 4, a par 3 over water, a blind
  uphill par 3. Straight holes only now and then.
- **Check a dogleg's direction from the geometry, not the label.** The sign of the cross product of the
  two legs (with x east and z south, positive is a right turn). The Cenote was once labelled one way and
  built the other.
- A drivable par 4: 280–320 yd on the card from the back tees (the three built are 300 and 320), from a raised
  tee where the ground allows, a safe way round, and a bold line that really works (simulate a tour drive
  through it in a test). See "Decisions".
- **Vary the outlines of greens and fairways (agreed with the owner, Rimeholm round 2).** No plain circles,
  ovals or constant-width strips: they read as placeholders. Give each green its own shape and size (a
  kidney, a peanut, a crescent, an L, a long thin diagonal, a clover, a T; roughly 450 to 750 m²), with an
  uneven edge and the pin well inside a lobe, never in a waist. Let each fairway's two edges vary on their
  own along the hole: swell where drives land, pinch between landing areas, scallop along the edges, and
  let bunkers, crevasses and rocks bite in. Splitting a fairway now and then is good. Keep the 45–65 m
  width where drives land and pins at 3% or less. Rimeholm's `tools/rimeholm/shapes.mjs` (`makeGreen`
  from lobes, `makeFairway` from edges along the line) is one way to build them; in the engine a green takes
  `lobes` (the same format) and a painted fairway a half-width per point.
- **Flowing lines, not squiggles.** Vary a fairway's width at the scale of the hole: swell where drives land,
  pinch between landing areas or where a hazard bites in, over stretches of 40–80 m, the edge following the
  ground. Small jags only on natural edges (rock, a crevasse, rubble). Along a par 4 or 5 the width under the
  line should change by at least 30%. The rough line varies too, coming in where the hole wants to be hard and
  backing off where it doesn't; no constant collar of rough round the fairway.

## Fairway structure and big sand (Should)

Rhys's note on round 1 of the Lost Valley: the holes were starting to feel rinse and repeat (the same tapered
strip, doglegs one way then the other, a bunker on each side).

- **Vary the fairway's structure, not just its outline.** A split fairway round a tree or a rock (two lanes,
  each 25 m or more where drives land, one shorter or with the better angle, the other wider and safer); a
  fairway broken in two by a cross hazard (a creek, a back channel, a band of sand); stepping stones of fairway
  between pools with a dry way round; an hourglass pinched by hazards from both sides; a fairway climbing a step.
  Two plain single fairways a nine at most, no structure more than twice, and never two of the same in a row
  (see "Sameness" and "Fairway forms": splitting or breaking every hole is a repeat too). Doglegs alternating
  left and right is not variety on its own. A splitter has to stop a ball: branches low, or solid
  rock.
- **Big sand now and then.** It can be really fun to build a huge bunker: a waste or bunker running the length
  of a fairway (150 m or more down one side), a cross bunker right across the fairway short of a green, or a
  green set inside a ring of sand with one way in. Once or twice a course each, so they stay memorable. Equally,
  a hole with no sand at all is fine where another hazard does the job (the tar pit).
- **Put a cross hazard where it asks a question.** Short of where the safe drive finishes, or across the second
  shot, so long hitters choose between laying back and carrying; never right where every tee set's drive lands.
  A creek coming in on a diagonal is the classic: nearest on the bold side.

## Fairway ground: lean and contour (Should, measured)

Measured on Emberfell round 2 before these rules: fairways tilted 0–0.8% across on average. Real courses tilt far
more. Which way a fairway leans is settled here: **toward trouble only on a hole that is otherwise easy; on a
hole that already plays hard, away from it.**

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
  into the rough, blending out beyond; it moves the ball, it doesn't bounce it. (Since 11 November 2026 the
  physics bounces the ball off the ground's own slope, so a lean is felt from the first bounce: a tour drive
  finishes about 1.6 yd down a 3% lean and 3.4 yd down a 6% one, a 7 iron 0.8 and 1.7 yd. Steep banks beside a
  green now kick a ball that lands on them, so check an approach that is meant to run on from both sides.) The flatter "landing
  plateau" idea still holds for where most drives stop: a lean of 2–3% there, more just short of or past it.
- **Shape the fairway's ground, not just its outline.** Landing areas a little flatter where drives come to
  rest, rolls between. Give each par 4 and 5 one contour that matters: a spine down the fairway (a hog's back)
  that kicks a missed line away, a cant against the shot you want to play (reverse camber), a speed slot, a
  crest, a swale, or a slope that feeds the brave line toward the green's open side. Keep contours broad
  (15–40 m from crest to crest; their own slopes under about 4% where drives land, on top of the fairway's lean)
  so they move the ball rather than bounce it at random.
- **A cant is a soft hazard.** Lean a fairway toward trouble only on a hole that's otherwise easy; on a
  hole that's already hard, lean it away from the trouble (see "Side slope and green contour").

## Greens (pins Must, the rest Should, measured)

- **Angle the greens, and balance them across the nine.** Most greens a little deeper than wide (about
  1.2:1 along the approach; bogey players need about 20% more depth than width). Across nine: two or three
  angled left, two or three right, one or two straight on, one near 45° for a short approach, and one shallow,
  wide green on the longest par 3 or 4. Long approaches stay near the line; short ones can turn more (about
  1–3° per club). An angled green is what makes one side of the fairway better than the other.
- **Greens: moderate, like a modern course.** Overall fall about 1.5–2.5% (today's greens average about 2%;
  classic greens 3% and more). Most greens (six or seven of nine) also get one internal feature: a tier
  0.3–0.6 m high with a slope of about 1 in 6 to 1 in 7 between, a spine or ridge that splits it, a swale
  across it, a bowl that gathers to one pin, a back shelf, a crown that sheds the edges. A couple can be
  flatter (just the fall), and one bold green a nine is fine (a bigger tier, a Redan's fall, a Biarritz
  swale). Mix the features across the nine; no two neighbouring greens the same.
- **Pin areas stay puttable.** Three or four pin areas a green (two on a narrow one), each a disc about 6 m across, 3 m or more inside
  the edge, at 3% or less (pins tested); steeper ground goes between them and round the edges (ridges up to about 0.6 m at 10–15% where
  pins never go). Pins 1–1.5 m or more off a tier's top or foot. A green needs only 14–21 cup spots, so
  it can afford the contour.
- **The game already reads it.** The slope under the ball changes every shot (ball above the feet pulls
  left, uphill launches higher), and putting odds read break, tiers and downhill speed, so these play.
- **What the engine did before.** Every features.js green got three random humps and hollows (0.2–0.4 m)
  flattened only round its pins, so the playable greens were bumpy rather than designed (typical slopes
  2–6%, little puttable ground beyond the pins) and their real features hardly read. Greens now take a
  designed `shape` and no random rolls. Even so, contour barely shows in a render from short of the green:
  making it readable (shading on the putting surface) is an art job.
- **Measured, not eyeballed.** The book tools (`tools/emberfell/sample.mjs`) and `tools/review/analyse.mjs`
  report each landing area's cross slope and each green's fall, relief beyond its plane and pin areas.
- **A punchbowl is sunk into level ground, not rimmed.** The ground stays level up to the bowl, then banks
  fall about 1.2–1.5 m to the green and feed a near miss in. Nothing stands above the land round it: the
  engine's punchbowl once built a 1.6 m ring outside the green, which read as a donut (Rhys spotted it on
  Drift). A rim belongs only to a feature that has one (the Geode's cracked shell).
- **Green surrounds decide how hard a hole plays.** A rim or bowl (the geode) keeps near misses at green
  level; a false front sends short shots back; a punchbowl gathers. Pick one per green, matched to how
  hard the shot in already is.

Sources: golfcourseindustry.com "Modern green contours" (pin areas 3% at Stimp 10, greens about 2% now,
perimeter ridges to 2 ft at 10–15%); golfnewsstoriesonline.com "How much cup space does a green have?"
(14–21 cup spots, a 1 ft tier at 5–7 to 1 across 50–70 ft, pins 3–5 ft off a tier) and "Using fairway
slopes for strategy" (cross slopes to about 7% on level zones, 4–5% when also downhill).

## Bunkers (Should)

- **Fairway bunkers on the larger side (agreed with the owner, Rimeholm round 3).** Out where drives land,
  a bunker 25–40 m across, or a long one that follows a fairway's edge for 100 m or more, reads as a real
  hazard; a 10 m dot reads as a placeholder. Let them bite into the fairway's edge without taking the landing
  area under 45 m. Greenside bunkers can stay small, and sit at least 2.5 m off the green.
- **Bunkers each have a job.** Every fairway bunker is a carry bunker (short of the landing area, on the side
  with the better angle in), a target bunker (beyond it, so long hitters play up to or past it), an approach
  bunker (40–90 m short of the green on par 5s and long par 4s) or a catch bunker (between short grass and real
  trouble). Each one touches or bites into the fairway; a bunker out in the rough does nothing. No two holes on
  a course use the same bunker pattern. Greenside bunkers are the linchpin: their side decides the rest. Don't
  put a carry bunker close to the tee (it punishes the weakest players twice).
- **Pot bunkers are sunk, not rimmed.** A pot is a small (3–5 m), deep hole cut into the ground: a steep,
  revetted sod face toward the green, a flat sand floor, the back easing in from grade so you can walk in.
  No raised lip round it; only flashed bunkers build a lip up their face.

## Elevation (Should)

- **Every hole goes up or down.** Several holes 8–15 m, two or three big ones (25–35 m: a drive off a
  ledge, a climb to the last green). Never a run of flat holes.
- Within holes, use tilted fairways (see "Fairway ground" for which way they lean), terraces (rimstone banks), crests with blind
  shots, raised greens with false fronts, punchbowls and bowls that gather the ball.
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
- Climbs: keep the average grade under about 15% (a smoothstep ramp peaks at 1.5× its average).

## Tees (Must: off the fairway, nothing overhead; Should: the rest)

- Forward tees go on their own pads beside the fairway, at least 12 m clear of it, never on it.
- A floor-to-roof feature in front of the back tee (a column, a fin) segments the tees and makes the
  back-tee shot think.
- **Check the landing area for every tee set.** For each tee set, the drive (its `minDrive`, or about 150 yd
  for the forward set) lands on fairway at least 40 m wide. On long holes a staggered landing area for the
  forward tees is fine.
- **Leave room for a tips tee (agreed with the owner, 10 November 2026).** Every course will get a fifth set
  of tees behind the back set, at tour length: about 7,200–7,400 yd for 18, so 3,600–3,700 yd a nine (today's
  back tees run about 3,300). Design for it from the plan: ground behind each back tee for a pad 20–50 yd further
  back on the par 4s and 5s (a par 3 can stretch less), not a cliff, a wall or another hole's green; the landing
  areas and their hazards still working for drives that carry 280–300 yd (fairways wide enough there, bunkers and
  carries that matter from the tips without taking the landing area under 45 m); nothing overhead within 45 m of
  that pad either; and the pad off the fairway, like every tee. Sketch the tips spot on the plan even before the
  tee set exists, so adding it later is data, not a redesign.

## Water (Should)

- **One continuous pool is a river channel at one level** (`rivers`, wide `w`), not a ring of ponds:
  small ponds are dishes and read as separate puddles.
- Streams run downhill as level pools a few metres apart (`streams` in holes.mjs): a cascade.
- A pool that wraps a green sits on the same flat as the green, level with it.
- Falls need a source that makes sense: off a lip, in through a hole in the roof, down terraces.

# Part 4: the process

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
6. **Make it playable**: targets on every hole, the gate passed, tests for the course, a tile on the menu.

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
- **Play every hole headless before calling it done**: tee to holed with the simulated tool and auto-aim
  on, logging each lie (`tools/review/quickplay.mjs` in minutes for a whole course, `playthrough.mjs` in the
  game itself for the holes that changed). A hole that never finishes, or a run of the same lie, is a layout bug, not bad
  luck.

# Part 5: building notes

What the engine and the tools taught us. Read the part for the kind of course you are building.

## Building height

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
- **Tiers, ledges and walls can stay, but the fairway gets through them on a ramp.** The Climb's tiers were
  slabs whose front edges stood as 14 m walls across the fairway: drives stopped dead at the foot and no
  club could climb out. Now the walls stay and the fairway climbs a gully eroded through each one (a
  sloped island between two wall pieces, with rockfall at the foot of the gully walls).
- **Islands that meet must overlap.** Two superellipses laid edge to edge leave a slot down to the floor between them
  (rounded corners make it worse where three meet): The Climb had them along both gullies and between its tiers, and
  Rimrock's promontory was cut off by one. Tuck a ramp or a lower piece a few metres under its neighbours (the higher
  top wins), add a small filler where three corners meet, and run `tools/review/slots.mjs`.

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

## Where the rules came from

- The Aerie and Red Mesa (to 9 November 2026): the hole format, elevation on every hole, classics on Red Mesa,
  fairways 45–65 m, the ramp through The Climb's tiers.
- Hollowmere (three review rounds): build height from the floor, no accidental plateaus, a miss must cost,
  water as one channel, targets on every hole, play every hole headless, the pipeline gotchas.
- Rimeholm rounds 2–4 (10 November): varied outlines for greens and fairways, larger fairway bunkers, edges
  that wander, chasms that catch the eye, the true punchbowl.
- The shape review (10 November): angled greens, design from the green back, flowing edges, bunkers with jobs,
  sunk pot bunkers, every tee set's landing, three greens of a style at most.
- Side slope and green contour (10 November): leans, the strong sidehill, designed green features, pin areas.
- The tips tee (10 November). Story, features and fairway structure, big sand (Lost Valley round 2, 10 November).
- The rules review (11 November): this layout, the cards, the Must/Should/Taste tags, and the new rules:
  skeleton and register, measured decisions (two to four a nine), classic hole types, feature jobs, landmarks
  and sightlines, the fixed-camera view, rhythm of the nine, graded misses, the playability gate; then, the same
  day, the repeat budget and the twelve fairway forms, after Rhys asked whether the rules would really stop every
  fairway coming out the same shape (measured: 17 of 49 were). Contradictions
  settled then: fairways are 45–65 m (the playbook said 50–65); contours are under 4% on top of a lean of 2–5%;
  a cant toward trouble only on an easy hole; a drivable par 4 is 280–320 yd (the old text said metres).
