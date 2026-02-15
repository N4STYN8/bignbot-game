# System Map

Source baseline: `game.js` (6814 lines, snapshot before modular split).

## Core Loop / Time / Runtime
- Purpose: Owns frame timing, simulation scaling, global runtime state, and high-level orchestration of updates/draw across all gameplay systems.
- Where it lives: `Game` class (`game.js:4128`), frame loop boot block (`game.js:7193`), `resize`/canvas setup (`game.js:45`).
- Key state: `speed`, `paused`, `gameOver`, `gameWon`, `gameState`, `runtimeError`, `cam`, `zoom`, `damageFlash`, `texts`, `arcs`, `beams`, `explosions`, `_saveT`.
- Depends on: Map, Enemy, Turret, Projectile, Particles, Audio, wave builder, UI/HUD, input, save/load.
- Safe edit zones: `Game._reportRuntimeError`, `Game._updateVisualEffects`, `Game.onResize`, `Game._showLevelOverlay`, `Game._hideLevelOverlay`.
- High risk zones: `Game.update`, `Game.draw`, boot loop (`requestAnimationFrame`), speed scaling (`dtScaled = dt * speed`).

## Input (Mouse / Keyboard / UI Events)
- Purpose: Binds DOM and canvas events to in-game actions (build/select/place, pause, speed, abilities, settings/modals, camera control).
- Where it lives: `Game._bindUI` (`game.js:4510`), click/select helpers (`onClick`, `selectTurret`, `selectEnemy`, `sellSelected`, `confirmSellSelected`, `game.js:6289-6572`).
- Key state: `buildKey`, `hoverCell`, `dragging`, `dragStart`, `statsOpen`, `panelPinned`, `panelHold`, selected entities.
- Depends on: UI/HUD rendering, turret/enemy selection data, abilities, pause/wave flow, save system.
- Safe edit zones: tooltip text templates inside hover handlers, panel pinning visual state sync, hotkey-to-action mapping.
- High risk zones: canvas click routing order (build vs turret select vs enemy select), modal escape handling, pause/stats interaction guards.

## Map / Pathing / Level Geometry
- Purpose: Generates and stores path polyline + grid occupancy/build tiles + power tiles, and provides world/cell/path lookup helpers.
- Where it lives: map generation helpers (`game.js:275-614`), `Map` class (`game.js:983-1406`), `Game.loadGeneratedMap` (`game.js:4244`).
- Key state: `path`, `pathLen`, `cells`, `cols`, `rows`, `buildables`, `powerTiles`, `spawn`, `goal`, `env`.
- Depends on: canvas dimensions (`W/H`), environment presets, tower placement logic, enemy movement.
- Safe edit zones: purely visual path/build tile drawing inside `Map.drawBase`, map generation style constants.
- High risk zones: `Map.posAt`, generated path normalization, cell indexing (`cellAt/worldFromCell`), spawn/goal assignment.

## Enemies / Damage Interaction
- Purpose: Defines enemy archetypes, scaling, status effects, movement, and damage resolution (armor/shield/resists/special tags).
- Where it lives: `ENEMY_TYPES` and helpers (`game.js:1408-1838`), `applyDamageToEnemy` (`game.js:1840`), `Enemy` class (`game.js:1904-2420`).
- Key state: per enemy `hp/maxHp`, `shield`, `armor`, `speed`, `pathD`, status timers (`dot`, `slow`, `reveal`), elite metadata.
- Depends on: map pathing (`Map.posAt`), turret/projectile hits, particles/text feedback, kill/leak callbacks in `Game`.
- Safe edit zones: display-only enemy tooltip text/labels, non-functional draw stylings in `Enemy.draw`.
- High risk zones: `applyDamageToEnemy`, `Enemy.update`, `Enemy.takeHit`, split-on-death mechanics and callback sequencing.

## Turrets / Build / Upgrades
- Purpose: Defines turret archetypes, targeting/attack behavior, per-tier upgrades/mods, and turret simulation updates.
- Where it lives: `TURRET_TYPES` (`game.js:2820+`), `Turret` class (`game.js:3185-4124`), build flow in `Game.onClick`.
- Key state: per turret `typeKey`, `level`, `fire`, `dmg`, `range`, `cool`, `mods`, `targetMode`, state buffers (drones/trap charges/beam target).
- Depends on: enemy list, projectiles, particles/arcs/beams, unlock waves, economy (gold), UI selection panel.
- Safe edit zones: option card copy and preview formatting (`Turret.previewAfterUpgrade` callers), non-functional turret draw cosmetics.
- High risk zones: `Turret.update`, targeting filters (`canTarget` / `acquireTarget`), upgrade apply math, special-case turret branches.

## Projectiles
- Purpose: Simulates travel, collision, pierce/ttl, AoE/explosive behavior, on-hit status application, and projectile rendering.
- Where it lives: `Projectile` class (`game.js:2502-2817`).
- Key state: `x/y`, `vx/vy`, `r`, `dmg`, `dmgType`, `pierce`, `ttl`, `style`, `hit` set.
- Depends on: enemy hitboxes/status APIs, particles/text feedback, arc/beam helper VFX lists.
- Safe edit zones: projectile draw-only styling in `Projectile.draw`.
- High risk zones: `Projectile.update` hit loop, `_explode`, pierce decrement rules.

## Waves / Progression
- Purpose: Creates spawn schedules by wave, manages intermission/skip behavior, scalar progression, wave lifecycle transitions.
- Where it lives: `Game._waveScalar`, `_sanitizeWaveScalar`, `_buildWave`, `startWave`, `spawnEnemy` (`game.js:5595-5775`) and spawn processing in `Game.update` (`game.js:6631+`).
- Key state: `wave`, `waveMax`, `waveScalar`, `spawnQueue`, `spawnIndex`, `spawnT`, `intermission`.
- Depends on: enemy factory, HUD timers, ability cooldown reductions, level progression/cinematic flow.
- Safe edit zones: wave toast text and non-functional string labels.
- High risk zones: schedule merge logic when starting mid-wave, intermission gating/skip rewards, boss wave branching.

## UI / HUD / Menus / Selection Panels
- Purpose: Renders and updates HUD values, build cards, selection details, wave stats modal, toast/tooltip overlays.
- Where it lives: UI refs/constants (`game.js:65+`), `Game.updateHUD`, `_buildList`, `_refreshBuildList`, `_openWaveStats`, `_closeWaveStats`, selection render methods (`game.js:5024-5350`, `6354-6511`).
- Key state: DOM refs, `selectedTurret`, `selectedEnemy`, cooldown displays, panel collapsed/pinned state, `statsOpen`.
- Depends on: core game state, turret/enemy model data, wave manager, audio toggles.
- Safe edit zones: HTML string templates in selection/build panel, tooltip copy, CSS-class toggles that do not alter simulation state.
- High risk zones: modal open/close state machine, pause synchronization with wave/game states, ability cooldown text derived from timers.

## Audio
- Purpose: Handles user-unlock/audio context, music/SFX channels, priority playback, and persisted audio preferences.
- Where it lives: `AudioSystem` class (`game.js:616-925`) and audio wiring in `Game.constructor` / `_bindUI`.
- Key state: `enabled`, `musicVolume`, `sfxVolume`, `currentTrack`, active SFX voice pool, cooldown map.
- Depends on: DOM controls, user gesture events, localStorage (`AUDIO_KEY`), gameplay triggers (`play`, `playLimited`).
- Safe edit zones: source ordering/fallback lists and button label formatting.
- High risk zones: autoplay unlock flow (`ensureActive`/`unlock`), voice reservation/eviction, persisted preference schema.

## Save / Load / Persistent State
- Purpose: Serializes full run state to localStorage and restores game/session state safely.
- Where it lives: `Game._save` (`game.js:5776`), `Game._load` (`game.js:5855`), reset paths (`_resetRun`, settings reset handlers).
- Key state: `SAVE_KEY`, level/map snapshot, turrets/enemies, wave queue, speed, currency, lives, stats, ability timers.
- Depends on: all major systems; constructors for Map/Turret/Enemy during restore.
- Safe edit zones: additive non-breaking fields with defaults on load.
- High risk zones: schema changes, wave queue restore (`spawnQueue/spawnIndex/spawnT`), restoring selected entities and modal state.

## VFX / Particles / Combat Text
- Purpose: Owns transient render effects (particles/beams/arcs/explosions/decals) and floating combat text lifecycle.
- Where it lives: `Particles` class (`game.js:2424-2501`), `Game.spawnText` (`game.js:5351`), `Game._spawnEnemyDeathFx` (`game.js:6050`), VFX passes in `Game.update/draw`.
- Key state: `particles.list`, `texts`, `beams`, `arcs`, `explosions`, `decals`, cinematic flash/fade buffers.
- Depends on: enemy/turret/projectile events, core render loop.
- Safe edit zones: particle color/style choices and draw-only alpha curves.
- High risk zones: effect arrays updated during simulation loops, long-lived VFX timers tied to `dtScaled`.
