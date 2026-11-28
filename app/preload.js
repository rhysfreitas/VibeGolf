// The hub's view of the app (main frame only; the game's pages never see it). The game can tell it is in the
// app with `window.top.vibegolfApp`; today only the app's own update note uses it.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vibegolfApp', {
  app: true,
  info: () => ipcRenderer.invoke('app:info'),
  restart: () => ipcRenderer.send('app:restart'),
});

// Tests only (scripts/smoke.mjs sets VIBEGOLF_TEST_INJECT): a script run in the hub before its own, such as
// the fake R10. Empty in normal use.
const inject = ipcRenderer.sendSync('test:inject');
if (inject) contextBridge.executeInMainWorld({ func: src => { (0, eval)(src); }, args: [inject] });
