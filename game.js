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
    DPR = clamp(window.devicePixelRatio || 1, 1, 2);
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
  const overlay = $("overlay");
  const closeHelp = $("closeHelp");
  const buildList = $("buildList");
  const selectionBody = $("selectionBody");
  const selSub = $("selSub");
  const sellBtn = $("sellBtn");
  const toastEl = $("toast");
  const tooltipEl = $("tooltip");
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

  const speedBtn = $("speedBtn");
  const SAVE_KEY = "orbit_echo_save_v1";
  const AUDIO_KEY = "orbit_echo_audio_v1";
  const START_GOLD = 330;
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
  const OVERCHARGE_COOLDOWN = 180;
  const SKIP_GOLD_BONUS = 25;
  const INTERMISSION_SECS = 15;
  const TOWER_UNLOCKS = {
    PULSE: 1,
    ARC: 1,
    FROST: 1,
    VENOM: 1,
    LENS: 5,
    MORTAR: 7,
    NEEDLE: 9,
    DRONE: 12,
    AURA: 15,
    TRAP: 15
  };

  const MAP_PRESETS = [
    {
      name: "Orbit Lane",
      pathN: [
        [0.05, 0.70],
        [0.18, 0.70],
        [0.26, 0.56],
        [0.34, 0.56],
        [0.43, 0.78],
        [0.56, 0.78],
        [0.64, 0.46],
        [0.75, 0.46],
        [0.82, 0.62],
        [0.92, 0.62],
      ],
      islands: [
        { cx: 0.33, cy: 0.52, rO: 0.26, rI: 0.12 },
        { cx: 0.68, cy: 0.56, rO: 0.24, rI: 0.11 },
        { cx: 0.52, cy: 0.30, rO: 0.18, rI: 0.08 },
      ]
    },
    {
      name: "Crescent Drift",
      pathN: [
        [0.05, 0.62],
        [0.20, 0.62],
        [0.30, 0.44],
        [0.40, 0.44],
        [0.52, 0.68],
        [0.66, 0.68],
        [0.74, 0.38],
        [0.84, 0.38],
        [0.90, 0.56],
        [0.95, 0.56],
      ],
      islands: [
        { cx: 0.30, cy: 0.50, rO: 0.24, rI: 0.11 },
        { cx: 0.66, cy: 0.54, rO: 0.22, rI: 0.10 },
        { cx: 0.52, cy: 0.28, rO: 0.16, rI: 0.07 },
      ]
    },
    {
      name: "Split Arc",
      pathN: [
        [0.05, 0.74],
        [0.16, 0.74],
        [0.26, 0.58],
        [0.36, 0.58],
        [0.46, 0.40],
        [0.60, 0.40],
        [0.72, 0.62],
        [0.82, 0.62],
        [0.90, 0.48],
        [0.96, 0.48],
      ],
      islands: [
        { cx: 0.30, cy: 0.60, rO: 0.25, rI: 0.11 },
        { cx: 0.70, cy: 0.50, rO: 0.23, rI: 0.10 },
        { cx: 0.52, cy: 0.24, rO: 0.16, rI: 0.07 },
      ]
    },
    {
      name: "Glass Helix",
      pathN: [
        [0.05, 0.58],
        [0.16, 0.58],
        [0.26, 0.72],
        [0.36, 0.72],
        [0.46, 0.52],
        [0.60, 0.52],
        [0.70, 0.30],
        [0.82, 0.30],
        [0.90, 0.52],
        [0.96, 0.52],
      ],
      islands: [
        { cx: 0.34, cy: 0.60, rO: 0.24, rI: 0.11 },
        { cx: 0.68, cy: 0.46, rO: 0.22, rI: 0.10 },
        { cx: 0.54, cy: 0.26, rO: 0.17, rI: 0.08 },
      ]
    },
    {
      name: "Pulse Gate",
      pathN: [
        [0.05, 0.66],
        [0.18, 0.66],
        [0.28, 0.50],
        [0.38, 0.50],
        [0.48, 0.70],
        [0.62, 0.70],
        [0.72, 0.52],
        [0.82, 0.52],
        [0.90, 0.64],
        [0.96, 0.64],
      ],
      islands: [
        { cx: 0.30, cy: 0.52, rO: 0.25, rI: 0.11 },
        { cx: 0.70, cy: 0.58, rO: 0.23, rI: 0.10 },
        { cx: 0.52, cy: 0.32, rO: 0.17, rI: 0.08 },
      ]
    },
    {
      name: "Nova Bend",
      pathN: [
        [0.05, 0.72],
        [0.18, 0.72],
        [0.30, 0.60],
        [0.40, 0.60],
        [0.50, 0.78],
        [0.62, 0.78],
        [0.74, 0.60],
        [0.84, 0.60],
        [0.90, 0.70],
        [0.96, 0.70],
      ],
      islands: [
        { cx: 0.30, cy: 0.56, rO: 0.24, rI: 0.11 },
        { cx: 0.70, cy: 0.62, rO: 0.23, rI: 0.10 },
        { cx: 0.52, cy: 0.30, rO: 0.18, rI: 0.08 },
      ]
    }
  ];

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
    constructor(preset) {
      const fallback = MAP_PRESETS && MAP_PRESETS.length ? MAP_PRESETS[0] : null;
      this.preset = (preset && preset.pathN && preset.islands) ? preset : fallback;
      // A stylized "orbit lane" path (polyline). Enemies follow this.
      // Coordinates are normalized (0..1) then scaled to canvas each frame.
      this.pathN = this.preset ? this.preset.pathN : [];

      // Grid for placement (build tiles only). We mark a luminous "island" region.
      this.gridSize = 44;
      this.cols = 0;
      this.rows = 0;
      this.cells = []; // 0 blocked, 1 buildable, 2 path (blocked)
      this.powerCells = [];
      this.pathPts = []; // scaled points
      this.segs = []; // segment lengths + cumulative
      this.totalLen = 1;

      this._rebuild();
    }

    setPreset(preset) {
      const fallback = MAP_PRESETS && MAP_PRESETS.length ? MAP_PRESETS[0] : null;
      this.preset = (preset && preset.pathN && preset.islands) ? preset : fallback;
      this.pathN = this.preset ? this.preset.pathN : [];
      this.powerCells = [];
      this._rebuild();
    }

    _rebuild() {
      if (!this.pathN || this.pathN.length < 2) {
        const fallback = MAP_PRESETS && MAP_PRESETS.length ? MAP_PRESETS[0] : null;
        this.preset = fallback;
        this.pathN = fallback ? fallback.pathN : [];
      }
      // Build grid based on current canvas size
      this.cols = Math.floor(W / this.gridSize);
      this.rows = Math.floor(H / this.gridSize);
      this.cells = new Array(this.cols * this.rows).fill(0);

      // Mark buildable: two "ring gardens" around center-left and center-right.
      const islands = (this.preset && this.preset.islands) ? this.preset.islands : [
        { cx: 0.33, cy: 0.52, rO: 0.26, rI: 0.12 },
        { cx: 0.68, cy: 0.56, rO: 0.24, rI: 0.11 },
        { cx: 0.52, cy: 0.30, rO: 0.18, rI: 0.08 },
      ];
      const c1 = islands[0];
      const c2 = islands[1];
      const c3 = islands[2];
      const cx1 = W * c1.cx, cy1 = H * c1.cy;
      const cx2 = W * c2.cx, cy2 = H * c2.cy;
      const cx3 = W * c3.cx, cy3 = H * c3.cy;

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const px = (x + 0.5) * this.gridSize;
          const py = (y + 0.5) * this.gridSize;

          const d1 = Math.sqrt(dist2(px, py, cx1, cy1));
          const d2 = Math.sqrt(dist2(px, py, cx2, cy2));
          const d3 = Math.sqrt(dist2(px, py, cx3, cy3));

          let build = false;
          // "Islands" with holes to feel unique
          if (d1 < W * c1.rO && d1 > W * c1.rI) build = true;
          if (d2 < W * c2.rO && d2 > W * c2.rI) build = true;
          if (d3 < W * c3.rO && d3 > W * c3.rI) build = true;

          // keep some corners empty for composition
          if (px < W * 0.12 && py < H * 0.18) build = false;
          if (px > W * 0.92 && py > H * 0.86) build = false;

          this.cells[y * this.cols + x] = build ? 1 : 0;
        }
      }

      // Scale path
      this.pathPts = this.pathN.map(([nx, ny]) => [nx * W, ny * H]);

      // Mark path cells as blocked (2)
      for (let i = 0; i < this.pathPts.length - 1; i++) {
        const [ax, ay] = this.pathPts[i];
        const [bx, by] = this.pathPts[i + 1];
        const steps = Math.max(8, Math.floor(Math.hypot(bx - ax, by - ay) / (this.gridSize * 0.35)));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = lerp(ax, bx, t);
          const py = lerp(ay, by, t);
          const gx = Math.floor(px / this.gridSize);
          const gy = Math.floor(py / this.gridSize);
          if (gx >= 0 && gy >= 0 && gx < this.cols && gy < this.rows) {
            this.cells[gy * this.cols + gx] = 2;
          }
        }
      }

      // Build segment lengths for path following
      this.segs = [];
      this.totalLen = 0;
      for (let i = 0; i < this.pathPts.length - 1; i++) {
        const [ax, ay] = this.pathPts[i];
        const [bx, by] = this.pathPts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        this.segs.push({ ax, ay, bx, by, len, cum: this.totalLen });
        this.totalLen += len;
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
      // Background "nebula grid"
      gfx.save();
      gfx.globalAlpha = 0.35;
      gfx.strokeStyle = "rgba(98,242,255,0.12)";
      gfx.lineWidth = 1;
      for (let x = 0; x < W; x += this.gridSize) {
        gfx.beginPath(); gfx.moveTo(x + 0.5, 0); gfx.lineTo(x + 0.5, H); gfx.stroke();
      }
      for (let y = 0; y < H; y += this.gridSize) {
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

          // sparkle removed (too busy)
        }
      }

      // Power-up tiles (3-5 buildable cells adjacent to path)
      const buildable = [];
      const nearTrack = [];
      const isNearTrack = (gx, gy) => {
        for (let oy = -2; oy <= 2; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            if (!ox && !oy) continue;
            const nx = gx + ox;
            const ny = gy + oy;
            if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
            if (this.cells[ny * this.cols + nx] === 2) return true;
          }
        }
        return false;
      };
      for (let i = 0; i < this.cells.length; i++) {
        if (this.cells[i] === 1) {
          buildable.push(i);
          const gx = i % this.cols;
          const gy = (i / this.cols) | 0;
          if (isNearTrack(gx, gy)) nearTrack.push(i);
        }
      }
      if (!this.powerCells || this.powerCells.length === 0) {
        const count = 3 + ((Math.random() * 3) | 0);
        const pool = nearTrack.length ? nearTrack : buildable;
        for (let i = pool.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          const tmp = pool[i];
          pool[i] = pool[j];
          pool[j] = tmp;
        }
        this.powerCells = pool.slice(0, Math.min(count, pool.length));
      }
      for (const idx of this.powerCells) {
        if (idx >= 0 && idx < this.cells.length && this.cells[idx] === 1) {
          this.cells[idx] = 3;
        }
      }
      gfx.restore();

      // Path with layered glow
      const pts = this.pathPts;
      if (!pts || pts.length < 2) return;
      gfx.save();
      gfx.lineCap = "round";
      gfx.lineJoin = "round";

      gfx.strokeStyle = "rgba(0,0,0,0.45)";
      gfx.lineWidth = 28;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = "rgba(98,242,255,0.18)";
      gfx.lineWidth = 20;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = "rgba(154,108,255,0.18)";
      gfx.lineWidth = 12;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();

      gfx.strokeStyle = "rgba(234,240,255,0.08)";
      gfx.lineWidth = 2;
      gfx.beginPath();
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) gfx.lineTo(pts[i][0], pts[i][1]);
      gfx.stroke();
      gfx.restore();

      // Flow-field lane energy ribbons
      const ribbonCount = 10;
      for (let i = 0; i < ribbonCount; i++) {
        const prog = (t * 0.22 + i / ribbonCount) % 1;
        const d = this.totalLen * prog;
        const p = this.posAt(d);
        const dx = Math.cos(p.ang);
        const dy = Math.sin(p.ang);
        const len = 26 + (i % 4) * 6;
        gfx.save();
        gfx.globalAlpha = 0.22;
        gfx.strokeStyle = i % 2 ? "rgba(98,242,255,0.75)" : "rgba(154,108,255,0.65)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.moveTo(p.x - dx * len, p.y - dy * len);
        gfx.lineTo(p.x + dx * len, p.y + dy * len);
        gfx.stroke();
        gfx.restore();
      }

      // traveling track streaks (aligned to path)
      const streakCount = 2;
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
        grad.addColorStop(0.5, "rgba(154,108,255,0.7)");
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
      desc: "Fast, fragile."
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
      desc: "High HP, slow."
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
      desc: "Armor reduces Physical."
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
      desc: "Shield absorbs Energy."
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
      desc: "Regenerates over time."
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
      desc: "Stealth until revealed."
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
      desc: "Flying: avoids traps."
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
      desc: "Spawned from Mitosis."
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
      desc: "Miniboss: projects shields to nearby allies."
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
        enemy._game?.spawnText(enemy.x, enemy.y - 14, "SHIELD BREAK", "rgba(154,108,255,0.9)", 0.85);
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
      this.isBoss = typeKey === "BOSS_PROJECTOR";

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
      this.r = this.flying ? 10 : 12;
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
        this.r = 18;
        this.reward = Math.max(this.reward, 55);
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
        applyDamageToEnemy(this, dmg, DAMAGE.CHEM);
        // light shimmer
        game.particles.spawn(this.x, this.y, 1, "chem");
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
      game.spawnText(this.x, this.y - 10, `-${dmgText}`, dmgCol, 0.6);
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
      this._game?.spawnText(this.x, this.y - 12, "SLOWED", "rgba(160,190,255,0.95)", 0.55);
    }

    applyDot(dps, dur) {
      this.dot = Math.max(this.dot, dps);
      const mul = this._dotDurMul || 1;
      const next = Math.max(0.2, dur * mul);
      this.dotT = Math.max(this.dotT, next);
      this._game?.spawnText(this.x, this.y - 12, "BURN", "rgba(109,255,154,0.95)", 0.55);
    }

    reveal(dur) {
      if (!this.stealth && !(this.elite && this.elite.tag === "PHASELINK")) return;
      const wasRevealed = this.revealed;
      this.revealed = true;
      this.revealT = Math.max(this.revealT, dur);
      if (!wasRevealed) {
        this._game?.spawnText(this.x, this.y - 12, "REVEALED", "rgba(98,242,255,0.9)", 0.75);
      }
    }

    addShield(amount, extraCap = 0) {
      const cap = (this.maxShield || 0) + extraCap;
      if (cap <= 0) return;
      this.shield = Math.min(cap, this.shield + amount);
    }

    draw(gfx) {
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
      gfx.ellipse(0, 0, this.r, this.r * 0.85, 0.2, 0, Math.PI * 2);
      gfx.fill();
      gfx.stroke();

      // inner “core”
      gfx.globalAlpha *= 0.95;
      gfx.fillStyle = this.tint;
      gfx.beginPath();
      gfx.ellipse(-this.r * 0.15, 0, this.r * 0.42, this.r * 0.32, -0.6, 0, Math.PI * 2);
      gfx.fill();

      if (this.elite || this.isBoss) {
        const tag = this.elite?.tag;
        const eliteCol =
          this.isBoss ? "rgba(98,242,255,0.95)" :
          tag === "HARDENED" ? "rgba(255,207,91,0.9)" :
          tag === "VOLATILE" ? "rgba(255,91,125,0.9)" :
          "rgba(154,108,255,0.9)";
        gfx.globalAlpha = 0.65;
        gfx.strokeStyle = eliteCol;
        gfx.lineWidth = this.isBoss ? 3 : 2;
        gfx.beginPath();
        gfx.ellipse(0, 0, this.r * 1.35, this.r * 1.05, t * 0.4, 0, Math.PI * 2);
        gfx.stroke();
        if (this.isBoss) {
          gfx.globalAlpha = 0.35;
          gfx.beginPath();
          gfx.ellipse(0, 0, this.r * 1.8, this.r * 1.25, -t * 0.3, 0, Math.PI * 2);
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

      // shield tick
      if (this.shield > 0) {
        gfx.strokeStyle = "rgba(154,108,255,0.85)";
        gfx.lineWidth = 2;
        gfx.beginPath();
        gfx.arc(x, y, this.r + 3, 0, Math.PI * 2);
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
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.style === "mortar") {
        game.particles.spawnDirectional(this.x, this.y, 1, -this.vx, -this.vy, "chem", "rgba(200,210,240,0.45)");
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
            game.spawnText(e.x, e.y - 14, "MARKED", "rgba(154,108,255,0.95)", 0.55);
          }
          if (this.stunChance && Math.random() < this.stunChance) {
            e.applySlow(0.85, 0.35);
            game.spawnText(e.x, e.y - 14, "STUN", "rgba(255,207,91,0.95)", 0.55);
          }
          if (this.revealOnHit) e.reveal(0.7);

          this.pierce--;
          const dirX = -this.vx;
          const dirY = -this.vy;
          game.particles.spawnDirectional(this.x, this.y, 4, dirX, dirY, "hit", "rgba(234,240,255,0.65)");
          if (this.pierce <= 0) {
            this.ttl = 0;
            break;
          }
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

      const g = gfx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 6);
      g.addColorStop(0, glow);
      g.addColorStop(1, "rgba(0,0,0,0)");
      gfx.globalAlpha = 0.9;
      gfx.fillStyle = g;
      gfx.beginPath(); gfx.arc(this.x, this.y, this.r * 6, 0, Math.PI * 2); gfx.fill();

      gfx.fillStyle = col;
      gfx.beginPath(); gfx.arc(this.x, this.y, this.r, 0, Math.PI * 2); gfx.fill();
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
      const pulseMul = this.pulseBoostT > 0 ? 1.5 : 1;
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

          d.cool -= dt * buff.rateMul * skip.rateMul * pulseMul * globalMul;
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
              const dmg = this.dmg * buff.dmgMul * skip.dmgMul;
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
        this.cool -= dt * skip.rateMul * pulseMul * globalMul;
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
              dmg: this.dmg * skip.dmgMul,
              slow: this.trapSlow,
              dot: this.trapDot ? { dps: this.trapDot.dps * skip.dmgMul, dur: this.trapDot.dur } : null,
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
      const fireInterval = this.fire / (buff.rateMul * skip.rateMul * pulseMul * globalMul);
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

        const dmgBase = this.dmg * buff.dmgMul * skip.dmgMul;
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
              game.spawnText(target.x, target.y - 18, `CHAIN x${hits}`, "rgba(154,108,255,0.95)", 0.9);
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
      this.mapIndex = 0;
      this.map = new Map(MAP_PRESETS[this.mapIndex]);
      this.particles = new Particles();
      this.audio = new AudioSystem();
      this.explosions = [];
      this.shakeT = 0;
      this.shakeMag = 0;
      this.damageFlash = 0;
      this.floatText = [];
      this.decals = [];
      this.turrets = [];
      this.enemies = [];
      this.projectiles = [];
      this.traps = [];
      this.beams = [];
      this.arcs = [];
      this.cones = [];
      this.lingering = [];
      this.floatText = [];
      this.decals = [];

      this.speed = 1;
      this.gold = START_GOLD;
      this.lives = START_LIVES;
      this.wave = 0;
      this.waveMax = 30;
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
      this.waveStats = this._newWaveStats(0);
      this.abilities = {
        scan: { cd: ABILITY_COOLDOWN, t: 0 },
        pulse: { cd: ABILITY_COOLDOWN, t: 0 },
        overcharge: { cd: OVERCHARGE_COOLDOWN, t: 0 }
      };
      this.globalOverchargeT = 0;

      this.buildKey = null;
      this.selectedTurret = null;
      this.hoverCell = null;
      this.mouse = { x: 0, y: 0 };
      this._id = 1;
      this.collapseEnabled = false;
      this.panelHold = { left: 0, right: 0 };
      this.panelHover = { left: false, right: false };

      this.audio.loadPref();
      this._load();
      this._bindUI();
      this._buildList();
      this.updateHUD();
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

      abilityScanBtn?.addEventListener("click", () => this.useAbility("scan"));
      abilityPulseBtn?.addEventListener("click", () => this.useAbility("pulse"));
      abilityOverBtn?.addEventListener("click", () => this.useAbility("overcharge"));

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
      waveStatsSkip?.addEventListener("click", () => this._closeWaveStats("skip"));
      waveStatsModal?.addEventListener("click", (ev) => {
        if (ev.target === waveStatsModal) this._closeWaveStats("continue");
      });

      sellBtn.addEventListener("click", () => this.sellSelected());

      canvas.addEventListener("mousemove", (ev) => {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ev.clientX - rect.left;
        this.mouse.y = ev.clientY - rect.top;
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
        if (overlay && !overlay.classList.contains("hidden")) return;
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        this.audio.unlock();
        hideTooltip();
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        this.onClick(x, y);
      });
      canvas.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        if (overlay && !overlay.classList.contains("hidden")) return;
        if (settingsModal && !settingsModal.classList.contains("hidden")) return;
        hideTooltip();
        this.clearBuildMode();
        this.selectTurret(null);
        this.collapseEnabled = true;
      });

      window.addEventListener("pointerdown", () => this.audio.unlock(), { once: true });
      canvas.addEventListener("mouseleave", () => hideTooltip());

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
      return overlayOpen || settingsOpen || this.statsOpen;
    }

    isPaused() {
      return this.paused || this.isUiBlocked();
    }

    _newWaveStats(wave) {
      return { wave, kills: 0, leaks: 0, gold: 0, towersBuilt: 0, dmgByType: {} };
    }

    _resetWaveStats() {
      this.waveStats = this._newWaveStats(this.wave);
    }

    recordDamage(sourceKey, amount) {
      if (!sourceKey || !this.waveStats || !this.waveStats.dmgByType) return;
      const key = String(sourceKey);
      this.waveStats.dmgByType[key] = (this.waveStats.dmgByType[key] || 0) + amount;
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
        item.classList.toggle("locked", !unlocked);
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

      const stats = this.waveStats || this._newWaveStats(this.wave);
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
            <div class="statsRow"><div class="k">Wave</div><div class="v">${stats.wave}</div></div>
            <div class="statsRow"><div class="k">Kills</div><div class="v">${stats.kills}</div></div>
            <div class="statsRow"><div class="k">Leaks</div><div class="v">${stats.leaks}</div></div>
            <div class="statsRow"><div class="k">Gold Earned</div><div class="v">${fmt(stats.gold)}</div></div>
            <div class="statsRow"><div class="k">Towers Built</div><div class="v">${stats.towersBuilt}</div></div>
          </div>
          <div class="statsRow">
            <div class="k">Damage By Tower</div>
            <div class="v">${dmgLines}</div>
          </div>
        `;
      }
      if (waveStatsTitle) {
        waveStatsTitle.textContent = mode === "pause" ? "Game Stats" : "Wave Report";
      }
      if (waveStatsContinue) {
        waveStatsContinue.textContent = mode === "pause" ? "Resume" : "Continue";
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
        goldEl.classList.remove("value-low", "value-mid", "value-high");
        if (this.gold < GOLD_LOW) {
          goldEl.classList.add("value-low");
        } else if (this.gold >= GOLD_HIGH) {
          goldEl.classList.add("value-high");
        } else if (this.gold >= GOLD_MID) {
          goldEl.classList.add("value-mid");
        }
      }
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

      startBtn.disabled = this.gameOver || this.gameWon || this.statsOpen;
      startBtn.textContent = this.hasStarted ? "SKIP" : "START";
      if (startBtn) {
        startBtn.title = this.hasStarted ? "Skip for gold bonus" : "Start wave";
      }

      if (this.abilities && abilityScanCd) {
        const scan = this.abilities.scan;
        const pulse = this.abilities.pulse;
        const over = this.abilities.overcharge;
        if (abilityScanBtn) abilityScanBtn.title = "Scan Ping: Reveal all cloaked enemies until they are killed or reach the core.";
        if (abilityPulseBtn) abilityPulseBtn.title = "Pulse Burst: Select a turret, then boost its fire rate for 60s. No selection = red flash.";
        if (abilityOverBtn) abilityOverBtn.title = "Overcharge: Boost all turret fire rates for 30s. 3 min cooldown.";
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
        } else {
          anomalyLabel.textContent = "—";
          anomalyPill?.setAttribute("title", "Wave anomaly");
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
        const anyPulse = this.turrets.some(t => t.pulseBoostT > 0);
        if (anyPulse) {
          toast("Pulse Burst active.");
          return;
        }
      }

      switch (key) {
        case "scan": {
          ability.t = ability.cd;
          let found = 0;
          for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (!e.stealth) continue;
            e._revealLock = true;
            e.revealed = true;
            e.revealT = 0;
            found++;
            this.particles.spawn(e.x, e.y, 6, "muzzle");
            this.explosions.push({
              x: e.x,
              y: e.y,
              r: 10,
              t: 0.28,
              dur: 0.28,
              max: 46,
              col: "rgba(98,242,255,0.85)",
              boom: false
            });
          }
          this.explosions.push({
            x: W * 0.5,
            y: H * 0.5,
            r: 24,
            t: 0.32,
            dur: 0.32,
            max: Math.max(W, H) * 0.35,
            col: "rgba(98,242,255,0.6)",
            boom: false
          });
          this.audio.playLimited("beam", 220);
          toast(found > 0 ? "SCAN PING: stealth revealed" : "SCAN PING: no stealth found");
          break;
        }
        case "pulse": {
          ability.t = ability.cd;
          this.selectedTurret.pulseBoostT = 60;
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
          toast("PULSE BURST: turret fire rate boosted for 60s");
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
      const earlyHp = wave === 1 ? 0.82 : wave === 2 ? 0.90 : wave === 3 ? 0.96 : 1;
      const earlySpd = wave === 1 ? 0.90 : wave === 2 ? 0.95 : 1;
      const late = Math.max(0, wave - 8);
      const latePow = Math.pow(late, 1.12) * 0.016;
      return {
        hp: (1 + i * 0.09 + latePow) * earlyHp * 1.18,
        spd: (1 + i * 0.012) * earlySpd * 1.06,
        armor: (i * 0.0048 + Math.max(0, wave - 12) * 0.0035) * 1.2,
        shield: (1 + i * 0.055 + Math.max(0, wave - 12) * 0.015) * 1.12,
        regen: (1 + i * 0.035 + Math.max(0, wave - 12) * 0.015) * 1.12,
        reward: 1 + i * 0.05
      };
    }

    _buildWave(wave, scalar) {
      const i = wave;
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
      const spawns = [];

      const types = ["RUNNER", "BRUTE"];
      if (i >= 3) types.push("ARMORED");
      if (i >= 6) types.push("SHIELDED");
      if (i >= 7) types.push("SPLITTER");
      if (i >= 9) types.push("REGEN");
      if (i >= 11) types.push("STEALTH");
      if (i >= 13) types.push("FLYING");

      const weights = {
        RUNNER: i <= 4 ? 1.6 : 1.1,
        BRUTE: i <= 4 ? 0.7 : 0.85,
        ARMORED: i <= 7 ? 0.55 : 0.9,
        SHIELDED: i <= 9 ? 0.55 : 0.9,
        SPLITTER: 0.7,
        REGEN: 0.75,
        STEALTH: 0.65,
        FLYING: 0.7
      };

      const pickWeighted = () => {
        const pool = types.map(t => ({ t, w: weights[t] || 1 }));
        const sum = pool.reduce((a, b) => a + b.w, 0);
        let r = Math.random() * sum;
        for (const p of pool) { r -= p.w; if (r <= 0) return p.t; }
        return pool[pool.length - 1].t;
      };

      for (let n = 0; n < baseCount; n++) {
        let type = pickWeighted();
        if (i >= 12 && n % 7 === 0) type = "ARMORED";
        if (i >= 12 && n % 9 === 0) type = "SHIELDED";
        if (i >= 14 && n % 11 === 0) type = "REGEN";
        const t = n * spacing + rand(-0.15, 0.15);
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
        setTimeout(() => toast(`ANOMALY: ${base.name}`), 700);
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
          mapIndex: this.mapIndex,
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

        if (typeof data.mapIndex === "number" && Number.isFinite(data.mapIndex)) {
          this.mapIndex = clamp(data.mapIndex | 0, 0, MAP_PRESETS.length - 1);
        } else {
          this.mapIndex = 0;
        }
        this.map.setPreset(MAP_PRESETS[this.mapIndex]);
        if (Array.isArray(data.powerCells)) {
          this.map.powerCells = data.powerCells.slice();
          this.map._rebuild();
        }
        this.gold = data.gold ?? this.gold;
        this.lives = data.lives ?? this.lives;
        this.wave = data.wave ?? this.wave;
        this.waveMax = data.waveMax ?? this.waveMax;
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

      this.gold = START_GOLD;
      this.lives = START_LIVES;
      this.wave = 0;
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
          showConfirm("Defeat", "Defeat. Reset the game?", () => {
            try { localStorage.removeItem(SAVE_KEY); } catch (err) {}
            window.location.reload();
          });
        }
      }
    }

    isCellOccupied(gx, gy) {
      return this.turrets.some(t => t.gx === gx && t.gy === gy);
    }

    onClick(x, y) {
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
        this.selectTurret(turret);
        this.particles.spawn(w.x, w.y, 8, "muzzle");
        this.audio.play("build");
        this._save();
        return;
      }

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
        return;
      }

      this.selectTurret(null);
    }

    selectTurret(turret) {
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
                const delta = [
                  `Dmg ${turret.dmg.toFixed(1)}→${preview.dmg.toFixed(1)}`,
                  `Fire ${turret.fire.toFixed(2)}→${preview.fire.toFixed(2)}`,
                  `Range ${turret.range.toFixed(0)}→${preview.range.toFixed(0)}`
                ].join("  ");
                return `
                  <div class="modChoice">
                    <div class="modTop">
                      <div class="modName">${m.name}</div>
                      <div class="modCost">${m.cost}g</div>
                    </div>
                    <div class="modDesc">${m.desc}</div>
                    <div class="modDelta">${delta}</div>
                    <div class="modBtnRow">
                      <button class="btn ${this.gold >= m.cost ? "primary" : ""}" data-mod="${idx}">Upgrade</button>
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
            if (this.mapIndex < MAP_PRESETS.length - 1) {
              this.mapIndex++;
              this.map.setPreset(MAP_PRESETS[this.mapIndex]);
              this._resetRun();
              toast(`Map cleared. Next map: ${MAP_PRESETS[this.mapIndex].name}`);
              this._save();
            } else {
              // last map cleared: generate a random map (from presets)
              const next = MAP_PRESETS[(Math.random() * MAP_PRESETS.length) | 0];
              this.map.setPreset(next);
              this._resetRun();
              toast(`New random map: ${next.name}`);
              this._save();
            }
            this.audio.play("win");
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
      if (this.shakeT > 0) {
        const sx = (Math.random() * 2 - 1) * this.shakeMag;
        const sy = (Math.random() * 2 - 1) * this.shakeMag;
        gfx.save();
        gfx.translate(sx, sy);
      }
      this.map.drawBase(gfx);

      // hover highlight
      if (this.hoverCell && (this.hoverCell.v === 1 || this.hoverCell.v === 3)) {
        const x = this.hoverCell.gx * this.map.gridSize;
        const y = this.hoverCell.gy * this.map.gridSize;
        gfx.save();
        gfx.strokeStyle = this.hoverCell.v === 3 ? "rgba(255,207,91,0.55)" : "rgba(98,242,255,0.35)";
        gfx.lineWidth = 2;
        gfx.strokeRect(x + 2, y + 2, this.map.gridSize - 4, this.map.gridSize - 4);
        gfx.restore();
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
      for (const e of this.enemies) e.draw(gfx);

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
      if (this.shakeT > 0) gfx.restore();
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


