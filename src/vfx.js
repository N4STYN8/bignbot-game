import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";

/**********************
 * Projectiles + particles
 **********************/
export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, n, kind, tint) {
    for (let i = 0; i < n; i++) {
      const fast = kind === "spark" || kind === "power";
      const heavy = kind === "boom" || kind === "shard";
      const vx = fast ? rand(-150, 150) : rand(-80, 80);
      const vy = fast ? rand(-150, 150) : rand(-80, 80);
      const life = fast ? rand(0.28, 0.74) : heavy ? rand(0.32, 0.86) : rand(0.20, 0.60);
      const p = {
        x, y,
        px: x,
        py: y,
        vx,
        vy,
        r: fast ? rand(1.0, 2.4) : rand(1.2, 3.0),
        t: life,
        life,
        kind,
        tint: tint || null,
        spin: rand(-4, 4)
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
      const life = rand(0.22, 0.65);
      this.list.push({
        x, y,
        px: x,
        py: y,
        vx: jitterX * vlen,
        vy: jitterY * vlen,
        r: rand(1.2, 3.2),
        t: life,
        life,
        kind,
        tint: tint || null,
        spin: rand(-4, 4)
      });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t -= dt;
      p.px = p.x;
      p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.kind === "spark" || p.kind === "power" ? 2.2 : 3.5;
      p.vx *= (1 - dt * drag);
      p.vy *= (1 - dt * drag);
      if (p.kind === "ember" || p.kind === "chem") p.vy -= 16 * dt;
      if (p.t <= 0) this.list.splice(i, 1);
    }
  }
  draw(gfx) {
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (const p of this.list) {
      const a = clamp(p.t / (p.life || 0.6), 0, 1);
      let fill = "rgba(234,240,255,0.55)";
      let alpha = a * 0.5;
      if (p.kind === "hit") {
        alpha = a * 0.75;
        fill = p.tint || "rgba(234,240,255,0.8)";
      } else if (p.kind === "shard") {
        alpha = a * 0.85;
        fill = p.tint || "rgba(154,108,255,0.9)";
      } else if (p.kind === "chem") {
        alpha = a * 0.55;
        fill = p.tint || "rgba(109,255,154,0.7)";
      } else if (p.kind === "muzzle") {
        alpha = a * 0.65;
        fill = p.tint || "rgba(98,242,255,0.85)";
      } else if (p.kind === "boom") {
        alpha = a * 0.65;
        fill = p.tint || "rgba(255,207,91,0.85)";
      } else if (p.kind === "spark") {
        alpha = a * 0.92;
        fill = p.tint || "rgba(98,242,255,0.95)";
      } else if (p.kind === "power") {
        alpha = a * 0.88;
        fill = p.tint || "rgba(255,207,91,0.95)";
      } else if (p.kind === "ember") {
        alpha = a * 0.62;
        fill = p.tint || "rgba(255,152,92,0.82)";
      } else {
        alpha = a * 0.5;
      }
      const trailLen2 = dist2(p.x, p.y, p.px || p.x, p.py || p.y);
      if ((p.kind === "spark" || p.kind === "power" || p.kind === "shard") && trailLen2 > 1) {
        gfx.globalAlpha = alpha * 0.42;
        gfx.strokeStyle = fill;
        gfx.lineWidth = Math.max(1, p.r * 0.9);
        gfx.beginPath();
        gfx.moveTo(p.px, p.py);
        gfx.lineTo(p.x, p.y);
        gfx.stroke();
      }
      gfx.globalAlpha = alpha;
      gfx.fillStyle = fill;
      gfx.beginPath();
      if (p.kind === "shard" || p.kind === "spark") {
        gfx.save();
        gfx.translate(p.x, p.y);
        gfx.rotate((p.life - p.t) * p.spin);
        gfx.rect(-p.r * 0.55, -p.r * 1.4, p.r * 1.1, p.r * 2.8);
        gfx.fill();
        gfx.restore();
      } else {
        gfx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        gfx.fill();
      }
    }
    gfx.restore();
  }
}


