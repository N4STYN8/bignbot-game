# Orbit Echo Workspace Rules

- After successfully building and verifying a new Windows installer, store installers only in the workspace `dist-electron` directory. Do not copy installers to the user's Desktop.
- In `dist-electron`, retain the current and previous `.exe` installers and their matching `.exe.blockmap` files. Retain current packager support output such as `win-unpacked`, `latest.yml`, and `builder-debug.yml`.
- Remove any duplicate `Orbit Echo Setup <version>.exe` files from `C:\Users\natha\Desktop` after verifying the exact targets.
- Before removing older installers or blockmaps, resolve and verify every exact target inside `C:\Users\natha\Desktop` or `C:\Users\natha\Desktop\bignbot-game\dist-electron`. Never remove the current or immediately previous release from `dist-electron`.
- Report which installer versions were removed and which two were retained in `dist-electron`.
