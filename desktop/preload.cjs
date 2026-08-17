// CODEX CHANGE: Expose only inert runtime metadata to the web game through an isolated bridge.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbitEchoDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }),
  toggleFullscreen: () => ipcRenderer.invoke("orbit-echo:toggle-fullscreen"),
  exit: () => ipcRenderer.invoke("orbit-echo:exit")
}));
