# VibeGolf for Windows (app/)

An Electron shell round the hub (`app.html`). Stage B of the project's `claude/brief-pc-app.md`. The game
itself isn't forked: the app serves the same files the website does.

- `main.js`: the main process. Serves the game from `vibegolf://game/` (a secure, fixed origin, so Web
  Bluetooth and cameras work and saved data survives updates), opens the hub, answers the game's Bluetooth
  request (`select-bluetooth-device`, rules in `lib/r10-pick.js`), reconnects the remembered R10 at start
  with no tap (it presses the game's own Connect R10 as a user gesture when the hub says `needsTap`),
  grants camera and microphone to the game's own origin only, sends outside links to the browser, keeps the
  PC awake on play pages (`powerSaveBlocker`, `lib/pages.js`), remembers the window (`lib/window-state.js`),
  F11 full screen, a menu (Alt shows it), and the update note.
- `lib/updater.js` + `lib/site-store.js`: the game's copy. The installer carries one (`resources/site`, made
  by `scripts/copy-site.mjs` with every file's git blob id in `site-version.json`). At start the app asks
  GitHub for the latest commit on main and its file tree, downloads only the files whose blob id changed
  (checked against it) into `%APPDATA%\VibeGolf\sites\<commit>`, and shows "Update ready · Restart"; the
  next start serves it. Offline, it plays the copy it has.
- `chooser.html`: the app's own device chooser, for a first connect with more than one candidate or after
  Show all devices.
- `preload.js`: `window.vibegolfApp` in the hub only (`info()`, `restart()`).

```
npm install
npm test                 # the app's logic: picker rules, window, site files, updater against a fake GitHub
npm start                # copy the game and run the app
node scripts/smoke.mjs   # the real app end to end with tools/r10/fake-r10.js (xvfb-run -a on Linux)
npm run dist             # the Windows installer (on Windows; CI does it)
```

Releases: push a tag `app-vX.Y.Z`; `.github/workflows/app.yml` builds on Windows, runs the tests and the
smoke check, and attaches `VibeGolf-Setup-X.Y.Z.exe` to a release. Unsigned. Logs and settings are in
`%APPDATA%\VibeGolf` (Help › Open the log folder).
