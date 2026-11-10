# The art pass: how a course gets its look

Every course gets an art pass once its layout is agreed (after the review rounds, before it is called
done), and more passes later from the owner's notes. This is the standard way to run one, from The
Reclaim's first pass (November 2026) and Hollowmere's lighting work. `docs/COURSE-DESIGN.md` covers the
layout; this covers how it looks. The tools are in `tools/review/` (see its README).

## 1. The art brief

Start from references. The owner's photos come first: keep them in `tools/<course>/refs/` and match
them closely (The Reclaim's cab street, great tree and wild park; Hollowmere's cenote and geode).

**When there are no reference photos, make the art direction yourself before asking anything.** Research
the theme: real places and how they look (search the web and image search for the place, its
materials, plants, light and weather), plus how games and films have shown it. Then write
`tools/<course>/art-brief.md`, short and specific:

- **The feel** in a line or two (The Reclaim: quiet, not spooky; nature winning, warm haze).
- **Palette**: six to ten colours as hex, for the big surfaces first (ground, structures, foliage, sky,
  fog), each named for what it is. Keep them a little desaturated; vertex tones multiply textures, and
  saturated tones read as cartoon in low sun.
- **Materials** surface by surface (the ground shader, structures, rock, water), with the real size of
  their pattern (a brick bay is 3 m, a floor 3.5 m; a texture at the wrong scale reads as graph paper).
- **Vegetation**: what grows where, and how much (climbing, hanging, ground cover, trees).
- **Sky, light and weather**: the signature conditions (time, sun height, haze or cloud) and what the
  light does (shafts, glints, a lit green).
- **Life and details**: props, furniture, animals; a few, never busy, and kept off the lines of play.
- **Landmarks**: one or two things seen from several holes.
- **Avoid**: what would break the feel.
- **References**: links to the pages and pictures used, with a line on what each one shows.

Show the owner the references you found (a link card, or a mood board: `python3 tools/review/sheet.py
--files ... --title=...` when there are image files) with the brief.

## 2. Agree the direction (multiple choice)

Ask in the picker, recommended option first, matched to the references or the brief. Four questions
cover it: structures and materials; vegetation and ground cover; light and sky; details and wildlife
(multi-select). Read the answers closely: the owner often adds to an option ("the first one, plus big
fluffy clouds like the cab photo").

## 3. Build

Keep course-only work in the course's own world module (`city-world.js`, `cave-world.js`,
`sky-props.js`, `mesa-world.js`); keep changes to shared modules small, behind an option or a theme
flag, and say so in the commit. What worked:

- **Textures from canvas**, made once per page: facades, foliage, grass. Draw them near neutral and
  give each object its tone with vertex colours, so one texture serves many buildings. Set
  `encoding = THREE.sRGBEncoding` on canvas colour textures. Keep a plain white corner (uv near 0,0)
  so untextured faces can share the material.
- **Real-world scale** in the uvs: work out metres per texture repeat (`TILE` in `city-world.js`).
- **Foliage as alpha-tested sheets** (`alphaTest: 0.5`, double-sided). Make the texture tile
  seamlessly and give the sheet a ragged outline in its geometry; a texture with ragged edges shows its
  seams as a grid.
- **Merge by material**: one batch per material per hole (the `batch()` helper), instanced meshes for
  anything repeated hundreds of times (grass tufts, rubble, birds). Merged walls are double-sided, so a
  face wound the wrong way still shows.
- **Ground cover from the surfaces**: scatter by `surfaceAt` (none on fairway, green or tee), patchy
  with a cheap noise, not even.
- **Sky and light**: the signature weather sets fog colour and distance; a cloud deck (a shader on a
  big plane, faded to the haze toward the horizon) gives a sky with shape; sun shafts are a few
  long, faint, double quads in one mesh, placed where the sun reaches the ground. In caves, bake every
  light but two (`ctx.baked`).
- **Life**: animals and birds as small merged meshes or an instanced flock, animated through `anims`;
  two or three per hole is plenty.
- **Scenery only, unless it should play.** Lamp posts, signs, animals and birds don't stop the ball;
  trees do (anything pushed into the tree list plays). Keep scenery and new trees off the lines of play
  (`offLine` in `city-world.js`: 26–38 m) and keep the tees' views clear: nothing big within 14 m of a
  tee, and nothing over a tee pad.
- **Nothing floats; nothing stands in water**; a pond is drawn only on its own hole's ground at its
  level (another hole's pond floated over the Bridge).

## 4. Check

All four, every pass:

1. **Renders** of every hole: `node tools/review/views.mjs <course>` (tee, landing, green), then
   `python3 tools/review/sheet.py <course>` for a contact sheet. Look at each view for colour (too
   saturated, plain white faces in low sun), scale, seams, floating things, a blocked tee view.
2. **Holes in the world**: `node tools/review/seethrough.mjs <course>`. Any red in a mask is sky seen
   looking down (the Station's pit walls had cells dropped by the playfield; `keepSteep` fixed it).
3. **Anything odd**: `node tools/review/pick.mjs <course> <hole> <view> <x> <y>` names what's at that
   pixel of a render (the white patches, the slab over the Bridge's tee, the floating pond).
4. **Cost**: `node tools/review/perf.mjs <course> --vs=<commit before the pass>`: meshes, triangles and
   frame time, then and now. The Reclaim's first pass: +36% meshes (28 to 38), +8% triangles, +18% frame
   time in software. Keep real lights to two; ask the owner how it feels on the phone, since software
   timings aren't a phone.

Then `npm test` and the play-through, `node tools/review/playthrough.mjs <course> --render=120` (the golf
only; a tenth of the time), because art can play (new trees, solid props).

## 5. Deliver

Send a contact sheet of the best views and a few lines on what changed, by the owner's four answers.
Note in the status doc what's in, what it cost, and the candidates for the next pass (the plain bits you
saw in the renders). Push and confirm the deploy.

## Lessons from The Reclaim's first pass

- The blockout's facade texture repeated every 6 m with four windows a repeat: windows 1.5 m apart read
  as graph paper. Work out the scale.
- Saturated brick tones turned salmon in the low morning sun; desaturate, and darken plain concrete,
  columns and rubble (a pale face square to a low sun renders nearly white).
- Ivy with ragged texture edges tiled into a visible grid; it needs a seamless texture and ragged sheets.
- Contrasting ribbon windows on every tower read as zebra stripes; punched windows read as concrete.
- A cloud deck from domain-warped noise reads as patchy; big cumulus want lower frequency, a sharper
  edge and darker, thicker middles.
- Review renders found three blockers the layout checks didn't: a ramp deck over a tee, rubble blocks
  beside a tee, another hole's pond floating in a view. Look at every tee view.
