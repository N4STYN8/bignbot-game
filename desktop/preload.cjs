// CODEX CHANGE: Expose only inert runtime metadata to the web game through an isolated bridge.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("orbitEchoDesktop", Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({
    chrome: process.versions.chrome,
    electron: process.versions.electron
  })
}));
