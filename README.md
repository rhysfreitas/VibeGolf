# VibeGolf

A golf simulator, vibe-coded with Claude, for the **Garmin Approach R10**, built as a plain web app with no build step. You can play it in a browser, install it to a PC or phone home screen, and host it on GitHub Pages.

![The Aerie](assets/menu-bg.jpg)

| Mode | What it is |
|---|---|
| **Practice Ground** | A floodlit practice campus at blue hour, with a city skyline past the range, glowing target greens, lit distance boards and a big screen that shows your last shot. Its own page offers each mode at its own station. **Range** (the main tee line): stacked shot tracers, a dispersion plot, club gapping, adjustable conditions, and lift/drag trims to match the flight model to your R10. **Coaching** (in the Swing Lab, a glass studio with capture cameras and a pressure mat; the coach's target window stands downrange as two lit poles): the coach reads your shots in fours, names the one fault worth fixing, shows it on a 3D golfer next to the goal swing with two or three likely causes, gives you a cue, and checks your progress after 8 shots. **Learn a skill** (Coaching opens on the choice): nine lessons (shape it, compress your irons, hit up on the driver, flight it high or low, start it on your line, find the centre, wedge distance control, tighten your pattern, add speed), each shown on the 3D golfer, scored shot by shot toward a goal, then a 5-of-8 test. **Short game** (lit wedge pods behind a hedge) and **Bag Mapping** are coming. |
| **The Aerie** | Nine holes (par 36) on floating islands over the clouds: a pulled drive knocked down by a waterfall off an island hanging over the first tee, a blind drive at a hot air balloon, a short climb up grass terraces, a Cape over a cove of open sky, a wedge past a drifting island, a dogleg under a granite overhang, rock ceilings jutting from floating islands, and a climb to the clubhouse. Big landing areas and room around every green; the clouds play as a red penalty area (a drop beside where the ball went over). Landmarks from one hole show in the distance on others. |
| **Red Mesa** | Nine holes (par 36) across and between red-rock mesas, high on the plateau, each built around a classic idea: a Cape, a speed slot into a punchbowl, a Redan from a 70 m drop, a two-tier green past a long natural arch slung across the fairway, a double dogleg with cross waste, a Biarritz over a gorge with a steam train, a drivable par 4 through hoodoos, an Eden with a spring pond, and an Alps finish to the clubhouse. Real green complexes, bunker bowls, rough cuts, tee pads, native carries, sloped lies and pins that change each round. |
| **Hollowmere** | Nine holes through old limestone mine caverns (`course.html?c=hollowmere`): off a ledge at the mine mouth, down to a still lake, through a stalagmite forest, four holes round the Hollow (a vast vaulted cavern with a chasm and a curtain of falls pouring into it), a green cradled in a cracked-open geode, a glowworm grotto with giant mushrooms, and a finish through an eyelet in a rock fin up into a cenote open to the sky. Side caves glitter with crystal, and an ore cart rolls along the rails. Every hole goes up or down. The roof, walls and stalactites are solid rock, and a wall can kill a wild shot into a rubble lie at its foot. |
| **The Reclaim** | Nine holes through a city that nature has taken back, about twenty years on, in morning mist (`course.html?c=reclaim`, a blockout): off the platform of a broken elevated line, round a skyscraper lying on its side across the street, through a gutted tower's blown-out lobby, into a subway cave-in, under the snapped top of a tower propped on the block opposite, down into a quake-rubbled stadium with a sinkhole short of the green, across an overgrown square, along a tipped riverside street to a suspension bridge, round a dock basin, and up a street torn open over a chasm to a leaning clubhouse. Cracked asphalt, rows of stopped cabs, ivy hanging off the towers; facades soak a wild ball into the rubble at their foot. |
| **Rimeholm** | Nine holes across a glacier at night under the aurora (`course.html?c=rimeholm`): packed-snow fairways, crevasses and a moulin to carry, a frozen lake that skates the ball on, powder bunkers that bury it, a black basalt cliff with a frozen waterfall, hot springs and warm moss round the greens, braziers along the lines and a Norse longhouse on the ridge by the 9th. |
| **Mini games** | **Shape It** (fly through flight gates that trace a shot shape, out of the open launch bay of a spaceship), **Zombie Siege** (bomb the horde before it breaks your fence, on a fog-bound farm at night) **Island Hopper** (hop floating islands above the clouds, three lives) and **Golf HORSE** (call your shot on a basketball scoreboard in a floodlit cul-de-sac, with Topgolf-style light-up targets; Dusty joins if you're alone) are playable, for 1–4 players, each with their own difficulty. **Carnival Booth** (a life-size tin shooting gallery: cans, bullseye boards, gliding ducks and the prize bell, for tickets and a plush) **Wedge Ladder** (climb a ladder of landing zones down a runway at sunrise with your wedges) and **Golf Bowling** (ten frames of real bowling down the runner rug of a giant toy room, with toppling pins) are playable too. Glass Tower is next. Design in [docs/MINIGAMES.md](docs/MINIGAMES.md). |

## Play

- **Online:** https://rhysfreitas.github.io/VibeGolf/ (the repo is [rhysfreitas/VibeGolf](https://github.com/rhysfreitas/VibeGolf))
- **Locally:** `npm start`, then open http://localhost:8080. Any static server works; the pages use ES modules, so opening them from `file://` does not.
- **Install as an app:** tap **Install app** on the title screen. Chrome and Edge (desktop and Android) show their install prompt. On iPhone/iPad it is Safari's **Share → Add to Home Screen**, and on a Mac with Safari it is **File → Add to Dock**. Firefox on desktop can't install web apps. Once installed, VibeGolf runs full screen and works offline.

Every course starts on a **round setup** screen: four sets of tees (suggested from the median of your recent drives) and the conditions: time of day (morning, midday, golden hour, night), wind (calm to strong, any or a set direction), weather (clear, high haze, overcast) and temperature. Each course opens on its own signature conditions. Hole cards show a "plays like" yardage that includes the climb or drop to the green and the course's altitude.

Without an R10 connected, every swing is simulated from tour-average launch data with realistic dispersion. Shot data can be adjusted in the range's **Adjust** panel.

### Controls

The layout is built for a phone held sideways (landscape), like a launch-monitor setup. The camera stands just behind the ball, which sits at the bottom center of the screen, and the controls are on the left. It also works on a desktop or tablet, and in portrait.

| | Range | Course |
|---|---|---|
| Hit | **Hit** (bottom left), or `Space` | **Hit** (bottom left), or `Space` |
| Simulated shot | One small button bottom left opens the shot tool: club, Normal / Punch / Stinger, a shape line to drag, a swing-length bar (% of full), Ideal and Hit. Settings (top right) has tracers, sound, conditions, flight trim and exact launch numbers | The same shot tool (Auto plays the suggested club and swing length). Tap the course or the corner map to aim at a spot; ⤢ on the map shows the whole hole |
| Aim | Drag the dashed aim line left or right, or `←` `→`. The crosshair beside the shot pill is Auto-aim (off by default) | Pick a target, or tap the course or the corner map: that aims you there and sets the club and swing length. Then drag the dashed line (or `←` `→`) and the swing-length bar to fine-tune. Auto-aim picks both for you and lands the shot on your target, curve and all |
| Numbers | Readout bottom right: carry, total, offline, launch, ball and club speed, spin. Tap it for the shot detail: club (speed, smash, path, face, face to path, attack), launch and spin (backspin, sidespin, axis), with diagrams. ‹ › steps through shots, and tapping a shot in Session opens it | Readout bottom right. Tap it for ball speed, launch, spin and axis |
| More | **Session** (above the readout) opens the dispersion map, gapping and shot list. **Practice** (top right) switches between Range and Coaching. In Coaching, the chip under the title shows what the coach is doing; the shot tool's **Swing fault** plays simulated shots with a fault so you can try the coach without an R10. `X` clears tracers, `1`–`8` pick clubs | **Play to** (under the hole card) picks the target. Tap the corner map, or press `M`, for the whole hole |

## Connect the R10

A browser can't talk to the R10 over Bluetooth on every platform, and it can't open raw TCP sockets. So a small **bridge** runs on the same computer. Existing R10 connectors already speak **GSPro Open Connect**. The bridge pretends to be GSPro for them and relays each shot into the game over a WebSocket.

```
R10 ──Bluetooth──> connector (OpenLaunch Connect, gsp-r10-adapter, …)
                       │ GSPro Open Connect, TCP 921
                       ▼
                  bridge/  ──WebSocket ws://localhost:8921──> VibeGolf
```

1. Install [Node.js](https://nodejs.org) 18 or newer.
2. Start the bridge:
   ```sh
   cd bridge
   npm install
   npm start            # options: --tcp 921 --ws 8921
   ```
   On Linux, ports below 1024 need `sudo`. Otherwise pick another `--tcp` port and point the connector at it.
3. Start your connector in GSPro mode, pointed at `127.0.0.1` port `921`:
   - [OpenLaunch Connect](https://github.com/chgl42/openlaunch-connect) (macOS): direct Bluetooth to the R10, no phone needed.
   - [gsp-r10-adapter](https://github.com/mholow/gsp-r10-adapter) (Windows): see its README for the direct-Bluetooth and Garmin-app relay modes.
4. In the game, tap the **R10** status and press **Connect** (default `ws://localhost:8921`). The dot turns green when shots are flowing. Live shots are tagged **R10** in the readout. The game sends the club you select back to the connector.

Chrome and Edge allow a page served over `https://` to reach `ws://localhost`. If your browser blocks that connection, run the game locally with `npm start`.

## How it works

```
index.html            title screen
practice.html         the Practice Ground's page: Range, Coaching, Short game, Bag Mapping
courses.html          Play Golf: pick a course
online.html           Online: the friends lobby (coming)
range.html            the Practice Ground (?mode=range|coach)
course.html           the courses (?c=aerie, ?c=redmesa, ?c=hollowmere, ?c=reclaim, ?c=rimeholm)
src/physics.js        ball flight, bounce, roll, cup (pure functions, SI units, no Three.js)
src/launch-monitor.js live shot link + connection popover, shared by every page
src/range/main.js     range page: tracers, cameras, session stats, practice menu
src/world/practice-ground.js the Practice Ground campus: stations, lights, screen, Swing Lab
src/range/coach-ui.js the coaching screens: readout, cause cards, chip, progress, drills, explorer
src/coach/            coaching rules (pure), club windows from the flight model, the condition
                      catalogue, fault presets, and the 3D swing mannequin with its lessons
src/course/main.js    course renderer, round setup, course-management UI, cameras, scoring
src/course/terrain.js ground, surfaces and rock for a hole (pure; shared with the physics and tests)
src/course/conditions.js time of day, wind, weather, temperature, tee suggestion (pure)
src/course/aerie.js   The Aerie's holes; red-mesa.js Red Mesa's (the course builder's format)
src/course/sky-props.js  The Aerie's floating islands, rock, falls, balloon and distant landmarks
src/course/relief.js  penalty relief: the clouds as a red penalty area
src/course/mesa-world.js Red Mesa's floor, cliffs, arches, hoodoos, plants, props and wildlife
src/course/cave.js    caverns (pure): the roof and walls, openings to the sky, stalactites
src/course/cave-world.js Hollowmere's roof, sunbeams, lanterns, crystals, glowworms, mushrooms and falls
src/course/hollowmere.js Hollowmere's holes (generated by tools/hollowmere from the plan's hole data)
src/course/reclaim.js The Reclaim's holes (generated by tools/reclaim from the plan book's data: sampled ground, buildings)
src/course/city-world.js The Reclaim's city: ruined towers, the El, fallen spans, cars and cabs, ivy, the bridge, water
src/course/rimeholm.js Rimeholm's holes (generated by tools/rimeholm from the plan book's data)
src/course/ice-world.js Rimeholm's glacier: seracs, crevasse walls, the frozen falls, the hall, braziers, aurora, moon, animals
src/course/minimap.js corner hole map
bridge/               GSPro Open Connect → WebSocket relay (Node)
vendor/three-r147/    Three.js r147 plus Sky and Line2 add-ons, vendored so the app works offline
tests/                physics calibration, coaching rules, mini games and bridge (`npm test`)
```

**Ball flight.** The flight is integrated with RK4 at 240 Hz, using gravity, drag and Magnus lift. The drag coefficient rises with spin ratio and below about 50 m/s (Reynolds effect). The lift coefficient saturates with spin ratio, and spin decays exponentially. The coefficients were fit to TrackMan PGA Tour averages. Carry, apex and landing angle land within about 4% from driver to pitching wedge, and `npm test` fails if a change drifts more than 5%. Air density comes from temperature, altitude and humidity. Wind acts on the ball's speed through the air, so a headwind costs more than a tailwind gives.

**Coaching.** Each shot becomes impact numbers (face, path, attack, spin loft, smash, start line). Target windows per club start at the TrackMan tour averages and scale to your club speed through the flight model, so the LPGA averages fall out at their speeds. Four shots with one club that agree raise a condition; when several do, the root cause wins (setup, then path, face, low point, strike). The full design is in [docs/COACHING.md](docs/COACHING.md).

**Ground.** Bounces use an impulse model with Penner's speed-dependent restitution. Friction depends on spin, and each surface (fairway, green, rough, sand) has its own turf loss. Rolls feel slope and rolling resistance. On the course, the ground function returns `null` over open air, so balls can fall into the clouds, hit cliff faces or roll off edges. Red Mesa adds a canyon floor under the mesas, and arches and hoodoos the ball bounces off.

## Developing

- `npm test` runs the physics calibration and the bridge end-to-end tests.
- Change a page, refresh the browser. There is no build. Push to `main` and GitHub Pages redeploys in about a minute. The service worker fetches from the network first, so pushes show up on the next load.
- Course holes are data in `src/course/aerie.js` and `src/course/red-mesa.js`. Each island is a superellipse with a top height and rock depth, plus optional green, bunkers, waterfalls and trees. Tees per set, targets and drop zones sit beside the islands; Red Mesa adds a canyon floor, painted fairways and washes, ramps, rock you can hit (arches, hoodoos, boulders and rockfalls), groves and props. Trees on both courses are in play. The format is described in CLAUDE.md.
- Test hooks for headless screenshots: `window.__lowq = true` (set before load) lowers render quality, `__advance(seconds)` steps the simulation, and `window.__pose = { pos, look, fov }` poses the course camera.

## Roadmap

- Coaching: field-test the thresholds with real R10 sessions; more lessons; the Short game area
- Mini games: Glass Tower next
- Play Golf: multiple players, each on their own tee (set by their difficulty)
- Course builder that reads and writes the hole format
- Red Mesa's back nine
- A putting green that uses the R10's putt data
- Native wrappers (Capacitor/Tauri) with direct Bluetooth to the R10
