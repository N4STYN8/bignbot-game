const VISUAL_MODE_KEY = "orbit_echo_grid_visual_mode_v1";

export const VISUAL_MODES = [
  "Whole Grid Pulse",
  "Grid Wave Sweep",
  "Bass Ripple",
  "Circuit Flow",
  "Track + Tile Sync"
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class MusicVisualizer {
  constructor({ label, audioSystem }) {
    this.label = label;
    this.audioSystem = audioSystem;
    this.mode = this._loadMode();
    this.modeName = VISUAL_MODES[this.mode] || VISUAL_MODES[0];
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.sourceAudio = null;
    this.freq = null;
    this.time = null;
    this.last = performance.now();
    this.timeSeconds = this.last * 0.001;
    this.energy = { bass: 0, mid: 0, high: 0, wave: 0, intensity: 0, beat: 0 };
    this.beatAvg = 0.12;
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
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContextCtor();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.84;
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

  unlock() {
    this.userUnlocked = true;
    const audio = this.audioSystem?.bgm;
    if (audio) this.attachAudio(audio);
    if (this.audioContext?.state === "suspended") this.audioContext.resume().catch(() => {});
  }

  cycleMode() {
    this.mode = (this.mode + 1) % VISUAL_MODES.length;
    this.modeName = VISUAL_MODES[this.mode];
    this._saveMode();
    this._syncLabel();
  }

  getGridState() {
    return {
      mode: this.mode,
      modeName: this.modeName,
      time: this.timeSeconds,
      energy: { ...this.energy }
    };
  }

  _loadMode() {
    try {
      const raw = window.localStorage.getItem(VISUAL_MODE_KEY);
      const idx = raw == null ? 0 : Number(raw);
      return Number.isFinite(idx) ? Math.max(0, Math.min(VISUAL_MODES.length - 1, idx | 0)) : 0;
    } catch (err) {
      return 0;
    }
  }

  _saveMode() {
    try { window.localStorage.setItem(VISUAL_MODE_KEY, String(this.mode)); } catch (err) {}
  }

  _syncLabel() {
    if (this.label) this.label.textContent = `VISUAL MODE: ${this.modeName}`;
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
    const hasAudio = this.analyser && this.freq && this.time && this.sourceAudio && !this.sourceAudio.paused;
    if (hasAudio) {
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.time);
      const bass = this._avg(this.freq, 0, 18) / 255;
      const mid = this._avg(this.freq, 18, 120) / 255;
      const high = this._avg(this.freq, 120, 360) / 255;
      let waveSum = 0;
      for (let i = 0; i < this.time.length; i++) waveSum += Math.abs(this.time[i] - 128);
      const wave = clamp01((waveSum / this.time.length) / 64);
      const instant = bass * 0.72 + mid * 0.18 + high * 0.10;
      this.beatAvg = lerp(this.beatAvg, instant, 0.035);
      const spike = instant > this.beatAvg * 1.42 && bass > 0.18 ? 1 : 0;
      this.energy.beat = Math.max(spike, this.energy.beat - dt * 4.5);
      this.energy.bass = lerp(this.energy.bass, bass, 0.22);
      this.energy.mid = lerp(this.energy.mid, mid, 0.18);
      this.energy.high = lerp(this.energy.high, high, 0.18);
      this.energy.wave = lerp(this.energy.wave, wave, 0.2);
      this.energy.intensity = lerp(this.energy.intensity, instant, 0.16);
      return;
    }

    this.idleT += dt;
    const idle = 0.2 + Math.sin(this.idleT * 0.85) * 0.05;
    this.energy.beat = Math.max(0, this.energy.beat - dt * 3);
    this.energy.bass = lerp(this.energy.bass, idle, 0.02);
    this.energy.mid = lerp(this.energy.mid, idle * 0.75, 0.02);
    this.energy.high = lerp(this.energy.high, idle * 0.5, 0.02);
    this.energy.wave = lerp(this.energy.wave, idle * 0.8, 0.02);
    this.energy.intensity = lerp(this.energy.intensity, idle, 0.02);
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
