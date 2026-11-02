# Aerie Golf: notes for coding agents

Golf simulator for the Garmin Approach R10. Static site served from the repo root by GitHub Pages. There is **no build step and no bundler**.

## Ground rules
- Three.js is **r147 UMD**, vendored in `vendor/three-r147/` and used as the global `THREE`, including `THREE.Sky`, `THREE.Line2`, `THREE.LineMaterial` and `THREE.LineGeometry`. Each page loads those classic scripts first, then its ES module. Moving to a newer Three.js means switching to an importmap plus `three/addons/...` and updating every `THREE.Xxx` add-on reference.
- `src/physics.js` must stay pure: no DOM, no Three.js, SI units inside, mph/deg/rpm at the boundary. Input follows GSPro Open Connect `BallData` naming (`Speed`, `VLA`, `HLA`, `TotalSpin`, `SpinAxis`).
- Coordinates: x = right, y = up, −z = downrange. On the course, each hole has its own frame with the tee near the origin.
- `groundAt(x, z)` returns `null` over open air. The physics treats that as no ground: the ball can fall into the void, hit cliff walls or roll off edges.
- Run `npm test` after touching physics. The calibration test keeps carries within 5% of TrackMan tour averages. If you change coefficients on purpose, refit them rather than loosening the test.
- Live shots come only through `src/launch-monitor.js` (`launchMonitor` emits `shot` events). Don't add another path.
- Page styles live in `styles/<page>.css` with tokens on `:root`. Shared bits (launch-monitor popover, status dot, menu link) are in `styles/shared.css`.

## Visual checks
Serve the folder (`npm start`) and drive it headlessly with Playwright. Set `window.__lowq = true` in an init script so it renders at software-GL speed, call `__advance(seconds)` to step the simulation deterministically, and on the course set `window.__pose = { pos:[x,y,z], look:[x,y,z], fov }` for a fixed camera. `__state` exposes course game state and `__startHole(i)` jumps holes.

## Course data
`src/course/aerie.js` holds `HOLES`. Islands are superellipses (`rx`, `rz`, `rot`, `top`, `depth`, `kind`) with optional `green`, `pin`, `bunkers`, `falls` and `trees`. `targets` are the course-management picks, and `drops` are the penalty drop spots. Keep that format stable, because the planned course builder will read and write it.
