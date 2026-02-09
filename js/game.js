console.log("🚨 NEBULA TD LIVE BUILD: bda2af0");
document.title = "Nebula TD — LIVE bda2af0";
/* Nebula TD
   Single-canvas sci-fi turret defense with:
   - 5 turret types + upgrades
   - Skip/Next wave button (spawns next wave immediately, stacking enemies)
   - Zoom + pan with mouse
   - HUD UI + turret picker + selection/upgrades
   - WebAudio SFX (no external audio files)
*/
(() => {
  'use strict';

  // ---------- Helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx*dx + dy*dy;
  };

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const uiWave = document.getElementById('uiWave');
  const uiLives = document.getElementById('uiLives');
  const uiMoney = document.getElementById('uiMoney');

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnNextWave = document.getElementById('btnNextWave');

  const turretGrid = document.getElementById('turretGrid');
  const logEl = document.getElementById('log');
  const toastEl = document.getElementById('toast');

  const selectedNone = document.getElementById('selectedNone');
  const selectedCard = document.getElementById('selectedCard');
  const selIcon = document.getElementById('selIcon');
  const selName = document.getElementById('selName');
  const selType = document.getElementById('selType');
  const selLvl = document.getElementById('selLvl');
  const selDmg = document.getElementById('selDmg');
  const selRof = document.getElementById('selRof');
  const selRng = document.getElementById('selRng');
  const selSpec = document.getElementById('selSpec');
  const selNote = document.getElementById('selNote');
  const btnUpgrade = document.getElementById('btnUpgrade');
  const btnSell = document.getElementById('btnSell');

  // ---------- Assets ----------
  const ASSET = {
    bg: new Image(),
    turret: [],
    enemy: {
      drone: new Image(),
      walker: new Image(),
      tank: new Image(),
    }
  };

  ASSET.bg.src = 'assets/images/background.png';
  for (let i=1; i<=5; i++){
    const im = new Image();
    im.src = `assets/images/turret_${i}.png`;
    ASSET.turret.push(im);
  }
  ASSET.enemy.drone.src = 'assets/images/enemy_drone.png';
  ASSET.enemy.walker.src = 'assets/images/enemy_walker.png';
  ASSET.enemy.tank.src = 'assets/images/enemy_tank.png';

  // ---------- WebAudio SFX ----------
  let audioCtx = null;
  function ensureAudio(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  function beep({freq=440, dur=0.06, type='sine', vol=0.14, detune=0, decay=0.08}={}){
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    o.detune.setValueAtTime(detune, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + decay);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + dur + decay + 0.02);
  }
  function noiseBurst({dur=0.08, vol=0.12}={}){
    if (!audioCtx) return;
    const sr = audioCtx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = audioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i=0;i<len;i++){
      const t = i/len;
      data[i] = (Math.random()*2-1) * (1-t);
    }
    const src = audioCtx.createBufferSource();
    const g = audioCtx.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(audioCtx.destination);
    src.start();
  }

  // ---------- Map ----------
  // World coordinates (0..WORLD_W, 0..WORLD_H)
  const WORLD_W = 2400;
  const WORLD_H = 1400;

  // A path polyline enemies follow
  const path = [
    {x: 80,  y: 720},
    {x: 420, y: 720},
    {x: 620, y: 520},
    {x: 900, y: 520},
    {x: 1120,y: 820},
    {x: 1400,y: 820},
    {x: 1640,y: 520},
    {x: 1920,y: 520},
    {x: 2240,y: 720},
    {x: 2320,y: 720},
  ];

  // Build grid
  const GRID = 56;
  const gridCols = Math.floor(WORLD_W / GRID);
  const gridRows = Math.floor(WORLD_H / GRID);

  function pointToSegmentDist2(px, py, ax, ay, bx, by){
    const abx = bx-ax, aby = by-ay;
    const apx = px-ax, apy = py-ay;
    const ab2 = abx*abx + aby*aby;
    const t = ab2 === 0 ? 0 : clamp((apx*abx + apy*aby)/ab2, 0, 1);
    const cx = ax + t*abx, cy = ay + t*aby;
    return dist2(px,py,cx,cy);
  }

  function isOnPath(wx, wy){
    // path corridor thickness
    const corridor = 42;
    const r2 = corridor * corridor;
    for (let i=0;i<path.length-1;i++){
      const a = path[i], b = path[i+1];
      if (pointToSegmentDist2(wx,wy,a.x,a.y,b.x,b.y) <= r2) return true;
    }
    return false;
  }

  // ---------- Game state ----------
  const state = {
    running: false,
    paused: false,
    timeScale: 1,
    wave: 1,
    lives: 20,
    money: 350,
    showRings: true,

    // camera
    camX: 300,
    camY: 240,
    zoom: 1.0,

    // interaction
    buildTurretId: null, // index 0..4
    hoverCell: null,
    selectedTurret: null,
    dragging: false,
    dragStart: null,

    // entities
    enemies: [],
    turrets: [],
    bullets: [],
    effects: [],

    // wave spawning
    spawnQueue: [], // {t, enemyType, count, spacing}
    waveInProgress: false,
    nextEnemyId: 1,
    nextTurretId: 1,
  };

  // turret occupancy by cell key
  const occ = new Map(); // "c,r" -> turretId

  // ---------- Definitions ----------
  const TurretDefs = [
    {
      id:'laser',
      name:'Laser Sentry',
      icon:0,
      baseCost: 90,
      baseDmg: 9,
      baseRof: 0.18, // sec per shot
      baseRange: 210,
      note:'Fast single-target beam shots. Great early DPS.',
      specLabel:'BEAM',
      // upgrades
      up: [
        {cost: 70, dmgMul:1.45, rofMul:0.90, rngAdd:18, spec:'+Pierce chance (minor)'},
        {cost: 120,dmgMul:1.6,  rofMul:0.88, rngAdd:22, spec:'Pierce chance improved'},
        {cost: 210,dmgMul:1.8,  rofMul:0.86, rngAdd:26, spec:'Overcharge bursts'},
      ],
      shootSfx(){beep({freq:720, type:'triangle', vol:0.10, dur:0.04});}
    },
    {
      id:'cannon',
      name:'Rail Cannon',
      icon:1,
      baseCost: 115,
      baseDmg: 26,
      baseRof: 0.55,
      baseRange: 240,
      note:'High damage single shots. Good vs tanks.',
      specLabel:'PUNCH',
      up: [
        {cost: 95, dmgMul:1.55, rofMul:0.93, rngAdd:14, spec:'+Armor shred'},
        {cost: 165,dmgMul:1.65, rofMul:0.91, rngAdd:18, spec:'More shred'},
        {cost: 260,dmgMul:1.85, rofMul:0.90, rngAdd:22, spec:'Explosive impact'},
      ],
      shootSfx(){beep({freq:220, type:'square', vol:0.09, dur:0.05}); noiseBurst({dur:0.04, vol:0.06});}
    },
    {
      id:'missile',
      name:'Missile Pod',
      icon:2,
      baseCost: 140,
      baseDmg: 18,
      baseRof: 0.70,
      baseRange: 260,
      note:'Splash damage. Clears clustered waves.',
      specLabel:'SPLASH',
      up: [
        {cost: 120,dmgMul:1.40, rofMul:0.93, rngAdd:10, spec:'+Bigger blast'},
        {cost: 200,dmgMul:1.55, rofMul:0.92, rngAdd:14, spec:'Bigger blast'},
        {cost: 310,dmgMul:1.75, rofMul:0.90, rngAdd:18, spec:'Micro-missiles'},
      ],
      shootSfx(){beep({freq:380, type:'sawtooth', vol:0.08, dur:0.06});}
    },
    {
      id:'slow',
      name:'Cryo Emitter',
      icon:3,
      baseCost: 105,
      baseDmg: 4,
      baseRof: 0.25,
      baseRange: 210,
      note:'Applies slow on hit. Enables kill zones.',
      specLabel:'SLOW',
      up: [
        {cost: 85, dmgMul:1.35, rofMul:0.92, rngAdd:12, spec:'Slow 22% → 30%'},
        {cost: 150,dmgMul:1.55, rofMul:0.90, rngAdd:16, spec:'Slow 30% → 38%'},
        {cost: 240,dmgMul:1.70, rofMul:0.88, rngAdd:18, spec:'Slow 38% → 46%'},
      ],
      shootSfx(){beep({freq:510, type:'sine', vol:0.08, dur:0.05, detune:-40});}
    },
    {
      id:'tesla',
      name:'Tesla Coil',
      icon:4,
      baseCost: 165,
      baseDmg: 16,
      baseRof: 0.62,
      baseRange: 230,
      note:'Chains lightning to nearby targets.',
      specLabel:'CHAIN',
      up: [
        {cost: 140,dmgMul:1.40, rofMul:0.94, rngAdd:10, spec:'Chain 2 → 3'},
        {cost: 230,dmgMul:1.55, rofMul:0.92, rngAdd:14, spec:'Chain 3 → 4'},
        {cost: 360,dmgMul:1.75, rofMul:0.90, rngAdd:18, spec:'Chain 4 → 5'},
      ],
      shootSfx(){beep({freq:880, type:'sine', vol:0.08, dur:0.05}); beep({freq:1320, type:'sine', vol:0.05, dur:0.03});}
    }
  ];

  const EnemyDefs = {
    drone: {name:'Drone', sprite:'drone', baseHp: 45, speed: 95, bounty: 10, size: 22},
    walker:{name:'Walker',sprite:'walker',baseHp: 90, speed: 72, bounty: 14, size: 26},
    tank:  {name:'Tank',  sprite:'tank',  baseHp: 185,speed: 50, bounty: 22, size: 30},
  };

  function wavePlan(wave){
    // Waves ramp quickly to avoid being too easy.
    // Each wave returns a list of spawn groups.
    // count grows and composition shifts to tougher enemies.
    const w = wave;
    const base = 10 + Math.floor(w*1.5);
    const drone = Math.max(0, base + Math.floor(w*2));
    const walker = Math.max(0, Math.floor(w*1.5) - 1) + (w>=3 ? 4 : 0);
    const tank = w>=4 ? Math.floor((w-3)*1.2) : 0;

    const groups = [];
    groups.push({type:'drone', count: drone, spacing: 0.55});
    if (w>=2) groups.push({type:'walker', count: walker, spacing: 0.80});
    if (w>=4) groups.push({type:'tank', count: tank, spacing: 1.10});

    // "surge" spikes every 5th wave
    if (w % 5 === 0){
      groups.push({type:'drone', count: Math.floor(drone*0.6), spacing: 0.35});
      groups.push({type:'walker',count: Math.floor(walker*0.5)+2, spacing: 0.65});
    }
    return groups;
  }

  // ---------- UI ----------
  function log(msg, important=false){
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = important ? `<b>${msg}</b>` : msg;
    logEl.prepend(div);
    // trim
    while (logEl.children.length > 18) logEl.removeChild(logEl.lastChild);
  }

  let toastTimer = 0;
  function toast(msg){
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    toastTimer = 2.2;
  }

  function updateTopUI(){
    uiWave.textContent = String(state.wave);
    uiLives.textContent = String(state.lives);
    uiMoney.textContent = String(Math.floor(state.money));
  }

  function setSelectedTurret(t){
    state.selectedTurret = t;
    if (!t){
      selectedNone.classList.remove('hidden');
      selectedCard.classList.add('hidden');
      return;
    }
    selectedNone.classList.add('hidden');
    selectedCard.classList.remove('hidden');

    const def = TurretDefs[t.defIdx];
    selIcon.src = `assets/images/turret_${def.icon+1}.png`;
    selName.textContent = def.name;
    selType.textContent = def.specLabel;
    selLvl.textContent = String(t.level+1);

    const stats = computeTurretStats(t);
    selDmg.textContent = stats.dmg.toFixed(0);
    selRof.textContent = (1/stats.rof).toFixed(1) + "/s";
    selRng.textContent = stats.range.toFixed(0);
    selSpec.textContent = stats.spec;
    selNote.textContent = def.note + ` Upgrade cost: ${upgradeCost(t)}c`;
    btnUpgrade.disabled = !canUpgrade(t);
    btnSell.disabled = false;
  }

  function buildTurretButtons(){
    turretGrid.innerHTML = '';
    TurretDefs.forEach((def, idx) => {
      const card = document.createElement('div');
      card.className = 'turret-card';
      card.dataset.idx = String(idx);
      card.innerHTML = `
        <img src="assets/images/turret_${def.icon+1}.png" alt="${def.name}">
        <div>
          <div class="tname">${def.name}</div>
          <div class="tmeta">${def.baseCost}c • ${def.specLabel}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        ensureAudio();
        beep({freq:520, type:'triangle', vol:0.08, dur:0.05});
        state.buildTurretId = idx;
        [...turretGrid.children].forEach(el => el.classList.remove('active'));
        card.classList.add('active');
        toast(`Build: ${def.name} (${def.baseCost}c)`);
      });
      turretGrid.appendChild(card);
    });
  }

  // ---------- Turrets / Enemies ----------
  function computeTurretStats(t){
    const def = TurretDefs[t.defIdx];
    let dmg = def.baseDmg;
    let rof = def.baseRof;
    let range = def.baseRange;
    let spec = def.specLabel;

    for (let i=0;i<t.level;i++){
      const u = def.up[i];
      dmg *= u.dmgMul;
      rof *= u.rofMul;
      range += u.rngAdd;
      spec = u.spec;
    }

    // special behaviors
    if (def.id === 'slow'){
      const slowPct = [0.22, 0.30, 0.38, 0.46][t.level] ?? 0.22;
      t.slowPct = slowPct;
      spec = `Slow ${(slowPct*100)|0}%`;
    }
    if (def.id === 'tesla'){
      const chain = [2,3,4,5][t.level] ?? 2;
      t.chain = chain;
      spec = `Chain ${chain}`;
    }
    if (def.id === 'cannon'){
      const shred = [0.10,0.14,0.18,0.20][t.level] ?? 0.10;
      t.shred = shred;
      spec = `Shred ${(shred*100)|0}%`;
    }
    if (def.id === 'laser'){
      const pierce = [0.10,0.16,0.22,0.30][t.level] ?? 0.10;
      t.pierce = pierce;
      spec = `Pierce ${(pierce*100)|0}%`;
    }
    if (def.id === 'missile'){
      const blast = [58,70,82,95][t.level] ?? 58;
      t.blast = blast;
      spec = `Blast ${blast}`;
    }

    return {dmg, rof, range, spec};
  }

  function upgradeCost(t){
    const def = TurretDefs[t.defIdx];
    if (t.level >= def.up.length) return Infinity;
    return def.up[t.level].cost;
  }
  function canUpgrade(t){
    const cost = upgradeCost(t);
    return Number.isFinite(cost) && state.money >= cost;
  }

  function tryUpgradeSelected(){
    const t = state.selectedTurret;
    if (!t) return;
    const def = TurretDefs[t.defIdx];
    if (t.level >= def.up.length){ toast('Max level reached'); return; }
    const cost = def.up[t.level].cost;
    if (state.money < cost){ toast('Not enough credits'); return; }
    state.money -= cost;
    t.level += 1;
    ensureAudio(); beep({freq:920, type:'triangle', vol:0.10, dur:0.06});
    log(`Upgraded ${def.name} to Lvl ${t.level+1}`, true);
    setSelectedTurret(t);
    updateTopUI();
  }

  function sellSelected(){
    const t = state.selectedTurret;
    if (!t) return;
    const def = TurretDefs[t.defIdx];
    const refund = Math.floor((def.baseCost + t.spent) * 0.60);
    state.money += refund;
    // free occupancy
    occ.delete(`${t.cell.c},${t.cell.r}`);
    state.turrets = state.turrets.filter(x => x.id !== t.id);
    ensureAudio(); beep({freq:300, type:'square', vol:0.08, dur:0.05});
    log(`Sold ${def.name} for ${refund}c`);
    setSelectedTurret(null);
    updateTopUI();
  }

  function spawnEnemy(type, hpMul=1){
    const def = EnemyDefs[type];
    const e = {
      id: state.nextEnemyId++,
      type,
      name: def.name,
      sprite: def.sprite,
      maxHp: def.baseHp * hpMul,
      hp: def.baseHp * hpMul,
      speed: def.speed,
      baseSpeed: def.speed,
      bounty: def.bounty,
      size: def.size,
      // path progress
      seg: 0,
      t: 0, // 0..1 on segment
      x: path[0].x,
      y: path[0].y,
      slowTimer: 0,
      slowFactor: 1,
      armorShred: 0,
    };
    state.enemies.push(e);
  }

  function queueWave(wave){
    const hpMul = 1 + (wave-1)*0.18; // ramp
    const plan = wavePlan(wave);

    let t = 0;
    for (const g of plan){
      state.spawnQueue.push({t, type: g.type, remaining: g.count, spacing: g.spacing, hpMul});
      // slight overlap between groups
      t += Math.max(0.5, g.count * g.spacing * 0.25);
    }

    state.waveInProgress = true;
    log(`Wave ${wave} queued: ${plan.map(p=>`${p.count} ${p.type}`).join(', ')}`, true);
  }

  function startGame(){
    state.running = true;
    state.paused = false;
    state.wave = 1;
    state.lives = 20;
    state.money = 350;
    state.enemies = [];
    state.turrets = [];
    state.bullets = [];
    state.effects = [];
    state.spawnQueue = [];
    state.waveInProgress = false;
    occ.clear();
    state.buildTurretId = null;
    [...turretGrid.children].forEach(el => el.classList.remove('active'));
    setSelectedTurret(null);
    updateTopUI();
    logEl.innerHTML = '';
    log('Systems online. Place turrets, then start waves.', true);
    queueWave(state.wave);
    toast('Wave 1 online. Good luck.');
    ensureAudio(); beep({freq:660, type:'triangle', vol:0.10, dur:0.06});
  }

  function togglePause(){
    if (!state.running) return;
    state.paused = !state.paused;
    toast(state.paused ? 'Paused' : 'Resumed');
    ensureAudio();
    beep({freq: state.paused ? 260 : 520, type:'sine', vol:0.08, dur:0.06});
  }

  function skipNextWave(){
    if (!state.running) return;
    // Immediately queue and start next wave, stacking enemies.
    state.wave += 1;
    queueWave(state.wave);
    updateTopUI();
    toast(`Wave ${state.wave} injected (stacking)`);
    ensureAudio();
    beep({freq:980, type:'sawtooth', vol:0.10, dur:0.07});
    noiseBurst({dur:0.06, vol:0.07});
  }

  // ---------- Placement / selection ----------
  function worldFromScreen(sx, sy){
    const rect = canvas.getBoundingClientRect();
    const x = (sx - rect.left);
    const y = (sy - rect.top);
    // map to canvas pixels
    const px = x * (canvas.width / rect.width);
    const py = y * (canvas.height / rect.height);
    const wx = state.camX + (px - canvas.width/2) / state.zoom;
    const wy = state.camY + (py - canvas.height/2) / state.zoom;
    return {wx, wy, px, py};
  }

  function screenFromWorld(wx, wy){
    const px = (wx - state.camX) * state.zoom + canvas.width/2;
    const py = (wy - state.camY) * state.zoom + canvas.height/2;
    return {px, py};
  }

  function cellFromWorld(wx, wy){
    const c = clamp(Math.floor(wx / GRID), 0, gridCols-1);
    const r = clamp(Math.floor(wy / GRID), 0, gridRows-1);
    return {c, r, x: c*GRID + GRID/2, y: r*GRID + GRID/2};
  }

  function turretAtWorld(wx, wy){
    for (const t of state.turrets){
      if (dist2(wx,wy,t.x,t.y) <= (24*24)) return t;
    }
    return null;
  }

  function canPlaceAt(cell){
    if (isOnPath(cell.x, cell.y)) return {ok:false, reason:'On path'};
    if (occ.has(`${cell.c},${cell.r}`)) return {ok:false, reason:'Occupied'};
    return {ok:true};
  }

  function placeTurret(cell, defIdx){
    const def = TurretDefs[defIdx];
    if (state.money < def.baseCost){ toast('Not enough credits'); return false; }
    const ck = canPlaceAt(cell);
    if (!ck.ok){ toast(`Can't place: ${ck.reason}`); return false; }

    const t = {
      id: state.nextTurretId++,
      defIdx,
      level: 0,
      spent: 0,
      x: cell.x,
      y: cell.y,
      cell: {c: cell.c, r: cell.r},
      cd: 0,
      targetId: null,
    };
    state.money -= def.baseCost;
    occ.set(`${cell.c},${cell.r}`, t.id);
    state.turrets.push(t);
    ensureAudio(); beep({freq:620, type:'triangle', vol:0.10, dur:0.05});
    log(`Built ${def.name} (${def.baseCost}c)`);
    updateTopUI();
    setSelectedTurret(t);
    return true;
  }

  // ---------- Combat ----------
  function getEnemyById(id){
    return state.enemies.find(e => e.id === id) || null;
  }

  function findTarget(t, range){
    let best = null;
    let bestProg = -1; // prioritize closest to exit (highest progress)
    const r2 = range*range;
    for (const e of state.enemies){
      if (dist2(t.x,t.y,e.x,e.y) <= r2){
        const prog = e.seg + e.t;
        if (prog > bestProg){
          bestProg = prog;
          best = e;
        }
      }
    }
    return best;
  }

  function shoot(t, e, stats){
    const def = TurretDefs[t.defIdx];

    // projectile types
    if (def.id === 'laser' || def.id === 'slow'){
      // hitscan beam
      applyDamage(e, stats.dmg, t);
      if (def.id === 'slow'){
        e.slowTimer = Math.max(e.slowTimer, 1.2);
        e.slowFactor = 1 - (t.slowPct || 0.22);
      }
      // pierce chance
      if (def.id === 'laser'){
        if (Math.random() < (t.pierce || 0.10)){
          // find another enemy along line
          const dx = e.x - t.x, dy = e.y - t.y;
          const len = Math.hypot(dx,dy) || 1;
          const ux = dx/len, uy = dy/len;
          let p2 = null, bestD = 1e9;
          for (const o of state.enemies){
            if (o.id === e.id) continue;
            // distance to ray
            const vx = o.x - t.x, vy = o.y - t.y;
            const proj = vx*ux + vy*uy;
            if (proj < 0 || proj > stats.range) continue;
            const px = t.x + ux*proj, py = t.y + uy*proj;
            const d = dist2(o.x,o.y,px,py);
            if (d < 26*26 && d < bestD){
              bestD = d; p2 = o;
            }
          }
          if (p2) applyDamage(p2, stats.dmg*0.65, t);
        }
      }
      addBeamFx(t.x,t.y,e.x,e.y, def.id === 'slow' ? 'cryo' : 'laser');
      def.shootSfx();
      return;
    }

    if (def.id === 'cannon'){
      // fast bullet
      state.bullets.push({
        kind:'slug',
        x:t.x, y:t.y,
        vx:(e.x-t.x), vy:(e.y-t.y),
        spd: 820,
        dmg: stats.dmg,
        src: t,
        life: 1.2
      });
      def.shootSfx();
      return;
    }

    if (def.id === 'missile'){
      state.bullets.push({
        kind:'missile',
        x:t.x, y:t.y,
        tx:e.x, ty:e.y,
        spd: 520,
        dmg: stats.dmg,
        blast: t.blast || 58,
        src: t,
        life: 1.7
      });
      def.shootSfx();
      return;
    }

    if (def.id === 'tesla'){
      // immediate chain
      const chainMax = t.chain || 2;
      const hit = [];
      hit.push(e);
      applyDamage(e, stats.dmg, t);

      for (let i=1;i<chainMax;i++){
        const prev = hit[hit.length-1];
        let next = null;
        let best = 1e9;
        for (const o of state.enemies){
          if (hit.includes(o)) continue;
          const d = dist2(prev.x,prev.y,o.x,o.y);
          if (d < best && d <= (120*120)){
            best = d;
            next = o;
          }
        }
        if (!next) break;
        hit.push(next);
        applyDamage(next, stats.dmg * Math.pow(0.72, i), t);
      }

      for (let i=0;i<hit.length-1;i++){
        addBeamFx(hit[i].x,hit[i].y,hit[i+1].x,hit[i+1].y,'tesla');
      }
      addBeamFx(t.x,t.y,e.x,e.y,'tesla');
      def.shootSfx();
      return;
    }
  }

  function applyDamage(e, amount, tSrc){
    // armor shred reduces maxHp a bit over time by reducing effective hp via multiplier
    const shred = (tSrc && TurretDefs[tSrc.defIdx].id === 'cannon') ? (tSrc.shred || 0.10) : 0;
    if (shred > 0){
      e.armorShred = clamp(e.armorShred + shred*0.35, 0, 0.35);
    }
    const dmg = amount * (1 + e.armorShred);
    e.hp -= dmg;
    state.effects.push({kind:'hit', x:e.x, y:e.y, t:0.18});
    if (e.hp <= 0){
      e.hp = 0;
      killEnemy(e);
    }
  }

  function killEnemy(e){
    state.money += e.bounty;
    state.effects.push({kind:'boom', x:e.x, y:e.y, t:0.35});
    ensureAudio();
    beep({freq: 160 + Math.random()*80, type:'square', vol:0.07, dur:0.05});
    state.enemies = state.enemies.filter(x => x.id !== e.id);
    updateTopUI();
  }

  function addBeamFx(x1,y1,x2,y2,kind){
    state.effects.push({kind:'beam', x1,y1,x2,y2, t:0.08, beamKind: kind});
  }

  // ---------- Update ----------
  let last = performance.now();
  function tick(now){
    requestAnimationFrame(tick);
    const dtReal = (now - last) / 1000;
    last = now;

    const dt = state.paused ? 0 : dtReal * state.timeScale;
    if (!state.running){
      render(0);
      return;
    }

    // toast lifetime
    if (toastTimer > 0){
      toastTimer -= dtReal;
      if (toastTimer <= 0) toastEl.classList.add('hidden');
    }

    updateSpawner(dt);
    updateEnemies(dt);
    updateTurrets(dt);
    updateBullets(dt);
    updateEffects(dt);

    // auto-advance wave when cleared and no spawns remain
    if (state.waveInProgress){
      if (state.spawnQueue.length === 0 && state.enemies.length === 0){
        state.waveInProgress = false;
        state.wave += 1;
        queueWave(state.wave);
        updateTopUI();
        toast(`Wave ${state.wave} online`);
        ensureAudio();
        beep({freq:740, type:'triangle', vol:0.10, dur:0.06});
      }
    }

    render(dtReal);
  }

  function updateSpawner(dt){
    if (dt <= 0) return;
    if (state.spawnQueue.length === 0) return;

    // Each queue item spawns `remaining` enemies at `spacing` seconds
    for (let i=0; i<state.spawnQueue.length; i++){
      state.spawnQueue[i].t -= dt;
    }

    // spawn in order
    while (state.spawnQueue.length && state.spawnQueue[0].t <= 0){
      const q = state.spawnQueue[0];
      spawnEnemy(q.type, q.hpMul);
      q.remaining -= 1;
      q.t += q.spacing;
      if (q.remaining <= 0){
        state.spawnQueue.shift();
      } else {
        // keep at front
        break;
      }
    }
  }

  function updateEnemies(dt){
    if (dt <= 0) return;
    for (const e of state.enemies){
      // slow logic
      if (e.slowTimer > 0){
        e.slowTimer -= dt;
        if (e.slowTimer <= 0){
          e.slowFactor = 1;
        }
      }
      const spd = e.baseSpeed * (e.slowFactor || 1);

      let remaining = spd * dt;
      while (remaining > 0 && e.seg < path.length-1){
        const a = path[e.seg];
        const b = path[e.seg+1];
        const segLen = Math.hypot(b.x-a.x, b.y-a.y) || 1;
        const curDist = e.t * segLen;
        const left = segLen - curDist;
        const step = Math.min(left, remaining);
        const nt = (curDist + step) / segLen;
        e.t = nt;
        e.x = a.x + (b.x-a.x) * e.t;
        e.y = a.y + (b.y-a.y) * e.t;
        remaining -= step;
        if (Math.abs(1 - e.t) < 1e-6){
          e.seg += 1;
          e.t = 0;
        }
      }

      // reached end
      if (e.seg >= path.length-1){
        state.lives -= 1;
        ensureAudio();
        beep({freq:120, type:'sawtooth', vol:0.10, dur:0.08});
        noiseBurst({dur:0.10, vol:0.07});
        state.enemies = state.enemies.filter(x => x.id !== e.id);
        updateTopUI();
        toast('Breach!');
        log(`Enemy breached defenses. Lives -1`, true);
        if (state.lives <= 0){
          gameOver();
          return;
        }
      }
    }
  }

  function gameOver(){
    state.paused = true;
    state.running = false;
    toast('MISSION FAILED — Press Start to retry');
    log(`Mission failed at wave ${state.wave}.`, true);
  }

  function updateTurrets(dt){
    if (dt <= 0) return;
    for (const t of state.turrets){
      t.cd -= dt;
      const stats = computeTurretStats(t);
      if (t.cd > 0) continue;

      const target = findTarget(t, stats.range);
      if (target){
        shoot(t, target, stats);
        t.cd = stats.rof;
      } else {
        t.cd = Math.min(stats.rof, 0.08);
      }
    }
  }

  function updateBullets(dt){
    if (dt <= 0) return;
    for (const b of state.bullets){
      b.life -= dt;
      if (b.life <= 0) b.dead = true;

      if (b.kind === 'slug'){
        // aim at current position of nearest target along path using stored direction
        const len = Math.hypot(b.vx,b.vy) || 1;
        const ux = b.vx/len, uy = b.vy/len;
        b.x += ux * b.spd * dt;
        b.y += uy * b.spd * dt;

        // collision
        for (const e of state.enemies){
          if (dist2(b.x,b.y,e.x,e.y) <= (e.size*e.size)){
            applyDamage(e, b.dmg, b.src);
            // cannon impact adds a small stun-like slow
            e.slowTimer = Math.max(e.slowTimer, 0.35);
            e.slowFactor = Math.min(e.slowFactor, 0.82);
            b.dead = true;
            break;
          }
        }
      }

      if (b.kind === 'missile'){
        // steer to nearest enemy at target location
        // find closest enemy to (tx,ty)
        let target = null, best = 1e9;
        for (const e of state.enemies){
          const d = dist2(e.x,e.y,b.tx,b.ty);
          if (d < best){
            best = d; target = e;
          }
        }
        if (target){
          b.tx = target.x; b.ty = target.y;
        }
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const len = Math.hypot(dx,dy) || 1;
        const ux = dx/len, uy = dy/len;
        b.x += ux * b.spd * dt;
        b.y += uy * b.spd * dt;

        if (len < 18){
          // explode
          const blast2 = (b.blast*b.blast);
          for (const e of [...state.enemies]){
            if (dist2(b.x,b.y,e.x,e.y) <= blast2){
              applyDamage(e, b.dmg, b.src);
            }
          }
          state.effects.push({kind:'boom', x:b.x, y:b.y, t:0.42});
          ensureAudio();
          noiseBurst({dur:0.08, vol:0.10});
          beep({freq:200, type:'square', vol:0.06, dur:0.06});
          b.dead = true;
        }
      }
    }

    state.bullets = state.bullets.filter(b => !b.dead);
  }

  function updateEffects(dt){
    if (dt <= 0) return;
    for (const fx of state.effects){
      fx.t -= dt;
      if (fx.t <= 0) fx.dead = true;
    }
    state.effects = state.effects.filter(f => !f.dead);
  }

  // ---------- Render ----------
  function render(/*dtReal*/){
    // clear
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // camera clamp
    const viewW = canvas.width / state.zoom;
    const viewH = canvas.height / state.zoom;
    state.camX = clamp(state.camX, viewW/2, WORLD_W - viewW/2);
    state.camY = clamp(state.camY, viewH/2, WORLD_H - viewH/2);

    // background
    drawBackground();

    // world transform
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.camX, -state.camY);

    drawGrid();
    drawPath();
    drawTurrets();
    drawEnemies();
    drawBullets();
    drawEffects();
    drawPlacementGhost();

    ctx.restore();

    // overlays
    drawMiniHelp();
  }

  function drawBackground(){
    if (ASSET.bg.complete && ASSET.bg.naturalWidth){
      // parallax background: map world center to bg coords
      const sx = (state.camX / WORLD_W) * (ASSET.bg.naturalWidth - canvas.width);
      const sy = (state.camY / WORLD_H) * (ASSET.bg.naturalHeight - canvas.height);
      ctx.drawImage(ASSET.bg, -sx*0.15, -sy*0.15, ASSET.bg.naturalWidth*1.08, ASSET.bg.naturalHeight*1.08);
    } else {
      ctx.fillStyle = '#050915';
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    // vignette
    const g = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 60, canvas.width/2, canvas.height/2, canvas.width*0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function drawGrid(){
    const step = GRID;
    const left = 0, top = 0;
    const right = WORLD_W, bottom = WORLD_H;
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#6ad9ff';
    ctx.lineWidth = 1;

    for (let x=left; x<=right; x+=step){
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    for (let y=top; y<=bottom; y+=step){
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPath(){
    ctx.save();
    // path corridor
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,200,255,0.14)';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    // neon core
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,200,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.stroke();

    // gate
    const end = path[path.length-1];
    ctx.fillStyle = 'rgba(255,77,109,0.30)';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 34, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawTurrets(){
    for (const t of state.turrets){
      const def = TurretDefs[t.defIdx];
      const img = ASSET.turret[def.icon];

      // base plate
      ctx.save();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = 'rgba(0,200,255,0.25)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 26, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();

      // turret sprite
      const s = 54;
      if (img.complete && img.naturalWidth){
        ctx.drawImage(img, t.x - s/2, t.y - s/2, s, s);
      } else {
        ctx.fillStyle = 'rgba(0,200,255,.35)';
        ctx.beginPath(); ctx.arc(t.x,t.y,20,0,Math.PI*2); ctx.fill();
      }

      // selection ring
      if (state.selectedTurret && state.selectedTurret.id === t.id){
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,200,255,0.9)';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 30, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      if (state.showRings){
        const stats = computeTurretStats(t);
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.strokeStyle = 'rgba(0,200,255,0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10,10]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, stats.range, 0, Math.PI*2);
        ctx.stroke();
        ctx.restore();
      }

      // level pip
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 14px system-ui';
      ctx.fillText(`L${t.level+1}`, t.x - 16, t.y - 30);
      ctx.restore();
    }
  }

  function drawEnemies(){
    for (const e of state.enemies){
      const img = ASSET.enemy[e.sprite];
      const s = e.size*2.2;
      if (img.complete && img.naturalWidth){
        ctx.drawImage(img, e.x - s/2, e.y - s/2, s, s);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.arc(e.x,e.y,e.size,0,Math.PI*2); ctx.fill();
      }

      // hp bar
      const w = 44, h = 6;
      const pct = clamp(e.hp / e.maxHp, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(e.x - w/2, e.y - e.size - 18, w, h);
      ctx.fillStyle = e.slowTimer>0 ? 'rgba(81,255,179,0.9)' : 'rgba(255,77,109,0.9)';
      ctx.fillRect(e.x - w/2, e.y - e.size - 18, w*pct, h);
      ctx.restore();
    }
  }

  function drawBullets(){
    ctx.save();
    for (const b of state.bullets){
      if (b.kind === 'slug'){
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3.2, 0, Math.PI*2);
        ctx.fill();
      }
      if (b.kind === 'missile'){
        ctx.fillStyle = 'rgba(200,120,255,0.75)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5.2, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,120,255,0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - 18, b.y - 10);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawEffects(){
    for (const fx of state.effects){
      if (fx.kind === 'beam'){
        const k = fx.beamKind;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = (k === 'tesla') ? 4 : 3;
        ctx.strokeStyle = (k === 'cryo') ? 'rgba(81,255,179,0.75)'
                        : (k === 'tesla') ? 'rgba(255,255,120,0.8)'
                        : 'rgba(0,200,255,0.75)';
        ctx.beginPath();
        ctx.moveTo(fx.x1, fx.y1);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();

        // glow
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = (k === 'tesla') ? 10 : 8;
        ctx.beginPath();
        ctx.moveTo(fx.x1, fx.y1);
        ctx.lineTo(fx.x2, fx.y2);
        ctx.stroke();
        ctx.restore();
      }
      if (fx.kind === 'hit'){
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 10*(fx.t/0.18), 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
      if (fx.kind === 'boom'){
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = 'rgba(255,77,109,0.55)';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 70*(1-fx.t/0.35), 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = 'rgba(0,200,255,0.35)';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, 92*(1-fx.t/0.35), 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawPlacementGhost(){
    if (state.buildTurretId == null || !state.hoverCell) return;
    const cell = state.hoverCell;
    const def = TurretDefs[state.buildTurretId];
    const img = ASSET.turret[def.icon];
    const ck = canPlaceAt(cell);

    ctx.save();
    ctx.globalAlpha = ck.ok ? 0.85 : 0.35;
    const s = 54;
    if (img.complete && img.naturalWidth){
      ctx.drawImage(img, cell.x - s/2, cell.y - s/2, s, s);
    } else {
      ctx.fillStyle = 'rgba(0,200,255,0.4)';
      ctx.beginPath(); ctx.arc(cell.x,cell.y,20,0,Math.PI*2); ctx.fill();
    }

    // ring
    const range = def.baseRange;
    ctx.globalAlpha = ck.ok ? 0.14 : 0.10;
    ctx.strokeStyle = ck.ok ? 'rgba(0,200,255,0.9)' : 'rgba(255,77,109,0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10,10]);
    ctx.beginPath();
    ctx.arc(cell.x, cell.y, range, 0, Math.PI*2);
    ctx.stroke();

    // cell outline
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = ck.ok ? 'rgba(0,200,255,0.65)' : 'rgba(255,77,109,0.65)';
    ctx.strokeRect(cell.c*GRID+2, cell.r*GRID+2, GRID-4, GRID-4);
    ctx.restore();
  }

  function drawMiniHelp(){
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(14, canvas.height-44, 460, 30);
    ctx.fillStyle = 'rgba(233,244,255,0.90)';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`Zoom: ${state.zoom.toFixed(2)}x • Speed: ${state.timeScale.toFixed(0)}x • Enemies: ${state.enemies.length} • Turrets: ${state.turrets.length}`, 24, canvas.height-23);
    ctx.restore();
  }

  // ---------- Input ----------
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousemove', (e) => {
    const {wx, wy, px, py} = worldFromScreen(e.clientX, e.clientY);
    state.hoverCell = cellFromWorld(wx, wy);

    if (state.dragging && state.dragStart){
      const dx = px - state.dragStart.px;
      const dy = py - state.dragStart.py;
      state.camX = state.dragStart.camX - dx / state.zoom;
      state.camY = state.dragStart.camY - dy / state.zoom;
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    ensureAudio();
    const {wx, wy, px, py} = worldFromScreen(e.clientX, e.clientY);

    if (e.button === 2){
      // right click cancels build
      state.buildTurretId = null;
      [...turretGrid.children].forEach(el => el.classList.remove('active'));
      toast('Build cancelled');
      beep({freq:240, type:'sine', vol:0.06, dur:0.05});
      return;
    }

    // left click
    const hitTurret = turretAtWorld(wx, wy);
    if (hitTurret){
      setSelectedTurret(hitTurret);
      beep({freq:540, type:'triangle', vol:0.07, dur:0.04});
      return;
    }

    // if building, attempt placement
    if (state.buildTurretId != null){
      const cell = cellFromWorld(wx, wy);
      const ok = placeTurret(cell, state.buildTurretId);
      if (ok){
        // stay in build mode for convenience
      } else {
        beep({freq:160, type:'square', vol:0.06, dur:0.05});
      }
      return;
    }

    // otherwise start drag pan
    state.dragging = true;
    state.dragStart = {px, py, camX: state.camX, camY: state.camY};
  });

  window.addEventListener('mouseup', () => {
    state.dragging = false;
    state.dragStart = null;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const old = state.zoom;
    const delta = -Math.sign(e.deltaY) * 0.10;
    const nz = clamp(old * (1 + delta), 0.65, 2.15);

    // zoom around cursor
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const wx = state.camX + (x - canvas.width/2) / old;
    const wy = state.camY + (y - canvas.height/2) / old;

    state.zoom = nz;
    state.camX = wx - (x - canvas.width/2) / nz;
    state.camY = wy - (y - canvas.height/2) / nz;
  }, {passive:false});

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R'){
      state.showRings = !state.showRings;
      toast(state.showRings ? 'Range rings ON' : 'Range rings OFF');
      ensureAudio(); beep({freq: state.showRings ? 620 : 280, type:'triangle', vol:0.08, dur:0.05});
    }
    if (e.key === '1'){ state.timeScale = 1; toast('Speed 1x'); }
    if (e.key === '2'){ state.timeScale = 1.6; toast('Speed 2x'); }
    if (e.key === '3'){ state.timeScale = 2.4; toast('Speed 3x'); }
  });

  // ---------- Buttons ----------
  btnStart.addEventListener('click', () => { ensureAudio(); startGame(); });
  btnPause.addEventListener('click', () => { ensureAudio(); togglePause(); });
  btnNextWave.addEventListener('click', () => { ensureAudio(); skipNextWave(); });

  btnUpgrade.addEventListener('click', () => { ensureAudio(); tryUpgradeSelected(); });
  btnSell.addEventListener('click', () => { ensureAudio(); sellSelected(); });

  // ---------- Init ----------
  buildTurretButtons();
  updateTopUI();
  log('Ready. Press Start to begin.', true);
  toast('Press Start');

  // Default camera
  state.camX = 900; state.camY = 700; state.zoom = 1.0;

  requestAnimationFrame(tick);
})();
