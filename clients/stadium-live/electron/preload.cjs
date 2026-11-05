const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mllStadiumLive', {
  /** Desktop/mobile shell — only Stadium Live, never the full game. */
  isWidgetShell: true,
  getLiveUrl: () => ipcRenderer.invoke('mll:get-live-url'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('mll:toggle-always-on-top'),
  openExternal: (url) => ipcRenderer.invoke('mll:open-external', url),
  minimize: () => ipcRenderer.invoke('mll:window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('mll:window-toggle-maximize'),
  close: () => ipcRenderer.invoke('mll:window-close'),
});
