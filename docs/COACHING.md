# Coaching range

The range opens on a practice menu: **Range** (free hitting), **Coaching** and **Short game** (coming). Coaching watches your shots, names the one fault most worth fixing, shows it on a 3D mannequin next to the goal swing, gives you a cue, and checks whether it's working. The living spec, with every condition, threshold and decision, is the "VibeGolf Coaching Range spec" doc; this file is the map of the code.

## The loop

1. **Watch.** The chip under the title counts shots toward a read (4 with one club).
2. **Read.** When at least 3 of the last 4 shots agree, and none misses the other way, the readout opens: headline, the mannequin looping the moment that matters, your numbers against the window, two or three likely causes, and the cue. The cause the data supports is marked "Most likely". Each cause has a check: a data hint, a quick yes/no (only when the data can't separate two causes), or a feel to test.
3. **Focus.** *Got it* folds the readout into the chip: the cue, and a count of 8 shots. Three good shots in a row end it early.
4. **Progress.** After 8 shots: your first 4 as an orange ghost against a figure blended toward the goal by how far your numbers moved, a shot-by-shot chart, and *8 more*, *Next cause* (when it stalled), *Try a drill* or *Done*.
5. **Quiet.** A condition you dismissed or finished isn't raised again for 10 shots unless it gets worse. A shank is flagged on the first one; fatigue after a long block with falling club speed and strike.

## Learn a skill

Coaching opens on a choice: **Watch my swing** (the loop above) or **Learn a skill**. Nine skills: Shape it (draw or fade), Compress your irons, Hit up on the driver, Flight it high or low, Start it on your line, Find the centre, Wedge distance control (9 o'clock, 10:30, full), Tighten your pattern and Add speed.

1. **Pick.** The skill and its option. A skill that needs a club (driver, an iron, a wedge) switches to it.
2. **Keys.** The intro shows the skill's two or three keys on the mannequin (your normal swing against the skill's swing as the green goal), the goal numbers and the cue.
3. **Baseline.** Skills measured against your own shot (Flight it, Wedges, Add speed) start with four normal swings, unless the session already has four with that club.
4. **Hit in fours.** Every shot is scored against the goal windows (1 inside every window, less the further out). After each four, the first of the skill's blockers that holds is shown with its lesson, your numbers against the goal, the meter and the shot-by-shot chart. With nothing in the way, a toast says how close you are.
5. **Learned, then the test.** 3 of 4 in the goal starts the test: 5 of the next 8. Passing saves the skill (`localStorage` `vibegolf.skills.v1`, a tick on its card); missing goes back to learning. After passing it stays open-ended: the meter keeps tracking and the reads go on.
6. **Focus.** Only a shank or a run of fat shots interrupts a lesson. Other faults wait for Watch mode.

`range.html?mode=coach&skill=shape.draw` opens a lesson directly. The shot tool's *Swing fault* list has skill attempts (draw swing, fade swing, compressed, hitting up, knockdown, high shot, faster swing) so every lesson can be tried without an R10.

## Trust checks

The coach believes what the R10 measures well (ball speed, launch, start line) and checks the rest before using it.

- **Club data** counts as missing when face, path and attack are all alike (the R10's 0/0/0 on a slow swing, or a connector's dummy 1/1/1), a number is out of range, or the club speed or smash factor is impossible. Then face and path come from the start line and spin axis, as before. The bridge also drops club data a connector marks as absent.
- **Spin** passes four checks: measured beats estimated (a marked ball); possible for the club at that launch; within 30% of the spin the measured attack and the loft implied by launch predict; spin axis within 4° of 1.9 × face to path. All pass: used. One fails: a tie-breaker (the rules see half way to the predicted spin). Two fail, or it's impossible: ignored (the rules see the predicted spin). With a plain ball (and into a net) the R10's spin is its own estimate, so it supports a read rather than making one.

## Tuned against an R10 in simulation

`tools/coach/sim-check.mjs` plays every fault preset (and clean swings) through the coach with an amateur's swing scatter and R10-sized measurement error (`tools/coach/model.mjs`: face σ 1.6°, path σ 3.0°, attack σ 1.3°, estimated spin ±12%, no loft, the occasional untracked club), then counts how often the first read in 8 shots is right. `tools/coach/skill-check.mjs` does the same for Learn a skill. The error sizes are an assumption from a published R10 vs TrackMan comparison until real sessions arrive. What the tuning changed (11 November):

- Path and face reads need the ball to agree: over the top or stuck needs the start line or the curve on the same side; open or closed face needs the curve.
- Aimed off is read from the ball: starting off line by 3° or more with little curve (spin axis within 3.5°).
- Two-way is read from the ball: start lines both sides (spread over 2.8°) or curves both ways (spin axis spread over 9.5°). The R10's path scatter alone used to trip it.
- Ball back, ball forward, off-centre, driver down and toe/heel are judged on the window's average. Ball forward also covers aimed off and off-centre.
- Steep is for irons and woods; the driver's version is driver down (attack 1.5° below its window, spin at or above the centre).
- Thin needs 3° less launch (was 4°) and 18% less spin. A shank needs ball speed under 82% of the club's smash, so a driver shank counts.
- Club speed is kept when the face and path weren't tracked but the speed is believable, so strike reads still work.
- Skills: shaping, start line and pattern are scored on the ball (start line and curve); path, face and face to path still score but don't decide "in the goal". Compress needs spin loft at least 1.5° under normal.

Result with R10 error (mean of 7 iron, PW and driver): faults read right 62% → 83%; clean swings flagged 57–63% → 23–28% (with perfect data 13–16%). The shaping skills went from about 10% learned in 12 shots to 81–89%. `tests/coach-sim.test.mjs` holds the line. Weakest now: toe/heel (68%; the R10 has no impact location, so it's read from curve the face doesn't explain) and mild faults (at 70% size about half are read in 8 shots; they take longer).

## Session record and My game

Every live shot is kept on the device (`src/recorder.js`) with its club, mode, the trust verdicts, the flight or the course result, the coach's events and an optional feel tag. Range and Coaching shots feed **My game**'s Bag and Practice tabs; course shots feed On the course; mini-game shots are kept but feed nothing. Sessions export as JSON from My game; the next step is a replay tool that runs them back through the coach to tune the thresholds.

## Code

| File | Kind | What it does |
| --- | --- | --- |
| `src/coach/windows.js` | Pure | Club reference (TrackMan tour averages), fixed attack/smash windows, and `windowsFor(club, clubSpeed)`: spin scales as speed^0.35 (irons) and the descent target drops 22° per unit of speed lost; the flight model finds the launch that lands it, so LPGA averages fall out |
| `src/coach/coach-logic.js` | Pure | `shotMetrics` (impact numbers, D-plane inverse when there's no club data), `RULES` per condition, `evaluate` (the 4-shot window), `pick` (explained conditions drop out, then priority group), `rankCauses`, `progressOf`, and `createCoach()` (the session state machine) |
| `src/coach/conditions.js` | Data | The catalogue: headline, one line, cue, evidence, and up to three causes each with a check, a lesson and a drill |
| `src/coach/faults.js` | Pure | Swing-fault presets for simulated shots (the shot tool's *Swing fault* picker on the range), one for every condition, with a `scale` for milder or stronger versions |
| `src/coach/skills.js` | Pure | Learn a skill: `SKILLS` (options, clubs, keys, goals, blockers per skill), `scoreShot`, `skillMetrics` (adds peak height and carry from the flight model) and `createSkillCoach()` (baseline → learn → test → open) |
| `src/coach/trust.js` | Pure | `clubTrust` (placeholder and impossible club data), `expectedSpin`, `spinTrust` (the four spin checks: use, tie or ignore), `spinForRules` |
| `src/coach/lessons.js` | Data | Mannequin lessons, one per cause: changes to the base swing, camera, pause point, highlighted body part, readout, caption |
| `src/coach/mannequin.js` | Three.js | The rig (cylinders and spheres, two-bone IK), the ten P-position base swing blended in the chest's frame, one renderer moved between slots, drills, and numbers read off the scene |
| `src/range/coach-ui.js` | DOM | The chip, readout, explorer, progress, drill and notice screens; history in `localStorage` (`vibegolf.coach.v1`) |
| `styles/coach.css` | CSS | Coach sheet, chip, explorer, practice menu |

Tests: `tests/trust.test.mjs` (the trust checks, placeholders, nonsense spin), `tests/coach.test.mjs` (windows, every condition, the window rule, priority, confidence, the focus loop, presets against a decent amateur's misses), `tests/lessons.test.mjs` (lesson data) and `tests/skills.test.mjs` (each skill's goal reached by the swing it teaches, the usual miss naming the right blocker, the learn → test → open flow).

## Rules of thumb

- Keep `coach-logic.js`, `windows.js`, `conditions.js`, `faults.js` and `lessons.js` free of the DOM and Three.js.
- A new condition needs a rule in `RULES`, an entry in `CONDITIONS`, a progress measure in `PROGRESS`, a preset if it can be faked, and a test. A new cause needs a lesson (or `lesson: null` with an inset).
- Lessons change the base swing only where the fault lives; the goal is always the base swing. Colours never change: you solid with an orange face, the goal a green ghost, a past you an orange ghost.
- Numbers on screen are read off the mannequin (loft, path, attack, face at impact) or come from your shots; nothing is typed in.
- The coach speaks on patterns, never one shot (a shank is the exception).

## Testing without an R10

Pick a *Swing fault* in the shot tool and hit. Headless: open `range.html?mode=coach`, set the fault through the `.st-fault select`, press `h` to hit, step with `__advance(16)` and wait for the tool to stop being `busy` between shots. `window.__coachUI.coach.shots` holds the metrics the coach saw.
