export const USE_TURRET_SPRITES = true;

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
  ARC: "rgba(154,108,255,1)",
  FROST: "rgba(176,214,255,1)",
  LENS: "rgba(126,244,255,1)",
  NEEDLE: "rgba(190,126,255,1)",
  VENOM: "rgba(109,255,154,1)",
  MORTAR: "rgba(255,184,92,1)",
  AURA: "rgba(171,156,255,1)",
  DRONE: "rgba(116,236,255,1)",
  TRAP: "rgba(180,120,255,1)",
};

const TURRET_SPRITE_DEFS = {
  PULSE: { key: "pulse", aliases: ["pulse"], folders: ["pulse", "pulse_spindle"] },
  ARC: { key: "arc", aliases: ["arc"], folders: ["arc", "arc_coil"] },
  FROST: { key: "frost", aliases: ["frost"], folders: ["frost", "frost_vent"] },
  LENS: { key: "lens", aliases: ["lens", "sun"], folders: ["lens", "sun_lens"] },
  VENOM: { key: "venom", aliases: ["venom"], folders: ["venom", "venom_spitter"] },
  MORTAR: { key: "mortar", aliases: ["mortar"], folders: ["mortar", "mortar_bloom"] },
  NEEDLE: { key: "needle", aliases: ["needle", "rail"], folders: ["needle", "rail_needle"] },
  AURA: { key: "aura", aliases: ["aura"], folders: ["aura", "aura_grove"] },
  DRONE: { key: "drone", aliases: ["drone"], folders: ["drone", "drone_hive"] },
  TRAP: { key: "trap", aliases: ["trap", "gravity"], folders: ["trap", "gravity_trap"] },
};

const SPRITE_PATH_ROOTS = [
  "assets/turrets",
  "assets/images/turrets",
];

const spriteCache = Object.create(null);

function createCandidateList(fileNames, folders) {
  const seen = new Set();
  const out = [];
  for (const root of SPRITE_PATH_ROOTS) {
    for (const name of fileNames) {
      const flat = `${root}/${name}`;
      if (!seen.has(flat)) {
        seen.add(flat);
        out.push(flat);
      }
      for (const folder of folders) {
        const nested = `${root}/${folder}/${name}`;
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
    map[typeKey] = {
      base: buildTierCandidates(def, "base"),
      u1: buildTierCandidates(def, "u1"),
      u2: buildTierCandidates(def, "u2"),
      u3: buildTierCandidates(def, "u3"),
    };
  }
  return map;
}

export const TURRET_SPRITE_FILES = buildSpriteMap();

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
  if (level <= 0) return "base";
  if (level === 1) return "u1";
  if (level === 2) return "u2";
  return "u3";
}

const TIER_FALLBACKS = {
  base: ["base"],
  u1: ["u1", "base"],
  u2: ["u2", "u1", "base"],
  u3: ["u3", "u2", "u1", "base"],
};

export function preloadTurretSprites(opts = {}) {
  const includeUpgradePlaceholders = !!opts.includeUpgradePlaceholders;
  for (const entry of Object.values(TURRET_SPRITE_FILES)) {
    requestCandidates(entry.base);
    if (includeUpgradePlaceholders) {
      requestCandidates(entry.u1);
      requestCandidates(entry.u2);
      requestCandidates(entry.u3);
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
