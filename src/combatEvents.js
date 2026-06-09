export const COMBAT_EVENT_TYPES = Object.freeze({
  TOWER_FIRE: "tower:fire",
  PROJECTILE_HIT: "projectile:hit",
  DAMAGE: "damage",
  STATUS_APPLY: "status:apply",
  ENEMY_DEATH: "enemy:death"
});

const MAX_EVENT_LOG = 120;

export function normalizeTags(tags = []) {
  if (tags instanceof Set) return new Set(tags);
  if (!Array.isArray(tags)) return new Set();
  return new Set(tags.filter(Boolean).map(tag => String(tag)));
}

export function createCombatEvent(type, data = {}) {
  return {
    type,
    t: performance.now() * 0.001,
    ...data,
    tags: normalizeTags(data.tags)
  };
}

export function addCombatTag(event, tag) {
  if (!event || !tag) return event;
  if (!(event.tags instanceof Set)) event.tags = normalizeTags(event.tags);
  event.tags.add(String(tag));
  return event;
}

export function hasCombatTag(event, tag) {
  return !!event?.tags?.has?.(tag);
}

export function emitCombatEvent(game, event) {
  if (!game || !event) return event;
  event.id = ++game.combatEventSeq;
  if (!Array.isArray(game.combatEvents)) game.combatEvents = [];
  game.combatEvents.push(event);
  if (game.combatEvents.length > MAX_EVENT_LOG) {
    game.combatEvents.splice(0, game.combatEvents.length - MAX_EVENT_LOG);
  }
  game.synergies?.process?.(game, event);
  game.onCombatEvent?.(event);
  return event;
}
