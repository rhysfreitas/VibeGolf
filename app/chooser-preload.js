'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chooser', {
  onList: f => ipcRenderer.on('chooser:list', (e, list) => f(list)),
  pick: id => ipcRenderer.send('chooser:pick', id),
  cancel: () => ipcRenderer.send('chooser:cancel'),
});
