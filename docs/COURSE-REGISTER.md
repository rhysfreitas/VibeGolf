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
| The Reclaim | 4R | 4L d | 3 | 5S | 3 ↓ | 4 d | 5L | 4R | 4 ↑ | 36 |
| Rimeholm | 4R ↓ | 4L | 3 | 5S | 4 d ↓ | 3 | 4R | 5L | 4L ↑ | 36 |
| Emberfell (playable blockout, round 7) | 5L | 4 | 4L | 3 ↓ | 4R d | 5L | 4R | 3 | 4R | 36 |
| The Lost Valley (playable blockout, reshaped 12 November) | 4R | 5R | 4L | 3 | 5L | 4 ↑ | 3 ↓ | 4 d | 5L | 37 |

What repeats (11 November 2026):

- Every course is par 36 with two par 3s, five par 4s and two par 5s.
- Every course opens with a par 4, and six of seven open bending right.
- The 3rd is a par 3 on five of seven; the 4th is an S-bend par 5 on the last four.
- A drivable par 4 sits 5th or 6th on the last four.
- The Reclaim and Emberfell have the same par order. The re-laid Lost Valley (par 37) shares a par with another
  course on four holes at most (Red Mesa).
- Every course finishes by climbing to a clubhouse or camp (the Aerie +5 m, Red Mesa +29, Hollowmere up into the
  cenote's light, The Reclaim +28, Rimeholm +38, Emberfell +17), except the re-laid Lost Valley, which finishes down
  to the shelf green in the plunge pool (−12).
- Three open with a drop off a ledge (Hollowmere −32 m, The Reclaim −12, Rimeholm −30); the re-laid Lost Valley
  opens off a low knoll (−10) and drops off its ledge at the 7th.

### Assigned on 11 November 2026 (Rhys's picks; not yet drawn)

Emberfell and the Lost Valley were re-laid to new skeletons, each in its own chat
(`claude/brief-emberfell-skeleton.md` and `claude/brief-lost-valley-skeleton.md` in the project). The Lost
Valley's measured row is in the table above (Rhys approved plan book round 3 on 11 November: "looks good, let's
build"); Emberfell's row stays here until its layout is approved. Check a new course against these rows as well.

| Course | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | Par |
|---|---|---|---|---|---|---|---|---|---|---|
| Emberfell (drawn in round 6; the row above) | 5 Kipuka | 4 Barranco | 4 Lava Tube | 3 ↓ The Crown | 4 d Terraces | 5 Lavafall | 4 The Lake | 3 Cinder Cone (now inside the caldera) | 4 The Heart | 36 |
| Halcyon Ring (plan book round 5) | 4 Promenade | 3 Walled Garden | 4 Terminator | 5 ↑ Long Window | 3 ↓ Balcony | 4 Long Lake | 4 d Spoke | 5 Aqueduct | 3 the Great Window | 35 |
| The Buried Kingdom (blockout, 13 November 2026) | 3 The Landing | 5L The River Bank | 4 The Causeway ↑ | 4R Sahara | 3 The Sphinx | 5R Hog's Back | 4L The Quarry | 4R The Gate | 4L The Colossi | 36 |

- The Buried Kingdom (Rhys's picks, 12-13 November 2026; `claude/buried-kingdom-layout.md` and
  `claude/brief-buried-kingdom.md` in the project; `tools/buriedkingdom/`): Egyptian ruins half buried in sand, an
  invented site, in blazing late-morning light; the river (1-3), the plateau (4-6), the cliffs (7-9). Its logic: off
  the grass is sand in three bands (rough 8-15 m, then firm sand that plays as the game's waste area, soft dunes
  only as placed features); water on the 1st and 2nd only. The first course to open with a par 3; no drop par 3; a
  downhill finish to the camp. Same par as another course on four holes at most. Falcon 3,470 yd, Cobra tips 3,730
  (switched off). 1 The Landing 3 145 (level across the boat basin, a 960 m² green, a beach as the bail-out),
  2 The River Bank 5 590 (scalloped, a dip in front), 3 The Causeway 4 435 (a funnel up a raised processional way,
  +22 m, 36 m wide where the back tee lands, no bunker), 4 Sahara 4 385 (a hook round an 8,000 m² blowout, the hole
  past real golf; valley carry on the bold line; the long way round), 5 The Sphinx 3 200 (a lion's mouth: a
  horseshoe green round a pit between the paws, +7 m), 6 Hog's Back 5 500 (a dune's crowned crest, broken by a
  blowout, to a 370 m² skyline green; go or lay up), 7 The Quarry 4 335 (off a 20 m lip to a 9% hillside bench,
  seven spoil pits), 8 The Gate 4 410 (a fan up a 6.5 m table top between two gate towers), 9 The Colossi 4 470
  (an island fairway round a fallen obelisk, a fall-away into the forecourt; centre-line hazard). Plan book round 1
  13 November 2026 (`out/buried-kingdom-plan-book-r1.pdf`): `alike.mjs` 0 of 21 (seven forms), `relief.mjs` nine
  forms, none twice (bold 4, 7, 8), `spread.mjs` no cluster. Round 2 the same day (`out/buried-kingdom-plan-book-r2.pdf`, Rhys's picks): the
  2nd leans 2.2% toward the river; three dunes drifted over the 3rd's causeway from alternate sides and three
  round the 4th's grass, each lifting one edge of the fairway about 2 m (side undulation). A terrace across the
  2nd's fairway was drawn and dropped (a river plain has no height). A playable blockout since 13 November 2026
  (`?c=buriedkingdom`; Rhys: "go ahead and build"). The engine's findings, fixed in the targets and not the
  ground: the 8th's lay-up target 40 m short of the face's foot and its terrace target 246 m out; the 9th's bold
  target past the obelisk (25 yd nearer the green) and a lay-up target short of the forecourt. Gate: no hole worse
  than +0.8 (the 9th from Scarab, an 80% player).
- Halcyon Ring (Rhys's picks, 11 November 2026; `claude/brief-halcyon-ring.md`): a pristine garden colony
  inside a ring space station; floor windows onto space are the penalty area; the ball flies as on Earth. The
  first par 35, the first with three par 3s, the first par-3 finish (across the Great Window to the clubhouse).
  Same par as another course on four holes at most (Hollowmere, The Reclaim, Rimeholm).
  Routing check sent 11 November 2026 (`tools/halcyon/`, page "Halcyon Ring Routing"); plan book round 1
  12 November 2026; round 2 the same day (`out/halcyon-plan-book-r2.pdf`), from the height-forms and dials
  addenda, every change Rhys's pick; rounds 3–5 the same day (`out/halcyon-plan-book-r5.pdf`): the rim glass a band
  24 m wide round both rims segmented every 120 m by beams on the wall's ribs, a sill at the wall (Rhys's idea, rounds 3–5), the 1st's green one piece: R = 5 km, 900 m wide; the curve plays as it looks; windows are glass, a
  penalty area. Zenith 3,105 yd: 1 The Promenade 4 380 (a 90 m half-pipe lawn, Double Plateau), 2 The Walled
  Garden 3 115 (the postage stamp, a 290 m² green; an Eden until it shrank), 3 The Terminator 4 430 (Road, the
  church pews in the pinch, eleven bunkers), 4 The Long Window 5 545 (cape over a floor window, +26 m in three
  terraces), 5 The Balcony 3 230 (−15, off the high terrace's lip to a green over the rim glass), 6 The Long Lake 4
  455 (a 10% hillside bench), 7 The Spoke 4 310 (drivable up a table top round the spoke's foot, Leven, a
  1,400 m² green: the hole past real golf), 8 The Aqueduct 5 490 (Channel, reachable, go or lay up at the canal),
  9 The Great Window 3 150 (across the window sunk in an amphitheatre, tee and green level on its rims). Forms
  fan, hourglass, hook, scalloped, island, split (`alike.mjs halcyon`: 0 of 15 alike, none like another
  course's). Classics Double Plateau, Short, Road, Leven, Channel (all new); decisions 4, 7, 8; set pieces the
  postage stamp and the church pews. Tees Zenith, Meridian, Horizon, Nadir; Kingfisher tips (switched off) 3,330
  yd. A playable blockout since 12 November 2026 (`?c=halcyon`). Three from the over-used list (one over): a waterfall, a bridge and the 4th's terraces.
- Emberfell: a par 5 opens (first course to); three holes outside, the drop off the rim 4th, five inside; the
  island finish stays. Same par as another course on four holes at most (Rimeholm). Drawn in round 6 (11 November):
  3,550 yd from the Obsidian tees (3,435 before the variety changes of 12 November), 3,795 from the Magma tips (switched off in the data; round 7 moved the Lake's spot off the Lavafall's approach, and the Terraces went from 300 to 340 yd so a hybrid no longer reaches the green).
- The Lost Valley (approved and built as a blockout, 11 November): starts on the valley floor; the climb to the
  ledge is the 6th and the drop off it the 7th; the drivable par 4 is the 8th; a reachable par 5 finishes at the
  shelf green under the Great Falls. First par 37, first with three par 5s, first not to finish with a climb.
  Titan 3,395 yd, Brachio tips (switched off) 3,670. Reshaped 12 November (height forms and dials, Rhys's picks): the
  1st bends 70°, the 2nd is 610 yd with a burn, the 4th a 115 yd postage stamp; Titan 3,455 yd, tips 3,690.
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
| **Hollowmere** | Walls soak a ball; lit play in the dark | Punchbowl (5, 8) | Bite the corner (4), thread the stalagmites (3), over the trestle (7), drivable through the eyelet (9) (all `bold: true`, 11 November); the Adit (1) is one clear line | Ore cart that moves (1), Mirror Lake (2), terraces (3), the Deep and its falls (4, 6, 7), geode green (5), glowworm grotto (8), cenote (9) | None |
| **The Reclaim** | Facades soak a ball; streets are native ground | Punchbowl (3), Redan and plateau greens, Bottle (4) | Drivable through the lobby (2, a great drive from the back tee only), the bottle at the crest (4), drivable, running on from the right (6), bite off the basin (8); two drivable par 4s on purpose (Rhys, 11 November): a thread and a carry up 9 m on the 2nd, a running shot on the 6th | The El (1, 6), gutted tower (2), subway cave-in (3), propped tower (4), stadium and sinkhole (5), fallen bridge (7), rift and leaning clubhouse (9) | None |
| **Rimeholm** | Ice runs; powder buries; hot springs keep greens alive | Redan (7), punchbowl (8), Bottle (9) | Drivable through the seracs (5), cape over the moulin (7), split fairway (8), bottle through the neck (9) (all `bold: true`, 11 November) | Ice cave tee (1), travertine terraces (2), longship (3), crevasse field (4), frozen falls (6), moulin (7), mammoth (8), longhouse under the aurora (9) | Powder strip (1) |
| **Emberfell** (playable blockout, round 7) | Lava plays as water | Leven (5), Long (6), Cape (7), Punchbowl in a crater ringed with sand (8) | Drivable down the columns (5), go or lay up at the rill (6), bite off the cape (7), split (9) | Kipuka and lava river (1), geysers (2), tube bridge and a double fairway either side of its trench (3), the Notch reveal (4), basalt columns (5), lavafall in its bay (6), lava lake (7), cinder cone on the caldera floor (8), island clubhouse (9) | Cross bunker (2), ring (8), beach (9) |
| **The Lost Valley** (playable blockout) | Animals are scenery; tar plays as water; the river's gravel bars play as bunkers | Long (2, 610 yd), Short (4, a postage stamp), Eden (7), Leven (8), Hog's Back (5: the crowned causeway) | Centre-line hazard (3, the Bone Bluff), the long way round (5, the stepping stones or the dry way), drivable (8, under the root arch), go or lay up (9, the shelf in two) | The camp on its knoll (1), the giant monkey-puzzle (1), braided river and its burn (2), Bone Bluff, its skeleton and the dig pits (3), tar pit and bones (4), swamp and stepping stones (5), the ramp to the east ledge and Nest Falls (6), the ledge's bluff, the lookout and the spire (7), the table top, the survey pole and the Strangler's root arch (8), the Great Falls, the plunge pool, the two-part green on its shelf and the rope bridge (9); long-necks and pterosaurs as scenery | Sand ring round the 3rd green, nine dig pits (3), the 1st's waste strip and the waste through its corner, gravel bars |
| **The Buried Kingdom** (blockout) | Sand in three bands: rough, firm sand (a waste area), soft dunes only where placed; you always find your ball | Sahara (4), Lion's Mouth (5), Hog's Back (6) | The long way round (4), go or lay up (6), centre-line hazard (9) | A par 3 opener across still water with a beach (1), a causeway to play along (3), an 8,000 m² blowout (4), a lion's mouth between the Sphinx's paws (5), a dune-crest fairway to a skyline green (6), a gate to play through onto a table top (8), a fallen obelisk in the fairway and colossi over an amphitheatre green (9); landmarks the great pyramid, the Sphinx, the river's green line, the colossi | The Sand Sea (4), the crest's blowout (6), seven spoil pits (7) |

Classics no course has used yet: **Eden, Road, Bottle, Channel, Leven, Double Plateau, Hog's Back, Sahara, Long,
Dell.** (The Lost Valley has since used a Long, an Eden, a Leven and a Hog's Back.) A punchbowl is on six of seven courses: give it a rest.

## Fairway forms, counted (`node tools/review/alike.mjs all`, 11 November 2026)

49 par 4 and 5 fairways on seven courses. Forms: **spindle 17, broken 11, island 7, split 7, hourglass 4,
scalloped 2, uneven 1. Never used: fan, funnel, bowl, hook, stepping stones, double.** (The Lost Valley's
stepping stones measure as a split: its pools don't yet cut the fairway into separate pieces.) 83 of 1,029 pairs
of fairways on different courses measure as alike.

| Course | Forms | Pairs alike | Against the budget |
|---|---|---|---|
| The Aerie | broken 3, island, split, spindle, scalloped | 0 of 21 | Three broken (its islands), one over |
| Red Mesa | spindle 2, broken 2, scalloped, hourglass, split | 0 of 21 | Inside it. The most varied course |
| Hollowmere | fan, island 2, spindle 2, split, funnel | 0 | Inside it (11 November: the Adit a fan, the Grotto a funnel; was spindle 4, four pairs alike). Alike with other courses' fairways: 8 pairs (was 26) |
| The Reclaim | broken 2, island, spindle, hourglass, hook, fan (reshaped 11 November; the 2nd reads as an island since its courtyard approach became a second lane) | 0 | Inside it; six fairways match another course's (three Hollowmere's, three Rimeholm's), was 26. Was spindle 5, broken 2, six pairs alike |
| Rimeholm | reworked 11 November: spindle, scalloped (2), island 2 (4, 5), uneven, broken, hourglass (9) | 0 | Inside it but for the islands back to back (4, 5). Was: four plain strips and five pairs alike, once the check counted only each hole's own ground (it had read the 8th's fairway beside the 9th's tees as an island) |
| Emberfell (playable blockout) | round 6: scalloped, funnel, split (a double fairway), hourglass, broken, fan, island | 0 | Inside it; two fairways match another course's (the Barranco and Rimeholm's Ice Gate, the Heart and the Lost Valley's Bone Bed). Was spindle 3, hourglass 3, island, five pairs alike |
| The Lost Valley (playable blockout) | scalloped (1: a fan into a big elbow), stepping stones (2: three pieces between the burn's crossings), island, split (stones beside the dry way), funnel, split, scalloped (12 November; was fan, broken, island, split, funnel, split, scalloped) | 0 of 21 | Inside it; none matches another course's. Was split 4, broken 3 |

The two planned courses fix theirs in their re-lay (their briefs say so). The playable five keep theirs until
each is next touched; The Reclaim and Hollowmere have the most to gain.

## Height forms, counted (`node tools/review/relief.mjs all`, 12 November 2026)

What the ground does on each hole (`docs/COURSE-DESIGN.md` "Elevation and height forms"). 72 holes on eight
courses (Halcyon Ring from its plan data, round 2). Re-counted after the fix of 12 November: `relief.mjs` had
reported every landing area's lean on the wrong side (the sizes were right).

| Form | Holes | |
|---|---|---|
| Ramp down, ramp up, level (plain) | 24 of 56 par 4s and 5s (18 after the Lost Valley's reshape and the check reading straight holes along their line) | The stock shape |
| Drop par 3 | 11 of 16 par 3s | One a course from now on |
| Tee shot off a height (12 m or more) | 10 (five of them 25 m or more) | Hollowmere has four |
| Big climb (25 m or more) | 4 | Four are finishes or near it |
| Perched green | 4 | |
| Uphill par 3 | 4 | |
| Stepped | 5 (6) | Halcyon Ring 4, the Lost Valley 2, Hollowmere 3 (Stalagmite Forest) and the Aerie 9 (the Ascent, 13 November) among them |
| Hillside bench | 3 (4) | The Reclaim 8, Rimeholm 7 (the Moulin, 12 November), Halcyon Ring 6, the Lost Valley 6 (9%) |
| Crest and run | 3 | The Aerie 8 (Long Roll, 13 November) |
| Fall-away | 2 (3: the Lost Valley 9) | |
| Table top | 4 (5) | The Reclaim 2 and 9 (the Rift, 12 November), Halcyon Ring 7, the Lost Valley 8, Red Mesa 9 (the Climb's two 14 m steps read as one, 13 November); also Emberfell 3's channel (off the playing line, so not counted) |
| Dip in front | 1 | |
| Level par 3 | 1 | |
| Half-pipe | 1 (2) | Halcyon Ring 1, the Lost Valley 1 |
| Par 3 across a gulf | 2 | Halcyon Ring 9, Red Mesa 6 (the Trestle's tees in a notch at the green's height, 13 November) |
| Hog's back | 0 (1) | The Lost Valley 5 |
| Valley carry | 1 | Emberfell 2 (the Barranco, 12 November; `relief.mjs` reads it as a table top too) |

By course, what the check flags:

- The Aerie: both par 3s drops. Bold holes 3 and 9 since 13 November (the Ascent stepped, Long Roll a crest and run).
- Red Mesa: one drop par 3 (Kestrel) since 13 November, when the Trestle went level across its gorge; bold holes 2 and 9.
- Hollowmere: four tee shots off a height (1, 4, 6, 9).
- The Reclaim: both par 3s drops; plain par 4s and 5s 1, 4, 6, 7. The Rift became a table top 12 November (Rhys's pick): bold
  holes 2, 8, 9.
- Rimeholm: the Moulin a 9.5% hillside bench 12 November (Rhys's pick); the other landing areas lean 1.4–2.8%.
- Emberfell: the Barranco a valley carry 12 November (Rhys's pick): bold hole 2; still four plain (1, 3, 5, 6) and 5–6 back to back (the Lava Tube's table top is on its channel, off the line).
- The Lost Valley: one bold hole (the Nest's climb); five plain (1, 2, 5, 8, 9). Reshaped 12 November (Rhys's picks):
  nothing flagged; every form once (half-pipe, stepped, crest and run, level across the tar, hog's back, hillside
  bench and the big climb, the drop par 3, table top, fall-away); bold 2, 6, 8; none plain.
- Halcyon Ring (round 2): nothing flagged; nine forms, none twice; bold 4, 6, 7; one drop par 3 (5).

## Dials, counted (`node tools/review/spread.mjs all`, 12 November 2026)

The plain numbers (`docs/COURSE-DESIGN.md` "Dials"). 72 holes on eight courses (Halcyon Ring from its plan data).

| Dial | All courses | Real courses |
|---|---|---|
| Green size | 80% are 475–650 m²; over 1,000: Red Mesa's 3rd, Halcyon Ring's 7th (1,400); under 430: Halcyon Ring's 2nd (290) and 3rd (420) | about 300 to over 1,000 |
| Par 3s | 115–265 yd; four courses' two par 3s within 35 yd of each other | 100 to 250 |
| Par 4s | 300–457 yd | 280 to 500 |
| Par 5s | 490–560 yd on most courses; Halcyon Ring (490, 545), the Lost Valley (490, 610), The Reclaim (500, 610), Rimeholm (495, 590), Emberfell (480 par 4, 600), Hollowmere (500, 588) and the Aerie (490, 590, 13 November) split theirs | 470 to 630 |
| Fairway mean width | 34–72 m; 80% are 38–60 | 25 to 90 |
| Bunkers | one or two by nearly every green; Emberfell exactly two on eight of nine | none to dozens |
| Bends | 0–85°; most 20–55° | straight to 90° |

| Course | Dials that cluster | Edges of real golf it touches | Past real golf |
|---|---|---|---|
| The Aerie | bunker counts, bends (greens and par 5s cleared 13 November) | a 378 m² and an 866 m² green, a 126 and a 211 yd par 3, a 320 and a 479 yd par 4, a 490 and a 590 yd par 5, a 72 m fairway, a hole with no bunker, a straight hole | none |
| Red Mesa | bends (par 5s and widths cleared 13 November) | a 1,127 m² green, a 265 yd par 3, a 320 and a 475 yd par 4, a 495 and a 598 yd par 5, a 34 and a 68 m fairway, a field of bunkers, a straight hole | the Switchback's waste |
| Hollowmere | greens (8 of 9), par 3s (166 and 168), par 4s, widths, bends (par 5s split 12 November: 500 and 588) | a 500 and a 588 yd par 5, no bunker, a field of bunkers | none |
| The Reclaim | greens (8 of 9), widths, bunker counts (par 5s split 12 November: 500 and 610) | a 300 yd par 4, a 500 and a 610 yd par 5, an 85° bend | none |
| Rimeholm | greens (5 of 9), widths (par 3s, par 5s and bunker counts cleared 12 November) | a 130 and a 215 yd par 3, a 300 yd par 4, a 495 and a 590 yd par 5, an 85 m snowfield, a hole with no bunker, a 3,600 m² powder strip | none |
| Emberfell | greens (6 of 9 with two bunkers), widths (par 4s, par 5s and bunker counts cleared 12 November) | a 240 yd par 3, a 480 yd par 4, a 600 yd par 5, a hole with no bunker, a 1,700 m² bunker, a straight hole | none |
| The Lost Valley (reshaped 12 November) | none (was greens 6 of 9, par 5s, widths, bends) | a 324 m² green, a 1,323 m² green, a 115 yd and a 215 yd par 3, a 300 yd par 4, a 490 and a 610 yd par 5, a 35 m fairway, no bunker, a field of pits, a 70° bend, a straight hole | the 9th's green (1,323 m², in two parts) |
| Halcyon Ring (round 2) | none | a 293 m² green, a 115 yd par 3, a 230 yd par 3, a 310 yd par 4, a 490 yd par 5, a 74 m fairway, no bunker, a field (the pews), a straight hole | the Spoke's 1,400 m² green |

Edges nobody has touched: a fairway over 75 m. (A par 4 over 465: Emberfell's Lava Tube 480, the Aerie's Long Roll 479 and Red Mesa's Dry Wash 475, from 12–13 November.) (A par 5 over 580: the Lost Valley's 2nd, 610 yd,
since 12 November.)

**Famous-hole set pieces used:** the lone tree twice (the Lost Valley's giant and its fig); an island green of a
kind (Emberfell's Heart, the Aerie's island greens); a chute of a kind (The Reclaim's Atrium nave). Halcyon Ring: the postage stamp (2) and church pews (3). The Lost Valley (built 12 November): the postage stamp
(4, ringed by tar) and the burn (2, crossing the line three times). Red Mesa (13 November): the chute (2, a 27 m slot in the rim) and the burn (8, Dry Wash, across the line twice and the front of the green). The postage stamp was taken by both on the
same day, Halcyon Ring planned and the Lost Valley built; Rhys kept both (12 November: "The postage stamp is fine"). Never used:
bunker in the green, shared green, shared fairway, hell bunker, the wall,
lion's mouth, skyline green, sleepers.

## Set pieces, counted (from the course notes; approximate)

| Kind | Courses | Count |
|---|---|---|
| A waterfall (or the theme's version) as a backdrop | The Aerie, Red Mesa, Hollowmere, Rimeholm, Emberfell, the Lost Valley, Halcyon Ring | 7 |
| A tee shot off a ledge, 25 m or more down | Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell, the Lost Valley | 6 |
| A punchbowl green | The Aerie, Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell | 6 |
| A bridge, in play or as a landmark | Red Mesa, Hollowmere, The Reclaim, Rimeholm, Emberfell, the Lost Valley, Halcyon Ring | 7 |
| A climb to the clubhouse to finish | Every course but the re-laid Lost Valley | 6 |
| A chasm or void beside the fairway | The Aerie, Red Mesa, Hollowmere, The Reclaim, Rimeholm | 5 |
| Something to play through or under (an arch, a lobby, an eyelet) | Red Mesa, Hollowmere, The Reclaim, the Lost Valley | 4 |
| A relic in the ground (a fossil, a ship, a mammoth, a skeleton) | Red Mesa, Rimeholm, the Lost Valley | 3 |
| A fairway split round an object | Rimeholm, Emberfell, the Lost Valley | 3 |
| Something that moves between shots | The Aerie (island), Red Mesa (train), Hollowmere (ore cart) | 3 |
| Terraces to play up or down | Hollowmere, Rimeholm, Emberfell, Halcyon Ring | 4 |
| A green inside a shell (a geode, a crater) | Hollowmere, Emberfell | 2 |
| An island green | Emberfell | 1 |
| A double fairway either side of a hazard | Emberfell (the Lava Tube) | 1 |
| A hole along a shoreline with a beach as the miss | Emberfell (the Heart) | 1 |
| Stepping-stone fairway | The Lost Valley | 1 |

**Over-used (on three or more): a new course takes two of these at most.** Everything from "a relic" up.

**Never used, to start from:** a fairway along a ridge crest; a hole round the rim of something, playing
clockwise; a green in a natural amphitheatre; a green hidden behind a wall or bank; a causeway or dam to play along; a zigzag down a slope in switchbacks; an up-and-over
saddle between two peaks; a hole through a tunnel of trees; a shared double green; a tee you reach the fairway
from across still water with a bail-out beach; dunes and blowouts; a quarry with benches; a
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
  three in a row. (13 November: "Round the right" marked bold after all, with a fairway shelf right of the
  pinnacle beside the green for a long second to land on; it now plays even with the lay-up, 4.83 against 4.75.)
- **Variety changes (13 November 2026, Rhys's picks):** Lantern 171 → 211 yd (its tee island 37 m back and 3.5 m up,
  so the forward tee islands don't hide the green; a 17 m drop); Long Way Round 510 → 490 (tee island 18 m forward)
  with the shelf above; the Stair's green cut to about 380 m²; Long Roll 457 → 479 (a tee island of its own 20 m
  back, the Hawk tee on its own pad) with a 6.8 m crest across the fairway island 223 m out, its far slope running
  the ball on (the island's near end 10 m nearer, so the carry stays 199 yd); the Ascent 530 → 590 (tee island 55 m
  back; carry 238 yd) in three steps of about 4.5 m (the drive's island +0.5, the upper fairway +5, a bank 420 m
  out to the green's level +9.5, replacing the Alps ridge) to an 866 m² green. Gate: every hole within +0.4. Blind
  tee shots two (3, and 8 over its crest). Tips now 3,776 yd: 452, 239, 528, 353, 480, 153, 445, 507, 619.
- **Tips (as first set, 11 November):** the Albatross set, switched off, 3,692 yd: 452, 205, 549, 353, 480, 153, 445, 490, 565 (44, 29, 39,
  33, 30, 25, 32, 33, 35 yd behind). No back tee had ground behind it, so each is a small tee island floating
  behind the back tee (Rhys's pick, 11 November). Long Way Round's is blind over its crest like its back tee.
- **Rhythm:** five straight holes (three at most); par 4s 320–479 yd, a good spread; par 3s 126 and 211 (from 13 November).
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
- **Variety changes (13 November 2026, Rhys's picks):** the Trestle level across the gorge (its back tees in a notch
  cut 17 m into the mesa's lip at the green's height, a `step` landform; Sage moved into it; relief: a par 3 across a
  gulf); the Climb 515 → 598 (back tee 75 m back on the floor) with its gully ramps made two 14 m steps in 20 m (the
  Mesa tee at the old back tee, 515); the Chute a 27 m slot in the rim 25–65 m out (two rock blocks, 2 m left of the
  line so the plateau's line clears it) and its lower fairway 60–70 m wide; Dry Wash 450 → 475 with the river a 7 m
  burn that cuts across the front of the green into the right wall instead of running down the left wall; Switchback
  535 → 495 (Mesa 460, the tips at the old back tee), its drive target 45 m further on, so the long hitter goes for
  the green in two (4.50) and "Over the waste" is the short hitter's bold second (pays 0.17). Gate: every hole within
  +0.8 (Kestrel, unchanged). Blind tee shots one (the 2nd). Tips 3,745 yd: 419, 440, 287, 400, 535, 190, 350, 497,
  627.
- **Rhythm:** four straight holes; par 4s 320–475 (from 13 November); par 3s 175 and 265 (far apart on the card, close plays-like
  because of the 70 m drop, as the shape review found).
- **Classics:** five. The model for the rule.

### Hollowmere (re-measured 11 November after the rework, 12 rounds gate, 24 decisions)

- **Gate:** passes. The 6th failed (+2.3 from the Wren tees, 1.3 penalties, 2 of 12 unfinished): its drive target
  sat short of a crest and the way round the top of the inlet had no target. Both fixed in the data; now +0.4.
  Worst hole after the rework: the 3rd from the Wren tees, +0.8; no penalties anywhere.
- **Forced carries:** none over the limit on a par 4 or 5. Mirror Lake's Hawk tee carries 133 yd of water (a par
  3: only the forward tee is held to it; bail-out right).
- **View:** two blind tee shots (the Geode by design, the Grotto, kept blind by Rhys). At the limit.
- **Decisions:** four, marked `bold: true`, each a different type: thread the stalagmites (3) and over the trestle
  (7) are second shots that pay the short hitter only (real choices); the Rim's corner (4) pays both at no risk,
  so it is simply the line; through the eyelet (9) is within noise for the long hitter. The Adit's corner (1) was
  removed (the type twice). In the last two holes: the 9th.
- **Rhythm:** par 4s 343–446 (no short one; 3 yd over, left); par 3s 168 and 166 on the card but about 149 and
  179 as they play (30 yd apart: passes).
- **Fairway forms:** fan (1), island (3, 6), spindle (4, 9), split (7), funnel (8); 0 of 21 pairs alike.
- **Tips:** the Condor set, switched off, 3,674 yd: 430, 181, 588, 471, 191, 435, 595, 418, 365 (24, 13, 42, 26,
  25, 27, 48, 35, 24 yd behind the Eagle tees). The 9th's is on the eyelet line: a 290 yd drive going for it
  finds 42 m of fairway, but `tips.mjs` measures toward the safe target and flags it.
- **Classics:** one (punchbowl, twice).

### The Reclaim

- **Gate:** passes. No hole over +1.5 and none fails to finish.
- **Forced carries:** the Stadium (5th, par 3) from the forward tees: 98 yd against a 150 yd drive.
- **View:** no blind tee shots.
- **Decisions (reshape, 11 November; Rhys picked 2, 4, 6 and 8; 1, 7 and 9 one line):** at 24 rounds the drivable
  6th is real (running on from the right pays the short hitter 0.33, costs the long hitter 0.5 with 0.42
  penalties). The rest are to be judged by playing: the bottle on 4 pays both by 1.1–2.0 (a miss off the neck
  costs only a rough lie, and the tool's player has no lie costs), the bite on 8 is inside the noise (+0.17 /
  −0.12), and the Atrium is now drivable (Rhys, 11 November: the dogleg turns 85°, the green 283 yd straight down the 18 m nave from the back tee, 9 m up, the courtyard mown): at 24 rounds driving the green pays the long hitter 0.75 (safe 4.42, bold 3.67; it leaves 158 yd less) and is out of reach from Ivy (242 yd), so it pays one and not the other; the safe route plays as before (long 4.42, short 4.34 at 32 rounds, against 4.42 and 4.36). Before that the 18 m nave alone paid the long hitter 0.28 and the short one 0.17; before the nave, it cost the long hitter 0.34.
  `design.mjs` now scores second-shot choices (the 4th; the 7th's inlet before it was unmarked: pays the long
  hitter 0.2, costs the short 0.3).
- **Rhythm:** four straight holes; par 4s 300–430 (the 8th is now 365, so only the 2nd is at 380). Two drivable par 4s (2 and 6), kept on purpose.
- **Tips:** the Girder set, switched off, 3,602 yd: 427, 418, 161, 538, 221, 331, 634, 403, 469 (27, 38, 26, 38, 26,
  31, 24, 38, 39 yd behind the back tee); the 1st's on the El platform's back end, run on 24 m for it.
- **The Rift's table top (12 November 2026, Rhys's pick):** a 6.5 m scarp 262–278 m out, the slab above it nearly
  level to the green, the fairway mown up the face (still a fan). Gate +0.1 / +0.0 (was +0.0 / +0.2). With the scarp
  at 244–260 m, back-tee drives ran up into the face and it played +1.1 for the long hitter.
- **Par 5s split (12 November 2026, Rhys's pick from the variety proposal):** Broken Tower 545 → 500 yd (the back tee
  41 m down the street, under the span; forward sets 475, 450, 415), The Bridge 560 → 610 (the back tee 46 m up the
  expressway ramp, on its deck at 13 m, so the slab's lip doesn't hide the landing area). Gate passes (both hitters
  within +0.4 on every hole); the "Through the gap" second pays both hitters; no blind tee shots.
- **Classics:** three by green style.

### Rimeholm (reworked and re-measured 11 November, 12 and 36 rounds gate, 24 decisions)

- **Gate:** passes in 12 and 36 rounds; worst hole the 9th from the back, +0.2. The 9th from the Hare tees was
  +1.9 and failed to finish one round: not the climb but an erratic boulder 7 m in front of the Hare tee that
  turned every drive back (erratics now stay 22 m off every tee pad); now −0.2. The 9th's fairway keeps a third
  of the snow waves (`groomed`): a ball in a trough on the climb clipped the next crest, the solver took a driver
  and flew the green under the ledge behind the hall.
- **View:** one blind tee shot, the 6th, by design. The 1st's and 5th's drops now start at the back tee's pad;
  the 9th's first ramp is one rise to the shelf.
- **Fairways:** the 2nd scalloped (its pools alternate sides), the 9th an hourglass; 0 pairs alike, two plain
  strips (1, 7). The 4th and 5th are both islands, back to back (the 5th as stepping stones was offered, not taken).
- **Decisions:** four marked, four types. Through the gap (5th): 58 yd less, pays the long hitter 0.7 and the
  short one 0.6. Over the moulin (7th): 69 yd less, no difference for the long hitter (3.92 / 4.00, the tool pars
  the safe line from the crest); from the Lynx tee, now on the moulin's side (a 194 yd carry), it's out of reach and
  costs the short hitter 0.8. Before, the Lynx tee sat left of the moulin with no carry, and it paid the short one.
  The low side (8th, a second-shot choice): now 46 yd less than the high side (its fairway runs on to the bowl's bank,
  target 28 m nearer); pays the short hitter 0.25 and costs the long one 0.3 (he should go for the bowl in two).
  Was 18 yd, no difference / costs.
  Through the neck (9th): 75 yd less, no difference for the long hitter (0.1), costs the short one 0.3.
- **Tips:** the Bear set, switched off, 3,605 yd: 430, 400, 175, 575, 325, 205, 470, 570, 455 (28, 31, 11, 37,
  24, 24, 49, 49, 48 yd behind the back tees). The 1st's and 5th's sit behind a lip and carry `pad.h` 3.5 and 3 m,
  so they see the landing area; when turned on they want a built tee (ice blocks, a rock knoll), not the engine's
  box. The 6th's is blind like its other tees.
- **Rhythm:** passes every check. Par 4s 300–420.
- **Classics:** three (Redan, punchbowl, Bottle).

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

### The Lost Valley (playable blockout, 11 November 2026)

- **Skeleton:** re-laid to Rhys's pick (par 37, 4 5 4 3 5 4 3 4 5): shares a par with another course on four holes
  at most; no set-piece slot shared. Its finish (down to the shelf green under the Great Falls) and its mid-round
  climb are new.
- **Gate:** passes. Long hitter from Titan / short hitter from Compy, to par a hole: 1 −0.2/−0.2, 2 −0.1/−0.2,
  3 +0.5/+0.4, 4 −0.2/−0.2, 5 0.0/0.0, 6 +0.8/0.0, 7 +0.3/−0.2 (0.2 penalties, the creek long), 8 −0.2/−0.2,
  9 −1.0/−0.6. The first build failed the 3rd (+2.6/+3.8, never finished): from the old safe target the bluff stood
  29 m tall 25 m in front of the approach; the target moved to the right half of its lane (232 m, 44 right), where
  the green shows past the rock.
- **View:** two blind tee shots by the check (the 2nd, 3.2 m; the 3rd, 3.8 m), at the limit.
- **Decisions:** four, each a different type, bold targets on 3, 5, 8 and 9 (the 9th's Green). Under the arch (8)
  pays both players about half a stroke to two thirds. The stepping stones (5, a second shot) cost the long hitter
  0.25 and pay the short one 0.25. Left of the bluff (3) gains 29 yd and makes no difference to either: the bold
  side wants more reward (a better angle into the ring's opening, or a shorter lane). The 9th is scored as out of
  reach from the tee; the tool doesn't yet score a par 5's second-shot go at a Green target.
- **Rhythm:** four straight holes (both par 3s, the 6th and the 8th), par 4s 300–425, par 3s 145 and 215, all
  four quarters of the compass.
- **Classics:** four (Long, Short, Eden, Leven), all new to the register.

### What I'd do first

1. Done 11 November: the tool and the game disagreed on Rimeholm because the tool's player aimed differently
   (fixed in `tools/review/play.mjs`), and a topped shot ran for ever (fixed in `src/physics.js`).
2. Mark `bold: true` in the courses that lack it, then fix the choices that measure backwards or as traps:
   The Reclaim's 8th reshaped (a hook) 11 November; its 2nd still wants a risk. Red Mesa and the Aerie done 11 November (the arch a one-line hole, the table rock moved).
3. Look at the drop-off-a-lip tee views (Red Mesa 2, Rimeholm 1 and 5) in a render. Rimeholm's done 11 November (both fixed).
4. Done 11 November: Rhys picked new skeletons for Emberfell and the Lost Valley (see "Assigned" above).
5. Write hole cards (feature job, miss map, tee view) for the playable courses as each next gets touched.
