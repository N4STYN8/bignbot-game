import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";

/**********************
 * Projectiles + particles
 **********************/
export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, n, kind, tint) {
    for (let i = 0; i < n; i++) {
      const p = {
        x, y,
        vx: rand(-80, 80),
        vy: rand(-80, 80),
        r: rand(1.2, 3.0),
        t: rand(0.20, 0.60),
        kind,
        tint: tint || null
      };
      this.list.push(p);
    }
  }
  spawnDirectional(x, y, n, dirX, dirY, kind, tint) {
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;
    for (let i = 0; i < n; i++) {
      const spread = 0.45;
      const jitterX = nx + rand(-spread, spread);
      const jitterY = ny + rand(-spread, spread);
      const vlen = 60 + rand(0, 90);
      this.list.push({
        x, y,
        vx: jitterX * vlen,
        vy: jitterY * vlen,
        r: rand(1.2, 3.2),
        t: rand(0.22, 0.65),
        kind,
        tint: tint || null
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - dt * 3.5);
      p.vy *= (1 - dt * 3.5);
      if (p.t <= 0) this.list.splice(i, 1);
    }
  }
  draw(gfx) {
    gfx.save();
    for (const p of this.list) {
      const a = clamp(p.t / 0.6, 0, 1);
      if (p.kind === "hit") {
        gfx.globalAlpha = a * 0.75;
        gfx.fillStyle = p.tint || "rgba(234,240,255,0.8)";
      } else if (p.kind === "shard") {
        gfx.globalAlpha = a * 0.85;
        gfx.fillStyle = p.tint || "rgba(154,108,255,0.9)";
      } else if (p.kind === "chem") {
        gfx.globalAlpha = a * 0.55;
        gfx.fillStyle = "rgba(109,255,154,0.7)";
      } else if (p.kind === "muzzle") {
        gfx.globalAlpha = a * 0.65;
        gfx.fillStyle = "rgba(98,242,255,0.85)";
      } else if (p.kind === "boom") {
        gfx.globalAlpha = a * 0.65;
        gfx.fillStyle = "rgba(255,207,91,0.85)";
      } else {
        gfx.globalAlpha = a * 0.5;
        gfx.fillStyle = "rgba(234,240,255,0.55)";
      }
      gfx.beginPath();
      gfx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      gfx.fill();
    }
    gfx.restore();
  }
}


