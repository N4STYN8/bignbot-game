import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";

const ECOSYSTEM_MODE_PROFILES = Object.freeze([
  Object.freeze({ geometry: "bars", flow: 0.92, growth: 0.90, harmony: 1.18, mutation: 0.72, crystal: 0.78 }),
  Object.freeze({ geometry: "tide", flow: 1.38, growth: 1.08, harmony: 1.10, mutation: 0.62, crystal: 0.72 }),
  Object.freeze({ geometry: "storm", flow: 0.82, growth: 0.86, harmony: 0.72, mutation: 1.42, crystal: 1.08 }),
  Object.freeze({ geometry: "diamond", flow: 1.02, growth: 0.94, harmony: 1.46, mutation: 0.68, crystal: 1.02 }),
  Object.freeze({ geometry: "rings", flow: 1.16, growth: 1.12, harmony: 1.08, mutation: 0.86, crystal: 0.82 }),
  Object.freeze({ geometry: "rain", flow: 1.24, growth: 0.92, harmony: 0.90, mutation: 0.78, crystal: 1.34 }),
  Object.freeze({ geometry: "circuit", flow: 1.08, growth: 1.02, harmony: 1.34, mutation: 0.74, crystal: 0.88 }),
  Object.freeze({ geometry: "square", flow: 0.96, growth: 0.98, harmony: 0.86, mutation: 1.16, crystal: 0.94 }),
  Object.freeze({ geometry: "aurora", flow: 1.28, growth: 1.42, harmony: 1.20, mutation: 0.64, crystal: 1.12 }),
  Object.freeze({ geometry: "reactor", flow: 1.12, growth: 1.20, harmony: 0.92, mutation: 1.38, crystal: 1.16 })
]);

const EVOLUTION_DENSITY = Object.freeze([0.22, 0.38, 0.56, 0.74, 0.90, 1]);

/**********************
 * Map (grid build areas + path polyline)
 **********************/
export class Map {
  constructor(mapData) {
    this.gridSize = MAP_GRID_SIZE;
    this.cols = 0;
    this.rows = 0;
    this.cells = [];
    this.powerCells = [];
    this.powerTilesN = [];
    this.feature = null;
    this.featureCells = new Set();
    this.pathN = [];
    this.pathPts = [];
    this.segs = [];
    this.totalLen = 1;
    this.boundsN = null;
    this.env = ENV_PRESETS[0];
    this._padlockImg = null;
    this._padlockLoaded = false;
    this.tileEnergy = [];
    this.tileHeat = [];
    this.tileMemory = [];
    this.tileFrequency = [];
    this.tileCorruption = [];
    this.tileHarmony = [];
    this.tileGrowth = [];
    this.tileHue = [];
    this.tileState = [];
    this.tileShockEnergy = [];
    this.tileEmpEnergy = [];
    this.tileBossEnergy = [];
    this.tileBossHue = [];
    this.activeTileEnergy = new Set();
    this.musicWaves = [];
    this.globalMusicPulses = [];
    this._musicLastT = 0;
    this._musicLastBeat = 0;
    this._musicLastSnap = 0;
    this._musicLastDrop = 0;
    this._musicLastSpawn = 0;
    this._lastKillPulseT = 0;
    this._lastLargeKillPulseT = 0;
    this._lastMusicGrid = null;
    this._musicSeed = 7331;
    this._ecosystemSeed = 1;
    this._ecosystemAccumulator = 0;
    this._ecosystemBossActive = false;
    this._ecosystemMutation = 0;
    this._ecosystemEnabled = true;
    this._ecosystemCandidates = new Set();
    this._ecosystemDrawActive = [];
    // Reused render buffers keep the music visualizers from creating hundreds of
    // short-lived objects and gradients every frame (a major source of GC hitches).
    this._musicPathBuffers = [[], [], []];
    this._relayColumns = [];
    this._relayColumnFlags = null;
    this._nebulaSprites = new globalThis.Map();
    this._turretFirePulseTimes = new WeakMap();
    this._initPadlockSprite();
    if (mapData) this.loadGeneratedMap(mapData);
    else this._rebuild();
  }

  _initPadlockSprite() {
    if (typeof Image === "undefined") return;
    const img = new Image();
    img.onload = () => { this._padlockLoaded = true; };
    img.onerror = () => { this._padlockLoaded = false; };
    img.src = "assets/images/padlock.png";
    this._padlockImg = img;
  }

  loadGeneratedMap(mapData) {
    if (!mapData) return;
    this.pathN = mapData.pathN || [];
    this.powerTilesN = mapData.powerTilesN || [];
    this.poolsN = mapData.poolsN || [];
    this.feature = mapData.feature || null;
    this.savedFeatureCells = Array.isArray(mapData.featureCells) ? mapData.featureCells.slice() : null;
    this.boundsN = mapData.boundsN || null;
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
    if (this.boundsN && Number.isFinite(W) && Number.isFinite(H) && W > 0 && H > 0) {
      const bx = Number(this.boundsN.x);
      const by = Number(this.boundsN.y);
      const bw = Number(this.boundsN.w);
      const bh = Number(this.boundsN.h);
      if ([bx, by, bw, bh].every(Number.isFinite)) {
        const fixed = {
          x: clamp(bx, 0, 1) * W,
          y: clamp(by, 0, 1) * H,
          w: clamp(bw, 0.2, 1) * W,
          h: clamp(bh, 0.2, 1) * H
        };
        if (fixed.w >= this.gridSize * 4 && fixed.h >= this.gridSize * 3) {
          bounds = fixed;
        }
      }
    }
    this.cols = Math.max(6, Math.floor(W / this.gridSize));
    this.rows = Math.max(6, Math.floor(H / this.gridSize));
    this.cells = new Array(this.cols * this.rows).fill(1);
    this.powerCells = [];
    this.featureCells = new Set();
    this.poolsN = this.poolsN || [];

    const snapToCellCenter = (v) => (Math.floor(v / this.gridSize) + 0.5) * this.gridSize;
    const buildPathPts = (b) => {
      const pts = this.pathN.map(([nx, ny]) => {
        const rawX = b.x + nx * b.w;
        const rawY = b.y + ny * b.h;
        return [snapToCellCenter(rawX), snapToCellCenter(rawY)];
      });
      const deduped = [];
      for (const p of pts) {
        const last = deduped[deduped.length - 1];
        if (!last || last[0] !== p[0] || last[1] !== p[1]) deduped.push(p);
      }
      const out = deduped.length >= 2 ? deduped : pts;
      if (out.length >= 2) {
        const first = out[0];
        const second = out[1];
        const prev = out[out.length - 2];
        const last = out[out.length - 1];
        const laneMinX = this.gridSize * 0.5;
        const laneMaxX = (this.cols - 0.5) * this.gridSize;
        // Always span full playable width from left to right, with horizontal entry/exit.
        first[0] = laneMinX;
        first[1] = second[1];
        last[0] = laneMaxX;
        last[1] = prev[1];
      }
      return out;
    };
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
      const minBuildable = Math.max(20, Math.floor(this.cells.length * 0.06));

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

    const maxPowerTiles = Math.max(4, Number(POWER_TILE_COUNT?.max) || 7);
    const nearMinD = Math.max(TRACK_RADIUS + 4, POWER_NEAR_MIN * 0.7);
    const nearMaxPreferred = Math.min(POWER_NEAR_MAX, POWER_NEAR_MIN + 28);
    const powerCellMinDist = Math.max(this.gridSize * 2.2, POWER_TILE_MIN_DIST * 0.82);
    const nearestPathU = (px, py) => {
      let bestD = Infinity;
      let bestU = 0;
      const total = Math.max(1, this.totalLen || 1);
      for (const s of this.segs) {
        const vx = s.bx - s.ax;
        const vy = s.by - s.ay;
        const len2 = vx * vx + vy * vy || 1;
        const tt = clamp(((px - s.ax) * vx + (py - s.ay) * vy) / len2, 0, 1);
        const qx = s.ax + vx * tt;
        const qy = s.ay + vy * tt;
        const d = dist2(px, py, qx, qy);
        if (d < bestD) {
          bestD = d;
          bestU = ((s.cum || 0) + (s.len || Math.hypot(vx, vy)) * tt) / total;
        }
      }
      return bestU;
    };
    const isFarFromPowerCells = (idx, minD = powerCellMinDist) => {
      const gx = idx % this.cols;
      const gy = Math.floor(idx / this.cols);
      const px = (gx + 0.5) * this.gridSize;
      const py = (gy + 0.5) * this.gridSize;
      for (const other of this.powerCells) {
        const ogx = other % this.cols;
        const ogy = Math.floor(other / this.cols);
        const ox = (ogx + 0.5) * this.gridSize;
        const oy = (ogy + 0.5) * this.gridSize;
        if (dist2(px, py, ox, oy) < minD * minD) return false;
      }
      return true;
    };
    if (this.powerTilesN && this.powerTilesN.length) {
      for (const p of this.powerTilesN) {
        if (this.powerCells.length >= maxPowerTiles) break;
        const px = bounds.x + p[0] * bounds.w;
        const py = bounds.y + p[1] * bounds.h;
        const gx = clamp(Math.floor(px / this.gridSize), 0, this.cols - 1);
        const gy = clamp(Math.floor(py / this.gridSize), 0, this.rows - 1);
        const idx = gy * this.cols + gx;
        const cx = (gx + 0.5) * this.gridSize;
        const cy = (gy + 0.5) * this.gridSize;
        const d = Math.sqrt(distanceToSegmentsSquared(cx, cy, this.segs));
        if (this.cells[idx] === 1) {
          if (d < nearMinD || d > POWER_NEAR_MAX) continue;
          if (!isFarFromPowerCells(idx)) continue;
          this.cells[idx] = 3;
          this.powerCells.push(idx);
        }
      }
    }

    // Guarantee a baseline number of power tiles after cell quantization.
    const minPowerTiles = Math.max(4, Number(POWER_TILE_COUNT?.min) || 4);
    if (this.powerCells.length < minPowerTiles) {
      const taken = new Set(this.powerCells);
      const collectCandidates = (maxD) => {
        const candidates = [];
        for (let gy = 0; gy < this.rows; gy++) {
          for (let gx = 0; gx < this.cols; gx++) {
            const idx = gy * this.cols + gx;
            if (this.cells[idx] !== 1 || taken.has(idx)) continue;
            const px = (gx + 0.5) * this.gridSize;
            const py = (gy + 0.5) * this.gridSize;
            const d = Math.sqrt(distanceToSegmentsSquared(px, py, this.segs));
            if (d < nearMinD || d > maxD) continue;
            candidates.push({ idx, x: px, y: py, u: nearestPathU(px, py), d });
          }
        }
        return candidates;
      };
      const addSpreadCandidates = (candidates, minD, maxD) => {
        while (candidates.length && this.powerCells.length < minPowerTiles) {
          const targetU = (this.powerCells.length + 0.5) / minPowerTiles;
          let best = null;
          let bestScore = -Infinity;
          for (const c of candidates) {
            if (taken.has(c.idx)) continue;
            let nearestD = Infinity;
            let nearestU = Infinity;
            for (const other of this.powerCells) {
              const ogx = other % this.cols;
              const ogy = Math.floor(other / this.cols);
              const ox = (ogx + 0.5) * this.gridSize;
              const oy = (ogy + 0.5) * this.gridSize;
              nearestD = Math.min(nearestD, Math.sqrt(dist2(c.x, c.y, ox, oy)));
              nearestU = Math.min(nearestU, Math.abs(c.u - nearestPathU(ox, oy)));
            }
            if (nearestD < minD) continue;
            const worldSpread = this.powerCells.length ? clamp(nearestD / Math.max(1, powerCellMinDist), 0, 2) : 1;
            const pathSpread = this.powerCells.length ? clamp(nearestU * minPowerTiles, 0, 2) : 1;
            const targetFit = 1 - Math.min(1, Math.abs(c.u - targetU) * minPowerTiles);
            const bandFit = 1 - Math.min(1, Math.abs(c.d - ((nearMinD + maxD) * 0.5)) / Math.max(1, maxD - nearMinD));
            const score = worldSpread * 1.2 + pathSpread * 0.7 + targetFit * 0.8 + bandFit * 0.25;
            if (score > bestScore) {
              best = c;
              bestScore = score;
            }
          }
          if (!best) break;
          this.cells[best.idx] = 3;
          this.powerCells.push(best.idx);
          taken.add(best.idx);
        }
      };

      const preferred = collectCandidates(nearMaxPreferred);
      addSpreadCandidates(preferred, powerCellMinDist, nearMaxPreferred);

      if (this.powerCells.length < minPowerTiles) {
        const relaxed = collectCandidates(POWER_NEAR_MAX);
        addSpreadCandidates(relaxed, powerCellMinDist * 0.72, POWER_NEAR_MAX);
      }
    }
    this._rebuildFeatureCells();
    this._ensureTileEnergy(true);
  }

  onResize() {
    // Keep the active battlefield in stable world coordinates. Rebuilding here
    // moves the path, feature cells, corrupted tiles, and placed turrets when
    // the browser is resized or moved between screens.
  }

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

  isCorruptionSafeCell(gx, gy, tileType = null) {
    const idx = gy * this.cols + gx;
    const v = tileType ?? this.cells[idx];
    if (v !== 1 || !this.segs?.length) return false;
    const center = this.worldFromCell(gx, gy);
    // Corruption may touch the track edge, but its tile center must stay out of
    // the actual lane so blocked tiles never spawn on top of the enemy path.
    const trackClearance = TRACK_RADIUS + Math.min(10, this.gridSize * 0.22);
    return distanceToSegmentsSquared(center.x, center.y, this.segs) >= trackClearance * trackClearance;
  }

  clearTileVisualEnergy(gx, gy) {
    const idx = gy * this.cols + gx;
    if (idx < 0 || idx >= this.cells.length) return;
    this.tileEnergy[idx] = 0;
    this.tileHeat[idx] = 0;
    this.tileMemory[idx] = 0;
    this.tileFrequency[idx] = 0;
    this.tileCorruption[idx] = 0;
    this.tileHarmony[idx] = 0;
    this.tileGrowth[idx] = 0;
    this.tileHue[idx] = 190;
    this.tileState[idx] = 0;
    this.tileShockEnergy[idx] = 0;
    this.tileEmpEnergy[idx] = 0;
    this.tileBossEnergy[idx] = 0;
    this.tileBossHue[idx] = 276;
    this.activeTileEnergy.delete(idx);
  }

  resetEcosystem() {
    this._ensureTileEnergy(true);
    this._ecosystemSeed = 1;
    this._musicSeed = 7331;
    this._lastKillPulseT = 0;
    this._lastLargeKillPulseT = 0;
    this._turretFirePulseTimes = new WeakMap();
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

  _getTileStateForCell(gx, gy, idx) {
    // Support common tile-state containers without coupling to gameplay systems.
    const fromIdx =
      this.tileStates?.[idx] ??
      this.cellStates?.[idx] ??
      this.tiles?.[idx] ??
      null;
    if (fromIdx && typeof fromIdx === "object") return fromIdx;

    const row = this.tiles?.[gy];
    if (Array.isArray(row)) {
      const fromGrid = row[gx];
      if (fromGrid && typeof fromGrid === "object") return fromGrid;
    }

    if (this.tilesByCell && typeof this.tilesByCell === "object") {
      const keyed = this.tilesByCell[idx] ?? this.tilesByCell[`${gx},${gy}`];
      if (keyed && typeof keyed === "object") return keyed;
    }

    return null;
  }

  _isBuildableCorrupted(gx, gy, idx, tileType) {
    if (tileType !== 1 && tileType !== 3) return false;
    const tile = this._getTileStateForCell(gx, gy, idx);
    return !!tile && tile.corrupted === true && this.isCorruptionSafeCell(gx, gy, tileType);
  }

  _isPowerTileLocked(gx, gy, idx, tileType) {
    if (tileType !== 3) return false;
    const tile = this._getTileStateForCell(gx, gy, idx);
    return !tile || tile.powerPurchased !== true;
  }

  _musicGridState(music) {
    const enabled = music?.enabled !== false;
    const e = music?.energy || {};
    const bass = enabled ? clamp(Number(e.bass) || 0, 0, 1) : 0;
    const mid = enabled ? clamp(Number(e.mid) || 0, 0, 1) : 0;
    const high = enabled ? clamp(Number(e.high) || 0, 0, 1) : 0;
    const intensity = enabled ? clamp(Number(e.intensity) || 0, 0, 1) : 0;
    const beat = enabled ? clamp(Number(e.beat) || 0, 0, 1) : 0;
    const snap = enabled ? clamp(Number(e.snap) || 0, 0, 1) : 0;
    const drop = enabled ? clamp(Number(e.drop) || 0, 0, 1) : 0;
    const songTempo = clamp(Number(e.tempo) || 0.5, 0, 1);
    const trackIndex = Math.max(0, Number(music?.trackIndex) || 0);
    const spectrum = enabled && Array.isArray(music?.spectrum) && music.spectrum.length
      ? music.spectrum
      : [bass, bass, mid, mid, high, high];
    // CODEX CHANGE: Accept normalized time-domain samples for true background waveform traces.
    const audioWaveform = enabled && Array.isArray(music?.audioWaveform) && music.audioWaveform.length
      ? music.audioWaveform
      : [0, 0, 0, 0];
    const time = Number.isFinite(music?.time) ? music.time : performance.now() * 0.001;
    const wave = Math.max(0, Number(music?.wave) || 0);
    const waveMax = Math.max(1, Number(music?.waveMax) || 16);
    const level = Math.max(1, Number(music?.level) || 1);
    const ecosystemSeed = Number(music?.ecosystemSeed) >>> 0 || 1;
    const boss = !!music?.boss || !!music?.bossCinematic || wave >= waveMax;
    const evolutionFromMode = Number.isFinite(music?.mode) ? clamp(music.mode | 0, 0, ECOSYSTEM_MODE_PROFILES.length - 1) : 0;
    const evolutionNextMode = Number.isFinite(music?.nextMode) ? clamp(music.nextMode | 0, evolutionFromMode, ECOSYSTEM_MODE_PROFILES.length - 1) : evolutionFromMode;
    const modeBlend = clamp(Number(music?.modeBlend) || 0, 0, 1);
    const mode = modeBlend >= 0.5 ? evolutionNextMode : evolutionFromMode;
    const evolutionStage = boss || wave >= 20 ? 5 : wave >= 15 ? 4 : wave >= 10 ? 3 : wave >= 6 ? 2 : wave >= 3 ? 1 : 0;
    const vfxQuality = music?.vfxQuality === "low" || music?.vfxQuality === "high" ? music.vfxQuality : "med";
    const qualityScale = vfxQuality === "low" ? 0.68 : vfxQuality === "high" ? 1.16 : 1;
    const bossBoost = 0;
    const activity = clamp(0.24 + intensity * 0.44 + bass * 0.16 + mid * 0.12 + high * 0.08 + songTempo * 0.18 + beat * 0.10 + snap * 0.06, 0.28, 0.98);
    const progression = clamp(wave <= 1 ? 0.18 : wave < 3 ? 0.28 : wave < 5 ? 0.42 : wave < 7 ? 0.58 : wave < 10 ? 0.72 : wave < 15 ? 0.88 : 1, 0.18, 1);
    const amp = 1.14;
    return {
      enabled,
      mode,
      evolutionFromMode,
      evolutionNextMode,
      modeBlend,
      ecosystemSeed,
      // CODEX CHANGE: Carry the persisted C-key hue rotation into every map visual renderer.
      colorShift: Number.isFinite(music?.colorShift) ? ((music.colorShift % 360) + 360) % 360 : 0,
      bass: clamp(bass * amp, 0, 1),
      mid: clamp(mid * amp, 0, 1),
      high: clamp(high * amp, 0, 1),
      intensity: clamp(intensity * amp, 0, 1),
      beat: clamp(beat * 1.08, 0, 1),
      snap: clamp(snap * 1.10, 0, 1),
      drop: clamp(drop * 1.10, 0, 1),
      songTempo,
      trackIndex,
      spectrum,
      audioWaveform,
      wave,
      waveMax,
      level,
      progression,
      evolutionStage,
      ecosystemDensity: EVOLUTION_DENSITY[evolutionStage] * qualityScale,
      mutationProfile: ECOSYSTEM_MODE_PROFILES[mode],
      simulationPaused: music?.simulationPaused === true,
      reducedMotion: music?.reducedMotion === true,
      vfxQuality,
      qualityScale,
      activity: enabled ? activity : 0,
      boss,
      bossBoost,
      amp,
      time,
      tempo: 0.78 + songTempo * 0.96 + intensity * 1.10 + bass * 0.54 + beat * 0.26
    };
  }

  _rebuildFeatureCells() {
    this.featureCells = new Set();
    const savedCells = Array.isArray(this.savedFeatureCells) ? this.savedFeatureCells : null;
    const buildNodes = this.feature?.key === "AMPLIFIER_NODES";
    const savedNodeLimit = Math.max(8, (this.feature?.zones?.length || 0) * 5);
    if (savedCells?.length && (!buildNodes || savedCells.length <= savedNodeLimit)) {
      for (const saved of this.savedFeatureCells) {
        let gx = null;
        let gy = null;
        if (Array.isArray(saved)) {
          gx = Number(saved[0]);
          gy = Number(saved[1]);
        } else if (saved && typeof saved === "object") {
          gx = Number(saved.gx);
          gy = Number(saved.gy);
        } else {
          const idx = Number(saved);
          if (Number.isFinite(idx)) {
            gx = idx % this.cols;
            gy = Math.floor(idx / this.cols);
          }
        }
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
        gx = gx | 0;
        gy = gy | 0;
        if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) continue;
        const idx = gy * this.cols + gx;
        if (this.cells[idx] === 1 || this.cells[idx] === 2) this.featureCells.add(idx);
      }
      return;
    }
    if (!this.feature?.zones?.length) return;
    if (buildNodes) {
      this._rebuildAmplifierNodeCells();
      return;
    }
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (buildNodes ? v !== 1 : v !== 2) continue;
        const w = this.worldFromCell(gx, gy);
        let nearestU = 0;
        let nearestD = Infinity;
        for (const s of this.segs) {
          const vx = s.bx - s.ax;
          const vy = s.by - s.ay;
          const len2 = vx * vx + vy * vy || 1;
          const t = clamp(((w.x - s.ax) * vx + (w.y - s.ay) * vy) / len2, 0, 1);
          const qx = s.ax + vx * t;
          const qy = s.ay + vy * t;
          const d = dist2(w.x, w.y, qx, qy);
          if (d < nearestD) {
            nearestD = d;
            nearestU = ((s.cum || 0) + (s.len || 0) * t) / Math.max(1, this.totalLen);
          }
        }
        if (buildNodes && (nearestD < 32 * 32 || nearestD > 92 * 92)) continue;
        if (this.feature.zones.some((zone) => Math.abs(nearestU - zone.u) <= zone.span)) {
          this.featureCells.add(idx);
        }
      }
    }
  }

  _rebuildAmplifierNodeCells() {
    const selected = [];
    const spacingTiles = 2;
    const maxPerZone = 4;
    const maxTotal = Math.min(18, Math.max(8, this.feature.zones.length * maxPerZone));
    const hash01 = (gx, gy, zi) => {
      let n = (gx * 73856093) ^ (gy * 19349663) ^ ((zi + 1) * 83492791) ^ (this.seed || 0);
      n = Math.imul(n ^ (n >>> 16), 2246822519);
      n = Math.imul(n ^ (n >>> 13), 3266489917);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    const tooClose = (cell) => selected.some((s) => {
      const dx = Math.abs(s.gx - cell.gx);
      const dy = Math.abs(s.gy - cell.gy);
      return dx <= spacingTiles && dy <= spacingTiles;
    });

    for (let zi = 0; zi < this.feature.zones.length && selected.length < maxTotal; zi++) {
      const zone = this.feature.zones[zi];
      const candidates = [];
      for (let gy = 0; gy < this.rows; gy++) {
        for (let gx = 0; gx < this.cols; gx++) {
          const idx = gy * this.cols + gx;
          if (this.cells[idx] !== 1) continue;
          const w = this.worldFromCell(gx, gy);
          let nearestU = 0;
          let nearestD = Infinity;
          for (const s of this.segs) {
            const vx = s.bx - s.ax;
            const vy = s.by - s.ay;
            const len2 = vx * vx + vy * vy || 1;
            const t = clamp(((w.x - s.ax) * vx + (w.y - s.ay) * vy) / len2, 0, 1);
            const qx = s.ax + vx * t;
            const qy = s.ay + vy * t;
            const d = dist2(w.x, w.y, qx, qy);
            if (d < nearestD) {
              nearestD = d;
              nearestU = ((s.cum || 0) + (s.len || 0) * t) / Math.max(1, this.totalLen);
            }
          }
          if (Math.abs(nearestU - zone.u) > zone.span) continue;
          if (nearestD < 34 * 34 || nearestD > 96 * 96) continue;
          const trackBand = 1 - Math.min(1, Math.abs(Math.sqrt(nearestD) - 64) / 32);
          const zoneFit = 1 - Math.min(1, Math.abs(nearestU - zone.u) / Math.max(0.001, zone.span));
          const score = zoneFit * 1.25 + trackBand * 0.85 + hash01(gx, gy, zi) * 0.22;
          candidates.push({ gx, gy, idx, score });
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      let pickedInZone = 0;
      for (const cell of candidates) {
        if (pickedInZone >= maxPerZone || selected.length >= maxTotal) break;
        if (tooClose(cell)) continue;
        selected.push(cell);
        pickedInZone += 1;
      }
    }

    for (const cell of selected) this.featureCells.add(cell.idx);
  }

  featureAtCell(gx, gy) {
    const idx = gy * this.cols + gx;
    return this.featureCells.has(idx) ? this.feature : null;
  }

  featureAtPathD(pathD) {
    if (!this.feature?.zones?.length) return null;
    const u = clamp((Number(pathD) || 0) / Math.max(1, this.totalLen), 0, 1);
    return this.feature.zones.some((zone) => Math.abs(u - zone.u) <= zone.span) ? this.feature : null;
  }

  _drawMapFeature(gfx) {
    if (!this.feature || !this.featureCells.size) return;
    const t = performance.now() * 0.001;
    const color = this.feature.color || "rgba(154,108,255,0.92)";
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (const idx of this.featureCells) {
      const gx = idx % this.cols;
      const gy = Math.floor(idx / this.cols);
      const x = gx * this.gridSize;
      const y = gy * this.gridSize;
      if (this.feature.key === "AMPLIFIER_NODES" && this._isBuildableCorrupted(gx, gy, idx, this.cells[idx])) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + gx * 0.7 + gy * 0.5);
      if (this.feature.key === "AMPLIFIER_NODES") {
        const cx = x + this.gridSize * 0.5;
        const cy = y + this.gridSize * 0.5;
        const pad = 9;
        gfx.globalAlpha = 0.07 + pulse * 0.08;
        gfx.fillStyle = color;
        gfx.fillRect(x + pad, y + pad, this.gridSize - pad * 2, this.gridSize - pad * 2);
        gfx.globalAlpha = 0.34 + pulse * 0.22;
        gfx.strokeStyle = color;
        gfx.lineWidth = 1.5;
        gfx.strokeRect(x + pad - 1.5, y + pad - 1.5, this.gridSize - pad * 2 + 3, this.gridSize - pad * 2 + 3);
        gfx.globalAlpha = 0.46 + pulse * 0.28;
        gfx.beginPath();
        gfx.arc(cx, cy, this.gridSize * (0.15 + pulse * 0.03), 0, Math.PI * 2);
        gfx.stroke();
        gfx.globalAlpha = 0.54 + pulse * 0.26;
        gfx.beginPath();
        gfx.moveTo(cx - this.gridSize * 0.18, cy);
        gfx.lineTo(cx + this.gridSize * 0.18, cy);
        gfx.moveTo(cx, cy - this.gridSize * 0.18);
        gfx.lineTo(cx, cy + this.gridSize * 0.18);
        gfx.stroke();
        continue;
      }
      gfx.globalAlpha = 0.10 + pulse * 0.10;
      gfx.fillStyle = color;
      gfx.fillRect(x + 5, y + 5, this.gridSize - 10, this.gridSize - 10);
      gfx.globalAlpha = 0.24 + pulse * 0.18;
      gfx.strokeStyle = color;
      gfx.lineWidth = 1.2;
      gfx.strokeRect(x + 4.5, y + 4.5, this.gridSize - 9, this.gridSize - 9);
      gfx.globalAlpha = 0.42 + pulse * 0.20;
      gfx.beginPath();
      gfx.moveTo(x + 9, y + this.gridSize * 0.5);
      gfx.lineTo(x + this.gridSize - 9, y + this.gridSize * 0.5);
      gfx.stroke();
    }
    gfx.restore();
  }

  // CODEX CHANGE: Shift gently within the chosen C palette as phrases, beats, snaps, and drops arrive.
  _musicColorDrift(m) {
    const phrase = Math.sin(m.time * (0.20 + m.songTempo * 0.16) + m.trackIndex * 0.73) * (5 + m.mid * 7);
    const shimmer = Math.sin(m.time * (1.10 + m.songTempo * 0.82) + m.trackIndex * 1.31) * m.high * 4.5;
    const polarity = Math.sin(m.time * (2.15 + m.songTempo * 1.55) + m.trackIndex) >= 0 ? 1 : -1;
    const transient = polarity * (m.beat * 9 - m.snap * 6) + m.drop * 14;
    const spectrumBias = (m.high - m.bass) * 4.5;
    return phrase + shimmer + transient + spectrumBias;
  }

  _musicHue(m, offset = 0) {
    // CODEX CHANGE: Share the same restrained musical color drift with legacy grid helpers.
    return (188 + (m.colorShift || 0) + this._musicColorDrift(m) + offset + m.level * 11 + m.trackIndex * 17 + m.intensity * 16) % 360;
  }

  _musicPalette(m, modeOverride = m.mode) {
    const normalizedMode = ((modeOverride % ECOSYSTEM_MODE_PROFILES.length) + ECOSYSTEM_MODE_PROFILES.length) % ECOSYSTEM_MODE_PROFILES.length;
    if (normalizedMode === m.mode && m._palette) return m._palette;
    const palettes = [
      { name: "Synthwave Equalizer", hues: [292, 316, 338, 190, 206, 232], spark: 184, style: "bars", solid: 318, accent: 190 },
      { name: "Neon Ocean", hues: [188, 198, 210, 224, 248, 174], spark: 184, style: "tide", solid: 196, accent: 174 },
      { name: "Plasma Storm", hues: [278, 304, 328, 18, 42, 194], spark: 42, style: "storm", solid: 328, accent: 38 },
      { name: "Quantum Grid", hues: [116, 142, 166, 190, 224, 270], spark: 160, style: "lattice", solid: 154, accent: 270 },
      { name: "Orbital Echo Rings", hues: [198, 228, 258, 292, 324, 42], spark: 198, style: "rings", solid: 226, accent: 42 },
      { name: "Digital Rain", hues: [112, 132, 154, 176, 194, 220], spark: 148, style: "rain", solid: 138, accent: 194 },
      { name: "Energy Lattice", hues: [42, 66, 164, 188, 212, 292], spark: 52, style: "lattice", solid: 188, accent: 52 },
      { name: "Cyber Pulse", hues: [338, 6, 28, 190, 224, 284], spark: 32, style: "pulse", solid: 6, accent: 190 },
      { name: "Aurora Field", hues: [136, 164, 188, 218, 268, 318], spark: 166, style: "aurora", solid: 188, accent: 318 },
      { name: "Cosmic Reactor", hues: [18, 38, 54, 188, 236, 312], spark: 48, style: "reactor", solid: 38, accent: 188 }
    ];
    // CODEX CHANGE: Keep C as the base family while the playing track subtly alternates its hues.
    const base = palettes[normalizedMode];
    const songIdentity = ((m.ecosystemSeed >>> 8) % 97) * 0.37 + (m.bass * 18 - m.high * 11);
    const shift = (Number.isFinite(m.colorShift) ? m.colorShift : 0) + songIdentity + this._musicColorDrift(m);
    const rotate = (hue) => ((hue + shift) % 360 + 360) % 360;
    const palette = {
      ...base,
      hues: base.hues.map(rotate),
      spark: rotate(base.spark),
      solid: rotate(base.solid),
      accent: rotate(base.accent)
    };
    if (normalizedMode === m.mode) m._palette = palette;
    return palette;
  }

  _musicRand() {
    this._musicSeed = (this._musicSeed * 1664525 + 1013904223) >>> 0;
    return this._musicSeed / 4294967296;
  }

  _ensureTileEnergy(reset = false) {
    const n = Math.max(0, this.cols * this.rows);
    if (!reset && this.tileEnergy?.length === n && this.tileGrowth?.length === n && this.tileBossHue?.length === n) return;
    this.tileEnergy = new Float32Array(n);
    this.tileHeat = new Float32Array(n);
    this.tileMemory = new Float32Array(n);
    this.tileFrequency = new Float32Array(n);
    this.tileCorruption = new Float32Array(n);
    this.tileHarmony = new Float32Array(n);
    this.tileGrowth = new Float32Array(n);
    this.tileHue = new Float32Array(n);
    this.tileHue.fill(190);
    this.tileState = new Uint8Array(n);
    this.tileShockEnergy = new Float32Array(n);
    this.tileEmpEnergy = new Float32Array(n);
    this.tileBossEnergy = new Float32Array(n);
    this.tileBossHue = new Float32Array(n);
    this.tileBossHue.fill(276);
    this.activeTileEnergy = new Set();
    this.musicWaves = [];
    this.globalMusicPulses = [];
    this._musicLastT = 0;
    this._musicLastBeat = 0;
    this._musicLastSnap = 0;
    this._musicLastDrop = 0;
    this._musicLastSpawn = 0;
    this._ecosystemAccumulator = 0;
    this._ecosystemBossActive = false;
    this._ecosystemMutation = 0;
    this._ecosystemCandidates.clear();
    this._ecosystemDrawActive.length = 0;
  }

  _pickMusicOrigin(preferPath = false) {
    if (preferPath && this.pathPts?.length) {
      const p = this.pathPts[Math.floor(this._musicRand() * this.pathPts.length)] || this.pathPts[0];
      return { x: p[0], y: p[1] };
    }
    for (let tries = 0; tries < 24; tries++) {
      const gx = MAP_EDGE_MARGIN + Math.floor(this._musicRand() * Math.max(1, this.cols - MAP_EDGE_MARGIN * 2));
      const gy = MAP_EDGE_MARGIN + Math.floor(this._musicRand() * Math.max(1, this.rows - MAP_EDGE_MARGIN * 2));
      const idx = gy * this.cols + gx;
      const v = this.cells[idx];
      if ((v === 1 || v === 3) && !this._isBuildableCorrupted(gx, gy, idx, v)) {
        return { x: (gx + 0.5) * this.gridSize, y: (gy + 0.5) * this.gridSize };
      }
    }
    return { x: W * 0.5, y: H * 0.5 };
  }

  _isProtectedGridWave(wave) {
    return wave?.kind === "largeKill"
      || wave?.kind === "largeKillEcho"
      || wave?.kind === "empPulse"
      || wave?.kind === "empEcho"
      || wave?.kind === "empKill"
      || wave?.kind === "pulseBurstKill"
      || wave?.kind === "overchargeKill"
      || wave?.kind === "miniBossKill"
      || wave?.kind === "mainBossKill";
  }

  _trimMusicWaves(maxDecorative = 4, maxTotal = 16) {
    let decorative = this.musicWaves.filter((wave) => !this._isProtectedGridWave(wave)).length;
    for (let i = 0; decorative > maxDecorative && i < this.musicWaves.length;) {
      if (this._isProtectedGridWave(this.musicWaves[i])) {
        i++;
        continue;
      }
      this.musicWaves.splice(i, 1);
      decorative--;
    }
    while (this.musicWaves.length > maxTotal) {
      const decorativeIndex = this.musicWaves.findIndex((wave) => !this._isProtectedGridWave(wave));
      this.musicWaves.splice(decorativeIndex >= 0 ? decorativeIndex : 0, 1);
    }
  }

  _spawnMusicWave(m, kind = "pulse", boss = false) {
    const palette = this._musicPalette(m);
    const origin = (kind === "ripple" || kind === "drop") && this.pathPts?.length
      ? { x: this.pathPts[0][0], y: this.pathPts[0][1] }
      : this._pickMusicOrigin(kind === "echo" || kind === "snap");
    const hue = palette.hues[Math.floor(this._musicRand() * palette.hues.length)] || palette.hues[0];
    const wave = {
      kind,
      x: origin.x,
      y: origin.y,
      age: 0,
      life: kind === "drop" ? 2.15 : kind === "snap" ? 1.12 : boss ? 1.95 : kind === "echo" ? 1.65 : 1.32,
      speed: (128 + m.tempo * 86 + m.activity * 68) * (kind === "drop" ? 1.24 : kind === "snap" ? 1.64 : boss ? 1.12 : 1),
      width: this.gridSize * (kind === "drop" ? 0.66 : kind === "snap" ? 0.24 : kind === "echo" ? 0.52 : 0.40) * (boss ? 1.35 : 1),
      amp: clamp((kind === "drop" ? 0.62 : kind === "snap" ? 0.40 : kind === "echo" ? 0.34 : 0.28) + (kind === "snap" ? m.high : m.bass) * 0.34 + m.intensity * 0.12 + (boss ? 0.14 : 0), 0.22, 0.92),
      hue,
      state: kind === "drop" || kind === "echo" || kind === "snap" ? 3 : kind === "ripple" ? 2 : 1
    };
    this.musicWaves.push(wave);
    this._trimMusicWaves(boss ? 10 : 7);
  }

  triggerKillPulse(x, y, strong = false) {
    const now = performance.now() * 0.001;
    const beatAmp = this._musicLastBeat > 0.22 ? 0.10 : 0;
    const gap = strong ? 0.10 : 0.24;
    // Simulation injection is never throttled: every death remains in the level's history.
    this._injectEcosystemAt(x, y, strong ? 0.58 : 0.30, strong ? 0.18 : 0.62, strong ? 0.04 : 0, strong ? 3 : 2);
    if (now - this._lastKillPulseT < gap) return;
    this._lastKillPulseT = now;
    this.musicWaves.push({
      kind: "kill",
      x,
      y,
      age: 0,
      life: strong ? 1.05 : 0.72,
      speed: strong ? 270 : 225,
      width: this.gridSize * (strong ? 0.58 : 0.34),
      amp: (strong ? 0.44 : 0.22) + beatAmp,
      hue: strong ? 42 : [188, 214, 272, 318, 142][Math.floor(this._musicRand() * 5)],
      state: 3
    });
    this._trimMusicWaves(8);
  }

  triggerTurretFirePulse(turret, target = null) {
    if (!this._ecosystemEnabled || !turret) return;
    const now = performance.now() * 0.001;
    const last = this._turretFirePulseTimes.get(turret) || -Infinity;
    const level = Math.max(1, Number(turret.level) || 1);
    const frequency = this._turretFrequency(turret);

    // Every shot reaches the retained tile field, even when its short ring is rate-limited.
    this._injectEcosystemAt(
      turret.x,
      turret.y,
      clamp(0.14 + level * 0.025 + (Number(turret.flash) || 0) * 0.08, 0.14, 0.34),
      frequency,
      0,
      level >= 4 ? 2 : 1
    );

    if (now - last < 0.065) return;
    this._turretFirePulseTimes.set(turret, now);
    const colorShift = Number(this._lastMusicGrid?.colorShift) || 0;
    this.musicWaves.push({
      kind: "turretFire",
      x: turret.x,
      y: turret.y,
      targetX: Number(target?.x),
      targetY: Number(target?.y),
      age: 0,
      life: 0.30 + level * 0.025,
      speed: 118 + level * 14,
      amp: clamp(0.26 + level * 0.035, 0.26, 0.46),
      hue: (160 + frequency * 220 + colorShift) % 360
    });
  }

  triggerLargeKillPulse(x, y) {
    const now = performance.now() * 0.001;
    if (now - this._lastLargeKillPulseT < 0.22) return;
    this._lastLargeKillPulseT = now;
    this._injectEcosystemAt(x, y, 0.78, 0.08, 0.12, 4);
    const m = this._lastMusicGrid || this._musicGridState(null);
    const palette = this._musicPalette(m);
    const musicHue = palette.hues[Math.floor(this._musicRand() * palette.hues.length)] || palette.hues[0];
    const beatAmp = this._musicLastBeat > 0.22 ? 0.12 : 0;
    this.musicWaves.push({
      kind: "largeKill",
      x,
      y,
      age: 0,
      life: 4.65,
      speed: 282 + m.tempo * 44,
      width: this.gridSize * 0.48,
      amp: 0.92 + beatAmp,
      hue: 2,
      state: 5
    });
    this.musicWaves.push({
      kind: "largeKillEcho",
      x,
      y,
      age: -0.24,
      life: 4.25,
      speed: 302 + m.tempo * 48,
      width: this.gridSize * 0.34,
      amp: 0.58 + beatAmp * 0.7,
      hue: musicHue,
      state: 3
    });
    this._trimMusicWaves(8);
  }

  triggerEmpPulse() {
    const x = W * 0.5;
    const y = H * 0.5;
    this.musicWaves.push({
      kind: "empPulse",
      x,
      y,
      age: 0,
      life: 4.2,
      speed: 245,
      width: this.gridSize * 0.96,
      amp: 1.08,
      hue: 192,
      state: 6
    });
    this.musicWaves.push({
      kind: "empEcho",
      x,
      y,
      age: -0.34,
      life: 4.4,
      speed: 265,
      width: this.gridSize * 0.58,
      amp: 0.78,
      hue: 212,
      state: 6
    });
    this._trimMusicWaves(8);
  }

  triggerAbilityActivationPulse(kind, x, y) {
    const pulseBurst = kind === "pulseBurst";
    const hue = pulseBurst ? 282 : 44;
    this.musicWaves.push({
      kind: pulseBurst ? "pulseBurstKill" : "overchargeKill",
      x,
      y,
      age: 0,
      life: pulseBurst ? 1.9 : 2.4,
      speed: pulseBurst ? 196 : 224,
      width: this.gridSize * (pulseBurst ? 0.48 : 0.58),
      amp: pulseBurst ? 0.68 : 0.78,
      hue,
      state: 7
    });
    this._trimMusicWaves(8);
  }

  triggerAbilityKillPulse(x, y, kind, strong = false) {
    const isEmp = kind === "emp";
    const pulseBurst = kind === "pulseBurst";
    const waveKind = isEmp ? "empKill" : pulseBurst ? "pulseBurstKill" : "overchargeKill";
    const hue = isEmp ? 198 : pulseBurst ? 286 : 44;
    const beatAmp = this._musicLastBeat > 0.22 ? 0.12 : 0;
    const count = strong ? 2 : 1;
    this._injectEcosystemAt(x, y, strong ? 0.62 : 0.34, isEmp ? 0.74 : pulseBurst ? 0.44 : 0.12, isEmp ? 0.03 : 0, strong ? 3 : 2);
    for (let i = 0; i < count; i++) {
      this.musicWaves.push({
        kind: waveKind,
        x,
        y,
        age: -i * 0.15,
        life: isEmp ? 2.8 : strong ? 2.45 : 1.8,
        speed: (isEmp ? 248 : pulseBurst ? 226 : 238) + i * 22,
        width: this.gridSize * (isEmp ? 0.58 : 0.44),
        amp: (strong ? 0.78 : 0.58) + beatAmp,
        hue,
        state: isEmp ? 6 : 7
      });
    }
    this._trimMusicWaves(8);
  }

  triggerBossKillPulse(x, y, mainBoss = false) {
    this._injectEcosystemAt(x, y, mainBoss ? 1 : 0.86, mainBoss ? 0.96 : 0.82, mainBoss ? 0.34 : 0.20, mainBoss ? 7 : 5);
    const hues = mainBoss ? [42, 52, 34] : [276, 292, 264];
    const beatAmp = this._musicLastBeat > 0.22 ? 0.12 : 0;
    for (let i = 0; i < hues.length; i++) {
      this.musicWaves.push({
        kind: mainBoss ? "mainBossKill" : "miniBossKill",
        x,
        y,
        age: -i * 0.12,
        life: mainBoss ? 4.6 : 3.35,
        speed: (mainBoss ? 298 : 258) + i * 30,
        width: this.gridSize * (mainBoss ? 0.62 : 0.48),
        amp: (mainBoss ? 0.78 : 0.62) - i * 0.06 + beatAmp,
        hue: hues[i],
        state: 3
      });
    }
    this._trimMusicWaves(8);
  }

  _spawnGlobalPulse(m, kind = "sweep") {
    const palette = this._musicPalette(m);
    this.globalMusicPulses.push({
      kind,
      age: 0,
      life: kind === "flash" ? 0.55 : 1.8,
      hue: palette.hues[Math.floor(this._musicRand() * palette.hues.length)] || palette.hues[0],
      dir: this._musicRand() > 0.5 ? 1 : -1,
      offset: this._musicRand()
    });
    const max = m.boss ? 3 : 2;
    if (this.globalMusicPulses.length > max) this.globalMusicPulses.splice(0, this.globalMusicPulses.length - max);
  }

  _getNebulaSprite(hue) {
    const key = Math.round(hue) % 360;
    let sprite = this._nebulaSprites.get(key);
    if (sprite) return sprite;
    sprite = document.createElement("canvas");
    sprite.width = 160;
    sprite.height = 160;
    const spriteGfx = sprite.getContext("2d");
    const gradient = spriteGfx.createRadialGradient(80, 80, 0, 80, 80, 80);
    gradient.addColorStop(0, `hsla(${key}, 100%, 58%, 0.90)`);
    gradient.addColorStop(0.48, `hsla(${(key + 34) % 360}, 100%, 42%, 0.42)`);
    gradient.addColorStop(1, `hsla(${key}, 100%, 30%, 0)`);
    spriteGfx.fillStyle = gradient;
    spriteGfx.fillRect(0, 0, 160, 160);
    // Color variants are finite, but keep hot reloads and unusual inputs bounded.
    if (this._nebulaSprites.size >= 24) this._nebulaSprites.clear();
    this._nebulaSprites.set(key, sprite);
    return sprite;
  }

  // CODEX CHANGE: Turn the empty background into a music-driven journey from launch to hyperspace.
  _drawSpaceFlight(gfx, m, perf) {
    if (!m.enabled) return;
    const palette = this._musicPalette(m);
    const chapter = m.boss || m.progression > 0.82 ? 2 : m.progression > 0.38 ? 1 : 0;
    const speed = (0.055 + m.songTempo * 0.055 + m.intensity * 0.105 + m.bass * 0.075 + m.beat * 0.055)
      * (chapter === 2 ? 1.75 : chapter === 1 ? 1.28 : 0.92);
    const cx = W * (0.50 + Math.sin(m.time * 0.11) * 0.035 + (m.mid - 0.5) * 0.018);
    const cy = H * (0.40 + Math.cos(m.time * 0.09) * 0.025 + (m.high - 0.5) * 0.012);
    const maxR = Math.hypot(W, H) * 0.72;
    // CODEX CHANGE: Keep space motion atmospheric now that real waveforms carry the musical foreground.
    const starCount = perf < 0.7 ? 24 + chapter * 4 : 38 + chapter * 7;
    const hash = (n) => {
      const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
      return v - Math.floor(v);
    };

    gfx.save();
    gfx.globalCompositeOperation = "lighter";

    // Three drifting nebula chapters establish launch, cruise, and late-level storm colors.
    for (let cloud = 0; cloud < 3; cloud++) {
      const drift = m.time * (0.012 + cloud * 0.004);
      const nx = W * (0.22 + cloud * 0.31 + Math.sin(drift + cloud * 2.2) * 0.12);
      const ny = H * (0.28 + (cloud % 2) * 0.38 + Math.cos(drift * 1.3 + cloud) * 0.10);
      const radius = Math.max(W, H) * (0.28 + cloud * 0.055 + m.mid * 0.05);
      const cloudHue = palette.hues[(cloud + chapter * 2) % palette.hues.length];
      const nebula = this._getNebulaSprite(cloudHue);
      gfx.globalAlpha = 0.026 + m.mid * 0.025 + m.intensity * 0.012 + chapter * 0.008;
      gfx.drawImage(nebula, nx - radius, ny - radius, radius * 2, radius * 2);
    }

    // Perspective stars accelerate outward on bass hits and stretch into hyperspace late in the level.
    gfx.lineCap = "round";
    for (let i = 0; i < starCount; i++) {
      const angle = hash(i + 1) * Math.PI * 2;
      const lane = 0.42 + hash(i + 41) * 0.68;
      const rate = speed * (0.68 + hash(i + 83) * 0.72);
      const cycle = (hash(i + 127) + m.time * rate) % 1;
      const perspective = Math.pow(cycle, 1.82);
      const band = m.spectrum[i % m.spectrum.length] || m.intensity;
      const streak = 0.005 + band * 0.014 + m.bass * 0.008 + m.beat * 0.015 + chapter * 0.006;
      const previous = Math.max(0, Math.pow(Math.max(0, cycle - streak), 1.82));
      const radius = perspective * maxR * lane;
      const previousRadius = previous * maxR * lane;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const px = cx + Math.cos(angle) * previousRadius;
      const py = cy + Math.sin(angle) * previousRadius;
      const starHue = palette.hues[(i + chapter) % palette.hues.length];
      gfx.globalAlpha = clamp(0.025 + perspective * 0.12 + band * 0.07 + m.beat * 0.04, 0.02, 0.22);
      gfx.strokeStyle = `hsla(${starHue}, 100%, ${72 + band * 18}%, 0.94)`;
      gfx.lineWidth = 0.45 + perspective * 0.72 + band * 0.38 + (chapter === 2 ? 0.20 : 0);
      gfx.beginPath();
      gfx.moveTo(px, py);
      gfx.lineTo(x, y);
      gfx.stroke();
    }

    // The vanishing-point gate becomes more active as the defence approaches its boss encounter.
    const gateEnergy = clamp(0.16 + m.mid * 0.30 + m.beat * 0.42 + m.drop * 0.60 + chapter * 0.15, 0, 1);
    for (let ring = 0; ring < 3; ring++) {
      const ringCycle = (m.time * (0.18 + speed) + ring / 3) % 1;
      const radius = this.gridSize * (0.45 + ringCycle * (2.8 + chapter * 1.6 + m.drop * 2.4));
      gfx.globalAlpha = clamp((1 - ringCycle) * gateEnergy * 0.16, 0, 0.20);
      gfx.strokeStyle = `hsla(${palette.hues[(ring + 2) % palette.hues.length]}, 100%, 72%, 0.90)`;
      gfx.lineWidth = 0.8 + m.beat * 1.5;
      gfx.beginPath();
      gfx.ellipse(cx, cy, radius * 1.65, radius * 0.72, Math.sin(m.time * 0.08) * 0.18, 0, Math.PI * 2);
      gfx.stroke();
    }
    gfx.restore();
  }

  _traceSmoothMusicPath(gfx, points) {
    if (!points?.length) return;
    gfx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) return;
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      gfx.quadraticCurveTo(current.x, current.y, (current.x + next.x) * 0.5, (current.y + next.y) * 0.5);
    }
    const last = points[points.length - 1];
    gfx.lineTo(last.x, last.y);
  }

  // CODEX CHANGE: Two persistent oscilloscope channels evolve from clean traces
  // into layered, traveling signal organisms without losing real audio response.
  _drawAudioWaveforms(gfx, m, perf) {
    const samples = m.audioWaveform;
    if (!m.enabled || !samples?.length) return;
    const palette = this._musicPalette(m);
    const stage = clamp(Number(m.evolutionStage) || 0, 0, 5);
    const progression = clamp(Number(m.progression) || 0, 0, 1);
    const fromMode = Number.isFinite(m.evolutionFromMode) ? m.evolutionFromMode : m.mode;
    const nextMode = Number.isFinite(m.evolutionNextMode) ? m.evolutionNextMode : fromMode;
    const identity = lerp(fromMode, nextMode, clamp(Number(m.modeBlend) || 0, 0, 1));
    const pointCount = Math.max(48, Math.min(samples.length, perf < 0.7 ? 72 : 128));
    // Keep these channels atmospheric: music changes their shape clearly, but
    // their motion and contrast stay below gameplay silhouettes and projectiles.
    const amplitude = this.gridSize * (0.52 + m.intensity * 0.94 + m.bass * 0.58 + m.beat * 0.36 + m.drop * 0.52);

    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    gfx.lineJoin = "round";
    for (let layer = 0; layer < 2; layer++) {
      const direction = layer === 0 ? 1 : -1;
      const laneCenter = layer === 0 ? 0.25 : 0.69;
      const laneTravel = Math.sin(m.time * (0.105 + layer * 0.028) + identity * 0.61 + layer * 2.4)
        * H * (0.010 + progression * 0.018);
      const beatBuoyancy = direction * (m.beat * H * 0.006 + m.drop * H * 0.014);
      const baseline = H * laneCenter + laneTravel + beatBuoyancy + (m.mid - 0.5) * H * 0.010 * direction;
      const layerScale = layer === 0 ? 1 : 0.82;
      const hue = (palette.hues[(layer * 3 + 1) % palette.hues.length]
        + identity * 4.5 + Math.sin(m.time * 0.12 + layer * 2.1) * (5 + progression * 7) + 360) % 360;
      const points = this._musicPathBuffers[layer];
      points.length = pointCount;
      for (let i = 0; i < pointCount; i++) {
        const p = i / Math.max(1, pointCount - 1);
        const sourceIndex = Math.floor(p * Math.max(0, samples.length - 1));
        const sampleIndex = layer === 0 ? sourceIndex : samples.length - 1 - sourceIndex;
        const x = p * W;
        const edgeFade = Math.sin(p * Math.PI);
        const bandIndex = Math.floor(p * Math.max(0, m.spectrum.length - 1));
        const band = m.spectrum[bandIndex] || m.intensity;
        const carrierCycles = 1.35 + (identity % 4) * 0.24 + stage * 0.11 + layer * 0.22;
        const carrier = Math.sin(p * Math.PI * 2 * carrierCycles
          + m.time * (0.32 + m.tempo * 0.28) * direction + layer * 1.9)
          * this.gridSize * (0.05 + progression * 0.14 + band * 0.08);
        const harmonic = Math.sin(p * Math.PI * 2 * (3.2 + stage * 0.38)
          - m.time * (0.21 + m.high * 0.34) * direction + identity)
          * this.gridSize * (0.018 + m.high * 0.060 + m.snap * 0.045);
        const y = baseline
          + samples[sampleIndex] * amplitude * layerScale * (0.64 + edgeFade * 0.36)
          + carrier + harmonic;
        const point = points[i] || (points[i] = { x: 0, y: 0 });
        point.x = x;
        point.y = y;
      }

      // A restrained atmosphere stroke gives depth without returning to fat cables.
      gfx.beginPath();
      this._traceSmoothMusicPath(gfx, points);
      gfx.globalAlpha = clamp(0.018 + m.intensity * 0.032 + m.beat * 0.022, 0.016, 0.075);
      gfx.strokeStyle = `hsla(${hue}, 100%, 62%, 0.72)`;
      gfx.lineWidth = 1.7 + m.bass * 0.75 + m.drop * 0.45;
      gfx.stroke();

      // The core remains a fine, high-resolution waveform driven by the analyzer.
      gfx.beginPath();
      this._traceSmoothMusicPath(gfx, points);
      gfx.globalAlpha = clamp(0.14 + m.intensity * 0.15 + m.beat * 0.10 + m.snap * 0.055, 0.13, 0.42);
      gfx.strokeStyle = `hsla(${(hue + (layer ? 22 : 0)) % 360}, 100%, 78%, 0.94)`;
      gfx.lineWidth = 0.78 + m.beat * 0.48 + m.drop * 0.26;
      gfx.stroke();

      // As the level evolves, a displaced phase filament appears behind each channel.
      if (stage >= 1) {
        const depthOffset = direction * this.gridSize
          * (0.22 + stage * 0.060 + Math.sin(m.time * 0.24 + layer) * 0.055 + m.drop * 0.16);
        gfx.save();
        gfx.translate(0, depthOffset);
        gfx.beginPath();
        this._traceSmoothMusicPath(gfx, points);
        gfx.globalAlpha = clamp(0.065 + progression * 0.085 + m.high * 0.045, 0.06, 0.20);
        gfx.strokeStyle = `hsla(${(hue + 44 + layer * 18) % 360}, 100%, 68%, 0.80)`;
        gfx.lineWidth = 0.52 + stage * 0.045;
        if (stage >= 2) {
          gfx.setLineDash([5 + m.high * 7, 12 + (1 - m.intensity) * 12]);
          gfx.lineDashOffset = -m.time * (18 + m.tempo * 28) * direction;
        }
        gfx.stroke();
        gfx.setLineDash([]);
        gfx.restore();

        if (stage >= 3) {
          const ribCount = perf < 0.7 ? 6 : 10;
          gfx.globalAlpha = clamp(0.025 + progression * 0.040 + m.beat * 0.025, 0.022, 0.10);
          gfx.strokeStyle = `hsla(${(hue + 34) % 360}, 100%, 74%, 0.82)`;
          gfx.lineWidth = 0.6;
          gfx.beginPath();
          for (let rib = 1; rib <= ribCount; rib++) {
            const index = Math.floor(rib / (ribCount + 1) * (points.length - 1));
            const point = points[index];
            const ribBreath = 0.70 + 0.22 * Math.sin(m.time * (0.65 + m.tempo * 0.35) + rib * 1.7 + layer);
            gfx.moveTo(point.x, point.y + depthOffset * 0.12);
            gfx.lineTo(point.x, point.y + depthOffset * ribBreath);
          }
          gfx.stroke();
        }

        // Moving signal packets and short depth bridges make later channels feel alive.
        if (stage >= 2 && !m.reducedMotion) {
          const packetCount = Math.min(1 + stage, perf < 0.7 ? 3 : 5);
          for (let packet = 0; packet < packetCount; packet++) {
            const travel = (m.time * (0.075 + m.tempo * 0.055 + packet * 0.004)
              * direction + packet / packetCount + layer * 0.31 + 2) % 1;
            const index = clamp(Math.floor(travel * (points.length - 1)), 0, points.length - 1);
            const point = points[index];
            const packetPulse = 0.55 + 0.45 * Math.sin(m.time * (3.2 + m.tempo * 2.4) + packet * 2.1);
            gfx.globalAlpha = clamp(0.08 + m.high * 0.12 + m.snap * 0.12 + packetPulse * 0.055, 0.07, 0.31);
            gfx.strokeStyle = `hsla(${(hue + 62 + packet * 9) % 360}, 100%, 78%, 0.92)`;
            gfx.lineWidth = 0.65;
            gfx.beginPath();
            gfx.moveTo(point.x, point.y + depthOffset * 0.18);
            gfx.lineTo(point.x, point.y + depthOffset * (0.68 + packetPulse * 0.22));
            gfx.stroke();
            gfx.fillStyle = `hsla(${(hue + 28) % 360}, 100%, 84%, 0.94)`;
            gfx.beginPath();
            gfx.arc(point.x, point.y, 0.75 + packetPulse * 0.90 + m.beat * 0.65, 0, Math.PI * 2);
            gfx.fill();
          }
        }
      }
    }
    gfx.setLineDash([]);
    gfx.restore();
  }

  _drawGlobalMapVisuals(gfx, m, perf) {
    // CODEX CHANGE: Keep ambient music motion at 4K by reducing density instead of disabling it.
    const activity = clamp(m.activity || 0.1, 0.1, 1);
    for (const pulse of this.globalMusicPulses) pulse.age += 0.016;
    let livePulseCount = 0;
    for (let i = 0; i < this.globalMusicPulses.length; i++) {
      const pulse = this.globalMusicPulses[i];
      if (pulse.age < pulse.life) this.globalMusicPulses[livePulseCount++] = pulse;
    }
    this.globalMusicPulses.length = livePulseCount;
    const palette = this._musicPalette(m);
    const t = m.time * (0.35 + m.tempo * 0.18);

    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    const ambientAlpha = clamp(0.045 + m.intensity * 0.085 + m.beat * 0.045, 0, 0.19);
    if (ambientAlpha > 0.01) {
      const densityScale = perf < 0.7 ? 1.65 : 1;
      const gap = this.gridSize * (palette.style === "rain" ? 1.25 : palette.style === "lattice" ? 2 : 3) * densityScale;
      const drift = (m.time * (18 + m.tempo * 24)) % gap;
      gfx.lineWidth = palette.style === "pulse" ? 1.8 : 1;
      gfx.globalAlpha = ambientAlpha;
      gfx.strokeStyle = `hsla(${palette.accent}, 100%, 64%, 0.70)`;
      if (palette.style === "rain") {
        for (let x = MAP_EDGE_MARGIN * this.gridSize; x < W; x += gap) {
          gfx.beginPath();
          gfx.moveTo(x + drift, 0);
          gfx.lineTo(x + drift - this.gridSize * 0.35, H);
          gfx.stroke();
        }
      } else if (palette.style === "rings" || palette.style === "reactor") {
        const cx = W * 0.5;
        const cy = H * 0.52;
        for (let r = this.gridSize * 2; r < Math.hypot(W, H); r += this.gridSize * 3.2) {
          const pulse = 0.5 + 0.5 * Math.sin(m.time * (1.1 + m.tempo) - r * 0.018);
          gfx.globalAlpha = clamp(ambientAlpha * (0.42 + pulse * 0.75), 0, 0.13);
          gfx.strokeStyle = `hsla(${(palette.solid + r * 0.025) % 360}, 100%, 60%, 0.72)`;
          gfx.beginPath();
          gfx.arc(cx, cy, r + pulse * this.gridSize * 0.35, 0, Math.PI * 2);
          gfx.stroke();
        }
      } else {
        // CODEX CHANGE: Batch lattice/tide ambience into one canvas stroke instead of one draw call per row.
        gfx.beginPath();
        for (let y = MAP_EDGE_MARGIN * this.gridSize + drift; y < H; y += gap) {
          gfx.moveTo(0, y);
          gfx.lineTo(W, y + Math.sin(m.time * 0.9 + y * 0.01) * this.gridSize * 0.8);
        }
        gfx.stroke();
      }
    }
    if (!this.globalMusicPulses.length && activity < 0.32) {
      gfx.restore();
      return;
    }
    const lineGap = this.gridSize * 2;
    for (const pulse of this.globalMusicPulses) {
      const k = 1 - pulse.age / pulse.life;
      const alpha = clamp(k * (pulse.kind === "flash" ? 0.10 : 0.065) * (0.75 + activity * 0.5), 0, 0.14);
      if (alpha <= 0.006) continue;
      gfx.globalAlpha = alpha;
      gfx.strokeStyle = `hsla(${pulse.hue}, 100%, 65%, 0.75)`;
      gfx.lineWidth = pulse.kind === "flash" ? 2 : 1.3;
      const shift = ((t + pulse.offset) * lineGap * 3 * pulse.dir) % lineGap;
      for (let x = -W; x < W * 2; x += lineGap) {
        gfx.beginPath();
        gfx.moveTo(x + shift, 0);
        gfx.lineTo(x + shift + H * 0.65 * pulse.dir, H);
        gfx.stroke();
      }
    }
    gfx.restore();
  }

  // CODEX CHANGE: Give every active visual mode its own waveform geometry, motion, and intensity.
  _drawModeSignature(gfx, m, perf, modeOverride = m.mode, opacity = 1) {
    // CODEX CHANGE: Preserve each mode's signature at 4K; individual renderers already scale their density.
    const mode = clamp(modeOverride | 0, 0, ECOSYSTEM_MODE_PROFILES.length - 1);
    if (!m.enabled || mode === 0 || opacity <= 0.001) return;
    const palette = this._musicPalette(m, mode);
    const t = m.time;
    // CODEX CHANGE: Weight transient hits heavily so each unique mode visibly reacts to kicks, snaps, and drops.
    const energy = clamp(0.12 + m.intensity * 0.72 + m.bass * 0.22 + m.beat * 0.48 + m.snap * 0.20 + m.drop * 0.52, 0.12, 1);
    const hue = (offset = 0) => (palette.solid + offset) % 360;
    const visibility = m.vfxQuality === "low" ? 1.35 : m.vfxQuality === "high" ? 2.15 : 1.82;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    gfx.lineJoin = "round";
    gfx.shadowColor = `hsla(${palette.spark}, 100%, 64%, 0.72)`;
    // Canvas shadow filters are disproportionately expensive on large canvases.
    // High quality keeps a restrained glow; medium/low use the bright core stroke.
    gfx.shadowBlur = 0;

    if (mode === 1) {
      // Neon Ocean: slow layered sine tides with cool cyan/blue gradients.
      for (let layer = 0; layer < 5; layer++) {
        const baseY = H * (0.30 + layer * 0.11);
        const amp = this.gridSize * (0.34 + layer * 0.10 + m.mid * 0.78);
        gfx.beginPath();
        const curveStep = perf < 0.7 ? 16 : 9;
        for (let x = -this.gridSize; x <= W + this.gridSize; x += curveStep) {
          const y = baseY
            + Math.sin(x * 0.010 + t * (0.72 + m.tempo * 0.18) + layer * 0.92) * amp
            + Math.sin(x * 0.023 - t * 0.46 + layer) * amp * 0.28;
          if (x <= -this.gridSize) gfx.moveTo(x, y);
          else gfx.lineTo(x, y);
        }
        gfx.globalAlpha = clamp((0.035 + energy * 0.052 - layer * 0.004) * visibility, 0.045, 0.22) * opacity;
        gfx.strokeStyle = `hsla(${hue(layer * 15 - 18)}, 100%, ${66 + layer * 3}%, 0.86)`;
        gfx.lineWidth = 1.8 + layer * 0.40;
        gfx.stroke();
      }
    } else if (mode === 2) {
      // Plasma Storm: slim audio membranes with glow, not broad opaque cables.
      const membranes = perf < 0.7 ? 2 : 3;
      const sampleCount = m.audioWaveform?.length || 0;
      gfx.shadowBlur = 0;
      for (let layer = 0; layer < membranes; layer++) {
        const points = this._musicPathBuffers[layer];
        let pointCount = 0;
        const baseline = H * (0.28 + layer * 0.22);
        const layerHue = hue(layer * 44 - 18);
        const amplitude = this.gridSize * (0.75 + m.bass * 1.8 + m.mid * 1.15 + layer * 0.20);
        const step = perf < 0.7 ? 18 : 10;
        for (let x = -step; x <= W + step; x += step) {
          const p = clamp(x / Math.max(1, W), 0, 1);
          const sampleIndex = Math.floor(p * Math.max(0, sampleCount - 1));
          const spectrumIndex = Math.floor(p * Math.max(0, m.spectrum.length - 1));
          const sample = m.audioWaveform?.[sampleIndex] || 0;
          const band = m.spectrum[spectrumIndex] || m.intensity;
          const y = baseline
            + sample * amplitude
            + Math.sin(p * Math.PI * (3 + layer) + t * (1.2 + m.tempo * 0.8) + layer * 1.7) * amplitude * (0.20 + band * 0.42);
          const point = points[pointCount] || (points[pointCount] = { x: 0, y: 0 });
          point.x = x;
          point.y = y;
          pointCount++;
        }
        points.length = pointCount;
        gfx.beginPath();
        this._traceSmoothMusicPath(gfx, points);
        gfx.globalAlpha = clamp((0.018 + energy * 0.035 + m.beat * 0.025) * visibility, 0.03, 0.12) * opacity;
        gfx.strokeStyle = `hsla(${layerHue}, 100%, 58%, 0.74)`;
        gfx.shadowColor = `hsla(${layerHue}, 100%, 54%, 0.88)`;
        gfx.lineWidth = 4 + layer * 0.7 + m.bass * 2.8;
        gfx.stroke();
        gfx.beginPath();
        this._traceSmoothMusicPath(gfx, points);
        gfx.globalAlpha = clamp((0.075 + energy * 0.11 + m.snap * 0.10) * visibility, 0.10, 0.38) * opacity;
        gfx.strokeStyle = `hsla(${(layerHue + 24) % 360}, 100%, 78%, 0.94)`;
        gfx.lineWidth = 1.15 + m.high * 1.25 + m.beat * 0.9;
        gfx.stroke();
      }
    } else if (mode === 3) {
      // Quantum Grid: counter-moving diamond lattices in green, cyan, and violet.
      // CODEX CHANGE: Batch the full Quantum lattice into one gradient stroke and scale spacing at 4K.
      const densityScale = perf < 0.7 ? 1.85 : perf < 1 ? 1.28 : 1;
      const gap = this.gridSize * (1.35 - energy * 0.20) * densityScale;
      const drift = (t * (18 + m.tempo * 16)) % gap;
      gfx.globalAlpha = clamp((0.025 + energy * 0.052) * visibility, 0.05, 0.20) * opacity;
      gfx.lineWidth = 1.5;
      const latticeGradient = gfx.createLinearGradient(0, 0, W, H);
      latticeGradient.addColorStop(0, `hsla(${hue(-22)}, 100%, 66%, 0.74)`);
      latticeGradient.addColorStop(0.5, `hsla(${hue(34)}, 100%, 70%, 0.82)`);
      latticeGradient.addColorStop(1, `hsla(${hue(108)}, 100%, 66%, 0.74)`);
      gfx.strokeStyle = latticeGradient;
      gfx.beginPath();
      for (let x = -H; x < W + H; x += gap) {
        gfx.moveTo(x + drift, 0);
        gfx.lineTo(x - H + drift, H);
        gfx.moveTo(x - drift, 0);
        gfx.lineTo(x + H - drift, H);
      }
      gfx.stroke();
    } else if (mode === 4) {
      // Orbital Echo Rings: elliptical orbits precess around the map core.
      const cx = W * 0.5;
      const cy = H * 0.5;
      for (let i = 0; i < 7; i++) {
        const radius = this.gridSize * (1.7 + i * 1.35) + m.bass * this.gridSize * 1.2;
        gfx.globalAlpha = clamp((0.025 + energy * 0.038 + (i === 0 ? m.beat * 0.08 : 0)) * visibility, 0.045, 0.25) * opacity;
        gfx.strokeStyle = `hsla(${hue(i * 24)}, 100%, 67%, 0.86)`;
        gfx.lineWidth = 1.55 + (i % 3 === 0 ? m.beat * 1.35 : 0);
        gfx.beginPath();
        gfx.ellipse(cx, cy, radius * 1.5, radius * 0.66, t * (0.05 + i * 0.006) + i * 0.34, 0, Math.PI * 2);
        gfx.stroke();
      }
    } else if (mode === 5) {
      // Digital Rain: descending spectrum-coded columns with emerald/cyan tails.
      const step = this.gridSize * (perf < 1 ? 1.4 : 1);
      // One batched tail pass replaces a costly gradient allocation per column.
      gfx.globalAlpha = clamp((0.08 + m.high * 0.08 + energy * 0.08) * visibility, 0.10, 0.34) * opacity;
      gfx.strokeStyle = `hsla(${hue(24)}, 100%, 62%, 0.74)`;
      gfx.lineWidth = 1.8 + m.high * 1.8;
      gfx.beginPath();
      for (let x = MAP_EDGE_MARGIN * this.gridSize; x < W; x += step) {
        const band = m.spectrum[Math.floor(x / Math.max(1, W) * m.spectrum.length)] || m.high;
        const speed = 90 + m.tempo * 170 + band * 120;
        const head = (t * speed + x * 1.73) % (H + this.gridSize * 6) - this.gridSize * 3;
        const tail = this.gridSize * (1.2 + band * 5.5 + m.beat * 2.5);
        gfx.moveTo(x, head - tail);
        gfx.lineTo(x, head);
      }
      gfx.stroke();
      gfx.globalAlpha = clamp((0.10 + m.high * 0.15 + m.snap * 0.12) * visibility, 0.14, 0.46) * opacity;
      gfx.fillStyle = `hsla(${hue(48)}, 100%, 78%, 0.92)`;
      for (let x = MAP_EDGE_MARGIN * this.gridSize; x < W; x += step) {
        const band = m.spectrum[Math.floor(x / Math.max(1, W) * m.spectrum.length)] || m.high;
        const head = (t * (90 + m.tempo * 170 + band * 120) + x * 1.73) % (H + this.gridSize * 6) - this.gridSize * 3;
        gfx.fillRect(x - 1, head - 2, 2.5, 4 + band * 3);
      }
    } else if (mode === 6) {
      // Energy Lattice: amber/cyan power rails cross and ignite at moving nodes.
      const gap = this.gridSize * 2.15;
      const drift = (t * (26 + m.tempo * 28)) % gap;
      gfx.lineWidth = 1.65;
      for (let p = -H; p < W + H; p += gap) {
        gfx.globalAlpha = clamp((0.028 + energy * 0.050) * visibility, 0.05, 0.21) * opacity;
        gfx.strokeStyle = `hsla(${hue((p / gap) % 2 ? 0 : 150)}, 100%, 67%, 0.80)`;
        gfx.beginPath();
        gfx.moveTo(p + drift, 0);
        gfx.lineTo(p - H + drift, H);
        gfx.stroke();
      }
      const nodes = 10 + Math.floor(energy * 12);
      for (let i = 0; i < nodes; i++) {
        const x = ((i * 137 + t * 54) % (W + 80)) - 40;
        const y = ((i * 83 - t * 31) % (H + 80) + H + 80) % (H + 80) - 40;
        gfx.globalAlpha = clamp((0.04 + m.beat * 0.18 + energy * 0.06) * visibility, 0.07, 0.42) * opacity;
        gfx.fillStyle = `hsla(${hue(i % 2 ? 142 : 6)}, 100%, 72%, 0.92)`;
        gfx.fillRect(x - 2, y - 2, 4 + m.beat * 4, 4 + m.beat * 4);
      }
    } else if (mode === 7) {
      // Cyber Pulse: aggressive square shock fronts and a fast magenta scanner.
      const cx = W * 0.5;
      const cy = H * 0.5;
      const cycle = (t * (0.72 + m.tempo * 0.48)) % 1;
      gfx.shadowBlur = 0;
      for (let i = 0; i < 5; i++) {
        const k = (cycle + i / 5) % 1;
        const w = W * (0.08 + k * 0.88);
        const h = H * (0.08 + k * 0.88);
        gfx.globalAlpha = clamp((1 - k) * (0.05 + energy * 0.09 + m.beat * 0.08) * visibility, 0.04, 0.38) * opacity;
        gfx.strokeStyle = `hsla(${hue(i * 18)}, 100%, 68%, 0.94)`;
        gfx.shadowColor = `hsla(${hue(i * 18)}, 100%, 56%, 0.9)`;
        gfx.lineWidth = 1.8 + m.beat * 2.6;
        gfx.strokeRect(cx - w * 0.5, cy - h * 0.5, w, h);
      }
      const scanY = (t * (150 + m.tempo * 190)) % Math.max(1, H);
      gfx.globalAlpha = clamp((0.06 + m.high * 0.10 + m.snap * 0.16) * visibility, 0.09, 0.44) * opacity;
      gfx.strokeStyle = `hsla(${hue(184)}, 100%, 72%, 0.95)`;
      gfx.lineWidth = 2 + m.snap * 3;
      gfx.beginPath();
      gfx.moveTo(0, scanY);
      gfx.lineTo(W, scanY);
      gfx.stroke();
    } else if (mode === 8) {
      // Aurora Field: three fine full-map traces behind the board, spanning edge to edge.
      gfx.shadowBlur = 0;
      const ribbonCount = 3;
      for (let ribbon = 0; ribbon < ribbonCount; ribbon++) {
        const baseY = H * (0.14 + ribbon * (0.72 / Math.max(1, ribbonCount - 1)));
        const ribbonBand = m.spectrum[(ribbon * 7 + 3) % m.spectrum.length] || m.mid;
        const transientLift = m.beat * 72 + m.drop * 104 + ribbonBand * 44;
        gfx.beginPath();
        const curveStep = perf < 0.7 ? 15 : 8;
        for (let x = -20; x <= W + 20; x += curveStep) {
          const y = baseY
            + Math.sin(x * 0.006 + t * (0.34 + m.tempo * 0.28 + ribbon * 0.025) + ribbon * 1.18) * (46 + m.mid * 76 + transientLift)
            + Math.sin(x * 0.015 - t * (0.42 + m.high * 0.34)) * (18 + m.high * 28);
          if (x < 0) gfx.moveTo(x, y);
          else gfx.lineTo(x, y);
        }
        const ribbonHue = hue(ribbon * 31 - 52);
        gfx.globalAlpha = clamp((0.035 + energy * 0.085 + ribbonBand * 0.04 + m.beat * 0.06) * visibility, 0.07, 0.34) * opacity;
        gfx.strokeStyle = `hsla(${ribbonHue}, 100%, 70%, 0.84)`;
        gfx.shadowColor = `hsla(${ribbonHue}, 100%, 58%, 0.74)`;
        gfx.lineWidth = 1.7 + ribbon * 0.22 + m.bass * 1.35 + m.beat * 0.75;
        gfx.stroke();
      }
    } else if (mode === 9) {
      // Cosmic Reactor: edge-fed cosmic currents with no central hub or radial spokes.
      gfx.shadowBlur = 0;
      for (let side = 0; side < 2; side++) {
        const cx = side === 0 ? -W * 0.18 : W * 1.18;
        const cy = H * (0.48 + Math.sin(t * 0.22 + side * Math.PI) * 0.12);
        for (let ring = 0; ring < 5; ring++) {
          const radiusX = W * (0.32 + ring * 0.075 + m.bass * 0.035);
          const radiusY = H * (0.24 + ring * 0.065 + m.mid * 0.045);
          gfx.globalAlpha = clamp((0.028 + energy * 0.052 + (ring === 0 ? m.beat * 0.08 : 0)) * visibility, 0.05, 0.28) * opacity;
          gfx.strokeStyle = `hsla(${hue(side * 116 + ring * 19)}, 100%, 68%, 0.88)`;
          gfx.shadowColor = `hsla(${hue(side * 116 + ring * 19)}, 100%, 54%, 0.82)`;
          gfx.lineWidth = 1.5 + m.beat * 1.5 + (ring === 0 ? m.drop * 2.8 : 0);
          gfx.beginPath();
          gfx.ellipse(cx, cy, radiusX, radiusY, (side ? -1 : 1) * t * 0.025, 0, Math.PI * 2);
          gfx.stroke();
        }
      }
    }
    gfx.restore();
  }

  _drawEvolvingModeSignatures(gfx, m, perf) {
    const from = Number.isFinite(m.evolutionFromMode) ? m.evolutionFromMode : m.mode;
    const next = Number.isFinite(m.evolutionNextMode) ? m.evolutionNextMode : from;
    const blend = clamp(Number(m.modeBlend) || 0, 0, 1);
    if (from === next) {
      this._drawModeSignature(gfx, m, perf, from, 1);
      return;
    }
    this._drawModeSignature(gfx, m, perf, from, 1 - blend);
    this._drawModeSignature(gfx, m, perf, next, blend);
  }

  _drawBackFieldWaveform(gfx, m, perf, turrets = []) {
    // CODEX CHANGE: Never remove the requested bar graph at large fullscreen resolutions.
    if (!m.spectrum?.length) return;
    const palette = this._musicPalette(m);
    const cols = Math.max(1, this.cols - MAP_EDGE_MARGIN * 2);
    // CODEX CHANGE: Restore a balanced equalizer bed in every mode, with Synthwave remaining the boldest.
    const modeScale = m.mode === 0 ? 1.08 : 0.94;
    const baseY = H - this.gridSize * (0.24 + m.bass * 0.24);
    const maxH = Math.min(H * (m.mode === 0 ? 0.42 : 0.36), this.gridSize * modeScale * (3.0 + m.intensity * 7.4 + m.bass * 4.6 + m.beat * 4.0 + m.drop * 3.6));
    const spectrum = m.spectrum;
    const sampleBand = (idx) => spectrum[clamp(idx, 0, spectrum.length - 1) | 0] || 0;
    let spectrumSum = 0;
    let spectrumPeak = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const value = clamp(Number(spectrum[i]) || 0, 0, 1);
      spectrumSum += value;
      if (value > spectrumPeak) spectrumPeak = value;
    }
    const spectrumAverage = spectrumSum / Math.max(1, spectrum.length);
    const spectrumFloor = spectrumAverage * 0.42;
    const spectrumRange = spectrumPeak - spectrumFloor;
    if (!this._relayColumnFlags || this._relayColumnFlags.length !== this.cols) {
      this._relayColumnFlags = new Uint8Array(this.cols);
    } else {
      this._relayColumnFlags.fill(0);
    }
    if (Array.isArray(turrets)) {
      for (const turret of turrets) {
        const gx = Number.isFinite(turret?.gx) ? turret.gx : Math.floor((turret?.x || 0) / this.gridSize);
        if (gx >= MAP_EDGE_MARGIN && gx < this.cols - MAP_EDGE_MARGIN) this._relayColumnFlags[gx] = 1;
      }
    }
    const relayColumns = this._relayColumns;
    relayColumns.length = 0;
    for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx++) {
      if (this._relayColumnFlags[gx]) relayColumns.push(gx);
    }
    const relayCursor = MAP_EDGE_MARGIN + ((m.time * (3.2 + m.tempo * 2.8)) % 1) * cols;
    const columnStride = perf < 0.7 ? 2 : 1;
    const modeAlpha = m.mode === 0 ? 1 : 0.72;
    const morphSeed = ((m.ecosystemSeed || 1) % 8191) / 8191 * Math.PI * 2;
    const hue = palette.solid;
    const barGradient = gfx.createLinearGradient(0, baseY - maxH, 0, baseY);
    barGradient.addColorStop(0, `hsla(${hue}, 100%, 72%, 0.98)`);
    barGradient.addColorStop(0.55, `hsla(${hue}, 100%, 56%, 0.72)`);
    barGradient.addColorStop(1, `hsla(${hue}, 100%, 42%, 0.04)`);
    let relayIndex = 0;
    let relay = null;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += columnStride) {
      const pos = (gx - MAP_EDGE_MARGIN) / Math.max(1, cols - 1);
      const distanceFromCenter = Math.abs(pos - 0.5) * 2;
      // Mirror the spectrum from the center: bass begins in the middle and higher bands spread outward.
      const bandIndex = Math.floor(distanceFromCenter * (spectrum.length - 1));
      const localBand = (sampleBand(bandIndex - 1) + sampleBand(bandIndex) * 2 + sampleBand(bandIndex + 1)) / 4;
      const rawBand = sampleBand(bandIndex);
      const band = clamp(localBand * 0.66 + rawBand * 0.28 + m.intensity * 0.10, 0, 1);
      const normalizedBand = spectrumRange > 0.055
        ? clamp((band - spectrumFloor) / spectrumRange, 0, 1)
        : band;
      const reactiveBand = clamp(band * 0.40 + normalizedBand * 0.60, 0, 1);
      const bandSnap = Math.pow(clamp(reactiveBand * 0.82 + m.high * distanceFromCenter * 0.28 + m.snap * 0.26, 0, 1), 1.08);
      const beatKick = Math.pow(clamp(m.beat * 1.08 + m.bass * 0.72 + m.drop * 0.64, 0, 1), 1.02);
      const centerBias = Math.pow(1 - distanceFromCenter, 0.82);
      const outwardFront = (m.time * (0.34 + m.tempo * 0.16)) % 1;
      const outwardPulse = Math.exp(-Math.pow((distanceFromCenter - outwardFront) / 0.13, 2));
      const columnBeat = 0.5 + 0.5 * Math.sin(m.time * (7.8 + m.tempo * 5.8) - gx * 0.68);
      const waveformIndex = Math.floor(distanceFromCenter * Math.max(0, (m.audioWaveform?.length || 1) - 1));
      // Real mastered tracks often expose a small time-domain amplitude; normalize it for visible motion.
      const waveformLift = clamp(Math.abs(m.audioWaveform?.[waveformIndex] || 0) * 7.5, 0, 1);
      const musicDetail = clamp(
        0.025
        + reactiveBand * 0.56
        + bandSnap * 0.22
        + beatKick * (0.08 + columnBeat * 0.10)
        + waveformLift * (0.08 + m.intensity * 0.16)
        + m.high * 0.045
      , 0, 1);
      const travelingEnergy = outwardPulse * (beatKick * 0.38 + m.intensity * 0.16 + m.snap * 0.14);
      // Slow seeded oscillators gently reorganize individual bars without frame-to-frame random jitter.
      const slowMorph = Math.sin(m.time * 0.19 + gx * 0.41 + morphSeed) * 0.034
        + Math.sin(m.time * 0.113 - gx * 0.23 + morphSeed * 1.71) * 0.024
        + Math.sin(m.time * 0.071 + Math.floor(gx / 4) * 1.17 + morphSeed * 0.63) * 0.018;
      const height = clamp(
        maxH * (0.22 + centerBias * (0.07 + m.bass * 0.09) + musicDetail * 0.52 + travelingEnergy * 0.62 + slowMorph * 0.25),
        this.gridSize * 0.16,
        maxH
      );
      const x = gx * this.gridSize + 3;
      const y = baseY - height;
      const w = this.gridSize * columnStride - 6;
      while (relayIndex < relayColumns.length && relayColumns[relayIndex] <= gx) {
        if (relayCursor >= relayColumns[relayIndex]) relay = relayColumns[relayIndex];
        relayIndex++;
      }
      const relayPulse = relay === null
        ? 0
        : clamp(1 - Math.abs(gx - relayCursor) / Math.max(2.5, cols * 0.18), 0.18, 1);
      // Every column shares one hue from the active V color variant; energy changes brightness only.
      const alpha = clamp((0.065 + reactiveBand * 0.32 + bandSnap * 0.14 + m.intensity * 0.10 + m.beat * 0.15 + m.drop * 0.12) * modeAlpha, 0.055, m.mode === 0 ? 0.54 : 0.42);
      gfx.globalAlpha = clamp(alpha + relayPulse * 0.08, 0.05, 0.62);
      gfx.fillStyle = barGradient;
      gfx.fillRect(x, y, w, height);
      if (reactiveBand > 0.28 || m.beat > 0.2) {
        gfx.globalAlpha = clamp(alpha * (0.82 + relayPulse * 0.5), 0, 0.40);
        gfx.strokeStyle = `hsla(${hue}, 100%, 78%, 0.85)`;
        gfx.lineWidth = 1.2;
        gfx.beginPath();
        gfx.moveTo(x, y + 0.5);
        gfx.lineTo(x + w, y + 0.5);
        gfx.stroke();
      }
    }
    gfx.restore();
  }

  _injectEcosystemAt(x, y, amount = 0.3, frequency = 0.5, corruption = 0, radius = 2) {
    if (!this._ecosystemEnabled) return;
    this._ensureTileEnergy();
    const centerX = clamp(Math.floor(x / this.gridSize), 0, this.cols - 1);
    const centerY = clamp(Math.floor(y / this.gridSize), 0, this.rows - 1);
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const gx = centerX + ox;
        const gy = centerY + oy;
        if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) continue;
        const idx = gy * this.cols + gx;
        const tileType = this.cells[idx];
        if ((tileType !== 1 && tileType !== 3) || this._isBuildableCorrupted(gx, gy, idx, tileType)) continue;
        const falloff = Math.max(0, 1 - Math.hypot(ox, oy) / (radius + 0.65));
        if (falloff <= 0) continue;
        const injection = amount * falloff;
        this.tileEnergy[idx] = clamp(this.tileEnergy[idx] + injection, 0, 1);
        this.tileHeat[idx] = clamp(this.tileHeat[idx] + injection * 0.72, 0, 1);
        this.tileMemory[idx] = clamp(this.tileMemory[idx] + injection * 0.42, 0, 1);
        this.tileFrequency[idx] = lerp(this.tileFrequency[idx], clamp(frequency, 0, 1), 0.28 + falloff * 0.32);
        this.tileCorruption[idx] = clamp(this.tileCorruption[idx] + corruption * falloff, 0, 1);
        this.tileGrowth[idx] = clamp(this.tileGrowth[idx] + injection * 0.12, 0, 1);
        this.activeTileEnergy.add(idx);
      }
    }
  }

  _mutateEcosystem(m, strength = 0.5, boss = false) {
    this._ecosystemMutation = Math.max(this._ecosystemMutation, boss ? 1 : strength);
    if (boss) {
      for (let idx = 0; idx < this.cells.length; idx++) {
        const tileType = this.cells[idx];
        if (tileType !== 1 && tileType !== 3) continue;
        const gx = idx % this.cols;
        const gy = Math.floor(idx / this.cols);
        if (this._isBuildableCorrupted(gx, gy, idx, tileType)) continue;
        const phase = Math.sin((idx + 1) * 12.9898 + this._ecosystemSeed * 0.0001) * 43758.5453;
        const signature = phase - Math.floor(phase);
        this.tileEnergy[idx] = Math.max(this.tileEnergy[idx], 0.18 + signature * 0.16);
        this.tileMemory[idx] = clamp(this.tileMemory[idx] + 0.10 + signature * 0.12, 0, 1);
        this.tileGrowth[idx] = clamp(this.tileGrowth[idx] + 0.08 + m.mid * 0.10, 0, 1);
        this.tileFrequency[idx] = lerp(this.tileFrequency[idx], signature, 0.38);
        this.tileCorruption[idx] = clamp(this.tileCorruption[idx] + (1 - signature) * 0.08, 0, 1);
        this.activeTileEnergy.add(idx);
      }
    }
    const count = boss ? Math.min(this.cols * this.rows, 180) : 18 + Math.floor(strength * 28);
    for (let i = 0; i < count; i++) {
      const origin = this._pickMusicOrigin(i % 3 === 0);
      const frequency = ((this._musicRand() + m.high * 0.38 + m.mid * 0.17) % 1);
      this._injectEcosystemAt(origin.x, origin.y, boss ? 0.46 : 0.22, frequency, boss ? 0.10 : m.drop * 0.06, boss ? 2 : 1);
    }
  }

  _turretFrequency(turret) {
    const key = String(turret?.typeKey || "echo");
    let hash = this._ecosystemSeed >>> 0;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
    return ((hash % 997) / 996 + clamp((turret?.level || 1) / 18, 0, 0.28)) % 1;
  }

  _simulateEchoEcosystem(m, turrets, frameDt, perf) {
    if (!m.enabled) return;
    if (m.ecosystemSeed !== this._ecosystemSeed) {
      this._ecosystemSeed = m.ecosystemSeed || 1;
      this._musicSeed = (this._ecosystemSeed ^ 0x9e3779b9) >>> 0 || 1;
    }
    if (m.simulationPaused) return;
    this._ecosystemAccumulator += frameDt;
    if (this._ecosystemAccumulator < 1 / 30) return;
    const dt = Math.min(0.08, this._ecosystemAccumulator);
    this._ecosystemAccumulator = 0;
    this._ecosystemMutation = Math.max(0, this._ecosystemMutation - dt * 0.12);

    // Every turret is a stable oscillator whose signature is derived from its type and this level's seed.
    if (Array.isArray(turrets)) {
      for (const turret of turrets) {
        if (!turret) continue;
        const firePulse = clamp(Number(turret.flash) || 0, 0, 1);
        const output = 0.012 + m.intensity * 0.010 + firePulse * 0.052;
        this._injectEcosystemAt(turret.x, turret.y, output, this._turretFrequency(turret), 0, 1);
      }
    }

    if (m.boss && !this._ecosystemBossActive) this._mutateEcosystem(m, 1, true);
    this._ecosystemBossActive = m.boss;

    const candidates = this._ecosystemCandidates;
    candidates.clear();
    const qualityBudget = m.vfxQuality === "low" ? 0.66 : m.vfxQuality === "high" ? 1.18 : 1;
    const maxActive = Math.floor((perf < 0.7 ? 220 : 420) * qualityBudget);
    let seeded = 0;
    for (const idx of this.activeTileEnergy) {
      candidates.add(idx);
      const gx = idx % this.cols;
      const gy = Math.floor(idx / this.cols);
      if (gx > 0) candidates.add(idx - 1);
      if (gx + 1 < this.cols) candidates.add(idx + 1);
      if (gy > 0) candidates.add(idx - this.cols);
      if (gy + 1 < this.rows) candidates.add(idx + this.cols);
      if (++seeded >= maxActive) break;
    }

    const stage = m.evolutionStage || 0;
    const profile = m.mutationProfile || ECOSYSTEM_MODE_PROFILES[0];
    let processed = 0;
    for (const idx of candidates) {
      if (++processed > maxActive) break;
      const gx = idx % this.cols;
      const gy = Math.floor(idx / this.cols);
      const tileType = this.cells[idx];
      if ((tileType !== 1 && tileType !== 3) || this._isBuildableCorrupted(gx, gy, idx, tileType)) continue;
      let neighbors = 0;
      let energy = 0;
      let heat = 0;
      let frequency = 0;
      let harmony = 0;
      if (gx > 0) { const n = idx - 1; neighbors++; energy += this.tileEnergy[n]; heat += this.tileHeat[n]; frequency += this.tileFrequency[n]; harmony += this.tileHarmony[n]; }
      if (gx + 1 < this.cols) { const n = idx + 1; neighbors++; energy += this.tileEnergy[n]; heat += this.tileHeat[n]; frequency += this.tileFrequency[n]; harmony += this.tileHarmony[n]; }
      if (gy > 0) { const n = idx - this.cols; neighbors++; energy += this.tileEnergy[n]; heat += this.tileHeat[n]; frequency += this.tileFrequency[n]; harmony += this.tileHarmony[n]; }
      if (gy + 1 < this.rows) { const n = idx + this.cols; neighbors++; energy += this.tileEnergy[n]; heat += this.tileHeat[n]; frequency += this.tileFrequency[n]; harmony += this.tileHarmony[n]; }
      if (!neighbors) continue;
      const avgEnergy = energy / neighbors;
      const avgHeat = heat / neighbors;
      const avgFrequency = frequency / neighbors;
      const avgHarmony = harmony / neighbors;
      const frequencyAgreement = 1 - Math.min(1, Math.abs(this.tileFrequency[idx] - avgFrequency) * 2.2);
      const flow = (0.34 + m.mid * 0.66 + stage * 0.08) * profile.flow * dt;
      this.tileEnergy[idx] = clamp(this.tileEnergy[idx] + (avgEnergy - this.tileEnergy[idx]) * flow - dt * (0.018 - this.tileMemory[idx] * 0.010), 0, 1);
      this.tileHeat[idx] = clamp(this.tileHeat[idx] + (avgHeat - this.tileHeat[idx]) * dt * (0.20 + m.bass * 0.36) - dt * 0.026, 0, 1);
      this.tileFrequency[idx] = clamp(this.tileFrequency[idx] + (avgFrequency - this.tileFrequency[idx]) * dt * (0.10 + m.mid * 0.22), 0, 1);
      this.tileHarmony[idx] = clamp(this.tileHarmony[idx] + (frequencyAgreement * avgEnergy - this.tileHarmony[idx]) * dt * 0.34 * profile.harmony + avgHarmony * dt * 0.025, 0, 1);
      this.tileMemory[idx] = clamp(Math.max(this.tileMemory[idx], this.tileEnergy[idx] * 0.56 + this.tileGrowth[idx] * 0.25) - dt * 0.0008, 0, 1);
      const growthDrive = this.tileEnergy[idx] * (0.12 + m.mid * 0.22) + this.tileHarmony[idx] * 0.10 + stage * 0.012;
      this.tileGrowth[idx] = clamp(this.tileGrowth[idx] + growthDrive * profile.growth * dt - dt * 0.002, 0, 1);
      const mutationDrive = (this._ecosystemMutation * (0.018 + m.drop * 0.05) + this.tileHeat[idx] * (1 - this.tileHarmony[idx]) * 0.008) * profile.mutation;
      this.tileCorruption[idx] = clamp(this.tileCorruption[idx] + mutationDrive * dt - this.tileHarmony[idx] * dt * 0.004, 0, 1);
      if (this.tileEnergy[idx] > 0.012 || this.tileMemory[idx] > 0.02 || this.tileGrowth[idx] > 0.02) this.activeTileEnergy.add(idx);
    }
  }

  _updateTileEnergy(m, perf, turrets = []) {
    this._ensureTileEnergy();
    this._lastMusicGrid = m;
    const now = Number.isFinite(m.time) ? m.time : performance.now() * 0.001;
    const dt = this._musicLastT ? clamp(now - this._musicLastT, 0.001, 0.06) : 0.016;
    this._musicLastT = now;
    this._ecosystemEnabled = m.enabled;
    if (m.ecosystemSeed !== this._ecosystemSeed) {
      this._ecosystemSeed = m.ecosystemSeed || 1;
      this._musicSeed = (this._ecosystemSeed ^ 0x9e3779b9) >>> 0 || 1;
    }
    if (m.simulationPaused) {
      this._musicLastBeat = m.beat;
      this._musicLastSnap = m.snap;
      this._musicLastDrop = m.drop;
      return;
    }
    if (!m.enabled) {
      for (const wave of this.musicWaves) wave.age += dt;
      let liveCount = 0;
      for (let i = 0; i < this.musicWaves.length; i++) {
        const wave = this.musicWaves[i];
        if (wave.age < wave.life) this.musicWaves[liveCount++] = wave;
      }
      this.musicWaves.length = liveCount;
      this.globalMusicPulses = [];
      this._musicLastBeat = m.beat;
      this._musicLastSnap = m.snap;
      this._musicLastDrop = m.drop;
      return;
    }
    const activity = clamp(m.activity || 0.1, 0.1, 1);
    const palette = this._musicPalette(m);
    // Energy fades slowly; memory and growth keep the level's history visible.
    const decay = 0.040 - activity * 0.014;
    for (const i of this.activeTileEnergy) {
      const next = Math.max(0, this.tileEnergy[i] - dt * decay);
      this.tileEnergy[i] = next;
      // Large-enemy corruption should follow the expanding edge, not accumulate into a filled disk.
      const shockNext = Math.max(0, (this.tileShockEnergy[i] || 0) - dt * 1.72);
      const empNext = Math.max(0, (this.tileEmpEnergy[i] || 0) - dt * 0.19);
      const bossNext = Math.max(0, (this.tileBossEnergy[i] || 0) - dt * 0.72);
      this.tileShockEnergy[i] = shockNext;
      this.tileEmpEnergy[i] = empNext;
      this.tileBossEnergy[i] = bossNext;
      if (next <= 0.01 && (this.tileMemory[i] || 0) <= 0.01 && (this.tileGrowth[i] || 0) <= 0.01 && shockNext <= 0.01 && empNext <= 0.01 && bossNext <= 0.01) {
        this.tileState[i] = 0;
        this.activeTileEnergy.delete(i);
      }
      else if (next < 0.12) this.tileState[i] = 4;
    }

    const beatRise = m.beat > 0.34 && this._musicLastBeat <= 0.34;
    const snapRise = m.snap > 0.32 && this._musicLastSnap <= 0.32;
    const dropRise = m.drop > 0.48 && this._musicLastDrop <= 0.48;
    const spawnGap = now - this._musicLastSpawn;
    const passiveGap = clamp(0.62 - activity * 0.36 - m.intensity * 0.16 - m.tempo * 0.08, 0.12, 0.62);
    if (m.enabled && dropRise) {
      this._mutateEcosystem(m, clamp(0.55 + m.drop * 0.45, 0, 1), false);
      this._spawnMusicWave(m, "drop", false);
      this._spawnMusicWave(m, "echo", false);
      this._spawnMusicWave(m, "snap", false);
      this._spawnGlobalPulse(m, "flash");
      this._musicLastSpawn = now;
    } else if (m.enabled && beatRise) {
      this._spawnMusicWave(m, "echo", false);
      if (m.bass > 0.36 || m.beat > 0.62) this._spawnMusicWave(m, "ripple", false);
      if (m.mid > 0.24 || m.intensity > 0.34) this._spawnGlobalPulse(m, "sweep");
      this._musicLastSpawn = now;
    } else if (m.enabled && spawnGap > passiveGap && (m.mid + m.bass * 0.7 + m.high * 0.28) > (0.30 - activity * 0.12)) {
      this._spawnMusicWave(m, activity > 0.5 ? "pulse" : "echo", false);
      this._musicLastSpawn = now;
    }
    if (m.enabled && snapRise) {
      this._spawnMusicWave(m, "snap", false);
      if (m.high > 0.35 && spawnGap > 0.08) this._spawnMusicWave(m, "echo", false);
    }
    this._musicLastBeat = m.beat;
    this._musicLastSnap = m.snap;
    this._musicLastDrop = m.drop;

    const maxDist = Math.hypot(W, H) + this.gridSize * 4;
    for (const wave of this.musicWaves) wave.age += dt;
    let liveWaveCount = 0;
    for (let i = 0; i < this.musicWaves.length; i++) {
      const wave = this.musicWaves[i];
      if (wave.age < wave.life && wave.age * wave.speed < maxDist) this.musicWaves[liveWaveCount++] = wave;
    }
    this.musicWaves.length = liveWaveCount;

    const hasLargeKillWave = this.musicWaves.some((wave) => wave.kind === "largeKill" && wave.age >= 0);
    const hasEmpWave = this.musicWaves.some((wave) => (wave.kind === "empPulse" || wave.kind === "empEcho" || wave.kind === "empKill") && wave.age >= 0);
    const hasBossKillWave = this.musicWaves.some((wave) => (wave.kind === "miniBossKill" || wave.kind === "mainBossKill") && wave.age >= 0);
    const hasAbilityKillWave = this.musicWaves.some((wave) => (wave.kind === "pulseBurstKill" || wave.kind === "overchargeKill") && wave.age >= 0);
    const hasGridEventWave = hasLargeKillWave || hasEmpWave || hasBossKillWave || hasAbilityKillWave;
    const stride = hasGridEventWave ? 1 : perf < 0.7 ? 2 : 1;
    const waveMove = now * (2.15 + m.tempo * 1.08 + m.intensity * 0.62);
    const sparkCutoff = 0.86 - activity * 0.20 - m.high * 0.12 - m.snap * 0.08;
    for (let gy = MAP_EDGE_MARGIN; gy < this.rows - MAP_EDGE_MARGIN; gy += stride) {
      for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += stride) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        const buildable = v === 1 || v === 3;
        if (!buildable && !hasGridEventWave) continue;
        if (buildable && this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const x = (gx + 0.5) * this.gridSize;
        const y = (gy + 0.5) * this.gridSize;
        const phase = waveMove - gx * (0.22 + activity * 0.10) - gy * (0.30 + activity * 0.06);
        const sweep = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.0) * m.mid * (0.048 + activity * 0.18 + m.snap * 0.05);
        const bassBreath = m.bass * (0.020 + activity * 0.10 + m.beat * 0.095 + m.drop * 0.08) * (0.62 + 0.38 * Math.sin(now * (1.35 + m.tempo) + gx * 0.14 + gy * 0.11));
        const bandIndex = Math.floor((gx - MAP_EDGE_MARGIN) / Math.max(1, this.cols - MAP_EDGE_MARGIN * 2) * (m.spectrum?.length || 1));
        const band = m.spectrum?.[clamp(bandIndex, 0, (m.spectrum?.length || 1) - 1) | 0] || 0;
        const columnHit = Math.pow(band, 1.15) * (0.028 + m.intensity * 0.11 + m.beat * 0.09);
        let add = buildable ? sweep + bassBreath : 0;
        if (buildable) add += columnHit;
        let redShock = 0;
        let empCharge = 0;
        let bossCharge = 0;
        let bossHue = 276;
        let hue = palette.hues[(gx * 2 + gy * 3 + Math.floor(now * (0.45 + activity * 0.35))) % palette.hues.length];
        let state = sweep > bassBreath ? 2 : 1;

        for (const wave of this.musicWaves) {
          const gridEventWave = wave.kind === "largeKill" || wave.kind === "empPulse" || wave.kind === "empEcho" || wave.kind === "empKill" || wave.kind === "pulseBurstKill" || wave.kind === "overchargeKill" || wave.kind === "miniBossKill" || wave.kind === "mainBossKill";
          if (!buildable && !gridEventWave) continue;
          const radius = wave.age * wave.speed;
          const d = Math.hypot(x - wave.x, y - wave.y);
          const band = Math.max(1, wave.width);
          const ring = Math.max(0, 1 - Math.abs(d - radius) / band);
          if (ring <= 0.01) continue;
          const fade = 1 - wave.age / wave.life;
          const strength = Math.pow(ring, wave.kind === "snap" ? 1.15 : 1.65) * fade * wave.amp;
          add += strength;
          if (wave.kind === "largeKill") {
            redShock = Math.max(redShock, strength);
            hue = 2 + Math.min(10, wave.age * 4);
            state = 5;
          } else if (wave.kind === "empPulse" || wave.kind === "empEcho" || wave.kind === "empKill") {
            empCharge = Math.max(empCharge, strength);
            hue = wave.kind === "empPulse" ? 192 : wave.kind === "empKill" ? 198 : 212;
            state = 6;
          } else if (wave.kind === "pulseBurstKill" || wave.kind === "overchargeKill") {
            bossCharge = Math.max(bossCharge, strength);
            bossHue = wave.hue;
            hue = wave.hue;
            state = 7;
          } else if (wave.kind === "miniBossKill" || wave.kind === "mainBossKill") {
            bossCharge = Math.max(bossCharge, strength);
            bossHue = wave.hue;
            hue = wave.hue;
            state = 7;
          } else if (redShock <= 0.01) {
            hue = wave.hue;
            state = wave.state;
          }
        }

        if (buildable && redShock <= 0.01 && empCharge <= 0.01 && perf >= 0.7 && m.high > 0.14 && this._musicRand() > sparkCutoff) {
          add += 0.12 + m.high * 0.17 + m.snap * 0.12;
          hue = palette.spark;
          state = 1;
        }

        if (add <= 0.002) continue;
        const cap = clamp(0.28 + activity * 0.30 + m.beat * 0.10 + m.drop * 0.14, 0.28, 0.68);
        this.tileEnergy[idx] = clamp(Math.max(this.tileEnergy[idx], 0) + add, 0, cap);
        this.tileShockEnergy[idx] = Math.max(this.tileShockEnergy[idx] || 0, redShock);
        this.tileEmpEnergy[idx] = Math.max(this.tileEmpEnergy[idx] || 0, empCharge);
        this.tileBossEnergy[idx] = Math.max(this.tileBossEnergy[idx] || 0, bossCharge);
        if (bossCharge > 0.01) this.tileBossHue[idx] = bossHue;
        this.tileHue[idx] = hue;
        this.tileState[idx] = state;
        this.activeTileEnergy.add(idx);
      }
    }
    let hasGridEventActivity = hasGridEventWave;
    if (!hasGridEventActivity) {
      for (const idx of this.activeTileEnergy) {
        if ((this.tileShockEnergy[idx] || 0) > 0.01 || (this.tileEmpEnergy[idx] || 0) > 0.01
          || (this.tileBossEnergy[idx] || 0) > 0.01) {
          hasGridEventActivity = true;
          break;
        }
      }
    }
    const maxActive = hasGridEventActivity ? this.cols * this.rows : perf < 0.7 ? 120 : 260;
    if (this.activeTileEnergy.size > maxActive) {
      const drop = this.activeTileEnergy.size - maxActive;
      let removed = 0;
      for (const idx of this.activeTileEnergy) {
        this.activeTileEnergy.delete(idx);
        // Retain quiet historical cells; only remove them from the hot simulation frontier.
        this.tileEnergy[idx] *= 0.5;
        this.tileState[idx] = 0;
        this.tileShockEnergy[idx] = 0;
        this.tileEmpEnergy[idx] = 0;
        this.tileBossEnergy[idx] = 0;
        if (++removed >= drop) break;
      }
    }
    this._simulateEchoEcosystem(m, turrets, dt, perf);
  }

  _drawIntegratedRings(gfx, perf) {
    if (!this.musicWaves.length) return;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    const maxRings = perf < 0.7 ? 5 : 10;
    const rings = this.musicWaves.slice(-maxRings);
    for (const wave of rings) {
      if (wave.age <= 0) continue;
      const fade = clamp(1 - wave.age / wave.life, 0, 1);
      const radius = wave.age * wave.speed;
      if (fade <= 0.01 || radius <= 1) continue;
      const isLargeKill = wave.kind === "largeKill" || wave.kind === "largeKillEcho";
      const isBossKill = wave.kind === "miniBossKill" || wave.kind === "mainBossKill";
      const isEmp = wave.kind === "empPulse" || wave.kind === "empEcho" || wave.kind === "empKill";
      const isAbilityKill = wave.kind === "pulseBurstKill" || wave.kind === "overchargeKill";
      const isSnap = wave.kind === "snap";
      gfx.globalAlpha = clamp(fade * wave.amp * (isBossKill ? 0.88 : isLargeKill ? 0.82 : isEmp ? 0.76 : isAbilityKill ? 0.72 : isSnap ? 0.78 : 0.62), 0, isBossKill ? 0.60 : isLargeKill ? 0.54 : isEmp ? 0.50 : isAbilityKill ? 0.48 : isSnap ? 0.46 : 0.42);
      gfx.strokeStyle = `hsla(${wave.hue}, 100%, 68%, 0.96)`;
      gfx.lineWidth = isBossKill ? 2.35 : isLargeKill ? 2.1 : isEmp ? 1.8 : isAbilityKill ? 1.65 : isSnap ? 1.05 : 1.25;
      gfx.beginPath();
      gfx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      gfx.stroke();
    }
    gfx.restore();
  }

  _drawEventTileOverlays(gfx, perf) {
    const t = performance.now() * 0.001;
    gfx.save();
    for (let gy = MAP_EDGE_MARGIN; gy < this.rows - MAP_EDGE_MARGIN; gy++) {
      for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx++) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if ((v === 1 || v === 3) && this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const shockRed = clamp(this.tileShockEnergy[idx] || 0, 0, 1);
        const empCharge = clamp(this.tileEmpEnergy[idx] || 0, 0, 1);
        const bossCharge = clamp(this.tileBossEnergy[idx] || 0, 0, 1);
        const bossHue = this.tileBossHue[idx] ?? 276;
        if (shockRed <= 0.01 && empCharge <= 0.01 && bossCharge <= 0.01) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;

        if (shockRed > 0.01) {
          const shockPulse = 0.82 + 0.18 * Math.sin(t * 8.5 + gx * 0.58 + gy * 0.42);
          gfx.fillStyle = `rgba(255,54,54,${clamp(0.16 + shockRed * 0.62 * shockPulse, 0, 0.72)})`;
          gfx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
          gfx.strokeStyle = `rgba(255,194,194,${clamp(0.24 + shockRed * 0.68, 0, 0.92)})`;
          gfx.lineWidth = 1.7;
          gfx.strokeRect(x + 1.5, y + 1.5, this.gridSize - 3, this.gridSize - 3);

          if (perf >= 0.7) {
            gfx.save();
            gfx.beginPath();
            gfx.rect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
            gfx.clip();
            const drift = (t * 34 + gx * 5 + gy * 7) % (this.gridSize * 2);
            gfx.strokeStyle = `rgba(255,225,225,${clamp(0.06 + shockRed * 0.38, 0, 0.44)})`;
            gfx.lineWidth = 1;
            for (let s = -this.gridSize; s < this.gridSize * 2; s += 7) {
              gfx.beginPath();
              gfx.moveTo(x + s + drift, y + this.gridSize + 2);
              gfx.lineTo(x + s + drift + this.gridSize, y - 2);
              gfx.stroke();
            }
            gfx.restore();
          }
        }

        if (empCharge > 0.01) {
          const electricPulse = 0.84 + 0.16 * Math.sin(t * 12 + gx * 0.92 + gy * 0.68);
          gfx.fillStyle = `rgba(112,232,255,${clamp(0.12 + empCharge * 0.48 * electricPulse, 0, 0.58)})`;
          gfx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
          gfx.strokeStyle = `rgba(238,254,255,${clamp(0.24 + empCharge * 0.70, 0, 0.94)})`;
          gfx.lineWidth = 1.7;
          gfx.strokeRect(x + 1.5, y + 1.5, this.gridSize - 3, this.gridSize - 3);

          if (perf >= 0.7) {
            const spark = 3 + empCharge * 6;
            gfx.save();
            gfx.globalCompositeOperation = "lighter";
            gfx.globalAlpha = clamp(0.12 + empCharge * 0.44, 0, 0.56);
            gfx.strokeStyle = "rgba(245,255,255,0.96)";
            gfx.lineWidth = 1;
            gfx.beginPath();
            gfx.moveTo(x + 3, y + this.gridSize * 0.5);
            gfx.lineTo(x + 3 + spark, y + this.gridSize * 0.5 - 3);
            gfx.lineTo(x + 5 + spark, y + this.gridSize * 0.5 + 2);
            gfx.lineTo(x + 8 + spark, y + this.gridSize * 0.5 - 1);
            gfx.stroke();
            gfx.restore();
          }
        }

        if (bossCharge > 0.01) {
          const bossPulse = 0.86 + 0.14 * Math.sin(t * 7.2 + gx * 0.48 + gy * 0.36);
          gfx.fillStyle = `hsla(${bossHue}, 100%, 58%, ${clamp(0.12 + bossCharge * 0.50 * bossPulse, 0, 0.62)})`;
          gfx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
          gfx.strokeStyle = `hsla(${bossHue}, 100%, 82%, ${clamp(0.22 + bossCharge * 0.68, 0, 0.92)})`;
          gfx.lineWidth = 1.7;
          gfx.strokeRect(x + 1.5, y + 1.5, this.gridSize - 3, this.gridSize - 3);

          if (perf >= 0.7) {
            gfx.save();
            gfx.globalCompositeOperation = "lighter";
            gfx.globalAlpha = clamp(0.08 + bossCharge * 0.30, 0, 0.42);
            gfx.strokeStyle = `hsla(${bossHue}, 100%, 92%, 0.96)`;
            gfx.lineWidth = 1;
            gfx.beginPath();
            gfx.moveTo(x + 3, y + this.gridSize - 4);
            gfx.lineTo(x + this.gridSize * 0.5, y + 3);
            gfx.lineTo(x + this.gridSize - 3, y + this.gridSize - 4);
            gfx.stroke();
            gfx.restore();
          }
        }
      }
    }
    gfx.restore();
  }

  _drawGridBeatRipple(gfx, m, perf) {
    if (!this.pathPts?.length || (m.beat <= 0.02 && m.snap <= 0.02)) return;
    const [sx, sy] = this.pathPts[0];
    const maxR = Math.hypot(W, H) + this.gridSize * 3;
    const radius = (m.time * (210 + m.tempo * 152 + m.beat * 55)) % maxR;
    const hit = Math.max(m.beat, m.snap * 0.86);
    const band = Math.max(this.gridSize * (m.snap > m.beat ? 0.84 : 1.16), 28);
    const skip = perf < 0.7 ? 3 : (m.progression < 0.45 ? 2 : 1);
    const hue = this._musicHue(m, 28);
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineWidth = 1.2 + hit * 1.2;
    for (let gy = MAP_EDGE_MARGIN; gy < this.rows - MAP_EDGE_MARGIN; gy += skip) {
      for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += skip) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        const cx = x + this.gridSize * 0.5;
        const cy = y + this.gridSize * 0.5;
        const d = Math.hypot(cx - sx, cy - sy);
        const k = Math.max(0, 1 - Math.abs(d - radius) / band);
        if (k <= 0.02) continue;
        const alpha = clamp((0.035 + k * hit * 0.28) * (0.82 + m.progression * 0.38), 0, 0.36);
        gfx.globalAlpha = alpha;
        gfx.strokeStyle = v === 3
          ? `hsla(${(hue + 58) % 360}, 100%, 64%, 0.90)`
          : `hsla(${hue}, 100%, 64%, 0.92)`;
        gfx.strokeRect(x + 3, y + 3, this.gridSize - 6, this.gridSize - 6);
        if (k > 0.55) {
          gfx.globalAlpha = clamp(alpha * 0.55, 0, 0.14);
          gfx.fillStyle = `hsla(${hue}, 100%, 58%, 0.65)`;
          gfx.fillRect(x + 5, y + 5, this.gridSize - 10, this.gridSize - 10);
        }
      }
    }
    gfx.restore();
  }

  _drawCircuitFlow(gfx, m, perf) {
    if (perf < 0.7 || m.progression < 0.22 || m.mid + m.high < 0.12) return;
    const phase = Math.floor(m.time * (5 + m.tempo * 4));
    const step = Math.max(2, m.progression < 0.55 ? 4 : (perf < 1 ? 3 : 2));
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineWidth = 1;
    for (let gy = 0; gy < this.rows; gy += step) {
      for (let gx = 0; gx < this.cols; gx += step) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const gate = (gx * 13 + gy * 23 + phase) % 17;
        if (gate > 1) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        const a = clamp((0.035 + m.mid * 0.09 + m.high * 0.06) * (0.65 + m.progression * 0.55), 0, 0.20);
        gfx.globalAlpha = a;
        gfx.strokeStyle = v === 3 ? "rgba(255,207,91,0.70)" : "rgba(98,242,255,0.85)";
        gfx.beginPath();
        gfx.moveTo(x + this.gridSize * 0.18, y + this.gridSize * 0.5);
        gfx.lineTo(x + this.gridSize * 0.82, y + this.gridSize * 0.5);
        gfx.moveTo(x + this.gridSize * 0.5, y + this.gridSize * 0.18);
        gfx.lineTo(x + this.gridSize * 0.5, y + this.gridSize * 0.82);
        gfx.stroke();
      }
    }
    gfx.restore();
  }

  _drawGridEqualizer(gfx, m, perf) {
    if (!m.spectrum?.length) return;
    const palette = this._musicPalette(m);
    const progression = clamp(m.progression || 0.18, 0.18, 1);
    const colStep = perf < 0.7 ? 2 : 1;
    const rowStep = perf < 0.7 ? 2 : 1;
    const usableRows = Math.max(1, this.rows - MAP_EDGE_MARGIN * 2);
    const maxHeight = usableRows * (0.22 + m.bass * 0.58 + m.intensity * 0.30 + m.beat * 0.24 + m.snap * 0.13 + m.drop * 0.16) * (0.78 + progression * 0.26);
    const flow = m.time * (2.0 + m.tempo * 1.9 + m.intensity * 0.55);
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += colStep) {
      const bandIndex = Math.floor((gx - MAP_EDGE_MARGIN) / Math.max(1, this.cols - MAP_EDGE_MARGIN * 2) * m.spectrum.length) % m.spectrum.length;
      const rawBand = m.spectrum[bandIndex] || 0;
      const band = Math.pow(rawBand, 0.78);
      const tide = 0.5 + 0.5 * Math.sin(flow + gx * (palette.style === "rain" ? 0.78 : 0.34));
      const peak = clamp(maxHeight * (0.32 + band * 1.22 + m.mid * tide * 0.42 + m.beat * 0.14), 1, usableRows);
      for (let rise = 0; rise < peak; rise += rowStep) {
        const gy = this.rows - MAP_EDGE_MARGIN - 1 - rise;
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const edge = clamp(1 - rise / Math.max(1, peak), 0, 1);
        const wave = 0.52 + 0.48 * Math.sin(flow * 0.74 - rise * 0.42 + gx * 0.21);
        let alpha = (0.052 + band * 0.18 + m.bass * edge * 0.11 + m.mid * wave * 0.065 + m.snap * 0.055 + m.beat * edge * 0.050) * (0.78 + progression * 0.30);
        if (palette.style === "rain") alpha *= 0.82 + tide * 0.34;
        if (palette.style === "reactor") alpha *= 0.90 + m.beat * 0.36;
        alpha = clamp(alpha, 0.036, 0.42);
        const hue = palette.hues[(gx + rise + Math.floor(flow)) % palette.hues.length];
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        gfx.globalAlpha = alpha;
        gfx.fillStyle = `hsla(${hue}, 100%, ${56 + edge * 12}%, 0.82)`;
        gfx.fillRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
        if (rise + rowStep >= peak - 1 || (progression >= 0.72 && rise % 4 === 0)) {
          gfx.globalAlpha = clamp(alpha * 1.18, 0, 0.34);
          gfx.strokeStyle = `hsla(${(hue + 28) % 360}, 100%, 74%, 0.94)`;
          gfx.lineWidth = 1;
          gfx.strokeRect(x + 2.5, y + 2.5, this.gridSize - 5, this.gridSize - 5);
        }
      }
    }
    gfx.restore();
  }

  _drawSynthGridSweep(gfx, m, perf) {
    if (perf < 0.7) return;
    const skip = m.progression < 0.28 ? 4 : m.progression < 0.58 ? 3 : (perf < 1 ? 2 : 1);
    const phase = m.time * (0.9 + m.tempo * 0.75);
    const hueA = this._musicHue(m, 0);
    const hueB = this._musicHue(m, 86);
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineWidth = 1;
    for (let gy = MAP_EDGE_MARGIN; gy < this.rows - MAP_EDGE_MARGIN; gy += skip) {
      for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += skip) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const rowWave = 0.5 + 0.5 * Math.sin(phase - gy * 0.44 + gx * 0.08);
        const colWave = 0.5 + 0.5 * Math.sin(phase * 1.22 + gx * 0.38);
        const band = rowWave * 0.65 + colWave * 0.35;
        const activeBand = band > (0.74 - m.progression * 0.18) ? band : 0;
        const alpha = clamp((0.008 + activeBand * m.mid * 0.075 + m.high * colWave * 0.025) * (0.7 + m.progression * 0.5), 0, 0.16);
        if (alpha < 0.026) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        const hue = (hueA + gx * 2 + gy * 5 + band * 48) % 360;
        gfx.globalAlpha = alpha;
        gfx.fillStyle = v === 3
          ? `hsla(${(hueB + band * 30) % 360}, 100%, 58%, 0.55)`
          : `hsla(${hue}, 100%, 56%, 0.52)`;
        gfx.fillRect(x + 3, y + 3, this.gridSize - 6, this.gridSize - 6);
        gfx.globalAlpha = clamp(alpha * 0.75, 0, 0.13);
        gfx.strokeStyle = `hsla(${(hue + 34) % 360}, 100%, 68%, 0.85)`;
        gfx.strokeRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
      }
    }
    gfx.restore();
  }

  _drawGridSpectrumCells(gfx, m, perf) {
    // CODEX CHANGE: Retain spectrum cells at 4K with a coarser sampling stride.
    if (m.progression < 0.14) return;
    // CODEX CHANGE: Quantum samples fewer secondary cells because its primary lattice already covers the map.
    const stride = (m.progression < 0.42 ? 6 : m.progression < 0.72 ? 5 : 4)
      + (perf < 0.7 ? 2 : 0)
      + (m.mode === 3 ? (perf < 1 ? 3 : 2) : 0);
    const phase = Math.floor(m.time * (2.8 + m.tempo * 1.4));
    const bands = [m.bass, m.mid, m.high];
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let gy = MAP_EDGE_MARGIN; gy < this.rows - MAP_EDGE_MARGIN; gy++) {
      for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx++) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        if (((gx * 5 + gy * 7 + phase) % stride) !== 0) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        const hue = this._musicHue(m, gx * 5 + gy * 3);
        const bandSlots = m.mode === 3 ? [0, 2] : [0, 1, 2];
        const barW = Math.max(2, (this.gridSize - 12) / (bandSlots.length * 1.65));
        for (let slot = 0; slot < bandSlots.length; slot++) {
          const b = bandSlots[slot];
          const level = bands[b] * (0.6 + 0.4 * Math.sin(m.time * (2.2 + b) + gx * 0.3 + gy * 0.2));
          const h = clamp(level, 0, 1) * (this.gridSize * 0.38);
          const bx = x + 6 + slot * (barW + 3);
          const by = y + this.gridSize - 6 - h;
          gfx.globalAlpha = clamp(0.035 + bands[b] * 0.13 + m.progression * 0.035, 0, 0.20);
          gfx.fillStyle = `hsla(${(hue + b * 46) % 360}, 100%, ${58 + b * 4}%, 0.75)`;
          gfx.fillRect(bx, by, barW, h);
        }
      }
    }
    gfx.restore();
  }

  _drawGridSequencer(gfx, m, perf) {
    if (perf < 0.7 || m.progression < 0.34) return;
    const stepCount = m.progression < 0.68 ? 8 : 12;
    const step = Math.floor(m.time * (2.2 + m.tempo * 0.9)) % stepCount;
    const hue = this._musicHue(m, 118);
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineWidth = 1.4;
    for (let i = 0; i < stepCount; i++) {
      const pathIndex = Math.floor((i / Math.max(1, stepCount - 1)) * (this.pathPts.length - 1));
      const anchor = this.pathPts[pathIndex] || this.pathPts[0];
      const gx = clamp(Math.floor(anchor[0] / this.gridSize) + ((i % 3) - 1) * 2, MAP_EDGE_MARGIN, this.cols - MAP_EDGE_MARGIN - 1);
      const gy = clamp(Math.floor(anchor[1] / this.gridSize) + (((i + 1) % 3) - 1) * 2, MAP_EDGE_MARGIN, this.rows - MAP_EDGE_MARGIN - 1);
      const idx = gy * this.cols + gx;
      const v = this.cells[idx];
      if (v !== 1 && v !== 3) continue;
      if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
      const x = gx * this.gridSize;
      const y = gy * this.gridSize;
      const active = i === step;
      gfx.globalAlpha = active ? clamp(0.12 + m.beat * 0.14 + m.progression * 0.06, 0, 0.28) : clamp(0.035 + m.mid * 0.05, 0, 0.10);
      gfx.strokeStyle = active ? `hsla(${hue}, 100%, 68%, 0.95)` : `hsla(${(hue + 72) % 360}, 100%, 62%, 0.55)`;
      gfx.strokeRect(x + 6, y + 6, this.gridSize - 12, this.gridSize - 12);
      if (active) {
        gfx.globalAlpha = clamp(0.04 + m.beat * 0.12, 0, 0.16);
        gfx.fillStyle = `hsla(${hue}, 100%, 58%, 0.65)`;
        gfx.fillRect(x + 8, y + 8, this.gridSize - 16, this.gridSize - 16);
      }
    }
    gfx.restore();
  }

  _drawPathEqualizer(gfx, m, perf) {
    if (!this.pathPts?.length || perf < 0.7 || m.progression < 0.08) return;
    const count = perf < 1 ? 8 + Math.floor(m.progression * 8) : 12 + Math.floor(m.progression * 14);
    const side = 18 + m.progression * 8;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const prog = (i + 0.5) / count;
      const p = this.posAt(this.totalLen * prog);
      const nx = -Math.sin(p.ang);
      const ny = Math.cos(p.ang);
      const pulse = 0.5 + 0.5 * Math.sin(m.time * (3.8 + m.tempo) + i * 0.8);
      const h = (6 + pulse * 18 * m.mid + m.beat * 14) * (0.7 + m.progression * 0.55);
      const alpha = clamp((0.035 + m.mid * 0.10 + pulse * m.high * 0.06) * (0.75 + m.progression * 0.45), 0, 0.24);
      gfx.globalAlpha = alpha;
      gfx.strokeStyle = i % 4 === 0 && m.beat > 0.2 ? "rgba(255,150,76,0.90)" : "rgba(98,242,255,0.82)";
      gfx.lineWidth = 1.4;
      gfx.beginPath();
      gfx.moveTo(p.x + nx * side, p.y + ny * side);
      gfx.lineTo(p.x + nx * (side + h), p.y + ny * (side + h));
      gfx.moveTo(p.x - nx * side, p.y - ny * side);
      gfx.lineTo(p.x - nx * (side + h * 0.65), p.y - ny * (side + h * 0.65));
      gfx.stroke();
    }
    gfx.restore();
  }

  _drawEchoEcosystem(gfx, m, perf) {
    if (!m.enabled || !this.activeTileEnergy.size) return;
    const palette = this._musicPalette(m);
    const stage = m.evolutionStage || 0;
    const profile = m.mutationProfile || ECOSYSTEM_MODE_PROFILES[0];
    const density = clamp(m.ecosystemDensity || 0.22, 0.12, 1.18);
    // The organism is persistent context; the selected legacy visualization remains the foreground identity.
    const ecosystemAlpha = 0.18 + stage * 0.025;
    const limit = Math.floor((perf < 0.7 ? 150 : 300) * Math.min(1, m.qualityScale || 1));
    const active = this._ecosystemDrawActive;
    active.length = 0;
    for (const idx of this.activeTileEnergy) {
      if (active.length >= limit) break;
      if ((this.tileMemory[idx] || 0) + (this.tileGrowth[idx] || 0) + (this.tileEnergy[idx] || 0) > 0.025) active.push(idx);
    }

    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.lineCap = "round";
    gfx.lineJoin = "round";

    // Persistent veins become circuitry and finally neural bundles as the level matures.
    const connectionThreshold = stage < 1 ? 0.14 : stage < 3 ? 0.08 : 0.035;
    gfx.beginPath();
    let connectionAlpha = 0;
    for (const idx of active) {
      const gx = idx % this.cols;
      const gy = Math.floor(idx / this.cols);
      const sourceGrowth = this.tileGrowth[idx] || 0;
      const sourceMemory = this.tileMemory[idx] || 0;
      const bondCount = stage >= 3 ? 3 : 2;
      for (let bondSlot = 0; bondSlot < bondCount; bondSlot++) {
        if (bondSlot === 0 && gx + 1 >= this.cols) continue;
        if (bondSlot === 1 && gy + 1 >= this.rows) continue;
        if (bondSlot === 2 && (gx + 1 >= this.cols || gy + 1 >= this.rows)) continue;
        const next = bondSlot === 0 ? idx + 1 : bondSlot === 1 ? idx + this.cols : idx + this.cols + 1;
        const bond = Math.min(sourceGrowth + sourceMemory * 0.45, (this.tileGrowth[next] || 0) + (this.tileMemory[next] || 0) * 0.45);
        if (bond < connectionThreshold) continue;
        const nx = next % this.cols;
        const ny = Math.floor(next / this.cols);
        gfx.moveTo((gx + 0.5) * this.gridSize, (gy + 0.5) * this.gridSize);
        if (profile.geometry === "rings" || profile.geometry === "reactor") {
          const cx = W * 0.5;
          const cy = H * 0.5;
          const bend = Math.atan2((gy + 0.5) * this.gridSize - cy, (gx + 0.5) * this.gridSize - cx) * this.gridSize * 0.18;
          gfx.quadraticCurveTo((gx + nx + 1) * this.gridSize * 0.5 - bend, (gy + ny + 1) * this.gridSize * 0.5 + bend, (nx + 0.5) * this.gridSize, (ny + 0.5) * this.gridSize);
        } else if (stage >= 2 || profile.geometry === "tide" || profile.geometry === "aurora") {
          const bend = (this.tileFrequency[idx] - 0.5) * this.gridSize * (0.35 + m.mid * 0.5);
          gfx.quadraticCurveTo((gx + nx + 1) * this.gridSize * 0.5 + bend, (gy + ny + 1) * this.gridSize * 0.5 - bend, (nx + 0.5) * this.gridSize, (ny + 0.5) * this.gridSize);
        } else {
          gfx.lineTo((nx + 0.5) * this.gridSize, (ny + 0.5) * this.gridSize);
        }
        connectionAlpha = Math.max(connectionAlpha, bond);
      }
    }
    gfx.globalAlpha = clamp((0.025 + connectionAlpha * 0.22 + m.beat * 0.06) * density * ecosystemAlpha, 0.006, 0.075);
    gfx.strokeStyle = `hsla(${palette.accent}, 100%, 68%, 0.82)`;
    gfx.lineWidth = 0.65 + stage * 0.20 + m.bass * 0.9;
    gfx.shadowColor = `hsla(${palette.spark}, 100%, 62%, 0.8)`;
    gfx.shadowBlur = 0;
    gfx.stroke();

    // Treble grows crystal forests from high-memory cells.
    if (stage >= 1 && m.high > 0.10) {
      let crystals = 0;
      for (const idx of active) {
        const growth = this.tileGrowth[idx] || 0;
        const memory = this.tileMemory[idx] || 0;
        if (growth + memory < 0.18 || ((idx + this._ecosystemSeed) % Math.max(3, 8 - stage)) !== 0) continue;
        const gx = idx % this.cols;
        const gy = Math.floor(idx / this.cols);
        const x = (gx + 0.5) * this.gridSize;
        const y = (gy + 0.5) * this.gridSize;
        const height = this.gridSize * clamp((0.12 + growth * 0.55 + m.high * 0.28) * profile.crystal, 0.10, 0.82);
        const spread = height * (0.22 + this.tileFrequency[idx] * 0.18);
        gfx.globalAlpha = clamp((0.04 + growth * 0.22 + m.snap * 0.12) * density * ecosystemAlpha, 0.008, 0.085);
        gfx.fillStyle = `hsla(${(palette.spark + this.tileFrequency[idx] * 92) % 360}, 100%, 72%, 0.72)`;
        gfx.beginPath();
        gfx.moveTo(x, y - height);
        gfx.lineTo(x + spread, y + height * 0.18);
        gfx.lineTo(x - spread, y + height * 0.18);
        gfx.closePath();
        gfx.fill();
        if (++crystals >= (perf < 0.7 ? 18 : 36)) break;
      }
    }

    // Deterministic digital wildlife follows the strongest remembered currents.
    if (stage >= 2 && active.length && !m.reducedMotion) {
      const wildlifeCount = Math.min(stage * 3, perf < 0.7 ? 8 : 15);
      for (let i = 0; i < wildlifeCount; i++) {
        const slot = (Math.imul(i + 1, 2654435761) + this._ecosystemSeed) >>> 0;
        const idx = active[slot % active.length];
        const gx = idx % this.cols;
        const gy = Math.floor(idx / this.cols);
        const orbit = m.time * (0.45 + (slot % 11) * 0.035) + i * 2.1;
        const r = this.gridSize * (0.24 + ((slot >>> 8) % 100) / 250);
        const x = (gx + 0.5) * this.gridSize + Math.cos(orbit) * r;
        const y = (gy + 0.5) * this.gridSize + Math.sin(orbit * 1.37) * r;
        gfx.globalAlpha = clamp((0.10 + this.tileHarmony[idx] * 0.30 + m.high * 0.12) * ecosystemAlpha, 0.025, 0.11);
        gfx.fillStyle = `hsla(${(palette.hues[i % palette.hues.length] + 35) % 360}, 100%, 78%, 0.9)`;
        gfx.beginPath();
        gfx.arc(x, y, 1.2 + m.snap * 2.2, 0, Math.PI * 2);
        gfx.fill();
      }
    }

    // Late waves add pooled procedural weather and reality fractures without persistent objects.
    if (stage >= 4 && !m.reducedMotion) {
      const weatherCount = perf < 0.7 ? 18 : 34;
      gfx.lineWidth = 0.7 + m.drop * 1.8;
      for (let i = 0; i < weatherCount; i++) {
        const hash = Math.sin((i + 1) * 91.73 + this._ecosystemSeed * 0.001) * 43758.5453;
        const unit = hash - Math.floor(hash);
        const x = (unit * W + m.time * (18 + m.high * 90) * (i % 2 ? 1 : -1) + W) % W;
        const y = (((unit * 7.31) % 1) * H + m.time * (34 + m.bass * 110) + i * 31) % H;
        const length = 8 + stage * 5 + m.drop * 42;
        gfx.globalAlpha = clamp((0.018 + m.high * 0.055 + this._ecosystemMutation * 0.10) * ecosystemAlpha, 0.006, 0.05);
        gfx.strokeStyle = `hsla(${palette.hues[i % palette.hues.length]}, 100%, 70%, 0.82)`;
        gfx.beginPath();
        gfx.moveTo(x, y);
        gfx.lineTo(x - length * 0.34, y + length);
        gfx.stroke();
      }
    }
    if (stage >= 5 && m.mode !== 9) {
      const cx = W * 0.5;
      const cy = H * 0.5;
      const organismBeat = m.reducedMotion ? 0.45 : 0.5 + 0.5 * Math.sin(m.time * (2.2 + m.tempo) + m.bass * 2.4);
      for (let ring = 0; ring < 3; ring++) {
        const radius = this.gridSize * (1.8 + ring * 1.45 + organismBeat * (0.4 + ring * 0.18));
        gfx.globalAlpha = clamp((0.055 + m.intensity * 0.07 + m.beat * 0.10 - ring * 0.009) * ecosystemAlpha, 0.012, 0.06);
        gfx.strokeStyle = `hsla(${palette.hues[(ring + m.mode) % palette.hues.length]}, 100%, 72%, 0.9)`;
        gfx.lineWidth = 1.1 + m.beat * 1.8;
        gfx.beginPath();
        if (profile.geometry === "square" || profile.geometry === "diamond") {
          const side = radius * 1.7;
          gfx.rect(cx - side * 0.5, cy - side * 0.5, side, side);
        } else {
          gfx.ellipse(cx, cy, radius * (profile.geometry === "tide" ? 1.8 : 1.15), radius * (profile.geometry === "rain" ? 1.55 : 0.84), m.time * 0.035 * (ring + 1), 0, Math.PI * 2);
        }
        gfx.stroke();
      }
    }
    gfx.restore();
  }

  _drawEcosystemPath(gfx, m, perf) {
    if (!m.enabled || m.reducedMotion || !this.pathPts?.length) return;
    const palette = this._musicPalette(m);
    const count = Math.floor((perf < 0.7 ? 18 : 34) * clamp(m.ecosystemDensity || 0.22, 0.2, 1));
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let i = 0; i < count; i++) {
      const progress = (i / count + m.time * (0.025 + m.mid * 0.07)) % 1;
      const p = this.posAt(progress * this.totalLen);
      const pulse = 0.5 + 0.5 * Math.sin(m.time * 5.2 + i * 1.7);
      const length = 4 + m.bass * 18 + pulse * 7;
      gfx.globalAlpha = clamp(0.035 + m.intensity * 0.08 + m.beat * 0.10, 0.03, 0.22);
      gfx.strokeStyle = `hsla(${palette.hues[i % palette.hues.length]}, 100%, 72%, 0.88)`;
      gfx.lineWidth = 1 + m.beat * 1.4;
      gfx.beginPath();
      gfx.moveTo(p.x - Math.cos(p.ang) * length, p.y - Math.sin(p.ang) * length);
      gfx.lineTo(p.x + Math.cos(p.ang) * length, p.y + Math.sin(p.ang) * length);
      gfx.stroke();
    }
    gfx.restore();
  }

  drawBase(gfx, music = null, turrets = []) {
    const area = W * H;
    const perf = area > 7000000 ? 0.5 : area > 3800000 ? 0.7 : 1;
    const gridStep = this.gridSize * (perf < 0.7 ? 2 : 1);
    const musicGrid = this._musicGridState(music);
    gfx.save();
    const bg = gfx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, this.env.bg0 || "#070A12");
    bg.addColorStop(1, this.env.bg1 || "#0B1022");
    gfx.fillStyle = bg;
    gfx.fillRect(0, 0, W, H);
    gfx.restore();

    // CODEX CHANGE: Balance restrained space flight with real audio waveforms behind the grid.
    if (musicGrid.enabled && !musicGrid.reducedMotion) {
      this._drawSpaceFlight(gfx, musicGrid, perf);
      this._drawAudioWaveforms(gfx, musicGrid, perf);
      // Identity geometry lives behind the board and crossfades as the level advances.
      this._drawEvolvingModeSignatures(gfx, musicGrid, perf);
    }

    // Background "nebula grid"
    gfx.save();
    gfx.globalAlpha = clamp(0.24 + musicGrid.intensity * 0.11, 0.22, 0.35);
    gfx.strokeStyle = this.env.grid || "rgba(98,242,255,0.12)";
    gfx.lineWidth = 1;
    gfx.beginPath();
    for (let x = 0; x < W; x += gridStep) {
      gfx.moveTo(x + 0.5, 0); gfx.lineTo(x + 0.5, H);
    }
    for (let y = 0; y < H; y += gridStep) {
      gfx.moveTo(0, y + 0.5); gfx.lineTo(W, y + 0.5);
    }
    gfx.stroke();
    gfx.restore();
    this._updateTileEnergy(musicGrid, perf, turrets);
    // CODEX CHANGE: Pair every unique mode with the restored, restrained bottom equalizer.
    if (musicGrid.enabled) {
      this._drawEchoEcosystem(gfx, musicGrid, perf);
      if (!musicGrid.reducedMotion) {
        this._drawBackFieldWaveform(gfx, musicGrid, perf, turrets);
        if (musicGrid.mode === 0) this._drawGridEqualizer(gfx, musicGrid, perf);
        else if (musicGrid.mode === 2 || musicGrid.mode === 3) this._drawGridSpectrumCells(gfx, musicGrid, perf);
        this._drawGlobalMapVisuals(gfx, musicGrid, perf);
      }
    }

    const t = performance.now() * 0.001;
    const tilePalette = this._musicPalette(musicGrid);

    // Buildable tile glow
    gfx.save();
    for (let gy = 0; gy < this.rows; gy++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        const corrupted = this._isBuildableCorrupted(gx, gy, idx, v);
        const powerLocked = this._isPowerTileLocked(gx, gy, idx, v);
        if (perf < 0.7 && ((gx + gy) % 2) === 1 && !corrupted) continue;
        const x = gx * this.gridSize;
        const y = gy * this.gridSize;
        const wavePhase = musicGrid.time * (1.1 + musicGrid.tempo * 1.35) - (gx * 0.36 + gy * 0.22);
        const waveSweep = (0.5 + 0.5 * Math.sin(wavePhase)) * musicGrid.mid;
        const bassBreath = musicGrid.bass * (0.55 + 0.45 * Math.sin(musicGrid.time * (1.2 + musicGrid.tempo) + gx * 0.16 + gy * 0.11));
        const colorHue = tilePalette.hues[(gx * 2 + gy * 3) % tilePalette.hues.length];
        const memory = this.tileMemory[idx] || 0;
        const growth = this.tileGrowth[idx] || 0;
        const harmony = this.tileHarmony[idx] || 0;
        const heat = this.tileHeat[idx] || 0;
        const visualCorruption = this.tileCorruption[idx] || 0;
        const organismPulse = musicGrid.reducedMotion ? 0.62 : 0.5 + 0.5 * Math.sin(musicGrid.time * (1.5 + musicGrid.songTempo * 1.8) + gx * 0.31 + gy * 0.23 + this.tileFrequency[idx] * 6.28);
        let identityGlow = bassBreath * 0.7;
        if (musicGrid.mode === 1) identityGlow = waveSweep;
        else if (musicGrid.mode === 2) identityGlow = bassBreath * 0.42;
        else if (musicGrid.mode === 3) identityGlow = waveSweep * 0.45 + musicGrid.high * 0.35;
        else if (musicGrid.mode === 4) identityGlow = bassBreath * 0.45 + waveSweep * 0.35;
        else if (musicGrid.mode === 5) identityGlow = (0.5 + 0.5 * Math.sin(musicGrid.time * 6.2 - gy * 0.86 + gx * 0.12)) * musicGrid.high;
        else if (musicGrid.mode === 6) identityGlow = (0.5 + 0.5 * Math.cos((gx + gy) * 0.58 - musicGrid.time * 2.4)) * musicGrid.mid;
        else if (musicGrid.mode === 7) identityGlow = (0.5 + 0.5 * Math.sin(Math.max(Math.abs(gx - this.cols * 0.5), Math.abs(gy - this.rows * 0.5)) * 1.25 - musicGrid.time * 7.5)) * musicGrid.bass;
        else if (musicGrid.mode === 8) identityGlow = (0.5 + 0.5 * Math.sin(gx * 0.22 + Math.sin(gy * 0.30 + musicGrid.time) * 2.1 - musicGrid.time * 0.9)) * musicGrid.mid * 0.72;
        else if (musicGrid.mode === 9) identityGlow = (0.5 + 0.5 * Math.sin(Math.hypot(gx - this.cols * 0.5, gy - this.rows * 0.5) * 0.68 - musicGrid.time * 6.3)) * (musicGrid.bass * 0.68 + musicGrid.beat * 0.42);
        const organismGlow = (memory * 0.16 + growth * organismPulse * 0.20 + harmony * 0.08 + heat * musicGrid.bass * 0.07 + visualCorruption * musicGrid.drop * 0.10) * musicGrid.ecosystemDensity;
        const modeGlow = identityGlow + organismGlow;
        const tileEnergy = corrupted ? 0 : (this.tileEnergy[idx] || 0);
        const tileHue = this.tileHue[idx] ?? colorHue;
        const tileState = this.tileState[idx] || 0;
        const musicGlow = corrupted ? 0 : clamp(modeGlow * 0.42 + tileEnergy * 0.28 + musicGrid.beat * 0.08 + musicGrid.snap * 0.05, 0, 1);

        // soft, animated sheen
        const pulse = 0.35 + 0.25 * Math.sin(t * 1.2 + gx * 0.7 + gy * 0.5);
        if (v === 3) {
          const goldPulse = 0.55 + 0.35 * Math.sin(t * 2.4 + gx * 0.6 + gy * 0.4);
          gfx.fillStyle = `rgba(255,207,91,${clamp(0.15 + goldPulse * 0.16 + musicGlow * 0.070, 0, 0.38)})`;
        } else {
          gfx.fillStyle = `hsla(${tileHue}, 100%, 60%, ${clamp(0.030 + pulse * 0.018 + musicGlow * 0.13, 0, 0.24)})`;
        }
        gfx.fillRect(x, y, this.gridSize, this.gridSize);

        gfx.strokeStyle = v === 3
          ? `rgba(255,207,91,${clamp(0.42 + pulse * 0.16 + musicGlow * 0.10, 0, 0.72)})`
          : `hsla(${(tileHue + 72) % 360}, 100%, 68%, ${clamp(0.070 + pulse * 0.050 + musicGlow * 0.19, 0, 0.38)})`;
        gfx.lineWidth = 1;
        gfx.strokeRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);

        if (!corrupted && perf >= 0.7 && musicGrid.high > 0.12) {
          const sparkGate = (gx * 17 + gy * 31 + Math.floor(musicGrid.time * (7 + musicGrid.tempo * 5 + musicGrid.snap * 4))) % Math.max(7, 22 - Math.floor(musicGrid.activity * 12) - Math.floor(musicGrid.snap * 4));
          if (sparkGate === 0 || tileState === 1 && tileEnergy > 0.16) {
            const s = 3 + musicGrid.high * 5 + tileEnergy * 8;
            gfx.save();
            gfx.globalCompositeOperation = "lighter";
            gfx.globalAlpha = clamp(0.05 + musicGrid.high * 0.16 + musicGrid.snap * 0.12 + tileEnergy * 0.24, 0, 0.38);
            gfx.strokeStyle = v === 3 ? "rgba(255,232,156,0.92)" : `hsla(${(tileHue + 18) % 360}, 100%, 78%, 0.92)`;
            gfx.lineWidth = 1;
            gfx.beginPath();
            gfx.moveTo(x + 3, y + 3 + s);
            gfx.lineTo(x + 3, y + 3);
            gfx.lineTo(x + 3 + s, y + 3);
            gfx.moveTo(x + this.gridSize - 3 - s, y + this.gridSize - 3);
            gfx.lineTo(x + this.gridSize - 3, y + this.gridSize - 3);
            gfx.lineTo(x + this.gridSize - 3, y + this.gridSize - 3 - s);
            gfx.stroke();
            gfx.restore();
          }
        }

        if (corrupted) {
          const corruptPulse = 0.8 + 0.2 * Math.sin(t * 3.1 + gx * 0.55 + gy * 0.45);
          gfx.fillStyle = `rgba(255,80,80,${0.33 + corruptPulse * 0.15})`;
          gfx.fillRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
          gfx.strokeStyle = `rgba(255,110,110,${0.35 + corruptPulse * 0.35})`;
          gfx.lineWidth = 1.4;
          gfx.strokeRect(x + 1.5, y + 1.5, this.gridSize - 3, this.gridSize - 3);

          if (perf >= 0.7) {
            gfx.save();
            gfx.beginPath();
            gfx.rect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);
            gfx.clip();
            const drift = (t * 28 + gx * 5 + gy * 7) % (this.gridSize * 2);
            gfx.strokeStyle = `rgba(255,160,160,${0.16 + corruptPulse * 0.12})`;
            gfx.lineWidth = 1;
            for (let s = -this.gridSize; s < this.gridSize * 2; s += 7) {
              gfx.beginPath();
              gfx.moveTo(x + s + drift, y + this.gridSize + 2);
              gfx.lineTo(x + s + drift + this.gridSize, y - 2);
              gfx.stroke();
            }
            gfx.restore();
          }

          const cx = x + this.gridSize * 0.5;
          const cy = y + this.gridSize * 0.5;
          const arm = this.gridSize * (0.18 + 0.04 * Math.sin(t * 2.6 + gx + gy));
          gfx.save();
          gfx.globalAlpha = 0.32 + 0.2 * corruptPulse;
          gfx.strokeStyle = "rgba(255,70,70,0.95)";
          gfx.lineWidth = 1.8;
          gfx.beginPath();
          gfx.moveTo(cx - arm, cy - arm);
          gfx.lineTo(cx + arm, cy + arm);
          gfx.moveTo(cx + arm, cy - arm);
          gfx.lineTo(cx - arm, cy + arm);
          gfx.stroke();
          gfx.restore();
        }

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

          if (powerLocked && this._padlockImg && this._padlockLoaded) {
            // Keep lock indicator very subtle as requested.
            gfx.save();
            gfx.globalAlpha = 0.22;
            gfx.drawImage(this._padlockImg, x, y, this.gridSize, this.gridSize);
            gfx.restore();
          }
        }

        // sparkle removed (too busy)
      }
    }

    gfx.restore();
    if (musicGrid.enabled) {
      if (!musicGrid.reducedMotion) {
        if (musicGrid.mode === 1 || musicGrid.mode === 2 || musicGrid.mode === 4 || musicGrid.mode === 9) this._drawGridBeatRipple(gfx, musicGrid, perf);
        if (musicGrid.mode === 0 && musicGrid.progression >= 0.22) this._drawSynthGridSweep(gfx, musicGrid, perf);
        if ((musicGrid.mode === 3 || musicGrid.mode === 7) && musicGrid.progression >= 0.34) this._drawGridSequencer(gfx, musicGrid, perf);
        if ((musicGrid.mode === 3 || musicGrid.mode === 6) && musicGrid.progression >= 0.48 && musicGrid.activity > 0.40) this._drawCircuitFlow(gfx, musicGrid, perf);
      }
      this._drawEventTileOverlays(gfx, perf);
      if (!musicGrid.reducedMotion) this._drawIntegratedRings(gfx, perf);
    }

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

    const trackBoost = musicGrid.intensity * 0.06 + musicGrid.beat * 0.05 + musicGrid.evolutionStage * 0.008;
    gfx.strokeStyle = this.env.track?.glow1 || `rgba(98,242,255,${0.18 + trackBoost})`;
    gfx.lineWidth = 20;
    gfx.beginPath();
    gfx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
    gfx.stroke();

    gfx.strokeStyle = this.env.track?.glow2 || `rgba(154,108,255,${0.18 + trackBoost})`;
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
    if (musicGrid.enabled) {
      if (!musicGrid.reducedMotion && (musicGrid.mode === 0 || musicGrid.mode === 7 || musicGrid.mode === 9)) this._drawPathEqualizer(gfx, musicGrid, perf);
      this._drawEcosystemPath(gfx, musicGrid, perf);
    }
    this._drawMapFeature(gfx);

    // Flow-field lane energy ribbons
    const ribbonCount = perf < 0.7 ? 6 : 10;
    for (let i = 0; i < ribbonCount; i++) {
      const prog = (t * (0.22 + musicGrid.tempo * 0.035) + i / ribbonCount) % 1;
      const d = this.totalLen * prog;
      const p = this.posAt(d);
      const dx = Math.cos(p.ang);
      const dy = Math.sin(p.ang);
      const len = 26 + (i % 4) * 6;
      gfx.save();
      gfx.globalAlpha = clamp(0.16 + musicGrid.intensity * 0.12 + musicGrid.beat * 0.04, 0, 0.30);
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
      const prog = (t * (0.16 + musicGrid.tempo * 0.04 + musicGrid.intensity * 0.018) + r / streakCount) % 1;
      const d = this.totalLen * prog;
      const p = this.posAt(d);
      const dx = Math.cos(p.ang);
      const dy = Math.sin(p.ang);
      const len = 70;
      gfx.save();
      gfx.globalAlpha = clamp(0.24 + musicGrid.intensity * 0.08 + musicGrid.bass * 0.04, 0, 0.35);
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


