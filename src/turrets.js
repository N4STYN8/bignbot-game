import { DAMAGE } from "./enemies.js";
import { Projectile } from "./projectiles.js";
import * as Shared from "./shared.js";
const { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } = Shared;

/**********************
 * Turrets
 **********************/
export const TURRET_TYPES = {
  PULSE: {
    name: "Pulse Spindle",
    role: "Single-target Physical",
    cost: 55,
    range: 150,
    fire: 0.60,
    dmg: 15,
    dmgType: DAMAGE.PHYS,
    projSpd: 420,
    projStyle: "bullet",
    pierce: 1,
    canHitFlying: true,
    desc: "Reliable kinetic bursts. Good baseline.",
    mods: [
      // Tier I
      [
        { name: "Rifled Core", cost: 45, desc: "+22% damage, +10% range.", apply: t => { t.dmg *= 1.22; t.range *= 1.10; t.visual.rings++; } },
        { name: "Cycler", cost: 45, desc: "-16% fire interval, -8% damage.", apply: t => { t.fire *= 0.84; t.dmg *= 0.92; t.visual.barrels++; } },
      ],
      // Tier II
      [
        { name: "Shredder Tips", cost: 80, desc: "+1 pierce. Physical ignores 10% armor.", apply: t => { t.pierce += 1; t.armorPierce += 0.10; t.visual.spikes = true; } },
        { name: "Echo Ping", cost: 80, desc: "Shots reveal Stealth near hit (brief).", apply: t => { t.revealOnHit = true; t.visual.antenna = true; } },
      ],
      // Tier III
      [
        { name: "Overpressure", cost: 140, desc: "+35% damage, +muzzle shock particles.", apply: t => { t.dmg *= 1.35; t.visual.glow = 1; } },
        { name: "Twin Lattice", cost: 140, desc: "Fires 2 weaker shots per attack.", apply: t => { t.multishot = 2; t.dmg *= 0.67; t.visual.barrels += 1; } },
      ],
      // Tier IV
      [
        { name: "Stabilized Recoil", cost: 180, desc: "-10% fire interval, -5% damage.", apply: t => { t.fire *= 0.90; t.dmg *= 0.95; t.visual.rings++; } },
        { name: "Piercing Lattice", cost: 180, desc: "+1 pierce, -12% damage.", apply: t => { t.pierce += 1; t.dmg *= 0.88; t.visual.spikes = true; } },
      ],
      // Tier V
      [
        { name: "Core Overclock", cost: 230, desc: "+20% damage, +8% fire interval.", apply: t => { t.dmg *= 1.20; t.fire *= 1.08; t.visual.glow = 1; } },
        { name: "Signal Marker", cost: 230, desc: "Hits increase damage taken briefly.", apply: t => { t.markOnHit = Math.max(t.markOnHit || 0, 0.10); t.visual.antenna = true; } },
      ],
    ]
  },

  ARC: {
    name: "Arc Coil",
    role: "Chain Energy",
    cost: 85,
    range: 135,
    fire: 0.86,
    dmg: 18,
    dmgType: DAMAGE.ENGY,
    chain: 3,
    chainFalloff: 0.70,
    canHitFlying: true,
    desc: "Jumps between nearby enemies; great vs swarms.",
    mods: [
      [
        { name: "Long Spark", cost: 55, desc: "+20% range, +1 chain.", apply: t => { t.range *= 1.20; t.chain += 1; t.visual.rings++; } },
        { name: "Ion Burn", cost: 55, desc: "Adds slow on hit; -12% damage.", apply: t => { t.slowOnHit = { pct:0.20, dur:1.2 }; t.dmg *= 0.88; t.visual.glow = 1; } },
      ],
      [
        { name: "Capacitor Bank", cost: 95, desc: "-12% fire interval, +10% damage.", apply: t => { t.fire *= 0.88; t.dmg *= 1.10; t.visual.barrels++; } },
        { name: "Shield Split", cost: 95, desc: "+35% vs shields; -5% vs HP.", apply: t => { t.vsShield *= 1.35; t.vsHp *= 0.95; t.visual.antenna = true; } },
      ],
      [
        { name: "Fork Storm", cost: 160, desc: "+2 chain; falloff reduced.", apply: t => { t.chain += 2; t.chainFalloff = 0.78; t.visual.rings += 1; } },
        { name: "Lightning Net", cost: 160, desc: "Every 3rd shot hits in a small AoE.", apply: t => { t.netBurst = true; t.visual.spikes = true; } },
      ],
      [
        { name: "Arc Relay", cost: 200, desc: "+1 chain, -10% damage.", apply: t => { t.chain += 1; t.dmg *= 0.90; t.visual.rings++; } },
        { name: "Dielectric Lining", cost: 200, desc: "+15% vs shields, -8% range.", apply: t => { t.vsShield *= 1.15; t.range *= 0.92; t.visual.antenna = true; } },
      ],
      [
        { name: "Capacitive Surge", cost: 250, desc: "-10% fire interval, +8% damage.", apply: t => { t.fire *= 0.90; t.dmg *= 1.08; t.visual.glow = 1; } },
        { name: "Static Field", cost: 250, desc: "Slow on hit stronger.", apply: t => { t.slowOnHit = t.slowOnHit ? { pct: t.slowOnHit.pct + 0.06, dur: t.slowOnHit.dur + 0.2 } : { pct:0.18, dur:1.0 }; t.visual.spikes = true; } },
      ],
    ]
  },

  FROST: {
    name: "Frost Vent",
    role: "AoE Slow Cone",
    cost: 75,
    range: 120,
    fire: 1.05,
    dmg: 9,
    dmgType: DAMAGE.ENGY,
    cone: Math.PI / 2.2,
    canHitFlying: false,
    desc: "Chills enemies in a cone; keeps lines stable.",
    mods: [
      [
        { name: "Wider Plume", cost: 45, desc: "+30% cone width, -8% damage.", apply: t => { t.cone *= 1.30; t.dmg *= 0.92; t.visual.rings++; } },
        { name: "Deep Chill", cost: 45, desc: "+20% slow strength.", apply: t => { t.slowPct *= 1.20; t.visual.glow = 1; } },
      ],
      [
        { name: "Cryo Crystals", cost: 85, desc: "Enemies take +15% damage while slowed (mark).", apply: t => { t.chillMark = 0.15; t.visual.spikes = true; } },
        { name: "Pressure Nozzle", cost: 85, desc: "-18% fire interval; +range.", apply: t => { t.fire *= 0.82; t.range *= 1.12; t.visual.barrels++; } },
      ],
      [
        { name: "Whiteout", cost: 140, desc: "Occasional freeze pulse (brief).", apply: t => { t.freezePulse = true; t.visual.rings += 1; } },
        { name: "Rime Lash", cost: 140, desc: "+damage and can affect Flying lightly.", apply: t => { t.dmg *= 1.30; t.canHitFlying = true; t.visual.glow = 1; } },
      ],
      [
        { name: "Cold Front", cost: 180, desc: "+slow duration, -8% damage.", apply: t => { t.slowPct *= 1.10; t.dmg *= 0.92; t.visual.rings++; } },
        { name: "Vent Extension", cost: 180, desc: "+10% range, -10% slow strength.", apply: t => { t.range *= 1.10; t.slowPct *= 0.90; t.visual.barrels++; } },
      ],
      [
        { name: "Hail Core", cost: 230, desc: "+18% damage, -8% cone width.", apply: t => { t.dmg *= 1.18; t.cone *= 0.92; t.visual.glow = 1; } },
        { name: "Deep Freeze", cost: 230, desc: "Freeze pulse more often.", apply: t => { t.freezePulse = true; t._freezePulseRate = 4; t.visual.spikes = true; } },
      ],
    ]
  },

  LENS: {
    name: "Sun Lens",
    role: "Beam Energy",
    cost: 95,
    range: 165,
    fire: 0.08, // continuous ticks
    dmg: 4.6, // per tick
    dmgType: DAMAGE.ENGY,
    canHitFlying: true,
    desc: "Continuous beam; melts shields with sustained contact.",
    mods: [
      [
        { name: "Focusing Iris", cost: 60, desc: "+20% range, +10% damage.", apply: t => { t.range *= 1.20; t.dmg *= 1.10; t.visual.rings++; } },
        { name: "Diffraction", cost: 60, desc: "Beam can split to 2nd target (half dmg).", apply: t => { t.splitBeam = true; t.visual.spikes = true; } },
      ],
      [
        { name: "Heat Soak", cost: 105, desc: "Applies burn DOT (chemical).", apply: t => { t.burn = { dps: 5, dur: 2.8 }; t.visual.glow = 1; } },
        { name: "Shield Harrow", cost: 105, desc: "+30% vs shields.", apply: t => { t.vsShield *= 1.30; t.visual.antenna = true; } },
      ],
      [
        { name: "Corona Ring", cost: 170, desc: "Adds small aura chip damage in range.", apply: t => { t.auraDps = 1.8; t.visual.rings += 2; } },
        { name: "Prismatic Core", cost: 170, desc: "Beam ramps damage over time on same target.", apply: t => { t.ramp = true; t._rampStep = 0.08; t._rampMax = 1.8; t.visual.glow = 1; } },
      ],
      [
        { name: "Thermal Lens", cost: 210, desc: "+10% damage, -8% range.", apply: t => { t.dmg *= 1.10; t.range *= 0.92; t.visual.rings++; } },
        { name: "Wide Aperture", cost: 210, desc: "+12% range, -8% damage.", apply: t => { t.range *= 1.12; t.dmg *= 0.92; t.visual.barrels++; } },
      ],
      [
        { name: "Iridescent Flux", cost: 260, desc: "+15% vs shields, +8% damage.", apply: t => { t.vsShield *= 1.15; t.dmg *= 1.08; t.visual.glow = 1; } },
        { name: "Persistent Beam", cost: 260, desc: "Ramp reaches higher cap, slower gain.", apply: t => { t.ramp = true; t._rampStep = 0.06; t._rampMax = 1.95; t.visual.spikes = true; } },
      ],
    ]
  },

  MORTAR: {
    name: "Mortar Bloom",
    role: "AoE Explosive",
    cost: 110,
    range: 220,
    fire: 1.75,
    dmg: 44,
    dmgType: DAMAGE.PHYS,
    blast: 56,
    projSpd: 260,
    projStyle: "mortar",
    pierce: 99, // handled by AoE
    canHitFlying: true,
    desc: "Lobs explosive seeds. Great vs clumps.",
    mods: [
      [
        { name: "Wider Bloom", cost: 70, desc: "+25% blast radius, -8% damage.", apply: t => { t.blast *= 1.25; t.dmg *= 0.92; t.visual.rings++; } },
        { name: "Packed Charge", cost: 70, desc: "+25% damage, -10% blast.", apply: t => { t.dmg *= 1.25; t.blast *= 0.90; t.visual.spikes = true; } },
      ],
      [
        { name: "Shrapnel Pods", cost: 120, desc: "Blast also slows briefly (not Echo).", apply: t => { t.blastSlow = { pct:0.16, dur:1.0 }; t.visual.glow = 1; } },
        { name: "Airburst Fuse", cost: 120, desc: "Better vs Flying (+20%).", apply: t => { t.vsFlying *= 1.20; t.visual.antenna = true; } },
      ],
      [
        { name: "Cluster Bloom", cost: 190, desc: "Splits into 3 mini blasts.", apply: t => { t.cluster = true; t.visual.barrels += 1; } },
        { name: "Seismic Pulse", cost: 190, desc: "Leaves lingering damage zone (short).", apply: t => { t.lingering = true; t.visual.rings += 1; } },
      ],
      [
        { name: "Wide Detonation", cost: 230, desc: "+15% blast radius, -10% damage.", apply: t => { t.blast *= 1.15; t.dmg *= 0.90; t.visual.rings++; } },
        { name: "Heavy Shells", cost: 230, desc: "+18% damage, -8% blast.", apply: t => { t.dmg *= 1.18; t.blast *= 0.92; t.visual.spikes = true; } },
      ],
      [
        { name: "Fused Shells", cost: 280, desc: "+20% vs Flying, -8% fire interval.", apply: t => { t.vsFlying *= 1.20; t.fire *= 1.08; t.visual.antenna = true; } },
        { name: "Aftershock", cost: 280, desc: "Longer lingering zone, -8% damage.", apply: t => { t.lingering = true; t._lingerDur = 3.0; t.dmg *= 0.92; t.visual.glow = 1; } },
      ],
    ]
  },

  VENOM: {
    name: "Venom Spitter",
    role: "DoT Chemical",
    cost: 80,
    range: 150,
    fire: 0.72,
    dmg: 11,
    dmgType: DAMAGE.CHEM,
    projSpd: 360,
    projStyle: "venom",
    pierce: 1,
    canHitFlying: true,
    desc: "Stacks damage-over-time. Strong vs armor.",
    mods: [
      [
        { name: "Corrosive Mix", cost: 55, desc: "DOT duration +40%.", apply: t => { t.dotDur *= 1.40; t.visual.glow = 1; } },
        { name: "Needle Spray", cost: 55, desc: "Fires 2 shots (weaker).", apply: t => { t.multishot = 2; t.dmg *= 0.72; t.visual.barrels++; } },
      ],
      [
        { name: "Neurotoxin", cost: 95, desc: "DOT also slows slightly (not Echo).", apply: t => { t.dotSlow = { pct:0.10, dur:2.1 }; t.visual.rings++; } },
        { name: "Viral Burst", cost: 95, desc: "On kill, splashes DOT to nearby enemies.", apply: t => { t.onKillSplash = true; t.visual.spikes = true; } },
      ],
      [
        { name: "Caustic Fountain", cost: 160, desc: "+30% damage and +range.", apply: t => { t.dmg *= 1.30; t.range *= 1.12; t.visual.glow = 1; } },
        { name: "Black Bile", cost: 160, desc: "DOT ignores shields fully.", apply: t => { t.dotIgnoresShields = true; t.visual.antenna = true; } },
      ],
      [
        { name: "Seeping Rounds", cost: 200, desc: "+20% DOT duration, -8% damage.", apply: t => { t.dotDur *= 1.20; t.dmg *= 0.92; t.visual.rings++; } },
        { name: "Catalyst Mist", cost: 200, desc: "+10% range, -10% DOT duration.", apply: t => { t.range *= 1.10; t.dotDur *= 0.90; t.visual.barrels++; } },
      ],
      [
        { name: "Viral Saturation", cost: 250, desc: "+20% DOT damage, -10% base damage.", apply: t => { t.dotDpsMult *= 1.20; t.dmg *= 0.90; t.visual.glow = 1; } },
        { name: "Nerve Toxin", cost: 250, desc: "DOT slow stronger.", apply: t => { t.dotSlow = { pct:0.16, dur:2.4 }; t.visual.spikes = true; } },
      ],
    ]
  },

  NEEDLE: {
    name: "Rail Needle",
    role: "Sniper Physical",
    cost: 120,
    range: 300,
    fire: 1.55,
    dmg: 84,
    dmgType: DAMAGE.PHYS,
    projSpd: 760,
    projStyle: "needle",
    pierce: 2,
    canHitFlying: true,
    desc: "Long-range piercing shots. Deletes brutes.",
    mods: [
      [
        { name: "Stabilizer", cost: 75, desc: "+20% damage; slightly slower.", apply: t => { t.dmg *= 1.20; t.fire *= 1.08; t.visual.rings++; } },
        { name: "Quickchamber", cost: 75, desc: "-16% fire interval; -10% damage.", apply: t => { t.fire *= 0.84; t.dmg *= 0.90; t.visual.barrels++; } },
      ],
      [
        { name: "Breach Rod", cost: 135, desc: "+1 pierce; +armor pierce.", apply: t => { t.pierce += 1; t.armorPierce += 0.16; t.visual.spikes = true; } },
        { name: "Echo Marker", cost: 135, desc: "Hits briefly increase all damage taken.", apply: t => { t.markOnHit = 0.12; t.visual.antenna = true; } },
      ],
      [
        { name: "Singularity Pin", cost: 210, desc: "Chance to mini-stun (not Echo).", apply: t => { t.stunChance = 0.16; t.visual.glow = 1; } },
        { name: "Dual Rail", cost: 210, desc: "Fires 2 needles with small spread.", apply: t => { t.multishot = 2; t.dmg *= 0.70; t.visual.barrels += 1; } },
      ],
      [
        { name: "Long Sight", cost: 260, desc: "+12% range, -10% damage.", apply: t => { t.range *= 1.12; t.dmg *= 0.90; t.visual.rings++; } },
        { name: "Focused Barrel", cost: 260, desc: "+15% damage, -8% fire rate.", apply: t => { t.dmg *= 1.15; t.fire *= 1.08; t.visual.spikes = true; } },
      ],
      [
        { name: "Pierce Lancer", cost: 320, desc: "+1 pierce, -10% damage.", apply: t => { t.pierce += 1; t.dmg *= 0.90; t.visual.barrels += 1; } },
        { name: "Signal Breaker", cost: 320, desc: "Hits mark enemies longer.", apply: t => { t.markOnHit = Math.max(t.markOnHit || 0, 0.14); t.visual.antenna = true; } },
      ],
    ]
  },

  AURA: {
    name: "Aura Grove",
    role: "Support Buff",
    cost: 90,
    range: 170,
    fire: 0.50,
    dmg: 0,
    dmgType: DAMAGE.TRUE,
    canHitFlying: true,
    desc: "Buffs allied turrets in range. Also reveals stealth.",
    mods: [
      [
        { name: "Amplify", cost: 60, desc: "Buffs +10% damage.", apply: t => { t.buffDmg += 0.10; t.visual.rings++; } },
        { name: "Overclock", cost: 60, desc: "Buffs +10% attack speed.", apply: t => { t.buffRate += 0.10; t.visual.glow = 1; } },
      ],
      [
        { name: "Wide Canopy", cost: 105, desc: "+25% range; weaker buff.", apply: t => { t.range *= 1.25; t.buffDmg *= 0.92; t.buffRate *= 0.92; t.visual.rings++; } },
        { name: "Revelation", cost: 105, desc: "Reveals Stealth in aura.", apply: t => { t.revealAura = true; t.visual.antenna = true; } },
      ],
      [
        { name: "Harmonic Surge", cost: 170, desc: "Every 5s emits buff pulse (+brief).", apply: t => { t.pulse = true; t.visual.glow = 1; } },
        { name: "Tether Roots", cost: 170, desc: "Adds small slow field (not Echo).", apply: t => { t.slowField = { pct:0.09, dur:0.6 }; t.visual.spikes = true; } },
      ],
      [
        { name: "Amplify II", cost: 210, desc: "Buffs +5% damage, -8% range.", apply: t => { t.buffDmg += 0.05; t.range *= 0.92; t.visual.rings++; } },
        { name: "Overclock II", cost: 210, desc: "Buffs +5% attack speed, -8% range.", apply: t => { t.buffRate += 0.05; t.range *= 0.92; t.visual.glow = 1; } },
      ],
      [
        { name: "Resonance", cost: 260, desc: "+4% damage and +4% speed buffs.", apply: t => { t.buffDmg += 0.04; t.buffRate += 0.04; t.visual.spikes = true; } },
        { name: "Pulse Harmony", cost: 260, desc: "Buff pulse happens more often.", apply: t => { t.pulse = true; t.pulseInterval = 4.0; t.visual.antenna = true; } },
      ],
    ]
  },

  DRONE: {
    name: "Drone Hive",
    role: "Autonomous Drones",
    cost: 130,
    range: 160,
    fire: 2.40, // spawns drones periodically
    dmg: 8,
    dmgType: DAMAGE.PHYS,
    canHitFlying: true,
    desc: "Spawns drones that orbit and shoot. Great coverage.",
    mods: [
      [
        { name: "Extra Bay", cost: 85, desc: "+1 drone active.", apply: t => { t.maxDrones += 1; t.visual.rings++; } },
        { name: "Sharper Stings", cost: 85, desc: "+22% drone damage.", apply: t => { t.dmg *= 1.22; t.visual.spikes = true; } },
      ],
      [
        { name: "Faster Swarm", cost: 145, desc: "-16% spawn interval.", apply: t => { t.fire *= 0.84; t.visual.glow = 1; } },
        { name: "Target Link", cost: 145, desc: "Drones focus same target (burst).", apply: t => { t.link = true; t.visual.antenna = true; } },
      ],
      [
        { name: "Iridescent Shell", cost: 230, desc: "Drones deal +35% to shields.", apply: t => { t.vsShield *= 1.35; t.visual.glow = 1; } },
        { name: "Tri-Drone", cost: 230, desc: "+1 drone and +range.", apply: t => { t.maxDrones += 1; t.range *= 1.12; t.visual.rings += 1; } },
      ],
      [
        { name: "Aux Bay", cost: 280, desc: "+1 drone, -10% damage.", apply: t => { t.maxDrones += 1; t.dmg *= 0.90; t.visual.barrels += 1; } },
        { name: "Long Orbit", cost: 280, desc: "+12% range, -8% fire interval.", apply: t => { t.range *= 1.12; t.fire *= 1.08; t.visual.rings++; } },
      ],
      [
        { name: "Swarm Sync", cost: 340, desc: "Drones fire faster, -8% damage.", apply: t => { t.droneFire *= 0.88; t.dmg *= 0.92; t.visual.glow = 1; } },
        { name: "Shield Flare", cost: 340, desc: "+20% vs shields, -8% range.", apply: t => { t.vsShield *= 1.20; t.range *= 0.92; t.visual.spikes = true; } },
      ],
    ]
  },

  TRAP: {
    name: "Gravity Trap",
    role: "Ground Trap / Control",
    cost: 70,
    range: 120,
    fire: 1.85, // places trap
    dmg: 26,
    dmgType: DAMAGE.TRUE,
    canHitFlying: false,
    desc: "Plants a gravity knot that damages + slows (not Echo).",
    mods: [
      [
        { name: "Wider Knot", cost: 50, desc: "+25% trap radius.", apply: t => { t.trapR *= 1.25; t.visual.rings++; } },
        { name: "Tighter Pull", cost: 50, desc: "+slow strength.", apply: t => { t.trapSlow *= 1.20; t.visual.spikes = true; } },
      ],
      [
        { name: "Chain Knots", cost: 90, desc: "Traps can store 2 charges.", apply: t => { t.maxCharges += 1; t.charges = Math.min(t.maxCharges, t.charges + 1); t.visual.barrels++; } },
        { name: "Siphon", cost: 90, desc: "Traps refund 20% gold on kill.", apply: t => { t.siphon = true; t.visual.antenna = true; } },
      ],
      [
        { name: "Event Horizon", cost: 150, desc: "Trap deals DOT while inside.", apply: t => { t.trapDot = { dps: 7, dur: 2.4 }; t.visual.glow = 1; } },
        { name: "Anchor Field", cost: 150, desc: "Traps briefly stop Splitters from splitting.", apply: t => { t.noSplit = true; t.visual.rings += 1; } },
      ],
      [
        { name: "Extra Charge", cost: 190, desc: "+1 charge, -10% damage.", apply: t => { t.maxCharges += 1; t.charges = Math.min(t.maxCharges, t.charges + 1); t.dmg *= 0.90; t.visual.barrels++; } },
        { name: "Time Sink", cost: 190, desc: "+25% trap duration, -8% slow.", apply: t => { t.trapDur *= 1.25; t.trapSlow *= 0.92; t.visual.rings++; } },
      ],
      [
        { name: "Gravity Well", cost: 240, desc: "+20% radius, -8% damage.", apply: t => { t.trapR *= 1.20; t.dmg *= 0.92; t.visual.spikes = true; } },
        { name: "Crush Field", cost: 240, desc: "+15% slow strength, -10% damage.", apply: t => { t.trapSlow *= 1.15; t.dmg *= 0.90; t.visual.glow = 1; } },
      ],
    ]
  },
};

export class Turret {
  constructor(typeKey, x, y) {
    this.typeKey = typeKey;
    const base = TURRET_TYPES[typeKey];

    this.name = base.name;
    this.role = base.role;
    this.desc = base.desc;

    this.x = x; this.y = y;

    this.level = 0; // 0..5 (Upgrade I/II/III/IV/V)
    this.modsChosen = []; // store chosen mod indexes per tier

    // base stats (will mutate with upgrades)
    this.range = base.range;
    this.fire = base.fire;
    this.cool = rand(0, this.fire); // stagger
    this.dmg = base.dmg;
    this.dmgType = base.dmgType;
    this.projSpd = base.projSpd || 0;
    this.projStyle = base.projStyle || null;
    this.pierce = base.pierce || 1;
    this.chain = base.chain || 0;
    this.chainFalloff = base.chainFalloff || 0.7;
    this.cone = base.cone || 0;
    this.blast = base.blast || 0;
    this.canHitFlying = base.canHitFlying !== false;

    // modifiers
    this.vsShield = 1.0;
    this.vsHp = 1.0;
    this.vsFlying = 1.0;
    this.armorPierce = 0.0;

    // special flags/effects
    this.slowPct = 0.22; // default for frost/trap
    this.dotDur = 3.5;   // venom
    this.dotDpsMult = 0.32;
    this.dotIgnoresShields = false;
    this.onKillSplash = false;

    this.revealOnHit = false;
    this.markOnHit = 0;
    this.stunChance = 0;

    // support
    this.buffDmg = 0.09;
    this.buffRate = 0.09;
    this.revealAura = false;
    this.pulse = false;
    this.pulseT = 0;
    this.pulseInterval = 5.0;
    this.slowField = null;

    // drones
    this.maxDrones = 2;
    this.drones = [];
    this.link = false;
    this.droneFire = 0.42;

    // trap
    this.trapR = 54;
    this.trapSlow = 0.32;
    this.trapDur = 2.2;
    this.maxCharges = 1;
    this.charges = 1;
    this.siphon = false;
    this.trapDot = null;
    this.noSplit = false;

    // visuals (changes every upgrade)
    this.visual = {
      rings: 0,
      barrels: 0,
      spikes: false,
      antenna: false,
      glow: 0, // 0/1
    };

    this.targetId = -1;
    this.aimAng = 0;
    this.flash = 0;
    this.recoil = 0;
    this.pulseBoostT = 0;
    this.targetMode = "FIRST";
    this.boosted = false;
    this._powerMul = { dmg: 1, range: 1 };

    this.costSpent = base.cost;
  }

  applyPowerBoost() {
    if (this.boosted) return;
    this.boosted = true;
    this._powerMul = { dmg: 1.25, range: 1.15 };
    this.dmg *= this._powerMul.dmg;
    this.range *= this._powerMul.range;
    this.visual.glow = Math.max(this.visual.glow || 0, 1);
  }

  // Clone the turret and apply a mod (for UI preview)
  static previewAfterUpgrade(turret, tierIndex, modIndex) {
    const t = turret._clone();
    t.applyUpgrade(tierIndex, modIndex, true);
    return t;
  }

  _clone() {
    const t = new Turret(this.typeKey, this.x, this.y);
    // copy current mutated stats
    Object.assign(t, JSON.parse(JSON.stringify(this)));
    // restore methods/complex fields we want as-is:
    t.drones = (this.drones || []).map(d => ({ ...d }));
    return t;
  }

  getTierOptions(tierIndex) {
    const base = TURRET_TYPES[this.typeKey];
    return base.mods[tierIndex];
  }

  getUpgradeCost(tierIndex, modIndex) {
    return this.getTierOptions(tierIndex)[modIndex].cost;
  }

  applyUpgrade(tierIndex, modIndex, previewOnly = false) {
    if (tierIndex !== this.level) return false;
    if (tierIndex > 4) return false;

    const mod = this.getTierOptions(tierIndex)[modIndex];
    mod.apply(this);

    if (!previewOnly) {
      this.modsChosen[tierIndex] = modIndex;
      this.level++;
      // visual “tier bump”
      this.flash = 1;
      this.costSpent += mod.cost;
    }
    return true;
  }

  getBuffedStats(game) {
    // Aura Grove buffs other turrets in range
    let dmgMul = 1, rateMul = 1;
    for (const a of game.turrets) {
      if (a.typeKey !== "AURA") continue;
      const d = Math.sqrt(dist2(this.x, this.y, a.x, a.y));
      if (d <= a.range) {
        dmgMul *= (1 + a.buffDmg);
        rateMul *= (1 + a.buffRate);
      }
    }
    return { dmgMul, rateMul };
  }

  canTarget(enemy) {
    if (enemy.hp <= 0) return false;
    if (!this.canHitFlying && enemy.flying) return false;

    // stealth targeting rules: must be revealed OR within reveal radius (close)
    if (enemy.stealth && !enemy.revealed) {
      const d = Math.sqrt(dist2(this.x, this.y, enemy.x, enemy.y));
      if (d > 90) return false;
    }
    return true;
  }

  acquireTarget(game) {
    let best = null;
    let bestScore = -1;
    const mode = this.targetMode || "FIRST";

    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i];
      if (!this.canTarget(e)) continue;
      const d2v = dist2(this.x, this.y, e.x, e.y);
      if (d2v > this.range * this.range) continue;

      let baseScore = 0;
      switch (mode) {
        case "LAST":
          baseScore = -e.pathD;
          break;
        case "STRONGEST":
          baseScore = e.hp;
          break;
        case "MOST_SHIELD":
          baseScore = e.shield;
          break;
        case "MOST_ARMOR":
          baseScore = e.armor;
          break;
        default:
          baseScore = e.pathD;
          break;
      }
      const score = baseScore - d2v * 0.000003;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  update(game, dt) {
    const visualDt = game._realDt || dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - visualDt * 2.5);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - visualDt * 5.0);
    if (this.pulseBoostT > 0) {
      const realDt = game._realDt || dt;
      this.pulseBoostT = Math.max(0, this.pulseBoostT - realDt);
    }
    const pulseRateMul = this.pulseBoostT > 0 ? 4 : 1;
    const pulseDmgMul = this.pulseBoostT > 0 ? 2 : 1;
    const globalMul = game.globalOverchargeT > 0 ? 1.35 : 1;

    // Aura Grove special handling
    if (this.typeKey === "AURA") {
      // reveal + slow field pulses
      if (this.revealAura) {
        for (const e of game.enemies) {
          if (e.hp <= 0 || !e.stealth) continue;
          if (dist2(this.x, this.y, e.x, e.y) <= this.range * this.range) e.reveal(0.6);
        }
      }
      if (this.slowField) {
        for (const e of game.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(this.x, this.y, e.x, e.y) <= this.range * this.range) {
            e.applySlow(this.slowField.pct, this.slowField.dur);
          }
        }
      }
      if (this.pulse) {
        this.pulseT -= dt;
        if (this.pulseT <= 0) {
          this.pulseT = this.pulseInterval;
          game.explosions.push({
            x: this.x,
            y: this.y,
            r: 12,
            t: 0.34,
            dur: 0.34,
            max: this.range * 0.42,
            col: "rgba(98,242,255,0.82)",
            boom: false
          });
          game.explosions.push({
            x: this.x,
            y: this.y,
            r: 10,
            t: 0.28,
            dur: 0.28,
            max: this.range * 0.28,
            col: "rgba(154,108,255,0.72)",
            boom: false
          });
          game.particles.spawn(this.x, this.y, 16, "muzzle");
          game.audio.playLimited("turret_aura", 240);
        }
      }
      return;
    }

    // Drone hive: spawn and update drones
    if (this.typeKey === "DRONE") {
      // keep drone count
      while (this.drones.length < this.maxDrones) {
        this.drones.push({
          ang: rand(0, Math.PI * 2),
          r: rand(18, 28),
          cool: rand(0.1, 0.4),
          target: null
        });
      }
      while (this.drones.length > this.maxDrones) this.drones.pop();

      const buff = this.getBuffedStats(game);
      const skip = game.getSkipBuff();
      const lowGravity = game.waveAnomaly?.key === "LOW_GRAVITY";
      const inHiveRange = (e) => e && this.canTarget(e) && dist2(this.x, this.y, e.x, e.y) <= this.range * this.range;
      for (const d of this.drones) {
        d.ang += dt * 2.0;
        const ox = Math.cos(d.ang) * (26 + d.r);
        const oy = Math.sin(d.ang) * (16 + d.r * 0.7);

        d.cool -= dt * buff.rateMul * skip.rateMul * pulseRateMul * globalMul;
        if (d.cool <= 0) {
          d.cool = this.droneFire; // drone fire cadence
          // pick target
          let target = null;
          if (this.link && this.targetId !== -1) {
            const linked = game.enemies.find(e => e._id === this.targetId && e.hp > 0);
            if (inHiveRange(linked)) target = linked;
          }
          if (!target) target = this.acquireTarget(game);
          if (target) {
            this.targetId = target._id;
            const dx = (target.x - (this.x + ox));
            const dy = (target.y - (this.y + oy));
            const len = Math.hypot(dx, dy) || 1;
            const spd = 520 * (lowGravity ? 1.15 : 1);
            const vx = (dx / len) * spd;
            const vy = (dy / len) * spd;
            const dmg = this.dmg * buff.dmgMul * skip.dmgMul * pulseDmgMul;
            const pierce = 1 + (lowGravity ? 1 : 0);
            const p = new Projectile(this.x + ox, this.y + oy, vx, vy, 2.4, dmg, DAMAGE.PHYS, pierce, 1.4, "spark");
            p.owner = this;
            game.projectiles.push(p);
            game.particles.spawn(this.x + ox, this.y + oy, 2, "muzzle");
            game.audio.playLimited("turret_drone", 160);
          } else {
            this.targetId = -1;
          }
        }
      }

      // spawn new drone periodically (handled by maxDrones upgrades), no extra fire timer needed
      return;
    }

    // Trap: place knots periodically (charges)
    if (this.typeKey === "TRAP") {
      const skip = game.getSkipBuff();
      this.charges = clamp(this.charges, 0, this.maxCharges);
      this.cool -= dt * skip.rateMul * pulseRateMul * globalMul;
      if (this.cool <= 0) {
        this.cool = this.fire;
        if (this.charges < this.maxCharges) this.charges++;
      }
      // auto-deploy if have charge and enemy in range
      if (this.charges >= 1) {
        const deployRange = this.range + this.trapR * 0.75;
        let found = null;
        for (const e of game.enemies) {
          if (e.hp <= 0 || e.flying) continue;
          if (dist2(this.x, this.y, e.x, e.y) <= deployRange * deployRange) { found = e; break; }
        }
        if (found) {
          this.charges--;
          game.traps.push({
            x: found.x, y: found.y,
            r: this.trapR,
            t: this.trapDur,
            dmg: this.dmg * skip.dmgMul * pulseDmgMul,
            slow: this.trapSlow,
            dot: this.trapDot ? { dps: this.trapDot.dps * skip.dmgMul * pulseDmgMul, dur: this.trapDot.dur } : null,
            siphon: this.siphon,
            noSplit: this.noSplit,
            owner: this
          });
          game.particles.spawn(found.x, found.y, 10, "muzzle");
          game.audio.playLimited("turret_trap", 220);
        }
      }
      return;
    }

    // Normal turrets
    const buff = this.getBuffedStats(game);
    const skip = game.getSkipBuff();
    const lowGravity = game.waveAnomaly?.key === "LOW_GRAVITY";
    const fireInterval = this.fire / (buff.rateMul * skip.rateMul * pulseRateMul * globalMul);
    this.cool -= dt;

    const target = this.acquireTarget(game);
    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      this.aimAng = Math.atan2(dy, dx);
      this.targetId = target._id;
    } else {
      this.targetId = -1;
    }

    if (target && this.cool <= 0) {
      this.cool = fireInterval;
      this.flash = 1;
      this.recoil = 1;
      const muzzleX = this.x + Math.cos(this.aimAng) * 14;
      const muzzleY = this.y + Math.sin(this.aimAng) * 14;
      const shotColMap = {
        PULSE: "rgba(98,242,255,0.88)",
        ARC: "rgba(186,140,255,0.9)",
        FROST: "rgba(180,225,255,0.9)",
        LENS: "rgba(255,207,91,0.9)",
        MORTAR: "rgba(255,150,110,0.9)",
        VENOM: "rgba(109,255,154,0.9)",
        NEEDLE: "rgba(190,155,255,0.92)",
        DRONE: "rgba(98,242,255,0.9)",
        AURA: "rgba(98,242,255,0.85)",
        TRAP: "rgba(255,207,91,0.88)"
      };
      const shotCol = shotColMap[this.typeKey] || "rgba(234,240,255,0.88)";
      game.explosions.push({
        x: muzzleX,
        y: muzzleY,
        r: 5,
        t: 0.16,
        dur: 0.16,
        max: 20,
        col: shotCol,
        boom: false
      });
      game.particles.spawnDirectional(muzzleX, muzzleY, 3, Math.cos(this.aimAng), Math.sin(this.aimAng), "muzzle", shotCol);

      const dmgBase = this.dmg * buff.dmgMul * skip.dmgMul * pulseDmgMul;
      const dmgType = this.dmgType;

      // Fire behavior by turret type
      switch (this.typeKey) {
        case "PULSE":
        case "VENOM":
        case "NEEDLE": {
          const turretSfxKey = this.typeKey === "PULSE"
            ? "turret_pulse"
            : this.typeKey === "VENOM"
              ? "turret_venom"
              : "turret_needle";
          const turretSfxCd = this.typeKey === "PULSE" ? 120 : this.typeKey === "VENOM" ? 150 : 130;
          game.audio.playLimited(turretSfxKey, turretSfxCd);
          // projectiles
          const shots = this.multishot || 1;
          for (let s = 0; s < shots; s++) {
            const spread = shots > 1 ? (s - (shots - 1) / 2) * 0.08 : 0;
            const ang = this.aimAng + spread;
            const spd = this.projSpd * (lowGravity ? 1.15 : 1);
            const vx = Math.cos(ang) * spd;
            const vy = Math.sin(ang) * spd;

            // small muzzle offset
            const mx = this.x + Math.cos(ang) * 14;
            const my = this.y + Math.sin(ang) * 14;

            // physical armor pierce handled as bonus damage vs armor (approx)
            let dmg = dmgBase;
            if (this.armorPierce > 0 && dmgType === DAMAGE.PHYS) {
              dmg *= (1 + this.armorPierce * 0.35);
            }

            const style = this.projStyle || "bullet";
            const pierce = this.pierce + (lowGravity ? 1 : 0);
            const p = new Projectile(mx, my, vx, vy, style === "needle" ? 2.0 : 3.2, dmg, dmgType, pierce, 1.6, style);
            p.owner = this;
            p.revealOnHit = this.revealOnHit;
            p.markOnHit = this.markOnHit || 0;
            p.stunChance = this.stunChance || 0;
            p.vsFlying = this.vsFlying || 1;
            if (this.typeKey === "VENOM") {
              p.dotDps = dmgBase * this.dotDpsMult;
              p.dotDur = this.dotDur;
              if (this.dotSlow) p.dotSlow = this.dotSlow;
            }
            game.projectiles.push(p);
            game.particles.spawn(mx, my, 2, "muzzle");

            // reveal-on-hit is handled when projectile hits (we approximate by ray-check small near target)
            if (this.revealOnHit) {
              // mark an area around target now; projectile will probably hit soon
              target.reveal(0.6);
              for (const e of game.enemies) {
                if (e.stealth && dist2(e.x, e.y, target.x, target.y) < 70 * 70) e.reveal(0.6);
              }
            }
          }
          break;
        }

        case "ARC": {
          game.audio.playLimited("turret_arc", 160);
          // chain lightning: direct instant hits + visual arcs
          const chainCount = this.chain;
          const visited = new Set();
          let current = target;
          let dmg = dmgBase;
          let hits = 0;

          for (let hop = 0; hop < chainCount; hop++) {
            if (!current) break;
            visited.add(current);
            hits++;
            // compute shield vs hp multipliers
            let dealt = dmg;
            if (current.shield > 0) dealt *= this.vsShield;
            else dealt *= this.vsHp;

            current.takeHit(game, dealt, DAMAGE.ENGY, this.typeKey);

            if (this.slowOnHit) current.applySlow(this.slowOnHit.pct, this.slowOnHit.dur);

            // find next nearest within hop radius
            let next = null;
            let bestD2 = 99999999;
            for (const e of game.enemies) {
              if (e.hp <= 0 || visited.has(e)) continue;
              if (!this.canTarget(e)) continue;
              const d2v = dist2(current.x, current.y, e.x, e.y);
              if (d2v < bestD2 && d2v < 110 * 110) { bestD2 = d2v; next = e; }
            }

            // add arc visual
            game.arcs.push({
              ax: hop === 0 ? this.x : visited.size === 1 ? this.x : current.x,
              ay: hop === 0 ? this.y : visited.size === 1 ? this.y : current.y,
              bx: current.x,
              by: current.y,
              t: 0.22
            });

            dmg *= this.chainFalloff;
            current = next;
          }
          if (hits > 1) {
            game.spawnText(target.x, target.y - 18, `CHAIN x${hits}`, "rgba(154,108,255,0.95)", 1.2);
          }

          // Net burst every 3rd shot
          if (this.netBurst) {
            this._netBurstCounter = (this._netBurstCounter || 0) + 1;
            if (this._netBurstCounter % 3 === 0) {
              const cx = target.x, cy = target.y;
              for (const e of game.enemies) {
                if (e.hp <= 0) continue;
                if (dist2(cx, cy, e.x, e.y) <= 60 * 60) {
                  e.takeHit(game, dmgBase * 0.55, DAMAGE.ENGY, this.typeKey);
                  e.applySlow(0.12, 0.9);
                }
              }
              game.particles.spawn(cx, cy, 12, "muzzle");
            }
          }
          break;
        }

        case "FROST": {
          game.audio.playLimited("turret_frost", 180);
          // cone chill: hits enemies in cone
          const ang = this.aimAng;
          const cosA = Math.cos(ang), sinA = Math.sin(ang);

          for (const e of game.enemies) {
            if (e.hp <= 0) continue;
            if (e.flying && !this.canHitFlying) continue;
            const dx = e.x - this.x, dy = e.y - this.y;
            const d = Math.hypot(dx, dy);
            if (d > this.range) continue;
            const nx = dx / (d || 1), ny = dy / (d || 1);
            const dot = nx * cosA + ny * sinA; // cos of angle
            const th = Math.cos(this.cone / 2);
            if (dot >= th) {
              // damage and slow
              const dealt = dmgBase * (e.shield > 0 ? this.vsShield : this.vsHp);
              e.takeHit(game, dealt, DAMAGE.ENGY, this.typeKey);
              e.applySlow(this.slowPct, 1.4);
              if (this.chillMark) {
                e._marked = Math.max(e._marked || 0, this.chillMark);
                e._markedT = Math.max(e._markedT || 0, 1.6);
              }
            }
          }

          // occasional freeze pulse
          if (this.freezePulse) {
            this._freezeCounter = (this._freezeCounter || 0) + 1;
            const rate = this._freezePulseRate || 6;
            if (this._freezeCounter % rate === 0) {
              for (const e of game.enemies) {
                if (e.hp <= 0) continue;
                if (dist2(this.x, this.y, e.x, e.y) <= (this.range * 0.75) * (this.range * 0.75)) {
                  e.applySlow(0.65, 0.45);
                }
              }
              game.particles.spawn(this.x, this.y, 10, "muzzle");
            }
          }
          game.cones.push({ x: this.x, y: this.y, ang: this.aimAng, cone: this.cone, r: this.range, t: 0.26 });
          game.explosions.push({
            x: this.x,
            y: this.y,
            r: 12,
            t: 0.22,
            dur: 0.22,
            max: 54,
            col: "rgba(175,230,255,0.95)",
            boom: false
          });
          game.explosions.push({
            x: this.x + Math.cos(this.aimAng) * (this.range * 0.24),
            y: this.y + Math.sin(this.aimAng) * (this.range * 0.24),
            r: 10,
            t: 0.18,
            dur: 0.18,
            max: 42,
            col: "rgba(120,205,255,0.85)",
            boom: false
          });
          game.particles.spawnDirectional(
            this.x + Math.cos(this.aimAng) * 12,
            this.y + Math.sin(this.aimAng) * 12,
            8,
            Math.cos(this.aimAng),
            Math.sin(this.aimAng),
            "shard",
            "rgba(175,230,255,0.92)"
          );
          break;
        }

        case "LENS": {
          game.audio.playLimited("turret_lens", 70);
          // beam turret handled in draw/update pass by storing target
          // apply damage per tick (fire is small interval)
          let dealt = dmgBase;
          if (target.shield > 0) dealt *= this.vsShield;
          else dealt *= this.vsHp;

          // Balance: tone down Sun Lens ramp to prevent late-game dominance.
          if (this.ramp) {
            const step = this._rampStep || 0.08;
            const max = this._rampMax || 1.8;
            if (this._rampId === target._id) this._ramp = clamp((this._ramp || 1) + step, 1, max);
            else { this._rampId = target._id; this._ramp = 1; }
            dealt *= this._ramp;
          }

          // chill mark increases damage taken (from Frost) – apply here too
          if (target._markedT > 0) dealt *= (1 + target._marked);

          target.takeHit(game, dealt, DAMAGE.ENGY, this.typeKey);

          if (this.burn) target.applyDot(this.burn.dps, this.burn.dur);

          // split beam to second target
          if (this.splitBeam) {
            let second = null, best = 1e9;
            for (const e of game.enemies) {
              if (e === target || e.hp <= 0) continue;
              if (!this.canTarget(e)) continue;
              const d2v = dist2(target.x, target.y, e.x, e.y);
              if (d2v < best && d2v < 120 * 120) { best = d2v; second = e; }
            }
            if (second) {
              second.takeHit(game, dealt * 0.5, DAMAGE.ENGY, this.typeKey);
              game.beams.push({ ax: this.x, ay: this.y, bx: second.x, by: second.y, t: 0.08, col: "rgba(154,108,255,0.75)" });
            }
          }

          // aura chip
          if (this.auraDps) {
            for (const e of game.enemies) {
              if (e.hp <= 0) continue;
              if (dist2(this.x, this.y, e.x, e.y) <= (this.range * 0.65) * (this.range * 0.65)) {
                e.takeHit(game, this.auraDps * dt, DAMAGE.ENGY, this.typeKey);
              }
            }
          }

          // main beam visual
          game.beams.push({ ax: this.x, ay: this.y, bx: target.x, by: target.y, t: 0.09, col: "rgba(98,242,255,0.85)" });
          game.particles.spawn(this.x + Math.cos(this.aimAng) * 14, this.y + Math.sin(this.aimAng) * 14, 1, "muzzle");
          break;
        }

        case "MORTAR": {
          game.audio.playLimited("turret_mortar", 240);
          // lob projectile; on impact do AoE. We'll simulate travel as projectile that explodes on near target.
          const ang = this.aimAng;
          const spd = this.projSpd * (lowGravity ? 1.15 : 1);
          const vx = Math.cos(ang) * spd;
          const vy = Math.sin(ang) * spd;

          const mx = this.x + Math.cos(ang) * 14;
          const my = this.y + Math.sin(ang) * 14;

          const p = new Projectile(mx, my, vx, vy, 4.0, dmgBase, DAMAGE.PHYS, 999, 1.6, "mortar");
          p._isMortar = true;
          p._blast = this.blast;
          p._linger = !!this.lingering;
          p._lingerDur = this._lingerDur || 2.2;
          p._cluster = !!this.cluster;
          p._blastSlow = this.blastSlow || null;
          p.owner = this;
          p.vsFlying = this.vsFlying || 1;
          game.projectiles.push(p);
          game.particles.spawn(mx, my, 3, "muzzle");
          break;
        }
        default:
          break;
      }
    }
  }

  draw(gfx, selected = false, game = null) {
    const t = performance.now() * 0.001;
    const colMap = {
      PULSE: "rgba(98,242,255,0.9)",
      ARC: "rgba(154,108,255,0.9)",
      FROST: "rgba(160,190,255,0.9)",
      LENS: "rgba(98,242,255,0.9)",
      MORTAR: "rgba(255,207,91,0.9)",
      VENOM: "rgba(109,255,154,0.9)",
      NEEDLE: "rgba(154,108,255,0.9)",
      AURA: "rgba(98,242,255,0.8)",
      DRONE: "rgba(98,242,255,0.9)",
      TRAP: "rgba(255,207,91,0.9)"
    };
    const baseCol = colMap[this.typeKey] || "rgba(234,240,255,0.9)";
    const col = this.boosted ? "rgba(255,207,91,0.95)" : baseCol;

    if (game && game.globalOverchargeT > 0) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 4 + this.x * 0.02 + this.y * 0.02);
      gfx.save();
      const g = gfx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 64 + pulse * 12);
      g.addColorStop(0, "rgba(255,207,91,0.65)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      gfx.globalAlpha = 0.85 * pulse;
      gfx.fillStyle = g;
      gfx.beginPath(); gfx.arc(this.x, this.y, 64 + pulse * 12, 0, Math.PI * 2); gfx.fill();
      gfx.strokeStyle = "rgba(255,207,91,0.85)";
      gfx.lineWidth = 2;
      gfx.beginPath(); gfx.arc(this.x, this.y, 40 + pulse * 6, 0, Math.PI * 2); gfx.stroke();
      gfx.restore();
    }

    if (this.pulseBoostT > 0) {
      const p2 = 0.6 + 0.4 * Math.sin(t * 5 + this.x * 0.03 + this.y * 0.03);
      gfx.save();
      const g2 = gfx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 52 + p2 * 10);
      g2.addColorStop(0, "rgba(154,108,255,0.6)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      gfx.globalAlpha = 0.75 * p2;
      gfx.fillStyle = g2;
      gfx.beginPath(); gfx.arc(this.x, this.y, 52 + p2 * 10, 0, Math.PI * 2); gfx.fill();
      gfx.strokeStyle = "rgba(154,108,255,0.85)";
      gfx.lineWidth = 1.5;
      gfx.beginPath(); gfx.arc(this.x, this.y, 32 + p2 * 5, 0, Math.PI * 2); gfx.stroke();
      gfx.restore();
    }

    if (selected) {
      gfx.save();
      gfx.globalAlpha = 0.18;
      gfx.strokeStyle = "rgba(98,242,255,0.8)";
      gfx.lineWidth = 1.5;
      gfx.beginPath();
      gfx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
      gfx.stroke();
      gfx.restore();
    }

    // glow
    if (this.visual.glow) {
      gfx.save();
      const g = gfx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 38);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      gfx.globalAlpha = 0.45;
      gfx.fillStyle = g;
      gfx.beginPath(); gfx.arc(this.x, this.y, 38, 0, Math.PI * 2); gfx.fill();
      gfx.restore();
    }

    // base body (unique per turret)
    gfx.save();
    const recoil = this.recoil * 3.0;
    const rx = Math.cos(this.aimAng) * -recoil;
    const ry = Math.sin(this.aimAng) * -recoil;
    gfx.translate(this.x + rx, this.y + ry);
    gfx.rotate(this.aimAng);
    gfx.fillStyle = "rgba(7,10,18,0.75)";
    gfx.strokeStyle = col;
    gfx.lineWidth = 2;
    gfx.beginPath();
    switch (this.typeKey) {
      case "PULSE": {
        gfx.arc(0, 0, 12, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        gfx.beginPath();
        gfx.arc(0, 0, 6, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
      case "ARC": {
        gfx.moveTo(0, -12);
        gfx.lineTo(10, 0);
        gfx.lineTo(0, 12);
        gfx.lineTo(-10, 0);
        gfx.closePath();
        gfx.fill();
        gfx.stroke();
        break;
      }
      case "FROST": {
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI * 2 * i) / 6;
          const r = 12;
          if (i === 0) gfx.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
          else gfx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        gfx.closePath();
        gfx.fill();
        gfx.stroke();
        break;
      }
      case "LENS": {
        gfx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        gfx.beginPath();
        gfx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        gfx.stroke();
        break;
      }
      case "MORTAR": {
        gfx.rect(-10, -10, 20, 20);
        gfx.fill();
        gfx.stroke();
        break;
      }
      case "VENOM": {
        gfx.moveTo(0, -12);
        gfx.bezierCurveTo(9, -10, 12, -2, 0, 12);
        gfx.bezierCurveTo(-12, -2, -9, -10, 0, -12);
        gfx.fill();
        gfx.stroke();
        break;
      }
      case "NEEDLE": {
        gfx.moveTo(12, 0);
        gfx.lineTo(-10, 6);
        gfx.lineTo(-10, -6);
        gfx.closePath();
        gfx.fill();
        gfx.stroke();
        break;
      }
      case "AURA": {
        gfx.arc(0, 0, 10, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        gfx.beginPath();
        gfx.moveTo(0, -14);
        gfx.lineTo(3, -6);
        gfx.lineTo(-3, -6);
        gfx.closePath();
        gfx.stroke();
        break;
      }
      case "DRONE": {
        gfx.arc(0, 0, 10, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        gfx.beginPath();
        gfx.moveTo(-12, 0);
        gfx.lineTo(12, 0);
        gfx.moveTo(0, -12);
        gfx.lineTo(0, 12);
        gfx.stroke();
        break;
      }
      case "TRAP": {
        gfx.rect(-12, -8, 24, 16);
        gfx.fill();
        gfx.stroke();
        gfx.beginPath();
        gfx.moveTo(-8, 0);
        gfx.lineTo(8, 0);
        gfx.stroke();
        break;
      }
      default: {
        gfx.arc(0, 0, 12, 0, Math.PI * 2);
        gfx.fill();
        gfx.stroke();
        break;
      }
    }

    // barrels (upgrade visual)
    for (let i = 0; i < this.visual.barrels + 1; i++) {
      const off = (i - this.visual.barrels / 2) * 4;
      gfx.fillStyle = col;
      gfx.globalAlpha = 0.7;
      gfx.fillRect(10, -2 + off, 8, 4);
    }
    gfx.globalAlpha = 1;

    // spikes (upgrade visual)
    if (this.visual.spikes) {
      gfx.strokeStyle = col;
      gfx.lineWidth = 2;
      gfx.beginPath();
      gfx.moveTo(-10, -10);
      gfx.lineTo(-16, -16);
      gfx.moveTo(-10, 10);
      gfx.lineTo(-16, 16);
      gfx.stroke();
    }

    // antenna (upgrade visual)
    if (this.visual.antenna) {
      gfx.strokeStyle = col;
      gfx.lineWidth = 2;
      gfx.beginPath();
      gfx.moveTo(0, -12);
      gfx.lineTo(0, -20);
      gfx.stroke();
    }

    // rings (upgrade visual)
    for (let r = 0; r < this.visual.rings; r++) {
      gfx.globalAlpha = 0.5;
      gfx.strokeStyle = col;
      gfx.lineWidth = 1.5;
      gfx.beginPath();
      gfx.arc(0, 0, 14 + r * 5 + Math.sin(t * 2 + r) * 0.6, 0, Math.PI * 2);
      gfx.stroke();
    }

    gfx.restore();

    // drones
    if (this.typeKey === "DRONE") {
      gfx.save();
      gfx.fillStyle = col;
      for (const d of this.drones) {
        const ox = Math.cos(d.ang) * (26 + d.r);
        const oy = Math.sin(d.ang) * (16 + d.r * 0.7);
        gfx.globalAlpha = 0.9;
        gfx.beginPath();
        gfx.arc(this.x + ox, this.y + oy, 3.0, 0, Math.PI * 2);
        gfx.fill();
      }
      gfx.restore();
    }
  }
}

