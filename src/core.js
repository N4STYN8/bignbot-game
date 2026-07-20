import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, musicHud, musicPrevBtn, musicPlayBtn, musicNextBtn, musicRepeatBtn, musicShuffleBtn, musicBack10Btn, musicForward10Btn, musicMuteBtn, musicHudVol, musicTrackName, musicElapsed, musicDuration, musicProgress, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";
import { AudioSystem } from "./audio.js?v=202606082258";
// CODEX CHANGE: Refresh map rendering for music-driven color alternation.
import { Map } from "./map.js?v=202607201932";
import { DAMAGE, ANOMALIES, ENEMY_TYPES, Enemy, ENEMY_RENDER_CONFIG, getEnemyVfxScale } from "./enemies.js?v=202606082258";
import { Particles } from "./vfx.js?v=202606082258";
import { Projectile } from "./projectiles.js?v=202606082258";
// CODEX CHANGE: Refresh the turret module for the new five-level turret sprite sets.
// CODEX CHANGE: Refresh turret integration after adding the Gravity Trap sprite progression.
import { TURRET_TYPES, Turret } from "./turrets.js?v=202607192225";
// CODEX CHANGE: Refresh visualizer controls for independent V-mode and C-color cycling.
import { MusicVisualizer } from "./visualization.js?v=202607201907";
// CODEX CHANGE: Add one reusable canvas waveform for the currently selected turret.
import { SelectedTurretWaveform } from "./selectedTurretWaveform.js?v=202607171200";
// CODEX CHANGE: Add a second reusable music ribbon around the outside of the turret HUD.
import { HudOuterWaveform } from "./hudOuterWaveform.js?v=202607171400";
import { COMBAT_EVENT_TYPES, createCombatEvent, emitCombatEvent } from "./combatEvents.js?v=202606082258";
import { createDefaultSynergyRegistry } from "./synergies.js?v=202606082258";
import { STATUS, setStatusState } from "./statusEffects.js?v=202606082258";

// CODEX CHANGE: Echo Cascade tuning knobs and lightweight HUD/FX references.
const comboCascadeEl = document.getElementById("comboCascade");
const comboCascadeCountEl = document.getElementById("comboCascadeCount");
const comboCascadeBonusEl = document.getElementById("comboCascadeBonus");
const screenFxEl = document.querySelector(".screenFx");
const visualModeLabelEl = document.getElementById("visualModeLabel");
const enemySpritesToggleEl = document.getElementById("enemySpritesToggle");
const vfxIntensitySelectEl = document.getElementById("vfxIntensitySelect");
const musicVisualsToggleEl = document.getElementById("musicVisualsToggle");
const turretHudOuterWaveEl = document.getElementById("turretHudOuterWave");
const leaderboardBtnEl = document.getElementById("leaderboardBtn");
const leaderboardModalEl = document.getElementById("leaderboardModal");
const leaderboardCloseEl = document.getElementById("leaderboardClose");
const leaderboardBodyEl = document.getElementById("leaderboardBody");
const objectivePillEl = document.getElementById("objectivePill");
const objectiveLabelEl = document.getElementById("objectiveLabel");
const mapFeaturePillEl = document.getElementById("mapFeaturePill");
const mapFeatureLabelEl = document.getElementById("mapFeatureLabel");
const powerTokenCountEl = document.getElementById("powerTokenCount");
const abilityScanRankEl = document.getElementById("abilityScanRank");
const abilityPulseRankEl = document.getElementById("abilityPulseRank");
const abilityOverRankEl = document.getElementById("abilityOverRank");
const abilityUpgradeBtns = [...document.querySelectorAll("[data-upgrade-ability]")];
const landingLeaderboardBtnEl = document.getElementById("landingLeaderboardBtn");
const landingPilotStatusEl = document.getElementById("landingPilotStatus");
const tutorialModalEl = document.getElementById("tutorialModal");
const tutorialTitleEl = document.getElementById("tutorialTitle");
const tutorialStepEl = document.getElementById("tutorialStep");
const tutorialBodyEl = document.getElementById("tutorialBody");
const tutorialOkEl = document.getElementById("tutorialOk");
const tutorialSpotlightEl = document.getElementById("tutorialSpotlight");
const tutorialCardEl = tutorialModalEl?.querySelector(".tutorialCard");
// CODEX CHANGE: Desktop controls remain optional so the same modules still run on the live website.
const desktopBridge = window.orbitEchoDesktop || null;
const desktopControlsEl = document.getElementById("desktopControls");
const desktopSaveBtnEl = document.getElementById("desktopSaveBtn");
const desktopFullscreenBtnEl = document.getElementById("desktopFullscreenBtn");
const desktopExitBtnEl = document.getElementById("desktopExitBtn");
const VISUAL_SETTINGS_KEY = "orbit_echo_visual_settings_v1";
const PROFILE_KEY = "orbit_echo_profile_v1";
const LEADERBOARD_KEY = "orbit_echo_leaderboard_v1";
const NEW_PLAYER_TIPS_KEY = "orbit_echo_new_player_tips_v1";
const LEADERBOARD_API_BASE = String(window.ORBIT_ECHO_LEADERBOARD_API || "").replace(/\/+$/, "");
const TURRET_HOTKEY_KEYS = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"];
const TURRET_BUILD_HOTKEYS = Object.fromEntries(
  Object.keys(TURRET_TYPES).map((key, i) => [key, TURRET_HOTKEY_KEYS[i] || ""])
);
const TURRET_KEY_TO_BUILD = Object.fromEntries(
  Object.entries(TURRET_BUILD_HOTKEYS)
    .filter(([, hotkey]) => hotkey)
    .map(([key, hotkey]) => [hotkey.toLowerCase(), key])
);
const formatMusicTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};
const ECHO_CASCADE_WINDOW_TIERS = [
  { min: 24, sec: 0.86 },
  { min: 16, sec: 1.02 },
  { min: 9, sec: 1.22 },
  { min: 4, sec: 1.45 },
  { min: 1, sec: 1.75 }
];
const ECHO_CASCADE_GOLD_TIERS = [
  { min: 24, mult: 1.20 },
  { min: 18, mult: 1.16 },
  { min: 12, mult: 1.11 },
  { min: 8, mult: 1.07 },
  { min: 4, mult: 1.03 },
  { min: 0, mult: 1.0 }
];
const ECHO_CASCADE_FADE_SECS = 0.45;
const ECHO_CASCADE_PULSE_SHAKE_T = 0.02;
const ECHO_CASCADE_PULSE_SHAKE_MAG = 0.35;
const NEW_PLAYER_WAVE_TIPS = {
  1: "Tip: Build on glowing square tiles before enemies reach the core path.",
  2: "Tip: Upgrade a turret by selecting it; each tier changes how it fights.",
  3: "Tip: Power tiles boost damage, range, and fire rate once unlocked.",
  4: "Tip: Press 1, 2, or 3 for abilities when a wave starts getting heavy.",
  // CODEX CHANGE: Teach both music-visual keyboard controls in the rotating tips.
  5: "Tip: Press V for visual styles and C for color palettes."
};
const FIRST_WAVE_TUTORIAL = [
  {
    title: "Build The Defence",
    body: "Start with Pulse Spindle. Select it here, then click a glowing build tile beside the track. Pulse Spindle has a high placement cap; specialist turrets have tighter caps.",
    target: ".buildItem[data-key=\"PULSE\"]",
    placement: "right"
  },
  {
    title: "Hold The Path",
    body: "Enemies follow the bright track across the battlefield toward your core. Place turrets beside the path. Corrupted red tiles must be cleansed before building.",
    targetType: "path",
    placement: "right"
  },
  {
    title: "Abilities And Music",
    // CODEX CHANGE: Include independent C-key color cycling in the keyboard tutorial.
    body: "Use 1, 2, and 3 for EMP Pulse, Pulse Burst, and Overcharge. Press V to cycle visualization styles and C to cycle their color palettes.",
    target: "#abilitiesBar",
    placement: "top"
  },
  {
    title: "Power Tiles",
    body: "Locked gold power tiles can be purchased. Turrets placed on an unlocked power tile receive boosted damage, range, and fire rate.",
    targetType: "powerTile",
    placement: "right"
  },
  {
    title: "Save Your Pilot",
    body: "Open Pilot / Leaderboard to create a username and password. Your pilot profile records leaderboard progress. Your current run also saves automatically so Load Saved Game can continue it later.",
    target: "#leaderboardBtn",
    placement: "bottom"
  },
  {
    title: "Launch Wave One",
    body: "You are ready. Press START when your first defences are placed. The tutorial will close now so you can build before launching the wave.",
    target: "#startBtn",
    placement: "bottom"
  }
];
const TURRET_BUILD_LIMITS = {
  PULSE: 25,
  ARC: 5,
  FROST: 5,
  LENS: 5,
  MORTAR: 4,
  VENOM: 5,
  NEEDLE: 4,
  AURA: 3,
  DRONE: 3,
  TRAP: 5
};
const LEVEL_PROFILES = [
  {
    name: "Baseline",
    hp: 1,
    spd: 1,
    armor: 1,
    shield: 1,
    regen: 1,
    count: 1,
    spacing: 1,
    weights: {}
  },
  {
    name: "Swarm",
    hp: 0.94,
    spd: 1.08,
    armor: 0.92,
    shield: 0.96,
    regen: 1,
    count: 1.10,
    spacing: 0.93,
    weights: { RUNNER: 1.35, SPLITTER: 1.28, PHASE: 1.18, STEALTH: 1.10 }
  },
  {
    name: "Bulwark",
    hp: 1.08,
    spd: 0.96,
    armor: 1.18,
    shield: 1.02,
    regen: 1.06,
    count: 0.96,
    spacing: 1.08,
    weights: { BRUTE: 1.28, ARMORED: 1.36, REGEN: 1.15, BOSS_PROJECTOR: 1.10 }
  },
  {
    name: "Prism",
    hp: 1,
    spd: 1,
    armor: 0.96,
    shield: 1.22,
    regen: 1.02,
    count: 1,
    spacing: 1,
    weights: { SHIELDED: 1.36, SHIELD_DRONE: 1.34, FLYING: 1.18 }
  },
  {
    name: "Veil",
    hp: 0.97,
    spd: 1.05,
    armor: 0.94,
    shield: 1.02,
    regen: 1,
    count: 1.04,
    spacing: 0.97,
    weights: { STEALTH: 1.38, PHASE: 1.32, FLYING: 1.16, RUNNER: 1.10 }
  }
];
const LEVEL_OBJECTIVES = [
  {
    key: "CORE_INTEGRITY",
    name: "Core Integrity",
    desc: "Finish the level with no more than 2 leaks.",
    reward: (level) => 120 + level * 18
  },
  {
    key: "TIMED_ASSAULT",
    name: "Timed Assault",
    desc: "Clear the level before the assault timer expires.",
    reward: (level) => 145 + level * 20
  },
  {
    key: "PRIORITY_HUNT",
    name: "Priority Hunt",
    desc: "Destroy marked priority targets before they escape.",
    reward: (level) => 135 + level * 19
  },
  {
    key: "BOSS_INTERCEPT",
    name: "Boss Intercept",
    desc: "Destroy every boss before it crosses the checkpoint.",
    reward: (level) => 165 + level * 22
  }
];
const OBJECTIVE_TOOLTIP_DETAILS = {
  CORE_INTEGRITY: "Keep enemies from leaking through the end of the track. If more than 2 enemies reach your core, this bonus is missed.",
  TIMED_ASSAULT: "Clear all waves and defeat the level boss before the timer runs out. Faster clears earn the bonus.",
  PRIORITY_HUNT: "Some enemies become priority targets. Kill every marked target before it escapes to earn the bonus.",
  BOSS_INTERCEPT: "Mini bosses and the final boss must be defeated before crossing the checkpoint. Letting a boss pass misses the bonus."
};
const ANOMALY_TOOLTIP_DETAILS = {
  LOW_GRAVITY: "Your non-mortar projectiles travel faster and pierce more enemies, so straight-line and bullet towers get stronger during this wave.",
  ION_STORM: "Enemies gain stronger shields, but your energy damage also gets boosted. Arc, Frost, and Lens towers become more valuable.",
  CRYO_LEAK: "Slow effects become stronger, while damage-over-time lasts less time. Frost/control builds get better and poison burns out faster.",
  WARP_RIPPLE: "Every few seconds, two ground enemies blink forward on the path. Spread damage along the lane so surprise jumps do not leak."
};
const FEATURE_TOOLTIP_DETAILS = {
  AMPLIFIER_NODES: "Cyan build nodes are premium tower spots. A turret placed on one gains extra damage and range for the whole level.",
  CRYO_PATCHES: "Blue path patches slow ground enemies while they travel through them. Build near these zones to get more firing time.",
  SALVAGE_RELAYS: "Gold relay zones reward kills. Enemies destroyed inside these zones pay bonus gold, so towers nearby improve your economy.",
  PHASE_LANES: "Violet path patches speed enemies up. These are danger zones where you may need slows, burst damage, or extra coverage."
};

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

function comboRankForCount(count) {
  const c = Math.max(0, count | 0);
  if (c >= 24) return "OVERCLOCK";
  if (c >= 18) return "SURGE";
  if (c >= 12) return "CHAIN";
  if (c >= 8) return "RAMP";
  if (c >= 4) return "LINK";
  return "START";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[ch]));
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
    this.musicVisualizer = new MusicVisualizer({
      label: visualModeLabelEl,
      audioSystem: this.audio
    });
    // CODEX CHANGE: Allocate the selected-turret waveform once and reuse it for every turret.
    this.selectedTurretWaveform = new SelectedTurretWaveform();
    this.hudOuterWaveform = new HudOuterWaveform(turretHudOuterWaveEl);
    this._selectedWaveformOptions = { disabled: false, vfx: "med", enemyCount: 0, boss: false, zoom: 1 };
    this.musicVisualizer.setLevelTheme(this.levelIndex, this.mapSeed);
    this.musicVisualizer.start();
    this._initCollections();
    this._initRuntimeState();
    this._loadVisualSettings();
    this._applyVisualSettings();
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
    this.screenFlashes = [];
    this.delayedEnemyFx = [];
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
    this.disruptionClouds = [];
    this.disruptionShots = [];
    this.combatEvents = [];
    this.combatEventSeq = 0;
    this.synergies = createDefaultSynergyRegistry();
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
    // CODEX CHANGE: Cache floating HUD geometry so camera dragging only performs compositor updates.
    this._turretHudMetrics = null;
    this._turretHudLastTransform = null;
    this._turretHudLastCone = null;
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
    this.finalBossDefeated = false;
    this.abilities = {
      scan: { cd: ABILITY_COOLDOWN, t: 0 },
      pulse: { cd: ABILITY_COOLDOWN, t: 0 },
      overcharge: { cd: OVERCHARGE_COOLDOWN, t: 0 }
    };
    this.abilityPowerTokens = 0;
    this.abilityUpgrades = { scan: 0, pulse: 0, overcharge: 0 };
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
    this.playerProfile = null;
    this.leaderboard = [];
    this.selectedLeaderboardPilotId = "";
    this._playRecordedThisSession = false;
    this.newPlayerTipsSeen = this._loadNewPlayerTipsSeen();
    this.firstWaveTutorialShown = false;
    this.tutorialOpen = false;
    this._tutorialQueue = [];
    this._tutorialIndex = 0;
    this._tutorialExpandedBuildPanel = false;
    this.globalOverchargeT = 0;
    this.levelObjective = this._createLevelObjective();
    this._transitioning = false;
    this.gameState = GAME_STATE.GAMEPLAY;
    this.menuOpen = false;
    this.bossCinematic = null;
    this.buildKey = null;
    this.selectedTurret = null;
    // CODEX CHANGE: A fresh run cannot retain the previous selected-head waveform.
    this.selectedTurretWaveform?.clear(true);
    this.hudOuterWaveform?.clear(true);
    this.selectedEnemy = null;
    this.selectedTileCell = null;
    this.hoverCell = null;
    this.mouse = { x: 0, y: 0 };
    this._id = 1;
    this.collapseEnabled = false;
    this.panelHold = { left: 0, right: 0 };
    this._lastRuntimeErrAt = 0;
    this.panelHover = { left: false, right: false };
    this.visualSettings = { enemySprites: true, vfxIntensity: "med", musicVisualizations: true };
    this._loadLeaderboardState();
  }

  _sanitizeVfxIntensity(v) {
    return v === "low" || v === "high" ? v : "med";
  }

  _loadVisualSettings() {
    try {
      const raw = localStorage.getItem(VISUAL_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this.visualSettings.enemySprites = parsed?.enemySprites !== false;
      this.visualSettings.vfxIntensity = this._sanitizeVfxIntensity(parsed?.vfxIntensity);
      this.visualSettings.musicVisualizations = parsed?.musicVisualizations !== false;
    } catch (err) {
      this.visualSettings.enemySprites = true;
      this.visualSettings.vfxIntensity = "med";
      this.visualSettings.musicVisualizations = true;
    }
  }

  _saveVisualSettings() {
    try {
      localStorage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify({
        enemySprites: this.visualSettings.enemySprites !== false,
        vfxIntensity: this._sanitizeVfxIntensity(this.visualSettings.vfxIntensity),
        musicVisualizations: this.visualSettings.musicVisualizations !== false
      }));
    } catch (err) {}
  }

  _applyVisualSettings() {
    ENEMY_RENDER_CONFIG.useSprites = this.visualSettings.enemySprites !== false;
    ENEMY_RENDER_CONFIG.vfxIntensity = this._sanitizeVfxIntensity(this.visualSettings.vfxIntensity);
  }

  _syncVisualSettingsUi() {
    if (enemySpritesToggleEl) enemySpritesToggleEl.checked = this.visualSettings.enemySprites !== false;
    if (vfxIntensitySelectEl) vfxIntensitySelectEl.value = this._sanitizeVfxIntensity(this.visualSettings.vfxIntensity);
    if (musicVisualsToggleEl) musicVisualsToggleEl.checked = this.visualSettings.musicVisualizations !== false;
  }

  // CODEX CHANGE: Feed one reusable waveform with selection, music, combat load, and visual settings.
  _updateSelectedTurretWaveform(dt) {
    const waveform = this.selectedTurretWaveform;
    if (!waveform) return;
    const selected = this.selectedTurret;
    if (selected && !this.turrets.includes(selected)) {
      waveform.clear(true);
      this.hudOuterWaveform?.clear(true);
      return;
    }
    let enemyCount = 0;
    let boss = false;
    for (const enemy of this.enemies) {
      if (!enemy || enemy.hp <= 0) continue;
      enemyCount += 1;
      if (enemy.isBoss || enemy.isMiniBoss || enemy.isFinalBoss) boss = true;
    }
    const options = this._selectedWaveformOptions;
    options.disabled = this.visualSettings.musicVisualizations === false
      || this.musicVisualizer?.enabled === false
      || document.documentElement.dataset.visualizationsDisabled === "true"
      || document.body.classList.contains("visualizations-disabled");
    options.vfx = this._sanitizeVfxIntensity(this.visualSettings.vfxIntensity);
    options.enemyCount = enemyCount;
    options.boss = boss;
    // CODEX CHANGE: Let both selected-turret visualizers grow as the battlefield camera zooms out.
    options.zoom = this.zoom;
    waveform.update(dt, selected || null, this.musicVisualizer, options);
    this.hudOuterWaveform?.update(dt, selected || null, this.musicVisualizer, options);
  }

  // CODEX CHANGE: Briefly brighten the selected waveform on its attacks and on enemy kills.
  onCombatEvent(event) {
    this.selectedTurretWaveform?.onCombatEvent(event, this.selectedTurret);
    this.hudOuterWaveform?.onCombatEvent(event, this.selectedTurret);
  }

  _loadNewPlayerTipsSeen() {
    try {
      const parsed = JSON.parse(localStorage.getItem(NEW_PLAYER_TIPS_KEY) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : []);
    } catch (err) {
      return new Set();
    }
  }

  _saveNewPlayerTipsSeen() {
    try {
      localStorage.setItem(NEW_PLAYER_TIPS_KEY, JSON.stringify([...this.newPlayerTipsSeen].slice(0, 12)));
    } catch (err) {}
  }

  _showNewPlayerWaveTip(wave) {
    const tip = NEW_PLAYER_WAVE_TIPS[wave];
    if (!tip || this.newPlayerTipsSeen.has(wave)) return;
    this.newPlayerTipsSeen.add(wave);
    this._saveNewPlayerTipsSeen();
    setTimeout(() => toast(tip), 1150);
  }

  _startFirstWaveTutorial() {
    if (this.firstWaveTutorialShown || this.levelIndex > 1 || this.wave > 1 || !tutorialModalEl) return;
    this.firstWaveTutorialShown = true;
    this.tutorialOpen = true;
    if (leftPanel?.classList.contains("collapsed")) {
      leftPanel.classList.remove("collapsed");
      this._tutorialExpandedBuildPanel = true;
    }
    this._tutorialQueue = FIRST_WAVE_TUTORIAL.slice();
    this._tutorialIndex = 0;
    this._renderTutorialStep();
  }

  _renderTutorialStep() {
    const step = this._tutorialQueue[this._tutorialIndex];
    if (!step) {
      this._closeTutorial();
      return;
    }
    if (tutorialTitleEl) tutorialTitleEl.textContent = step.title;
    if (tutorialStepEl) tutorialStepEl.textContent = `${this._tutorialIndex + 1} / ${this._tutorialQueue.length}`;
    if (tutorialBodyEl) tutorialBodyEl.textContent = step.body;
    if (tutorialOkEl) tutorialOkEl.textContent = this._tutorialIndex === this._tutorialQueue.length - 1 ? "Enter Battle" : "OK";
    tutorialModalEl.dataset.placement = step.placement || "center";
    tutorialModalEl.classList.remove("hidden");
    tutorialModalEl.setAttribute("aria-hidden", "false");
    this._positionTutorialSpotlight();
  }

  _positionTutorialSpotlight() {
    if (!tutorialSpotlightEl || !tutorialCardEl || !this.tutorialOpen) return;
    const step = this._tutorialQueue[this._tutorialIndex];
    const rect = this._tutorialTargetRect(step);
    if (!rect) {
      tutorialSpotlightEl.classList.add("hidden");
      return;
    }
    const pad = step?.targetType ? 10 : 8;
    const left = Math.max(4, rect.left - pad);
    const top = Math.max(4, rect.top - pad);
    const width = Math.max(20, Math.min(window.innerWidth - left - 4, rect.width + pad * 2));
    const height = Math.max(20, Math.min(window.innerHeight - top - 4, rect.height + pad * 2));
    tutorialSpotlightEl.style.left = `${left}px`;
    tutorialSpotlightEl.style.top = `${top}px`;
    tutorialSpotlightEl.style.width = `${width}px`;
    tutorialSpotlightEl.style.height = `${height}px`;
    tutorialSpotlightEl.classList.remove("hidden");
    this._positionTutorialCard({ left, top, width, height }, step?.placement);
  }

  _tutorialTargetRect(step) {
    if (step?.targetType === "powerTile") {
      const idx = this.map?.powerCells?.[0];
      if (!Number.isFinite(idx)) return null;
      const gx = idx % this.map.cols;
      const gy = Math.floor(idx / this.map.cols);
      return this._tutorialWorldRect(gx, gy, 1, 1);
    }
    if (step?.targetType === "path") {
      const points = this.map?.pathPts || [];
      if (!points.length) return null;
      const point = points[Math.min(points.length - 1, Math.max(0, Math.floor(points.length * 0.35)))];
      const gx = Math.floor(point[0] / this.map.gridSize);
      const gy = Math.floor(point[1] / this.map.gridSize);
      return this._tutorialWorldRect(gx - 1, gy - 1, 3, 3);
    }
    return step?.target ? document.querySelector(step.target)?.getBoundingClientRect() : null;
  }

  _tutorialWorldRect(gx, gy, cellsWide = 1, cellsHigh = 1) {
    const topLeft = this.worldToScreen(gx * this.map.gridSize, gy * this.map.gridSize);
    const bottomRight = this.worldToScreen((gx + cellsWide) * this.map.gridSize, (gy + cellsHigh) * this.map.gridSize);
    const canvasRect = canvas.getBoundingClientRect();
    return {
      left: canvasRect.left + Math.min(topLeft.x, bottomRight.x),
      top: canvasRect.top + Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y)
    };
  }

  _positionTutorialCard(spotlight, preferred = "right") {
    const margin = 16;
    const gap = 18;
    const cardWidth = Math.min(440, Math.max(280, window.innerWidth - margin * 2));
    tutorialCardEl.style.width = `${cardWidth}px`;
    const cardHeight = tutorialCardEl.offsetHeight || 170;
    const candidates = {
      right: { left: spotlight.left + spotlight.width + gap, top: spotlight.top + spotlight.height * 0.5 - cardHeight * 0.5 },
      left: { left: spotlight.left - cardWidth - gap, top: spotlight.top + spotlight.height * 0.5 - cardHeight * 0.5 },
      bottom: { left: spotlight.left + spotlight.width * 0.5 - cardWidth * 0.5, top: spotlight.top + spotlight.height + gap },
      top: { left: spotlight.left + spotlight.width * 0.5 - cardWidth * 0.5, top: spotlight.top - cardHeight - gap }
    };
    const order = [preferred, "right", "left", "bottom", "top"].filter((value, index, values) => values.indexOf(value) === index);
    const fits = (pos) => pos.left >= margin
      && pos.top >= margin
      && pos.left + cardWidth <= window.innerWidth - margin
      && pos.top + cardHeight <= window.innerHeight - margin;
    const clampCandidate = (pos) => ({
      left: clamp(pos.left, margin, Math.max(margin, window.innerWidth - cardWidth - margin)),
      top: clamp(pos.top, margin, Math.max(margin, window.innerHeight - cardHeight - margin))
    });
    const overlapArea = (pos) => {
      const overlapW = Math.max(0, Math.min(pos.left + cardWidth, spotlight.left + spotlight.width) - Math.max(pos.left, spotlight.left));
      const overlapH = Math.max(0, Math.min(pos.top + cardHeight, spotlight.top + spotlight.height) - Math.max(pos.top, spotlight.top));
      return overlapW * overlapH;
    };
    const selected = order.map((key) => candidates[key]).find(fits)
      || order.map((key) => clampCandidate(candidates[key])).sort((a, b) => overlapArea(a) - overlapArea(b))[0]
      || clampCandidate(candidates.right);
    tutorialCardEl.style.left = `${selected.left}px`;
    tutorialCardEl.style.top = `${selected.top}px`;
  }

  _advanceTutorial() {
    if (!this.tutorialOpen) return;
    this._tutorialIndex++;
    this._renderTutorialStep();
  }

  _closeTutorial() {
    tutorialModalEl?.classList.add("hidden");
    tutorialModalEl?.setAttribute("aria-hidden", "true");
    tutorialSpotlightEl?.classList.add("hidden");
    tutorialSpotlightEl?.removeAttribute("style");
    tutorialCardEl?.removeAttribute("style");
    tutorialModalEl?.removeAttribute("data-placement");
    this.tutorialOpen = false;
    this._tutorialQueue = [];
    this._tutorialIndex = 0;
    if (this._tutorialExpandedBuildPanel && leftPanel && !leftPanel.classList.contains("pinned") && !this.buildKey) {
      leftPanel.classList.add("collapsed");
    }
    this._tutorialExpandedBuildPanel = false;
    this.updateHUD();
  }

  _syncMusicHud() {
    if (!this.audio) return;
    this._syncMusicHudGeometry();
    const bgm = this.audio.bgm;
    const vol = String(Math.round((this.audio.bgm?.volume ?? 0.32) * 100));
    if (musicTrackName) musicTrackName.textContent = this.audio.currentTrackName();
    if (musicPlayBtn) {
      const icon = musicPlayBtn.querySelector(".material-symbols-rounded");
      if (icon) icon.textContent = this.audio.isMusicPlaying() ? "pause" : "play_arrow";
      musicPlayBtn.title = this.audio.isMusicPlaying() ? "Pause" : "Play";
    }
    if (musicShuffleBtn) {
      musicShuffleBtn.classList.toggle("active", !!this.audio.shuffle);
      musicShuffleBtn.setAttribute("aria-pressed", this.audio.shuffle ? "true" : "false");
    }
    if (musicRepeatBtn) {
      musicRepeatBtn.classList.toggle("active", !!this.audio.repeat);
      musicRepeatBtn.setAttribute("aria-pressed", this.audio.repeat ? "true" : "false");
    }
    if (musicMuteBtn) {
      const icon = musicMuteBtn.querySelector(".material-symbols-rounded");
      if (icon) icon.textContent = this.audio.musicMuted ? "volume_off" : "volume_up";
      musicMuteBtn.classList.toggle("active", !!this.audio.musicMuted);
      musicMuteBtn.setAttribute("aria-pressed", this.audio.musicMuted ? "true" : "false");
    }
    if (musicHud) musicHud.classList.toggle("isPlaying", this.audio.isMusicPlaying());
    if (musicVol && musicVol.value !== vol) musicVol.value = vol;
    if (musicHudVol && musicHudVol.value !== vol) musicHudVol.value = vol;
    const duration = Number.isFinite(bgm?.duration) ? bgm.duration : 0;
    const current = Number.isFinite(bgm?.currentTime) ? bgm.currentTime : 0;
    if (musicElapsed) musicElapsed.textContent = formatMusicTime(current);
    if (musicDuration) musicDuration.textContent = formatMusicTime(duration);
    if (musicProgress) {
      musicProgress.max = duration > 0 ? String(Math.ceil(duration)) : "1000";
      musicProgress.disabled = false;
    }
    if (musicProgress && document.activeElement !== musicProgress) {
      const pending = typeof this.audio._pendingProgressDisplay === "number" ? this.audio._pendingProgressDisplay : 0;
      musicProgress.value = duration > 0 ? String(Math.round(current)) : String(Math.round(pending * Number(musicProgress.max || "1000")));
    }
  }

  _syncMusicHudGeometry() {
    if (!musicHud || !abilitiesBarEl) return;
    const r = abilitiesBarEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    musicHud.style.width = `${Math.round(r.width)}px`;
    const bottom = Math.max(0, Math.round(window.innerHeight - r.top));
    musicHud.style.bottom = `${bottom}px`;
    if (visualModeLabelEl) {
      const closedHeight = Number.parseFloat(getComputedStyle(musicHud).getPropertyValue("--music-closed-height")) || 46;
      visualModeLabelEl.style.bottom = `${bottom + closedHeight + 8}px`;
    }
  }

  _hideLandingMenu() {
    const menu = document.getElementById("landingMenu");
    if (!menu) return;
    menu.classList.add("hidden");
    menu.setAttribute("aria-hidden", "true");
    this.menuOpen = false;
  }

  _syncLayoutAfterMenuClose() {
    // Let HUD values/panel state settle without moving the active battlefield.
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
      const saved = hasSave();
      const actions = loadBtn?.parentElement;
      if (loadBtn) {
        loadBtn.disabled = !saved;
        loadBtn.classList.toggle("primary", saved);
        loadBtn.classList.toggle("ghost", !saved);
      }
      if (playBtn) {
        playBtn.textContent = saved ? "Start New Game" : "Play";
        playBtn.classList.toggle("primary", !saved);
        playBtn.classList.toggle("ghost", saved);
      }
      if (actions && saved && loadBtn) actions.prepend(loadBtn);
      if (actions && !saved && playBtn) actions.prepend(playBtn);
    };
    refreshLoadState();
    this._syncLeaderboardProfileUi();

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
        this.firstWaveTutorialShown = false;
        this.audio.randomizeStartingTrack();
        this.audio.unlock();
        this._hideLandingMenu();
        requestAnimationFrame(() => {
          this._syncLayoutAfterMenuClose();
          this._startFirstWaveTutorial();
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
    landingLeaderboardBtnEl?.addEventListener("click", () => {
      this._openLeaderboardModal();
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
    const state = this._getTileState(gx, gy, false);
    const idx = gy * this.map.cols + gx;
    const v = this.map.cells?.[idx] ?? 0;
    return state?.corrupted === true && this.map.isCorruptionSafeCell(gx, gy, v);
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
    if (!this.map?.cells?.length) return false;
    const cols = this.map.cols | 0;
    const rows = this.map.rows | 0;
    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return false;

    // Keep corruption off the actual lane while allowing it to touch the track edge.
    if (!this.map.isCorruptionSafeCell(gx, gy, v)) return false;
    if (this.map.featureAtCell?.(gx, gy)) return false;

    const center = this.map.worldFromCell(gx, gy);
    const trackD = Math.sqrt(distanceToSegmentsSquared(center.x, center.y, this.map.segs || []));
    const maxTrackD = TRACK_RADIUS + this.map.gridSize * 3;
    if (trackD > maxTrackD) return false;

    // Corruption should pressure the prime build lane beside the track without sitting on the path.
    // Use Manhattan distance so "3 tiles away" is intuitive.
    const minTiles = 1;
    const maxTiles = 3;
    let nearest = Infinity;
    for (let oy = -maxTiles; oy <= maxTiles; oy++) {
      for (let ox = -maxTiles; ox <= maxTiles; ox++) {
        const md = Math.abs(ox) + Math.abs(oy);
        if (md > maxTiles) continue;
        const tx = gx + ox;
        const ty = gy + oy;
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        const idx = ty * cols + tx;
        if (this.map.cells[idx] !== 2) continue;
        if (md < nearest) nearest = md;
      }
    }
    return nearest >= minTiles && nearest <= maxTiles;
  }

  _trackTileDistance(gx, gy) {
    if (!this.map?.cells?.length) return Infinity;
    const cols = this.map.cols | 0;
    const rows = this.map.rows | 0;
    const maxTiles = 3;
    let nearest = Infinity;
    for (let oy = -maxTiles; oy <= maxTiles; oy++) {
      for (let ox = -maxTiles; ox <= maxTiles; ox++) {
        const md = Math.abs(ox) + Math.abs(oy);
        if (md > maxTiles) continue;
        const tx = gx + ox;
        const ty = gy + oy;
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) continue;
        const idx = ty * cols + tx;
        if (this.map.cells[idx] !== 2) continue;
        if (md < nearest) nearest = md;
      }
    }
    return nearest;
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
        const savedCorruptionValid = this._isTrackAdjacentBuildCell(gx, gy, cell.v);
        this.map.tilesByCell[key] = {
          gx,
          gy,
          corrupted: savedCorruptionValid && t.corrupted === true,
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
    // Balanced corruption spread: enough to matter, not enough to make maps unwinnable.
    const targetBase = clamp(Math.round(candidates.length * 0.48), 22, 96);
    const minClear = clamp(Math.round(candidates.length * 0.40), 16, 72);
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

    // Pass 1: make sure corruption starts directly beside the track, with random gaps.
    const adjacent = candidates.filter((c) => this._trackTileDistance(c.gx, c.gy) === 1);
    const adjacentTarget = Math.min(adjacent.length, Math.max(4, Math.round(target * 0.48)));
    for (const c of adjacent) {
      if (selected.length >= adjacentTarget) break;
      const near = nearbyCount(c);
      const spreadBias = near <= 0 ? 1 : (near === 1 ? 0.62 : 0.24);
      if (rng() > spreadBias) continue;
      const key = keyOf(c);
      if (selectedKeys.has(key)) continue;
      selected.push(c);
      selectedKeys.add(key);
    }

    // Pass 2: weighted random acceptance so corruption has pockets and gaps.
    for (const c of candidates) {
      if (selected.length >= target) break;
      const d = this._trackTileDistance(c.gx, c.gy);
      const near = nearbyCount(c);
      const distBias = d === 1 ? 0.88 : (d === 2 ? 0.60 : (d === 3 ? 0.34 : 0));
      const spreadBias = near <= 0 ? 1 : (near === 1 ? 0.7 : 0.35);
      const acceptP = distBias * spreadBias;
      if (rng() > acceptP) continue;
      const key = keyOf(c);
      if (selectedKeys.has(key)) continue;
      selected.push(c);
      selectedKeys.add(key);
    }

    // Pass 3: fill toward target with a lighter spacing bias.
    if (selected.length < target) {
      for (const c of candidates) {
        if (selected.length >= target) break;
        const key = keyOf(c);
        if (selectedKeys.has(key)) continue;
        const near = nearbyCount(c);
        if (near >= 3 && rng() > 0.55) continue;
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
    this.musicVisualizer?.setLevelTheme?.(this.levelIndex, this.mapSeed);
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
    this._completeLevelObjective();
    this._grantAbilityPowerToken();
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
    this.disruptionClouds = [];
    this.disruptionShots = [];
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
    this._completeLevelObjective();
    this._grantAbilityPowerToken();

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
    this.screenFlashes = [];
    this.delayedEnemyFx = [];
    this.decals = [];
    this.beams = [];
    this.arcs = [];
    this.cones = [];
    this.disruptionClouds = [];
    this.disruptionShots = [];
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
    for (let i = this.delayedEnemyFx.length - 1; i >= 0; i--) {
      const fx = this.delayedEnemyFx[i];
      fx.delay -= dtScaled;
      if (fx.delay > 0) continue;
      this.delayedEnemyFx.splice(i, 1);
      if (fx.spawn?.type === "shockwave") {
        this.explosions.push({
          x: fx.spawn.x,
          y: fx.spawn.y,
          r: fx.spawn.r,
          t: fx.spawn.dur,
          dur: fx.spawn.dur,
          max: fx.spawn.max,
          col: fx.spawn.col,
          boom: !!fx.spawn.boom
        });
      }
      if (fx.spawn?.type === "particles") {
        this.particles.spawn(
          fx.spawn.x,
          fx.spawn.y,
          fx.spawn.n,
          fx.spawn.kind,
          fx.spawn.tint
        );
      }
      if (fx.spawn?.type === "screenFlash") {
        this.screenFlashes.push({
          x: fx.spawn.x,
          y: fx.spawn.y,
          r: fx.spawn.r,
          t: fx.spawn.dur,
          dur: fx.spawn.dur,
          max: fx.spawn.max,
          col: fx.spawn.col || "rgba(255,207,91,0.4)"
        });
      }
    }
    decay(this.beams);
    decay(this.arcs);
    decay(this.cones);
    decay(this.explosions);
    decay(this.screenFlashes);
    decay(this.decals);
    decay(this.lingering);
    decay(this.disruptionClouds);
    for (let i = this.disruptionShots.length - 1; i >= 0; i--) {
      const shot = this.disruptionShots[i];
      shot.t -= dtScaled;
      const elapsed = (shot.dur || 1) - (shot.t || 0);
      const impactAt = (shot.charge || 0) + (shot.travel || 0);
      if (!shot.shotSoundPlayed && elapsed >= (shot.charge || 0)) {
        shot.shotSoundPlayed = true;
        this.audio?.playLimited?.(shot.kind === "slow" ? "enemy_disrupt_slow_shot" : "enemy_disrupt_jam_shot", 320);
      }
      if (!shot.applied && elapsed >= impactAt) this._applyTurretDisruptionImpact(shot);
      if (shot.t <= 0) this.disruptionShots.splice(i, 1);
    }
    this.particles.update(dtScaled);
    for (let i = this.floatText.length - 1; i >= 0; i--) {
      const ft = this.floatText[i];
      ft.t -= dtScaled;
      ft.y -= ft.vy * dtScaled;
      if (ft.t <= 0) this.floatText.splice(i, 1);
    }
  }

  spawnTurretDisruptionCloud(enemy, kind = "jam") {
    if (!enemy || !this.turrets?.length || !this.map) return false;
    const radius = this.map.gridSize * 1.55;
    const candidates = [];
    for (const t of this.turrets) {
      if (this._isTurretDisruptionImmune(t) || t.disruptJamT > 0) continue;
      const reach = Math.max(260, this.map.gridSize * (6 + Math.min(4, this.wave * 0.12)));
      if (dist2(enemy.x, enemy.y, t.x, t.y) > reach * reach) continue;
      let cluster = 0;
      for (const other of this.turrets) {
        if (!other || other === t || this._isTurretDisruptionImmune(other)) continue;
        if (dist2(t.x, t.y, other.x, other.y) <= radius * radius) cluster++;
      }
      candidates.push({ turret: t, score: cluster * 3 + Math.random() * 2 + (t.level || 0) * 0.35 });
    }
    if (!candidates.length) return false;
    candidates.sort((a, b) => b.score - a.score);
    const target = candidates[Math.min(candidates.length - 1, Math.floor(Math.random() * Math.min(3, candidates.length)))].turret;
    const affected = [];
    for (const t of this.turrets) {
      if (this._isTurretDisruptionImmune(t) || dist2(target.x, target.y, t.x, t.y) > radius * radius) continue;
      affected.push(t);
    }
    if (!affected.length) return false;
    const col = kind === "slow" ? "rgba(186,112,255,0.88)" : "rgba(98,242,255,0.88)";
    const alt = kind === "slow" ? "rgba(255,120,220,0.62)" : "rgba(109,255,210,0.62)";
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    const charge = 0.34;
    const travel = clamp(distance / 420, 0.78, 1.28);
    this.disruptionShots.push({
      ax: enemy.x,
      ay: enemy.y,
      bx: target.x,
      by: target.y,
      t: charge + travel,
      dur: charge + travel,
      charge,
      travel,
      affected,
      radius,
      applied: false,
      shotSoundPlayed: false,
      kind,
      col,
      alt
    });
    this.arcs.push({ ax: enemy.x, ay: enemy.y, bx: target.x, by: target.y, t: 0.46, col });
    this.particles.spawn(enemy.x, enemy.y, kind === "slow" ? 6 : 8, "muzzle", alt);
    this.audio?.playLimited?.("enemy_disrupt_charge", 420);
    return true;
  }

  _applyTurretDisruptionImpact(shot) {
    if (!shot || shot.applied) return;
    shot.applied = true;
    const affected = Array.isArray(shot.affected) ? shot.affected : [];
    for (const t of affected) {
      if (this._isTurretDisruptionImmune(t)) continue;
      if (shot.kind === "slow") {
        t.disruptSlowT = Math.max(t.disruptSlowT || 0, 5);
        t.disruptKind = "slow";
      } else {
        t.disruptJamT = Math.max(t.disruptJamT || 0, 5);
        t.disruptKind = "jam";
        t.cool = Math.max(t.cool || 0, 0.18);
      }
      t.disruptFlashT = Math.max(t.disruptFlashT || 0, 0.9);
    }
    const radius = shot.radius || this.map?.gridSize * 1.55 || 74;
    this.disruptionClouds.push({
      x: shot.bx,
      y: shot.by,
      r: radius,
      t: 5,
      dur: 5,
      kind: shot.kind,
      col: shot.col,
      alt: shot.alt
    });
    this.explosions.push({
      x: shot.bx,
      y: shot.by,
      r: 12,
      t: 0.32,
      dur: 0.32,
      max: radius,
      col: shot.col,
      boom: false
    });
    this.screenFlashes.push({
      x: shot.bx,
      y: shot.by,
      r: radius * 0.55,
      t: 0.18,
      dur: 0.18,
      max: radius * 1.1,
      col: shot.kind === "slow" ? "rgba(186,112,255,0.24)" : "rgba(98,242,255,0.24)"
    });
    this.particles.spawn(shot.bx, shot.by, shot.kind === "slow" ? 10 : 12, "muzzle", shot.alt);
    this.spawnText(shot.bx, shot.by - 22, shot.kind === "slow" ? "STATIC SLOW" : "JAMMED", shot.col, 1.05);
    this.audio?.playLimited?.(shot.kind === "slow" ? "enemy_disrupt_slow_impact" : "enemy_disrupt_jam_impact", 260);
    this.audio?.playLimited?.("turret_disrupted_pulse", 900);
  }

  _isTurretDisruptionImmune(turret) {
    if (!turret) return true;
    return turret.boosted === true
      || (Number(turret.pulseBoostT) || 0) > 0
      || (Number(this.globalOverchargeT) || 0) > 0;
  }

  _spawnEnergyBurst(x, y, opts = {}) {
    const tint = opts.tint || "rgba(98,242,255,0.9)";
    const alt = opts.alt || "rgba(255,207,91,0.9)";
    const scale = Math.max(0.25, opts.scale || 1);
    const boom = opts.boom === true;
    this.explosions.push({
      x,
      y,
      r: 8 * scale,
      t: 0.26 + 0.06 * scale,
      dur: 0.26 + 0.06 * scale,
      max: 54 * scale,
      col: tint,
      boom: false
    });
    this.explosions.push({
      x,
      y,
      r: 18 * scale,
      t: 0.44 + 0.08 * scale,
      dur: 0.44 + 0.08 * scale,
      max: 98 * scale,
      col: alt,
      boom
    });
    this.screenFlashes.push({
      x,
      y,
      r: 8 * scale,
      t: 0.22 + 0.04 * scale,
      dur: 0.22 + 0.04 * scale,
      max: 160 * scale,
      col: tint
    });
    this.lingering.push({
      x,
      y,
      r: 22 * scale,
      t: 1.2 + 0.2 * scale,
      dur: 1.2 + 0.2 * scale,
      col: opts.linger || tint
    });
    this.particles.spawn(x, y, Math.round((opts.power ? 18 : 10) * scale), opts.power ? "power" : "spark", tint);
    this.particles.spawn(x, y, Math.round(6 * scale), "ember", alt);
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
        this._recordLeaderboardPlay();
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

    [
      { el: anomalyPill, type: "anomaly" },
      { el: objectivePillEl, type: "objective" },
      { el: mapFeaturePillEl, type: "feature" }
    ].forEach(({ el, type }) => {
      if (!el) return;
      const show = (ev) => {
        const msg = this._topbarPillTooltip(type);
        if (!msg) return;
        showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
      };
      el.addEventListener("pointerenter", show);
      el.addEventListener("pointermove", show);
      el.addEventListener("pointerleave", () => hideTooltip());
    });

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
    abilityUpgradeBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.upgradeAbility(btn.dataset.upgradeAbility));
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
      if (musicHudVol) musicHudVol.value = musicVol.value;
      this._syncMusicHud();
    });
    musicHudVol?.addEventListener("input", () => {
      const v = Number(musicHudVol.value || "0") / 100;
      this.audio.setMusicVolume(v);
      if (musicVol) musicVol.value = musicHudVol.value;
      this._syncMusicHud();
    });
    musicHud?.addEventListener("mouseenter", () => musicHud.classList.add("open"));
    musicHud?.addEventListener("mouseleave", () => {
      if (!musicHud.matches(":focus-within")) musicHud.classList.remove("open");
    });
    musicHud?.addEventListener("focusin", () => musicHud.classList.add("open"));
    musicHud?.addEventListener("focusout", () => {
      setTimeout(() => {
        if (!musicHud.matches(":hover, :focus-within")) musicHud.classList.remove("open");
      }, 0);
    });
    musicProgress?.addEventListener("input", () => {
      this.audio.setProgress(Number(musicProgress.value || "0"), Number(musicProgress.max || "1"));
      this._syncMusicHud();
    });
    musicProgress?.addEventListener("change", () => {
      this.audio.setProgress(Number(musicProgress.value || "0"), Number(musicProgress.max || "1"));
      this._syncMusicHud();
    });
    musicPlayBtn?.addEventListener("click", () => {
      this.musicVisualizer?.unlock();
      this.audio.toggleMusic();
      this._syncMusicHud();
    });
    musicShuffleBtn?.addEventListener("click", () => {
      this.audio.setShuffle(!this.audio.shuffle);
      this._syncMusicHud();
    });
    musicPrevBtn?.addEventListener("click", () => {
      this.audio.prevTrack();
      this._syncMusicHud();
    });
    musicNextBtn?.addEventListener("click", () => {
      this.audio.nextTrack();
      this._syncMusicHud();
    });
    musicBack10Btn?.addEventListener("click", () => {
      this.audio.seekBy(-10);
      this._syncMusicHud();
    });
    musicForward10Btn?.addEventListener("click", () => {
      this.audio.seekBy(10);
      this._syncMusicHud();
    });
    musicRepeatBtn?.addEventListener("click", () => {
      this.audio.setRepeat(!this.audio.repeat);
      this._syncMusicHud();
    });
    musicMuteBtn?.addEventListener("click", () => {
      this.audio.toggleMute();
      this._syncMusicHud();
    });
    sfxVol?.addEventListener("input", () => {
      const v = Number(sfxVol.value || "0") / 100;
      this.audio.setSfxVolume(v);
    });

    if (musicVol) musicVol.value = String(Math.round(this.audio.bgm.volume * 100));
    if (musicHudVol) musicHudVol.value = String(Math.round(this.audio.bgm.volume * 100));
    if (sfxVol) sfxVol.value = String(Math.round(this.audio.sfxVol * 100));
    this._syncMusicHud();
    this._syncVisualSettingsUi();
    enemySpritesToggleEl?.addEventListener("change", () => {
      this.visualSettings.enemySprites = !!enemySpritesToggleEl.checked;
      this._applyVisualSettings();
      this._saveVisualSettings();
    });
    vfxIntensitySelectEl?.addEventListener("change", () => {
      this.visualSettings.vfxIntensity = this._sanitizeVfxIntensity(vfxIntensitySelectEl.value);
      this._applyVisualSettings();
      this._saveVisualSettings();
    });
    // CODEX CHANGE: Persist the music-visualization opt-out used by the selected-turret waveform.
    musicVisualsToggleEl?.addEventListener("change", () => {
      this.visualSettings.musicVisualizations = !!musicVisualsToggleEl.checked;
      this._saveVisualSettings();
      if (!this.visualSettings.musicVisualizations) {
        this.selectedTurretWaveform?.clear(true);
        this.hudOuterWaveform?.clear(true);
      }
    });

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

    // CODEX CHANGE: Offer explicit save, fullscreen, and save-aware exit actions only in Electron.
    if (desktopBridge?.isDesktop) {
      document.body.classList.add("desktopApp");
      if (desktopControlsEl) desktopControlsEl.hidden = false;
      desktopSaveBtnEl?.addEventListener("click", () => this.saveNow(true));
      desktopFullscreenBtnEl?.addEventListener("click", () => {
        void desktopBridge.toggleFullscreen?.();
      });
      desktopExitBtnEl?.addEventListener("click", () => {
        this._promptSaveAndExit();
      });
    }

    audioBtn?.addEventListener("click", () => {
      this.musicVisualizer?.unlock();
      this.audio.toggle();
      this._syncMusicHud();
    });

    modalCancel?.addEventListener("click", () => closeConfirm());
    modalConfirm?.addEventListener("click", () => {
      const cb = _modalOnConfirm;
      closeConfirm();
      if (cb) cb();
    });
    tutorialOkEl?.addEventListener("click", () => this._advanceTutorial());
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
    leaderboardBtnEl?.addEventListener("click", () => this._openLeaderboardModal());
    leaderboardCloseEl?.addEventListener("click", () => this._closeLeaderboardModal());
    leaderboardModalEl?.addEventListener("click", (ev) => {
      if (ev.target === leaderboardModalEl) this._closeLeaderboardModal();
    });
    this._syncLeaderboardProfileUi();

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
      // CODEX CHANGE: Consume the click emitted after a map drag so an open turret HUD is not rebuilt.
      if (this.dragging) return;
      if (this.dragMoved) {
        this.dragMoved = false;
        return;
      }
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
      // CODEX CHANGE: Preserve dragMoved until the following click event can consume the drag release.
      this.dragging = false;
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
      else this.saveNow();
    });
    // CODEX CHANGE: Persist the current run during browser and desktop lifecycle shutdowns.
    window.addEventListener("pagehide", () => this.saveNow());
    canvas.addEventListener("mouseleave", () => hideTooltip());

    // CODEX CHANGE: Share map zoom with the turret HUD so its overlay never blocks the wheel.
    const handleMapZoom = (ev) => {
      if (this.isUiBlocked()) return;
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      const next = this.zoom + (delta > 0 ? -0.1 : 0.1);
      // CODEX CHANGE: Allow large fullscreen maps to remain visible when restored into the minimum window size.
      this.zoom = clamp(next, 0.45, 1.65);
    };
    canvas.addEventListener("wheel", handleMapZoom, { passive: false });
    turretHud?.addEventListener("wheel", handleMapZoom, { passive: false });

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
      // CODEX CHANGE: Escape is the desktop-safe exit gesture; a second Escape cancels the prompt.
      if (desktopBridge?.isDesktop && ev.key === "Escape") {
        ev.preventDefault();
        this._promptSaveAndExit();
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
      if (this._isTypingHotkeyEvent(ev) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (this.isPaused()) return;
      if (ev.repeat) return;
      if (ev.key === "Escape" && this.buildKey) {
        this.clearBuildMode();
        return;
      }
      const key = String(ev.key || "").toLowerCase();
      if (key === "1") {
        ev.preventDefault();
        this.useAbility("scan");
        return;
      }
      if (key === "2") {
        ev.preventDefault();
        this.useAbility("pulse");
        return;
      }
      if (key === "3") {
        ev.preventDefault();
        this.useAbility("overcharge");
        return;
      }
      const buildKey = TURRET_KEY_TO_BUILD[key];
      if (buildKey) {
        ev.preventDefault();
        this._trySelectBuildMode(buildKey, true);
      }
    });
  }

  _isTypingHotkeyEvent(ev) {
    const el = ev?.target;
    if (!el || typeof el.closest !== "function") return false;
    return !!el.closest("input, textarea, select, [contenteditable='true']");
  }

  isUiBlocked() {
    const overlayOpen = overlay && !overlay.classList.contains("hidden");
    const settingsOpen = settingsModal && !settingsModal.classList.contains("hidden");
    return this.menuOpen || overlayOpen || settingsOpen || this.statsOpen || this.tutorialOpen || this._transitioning || this.gameState !== GAME_STATE.GAMEPLAY;
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

  // CODEX CHANGE: Invalidate cached HUD measurements only when its content or viewport can change.
  _invalidateTurretHudLayout() {
    this._turretHudMetrics = null;
    this._turretHudLastTransform = null;
    this._turretHudLastCone = null;
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
    if (!this._turretHudMetrics) {
      turretHud.style.left = "0px";
      turretHud.style.top = "0px";
      turretHud.style.transform = "translate3d(0, 0, 0)";
      const rect = turretHud.getBoundingClientRect();
      const wrapRect = turretHud.offsetParent?.getBoundingClientRect();
      this._turretHudMetrics = {
        width: rect.width,
        height: rect.height,
        vw: wrapRect ? wrapRect.width : W,
        vh: wrapRect ? wrapRect.height : H
      };
    }
    const { width, height, vw, vh } = this._turretHudMetrics;
    const margin = 10;
    // CODEX CHANGE: Keep tile action panels close to the selected square instead of three cells away.
    const clearance = Math.max(24, MAP_GRID_SIZE * this.zoom * 0.75);
    const maxX = Math.max(margin, vw - width - margin);
    const maxY = Math.max(margin, vh - height - margin);
    const isRadial = turretHud.classList.contains("turretMode");
    let px;
    let py;
    let side;
    let coneX;
    let coneY;
    let coneAngle;

    if (isRadial) {
      // CODEX CHANGE: Lock the command ring around the selected battlefield turret itself.
      px = s.x - width * 0.5;
      py = s.y - height * 0.5;
      side = "center";
      coneX = width * 0.5;
      coneY = height * 0.5;
      coneAngle = 0;
    } else {
      // CODEX CHANGE: Place cleanse/unlock panels beside and vertically centered on the selected square.
      const leftX = s.x - width - clearance;
      const rightX = s.x + clearance;
      const leftFits = leftX >= margin;
      const rightFits = rightX <= maxX;
      const prefersRight = s.x < vw * 0.5;
      side = prefersRight ? "right" : "left";
      if (side === "right" && !rightFits && leftFits) side = "left";
      if (side === "left" && !leftFits && rightFits) side = "right";
      px = clamp(side === "right" ? rightX : leftX, margin, maxX);
      py = clamp(s.y - height * 0.5, margin, maxY);
      coneX = 0;
      coneY = 0;
      coneAngle = 0;
    }

    px = Math.round(px);
    py = Math.round(py);
    // CODEX CHANGE: Connector cones are no longer rendered for tile or turret HUD modes.
    const coneLength = 0;
    // CODEX CHANGE: Keep camera-following transforms separate from the more expensive cone styling.
    const transformKey = `${px}:${py}`;
    if (this._turretHudLastTransform !== transformKey) {
      turretHud.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      this._turretHudLastTransform = transformKey;
    }
    const coneKey = `${side}:${Math.round(coneY)}:${Math.round(coneLength)}:${coneAngle.toFixed(3)}`;
    if (this._turretHudLastCone !== coneKey) {
      turretHud.style.setProperty("--hud-cone-x", `${coneX}px`);
      turretHud.style.setProperty("--hud-cone-length", `${coneLength}px`);
      turretHud.style.setProperty("--hud-cone-angle", `${coneAngle}rad`);
      turretHud.dataset.side = side;
      this._turretHudLastCone = coneKey;
    }
  }

  _canSkipIntermission() {
    return this.hasStarted && !this.waveActive && this.intermission > 0 && !this.isPaused();
  }

  _newWaveStats(wave) {
    return { wave, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, dmgByType: {} };
  }

  _newRunStats() {
    return { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, objectivesCompleted: 0, bestCombo: 0, dmgByType: {} };
  }

  _newPlayerStats() {
    return { mapsCleared: 0, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, objectivesCompleted: 0, bestCombo: 0 };
  }

  _createLevelObjective(saved = null) {
    if (saved?.key) {
      const base = LEVEL_OBJECTIVES.find((entry) => entry.key === saved.key);
      if (base) return {
        ...saved,
        key: base.key,
        name: base.name,
        desc: base.desc,
        reward: Math.max(1, Number(saved.reward) || base.reward(this.levelIndex))
      };
    }
    const rng = makeRNG(((this.mapSeed || 1) ^ (this.levelIndex * 15485863)) >>> 0);
    const base = LEVEL_OBJECTIVES[Math.floor(rng() * LEVEL_OBJECTIVES.length)] || LEVEL_OBJECTIVES[0];
    const level = Math.max(1, this.levelIndex | 0);
    return {
      key: base.key,
      name: base.name,
      desc: base.desc,
      reward: base.reward(level),
      elapsed: 0,
      timeLimit: 720 + Math.min(240, Math.max(0, level - 1) * 18),
      leaks: 0,
      prioritySpawned: 0,
      priorityKilled: 0,
      priorityEscaped: 0,
      priorityGoal: Math.min(16, 6 + Math.floor(level * 1.5)),
      bossKills: 0,
      bossMisses: 0,
      complete: false,
      failed: false,
      rewarded: false
    };
  }

  _objectiveProgressText() {
    const o = this.levelObjective;
    if (!o) return "-";
    if (o.complete) return `${o.name}: COMPLETE`;
    if (o.failed) return `${o.name}: MISSED`;
    if (o.key === "CORE_INTEGRITY") return `${o.name}: ${o.leaks || 0}/2 LEAKS`;
    if (o.key === "TIMED_ASSAULT") return `${o.name}: ${Math.max(0, Math.ceil((o.timeLimit || 0) - (o.elapsed || 0)))}s`;
    if (o.key === "PRIORITY_HUNT") return `${o.name}: ${o.priorityKilled || 0}/${o.priorityGoal || 0}`;
    if (o.key === "BOSS_INTERCEPT") return `${o.name}: ${o.bossKills || 0} INTERCEPTED`;
    return o.name;
  }

  _completeLevelObjective() {
    const o = this.levelObjective;
    if (!o || o.rewarded) return false;
    if (o.key === "CORE_INTEGRITY") o.failed = (o.leaks || 0) > 2;
    if (o.key === "TIMED_ASSAULT") o.failed = (o.elapsed || 0) > (o.timeLimit || 0);
    if (o.key === "PRIORITY_HUNT") o.failed = (o.priorityEscaped || 0) > 0 || (o.priorityKilled || 0) < (o.priorityGoal || 0);
    if (o.key === "BOSS_INTERCEPT") o.failed = (o.bossMisses || 0) > 0 || (o.bossKills || 0) < 1;
    o.complete = !o.failed;
    o.rewarded = true;
    if (!o.complete) {
      toast(`OBJECTIVE MISSED: ${o.name}`);
      return false;
    }
    const reward = Math.max(1, Number(o.reward) || 1);
    this.gold += reward;
    if (this.runStats) this.runStats.gold += reward;
    if (this.runStats) this.runStats.objectivesCompleted = (this.runStats.objectivesCompleted || 0) + 1;
    if (this.playerStats) {
      this.playerStats.gold += reward;
      this.playerStats.objectivesCompleted = (this.playerStats.objectivesCompleted || 0) + 1;
    }
    toast(`OBJECTIVE COMPLETE: ${o.name} +${reward}g`);
    return true;
  }

  _profileHash(name, password) {
    const input = `${String(name || "").trim().toLowerCase()}:${String(password || "")}`;
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  _sanitizeProfileName(name) {
    return String(name || "").trim().replace(/\s+/g, " ").slice(0, 18);
  }

  _emptyLeaderboardEntry(profile) {
    return {
      id: profile.id,
      name: profile.name,
      passHash: profile.passHash,
      plays: 0,
      score: 0,
      bestLevel: 1,
      bestWave: 0,
      mapsCleared: 0,
      kills: 0,
      leaks: 0,
      bestCombo: 0,
      gold: 0,
      towersBuilt: 0,
      bosses: 0,
      objectivesCompleted: 0,
      updatedAt: Date.now()
    };
  }

  _normalizeLeaderboardEntry(e, fallbackProfile = null) {
    const profile = fallbackProfile || {};
    return {
      id: String(e?.id || profile.id || e?.name || ""),
      name: String(e?.name || profile.name || "Pilot").slice(0, 18),
      passHash: String(e?.passHash || profile.passHash || ""),
      plays: Math.max(0, Number(e?.plays) | 0),
      score: Math.max(0, Number(e?.score) | 0),
      bestLevel: Math.max(1, Number(e?.bestLevel) | 0),
      bestWave: Math.max(0, Number(e?.bestWave) | 0),
      mapsCleared: Math.max(0, Number(e?.mapsCleared) | 0),
      kills: Math.max(0, Number(e?.kills) | 0),
      leaks: Math.max(0, Number(e?.leaks) | 0),
      bestCombo: Math.max(0, Number(e?.bestCombo) | 0),
      gold: Math.max(0, Number(e?.gold) | 0),
      towersBuilt: Math.max(0, Number(e?.towersBuilt) | 0),
      bosses: Math.max(0, Number(e?.bosses) | 0),
      objectivesCompleted: Math.max(0, Number(e?.objectivesCompleted) | 0),
      updatedAt: Math.max(0, Number(e?.updatedAt) || Date.parse(e?.updatedAt || "") || 0)
    };
  }

  _mergeLeaderboardEntry(incoming) {
    if (!incoming?.id) return null;
    const normalized = this._normalizeLeaderboardEntry(incoming);
    let entry = this.leaderboard.find(e => e.id === normalized.id);
    if (!entry) {
      entry = normalized;
      this.leaderboard.push(entry);
      return entry;
    }
    entry.name = normalized.name || entry.name;
    if (normalized.passHash) entry.passHash = normalized.passHash;
    for (const key of ["plays", "score", "bestLevel", "bestWave", "mapsCleared", "kills", "leaks", "bestCombo", "gold", "towersBuilt", "bosses", "objectivesCompleted"]) {
      entry[key] = Math.max(Number(entry[key]) || 0, Number(normalized[key]) || 0);
    }
    entry.updatedAt = Math.max(Number(entry.updatedAt) || 0, Number(normalized.updatedAt) || 0);
    return entry;
  }

  _leaderboardScore(entry) {
    if (!entry) return 0;
    const bestLevel = Math.max(1, Number(entry.bestLevel) | 0);
    const bestWave = Math.max(0, Number(entry.bestWave) | 0);
    const maps = Math.max(0, Number(entry.mapsCleared) | 0);
    const kills = Math.max(0, Number(entry.kills) | 0);
    const combo = Math.max(0, Number(entry.bestCombo) | 0);
    const bosses = Math.max(0, Number(entry.bosses) | 0);
    const objectives = Math.max(0, Number(entry.objectivesCompleted) | 0);
    const gold = Math.max(0, Number(entry.gold) | 0);
    const leaks = Math.max(0, Number(entry.leaks) | 0);
    const towers = Math.max(0, Number(entry.towersBuilt) | 0);
    return Math.max(0,
      bestLevel * 100000
      + bestWave * 2500
      + maps * 18000
      + bosses * 3500
      + objectives * 1800
      + combo * 180
      + kills * 35
      + Math.floor(gold * 0.4)
      + towers * 60
      - leaks * 900
    ) | 0;
  }

  _loadLeaderboardState() {
    try {
      const rawBoard = localStorage.getItem(LEADERBOARD_KEY);
      const parsedBoard = rawBoard ? JSON.parse(rawBoard) : [];
      this.leaderboard = Array.isArray(parsedBoard)
        ? parsedBoard.filter(e => e && e.id && e.name).map(e => this._normalizeLeaderboardEntry(e))
        : [];

      const rawProfile = localStorage.getItem(PROFILE_KEY);
      const profile = rawProfile ? JSON.parse(rawProfile) : null;
      if (profile?.id && profile?.name) {
        this.playerProfile = {
          id: String(profile.id),
          name: String(profile.name).slice(0, 18),
          passHash: String(profile.passHash || "")
        };
        this._leaderboardEntryForProfile(true);
      }
    } catch (err) {
      this.leaderboard = [];
      this.playerProfile = null;
    }
  }

  _saveLeaderboardState() {
    try {
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(this.leaderboard.slice(0, 20)));
      if (this.playerProfile) localStorage.setItem(PROFILE_KEY, JSON.stringify(this.playerProfile));
      else localStorage.removeItem(PROFILE_KEY);
    } catch (err) {}
  }

  _pushRemoteLeaderboardScore(entry) {
    if (!LEADERBOARD_API_BASE || !this.playerProfile?.apiToken || !entry) return;
    this._apiRequest("/api/score", {
      method: "POST",
      body: JSON.stringify({
        plays: entry.plays || 0,
        score: entry.score || 0,
        bestLevel: entry.bestLevel || 1,
        bestWave: entry.bestWave || 0,
        mapsCleared: entry.mapsCleared || 0,
        kills: entry.kills || 0,
        leaks: entry.leaks || 0,
        bestCombo: entry.bestCombo || 0,
        gold: entry.gold || 0,
        towersBuilt: entry.towersBuilt || 0,
        bosses: entry.bosses || 0,
        objectivesCompleted: entry.objectivesCompleted || 0
      })
    }).then((data) => {
      if (data?.score) this._refreshRemoteLeaderboard();
    }).catch(() => {});
  }

  _leaderboardEntryForProfile(create = true) {
    if (!this.playerProfile) return null;
    let entry = this.leaderboard.find(e => e.id === this.playerProfile.id);
    if (!entry && create) {
      entry = this._emptyLeaderboardEntry(this.playerProfile);
      this.leaderboard.push(entry);
    }
    if (entry) {
      entry.name = this.playerProfile.name;
      entry.passHash = this.playerProfile.passHash;
    }
    return entry || null;
  }

  _sortLeaderboard() {
    this.leaderboard.sort((a, b) =>
      (b.score - a.score)
      || (b.bestLevel - a.bestLevel)
      || (b.bestWave - a.bestWave)
      || (b.mapsCleared - a.mapsCleared)
      || (b.kills - a.kills)
      || (b.bestCombo - a.bestCombo)
      || (b.gold - a.gold)
      || (b.updatedAt - a.updatedAt)
    );
  }

  _leaderboardDetailItems(entry) {
    if (!entry) return [];
    const updated = Number(entry.updatedAt) || 0;
    return [
      ["Score", fmt(entry.score || 0)],
      ["Best Level", entry.bestLevel || 1],
      ["Best Wave", entry.bestWave || 0],
      ["Maps Cleared", entry.mapsCleared || 0],
      ["Kills", entry.kills || 0],
      ["High Combo", `${entry.bestCombo || 0}x`],
      ["Leaks", entry.leaks || 0],
      ["Towers Built", entry.towersBuilt || 0],
      ["Bosses", entry.bosses || 0],
      ["Objectives", entry.objectivesCompleted || 0],
      ["Gold Earned", fmt(entry.gold || 0)],
      ["Plays", entry.plays || 0],
      ["Last Update", updated ? new Date(updated).toLocaleString() : "-"]
    ];
  }

  _selectLeaderboardPilot(pilotId) {
    if (!pilotId) return;
    const entry = this.leaderboard.find(e => e.id === pilotId);
    if (!entry) return;
    this.selectedLeaderboardPilotId = entry.id;
    this._renderLeaderboardModal();
  }

  _syncLeaderboardStats(options = {}) {
    const push = options.push !== false;
    const entry = this._leaderboardEntryForProfile(false);
    if (!entry) return;
    this._reconcilePlayerStats();
    const p = this.playerStats || this._newPlayerStats();
    entry.bestLevel = Math.max(entry.bestLevel || 1, this.levelIndex || 1);
    entry.bestWave = Math.max(entry.bestWave || 0, this.wave || 0);
    entry.mapsCleared = Math.max(entry.mapsCleared || 0, p.mapsCleared || 0);
    entry.kills = Math.max(entry.kills || 0, p.kills || 0);
    entry.leaks = Math.max(entry.leaks || 0, p.leaks || 0);
    entry.bestCombo = Math.max(entry.bestCombo || 0, p.bestCombo || 0, this.comboBest || 0);
    entry.gold = Math.max(entry.gold || 0, p.gold || 0);
    entry.towersBuilt = Math.max(entry.towersBuilt || 0, p.towersBuilt || 0);
    entry.bosses = Math.max(entry.bosses || 0, p.bosses || 0);
    entry.objectivesCompleted = Math.max(entry.objectivesCompleted || 0, p.objectivesCompleted || 0);
    entry.score = Math.max(entry.score || 0, this._leaderboardScore(entry));
    entry.updatedAt = Date.now();
    this._sortLeaderboard();
    this._saveLeaderboardState();
    this._syncLeaderboardProfileUi();
    if (push) this._pushRemoteLeaderboardScore(entry);
  }

  _recordLeaderboardPlay() {
    const entry = this._leaderboardEntryForProfile(false);
    if (!entry || this._playRecordedThisSession) return;
    entry.plays = Math.max(0, Number(entry.plays) | 0) + 1;
    entry.updatedAt = Date.now();
    this._playRecordedThisSession = true;
    this._syncLeaderboardStats();
  }

  _syncLeaderboardProfileUi() {
    const name = this.playerProfile?.name || "Guest";
    if (landingPilotStatusEl) landingPilotStatusEl.textContent = this.playerProfile ? `Pilot: ${name}` : "Playing as Guest";
    if (leaderboardBtnEl) leaderboardBtnEl.textContent = this.playerProfile ? "PILOT" : "LEADERS";
  }

  _setPlayerProfile(profile, remoteScore = null) {
    this.playerProfile = profile;
    const entry = this._leaderboardEntryForProfile(true);
    if (remoteScore && entry) {
      this._mergeLeaderboardEntry({
        ...remoteScore,
        id: profile.id,
        name: profile.name,
        passHash: profile.passHash || ""
      });
    }
    this._syncLeaderboardStats();
    this._saveLeaderboardState();
    this._renderLeaderboardModal();
    toast(`Pilot ready: ${profile.name}`);
  }

  _profileFromApi(data) {
    if (!data?.player?.id || !data?.player?.username || !data?.token) return null;
    return {
      id: String(data.player.id),
      name: String(data.player.username).slice(0, 18),
      passHash: "",
      apiToken: String(data.token)
    };
  }

  async _apiRequest(path, options = {}) {
    if (!LEADERBOARD_API_BASE) return null;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (this.playerProfile?.apiToken) headers.Authorization = `Bearer ${this.playerProfile.apiToken}`;
    const res = await fetch(`${LEADERBOARD_API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Leaderboard request failed.");
    return data;
  }

  async _createOrLoginProfile(mode) {
    const nameInput = document.getElementById("leaderboardNameInput");
    const passInput = document.getElementById("leaderboardPasswordInput");
    const name = this._sanitizeProfileName(nameInput?.value);
    const password = String(passInput?.value || "");
    if (name.length < 3) {
      toast("Pilot name needs at least 3 characters.");
      return;
    }
    if (password.length < 4) {
      toast("Password needs at least 4 characters.");
      return;
    }
    if (LEADERBOARD_API_BASE) {
      try {
        const data = await this._apiRequest(mode === "login" ? "/api/login" : "/api/register", {
          method: "POST",
          body: JSON.stringify({ username: name, password })
        });
        const profile = this._profileFromApi(data);
        if (!profile) throw new Error("Leaderboard login did not return a session.");
        this._setPlayerProfile(profile, data?.score || null);
        return;
      } catch (err) {
        toast(err.message || "Leaderboard service unavailable.");
        return;
      }
    }
    const existing = this.leaderboard.find(e => e.name.toLowerCase() === name.toLowerCase());
    const passHash = this._profileHash(name, password);
    if (existing) {
      if (existing.passHash && existing.passHash !== passHash) {
        toast("Wrong password for that pilot.");
        return;
      }
      this._setPlayerProfile({ id: existing.id, name: existing.name, passHash });
      return;
    }
    if (mode === "login") {
      toast("Pilot not found. Create it first.");
      return;
    }
    const id = `pilot_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
    this._setPlayerProfile({ id, name, passHash });
  }

  _logoutProfile() {
    this._syncLeaderboardStats();
    this.playerProfile = null;
    this._playRecordedThisSession = false;
    this._saveLeaderboardState();
    this._renderLeaderboardModal();
    this._syncLeaderboardProfileUi();
    toast("Playing as Guest.");
  }

  _renderLeaderboardModal() {
    if (!leaderboardBodyEl) return;
    this._syncLeaderboardStats({ push: false });
    const activeId = this.playerProfile?.id || "";
    const fallbackEntry = (activeId ? this.leaderboard.find(entry => entry.id === activeId) : null) || this.leaderboard[0] || null;
    const selectedEntry = this.leaderboard.find(entry => entry.id === this.selectedLeaderboardPilotId) || fallbackEntry;
    if (selectedEntry) this.selectedLeaderboardPilotId = selectedEntry.id;
    const selectedRank = selectedEntry ? this.leaderboard.findIndex(entry => entry.id === selectedEntry.id) + 1 : 0;
    const selectedSummary = selectedEntry ? `
      <div class="leaderboardDetail" aria-label="Selected pilot leaderboard stats">
        <div class="leaderboardDetailHeader">
          <div>
            <span class="leaderboardDetailEyebrow">Pilot Details</span>
            <b>${escapeHtml(selectedEntry.name)}</b>
          </div>
          <span>${selectedRank ? `Rank #${selectedRank}` : "Unranked"}</span>
        </div>
        <div class="leaderboardSnapshot">
          ${this._leaderboardDetailItems(selectedEntry).map(([label, value]) => `
            <div><b>${escapeHtml(String(value))}</b><span>${escapeHtml(String(label))}</span></div>
          `).join("")}
        </div>
      </div>
    ` : "";
    const rows = (this.leaderboard || []).slice(0, 10).map((entry, index) => `
      <div class="leaderboardRow ${entry.id === activeId ? "active" : ""} ${entry.id === selectedEntry?.id ? "selected" : ""}" role="button" tabindex="0" data-pilot-id="${escapeHtml(entry.id)}" aria-label="View stats for ${escapeHtml(entry.name)}">
        <div class="leaderboardStat">#${index + 1}</div>
        <div class="leaderboardName">${escapeHtml(entry.name)}</div>
        <div class="leaderboardStat">${fmt(entry.score || 0)}</div>
        <div class="leaderboardStat">${entry.bestLevel || 1}</div>
        <div class="leaderboardStat">${entry.bestWave || 0}</div>
        <div class="leaderboardStat">${entry.mapsCleared || 0}</div>
        <div class="leaderboardStat">${entry.kills || 0}</div>
        <div class="leaderboardStat">${entry.bestCombo || 0}</div>
        <div class="leaderboardStat">${entry.leaks || 0}</div>
        <div class="leaderboardStat">${entry.towersBuilt || 0}</div>
        <div class="leaderboardStat">${fmt(entry.gold || 0)}</div>
      </div>
    `).join("");
    leaderboardBodyEl.innerHTML = `
      <div class="leaderboardMeta">
        <div class="leaderboardCurrent">${this.playerProfile ? `Pilot: ${escapeHtml(this.playerProfile.name)}` : "Guest Pilot"}</div>
        <div class="leaderboardNote">Click any pilot to inspect their full stats.</div>
      </div>
      ${selectedSummary}
      <div class="leaderboardProfile">
        <label>Username <input id="leaderboardNameInput" type="text" maxlength="18" autocomplete="username" value="${escapeHtml(this.playerProfile?.name || "")}"></label>
        <label>Password <input id="leaderboardPasswordInput" type="password" maxlength="32" autocomplete="current-password"></label>
        <button id="leaderboardCreateBtn" class="btn primary" type="button">Create</button>
        <button id="leaderboardLoginBtn" class="btn ghost" type="button">Login</button>
      </div>
      <div class="leaderboardTable">
        <div class="leaderboardRow header">
          <div>Rank</div><div>Pilot</div><div>Score</div><div>Level</div><div>Wave</div><div>Maps</div><div>Kills</div><div>Combo</div><div>Leaks</div><div>Towers</div><div>Gold</div>
        </div>
        ${rows || `<div class="leaderboardRow"><div class="leaderboardStat">-</div><div class="leaderboardName">No pilots yet</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div><div class="leaderboardStat">-</div></div>`}
      </div>
      ${this.playerProfile ? `<div class="modalFooter"><button id="leaderboardLogoutBtn" class="btn ghost" type="button">Logout</button></div>` : ""}
    `;
    document.getElementById("leaderboardCreateBtn")?.addEventListener("click", () => this._createOrLoginProfile("create"));
    document.getElementById("leaderboardLoginBtn")?.addEventListener("click", () => this._createOrLoginProfile("login"));
    document.getElementById("leaderboardLogoutBtn")?.addEventListener("click", () => this._logoutProfile());
    leaderboardBodyEl.querySelectorAll("[data-pilot-id]").forEach((row) => {
      const select = () => this._selectLeaderboardPilot(row.getAttribute("data-pilot-id"));
      row.addEventListener("click", select);
      row.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          select();
        }
      });
    });
  }

  _openLeaderboardModal() {
    this._renderLeaderboardModal();
    leaderboardModalEl?.classList.remove("hidden");
    leaderboardModalEl?.setAttribute("aria-hidden", "false");
    document.getElementById("leaderboardNameInput")?.focus();
    this._refreshRemoteLeaderboard();
  }

  async _refreshRemoteLeaderboard() {
    if (!LEADERBOARD_API_BASE) return;
    try {
      const data = await this._apiRequest("/api/leaderboard");
      if (Array.isArray(data?.leaderboard)) {
        const activeEntry = this.playerProfile ? this._leaderboardEntryForProfile(false) : null;
        const localActive = activeEntry ? { ...activeEntry } : null;
        this.leaderboard = [];
        for (const e of data.leaderboard) this._mergeLeaderboardEntry(e);
        if (localActive) this._mergeLeaderboardEntry(localActive);
        this._syncLeaderboardStats({ push: false });
        this._renderLeaderboardModal();
      }
    } catch (err) {}
  }

  _closeLeaderboardModal() {
    leaderboardModalEl?.classList.add("hidden");
    leaderboardModalEl?.setAttribute("aria-hidden", "true");
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
      objectivesCompleted: src.objectivesCompleted || 0,
      bestCombo: src.bestCombo || 0,
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
      acc.objectivesCompleted += h.objectivesCompleted || 0;
      acc.bestCombo = Math.max(acc.bestCombo || 0, h.bestCombo || 0);
      return acc;
    }, { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, objectivesCompleted: 0, bestCombo: 0 });
    this.playerStats.mapsCleared = Math.max(this.playerStats.mapsCleared || 0, history.length);
    this.playerStats.kills = Math.max(this.playerStats.kills || 0, totals.kills);
    this.playerStats.leaks = Math.max(this.playerStats.leaks || 0, totals.leaks);
    this.playerStats.gold = Math.max(this.playerStats.gold || 0, totals.gold);
    this.playerStats.towersBuilt = Math.max(this.playerStats.towersBuilt || 0, totals.towersBuilt);
    this.playerStats.bosses = Math.max(this.playerStats.bosses || 0, totals.bosses);
    this.playerStats.objectivesCompleted = Math.max(this.playerStats.objectivesCompleted || 0, totals.objectivesCompleted);
    this.playerStats.bestCombo = Math.max(this.playerStats.bestCombo || 0, totals.bestCombo || 0, this.comboBest || 0);
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

  getTurretBuildLimit(key) {
    return TURRET_BUILD_LIMITS[key] ?? 5;
  }

  getTurretBuildCount(key) {
    return this.turrets.reduce((count, turret) => count + (turret.typeKey === key ? 1 : 0), 0);
  }

  isTurretBuildCapped(key) {
    const limit = this.getTurretBuildLimit(key);
    return Number.isFinite(limit) && this.getTurretBuildCount(key) >= limit;
  }

  turretBuildLimitLabel(key) {
    const limit = this.getTurretBuildLimit(key);
    return Number.isFinite(limit) ? `${this.getTurretBuildCount(key)}/${limit}` : "Unlimited";
  }

  isTowerUnlocked(key) {
    const wave = Math.max(1, this.wave || 1);
    return wave >= this.getUnlockWave(key);
  }

  getTurretBuildHotkey(key) {
    return TURRET_BUILD_HOTKEYS[key] || "";
  }

  _trySelectBuildMode(key, fromHotkey = false) {
    const t = TURRET_TYPES[key];
    if (!t) return false;
    if (this.isPaused()) {
      toast("Cannot build while paused.");
      return false;
    }
    if (!this.isTowerUnlocked(key)) {
      if (fromHotkey) toast(`${t.name} unlocks at Wave ${this.getUnlockWave(key)}.`);
      return false;
    }
    if (this.isTurretBuildCapped(key)) {
      toast(`${t.name} limit reached (${this.turretBuildLimitLabel(key)}).`);
      return false;
    }
    if (this.gold < t.cost) {
      toast("Not enough gold.");
      return false;
    }
    this.audio.unlock();
    this.setBuildMode(key);
    if (leftPanel && !leftPanel.classList.contains("pinned")) {
      this.panelHold.left = Math.max(this.panelHold.left || 0, fromHotkey ? 0.8 : 0.2);
      leftPanel.classList.add("collapsed");
    }
    return true;
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
      const capped = this.isTurretBuildCapped(key);
      item.classList.toggle("locked", !unlocked);
      item.classList.toggle("poor", unlocked && !affordable);
      item.classList.toggle("capped", unlocked && capped);
      const capTag = item.querySelector(".turretCap");
      if (capTag) capTag.textContent = `Cap ${this.turretBuildLimitLabel(key)}`;
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
      `<div class="tiny">Bosses Defeated: ${p.bosses}</div>`,
      `<div class="tiny">Objectives Completed: ${p.objectivesCompleted || 0}</div>`
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
          <div class="statsRow"><div class="k">Objective</div><div class="v">${this._objectiveProgressText()}</div></div>
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
      const hotkey = this.getTurretBuildHotkey(key);
      const item = document.createElement("div");
      item.className = "buildItem";
      item.dataset.key = key;
      item.dataset.icon = key;
      item.dataset.unlock = String(this.getUnlockWave(key));
      item.innerHTML = `
        <div class="buildIcon" data-icon="${key}" aria-hidden="true">
          <span class="buildIconGlow"></span>
        </div>
        <div class="buildMeta">
          <div class="buildNameRow">
            <div class="buildName">${t.name}</div>
            ${hotkey ? `<span class="buildHotkey">${hotkey}</span>` : ""}
          </div>
          <div class="buildDesc">${t.desc}</div>
          <div class="buildCost">
            <span class="tag">${t.role}</span>
            <span>${t.cost}g</span>
            <span class="turretCap"></span>
          </div>
          <div class="lockTag">Unlocks at Wave ${this.getUnlockWave(key)}</div>
        </div>
      `;
      item.title = `${t.name} — ${t.cost}g`;
      item.addEventListener("click", () => {
        this._trySelectBuildMode(key, false);
      });
      buildList.appendChild(item);
    }
    this._refreshBuildList();
  }

  _topbarPillTooltip(type) {
    if (type === "anomaly") {
      if (!this.waveAnomaly) {
        return "Anomaly: temporary wave rule. None is active right now, but later waves can change enemy shields, slows, movement, or projectile behavior.";
      }
      const detail = ANOMALY_TOOLTIP_DETAILS[this.waveAnomaly.key] || this.waveAnomaly.desc;
      return `Anomaly: ${this.waveAnomaly.name}. ${detail} Current rule: ${this.waveAnomaly.desc}`;
    }
    if (type === "objective") {
      if (!this.levelObjective) {
        return "Objective: optional level challenge. Complete it for bonus gold and better leaderboard progress.";
      }
      const state = this.levelObjective.complete
        ? "Complete"
        : (this.levelObjective.failed ? "Missed" : "Active");
      const detail = OBJECTIVE_TOOLTIP_DETAILS[this.levelObjective.key] || this.levelObjective.desc;
      const progress = this._objectiveProgressText();
      return `Objective: ${this.levelObjective.name} (${state}). ${detail} Progress: ${progress}. Reward: ${fmt(this.levelObjective.reward || 0)}g.`;
    }
    if (type === "feature") {
      const feature = this.map?.feature;
      if (!feature) {
        return "Feature: special map rule. Each level can add a different battlefield bonus, hazard, or build modifier.";
      }
      const detail = FEATURE_TOOLTIP_DETAILS[feature.key] || feature.desc;
      return `Feature: ${feature.name}. ${detail} Current rule: ${feature.desc}`;
    }
    return "";
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
    if (objectiveLabelEl) objectiveLabelEl.textContent = this._objectiveProgressText();
    if (objectivePillEl) {
      objectivePillEl.classList.toggle("objectiveComplete", !!this.levelObjective?.complete);
      objectivePillEl.classList.toggle("objectiveFailed", !!this.levelObjective?.failed);
      objectivePillEl.removeAttribute("title");
    }
    if (mapFeatureLabelEl) mapFeatureLabelEl.textContent = this.map?.feature?.name || "-";
    if (mapFeaturePillEl) mapFeaturePillEl.removeAttribute("title");
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

    // CODEX CHANGE: Hit Combo HUD update (reuses single DOM nodes, no DOM churn).
    if (comboCascadeEl && comboCascadeCountEl) {
      const comboActive = this.comboCount > 0;
      const comboShow = comboActive;
      const life = comboActive ? clamp(this.comboTimer / Math.max(0.001, this.comboWindow), 0, 1) : 0;
      const hits = this.comboCount | 0;
      const bonusPct = comboActive ? Math.round((this.comboMult - 1) * 100) : 0;
      const rank = comboRankForCount(hits);
      const comboText = comboActive ? `${hits}x` : "";
      comboCascadeEl.classList.toggle("active", comboShow);
      comboCascadeEl.classList.toggle("tier10", this.comboCount >= 10);
      comboCascadeEl.classList.toggle("tier15", this.comboCount >= 15);
      comboCascadeEl.classList.toggle("tier24", this.comboCount >= 24);
      comboCascadeEl.dataset.comboRank = rank;
      comboCascadeEl.style.setProperty("--combo-heat", String(clamp(hits / 28, 0, 1)));
      comboCascadeEl.style.opacity = comboShow ? "1" : "0";
      comboCascadeEl.style.setProperty("--combo-life", String(life));
      comboCascadeEl.style.setProperty("--combo-count", String(Math.max(1, this.comboCount | 0)));
      comboCascadeCountEl.textContent = comboText;
      if (comboCascadeBonusEl) comboCascadeBonusEl.textContent = comboActive ? `${rank}  +${bonusPct}% GOLD` : "";
    }
    if (screenFxEl) {
      screenFxEl.classList.toggle("comboTier10", this.comboCount >= 10);
      screenFxEl.classList.toggle("comboTier15", this.comboCount >= 15);
      screenFxEl.classList.toggle("comboTier24", this.comboCount >= 24);
    }

    const controlsLocked = this.gameState !== GAME_STATE.GAMEPLAY;
    startBtn.disabled = this.menuOpen || this.gameOver || this.gameWon || this.statsOpen || this.tutorialOpen || this._transitioning || controlsLocked;
    startBtn.textContent = this.hasStarted ? "SKIP" : "START";

    if (this.abilities && abilityScanCd) {
      this._refreshAbilityCooldowns();
      const scan = this.abilities.scan;
      const pulse = this.abilities.pulse;
      const over = this.abilities.overcharge;
      const scanLevel = this._abilityUpgradeLevel("scan");
      const pulseLevel = this._abilityUpgradeLevel("pulse");
      const overLevel = this._abilityUpgradeLevel("overcharge");
      const pulsePower = this.getPulseBurstMultipliers();
      if (abilityScanBtn) {
        abilityScanBtn.dataset.tooltip = `EMP Pulse LV ${scanLevel}: destroys shields and energizes EMP kill waves for ${(4.6 + scanLevel * 0.8).toFixed(1)}s. ${scan.cd}s cooldown.`;
        abilityScanBtn.removeAttribute("title");
      }
      if (abilityPulseBtn) {
        abilityPulseBtn.dataset.tooltip = `Pulse Burst LV ${pulseLevel}: select a turret for x${pulsePower.dmg.toFixed(2)} damage and x${pulsePower.rate.toFixed(2)} fire rate for ${30 + pulseLevel * 3}s. ${pulse.cd}s cooldown.`;
        abilityPulseBtn.removeAttribute("title");
      }
      if (abilityOverBtn) {
        abilityOverBtn.dataset.tooltip = `Overcharge LV ${overLevel}: all turret fire rates x${this.getOverchargeRateMultiplier().toFixed(2)} for ${30 + overLevel * 3}s. ${over.cd}s cooldown.`;
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
      if (powerTokenCountEl) powerTokenCountEl.textContent = String(this.abilityPowerTokens || 0);
      if (abilityScanRankEl) abilityScanRankEl.textContent = `LV ${scanLevel}`;
      if (abilityPulseRankEl) abilityPulseRankEl.textContent = `LV ${pulseLevel}`;
      if (abilityOverRankEl) abilityOverRankEl.textContent = `LV ${overLevel}`;
      abilityUpgradeBtns.forEach((btn) => {
        const key = btn.dataset.upgradeAbility;
        const cost = this._abilityUpgradeCost(key);
        btn.disabled = (this.abilityPowerTokens || 0) < cost;
        btn.title = `Upgrade ${key === "scan" ? "EMP Pulse" : key === "pulse" ? "Pulse Burst" : "Overcharge"} to LV ${this._abilityUpgradeLevel(key) + 1} (${cost} Power Token${cost === 1 ? "" : "s"})`;
      });
    }

    if (anomalyLabel) {
      if (this.waveAnomaly) {
        anomalyLabel.textContent = this.waveAnomaly.name;
        anomalyPill?.removeAttribute("title");
        anomalyPill?.classList.add("active");
      } else {
        anomalyLabel.textContent = "—";
        anomalyPill?.removeAttribute("title");
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

  _abilityUpgradeLevel(key) {
    return Math.max(0, Number(this.abilityUpgrades?.[key]) | 0);
  }

  _abilityUpgradeCost(key) {
    const nextLevel = this._abilityUpgradeLevel(key) + 1;
    if (nextLevel <= 3) return 1;
    if (nextLevel <= 6) return 2;
    return 3;
  }

  _resetAbilityRuntimeState() {
    this._refreshAbilityCooldowns();
    if (this.abilities) {
      for (const ability of Object.values(this.abilities)) {
        ability.t = 0;
      }
    }
    this.globalOverchargeT = 0;
    for (const turret of this.turrets || []) {
      turret.pulseBoostT = 0;
    }
  }

  _refreshAbilityCooldowns() {
    if (!this.abilities) return;
    this.abilities.scan.cd = Math.max(48, ABILITY_COOLDOWN - this._abilityUpgradeLevel("scan") * 4);
    this.abilities.pulse.cd = Math.max(54, ABILITY_COOLDOWN - this._abilityUpgradeLevel("pulse") * 3);
    this.abilities.overcharge.cd = Math.max(54, OVERCHARGE_COOLDOWN - this._abilityUpgradeLevel("overcharge") * 3);
  }

  _grantAbilityPowerToken() {
    this.abilityPowerTokens = Math.max(0, Number(this.abilityPowerTokens) | 0) + 1;
    setTimeout(() => toast(`POWER TOKEN EARNED: ${this.abilityPowerTokens} banked`), 520);
  }

  upgradeAbility(key) {
    if (!["scan", "pulse", "overcharge"].includes(key)) return false;
    const cost = this._abilityUpgradeCost(key);
    if ((this.abilityPowerTokens || 0) < cost) {
      toast(`NEED ${cost} POWER TOKENS`);
      return false;
    }
    this.abilityPowerTokens -= cost;
    this.abilityUpgrades[key] = this._abilityUpgradeLevel(key) + 1;
    this._refreshAbilityCooldowns();
    this.audio?.playLimited("upgrade", 120);
    toast(`${key === "scan" ? "EMP PULSE" : key === "pulse" ? "PULSE BURST" : "OVERCHARGE"} UPGRADED TO LV ${this.abilityUpgrades[key]}`);
    this.updateHUD();
    this._save();
    return true;
  }

  getPulseBurstMultipliers() {
    const level = this._abilityUpgradeLevel("pulse");
    return { rate: 4 + level * 0.22, dmg: 2 + level * 0.18 };
  }

  getOverchargeRateMultiplier() {
    return 1.35 + this._abilityUpgradeLevel("overcharge") * 0.06;
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
        const scanLevel = this._abilityUpgradeLevel("scan");
        const empDuration = 4.6 + scanLevel * 0.8;
        let found = 0;
        let shields = 0;
        for (const e of this.enemies) {
          if (!e || e._dead) continue;
          e.empT = Math.max(Number(e.empT) || 0, empDuration);
          setStatusState(e, STATUS.EMP, { duration: e.empT });
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
          t: 3.1,
          dur: 3.1,
          max: Math.max(W, H) * 1.12,
          col: "rgba(210,252,255,0.82)",
          boom: false
        });
        this.map?.triggerEmpPulse?.();
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
        const pulseDuration = 30 + this._abilityUpgradeLevel("pulse") * 3;
        this.selectedTurret.pulseBoostT = pulseDuration;
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
        this.map?.triggerAbilityActivationPulse?.("pulseBurst", this.selectedTurret.x, this.selectedTurret.y);
        this.audio.playLimited("upgrade", 220);
        const pulsePower = this.getPulseBurstMultipliers();
        toast(`PULSE BURST: turret damage x${pulsePower.dmg.toFixed(2)} and fire rate x${pulsePower.rate.toFixed(2)} for ${pulseDuration}s`);
        break;
      }
      case "overcharge": {
        ability.t = ability.cd;
        const overchargeDuration = 30 + this._abilityUpgradeLevel("overcharge") * 3;
        this.globalOverchargeT = overchargeDuration;
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
        this.map?.triggerAbilityActivationPulse?.("overcharge", W * 0.5, H * 0.5);
        this.audio.playLimited("upgrade", 220);
        toast(`OVERCHARGE: all turrets fire x${this.getOverchargeRateMultiplier().toFixed(2)} faster for ${overchargeDuration}s`);
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
    // Canvas dimensions may change, but a live battlefield must remain immutable.
    // Rebuilding here changes the path beneath placed turrets and active enemies.
    this._syncMusicHudGeometry();
    this._positionTutorialSpotlight();
    // CODEX CHANGE: Fit the immutable battlefield to the resized viewport through the camera transform.
    const mapWidth = Math.max(MAP_GRID_SIZE, (this.map?.cols || 1) * MAP_GRID_SIZE);
    const mapHeight = Math.max(MAP_GRID_SIZE, (this.map?.rows || 1) * MAP_GRID_SIZE);
    const fitZoom = clamp(Math.min(W / mapWidth, H / mapHeight), 0.45, 1.65);
    this.zoom = fitZoom;
    this.cam.x = mapWidth * 0.5 - W * 0.5;
    this.cam.y = mapHeight * 0.5 - H * 0.5;
    this.camStart.x = this.cam.x;
    this.camStart.y = this.cam.y;
    // CODEX CHANGE: Re-measure the floating HUD after viewport changes.
    this._invalidateTurretHudLayout();
    this._updateTurretHudPosition();
  }

  _waveScalar(wave) {
    const i = wave - 1;
    const profile = this._levelProfile();
    const earlyHp = wave === 1 ? 0.82 : wave === 2 ? 0.92 : 1;
    const earlySpd = wave === 1 ? 0.9 : wave === 2 ? 0.96 : 1;
    const late = Math.max(0, wave - 8);
    const latePow = Math.pow(late, 1.12) * 0.019;
    const post2 = Math.max(0, wave - 2);
    const post2Boost = 1 + post2 * 0.035;
    const levelHp = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_HP_SCALE;
    const levelSpd = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_SPD_SCALE;
    const levelDef = 1 + Math.max(0, this.levelIndex - 1) * 0.02;
    const levelReward = 1 + Math.max(0, this.levelIndex - 1) * 0.03;
    return {
      hp: (1 + i * 0.112 + latePow) * earlyHp * 1.35 * post2Boost * levelHp * profile.hp,
      spd: (1 + i * 0.013) * earlySpd * 1.05 * (1 + post2 * 0.01) * levelSpd * profile.spd,
      armor: (i * 0.0048 + Math.max(0, wave - 12) * 0.0035) * 1.12 * (1 + post2 * 0.012) * levelDef * profile.armor,
      shield: (1 + i * 0.055 + Math.max(0, wave - 12) * 0.015) * 1.07 * (1 + post2 * 0.012) * levelDef * profile.shield,
      regen: (1 + i * 0.035 + Math.max(0, wave - 12) * 0.015) * 1.08 * (1 + post2 * 0.008) * levelDef * profile.regen,
      reward: (1 + i * 0.045) * 1.08 * levelReward
    };
  }

  _levelProfile() {
    const idx = Math.max(0, (this.levelIndex - 1) % LEVEL_PROFILES.length);
    return LEVEL_PROFILES[idx] || LEVEL_PROFILES[0];
  }

  _levelEnemyDensity() {
    const level = Math.max(1, Number(this.levelIndex) || 1);
    return Math.min(1.9, 1 + (level - 1) * 0.11 + Math.max(0, level - 5) * 0.025);
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

  _spaceHeavySpawns(spawns) {
    const heavyTypes = new Set(["BRUTE", "ARMORED", "SHIELDED", "REGEN", "BOSS_PROJECTOR"]);
    const ordered = [...spawns].sort((a, b) => a.t - b.t);
    let lastHeavyT = -Infinity;
    for (const spawn of ordered) {
      if (spawn.finalBoss) {
        // The main boss entrance is intentionally fixed at 10 seconds on Wave 16.
        lastHeavyT = Math.max(lastHeavyT, spawn.t);
        continue;
      }
      const heavy = heavyTypes.has(spawn.type) || spawn.eliteTag === "HARDENED";
      if (!heavy) continue;
      const gap = spawn.miniboss ? 1.8 : 1.12;
      spawn.t = Math.max(spawn.t, lastHeavyT + gap);
      lastHeavyT = spawn.t;
    }
    ordered.sort((a, b) => a.t - b.t);
    return ordered;
  }

  _buildWave(wave, scalar) {
    const i = wave;
    const profile = this._levelProfile();
    if (wave === this.waveMax) {
      // Give the final boss a musical buildup while keeping its defeat as the win condition.
      const bossScalar = scalar;
      const escortScalar = { ...scalar, hp: scalar.hp * 0.98, reward: scalar.reward * 0.88 };
      const escortTypes = ["RUNNER", "ARMORED", "SHIELDED", "PHASE", "REGEN", "SHIELD_DRONE", "BRUTE", "STEALTH"];
      const escortCount = Math.min(54, 24 + Math.max(0, this.levelIndex - 1) * 3);
      const escorts = Array.from({ length: escortCount }, (_, n) => ({
        t: 0.7 + n * 1.12,
        type: escortTypes[n % escortTypes.length],
        scalar: escortScalar,
        eliteTag: n >= 10 && n % 4 === 0 ? pick(["HARDENED", "VOLATILE", "PHASELINK"]) : null
      }));
      escorts.push({ t: 10, type: this._getBossKey(), scalar: bossScalar, finalBoss: true });
      return this._spaceHeavySpawns(escorts);
    }
    const earlyCounts = [0, 15, 20, 24, 29];
    const baseCount = wave <= 4
      ? earlyCounts[wave]
      : Math.round(24 + Math.floor(i * 2.9) + Math.max(0, i - 9) * 1.05 + Math.max(0, i - 13) * 1.25);
    const spacing = (wave === 1) ? 1.15
      : (wave === 2 ? 1.08
      : (wave === 3 ? 1.02
      : (wave === 4 ? 0.98
      : Math.max(0.54, 0.94 - i * 0.018))));
    const profileCountFlavor = 1 + (profile.count - 1) * 0.25;
    const earlyCountMul = profileCountFlavor * this._levelEnemyDensity();
    const levelCountBonus = Math.min(20, Math.max(0, this.levelIndex - 1));
    const earlySpacingMul = (wave <= 5 ? 1.02 : 1) * profile.spacing;
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
      const pool = types.map(t => ({ t, w: (weights[t] || 1) * (profile.weights[t] || 1) }));
      const sum = pool.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * sum;
      for (const p of pool) { r -= p.w; if (r <= 0) return p.t; }
      return pool[pool.length - 1].t;
    };

    for (let n = 0; n < Math.max(1, Math.floor(baseCount * earlyCountMul) + levelCountBonus); n++) {
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
      const flowEnd = spawns.length ? spawns[spawns.length - 1].t : 12;
      const escortTypes = ["BRUTE", "ARMORED", "SHIELDED", "PHASE", "REGEN", "SHIELD_DRONE"];
      const escortCount = Math.min(16, (i >= 15 ? 8 : i >= 10 ? 6 : 4) + Math.max(0, this.levelIndex - 1));
      for (let n = 0; n < escortCount; n++) {
        spawns.push({
          t: flowEnd * (0.18 + n * (0.58 / Math.max(1, escortCount - 1))),
          type: escortTypes[n % escortTypes.length],
          scalar
        });
      }
      spawns.push({ t: Math.max(4.2, flowEnd * 0.86), type: "BOSS_PROJECTOR", scalar, miniboss: true });
    }

    return this._spaceHeavySpawns(spawns);
  }

  startWave() {
    if (this.gameState !== GAME_STATE.GAMEPLAY) return;
    if (this.gameOver || this.gameWon) return;
    if (this.wave >= this.waveMax) return;

    this.wave++;
    if (this.wave === this.waveMax) this.finalBossDefeated = false;
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
    if (this.wave === 1) this._startFirstWaveTutorial();
    else this._showNewPlayerWaveTip(this.wave);
    const spawn = this.map?.pathPts?.[0];
    if (spawn) {
      this._spawnEnergyBurst(spawn[0], spawn[1], {
        tint: "rgba(98,242,255,0.88)",
        alt: "rgba(154,108,255,0.78)",
        linger: "rgba(98,242,255,0.18)",
        scale: 1.15
      });
    }
    this.audio.play("wave");
  }

  spawnEnemy(typeKey, startD = 0, scalarOverride = null, eliteTag = null) {
    const scalar = this._sanitizeWaveScalar(scalarOverride || this.waveScalar);
    const safeStartD = clamp(Number(startD) || 0, 0, Math.max(0, (this.map?.totalLen || 1) - 2));
    const e = new Enemy(typeKey, scalar, safeStartD, eliteTag);
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
    const objective = this.levelObjective;
    if (objective?.key === "PRIORITY_HUNT" && !objective.complete && !objective.failed && !e.isBoss && typeKey !== "MINI") {
      objective._eligibleSpawnCount = (objective._eligibleSpawnCount || 0) + 1;
      const remaining = Math.max(0, (objective.priorityGoal || 0) - (objective.prioritySpawned || 0));
      if (remaining > 0 && objective._eligibleSpawnCount % 7 === 0) {
        e.objectivePriority = true;
        objective.prioritySpawned = (objective.prioritySpawned || 0) + 1;
      }
    }
    const p = this.map.posAt(safeStartD);
    e.x = p.x; e.y = p.y; e.ang = p.ang;
    this.enemies.push(e);
    return e;
  }

  _save() {
    try {
      this._syncLeaderboardStats();
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
          poolsN: this.mapData.poolsN,
          feature: this.mapData.feature || null,
          featureCells: Array.from(this.map.featureCells || []).map(idx => ({
            gx: idx % this.map.cols,
            gy: Math.floor(idx / this.map.cols)
          }))
        } : null,
        mapStats: this.mapStats || [],
        playerStats: this.playerStats || this._newPlayerStats(),
        levelObjective: this.levelObjective,
        gold: this.gold,
        lives: this.lives,
        wave: this.wave,
        waveMax: this.waveMax,
        hasStarted: this.hasStarted,
        waveActive: this.waveActive,
        intermission: this.intermission,
        skipBuff: this.skipBuff,
        finalBossDefeated: !!this.finalBossDefeated,
        waveAnomaly: this.waveAnomaly ? this.waveAnomaly.key : null,
        warpRippleT: this._warpRippleT,
        speed: this.speed,
        powerCells: this.map.powerCells,
        spawnQueue: this.spawnQueue,
        spawnIndex: this.spawnIndex,
        spawnT: this.spawnT,
        waveScalar: this.waveScalar,
        globalOverchargeT: this.globalOverchargeT,
        abilityPowerTokens: this.abilityPowerTokens || 0,
        abilityUpgrades: { ...(this.abilityUpgrades || {}) },
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
          objectivePriority: !!e.objectivePriority,
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
      return true;
    } catch (err) {
      // ignore storage errors (private mode, quota, etc.)
      return false;
    }
  }

  // CODEX CHANGE: Reuse one confirmation path for the desktop button and Escape key.
  _promptSaveAndExit() {
    if (!desktopBridge?.isDesktop) return;
    showConfirm("Save & Exit", "Save your current run and exit Orbit Echo?", () => {
      this.saveNow();
      void desktopBridge.exit?.();
    });
  }

  // CODEX CHANGE: Provide one public save entry point for UI, lifecycle, and Electron shutdown.
  saveNow(notify = false) {
    const saved = this._save();
    if (notify) toast(saved ? "Progress saved." : "Unable to save progress.");
    return saved;
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
          bosses: data.playerStats.bosses || 0,
          objectivesCompleted: data.playerStats.objectivesCompleted || 0,
          bestCombo: data.playerStats.bestCombo || 0
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
          poolsN: Array.isArray(data.mapData.poolsN) ? data.mapData.poolsN : [],
          feature: data.mapData.feature || null,
          featureCells: Array.isArray(data.mapData.featureCells) ? data.mapData.featureCells : null
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
      this.finalBossDefeated = !!data.finalBossDefeated;
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
      this.abilityPowerTokens = Math.max(0, Number(data.abilityPowerTokens) | 0);
      this.abilityUpgrades = {
        scan: Math.max(0, Number(data.abilityUpgrades?.scan) | 0),
        pulse: Math.max(0, Number(data.abilityUpgrades?.pulse) | 0),
        overcharge: Math.max(0, Number(data.abilityUpgrades?.overcharge) | 0)
      };
      this._refreshAbilityCooldowns();
      this.levelObjective = this._createLevelObjective(data.levelObjective || null);

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
          if (this.map.featureAtCell?.(t.gx, t.gy)?.key === "AMPLIFIER_NODES") t.applyMapFeatureBoost();
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
          e.objectivePriority = !!s.objectivePriority;
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
    this.firstWaveTutorialShown = true;
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
    this.disruptionClouds = [];
    this.disruptionShots = [];
    this.explosions = [];
    this.screenFlashes = [];
    this.delayedEnemyFx = [];
    this.decals = [];
    this.floatText = [];
    this._textLimiter = new globalThis.Map();

    this.gold = this._getStartGold();
    this.lives = START_LIVES;
    this.wave = 0;
    this.waveMax = 16;
    this.hasStarted = false;
    this.waveActive = false;
    this.intermission = 0;
    this.finalBossDefeated = false;
    // Preserve onboarding state across retries and later levels. Starting a
    // brand-new game explicitly clears this flag in the landing-menu flow.
    this.firstWaveTutorialShown = !!this.firstWaveTutorialShown;
    this.tutorialOpen = false;
    this._tutorialQueue = [];
    this._tutorialIndex = 0;
    this._tutorialExpandedBuildPanel = false;
    tutorialModalEl?.classList.add("hidden");
    tutorialModalEl?.setAttribute("aria-hidden", "true");
    tutorialSpotlightEl?.classList.add("hidden");
    tutorialSpotlightEl?.removeAttribute("style");
    tutorialCardEl?.removeAttribute("style");
    tutorialModalEl?.removeAttribute("data-placement");
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
    // CODEX CHANGE: Hide the selected-head waveform immediately when a run is reset or replaced.
    this.selectedTurretWaveform?.clear(true);
    this.hudOuterWaveform?.clear(true);
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
    this.levelObjective = this._createLevelObjective();
    this.mapStats = this.mapStats || [];
    this.playerStats = this.playerStats || this._newPlayerStats();
    this._resetAbilityRuntimeState();
    this._refreshBuildList();
    this.updateHUD();
  }

  _spawnEnemyDeathFx(enemy) {
    const x = enemy.x;
    const y = enemy.y;
    const tint = enemy.tint || "rgba(255,207,91,0.85)";
    const type = enemy.typeKey || "";
    const vfxScale = getEnemyVfxScale();
    const count = (base, min = 1, max = 80) => clamp(Math.round(base * vfxScale), min, max);
    const isFinalBoss = type.startsWith("FINAL_BOSS_");
    const isMiniBoss = type === "BOSS_PROJECTOR" || type.includes("MINIBOSS");

    const addShockwave = (r, dur, max, col, boom = false, delay = 0) => {
      if (delay > 0) {
        this.delayedEnemyFx.push({
          delay,
          spawn: { type: "shockwave", x, y, r, dur, max, col: col || tint, boom }
        });
        return;
      }
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
    const addBurst = (n, kind, color, delay = 0) => {
      if (delay > 0) {
        this.delayedEnemyFx.push({
          delay,
          spawn: { type: "particles", x, y, n, kind, tint: color || tint }
        });
        return;
      }
      this.particles.spawn(x, y, n, kind, color || tint);
    };
    const addScreenFlash = (r, dur, max, col, delay = 0) => {
      if (delay > 0) {
        this.delayedEnemyFx.push({
          delay,
          spawn: { type: "screenFlash", x, y, r, dur, max, col }
        });
        return;
      }
      this.screenFlashes.push({ x, y, r, t: dur, dur, max, col });
    };

    const addShake = (t, mag) => {
      this.shakeT = Math.min(0.32, this.shakeT + t);
      this.shakeMag = Math.min(10, this.shakeMag + mag);
    };

    switch (type) {
      case "RUNNER":
      case "MINI":
        addBurst(count(14, 10, 24), "shard", tint);
        addBurst(count(2, 1, 4), "boom", "rgba(234,240,255,0.85)");
        addShockwave(8, 0.2, 38, tint, false);
        addScreenFlash(12, 0.12, 54, "rgba(234,240,255,0.18)");
        addShake(0.05, 0.8);
        break;
      case "BRUTE":
        addBurst(count(16, 10, 25), "boom", tint);
        addBurst(count(3, 1, 4), "shard", "rgba(255,230,190,0.9)");
        addShockwave(14, 0.48, 104, tint, false);
        addShockwave(12, 0.36, 72, "rgba(255,240,190,0.7)", true);
        addScreenFlash(22, 0.16, 92, "rgba(255,207,91,0.2)");
        addShake(0.13, 2.4);
        break;
      case "ARMORED":
        addBurst(count(15, 10, 24), "shard", "rgba(200,220,255,0.95)");
        addBurst(count(2, 1, 4), "boom", "rgba(210,225,255,0.85)");
        addShockwave(12, 0.44, 92, "rgba(160,190,255,0.95)", false);
        addShockwave(10, 0.32, 62, "rgba(234,240,255,0.75)", true);
        addScreenFlash(18, 0.15, 76, "rgba(205,225,255,0.18)");
        addShake(0.11, 2.0);
        break;
      case "SHIELDED":
      case "SHIELD_DRONE":
      case "BOSS_PROJECTOR":
        addShockwave(10, 0.2, 54, "rgba(154,108,255,0.95)", false);
        addBurst(count(12, 8, 20), "shard", "rgba(154,108,255,0.95)");
        addShockwave(14, 0.34, 78, tint, true, 0.06);
        addBurst(count(10, 8, 20), "boom", tint, 0.06);
        addScreenFlash(20, 0.16, 80, "rgba(154,108,255,0.22)");
        addShake(0.1, 1.8);
        break;
      case "SPLITTER":
        addBurst(count(14, 10, 22), "chem", "rgba(255,207,91,0.92)");
        addBurst(count(2, 1, 4), "boom", "rgba(255,224,140,0.85)");
        addShockwave(12, 0.28, 62, "rgba(255,207,91,0.9)", true);
        addScreenFlash(14, 0.14, 60, "rgba(255,220,150,0.16)");
        addShake(0.08, 1.3);
        break;
      case "REGEN":
        addBurst(count(15, 10, 22), "chem", "rgba(109,255,154,0.92)");
        addBurst(count(2, 1, 4), "boom", "rgba(200,255,220,0.8)");
        addShockwave(11, 0.3, 64, "rgba(109,255,154,0.88)", true);
        addScreenFlash(16, 0.15, 68, "rgba(109,255,154,0.18)");
        this.decals.push({ x, y, r: 18, t: 1.6, col: "rgba(109,255,154,0.22)" });
        addShake(0.08, 1.3);
        break;
      case "STEALTH":
        addBurst(count(16, 10, 26), "hit", "rgba(234,240,255,0.86)");
        addBurst(count(10, 8, 20), "muzzle", "rgba(180,205,235,0.6)");
        addShockwave(8, 0.18, 34, "rgba(190,215,255,0.45)", false);
        addScreenFlash(10, 0.1, 40, "rgba(220,230,255,0.12)");
        addShake(0.04, 0.7);
        break;
      case "FLYING":
        addBurst(count(10, 8, 18), "muzzle", "rgba(98,242,255,0.9)");
        addBurst(count(3, 1, 4), "shard", "rgba(200,245,255,0.85)");
        addShockwave(10, 0.24, 44, tint, false);
        addScreenFlash(12, 0.11, 50, "rgba(98,242,255,0.16)");
        addShake(0.06, 1.0);
        break;
      case "PHASE":
        addBurst(count(15, 10, 24), "shard", "rgba(154,108,255,0.95)");
        addBurst(count(2, 1, 4), "muzzle", "rgba(195,170,255,0.8)");
        addShockwave(9, 0.2, 46, "rgba(154,108,255,0.95)", false);
        addShockwave(13, 0.28, 66, tint, true);
        addScreenFlash(14, 0.12, 58, "rgba(170,132,255,0.18)");
        addShake(0.09, 1.5);
        break;
      case "FINAL_BOSS_VORTEX":
      case "FINAL_BOSS_ABYSS":
      case "FINAL_BOSS_IRON":
        addBurst(count(22, 14, 34), "boom", tint);
        addBurst(count(14, 10, 24), "shard", "rgba(255,207,91,0.95)");
        addShockwave(18, 0.44, 130, tint, true);
        addShockwave(14, 0.38, 115, "rgba(255,120,200,0.86)", false, 0.16);
        addShockwave(12, 0.34, 102, "rgba(234,240,255,0.76)", false, 0.34);
        addBurst(count(14, 10, 24), "boom", tint, 0.16);
        addBurst(count(12, 8, 20), "shard", "rgba(255,207,91,0.95)", 0.34);
        addScreenFlash(26, 0.2, 130, "rgba(255,207,91,0.26)");
        addScreenFlash(24, 0.16, 118, "rgba(255,120,200,0.2)", 0.16);
        addScreenFlash(20, 0.14, 108, "rgba(234,240,255,0.16)", 0.34);
        this.decals.push({ x, y, r: 30, t: 3.2, col: "rgba(25,10,30,0.45)" });
        addShake(0.22, 3.4);
        break;
      default:
        if (enemy.isBoss || isMiniBoss) {
          addBurst(count(18, 10, 30), "boom", tint);
          addBurst(count(3, 1, 4), "shard", "rgba(255,230,190,0.9)");
          addShockwave(16, 0.42, 96, tint, false);
          addShockwave(12, 0.34, 72, "rgba(234,240,255,0.76)", true);
          addScreenFlash(20, 0.16, 88, "rgba(255,207,91,0.2)");
          addShake(0.16, 2.6);
        } else {
          addBurst(count(enemy.flying ? 10 : 14, 8, 20), "boom", tint);
          addBurst(count(2, 1, 3), "shard", "rgba(234,240,255,0.85)");
          addShockwave(enemy.flying ? 10 : 14, 0.3, 58, tint, true);
          addScreenFlash(enemy.flying ? 10 : 14, 0.12, enemy.flying ? 44 : 62, "rgba(255,207,91,0.16)");
          addShake(0.08, enemy.flying ? 1.0 : 1.6);
        }
        break;
    }

    if (type === "RUNNER" || type === "PHASE") {
      this.audio?.playLimited("hit", 90);
    }
    if (type === "BRUTE" || type === "ARMORED" || isMiniBoss) {
      addShockwave(14, 0.5, 108, "rgba(255,207,91,0.75)", false);
    }
    if (enemy.r >= 15 || enemy.isBoss || enemy.isFinalBoss) {
      const largeRingColor = enemy.isFinalBoss
        ? "rgba(255,207,91,0.98)"
        : enemy.isBoss
          ? "rgba(168,118,255,0.96)"
          : "rgba(255,52,52,0.96)";
      addShockwave(
        Math.max(16, enemy.r * 0.78),
        enemy.isBoss || enemy.isFinalBoss ? 3.3 : 2.8,
        Math.max(W, H) * (enemy.isBoss || enemy.isFinalBoss ? 1.35 : 1.08),
        largeRingColor,
        false
      );
    }
    if (isFinalBoss) {
      this.audio?.playLimited("explodingboss", 220);
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
      screenFxEl.classList.remove("comboTier10", "comboTier15", "comboTier24");
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
    if (this.runStats) this.runStats.bestCombo = Math.max(this.runStats.bestCombo || 0, this.comboCount);
    if (this.playerStats) this.playerStats.bestCombo = Math.max(this.playerStats.bestCombo || 0, this.comboCount);
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
    if (this.comboCount >= 24) {
      this.shakeT = Math.min(0.24, this.shakeT + ECHO_CASCADE_PULSE_SHAKE_T);
      this.shakeMag = Math.min(6, this.shakeMag + ECHO_CASCADE_PULSE_SHAKE_MAG);
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
    let reward = this._applyEchoCascadeOnKill(enemy, rewardBase);
    if (this.map?.featureAtPathD?.(enemy.pathD)?.key === "SALVAGE_RELAYS") {
      const salvageBonus = Math.max(1, Math.floor(reward * 0.35));
      reward += salvageBonus;
      enemy._salvageBonusGold = salvageBonus;
      this.spawnText(enemy.x, enemy.y - 36, `SALVAGE +${salvageBonus}g`, "rgba(255,207,91,0.98)", 1.0);
    }
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

    // CODEX CHANGE: Reward includes Hit Combo bonus and popup feedback at kill position.
    const reward = this._grantKillReward(enemy);
    const bonusPct = Math.round((this.comboMult - 1) * 100);
    const comboText = bonusPct > 0
      ? `+${reward}g  ${this.comboCount} HIT +${bonusPct}%`
      : `+${reward}g  ${this.comboCount} HIT`;
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
    if (this.levelObjective?.key === "PRIORITY_HUNT" && enemy.objectivePriority) {
      this.levelObjective.priorityKilled = (this.levelObjective.priorityKilled || 0) + 1;
      this.spawnText(enemy.x, enemy.y - 32, "PRIORITY DOWN", "rgba(255,207,91,0.98)", 1.2);
    }
    if (this.levelObjective?.key === "BOSS_INTERCEPT" && enemy.isBoss) {
      const checkpoint = (this.map?.totalLen || 1) * 0.72;
      if ((enemy.pathD || 0) <= checkpoint) {
        this.levelObjective.bossKills = (this.levelObjective.bossKills || 0) + 1;
        this.spawnText(enemy.x, enemy.y - 38, "INTERCEPTED", "rgba(109,255,154,0.98)", 1.3);
      } else {
        this.levelObjective.bossMisses = (this.levelObjective.bossMisses || 0) + 1;
        this.levelObjective.failed = true;
      }
    }
    this.audio.playLimited("kill", 80);
    const dramaticKill = enemy._overkillHit || enemy.elite || enemy.isBoss || enemy.isFinalBoss;
    const abilityKill = (Number(enemy.empT) || 0) > 0
      ? "emp"
      : enemy._lastHitBy?.pulseBoostT > 0
        ? "pulseBurst"
        : this.globalOverchargeT > 0 && enemy._lastHitBy
          ? "overcharge"
          : null;
    if (abilityKill) this.map?.triggerAbilityKillPulse?.(enemy.x, enemy.y, abilityKill, dramaticKill);
    else this.map?.triggerKillPulse?.(enemy.x, enemy.y, dramaticKill);
    const largeEnemyKill = enemy.r >= 15 && !enemy.isBoss && !enemy.isFinalBoss;
    if (largeEnemyKill && !abilityKill) this.map?.triggerLargeKillPulse?.(enemy.x, enemy.y);
    if (enemy.isBoss || enemy.isFinalBoss) {
      this.map?.triggerBossKillPulse?.(enemy.x, enemy.y, !!enemy.isFinalBoss);
    }
    emitCombatEvent(this, createCombatEvent(COMBAT_EVENT_TYPES.ENEMY_DEATH, {
      source: enemy._lastHitBy || null,
      sourceKey: enemy._lastHitBy?.typeKey || null,
      target: enemy,
      reward,
      comboCount: this.comboCount,
      comboMult: this.comboMult,
      tags: [
        enemy.isFinalBoss ? "final-boss" : null,
        enemy.isBoss ? "boss" : null,
        enemy.elite?.tag ? `elite:${enemy.elite.tag}` : null,
        dramaticKill ? "dramatic-kill" : null,
        abilityKill ? `ability:${abilityKill}` : null
      ].filter(Boolean)
    }));

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
      const source = enemy._lastHitBy;
      const splashDps = clamp(
        (Number(source.dmg) || 10) * (Number(source.dotDpsMult) || 0.32) * 0.7,
        4,
        24 + Math.max(0, this.levelIndex - 1) * 2
      );
      const splashDur = clamp((Number(source.dotDur) || 3.5) * 0.55, 1.4, 2.8);
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(enemy.x, enemy.y, e.x, e.y) <= 80 * 80) {
          e.applyDot(splashDps, splashDur);
        }
      }
    }

    // Wave 16 only clears on the main boss. Carried-over miniboss kills never advance the level.
    if (enemy.isFinalBoss && this.wave >= this.waveMax && this.gameState === GAME_STATE.GAMEPLAY) {
      this.finalBossDefeated = true;
      this._startBossCinematic(enemy);
    }
  }

  onEnemyLeak(enemy) {
    enemy._leaked = true;
    enemy.hp = 0;
    if (this.waveStats) this.waveStats.leaks += 1;
    if (this.runStats) this.runStats.leaks += 1;
    if (this.playerStats) this.playerStats.leaks += 1;
    if (this.levelObjective?.key === "CORE_INTEGRITY") {
      this.levelObjective.leaks = (this.levelObjective.leaks || 0) + 1;
      if (this.levelObjective.leaks > 2) this.levelObjective.failed = true;
    }
    if (this.levelObjective?.key === "PRIORITY_HUNT" && enemy.objectivePriority) {
      this.levelObjective.priorityEscaped = (this.levelObjective.priorityEscaped || 0) + 1;
      this.levelObjective.failed = true;
      toast("OBJECTIVE ALERT: priority target escaped");
    }
    if (this.levelObjective?.key === "BOSS_INTERCEPT" && enemy.isBoss) {
      this.levelObjective.bossMisses = (this.levelObjective.bossMisses || 0) + 1;
      this.levelObjective.failed = true;
    }
    this.lives -= enemy.isFinalBoss ? this.lives : 1;
    this.particles.spawn(enemy.x, enemy.y, 8, "boom");
    // CODEX CHANGE: Throttle leak SFX so simultaneous leaks do not hard-retrigger and sound broken.
    this.audio.playLimited("leak", 110);
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
    // CODEX CHANGE: Tile information keeps the compact rectangular HUD treatment.
    turretHud?.classList.remove("turretMode");
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
    // CODEX CHANGE: Re-measure only after the HUD content changes.
    this._invalidateTurretHudLayout();
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
    this.map.clearTileVisualEnergy?.(gx, gy);
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
    // CODEX CHANGE: Tile information keeps the compact rectangular HUD treatment.
    turretHud?.classList.remove("turretMode");
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
    // CODEX CHANGE: Re-measure only after the HUD content changes.
    this._invalidateTurretHudLayout();
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
    this._spawnEnergyBurst(w.x, w.y, {
      tint: "rgba(255,207,91,0.95)",
      alt: "rgba(109,255,154,0.88)",
      linger: "rgba(255,207,91,0.30)",
      scale: 1.25,
      power: true
    });
    this.audio.play("upgrade");
    toast(`Power tile unlocked for ${cost}g`);
    this.selectedTileCell = null;
    this.selectTurret(null);
    this._save();
  }

  _openFeatureTileHud(cell) {
    const feature = cell ? this.map.featureAtCell?.(cell.gx, cell.gy) : null;
    if (!feature) return false;
    // CODEX CHANGE: Tile information keeps the compact rectangular HUD treatment.
    turretHud?.classList.remove("turretMode");
    this.selectedTurret = null;
    this.selectedEnemy = null;
    this.selectedTileCell = { gx: cell.gx, gy: cell.gy, v: cell.v };
    sellBtn.disabled = true;
    if (turretHudSellBtn) {
      turretHudSellBtn.disabled = true;
      turretHudSellBtn.style.display = "none";
    }
    selSub.textContent = "Map Feature";
    const isBuildNode = feature.key === "AMPLIFIER_NODES";
    const behavior = isBuildNode
      ? "Build a turret here to apply the node boost immediately."
      : "This lane effect applies automatically while enemies cross it.";
    // CODEX CHANGE: Keep radial targeting compact and explicitly labeled for assistive technology.
    const hudHtml = `
      <div class="selHeaderRow">
        <div class="selName">${feature.name || "Map Feature"}</div>
        <div class="selLevel">Cell ${cell.gx},${cell.gy}</div>
      </div>
      <div class="statGrid">
        <div class="statCard"><div class="k">Type</div><div class="v">${isBuildNode ? "Build Node" : "Lane Effect"}</div></div>
        <div class="statCard"><div class="k">Status</div><div class="v">Active</div></div>
        <div class="statCard"><div class="k">Build</div><div class="v">${isBuildNode ? "Boosted" : "Blocked"}</div></div>
        <div class="statCard"><div class="k">Color</div><div class="v">Blue Feature</div></div>
      </div>
      <div class="upgrades">
        <div class="upTitle">Effect</div>
        <div class="modRow">
          <div class="modChoice">
            <div class="modTop">
              <div class="modName">${feature.name || "Feature Tile"}</div>
              <div class="modCost">AUTO</div>
            </div>
            <div class="modDesc">${feature.desc || "Special map tile."} ${behavior}</div>
          </div>
        </div>
      </div>
    `;
    if (turretHudBody) turretHudBody.innerHTML = hudHtml;
    // CODEX CHANGE: Re-measure only after the HUD content changes.
    this._invalidateTurretHudLayout();
    turretHud?.classList.remove("hidden");
    this._updateTurretHudPosition();
    return true;
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
      if (this.isTurretBuildCapped(this.buildKey)) {
        toast(`${t.name} limit reached (${this.turretBuildLimitLabel(this.buildKey)}).`);
        this.clearBuildMode();
        return;
      }
      if (this.gold < t.cost) {
        toast("Not enough gold.");
        this.clearBuildMode();
        return;
      }
      this.gold -= t.cost;
      const w = this.map.worldFromCell(cell.gx, cell.gy);
      const turret = new Turret(this.buildKey, w.x, w.y);
      if (cell.v === 3) turret.applyPowerBoost();
      if (this.map.featureAtCell?.(cell.gx, cell.gy)?.key === "AMPLIFIER_NODES") turret.applyMapFeatureBoost();
      turret.gx = cell.gx; turret.gy = cell.gy;
      this.turrets.push(turret);
      this._refreshBuildList();
      if (this.isTurretBuildCapped(this.buildKey)) this.clearBuildMode();
      if (this.waveStats && this.hasStarted && this.wave > 0) {
        this.waveStats.towersBuilt += 1;
      }
      if (this.runStats) this.runStats.towersBuilt += 1;
      if (this.playerStats) this.playerStats.towersBuilt += 1;
      // Do not auto-open upgrade HUD on placement; require explicit turret click.
      this.selectEnemy(null);
      this._spawnEnergyBurst(w.x, w.y, {
        tint: cell.v === 3 ? "rgba(255,207,91,0.95)" : "rgba(98,242,255,0.92)",
        alt: cell.v === 3 ? "rgba(109,255,154,0.78)" : "rgba(154,108,255,0.82)",
        linger: cell.v === 3 ? "rgba(255,207,91,0.22)" : "rgba(98,242,255,0.20)",
        scale: cell.v === 3 ? 1.08 : 0.88,
        power: cell.v === 3
      });
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
    if (this._openFeatureTileHud(cell)) return;

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

  selectTurret(turret, snapCamera = true) {
    this.selectedTileCell = null;
    this.selectedEnemy = null;
    this.selectedTurret = turret;
    sellBtn.disabled = !turret;
    if (turretHudSellBtn) {
      turretHudSellBtn.disabled = !turret;
      turretHudSellBtn.style.display = "";
      // CODEX CHANGE: Show the selected turret's exact sell value directly on its radial action button.
      if (turret) {
        const refund = Math.max(1, Math.floor((turret.costSpent || 0) * 0.7));
        turretHudSellBtn.innerHTML = `<span class="material-symbols-rounded" aria-hidden="true">sell</span><span>SELL ${refund}G</span>`;
      }
    }
    if (!turret) {
      // CODEX CHANGE: Remove radial presentation when no turret is selected.
      turretHud?.classList.remove("turretMode");
      selSub.textContent = "Select a turret";
      if (selectionBody) selectionBody.innerHTML = "";
      turretHud?.classList.add("hidden");
      turretStateBar?.classList.add("hidden");
      return;
    }
    // CODEX CHANGE: Turret upgrades use the circular radial HUD presentation.
    turretHud?.classList.add("turretMode");
    // CODEX CHANGE: Snap the selected battlefield turret to the exact camera and radial HUD center.
    if (snapCamera) {
      this.cam.x = turret.x - W * 0.5;
      this.cam.y = turret.y - H * 0.5;
      this.camStart.x = this.cam.x;
      this.camStart.y = this.cam.y;
    }
    selSub.textContent = turret.role;

    const tierNames = ["Base", "I", "II", "III", "IV", "V"];
    const dps = turret.fire > 0 ? (turret.dmg / turret.fire) : turret.dmg * 12;
    const stats = [
      { k: "Damage", v: turret.dmg.toFixed(1), icon: "bolt" },
      { k: "Fire", v: `${turret.fire.toFixed(2)}s`, icon: "speed" },
      { k: "Range", v: turret.range.toFixed(0), icon: "radar" },
      { k: "DPS", v: dps.toFixed(1), icon: "analytics" }
    ];

    // CODEX CHANGE: Give each radial attribute tile a stable label for clean visual treatment.
    const statCards = stats.map(s => `
      <div class="statCard" data-stat="${s.k.toLowerCase()}">
        <span class="material-symbols-rounded" aria-hidden="true">${s.icon}</span>
        <div class="statText"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>
      </div>
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
              // CODEX CHANGE: Show compact attribute deltas that fit cleanly inside each radial upgrade card.
              const delta = [
                `<span><b>DMG</b>${preview.dmg - turret.dmg >= 0 ? "+" : ""}${(preview.dmg - turret.dmg).toFixed(1)}</span>`,
                `<span><b>FIR</b>${preview.fire - turret.fire >= 0 ? "+" : ""}${(preview.fire - turret.fire).toFixed(2)}</span>`,
                `<span><b>RNG</b>${preview.range - turret.range >= 0 ? "+" : ""}${(preview.range - turret.range).toFixed(0)}</span>`
              ].join("");
              return `
                <div class="modChoice ${affordable ? "" : "poor"}">
                  <div class="modTop">
                    <div class="modName">${m.name}</div>
                    <div class="modCost">${m.cost}g</div>
                  </div>
                  <div class="modDesc">${m.desc}</div>
                  <div class="modDelta">${delta}</div>
                  <div class="modBtnRow">
                    <button class="btn ${affordable ? "primary" : ""}" data-mod="${idx}" data-cost="${m.cost}" ${affordable ? "" : "disabled"}>
                      <span class="material-symbols-rounded" aria-hidden="true">upgrade</span><span>UPGRADE</span>
                    </button>
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

    // CODEX CHANGE: Layered tactical dial rings give the turret HUD a calibrated sci-fi instrument face.
    const hudHtml = `
      <div class="hudDial" aria-hidden="true">
        <!-- CODEX CHANGE: Independent armor bands give the HUD background subtle mechanical movement. -->
        <span class="hudArmorBand hudArmorOuter"></span>
        <span class="hudArmorBand hudArmorMiddle"></span>
        <span class="hudArmorBand hudArmorInner"></span>
        <span class="hudDialRing hudDialTicks"></span>
        <span class="hudDialRing hudDialSegments"></span>
        <span class="hudDialRing hudDialSweep"></span>
        <span class="hudDialRing hudDialCore"></span>
      </div>
      <div class="selHeaderRow">
        <div class="selPortrait" data-icon="${turret.typeKey}" data-level="${turret.level}" aria-hidden="true"></div>
        <div class="selHeaderText">
          <div class="selName">${turret.name}</div>
          <div class="selLevel">Tier ${tierNames[turret.level]}</div>
        </div>
      </div>
      <div class="statGrid">${statCards}</div>
      <div class="targetRow">
        <div class="targetLabel"><span class="material-symbols-rounded" aria-hidden="true">my_location</span><span>Targeting</span></div>
        <select id="targetModeSelect" class="targetSelect" aria-label="Targeting mode">
          ${targetOptions}
        </select>
      </div>
      ${upgradesHtml}
    `;
    if (turretHudBody) turretHudBody.innerHTML = hudHtml;
    if (selectionBody) selectionBody.innerHTML = "";
    // CODEX CHANGE: Re-measure only after the turret upgrade menu changes.
    this._invalidateTurretHudLayout();
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
      // CODEX CHANGE: Refresh upgraded attributes without re-snapping a camera the player may have moved.
      this.selectTurret(turret, false);
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
    // CODEX CHANGE: Remove the shared waveform before its selected turret leaves the world.
    this.selectedTurretWaveform?.clear(true);
    this.hudOuterWaveform?.clear(true);
    this.turrets = this.turrets.filter(x => x !== t);
    this._refreshBuildList();
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
    this._syncMusicHud();
    // CODEX CHANGE: Update selection fade and music response even while gameplay itself is paused.
    this._updateSelectedTurretWaveform(dt);
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
    if (this.hasStarted && this.levelObjective?.key === "TIMED_ASSAULT" && !this.levelObjective.complete && !this.levelObjective.failed) {
      this.levelObjective.elapsed = (this.levelObjective.elapsed || 0) + dt;
      if (this.levelObjective.elapsed > this.levelObjective.timeLimit) {
        this.levelObjective.failed = true;
        toast("OBJECTIVE MISSED: assault timer expired");
      }
    }
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
        if (s.miniboss || s.finalBoss) {
          toast(s.finalBoss ? "MAIN BOSS INBOUND" : "MINIBOSS INBOUND");
          this.shakeT = Math.min(0.18, this.shakeT + 0.06);
          this.shakeMag = Math.min(4, this.shakeMag + 0.8);
        }
        spawned = this.spawnEnemy(s.type, 0, s.scalar, s.eliteTag || null);
        if ((s.miniboss || s.finalBoss) && spawned) {
          this.spawnText(
            spawned.x,
            spawned.y - 20,
            s.finalBoss ? "MAIN BOSS" : "MINIBOSS",
            s.finalBoss ? "rgba(255,207,91,0.96)" : "rgba(98,242,255,0.95)",
            1.0
          );
        }
      }
      if (this.spawnIndex >= this.spawnQueue.length && this.enemies.every(e => e.hp <= 0 || e._dead)) {
        this.waveActive = false;
        this.waveAnomaly = null;
        this._warpRippleT = 0;
        this._save();
        if (this.wave >= this.waveMax) {
          // Final-wave level progression is owned by the boss cinematic only.
          // This prevents any cleanup/skip edge case from jumping straight to the next map.
          this.intermission = 0;
          this.updateHUD();
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
            setStatusState(e, STATUS.NO_SPLIT, { duration: e._noSplitT });
          }
        }
      }
    }

    // lingering zones
    for (let i = this.lingering.length - 1; i >= 0; i--) {
      const l = this.lingering[i];
      l.t -= dtScaled;
      if (l.t <= 0) { this.lingering.splice(i, 1); continue; }
      const zoneDps = Number(l.dps);
      if (!Number.isFinite(zoneDps) || zoneDps <= 0) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        if (dist2(l.x, l.y, e.x, e.y) <= l.r * l.r) {
          e.takeHit(this, zoneDps * dtScaled, DAMAGE.TRUE, l.ownerKey || null);
        }
      }
    }

    // effects timers
    this._updateVisualEffects(dt);
    this._saveT += dt;
    // CODEX CHANGE: Desktop-friendly autosave cadence limits progress loss during active waves.
    if (this._saveT >= 30) {
      this._saveT -= 30;
      this.saveNow();
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
    // CODEX CHANGE: The visualization toggle disables both map music VFX and the selected-head waveform.
    const musicState = this.visualSettings.musicVisualizations !== false
      ? this.musicVisualizer?.getGridState?.()
      : { enabled: false };
    if (musicState) {
      musicState.wave = this.wave;
      musicState.waveMax = this.waveMax;
      musicState.level = this.levelIndex;
      musicState.boss = this.wave >= this.waveMax
        || this.gameState === GAME_STATE.BOSS_CINEMATIC
        || this.enemies.some((e) => e && e.hp > 0 && (e.isBoss || e.isMiniBoss || e.isFinalBoss));
      musicState.bossCinematic = this.gameState === GAME_STATE.BOSS_CINEMATIC;
    }
    this.map.drawBase(gfx, musicState, this.turrets);

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
          && !this.isTurretBuildCapped(this.buildKey)
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
      const life = clamp(l.t / (l.dur || 1), 0, 1);
      const k = 1 - life;
      const pulse = 0.75 + 0.25 * Math.sin(performance.now() * 0.008 + l.x * 0.01);
      gfx.save();
      gfx.globalCompositeOperation = "lighter";
      gfx.globalAlpha = 0.34 * life * pulse;
      const r = l.r * (0.9 + k * 0.45);
      const grad = gfx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      grad.addColorStop(0, l.col || "rgba(255,207,91,0.22)");
      grad.addColorStop(0.58, l.col || "rgba(255,207,91,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      gfx.fillStyle = grad;
      gfx.beginPath(); gfx.arc(l.x, l.y, r, 0, Math.PI * 2); gfx.fill();
      gfx.globalAlpha = 0.42 * life;
      gfx.strokeStyle = l.col || "rgba(255,207,91,0.45)";
      gfx.lineWidth = 1.4;
      gfx.beginPath(); gfx.arc(l.x, l.y, r * 0.72, 0, Math.PI * 2); gfx.stroke();
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

    // enemy disruption shots
    for (const shot of this.disruptionShots) {
      const total = shot.dur || 1;
      const elapsed = total - (shot.t || 0);
      const charge = shot.charge || 0;
      const travel = shot.travel || Math.max(0.2, total - charge);
      const p = clamp((elapsed - charge) / travel, 0, 1);
      const charging = elapsed < charge;
      const ease = charging ? 0 : 1 - Math.pow(1 - p, 1.65);
      const x = lerp(shot.ax, shot.bx, ease);
      const y = lerp(shot.ay, shot.by, ease);
      const dx = shot.bx - shot.ax;
      const dy = shot.by - shot.ay;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const tail = Math.min(116, len * (charging ? 0.10 : 0.34));
      const jitter = Math.sin(performance.now() * 0.045 + x * 0.04) * 4;
      const nx = -uy * jitter;
      const ny = ux * jitter;
      gfx.save();
      gfx.globalCompositeOperation = "lighter";
      if (charging) {
        const chargeP = clamp(elapsed / Math.max(0.01, charge), 0, 1);
        const aimLen = Math.min(150, len * 0.38);
        gfx.globalAlpha = 0.16 + chargeP * 0.34;
        gfx.strokeStyle = shot.alt || shot.col || "rgba(98,242,255,0.65)";
        gfx.lineCap = "round";
        gfx.lineWidth = 1.6 + chargeP * 2.1;
        gfx.setLineDash([8, 8]);
        gfx.beginPath();
        gfx.moveTo(shot.ax, shot.ay);
        gfx.lineTo(shot.ax + ux * aimLen, shot.ay + uy * aimLen);
        gfx.stroke();
        gfx.setLineDash([]);
        gfx.globalAlpha = 0.70 + chargeP * 0.25;
        gfx.fillStyle = shot.col || "rgba(98,242,255,0.95)";
        gfx.beginPath();
        gfx.arc(shot.ax, shot.ay, 5 + chargeP * 10, 0, Math.PI * 2);
        gfx.fill();
        gfx.globalAlpha = 0.36 + chargeP * 0.34;
        gfx.strokeStyle = shot.alt || shot.col || "rgba(255,255,255,0.85)";
        gfx.lineWidth = 1.3 + chargeP;
        gfx.beginPath();
        gfx.arc(shot.ax, shot.ay, 15 + chargeP * 13, 0, Math.PI * 2);
        gfx.stroke();
        gfx.restore();
        continue;
      }
      const grad = gfx.createLinearGradient(x - ux * tail, y - uy * tail, x, y);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.35, shot.alt || shot.col || "rgba(98,242,255,0.35)");
      grad.addColorStop(1, shot.col || "rgba(98,242,255,0.95)");
      gfx.strokeStyle = grad;
      gfx.lineCap = "round";
      gfx.globalAlpha = 0.82;
      gfx.lineWidth = shot.kind === "slow" ? 5.5 : 6.8;
      gfx.beginPath();
      gfx.moveTo(x - ux * tail + nx, y - uy * tail + ny);
      gfx.lineTo(x + nx * 0.25, y + ny * 0.25);
      gfx.stroke();
      gfx.globalAlpha = 0.98;
      gfx.fillStyle = shot.col || "rgba(98,242,255,0.95)";
      gfx.beginPath();
      gfx.arc(x, y, shot.kind === "slow" ? 7 : 8.5, 0, Math.PI * 2);
      gfx.fill();
      gfx.globalAlpha = 0.50;
      gfx.strokeStyle = shot.alt || shot.col || "rgba(255,255,255,0.85)";
      gfx.lineWidth = 1.3;
      gfx.beginPath();
      gfx.arc(x, y, 16 + Math.sin(performance.now() * 0.018) * 3.5, 0, Math.PI * 2);
      gfx.stroke();
      gfx.restore();
    }

    // enemy disruption clouds
    for (const dc of this.disruptionClouds) {
      const life = clamp(dc.t / (dc.dur || 5), 0, 1);
      const pulse = 0.72 + 0.28 * Math.sin(performance.now() * 0.006 + dc.x * 0.015);
      gfx.save();
      gfx.globalCompositeOperation = "lighter";
      const grad = gfx.createRadialGradient(dc.x, dc.y, dc.r * 0.12, dc.x, dc.y, dc.r);
      grad.addColorStop(0, dc.alt || dc.col || "rgba(98,242,255,0.35)");
      grad.addColorStop(0.58, dc.col || "rgba(98,242,255,0.20)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      gfx.globalAlpha = clamp(0.10 + life * 0.16, 0, 0.26) * pulse;
      gfx.fillStyle = grad;
      gfx.beginPath();
      gfx.arc(dc.x, dc.y, dc.r, 0, Math.PI * 2);
      gfx.fill();
      gfx.globalAlpha = clamp(0.18 + life * 0.22, 0, 0.40);
      gfx.strokeStyle = dc.col || "rgba(98,242,255,0.75)";
      gfx.lineWidth = dc.kind === "slow" ? 1.5 : 2;
      gfx.setLineDash(dc.kind === "slow" ? [7, 6] : [4, 4]);
      gfx.beginPath();
      gfx.arc(dc.x, dc.y, dc.r * (0.86 + pulse * 0.06), 0, Math.PI * 2);
      gfx.stroke();
      gfx.setLineDash([]);
      gfx.restore();
    }

    // CODEX CHANGE: Draw the selected waveform above the map but behind turret heads and range rings.
    this.selectedTurretWaveform?.draw(gfx);

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
      const life = clamp(a.t / 0.22, 0, 1);
      gfx.save();
      gfx.globalCompositeOperation = "lighter";
      gfx.globalAlpha = 0.24 * life;
      gfx.strokeStyle = a.col || "rgba(186,140,255,0.8)";
      gfx.lineWidth = 9;
      gfx.beginPath();
      gfx.moveTo(a.ax, a.ay);
      gfx.lineTo(a.bx, a.by);
      gfx.stroke();
      gfx.globalAlpha = 0.92 * life;
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
      gfx.globalCompositeOperation = "lighter";
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
        gfx.globalCompositeOperation = "lighter";
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
        gfx.globalCompositeOperation = "lighter";
        gfx.globalAlpha = 0.20 * (1 - k);
        const grad = gfx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
        grad.addColorStop(0, ex.col || "rgba(98,242,255,0.35)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        gfx.fillStyle = grad;
        gfx.beginPath();
        gfx.arc(ex.x, ex.y, r * 0.74, 0, Math.PI * 2);
        gfx.fill();
        gfx.globalAlpha = 0.62 * (1 - k);
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

    if (this.screenFlashes.length) {
      gfx.save();
      for (const flash of this.screenFlashes) {
        const k = 1 - clamp(flash.t / (flash.dur || 0.18), 0, 1);
        const r = flash.r + (flash.max - flash.r) * k;
        const s = this.worldToScreen(flash.x, flash.y);
        gfx.globalAlpha = 0.45 * (1 - k);
        const grad = gfx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        grad.addColorStop(0, flash.col || "rgba(255,207,91,0.35)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        gfx.fillStyle = grad;
        gfx.beginPath();
        gfx.arc(s.x, s.y, r, 0, Math.PI * 2);
        gfx.fill();
      }
      gfx.restore();
    }

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
window._orbitEchoCombat = () => ({
  eventsSeen: game.synergies?.eventsSeen || 0,
  triggerCounts: { ...(game.synergies?.triggerCounts || {}) },
  lastDamage: game.lastDamageEvent ? {
    id: game.lastDamageEvent.id,
    sourceKey: game.lastDamageEvent.sourceKey,
    target: game.lastDamageEvent.target?.name || game.lastDamageEvent.target?.typeKey || null,
    amount: game.lastDamageEvent.amount,
    dealt: game.lastDamageEvent.dealt,
    tags: [...(game.lastDamageEvent.tags || [])],
    synergies: game.lastDamageEvent.synergies || []
  } : null,
  recent: (game.combatEvents || []).slice(-12).map(event => ({
    id: event.id,
    type: event.type,
    sourceKey: event.sourceKey,
    target: event.target?.name || event.target?.typeKey || null,
    dealt: event.dealt,
    tags: [...(event.tags || [])],
    synergies: event.synergies || []
  }))
});
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










