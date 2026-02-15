/* game.js
ORBIT ECHO: Loopborne Turretcraft
Pure HTML/CSS/JS. Canvas-rendered with layered glow & particles.
Unique twist: SKIP grants a short power surge plus bonus gold.

Notes:
- Speed multiplier affects EVERYTHING time-based via dtScaled = dt * speed.
- 30 waves, 10 turrets, 8+ enemy types.
- Turrets have 3 upgrade tiers (I/II/III) and a mod choice each tier.
*/

"use strict";

/**********************
 * Utilities
 **********************/
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const easeInOut = (t) => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(Math.floor(n));
}

export function lerpColor(a, b, t) {
  const tt = clamp(t, 0, 1);
  const r = Math.round(lerp(a[0], b[0], tt));
  const g = Math.round(lerp(a[1], b[1], tt));
  const bch = Math.round(lerp(a[2], b[2], tt));
  return `rgb(${r}, ${g}, ${bch})`;
}

/**********************
 * Canvas + resize
 **********************/
export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d", { alpha: true });

export let W = 0, H = 0, DPR = 1;
export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const maxDpr = area > 3800000 ? 1 : 2;
  DPR = clamp(dpr, 1, maxDpr);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);

/**********************
 * UI refs
 **********************/
export const $ = (id) => document.getElementById(id);
export const goldEl = $("gold");
export const livesEl = $("lives");
export const waveEl = $("wave");
export const waveMaxEl = $("waveMax");
export const nextInEl = $("nextIn");
export const levelValEl = $("levelVal");
export const envValEl = $("envVal");
export const seedValEl = $("seedVal");

export const startBtn = $("startBtn");
export const resetBtn = $("resetBtn");
export const pauseBtn = $("pauseBtn");
export const helpBtn = $("helpBtn");
export const audioBtn = $("audioBtn");
export const musicVol = $("musicVol");
export const sfxVol = $("sfxVol");
export const settingsBtn = $("settingsBtn");
export const settingsModal = $("settingsModal");
export const settingsClose = $("settingsClose");
export const settingsResetBtn = $("settingsResetBtn");
export const overlay = $("overlay");
export const closeHelp = $("closeHelp");
export const buildList = $("buildList");
export const selectionBody = $("selectionBody");
export const selSub = $("selSub");
export const sellBtn = $("sellBtn");
export const turretHud = $("turretHud");
export const turretHudBody = $("turretHudBody");
export const turretHudSellBtn = $("turretHudSellBtn");
export const turretHudCloseBtn = $("turretHudCloseBtn");
export const turretStateBar = $("turretStateBar");
export const toastEl = $("toast");
export const tooltipEl = $("tooltip");
export const topbarEl = document.querySelector(".topbar");
export const abilitiesBarEl = $("abilitiesBar");
export const levelOverlay = $("levelOverlay");
export const levelOverlayText = $("levelOverlayText");
export const confirmModal = $("confirmModal");
export const modalTitle = $("modalTitle");
export const modalBody = $("modalBody");
export const modalCancel = $("modalCancel");
export const modalConfirm = $("modalConfirm");
export const leftPanel = document.querySelector(".panel.left");
export const rightPanel = document.querySelector(".panel.right");
export const abilityScanBtn = $("abilityScanBtn");
export const abilityPulseBtn = $("abilityPulseBtn");
export const abilityOverBtn = $("abilityOverBtn");
export const abilityScanCd = $("abilityScanCd");
export const abilityPulseCd = $("abilityPulseCd");
export const abilityOverCd = $("abilityOverCd");
export const anomalyLabel = $("anomalyLabel");
export const anomalyPill = $("anomalyPill");
export const waveStatsModal = $("waveStatsModal");
export const waveStatsTitle = $("waveStatsTitle");
export const waveStatsBody = $("waveStatsBody");
export const waveStatsContinue = $("waveStatsContinue");
export const waveStatsSkip = $("waveStatsSkip");
export const waveStatsControls = $("waveStatsControls");
export const controlsModal = $("controlsModal");
export const controlsClose = $("controlsClose");

export const speedBtn = $("speedBtn");
export const SAVE_KEY = "orbit_echo_save_v1";
export const AUDIO_KEY = "orbit_echo_audio_v1";
export const START_GOLD = 330;
export const START_GOLD_PER_LEVEL = 25;
export const START_LIVES = 30;
export const GOLD_LOW = 50;
export const GOLD_MID = 100;
export const GOLD_HIGH = 300;
export const LIFE_RED_MAX = 10;
export const LIFE_YELLOW_MAX = 20;
export const LIFE_GREEN_MIN = 21;
export const LIFE_COLORS = {
  red: [255, 91, 125],
  redDark: [170, 42, 70],
  yellow: [255, 207, 91],
  green: [109, 255, 154]
};
export const ABILITY_COOLDOWN = 90;
export const OVERCHARGE_COOLDOWN = 90;
export const SKIP_GOLD_BONUS = 25;
export const SKIP_COOLDOWN_REDUCE = 15;
export const INTERMISSION_SECS = 15;
export const TOWER_UNLOCKS = {
  PULSE: 1,
  ARC: 1,
  FROST: 1,
  VENOM: 1,
  LENS: 5,
  MORTAR: 7,
  NEEDLE: 9,
  DRONE: 10,
  AURA: 10,
  TRAP: 10
};
export const GAME_STATE = {
  GAMEPLAY: "GAMEPLAY",
  BOSS_CINEMATIC: "BOSS_CINEMATIC"
};

export const MAP_GRID_SIZE = 44;
export const MAP_EDGE_MARGIN = 1;
export const TRACK_RADIUS = 16;
export const TRACK_BLOCK_PAD = 8;
export const POWER_TILE_COUNT = { min: 3, max: 6 };
export const POWER_NEAR_MIN = 28;
export const POWER_NEAR_MAX = 70;
export const POWER_TILE_MIN_DIST = 70;
export const LEVEL_HP_SCALE = 0.08;
export const LEVEL_SPD_SCALE = 0.03;

export const ENV_PRESETS = [
  {
    id: 0,
    name: "Neon Nebula",
    axis: "LR",
    bg0: "#060A12",
    bg1: "#15122F",
    glow1: "rgba(98,242,255,0.14)",
    glow2: "rgba(154,108,255,0.14)",
    accent: "#62F2FF",
    accent2: "#9A6CFF",
    grid: "rgba(98,242,255,0.12)",
    track: {
      base: "rgba(0,0,0,0.45)",
      glow1: "rgba(98,242,255,0.18)",
      glow2: "rgba(154,108,255,0.22)",
      core: "rgba(234,240,255,0.08)"
    }
  },
  {
    id: 1,
    name: "Rust Planet",
    axis: "LR",
    bg0: "#0E0A07",
    bg1: "#2B110B",
    glow1: "rgba(255,168,91,0.14)",
    glow2: "rgba(255,91,125,0.12)",
    accent: "#FFB05B",
    accent2: "#FF5B7D",
    grid: "rgba(255,180,120,0.10)",
    track: {
      base: "rgba(0,0,0,0.45)",
      glow1: "rgba(255,160,90,0.18)",
      glow2: "rgba(255,91,125,0.18)",
      core: "rgba(255,235,210,0.08)"
    }
  },
  {
    id: 2,
    name: "Cryo Grid",
    axis: "TB",
    bg0: "#050B10",
    bg1: "#0E1B24",
    glow1: "rgba(160,240,255,0.16)",
    glow2: "rgba(120,210,255,0.12)",
    accent: "#7FF2FF",
    accent2: "#7AB8FF",
    grid: "rgba(140,230,255,0.12)",
    track: {
      base: "rgba(0,0,0,0.45)",
      glow1: "rgba(140,230,255,0.22)",
      glow2: "rgba(110,180,255,0.20)",
      core: "rgba(230,250,255,0.08)"
    }
  },
  {
    id: 3,
    name: "Emerald Void",
    axis: "LR",
    bg0: "#07110E",
    bg1: "#0B2A1F",
    glow1: "rgba(109,255,154,0.14)",
    glow2: "rgba(70,220,190,0.12)",
    accent: "#6DFF9A",
    accent2: "#46DCC0",
    grid: "rgba(120,255,190,0.10)",
    track: {
      base: "rgba(0,0,0,0.45)",
      glow1: "rgba(109,255,154,0.20)",
      glow2: "rgba(70,220,190,0.18)",
      core: "rgba(210,255,230,0.08)"
    }
  },
  {
    id: 4,
    name: "Solar Storm",
    axis: "TB",
    bg0: "#110A07",
    bg1: "#2B0E1A",
    glow1: "rgba(255,207,91,0.16)",
    glow2: "rgba(255,120,200,0.12)",
    accent: "#FFCF5B",
    accent2: "#FF78C8",
    grid: "rgba(255,207,91,0.12)",
    track: {
      base: "rgba(0,0,0,0.45)",
      glow1: "rgba(255,207,91,0.20)",
      glow2: "rgba(255,120,200,0.18)",
      core: "rgba(255,240,190,0.08)"
    }
  }
];

export function makeRNG(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function distPointToSegmentSquared(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / abLen2;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return dist2(px, py, cx, cy);
}

export function distanceToSegmentsSquared(px, py, segments) {
  let best = Infinity;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const d = distPointToSegmentSquared(px, py, s.ax, s.ay, s.bx, s.by);
    if (d < best) best = d;
  }
  return best;
}

export function buildPathSegments(points) {
  const segs = [];
  let totalLen = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0];
    const ay = points[i][1];
    const bx = points[i + 1][0];
    const by = points[i + 1][1];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, cum: totalLen });
    totalLen += len;
  }
  return { segs, totalLen: Math.max(1, totalLen) };
}

export function generatePath(rng, gridW, gridH, axis) {
  const margin = 2;
  const minX = margin;
  const maxX = gridW - 1 - margin;
  const minY = margin;
  const maxY = gridH - 1 - margin;
  const turns = 8 + randInt(rng, 0, 8);
  const waypointCount = Math.max(3, Math.floor(turns / 2));
  const path = [];

  if (axis === "TB") {
    let x = randInt(rng, minX, maxX);
    let y = 0;
    path.push([x, y]);
    let curY = 0;
    for (let i = 0; i < waypointCount; i++) {
      curY = Math.min(gridH - 1, curY + randInt(rng, 2, 4));
      if (curY >= gridH - 1) curY = gridH - 1;
      const nextX = randInt(rng, minX, maxX);
      if (nextX !== x) path.push([nextX, path[path.length - 1][1]]);
      if (curY !== path[path.length - 1][1]) path.push([nextX, curY]);
      x = nextX;
      if (curY >= gridH - 1) break;
    }
    if (path[path.length - 1][1] !== gridH - 1) {
      path.push([path[path.length - 1][0], gridH - 1]);
    }
  } else {
    let y = randInt(rng, minY, maxY);
    let x = 0;
    path.push([x, y]);
    let curX = 0;
    for (let i = 0; i < waypointCount; i++) {
      curX = Math.min(gridW - 1, curX + randInt(rng, 2, 4));
      if (curX >= gridW - 1) curX = gridW - 1;
      const nextY = randInt(rng, minY, maxY);
      if (nextY !== y) path.push([path[path.length - 1][0], nextY]);
      if (curX !== path[path.length - 1][0]) path.push([curX, nextY]);
      y = nextY;
      if (curX >= gridW - 1) break;
    }
    if (path[path.length - 1][0] !== gridW - 1) {
      path.push([gridW - 1, path[path.length - 1][1]]);
    }
  }

  const compact = [];
  for (const p of path) {
    const last = compact[compact.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) compact.push(p);
  }
  return compact;
}

export function getPlayBounds() {
  let left = 0;
  let right = W;
  let top = 0;
  let bottom = H;
  const pad = 12;
  if (leftPanel) {
    const r = leftPanel.getBoundingClientRect();
    if (r.width > 20) left = Math.max(left, r.right + pad);
  }
  if (rightPanel) {
    const r = rightPanel.getBoundingClientRect();
    if (r.width > 20) right = Math.min(right, r.left - pad);
  }
  if (topbarEl) {
    const r = topbarEl.getBoundingClientRect();
    if (r.height > 20) top = Math.max(top, r.bottom + pad);
  }
  if (abilitiesBarEl) {
    const r = abilitiesBarEl.getBoundingClientRect();
    if (r.height > 10) top = Math.max(top, r.bottom + pad);
  }
  bottom = Math.min(bottom, H - pad);
  if ((right - left) < W * 0.55) {
    left = 0;
    right = W;
  }
  if ((bottom - top) < H * 0.55) {
    top = 0;
    bottom = H;
  }
  left = Math.ceil(left / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  top = Math.ceil(top / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  right = Math.floor(right / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  bottom = Math.floor(bottom / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  if (right - left < MAP_GRID_SIZE * 4 || bottom - top < MAP_GRID_SIZE * 3) {
    left = 0;
    top = 0;
    right = Math.floor(W / MAP_GRID_SIZE) * MAP_GRID_SIZE;
    bottom = Math.floor(H / MAP_GRID_SIZE) * MAP_GRID_SIZE;
  }
  let w = Math.max(80, right - left);
  let h = Math.max(80, bottom - top);
  if (w < 300 || h < 220) {
    left = 0;
    top = 0;
    right = Math.floor(W / MAP_GRID_SIZE) * MAP_GRID_SIZE;
    bottom = Math.floor(H / MAP_GRID_SIZE) * MAP_GRID_SIZE;
    w = Math.max(80, right - left);
    h = Math.max(80, bottom - top);
  }
  return { x: left, y: top, w, h };
}

export function generatePowerTiles(rng, segments, opts) {
  const tiles = [];
  const count = randInt(rng, opts.countMin, opts.countMax);
  const minBand = opts.minBand;
  const maxBand = opts.maxBand;
  const minDist = opts.minDist;
  const avoid = opts.avoid || [];
  const avoidR2 = Math.pow(opts.avoidR || 0, 2);
  const attempts = count * 30;

  const isFarFromOthers = (x, y) => {
    for (const t of tiles) {
      if (dist2(x, y, t.x, t.y) < minDist * minDist) return false;
    }
    return true;
  };

  for (let i = 0; i < attempts && tiles.length < count; i++) {
    const s = segments[(rng() * segments.length) | 0];
    const t = rng();
    const px = lerp(s.ax, s.bx, t);
    const py = lerp(s.ay, s.by, t);
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = lerp(minBand, maxBand, rng()) * (rng() < 0.5 ? -1 : 1);
    const cx = px + nx * off;
    const cy = py + ny * off;
    if (opts.bounds) {
      const b = opts.bounds;
      if (cx < b.x + MAP_GRID_SIZE * 0.5 || cy < b.y + MAP_GRID_SIZE * 0.5 || cx > b.x + b.w - MAP_GRID_SIZE * 0.5 || cy > b.y + b.h - MAP_GRID_SIZE * 0.5) continue;
    } else {
      if (cx < MAP_GRID_SIZE * 0.5 || cy < MAP_GRID_SIZE * 0.5 || cx > W - MAP_GRID_SIZE * 0.5 || cy > H - MAP_GRID_SIZE * 0.5) continue;
    }
    const d = Math.sqrt(distanceToSegmentsSquared(cx, cy, segments));
    if (d < minBand || d > maxBand) continue;
    if (!isFarFromOthers(cx, cy)) continue;
    if (avoidR2 > 0) {
      let ok = true;
      for (const p of avoid) {
        if (dist2(cx, cy, p.x, p.y) <= avoidR2) { ok = false; break; }
      }
      if (!ok) continue;
    }
    tiles.push({ x: cx, y: cy });
  }

  if (tiles.length < count) {
    const relaxedMinDist = minDist * 0.6;
    const relaxedMinBand = Math.max(minBand * 0.75, TRACK_RADIUS + 8);
    const extraAttempts = count * 20;
    for (let i = 0; i < extraAttempts && tiles.length < count; i++) {
      const s = segments[(rng() * segments.length) | 0];
      const t = rng();
      const px = lerp(s.ax, s.bx, t);
      const py = lerp(s.ay, s.by, t);
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const off = lerp(relaxedMinBand, maxBand, rng()) * (rng() < 0.5 ? -1 : 1);
      const cx = px + nx * off;
      const cy = py + ny * off;
      if (opts.bounds) {
        const b = opts.bounds;
        if (cx < b.x + MAP_GRID_SIZE * 0.5 || cy < b.y + MAP_GRID_SIZE * 0.5 || cx > b.x + b.w - MAP_GRID_SIZE * 0.5 || cy > b.y + b.h - MAP_GRID_SIZE * 0.5) continue;
      } else {
        if (cx < MAP_GRID_SIZE * 0.5 || cy < MAP_GRID_SIZE * 0.5 || cx > W - MAP_GRID_SIZE * 0.5 || cy > H - MAP_GRID_SIZE * 0.5) continue;
      }
      const d = Math.sqrt(distanceToSegmentsSquared(cx, cy, segments));
      if (d < relaxedMinBand || d > maxBand) continue;
      let ok = true;
      for (const t of tiles) {
        if (dist2(cx, cy, t.x, t.y) < relaxedMinDist * relaxedMinDist) { ok = false; break; }
      }
      if (!ok) continue;
      if (avoidR2 > 0) {
        let safe = true;
        for (const p of avoid) {
          if (dist2(cx, cy, p.x, p.y) <= avoidR2) { safe = false; break; }
        }
        if (!safe) continue;
      }
      tiles.push({ x: cx, y: cy });
    }
  }

  return tiles;
}

export function generateMap(seed, envId) {
  const rng = makeRNG(seed);
  const env = ENV_PRESETS[envId % ENV_PRESETS.length];
  const bounds = getPlayBounds();
  const gridW = Math.max(12, Math.floor(bounds.w / MAP_GRID_SIZE));
  const gridH = Math.max(8, Math.floor(bounds.h / MAP_GRID_SIZE));
  const axis = env.axis || (rng() < 0.5 ? "LR" : "TB");
  const pathCells = generatePath(rng, gridW, gridH, axis);
  const pathN = pathCells.map(([gx, gy]) => [
    (gx + 0.5) / gridW,
    (gy + 0.5) / gridH
  ]);
  const pathPts = pathN.map(([nx, ny]) => [
    bounds.x + nx * bounds.w,
    bounds.y + ny * bounds.h
  ]);
  const segData = buildPathSegments(pathPts);
  const spawn = { x: pathPts[0][0], y: pathPts[0][1] };
  const goal = { x: pathPts[pathPts.length - 1][0], y: pathPts[pathPts.length - 1][1] };
  const blockedCells = [];
  const blockR2 = Math.pow(TRACK_RADIUS + TRACK_BLOCK_PAD, 2);
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = (gx + 0.5) * MAP_GRID_SIZE;
      const py = (gy + 0.5) * MAP_GRID_SIZE;
      if (distanceToSegmentsSquared(px, py, segData.segs) <= blockR2) {
        blockedCells.push(gy * gridW + gx);
      }
    }
  }
  const powerTiles = generatePowerTiles(rng, segData.segs, {
    countMin: POWER_TILE_COUNT.min,
    countMax: POWER_TILE_COUNT.max,
    minBand: POWER_NEAR_MIN,
    maxBand: POWER_NEAR_MAX,
    minDist: POWER_TILE_MIN_DIST,
    avoid: [spawn, goal],
    avoidR: TRACK_RADIUS * 2.2,
    bounds
  });
  const powerTilesN = powerTiles.map(p => [
    (p.x - bounds.x) / bounds.w,
    (p.y - bounds.y) / bounds.h
  ]);
  const poolsN = [];
  const poolCount = randInt(rng, 2, 5);
  const poolAttempts = poolCount * 18;
  for (let i = 0; i < poolAttempts && poolsN.length < poolCount; i++) {
    const s = segData.segs[(rng() * segData.segs.length) | 0];
    const t = rng();
    const px = lerp(s.ax, s.bx, t);
    const py = lerp(s.ay, s.by, t);
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = lerp(TRACK_RADIUS + 24, TRACK_RADIUS + 90, rng()) * (rng() < 0.5 ? -1 : 1);
    const cx = px + nx * off;
    const cy = py + ny * off;
    if (cx < bounds.x + 60 || cy < bounds.y + 60 || cx > bounds.x + bounds.w - 60 || cy > bounds.y + bounds.h - 60) continue;
    const d = Math.sqrt(distanceToSegmentsSquared(cx, cy, segData.segs));
    if (d < TRACK_RADIUS + 18 || d > TRACK_RADIUS + 110) continue;
    const r = lerp(55, 120, rng());
    let ok = true;
    for (const p of poolsN) {
      const dxp = (p[0] * bounds.w + bounds.x) - cx;
      const dyp = (p[1] * bounds.h + bounds.y) - cy;
      if (dxp * dxp + dyp * dyp < (r + p[2]) * (r + p[2])) { ok = false; break; }
    }
    if (!ok) continue;
    poolsN.push([(cx - bounds.x) / bounds.w, (cy - bounds.y) / bounds.h, r]);
  }
  return {
    seed,
    envId: env.id,
    env,
    pathN,
    powerTilesN,
    poolsN,
    pathPoints: pathPts,
    trackSegments: segData.segs,
    blockedCells,
    spawn: pathN[0],
    goal: pathN[pathN.length - 1],
    backgroundStyle: { bg0: env.bg0, bg1: env.bg1, glow1: env.glow1, glow2: env.glow2 }
  };
}


export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 1400);
}

export function showTooltip(msg, x, y) {
  if (!tooltipEl) return;
  tooltipEl.textContent = msg;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.classList.remove("hidden");
}

export function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.classList.add("hidden");
}

export function flashAbilityButton(btn) {
  if (!btn) return;
  btn.classList.remove("btnFlashRed");
  void btn.offsetWidth;
  btn.classList.add("btnFlashRed");
  clearTimeout(btn._flashT);
  btn._flashT = setTimeout(() => btn.classList.remove("btnFlashRed"), 520);
}

export let _modalOpen = false;
export let _modalOnConfirm = null;
export function showConfirm(title, message, onConfirm) {
  if (!confirmModal) return;
  _modalOpen = true;
  _modalOnConfirm = onConfirm || null;
  modalTitle.textContent = title || "Confirm";
  modalBody.textContent = message || "";
  confirmModal.classList.remove("hidden");
  confirmModal.setAttribute("aria-hidden", "false");
}
export function closeConfirm() {
  if (!confirmModal) return;
  _modalOpen = false;
  _modalOnConfirm = null;
  confirmModal.classList.add("hidden");
  confirmModal.setAttribute("aria-hidden", "true");
}

