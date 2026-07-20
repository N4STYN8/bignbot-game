// CODEX CHANGE: Launch an isolated Electron smoke run and return its real exit status.
const path = require("node:path");
const { spawn } = require("node:child_process");
const electronBinary = require("electron");

const child = spawn(electronBinary, [path.join(__dirname, ".."), "--enable-logging"], {
  env: {
    ...process.env,
    ORBIT_ECHO_DESKTOP_SMOKE: "1",
    ELECTRON_ENABLE_LOGGING: "1"
  },
  stdio: "inherit"
});

child.once("error", (error) => {
  console.error("Unable to start Electron smoke test.", error);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) console.error(`Electron smoke test ended with signal ${signal}.`);
  process.exitCode = code ?? 1;
});
