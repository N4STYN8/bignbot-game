// CODEX CHANGE: Reusable music-reactive ribbon waveform drawn outside the selected turret HUD.
const TWO_PI = Math.PI * 2;
const MAX_POINTS = 128;
const PROFILES = Object.freeze({
  // CODEX CHANGE: Increase ribbon density, displacement, and glow across every VFX tier.
  low: Object.freeze({ points: 64, strands: 3, amplitude: 15, glow: 6, line: 1.15 }),
  med: Object.freeze({ points: 96, strands: 6, amplitude: 25, glow: 12, line: 1.45 }),
  high: Object.freeze({ points: 128, strands: 8, amplitude: 31, glow: 17, line: 1.65 })
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function makeGeometry(count) {
  const cos = new Float32Array(count);
  const sin = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = i / count * TWO_PI;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
  }
  return { cos, sin };
}

export class HudOuterWaveform {
  constructor(canvas) {
    this.canvas = canvas || null;
    this.gfx = this.canvas?.getContext?.("2d", { alpha: true }) || null;
    this.values = new Float32Array(MAX_POINTS);
    this.geometry = {
      low: makeGeometry(PROFILES.low.points),
      med: makeGeometry(PROFILES.med.points),
      high: makeGeometry(PROFILES.high.points)
    };
    this.alpha = 0;
    this.phase = 0;
    this.flash = 0;
    this.bass = 0;
    this.mid = 0;
    this.high = 0;
    this.intensity = 0;
    this.zoomOut = 0;
    this.turret = null;
    this.profileKey = "med";
    this.motionQuery = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    this.reducedMotion = !!this.motionQuery?.matches;
    this._onMotionChange = (event) => { this.reducedMotion = !!event.matches; };
    this.motionQuery?.addEventListener?.("change", this._onMotionChange);
  }

  clear(immediate = false) {
    this.turret = null;
    if (immediate) {
      this.alpha = 0;
      this.flash = 0;
      this.values.fill(0);
      this.gfx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  onCombatEvent(event, selectedTurret) {
    if (!event || !selectedTurret || this.turret !== selectedTurret) return;
    if (event.type === "tower:fire" && event.source === selectedTurret) {
      this.flash = Math.max(this.flash, 0.4);
    } else if (event.type === "enemy:death") {
      this.flash = Math.max(this.flash, event.source === selectedTurret ? 0.9 : 0.55);
    }
  }

  update(dt, selectedTurret, musicVisualizer, options = null) {
    if (!this.gfx || !this.canvas) return;
    const safeDt = Math.max(0.001, Math.min(0.05, Number(dt) || 0.016));
    const disabled = options?.disabled === true || this.reducedMotion;
    const cameraZoom = Math.max(0.5, Math.min(2, Number(options?.zoom) || 1));
    // CODEX CHANGE: Expand the outer ribbon progressively when the camera pulls away.
    this.zoomOut = Math.max(0, 1 - cameraZoom);
    this.profileKey = options?.vfx === "low" || options?.vfx === "high" ? options.vfx : "med";
    const profile = PROFILES[this.profileKey];
    const targetAlpha = selectedTurret && !disabled ? 1 : 0;
    const fadeRate = targetAlpha > this.alpha ? 7 : 8;
    this.alpha += (targetAlpha - this.alpha) * (1 - Math.exp(-safeDt * fadeRate));
    this.flash = Math.max(0, this.flash - safeDt * 2.8);
    this.turret = selectedTurret || null;

    if (this.alpha <= 0.005 && !selectedTurret) {
      this.gfx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    if (disabled) {
      this._draw(profile);
      return;
    }

    const energy = musicVisualizer?.energy || {};
    const spectrum = musicVisualizer?.spectrum;
    const musicPlaying = musicVisualizer?.audioSystem?.isMusicPlaying?.() !== false;
    const quiet = musicPlaying ? 1 : 0.16;
    const bassTarget = clamp01(energy.bass) * quiet;
    const midTarget = clamp01(energy.mid) * quiet;
    const highTarget = clamp01(energy.high) * quiet;
    this.bass += (bassTarget - this.bass) * (1 - Math.exp(-safeDt * 4.2));
    this.mid += (midTarget - this.mid) * (1 - Math.exp(-safeDt * 7));
    this.high += (highTarget - this.high) * (1 - Math.exp(-safeDt * 11));
    this.intensity += (clamp01(energy.intensity) * quiet - this.intensity) * (1 - Math.exp(-safeDt * 6));
    const beat = Math.max(clamp01(energy.beat), clamp01(energy.drop));
    if (beat > 0.58) this.flash = Math.max(this.flash, beat * 0.78);
    this.phase += safeDt * (0.42 + this.high * 0.34);

    for (let i = 0; i < profile.points; i++) {
      const bin = Math.min(31, Math.floor(i / profile.points * 32));
      const fallback = bin < 8 ? this.bass : bin < 21 ? this.mid : this.high;
      const raw = clamp01((spectrum?.[bin] ?? fallback) * quiet);
      const response = bin < 8 ? 4.4 : bin < 21 ? 7.2 : 11.5;
      this.values[i] += (raw - this.values[i]) * (1 - Math.exp(-safeDt * response));
    }
    this._draw(profile);
  }

  _draw(profile) {
    const gfx = this.gfx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cx = width * 0.5;
    const cy = height * 0.5;
    // CODEX CHANGE: Reserve an explicit outer gutter before the ribbon begins and extra room for beats.
    const hudRadius = Math.min(width, height) * 0.333;
    const brightness = clamp01(0.78 + this.intensity * 0.28 + this.flash * 0.44);
    const audioLift = profile.amplitude * (0.20 + this.bass * 0.72 + this.flash * 0.34);
    const zoomEnergy = 1 + this.zoomOut * 0.50;
    const geometry = this.geometry[this.profileKey];

    gfx.clearRect(0, 0, width, height);
    if (this.alpha <= 0.005) return;
    gfx.save();
    gfx.translate(cx, cy);
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    gfx.lineJoin = "round";

    for (let strand = 0; strand < profile.strands; strand++) {
      const strandMix = profile.strands <= 1 ? 0 : strand / (profile.strands - 1);
      const strandPhase = this.phase * (strand % 2 ? -0.72 : 1) + strand * 0.73;
      const baseRadius = hudRadius + 24 + this.zoomOut * 90 + strand * 1.9;
      gfx.strokeStyle = strand % 3 === 1 ? "rgba(184,72,255,0.94)" : strand % 3 === 2 ? "rgba(75,145,255,0.90)" : "rgba(74,251,255,1)";
      gfx.globalAlpha = this.alpha * brightness * (0.88 - strandMix * 0.20);
      gfx.lineWidth = profile.line;
      gfx.shadowColor = strand % 3 === 1 ? "rgba(165,68,255,0.9)" : "rgba(56,246,255,0.95)";
      gfx.shadowBlur = profile.glow * (0.9 + this.flash * 1.1);
      gfx.beginPath();
      for (let i = 0; i <= profile.points; i++) {
        const idx = i === profile.points ? 0 : i;
        const angle = idx / profile.points * TWO_PI;
        const ripple = (Math.sin(angle * (3 + strand % 2) + strandPhase) + 1) * profile.amplitude * 0.34 * zoomEnergy;
        const detail = (Math.sin(angle * (7 + strand) - strandPhase * 1.35) + 1) * profile.amplitude * 0.11 * zoomEnergy;
        const spectrumLift = this.values[idx] * profile.amplitude * (0.34 + strandMix * 0.18) * zoomEnergy;
        const radius = baseRadius + ripple + detail + spectrumLift + audioLift;
        const x = geometry.cos[idx] * radius;
        const y = geometry.sin[idx] * radius;
        if (i === 0) gfx.moveTo(x, y);
        else gfx.lineTo(x, y);
      }
      gfx.closePath();
      gfx.stroke();
    }
    gfx.restore();
  }
}
