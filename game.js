/* game.js
  ORBIT ECHO: Loopborne Turretcraft
  Pure HTML/CSS/JS. Canvas-rendered with layered glow & particles.
  Unique twist: SKIP grants a short power surge plus bonus gold.

  Notes:
  - Speed multiplier affects EVERYTHING time-based via dtScaled = dt * speed.
  - 30 waves, 10 turrets, 8+ enemy types.
  - Turrets have 3 upgrade tiers (I/II/III) and a mod choice each tier.
*/

(() => {
  "use strict";

  /**********************
   * Utilities
   **********************/
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function fmt(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.floor(n));
  }

  function lerpColor(a, b, t) {
    const tt = clamp(t, 0, 1);
    const r = Math.round(lerp(a[0], b[0], tt));
    const g = Math.round(lerp(a[1], b[1], tt));
    const bch = Math.round(lerp(a[2], b[2], tt));
    return `rgb(${r}, ${g}, ${bch})`;
  }

  /**********************
   * Canvas + resize
   **********************/
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: true });

  let W = 0, H = 0, DPR = 1;
  function resize() {
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
  const $ = (id) => document.getElementById(id);
  const goldEl = $("gold");
  const livesEl = $("lives");
  const waveEl = $("wave");
  const waveMaxEl = $("waveMax");
  const nextInEl = $("nextIn");
  const levelValEl = $("levelVal");
  const envValEl = $("envVal");
  const seedValEl = $("seedVal");

  const startBtn = $("startBtn");
  const resetBtn = $("resetBtn");
  const pauseBtn = $("pauseBtn");
  const helpBtn = $("helpBtn");
  const audioBtn = $("audioBtn");
  const musicVol = $("musicVol");
  const sfxVol = $("sfxVol");
  const settingsBtn = $("settingsBtn");
  const settingsModal = $("settingsModal");
  const settingsClose = $("settingsClose");
  const settingsResetBtn = $("settingsResetBtn");
  const overlay = $("overlay");
  const closeHelp = $("closeHelp");
  const buildList = $("buildList");
  const selectionBody = $("selectionBody");
  const selSub = $("selSub");
  const sellBtn = $("sellBtn");
  const toastEl = $("toast");
  const tooltipEl = $("tooltip");
  const topbarEl = document.querySelector(".topbar");
  const abilitiesBarEl = $("abilitiesBar");
  const levelOverlay = $("levelOverlay");
  const levelOverlayText = $("levelOverlayText");
  const confirmModal = $("confirmModal");
  const modalTitle = $("modalTitle");
  const modalBody = $("modalBody");
  const modalCancel = $("modalCancel");
  const modalConfirm = $("modalConfirm");
  const leftPanel = document.querySelector(".panel.left");
  const rightPanel = document.querySelector(".panel.right");
  const abilityScanBtn = $("abilityScanBtn");
  const abilityPulseBtn = $("abilityPulseBtn");
  const abilityOverBtn = $("abilityOverBtn");
  const abilityScanCd = $("abilityScanCd");
  const abilityPulseCd = $("abilityPulseCd");
  const abilityOverCd = $("abilityOverCd");
  const anomalyLabel = $("anomalyLabel");
  const anomalyPill = $("anomalyPill");
  const waveStatsModal = $("waveStatsModal");
  const waveStatsTitle = $("waveStatsTitle");
  const waveStatsBody = $("waveStatsBody");
  const waveStatsContinue = $("waveStatsContinue");
  const waveStatsSkip = $("waveStatsSkip");
  const waveStatsControls = $("waveStatsControls");
  const controlsModal = $("controlsModal");
  const controlsClose = $("controlsClose");

  const speedBtn = $("speedBtn");
  const SAVE_KEY = "orbit_echo_save_v1";
  const AUDIO_KEY = "orbit_echo_audio_v1";
  const START_GOLD = 330;
  const START_GOLD_PER_LEVEL = 25;
  const START_LIVES = 30;
  const GOLD_LOW = 50;
  const GOLD_MID = 100;
  const GOLD_HIGH = 300;
  const LIFE_RED_MAX = 10;
  const LIFE_YELLOW_MAX = 20;
  const LIFE_GREEN_MIN = 21;
  const LIFE_COLORS = {
    red: [255, 91, 125],
    redDark: [170, 42, 70],
    yellow: [255, 207, 91],
    green: [109, 255, 154]
  };
  const ABILITY_COOLDOWN = 90;
  const OVERCHARGE_COOLDOWN = 90;
  const SKIP_GOLD_BONUS = 25;
  const SKIP_COOLDOWN_REDUCE = 15;
  const INTERMISSION_SECS = 15;
  const TOWER_UNLOCKS = {
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

  const MAP_GRID_SIZE = 44;
  const MAP_EDGE_MARGIN = 1;
  const TRACK_RADIUS = 16;
  const TRACK_BLOCK_PAD = 8;
  const POWER_TILE_COUNT = { min: 3, max: 6 };
  const POWER_NEAR_MIN = 28;
  const POWER_NEAR_MAX = 70;
  const POWER_TILE_MIN_DIST = 70;
  const LEVEL_HP_SCALE = 0.08;
  const LEVEL_SPD_SCALE = 0.03;

  const ENV_PRESETS = [
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

  function makeRNG(seed) {
    let t = seed >>> 0;
    return function rng() {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function distPointToSegmentSquared(px, py, ax, ay, bx, by) {
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

  function distanceToSegmentsSquared(px, py, segments) {
    let best = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const d = distPointToSegmentSquared(px, py, s.ax, s.ay, s.bx, s.by);
      if (d < best) best = d;
    }
    return best;
  }

  function buildPathSegments(points) {
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

  function generatePath(rng, gridW, gridH, axis) {
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

  function getPlayBounds() {
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
      right = W;
      bottom = H;
      w = Math.max(80, right - left);
      h = Math.max(80, bottom - top);
    }
    return { x: left, y: top, w, h };
  }

  function generatePowerTiles(rng, segments, opts) {
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

  function generateMap(seed, envId) {
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

  class AudioSystem {
    constructor() {
      this.enabled = false;
      this.unlocked = false;
      this.bgmSources = [
        "assets/music/bgm.mp3"
      ];
      this.bgm = this._makeAudio(this.bgmSources, true, 0.32);
      this.bgm.loop = true;
      this.bgm.volume = 0.32;
      this.sfx = {
        build: ["assets/sfx/sfx_build.wav"],
        upgrade: ["assets/sfx/sfx_upgrade.wav"],
        sell: ["assets/sfx/sfx_sell.wav"],
        wave: ["assets/sfx/sfx_wave.wav"],
        skip: ["assets/sfx/sfx_skip.wav"],
        leak: ["assets/sfx/sfx_leak.wav"],
        win: ["assets/sfx/sfx_win.wav"],
        lose: ["assets/sfx/sfx_lose.wav"],
        shot: ["assets/sfx/sfx_shot.wav"],
        hit: ["assets/sfx/sfx_hit.wav"],
        kill: ["assets/sfx/sfx_kill.wav"],
        beam: ["assets/sfx/sfx_beam.wav"],
        mortar: ["assets/sfx/sfx_mortar.wav"],
        trap: ["assets/sfx/sfx_trap.wav"],
        drone: ["assets/sfx/sfx_drone.wav"],
        hover: ["assets/sfx/sfx_Hoveroverbutton.wav"],
        click: ["assets/sfx/sfx_clickme.wav"]
      };
      this.sfxVol = 0.6;
      this._last = {};
      this._errorShown = false;
    }

    _pickSource(sources) {
      const probe = document.createElement("audio");
      let fallback = sources[0];
      for (const src of sources) {
        const ext = src.split(".").pop().toLowerCase();
        const mime = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "";
        if (!mime) { fallback = src; continue; }
        const can = probe.canPlayType(mime);
        if (can && can !== "no") return src;
      }
      return fallback;
    }

    _orderSources(sources) {
      const probe = document.createElement("audio");
      const ranked = [];
      for (const src of sources) {
        const ext = src.split(".").pop().toLowerCase();
        const mime = ext === "mp3" ? "audio/mpeg" : ext === "wav" ? "audio/wav" : "";
        const can = mime ? probe.canPlayType(mime) : "maybe";
        const score = can === "probably" ? 2 : can === "maybe" ? 1 : 0;
        ranked.push({ src, score });
      }
      ranked.sort((a, b) => b.score - a.score);
      return ranked.map(r => r.src);
    }

    _makeAudio(sources, loop = false, volume = 1) {
      const ordered = this._orderSources(sources);
      const a = new Audio();
      a.loop = loop;
      a.volume = volume;
      let idx = 0;
      const setSrc = () => {
        if (idx >= ordered.length) return;
        a.src = ordered[idx++];
        a.load();
      };
      a.addEventListener("error", setSrc);
      setSrc();
      return a;
    }

    _setButton() {
      if (!audioBtn) return;
      audioBtn.classList.toggle("muted", !this.enabled);
      const label = audioBtn.querySelector(".audioLabel");
      if (label) label.textContent = this.enabled ? "AUDIO: ON" : "AUDIO: OFF";
    }

    loadPref() {
      try {
        const raw = localStorage.getItem(AUDIO_KEY);
        const data = raw ? JSON.parse(raw) : null;
        this.enabled = data ? data.enabled === 1 : true;
        if (typeof data?.music === "number") this.bgm.volume = clamp(data.music, 0, 1);
        if (typeof data?.sfx === "number") this.sfxVol = clamp(data.sfx, 0, 1);
      } catch (err) {
        this.enabled = true;
      }
      this._setButton();
    }

    savePref() {
      try {
        localStorage.setItem(AUDIO_KEY, JSON.stringify({
          enabled: this.enabled ? 1 : 0,
          music: this.bgm.volume,
          sfx: this.sfxVol
        }));
      } catch (err) {
        // ignore
      }
    }

    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      // try to prime audio; if blocked, it will no-op
      this.bgm.play().then(() => {
        if (!this.enabled) this.bgm.pause();
      }).catch(() => {});
    }

    setEnabled(on) {
      this.enabled = !!on;
      this._setButton();
      this.savePref();
      if (!this.unlocked) return;
      if (this.enabled) {
        if (!this.bgm) {
          this.bgm = this._makeAudio(this.bgmSources, true, 0.32);
        }
        this.bgm.volume = this.bgm.volume ?? 0.32;
        this.bgm.play().catch(() => {
          if (!this._errorShown) {
            this._errorShown = true;
            toast("Audio blocked. Click once on the game, then toggle Audio.");
          }
        });
        // Quick confirm beep
        this.play("build");
      } else {
        if (this.bgm) this.bgm.pause();
      }
    }

    setMusicVolume(v) {
      this.bgm.volume = clamp(v, 0, 1);
      this.savePref();
    }

    setSfxVolume(v) {
      this.sfxVol = clamp(v, 0, 1);
      this.savePref();
    }

    toggle() {
      this.unlock();
      this.setEnabled(!this.enabled);
    }

    play(name) {
      if (!this.enabled) return;
      const sources = this.sfx[name];
      if (!sources) return;
      const a = this._makeAudio(sources, false, this.sfxVol);
      a.play().catch(() => {
        if (!this._errorShown) {
          this._errorShown = true;
          toast("Audio blocked. Click once on the game, then toggle Audio.");
        }
      });
    }

    playLimited(name, cooldownMs) {
      if (!this.enabled) return;
      const now = performance.now();
      const last = this._last[name] || 0;
      if (now - last < cooldownMs) return;
      this._last[name] = now;
      this.play(name);
    }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 1400);
  }

  function showTooltip(msg, x, y) {
    if (!tooltipEl) return;
    tooltipEl.textContent = msg;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
    tooltipEl.classList.remove("hidden");
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.add("hidden");
  }

  function flashAbilityButton(btn) {
    if (!btn) return;
    btn.classList.remove("btnFlashRed");
    void btn.offsetWidth;
    btn.classList.add("btnFlashRed");
    clearTimeout(btn._flashT);
    btn._flashT = setTimeout(() => btn.classList.remove("btnFlashRed"), 520);
  }

  let _modalOpen = false;
  let _modalOnConfirm = null;
  function showConfirm(title, message, onConfirm) {
    if (!confirmModal) return;
    _modalOpen = true;
    _modalOnConfirm = onConfirm || null;
    modalTitle.textContent = title || "Confirm";
    modalBody.textContent = message || "";
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
  }
  function closeConfirm() {
    if (!confirmModal) return;
    _modalOpen = false;
    _modalOnConfirm = null;
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
  }

  /**********************
   * Map (grid build areas + path polyline)
   **********************/
  class Map {
    constructor(mapData) {
      this.gridSize = MAP_GRID_SIZE;
      this.cols = 0;
      this.rows = 0;
      this.cells = [];
      this.powerCells = [];
      this.powerTilesN = [];
      this.pathN = [];
      this.pathPts = [];
      this.segs = [];
      this.totalLen = 1;
      this.env = ENV_PRESETS[0];
      if (mapData) this.loadGeneratedMap(mapData);
      else this._rebuild();
    }

    loadGeneratedMap(mapData) {
      if (!mapData) return;
      this.pathN = mapData.pathN || [];
      this.powerTilesN = mapData.powerTilesN || [];
      this.poolsN = mapData.poolsN || [];
      this.env = mapData.env || ENV_PRESETS[mapData.envId || 0] || ENV_PRESETS[0];
      this._rebuild();
    }

    _ensurePath() {
      if (this.pathN && this.pathN.length >= 2) return;
      this.pathN = [
        [0.05, 0.5],
        [0.95, 0.5]
      ];
    }

    _rebuild() {
      this._ensurePath();
      let bounds = getPlayBounds();
      this.cols = Math.max(6, Math.floor(W / this.gridSize));
      this.rows = Math.max(6, Math.floor(H / this.gridSize));
      this.cells = new Array(this.cols * this.rows).fill(1);
      this.powerCells = [];
      this.poolsN = this.poolsN || [];

      const buildPathPts = (b) => this.pathN.map(([nx, ny]) => [
        b.x + nx * b.w,
        b.y + ny * b.h
      ]);
      this.pathPts = buildPathPts(bounds);
      let segData = buildPathSegments(this.pathPts);
      if (!Number.isFinite(segData.totalLen) || segData.totalLen < Math.min(W, H) * 0.35) {
        bounds = { x: 0, y: 0, w: W, h: H };
        this.pathPts = buildPathPts(bounds);
        segData = buildPathSegments(this.pathPts);
      }
      this.segs = segData.segs;
      this.totalLen = segData.totalLen;

      for (let gy = 0; gy < this.rows; gy++) {
        for (let gx = 0; gx < this.cols; gx++) {
          if (gx < MAP_EDGE_MARGIN || gy < MAP_EDGE_MARGIN || gx >= this.cols - MAP_EDGE_MARGIN || gy >= this.rows - MAP_EDGE_MARGIN) {
            this.cells[gy * this.cols + gx] = 0;
          }
        }
      }

      const blockR2 = Math.pow(TRACK_RADIUS + TRACK_BLOCK_PAD, 2);
      for (let gy = 0; gy < this.rows; gy++) {
        for (let gx = 0; gx < this.cols; gx++) {
          const idx = gy * this.cols + gx;
          if (this.cells[idx] === 0) continue;
          const px = (gx + 0.5) * this.gridSize;
          const py = (gy + 0.5) * this.gridSize;
          if (distanceToSegmentsSquared(px, py, this.segs) <= blockR2) {
            this.cells[idx] = 2;
          }
        }
      }

      if (this.poolsN && this.poolsN.length) {
        let buildableCount = 0;
        for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === 1) buildableCount++;
        const minBuildable = Math.max(28, Math.floor(this.cells.length * 0.08));

        for (const pool of this.poolsN) {
          const cx = bounds.x + pool[0] * bounds.w;
          const cy = bounds.y + pool[1] * bounds.h;
          const r = pool[2];
          const r2 = r * r;
          let removed = 0;
          const indices = [];
          for (let gy = 0; gy < this.rows; gy++) {
            for (let gx = 0; gx < this.cols; gx++) {
              const idx = gy * this.cols + gx;
              if (this.cells[idx] !== 1) continue;
              const px = (gx + 0.5) * this.gridSize;
              const py = (gy + 0.5) * this.gridSize;
              if (dist2(px, py, cx, cy) <= r2) {
                indices.push(idx);
                removed++;
              }
            }
          }
          if (buildableCount - removed < minBuildable) continue;
          for (const idx of indices) this.cells[idx] = 0;
          buildableCount -= removed;
        }
      }

      if (this.powerTilesN && this.powerTilesN.length) {
        for (const p of this.powerTilesN) {
          const px = bounds.x + p[0] * bounds.w;
          const py = bounds.y + p[1] * bounds.h;
          const gx = clamp(Math.floor(px / this.gridSize), 0, this.cols - 1);
          const gy = clamp(Math.floor(py / this.gridSize), 0, this.rows - 1);
          const idx = gy * this.cols + gx;
          if (this.cells[idx] === 1) {
            this.cells[idx] = 3;
            this.powerCells.push(idx);
          }
        }
      }
    }

    onResize() { this._rebuild(); }

    cellAt(px, py) {
      const gx = Math.floor(px / this.gridSize);
      const gy = Math.floor(py / this.gridSize);
      if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return { gx, gy, v: 0 };
      return { gx, gy, v: this.cells[gy * this.cols + gx] };
    }

    worldFromCell(gx, gy) {
      return {
        x: (gx + 0.5) * this.gridSize,
        y: (gy + 0.5) * this.gridSize
      };
    }

    // Path position by distance along path
    posAt(d) {
      d = clamp(d, 0, this.totalLen);
      // find segment
      let seg = this.segs[this.segs.length - 1];
      for (let i = 0; i < this.segs.length; i++) {
        const s = this.segs[i];
        if (d <= s.cum + s.len) { seg = s; break; }
      }
      const t = seg.len > 0 ? (d - seg.cum) / seg.len : 0;
      const x = lerp(seg.ax, seg.bx, t);
      const y = lerp(seg.ay, seg.by, t);
      const dx = seg.bx - seg.ax;
      const dy = seg.by - seg.ay;
      const ang = Math.atan2(dy, dx);
      return { x, y, ang };
    }

    drawBase(gfx) {
      const area = W * H;
      const perf = area > 7000000 ? 0.5 : area > 3800000 ? 0.7 : 1;
      const gridStep = this.gridSize * (perf < 0.7 ? 2 : 1);
      gfx.save();
      const bg = gfx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, this.env.bg0 || "#070A12");
      bg.addColorStop(1, this.env.bg1 || "#0B1022");
      gfx.fillStyle = bg;
      gfx.fillRect(0, 0, W, H);
      gfx.restore();

      // Background "nebula grid"
      gfx.save();
      gfx.globalAlpha = 0.35;
      gfx.strokeStyle = this.env.grid || "rgba(98,242,255,0.12)";
      gfx.lineWidth = 1;
      for (let x = 0; x < W; x += gridStep) {
        gfx.beginPath(); gfx.moveTo(x + 0.5, 0); gfx.lineTo(x + 0.5, H); gfx.stroke();
      }
      for (let y = 0; y < H; y += gridStep) {
        gfx.beginPath(); gfx.moveTo(0, y + 0.5); gfx.lineTo(W, y + 0.5); gfx.stroke();
      }
      gfx.restore();

      const t = performance.now() * 0.001;

      // Buildable tile glow
      gfx.save();
      for (let gy = 0; gy < this.rows; gy++) {
        for (let gx = 0; gx < this.cols; gx++) {
          const v = this.cells[gy * this.cols + gx];
          if (v !== 1 && v !== 3) continue;
          if (perf < 0.7 && ((gx + gy) % 2) === 1) continue;
          const x = gx * this.gridSize;
          const y = gy * this.gridSize;

          // soft, animated sheen
          const t = performance.now() * 0.001;
          const pulse = 0.35 + 0.25 * Math.sin(t * 1.2 + gx * 0.7 + gy * 0.5);
          if (v === 3) {
            const goldPulse = 0.55 + 0.35 * Math.sin(t * 2.4 + gx * 0.6 + gy * 0.4);
            gfx.fillStyle = `rgba(255,207,91,${0.16 + goldPulse * 0.18})`;
          } else {
            gfx.fillStyle = `rgba(98,242,255,${0.035 + pulse * 0.02})`;
          }
          gfx.fillRect(x, y, this.gridSize, this.gridSize);

          gfx.strokeStyle = v === 3
            ? `rgba(255,207,91,${0.45 + pulse * 0.2})`
            : `rgba(154,108,255,${0.08 + pulse * 0.06})`;
          gfx.lineWidth = 1;
          gfx.strokeRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);

          if (v === 3) {
            const cx = x + this.gridSize * 0.5;
            const cy = y + this.gridSize * 0.5;
            const rCore = this.gridSize * 0.22;
            const grad = gfx.createRadialGradient(cx, cy, 0, cx, cy, this.gridSize * 0.8);
            grad.addColorStop(0, "rgba(255,207,91,0.55)");
            grad.addColorStop(0.45, "rgba(255,160,70,0.25)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            gfx.save();
            gfx.globalAlpha = 0.55;
            gfx.fillStyle = grad;
            gfx.beginPath();
            gfx.arc(cx, cy, this.gridSize * 0.8, 0, Math.PI * 2);
            gfx.fill();

            gfx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 2.3 + gx);
            gfx.fillStyle = "rgba(255,240,190,0.25)";
            gfx.strokeStyle = "rgba(255,207,91,0.9)";
            gfx.lineWidth = 2;
            gfx.beginPath(); gfx.arc(cx, cy, rCore, 0, Math.PI * 2); gfx.fill(); gfx.stroke();

            gfx.globalAlpha = 0.45;
            gfx.strokeStyle = "rgba(255,207,91,0.7)";
            gfx.lineWidth = 1.5;
            gfx.beginPath();
            gfx.arc(cx, cy, rCore + 6 + Math.sin(t * 2.5 + gy) * 2, 0, Math.PI * 2);
            gfx.stroke();
            gfx.restore();

            gfx.save();
            gfx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 3.1 + gx + gy);
            gfx.strokeStyle = "rgba(255,207,91,0.9)";
            gfx.lineWidth = 2;
            gfx.beginPath();
            gfx.arc(x + this.gridSize * 0.5, y + this.gridSize * 0.5, this.gridSize * 0.35, 0, Math.PI * 2);
            gfx.stroke();
            gfx.restore();
          }

          // hologram scanlines (diagonal shimmer)
          if (perf >= 0.7) {
            gfx.save();
            gfx.globalAlpha = v === 3 ? 0.22 + pulse * 0.12 : 0.10 + pulse * 0.05;
            gfx.beginPath();
            gfx.rect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
            gfx.clip();
            gfx.strokeStyle = v === 3 ? "rgba(255,207,91,0.8)" : "rgba(98,242,255,0.35)";
            gfx.lineWidth = 1;
            const step = 6;
            const drift = (t * 22 + (gx + gy) * 3) % (this.gridSize * 2);
            for (let s = -this.gridSize; s < this.gridSize * 2; s += step) {
              gfx.beginPath();
              gfx.moveTo(x + s + drift, y - 2);
              gfx.lineTo(x + s + drift + this.gridSize, y + this.gridSize + 2);
              gfx.stroke();
            }
            gfx.restore();
          }

          // sparkle removed (too busy)
        }
      }

      gfx.restore();

      // Path with layered glow
      const pts = this.pathPts;
      if (!pts || pts.length < 2) return;
      gfx.save();
      gfx.lineCap = "round";
      gfx.lineJoin = "round";

      gfx.strokeStyle = this.env.track?.base || "rgba(0,0,0,0.45)";
      gfx.lineWidth = 28;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = this.env.track?.glow1 || "rgba(98,242,255,0.18)";
      gfx.lineWidth = 20;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = this.env.track?.glow2 || "rgba(154,108,255,0.18)";
      gfx.lineWidth = 12;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = this.env.track?.core || "rgba(234,240,255,0.08)";
      gfx.lineWidth = 2;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();
      gfx.restore();

      // Flow-field lane energy ribbons
      const ribbonCount = perf < 0.7 ? 6 : 10;
      for (let i = 0; i < ribbonCount; i++) {
        const prog = (t * 0.22 + i / ribbonCount) % 1;
        const d = this.totalLen * prog;
        const p = this.posAt(d);
        const dx = Math.cos(p.ang);
        const dy = Math.sin(p.ang);
        const len = 26 + (i % 4) * 6;
        gfx.save();
        gfx.globalAlpha = 0.22;
        gfx.strokeStyle = i % 2 ? (this.env.accent || "rgba(98,242,255,0.75)") : (this.env.accent2 || "rgba(154,108,255,0.65)");
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.moveTo(p.x - dx * len, p.y - dy * len);
        gfx.lineTo(p.x + dx * len, p.y + dy * len);
        gfx.stroke();
        gfx.restore();
      }

      // traveling track streaks (aligned to path)
      const streakCount = perf < 0.7 ? 1 : 2;
      for (let r = 0; r < streakCount; r++) {
        const prog = (t * 0.16 + r / streakCount) % 1;
        const d = this.totalLen * prog;
        const p = this.posAt(d);
        const dx = Math.cos(p.ang);
        const dy = Math.sin(p.ang);
        const len = 70;
        gfx.save();
        gfx.globalAlpha = 0.35;
        const gx1 = p.x - dx * len;
        const gy1 = p.y - dy * len;
        const gx2 = p.x + dx * len;
        const gy2 = p.y + dy * len;
        const grad = gfx.createLinearGradient(gx1, gy1, gx2, gy2);
        grad.addColorStop(0, "rgba(154,108,255,0)");
        grad.addColorStop(0.5, this.env.accent2 ? `${this.env.accent2}B3` : "rgba(154,108,255,0.7)");
        grad.addColorStop(1, "rgba(154,108,255,0)");
        gfx.strokeStyle = grad;
        gfx.lineWidth = 3;
        gfx.beginPath();
        gfx.moveTo(gx1, gy1);
        gfx.lineTo(gx2, gy2);
        gfx.stroke();
        gfx.restore();
      }

      // Core at end
      const end = pts[pts.length - 1];
      const coreX = end[0], coreY = end[1];
      gfx.save();
      const tCore = performance.now() * 0.001;
      const r = 18 + 2.5 * Math.sin(tCore * 2.3);
      // halo
      gfx.globalAlpha = 0.85;
      const grad = gfx.createRadialGradient(coreX, coreY, 0, coreX, coreY, 70);
      grad.addColorStop(0, "rgba(98,242,255,0.45)");
      grad.addColorStop(0.4, "rgba(154,108,255,0.22)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      gfx.fillStyle = grad;
      gfx.beginPath(); gfx.arc(coreX, coreY, 70, 0, Math.PI * 2); gfx.fill();

      // core
      gfx.fillStyle = "rgba(234,240,255,0.14)";
      gfx.strokeStyle = "rgba(98,242,255,0.55)";
      gfx.lineWidth = 2;
      gfx.beginPath(); gfx.arc(coreX, coreY, r, 0, Math.PI * 2); gfx.fill(); gfx.stroke();

      gfx.strokeStyle = "rgba(154,108,255,0.45)";
      gfx.beginPath(); gfx.arc(coreX, coreY, r + 8, 0, Math.PI * 2); gfx.stroke();

      // gravity well swirl lines
      gfx.globalAlpha = 0.35;
      for (let i = 0; i < 3; i++) {
        const ang = tCore * 0.6 + i * 2.1;
        const rr = 26 + i * 8;
        gfx.strokeStyle = "rgba(98,242,255,0.25)";
        gfx.lineWidth = 1.5;
        gfx.beginPath();
        gfx.ellipse(coreX, coreY, rr * 1.4, rr * 0.85, ang, 0, Math.PI * 2);
        gfx.stroke();
      }
      gfx.restore();

      // Start arrow (spawn direction)
      if (pts.length >= 2) {
        const sx = pts[0][0];
        const sy = pts[0][1];
        const nx = pts[1][0];
        const ny = pts[1][1];
        const ang = Math.atan2(ny - sy, nx - sx);
        const tArrow = performance.now() * 0.001;
        const pulse = 0.6 + 0.4 * Math.sin(tArrow * 2.2);
        gfx.save();
        gfx.translate(sx, sy);
        gfx.rotate(ang);
        gfx.globalAlpha = 0.7 + 0.2 * pulse;
        gfx.fillStyle = this.env.accent || "rgba(98,242,255,0.9)";
        gfx.strokeStyle = this.env.accent2 || "rgba(154,108,255,0.9)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.moveTo(12, 0);
        gfx.lineTo(-8, -7);
        gfx.lineTo(-8, 7);
        gfx.closePath();
        gfx.fill();
        gfx.stroke();
        gfx.restore();
      }
    }
  }

  /**********************
   * Enemy definitions
   **********************/
  const DAMAGE = {
    PHYS: "Physical",
    ENGY: "Energy",
    CHEM: "Chemical",
    TRUE: "True",
  };

  const ANOMALIES = {
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

  const ENEMY_TYPES = {
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
  function applyDamageToEnemy(enemy, amount, dmgType) {
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

  class Enemy {
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
        if (dealt > 0) {
          const dmgText = Math.max(1, Math.floor(dealt));
          game.spawnText(this.x, this.y - 8, `-${dmgText}`, "rgba(109,255,154,0.95)", 0.8);
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
      // impact particles
      game.particles.spawn(this.x, this.y, 2 + Math.floor(amount / 10), "hit", this.tint);
      const dmgText = Math.max(1, Math.floor(dealt || amount));
      const dmgCol = dmgType === DAMAGE.ENGY ? "rgba(154,108,255,0.95)" :
        dmgType === DAMAGE.CHEM ? "rgba(109,255,154,0.95)" :
        dmgType === DAMAGE.TRUE ? "rgba(255,207,91,0.95)" :
        "rgba(234,240,255,0.95)";
      game.spawnText(this.x, this.y - 10, `-${dmgText}`, dmgCol, 0.9);
      game.explosions.push({
        x: this.x,
        y: this.y,
        r: 6,
        t: 0.16,
        dur: 0.16,
        max: 22,
        col: this.tint || "rgba(234,240,255,0.6)",
        boom: false
      });
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
      gfx.globalAlpha = selected ? 0.98 : 0.82;
      gfx.fillStyle = "rgba(234,240,255,0.9)";
      gfx.font = "11px var(--mono), monospace";
      gfx.textAlign = "right";
      gfx.textBaseline = "middle";
      const hpText = `${Math.max(0, Math.ceil(this.hp))}`;
      gfx.fillText(hpText, x - barW / 2 - 6, y - this.r - 13);

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

  /**********************
   * Projectiles + particles
   **********************/
  class Particles {
    constructor() { this.list = []; }
    spawn(x, y, n, kind, tint) {
      for (let i = 0; i < n; i++) {
        const p = {
          x, y,
          vx: rand(-80, 80),
          vy: rand(-80, 80),
          r: rand(1.2, 3.0),
          t: rand(0.20, 0.60),
          kind,
          tint: tint || null
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
        this.list.push({
          x, y,
          vx: jitterX * vlen,
          vy: jitterY * vlen,
          r: rand(1.2, 3.2),
          t: rand(0.22, 0.65),
          kind,
          tint: tint || null
        });
      }
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.t -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= (1 - dt * 3.5);
        p.vy *= (1 - dt * 3.5);
        if (p.t <= 0) this.list.splice(i, 1);
      }
    }
    draw(gfx) {
      gfx.save();
      for (const p of this.list) {
        const a = clamp(p.t / 0.6, 0, 1);
        if (p.kind === "hit") {
          gfx.globalAlpha = a * 0.75;
          gfx.fillStyle = p.tint || "rgba(234,240,255,0.8)";
        } else if (p.kind === "shard") {
          gfx.globalAlpha = a * 0.85;
          gfx.fillStyle = p.tint || "rgba(154,108,255,0.9)";
        } else if (p.kind === "chem") {
          gfx.globalAlpha = a * 0.55;
          gfx.fillStyle = "rgba(109,255,154,0.7)";
        } else if (p.kind === "muzzle") {
          gfx.globalAlpha = a * 0.65;
          gfx.fillStyle = "rgba(98,242,255,0.85)";
        } else if (p.kind === "boom") {
          gfx.globalAlpha = a * 0.65;
          gfx.fillStyle = "rgba(255,207,91,0.85)";
        } else {
          gfx.globalAlpha = a * 0.5;
          gfx.fillStyle = "rgba(234,240,255,0.55)";
        }
        gfx.beginPath();
        gfx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        gfx.fill();
      }
      gfx.restore();
    }
  }

  class Projectile {
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
          this._trailT = 0.02;
          game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "muzzle", "rgba(98,242,255,0.65)");
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
          game.particles.spawnDirectional(this.x, this.y, 4, dirX, dirY, "hit", "rgba(234,240,255,0.65)");
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

      gfx.fillStyle = col;
      gfx.beginPath(); gfx.arc(this.x, this.y, this.r, 0, Math.PI * 2); gfx.fill();

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

  /**********************
   * Turrets
   **********************/
  const TURRET_TYPES = {
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

  class Turret {
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
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
      if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 5.0);
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
            game.particles.spawn(this.x, this.y, 16, "muzzle");
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
              target = game.enemies.find(e => e._id === this.targetId && e.hp > 0);
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
              game.projectiles.push(p);
              game.particles.spawn(this.x + ox, this.y + oy, 2, "muzzle");
              game.audio.playLimited("drone", 160);
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
            game.audio.playLimited("trap", 220);
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

        const dmgBase = this.dmg * buff.dmgMul * skip.dmgMul * pulseDmgMul;
        const dmgType = this.dmgType;

        // Fire behavior by turret type
        switch (this.typeKey) {
          case "PULSE":
          case "VENOM":
          case "NEEDLE": {
            game.audio.playLimited("shot", 120);
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
            game.audio.playLimited("shot", 160);
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
                t: 0.12
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
            game.audio.playLimited("shot", 180);
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
            game.cones.push({ x: this.x, y: this.y, ang: this.aimAng, cone: this.cone, r: this.range, t: 0.10 });
            break;
          }

          case "LENS": {
            game.audio.playLimited("beam", 110);
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
            game.audio.playLimited("mortar", 240);
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

  /**********************
   * Game
   **********************/
  class Game {
    constructor() {
      this.levelIndex = 1;
      this.mapSeed = this._makeSeed();
      this.envId = (Math.random() * ENV_PRESETS.length) | 0;
      this.mapData = generateMap(this.mapSeed, this.envId);
      this.map = new Map(this.mapData);
      this.particles = new Particles();
      this.audio = new AudioSystem();
      this.explosions = [];
      this.shakeT = 0;
      this.shakeMag = 0;
      this.damageFlash = 0;
      this.corePulseT = 0;
      this.floatText = [];
      this.decals = [];
      this.turrets = [];
      this.enemies = [];
      this.selectedEnemy = null;
      this.projectiles = [];
      this.traps = [];
      this.beams = [];
      this.arcs = [];
      this.cones = [];
      this.lingering = [];
      this.floatText = [];
      this.decals = [];

      this.speed = 1;
      this.zoom = 1;
      this.cam = { x: 0, y: 0 };
      this.dragging = false;
      this.dragMoved = false;
      this.dragStart = { x: 0, y: 0 };
      this.camStart = { x: 0, y: 0 };
      this.gold = this._getStartGold();
      this.lives = START_LIVES;
      this.wave = 0;
      this.waveMax = 16;
      this.hasStarted = false;
      this.waveActive = false;
      this.intermission = 0;
      this.skipBuff = { dmgMul: 1, rateMul: 1, t: 0 };
      this.abilities = {
        scan: { cd: ABILITY_COOLDOWN, t: 0 },
        pulse: { cd: ABILITY_COOLDOWN, t: 0 },
        overcharge: { cd: OVERCHARGE_COOLDOWN, t: 0 }
      };
      this.gameOver = false;
      this.gameWon = false;
      this.paused = false;
      this._gameOverPrompted = false;
      if (pauseBtn) pauseBtn.textContent = "PAUSE";

      this.spawnQueue = [];
      this.spawnIndex = 0;
      this.spawnT = 0;
      this.waveScalar = { hp: 1, spd: 1, armor: 0, shield: 1, regen: 1, reward: 1 };
      this._saveT = 0;
      this.skipBuff = { dmgMul: 1, rateMul: 1, t: 0 };
      this.waveAnomaly = null;
      this._warpRippleT = 0;
      this.pendingIntermission = INTERMISSION_SECS;
      this.statsOpen = false;
      this.statsMode = null;
      this.corePulseT = 0;
      this.waveStats = this._newWaveStats(0);
      this.runStats = this._newRunStats();
      this.mapStats = [];
      this.playerStats = this._newPlayerStats();
      this.abilities = {
        scan: { cd: ABILITY_COOLDOWN, t: 0 },
        pulse: { cd: ABILITY_COOLDOWN, t: 0 },
        overcharge: { cd: OVERCHARGE_COOLDOWN, t: 0 }
      };
      this.globalOverchargeT = 0;
      this._transitioning = false;

      this.buildKey = null;
      this.selectedTurret = null;
      this.selectedEnemy = null;
      this.hoverCell = null;
      this.mouse = { x: 0, y: 0 };
      this._id = 1;
      this.collapseEnabled = false;
      this.panelHold = { left: 0, right: 0 };
      this.panelHover = { left: false, right: false };

      this.audio.loadPref();
      this.applyEnvironment(this.mapData?.env || ENV_PRESETS[this.envId]);
      this._load();
      this._bindUI();
      this._buildList();
      this.updateHUD();
    }

    _makeSeed() {
      return (Math.random() * 1000000) | 0;
    }

    applyEnvironment(env) {
      const theme = env || ENV_PRESETS[0];
      const root = document.documentElement;
      root.style.setProperty("--bg0", theme.bg0);
      root.style.setProperty("--bg1", theme.bg1);
      root.style.setProperty("--glow1", theme.glow1 || "rgba(98,242,255,0.12)");
      root.style.setProperty("--glow2", theme.glow2 || "rgba(154,108,255,0.12)");
      root.style.setProperty("--accent", theme.accent || "#62F2FF");
      root.style.setProperty("--accent2", theme.accent2 || "#9A6CFF");
    }

    loadGeneratedMap(mapData) {
      if (!mapData) return;
      this.mapData = mapData;
      this.mapSeed = mapData.seed;
      this.envId = mapData.envId;
      this.map.loadGeneratedMap(mapData);
      this.applyEnvironment(mapData.env || ENV_PRESETS[mapData.envId || 0]);
    }

    _showLevelOverlay(text) {
      if (!levelOverlay) return;
      if (levelOverlayText) levelOverlayText.textContent = text;
      levelOverlay.classList.add("show");
      levelOverlay.classList.remove("hidden");
      levelOverlay.setAttribute("aria-hidden", "false");
    }

    _hideLevelOverlay() {
      if (!levelOverlay) return;
      levelOverlay.classList.remove("show");
      levelOverlay.setAttribute("aria-hidden", "true");
      setTimeout(() => levelOverlay.classList.add("hidden"), 480);
    }

    advanceLevel() {
      if (this._transitioning) return;
      this._transitioning = true;
      if (this.runStats) {
        this.mapStats = this.mapStats || [];
        const snap = this._snapshotRunStats();
        this.mapStats.push(snap);
        this.playerStats = this.playerStats || this._newPlayerStats();
        this.playerStats.mapsCleared += 1;
      }
      const nextLevel = this.levelIndex + 1;
      const nextSeed = this._makeSeed();
      const nextEnvId = (Math.random() * ENV_PRESETS.length) | 0;
      const nextMap = generateMap(nextSeed, nextEnvId);
      this._showLevelOverlay("LEVEL CLEARED");

      setTimeout(() => {
        this.levelIndex = nextLevel;
        this.loadGeneratedMap(nextMap);
        this._resetRun();
        this._showLevelOverlay(`LEVEL ${this.levelIndex}`);
        this.updateHUD();
        this._save();
      }, 700);

      setTimeout(() => {
        this._hideLevelOverlay();
        this._transitioning = false;
      }, 1800);
    }

    _bindUI() {
      startBtn.addEventListener("click", () => {
        if (this.gameOver || this.gameWon) return;
        if (this.isPaused()) return;
        this.audio.unlock();
        if (this.statsOpen) return;
        if (!this.hasStarted) {
          this.hasStarted = true;
          this.startWave();
          this.audio.play("wave");
          this._save();
          return;
        }
        if (!this.waveActive && this.intermission > 0) {
          this._applySkipReward(this.intermission);
          this.intermission = 0;
        }
        this.startWave();
        this.audio.play("skip");
        this._save();
      });
      startBtn.addEventListener("pointerenter", (ev) => {
        if (!startBtn || startBtn.disabled) return;
        const msg = this.hasStarted
          ? "Skip for gold bonus and -15s ability cooldowns"
          : "Start wave";
        showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
      });
      startBtn.addEventListener("pointermove", (ev) => {
        if (!startBtn || startBtn.disabled) return;
        const msg = this.hasStarted
          ? "Skip for gold bonus and -15s ability cooldowns"
          : "Start wave";
        showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
      });
      startBtn.addEventListener("pointerleave", () => hideTooltip());

      abilityScanBtn?.addEventListener("click", () => this.useAbility("scan"));
      abilityPulseBtn?.addEventListener("click", () => this.useAbility("pulse"));
      abilityOverBtn?.addEventListener("click", () => this.useAbility("overcharge"));
      const abilityBtns = [abilityScanBtn, abilityPulseBtn, abilityOverBtn].filter(Boolean);
      abilityBtns.forEach((btn) => {
        btn.addEventListener("pointerenter", (ev) => {
          const msg = btn.dataset.tooltip || btn.title;
          if (!msg) return;
          showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
        });
        btn.addEventListener("pointermove", (ev) => {
          const msg = btn.dataset.tooltip || btn.title;
          if (!msg) return;
          showTooltip(msg, ev.clientX + 12, ev.clientY + 12);
        });
        btn.addEventListener("pointerleave", () => hideTooltip());
      });

      pauseBtn?.addEventListener("click", () => this.togglePause());

      musicVol?.addEventListener("input", () => {
        const v = Number(musicVol.value || "0") / 100;
        this.audio.setMusicVolume(v);
      });
      sfxVol?.addEventListener("input", () => {
        const v = Number(sfxVol.value || "0") / 100;
        this.audio.setSfxVolume(v);
      });

      if (musicVol) musicVol.value = String(Math.round(this.audio.bgm.volume * 100));
      if (sfxVol) sfxVol.value = String(Math.round(this.audio.sfxVol * 100));

      resetBtn?.addEventListener("click", () => {
        showConfirm("Reset Game", "Reset the game? This will clear your saved progress.", () => {
          try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
          window.location.reload();
        });
      });
      settingsResetBtn?.addEventListener("click", () => {
        showConfirm("Reset Game", "Reset the game? This will clear your saved progress.", () => {
          try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
          window.location.reload();
        });
      });

      audioBtn?.addEventListener("click", () => this.audio.toggle());

      modalCancel?.addEventListener("click", () => closeConfirm());
      modalConfirm?.addEventListener("click", () => {
        const cb = _modalOnConfirm;
        closeConfirm();
        if (cb) cb();
      });
      confirmModal?.addEventListener("click", (ev) => {
        if (ev.target === confirmModal) closeConfirm();
      });

      helpBtn?.addEventListener("click", () => {
        overlay?.classList.remove("hidden");
        overlay?.setAttribute("aria-hidden", "false");
      });
      closeHelp?.addEventListener("click", () => {
        overlay?.classList.add("hidden");
        overlay?.setAttribute("aria-hidden", "true");
      });

      if (speedBtn) {
        speedBtn.addEventListener("click", () => {
          const levels = [1, 2, 3, 4];
          const idx = levels.indexOf(this.speed);
          const next = levels[(idx + 1) % levels.length];
          this.speed = clamp(next, 1, 4);
          speedBtn.textContent = `SPEED: ${this.speed}×`;
        });
        speedBtn.textContent = `SPEED: ${this.speed}×`;
      }

      settingsBtn?.addEventListener("click", () => {
        settingsModal?.classList.remove("hidden");
        settingsModal?.setAttribute("aria-hidden", "false");
      });
      settingsClose?.addEventListener("click", () => {
        settingsModal?.classList.add("hidden");
        settingsModal?.setAttribute("aria-hidden", "true");
      });
      settingsModal?.addEventListener("click", (ev) => {
        if (ev.target === settingsModal) {
          settingsModal.classList.add("hidden");
          settingsModal.setAttribute("aria-hidden", "true");
        }
      });

      document.addEventListener("pointerover", (ev) => {
        const btn = ev.target.closest("button");
        if (btn && !btn.disabled) {
          const from = ev.relatedTarget;
          if (from && (from === btn || btn.contains(from))) return;
          this.audio?.playLimited("hover", 80);
          return;
        }
        const buildItem = ev.target.closest(".buildItem");
        if (!buildItem || buildItem.classList.contains("locked")) return;
        const from = ev.relatedTarget;
        if (from && (from === buildItem || buildItem.contains(from))) return;
        this.audio?.playLimited("hover", 80);
      });
      document.addEventListener("click", (ev) => {
        const btn = ev.target.closest("button");
        if (btn) {
          if (btn.disabled) return;
          this.audio?.playLimited("click", 80);
          return;
        }
        const buildItem = ev.target.closest(".buildItem");
        if (!buildItem || buildItem.classList.contains("locked")) return;
        this.audio?.playLimited("click", 80);
      });

      waveStatsContinue?.addEventListener("click", () => this._closeWaveStats("continue"));
      waveStatsControls?.addEventListener("click", () => {
        controlsModal?.classList.remove("hidden");
        controlsModal?.setAttribute("aria-hidden", "false");
      });
      waveStatsSkip?.addEventListener("click", () => this._closeWaveStats("skip"));
      waveStatsModal?.addEventListener("click", (ev) => {
        if (ev.target === waveStatsModal) this._closeWaveStats("continue");
      });
      controlsClose?.addEventListener("click", () => {
        controlsModal?.classList.add("hidden");
        controlsModal?.setAttribute("aria-hidden", "true");
      });
      controlsModal?.addEventListener("click", (ev) => {
        if (ev.target === controlsModal) {
          controlsModal.classList.add("hidden");
          controlsModal.setAttribute("aria-hidden", "true");
        }
      });

      sellBtn.addEventListener("click", () => this.sellSelected());

      canvas.addEventListener("mousemove", (ev) => {
        const rect = canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        if (this.dragging) {
          const dx = sx - this.dragStart.x;
          const dy = sy - this.dragStart.y;
          if (!this.dragMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            this.dragMoved = true;
          }
          this.cam.x = this.camStart.x - dx / this.zoom;
          this.cam.y = this.camStart.y - dy / this.zoom;
        }
        const wp = this.screenToWorld(sx, sy);
        this.mouse.x = wp.x;
        this.mouse.y = wp.y;
        this.hoverCell = this.map.cellAt(this.mouse.x, this.mouse.y);
        let hoveredTurret = null;
        for (const t of this.turrets) {
          if (dist2(this.mouse.x, this.mouse.y, t.x, t.y) <= 18 * 18) {
            hoveredTurret = t;
            break;
          }
        }
        if (hoveredTurret) {
          const dps = hoveredTurret.fire > 0 ? (hoveredTurret.dmg / hoveredTurret.fire) : hoveredTurret.dmg * 12;
          const active = [];
          if (hoveredTurret.pulseBoostT > 0) active.push("Pulse Burst");
          if (this.globalOverchargeT > 0) active.push("Overcharge");
          if (hoveredTurret.boosted) active.push("Power Tile");
          const activeTxt = active.length ? ` | Active: ${active.join(", ")}` : "";
          const tip = `${hoveredTurret.name} Lv ${hoveredTurret.level} | DMG ${hoveredTurret.dmg.toFixed(1)} | Fire ${hoveredTurret.fire.toFixed(2)}s | Range ${hoveredTurret.range.toFixed(0)} | DPS ${dps.toFixed(1)}${activeTxt}`;
          showTooltip(tip, ev.clientX + 12, ev.clientY + 12);
        } else if (this.hoverCell && this.hoverCell.v === 3) {
          showTooltip("Power Tile: +25% damage, +15% range", ev.clientX + 12, ev.clientY + 12);
        } else {
          hideTooltip();
        }
      });

      canvas.addEventListener("click", (ev) => {
        if (this.dragging || this.dragMoved) return;
        if (overlay && !overlay.classList.contains("hidden")) return;
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        this.audio.unlock();
        hideTooltip();
        const rect = canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        const wp = this.screenToWorld(sx, sy);
        const x = wp.x;
        const y = wp.y;
        this.onClick(x, y);
      });
      canvas.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        if (overlay && !overlay.classList.contains("hidden")) return;
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        if (this.dragging || this.dragMoved) return;
        hideTooltip();
        this.clearBuildMode();
        this.selectTurret(null);
        this.collapseEnabled = true;
      });
      canvas.addEventListener("mousedown", (ev) => {
        if (ev.button !== 0 && ev.button !== 2) return;
        if (this.isUiBlocked()) return;
        const rect = canvas.getBoundingClientRect();
        this.dragging = true;
        this.dragMoved = false;
        this.dragButton = ev.button;
        this.dragStart.x = ev.clientX - rect.left;
        this.dragStart.y = ev.clientY - rect.top;
        this.camStart.x = this.cam.x;
        this.camStart.y = this.cam.y;
      });
      window.addEventListener("mouseup", () => {
        this.dragging = false;
        this.dragMoved = false;
        this.dragButton = null;
      });

      window.addEventListener("pointerdown", () => this.audio.unlock(), { once: true });
      canvas.addEventListener("mouseleave", () => hideTooltip());

      canvas.addEventListener("wheel", (ev) => {
        if (this.isUiBlocked()) return;
        ev.preventDefault();
        const delta = Math.sign(ev.deltaY);
        const next = this.zoom + (delta > 0 ? -0.1 : 0.1);
        this.zoom = clamp(next, 0.75, 1.5);
      }, { passive: false });

      document.querySelectorAll(".panelBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const panelKey = btn.dataset.panel;
          const action = btn.dataset.action;
          const panel = panelKey === "left" ? leftPanel : rightPanel;
          if (!panel) return;
          if (action === "pin") {
            const pinned = panel.classList.toggle("pinned");
            btn.setAttribute("aria-pressed", pinned ? "true" : "false");
            if (pinned) {
              panel.classList.remove("collapsed");
            } else {
              // when unpinned, collapse if not in use
              if (panelKey === "left") panel.classList.toggle("collapsed", !this.buildKey);
              if (panelKey === "right") panel.classList.toggle("collapsed", !this.selectedTurret);
            }
          }
        });
      });
      // sync pin button state on load
      document.querySelectorAll(".pinBtn").forEach(btn => {
        const panelKey = btn.dataset.panel;
        const panel = panelKey === "left" ? leftPanel : rightPanel;
        if (!panel) return;
        btn.setAttribute("aria-pressed", panel.classList.contains("pinned") ? "true" : "false");
      });

      const holdPanel = (key, seconds = 1.2) => {
        if (!this.panelHold) return;
        this.panelHold[key] = Math.max(this.panelHold[key] || 0, seconds);
      };
      const collapseIfIdle = (panel, key, inUse) => {
        if (!panel || panel.classList.contains("pinned")) return;
        if (this.panelHover?.[key]) return;
        if (this.panelHold[key] > 0) return;
        panel.classList.toggle("collapsed", !inUse);
      };
      const bindPanelHover = (panel, key) => {
        if (!panel) return;
        panel.addEventListener("mouseenter", () => {
          if (this.panelHover) this.panelHover[key] = true;
          holdPanel(key, 1.5);
          if (!panel.classList.contains("pinned")) panel.classList.remove("collapsed");
        });
        panel.addEventListener("mouseleave", () => {
          if (this.panelHover) this.panelHover[key] = false;
          holdPanel(key, 0.2);
          setTimeout(() => {
            const inUse = key === "left" ? !!this.buildKey : !!this.selectedTurret;
            collapseIfIdle(panel, key, inUse);
          }, 220);
        });
        panel.addEventListener("wheel", () => holdPanel(key, 1.5), { passive: true });
        panel.addEventListener("pointerdown", () => holdPanel(key, 1.5));
      };
      bindPanelHover(leftPanel, "left");
      bindPanelHover(rightPanel, "right");

      // First load tooltip
      if (!localStorage.getItem("orbit_echo_tip_v1")) {
        toast("Tip: Place a turret, then press START. Pin panels to keep them open.");
        localStorage.setItem("orbit_echo_tip_v1", "1");
      }

      window.addEventListener("keydown", (ev) => {
        if (_modalOpen && ev.key === "Escape") {
          closeConfirm();
          return;
        }
        if (this.gameOver || this.gameWon) return;
        if (this.statsOpen) {
          if (this.statsMode === "pause") {
            if (ev.key === "Enter" || ev.key === " " || ev.key === "Escape") {
              this._closeWaveStats("pause");
            }
          } else {
            if (ev.key === "Enter" || ev.key === " ") this._closeWaveStats("continue");
            if (ev.key.toLowerCase() === "s") this._closeWaveStats("skip");
            if (ev.key === "Escape") this._closeWaveStats("continue");
          }
          return;
        }
        if (this.isPaused()) return;
        if (ev.repeat) return;
        if (ev.key === "Escape" && this.buildKey) {
          this.clearBuildMode();
          return;
        }
        if (ev.key === "1") this.useAbility("scan");
        if (ev.key === "2") this.useAbility("pulse");
        if (ev.key === "3") this.useAbility("overcharge");
      });
    }

    isUiBlocked() {
      const overlayOpen = overlay && !overlay.classList.contains("hidden");
      const settingsOpen = settingsModal && !settingsModal.classList.contains("hidden");
      return overlayOpen || settingsOpen || this.statsOpen || this._transitioning;
    }

    isPaused() {
      return this.paused || this.isUiBlocked();
    }

    screenToWorld(x, y) {
      const zx = (x - W * 0.5) / this.zoom + W * 0.5 + this.cam.x;
      const zy = (y - H * 0.5) / this.zoom + H * 0.5 + this.cam.y;
      return { x: zx, y: zy };
    }

    _canSkipIntermission() {
      return this.hasStarted && !this.waveActive && this.intermission > 0 && !this.isPaused();
    }

    _newWaveStats(wave) {
      return { wave, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, dmgByType: {} };
    }

    _newRunStats() {
      return { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0, dmgByType: {} };
    }

    _newPlayerStats() {
      return { mapsCleared: 0, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0 };
    }

    _getStartGold() {
      return START_GOLD + Math.max(0, this.levelIndex - 1) * START_GOLD_PER_LEVEL;
    }

    _snapshotRunStats() {
      const src = this.runStats || this._newRunStats();
      return {
        level: this.levelIndex,
        wave: this.wave,
        kills: src.kills,
        leaks: src.leaks,
        gold: src.gold,
        towersBuilt: src.towersBuilt,
        bosses: src.bosses,
        dmgByType: { ...src.dmgByType }
      };
    }

    _resetWaveStats() {
      this.waveStats = this._newWaveStats(this.wave);
    }

    _reconcilePlayerStats() {
      this.playerStats = this.playerStats || this._newPlayerStats();
      const history = this.mapStats || [];
      if (!history.length) return;
      const totals = history.reduce((acc, h) => {
        acc.kills += h.kills || 0;
        acc.leaks += h.leaks || 0;
        acc.gold += h.gold || 0;
        acc.towersBuilt += h.towersBuilt || 0;
        acc.bosses += h.bosses || 0;
        return acc;
      }, { kills: 0, leaks: 0, gold: 0, towersBuilt: 0, bosses: 0 });
      this.playerStats.mapsCleared = Math.max(this.playerStats.mapsCleared || 0, history.length);
      this.playerStats.kills = Math.max(this.playerStats.kills || 0, totals.kills);
      this.playerStats.leaks = Math.max(this.playerStats.leaks || 0, totals.leaks);
      this.playerStats.gold = Math.max(this.playerStats.gold || 0, totals.gold);
      this.playerStats.towersBuilt = Math.max(this.playerStats.towersBuilt || 0, totals.towersBuilt);
      this.playerStats.bosses = Math.max(this.playerStats.bosses || 0, totals.bosses);
    }

    recordDamage(sourceKey, amount) {
      if (!sourceKey || !this.waveStats || !this.waveStats.dmgByType) return;
      const key = String(sourceKey);
      this.waveStats.dmgByType[key] = (this.waveStats.dmgByType[key] || 0) + amount;
      if (this.runStats && this.runStats.dmgByType) {
        this.runStats.dmgByType[key] = (this.runStats.dmgByType[key] || 0) + amount;
      }
    }

    getUnlockWave(key) {
      return TOWER_UNLOCKS[key] || 1;
    }

    isTowerUnlocked(key) {
      const wave = Math.max(1, this.wave || 1);
      return wave >= this.getUnlockWave(key);
    }

    setBuildMode(key) {
      this.buildKey = key;
      this.collapseEnabled = true;
      [...buildList.querySelectorAll(".buildItem")].forEach(el => el.classList.remove("selected"));
      const item = buildList.querySelector(`.buildItem[data-key="${key}"]`);
      if (item) item.classList.add("selected");
    }

    clearBuildMode() {
      this.buildKey = null;
      [...buildList.querySelectorAll(".buildItem")].forEach(el => el.classList.remove("selected"));
    }

    _refreshBuildList() {
      if (!buildList) return;
      buildList.querySelectorAll(".buildItem").forEach(item => {
        const key = item.dataset.key;
        const unlockWave = Number(item.dataset.unlock || "1");
        const unlocked = this.isTowerUnlocked(key);
        const cost = TURRET_TYPES[key]?.cost || 0;
        const affordable = this.gold >= cost;
        item.classList.toggle("locked", !unlocked);
        item.classList.toggle("poor", unlocked && !affordable);
        const lockTag = item.querySelector(".lockTag");
        if (lockTag) {
          lockTag.textContent = `Unlocks at Wave ${unlockWave}`;
          lockTag.style.display = unlocked ? "none" : "block";
        }
      });
    }

    _openWaveStats(mode = "pause") {
      if (this.statsOpen) return;
      this.statsOpen = true;
      this.statsMode = mode;
      if (mode === "wave") {
        this.pendingIntermission = INTERMISSION_SECS;
      }

      this._reconcilePlayerStats();
      const stats = mode === "pause"
        ? (this.runStats || this._newRunStats())
        : (this.waveStats || this._newWaveStats(this.wave));
      const waveLabel = mode === "pause" ? this.wave : stats.wave;
      const history = (this.mapStats || []).slice().reverse();
      const historyLines = history.length
        ? history.map(h => `<div class="tiny">Level ${h.level}: K ${h.kills} · L ${h.leaks} · G ${fmt(h.gold)} · B ${h.bosses}</div>`).join("")
        : `<div class="tiny">No completed maps yet.</div>`;
      const p = this.playerStats || this._newPlayerStats();
      const playerLines = [
        `<div class="tiny">Maps Cleared: ${p.mapsCleared}</div>`,
        `<div class="tiny">Total Kills: ${p.kills}</div>`,
        `<div class="tiny">Total Leaks: ${p.leaks}</div>`,
        `<div class="tiny">Total Gold: ${fmt(p.gold)}</div>`,
        `<div class="tiny">Towers Built: ${p.towersBuilt}</div>`,
        `<div class="tiny">Bosses Defeated: ${p.bosses}</div>`
      ].join("");
      const dmgEntries = Object.entries(stats.dmgByType || {})
        .map(([k, v]) => ({ k, v }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 6);
      const dmgLines = dmgEntries.length
        ? dmgEntries.map(d => `<div class="tiny">${d.k}: ${fmt(d.v)}</div>`).join("")
        : `<div class="tiny">No damage data.</div>`;

      const banner = mode === "pause" ? `<div class="pauseBanner">Pause</div>` : "";
      if (waveStatsBody) {
        waveStatsBody.innerHTML = `
          ${banner}
          <div class="statsGrid">
            <div class="statsRow"><div class="k">Wave</div><div class="v">${waveLabel}</div></div>
            <div class="statsRow"><div class="k">Level</div><div class="v">${this.levelIndex}</div></div>
            <div class="statsRow"><div class="k">Kills</div><div class="v">${stats.kills}</div></div>
            <div class="statsRow"><div class="k">Bosses Defeated</div><div class="v">${stats.bosses || 0}</div></div>
            <div class="statsRow"><div class="k">Leaks</div><div class="v">${stats.leaks}</div></div>
            <div class="statsRow"><div class="k">Gold Earned</div><div class="v">${fmt(stats.gold)}</div></div>
            <div class="statsRow"><div class="k">Towers Built</div><div class="v">${stats.towersBuilt}</div></div>
          </div>
          <div class="statsRow">
            <div class="k">Damage By Tower</div>
            <div class="v">${dmgLines}</div>
          </div>
          ${mode === "pause" ? `
          <div class="statsRow">
            <div class="k">Map History</div>
            <div class="v">${historyLines}</div>
          </div>
          <div class="statsRow">
            <div class="k">Player Stats</div>
            <div class="v">${playerLines}</div>
          </div>
          ` : ""}
        `;
      }
      if (waveStatsTitle) {
        waveStatsTitle.textContent = mode === "pause" ? "Game Stats" : "Wave Report";
      }
      if (waveStatsContinue) {
        waveStatsContinue.textContent = mode === "pause" ? "Resume" : "Continue";
      }
      if (waveStatsControls) {
        waveStatsControls.style.display = mode === "pause" ? "" : "none";
      }
      if (waveStatsSkip) {
        waveStatsSkip.style.display = mode === "pause" ? "none" : "";
      }
      waveStatsModal?.classList.remove("hidden");
      waveStatsModal?.setAttribute("aria-hidden", "false");
    }

    _closeWaveStats(mode) {
      if (!this.statsOpen) return;
      const statsMode = this.statsMode || mode;
      this.statsOpen = false;
      this.statsMode = null;
      waveStatsModal?.classList.add("hidden");
      waveStatsModal?.setAttribute("aria-hidden", "true");

      if (statsMode === "pause") {
        if (this.paused) {
          this.paused = false;
          if (pauseBtn) pauseBtn.textContent = "PAUSE";
          if (this.audio?.enabled) this.audio.bgm?.play().catch(() => {});
        }
        this.updateHUD();
        return;
      }

      if (mode === "skip") {
        this._applySkipReward(this.pendingIntermission);
        this.intermission = 0;
        this.startWave();
        this.audio.play("skip");
      } else {
        this.intermission = this.pendingIntermission;
      }
    }

    togglePause() {
      if (this.gameOver || this.gameWon) return;
      if (this.statsOpen && this.statsMode === "pause") {
        this._closeWaveStats("pause");
        return;
      }
      if (this.statsOpen) return;
      this.paused = !this.paused;
      if (pauseBtn) pauseBtn.textContent = this.paused ? "RESUME" : "PAUSE";
      if (this.paused) {
        if (this.audio?.bgm) this.audio.bgm.pause();
        this._openWaveStats("pause");
      } else {
        if (this.audio?.enabled) this.audio.bgm?.play().catch(() => {});
      }
      this.updateHUD();
    }

    _buildList() {
      buildList.innerHTML = "";
      for (const [key, t] of Object.entries(TURRET_TYPES)) {
        const item = document.createElement("div");
        item.className = "buildItem";
        item.dataset.key = key;
        item.dataset.unlock = String(this.getUnlockWave(key));
        item.innerHTML = `
          <div class="buildIcon" data-icon="${key}"></div>
          <div class="buildMeta">
            <div class="buildName">${t.name}</div>
            <div class="buildDesc">${t.desc}</div>
            <div class="buildCost">
              <span class="tag">${t.role}</span>
              <span>${t.cost}g</span>
            </div>
            <div class="lockTag">Unlocks at Wave ${this.getUnlockWave(key)}</div>
          </div>
        `;
        item.title = `${t.name} — ${t.cost}g`;
        item.addEventListener("click", () => {
          if (this.isPaused()) {
            toast("Cannot build while paused.");
            return;
          }
          if (!this.isTowerUnlocked(key)) return;
          if (this.gold < t.cost) {
            toast("Not enough gold.");
            return;
          }
          this.audio.unlock();
          this.setBuildMode(key);
          if (leftPanel && !leftPanel.classList.contains("pinned")) {
            this.panelHold.left = Math.max(this.panelHold.left || 0, 0.2);
            leftPanel.classList.add("collapsed");
          }
        });
        buildList.appendChild(item);
      }
      this._refreshBuildList();
    }

    updateHUD() {
      goldEl.textContent = fmt(this.gold);
      if (goldEl) {
        goldEl.style.color = this.gold < 45 ? "var(--bad)" : "var(--good)";
      }
      if (selectionBody) {
        selectionBody.querySelectorAll("button[data-mod]").forEach(btn => {
          let cost = Number(btn.dataset.cost || "0");
          if (!cost) {
            const costText = btn.closest(".modChoice")?.querySelector(".modCost")?.textContent || "";
            cost = Number(costText.replace(/[^\d.]/g, "")) || 0;
            if (cost) btn.dataset.cost = String(cost);
          }
          const affordable = this.gold >= cost;
          btn.disabled = !affordable;
          btn.classList.toggle("primary", affordable);
          const card = btn.closest(".modChoice");
          if (card) card.classList.toggle("poor", !affordable);
        });
      }
      this._refreshBuildList();
      livesEl.textContent = String(this.lives);
      if (livesEl) {
        let col;
        if (this.lives <= LIFE_RED_MAX) {
          col = LIFE_COLORS.red;
        } else if (this.lives <= LIFE_YELLOW_MAX) {
          col = LIFE_COLORS.yellow;
        } else {
          col = LIFE_COLORS.green;
        }
        livesEl.style.color = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
      }
      waveEl.textContent = String(this.wave);
      waveMaxEl.textContent = String(this.waveMax);
      if (levelValEl) levelValEl.textContent = String(this.levelIndex);
      if (envValEl) envValEl.textContent = this.map?.env?.name || "—";
      if (seedValEl) seedValEl.textContent = this.mapSeed != null ? String(this.mapSeed) : "—";

      // auto-collapse panels unless pinned (after first interaction)
      if (this.collapseEnabled) {
        // Keep panels open briefly while interacting to reduce jank.
        if (leftPanel && !leftPanel.classList.contains("pinned")) {
          if (this.panelHold.left <= 0 && !this.panelHover?.left) {
            leftPanel.classList.toggle("collapsed", !this.buildKey);
          }
        }
        if (rightPanel && !rightPanel.classList.contains("pinned")) {
          if (this.panelHold.right <= 0 && !this.panelHover?.right) {
            rightPanel.classList.toggle("collapsed", !this.selectedTurret);
          }
        }
      }

      if (this.gameWon) {
        nextInEl.textContent = "Victory";
      } else if (this.gameOver) {
        nextInEl.textContent = "Defeat";
      } else if (!this.hasStarted) {
        nextInEl.textContent = "Start";
      } else if (this.waveActive) {
        nextInEl.textContent = "In Wave";
      } else if (this.intermission > 0) {
        nextInEl.textContent = `${this.intermission.toFixed(1)}s`;
      } else {
        nextInEl.textContent = "—";
      }

      const nextPill = nextInEl?.closest(".pill");
      if (nextPill) nextPill.classList.toggle("intermissionPulse", this.intermission > 0 && !this.waveActive);

      startBtn.disabled = this.gameOver || this.gameWon || this.statsOpen || this._transitioning;
      startBtn.textContent = this.hasStarted ? "SKIP" : "START";

      if (this.abilities && abilityScanCd) {
        const scan = this.abilities.scan;
        const pulse = this.abilities.pulse;
        const over = this.abilities.overcharge;
        if (abilityScanBtn) {
          abilityScanBtn.dataset.tooltip = "EMP Pulse: Instantly destroys all enemy shields.";
          abilityScanBtn.removeAttribute("title");
        }
        if (abilityPulseBtn) {
          abilityPulseBtn.dataset.tooltip = "Pulse Burst: Select a turret to double damage and 4x fire rate for 30s. No selection = red flash.";
          abilityPulseBtn.removeAttribute("title");
        }
        if (abilityOverBtn) {
          abilityOverBtn.dataset.tooltip = "Overcharge: Boost all turret fire rates for 30s. 90s cooldown.";
          abilityOverBtn.removeAttribute("title");
        }
        const scanPct = scan.t > 0 ? clamp(scan.t / scan.cd, 0, 1) : 0;
        const pulsePct = pulse.t > 0 ? clamp(pulse.t / pulse.cd, 0, 1) : 0;
        const overPct = over.t > 0 ? clamp(over.t / over.cd, 0, 1) : 0;
        if (abilityScanBtn) {
          abilityScanBtn.style.setProperty("--cd-pct", scanPct.toFixed(3));
          abilityScanBtn.classList.toggle("ready", scan.t <= 0);
        }
        if (abilityPulseBtn) {
          abilityPulseBtn.style.setProperty("--cd-pct", pulsePct.toFixed(3));
          abilityPulseBtn.classList.toggle("ready", pulse.t <= 0);
        }
        if (abilityOverBtn) {
          abilityOverBtn.style.setProperty("--cd-pct", overPct.toFixed(3));
          abilityOverBtn.classList.toggle("ready", over.t <= 0);
        }
        abilityScanCd.textContent = scan.t > 0 ? `${scan.t.toFixed(1)}s` : "Ready";
        abilityPulseCd.textContent = pulse.t > 0 ? `${pulse.t.toFixed(1)}s` : "Ready";
        abilityOverCd.textContent = over.t > 0 ? `${over.t.toFixed(1)}s` : "Ready";
        abilityScanBtn.disabled = scan.t > 0;
        abilityPulseBtn.disabled = pulse.t > 0;
        abilityOverBtn.disabled = over.t > 0;
      }

      if (anomalyLabel) {
        if (this.waveAnomaly) {
          anomalyLabel.textContent = this.waveAnomaly.name;
          anomalyPill?.setAttribute("title", this.waveAnomaly.desc);
          anomalyPill?.classList.add("active");
        } else {
          anomalyLabel.textContent = "—";
          anomalyPill?.setAttribute("title", "Wave anomaly");
          anomalyPill?.classList.remove("active");
        }
      }
    }

    getSkipBuff() {
      if (!this.skipBuff || this.skipBuff.t <= 0) {
        return { dmgMul: 1, rateMul: 1, t: 0 };
      }
      return this.skipBuff;
    }

    getAbilityState(key) {
      return this.abilities ? this.abilities[key] : null;
    }

    spawnText(x, y, text, color = "rgba(234,240,255,0.9)", ttl = 0.9) {
      this.floatText.push({
        x,
        y,
        text,
        color,
        t: ttl,
        ttl,
        vy: 18
      });
    }

    useAbility(key) {
      const ability = this.getAbilityState(key);
      if (!ability) return;
      if (ability.t > 0) {
        toast("Ability cooling down.");
        return;
      }
      if (key === "pulse") {
        if (!this.selectedTurret) {
          flashAbilityButton(abilityPulseBtn);
          toast("Select a turret for Pulse Burst.");
          return;
        }
        if (this.globalOverchargeT > 0) {
          toast("Overcharge already active.");
          return;
        }
        if (this.selectedTurret.pulseBoostT > 0) {
          toast("Pulse Burst already active.");
          return;
        }
      }
      if (key === "overcharge") {
        if (this.globalOverchargeT > 0) {
          toast("Overcharge already active.");
          return;
        }
      }

      switch (key) {
        case "scan": {
          ability.t = ability.cd;
          let found = 0;
          let shields = 0;
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (e.shield > 0) {
              e.shield = 0;
              shields++;
              this.particles.spawn(e.x, e.y, 6, "shard", "rgba(154,108,255,0.9)");
              this.explosions.push({
                x: e.x,
                y: e.y,
                r: 12,
                t: 0.28,
                dur: 0.28,
                max: 52,
                col: "rgba(154,108,255,0.9)",
                boom: false
              });
            }
            found++;
          }
          this.explosions.push({
            x: W * 0.5,
            y: H * 0.5,
            r: 24,
            t: 0.32,
            dur: 0.32,
            max: Math.max(W, H) * 0.35,
            col: "rgba(154,108,255,0.65)",
            boom: false
          });
          this.audio.playLimited("beam", 220);
          if (found === 0) {
            toast("EMP PULSE: no enemies found");
          } else if (shields === 0) {
            toast("EMP PULSE: no shields detected");
          } else {
            toast(`EMP PULSE: ${shields} shields destroyed`);
          }
          break;
        }
        case "pulse": {
          ability.t = ability.cd;
          this.selectedTurret.pulseBoostT = 30;
          this.explosions.push({
            x: this.selectedTurret.x,
            y: this.selectedTurret.y,
            r: 12,
            t: 0.25,
            dur: 0.25,
            max: 60,
            col: "rgba(154,108,255,0.85)",
            boom: false
          });
          this.particles.spawn(this.selectedTurret.x, this.selectedTurret.y, 10, "muzzle");
          this.audio.playLimited("upgrade", 220);
          toast("PULSE BURST: turret damage x2 and fire rate x4 for 30s");
          break;
        }
        case "overcharge": {
          ability.t = ability.cd;
          this.globalOverchargeT = 30;
          this.explosions.push({
            x: W * 0.5,
            y: H * 0.5,
            r: 22,
            t: 0.3,
            dur: 0.3,
            max: Math.max(W, H) * 0.25,
            col: "rgba(255,207,91,0.8)",
            boom: false
          });
          this.particles.spawn(W * 0.5, H * 0.5, 16, "muzzle");
          this.audio.playLimited("upgrade", 220);
          toast("OVERCHARGE: all turrets fire faster for 30s");
          break;
        }
      }
      this.updateHUD();
    }

    _calcSkipReward(remaining) {
      const ratio = clamp(remaining / 15, 0, 1);
      const rateBonus = lerp(0.05, 0.25, ratio);
      const dmgBonus = lerp(0.05, 0.25, ratio);
      const duration = 8;
      const cash = Math.max(1, Math.floor(remaining * 0.9));
      return { rateBonus, dmgBonus, duration, cash };
    }

    _applySkipReward(remaining) {
      if (remaining <= 0) return;
      const reward = this._calcSkipReward(remaining);
      const cap = 1.25;
      const targetRate = Math.min(cap, 1 + reward.rateBonus);
      const targetDmg = Math.min(cap, 1 + reward.dmgBonus);
      this.skipBuff.rateMul = Math.min(cap, Math.max(this.skipBuff.rateMul, targetRate));
      this.skipBuff.dmgMul = Math.min(cap, Math.max(this.skipBuff.dmgMul, targetDmg));
      this.skipBuff.t = reward.duration;

      this.gold += reward.cash;
      this.gold += SKIP_GOLD_BONUS;
      if (this.waveStats) this.waveStats.gold += reward.cash + SKIP_GOLD_BONUS;
      if (this.runStats) this.runStats.gold += reward.cash + SKIP_GOLD_BONUS;
      if (this.playerStats) this.playerStats.gold += reward.cash + SKIP_GOLD_BONUS;
      if (this.abilities) {
        for (const a of Object.values(this.abilities)) {
          if (a.t > 0) a.t = Math.max(0, a.t - SKIP_COOLDOWN_REDUCE);
        }
      }

      const ratePct = Math.round((this.skipBuff.rateMul - 1) * 100);
      const dmgPct = Math.round((this.skipBuff.dmgMul - 1) * 100);
      toast(`SKIP BONUS: +${ratePct}% rate, +${dmgPct}% dmg for ${reward.duration}s`);
      setTimeout(() => toast(`SKIP CASHOUT: +${reward.cash + SKIP_GOLD_BONUS} gold`), 700);
    }

    onResize() {
      this.map.onResize();
      for (const t of this.turrets) {
        if (t.gx != null) {
          const w = this.map.worldFromCell(t.gx, t.gy);
          t.x = w.x; t.y = w.y;
        }
      }
    }

    _waveScalar(wave) {
      const i = wave - 1;
      const earlyHp = wave === 1 ? 0.82 : wave === 2 ? 0.92 : 1;
      const earlySpd = wave === 1 ? 0.9 : wave === 2 ? 0.96 : 1;
      const late = Math.max(0, wave - 8);
      const latePow = Math.pow(late, 1.12) * 0.016;
      const post2 = Math.max(0, wave - 2);
      const post2Boost = 1 + post2 * 0.035;
      const levelHp = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_HP_SCALE;
      const levelSpd = 1 + Math.max(0, this.levelIndex - 1) * LEVEL_SPD_SCALE;
      const levelDef = 1 + Math.max(0, this.levelIndex - 1) * 0.02;
      const levelReward = 1 + Math.max(0, this.levelIndex - 1) * 0.03;
      return {
        hp: (1 + i * 0.105 + latePow) * earlyHp * 1.35 * post2Boost * levelHp,
        spd: (1 + i * 0.013) * earlySpd * 1.05 * (1 + post2 * 0.01) * levelSpd,
        armor: (i * 0.0048 + Math.max(0, wave - 12) * 0.0035) * 1.15 * (1 + post2 * 0.012) * levelDef,
        shield: (1 + i * 0.055 + Math.max(0, wave - 12) * 0.015) * 1.08 * (1 + post2 * 0.012) * levelDef,
        regen: (1 + i * 0.035 + Math.max(0, wave - 12) * 0.015) * 1.08 * (1 + post2 * 0.008) * levelDef,
        reward: (1 + i * 0.05) * 1.15 * levelReward
      };
    }

    _getBossKey() {
      const bosses = ["FINAL_BOSS_VORTEX", "FINAL_BOSS_ABYSS", "FINAL_BOSS_IRON"];
      const seed = (this.mapSeed || 0) ^ (this.levelIndex * 9973);
      const rng = makeRNG(seed >>> 0);
      return bosses[(rng() * bosses.length) | 0];
    }

    _buildWave(wave, scalar) {
      const i = wave;
      if (wave === this.waveMax) {
        return [
          { t: 0.8, type: this._getBossKey(), scalar, miniboss: true }
        ];
      }
      const baseCount = Math.round(((wave === 1) ? 6
        : (wave === 2 ? 8
        : (wave === 3 ? 10
        : (wave === 4 ? 12
        : (10 + Math.floor(i * 1.55) + Math.max(0, i - 10) * 0.6 + Math.max(0, i - 15) * 0.85))))) * 1.2);
      const spacing = (wave === 1) ? 0.95
        : (wave === 2 ? 0.88
        : (wave === 3 ? 0.82
        : (wave === 4 ? 0.76
        : Math.max(0.22, (0.66 - i * 0.013) * 0.9))));
      const earlyCountMul = wave <= 5 ? 0.88 : 1;
      const earlySpacingMul = wave <= 5 ? 1.12 : 1;
      const spawns = [];

      const types = ["RUNNER", "BRUTE"];
      if (i >= 3) types.push("ARMORED");
      if (i >= 6) types.push("SHIELDED");
      if (i >= 7) types.push("SPLITTER");
      if (i >= 9) types.push("REGEN");
      if (i >= 11) types.push("STEALTH");
      if (i >= 13) types.push("FLYING");
      if (i >= 8) types.push("PHASE");
      if (i >= 10) types.push("SHIELD_DRONE");

      const weights = {
        RUNNER: i <= 4 ? 1.6 : 1.1,
        BRUTE: i <= 4 ? 0.7 : 0.85,
        ARMORED: i <= 7 ? 0.55 : 0.9,
        SHIELDED: i <= 9 ? 0.55 : 0.9,
        SPLITTER: 0.7,
        REGEN: 0.75,
        STEALTH: 0.65,
        FLYING: 0.7,
        PHASE: 0.6,
        SHIELD_DRONE: 0.55
      };

      const pickWeighted = () => {
        const pool = types.map(t => ({ t, w: weights[t] || 1 }));
        const sum = pool.reduce((a, b) => a + b.w, 0);
        let r = Math.random() * sum;
        for (const p of pool) { r -= p.w; if (r <= 0) return p.t; }
        return pool[pool.length - 1].t;
      };

      for (let n = 0; n < Math.max(1, Math.floor(baseCount * earlyCountMul)); n++) {
        let type = pickWeighted();
        if (i >= 12 && n % 7 === 0) type = "ARMORED";
        if (i >= 12 && n % 9 === 0) type = "SHIELDED";
        if (i >= 14 && n % 11 === 0) type = "REGEN";
        if (i >= 10 && n % 13 === 0) type = "SHIELD_DRONE";
        const t = n * (spacing * earlySpacingMul) + rand(-0.15, 0.15);
        let eliteTag = null;
        if (wave >= 7) {
          const eliteChance = Math.min(0.30, 0.10 + (wave - 7) * 0.012);
          if (Math.random() < eliteChance) {
            eliteTag = pick(["HARDENED", "VOLATILE", "PHASELINK"]);
          }
        }
        spawns.push({ t: Math.max(0, t), type, scalar, eliteTag });
      }

      if (i % 5 === 0) {
        spawns.push({ t: 1.2, type: "BRUTE", scalar });
        if (i >= 6) spawns.push({ t: 2.3, type: "ARMORED", scalar });
        if (i >= 10) spawns.push({ t: 2.8, type: "SHIELDED", scalar });
        if (i >= 12) spawns.push({ t: 3.0, type: "REGEN", scalar });
        spawns.push({ t: 3.4, type: "BOSS_PROJECTOR", scalar, miniboss: true });
      }

      spawns.sort((a, b) => a.t - b.t);
      return spawns;
    }

    startWave() {
      if (this.gameOver || this.gameWon) return;
      if (this.wave >= this.waveMax) return;

      this.wave++;
      this._resetWaveStats();
      this._refreshBuildList();
      {
        const keys = Object.keys(ANOMALIES);
        const key = keys[(Math.random() * keys.length) | 0];
        const base = ANOMALIES[key];
        this.waveAnomaly = { key, name: base.name, desc: base.desc };
        this._warpRippleT = 10;
        const shortDesc = base.desc.length > 70 ? `${base.desc.slice(0, 67)}...` : base.desc;
        setTimeout(() => toast(`ANOMALY: ${base.name} — ${shortDesc}`), 700);
      }
      const scalar = this._waveScalar(this.wave);
      this.waveScalar = scalar;
      const newSpawns = this._buildWave(this.wave, scalar);
      if (!this.waveActive) {
        this.waveActive = true;
        this.intermission = 0;
        this.spawnT = 0;
        this.spawnIndex = 0;
        this.spawnQueue = newSpawns;
      } else {
        const offset = this.spawnT + 0.2;
        for (const s of newSpawns) s.t += offset;
        this.spawnQueue = this.spawnQueue.concat(newSpawns);
      }
      toast(`Wave ${this.wave} launched`);
      this.audio.play("wave");
    }

    spawnEnemy(typeKey, startD = 0, scalarOverride = null, eliteTag = null) {
      const scalar = scalarOverride || this.waveScalar;
      const e = new Enemy(typeKey, scalar, startD, eliteTag);
      e._game = this;
      if (this.waveAnomaly?.key === "ION_STORM") {
        e._ionStorm = true;
        if (e.maxShield > 0) {
          e.maxShield *= 1.2;
          e.shield = e.maxShield;
        }
      }
      if (this.waveAnomaly?.key === "CRYO_LEAK") {
        e._slowMul = 1.15;
        e._dotDurMul = 0.85;
      }
      e._id = this._id++;
      const p = this.map.posAt(startD);
      e.x = p.x; e.y = p.y; e.ang = p.ang;
      this.enemies.push(e);
      return e;
    }

    _save() {
      try {
        const data = {
          mapIndex: 0,
          levelIndex: this.levelIndex,
          mapSeed: this.mapSeed,
          envId: this.envId,
          mapData: this.mapData ? {
            seed: this.mapData.seed,
            envId: this.mapData.envId,
            pathN: this.mapData.pathN,
            powerTilesN: this.mapData.powerTilesN,
            poolsN: this.mapData.poolsN
          } : null,
          mapStats: this.mapStats || [],
          playerStats: this.playerStats || this._newPlayerStats(),
          gold: this.gold,
          lives: this.lives,
          wave: this.wave,
          waveMax: this.waveMax,
          hasStarted: this.hasStarted,
          waveActive: this.waveActive,
          intermission: this.intermission,
          skipBuff: this.skipBuff,
          waveAnomaly: this.waveAnomaly ? this.waveAnomaly.key : null,
          warpRippleT: this._warpRippleT,
          speed: this.speed,
          powerCells: this.map.powerCells,
          spawnQueue: this.spawnQueue,
          spawnIndex: this.spawnIndex,
          spawnT: this.spawnT,
          waveScalar: this.waveScalar,
          globalOverchargeT: this.globalOverchargeT,
          turrets: this.turrets.map(t => ({
            typeKey: t.typeKey,
            x: t.x, y: t.y,
            gx: t.gx, gy: t.gy,
            level: t.level,
            modsChosen: (t.modsChosen || []).slice(),
            cool: t.cool,
            charges: t.charges,
            targetMode: t.targetMode,
            boosted: t.boosted
          })),
          enemies: this.enemies.map(e => ({
            typeKey: e.typeKey,
            eliteTag: e.elite?.tag || null,
            hp: e.hp,
            shield: e.shield,
            pathD: e.pathD,
            slow: e.slow,
            slowT: e.slowT,
            dot: e.dot,
            dotT: e.dotT,
            revealed: e.revealed,
            revealT: e.revealT,
            revealLock: e._revealLock || false,
            marked: e._marked || 0,
            markedT: e._markedT || 0,
            noSplit: e._noSplit || false,
            noSplitT: e._noSplitT || 0,
            scalar: e.scalar
          })),
          traps: this.traps.map(tr => ({
            x: tr.x, y: tr.y, r: tr.r, t: tr.t,
            dmg: tr.dmg, slow: tr.slow, dot: tr.dot,
            siphon: tr.siphon, noSplit: tr.noSplit,
            ownerIndex: this.turrets.indexOf(tr.owner)
          })),
          lingering: this.lingering.map(l => ({
            x: l.x, y: l.y, r: l.r, t: l.t, dps: l.dps, col: l.col
          }))
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch (err) {
        // ignore storage errors (private mode, quota, etc.)
      }
    }

    _load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data) return;

        if (Array.isArray(data.mapStats)) {
          this.mapStats = data.mapStats.slice();
        }
        if (data.playerStats && typeof data.playerStats === "object") {
          this.playerStats = {
            mapsCleared: data.playerStats.mapsCleared || 0,
            kills: data.playerStats.kills || 0,
            leaks: data.playerStats.leaks || 0,
            gold: data.playerStats.gold || 0,
            towersBuilt: data.playerStats.towersBuilt || 0,
            bosses: data.playerStats.bosses || 0
          };
        }
        if (typeof data.levelIndex === "number" && Number.isFinite(data.levelIndex)) {
          this.levelIndex = Math.max(1, data.levelIndex | 0);
        }
        let mapData = null;
        if (data.mapData && Array.isArray(data.mapData.pathN)) {
          const envId = typeof data.mapData.envId === "number" ? data.mapData.envId : (data.envId || 0);
          mapData = {
            seed: typeof data.mapData.seed === "number" ? data.mapData.seed : (data.mapSeed || this._makeSeed()),
            envId,
            env: ENV_PRESETS[envId] || ENV_PRESETS[0],
            pathN: data.mapData.pathN,
            powerTilesN: Array.isArray(data.mapData.powerTilesN) ? data.mapData.powerTilesN : [],
            poolsN: Array.isArray(data.mapData.poolsN) ? data.mapData.poolsN : []
          };
        } else if (typeof data.mapSeed === "number") {
          mapData = generateMap(data.mapSeed, data.envId || 0);
        }
        if (!mapData) {
          mapData = this.mapData || generateMap(this._makeSeed(), (Math.random() * ENV_PRESETS.length) | 0);
        }
        this.loadGeneratedMap(mapData);
        this.gold = data.gold ?? this.gold;
        this.lives = data.lives ?? this.lives;
        this.wave = data.wave ?? this.wave;
        this.waveMax = 16;
        this.hasStarted = !!data.hasStarted;
        this.waveActive = !!data.waveActive;
        this.intermission = data.intermission ?? this.intermission;
        if (data.skipBuff) {
          const dmgMul = clamp(data.skipBuff.dmgMul || 1, 1, 1.25);
          const rateMul = clamp(data.skipBuff.rateMul || 1, 1, 1.25);
          const t = Math.max(0, data.skipBuff.t || 0);
          this.skipBuff = { dmgMul, rateMul, t };
        }
        if (data.waveAnomaly && ANOMALIES[data.waveAnomaly]) {
          const base = ANOMALIES[data.waveAnomaly];
          this.waveAnomaly = { key: data.waveAnomaly, name: base.name, desc: base.desc };
        }
        this._warpRippleT = data.warpRippleT || 0;
        this.speed = data.speed ?? this.speed;
        this.spawnQueue = data.spawnQueue || [];
        this.spawnIndex = data.spawnIndex || 0;
        this.spawnT = data.spawnT || 0;
        this.waveScalar = data.waveScalar || this.waveScalar;
        this.globalOverchargeT = data.globalOverchargeT || 0;

        if (Array.isArray(data.turrets)) {
          this.turrets = [];
          for (const s of data.turrets) {
            const t = new Turret(s.typeKey, s.x, s.y);
            t.gx = s.gx; t.gy = s.gy;
            t.cool = s.cool ?? t.cool;
            if (s.targetMode) t.targetMode = s.targetMode;
            const mods = s.modsChosen || [];
            for (let tier = 0; tier < mods.length; tier++) {
              const idx = mods[tier];
              if (idx == null) continue;
              t.applyUpgrade(tier, idx, false);
            }
            if (s.boosted) t.applyPowerBoost();
            t.flash = 0;
            if (typeof s.charges === "number") t.charges = s.charges;
            this.turrets.push(t);
          }
        }

        if (Array.isArray(data.enemies)) {
          this.enemies = [];
          for (const s of data.enemies) {
            const e = new Enemy(s.typeKey, s.scalar || this.waveScalar, s.pathD || 0, s.eliteTag || null);
            e._game = this;
            e.hp = s.hp ?? e.hp;
            e.shield = s.shield ?? e.shield;
            e.pathD = s.pathD ?? e.pathD;
            e.slow = s.slow || 0;
            e.slowT = s.slowT || 0;
            e.dot = s.dot || 0;
            e.dotT = s.dotT || 0;
            e.revealed = !!s.revealed;
            e.revealT = s.revealT || 0;
            e._revealLock = !!s.revealLock;
            e._marked = s.marked || 0;
            e._markedT = s.markedT || 0;
            e._noSplit = !!s.noSplit;
            e._noSplitT = s.noSplitT || 0;
            e._id = this._id++;
            this.enemies.push(e);
          }
        }

        if (Array.isArray(data.traps)) {
          this.traps = data.traps.map(tr => ({
            x: tr.x, y: tr.y, r: tr.r, t: tr.t,
            dmg: tr.dmg, slow: tr.slow, dot: tr.dot,
            siphon: tr.siphon, noSplit: tr.noSplit,
            owner: this.turrets[tr.ownerIndex] || null
          }));
        }

        if (Array.isArray(data.lingering)) {
          this.lingering = data.lingering.map(l => ({
            x: l.x, y: l.y, r: l.r, t: l.t, dps: l.dps, col: l.col
          }));
        }
      } catch (err) {
        // ignore load errors
      }
      this._resetWaveStats();
    }

    _resetRun() {
      this.turrets = [];
      this.enemies = [];
      this.projectiles = [];
      this.traps = [];
      this.beams = [];
      this.arcs = [];
      this.cones = [];
      this.lingering = [];

      this.gold = this._getStartGold();
      this.lives = START_LIVES;
      this.wave = 0;
      this.waveMax = 16;
      this.hasStarted = false;
      this.waveActive = false;
      this.intermission = 0;
      this.gameOver = false;
      this.gameWon = false;
      this._gameOverPrompted = false;
      this.paused = false;
      if (pauseBtn) pauseBtn.textContent = "PAUSE";

      this.spawnQueue = [];
      this.spawnIndex = 0;
      this.spawnT = 0;
      this.waveScalar = { hp: 1, spd: 1, armor: 0, shield: 1, regen: 1, reward: 1 };
      this.waveAnomaly = null;
      this._warpRippleT = 0;
      this.pendingIntermission = INTERMISSION_SECS;
      this.statsOpen = false;
      this.statsMode = null;

      this.buildKey = null;
      this.selectedTurret = null;
      this.hoverCell = null;
      this._id = 1;
      this._resetWaveStats();
      this.runStats = this._newRunStats();
      this.mapStats = this.mapStats || [];
      this.playerStats = this.playerStats || this._newPlayerStats();
      this._refreshBuildList();
      this.updateHUD();
    }

    onEnemyKill(enemy) {
      // on-death effects
      if (enemy.onDeath && !enemy._noSplit) enemy.onDeath(this, enemy);

      if (enemy.elite && enemy.elite.tag === "VOLATILE" && !enemy._volatileTriggered) {
        enemy._volatileTriggered = true;
        const r = 90;
        for (const e of this.enemies) {
          if (e.hp <= 0 || e === enemy) continue;
          if (dist2(enemy.x, enemy.y, e.x, e.y) <= r * r) {
            e.takeHit(this, 38, DAMAGE.TRUE);
          }
        }
        this.explosions.push({
          x: enemy.x,
          y: enemy.y,
          r: 14,
          t: 0.32,
          dur: 0.32,
          max: r,
          col: "rgba(255,91,125,0.9)",
          boom: true
        });
        this.shakeT = Math.min(0.25, this.shakeT + 0.08);
        this.shakeMag = Math.min(8, this.shakeMag + 1.2);
      }

      // reward
      this.gold += enemy.reward;
      if (this.waveStats) {
        this.waveStats.kills += 1;
        this.waveStats.gold += enemy.reward;
        if (enemy.isBoss) this.waveStats.bosses += 1;
      }
      if (this.runStats) {
        this.runStats.kills += 1;
        this.runStats.gold += enemy.reward;
        if (enemy.isBoss) this.runStats.bosses += 1;
      }
      if (this.playerStats) {
        this.playerStats.kills += 1;
        this.playerStats.gold += enemy.reward;
        if (enemy.isBoss) this.playerStats.bosses += 1;
      }
      this.audio.playLimited("kill", 140);

      // explosion animation
      this.explosions.push({
        x: enemy.x,
        y: enemy.y,
        r: enemy.flying ? 12 : 16,
        t: 0.38,
        dur: 0.38,
        max: 64,
        col: enemy.tint || "rgba(255,207,91,0.85)",
        boom: true
      });
      this.shakeT = Math.min(0.25, this.shakeT + 0.08);
      this.shakeMag = Math.min(8, this.shakeMag + 1.6);

      // siphon from traps
      if (enemy._lastHitTag === "trap" && enemy._lastHitBy && enemy._lastHitBy.siphon) {
        const refund = Math.max(1, Math.floor(enemy.reward * 0.2));
        this.gold += refund;
        if (this.waveStats) this.waveStats.gold += refund;
        if (this.runStats) this.runStats.gold += refund;
        if (this.playerStats) this.playerStats.gold += refund;
        this.particles.spawn(enemy.x, enemy.y, 4, "muzzle");
      }

      // venom splash
      if (enemy._lastHitBy && enemy._lastHitBy.onKillSplash) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(enemy.x, enemy.y, e.x, e.y) <= 80 * 80) {
            e.applyDot(Math.max(4, enemy.reward * 0.6), 2.4);
          }
        }
      }
    }

    onEnemyLeak(enemy) {
      if (this.waveStats) this.waveStats.leaks += 1;
      if (this.runStats) this.runStats.leaks += 1;
      if (this.playerStats) this.playerStats.leaks += 1;
      this.lives--;
      this.particles.spawn(enemy.x, enemy.y, 8, "boom");
      this.audio.play("leak");
      this.damageFlash = Math.max(this.damageFlash, 0.45);
      const end = this.map.pathPts[this.map.pathPts.length - 1];
      if (end) {
        this.explosions.push({
          x: end[0],
          y: end[1],
          r: 20,
          t: 0.35,
          dur: 0.35,
          max: 120,
          col: "rgba(98,242,255,0.85)",
          boom: false
        });
        this.corePulseT = Math.max(this.corePulseT, 0.45);
        this.shakeT = Math.min(0.25, this.shakeT + 0.08);
        this.shakeMag = Math.min(6, this.shakeMag + 1.2);
      }
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameOver = true;
        toast("Core lost.");
        this.audio.play("lose");
        if (!this._gameOverPrompted) {
          this._gameOverPrompted = true;
          showConfirm("Defeat", "Defeat. Retry this level?", () => {
            this._resetRun();
            this._save();
          });
        }
      }
    }

    isCellOccupied(gx, gy) {
      return this.turrets.some(t => t.gx === gx && t.gy === gy);
    }

    onClick(x, y) {
      // select turret if clicked
      let clickedTurret = null;
      for (const t of this.turrets) {
        if (dist2(x, y, t.x, t.y) <= 16 * 16) {
          clickedTurret = t;
          break;
        }
      }
      if (clickedTurret) {
        this.selectTurret(clickedTurret);
        this.collapseEnabled = true;
        if (this.buildKey) this.clearBuildMode();
        return;
      }

      if (this.buildKey) {
        if (this.isPaused()) {
          toast("Cannot build while paused.");
          return;
        }
        const cell = this.map.cellAt(x, y);
        if (cell.v !== 1 && cell.v !== 3) { toast("Not buildable."); return; }
        if (this.isCellOccupied(cell.gx, cell.gy)) { toast("Tile occupied."); return; }
        const t = TURRET_TYPES[this.buildKey];
        if (this.gold < t.cost) {
          toast("Not enough gold.");
          this.clearBuildMode();
          return;
        }
        this.gold -= t.cost;
        const w = this.map.worldFromCell(cell.gx, cell.gy);
        const turret = new Turret(this.buildKey, w.x, w.y);
        if (cell.v === 3) turret.applyPowerBoost();
        turret.gx = cell.gx; turret.gy = cell.gy;
        this.turrets.push(turret);
        if (this.waveStats && this.hasStarted && this.wave > 0) {
          this.waveStats.towersBuilt += 1;
        }
        if (this.runStats) this.runStats.towersBuilt += 1;
        if (this.playerStats) this.playerStats.towersBuilt += 1;
        this.selectTurret(turret);
        this.particles.spawn(w.x, w.y, 8, "muzzle");
        this.audio.play("build");
        this._save();
        return;
      }

      // select enemy if clicked
      let clickedEnemy = null;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const rr = (e.r + 4) * (e.r + 4);
        if (dist2(x, y, e.x, e.y) <= rr) { clickedEnemy = e; break; }
      }
      if (clickedEnemy) {
        this.selectEnemy(clickedEnemy);
        return;
      }

      this.selectEnemy(null);
    }

    selectTurret(turret) {
      this.selectedEnemy = null;
      this.selectedTurret = turret;
      sellBtn.disabled = !turret;
      if (!turret) {
        selSub.textContent = "Select a turret";
        selectionBody.innerHTML = `
          <div class="emptyState">
            <div class="emptyGlyph"></div>
            <div class="emptyTitle">No turret selected</div>
            <div class="emptyText">Click a turret you placed to view stats and upgrades.</div>
          </div>
        `;
        return;
      }
      selSub.textContent = turret.role;

      const tierNames = ["Base", "I", "II", "III", "IV", "V"];
      const dps = turret.fire > 0 ? (turret.dmg / turret.fire) : turret.dmg * 12;
      const stats = [
        { k: "Damage", v: turret.dmg.toFixed(1) },
        { k: "Fire", v: `${turret.fire.toFixed(2)}s` },
        { k: "Range", v: turret.range.toFixed(0) },
        { k: "DPS", v: dps.toFixed(1) }
      ];

      const statCards = stats.map(s => `
        <div class="statCard"><div class="k">${s.k}</div><div class="v">${s.v}</div></div>
      `).join("");
      const targetModes = [
        { value: "FIRST", label: "FIRST" },
        { value: "LAST", label: "LAST" },
        { value: "STRONGEST", label: "STRONGEST" },
        { value: "MOST_SHIELD", label: "MOST SHIELD" },
        { value: "MOST_ARMOR", label: "MOST ARMOR" }
      ];
      const targetOptions = targetModes.map(m => {
        const selected = (turret.targetMode || "FIRST") === m.value ? "selected" : "";
        return `<option value="${m.value}" ${selected}>${m.label}</option>`;
      }).join("");

      let upgradesHtml = "";
      if (turret.level < 5) {
        const tierIdx = turret.level;
        const mods = turret.getTierOptions(tierIdx);
        upgradesHtml = `
          <div class="upgrades">
            <div class="upTitle">Upgrade Tier ${tierNames[tierIdx + 1]}</div>
            <div class="modRow">
              ${mods.map((m, idx) => {
                const preview = Turret.previewAfterUpgrade(turret, tierIdx, idx);
                const affordable = this.gold >= m.cost;
                const delta = [
                  `Dmg ${turret.dmg.toFixed(1)}→${preview.dmg.toFixed(1)}`,
                  `Fire ${turret.fire.toFixed(2)}→${preview.fire.toFixed(2)}`,
                  `Range ${turret.range.toFixed(0)}→${preview.range.toFixed(0)}`
                ].join("  ");
                return `
                  <div class="modChoice ${affordable ? "" : "poor"}">
                    <div class="modTop">
                      <div class="modName">${m.name}</div>
                      <div class="modCost">${m.cost}g</div>
                    </div>
                    <div class="modDesc">${m.desc}</div>
                    <div class="modDelta">${delta}</div>
                    <div class="modBtnRow">
                      <button class="btn ${affordable ? "primary" : ""}" data-mod="${idx}" data-cost="${m.cost}" ${affordable ? "" : "disabled"}>Upgrade</button>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `;
      } else {
        upgradesHtml = `
          <div class="upgrades">
            <div class="upTitle">Upgrades</div>
            <div class="tiny">Max tier reached.</div>
          </div>
        `;
      }

      selectionBody.innerHTML = `
        <div class="selHeaderRow">
          <div class="selName">${turret.name}</div>
          <div class="selLevel">Tier ${tierNames[turret.level]}</div>
        </div>
        <div class="statGrid">${statCards}</div>
        <div class="targetRow">
          <div class="targetLabel">Targeting</div>
          <select id="targetModeSelect" class="targetSelect">
            ${targetOptions}
          </select>
        </div>
        ${upgradesHtml}
      `;

      selectionBody.querySelectorAll("button[data-mod]").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.mod || "0");
          this.applyUpgrade(turret, idx);
        });
      });
      const targetSelect = selectionBody.querySelector("#targetModeSelect");
      if (targetSelect) {
        targetSelect.addEventListener("change", () => {
          turret.targetMode = targetSelect.value;
          this._save();
        });
      }
    }

    selectEnemy(enemy) {
      this.selectedTurret = null;
      this.selectedEnemy = enemy || null;
      sellBtn.disabled = true;

      if (!enemy) {
        selSub.textContent = "Select a turret";
        selectionBody.innerHTML = `
          <div class="emptyState">
            <div class="emptyGlyph"></div>
            <div class="emptyTitle">No turret selected</div>
            <div class="emptyText">Click a turret you placed to view stats and upgrades.</div>
          </div>
        `;
        return;
      }

      const yesNo = (v) => v ? "Yes" : "No";
      const hpNow = Math.max(0, Math.ceil(enemy.hp));
      const hpMax = Math.max(1, Math.ceil(enemy.maxHp));
      const shieldNow = Math.max(0, Math.ceil(enemy.shield || 0));
      const shieldMax = Math.max(0, Math.ceil(enemy.maxShield || 0));
      const regen = (enemy.regen || 0).toFixed(1);
      const tags = [];
      if (enemy.isBoss) tags.push("Boss");
      if (enemy.elite?.tag) tags.push(`Elite: ${enemy.elite.tag}`);

      selSub.textContent = enemy.desc || "Enemy";
      selectionBody.innerHTML = `
        <div class="selHeaderRow">
          <div class="selName">${enemy.name}</div>
          <div class="selLevel">${enemy.typeKey}</div>
        </div>
        <div class="statGrid">
          <div class="statCard"><div class="k">HP</div><div class="v">${hpNow} / ${hpMax}</div></div>
          <div class="statCard"><div class="k">Shield</div><div class="v">${shieldNow} / ${shieldMax}</div></div>
          <div class="statCard"><div class="k">Armor</div><div class="v">${Math.round((enemy.armor || 0) * 100)}%</div></div>
          <div class="statCard"><div class="k">Regen</div><div class="v">${regen}/s</div></div>
        </div>
        <div class="upgrades">
          <div class="upTitle">Attributes</div>
          <div class="statsGrid">
            <div class="statsRow"><div class="k">Shielded</div><div class="v">${yesNo((enemy.maxShield || 0) > 0)}</div></div>
            <div class="statsRow"><div class="k">Stealth</div><div class="v">${yesNo(!!enemy.stealth)}</div></div>
            <div class="statsRow"><div class="k">Flying</div><div class="v">${yesNo(!!enemy.flying)}</div></div>
            <div class="statsRow"><div class="k">Tags</div><div class="v">${tags.length ? tags.join(", ") : "None"}</div></div>
          </div>
        </div>
      `;
    }

    applyUpgrade(turret, modIdx) {
      if (!turret || turret.level >= 5) return;
      if (this.isPaused()) { toast("Cannot upgrade while paused."); return; }
      const cost = turret.getUpgradeCost(turret.level, modIdx);
      if (this.gold < cost) { toast("Not enough gold."); return; }
      const ok = turret.applyUpgrade(turret.level, modIdx, false);
      if (ok) {
        this.gold -= cost;
        this.selectTurret(turret);
        this.particles.spawn(turret.x, turret.y, 10, "muzzle");
        this.audio.play("upgrade");
        this._save();
      }
    }

    sellSelected() {
      if (!this.selectedTurret) return;
      if (this.isPaused()) { toast("Cannot sell while paused."); return; }
      const t = this.selectedTurret;
      const refund = Math.max(1, Math.floor((t.costSpent || 0) * 0.7));
      this.gold += refund;
      if (this.waveStats) this.waveStats.gold += refund;
      if (this.runStats) this.runStats.gold += refund;
      if (this.playerStats) this.playerStats.gold += refund;
      this.turrets = this.turrets.filter(x => x !== t);
      this.selectTurret(null);
      this.particles.spawn(t.x, t.y, 10, "boom");
      this.audio.play("sell");
      this._save();
    }

    update(dt) {
      if (this.gameOver || this.gameWon) {
        this.updateHUD();
        return;
      }
      if (this.isPaused()) {
        this.updateHUD();
        return;
      }

      this._realDt = dt;
      const dtScaled = dt * this.speed;
      if (this.shakeT > 0) {
        this.shakeT = Math.max(0, this.shakeT - dt);
        if (this.shakeT === 0) this.shakeMag = 0;
      }
      if (this.panelHold) {
        this.panelHold.left = Math.max(0, this.panelHold.left - dt);
        this.panelHold.right = Math.max(0, this.panelHold.right - dt);
      }
      if (this.damageFlash > 0) {
        this.damageFlash = Math.max(0, this.damageFlash - dtScaled * 1.8);
      }
      if (this.corePulseT > 0) {
        this.corePulseT = Math.max(0, this.corePulseT - dt);
      }
      if (this.skipBuff.t > 0) {
        this.skipBuff.t = Math.max(0, this.skipBuff.t - dtScaled);
        if (this.skipBuff.t <= 0) {
          this.skipBuff.dmgMul = 1;
          this.skipBuff.rateMul = 1;
        }
      }
      if (this.abilities) {
        for (const a of Object.values(this.abilities)) {
          if (a.t > 0) a.t = Math.max(0, a.t - dt);
        }
      }
      if (this.globalOverchargeT > 0) {
        this.globalOverchargeT = Math.max(0, this.globalOverchargeT - dt);
      }

      // wave logic
      if (this.waveActive) {
        this.spawnT += dtScaled;
        while (this.spawnIndex < this.spawnQueue.length && this.spawnT >= this.spawnQueue[this.spawnIndex].t) {
          const s = this.spawnQueue[this.spawnIndex++];
          let spawned = null;
          if (s.miniboss) {
            toast("MINIBOSS INBOUND");
            this.shakeT = Math.min(0.18, this.shakeT + 0.06);
            this.shakeMag = Math.min(4, this.shakeMag + 0.8);
          }
          spawned = this.spawnEnemy(s.type, 0, s.scalar, s.eliteTag || null);
          if (s.miniboss && spawned) {
            this.spawnText(spawned.x, spawned.y - 20, "MINIBOSS", "rgba(98,242,255,0.95)", 1.0);
          }
        }
        if (this.spawnIndex >= this.spawnQueue.length && this.enemies.every(e => e.hp <= 0)) {
          this.waveActive = false;
          this.waveAnomaly = null;
          this._warpRippleT = 0;
          if (this.wave >= this.waveMax) {
            if (!this.gameOver && !this._transitioning) {
              this.advanceLevel();
              this.audio.play("win");
            }
            return;
          } else {
            this.intermission = INTERMISSION_SECS;
            this.updateHUD();
            return;
          }
        }
      } else if (this.hasStarted && this.intermission > 0) {
        this.intermission = Math.max(0, this.intermission - dtScaled);
        if (this.intermission <= 0 && this.wave < this.waveMax) {
          this.startWave();
        }
      }

      if (this.waveActive && this.waveAnomaly?.key === "WARP_RIPPLE") {
        this._warpRippleT -= dtScaled;
        if (this._warpRippleT <= 0) {
          this._warpRippleT = 10;
          const candidates = this.enemies.filter(e => e.hp > 0 && !e.flying);
          for (let i = candidates.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            const tmp = candidates[i];
            candidates[i] = candidates[j];
            candidates[j] = tmp;
          }
          for (let i = 0; i < Math.min(2, candidates.length); i++) {
            const e = candidates[i];
            e.pathD = Math.min(this.map.totalLen - 2, e.pathD + 60);
            const p = this.map.posAt(e.pathD);
            e.x = p.x; e.y = p.y; e.ang = p.ang;
            this.particles.spawn(e.x, e.y, 6, "muzzle");
            this.explosions.push({
              x: e.x,
              y: e.y,
              r: 10,
              t: 0.24,
              dur: 0.24,
              max: 42,
              col: "rgba(154,108,255,0.85)",
              boom: false
            });
          }
        }
      }

      // update enemies
      for (const e of this.enemies) e.update(this, dtScaled);
      this.enemies = this.enemies.filter(e => e.hp > 0 || !e._dead);
      if (this.selectedEnemy && (this.selectedEnemy.hp <= 0 || this.selectedEnemy._dead)) {
        this.selectEnemy(null);
      }

      // update turrets
      for (const t of this.turrets) t.update(this, dtScaled);

      // update projectiles
      for (const p of this.projectiles) p.update(this, dtScaled);
      this.projectiles = this.projectiles.filter(p => p.ttl > 0);

      // traps
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const tr = this.traps[i];
        tr.t -= dtScaled;
        if (tr.t <= 0) { this.traps.splice(i, 1); continue; }

        for (const e of this.enemies) {
          if (e.hp <= 0 || e.flying) continue;
          if (dist2(tr.x, tr.y, e.x, e.y) <= tr.r * tr.r) {
            e._lastHitBy = tr.owner;
            e._lastHitTag = "trap";
            e.applySlow(tr.slow, 0.6);
            if (!tr._tick) tr._tick = 0;
            tr._tick -= dtScaled;
            if (tr._tick <= 0) {
              tr._tick = 0.55;
            e.takeHit(this, tr.dmg, DAMAGE.TRUE, tr.owner?.typeKey || "TRAP");
              if (tr.dot) e.applyDot(tr.dot.dps, tr.dot.dur);
            }
            if (tr.noSplit && e.typeKey === "SPLITTER") {
              e._noSplit = true;
              e._noSplitT = Math.max(e._noSplitT, 0.8);
            }
          }
        }
      }

      // lingering zones
      for (let i = this.lingering.length - 1; i >= 0; i--) {
        const l = this.lingering[i];
        l.t -= dtScaled;
        if (l.t <= 0) { this.lingering.splice(i, 1); continue; }
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (dist2(l.x, l.y, e.x, e.y) <= l.r * l.r) {
            e.takeHit(this, l.dps * dtScaled, DAMAGE.TRUE, l.ownerKey || null);
          }
        }
      }

      // effects timers
      const decay = (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          arr[i].t -= dtScaled;
          if (arr[i].t <= 0) arr.splice(i, 1);
        }
      };
      decay(this.beams);
      decay(this.arcs);
      decay(this.cones);
      decay(this.explosions);
      decay(this.decals);

      this.particles.update(dtScaled);
      for (let i = this.floatText.length - 1; i >= 0; i--) {
        const ft = this.floatText[i];
        ft.t -= dtScaled;
        ft.y -= ft.vy * dtScaled;
        if (ft.t <= 0) this.floatText.splice(i, 1);
      }
      this._saveT += dt;
      if (this._saveT >= 1) {
        this._saveT = 0;
        this._save();
      }
      this.updateHUD();
    }

    draw(gfx) {
      gfx.clearRect(0, 0, W, H);
      gfx.save();
      if (this.shakeT > 0) {
        const sx = (Math.random() * 2 - 1) * this.shakeMag;
        const sy = (Math.random() * 2 - 1) * this.shakeMag;
        gfx.translate(sx, sy);
      }
      gfx.translate(W * 0.5, H * 0.5);
      gfx.scale(this.zoom, this.zoom);
      gfx.translate(-W * 0.5 - this.cam.x, -H * 0.5 - this.cam.y);
      this.map.drawBase(gfx);

      if (this.corePulseT > 0) {
        const end = this.map.pathPts[this.map.pathPts.length - 1];
        if (end) {
          const k = 1 - clamp(this.corePulseT / 0.45, 0, 1);
          const r = 24 + k * 80;
          gfx.save();
          gfx.globalAlpha = 0.65 * (1 - k);
          gfx.strokeStyle = "rgba(98,242,255,0.85)";
          gfx.lineWidth = 3;
          gfx.beginPath();
          gfx.arc(end[0], end[1], r, 0, Math.PI * 2);
          gfx.stroke();
          gfx.globalAlpha = 0.25 * (1 - k);
          const grad = gfx.createRadialGradient(end[0], end[1], 0, end[0], end[1], r * 1.2);
          grad.addColorStop(0, "rgba(98,242,255,0.35)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          gfx.fillStyle = grad;
          gfx.beginPath();
          gfx.arc(end[0], end[1], r * 1.2, 0, Math.PI * 2);
          gfx.fill();
          gfx.restore();
        }
      }

      // hover highlight
      if (this.hoverCell && (this.hoverCell.v === 1 || this.hoverCell.v === 3)) {
        const x = this.hoverCell.gx * this.map.gridSize;
        const y = this.hoverCell.gy * this.map.gridSize;
        const pulse = 0.35 + 0.25 * Math.sin(performance.now() * 0.006 + x * 0.01 + y * 0.01);
        gfx.save();
        const baseCol = this.hoverCell.v === 3 ? "rgba(255,207,91,0.55)" : "rgba(98,242,255,0.45)";
        gfx.strokeStyle = baseCol;
        gfx.fillStyle = this.hoverCell.v === 3 ? `rgba(255,207,91,${0.08 + pulse * 0.08})` : `rgba(98,242,255,${0.05 + pulse * 0.06})`;
        gfx.lineWidth = 2;
        gfx.fillRect(x + 2, y + 2, this.map.gridSize - 4, this.map.gridSize - 4);
        gfx.strokeRect(x + 2, y + 2, this.map.gridSize - 4, this.map.gridSize - 4);
        gfx.restore();
      }

      if (this.buildKey && this.hoverCell) {
        const cell = this.hoverCell;
        const inBounds = cell.gx >= 0 && cell.gy >= 0 && cell.gx < this.map.cols && cell.gy < this.map.rows;
        if (inBounds) {
          const buildValid = (cell.v === 1 || cell.v === 3) && !this.isCellOccupied(cell.gx, cell.gy);
          const w = this.map.worldFromCell(cell.gx, cell.gy);
          const base = TURRET_TYPES[this.buildKey];
          const range = base ? base.range : 120;
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);

          // range preview
          gfx.save();
          gfx.globalAlpha = 1;
          gfx.strokeStyle = buildValid ? "rgba(98,242,255,0.25)" : "rgba(255,91,125,0.25)";
          gfx.lineWidth = 2;
          gfx.beginPath();
          gfx.arc(w.x, w.y, range, 0, Math.PI * 2);
          gfx.stroke();
          gfx.restore();

          // ghost core
          gfx.save();
          gfx.globalAlpha = buildValid ? 0.55 : 0.45;
          gfx.fillStyle = buildValid ? "rgba(98,242,255,0.18)" : "rgba(255,91,125,0.18)";
          gfx.strokeStyle = buildValid ? "rgba(98,242,255,0.55)" : "rgba(255,91,125,0.65)";
          gfx.lineWidth = 2;
          gfx.beginPath();
          gfx.arc(w.x, w.y, 14 + pulse * 1.5, 0, Math.PI * 2);
          gfx.fill();
          gfx.stroke();
          gfx.restore();

          if (!buildValid) {
            const x = cell.gx * this.map.gridSize;
            const y = cell.gy * this.map.gridSize;
            gfx.save();
            gfx.globalAlpha = 0.7 * pulse;
            gfx.strokeStyle = "rgba(255,91,125,0.85)";
            gfx.lineWidth = 2.5;
            gfx.strokeRect(x + 1.5, y + 1.5, this.map.gridSize - 3, this.map.gridSize - 3);
            gfx.restore();
          }
        }
      }

      // lingering zones
      for (const l of this.lingering) {
        gfx.save();
        gfx.globalAlpha = 0.4;
        gfx.fillStyle = l.col || "rgba(255,207,91,0.2)";
        gfx.beginPath(); gfx.arc(l.x, l.y, l.r, 0, Math.PI * 2); gfx.fill();
        gfx.restore();
      }

      // traps
      for (const tr of this.traps) {
        gfx.save();
        gfx.globalAlpha = 0.55;
        gfx.strokeStyle = "rgba(98,242,255,0.45)";
        gfx.lineWidth = 2;
        gfx.beginPath(); gfx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); gfx.stroke();
        gfx.restore();
      }

      // turrets
      for (const t of this.turrets) t.draw(gfx, t === this.selectedTurret, this);

      // enemies
      for (const e of this.enemies) e.draw(gfx, e === this.selectedEnemy);

      // projectiles
      for (const p of this.projectiles) p.draw(gfx);

      // floating combat text
      if (this.floatText.length) {
        gfx.save();
        gfx.font = "700 12px " + getComputedStyle(document.body).fontFamily;
        gfx.textAlign = "center";
        for (const ft of this.floatText) {
          const a = clamp(ft.t / ft.ttl, 0, 1);
          gfx.globalAlpha = a;
          gfx.fillStyle = ft.color;
          gfx.fillText(ft.text, ft.x, ft.y);
        }
        gfx.restore();
      }

      // cones
      for (const c of this.cones) {
        gfx.save();
        gfx.globalAlpha = 0.18;
        gfx.fillStyle = "rgba(160,190,255,0.45)";
        gfx.beginPath();
        gfx.moveTo(c.x, c.y);
        gfx.arc(c.x, c.y, c.r, c.ang - c.cone / 2, c.ang + c.cone / 2);
        gfx.closePath();
        gfx.fill();
        gfx.restore();
      }

      // arcs
      for (const a of this.arcs) {
        gfx.save();
        gfx.globalAlpha = 0.7;
        gfx.strokeStyle = "rgba(154,108,255,0.85)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.moveTo(a.ax, a.ay);
        gfx.lineTo(a.bx, a.by);
        gfx.stroke();

        // faint branching
        gfx.globalAlpha = 0.35;
        gfx.lineWidth = 1.5;
        const mx = (a.ax + a.bx) * 0.5 + rand(-14, 14);
        const my = (a.ay + a.by) * 0.5 + rand(-14, 14);
        gfx.beginPath();
        gfx.moveTo(a.ax, a.ay);
        gfx.quadraticCurveTo(mx, my, a.bx, a.by);
        gfx.stroke();
        gfx.restore();
      }

      // beams (multi-pass heat distortion)
      for (const b of this.beams) {
        gfx.save();
        gfx.globalAlpha = 0.18;
        gfx.strokeStyle = b.col || "rgba(98,242,255,0.85)";
        gfx.lineWidth = 9;
        gfx.beginPath();
        gfx.moveTo(b.ax, b.ay);
        gfx.lineTo(b.bx, b.by);
        gfx.stroke();
        gfx.restore();
        for (let i = 0; i < 3; i++) {
          const off = (i - 1) * 1.6;
          const jx = rand(-0.6, 0.6);
          const jy = rand(-0.6, 0.6);
          gfx.save();
          gfx.globalAlpha = i === 0 ? 0.75 : (i === 1 ? 0.45 : 0.25);
          gfx.strokeStyle = b.col || "rgba(98,242,255,0.85)";
          gfx.lineWidth = i === 0 ? 2.6 : 1.8;
          gfx.beginPath();
          gfx.moveTo(b.ax + off + jx, b.ay + off + jy);
          gfx.lineTo(b.bx + off + jx, b.by + off + jy);
          gfx.stroke();
          gfx.restore();
        }
      }

      // explosions
      for (const ex of this.explosions) {
        const k = 1 - Math.max(0, ex.t) / (ex.dur || 0.28);
        const r = ex.r + (ex.max - ex.r) * k;
        gfx.save();
        if (ex.boom) {
          gfx.globalAlpha = 0.9 * (1 - k);
          const grad = gfx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
          grad.addColorStop(0, "rgba(255,207,91,0.9)");
          grad.addColorStop(0.4, "rgba(255,91,125,0.6)");
          grad.addColorStop(1, "rgba(0,0,0,0)");
          gfx.fillStyle = grad;
          gfx.beginPath();
          gfx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
          gfx.fill();
          gfx.globalAlpha = 0.55 * (1 - k);
          gfx.strokeStyle = ex.col;
          gfx.lineWidth = 2.5;
          gfx.beginPath();
          gfx.arc(ex.x, ex.y, r * 0.9, 0, Math.PI * 2);
          gfx.stroke();
        } else {
          gfx.globalAlpha = 0.55 * (1 - k);
          gfx.strokeStyle = ex.col;
          gfx.lineWidth = 3;
          gfx.beginPath();
          gfx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
          gfx.stroke();
        }
        gfx.restore();
      }

      // impact decals
      for (const d of this.decals) {
        gfx.save();
        const a = clamp(d.t / 2.6, 0, 1);
        gfx.globalAlpha = 0.25 * a;
        gfx.fillStyle = d.col;
        gfx.beginPath();
        gfx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        gfx.fill();
        gfx.restore();
      }

      this.particles.draw(gfx);

      if (this.paused && !this.gameOver && !this.gameWon) {
        gfx.save();
        gfx.fillStyle = "rgba(0,0,0,0.35)";
        gfx.fillRect(0, 0, W, H);
        gfx.fillStyle = "rgba(234,240,255,0.9)";
        gfx.font = "700 28px sans-serif";
        gfx.textAlign = "center";
        gfx.fillText("PAUSED", W / 2, H / 2);
        gfx.restore();
      }
      if (this.damageFlash > 0) {
        gfx.save();
        gfx.globalAlpha = this.damageFlash * 0.35;
        gfx.fillStyle = "rgba(255,91,125,0.85)";
        gfx.fillRect(0, 0, W, H);
        gfx.restore();
      }
      gfx.restore();
    }
  }

  // Boot
  resize();
  const game = new Game();
  window.game = game; // handy for debugging
  window._orbitEchoSelfTest = () => {
    const g = window.game;
    if (!g) {
      console.warn("Self-test: game not initialized.");
      return;
    }

    console.assert(g.audio?.enabled === true, "Audio default should be ON.");

    const prevWave = g.wave;
    g.wave = 1;
    console.assert(!g.isTowerUnlocked("AURA"), "AURA locked before wave 15.");
    console.assert(!g.isTowerUnlocked("TRAP"), "TRAP locked before wave 15.");
    g.wave = 15;
    console.assert(g.isTowerUnlocked("AURA"), "AURA unlocks at wave 15.");
    console.assert(g.isTowerUnlocked("TRAP"), "TRAP unlocks at wave 15.");
    g.wave = prevWave;

    const idx = g.map.cells.findIndex(v => v === 1 || v === 3);
    if (idx >= 0) {
      const gx = idx % g.map.cols;
      const gy = (idx / g.map.cols) | 0;
      const w = g.map.worldFromCell(gx, gy);

      g.setBuildMode("PULSE");
      const countBefore = g.turrets.length;
      g.onClick(w.x, w.y);
      console.assert(g.buildKey === "PULSE", "Build mode should persist after placement.");
      console.assert(g.turrets.length === countBefore + 1, "Turret should be placed in build mode.");

      g.paused = true;
      const countPaused = g.turrets.length;
      g.onClick(w.x, w.y);
      console.assert(g.turrets.length === countPaused, "Building should be blocked while paused.");
      g.paused = false;
      g.clearBuildMode();
    } else {
      console.warn("Self-test: no buildable cell found.");
    }

    g._resetWaveStats();
    g._openWaveStats();
    console.assert(g.statsOpen === true, "Stats overlay should open.");
    g._closeWaveStats("continue");
    console.assert(g.statsOpen === false, "Stats overlay should close.");
  };
  game.onResize();
  window.addEventListener("resize", () => {
    resize();
    game.onResize();
  });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw(ctx);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();


