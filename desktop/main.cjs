// CODEX CHANGE: Provide a secure desktop shell without coupling Electron to shared web modules.
const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

const GAME_ROOT = path.join(__dirname, "..");

function createGameWindow() {
  const window = new BrowserWindow({
    title: "Orbit Echo",
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#050914",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(GAME_ROOT, "assets", "images", "gamelogo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });

  window.webContents.on("before-input-event", (event, input) => {
    const toggleFullscreen = input.type === "keyDown"
      && (input.key === "F11" || (input.alt && input.key === "Enter"));
    if (!toggleFullscreen) return;
    event.preventDefault();
    window.setFullScreen(!window.isFullScreen());
  });

  // CODEX CHANGE: Give automated packaging checks a read-only proof that the game booted.
  if (process.env.ORBIT_ECHO_DESKTOP_SMOKE === "1") {
    window.webContents.once("did-finish-load", async () => {
      try {
        const result = await window.webContents.executeJavaScript(`({
          title: document.title,
          readyState: document.readyState,
          hasCanvas: Boolean(document.getElementById("game")),
          hasGame: Boolean(window.game),
          gameState: window.game?.gameState ?? null,
          runtimeError: window.game?.runtimeError ?? null,
          desktopBridge: window.orbitEchoDesktop?.isDesktop === true
        })`);
        console.log(`ORBIT_ECHO_SMOKE ${JSON.stringify(result)}`);
        app.exit(result.hasCanvas && result.hasGame && result.desktopBridge && !result.runtimeError ? 0 : 1);
      } catch (error) {
        console.error("ORBIT_ECHO_SMOKE_FAILED", error);
        app.exit(1);
      }
    });
  }

  void window.loadFile(path.join(GAME_ROOT, "index.html")).catch((error) => {
    console.error("Orbit Echo failed to load.", error);
    if (process.env.ORBIT_ECHO_DESKTOP_SMOKE === "1") app.exit(1);
  });
}

app.whenReady().then(() => {
  createGameWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
