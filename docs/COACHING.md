# Coaching range

The range opens on a practice menu: **Range** (free hitting), **Coaching** and **Short game** (coming). Coaching watches your shots, names the one fault most worth fixing, shows it on a 3D mannequin next to the goal swing, gives you a cue, and checks whether it's working. The living spec, with every condition, threshold and decision, is the "VibeGolf Coaching Range spec" doc; this file is the map of the code.

## The loop

1. **Watch.** The chip under the title counts shots toward a read (4 with one club).
2. **Read.** When at least 3 of the last 4 shots agree, and none misses the other way, the readout opens: headline, the mannequin looping the moment that matters, your numbers against the window, two or three likely causes, and the cue. The cause the data supports is marked "Most likely". Each cause has a check: a data hint, a quick yes/no (only when the data can't separate two causes), or a feel to test.
3. **Focus.** *Got it* folds the readout into the chip: the cue, and a count of 8 shots. Three good shots in a row end it early.
4. **Progress.** After 8 shots: your first 4 as an orange ghost against a figure blended toward the goal by how far your numbers moved, a shot-by-shot chart, and *8 more*, *Next cause* (when it stalled), *Try a drill* or *Done*.
5. **Quiet.** A condition you dismissed or finished isn't raised again for 10 shots unless it gets worse. A shank is flagged on the first one; fatigue after a long block with falling club speed and strike.

## Code

| File | Kind | What it does |
| --- | --- | --- |
| `src/coach/windows.js` | Pure | Club reference (TrackMan tour averages), fixed attack/smash windows, and `windowsFor(club, clubSpeed)`: spin scales as speed^0.35 (irons) and the descent target drops 22° per unit of speed lost; the flight model finds the launch that lands it, so LPGA averages fall out |
| `src/coach/coach-logic.js` | Pure | `shotMetrics` (impact numbers, D-plane inverse when there's no club data), `RULES` per condition, `evaluate` (the 4-shot window), `pick` (explained conditions drop out, then priority group), `rankCauses`, `progressOf`, and `createCoach()` (the session state machine) |
| `src/coach/conditions.js` | Data | The catalogue: headline, one line, cue, evidence, and up to three causes each with a check, a lesson and a drill |
| `src/coach/faults.js` | Pure | Swing-fault presets for simulated shots (the shot tool's *Swing fault* picker on the range) |
| `src/coach/lessons.js` | Data | Mannequin lessons, one per cause: changes to the base swing, camera, pause point, highlighted body part, readout, caption |
| `src/coach/mannequin.js` | Three.js | The rig (cylinders and spheres, two-bone IK), the ten P-position base swing blended in the chest's frame, one renderer moved between slots, drills, and numbers read off the scene |
| `src/range/coach-ui.js` | DOM | The chip, readout, explorer, progress, drill and notice screens; history in `localStorage` (`vibegolf.coach.v1`) |
| `styles/coach.css` | CSS | Coach sheet, chip, explorer, practice menu |

Tests: `tests/coach.test.mjs` (windows, every condition, the window rule, priority, confidence, the focus loop, presets against a decent amateur's misses) and `tests/lessons.test.mjs` (lesson data).

## Rules of thumb

- Keep `coach-logic.js`, `windows.js`, `conditions.js`, `faults.js` and `lessons.js` free of the DOM and Three.js.
- A new condition needs a rule in `RULES`, an entry in `CONDITIONS`, a progress measure in `PROGRESS`, a preset if it can be faked, and a test. A new cause needs a lesson (or `lesson: null` with an inset).
- Lessons change the base swing only where the fault lives; the goal is always the base swing. Colours never change: you solid with an orange face, the goal a green ghost, a past you an orange ghost.
- Numbers on screen are read off the mannequin (loft, path, attack, face at impact) or come from your shots; nothing is typed in.
- The coach speaks on patterns, never one shot (a shank is the exception).

## Testing without an R10

Pick a *Swing fault* in the shot tool and hit. Headless: open `range.html?mode=coach`, set the fault through the `.st-fault select`, press `h` to hit, step with `__advance(16)` and wait for the tool to stop being `busy` between shots. `window.__coachUI.coach.shots` holds the metrics the coach saw.
