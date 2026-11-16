# tools/emeraldbay: Emerald Bay's plan tools

Emerald Bay is an invented bay of limestone islands (the Krabi / Koh Phi Phi look): sheer karst with jungle on top,
white sand, clear turquoise water, a chain of holes wrapped once round the bay. Two logics: sand is always playable
and water is a stroke (a cliff gives the ball back onto the sand below), and the tide is high or low each round,
changing holes 3, 5 and 9. The design is `claude/emerald-bay-layout.md` in the project (approved 15 November 2026),
the job `claude/brief-emerald-bay.md` with `claude/brief-addendum-emerald-bay-look.md`, the running record
`claude/status-emerald-bay.md`. Nothing is in the game yet.

## Round 0: the tide and the surfaces (16 November 2026)

Before the plan book. World frame: X east, Z south (the layout doc's (x, y north) is `[x, -y]`, `w` in
`world.mjs`), metres, heights above low water.

- `geo.mjs`: geometry helpers (a copy of `tools/cloudrest/geo.mjs`).
- `world.mjs`: the bay as one height function `V(X, Z)` → `{ y, t, cave }` (t: sea bed, wet (intertidal) sand,
  dry sand, grass, rough, jungle, karst). The ground never moves; `TIDES` puts the sea at 0 (low) or 2.4 m (high)
  and `surfaceAt(X, Z, tide)` says what it plays as at that tide (anything below the sea is water; intertidal sand
  above it is firm wet sand). The islands are schematic superellipses with wandering coasts, beaches and karst
  towers, except the tide holes' own ground, drawn in each line's frame: the 3rd's tongue (`TONGUE`) and the rock
  its forward tee stands on (`TURTLE_ROCK`); the Sandbar's uneven section (`BAR`: 42 m of salt grass, the open-sea
  side narrow, the bay side a band of rough and dry sand, so at high water the sea is inside a medium miss on one
  side only); the 9th's tee rock, flats (south of the spit only), spit (`SPIT`: narrow past the sea stack so the
  8th keeps open water round it, wide where drives land), creek, the beach at the cave mouth, the hollow island
  (`HOLLOW`, moved west of the layout sketch so the cave sits 424-505 yd along the line) and its cave (`CAVE`, floor
  3 m, roof 43 m).
- `node dump.mjs`: the world on grids for the figures (`out/grid-*.json`: the bay every 5 m, each tide hole's box
  every 2 m).
- `node checks.mjs`: the numbers (`out/checks.json`): each tee set's carries on the 3rd at both tides, the dry
  ground either side of every tee set's landing area on the 5th and the 9th (the 9th's high-water route along the
  spit), the creek, cave and go/lay-up distances, shots flown under the cave roof, and the sand lies flown with
  `src/physics.js` (a copy of main.js `lieAdjust`).
- `python3 figs.py`: the figures (`out/figs/`): the bay at both tides, each tide hole's plan at both tides side by
  side with its profile or section.
- `node book.mjs`: the proposal, `out/emerald-bay-round0.pdf` (7 white A4 landscape pages). Needs
  `npm i --no-save playwright` and Chrome (`CHROME=/usr/bin/google-chrome`).

What it found:

- The Sandbar as the layout drew it (40 m of grass, 10 m of beach each side at high water) puts the sea 33 yd from
  the line on both sides where drives land: it fails the penalty-ground Must. The uneven bar passes at both tides
  (high water: 42 yd north, 62 south; low water 72 and 92).
- The 3rd's forward tee needs a spot nearer the green: a rock beside the tongue's tip gives 87 yd of carry at high
  water (90 allowed). From the back, 98 yd onto the tongue at low water, 192 yd all carry at high.
- The 9th: in the layout's sketch the cave was at the corner, where drives land; with the hollow island further
  west the low-water hole is a drive over the flats, then go (260 yd through the cave from a 260 m drive) or lay up
  over the creek to the cave mouth (126 yd carry, 135 left). High water plays 589 yd along the spit, water on its
  left only. The go shot and the third pass 12 m or more under the roof.
- Sand lies (7 iron, tour): fairway 173, wet sand 167 (−3%, runs like fairway), dry sand as 'waste' 160 (−8%),
  bunker 139 (−20%), rock as 'desert' 149 (−14%).
