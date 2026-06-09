import { COMBAT_EVENT_TYPES, hasCombatTag } from "./combatEvents.js?v=202606071855";
import { STATUS, enemyHasStatus } from "./statusEffects.js?v=202606071855";

const clampNum = (value, min, max) => Math.max(min, Math.min(max, value));
const SYNERGY_BALANCE = Object.freeze({
  shatter: { cooldown: 0.56, radius: 62, damageMul: 0.12, minDamage: 3, maxDamage: 10, maxChains: 2 },
  bloom: { cooldown: 0.86, radius: 68, dotMul: 0.048, minDps: 2.25, maxDps: 7, duration: 1.25, maxSeeds: 2 },
  empFeedback: { cooldown: 0.9, radius: 74, damageMul: 0.105, minDamage: 3, maxDamage: 9, shieldBonus: 1.28, hpBonus: 0.50, maxArcs: 2 },
  precisionBreak: { cooldown: 0.65, damageMul: 0.105, minDamage: 3, maxDamage: 16 },
  swarmLink: { cooldown: 0.95, auraRadiusPad: 0, damageMul: 0.08, minDamage: 2, maxDamage: 7 },
  causticRay: { cooldown: 0.85, dotMul: 0.038, minDps: 2, maxDps: 5.8, duration: 1.15, radius: 54, maxSeeds: 2 },
  seismicSnare: { cooldown: 1.15, radius: 76, damageMul: 0.075, minDamage: 3, maxDamage: 9, slowPct: 0.16, slowDur: 0.82, maxTargets: 3 },
  overchargeRupture: { cooldown: 1.2, damageMul: 0.08, minDamage: 4, maxDamage: 16, bossMaxDamage: 26 }
});

export const SYNERGY_CANDIDATES = Object.freeze([
  {
    id: "frost_arc_shatter",
    name: "Shatter Circuit",
    requires: [STATUS.SLOW, "energy-hit"],
    desc: "Chilled enemies struck by energy can release a short electric burst."
  },
  {
    id: "venom_mortar_bloom",
    name: "Chemical Bloom",
    requires: [STATUS.DOT, "explosive-hit"],
    desc: "Poisoned enemies hit by explosives can seed a short burn field."
  },
  {
    id: "emp_energy_feedback",
    name: "EMP Feedback",
    requires: [STATUS.EMP, "energy-hit"],
    desc: "EMP-locked shield enemies can arc damage into nearby shields."
  },
  {
    id: "mark_precision_break",
    name: "Precision Break",
    requires: [STATUS.MARK, "physical-hit"],
    desc: "Marked targets can grant precision towers armor pressure."
  },
  {
    id: "aura_drone_swarm_link",
    name: "Swarm Link",
    requires: ["DRONE", "AURA"],
    desc: "Drone hits inside Aura Grove support range call a small linked pulse."
  },
  {
    id: "lens_venom_caustic_ray",
    name: "Caustic Ray",
    requires: [STATUS.DOT, "LENS"],
    desc: "Lens beams striking poisoned targets refract a short chemical flare."
  },
  {
    id: "trap_mortar_seismic_snare",
    name: "Seismic Snare",
    requires: ["TRAP", "MORTAR"],
    desc: "Mortar blasts near gravity traps send a brief slowing shock through nearby enemies."
  },
  {
    id: "overcharge_rupture",
    name: "Overcharge Rupture",
    requires: ["Overcharge", "Elite/Boss"],
    desc: "Overcharged turrets periodically rupture elite and boss armor with gold energy."
  }
]);

export class SynergyRegistry {
  constructor(rules = []) {
    this.rules = [...rules];
    this.eventsSeen = 0;
    this.triggerCounts = {};
  }

  register(rule) {
    if (!rule?.id) return;
    const idx = this.rules.findIndex(item => item.id === rule.id);
    if (idx >= 0) this.rules[idx] = rule;
    else this.rules.push(rule);
  }

  process(game, event) {
    this.eventsSeen += 1;
    if (!event || !this.rules.length) return [];
    const triggered = [];
    for (const rule of this.rules) {
      if (rule.enabled === false) continue;
      if (typeof rule.when === "function" && !rule.when(game, event, hasCombatTag)) continue;
      if (typeof rule.effect !== "function") continue;
      const result = rule.effect(game, event);
      if (result) triggered.push(rule.id);
    }
    if (triggered.length) {
      event.synergies = [...(event.synergies || []), ...triggered];
      for (const id of triggered) {
        this.triggerCounts[id] = (this.triggerCounts[id] || 0) + 1;
      }
    }
    return triggered;
  }
}

export function createDefaultSynergyRegistry() {
  return new SynergyRegistry([
    {
      id: "telemetry_damage_events",
      enabled: true,
      when: (game, event) => event.type === COMBAT_EVENT_TYPES.DAMAGE && event.dealt > 0,
      effect: (game, event) => {
        game.lastDamageEvent = event;
        return false;
      }
    },
    {
      id: "frost_arc_shatter",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (event.sourceKey !== "ARC" || !hasCombatTag(event, "energy-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!enemyHasStatus(target, STATUS.SLOW)) return false;
        const now = performance.now() * 0.001;
        return !target._shatterCircuitAt || now - target._shatterCircuitAt > SYNERGY_BALANCE.shatter.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        if (!target || !game?.enemies) return false;
        const now = performance.now() * 0.001;
        target._shatterCircuitAt = now;
        const cfg = SYNERGY_BALANCE.shatter;
        const radius = cfg.radius;
        const pulseDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul, cfg.minDamage, cfg.maxDamage);
        let chained = 0;
        for (const enemy of game.enemies) {
          if (!enemy || enemy === target || enemy._dead || enemy.hp <= 0) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (dx * dx + dy * dy > radius * radius) continue;
          enemy.takeHit(game, pulseDamage, event.damageType, "SYNERGY_SHATTER", source);
          game.arcs?.push?.({
            ax: target.x,
            ay: target.y,
            bx: enemy.x,
            by: enemy.y,
            t: 0.18,
            col: "rgba(165,235,255,0.82)"
          });
          chained += 1;
          if (chained >= cfg.maxChains) break;
        }
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 8,
          t: 0.22,
          dur: 0.22,
          max: chained > 0 ? 56 : 34,
          col: "rgba(165,235,255,0.8)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, chained > 0 ? 10 : 5, "shard", "rgba(165,235,255,0.9)");
        if (chained > 0 && (!game._lastShatterTextAt || now - game._lastShatterTextAt > 0.55)) {
          game._lastShatterTextAt = now;
          game.spawnText?.(target.x, target.y - 22, `SHATTER x${chained}`, "rgba(165,235,255,0.95)", 0.95);
        }
        game.audio?.playLimited?.("synergy_shatter", 260);
        return true;
      }
    },
    {
      id: "venom_mortar_bloom",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (event.sourceKey !== "MORTAR" || !hasCombatTag(event, "explosive-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!enemyHasStatus(target, STATUS.DOT)) return false;
        const now = performance.now() * 0.001;
        return !target._chemicalBloomAt || now - target._chemicalBloomAt > SYNERGY_BALANCE.bloom.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        if (!target || !game?.enemies) return false;
        const now = performance.now() * 0.001;
        target._chemicalBloomAt = now;
        const cfg = SYNERGY_BALANCE.bloom;
        const radius = cfg.radius;
        const dotDps = clampNum((Number(event.dealt) || 0) * cfg.dotMul, cfg.minDps, cfg.maxDps);
        const dotDur = cfg.duration;
        let seeded = 0;
        for (const enemy of game.enemies) {
          if (!enemy || enemy === target || enemy._dead || enemy.hp <= 0) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (dx * dx + dy * dy > radius * radius) continue;
          enemy.applyDot?.(dotDps, dotDur);
          seeded += 1;
          if (seeded >= cfg.maxSeeds) break;
        }
        game.lingering?.push?.({
          x: target.x,
          y: target.y,
          r: 34,
          t: 0.9,
          dur: 0.9,
          col: "rgba(109,255,154,0.2)"
        });
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 10,
          t: 0.28,
          dur: 0.28,
          max: seeded > 0 ? 72 : 42,
          col: "rgba(109,255,154,0.76)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, seeded > 0 ? 12 : 6, "chem", "rgba(109,255,154,0.9)");
        if (seeded > 0 && (!game._lastChemicalBloomTextAt || now - game._lastChemicalBloomTextAt > 0.75)) {
          game._lastChemicalBloomTextAt = now;
          game.spawnText?.(target.x, target.y - 24, `BLOOM x${seeded}`, "rgba(109,255,154,0.96)", 0.95);
        }
        game.audio?.playLimited?.("synergy_bloom", 360);
        return true;
      }
    },
    {
      id: "emp_energy_feedback",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (!["ARC", "FROST", "LENS"].includes(event.sourceKey)) return false;
        if (!hasCombatTag(event, "energy-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!enemyHasStatus(target, STATUS.EMP)) return false;
        const now = performance.now() * 0.001;
        return !target._empFeedbackAt || now - target._empFeedbackAt > SYNERGY_BALANCE.empFeedback.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        if (!target || !game?.enemies) return false;
        const now = performance.now() * 0.001;
        target._empFeedbackAt = now;
        const cfg = SYNERGY_BALANCE.empFeedback;
        const radius = cfg.radius;
        const pulseDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul, cfg.minDamage, cfg.maxDamage);
        let arcs = 0;
        for (const enemy of game.enemies) {
          if (!enemy || enemy === target || enemy._dead || enemy.hp <= 0) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (dx * dx + dy * dy > radius * radius) continue;
          const shieldBonus = enemy.shield > 0 ? cfg.shieldBonus : cfg.hpBonus;
          enemy.takeHit(game, pulseDamage * shieldBonus, event.damageType, "SYNERGY_EMP_FEEDBACK", source);
          enemy.empT = Math.max(Number(enemy.empT) || 0, 0.55);
          game.arcs?.push?.({
            ax: target.x,
            ay: target.y,
            bx: enemy.x,
            by: enemy.y,
            t: 0.2,
            col: "rgba(210,252,255,0.88)"
          });
          arcs += 1;
          if (arcs >= cfg.maxArcs) break;
        }
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 9,
          t: 0.24,
          dur: 0.24,
          max: arcs > 0 ? 66 : 38,
          col: "rgba(210,252,255,0.82)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, arcs > 0 ? 12 : 6, "muzzle", "rgba(210,252,255,0.92)");
        if (arcs > 0 && (!game._lastEmpFeedbackTextAt || now - game._lastEmpFeedbackTextAt > 0.7)) {
          game._lastEmpFeedbackTextAt = now;
          game.spawnText?.(target.x, target.y - 24, `FEEDBACK x${arcs}`, "rgba(210,252,255,0.98)", 0.95);
        }
        game.audio?.playLimited?.("synergy_emp_feedback", 320);
        return true;
      }
    },
    {
      id: "mark_precision_break",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (!["PULSE", "NEEDLE"].includes(event.sourceKey)) return false;
        if (!hasCombatTag(event, "physical-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!enemyHasStatus(target, STATUS.MARK)) return false;
        const now = performance.now() * 0.001;
        return !target._precisionBreakAt || now - target._precisionBreakAt > SYNERGY_BALANCE.precisionBreak.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        if (!target) return false;
        const now = performance.now() * 0.001;
        target._precisionBreakAt = now;
        const cfg = SYNERGY_BALANCE.precisionBreak;
        const armorFactor = 1 + clampNum(Number(target.armor) || 0, 0, 0.85);
        const breakDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul * armorFactor, cfg.minDamage, cfg.maxDamage);
        target.takeHit?.(game, breakDamage, "True", "SYNERGY_PRECISION_BREAK", source);
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 7,
          t: 0.18,
          dur: 0.18,
          max: 32,
          col: "rgba(255,207,91,0.82)",
          boom: false
        });
        game.particles?.spawnDirectional?.(
          target.x,
          target.y,
          8,
          -Math.cos(target.ang || 0),
          -Math.sin(target.ang || 0),
          "shard",
          "rgba(255,207,91,0.92)"
        );
        if (!game._lastPrecisionBreakTextAt || now - game._lastPrecisionBreakTextAt > 0.62) {
          game._lastPrecisionBreakTextAt = now;
          game.spawnText?.(target.x, target.y - 24, "PRECISION BREAK", "rgba(255,207,91,0.98)", 0.92);
        }
        game.audio?.playLimited?.("synergy_precision_break", 240);
        return true;
      }
    },
    {
      id: "aura_drone_swarm_link",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (event.sourceKey !== "DRONE") return false;
        const source = event.source;
        const target = event.target;
        if (!source || !target || target._dead || target.hp <= 0) return false;
        const cfg = SYNERGY_BALANCE.swarmLink;
        const aura = game.turrets?.find?.(turret => {
          if (!turret || turret.typeKey !== "AURA") return false;
          const dx = turret.x - source.x;
          const dy = turret.y - source.y;
          const range = (Number(turret.range) || 0) + cfg.auraRadiusPad;
          return dx * dx + dy * dy <= range * range;
        });
        if (!aura) return false;
        const now = performance.now() * 0.001;
        return !target._swarmLinkAt || now - target._swarmLinkAt > cfg.cooldown;
      },
      effect: (game, event) => {
        const source = event.source;
        const target = event.target;
        const cfg = SYNERGY_BALANCE.swarmLink;
        if (!source || !target) return false;
        const now = performance.now() * 0.001;
        target._swarmLinkAt = now;
        const aura = game.turrets?.find?.(turret => {
          if (!turret || turret.typeKey !== "AURA") return false;
          const dx = turret.x - source.x;
          const dy = turret.y - source.y;
          return dx * dx + dy * dy <= turret.range * turret.range;
        });
        const pulseDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul, cfg.minDamage, cfg.maxDamage);
        target.takeHit?.(game, pulseDamage, event.damageType, "SYNERGY_SWARM_LINK", source);
        if (aura) {
          game.beams?.push?.({ ax: aura.x, ay: aura.y, bx: source.x, by: source.y, t: 0.2, col: "rgba(98,242,255,0.74)" });
          game.beams?.push?.({ ax: source.x, ay: source.y, bx: target.x, by: target.y, t: 0.18, col: "rgba(109,255,154,0.66)" });
        }
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 6,
          t: 0.2,
          dur: 0.2,
          max: 30,
          col: "rgba(98,242,255,0.72)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, 7, "muzzle", "rgba(98,242,255,0.88)");
        if (!game._lastSwarmLinkTextAt || now - game._lastSwarmLinkTextAt > 0.75) {
          game._lastSwarmLinkTextAt = now;
          game.spawnText?.(target.x, target.y - 22, "SWARM LINK", "rgba(98,242,255,0.94)", 0.9);
        }
        game.audio?.playLimited?.("synergy_swarm_link", 300);
        return true;
      }
    },
    {
      id: "lens_venom_caustic_ray",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (event.sourceKey !== "LENS" || !hasCombatTag(event, "energy-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!enemyHasStatus(target, STATUS.DOT)) return false;
        const now = performance.now() * 0.001;
        return !target._causticRayAt || now - target._causticRayAt > SYNERGY_BALANCE.causticRay.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        const cfg = SYNERGY_BALANCE.causticRay;
        if (!target || !game?.enemies) return false;
        const now = performance.now() * 0.001;
        target._causticRayAt = now;
        const dotDps = clampNum((Number(event.dealt) || 0) * cfg.dotMul, cfg.minDps, cfg.maxDps);
        target.applyDot?.(dotDps, cfg.duration);
        let seeded = 0;
        for (const enemy of game.enemies) {
          if (!enemy || enemy === target || enemy._dead || enemy.hp <= 0) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (dx * dx + dy * dy > cfg.radius * cfg.radius) continue;
          enemy.applyDot?.(dotDps * 0.65, cfg.duration * 0.8);
          game.beams?.push?.({ ax: target.x, ay: target.y, bx: enemy.x, by: enemy.y, t: 0.12, col: "rgba(109,255,154,0.68)" });
          seeded += 1;
          if (seeded >= cfg.maxSeeds) break;
        }
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 7,
          t: 0.22,
          dur: 0.22,
          max: seeded > 0 ? 48 : 30,
          col: "rgba(109,255,154,0.72)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, 8, "chem", "rgba(109,255,154,0.9)");
        if (!game._lastCausticRayTextAt || now - game._lastCausticRayTextAt > 0.78) {
          game._lastCausticRayTextAt = now;
          game.spawnText?.(target.x, target.y - 23, "CAUSTIC RAY", "rgba(109,255,154,0.95)", 0.92);
        }
        game.audio?.playLimited?.("synergy_caustic_ray", 330);
        return true;
      }
    },
    {
      id: "trap_mortar_seismic_snare",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (event.sourceKey !== "MORTAR" || !hasCombatTag(event, "explosive-hit")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        const nearTrap = game.traps?.some?.(trap => {
          const dx = trap.x - target.x;
          const dy = trap.y - target.y;
          const range = (Number(trap.r) || 0) + 72;
          return dx * dx + dy * dy <= range * range;
        });
        if (!nearTrap) return false;
        const now = performance.now() * 0.001;
        return !target._seismicSnareAt || now - target._seismicSnareAt > SYNERGY_BALANCE.seismicSnare.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        const cfg = SYNERGY_BALANCE.seismicSnare;
        if (!target || !game?.enemies) return false;
        const now = performance.now() * 0.001;
        target._seismicSnareAt = now;
        const pulseDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul, cfg.minDamage, cfg.maxDamage);
        let hit = 0;
        for (const enemy of game.enemies) {
          if (!enemy || enemy._dead || enemy.hp <= 0) continue;
          const dx = enemy.x - target.x;
          const dy = enemy.y - target.y;
          if (dx * dx + dy * dy > cfg.radius * cfg.radius) continue;
          enemy.takeHit?.(game, pulseDamage, event.damageType, "SYNERGY_SEISMIC_SNARE", source);
          enemy.applySlow?.(cfg.slowPct, cfg.slowDur);
          hit += 1;
          if (hit >= cfg.maxTargets) break;
        }
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 12,
          t: 0.34,
          dur: 0.34,
          max: 82,
          col: "rgba(255,207,91,0.72)",
          boom: false
        });
        game.particles?.spawn?.(target.x, target.y, 11, "boom", "rgba(255,207,91,0.86)");
        if (!game._lastSeismicSnareTextAt || now - game._lastSeismicSnareTextAt > 0.85) {
          game._lastSeismicSnareTextAt = now;
          game.spawnText?.(target.x, target.y - 24, `SEISMIC x${hit}`, "rgba(255,207,91,0.96)", 0.95);
        }
        game.audio?.playLimited?.("synergy_seismic_snare", 420);
        return true;
      }
    },
    {
      id: "overcharge_rupture",
      enabled: true,
      when: (game, event) => {
        if (event.type !== COMBAT_EVENT_TYPES.DAMAGE || event.dealt <= 0) return false;
        if (!game || !(Number(game.globalOverchargeT) > 0)) return false;
        if (!event.sourceKey || String(event.sourceKey).startsWith("SYNERGY_")) return false;
        const target = event.target;
        if (!target || target._dead || target.hp <= 0) return false;
        if (!target.isBoss && !target.isFinalBoss && !target.elite) return false;
        const now = performance.now() * 0.001;
        return !target._overchargeRuptureAt || now - target._overchargeRuptureAt > SYNERGY_BALANCE.overchargeRupture.cooldown;
      },
      effect: (game, event) => {
        const target = event.target;
        const source = event.source || target?._lastHitBy || null;
        const cfg = SYNERGY_BALANCE.overchargeRupture;
        if (!target) return false;
        const now = performance.now() * 0.001;
        target._overchargeRuptureAt = now;
        const maxDamage = target.isBoss || target.isFinalBoss ? cfg.bossMaxDamage : cfg.maxDamage;
        const ruptureDamage = clampNum((Number(event.dealt) || 0) * cfg.damageMul, cfg.minDamage, maxDamage);
        target.takeHit?.(game, ruptureDamage, "True", "SYNERGY_OVERCHARGE_RUPTURE", source);
        game.explosions?.push?.({
          x: target.x,
          y: target.y,
          r: 10,
          t: 0.28,
          dur: 0.28,
          max: target.isBoss || target.isFinalBoss ? 70 : 44,
          col: "rgba(255,207,91,0.86)",
          boom: false
        });
        game.particles?.spawnDirectional?.(
          target.x,
          target.y,
          12,
          -Math.cos(target.ang || 0),
          -Math.sin(target.ang || 0),
          "shard",
          "rgba(255,207,91,0.96)"
        );
        if (!game._lastOverchargeRuptureTextAt || now - game._lastOverchargeRuptureTextAt > 0.9) {
          game._lastOverchargeRuptureTextAt = now;
          game.spawnText?.(target.x, target.y - 28, "RUPTURE", "rgba(255,207,91,0.98)", 1.0);
        }
        game.audio?.playLimited?.("synergy_overcharge_rupture", 420);
        return true;
      }
    }
  ]);
}
