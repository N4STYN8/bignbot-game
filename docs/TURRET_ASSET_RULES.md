<!-- CODEX CHANGE: Preserve the approved turret sprite art, integration, and verification workflow for future sessions. -->
# Orbit Echo Turret Asset Rules

## Purpose

This document is the source of truth for creating, processing, integrating, and testing turret sprites in Orbit Echo.

Use it whenever work resumes on the turret art overhaul. Every turret must belong to the same futuristic military faction while remaining instantly recognizable from a top-down view.

## Current Progress

Completed five-level sprite sets:

- Pulse Spindle: `assets/images/turrets/pulse_spindle/pulse_spindle_lv1.png` through `pulse_spindle_lv5.png`
- Arc Coil: `assets/images/turrets/arc_coil/arc_coil_lv1.png` through `arc_coil_lv5.png`
- Frost Vent: `assets/images/turrets/frost_vent/frost_vent_lv1.png` through `frost_vent_lv5.png`
- Sun Lens: `assets/images/turrets/sun_lens/sun_lens_lv1.png` through `sun_lens_lv5.png`

Remaining turret sets:

- Mortar Bloom
- Venom Spitter
- Rail Needle
- Aura Grove
- Drone Hive
- Gravity Trap

Arc Coil, Frost Vent, and Sun Lens may still be uncommitted when this document is first added. Always inspect `git status` before continuing.

## Required Camera

- Exact 90-degree orthographic top-down view
- Camera directly above the turret
- No perspective
- No isometric angle
- No side view
- No camera tilt
- Turret faces upward by default; the game rotates it toward enemies

The turret must appear flat and readable from above.

## Canvas and File Format

- Master output: 256 × 256 pixels
- Square canvas
- PNG only
- RGBA with a preserved alpha channel
- Transparent background
- Centered with equal visual padding
- Turret occupies approximately 70–80% of the canvas
- Nothing touches the border
- Do not crop weapons, vents, antennas, rings, drones, or floating components

Do not include:

- Background color
- Floor, terrain, or grid
- Frame
- Text, logo, or watermark
- Cast shadow or contact shadow outside the turret
- External glow that creates a large soft-edged footprint

## Faction Art Direction

Use:

- Hard-surface mechanical design
- Futuristic military technology
- Clean geometric forms
- Dark graphite armor
- Gunmetal and black titanium
- Hexagonal mechanical details
- Mechanical joints and vents
- One glowing energy core
- Small illuminated panels
- Restrained metallic reflections
- A polished AAA game-asset finish

Avoid:

- Fantasy or medieval elements
- Wood
- Cartoon styling
- Steampunk
- Human features
- Organic shapes unless required by the turret concept
- Decorative clutter that disappears at gameplay size

## Readability and Silhouette

Silhouette readability is the highest-priority rule.

Every turret must remain identifiable without relying on color. Review each level at 64×64, 48×48, and 32×32. If its identity becomes unclear, simplify the design.

Approved silhouette language:

- Pulse Spindle: compact body with twin upward-facing barrels
- Arc Coil: circular reactor with concentric segmented energy rings
- Frost Vent: directional fan or wedge with a broad upward-facing cryogenic nozzle
- Sun Lens: focused lens or beam-emitter silhouette
- Mortar Bloom: large round launcher
- Venom Spitter: directional chemical projector with a distinct reservoir
- Rail Needle: long, narrow cannon
- Aura Grove: support emitter with a calm radial silhouette
- Drone Hive: multiple readable drone docks
- Gravity Trap: central gravity knot with orbiting fragments

Do not allow two turret types to share the same dominant silhouette.

## Color and Lighting

- Body colors: dark graphite, gunmetal, black titanium
- Use exactly one primary energy color per turret
- Keep faction materials consistent across all turret types
- Use soft overhead lighting
- Use controlled emissive glow and small accent lights
- Avoid long shadows, lens flare, background lighting, rainbow colors, and heavy bloom

The sprite energy color should also drive its build-icon tint and selected-turret visualization color.

## Mounting Base

- Every turret includes a consistent circular or hexagonal military mounting base
- The base should feel related to the Pulse Spindle and Arc Coil bases
- The weapon or emitter silhouette must remain more visually dominant than the base

## Five-Level Upgrade Progression

Each level must preserve the turret's core identity. Do not redesign the turret into a different object between levels.

### Level 1

- Small and simple
- One primary weapon, emitter, nozzle, or coil
- One energy core
- Minimal armor
- No floating components

### Level 2

- Larger primary weapon or emitter
- Extra armor
- Slightly stronger energy channels
- Same basic silhouette as Level 1

### Level 3

- Additional emitters or secondary weapon elements
- Brighter or larger energy core
- Reinforced armor
- Still no floating components

### Level 4

- Clearly articulated or rotating mechanical parts
- A restrained number of floating components
- Components should look separable for future animation
- Maintain strong negative space between major pieces

### Level 5

- Large reactor or core
- Multiple weapons, emitters, rings, vents, or docks
- Advanced layered armor
- Strongest energy presentation
- Clearly more powerful than Level 1 at a glance
- Avoid filling the silhouette with micro-detail

## Animation-Friendly Design

Design major pieces so they could be separated later, including:

- Rotating barrels
- Rotating or counter-rotating rings
- Opening missile or vent doors
- Articulated shutters
- Moving drones
- Floating stabilizers
- Expanding energy coils

The current sprite may remain a single PNG, but the visual design should imply movable components.

## Image-Generation Workflow

Use the built-in image-generation workflow unless the user explicitly requests a different model or CLI path.

1. Inspect the turret's existing base artwork.
2. Inspect at least one approved completed turret set for faction consistency.
3. Generate one level at a time so each level can use the previous level as its main reference.
4. Treat the original turret art as an identity reference, not a camera or background reference.
5. Use a flat `#ff00ff` chroma-key background because the turret energy colors are commonly cyan or blue.
6. Explicitly forbid gradients, texture, floor, reflection, background lighting, and shadows in the chroma background.
7. Generate each level separately; do not request five distinct levels as variants of one prompt.
8. Preserve the exact chassis and silhouette language between levels.

Every generation prompt should specify:

- `Use case: stylized-concept`
- The exact turret type and level
- The role of every reference image
- Exact 90-degree orthographic top-down camera
- Upward default orientation
- Faction materials and the single energy color
- Target canvas occupancy
- The level-specific upgrade language
- Readability at 32×32
- Flat `#ff00ff` chroma background
- Full avoid list

## Transparency and Final PNG Processing

Use the installed chroma-removal helper:

```powershell
python "C:\Users\natha\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py" `
  --input <generated-source.png> `
  --out <temporary-alpha.png> `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill `
  --force
```

After chroma removal:

1. Crop to the visible alpha bounds.
2. Resize proportionally with high-quality Lanczos sampling.
3. Center on a transparent 256×256 RGBA canvas.
4. Use a gradual occupancy progression when appropriate, such as 184, 188, 192, 196, and 200 pixels across the longest dimension.
5. Optimize the final PNG.
6. Confirm transparent corners and no remaining magenta fringe.
7. Delete only the temporary alpha-processing files after verifying their resolved workspace path.

Do not overwrite legacy base art unless explicitly requested. Add the new level files alongside it.

## Naming Convention

Use lowercase filenames:

```text
<turret_name>_lv1.png
<turret_name>_lv2.png
<turret_name>_lv3.png
<turret_name>_lv4.png
<turret_name>_lv5.png
```

Examples:

```text
pulse_spindle_lv1.png
arc_coil_lv4.png
frost_vent_lv5.png
```

Store each set in:

```text
assets/images/turrets/<turret_name>/
```

## Game Integration

### Sprite Resolver

Update `src/sprites.js`:

1. Add the full turret filename prefix as the first alias in `TURRET_SPRITE_DEFS`.
2. Preserve legacy aliases and folders as fallbacks.
3. Add the turret type to the five-level base selection so Level 1 art is used before the first upgrade.
4. Update `TURRET_GLOW_TINTS` if the new primary energy color differs from the legacy art.
5. Add a `// CODEX CHANGE:` comment immediately above edited JavaScript blocks.

Example resolver shape:

```js
FROST: {
  key: "frost",
  aliases: ["frost_vent", "frost"],
  folders: ["frost", "frost_vent"],
}
```

### Build and Selection Icons

Update `styles.css`:

- Set the base `[data-icon="TYPE"]` image to Level 1
- Set `--turret-rgb` to the turret's primary energy color
- Add explicit `[data-level="2"]` through `[data-level="5"]` image rules
- Use a CSS `/* CODEX CHANGE: */` comment above edited blocks

The build icon, selected-turret portrait, and battlefield sprite must all use the same new art family.

### Cache Refresh

Refresh the module query versions through the dependency chain:

1. `src/turrets.js` import of `src/sprites.js`
2. `src/core.js` import of `src/turrets.js`
3. `index.html` script URL for `src/core.js`

Do not change gameplay stats, targeting, attack behavior, save data, or upgrade logic during a sprite-only task.

## Required Validation

### Asset Validation

For every level, confirm:

- Dimensions are exactly 256×256
- Mode is RGBA
- Corner alpha is zero
- Visible alpha bounds stay inside the canvas
- Occupancy is approximately 70–80%
- No chroma-key fringe remains
- Silhouette is readable at 64×64, 48×48, and 32×32

### Static Checks

Run:

```powershell
node --check src/core.js
node --check src/sprites.js
node --check src/turrets.js
npx --yes esbuild src/core.js --bundle --outfile=$env:TEMP\orbit-echo-sprite-check.js
git diff --check
```

Confirm all five PNG URLs return HTTP 200 from the local server.

### In-Game Checks

- Reload `http://127.0.0.1:8000/`
- Confirm the Level 1 build icon uses the new sprite
- Confirm selection portraits resolve Levels 1–5
- Confirm no browser warnings or errors
- Verify desktop and narrow layouts
- Place the turret in the play area
- Upgrade it through Levels 1–5
- Confirm upgrade stars remain visible
- Confirm sprite rotation matches targeting direction
- Confirm the sprite has no old outline, background, or external box
- Start a wave and confirm targeting and attacks are unchanged
- Confirm save/load still works if touched

If a full placement and upgrade test cannot be completed, state that explicitly as the remaining risk.

## Commit and Deployment Rules

Follow `docs/CHANGE_PROTOCOL.md` before every commit or push.

- Inspect `git status` and preserve unrelated work
- Update the visible HUD version and timestamp in `index.html`
- Commit the intended sprite files and integration changes together
- Push only when the user requests it
- Production deployment occurs when the tested commit is pushed to `main`
- Verify the live version stamp and each new sprite URL after deployment

## Resume Checklist

When starting the next turret after a break:

1. Read this document and `docs/CHANGE_PROTOCOL.md`.
2. Run `git status --short` before editing.
3. Identify the next unfinished turret from Current Progress.
4. Inspect its legacy base art and two completed turret sets.
5. Generate and review Levels 1–5 sequentially.
6. Remove chroma, normalize to 256×256 RGBA, and validate alpha.
7. Wire the new set into sprites, icons, portraits, and cache versions.
8. Run all static, local HTTP, responsive, browser-console, and gameplay checks.
9. Update Current Progress in this document.
10. Commit, push, and deploy only when requested.
