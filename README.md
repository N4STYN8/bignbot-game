# Nebula TD (Browser Tower Defense)

A sci-fi turret defense game built with vanilla HTML/CSS/JS and a single Canvas.

## Features
- 5 turret types, each upgradeable (up to level 4 total)
- Skip / Next Wave button that **spawns the next wave immediately** (stacks enemies)
- Zoom with mouse wheel, pan by dragging empty space
- Full HUD UI (build panel, selection panel, log, stats)
- WebAudio SFX (no external audio files)

## Run locally
Option 1: VS Code Live Server extension  
Option 2: any local server:
- Python: `python -m http.server 8080`

Then open:
- http://localhost:8080/nebula-td/

## Controls
- Mouse wheel: zoom
- Drag empty space: pan
- Left click: place/select turret
- Right click: cancel build
- R: toggle range rings
- 1/2/3: speed

## Project structure
- index.html
- css/style.css
- js/game.js
- assets/images/*.png

Enjoy!
