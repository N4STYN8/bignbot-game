// CODEX CHANGE: Provide a secure desktop shell without coupling Electron to shared web modules.
const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const GAME_ROOT = path.join(__dirname, "..");
const approvedClosures = new WeakSet();
const pendingClosures = new WeakSet();

// CODEX CHANGE: Save through the renderer's established persistence path before any desktop close.
async function saveAndClose(window) {
  if (!window || window.isDestroyed() || pendingClosures.has(window)) return;
  pendingClosures.add(window);
  try {
    await window.webContents.executeJavaScript("window.game?.saveNow?.(); true");
  } catch (error) {
    console.warn("Orbit Echo could not confirm its final autosave.", error);
  } finally {
    if (!window.isDestroyed()) {
      approvedClosures.add(window);
      window.close();
    }
  }
}

function createGameWindow() {
  const window = new BrowserWindow({
    title: "Orbit Echo",
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    fullscreen: process.env.ORBIT_ECHO_DESKTOP_SMOKE !== "1"
      || process.env.ORBIT_ECHO_DESKTOP_FULLSCREEN_SMOKE === "1",
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

  // CODEX CHANGE: Cover title-bar close, Alt+F4, and app shutdown with a final autosave.
  window.on("close", (event) => {
    if (approvedClosures.has(window)) return;
    event.preventDefault();
    void saveAndClose(window);
  });

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
        const startedFullscreen = window.isFullScreen();
        await window.webContents.executeJavaScript("window.orbitEchoDesktop.toggleFullscreen()");
        await new Promise((resolve) => setTimeout(resolve, 900));
        // CODEX CHANGE: Render every V-cycle state and verify Escape opens the save-and-exit prompt.
        const visualModes = [];
        for (let i = 0; i < 11; i++) {
          const mode = await window.webContents.executeJavaScript(`(() => {
            const visualizer = window.game?.musicVisualizer;
            const state = { name: visualizer?.modeName || "", enabled: visualizer?.enabled !== false };
            visualizer?.cycleMode?.();
            return state;
          })()`);
          visualModes.push(mode);
          await new Promise((resolve) => setTimeout(resolve, 55));
        }
        const escapePrompt = await window.webContents.executeJavaScript(`(() => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          const modal = document.getElementById("confirmModal");
          const title = document.getElementById("modalTitle")?.textContent || "";
          const visible = Boolean(modal && !modal.classList.contains("hidden"));
          document.getElementById("modalCancel")?.click();
          return visible && title === "Save & Exit";
        })()`);
        const result = await window.webContents.executeJavaScript(`(() => {
          const mapWidth = (window.game?.map?.cols || 0) * (window.game?.map?.gridSize || 0);
          const mapHeight = (window.game?.map?.rows || 0) * (window.game?.map?.gridSize || 0);
          const zoom = window.game?.zoom || 0;
          return {
            title: document.title,
            readyState: document.readyState,
            hasCanvas: Boolean(document.getElementById("game")),
            hasGame: Boolean(window.game),
            gameState: window.game?.gameState ?? null,
            runtimeError: window.game?.runtimeError ?? null,
            desktopBridge: window.orbitEchoDesktop?.isDesktop === true,
            desktopControlsVisible: document.getElementById("desktopControls")?.hidden === false,
            desktopActions: typeof window.orbitEchoDesktop?.toggleFullscreen === "function"
              && typeof window.orbitEchoDesktop?.exit === "function",
            saveSucceeded: window.game?.saveNow?.() === true,
            mapCoverageX: mapWidth * zoom / Math.max(1, window.innerWidth),
            mapCoverageY: mapHeight * zoom / Math.max(1, window.innerHeight)
          };
        })()`);
        result.startedFullscreen = startedFullscreen;
        result.fullscreenToggledOff = !window.isFullScreen();
        result.activeVisualModes = new Set(visualModes.filter((mode) => mode.enabled).map((mode) => mode.name)).size;
        result.offVisualModes = visualModes.filter((mode) => !mode.enabled && mode.name === "OFF").length;
        result.escapePrompt = escapePrompt;
        console.log(`ORBIT_ECHO_SMOKE ${JSON.stringify(result)}`);
        const mapFitsViewport = result.mapCoverageX >= 0.7 && result.mapCoverageX <= 1.05
          && result.mapCoverageY >= 0.7 && result.mapCoverageY <= 1.05;
        const passed = result.hasCanvas
          && result.hasGame
          && result.desktopBridge
          && result.desktopControlsVisible
          && result.desktopActions
          && result.saveSucceeded
          && result.startedFullscreen
          && result.fullscreenToggledOff
          && result.activeVisualModes === 10
          && result.offVisualModes === 1
          && result.escapePrompt
          && mapFitsViewport
          && !result.runtimeError;
        if (!passed) {
          app.exit(1);
          return;
        }
        // Exercise the same save-aware IPC exit used by the visible desktop button.
        await window.webContents.executeJavaScript("window.orbitEchoDesktop.exit()");
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

// CODEX CHANGE: Restrict renderer desktop actions to fullscreen control and save-aware exit.
ipcMain.handle("orbit-echo:toggle-fullscreen", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  window.setFullScreen(!window.isFullScreen());
  return window.isFullScreen();
});

ipcMain.handle("orbit-echo:exit", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return false;
  void saveAndClose(window);
  return true;
});

app.whenReady().then(() => {
  createGameWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
