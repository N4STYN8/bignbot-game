export const USE_TURRET_SPRITES = true;
export const USE_ENEMY_SPRITES = true;
export const ENEMY_SPRITE_ANGLE_OFFSET = Math.PI / 2;

export const SPRITE_ANGLE_OFFSET = Math.PI / 2;
export const TURRET_SPRITE_ANGLE_OVERRIDES = {
  AURA: -Math.PI / 2,
  TRAP: -Math.PI / 2,
};
export const DEFAULT_TURRET_SPRITE_SIZE = 64;
export const TURRET_SPRITE_SCALE_OVERRIDES = {
  MORTAR: 1.08,
  DRONE: 0.96,
  TRAP: 0.94,
};

export const TURRET_GLOW_TINTS = {
  PULSE: "rgba(98,242,255,1)",
  // CODEX CHANGE: Match Arc Coil selection effects to the new cyan reactor sprites.
  ARC: "rgba(98,242,255,1)",
  FROST: "rgba(176,214,255,1)",
  // CODEX CHANGE: Match Sun Lens selection effects to the new amber optical sprites.
  LENS: "rgba(255,166,42,1)",
  NEEDLE: "rgba(190,126,255,1)",
  VENOM: "rgba(109,255,154,1)",
  MORTAR: "rgba(255,184,92,1)",
  AURA: "rgba(171,156,255,1)",
  DRONE: "rgba(116,236,255,1)",
  TRAP: "rgba(180,120,255,1)",
};

const ENEMY_SPRITE_KEY_TO_PATHS = {
  runner: [
    "assets/images/enemies/runner/runner.png",
    "assets/images/enemies/runner.png",
  ],
  brute: [
    "assets/images/enemies/brute/brute.png",
    "assets/images/enemies/brute.png",
  ],
  armored: [
    "assets/images/enemies/armored/armored.png",
    "assets/images/enemies/armored.png",
  ],
  shielded: [
    "assets/images/enemies/shielded/shielded.png",
    "assets/images/enemies/shielded.png",
  ],
  splitter: [
    "assets/images/enemies/splitter/splitter.png",
    "assets/images/enemies/splitter.png",
  ],
  splitter_orb: [
    "assets/images/enemies/splitter_orb/splitter_orb.png",
    "assets/images/enemies/mini.png",
    "assets/images/enemies/split_splitter.png",
  ],
  mini: [
    "assets/images/enemies/mini/mini.png",
    "assets/images/enemies/mini.png",
  ],
  regen: [
    "assets/images/enemies/regen/regen.png",
    "assets/images/enemies/regen.png",
  ],
  stealth: [
    "assets/images/enemies/stealth/stealth.png",
    "assets/images/enemies/stealth.png",
  ],
  flying: [
    "assets/images/enemies/flying/flying.png",
    "assets/images/enemies/flying.png",
  ],
  phase: [
    "assets/images/enemies/phase/phase.png",
    "assets/images/enemies/phase.png",
  ],
  miniboss: [
    "assets/images/enemies/miniboss/miniboss.png",
    "assets/images/enemies/mini/mini.png",
    "assets/images/enemies/mini.png",
  ],
  finalboss_triangle: [
    "assets/images/enemies/finalboss_triangle/finalboss_triangle.png",
    "assets/images/enemies/finalboss1.png",
  ],
  finalboss_oval: [
    "assets/images/enemies/finalboss_oval/finalboss_oval.png",
    "assets/images/enemies/finalboss2.png",
  ],
  finalboss_fortress: [
    "assets/images/enemies/finalboss_fortress/finalboss_fortress.png",
    "assets/images/enemies/finalboss3.png",
  ],
};

const TURRET_SPRITE_DEFS = {
  // CODEX CHANGE: Match the required pulse_spindle_lv1-lv5 filenames used by the new play-area sprites.
  PULSE: { key: "pulse", aliases: ["pulse_spindle", "pulse"], folders: ["pulse", "pulse_spindle"] },
  // CODEX CHANGE: Resolve the new arc_coil_lv1-lv5 filenames before legacy Arc assets.
  ARC: { key: "arc", aliases: ["arc_coil", "arc"], folders: ["arc", "arc_coil"] },
  // CODEX CHANGE: Resolve the new frost_vent_lv1-lv5 filenames before legacy Frost assets.
  FROST: { key: "frost", aliases: ["frost_vent", "frost"], folders: ["frost", "frost_vent"] },
  // CODEX CHANGE: Resolve the new sun_lens_lv1-lv5 filenames before legacy Lens assets.
  LENS: { key: "lens", aliases: ["sun_lens", "lens", "sun"], folders: ["lens", "sun_lens"] },
  // CODEX CHANGE: Resolve the new venom_spitter_lv1-lv5 filenames before legacy Venom assets.
  VENOM: { key: "venom", aliases: ["venom_spitter", "venom"], folders: ["venom", "venom_spitter"] },
  // CODEX CHANGE: Resolve the new mortar_bloom_lv1-lv5 filenames before legacy Mortar assets.
  MORTAR: { key: "mortar", aliases: ["mortar_bloom", "mortar"], folders: ["mortar", "mortar_bloom"] },
  // CODEX CHANGE: Resolve the new rail_needle_lv1-lv5 filenames before legacy Needle assets.
  NEEDLE: { key: "needle", aliases: ["rail_needle", "needle", "rail"], folders: ["needle", "rail_needle"] },
  // CODEX CHANGE: Resolve the new aura_grove_lv1-lv5 filenames before legacy Aura assets.
  AURA: { key: "aura", aliases: ["aura_grove", "aura"], folders: ["aura", "aura_grove"] },
  // CODEX CHANGE: Resolve the new drone_hive_lv1-lv5 filenames before legacy Drone assets.
  DRONE: { key: "drone", aliases: ["drone_hive", "drone"], folders: ["drone", "drone_hive"] },
  // CODEX CHANGE: Resolve the new gravity_trap_lv1-lv5 filenames before the legacy Gravity asset.
  TRAP: { key: "trap", aliases: ["gravity_trap", "trap", "gravity"], folders: ["trap", "gravity_trap"] },
};

const SPRITE_PATH_ROOTS = [
  "assets/turrets",
  "assets/images/turrets",
];

// CODEX CHANGE: Bust cached turret PNGs after completing the Gravity Trap set.
const TURRET_SPRITE_CACHE_VERSION = "202607192223";

const spriteCache = Object.create(null);

function createCandidateList(fileNames, folders) {
  const seen = new Set();
  const out = [];
  for (const root of SPRITE_PATH_ROOTS) {
    for (const name of fileNames) {
      const flat = `${root}/${name}?v=${TURRET_SPRITE_CACHE_VERSION}`;
      if (!seen.has(flat)) {
        seen.add(flat);
        out.push(flat);
      }
      for (const folder of folders) {
        const nested = `${root}/${folder}/${name}?v=${TURRET_SPRITE_CACHE_VERSION}`;
        if (!seen.has(nested)) {
          seen.add(nested);
          out.push(nested);
        }
      }
    }
  }
  return out;
}

function buildTierCandidates(def, tierSuffix) {
  const names = def.aliases.map(alias => `${alias}_${tierSuffix}.png`);
  return createCandidateList(names, def.folders);
}

function buildSpriteMap() {
  const map = {};
  for (const [typeKey, def] of Object.entries(TURRET_SPRITE_DEFS)) {
    // CODEX CHANGE: Support five named levels while retaining legacy u1-u3 asset compatibility.
    const base = buildTierCandidates(def, "base");
    const lv1 = [...buildTierCandidates(def, "lv1"), ...buildTierCandidates(def, "u1")];
    map[typeKey] = {
      // CODEX CHANGE: New five-level turret sets use their top-down level-one art before the first upgrade.
      base: typeKey === "PULSE" || typeKey === "ARC" || typeKey === "FROST" || typeKey === "LENS" || typeKey === "MORTAR" || typeKey === "VENOM" || typeKey === "NEEDLE" || typeKey === "AURA" || typeKey === "DRONE" || typeKey === "TRAP" ? [...lv1, ...base] : base,
      lv1,
      lv2: [...buildTierCandidates(def, "lv2"), ...buildTierCandidates(def, "u2")],
      lv3: [...buildTierCandidates(def, "lv3"), ...buildTierCandidates(def, "u3")],
      lv4: buildTierCandidates(def, "lv4"),
      lv5: buildTierCandidates(def, "lv5"),
    };
  }
  return map;
}

export const TURRET_SPRITE_FILES = buildSpriteMap();

function uniqueList(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export const ENEMY_SPRITE_FILES = Object.fromEntries(
  Object.entries(ENEMY_SPRITE_KEY_TO_PATHS).map(([k, paths]) => [k, uniqueList(paths)])
);

function requestSprite(path) {
  let rec = spriteCache[path];
  if (!rec) {
    rec = { state: "idle", img: null };
    spriteCache[path] = rec;
  }
  if (rec.state !== "idle") return rec;

  const img = new Image();
  rec.state = "loading";
  rec.img = img;
  img.onload = () => {
    rec.state = "loaded";
  };
  img.onerror = () => {
    rec.state = "error";
  };
  img.src = path;
  return rec;
}

function requestCandidates(candidates) {
  for (const path of candidates) requestSprite(path);
}

function getLoadedCandidate(candidates) {
  for (const path of candidates) {
    const rec = spriteCache[path];
    if (rec && rec.state === "loaded" && rec.img) return rec.img;
  }
  return null;
}

function tierKeyForLevel(level) {
  // CODEX CHANGE: Match runtime upgrade levels 1-5 to their dedicated sprite tiers.
  if (level <= 0) return "base";
  return `lv${Math.min(5, Math.floor(level))}`;
}

// CODEX CHANGE: Fall back through earlier upgrade art so partial turret sets remain compatible.
const TIER_FALLBACKS = {
  base: ["base"],
  lv1: ["lv1", "base"],
  lv2: ["lv2", "lv1", "base"],
  lv3: ["lv3", "lv2", "lv1", "base"],
  lv4: ["lv4", "lv3", "lv2", "lv1", "base"],
  lv5: ["lv5", "lv4", "lv3", "lv2", "lv1", "base"],
};

export function preloadTurretSprites(opts = {}) {
  const includeUpgradePlaceholders = !!opts.includeUpgradePlaceholders;
  for (const entry of Object.values(TURRET_SPRITE_FILES)) {
    requestCandidates(entry.base);
    if (includeUpgradePlaceholders) {
      // CODEX CHANGE: Preload every visual upgrade tier when requested.
      requestCandidates(entry.lv1);
      requestCandidates(entry.lv2);
      requestCandidates(entry.lv3);
      requestCandidates(entry.lv4);
      requestCandidates(entry.lv5);
    }
  }
}

export function getTurretSprite(typeKey, level) {
  const entry = TURRET_SPRITE_FILES[typeKey];
  if (!entry) return null;

  const desired = tierKeyForLevel(level || 0);
  const tiers = TIER_FALLBACKS[desired];
  for (const tier of tiers) {
    const candidates = entry[tier];
    requestCandidates(candidates);
    const img = getLoadedCandidate(candidates);
    if (img) return img;
  }

  return null;
}

function resolveEnemySpriteKey(typeKey) {
  switch (typeKey) {
    case "RUNNER": return "runner";
    case "BRUTE": return "brute";
    case "ARMORED": return "armored";
    case "SHIELDED": return "shielded";
    case "SPLITTER": return "splitter";
    case "MINI": return "splitter_orb";
    case "REGEN": return "regen";
    case "STEALTH": return "stealth";
    case "FLYING": return "flying";
    case "PHASE": return "phase";
    case "FINAL_BOSS_VORTEX": return "finalboss_triangle";
    case "FINAL_BOSS_ABYSS": return "finalboss_oval";
    case "FINAL_BOSS_IRON": return "finalboss_fortress";
    case "BOSS_PROJECTOR":
      return "mini";
    case "SHIELD_DRONE":
      return "miniboss";
    default:
      if (typeKey && typeKey.startsWith("FINAL_BOSS_")) return "finalboss_triangle";
      if (typeKey && (typeKey.includes("MINIBOSS") || typeKey.startsWith("BOSS_"))) return "miniboss";
      return null;
  }
}

export function preloadEnemySprites() {
  for (const candidates of Object.values(ENEMY_SPRITE_FILES)) {
    requestCandidates(candidates);
  }
}

export function getEnemySprite(typeKey) {
  const spriteKey = resolveEnemySpriteKey(typeKey);
  if (!spriteKey) return null;
  const candidates = ENEMY_SPRITE_FILES[spriteKey];
  if (!candidates) return null;
  requestCandidates(candidates);
  return getLoadedCandidate(candidates);
}
