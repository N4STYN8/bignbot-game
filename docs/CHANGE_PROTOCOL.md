# Change Protocol

This protocol is mandatory for every Codex change in this repository.

## Workflow
1. Plan
2. Patch
3. Run
4. Verify
5. Summarize

## Rules
- Edit the smallest relevant function(s) only.
- Never rename public functions/variables without updating every reference in the repo.
- Add `// CODEX CHANGE:` immediately above each edited code block.
- Before every commit/push that changes the game, update the visible HUD version stamp in `index.html` with a new version/date/time.

## Release Checklist
- Update the visible HUD version stamp in `index.html`.
- Run `node --check` on every changed JavaScript file.
- Reload `http://127.0.0.1:8000/` and check for browser console errors.
- For gameplay changes, verify at least one wave start, one enemy kill, one turret upgrade, and save/load if touched.
- For wave, boss, or level changes, verify the wave 16 main boss transition.
- For UI changes, verify desktop and narrow/mobile layout.
- Mention any remaining risk or untested area in the final summary.

## Do Not Break
- Wave 16 only clears after the main final boss dies.
- Final boss death must play the collapse cinematic before the next level appears.
- Visual-only VFX must not apply damage unless `dps` is a finite positive number.
- Venom splash DOT must not scale from gold, reward, or combo payout.
- Save files should keep loading unless a migration is intentionally added.
- The visible version stamp must stay small, translucent, and readable in the HUD.

## Execution Details

### 1) Plan
- Identify exact files/functions to touch.
- List expected side effects before editing.
- Confirm whether change is mechanical refactor vs behavior change.

### 2) Patch
- Apply minimal diff.
- Keep naming/API stable unless explicitly requested.
- For refactors, move code first; change logic only if required to keep parity.

### 3) Run
- Launch the game or run available checks.
- Capture runtime errors/exceptions.

### 4) Verify
- Validate target behavior and adjacent workflows.
- For UI/gameplay changes, verify no regressions in wave flow, targeting, placement, save/load, and controls.

### 5) Summarize
- Report files changed and why.
- Report verification performed and any residual risk.
- If blocked, state blocker clearly and smallest next step.

## Guardrails
- Avoid broad rewrites when a local fix is possible.
- Preserve save compatibility unless the task requires migration.
- If touching high-risk zones from `docs/SYSTEM_MAP.md`, run extra manual checks.
