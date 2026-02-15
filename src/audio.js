import * as Shared from "./shared.js";
const { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } = Shared;

export class AudioSystem {
  constructor() {
    this.enabled = false;
    this.unlocked = false;
    this.bgmSources = [
      "assets/music/bgm.mp3"
    ];
    this.bgm = this._makeAudio(this.bgmSources, true, 0.32);
    this.bgm.loop = true;
    this.bgm.volume = 0.32;
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
      "turret_venom", "turret_needle", "turret_aura", "turret_drone", "turret_trap"
    ]);
    this._streamedSfx = new Set([
      "shot", "drone", "beam", "mortar", "trap",
      "turret_pulse", "turret_arc", "turret_frost", "turret_lens", "turret_mortar",
      "turret_venom", "turret_needle", "turret_aura", "turret_drone", "turret_trap"
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
    a.loop = loop;
    a.volume = volume;
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
        sfx: this.sfxVol
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
    if (this.bgm.paused) {
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
      if (!this.bgm) {
        this.bgm = this._makeAudio(this.bgmSources, true, 0.32);
      }
      this.bgm.volume = this.bgm.volume ?? 0.32;
      this.bgm.play().catch(() => {
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
