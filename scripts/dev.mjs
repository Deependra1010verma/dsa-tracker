import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs");
const viteCli = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const nodeBin = process.execPath;

const apiUrl = "http://127.0.0.1:4000/api/health";

const apiChild = spawn(nodeBin, [tsxCli, "watch", "src/api/index.ts"], {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

let viteChild = null;
const children = [apiChild];
let viteStarted = false;

async function waitForApi() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(apiUrl);
      if (response.ok) {
        return true;
      }
    } catch {
      // Keep polling until the API is ready or exits.
    }

    if (apiChild.exitCode !== null || apiChild.signalCode !== null) {
      return false;
    }

    await delay(250);
  }

  return false;
}

function startViteNow() {
  if (viteStarted) {
    return;
  }

  viteStarted = true;
  viteChild = spawn(nodeBin, [viteCli], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
  children.push(viteChild);

  viteChild.on("exit", (code, signal) => {
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

async function startVite() {
  const apiReady = await waitForApi();
  if (!apiReady) {
    process.stderr.write("API not ready yet; starting frontend anyway so the site can load.\n");
    startViteNow();
    return;
  }

  startViteNow();
}

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

void startVite();
