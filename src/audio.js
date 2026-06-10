import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";

export class AudioSystem {
  constructor() {
    this.cdnBase = "https://cdn.bignbot.com";
    this.enabled = false;
    this.unlocked = false;
    this.bgmSources = [
      "assets/music/Background/Echoes of Orbit 2.mp3",
      "assets/music/Background/Echoing Orbit.mp3",
      "assets/music/Background/Galactic Defenses.mp3",
      "assets/music/Background/Orbit Echo 3.mp3",
      "assets/music/Background/Orbit Echo.mp3",
      "assets/music/Background/Orbit Echo4.mp3",
      "assets/music/Background/Orbit Echo_ A Defensive Pulse.mp3",
      "assets/music/Background/Anomaly Wavebreak.mp3",
      "assets/music/Background/Arcade Core Defense.mp3",
      "assets/music/Background/Orbital Echo Barrage.mp3",
      "assets/music/Background/Neon Track Vanguard.mp3",
      "assets/music/Background/Aurora Bastion Reverie.mp3",
      "assets/music/Background/Corrupted Grid Signal.mp3",
      "assets/music/Background/Bastion Core Surge.mp3",
      "assets/music/Background/Nova Bastion Afterglow.mp3",
      "assets/music/Background/Echoes of Orbit.mp3",
      "assets/music/Background/Echoes of Orbit 3.mp3",
      "assets/music/Background/Echos of Orbit 7.mp3",
      "assets/music/Background/Final Lane Ascension.mp3",
      "assets/music/Background/Hyperlane Resonance.mp3",
      "assets/music/Background/Ion Storm Pursuit.mp3",
      "assets/music/Background/Reactor Grid Breaker.mp3",
      "assets/music/Background/Rift Runner Ambush.mp3",
      "assets/music/Background/Sentinel Overcharge.mp3",
      "assets/music/Background/Sentinel Resistance Drive.mp3",
      "assets/music/Background/Void Lane Pursuit.mp3",
      "assets/music/Background/Voidlane Star Voyage.mp3",
      "assets/music/Background/Bastion Wave Protocol.mp3",
      "assets/music/Background/Corrupted Orbit Drive.mp3",
      "assets/music/Background/Cryo Grid Horizon.mp3",
      "assets/music/Background/Overcharge Nightfall.mp3",
      "assets/music/Background/Quantum Lane Rebellion.mp3",
      "assets/music/Background/Cryo Bastion Drift.mp3",
      "assets/music/Background/Neon Siege Vector.mp3",
      "assets/music/Background/Orbital Core Rebellion.mp3",
      "assets/music/Background/Pulsewave Defense Matrix.mp3",
      "assets/music/Background/Rift Overdrive Protocol.mp3",
      "assets/music/Background/Solar Flare Intercept.mp3"
    ].map(src => this._cdnUrl(src));
    this.trackNames = [
      "Pulse Grid Ascension",
      "Echo Lane Overdrive",
      "Galactic Turret Stand",
      "Synthwave Sentinel",
      "Core Shield Horizon",
      "Boss Wave Afterburn",
      "Defensive Pulse Finale",
      "Anomaly Wavebreak",
      "Arcade Core Defense",
      "Orbital Echo Barrage",
      "Neon Track Vanguard",
      "Aurora Bastion Reverie",
      "Corrupted Grid Signal",
      "Bastion Core Surge",
      "Nova Bastion Afterglow",
      "Orbit Echo Prime",
      "Echo Core Breach",
      "Seventh Orbit Surge",
      "Final Lane Ascension",
      "Hyperlane Resonance",
      "Ion Storm Pursuit",
      "Reactor Grid Breaker",
      "Rift Runner Ambush",
      "Sentinel Overcharge",
      "Sentinel Resistance Drive",
      "Void Lane Pursuit",
      "Voidlane Star Voyage",
      "Bastion Wave Protocol",
      "Corrupted Orbit Drive",
      "Cryo Grid Horizon",
      "Overcharge Nightfall",
      "Quantum Lane Rebellion",
      "Cryo Bastion Drift",
      "Neon Siege Vector",
      "Orbital Core Rebellion",
      "Pulsewave Defense Matrix",
      "Rift Overdrive Protocol",
      "Solar Flare Intercept"
    ];
    this.trackIndex = 0;
    this.repeat = true;
    this.shuffle = false;
    this.musicMuted = false;
    this.musicPaused = false;
    this.analysisCorsReady = false;
    this._pendingProgressRatio = null;
    this._pendingSeekSeconds = 0;
    this._pendingProgressDisplay = 0;
    this._failedBgmTracks = new Set();
    this.bgm = this._makeBgm();
    this.bgm.volume = 0.32;
    this._probeAnalysisCors();
    this.sfx = {
      build: ["assets/sfx/sfx_build.wav"],
      upgrade: ["assets/sfx/sfx_upgrade.wav"],
      sell: ["assets/sfx/sfx_sell.wav"],
      wave: ["assets/sfx/sfx_wave.wav"],
      skip: ["assets/sfx/sfx_skip.wav"],
      leak: ["assets/sfx/sfx_leak.wav"],
      win: ["assets/sfx/sfx_win.wav"],
      lose: ["assets/sfx/sfx_lose.wav"],
      shot: ["assets/sfx/sfx_shot.wav"],
      hit: ["assets/sfx/sfx_hit.wav"],
      kill: ["assets/sfx/sfx_kill.wav"],
      beam: ["assets/sfx/sfx_beam.wav"],
      lens: ["assets/sfx/sfx_beam.wav"],
      mortar: ["assets/sfx/sfx_mortar.wav"],
      trap: ["assets/sfx/sfx_trap.wav"],
      drone: ["assets/sfx/sfx_drone.wav"],
      turret_pulse: ["assets/sfx/sfx_turret_pulse.wav"],
      turret_arc: ["assets/sfx/sfx_turret_arc.wav"],
      turret_frost: ["assets/sfx/sfx_turret_frost.wav"],
      turret_lens: ["assets/sfx/sfx_turret_lens.wav"],
      turret_mortar: ["assets/sfx/sfx_turret_mortar.wav"],
      turret_venom: ["assets/sfx/sfx_turret_venom.wav"],
      turret_needle: ["assets/sfx/sfx_turret_needle.wav"],
      turret_aura: ["assets/sfx/sfx_turret_aura.wav"],
      turret_drone: ["assets/sfx/sfx_turret_drone.wav"],
      turret_trap: ["assets/sfx/sfx_turret_trap.wav"],
      enemy_disrupt_charge: ["assets/sfx/sfx_enemy_disrupt_charge.wav.wav"],
      enemy_disrupt_jam_shot: ["assets/sfx/sfx_enemy_disrupt_jam_shot.wav.wav"],
      enemy_disrupt_slow_shot: ["assets/sfx/sfx_enemy_disrupt_slow_shot.wav.wav"],
      enemy_disrupt_jam_impact: ["assets/sfx/sfx_enemy_disrupt_jam_impact.wav.wav"],
      enemy_disrupt_slow_impact: ["assets/sfx/sfx_enemy_disrupt_slow_impact.wav.wav"],
      turret_disrupted_pulse: ["assets/sfx/sfx_turret_disrupted_pulse.wav.wav"],
      synergy_shatter: ["assets/sfx/sfx_shatter_circuit.wav"],
      synergy_bloom: ["assets/sfx/sfx_chemical_bloom.wav"],
      synergy_emp_feedback: ["assets/sfx/sfx_emp_feedback.wav"],
      synergy_precision_break: ["assets/sfx/sfx_precision_break.wav"],
      synergy_swarm_link: ["assets/sfx/sfx_swarm_link.wav"],
      synergy_caustic_ray: ["assets/sfx/sfx_caustic_ray.wav"],
      synergy_seismic_snare: ["assets/sfx/sfx_seismic_snare.wav"],
      synergy_overcharge_rupture: ["assets/sfx/sfx_overcharge_rupture.wav"],
      abilities_btn: ["assets/sfx/sfx_abilities_btn.wav"],
      explodingboss: ["assets/sfx/sfx_explodingboss.wav"],
      finalexplosionboss: ["assets/sfx/sfx_finalexplosionboss.wav"],
      hover: ["assets/sfx/sfx_Hoveroverbutton.wav"],
      click: ["assets/sfx/sfx_clickme.wav"]
    };
    this.sfxVol = 0.6;
    this.sfxGain = {
      kill: 1.5,
      lens: 1.15,
      turret_lens: 1.15,
      explodingboss: 1.2,
      finalexplosionboss: 1.2
    };
    this._last = {};
    this._errorShown = false;
    this._lastEnsure = 0;
    this.maxSfxVoices = 18;
    this._activeSfx = [];
    this._lowPrioritySfx = new Set([
      "shot", "hit", "drone", "beam", "mortar", "trap",
      "turret_pulse", "turret_arc", "turret_frost", "turret_lens", "turret_mortar",
      "turret_venom", "turret_needle", "turret_aura", "turret_drone", "turret_trap",
      "enemy_disrupt_charge", "enemy_disrupt_jam_shot", "enemy_disrupt_slow_shot",
      "turret_disrupted_pulse",
      "synergy_shatter", "synergy_bloom", "synergy_emp_feedback", "synergy_precision_break",
      "synergy_swarm_link", "synergy_caustic_ray", "synergy_seismic_snare", "synergy_overcharge_rupture"
    ]);
    this._streamedSfx = new Set([
      "shot", "drone", "beam", "mortar", "trap",
      "turret_pulse", "turret_arc", "turret_frost", "turret_lens", "turret_mortar",
      "turret_venom", "turret_needle", "turret_aura", "turret_drone", "turret_trap",
      "enemy_disrupt_charge", "enemy_disrupt_jam_shot", "enemy_disrupt_slow_shot",
      "enemy_disrupt_jam_impact", "enemy_disrupt_slow_impact", "turret_disrupted_pulse",
      "synergy_shatter", "synergy_bloom", "synergy_emp_feedback", "synergy_precision_break",
      "synergy_swarm_link", "synergy_caustic_ray", "synergy_seismic_snare", "synergy_overcharge_rupture"
    ]);
    this._sfxChannel = {};
    this._sfxPool = {};
    this._sfxPoolIdx = {};
    this._sfxSrc = {};
    this._sfxPoolSize = {
      kill: 5,
      lens: 4,
      turret_lens: 4,
      turret_pulse: 4,
      turret_arc: 4,
      turret_frost: 4,
      turret_mortar: 4,
      turret_venom: 4,
      turret_needle: 4,
      turret_aura: 3,
      turret_drone: 4,
      turret_trap: 4,
      enemy_disrupt_charge: 3,
      enemy_disrupt_jam_shot: 3,
      enemy_disrupt_slow_shot: 3,
      enemy_disrupt_jam_impact: 3,
      enemy_disrupt_slow_impact: 3,
      turret_disrupted_pulse: 2,
      synergy_shatter: 3,
      synergy_bloom: 3,
      synergy_emp_feedback: 3,
      synergy_precision_break: 3,
      synergy_swarm_link: 3,
      synergy_caustic_ray: 3,
      synergy_seismic_snare: 3,
      synergy_overcharge_rupture: 3,
      explodingboss: 4,
      finalexplosionboss: 3
    };
    for (const [key, sources] of Object.entries(this.sfx)) {
      this._sfxSrc[key] = this._pickSource(sources);
    }
  }

  _pickSource(sources) {
    const probe = document.createElement("audio");
    let fallback = sources[0];
    for (const src of sources) {
      const ext = src.split(".").pop().toLowerCase();
      const mime = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "";
      if (!mime) { fallback = src; continue; }
      const can = probe.canPlayType(mime);
      if (can && can !== "no") return src;
    }
    return fallback;
  }

  _cdnUrl(path) {
    const cleanBase = String(this.cdnBase || "").replace(/\/+$/, "");
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return encodeURI(`${cleanBase}/${cleanPath}`);
  }

  _orderSources(sources) {
    const probe = document.createElement("audio");
    const ranked = [];
    for (const src of sources) {
      const ext = src.split(".").pop().toLowerCase();
      const mime = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "";
      const can = mime ? probe.canPlayType(mime) : "maybe";
      const score = can === "probably" ? 2 : can === "maybe" ? 1 : 0;
      ranked.push({ src, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.map(r => r.src);
  }

  _makeAudio(sources, loop = false, volume = 1) {
    const ordered = this._orderSources(sources);
    const a = new Audio();
    if (this.analysisCorsReady && ordered.some(src => src.startsWith(this.cdnBase))) {
      a.crossOrigin = "anonymous";
    }
    a.loop = loop;
    a.volume = volume;
    a.preload = "metadata";
    let idx = 0;
    const setSrc = () => {
      if (idx >= ordered.length) return;
      a.src = ordered[idx++];
      a.load();
    };
    a.addEventListener("error", setSrc);
    setSrc();
    return a;
  }

  async _probeAnalysisCors() {
    const src = this.bgmSources[0];
    if (!src || typeof fetch !== "function") return;
    try {
      const res = await fetch(src, { method: "HEAD", mode: "cors", cache: "force-cache" });
      if (!res.ok) return;
      this.analysisCorsReady = true;
      this._refreshBgmForAnalysis();
    } catch (err) {
      // Playback remains available; the visualizer uses its music-timed fallback until CDN CORS is enabled.
    }
  }

  _refreshBgmForAnalysis() {
    const prev = this.bgm;
    if (!prev || prev.crossOrigin === "anonymous") return;
    const currentTime = Number.isFinite(prev.currentTime) ? prev.currentTime : 0;
    const volume = prev.volume;
    const wasPlaying = !prev.paused;
    prev.pause();
    this.bgm = this._makeBgm();
    this.bgm.volume = volume;
    this.bgm.muted = this.musicMuted;
    this.bgm.addEventListener("loadedmetadata", () => {
      try { this.bgm.currentTime = clamp(currentTime, 0, this.bgm.duration || currentTime); } catch (err) {}
      if (wasPlaying) this.bgm.play().catch(() => {});
    }, { once: true });
  }

  _makeBgm() {
    const trackIndex = this.trackIndex;
    const a = this._makeAudio([this.bgmSources[this.trackIndex]], false, this.bgm?.volume ?? 0.32);
    a.preload = "metadata";
    a.muted = this.musicMuted;
    a.addEventListener("loadedmetadata", () => {
      this._failedBgmTracks.delete(trackIndex);
      this._applyPendingSeek();
    });
    a.addEventListener("error", () => this._handleBgmError(trackIndex));
    a.addEventListener("ended", () => this._handleTrackEnded());
    return a;
  }

  _handleBgmError(trackIndex) {
    if (trackIndex !== this.trackIndex) return;
    this._failedBgmTracks.add(trackIndex);
    if (this._failedBgmTracks.size >= this.bgmSources.length) {
      if (!this._errorShown) {
        this._errorShown = true;
        toast("Music playlist unavailable. Check CDN uploads.");
      }
      return;
    }
    const autoplay = this.enabled && this.unlocked && !this.musicPaused;
    setTimeout(() => {
      if (trackIndex === this.trackIndex && this.bgm?.error) this.nextTrack(autoplay);
    }, 250);
  }

  _applyPendingSeek() {
    if (!this.bgm || !Number.isFinite(this.bgm.duration) || this.bgm.duration <= 0) return;
    if (typeof this._pendingProgressRatio === "number") {
      try {
        this.bgm.currentTime = clamp(this._pendingProgressRatio, 0, 1) * this.bgm.duration;
      } catch (err) {}
      this._pendingProgressRatio = null;
      this._pendingSeekSeconds = 0;
      this._pendingProgressDisplay = 0;
      return;
    }
    if (this._pendingSeekSeconds) {
      const current = Number.isFinite(this.bgm.currentTime) ? this.bgm.currentTime : 0;
      try {
        this.bgm.currentTime = clamp(current + this._pendingSeekSeconds, 0, this.bgm.duration);
      } catch (err) {}
      this._pendingSeekSeconds = 0;
      this._pendingProgressDisplay = this.bgm.duration > 0 ? clamp(this.bgm.currentTime / this.bgm.duration, 0, 1) : 0;
    }
  }

  _handleTrackEnded() {
    if (this.repeat) {
      this.nextTrack(this.enabled && this.unlocked && !this.musicPaused);
      return;
    }
    if (this.trackIndex < this.bgmSources.length - 1) {
      this.setTrackIndex(this.trackIndex + 1, this.enabled && this.unlocked && !this.musicPaused);
    }
    this.savePref();
  }

  setTrackIndex(index, autoplay = false, save = true) {
    if (!this.bgmSources.length) return;
    const next = ((index % this.bgmSources.length) + this.bgmSources.length) % this.bgmSources.length;
    const volume = this.bgm ? this.bgm.volume : 0.32;
    const wasPlaying = this.bgm && !this.bgm.paused;
    if (this.bgm) this.bgm.pause();
    this.trackIndex = next;
    this.bgm = this._makeBgm();
    this.bgm.volume = volume;
    if (save) this.savePref();
    if (autoplay || wasPlaying) this.playMusic();
  }

  currentTrackName() {
    return this.trackNames[this.trackIndex] || `Track ${this.trackIndex + 1}`;
  }

  isMusicPlaying() {
    return !!this.bgm && !this.bgm.paused;
  }

  _setButton() {
    if (!audioBtn) return;
    audioBtn.classList.toggle("muted", !this.enabled);
    const label = audioBtn.querySelector(".audioLabel");
    if (label) label.textContent = this.enabled ? "AUDIO: ON" : "AUDIO: OFF";
  }

  loadPref() {
    try {
      const raw = localStorage.getItem(AUDIO_KEY);
      const data = raw ? JSON.parse(raw) : null;
      this.enabled = data ? data.enabled === 1 : true;
      if (typeof data?.track === "number") this.setTrackIndex(data.track, false, false);
      if (typeof data?.repeat === "boolean") this.repeat = data.repeat;
      if (typeof data?.shuffle === "boolean") this.shuffle = data.shuffle;
      if (typeof data?.muted === "boolean") this.musicMuted = data.muted;
      if (this.bgm) this.bgm.muted = this.musicMuted;
      this.musicPaused = data?.musicPaused === true;
      if (typeof data?.music === "number") this.bgm.volume = clamp(data.music, 0, 1);
      if (typeof data?.sfx === "number") this.sfxVol = clamp(data.sfx, 0, 1);
    } catch (err) {
      this.enabled = true;
    }
    this._setButton();
  }

  savePref() {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({
        enabled: this.enabled ? 1 : 0,
        music: this.bgm.volume,
        sfx: this.sfxVol,
        track: this.trackIndex,
        repeat: this.repeat,
        shuffle: this.shuffle,
        muted: this.musicMuted,
        musicPaused: this.musicPaused
      }));
    } catch (err) {
      // ignore
    }
  }

  unlock() {
    if (!this.unlocked) this.unlocked = true;
    this.ensureActive(true);
  }

  ensureActive(force = false) {
    if (!this.enabled) return;
    this._pruneActiveSfx();
    const now = performance.now();
    if (!force && (now - this._lastEnsure) < 1200) return;
    this._lastEnsure = now;
    if (!this.bgm) return;
    if (this.bgm.paused && !this.musicPaused) {
      this.bgm.play().then(() => {
        if (!this.enabled) this.bgm.pause();
      }).catch(() => {});
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    this._setButton();
    this.savePref();
    if (!this.unlocked) return;
    if (this.enabled) {
      this.musicPaused = false;
      this.bgm.volume = this.bgm.volume ?? 0.32;
      this.playMusic().catch(() => {
        if (!this._errorShown) {
          this._errorShown = true;
          toast("Audio blocked. Click once on the game, then toggle Audio.");
        }
      });
      // Quick confirm beep
      this.play("build");
    } else {
      if (this.bgm) this.bgm.pause();
    }
  }

  setMusicVolume(v) {
    this.bgm.volume = clamp(v, 0, 1);
    if (this.bgm.volume > 0) {
      this.musicMuted = false;
      this.bgm.muted = false;
    }
    this.savePref();
  }

  setSfxVolume(v) {
    this.sfxVol = clamp(v, 0, 1);
    this.savePref();
  }

  toggle() {
    this.unlock();
    this.setEnabled(!this.enabled);
  }

  playMusic() {
    this.unlock();
    this.enabled = true;
    this.musicPaused = false;
    this._setButton();
    this.savePref();
    if (!this.bgm) this.bgm = this._makeBgm();
    return this.bgm.play().catch((err) => {
      if (!this._errorShown) {
        this._errorShown = true;
        toast("Audio blocked. Click once on the game, then press Play.");
      }
      throw err;
    });
  }

  pauseMusic() {
    this.musicPaused = true;
    if (this.bgm) this.bgm.pause();
    this.savePref();
  }

  toggleMusic() {
    if (this.isMusicPlaying()) {
      this.pauseMusic();
      return false;
    }
    this.playMusic().catch(() => {});
    return true;
  }

  nextTrack(autoplay = this.isMusicPlaying()) {
    if (this.shuffle && this.bgmSources.length > 1) {
      let next = this.trackIndex;
      while (next === this.trackIndex) next = Math.floor(Math.random() * this.bgmSources.length);
      this.setTrackIndex(next, autoplay);
      return;
    }
    this.setTrackIndex(this.trackIndex + 1, autoplay);
  }

  randomizeStartingTrack() {
    if (this.bgmSources.length <= 1) return;
    let next = this.trackIndex;
    while (next === this.trackIndex) next = Math.floor(Math.random() * this.bgmSources.length);
    this.setTrackIndex(next, this.isMusicPlaying());
  }

  prevTrack() {
    this.setTrackIndex(this.trackIndex - 1, this.isMusicPlaying());
  }

  setRepeat(on) {
    this.repeat = !!on;
    this.savePref();
  }

  setShuffle(on) {
    this.shuffle = !!on;
    this.savePref();
  }

  toggleMute() {
    this.musicMuted = !this.musicMuted;
    if (this.bgm) this.bgm.muted = this.musicMuted;
    this.savePref();
    return this.musicMuted;
  }

  seekBy(seconds) {
    if (!this.bgm) return;
    const current = Number.isFinite(this.bgm.currentTime) ? this.bgm.currentTime : 0;
    if (!Number.isFinite(this.bgm.duration) || this.bgm.duration <= 0) {
      this._pendingSeekSeconds += seconds;
      this._pendingProgressDisplay = clamp(this._pendingProgressDisplay + (seconds / 180), 0, 1);
      try { this.bgm.load(); } catch (err) {}
      return;
    }
    const max = this.bgm.duration;
    try {
      this.bgm.currentTime = clamp(current + seconds, 0, max);
    } catch (err) {}
  }

  setProgress(value, max = 1) {
    if (!this.bgm) return;
    const range = Math.max(1, Number(max) || 1);
    const ratio = clamp((Number(value) || 0) / range, 0, 1);
    if (!Number.isFinite(this.bgm.duration) || this.bgm.duration <= 0) {
      this._pendingProgressRatio = ratio;
      this._pendingProgressDisplay = ratio;
      try { this.bgm.load(); } catch (err) {}
      return;
    }
    const seconds = ratio * this.bgm.duration;
    try {
      this.bgm.currentTime = clamp(seconds, 0, this.bgm.duration);
    } catch (err) {}
  }

  getMusicReactiveLevel() {
    if (!this.enabled || !this.bgm || this.bgm.paused) return 0;
    const t = this.bgm.currentTime || 0;
    const i = this.trackIndex + 1;
    const pulse = Math.sin(t * (2.8 + i * 0.07)) * 0.5 + 0.5;
    const bass = Math.sin(t * (0.82 + i * 0.03) + i) * 0.5 + 0.5;
    const shimmer = Math.sin(t * (6.4 + i * 0.11)) * 0.5 + 0.5;
    return clamp((pulse * 0.48) + (bass * 0.36) + (shimmer * 0.16), 0, 1);
  }

  _pruneActiveSfx(now = performance.now()) {
    this._activeSfx = this._activeSfx.filter(a => {
      if (!a) return false;
      if (a.ended) return false;
      if (a.paused && a.currentTime > 0) return false;
      // hard timeout safety for stalled elements
      if ((now - (a._startedAt || now)) > (a._maxAge || 2200)) {
        try { a.pause(); } catch (err) {}
        return false;
      }
      return true;
    });
  }

  _removeActiveSfx(a) {
    const idx = this._activeSfx.indexOf(a);
    if (idx >= 0) this._activeSfx.splice(idx, 1);
  }

  _reserveVoice(name) {
    const now = performance.now();
    this._pruneActiveSfx(now);
    if (this._activeSfx.length < this.maxSfxVoices) return true;

    const isLow = this._lowPrioritySfx.has(name);
    if (isLow) return false;

    // For higher-priority/UI sounds, evict one low-priority voice first.
    const victim = this._activeSfx.find(a => this._lowPrioritySfx.has(a._name));
    if (victim) {
      try { victim.pause(); } catch (err) {}
      this._removeActiveSfx(victim);
      return true;
    }

    return false;
  }

  play(name) {
    if (!this.enabled) return;
    this.ensureActive();
    const src = this._sfxSrc[name] || (this.sfx[name] ? this._pickSource(this.sfx[name]) : null);
    if (!src) return;

    // Reuse pooled channels for every SFX key to avoid browser channel starvation.
    if (!this._sfxPool[name]) {
      const heavy = this._streamedSfx.has(name) || this._lowPrioritySfx.has(name);
      const size = this._sfxPoolSize[name] || (heavy ? 4 : 2);
      this._sfxPool[name] = Array.from({ length: size }, () => {
        const a = new Audio(src);
        a.preload = "auto";
        return a;
      });
      this._sfxPoolIdx[name] = 0;
    }
    const pool = this._sfxPool[name];
    let idx = this._sfxPoolIdx[name] || 0;
    let chosen = pool[idx % pool.length];
    for (let i = 0; i < pool.length; i++) {
      const c = pool[(idx + i) % pool.length];
      if (c.paused || c.ended) {
        chosen = c;
        idx = (idx + i) % pool.length;
        break;
      }
    }
    this._sfxPoolIdx[name] = (idx + 1) % pool.length;
    if (!chosen.src || !chosen.src.includes(src)) {
      chosen.src = src;
      chosen.load();
    }
    chosen.volume = clamp(this.sfxVol * (this.sfxGain[name] || 1), 0, 1);
    try { chosen.currentTime = 0; } catch (err) {}
    chosen.play().catch(() => {});
  }

  playLimited(name, cooldownMs) {
    if (!this.enabled) return;
    this.ensureActive();
    const now = performance.now();
    const last = this._last[name] || 0;
    if (now - last < cooldownMs) return;
    this._last[name] = now;
    this.play(name);
  }

  tick() {
    if (!this.enabled) return;
    this._pruneActiveSfx();
    this.ensureActive();
  }
}

