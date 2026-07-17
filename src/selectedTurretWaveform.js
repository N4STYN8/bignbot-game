// CODEX CHANGE: Reusable music-reactive waveform rendered only for the currently selected turret.
import { DEFAULT_TURRET_SPRITE_SIZE, TURRET_GLOW_TINTS, TURRET_SPRITE_SCALE_OVERRIDES } from "./sprites.js?v=202607162144";

const TWO_PI = Math.PI * 2;
const MAX_BARS = 104;
const EMPTY_ENERGY = Object.freeze({ bass: 0, mid: 0, high: 0, intensity: 0, beat: 0, snap: 0, drop: 0 });
const PROFILES = Object.freeze({
  // CODEX CHANGE: Dense, short ticks match the compact synthwave reference without obscuring gameplay.
  low: Object.freeze({ count: 48, gap: 5, bass: 8, mid: 6, high: 3.5, glow: 3, line: 0.8, max: 9, echoes: 1 }),
  med: Object.freeze({ count: 76, gap: 6, bass: 13, mid: 9, high: 5.5, glow: 7, line: 1, max: 13, echoes: 2 }),
  high: Object.freeze({ count: 104, gap: 7, bass: 18, mid: 13, high: 8, glow: 11, line: 1.15, max: 17, echoes: 3 })
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function makeGeometry(count) {
  const cos = new Float32Array(count);
  const sin = new Float32Array(count);
  const spectrumIndex = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const phase = i / count;
    const angle = phase * TWO_PI;
    const mirrored = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
    cos[i] = Math.cos(angle);
    sin[i] = Math.sin(angle);
    spectrumIndex[i] = Math.min(31, Math.floor(mirrored * 31));
  }
  return { cos, sin, spectrumIndex };
}

export class SelectedTurretWaveform {
  constructor() {
    this.values = new Float32Array(MAX_BARS);
    this.geometry = {
      low: makeGeometry(PROFILES.low.count),
      med: makeGeometry(PROFILES.med.count),
      high: makeGeometry(PROFILES.high.count)
    };
    this.profileKey = "med";
    this.alpha = 0;
    this.flash = 0;
    this.bassPulse = 0;
    this.midPulse = 0;
    this.highPulse = 0;
    this.intensity = 0;
    this.time = 0;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.headRadius = DEFAULT_TURRET_SPRITE_SIZE * 0.5;
    this.zoomScale = 1;
    this.color = TURRET_GLOW_TINTS.PULSE;
    this.turret = null;
    this.active = false;
    this.reducedMotion = false;
    this.motionQuery = typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    this.reducedMotion = !!this.motionQuery?.matches;
    this._onMotionChange = (event) => { this.reducedMotion = !!event.matches; };
    this.motionQuery?.addEventListener?.("change", this._onMotionChange);
  }

  clear(immediate = false) {
    this.turret = null;
    this.active = false;
    if (immediate) {
      this.alpha = 0;
      this.flash = 0;
      this.values.fill(0);
    }
  }

  onCombatEvent(event, selectedTurret) {
    if (!event || !selectedTurret || this.turret !== selectedTurret) return;
    if (event.type === "tower:fire" && event.source === selectedTurret) {
      this.flash = Math.max(this.flash, 0.52);
    } else if (event.type === "enemy:death") {
      this.flash = Math.max(this.flash, event.source === selectedTurret ? 1 : 0.72);
    }
  }

  update(dt, selectedTurret, musicVisualizer, options = null) {
    const safeDt = Math.max(0.001, Math.min(0.05, Number(dt) || 0.016));
    const disabled = options?.disabled === true || this.reducedMotion;
    const cameraZoom = Math.max(0.5, Math.min(2, Number(options?.zoom) || 1));
    // CODEX CHANGE: Slightly over-compensate for zoom-out so the head waveform grows on screen.
    this.zoomScale = cameraZoom < 1 ? Math.pow(1 / cameraZoom, 1.28) : 1;
    this.profileKey = options?.vfx === "low" || options?.vfx === "high" ? options.vfx : "med";
    const profile = PROFILES[this.profileKey];
    const geometry = this.geometry[this.profileKey];
    this.time += safeDt;
    const targetAlpha = selectedTurret && !disabled ? 1 : 0;
    const fadeRate = targetAlpha > this.alpha ? 9 : 6;
    this.alpha += (targetAlpha - this.alpha) * (1 - Math.exp(-safeDt * fadeRate));
    this.flash = Math.max(0, this.flash - safeDt * 3.4);

    if (selectedTurret) {
      this.turret = selectedTurret;
      this.active = !disabled;
      this.x = selectedTurret.x;
      this.y = selectedTurret.y;
      this.angle = Number(selectedTurret.aimAng) || 0;
      const spriteScale = TURRET_SPRITE_SCALE_OVERRIDES[selectedTurret.typeKey] || 1;
      this.headRadius = Math.max(24, DEFAULT_TURRET_SPRITE_SIZE * spriteScale * 0.5);
      this.color = TURRET_GLOW_TINTS[selectedTurret.typeKey] || TURRET_GLOW_TINTS.PULSE;
    } else {
      this.active = false;
    }
    if (disabled || (!selectedTurret && this.alpha < 0.01)) return;

    const energy = musicVisualizer?.energy || EMPTY_ENERGY;
    const spectrum = musicVisualizer?.spectrum;
    const musicPlaying = musicVisualizer?.audioSystem?.isMusicPlaying?.() !== false;
    const quietScale = musicPlaying ? 1 : 0.18;
    const bassTarget = clamp01(energy.bass) * quietScale;
    const midTarget = clamp01(energy.mid) * quietScale;
    const highTarget = clamp01(energy.high) * quietScale;
    this.bassPulse += (bassTarget - this.bassPulse) * (1 - Math.exp(-safeDt * 5.2));
    this.midPulse += (midTarget - this.midPulse) * (1 - Math.exp(-safeDt * 8));
    this.highPulse += (highTarget - this.highPulse) * (1 - Math.exp(-safeDt * 12));
    this.intensity += (clamp01(energy.intensity) * quietScale - this.intensity) * (1 - Math.exp(-safeDt * 7));

    const beat = Math.max(clamp01(energy.beat), clamp01(energy.drop));
    if (beat > 0.58) this.flash = Math.max(this.flash, beat * 0.82);
    const combatLift = clamp01((options?.enemyCount || 0) / 90 + (options?.boss ? 0.22 : 0));
    const count = profile.count;
    for (let i = 0; i < count; i++) {
      const spectrumIndex = geometry.spectrumIndex[i];
      const fallback = spectrumIndex < 8 ? this.bassPulse : spectrumIndex < 21 ? this.midPulse : this.highPulse;
      const raw = clamp01((spectrum?.[spectrumIndex] ?? fallback) * quietScale);
      let target;
      let response;
      if (spectrumIndex < 8) {
        target = raw * profile.bass + this.bassPulse * profile.bass * (0.34 + beat * 0.42);
        response = 5.2;
      } else if (spectrumIndex < 21) {
        target = raw * profile.mid + this.midPulse * profile.mid * 0.22;
        response = 8.5;
      } else {
        target = raw * profile.high + this.highPulse * profile.high * (0.12 + clamp01(energy.snap) * 0.28);
        response = 13;
      }
      target += combatLift * (this.profileKey === "high" ? 3.2 : this.profileKey === "med" ? 1.8 : 0.8);
      this.values[i] += (target - this.values[i]) * (1 - Math.exp(-safeDt * response));
    }
  }

  draw(gfx) {
    if (!gfx || this.alpha <= 0.01) return;
    const profile = PROFILES[this.profileKey];
    const geometry = this.geometry[this.profileKey];
    const innerRadius = (this.headRadius + profile.gap) * this.zoomScale;
    const waveformRadius = innerRadius + 3 * this.zoomScale;
    const brightness = clamp01(0.48 + this.intensity * 0.38 + this.flash * 0.5);
    const expansion = 1 + this.flash * (this.profileKey === "high" ? 0.28 : this.profileKey === "med" ? 0.21 : 0.12);
    const echoPulse = 1.2 + this.bassPulse * 2.4 + this.flash * 2.8;

    gfx.save();
    gfx.translate(this.x, this.y);
    gfx.rotate(this.angle);
    gfx.strokeStyle = this.color;
    gfx.lineCap = "round";
    gfx.shadowColor = this.color;

    // CODEX CHANGE: Two clean neon rails establish the reference's bright circular core.
    gfx.globalAlpha = this.alpha * (0.55 + brightness * 0.35);
    gfx.lineWidth = profile.line;
    gfx.shadowBlur = profile.glow * (0.72 + this.flash * 0.8);
    gfx.beginPath();
    gfx.arc(0, 0, innerRadius, 0, TWO_PI);
    gfx.stroke();
    gfx.globalAlpha = this.alpha * (0.32 + brightness * 0.28);
    gfx.lineWidth = Math.max(0.65, profile.line * 0.72);
    gfx.beginPath();
    gfx.arc(0, 0, innerRadius - 2.4, 0, TWO_PI);
    gfx.stroke();

    // CODEX CHANGE: Wrap a dense band of restrained audio ticks around the core ring.
    gfx.globalAlpha = this.alpha * brightness;
    gfx.lineWidth = profile.line;
    gfx.shadowBlur = profile.glow * (1 + this.flash);
    gfx.beginPath();
    for (let i = 0; i < profile.count; i++) {
      const barLength = Math.min(profile.max, 1.6 + this.values[i] * expansion) * this.zoomScale;
      const outerRadius = waveformRadius + barLength;
      const cos = geometry.cos[i];
      const sin = geometry.sin[i];
      gfx.moveTo(cos * waveformRadius, sin * waveformRadius);
      gfx.lineTo(cos * outerRadius, sin * outerRadius);
    }
    gfx.stroke();

    // CODEX CHANGE: Faint rotating dotted echoes add depth without creating another waveform instance.
    gfx.rotate(this.time * 0.12);
    gfx.shadowBlur = profile.glow * 0.35;
    gfx.lineWidth = Math.max(0.55, profile.line * 0.62);
    for (let ring = 0; ring < profile.echoes; ring++) {
      const echoRadius = waveformRadius + (profile.max + 4 + ring * 5 + echoPulse * (ring + 1) * 0.35) * this.zoomScale;
      const tickLength = (ring === 0 ? 1.35 : 0.8) * this.zoomScale;
      gfx.globalAlpha = this.alpha * (0.18 - ring * 0.035) * (0.72 + brightness * 0.28);
      gfx.beginPath();
      for (let i = ring & 1; i < profile.count; i += 2) {
        const cos = geometry.cos[i];
        const sin = geometry.sin[i];
        gfx.moveTo(cos * echoRadius, sin * echoRadius);
        gfx.lineTo(cos * (echoRadius + tickLength), sin * (echoRadius + tickLength));
      }
      gfx.stroke();
    }
    gfx.restore();
  }
}
