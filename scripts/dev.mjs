import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const nodeBin = process.execPath;

const children = [
  spawn(nodeBin, [tsxCli, "watch", "src/api/index.ts"], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  }),
  spawn(nodeBin, [viteCli], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  }),
];

let shuttingDown = false;

function shutdown(signal = "SIGTERM") {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      shutdown();
      process.exitCode = code ?? 1;
      return;
    }

    if (signal) {
      shutdown(signal);
    }
  });
}
