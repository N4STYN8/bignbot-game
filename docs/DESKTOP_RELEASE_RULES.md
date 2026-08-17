# Web and Desktop Release Rules

Orbit Echo has two release targets that share one game codebase:

- The live web build is served from `index.html`, `styles.css`, `src/`, and `assets/`.
- The desktop build wraps that same web build with Electron code stored in `desktop/`.

## Required Separation

1. The web build must remain directly deployable without Electron, Node.js, or desktop-only globals.
2. Desktop-only behavior belongs in `desktop/`. Shared game modules must not import Electron packages.
3. Any desktop capability exposed to the game must use the context-isolated preload bridge and must be optional when the bridge is absent.
4. Desktop packaging files and generated installers must not be copied into the live web root.
5. Web deployment and Steam desktop deployment are separate release actions. Never push or publish one merely because the other was built.

## Change Workflow

For changes to shared game files:

1. Follow `docs/CHANGE_PROTOCOL.md`, including the visible HUD version stamp before a commit or push.
2. Run JavaScript syntax checks for every changed JavaScript file.
3. Test the live web build in a browser.
4. Test the desktop build when Electron is available.
5. Preserve save compatibility across both targets unless a documented migration is included.

For desktop-only changes:

1. Keep the change under `desktop/` or in desktop packaging configuration.
2. Verify the web build still loads without the desktop bridge.
3. Verify the packaged application launches without a development server.

## Asset and Network Rules

- Required gameplay assets must be packaged locally for desktop releases.
- Optional online services must fail safely and must not prevent offline play.
- Do not include analytics in the desktop build unless it is deliberately approved and disclosed.
- Generated directories such as `node_modules/` and `dist-electron/` are never web deployment content.

## Branch Safety

- `main` remains the live-web release line.
- Desktop packaging work is developed on `codex/steam-desktop` until it is reviewed for integration.
- The preserved pre-Electron snapshot is commit `57e9e1d` and remote branch `codex/live-web-snapshot-20260720-1810`.
