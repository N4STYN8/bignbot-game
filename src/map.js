import { clamp, lerp, dist2, rand, pick, easeInOut, fmt, lerpColor, canvas, ctx, W, H, DPR, resize, goldEl, livesEl, waveEl, waveMaxEl, nextInEl, levelValEl, envValEl, seedValEl, startBtn, resetBtn, pauseBtn, helpBtn, audioBtn, musicVol, sfxVol, settingsBtn, settingsModal, settingsClose, settingsResetBtn, overlay, closeHelp, buildList, selectionBody, selSub, sellBtn, turretHud, turretHudBody, turretHudSellBtn, turretHudCloseBtn, turretStateBar, toastEl, tooltipEl, topbarEl, abilitiesBarEl, levelOverlay, levelOverlayText, confirmModal, modalTitle, modalBody, modalCancel, modalConfirm, leftPanel, rightPanel, abilityScanBtn, abilityPulseBtn, abilityOverBtn, abilityScanCd, abilityPulseCd, abilityOverCd, anomalyLabel, anomalyPill, waveStatsModal, waveStatsTitle, waveStatsBody, waveStatsContinue, waveStatsSkip, waveStatsControls, controlsModal, controlsClose, speedBtn, SAVE_KEY, AUDIO_KEY, START_GOLD, START_GOLD_PER_LEVEL, START_LIVES, GOLD_LOW, GOLD_MID, GOLD_HIGH, LIFE_RED_MAX, LIFE_YELLOW_MAX, LIFE_GREEN_MIN, LIFE_COLORS, ABILITY_COOLDOWN, OVERCHARGE_COOLDOWN, SKIP_GOLD_BONUS, SKIP_COOLDOWN_REDUCE, INTERMISSION_SECS, TOWER_UNLOCKS, GAME_STATE, MAP_GRID_SIZE, MAP_EDGE_MARGIN, TRACK_RADIUS, TRACK_BLOCK_PAD, POWER_TILE_COUNT, POWER_NEAR_MIN, POWER_NEAR_MAX, POWER_TILE_MIN_DIST, LEVEL_HP_SCALE, LEVEL_SPD_SCALE, ENV_PRESETS, makeRNG, randInt, distPointToSegmentSquared, distanceToSegmentsSquared, buildPathSegments, generatePath, getPlayBounds, generatePowerTiles, generateMap, toast, showTooltip, hideTooltip, flashAbilityButton, _modalOpen, _modalOnConfirm, showConfirm, closeConfirm } from "./shared.js";

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

  isCorruptionSafeCell(gx, gy, tileType = null) {
    const idx = gy * this.cols + gx;
    const v = tileType ?? this.cells[idx];
    if (v !== 1 || !this.segs?.length) return false;
    const center = this.worldFromCell(gx, gy);
    const halfDiagonal = this.gridSize * Math.SQRT2 * 0.5;
    const trackClearance = TRACK_RADIUS + halfDiagonal + 3;
    return distanceToSegmentsSquared(center.x, center.y, this.segs) >= trackClearance * trackClearance;
  }

  clearTileVisualEnergy(gx, gy) {
    const idx = gy * this.cols + gx;
    if (idx < 0 || idx >= this.cells.length) return;
    this.tileEnergy[idx] = 0;
    this.tileHue[idx] = 190;
    this.tileState[idx] = 0;
    this.tileShockEnergy[idx] = 0;
    this.tileEmpEnergy[idx] = 0;
    this.tileBossEnergy[idx] = 0;
    this.tileBossHue[idx] = 276;
    this.activeTileEnergy.delete(idx);
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
    const e = music?.energy || {};
    const bass = clamp(Number(e.bass) || 0, 0, 1);
    const mid = clamp(Number(e.mid) || 0, 0, 1);
    const high = clamp(Number(e.high) || 0, 0, 1);
    const intensity = clamp(Number(e.intensity) || 0, 0, 1);
    const beat = clamp(Number(e.beat) || 0, 0, 1);
    const snap = clamp(Number(e.snap) || 0, 0, 1);
    const drop = clamp(Number(e.drop) || 0, 0, 1);
    const songTempo = clamp(Number(e.tempo) || 0.5, 0, 1);
    const trackIndex = Math.max(0, Number(music?.trackIndex) || 0);
    const spectrum = Array.isArray(music?.spectrum) && music.spectrum.length
      ? music.spectrum.map((v) => clamp(Number(v) || 0, 0, 1))
      : [bass, bass, mid, mid, high, high];
    const time = Number.isFinite(music?.time) ? music.time : performance.now() * 0.001;
    const wave = Math.max(0, Number(music?.wave) || 0);
    const waveMax = Math.max(1, Number(music?.waveMax) || 16);
    const level = Math.max(1, Number(music?.level) || 1);
    const boss = !!music?.boss || !!music?.bossCinematic || wave >= waveMax;
    const bossBoost = 0;
    const activity = clamp(0.22 + intensity * 0.38 + bass * 0.10 + mid * 0.08 + high * 0.05 + songTempo * 0.16, 0.24, 0.84);
    const progression = clamp(wave <= 1 ? 0.18 : wave < 3 ? 0.28 : wave < 5 ? 0.42 : wave < 7 ? 0.58 : wave < 10 ? 0.72 : wave < 15 ? 0.88 : 1, 0.18, 1);
    const amp = 0.9;
    return {
      mode: Number.isFinite(music?.mode) ? music.mode | 0 : 0,
      bass: clamp(bass * amp, 0, 1),
      mid: clamp(mid * amp, 0, 1),
      high: clamp(high * amp, 0, 1),
      intensity: clamp(intensity * amp, 0, 1),
      beat,
      snap,
      drop,
      songTempo,
      trackIndex,
      spectrum,
      wave,
      waveMax,
      level,
      progression,
      activity,
      boss,
      bossBoost,
      amp,
      time,
      tempo: 0.72 + songTempo * 0.88 + intensity * 0.96 + bass * 0.44
    };
  }

  _rebuildFeatureCells() {
    this.featureCells = new Set();
    if (Array.isArray(this.savedFeatureCells) && this.savedFeatureCells.length) {
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
    const buildNodes = this.feature.key === "AMPLIFIER_NODES";
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

  _musicHue(m, offset = 0) {
    return (188 + offset + m.level * 11 + m.trackIndex * 17 + m.intensity * 42 + Math.sin(m.time * (0.24 + m.songTempo * 0.28) + offset) * 34) % 360;
  }

  _musicPalette(m) {
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
    return palettes[((m.mode % palettes.length) + palettes.length) % palettes.length];
  }

  _musicRand() {
    this._musicSeed = (this._musicSeed * 1664525 + 1013904223) >>> 0;
    return this._musicSeed / 4294967296;
  }

  _ensureTileEnergy(reset = false) {
    const n = Math.max(0, this.cols * this.rows);
    if (!reset && this.tileEnergy?.length === n && this.tileHue?.length === n && this.tileState?.length === n && this.tileShockEnergy?.length === n && this.tileEmpEnergy?.length === n && this.tileBossEnergy?.length === n && this.tileBossHue?.length === n) return;
    this.tileEnergy = new Array(n).fill(0);
    this.tileHue = new Array(n).fill(190);
    this.tileState = new Array(n).fill(0);
    this.tileShockEnergy = new Array(n).fill(0);
    this.tileEmpEnergy = new Array(n).fill(0);
    this.tileBossEnergy = new Array(n).fill(0);
    this.tileBossHue = new Array(n).fill(276);
    this.activeTileEnergy = new Set();
    this.musicWaves = [];
    this.globalMusicPulses = [];
    this._musicLastT = 0;
    this._musicLastBeat = 0;
    this._musicLastSnap = 0;
    this._musicLastDrop = 0;
    this._musicLastSpawn = 0;
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
      life: kind === "drop" ? 1.85 : kind === "snap" ? 0.92 : boss ? 1.8 : kind === "echo" ? 1.45 : 1.15,
      speed: (112 + m.tempo * 72 + m.activity * 58) * (kind === "drop" ? 1.18 : kind === "snap" ? 1.52 : boss ? 1.12 : 1),
      width: this.gridSize * (kind === "drop" ? 0.58 : kind === "snap" ? 0.18 : kind === "echo" ? 0.46 : 0.34) * (boss ? 1.35 : 1),
      amp: clamp((kind === "drop" ? 0.48 : kind === "snap" ? 0.30 : kind === "echo" ? 0.26 : 0.20) + (kind === "snap" ? m.high : m.bass) * 0.18 + (boss ? 0.14 : 0), 0.14, 0.68),
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

  triggerLargeKillPulse(x, y) {
    const now = performance.now() * 0.001;
    if (now - this._lastLargeKillPulseT < 0.22) return;
    this._lastLargeKillPulseT = now;
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

  _drawGlobalMapVisuals(gfx, m, perf) {
    if (perf < 0.7) return;
    const activity = clamp(m.activity || 0.1, 0.1, 1);
    for (const pulse of this.globalMusicPulses) pulse.age += 0.016;
    this.globalMusicPulses = this.globalMusicPulses.filter((pulse) => pulse.age < pulse.life);
    const palette = this._musicPalette(m);
    const t = m.time * (0.35 + m.tempo * 0.18);

    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    const ambientAlpha = clamp(0.025 + m.intensity * 0.055 + m.beat * 0.025, 0, 0.12);
    if (ambientAlpha > 0.01) {
      const gap = this.gridSize * (palette.style === "rain" ? 1.25 : palette.style === "lattice" ? 2 : 3);
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
        for (let y = MAP_EDGE_MARGIN * this.gridSize + drift; y < H; y += gap) {
          gfx.beginPath();
          gfx.moveTo(0, y);
          gfx.lineTo(W, y + Math.sin(m.time * 0.9 + y * 0.01) * this.gridSize * 0.8);
          gfx.stroke();
        }
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

  _drawBackFieldWaveform(gfx, m, perf, turrets = []) {
    if (!m.spectrum?.length || perf < 0.7) return;
    const palette = this._musicPalette(m);
    const cols = Math.max(1, this.cols - MAP_EDGE_MARGIN * 2);
    const baseY = H - this.gridSize * (1.05 + m.bass * 1.18);
    const maxH = Math.min(H * 0.62, this.gridSize * (3.4 + m.intensity * 10.6 + m.beat * 2.8));
    const spectrum = m.spectrum;
    const sampleBand = (idx) => spectrum[clamp(idx, 0, spectrum.length - 1) | 0] || 0;
    const relayColumns = Array.isArray(turrets)
      ? [...new Set(turrets
        .map((t) => Number.isFinite(t?.gx) ? t.gx : Math.floor((t?.x || 0) / this.gridSize))
        .filter((gx) => gx >= MAP_EDGE_MARGIN && gx < this.cols - MAP_EDGE_MARGIN))]
        .sort((a, b) => a - b)
      : [];
    const relayCursor = MAP_EDGE_MARGIN + ((m.time * (3.2 + m.tempo * 2.8)) % 1) * cols;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx++) {
      const pos = (gx - MAP_EDGE_MARGIN) / Math.max(1, cols - 1);
      const bandIndex = Math.floor(pos * (spectrum.length - 1));
      const mirrorIndex = Math.floor((1 - pos) * (spectrum.length - 1));
      const localBand = (sampleBand(bandIndex - 1) + sampleBand(bandIndex) * 2 + sampleBand(bandIndex + 1)) / 4;
      const mirrorBand = (sampleBand(mirrorIndex - 1) + sampleBand(mirrorIndex) * 2 + sampleBand(mirrorIndex + 1)) / 4;
      const centerLift = 1 - Math.abs(pos - 0.5) * 0.55;
      const band = clamp(localBand * 0.45 + mirrorBand * 0.38 + m.intensity * 0.17, 0, 1);
      const phase = Math.sin(m.time * (2.2 + m.tempo * 1.4) + Math.abs(pos - 0.5) * 5.2);
      const height = clamp(maxH * (0.16 + band * 0.86 * centerLift + m.bass * 0.22 + phase * 0.055), this.gridSize * 0.36, maxH);
      const x = gx * this.gridSize + 3;
      const y = baseY - height;
      const w = this.gridSize - 6;
      let relay = null;
      if (relayColumns.length) {
        for (const col of relayColumns) {
          if (col > gx) break;
          if (relayCursor >= col) relay = col;
        }
      }
      const relayPulse = relay === null
        ? 0
        : clamp(1 - Math.abs(gx - relayCursor) / Math.max(2.5, cols * 0.18), 0.18, 1);
      const relayHue = (42 + Math.sin(m.time * 2.4 + (relay || 0) * 0.27) * 28 + m.high * 44) % 360;
      const hue = relay === null
        ? (palette.solid + band * 44 + gx * 1.5) % 360
        : (relayHue * 0.72 + (palette.accent + band * 28) * 0.28) % 360;
      const alpha = clamp(0.07 + band * 0.24 + m.intensity * 0.08 + m.beat * 0.08, 0.08, 0.36);
      const grad = gfx.createLinearGradient(0, y, 0, baseY);
      grad.addColorStop(0, `hsla(${hue}, 100%, ${68 + relayPulse * 8}%, ${alpha + relayPulse * 0.06})`);
      grad.addColorStop(0.55, `hsla(${relay === null ? palette.accent : 150}, 100%, ${54 + relayPulse * 8}%, ${alpha * (0.60 + relayPulse * 0.18)})`);
      grad.addColorStop(1, `hsla(${hue}, 100%, 42%, 0.02)`);
      gfx.globalAlpha = 1;
      gfx.fillStyle = grad;
      gfx.fillRect(x, y, w, height);
      if (band > 0.34 || m.beat > 0.2) {
        gfx.globalAlpha = clamp(alpha * (0.75 + relayPulse * 0.5), 0, 0.30);
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

  _updateTileEnergy(m, perf) {
    this._ensureTileEnergy();
    this._lastMusicGrid = m;
    const now = Number.isFinite(m.time) ? m.time : performance.now() * 0.001;
    const dt = this._musicLastT ? clamp(now - this._musicLastT, 0.001, 0.06) : 0.016;
    this._musicLastT = now;
    const activity = clamp(m.activity || 0.1, 0.1, 1);
    const palette = this._musicPalette(m);
    const decay = 0.54 - activity * 0.12;
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
      if (next <= 0.01 && shockNext <= 0.01 && empNext <= 0.01 && bossNext <= 0.01) {
        this.tileState[i] = 0;
        this.activeTileEnergy.delete(i);
      }
      else if (next < 0.12) this.tileState[i] = 4;
    }

    const beatRise = m.beat > 0.62 && this._musicLastBeat <= 0.62;
    const snapRise = m.snap > 0.58 && this._musicLastSnap <= 0.58;
    const dropRise = m.drop > 0.58 && this._musicLastDrop <= 0.58;
    const spawnGap = now - this._musicLastSpawn;
    const passiveGap = clamp(0.85 - activity * 0.52 - m.intensity * 0.18, 0.18, 0.85);
    if (dropRise) {
      this._spawnMusicWave(m, "drop", false);
      this._spawnMusicWave(m, "echo", false);
      this._spawnGlobalPulse(m, "flash");
      this._musicLastSpawn = now;
    } else if (beatRise) {
      this._spawnMusicWave(m, "echo", false);
      if (m.bass > 0.50) this._spawnMusicWave(m, "ripple", false);
      if (m.mid > 0.34) this._spawnGlobalPulse(m, "sweep");
      this._musicLastSpawn = now;
    } else if (spawnGap > passiveGap && (m.mid + m.bass * 0.7) > (0.36 - activity * 0.16)) {
      this._spawnMusicWave(m, activity > 0.5 ? "pulse" : "echo", false);
      this._musicLastSpawn = now;
    }
    if (snapRise) this._spawnMusicWave(m, "snap", false);
    this._musicLastBeat = m.beat;
    this._musicLastSnap = m.snap;
    this._musicLastDrop = m.drop;

    const maxDist = Math.hypot(W, H) + this.gridSize * 4;
    for (const wave of this.musicWaves) wave.age += dt;
    this.musicWaves = this.musicWaves.filter((wave) => wave.age < wave.life && wave.age * wave.speed < maxDist);

    const hasLargeKillWave = this.musicWaves.some((wave) => wave.kind === "largeKill" && wave.age >= 0);
    const hasEmpWave = this.musicWaves.some((wave) => (wave.kind === "empPulse" || wave.kind === "empEcho" || wave.kind === "empKill") && wave.age >= 0);
    const hasBossKillWave = this.musicWaves.some((wave) => (wave.kind === "miniBossKill" || wave.kind === "mainBossKill") && wave.age >= 0);
    const hasAbilityKillWave = this.musicWaves.some((wave) => (wave.kind === "pulseBurstKill" || wave.kind === "overchargeKill") && wave.age >= 0);
    const hasGridEventWave = hasLargeKillWave || hasEmpWave || hasBossKillWave || hasAbilityKillWave;
    const stride = hasGridEventWave ? 1 : perf < 0.7 ? 3 : 2;
    const waveMove = now * (1.7 + m.tempo * 0.8);
    const sparkCutoff = 0.92 - activity * 0.14 - m.high * 0.08;
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
        const sweep = Math.pow(0.5 + 0.5 * Math.sin(phase), 2.4) * m.mid * (0.035 + activity * 0.13);
        const bassBreath = m.bass * (0.012 + activity * 0.07 + m.beat * 0.045) * (0.65 + 0.35 * Math.sin(now * (1.2 + m.tempo) + gx * 0.14 + gy * 0.11));
        let add = buildable ? sweep + bassBreath : 0;
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
          const strength = ring * ring * fade * wave.amp;
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
          add += 0.10 + m.high * 0.12;
          hue = palette.spark;
          state = 1;
        }

        if (add <= 0.002) continue;
        const cap = clamp(0.22 + activity * 0.20, 0.22, 0.44);
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
    const hasGridEventActivity = hasGridEventWave || [...this.activeTileEnergy].some((idx) =>
      (this.tileShockEnergy[idx] || 0) > 0.01 || (this.tileEmpEnergy[idx] || 0) > 0.01
      || (this.tileBossEnergy[idx] || 0) > 0.01
    );
    const maxActive = hasGridEventActivity ? this.cols * this.rows : perf < 0.7 ? 72 : 150;
    if (this.activeTileEnergy.size > maxActive) {
      const drop = this.activeTileEnergy.size - maxActive;
      let removed = 0;
      for (const idx of this.activeTileEnergy) {
        this.activeTileEnergy.delete(idx);
        this.tileEnergy[idx] = 0;
        this.tileState[idx] = 0;
        this.tileShockEnergy[idx] = 0;
        this.tileEmpEnergy[idx] = 0;
        this.tileBossEnergy[idx] = 0;
        if (++removed >= drop) break;
      }
    }
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
      gfx.globalAlpha = clamp(fade * wave.amp * (isBossKill ? 0.82 : isLargeKill ? 0.78 : isEmp ? 0.72 : isAbilityKill ? 0.68 : isSnap ? 0.66 : 0.50), 0, isBossKill ? 0.56 : isLargeKill ? 0.52 : isEmp ? 0.48 : isAbilityKill ? 0.46 : isSnap ? 0.40 : 0.36);
      gfx.strokeStyle = `hsla(${wave.hue}, 100%, 68%, 0.96)`;
      gfx.lineWidth = isBossKill ? 2.35 : isLargeKill ? 2.1 : isEmp ? 1.8 : isAbilityKill ? 1.65 : isSnap ? 0.9 : 1.15;
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
    const radius = (m.time * (170 + m.tempo * 120)) % maxR;
    const hit = Math.max(m.beat, m.snap * 0.86);
    const band = Math.max(this.gridSize * (m.snap > m.beat ? 0.72 : 1.05), 26);
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
        const alpha = clamp((0.025 + k * hit * 0.20) * (0.78 + m.progression * 0.42), 0, 0.28);
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
    const maxHeight = usableRows * (0.16 + m.bass * 0.48 + m.intensity * 0.22 + m.beat * 0.20 + m.snap * 0.08) * (0.72 + progression * 0.32);
    const flow = m.time * (1.7 + m.tempo * 1.6);
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    for (let gx = MAP_EDGE_MARGIN; gx < this.cols - MAP_EDGE_MARGIN; gx += colStep) {
      const bandIndex = Math.floor((gx - MAP_EDGE_MARGIN) / Math.max(1, this.cols - MAP_EDGE_MARGIN * 2) * m.spectrum.length) % m.spectrum.length;
      const band = m.spectrum[bandIndex] || 0;
      const tide = 0.5 + 0.5 * Math.sin(flow + gx * (palette.style === "rain" ? 0.78 : 0.34));
      const peak = clamp(maxHeight * (0.40 + band * 1.10 + m.mid * tide * 0.34), 1, usableRows);
      for (let rise = 0; rise < peak; rise += rowStep) {
        const gy = this.rows - MAP_EDGE_MARGIN - 1 - rise;
        const idx = gy * this.cols + gx;
        const v = this.cells[idx];
        if (v !== 1 && v !== 3) continue;
        if (this._isBuildableCorrupted(gx, gy, idx, v)) continue;
        const edge = clamp(1 - rise / Math.max(1, peak), 0, 1);
        const wave = 0.52 + 0.48 * Math.sin(flow * 0.74 - rise * 0.42 + gx * 0.21);
        let alpha = (0.035 + band * 0.14 + m.bass * edge * 0.075 + m.mid * wave * 0.045 + m.snap * 0.035) * (0.74 + progression * 0.34);
        if (palette.style === "rain") alpha *= 0.82 + tide * 0.34;
        if (palette.style === "reactor") alpha *= 0.90 + m.beat * 0.36;
        alpha = clamp(alpha, 0.026, 0.32);
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
    if (perf < 0.7 || m.progression < 0.14) return;
    const stride = m.progression < 0.42 ? 6 : m.progression < 0.72 ? 5 : 4;
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
        const barW = Math.max(2, (this.gridSize - 12) / 5);
        for (let b = 0; b < 3; b++) {
          const level = bands[b] * (0.6 + 0.4 * Math.sin(m.time * (2.2 + b) + gx * 0.3 + gy * 0.2));
          const h = clamp(level, 0, 1) * (this.gridSize * 0.38);
          const bx = x + 6 + b * (barW + 2);
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

    // Background "nebula grid"
    gfx.save();
    gfx.globalAlpha = clamp(0.24 + musicGrid.intensity * 0.11, 0.22, 0.35);
    gfx.strokeStyle = this.env.grid || "rgba(98,242,255,0.12)";
    gfx.lineWidth = 1;
    for (let x = 0; x < W; x += gridStep) {
      gfx.beginPath(); gfx.moveTo(x + 0.5, 0); gfx.lineTo(x + 0.5, H); gfx.stroke();
    }
    for (let y = 0; y < H; y += gridStep) {
      gfx.beginPath(); gfx.moveTo(0, y + 0.5); gfx.lineTo(W, y + 0.5); gfx.stroke();
    }
    gfx.restore();
    this._updateTileEnergy(musicGrid, perf);
    this._drawBackFieldWaveform(gfx, musicGrid, perf, turrets);
    this._drawGridEqualizer(gfx, musicGrid, perf);
    this._drawGridSpectrumCells(gfx, musicGrid, perf);
    this._drawGlobalMapVisuals(gfx, musicGrid, perf);

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
        let modeGlow = bassBreath * 0.7;
        if (musicGrid.mode === 1) modeGlow = waveSweep;
        else if (musicGrid.mode === 2) modeGlow = bassBreath * 0.42;
        else if (musicGrid.mode === 3) modeGlow = waveSweep * 0.45 + musicGrid.high * 0.35;
        else if (musicGrid.mode === 4) modeGlow = bassBreath * 0.45 + waveSweep * 0.35;
        const tileEnergy = corrupted ? 0 : (this.tileEnergy[idx] || 0);
        const tileHue = this.tileHue[idx] ?? colorHue;
        const tileState = this.tileState[idx] || 0;
        const musicGlow = corrupted ? 0 : clamp(modeGlow * 0.28 + tileEnergy, 0, 1);

        // soft, animated sheen
        const pulse = 0.35 + 0.25 * Math.sin(t * 1.2 + gx * 0.7 + gy * 0.5);
        if (v === 3) {
          const goldPulse = 0.55 + 0.35 * Math.sin(t * 2.4 + gx * 0.6 + gy * 0.4);
          gfx.fillStyle = `rgba(255,207,91,${clamp(0.15 + goldPulse * 0.16 + musicGlow * 0.045, 0, 0.32)})`;
        } else {
          gfx.fillStyle = `hsla(${tileHue}, 100%, 58%, ${clamp(0.026 + pulse * 0.015 + musicGlow * 0.09, 0, 0.18)})`;
        }
        gfx.fillRect(x, y, this.gridSize, this.gridSize);

        gfx.strokeStyle = v === 3
          ? `rgba(255,207,91,${clamp(0.42 + pulse * 0.16 + musicGlow * 0.07, 0, 0.66)})`
          : `hsla(${(tileHue + 72) % 360}, 100%, 66%, ${clamp(0.065 + pulse * 0.045 + musicGlow * 0.14, 0, 0.30)})`;
        gfx.lineWidth = 1;
        gfx.strokeRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);

        if (!corrupted && perf >= 0.7 && musicGrid.high > 0.12) {
          const sparkGate = (gx * 17 + gy * 31 + Math.floor(musicGrid.time * (6 + musicGrid.tempo * 4))) % Math.max(11, 28 - Math.floor(musicGrid.activity * 12));
          if (sparkGate === 0 || tileState === 1 && tileEnergy > 0.16) {
            const s = 3 + musicGrid.high * 5 + tileEnergy * 8;
            gfx.save();
            gfx.globalCompositeOperation = "lighter";
            gfx.globalAlpha = clamp(0.04 + musicGrid.high * 0.12 + tileEnergy * 0.20, 0, 0.30);
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
    this._drawGridBeatRipple(gfx, musicGrid, perf);
    if (musicGrid.progression >= 0.22) this._drawSynthGridSweep(gfx, musicGrid, perf);
    if (musicGrid.progression >= 0.34) this._drawGridSequencer(gfx, musicGrid, perf);
    if (musicGrid.progression >= 0.48 && musicGrid.activity > 0.40) this._drawCircuitFlow(gfx, musicGrid, perf);
    this._drawEventTileOverlays(gfx, perf);
    this._drawIntegratedRings(gfx, perf);

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

    const trackBoost = musicGrid.mode === 4 ? musicGrid.intensity * 0.08 + musicGrid.beat * 0.06 : 0;
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
    this._drawPathEqualizer(gfx, musicGrid, perf);
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
      gfx.globalAlpha = clamp(0.16 + musicGrid.intensity * 0.12 + (musicGrid.mode === 4 ? musicGrid.beat * 0.06 : 0), 0, 0.30);
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
      const prog = (t * (0.16 + (musicGrid.mode === 4 ? musicGrid.tempo * 0.055 : musicGrid.intensity * 0.025)) + r / streakCount) % 1;
      const d = this.totalLen * prog;
      const p = this.posAt(d);
      const dx = Math.cos(p.ang);
      const dy = Math.sin(p.ang);
      const len = 70;
      gfx.save();
      gfx.globalAlpha = clamp(0.24 + musicGrid.intensity * 0.08 + (musicGrid.mode === 4 ? musicGrid.bass * 0.06 : 0), 0, 0.35);
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


