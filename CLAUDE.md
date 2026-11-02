# VibeGolf: notes for coding agents

Golf simulator for the Garmin Approach R10. Static site served from the repo root by GitHub Pages. There is **no build step and no bundler**.

## Ground rules
- Three.js is **r147 UMD**, vendored in `vendor/three-r147/` and used as the global `THREE`, including `THREE.Sky`, `THREE.Line2`, `THREE.LineMaterial` and `THREE.LineGeometry`. Each page loads those classic scripts first, then its ES module. Moving to a newer Three.js means switching to an importmap plus `three/addons/...` and updating every `THREE.Xxx` add-on reference.
- `src/physics.js` must stay pure: no DOM, no Three.js, SI units inside, mph/deg/rpm at the boundary. Input follows GSPro Open Connect `BallData` naming (`Speed`, `VLA`, `HLA`, `TotalSpin`, `SpinAxis`).
- Coordinates: x = right, y = up, −z = downrange. On the course, each hole has its own frame with the tee near the origin.
- `groundAt(x, z)` returns `null` over open air. The physics treats that as no ground: the ball can fall into the void, hit cliff walls or roll off edges.
- Run `npm test` after touching physics. The calibration test keeps carries within 5% of TrackMan tour averages. If you change coefficients on purpose, refit them rather than loosening the test.
- Live shots come only through `src/launch-monitor.js` (`launchMonitor` emits `shot` events). Don't add another path.
- Page styles live in `styles/<page>.css` with tokens on `:root`. Shared bits (launch-monitor popover, status dot, menu link) are in `styles/shared.css`.

## Layout
Both modes are **landscape-first** (phone held sideways). The camera "stands over the ball": `src/stance.js` solves a position a few metres behind the ball at eye height and a pitch that puts the ball near the bottom centre at any aspect ratio, tipping up only as far as needed to keep a ball in flight in frame. Controls sit in a bottom-left cluster (`#hitbar`), the readout is bottom right, and settings live in fly-out `.sheet` panels. There is one camera per mode by design. On the course, the corner map is the only view switch (tap it for the whole hole). Check changes at 844×390 and 667×375 (phone landscape) and at desktop size. Portrait gets a dismissible "turn sideways" prompt on touch devices.

## Gotcha: Line2 tracers
Three r147 caches an instanced geometry's draw count (`_maxInstanceCount`) the first time it renders. Any `Line2` whose point count changes (growing tracers, preview arcs) must reset `geometry._maxInstanceCount = undefined` after `setPositions`, or it stays frozen at its first length. The helpers `setLinePositions` (range) and `setLine` (course) already do this. Line widths are in device pixels, so scale them by `renderer.getPixelRatio()`.

## Visual checks
Serve the folder (`npm start`) and drive it headlessly with Playwright. Set `window.__lowq = true` in an init script so it renders at software-GL speed, call `__advance(seconds)` to step the simulation deterministically (`__advance(seconds, n)` also renders every nth step, which is how real play behaves; use it for anything that changes frame to frame), and on the course set `window.__pose = { pos:[x,y,z], look:[x,y,z], fov }` for a fixed camera. `__state` exposes course game state and `__startHole(i)` jumps holes.

## Course data
`src/course/aerie.js` holds `HOLES`. Islands are superellipses (`rx`, `rz`, `rot`, `top`, `depth`, `kind`) with optional `green`, `pin`, `bunkers`, `falls` and `trees`. `targets` are the course-management picks, and `drops` are the penalty drop spots. Keep that format stable, because the planned course builder will read and write it.
