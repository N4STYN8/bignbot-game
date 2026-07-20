const VISUAL_MODE_KEY = "orbit_echo_grid_visual_mode_v1";

export const VISUAL_MODES = [
  "Synthwave Equalizer",
  "Neon Ocean",
  "Plasma Storm",
  "Quantum Grid",
  "Orbital Echo Rings",
  "Digital Rain",
  "Energy Lattice",
  "Cyber Pulse",
  "Aurora Field",
  "Cosmic Reactor"
];
// CODEX CHANGE: Keep ten active variations and add a separate V-cycle stop for all music visuals.
export const VISUAL_OFF_MODE = VISUAL_MODES.length;

const TRACK_PROFILES = [
  { bpm: 104, bass: 0.78, mid: 0.58, high: 0.42, phase: 0.1 },
  { bpm: 118, bass: 0.70, mid: 0.66, high: 0.52, phase: 0.8 },
  { bpm: 112, bass: 0.74, mid: 0.62, high: 0.47, phase: 1.4 },
  { bpm: 96, bass: 0.62, mid: 0.72, high: 0.55, phase: 2.1 },
  { bpm: 126, bass: 0.82, mid: 0.54, high: 0.64, phase: 2.8 },
  { bpm: 108, bass: 0.76, mid: 0.69, high: 0.46, phase: 3.4 },
  { bpm: 122, bass: 0.68, mid: 0.74, high: 0.58, phase: 4.0 },
  { bpm: 100, bass: 0.80, mid: 0.52, high: 0.44, phase: 4.6 },
  { bpm: 132, bass: 0.66, mid: 0.78, high: 0.62, phase: 5.2 },
  { bpm: 114, bass: 0.72, mid: 0.64, high: 0.50, phase: 5.8 },
  { bpm: 128, bass: 0.84, mid: 0.56, high: 0.60, phase: 0.45 },
  { bpm: 116, bass: 0.73, mid: 0.76, high: 0.54, phase: 1.15 },
  { bpm: 102, bass: 0.79, mid: 0.60, high: 0.48, phase: 2.65 },
  { bpm: 124, bass: 0.69, mid: 0.70, high: 0.66, phase: 3.75 },
  { bpm: 110, bass: 0.77, mid: 0.68, high: 0.57, phase: 4.85 }
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class MusicVisualizer {
  constructor({ label, audioSystem }) {
    this.label = label;
    this.audioSystem = audioSystem;
    this.mode = this._loadMode();
    this.modeName = this._modeName(this.mode);
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.sourceAudio = null;
    this.freq = null;
    this.time = null;
    this.last = performance.now();
    this.timeSeconds = this.last * 0.001;
    this.energy = { bass: 0, mid: 0, high: 0, wave: 0, intensity: 0, beat: 0, snap: 0, drop: 0, tempo: 0.5 };
    this.spectrum = new Array(32).fill(0.18);
    this.beatAvg = 0.12;
    this.previousBass = 0;
    this.previousHigh = 0;
    this.lastBeatAt = 0;
    this.beatInterval = 0.56;
    this.dropCooldown = 0;
    this.lastSyntheticBeat = -1;
    this.lastSyntheticSnap = -1;
    this.idleT = 0;
    this.userUnlocked = false;
    this._raf = 0;
    this._boundKey = (ev) => this._onKey(ev);
  }

  start() {
    this._syncLabel();
    window.addEventListener("keydown", this._boundKey);
    this._raf = requestAnimationFrame((now) => this._frame(now));
  }

  attachAudio(audio) {
    if (!audio || this.sourceAudio === audio) return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    if (!this._canAnalyseAudio(audio)) return;
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContextCtor();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        // CODEX CHANGE: Keep real-audio visuals responsive enough to show drum attacks and high-frequency snaps.
        this.analyser.smoothingTimeConstant = 0.56;
        this.analyser.connect(this.audioContext.destination);
        this.freq = new Uint8Array(this.analyser.frequencyBinCount);
        this.time = new Uint8Array(this.analyser.fftSize);
      }
      if (this.source) {
        try { this.source.disconnect(); } catch (err) {}
      }
      this.source = this.audioContext.createMediaElementSource(audio);
      this.source.connect(this.analyser);
      this.sourceAudio = audio;
    } catch (err) {
      // Browsers only allow one MediaElementSource per element; reuse any existing connection.
      this.sourceAudio = audio;
    }
  }

  _canAnalyseAudio(audio) {
    try {
      const src = audio.currentSrc || audio.src || "";
      if (!src) return true;
      const audioUrl = new URL(src, window.location.href);
      if (audioUrl.origin === window.location.origin) return true;
      return !!audio.crossOrigin;
    } catch (err) {
      return false;
    }
  }

  unlock() {
    this.userUnlocked = true;
    const audio = this.audioSystem?.bgm;
    if (audio) this.attachAudio(audio);
    if (this.audioContext?.state === "suspended") this.audioContext.resume().catch(() => {});
  }

  cycleMode() {
    this.mode = (this.mode + 1) % (VISUAL_MODES.length + 1);
    this.modeName = this._modeName(this.mode);
    this._saveMode();
    this._syncLabel();
  }

  setLevelTheme(level, seed = 0) {
    // OFF is an explicit player choice and must survive automatic level-theme changes.
    if (!this.enabled) {
      this._syncLabel();
      return;
    }
    const safeLevel = Math.max(1, Number(level) | 0);
    const safeSeed = Number(seed) >>> 0;
    let next = ((safeSeed ^ Math.imul(safeLevel, 2654435761)) >>> 0) % VISUAL_MODES.length;
    if (safeLevel > 1 && next === this.mode) next = (next + 1) % VISUAL_MODES.length;
    this.mode = next;
    this.modeName = this._modeName(this.mode);
    this._saveMode();
    this._syncLabel();
  }

  getGridState() {
    return {
      mode: this.mode,
      modeName: this.modeName,
      enabled: this.enabled,
      time: this.timeSeconds,
      trackIndex: Math.max(0, this.audioSystem?.trackIndex | 0),
      energy: { ...this.energy },
      spectrum: [...this.spectrum]
    };
  }

  _loadMode() {
    try {
      const raw = window.localStorage.getItem(VISUAL_MODE_KEY);
      const idx = raw == null ? 0 : Number(raw);
      return Number.isFinite(idx) ? Math.max(0, Math.min(VISUAL_OFF_MODE, idx | 0)) : 0;
    } catch (err) {
      return 0;
    }
  }

  _saveMode() {
    try { window.localStorage.setItem(VISUAL_MODE_KEY, String(this.mode)); } catch (err) {}
  }

  _syncLabel() {
    if (this.label) {
      this.label.textContent = `VISUAL MODE: ${this.modeName}`;
      this.label.classList.toggle("isOff", !this.enabled);
    }
  }

  // CODEX CHANGE: Expose a single state flag to map and HUD renderers when V reaches OFF.
  get enabled() {
    return this.mode !== VISUAL_OFF_MODE;
  }

  _modeName(mode) {
    return mode === VISUAL_OFF_MODE ? "OFF" : (VISUAL_MODES[mode] || VISUAL_MODES[0]);
  }

  _onKey(ev) {
    const tag = ev.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (ev.key?.toLowerCase() !== "v") return;
    this.cycleMode();
  }

  _frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.timeSeconds = now * 0.001;
    this._connectCurrentAudio();
    this._sample(dt);
    this._raf = requestAnimationFrame((next) => this._frame(next));
  }

  _connectCurrentAudio() {
    if (!this.userUnlocked) return;
    const audio = this.audioSystem?.bgm;
    if (!audio) return;
    this.attachAudio(audio);
    if (this.audioSystem?.isMusicPlaying?.()) this.unlock();
  }

  _sample(dt) {
    this.dropCooldown = Math.max(0, this.dropCooldown - dt);
    const hasAudio = this.analyser && this.freq && this.time && this.sourceAudio && !this.sourceAudio.paused;
    if (hasAudio) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.time);
      const bass = Math.pow(this._avg(this.freq, 0, 24) / 255, 0.72);
      const mid = Math.pow(this._avg(this.freq, 24, 170) / 255, 0.78);
      const high = Math.pow(this._avg(this.freq, 170, 520) / 255, 0.70);
      this._updateSpectrumFromAnalyser();
      let waveSum = 0;
      for (let i = 0; i < this.time.length; i++) waveSum += Math.abs(this.time[i] - 128);
      const wave = clamp01((waveSum / this.time.length) / 64);
      const instant = clamp01(bass * 0.66 + mid * 0.22 + high * 0.12 + wave * 0.10);
      this.beatAvg = lerp(this.beatAvg, instant, instant > this.beatAvg ? 0.018 : 0.045);
      const bassJump = Math.max(0, bass - this.previousBass);
      const highJump = Math.max(0, high - this.previousHigh);
      const beatPower = clamp01((instant - this.beatAvg * 1.08) / (this.beatAvg * 0.55 + 0.055) + bassJump * 1.85);
      const spike = beatPower > 0.28 && bass > 0.14 ? beatPower : 0;
      const snapPower = clamp01((highJump - 0.030) * 6.4 + high * 0.36 + wave * 0.08);
      const snap = snapPower > 0.24 && high > 0.12 ? snapPower : 0;
      const drop = spike > 0.72 && bassJump > 0.10 && instant > this.beatAvg * 1.36 && this.dropCooldown <= 0
        ? clamp01(0.65 + spike * 0.35 + bassJump * 1.2)
        : 0;
      if (spike) this._registerBeat(this.timeSeconds);
      if (drop) this.dropCooldown = 1.4;
      this.energy.beat = Math.max(spike, this.energy.beat - dt * 4.8);
      this.energy.snap = Math.max(snap, this.energy.snap - dt * 8.0);
      this.energy.drop = Math.max(drop, this.energy.drop - dt * 2.5);
      // CODEX CHANGE: Use a quicker attack so every renderer visibly lands on the music instead of drifting behind it.
      this.energy.bass = lerp(this.energy.bass, bass, 0.48);
      this.energy.mid = lerp(this.energy.mid, mid, 0.40);
      this.energy.high = lerp(this.energy.high, high, 0.44);
      this.energy.wave = lerp(this.energy.wave, wave, 0.42);
      this.energy.intensity = lerp(this.energy.intensity, instant, 0.38);
      this.energy.tempo = lerp(this.energy.tempo, clamp01(0.3 + (0.72 / this.beatInterval) * 0.32), 0.08);
      this.previousBass = bass;
      this.previousHigh = high;
      return;
    }

    if (this.audioSystem?.isMusicPlaying?.()) {
      this._sampleTimedTrack(dt);
      return;
    }

    this.idleT += dt;
    const idle = 0.2 + Math.sin(this.idleT * 0.85) * 0.05;
    this.energy.beat = Math.max(0, this.energy.beat - dt * 3);
    this.energy.snap = Math.max(0, this.energy.snap - dt * 5);
    this.energy.drop = Math.max(0, this.energy.drop - dt * 2);
    this.energy.bass = lerp(this.energy.bass, idle, 0.02);
    this.energy.mid = lerp(this.energy.mid, idle * 0.75, 0.02);
    this.energy.high = lerp(this.energy.high, idle * 0.5, 0.02);
    this.energy.wave = lerp(this.energy.wave, idle * 0.8, 0.02);
    this.energy.intensity = lerp(this.energy.intensity, idle, 0.02);
    this.energy.tempo = lerp(this.energy.tempo, 0.35, 0.02);
  }

  _sampleTimedTrack(dt) {
    const audio = this.audioSystem?.bgm;
    const trackIndex = Math.max(0, this.audioSystem?.trackIndex | 0);
    const profile = TRACK_PROFILES[trackIndex % TRACK_PROFILES.length] || TRACK_PROFILES[0];
    const t = Number.isFinite(audio?.currentTime) ? audio.currentTime : this.timeSeconds;
    const beatLen = 60 / profile.bpm;
    const beatPos = (t / beatLen) % 1;
    const beatIndex = Math.floor(t / beatLen);
    const kick = Math.pow(Math.max(0, 1 - beatPos * 5.5), 2.2);
    const offBeatPos = ((t / beatLen) + 0.5) % 1;
    const snare = Math.pow(Math.max(0, 1 - offBeatPos * 7), 2.4);
    const bar = (beatIndex % 16) / 16;
    const phraseLift = 0.65 + 0.35 * Math.sin((bar * Math.PI * 2) + profile.phase);
    const bass = clamp01(0.18 + kick * profile.bass * 1.06 + 0.14 * Math.sin(t * 1.7 + profile.phase));
    const mid = clamp01(0.20 + phraseLift * profile.mid * 0.62 + snare * 0.38 + 0.12 * Math.sin(t * 2.4 + profile.phase));
    const high = clamp01(0.12 + profile.high * (0.38 + 0.42 * Math.sin(t * 5.8 + profile.phase)) + snare * 0.34);
    const wave = clamp01(0.16 + bass * 0.38 + mid * 0.28 + high * 0.18);
    const instant = clamp01(bass * 0.58 + mid * 0.26 + high * 0.16);
    this._updateTimedSpectrum(t, profile, bass, mid, high);
    const newBeat = beatIndex !== this.lastSyntheticBeat && beatPos < 0.08;
    const snapIndex = Math.floor((t / beatLen) * 2);
    const newSnap = snapIndex !== this.lastSyntheticSnap && offBeatPos < 0.10;
    const drop = newBeat && beatIndex > 0 && beatIndex % 16 === 0;
    if (newBeat) {
      this.lastSyntheticBeat = beatIndex;
      this._registerBeat(t);
    }
    if (newSnap) this.lastSyntheticSnap = snapIndex;
    this.energy.beat = Math.max(newBeat ? 1 : 0, this.energy.beat - dt * 5.2);
    this.energy.snap = Math.max(newSnap ? 1 : 0, this.energy.snap - dt * 8.2);
    this.energy.drop = Math.max(drop ? 1 : 0, this.energy.drop - dt * 2.6);
    // CODEX CHANGE: Make the CDN timing fallback hit its generated kicks, snares, and phrases more decisively.
    this.energy.bass = lerp(this.energy.bass, bass, 0.52);
    this.energy.mid = lerp(this.energy.mid, mid, 0.42);
    this.energy.high = lerp(this.energy.high, high, 0.48);
    this.energy.wave = lerp(this.energy.wave, wave, 0.44);
    this.energy.intensity = lerp(this.energy.intensity, instant, 0.40);
    this.energy.tempo = lerp(this.energy.tempo, clamp01((profile.bpm - 82) / 62), 0.12);
    this.previousBass = bass;
    this.previousHigh = high;
  }

  _registerBeat(now) {
    if (this.lastBeatAt > 0) {
      const interval = now - this.lastBeatAt;
      if (interval > 0.24 && interval < 1.1) this.beatInterval = lerp(this.beatInterval, interval, 0.22);
    }
    this.lastBeatAt = now;
  }

  _updateSpectrumFromAnalyser() {
    if (!this.freq?.length) return;
    for (let i = 0; i < this.spectrum.length; i++) {
      const p = i / Math.max(1, this.spectrum.length - 1);
      const start = Math.floor(Math.pow(p, 1.42) * Math.min(620, this.freq.length - 2));
      const end = Math.max(start + 3, Math.floor(Math.pow((i + 1) / this.spectrum.length, 1.42) * Math.min(660, this.freq.length)));
      const shaped = Math.pow(this._avg(this.freq, start, end) / 255, 0.68);
      this.spectrum[i] = lerp(this.spectrum[i], shaped, 0.34);
    }
  }

  _updateTimedSpectrum(t, profile, bass, mid, high) {
    for (let i = 0; i < this.spectrum.length; i++) {
      const p = i / Math.max(1, this.spectrum.length - 1);
      const lowWeight = Math.max(0, 1 - p * 1.85);
      const midWeight = Math.max(0, 1 - Math.abs(p - 0.48) * 2.2);
      const highWeight = Math.max(0, (p - 0.42) * 1.72);
      const motion = 0.72 + 0.28 * Math.sin(t * (1.9 + p * 4.2) + profile.phase + i * 0.43);
      const value = clamp01((bass * lowWeight + mid * midWeight * 0.72 + high * highWeight * 0.65) * motion);
      // CODEX CHANGE: Let individual fallback spectrum bands visibly jump with the beat.
      this.spectrum[i] = lerp(this.spectrum[i], value, 0.40);
    }
  }

  _avg(arr, start, end) {
    if (!arr?.length) return 0;
    const s = Math.max(0, Math.min(arr.length, start | 0));
    const e = Math.max(s + 1, Math.min(arr.length, end | 0));
    let total = 0;
    for (let i = s; i < e; i++) total += arr[i];
    return total / (e - s);
  }
}
