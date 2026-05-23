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
    this.pathN = [];
    this.pathPts = [];
    this.segs = [];
    this.totalLen = 1;
    this.boundsN = null;
    this.env = ENV_PRESETS[0];
    this._padlockImg = null;
    this._padlockLoaded = false;
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
    return !!tile && tile.corrupted === true;
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
    const time = Number.isFinite(music?.time) ? music.time : performance.now() * 0.001;
    return {
      mode: Number.isFinite(music?.mode) ? music.mode | 0 : 0,
      bass,
      mid,
      high,
      intensity,
      beat,
      time,
      tempo: 0.65 + intensity * 1.55 + bass * 0.75
    };
  }

  _drawMusicRipple(gfx, m) {
    if (!this.pathPts?.length || m.beat <= 0.02) return;
    const [sx, sy] = this.pathPts[0];
    const maxR = Math.hypot(W, H) + 160;
    const radius = (m.time * (170 + m.tempo * 120)) % maxR;
    gfx.save();
    gfx.globalCompositeOperation = "lighter";
    gfx.globalAlpha = clamp(0.06 + m.beat * 0.18, 0, 0.25);
    gfx.strokeStyle = "rgba(98,242,255,0.85)";
    gfx.lineWidth = 1.5 + m.beat * 2;
    gfx.beginPath();
    gfx.arc(sx, sy, radius, 0, Math.PI * 2);
    gfx.stroke();
    gfx.globalAlpha = clamp(0.035 + m.beat * 0.10, 0, 0.16);
    gfx.strokeStyle = "rgba(255,150,76,0.75)";
    gfx.beginPath();
    gfx.arc(sx, sy, Math.max(0, radius - 26), 0, Math.PI * 2);
    gfx.stroke();
    gfx.restore();
  }

  _drawCircuitFlow(gfx, m, perf) {
    if (perf < 0.7 || m.mid + m.high < 0.12) return;
    const phase = Math.floor(m.time * (5 + m.tempo * 4));
    const step = Math.max(2, perf < 1 ? 3 : 2);
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
        const a = clamp(0.04 + m.mid * 0.10 + m.high * 0.08, 0, 0.22);
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

  drawBase(gfx, music = null) {
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

    const t = performance.now() * 0.001;

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
        const cx = x + this.gridSize * 0.5;
        const cy = y + this.gridSize * 0.5;
        const spawn = this.pathPts?.[0] || [0, 0];
        const distSpawn = Math.hypot(cx - spawn[0], cy - spawn[1]);
        const mapDiag = Math.max(1, Math.hypot(W, H));
        const wavePhase = musicGrid.time * (1.1 + musicGrid.tempo * 1.35) - (gx * 0.36 + gy * 0.22);
        const waveSweep = (0.5 + 0.5 * Math.sin(wavePhase)) * musicGrid.mid;
        const bassBreath = musicGrid.bass * (0.55 + 0.45 * Math.sin(musicGrid.time * (1.2 + musicGrid.tempo) + gx * 0.16 + gy * 0.11));
        const rippleRadius = (musicGrid.time * (170 + musicGrid.tempo * 120)) % (mapDiag + 160);
        const ripple = musicGrid.beat * Math.max(0, 1 - Math.abs(distSpawn - rippleRadius) / Math.max(34, this.gridSize * 1.8));
        const trackSync = this.segs?.length ? 1 - clamp(Math.sqrt(distanceToSegmentsSquared(cx, cy, this.segs)) / Math.max(1, TRACK_RADIUS + this.gridSize * 3.5), 0, 1) : 0;
        let modeGlow = bassBreath * 0.7;
        if (musicGrid.mode === 1) modeGlow = waveSweep;
        else if (musicGrid.mode === 2) modeGlow = ripple + bassBreath * 0.25;
        else if (musicGrid.mode === 3) modeGlow = waveSweep * 0.45 + musicGrid.high * 0.35;
        else if (musicGrid.mode === 4) modeGlow = trackSync * (musicGrid.bass * 0.55 + musicGrid.mid * 0.35) + waveSweep * 0.25;
        const musicGlow = corrupted ? 0 : clamp(modeGlow, 0, 1);

        // soft, animated sheen
        const pulse = 0.35 + 0.25 * Math.sin(t * 1.2 + gx * 0.7 + gy * 0.5);
        if (v === 3) {
          const goldPulse = 0.55 + 0.35 * Math.sin(t * 2.4 + gx * 0.6 + gy * 0.4);
          gfx.fillStyle = `rgba(255,207,91,${clamp(0.16 + goldPulse * 0.18 + musicGlow * 0.04, 0, 0.35)})`;
        } else {
          gfx.fillStyle = `rgba(98,242,255,${clamp(0.035 + pulse * 0.02 + musicGlow * 0.085, 0, 0.16)})`;
        }
        gfx.fillRect(x, y, this.gridSize, this.gridSize);

        gfx.strokeStyle = v === 3
          ? `rgba(255,207,91,${clamp(0.45 + pulse * 0.2 + musicGlow * 0.08, 0, 0.72)})`
          : `rgba(154,108,255,${clamp(0.08 + pulse * 0.06 + musicGlow * 0.16, 0, 0.30)})`;
        gfx.lineWidth = 1;
        gfx.strokeRect(x + 1, y + 1, this.gridSize - 2, this.gridSize - 2);

        if (!corrupted && (musicGrid.mode === 1 || musicGrid.mode === 4) && waveSweep > 0.16) {
          gfx.save();
          gfx.globalCompositeOperation = "lighter";
          gfx.globalAlpha = clamp(waveSweep * 0.16, 0, 0.20);
          gfx.fillStyle = v === 3 ? "rgba(255,207,91,0.75)" : "rgba(98,242,255,0.75)";
          gfx.fillRect(x + 2, y + 2, this.gridSize - 4, this.gridSize - 4);
          gfx.restore();
        }

        if (!corrupted && ripple > 0.04) {
          gfx.save();
          gfx.globalCompositeOperation = "lighter";
          gfx.globalAlpha = clamp(ripple * 0.22, 0, 0.25);
          gfx.strokeStyle = "rgba(98,242,255,0.9)";
          gfx.lineWidth = 1.5;
          gfx.strokeRect(x + 3, y + 3, this.gridSize - 6, this.gridSize - 6);
          gfx.restore();
        }

        if (!corrupted && perf >= 0.7 && musicGrid.high > 0.12) {
          const sparkGate = (gx * 17 + gy * 31 + Math.floor(musicGrid.time * (6 + musicGrid.tempo * 4))) % 23;
          if (sparkGate === 0) {
            const s = 4 + musicGrid.high * 5;
            gfx.save();
            gfx.globalCompositeOperation = "lighter";
            gfx.globalAlpha = clamp(0.05 + musicGrid.high * 0.17, 0, 0.22);
            gfx.strokeStyle = v === 3 ? "rgba(255,232,156,0.92)" : "rgba(190,248,255,0.92)";
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
    this._drawMusicRipple(gfx, musicGrid);
    this._drawCircuitFlow(gfx, musicGrid, perf);

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


