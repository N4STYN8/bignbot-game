import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";
import { AudioSystem } from "./audio.js";
import { Map } from "./map.js";
import { DAMAGE, ANOMALIES, ENEMY_TYPES, Enemy, turretHitFxProfile } from "./enemies.js";
import { Particles } from "./vfx.js";
import { Projectile } from "./projectiles.js";
import { TURRET_TYPES, Turret } from "./turrets.js";

// CODEX CHANGE: Echo Cascade tuning knobs and lightweight HUD/FX references.
const comboCascadeEl = document.getElementById("comboCascade");
const comboCascadeCountEl = document.getElementById("comboCascadeCount");
const screenFxEl = document.querySelector(".screenFx");
const ECHO_CASCADE_WINDOW_TIERS = [
  { min: 16, sec: 0.8 },
  { min: 11, sec: 1.0 },
  { min: 6, sec: 1.25 },
  { min: 1, sec: 1.5 }
];
const ECHO_CASCADE_GOLD_TIERS = [
  { min: 15, mult: 1.25 },
  { min: 10, mult: 1.15 },
  { min: 6, mult: 1.1 },
  { min: 3, mult: 1.05 },
  { min: 0, mult: 1.0 }
];
const ECHO_CASCADE_FADE_SECS = 0.45;
const ECHO_CASCADE_PULSE_SHAKE_T = 0.02;
const ECHO_CASCADE_PULSE_SHAKE_MAG = 0.35;

// CODEX CHANGE: Helper keeps combo window tiers centralized for quick balancing.
function comboWindowForCount(count) {
  const c = Math.max(0, count | 0);
  for (const tier of ECHO_CASCADE_WINDOW_TIERS) {
    if (c >= tier.min) return tier.sec;
  }
  return 1.5;
}

// CODEX CHANGE: Helper keeps combo reward tiers centralized for quick balancing.
function comboMultForCount(count) {
  const c = Math.max(0, count | 0);
  for (const tier of ECHO_CASCADE_GOLD_TIERS) {
    if (c >= tier.min) return tier.mult;
  }
  return 1.0;
}

/**********************
 * Game
 **********************/
class Game {
  // CODEX CHANGE: Split constructor state setup into focused init helpers to remove duplicate assignments.
  constructor() {
    this.levelIndex = 1;
    this.mapSeed = this._makeSeed();
    this.envId = (Math.random() * ENV_PRESETS.length) | 0;
    this.mapData = generateMap(this.mapSeed, this.envId);
    this.map = new Map(this.mapData);
    this.particles = new Particles();
    this.audio = new AudioSystem();
    this._initCollections();
    this._initRuntimeState();
    this._initCorruptedTiles();
    if (pauseBtn) pauseBtn.textContent = "PAUSE";

    this.audio.loadPref();
    this.applyEnvironment(this.mapData?.env || ENV_PRESETS[this.envId]);
    this._bindUI();
    this._buildList();
    // Always start on landing menu when visiting the site.
    this._initLandingMenu();
    this.updateHUD();
  }

  // CODEX CHANGE: Consolidate array/map collection defaults used across gameplay and VFX.
  _initCollections() {
    this.explosions = [];
    this.floatText = [];
    this.decals = [];
    this._textLimiter = new globalThis.Map();
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];
    this.traps = [];
    this.beams = [];
    this.arcs = [];
    this.cones = [];
    this.lingering = [];
  }

  // CODEX CHANGE: Keep constructor-readable, single-source defaults for run/session/input state.
  _initRuntimeState() {
    this.shakeT = 0;
    this.shakeMag = 0;
    this.damageFlash = 0;
    this.corePulseT = 0;
    this.speed = 1;
    this.zoom = 1;
    this.cam = { x: 0, y: 0 };
    this.dragging = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0 };
    this.camStart = { x: 0, y: 0 };
    this.gold = this._getStartGold();
    this.lives = START_LIVES;
    this.wave = 0;
    this.waveMax = 16;
    this.hasStarted = false;
    this.waveActive = false;
    this.intermission = 0;
    this.skipBuff = { dmgMul: 1, rateMul: 1, t: 0 };
    this.abilities = {
      scan: { cd: ABILITY_COOLDOWN, t: 0 },
      pulse: { cd: ABILITY_COOLDOWN, t: 0 },
      overcharge: { cd: OVERCHARGE_COOLDOWN, t: 0 }
    };
    // CODEX CHANGE: Echo Cascade runtime state (excluded from save/load on purpose).
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboWindow = comboWindowForCount(1);
    this.comboMult = 1;
    this.comboBest = 0;
    this._comboUiFade = 0;
    this.gameOver = false;
    this.gameWon = false;
    this.paused = false;
    this._gameOverPrompted = false;
    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.spawnT = 0;
    this.waveScalar = { hp: 1, spd: 1, armor: 0, shield: 1, regen: 1, reward: 1 };
    this._saveT = 0;
    this.waveAnomaly = null;
    this._warpRippleT = 0;
    this.pendingIntermission = INTERMISSION_SECS;
    this.statsOpen = false;
    this.statsMode = null;
    this.waveStats = this._newWaveStats(0);
    this.runStats = this._newRunStats();
    this.mapStats = [];
    this.playerStats = this._newPlayerStats();
    this.globalOverchargeT = 0;
    this._transitioning = false;
    this.gameState = GAME_STATE.GAMEPLAY;
    this.menuOpen = false;
    this.bossCinematic = null;
    this.buildKey = null;
    this.selectedTurret = null;
    this.selectedEnemy = null;
    this.selectedTileCell = null;
    this.hoverCell = null;
    this.mouse = { x: 0, y: 0 };
    this._id = 1;
    this.collapseEnabled = false;
    this.panelHold = { left: 0, right: 0 };
    this._lastRuntimeErrAt = 0;
    this.panelHover = { left: false, right: false };
  }

  _hideLandingMenu() {
    const menu = document.getElementById("landingMenu");
    if (!menu) return;
    menu.classList.add("hidden");
    menu.setAttribute("aria-hidden", "true");
    this.menuOpen = false;
  }

  _syncLayoutAfterMenuClose() {
    // Rebuild map bounds after HUD values/panel state settle.
    const sync = () => {
      resize();
      this.updateHUD();
      this.onResize();
      this.updateHUD();
    };
    sync();
    setTimeout(sync, 80);
  }

  _applySavedPanelLayout(layout) {
    const applyPanel = (panel, key) => {
      if (!panel) return;
      const pinBtn = document.querySelector(`.pinBtn[data-panel="${key}"]`);
      const pinnedKey = `${key}Pinned`;
      const collapsedKey = `${key}Collapsed`;
      const pinned = !!layout?.[pinnedKey];
      const collapsed = typeof layout?.[collapsedKey] === "boolean"
        ? !!layout[collapsedKey]
        : !pinned;

      panel.classList.toggle("pinned", pinned);
      panel.classList.toggle("collapsed", !pinned && collapsed);
      if (pinBtn) pinBtn.setAttribute("aria-pressed", pinned ? "true" : "false");
    };

    applyPanel(leftPanel, "left");
    applyPanel(rightPanel, "right");
  }

  _initLandingMenu() {
    const menu = document.getElementById("landingMenu");
    if (!menu) return false;
    const commentPage = document.getElementById("landingCommentPage");
    const mainSection = document.getElementById("landingMainSection");
    const playBtn = document.getElementById("landingPlayBtn");
    const loadBtn = document.getElementById("landingLoadBtn");
    const settingsMenuBtn = document.getElementById("landingSettingsBtn");
    const commentBtn = document.getElementById("landingCommentBtn");
    const commentInput = document.getElementById("landingCommentInput");
    const commentSave = document.getElementById("landingCommentSendBtn");
    const commentBack = document.getElementById("landingCommentBackBtn");
    // Set this to your Formspree (or backend) endpoint when ready.
    const COMMENT_ENDPOINT = "";
    const COMMENT_RECIPIENT = "bignbot@gmail.com";

    this.menuOpen = true;
    menu.classList.remove("hidden");
    menu.setAttribute("aria-hidden", "false");

    const hasSave = () => {
      try { return !!localStorage.getItem(SAVE_KEY); } catch (err) { return false; }
    };
    const refreshLoadState = () => {
      if (loadBtn) loadBtn.disabled = !hasSave();
    };
    refreshLoadState();

    const openMenuSection = () => {
      if (commentPage) {
        commentPage.classList.add("hidden");
        commentPage.setAttribute("aria-hidden", "true");
      }
      if (mainSection) {
        mainSection.classList.remove("hidden");
        mainSection.setAttribute("aria-hidden", "false");
      }
    };
    const openCommentSection = () => {
      menu.classList.add("hidden");
      menu.setAttribute("aria-hidden", "true");
      if (commentPage) {
        commentPage.classList.remove("hidden");
        commentPage.setAttribute("aria-hidden", "false");
      }
      if (mainSection) {
        mainSection.classList.add("hidden");
        mainSection.setAttribute("aria-hidden", "true");
      }
      commentInput?.focus();
    };
    openMenuSection();

    playBtn?.addEventListener("click", () => {
      showConfirm("Start New Game", "Start a new game? Your current run progress will be replaced.", () => {
        this.audio.unlock();
        this._hideLandingMenu();
        requestAnimationFrame(() => {
          this._syncLayoutAfterMenuClose();
        });
      });
    });
    loadBtn?.addEventListener("click", () => {
      if (!hasSave()) {
        toast("No saved game found.");
        refreshLoadState();
        return;
      }
      const loaded = this._load();
      if (!loaded) {
        toast("Could not load saved game.");
        refreshLoadState();
        return;
      }
      this.audio.unlock();
      this._hideLandingMenu();
      requestAnimationFrame(() => {
        this._syncLayoutAfterMenuClose();
      });
    });
    settingsMenuBtn?.addEventListener("click", () => {
      settingsModal?.classList.remove("hidden");
      settingsModal?.setAttribute("aria-hidden", "false");
    });
    commentBtn?.addEventListener("click", () => {
      openCommentSection();
    });
    commentSave?.addEventListener("click", async () => {
      const text = (commentInput?.value || "").trim();
      if (!text) {
        toast("Write a comment first.");
        return;
      }
      if (commentSave) commentSave.disabled = true;
      try {
        let sent = false;
        if (COMMENT_ENDPOINT) {
          const res = await fetch(COMMENT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: COMMENT_RECIPIENT,
              message: text,
              source: "bignbot.com landing menu",
              timestamp: new Date().toISOString()
            })
          });
          sent = res.ok;
        }
        if (!sent) {
          const subject = encodeURIComponent("Orbit Echo Comment");
          const body = encodeURIComponent(
            `${text}\n\nSource: bignbot.com landing menu\nTimestamp: ${new Date().toISOString()}`
          );
          window.location.href = `mailto:${COMMENT_RECIPIENT}?subject=${subject}&body=${body}`;
          sent = true;
        }
        commentInput.value = "";
        openMenuSection();
        menu.classList.remove("hidden");
        menu.setAttribute("aria-hidden", "false");
        toast(sent ? "Email draft opened. Send it to submit your comment." : "Comment saved locally.");
      } catch (err) {
        toast("Could not save comment.");
      } finally {
        if (commentSave) commentSave.disabled = false;
      }
    });
    commentBack?.addEventListener("click", () => {
      openMenuSection();
      menu.classList.remove("hidden");
      menu.setAttribute("aria-hidden", "false");
    });
    return true;
  }

  _tileKey(gx, gy) {
    return `${gx},${gy}`;
  }

  _defaultCleanseCost(gx, gy) {
    const level = Math.max(1, this.levelIndex | 0);
    const seed = ((this.mapSeed || 0) ^ (gx * 73856093) ^ (gy * 19349663) ^ (level * 83492791)) >>> 0;
    return 70 + (seed % 60) + (level - 1) * 8;
  }

  _defaultPowerUnlockCost(gx, gy) {
    const level = Math.max(1, this.levelIndex | 0);
    const seed = ((this.mapSeed || 0) ^ (gx * 83492791) ^ (gy * 2971215073) ^ (level * 19349663)) >>> 0;
    return 120 + (seed % 90) + (level - 1) * 10;
  }

  _getTileState(gx, gy, create = false) {
    if (!this.map) return null;
    if (!this.map.tilesByCell || typeof this.map.tilesByCell !== "object") this.map.tilesByCell = {};
    const key = this._tileKey(gx, gy);
    let state = this.map.tilesByCell[key] || null;
    if (!state && create) {
      const idx = gy * this.map.cols + gx;
      const v = this.map.cells?.[idx] ?? 0;
      state = {
        gx,
        gy,
        corrupted: false,
        cleanseCost: this._defaultCleanseCost(gx, gy),
        powerPurchased: v === 3 ? false : true,
        powerUnlockCost: this._defaultPowerUnlockCost(gx, gy)
      };
      this.map.tilesByCell[key] = state;
    }
    return state;
  }

  _isCellCorrupted(gx, gy) {
    return this._getTileState(gx, gy, false)?.corrupted === true;
  }

  _isPowerTileUnlocked(gx, gy) {
    const idx = gy * this.map.cols + gx;
    const v = this.map.cells?.[idx] ?? 0;
    if (v !== 3) return true;
    const state = this._getTileState(gx, gy, true);
    return !!state && state.powerPurchased === true;
  }

  _isTrackAdjacentBuildCell(gx, gy, v) {
    // Corruption is only allowed on normal build tiles, never power tiles.
    if (v !== 1) return false;
    if (!this.map?.segs?.length) return false;
    const x = (gx + 0.5) * this.map.gridSize;
    const y = (gy + 0.5) * this.map.gridSize;
    const d = Math.sqrt(distanceToSegmentsSquared(x, y, this.map.segs));
    const trackEdge = TRACK_RADIUS + TRACK_BLOCK_PAD;
    const maxThreeTilesOut = trackEdge + this.map.gridSize * 3;
    return d > trackEdge && d <= maxThreeTilesOut;
  }

  _initCorruptedTiles(savedTiles = null) {
    if (!this.map) return;
    const savedByKey = new globalThis.Map();
    if (Array.isArray(savedTiles)) {
      for (const t of savedTiles) {
        const gx = Number(t?.gx);
        const gy = Number(t?.gy);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
        savedByKey.set(this._tileKey(gx, gy), t);
      }
    }
    this.map.tilesByCell = {};

    // Always seed states for power tiles so purchase gating works.
    for (const idx of this.map.powerCells || []) {
      const gx = idx % this.map.cols;
      const gy = Math.floor(idx / this.map.cols);
      const key = this._tileKey(gx, gy);
      const saved = savedByKey.get(key);
      this.map.tilesByCell[key] = {
        gx,
        gy,
        corrupted: false,
        cleanseCost: this._defaultCleanseCost(gx, gy),
        powerPurchased: saved?.powerPurchased === true,
        powerUnlockCost: Math.max(1, Number(saved?.powerUnlockCost) || this._defaultPowerUnlockCost(gx, gy))
      };
    }

    if (Array.isArray(savedTiles) && savedTiles.length) {
      for (const t of savedTiles) {
        const gx = Number(t?.gx);
        const gy = Number(t?.gy);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
        const cell = this.map.cellAt((gx + 0.5) * this.map.gridSize, (gy + 0.5) * this.map.gridSize);
        if (cell.v !== 1 && cell.v !== 3) continue;
        const key = this._tileKey(gx, gy);
        const prev = this.map.tilesByCell[key] || {};
        const isTrackCandidate = this._isTrackAdjacentBuildCell(gx, gy, cell.v);
        this.map.tilesByCell[key] = {
          gx,
          gy,
          corrupted: isTrackCandidate && t.corrupted === true,
          cleanseCost: Math.max(1, Number(t.cleanseCost) || this._defaultCleanseCost(gx, gy)),
          powerPurchased: cell.v === 3 ? (t.powerPurchased === true || prev.powerPurchased === true) : true,
          powerUnlockCost: Math.max(1, Number(t.powerUnlockCost) || Number(prev.powerUnlockCost) || this._defaultPowerUnlockCost(gx, gy))
        };
      }
      return;
    }

    const candidates = [];
    for (let gy = 0; gy < this.map.rows; gy++) {
      for (let gx = 0; gx < this.map.cols; gx++) {
        const v = this.map.cells[gy * this.map.cols + gx];
        if (this._isTrackAdjacentBuildCell(gx, gy, v)) candidates.push({ gx, gy });
      }
    }
    if (!candidates.length) return;

    // CODEX CHANGE: Use seeded random spread (not clusters) within 3-track-tile candidates.
    const level = Math.max(1, this.levelIndex | 0);
    // CODEX CHANGE: Increase corruption density while preserving enough open build cells to keep maps beatable.
    const targetBase = clamp(Math.round(candidates.length * 0.44), 28, 110);
    const minClear = clamp(Math.round(candidates.length * 0.36), 14, 80);
    const target = Math.min(targetBase, Math.max(0, candidates.length - minClear));
    const rng = makeRNG(((this.mapSeed || 0) ^ (level * 2654435761)) >>> 0);

    // Fisher-Yates shuffle for deterministic random placement per seed/level.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }
    const selected = [];
    const selectedKeys = new globalThis.Set();
    const keyOf = (c) => this._tileKey(c.gx, c.gy);

    // CODEX CHANGE: Softer spacing creates less-uniform, more natural scatter.
    const nearbyCount = (c) => {
      let n = 0;
      for (const s of selected) {
        if (Math.abs(c.gx - s.gx) <= 1 && Math.abs(c.gy - s.gy) <= 1) n++;
      }
      return n;
    };

    // Pass 1: weighted random acceptance so corruption has pockets and gaps.
    for (const c of candidates) {
      if (selected.length >= target) break;
      const near = nearbyCount(c);
      const acceptP = near <= 0 ? 0.82 : (near === 1 ? 0.48 : 0.22);
      if (rng() > acceptP) continue;
      const key = keyOf(c);
      if (selectedKeys.has(key)) continue;
      selected.push(c);
      selectedKeys.add(key);
    }

    // Pass 2: fill toward target with a lighter spacing bias.
    if (selected.length < target) {
      for (const c of candidates) {
        if (selected.length >= target) break;
        const key = keyOf(c);
        if (selectedKeys.has(key)) continue;
        const near = nearbyCount(c);
        if (near >= 3 && rng() > 0.35) continue;
        selected.push(c);
        selectedKeys.add(key);
      }
    }

    for (const c of selected) {
      const key = this._tileKey(c.gx, c.gy);
      this.map.tilesByCell[key] = {
        gx: c.gx,
        gy: c.gy,
        corrupted: true,
        cleanseCost: this._defaultCleanseCost(c.gx, c.gy)
      };
    }
  }

  _makeSeed() {
    return (Math.random() * 1000000) | 0;
  }

  applyEnvironment(env) {
    const theme = env || ENV_PRESETS[0];
    const root = document.documentElement;
    root.style.setProperty("--bg0", theme.bg0);
    root.style.setProperty("--bg1", theme.bg1);
    root.style.setProperty("--glow1", theme.glow1 || "rgba(98,242,255,0.12)");
    root.style.setProperty("--glow2", theme.glow2 || "rgba(154,108,255,0.12)");
    root.style.setProperty("--accent", theme.accent || "#62F2FF");
    root.style.setProperty("--accent2", theme.accent2 || "#9A6CFF");
  }

  loadGeneratedMap(mapData) {
    if (!mapData) return;
    this.mapData = mapData;
    this.mapSeed = mapData.seed;
    this.envId = mapData.envId;
    this.map.loadGeneratedMap(mapData);
    this.applyEnvironment(mapData.env || ENV_PRESETS[mapData.envId || 0]);
    this._initCorruptedTiles();
  }

  _showLevelOverlay(text) {
    if (!levelOverlay) return;
    if (levelOverlayText) levelOverlayText.textContent = text;
    levelOverlay.classList.add("show");
    levelOverlay.classList.remove("hidden");
    levelOverlay.setAttribute("aria-hidden", "false");
  }

  _hideLevelOverlay() {
    if (!levelOverlay) return;
    levelOverlay.classList.remove("show");
    levelOverlay.setAttribute("aria-hidden", "true");
    setTimeout(() => levelOverlay.classList.add("hidden"), 480);
  }

  advanceLevel() {
    if (this._transitioning) return;
    this._transitioning = true;
    if (this.runStats) {
      this.mapStats = this.mapStats || [];
      const snap = this._snapshotRunStats();
      this.mapStats.push(snap);
      this.playerStats = this.playerStats || this._newPlayerStats();
      this.playerStats.mapsCleared += 1;
    }
    const nextLevel = this.levelIndex + 1;
    const nextSeed = this._makeSeed();
    const nextEnvId = (Math.random() * ENV_PRESETS.length) | 0;
    const nextMap = generateMap(nextSeed, nextEnvId);
    this._showLevelOverlay("LEVEL CLEARED");

    setTimeout(() => {
      this.levelIndex = nextLevel;
      this.loadGeneratedMap(nextMap);
      this._resetRun();
      this._showLevelOverlay(`LEVEL ${this.levelIndex}`);
      this.updateHUD();
      this._save();
    }, 700);

    setTimeout(() => {
      this._hideLevelOverlay();
      this._transitioning = false;
    }, 1800);
  }

  _reportRuntimeError(scope, err) {
    const now = performance.now();
    if (now - this._lastRuntimeErrAt < 1200) return;
    this._lastRuntimeErrAt = now;
    console.error(`[runtime:${scope}]`, err);
  }

  _prepareNextLevelData() {
    const nextLevel = this.levelIndex + 1;
    const nextSeed = this._makeSeed();
    const nextEnvId = (Math.random() * ENV_PRESETS.length) | 0;
    const nextMap = generateMap(nextSeed, nextEnvId);
    return { nextLevel, nextMap };
  }

  _startBossCinematic(enemy) {
    if (!enemy) return;
    if (this.gameState === GAME_STATE.BOSS_CINEMATIC) return;
    this.gameState = GAME_STATE.BOSS_CINEMATIC;
    this.waveActive = false;
    this.intermission = 0;
    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.spawnT = 0;
    this.selectedEnemy = null;
    this.selectedTurret = null;
    this.clearBuildMode();
    this.enemies = [];
    this.projectiles = [];
    this.beams = [];
    this.arcs = [];
    this.cones = [];
    const targetCam = { x: enemy.x - W * 0.5, y: enemy.y - H * 0.5 };
    this.bossCinematic = {
      timer: 0,
      duration: 6,
      phase: "blast",
      x: enemy.x,
      y: enemy.y,
      fxPulse: 0,
      fxRing: 0,
      fxBurst: 0,
      zoom: this.zoom,
      cam: { x: this.cam.x, y: this.cam.y },
      baseZoom: this.zoom,
      baseCam: { x: this.cam.x, y: this.cam.y },
      targetCam,
      fade: 0,
      prepared: false,
      nextLevelData: null,
      finalSfxPlayed: false,
      revealT: 1.6,
      revealDur: 1.6,
      nextLevel: this.levelIndex + 1
    };
    this.toastLockT = 0;
    this.audio.play("explodingboss");
    toast("BOSS CORE COLLAPSE");
  }

  _beginBossCinematicReveal() {
    const c = this.bossCinematic;
    if (!c || c.phase !== "blast") return;
    const prep = c.nextLevelData || this._prepareNextLevelData();
    c.nextLevelData = prep;
    c.phase = "reveal";
    c.nextLevel = prep.nextLevel;

    if (this.runStats) {
      this.mapStats = this.mapStats || [];
      this.mapStats.push(this._snapshotRunStats());
      this.playerStats = this.playerStats || this._newPlayerStats();
      this.playerStats.mapsCleared += 1;
    }

    this.levelIndex = prep.nextLevel;
    this.loadGeneratedMap(prep.nextMap);
    this._resetRun();
    this.gameState = GAME_STATE.BOSS_CINEMATIC;
    this.bossCinematic = c;
    c.phase = "reveal";
    c.revealT = c.revealDur;
    c.fade = 1;
    this.zoom = 1;
    this.cam.x = 0;
    this.cam.y = 0;
    this.explosions = [];
    this.decals = [];
    this.beams = [];
    this.arcs = [];
    this.cones = [];
    this.particles.list = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.damageFlash = 0;
  }

  _finishBossCinematic() {
    const c = this.bossCinematic;
    if (!c) return;
    this.gameState = GAME_STATE.GAMEPLAY;
    this.bossCinematic = null;
    this.updateHUD();
    this._save();
  }

  _updateVisualEffects(dtScaled) {
    const decay = (arr) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].t -= dtScaled;
        if (arr[i].t <= 0) arr.splice(i, 1);
      }
    };
    decay(this.beams);
    decay(this.arcs);
    decay(this.cones);
    decay(this.explosions);
    decay(this.decals);
    this.particles.update(dtScaled);
    for (let i = this.floatText.length - 1; i >= 0; i--) {
      const ft = this.floatText[i];
      ft.t -= dtScaled;
      ft.y -= ft.vy * dtScaled;
      if (ft.t <= 0) this.floatText.splice(i, 1);
    }
  }

  _updateBossCinematic(dt) {
    const c = this.bossCinematic;
    if (!c) return;
    if (c.phase === "blast") {
      c.timer = Math.min(c.duration, c.timer + dt);
      const t = c.timer;
      const s = c.duration / 10; // scale old 10s timing down proportionally
      const tAt = (v) => v * s;

      // Keep explosion SFX active during blast; final sound plays at the end.
      if (t < c.duration - 0.35) this.audio.playLimited("explodingboss", 650);

      c.fxPulse -= dt;
      if (c.fxPulse <= 0) {
        c.fxPulse = t < tAt(4.5) ? 0.06 : 0.1;
        this.particles.spawn(c.x + rand(-10, 10), c.y + rand(-10, 10), t < tAt(5) ? 14 : 10, "boom", "rgba(255,207,91,0.92)");
        this.particles.spawn(c.x, c.y, t < tAt(6.5) ? 10 : 6, "shard", "rgba(255,120,200,0.9)");
      }
      c.fxRing -= dt;
      if (c.fxRing <= 0) {
        c.fxRing = t < tAt(5) ? 0.55 : 0.85;
        this.explosions.push({
          x: c.x, y: c.y,
          r: 18,
          t: 0.58,
          dur: 0.58,
          max: t < tAt(6.5) ? 180 : 220,
          col: "rgba(255,207,91,0.9)",
          boom: false
        });
      }
      c.fxBurst -= dt;
      if (c.fxBurst <= 0) {
        c.fxBurst = t < tAt(4) ? 1.0 : 1.6;
        this.explosions.push({
          x: c.x, y: c.y,
          r: 24,
          t: 0.5,
          dur: 0.5,
          max: t < tAt(6) ? 140 : 170,
          col: "rgba(255,91,125,0.9)",
          boom: true
        });
      }

      const shakeMul = t < tAt(5.5) ? 1 : 0.6;
      this.shakeT = Math.min(0.3, this.shakeT + 0.05 * shakeMul);
      this.shakeMag = Math.min(9, this.shakeMag + 0.55 * shakeMul);

      // Zoom/fade in final segment of the shorter cinematic.
      const zoomPhase = clamp((t - tAt(5)) / Math.max(0.01, tAt(4.2)), 0, 1);
      const zoomEase = easeInOut(zoomPhase);
      c.zoom = lerp(c.baseZoom, clamp(c.baseZoom * 1.4, 1.05, 2.15), zoomEase);
      c.cam.x = lerp(c.baseCam.x, c.targetCam.x, zoomEase);
      c.cam.y = lerp(c.baseCam.y, c.targetCam.y, zoomEase);
      c.fade = clamp((t - tAt(4.5)) / Math.max(0.01, tAt(4.8)), 0, 1) * 0.95;

      if (!c.prepared && t >= tAt(8.1)) {
        c.nextLevelData = this._prepareNextLevelData();
        c.prepared = true;
      }

      this._updateVisualEffects(dt);
      this.updateHUD();
      if (t >= c.duration) {
        if (!c.finalSfxPlayed) {
          c.finalSfxPlayed = true;
          this.audio.play("finalexplosionboss");
        }
        this._beginBossCinematicReveal();
      }
      return;
    }

    // Reveal phase on new map: show level text before map fully appears.
    if (c.phase === "reveal") {
      c.revealT = Math.max(0, c.revealT - dt);
      const k = clamp(c.revealT / Math.max(0.01, c.revealDur), 0, 1);
      c.fade = k;
      this.updateHUD();
      if (c.revealT <= 0) this._finishBossCinematic();
    }
  }

  _bindUI() {
    startBtn.addEventListener("click", () => {
      if (this.gameOver || this.gameWon) return;
      if (this.isPaused()) return;
      this.audio.unlock();
      if (this.statsOpen) return;
      if (!this.hasStarted) {
        this.hasStarted = true;
        this.startWave();
        this.audio.play("wave");
        this._save();
        return;
      }
      if (!this.waveActive && this.intermission > 0) {
        this._applySkipReward(this.intermission);
        this.intermission = 0;
      }
      this.startWave();
      this.audio.play("skip");
      this._save();
    });
    startBtn.addEventListener("pointerenter", (ev) => {
      if (!startBtn || startBtn.disabled) return;
      const msg = this.hasStarted
        ? "Skip for gold bonus and -15s ability cooldowns"
        : "Start wave";
      showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
    });
    startBtn.addEventListener("pointermove", (ev) => {
      if (!startBtn || startBtn.disabled) return;
      const msg = this.hasStarted
        ? "Skip for gold bonus and -15s ability cooldowns"
        : "Start wave";
      showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
    });
    startBtn.addEventListener("pointerleave", () => hideTooltip());

    abilityScanBtn?.addEventListener("click", () => {
      this.audio?.playLimited("abilities_btn", 70);
      this.useAbility("scan");
    });
    abilityPulseBtn?.addEventListener("click", () => {
      this.audio?.playLimited("abilities_btn", 70);
      this.useAbility("pulse");
    });
    abilityOverBtn?.addEventListener("click", () => {
      this.audio?.playLimited("abilities_btn", 70);
      this.useAbility("overcharge");
    });
    const abilityBtns = [abilityScanBtn, abilityPulseBtn, abilityOverBtn].filter(Boolean);
    abilityBtns.forEach((btn) => {
      btn.addEventListener("pointerenter", (ev) => {
        const msg = btn.dataset.tooltip || btn.title;
        if (!msg) return;
        showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
      });
      btn.addEventListener("pointermove", (ev) => {
        const msg = btn.dataset.tooltip || btn.title;
        if (!msg) return;
        showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
      });
      btn.addEventListener("pointerleave", () => hideTooltip());
    });

    pauseBtn?.addEventListener("click", () => this.togglePause());

    musicVol?.addEventListener("input", () => {
      const v = Number(musicVol.value || "0") / 100;
      this.audio.setMusicVolume(v);
    });
    sfxVol?.addEventListener("input", () => {
      const v = Number(sfxVol.value || "0") / 100;
      this.audio.setSfxVolume(v);
    });

    if (musicVol) musicVol.value = String(Math.round(this.audio.bgm.volume * 100));
    if (sfxVol) sfxVol.value = String(Math.round(this.audio.sfxVol * 100));

    resetBtn?.addEventListener("click", () => {
      showConfirm("Reset Game", "Reset the game? This will clear your saved progress.", () => {
        try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
        window.location.reload();
      });
    });
    settingsResetBtn?.addEventListener("click", () => {
      showConfirm("Reset Game", "Reset the game? This will clear your saved progress.", () => {
        try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
        window.location.reload();
      });
    });

    audioBtn?.addEventListener("click", () => this.audio.toggle());

    modalCancel?.addEventListener("click", () => closeConfirm());
    modalConfirm?.addEventListener("click", () => {
      const cb = _modalOnConfirm;
      closeConfirm();
      if (cb) cb();
    });
    confirmModal?.addEventListener("click", (ev) => {
      if (ev.target === confirmModal) closeConfirm();
    });

    helpBtn?.addEventListener("click", () => {
      overlay?.classList.remove("hidden");
      overlay?.setAttribute("aria-hidden", "false");
    });
    closeHelp?.addEventListener("click", () => {
      overlay?.classList.add("hidden");
      overlay?.setAttribute("aria-hidden", "true");
    });

    if (speedBtn) {
      speedBtn.addEventListener("click", () => {
        if (this.isUiBlocked()) return;
        const levels = [1, 2, 3, 4];
        const idx = levels.indexOf(this.speed);
        const next = levels[(idx + 1) % levels.length];
        this.speed = clamp(next, 1, 4);
        speedBtn.textContent = `SPEED: ${this.speed}×`;
      });
      speedBtn.textContent = `SPEED: ${this.speed}×`;
    }

    settingsBtn?.addEventListener("click", () => {
      settingsModal?.classList.remove("hidden");
      settingsModal?.setAttribute("aria-hidden", "false");
    });
    settingsClose?.addEventListener("click", () => {
      settingsModal?.classList.add("hidden");
      settingsModal?.setAttribute("aria-hidden", "true");
    });
    settingsModal?.addEventListener("click", (ev) => {
      if (ev.target === settingsModal) {
        settingsModal.classList.add("hidden");
        settingsModal.setAttribute("aria-hidden", "true");
      }
    });

    document.addEventListener("pointerover", (ev) => {
      const btn = ev.target.closest("button");
      if (btn && !btn.disabled) {
        const from = ev.relatedTarget;
        if (from && (from === btn || btn.contains(from))) return;
        this.audio?.playLimited("hover", 80);
        return;
      }
      const buildItem = ev.target.closest(".buildItem");
      if (!buildItem || buildItem.classList.contains("locked")) return;
      const from = ev.relatedTarget;
      if (from && (from === buildItem || buildItem.contains(from))) return;
      this.audio?.playLimited("hover", 80);
    });
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button");
      if (btn) {
        if (btn.disabled) return;
        if (btn === abilityScanBtn || btn === abilityPulseBtn || btn === abilityOverBtn) return;
        this.audio?.playLimited("click", 80);
        return;
      }
      const buildItem = ev.target.closest(".buildItem");
      if (!buildItem || buildItem.classList.contains("locked")) return;
      this.audio?.playLimited("click", 80);
    });

    waveStatsContinue?.addEventListener("click", () => this._closeWaveStats("continue"));
    waveStatsControls?.addEventListener("click", () => {
      controlsModal?.classList.remove("hidden");
      controlsModal?.setAttribute("aria-hidden", "false");
    });
    waveStatsSkip?.addEventListener("click", () => this._closeWaveStats("skip"));
    waveStatsModal?.addEventListener("click", (ev) => {
      if (ev.target === waveStatsModal) this._closeWaveStats("continue");
    });
    controlsClose?.addEventListener("click", () => {
      controlsModal?.classList.add("hidden");
      controlsModal?.setAttribute("aria-hidden", "true");
    });
    controlsModal?.addEventListener("click", (ev) => {
      if (ev.target === controlsModal) {
        controlsModal.classList.add("hidden");
        controlsModal.setAttribute("aria-hidden", "true");
      }
    });

    sellBtn?.addEventListener("click", () => this.confirmSellSelected());
    turretHudSellBtn?.addEventListener("click", () => this.confirmSellSelected());
    turretHudCloseBtn?.addEventListener("click", () => this.selectTurret(null));

    canvas.addEventListener("mousemove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      if (this.dragging) {
        const dx = sx - this.dragStart.x;
        const dy = sy - this.dragStart.y;
        if (!this.dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
          this.dragMoved = true;
        }
        this.cam.x = this.camStart.x - dx / this.zoom;
        this.cam.y = this.camStart.y - dy / this.zoom;
      }
      const wp = this.screenToWorld(sx, sy);
      this.mouse.x = wp.x;
      this.mouse.y = wp.y;
      this.hoverCell = this.map.cellAt(this.mouse.x, this.mouse.y);
      let hoveredTurret = null;
      for (const t of this.turrets) {
        if (dist2(this.mouse.x, this.mouse.y, t.x, t.y) <= 18 * 18) {
          hoveredTurret = t;
          break;
        }
      }
      if (hoveredTurret) {
        const dps = hoveredTurret.fire > 0 ? (hoveredTurret.dmg / hoveredTurret.fire) : hoveredTurret.dmg * 12;
        const active = [];
        if (hoveredTurret.pulseBoostT > 0) active.push("Pulse Burst");
        if (this.globalOverchargeT > 0) active.push("Overcharge");
        if (hoveredTurret.boosted) active.push("Power Tile");
        const activeTxt = active.length ? ` | Active: ${active.join(", ")}` : "";
        const tip = `${hoveredTurret.name} Lv ${hoveredTurret.level} | DMG ${hoveredTurret.dmg.toFixed(1)} | Fire ${hoveredTurret.fire.toFixed(2)}s | Range ${hoveredTurret.range.toFixed(0)} | DPS ${dps.toFixed(1)}${activeTxt}`;
        showTooltip(tip, ev.clientX + 12, ev.clientY + 12);
      } else if (this.hoverCell && this._isCellCorrupted(this.hoverCell.gx, this.hoverCell.gy)) {
        const state = this._getTileState(this.hoverCell.gx, this.hoverCell.gy, false);
        const cost = Math.max(1, Number(state?.cleanseCost) || this._defaultCleanseCost(this.hoverCell.gx, this.hoverCell.gy));
        showTooltip(`Corrupted Tile: Cleanse for ${cost}g`, ev.clientX + 12, ev.clientY + 12);
      } else if (this.hoverCell && this.hoverCell.v === 3) {
        const state = this._getTileState(this.hoverCell.gx, this.hoverCell.gy, true);
        if (state?.powerPurchased === true) {
          showTooltip("Power Tile: +45% damage, +25% range, +25% fire rate", ev.clientX + 12, ev.clientY + 12);
        } else {
          const cost = Math.max(1, Number(state?.powerUnlockCost) || this._defaultPowerUnlockCost(this.hoverCell.gx, this.hoverCell.gy));
          showTooltip(`Locked Power Tile: Buy for ${cost}g`, ev.clientX + 12, ev.clientY + 12);
        }
      } else {
        hideTooltip();
      }
    });

    canvas.addEventListener("click", (ev) => {
      if (this.dragging || this.dragMoved) return;
      if (this.isUiBlocked()) return;
      if (overlay && !overlay.classList.contains("hidden")) return;
      if (settingsModal && !settingsModal.classList.contains("hidden")) return;
      this.audio.unlock();
      hideTooltip();
      const rect = canvas.getBoundingClientRect();
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const wp = this.screenToWorld(sx, sy);
      const x = wp.x;
      const y = wp.y;
      this.onClick(x, y);
    });
    canvas.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      if (this.isUiBlocked()) return;
      if (overlay && !overlay.classList.contains("hidden")) return;
      if (settingsModal && !settingsModal.classList.contains("hidden")) return;
      if (this.dragging || this.dragMoved) return;
      hideTooltip();
      this.clearBuildMode();
      this.selectTurret(null);
      this.collapseEnabled = true;
    });
    canvas.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0 && ev.button !== 2) return;
      if (this.isUiBlocked()) return;
      const rect = canvas.getBoundingClientRect();
      this.dragging = true;
      this.dragMoved = false;
      this.dragButton = ev.button;
      this.dragStart.x = ev.clientX - rect.left;
      this.dragStart.y = ev.clientY - rect.top;
      this.camStart.x = this.cam.x;
      this.camStart.y = this.cam.y;
    });
    window.addEventListener("mouseup", () => {
      this.dragging = false;
      this.dragMoved = false;
      this.dragButton = null;
    });

    const nudgeAudio = () => {
      this.audio.unlock();
      this.audio.ensureActive(true);
    };
    window.addEventListener("pointerdown", nudgeAudio);
    window.addEventListener("keydown", nudgeAudio);
    window.addEventListener("touchstart", nudgeAudio, { passive: true });
    window.addEventListener("focus", () => this.audio.ensureActive(true));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.audio.ensureActive(true);
    });
    canvas.addEventListener("mouseleave", () => hideTooltip());

    canvas.addEventListener("wheel", (ev) => {
      if (this.isUiBlocked()) return;
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      const next = this.zoom + (delta > 0 ? -0.1 : 0.1);
      this.zoom = clamp(next, 0.75, 1.5);
    }, { passive: false });

    document.querySelectorAll(".panelBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const panelKey = btn.dataset.panel;
        const action = btn.dataset.action;
        const panel = panelKey === "left" ? leftPanel : rightPanel;
        if (!panel) return;
        if (action === "pin") {
          const pinned = panel.classList.toggle("pinned");
          btn.setAttribute("aria-pressed", pinned ? "true" : "false");
          if (pinned) {
            panel.classList.remove("collapsed");
          } else {
            // when unpinned, collapse if not in use
            if (panelKey === "left") panel.classList.toggle("collapsed", !this.buildKey);
            if (panelKey === "right") panel.classList.toggle("collapsed", !this.selectedTurret);
          }
        }
      });
    });
    // sync pin button state on load
    document.querySelectorAll(".pinBtn").forEach(btn => {
      const panelKey = btn.dataset.panel;
      const panel = panelKey === "left" ? leftPanel : rightPanel;
      if (!panel) return;
      btn.setAttribute("aria-pressed", panel.classList.contains("pinned") ? "true" : "false");
    });

    const holdPanel = (key, seconds = 1.2) => {
      if (!this.panelHold) return;
      this.panelHold[key] = Math.max(this.panelHold[key] || 0, seconds);
    };
    const collapseIfIdle = (panel, key, inUse) => {
      if (!panel || panel.classList.contains("pinned")) return;
      if (this.panelHover?.[key]) return;
      if (this.panelHold[key] > 0) return;
      panel.classList.toggle("collapsed", !inUse);
    };
    const bindPanelHover = (panel, key) => {
      if (!panel) return;
      panel.addEventListener("mouseenter", () => {
        if (this.panelHover) this.panelHover[key] = true;
        holdPanel(key, 1.5);
        if (!panel.classList.contains("pinned")) panel.classList.remove("collapsed");
      });
      panel.addEventListener("mouseleave", () => {
        if (this.panelHover) this.panelHover[key] = false;
        holdPanel(key, 0.2);
        setTimeout(() => {
          const inUse = key === "left" ? !!this.buildKey : !!this.selectedTurret;
          collapseIfIdle(panel, key, inUse);
        }, 220);
      });
      panel.addEventListener("wheel", () => holdPanel(key, 1.5), { passive: true });
      panel.addEventListener("pointerdown", () => holdPanel(key, 1.5));
    };
    bindPanelHover(leftPanel, "left");
    bindPanelHover(rightPanel, "right");

    // First load tooltip
    if (!localStorage.getItem("orbit_echo_tip_v1")) {
      toast("Tip: Place a turret, then press START. Pin panels to keep them open.");
      localStorage.setItem("orbit_echo_tip_v1", "1");
    }

    window.addEventListener("keydown", (ev) => {
      if (_modalOpen && ev.key === "Escape") {
        closeConfirm();
        return;
      }
      if (this.gameOver || this.gameWon) return;
      if (this.statsOpen) {
        if (this.statsMode === "pause") {
          if (ev.key === "Enter" || ev.key === " " || ev.key === "Escape") {
            this._closeWaveStats("pause");
          }
        } else {
          if (ev.key === "Enter" || ev.key === " ") this._closeWaveStats("continue");
          if (ev.key.toLowerCase() === "s") this._closeWaveStats("skip");
          if (ev.key === "Escape") this._closeWaveStats("continue");
        }
        return;
      }
      if (this.isPaused()) return;
      if (ev.repeat) return;
      if (ev.key === "Escape" && this.buildKey) {
        this.clearBuildMode();
        return;
      }
      if (ev.key === "1") this.useAbility("scan");
      if (ev.key === "2") this.useAbility("pulse");
      if (ev.key === "3") this.useAbility("overcharge");
    });
  }

  isUiBlocked() {
    const overlayOpen = overlay && !overlay.classList.contains("hidden");
    const settingsOpen = settingsModal && !settingsModal.classList.contains("hidden");
    return this.menuOpen || overlayOpen || settingsOpen || this.statsOpen || this._transitioning || this.gameState !== GAME_STATE.GAMEPLAY;
  }

  isPaused() {
    return this.paused || this.isUiBlocked();
  }

  screenToWorld(x, y) {
    const zx = (x - W * 0.5) / this.zoom + W * 0.5 + this.cam.x;
    const zy = (y - H * 0.5) / this.zoom + H * 0.5 + this.cam.y;
    return { x: zx, y: zy };
  }

  worldToScreen(x, y) {
    return {
      x: (x - W * 0.5 - this.cam.x) * this.zoom + W * 0.5,
      y: (y - H * 0.5 - this.cam.y) * this.zoom + H * 0.5
    };
  }

  _updateTurretHudPosition() {
    if (!turretHud || turretHud.classList.contains("hidden")) return;
    let world = null;
    if (this.selectedTurret) {
      world = { x: this.selectedTurret.x, y: this.selectedTurret.y };
    } else if (this.selectedTileCell) {
      world = this.map.worldFromCell(this.selectedTileCell.gx, this.selectedTileCell.gy);
    }
    if (!world) return;

    const s = this.worldToScreen(world.x, world.y);
    const rect = turretHud.getBoundingClientRect();
    const wrapRect = turretHud.offsetParent?.getBoundingClientRect();
    const vw = wrapRect ? wrapRect.width : W;
    const vh = wrapRect ? wrapRect.height : H;
    const margin = 10;
    const px = clamp(s.x - rect.width * 0.5, margin, vw - rect.width - margin);
    const py = clamp(s.y - rect.height - 34, margin, vh - rect.height - margin);
    turretHud.style.left = `${px}px`;
    turretHud.style.top = `${py}px`;
  }

  _canSkipIntermission() {
    return this.hasStarted && !this.waveActive && this.intermission > 0 && !this.isPaused();
  }

  _newWaveStats(wave) {
    return { wave, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, dmgByType: {} };
  }

  _newRunStats() {
    return { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, dmgByType: {} };
  }

  _newPlayerStats() {
    return { mapsCleared: 0, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0 };
  }

  _getStartGold() {
    return START_GOLD + Math.max(0, this.levelIndex - 1) * START_GOLD_PER_LEVEL;
  }

  _snapshotRunStats() {
    const src = this.runStats || this._newRunStats();
    return {
      level: this.levelIndex,
      wave: this.wave,
      kills: src.kills,
      leaks: src.leaks,
      gold: src.gold,
      towersBuilt: src.towersBuilt,
      bosses: src.bosses,
      dmgByType: { ...src.dmgByType }
    };
  }

  _resetWaveStats() {
    this.waveStats = this._newWaveStats(this.wave);
  }

  _reconcilePlayerStats() {
    this.playerStats = this.playerStats || this._newPlayerStats();
    const history = this.mapStats || [];
    if (!history.length) return;
    const totals = history.reduce((acc, h) => {
      acc.kills += h.kills || 0;
      acc.leaks += h.leaks || 0;
      acc.gold += h.gold || 0;
      acc.towersBuilt += h.towersBuilt || 0;
      acc.bosses += h.bosses || 0;
      return acc;
    }, { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0 });
    this.playerStats.mapsCleared = Math.max(this.playerStats.mapsCleared || 0, history.length);
    this.playerStats.kills = Math.max(this.playerStats.kills || 0, totals.kills);
    this.playerStats.leaks = Math.max(this.playerStats.leaks || 0, totals.leaks);
    this.playerStats.gold = Math.max(this.playerStats.gold || 0, totals.gold);
    this.playerStats.towersBuilt = Math.max(this.playerStats.towersBuilt || 0, totals.towersBuilt);
    this.playerStats.bosses = Math.max(this.playerStats.bosses || 0, totals.bosses);
  }

  recordDamage(sourceKey, amount) {
    if (!sourceKey || !this.waveStats || !this.waveStats.dmgByType) return;
    const key = String(sourceKey);
    this.waveStats.dmgByType[key] = (this.waveStats.dmgByType[key] || 0) + amount;
    if (this.runStats && this.runStats.dmgByType) {
      this.runStats.dmgByType[key] = (this.runStats.dmgByType[key] || 0) + amount;
    }
  }

  getUnlockWave(key) {
    return TOWER_UNLOCKS[key] || 1;
  }

  isTowerUnlocked(key) {
    const wave = Math.max(1, this.wave || 1);
    return wave >= this.getUnlockWave(key);
  }

  setBuildMode(key) {
    this.buildKey = key;
    this.collapseEnabled = true;
    [...buildList.querySelectorAll(".buildItem")].forEach(el => el.classList.remove("selected"));
    const item = buildList.querySelector(`.buildItem[data-key="${key}"]`);
    if (item) item.classList.add("selected");
  }

  clearBuildMode() {
    this.buildKey = null;
    [...buildList.querySelectorAll(".buildItem")].forEach(el => el.classList.remove("selected"));
  }

  _refreshBuildList() {
    if (!buildList) return;
    buildList.querySelectorAll(".buildItem").forEach(item => {
      const key = item.dataset.key;
      const unlockWave = Number(item.dataset.unlock || "1");
      const unlocked = this.isTowerUnlocked(key);
      const cost = TURRET_TYPES[key]?.cost || 0;
      const affordable = this.gold >= cost;
      item.classList.toggle("locked", !unlocked);
      item.classList.toggle("poor", unlocked && !affordable);
      const lockTag = item.querySelector(".lockTag");
      if (lockTag) {
        lockTag.textContent = `Unlocks at Wave ${unlockWave}`;
        lockTag.style.display = unlocked ? "none" : "block";
      }
    });
  }

  _openWaveStats(mode = "pause") {
    if (this.statsOpen) return;
    this.statsOpen = true;
    this.statsMode = mode;
    if (mode === "wave") {
      this.pendingIntermission = INTERMISSION_SECS;
    }

    this._reconcilePlayerStats();
    const stats = mode === "pause"
      ? (this.runStats || this._newRunStats())
      : (this.waveStats || this._newWaveStats(this.wave));
    const waveLabel = mode === "pause" ? this.wave : stats.wave;
    const history = (this.mapStats || []).slice().reverse();
    const historyLines = history.length
      ? history.map(h => `<div class="tiny">Level ${h.level}: K ${h.kills} · L ${h.leaks} · G ${fmt(h.gold)} · B ${h.bosses}</div>`).join("")
      : `<div class="tiny">No completed maps yet.</div>`;
    const p = this.playerStats || this._newPlayerStats();
    const playerLines = [
      `<div class="tiny">Maps Cleared: ${p.mapsCleared}</div>`,
      `<div class="tiny">Total Kills: ${p.kills}</div>`,
      `<div class="tiny">Total Leaks: ${p.leaks}</div>`,
      `<div class="tiny">Total Gold: ${fmt(p.gold)}</div>`,
      `<div class="tiny">Towers Built: ${p.towersBuilt}</div>`,
      `<div class="tiny">Bosses Defeated: ${p.bosses}</div>`
    ].join("");
    const dmgEntries = Object.entries(stats.dmgByType || {})
      .map(([k, v]) => ({ k, v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 6);
    const dmgLines = dmgEntries.length
      ? dmgEntries.map(d => `<div class="tiny">${d.k}: ${fmt(d.v)}</div>`).join("")
      : `<div class="tiny">No damage data.</div>`;

    const banner = mode === "pause" ? `<div class="pauseBanner">Pause</div>` : "";
    if (waveStatsBody) {
      waveStatsBody.innerHTML = `
        ${banner}
        <div class="statsGrid">
          <div class="statsRow"><div class="k">Wave</div><div class="v">${waveLabel}</div></div>
          <div class="statsRow"><div class="k">Level</div><div class="v">${this.levelIndex}</div></div>
          <div class="statsRow"><div class="k">Kills</div><div class="v">${stats.kills}</div></div>
          <div class="statsRow"><div class="k">Bosses Defeated</div><div class="v">${stats.bosses || 0}</div></div>
          <div class="statsRow"><div class="k">Leaks</div><div class="v">${stats.leaks}</div></div>
          <div class="statsRow"><div class="k">Gold Earned</div><div class="v">${fmt(stats.gold)}</div></div>
          <div class="statsRow"><div class="k">Towers Built</div><div class="v">${stats.towersBuilt}</div></div>
        </div>
        <div class="statsRow">
          <div class="k">Damage By Tower</div>
          <div class="v">${dmgLines}</div>
        </div>
        ${mode === "pause" ? `
        <div class="statsRow">
          <div class="k">Map History</div>
          <div class="v">${historyLines}</div>
        </div>
        <div class="statsRow">
          <div class="k">Player Stats</div>
          <div class="v">${playerLines}</div>
        </div>
        ` : ""}
      `;
    }
    if (waveStatsTitle) {
      waveStatsTitle.textContent = mode === "pause" ? "Game Stats" : "Wave Report";
    }
    if (waveStatsContinue) {
      waveStatsContinue.textContent = mode === "pause" ? "Resume" : "Continue";
    }
    if (waveStatsControls) {
      waveStatsControls.style.display = mode === "pause" ? "" : "none";
    }
    if (waveStatsSkip) {
      waveStatsSkip.style.display = mode === "pause" ? "none" : "";
    }
    waveStatsModal?.classList.remove("hidden");
    waveStatsModal?.setAttribute("aria-hidden", "false");
  }

  _closeWaveStats(mode) {
    if (!this.statsOpen) return;
    const statsMode = this.statsMode || mode;
    this.statsOpen = false;
    this.statsMode = null;
    waveStatsModal?.classList.add("hidden");
    waveStatsModal?.setAttribute("aria-hidden", "true");

    if (statsMode === "pause") {
      if (this.paused) {
        this.paused = false;
        if (pauseBtn) pauseBtn.textContent = "PAUSE";
        if (this.audio?.enabled) this.audio.bgm?.play().catch(() => {});
      }
      this.updateHUD();
      return;
    }

    if (mode === "skip") {
      this._applySkipReward(this.pendingIntermission);
      this.intermission = 0;
      this.startWave();
      this.audio.play("skip");
    } else {
      this.intermission = this.pendingIntermission;
    }
  }

  togglePause() {
    if (this.gameOver || this.gameWon) return;
    if (this.gameState !== GAME_STATE.GAMEPLAY) return;
    if (this.statsOpen && this.statsMode === "pause") {
      this._closeWaveStats("pause");
      return;
    }
    if (this.statsOpen) return;
    this.paused = !this.paused;
    if (pauseBtn) pauseBtn.textContent = this.paused ? "RESUME" : "PAUSE";
    if (this.paused) {
      if (this.audio?.bgm) this.audio.bgm.pause();
      this._openWaveStats("pause");
    } else {
      if (this.audio?.enabled) this.audio.bgm?.play().catch(() => {});
    }
    this.updateHUD();
  }

  _buildList() {
    buildList.innerHTML = "";
    for (const [key, t] of Object.entries(TURRET_TYPES)) {
      const item = document.createElement("div");
      item.className = "buildItem";
      item.dataset.key = key;
      item.dataset.unlock = String(this.getUnlockWave(key));
      item.innerHTML = `
        <div class="buildIcon" data-icon="${key}"></div>
        <div class="buildMeta">
          <div class="buildName">${t.name}</div>
          <div class="buildDesc">${t.desc}</div>
          <div class="buildCost">
            <span class="tag">${t.role}</span>
            <span>${t.cost}g</span>
          </div>
          <div class="lockTag">Unlocks at Wave ${this.getUnlockWave(key)}</div>
        </div>
      `;
      item.title = `${t.name} — ${t.cost}g`;
      item.addEventListener("click", () => {
        if (this.isPaused()) {
          toast("Cannot build while paused.");
          return;
        }
        if (!this.isTowerUnlocked(key)) return;
        if (this.gold < t.cost) {
          toast("Not enough gold.");
          return;
        }
        this.audio.unlock();
        this.setBuildMode(key);
        if (leftPanel && !leftPanel.classList.contains("pinned")) {
          this.panelHold.left = Math.max(this.panelHold.left || 0, 0.2);
          leftPanel.classList.add("collapsed");
        }
      });
      buildList.appendChild(item);
    }
    this._refreshBuildList();
  }

  updateHUD() {
    goldEl.textContent = fmt(this.gold);
    if (goldEl) {
      goldEl.style.color = this.gold < 45 ? "var(--bad)" : "var(--good)";
    }
    if (turretHudBody) {
      turretHudBody.querySelectorAll("button[data-mod]").forEach(btn => {
        let cost = Number(btn.dataset.cost || "0");
        if (!cost) {
          const costText = btn.closest(".modChoice")?.querySelector(".modCost")?.textContent || "";
          cost = Number(costText.replace(/[^\d.]/g, "")) || 0;
          if (cost) btn.dataset.cost = String(cost);
        }
        const affordable = this.gold >= cost;
        btn.disabled = !affordable;
        btn.classList.toggle("primary", affordable);
        const card = btn.closest(".modChoice");
        if (card) card.classList.toggle("poor", !affordable);
      });
    }
    this._refreshBuildList();
    livesEl.textContent = String(this.lives);
    if (livesEl) {
      let col;
      if (this.lives <= LIFE_RED_MAX) {
        col = LIFE_COLORS.red;
      } else if (this.lives <= LIFE_YELLOW_MAX) {
        col = LIFE_COLORS.yellow;
      } else {
        col = LIFE_COLORS.green;
      }
      livesEl.style.color = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
    }
    waveEl.textContent = String(this.wave);
    waveMaxEl.textContent = String(this.waveMax);
    if (levelValEl) levelValEl.textContent = String(this.levelIndex);
    if (envValEl) envValEl.textContent = this.map?.env?.name || "—";
    if (seedValEl) seedValEl.textContent = this.mapSeed != null ? String(this.mapSeed) : "—";

    // auto-collapse panels unless pinned (after first interaction)
    if (this.collapseEnabled) {
      // Keep panels open briefly while interacting to reduce jank.
      if (leftPanel && !leftPanel.classList.contains("pinned")) {
        if (this.panelHold.left <= 0 && !this.panelHover?.left) {
          leftPanel.classList.toggle("collapsed", !this.buildKey);
        }
      }
      if (rightPanel && !rightPanel.classList.contains("pinned")) {
        if (this.panelHold.right <= 0 && !this.panelHover?.right) {
          rightPanel.classList.toggle("collapsed", !this.selectedTurret);
        }
      }
    }

    if (this.gameWon) {
      nextInEl.textContent = "Victory";
    } else if (this.gameOver) {
      nextInEl.textContent = "Defeat";
    } else if (!this.hasStarted) {
      nextInEl.textContent = "Start";
    } else if (this.waveActive) {
      nextInEl.textContent = "In Wave";
    } else if (this.intermission > 0) {
      nextInEl.textContent = `${this.intermission.toFixed(1)}s`;
    } else {
      nextInEl.textContent = "—";
    }

    const nextPill = nextInEl?.closest(".pill");
    if (nextPill) nextPill.classList.toggle("intermissionPulse", this.intermission > 0 && !this.waveActive);

    // CODEX CHANGE: Echo Cascade HUD update (reuses single DOM nodes, no DOM churn).
    if (comboCascadeEl && comboCascadeCountEl) {
      const comboActive = this.comboCount > 0;
      const comboShow = comboActive;
      const comboOpacity = comboActive ? 1 : 0;
      comboCascadeEl.classList.toggle("active", comboShow);
      comboCascadeEl.classList.toggle("tier10", this.comboCount >= 10);
      comboCascadeEl.classList.toggle("tier15", this.comboCount >= 15);
      comboCascadeEl.style.opacity = comboShow ? String(clamp(comboOpacity, 0, 1)) : "0";
      comboCascadeCountEl.textContent = comboActive ? `x${this.comboCount | 0}` : "";
    }
    if (screenFxEl) {
      screenFxEl.classList.toggle("comboTier10", this.comboCount >= 10);
      screenFxEl.classList.toggle("comboTier15", this.comboCount >= 15);
    }

    const controlsLocked = this.gameState !== GAME_STATE.GAMEPLAY;
    startBtn.disabled = this.menuOpen || this.gameOver || this.gameWon || this.statsOpen || this._transitioning || controlsLocked;
    startBtn.textContent = this.hasStarted ? "SKIP" : "START";

    if (this.abilities && abilityScanCd) {
      const scan = this.abilities.scan;
      const pulse = this.abilities.pulse;
      const over = this.abilities.overcharge;
      if (abilityScanBtn) {
        abilityScanBtn.dataset.tooltip = "EMP Pulse: Instantly destroys all enemy shields.";
        abilityScanBtn.removeAttribute("title");
      }
      if (abilityPulseBtn) {
        abilityPulseBtn.dataset.tooltip = "Pulse Burst: Select a turret to double damage and 4x fire rate for 30s. No selection = red flash.";
        abilityPulseBtn.removeAttribute("title");
      }
      if (abilityOverBtn) {
        abilityOverBtn.dataset.tooltip = "Overcharge: Boost all turret fire rates for 30s. 90s cooldown.";
        abilityOverBtn.removeAttribute("title");
      }
      const scanPct = scan.t > 0 ? clamp(scan.t / scan.cd, 0, 1) : 0;
      const pulsePct = pulse.t > 0 ? clamp(pulse.t / pulse.cd, 0, 1) : 0;
      const overPct = over.t > 0 ? clamp(over.t / over.cd, 0, 1) : 0;
      if (abilityScanBtn) {
        abilityScanBtn.style.setProperty("--cd-pct", scanPct.toFixed(3));
        abilityScanBtn.classList.toggle("ready", scan.t <= 0);
      }
      if (abilityPulseBtn) {
        abilityPulseBtn.style.setProperty("--cd-pct", pulsePct.toFixed(3));
        abilityPulseBtn.classList.toggle("ready", pulse.t <= 0);
      }
      if (abilityOverBtn) {
        abilityOverBtn.style.setProperty("--cd-pct", overPct.toFixed(3));
        abilityOverBtn.classList.toggle("ready", over.t <= 0);
      }
      abilityScanCd.textContent = scan.t > 0 ? `${scan.t.toFixed(1)}s` : "Ready";
      abilityPulseCd.textContent = pulse.t > 0 ? `${pulse.t.toFixed(1)}s` : "Ready";
      abilityOverCd.textContent = over.t > 0 ? `${over.t.toFixed(1)}s` : "Ready";
      abilityScanBtn.disabled = scan.t > 0 || controlsLocked;
      abilityPulseBtn.disabled = pulse.t > 0 || controlsLocked;
      abilityOverBtn.disabled = over.t > 0 || controlsLocked;
    }

    if (anomalyLabel) {
      if (this.waveAnomaly) {
        anomalyLabel.textContent = this.waveAnomaly.name;
        anomalyPill?.setAttribute("title", this.waveAnomaly.desc);
        anomalyPill?.classList.add("active");
      } else {
        anomalyLabel.textContent = "—";
        anomalyPill?.setAttribute("title", "Wave anomaly");
        anomalyPill?.classList.remove("active");
      }
    }

    if (turretStateBar) turretStateBar.classList.add("hidden");
    this._updateTurretHudPosition();
  }

  getSkipBuff() {
    if (!this.skipBuff || this.skipBuff.t <= 0) {
      return { dmgMul: 1, rateMul: 1, t: 0 };
    }
    return this.skipBuff;
  }

  getAbilityState(key) {
    return this.abilities ? this.abilities[key] : null;
  }

  spawnText(x, y, text, color = "rgba(234,240,255,0.9)", ttl = 0.9) {
    try {
      if (!text) return;
      if (!(this._textLimiter instanceof globalThis.Map)) this._textLimiter = new globalThis.Map();
      if (!Array.isArray(this.floatText)) this.floatText = [];
      const now = performance.now() * 0.001;
      const isDamage = /^-\d+/.test(String(text));
      const gx = Math.floor(x / 42);
      const gy = Math.floor(y / 34);

      // Hard cap to avoid unreadable walls of text.
      if (this.floatText.length > (isDamage ? 85 : 100)) {
        if (isDamage) return;
        this.floatText.splice(0, Math.max(1, this.floatText.length - 90));
      }

      if (isDamage) {
        const cellKey = `d:${gx}:${gy}`;
        const last = this._textLimiter.get(cellKey) || 0;
        const incoming = Number(String(text).slice(1)) || 0;
        // If same area was just hit, merge into nearby existing damage text.
        if (now - last < 0.14) {
          let merged = false;
          for (let i = this.floatText.length - 1; i >= 0; i--) {
            const ft = this.floatText[i];
            if (!ft._damage) continue;
            if (ft.t <= 0) continue;
            if (dist2(ft.x, ft.y, x, y) > 24 * 24) continue;
            ft._sum = (ft._sum || (Number(String(ft.text).slice(1)) || 0)) + incoming;
            ft.text = `-${Math.max(1, Math.floor(ft._sum))}`;
            ft.t = Math.max(ft.t, 0.42);
            ft.ttl = Math.max(ft.ttl, 0.42);
            merged = true;
            break;
          }
          if (merged) return;
        }
        this._textLimiter.set(cellKey, now);
      } else {
        const statusText = /^(SLOWED|MARKED|STUN|BURN|REVEALED|SHIELD BREAK|MINIBOSS)$/i.test(String(text));
        if (statusText) {
          const key = `s:${text}:${gx}:${gy}`;
          const last = this._textLimiter.get(key) || 0;
          if (now - last < 0.9) return;
          this._textLimiter.set(key, now);
        }
      }

      this.floatText.push({
        x,
        y,
        text,
        color,
        t: ttl,
        ttl,
        vy: 18,
        _damage: isDamage,
        _sum: isDamage ? (Number(String(text).slice(1)) || 0) : 0
      });

      // prune stale limiter entries (lazy)
      if ((this._textLimiterTick = (this._textLimiterTick || 0) + 1) % 80 === 0 && (this._textLimiter instanceof globalThis.Map)) {
        for (const [k, ts] of this._textLimiter.entries()) {
          if (now - ts > 2.2) this._textLimiter.delete(k);
        }
      }
    } catch (err) {
      this._reportRuntimeError("spawnText", err);
      if (!Array.isArray(this.floatText)) this.floatText = [];
      this.floatText.push({
        x,
        y,
        text: String(text),
        color,
        t: ttl,
        ttl,
        vy: 18,
        _damage: false,
        _sum: 0
      });
    }
  }

  useAbility(key) {
    if (this.isUiBlocked()) return;
    const ability = this.getAbilityState(key);
    if (!ability) return;
    if (ability.t > 0) {
      toast("Ability cooling down.");
      return;
    }
    if (key === "pulse") {
      if (!this.selectedTurret) {
        flashAbilityButton(abilityPulseBtn);
        toast("Select a turret for Pulse Burst.");
        return;
      }
      if (this.globalOverchargeT > 0) {
        toast("Overcharge already active.");
        return;
      }
      if (this.selectedTurret.pulseBoostT > 0) {
        toast("Pulse Burst already active.");
        return;
      }
    }
    if (key === "overcharge") {
      if (this.globalOverchargeT > 0) {
        toast("Overcharge already active.");
        return;
      }
    }

    switch (key) {
      case "scan": {
        ability.t = ability.cd;
        let found = 0;
        let shields = 0;
        for (const e of this.enemies) {
          if (!e || e._dead) continue;
          if (this._clearEnemyShield(e)) {
            shields++;
            this.particles.spawn(e.x, e.y, 6, "shard", "rgba(154,108,255,0.9)");
            this.explosions.push({
              x: e.x,
              y: e.y,
              r: 12,
              t: 0.28,
              dur: 0.28,
              max: 52,
              col: "rgba(154,108,255,0.9)",
              boom: false
            });
          }
          found++;
        }
        this.explosions.push({
          x: W * 0.5,
          y: H * 0.5,
          r: 24,
          t: 0.32,
          dur: 0.32,
          max: Math.max(W, H) * 0.35,
          col: "rgba(154,108,255,0.65)",
          boom: false
        });
        this.audio.playLimited("beam", 220);
        if (found === 0) {
          toast("EMP PULSE: no enemies found");
        } else if (shields === 0) {
          toast("EMP PULSE: no shields detected");
        } else {
          toast(`EMP PULSE: ${shields} shields destroyed`);
        }
        break;
      }
      case "pulse": {
        ability.t = ability.cd;
        this.selectedTurret.pulseBoostT = 30;
        this.explosions.push({
          x: this.selectedTurret.x,
          y: this.selectedTurret.y,
          r: 12,
          t: 0.25,
          dur: 0.25,
          max: 60,
          col: "rgba(154,108,255,0.85)",
          boom: false
        });
        this.particles.spawn(this.selectedTurret.x, this.selectedTurret.y, 10, "muzzle");
        this.audio.playLimited("upgrade", 220);
        toast("PULSE BURST: turret damage x2 and fire rate x4 for 30s");
        break;
      }
      case "overcharge": {
        ability.t = ability.cd;
        this.globalOverchargeT = 30;
        this.explosions.push({
          x: W * 0.5,
          y: H * 0.5,
          r: 22,
          t: 0.3,
          dur: 0.3,
          max: Math.max(W, H) * 0.25,
          col: "rgba(255,207,91,0.8)",
          boom: false
        });
        this.particles.spawn(W * 0.5, H * 0.5, 16, "muzzle");
        this.audio.playLimited("upgrade", 220);
        toast("OVERCHARGE: all turrets fire faster for 30s");
        break;
      }
    }
    this.updateHUD();
  }

  // CODEX CHANGE: EMP should clear shields on every active enemy object currently in play.
  _clearEnemyShield(enemy) {
    if (!enemy || enemy._dead) return false;
    const shieldRaw = Number(enemy.shield);
    const hadShield = Number.isFinite(shieldRaw) && shieldRaw > 0;
    enemy.shield = 0;
    return hadShield;
  }

  _calcSkipReward(remaining) {
    const ratio = clamp(remaining / 15, 0, 1);
    const rateBonus = lerp(0.05, 0.25, ratio);
    const dmgBonus = lerp(0.05, 0.25, ratio);
    const duration = 8;
    const cash = Math.max(1, Math.floor(remaining * 0.9));
    return { rateBonus, dmgBonus, duration, cash };
  }

  _applySkipReward(remaining) {
    if (remaining <= 0) return;
    const reward = this._calcSkipReward(remaining);
    const cap = 1.25;
    const targetRate = Math.min(cap, 1 + reward.rateBonus);
    const targetDmg = Math.min(cap, 1 + reward.dmgBonus);
    this.skipBuff.rateMul = Math.min(cap, Math.max(this.skipBuff.rateMul, targetRate));
    this.skipBuff.dmgMul = Math.min(cap, Math.max(this.skipBuff.dmgMul, targetDmg));
    this.skipBuff.t = reward.duration;

    this.gold += reward.cash;
    this.gold += SKIP_GOLD_BONUS;
    if (this.waveStats) this.waveStats.gold += reward.cash + SKIP_GOLD_BONUS;
    if (this.runStats) this.runStats.gold += reward.cash + SKIP_GOLD_BONUS;
    if (this.playerStats) this.playerStats.gold += reward.cash + SKIP_GOLD_BONUS;
    if (this.abilities) {
      for (const a of Object.values(this.abilities)) {
        if (a.t > 0) a.t = Math.max(0, a.t - SKIP_COOLDOWN_REDUCE);
      }
    }

    const ratePct = Math.round((this.skipBuff.rateMul - 1) * 100);
    const dmgPct = Math.round((this.skipBuff.dmgMul - 1) * 100);
    toast(`SKIP BONUS: +${ratePct}% rate, +${dmgPct}% dmg for ${reward.duration}s`);
    setTimeout(() => toast(`SKIP CASHOUT: +${reward.cash + SKIP_GOLD_BONUS} gold`), 700);
  }

  onResize() {
    this.map.onResize();
    for (const t of this.turrets) {
      if (t.gx != null) {
        const w = this.map.worldFromCell(t.gx, t.gy);
        t.x = w.x; t.y = w.y;
      }
    }
    this._updateTurretHudPosition();
  }

  _waveScalar(wave) {
    const i = wave - 1;
    const earlyHp = wave === 1 ? 0.82 : wave === 2 ? 0.92 : 1;
    const earlySpd = wave === 1 ? 0.9 : wave === 2 ? 0.96 : 1;
    const late = Math.max(0, wave - 8);
    const latePow = Math.pow(late, 1.12) * 0.016;
    const post2 = Math.max(0, wave - 2);
    const post2Boost = 1 + post2 * 0.035;
    const levelHp = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_HP_SCALE;
    const levelSpd = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_SPD_SCALE;
    const levelDef = 1 + Math.max(0, this.levelIndex - 1) * 0.02;
    const levelReward = 1 + Math.max(0, this.levelIndex - 1) * 0.03;
    return {
      hp: (1 + i * 0.105 + latePow) * earlyHp * 1.35 * post2Boost * levelHp,
      spd: (1 + i * 0.013) * earlySpd * 1.05 * (1 + post2 * 0.01) * levelSpd,
      armor: (i * 0.0048 + Math.max(0, wave - 12) * 0.0035) * 1.15 * (1 + post2 * 0.012) * levelDef,
      shield: (1 + i * 0.055 + Math.max(0, wave - 12) * 0.015) * 1.08 * (1 + post2 * 0.012) * levelDef,
      regen: (1 + i * 0.035 + Math.max(0, wave - 12) * 0.015) * 1.08 * (1 + post2 * 0.008) * levelDef,
      reward: (1 + i * 0.05) * 1.15 * levelReward
    };
  }

  _sanitizeWaveScalar(scalar) {
    const s = scalar && typeof scalar === "object" ? scalar : {};
    const num = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
    return {
      hp: Math.max(0.01, num(s.hp, 1)),
      spd: Math.max(0.01, num(s.spd, 1)),
      armor: Math.max(0, num(s.armor, 0)),
      shield: Math.max(0.01, num(s.shield, 1)),
      regen: Math.max(0.01, num(s.regen, 1)),
      reward: Math.max(0.01, num(s.reward, 1))
    };
  }

  _getBossKey() {
    const bosses = ["FINAL_BOSS_VORTEX", "FINAL_BOSS_ABYSS", "FINAL_BOSS_IRON"];
    const seed = (this.mapSeed || 0) ^ (this.levelIndex * 9973);
    const rng = makeRNG(seed >>> 0);
    return bosses[(rng() * bosses.length) | 0];
  }

  _buildWave(wave, scalar) {
    const i = wave;
    if (wave === this.waveMax) {
      // Wave 16 is a single boss-only wave.
      return [
        { t: 0.8, type: this._getBossKey(), scalar, miniboss: true }
      ];
    }
    const baseCount = Math.round(((wave === 1) ? 6
      : (wave === 2 ? 8
      : (wave === 3 ? 10
      : (wave === 4 ? 12
      : (10 + Math.floor(i * 1.55) + Math.max(0, i - 10) * 0.6 + Math.max(0, i - 15) * 0.85))))) * 1.2);
    const spacing = (wave === 1) ? 0.95
      : (wave === 2 ? 0.88
      : (wave === 3 ? 0.82
      : (wave === 4 ? 0.76
      : Math.max(0.22, (0.66 - i * 0.013) * 0.9))));
    const earlyCountMul = wave <= 5 ? 0.88 : 1;
    const earlySpacingMul = wave <= 5 ? 1.12 : 1;
    const spawns = [];

    const types = ["RUNNER", "BRUTE"];
    if (i >= 3) types.push("ARMORED");
    if (i >= 6) types.push("SHIELDED");
    if (i >= 7) types.push("SPLITTER");
    if (i >= 9) types.push("REGEN");
    if (i >= 11) types.push("STEALTH");
    if (i >= 13) types.push("FLYING");
    if (i >= 8) types.push("PHASE");
    if (i >= 10) types.push("SHIELD_DRONE");

    const weights = {
      RUNNER: i <= 4 ? 1.6 : 1.1,
      BRUTE: i <= 4 ? 0.7 : 0.85,
      ARMORED: i <= 7 ? 0.55 : 0.9,
      SHIELDED: i <= 9 ? 0.55 : 0.9,
      SPLITTER: 0.7,
      REGEN: 0.75,
      STEALTH: 0.65,
      FLYING: 0.7,
      PHASE: 0.6,
      SHIELD_DRONE: 0.55
    };

    const pickWeighted = () => {
      const pool = types.map(t => ({ t, w: weights[t] || 1 }));
      const sum = pool.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * sum;
      for (const p of pool) { r -= p.w; if (r <= 0) return p.t; }
      return pool[pool.length - 1].t;
    };

    for (let n = 0; n < Math.max(1, Math.floor(baseCount * earlyCountMul)); n++) {
      let type = pickWeighted();
      if (i >= 12 && n % 7 === 0) type = "ARMORED";
      if (i >= 12 && n % 9 === 0) type = "SHIELDED";
      if (i >= 14 && n % 11 === 0) type = "REGEN";
      if (i >= 10 && n % 13 === 0) type = "SHIELD_DRONE";
      const t = n * (spacing * earlySpacingMul) + rand(-0.15, 0.15);
      let eliteTag = null;
      if (wave >= 7) {
        const eliteChance = Math.min(0.30, 0.10 + (wave - 7) * 0.012);
        if (Math.random() < eliteChance) {
          eliteTag = pick(["HARDENED", "VOLATILE", "PHASELINK"]);
        }
      }
      spawns.push({ t: Math.max(0, t), type, scalar, eliteTag });
    }

    if (i % 5 === 0) {
      spawns.push({ t: 1.2, type: "BRUTE", scalar });
      if (i >= 6) spawns.push({ t: 2.3, type: "ARMORED", scalar });
      if (i >= 10) spawns.push({ t: 2.8, type: "SHIELDED", scalar });
      if (i >= 12) spawns.push({ t: 3.0, type: "REGEN", scalar });
      spawns.push({ t: 3.4, type: "BOSS_PROJECTOR", scalar, miniboss: true });
    }

    spawns.sort((a, b) => a.t - b.t);
    return spawns;
  }

  startWave() {
    if (this.gameState !== GAME_STATE.GAMEPLAY) return;
    if (this.gameOver || this.gameWon) return;
    if (this.wave >= this.waveMax) return;

    this.wave++;
    this._resetWaveStats();
    this._refreshBuildList();
    {
      const keys = Object.keys(ANOMALIES);
      const key = keys[(Math.random() * keys.length) | 0];
      const base = ANOMALIES[key];
      this.waveAnomaly = { key, name: base.name, desc: base.desc };
      this._warpRippleT = 10;
      const shortDesc = base.desc.length > 70 ? `${base.desc.slice(0, 67)}...` : base.desc;
      setTimeout(() => toast(`ANOMALY: ${base.name} — ${shortDesc}`), 700);
    }
    const scalar = this._waveScalar(this.wave);
    this.waveScalar = this._sanitizeWaveScalar(scalar);
    const newSpawns = this._buildWave(this.wave, scalar);
    if (!this.waveActive) {
      this.waveActive = true;
      this.intermission = 0;
      this.spawnT = 0;
      this.spawnIndex = 0;
      this.spawnQueue = newSpawns;
    } else {
      const offset = this.spawnT + 0.2;
      for (const s of newSpawns) s.t += offset;
      this.spawnQueue = this.spawnQueue.concat(newSpawns);
    }
    toast(`Wave ${this.wave} launched`);
    this.audio.play("wave");
  }

  spawnEnemy(typeKey, startD = 0, scalarOverride = null, eliteTag = null) {
    const scalar = this._sanitizeWaveScalar(scalarOverride || this.waveScalar);
    const e = new Enemy(typeKey, scalar, startD, eliteTag);
    e._game = this;
    if (this.waveAnomaly?.key === "ION_STORM") {
      e._ionStorm = true;
      if (e.maxShield > 0) {
        e.maxShield *= 1.2;
        e.shield = e.maxShield;
      }
    }
    if (this.waveAnomaly?.key === "CRYO_LEAK") {
      e._slowMul = 1.15;
      e._dotDurMul = 0.85;
    }
    e._id = this._id++;
    const p = this.map.posAt(startD);
    e.x = p.x; e.y = p.y; e.ang = p.ang;
    this.enemies.push(e);
    return e;
  }

  _save() {
    try {
      const data = {
        mapIndex: 0,
        levelIndex: this.levelIndex,
        mapSeed: this.mapSeed,
        envId: this.envId,
        mapData: this.mapData ? {
          seed: this.mapData.seed,
          envId: this.mapData.envId,
          boundsN: this.mapData.boundsN || null,
          pathN: this.mapData.pathN,
          powerTilesN: this.mapData.powerTilesN,
          poolsN: this.mapData.poolsN
        } : null,
        mapStats: this.mapStats || [],
        playerStats: this.playerStats || this._newPlayerStats(),
        gold: this.gold,
        lives: this.lives,
        wave: this.wave,
        waveMax: this.waveMax,
        hasStarted: this.hasStarted,
        waveActive: this.waveActive,
        intermission: this.intermission,
        skipBuff: this.skipBuff,
        waveAnomaly: this.waveAnomaly ? this.waveAnomaly.key : null,
        warpRippleT: this._warpRippleT,
        speed: this.speed,
        powerCells: this.map.powerCells,
        spawnQueue: this.spawnQueue,
        spawnIndex: this.spawnIndex,
        spawnT: this.spawnT,
        waveScalar: this.waveScalar,
        globalOverchargeT: this.globalOverchargeT,
        corruptedTiles: Object.values(this.map.tilesByCell || {}).map(t => ({
          gx: t.gx,
          gy: t.gy,
          corrupted: t.corrupted === true,
          cleanseCost: Math.max(1, Number(t.cleanseCost) || this._defaultCleanseCost(t.gx, t.gy)),
          powerPurchased: t.powerPurchased === true,
          powerUnlockCost: Math.max(1, Number(t.powerUnlockCost) || this._defaultPowerUnlockCost(t.gx, t.gy))
        })),
        turrets: this.turrets.map(t => ({
          typeKey: t.typeKey,
          x: t.x, y: t.y,
          gx: t.gx, gy: t.gy,
          level: t.level,
          modsChosen: (t.modsChosen || []).slice(),
          cool: t.cool,
          charges: t.charges,
          targetMode: t.targetMode,
          boosted: t.boosted
        })),
        enemies: this.enemies.map(e => ({
          typeKey: e.typeKey,
          eliteTag: e.elite?.tag || null,
          hp: e.hp,
          shield: e.shield,
          pathD: e.pathD,
          slow: e.slow,
          slowT: e.slowT,
          dot: e.dot,
          dotT: e.dotT,
          revealed: e.revealed,
          revealT: e.revealT,
          revealLock: e._revealLock || false,
          marked: e._marked || 0,
          markedT: e._markedT || 0,
          noSplit: e._noSplit || false,
          noSplitT: e._noSplitT || 0,
          scalar: e.scalar
        })),
        traps: this.traps.map(tr => ({
          x: tr.x, y: tr.y, r: tr.r, t: tr.t,
          dmg: tr.dmg, slow: tr.slow, dot: tr.dot,
          siphon: tr.siphon, noSplit: tr.noSplit,
          ownerIndex: this.turrets.indexOf(tr.owner)
        })),
        lingering: this.lingering.map(l => ({
          x: l.x, y: l.y, r: l.r, t: l.t, dps: l.dps, col: l.col
        })),
        uiLayout: {
          leftPinned: !!leftPanel?.classList.contains("pinned"),
          leftCollapsed: !!leftPanel?.classList.contains("collapsed"),
          rightPinned: !!rightPanel?.classList.contains("pinned"),
          rightCollapsed: !!rightPanel?.classList.contains("collapsed")
        }
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (err) {
      // ignore storage errors (private mode, quota, etc.)
    }
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data) return false;

      if (Array.isArray(data.mapStats)) {
        this.mapStats = data.mapStats.slice();
      }
      if (data.playerStats && typeof data.playerStats === "object") {
        this.playerStats = {
          mapsCleared: data.playerStats.mapsCleared || 0,
          kills: data.playerStats.kills || 0,
          leaks: data.playerStats.leaks || 0,
          gold: data.playerStats.gold || 0,
          towersBuilt: data.playerStats.towersBuilt || 0,
          bosses: data.playerStats.bosses || 0
        };
      }
      if (typeof data.levelIndex === "number" && Number.isFinite(data.levelIndex)) {
        this.levelIndex = Math.max(1, data.levelIndex | 0);
      }
      // Apply panel layout before rebuilding map so play bounds match saved run.
      this._applySavedPanelLayout(data.uiLayout || null);
      let mapData = null;
      if (data.mapData && Array.isArray(data.mapData.pathN)) {
        const envId = typeof data.mapData.envId === "number" ? data.mapData.envId : (data.envId || 0);
        mapData = {
          seed: typeof data.mapData.seed === "number" ? data.mapData.seed : (data.mapSeed || this._makeSeed()),
          envId,
          env: ENV_PRESETS[envId] || ENV_PRESETS[0],
          boundsN: data.mapData.boundsN && typeof data.mapData.boundsN === "object" ? data.mapData.boundsN : null,
          pathN: data.mapData.pathN,
          powerTilesN: Array.isArray(data.mapData.powerTilesN) ? data.mapData.powerTilesN : [],
          poolsN: Array.isArray(data.mapData.poolsN) ? data.mapData.poolsN : []
        };
      } else if (typeof data.mapSeed === "number") {
        mapData = generateMap(data.mapSeed, data.envId || 0);
      }
      if (!mapData) {
        mapData = this.mapData || generateMap(this._makeSeed(), (Math.random() * ENV_PRESETS.length) | 0);
      }
      this.loadGeneratedMap(mapData);
      this._initCorruptedTiles(Array.isArray(data.corruptedTiles) ? data.corruptedTiles : null);
      {
        const g = Number(data.gold);
        this.gold = Number.isFinite(g) ? g : this.gold;
      }
      {
        const l = Number(data.lives);
        this.lives = Number.isFinite(l) ? l : this.lives;
      }
      {
        const w = Number(data.wave);
        this.wave = Number.isFinite(w) ? w : this.wave;
      }
      this.waveMax = 16;
      this.hasStarted = !!data.hasStarted;
      this.waveActive = !!data.waveActive;
      this.intermission = data.intermission ?? this.intermission;
      if (data.skipBuff) {
        const dmgMul = clamp(data.skipBuff.dmgMul || 1, 1, 1.25);
        const rateMul = clamp(data.skipBuff.rateMul || 1, 1, 1.25);
        const t = Math.max(0, data.skipBuff.t || 0);
        this.skipBuff = { dmgMul, rateMul, t };
      }
      if (data.waveAnomaly && ANOMALIES[data.waveAnomaly]) {
        const base = ANOMALIES[data.waveAnomaly];
        this.waveAnomaly = { key: data.waveAnomaly, name: base.name, desc: base.desc };
      }
      this._warpRippleT = data.warpRippleT || 0;
      {
        const loadedSpeed = Number(data.speed);
        this.speed = Number.isFinite(loadedSpeed) ? clamp(Math.round(loadedSpeed), 1, 4) : this.speed;
      }
      this.spawnQueue = data.spawnQueue || [];
      this.spawnIndex = data.spawnIndex || 0;
      this.spawnT = data.spawnT || 0;
      this.waveScalar = this._sanitizeWaveScalar(data.waveScalar || this.waveScalar);
      this.globalOverchargeT = data.globalOverchargeT || 0;

      if (Array.isArray(data.turrets)) {
        this.turrets = [];
        for (const s of data.turrets) {
          const t = new Turret(s.typeKey, s.x, s.y);
          t.gx = s.gx; t.gy = s.gy;
          t.cool = s.cool ?? t.cool;
          if (s.targetMode) t.targetMode = s.targetMode;
          const mods = s.modsChosen || [];
          for (let tier = 0; tier < mods.length; tier++) {
            const idx = mods[tier];
            if (idx == null) continue;
            t.applyUpgrade(tier, idx, false);
          }
          if (s.boosted) t.applyPowerBoost();
          t.flash = 0;
          if (typeof s.charges === "number") t.charges = s.charges;
          this.turrets.push(t);
        }
      }

      if (Array.isArray(data.enemies)) {
        this.enemies = [];
        for (const s of data.enemies) {
          const e = new Enemy(s.typeKey, this._sanitizeWaveScalar(s.scalar || this.waveScalar), s.pathD || 0, s.eliteTag || null);
          e._game = this;
          e.hp = s.hp ?? e.hp;
          e.shield = s.shield ?? e.shield;
          e.pathD = s.pathD ?? e.pathD;
          e.slow = s.slow || 0;
          e.slowT = s.slowT || 0;
          e.dot = s.dot || 0;
          e.dotT = s.dotT || 0;
          e.revealed = !!s.revealed;
          e.revealT = s.revealT || 0;
          e._revealLock = !!s.revealLock;
          e._marked = s.marked || 0;
          e._markedT = s.markedT || 0;
          e._noSplit = !!s.noSplit;
          e._noSplitT = s.noSplitT || 0;
          e._id = this._id++;
          this.enemies.push(e);
        }
      }

      if (Array.isArray(data.traps)) {
        this.traps = data.traps.map(tr => ({
          x: tr.x, y: tr.y, r: tr.r, t: tr.t,
          dmg: tr.dmg, slow: tr.slow, dot: tr.dot,
          siphon: tr.siphon, noSplit: tr.noSplit,
          owner: this.turrets[tr.ownerIndex] || null
        }));
      }

      if (Array.isArray(data.lingering)) {
        this.lingering = data.lingering.map(l => ({
          x: l.x, y: l.y, r: l.r, t: l.t, dps: l.dps, col: l.col
        }));
      }
    } catch (err) {
      // ignore load errors
      return false;
    }
    this._resetWaveStats();
    // CODEX CHANGE: Combo state is intentionally not persisted in saves.
    this._resetComboState();
    return true;
  }

  _resetRun() {
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];
    this.traps = [];
    this.beams = [];
    this.arcs = [];
    this.cones = [];
    this.lingering = [];
    this.floatText = [];
    this._textLimiter = new globalThis.Map();

    this.gold = this._getStartGold();
    this.lives = START_LIVES;
    this.wave = 0;
    this.waveMax = 16;
    this.hasStarted = false;
    this.waveActive = false;
    this.intermission = 0;
    this.gameOver = false;
    this.gameWon = false;
    this._gameOverPrompted = false;
    this.paused = false;
    if (pauseBtn) pauseBtn.textContent = "PAUSE";

    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.spawnT = 0;
    this.waveScalar = { hp: 1, spd: 1, armor: 0, shield: 1, regen: 1, reward: 1 };
    this.waveAnomaly = null;
    this._warpRippleT = 0;
    this.pendingIntermission = INTERMISSION_SECS;
    this.statsOpen = false;
    this.statsMode = null;
    this.gameState = GAME_STATE.GAMEPLAY;
    this.bossCinematic = null;

    this.buildKey = null;
    this.selectedTurret = null;
    this.selectedEnemy = null;
    this.hoverCell = null;
    this._id = 1;
    this.selectedTileCell = null;
    turretHud?.classList.add("hidden");
    turretStateBar?.classList.add("hidden");
    if (turretHudBody) turretHudBody.innerHTML = "";
    this._initCorruptedTiles();
    this._resetWaveStats();
    // CODEX CHANGE: Reset Echo Cascade on new runs/retries.
    this._resetComboState();
    this.runStats = this._newRunStats();
    this.mapStats = this.mapStats || [];
    this.playerStats = this.playerStats || this._newPlayerStats();
    this._refreshBuildList();
    this.updateHUD();
  }

  _spawnEnemyDeathFx(enemy) {
    const x = enemy.x;
    const y = enemy.y;
    const tint = enemy.tint || "rgba(255,207,91,0.85)";
    const type = enemy.typeKey || "";

    const addBoom = (r, dur, max, col, boom = true) => {
      this.explosions.push({
        x, y,
        r,
        t: dur,
        dur,
        max,
        col: col || tint,
        boom
      });
    };

    const addShake = (t, mag) => {
      this.shakeT = Math.min(0.32, this.shakeT + t);
      this.shakeMag = Math.min(10, this.shakeMag + mag);
    };

    switch (type) {
      case "RUNNER":
      case "MINI":
        this.particles.spawn(x, y, 8, "shard", tint);
        addBoom(10, 0.24, 38, tint, false);
        addShake(0.03, 0.45);
        break;
      case "BRUTE":
        this.particles.spawn(x, y, 20, "boom", tint);
        this.particles.spawn(x, y, 10, "hit", "rgba(255,207,91,0.9)");
        addBoom(18, 0.42, 88, tint, true);
        addBoom(10, 0.26, 56, "rgba(255,240,190,0.75)", false);
        addShake(0.11, 2.1);
        break;
      case "ARMORED":
        this.particles.spawn(x, y, 14, "shard", "rgba(200,220,255,0.9)");
        addBoom(14, 0.34, 66, "rgba(160,190,255,0.92)", true);
        addBoom(9, 0.22, 42, "rgba(234,240,255,0.7)", false);
        addShake(0.08, 1.4);
        break;
      case "SHIELDED":
      case "SHIELD_DRONE":
      case "BOSS_PROJECTOR":
        this.particles.spawn(x, y, 12, "shard", "rgba(154,108,255,0.95)");
        addBoom(11, 0.25, 52, "rgba(154,108,255,0.95)", false); // shield pop
        addBoom(16, 0.36, 76, tint, true);
        addShake(0.09, 1.6);
        break;
      case "SPLITTER":
        this.particles.spawn(x, y, 16, "chem", "rgba(255,207,91,0.9)");
        addBoom(13, 0.3, 58, "rgba(255,207,91,0.9)", true);
        addShake(0.08, 1.2);
        break;
      case "REGEN":
        this.particles.spawn(x, y, 18, "chem", "rgba(109,255,154,0.92)");
        addBoom(12, 0.3, 60, "rgba(109,255,154,0.88)", true);
        this.decals.push({ x, y, r: 18, t: 1.6, col: "rgba(109,255,154,0.22)" });
        addShake(0.07, 1.1);
        break;
      case "STEALTH":
        this.particles.spawn(x, y, 10, "hit", "rgba(234,240,255,0.9)");
        addBoom(10, 0.22, 46, "rgba(234,240,255,0.7)", false);
        addShake(0.04, 0.7);
        break;
      case "FLYING":
        this.particles.spawn(x, y, 12, "muzzle", "rgba(98,242,255,0.9)");
        addBoom(12, 0.27, 50, tint, false);
        addShake(0.05, 0.9);
        break;
      case "PHASE":
        this.particles.spawn(x, y, 14, "shard", "rgba(154,108,255,0.95)");
        addBoom(11, 0.22, 48, "rgba(154,108,255,0.95)", false);
        addBoom(16, 0.34, 72, tint, true);
        addShake(0.09, 1.4);
        break;
      case "FINAL_BOSS_VORTEX":
      case "FINAL_BOSS_ABYSS":
      case "FINAL_BOSS_IRON":
        this.particles.spawn(x, y, 34, "boom", tint);
        this.particles.spawn(x, y, 24, "shard", "rgba(255,207,91,0.95)");
        addBoom(24, 0.55, 150, tint, true);
        addBoom(16, 0.4, 115, "rgba(255,120,200,0.88)", false);
        addBoom(10, 0.24, 72, "rgba(234,240,255,0.78)", false);
        this.decals.push({ x, y, r: 30, t: 3.2, col: "rgba(25,10,30,0.45)" });
        addShake(0.2, 3.2);
        break;
      default:
        if (enemy.isBoss) {
          this.particles.spawn(x, y, 26, "boom", tint);
          addBoom(20, 0.48, 112, tint, true);
          addBoom(12, 0.3, 72, "rgba(234,240,255,0.76)", false);
          addShake(0.16, 2.7);
        } else {
          this.particles.spawn(x, y, enemy.flying ? 10 : 14, "boom", tint);
          addBoom(enemy.flying ? 12 : 16, 0.38, 64, tint, true);
          addShake(0.08, enemy.flying ? 1.0 : 1.6);
        }
        break;
    }
  }

  // CODEX CHANGE: Centralized Echo Cascade reset so run resets/loads stay safe.
  _resetComboState() {
    this.comboCount = 0;
    this.comboTimer = 0;
    this.comboWindow = comboWindowForCount(1);
    this.comboMult = 1;
    this._comboUiFade = 0;
    if (screenFxEl) {
      screenFxEl.classList.remove("comboTier10", "comboTier15");
    }
  }

  // CODEX CHANGE: Echo Cascade chain progression, timers, and subtle kill pulses.
  _applyEchoCascadeOnKill(enemy, baseReward) {
    const rewardBase = Math.max(1, Number(baseReward) | 0);
    if (this.comboTimer > 0 && this.comboCount > 0) {
      this.comboCount += 1;
    } else {
      this.comboCount = 1;
    }
    this.comboWindow = comboWindowForCount(this.comboCount);
    this.comboTimer = this.comboWindow;
    this.comboMult = comboMultForCount(this.comboCount);
    this.comboBest = Math.max(this.comboBest || 0, this.comboCount);
    this._comboUiFade = 1;
    const rewardTotal = Math.max(1, Math.round(rewardBase * this.comboMult));
    const rewardBonus = Math.max(0, rewardTotal - rewardBase);
    if (enemy) {
      enemy._baseKillReward = rewardBase;
      enemy._comboBonusGold = rewardBonus;
    }
    if (this.comboCount >= 15) {
      this.shakeT = Math.min(0.2, this.shakeT + ECHO_CASCADE_PULSE_SHAKE_T);
      this.shakeMag = Math.min(5, this.shakeMag + ECHO_CASCADE_PULSE_SHAKE_MAG);
    }
    return rewardTotal;
  }

  _grantKillReward(enemy) {
    if (!enemy || enemy._rewardGranted || enemy._leaked) return 0;
    const baseReward = ENEMY_TYPES[enemy.typeKey]?.reward ?? 1;
    const scalarReward = Number.isFinite(enemy.scalar?.reward) ? enemy.scalar.reward : 1;
    const fallbackReward = Math.max(1, Math.floor(baseReward * scalarReward));
    const rewardRaw = Number(enemy.reward);
    const rewardBase = Number.isFinite(rewardRaw) && rewardRaw > 0 ? Math.max(1, Math.floor(rewardRaw)) : fallbackReward;
    const reward = this._applyEchoCascadeOnKill(enemy, rewardBase);
    if (!Number.isFinite(this.gold)) this.gold = this._getStartGold();
    this.gold += reward;
    enemy._rewardGranted = true;
    return reward;
  }

  onEnemyKill(enemy) {
    if (!enemy || enemy._killHandled) return;
    enemy._killHandled = true;
    // on-death effects
    if (enemy.onDeath && !enemy._noSplit) enemy.onDeath(this, enemy);

    if (enemy.elite && enemy.elite.tag === "VOLATILE" && !enemy._volatileTriggered) {
      enemy._volatileTriggered = true;
      const r = 90;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e === enemy) continue;
        if (dist2(enemy.x, enemy.y, e.x, e.y) <= r * r) {
          e.takeHit(this, 38, DAMAGE.TRUE);
        }
      }
      this.explosions.push({
        x: enemy.x,
        y: enemy.y,
        r: 14,
        t: 0.32,
        dur: 0.32,
        max: r,
        col: "rgba(255,91,125,0.9)",
        boom: true
      });
      this.shakeT = Math.min(0.25, this.shakeT + 0.08);
      this.shakeMag = Math.min(8, this.shakeMag + 1.2);
    }

    // CODEX CHANGE: Reward includes Echo Cascade multiplier and popup feedback at kill position.
    const reward = this._grantKillReward(enemy);
    const comboText = `+${reward}g  x${this.comboCount}`;
    const comboColor = this.comboCount >= 15
      ? "rgba(255,207,91,0.96)"
      : (this.comboCount >= 10 ? "rgba(154,108,255,0.95)" : "rgba(98,242,255,0.95)");
    this.spawnText(enemy.x + rand(-6, 6), enemy.y - 20, comboText, comboColor, 1.05);
    if (this.waveStats) {
      this.waveStats.kills += 1;
      this.waveStats.gold += reward;
      if (enemy.isBoss) this.waveStats.bosses += 1;
    }
    if (this.runStats) {
      this.runStats.kills += 1;
      this.runStats.gold += reward;
      if (enemy.isBoss) this.runStats.bosses += 1;
    }
    if (this.playerStats) {
      this.playerStats.kills += 1;
      this.playerStats.gold += reward;
      if (enemy.isBoss) this.playerStats.bosses += 1;
    }
    this.audio.playLimited("kill", 80);

    // type-specific death animation
    this._spawnEnemyDeathFx(enemy);

    // siphon from traps
    if (enemy._lastHitTag === "trap" && enemy._lastHitBy && enemy._lastHitBy.siphon) {
      // CODEX CHANGE: Keep siphon based on base kill value so combo only affects kill gold.
      const refundBase = Math.max(1, Number(enemy._baseKillReward) || reward);
      const refund = Math.max(1, Math.floor(refundBase * 0.2));
      this.gold += refund;
      if (this.waveStats) this.waveStats.gold += refund;
      if (this.runStats) this.runStats.gold += refund;
      if (this.playerStats) this.playerStats.gold += refund;
      this.particles.spawn(enemy.x, enemy.y, 4, "muzzle");
    }

    // venom splash
    if (enemy._lastHitBy && enemy._lastHitBy.onKillSplash) {
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(enemy.x, enemy.y, e.x, e.y) <= 80 * 80) {
          e.applyDot(Math.max(4, reward * 0.6), 2.4);
        }
      }
    }

    // Wave 16 boss death enters the cinematic sequence.
    if (enemy.isBoss && this.wave >= this.waveMax && this.gameState === GAME_STATE.GAMEPLAY) {
      this._startBossCinematic(enemy);
    }
  }

  onEnemyLeak(enemy) {
    enemy._leaked = true;
    enemy.hp = 0;
    if (this.waveStats) this.waveStats.leaks += 1;
    if (this.runStats) this.runStats.leaks += 1;
    if (this.playerStats) this.playerStats.leaks += 1;
    this.lives--;
    this.particles.spawn(enemy.x, enemy.y, 8, "boom");
    this.audio.play("leak");
    this.damageFlash = Math.max(this.damageFlash, 0.45);
    const end = this.map.pathPts[this.map.pathPts.length - 1];
    if (end) {
      this.explosions.push({
        x: end[0],
        y: end[1],
        r: 20,
        t: 0.35,
        dur: 0.35,
        max: 120,
        col: "rgba(98,242,255,0.85)",
        boom: false
      });
      this.corePulseT = Math.max(this.corePulseT, 0.45);
      this.shakeT = Math.min(0.25, this.shakeT + 0.08);
      this.shakeMag = Math.min(6, this.shakeMag + 1.2);
    }
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
      toast("Core lost.");
      this.audio.play("lose");
      if (!this._gameOverPrompted) {
        this._gameOverPrompted = true;
        showConfirm("Defeat", "Defeat. Retry this level?", () => {
          this._resetRun();
          this._save();
        });
      }
    }
  }

  isCellOccupied(gx, gy) {
    return this.turrets.some(t => t.gx === gx && t.gy === gy);
  }

  _openCorruptedTileHud(cell) {
    if (!cell) return;
    const state = this._getTileState(cell.gx, cell.gy, true);
    if (!state || !state.corrupted) return;
    const cost = Math.max(1, Number(state.cleanseCost) || this._defaultCleanseCost(cell.gx, cell.gy));
    this.selectedTurret = null;
    this.selectedEnemy = null;
    this.selectedTileCell = { gx: cell.gx, gy: cell.gy, v: cell.v };
    sellBtn.disabled = true;
    if (turretHudSellBtn) {
      turretHudSellBtn.disabled = true;
      turretHudSellBtn.style.display = "none";
    }
    selSub.textContent = "Corrupted Tile";

    const hudHtml = `
      <div class="selHeaderRow">
        <div class="selName">Corrupted Tile</div>
        <div class="selLevel">Cell ${cell.gx},${cell.gy}</div>
      </div>
      <div class="statGrid">
        <div class="statCard"><div class="k">Status</div><div class="v">Corrupted</div></div>
        <div class="statCard"><div class="k">Cleanse Cost</div><div class="v">${cost}g</div></div>
        <div class="statCard"><div class="k">Build</div><div class="v">Blocked</div></div>
        <div class="statCard"><div class="k">Action</div><div class="v">Purchase Cleanse</div></div>
      </div>
      <div class="upgrades">
        <div class="upTitle">Cleanse</div>
        <div class="modRow">
          <div class="modChoice ${this.gold >= cost ? "" : "poor"}">
            <div class="modTop">
              <div class="modName">Purge Corruption</div>
              <div class="modCost">${cost}g</div>
            </div>
            <div class="modDesc">Removes corruption from this tile immediately.</div>
            <div class="modBtnRow">
              <button id="cleanseTileBtn" class="btn ${this.gold >= cost ? "primary" : ""}" ${this.gold >= cost ? "" : "disabled"}>CLEANSE TILE</button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (turretHudBody) turretHudBody.innerHTML = hudHtml;
    turretHud?.classList.remove("hidden");
    this._updateTurretHudPosition();
    const cleanseBtn = turretHudBody?.querySelector("#cleanseTileBtn");
    if (cleanseBtn) {
      cleanseBtn.addEventListener("click", () => {
        this._cleanseTile(cell.gx, cell.gy);
      });
    }
  }

  _cleanseTile(gx, gy) {
    if (this.isPaused()) {
      toast("Cannot cleanse while paused.");
      return;
    }
    const state = this._getTileState(gx, gy, false);
    if (!state || state.corrupted !== true) return;
    const cost = Math.max(1, Number(state.cleanseCost) || this._defaultCleanseCost(gx, gy));
    if (this.gold < cost) {
      toast("Not enough gold.");
      this._openCorruptedTileHud({ gx, gy, v: this.map.cells[gy * this.map.cols + gx] || 0 });
      return;
    }
    this.gold -= cost;
    state.corrupted = false;
    this.map.tilesByCell[this._tileKey(gx, gy)] = state;
    this.audio.play("upgrade");
    const w = this.map.worldFromCell(gx, gy);
    this.particles.spawn(w.x, w.y, 8, "muzzle");
    toast(`Tile cleansed for ${cost}g`);
    this.selectedTileCell = null;
    this.selectTurret(null);
    this._save();
  }

  _openPowerTileHud(cell) {
    if (!cell || cell.v !== 3) return;
    const state = this._getTileState(cell.gx, cell.gy, true);
    if (!state || state.powerPurchased === true) return;
    const cost = Math.max(1, Number(state.powerUnlockCost) || this._defaultPowerUnlockCost(cell.gx, cell.gy));
    const corrupted = state.corrupted === true;
    this.selectedTurret = null;
    this.selectedEnemy = null;
    this.selectedTileCell = { gx: cell.gx, gy: cell.gy, v: cell.v };
    sellBtn.disabled = true;
    if (turretHudSellBtn) {
      turretHudSellBtn.disabled = true;
      turretHudSellBtn.style.display = "none";
    }
    selSub.textContent = "Power Tile";

    const hudHtml = `
      <div class="selHeaderRow">
        <div class="selName">Locked Power Tile</div>
        <div class="selLevel">Cell ${cell.gx},${cell.gy}</div>
      </div>
      <div class="statGrid">
        <div class="statCard"><div class="k">Status</div><div class="v">Locked</div></div>
        <div class="statCard"><div class="k">Unlock Cost</div><div class="v">${cost}g</div></div>
        <div class="statCard"><div class="k">Bonus</div><div class="v">+45% DMG / +25% RNG / +25% FIR</div></div>
        <div class="statCard"><div class="k">Corruption</div><div class="v">${corrupted ? "Present" : "None"}</div></div>
      </div>
      <div class="upgrades">
        <div class="upTitle">Purchase</div>
        <div class="modRow">
          <div class="modChoice ${this.gold >= cost ? "" : "poor"}">
            <div class="modTop">
              <div class="modName">Unlock Power Tile</div>
              <div class="modCost">${cost}g</div>
            </div>
            <div class="modDesc">Purchase this tile before placing a turret on it.</div>
            <div class="modBtnRow">
              <button id="buyPowerTileBtn" class="btn ${this.gold >= cost ? "primary" : ""}" ${this.gold >= cost ? "" : "disabled"}>BUY TILE</button>
            </div>
          </div>
        </div>
      </div>
    `;
    if (turretHudBody) turretHudBody.innerHTML = hudHtml;
    turretHud?.classList.remove("hidden");
    this._updateTurretHudPosition();
    const buyBtn = turretHudBody?.querySelector("#buyPowerTileBtn");
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        this._purchasePowerTile(cell.gx, cell.gy);
      });
    }
  }

  _purchasePowerTile(gx, gy) {
    if (this.isPaused()) {
      toast("Cannot purchase while paused.");
      return;
    }
    const idx = gy * this.map.cols + gx;
    if ((this.map.cells?.[idx] ?? 0) !== 3) return;
    const state = this._getTileState(gx, gy, true);
    if (!state || state.powerPurchased === true) return;
    const cost = Math.max(1, Number(state.powerUnlockCost) || this._defaultPowerUnlockCost(gx, gy));
    if (this.gold < cost) {
      toast("Not enough gold.");
      this._openPowerTileHud({ gx, gy, v: 3 });
      return;
    }
    this.gold -= cost;
    state.powerPurchased = true;
    this.map.tilesByCell[this._tileKey(gx, gy)] = state;
    const w = this.map.worldFromCell(gx, gy);
    this.particles.spawn(w.x, w.y, 10, "muzzle");
    this.audio.play("upgrade");
    toast(`Power tile unlocked for ${cost}g`);
    this.selectedTileCell = null;
    this.selectTurret(null);
    this._save();
  }

  onClick(x, y) {
    if (this.isUiBlocked()) return;
    // select turret if clicked
    let clickedTurret = null;
    for (const t of this.turrets) {
      if (dist2(x, y, t.x, t.y) <= 16 * 16) {
        clickedTurret = t;
        break;
      }
    }
    if (clickedTurret) {
      this.selectTurret(clickedTurret);
      this.collapseEnabled = true;
      if (this.buildKey) this.clearBuildMode();
      return;
    }

    if (this.buildKey) {
      if (this.isPaused()) {
        toast("Cannot build while paused.");
        return;
      }
      const cell = this.map.cellAt(x, y);
      if (cell.v !== 1 && cell.v !== 3) { toast("Not buildable."); return; }
      if (cell.v === 3 && !this._isPowerTileUnlocked(cell.gx, cell.gy)) {
        toast("Power tile is locked. Purchase it first.");
        this._openPowerTileHud(cell);
        return;
      }
      if (this._isCellCorrupted(cell.gx, cell.gy)) {
        toast("Tile corrupted. Cleanse it first.");
        this._openCorruptedTileHud(cell);
        return;
      }
      if (this.isCellOccupied(cell.gx, cell.gy)) { toast("Tile occupied."); return; }
      const t = TURRET_TYPES[this.buildKey];
      if (this.gold < t.cost) {
        toast("Not enough gold.");
        this.clearBuildMode();
        return;
      }
      this.gold -= t.cost;
      const w = this.map.worldFromCell(cell.gx, cell.gy);
      const turret = new Turret(this.buildKey, w.x, w.y);
      if (cell.v === 3) turret.applyPowerBoost();
      turret.gx = cell.gx; turret.gy = cell.gy;
      this.turrets.push(turret);
      if (this.waveStats && this.hasStarted && this.wave > 0) {
        this.waveStats.towersBuilt += 1;
      }
      if (this.runStats) this.runStats.towersBuilt += 1;
      if (this.playerStats) this.playerStats.towersBuilt += 1;
      // Do not auto-open upgrade HUD on placement; require explicit turret click.
      this.selectEnemy(null);
      this.particles.spawn(w.x, w.y, 8, "muzzle");
      this.audio.play("build");
      this._save();
      return;
    }

    const cell = this.map.cellAt(x, y);
    if (cell.v === 3 && !this._isPowerTileUnlocked(cell.gx, cell.gy)) {
      this._openPowerTileHud(cell);
      return;
    }
    if ((cell.v === 1 || cell.v === 3) && this._isCellCorrupted(cell.gx, cell.gy)) {
      this._openCorruptedTileHud(cell);
      return;
    }

    // select enemy if clicked
    let clickedEnemy = null;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const rr = (e.r + 4) * (e.r + 4);
      if (dist2(x, y, e.x, e.y) <= rr) { clickedEnemy = e; break; }
    }
    if (clickedEnemy) {
      this.selectEnemy(clickedEnemy);
      return;
    }

    this.selectEnemy(null);
  }

  selectTurret(turret) {
    this.selectedTileCell = null;
    this.selectedEnemy = null;
    this.selectedTurret = turret;
    sellBtn.disabled = !turret;
    if (turretHudSellBtn) {
      turretHudSellBtn.disabled = !turret;
      turretHudSellBtn.style.display = "";
    }
    if (!turret) {
      selSub.textContent = "Select a turret";
      if (selectionBody) selectionBody.innerHTML = "";
      turretHud?.classList.add("hidden");
      turretStateBar?.classList.add("hidden");
      return;
    }
    selSub.textContent = turret.role;

    const tierNames = ["Base", "I", "II", "III", "IV", "V"];
    const dps = turret.fire > 0 ? (turret.dmg / turret.fire) : turret.dmg * 12;
    const stats = [
      { k: "Damage", v: turret.dmg.toFixed(1) },
      { k: "Fire", v: `${turret.fire.toFixed(2)}s` },
      { k: "Range", v: turret.range.toFixed(0) },
      { k: "DPS", v: dps.toFixed(1) }
    ];

    const statCards = stats.map(s => `
      <div class="statCard"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>
    `).join("");
    const targetModes = [
      { value: "FIRST", label: "FIRST" },
      { value: "LAST", label: "LAST" },
      { value: "STRONGEST", label: "STRONGEST" },
      { value: "MOST_SHIELD", label: "MOST SHIELD" },
      { value: "MOST_ARMOR", label: "MOST ARMOR" }
    ];
    const targetOptions = targetModes.map(m => {
      const selected = (turret.targetMode || "FIRST") === m.value ? "selected" : "";
      return `<option value="${m.value}" ${selected}>${m.label}</option>`;
    }).join("");

    let upgradesHtml = "";
    if (turret.level < 5) {
      const tierIdx = turret.level;
      const mods = turret.getTierOptions(tierIdx);
      upgradesHtml = `
        <div class="upgrades">
          <div class="upTitle">Upgrade Tier ${tierNames[tierIdx + 1]}</div>
          <div class="modRow">
            ${mods.map((m, idx) => {
              const preview = Turret.previewAfterUpgrade(turret, tierIdx, idx);
              const affordable = this.gold >= m.cost;
              const delta = [
                `DMG ${turret.dmg.toFixed(1)} -> ${preview.dmg.toFixed(1)}`,
                `FIR ${turret.fire.toFixed(2)} -> ${preview.fire.toFixed(2)}`,
                `RNG ${turret.range.toFixed(0)} -> ${preview.range.toFixed(0)}`
              ].join(", ");
              return `
                <div class="modChoice ${affordable ? "" : "poor"}">
                  <div class="modTop">
                    <div class="modName">${m.name}</div>
                    <div class="modCost">${m.cost}g</div>
                  </div>
                  <div class="modDesc">${m.desc}</div>
                  <div class="modDelta">${delta}</div>
                  <div class="modBtnRow">
                    <button class="btn ${affordable ? "primary" : ""}" data-mod="${idx}" data-cost="${m.cost}" ${affordable ? "" : "disabled"}>UPGRADE</button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    } else {
      upgradesHtml = `
        <div class="upgrades">
          <div class="upTitle">Upgrades</div>
          <div class="tiny">Max tier reached.</div>
        </div>
      `;
    }

    const hudHtml = `
      <div class="selHeaderRow">
        <div class="selName">${turret.name}</div>
        <div class="selLevel">Tier ${tierNames[turret.level]}</div>
      </div>
      <div class="statGrid">${statCards}</div>
      <div class="targetRow">
        <div class="targetLabel">Targeting</div>
        <select id="targetModeSelect" class="targetSelect">
          ${targetOptions}
        </select>
      </div>
      ${upgradesHtml}
    `;
    if (turretHudBody) turretHudBody.innerHTML = hudHtml;
    if (selectionBody) selectionBody.innerHTML = "";
    turretHud?.classList.remove("hidden");
    this._updateTurretHudPosition();

    turretHudBody?.querySelectorAll("button[data-mod]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.mod || "0");
        this.applyUpgrade(turret, idx);
      });
    });
    const targetSelect = turretHudBody?.querySelector("#targetModeSelect");
    if (targetSelect) {
      targetSelect.addEventListener("change", () => {
        turret.targetMode = targetSelect.value;
        this._save();
      });
    }
  }

  selectEnemy(enemy) {
    this.selectedTileCell = null;
    this.selectedTurret = null;
    this.selectedEnemy = enemy || null;
    sellBtn.disabled = true;
    if (turretHudSellBtn) turretHudSellBtn.disabled = true;
    turretHud?.classList.add("hidden");
    turretStateBar?.classList.add("hidden");

    if (!enemy) {
      selSub.textContent = "Select a turret";
      selectionBody.innerHTML = `
        <div class="emptyState">
          <div class="emptyGlyph"></div>
          <div class="emptyTitle">No turret selected</div>
          <div class="emptyText">Click a turret you placed to view stats and upgrades.</div>
        </div>
      `;
      return;
    }

    const yesNo = (v) => v ? "Yes" : "No";
    const hpNow = Math.max(0, Math.ceil(enemy.hp));
    const hpMax = Math.max(1, Math.ceil(enemy.maxHp));
    const shieldNow = Math.max(0, Math.ceil(enemy.shield || 0));
    const shieldMax = Math.max(0, Math.ceil(enemy.maxShield || 0));
    const regen = (enemy.regen || 0).toFixed(1);
    const tags = [];
    if (enemy.isBoss) tags.push("Boss");
    if (enemy.elite?.tag) tags.push(`Elite: ${enemy.elite.tag}`);
    const specials = [];
    if ((enemy.maxShield || 0) > 0) specials.push("Shielded");
    if (enemy.stealth) specials.push("Stealth");
    if (enemy.flying) specials.push("Flying");
    if ((enemy.regen || 0) > 0) specials.push("Regenerates");
    if (enemy.typeKey === "SPLITTER") specials.push("Splits On Death");
    if (enemy.typeKey === "PHASE") specials.push("Blink Forward");
    if (enemy.typeKey === "SHIELD_DRONE" || enemy.typeKey === "BOSS_PROJECTOR") specials.push("Shields Nearby Allies");
    if (enemy.typeKey === "FINAL_BOSS_VORTEX") specials.push("Shield Surge Pulses");
    if (enemy.typeKey === "FINAL_BOSS_ABYSS") specials.push("Void Zone Spawns");
    if (enemy.typeKey === "FINAL_BOSS_IRON") specials.push("Shockwave Bursts");
    const anomaly = this.waveAnomaly?.name || "None";

    selSub.textContent = enemy.desc || "Enemy";
    selectionBody.innerHTML = `
      <div class="selHeaderRow">
        <div class="selName">${enemy.name}</div>
        <div class="selLevel">${enemy.typeKey}</div>
      </div>
      <div class="statGrid">
        <div class="statCard"><div class="k">HP</div><div class="v">${hpNow} / ${hpMax}</div></div>
        <div class="statCard"><div class="k">Shield</div><div class="v">${shieldNow} / ${shieldMax}</div></div>
        <div class="statCard"><div class="k">Armor</div><div class="v">${Math.round((enemy.armor || 0) * 100)}%</div></div>
        <div class="statCard"><div class="k">Regen</div><div class="v">${regen}/s</div></div>
      </div>
      <div class="upgrades">
        <div class="upTitle">Attributes</div>
        <div class="statsGrid">
          <div class="statsRow"><div class="k">Shielded</div><div class="v">${yesNo((enemy.maxShield || 0) > 0)}</div></div>
          <div class="statsRow"><div class="k">Stealth</div><div class="v">${yesNo(!!enemy.stealth)}</div></div>
          <div class="statsRow"><div class="k">Flying</div><div class="v">${yesNo(!!enemy.flying)}</div></div>
          <div class="statsRow"><div class="k">Tags</div><div class="v">${tags.length ? tags.join(", ") : "None"}</div></div>
          <div class="statsRow"><div class="k">Specials</div><div class="v">${specials.length ? specials.join(", ") : "None"}</div></div>
          <div class="statsRow"><div class="k">Anomaly</div><div class="v">${anomaly}</div></div>
        </div>
      </div>
    `;
  }

  applyUpgrade(turret, modIdx) {
    if (!turret || turret.level >= 5) return;
    if (this.isPaused()) { toast("Cannot upgrade while paused."); return; }
    const cost = turret.getUpgradeCost(turret.level, modIdx);
    if (this.gold < cost) { toast("Not enough gold."); return; }
    const ok = turret.applyUpgrade(turret.level, modIdx, false);
    if (ok) {
      this.gold -= cost;
      this.selectTurret(turret);
      this.particles.spawn(turret.x, turret.y, 10, "muzzle");
      this.audio.play("upgrade");
      this._save();
    }
  }

  sellSelected() {
    if (!this.selectedTurret) return;
    if (this.isPaused()) { toast("Cannot sell while paused."); return; }
    const t = this.selectedTurret;
    const refund = Math.max(1, Math.floor((t.costSpent || 0) * 0.7));
    this.gold += refund;
    if (this.waveStats) this.waveStats.gold += refund;
    if (this.runStats) this.runStats.gold += refund;
    if (this.playerStats) this.playerStats.gold += refund;
    this.turrets = this.turrets.filter(x => x !== t);
    this.selectTurret(null);
    this.particles.spawn(t.x, t.y, 10, "boom");
    this.audio.play("sell");
    this._save();
  }

  confirmSellSelected() {
    if (!this.selectedTurret) return;
    if (this.isPaused()) { toast("Cannot sell while paused."); return; }
    const t = this.selectedTurret;
    const refund = Math.max(1, Math.floor((t.costSpent || 0) * 0.7));
    showConfirm("Sell Turret", `Sell ${t.name} for ${refund} gold?`, () => this.sellSelected());
  }

  update(dt) {
    // Recover from stale UI pause state if modal was closed externally.
    if (this.statsOpen && waveStatsModal?.classList.contains("hidden")) {
      this.statsOpen = false;
      this.statsMode = null;
    }
    if (this.gameOver || this.gameWon) {
      this.updateHUD();
      return;
    }
    if (this.gameState === GAME_STATE.BOSS_CINEMATIC) {
      this._updateBossCinematic(dt);
      return;
    }
    if (this.isPaused()) {
      this.updateHUD();
      return;
    }

    this._realDt = dt;
    if (this.audio?.enabled) this.audio.tick();
    // Guard against bad saved/runtime values that can freeze simulation at dtScaled=0.
    if (!Number.isFinite(this.speed) || this.speed <= 0) this.speed = 1;
    const dtScaled = dt * this.speed;
    // CODEX CHANGE: Echo Cascade countdown/collapse (uses dtScaled so speed modes affect chain window).
    if (this.comboCount > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dtScaled);
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboMult = 1;
        this.comboWindow = comboWindowForCount(1);
        this._comboUiFade = 1;
      }
    } else if (this._comboUiFade > 0) {
      this._comboUiFade = Math.max(0, this._comboUiFade - (dt / ECHO_CASCADE_FADE_SECS));
    }
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      if (this.shakeT === 0) this.shakeMag = 0;
    }
    if (this.panelHold) {
      this.panelHold.left = Math.max(0, this.panelHold.left - dt);
      this.panelHold.right = Math.max(0, this.panelHold.right - dt);
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dtScaled * 1.8);
    }
    if (this.corePulseT > 0) {
      this.corePulseT = Math.max(0, this.corePulseT - dt);
    }
    if (this.skipBuff.t > 0) {
      this.skipBuff.t = Math.max(0, this.skipBuff.t - dtScaled);
      if (this.skipBuff.t <= 0) {
        this.skipBuff.dmgMul = 1;
        this.skipBuff.rateMul = 1;
      }
    }
    if (this.abilities) {
      for (const a of Object.values(this.abilities)) {
        if (a.t > 0) a.t = Math.max(0, a.t - dt);
      }
    }
    if (this.globalOverchargeT > 0) {
      this.globalOverchargeT = Math.max(0, this.globalOverchargeT - dt);
    }

    // wave logic
    if (this.waveActive) {
      this.spawnT += dtScaled;
      while (this.spawnIndex < this.spawnQueue.length && this.spawnT >= this.spawnQueue[this.spawnIndex].t) {
        const s = this.spawnQueue[this.spawnIndex++];
        let spawned = null;
        if (s.miniboss) {
          toast("MINIBOSS INBOUND");
          this.shakeT = Math.min(0.18, this.shakeT + 0.06);
          this.shakeMag = Math.min(4, this.shakeMag + 0.8);
        }
        spawned = this.spawnEnemy(s.type, 0, s.scalar, s.eliteTag || null);
        if (s.miniboss && spawned) {
          this.spawnText(spawned.x, spawned.y - 20, "MINIBOSS", "rgba(98,242,255,0.95)", 1.0);
        }
      }
      if (this.spawnIndex >= this.spawnQueue.length && this.enemies.every(e => e.hp <= 0 || e._dead)) {
        this.waveActive = false;
        this.waveAnomaly = null;
        this._warpRippleT = 0;
        this._save();
        if (this.wave >= this.waveMax) {
          if (!this.gameOver && !this._transitioning) {
            this.advanceLevel();
            this.audio.play("win");
          }
          return;
        } else {
          this.intermission = INTERMISSION_SECS;
          this.updateHUD();
          return;
        }
      }
    } else if (this.hasStarted && this.intermission > 0) {
      this.intermission = Math.max(0, this.intermission - dtScaled);
      if (this.intermission <= 0 && this.wave < this.waveMax) {
        this.startWave();
      }
    }

    if (this.waveActive && this.waveAnomaly?.key === "WARP_RIPPLE") {
      this._warpRippleT -= dtScaled;
      if (this._warpRippleT <= 0) {
        this._warpRippleT = 10;
        const candidates = this.enemies.filter(e => e.hp > 0 && !e.flying);
        for (let i = candidates.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          const tmp = candidates[i];
          candidates[i] = candidates[j];
          candidates[j] = tmp;
        }
        for (let i = 0; i < Math.min(2, candidates.length); i++) {
          const e = candidates[i];
          e.pathD = Math.min(this.map.totalLen - 2, e.pathD + 60);
          const p = this.map.posAt(e.pathD);
          e.x = p.x; e.y = p.y; e.ang = p.ang;
          this.particles.spawn(e.x, e.y, 6, "muzzle");
          this.explosions.push({
            x: e.x,
            y: e.y,
            r: 10,
            t: 0.24,
            dur: 0.24,
            max: 42,
            col: "rgba(154,108,255,0.85)",
            boom: false
          });
        }
      }
    }

    // update enemies
    for (const e of this.enemies) {
      try {
        e.update(this, dtScaled);
      } catch (err) {
        this._reportRuntimeError("enemy.update", err);
        // Keep enemy alive on recovery; force-killing here can skip reward flow.
      }
    }
    // Safety net: finalize all dead enemies before cleanup.
    for (const e of this.enemies) {
      if (e.hp <= 0 && !e._dead) {
        e._dead = true;
        try {
          this.onEnemyKill(e);
        } catch (err) {
          this._reportRuntimeError("enemy.finalizeKill", err);
          this._grantKillReward(e);
        }
      } else if (e._dead && e.hp <= 0 && !e._leaked && !e._rewardGranted) {
        this._grantKillReward(e);
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0 && !e._dead);
    if (this.selectedEnemy && (this.selectedEnemy.hp <= 0 || this.selectedEnemy._dead)) {
      this.selectEnemy(null);
    }
    if (this.gameState === GAME_STATE.BOSS_CINEMATIC) {
      this._updateVisualEffects(dt);
      this.updateHUD();
      return;
    }

    // update turrets
    for (const t of this.turrets) {
      try {
        t.update(this, dtScaled);
      } catch (err) {
        this._reportRuntimeError("turret.update", err);
      }
    }

    // update projectiles
    for (const p of this.projectiles) {
      try {
        p.update(this, dtScaled);
      } catch (err) {
        this._reportRuntimeError("projectile.update", err);
        p.ttl = 0;
      }
    }
    this.projectiles = this.projectiles.filter(p => p.ttl > 0);

    // traps
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.t -= dtScaled;
      if (tr.t <= 0) { this.traps.splice(i, 1); continue; }

      for (const e of this.enemies) {
        if (e.hp <= 0 || e.flying) continue;
        if (dist2(tr.x, tr.y, e.x, e.y) <= tr.r * tr.r) {
          e._lastHitBy = tr.owner;
          e._lastHitTag = "trap";
          e.applySlow(tr.slow, 0.6);
          if (!tr._tick) tr._tick = 0;
          tr._tick -= dtScaled;
          if (tr._tick <= 0) {
            tr._tick = 0.55;
          e.takeHit(this, tr.dmg, DAMAGE.TRUE, tr.owner?.typeKey || "TRAP");
            if (tr.dot) e.applyDot(tr.dot.dps, tr.dot.dur);
          }
          if (tr.noSplit && e.typeKey === "SPLITTER") {
            e._noSplit = true;
            e._noSplitT = Math.max(e._noSplitT, 0.8);
          }
        }
      }
    }

    // lingering zones
    for (let i = this.lingering.length - 1; i >= 0; i--) {
      const l = this.lingering[i];
      l.t -= dtScaled;
      if (l.t <= 0) { this.lingering.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(l.x, l.y, e.x, e.y) <= l.r * l.r) {
          e.takeHit(this, l.dps * dtScaled, DAMAGE.TRUE, l.ownerKey || null);
        }
      }
    }

    // effects timers
    this._updateVisualEffects(dt);
    this._saveT += dt;
    if (this._saveT >= 60) {
      this._saveT -= 60;
      this._save();
    }
    this.updateHUD();
  }

  draw(gfx) {
    gfx.clearRect(0, 0, W, H);
    gfx.save();
    const c = this.bossCinematic;
    const renderZoom = (this.gameState === GAME_STATE.BOSS_CINEMATIC && c) ? c.zoom : this.zoom;
    const renderCam = (this.gameState === GAME_STATE.BOSS_CINEMATIC && c) ? c.cam : this.cam;
    if (this.shakeT > 0) {
      const sx = (Math.random() * 2 - 1) * this.shakeMag;
      const sy = (Math.random() * 2 - 1) * this.shakeMag;
      gfx.translate(sx, sy);
    }
    gfx.translate(W * 0.5, H * 0.5);
    gfx.scale(renderZoom, renderZoom);
    gfx.translate(-W * 0.5 - renderCam.x, -H * 0.5 - renderCam.y);
    this.map.drawBase(gfx);

    if (this.corePulseT > 0) {
      const end = this.map.pathPts[this.map.pathPts.length - 1];
      if (end) {
        const k = 1 - clamp(this.corePulseT / 0.45, 0, 1);
        const r = 24 + k * 80;
        gfx.save();
        gfx.globalAlpha = 0.65 * (1 - k);
        gfx.strokeStyle = "rgba(98,242,255,0.85)";
        gfx.lineWidth = 3;
        gfx.beginPath();
        gfx.arc(end[0], end[1], r, 0, Math.PI * 2);
        gfx.stroke();
        gfx.globalAlpha = 0.25 * (1 - k);
        const grad = gfx.createRadialGradient(end[0], end[1], 0, end[0], end[1], r * 1.2);
        grad.addColorStop(0, "rgba(98,242,255,0.35)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        gfx.fillStyle = grad;
        gfx.beginPath();
        gfx.arc(end[0], end[1], r * 1.2, 0, Math.PI * 2);
        gfx.fill();
        gfx.restore();
      }
    }

    // hover highlight
    if (this.hoverCell && (this.hoverCell.v === 1 || this.hoverCell.v === 3)) {
      const x = this.hoverCell.gx * this.map.gridSize;
      const y = this.hoverCell.gy * this.map.gridSize;
      const pulse = 0.35 + 0.25 * Math.sin(performance.now() * 0.006 + x * 0.01 + y * 0.01);
      const corrupted = this._isCellCorrupted(this.hoverCell.gx, this.hoverCell.gy);
      gfx.save();
      const baseCol = corrupted
        ? "rgba(255,80,80,0.85)"
        : (this.hoverCell.v === 3 ? "rgba(255,207,91,0.55)" : "rgba(98,242,255,0.45)");
      gfx.strokeStyle = baseCol;
      if (corrupted) {
        gfx.fillStyle = `rgba(255,80,80,${0.12 + pulse * 0.14})`;
      } else {
        gfx.fillStyle = this.hoverCell.v === 3 ? `rgba(255,207,91,${0.08 + pulse * 0.08})` : `rgba(98,242,255,${0.05 + pulse * 0.06})`;
      }
      gfx.lineWidth = 2;
      gfx.fillRect(x + 2, y + 2, this.map.gridSize - 4, this.map.gridSize - 4);
      gfx.strokeRect(x + 2, y + 2, this.map.gridSize - 4, this.map.gridSize - 4);
      gfx.restore();
    }

    if (this.buildKey && this.hoverCell) {
      const cell = this.hoverCell;
      const inBounds = cell.gx >= 0 && cell.gy >= 0 && cell.gx < this.map.cols && cell.gy < this.map.rows;
      if (inBounds) {
        const buildValid = (cell.v === 1 || cell.v === 3)
          && !this.isCellOccupied(cell.gx, cell.gy)
          && !this._isCellCorrupted(cell.gx, cell.gy)
          && (cell.v !== 3 || this._isPowerTileUnlocked(cell.gx, cell.gy));
        const w = this.map.worldFromCell(cell.gx, cell.gy);
        const base = TURRET_TYPES[this.buildKey];
        const range = base ? base.range : 120;
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);

        // range preview
        gfx.save();
        gfx.globalAlpha = 1;
        gfx.strokeStyle = buildValid ? "rgba(98,242,255,0.25)" : "rgba(255,91,125,0.25)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.arc(w.x, w.y, range, 0, Math.PI * 2);
        gfx.stroke();
        gfx.restore();

        // ghost core + turret glyph preview (matches build icon style)
        gfx.save();
        gfx.globalAlpha = buildValid ? 0.55 : 0.45;
        gfx.fillStyle = buildValid ? "rgba(98,242,255,0.18)" : "rgba(255,91,125,0.18)";
        gfx.strokeStyle = buildValid ? "rgba(98,242,255,0.55)" : "rgba(255,91,125,0.65)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.arc(w.x, w.y, 14 + pulse * 1.5, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        gfx.restore();

        gfx.save();
        gfx.translate(w.x, w.y);
        gfx.globalAlpha = buildValid ? 0.82 : 0.7;
        gfx.fillStyle = buildValid ? "rgba(98,242,255,0.95)" : "rgba(255,91,125,0.92)";
        gfx.strokeStyle = gfx.fillStyle;
        gfx.lineWidth = 1.8;
        const s = 9;
        switch (this.buildKey) {
          case "PULSE":
          case "AURA":
            gfx.beginPath();
            gfx.arc(0, 0, s, 0, Math.PI * 2);
            gfx.stroke();
            break;
          case "ARC":
          case "DRONE":
            gfx.beginPath();
            gfx.moveTo(0, -s);
            gfx.lineTo(s, 0);
            gfx.lineTo(0, s);
            gfx.lineTo(-s, 0);
            gfx.closePath();
            gfx.stroke();
            break;
          case "FROST":
            gfx.beginPath();
            for (let i = 0; i < 8; i++) {
              const a = (Math.PI * 2 * i) / 8;
              const rr = (i % 2 === 0) ? s : s * 0.58;
              const x = Math.cos(a) * rr;
              const y = Math.sin(a) * rr;
              if (i === 0) gfx.moveTo(x, y);
              else gfx.lineTo(x, y);
            }
            gfx.closePath();
            gfx.stroke();
            break;
          case "LENS":
            gfx.beginPath();
            gfx.ellipse(0, 0, s + 1, s * 0.65, 0, 0, Math.PI * 2);
            gfx.stroke();
            break;
          case "MORTAR":
            gfx.beginPath();
            gfx.rect(-s, -s, s * 2, s * 2);
            gfx.stroke();
            break;
          case "VENOM":
            gfx.beginPath();
            gfx.moveTo(0, -s);
            gfx.lineTo(s * 0.72, -s * 0.35);
            gfx.lineTo(s * 0.88, s * 0.3);
            gfx.lineTo(0, s);
            gfx.lineTo(-s * 0.88, s * 0.3);
            gfx.lineTo(-s * 0.72, -s * 0.35);
            gfx.closePath();
            gfx.stroke();
            break;
          case "NEEDLE":
            gfx.beginPath();
            gfx.moveTo(s, 0);
            gfx.lineTo(-s, -s * 0.72);
            gfx.lineTo(-s, s * 0.72);
            gfx.closePath();
            gfx.fill();
            break;
          case "TRAP":
            gfx.beginPath();
            gfx.rect(-s, -s * 0.35, s * 2, s * 0.7);
            gfx.fill();
            break;
          default:
            gfx.beginPath();
            gfx.arc(0, 0, s * 0.8, 0, Math.PI * 2);
            gfx.stroke();
            break;
        }
        gfx.restore();

        if (!buildValid) {
          const x = cell.gx * this.map.gridSize;
          const y = cell.gy * this.map.gridSize;
          gfx.save();
          gfx.globalAlpha = 0.7 * pulse;
          gfx.strokeStyle = "rgba(255,91,125,0.85)";
          gfx.lineWidth = 2.5;
          gfx.strokeRect(x + 1.5, y + 1.5, this.map.gridSize - 3, this.map.gridSize - 3);
          gfx.restore();
        }
      }
    }

    // lingering zones
    for (const l of this.lingering) {
      gfx.save();
      gfx.globalAlpha = 0.4;
      gfx.fillStyle = l.col || "rgba(255,207,91,0.2)";
      gfx.beginPath(); gfx.arc(l.x, l.y, l.r, 0, Math.PI * 2); gfx.fill();
      gfx.restore();
    }

    // traps
    for (const tr of this.traps) {
      gfx.save();
      gfx.globalAlpha = 0.55;
      gfx.strokeStyle = "rgba(98,242,255,0.45)";
      gfx.lineWidth = 2;
      gfx.beginPath(); gfx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); gfx.stroke();
      gfx.restore();
    }

    // turrets
    for (const t of this.turrets) t.draw(gfx, t === this.selectedTurret, this);

    // enemies
    for (const e of this.enemies) e.draw(gfx, e === this.selectedEnemy);

    // projectiles
    for (const p of this.projectiles) p.draw(gfx);

    // floating combat text
    if (this.floatText.length) {
      gfx.save();
      if (!this._combatTextFont) {
        this._combatTextFont = "800 14px " + getComputedStyle(document.body).fontFamily;
      }
      gfx.font = this._combatTextFont;
      gfx.textAlign = "center";
      for (const ft of this.floatText) {
        const a = clamp(ft.t / ft.ttl, 0, 1);
        gfx.globalAlpha = a;
        gfx.lineWidth = 3;
        gfx.strokeStyle = "rgba(4,8,18,0.65)";
        gfx.strokeText(ft.text, ft.x, ft.y);
        gfx.fillStyle = ft.color;
        gfx.fillText(ft.text, ft.x, ft.y);
      }
      gfx.restore();
    }

    // cones
    for (const c of this.cones) {
      gfx.save();
      const coneLife = clamp(c.t / 0.26, 0, 1);
      const pulse = 0.85 + 0.15 * Math.sin(performance.now() * 0.02 + c.x * 0.01 + c.y * 0.01);
      gfx.globalAlpha = 0.28 * coneLife * pulse + 0.18;
      const g = gfx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, "rgba(210,245,255,0.85)");
      g.addColorStop(0.45, "rgba(160,220,255,0.55)");
      g.addColorStop(1, "rgba(120,190,255,0.08)");
      gfx.fillStyle = g;
      gfx.beginPath();
      gfx.moveTo(c.x, c.y);
      gfx.arc(c.x, c.y, c.r, c.ang - c.cone / 2, c.ang + c.cone / 2);
      gfx.closePath();
      gfx.fill();
      gfx.globalAlpha = 0.9 * coneLife;
      gfx.strokeStyle = "rgba(225,245,255,0.98)";
      gfx.lineWidth = 1.8;
      gfx.beginPath();
      gfx.arc(c.x, c.y, c.r, c.ang - c.cone / 2, c.ang + c.cone / 2);
      gfx.stroke();
      gfx.globalAlpha = 0.55 * coneLife;
      gfx.strokeStyle = "rgba(150,210,255,0.92)";
      gfx.lineWidth = 1.2;
      gfx.beginPath();
      gfx.arc(c.x, c.y, c.r * 0.62, c.ang - c.cone / 2, c.ang + c.cone / 2);
      gfx.stroke();
      gfx.restore();
    }

    // arcs
    for (const a of this.arcs) {
      gfx.save();
      gfx.globalAlpha = 0.92;
      gfx.strokeStyle = "rgba(186,140,255,0.98)";
      gfx.lineWidth = 2.8;
      gfx.beginPath();
      gfx.moveTo(a.ax, a.ay);
      gfx.lineTo(a.bx, a.by);
      gfx.stroke();

      // faint branching
      gfx.globalAlpha = 0.56;
      gfx.lineWidth = 1.8;
      const mx = (a.ax + a.bx) * 0.5 + rand(-14, 14);
      const my = (a.ay + a.by) * 0.5 + rand(-14, 14);
      gfx.beginPath();
      gfx.moveTo(a.ax, a.ay);
      gfx.quadraticCurveTo(mx, my, a.bx, a.by);
      gfx.stroke();
      gfx.restore();
    }

    // beams (multi-pass heat distortion)
    for (const b of this.beams) {
      gfx.save();
      gfx.globalAlpha = 0.18;
      gfx.strokeStyle = b.col || "rgba(98,242,255,0.85)";
      gfx.lineWidth = 9;
      gfx.beginPath();
      gfx.moveTo(b.ax, b.ay);
      gfx.lineTo(b.bx, b.by);
      gfx.stroke();
      gfx.restore();
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 1.6;
        const jx = rand(-0.6, 0.6);
        const jy = rand(-0.6, 0.6);
        gfx.save();
        gfx.globalAlpha = i === 0 ? 0.75 : (i === 1 ? 0.45 : 0.25);
        gfx.strokeStyle = b.col || "rgba(98,242,255,0.85)";
        gfx.lineWidth = i === 0 ? 2.6 : 1.8;
        gfx.beginPath();
        gfx.moveTo(b.ax + off + jx, b.ay + off + jy);
        gfx.lineTo(b.bx + off + jx, b.by + off + jy);
        gfx.stroke();
        gfx.restore();
      }
    }

    // explosions
    for (const ex of this.explosions) {
      const k = 1 - Math.max(0, ex.t) / (ex.dur || 0.28);
      const r = ex.r + (ex.max - ex.r) * k;
      gfx.save();
      if (ex.boom) {
        gfx.globalAlpha = 0.9 * (1 - k);
        const grad = gfx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
        grad.addColorStop(0, "rgba(255,207,91,0.9)");
        grad.addColorStop(0.4, "rgba(255,91,125,0.6)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        gfx.fillStyle = grad;
        gfx.beginPath();
        gfx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        gfx.fill();
        gfx.globalAlpha = 0.55 * (1 - k);
        gfx.strokeStyle = ex.col;
        gfx.lineWidth = 2.5;
        gfx.beginPath();
        gfx.arc(ex.x, ex.y, r * 0.9, 0, Math.PI * 2);
        gfx.stroke();
      } else {
        gfx.globalAlpha = 0.55 * (1 - k);
        gfx.strokeStyle = ex.col;
        gfx.lineWidth = 3;
        gfx.beginPath();
        gfx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
        gfx.stroke();
      }
      gfx.restore();
    }

    // impact decals
    for (const d of this.decals) {
      gfx.save();
      const a = clamp(d.t / 2.6, 0, 1);
      gfx.globalAlpha = 0.25 * a;
      gfx.fillStyle = d.col;
      gfx.beginPath();
      gfx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      gfx.fill();
      gfx.restore();
    }

    this.particles.draw(gfx);

    if (this.paused && !this.gameOver && !this.gameWon) {
      gfx.save();
      gfx.fillStyle = "rgba(0,0,0,0.35)";
      gfx.fillRect(0, 0, W, H);
      gfx.fillStyle = "rgba(234,240,255,0.9)";
      gfx.font = "700 28px sans-serif";
      gfx.textAlign = "center";
      gfx.fillText("PAUSED", W / 2, H / 2);
      gfx.restore();
    }
    if (this.damageFlash > 0) {
      gfx.save();
      gfx.globalAlpha = this.damageFlash * 0.35;
      gfx.fillStyle = "rgba(255,91,125,0.85)";
      gfx.fillRect(0, 0, W, H);
      gfx.restore();
    }
    gfx.restore();

    if (this.gameState === GAME_STATE.BOSS_CINEMATIC && c) {
      gfx.save();
      gfx.globalAlpha = c.fade;
      gfx.fillStyle = "rgba(3,6,14,0.98)";
      gfx.fillRect(0, 0, W, H);
      if (c.phase === "reveal") {
        gfx.globalAlpha = clamp(1 - c.fade * 0.25, 0.65, 1);
        gfx.fillStyle = "rgba(234,240,255,0.96)";
        gfx.font = "700 34px " + getComputedStyle(document.body).fontFamily;
        gfx.textAlign = "center";
        gfx.textBaseline = "middle";
        gfx.fillText(`LEVEL ${c.nextLevel || this.levelIndex}`, W * 0.5, H * 0.5);
      }
      gfx.restore();
    }
  }
}

// Boot
resize();
const game = new Game();
window.game = game; // handy for debugging
window._orbitEchoSelfTest = () => {
  const g = window.game;
  if (!g) {
    console.warn("Self-test: game not initialized.");
    return;
  }

  console.assert(g.audio?.enabled === true, "Audio default should be ON.");

  const prevWave = g.wave;
  g.wave = 1;
  console.assert(!g.isTowerUnlocked("AURA"), "AURA locked before wave 15.");
  console.assert(!g.isTowerUnlocked("TRAP"), "TRAP locked before wave 15.");
  g.wave = 15;
  console.assert(g.isTowerUnlocked("AURA"), "AURA unlocks at wave 15.");
  console.assert(g.isTowerUnlocked("TRAP"), "TRAP unlocks at wave 15.");
  g.wave = prevWave;

  const idx = g.map.cells.findIndex(v => v === 1 || v === 3);
  if (idx >= 0) {
    const gx = idx % g.map.cols;
    const gy = (idx / g.map.cols) | 0;
    const w = g.map.worldFromCell(gx, gy);

    g.setBuildMode("PULSE");
    const countBefore = g.turrets.length;
    g.onClick(w.x, w.y);
    console.assert(g.buildKey === "PULSE", "Build mode should persist after placement.");
    console.assert(g.turrets.length === countBefore + 1, "Turret should be placed in build mode.");

    g.paused = true;
    const countPaused = g.turrets.length;
    g.onClick(w.x, w.y);
    console.assert(g.turrets.length === countPaused, "Building should be blocked while paused.");
    g.paused = false;
    g.clearBuildMode();
  } else {
    console.warn("Self-test: no buildable cell found.");
  }

  g._resetWaveStats();
  g._openWaveStats();
  console.assert(g.statsOpen === true, "Stats overlay should open.");
  g._closeWaveStats("continue");
  console.assert(g.statsOpen === false, "Stats overlay should close.");
};
game.onResize();
window.addEventListener("resize", () => {
  resize();
  game.onResize();
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  try {
    game.update(dt);
    game.draw(ctx);
  } catch (err) {
    game._reportRuntimeError?.("frame.loop", err);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);









