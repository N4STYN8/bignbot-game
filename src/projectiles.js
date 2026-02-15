import { DAMAGE, turretHitFxProfile } from "./enemies.js";
import * as Shared from "./shared.js";
const { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } = Shared;

export class Projectile {
  constructor(x, y, vx, vy, r, dmg, dmgType, pierce, ttl, style) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.r = r;
    this.dmg = dmg;
    this.dmgType = dmgType;
    this.pierce = pierce;
    this.ttl = ttl;
    this.style = style; // "bullet", "venom", "mortar", "needle", "spark"
    this.hit = new Set();
    this.prevX = x;
    this.prevY = y;

    // optional behavior hooks (set by turret)
    this.owner = null;
    this.dotDps = 0;
    this.dotDur = 0;
    this.dotSlow = null;
    this.markOnHit = 0;
    this.stunChance = 0;
    this.revealOnHit = false;
    this.vsFlying = 1;
    this._isMortar = false;
    this._blast = 0;
    this._blastSlow = null;
    this._linger = false;
    this._cluster = false;
    this._trailT = 0;
    this._animSeed = rand(0, Math.PI * 2);
  }
  _explode(game) {
    if (this._exploded) return;
    this._exploded = true;
    const cx = this.x, cy = this.y;
    const r = this._blast || 56;

    // AoE damage
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const d2 = dist2(cx, cy, e.x, e.y);
      if (d2 <= r * r) {
        e._lastHitBy = this.owner;
        let dealt = this.dmg;
        if (e.flying) dealt *= this.vsFlying;
        e.takeHit(game, dealt, this.dmgType, this.owner?.typeKey || null);
        if (this._blastSlow) e.applySlow(this._blastSlow.pct, this._blastSlow.dur);
      }
    }

    // cluster sub-blasts
    if (this._cluster) {
      for (let i = 0; i < 3; i++) {
        const ang = rand(0, Math.PI * 2);
        const rr = r * 0.6;
        const ox = Math.cos(ang) * rr * 0.45;
        const oy = Math.sin(ang) * rr * 0.45;
        for (const e of game.enemies) {
          if (e.hp <= 0) continue;
          const d2 = dist2(cx + ox, cy + oy, e.x, e.y);
          if (d2 <= (r * 0.55) * (r * 0.55)) {
            e._lastHitBy = this.owner;
            let dealt = this.dmg * 0.55;
            if (e.flying) dealt *= this.vsFlying;
            e.takeHit(game, dealt, this.dmgType, this.owner?.typeKey || null);
          }
        }
      }
    }

    if (this._linger) {
      game.lingering.push({
        x: cx,
        y: cy,
        r: r * 0.7,
        t: this._lingerDur || 2.2,
        dps: Math.max(6, this.dmg * 0.12),
        col: "rgba(255,207,91,0.25)",
        ownerKey: this.owner?.typeKey || null
      });
    }

    if (this.style === "mortar") {
      game.decals.push({
        x: cx,
        y: cy,
        r: r * 0.55,
        t: 2.6,
        col: "rgba(20,12,8,0.55)"
      });
    }

    game.particles.spawn(cx, cy, 14, "boom");
    this.ttl = 0;
  }
  update(game, dt) {
    this.ttl -= dt;
    const px = this.x;
    const py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.prevX = px;
    this.prevY = py;

    if (this.style === "mortar") {
      game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "chem", "rgba(200,210,240,0.45)");
    } else if (this.style === "bullet") {
      this._trailT -= dt;
      if (this._trailT <= 0) {
        const ownerKey = this.owner?.typeKey || "";
        if (ownerKey === "PULSE") {
          this._trailT = 0.02;
          game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "muzzle", "rgba(98,242,255,0.65)");
        } else if (ownerKey === "VENOM") {
          this._trailT = 0.03;
          game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "chem", "rgba(109,255,154,0.72)");
        } else {
          this._trailT = 0.025;
          game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "hit", "rgba(234,240,255,0.55)");
        }
      }
    } else if (this.style === "needle") {
      this._trailT -= dt;
      if (this._trailT <= 0) {
        this._trailT = 0.03;
        game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "shard", "rgba(190,155,255,0.75)");
      }
    } else if (this.style === "spark") {
      this._trailT -= dt;
      if (this._trailT <= 0) {
        this._trailT = 0.02;
        game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "muzzle", "rgba(98,242,255,0.75)");
      }
    }

    // out of bounds
    if (this.x < -80 || this.y < -80 || this.x > W + 80 || this.y > H + 80) this.ttl = 0;

    // collision
    if (this._isMortar) {
      // mortar explodes on contact or when ttl expires
      if (this.ttl <= 0) this._explode(game);
      for (const e of game.enemies) {
        if (e.hp <= 0) continue;
        const rr = (e.r + this.r) * (e.r + this.r);
        if (dist2(this.x, this.y, e.x, e.y) <= rr) {
          this._explode(game);
          break;
        }
      }
      return;
    }

    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      // flying immunity for ground traps only; projectiles can hit flying unless specified
      if (this.style === "trap") continue;

      const rr = (e.r + this.r) * (e.r + this.r);
      if (dist2(this.x, this.y, e.x, e.y) <= rr) {
        if (this.hit.has(e)) continue;
        this.hit.add(e);

        e._lastHitBy = this.owner;
        e.takeHit(game, this.dmg, this.dmgType, this.owner?.typeKey || null);

        // special style effects
        if (this.style === "venom" && this.dotDps > 0) e.applyDot(this.dotDps, this.dotDur || 3.5);
        if (this.style === "spark") e.applySlow(0.18, 1.2);
        if (this.dotSlow) e.applySlow(this.dotSlow.pct, this.dotSlow.dur);
        if (this.markOnHit) {
          e._marked = Math.max(e._marked || 0, this.markOnHit);
          e._markedT = Math.max(e._markedT || 0, 1.4);
        game.spawnText(e.x, e.y - 14, "MARKED", "rgba(154,108,255,0.95)", 0.85);
        }
        if (this.stunChance && Math.random() < this.stunChance) {
          e.applySlow(0.85, 0.35);
        game.spawnText(e.x, e.y - 14, "STUN", "rgba(255,207,91,0.95)", 0.85);
        }
        if (this.revealOnHit) e.reveal(0.7);

        game.audio?.playLimited("hit", 60);
        const dirX = -this.vx;
        const dirY = -this.vy;
        const impactByStyle = {
          bullet: { kind: "hit", tint: "rgba(234,240,255,0.72)", count: 4, ringCol: "rgba(98,242,255,0.7)", ringScale: 0.95 },
          venom: { kind: "chem", tint: "rgba(109,255,154,0.82)", count: 6, ringCol: "rgba(109,255,154,0.82)", ringScale: 1.05 },
          needle: { kind: "shard", tint: "rgba(190,155,255,0.92)", count: 5, ringCol: "rgba(190,155,255,0.88)", ringScale: 0.9 },
          spark: { kind: "muzzle", tint: "rgba(98,242,255,0.9)", count: 5, ringCol: "rgba(98,242,255,0.88)", ringScale: 1.0 },
          mortar: { kind: "boom", tint: "rgba(255,207,91,0.92)", count: 8, ringCol: "rgba(255,120,90,0.9)", ringScale: 1.35 }
        };
        const pf = impactByStyle[this.style] || impactByStyle.bullet;
        const impactKind = pf.kind;
        const impactTint = pf.tint;
        const impactCount = pf.count;
        game.particles.spawnDirectional(this.x, this.y, impactCount, dirX, dirY, impactKind, impactTint);
        game.explosions.push({
          x: this.x,
          y: this.y,
          r: 6 * pf.ringScale,
          t: 0.14,
          dur: 0.14,
          max: 22 * pf.ringScale,
          col: pf.ringCol,
          boom: false
        });
        this.ttl = 0;
        break;
      }
    }
  }
  draw(gfx) {
    gfx.save();
    let col = "rgba(234,240,255,0.8)";
    let glow = "rgba(98,242,255,0.35)";
    if (this.style === "venom") { col = "rgba(109,255,154,0.85)"; glow = "rgba(109,255,154,0.35)"; }
    if (this.style === "mortar") { col = "rgba(255,207,91,0.85)"; glow = "rgba(255,207,91,0.35)"; }
    if (this.style === "needle") { col = "rgba(154,108,255,0.85)"; glow = "rgba(154,108,255,0.35)"; }
    if (this.style === "spark")  { col = "rgba(98,242,255,0.85)"; glow = "rgba(98,242,255,0.35)"; }
    const ownerKey = this.owner?.typeKey || "";

    const dx = this.x - this.prevX;
    const dy = this.y - this.prevY;
    const segLen = Math.hypot(dx, dy);
    if (segLen > 0.4) {
      gfx.globalAlpha = this.style === "mortar" ? 0.55 : 0.45;
      gfx.strokeStyle = glow;
      gfx.lineWidth = this.style === "needle" ? 2.0 : (this.style === "mortar" ? 2.6 : 1.4);
      gfx.beginPath();
      gfx.moveTo(this.prevX, this.prevY);
      gfx.lineTo(this.x, this.y);
      gfx.stroke();
    }

    const g = gfx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 6);
    g.addColorStop(0, glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    gfx.globalAlpha = 0.9;
    gfx.fillStyle = g;
    gfx.beginPath(); gfx.arc(this.x, this.y, this.r * 6, 0, Math.PI * 2); gfx.fill();

    if (ownerKey === "VENOM") {
      gfx.fillStyle = col;
      gfx.beginPath();
      gfx.ellipse(this.x, this.y, this.r * 1.25, this.r * 0.9, performance.now() * 0.01 + this._animSeed, 0, Math.PI * 2);
      gfx.fill();
      gfx.strokeStyle = "rgba(109,255,154,0.95)";
      gfx.lineWidth = 1.2;
      gfx.stroke();
    } else if (ownerKey === "NEEDLE") {
      const ang = Math.atan2(this.vy, this.vx);
      gfx.save();
      gfx.translate(this.x, this.y);
      gfx.rotate(ang);
      gfx.fillStyle = "rgba(234,240,255,0.92)";
      gfx.beginPath();
      gfx.moveTo(this.r * 2.6, 0);
      gfx.lineTo(-this.r * 1.8, -this.r * 0.65);
      gfx.lineTo(-this.r * 1.8, this.r * 0.65);
      gfx.closePath();
      gfx.fill();
      gfx.strokeStyle = "rgba(190,155,255,0.9)";
      gfx.lineWidth = 1.2;
      gfx.stroke();
      gfx.restore();
    } else if (ownerKey === "DRONE") {
      const t = performance.now() * 0.02 + this._animSeed;
      gfx.strokeStyle = "rgba(98,242,255,0.95)";
      gfx.lineWidth = 1.5;
      gfx.beginPath();
      gfx.moveTo(this.x - this.r * 2.1, this.y - this.r * 0.6);
      gfx.lineTo(this.x - this.r * 0.8, this.y + this.r * 0.4);
      gfx.lineTo(this.x + this.r * 0.3, this.y - this.r * 0.35);
      gfx.lineTo(this.x + this.r * 1.5, this.y + this.r * 0.35);
      gfx.stroke();
      gfx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 2.5);
      gfx.fillStyle = col;
      gfx.beginPath(); gfx.arc(this.x, this.y, this.r * 0.9, 0, Math.PI * 2); gfx.fill();
    } else {
      gfx.fillStyle = col;
      gfx.beginPath(); gfx.arc(this.x, this.y, this.r, 0, Math.PI * 2); gfx.fill();
    }

    if (this.style === "bullet") {
      const t = performance.now() * 0.012 + this._animSeed;
      const ang = Math.atan2(this.vy, this.vx);
      const stretch = 1.8 + 0.3 * Math.sin(t * 1.8);
      gfx.save();
      gfx.translate(this.x, this.y);
      gfx.rotate(ang);

      gfx.globalAlpha = 0.85;
      gfx.fillStyle = "rgba(234,240,255,0.95)";
      gfx.beginPath();
      gfx.ellipse(0, 0, this.r * stretch, this.r * 0.8, 0, 0, Math.PI * 2);
      gfx.fill();

      gfx.globalAlpha = 0.65;
      gfx.strokeStyle = "rgba(98,242,255,0.95)";
      gfx.lineWidth = 1.5;
      gfx.beginPath();
      gfx.ellipse(0, 0, this.r * (2.0 + 0.25 * Math.sin(t * 2.2)), this.r * 1.25, 0, 0, Math.PI * 2);
      gfx.stroke();

      gfx.globalAlpha = 0.4;
      gfx.strokeStyle = "rgba(154,108,255,0.85)";
      gfx.lineWidth = 1.2;
      gfx.beginPath();
      gfx.moveTo(-this.r * 3.4, 0);
      gfx.lineTo(-this.r * 0.9, 0);
      gfx.stroke();
      gfx.restore();
    }
    gfx.restore();
  }
}
