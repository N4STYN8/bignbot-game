import * as Shared from "./shared.js";
const { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } = Shared;

/**********************
 * Enemy definitions
 **********************/
export const DAMAGE = {
  PHYS: "Physical",
  ENGY: "Energy",
  CHEM: "Chemical",
  TRUE: "True",
};

export const ANOMALIES = {
  LOW_GRAVITY: {
    name: "Low Gravity",
    desc: "Projectile speed +15%, pierce +1 (except mortar)."
  },
  ION_STORM: {
    name: "Ion Storm",
    desc: "Enemy shields +20%, energy damage +10%."
  },
  CRYO_LEAK: {
    name: "Cryo Leak",
    desc: "Slows stronger +15%, DOT duration -15%."
  },
  WARP_RIPPLE: {
    name: "Warp Ripple",
    desc: "Every 10s, two ground enemies blink forward."
  }
};

export const ENEMY_TYPES = {
  // 8 distinct baseline types
  RUNNER: {
    name: "Skitter",
    hp: 52,
    speed: 96,
    armor: 0,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(98,242,255,0.85)",
    reward: 7,
    desc: "Fast, fragile.",
    shape: "dart",
    size: 11,
    size2: 7
  },
  BRUTE: {
    name: "Bulwark",
    hp: 170,
    speed: 58,
    armor: 0.10,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(234,240,255,0.75)",
    reward: 12,
    desc: "High HP, slow.",
    shape: "tank",
    size: 16,
    size2: 12
  },
  ARMORED: {
    name: "Plated",
    hp: 130,
    speed: 64,
    armor: 0.35,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(160,190,255,0.65)",
    reward: 14,
    desc: "Armor reduces Physical.",
    shape: "hex",
    size: 13,
    size2: 10
  },
  SHIELDED: {
    name: "Prism Guard",
    hp: 110,
    speed: 62,
    armor: 0.05,
    shield: 85,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(154,108,255,0.8)",
    reward: 16,
    desc: "Shield absorbs Energy.",
    shape: "orb",
    size: 13,
    size2: 9
  },
  SPLITTER: {
    name: "Mitosis",
    hp: 95,
    speed: 70,
    armor: 0,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    tint: "rgba(255,207,91,0.8)",
    reward: 18,
    desc: "Splits into two minis on death.",
    shape: "cell",
    size: 12,
    size2: 10,
    onDeath: (game, e) => {
      // spawn two minis at same path distance
      for (let i = 0; i < 2; i++) {
        const m = game.spawnEnemy("MINI", e.pathD - 10 - i * 8);
        m.x += rand(-6, 6);
        m.y += rand(-6, 6);
      }
    }
  },
  REGEN: {
    name: "Mender",
    hp: 120,
    speed: 60,
    armor: 0.08,
    shield: 0,
    regen: 3.5, // hp per second (scaled by speed)
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(109,255,154,0.8)",
    reward: 16,
    desc: "Regenerates over time.",
    shape: "pulse",
    size: 12,
    size2: 9
  },
  STEALTH: {
    name: "Veil",
    hp: 85,
    speed: 82,
    armor: 0,
    shield: 0,
    regen: 0,
    stealth: true, // only targetable within reveal radius
    flying: false,
    onDeath: null,
    tint: "rgba(234,240,255,0.35)",
    reward: 15,
    desc: "Stealth until revealed.",
    shape: "ghost",
    size: 11,
    size2: 8
  },
  FLYING: {
    name: "Skydart",
    hp: 90,
    speed: 88,
    armor: 0.05,
    shield: 30,
    regen: 0,
    stealth: false,
    flying: true,
    onDeath: null,
    tint: "rgba(98,242,255,0.55)",
    reward: 17,
    desc: "Flying: avoids traps.",
    shape: "wing",
    size: 10,
    size2: 7
  },
  PHASE: {
    name: "Phase Runner",
    hp: 80,
    speed: 104,
    armor: 0.04,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._blinkT = (e._blinkT ?? rand(1.6, 2.4)) - dt;
      if (e._blinkT > 0) return;
      e._blinkT = rand(2.2, 3.0);
      const jump = 46;
      e.pathD = Math.min(game.map.totalLen - 2, e.pathD + jump);
      const p = game.map.posAt(e.pathD);
      e.x = p.x; e.y = p.y; e.ang = p.ang;
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 10,
        t: 0.24,
        dur: 0.24,
        max: 46,
        col: "rgba(154,108,255,0.85)",
        boom: false
      });
      game.particles.spawn(e.x, e.y, 6, "shard", "rgba(154,108,255,0.85)");
    },
    tint: "rgba(154,108,255,0.75)",
    reward: 18,
    desc: "Blinks forward periodically.",
    shape: "dart",
    size: 11,
    size2: 8
  },
  SHIELD_DRONE: {
    name: "Shield Drone",
    hp: 95,
    speed: 78,
    armor: 0.06,
    shield: 30,
    regen: 0,
    stealth: false,
    flying: true,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._auraT = (e._auraT ?? 1.8) - dt;
      if (e._auraT > 0) return;
      e._auraT = 2.8;
      const r = 110;
      for (const other of game.enemies) {
        if (other.hp <= 0 || other === e) continue;
        if (dist2(e.x, e.y, other.x, other.y) <= r * r) {
          other.addShield(10, 26);
          game.particles.spawn(other.x, other.y, 2, "muzzle");
        }
      }
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 16,
        t: 0.28,
        dur: 0.28,
        max: r * 0.8,
        col: "rgba(98,242,255,0.75)",
        boom: false
      });
    },
    tint: "rgba(98,242,255,0.7)",
    reward: 18,
    desc: "Recharges nearby shields.",
    shape: "orb",
    size: 10,
    size2: 7
  },
  // Support types used by split mechanic
  MINI: {
    name: "Sporelet",
    hp: 38,
    speed: 92,
    armor: 0,
    shield: 0,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    tint: "rgba(255,207,91,0.6)",
    reward: 4,
    desc: "Spawned from Mitosis.",
    shape: "cell",
    size: 8,
    size2: 6
  },
  BOSS_PROJECTOR: {
    name: "Shield Projector",
    hp: 680,
    speed: 42,
    armor: 0.18,
    shield: 120,
    regen: 0,
    stealth: false,
    flying: false,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._auraT = (e._auraT ?? 1.6) - dt;
      if (e._auraT > 0) return;
      e._auraT = 3.2;
      const r = 140;
      for (const other of game.enemies) {
        if (other.hp <= 0 || other === e) continue;
        if (dist2(e.x, e.y, other.x, other.y) <= r * r) {
          other.addShield(18, 40);
          game.particles.spawn(other.x, other.y, 2, "muzzle");
        }
      }
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 20,
        t: 0.3,
        dur: 0.3,
        max: r * 0.85,
        col: "rgba(98,242,255,0.7)",
        boom: false
      });
    },
    tint: "rgba(98,242,255,0.85)",
    reward: 40,
    desc: "Miniboss: projects shields to nearby allies.",
    shape: "core",
    size: 20,
    size2: 14
  },
  FINAL_BOSS_VORTEX: {
    name: "Vortex Dominus",
    hp: 2400,
    speed: 34,
    armor: 0.25,
    shield: 420,
    regen: 3.5,
    stealth: false,
    flying: false,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._pulseT = (e._pulseT ?? 2.4) - dt;
      if (e._pulseT > 0) return;
      e._pulseT = 3.8;
      const r = 190;
      for (const other of game.enemies) {
        if (other.hp <= 0 || other === e) continue;
        if (dist2(e.x, e.y, other.x, other.y) <= r * r) {
          other.addShield(28, 60);
        }
      }
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 28,
        t: 0.36,
        dur: 0.36,
        max: r * 0.9,
        col: "rgba(255,91,125,0.8)",
        boom: false
      });
      game.particles.spawn(e.x, e.y, 14, "muzzle");
    },
    tint: "rgba(255,120,200,0.9)",
    reward: 120,
    desc: "Boss: massive shields with surge pulses.",
    shape: "core",
    size: 26,
    size2: 18
  },
  FINAL_BOSS_ABYSS: {
    name: "Abyss Maw",
    hp: 2300,
    speed: 30,
    armor: 0.32,
    shield: 300,
    regen: 2.4,
    stealth: false,
    flying: false,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._shockT = (e._shockT ?? 2.2) - dt;
      if (e._shockT > 0) return;
      e._shockT = 3.2;
      const r = 150;
      for (const other of game.enemies) {
        if (other.hp <= 0 || other === e) continue;
        if (dist2(e.x, e.y, other.x, other.y) <= r * r) {
          other.applySlow(0.2, 1.0);
        }
      }
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 24,
        t: 0.32,
        dur: 0.32,
        max: r,
        col: "rgba(98,242,255,0.8)",
        boom: false
      });
      game.particles.spawn(e.x, e.y, 10, "muzzle");
    },
    tint: "rgba(98,242,255,0.9)",
    reward: 120,
    desc: "Boss: emits slowing shockwaves.",
    shape: "diamond",
    size: 26,
    size2: 16
  },
  FINAL_BOSS_IRON: {
    name: "Iron Regent",
    hp: 2500,
    speed: 28,
    armor: 0.38,
    shield: 260,
    regen: 1.8,
    stealth: false,
    flying: false,
    onDeath: null,
    onUpdate: (game, e, dt) => {
      e._guardT = (e._guardT ?? 2.6) - dt;
      if (e._guardT > 0) return;
      e._guardT = 3.6;
      const r = 170;
      for (const other of game.enemies) {
        if (other.hp <= 0 || other === e) continue;
        if (dist2(e.x, e.y, other.x, other.y) <= r * r) {
          other.armor = clamp(other.armor + 0.02, 0, 0.7);
        }
      }
      game.explosions.push({
        x: e.x,
        y: e.y,
        r: 26,
        t: 0.34,
        dur: 0.34,
        max: r * 0.9,
        col: "rgba(255,207,91,0.8)",
        boom: false
      });
      game.particles.spawn(e.x, e.y, 10, "muzzle");
    },
    tint: "rgba(255,207,91,0.9)",
    reward: 120,
    desc: "Boss: hardens nearby enemies.",
    shape: "hex",
    size: 27,
    size2: 18
  }
};

// Damage interactions (simple but meaningful)
export function applyDamageToEnemy(enemy, amount, dmgType) {
  const hpBefore = enemy.hp;
  if (enemy.elite && enemy.elite.tag === "PHASELINK") {
    const protectedState = !enemy.revealed && (!enemy._markedT || enemy._markedT <= 0);
    if (protectedState) amount *= 0.45;
  }
  if (enemy._ionStorm && dmgType === DAMAGE.ENGY) {
    amount *= 1.1;
  }
  // Shields absorb Energy first
  if (enemy.shield > 0 && dmgType === DAMAGE.ENGY) {
    const wasShielded = enemy.shield > 0;
    const s = Math.min(enemy.shield, amount);
    enemy.shield -= s;
    amount -= s * 0.75; // a bit of “refraction”: still leaks some through
    if (wasShielded && enemy.shield <= 0) {
      enemy._game?.spawnText(enemy.x, enemy.y - 14, "SHIELD BREAK", "rgba(154,108,255,0.9)", 1.1);
      enemy._game?.explosions.push({
        x: enemy.x,
        y: enemy.y,
        r: 8,
        t: 0.25,
        dur: 0.25,
        max: 52,
        col: "rgba(154,108,255,0.9)",
        boom: false
      });
      enemy._game?.particles.spawnDirectional(enemy.x, enemy.y, 10, rand(-1, 1), rand(-1, 1), "shard", "rgba(154,108,255,0.9)");
    }
  }

  // Armor reduces Physical
  if (dmgType === DAMAGE.PHYS) {
    amount *= (1 - enemy.armor);
  }

  enemy.hp -= amount;
  return Math.max(0, hpBefore - enemy.hp);
}

export function turretHitFxProfile(sourceKey, dmgType, fallbackTint) {
  const byType = {
    PULSE: { kind: "hit", tint: "rgba(234,240,255,0.95)", burst: 4, ringCol: "rgba(98,242,255,0.8)", ringScale: 1.0 },
    ARC: { kind: "shard", tint: "rgba(154,108,255,0.95)", burst: 5, ringCol: "rgba(154,108,255,0.9)", ringScale: 1.1 },
    FROST: { kind: "muzzle", tint: "rgba(160,210,255,0.92)", burst: 4, ringCol: "rgba(160,210,255,0.9)", ringScale: 0.95 },
    VENOM: { kind: "chem", tint: "rgba(109,255,154,0.92)", burst: 5, ringCol: "rgba(109,255,154,0.85)", ringScale: 1.0 },
    LENS: { kind: "hit", tint: "rgba(255,207,91,0.9)", burst: 3, ringCol: "rgba(255,207,91,0.8)", ringScale: 0.9 },
    MORTAR: { kind: "boom", tint: "rgba(255,207,91,0.95)", burst: 7, ringCol: "rgba(255,120,90,0.9)", ringScale: 1.5 },
    NEEDLE: { kind: "shard", tint: "rgba(190,155,255,0.96)", burst: 4, ringCol: "rgba(190,155,255,0.9)", ringScale: 0.9 },
    DRONE: { kind: "muzzle", tint: "rgba(98,242,255,0.95)", burst: 4, ringCol: "rgba(98,242,255,0.85)", ringScale: 0.95 },
    AURA: { kind: "muzzle", tint: "rgba(98,242,255,0.8)", burst: 3, ringCol: "rgba(98,242,255,0.7)", ringScale: 1.2 },
    TRAP: { kind: "boom", tint: "rgba(255,207,91,0.9)", burst: 5, ringCol: "rgba(255,207,91,0.88)", ringScale: 1.2 }
  };
  if (sourceKey && byType[sourceKey]) return byType[sourceKey];
  const byDmg = dmgType === DAMAGE.ENGY
    ? { kind: "shard", tint: "rgba(154,108,255,0.9)", burst: 3, ringCol: "rgba(154,108,255,0.7)", ringScale: 1.0 }
    : dmgType === DAMAGE.CHEM
      ? { kind: "chem", tint: "rgba(109,255,154,0.88)", burst: 3, ringCol: "rgba(109,255,154,0.7)", ringScale: 1.0 }
      : dmgType === DAMAGE.TRUE
        ? { kind: "boom", tint: "rgba(255,207,91,0.9)", burst: 3, ringCol: "rgba(255,207,91,0.7)", ringScale: 1.0 }
        : { kind: "hit", tint: fallbackTint || "rgba(234,240,255,0.8)", burst: 3, ringCol: "rgba(234,240,255,0.6)", ringScale: 1.0 };
  return byDmg;
}

export class Enemy {
  constructor(typeKey, waveScalar, startD, eliteTag = null) {
    const base = ENEMY_TYPES[typeKey];
    this.typeKey = typeKey;
    this.name = base.name;
    this.isBoss = typeKey === "BOSS_PROJECTOR" || typeKey.startsWith("FINAL_BOSS_");

    // Scaling rules: HP, armor/shield slight, speed slight.
    this.maxHp = base.hp * waveScalar.hp;
    this.hp = this.maxHp;
    this.speed = base.speed * waveScalar.spd;

    this.armor = clamp(base.armor + waveScalar.armor, 0, 0.70);
    this.baseShield = base.shield || 0;
    this.maxShield = Math.max(0, this.baseShield * waveScalar.shield);
    this.shield = this.maxShield;

    this.regen = base.regen * waveScalar.regen;
    this.stealth = !!base.stealth;
    this.flying = !!base.flying;

    this.reward = Math.max(1, Math.floor(base.reward * waveScalar.reward));

    this.tint = base.tint;
    this.desc = base.desc;
    this.onDeath = base.onDeath;
    this.onUpdate = base.onUpdate || null;

    // movement along path
    this.pathD = startD ?? 0;
    this.x = 0; this.y = 0; this.ang = 0;

    // visuals
    this.shape = base.shape || "oval";
    this.r = base.size || (this.flying ? 10 : 12);
    this.r2 = base.size2 || this.r * 0.8;
    this.pulse = rand(0, Math.PI * 2);
    this.hitFlash = 0;

    // DOT stacks (chemical)
    this.dot = 0; // damage per second
    this.dotT = 0; // time remaining

    // Slow effect
    this.slow = 0; // 0..1 percent slow
    this.slowT = 0;

    // reveal for stealth
    this.revealed = !this.stealth;
    this.revealT = 0;
    this._revealLock = false;

    this._dead = false;
    this._lastHitBy = null;
    this._marked = 0;
    this._markedT = 0;
    this._noSplit = false;
    this._noSplitT = 0;
    this.scalar = waveScalar;
    this._combatTextCd = 0;
    this._dotTextCd = 0;

    this.elite = eliteTag ? { tag: eliteTag } : null;
    if (this.elite) {
      switch (eliteTag) {
        case "HARDENED": {
          this.maxHp *= 1.55;
          this.hp = this.maxHp;
          this.armor = clamp(this.armor + 0.18, 0, 0.85);
          this.speed *= 0.86;
          break;
        }
        case "VOLATILE": {
          this.maxHp *= 1.25;
          this.hp = this.maxHp;
          this.speed *= 0.95;
          break;
        }
        case "PHASELINK": {
          this.maxHp *= 1.2;
          this.hp = this.maxHp;
          this.speed *= 1.05;
          this.revealed = false;
          break;
        }
      }
      this.reward = Math.floor(this.reward * 1.35);
    }
    if (this.isBoss) {
      this.r = typeKey.startsWith("FINAL_BOSS_") ? 24 : 18;
      this.reward = Math.max(this.reward, typeKey.startsWith("FINAL_BOSS_") ? 120 : 55);
    }
  }

  update(game, dt) {
    if (this._dead) return;
    if (this.onUpdate) this.onUpdate(game, this, dt);
    if (this._combatTextCd > 0) this._combatTextCd = Math.max(0, this._combatTextCd - dt);
    if (this._dotTextCd > 0) this._dotTextCd = Math.max(0, this._dotTextCd - dt);
    // regen
    if (this.regen > 0 && this.hp > 0) {
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
    }

    // DOT (chemical)
    if (this.dotT > 0) {
      this.dotT -= dt;
      const dmg = this.dot * dt;
      const dealt = applyDamageToEnemy(this, dmg, DAMAGE.CHEM);
      // light shimmer
      game.particles.spawn(this.x, this.y, 1, "chem");
      if (dealt > 0 && this._dotTextCd <= 0) {
        const dmgText = Math.max(1, Math.floor(dealt));
        game.spawnText(this.x, this.y - 8, `-${dmgText}`, "rgba(109,255,154,0.95)", 0.8);
        this._dotTextCd = this.isBoss ? 0.34 : 0.26;
      }
      if (this.hp <= 0 && !this._dead) {
        this._dead = true;
        game.onEnemyKill(this);
        return;
      }
    } else {
      this.dot = 0;
    }

    // slow decay
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slow = 0;
    }

    // stealth reveal timer (Scan Ping can lock reveal until death/leak)
    if (this._revealLock && this.stealth) {
      this.revealed = true;
      this.revealT = 0;
    } else if (this.revealT > 0) {
      this.revealT -= dt;
      if (this.revealT <= 0) this.revealed = false;
    }
    if (this._markedT > 0) {
      this._markedT -= dt;
      if (this._markedT <= 0) this._marked = 0;
    }
    if (this._noSplitT > 0) {
      this._noSplitT -= dt;
      if (this._noSplitT <= 0) this._noSplit = false;
    }

    // movement
    const slowFactor = (1 - this.slow);
    this.pathD += this.speed * slowFactor * dt;
    const p = game.map.posAt(this.pathD);
    this.x = p.x; this.y = p.y; this.ang = p.ang;

    // if reached end
    if (this.pathD >= game.map.totalLen - 1) {
      this.hp = 0;
      if (!this._dead) {
        this._dead = true;
        game.onEnemyLeak(this);
      }
    }

    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.pulse += dt * 2.0;
  }

  takeHit(game, amount, dmgType, sourceKey = null) {
    if (this._dead) return;
    this.hitFlash = 1;
    const dealt = applyDamageToEnemy(this, amount, dmgType);
    if (game && dealt > 0) {
      game.recordDamage(sourceKey, dealt);
    }
    // impact particles vary by turret source for unique hit signatures
    const fx = turretHitFxProfile(sourceKey, dmgType, this.tint);
    const hitCount = Math.min(12, Math.max(2, fx.burst + Math.floor(amount / 18)));
    game.particles.spawn(this.x, this.y, hitCount, fx.kind, fx.tint);
    if (this._combatTextCd <= 0 || amount >= this.maxHp * 0.2 || this.hp <= 0) {
      const dmgText = Math.max(1, Math.floor(dealt || amount));
      const dmgCol = dmgType === DAMAGE.ENGY ? "rgba(154,108,255,0.95)" :
        dmgType === DAMAGE.CHEM ? "rgba(109,255,154,0.95)" :
        dmgType === DAMAGE.TRUE ? "rgba(255,207,91,0.95)" :
        "rgba(234,240,255,0.95)";
      game.spawnText(this.x, this.y - 10, `-${dmgText}`, dmgCol, 0.9);
      this._combatTextCd = this.isBoss ? 0.18 : 0.10;
    }
    game.explosions.push({
      x: this.x,
      y: this.y,
      r: 6 * (fx.ringScale || 1),
      t: 0.16,
      dur: 0.16,
      max: 22 * (fx.ringScale || 1),
      col: fx.ringCol || this.tint || "rgba(234,240,255,0.6)",
      boom: false
    });
    if (sourceKey === "VENOM") {
      game.decals.push({ x: this.x, y: this.y, r: 8, t: 1.1, col: "rgba(109,255,154,0.2)" });
    }
    if (sourceKey === "LENS") {
      game.decals.push({ x: this.x, y: this.y, r: 6, t: 0.8, col: "rgba(255,207,91,0.18)" });
    }
    if (amount > this.maxHp * 0.2) {
      game.explosions.push({
        x: this.x,
        y: this.y,
        r: 10,
        t: 0.22,
        dur: 0.22,
        max: 48,
        col: this.tint || "rgba(255,207,91,0.85)",
        boom: true
      });
      game.particles.spawn(this.x, this.y, 6, "boom", this.tint);
    }
    game.audio?.playLimited("hit", 120);
    if (this.hp <= 0) {
      if (!this._dead) {
        this._dead = true;
        game.onEnemyKill(this);
      }
    }
  }

  applySlow(pct, dur) {
    const mul = this._slowMul || 1;
    const next = clamp(pct * mul, 0, 0.85);
    this.slow = Math.max(this.slow, next);
    this.slowT = Math.max(this.slowT, dur);
      this._game?.spawnText(this.x, this.y - 12, "SLOWED", "rgba(160,190,255,0.95)", 0.85);
  }

  applyDot(dps, dur) {
    this.dot = Math.max(this.dot, dps);
    const mul = this._dotDurMul || 1;
    const next = Math.max(0.2, dur * mul);
    this.dotT = Math.max(this.dotT, next);
      this._game?.spawnText(this.x, this.y - 12, "BURN", "rgba(109,255,154,0.95)", 0.85);
  }

  reveal(dur) {
    if (!this.stealth && !(this.elite && this.elite.tag === "PHASELINK")) return;
    const wasRevealed = this.revealed;
    this.revealed = true;
    this.revealT = Math.max(this.revealT, dur);
    if (!wasRevealed) {
      this._game?.spawnText(this.x, this.y - 12, "REVEALED", "rgba(98,242,255,0.9)", 1.0);
    }
  }

  addShield(amount, extraCap = 0) {
    const cap = (this.maxShield || 0) + extraCap;
    if (cap <= 0) return;
    this.shield = Math.min(cap, this.shield + amount);
  }

  draw(gfx, selected = false) {
    const t = performance.now() * 0.001;
    const bob = this.flying ? (Math.sin(t * 4 + this.pulse) * 3) : 0;
    const x = this.x, y = this.y + bob;
    const squash = 1 + this.hitFlash * 0.18;

    // shadow
    gfx.save();
    gfx.globalAlpha = 0.22;
    gfx.fillStyle = "rgba(0,0,0,0.7)";
    gfx.beginPath();
    gfx.ellipse(x, this.y + 10, this.r * 1.0, this.r * 0.55, 0, 0, Math.PI * 2);
    gfx.fill();
    gfx.restore();

    // body glow halo
    gfx.save();
    const halo = gfx.createRadialGradient(x, y, 0, x, y, this.r * 2.4);
    halo.addColorStop(0, this.tint);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    gfx.globalAlpha = 0.85;
    gfx.fillStyle = halo;
    gfx.beginPath(); gfx.arc(x, y, this.r * 2.0, 0, Math.PI * 2); gfx.fill();
    gfx.restore();

    // main body (stylized “seed” + “shell”)
    gfx.save();
    gfx.translate(x, y);
    gfx.scale(squash, 1 / squash);
    gfx.rotate(this.ang);

    const stealthAlpha = this.stealth && !this.revealed ? 0.18 : 1;
    gfx.globalAlpha = stealthAlpha;

    // outer shell
    gfx.fillStyle = "rgba(7,10,18,0.65)";
    gfx.strokeStyle = this.tint;
    gfx.lineWidth = 2;
    gfx.beginPath();
    switch (this.shape) {
      case "dart": {
        gfx.moveTo(this.r, 0);
        gfx.lineTo(-this.r * 0.6, -this.r2);
        gfx.lineTo(-this.r * 0.6, this.r2);
        gfx.closePath();
        break;
      }
      case "tank": {
        if (gfx.roundRect) {
          gfx.roundRect(-this.r, -this.r2, this.r * 2, this.r2 * 2, 5);
        } else {
          gfx.rect(-this.r, -this.r2, this.r * 2, this.r2 * 2);
        }
        break;
      }
      case "hex": {
        const a = this.r;
        gfx.moveTo(a, 0);
        gfx.lineTo(a * 0.5, a * 0.86);
        gfx.lineTo(-a * 0.5, a * 0.86);
        gfx.lineTo(-a, 0);
        gfx.lineTo(-a * 0.5, -a * 0.86);
        gfx.lineTo(a * 0.5, -a * 0.86);
        gfx.closePath();
        break;
      }
      case "orb": {
        gfx.ellipse(0, 0, this.r, this.r, 0, 0, Math.PI * 2);
        break;
      }
      case "cell": {
        gfx.ellipse(0, 0, this.r, this.r2, 0.25, 0, Math.PI * 2);
        break;
      }
      case "pulse": {
        gfx.ellipse(0, 0, this.r, this.r2 * 0.95, 0.4, 0, Math.PI * 2);
        break;
      }
      case "ghost": {
        gfx.ellipse(0, 0, this.r, this.r2 * 1.05, -0.2, 0, Math.PI * 2);
        break;
      }
      case "wing": {
        gfx.moveTo(this.r, 0);
        gfx.lineTo(0, -this.r2);
        gfx.lineTo(-this.r, 0);
        gfx.lineTo(0, this.r2);
        gfx.closePath();
        break;
      }
      case "core":
      default: {
        gfx.ellipse(0, 0, this.r, this.r * 0.85, 0.2, 0, Math.PI * 2);
        break;
      }
    }
    gfx.fill();
    gfx.stroke();

    // inner “core”
    gfx.globalAlpha *= 0.95;
    gfx.fillStyle = this.tint;
    gfx.beginPath();
    gfx.ellipse(-this.r * 0.15, 0, this.r * 0.42, this.r * 0.32, -0.6, 0, Math.PI * 2);
    gfx.fill();

    // detail accents
    gfx.save();
    gfx.globalAlpha = 0.55;
    gfx.strokeStyle = "rgba(234,240,255,0.25)";
    gfx.lineWidth = 1.5;
    switch (this.shape) {
      case "tank": {
        gfx.beginPath();
        gfx.moveTo(-this.r * 0.4, -this.r2 * 0.6);
        gfx.lineTo(this.r * 0.6, -this.r2 * 0.6);
        gfx.lineTo(this.r * 0.6, this.r2 * 0.6);
        gfx.lineTo(-this.r * 0.4, this.r2 * 0.6);
        gfx.stroke();
        break;
      }
      case "hex": {
        gfx.beginPath();
        gfx.moveTo(0, -this.r * 0.9);
        gfx.lineTo(this.r * 0.6, 0);
        gfx.lineTo(0, this.r * 0.9);
        gfx.lineTo(-this.r * 0.6, 0);
        gfx.closePath();
        gfx.stroke();
        break;
      }
      case "dart": {
        gfx.beginPath();
        gfx.moveTo(-this.r * 0.2, 0);
        gfx.lineTo(this.r * 0.6, 0);
        gfx.stroke();
        break;
      }
      case "wing": {
        gfx.beginPath();
        gfx.moveTo(-this.r * 0.2, -this.r2 * 0.7);
        gfx.lineTo(this.r * 0.6, 0);
        gfx.lineTo(-this.r * 0.2, this.r2 * 0.7);
        gfx.stroke();
        break;
      }
      case "cell": {
        gfx.beginPath();
        gfx.arc(0, 0, this.r * 0.35, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
      case "ghost": {
        gfx.beginPath();
        gfx.arc(0, 0, this.r * 0.6, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
      case "pulse": {
        gfx.beginPath();
        gfx.arc(0, 0, this.r * 0.7, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
      case "orb":
      case "core":
      default: {
        gfx.beginPath();
        gfx.arc(0, 0, this.r * 0.55, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
    }
    gfx.restore();

    if (this.elite || this.isBoss) {
      const tag = this.elite?.tag;
      const eliteCol =
        this.typeKey.startsWith("FINAL_BOSS_") ? "rgba(255,120,200,0.95)" :
        this.isBoss ? "rgba(98,242,255,0.95)" :
        tag === "HARDENED" ? "rgba(255,207,91,0.9)" :
        tag === "VOLATILE" ? "rgba(255,91,125,0.9)" :
        "rgba(154,108,255,0.9)";
      gfx.globalAlpha = 0.65;
      gfx.strokeStyle = eliteCol;
      gfx.lineWidth = this.typeKey.startsWith("FINAL_BOSS_") ? 3.5 : (this.isBoss ? 3 : 2);
      gfx.beginPath();
      gfx.ellipse(0, 0, this.r * 1.35, this.r * 1.05, t * 0.4, 0, Math.PI * 2);
      gfx.stroke();
      if (this.isBoss) {
        gfx.globalAlpha = 0.35;
        gfx.beginPath();
        gfx.ellipse(0, 0, this.r * 1.8, this.r * 1.25, -t * 0.3, 0, Math.PI * 2);
        gfx.stroke();
      }
      if (this.typeKey.startsWith("FINAL_BOSS_")) {
        gfx.globalAlpha = 0.55;
        gfx.strokeStyle = "rgba(255,207,91,0.9)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.moveTo(-this.r * 0.2, -this.r * 1.35);
        gfx.lineTo(0, -this.r * 1.9);
        gfx.lineTo(this.r * 0.2, -this.r * 1.35);
        gfx.stroke();
      }
    }

    // hit flash
    if (this.hitFlash > 0) {
      gfx.globalAlpha = this.hitFlash * 0.7;
      gfx.fillStyle = "rgba(234,240,255,0.9)";
      gfx.beginPath();
      gfx.ellipse(0, 0, this.r * 0.9, this.r * 0.75, 0.2, 0, Math.PI * 2);
      gfx.fill();
    }

    gfx.restore();

    // health bar
    const hpPct = clamp(this.hp / this.maxHp, 0, 1);
    gfx.save();
    gfx.globalAlpha = 0.9 * (this.stealth && !this.revealed ? 0.45 : 1);
    const barW = 34, barH = 5;
    gfx.fillStyle = "rgba(0,0,0,0.55)";
    gfx.fillRect(x - barW / 2, y - this.r - 16, barW, barH);
    gfx.fillStyle = hpPct > 0.5 ? "rgba(109,255,154,0.85)" : (hpPct > 0.2 ? "rgba(255,207,91,0.85)" : "rgba(255,91,125,0.9)");
    gfx.fillRect(x - barW / 2, y - this.r - 16, barW * hpPct, barH);
    gfx.globalAlpha = selected ? 0.98 : 0.86;
    gfx.fillStyle = "rgba(234,240,255,0.96)";
    gfx.font = "800 16px var(--mono), monospace";
    gfx.textAlign = "center";
    gfx.textBaseline = "bottom";
    const hpText = `${Math.max(0, Math.ceil(this.hp))}`;
    gfx.fillText(hpText, x, y - this.r - 18);

    // shield bubble
    if (this.shield > 0) {
      const sh = clamp(this.shield / Math.max(1, this.maxShield), 0.15, 1);
      gfx.save();
      gfx.globalAlpha = 0.35 + sh * 0.25;
      const g = gfx.createRadialGradient(x, y, 0, x, y, this.r + 12);
      g.addColorStop(0, "rgba(154,108,255,0.25)");
      g.addColorStop(0.6, "rgba(154,108,255,0.12)");
      g.addColorStop(1, "rgba(154,108,255,0)");
      gfx.fillStyle = g;
      gfx.beginPath();
      gfx.arc(x, y, this.r + 12, 0, Math.PI * 2);
      gfx.fill();
      gfx.restore();

      gfx.strokeStyle = "rgba(154,108,255,0.85)";
      gfx.lineWidth = 2;
      gfx.beginPath();
      gfx.arc(x, y, this.r + 4, 0, Math.PI * 2);
      gfx.stroke();
    }
    gfx.restore();
  }
}

