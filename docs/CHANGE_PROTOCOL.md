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
