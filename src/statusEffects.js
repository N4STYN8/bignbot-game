export const STATUS = Object.freeze({
  SLOW: "slow",
  DOT: "dot",
  REVEAL: "reveal",
  MARK: "mark",
  EMP: "emp",
  NO_SPLIT: "noSplit",
  TURRET_JAM: "turretJam",
  TURRET_SLOW: "turretSlow",
  PULSE_BOOST: "pulseBoost",
  OVERCHARGE: "overcharge"
});

export const STATUS_DEFS = Object.freeze({
  [STATUS.SLOW]: { label: "Slowed", stacking: "maxStrengthMaxDuration", family: "control" },
  [STATUS.DOT]: { label: "Burn", stacking: "maxDpsMaxDuration", family: "damage" },
  [STATUS.REVEAL]: { label: "Revealed", stacking: "maxDuration", family: "utility" },
  [STATUS.MARK]: { label: "Marked", stacking: "maxStrengthMaxDuration", family: "vulnerability" },
  [STATUS.EMP]: { label: "EMP", stacking: "maxDuration", family: "ability" },
  [STATUS.NO_SPLIT]: { label: "Split Locked", stacking: "maxDuration", family: "utility" },
  [STATUS.TURRET_JAM]: { label: "Jammed", stacking: "maxDuration", family: "turretDisruption" },
  [STATUS.TURRET_SLOW]: { label: "Slowed Fire", stacking: "maxDuration", family: "turretDisruption" },
  [STATUS.PULSE_BOOST]: { label: "Pulse Burst", stacking: "maxDuration", family: "ability" },
  [STATUS.OVERCHARGE]: { label: "Overcharge", stacking: "maxDuration", family: "ability" }
});

export function ensureStatusBag(entity) {
  if (!entity) return {};
  if (!entity.statuses || typeof entity.statuses !== "object") entity.statuses = {};
  return entity.statuses;
}

export function setStatusState(entity, key, state = {}) {
  if (!entity || !key) return null;
  const bag = ensureStatusBag(entity);
  const current = bag[key] || {};
  const duration = Math.max(Number(current.duration) || 0, Number(state.duration) || 0);
  const strength = Math.max(Number(current.strength) || 0, Number(state.strength) || 0);
  const next = {
    ...current,
    ...state,
    key,
    label: STATUS_DEFS[key]?.label || key,
    family: STATUS_DEFS[key]?.family || "custom",
    duration,
    strength
  };
  bag[key] = next;
  return next;
}

export function clearStatusState(entity, key) {
  if (!entity?.statuses || !key) return;
  delete entity.statuses[key];
}

export function syncEnemyLegacyStatuses(enemy) {
  if (!enemy) return;
  const bag = ensureStatusBag(enemy);
  if (enemy.slowT > 0) {
    bag[STATUS.SLOW] = {
      key: STATUS.SLOW,
      label: STATUS_DEFS[STATUS.SLOW].label,
      family: STATUS_DEFS[STATUS.SLOW].family,
      strength: enemy.slow || 0,
      duration: enemy.slowT
    };
  } else {
    delete bag[STATUS.SLOW];
  }
  if (enemy.dotT > 0) {
    bag[STATUS.DOT] = {
      key: STATUS.DOT,
      label: STATUS_DEFS[STATUS.DOT].label,
      family: STATUS_DEFS[STATUS.DOT].family,
      dps: enemy.dot || 0,
      duration: enemy.dotT
    };
  } else {
    delete bag[STATUS.DOT];
  }
  if (enemy.revealT > 0 || enemy._revealLock) {
    bag[STATUS.REVEAL] = {
      key: STATUS.REVEAL,
      label: STATUS_DEFS[STATUS.REVEAL].label,
      family: STATUS_DEFS[STATUS.REVEAL].family,
      duration: enemy._revealLock ? Infinity : enemy.revealT
    };
  } else {
    delete bag[STATUS.REVEAL];
  }
  if (enemy._markedT > 0) {
    bag[STATUS.MARK] = {
      key: STATUS.MARK,
      label: STATUS_DEFS[STATUS.MARK].label,
      family: STATUS_DEFS[STATUS.MARK].family,
      strength: enemy._marked || 0,
      duration: enemy._markedT
    };
  } else {
    delete bag[STATUS.MARK];
  }
  if (enemy.empT > 0) {
    bag[STATUS.EMP] = {
      key: STATUS.EMP,
      label: STATUS_DEFS[STATUS.EMP].label,
      family: STATUS_DEFS[STATUS.EMP].family,
      duration: enemy.empT
    };
  } else {
    delete bag[STATUS.EMP];
  }
  if (enemy._noSplitT > 0 || enemy._noSplit) {
    bag[STATUS.NO_SPLIT] = {
      key: STATUS.NO_SPLIT,
      label: STATUS_DEFS[STATUS.NO_SPLIT].label,
      family: STATUS_DEFS[STATUS.NO_SPLIT].family,
      duration: enemy._noSplitT || Infinity
    };
  } else {
    delete bag[STATUS.NO_SPLIT];
  }
}

export function enemyHasStatus(enemy, key) {
  syncEnemyLegacyStatuses(enemy);
  return !!enemy?.statuses?.[key];
}
