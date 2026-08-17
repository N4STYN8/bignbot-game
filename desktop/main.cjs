// CODEX CHANGE: Provide a secure desktop shell without coupling Electron to shared web modules.
const path = require("node:path");
const { app, BrowserWindow, ipcMain, session, shell } = require("electron");

const GAME_ROOT = path.join(__dirname, "..");
const approvedClosures = new WeakSet();
const pendingClosures = new WeakSet();

// CODEX CHANGE: Allow only Orbit Echo's music CDN responses to feed Electron's Web Audio analyser.
function enableCdnAudioAnalysis() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["https://cdn.bignbot.com/assets/music/*"] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...(details.responseHeaders || {}),
          "Access-Control-Allow-Origin": ["*"]
        }
      });
    }
  );
}

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
        // CODEX CHANGE: Wait for the CDN probe and prove the desktop can use real track frequency data.
        const realAudioAnalysis = await window.webContents.executeJavaScript(`(async () => {
          const deadline = Date.now() + 5000;
          while (!window.game?.audio?.analysisCorsReady && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return window.game?.audio?.analysisCorsReady === true;
        })()`);
        // Prove all ten identities are reachable through automatic evolution and V cycles colors.
        const visualModes = [];
        for (let i = 0; i < 10; i++) {
          const mode = await window.webContents.executeJavaScript(`(() => {
            const visualizer = window.game?.musicVisualizer;
            visualizer.evolutionPosition = ${i};
            visualizer.evolutionTarget = ${i};
            visualizer._updateEvolution?.(0);
            const state = { name: visualizer?.modeName || "", enabled: visualizer?.enabled !== false };
            return state;
          })()`);
          visualModes.push(mode);
          await new Promise((resolve) => setTimeout(resolve, 55));
        }
        const visualColors = [];
        for (let i = 0; i < 6; i++) {
          const color = await window.webContents.executeJavaScript(`(() => {
            const visualizer = window.game?.musicVisualizer;
            const state = { name: visualizer?.colorName || "", index: visualizer?.colorIndex ?? -1 };
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", bubbles: true }));
            return state;
          })()`);
          visualColors.push(color);
          await new Promise((resolve) => setTimeout(resolve, 55));
        }
        const musicCrossfade = await window.webContents.executeJavaScript(`(async () => {
          const audio = window.game?.audio;
          if (!audio?._startCrossfade) return false;
          const saved = {
            bgm: audio.bgm,
            volume: audio.musicVolume,
            duration: audio.crossfadeDuration,
            index: audio.trackIndex,
            enabled: audio.enabled,
            musicPaused: audio.musicPaused
          };
          const outgoing = { paused: false, volume: 0.4, muted: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
          const incoming = { paused: true, volume: 0, muted: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
          audio.musicVolume = 0.4;
          audio.crossfadeDuration = 0.8;
          audio.bgm = incoming;
          audio._startCrossfade(outgoing, incoming, saved.index);
          await new Promise((resolve) => setTimeout(resolve, 1050));
          const passed = outgoing.paused
            && !incoming.paused
            && Math.abs(incoming.volume - 0.4) < 0.01
            && audio._crossfade === null;
          audio._cancelCrossfade();
          audio.bgm = saved.bgm;
          audio.musicVolume = saved.volume;
          audio.crossfadeDuration = saved.duration;
          audio.trackIndex = saved.index;
          audio.enabled = saved.enabled;
          audio.musicPaused = saved.musicPaused;
          if (audio.bgm) audio.bgm.volume = saved.volume;
          return passed;
        })()`);
        const manualSkipImmediate = await window.webContents.executeJavaScript(`(async () => {
          const audio = window.game?.audio;
          if (!audio?.setTrackIndex) return false;
          const saved = {
            bgm: audio.bgm,
            makeBgm: audio._makeBgm,
            index: audio.trackIndex,
            enabled: audio.enabled,
            unlocked: audio.unlocked,
            musicPaused: audio.musicPaused
          };
          const outgoing = { paused: false, volume: audio.musicVolume, muted: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
          const incoming = { paused: true, volume: 0, muted: false, plays: 0, pause() { this.paused = true; }, play() { this.paused = false; this.plays++; return Promise.resolve(); } };
          audio._cancelCrossfade();
          audio.bgm = outgoing;
          audio.trackIndex = 0;
          audio._makeBgm = () => incoming;
          audio.setTrackIndex(1, true, false);
          await Promise.resolve();
          const passed = outgoing.paused
            && !incoming.paused
            && incoming.plays > 0
            && Math.abs(incoming.volume - audio.musicVolume) < 0.001
            && audio._crossfade === null;
          audio._cancelCrossfade();
          audio._makeBgm = saved.makeBgm;
          audio.bgm = saved.bgm;
          audio.trackIndex = saved.index;
          audio.enabled = saved.enabled;
          audio.unlocked = saved.unlocked;
          audio.musicPaused = saved.musicPaused;
          if (audio.bgm) audio.bgm.volume = audio.musicVolume;
          return passed;
        })()`);
        const hudMusicReactive = await window.webContents.executeJavaScript(`(() => {
          const selected = window.game?.selectedTurretWaveform;
          const outer = window.game?.hudOuterWaveform;
          if (!selected || !outer) return false;
          const turret = { x: 300, y: 300, typeKey: "PULSE", aimAng: 0 };
          const makeMusic = (level) => ({
            energy: { bass: level, mid: level * 0.82, high: level * 0.72, intensity: level, beat: level > 0.5 ? 0.9 : 0, snap: level > 0.5 ? 0.55 : 0, drop: 0 },
            spectrum: new Array(32).fill(level),
            audioWaveform: new Array(128).fill(0).map((_, i) => Math.sin(i * 0.31) * level),
            audioSystem: { isMusicPlaying: () => true },
            timeSeconds: 4.2
          });
          const average = (values, count, absolute = false) => {
            let total = 0;
            for (let i = 0; i < count; i++) total += absolute ? Math.abs(values[i]) : values[i];
            return total / Math.max(1, count);
          };
          selected.clear(true);
          outer.clear(true);
          for (let i = 0; i < 35; i++) {
            selected.update(1 / 60, turret, makeMusic(0.05), { zoom: 1, vfx: "med", enemyCount: 0 });
            outer.update(1 / 60, turret, makeMusic(0.05), { zoom: 1, vfx: "med", enemyCount: 0 });
          }
          const quietSelected = average(selected.values, 76);
          const quietOuter = average(outer.values, 96) + average(outer.waveValues, 96, true);
          selected.clear(true);
          outer.clear(true);
          for (let i = 0; i < 35; i++) {
            selected.update(1 / 60, turret, makeMusic(0.85), { zoom: 1, vfx: "med", enemyCount: 0 });
            outer.update(1 / 60, turret, makeMusic(0.85), { zoom: 1, vfx: "med", enemyCount: 0 });
          }
          const loudSelected = average(selected.values, 76);
          const loudOuter = average(outer.values, 96) + average(outer.waveValues, 96, true);
          selected.clear(true);
          outer.clear(true);
          return loudSelected > quietSelected * 3 && loudOuter > quietOuter * 3;
        })()`);
        const turretHoverRangeFade = await window.webContents.executeJavaScript(`(() => {
          const game = window.game;
          if (!game?._updateHoveredTurretRange) return false;
          const savedTurrets = game.turrets;
          const savedHovered = game.hoveredTurret;
          const turret = { _hoverRangeAlpha: 0 };
          game.turrets = [turret];
          game.hoveredTurret = turret;
          for (let i = 0; i < 30; i++) game._updateHoveredTurretRange(1 / 60);
          const fadedIn = turret._hoverRangeAlpha;
          game.hoveredTurret = null;
          for (let i = 0; i < 45; i++) game._updateHoveredTurretRange(1 / 60);
          const fadedOut = turret._hoverRangeAlpha;
          game.turrets = savedTurrets;
          game.hoveredTurret = savedHovered;
          return fadedIn > 0.98 && fadedOut < 0.01;
        })()`);
        const skippedWavesStaggered = await window.webContents.executeJavaScript(`(() => {
          const game = window.game;
          if (!game?._queueWaveSpawns) return false;
          const saved = {
            waveActive: game.waveActive,
            intermission: game.intermission,
            spawnT: game.spawnT,
            spawnIndex: game.spawnIndex,
            spawnQueue: game.spawnQueue,
            lastStart: game._lastQueuedWaveStartT
          };
          game.waveActive = true;
          game.intermission = 0;
          game.spawnT = 10;
          game.spawnIndex = 1;
          const consumedSpawn = { t: 2, queuedWave: 1, waveStartT: 0 };
          game.spawnQueue = [consumedSpawn, { t: 12, queuedWave: 1, waveStartT: 0 }];
          game._lastQueuedWaveStartT = 0;
          const secondStart = game._queueWaveSpawns([{ t: 0 }, { t: 1 }], 2);
          const thirdStart = game._queueWaveSpawns([{ t: 0 }, { t: 1 }], 3);
          const ordered = game.spawnQueue.slice(game.spawnIndex).every((spawn, i, list) => i === 0 || list[i - 1].t <= spawn.t);
          const passed = secondStart === 14 && thirdStart === 18
            && ordered
            && game.spawnQueue[0] === consumedSpawn
            && game.spawnQueue.filter((spawn) => spawn.queuedWave === 2)[0]?.t === 14
            && game.spawnQueue.filter((spawn) => spawn.queuedWave === 3)[0]?.t === 18;
          game.waveActive = saved.waveActive;
          game.intermission = saved.intermission;
          game.spawnT = saved.spawnT;
          game.spawnIndex = saved.spawnIndex;
          game.spawnQueue = saved.spawnQueue;
          game._lastQueuedWaveStartT = saved.lastStart;
          return passed;
        })()`);
        const barGraphMusicReactive = await window.webContents.executeJavaScript(`(() => {
          const game = window.game;
          const map = game?.map;
          const visual = game?.musicVisualizer?.getGridState?.();
          if (!map?._drawBackFieldWaveform || !visual) return false;
          const savedBottomBars = map.showBottomSpectrumBars;
          map.showBottomSpectrumBars = true;
          const measure = (energy, spectrum, audioWaveform) => {
            const music = map._musicGridState({ ...visual, mode: 8, nextMode: 8, modeBlend: 0, energy, spectrum, audioWaveform, wave: 10, waveMax: 16 });
            const canvas = document.createElement("canvas");
            canvas.width = document.getElementById("game")?.width || 1280;
            canvas.height = document.getElementById("game")?.height || 720;
            const gfx = canvas.getContext("2d");
            const heights = [];
            const fillRect = gfx.fillRect.bind(gfx);
            gfx.fillRect = (x, y, width, height) => { heights.push(height); fillRect(x, y, width, height); };
            map._drawBackFieldWaveform(gfx, music, 1, []);
            return { average: heights.reduce((a, b) => a + b, 0) / Math.max(1, heights.length), max: Math.max(0, ...heights) };
          };
          const quiet = measure(
            { bass: 0.03, mid: 0.025, high: 0.02, intensity: 0.025, beat: 0, snap: 0, drop: 0, tempo: 0.4 },
            new Array(32).fill(0.03),
            new Array(128).fill(0.005)
          );
          const music = measure(
            { bass: 0.58, mid: 0.25, high: 0.18, intensity: 0.44, beat: 0.8, snap: 0.45, drop: 0, tempo: 0.58 },
            new Array(32).fill(0).map((_, i) => 0.18 + 0.54 * Math.abs(Math.sin(i * 0.47 + 0.2))),
            new Array(128).fill(0).map((_, i) => Math.sin(i * 0.31) * 0.045)
          );
          map.showBottomSpectrumBars = savedBottomBars;
          return music.average > quiet.average * 2 && music.max > map.gridSize * 3.5;
        })()`);
        const bottomBarDisabled = await window.webContents.executeJavaScript(`window.game?.map?.showBottomSpectrumBars === false`);
        const evolvingBackgroundWaveforms = await window.webContents.executeJavaScript(`(() => {
          const game = window.game;
          const map = game?.map;
          const visual = game?.musicVisualizer?.getGridState?.();
          if (!map?._drawAudioWaveforms || !visual) return false;
          const measure = (wave, time) => {
            const music = map._musicGridState({
              ...visual,
              enabled: true,
              mode: 8,
              nextMode: 9,
              modeBlend: 0.4,
              wave,
              waveMax: 20,
              time,
              energy: { bass: 0.62, mid: 0.58, high: 0.72, intensity: 0.68, beat: 0.45, snap: 0.32, drop: 0, tempo: 0.62 },
              spectrum: new Array(32).fill(0).map((_, i) => 0.22 + Math.abs(Math.sin(i * 0.41)) * 0.58),
              audioWaveform: new Array(128).fill(0).map((_, i) => Math.sin(i * 0.27) * 0.34)
            });
            const canvas = document.createElement("canvas");
            canvas.width = document.getElementById("game")?.width || 1280;
            canvas.height = document.getElementById("game")?.height || 720;
            const gfx = canvas.getContext("2d");
            let strokes = 0;
            let arcs = 0;
            let dashes = 0;
            const stroke = gfx.stroke.bind(gfx);
            const arc = gfx.arc.bind(gfx);
            const setLineDash = gfx.setLineDash.bind(gfx);
            gfx.stroke = (...args) => { strokes += 1; return stroke(...args); };
            gfx.arc = (...args) => { arcs += 1; return arc(...args); };
            gfx.setLineDash = (value) => { if (value?.length) dashes += 1; return setLineDash(value); };
            map._drawAudioWaveforms(gfx, music, 1);
            return { strokes, arcs, dashes };
          };
          const early = measure(1, 4);
          const late = measure(16, 18);
          return early.strokes >= 4 && early.arcs === 0
            && late.strokes > early.strokes
            && late.arcs >= 6
            && late.dashes >= 2;
        })()`);
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
          // CODEX CHANGE: Prove a beat changes hue without replacing the player's selected C palette.
          const visualState = window.game?.musicVisualizer?.getGridState?.();
          const calmMusic = visualState ? window.game.map._musicGridState({
            ...visualState,
            energy: { ...visualState.energy, beat: 0, snap: 0, drop: 0 }
          }) : null;
          const beatMusic = visualState ? window.game.map._musicGridState({
            ...visualState,
            energy: { ...visualState.energy, beat: 1, snap: 0, drop: 0 }
          }) : null;
          const calmHue = calmMusic ? window.game.map._musicPalette(calmMusic).solid : null;
           const beatHue = beatMusic ? window.game.map._musicPalette(beatMusic).solid : null;
           const tileCount = window.game?.map?.cells?.length || 0;
           const ecosystemFields = ["tileEnergy", "tileHeat", "tileMemory", "tileFrequency", "tileCorruption", "tileHarmony", "tileGrowth"];
           const ecosystemTileFields = tileCount > 0 && ecosystemFields.every((key) => window.game?.map?.[key]?.length === tileCount);
           const finalEvolutionStage = visualState ? window.game.map._musicGridState({
             ...visualState,
             wave: 16,
             waveMax: 16,
             boss: true,
             vfxQuality: "med"
           }).evolutionStage : -1;
           const smokeMap = window.game?.map;
           const ecosystemIndex = smokeMap?.cells?.findIndex((value, index) => {
             const gx = index % smokeMap.cols;
             const gy = Math.floor(index / smokeMap.cols);
             return value === 1 && !smokeMap._isBuildableCorrupted(gx, gy, index, value);
           }) ?? -1;
           let abilityDeathInjected = false;
           let pausedEcosystemFrozen = false;
           let ecosystemReset = false;
           let offBlocksEcosystemInjection = false;
           let turretFireInjected = false;
           let musicUsesTrackClock = false;
           if (ecosystemIndex >= 0 && visualState) {
             const map = window.game.map;
             const gx = ecosystemIndex % map.cols;
             const gy = Math.floor(ecosystemIndex / map.cols);
             map._ecosystemEnabled = true;
             const before = map.tileEnergy[ecosystemIndex] || 0;
             map.triggerAbilityKillPulse((gx + 0.5) * map.gridSize, (gy + 0.5) * map.gridSize, "emp", false);
             abilityDeathInjected = (map.tileEnergy[ecosystemIndex] || 0) > before;
             map.tileMemory[ecosystemIndex] = 0.64;
             map.activeTileEnergy.add(ecosystemIndex);
             const pausedState = map._musicGridState({ ...visualState, wave: 8, waveMax: 16, simulationPaused: true, vfxQuality: "med" });
             map._updateTileEnergy(pausedState, 1, []);
             pausedEcosystemFrozen = Math.abs(map.tileMemory[ecosystemIndex] - 0.64) < 0.0001;
             map.resetEcosystem();
             ecosystemReset = map.activeTileEnergy.size === 0 && map.tileMemory.every((value) => value === 0);
             const fireTurret = { x: (gx + 0.5) * map.gridSize, y: (gy + 0.5) * map.gridSize, level: 2, typeKey: "PULSE", flash: 1 };
             window.game.onCombatEvent({ type: "tower:fire", source: fireTurret, target: { x: fireTurret.x + map.gridSize, y: fireTurret.y } });
             turretFireInjected = (map.tileEnergy[ecosystemIndex] || 0) > 0
               && map.musicWaves.some((entry) => entry.kind === "turretFire");
             map.resetEcosystem();
             map._ecosystemEnabled = false;
             map.triggerKillPulse((gx + 0.5) * map.gridSize, (gy + 0.5) * map.gridSize, false);
             offBlocksEcosystemInjection = map.tileEnergy[ecosystemIndex] === 0 && map.tileMemory[ecosystemIndex] === 0;
             map._ecosystemEnabled = visualState.enabled !== false;
           }
           const visualizer = window.game?.musicVisualizer;
           if (visualizer?._resolveVisualTime) {
             const savedAudio = visualizer.audioSystem;
             visualizer.audioSystem = { bgm: { currentTime: 12.5 }, isMusicPlaying: () => true };
             musicUsesTrackClock = Math.abs(visualizer._resolveVisualTime(99000) - 12.5) < 0.0001;
             visualizer.audioSystem = savedAudio;
           }
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
            musicColorAlternation: Number.isFinite(calmHue) && Number.isFinite(beatHue) && Math.abs(calmHue - beatHue) > 0.5,
            // CODEX CHANGE: Confirm the renderer receives a full oscilloscope sample frame.
             audioWaveformSamples: window.game?.musicVisualizer?.getGridState?.().audioWaveform?.length || 0,
             ecosystemTileFields,
             finalEvolutionStage,
             abilityDeathInjected,
             pausedEcosystemFrozen,
             ecosystemReset,
             offBlocksEcosystemInjection,
             turretFireInjected,
             musicUsesTrackClock,
             colorPersistence: localStorage.getItem("orbit_echo_grid_visual_color_v1") === String(window.game?.musicVisualizer?.colorIndex),
            mapCoverageX: mapWidth * zoom / Math.max(1, window.innerWidth),
            mapCoverageY: mapHeight * zoom / Math.max(1, window.innerHeight)
          };
        })()`);
        result.startedFullscreen = startedFullscreen;
        result.fullscreenToggledOff = !window.isFullScreen();
        result.activeVisualModes = new Set(visualModes.filter((mode) => mode.enabled).map((mode) => mode.name)).size;
        result.offVisualModes = visualModes.filter((mode) => !mode.enabled).length;
        result.colorVariants = new Set(visualColors.map((color) => color.name).filter(Boolean)).size;
        result.musicCrossfade = musicCrossfade;
        result.manualSkipImmediate = manualSkipImmediate;
        result.hudMusicReactive = hudMusicReactive;
        result.turretHoverRangeFade = turretHoverRangeFade;
        result.skippedWavesStaggered = skippedWavesStaggered;
        result.barGraphMusicReactive = barGraphMusicReactive;
        result.bottomBarDisabled = bottomBarDisabled;
        result.evolvingBackgroundWaveforms = evolvingBackgroundWaveforms;
        result.realAudioAnalysis = realAudioAnalysis;
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
          && result.musicColorAlternation
          && result.audioWaveformSamples === 128
           && result.ecosystemTileFields
           && result.finalEvolutionStage === 5
           && result.abilityDeathInjected
           && result.pausedEcosystemFrozen
           && result.ecosystemReset
           && result.offBlocksEcosystemInjection
           && result.turretFireInjected
           && result.musicUsesTrackClock
           && result.colorPersistence
          && result.startedFullscreen
          && result.fullscreenToggledOff
          && result.activeVisualModes === 10
          && result.offVisualModes === 0
          && result.colorVariants === 6
          && result.musicCrossfade
          && result.manualSkipImmediate
          && result.hudMusicReactive
          && result.turretHoverRangeFade
          && result.skippedWavesStaggered
          && result.barGraphMusicReactive
          && result.bottomBarDisabled
          && result.evolvingBackgroundWaveforms
          && result.realAudioAnalysis
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
  // CODEX CHANGE: Install the narrow CDN response rule before loading any game audio.
  enableCdnAudioAnalysis();
  createGameWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createGameWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
